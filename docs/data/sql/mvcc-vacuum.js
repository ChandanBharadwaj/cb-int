IA.register({
  track: 'sql',
  slug: 'mvcc-vacuum',
  title: 'MVCC & VACUUM',
  tagline: 'Postgres never updates a row in place. Every UPDATE writes a <b>new version</b>, and every snapshot picks the version it is allowed to see. VACUUM is the garbage collector, and anything that keeps an old snapshot alive stops it.',
  tldr: {
    problem: 'Tables and indexes grow 10× while the row count stays flat, queries slow down, and in the worst case the database stops accepting writes to avoid <b>transaction ID wraparound</b>.',
    model: 'Each tuple carries <code>xmin</code> (the xid that created it) and <code>xmax</code> (the xid that deleted or replaced it). A snapshot says which xids count as committed. A version is dead once no snapshot can still see it, and only then can VACUUM reclaim it.',
    hook: '“Autovacuum is running all the time but the table keeps growing.” Something is pinning the <b>xmin horizon</b>: an idle-in-transaction session, a long report, a replication slot.',
    facts: [
      { v: 'UPDATE = INSERT + DELETE', l: 'a new tuple with a new <code>ctid</code>; the old one gets <code>xmax</code> set. Even <code>SET x = x</code> does this' },
      { v: '50 + 20%', l: 'default autovacuum trigger: <code>autovacuum_vacuum_threshold</code> + <code>scale_factor</code> × rows. On a 100M-row table that is 20M dead tuples' },
      { v: '2³¹', l: 'xids visible as “the past”. Freezing old rows is mandatory; autovacuum forces it at an age of 200M' }
    ]
  },
  intro: {
    what: 'Many people read and write the same table at once. Instead of making readers wait for writers, Postgres keeps <b>several versions</b> of a row. A writer adds a new version; a reader keeps looking at the version that was current when it started. This is <b>MVCC</b> (multi-version concurrency control). Old versions pile up, so a background job, <b>VACUUM</b>, cleans up versions nobody can see any more.',
    analogy: { icon: '📝', title: 'A ledger written in pen', text: 'You never erase a line in a paper ledger. To change an entry you strike it through, note who struck it, and write a new line. Each reader looks at the ledger “as of” the moment they opened it, so they ignore lines added later. Once nobody is reading an old page any more, a clerk can recycle the struck-through lines. That clerk is VACUUM.' },
    steps: [
      { t: 'Every row has hidden columns', d: 'You can select them: <code>xmin</code> is the transaction that created this version, <code>xmax</code> the one that deleted it (0 = still alive), <code>ctid</code> its physical address (page, slot).', code: 'SELECT xmin, xmax, ctid, * FROM accounts;' },
      { t: 'UPDATE writes a new version', d: 'The old version gets <code>xmax</code> set, and a new version appears at a new <code>ctid</code>. Run the query twice around an UPDATE and watch the ctid move.', code: "UPDATE accounts SET balance = balance + 10 WHERE id = 1;" },
      { t: 'Readers see a snapshot', d: 'A transaction sees only versions created by transactions that had committed when its snapshot was taken. So a long-running reader can keep seeing the <i>old</i> balance while others already see the new one.' },
      { t: 'VACUUM cleans up', d: 'Versions that no running transaction can see are “dead”. Autovacuum removes them so the space can be reused. A transaction left open for hours stops that cleanup for the whole database.' }
    ],
    terms: [
      ['tuple', 'One physical version of a row on disk.'],
      ['xid', 'Transaction ID: a 32-bit counter, one per writing transaction.'],
      ['snapshot', 'The list of which xids count as committed for this query or transaction.'],
      ['dead tuple', 'A version no running transaction can see. It still takes space until VACUUM runs.'],
      ['bloat', 'Space in tables and indexes taken up by dead or empty slots.'],
      ['xmin horizon', 'The oldest xid any session might still need. VACUUM can’t remove anything newer.']
    ]
  },
  visual: {
    title: 'Watch row versions pile up, and VACUUM try to clean them',
    caption: 'Session B updates one row twice while session A reads it. Switch A between READ COMMITTED and REPEATABLE READ, give <code>bal</code> an index (no HOT), leave A idle in transaction, or try VACUUM FULL. The ✓ columns show which version each snapshot sees.'
  },
  extras: [
    { id: 'mvcc-vacuum-xid', title: 'XID wraparound: a 32-bit counter on a circle', label: 'Wraparound', caption: 'Press Play to burn xids. With freezing allowed, the old row becomes frozen and survives the wrap. With freezing blocked, watch the failsafe, the warnings, and the write outage.' },
    { id: 'mvcc-vacuum-autovac', title: 'When will autovacuum actually start?', label: 'Thresholds', caption: 'The default scale factor is fine for small tables and terrible for big ones. Pick a size and a churn rate.' }
  ],
  playground: {
    setup: `
CREATE TABLE acct (id int PRIMARY KEY, owner text NOT NULL, bal int NOT NULL);
INSERT INTO acct VALUES (1,'asha',100),(2,'ben',200),(3,'chen',300);`,
    presets: [
      { label: 'xmin / xmax / ctid', sql: `SELECT xmin, xmax, ctid, * FROM acct ORDER BY id;`, note: 'All three rows were inserted by one transaction, so they share an xmin. xmax 0 = never deleted. ctid = (page, slot).' },
      { label: 'UPDATE moves ctid', sql: `SELECT ctid, xmin FROM acct WHERE id = 1;\nUPDATE acct SET bal = bal + 10 WHERE id = 1;\nSELECT ctid, xmin FROM acct WHERE id = 1;\nUPDATE acct SET bal = bal WHERE id = 1;   -- a no-op value change\nSELECT ctid, xmin FROM acct WHERE id = 1;`, note: 'Each UPDATE creates a new tuple at a new ctid, even one that changes nothing. (The playground runs a batch as one implicit transaction, so xmin stays the same here; run the statements one by one to see it change.)' },
      { label: 'Inside my transaction', sql: `BEGIN;\nUPDATE acct SET bal = 0 WHERE id = 2;\nSELECT pg_current_xact_id() AS my_xid, xmin, xmax, ctid, * FROM acct WHERE id = 2;\nROLLBACK;`, note: 'The new version’s xmin is your own xid, so you can see it even though it isn’t committed.' },
      { label: 'Rollback leaves xmax', sql: `BEGIN;\nDELETE FROM acct WHERE id = 3;\nROLLBACK;\nSELECT xmin, xmax, ctid, * FROM acct WHERE id = 3;`, note: 'xmax is non-zero but the row is visible: the deleting xid aborted, and the commit log says so. Rollback costs nothing because nothing is undone.' },
      { label: 'FOR UPDATE writes xmax', sql: `BEGIN;\nSELECT * FROM acct WHERE id = 1 FOR UPDATE;\nSELECT xmax, pg_current_xact_id() AS me FROM acct WHERE id = 1;\nCOMMIT;`, note: 'Row locks are stored in the tuple header (xmax + flags), not in a lock table. That is why <code>SELECT … FOR UPDATE</code> dirties pages and needs an xid.' },
      { label: 'Freeze & age', sql: `SELECT relname, age(relfrozenxid) AS xid_age FROM pg_class WHERE relname = 'acct';\nSELECT datname, age(datfrozenxid) FROM pg_database ORDER BY 2 DESC;\n-- now replace everything with:  VACUUM (FREEZE) acct;  run it, then run this again`, note: 'VACUUM can’t run inside a multi-statement batch, so run it on its own. After a freeze, the table’s age drops to ~0. In production, alert when <code>age(datfrozenxid)</code> passes ~500M.' }
    ]
  },
  gotchas: [
    { trap: 'Idle in transaction pins the horizon for the whole cluster', code: `SELECT pid, state, now() - xact_start AS age, backend_xmin, left(query, 60)\nFROM pg_stat_activity\nWHERE backend_xmin IS NOT NULL\nORDER BY age(backend_xmin) DESC;`, why: 'VACUUM can’t remove a version that any snapshot might still need, in <i>any</i> table of the database. One forgotten session holding a snapshot stops cleanup everywhere.', fix: 'Set <code>idle_in_transaction_session_timeout</code> (e.g. 60s) and <code>transaction_timeout</code> (PG17+). Never do HTTP calls inside <code>@Transactional</code>.' },
    { trap: 'Other things also hold the horizon back', why: 'A replication slot whose consumer is gone, <code>hot_standby_feedback = on</code> with a long query on a replica, an orphaned prepared transaction (<code>pg_prepared_xacts</code>), and long-running statements in any session.', fix: 'Monitor <code>pg_replication_slots</code> (<code>xmin</code>, <code>catalog_xmin</code>, retained WAL) and <code>pg_prepared_xacts</code>. Set <code>max_slot_wal_keep_size</code>.' },
    { trap: 'VACUUM doesn’t shrink the file', why: 'Plain VACUUM marks space reusable inside the table (via the free space map). It only gives space back to the OS when the trailing pages are completely empty.', fix: 'For real shrinking use <code>pg_repack</code> or <code>pg_squeeze</code>, which work online. <code>VACUUM FULL</code> rewrites the table under an ACCESS EXCLUSIVE lock: no reads, no writes.' },
    { trap: 'An index on updated_at kills HOT', code: `-- every UPDATE touches updated_at → indexed column changed → no HOT\nCREATE INDEX ON orders (updated_at);`, why: 'HOT updates (no new index entries, cheap on-page cleanup) require that <b>no indexed column</b> changes and that the new version fits on the same page.', fix: 'Don’t index frequently changing columns unless you need to. Lower <code>fillfactor</code> (e.g. 80–90) on hot update tables. Check <code>n_tup_hot_upd / n_tup_upd</code> in pg_stat_user_tables.' },
    { trap: 'Default scale_factor on a huge table', why: '20% of 500M rows is 100M dead tuples before autovacuum even starts, and then one very long run.', fix: 'Per table: <code>ALTER TABLE t SET (autovacuum_vacuum_scale_factor = 0.01)</code>, or 0 plus a fixed threshold. Raise <code>autovacuum_vacuum_cost_limit</code> so it can keep up.' },
    { trap: 'Autovacuum cancels itself on lock conflicts, except anti-wraparound', why: 'A normal autovacuum yields if someone needs a conflicting lock (e.g. a migration). An anti-wraparound vacuum does not yield, so your DDL waits behind it instead.', fix: 'Run migrations with <code>lock_timeout</code>. If a “to prevent wraparound” vacuum blocks you, let it finish; it is protecting you.' },
    { trap: 'COUNT(*) and the visibility map', why: 'An index-only scan can skip the heap only for pages that the visibility map marks “all-visible”. A table that is rarely vacuumed falls back to heap fetches.', fix: 'Insert-heavy tables get vacuumed because of the insert threshold (PG13+), which keeps the visibility map current. Check <code>Heap Fetches</code> in EXPLAIN ANALYZE.' }
  ],
  scenarios: [
    { title: 'The job queue table grew from 200 MB to 40 GB with 5,000 live rows',
      symptom: 'Polling <code>SELECT … FROM jobs WHERE status = \'ready\' LIMIT 10</code> went from 1 ms to 900 ms. Autovacuum logs show it runs every minute and removes almost nothing: “tuples: 0 removed, 3,800,000 dead but not yet removable”.',
      diagnose: `SELECT pid, usename, application_name, state,\n       now() - xact_start AS xact_age, backend_xmin\nFROM pg_stat_activity\nWHERE backend_xmin IS NOT NULL\nORDER BY age(backend_xmin) DESC LIMIT 5;\n-- also: SELECT slot_name, active, xmin FROM pg_replication_slots;`,
      cause: 'A reporting tool opened a REPEATABLE READ transaction at 02:00 and sat <b>idle in transaction</b> for 9 hours. Every dead job row since then was still “possibly visible”.',
      fix: 'Terminate the session, then let VACUUM catch up (it reclaims space within the file; run pg_repack to shrink it). Prevent it with timeouts and a monitoring alert on the age of <code>backend_xmin</code>.',
      fixCode: `SELECT pg_terminate_backend(12345);\nALTER ROLE reporting SET idle_in_transaction_session_timeout = '5min';\nALTER DATABASE app SET idle_in_transaction_session_timeout = '60s';` },
    { title: 'Writes fail at 03:00: “database is not accepting commands that assign new transaction IDs”',
      symptom: 'Every INSERT and UPDATE errors out. Reads work. For weeks the logs had warned “database must be vacuumed within N transactions”, but nobody alerted on it.',
      diagnose: `SELECT datname, age(datfrozenxid) FROM pg_database ORDER BY 2 DESC;\nSELECT c.oid::regclass, age(c.relfrozenxid), pg_size_pretty(pg_total_relation_size(c.oid))\nFROM pg_class c WHERE c.relkind IN ('r','t','m')\nORDER BY 2 DESC LIMIT 10;\nSELECT slot_name, active, xmin, catalog_xmin FROM pg_replication_slots;`,
      cause: 'A replication slot from a decommissioned CDC connector kept <code>xmin</code> old for months, so no vacuum could freeze past it. Age crept up to the 2³¹ − 3M hard stop (PG14+).',
      fix: 'Drop the dead slot, then VACUUM the oldest tables first. On PG14+ do this in normal multi-user mode; single-user mode is no longer recommended. Afterwards: alert at age > 500M and on inactive slots.',
      fixCode: `SELECT pg_drop_replication_slot('debezium_old');\nVACUUM (FREEZE, VERBOSE) big_events;   -- oldest first\n-- monitoring query: age(datfrozenxid) > 500000000 → page someone` },
    { title: 'Index size triples after adding “last_seen_at”',
      symptom: 'A sessions table with 2M rows is updated 3,000 times per second. After a release that indexed <code>last_seen_at</code>, write latency doubled and all its indexes ballooned.',
      diagnose: `SELECT relname, n_tup_upd, n_tup_hot_upd,\n       round(100.0 * n_tup_hot_upd / nullif(n_tup_upd, 0), 1) AS hot_pct\nFROM pg_stat_user_tables WHERE relname = 'sessions';`,
      cause: 'Before the release about 95% of updates were HOT. Indexing the column every update changes made HOT impossible, so each update now inserts into <b>every</b> index of the table.',
      fix: 'Drop the index (or index a coarser value that rarely changes), and set fillfactor so the new versions fit on the same page.',
      fixCode: `DROP INDEX CONCURRENTLY sessions_last_seen_at_idx;\nALTER TABLE sessions SET (fillfactor = 85);  -- applies to newly written pages` }
  ],
  puzzles: [
    { kind: 'predict', q: 'The seed rows sit at ctid (0,1)…(0,3). What is the ctid of row 1 after this no-op update?', code: `UPDATE acct SET bal = bal WHERE id = 1;\nSELECT ctid FROM acct WHERE id = 1;`, options: ['(0,1): nothing changed', '(0,4)', '(1,1)', 'Error: no change'], answer: 1, explain: 'Postgres writes a new version for every updated row, even when no value changes. It goes into the next free slot on the same page: <b>(0,4)</b>. Add <code>WHERE bal IS DISTINCT FROM …</code> to avoid no-op writes.' },
    { kind: 'predict', q: 'What does the last query show?', code: `BEGIN;\nDELETE FROM acct WHERE id = 2;\nROLLBACK;\nSELECT xmax <> '0' AS xmax_set, bal FROM acct WHERE id = 2;`, options: ['No rows: it was deleted', 'xmax_set = false, 200', 'xmax_set = true, 200', 'Error'], answer: 2, explain: 'The DELETE stamped its xid into xmax. ROLLBACK doesn’t touch the tuple; it only records “aborted” in the commit log. Readers check that and ignore the xmax: <b>true, 200</b>.' },
    { kind: 'predict', q: 'Is the row locked by me according to the tuple header?', code: `BEGIN;\nSELECT * FROM acct WHERE id = 1 FOR UPDATE;\nSELECT xmax::text = pg_current_xact_id()::text AS locked_by_me FROM acct WHERE id = 1;`, options: ['true', 'false: row locks live in pg_locks', 'NULL', 'Error: no xid assigned'], answer: 0, explain: 'Row locks are written into the tuple: <code>xmax</code> = the locker’s xid plus infomask bits that say “lock only”. Taking the lock forces an xid to be assigned. Result: <b>true</b>.' },
    { kind: 'concept', q: 'Default settings, a 50M-row table. Roughly how many dead tuples before autovacuum starts vacuuming it?', options: ['50', '1,000,050', '10,000,050', '25,000,000'], answer: 2, explain: '50 + 0.2 × 50,000,000 = <b>10,000,050</b>. That is why big tables need a per-table <code>autovacuum_vacuum_scale_factor</code>.' },
    { kind: 'concept', q: 'Which of these does NOT hold back VACUUM’s xmin horizon?', options: ['A REPEATABLE READ transaction idle for an hour', 'An inactive logical replication slot', 'A replica with hot_standby_feedback = on running a 2-hour query', 'A pooled connection that is idle (not in a transaction)'], answer: 3, explain: 'A connection that is idle <i>outside</i> a transaction holds no snapshot and no xid. The other three all pin old versions.' },
    { kind: 'concept', q: 'An UPDATE changes only <code>status</code>, which is not indexed, and the page has free space. What happens to the table’s 4 indexes?', options: ['Each gets a new entry', 'Only the primary key gets a new entry', 'Nothing: it is a HOT update', 'They are marked invalid until VACUUM'], answer: 2, explain: 'A <b>heap-only tuple</b> (HOT) update: the new version is chained from the old one on the same page, and the indexes keep pointing at the chain’s root.' }
  ],
  interview: [
    { q: 'Explain how Postgres decides whether a row version is visible to a query.', a: '<p>Each tuple has <code>xmin</code> and <code>xmax</code>. The snapshot holds <code>xmin</code> (oldest still-running xid), <code>xmax</code> (first not-yet-assigned xid) and the list of in-progress xids. A version is visible if its xmin is committed and “in the past” for the snapshot, and its xmax is 0, aborted, still running, or “in the future”. Commit status comes from pg_xact (cached as hint bits in the tuple).</p>', fu: 'Why does the first SELECT after a big bulk load write to disk? (It sets hint bits.)', lvl: 'deep' },
    { q: 'READ COMMITTED vs REPEATABLE READ in MVCC terms?', a: '<p>READ COMMITTED takes a new snapshot for <b>each statement</b>. REPEATABLE READ takes one at the first statement and keeps it for the whole transaction. That is why RR never sees other commits and also why a long RR transaction pins the horizon. See <a href="isolation-levels.html">Isolation levels</a>.</p>', lvl: 'core' },
    { q: 'What does VACUUM do, and how is VACUUM FULL different?', a: '<p>VACUUM removes dead tuples and their index entries, records free space in the FSM, updates the visibility map, and freezes old tuples. It takes a SHARE UPDATE EXCLUSIVE lock, so reads and writes go on. VACUUM FULL rewrites the table and all indexes into new files under ACCESS EXCLUSIVE, which blocks everything; it needs space for a full copy. Online alternative: pg_repack.</p>', lvl: 'core' },
    { q: 'What is a HOT update and how do you get more of them?', a: '<p>Heap-only tuple: if no indexed column changes and the new version fits on the same page, Postgres chains it from the old version and adds no index entries. Old chain members can be pruned during normal page access, without VACUUM. Get more of them by not indexing volatile columns and by lowering <code>fillfactor</code>. Measure with <code>n_tup_hot_upd</code>.</p>', fu: 'Does a HOT update on a BRIN-indexed column still count as HOT? (PG16+: yes, summarizing indexes don’t block HOT.)', lvl: 'deep' },
    { q: 'Autovacuum runs constantly but bloat grows. Walk through your diagnosis.', a: '<p>1) Check whether tuples are “dead but not yet removable” (VACUUM VERBOSE, <code>log_autovacuum_min_duration</code>). 2) If yes, find the horizon holder: <code>pg_stat_activity.backend_xmin</code>, <code>pg_replication_slots</code>, <code>pg_prepared_xacts</code>, replica feedback. 3) If no, autovacuum can’t keep up: lower the scale factor, raise <code>autovacuum_vacuum_cost_limit</code> and the number of workers.</p>', lvl: 'deep' },
    { q: 'What is transaction ID wraparound and how does Postgres prevent it?', a: '<p>xids are 32-bit and compared modulo 2³², so only about 2.1B are “in the past”. Old tuples must be <b>frozen</b> (marked as older than everything) before they fall into the future half. Autovacuum forces an aggressive freeze when <code>age(relfrozenxid)</code> passes <code>autovacuum_freeze_max_age</code> (200M). PG14+ adds the failsafe at 1.6B. At 3M remaining, Postgres refuses to assign new xids.</p>', fu: 'Do read-only transactions consume xids? (No. Only those that write or lock rows get an xid.)', lvl: 'core' },
    { q: 'Why can a SELECT FOR UPDATE cause bloat-like I/O?', a: '<p>Row locks are stored in the tuple header (xmax + infomask), so locking a row dirties its page and writes WAL. With several lockers (FOR SHARE) Postgres creates a <b>MultiXact</b>, which has its own ID space and its own wraparound/freeze maintenance.</p>', lvl: 'deep' },
    { q: 'Why don’t indexes store visibility information?', a: '<p>Index entries point to heap tuples (ctid) without xmin/xmax, so the heap must be checked. The exception is an index-only scan, which skips the heap for pages the visibility map marks all-visible. That is one reason why regular vacuuming matters for read performance.</p>', lvl: 'core' },
    { q: 'How do you reclaim 300 GB of bloat on a 24/7 table?', a: '<p><code>pg_repack</code> (or pg_squeeze): it builds a copy online using a trigger log, then swaps the files under a brief ACCESS EXCLUSIVE lock. It needs free disk space equal to the table plus its indexes. Bloated indexes alone: <code>REINDEX INDEX CONCURRENTLY</code> (PG12+). First fix the cause, or it comes back.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'The classic horizon-pinner in Spring', lang: 'java', code: `@Transactional          // a snapshot is taken at the first query and held
public void syncCustomer(long id) {
    Customer c = repo.findById(id).orElseThrow();   // snapshot here
    Profile p = crmClient.fetch(c.getExternalId());  // 30 s HTTP call, session "idle in transaction"
    c.apply(p);
}

// Better: do the remote call outside the transaction
public void syncCustomer(long id) {
    String ext = tx.execute(s -> repo.findById(id).orElseThrow().getExternalId());
    Profile p = crmClient.fetch(ext);
    tx.executeWithoutResult(s -> repo.findById(id).orElseThrow().apply(p));
}`, note: 'Hikari’s <code>leakDetectionThreshold</code> logs connections held longer than N ms. It is a good way to find these.' },
    { title: 'Server-side guard rails', lang: 'sql', code: `ALTER DATABASE app SET idle_in_transaction_session_timeout = '60s';
ALTER DATABASE app SET transaction_timeout = '10min';          -- PG17+
ALTER SYSTEM SET log_autovacuum_min_duration = '1s';
ALTER TABLE orders SET (autovacuum_vacuum_scale_factor = 0.02,
                        autovacuum_vacuum_cost_limit = 2000);` }
  ]
});

IA.register({
  track: 'sql',
  slug: 'locking',
  title: 'Locking in Postgres',
  tagline: 'MVCC means readers and writers don’t block each other. Locks are what is left: <b>8 table lock modes</b>, <b>4 row lock modes</b>, and a FIFO wait queue that can turn a 1 ms migration into a 10-minute outage.',
  tldr: {
    problem: 'A harmless-looking <code>ALTER TABLE</code> freezes the whole app, a job queue processes one job at a time with 20 workers, and nobody can say who blocks whom.',
    model: 'Every statement takes a <b>table lock</b> (SELECT the weakest, most ALTER TABLE the strongest). Writes also take <b>row locks</b>, stored in the tuple header. A request that conflicts with a held lock <i>or with an earlier waiter</i> joins the queue.',
    hook: '“ADD COLUMN is instant since PG11, so why did prod hang?” It is instant <b>once it has the lock</b>. Waiting for the lock is the outage.',
    facts: [
      { v: '8 + 4', l: 'table lock modes + row lock modes. The table conflict matrix is the one to know by heart for ACCESS SHARE / ROW EXCLUSIVE / ACCESS EXCLUSIVE' },
      { v: '0 = ∞', l: 'default <code>lock_timeout</code>: a DDL statement waits forever, and everyone queues behind it' },
      { v: 'KEY SHARE', l: 'the row lock an FK check takes on the parent. It doesn’t conflict with normal UPDATEs of the parent' }
    ]
  },
  intro: {
    what: 'When two sessions want to change the same thing at the same time, one has to wait. A <b>lock</b> is a “reserved” sign: a session takes it, works, and releases it at <b>COMMIT or ROLLBACK</b>. Postgres takes most locks automatically. You rarely write <code>LOCK</code> yourself, but you need to know which statements take which locks.',
    analogy: { icon: '🚻', title: 'One key for the washroom', text: 'Many people can look at the washroom door at the same time (reads). Only one can hold the key (write). If someone big is waiting for the key, the people who arrive after them line up behind them, even those who only wanted to glance in. That line is the lock queue.' },
    steps: [
      { t: 'Reads don’t block writes', d: 'Thanks to MVCC, a SELECT reads an old version instead of waiting. A SELECT and an UPDATE on the same row both run.' },
      { t: 'Writes to the same row do', d: 'Two UPDATEs of the same row: the second waits until the first commits or rolls back.', code: "-- session 1\nBEGIN; UPDATE accounts SET bal = bal - 10 WHERE id = 1;\n-- session 2 (waits here)\nUPDATE accounts SET bal = bal + 5 WHERE id = 1;" },
      { t: 'Locks last until the transaction ends', d: 'Not until the statement ends. A long transaction holds its locks for its whole life.' },
      { t: 'You can see them', d: 'The <code>pg_locks</code> view lists every lock, held or awaited.', code: "SELECT locktype, relation::regclass, mode, granted\nFROM pg_locks WHERE pid = pg_backend_pid();" }
    ],
    terms: [
      ['table lock', 'A lock on a whole table, in one of 8 modes. Even SELECT takes the weakest (ACCESS SHARE).'],
      ['row lock', 'A lock on one row, taken by UPDATE, DELETE and SELECT … FOR UPDATE / SHARE.'],
      ['conflict', 'Two lock modes that can’t be held at once by different sessions. The second waits.'],
      ['lock queue', 'Waiting requests, served in arrival order.'],
      ['lock_timeout', 'How long a statement may wait for a lock before it fails. 0 = forever.']
    ]
  },
  visual: {
    title: 'The lock queue incident',
    caption: 'A long report holds ACCESS SHARE. A deploy runs <code>ALTER TABLE</code>. Watch what happens to the 1 ms queries that arrive after it, then replay it with <code>lock_timeout</code> or with <code>CREATE INDEX CONCURRENTLY</code>.'
  },
  extras: [
    { id: 'locking-matrix', title: 'Lock conflict matrix', label: 'Matrix', caption: 'Pick what session 1 holds and what session 2 wants, or click a cell. Switch to row locks to see why FK checks use KEY SHARE.' },
    { id: 'locking-queue', title: 'Job queue: FOR UPDATE vs NOWAIT vs SKIP LOCKED', label: 'SKIP LOCKED', caption: 'Three workers poll one table. Only SKIP LOCKED lets them work in parallel.' }
  ],
  playground: {
    setup: `
CREATE TABLE customers (id int PRIMARY KEY, name text NOT NULL);
CREATE TABLE orders (id int PRIMARY KEY, customer_id int NOT NULL REFERENCES customers(id), total numeric NOT NULL);
CREATE TABLE jobs (id int PRIMARY KEY, status text NOT NULL DEFAULT 'ready', payload text);
INSERT INTO customers VALUES (1,'Asha'),(2,'Ben');
INSERT INTO orders VALUES (10,1,99),(11,2,40);
INSERT INTO jobs (id, payload) SELECT g, 'job ' || g FROM generate_series(1,6) g;`,
    presets: [
      { label: 'Locks my UPDATE takes', sql: `BEGIN;\nUPDATE orders SET total = total + 1 WHERE id = 10;\nSELECT locktype, relation::regclass AS rel, mode, granted\nFROM pg_locks WHERE pid = pg_backend_pid() AND locktype IN ('relation','transactionid')\nORDER BY 1, 2;\nROLLBACK;`, note: 'ROW EXCLUSIVE on the table and on each index, plus an ExclusiveLock on your own xid. That xid lock is what other sessions wait on when they hit your row.' },
      { label: 'ALTER vs CREATE INDEX', sql: `BEGIN;\nALTER TABLE orders ADD COLUMN note text;\nSELECT 'ALTER ADD COLUMN' AS stmt, mode FROM pg_locks WHERE relation = 'orders'::regclass AND pid = pg_backend_pid();\nROLLBACK;\nBEGIN;\nCREATE INDEX ON orders (total);\nSELECT 'CREATE INDEX' AS stmt, mode FROM pg_locks WHERE relation = 'orders'::regclass AND pid = pg_backend_pid();\nROLLBACK;`, note: 'ACCESS EXCLUSIVE blocks even SELECT. SHARE blocks writes but allows reads. CONCURRENTLY can’t run in a transaction block, so it isn’t shown here.' },
      { label: 'FK check = KEY SHARE', sql: `BEGIN;\nINSERT INTO orders VALUES (12, 1, 10);\nSELECT xmax <> '0' AS parent_row_locked, name FROM customers WHERE id = 1;\nSELECT locktype, relation::regclass, mode FROM pg_locks\nWHERE pid = pg_backend_pid() AND relation = 'customers'::regclass;\nROLLBACK;`, note: 'The FK trigger runs <code>SELECT 1 FROM customers WHERE id = 1 FOR KEY SHARE</code>: the parent row’s xmax now carries your lock. A concurrent <code>UPDATE customers SET name = …</code> takes NO KEY UPDATE, which is compatible.' },
      { label: 'SKIP LOCKED claim', sql: `BEGIN;\nSELECT id, payload FROM jobs\nWHERE status = 'ready'\nORDER BY id LIMIT 2\nFOR UPDATE SKIP LOCKED;\nUPDATE jobs SET status = 'running' WHERE id IN (1, 2);\nSELECT id, status FROM jobs ORDER BY id;\nROLLBACK;`, note: 'One session can’t show the skipping (there is no other locker), but this is the exact pattern. A second worker would get jobs 3 and 4.' },
      { label: 'Advisory locks', sql: `SELECT pg_try_advisory_lock(42) AS first, pg_try_advisory_lock(42) AS again;  -- re-entrant\nSELECT locktype, objid, mode FROM pg_locks WHERE locktype = 'advisory';\nSELECT pg_advisory_unlock(42) AS u1, pg_advisory_unlock(42) AS u2, pg_advisory_unlock(42) AS u3;\nBEGIN;\nSELECT pg_advisory_xact_lock(hashtext('nightly-billing'));  -- freed at COMMIT\nSELECT objid, mode FROM pg_locks WHERE locktype = 'advisory';\nCOMMIT;`, note: 'Session-level locks stack: two locks need two unlocks (the third returns false). Prefer the <code>_xact_</code> variants: they can’t leak through a connection pool.' },
      { label: 'lock_timeout', sql: `SET lock_timeout = '2s';\nSHOW lock_timeout;\nSELECT name, setting, unit FROM pg_settings\nWHERE name IN ('lock_timeout','deadlock_timeout','statement_timeout','idle_in_transaction_session_timeout');`, note: 'In a migration: <code>SET lock_timeout</code> at the top, and let the tool retry on failure.' }
    ]
  },
  gotchas: [
    { trap: 'The lock queue: a waiting DDL blocks everyone behind it', code: `-- S1: long SELECT (ACCESS SHARE)\n-- S2: ALTER TABLE orders ... (wants ACCESS EXCLUSIVE, waits)\n-- S3: SELECT * FROM orders WHERE id = 1   ← waits behind S2!`, why: 'Lock requests are served in order. S3 conflicts with S2’s <i>pending</i> request, so it can’t overtake.', fix: '<code>SET lock_timeout = \'2s\'</code> before DDL, retry with back-off, and check for long transactions first.' },
    { trap: 'SELECT … FOR UPDATE on a parent locks out FK inserts', why: 'FOR UPDATE conflicts with FOR KEY SHARE, which every child INSERT takes on the parent row. Locking an account “just in case” serializes all inserts that reference it.', fix: 'Use <code>FOR NO KEY UPDATE</code> when you won’t change or delete the key. A plain UPDATE that doesn’t touch key columns already does this.' },
    { trap: 'Plain FOR UPDATE in a queue = convoy', why: 'All workers run the same <code>ORDER BY id LIMIT 1</code>, so all of them wait on the same row. When it commits they re-check it, find it done, and get 0 rows.', fix: '<code>FOR UPDATE SKIP LOCKED</code>. For high volume, consider partitioned queues or a dedicated broker.' },
    { trap: 'Session-level advisory locks leak through pools', why: '<code>pg_advisory_lock</code> lives until unlock or disconnect. With Hikari the connection goes back to the pool still holding the lock. With PgBouncer in transaction mode, unlock may run on another backend.', fix: 'Use <code>pg_advisory_xact_lock</code> / <code>pg_try_advisory_xact_lock</code>, which are released at commit.' },
    { trap: 'Lock-holding transactions include idle ones', code: `SELECT pid, state, wait_event_type, pg_blocking_pids(pid), left(query, 50)\nFROM pg_stat_activity WHERE cardinality(pg_blocking_pids(pid)) > 0;`, why: 'The blocker is often <i>idle in transaction</i>: its last query finished long ago, but its locks are held until it ends.', fix: '<code>idle_in_transaction_session_timeout</code>, and follow <code>pg_blocking_pids()</code> to the root.' },
    { trap: 'Lock escalation doesn’t exist in Postgres', why: 'Unlike SQL Server, Postgres never escalates many row locks into a table lock, because row locks live in the tuple header and not in memory. Locking a million rows is fine for the lock manager (but it writes every page).', fix: 'Don’t design around escalation. Do watch for <code>max_locks_per_transaction</code> when touching thousands of partitions in one transaction.' }
  ],
  scenarios: [
    { title: 'A Flyway migration took the site down for 11 minutes',
      symptom: 'Deploy at 14:02. All API latency went to 30 s, Hikari logged “Connection is not available”, and pods were restarted by liveness probes. The migration was <code>ALTER TABLE orders ADD COLUMN gift_note text</code>.',
      diagnose: `SELECT pid, state, wait_event_type, wait_event,\n       pg_blocking_pids(pid) AS blocked_by,\n       now() - query_start AS waiting, left(query, 60)\nFROM pg_stat_activity\nWHERE datname = current_database() AND state <> 'idle'\nORDER BY query_start;`,
      cause: 'A BI export had been running for 9 minutes (ACCESS SHARE). The ALTER queued for ACCESS EXCLUSIVE, and every query after it queued behind it.',
      fix: 'Every migration starts with a lock_timeout and is retried. The deploy pipeline checks for transactions older than N minutes first. Long reports run on a replica.',
      fixCode: `-- V42__add_gift_note.sql\nSET lock_timeout = '3s';\nALTER TABLE orders ADD COLUMN gift_note text;` },
    { title: 'Twenty workers, one job per second',
      symptom: 'Scaling the worker deployment from 2 to 20 pods didn’t raise throughput. Most workers showed <code>wait_event = transactionid</code>.',
      diagnose: `SELECT wait_event_type, wait_event, count(*)\nFROM pg_stat_activity WHERE application_name = 'worker'\nGROUP BY 1, 2;`,
      cause: 'The claim query was <code>SELECT … ORDER BY created_at LIMIT 1 FOR UPDATE</code>. Every worker targeted the same oldest row.',
      fix: 'Add SKIP LOCKED, claim in batches, and index the predicate.',
      fixCode: `WITH next AS (\n  SELECT id FROM jobs WHERE status = 'ready'\n  ORDER BY created_at LIMIT 10\n  FOR UPDATE SKIP LOCKED)\nUPDATE jobs j SET status = 'running', started_at = now()\nFROM next WHERE j.id = next.id\nRETURNING j.*;` },
    { title: 'Checkout inserts stall whenever support edits an account',
      symptom: 'p99 for <code>INSERT INTO orders</code> spikes to seconds, in bursts that match back-office activity.',
      diagnose: `SELECT l.mode, l.granted, a.query\nFROM pg_locks l JOIN pg_stat_activity a USING (pid)\nWHERE l.locktype = 'tuple' OR NOT l.granted;`,
      cause: 'The admin screen loads the customer with <code>@Lock(PESSIMISTIC_WRITE)</code> (FOR UPDATE) and keeps the transaction open while the agent types. FOR UPDATE conflicts with the FK check’s FOR KEY SHARE.',
      fix: 'Use optimistic locking (@Version) for the admin edit, or at least FOR NO KEY UPDATE and a short transaction.',
      fixCode: `SELECT * FROM customers WHERE id = $1 FOR NO KEY UPDATE;  -- compatible with KEY SHARE` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Which lock mode does a plain UPDATE take on the table?', code: `BEGIN;\nUPDATE orders SET total = 0 WHERE id = 10;\nSELECT mode FROM pg_locks\nWHERE relation = 'orders'::regclass AND pid = pg_backend_pid();`, options: ['RowShareLock', 'RowExclusiveLock', 'ExclusiveLock', 'AccessExclusiveLock'], answer: 1, explain: '<b>RowExclusiveLock</b> (ROW EXCLUSIVE). Despite the name it conflicts only with SHARE and stronger modes, so many writers can run at once. Row-level conflicts are handled by row locks.' },
    { kind: 'predict', q: 'And CREATE INDEX (without CONCURRENTLY)?', code: `BEGIN;\nCREATE INDEX ON orders (total);\nSELECT mode FROM pg_locks\nWHERE relation = 'orders'::regclass AND pid = pg_backend_pid();`, options: ['ShareLock', 'ShareUpdateExclusiveLock', 'AccessExclusiveLock', 'RowExclusiveLock'], answer: 0, explain: '<b>ShareLock</b>: reads continue, writes wait for the whole build. CONCURRENTLY uses SHARE UPDATE EXCLUSIVE and lets writes through.' },
    { kind: 'predict', q: 'One session, same key, two different modes:', code: `SELECT pg_try_advisory_lock_shared(1) AS shared,\n       pg_try_advisory_lock(1)        AS exclusive;`, options: ['true, false', 'true, true', 'false, false', 'Error: deadlock'], answer: 1, explain: 'A session never conflicts with its own locks: <b>true, true</b>. Conflicts are only between different sessions.' },
    { kind: 'concept', q: 'S1 runs a long SELECT. S2 issues ALTER TABLE on the same table and waits. S3 then runs a SELECT. What happens to S3?', options: ['Runs: SELECT is compatible with SELECT', 'Waits behind S2', 'Fails immediately', 'Cancels S2'], answer: 1, explain: 'S3’s ACCESS SHARE conflicts with S2’s queued ACCESS EXCLUSIVE, and the queue is fair, so S3 <b>waits behind S2</b>.' },
    { kind: 'concept', q: 'T1: <code>UPDATE customers SET name = \'X\' WHERE id = 1</code> (not committed). T2: <code>INSERT INTO orders (…, customer_id) VALUES (…, 1)</code>. Does T2 wait?', options: ['Yes: the parent row is locked', 'No: NO KEY UPDATE and KEY SHARE are compatible', 'Only at SERIALIZABLE', 'Yes, until the FK is revalidated'], answer: 1, explain: 'The UPDATE doesn’t touch the key, so it takes FOR NO KEY UPDATE. The FK check takes FOR KEY SHARE. They are <b>compatible</b> (since PG 9.3).' },
    { kind: 'concept', q: 'Which claim query lets 10 workers process different jobs in parallel?', options: ['SELECT … FOR UPDATE', 'SELECT … FOR SHARE', 'SELECT … FOR UPDATE NOWAIT', 'SELECT … FOR UPDATE SKIP LOCKED'], answer: 3, explain: '<b>SKIP LOCKED</b> ignores rows another transaction has locked. NOWAIT throws an error instead of waiting, which is useless for a queue.' }
  ],
  interview: [
    { q: 'Why can SELECT and UPDATE run concurrently on the same row in Postgres?', a: '<p>MVCC: the UPDATE writes a new version and the SELECT reads the version its snapshot allows. SELECT takes only ACCESS SHARE on the table and no row lock. The only things that block a plain SELECT are ACCESS EXCLUSIVE locks (DDL, TRUNCATE, VACUUM FULL).</p>', lvl: 'core' },
    { q: 'Explain the lock queue problem with ALTER TABLE and how you avoid it.', a: '<p>An ALTER waiting for ACCESS EXCLUSIVE sits in the queue. Later requests that conflict with it, which is all of them, queue behind it, even though they are compatible with the current holder. Avoid it with <code>lock_timeout</code> plus retries, by checking for long-running transactions before DDL, and by using lock-friendly variants (CONCURRENTLY, NOT VALID + VALIDATE).</p>', fu: 'Why doesn’t Postgres let the SELECTs jump the queue? (Starvation: the ALTER might never run.)', lvl: 'core' },
    { q: 'List the row lock modes and say when each is taken.', a: '<p><b>FOR UPDATE</b>: DELETE, UPDATE of key columns, explicit. <b>FOR NO KEY UPDATE</b>: other UPDATEs. <b>FOR SHARE</b>: explicit. <b>FOR KEY SHARE</b>: FK checks. KEY SHARE conflicts only with FOR UPDATE, which is what lets child inserts and parent updates run together.</p>', lvl: 'deep' },
    { q: 'Where are row locks stored and why does it matter?', a: '<p>In the tuple header: xmax holds the locker’s xid, and infomask bits mark it lock-only. With several lockers, xmax points to a MultiXact. So there is no memory limit and no escalation, but locking writes to pages (WAL, dirty buffers), and MultiXact IDs need their own vacuum/freeze maintenance.</p>', lvl: 'deep' },
    { q: 'How do you find who is blocking whom?', a: '<p><code>pg_blocking_pids(pid)</code> joined with <code>pg_stat_activity</code>, following the chain to the root. Check the root’s <code>state</code> (often idle in transaction), <code>xact_start</code>, and <code>query</code>. Then <code>pg_cancel_backend</code> (cancel the query) or <code>pg_terminate_backend</code> (end the session). Set <code>log_lock_waits = on</code> to log waits longer than deadlock_timeout.</p>', lvl: 'core' },
    { q: 'SKIP LOCKED vs NOWAIT: when do you use each?', a: '<p>SKIP LOCKED: work queues, where any free row is as good as another. NOWAIT: interactive “someone else is editing this record”, where you want an immediate error instead of a hang. Neither is right for reports: SKIP LOCKED silently drops rows.</p>', lvl: 'core' },
    { q: 'What are advisory locks good for, and what are the pitfalls?', a: '<p>Application-defined mutexes keyed by a bigint (or two ints): “only one instance runs the billing job”, serializing work on an external resource. Pitfalls: session-level locks survive the transaction, and leak through connection pools or misbehave with PgBouncer transaction mode. Keys collide if you hash strings carelessly. Prefer <code>pg_try_advisory_xact_lock</code>.</p>', lvl: 'core' },
    { q: 'Which ALTER TABLE forms avoid ACCESS EXCLUSIVE?', a: '<p>Most take ACCESS EXCLUSIVE, if only briefly. Lighter ones: <code>VALIDATE CONSTRAINT</code> (SHARE UPDATE EXCLUSIVE), <code>SET STATISTICS</code>, and <code>ADD FOREIGN KEY</code> (SHARE ROW EXCLUSIVE on both tables). <code>ATTACH PARTITION</code> takes SHARE UPDATE EXCLUSIVE on the parent (PG12+). Even a brief ACCESS EXCLUSIVE needs lock_timeout because of the queue.</p>', lvl: 'deep' },
    { q: 'What does max_locks_per_transaction limit?', a: '<p>The shared lock table that holds heavyweight (table/object) locks: roughly <code>max_locks_per_transaction × (max_connections + max_prepared_transactions)</code> slots. A query touching thousands of partitions, or a pg_dump of a huge schema, can hit “out of shared memory”. Row locks don’t count.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Spring: SKIP LOCKED claim with a native query', lang: 'java', code: `@Transactional
@Query(value = """
    SELECT * FROM jobs WHERE status = 'ready'
    ORDER BY created_at LIMIT :n
    FOR UPDATE SKIP LOCKED""", nativeQuery = true)
List<Job> claim(@Param("n") int n);

// JPA alternative: hint -2 = SKIP_LOCKED (Hibernate)
@Lock(LockModeType.PESSIMISTIC_WRITE)
@QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "-2"))
List<Job> findTop10ByStatusOrderByCreatedAt(String status);` },
    { title: 'Run a scheduled job on one instance only', lang: 'java', code: `@Transactional
public void nightlyBilling() {
    Boolean got = jdbc.queryForObject(
        "SELECT pg_try_advisory_xact_lock(hashtext('nightly-billing'))", Boolean.class);
    if (!Boolean.TRUE.equals(got)) return;   // another pod is running it
    billingService.run();                     // lock released at commit
}`, note: 'ShedLock does the same with a table. Either way, prefer the xact variant.' }
  ]
});

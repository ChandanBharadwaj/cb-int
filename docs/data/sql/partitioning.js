IA.register({
  track: 'sql',
  slug: 'partitioning',
  title: 'Table partitioning',
  tagline: 'A partitioned table is a <b>router</b> in front of ordinary tables. Each row goes to the one partition whose bounds match its key. Queries that filter on the key skip the other partitions, and old data leaves with a <code>DROP TABLE</code> instead of a giant <code>DELETE</code>.',
  tldr: {
    problem: 'A 4 TB events table: deleting last year’s rows takes days and bloats everything, vacuum never finishes, and every index is too big to stay in memory.',
    model: 'The parent has no storage. <code>PARTITION BY RANGE / LIST / HASH (key)</code> routes each row to a child table. The planner <b>prunes</b> partitions that cannot match, at plan time or at execution time.',
    hook: 'Partitioning only helps queries that filter on the partition key. A query that doesn’t now scans 365 tables instead of one.',
    facts: [
      { v: 'PG10 / 11', l: 'declarative range and list (PG10); hash, default partition, partitioned indexes and execution-time pruning (PG11)' },
      { v: 'key ⊂ UNIQUE', l: 'a primary key or unique constraint on a partitioned table must include every partition-key column' },
      { v: 'PG14', l: '<code>DETACH PARTITION … CONCURRENTLY</code>: detach without blocking queries on the parent' }
    ]
  },
  intro: {
    what: 'When a table gets very large, you can split it into smaller tables called <b>partitions</b>, for example one per month. You still query the parent table as if it were one table. Postgres sends each inserted row to the right partition and, when your query says which months it needs, reads only those.',
    analogy: { icon: '🗄️', title: 'A filing cabinet with a drawer per month', text: 'Invoices go into the drawer of their month. To find March invoices, open one drawer, not the whole cabinet. To throw away 2019, remove those drawers; you don’t pull out every sheet one by one.' },
    steps: [
      { t: 'Create the parent', d: 'Choose a partition key and method. The parent holds no rows itself.', code: "CREATE TABLE events (id bigint, created_at timestamptz NOT NULL, kind text)\nPARTITION BY RANGE (created_at);" },
      { t: 'Create the partitions', d: 'Each partition is a normal table with bounds. The lower bound is inclusive, the upper bound exclusive.', code: "CREATE TABLE events_2025_03 PARTITION OF events\n  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');" },
      { t: 'Insert and query the parent', d: 'Rows are routed automatically. A WHERE clause on <code>created_at</code> lets Postgres skip other months (pruning).', code: "SELECT count(*) FROM events\nWHERE created_at >= '2025-03-05' AND created_at < '2025-03-06';" },
      { t: 'Remove old data instantly', d: 'Dropping a partition deletes its rows without scanning them and without leaving dead rows to vacuum.', code: 'ALTER TABLE events DETACH PARTITION events_2024_01;\nDROP TABLE events_2024_01;' }
    ],
    terms: [
      ['partition key', 'The column(s) whose value decides which partition a row goes to.'],
      ['range / list / hash', 'Partition by value ranges (dates), by explicit lists (regions), or by a hash of the key (even spread).'],
      ['partition pruning', 'Skipping partitions that cannot contain matching rows.'],
      ['default partition', 'Catches rows that fit no other partition.'],
      ['attach / detach', 'Turn an existing table into a partition, or a partition back into a standalone table.']
    ]
  },
  visual: {
    title: 'Watch rows being routed',
    caption: 'Pick a partitioning method and press Play. Each inserted row is routed to exactly one partition. Then a query runs: pruned partitions grey out. Toggle the default partition to see where an out-of-range row lands.'
  },
  extras: [
    { id: 'partitioning-pruning', title: 'Pruning explorer', label: 'Interactive', caption: 'Pick a WHERE clause on the monthly <code>events</code> table and see which partitions are scanned, and whether pruning happens when the plan is made or when it runs. Plans match the playground.' }
  ],
  playground: {
    setup: `
CREATE TABLE events (id bigint GENERATED ALWAYS AS IDENTITY, tenant_id int NOT NULL,
  created_at timestamptz NOT NULL, kind text NOT NULL, payload text) PARTITION BY RANGE (created_at);
CREATE TABLE events_2025_01 PARTITION OF events FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE events_2025_02 PARTITION OF events FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE events_2025_03 PARTITION OF events FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE events_2025_04 PARTITION OF events FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE events_default PARTITION OF events DEFAULT;
CREATE INDEX ON events (tenant_id, created_at);           -- cascades to every partition
INSERT INTO events (tenant_id, created_at, kind)
SELECT 1 + g % 50, timestamptz '2025-01-01' + (g % 120) * interval '1 day' + (g % 1440) * interval '1 minute',
       (ARRAY['click','view','buy'])[1 + g % 3]
FROM generate_series(1, 20000) g;
CREATE TABLE customers (id int NOT NULL, region text NOT NULL, name text) PARTITION BY LIST (region);
CREATE TABLE customers_eu PARTITION OF customers FOR VALUES IN ('DE','FR','NL');
CREATE TABLE customers_us PARTITION OF customers FOR VALUES IN ('US','CA');
CREATE TABLE sessions (id bigint NOT NULL, user_id int NOT NULL) PARTITION BY HASH (user_id);
CREATE TABLE sessions_p0 PARTITION OF sessions FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE sessions_p1 PARTITION OF sessions FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE sessions_p2 PARTITION OF sessions FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE sessions_p3 PARTITION OF sessions FOR VALUES WITH (MODULUS 4, REMAINDER 3);
INSERT INTO sessions SELECT g, g FROM generate_series(1, 1000) g;
ANALYZE events; ANALYZE sessions;`,
    presets: [
      { label: 'Routing', sql: `SELECT tableoid::regclass AS partition, count(*) FROM events GROUP BY 1 ORDER BY 1;\nSELECT tableoid::regclass AS partition, count(*) FROM sessions GROUP BY 1 ORDER BY 1;`, note: '<code>tableoid::regclass</code> shows which partition each row physically lives in. Hash partitions are roughly even.' },
      { label: 'At plan time', sql: `EXPLAIN (COSTS OFF)\nSELECT count(*) FROM events\nWHERE created_at >= '2025-03-05' AND created_at < '2025-03-06';`, note: 'Only <code>events_2025_03</code> appears in the plan. The other four were removed while planning.' },
      { label: 'At execution', sql: `-- the value is unknown until execution (subquery / parameter)\nEXPLAIN (ANALYZE, COSTS OFF, TIMING OFF)\nSELECT count(*) FROM events\nWHERE created_at >= (SELECT timestamptz '2025-04-10');`, note: 'All partitions are in the plan, but three show <code>(never executed)</code>: they were pruned at run time.' },
      { label: 'Key in a function', sql: `EXPLAIN (COSTS OFF)\nSELECT count(*) FROM events\nWHERE date_trunc('month', created_at) = '2025-03-01';`, note: 'A function around the key hides it from the pruning logic: all five partitions are scanned. Write a range on the bare column instead.' },
      { label: 'Attach / detach', sql: `-- prepare May off-line, with a CHECK so ATTACH can skip the validation scan\nCREATE TABLE events_2025_05 (LIKE events INCLUDING DEFAULTS);\nALTER TABLE events_2025_05 ADD CONSTRAINT may_chk\n  CHECK (created_at >= '2025-05-01' AND created_at < '2025-06-01');\nALTER TABLE events ATTACH PARTITION events_2025_05\n  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');\n-- retention: January leaves in milliseconds\nALTER TABLE events DETACH PARTITION events_2025_01;\nDROP TABLE events_2025_01;\nSELECT tableoid::regclass AS partition, count(*) FROM events GROUP BY 1 ORDER BY 1;`, note: 'In production use <code>DETACH PARTITION … CONCURRENTLY</code> (PG14+). It can’t run inside a transaction block, so it isn’t shown in this single-transaction playground.' },
      { label: 'Partitioned index', sql: `SELECT tablename, indexname FROM pg_indexes\nWHERE tablename LIKE 'events%' ORDER BY 1;`, note: 'One <code>CREATE INDEX</code> on the parent created a matching index on every partition, and will on future ones.' }
    ]
  },
  gotchas: [
    { trap: 'Queries without the partition key', why: 'Without a filter on the key, nothing can be pruned. The query reads every partition and every partition’s index: more planning, more locks, more index descents.', fix: 'Choose the key that most queries filter on (often time or tenant). If the main access path is by id, partitioning by time may hurt those lookups.' },
    { trap: 'Unique constraints must include the key', code: `ALTER TABLE events ADD PRIMARY KEY (id);\n-- ERROR: unique constraint on partitioned table must include all partitioning columns`, why: 'Each partition enforces uniqueness only with its own index. Postgres has no global index, so it can only guarantee uniqueness if equal keys always land in the same partition.', fix: 'Use <code>PRIMARY KEY (id, created_at)</code>. If <code>id</code> alone must be globally unique, rely on a sequence or UUID generator, or keep a separate lookup table.' },
    { trap: 'Rows piling up in the default partition', why: 'If next month’s partition was never created, rows go to the default. Creating that partition later fails (<code>updated partition constraint for default partition would be violated</code>), and attaching any partition has to scan the default.', fix: 'Create partitions ahead of time (pg_partman or a scheduled job), and alert when the default partition is non-empty. Many teams have no default partition at all, so a missing partition fails loudly.' },
    { trap: 'CREATE INDEX CONCURRENTLY on the parent', why: 'It is not supported on a partitioned table. A plain CREATE INDEX on the parent locks out writes on all partitions until it finishes.', fix: 'Create the parent index with <code>ON ONLY</code> (it starts invalid), build each partition’s index <code>CONCURRENTLY</code>, then <code>ALTER INDEX parent_idx ATTACH PARTITION child_idx</code> for each one. When all are attached, the parent index becomes valid.' },
    { trap: 'Thousands of partitions', why: 'Planning has to consider partitions, and every partition the query touches is locked. Beyond the per-backend fast-path lock slots (16 before PG18), locks go through the shared lock manager, which shows up as <code>LWLock: LockManager</code> waits under high concurrency.', fix: 'Keep partition counts in the hundreds, not tens of thousands. Make sure hot queries prune to a few partitions. Daily partitions for 10 years is usually a mistake; monthly is often plenty.' },
    { trap: 'Expecting the parent to be analyzed', why: 'Autovacuum analyzes the partitions, but never the partitioned parent. Estimates for queries that span many partitions can be poor.', fix: 'Run <code>ANALYZE events</code> on the parent periodically. See <a href="statistics.html">Statistics</a>.' },
    { trap: 'DETACH CONCURRENTLY limits', why: 'It cannot run in a transaction block, and it is not allowed when the table has a default partition. If it is interrupted, the partition is left in a “detach pending” state.', fix: 'Run it from a migration step outside a transaction. If it was interrupted, complete it with <code>ALTER TABLE … DETACH PARTITION … FINALIZE</code>.' }
  ],
  scenarios: [
    { title: 'Nightly retention DELETE takes 9 hours and bloats the table',
      symptom: '<code>DELETE FROM audit_log WHERE created_at &lt; now() - interval \'90 days\'</code> runs for hours, replicas lag, and the table never shrinks.',
      diagnose: `SELECT n_dead_tup, last_autovacuum FROM pg_stat_user_tables WHERE relname = 'audit_log';\nSELECT pg_size_pretty(pg_total_relation_size('audit_log'));`,
      cause: 'Deleting 300 M rows writes WAL for every row, leaves dead tuples that vacuum must clean, and replicas must replay it all. The space is reused but not returned to the OS.',
      fix: 'Convert to monthly range partitions. Retention becomes a metadata operation: detach and drop the oldest partition.',
      fixCode: `ALTER TABLE audit_log DETACH PARTITION audit_log_2025_01 CONCURRENTLY;\nDROP TABLE audit_log_2025_01;   -- instant, no dead tuples, almost no WAL` },
    { title: 'Inserts fail on the 1st of the month at 00:00',
      symptom: 'At midnight on the 1st, every insert fails with <code>no partition of relation "events" found for row</code>.',
      diagnose: `SELECT c.relname, pg_get_expr(c.relpartbound, c.oid)\nFROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid\nWHERE i.inhparent = 'events'::regclass ORDER BY 1 DESC LIMIT 3;`,
      cause: 'The cron job that creates next month’s partition had been failing silently for weeks, and there was no default partition.',
      fix: 'Create partitions several periods ahead (pg_partman <code>premake</code>), and monitor how many future partitions exist.',
      fixCode: `-- alert if fewer than 2 future partitions exist\nSELECT count(*) FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid\nWHERE i.inhparent = 'events'::regclass\n  AND c.relname > 'events_' || to_char(now(), 'YYYY_MM');` },
    { title: 'Latency doubles after moving to daily partitions',
      symptom: 'After switching from monthly to daily partitions (2,000 of them), p99 latency of simple lookups doubled under load.',
      diagnose: `SELECT wait_event_type, wait_event, count(*) FROM pg_stat_activity\nWHERE state = 'active' GROUP BY 1, 2 ORDER BY 3 DESC;\n-- LWLock | LockManager | 140`,
      cause: 'The lookup query filtered by <code>user_id</code>, not by date, so it could not prune and had to lock all 2,000 partitions and their indexes. With far more locks than fast-path slots, backends contend on the shared lock manager.',
      fix: 'Go back to fewer partitions and add the date to hot queries, or partition by a key that the hot path uses. Watch planning time in EXPLAIN as well.' }
  ],
  puzzles: [
    { kind: 'predict', q: 'How many partitions does the plan scan?', code: `EXPLAIN (COSTS OFF)\nSELECT count(*) FROM events\nWHERE created_at >= '2025-03-05' AND created_at < '2025-03-06';`, options: ['1', '2', '4', '5 (all)'], answer: 0, explain: 'The range fits entirely in March, so plan-time pruning leaves only <b>events_2025_03</b>.' },
    { kind: 'predict', q: 'And with <code>date_trunc</code> around the key?', code: `EXPLAIN (COSTS OFF)\nSELECT count(*) FROM events\nWHERE date_trunc('month', created_at) = '2025-03-01';`, options: ['1', '2', '4', '5 (all)'], answer: 3, explain: 'Pruning reasons about the bare key column. With a function around it, Postgres cannot tell which partitions to skip, so it scans <b>all 5</b>.' },
    { kind: 'bug', q: 'What happens?', code: `ALTER TABLE events ADD PRIMARY KEY (id);`, options: ['A global primary key is created', 'A primary key is created on each partition only', 'ERROR: unique constraint must include all partitioning columns', 'It succeeds, but only for future partitions'], answer: 2, explain: 'Without global indexes, uniqueness across partitions can only be enforced if the key includes <code>created_at</code>. Use <code>PRIMARY KEY (id, created_at)</code>.' },
    { kind: 'bug', q: 'A row for July landed in the default partition. Now you create July’s partition. What happens?', code: `INSERT INTO events (tenant_id, created_at, kind) VALUES (1, '2025-07-04', 'click');\nCREATE TABLE events_2025_07 PARTITION OF events\n  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');`, options: ['The row moves to events_2025_07 automatically', 'The partition is created; the row stays in the default', 'ERROR: updated partition constraint for default partition would be violated', 'The row is deleted'], answer: 2, explain: 'The default partition may no longer contain July rows once July has its own partition. Postgres checks and refuses. Fix: move the rows out of the default first (in one transaction: detach default, create July, re-insert, re-attach).' },
    { kind: 'predict', q: 'In the run-time pruning example, how many partitions show “never executed”?', code: `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF)\nSELECT count(*) FROM events\nWHERE created_at >= (SELECT timestamptz '2025-04-10');`, options: ['0', '1', '3', '4'], answer: 2, explain: 'The value is only known at run time. Then January, February and March are skipped: <b>3</b> “never executed”. April is scanned, and so is the default partition (it could hold any later date).' },
    { kind: 'concept', q: 'Why is <code>DROP TABLE</code> of a partition better than <code>DELETE</code> for retention?', options: ['DROP keeps the data in a backup', 'DROP removes the files at once: no per-row WAL, no dead tuples, no vacuum', 'DELETE cannot use indexes on partitioned tables', 'DROP is the only way to free disk space with partitions'], answer: 1, explain: 'DELETE touches every row: WAL per row, dead tuples, vacuum work and replica lag. Dropping a partition removes its files as one catalog operation.' }
  ],
  interview: [
    { q: 'When would you partition a table, and when not?', a: '<p><b>Yes</b>: very large tables with a natural key in most queries (time, tenant); retention by dropping old data; keeping hot indexes small; spreading maintenance (vacuum each partition separately). <b>No</b>: “the table is big” alone. If queries don’t filter on the key, partitioning adds planning and locking overhead and you lose global unique constraints.</p>', lvl: 'core' },
    { q: 'Range vs list vs hash: give an example of each.', a: '<ul><li><b>Range</b>: <code>created_at</code> by month; supports retention and time-window queries.</li><li><b>List</b>: <code>region IN (\'EU\')</code>, or one partition per large tenant.</li><li><b>Hash</b>: <code>user_id</code> MODULUS 16 to spread write load and keep each partition’s vacuum small; no retention benefit, and prunes only on equality.</li></ul>', lvl: 'core' },
    { q: 'Explain plan-time vs execution-time partition pruning.', a: '<p>Plan-time pruning uses constants in the WHERE clause, and pruned partitions don’t appear in the plan. Execution-time pruning (PG11+) handles values known only later: parameters of a generic plan (pruned at executor start, shown as <code>Subplans Removed: N</code>), and subquery results or nested-loop parameters (shown as <code>(never executed)</code>).</p>', fu: 'Why does this matter for JDBC? (Prepared statements may switch to a generic plan; run-time pruning keeps them efficient.)', lvl: 'deep' },
    { q: 'Why must a unique constraint include the partition key?', a: '<p>Postgres has no global indexes. Each partition’s unique index only sees its own rows. Including the key guarantees that two equal values always land in the same partition, where the local index can catch the duplicate.</p>', lvl: 'core' },
    { q: 'How do you add an index to a huge partitioned table without blocking writes?', a: '<ol><li><code>CREATE INDEX idx ON ONLY parent (…)</code>: invalid, empty parent index.</li><li>For each partition: <code>CREATE INDEX CONCURRENTLY … ON partition (…)</code>.</li><li><code>ALTER INDEX idx ATTACH PARTITION partition_idx</code> for each.</li></ol><p>Once every partition is attached, the parent index becomes valid automatically.</p>', lvl: 'deep' },
    { q: 'What does ATTACH PARTITION lock and scan?', a: '<p>Since PG12 it takes <code>SHARE UPDATE EXCLUSIVE</code> on the parent, so queries and DML on other partitions continue. It locks the new table with ACCESS EXCLUSIVE and scans it to validate the bounds, unless an existing <code>CHECK</code> constraint already proves them. If there is a default partition, it is scanned too, to make sure it holds no rows for the new range.</p>', lvl: 'deep' },
    { q: 'What happens when an UPDATE changes the partition key?', a: '<p>Since PG11 the row is moved: deleted from the old partition and inserted into the new one. A concurrent update of the same row can then fail with a serialization-style error, because the row it wanted to update moved to another partition. Avoid updating the key; model it as immutable.</p>', lvl: 'deep' },
    { q: 'What is partition-wise join or aggregate?', a: '<p>If two tables are partitioned identically and joined on the key, Postgres can join matching partition pairs separately (<code>enable_partitionwise_join</code>, off by default because it increases planning cost). Partition-wise aggregation works the same way for GROUP BY that includes the key.</p>', lvl: 'deep' },
    { q: 'How do you migrate an existing large table to partitioning?', a: '<p>Common path: create the partitioned table; attach the old table as one big “legacy” partition (add a matching CHECK constraint with NOT VALID, then VALIDATE, so ATTACH skips the scan); route new data to new partitions; move or age out the legacy data over time. Alternatively, logical replication into a new partitioned table and cut over.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'JPA entity on a partitioned table: composite key', lang: 'java', code: `@Entity @Table(name = "events") @IdClass(EventId.class)
public class Event {
  @Id @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "events_seq")
  @SequenceGenerator(name = "events_seq", sequenceName = "events_id_seq", allocationSize = 50)
  private Long id;
  @Id private OffsetDateTime createdAt;   // part of the PK because it is the partition key
  private int tenantId;
  private String kind;
}
public record EventId(Long id, OffsetDateTime createdAt) implements Serializable {}

// Always include the key so the query prunes:
@Query("select e from Event e where e.tenantId = :t and e.createdAt >= :from and e.createdAt < :to")
List<Event> window(int t, OffsetDateTime from, OffsetDateTime to);`, note: '<code>findById(id)</code> alone cannot prune: it scans every partition’s index. Design repositories around the partition key.' },
    { title: 'Scheduled partition maintenance (Spring @Scheduled)', lang: 'java', code: `@Scheduled(cron = "0 15 3 * * *")       // daily; idempotent
public void maintainPartitions() {
  YearMonth next = YearMonth.now(ZoneOffset.UTC).plusMonths(2);
  String name = "events_" + next.format(DateTimeFormatter.ofPattern("yyyy_MM"));
  jdbc.execute("CREATE TABLE IF NOT EXISTS " + name + " PARTITION OF events FOR VALUES FROM ('"
      + next.atDay(1) + "') TO ('" + next.plusMonths(1).atDay(1) + "')");
  // retention: detach + drop partitions older than 13 months (DETACH … CONCURRENTLY outside a tx)
}`, note: 'Or use pg_partman with pg_cron. Either way, alert when fewer than N future partitions exist.' }
  ]
});

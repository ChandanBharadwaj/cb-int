IA.register({
  track: 'sql',
  slug: 'postgres-in-production',
  title: 'Postgres in production',
  tagline: 'What changes when real traffic arrives: migrations that must not take locks for long, connection pools that are <b>smaller</b> than you think, replicas that lag, and a short list of views that tell you what is slow.',
  tldr: {
    problem: 'Most Postgres outages are self-inflicted: a migration that locks a hot table, a pool that opens 2,000 connections, a read from a lagging replica, or one query pattern that eats the CPU.',
    model: 'Every schema change must be safe with <b>both</b> app versions running (expand → migrate → contract) and must take strong locks only for milliseconds (lock_timeout). Connections are expensive processes: keep a few busy ones. Measure with <code>pg_stat_statements</code> before tuning anything.',
    hook: '“The migration passed in staging.” Staging had no long-running queries and no 400M-row table.',
    facts: [
      { v: 'PG11+', l: '<code>ADD COLUMN … DEFAULT</code> with a constant is metadata-only: no table rewrite' },
      { v: 'cores × 2', l: 'roughly how many <i>active</i> connections a DB server can use well. Hikari’s default pool is 10' },
      { v: 'NOT VALID', l: 'add an FK or CHECK instantly, then <code>VALIDATE</code> under a lock that doesn’t block writes' }
    ]
  },
  intro: {
    what: 'Running Postgres for a live app means changing the schema <b>while the app keeps running</b>, sharing a limited number of database connections between many app servers, sometimes reading from copies of the database (replicas), and finding which queries cost the most. This page covers the habits that keep those things from causing outages.',
    analogy: { icon: '🛠️', title: 'Renovating a shop that never closes', text: 'You can’t close the shop to move a wall. So you build the new wall first, move the shelves over a few at a time, and remove the old wall only when nobody uses it any more. And you never block the entrance for more than a moment.' },
    steps: [
      { t: 'Migrations run against live traffic', d: 'Tools like Flyway or Liquibase apply SQL files on deploy. Some statements lock the whole table while they run.' },
      { t: 'Keep locks short', d: 'Set a lock timeout so a migration gives up instead of freezing the app, and use the “concurrent” or “not valid” variants.', code: "SET lock_timeout = '3s';\nCREATE INDEX CONCURRENTLY orders_created_idx ON orders (created_at);" },
      { t: 'Use a connection pool', d: 'Opening a Postgres connection starts a new server process. Apps keep a small pool (HikariCP in Spring Boot) and reuse connections.' },
      { t: 'Measure, then fix', d: 'The <code>pg_stat_statements</code> extension records total time per query shape. Sort by it to find what to optimize first.', code: 'SELECT query, calls, total_exec_time\nFROM pg_stat_statements\nORDER BY total_exec_time DESC LIMIT 10;' }
    ],
    terms: [
      ['migration', 'A versioned script that changes the schema (V42__add_column.sql).'],
      ['rolling deploy', 'Replacing app servers one by one, so old and new versions run at the same time.'],
      ['connection pool', 'A set of open DB connections an app reuses (HikariCP).'],
      ['replica', 'A read-only copy of the database kept up to date by streaming changes (WAL).'],
      ['replication lag', 'How far behind the primary a replica is.']
    ]
  },
  visual: {
    title: 'Zero-downtime migrations during a rolling deploy',
    caption: 'Pick a change and an approach. The pods turn red when the schema and the running app version disagree, or when a lock blocks their queries. Watch the error counter.'
  },
  extras: [
    { id: 'postgres-in-production-pool', title: 'Connection math: pods × pool size', label: 'Pooling', caption: 'Autoscaling multiplies connections. See what fits, and what PgBouncer’s transaction mode breaks.' },
    { id: 'postgres-in-production-replica', title: 'Replica lag and read-your-writes', label: 'Replicas', caption: 'A user writes, then reads from a replica that is 300 ms behind. Compare three routing strategies.' }
  ],
  playground: {
    setup: `
CREATE TABLE customers (id int PRIMARY KEY, name text NOT NULL);
CREATE TABLE orders (id int PRIMARY KEY, customer_id int, total numeric, note text);
INSERT INTO customers SELECT g, 'c' || g FROM generate_series(1, 100) g;
INSERT INTO orders SELECT g, 1 + g % 100, g % 500, NULL FROM generate_series(1, 20000) g;`,
    presets: [
      { label: 'ADD COLUMN: rewrite or not?', sql: `SELECT 'before' AS step, pg_relation_filenode('orders') AS filenode;\nALTER TABLE orders ADD COLUMN region text NOT NULL DEFAULT 'eu';      -- constant: metadata only\nSELECT 'const default' AS step, pg_relation_filenode('orders');\nALTER TABLE orders ADD COLUMN token uuid NOT NULL DEFAULT gen_random_uuid();  -- volatile: rewrite\nSELECT 'volatile default' AS step, pg_relation_filenode('orders');`, note: 'A new filenode means the whole table was rewritten under ACCESS EXCLUSIVE. Constant defaults (PG11+) are stored once in <code>pg_attribute.attmissingval</code>.' },
      { label: 'NOT VALID → VALIDATE', sql: `ALTER TABLE orders ADD CONSTRAINT orders_customer_fk\n  FOREIGN KEY (customer_id) REFERENCES customers(id) NOT VALID;\nALTER TABLE orders ADD CONSTRAINT orders_total_nonneg CHECK (total >= 0) NOT VALID;\nSELECT conname, convalidated FROM pg_constraint\nWHERE conrelid = 'orders'::regclass AND contype IN ('f','c');\nALTER TABLE orders VALIDATE CONSTRAINT orders_customer_fk;\nALTER TABLE orders VALIDATE CONSTRAINT orders_total_nonneg;\nSELECT conname, convalidated FROM pg_constraint\nWHERE conrelid = 'orders'::regclass AND contype IN ('f','c');`, note: 'Step 1 is instant and enforced for new rows. Step 2 scans, but only takes SHARE UPDATE EXCLUSIVE, so writes continue. Run each step in its own transaction in production.' },
      { label: 'SET NOT NULL without a long lock', sql: `UPDATE orders SET note = '' WHERE note IS NULL;   -- backfill (batch it in prod)\nALTER TABLE orders ADD CONSTRAINT orders_note_nn CHECK (note IS NOT NULL) NOT VALID;\nALTER TABLE orders VALIDATE CONSTRAINT orders_note_nn;\nALTER TABLE orders ALTER COLUMN note SET NOT NULL;  -- PG12+: uses the valid CHECK, no scan\nALTER TABLE orders DROP CONSTRAINT orders_note_nn;\nSELECT attname, attnotnull FROM pg_attribute WHERE attrelid = 'orders'::regclass AND attname = 'note';`, note: 'SET NOT NULL normally scans the whole table under ACCESS EXCLUSIVE. With a validated CHECK it can skip the scan.' },
      { label: 'Type change = rewrite', sql: `SELECT pg_relation_filenode('orders') AS before;\nALTER TABLE orders ALTER COLUMN id TYPE bigint;\nSELECT pg_relation_filenode('orders') AS after;`, note: 'int → bigint rewrites the table and its indexes under ACCESS EXCLUSIVE. On a big table: add a new bigint column, dual-write, backfill in batches, then swap (expand/contract). Some changes are free, e.g. varchar(50) → varchar(100) or → text.' },
      { label: 'Batched backfill', sql: `-- one batch; the app or a script loops until 0 rows\nWITH batch AS (\n  SELECT id FROM orders\n  WHERE note IS NULL\n  ORDER BY id LIMIT 5000\n)\nUPDATE orders o SET note = 'migrated'\nFROM batch WHERE o.id = batch.id;\nSELECT count(*) FILTER (WHERE note IS NULL) AS remaining FROM orders;`, note: 'Short transactions: row locks are held briefly, autovacuum can keep up, replicas don’t fall behind. Sleep between batches if replication lag grows.' },
      { label: 'Timeouts, scoped', sql: `BEGIN;\nSET LOCAL lock_timeout = '3s';\nSET LOCAL statement_timeout = '5min';\nSELECT name, setting FROM pg_settings WHERE name IN ('lock_timeout','statement_timeout');\nCOMMIT;\nSELECT name, setting FROM pg_settings WHERE name IN ('lock_timeout','statement_timeout');`, note: '<code>SET LOCAL</code> ends with the transaction, so it is safe with poolers. Set defaults per role: <code>ALTER ROLE app SET statement_timeout = \'30s\'</code>.' }
    ]
  },
  gotchas: [
    { trap: 'DDL without lock_timeout', why: 'Even a 1 ms ALTER waits behind any long query for ACCESS EXCLUSIVE, and everything queues behind it. See <a href="locking.html">Locking</a>.', fix: '<code>SET lock_timeout = \'3s\'</code> at the top of every migration, plus automatic retries in the deploy pipeline.' },
    { trap: 'CREATE INDEX CONCURRENTLY inside a transaction', code: `-- Flyway wraps each migration in a transaction by default\nCREATE INDEX CONCURRENTLY ...;\n-- ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block`, why: 'CONCURRENTLY commits internally between its phases.', fix: 'Flyway: put it in its own migration with <code>executeInTransaction=false</code> (script config). Liquibase: <code>runInTransaction="false"</code>. Check <code>indisvalid</code> afterwards.' },
    { trap: 'Huge pools “for safety”', why: 'pods × pool can exceed max_connections when autoscaling, and many active backends on few cores lower throughput. Each backend also uses memory (work_mem per sort node).', fix: 'Start with a small Hikari pool (10), measure <code>hikaricp_connections_pending</code>, and put PgBouncer in front if pods × pool gets large.' },
    { trap: 'PgBouncer transaction mode + session features', why: 'Each transaction may run on a different server connection, so session state (SET, prepared statements, advisory locks, LISTEN, temp tables) leaks or vanishes.', fix: '<code>SET LOCAL</code> / <code>set_config(…, true)</code>, xact advisory locks, PgBouncer 1.21+ <code>max_prepared_statements</code> (or pgJDBC <code>prepareThreshold=0</code>).' },
    { trap: 'Read-after-write on a replica', why: 'Async replicas lag, so a user who just saved can read the old value.', fix: 'Route a user’s reads to the primary for a short window after a write, or wait for the write’s LSN on the replica. Spring: <code>@Transactional(readOnly = true)</code> + a routing DataSource is a common way to send reads to replicas.' },
    { trap: 'Replica queries cancelled “due to conflict with recovery”', why: 'VACUUM on the primary removes rows a long replica query still needs, and the replica cancels the query after <code>max_standby_streaming_delay</code> (30 s).', fix: 'Raise the delay on a reporting replica, or enable <code>hot_standby_feedback</code> (at the cost of bloat on the primary). See <a href="mvcc-vacuum.html">MVCC & VACUUM</a>.' },
    { trap: 'No statement_timeout for the app role', why: 'One runaway query (a missing WHERE in an admin tool) can run for hours, holding a connection, a snapshot and I/O.', fix: '<code>ALTER ROLE app SET statement_timeout = \'30s\'</code>; batch jobs use their own role with a larger value.' }
  ],
  scenarios: [
    { title: 'Black Friday: “FATAL: sorry, too many clients already”',
      symptom: 'The HPA scaled the checkout service from 10 to 45 pods. New pods crash-looped on startup, and existing pods slowed down.',
      diagnose: `SELECT count(*), state FROM pg_stat_activity GROUP BY state;\nSHOW max_connections;\nSELECT usename, application_name, count(*) FROM pg_stat_activity GROUP BY 1, 2 ORDER BY 3 DESC;`,
      cause: '45 pods × <code>maximumPoolSize = 20</code> = 900 connections against <code>max_connections = 500</code>. Most of them were idle, but each was a reserved backend.',
      fix: 'Smaller pools (8 per pod), PgBouncer in transaction mode in front of Postgres, and a max-replicas limit on the HPA derived from the connection budget.',
      fixCode: `spring.datasource.hikari.maximum-pool-size=8\nspring.datasource.hikari.connection-timeout=2000\n# pgbouncer.ini\npool_mode = transaction\ndefault_pool_size = 40\nmax_prepared_statements = 200` },
    { title: 'CPU at 95% with no slow query in the logs',
      symptom: '<code>log_min_duration_statement = 1s</code> logged nothing, but the DB CPU was pinned and p99 latency doubled.',
      diagnose: `SELECT queryid, calls, round(total_exec_time) AS total_ms,\n       round(mean_exec_time::numeric, 2) AS mean_ms, rows,\n       round(100 * total_exec_time / sum(total_exec_time) OVER (), 1) AS pct,\n       left(query, 80)\nFROM pg_stat_statements\nORDER BY total_exec_time DESC LIMIT 10;`,
      cause: 'A 4 ms query called 9 million times an hour: an N+1 in a new feature, loading order lines one by one. 61% of total DB time. No single execution was slow.',
      fix: 'Sort by <b>total</b> time, not mean. Fix the N+1 with a join fetch / batch fetching. Reset stats after deploys (<code>pg_stat_statements_reset()</code>) to compare.',
      fixCode: `spring.jpa.properties.hibernate.default_batch_fetch_size=100` },
    { title: 'Duplicate payments after moving reads to a replica',
      symptom: 'Support tickets: “I paid but the order still says unpaid, so I paid again.” They started the week reads were moved to a replica.',
      diagnose: `-- on the primary\nSELECT application_name, replay_lag FROM pg_stat_replication;\n-- on the replica\nSELECT now() - pg_last_xact_replay_timestamp() AS lag;`,
      cause: 'The order page read from the replica right after the payment write. Lag was normally 20 ms, but during nightly batch jobs it spiked to 8 s.',
      fix: 'Read-your-writes: after a write, route that user’s reads to the primary for 10 s. Make the payment endpoint idempotent (idempotency key + unique constraint), so a double click can’t charge twice.' }
  ],
  puzzles: [
    { kind: 'predict', q: 'Does adding a NOT NULL column with a constant default rewrite the table?', code: `CREATE TEMP TABLE f AS SELECT pg_relation_filenode('orders') AS before;\nALTER TABLE orders ADD COLUMN region text NOT NULL DEFAULT 'eu';\nSELECT before = pg_relation_filenode('orders') AS same_file FROM f;`, options: ['true: metadata-only, no rewrite', 'false: the table was rewritten', 'Error: a NOT NULL column needs a backfill first', 'NULL'], answer: 0, explain: 'Since PG11 a constant default is stored once in the catalog and returned for old rows: <b>same file, no rewrite</b>. A volatile default such as <code>gen_random_uuid()</code> or <code>clock_timestamp()</code> still rewrites.' },
    { kind: 'predict', q: 'How many constraints are still unvalidated at the end?', code: `ALTER TABLE orders ADD CONSTRAINT fk_c FOREIGN KEY (customer_id) REFERENCES customers(id) NOT VALID;\nALTER TABLE orders ADD CONSTRAINT ck_t CHECK (total >= 0) NOT VALID;\nALTER TABLE orders VALIDATE CONSTRAINT ck_t;\nSELECT conname FROM pg_constraint\nWHERE conrelid = 'orders'::regclass AND NOT convalidated;`, options: ['0', '1 (fk_c)', '1 (ck_t)', '2'], answer: 1, explain: 'Only ck_t was validated. <b>fk_c</b> is enforced for new rows but still marked NOT VALID until you validate it.' },
    { kind: 'predict', q: 'After the transaction, what is lock_timeout?', code: `BEGIN;\nSET LOCAL lock_timeout = '3s';\nCOMMIT;\nSELECT current_setting('lock_timeout') AS lt;`, options: ['3s', '0', '3000', 'Error: SET LOCAL outside a function'], answer: 1, explain: '<code>SET LOCAL</code> lasts only until the end of the transaction, so it is back to the default <b>0</b> (no timeout). That is exactly why it is safe with connection pools.' },
    { kind: 'concept', q: '30 pods, Hikari maximumPoolSize 20, Postgres max_connections 300. What happens when all pods are busy?', options: ['Hikari queues requests; all fine', '600 connections are attempted; about half the pods fail to connect', 'Postgres queues extra connections', 'PgBouncer is started automatically'], answer: 1, explain: '30 × 20 = 600 > 300. Postgres refuses connections beyond max_connections (<code>too many clients already</code>); it does not queue them.' },
    { kind: 'concept', q: 'You need to rename a column used by a service with rolling deploys. Safest plan?', options: ['RENAME COLUMN in the same deploy', 'Add new column → dual-write → backfill → read new → drop old', 'Create a view with the old name and drop the column', 'Use a SERIALIZABLE transaction'], answer: 1, explain: '<b>Expand/contract</b>: every intermediate schema works with both the old and the new app version, so mixed versions and rollbacks are safe.' },
    { kind: 'concept', q: 'pg_stat_statements: which column finds the query that costs the most overall?', options: ['mean_exec_time', 'max_exec_time', 'total_exec_time', 'rows'], answer: 2, explain: '<b>total_exec_time</b> = calls × mean. A 2 ms query called 10M times beats a 10 s report that runs once a day.' }
  ],
  interview: [
    { q: 'Walk through a zero-downtime column rename.', a: '<p>Expand: add the new column (metadata-only). Deploy code that writes both and reads the old. Backfill in batches. Deploy code that reads the new and still writes both. Then deploy code that stops writing the old, and finally drop the old column. Each schema state is compatible with the app versions on either side of it, so rolling deploys and rollbacks work. Every DDL runs with lock_timeout.</p>', lvl: 'core' },
    { q: 'Which ALTER TABLE operations rewrite the table?', a: '<p>Rewrites: changing a column type to a binary-incompatible one (int → bigint, text → int), adding a column with a <i>volatile</i> default, <code>SET … TABLESPACE</code>, VACUUM FULL and CLUSTER. Metadata-only: ADD COLUMN (nullable or with a constant default, PG11+), DROP COLUMN, widening varchar or varchar → text, RENAME. Long scans without a rewrite: ADD CONSTRAINT without NOT VALID, SET NOT NULL without a valid CHECK.</p>', lvl: 'deep' },
    { q: 'How do you size a HikariCP pool?', a: '<p>Start small. The HikariCP guidance is <code>connections ≈ (core_count × 2) + effective_spindle_count</code> for the <b>database</b>, shared by all app instances. Divide by the number of pods. Watch pending threads and connection acquire time. Set <code>connectionTimeout</code> low (2–5 s) so overload fails fast, and <code>maxLifetime</code> a bit below any network or DB idle cutoff.</p>', fu: 'Why can a bigger pool make things slower? (CPU contention, lock contention, cache thrashing on the DB.)', lvl: 'core' },
    { q: 'What breaks under PgBouncer transaction pooling?', a: '<p>Anything tied to a session: SET without LOCAL, session advisory locks, LISTEN/NOTIFY, temp tables across transactions, WITH HOLD cursors, and server-side prepared statements (unless PgBouncer 1.21+ with <code>max_prepared_statements</code>, or JDBC <code>prepareThreshold=0</code>). Long transactions still pin a server connection.</p>', lvl: 'deep' },
    { q: 'How do you safely add a foreign key to a 1 TB table?', a: '<p><code>ADD CONSTRAINT … NOT VALID</code> (brief SHARE ROW EXCLUSIVE on both tables, no scan), then <code>VALIDATE CONSTRAINT</code> in a separate transaction (SHARE UPDATE EXCLUSIVE on the referencing table, so writes continue). Index the referencing column first (CONCURRENTLY), otherwise deletes on the parent scan the child.</p>', lvl: 'core' },
    { q: 'How do you handle read-your-writes with read replicas?', a: '<p>Options: a sticky-primary window per user after a write; LSN tracking (store <code>pg_current_wal_lsn()</code> after the write, read from a replica only once <code>pg_last_wal_replay_lsn()</code> has passed it); synchronous replication with <code>synchronous_commit = remote_apply</code> (costs write latency); or simply reading critical flows from the primary.</p>', lvl: 'deep' },
    { q: 'How do you triage “the database is slow”?', a: '<p>1) <code>pg_stat_activity</code>: what runs now, what waits (wait_event), any blocking (<code>pg_blocking_pids</code>)? 2) <code>pg_stat_statements</code> by total_exec_time and by calls. 3) EXPLAIN (ANALYZE, BUFFERS) the top offenders. 4) System: CPU, I/O, connections, replication lag, autovacuum activity, checkpoints. Fix the biggest total first.</p>', lvl: 'core' },
    { q: 'statement_timeout vs lock_timeout vs idle_in_transaction_session_timeout?', a: '<p><b>statement_timeout</b>: cancels any statement that runs too long (waiting included). <b>lock_timeout</b>: cancels a statement that waits too long for a lock (for DDL). <b>idle_in_transaction_session_timeout</b>: terminates sessions idle inside an open transaction. PG17 adds <b>transaction_timeout</b> for whole transactions. Set them per role or database, and override with SET LOCAL.</p>', lvl: 'core' },
    { q: 'How do Flyway or Liquibase fit into zero-downtime deploys?', a: '<p>They apply versioned migrations at startup or in a pipeline step. For zero downtime: run migrations <i>before</i> the new app version, keep them backward compatible (expand only), and contract in a later release. Mark CONCURRENTLY migrations non-transactional. Use one migration per risky statement so retries are clean. Don’t let 40 pods race to migrate on startup: run it as a separate job.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Hikari settings that matter', lang: 'properties', code: `spring.datasource.hikari.maximum-pool-size=10
spring.datasource.hikari.minimum-idle=10              # fixed-size pool
spring.datasource.hikari.connection-timeout=3000      # fail fast under overload
spring.datasource.hikari.max-lifetime=1740000         # < any idle cutoff in between
spring.datasource.hikari.leak-detection-threshold=20000
spring.datasource.hikari.data-source-properties.ApplicationName=checkout
spring.datasource.hikari.connection-init-sql=SET statement_timeout = '30s'` },
    { title: 'Flyway: a non-transactional CONCURRENTLY migration', lang: 'sql', code: `-- V57__orders_created_idx.sql
-- V57__orders_created_idx.sql.conf contains:  executeInTransaction=false
SET lock_timeout = '3s';
CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_created_idx ON orders (created_at);`, note: 'If it fails, an INVALID index may remain; <code>IF NOT EXISTS</code> would then skip it. Check <code>pg_index.indisvalid</code> in a follow-up step.' },
    { title: 'Routing reads to a replica in Spring', lang: 'java', code: `class RoutingDataSource extends AbstractRoutingDataSource {
    @Override protected Object determineCurrentLookupKey() {
        return TransactionSynchronizationManager.isCurrentTransactionReadOnly()
            && !RecentWriteTracker.wroteRecently()          // read-your-writes window
            ? "replica" : "primary";
    }
}
// wrap it in LazyConnectionDataSourceProxy so the read-only flag is known
// before the connection is fetched` }
  ]
});

IA.register({
  track: 'sql',
  slug: 'explain',
  title: 'Reading EXPLAIN',
  tagline: 'A plan is a <b>tree of iterators</b>. Rows are pulled from the leaves up to the root. Read it bottom-up, multiply by <code>loops</code>, and look for the node where the <b>estimate and the actual row count disagree</b>. That is usually where the slow query starts.',
  tldr: {
    problem: 'A query that ran in 20 ms yesterday takes 40 s today. The SQL did not change. The <i>plan</i> did, and the only way to see it is EXPLAIN.',
    model: 'Each node is an iterator with <code>next()</code>. A parent asks its children for rows. <code>cost</code> is the planner’s guess, in abstract units. <code>actual</code> is what happened, <b>per loop</b>.',
    hook: '“rows=1 … actual rows=48,000 loops=1” under a Nested Loop. That one line explains most production plan disasters.',
    facts: [
      { v: 'per loop', l: '<code>actual time</code> and <code>rows</code> are averages per execution of the node. Multiply by <code>loops</code> for the total' },
      { v: '8 kB', l: 'one buffer = one page. <code>shared hit=1000</code> means about 8 MB was found in shared_buffers' },
      { v: '×10', l: 'a misestimate of 10× or more between <code>rows</code> and <code>actual rows</code> is the #1 smell to chase' }
    ]
  },
  intro: {
    what: 'When you send SQL, Postgres does not run it directly. The <b>planner</b> first chooses <i>how</i>: which index to use, which table to read first, how to join. That choice is the <b>plan</b>. <code>EXPLAIN</code> prints the plan. <code>EXPLAIN ANALYZE</code> also runs the query and prints what really happened.',
    analogy: { icon: '🗺️', title: 'A route planner vs. the actual drive', text: 'A navigation app picks a route from its traffic estimates and says “25 minutes”. That is <code>EXPLAIN</code>. Then you drive it and note the real time at every junction. That is <code>EXPLAIN ANALYZE</code>. When the trip is slow, you look for the road where the estimate and the reality differ most.' },
    steps: [
      { t: 'Ask for the plan', d: 'Plain EXPLAIN shows only estimates. It does not run the query.', code: 'EXPLAIN SELECT * FROM orders WHERE customer_id = 42;' },
      { t: 'Read it from the bottom (most indented) up', d: 'The most indented lines are the leaves. They read tables. Their rows flow <b>up</b> to their parent, which joins, sorts or counts them. The top line produces the final result.' },
      { t: 'Run it for real', d: 'ANALYZE executes the query and adds <code>actual time</code>, <code>rows</code> and <code>loops</code>. BUFFERS adds how many pages were read.', code: 'EXPLAIN (ANALYZE, BUFFERS)\nSELECT * FROM orders WHERE customer_id = 42;' },
      { t: 'Compare guess with reality', d: 'Look for the node where <code>rows=</code> (the guess) and <code>actual rows=</code> differ a lot, and for the node that takes most of the time. Fix that one first.' }
    ],
    terms: [
      ['plan node', 'One step in the plan, e.g. <code>Seq Scan</code>, <code>Index Scan</code>, <code>Hash Join</code>, <code>Sort</code>.'],
      ['cost', 'The planner’s estimate in abstract units (1.0 = reading one page sequentially). Not milliseconds.'],
      ['rows / width', 'Estimated number of rows a node returns, and the average row size in bytes.'],
      ['loops', 'How many times the node was executed. The inner side of a nested loop runs once per outer row.'],
      ['buffers', 'Pages (8 kB each) touched: <i>hit</i> = already in memory, <i>read</i> = fetched from the OS or disk.']
    ]
  },
  visual: {
    title: 'Watch a plan execute bottom-up',
    caption: 'Pick a plan and press Play. Dots are rows flowing up to the parent node. Each box shows the estimate (top) and the actual numbers (bottom). Turn on <b>× loops</b> to see the real totals. The final step highlights the hottest node.'
  },
  extras: [
    { id: 'explain-reader', title: 'Plan reader: find the hottest node', label: 'Interactive', caption: 'Paste an <code>EXPLAIN (ANALYZE, BUFFERS)</code> text plan, or choose a sample. The reader computes each node’s <b>self time</b> (its total time × loops minus its children’s) and its misestimate factor, then highlights the worst offenders. It is a heuristic: parallel and CTE nodes are approximate.' }
  ],
  playground: {
    setup: `
CREATE TABLE customers (id int PRIMARY KEY, name text NOT NULL, country text NOT NULL);
CREATE TABLE orders (id bigint PRIMARY KEY, customer_id int NOT NULL REFERENCES customers(id),
  status text NOT NULL, amount numeric(10,2) NOT NULL, created_at timestamptz NOT NULL);
INSERT INTO customers SELECT g, 'cust ' || g, (ARRAY['NL','DE','US','IN','BR','FR','JP','GB','ES','IT'])[1 + g % 10]
FROM generate_series(1, 5000) g;
INSERT INTO orders SELECT g, 1 + (g * 7919) % 5000, CASE WHEN g % 50 = 0 THEN 'pending' ELSE 'shipped' END,
  (g % 500) + 0.99, timestamptz '2025-01-01' + (g || ' minutes')::interval
FROM generate_series(1, 50000) g;
CREATE INDEX orders_customer_idx ON orders (customer_id);
CREATE INDEX orders_created_idx ON orders (created_at);
ANALYZE;`,
    presets: [
      { label: 'EXPLAIN only', sql: `EXPLAIN\nSELECT c.name, o.amount\nFROM orders o JOIN customers c ON c.id = o.customer_id\nWHERE o.created_at >= '2025-01-20';`, note: 'Estimates only, nothing runs. Read it bottom-up: which side is hashed?' },
      { label: 'ANALYZE + BUFFERS', sql: `EXPLAIN (ANALYZE, BUFFERS)\nSELECT c.name, o.amount\nFROM orders o JOIN customers c ON c.id = o.customer_id\nWHERE o.created_at >= '2025-01-20';`, note: 'Compare <code>rows=</code> with <code>actual rows=</code> on each node. PG18 shows rows with two decimals and adds BUFFERS automatically with ANALYZE.' },
      { label: 'loops multiply', sql: `-- latest order for each of 200 customers: inner side runs 200 times\nEXPLAIN (ANALYZE, BUFFERS)\nSELECT c.id, o.id, o.amount\nFROM customers c\nCROSS JOIN LATERAL (\n  SELECT * FROM orders o WHERE o.customer_id = c.id\n  ORDER BY o.created_at DESC LIMIT 1) o\nWHERE c.id <= 200;`, note: 'Find <code>loops=200</code>. Its <code>actual time</code> is <b>per loop</b>: multiply by 200 to see what it really cost.' },
      { label: 'misestimate', sql: `-- the planner cannot see inside lower(): default selectivity 0.5%\nEXPLAIN ANALYZE\nSELECT count(*) FROM orders WHERE lower(status) = 'shipped';`, note: 'It estimates 250 rows, but 49,000 match. With a join on top, a guess like that can turn a hash join into a nested loop.' },
      { label: 'sort spills', sql: `SET work_mem = '64kB';\nEXPLAIN (ANALYZE, BUFFERS)\nSELECT * FROM orders ORDER BY amount DESC;\nRESET work_mem;`, note: 'Look for <code>Sort Method: external merge  Disk: …kB</code> and <code>temp read/written</code> buffers. Then raise work_mem and run it again.' },
      { label: 'generic plan', sql: `-- PG16+: plan a parameterized query without values\nEXPLAIN (GENERIC_PLAN)\nSELECT * FROM orders WHERE customer_id = $1;`, note: 'This is the shape a prepared statement may switch to after 5 executions. See <a href="statistics.html">Statistics</a> for plan_cache_mode.' }
    ]
  },
  gotchas: [
    { trap: 'Forgetting that time and rows are per loop', code: `->  Index Scan using customers_pkey on customers\n      (actual time=0.004..0.004 rows=1 loops=120000)`, why: '0.004 ms looks harmless. But the node ran 120,000 times: about 480 ms in total, which may be most of the query.', fix: 'Always compute <code>time × loops</code>. Tools like explain.depesz.com or the reader widget below do it for you.' },
    { trap: 'EXPLAIN ANALYZE really executes the statement', code: `EXPLAIN ANALYZE DELETE FROM orders WHERE created_at < now() - interval '1 year';\n-- the rows are gone`, why: 'ANALYZE runs the query. For DML it modifies data and fires triggers.', fix: 'Wrap it: <code>BEGIN; EXPLAIN ANALYZE …; ROLLBACK;</code>. Remember that it still takes locks and writes WAL.' },
    { trap: 'Reading cost as milliseconds', why: 'Cost is in abstract units: <code>seq_page_cost = 1</code>, <code>random_page_cost = 4</code>, <code>cpu_tuple_cost = 0.01</code>. It is only useful for comparing plans of the same query.', fix: 'Use <code>actual time</code> for time. Use cost only to see why the planner preferred one plan over another.' },
    { trap: 'Warm-cache benchmarks', why: 'The second run reads everything from shared_buffers (<code>shared hit</code>), so it is much faster than the cold first run in production (<code>read</code>).', fix: 'Always add BUFFERS. A large <code>read=</code> count means I/O, and its cost depends on the cache state. Set <code>track_io_timing = on</code> to see I/O time.' },
    { trap: 'Trusting EXPLAIN on a laptop-size dataset', why: 'With 1,000 rows the planner correctly chooses Seq Scans everywhere. With 50 M rows in production, it chooses a completely different plan.', fix: 'Test plans against production-like volumes and statistics, or capture the real plan in production with <code>auto_explain</code>.' },
    { trap: 'Timing overhead distorts tiny nodes', why: 'With ANALYZE, every row through every node reads the clock. On some systems that adds a lot of overhead to nodes that process millions of rows.', fix: '<code>EXPLAIN (ANALYZE, TIMING OFF)</code> still gives exact row counts and loops. Use it when you only need the estimate-vs-actual comparison.' },
    { trap: 'Ignoring “Rows Removed by Filter”', code: `Seq Scan on orders (actual rows=12 loops=1)\n  Filter: (status = 'pending' AND country = 'NL')\n  Rows Removed by Filter: 4999988`, why: 'The node returned 12 rows but read 5 million. The work is in the rows that were thrown away.', fix: 'A large “removed” count compared with the rows returned is a sign that you need an index (often a partial or composite one).' }
  ],
  scenarios: [
    { title: 'Nightly report: 20 s became 40 min after the bulk load',
      symptom: 'An ETL job loads 2 M rows into <code>staging_events</code> and immediately runs a report join. Since the volume grew, the report takes 40 minutes.',
      diagnose: `EXPLAIN (ANALYZE, BUFFERS) SELECT …;\n--  Nested Loop (rows=1) (actual rows=2000000)\n--    -> Seq Scan on staging_events (rows=1) (actual rows=2000000)\n--    -> Index Scan on accounts (loops=2000000)\nSELECT last_analyze, last_autoanalyze, n_mod_since_analyze\nFROM pg_stat_user_tables WHERE relname = 'staging_events';`,
      cause: 'The table was truncated and refilled. Autovacuum had not analyzed it yet, so the planner still believed it was nearly empty and chose a nested loop with 2 M inner index probes.',
      fix: 'Run <code>ANALYZE</code> as an explicit ETL step after every bulk load, before the queries that read the data.',
      fixCode: `COPY staging_events FROM …;\nANALYZE staging_events;   -- seconds, and the report gets a hash join` },
    { title: 'p99 latency spikes, but EXPLAIN in staging looks fine',
      symptom: 'A Spring endpoint is fast in staging and in psql, but slow for a few minutes every hour in production.',
      diagnose: `-- postgresql.conf (or ALTER SYSTEM)\nshared_preload_libraries = 'auto_explain,pg_stat_statements'\nauto_explain.log_min_duration = '500ms'\nauto_explain.log_analyze = on\nauto_explain.log_buffers = on\nauto_explain.log_timing = off   -- lower overhead`,
      cause: 'auto_explain caught the slow executions: same plan, but <code>shared read=180000</code> instead of hits. An hourly batch job was evicting the hot pages from the cache, so the endpoint had to read from disk.',
      fix: 'Move the batch to a replica, or reduce what it reads. Add a covering index so the endpoint touches far fewer pages. Use <code>pg_stat_statements</code> (sort by <code>shared_blks_read</code>) to find the evicting query.',
      fixCode: `SELECT queryid, calls, mean_exec_time, shared_blks_hit, shared_blks_read, left(query, 60)\nFROM pg_stat_statements ORDER BY shared_blks_read DESC LIMIT 10;` },
    { title: 'Slow after the 6th call: the generic plan trap',
      symptom: 'The same JDBC query is fast the first 5 times after a deploy, then becomes 100× slower for some tenants.',
      diagnose: `PREPARE q(int) AS SELECT * FROM orders WHERE tenant_id = $1 AND status = 'open';\nEXPLAIN (ANALYZE) EXECUTE q(7);   -- run 6+ times and watch the plan change\nEXPLAIN (GENERIC_PLAN) SELECT * FROM orders WHERE tenant_id = $1;  -- PG16+`,
      cause: 'pgJDBC uses server-side prepared statements after <code>prepareThreshold</code> (5) executions. After that, Postgres may switch to a <b>generic plan</b> built for an “average” tenant. For a huge tenant that plan is badly wrong.',
      fix: 'Set <code>plan_cache_mode = force_custom_plan</code> for that role or query. Or improve statistics so the generic plan is reasonable.',
      fixCode: `ALTER ROLE app_user SET plan_cache_mode = force_custom_plan;` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Which scan node does this plan use?', code: `EXPLAIN SELECT * FROM orders WHERE id = 7;`, options: ['Seq Scan on orders', 'Index Scan using orders_pkey', 'Bitmap Heap Scan on orders', 'Index Only Scan using orders_pkey'], answer: 1, explain: 'An equality lookup on the primary key returns at most one row, so the planner chooses a plain <b>Index Scan</b>. An Index Only Scan isn’t possible, because <code>SELECT *</code> needs columns that are not in the index.' },
    { kind: 'predict', q: 'What row estimate does the planner give for <code>lower(status) = \'shipped\'</code> on 50,000 rows (actual: 49,000)?', code: `EXPLAIN SELECT * FROM orders WHERE lower(status) = 'shipped';`, options: ['rows=49000', 'rows=25000', 'rows=250', 'rows=1'], answer: 2, explain: 'There are no statistics on the expression <code>lower(status)</code>, so Postgres uses the default equality selectivity of 0.5%: 50,000 × 0.005 = <b>250</b>. An expression index (and ANALYZE) gives it real statistics.' },
    { kind: 'concept', q: 'A node shows <code>actual time=0.020..0.050 rows=3 loops=10000</code>. Roughly how many rows did it produce, and how much time did it take in total?', options: ['3 rows, 0.05 ms', '30,000 rows, about 500 ms', '30,000 rows, 0.05 ms', '3 rows, about 500 ms'], answer: 1, explain: 'Both values are per loop. 3 × 10,000 = <b>30,000 rows</b>, and 0.050 ms × 10,000 = <b>about 500 ms</b>.' },
    { kind: 'concept', q: '<code>Buffers: shared hit=12 read=48000</code>. What does it tell you?', options: ['The query wrote 48,000 pages', '48,000 pages (about 375 MB) were not in shared_buffers and had to come from the OS cache or disk', '48,000 rows were read', 'The query used 48,000 temp files'], answer: 1, explain: '<b>read</b> counts 8 kB pages that were not in shared_buffers. They may still come from the OS page cache, so turn on <code>track_io_timing</code> to see whether real disk time was involved.' },
    { kind: 'predict', q: 'How many times does the inner node of this LATERAL query execute (the value of loops)?', code: `EXPLAIN (ANALYZE, TIMING OFF)\nSELECT c.id, o.id FROM customers c\nCROSS JOIN LATERAL (SELECT id FROM orders o WHERE o.customer_id = c.id\n  ORDER BY created_at DESC LIMIT 1) o\nWHERE c.id <= 200;`, options: ['1', '10', '200', '50000'], answer: 2, explain: 'The LATERAL subquery runs once per outer row. 200 customers qualify, so the inner Limit and its index scan show <b>loops=200</b>.' },
    { kind: 'concept', q: 'Which tool would you use to find the query that consumes the most total database time across the whole day?', options: ['EXPLAIN ANALYZE', 'auto_explain', 'pg_stat_statements, sorted by total_exec_time', 'pg_stats'], answer: 2, explain: '<b>pg_stat_statements</b> aggregates every normalized query: <code>calls</code>, <code>total_exec_time</code>, <code>mean_exec_time</code> and buffer counts. auto_explain shows <i>plans</i> of individual slow executions. Use both together.' }
  ],
  interview: [
    { q: 'Walk me through how you read an EXPLAIN ANALYZE plan.', a: '<p>Start at the most-indented leaves and move up. For each node, compare the estimated <code>rows</code> with <code>actual rows</code>, and multiply actual time and rows by <code>loops</code>. Find the node with the largest <b>self time</b> (its time minus its children’s) and the first node, from the bottom, with a large misestimate. A misestimate low in the tree propagates upwards and usually causes a bad join method or join order higher up.</p>', fu: 'Why the first misestimate from the bottom? (Everything above it was planned using the wrong numbers.)', lvl: 'core' },
    { q: 'What do the two numbers in cost=0.29..8.31 mean?', a: '<p><b>Startup cost</b>: the cost before the first row can be returned. <b>Total cost</b>: the cost to return all rows. A Sort or Hash has a high startup cost because it must consume its whole input first. That matters with LIMIT: the planner may prefer a plan with low startup cost, such as an index scan that is already in order.</p>', lvl: 'core' },
    { q: 'Why can a LIMIT 10 query be slower than the same query without LIMIT?', a: '<p>With LIMIT the planner prefers plans with low startup cost. It assumes matching rows are spread evenly, e.g. it walks an index on <code>created_at</code> and filters as it goes. If the matching rows are actually all at the far end of the index, it scans most of the table to find 10. The estimate in the plan looks cheap, but the actual rows removed by the filter are huge.</p>', fu: 'Fixes? (A composite index on (filter_col, sort_col), better statistics, or ORDER BY on an expression that prevents the index path.)', lvl: 'deep' },
    { q: 'What do shared hit, read, dirtied and written mean in BUFFERS?', a: '<p><b>hit</b>: the page was already in shared_buffers. <b>read</b>: it had to be requested from the OS (page cache or disk). <b>dirtied</b>: this query modified pages that were clean (it includes setting hint bits on read!). <b>written</b>: this backend had to write dirty pages out itself to free buffers, a sign that the bgwriter cannot keep up. <b>temp</b> counts spills from sorts and hashes.</p>', lvl: 'deep' },
    { q: 'An estimate is 1 row; the actual is 2 million. List the likely causes.', a: '<ul><li>Stale statistics: a bulk load or truncate since the last ANALYZE.</li><li>Correlated predicates: the planner multiplies selectivities as if they were independent (fix: <code>CREATE STATISTICS</code>).</li><li>A function or expression on a column: default selectivity is used (fix: an expression index).</li><li>A value outside the histogram, e.g. the newest timestamps.</li><li>Parameters in a generic plan.</li><li>Joins: estimates are multiplied through several levels of the tree.</li></ul>', lvl: 'core' },
    { q: 'How do you capture plans of slow queries in production without running them yourself?', a: '<p><code>auto_explain</code>: set <code>log_min_duration</code>, and optionally <code>log_analyze</code>, <code>log_buffers</code> and <code>log_nested_statements</code> (for functions). Keep <code>log_timing = off</code>, or use <code>sample_rate</code>, to limit overhead. Combine it with <code>pg_stat_statements</code>, which tells you <i>which</i> queries matter in total.</p>', fu: 'Overhead of log_analyze? (Instrumentation runs for every query, not only the logged ones, because it is not known in advance which will be slow.)', lvl: 'core' },
    { q: 'What are Index Only Scan “Heap Fetches”?', a: '<p>An index-only scan can skip the heap only for pages that the <b>visibility map</b> marks all-visible. For other pages it must check the heap. Many heap fetches mean vacuum is not keeping the visibility map up to date, so the “index only” scan is really an index scan.</p>', lvl: 'deep' },
    { q: 'How are parallel query nodes reported?', a: '<p>Under a Gather node, workers and the leader each run a copy of the plan below. <code>loops</code> counts the processes, and actual rows and time are <b>averages per process</b>. Add <code>VERBOSE</code> to see per-worker numbers. “Workers Planned” vs “Workers Launched” shows whether <code>max_parallel_workers</code> ran out.</p>', lvl: 'deep' },
    { q: 'What does pg_stat_statements store, and what are its pitfalls?', a: '<p>Per normalized query (constants replaced by <code>$n</code>): calls, total and mean execution and planning time, rows, and buffer and WAL counts. Pitfalls: it stores averages, not plans; queries with IN lists of different lengths may be separate entries (fixed in PG18 by squashing lists); <code>pg_stat_statements.max</code> evicts entries; and the statistics are cumulative until you call <code>pg_stat_statements_reset()</code>.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Assert a plan in an integration test (Testcontainers + JdbcTemplate)', lang: 'java', code: `@Test
void customerLookupUsesIndex() {
  String plan = String.join("\\n", jdbc.queryForList(
      "EXPLAIN (FORMAT TEXT) SELECT * FROM orders WHERE customer_id = ?", String.class, 42));
  assertThat(plan).contains("Index Scan").doesNotContain("Seq Scan on orders");
}`, note: 'This only works if the test database has realistic data volume and statistics. Run <code>ANALYZE</code> after seeding it.' },
    { title: 'Log slow SQL from Spring Boot and correlate it with auto_explain', lang: 'yaml', code: `spring:
  datasource:
    hikari:
      # tag connections so auto_explain / pg_stat_activity show the service
      data-source-properties:
        ApplicationName: order-service
logging.level:
  org.hibernate.SQL: debug                  # SQL text
  org.hibernate.orm.jdbc.bind: trace         # parameter values (Hibernate 6)
# postgresql.conf: auto_explain.log_min_duration = '500ms'
# log_line_prefix = '%m [%p] app=%a '       # %a prints ApplicationName`, note: 'With <code>ApplicationName</code> in log_line_prefix, you can tell which service sent the slow plan.' }
  ]
});

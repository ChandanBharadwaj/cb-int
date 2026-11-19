IA.register({
  track: 'sql',
  slug: 'index-not-used',
  title: 'Why is my index ignored?',
  tagline: 'The planner uses an index only if it <b>can</b> (the predicate matches the indexed expression, operator class and collation) and if it <b>wants to</b> (its row estimate says the index is cheaper than a seq scan). Every “ignored index” is one of those two failing.',
  tldr: {
    problem: 'An index exists, EXPLAIN says Seq Scan, and the query takes seconds. Or worse: it was fast yesterday and nothing in the code changed.',
    model: 'Two gates. <b>Matchability</b>: <code>indexed_expr operator constant</code> with the column untouched, an operator in the index’s opclass, and the same collation. <b>Cost</b>: estimated rows × random_page_cost vs. sequential pages. Stale stats, skew and generic plans corrupt the estimate.',
    hook: '“The column is a bigint and we pass a Long, so why the seq scan?” Hibernate bound a BigDecimal: <code>(id)::numeric = $1</code>, and a cast on the column kills the index.',
    facts: [
      { v: '~5–10%', l: 'rough selectivity above which a seq scan tends to beat index scans. It depends on correlation, row width, cache and page-cost settings' },
      { v: '5', l: 'executions of a prepared statement before Postgres considers a generic plan. pgJDBC’s default prepare threshold is also 5' },
      { v: 'can vs want', l: 'turning seq scans off in a session is a diagnostic, not a fix: if the index still isn’t used, it <i>can’t</i> be' }
    ]
  },
  intro: {
    what: 'Postgres doesn’t use an index just because one exists. The <b>planner</b> first checks whether the index can answer the condition at all, then estimates whether using it is actually faster than reading the whole table. You read its decision with <code>EXPLAIN</code>.',
    analogy: { icon: '🗺️', title: 'A book index vs reading the book', text: 'To find every page mentioning “the”, you’d just read the book: the index would send you to nearly every page anyway. And if the index lists words but you’re looking for “words ending in -ing”, the alphabetical index can’t help at all.' },
    steps: [
      { t: 'Ask Postgres what it will do', d: 'EXPLAIN shows the plan; ANALYZE runs it and shows real row counts.', code: 'EXPLAIN ANALYZE\nSELECT * FROM users\nWHERE email = \'a@x.io\';' },
      { t: 'Leave the column bare', d: 'Wrapping the column in a function or cast hides it from the index.', code: '-- no:  WHERE lower(email) = …\n-- yes: an index ON (lower(email))' },
      { t: 'Compare estimate vs actual', d: 'In EXPLAIN ANALYZE, <code>rows=</code> (estimate) far from <code>actual rows=</code> means the statistics are wrong.' },
      { t: 'Refresh statistics', d: 'Autovacuum does it automatically; after a bulk load do it yourself.', code: 'ANALYZE users;' }
    ],
    terms: [
      ['planner', 'The part of Postgres that picks how to run a query, based on estimated cost.'],
      ['selectivity', 'The fraction of rows a condition keeps. Low fraction = selective = index-friendly.'],
      ['statistics', 'Per-column samples (most common values, histogram, n_distinct) gathered by ANALYZE.'],
      ['sargable', 'A predicate written so an index can be used: bare column, compatible operator, constant on the other side.'],
      ['generic plan', 'A plan for a prepared statement built without knowing parameter values, reused for all of them.']
    ]
  },
  visual: {
    title: 'The “why is my index ignored?” checker',
    caption: 'Pick a symptom, then press Play to watch the planner’s two gates. Flip to “fixed” to see what changes. Each case has a matching playground preset you can run for real.'
  },
  playground: {
    setup: `
CREATE TABLE users (id bigint PRIMARY KEY, email text NOT NULL, country text NOT NULL,
                    phone text, status text NOT NULL, created_at timestamptz NOT NULL);
INSERT INTO users
SELECT g, 'user' || g || CASE WHEN g % 3 = 0 THEN '@gmail.com' ELSE '@corp.io' END,
       (ARRAY['US','DE','IN'])[1 + g % 3], '+1555' || lpad(g::text, 7, '0'),
       CASE WHEN g % 500 = 0 THEN 'pending' ELSE 'active' END,
       timestamptz '2025-01-01' + g * interval '10 minutes'
FROM generate_series(1, 50000) g;
CREATE INDEX u_email   ON users (email);
CREATE INDEX u_phone   ON users (phone);
CREATE INDEX u_created ON users (created_at);
CREATE INDEX u_status  ON users (status);
CREATE INDEX u_pending ON users (created_at) WHERE status = 'pending';
CREATE TABLE tiny (id int PRIMARY KEY, name text);
INSERT INTO tiny SELECT g, 'n' || g FROM generate_series(1, 10) g;
ANALYZE users; ANALYZE tiny;`,
    presets: [
      { label: 'Function / cast on column', sql: `EXPLAIN (COSTS OFF) SELECT * FROM users WHERE created_at::date = '2025-03-01';
EXPLAIN (COSTS OFF) SELECT * FROM users
WHERE created_at >= '2025-03-01' AND created_at < '2025-03-02';`, note: 'Rewrite the cast as a half-open range on the bare column. (Also note <code>::date</code> of a timestamptz depends on the session TimeZone.)' },
      { label: 'Type mismatch', sql: `EXPLAIN (COSTS OFF) SELECT * FROM users WHERE id = 42.0;     -- numeric literal
EXPLAIN (COSTS OFF) SELECT * FROM users WHERE id = 42;       -- integer: fine`, note: '<code>(id)::numeric = 42.0</code>: Postgres casts the <b>column</b> to numeric, because there is no bigint = numeric operator in the index’s family. From Java this happens when a BigDecimal is bound.' },
      { label: 'Leading wildcard', sql: `EXPLAIN (COSTS OFF) SELECT * FROM users WHERE email LIKE '%@gmail.com';
EXPLAIN (COSTS OFF) SELECT * FROM users WHERE email LIKE 'user42@%';
DROP INDEX IF EXISTS u_rev;
CREATE INDEX u_rev ON users (reverse(email) text_pattern_ops);
EXPLAIN (COSTS OFF) SELECT * FROM users WHERE reverse(email) LIKE reverse('%@gmail.com');`, note: 'A left-anchored pattern becomes an index range (<code>&gt;= \'user42@\' AND &lt; \'user42A\'</code>). This DB uses the C collation, so a plain B-tree supports it; with en_US.UTF-8 you need <code>text_pattern_ops</code>. For <code>%x%</code> use pg_trgm.' },
      { label: 'Low selectivity / small table', sql: `EXPLAIN (COSTS OFF) SELECT * FROM users WHERE status = 'active';    -- 99.8% of rows
EXPLAIN (COSTS OFF) SELECT * FROM users WHERE status = 'pending';   -- 0.2%
EXPLAIN (COSTS OFF) SELECT * FROM tiny WHERE id = 3;                -- 1 page`, note: 'Same index, opposite choices. A seq scan of a 1-page table is one read: the index would be at least two.' },
      { label: 'OR conditions', sql: `EXPLAIN (COSTS OFF) SELECT * FROM users
WHERE email = 'user42@corp.io' OR phone = '+15550000042';
EXPLAIN (COSTS OFF) SELECT * FROM users
WHERE email = 'user42@corp.io' OR lower(country) = 'de';`, note: 'Each OR branch needs its own usable index (BitmapOr). One unindexable branch makes the whole condition a seq-scan filter. Fix that branch or split into UNION ALL.' },
      { label: 'Stale stats', sql: `DROP TABLE IF EXISTS ev;
CREATE TABLE ev (id int, status text);
CREATE INDEX ON ev (status);
ANALYZE ev;                        -- stats taken while empty
INSERT INTO ev SELECT g, CASE WHEN g % 1000 = 0 THEN 'pending' ELSE 'done' END
FROM generate_series(1, 100000) g;
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF) SELECT * FROM ev WHERE status = 'done';`, note: 'The planner has no idea 99.9% of rows are “done” and picks a bitmap index scan. Run <code>ANALYZE ev;</code> on its own, then this EXPLAIN again: it switches to a seq scan. (PGlite has no autovacuum, so stats stay stale until you do.)' },
      { label: 'Generic plan + partial index', sql: `DEALLOCATE ALL;
PREPARE q(text) AS SELECT id FROM users WHERE status = $1 AND created_at > '2025-06-01';
SET plan_cache_mode = force_custom_plan;
EXPLAIN (COSTS OFF) EXECUTE q('pending');
SET plan_cache_mode = force_generic_plan;
EXPLAIN (COSTS OFF) EXECUTE q('pending');
RESET plan_cache_mode;`, note: 'Custom plan: the planner sees <code>\'pending\'</code> and uses the partial index <code>u_pending</code>. Generic plan: <code>$1</code> might be anything, so the partial index can’t be proven applicable; it falls back to <code>u_status</code>.' }
    ]
  },
  gotchas: [
    { trap: 'Function or cast on the indexed column', code: `WHERE date(created_at) = '2025-03-01'\nWHERE lower(email) = $1\nWHERE id::text = $1`, why: 'The index stores <code>created_at</code>, not <code>date(created_at)</code>. The planner only matches an index on the exact expression.', fix: 'Move the work to the constant side (ranges), or create an expression index on exactly that expression.' },
    { trap: 'Parameter type differs from the column', why: 'Comparing bigint to numeric, or a text column to a value bound as another type, makes Postgres cast the column side.', fix: 'Bind the right Java type (Long, not BigDecimal). Watch for <code>(col)::numeric</code> or <code>(col)::text</code> in EXPLAIN filters.' },
    { trap: 'LIKE prefix under a non-C collation', code: `CREATE INDEX ON users (email);           -- en_US.UTF-8\nWHERE email LIKE 'user42@%'               -- can't use it`, why: 'Linguistic collations don’t sort byte-wise, so a prefix isn’t a contiguous range.', fix: 'Add <code>CREATE INDEX ON users (email text_pattern_ops)</code> (or <code>COLLATE "C"</code>). Keep the normal one if you also need <code>&lt;</code> / ORDER BY in the locale order.' },
    { trap: 'Low selectivity', why: 'Fetching 30% of rows through an index means random heap reads for most pages: slower than one sequential pass.', fix: 'That’s correct behaviour. If you only need a few columns, a covering index for an index-only scan can still win; otherwise accept the seq scan or narrow the query.' },
    { trap: 'Stale or missing statistics', why: 'After bulk loads, big deletes or on new partitions, the planner works from old numbers. Correlated columns (city, zip) are estimated as independent.', fix: '<code>ANALYZE</code> after bulk changes; raise <code>default_statistics_target</code> or per-column <code>SET STATISTICS</code>; <code>CREATE STATISTICS</code> (PG10+) for correlated columns.' },
    { trap: 'Generic plans for skewed data', why: 'After 5 executions, a prepared statement may switch to a generic plan if its estimated cost isn’t worse than the average custom plan. It can’t use partial indexes keyed on the parameter and it ignores per-value skew.', fix: '<code>plan_cache_mode = force_custom_plan</code> (PG12+) for that role or statement, or inline the constant if it is truly constant.' },
    { trap: 'Planner cost settings tuned for spinning disks', why: 'Default <code>random_page_cost = 4</code> assumes random I/O is 4× sequential. On SSD/NVMe and a warm cache it’s closer to 1.1–1.5, so the planner undervalues index scans.', fix: 'Set <code>random_page_cost</code> (and <code>effective_cache_size</code>) to match your hardware. Test on a replica first.' }
  ],
  scenarios: [
    { title: 'Order lookup went from 1 ms to 4 s after a “harmless” DTO refactor',
      symptom: 'p99 of <code>GET /orders/{id}</code> jumped. The code now passes the id as <code>BigDecimal</code> (from a JSON number mapper).',
      diagnose: `-- auto_explain or pg_stat_statements shows:\nSeq Scan on orders  Filter: ((id)::numeric = $1)`,
      cause: 'pgJDBC binds BigDecimal as numeric. bigint = numeric has no index-compatible operator, so Postgres casts the column, and every row is scanned.',
      fix: 'Bind <code>Long</code>. Add a test that asserts the plan (or the parameter type) for hot queries.',
      fixCode: `-- what you want to see\nIndex Scan using orders_pkey on orders  Index Cond: (id = $1)` },
    { title: 'Queue worker latency spikes after the 6th poll',
      symptom: 'The first five polls take 0.3 ms; from the sixth on, each takes 900 ms. Restarting the worker “fixes” it.',
      diagnose: `SELECT generic_plans, custom_plans FROM pg_prepared_statements;   -- in that session\n-- EXPLAIN EXECUTE shows: Index Cond: created_at > …  Filter: (status = $1)`,
      cause: 'pgJDBC switches to a server-side prepared statement after <code>prepareThreshold</code> (5) executions; Postgres then chose a generic plan, which can’t use the partial index <code>WHERE status = \'pending\'</code>.',
      fix: 'Put the literal in the SQL (the status is constant for this query), or set <code>plan_cache_mode = force_custom_plan</code> for the worker role.',
      fixCode: `ALTER ROLE queue_worker SET plan_cache_mode = force_custom_plan;\n-- or: WHERE status = 'pending' (literal) AND run_at <= now()` },
    { title: 'Nightly report flips to a 40-minute nested loop',
      symptom: 'After a large import, a report that ran in 2 minutes picks a nested loop with an index scan on the inner side and runs for 40 minutes.',
      diagnose: `EXPLAIN (ANALYZE) …\n-- Index Scan on events (rows=12) (actual rows=1840000 loops=310)\nSELECT last_analyze, last_autoanalyze, n_mod_since_analyze FROM pg_stat_user_tables WHERE relname = 'events';`,
      cause: 'The import added 8M rows; autoanalyze hadn’t run yet, so the planner estimated 12 rows instead of 1.8M per loop.',
      fix: 'Run <code>ANALYZE</code> as the last step of every bulk load; lower <code>autovacuum_analyze_scale_factor</code> for that table.' },
    { title: 'Login by email does a seq scan on 30M users',
      symptom: 'Login query <code>WHERE lower(email) = lower(?)</code> is slow; there is a unique index on <code>email</code>.',
      diagnose: `EXPLAIN SELECT id FROM users WHERE lower(email) = lower('A@x.io');\n-- Seq Scan  Filter: (lower(email) = 'a@x.io')`,
      cause: 'The index is on <code>email</code>, the query filters on <code>lower(email)</code>.',
      fix: 'Expression index (unique, so case variants can’t both register); or store emails normalized; or a citext column.',
      fixCode: `CREATE UNIQUE INDEX CONCURRENTLY users_email_lower_uq\n  ON users (lower(email));` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Which plan?', code: `EXPLAIN (COSTS OFF) SELECT * FROM users WHERE id = 42.0;`, options: ['Index Scan using users_pkey', 'Seq Scan with (id)::numeric = 42.0', 'Bitmap Index Scan', 'Error: type mismatch'], answer: 1, explain: '42.0 is numeric. Postgres promotes the bigint column to numeric, and the index on <code>id</code> can’t be used.' },
    { kind: 'predict', q: 'status = \'active\' matches 99.8% of rows, and there is an index on status. Plan?', code: `EXPLAIN (COSTS OFF) SELECT * FROM users WHERE status = 'active';`, options: ['Index Scan using u_status', 'Bitmap Heap Scan', 'Seq Scan', 'Index Only Scan'], answer: 2, explain: 'Reading nearly every row through an index costs more than one sequential pass. The planner is right.' },
    { kind: 'predict', q: 'Two indexed columns joined with OR. Plan?', code: `EXPLAIN (COSTS OFF) SELECT * FROM users\nWHERE email = 'user42@corp.io' OR phone = '+15550000042';`, options: ['Seq Scan', 'BitmapOr of two Bitmap Index Scans', 'Index Scan using u_email only', 'Error'], answer: 1, explain: 'Each branch is indexable, so Postgres ORs two bitmaps. Make one branch unindexable (e.g. <code>lower(country) = …</code>) and it falls back to a seq scan.' },
    { kind: 'predict', q: 'With a generic plan, which index does this use?', code: `PREPARE q(text) AS SELECT id FROM users WHERE status = $1 AND created_at > '2025-06-01';\nSET plan_cache_mode = force_generic_plan;\nEXPLAIN (COSTS OFF) EXECUTE q('pending');`, options: ['u_pending (partial)', 'u_status, then Filter on created_at', 'u_created only', 'Seq Scan'], answer: 1, explain: 'The partial index requires proving <code>status = \'pending\'</code>; <code>$1</code> can’t be proven. It falls back to <code>u_status</code> (Index Cond <code>status = $1</code>) and filters on created_at. With a custom plan it uses the tiny <code>u_pending</code>.' },
    { kind: 'predict', q: 'A 10-row table with a primary key. Plan for id = 3?', code: `EXPLAIN (COSTS OFF) SELECT * FROM tiny WHERE id = 3;`, options: ['Index Scan using tiny_pkey', 'Seq Scan', 'Bitmap Heap Scan', 'Index Only Scan'], answer: 1, explain: 'The whole table is one page. One page read beats an index descent plus a heap read.' },
    { kind: 'concept', q: 'You run <code>SET enable_seqscan = off</code> and EXPLAIN still shows a Seq Scan. What does that tell you?', options: ['Stats are stale', 'The index can’t be used for this predicate at all', 'The table is too small', 'random_page_cost is too high'], answer: 1, explain: 'With seq scans heavily penalized, the planner picks any usable index. If it still doesn’t, the predicate isn’t matchable (cast, function, operator, collation, wildcard).' }
  ],
  interview: [
    { q: 'An index exists but EXPLAIN shows a Seq Scan. Walk me through your diagnosis.', a: '<p>1) Is it <b>matchable</b>? Look at the Filter line: casts or functions on the column, operator outside the opclass (e.g. <code>-&gt;&gt;</code> for GIN), LIKE with a leading wildcard or a non-C collation, OR with an unindexable branch, partial-index predicate not implied, leading column not constrained. <code>SET enable_seqscan = off</code> separates “can’t” from “won’t”. 2) If it can: compare estimated vs actual rows with EXPLAIN (ANALYZE, BUFFERS); stale stats, correlation, skew, generic plans. 3) Check cost settings (random_page_cost, effective_cache_size) and table size.</p>', lvl: 'core' },
    { q: 'Why does a cast on the column prevent index use, but a cast on the constant doesn’t?', a: '<p>An index stores values of the column’s type sorted by its opclass. <code>col::numeric</code> is a different expression; there is no index on it. A cast of the constant is evaluated once at plan time, leaving <code>col op const</code>. Cross-type operators within the same operator family (int4 vs int8, date vs timestamp) work without a cast; bigint vs numeric doesn’t.</p>', lvl: 'deep' },
    { q: 'When is a seq scan the right choice even with a good index?', a: '<p>When a large fraction of rows qualifies, when the table is tiny, or when the query needs most pages anyway. Sequential I/O and no index overhead win. A bitmap heap scan is the middle ground for moderate selectivity: it reads matching pages in physical order.</p>', lvl: 'core' },
    { q: 'Explain custom vs generic plans and how they bite in Java apps.', a: '<p>For prepared statements Postgres plans the first 5 executions with the actual values (custom plans). After that it may cache a generic plan if its estimated cost isn’t higher than the average custom cost. Generic plans can’t use per-value statistics or partial indexes tied to the parameter. pgJDBC uses server-side prepares after <code>prepareThreshold</code> (default 5) uses, so “slow after a few calls” is the signature. Fix with <code>plan_cache_mode</code> (PG12+) or literals for constant predicates.</p>', fu: 'How do you see which plan a session is using? (PG14+: the generic_plans and custom_plans columns of pg_prepared_statements; or EXPLAIN EXECUTE.)', lvl: 'deep' },
    { q: 'How do OR conditions interact with indexes?', a: '<p>Postgres can combine indexes on each OR branch with a BitmapOr. If any branch has no usable index, it must seq scan. Rewrites: UNION (ALL with care for duplicates), or <code>IN (…)</code> for the same column, which becomes <code>= ANY(array)</code> and is a single index condition.</p>', lvl: 'core' },
    { q: 'What do you check when estimates are off by 100×?', a: '<p>Last analyze time and <code>n_mod_since_analyze</code>; statistics target for skewed columns; correlated predicates (extended statistics: dependencies, ndistinct, MCV); expressions without stats (add an expression index or extended statistics on the expression, PG14+); functions marked with wrong ROWS or volatility; and parameters in generic plans.</p>', lvl: 'deep' },
    { q: 'Why can a LIKE \'abc%\' fail to use a B-tree index?', a: '<p>Under a non-C collation the index order isn’t byte order, so a prefix isn’t one contiguous range. Use an index with <code>text_pattern_ops</code> (or <code>varchar_pattern_ops</code>), or <code>COLLATE "C"</code>. Also a parameterized pattern in a generic plan isn’t known to be left-anchored.</p>', lvl: 'core' },
    { q: 'How does random_page_cost change plans?', a: '<p>It is the planner’s relative cost of a non-sequential page read (default 4.0 vs seq_page_cost 1.0). Lowering it to ~1.1 on SSDs makes index and bitmap scans look cheaper, so they’re chosen at higher selectivities. Set it with <code>effective_cache_size</code> to reflect reality, per tablespace if storage differs.</p>', lvl: 'deep' },
    { q: 'How would you catch “index not used” regressions before production?', a: '<p>Production-sized data in staging, <code>auto_explain</code> with <code>log_min_duration</code>, <code>pg_stat_statements</code> diffs per release, and integration tests that EXPLAIN critical queries and assert on the plan node or on <code>Index Cond</code>. Plus a check that parameters are bound with the column’s type.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Bind the right type (Spring Data JPA)', lang: 'java', code: `// BAD: BigDecimal param against a bigint column → (id)::numeric = $1 → seq scan
@Query(value = "SELECT * FROM orders WHERE id = :id", nativeQuery = true)
Optional<Order> find(@Param("id") BigDecimal id);

// GOOD
@Query(value = "SELECT * FROM orders WHERE id = :id", nativeQuery = true)
Optional<Order> find(@Param("id") Long id);`, note: 'Same trap with <code>String</code> bound to a <code>uuid</code> or <code>int</code> column when <code>stringtype=unspecified</code> is not set: you get an error or a cast.' },
    { title: 'Generic-plan control in Hikari / pgJDBC', lang: 'java', code: `HikariConfig cfg = new HikariConfig();
cfg.setJdbcUrl("jdbc:postgresql://db/app?prepareThreshold=5");
// per-connection override for skew-sensitive workloads (PG12+)
cfg.setConnectionInitSql("SET plan_cache_mode = force_custom_plan");

// or only for one role:
// ALTER ROLE queue_worker SET plan_cache_mode = force_custom_plan;`, note: '<code>prepareThreshold=0</code> disables server-side prepares entirely (each statement re-planned), at some CPU cost. With PgBouncer in transaction mode, also check its prepared-statement support (1.21+).' },
    { title: 'Assert the plan in an integration test', lang: 'java', code: `@Test
void orderLookupUsesPrimaryKey() {
  String plan = jdbc.queryForList(
      "EXPLAIN (FORMAT TEXT) SELECT * FROM orders WHERE id = ?", String.class, 42L)
    .stream().collect(Collectors.joining("\\n"));
  assertThat(plan).contains("Index Scan using orders_pkey");
}` }
  ]
});

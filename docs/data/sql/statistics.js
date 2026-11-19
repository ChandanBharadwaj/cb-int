IA.register({
  track: 'sql',
  slug: 'statistics',
  title: 'Planner statistics',
  tagline: 'The planner never looks at your data while planning. It reads a <b>summary</b> made by ANALYZE: the most common values, an equi-depth histogram, the number of distinct values and the physical correlation. Every row estimate in EXPLAIN is arithmetic on that summary.',
  tldr: {
    problem: 'Bad plans almost always start with a bad row estimate, and a bad estimate almost always comes from statistics that are stale, too coarse, or blind to correlated columns.',
    model: '<code>ANALYZE</code> samples 300 × <code>default_statistics_target</code> rows (30,000 by default) and stores per-column summaries in <code>pg_statistic</code> (readable as <code>pg_stats</code>). Selectivities of separate predicates are <b>multiplied</b>, as if the columns were independent.',
    hook: '<code>city = \'Pune\' AND zip = \'411001\'</code>: the planner multiplies 1/20 × 1/100 and expects 10 rows. The real answer is 200, because the zip code already implies the city.',
    facts: [
      { v: '100', l: '<code>default_statistics_target</code>: up to 100 most-common values and 100 histogram buckets per column' },
      { v: '10% + 50', l: 'rows changed before autovacuum re-analyzes a table (<code>autovacuum_analyze_scale_factor</code> + threshold)' },
      { v: 'PG10+', l: '<code>CREATE STATISTICS</code> for correlated columns (dependencies, ndistinct; mcv in PG12+, expressions in PG14+)' }
    ]
  },
  intro: {
    what: 'Before running a query, Postgres must guess how many rows each step will produce, because the guess decides the plan (index or full scan, which join method). It can’t count the rows every time, so it keeps <b>statistics</b>: a small summary of each column, refreshed by <code>ANALYZE</code>.',
    analogy: { icon: '🗳️', title: 'An exit poll', text: 'Instead of counting every vote, pollsters ask a sample of voters and extrapolate. It works well, unless the sample is old (people changed their minds), too small to see a minority, or assumes two answers are unrelated when they are not (“lives in Pune” and “has a Pune zip code”).' },
    steps: [
      { t: 'ANALYZE builds the summary', d: 'Autovacuum runs it automatically after enough rows change. You can also run it yourself.', code: 'ANALYZE people;' },
      { t: 'Look at the summary', d: 'One row per column: how many distinct values, the most common ones with their frequencies, and histogram bucket boundaries.', code: "SELECT attname, n_distinct, most_common_vals,\n       most_common_freqs, histogram_bounds\nFROM pg_stats WHERE tablename = 'people';" },
      { t: 'The planner turns it into a row estimate', d: 'For <code>status = \'banned\'</code> it finds banned in the common-values list with frequency 0.005, so it expects 0.5% of the rows. EXPLAIN shows that as <code>rows=100</code>.' },
      { t: 'When the estimate is wrong, fix the statistics', d: 'Re-run ANALYZE, sample more (a higher statistics target), or tell Postgres that two columns are related with <code>CREATE STATISTICS</code>.' }
    ],
    terms: [
      ['selectivity', 'The fraction of rows a condition keeps (0 to 1). Estimated rows = table rows × selectivity.'],
      ['MCV list', 'Most common values with their frequencies, e.g. active 0.90, trial 0.095.'],
      ['histogram', 'Bucket boundaries that split the remaining (non-MCV) values into groups of equal row count.'],
      ['n_distinct', 'The number of distinct values. A negative value means a fraction of the row count: −1 means every value is unique.'],
      ['correlation', 'How closely the physical row order follows the column’s sort order (1 = perfectly ordered). It affects index scan cost.']
    ]
  },
  visual: {
    title: 'Build an equi-depth histogram, then estimate',
    caption: 'Press Play to watch ANALYZE take a sample, pull out the most common values, and cut the rest into buckets with the <b>same number of rows</b> each (so dense areas get narrow, tall buckets). Then drag the predicate and compare the planner’s estimate with the real count.'
  },
  extras: [
    { id: 'statistics-correlated', title: 'Correlated columns: city + zip', label: 'Interactive', caption: 'Pick two predicates. Without extended statistics, Postgres multiplies their selectivities. With <code>CREATE STATISTICS (dependencies)</code> it knows that zip determines city. Numbers match the playground data.' }
  ],
  playground: {
    setup: `
CREATE TABLE people (id int PRIMARY KEY, city text NOT NULL, zip text NOT NULL, status text NOT NULL,
  income int NOT NULL, created_at date NOT NULL);
-- 20 cities, each with 5 zip codes; a zip code belongs to exactly one city
INSERT INTO people
SELECT g, 'city' || lpad((g % 20)::text, 2, '0'), 'z' || lpad((g % 20)::text, 2, '0') || ((g / 20) % 5),
  CASE WHEN g % 200 = 0 THEN 'banned' WHEN g % 10 = 0 THEN 'trial' ELSE 'active' END,
  (power(((g * 7919) % 20000) / 20000.0, 3) * 200000)::int + g % 7,   -- skewed toward low incomes
  date '2020-01-01' + g / 10                                           -- inserted in date order
FROM generate_series(1, 20000) g;
CREATE INDEX people_status_idx ON people (status);
ANALYZE people;`,
    presets: [
      { label: 'pg_stats', sql: `SELECT attname, null_frac, n_distinct, most_common_vals, most_common_freqs,\n       round(correlation::numeric, 3) AS correlation\nFROM pg_stats WHERE tablename = 'people' ORDER BY attname;`, note: 'id: n_distinct −1 (unique). status: 3 values with frequencies 0.9 / 0.095 / 0.005. created_at: correlation 1 (rows were inserted in date order).' },
      { label: 'histogram', sql: `SELECT array_length(histogram_bounds, 1) AS bounds,\n       (histogram_bounds::text::int[])[1:12] AS first_bounds\nFROM pg_stats WHERE tablename = 'people' AND attname = 'income';`, note: '101 bounds = 100 buckets of equal row count. The skewed data gives narrow buckets at low incomes (57, 118, 162 …).' },
      { label: '= and range', sql: `EXPLAIN SELECT * FROM people WHERE status = 'banned';    -- MCV: 0.005 × 20000\nEXPLAIN SELECT * FROM people WHERE status = 'unknown';   -- not in MCV, clamped to 1\nEXPLAIN SELECT * FROM people WHERE income < 25000;       -- histogram\nSELECT count(*) FROM people WHERE income < 25000;`, note: 'Compare the <code>rows=</code> estimates with the real count in the last grid.' },
      { label: 'correlated cols', sql: `EXPLAIN (ANALYZE, TIMING OFF)\nSELECT * FROM people WHERE city = 'city07' AND zip = 'z073';`, note: 'Estimate rows=10, actual 200: 1/20 × 1/100 × 20,000, as if city and zip were independent. (If you already ran the CREATE STATISTICS preset, press Reset DB first.)' },
      { label: 'CREATE STATISTICS', sql: `CREATE STATISTICS people_city_zip (dependencies, ndistinct, mcv) ON city, zip FROM people;\nANALYZE people;\nEXPLAIN (ANALYZE, TIMING OFF)\nSELECT * FROM people WHERE city = 'city07' AND zip = 'z073';\nEXPLAIN SELECT city, zip, count(*) FROM people GROUP BY city, zip;\nSELECT statistics_name, kinds, n_distinct, dependencies FROM pg_stats_ext;`, note: 'Now rows=200, and the GROUP BY estimate drops from 2,000 to 100 groups. The dependency <code>3 => 2</code> (zip ⇒ city) has degree 1.0.' },
      { label: 'generic plan', sql: `PREPARE q(text) AS SELECT * FROM people WHERE status = $1;\nEXPLAIN EXECUTE q('banned');            -- custom plan: rows=100\nSET plan_cache_mode = force_generic_plan;\nEXPLAIN EXECUTE q('banned');            -- generic: rows=6667 (1/3 of the table)\nRESET plan_cache_mode; DEALLOCATE q;`, note: 'Without a value, the planner assumes an average: 1/n_distinct = 1/3. For a rare value that is badly wrong.' }
    ]
  },
  gotchas: [
    { trap: 'Querying right after a bulk load', why: 'Autovacuum analyzes only after 10% + 50 rows changed, and only when it gets to it (it checks every <code>autovacuum_naptime</code>, 1 min). A job that loads and then queries immediately plans with old statistics.', fix: 'Make <code>ANALYZE table</code> an explicit step after every bulk load, and after creating an index on an expression.' },
    { trap: 'Temporary tables are never auto-analyzed', why: 'Autovacuum cannot see other sessions’ temp tables. Joining a 1 M-row temp table gets default estimates.', fix: 'Run <code>ANALYZE my_temp</code> after filling it.' },
    { trap: 'Partitioned parents are not auto-analyzed', why: 'Autovacuum analyzes each partition, but not the partitioned table itself. Queries that need whole-table statistics (some joins and GROUP BYs over many partitions) use stale or missing parent statistics.', fix: 'Schedule <code>ANALYZE parent_table</code> (e.g. nightly, with pg_cron). See <a href="partitioning.html">Partitioning</a>.' },
    { trap: 'Selectivities are multiplied', code: `WHERE city = 'Pune' AND zip = '411001'   -- 0.05 × 0.01 → 10 rows (real: 200)\nWHERE country = 'NL' AND currency = 'EUR' -- same problem`, why: 'The planner assumes independence. Correlated columns lead to underestimates, which favour nested loops and index scans that go wrong at scale.', fix: '<code>CREATE STATISTICS … (dependencies, mcv) ON a, b</code>, then ANALYZE.' },
    { trap: 'Functions hide columns from statistics', code: `WHERE lower(email) = 'x@y.com'        -- default 0.5% selectivity\nWHERE created_at::date = '2025-01-01'  -- same`, why: 'There are no statistics for an expression unless an expression index (or, PG14+, expression statistics) exists.', fix: 'Create the expression index, or <code>CREATE STATISTICS ON (lower(email)) FROM users</code> (PG14+), then ANALYZE.' },
    { trap: 'A 30,000-row sample misses rare values in a huge table', why: 'In a 500 M-row table, a tenant with 0.001% of rows may not be sampled at all. It then gets a tiny estimate, while another non-MCV value may get a large one.', fix: 'Raise the target for that column only: <code>ALTER TABLE t ALTER COLUMN tenant_id SET STATISTICS 1000;</code> then ANALYZE. Max 10,000. It makes ANALYZE and planning a little slower.' },
    { trap: 'Losing statistics on major upgrades (before PG18)', why: 'Until PG17, pg_upgrade did not carry optimizer statistics over. Right after the upgrade, every query planned with no statistics.', fix: 'Run <code>vacuumdb --all --analyze-in-stages</code> straight after the upgrade. PG18’s pg_upgrade keeps most statistics (extended statistics still need ANALYZE).' }
  ],
  scenarios: [
    { title: 'Marketplace search: 50 ms for most cities, 30 s for Berlin',
      symptom: 'An API filters listings by <code>country</code> and <code>city</code>. It is fast everywhere except for the biggest cities.',
      diagnose: `EXPLAIN (ANALYZE) SELECT … WHERE country = 'DE' AND city = 'Berlin' ORDER BY created_at DESC LIMIT 50;\n-- Index Scan Backward using listings_created_idx (rows=4) (actual rows=50)\n--   Filter: country = 'DE' AND city = 'Berlin'   Rows Removed by Filter: 9,800,000`,
      cause: 'The planner multiplied the country and city selectivities and estimated a handful of matches. With so few expected rows, it walked the created_at index backwards and filtered on the way. For Berlin it had to skip millions of rows.',
      fix: 'Extended statistics fix the estimate. A composite index matching the filter and the sort removes the risk entirely.',
      fixCode: `CREATE STATISTICS listings_geo (dependencies, mcv) ON country, city FROM listings;\nANALYZE listings;\nCREATE INDEX CONCURRENTLY ON listings (city, created_at DESC);` },
    { title: 'Prepared statement becomes slow after five calls',
      symptom: 'After every deploy, a query is fast at first and then becomes 200× slower for <code>status = \'FAILED\'</code>, a rare value.',
      diagnose: `SELECT generic_plans, custom_plans FROM pg_prepared_statements;  -- in that session\nEXPLAIN (GENERIC_PLAN) SELECT * FROM jobs WHERE status = $1;     -- PG16+`,
      cause: 'The JDBC driver switches to a server-side prepared statement after 5 executions. Postgres then compares the generic plan’s cost with the average of the custom plans and switches to the generic plan, which assumes a “typical” status (1/n_distinct of the table) and uses a sequential scan.',
      fix: 'For skewed columns, use custom plans. You can set it per role, per database, or per transaction.',
      fixCode: `ALTER ROLE api SET plan_cache_mode = force_custom_plan;\n-- or, in one transaction:\nSET LOCAL plan_cache_mode = force_custom_plan;` },
    { title: 'Queries for “today” are slow every morning',
      symptom: 'Dashboards filtering <code>created_at &gt;= current_date</code> are slow until about 10:00, then fine.',
      diagnose: `SELECT histogram_bounds FROM pg_stats WHERE tablename = 'events' AND attname = 'created_at';\n-- the last bound is yesterday evening\nSELECT last_autoanalyze, n_mod_since_analyze FROM pg_stat_user_tables WHERE relname = 'events';`,
      cause: 'Today’s rows are newer than the last histogram bound. A big table needs millions of changes before autoanalyze runs again. Without an index on the column to look up the real maximum, the planner estimates almost no rows for today.',
      fix: 'Analyze large append-only tables more often. Make sure the column is indexed so the planner can read the real min/max from the index.',
      fixCode: `ALTER TABLE events SET (autovacuum_analyze_scale_factor = 0.01);` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Using the playground data (20,000 rows; banned has frequency 0.005), what does the planner estimate?', code: `EXPLAIN SELECT * FROM people WHERE status = 'banned';`, options: ['rows=1', 'rows=100', 'rows=6667', 'rows=20000'], answer: 1, explain: 'banned is in the MCV list with frequency 0.005: 20,000 × 0.005 = <b>100</b>.' },
    { kind: 'predict', q: 'And for a value that is not in the MCV list at all?', code: `EXPLAIN SELECT * FROM people WHERE status = 'unknown';`, options: ['rows=0', 'rows=1', 'rows=100', 'rows=6667'], answer: 1, explain: 'All 3 distinct values are already in the MCV list, so nothing is left for other values. The estimate is clamped to at least <b>1 row</b>; the planner never estimates 0.' },
    { kind: 'predict', q: 'Before CREATE STATISTICS, what is the estimate for city07 + zip z073 (20 cities, 100 zips, 20,000 rows)?', code: `EXPLAIN SELECT * FROM people WHERE city = 'city07' AND zip = 'z073';`, options: ['rows=1', 'rows=10', 'rows=200', 'rows=1000'], answer: 1, explain: '0.05 × 0.01 × 20,000 = <b>10</b>. The real count is 200, because z073 implies city07.' },
    { kind: 'predict', q: 'How many groups does the planner expect for <code>GROUP BY city, zip</code>, without extended statistics?', code: `EXPLAIN SELECT city, zip, count(*) FROM people GROUP BY city, zip;`, options: ['20', '100', '2000', '20000'], answer: 2, explain: 'It multiplies the distinct counts, 20 × 100 = <b>2,000</b> (capped at a fraction of the row count). The truth is 100. <code>CREATE STATISTICS (ndistinct)</code> fixes it, which matters when choosing HashAggregate memory.' },
    { kind: 'predict', q: 'In the generic plan for <code>status = $1</code>, how many rows are estimated?', code: `PREPARE q(text) AS SELECT * FROM people WHERE status = $1;\nSET plan_cache_mode = force_generic_plan;\nEXPLAIN EXECUTE q('banned');`, options: ['100', '1', '6667', '18000'], answer: 2, explain: 'Without the value, the planner uses 1/n_distinct = 1/3 of 20,000 ≈ <b>6,667</b>, and picks a bitmap scan instead of the index scan the rare value deserves.' },
    { kind: 'concept', q: 'What does <code>correlation = 1</code> on <code>created_at</code> tell the planner?', options: ['created_at values are unique', 'created_at is correlated with another column', 'Rows are stored on disk in created_at order, so an index range scan reads pages nearly sequentially', 'The column has no NULLs'], answer: 2, explain: 'Correlation compares the physical order with the logical order. Near ±1, an index range scan touches few, mostly sequential pages, so the planner costs it much cheaper.' }
  ],
  interview: [
    { q: 'How does Postgres estimate the rows for <code>col = const</code>?', a: '<p>If the value is in <code>most_common_vals</code>, the selectivity is its frequency. Otherwise it spreads the remaining fraction evenly: <code>(1 − null_frac − Σ mcv_freqs) / (n_distinct − number of MCVs)</code>. Rows = reltuples × selectivity, clamped to at least 1.</p>', lvl: 'core' },
    { q: 'And for <code>col &lt; const</code>?', a: '<p>Sum of the MCV frequencies below the constant, plus the histogram fraction: count the full buckets below the constant, interpolate linearly inside the bucket it falls in, divide by the bucket count, and scale by the non-MCV, non-NULL fraction. Because buckets are equi-depth (same number of rows), that interpolation is accurate even for skewed data.</p>', fu: 'What if the constant is above the last histogram bound? (If there is an index, the planner reads the real max from it; otherwise it assumes almost nothing is there.)', lvl: 'deep' },
    { q: 'What kinds of extended statistics are there, and what does each fix?', a: '<ul><li><b>dependencies</b> (PG10): functional dependencies (zip ⇒ city) for equality clauses ANDed together.</li><li><b>ndistinct</b> (PG10): distinct counts of column combinations, for GROUP BY and DISTINCT.</li><li><b>mcv</b> (PG12): most common combinations, which also helps with ranges and IN lists.</li><li><b>Expressions</b> (PG14): statistics on <code>lower(email)</code> without an index.</li></ul>', lvl: 'core' },
    { q: 'What does default_statistics_target control, and when do you raise it?', a: '<p>The number of MCVs and histogram buckets (up to 100 each by default), and the sample size (300 × target rows). Raise it per column for skewed, high-cardinality columns where important values are missed, e.g. tenant_id. Higher targets make ANALYZE and planning slower, so not globally.</p>', lvl: 'core' },
    { q: 'When does autoanalyze run, and when isn’t it enough?', a: '<p>When changes since the last analyze exceed <code>autovacuum_analyze_threshold + autovacuum_analyze_scale_factor × reltuples</code> (50 + 10%). That is too late for bulk loads followed by immediate queries, for huge append-only tables where new data lies beyond the histogram, and it never happens for temp tables or partitioned parents.</p>', lvl: 'core' },
    { q: 'Explain generic vs custom plans for prepared statements.', a: '<p>A custom plan is built for the actual parameter values. A generic plan is built once without them, using average selectivities. With <code>plan_cache_mode = auto</code> (default), the first 5 executions use custom plans; after that Postgres uses the generic plan if its estimated cost is not much worse than the custom plans’ average. For skewed data that comparison can be misleading. PG12+ lets you force either mode.</p>', fu: 'How does that interact with pgJDBC? (prepareThreshold=5 before it uses a named server-side statement; with PgBouncer in transaction mode, server-side prepared statements need PgBouncer 1.21+ or must be disabled.)', lvl: 'deep' },
    { q: 'What is n_distinct = −0.5?', a: '<p>Negative values are fractions of the row count: the number of distinct values is 50% of the rows, so it grows with the table. ANALYZE stores it that way when it believes distinct values scale with the table. You can override wrong values with <code>ALTER TABLE … ALTER COLUMN … SET (n_distinct = …)</code>.</p>', lvl: 'deep' },
    { q: 'How would you find which queries suffer from bad estimates?', a: '<p>Use auto_explain with <code>log_analyze</code> on slow queries and compare estimated and actual rows per node. Look at <code>pg_stat_user_tables</code> for <code>n_mod_since_analyze</code> and <code>last_autoanalyze</code>. Check <code>pg_stats</code> for the filter columns: is the value in the MCV list? Is it beyond the histogram?</p>', lvl: 'core' },
    { q: 'Can you make the planner use statistics from production on a test database?', a: '<p>Statistics come from ANALYZE on the data that is present. PG18 adds functions to export and restore relation and attribute statistics (used by pg_dump’s statistics support and pg_upgrade), which makes it possible to reproduce production plans on a smaller copy.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Run ANALYZE after a bulk import in a Spring Batch job', lang: 'java', code: `@Bean
public Step analyzeAfterImport(JobRepository repo, PlatformTransactionManager tx, JdbcTemplate jdbc) {
  return new StepBuilder("analyzeImport", repo)
      .tasklet((contribution, chunk) -> {
        jdbc.execute("ANALYZE import_rows");   // seconds; prevents a 1-row estimate
        return RepeatStatus.FINISHED;
      }, tx)
      .build();
}`, note: 'Place this step between the import step and the steps that query the imported data.' },
    { title: 'Force custom plans for a skewed query (pgJDBC / Hikari)', lang: 'properties', code: `# Per connection pool: every session starts with custom plans
spring.datasource.hikari.connection-init-sql=SET plan_cache_mode = force_custom_plan

# Or keep the default and disable server-side prepares (always a custom plan, plus parsing cost)
spring.datasource.hikari.data-source-properties.prepareThreshold=0`, note: '<code>prepareThreshold=0</code> also avoids “prepared statement does not exist” errors behind older PgBouncer versions in transaction mode.' }
  ]
});

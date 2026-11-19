IA.register({
  track: 'sql',
  slug: 'pivot-percentiles',
  title: 'Pivots & percentiles',
  tagline: 'Turning rows into columns (and back), and asking “what’s the p95?”. Both are aggregates with a twist: <code>FILTER</code> picks which rows feed each column, <code>WITHIN GROUP</code> says the rows must be <b>sorted</b> first.',
  tldr: {
    problem: 'Reports want quarters as columns, metrics want p50/p95 instead of averages that one outlier wrecks. The obvious tools, crosstab and avg, have sharp edges.',
    model: '<b>Pivot</b> = GROUP BY the row key + one <code>agg(x) FILTER (WHERE col = \'v\')</code> per output column. <b>Unpivot</b> = <code>CROSS JOIN LATERAL (VALUES …)</code>. <b>Percentile</b> = an ordered-set aggregate: sort the group, then pick (<code>_disc</code>) or interpolate (<code>_cont</code>).',
    hook: '<code>percentile_cont(0.5)</code> of 12, 15, 18, 25, 40, 90 is 21.5, a value that doesn’t exist. <code>percentile_disc(0.5)</code> is 18.',
    facts: [
      { v: 'PG9.4+', l: '<code>FILTER (WHERE …)</code> on any aggregate, plus <code>percentile_*</code>, <code>mode()</code> and <code>WITHIN GROUP</code>' },
      { v: 'O(n log n)', l: 'per group: percentiles sort every input row in memory or on disk. No index shortcut, no partial/parallel aggregate' },
      { v: 'fixed', l: 'output columns of any SQL pivot. A “dynamic pivot” needs dynamic SQL or a JSON object' }
    ]
  },
  intro: {
    what: 'A <b>pivot</b> turns values in a column (Q1, Q2, …) into separate columns, like a spreadsheet pivot table. A <b>percentile</b> answers “what value is X% of the data below?”. The <b>median</b> (50th percentile) is the middle value, and it isn’t thrown off by one huge outlier the way the average is.',
    analogy: { icon: '📊', title: 'A spreadsheet pivot table and a queue of people by height', text: 'Pivot: drag “quarter” to the columns area and every quarter gets its own column. Percentile: line people up by height; the median is whoever stands in the middle. If there are two middles, you can pick one of them (disc) or average them (cont).' },
    steps: [
      { t: 'Long data', d: 'Facts are stored one per row: <code>(region, quarter, amt)</code>.' },
      { t: 'Pivot with FILTER', d: 'One aggregate per output column. FILTER says which rows go into it.', code: "SELECT region,\n  sum(amt) FILTER (WHERE quarter = 'Q1') AS q1,\n  sum(amt) FILTER (WHERE quarter = 'Q2') AS q2\nFROM sales GROUP BY region;" },
      { t: 'Median', d: '<code>WITHIN GROUP (ORDER BY …)</code> tells the aggregate how to sort the values first.', code: 'SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY ms)\nFROM latency;' },
      { t: 'Most common value', d: '<code>mode()</code> is also an ordered-set aggregate.', code: 'SELECT mode() WITHIN GROUP (ORDER BY browser) FROM visits;' }
    ],
    widget: 'pivot-percentiles-intro',
    terms: [
      ['pivot / unpivot', 'Rows → columns, and columns → rows.'],
      ['FILTER (WHERE …)', 'Restricts which rows one aggregate sees, without touching the others.'],
      ['median', 'The middle value of the sorted data (50th percentile).'],
      ['p95', 'The 95th percentile: 95% of values are at or below it. Common for latency.'],
      ['ordered-set aggregate', 'An aggregate that needs sorted input: <code>percentile_cont</code>, <code>percentile_disc</code>, <code>mode</code>.']
    ]
  },
  visual: {
    title: 'percentile_cont vs percentile_disc',
    caption: 'Pick an even or odd row count and a fraction. Disc (orange) picks the first real value whose cumulative fraction reaches p. Cont (blue marker) interpolates linearly at position p × (n − 1).'
  },
  playground: {
    setup: `
CREATE TABLE sales (region text, quarter text, amt int);
INSERT INTO sales VALUES ('EU','Q1',10),('EU','Q2',15),('EU','Q1',3),('US','Q1',20),('US','Q2',5),('US','Q4',8),('APAC','Q3',12);
CREATE TABLE latency (endpoint text, ms int);
INSERT INTO latency VALUES ('/a',25),('/a',90),('/a',12),('/a',40),('/a',18),('/a',15),
 ('/b',25),('/b',90),('/b',12),('/b',18),('/b',15);
CREATE TABLE kpi (day date, signups int, logins int, orders int);
INSERT INTO kpi VALUES ('2024-03-01',5,120,9),('2024-03-02',7,140,NULL);
CREATE TABLE visits (browser text);
INSERT INTO visits VALUES ('firefox'),('chrome'),('safari'),('chrome'),('firefox');`,
    presets: [
      { label: 'Pivot with FILTER', sql: `SELECT region,\n  sum(amt) FILTER (WHERE quarter = 'Q1') AS q1,\n  sum(amt) FILTER (WHERE quarter = 'Q2') AS q2,\n  sum(amt) FILTER (WHERE quarter = 'Q3') AS q3,\n  coalesce(sum(amt) FILTER (WHERE quarter = 'Q4'), 0) AS q4,\n  sum(amt) AS total\nFROM sales GROUP BY region ORDER BY region;`, note: 'Empty cells are NULL (sum of no rows). COALESCE where the report needs 0.' },
      { label: 'Pivot with CASE', sql: `-- portable (pre-9.4, other databases); same result\nSELECT region,\n  sum(CASE WHEN quarter = 'Q1' THEN amt END) AS q1,\n  sum(CASE WHEN quarter = 'Q2' THEN amt END) AS q2,\n  count(CASE WHEN quarter = 'Q1' THEN 1 END) AS q1_rows\nFROM sales GROUP BY region ORDER BY region;`, note: 'Careful: <code>count(CASE … ELSE 0 END)</code> counts the zeros too. FILTER doesn’t have this trap.' },
      { label: 'Unpivot (LATERAL VALUES)', sql: `SELECT k.day, v.metric, v.value\nFROM kpi k\nCROSS JOIN LATERAL (VALUES ('signups', k.signups),\n                           ('logins',  k.logins),\n                           ('orders',  k.orders)) AS v(metric, value)\nWHERE v.value IS NOT NULL\nORDER BY 1, 2;`, note: 'All VALUES columns must have one common type. Mixed types need a cast (often to text or numeric).' },
      { label: 'cont vs disc', sql: `SELECT endpoint, count(*) AS n,\n  percentile_disc(0.5) WITHIN GROUP (ORDER BY ms) AS p50_disc,\n  percentile_cont(0.5) WITHIN GROUP (ORDER BY ms) AS p50_cont,\n  percentile_cont(0.9) WITHIN GROUP (ORDER BY ms) AS p90_cont,\n  round(avg(ms), 1) AS avg\nFROM latency GROUP BY endpoint ORDER BY 1;`, note: '/a has 6 rows: cont interpolates 21.5. /b has 5 rows: both give 18.' },
      { label: 'Many percentiles + mode', sql: `SELECT percentile_disc(ARRAY[0.5, 0.9, 0.99]) WITHIN GROUP (ORDER BY ms) AS p50_p90_p99,\n       (SELECT mode() WITHIN GROUP (ORDER BY browser) FROM visits) AS top_browser\nFROM latency;`, note: 'An array of fractions sorts once. mode() breaks ties arbitrarily (here chrome and firefox both appear twice).' },
      { label: 'Dynamic pivot (JSON)', sql: `SELECT region, jsonb_object_agg(quarter, total ORDER BY quarter) AS by_quarter\nFROM (SELECT region, quarter, sum(amt) AS total FROM sales GROUP BY 1, 2) s\nGROUP BY region ORDER BY region;`, note: 'When the set of columns isn’t known up front, return one JSON object per row and let the client lay it out. jsonb stores keys in its own order, so don’t rely on key order; use <code>json_object_agg</code> if order matters.' }
    ]
  },
  gotchas: [
    { trap: 'crosstab(text) shifts values into the wrong column', code: `SELECT * FROM crosstab(\n  'SELECT region, quarter, sum(amt) FROM sales GROUP BY 1,2 ORDER BY 1,2'\n) AS ct(region text, q1 int, q2 int, q3 int, q4 int);`, why: 'The one-argument form fills columns left to right per row. US has Q1, Q2, Q4 but no Q3, so Q4’s value lands in the q3 column.', fix: 'Use the two-argument form <code>crosstab(source_sql, \'SELECT DISTINCT quarter … ORDER BY 1\')</code>, which maps by category. Or skip tablefunc and use FILTER.' },
    { trap: 'crosstab needs an extension and a fixed column list', why: '<code>CREATE EXTENSION tablefunc</code> needs privileges managed services may restrict, and you must spell out every output column and type in <code>AS ct(…)</code>. A new category is silently dropped.', fix: 'FILTER is plain SQL, planner-visible and reviewable. For truly dynamic columns, return JSON or generate the SQL in the app.' },
    { trap: 'avg latency hides the tail', why: 'Averages are dominated by bulk traffic; a 5% slow tail barely moves them. SLOs are written in percentiles for this reason.', fix: 'Report p50/p95/p99. In SQL that’s <code>percentile_cont(ARRAY[…]) WITHIN GROUP (ORDER BY ms)</code>.' },
    { trap: 'Averaging percentiles', why: 'The average of hourly p95s is not the daily p95. Percentiles don’t compose.', fix: 'Keep raw values, or store mergeable sketches/histograms (e.g. bucket counts, then compute the percentile from cumulative counts).' },
    { trap: 'Percentiles on 500M rows', why: 'Ordered-set aggregates sort all input per group, can’t use partial/parallel aggregation, and spill to disk past work_mem.', fix: 'Pre-aggregate into histogram buckets, sample (<code>TABLESAMPLE</code>), or use an approximate extension where available.' },
    { trap: 'Unpivot with mixed types', code: `CROSS JOIN LATERAL (VALUES ('name', name), ('age', age)) v(k, val)\n-- ERROR: VALUES types text and integer cannot be matched`, why: 'All rows of a VALUES list must resolve to one type per column.', fix: 'Cast explicitly: <code>age::text</code>, or unpivot to <code>jsonb</code> with <code>jsonb_each</code>(<code>to_jsonb(row)</code>).' }
  ],
  scenarios: [
    { title: 'Quarterly board report: US Q4 revenue reported as Q3',
      symptom: 'The finance pivot showed revenue in Q3 for a region that only launched in Q4.',
      diagnose: `SELECT region, array_agg(quarter ORDER BY quarter)\nFROM sales GROUP BY region;   -- US: {Q1,Q2,Q4}, no Q3`,
      cause: 'Single-argument <code>crosstab()</code> fills columns positionally; a missing category shifts later values left.',
      fix: 'Replace with FILTER aggregates (or the two-argument crosstab with an explicit category query).',
      fixCode: `SELECT region,\n  sum(amt) FILTER (WHERE quarter = 'Q3') AS q3,\n  sum(amt) FILTER (WHERE quarter = 'Q4') AS q4\nFROM sales GROUP BY region;` },
    { title: 'Latency dashboard green while customers complained',
      symptom: 'Average response time steady at 80 ms. Support saw timeouts from a few large tenants.',
      diagnose: `SELECT tenant_id,\n  percentile_cont(ARRAY[.5,.95,.99]) WITHIN GROUP (ORDER BY ms)\nFROM requests WHERE ts > now() - interval '1 hour'\nGROUP BY tenant_id ORDER BY 2 DESC LIMIT 20;`,
      cause: 'The mean hid a p99 of 9 s concentrated in 3 tenants with huge result sets.',
      fix: 'Alert on per-tenant p95/p99. Pre-aggregate into per-minute histogram buckets so the query doesn’t sort millions of rows each refresh.' },
    { title: 'Nightly percentile job: 40 minutes and 30 GB of temp files',
      symptom: 'The p95-by-endpoint job got slower every week.',
      diagnose: `EXPLAIN (ANALYZE, BUFFERS) SELECT endpoint,\n  percentile_cont(0.95) WITHIN GROUP (ORDER BY ms)\nFROM requests GROUP BY endpoint;\n-- GroupAggregate ← Sort (external merge, Disk: 30GB)`,
      cause: 'Ordered-set aggregates need every value sorted; no parallelism, no partial aggregation. Table grew to 900M rows.',
      fix: 'Roll up into a <code>(endpoint, minute, bucket_ms, count)</code> table on ingest; compute percentiles from cumulative bucket counts.',
      fixCode: `SELECT endpoint, min(bucket_ms) FILTER (WHERE cum >= 0.95 * total) AS p95\nFROM (SELECT endpoint, bucket_ms,\n        sum(cnt) OVER (PARTITION BY endpoint ORDER BY bucket_ms) cum,\n        sum(cnt) OVER (PARTITION BY endpoint) total\n      FROM latency_hist) s\nGROUP BY endpoint;` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Median of /a (25, 90, 12, 40, 18, 15) with percentile_cont?', code: `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY ms) FROM latency WHERE endpoint = '/a';`, options: ['18', '21.5', '25', '33.3'], answer: 1, explain: 'Sorted: 12, 15, 18, 25, 40, 90. Position 0.5 × 5 = 2.5 → halfway between 18 and 25 = <b>21.5</b>.' },
    { kind: 'predict', q: 'And percentile_disc(0.5) on the same rows?', code: `SELECT percentile_disc(0.5) WITHIN GROUP (ORDER BY ms) FROM latency WHERE endpoint = '/a';`, options: ['18', '21.5', '25', '15'], answer: 0, explain: 'First value with cume_dist ≥ 0.5: 18 is 3/6 = 0.5 → <b>18</b>.' },
    { kind: 'predict', q: 'percentile_cont(0.9) for /a?', code: `SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY ms) FROM latency WHERE endpoint = '/a';`, options: ['40', '65', '90', '81'], answer: 1, explain: 'Position 0.9 × 5 = 4.5 → halfway between 40 and 90 = <b>65</b>.' },
    { kind: 'predict', q: 'Value of q3 for US?', code: `SELECT sum(amt) FILTER (WHERE quarter = 'Q3') AS q3\nFROM sales WHERE region = 'US';`, options: ['0', 'NULL', '8', 'Error'], answer: 1, explain: 'No rows pass the filter, and sum over zero rows is <b>NULL</b>, not 0.' },
    { kind: 'bug', q: 'What does q1_rows return for EU?', code: `SELECT count(CASE WHEN quarter = 'Q1' THEN 1 ELSE 0 END) AS q1_rows\nFROM sales WHERE region = 'EU';`, options: ['2', '3', '1', '0'], answer: 1, explain: 'count counts non-NULL values, and 0 isn’t NULL: all <b>3</b> EU rows. Drop the ELSE or use FILTER.' },
    { kind: 'predict', q: 'How many rows does this unpivot return?', code: `SELECT * FROM kpi k CROSS JOIN LATERAL\n (VALUES ('signups', k.signups), ('logins', k.logins), ('orders', k.orders)) v(m, val)\nWHERE v.val IS NOT NULL;`, options: ['4', '5', '6', '3'], answer: 1, explain: '2 days × 3 metrics = 6, minus the NULL orders on 03-02 = <b>5</b>.' }
  ],
  interview: [
    { q: 'How do you pivot in Postgres without crosstab?', a: '<p>GROUP BY the row key, then one aggregate per output column with <code>FILTER (WHERE category = …)</code> (PG9.4+) or <code>CASE WHEN</code> inside the aggregate. One pass over the data, plain SQL, no extension.</p>', lvl: 'core' },
    { q: 'What are crosstab’s pitfalls?', a: '<p>Needs the tablefunc extension; output columns and types must be declared; the one-argument form fills positionally so missing categories shift values; it’s a black box to the planner. The two-argument form fixes the shifting.</p>', lvl: 'deep' },
    { q: 'percentile_cont vs percentile_disc?', a: '<p>Both sort the group. <b>disc</b> returns the first input value whose cumulative distribution ≥ p, always a real value and works for any sortable type. <b>cont</b> linearly interpolates at position p × (n−1) and needs a numeric/interval type. For an even count, cont(0.5) is the classic median, disc(0.5) the lower middle.</p>', fu: 'Which would you use for “median order date”? (disc, or cont on an epoch.)', lvl: 'core' },
    { q: 'Why can’t percentiles run in parallel like sum?', a: '<p>Ordered-set aggregates have no combine function: a median of medians isn’t the median. Postgres must gather and sort all rows per group in one process. Pre-aggregated histograms are the scalable path.</p>', lvl: 'deep' },
    { q: 'How would you compute p95 latency over billions of rows daily?', a: '<p>Bucket on ingest (log-scaled ms buckets, count per minute/endpoint). Percentiles come from cumulative counts in a tiny table, and buckets merge across time ranges, unlike stored percentiles.</p>', lvl: 'deep' },
    { q: 'How do you unpivot columns into rows?', a: '<p><code>CROSS JOIN LATERAL (VALUES (\'a\', t.a), (\'b\', t.b)) v(k, val)</code>. The LATERAL lets VALUES reference the outer row. Alternatives: <code>unnest(ARRAY[…], ARRAY[…])</code> or <code>jsonb_each_text(to_jsonb(t))</code> for “all columns”.</p>', lvl: 'core' },
    { q: 'What does mode() return on ties?', a: '<p>One of the most frequent values, chosen arbitrarily (in practice the first in sort order, but don’t rely on it). If ties matter, compute counts with GROUP BY and rank them explicitly.</p>', lvl: 'core' },
    { q: 'FILTER vs WHERE vs HAVING?', a: '<p>WHERE removes rows before grouping for <i>all</i> aggregates. FILTER restricts the input of <i>one</i> aggregate. HAVING filters groups after aggregation.</p>', lvl: 'core' },
    { q: 'Can you pivot to a dynamic number of columns?', a: '<p>Not in one static SQL statement: the result type must be known at plan time. Options: build SQL dynamically (with whitelisted identifiers via <code>format(\'%I\')</code>), return <code>jsonb_object_agg</code>, or pivot in the client.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Pivot to a DTO with JdbcTemplate', lang: 'java', code: `record RegionQuarters(String region, Long q1, Long q2, Long q3, Long q4) {}

List<RegionQuarters> rows = jdbc.query("""
    SELECT region,
      sum(amt) FILTER (WHERE quarter = 'Q1') q1, sum(amt) FILTER (WHERE quarter = 'Q2') q2,
      sum(amt) FILTER (WHERE quarter = 'Q3') q3, sum(amt) FILTER (WHERE quarter = 'Q4') q4
    FROM sales WHERE year = ? GROUP BY region""",
  (rs, i) -> new RegionQuarters(rs.getString(1),
      rs.getObject(2, Long.class), rs.getObject(3, Long.class),   // NULL-safe, unlike getLong
      rs.getObject(4, Long.class), rs.getObject(5, Long.class)), year);`, note: '<code>rs.getLong</code> turns NULL into 0 silently. Use <code>getObject(i, Long.class)</code> when “no data” must differ from zero.' },
    { title: 'Reading a percentile array', lang: 'java', code: `Double[] p = jdbc.queryForObject("""
    SELECT percentile_cont(ARRAY[0.5,0.95,0.99]) WITHIN GROUP (ORDER BY ms)
    FROM requests WHERE ts > now() - interval '5 minutes'""",
  (rs, i) -> (Double[]) rs.getArray(1).getArray());
meter.gauge("p95", p[1]);` }
  ]
});

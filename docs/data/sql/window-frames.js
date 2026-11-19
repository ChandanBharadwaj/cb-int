IA.register({
  track: 'sql',
  slug: 'window-frames',
  title: 'Window functions II: frames',
  tagline: 'Every aggregate in <code>OVER (…)</code> is computed over a <b>frame</b>: a sliding subset of the partition. Most window bugs come from a frame you never wrote, the default one.',
  tldr: {
    problem: 'Running totals that jump on ties, a <code>last_value</code> that just echoes the current row, and a “7-day average” that actually covers 7 <i>rows</i> spread across three weeks.',
    model: 'For each row: <b>partition</b> (which rows) → <b>order</b> (in what sequence) → <b>frame</b> (which slice around me) → aggregate over the slice. <code>ROWS</code> counts rows, <code>RANGE</code> measures value distance, <code>GROUPS</code> counts peer groups.',
    hook: 'With <code>ORDER BY</code> and no frame, the frame is <code>RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW</code>. “Current row” includes all its <b>peers</b> (ties).',
    facts: [
      { v: 'RANGE … CURRENT ROW', l: 'the implicit frame once you write ORDER BY. Without ORDER BY the frame is the whole partition' },
      { v: 'PG11+', l: 'GROUPS mode, RANGE with offsets (<code>\'6 days\' PRECEDING</code>) and <code>EXCLUDE</code>' },
      { v: '0', l: 'effect a frame has on LAG, LEAD or rank. Only aggregates and the value functions read it' }
    ]
  },
  intro: {
    what: 'A <b>window function</b> computes a value for each row by looking at <i>other rows</i> near it, without collapsing rows the way <code>GROUP BY</code> does. The <b>frame</b> is exactly which neighbours it looks at: “all rows so far”, “the previous 6 days”, “one row before and after”.',
    analogy: { icon: '🔎', title: 'A magnifying glass sliding down a list', text: 'Lay a bank statement on the table and slide a magnifier down it, one line at a time. At each line you add up whatever is under the glass. A big glass that starts at the top gives a running balance. A small one covering 7 lines gives a moving average. The frame is the size and shape of the glass.' },
    steps: [
      { t: 'Order the rows', d: 'A frame only makes sense once rows have an order.', code: 'SELECT day, amt,\n       sum(amt) OVER (ORDER BY day) AS running\nFROM sales;' },
      { t: 'Say how far the glass reaches', d: 'Explicit bounds: <code>UNBOUNDED PRECEDING</code> (from the start), <code>n PRECEDING</code>, <code>CURRENT ROW</code>, <code>n FOLLOWING</code>.', code: 'avg(amt) OVER (ORDER BY day\n  ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)' },
      { t: 'Pick what “distance” means', d: '<code>ROWS</code> = physical rows. <code>RANGE</code> = difference in the ORDER BY value (e.g. 6 days). <code>GROUPS</code> = groups of tied rows.' },
      { t: 'Neighbours without a frame', d: '<code>LAG(amt)</code> and <code>LEAD(amt)</code> read the previous / next row directly. They ignore the frame.', code: 'amt - LAG(amt, 1, 0) OVER (ORDER BY day) AS change' }
    ],
    widget: 'window-frames-intro',
    terms: [
      ['partition', 'The group of rows a window function sees: <code>PARTITION BY store</code>. Each store is computed separately.'],
      ['frame', 'The slice of the partition, relative to the current row, that an aggregate uses.'],
      ['peers', 'Rows with equal ORDER BY values. RANGE and GROUPS treat them as one unit.'],
      ['UNBOUNDED PRECEDING', 'From the first row of the partition.'],
      ['WINDOW clause', 'Names a window spec once: <code>WINDOW w AS (…)</code>, then <code>OVER w</code>.']
    ]
  },
  visual: {
    title: 'Slide the frame',
    caption: 'Seven rows ordered by <code>day</code>, with ties on days 2 and 5. Pick a mode, bounds and EXCLUDE, then press Play. Start with <b>default</b>: notice that row 2’s running sum already includes row 3, and last_value is never “the last row”.'
  },
  extras: [
    { id: 'window-frames-matrix', title: 'Which functions care about the frame?', label: 'matrix', caption: 'Click a function to see whether the frame changes its result, and the frame you usually want with it.' }
  ],
  playground: {
    setup: `
CREATE TABLE sales (day date, store text, amt int);
INSERT INTO sales VALUES
 ('2024-03-01','A',10),('2024-03-02','A',20),('2024-03-02','A',5),('2024-03-03','A',30),
 ('2024-03-05','A',15),('2024-03-05','A',25),('2024-03-06','A',40),
 ('2024-03-01','B',7),('2024-03-04','B',3),('2024-03-12','B',9);
CREATE TABLE prices (ts timestamptz, sym text, px numeric);
INSERT INTO prices VALUES ('2024-03-01 10:00','X',100),('2024-03-01 10:01','X',NULL),('2024-03-01 10:02','X',103),('2024-03-01 10:03','X',99);`,
    presets: [
      { label: 'Default frame trap', sql: `SELECT day, amt,\n  sum(amt)        OVER (ORDER BY day) AS running_default,\n  sum(amt)        OVER (ORDER BY day ROWS UNBOUNDED PRECEDING) AS running_rows,\n  last_value(amt) OVER (ORDER BY day) AS last_default\nFROM sales WHERE store = 'A' ORDER BY day, amt;`, note: 'The tied days 03-02 and 03-05 show the same running_default on both rows. last_default is the last <i>peer</i>, not the partition’s last row. running_rows on tied rows depends on an arbitrary tie order.' },
      { label: 'last_value fixed', sql: `SELECT day, amt,\n  last_value(amt)  OVER w AS last_in_partition,\n  first_value(amt) OVER w AS first_in_partition,\n  nth_value(amt, 2) OVER w AS second\nFROM sales WHERE store = 'A'\nWINDOW w AS (ORDER BY day, amt ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)\nORDER BY day, amt;`, note: 'A full frame plus a unique ORDER BY (<code>day, amt</code>) makes last_value deterministic.' },
      { label: '7-day moving avg', sql: `-- daily totals first, then a calendar-aware window\nWITH d AS (SELECT store, day, sum(amt) AS amt FROM sales GROUP BY 1,2)\nSELECT store, day, amt,\n  round(avg(amt) OVER (PARTITION BY store ORDER BY day ROWS 6 PRECEDING), 1) AS avg_7_rows,\n  round(avg(amt) OVER (PARTITION BY store ORDER BY day\n        RANGE BETWEEN '6 days' PRECEDING AND CURRENT ROW), 1) AS avg_7_days\nFROM d ORDER BY store, day;`, note: 'Store B on 03-12: ROWS still averages 3 rows from 11 days back (6.3), while RANGE only sees 03-12 itself (9.0).' },
      { label: 'ROWS / RANGE / GROUPS', sql: `SELECT day, amt,\n  sum(amt) OVER (ORDER BY day ROWS   BETWEEN 1 PRECEDING AND CURRENT ROW) AS rows_1,\n  sum(amt) OVER (ORDER BY day RANGE  BETWEEN '1 day' PRECEDING AND CURRENT ROW) AS range_1d,\n  sum(amt) OVER (ORDER BY day GROUPS BETWEEN 1 PRECEDING AND CURRENT ROW) AS groups_1\nFROM sales WHERE store = 'A' ORDER BY day, amt;`, note: 'On 03-05 RANGE \'1 day\' finds no 03-04 rows, so it sums just the two peers (40). GROUPS goes back one peer group, to 03-03 (70).' },
      { label: 'LAG / LEAD defaults', sql: `SELECT ts, px,\n  LAG(px)        OVER w AS prev,\n  LAG(px, 1, px) OVER w AS prev_or_self,\n  LEAD(px, 2)    OVER w AS two_ahead,\n  px - LAG(px)   OVER w AS change\nFROM prices WINDOW w AS (ORDER BY ts) ORDER BY ts;`, note: 'The default only applies when the offset falls <i>outside</i> the partition. A NULL value inside it is still returned as NULL (no IGNORE NULLS in PG 16/17).' },
      { label: 'EXCLUDE + WINDOW reuse', sql: `SELECT day, amt,\n  sum(amt) OVER (w ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS total,\n  sum(amt) OVER (w ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING\n                 EXCLUDE CURRENT ROW) AS others,\n  sum(amt) OVER (w RANGE BETWEEN 1 PRECEDING AND 1 FOLLOWING EXCLUDE TIES) AS no_ties\nFROM (SELECT extract(day FROM day)::int AS day, amt FROM sales WHERE store = 'A') s\nWINDOW w AS (ORDER BY day)\nORDER BY day, amt;`, note: '<code>w</code> has no frame, so each OVER may add one. If w already had a frame, <code>OVER (w EXCLUDE …)</code> is a syntax error: you cannot copy a window that has a frame clause.' }
    ]
  },
  gotchas: [
    { trap: 'last_value() returns the current row', code: `last_value(amt) OVER (ORDER BY day)\n-- frame ends at CURRENT ROW (and its peers)`, why: 'The default frame ends at the current row’s last peer, so the “last” row in the frame is basically you.', fix: 'Write <code>ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING</code>, or use <code>first_value(…) OVER (ORDER BY day DESC)</code>.' },
    { trap: 'Running total jumps on ties', why: 'Default RANGE includes peers: two orders at the same timestamp both show the sum including each other. Reports “double-step”.', fix: 'Add a unique tiebreaker to ORDER BY (<code>ts, id</code>) and use <code>ROWS UNBOUNDED PRECEDING</code>.' },
    { trap: '“7-day average” over ROWS 6 PRECEDING', why: 'ROWS counts rows. Missing days stretch the window back in time; days with many rows shrink it.', fix: 'Aggregate per day first, then use <code>RANGE BETWEEN \'6 days\' PRECEDING AND CURRENT ROW</code> (PG11+), or fill the calendar with <code>generate_series</code>.' },
    { trap: 'ROWS with a non-unique ORDER BY is nondeterministic', why: 'Peers can come out in any order, and that order can change between runs, plans or after VACUUM. Paginated exports drift.', fix: 'Always end the ORDER BY with a unique key when using ROWS, row_number or LAG.' },
    { trap: 'Filtering on a window result in WHERE', code: `SELECT * FROM t WHERE row_number() OVER (…) = 1;  -- ERROR`, why: 'Windows run after WHERE, GROUP BY and HAVING.', fix: 'Wrap it: <code>SELECT * FROM (SELECT …, row_number() OVER (…) rn FROM t) s WHERE rn = 1</code>. Or use <code>DISTINCT ON</code>.' },
    { trap: 'LAG default does not replace NULL values', why: '<code>LAG(x, 1, 0)</code> returns 0 only for the first row. If the previous row’s x is NULL you still get NULL. PG has no <code>IGNORE NULLS</code> (16/17).', fix: 'COALESCE the result, or build “last non-null” with a running <code>count(x)</code> as a group key plus <code>first_value</code>.' },
    { trap: 'Many different windows = many sorts', why: 'Each distinct PARTITION BY / ORDER BY needs its own sort (a WindowAgg node per spec). Five specs on 50M rows can mean five external sorts.', fix: 'Reuse one <code>WINDOW w</code> where possible. Specs that share PARTITION/ORDER but differ only in frame share a sort. Check EXPLAIN for repeated Sort nodes.' }
  ],
  scenarios: [
    { title: 'Account balances off by exactly one transaction',
      symptom: 'Customer statements show the same running balance on two lines whenever two transfers posted in the same second. Support tickets: “my balance skipped a step”.',
      diagnose: `SELECT account_id, posted_at, count(*)\nFROM ledger GROUP BY 1,2 HAVING count(*) > 1;   -- ties exist`,
      cause: '<code>sum(amount) OVER (PARTITION BY account_id ORDER BY posted_at)</code> uses the default RANGE frame, so both peers include each other.',
      fix: 'Order by a unique key and use ROWS. Add a unit test with two equal timestamps.',
      fixCode: `sum(amount) OVER (PARTITION BY account_id\n                  ORDER BY posted_at, id\n                  ROWS UNBOUNDED PRECEDING)` },
    { title: 'Fraud rule fired on a dormant account',
      symptom: '“Spend in last 7 days > 5× average” triggered for a user whose 7 transactions spanned 4 months.',
      diagnose: `SELECT user_id, min(ts), max(ts) FROM (\n  SELECT user_id, ts, row_number() OVER (PARTITION BY user_id ORDER BY ts DESC) rn FROM tx) s\nWHERE rn <= 7 GROUP BY 1;`,
      cause: 'The rule used <code>ROWS 6 PRECEDING</code>, i.e. 7 rows, not 7 days.',
      fix: 'Use a time-based RANGE frame on the timestamp (PG11+).',
      fixCode: `sum(amount) OVER (PARTITION BY user_id ORDER BY ts\n  RANGE BETWEEN interval '7 days' PRECEDING AND CURRENT ROW)` },
    { title: 'Nightly report went from 4 min to 70 min',
      symptom: 'A new KPI column added a fourth window with a different PARTITION BY. temp files exploded.',
      diagnose: `EXPLAIN (ANALYZE, BUFFERS) SELECT …;\n-- 4× "Sort Method: external merge  Disk: 9GB"`,
      cause: 'Each distinct partition/order spec needs a separate full sort of 80M rows. work_mem was 4MB.',
      fix: 'Compute the odd-one-out window in a separate pre-aggregated CTE and join back, or align specs so they share a sort. Raise work_mem for that session only.',
      fixCode: `SET LOCAL work_mem = '512MB';` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Store A, ordered by day. What is <code>running</code> on the first 03-02 row?', code: `SELECT day, amt, sum(amt) OVER (ORDER BY day) AS running\nFROM sales WHERE store = 'A' ORDER BY day, amt LIMIT 2;`, options: ['15', '30', '35', '10'], answer: 2, explain: 'Default RANGE frame includes both 03-02 peers: 10 + 5 + 20 = <b>35</b> on both 03-02 rows.' },
    { kind: 'predict', q: 'What does <code>last_value</code> return on the 03-01 row?', code: `SELECT last_value(amt) OVER (ORDER BY day) AS lv\nFROM sales WHERE store = 'A' ORDER BY day LIMIT 1;`, options: ['40 (last row)', '10 (itself)', 'NULL', '25'], answer: 1, explain: 'The frame ends at the current row’s last peer. 03-01 has no peers, so last_value is <b>10</b>, itself.' },
    { kind: 'predict', q: 'GROUPS 1 PRECEDING on 03-05 (amt 15 and 25, previous group 03-03 = 30). Sum?', code: `SELECT sum(amt) OVER (ORDER BY day GROUPS BETWEEN 1 PRECEDING AND CURRENT ROW) s\nFROM sales WHERE store = 'A' AND day = '2024-03-05'\n   OR store = 'A' AND day = '2024-03-03';`, options: ['40', '70', '30', '55'], answer: 1, explain: 'WHERE runs first, leaving 03-03 and both 03-05 rows. For a 03-05 row the frame is group 03-03 plus the 03-05 group: 30 + 15 + 25 = <b>70</b>. The last row returned is a 03-05 row.' },
    { kind: 'predict', q: 'Store B rows are 03-01 (7), 03-04 (3), 03-12 (9). 7-day RANGE sum on 03-12?', code: `SELECT sum(amt) OVER (ORDER BY day RANGE BETWEEN '6 days' PRECEDING AND CURRENT ROW) s\nFROM sales WHERE store = 'B' ORDER BY day;`, options: ['19', '12', '9', '3'], answer: 2, explain: '03-12 minus 6 days is 03-06, and nothing else falls in that range: <b>9</b>.' },
    { kind: 'predict', q: 'Value of <code>prev</code> on the 10:02 row?', code: `SELECT LAG(px, 1, 0) OVER (ORDER BY ts) AS prev\nFROM prices ORDER BY ts OFFSET 2 LIMIT 1;`, options: ['0', '100', 'NULL', '103'], answer: 2, explain: 'The previous row exists (10:01), its px is NULL, so you get <b>NULL</b>. The default 0 only applies when there is no previous row.' },
    { kind: 'concept', q: 'Which of these is affected by the frame clause?', options: ['row_number()', 'LAG()', 'nth_value()', 'rank()'], answer: 2, explain: 'first_value, last_value, nth_value and aggregates use the frame. Ranking functions and LAG/LEAD operate on the whole partition.' }
  ],
  interview: [
    { q: 'What is the default window frame in Postgres?', a: '<p>Without ORDER BY: the whole partition. With ORDER BY: <code>RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW</code>, where “current row” extends to the last peer. That’s why running sums repeat on ties and last_value looks broken.</p>', fu: 'How do you make last_value return the partition’s last row?', lvl: 'core' },
    { q: 'ROWS vs RANGE vs GROUPS?', a: '<p><b>ROWS</b>: physical offsets. <b>RANGE</b>: logical distance on the ORDER BY value; with an offset it needs exactly one ORDER BY column of a type with subtraction (numeric, date, timestamp, interval). <b>GROUPS</b> (PG11+): counts peer groups. With CURRENT ROW as a bound, RANGE and GROUPS include all peers, ROWS doesn’t.</p>', lvl: 'core' },
    { q: 'How would you compute a correct 7-day moving average with missing days?', a: '<p>Aggregate to one row per day, then either use <code>RANGE \'6 days\' PRECEDING</code>, or left-join to <code>generate_series</code> to create zero rows and use ROWS 6 PRECEDING. They differ: RANGE averages the days that exist, the calendar join averages including zeros. Decide which the business means.</p>', lvl: 'core' },
    { q: 'What does EXCLUDE do?', a: '<p>PG11+. It removes rows from the frame after bounds are applied: <code>CURRENT ROW</code>, <code>GROUP</code> (current row and peers), <code>TIES</code> (peers but not the current row), <code>NO OTHERS</code> (default). Useful for “average of everyone else”.</p>', lvl: 'deep' },
    { q: 'Can you use a window function in WHERE? Why not?', a: '<p>No. Logical order is FROM → WHERE → GROUP BY → HAVING → window → SELECT list → DISTINCT → ORDER BY → LIMIT. Filter in an outer query. For top-1-per-group, <code>DISTINCT ON</code> is often simpler and plans well with an index.</p>', lvl: 'core' },
    { q: 'How does Postgres execute multiple windows?', a: '<p>One WindowAgg node per distinct window spec, fed by sorted input. Specs with compatible PARTITION/ORDER can be stacked on one sort. Different orders need re-sorting. An index on <code>(partition, order)</code> can remove the first sort. PG15+ can push a <code>rn &lt;= N</code> filter into the WindowAgg (“Run Condition”) and stop early.</p>', fu: 'What does “Run Condition” in EXPLAIN mean?', lvl: 'deep' },
    { q: 'LAG(x, 1, 0) still returns NULL. Why?', a: '<p>The default applies only when the offset row is outside the partition. If the row exists and its x is NULL, NULL is returned. PG 16/17 have no IGNORE NULLS; emulate with a running <code>count(x)</code> as a group id, then <code>first_value(x)</code> over that group.</p>', lvl: 'deep' },
    { q: 'What can and can’t you do with a named WINDOW?', a: '<p><code>OVER (w ROWS …)</code> can add a frame or ORDER BY if w lacks them, but you can’t override an existing ORDER BY, and you can’t copy a window that has a frame clause and add one. PARTITION BY can’t be added at all.</p>', lvl: 'deep' },
    { q: 'Why is a running total with ROWS sometimes different on each run?', a: '<p>Peers have no defined order, so ROWS splits them arbitrarily. Parallel plans or a different sort algorithm reorder them. Add a unique tiebreaker.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Running balance in a native query', lang: 'java', code: `public interface BalanceRow { Long getId(); Instant getPostedAt(); BigDecimal getBalance(); }

@Query(value = """
  SELECT id, posted_at AS postedAt,
         sum(amount) OVER (ORDER BY posted_at, id ROWS UNBOUNDED PRECEDING) AS balance
  FROM ledger WHERE account_id = :acct
  ORDER BY posted_at, id""", nativeQuery = true)
List<BalanceRow> statement(@Param("acct") long acct);`, note: 'Hibernate 6.2+ HQL also supports <code>OVER</code> with frames, but native SQL keeps the frame clause explicit and reviewable.' },
    { title: 'Don’t re-implement LAG in Java', lang: 'java', code: `// anti-pattern: load 2M rows and loop to compute deltas
// prev = null; for (Row r : rows) { r.delta = r.px - prev.px; ... }
// instead, let the DB do it and stream:
jdbc.query(con -> {
    var ps = con.prepareStatement("""
      SELECT ts, px - LAG(px) OVER (ORDER BY ts) AS delta FROM prices""");
    ps.setFetchSize(5_000);          // needs autocommit off to stream
    return ps; }, rs -> { /* write row */ });` }
  ]
});

IA.register({
  track: 'sql',
  slug: 'window-ranking',
  title: 'Window functions I: ranking',
  tagline: 'A window function computes a value <b>across related rows</b> while keeping every row. GROUP BY collapses rows; <code>OVER (PARTITION BY … ORDER BY …)</code> doesn’t. Ranking functions differ only in how they treat <b>ties</b>, and that difference is where the bugs hide.',
  tldr: {
    problem: '“Top 3 per department”, “rank sellers”, “dedupe keeping the latest row” are everyday tasks. Teams get them wrong by picking the wrong ranking function, filtering in the wrong place, or forgetting a tiebreaker, so results change from run to run.',
    model: 'Rows are split into <b>partitions</b>, each sorted by the window ORDER BY. Then each row gets a number based on its position: <code>ROW_NUMBER</code> 1,2,3,4 · <code>RANK</code> 1,1,3,4 · <code>DENSE_RANK</code> 1,1,2,3. This happens <b>after</b> WHERE, GROUP BY and HAVING.',
    hook: 'A dedupe job using <code>ROW_NUMBER() OVER (PARTITION BY email ORDER BY updated_at)</code> deleted a different “duplicate” on each run, because two rows shared an updated_at.',
    facts: [
      { v: 'rows in = rows out', l: 'window functions never remove or merge rows. Filtering by their result needs an outer query' },
      { v: '1,1,3 vs 1,1,2', l: 'RANK leaves gaps after ties; DENSE_RANK doesn’t; ROW_NUMBER breaks ties arbitrarily' },
      { v: 'PG15+', l: 'Run Condition: <code>WHERE rn &lt;= N</code> outside lets WindowAgg stop emitting early' }
    ]
  },
  intro: {
    what: 'Sometimes you want a per-group calculation <b>next to each row</b> instead of one row per group. “Each employee with their salary rank inside their department.” A <b>window function</b> does that: it looks at a “window” of related rows (the department), but every employee stays in the result.',
    analogy: { icon: '🏅', title: 'Race results per age group', text: 'All runners stay on the results sheet. Within each age group (partition), runners are sorted by time (ORDER BY) and get a place number. Two runners with the same time: do they share 1st place, and is the next one 2nd or 3rd? That is RANK vs DENSE_RANK vs ROW_NUMBER.' },
    steps: [
      { t: 'GROUP BY collapses', d: '<code>SELECT dept, max(salary) … GROUP BY dept</code> gives 3 rows for 3 departments. Names are gone.' },
      { t: 'OVER keeps rows', d: 'The same idea as a window: every employee stays, and gets a number.', code: 'SELECT name, dept, salary,\n  rank() OVER (PARTITION BY dept\n               ORDER BY salary DESC) AS r\nFROM employees;' },
      { t: 'PARTITION BY = per group', d: 'Numbering restarts at 1 in each department. Without PARTITION BY, the whole table is one partition.' },
      { t: 'Filtering needs a wrapper', d: 'You can’t write <code>WHERE r = 1</code> in the same SELECT: windows are computed after WHERE.', code: 'SELECT * FROM (\n  SELECT …, rank() OVER (…) AS r FROM employees\n) t WHERE r = 1;' }
    ],
    widget: 'window-ranking-intro',
    terms: [
      ['window function', 'A function evaluated over a set of rows related to the current row, written with <code>OVER (…)</code>.'],
      ['partition', 'The group of rows a window looks at (<code>PARTITION BY dept</code>).'],
      ['ROW_NUMBER', '1, 2, 3… with no ties; tied rows get arbitrary distinct numbers.'],
      ['RANK / DENSE_RANK', 'Tied rows share a number. RANK skips the next numbers; DENSE_RANK doesn’t.'],
      ['NTILE(n)', 'Splits each partition into n roughly equal buckets, numbered 1..n.']
    ]
  },
  visual: {
    title: 'Partition, sort, number: three ranking functions side by side',
    caption: 'Step through: rows are split into department partitions, sorted by salary, then numbered one row at a time. Ties are highlighted. Remove the tiebreaker to see ROW_NUMBER become non-deterministic, or remove PARTITION BY to rank the whole company. The row count never changes.'
  },
  playground: {
    setup: `
CREATE TABLE employees (id int PRIMARY KEY, name text NOT NULL, dept text NOT NULL, salary int NOT NULL);
INSERT INTO employees VALUES
 (1,'Ana','eng',120),(2,'Bo','eng',120),(3,'Cy','eng',100),(4,'Di','eng',90),
 (5,'Ed','ops',80),(6,'Fi','ops',75),(7,'Gu','ops',75),(8,'Hal','sales',70);
CREATE TABLE big_emp AS SELECT g AS id, 'd' || (g % 50) AS dept, (g * 7919) % 100000 AS salary FROM generate_series(1, 50000) g;
ANALYZE;`,
    presets: [
      { label: 'Side by side', sql: `SELECT dept, name, salary,\n       row_number() OVER (PARTITION BY dept ORDER BY salary DESC, id) AS rn,\n       rank()       OVER w AS rnk,\n       dense_rank() OVER w AS drnk,\n       ntile(2)     OVER (PARTITION BY dept ORDER BY salary DESC, id) AS half\nFROM employees\nWINDOW w AS (PARTITION BY dept ORDER BY salary DESC)   -- named window\nORDER BY dept, salary DESC, id;`, note: '8 rows in, 8 rows out. eng: rn 1,2,3,4 · rank 1,1,3,4 · dense 1,1,2,3. RANK and DENSE_RANK use <code>w</code> without the id: a tiebreaker would remove the very ties they exist to show.' },
      { label: 'vs GROUP BY', sql: `SELECT dept, max(salary) AS top_salary, count(*) AS n\nFROM employees GROUP BY dept ORDER BY dept;\n\nSELECT dept, name, salary,\n       max(salary) OVER (PARTITION BY dept) AS top_salary,\n       count(*)    OVER (PARTITION BY dept) AS n\nFROM employees ORDER BY dept, salary DESC;`, note: '3 rows vs 8 rows: the same aggregates, but the window version keeps every employee.' },
      { label: 'Top-N per dept', sql: `-- top 2 earners per department, ties included\nSELECT dept, name, salary, r FROM (\n  SELECT e.*, dense_rank() OVER (PARTITION BY dept ORDER BY salary DESC) AS r\n  FROM employees e) t\nWHERE r <= 2\nORDER BY dept, r, name;`, note: 'eng returns 3 people: Ana and Bo tie for 1st, Cy is 2nd. With ROW_NUMBER you would get exactly 2 per dept, and which tied person is dropped would be arbitrary.' },
      { label: 'Filter: why a subquery', sql: `-- evaluation order: FROM → WHERE → GROUP BY → HAVING → WINDOW → SELECT → ORDER BY\nSELECT name, salary, rank() OVER (ORDER BY salary DESC) AS r\nFROM employees\nWHERE dept = 'eng'      -- runs FIRST: ranks only eng\nORDER BY r;`, note: 'WHERE removes rows before ranking, so Ana is rank 1 among eng only. To rank company-wide and then show eng, rank in a subquery and filter outside.' },
      { label: 'Run Condition (PG15+)', sql: `EXPLAIN (COSTS OFF)\nSELECT * FROM (\n  SELECT id, dept, row_number() OVER (PARTITION BY dept ORDER BY salary DESC, id) AS rn\n  FROM big_emp) t\nWHERE rn <= 3;`, note: 'Look for <code>Run Condition: (row_number() OVER w1 &lt;= 3)</code>. Rows past 3 per partition aren’t emitted, but the Sort still processes all 50,000.' },
      { label: 'Dedupe, keep latest', sql: `CREATE TEMP TABLE contacts (id int, email text, updated_at date);\nINSERT INTO contacts VALUES (1,'a@x.io','2026-01-01'),(2,'a@x.io','2026-02-01'),(3,'a@x.io','2026-02-01'),(4,'b@x.io','2026-01-05');\n\nSELECT id, email, updated_at FROM (\n  SELECT c.*, row_number() OVER (PARTITION BY email\n                                 ORDER BY updated_at DESC, id DESC) AS rn  -- tiebreaker!\n  FROM contacts c) t\nWHERE rn = 1 ORDER BY email;`, note: 'ids 2 and 3 tie on updated_at. Without <code>id DESC</code>, which one survives depends on the plan.' }
    ]
  },
  gotchas: [
    { trap: 'Filtering on the window result in WHERE', code: `SELECT *, row_number() OVER (…) AS rn FROM t WHERE rn = 1;  -- ERROR`, why: 'WHERE runs before window functions are evaluated, so <code>rn</code> doesn’t exist yet (and window functions aren’t allowed in WHERE at all).', fix: 'Wrap it in a subquery or CTE, then filter. Postgres has no QUALIFY clause.' },
    { trap: 'ROW_NUMBER without a tiebreaker', code: `row_number() OVER (PARTITION BY email ORDER BY updated_at DESC)`, why: 'Rows that tie on the ORDER BY get numbers in whatever order the sort delivers them. That can change with parallelism, work_mem, a new index, or just new data.', fix: 'Append a unique column: <code>ORDER BY updated_at DESC, id DESC</code>.' },
    { trap: 'ROW_NUMBER when you meant RANK', why: '“Top 3 salaries” with ROW_NUMBER drops one of two people tied at #3. RANK keeps both (and may return 4). DENSE_RANK returns everyone in the top 3 <i>salary values</i>.', fix: 'Decide what a tie means for the business and choose the function accordingly.' },
    { trap: 'WHERE changes what gets ranked', why: 'Rows removed by WHERE never enter the window. “Rank of Ana in the company” with <code>WHERE dept = \'eng\'</code> is her rank in eng.', fix: 'Rank in an inner query over the full set, filter in the outer query.' },
    { trap: 'Window ORDER BY doesn’t order the output', why: 'The OVER (ORDER BY …) only defines numbering. The final row order is only guaranteed by the query’s own ORDER BY.', fix: 'Always add an outer ORDER BY.' },
    { trap: 'NTILE buckets are by row count, not by value', why: '<code>ntile(4)</code> on 10 rows gives sizes 3,3,2,2, and tied values can land in different buckets.', fix: 'For value-based quantiles use <code>percentile_cont</code> / <code>percent_rank()</code>, or define buckets by explicit thresholds.' }
  ],
  scenarios: [
    { title: 'Dedupe job deleted a different row every night',
      symptom: 'A nightly “keep the newest contact per email” job produced a diff in a downstream CRM every day, even when no contacts had changed.',
      diagnose: `SELECT email, updated_at, count(*) FROM contacts\nGROUP BY 1, 2 HAVING count(*) > 1;   -- 31,000 ties on the same timestamp (bulk import)`,
      cause: '<code>row_number() OVER (PARTITION BY email ORDER BY updated_at DESC)</code> with ties. A parallel sort returned tied rows in a different order each run, so a different row got rn = 1.',
      fix: 'Add a unique tiebreaker and make the rule explicit (e.g. highest id wins).',
      fixCode: `DELETE FROM contacts c USING (\n  SELECT id, row_number() OVER (PARTITION BY email\n                                ORDER BY updated_at DESC, id DESC) rn\n  FROM contacts) d\nWHERE c.id = d.id AND d.rn > 1;` },
    { title: '“Top 10 sellers” leaderboard showed 9 names',
      symptom: 'A sales contest page sometimes showed only 9 winners, and two reps with equal revenue complained about being swapped in and out.',
      diagnose: `SELECT revenue, count(*) FROM monthly_sales GROUP BY revenue HAVING count(*) > 1;`,
      cause: 'The page used <code>rank() … WHERE r &lt;= 10</code>, then the frontend took exactly 10 rows sorted by name. With a tie at #9, ranks 9, 9 and 11 meant the cut fell inside the tie.',
      fix: 'Agree on a rule (ties share a place), use RANK or DENSE_RANK consistently server-side, and show ties explicitly.',
      fixCode: `SELECT * FROM (\n  SELECT rep, revenue, rank() OVER (ORDER BY revenue DESC) AS place\n  FROM monthly_sales) t\nWHERE place <= 10\nORDER BY place, rep;` },
    { title: 'Ranking query spilled 8 GB to disk',
      symptom: 'An hourly “top 5 products per category” job got 20× slower as the catalogue grew.',
      diagnose: `EXPLAIN (ANALYZE, BUFFERS) …\n-- WindowAgg ← Sort (external merge Disk: 8,100,000kB) ← Seq Scan products_events`,
      cause: 'ROW_NUMBER needs every row sorted by (category, score). The 200M-row sort spilled; only 5 × 4,000 rows were kept.',
      fix: 'With few partitions and a small N, use LATERAL + LIMIT over the category list and an index on <code>(category_id, score DESC)</code>. See <a href="lateral-top-n.html">LATERAL top-N</a>.',
      fixCode: `SELECT c.id, p.*\nFROM categories c\nCROSS JOIN LATERAL (\n  SELECT * FROM products p WHERE p.category_id = c.id\n  ORDER BY score DESC, id LIMIT 5) p;` }
  ],
  puzzles: [
    { kind: 'predict', q: 'eng salaries: 120, 120, 100, 90. What does RANK give Cy (100)?', code: `SELECT rank() OVER (ORDER BY salary DESC)\nFROM employees WHERE dept = 'eng' AND name = 'Cy';`, options: ['2', '3', '1', '4'], answer: 2, explain: 'Trick! WHERE runs first, so only Cy is ranked: <b>1</b>. In the full eng partition, Cy would be rank 3.' },
    { kind: 'predict', q: 'Now ranked over eng properly. Cy’s DENSE_RANK?', code: `SELECT r FROM (\n  SELECT name, dense_rank() OVER (ORDER BY salary DESC) r\n  FROM employees WHERE dept = 'eng') t\nWHERE name = 'Cy';`, options: ['2', '3', '1', '4'], answer: 0, explain: '120, 120 share 1, the next distinct value gets <b>2</b>. RANK would say 3.' },
    { kind: 'predict', q: 'How many rows?', code: `SELECT dept, name, rank() OVER (PARTITION BY dept ORDER BY salary DESC)\nFROM employees;`, options: ['3', '8', '4', '1'], answer: 1, explain: 'Window functions keep every row: <b>8</b>.' },
    { kind: 'predict', q: 'Top 2 per dept by RANK. How many rows?', code: `SELECT * FROM (\n  SELECT name, dept, rank() OVER (PARTITION BY dept ORDER BY salary DESC) r\n  FROM employees) t\nWHERE r <= 2;`, options: ['5', '6', '7', '4'], answer: 1, explain: 'eng: Ana, Bo (both 1) → 2. ops: Ed 1, Fi 2, Gu 2 → 3. sales: Hal → 1. Total <b>6</b>.' },
    { kind: 'predict', q: 'NTILE(3) over eng (4 rows). Bucket sizes?', code: `SELECT ntile(3) OVER (ORDER BY salary DESC, id) AS b\nFROM employees WHERE dept = 'eng';`, options: ['2,1,1', '1,1,2', '2,2,0', '1,2,1'], answer: 0, explain: '4 rows into 3 buckets: the first buckets get the extra row → <b>2,1,1</b> (values 1,1,2,3).' },
    { kind: 'bug', q: 'What happens?', code: `SELECT name, row_number() OVER (ORDER BY salary DESC) AS rn\nFROM employees\nWHERE row_number() OVER (ORDER BY salary DESC) = 1;`, options: ['Returns Ana', 'Returns Ana or Bo', 'ERROR: window functions are not allowed in WHERE', 'Returns 0 rows'], answer: 2, explain: '<b>ERROR</b>. Windows are computed after WHERE. Use a subquery.' }
  ],
  interview: [
    { q: 'Window function vs GROUP BY: what is the fundamental difference?', a: '<p>GROUP BY collapses each group into one row; non-grouped columns are lost. A window function computes a value per row over a related set (its partition and frame) and keeps every row. You can mix both: windows are evaluated after GROUP BY, over the grouped rows, e.g. <code>rank() OVER (ORDER BY sum(amount) DESC)</code>.</p>', lvl: 'core' },
    { q: 'ROW_NUMBER vs RANK vs DENSE_RANK on 100, 100, 90?', a: '<p>ROW_NUMBER: 1, 2, 3 (tie broken arbitrarily). RANK: 1, 1, 3 (gap = number of tied rows). DENSE_RANK: 1, 1, 2 (no gaps). RANK answers “how many rows are strictly ahead of me + 1”, DENSE_RANK answers “how many distinct values are ahead of me + 1”.</p>', lvl: 'core' },
    { q: 'Why can’t you filter on a window function in WHERE, and how do you work around it?', a: '<p>Logical evaluation order: FROM → WHERE → GROUP BY → HAVING → window → SELECT → DISTINCT → ORDER BY → LIMIT. WHERE has to decide which rows exist before windows are computed over them. Wrap the query in a subquery or CTE and filter outside. Some databases offer QUALIFY; Postgres doesn’t.</p>', lvl: 'core' },
    { q: 'Is ROW_NUMBER deterministic?', a: '<p>Only if the window ORDER BY is total (unique) within each partition. Otherwise tied rows are numbered in whatever order the sort delivers them; Postgres’s sort isn’t stable and parallel plans change arrival order. Add a unique tiebreaker.</p>', lvl: 'core' },
    { q: 'How does Postgres execute a window function?', a: '<p>A WindowAgg node over input sorted by (PARTITION BY, ORDER BY) columns: from a Sort, an Incremental Sort, or an index scan already in that order. Several windows with compatible orderings share one sort. It streams partition by partition, buffering rows as the frame requires (a tuplestore that can spill).</p>', fu: 'How do you avoid the sort? (An index on (dept, salary DESC) that the planner uses to provide the order.)', lvl: 'deep' },
    { q: 'What did PG15 change for ranking queries?', a: '<p>The Run Condition: for monotonic functions (row_number, rank, dense_rank, count…) with an outer filter like <code>rn &lt;= 3</code>, the planner pushes that condition into WindowAgg, which stops emitting rows in a partition once it becomes false. Without PARTITION BY it can stop the whole scan. Also in PG15: faster in-memory sorts that help WindowAgg input.</p>', lvl: 'deep' },
    { q: 'Top-N per group: ROW_NUMBER or LATERAL?', a: '<p>ROW_NUMBER reads and sorts every row: great when partitions are small or you need most rows. LATERAL + LIMIT with an index on (group, order key) reads only N entries per group: great with few groups and a large table. See <a href="lateral-top-n.html">LATERAL top-N</a>.</p>', lvl: 'deep' },
    { q: 'What does NTILE do with uneven sizes and ties?', a: '<p>It deals rows into n buckets by position: sizes differ by at most one, and the earlier buckets get the extras. It ignores values, so tied rows can land in different buckets. For value-based quartiles use <code>percentile_cont</code> or <code>width_bucket</code>.</p>', lvl: 'core' },
    { q: 'Write “second-highest salary per dept”, handling ties.', a: '<p><code>SELECT dept, salary FROM (SELECT dept, salary, dense_rank() OVER (PARTITION BY dept ORDER BY salary DESC) r FROM employees) t WHERE r = 2</code>. DENSE_RANK means “second distinct value”. Add DISTINCT if you only want the value once per dept.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Spring Data: top-N per group (native)', lang: 'java', code: `public interface TopEarner { String getDept(); String getName(); int getSalary(); int getPlace(); }

@Query(value = """
  SELECT dept, name, salary, place FROM (
    SELECT e.dept, e.name, e.salary,
           dense_rank() OVER (PARTITION BY e.dept ORDER BY e.salary DESC) AS place
    FROM employees e) t
  WHERE place <= :n
  ORDER BY dept, place, name""", nativeQuery = true)
List<TopEarner> topEarners(@Param("n") int n);`, note: 'HQL in Hibernate 6 supports window functions too, but a native query keeps the SQL obvious.' },
    { title: 'Deterministic dedupe in a migration', lang: 'sql', code: `DELETE FROM contacts c USING (
  SELECT id, row_number() OVER (PARTITION BY lower(email)
                                ORDER BY updated_at DESC, id DESC) AS rn
  FROM contacts) d
WHERE c.id = d.id AND d.rn > 1;
CREATE UNIQUE INDEX CONCURRENTLY contacts_email_uq ON contacts (lower(email));` }
  ]
});

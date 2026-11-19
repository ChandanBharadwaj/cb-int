IA.register({
  track: 'sql',
  slug: 'ctes',
  title: 'CTEs: WITH queries',
  tagline: 'A CTE is a <b>named subquery</b>. Since PG12 the planner usually treats it exactly like one. The exceptions (materialization, data-modifying CTEs, one shared snapshot) are where the interesting bugs live.',
  tldr: {
    problem: 'Teams wrote CTEs for readability and got 1000× slower queries (pre-PG12 fences). Others relied on the fence as a hint and got surprised after upgrading. Data-modifying CTEs look sequential but aren’t.',
    model: 'PG12+: a CTE that is non-recursive, side-effect free and referenced <b>once</b> is inlined. Otherwise it’s computed once into a tuplestore (a fence). <code>MATERIALIZED</code> / <code>NOT MATERIALIZED</code> override that. All sub-statements of one WITH share <b>one snapshot</b>.',
    hook: 'In <code>WITH d AS (DELETE FROM t … RETURNING *) SELECT count(*) FROM t</code>, the count still includes the deleted rows.',
    facts: [
      { v: 'PG12', l: 'CTE inlining arrived; before that every CTE was an optimization fence' },
      { v: '1 snapshot', l: 'shared by every sub-statement of a WITH. Changes pass between them only through RETURNING' },
      { v: 'exactly once', l: 'a data-modifying CTE runs to completion even if nothing reads its output' }
    ]
  },
  intro: {
    what: 'A <b>CTE</b> (Common Table Expression) is written with <code>WITH name AS (…)</code>. It gives a subquery a name so the main query can use it like a table. It exists only while that one statement runs. It’s mostly about making long queries readable, step by step.',
    analogy: { icon: '📝', title: 'Scratch notes before the final answer', text: 'Solving a long math problem, you write “let A = …, let B = A × 2” on scratch paper, then the final line uses A and B. A CTE is that scratch line: a named intermediate result, thrown away when the statement ends.' },
    steps: [
      { t: 'Name a subquery', d: '<code>WITH totals AS (…)</code> defines it.', code: 'WITH totals AS (\n  SELECT customer_id, sum(amount) AS total\n  FROM orders GROUP BY customer_id)\nSELECT * FROM totals WHERE total > 100;' },
      { t: 'Chain them', d: 'Later CTEs can read earlier ones, separated by commas.', code: 'WITH a AS (…), b AS (SELECT … FROM a)\nSELECT … FROM b;' },
      { t: 'It only lives for one statement', d: 'Not a temp table and not a view: the next query can’t see it.' },
      { t: 'It can also change data', d: '<code>WITH moved AS (DELETE … RETURNING *) INSERT INTO archive SELECT * FROM moved;</code> moves rows in one atomic statement.' }
    ],
    widget: 'ctes-intro',
    terms: [
      ['CTE', 'Common Table Expression: a named subquery defined with WITH.'],
      ['inlining', 'The planner pastes the CTE into the main query, so it can be optimized as a whole.'],
      ['materialize', 'Compute the CTE once, store the rows in memory/disk, read them back (“CTE Scan”).'],
      ['optimization fence', 'A boundary the planner won’t push filters or joins across.'],
      ['RETURNING', 'Makes INSERT/UPDATE/DELETE output the affected rows.']
    ]
  },
  visual: {
    title: 'Pushed down or blocked?',
    caption: 'Same query, six variants. Watch whether <code>customer_id = 42</code> reaches the index scan (inlined) or stops at the CTE boundary (materialized), and how many rows that costs.'
  },
  extras: [
    { id: 'ctes-snapshot', title: 'Data-modifying CTEs share one snapshot', label: 'snapshot', caption: 'Move old orders to an archive in one statement. Watch what each part can and can’t see.' }
  ],
  playground: {
    setup: `
CREATE TABLE orders (id int PRIMARY KEY, customer_id int, amount int, created date);
INSERT INTO orders SELECT g, g % 2000, (g * 37) % 500, date '2024-01-01' - (g % 700) FROM generate_series(1, 40000) g;
CREATE INDEX orders_customer_idx ON orders (customer_id);
CREATE TABLE archive (LIKE orders);
ANALYZE orders;`,
    presets: [
      { label: 'Readable chain', sql: `WITH totals AS (\n  SELECT customer_id, sum(amount) AS total FROM orders GROUP BY customer_id\n), ranked AS (\n  SELECT *, rank() OVER (ORDER BY total DESC) AS rnk FROM totals\n)\nSELECT * FROM ranked WHERE rnk <= 3 ORDER BY rnk;` },
      { label: 'Inlined (PG12+)', sql: `EXPLAIN (COSTS OFF)\nWITH o AS (SELECT * FROM orders)\nSELECT * FROM o WHERE customer_id = 42;`, note: 'No CTE Scan in the plan: the predicate became an index condition.' },
      { label: 'MATERIALIZED fence', sql: `EXPLAIN (COSTS OFF)\nWITH o AS MATERIALIZED (SELECT * FROM orders)\nSELECT * FROM o WHERE customer_id = 42;`, note: 'CTE Scan + Seq Scan: all 40,000 rows are materialized, then filtered.' },
      { label: 'Used twice', sql: `EXPLAIN (COSTS OFF)\nWITH o AS (SELECT * FROM orders)\nSELECT count(*) FROM o a JOIN o b USING (customer_id) WHERE a.customer_id = 42;\n\nEXPLAIN (COSTS OFF)\nWITH o AS NOT MATERIALIZED (SELECT * FROM orders)\nSELECT count(*) FROM o a JOIN o b USING (customer_id) WHERE a.customer_id = 42;`, note: 'Default: two references → materialized. NOT MATERIALIZED → inlined into both, and the predicate reaches both sides.' },
      { label: 'Move rows atomically', sql: `WITH moved AS (\n  DELETE FROM orders WHERE created < date '2022-03-01' RETURNING *\n), ins AS (\n  INSERT INTO archive SELECT * FROM moved RETURNING id\n)\nSELECT (SELECT count(*) FROM orders)  AS orders_seen_in_stmt,\n       (SELECT count(*) FROM ins)     AS archived;\n\nSELECT (SELECT count(*) FROM orders) AS orders_after,\n       (SELECT count(*) FROM archive) AS archive_after;`, note: 'Inside the statement, orders still counts 40,000: one snapshot. The second statement sees the result.' },
      { label: 'Volatile → not inlined', sql: `WITH r AS (SELECT random() AS v)\nSELECT (SELECT v FROM r) = (SELECT v FROM r) AS same_value;\n\nWITH r AS NOT MATERIALIZED (SELECT random() AS v)\nSELECT (SELECT v FROM r) = (SELECT v FROM r) AS same_value;`, note: 'Both return true: a CTE with a volatile function is never inlined, even with NOT MATERIALIZED. It runs once, so both reads agree.' }
    ]
  },
  gotchas: [
    { trap: 'Upgrading to PG12 changed plans', why: 'Code that used CTEs as a planner hint (“compute this first”) lost the fence. Some queries got much faster; a few got slower because the planner now picked a worse join order.', fix: 'Where the fence was intentional, write <code>AS MATERIALIZED</code> explicitly. Compare EXPLAIN on the hot queries before upgrading.' },
    { trap: 'Writing CTEs for readability on PG11 and older', why: 'Every CTE was materialized: filters in the outer query never reached the inner scan.', fix: 'On old versions use subqueries for performance-critical paths. On PG12+ it’s fine.' },
    { trap: 'Expecting a later sub-statement to see an earlier one’s changes', code: `WITH u AS (UPDATE stock SET qty = qty - 1 WHERE id = 7)\nSELECT qty FROM stock WHERE id = 7;   -- old qty!`, why: 'All sub-statements read the same snapshot taken at statement start.', fix: 'Return what you need with <code>RETURNING</code> and read it from the CTE, not from the table.' },
    { trap: 'Modifying the same row twice in one statement', why: 'Two sub-statements updating one row: only one change happens, and which one is not reliably predictable. Postgres doesn’t raise an error for it.', fix: 'Structure the statement so each row is touched once, or split it into two statements.' },
    { trap: 'A huge materialized CTE spills to disk', why: 'A CTE referenced twice (or MATERIALIZED) stores all rows in a tuplestore; past work_mem it goes to temp files, and it has no indexes for the outer query to use.', fix: 'Filter inside the CTE, use NOT MATERIALIZED if recomputing is cheaper, or use a real temp table with an index and ANALYZE.' },
    { trap: 'Data-modifying CTE that nobody reads still runs', why: 'It is executed exactly once, to completion, whether or not the outer query references it, unlike a SELECT CTE that can be skipped.', fix: 'That’s a feature for “do X and Y atomically”. Just don’t put a DELETE in a CTE you “might” use.' }
  ],
  scenarios: [
    { title: 'Customer page: 8 ms in staging, 14 s in production',
      symptom: 'A query written as a chain of CTEs was fast on a tiny staging DB and terrible in production. Production ran PG11.',
      diagnose: `EXPLAIN (ANALYZE, BUFFERS)\nWITH o AS (SELECT * FROM orders) SELECT * FROM o WHERE customer_id = $1;\n-- CTE Scan on o  (rows=12)  Filter: customer_id = $1  Rows Removed: 48M\n--   -> Seq Scan on orders`,
      cause: 'Pre-PG12 every CTE was a fence. The customer filter couldn’t reach the index; 48M rows were materialized per request.',
      fix: 'Inline the CTE as a subquery (or upgrade to PG12+, where it’s inlined automatically).',
      fixCode: `SELECT * FROM (SELECT * FROM orders) o WHERE customer_id = $1;` },
    { title: 'After the PG14 upgrade a batch report went from 2 min to 50 min',
      symptom: 'Nothing changed in the SQL. The plan now joined a 30M-row table first.',
      diagnose: `EXPLAIN WITH small AS (SELECT … complex filters …) SELECT … FROM small JOIN big …;\n-- the CTE is gone from the plan: it was inlined and the row estimate is 1, actual 400k`,
      cause: 'The author had relied on the old fence to force “compute this first”. Once inlined, a bad selectivity estimate led to a nested loop over 400k rows.',
      fix: 'Restore the intended behaviour explicitly, then fix the estimate (extended statistics on correlated columns).',
      fixCode: `WITH small AS MATERIALIZED (SELECT …)\n…;\nCREATE STATISTICS s_dep (dependencies) ON country, region FROM big;` },
    { title: 'Inventory went negative after a “single-statement” reservation',
      symptom: 'A CTE decremented stock and a second sub-statement checked <code>qty &gt;= 0</code> before inserting the reservation. Stock still went below zero.',
      diagnose: `WITH dec AS (UPDATE stock SET qty = qty - $2 WHERE sku = $1)\nINSERT INTO reservations SELECT … WHERE (SELECT qty FROM stock WHERE sku = $1) >= 0;`,
      cause: 'The check read the snapshot from before the UPDATE, so it always saw the old quantity.',
      fix: 'Put the condition in the UPDATE itself and chain on RETURNING; zero rows returned means no stock.',
      fixCode: `WITH dec AS (\n  UPDATE stock SET qty = qty - $2\n  WHERE sku = $1 AND qty >= $2\n  RETURNING sku)\nINSERT INTO reservations (sku, n) SELECT sku, $2 FROM dec;` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does <code>orders_seen</code> return? (orders has 40,000 rows; customer 1 has 20.)', code: `WITH d AS (DELETE FROM orders WHERE customer_id = 1 RETURNING 1)\nSELECT (SELECT count(*) FROM orders) AS orders_seen, (SELECT count(*) FROM d) AS deleted;`, options: ['39,980', '40,000', '20', 'Error'], answer: 1, explain: 'Same snapshot for every part of the statement: the DELETE is invisible to the outer SELECT. <b>40,000</b> (and deleted = 20).' },
    { kind: 'predict', q: 'Nothing reads <code>d</code>. How many rows does customer 2 have afterwards?', code: `WITH d AS (DELETE FROM orders WHERE customer_id = 2 RETURNING *)\nSELECT 1;\nSELECT count(*) FROM orders WHERE customer_id = 2;`, options: ['20', '0', 'Error: unused CTE', 'Depends on the planner'], answer: 1, explain: 'Data-modifying CTEs always run to completion, referenced or not: <b>0</b>.' },
    { kind: 'predict', q: 'Result?', code: `WITH r AS (SELECT random() AS v)\nSELECT (SELECT v FROM r) = (SELECT v FROM r) AS same;`, options: ['true', 'false', 'NULL', 'random'], answer: 0, explain: 'A CTE with a volatile function is never inlined: random() runs once and both reads see the same value: <b>true</b>.' },
    { kind: 'predict', q: 'And with NOT MATERIALIZED?', code: `WITH r AS NOT MATERIALIZED (SELECT random() AS v)\nSELECT (SELECT v FROM r) = (SELECT v FROM r) AS same;`, options: ['true', 'false (almost always)', 'Error', 'NULL'], answer: 0, explain: 'Still <b>true</b>. The planner never inlines a CTE that contains volatile functions, and NOT MATERIALIZED does not override that rule. It only overrides the “referenced more than once” rule.' },
    { kind: 'concept', q: 'On PG16, <code>WITH o AS (SELECT * FROM orders) SELECT * FROM o a JOIN o b ON …</code>. What does the planner do with o by default?', options: ['Inline into both references', 'Materialize once and scan the tuplestore twice', 'Error: CTE referenced twice', 'Create a temp table with indexes'], answer: 1, explain: 'More than one reference → materialized by default. Use NOT MATERIALIZED to inline.' },
    { kind: 'concept', q: 'Two sub-statements in one WITH both UPDATE row id = 7. What happens?', options: ['Both apply in textual order', 'Error: row modified twice', 'Only one takes effect, which one is not reliably predictable', 'Deadlock'], answer: 2, explain: 'Postgres documents this as unsupported: one modification wins, without an error.' }
  ],
  interview: [
    { q: 'What changed for CTEs in Postgres 12?', a: '<p>Before 12, every CTE was materialized: an optimization fence. From 12, a non-recursive, side-effect-free CTE referenced once is inlined as a subquery. <code>MATERIALIZED</code> / <code>NOT MATERIALIZED</code> let you choose explicitly.</p>', fu: 'When would you still want MATERIALIZED? (Expensive CTE used several times, or to stop a bad plan from pushing a predicate in.)', lvl: 'core' },
    { q: 'When is a CTE never inlined?', a: '<p>Recursive CTEs, data-modifying CTEs, CTEs containing volatile functions (even with NOT MATERIALIZED), CTEs referenced more than once (unless NOT MATERIALIZED), and explicit MATERIALIZED.</p>', lvl: 'core' },
    { q: 'Explain the snapshot semantics of data-modifying CTEs.', a: '<p>All sub-statements and the main query run with the same snapshot, taken at statement start. None can see the others’ effects on the target tables; the only channel is the RETURNING output. They execute concurrently-ish (order unpredictable), and the whole statement is atomic.</p>', lvl: 'deep' },
    { q: 'How would you move rows from one table to another atomically?', a: '<p><code>WITH moved AS (DELETE FROM t WHERE … RETURNING *) INSERT INTO archive SELECT * FROM moved;</code> One statement, one snapshot, all or nothing. For millions of rows, batch it with a LIMIT inside a <code>ctid</code>/<code>id IN (SELECT … LIMIT n)</code> subquery to keep transactions and WAL bursts small.</p>', lvl: 'core' },
    { q: 'CTE vs temp table vs view?', a: '<p>CTE: one statement, no indexes, no statistics if materialized (default row estimates). Temp table: survives the session, can be indexed and ANALYZEd, costs catalog churn. View: persistent named query, always inlined. Pick a temp table when an intermediate result is large and reused by several statements.</p>', lvl: 'deep' },
    { q: 'Is a CTE’s result cached between statements?', a: '<p>No. It exists only for the statement that defines it.</p>', lvl: 'core' },
    { q: 'Why might inlining make a query slower?', a: '<p>Inlining exposes the CTE to join reordering and predicate pushdown. With bad estimates (correlated columns, functions), the planner may choose a nested loop over a big input that the fence used to isolate. Fix estimates first; use MATERIALIZED as a targeted override.</p>', lvl: 'deep' },
    { q: 'Can the main query of a WITH be an UPDATE?', a: '<p>Yes. WITH can precede SELECT, INSERT, UPDATE, DELETE and (PG15+) MERGE. Data-modifying CTEs must be at the top level, not inside a subquery.</p>', lvl: 'core' },
    { q: 'How do you see whether a CTE was inlined?', a: '<p>EXPLAIN: an inlined CTE leaves no trace; a materialized one shows a <code>CTE o</code> subplan plus <code>CTE Scan on o</code> nodes.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Archive in one round trip (Spring Data)', lang: 'java', code: `@Modifying
@Transactional
@Query(value = """
  WITH moved AS (
    DELETE FROM orders WHERE id IN (
      SELECT id FROM orders WHERE created < :cutoff ORDER BY id LIMIT :batch)
    RETURNING *)
  INSERT INTO archive SELECT * FROM moved""", nativeQuery = true)
int archiveBatch(@Param("cutoff") LocalDate cutoff, @Param("batch") int batch);

// caller: while (repo.archiveBatch(cutoff, 5_000) > 0) { }  // each call = its own short tx`, note: 'The returned int is the INSERT’s row count. Loop with small batches to avoid long transactions holding back VACUUM.' },
    { title: 'Reserve stock without a read-check race', lang: 'java', code: `Integer reserved = jdbc.query("""
    WITH dec AS (
      UPDATE stock SET qty = qty - ? WHERE sku = ? AND qty >= ? RETURNING sku)
    INSERT INTO reservations (sku, n, order_id)
    SELECT sku, ?, ? FROM dec RETURNING 1""",
  rs -> rs.next() ? 1 : 0, n, sku, n, n, orderId);
if (reserved == 0) throw new OutOfStockException(sku);` }
  ]
});

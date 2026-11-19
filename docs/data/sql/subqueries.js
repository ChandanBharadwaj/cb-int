IA.register({
  track: 'sql',
  slug: 'subqueries',
  title: 'Subqueries',
  tagline: 'A subquery is a query used as a value, a list or a table inside another query. The question that matters in production: <b>how many times does it run?</b> Once, once per outer row, or not at all because the planner rewrote it into a join.',
  tldr: {
    problem: 'A harmless-looking <code>(SELECT … WHERE x.id = o.id)</code> in the SELECT list runs a million times. A scalar subquery that “always returns one row” returns two after a data fix and takes down an endpoint.',
    model: '<b>Uncorrelated</b> → runs once (InitPlan) or once into a hash (hashed SubPlan). <b>Correlated</b> → re-runs per outer row (SubPlan), unless the planner <b>pulls it up</b> into a join. EXISTS / IN usually get pulled up into semi joins; scalar subqueries and NOT IN mostly don’t.',
    hook: '“Why does EXPLAIN show <code>SubPlan 1 … loops=840000</code>?” Because a correlated scalar subquery was executed once per row.',
    facts: [
      { v: '> 1 row', l: 'from a scalar subquery is a runtime ERROR. 0 rows silently becomes NULL' },
      { v: 'semi join', l: 'what EXISTS and IN (subquery) usually become. NOT IN never becomes an anti join' },
      { v: 'NULL', l: 'what <code>x = ANY(…)</code> returns when nothing matches but the list holds a NULL' }
    ]
  },
  intro: {
    what: 'A <b>subquery</b> is a SELECT written inside parentheses inside another query. The inner query answers a small question (“what’s the average order?”, “which customers had refunds?”) and the outer query uses that answer as a value, a list to check against, or a temporary table.',
    analogy: { icon: '🪆', title: 'Asking a colleague mid-task', text: 'You’re filtering a list and need to know the average. You ask a colleague once and reuse the answer: uncorrelated. If instead you ask “what’s the average <i>for this customer</i>?” for every row, the colleague answers again each time: correlated.' },
    steps: [
      { t: 'A subquery as a value', d: 'Returns exactly one row and one column.', code: 'SELECT id FROM orders\nWHERE amount > (SELECT avg(amount) FROM orders);' },
      { t: 'A subquery as a list', d: 'Use <code>IN</code> or <code>EXISTS</code> to test membership.', code: 'SELECT * FROM orders o\nWHERE EXISTS (SELECT 1 FROM refunds r WHERE r.order_id = o.id);' },
      { t: 'A subquery as a table', d: 'In FROM, with an alias.', code: 'SELECT * FROM (SELECT customer_id, sum(amount) s\n              FROM orders GROUP BY 1) t WHERE s > 100;' },
      { t: 'Correlated = refers to the outer row', d: '<code>o.customer_id</code> inside the parentheses ties the inner query to the current outer row, so it is evaluated again for each one (unless the planner can rewrite it).' }
    ],
    widget: 'subqueries-intro',
    terms: [
      ['scalar subquery', 'Returns one value (one row, one column). Usable anywhere an expression is.'],
      ['correlated', 'References columns of the outer query; conceptually re-evaluated per outer row.'],
      ['InitPlan', 'EXPLAIN node for an uncorrelated subquery that runs once.'],
      ['SubPlan', 'EXPLAIN node for a subquery evaluated per row (or once into a hash: “hashed SubPlan”).'],
      ['semi join', 'A join that keeps each outer row at most once if any match exists. EXISTS becomes this.']
    ]
  },
  visual: {
    title: 'How often does the inner query run?',
    caption: 'Pick a query shape and press Play. Watch the inner-execution counter. Switch to “imagine 1,000,000” to see what the same shape costs at production scale.'
  },
  playground: {
    setup: `
CREATE TABLE customers (id int PRIMARY KEY, name text);
INSERT INTO customers SELECT g, 'c' || g FROM generate_series(1, 1000) g;
CREATE TABLE orders (id int PRIMARY KEY, customer_id int REFERENCES customers, amount int);
INSERT INTO orders SELECT g, 1 + g % 1000, (g * 7919) % 997 FROM generate_series(1, 20000) g;
CREATE INDEX ON orders (customer_id);
CREATE TABLE refunds (order_id int, reason text);
INSERT INTO refunds SELECT g, 'damaged' FROM generate_series(1, 20000, 97) g;
INSERT INTO refunds VALUES (NULL, 'manual adjustment');
ANALYZE;`,
    presets: [
      { label: 'Uncorrelated → InitPlan', sql: `EXPLAIN (COSTS OFF)\nSELECT id FROM orders WHERE amount > (SELECT avg(amount) FROM orders);`, note: 'InitPlan runs once; its result is a parameter <code>$0</code> (shown as <code>(InitPlan 1).col1</code> in PG17+).' },
      { label: 'Correlated → SubPlan', sql: `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)\nSELECT id FROM orders o\nWHERE amount > (SELECT avg(amount) FROM orders o2 WHERE o2.customer_id = o.customer_id);`, note: 'Look at <code>loops=</code> under SubPlan: one execution per outer row (20,000).' },
      { label: 'Rewrite: window', sql: `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)\nSELECT id FROM (\n  SELECT id, amount, avg(amount) OVER (PARTITION BY customer_id) AS cust_avg\n  FROM orders) s\nWHERE amount > cust_avg;`, note: 'One sort, one pass. Same result as the correlated version.' },
      { label: 'N+1 in SELECT', sql: `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)\nSELECT c.id,\n  (SELECT count(*) FROM orders o WHERE o.customer_id = c.id) AS n_orders,\n  (SELECT max(amount) FROM orders o WHERE o.customer_id = c.id) AS max_amt\nFROM customers c;`, note: 'Two SubPlans × 1,000 customers = 2,000 index lookups. A LEFT JOIN to a GROUP BY (or LATERAL) does it once.' },
      { label: 'Decorrelation', sql: `EXPLAIN (COSTS OFF)\nSELECT count(*) FROM orders o WHERE EXISTS (SELECT 1 FROM refunds r WHERE r.order_id = o.id);\n\nEXPLAIN (COSTS OFF)\nSELECT count(*) FROM orders o WHERE o.id IN (SELECT order_id FROM refunds);\n\nEXPLAIN (COSTS OFF)\nSELECT count(*) FROM orders o WHERE o.id NOT IN (SELECT order_id FROM refunds);`, note: 'EXISTS and IN → semi join (or a join on a de-duplicated inner side). NOT IN → hashed SubPlan, never an anti join.' },
      { label: 'ANY / ALL with NULL', sql: `SELECT 3 = ANY (ARRAY[1,2,NULL])    AS any_no_match,\n       1 = ANY (ARRAY[1,NULL])      AS any_match,\n       3 <> ALL (ARRAY[1,2,NULL])   AS all_with_null,\n       3 > ALL ('{}'::int[])        AS all_empty,\n       3 = ANY ('{}'::int[])        AS any_empty;`, note: 'A match makes ANY true regardless of NULLs. No match plus a NULL gives NULL. ALL over an empty set is true.' }
    ]
  },
  gotchas: [
    { trap: 'Scalar subquery returns more than one row', code: `SELECT o.id, (SELECT r.reason FROM refunds r WHERE r.order_id = o.id)\nFROM orders o;\n-- ERROR: more than one row returned by a subquery used as an expression`, why: 'It works for months until the first order gets a second refund. The error is raised at runtime, only for the rows that hit it.', fix: 'Say what you mean: <code>max(…)</code>, <code>string_agg</code>, <code>ORDER BY … LIMIT 1</code>, or a LATERAL join. Back it with a UNIQUE constraint if it really must be one row.' },
    { trap: 'Scalar subquery in SELECT = hidden N+1', why: 'Each correlated scalar subquery runs once per output row. Postgres doesn’t decorrelate scalar subqueries into joins.', fix: 'LEFT JOIN a pre-aggregated subquery, or use <code>LEFT JOIN LATERAL (…) ON true</code> that computes several columns in one go.' },
    { trap: 'NOT IN with a NULL in the subquery', code: `WHERE id NOT IN (SELECT order_id FROM refunds)  -- one NULL → 0 rows`, why: '<code>x &lt;&gt; ALL (list with NULL)</code> is NULL, never true. It also can’t be planned as an anti join.', fix: 'Use <code>NOT EXISTS</code>. It’s NULL-safe and becomes a Hash Anti Join.' },
    { trap: 'Correlated subquery referencing the wrong table', code: `SELECT * FROM orders o\nWHERE customer_id IN (SELECT customer_id FROM refunds);  -- refunds has no customer_id!`, why: 'An unqualified column that doesn’t exist in the inner table resolves to the <b>outer</b> table. The predicate becomes <code>o.customer_id IN (o.customer_id, …)</code>: true for every row with at least one refund row present.', fix: 'Always qualify columns inside subqueries: <code>r.customer_id</code> would have raised an error.' },
    { trap: 'Zero rows → NULL, silently', why: 'A scalar subquery that finds nothing yields NULL. <code>amount &gt; NULL</code> is unknown, so the row disappears from a WHERE without any error.', fix: 'COALESCE where a default makes sense, and test the empty case.' },
    { trap: 'IN (subquery) vs = ANY(array) are planned differently', why: '<code>IN (SELECT …)</code> can become a semi join. <code>= ANY($1::int[])</code> with a bound array is a filter or index condition on a fixed list, not a join.', fix: 'For a large id list passed from Java, <code>= ANY(?)</code> with one array parameter beats building a 5,000-placeholder IN list (one plan, no parse bloat).' }
  ],
  scenarios: [
    { title: 'Order history endpoint: p99 from 40 ms to 9 s after a feature',
      symptom: 'A new column “last refund reason” was added to the order list query. Big customers started timing out.',
      diagnose: `EXPLAIN (ANALYZE, BUFFERS) SELECT o.*,\n  (SELECT reason FROM refunds r WHERE r.order_id = o.id ORDER BY created DESC LIMIT 1)\nFROM orders o WHERE o.customer_id = $1;\n-- SubPlan 1 (actual rows=1 loops=84000)  -> Seq Scan on refunds`,
      cause: 'Correlated scalar subquery per order, and no index on <code>refunds.order_id</code>: 84,000 sequential scans.',
      fix: 'Add the index, and move the lookup into a LATERAL join so it is visible and reviewable.',
      fixCode: `CREATE INDEX CONCURRENTLY ON refunds (order_id, created DESC);\nSELECT o.*, r.reason FROM orders o\nLEFT JOIN LATERAL (SELECT reason FROM refunds r WHERE r.order_id = o.id\n                   ORDER BY created DESC LIMIT 1) r ON true\nWHERE o.customer_id = $1;` },
    { title: 'Invoice PDF job crashed on one customer',
      symptom: '<code>ERROR: more than one row returned by a subquery used as an expression</code>, only for one tenant, after an address-import script.',
      diagnose: `SELECT customer_id, count(*) FROM addresses\nWHERE kind = 'billing' GROUP BY 1 HAVING count(*) > 1;`,
      cause: 'The query assumed one billing address per customer: <code>(SELECT line1 FROM addresses WHERE customer_id = c.id AND kind = \'billing\')</code>. The import created duplicates; nothing enforced uniqueness.',
      fix: 'Enforce the assumption in the schema, then clean up the duplicates.',
      fixCode: `CREATE UNIQUE INDEX one_billing_address ON addresses (customer_id) WHERE kind = 'billing';` },
    { title: 'Bulk “delete orphaned files” deleted every file',
      symptom: 'A cleanup job removed all rows from <code>files</code>, not just the orphans.',
      diagnose: `DELETE FROM files WHERE id IN (SELECT id FROM attachments);\n-- attachments has file_id, not id: "id" resolved to files.id`,
      cause: 'The inner unqualified column fell back to the outer table, so the subquery returned <code>files.id</code> for every row of attachments: always true when attachments is non-empty. (It was also inverted logic: “IN” instead of “NOT EXISTS”.)',
      fix: 'Qualify every column in subqueries; run destructive jobs as SELECT count(*) first; use NOT EXISTS for “orphans”.',
      fixCode: `DELETE FROM files f\nWHERE NOT EXISTS (SELECT 1 FROM attachments a WHERE a.file_id = f.id);` }
  ],
  puzzles: [
    { kind: 'predict', q: 'refunds holds one row per refunded order, plus one manual row whose order_id is NULL. Result?', code: `SELECT count(*) FROM orders WHERE id NOT IN (SELECT order_id FROM refunds);`, options: ['19,793', '20,000', '0', 'Error'], answer: 2, explain: 'One NULL in the list makes <code>NOT IN</code> unknown for every id that isn’t found: <b>0</b>.' },
    { kind: 'predict', q: 'And with NOT EXISTS?', code: `SELECT count(*) FROM orders o\nWHERE NOT EXISTS (SELECT 1 FROM refunds r WHERE r.order_id = o.id);`, options: ['19,793', '20,000', '0', '19,794'], answer: 0, explain: '207 orders have a refund (1, 98, 195, …), so <b>19,793</b> don’t. The NULL row matches nothing and is harmless.' },
    { kind: 'bug', q: 'Add a second refund for order 1, then run this. What happens?', code: `INSERT INTO refunds VALUES (1, 'again');\nSELECT o.id, (SELECT reason FROM refunds r WHERE r.order_id = o.id) AS reason\nFROM orders o WHERE o.id <= 2;`, options: ['2 rows, reason for order 1 is arbitrary', '3 rows', 'ERROR: more than one row returned by a subquery', 'reason is NULL'], answer: 2, explain: 'A scalar subquery must return at most one row. Order 1 now has two refunds: runtime <b>error</b>.' },
    { kind: 'predict', q: 'Result?', code: `SELECT 3 = ANY (ARRAY[1, 2, NULL]) AS a, 3 > ALL ('{}'::int[]) AS b;`, options: ['false, false', 'NULL, true', 'false, true', 'NULL, NULL'], answer: 1, explain: 'No match but a NULL present → <b>NULL</b>. ALL over an empty set is vacuously <b>true</b>.' },
    { kind: 'predict', q: 'What do these scalar subqueries return for a customer id that has no orders?', code: `SELECT (SELECT max(amount) FROM orders WHERE customer_id = -1) AS a,\n       (SELECT amount FROM orders WHERE customer_id = -1) AS b;`, options: ['0 and 0', 'NULL and NULL', 'NULL and ERROR', '0 and NULL'], answer: 1, explain: '<code>max</code> over no rows is NULL; a scalar subquery that returns no rows is also NULL: <b>NULL, NULL</b>.' },
    { kind: 'concept', q: 'Which of these does Postgres 16 typically turn into a join?', options: ['WHERE x > (SELECT avg(…) … correlated)', 'WHERE EXISTS (SELECT 1 … correlated)', 'SELECT (SELECT count(*) … correlated)', 'WHERE id NOT IN (SELECT …)'], answer: 1, explain: 'EXISTS (and IN) sublinks are pulled up into semi joins. Correlated scalar subqueries and NOT IN stay SubPlans.' }
  ],
  interview: [
    { q: 'Correlated vs uncorrelated subquery?', a: '<p>Uncorrelated: independent of the outer row; Postgres runs it once (InitPlan) or once into a hash table (hashed SubPlan). Correlated: references outer columns; semantically evaluated per row, and executed per row unless the planner pulls it up into a join.</p>', lvl: 'core' },
    { q: 'Which subqueries does Postgres decorrelate?', a: '<p>EXISTS and <code>IN (SELECT …)</code> sublinks in WHERE/ON are pulled up into semi joins (NOT EXISTS → anti join) when the subquery is simple enough. Scalar subqueries (in SELECT or compared with &gt;, =) are not turned into joins; they stay SubPlans. NOT IN is never an anti join because of NULL semantics.</p>', fu: 'How do you spot it? (EXPLAIN: “SubPlan” vs “Semi Join”.)', lvl: 'deep' },
    { q: 'What happens if a scalar subquery returns 2 rows? 0 rows?', a: '<p>2 rows: runtime error “more than one row returned by a subquery used as an expression”. 0 rows: NULL. Both are data-dependent, so tests with tidy data won’t catch them.</p>', lvl: 'core' },
    { q: 'Why is a subquery in the SELECT list dangerous?', a: '<p>It runs once per output row, like an ORM N+1 but inside one statement, so APM tools see a single query. Fine for 20 rows with an index, terrible for 100k rows or without one. LEFT JOIN to an aggregate, or LATERAL, is a single pass.</p>', lvl: 'core' },
    { q: 'Explain ANY/ALL with NULLs.', a: '<p><code>x = ANY(S)</code>: true if any element equals x; else NULL if S contains NULL; else false. <code>x &lt;&gt; ALL(S)</code>: false if any equals; else NULL if S contains NULL; else true. <code>NOT IN</code> is <code>&lt;&gt; ALL</code>. Empty S: ANY → false, ALL → true.</p>', lvl: 'core' },
    { q: 'IN vs EXISTS in Postgres: is one faster?', a: '<p>For positive checks both usually become the same semi join. The difference is negative checks: NOT EXISTS → anti join and NULL-safe; NOT IN → hashed SubPlan (or a slow plain SubPlan if the hash doesn’t fit work_mem) with NULL surprises.</p>', lvl: 'core' },
    { q: 'How would you rewrite a correlated aggregate subquery?', a: '<p>Window function (<code>avg(x) OVER (PARTITION BY k)</code>) when comparing a row to its group; or join to a <code>GROUP BY</code> derived table; or LATERAL when you need top-N per row.</p>', lvl: 'core' },
    { q: 'What’s the outer-reference trap in subqueries?', a: '<p>An unqualified column missing from the inner tables resolves to an outer table, silently making the subquery correlated and often always-true. Qualify every column inside subqueries.</p>', lvl: 'deep' },
    { q: 'What’s a hashed SubPlan?', a: '<p>For an uncorrelated <code>IN</code>/<code>NOT IN</code> that wasn’t pulled up, Postgres runs the subquery once and stores the results in an in-memory hash table, then probes it per outer row. If the result wouldn’t fit in work_mem, it falls back to a plain SubPlan that rescans the subquery per row: catastrophically slow.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'JPQL subquery vs a join fetch', lang: 'java', code: `// generates a correlated scalar subquery per Customer row
@Query("""
  select new com.acme.CustomerStats(c.id,
      (select count(o) from Order o where o.customer = c))
  from Customer c""")
List<CustomerStats> statsSlow();

// one pass: left join + group by
@Query("""
  select new com.acme.CustomerStats(c.id, count(o))
  from Customer c left join c.orders o group by c.id""")
List<CustomerStats> statsFast();` },
    { title: 'Large id lists: one array parameter', lang: 'java', code: `// instead of IN (?, ?, ..., ?) with 5,000 placeholders:
List<Order> rows = jdbc.query(
    "SELECT * FROM orders WHERE id = ANY (?)",
    ps -> ps.setArray(1, ps.getConnection().createArrayOf("int8", ids.toArray())),
    orderMapper);`, note: 'One statement text means one cached prepared plan, and no 32,767-parameter limit of the wire protocol.' }
  ]
});

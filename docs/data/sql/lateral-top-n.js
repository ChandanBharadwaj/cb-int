IA.register({
  track: 'sql',
  slug: 'lateral-top-n',
  title: 'LATERAL joins & top-N per group',
  tagline: '<code>LATERAL</code> is a <b>for-each loop</b> in SQL: for every row on the left, run this subquery, which may refer to that row. Combine it with <code>ORDER BY … LIMIT n</code> and the right index, and “latest 3 orders per customer” costs 3 index reads per customer instead of a sort of the whole table.',
  tldr: {
    problem: '“Latest N per group” is one of the most common queries in any app (last 5 messages per chat, newest price per SKU). The obvious window-function version sorts every row in the table to keep a handful.',
    model: '<code>FROM customers c CROSS JOIN LATERAL (SELECT … WHERE o.customer_id = c.id ORDER BY created_at DESC LIMIT 3)</code> = a Nested Loop whose inner side is a parameterized <code>Limit → Index Scan</code>. Cost ≈ customers × (one index descent + N rows).',
    hook: 'An inbox query took 4 s with ROW_NUMBER over 30M messages and 6 ms with LATERAL + an index on <code>(thread_id, created_at DESC)</code>. Same result.',
    facts: [
      { v: 'O(G·N)', l: 'rows read by LATERAL + LIMIT with a matching index (G groups, N per group) vs O(total rows) for ROW_NUMBER' },
      { v: 'ON true', l: 'is required syntax for <code>LEFT JOIN LATERAL</code>. It keeps outer rows whose subquery returns nothing' },
      { v: 'PG15+', l: 'window Run Condition stops emitting past rn ≤ N, but the WindowAgg still reads every input row' }
    ]
  },
  intro: {
    what: 'Normally each item in <code>FROM</code> is independent: a subquery there can’t see the other tables. <code>LATERAL</code> lifts that rule. A LATERAL subquery can use columns from the tables listed <b>before</b> it, so it runs once <b>per row</b> of those tables, like the body of a for-each loop.',
    analogy: { icon: '📬', title: 'Checking each mailbox', text: 'You walk down a row of mailboxes (customers). At each one you take out the <i>3 newest letters</i> (orders) and move on. You never pile all the letters of the street on one table and sort them. Because the letters in each box are already stacked newest-on-top (the index), you just grab the top 3.' },
    steps: [
      { t: 'The problem', d: '“For each customer, their 2 latest orders.” <code>GROUP BY</code> can’t return 2 rows per group, and a plain subquery in FROM can’t see <code>c.id</code>.' },
      { t: 'LATERAL = for each row', d: 'The subquery refers to <code>c.id</code>, so it is evaluated once per customer.', code: 'SELECT c.name, o.id, o.created_at\nFROM customers c\nCROSS JOIN LATERAL (\n  SELECT * FROM orders o\n  WHERE o.customer_id = c.id\n  ORDER BY o.created_at DESC\n  LIMIT 2) o;' },
      { t: 'Keep customers with no orders', d: 'CROSS JOIN LATERAL drops a customer whose subquery returns nothing. <code>LEFT JOIN LATERAL (…) o ON true</code> keeps them with NULLs.' },
      { t: 'Make it fast', d: 'An index whose order matches the subquery lets each loop read exactly 2 entries and stop.', code: 'CREATE INDEX ON orders (customer_id, created_at DESC);' }
    ],
    widget: 'lateral-top-n-intro',
    terms: [
      ['LATERAL', 'A FROM item that may reference columns of earlier FROM items. It is evaluated per outer row.'],
      ['top-N per group', 'The first N rows of each group by some order, e.g. latest 3 orders per customer.'],
      ['ON true', 'A join condition that is always true. The LATERAL subquery already did the matching.'],
      ['composite index', 'An index on several columns, sorted by the first, then the second… <code>(customer_id, created_at DESC)</code>.'],
      ['Nested Loop', 'A plan node: for each outer row, run the inner plan with that row’s values as parameters.']
    ]
  },
  visual: {
    title: 'Watch the loop: one subquery per customer',
    caption: 'For each customer, the LATERAL subquery runs with <code>c.id</code> plugged in. Toggle the index to see “read N entries and stop” vs “scan everything, sort, keep N”. Toggle <code>LEFT JOIN … ON true</code> to keep Chen, who has no orders. Watch the <b>rows read</b> counter.'
  },
  extras: [
    { id: 'lateral-top-n-compare', title: 'Three ways to do top-N per group', label: 'compare', caption: 'Pick N and the data shape. The table estimates rows read and sorted for each approach. Numbers are a model of the plan shapes Postgres produces (verified with EXPLAIN ANALYZE in the playground), not a benchmark.' }
  ],
  playground: {
    setup: `
CREATE TABLE customers (id int PRIMARY KEY, name text NOT NULL);
CREATE TABLE orders (id int PRIMARY KEY, customer_id int NOT NULL REFERENCES customers(id), created_at date NOT NULL, amount int);
INSERT INTO customers VALUES (1,'Asha'),(2,'Ben'),(3,'Chen'),(4,'Dina');
INSERT INTO orders VALUES
 (101,1,'2026-01-05',250),(102,1,'2026-02-11',80),(103,1,'2026-03-02',40),(104,1,'2026-03-02',15),
 (105,2,'2026-01-20',60),(106,2,'2026-02-28',90),
 (107,4,'2026-02-01',30),(108,4,'2026-02-15',70),(109,4,'2026-03-09',20);
CREATE INDEX orders_cust_created ON orders (customer_id, created_at DESC);
-- bigger copy for EXPLAIN
CREATE TABLE bc AS SELECT g AS id FROM generate_series(1,500) g;
CREATE TABLE bo AS SELECT g AS id, g % 500 + 1 AS customer_id, timestamptz '2026-01-01' + g * interval '1 minute' AS created_at FROM generate_series(1,20000) g;
ANALYZE;`,
    presets: [
      { label: 'LATERAL top-2', sql: `SELECT c.name, o.id, o.created_at\nFROM customers c\nCROSS JOIN LATERAL (\n  SELECT id, created_at FROM orders o\n  WHERE o.customer_id = c.id\n  ORDER BY created_at DESC, id DESC   -- tiebreaker!\n  LIMIT 2) o\nORDER BY c.name, o.created_at DESC;`, note: 'Chen has no orders and disappears. Asha’s 103 and 104 share a date, so the <code>id</code> tiebreaker decides.' },
      { label: 'LEFT … ON true', sql: `SELECT c.name, o.id, o.created_at\nFROM customers c\nLEFT JOIN LATERAL (\n  SELECT id, created_at FROM orders o\n  WHERE o.customer_id = c.id\n  ORDER BY created_at DESC, id DESC LIMIT 2) o ON true\nORDER BY c.name, o.created_at DESC;`, note: 'Chen is back with NULLs. <code>ON true</code> is mandatory syntax for LEFT JOIN.' },
      { label: 'ROW_NUMBER', sql: `SELECT name, id, created_at FROM (\n  SELECT c.name, o.id, o.created_at,\n         row_number() OVER (PARTITION BY o.customer_id\n                            ORDER BY o.created_at DESC, o.id DESC) AS rn\n  FROM customers c JOIN orders o ON o.customer_id = c.id) t\nWHERE rn <= 2\nORDER BY name, created_at DESC;`, note: 'Same rows. It numbers every order first, then filters. See <a href="window-ranking.html">Window functions</a>.' },
      { label: 'DISTINCT ON (top-1)', sql: `SELECT DISTINCT ON (o.customer_id) c.name, o.id, o.created_at\nFROM orders o JOIN customers c ON c.id = o.customer_id\nORDER BY o.customer_id, o.created_at DESC, o.id DESC;`, note: 'Postgres-only shortcut for N = 1. The ORDER BY must start with the DISTINCT ON expressions.' },
      { label: 'EXPLAIN plans', sql: `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)\nSELECT c.id, o.* FROM bc c\nCROSS JOIN LATERAL (SELECT * FROM bo WHERE bo.customer_id = c.id\n                    ORDER BY created_at DESC LIMIT 3) o;\n\nCREATE INDEX ON bo (customer_id, created_at DESC);\nANALYZE bo;\nEXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)\nSELECT c.id, o.* FROM bc c\nCROSS JOIN LATERAL (SELECT * FROM bo WHERE bo.customer_id = c.id\n                    ORDER BY created_at DESC LIMIT 3) o;`, note: 'Before: <code>Limit → Sort → Seq Scan (loops=500)</code>, the whole table scanned 500 times. After: <code>Limit → Index Scan (loops=500, rows=3)</code>.' },
      { label: 'LATERAL + function', sql: `-- functions in FROM are implicitly LATERAL\nSELECT c.name, d::date AS day\nFROM customers c,\n     generate_series(date '2026-03-01', date '2026-03-03', interval '1 day') d\nWHERE c.id <= 2\nORDER BY 1, 2;`, note: '<code>generate_series(…)</code> could also use <code>c</code>’s columns without writing LATERAL.' }
    ]
  },
  gotchas: [
    { trap: 'CROSS JOIN LATERAL silently drops groups with no rows', why: 'If the subquery returns 0 rows for a customer, there is nothing to pair with, so the customer vanishes, exactly like an inner join.', fix: '<code>LEFT JOIN LATERAL (…) x ON true</code>.' },
    { trap: 'Index column order doesn’t match the subquery', code: `CREATE INDEX ON orders (created_at DESC, customer_id);  -- wrong way round`, why: 'The loop needs “equality on customer_id, then ordered by created_at”. Only <code>(customer_id, created_at DESC)</code> gives an index range already in the right order, so Limit can stop after N entries.', fix: 'Equality columns first, then the ORDER BY columns in the same direction (or all reversed; btree can scan backwards).' },
    { trap: 'No tiebreaker: “latest 2” changes between runs', code: `ORDER BY created_at DESC LIMIT 2   -- two orders on the same date`, why: 'Ties are returned in whatever order the plan produces. A different plan (index vs sort) or a VACUUM can pick a different row.', fix: 'Add a unique column: <code>ORDER BY created_at DESC, id DESC</code>, and include it in the index.' },
    { trap: 'LATERAL over a huge outer side with no index', why: 'Without a matching index, each loop scans and sorts the child table: groups × table size. It is <i>worse</i> than ROW_NUMBER.', fix: 'Check EXPLAIN for <code>Limit → Index Scan</code> inside the Nested Loop. If you can’t add the index, use ROW_NUMBER.' },
    { trap: 'ROW_NUMBER filter in the same SELECT', code: `SELECT *, row_number() OVER (…) rn FROM orders WHERE rn <= 3;  -- ERROR`, why: 'Window functions are computed after WHERE, so <code>rn</code> doesn’t exist yet.', fix: 'Wrap it in a subquery or CTE and filter outside.' },
    { trap: 'DISTINCT ON with an ORDER BY that doesn’t lead with its keys', code: `SELECT DISTINCT ON (customer_id) * FROM orders ORDER BY created_at DESC;  -- ERROR`, why: 'DISTINCT ON keeps the first row of each group in ORDER BY order, so ORDER BY must start with the DISTINCT ON expressions.', fix: '<code>ORDER BY customer_id, created_at DESC, id DESC</code>. Re-sort in an outer query if you need another order.' }
  ],
  scenarios: [
    { title: 'Inbox endpoint: p95 4.2 s on “latest message per thread”',
      symptom: 'The mobile inbox lists a user’s 50 threads with each one’s newest message. Latency grew linearly with total message count, not with the number of threads shown.',
      diagnose: `EXPLAIN (ANALYZE, BUFFERS)\nSELECT * FROM (\n  SELECT m.*, row_number() OVER (PARTITION BY thread_id ORDER BY created_at DESC) rn\n  FROM messages m WHERE thread_id = ANY($1)) t WHERE rn = 1;\n-- WindowAgg ← Sort ← Bitmap Heap Scan: rows=180,000 to keep 50`,
      cause: 'ROW_NUMBER must read and sort every message of every thread before filtering to rn = 1.',
      fix: 'LATERAL with LIMIT 1 over the thread list, plus an index on <code>(thread_id, created_at DESC)</code>. 50 index descents, 50 rows read: 6 ms.',
      fixCode: `SELECT t.id, m.*\nFROM unnest($1::bigint[]) AS t(id)\nCROSS JOIN LATERAL (\n  SELECT * FROM messages m\n  WHERE m.thread_id = t.id\n  ORDER BY created_at DESC, id DESC LIMIT 1) m;\n\nCREATE INDEX CONCURRENTLY ON messages (thread_id, created_at DESC, id DESC);` },
    { title: 'Customer list missing 18% of accounts after a refactor',
      symptom: 'The admin “customers with last order” page lost every customer who had never ordered, right after it was rewritten with LATERAL.',
      diagnose: `SELECT count(*) FROM customers c\nWHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);  -- 18%`,
      cause: '<code>CROSS JOIN LATERAL</code> behaves like an inner join: an empty subquery drops the outer row.',
      fix: 'Use <code>LEFT JOIN LATERAL … ON true</code>. Add a test that the page row count equals <code>count(*) FROM customers</code>.',
      fixCode: `FROM customers c\nLEFT JOIN LATERAL (\n  SELECT id, created_at FROM orders o\n  WHERE o.customer_id = c.id\n  ORDER BY created_at DESC, id DESC LIMIT 1) last_o ON true` },
    { title: '“Latest price” flips between two values',
      symptom: 'A pricing API returned different prices for the same SKU on consecutive calls. Two price rows had the same <code>valid_from</code> after a bulk import.',
      diagnose: `SELECT sku, valid_from, count(*) FROM prices\nGROUP BY 1, 2 HAVING count(*) > 1;`,
      cause: '<code>ORDER BY valid_from DESC LIMIT 1</code> with a tie. Parallel plans and an index-vs-seqscan switch returned different rows.',
      fix: 'Add a deterministic tiebreaker, and a unique constraint on <code>(sku, valid_from)</code> if ties are invalid data.',
      fixCode: `ORDER BY valid_from DESC, id DESC LIMIT 1;\nALTER TABLE prices ADD CONSTRAINT prices_sku_from_uq UNIQUE (sku, valid_from);` }
  ],
  puzzles: [
    { kind: 'predict', q: 'How many rows? (Chen has no orders; Asha 4, Ben 2, Dina 3.)', code: `SELECT c.name, o.id FROM customers c\nCROSS JOIN LATERAL (\n  SELECT id FROM orders o WHERE o.customer_id = c.id\n  ORDER BY created_at DESC, id DESC LIMIT 2) o;`, options: ['6', '7', '8', '9'], answer: 0, explain: 'Asha 2 + Ben 2 + Dina 2 = <b>6</b>. Chen’s subquery is empty, so CROSS JOIN drops him.' },
    { kind: 'predict', q: 'Same, but LEFT JOIN LATERAL … ON true and LIMIT 3?', code: `SELECT c.name, o.id FROM customers c\nLEFT JOIN LATERAL (\n  SELECT id FROM orders o WHERE o.customer_id = c.id\n  ORDER BY created_at DESC, id DESC LIMIT 3) o ON true;`, options: ['8', '9', '10', '12'], answer: 1, explain: 'Asha 3 + Ben 2 (only has 2) + Chen 1 padded + Dina 3 = <b>9</b>.' },
    { kind: 'predict', q: 'Which order id is Asha’s “latest” here? (103 and 104 are both 2026-03-02.)', code: `SELECT o.id FROM customers c\nCROSS JOIN LATERAL (\n  SELECT id FROM orders o WHERE o.customer_id = c.id\n  ORDER BY created_at DESC, id ASC LIMIT 1) o\nWHERE c.name = 'Asha';`, options: ['102', '103', '104', 'Random'], answer: 1, explain: 'Ties on the date are broken by <code>id ASC</code>, so <b>103</b>. Without the tiebreaker, the answer would depend on the plan.' },
    { kind: 'bug', q: 'What happens?', code: `SELECT id, row_number() OVER (PARTITION BY customer_id ORDER BY created_at DESC) AS rn\nFROM orders WHERE rn <= 2;`, options: ['Top 2 per customer', 'All rows', 'ERROR: column "rn" does not exist', 'Top 2 overall'], answer: 2, explain: 'WHERE is evaluated before window functions, so the alias doesn’t exist yet: <b>ERROR</b>. Filter in an outer query.' },
    { kind: 'predict', q: 'Rows returned?', code: `SELECT DISTINCT ON (customer_id) customer_id, id\nFROM orders\nORDER BY customer_id, created_at DESC, id DESC;`, options: ['3', '4', '9', 'ERROR'], answer: 0, explain: 'One row per customer that has orders: Asha, Ben, Dina = <b>3</b>.' },
    { kind: 'concept', q: 'With an index on <code>(customer_id, created_at DESC)</code>, 1M customers and 200M orders, roughly how many index entries does LATERAL … LIMIT 3 read?', options: ['~3M', '~200M', '~1M', '~600M'], answer: 0, explain: 'One descent per customer, then 3 entries: about <b>3M</b> (plus the descents). ROW_NUMBER would read all 200M.' }
  ],
  interview: [
    { q: 'What does LATERAL do, and how is it executed?', a: '<p>It allows a FROM item to reference columns of preceding FROM items. Semantically it is a for-each: evaluate the subquery per outer row. The planner usually runs it as a <b>Nested Loop</b> with a parameterized inner plan. Simple LATERAL subqueries without LIMIT or aggregates can be pulled up and flattened into an ordinary join.</p>', lvl: 'core' },
    { q: 'Compare LATERAL + LIMIT, ROW_NUMBER, and DISTINCT ON for top-N per group.', a: '<p><b>LATERAL</b>: O(groups × N) with a matching index. Best when groups are few relative to rows, or you only need some groups. <b>ROW_NUMBER</b>: reads and sorts all rows (or reads them in index order). Best when you need most rows anyway, or N is large. <b>DISTINCT ON</b>: N = 1 only, Postgres-specific, reads all rows in order. Concise, and fine for small tables.</p>', fu: 'When is ROW_NUMBER faster? (When groups ≈ rows, e.g. most customers have 1–2 orders: millions of index descents cost more than one sequential sort.)', lvl: 'core' },
    { q: 'Why does the index have to be (customer_id, created_at DESC) and not (created_at, customer_id)?', a: '<p>The inner query is “equality on customer_id, ordered by created_at, stop after N”. A btree on <code>(customer_id, created_at)</code> stores each customer’s entries contiguously and already sorted, so Limit stops after N. With created_at first, one customer’s rows are scattered across the whole index. A btree can scan backwards, so ASC works too, but mixed directions (<code>a ASC, b DESC</code>) must match the index or be fully reversed.</p>', lvl: 'deep' },
    { q: 'What is the ROW_NUMBER “Run Condition” in PG15+?', a: '<p>For monotonic window functions (row_number, rank, dense_rank, count) with an outer filter such as <code>rn &lt;= 3</code>, the WindowAgg stops emitting rows once the condition becomes false. Without PARTITION BY it can stop entirely; with PARTITION BY it still has to read every input row to reach the next partition. It saves work above the window, not the scan or sort below it.</p>', lvl: 'deep' },
    { q: 'Why is LEFT JOIN LATERAL written with ON true?', a: '<p>The grammar requires a join condition for LEFT JOIN. The correlation already lives inside the subquery, so the condition is trivially true. It keeps outer rows with an empty subquery, padded with NULLs.</p>', lvl: 'core' },
    { q: 'Give non-top-N uses of LATERAL.', a: '<p>Calling a set-returning function per row (<code>jsonb_array_elements(t.payload)</code>, implicitly lateral); computing several derived columns once and reusing them; “nearest neighbor” with <code>ORDER BY geom &lt;-&gt; t.geom LIMIT 1</code>; pre-aggregating one child per parent to avoid fan-out.</p>', lvl: 'core' },
    { q: 'How does LATERAL help with join fan-out?', a: '<p>Joining a parent to two independent child tables multiplies rows. <code>LEFT JOIN LATERAL (SELECT sum(x) FROM child1 WHERE child1.pid = p.id) a ON true</code> aggregates each child per parent before combining them, so there is always exactly one row per parent. See <a href="join-fan-out.html">Join fan-out</a>.</p>', lvl: 'deep' },
    { q: 'When would LATERAL be slower than the alternative?', a: '<p>Without a supporting index (each loop sorts the child table); when the outer side has millions of rows and most of each group is needed anyway (millions of random index descents vs one sequential scan and sort); and when the planner misestimates the outer row count and picks a nested loop where a hash join plus window would be better.</p>', lvl: 'deep' },
    { q: 'How do you make top-N deterministic?', a: '<p>Make the ORDER BY total: append a unique column (<code>id</code>). Put it in the index too, so the index scan still yields rows in final order without an extra sort.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Spring Data native query: latest N per customer', lang: 'java', code: `public interface LastOrder { Long getCustomerId(); Long getOrderId(); Instant getCreatedAt(); }

@Query(value = """
  SELECT c.id AS customerId, o.id AS orderId, o.created_at AS createdAt
  FROM unnest(CAST(:ids AS bigint[])) AS c(id)
  LEFT JOIN LATERAL (
    SELECT id, created_at FROM orders o
    WHERE o.customer_id = c.id
    ORDER BY created_at DESC, id DESC
    LIMIT :n) o ON true
  """, nativeQuery = true)
List<LastOrder> lastOrders(@Param("ids") Long[] ids, @Param("n") int n);`, note: 'JPQL has no LATERAL, so use a native query. Recent Hibernate 6 versions support <code>join lateral</code> in HQL; check yours.' },
    { title: 'Flyway migration for the index', lang: 'sql', code: `-- V42__orders_customer_created_idx.sql
-- CONCURRENTLY can't run inside a transaction block:
-- make sure your migration tool runs this script outside one.
CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_customer_created_idx
  ON orders (customer_id, created_at DESC, id DESC);` }
  ]
});

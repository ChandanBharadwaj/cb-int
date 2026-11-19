IA.register({
  track: 'sql',
  slug: 'joins',
  title: 'Joins, visualized',
  tagline: 'A join is a <b>loop over row pairs</b> with a predicate. It isn’t a Venn diagram. Once you see it that way, outer joins, NULL padding, fan-out and the <code>ON</code> vs <code>WHERE</code> trap all make sense.',
  tldr: {
    problem: 'Most join bugs aren’t syntax errors. They are queries that run fine and return the <i>wrong number of rows</i>: lost customers, doubled revenue, orphans that vanish.',
    model: 'Conceptually: <code>for each left row → for each right row → keep the pair if ON is true</code>. An outer join then <b>adds back</b> any unmatched row, padded with NULLs. WHERE runs <b>after</b> that.',
    hook: '“Why did my LEFT JOIN turn into an INNER JOIN?” Because a WHERE on the right table throws away the NULL-padded rows.',
    facts: [
      { v: '|L|×|R|', l: 'rows a CROSS JOIN produces. Every other join is a filtered subset, plus NULL padding for outer joins' },
      { v: 'NULL ≠ NULL', l: 'NULL keys never match in <code>=</code>, so a guest order with <code>customer_id NULL</code> can only appear through RIGHT or FULL' },
      { v: '≤ 1×', l: 'per left row, a semi-join (EXISTS) never multiplies rows. An inner join can' }
    ]
  },
  intro: {
    what: 'A database stores information in <b>tables</b>, which are like spreadsheets with rows and columns. To avoid repeating data, related information lives in <b>separate tables</b>: customers in one, their orders in another. A <b>JOIN</b> puts them back together for a query, by matching rows that share a value (here, the customer’s id).',
    analogy: { icon: '🧩', title: 'Matching two lists by an ID', text: 'You have a class list (student id, name) and an exam-results list (student id, score). To print “name + score” you take each student, look up rows in the results list with the same id, and write the pair down. That lookup-and-pair is a join. Students who skipped the exam are what the <i>different join types</i> are about.' },
    steps: [
      { t: 'Why split data at all?', d: 'If every order row also stored the customer’s name and city, changing a city would mean updating hundreds of rows. So we store the customer once and orders point to it.' },
      { t: 'The link column', d: '<code>orders.customer_id</code> holds the <code>id</code> of a row in <code>customers</code>. This is a <b>foreign key</b>: a pointer from one table to another.' },
      { t: 'Join = pair rows where the link matches', d: 'The <code>ON</code> clause says which pairs to keep.', code: 'SELECT c.name, o.amount\nFROM customers c\nJOIN orders o ON o.customer_id = c.id;' },
      { t: 'What about rows with no partner?', d: 'A customer with no orders, or an order with no customer. <b>INNER</b> drops them, <b>LEFT</b> keeps the left side’s, <b>FULL</b> keeps both. Missing values are filled with <code>NULL</code>.' }
    ],
    widget: 'joins-intro',
    terms: [
      ['table / row / column', 'A grid of data; one row = one thing (a customer), one column = one attribute (name).'],
      ['primary key', 'The column that uniquely identifies a row, e.g. <code>customers.id</code>.'],
      ['foreign key', 'A column that points at another table’s primary key, e.g. <code>orders.customer_id</code>.'],
      ['NULL', 'A marker meaning “no value / unknown”. It is not zero or an empty string.'],
      ['alias (c, o)', 'A short nickname for a table inside one query: <code>customers c</code>.']
    ]
  },
  visual: {
    title: 'Watch the join loop',
    caption: 'Pick a join type and where the <code>status = \'paid\'</code> filter goes, then press Play. Lines show matches. Rows padded with NULLs are shown in grey. Rows struck through were removed by WHERE.'
  },
  playground: {
    setup: `
CREATE TABLE customers (id int PRIMARY KEY, name text NOT NULL, city text);
CREATE TABLE orders (id int PRIMARY KEY, customer_id int REFERENCES customers(id), amount numeric(10,2), status text);
CREATE TABLE shipments (id int PRIMARY KEY, order_id int REFERENCES orders(id), carrier text);
INSERT INTO customers VALUES (1,'Asha','Pune'),(2,'Ben','Austin'),(3,'Chen',NULL),(4,'Dina','Pune');
INSERT INTO orders VALUES (101,1,250,'paid'),(102,1,80,'refunded'),(103,2,40,'paid'),(104,NULL,99,'paid');
INSERT INTO shipments VALUES (1,101,'DHL'),(2,101,'FedEx'),(3,103,'UPS');`,
    presets: [
      { label: 'INNER', sql: `SELECT c.name, o.id AS order_id, o.amount\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\nORDER BY c.name, o.id;`, note: 'Chen and Dina have no orders, so they disappear. Guest order 104 disappears too.' },
      { label: 'LEFT', sql: `SELECT c.name, o.id AS order_id, o.amount\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nORDER BY c.name, o.id;`, note: 'Every customer is kept. Unmatched customers get NULLs on the orders side.' },
      { label: 'ON vs WHERE', sql: `-- filter in ON: still a LEFT JOIN\nSELECT c.name, o.id FROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'paid'\nORDER BY 1,2;\n\n-- filter in WHERE: silently an INNER JOIN\nSELECT c.name, o.id FROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nORDER BY 1,2;`, note: 'Compare the two grids: 4 rows vs 2.' },
      { label: 'FULL + COALESCE', sql: `SELECT COALESCE(c.name,'(guest)') AS who, o.id AS order_id\nFROM customers c\nFULL JOIN orders o ON o.customer_id = c.id\nORDER BY 1,2;` },
      { label: 'Fan-out bug', sql: `-- revenue per customer, "just add carrier info"\nSELECT c.name, SUM(o.amount) AS revenue\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\nLEFT JOIN shipments s ON s.order_id = o.id\nGROUP BY c.name ORDER BY 1;`, note: 'Asha shows 580, but her real revenue is 330: order 101 had 2 shipments, so it was counted twice.' },
      { label: 'Anti-join', sql: `-- customers with no orders: three ways\nSELECT name FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);\nSELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL;\nSELECT name FROM customers WHERE id NOT IN (SELECT customer_id FROM orders);  -- 0 rows! why?`, note: 'The last query returns 0 rows. Hint: order 104 has <code>customer_id NULL</code>.' }
    ]
  },
  gotchas: [
    { trap: 'WHERE on the right table kills a LEFT JOIN', code: `LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'   -- NULL = 'paid' → unknown → row dropped`, why: 'WHERE runs after the join. For padded rows <code>o.status</code> is NULL, the predicate is <i>unknown</i>, and the row is filtered out.', fix: 'Move the condition into <code>ON</code>, or write <code>WHERE o.status = \'paid\' OR o.id IS NULL</code> if you really mean that.' },
    { trap: 'COUNT(*) counts the NULL-padded row', code: `SELECT c.name, COUNT(*)      -- Chen: 1  ✗\n              , COUNT(o.id)   -- Chen: 0  ✓\nFROM customers c LEFT JOIN orders o ON ...`, why: 'An unmatched customer still produces one row, and <code>COUNT(*)</code> counts rows.', fix: 'Count a non-nullable column from the right side: <code>COUNT(o.id)</code>.' },
    { trap: 'Fan-out: a second 1-to-many join multiplies sums', why: 'Joining orders→shipments repeats each order once per shipment, so SUM(amount) inflates. DISTINCT doesn’t reliably fix it, because two different orders can have equal amounts.', fix: 'Aggregate each child first (in a subquery or LATERAL), then join. See <a href="join-fan-out.html">Join fan-out</a>.' },
    { trap: 'NULL keys never match', why: '<code>NULL = NULL</code> is unknown, not true. Rows with NULL foreign keys can only show up through RIGHT or FULL joins.', fix: 'Use <code>IS NOT DISTINCT FROM</code> when NULL should match NULL. It can stop index use, so measure first.' },
    { trap: 'NATURAL JOIN / USING drift', why: '<code>NATURAL</code> joins on <i>every</i> column with the same name. If someone adds <code>updated_at</code> to both tables, your join silently changes.', fix: 'Never use NATURAL in application code. Write <code>USING (id)</code> only when you own both schemas; otherwise write an explicit ON.' },
    { trap: 'Join order in the text ≠ execution order', why: 'For inner joins the planner reorders freely, up to <code>join_collapse_limit</code> (8). Outer joins limit the orders it can choose.', fix: 'Write joins for readability. Use EXPLAIN to see what actually runs. See <a href="join-algorithms.html">Join algorithms</a>.' }
  ],
  scenarios: [
    { title: 'Dashboard says 1,240 active customers. CRM says 1,900.',
      symptom: 'A “customers and their last paid order” report silently drops every customer who hasn’t paid yet.',
      diagnose: `SELECT c.id, o.id\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid';   -- the culprit`,
      cause: 'The right-side filter is in WHERE, so the LEFT JOIN behaves like an INNER JOIN.',
      fix: 'Move the filter into ON. Add a test that runs the report row count against <code>SELECT count(*) FROM customers</code>.',
      fixCode: `LEFT JOIN orders o\n  ON o.customer_id = c.id AND o.status = 'paid'` },
    { title: 'Finance: revenue up 38% after the “shipping columns” release',
      symptom: 'Nothing changed in sales, but monthly revenue jumped the day a join to <code>shipments</code> was added for a new column.',
      diagnose: `SELECT o.id, count(*) FROM orders o\nJOIN shipments s ON s.order_id = o.id\nGROUP BY o.id HAVING count(*) > 1;   -- split shipments`,
      cause: 'Split shipments make the join fan out 1→N, so <code>SUM(o.amount)</code> counts each order N times.',
      fix: 'Pre-aggregate the child or use LATERAL to pick a single row. Add a data test: SUM before and after the join must match.',
      fixCode: `LEFT JOIN LATERAL (\n  SELECT string_agg(carrier, ',') carriers\n  FROM shipments s WHERE s.order_id = o.id\n) s ON true` },
    { title: '“Customers without orders” email went to nobody',
      symptom: 'A re-engagement campaign selected 0 recipients the day a guest-checkout feature shipped.',
      diagnose: `SELECT count(*) FROM orders WHERE customer_id IS NULL;  -- > 0 since guest checkout`,
      cause: '<code>id NOT IN (SELECT customer_id …)</code>. One NULL in the subquery makes every comparison <i>unknown</i>, so no row qualifies.',
      fix: 'Use <code>NOT EXISTS</code>. It is NULL-safe, and Postgres plans it as a hash anti join.',
      fixCode: `WHERE NOT EXISTS (\n  SELECT 1 FROM orders o WHERE o.customer_id = c.id)` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Using the seed data (4 customers, orders 101–104 with 104 a guest order), how many rows does this return?', code: `SELECT * FROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id;`, options: ['3', '4', '5', '6'], answer: 2, explain: 'Asha matches 2 orders and Ben matches 1. Chen and Dina get one padded row each: 2+1+1+1 = <b>5</b>. Guest order 104 isn’t included because it is on the right side.' },
    { kind: 'predict', q: 'And FULL JOIN on the same data?', code: `SELECT * FROM customers c\nFULL JOIN orders o ON o.customer_id = c.id;`, options: ['5', '6', '7', '8'], answer: 1, explain: 'The 5 rows from the LEFT JOIN, plus orphan order 104 padded on the left side = <b>6</b>.' },
    { kind: 'predict', q: 'How many rows?', code: `SELECT * FROM customers c\nLEFT JOIN orders o ON c.city = 'Pune';`, options: ['4', '6', '10', '16'], answer: 2, explain: 'The ON clause doesn’t mention orders, so each Pune customer (Asha, Dina) pairs with all 4 orders (8 rows). Ben and Chen get one padded row each: <b>10</b>. The ON clause decides matches; it never removes left rows.' },
    { kind: 'bug', q: 'Which result does this return for Chen (no orders)?', code: `SELECT c.name, COUNT(*) AS n\nFROM customers c LEFT JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name;`, options: ['n = 0', 'n = 1', 'Chen is missing', 'n = NULL'], answer: 1, explain: 'The padded row exists, so <code>COUNT(*)</code> = 1. Use <code>COUNT(o.id)</code> to get 0.' },
    { kind: 'predict', q: 'Rows returned?', code: `SELECT name FROM customers\nWHERE id NOT IN (SELECT customer_id FROM orders);`, options: ['0', '2 (Chen, Dina)', '3', 'Error'], answer: 0, explain: 'Order 104 has a NULL customer_id. <code>3 NOT IN (1,1,2,NULL)</code> evaluates to unknown, so no row passes: <b>0 rows</b>.' },
    { kind: 'predict', q: 'Asha’s revenue from the fan-out preset (2 shipments on order 101)?', code: `SELECT SUM(o.amount) FROM customers c\nJOIN orders o ON o.customer_id = c.id\nLEFT JOIN shipments s ON s.order_id = o.id\nWHERE c.name = 'Asha';`, options: ['330', '580', '660', '250'], answer: 1, explain: 'Order 101 (250) appears twice (DHL, FedEx) and order 102 (80) appears once: 250+250+80 = <b>580</b>.' }
  ],
  interview: [
    { q: 'Explain the difference between a predicate in ON and in WHERE for a LEFT JOIN.', a: '<p>ON decides which right rows <i>match</i>. An unmatched left row is still kept, padded with NULLs. WHERE filters the <i>joined result</i>, so a condition on the right table discards the padded rows, and the query effectively becomes an INNER JOIN. For an INNER JOIN the two placements are equivalent, and the planner treats them the same way.</p>', fu: 'Is there any join type where ON and WHERE are equivalent? (Inner and cross joins.)', lvl: 'core' },
    { q: 'Why do Venn diagrams mislead people about joins?', a: '<p>Venn diagrams describe sets of <i>identical elements</i>. A join pairs rows from two different relations using an arbitrary predicate. It can multiply rows (1-to-many), and the result’s schema is the concatenation of both inputs. INTERSECT and EXCEPT are the true Venn operations.</p>', lvl: 'core' },
    { q: 'How would you find customers with no orders? Which way is best in Postgres?', a: '<p><code>NOT EXISTS</code> (planned as a <b>Hash Anti Join</b>) or <code>LEFT JOIN … WHERE o.customer_id IS NULL</code>. Watch out: testing a <i>different</i> right-side column such as <code>o.id IS NULL</code> may plan as a Hash Right Join + Filter instead of an anti join; see <a href="semi-anti-joins.html">Semi & anti joins</a>. Avoid <code>NOT IN</code> with a nullable subquery: one NULL makes it return nothing, and it cannot be planned as an anti join, so it falls back to a hashed or plain SubPlan.</p>', fu: 'What changes if orders.customer_id is NOT NULL? (NOT IN becomes correct, but it is still not planned as an anti join.)', lvl: 'deep' },
    { q: 'A query joins orders to two child tables and SUMs revenue. Results are too high. Diagnose it.', a: '<p>Fan-out: joining two independent 1-to-many children produces a product of their row counts per parent. Fix it by aggregating each child separately before joining, or by using LATERAL subqueries. <code>SUM(DISTINCT)</code> is wrong, because two different orders can have the same amount.</p>', lvl: 'core' },
    { q: 'When does the planner refuse to reorder joins?', a: '<p>Outer joins aren’t freely associative. Postgres reorders them only where identities allow it. Explicit JOIN syntax beyond <code>join_collapse_limit</code> (default 8), and FROM lists beyond <code>from_collapse_limit</code>, are kept in written order. Beyond <code>geqo_threshold</code> (12 relations) the genetic optimizer takes over.</p>', lvl: 'deep' },
    { q: 'What is a semi-join, and why can it be faster than an inner join plus DISTINCT?', a: '<p>A semi-join returns each left row <b>at most once</b> if any match exists, and stops scanning at the first match. An inner join plus DISTINCT produces every match and then sorts or hashes to remove duplicates, which costs more work and memory.</p>', lvl: 'core' },
    { q: 'How do you match rows where both keys can be NULL?', a: '<p><code>ON a.k IS NOT DISTINCT FROM b.k</code>. It cannot use hash or merge joins in older versions, and it often can’t use a plain index. Alternatives: <code>COALESCE(a.k, sentinel) = COALESCE(b.k, sentinel)</code> with an expression index, or model NULL away.</p>', lvl: 'deep' },
    { q: 'What does a self-join look like in practice?', a: '<p>Use it for hierarchies one level at a time (employee→manager), pair comparisons (<code>a.id &lt; b.id</code> to avoid pairing a row with itself and getting duplicates), or comparing each row to its predecessor. Window functions such as <code>LAG</code> usually replace the last case and are cheaper.</p>', lvl: 'core' },
    { q: 'What does a CROSS JOIN with a small table give you in real work?', a: '<p>It generates combinations: every store × every day (with <code>generate_series</code>) to fill gaps before a LEFT JOIN to facts, or every user × every feature flag. It is cheap when one side is tiny.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'JPA fetch join duplicates', lang: 'java', code: `// Hibernate 5: returns one Customer per ORDER row (fan-out)
@Query("select c from Customer c join fetch c.orders")
List<Customer> findAllWithOrders();

// fix (Hibernate 5): DISTINCT in JPQL; Hibernate 6 de-duplicates entities automatically
@Query("select distinct c from Customer c join fetch c.orders")
List<Customer> findAllWithOrdersDistinct();`, note: 'Never <code>join fetch</code> two collections (bags) at once: you get a MultipleBagFetchException or a Cartesian fan-out.' },
    { title: 'LEFT JOIN with a Spring Data projection', lang: 'java', code: `public interface CustomerOrderCount { String getName(); long getOrders(); }

@Query("""
  select c.name as name, count(o.id) as orders     -- count(o.id), not count(*)
  from Customer c left join c.orders o on o.status = 'paid'
  group by c.name""")
List<CustomerOrderCount> paidOrderCounts();` }
  ]
});

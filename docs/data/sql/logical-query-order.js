IA.register({
  track: 'sql',
  slug: 'logical-query-order',
  title: 'Logical query order',
  tagline: 'You write <code>SELECT</code> first, but it is evaluated <b>sixth</b>: FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT. That order explains alias errors, aggregate errors, and why LIMIT without ORDER BY is a coin toss.',
  tldr: {
    problem: '“column total does not exist”, “aggregate functions are not allowed in WHERE”, “must appear in the GROUP BY clause”, paging that skips rows: all symptoms of reading SQL top-to-bottom.',
    model: 'Each clause takes a relation and returns a relation. A clause can only see names produced by clauses <b>before</b> it in logical order. Aliases are born in SELECT, so only DISTINCT/ORDER BY (and Postgres’ GROUP BY extension) can use them.',
    hook: '“Why does <code>ORDER BY total</code> work but <code>WHERE total &gt; 50</code> fail?” Because WHERE runs before SELECT names the column.',
    facts: [
      { v: '6th', l: 'position of SELECT in the logical order. Window functions run between HAVING and DISTINCT' },
      { v: 'logical ≠ physical', l: 'the planner reorders freely (pushes filters into scans, stops early for LIMIT) as long as the result is the same' },
      { v: 'bare alias only', l: '<code>ORDER BY total</code> works; <code>ORDER BY total + 1</code> fails, because inside an expression only input columns are visible' }
    ]
  },
  intro: {
    what: 'A SQL query is a recipe of clauses. The database doesn’t run them in the order you type them. It first gathers the rows (FROM, JOIN), filters them (WHERE), groups them (GROUP BY, HAVING), then picks the columns to show (SELECT), and finally sorts and cuts the list (ORDER BY, LIMIT).',
    analogy: { icon: '🍳', title: 'A recipe card', text: 'The card’s title says “Pancakes for 2” (SELECT), but you can’t plate pancakes before you’ve fetched the ingredients (FROM), thrown out the bad eggs (WHERE), and mixed them in batches (GROUP BY). The name on top is the last thing that becomes real.' },
    steps: [
      { t: 'Gather: FROM and JOIN', d: 'Build one big set of rows from your tables.', code: 'FROM orders o\nJOIN customers c ON c.id = o.customer_id' },
      { t: 'Filter rows: WHERE', d: 'Drop individual rows you don’t want.', code: "WHERE o.status = 'paid'" },
      { t: 'Group and filter groups: GROUP BY, HAVING', d: 'Collapse rows into groups and compute totals, then drop groups.', code: 'GROUP BY c.city\nHAVING SUM(o.amount) > 50' },
      { t: 'Shape, sort, cut: SELECT, ORDER BY, LIMIT', d: 'Pick and name the output columns, sort them, keep the top few.', code: 'SELECT c.city, SUM(o.amount) AS total\n...\nORDER BY total DESC\nLIMIT 2' }
    ],
    terms: [
      ['clause', 'One part of a query: FROM, WHERE, GROUP BY…'],
      ['alias', 'A new name: <code>SUM(amount) AS total</code> or <code>orders o</code>.'],
      ['aggregate', 'A function over many rows: SUM, COUNT, AVG, MAX.'],
      ['group', 'A set of rows sharing the GROUP BY value, reduced to one output row.'],
      ['HAVING', 'A WHERE for groups, applied after aggregation.']
    ]
  },
  visual: {
    title: 'Rows flowing through the clauses',
    caption: 'Press Play to watch 9 orders shrink to 2 result rows. Struck-through rows are removed by that step. Try the alias variants of the filter to see exactly where they fail.'
  },
  playground: {
    setup: `
CREATE TABLE customers (id int PRIMARY KEY, name text NOT NULL, city text NOT NULL);
CREATE TABLE orders (id int PRIMARY KEY, customer_id int REFERENCES customers(id), amount numeric(10,2) NOT NULL, status text NOT NULL);
INSERT INTO customers VALUES (1,'Asha','Pune'),(2,'Ben','Austin'),(3,'Chen','Pune'),(4,'Dina','Oslo'),(5,'Eve','Lima');
INSERT INTO orders VALUES (101,1,250,'paid'),(102,1,80,'refunded'),(103,2,40,'paid'),(104,NULL,99,'paid'),
 (105,3,120,'paid'),(106,4,30,'paid'),(107,2,90,'paid'),(108,4,20,'refunded'),(109,5,60,'paid');`,
    presets: [
      { label: 'Full pipeline', sql: `SELECT DISTINCT c.city, SUM(o.amount) AS total\nFROM orders o\nJOIN customers c ON c.id = o.customer_id\nWHERE o.status = 'paid'\nGROUP BY c.city\nHAVING SUM(o.amount) > 50\nORDER BY total DESC\nLIMIT 2;`, note: 'Same query as the animation: Pune 370, Austin 130.' },
      { label: 'Alias in WHERE ✗', sql: `SELECT id, amount * 1.18 AS gross\nFROM orders\nWHERE gross > 100;`, note: 'ERROR: column "gross" does not exist. Fix: repeat the expression, or wrap in a subquery / LATERAL.' },
      { label: 'Alias via LATERAL ✓', sql: `SELECT o.id, x.gross\nFROM orders o\nCROSS JOIN LATERAL (SELECT o.amount * 1.18 AS gross) x\nWHERE x.gross > 100\nORDER BY x.gross DESC;`, note: 'LATERAL computes the expression in FROM, so WHERE can see it. Name it once, use it everywhere.' },
      { label: 'Alias in ORDER BY rules', sql: `SELECT id, amount AS a FROM orders ORDER BY a DESC LIMIT 3;     -- ok\nSELECT id, amount AS a FROM orders ORDER BY a + 0 DESC LIMIT 3; -- error`, note: 'A bare output name works. Inside an expression, ORDER BY only resolves input columns.' },
      { label: 'GROUP BY alias (PG ext.)', sql: `SELECT upper(c.city) AS city_u, count(*)\nFROM orders o JOIN customers c ON c.id = o.customer_id\nGROUP BY city_u ORDER BY 1;`, note: 'Postgres allows output names and ordinals in GROUP BY. It is not standard SQL.' },
      { label: 'Window after HAVING', sql: `SELECT c.city, SUM(o.amount) AS total,\n       rank() OVER (ORDER BY SUM(o.amount) DESC) AS rnk\nFROM orders o JOIN customers c ON c.id = o.customer_id\nWHERE o.status = 'paid'\nGROUP BY c.city\nHAVING SUM(o.amount) > 50;`, note: 'Oslo is filtered by HAVING before rank() runs, so ranks are 1, 2, 3 among the survivors.' }
    ]
  },
  gotchas: [
    { trap: 'Select alias in WHERE or HAVING', code: `SELECT amount * 1.18 AS gross FROM orders\nWHERE gross > 100;       -- column "gross" does not exist`, why: 'WHERE and HAVING are evaluated before SELECT creates the name. Postgres, unlike MySQL, doesn’t allow output aliases in HAVING.', fix: 'Repeat the expression, use a subquery/CTE, or compute it in <code>CROSS JOIN LATERAL (SELECT … AS gross)</code>.' },
    { trap: 'Aggregates in WHERE', code: `WHERE SUM(amount) > 50   -- aggregate functions are not allowed in WHERE`, why: 'Groups don’t exist yet when WHERE runs; it evaluates one row at a time.', fix: 'Row filters in WHERE, group filters in HAVING. Put row filters in WHERE whenever possible: fewer rows to aggregate.' },
    { trap: 'Alias inside an ORDER BY expression', code: `SELECT amount AS a FROM orders ORDER BY a + 0;  -- column "a" does not exist`, why: 'ORDER BY accepts a bare output column name or ordinal. In an expression, names are resolved against input columns only.', fix: 'Repeat the expression, use the ordinal (<code>ORDER BY 1</code>), or wrap in a subquery.' },
    { trap: 'Ambiguous names: GROUP BY and ORDER BY resolve differently', code: `SELECT upper(city) AS city FROM customers GROUP BY city ORDER BY city;`, why: 'When a name is both an input column and an output alias, GROUP BY picks the <b>input</b> column, while ORDER BY picks the <b>output</b> column. The query can group by one thing and sort by another.', fix: 'Never alias an expression with the name of an existing input column.' },
    { trap: 'LIMIT without ORDER BY', why: 'Logically, rows have no order before ORDER BY. Physically, results change with plans, parallel workers and synchronized seq scans.', fix: 'Always ORDER BY a unique key (add <code>id</code> as a tie-breaker) when paging.' },
    { trap: 'SELECT DISTINCT with ORDER BY on a hidden column', code: `SELECT DISTINCT city FROM customers ORDER BY name;`, why: 'ERROR: for SELECT DISTINCT, ORDER BY expressions must appear in select list. After DISTINCT, one city stands for many names, so “sort by name” is undefined.', fix: 'Add the column to SELECT, aggregate it (<code>ORDER BY min(name)</code> with GROUP BY), or use <code>DISTINCT ON</code>.' },
    { trap: 'Expecting a WHERE filter to run before a function in SELECT', code: `SELECT 1 / x FROM t WHERE x <> 0;   -- usually fine\nSELECT CASE WHEN x <> 0 THEN 1 / x END ...;  -- the guaranteed-safe form`, why: 'Logical order is a meaning, not a guarantee of evaluation order for every expression. The planner can inline, push down or reorder quals; constants can be folded early.', fix: 'Guard risky expressions with CASE, which Postgres documents as the way to control evaluation order (with caveats for constant folding of aggregates).' }
  ],
  scenarios: [
    { title: 'Infinite scroll shows duplicate and missing products',
      symptom: 'Users see the same product on page 2 and 3, and some products never appear.',
      diagnose: `SELECT id, price FROM products ORDER BY price LIMIT 20 OFFSET 40;\n-- many products share the same price`,
      cause: 'ORDER BY price isn’t unique. Rows with equal prices can come back in a different order on each query, so OFFSET windows overlap.',
      fix: 'Order by a unique key as the last tie-breaker, and prefer keyset pagination.',
      fixCode: `SELECT id, price FROM products\nWHERE (price, id) > ($1, $2)\nORDER BY price, id\nLIMIT 20;` },
    { title: 'Monthly revenue report is 20× too slow',
      symptom: 'A report filters cancelled orders with HAVING and takes minutes.',
      diagnose: `EXPLAIN SELECT customer_id, sum(amount)\nFROM orders GROUP BY customer_id, status\nHAVING status <> 'cancelled';`,
      cause: 'A row-level filter was written as HAVING, forcing extra grouping columns. (Postgres can move simple HAVING quals on grouped columns into WHERE, but the extra GROUP BY column changes the grouping itself.)',
      fix: 'Filter rows in WHERE before grouping; keep HAVING for aggregate conditions.',
      fixCode: `SELECT customer_id, sum(amount)\nFROM orders\nWHERE status <> 'cancelled'\nGROUP BY customer_id;` },
    { title: 'Dashboard “top cities” changes between refreshes',
      symptom: 'The top-3 list reshuffles though no data changed.',
      diagnose: `SELECT city, count(*) FROM customers GROUP BY city LIMIT 3;   -- no ORDER BY`,
      cause: 'LIMIT without ORDER BY. HashAggregate output order depends on hashing and memory, and can differ across plans and versions.',
      fix: 'ORDER BY the measure plus a tie-breaker.',
      fixCode: `ORDER BY count(*) DESC, city\nLIMIT 3` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What happens?', code: `SELECT id, amount * 2 AS dbl FROM orders WHERE dbl > 200;`, options: ['2 rows', '3 rows', 'ERROR: column "dbl" does not exist', 'ERROR: syntax error'], answer: 2, explain: 'WHERE is evaluated before SELECT defines <code>dbl</code>.' },
    { kind: 'predict', q: 'How many rows?', code: `SELECT c.city, SUM(o.amount) AS total\nFROM orders o JOIN customers c ON c.id = o.customer_id\nWHERE o.status = 'paid'\nGROUP BY c.city\nHAVING SUM(o.amount) > 50;`, options: ['2', '3', '4', '5'], answer: 1, explain: 'Paid totals: Pune 370, Austin 130, Lima 60, Oslo 30. HAVING &gt; 50 keeps <b>3</b>.' },
    { kind: 'predict', q: 'Does this run, and how many rows?', code: `SELECT status, count(*) AS n FROM orders GROUP BY status ORDER BY n DESC;`, options: ['ERROR: column "n" does not exist', '2 rows', '9 rows', '1 row'], answer: 1, explain: 'ORDER BY runs after SELECT, so the bare alias <code>n</code> is fine: paid 7, refunded 2 → <b>2 rows</b>.' },
    { kind: 'predict', q: 'What happens?', code: `SELECT status, count(*) AS n FROM orders GROUP BY status ORDER BY n * -1;`, options: ['2 rows, ascending by n', '2 rows, descending by n', 'ERROR: column "n" does not exist', 'ERROR: aggregate in ORDER BY'], answer: 2, explain: 'An alias is only recognized as a bare name in ORDER BY. Inside an expression it is looked up as an input column, which doesn’t exist.' },
    { kind: 'predict', q: 'Which city does this return?', code: `SELECT c.city, SUM(o.amount) AS total,\n       rank() OVER (ORDER BY SUM(o.amount)) AS r\nFROM orders o JOIN customers c ON c.id = o.customer_id\nWHERE o.status = 'paid'\nGROUP BY c.city HAVING SUM(o.amount) > 50\nORDER BY r LIMIT 1;`, options: ['Oslo', 'Lima', 'Austin', 'Pune'], answer: 1, explain: 'Window functions run after HAVING, so Oslo (30) is already gone. Smallest remaining total: Lima (60).' },
    { kind: 'predict', q: 'How many rows does this return? (order 104 has customer_id NULL)', code: `SELECT DISTINCT c.city\nFROM orders o LEFT JOIN customers c ON c.id = o.customer_id;`, options: ['4', '5', '6', '9'], answer: 1, explain: 'Four named cities (Pune, Austin, Oslo, Lima) plus one NULL from guest order 104. DISTINCT treats NULLs as equal, so they collapse to one row: <b>5</b>.' }
  ],
  interview: [
    { q: 'Give the logical order of a SELECT and use it to explain one common error.', a: '<p>FROM/JOIN → WHERE → GROUP BY → HAVING → window functions → SELECT → DISTINCT → ORDER BY → LIMIT/OFFSET. Example: <code>WHERE total &gt; 50</code> fails because <code>total</code> is defined in SELECT, which hasn’t run yet.</p>', fu: 'Where do window functions fit, and why can’t you filter on them in WHERE?', lvl: 'core' },
    { q: 'Why can ORDER BY use a select alias but not WHERE?', a: '<p>ORDER BY is evaluated after SELECT, over the output relation. Postgres resolves a bare ORDER BY name against output columns first, then input columns. An expression in ORDER BY resolves names against input columns only, so <code>ORDER BY alias + 1</code> fails.</p>', lvl: 'core' },
    { q: 'WHERE vs HAVING: when does it matter for performance?', a: '<p>WHERE filters before grouping, so fewer rows are aggregated and indexes can be used. HAVING filters after. Postgres moves HAVING quals that reference no aggregates into WHERE automatically, but only when that is semantically safe (e.g. not with grouping sets).</p>', lvl: 'deep' },
    { q: 'Does the database execute clauses in logical order?', a: '<p>No. Logical order defines the result. The planner pushes predicates into scans and below joins, reorders joins, uses indexes to provide ordering, does top-N heapsort for ORDER BY + LIMIT, and can stop a scan early. Any plan with the same result is allowed.</p>', lvl: 'core' },
    { q: 'How do you reuse a computed expression in WHERE without repeating it?', a: '<p>Wrap the query in a subquery or CTE (inlined since PG12 unless MATERIALIZED), or use <code>CROSS JOIN LATERAL (SELECT expr AS name)</code> so the name exists in FROM.</p>', lvl: 'core' },
    { q: 'What does “must appear in the GROUP BY clause or be used in an aggregate function” mean?', a: '<p>After GROUP BY, each output row represents a group. A non-grouped column may have many values per group, so SELECT can’t pick one. Exception: if you group by a table’s primary key, Postgres (9.1+) knows other columns of that table are functionally dependent and allows them.</p>', lvl: 'deep' },
    { q: 'Where does DISTINCT ON fit, and what does it need?', a: '<p>It runs at the DISTINCT step: keeps the first row of each group of the ON expressions, where “first” is defined by ORDER BY. The ORDER BY must start with the DISTINCT ON expressions. Classic use: latest row per key.</p>', lvl: 'deep' },
    { q: 'Why is OFFSET pagination both slow and unstable?', a: '<p>OFFSET still produces and discards the skipped rows (cost grows with page number), and without a unique total order rows can move between pages. Keyset pagination (<code>WHERE (k, id) &gt; ($1, $2) ORDER BY k, id LIMIT n</code>) is stable and uses an index.</p>', lvl: 'core' },
    { q: 'In which clause are set operations (UNION) applied relative to ORDER BY and LIMIT?', a: '<p>Each SELECT arm runs its own pipeline up to DISTINCT; then UNION/INTERSECT/EXCEPT combine them; a trailing ORDER BY/LIMIT applies to the combined result. To sort or limit an arm, parenthesize it.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'JPQL follows the same order', lang: 'java', code: `// fails: aliases from SELECT are not visible in WHERE/HAVING in JPQL either
@Query("select c.city as city, sum(o.amount) as total from Order o join o.customer c " +
       "where o.status = 'PAID' group by c.city having sum(o.amount) > :min order by total desc")
List<CityTotal> topCities(@Param("min") BigDecimal min, Pageable page);  // Pageable adds LIMIT/OFFSET`, note: 'If you pass a <code>Sort</code> in Pageable, make sure it ends with a unique column, or pages can overlap.' },
    { title: 'Keyset pagination with JdbcTemplate', lang: 'java', code: `List<Product> next = jdbc.query("""
    select id, price, name from products
    where (price, id) > (?, ?)
    order by price, id
    limit ?""", mapper, lastPrice, lastId, 20);` }
  ]
});

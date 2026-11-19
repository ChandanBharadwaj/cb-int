IA.register({
  track: 'sql',
  slug: 'grouping',
  title: 'GROUP BY, HAVING & grouping sets',
  tagline: '<code>GROUP BY</code> sorts rows into <b>buckets</b> and collapses each bucket to one row. <code>WHERE</code> throws rows away <i>before</i> bucketing, <code>HAVING</code> throws buckets away <i>after</i>. Add <code>FILTER</code>, <code>ROLLUP</code> and <code>GROUPING()</code> and one query replaces five.',
  tldr: {
    problem: 'Reports need totals per group, subtotals, conditional counts and “groups with more than X”. Written naively, that is several queries glued with UNION, CASE soup, or a HAVING that should have been a WHERE.',
    model: 'Order of evaluation: <code>FROM → WHERE → GROUP BY → aggregates → HAVING → SELECT → ORDER BY</code>. Each aggregate sees only the rows in its bucket that passed WHERE (and its own FILTER). Grouping sets run several GROUP BYs in one pass and mark subtotal rows with <code>GROUPING()</code>.',
    hook: 'A finance export showed a “NULL region” row that was actually the grand total, and someone added it to the regions: revenue double-counted in the board deck.',
    facts: [
      { v: 'WHERE < HAVING', l: 'WHERE filters rows before grouping (cheap, can use indexes); HAVING filters groups after aggregation' },
      { v: 'GROUPING() = 1', l: 'means “this NULL is a subtotal placeholder”. 0 means the NULL is real data' },
      { v: 'PG9.1+', l: 'allows selecting any column of a table when its primary key is in GROUP BY (functional dependency)' }
    ]
  },
  intro: {
    what: '<code>GROUP BY region</code> puts all rows with the same region into one bucket. Aggregate functions like <code>count(*)</code>, <code>sum(amount)</code> or <code>avg(amount)</code> then turn each bucket into a single number. The result has <b>one row per bucket</b>.',
    analogy: { icon: '🪙', title: 'Sorting coins into jars', text: 'You pour a bag of coins on the table and drop each one into a jar by country. Then you count each jar. Throwing foreign tokens away <i>before</i> sorting is WHERE. Putting aside jars with fewer than 10 coins <i>after</i> counting is HAVING.' },
    steps: [
      { t: 'Pick the bucket key', d: 'Every distinct value of the GROUP BY columns becomes one output row.', code: 'SELECT region, count(*), sum(amount)\nFROM sales\nGROUP BY region;' },
      { t: 'Filter rows first: WHERE', d: 'Only paid sales go into the buckets.', code: "WHERE status = 'paid'" },
      { t: 'Filter buckets after: HAVING', d: 'Keep only regions whose total is above 100. HAVING can use aggregates; WHERE cannot.', code: 'HAVING sum(amount) > 100' },
      { t: 'Only keys or aggregates in SELECT', d: 'Each output row is a whole bucket, so a plain column must be in GROUP BY (or be determined by it). Otherwise Postgres raises an error.' }
    ],
    widget: 'grouping-intro',
    terms: [
      ['aggregate', 'A function that turns many rows into one value: count, sum, avg, min, max, string_agg…'],
      ['group / bucket', 'All rows sharing the same GROUP BY values.'],
      ['HAVING', 'A filter on groups, evaluated after aggregation.'],
      ['FILTER (WHERE …)', 'Restricts the rows a single aggregate sees: <code>count(*) FILTER (WHERE status = \'paid\')</code>.'],
      ['ROLLUP', 'Adds subtotal rows and a grand total to a GROUP BY.']
    ]
  },
  visual: {
    title: 'Watch rows fall into buckets',
    caption: 'Each step routes one sales row: WHERE may reject it, otherwise it drops into its region’s bucket. Then aggregates are computed, HAVING removes buckets, and ROLLUP adds a grand-total row. Note the two different NULLs: a real “unknown region” bucket, and the total row.'
  },
  playground: {
    setup: `
CREATE TABLE sales (id int PRIMARY KEY, region text, product text, amount numeric NOT NULL, status text NOT NULL);
INSERT INTO sales VALUES
 (1,'EU','pen',50,'paid'),(2,'US','pen',120,'paid'),(3,'EU','ink',30,'refunded'),(4,NULL,'pen',40,'paid'),
 (5,'US','mug',20,'paid'),(6,'EU','mug',90,'paid'),(7,NULL,'ink',15,'refunded'),(8,'US','ink',60,'refunded');
CREATE TABLE customers (id int PRIMARY KEY, name text, city text);
CREATE TABLE orders (id int PRIMARY KEY, customer_id int REFERENCES customers(id), amount numeric);
INSERT INTO customers VALUES (1,'Asha','Pune'),(2,'Ben','Austin');
INSERT INTO orders VALUES (1,1,10),(2,1,20),(3,2,5);`,
    presets: [
      { label: 'WHERE vs HAVING', sql: `SELECT region, count(*) AS n, sum(amount) AS total\nFROM sales\nWHERE status = 'paid'          -- rows, before grouping\nGROUP BY region\nHAVING sum(amount) > 100       -- groups, after aggregation\nORDER BY region NULLS LAST;`, note: 'Paid totals: EU 140, US 140, NULL 40. HAVING keeps EU and US.' },
      { label: 'FILTER', sql: `SELECT region,\n       count(*)                                     AS all_rows,\n       count(*)    FILTER (WHERE status = 'paid')     AS paid_n,\n       sum(amount) FILTER (WHERE status = 'refunded') AS refunded\nFROM sales\nGROUP BY region\nORDER BY region NULLS LAST;`, note: 'One pass, several conditional aggregates. A FILTER that matches nothing gives <code>count = 0</code> but <code>sum = NULL</code>.' },
      { label: 'ROLLUP + GROUPING()', sql: `SELECT region, product, sum(amount) AS total,\n       GROUPING(region, product) AS g      -- bitmask: 0 detail, 1 subtotal, 3 grand total\nFROM sales\nGROUP BY ROLLUP (region, product)\nORDER BY region NULLS LAST, product NULLS LAST, g;`, note: 'Find the two kinds of NULL region: g = 0 or 1 is real data (unknown region), g = 3 is the grand total.' },
      { label: 'GROUPING SETS / CUBE', sql: `SELECT CASE WHEN GROUPING(region) = 1 THEN '(all)' ELSE coalesce(region, '(unknown)') END AS region,\n       CASE WHEN GROUPING(product) = 1 THEN '(all)' ELSE product END AS product,\n       sum(amount) AS total\nFROM sales\nGROUP BY GROUPING SETS ((region), (product), ())\nORDER BY 1, 2;`, note: 'Per region, per product and grand total in one query. <code>CUBE (region, product)</code> would add every combination too.' },
      { label: 'PK dependency', sql: `-- name and city are not in GROUP BY, but c.id is the PK: allowed (PG9.1+)\nSELECT c.id, c.name, c.city, sum(o.amount) AS spent\nFROM customers c JOIN orders o ON o.customer_id = c.id\nGROUP BY c.id\nORDER BY c.id;`, note: 'Try <code>GROUP BY c.name</code> instead: ERROR, city must appear in GROUP BY.' },
      { label: 'Ordered string_agg', sql: `SELECT region,\n       string_agg(product, ', ' ORDER BY amount DESC) AS by_amount,\n       array_agg(DISTINCT product ORDER BY product)    AS distinct_products\nFROM sales\nGROUP BY region\nORDER BY region NULLS LAST;`, note: 'Without ORDER BY inside the aggregate, the element order is unspecified and can change with the plan.' }
    ]
  },
  gotchas: [
    { trap: 'HAVING used as WHERE', code: `GROUP BY region HAVING region <> 'EU'`, why: 'It works, and the planner even pushes simple non-aggregate HAVING conditions down into WHERE, but it reads wrong and hides intent. Conditions on rows belong in WHERE.', fix: 'Use HAVING only for conditions on aggregates.' },
    { trap: 'Subtotal NULL vs data NULL', why: 'ROLLUP / CUBE / GROUPING SETS put NULL in the columns that are rolled up. If the data itself has NULLs, you can’t tell them apart, and code that does <code>coalesce(region, \'Total\')</code> labels unknown regions as “Total”.', fix: 'Use <code>GROUPING(col) = 1</code> to detect subtotal rows; never rely on IS NULL.' },
    { trap: 'sum() over zero rows is NULL, not 0', code: `sum(amount) FILTER (WHERE status = 'void')  -- NULL`, why: 'Every aggregate except count returns NULL for an empty input. Java then gets a null BigDecimal.', fix: '<code>coalesce(sum(amount), 0)</code>.' },
    { trap: 'Non-grouped column in SELECT', code: `SELECT region, product, sum(amount) FROM sales GROUP BY region;  -- ERROR`, why: 'Postgres refuses to pick an arbitrary product per region (MySQL without ONLY_FULL_GROUP_BY silently does). The exception: columns of a table whose PK is grouped.', fix: 'Add the column to GROUP BY, aggregate it, or group by the PK.' },
    { trap: 'string_agg / array_agg order is not guaranteed', why: 'Without ORDER BY inside the aggregate, elements come in whatever order the plan reads them. A parallel plan or new index changes the string, which breaks caches, snapshot tests and diffs.', fix: '<code>string_agg(x, \',\' ORDER BY x)</code>.' },
    { trap: 'count(col) vs count(*)', why: '<code>count(col)</code> skips NULLs. <code>count(DISTINCT col)</code> skips NULLs too. <code>GROUP BY col</code>, by contrast, puts all NULLs into one group.', fix: 'Choose deliberately: <code>count(*)</code> for rows, <code>count(col)</code> for non-null values.' },
    { trap: 'GROUP BY 1, 2 by position', why: 'Handy, but if someone inserts a column at the start of SELECT, the query groups by the wrong thing and may still run.', fix: 'Use column names in application code. Positions are fine in ad-hoc queries.' }
  ],
  scenarios: [
    { title: 'Board deck revenue counted the grand total twice',
      symptom: 'Regional revenue on a slide summed to 2× the company total. One region was labelled “Unknown”.',
      diagnose: `SELECT region, GROUPING(region) AS g, sum(amount)\nFROM sales GROUP BY ROLLUP (region);\n-- two rows with region NULL: g=0 (real unknown) and g=1 (grand total)`,
      cause: 'The export mapped every NULL region to “Unknown”, including the ROLLUP grand total. Then the spreadsheet summed all rows.',
      fix: 'Label rows with GROUPING(), and emit subtotal rows in a separate column or filter them out for exports meant to be summed.',
      fixCode: `SELECT CASE WHEN GROUPING(region) = 1 THEN 'TOTAL'\n            ELSE coalesce(region, 'Unknown') END AS region_label,\n       sum(amount)\nFROM sales GROUP BY ROLLUP (region);` },
    { title: 'Daily stats query: 14 s → 300 ms by moving one line',
      symptom: 'A “paid orders per merchant yesterday” job scanned months of data.',
      diagnose: `EXPLAIN SELECT merchant_id, count(*) FROM orders\nGROUP BY merchant_id, created_at::date\nHAVING created_at::date = current_date - 1;\n-- Seq Scan, HashAggregate over 90M rows`,
      cause: 'The filter sat in HAVING on <code>created_at::date</code>. Postgres does push such a non-aggregate HAVING down into WHERE, but the condition is on a cast expression, so the plain index on <code>created_at</code> can’t be used: months of rows are scanned to find one day.',
      fix: 'Filter rows in WHERE with a sargable range on the indexed column.',
      fixCode: `SELECT merchant_id, count(*) FROM orders\nWHERE created_at >= current_date - 1 AND created_at < current_date\nGROUP BY merchant_id;` },
    { title: 'Cache churn from string_agg',
      symptom: 'An ETag computed from a <code>string_agg(tag, \',\')</code> column changed on every deploy, invalidating CDN caches for 2M product pages.',
      diagnose: `SELECT product_id, string_agg(tag, ',') FROM product_tags GROUP BY 1 LIMIT 5;\n-- order differs between runs after a new index / parallel plan`,
      cause: 'Aggregate input order is undefined without ORDER BY inside the call.',
      fix: 'Order inside the aggregate.',
      fixCode: `string_agg(tag, ',' ORDER BY tag)` }
  ],
  puzzles: [
    { kind: 'predict', q: 'How many rows?', code: `SELECT region, sum(amount) FROM sales\nWHERE status = 'paid'\nGROUP BY region\nHAVING sum(amount) > 100;`, options: ['1', '2', '3', '4'], answer: 1, explain: 'Paid: EU 50+90 = 140, US 120+20 = 140, NULL 40. HAVING keeps <b>2</b>.' },
    { kind: 'predict', q: 'Same query, HAVING removed, WHERE removed. How many groups?', code: `SELECT region, count(*) FROM sales GROUP BY region;`, options: ['2', '3', '4', '8'], answer: 1, explain: 'EU, US and one group for NULL: <b>3</b>. GROUP BY puts all NULLs together.' },
    { kind: 'predict', q: 'How many rows does ROLLUP produce here?', code: `SELECT region, sum(amount) FROM sales\nGROUP BY ROLLUP (region);`, options: ['3', '4', '5', '6'], answer: 1, explain: '3 region groups (EU, US, NULL) + 1 grand total = <b>4</b>. Two of them show region NULL.' },
    { kind: 'predict', q: 'The only EU mug sale is paid. Result?', code: `SELECT sum(amount) FILTER (WHERE status = 'refunded') AS r\nFROM sales WHERE region = 'EU' AND product = 'mug';`, options: ['0', 'NULL', '90', 'ERROR'], answer: 1, explain: 'The only EU mug row is paid, so the filtered input is empty and sum returns <b>NULL</b>. count would return 0.' },
    { kind: 'bug', q: 'What happens?', code: `SELECT c.name, c.city, sum(o.amount)\nFROM customers c JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name;`, options: ['Works', 'ERROR: c.city must appear in GROUP BY', 'Returns NULL city', 'Picks an arbitrary city'], answer: 1, explain: 'Functional dependency only applies when the <b>primary key</b> is grouped. <code>name</code> isn’t a key: <b>ERROR</b>. <code>GROUP BY c.id</code> would work.' },
    { kind: 'predict', q: 'Result?', code: `SELECT string_agg(product, ',' ORDER BY amount DESC)\nFROM sales WHERE region = 'US';`, options: ['pen,ink,mug', 'ink,mug,pen', 'pen,mug,ink', 'mug,ink,pen'], answer: 0, explain: 'US rows: pen 120, mug 20, ink 60. By amount desc: <b>pen,ink,mug</b>.' }
  ],
  interview: [
    { q: 'What is the logical order of evaluation in a SELECT with GROUP BY?', a: '<p>FROM/JOIN → WHERE → GROUP BY → aggregates → HAVING → window functions → SELECT list → DISTINCT → ORDER BY → LIMIT. That is why WHERE can’t reference aggregates or select-list aliases, and why HAVING can reference aggregates.</p>', fu: 'Can ORDER BY use a select alias? (Yes; GROUP BY can too in Postgres, but WHERE and HAVING can’t.)', lvl: 'core' },
    { q: 'WHERE vs HAVING: when does it matter for performance?', a: '<p>WHERE reduces rows before aggregation and can use indexes. HAVING runs after every group has been built. Postgres moves HAVING conditions without aggregates into WHERE when it can (no grouping sets involved), but don’t rely on it: write row filters in WHERE.</p>', lvl: 'core' },
    { q: 'Explain FILTER vs CASE inside aggregates.', a: '<p><code>count(*) FILTER (WHERE paid)</code> is equivalent to <code>count(CASE WHEN paid THEN 1 END)</code> and to <code>sum(CASE WHEN paid THEN 1 ELSE 0 END)</code>, except for the result on empty input (NULL for sum). FILTER is clearer, works with any aggregate (including <code>array_agg</code> and ordered-set aggregates), and is SQL standard (PG9.4+).</p>', lvl: 'core' },
    { q: 'What are GROUPING SETS, ROLLUP and CUBE, and how are they executed?', a: '<p>GROUPING SETS lists several groupings computed in one query. <code>ROLLUP(a,b)</code> = sets (a,b), (a), (). <code>CUBE(a,b)</code> = all 4 subsets. Postgres runs them with a MixedAggregate / GroupAggregate that can serve several sets from one sort order, or hash several at once (PG10+). It is much cheaper than a UNION ALL of separate GROUP BYs, which would scan the table once per set.</p>', lvl: 'deep' },
    { q: 'How do you tell a subtotal NULL from a data NULL?', a: '<p><code>GROUPING(col)</code> returns 1 when col is aggregated away in this row (the NULL is a placeholder), and 0 when it is a real grouping value. With several arguments it returns a bitmask, e.g. <code>GROUPING(region, product)</code> = 3 for the grand total.</p>', lvl: 'core' },
    { q: 'Why can you select c.name when grouping by c.id?', a: '<p>Since PG9.1, if the GROUP BY contains the table’s primary key, all of that table’s columns are functionally dependent on it, so they are allowed in SELECT. It only works for the PK (not unique indexes or other keys) and for base tables, not views or subqueries. One consequence: dropping that PK fails while a view depends on it.</p>', lvl: 'deep' },
    { q: 'HashAggregate vs GroupAggregate?', a: '<p>HashAggregate builds a hash table of groups (no sort needed, memory ∝ number of groups). Since PG13 it spills to disk instead of exceeding memory. GroupAggregate needs input sorted by the keys (from an index or a Sort) and streams with constant memory. The planner chooses by estimated group count; a bad n_distinct estimate can make a hash spill heavily.</p>', lvl: 'deep' },
    { q: 'How do you make string_agg deterministic?', a: '<p>Put ORDER BY inside the call: <code>string_agg(x, \',\' ORDER BY x)</code>. Since PG16 the planner can also pre-sort input for ordered aggregates when that is cheaper. Without the clause, order depends on the plan.</p>', lvl: 'core' },
    { q: 'What does count(DISTINCT x) cost, and what are the alternatives?', a: '<p>Each group’s values are sorted (or hashed) to remove duplicates, which isn’t parallelized and can be slow. Alternatives: group by (key, x) in a subquery then count, or an approximate count with HyperLogLog extensions for dashboards.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Spring Data: aggregate projection with FILTER (native)', lang: 'java', code: `public interface RegionStats { String getRegion(); long getPaidCount(); BigDecimal getRefunded(); boolean isTotal(); }

@Query(value = """
  SELECT region,
         count(*) FILTER (WHERE status = 'paid')                      AS paidCount,
         coalesce(sum(amount) FILTER (WHERE status = 'refunded'), 0)  AS refunded,
         GROUPING(region) = 1                                         AS total
  FROM sales
  GROUP BY ROLLUP (region)""", nativeQuery = true)
List<RegionStats> regionStats();`, note: 'Return the <code>total</code> flag instead of letting the client guess from a null region.' },
    { title: 'JPQL: GROUP BY entity', lang: 'java', code: `// Hibernate expands "group by c" to all of c's columns (or its id where allowed)
@Query("select c, sum(o.amount) from Customer c join c.orders o group by c")
List<Object[]> spendPerCustomer();` }
  ]
});

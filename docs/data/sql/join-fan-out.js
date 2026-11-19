IA.register({
  track: 'sql',
  slug: 'join-fan-out',
  title: 'Join fan-out & double counting',
  tagline: 'Join a parent to a child with N rows and the parent is repeated <b>N times</b>. Join a second, independent child with M rows and it is repeated <b>N×M times</b>. Every SUM or COUNT over parent columns is now multiplied, and the query runs without any error.',
  tldr: {
    problem: 'The most common silent bug in analytics and reporting SQL: revenue, counts and averages inflated by a join that changes the <b>grain</b> (what one row means) of the result.',
    model: 'Each join multiplies rows by the match count per key. Aggregates are computed <i>after</i> all joins, so a parent value is summed once per child combination. Fix: <b>aggregate each child to the parent’s grain first</b>, then join 1:1.',
    hook: 'A dashboard showed $2.4M of revenue for a $1.1M month the day someone added “number of items” to it.',
    facts: [
      { v: 'N × M', l: 'rows per parent when joining two independent 1-to-many children (3 items × 2 payments = 6 rows)' },
      { v: 'DISTINCT', l: 'fixes COUNT, but <code>SUM(DISTINCT amount)</code> silently drops genuinely equal values. It is a band-aid' },
      { v: '1 row', l: 'per key after pre-aggregation: join on a unique key and the grain cannot grow' }
    ]
  },
  intro: {
    what: 'When you join an order to its items, you get <b>one row per item</b>, and the order’s columns (like its total) are copied onto each of those rows. That is correct and expected. The bug appears when you then <b>add up</b> the copied column: the order total gets counted once per item.',
    analogy: { icon: '🧾', title: 'Photocopied receipts', text: 'A receipt for $100 lists 3 items. To file each item, you photocopy the receipt 3 times. Now the folder holds 3 copies of “$100”. If the accountant sums the folder, the shop seems to have made $300. Nothing was wrong with the copies, only with summing them.' },
    steps: [
      { t: 'Grain = what one row means', d: '<code>orders</code>: one row per order. <code>order_items</code>: one row per item. After a join, the result has the <b>finer</b> grain: one row per item.' },
      { t: 'Parent columns repeat', d: 'Order 1 has 3 items, so its <code>total = 100</code> appears on 3 rows.', code: 'SELECT o.id, o.total, i.sku\nFROM orders o\nJOIN order_items i ON i.order_id = o.id;' },
      { t: 'Aggregates count the copies', d: '<code>SUM(o.total)</code> over those rows = 300, not 100. A second child table (payments) multiplies again.' },
      { t: 'Fix: aggregate first, then join', d: 'Reduce each child to one row per order before joining.', code: 'SELECT o.id, o.total, i.n_items\nFROM orders o\nJOIN (SELECT order_id, count(*) AS n_items\n      FROM order_items GROUP BY order_id) i\n  ON i.order_id = o.id;' }
    ],
    widget: 'join-fan-out-intro',
    terms: [
      ['grain', 'What a single row represents: one order, one item, one payment.'],
      ['fan-out', 'A join that produces several rows per left row (1-to-many).'],
      ['double counting', 'Summing a value that was copied onto several rows by a fan-out.'],
      ['bridge table', 'A table that links two others many-to-many, e.g. <code>product_tags(product_id, tag_id)</code>.'],
      ['pre-aggregation', 'Grouping a child table to the parent’s key before joining it.']
    ]
  },
  visual: {
    title: 'Watch rows multiply: 1 → N → N×M',
    caption: 'Three orders, their items and their payments. Pick a query shape and step through each order. Watch the row count, and the totals compared with the truth (paid = 200, items = 6). Red = wrong.'
  },
  playground: {
    setup: `
CREATE TABLE orders (id int PRIMARY KEY, customer text, total numeric NOT NULL);
CREATE TABLE order_items (id int PRIMARY KEY, order_id int REFERENCES orders(id), sku text, qty int);
CREATE TABLE payments (id int PRIMARY KEY, order_id int REFERENCES orders(id), amount numeric);
INSERT INTO orders VALUES (1,'Asha',100),(2,'Ben',50),(3,'Chen',50);
INSERT INTO order_items VALUES (1,1,'pen',1),(2,1,'ink',2),(3,1,'pad',1),(4,2,'mug',1),(5,3,'cap',1),(6,3,'hat',1);
INSERT INTO payments VALUES (1,1,60),(2,1,40),(3,2,50),(4,3,50);
-- many-to-many
CREATE TABLE products (id int PRIMARY KEY, name text, price numeric);
CREATE TABLE tags (id int PRIMARY KEY, name text);
CREATE TABLE product_tags (product_id int REFERENCES products(id), tag_id int REFERENCES tags(id), PRIMARY KEY (product_id, tag_id));
INSERT INTO products VALUES (1,'kettle',40),(2,'toaster',30);
INSERT INTO tags VALUES (1,'kitchen'),(2,'sale'),(3,'gift');
INSERT INTO product_tags VALUES (1,1),(1,2),(1,3),(2,1);`,
    presets: [
      { label: 'One child: OK rows, wrong SUM', sql: `SELECT sum(o.total) AS revenue, count(*) AS rows\nFROM orders o\nJOIN order_items i ON i.order_id = o.id;`, note: 'Real revenue is 200; this says 450. Order 1 (3 items) is counted 3 times, order 3 (2 items) twice.' },
      { label: 'Two children: N × M', sql: `SELECT o.id, count(*) AS rows,\n       sum(p.amount) AS paid_wrong, count(i.id) AS items_wrong\nFROM orders o\nJOIN order_items i ON i.order_id = o.id\nJOIN payments p    ON p.order_id = o.id\nGROUP BY o.id ORDER BY o.id;`, note: 'Order 1: 3 items × 2 payments = 6 rows. Paid shows 300 instead of 100; items shows 6 instead of 3.' },
      { label: 'DISTINCT band-aid', sql: `SELECT count(DISTINCT i.id)     AS items_ok,\n       sum(DISTINCT p.amount)   AS paid_still_wrong,\n       sum(p.amount)            AS paid_inflated\nFROM orders o\nJOIN order_items i ON i.order_id = o.id\nJOIN payments p    ON p.order_id = o.id;`, note: 'COUNT(DISTINCT id) is right (6). SUM(DISTINCT amount) = 150: payments of 50 on orders 2 and 3 collapse into one.' },
      { label: 'Fix: pre-aggregate', sql: `SELECT o.id, o.total, i.n_items, p.paid\nFROM orders o\nLEFT JOIN (SELECT order_id, count(*) AS n_items FROM order_items GROUP BY order_id) i ON i.order_id = o.id\nLEFT JOIN (SELECT order_id, sum(amount) AS paid FROM payments GROUP BY order_id) p ON p.order_id = o.id\nORDER BY o.id;`, note: 'One row per order, every number correct. Each derived table is unique on order_id, so joins are 1:1.' },
      { label: 'Fix: LATERAL / scalar', sql: `SELECT o.id, o.total,\n       (SELECT count(*) FROM order_items i WHERE i.order_id = o.id) AS n_items,\n       pay.paid\nFROM orders o\nLEFT JOIN LATERAL (SELECT sum(amount) AS paid FROM payments p WHERE p.order_id = o.id) pay ON true\nORDER BY o.id;`, note: 'Good when you only need a few parents (it runs per row). See <a href="lateral-top-n.html">LATERAL</a>.' },
      { label: 'Bridge table', sql: `-- "revenue by product" after adding tags to the report\nSELECT sum(p.price) AS catalogue_value FROM products p;\n\nSELECT sum(p.price) AS inflated\nFROM products p\nJOIN product_tags pt ON pt.product_id = p.id;\n\n-- fix: filter with EXISTS instead of joining\nSELECT sum(p.price) AS kitchen_value FROM products p\nWHERE EXISTS (SELECT 1 FROM product_tags pt JOIN tags t ON t.id = pt.tag_id\n              WHERE pt.product_id = p.id AND t.name IN ('kitchen','sale'));`, note: '70 → 150 because the kettle has 3 tags. EXISTS filters without multiplying.' },
      { label: 'Data test', sql: `-- 1) grain check: must return 0 rows\nSELECT order_id, count(*) FROM (\n  SELECT o.id AS order_id FROM orders o\n  JOIN order_items i ON i.order_id = o.id) t\nGROUP BY order_id HAVING count(*) > 1;\n\n-- 2) conservation check: totals must match\nSELECT (SELECT sum(total) FROM orders) AS source,\n       (SELECT sum(o.total) FROM orders o JOIN order_items i ON i.order_id = o.id) AS after_join;`, note: 'Test 1 finds orders 1 and 3. Test 2: 200 vs 450. Wire checks like these into CI (dbt <code>unique</code> tests, or a JUnit test against Testcontainers).' }
    ]
  },
  gotchas: [
    { trap: 'Adding “just one more column” from a child table', why: 'A report aggregated at order grain gets a join to a 1-to-many table for a new column. Grain changes, and every existing measure inflates.', fix: 'Before adding a join, state the result’s grain. If the new table is finer, pre-aggregate it or use a scalar subquery.' },
    { trap: 'COUNT(DISTINCT) as a fix', code: `SELECT count(DISTINCT i.id), sum(p.amount)  -- count fixed, sum still N×`, why: 'It hides the multiplication for counts only. It is also expensive (sort or hash per group) and masks the real bug.', fix: 'Fix the grain. Use COUNT(DISTINCT) only when you truly need a distinct count.' },
    { trap: 'SUM(DISTINCT) drops real values', why: 'Two different payments of 50 are both real money. <code>SUM(DISTINCT amount)</code> counts 50 once.', fix: 'Never use SUM(DISTINCT) to undo fan-out.' },
    { trap: 'AVG over fanned-out rows is weighted', why: '<code>AVG(o.total)</code> after joining items weights each order by its item count, so big baskets dominate. It looks plausible, which makes it worse.', fix: 'Compute AVG at the parent grain: aggregate children first.' },
    { trap: 'Joining on a non-unique “lookup” table', code: `JOIN exchange_rates r ON r.currency = o.currency   -- one row per day!`, why: 'A table you thought was 1 row per key has history, versions or soft-deleted duplicates.', fix: 'Join on the full unique key (<code>currency, rate_date</code>) and enforce it with a UNIQUE constraint.' },
    { trap: 'LEFT JOIN doesn’t prevent fan-out', why: 'LEFT JOIN only guarantees at least one row per left row. It still emits one row per match.', fix: 'For “at most one”, join to a unique key or use LATERAL … LIMIT 1.' },
    { trap: 'ORM fetch joins of two collections', why: 'Fetching <code>order.items</code> and <code>order.payments</code> in one query is the same N×M product: huge result sets, duplicated entities, or Hibernate’s MultipleBagFetchException.', fix: 'Fetch one collection per query, or use <code>@BatchSize</code> / subselect fetching.' }
  ],
  scenarios: [
    { title: 'Revenue dashboard doubled overnight',
      symptom: 'Monthly revenue showed $2.4M instead of ~$1.1M the morning after a release that added “items per order” to the dashboard query.',
      diagnose: `SELECT (SELECT sum(total) FROM orders WHERE created_at >= '2026-10-01') AS truth,\n       (SELECT sum(o.total) FROM orders o JOIN order_items i ON i.order_id = o.id\n        WHERE o.created_at >= '2026-10-01') AS dashboard;`,
      cause: 'The new <code>JOIN order_items</code> changed the grain from order to item. Average basket ≈ 2.2 items, so revenue ×2.2.',
      fix: 'Pre-aggregate items to one row per order. Add a conservation test that compares dashboard revenue with <code>sum(orders.total)</code>.',
      fixCode: `SELECT date_trunc('month', o.created_at) AS m, sum(o.total) AS revenue, sum(i.n) AS items\nFROM orders o\nLEFT JOIN (SELECT order_id, count(*) n FROM order_items GROUP BY 1) i ON i.order_id = o.id\nGROUP BY 1;` },
    { title: 'Commission payouts 3× too high for some reps',
      symptom: 'Sales reps with territory overlaps got triple commission. Finance caught it after payment.',
      diagnose: `SELECT rep_id, count(*) FROM rep_territories GROUP BY rep_id HAVING count(*) > 1;`,
      cause: 'Many-to-many through <code>rep_territories</code>: a deal in a region covered by 3 territory rows was joined 3 times before <code>SUM(deal.amount)</code>.',
      fix: 'Resolve the bridge to one row per deal (choose the owning territory, or use EXISTS for filtering) before aggregating.',
      fixCode: `SELECT d.rep_id, sum(d.amount)\nFROM deals d\nWHERE EXISTS (SELECT 1 FROM rep_territories rt\n              WHERE rt.rep_id = d.rep_id AND rt.region = d.region)\nGROUP BY d.rep_id;` },
    { title: 'API timeout: 40 orders turned into 1.2M rows',
      symptom: 'An order-detail endpoint using a JPA entity graph with items, payments and shipments timed out for B2B customers.',
      diagnose: `-- Hibernate SQL log: one SELECT with three LEFT JOINs\n-- rows ≈ Σ(items × payments × shipments) per order`,
      cause: 'Three independent collections fetched in one query: 300 items × 20 payments × 200 shipments for one big order.',
      fix: 'Fetch the root, then each collection separately (<code>@BatchSize</code> or <code>FetchMode.SUBSELECT</code>), or use DTO projections with pre-aggregated SQL.',
      fixCode: `@OneToMany(mappedBy = "order")\n@BatchSize(size = 50)\nprivate Set<Payment> payments;` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Revenue from orders (true total 200) after joining items (3, 1 and 2 per order)?', code: `SELECT sum(o.total) FROM orders o\nJOIN order_items i ON i.order_id = o.id;`, options: ['200', '300', '450', '600'], answer: 2, explain: '100×3 + 50×1 + 50×2 = <b>450</b>.' },
    { kind: 'predict', q: 'How many rows? (items 3/1/2, payments 2/1/1)', code: `SELECT * FROM orders o\nJOIN order_items i ON i.order_id = o.id\nJOIN payments p ON p.order_id = o.id;`, options: ['6', '7', '9', '10'], answer: 2, explain: 'Per order N×M: 3×2 + 1×1 + 2×1 = <b>9</b>.' },
    { kind: 'predict', q: 'The DISTINCT band-aid. Real payments total 200. Result?', code: `SELECT sum(DISTINCT p.amount) FROM orders o\nJOIN order_items i ON i.order_id = o.id\nJOIN payments p ON p.order_id = o.id;`, options: ['150', '200', '300', '450'], answer: 0, explain: 'Distinct amounts: 60, 40, 50 → <b>150</b>. The two genuine 50 payments merge into one.' },
    { kind: 'predict', q: 'Pre-aggregated: how many rows?', code: `SELECT o.id, i.n, p.paid FROM orders o\nJOIN (SELECT order_id, count(*) n FROM order_items GROUP BY 1) i ON i.order_id = o.id\nJOIN (SELECT order_id, sum(amount) paid FROM payments GROUP BY 1) p ON p.order_id = o.id;`, options: ['3', '6', '9', '4'], answer: 0, explain: 'Each derived table has one row per order_id, so every join is 1:1: <b>3</b> rows.' },
    { kind: 'predict', q: 'Bridge table: the kettle (40) has 3 tags, the toaster (30) has 1. Result?', code: `SELECT sum(p.price) FROM products p\nJOIN product_tags pt ON pt.product_id = p.id;`, options: ['70', '110', '150', '160'], answer: 2, explain: '40×3 + 30×1 = <b>150</b>.' },
    { kind: 'predict', q: 'AVG of order totals (true average 66.67) after joining items?', code: `SELECT round(avg(o.total), 2) FROM orders o\nJOIN order_items i ON i.order_id = o.id;`, options: ['66.67', '50.00', '75.00', '100.00'], answer: 2, explain: 'Rows: 100,100,100, 50, 50,50 → 450/6 = <b>75.00</b>. The 3-item order is weighted 3×, pulling the average up from 66.67.' }
  ],
  interview: [
    { q: 'What is join fan-out, and how do you recognize it?', a: '<p>A join where a key on one side matches several rows on the other, so the result’s grain becomes finer than the input. Symptoms: totals larger than the source, row count larger than the number of parents, and suspicious round multiples. Detect it with <code>count(*)</code> vs <code>count(DISTINCT parent_id)</code>, or by comparing <code>sum</code> before and after the join.</p>', lvl: 'core' },
    { q: 'Why do two 1-to-many joins multiply rather than add?', a: '<p>A join pairs every matching item with every matching payment for the same order: there is no relationship between items and payments, so all N×M combinations are produced. That is a per-key cross product.</p>', lvl: 'core' },
    { q: 'What are the correct fixes, and when do you pick each?', a: '<p>(1) Pre-aggregate each child in a derived table / CTE grouped by the parent key, then join: best for set-based reports. (2) LATERAL or scalar subqueries per parent: best for a few parents, with indexes on the child FK. (3) EXISTS when the child is only a filter. (4) Window functions when you need child rows and a parent total side by side.</p>', lvl: 'core' },
    { q: 'Why is COUNT(DISTINCT) a band-aid and SUM(DISTINCT) a bug?', a: '<p>COUNT(DISTINCT child.id) gives the right count because ids are unique, but the query still produces N×M rows, costs a sort/hash per group, and leaves every other measure wrong. SUM(DISTINCT amount) de-duplicates <i>values</i>, not rows, so genuine equal amounts are lost.</p>', lvl: 'core' },
    { q: 'How would you write a data test that catches fan-out?', a: '<p>Grain test: the model’s declared key must be unique (<code>GROUP BY key HAVING count(*) &gt; 1</code> returns 0 rows; dbt <code>unique</code>). Conservation test: a measure summed in the model equals the same measure in the source, within the same filter. Row-count test: model rows = parent rows for a parent-grain model.</p>', lvl: 'deep' },
    { q: 'How do you handle many-to-many relationships in reports?', a: '<p>Decide what the result grain is. To filter (“products tagged sale”) use EXISTS. To attribute (“revenue per tag”), accept that a product contributes to several tags and that tag totals don’t add up to the grand total, or allocate weights (1/number of tags). Never sum a product-level measure over a bridge join and call it the total.</p>', lvl: 'deep' },
    { q: 'Can the planner warn you about fan-out?', a: '<p>No. It is semantically valid SQL. EXPLAIN only hints at it: a join node whose estimated rows exceed its outer input. Unique constraints let you prove 1:1 joins. PG can also remove a LEFT JOIN entirely when the inner side is proven unique and unused.</p>', fu: 'What is join removal? (A LEFT JOIN to a unique key whose columns aren’t used is dropped from the plan.)', lvl: 'deep' },
    { q: 'How does fan-out show up in JPA / Hibernate?', a: '<p>Fetch joins of collections duplicate the root entity (Hibernate 5 needs <code>distinct</code>; Hibernate 6 de-duplicates automatically). Two bag collections in one fetch throw MultipleBagFetchException; two Sets are allowed but produce the Cartesian product. Pagination with a collection fetch join happens in memory (HHH90003004 warning).</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Spring Data: pre-aggregated DTO projection', lang: 'java', code: `public record OrderSummary(long id, BigDecimal total, long items, BigDecimal paid) {}

@Query(value = """
  SELECT o.id, o.total,
         coalesce(i.n, 0)    AS items,
         coalesce(p.paid, 0) AS paid
  FROM orders o
  LEFT JOIN (SELECT order_id, count(*) n FROM order_items GROUP BY order_id) i ON i.order_id = o.id
  LEFT JOIN (SELECT order_id, sum(amount) paid FROM payments GROUP BY order_id) p ON p.order_id = o.id
  WHERE o.customer_id = :customerId""", nativeQuery = true)
List<OrderSummary> summaries(@Param("customerId") long customerId);` },
    { title: 'JUnit + Testcontainers: conservation test', lang: 'java', code: `@Test
void reportDoesNotInflateRevenue() {
  BigDecimal source = jdbc.queryForObject("SELECT coalesce(sum(total),0) FROM orders", BigDecimal.class);
  BigDecimal report = jdbc.queryForObject("SELECT coalesce(sum(revenue),0) FROM monthly_revenue_v", BigDecimal.class);
  assertThat(report).isEqualByComparingTo(source);
}` }
  ]
});

IA.register({
  track: 'sql',
  slug: 'semi-anti-joins',
  title: 'Semi & anti joins: EXISTS, IN, NOT IN',
  tagline: '“Does a match exist?” is a different question from “give me the matches”. A <b>semi join</b> keeps each left row once and <b>stops at the first match</b>. An <b>anti join</b> keeps the rows with none. <code>NOT IN</code> looks like an anti join, but one NULL turns it into “return nothing”.',
  tldr: {
    problem: 'Filtering by the existence of related rows is everywhere (customers who ordered, users with no login, SKUs never sold). Written the wrong way, it duplicates rows, returns nothing because of a single NULL, or runs a subquery once per row.',
    model: 'For each outer row, probe the inner side. <b>Semi</b>: emit the row at the first match and stop probing. <b>Anti</b>: emit it only if the probe finds nothing. <code>NOT IN</code> is not an anti join: it is <code>x &lt;&gt; ALL(list)</code> under three-valued logic.',
    hook: '“The re-engagement campaign selected 0 users.” One guest order with <code>customer_id NULL</code> made <code>id NOT IN (SELECT customer_id …)</code> unknown for every customer.',
    facts: [
      { v: '≤ 1 row', l: 'per outer row from EXISTS / IN. A JOIN emits one row per match and can multiply' },
      { v: '1 NULL', l: 'in a NOT IN subquery makes the whole predicate unknown or false for every row: 0 rows back' },
      { v: 'SubPlan', l: 'is how NOT IN always runs (it is never an anti join). It is hashed only if the subquery result fits in work_mem' }
    ]
  },
  intro: {
    what: 'Often you don’t want data <i>from</i> another table. You only want to know whether a related row <b>exists</b>. “Customers who placed at least one order” is a <b>semi join</b>. “Customers who never ordered” is an <b>anti join</b>. SQL gives you several ways to write these. They look interchangeable, but they behave differently with duplicates and NULLs.',
    analogy: { icon: '🎟️', title: 'The guest list at the door', text: 'A bouncer checks each person against the list. As soon as he finds the name, he lets them in. He doesn’t read the rest of the list, and he doesn’t let them in twice because their name appears twice. That is EXISTS. Now imagine one line on the list is smudged and unreadable. “Is this person <i>not</i> on the list?” He can no longer be sure for anyone. That is NOT IN with a NULL.' },
    steps: [
      { t: 'EXISTS asks a yes/no question', d: 'The subquery runs “for” each customer. Its SELECT list doesn’t matter, only whether any row comes back.', code: 'SELECT name FROM customers c\nWHERE EXISTS (\n  SELECT 1 FROM orders o\n  WHERE o.customer_id = c.id);' },
      { t: 'IN does the same with a list', d: '<code>id IN (SELECT customer_id FROM orders)</code> keeps a customer if its id appears in the list. Duplicates in the list don’t duplicate the customer.' },
      { t: 'NOT EXISTS = “no partner at all”', d: 'Flip it to find customers without orders. This is the safe way to write an anti join.', code: 'WHERE NOT EXISTS (\n  SELECT 1 FROM orders o\n  WHERE o.customer_id = c.id)' },
      { t: 'Beware NOT IN', d: 'If the list contains a NULL, <code>3 NOT IN (1, 2, NULL)</code> is <b>unknown</b>, not true, and the row is filtered out. Use NOT EXISTS.' }
    ],
    widget: 'semi-anti-joins-intro',
    terms: [
      ['semi join', 'Keeps a left row once if at least one match exists. Never multiplies rows.'],
      ['anti join', 'Keeps a left row only if no match exists.'],
      ['correlated subquery', 'A subquery that refers to the outer row (<code>o.customer_id = c.id</code>).'],
      ['three-valued logic', 'SQL conditions can be true, false or <b>unknown</b> (anything compared with NULL). WHERE keeps only true.'],
      ['SubPlan', 'A subquery the planner could not turn into a join, so it is executed (or hashed) separately.']
    ]
  },
  visual: {
    title: 'Watch the probe: early exit, and the NOT IN NULL trap',
    caption: 'Pick a form and whether a guest order with <code>customer_id NULL</code> exists. Each step compares one customer with one order. Green = true, grey = false, amber = <b>unknown</b>. Faded orders were never looked at, thanks to the early exit. The plan box shows the node Postgres actually uses.'
  },
  playground: {
    setup: `
CREATE TABLE customers (id int PRIMARY KEY, name text NOT NULL);
CREATE TABLE orders (id int PRIMARY KEY, customer_id int REFERENCES customers(id), amount numeric(10,2));
INSERT INTO customers VALUES (1,'Asha'),(2,'Ben'),(3,'Chen'),(4,'Dina');
INSERT INTO orders VALUES (101,1,250),(102,2,40),(103,1,80),(104,NULL,99);  -- 104 = guest checkout
-- bigger pair for EXPLAIN
CREATE TABLE big_c AS SELECT g AS id FROM generate_series(1,20000) g;
CREATE TABLE big_o AS SELECT g AS id, CASE WHEN g % 50 = 0 THEN NULL ELSE (g*7) % 25000 END AS customer_id FROM generate_series(1,40000) g;
ANALYZE;`,
    presets: [
      { label: 'EXISTS vs JOIN', sql: `-- semi join: Asha once\nSELECT c.name FROM customers c\nWHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)\nORDER BY 1;\n\n-- inner join: Asha twice (2 orders)\nSELECT c.name FROM customers c JOIN orders o ON o.customer_id = c.id\nORDER BY 1;`, note: '2 rows vs 3 rows. EXISTS and IN never duplicate the outer row.' },
      { label: 'NOT IN trap', sql: `SELECT name FROM customers\nWHERE id NOT IN (SELECT customer_id FROM orders);   -- 0 rows!\n\nSELECT 3 NOT IN (1, 2, NULL) AS three_not_in;     -- NULL (unknown)`, note: 'Chen and Dina have no orders, yet 0 rows come back. The guest order’s NULL makes every comparison unknown.' },
      { label: 'Safe anti joins', sql: `SELECT name FROM customers c\nWHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)\nORDER BY 1;\n\nSELECT c.name FROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.id IS NULL\nORDER BY 1;\n\nSELECT name FROM customers\nWHERE id NOT IN (SELECT customer_id FROM orders WHERE customer_id IS NOT NULL)\nORDER BY 1;`, note: 'All three return Chen and Dina. Only the first two can be planned as an anti join.' },
      { label: 'Plan shapes', sql: `EXPLAIN (COSTS OFF) SELECT * FROM big_c c WHERE EXISTS (SELECT 1 FROM big_o o WHERE o.customer_id = c.id);\nEXPLAIN (COSTS OFF) SELECT * FROM big_c c WHERE NOT EXISTS (SELECT 1 FROM big_o o WHERE o.customer_id = c.id);\nEXPLAIN (COSTS OFF) SELECT * FROM big_c c WHERE id NOT IN (SELECT customer_id FROM big_o);`, note: 'Hash Semi Join, Hash (Right) Anti Join, and finally a Seq Scan with a <code>hashed SubPlan</code> filter. PG17+ prints it as <code>NOT (ANY (id = (hashed SubPlan 1).col1))</code>; PG16 prints <code>NOT (hashed SubPlan 1)</code>.' },
      { label: 'NOT IN spills', sql: `SET work_mem = '64kB';\nEXPLAIN (COSTS OFF)\nSELECT * FROM big_c c WHERE id NOT IN (SELECT customer_id FROM big_o);\nRESET work_mem;`, note: 'The word <code>hashed</code> disappears: the subquery is materialized and scanned <i>for every outer row</i>. That is O(N×M).' },
      { label: 'Empty list', sql: `SELECT NULL::int NOT IN (SELECT customer_id FROM orders WHERE false) AS null_not_in_empty,\n       NULL::int IN (1, 2)                                     AS null_in_list,\n       EXISTS (SELECT count(*) FROM orders WHERE false)          AS exists_count;`, note: 'NOT IN over an empty set is true even for NULL. EXISTS over an aggregate is always true, because an aggregate always returns one row.' }
    ]
  },
  gotchas: [
    { trap: 'NOT IN with a nullable subquery', code: `WHERE id NOT IN (SELECT customer_id FROM orders)\n-- one NULL customer_id → 0 rows, forever`, why: '<code>x NOT IN (a, b, NULL)</code> means <code>x&lt;&gt;a AND x&lt;&gt;b AND x&lt;&gt;NULL</code>. The last term is unknown, so the whole thing is false or unknown, never true.', fix: 'Use <code>NOT EXISTS</code>. If you must keep NOT IN, add <code>WHERE customer_id IS NOT NULL</code> inside the subquery.' },
    { trap: 'NOT IN is never an anti join', why: 'Because of its NULL semantics, the planner can’t turn NOT IN into an anti join (true through PG18), even when the column is NOT NULL. It runs as a <code>hashed SubPlan</code>, or, when the subquery doesn’t fit in <code>work_mem</code>, as a plain SubPlan rescanned per outer row.', fix: 'Write NOT EXISTS. It can use hash, merge or nested-loop anti joins and index lookups.' },
    { trap: 'LEFT JOIN … IS NULL on the wrong column', code: `LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.amount IS NULL   -- also matches real orders with NULL amount!`, why: 'You must test a column that cannot be NULL in a real match. Even then, through PG18 only a column from the join condition (<code>o.customer_id</code>) makes the planner use an anti join; <code>o.id IS NULL</code> is correct but plans as join + Filter.', fix: 'Prefer NOT EXISTS. It states the intent, and it always gets the anti join.' },
    { trap: 'EXISTS around an aggregate is always true', code: `WHERE EXISTS (SELECT count(*) FROM orders o WHERE o.customer_id = c.id)`, why: 'An aggregate without GROUP BY always returns exactly one row (count = 0), so EXISTS is true for every customer.', fix: 'Drop the aggregate, or use <code>(SELECT count(*) …) &gt; 0</code> only if you really need a count.' },
    { trap: 'JOIN + DISTINCT to emulate a semi join', why: 'The join produces every match (Asha ×1000 orders), then DISTINCT sorts or hashes it all away. DISTINCT also merges legitimately equal rows from the outer side.', fix: 'Use EXISTS or IN. The semi join stops at the first match.' },
    { trap: 'EXISTS under OR is not pulled up', code: `WHERE c.vip OR EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)`, why: 'Only EXISTS / IN at the top level of WHERE (ANDed) become semi joins. Under OR they stay SubPlans, often <code>hashed SubPlan</code>, sometimes per-row execution.', fix: 'Split into <code>UNION</code> of two queries, or check EXPLAIN and accept the hashed SubPlan if it is cheap.' },
    { trap: 'Unqualified column in a subquery binds to the outer table', code: `SELECT * FROM customers\nWHERE id IN (SELECT id FROM orders_archive);  -- meant customer_id`, why: 'If the inner table has no such column, the name resolves to the <i>outer</i> query, silently making a correlated subquery that is always true (or always false for NOT IN).', fix: 'Always qualify columns in subqueries: <code>SELECT oa.customer_id FROM orders_archive oa</code>.' }
  ],
  scenarios: [
    { title: 'Win-back campaign mailed nobody',
      symptom: 'The nightly “customers with no orders in 90 days” job selected 0 rows, starting the day guest checkout shipped. No error anywhere.',
      diagnose: `SELECT count(*) FROM orders\nWHERE customer_id IS NULL AND created_at > now() - interval '90 days';  -- > 0`,
      cause: '<code>WHERE id NOT IN (SELECT customer_id FROM orders WHERE …)</code>. The first guest order put a NULL in the list, and every row became unknown.',
      fix: 'Rewrite as NOT EXISTS. Add a data test that alerts when a “should never be empty” job returns 0 rows.',
      fixCode: `SELECT c.id FROM customers c\nWHERE NOT EXISTS (\n  SELECT 1 FROM orders o\n  WHERE o.customer_id = c.id\n    AND o.created_at > now() - interval '90 days');` },
    { title: 'Purge job went from 4 seconds to 9 hours',
      symptom: 'A cleanup <code>DELETE FROM files WHERE id NOT IN (SELECT file_id FROM attachments)</code> was fine for a year, then suddenly pinned a CPU all night.',
      diagnose: `EXPLAIN DELETE FROM files WHERE id NOT IN (SELECT file_id FROM attachments);\n-- before: Filter: (NOT (hashed SubPlan 1))\n-- after:  Filter: (NOT (SubPlan 1))  ->  Materialize`,
      cause: '<code>attachments</code> grew past what fits in <code>work_mem</code>. The planner dropped the hash and rescanned the materialized subquery for each of the 3M files: O(N×M).',
      fix: 'Rewrite as NOT EXISTS (Hash Anti Join, which can spill to disk in batches). Raising work_mem only moves the cliff.',
      fixCode: `DELETE FROM files f\nWHERE NOT EXISTS (\n  SELECT 1 FROM attachments a WHERE a.file_id = f.id);` },
    { title: 'Report doubles after a “simplification”',
      symptom: 'A refactor replaced <code>WHERE id IN (SELECT user_id FROM logins WHERE …)</code> with a JOIN “for performance”. Active-user counts went up 6×.',
      diagnose: `SELECT user_id, count(*) FROM logins\nWHERE ts > now() - interval '30 days'\nGROUP BY 1 HAVING count(*) > 1 LIMIT 5;`,
      cause: 'A join emits one row per login. IN is a semi join and emits each user at most once.',
      fix: 'Go back to EXISTS / IN. Postgres already plans it as a semi join (or unique-ifies the inner side), so it was never slower.',
      fixCode: `SELECT count(*) FROM users u\nWHERE EXISTS (SELECT 1 FROM logins l\n  WHERE l.user_id = u.id AND l.ts > now() - interval '30 days');` }
  ],
  puzzles: [
    { kind: 'predict', q: 'With guest order 104 (customer_id NULL) in the table, how many rows?', code: `SELECT name FROM customers\nWHERE id NOT IN (SELECT customer_id FROM orders);`, options: ['0', '2 (Chen, Dina)', '4', 'ERROR'], answer: 0, explain: 'For Chen: <code>3&lt;&gt;1 AND 3&lt;&gt;2 AND 3&lt;&gt;1 AND 3&lt;&gt;NULL</code> = true AND … AND unknown = <b>unknown</b>. WHERE drops unknown. <b>0 rows</b>.' },
    { kind: 'predict', q: 'Asha has 2 orders. How many rows?', code: `SELECT name FROM customers\nWHERE id IN (SELECT customer_id FROM orders);`, options: ['2', '3', '4', '0, because of the NULL'], answer: 0, explain: 'IN is a semi join: Asha and Ben, once each. The NULL only hurts the <i>negated</i> form: <code>1 IN (1, NULL)</code> is true.' },
    { kind: 'predict', q: 'How many customers does this return?', code: `SELECT name FROM customers c\nWHERE EXISTS (SELECT count(*) FROM orders o WHERE o.customer_id = c.id);`, options: ['2', '4', '0', 'ERROR'], answer: 1, explain: 'An aggregate always returns one row, even if it is <code>count = 0</code>. So EXISTS is true for all <b>4</b>.' },
    { kind: 'predict', q: 'What does this return?', code: `SELECT NULL::int NOT IN (SELECT customer_id FROM orders WHERE false) AS r;`, options: ['NULL', 'true', 'false', 'ERROR'], answer: 1, explain: '<code>x &lt;&gt; ALL(empty set)</code> is vacuously <b>true</b>, even when x is NULL. The left NULL only matters if there is at least one comparison.' },
    { kind: 'predict', q: 'Someone meant <code>customer_id</code> but typed <code>id</code>. How many rows?', code: `SELECT name FROM customers\nWHERE id IN (SELECT id FROM orders);`, options: ['0', '2', '4', 'ERROR'], answer: 0, explain: 'Here <code>id</code> resolves to <code>orders.id</code> (101–104), and no customer has those ids: <b>0 rows</b>. If orders had no <code>id</code> column at all, it would bind to the outer <code>customers.id</code> and return all 4. Always qualify.' },
    { kind: 'predict', q: 'Customers without orders, written as LEFT JOIN. Rows?', code: `SELECT c.name FROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.id IS NULL;`, options: ['0', '2', '3', '4'], answer: 1, explain: 'Chen and Dina get NULL-padded rows, so <b>2</b>. Unlike NOT IN, the guest order’s NULL can’t match anyone, so it does no harm.' }
  ],
  interview: [
    { q: 'EXISTS vs IN vs JOIN: when do they give different results?', a: '<p>EXISTS and IN (subquery) are both semi joins: each outer row at most once. A JOIN emits one row per match. For the positive forms, EXISTS and IN are equivalent and the planner treats them alike. The differences appear when negated: NOT IN has three-valued-logic semantics, NOT EXISTS does not.</p>', fu: 'Is IN with a literal list a semi join? (No, it becomes <code>= ANY(ARRAY[…])</code>, a filter.)', lvl: 'core' },
    { q: 'Explain exactly why NOT IN returns no rows when the subquery contains NULL.', a: '<p><code>x NOT IN (S)</code> is <code>x &lt;&gt; ALL(S)</code>, an AND over every element. A comparison with NULL is unknown. <code>true AND unknown</code> is unknown, and <code>false AND unknown</code> is false. So the result is never true, and WHERE keeps only true. Edge case: if S is empty, the result is true for every x, including NULL.</p>', lvl: 'core' },
    { q: 'Why can’t Postgres plan NOT IN as an anti join, even when the column is NOT NULL?', a: '<p>An anti join returns the outer row when no match exists. NOT IN must return unknown (= drop) when the outer value is NULL and the set is non-empty, or when the set contains NULL. Proving both sides non-nullable at plan time was not implemented through PG18, so NOT IN stays an <code>ANY</code> SubPlan: hashed if the result fits in work_mem, otherwise materialized and rescanned per row.</p>', fu: 'What does the plan look like when it doesn’t fit? (<code>Filter: (NOT (SubPlan 1))</code> over a Materialize node.)', lvl: 'deep' },
    { q: 'What plan shapes can a semi join take?', a: '<p>Hash Semi Join, Merge Semi Join, Nested Loop Semi Join (often with an inner index scan that stops at the first hit), or “unique-ify then join”: a HashAggregate / Unique on the inner side, then a regular inner join. The last one lets the planner put the small, de-duplicated side on either side of the join.</p>', lvl: 'deep' },
    { q: 'What is a “Hash Right Anti Join”?', a: '<p>PG16+ can build the hash table on the <i>outer</i> (preserved) side and probe it with the inner side, marking matched entries. Unmatched entries are emitted at the end. It is chosen when the outer side is the smaller one.</p>', lvl: 'deep' },
    { q: 'When is LEFT JOIN … WHERE x IS NULL planned as an anti join?', a: '<p>When the planner can prove that x is NULL only for padded rows. Through PG18 that means x appears in a strict join condition (e.g. <code>o.customer_id</code> from <code>ON o.customer_id = c.id</code>). Testing the PK (<code>o.id IS NULL</code>) is semantically fine but runs as Hash Join plus Filter, so it materializes every match first. NOT EXISTS always gets the anti join.</p>', lvl: 'deep' },
    { q: 'Where does the semi join’s “early exit” really save work?', a: '<p>In a nested loop with an inner index scan: the probe stops after the first index hit instead of walking every matching row. In a hash semi join, probing a bucket stops at the first match. With 1,000 orders per customer, the join + DISTINCT alternative reads and then discards 999 rows per customer.</p>', lvl: 'core' },
    { q: 'Correlated subquery in WHERE: is it always executed once per row?', a: '<p>No. EXISTS / IN at the top level of an AND list are pulled up into semi or anti joins. Subqueries under OR, in the SELECT list, or with constructs that block pull-up (LIMIT with OFFSET, volatile functions, some aggregates) stay SubPlans. Those may be hashed (uncorrelated ANY) or executed per row.</p>', lvl: 'deep' },
    { q: 'How would you write “users with no login in 30 days” for a 100M-row logins table?', a: '<p><code>NOT EXISTS (SELECT 1 FROM logins l WHERE l.user_id = u.id AND l.ts &gt; now() - interval \'30 days\')</code> with an index on <code>(user_id, ts)</code>. That gives a nested-loop anti join with an index probe that stops at the first recent login, or a hash anti join if most users are scanned anyway.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Spring Data: NOT IN with a collection parameter', lang: 'java', code: `// DANGER: a null element makes the predicate unknown for every row,
// and an empty collection renders differently across Hibernate versions.
@Query("select u from User u where u.id not in :ids")
List<User> findAllExcept(@Param("ids") Collection<Long> ids);

// Safer for "not referenced by another table": NOT EXISTS in JPQL
@Query("""
  select u from User u
  where not exists (select 1 from Login l where l.user = u and l.ts > :since)""")
List<User> inactiveSince(@Param("since") Instant since);`, note: 'Guard empty collections in the service layer. For large id sets from Java, pass an array: <code>WHERE id &lt;&gt; ALL(?::bigint[])</code> keeps one prepared-statement shape.' },
    { title: 'JDBC: one plan shape for any list size', lang: 'java', code: `try (var ps = conn.prepareStatement(
    "SELECT id, name FROM customers WHERE id = ANY(?)")) {
  ps.setArray(1, conn.createArrayOf("int4", ids.toArray()));
  try (var rs = ps.executeQuery()) { /* ... */ }
}`, note: 'An IN list with N placeholders creates a new statement text for every N, which defeats prepared-statement caching.' }
  ]
});

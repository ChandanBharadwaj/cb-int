IA.register({
  track: 'sql',
  slug: 'set-operations',
  title: 'UNION, INTERSECT, EXCEPT',
  tagline: 'Set operations stack two result sets <b>vertically</b>, row against row. Joins combine tables side by side. Without <code>ALL</code>, every set operation also <b>de-duplicates</b>, and that hash or sort is the most common hidden cost (and silent data loss) in reporting SQL.',
  tldr: {
    problem: 'People write UNION out of habit. It silently merges identical rows (two real $20 payments become one) and adds a hash or sort over the full result. EXCEPT hides count differences that a reconciliation needed to see.',
    model: '<code>UNION ALL</code> = Append, nothing else. <code>UNION</code> = Append + HashAggregate (or Sort + Unique). <code>INTERSECT</code> / <code>EXCEPT</code> = a SetOp node that counts each distinct row on the left and right, then emits 1, min(l,r) or max(l−r,0) copies.',
    hook: '“Revenue in the warehouse is 0.4% lower than in Stripe.” A UNION of the card and wallet payment tables merged legitimately identical rows.',
    facts: [
      { v: 'NULL = NULL', l: 'for set operations: rows are compared with “not distinct”, so two NULL rows are duplicates (unlike in <code>=</code> joins)' },
      { v: 'min / max(l−r, 0)', l: 'copies of each row that INTERSECT ALL / EXCEPT ALL output, given l copies on the left and r on the right' },
      { v: 'INTERSECT first', l: 'it binds tighter than UNION and EXCEPT, which are evaluated left to right' }
    ]
  },
  intro: {
    what: 'A set operation takes the results of two queries that have the <b>same columns</b> and combines them into one list. <code>UNION</code> = rows from either. <code>INTERSECT</code> = rows in both. <code>EXCEPT</code> = rows in the first but not in the second. By default each one also removes duplicate rows; add <code>ALL</code> to keep them.',
    analogy: { icon: '🗂️', title: 'Two guest lists', text: 'You and a friend each wrote a party guest list. Stapling the pages together is <b>UNION ALL</b>: some names appear twice. Crossing out repeats is <b>UNION</b>. Names on both lists is <b>INTERSECT</b>. Names only on your list is <b>EXCEPT</b>.' },
    steps: [
      { t: 'Stack two queries', d: 'The queries must return the same number of columns, with compatible types. Column names come from the first query.', code: 'SELECT email FROM customers\nUNION ALL\nSELECT email FROM newsletter_signups;' },
      { t: 'Remove duplicates (or not)', d: '<code>UNION</code> removes duplicate rows from the combined result. <code>UNION ALL</code> keeps every row and is cheaper.' },
      { t: 'Both / only-left', d: '<code>INTERSECT</code> keeps rows that appear in both. <code>EXCEPT</code> keeps rows from the first query that are not in the second.', code: 'SELECT email FROM customers\nEXCEPT\nSELECT email FROM unsubscribed;' },
      { t: 'Sort the whole thing once', d: 'A single <code>ORDER BY</code> at the very end sorts the combined result.' }
    ],
    widget: 'set-operations-intro',
    terms: [
      ['UNION', 'Rows from either query, duplicates removed.'],
      ['UNION ALL', 'Rows from both queries, all kept. No extra work.'],
      ['INTERSECT', 'Rows present in both queries.'],
      ['EXCEPT', 'Rows in the first query but not the second (Oracle calls it MINUS).'],
      ['duplicate row', 'Two rows whose values are equal in every column. For set operations, NULL counts as equal to NULL.']
    ]
  },
  visual: {
    title: 'Watch the dedupe: a hash table of counters',
    caption: 'Each input row is hashed into a table that counts how often each distinct value came from the left (A) and right (B) query. Pick an operation to see which rows come out, and how many copies. <code>UNION ALL</code> skips the table entirely.'
  },
  playground: {
    setup: `
CREATE TABLE a (x int);
CREATE TABLE b (x int);
INSERT INTO a VALUES (1),(1),(1),(2),(2),(3),(NULL);
INSERT INTO b VALUES (1),(1),(2),(NULL),(4);
CREATE TABLE card_payments   (id int, customer_id int, amount numeric, paid_on date);
CREATE TABLE wallet_payments (id int, customer_id int, amount numeric, paid_on date);
INSERT INTO card_payments   VALUES (1, 7, 20, '2026-03-01'), (2, 8, 15, '2026-03-01');
INSERT INTO wallet_payments VALUES (1, 7, 20, '2026-03-01'), (2, 9, 30, '2026-03-02');`,
    presets: [
      { label: 'UNION vs ALL', sql: `SELECT x FROM a UNION ALL SELECT x FROM b ORDER BY x;   -- 12 rows\nSELECT x FROM a UNION     SELECT x FROM b ORDER BY x;   -- 5 rows, one NULL`, note: 'Both NULLs collapse into one: set operations treat NULLs as equal.' },
      { label: 'INTERSECT [ALL]', sql: `SELECT x FROM a INTERSECT     SELECT x FROM b ORDER BY x;\nSELECT x FROM a INTERSECT ALL SELECT x FROM b ORDER BY x;`, note: '1 appears 3× in a and 2× in b, so INTERSECT ALL emits min(3,2) = 2 copies.' },
      { label: 'EXCEPT [ALL]', sql: `SELECT x FROM a EXCEPT     SELECT x FROM b ORDER BY x;\nSELECT x FROM a EXCEPT ALL SELECT x FROM b ORDER BY x;`, note: 'EXCEPT: only 3. EXCEPT ALL: 1, 2, 3, because 3−2 = 1 copy of 1 and 2−1 = 1 copy of 2 survive.' },
      { label: 'Silent data loss', sql: `-- two real $20 payments by customer 7 on the same day, from two channels\nSELECT customer_id, amount, paid_on FROM card_payments\nUNION\nSELECT customer_id, amount, paid_on FROM wallet_payments;\n\nSELECT sum(amount) FROM (\n  SELECT customer_id, amount, paid_on FROM card_payments\n  UNION ALL\n  SELECT customer_id, amount, paid_on FROM wallet_payments) t;`, note: 'UNION returns 3 rows (sum 65); the real total is 85. Add a source column, or use UNION ALL.' },
      { label: 'Plan shapes', sql: `EXPLAIN (COSTS OFF) SELECT x FROM a UNION ALL SELECT x FROM b;\nEXPLAIN (COSTS OFF) SELECT x FROM a UNION     SELECT x FROM b;\nEXPLAIN (COSTS OFF) SELECT x FROM a EXCEPT ALL SELECT x FROM b;`, note: 'Append; HashAggregate over Append; HashSetOp Except All.' },
      { label: 'ORDER BY / LIMIT per branch', sql: `-- latest 1 from EACH table: parenthesize the branches\n(SELECT 'card' AS src, id, paid_on FROM card_payments ORDER BY paid_on DESC, id DESC LIMIT 1)\nUNION ALL\n(SELECT 'wallet', id, paid_on FROM wallet_payments ORDER BY paid_on DESC, id DESC LIMIT 1)\nORDER BY src;`, note: 'Without the parentheses, ORDER BY and LIMIT apply to the whole union, so you would get 1 row in total.' }
    ]
  },
  gotchas: [
    { trap: 'UNION by habit', why: 'It adds a HashAggregate (or Sort + Unique) over the full result, which can spill to disk, and it silently merges rows that were meant to be different.', fix: 'Default to <code>UNION ALL</code>. Use UNION only when you have a reason to dedupe, and write that reason in a comment.' },
    { trap: 'Branches look different, but rows are identical', code: `SELECT customer_id, amount FROM card_payments\nUNION\nSELECT customer_id, amount FROM wallet_payments;`, why: 'Dedupe compares only the selected columns. Two different payments with the same customer and amount collapse into one.', fix: 'Add a discriminator (<code>\'card\' AS src</code>) or the primary key, or use UNION ALL.' },
    { trap: 'ORDER BY / LIMIT bind to the whole result', code: `SELECT … FROM t1 ORDER BY ts DESC LIMIT 10\nUNION ALL\nSELECT … FROM t2;   -- syntax error`, why: 'Inside a set operation, a branch can carry ORDER BY / LIMIT only if it is parenthesized. A trailing ORDER BY sorts the combined result.', fix: 'Write <code>(SELECT … ORDER BY … LIMIT 10) UNION ALL (SELECT …)</code>.' },
    { trap: 'Positional, not by name', code: `SELECT id, email FROM a\nUNION ALL\nSELECT email, id FROM b;   -- error, or silent garbage if types match`, why: 'Columns are matched by position. Names come from the first branch. Swapped columns of the same type are combined silently.', fix: 'List columns explicitly in the same order in every branch. Never use <code>SELECT *</code> in a union.' },
    { trap: 'Type resolution surprises', why: 'Each output column gets one common type, chosen like CASE does: <code>1 UNION 2.5</code> → numeric; untyped <code>NULL UNION NULL</code> → text; <code>int UNION text</code> → error. Branches are resolved pairwise from the left.', fix: 'Cast explicitly in the first branch: <code>NULL::bigint</code>, <code>\'x\'::text</code>.' },
    { trap: 'ORDER BY on an expression', code: `SELECT x FROM a UNION SELECT x FROM b ORDER BY x + 0;  -- ERROR`, why: 'The ORDER BY of a set operation can only reference output column names or positions, not expressions.', fix: 'Wrap it: <code>SELECT * FROM (… UNION …) u ORDER BY x + 0</code>.' },
    { trap: 'Mixing UNION and INTERSECT without parentheses', why: 'INTERSECT binds tighter: <code>A UNION B INTERSECT C</code> is <code>A UNION (B INTERSECT C)</code>. UNION and EXCEPT associate left to right.', fix: 'Always parenthesize mixed set operations.' }
  ],
  scenarios: [
    { title: 'Warehouse revenue 0.4% below Stripe',
      symptom: 'Finance found that a daily revenue model was consistently a little low. Gaps clustered on days with promotions.',
      diagnose: `SELECT customer_id, amount, paid_on, count(*)\nFROM (SELECT customer_id, amount, paid_on FROM card_payments\n      UNION ALL\n      SELECT customer_id, amount, paid_on FROM wallet_payments) t\nGROUP BY 1, 2, 3 HAVING count(*) > 1;`,
      cause: 'The model used UNION. Same customer, same promo price, same day across two channels → identical rows → merged.',
      fix: 'UNION ALL plus a <code>source</code> column. Add a data test: count after the union = sum of the counts of the branches.',
      fixCode: `SELECT 'card' AS source, id, customer_id, amount, paid_on FROM card_payments\nUNION ALL\nSELECT 'wallet', id, customer_id, amount, paid_on FROM wallet_payments;` },
    { title: 'Nightly export started writing 60 GB of temp files',
      symptom: 'An audit-log export of four monthly partitions slowed from 3 to 40 minutes, and disk alerts fired on the primary.',
      diagnose: `EXPLAIN (ANALYZE, BUFFERS) SELECT … UNION SELECT … UNION …;\n-- HashAggregate  Batches: 512  Disk Usage: 61,000,000kB`,
      cause: 'UNION over 900M log rows that already had unique ids. The dedupe hash spilled to disk in hundreds of batches.',
      fix: 'UNION ALL: plan becomes a streaming Append, no memory and no temp files. Also <code>temp_file_limit</code> to cap a runaway query.',
      fixCode: `SELECT * FROM audit_2026_01\nUNION ALL SELECT * FROM audit_2026_02\nUNION ALL SELECT * FROM audit_2026_03;` },
    { title: 'Reconciliation said “all good” while 1,200 rows were missing',
      symptom: 'A migration check <code>SELECT … FROM old EXCEPT SELECT … FROM new</code> returned 0 rows, but row counts differed by 1,200.',
      diagnose: `SELECT (SELECT count(*) FROM old) AS old_n, (SELECT count(*) FROM new) AS new_n;`,
      cause: 'EXCEPT compares distinct rows. The old table had duplicate rows (no PK) that were copied only once.',
      fix: 'Use EXCEPT ALL in both directions to compare multisets, and check counts too.',
      fixCode: `(SELECT * FROM old EXCEPT ALL SELECT * FROM new)\nUNION ALL\n(SELECT * FROM new EXCEPT ALL SELECT * FROM old);` }
  ],
  puzzles: [
    { kind: 'predict', q: 'a = {1,1,1,2,2,3,NULL}, b = {1,1,2,NULL,4}. How many rows?', code: `SELECT x FROM a UNION SELECT x FROM b;`, options: ['4', '5', '6', '12'], answer: 1, explain: 'Distinct values: 1, 2, 3, 4 and <b>one</b> NULL (set operations treat NULLs as duplicates) = <b>5</b>.' },
    { kind: 'predict', q: 'How many rows?', code: `SELECT x FROM a INTERSECT ALL SELECT x FROM b;`, options: ['3', '4', '5', '6'], answer: 1, explain: 'min per value: 1 → min(3,2)=2, 2 → min(2,1)=1, NULL → min(1,1)=1, 3 and 4 → 0. Total <b>4</b>.' },
    { kind: 'predict', q: 'How many rows?', code: `SELECT x FROM a EXCEPT SELECT x FROM b;`, options: ['0', '1', '3', '4'], answer: 1, explain: 'Distinct a-values not in b: only 3 → <b>1</b> row. EXCEPT ALL would give 3 rows (1, 2, 3).' },
    { kind: 'predict', q: 'Result?', code: `SELECT 1 UNION SELECT 2 INTERSECT SELECT 3;`, options: ['empty', '1', '1, 2', '1, 2, 3'], answer: 1, explain: 'INTERSECT binds tighter: <code>1 UNION (2 INTERSECT 3)</code> = 1 UNION ∅ = <b>1</b>.' },
    { kind: 'predict', q: 'What type is v?', code: `SELECT pg_typeof(v) FROM (SELECT NULL AS v UNION SELECT NULL) t;`, options: ['unknown', 'text', 'int', 'ERROR'], answer: 1, explain: 'Untyped literals in a set operation resolve to <b>text</b> (one row: duplicates removed).' },
    { kind: 'bug', q: 'What happens?', code: `SELECT x FROM a UNION SELECT x FROM b ORDER BY x + 0;`, options: ['Sorted by x', 'Unsorted', 'ERROR', 'Sorted, NULL first'], answer: 2, explain: '<b>ERROR</b>: invalid UNION/INTERSECT/EXCEPT ORDER BY clause. Only output column names or positions are allowed; wrap the union in a subquery.' }
  ],
  interview: [
    { q: 'UNION vs UNION ALL: semantics and cost?', a: '<p>UNION ALL concatenates (an Append node, streaming, no memory). UNION also removes duplicate rows across the whole result: Append + HashAggregate, or Sort + Unique. That needs memory proportional to the number of distinct rows, can spill to temp files, and blocks until all input has been read.</p>', fu: 'Does UNION remove duplicates that existed within a single branch? (Yes, it dedupes the combined result.)', lvl: 'core' },
    { q: 'How are NULLs treated by set operations, and why is that different from joins?', a: '<p>Set operations compare rows with “IS NOT DISTINCT FROM” semantics, so NULL matches NULL. Joins use <code>=</code>, where NULL matches nothing. So <code>SELECT NULL INTERSECT SELECT NULL</code> returns one row, while a join on NULL keys returns nothing.</p>', lvl: 'core' },
    { q: 'Explain INTERSECT ALL and EXCEPT ALL in terms of counts.', a: '<p>For each distinct row, with l copies on the left and r on the right: INTERSECT ALL emits min(l, r), EXCEPT ALL emits max(l − r, 0). The plain versions emit 1 if that number is &gt; 0. Postgres implements this with a SetOp node (hashed or sorted) that keeps two counters per group.</p>', lvl: 'core' },
    { q: 'How would you compare two tables for exact equality, including duplicates?', a: '<p><code>(A EXCEPT ALL B) UNION ALL (B EXCEPT ALL A)</code> must be empty. Plain EXCEPT ignores multiplicity. For big tables, compare <code>count(*)</code> and an order-independent hash aggregate first, e.g. <code>sum(hashtext(t::text)::bigint)</code>.</p>', lvl: 'deep' },
    { q: 'Can a UNION be pushed down into partitions or use indexes?', a: '<p>Each branch is planned independently, so each can use its own indexes. Outer WHERE conditions on a <code>UNION ALL</code> subquery are pushed down into the branches; for UNION they are too when it is safe. ORDER BY + LIMIT over UNION ALL can use a Merge Append of index-ordered branches and stop early. UNION (with dedupe) can’t stream like that.</p>', lvl: 'deep' },
    { q: 'How are output column names and types decided?', a: '<p>Names come from the first branch. Types are resolved per column across branches, using the same rules as CASE: find a common type in the same category, prefer the preferred type (e.g. numeric for int + numeric), and fail if the categories differ (int vs text). Untyped literals become text.</p>', lvl: 'core' },
    { q: 'What is the precedence of set operators?', a: '<p>INTERSECT binds tighter than UNION and EXCEPT. UNION and EXCEPT have equal precedence and associate left to right. <code>A EXCEPT B UNION C</code> = <code>(A EXCEPT B) UNION C</code>.</p>', lvl: 'core' },
    { q: 'When would you choose EXCEPT over NOT EXISTS?', a: '<p>EXCEPT compares whole rows across all columns and is NULL-safe (NULL equals NULL), so it suits reconciliations. NOT EXISTS lets you choose the join key, return other columns from the outer row, and use indexes for a selective anti join. For “ids in A not in B”, NOT EXISTS is usually faster with indexes.</p>', lvl: 'deep' },
    { q: 'Why does UNION sometimes appear as Sort + Unique and sometimes as HashAggregate?', a: '<p>The planner costs both. Hashing is chosen when the estimated distinct rows fit in <code>work_mem × hash_mem_multiplier</code> (default 2.0, PG15+). Sorting is chosen when they don’t, or when sorted output is useful for a later ORDER BY. A bad distinct-count estimate can pick a hash that spills.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'JPA: UNION in JPQL / HQL', lang: 'java', code: `// Hibernate 6 HQL supports union / intersect / except (JPA 3.2 standardizes them)
@Query("""
  select p.customerId as customerId, p.amount as amount from CardPayment p
  union all
  select w.customerId, w.amount from WalletPayment w""")
List<PaymentView> allPayments();`, note: 'On Hibernate 5 or older JPA providers, use a native query or a database view.' },
    { title: 'Data test (any test framework)', lang: 'sql', code: `-- union must not lose rows: fails if counts differ
SELECT (SELECT count(*) FROM card_payments) + (SELECT count(*) FROM wallet_payments)
     = (SELECT count(*) FROM all_payments_v) AS ok;` }
  ]
});

IA.register({
  track: 'sql',
  slug: 'null-three-valued-logic',
  title: 'NULL & three-valued logic',
  tagline: 'SQL has three truth values: TRUE, FALSE and <b>UNKNOWN</b>. Any comparison with NULL is UNKNOWN, WHERE keeps only TRUE, and CHECK rejects only FALSE. Those three rules explain empty NOT IN results, “missing” rows and NULL-tolerant constraints.',
  tldr: {
    problem: 'NULL bugs don’t throw errors. They quietly drop rows (<code>NOT IN</code>, <code>&lt;&gt;</code>), undercount (<code>COUNT(col)</code>), and let duplicates through UNIQUE.',
    model: 'NULL means “unknown or not applicable”. <code>NULL = anything</code> → UNKNOWN. AND/OR follow Kleene logic: FALSE AND x = FALSE, TRUE OR x = TRUE, otherwise UNKNOWN wins. WHERE/JOIN/HAVING keep TRUE only.',
    hook: '“We have 4,000 inactive customers, why does <code>WHERE id NOT IN (SELECT customer_id FROM orders)</code> return zero?” One guest order has customer_id NULL.',
    facts: [
      { v: 'UNKNOWN', l: 'result of <code>NULL = NULL</code>. Use <code>IS NULL</code> or <code>IS NOT DISTINCT FROM</code>' },
      { v: 'NULLS LAST', l: 'Postgres default for ASC; DESC defaults to NULLS FIRST, because NULL sorts as larger than any value' },
      { v: 'PG15+', l: '<code>UNIQUE NULLS NOT DISTINCT</code> lets a unique constraint treat NULLs as equal' }
    ]
  },
  intro: {
    what: '<b>NULL</b> is SQL’s marker for “no value here”: a phone number nobody gave you, a manager that a CEO doesn’t have. It is not zero and not an empty string. Because the value is unknown, comparing it to anything gives “unknown” instead of yes or no.',
    analogy: { icon: '❓', title: 'A sealed envelope', text: 'Someone asks “is the amount in this sealed envelope equal to 100?” The honest answer is “I don’t know”. Is it equal to the amount in another sealed envelope? Still “I don’t know”. SQL answers the same way, and a WHERE clause only lets through rows where the answer is a clear yes.' },
    steps: [
      { t: 'NULL is not a value', d: 'You can’t find it with <code>=</code>.', code: 'SELECT * FROM emp WHERE bonus = NULL;   -- always 0 rows\nSELECT * FROM emp WHERE bonus IS NULL;  -- correct' },
      { t: 'Three answers, not two', d: 'Comparisons return TRUE, FALSE or UNKNOWN. WHERE keeps only TRUE.', code: "SELECT * FROM emp WHERE dept <> 'Sales';  -- rows with dept NULL vanish too" },
      { t: 'Aggregates skip NULLs', d: '<code>COUNT(*)</code> counts rows; <code>COUNT(col)</code>, SUM and AVG ignore NULLs.', code: 'SELECT count(*), count(bonus), avg(bonus) FROM emp;' },
      { t: 'Replace NULL when you must', d: '<code>COALESCE</code> returns the first non-NULL argument.', code: 'SELECT name, COALESCE(bonus, 0) AS bonus FROM emp;' }
    ],
    terms: [
      ['NULL', 'Marker for a missing or unknown value.'],
      ['UNKNOWN', 'The third truth value, produced by comparisons involving NULL.'],
      ['IS NULL', 'The only reliable test for NULL.'],
      ['COALESCE(a, b, …)', 'First non-NULL argument.'],
      ['IS DISTINCT FROM', 'A comparison that treats NULLs as equal to each other and never returns UNKNOWN.'],
      ['NULLIF(a, b)', 'Returns NULL if a = b, else a. Handy to avoid division by zero.']
    ]
  },
  visual: {
    title: 'Watch UNKNOWN poison NOT IN',
    caption: 'Choose IN, NOT IN or NOT EXISTS, whether the list holds a NULL, and the value of x. Press Play to evaluate each comparison and combine them in three-valued logic.'
  },
  extras: [
    { id: 'null-three-valued-logic-tables', title: 'Truth tables with UNKNOWN', label: 'Truth tables', caption: 'Pick A and B. Every operator’s result updates and the matching cell is highlighted.' }
  ],
  playground: {
    setup: `
CREATE TABLE emp (id int PRIMARY KEY, name text NOT NULL, dept text, manager_id int, bonus numeric(8,2), email text UNIQUE);
INSERT INTO emp VALUES
 (1,'Asha','Eng',NULL,1000,'asha@x.io'), (2,'Ben','Eng',1,NULL,NULL), (3,'Chen','Sales',1,500,NULL),
 (4,'Dina',NULL,3,NULL,'dina@x.io'), (5,'Eli','Sales',3,0,'eli@x.io');
CREATE TABLE codes_std (code text UNIQUE);
CREATE TABLE codes_15  (code text UNIQUE NULLS NOT DISTINCT);`,
    presets: [
      { label: 'NOT IN vs NOT EXISTS', sql: `-- who is nobody's manager?\nSELECT name FROM emp WHERE id NOT IN (SELECT manager_id FROM emp);\nSELECT name FROM emp e WHERE NOT EXISTS (SELECT 1 FROM emp m WHERE m.manager_id = e.id) ORDER BY name;`, note: 'NOT IN returns 0 rows because Asha’s manager_id is NULL. NOT EXISTS returns Ben, Dina, Eli.' },
      { label: '<> drops NULLs', sql: `SELECT name, dept FROM emp WHERE dept <> 'Sales' ORDER BY id;\nSELECT name, dept FROM emp WHERE dept IS DISTINCT FROM 'Sales' ORDER BY id;`, note: 'Dina (dept NULL) only appears in the second query.' },
      { label: 'COUNT / SUM / AVG', sql: `SELECT count(*) AS rows, count(bonus) AS with_bonus,\n       sum(bonus) AS total, avg(bonus) AS avg_ignoring_null,\n       avg(COALESCE(bonus, 0)) AS avg_null_as_zero\nFROM emp;`, note: 'AVG over 3 known bonuses (500) vs over 5 people (300).' },
      { label: 'UNIQUE and NULLs', sql: `INSERT INTO codes_std VALUES (NULL), (NULL), ('A');\nSELECT count(*) AS std_rows FROM codes_std;\n-- now run this line on its own:\n-- INSERT INTO codes_15 VALUES (NULL), (NULL);`, note: 'Standard UNIQUE allows many NULLs (3 rows). Then the PG15+ NULLS NOT DISTINCT table rejects the second NULL with a duplicate key error.' },
      { label: 'NULL ordering', sql: `SELECT name, bonus FROM emp ORDER BY bonus;                 -- NULLs last\nSELECT name, bonus FROM emp ORDER BY bonus DESC;            -- NULLs first!\nSELECT name, bonus FROM emp ORDER BY bonus DESC NULLS LAST;`, note: 'Only the last grid is shown. Run each line alone to compare.' },
      { label: 'Truth table live', sql: `SELECT a, b, a AND b AS "and", a OR b AS "or", NOT a AS "not a",\n       a = b AS "=", a IS DISTINCT FROM b AS "distinct"\nFROM (VALUES (true),(false),(NULL::bool)) x(a)\nCROSS JOIN (VALUES (true),(false),(NULL::bool)) y(b);`, note: 'NULL in a boolean column <i>is</i> UNKNOWN.' }
    ]
  },
  gotchas: [
    { trap: 'NOT IN with a nullable subquery', code: `WHERE id NOT IN (SELECT manager_id FROM emp)   -- one NULL → 0 rows`, why: '<code>x NOT IN (a, b, NULL)</code> = <code>x&lt;&gt;a AND x&lt;&gt;b AND x&lt;&gt;NULL</code>. The last term is UNKNOWN, so the whole thing is never TRUE. It also can’t be planned as a hash anti-join.', fix: 'Use <code>NOT EXISTS</code>. If you must use NOT IN, add <code>WHERE manager_id IS NOT NULL</code> inside the subquery.' },
    { trap: '<code>&lt;&gt;</code> and <code>NOT (…)</code> silently drop NULL rows', code: `WHERE status <> 'cancelled'      -- rows with status NULL excluded too`, why: 'NOT UNKNOWN is still UNKNOWN. Negating a condition doesn’t give you “all the other rows”.', fix: '<code>WHERE status IS DISTINCT FROM \'cancelled\'</code>, or make the column NOT NULL.' },
    { trap: 'COUNT(col) and AVG skip NULLs', code: `SELECT avg(bonus) FROM emp;   -- 500, not 300`, why: 'Aggregates other than <code>COUNT(*)</code> ignore NULL inputs. SUM over zero non-NULL rows returns NULL, not 0.', fix: 'Decide what NULL means: <code>avg(COALESCE(bonus,0))</code> if it means zero; <code>COALESCE(sum(x), 0)</code> for empty sets.' },
    { trap: 'UNIQUE lets duplicate NULLs in', code: `CREATE TABLE t (email text UNIQUE);\nINSERT INTO t VALUES (NULL), (NULL);   -- both succeed`, why: 'NULLs are not equal to each other, so they don’t conflict. Same for multi-column UNIQUE where any column is NULL, which breaks “one row per (tenant, external_id)” rules.', fix: 'PG15+: <code>UNIQUE NULLS NOT DISTINCT</code>. Older: a partial unique index, or a unique index on <code>COALESCE(col, \'\')</code>.' },
    { trap: 'CHECK passes on UNKNOWN', code: `CHECK (bonus >= 0)   -- bonus NULL passes`, why: 'A CHECK fails only when the expression is FALSE. WHERE needs TRUE; CHECK just needs not-FALSE.', fix: 'Add <code>NOT NULL</code> if the value is required, or write <code>CHECK (bonus IS NOT NULL AND bonus &gt;= 0)</code>.' },
    { trap: 'DESC puts NULLs first', code: `ORDER BY last_login DESC LIMIT 10   -- 10 users who never logged in`, why: 'Postgres sorts NULL as larger than every value: last in ASC, first in DESC.', fix: 'Write <code>NULLS LAST</code> explicitly. An index must match (<code>CREATE INDEX … (last_login DESC NULLS LAST)</code>) to serve the sort.' },
    { trap: 'String concatenation with NULL', code: `SELECT first || ' ' || middle || ' ' || last  -- NULL if middle is NULL`, why: 'Operators on NULL return NULL. Postgres treats <code>\'\'</code> as a real value (unlike Oracle).', fix: '<code>concat_ws(\' \', first, middle, last)</code> skips NULLs.' }
  ],
  scenarios: [
    { title: 'Win-back campaign selected 0 customers',
      symptom: 'The nightly job “customers with no orders in 90 days” returned 0 rows the day guest checkout launched.',
      diagnose: `SELECT count(*) FROM orders WHERE customer_id IS NULL;   -- guest orders`,
      cause: '<code>WHERE id NOT IN (SELECT customer_id FROM orders WHERE …)</code>: one NULL customer_id made every comparison UNKNOWN.',
      fix: 'Rewrite as NOT EXISTS; add a test with a NULL in the subquery.',
      fixCode: `SELECT c.id FROM customers c\nWHERE NOT EXISTS (\n  SELECT 1 FROM orders o\n  WHERE o.customer_id = c.id AND o.created_at > now() - interval '90 days');` },
    { title: 'Duplicate integrations despite a unique constraint',
      symptom: 'Two rows for the same tenant with <code>external_id</code> NULL keep breaking the sync job.',
      diagnose: `SELECT tenant_id, count(*) FROM integrations\nWHERE external_id IS NULL GROUP BY 1 HAVING count(*) > 1;`,
      cause: '<code>UNIQUE (tenant_id, external_id)</code> treats rows with a NULL external_id as distinct.',
      fix: 'On PG15+, recreate the constraint with NULLS NOT DISTINCT (after cleaning duplicates).',
      fixCode: `ALTER TABLE integrations\n  ADD CONSTRAINT integrations_uq UNIQUE NULLS NOT DISTINCT (tenant_id, external_id);` },
    { title: '“Recently active users” widget shows people who never logged in',
      symptom: 'The admin dashboard’s top 10 is full of brand-new accounts.',
      diagnose: `SELECT count(*) FROM users WHERE last_login IS NULL;`,
      cause: '<code>ORDER BY last_login DESC</code> puts NULLs first in Postgres.',
      fix: 'Add NULLS LAST, and build the index with the same ordering so the query stays an index scan.',
      fixCode: `CREATE INDEX ON users (last_login DESC NULLS LAST);\nSELECT * FROM users ORDER BY last_login DESC NULLS LAST LIMIT 10;` }
  ],
  puzzles: [
    { kind: 'predict', q: 'How many rows?', code: `SELECT name FROM emp WHERE id NOT IN (SELECT manager_id FROM emp);`, options: ['0', '2', '3', '5'], answer: 0, explain: 'Asha’s manager_id is NULL, so every NOT IN test is UNKNOWN: <b>0 rows</b>.' },
    { kind: 'predict', q: 'How many rows?', code: `SELECT name FROM emp WHERE dept <> 'Sales';`, options: ['1', '2', '3', '4'], answer: 1, explain: 'Asha and Ben (Eng). Dina’s dept is NULL → UNKNOWN → dropped: <b>2</b>.' },
    { kind: 'predict', q: 'What are the three numbers?', code: `SELECT count(*), count(bonus), count(DISTINCT dept) FROM emp;`, options: ['5, 3, 2', '5, 5, 3', '5, 3, 3', '3, 3, 2'], answer: 0, explain: '5 rows; 3 non-NULL bonuses (1000, 500, 0); DISTINCT dept ignores NULL: Eng, Sales = 2.' },
    { kind: 'predict', q: 'What does this return?', code: `SELECT NULL = NULL AS a, NULL IS NOT DISTINCT FROM NULL AS b, (NULL AND false) AS c;`, options: ['NULL, true, NULL', 'true, true, false', 'NULL, true, false', 'NULL, NULL, false'], answer: 2, explain: 'NULL = NULL is UNKNOWN (NULL). IS NOT DISTINCT FROM treats them as equal (true). FALSE AND anything is FALSE.' },
    { kind: 'predict', q: 'Who comes first?', code: `SELECT name FROM emp ORDER BY bonus DESC LIMIT 1;`, options: ['Asha (1000)', 'someone with bonus NULL (Ben or Dina)', 'Eli (0)', 'error'], answer: 1, explain: 'DESC defaults to NULLS FIRST. Ben and Dina both have NULL; which of them comes first is arbitrary without a tie-breaker, but it is never Asha.' },
    { kind: 'predict', q: 'How many rows end up in the table?', code: `CREATE TABLE p (a int, b int, UNIQUE (a, b));\nINSERT INTO p VALUES (1, NULL), (1, NULL), (1, 2);\nSELECT count(*) FROM p;`, options: ['1', '2', '3', 'error on 2nd insert'], answer: 2, explain: 'Rows with a NULL in a unique column never conflict: all <b>3</b> are accepted.' }
  ],
  interview: [
    { q: 'Why does <code>NOT IN</code> return no rows when the subquery contains a NULL?', a: '<p><code>x NOT IN (list)</code> expands to <code>x &lt;&gt; v1 AND x &lt;&gt; v2 …</code>. With a NULL, one term is UNKNOWN; AND with UNKNOWN can be FALSE or UNKNOWN but never TRUE, and WHERE keeps only TRUE. <code>NOT EXISTS</code> checks whether a TRUE match exists, so NULLs don’t affect it.</p>', fu: 'How does the planner treat each? (NOT EXISTS → Hash Anti Join; NOT IN → hashed SubPlan, can’t become an anti-join because of NULL semantics.)', lvl: 'core' },
    { q: 'Explain WHERE vs CHECK with UNKNOWN.', a: '<p>WHERE, JOIN ON and HAVING keep a row only if the condition is TRUE. CHECK constraints reject only FALSE, so UNKNOWN passes: <code>CHECK (price &gt; 0)</code> accepts NULL. Combine with NOT NULL when required.</p>', lvl: 'core' },
    { q: 'COUNT(*) vs COUNT(col) vs COUNT(DISTINCT col)?', a: '<p>COUNT(*) counts rows. COUNT(col) counts non-NULL values. COUNT(DISTINCT col) counts distinct non-NULL values. In a LEFT JOIN, COUNT(right.id) gives 0 for unmatched rows while COUNT(*) gives 1.</p>', lvl: 'core' },
    { q: 'How does Postgres treat NULLs in UNIQUE constraints, and what changed in PG15?', a: '<p>By default NULLs are distinct, so any number of rows may have NULL in a unique column (or in any column of a composite key). PG15 added <code>NULLS NOT DISTINCT</code> for constraints and unique indexes, making NULLs collide.</p>', fu: 'How did you do it before 15? (Partial unique index <code>WHERE col IS NULL</code> on the other columns, or an expression index with COALESCE.)', lvl: 'deep' },
    { q: 'Where are NULLs treated as equal in SQL?', a: '<p>GROUP BY, DISTINCT, UNION/INTERSECT/EXCEPT, PARTITION BY, and <code>IS [NOT] DISTINCT FROM</code> all treat NULLs as one group. Comparisons (<code>=</code>, IN, JOIN ON) don’t.</p>', lvl: 'deep' },
    { q: 'What is the default NULL ordering and why does it matter for indexes?', a: '<p>NULL sorts as larger than all values: ASC → NULLS LAST, DESC → NULLS FIRST. A B-tree can be scanned backwards, so an index on <code>(x)</code> serves <code>ORDER BY x DESC NULLS FIRST</code> but not <code>DESC NULLS LAST</code>; that needs an index declared <code>(x DESC NULLS LAST)</code>.</p>', lvl: 'deep' },
    { q: 'Is <code>IS NOT DISTINCT FROM</code> index-friendly?', a: '<p>Not as a B-tree index condition in Postgres; it is evaluated as a filter. For lookups where NULL should match NULL, prefer <code>col = $1 OR (col IS NULL AND $1 IS NULL)</code>, which can use index scans for both branches, or model NULL away.</p>', lvl: 'deep' },
    { q: 'What does <code>ROW(NULL, 1) IS NULL</code> return?', a: '<p>FALSE, and <code>ROW(NULL, 1) IS NOT NULL</code> is also FALSE. For rows, IS NULL means all fields are NULL and IS NOT NULL means all are non-NULL. Use <code>IS DISTINCT FROM NULL</code> for “the row value itself is not null”.</p>', lvl: 'deep' },
    { q: 'How do you avoid division by zero and NULL surprises in ratios?', a: '<p><code>sum(a) / NULLIF(sum(b), 0)</code> returns NULL instead of an error; wrap with COALESCE if the UI needs 0. Remember <code>sum()</code> over no rows is NULL.</p>', lvl: 'core' },
    { q: 'Should a column be nullable?', a: '<p>Default to NOT NULL. Allow NULL only when “unknown/not applicable” is a real state you’ll handle in every query. Many NULL bugs disappear once columns are NOT NULL with sensible defaults.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Java null vs SQL NULL in JDBC', lang: 'java', code: `// getInt returns 0 for SQL NULL! check wasNull or use getObject
int bonus = rs.getInt("bonus");               // 0 for NULL: indistinguishable from a real 0
Integer bonus2 = rs.getObject("bonus", Integer.class);   // null for NULL

// binding NULL: say the type
ps.setNull(1, Types.INTEGER);` },
    { title: 'Spring Data derived queries and null parameters', lang: 'java', code: `// findByDept(null) generates "dept IS NULL" in Spring Data JPA derived queries,
List<Emp> findByDept(String dept);

// but a hand-written @Query does NOT: "dept = null" is UNKNOWN → 0 rows
@Query("select e from Emp e where e.dept = :dept")
List<Emp> byDept(String dept);
// fix: "where (:dept is null and e.dept is null) or e.dept = :dept"` }
  ]
});

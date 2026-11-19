IA.register({
  track: 'sql',
  slug: 'recursive-ctes',
  title: 'Recursive CTEs',
  tagline: '<code>WITH RECURSIVE</code> isn’t really recursion. It’s a <b>loop</b>: run the anchor once, then keep feeding the <i>last iteration’s</i> new rows back into the recursive term until it returns nothing.',
  tldr: {
    problem: 'Trees (org charts, categories, comment threads) and graphs (dependencies, routes) have unknown depth. Fixed self-joins can’t walk them, and bad data with a cycle turns the query into an infinite loop.',
    model: 'result = anchor; working = anchor. Loop: <code>new = recursive_term(working)</code>; with UNION drop rows already in result; append to result; <code>working = new</code>; stop when new is empty. The recursive term only ever sees the <b>working table</b>, not the whole result.',
    hook: 'UNION instead of UNION ALL only stops a cycle if the repeated rows are <i>identical</i>. Add a <code>depth</code> column and every lap of the cycle is a “new” row: infinite loop.',
    facts: [
      { v: 'PG14+', l: 'adds the standard <code>SEARCH</code> and <code>CYCLE</code> clauses' },
      { v: '1 ref', l: 'to itself allowed in the recursive term, and not inside a subquery or aggregate' },
      { v: 'no cap', l: 'on iterations: Postgres has no recursion limit. A timeout is your only guard' }
    ]
  },
  intro: {
    what: 'Some data points at itself: each employee row has a <code>manager_id</code> pointing to another employee. To list “everyone under Ada, at any depth”, you’d need to join the table to itself an unknown number of times. A <b>recursive CTE</b> does that: it repeats a query, level by level, until no new rows appear.',
    analogy: { icon: '🌳', title: 'A phone tree', text: 'The boss calls her direct reports. Each of them calls their own reports, and so on. Each round, only the people who were <i>just</i> called make calls. When a round produces no new calls, everyone has been reached.' },
    steps: [
      { t: 'The anchor: where to start', d: 'A normal query that returns the starting rows.', code: 'SELECT id, name FROM emp WHERE id = 1   -- Ada' },
      { t: 'The recursive term: one step further', d: 'Joins the table to the rows found in the previous round.', code: 'SELECT e.id, e.name\nFROM emp e JOIN org o ON e.manager_id = o.id' },
      { t: 'Glue them with UNION ALL', d: 'Inside <code>WITH RECURSIVE</code>.', code: 'WITH RECURSIVE org AS (\n  SELECT id, name FROM emp WHERE id = 1\n  UNION ALL\n  SELECT e.id, e.name FROM emp e JOIN org o ON e.manager_id = o.id\n)\nSELECT * FROM org;' },
      { t: 'It stops by itself', d: 'When a round finds nobody new. If the data has a loop (A manages B manages A), it never stops, so you add a guard.' }
    ],
    widget: 'recursive-ctes-intro',
    terms: [
      ['anchor', 'The non-recursive first part; runs once.'],
      ['recursive term', 'The part that references the CTE itself; runs once per iteration.'],
      ['working table', 'The rows produced by the previous iteration: the only input the recursive term sees.'],
      ['cycle', 'Data that loops back (A → B → A). Makes naive recursion infinite.'],
      ['path array', 'An array of ids visited so far, used to detect cycles and to sort a tree.']
    ]
  },
  visual: {
    title: 'Iterations of the working table',
    caption: 'Each step runs the recursive term against the coloured nodes only. Switch on the <b>cycle</b>, then try each guard: UNION ALL loops forever, UNION with a depth column also loops, UNION on id alone and the path array both stop.'
  },
  playground: {
    setup: `
CREATE TABLE emp (id int PRIMARY KEY, name text, mgr int);
INSERT INTO emp VALUES (1,'Ada',NULL),(2,'Bo',1),(3,'Cy',1),(4,'Di',2),(5,'Ed',2),(6,'Fa',3),(7,'Gu',4);
CREATE TABLE emp_cyc AS SELECT id, name, CASE WHEN id = 1 THEN 7 ELSE mgr END AS mgr FROM emp;
CREATE TABLE edges (src text, dst text, km int);
INSERT INTO edges VALUES ('A','B',4),('A','C',1),('C','B',1),('B','D',5),('C','D',8),('D','A',3);`,
    presets: [
      { label: 'Org chart', sql: `WITH RECURSIVE org AS (\n  SELECT id, name, 0 AS depth, name::text AS chain\n  FROM emp WHERE mgr IS NULL\n  UNION ALL\n  SELECT e.id, e.name, o.depth + 1, o.chain || ' > ' || e.name\n  FROM emp e JOIN org o ON e.mgr = o.id\n)\nSELECT repeat('  ', depth) || name AS tree, depth, chain\nFROM org ORDER BY chain;`, note: 'Sorting by a text chain is a quick hack; it breaks when names collide or sort oddly. See SEARCH next.' },
      { label: 'SEARCH DEPTH/BREADTH', sql: `WITH RECURSIVE org AS (\n  SELECT id, name, mgr FROM emp WHERE mgr IS NULL\n  UNION ALL\n  SELECT e.id, e.name, e.mgr FROM emp e JOIN org o ON e.mgr = o.id\n) SEARCH DEPTH FIRST BY id SET ord\nSELECT name, ord FROM org ORDER BY ord;\n\nWITH RECURSIVE org AS (\n  SELECT id, name, 0 AS lvl FROM emp WHERE mgr IS NULL\n  UNION ALL\n  SELECT e.id, e.name, o.lvl + 1 FROM emp e JOIN org o ON e.mgr = o.id\n) SEARCH BREADTH FIRST BY id SET ord\nSELECT name, lvl FROM org ORDER BY ord;`, note: 'PG14+. DEPTH FIRST builds an array of visited ids in <code>ord</code>; ORDER BY it gives a tree view. You still need ORDER BY: SEARCH only adds the column.' },
      { label: 'Cycle: CYCLE clause', sql: `WITH RECURSIVE org AS (\n  SELECT id, name, mgr FROM emp_cyc WHERE id = 1\n  UNION ALL\n  SELECT e.id, e.name, e.mgr FROM emp_cyc e JOIN org o ON e.mgr = o.id\n) CYCLE id SET is_cycle USING path\nSELECT name, is_cycle, path FROM org;`, note: 'emp_cyc has Ada reporting to Gu. The clause emits the row that closes the loop (is_cycle = true) and stops following it.' },
      { label: 'Cycle: path array', sql: `WITH RECURSIVE org AS (\n  SELECT id, name, ARRAY[id] AS path FROM emp_cyc WHERE id = 1\n  UNION ALL\n  SELECT e.id, e.name, o.path || e.id\n  FROM emp_cyc e JOIN org o ON e.mgr = o.id\n  WHERE e.id <> ALL (o.path)\n)\nSELECT name, path FROM org;`, note: 'The pre-PG14 way. <code>&lt;&gt; ALL</code> on an array is linear in depth; fine for trees, costly for deep graphs.' },
      { label: 'Shortest path', sql: `WITH RECURSIVE r AS (\n  SELECT dst AS node, km AS cost, ARRAY['A', dst] AS route FROM edges WHERE src = 'A'\n  UNION ALL\n  SELECT e.dst, r.cost + e.km, r.route || e.dst\n  FROM edges e JOIN r ON e.src = r.node\n  WHERE e.dst <> ALL (r.route)        -- no revisits\n)\nSELECT route, cost FROM r WHERE node = 'D' ORDER BY cost LIMIT 1;`, note: 'Enumerates every simple path, which grows exponentially with graph size. Fine for tiny graphs; for real routing use pgRouting or application code.' },
      { label: 'Generators', sql: `WITH RECURSIVE fib(a, b) AS (SELECT 0::bigint, 1::bigint\n  UNION ALL SELECT b, a + b FROM fib WHERE b < 100)\nSELECT a FROM fib;\n\n-- infinite, but LIMIT stops it: rows are pulled lazily\nWITH RECURSIVE t(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM t)\nSELECT n FROM t LIMIT 5;`, note: 'The LIMIT trick works only because the outer query pulls rows on demand. Add an ORDER BY or aggregate and it runs forever.' }
    ]
  },
  gotchas: [
    { trap: 'UNION doesn’t save you from a cycle if rows carry depth or path', why: 'UNION removes only exact duplicates. Each lap adds 1 to depth, so every row is distinct and the loop never ends.', fix: 'Use the path array check or PG14’s <code>CYCLE</code> clause. Keep UNION for the case where the row is just the id.' },
    { trap: 'No recursion limit', why: 'Postgres has no MAXRECURSION. A cycle runs until statement_timeout fires, or the temp space for the result fills the disk.', fix: 'Set <code>statement_timeout</code> for the role, add a depth guard (<code>WHERE o.depth &lt; 50</code>), and add constraints/triggers that prevent cycles on write.' },
    { trap: 'Expecting the recursive term to see all previous rows', code: `SELECT … FROM emp e JOIN org o ON …\nWHERE e.id NOT IN (SELECT id FROM org)   -- ERROR: recursive reference in subquery`, why: 'The recursive term may reference the CTE once, and that reference is only the working table (the last iteration).', fix: 'Carry what you need in the row (a path array), or use UNION to drop rows already in the result.' },
    { trap: 'Graph shortest path by enumeration', why: 'Without visited-set pruning across branches, every simple path is enumerated: exponential in a dense graph. You can’t keep a global “best so far” in SQL.', fix: 'Small graphs only. Use pgRouting, or BFS in the application with a visited set.' },
    { trap: 'Mixing types between anchor and recursive term', code: `SELECT 'Ada' AS chain … UNION ALL SELECT o.chain || ' > ' || e.name …\n-- ERROR: recursive query "org" column 2 has type character varying(3)
--        in non-recursive term but type character varying overall`, why: 'The column type is fixed by the anchor. A <code>varchar(3)</code> or an unknown literal clashes with a longer concatenation.', fix: 'Cast in the anchor: <code>name::text</code>, <code>0::bigint</code>, <code>ARRAY[id]::int[]</code>.' },
    { trap: 'ORDER BY inside the recursion isn’t a tree order', why: 'Iteration order is breadth-first-ish but not guaranteed. A flat <code>ORDER BY depth</code> loses parent/child grouping.', fix: 'Use <code>SEARCH DEPTH FIRST BY … SET ord</code> (PG14+) or a path array, then ORDER BY it.' }
  ],
  scenarios: [
    { title: 'API timeouts and a full temp disk after a data import',
      symptom: 'The “category breadcrumbs” endpoint started timing out, then the DB alerted on 100% disk usage from temp files.',
      diagnose: `SELECT pid, now() - query_start, query FROM pg_stat_activity\nWHERE query ILIKE '%WITH RECURSIVE%' ORDER BY 2 DESC;\n-- then find the loop:\nWITH RECURSIVE c AS (SELECT id, parent_id, ARRAY[id] p FROM categories\n  UNION ALL SELECT x.id, x.parent_id, c.p || x.id FROM categories x JOIN c ON x.id = c.parent_id\n  WHERE x.id <> ALL (c.p)) SELECT * FROM c WHERE parent_id = ANY (p);`,
      cause: 'An import made category 812 its own grandparent. The breadcrumb CTE used UNION ALL and no guard, so each request looped until the disk filled.',
      fix: 'Kill the sessions, fix the data, add a CYCLE clause or path guard, set a role-level statement_timeout, and validate parents on write.',
      fixCode: `ALTER ROLE api SET statement_timeout = '5s';\n... ) CYCLE id SET is_cycle USING path` },
    { title: 'Permission check took 3 s for one user',
      symptom: '“Can user X see document Y?” walked a group-membership graph. Most users: 2 ms. One admin: 3 s.',
      diagnose: `EXPLAIN (ANALYZE) WITH RECURSIVE g AS (...) SELECT ...;\n-- WorkTable Scan loops=14, rows=2.1M`,
      cause: 'Groups nested in groups through many paths (a diamond-heavy DAG). UNION ALL revisited the same group once per path: millions of duplicate rows.',
      fix: 'Use UNION on just the group id, so each group is visited once. Precompute a closure table for hot paths.',
      fixCode: `WITH RECURSIVE g(id) AS (\n  SELECT group_id FROM memberships WHERE user_id = $1\n  UNION                                 -- dedup: each group once\n  SELECT m.parent_group FROM group_edges m JOIN g ON m.child_group = g.id)\nSELECT EXISTS (SELECT 1 FROM acl WHERE doc_id = $2 AND group_id IN (SELECT id FROM g));` }
  ],
  puzzles: [
    { kind: 'predict', q: 'How many rows?', code: `WITH RECURSIVE org AS (\n  SELECT id FROM emp WHERE id = 2\n  UNION ALL\n  SELECT e.id FROM emp e JOIN org o ON e.mgr = o.id)\nSELECT count(*) FROM org;`, options: ['3', '4', '5', '7'], answer: 1, explain: 'Bo, then Di and Ed, then Gu: <b>4</b>.' },
    { kind: 'predict', q: 'Max depth from Ada?', code: `WITH RECURSIVE org AS (\n  SELECT id, 0 AS d FROM emp WHERE mgr IS NULL\n  UNION ALL\n  SELECT e.id, o.d + 1 FROM emp e JOIN org o ON e.mgr = o.id)\nSELECT max(d) FROM org;`, options: ['2', '3', '4', '6'], answer: 1, explain: 'Ada → Bo → Di → Gu: <b>3</b>.' },
    { kind: 'predict', q: 'On the cyclic table, does this terminate, and with how many rows?', code: `WITH RECURSIVE org AS (\n  SELECT id FROM emp_cyc WHERE id = 1\n  UNION\n  SELECT e.id FROM emp_cyc e JOIN org o ON e.mgr = o.id)\nSELECT count(*) FROM org;`, options: ['Runs forever', '7', '8', 'Error: cycle detected'], answer: 1, explain: 'The row is just the id. When Ada comes back, UNION discards the duplicate, so the working table empties: <b>7</b>.' },
    { kind: 'predict', q: 'How many rows does the CYCLE clause version return?', code: `WITH RECURSIVE org AS (\n  SELECT id, mgr FROM emp_cyc WHERE id = 1\n  UNION ALL\n  SELECT e.id, e.mgr FROM emp_cyc e JOIN org o ON e.mgr = o.id\n) CYCLE id SET is_cycle USING path\nSELECT count(*) FROM org;`, options: ['7', '8', '6', 'Runs forever'], answer: 1, explain: 'The 7 employees, plus one extra row for Ada reached again via Gu, marked <code>is_cycle = true</code> and not expanded: <b>8</b>.' },
    { kind: 'predict', q: 'Max value?', code: `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i * 2 FROM n WHERE i < 100)\nSELECT max(i) FROM n;`, options: ['64', '100', '128', '256'], answer: 2, explain: 'The WHERE tests the <i>previous</i> value: 64 &lt; 100, so 128 is produced; then 128 fails the test and recursion stops. <b>128</b>.' },
    { kind: 'predict', q: 'What happens?', code: `WITH RECURSIVE t(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM t)\nSELECT n FROM t LIMIT 3;`, options: ['Runs forever', '3 rows: 1, 2, 3', 'Error: no termination condition', '1 row'], answer: 1, explain: 'The executor pulls rows lazily, and LIMIT stops pulling after 3. Works, but is fragile: any ORDER BY or aggregate on top makes it infinite.' }
  ],
  interview: [
    { q: 'How does Postgres execute WITH RECURSIVE?', a: '<p>Iteratively. Evaluate the anchor → put rows in the result and the working table. Repeat: evaluate the recursive term with the CTE reference bound to the working table, (UNION: discard rows already seen), append to the result, the output becomes the new working table. Stop when it’s empty. In EXPLAIN: <code>Recursive Union</code> with a <code>WorkTable Scan</code>.</p>', lvl: 'core' },
    { q: 'How do you detect cycles?', a: '<p>PG14+: <code>CYCLE id SET is_cycle USING path</code>. It tracks visited ids in an array, emits the closing row flagged, and stops there. Before 14: carry <code>ARRAY[id]</code>, append each step, filter <code>WHERE e.id &lt;&gt; ALL (path)</code>. UNION alone works only if rows are exactly repeated.</p>', fu: 'Why doesn’t UNION help when you also select depth?', lvl: 'core' },
    { q: 'What do SEARCH BREADTH FIRST and DEPTH FIRST do?', a: '<p>PG14+. They add an ordering column (<code>SET ord</code>) you can ORDER BY: depth-first gives a tree listing (each parent followed by its subtree), breadth-first gives level by level. They don’t change execution, only the computed column.</p>', lvl: 'deep' },
    { q: 'UNION vs UNION ALL in a recursive CTE?', a: '<p>UNION ALL keeps everything and is cheaper. UNION deduplicates against everything produced so far (hash table of all rows), which terminates cycles on pure-id rows and avoids re-walking diamond-shaped DAGs, at a memory cost.</p>', lvl: 'core' },
    { q: 'Why is shortest path in SQL a bad idea at scale?', a: '<p>The recursive term can’t see a global “best distance so far”, so it can’t prune like Dijkstra. It enumerates every simple path, which grows exponentially. Use pgRouting, a graph database, or BFS in code over an adjacency list.</p>', lvl: 'deep' },
    { q: 'Alternatives to recursive CTEs for trees?', a: '<p><b>ltree</b> materialized paths (<code>path &lt;@ \'1.2\'</code> with a GiST index), <b>closure tables</b> (ancestor, descendant, depth) for O(1) subtree queries, <b>nested sets</b> for read-heavy rarely-changing trees. Adjacency list plus a recursive CTE is the simplest to write to.</p>', lvl: 'deep' },
    { q: 'What restrictions apply to the recursive term?', a: '<p>It may reference the CTE only once, not in a subquery, not on the nullable side of an outer join, and not inside aggregates or window functions. Column types are fixed by the anchor.</p>', lvl: 'deep' },
    { q: 'How do you protect production from runaway recursion?', a: '<p><code>statement_timeout</code> per role, a depth bound in the recursive WHERE, cycle-proof writes (trigger or check before update of parent), and <code>temp_file_limit</code> so one query can’t fill the disk.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Subtree ids for a category filter', lang: 'java', code: `@Query(value = """
  WITH RECURSIVE sub AS (
    SELECT id FROM category WHERE id = :root
    UNION
    SELECT c.id FROM category c JOIN sub s ON c.parent_id = s.id)
  SELECT p.* FROM product p WHERE p.category_id IN (SELECT id FROM sub)""",
  nativeQuery = true)
Page<Product> findInSubtree(@Param("root") long root, Pageable page);`, note: 'With a Page return type Spring also needs a <code>countQuery</code> for native queries. UNION (not ALL) keeps it safe against accidental cycles.' },
    { title: 'Don’t walk trees with lazy loading', lang: 'java', code: `// N+1 per level: one SELECT for each node's children
void walk(Category c) { for (Category k : c.getChildren()) walk(k); }

// one query instead: load the subtree flat, build the tree in memory
Map<Long, List<Row>> byParent = rows.stream()
    .collect(Collectors.groupingBy(Row::parentId));` }
  ]
});

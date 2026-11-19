IA.register({
  track: 'sql',
  slug: 'why-sql',
  title: 'What SQL is & why it lasts',
  tagline: 'SQL is <b>declarative</b>: you describe the result, and the database’s <b>planner</b> chooses how to get it. That one idea, on top of the relational model, is why a query written in 1995 still runs well on today’s data.',
  tldr: {
    problem: 'Developers who think of SQL as “a loop over a table” fight the optimizer, fetch everything into Java, and reimplement joins, constraints and transactions by hand.',
    model: 'Data lives in <b>relations</b> (tables of typed rows). A query is an expression over relations. The engine parses it, the planner picks a plan from statistics, the executor runs it, inside a transaction.',
    hook: '“Same query, 1000× faster after CREATE INDEX, and I didn’t change a line.” That is declarative.',
    facts: [
      { v: '1970', l: 'Codd’s relational model paper; SQL followed at IBM in the 1970s and became an ANSI standard in 1986' },
      { v: '4 families', l: 'DDL (shape), DML (rows), DCL (permissions), TCL (transactions)' },
      { v: 'free', l: 'ACID transactions, constraints, concurrency control and a cost-based optimizer come with every Postgres table' }
    ]
  },
  intro: {
    what: '<b>SQL</b> (Structured Query Language) is how you talk to a relational database. You describe <i>what</i> data you want, such as “customers in Pune, sorted by name”, and the database works out <i>how</i> to find it quickly.',
    analogy: { icon: '🚕', title: 'A taxi, not a map', text: 'With a map you plan every turn yourself (imperative code). With a taxi you say the address and the driver picks the route, using live traffic (the planner and its statistics). If a new road opens, your instruction doesn’t change.' },
    steps: [
      { t: 'Tables hold facts', d: 'Each row is one fact; each column has a type.', code: 'CREATE TABLE customers (id int PRIMARY KEY, name text, city text);' },
      { t: 'Ask for a result', d: 'No loops: you describe the rows you want.', code: "SELECT name FROM customers WHERE city = 'Pune' ORDER BY name;" },
      { t: 'The planner chooses how', d: '<code>EXPLAIN</code> shows the chosen plan: full scan, index, join method…', code: "EXPLAIN SELECT name FROM customers WHERE city = 'Pune';" },
      { t: 'Change data safely', d: 'Transactions group changes so they all happen or none do.', code: "BEGIN;\nUPDATE customers SET city = 'Mumbai' WHERE id = 1;\nCOMMIT;" }
    ],
    terms: [
      ['declarative', 'You say what result you want, not the steps.'],
      ['relation', 'The formal name for a table: a set of rows with the same columns.'],
      ['planner / optimizer', 'The part of the DB that picks the cheapest way to run a query.'],
      ['transaction', 'A group of statements that succeed or fail together.'],
      ['constraint', 'A rule the DB enforces, like NOT NULL or UNIQUE.'],
      ['EXPLAIN', 'Shows the plan the DB will use for a query.']
    ]
  },
  visual: {
    title: 'You say WHAT, the planner picks HOW',
    caption: 'Change the table size, the index and the filter, then press Play. The SQL stays the same; the chosen plan changes.'
  },
  extras: [
    { id: 'why-sql-model', title: 'The relational model in one picture', label: 'Model', caption: 'Relations, tuples, attributes, keys, and the four families of SQL statements.' }
  ],
  playground: {
    setup: `
CREATE TABLE customers (id int PRIMARY KEY, name text NOT NULL, email text UNIQUE, city text NOT NULL);
INSERT INTO customers SELECT g, 'cust' || g, 'c' || g || '@x.io',
  CASE WHEN g % 1000 = 0 THEN 'Pune' WHEN g % 5 < 2 THEN 'Mumbai' ELSE 'Delhi' END
FROM generate_series(1, 20000) g;
CREATE TABLE orders (id int PRIMARY KEY, customer_id int NOT NULL REFERENCES customers(id), amount numeric(10,2) CHECK (amount > 0));
INSERT INTO orders SELECT g, (g * 7) % 20000 + 1, (g % 90) + 10 FROM generate_series(1, 30000) g;
ANALYZE;`,
    presets: [
      { label: 'Plan: no index', sql: `EXPLAIN SELECT name FROM customers WHERE city = 'Pune';`, note: 'Only a Seq Scan is possible.' },
      { label: 'Same query + index', sql: `CREATE INDEX ON customers (city);\nANALYZE customers;\nEXPLAIN SELECT name FROM customers WHERE city = 'Pune';\nEXPLAIN SELECT name FROM customers WHERE city = 'Delhi';`, note: 'Rare value (0.1%) → bitmap index scan. Common value (60%) → still a Seq Scan. Same SQL text.' },
      { label: 'DDL is transactional', sql: `BEGIN;\nALTER TABLE customers ADD COLUMN vip boolean DEFAULT false;\nROLLBACK;\nSELECT column_name FROM information_schema.columns WHERE table_name = 'customers' ORDER BY ordinal_position;`, note: 'The column is gone: Postgres can roll back schema changes.' },
      { label: 'Constraints for free', sql: `INSERT INTO orders VALUES (99999, 424242, 10);`, note: 'Foreign key violation: customer 424242 doesn’t exist.' },
      { label: 'Join, declaratively', sql: `EXPLAIN SELECT c.city, sum(o.amount)\nFROM customers c JOIN orders o ON o.customer_id = c.id\nGROUP BY c.city;`, note: 'You didn’t pick hash join vs nested loop. The planner did.' },
      { label: 'DCL', sql: `CREATE ROLE analyst;\nGRANT SELECT ON orders TO analyst;\nSELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name = 'orders' AND grantee = 'analyst';` }
    ]
  },
  gotchas: [
    { trap: 'Writing SQL as a loop in Java', code: `for (Customer c : repo.findAll())          // 20,000 rows over the wire\n  if (c.getCity().equals("Pune")) result.add(c);`, why: 'All rows cross the network, no index is used, and memory grows with the table.', fix: 'Push filters, joins and aggregates into SQL; fetch only the result.' },
    { trap: 'Expecting an order without ORDER BY', why: 'A relation is a set: without ORDER BY Postgres returns rows in whatever order the plan produces, which changes with plans, parallelism and synchronized scans.', fix: 'Always add ORDER BY when order matters, including for pagination.' },
    { trap: 'Hints and “forcing” plans', why: 'Postgres has no built-in optimizer hints. Fighting the planner usually means stale statistics or a missing index.', fix: 'Run <code>ANALYZE</code>, check <code>EXPLAIN (ANALYZE, BUFFERS)</code>, fix estimates or indexes. Extensions like pg_hint_plan exist but are a last resort.' },
    { trap: 'Assuming “SQL” means the same everywhere', why: 'Dialects differ: <code>LIMIT</code> vs <code>FETCH FIRST</code>, upsert syntax, boolean types, identifier case.', fix: 'Learn standard SQL plus your engine’s extensions. Postgres folds unquoted identifiers to lower case.' },
    { trap: 'TRUNCATE is not a fast DELETE', why: 'It takes an ACCESS EXCLUSIVE lock, doesn’t fire row-level DELETE triggers, and fails on tables referenced by foreign keys unless you add CASCADE.', fix: 'Use it for staging tables. In Postgres it is transactional and can be rolled back.' }
  ],
  scenarios: [
    { title: 'Report got 50× slower overnight, no deploy',
      symptom: 'A query that took 40 ms now takes 2 s. The SQL didn’t change.',
      diagnose: `EXPLAIN (ANALYZE, BUFFERS) SELECT ...;\nSELECT relname, last_analyze, last_autoanalyze FROM pg_stat_user_tables;`,
      cause: 'A bulk load changed the data distribution; statistics were stale, so the planner misestimated rows and picked a nested loop.',
      fix: 'Run ANALYZE after bulk loads (autovacuum analyzes eventually, but not instantly).',
      fixCode: `ANALYZE orders;` },
    { title: 'Service OOM after a customer grew to 2M rows',
      symptom: 'An endpoint loads <code>findAll()</code> and filters in Java. It worked in testing.',
      diagnose: `SELECT count(*) FROM orders WHERE customer_id = 42;  -- now millions`,
      cause: 'Imperative filtering in the app: every row is fetched and materialized as an entity.',
      fix: 'Express the filter and aggregate in SQL and page through results.',
      fixCode: `SELECT date_trunc('day', created_at), sum(amount)\nFROM orders WHERE customer_id = $1 GROUP BY 1;` }
  ],
  puzzles: [
    { kind: 'predict', q: 'After this script, how many columns does <code>customers</code> have?', code: `BEGIN;\nALTER TABLE customers ADD COLUMN vip boolean;\nROLLBACK;\nSELECT count(*) FROM information_schema.columns WHERE table_name = 'customers';`, options: ['3', '4', '5', 'error'], answer: 1, explain: 'DDL is transactional in Postgres; the ADD COLUMN is rolled back. id, name, email, city: <b>4</b>.' },
    { kind: 'predict', q: 'What happens?', code: `INSERT INTO orders VALUES (99999, 1, 0);`, options: ['inserted', 'FK violation', 'CHECK violation', 'NOT NULL violation'], answer: 2, explain: 'Customer 1 exists, but <code>amount &gt; 0</code> fails: CHECK violation.' },
    { kind: 'predict', q: 'How many customers live in Pune?', code: `SELECT count(*) FROM customers WHERE city = 'Pune';`, options: ['2', '20', '200', '8000'], answer: 1, explain: 'Every 1000th id: 20000 / 1000 = <b>20</b>.' },
    { kind: 'concept', q: 'Which family does <code>GRANT</code> belong to?', options: ['DDL', 'DML', 'DCL', 'TCL'], answer: 2, explain: 'Data Control Language: GRANT and REVOKE.' },
    { kind: 'concept', q: 'You add an index and the same query becomes faster. Which property of SQL made that possible?', options: ['It is compiled', 'It is declarative: the planner chooses access paths', 'It caches results', 'Indexes rewrite the SQL'], answer: 1, explain: 'The query states the result; the planner is free to use the new index.' }
  ],
  interview: [
    { q: 'What does “declarative” mean for SQL, and why does it matter?', a: '<p>The query specifies the result set, not the algorithm. The optimizer picks access paths, join order and algorithms from statistics. Data growth, new indexes or upgrades can improve plans without code changes.</p>', lvl: 'core' },
    { q: 'Summarize the relational model.', a: '<p>Data is stored as relations (sets of tuples over typed attributes). Keys identify tuples; foreign keys relate them. Operators (select, project, join, union, difference) take relations and return relations, so queries compose.</p>', fu: 'How does SQL deviate from the pure model? (Bags with duplicates, NULLs and three-valued logic, ordered results.)', lvl: 'core' },
    { q: 'Name the SQL sub-languages with examples.', a: '<p>DDL: CREATE/ALTER/DROP. DML: SELECT/INSERT/UPDATE/DELETE/MERGE (PG15+ for MERGE). DCL: GRANT/REVOKE. TCL: BEGIN/COMMIT/ROLLBACK/SAVEPOINT.</p>', lvl: 'core' },
    { q: 'What do you get “for free” from a relational database?', a: '<p>ACID transactions, concurrency control (MVCC in Postgres), declarative constraints (PK, FK, UNIQUE, CHECK, exclusion), a cost-based optimizer, crash recovery via WAL, replication, permissions.</p>', lvl: 'core' },
    { q: 'Walk through what happens when Postgres runs a SELECT.', a: '<p>Parser → parse tree; analyzer resolves names and types; rewriter applies rules and views; planner enumerates paths and costs them with statistics; executor runs the plan tree, pulling tuples from nodes, inside the transaction’s snapshot.</p>', lvl: 'deep' },
    { q: 'Is DDL transactional in Postgres?', a: '<p>Yes, nearly all of it: you can ALTER several tables in one transaction and roll back. Exceptions include <code>CREATE INDEX CONCURRENTLY</code>, <code>CREATE DATABASE</code> and <code>VACUUM</code>, which can’t run in a transaction block.</p>', lvl: 'deep' },
    { q: 'Why has SQL outlived many “SQL killers”?', a: '<p>The declarative interface decouples applications from storage, so engines improve underneath. It is standardized, and most NoSQL systems eventually added SQL-like query languages.</p>', lvl: 'core' },
    { q: 'How does the planner know how many rows a filter returns?', a: '<p>From <code>pg_statistic</code> (exposed as <code>pg_stats</code>): null fraction, distinct counts, most-common values and histograms per column, gathered by ANALYZE. Extended statistics (<code>CREATE STATISTICS</code>) capture correlations between columns.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Push work into SQL', lang: 'java', code: `// imperative: fetch all, filter in Java
List<Customer> pune = repo.findAll().stream()
    .filter(c -> c.getCity().equals("Pune")).toList();

// declarative: let the DB filter and use an index
List<Customer> pune2 = repo.findByCityOrderByName("Pune");   // Spring Data derives the SQL` }
  ]
});

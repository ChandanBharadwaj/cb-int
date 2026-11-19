IA.register({
  track: 'sql',
  slug: 'tricky-50',
  title: '★ The Tricky 50',
  tagline: 'Fifty hard “what does this return / which plan / who waits” questions from every SQL topic, against the clock. Each one is a trap that has caused a real bug, and each answer was checked against real Postgres.',
  tldr: {
    problem: 'Senior SQL interviews rarely ask you to write a query from scratch. They show you one and ask what it returns, why it is slow, or what happens when two sessions run it at once.',
    model: 'Almost every trick is one of five things: <b>three-valued logic</b> (NULL), <b>row multiplication</b> (joins), <b>evaluation order</b> (WHERE → GROUP BY → HAVING → window → ORDER BY → LIMIT), <b>snapshots and locks</b> (MVCC), and <b>types</b> (implicit casts, rounding, overflow).',
    hook: '<code>WHERE id NOT IN (SELECT customer_id FROM orders)</code> returns nothing as soon as one order has a NULL customer. If you can explain why in one sentence, start the drill.',
    facts: [
      { v: '50', l: 'questions: NULL, joins, aggregates, windows, CTEs, indexes, types, MVCC & locking' },
      { v: '60 s', l: 'per question by default. Slow (90 s) and Fast (30 s) modes too' },
      { v: '39', l: 'of them are runnable SQL, each verified against a real Postgres (PGlite, PG18 engine)' }
    ]
  },
  intro: {
    what: 'This page is a <b>drill</b>, not a lesson. You get a short query or a two-session situation, a timer, and four answers. Answer in your head, as you would in an interview, then read the explanation. At the end you get your score per topic and a review of every miss, with links back to the topic pages.',
    analogy: { icon: '⏱️', title: 'Chess puzzles for SQL', text: 'Chess players improve by solving positions quickly, not by reading about openings. Each question here is a “position”: a small query where the obvious answer is wrong for a specific reason.' },
    steps: [
      { t: 'Read the query in execution order', d: 'FROM and JOINs first, then WHERE, GROUP BY, HAVING, window functions, SELECT, DISTINCT, ORDER BY, LIMIT. Most surprises come from an assumption about this order.', code: 'FROM → WHERE → GROUP BY → HAVING → WINDOW → SELECT → DISTINCT → ORDER BY → LIMIT' },
      { t: 'Hunt for NULLs', d: 'Any comparison with NULL is unknown, and WHERE keeps only true. Aggregates skip NULLs, except <code>count(*)</code>.' },
      { t: 'Count rows before you add them', d: 'For joins, first ask “how many rows does each row match?”. One-to-many joins multiply, outer joins pad.' },
      { t: 'For concurrency, draw a timeline', d: 'Two columns, one per session, one statement per line. Then ask: which snapshot does each read use, and which lock does each write wait for?' }
    ],
    terms: [
      ['three-valued logic', 'SQL conditions are true, false or unknown (NULL).'],
      ['fan-out', 'A join that repeats a row once per matching child row.'],
      ['frame', 'The set of rows a window function looks at for the current row.'],
      ['snapshot', 'Which committed transactions a query can see.'],
      ['implicit cast', 'A type conversion Postgres adds for you, sometimes on the wrong side of a comparison.']
    ]
  },
  visual: {
    title: 'The drill',
    caption: 'Pick a topic (or All), how many questions, and the time per question, then press Start. Skip counts as a miss. Your misses are listed at the end with explanations.'
  },
  playground: {
    setup: `
CREATE TABLE customers (id int PRIMARY KEY, name text NOT NULL);
CREATE TABLE orders (id int PRIMARY KEY, customer_id int, amount numeric, status text);
INSERT INTO customers VALUES (1,'Asha'),(2,'Ben'),(3,'Chen');
INSERT INTO orders VALUES (101,1,250,'paid'),(102,1,80,'void'),(103,2,40,'paid'),(104,NULL,99,'paid');`,
    presets: [
      { label: 'NOT IN vs NOT EXISTS', sql: `SELECT name FROM customers WHERE id NOT IN (SELECT customer_id FROM orders);\nSELECT name FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);`, note: 'Order 104 has a NULL customer_id. The first query returns 0 rows, the second returns Chen.' },
      { label: 'Evaluation order', sql: `SELECT customer_id, count(*) AS n,\n       rank() OVER (ORDER BY count(*) DESC) AS rk\nFROM orders\nWHERE status = 'paid'\nGROUP BY customer_id\nHAVING count(*) >= 1\nORDER BY rk\nLIMIT 2;`, note: 'WHERE filters rows, GROUP BY makes groups, HAVING filters groups, then the window function ranks the groups, then ORDER BY and LIMIT.' },
      { label: 'Frames and peers', sql: `SELECT x,\n  sum(x) OVER (ORDER BY x)                                      AS range_default,\n  sum(x) OVER (ORDER BY x ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS rows_frame,\n  last_value(x) OVER (ORDER BY x)                                AS last_default\nFROM (VALUES (1), (2), (2), (3)) t(x);`, note: 'The default frame is RANGE … CURRENT ROW, which includes peers (equal values).' },
      { label: 'Types that bite', sql: `SELECT 7 / 2 AS int_div, -7 / 2 AS neg,\n       0.1::float8 + 0.2 = 0.3 AS float_eq,\n       round(2.5::numeric) AS round_numeric, round(2.5::float8) AS round_float,\n       '10' < '9' AS text_cmp,\n       ('2024-01-31'::date + interval '1 month')::date AS plus_month;` }
    ]
  },
  gotchas: [
    { trap: 'Answering from another database’s rules', why: 'MySQL sorts NULLs first in ASC, SQL Server escalates locks, Oracle treats \'\' as NULL. Postgres does none of these.', fix: 'Say “in Postgres” and give the Postgres behaviour; mention the difference if you know it.' },
    { trap: 'Guessing plans without the data', why: 'Which plan wins depends on row counts, statistics and settings. An interviewer asking “which plan?” wants your reasoning.', fix: 'Say what would make each plan cheaper (selectivity, correlation, LIMIT, index-only eligibility), then pick.' },
    { trap: 'Forgetting that the batch is one transaction', why: 'Many tools (and this site’s playground) send several statements in one message, which Postgres runs as a single implicit transaction. <code>now()</code>, rollbacks and VACUUM behave differently than in an autocommit psql session.', fix: 'When the question involves transactions, write BEGIN/COMMIT explicitly and reason per statement.' }
  ],
  interview: [
    { q: 'How do you approach a “what does this query return?” question?', a: '<p>Out loud, in execution order: identify the row source (FROM/JOINs: how many rows, any fan-out or NULL padding?), then WHERE (any NULL comparisons?), grouping, windows (frame, peers), then ORDER BY/LIMIT. Write the intermediate row count down. Interviewers grade the reasoning more than the final number.</p>', lvl: 'core' },
    { q: 'How do you reason about a two-session concurrency question?', a: '<p>Draw a timeline with one column per session. For each statement, note the snapshot it uses (READ COMMITTED: per statement; REPEATABLE READ/SERIALIZABLE: per transaction) and the locks it takes or waits for. Then check for re-evaluation after a wait (EvalPlanQual), serialization failures, and lock cycles. See <a href="locking.html">Locking</a> and <a href="mvcc-vacuum.html">MVCC</a>.</p>', lvl: 'core' },
    { q: 'You don’t know the answer. What do you say?', a: '<p>Narrow it down: “It is either X or Y depending on whether the default frame includes peers. I believe it is RANGE, so X. I would verify with a two-line test.” Showing how you would check it in a minute (psql, EXPLAIN) is a good answer for a senior engineer.</p>', lvl: 'core' },
    { q: 'Which three trick categories cause the most production bugs?', a: '<p>1) NULL semantics: NOT IN with NULLs, <code>&lt;&gt;</code> dropping NULL rows, SUM over nothing being NULL. 2) Join fan-out inflating aggregates. 3) Implicit casts and functions on indexed columns that silently disable indexes (<code>id = 5.0</code>, <code>lower(email)</code>, timestamptz vs date).</p>', lvl: 'deep' },
    { q: 'How do you check a tricky claim quickly during a real review?', a: '<p>A self-contained query with <code>VALUES</code> or <code>generate_series</code>, no tables needed. For plans: create a temp table with realistic row counts, <code>ANALYZE</code>, then <code>EXPLAIN (ANALYZE, BUFFERS)</code>. For concurrency: two psql sessions side by side, with explicit BEGIN.</p>', lvl: 'core' }
  ]
});

/* Tricky 50: a timed drill of hard predict-the-output / which-plan / which-lock questions across all SQL topics. */
IA.widget('tricky-50', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  /*Q-START*/
  const Q = [
    // ---------- NULL ----------
    { t: 'NULL', q: 'What does this return?', code: `SELECT NULL = NULL AS a, NULL IS NULL AS b;`, o: ['true, true', 'NULL, true', 'false, true', 'NULL, NULL'], a: 1, x: '<code>=</code> with a NULL operand is <i>unknown</i> (NULL). Only <code>IS NULL</code> / <code>IS DISTINCT FROM</code> test for NULL.' },
    { t: 'NULL', q: 'count(*), count(x), sum(x), avg(x)?', code: `SELECT count(*) AS all_rows, count(x) AS non_null, sum(x), avg(x)\nFROM (VALUES (1), (NULL), (3)) t(x);`, o: ['3, 3, 4, 1.33', '3, 2, 4, 2', '2, 2, 4, 2', '3, 2, NULL, NULL'], a: 1, x: 'count(*) counts rows; every other aggregate skips NULLs. avg = 4 / 2 = <b>2</b>, not 4 / 3.' },
    { t: 'NULL', q: 'How many rows?', code: `SELECT 1 WHERE 3 NOT IN (1, 2, NULL);`, o: ['1', '0', 'Error', '1 row containing NULL'], a: 1, x: '<code>3 NOT IN (1,2,NULL)</code> = <code>3&lt;&gt;1 AND 3&lt;&gt;2 AND 3&lt;&gt;NULL</code> = true AND true AND unknown = unknown. WHERE keeps only true: <b>0 rows</b>.' },
    { t: 'NULL', q: 'Which value comes first?', code: `SELECT x FROM (VALUES (2), (NULL), (1)) t(x)\nORDER BY x DESC LIMIT 1;`, o: ['2', 'NULL', '1', 'Error'], a: 1, x: 'Postgres sorts NULL as larger than every value, so it comes <b>first</b> in DESC order. Use <code>DESC NULLS LAST</code>.' },
    { t: 'NULL', q: 'What does this return?', code: `SELECT 'a' || NULL AS a, concat('a', NULL) AS b;`, o: ["NULL, 'a'", "'a', 'a'", 'NULL, NULL', "'a', NULL"], a: 0, x: 'The <code>||</code> operator returns NULL if any input is NULL. <code>concat()</code> treats NULL as an empty string.' },
    { t: 'NULL', q: 'What comes back?', code: `SELECT max(x) FROM (VALUES (1)) t(x) WHERE false;`, o: ['0 rows', '1 row: NULL', '1 row: 0', 'Error'], a: 1, x: 'An aggregate without GROUP BY always returns exactly one row. Over zero input rows, max is <b>NULL</b> (count would be 0).' },
    { t: 'NULL', q: 'And with GROUP BY?', code: `SELECT count(*) FROM (VALUES (1)) t(x) WHERE false GROUP BY x;`, o: ['1 row: 0', '0 rows', '1 row: NULL', 'Error'], a: 1, x: 'With GROUP BY there is one output row per group, and there are no groups: <b>0 rows</b>. A classic difference between “no data” and “a count of 0”.' },
    { t: 'NULL', q: 'Two NULLs under a UNIQUE constraint. Row count?', code: `CREATE TEMP TABLE u (x int UNIQUE);\nINSERT INTO u VALUES (NULL), (NULL);\nSELECT count(*) FROM u;`, o: ['1', '2', 'Error: duplicate key', '0'], a: 1, x: 'NULLs are not equal to each other, so a unique index allows many. PG15+ offers <code>UNIQUE NULLS NOT DISTINCT</code> to forbid this.' },
    { t: 'NULL', q: 'Three-valued logic:', code: `SELECT (NULL AND false) AS a, (NULL OR true) AS b, (NULL AND true) AS c;`, o: ['NULL, NULL, NULL', 'false, true, NULL', 'false, true, true', 'NULL, true, NULL'], a: 1, x: 'false AND anything = false; true OR anything = true; unknown AND true = <b>unknown</b>.' },
    // ---------- joins ----------
    { t: 'Joins', q: 'How many rows?', code: `WITH c(id) AS (VALUES (1), (2), (3)),\n     o(cid, st) AS (VALUES (1, 'paid'), (1, 'void'), (2, 'void'))\nSELECT count(*) FROM c LEFT JOIN o ON o.cid = c.id\nWHERE o.st <> 'paid';`, o: ['1', '2', '3', '4'], a: 1, x: 'Customer 3’s padded row has st = NULL; <code>NULL &lt;&gt; \'paid\'</code> is unknown, so WHERE drops it. Left: (1, void), (2, void) = <b>2</b>.' },
    { t: 'Joins', q: 'Same data, filter moved into ON:', code: `WITH c(id) AS (VALUES (1), (2), (3)),\n     o(cid, st) AS (VALUES (1, 'paid'), (1, 'void'), (2, 'void'))\nSELECT count(*) FROM c LEFT JOIN o\n  ON o.cid = c.id AND o.st <> 'paid';`, o: ['2', '3', '4', '5'], a: 1, x: 'ON only decides matches; every customer survives. 1 → void, 2 → void, 3 → padded = <b>3</b>.' },
    { t: 'Joins', q: 'Revenue?', code: `WITH o(id, amt) AS (VALUES (1, 100), (2, 50)),\n     s(oid) AS (VALUES (1), (1), (1))\nSELECT sum(amt) FROM o JOIN s ON s.oid = o.id;`, o: ['100', '150', '300', '350'], a: 2, x: 'Order 1 has 3 shipments, so it appears 3 times: <b>300</b>. Order 2 has none and disappears. Fan-out.' },
    { t: 'Joins', q: 'Row count of a FULL JOIN on nullable keys?', code: `WITH a(k) AS (VALUES (1), (NULL)), b(k) AS (VALUES (1), (NULL))\nSELECT count(*) FROM a FULL JOIN b ON a.k = b.k;`, o: ['2', '3', '4', '1'], a: 1, x: '1 = 1 matches. NULL never equals NULL, so each NULL row is kept unmatched on its own side: 1 + 1 + 1 = <b>3</b>.' },
    { t: 'Joins', q: 'NOT IN vs NOT EXISTS, same data:', code: `WITH c(id) AS (VALUES (1), (2)), o(cid) AS (VALUES (1), (NULL))\nSELECT (SELECT count(*) FROM c WHERE id NOT IN (SELECT cid FROM o)) AS not_in,\n       (SELECT count(*) FROM c WHERE NOT EXISTS\n          (SELECT 1 FROM o WHERE o.cid = c.id))                AS not_exists;`, o: ['1, 1', '0, 1', '1, 0', '0, 0'], a: 1, x: 'The NULL in the subquery makes every NOT IN unknown: <b>0</b>. NOT EXISTS only asks “is there a matching row?”: customer 2 qualifies, <b>1</b>.' },
    { t: 'Joins', q: 'How many columns does SELECT * return?', code: `SELECT * FROM (VALUES (1, 'a')) a(id, x)\nJOIN (VALUES (1, 'b')) b(id, y) USING (id);`, o: ['3', '4', '2', 'Error: ambiguous id'], a: 0, x: '<code>USING</code> merges the join column into one output column: id, x, y = <b>3</b>. With <code>ON a.id = b.id</code> you get 4.' },
    // ---------- aggregates ----------
    { t: 'Aggregates', q: 'HAVING without GROUP BY:', code: `SELECT count(*) FROM (VALUES (1), (2)) t(x) HAVING count(*) > 5;`, o: ['1 row: 2', '0 rows', 'Error: HAVING needs GROUP BY', '1 row: 0'], a: 1, x: 'The whole input is one group; HAVING rejects it: <b>0 rows</b>.' },
    { t: 'Aggregates', q: 'FILTER clauses:', code: `SELECT count(*) FILTER (WHERE x > 1) AS a,\n       sum(x)   FILTER (WHERE x > 5) AS b\nFROM (VALUES (1), (2), (3)) t(x);`, o: ['2, 0', '2, NULL', '3, NULL', '2, 6'], a: 1, x: 'No row passes <code>x &gt; 5</code>, and sum over no rows is <b>NULL</b>, not 0. Wrap it in COALESCE.' },
    { t: 'Aggregates', q: 'Integer arithmetic:', code: `SELECT 7 / 2 AS a, 7 % 3 AS b, -7 / 2 AS c;`, o: ['3, 1, -4', '3, 1, -3', '3.5, 1, -3.5', '4, 1, -4'], a: 1, x: 'Integer division truncates toward zero: -3.5 → <b>-3</b>. Cast to numeric for decimals.' },
    // ---------- windows ----------
    { t: 'Windows', q: 'For x = 20: rank and dense_rank?', code: `SELECT x, rank() OVER w AS r, dense_rank() OVER w AS d\nFROM (VALUES (10), (10), (20)) t(x)\nWINDOW w AS (ORDER BY x)\nORDER BY x DESC LIMIT 1;`, o: ['2, 2', '3, 2', '3, 3', '2, 3'], a: 1, x: 'rank leaves a gap after ties (1, 1, <b>3</b>); dense_rank doesn’t (1, 1, <b>2</b>).' },
    { t: 'Windows', q: 'last_value on the first row?', code: `SELECT last_value(x) OVER (ORDER BY x)\nFROM (VALUES (1), (2), (3)) t(x)\nORDER BY x LIMIT 1;`, o: ['1', '3', 'NULL', 'Error'], a: 0, x: 'With ORDER BY the default frame ends at the <b>current row</b> (RANGE … CURRENT ROW), so last_value is the row itself: 1. Use <code>ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING</code>.' },
    { t: 'Windows', q: 'Running sum, second row (x = 2)?', code: `SELECT x, sum(x) OVER (ORDER BY x) AS s\nFROM (VALUES (1), (2), (2), (3)) t(x)\nORDER BY x LIMIT 2;`, o: ['3', '5', '2', '8'], a: 1, x: 'The default RANGE frame includes all <b>peers</b> (rows with equal x), so both 2s are summed at once: 1 + 2 + 2 = <b>5</b>. ROWS mode would give 3.' },
    { t: 'Windows', q: 'What happens?', code: `SELECT x FROM (VALUES (1), (2)) t(x)\nWHERE row_number() OVER () = 1;`, o: ['1 row', '2 rows', 'Error', '0 rows'], a: 2, x: 'Window functions run after WHERE: <code>ERROR: window functions are not allowed in WHERE</code>. Wrap the query in a subquery or use QUALIFY-like filtering via a CTE.' },
    { t: 'Windows', q: 'Value of total?', code: `SELECT x, count(*) OVER () AS total\nFROM generate_series(1, 100) x\nLIMIT 2;`, o: ['2', '100', '1', '50'], a: 1, x: 'Windows are computed before LIMIT, so total is <b>100</b>. That is why this is the standard “page + total count” trick (and why it reads every row).' },
    { t: 'Windows', q: 'How many rows get ntile = 1?', code: `SELECT count(*) FROM (\n  SELECT ntile(3) OVER (ORDER BY x) AS n FROM generate_series(1, 7) x\n) s WHERE n = 1;`, o: ['2', '3', '1', '7'], a: 1, x: '7 rows into 3 buckets: sizes 3, 2, 2. Earlier buckets get the extra rows: <b>3</b>.' },
    // ---------- CTEs ----------
    { t: 'CTEs', q: 'count and max?', code: `WITH RECURSIVE r(n) AS (\n  SELECT 1 UNION ALL SELECT n * 2 FROM r WHERE n < 100)\nSELECT count(*), max(n) FROM r;`, o: ['7, 64', '8, 128', '7, 128', '8, 64'], a: 1, x: '1, 2, 4, …, 64 all pass <code>n &lt; 100</code>, so 64 still produces 128: <b>8 rows, max 128</b>. The check is on the input row, not the output.' },
    { t: 'CTEs', q: 'Does this terminate?', code: `WITH RECURSIVE r(n) AS (\n  SELECT 1 UNION SELECT (n % 3) + 1 FROM r)\nSELECT count(*) FROM r;`, o: ['3', 'Infinite loop', 'Error', '1'], a: 0, x: '<code>UNION</code> (not ALL) discards rows already produced, so once 1, 2, 3 exist no new rows appear and the recursion stops: <b>3</b>.' },
    { t: 'CTEs', q: 'What does the main query see?', code: `CREATE TEMP TABLE t (x int);\nWITH ins AS (INSERT INTO t VALUES (1) RETURNING x)\nSELECT (SELECT count(*) FROM t)   AS in_table,\n       (SELECT count(*) FROM ins) AS returned;`, o: ['1, 1', '0, 1', '1, 0', '0, 0'], a: 1, x: 'All parts of the statement share one snapshot taken <i>before</i> the insert, so the table looks empty (<b>0</b>). Use RETURNING to see the new rows (<b>1</b>).' },
    { t: 'CTEs', q: 'CTE referenced twice:', code: `WITH x AS (SELECT random() AS r)\nSELECT a.r = b.r AS same FROM x a, x b;`, o: ['true', 'false', 'NULL', 'random'], a: 0, x: 'A CTE referenced more than once is materialized once (and volatile functions prevent inlining anyway): <b>true</b>.' },
    { t: 'CTEs', q: 'PG12+: a non-recursive, side-effect-free CTE referenced once is…', o: ['always materialized (optimization fence)', 'inlined into the outer query', 'executed in parallel', 'cached across queries'], a: 1, x: 'Since PG12 it is <b>inlined</b>, so predicates can be pushed into it. Add <code>AS MATERIALIZED</code> to get the old fence back.' },
    // ---------- indexes / plans ----------
    { t: 'Indexes', q: 'Which plan?', code: `CREATE TEMP TABLE t AS SELECT g AS id FROM generate_series(1, 100000) g;\nCREATE INDEX ON t (id);\nANALYZE t;\nEXPLAIN (COSTS OFF) SELECT * FROM t WHERE id + 0 = 5;`, o: ['Index Scan', 'Index Only Scan', 'Seq Scan', 'Bitmap Heap Scan'], a: 2, x: 'An expression on the column (<code>id + 0</code>) doesn’t match the index on <code>id</code>, so it is a <b>Seq Scan</b>. Same for <code>lower(email)</code> without an expression index.' },
    { t: 'Indexes', q: 'int column, numeric literal. Which plan?', code: `CREATE TEMP TABLE t AS SELECT g AS id FROM generate_series(1, 100000) g;\nCREATE INDEX ON t (id);\nANALYZE t;\nEXPLAIN (COSTS OFF) SELECT * FROM t WHERE id = 5.0;`, o: ['Index Scan', 'Seq Scan', 'Index Only Scan', 'Error: type mismatch'], a: 1, x: '<code>5.0</code> is numeric, so Postgres compares <code>id::numeric = 5.0</code>, and the int index can’t be used: <b>Seq Scan</b>. A real bug with JDBC <code>setBigDecimal</code> or Hibernate parameter types.' },
    { t: 'Indexes', q: 'Index on created_at ASC. Which plan for the newest 10?', code: `CREATE TEMP TABLE t AS SELECT g AS id, now() - g * interval '1 min' AS created_at\nFROM generate_series(1, 100000) g;\nCREATE INDEX ON t (created_at);\nANALYZE t;\nEXPLAIN (COSTS OFF) SELECT * FROM t ORDER BY created_at DESC LIMIT 10;`, o: ['Seq Scan + Sort', 'Index Scan Backward', 'Bitmap Heap Scan', 'Needs an index with DESC'], a: 1, x: 'B-tree indexes can be read in either direction: <b>Index Scan Backward</b> under the Limit. DESC indexes matter only for mixed orders like <code>ORDER BY a ASC, b DESC</code>.' },
    { t: 'Indexes', q: 'Index on (tenant_id, created_at). Which query uses it best (PG16)?', o: ['WHERE created_at > now() - interval \'1 day\'', 'WHERE tenant_id = 7 ORDER BY created_at DESC LIMIT 20', 'WHERE tenant_id + 0 = 7', 'ORDER BY created_at LIMIT 20'], a: 1, x: 'Equality on the leading column, then range/order on the second: the index delivers the rows already sorted. Without a condition on tenant_id the index is far less useful (PG18 adds skip scan for some of these cases).' },
    { t: 'Indexes', q: 'Index on email (default collation, e.g. en_US.UTF-8). Can <code>WHERE email LIKE \'bob%\'</code> use it?', o: ['Yes, always', 'Not with a non-C collation; needs text_pattern_ops (or a C collation)', 'Only with ILIKE', 'Only for GIN indexes'], a: 1, x: 'Prefix LIKE needs byte-wise ordering. With a linguistic collation, create <code>(email text_pattern_ops)</code>, or use the C collation.' },
    { t: 'Indexes', q: 'Partial index <code>ON users(email) WHERE deleted_at IS NULL</code>. Which query can use it?', o: ['WHERE email = $1', 'WHERE email = $1 AND deleted_at IS NULL', 'WHERE deleted_at IS NOT NULL', 'Any query on users'], a: 1, x: 'The planner must <b>prove</b> the query’s WHERE implies the index predicate. Plain <code>email = $1</code> could match deleted rows, so it can’t use it.' },
    // ---------- types ----------
    { t: 'Types', q: 'Float vs numeric:', code: `SELECT 0.1::float8 + 0.2::float8 = 0.3::float8 AS f,\n       0.1::numeric + 0.2 = 0.3 AS n;`, o: ['true, true', 'false, true', 'false, false', 'true, false'], a: 1, x: 'Binary floating point can’t represent 0.1 exactly, so f is <b>false</b>. numeric is exact decimal: use it for money.' },
    { t: 'Types', q: 'Month arithmetic:', code: `SELECT ('2024-03-31'::date + interval '1 month')::date AS d;`, o: ['2024-04-30', '2024-05-01', '2024-04-31', 'Error'], a: 0, x: 'Adding a month clamps to the last valid day: <b>2024-04-30</b>. And adding it back gives 2024-05-30, not 03-31.' },
    { t: 'Types', q: 'Overflow:', code: `SELECT 2147483647::int + 1;`, o: ['2147483648', '-2147483648', 'Error: integer out of range', 'NULL'], a: 2, x: 'Postgres checks overflow and raises <b>an error</b> instead of wrapping. A serial (int4) PK hits this at 2.1 billion rows.' },
    { t: 'Types', q: 'Rounding 2.5:', code: `SELECT round(2.5::numeric) AS n, round(2.5::float8) AS f;`, o: ['3, 3', '2, 2', '3, 2', '2, 3'], a: 2, x: 'numeric rounds half away from zero (<b>3</b>); float8 uses the platform’s round-half-to-even (<b>2</b>).' },
    { t: 'Types', q: 'Text comparison:', code: `SELECT '10' < '9' AS text_cmp, 10 < 9 AS int_cmp;`, o: ['false, false', 'true, false', 'true, true', 'Error'], a: 1, x: 'Strings compare character by character, and \'1\' sorts before \'9\': <b>true</b>. That is why ids stored as text sort wrong.' },
    { t: 'Types', q: 'Characters vs bytes (UTF-8):', code: `SELECT length('héllo') AS chars, octet_length('héllo') AS bytes;`, o: ['5, 5', '5, 6', '6, 6', '6, 5'], a: 1, x: 'é is 2 bytes in UTF-8: <b>5 characters, 6 bytes</b>.' },
    // ---------- MVCC, isolation, locking ----------
    { t: 'MVCC & locks', q: 'Inside one transaction:', code: `BEGIN;\nCREATE TEMP TABLE a AS SELECT now() AS t, clock_timestamp() AS c;\nSELECT pg_sleep(0.05);\nSELECT t = now() AS same_now, c = clock_timestamp() AS same_clock FROM a;`, o: ['true, true', 'true, false', 'false, false', 'false, true'], a: 1, x: '<code>now()</code> is the transaction start time, constant throughout (<b>true</b>); <code>clock_timestamp()</code> keeps moving (<b>false</b>).' },
    { t: 'MVCC & locks', q: 'Next value after the rollback?', code: `CREATE TEMP SEQUENCE s;   -- autocommitted\nBEGIN;\nSELECT nextval('s');\nROLLBACK;\nSELECT nextval('s');`, o: ['1', '2', 'Error', 'NULL'], a: 1, x: 'Sequences are non-transactional: a rolled-back nextval is never handed out again: <b>2</b>. Gaps in ids are normal.' },
    { t: 'MVCC & locks', q: 'T1 (REPEATABLE READ) counts orders: 10. T2 inserts one and commits. T1 counts again:', o: ['10', '11', 'Error 40001', 'T1 waits for T2'], a: 0, x: 'RR keeps the snapshot from its first statement, so T1 sees <b>10</b>. Under READ COMMITTED it would see 11.' },
    { t: 'MVCC & locks', q: 'READ COMMITTED. T2 sets account 1’s balance from 150 to 50 (not committed). T1 runs <code>UPDATE accounts SET … WHERE id = 1 AND balance &gt; 100</code> and waits. T2 commits. T1:', o: ['updates the row using balance 150', 'updates 0 rows', 'fails with a serialization error', 'deadlocks'], a: 1, x: 'After the wait, T1 re-evaluates its WHERE on the <b>new</b> row version (EvalPlanQual): 50 &gt; 100 is false, so <b>0 rows</b> are updated.' },
    { t: 'MVCC & locks', q: 'Two SERIALIZABLE transactions each check “at least 2 doctors on call”, then each takes a different doctor off call. Both commit?', o: ['Both commit (write skew)', 'One gets 40001 serialization_failure', 'Both wait forever', 'Deadlock detected'], a: 1, x: 'SSI detects the read/write dependency cycle and aborts one with <b>40001</b>. Under REPEATABLE READ both would commit: write skew.' },
    { t: 'MVCC & locks', q: 'A 10-minute SELECT is running on orders. You run <code>ALTER TABLE orders ADD COLUMN x int</code>. Then a 1 ms <code>SELECT * FROM orders WHERE id = 1</code> arrives. It:', o: ['runs immediately', 'waits behind the ALTER', 'cancels the ALTER', 'fails at once'], a: 1, x: 'The queued ACCESS EXCLUSIVE request blocks every later conflicting request: the lock queue. Use <code>lock_timeout</code>.' },
    { t: 'MVCC & locks', q: 'T1: <code>UPDATE customers SET name = \'x\' WHERE id = 1</code> (open). T2: <code>INSERT INTO orders (customer_id) VALUES (1)</code>. Does T2 wait?', o: ['Yes', 'No: FOR NO KEY UPDATE and FOR KEY SHARE are compatible', 'Only at SERIALIZABLE', 'Only if orders has an index on customer_id'], a: 1, x: 'The UPDATE doesn’t change the key, so it takes FOR NO KEY UPDATE; the FK check takes FOR KEY SHARE. <b>Compatible</b>.' },
    { t: 'MVCC & locks', q: 'Deadlock between T1 and T2, deadlock_timeout = 1 s. Which transaction is aborted?', o: ['The younger one', 'The one with fewer locks', 'The waiting backend that runs the check and finds the cycle', 'Both'], a: 2, x: 'Postgres doesn’t pick a victim by cost: the backend whose timer fires while the cycle exists <b>aborts itself</b>.' },
    { t: 'MVCC & locks', q: 'Does <code>UPDATE t SET x = x</code> on 1M rows create dead tuples?', o: ['No: nothing changed', 'Yes: 1M new versions, 1M dead', 'Only for indexed columns', 'Only under SERIALIZABLE'], a: 1, x: 'Every updated row gets a new version, whether or not a value changed. Filter with <code>WHERE x IS DISTINCT FROM …</code>.' }
  ];
  /*Q-END*/
  const TOPICS = ['All', ...[...new Set(Q.map((q) => q.t))]];
  if (!document.getElementById('w-t50-style')) {
    document.head.append(el('style', { id: 'w-t50-style', text: `
.w-t50-bar { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; margin: 8px 0; }
.w-t50-bar div { height: 100%; background: var(--accent); }
.w-t50-bar div.low { background: var(--err); }
.w-t50-opts { display: grid; gap: 6px; margin-top: 10px; }
.w-t50-opts button { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 9px; padding: 9px 12px; font-size: 14px; cursor: pointer; overflow-wrap: anywhere; }
.w-t50-opts button:hover:not(:disabled) { border-color: var(--accent); }
.w-t50-opts button.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 15%, transparent); }
.w-t50-opts button.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 15%, transparent); }
.w-t50-opts button:disabled { cursor: default; }
.w-t50-q { font-size: 16px; margin: 6px 0 8px; }
.w-t50-rev { border-top: 1px solid var(--border); padding: 10px 0; }
.w-t50-rev:first-child { border-top: 0; }
` }));
  }
  let topic = 'All'; let count = 10; let secs = 60; let gen = 0; let deck = []; let i = 0; let score = 0; let misses = []; let left = 0; let answered = false; let started = false; let tick = null;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segT = seg(TOPICS.map((t) => [t, t]), () => topic, (v) => { topic = v; reset(); }, 'Topic');
  const segN = seg([[10, '10 questions'], [25, '25'], [50, 'all 50']], () => count, (v) => { count = v; reset(); }, 'Number of questions');
  const segS = seg([[90, 'Slow · 90 s'], [60, 'Normal · 60 s'], [30, 'Fast · 30 s']], () => secs, (v) => { secs = v; reset(); }, 'Time per question');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Start' }); const bStep = el('button', { class: 'btn', text: 'Skip ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const card = el('div', { class: 'card', style: { padding: '14px', marginTop: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segT), el('div', { class: 'w-controls' }, segN, el('span', { class: 'tiny', text: 'time per question' }), segS),
    el('div', { class: 'w-controls' }, bPlay, bStep, bReset), stats, card, narr);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function shuffle(a) { const r = a.slice(); for (let j = r.length - 1; j > 0; j--) { const m = Math.floor(Math.random() * (j + 1)); [r[j], r[m]] = [r[m], r[j]]; } return r; }
  function renderStats() { stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `question <b>${Math.min(i + 1, deck.length)}</b>/${deck.length}` }), el('span', { class: 'w-stat', html: `score <b>${score}</b>` }), el('span', { class: 'w-stat', html: `missed <b>${misses.length}</b>` }), el('span', { class: 'w-stat', html: `time <b>${started && !answered ? left + ' s' : '–'}</b>` })); }
  function stopTimer() { if (tick) { clearInterval(tick); tick = null; } }
  function show() {
    const q = deck[i]; answered = false; left = secs; card.innerHTML = '';
    const bar = el('div'); const barWrap = el('div', { class: 'w-t50-bar' }, bar);
    const opts = el('div', { class: 'w-t50-opts' });
    card.append(el('div', { class: 'w-controls', style: { marginBottom: '0' } }, el('span', { class: 'pill accent', text: q.t }), el('span', { class: 'tiny', text: `#${i + 1}` })), barWrap, el('div', { class: 'w-t50-q', html: q.q }));
    if (q.code) card.append(ctx.codeBox(q.code, 'sql'));
    q.o.forEach((o, j) => { const b = el('button', { html: `<b>${'ABCD'[j]}.</b> ${IA.esc ? IA.esc(o) : ctx.esc(o)}` }); b.addEventListener('click', () => answer(j)); opts.append(b); });
    card.append(opts);
    const paint = () => { bar.style.width = (left / secs) * 100 + '%'; bar.className = left <= 10 ? 'low' : ''; if (!reduced) bar.style.transition = 'width 1s linear'; };
    paint(); renderStats(); say('Pick an answer before the bar runs out. Skip counts as a miss.');
    stopTimer(); const g = gen;
    tick = setInterval(() => { if (g !== gen || answered) { stopTimer(); return; } left--; paint(); renderStats(); if (left <= 0) answer(-1); }, 1000);
    card.opts = opts;
  }
  function answer(j) {
    if (answered || !started) return; answered = true; stopTimer();
    const q = deck[i]; const ok = j === q.a;
    if (ok) score++; else misses.push({ q, j });
    [...card.opts.children].forEach((b, m) => { b.disabled = true; if (m === q.a) b.classList.add('ok'); else if (m === j) b.classList.add('bad'); });
    card.append(el('div', { class: 'pz-exp', html: (j === -1 ? '<b>Time’s up.</b> ' : j === -2 ? '<b>Skipped.</b> ' : ok ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.x }));
    bStep.textContent = i + 1 < deck.length ? 'Next ›' : 'Finish ›'; renderStats();
    say(ok ? 'Correct. Press Next.' : 'Read the explanation, then press Next.');
  }
  function next() {
    if (!started) return;
    if (!answered) { answer(-2); return; }
    i++; bStep.textContent = 'Skip ›';
    if (i >= deck.length) return finish();
    show();
  }
  function finish() {
    started = false; stopTimer(); bStep.disabled = true; bPlay.textContent = '▶ Again'; card.innerHTML = '';
    const by = {}; deck.forEach((q) => { by[q.t] = by[q.t] || [0, 0]; by[q.t][1]++; }); deck.forEach((q) => { if (!misses.some((m) => m.q === q)) by[q.t][0]++; });
    card.append(el('h3', { text: `Score: ${score} / ${deck.length}`, style: { margin: '0 0 8px' } }),
      el('div', { class: 'w-stats' }, Object.entries(by).map(([t, [a, n]]) => el('span', { class: 'w-stat', html: `${t} <b>${a}/${n}</b>` }))));
    if (misses.length) {
      card.append(el('h4', { text: 'Review your misses', style: { margin: '14px 0 4px' } }));
      misses.forEach(({ q, j }) => { const r = el('div', { class: 'w-t50-rev' }, el('div', { html: `<span class="pill">${q.t}</span> ${q.q}` }));
        if (q.code) r.append(ctx.codeBox(q.code, 'sql'));
        r.append(el('div', { class: 'tiny', html: `You: ${j < 0 ? (j === -1 ? 'time ran out' : 'skipped') : ctx.esc(q.o[j])} · Correct: <b>${ctx.esc(q.o[q.a])}</b>` }), el('div', { class: 'pz-exp', html: q.x }));
        card.append(r); });
    } else card.append(el('p', { text: 'No misses. Try “all 50” on Fast.' }));
    renderStats(); say(`Done: ${score}/${deck.length}. ` + (misses.length ? 'Your misses are listed above with explanations.' : ''));
  }
  function reset() {
    gen++; stopTimer(); started = false; answered = false; i = 0; score = 0; misses = [];
    const pool = Q.filter((q) => topic === 'All' || q.t === topic); deck = shuffle(pool).slice(0, count);
    bPlay.textContent = '▶ Start'; bStep.textContent = 'Skip ›'; bStep.disabled = true; card.innerHTML = '';
    card.append(el('p', { html: `<b>${deck.length}</b> question${deck.length === 1 ? '' : 's'} (${topic === 'All' ? 'all topics' : topic}), <b>${secs} s</b> each. No running SQL: predict the result in your head, like in an interview.`, style: { margin: 0 } }));
    renderStats(); say('Choose a topic, how many questions and the time limit, then press Start.');
  }
  bPlay.addEventListener('click', () => { reset(); started = true; bStep.disabled = false; bPlay.textContent = '↻ Restart'; show(); });
  bStep.addEventListener('click', next);
  bReset.addEventListener('click', reset);
  reset();
});

IA.register({
  track: 'sql',
  slug: 'index-types',
  title: 'Index types: GIN, GiST, BRIN, hash, partial, expression',
  tagline: 'A B-tree answers <code>=</code>, <code>&lt;</code>, <code>BETWEEN</code> and ORDER BY. Everything else (“contains”, “overlaps”, “near”, “matches words”, “in this huge append-only time range”) needs a different <b>access method</b>. Partial and expression indexes then let you index <i>exactly</i> what the query asks for.',
  tldr: {
    problem: 'A B-tree on a jsonb, array or tsvector column is useless for <code>@&gt;</code> or <code>@@</code>; a 40 GB B-tree on a log table’s timestamp costs more than it saves; and an index on <code>email</code> does nothing for <code>lower(email) = ?</code>.',
    model: '<b>The operator decides the index type.</b> GIN = inverted index (element → rows). GiST = tree of bounding boxes (overlap, nearest). BRIN = min/max per block range (tiny, needs physical order). Hash = equality only. Partial = a WHERE on the index; expression = index the computed value.',
    hook: '“We added a GIN index on attrs but the query still seq-scans.” It used <code>attrs-&gt;&gt;\'color\' = \'red\'</code>, which no GIN opclass supports. <code>attrs @&gt; \'{"color":"red"}\'</code> does.',
    facts: [
      { v: '~90×', l: 'smaller in the playground: BRIN 24 kB vs B-tree ~2 MB on the same timestamp. The gap grows with the table' },
      { v: 'operator class', l: 'decides which operators an index supports, e.g. <code>jsonb_ops</code> vs <code>jsonb_path_ops</code>, <code>text_pattern_ops</code>' },
      { v: 'PG10', l: 'hash indexes became WAL-logged and crash-safe. Before that they were unsafe to use' }
    ]
  },
  intro: {
    what: 'Postgres has several kinds of index, each built for a different kind of question. The default B-tree handles “equal to” and “between”. Others handle “does this list contain X”, “do these time ranges overlap”, or “which rows are near this point”.',
    analogy: { icon: '🧰', title: 'Different finding aids', text: 'A dictionary (B-tree) finds a word by alphabetical order. A cookbook’s ingredient index (GIN) lists, for each ingredient, every recipe that uses it. A map grid (GiST) tells you which squares a region touches. A shelf label like “2019–2020 receipts” (BRIN) only says what range a box might contain, but it’s tiny.' },
    steps: [
      { t: 'Look at the operator', d: '<code>=</code> / <code>&lt;</code> → B-tree. <code>@&gt;</code>, <code>?</code>, <code>@@</code> → GIN. <code>&amp;&amp;</code>, <code>&lt;-&gt;</code> → GiST.', code: 'WHERE tags @> ARRAY[\'sql\']' },
      { t: 'Pick the access method', d: 'Name it with USING.', code: 'CREATE INDEX ON posts\n  USING gin (tags);' },
      { t: 'Index only some rows', d: 'A partial index covers rows matching its WHERE.', code: 'CREATE INDEX ON jobs (run_at)\n  WHERE status = \'pending\';' },
      { t: 'Index a computed value', d: 'The query must use the same expression.', code: 'CREATE INDEX ON users\n  (lower(email));' }
    ],
    terms: [
      ['access method', 'The index type: btree, hash, gin, gist, spgist, brin.'],
      ['operator class', 'Which operators and data type an index supports, e.g. <code>jsonb_path_ops</code>.'],
      ['inverted index', 'Maps each element (word, array item, json key/value) to the list of rows containing it.'],
      ['lossy', 'The index returns candidate rows or pages that must be rechecked against the real row.'],
      ['correlation', 'How closely the physical order of rows matches a column’s sort order (<code>pg_stats.correlation</code>).']
    ]
  },
  visual: {
    title: 'How each index type answers a query',
    caption: 'Pick an index type and press Play. Each one has a different shape: posting lists, bounding boxes, block-range summaries, hash buckets. Try BRIN on sorted vs shuffled data.'
  },
  extras: [
    { id: 'index-types-matrix', title: 'Which index supports what?', label: 'Comparison matrix', caption: 'Click what your query needs; the matrix highlights the index types that can serve it.' }
  ],
  playground: {
    setup: `
CREATE TABLE products (id int PRIMARY KEY, attrs jsonb, tags text[], descr text, email text, status text);
INSERT INTO products
SELECT g,
  jsonb_build_object('color', (ARRAY['red','blue','green'])[1 + g % 3], 'size', g % 5),
  ARRAY['t' || (g % 20), 't' || (g % 7)],
  'item ' || g || ' ' || (ARRAY['steel','wooden','plastic'])[1 + g % 3] || ' chair',
  'User' || g || '@Example.com',
  CASE WHEN g % 100 = 0 THEN 'pending' ELSE 'done' END
FROM generate_series(1, 20000) g;
CREATE INDEX p_attrs   ON products USING gin (attrs jsonb_path_ops);
CREATE INDEX p_tags    ON products USING gin (tags);
CREATE INDEX p_fts     ON products USING gin (to_tsvector('english', descr));
CREATE INDEX p_pending ON products (id) WHERE status = 'pending';
CREATE INDEX p_email   ON products (lower(email));
CREATE INDEX p_hash    ON products USING hash (email);
CREATE TABLE bookings (id int PRIMARY KEY, room int, during tstzrange,
  EXCLUDE USING gist (during WITH &&));
CREATE TABLE metrics (ts timestamptz, v float8);
INSERT INTO metrics SELECT timestamptz '2026-01-01' + g * interval '1 second', random()
FROM generate_series(1, 100000) g;
CREATE INDEX m_brin ON metrics USING brin (ts);
ANALYZE products; ANALYZE metrics;`,
    presets: [
      { label: 'GIN: jsonb / array / FTS', sql: `EXPLAIN (COSTS OFF) SELECT id FROM products WHERE attrs @> '{"color":"red","size":3}';
EXPLAIN (COSTS OFF) SELECT id FROM products WHERE tags @> ARRAY['t3'];
EXPLAIN (COSTS OFF) SELECT id FROM products
WHERE to_tsvector('english', descr) @@ to_tsquery('english', 'wooden & chairs');`, note: 'All three use a Bitmap Index Scan on a GIN index. Note FTS stemmed “chairs” to “chair”.' },
      { label: 'GIN: wrong operator', sql: `EXPLAIN (COSTS OFF) SELECT id FROM products WHERE attrs ->> 'color' = 'red';
EXPLAIN (COSTS OFF) SELECT id FROM products WHERE attrs @> '{"color":"red"}';`, note: '<code>-&gt;&gt;</code> returns text and isn’t a GIN operator: seq scan. Containment <code>@&gt;</code> uses the index.' },
      { label: 'GiST: exclusion', sql: `DELETE FROM bookings;
INSERT INTO bookings VALUES (1, 1, '[2026-05-01 10:00, 2026-05-01 11:00)');
INSERT INTO bookings VALUES (2, 1, '[2026-05-01 10:30, 2026-05-01 12:00)');`, note: 'The second insert fails: “conflicting key value violates exclusion constraint”. A unique index can’t express “no overlap”; GiST can. For per-room overlap you’d add <code>room WITH =</code>, which needs the btree_gist extension.' },
      { label: 'GiST: nearest neighbour', sql: `DROP TABLE IF EXISTS pts;
CREATE TABLE pts (id int, p point);
INSERT INTO pts SELECT g, point(g % 100, g / 100) FROM generate_series(1, 10000) g;
CREATE INDEX ON pts USING gist (p);
ANALYZE pts;
EXPLAIN (COSTS OFF) SELECT id FROM pts ORDER BY p <-> point(50, 50) LIMIT 3;
SELECT id, p FROM pts ORDER BY p <-> point(50.2, 50.1) LIMIT 3;`, note: '<code>ORDER BY p &lt;-&gt; …</code> is an index-ordered KNN search: no sort of 10,000 distances.' },
      { label: 'BRIN vs B-tree', sql: `DROP INDEX IF EXISTS m_bt;
CREATE INDEX m_bt ON metrics (ts);
SELECT pg_size_pretty(pg_relation_size('m_brin')) AS brin, pg_size_pretty(pg_relation_size('m_bt')) AS btree;
DROP INDEX m_bt;
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM metrics WHERE ts >= '2026-01-01 10:00' AND ts < '2026-01-01 10:10';`, note: '24 kB vs ~2 MB. The BRIN plan is lossy: <b>Heap Blocks: lossy=128</b> and many <i>Rows Removed by Index Recheck</i>; it reads whole block ranges.' },
      { label: 'Partial, expression, hash', sql: `EXPLAIN (COSTS OFF) SELECT id FROM products WHERE status = 'pending';
EXPLAIN (COSTS OFF) SELECT id FROM products WHERE lower(email) = 'user42@example.com';
EXPLAIN (COSTS OFF) SELECT id FROM products WHERE email = 'User42@Example.com';
SELECT pg_size_pretty(pg_relation_size('p_pending')) AS partial,
       pg_size_pretty(pg_relation_size('p_email'))   AS expr_btree,
       pg_size_pretty(pg_relation_size('p_hash'))    AS hash;`, note: 'The partial index holds only the 200 pending rows: 16 kB. Each query uses the index whose definition it matches exactly.' }
    ]
  },
  gotchas: [
    { trap: 'Operator doesn’t match the opclass', code: `CREATE INDEX ON t USING gin (attrs jsonb_path_ops);\nSELECT … WHERE attrs ? 'color';   -- ? not supported by jsonb_path_ops`, why: '<code>jsonb_path_ops</code> supports only <code>@&gt;</code>, <code>@?</code>, <code>@@</code>; it is smaller and faster for containment. The default <code>jsonb_ops</code> also supports key-exists <code>?</code>, <code>?|</code>, <code>?&amp;</code>.', fix: 'Choose the opclass for your operators. For <code>attrs-&gt;&gt;\'k\' = v</code>, add an expression B-tree on <code>(attrs-&gt;&gt;\'k\')</code>.' },
    { trap: 'GIN write cost', why: 'One row with 50 tags inserts 50 index entries. <code>fastupdate</code> buffers them in a pending list, which makes some later query or vacuum pay for merging it (latency spikes).', fix: 'Tune <code>gin_pending_list_limit</code>, or turn <code>fastupdate</code> off for steady latency. Avoid GIN on hot write paths.' },
    { trap: 'BRIN on uncorrelated data', why: 'If rows aren’t physically in column order (updates, backfills, out-of-order inserts), every block range spans the whole value range and the index matches everything.', fix: 'Check <code>pg_stats.correlation</code> (close to ±1). Use BRIN only for append-only data; consider <code>minmax_multi_ops</code> (PG14+) for some outliers.' },
    { trap: 'Partial index predicate not implied', code: `CREATE INDEX ON jobs (run_at) WHERE status = 'pending';\nSELECT … WHERE status = $1;   -- generic plan: can't prove $1 = 'pending'`, why: 'The planner must prove the query WHERE implies the index WHERE. With a parameter in a generic plan it can’t.', fix: 'Write the literal in the query (<code>status = \'pending\'</code>), or ensure custom plans.' },
    { trap: 'Expression mismatch', why: 'An index on <code>lower(email)</code> isn’t used by <code>email ILIKE …</code> or <code>upper(email) = …</code>. The expression must match exactly, including casts.', fix: 'Standardize the query, or use a <code>citext</code> column / nondeterministic collation.' },
    { trap: 'Hash index expectations', why: 'Equality only: no ranges, no ORDER BY, no UNIQUE, no multi-column, no index-only scans. Rarely smaller than a B-tree for short keys.', fix: 'Consider it for long keys (URLs, tokens) with equality-only lookups, PG10+. Otherwise B-tree.' }
  ],
  scenarios: [
    { title: 'Product search seq-scans 40M rows despite a GIN index',
      symptom: 'Filter API: <code>WHERE attrs-&gt;&gt;\'brand\' = $1 AND attrs-&gt;&gt;\'color\' = $2</code>. p95 4 s. The team added <code>USING gin (attrs)</code> last sprint.',
      diagnose: `EXPLAIN SELECT … WHERE attrs->>'brand' = 'acme';\n-- Seq Scan on products  Filter: ((attrs ->> 'brand') = 'acme')`,
      cause: '<code>-&gt;&gt;</code> + <code>=</code> isn’t a GIN-indexable operator. GIN on jsonb supports containment and key existence.',
      fix: 'Rewrite as containment (one GIN probe handles both keys), or add expression B-trees for the 2–3 hottest keys.',
      fixCode: `WHERE attrs @> jsonb_build_object('brand', $1, 'color', $2)` },
    { title: 'Double-booked meeting rooms',
      symptom: 'Two teams booked Room 4 at overlapping times. The app checks for overlaps before inserting.',
      diagnose: `SELECT a.id, b.id FROM bookings a JOIN bookings b\n  ON a.room = b.room AND a.id < b.id AND a.during && b.during;`,
      cause: 'Check-then-insert race: both transactions saw no conflict. A unique index can’t express “ranges must not overlap”.',
      fix: 'An exclusion constraint makes the database refuse overlaps atomically.',
      fixCode: `CREATE EXTENSION btree_gist;\nALTER TABLE bookings ADD CONSTRAINT no_overlap\n  EXCLUDE USING gist (room WITH =, during WITH &&);` },
    { title: 'The 600 GB log table whose indexes were bigger than its data',
      symptom: 'An append-only <code>events</code> table: 380 GB heap, 240 GB of B-tree on <code>created_at</code>. Disk alerts weekly.',
      diagnose: `SELECT correlation FROM pg_stats WHERE tablename = 'events' AND attname = 'created_at';   -- 0.9999`,
      cause: 'Time-ordered inserts make the heap physically sorted by time: exactly what BRIN exploits. The B-tree was paying for precision no query needed (reports scan hours, not rows).',
      fix: 'Replace with BRIN (tens of MB). Keep a B-tree only if you need single-row point lookups by time; partition by month for retention.',
      fixCode: `CREATE INDEX CONCURRENTLY events_created_brin ON events\n  USING brin (created_at) WITH (pages_per_range = 64);\nDROP INDEX CONCURRENTLY events_created_at_idx;` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Does this use the jsonb_path_ops GIN index p_attrs?', code: `EXPLAIN (COSTS OFF)\nSELECT id FROM products WHERE attrs @> '{"color":"red","size":3}';`, options: ['Yes, Bitmap Index Scan on p_attrs', 'No, Seq Scan', 'Index Only Scan on p_attrs', 'Error: opclass'], answer: 0, explain: 'Containment is what <code>jsonb_path_ops</code> is for. GIN never does index-only scans: it always rechecks rows via a bitmap heap scan.' },
    { kind: 'predict', q: 'What happens on the second INSERT?', code: `INSERT INTO bookings VALUES (1, 1, '[2026-05-01 10:00, 2026-05-01 11:00)');\nINSERT INTO bookings VALUES (2, 1, '[2026-05-01 11:00, 2026-05-01 12:00)');\nSELECT count(*) FROM bookings;`, options: ['Exclusion violation', 'Both inserted (count 2)', 'Only first (count 1)', 'Syntax error'], answer: 1, explain: 'Half-open ranges <code>[10:00, 11:00)</code> and <code>[11:00, 12:00)</code> don’t overlap, so both are allowed: count <b>2</b>. That’s why <code>[)</code> is the right default for time slots.' },
    { kind: 'predict', q: 'Which index does this use?', code: `EXPLAIN (COSTS OFF)\nSELECT id FROM products WHERE email = 'User42@Example.com';`, options: ['p_email (lower(email))', 'p_hash', 'Seq Scan', 'p_pending'], answer: 1, explain: 'The expression index only matches <code>lower(email)</code>. The hash index on <code>email</code> serves plain equality.' },
    { kind: 'predict', q: 'Can the partial index p_pending (WHERE status = \'pending\') serve this?', code: `EXPLAIN (COSTS OFF)\nSELECT id FROM products WHERE status = 'done' AND id < 50;`, options: ['Yes', 'No: the query doesn’t imply the index predicate', 'Only with enable_seqscan off', 'Only on PG18'], answer: 1, explain: 'The index contains only pending rows, so it can’t answer anything about “done” rows. The planner uses the primary key instead.' },
    { kind: 'concept', q: 'You need <code>WHERE name ILIKE \'%smith%\'</code> to be fast. Which index?', options: ['B-tree on name', 'B-tree with text_pattern_ops', 'GIN with pg_trgm (gin_trgm_ops)', 'Hash'], answer: 2, explain: 'Leading wildcards need trigram indexing (pg_trgm extension, GIN or GiST). text_pattern_ops only helps left-anchored LIKE \'smith%\'.' },
    { kind: 'concept', q: 'A BRIN index on <code>created_at</code> suddenly matches almost every block range after a backfill of last year’s data. Why?', options: ['BRIN needs REINDEX daily', 'Physical order no longer correlates with created_at', 'BRIN doesn’t support timestamptz', 'pages_per_range is too small'], answer: 1, explain: 'Backfilled rows landed in new pages at the end of the table, so those ranges’ min/max span a year. Use <code>minmax_multi_ops</code> (PG14+) or keep backfills in their own partition.' }
  ],
  interview: [
    { q: 'How does a GIN index work, and what is it good at?', a: '<p>GIN is an inverted index: a B-tree of keys (array elements, jsonb keys/values or paths, lexemes), each pointing to a posting list/tree of TIDs. A query extracts keys from the search value, fetches posting lists and combines them (AND/OR), then rechecks rows. Great for multi-valued columns: arrays, jsonb containment, full-text, trigrams. Reads are fast; writes are expensive, mitigated by the fastupdate pending list.</p>', fu: 'jsonb_ops vs jsonb_path_ops? (ops: per-key and value entries, supports ?; path_ops: hash of full path+value, smaller, containment only.)', lvl: 'deep' },
    { q: 'What is GiST and when do you use it?', a: '<p>A generalized balanced tree where each internal entry holds a predicate (e.g. bounding box or range union) covering its subtree. Searches descend every child whose predicate is consistent with the query, so subtrees may overlap. Supports overlap, containment, and KNN ordering (<code>&lt;-&gt;</code>). Used for ranges, geometry/PostGIS, exclusion constraints, and trigram similarity.</p>', lvl: 'core' },
    { q: 'Explain BRIN and its prerequisites.', a: '<p>BRIN stores a summary (by default min/max) per range of <code>pages_per_range</code> (128) heap pages. A query marks matching ranges and the executor reads all their pages (lossy bitmap) and rechecks. It is tiny and cheap to maintain, but only useful when the column correlates with physical order, i.e. append-only time series. New ranges are summarized by vacuum, or immediately with <code>autosummarize</code>.</p>', lvl: 'core' },
    { q: 'When would you use a hash index?', a: '<p>Equality-only lookups on wide keys (long URLs, tokens), PG10+ where they are WAL-logged. The index stores 4-byte hash codes, so it can be smaller than a B-tree on long text. No uniqueness, ordering, ranges, multi-column or index-only scans.</p>', lvl: 'core' },
    { q: 'Give a production use of a partial index.', a: '<p>Queue table where 99.9% of rows are done: <code>CREATE INDEX ON jobs (run_at) WHERE status = \'pending\'</code>. Small, hot in cache, cheap to maintain (done rows aren’t in it). Also partial unique indexes: “one active subscription per user”: <code>UNIQUE (user_id) WHERE active</code>.</p>', fu: 'Why might it not be used from JDBC? (Generic plan with a parameter for status.)', lvl: 'core' },
    { q: 'What is an expression index, and what are its pitfalls?', a: '<p>An index on the result of an expression, e.g. <code>lower(email)</code> or <code>(attrs-&gt;&gt;\'sku\')</code>. The function must be IMMUTABLE. The query must use the same expression (casts and collation included). ANALYZE gathers statistics on the expression, which can also fix bad estimates.</p>', lvl: 'core' },
    { q: 'How do you choose between GIN and GiST for full-text or trigram search?', a: '<p>GIN: faster lookups, slower updates, larger. GiST: lossy signatures, smaller, faster to update, supports KNN ordering by similarity (<code>&lt;-&gt;</code> with pg_trgm). For mostly-read search, GIN; for frequently updated data or nearest-match ranking, GiST.</p>', lvl: 'deep' },
    { q: 'What is SP-GiST?', a: '<p>Space-partitioned GiST for non-balanced structures: quadtrees, k-d trees, radix tries. Good for points, IP ranges (inet), and text prefix searches with uneven distributions. Partitions don’t overlap, unlike GiST.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Spring Data: jsonb containment that hits GIN', lang: 'java', code: `@Query(value = """
    SELECT * FROM products
    WHERE attrs @> CAST(:filter AS jsonb)
    LIMIT 50""", nativeQuery = true)
List<Product> findByAttrs(@Param("filter") String filterJson);

// call with: findByAttrs("{\\"brand\\":\\"acme\\",\\"color\\":\\"red\\"}")
// NOT: WHERE attrs->>'brand' = :brand  (no GIN support)` },
    { title: 'Exclusion constraint in a Flyway migration', lang: 'sql', code: `-- V42__no_double_booking.sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (room_id WITH =, during WITH &&);
-- violation surfaces in Spring as DataIntegrityViolationException (SQLState 23P01)` }
  ]
});

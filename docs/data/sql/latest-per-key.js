IA.register({
  track: 'sql',
  slug: 'latest-per-key',
  title: 'Latest row per key, and dedup',
  tagline: '“Latest reading per device”, “current price per product”, “remove duplicate sign-ups”: one problem, four idioms. <code>DISTINCT ON</code>, <code>ROW_NUMBER()</code>, <code>LATERAL … LIMIT 1</code> and an anti-join, each with a different cost profile and tie behaviour.',
  tldr: {
    problem: '<code>GROUP BY device_id</code> + <code>max(ts)</code> gives the latest timestamp, not the latest <i>row</i>. Joining back is slow and duplicates ties.',
    model: 'Either <b>sort and keep the first row per group</b> (DISTINCT ON, ROW_NUMBER), or <b>for each key, seek the newest row</b> through an index (LATERAL). Ties must be broken by a unique column or the result is arbitrary.',
    hook: '“Our dashboard shows a different temperature every refresh.” Two readings with the same timestamp and no tie-breaker.',
    facts: [
      { v: 'leftmost', l: '<code>DISTINCT ON (a)</code> expressions must match the leftmost <code>ORDER BY</code> items, or Postgres errors' },
      { v: 'few keys', l: 'LATERAL + index (key, ts DESC) wins when there are few keys with many rows each; sort-based methods win when most rows are already “latest”' },
      { v: 'ctid', l: 'the physical row address: the only handle on exact duplicates that have no key' }
    ]
  },
  intro: {
    what: 'A table often holds <b>history</b>: many readings per sensor, many prices per product. A very common question is “show me only the <b>most recent</b> row for each sensor”. SQL has several ways to keep one row per group.',
    analogy: { icon: '📬', title: 'The newest letter from each friend', text: 'You have a pile of letters. Sort them by friend, newest first, and take the top letter of each friend’s stack. That is DISTINCT ON. Or, for each friend in your address book, go to their folder and grab the top letter. That is LATERAL, and it also tells you which friends never wrote.' },
    steps: [
      { t: 'Why GROUP BY isn’t enough', d: 'It can give the max timestamp, but not the other columns of that row.', code: 'SELECT device_id, max(ts) FROM readings GROUP BY device_id;' },
      { t: 'DISTINCT ON (Postgres-specific)', d: 'Keep the first row of each group, in ORDER BY order.', code: 'SELECT DISTINCT ON (device_id) *\nFROM readings\nORDER BY device_id, ts DESC, id DESC;' },
      { t: 'ROW_NUMBER (standard SQL)', d: 'Number rows within each group, keep number 1. Works for “top 3 per group” too.', code: 'SELECT * FROM (\n  SELECT r.*, row_number() OVER (PARTITION BY device_id ORDER BY ts DESC, id DESC) rn\n  FROM readings r) s\nWHERE rn = 1;' },
      { t: 'Always break ties', d: 'Add a unique column (<code>id</code>) at the end of the ordering so “first” is well defined.' }
    ],
    terms: [
      ['DISTINCT ON', 'Postgres extension: one row per distinct value of the listed expressions, the first in ORDER BY order.'],
      ['window function', 'A function computed over related rows without collapsing them, e.g. <code>row_number() OVER (…)</code>.'],
      ['PARTITION BY', 'Splits rows into groups for a window function.'],
      ['LATERAL', 'A subquery in FROM that can reference columns of tables to its left: “for each row, run this”.'],
      ['anti-join', '“Keep rows for which no matching row exists”, written with NOT EXISTS.'],
      ['ctid', 'The physical location (page, slot) of a row version. It changes on UPDATE and VACUUM FULL.']
    ]
  },
  visual: {
    title: 'Four ways to keep the latest row per device',
    caption: 'Device 2 has two readings at exactly 12:00. Toggle the <code>id</code> tie-breaker and watch what each method does with the tie. Device 4 has no readings at all.'
  },
  playground: {
    setup: `
CREATE TABLE devices (id int PRIMARY KEY, name text);
CREATE TABLE readings (id int PRIMARY KEY, device_id int NOT NULL, ts timestamptz NOT NULL, temp numeric);
CREATE INDEX readings_dev_ts ON readings (device_id, ts DESC, id DESC);
INSERT INTO devices VALUES (1,'boiler'),(2,'freezer'),(3,'roof'),(4,'spare');
INSERT INTO readings VALUES
 (1,1,'2026-03-01 10:00+00',20.1),(2,1,'2026-03-01 11:00+00',20.5),(3,1,'2026-03-01 09:00+00',19.8),
 (4,2,'2026-03-01 10:00+00',18.0),(5,2,'2026-03-01 12:00+00',18.4),(6,2,'2026-03-01 12:00+00',18.9),
 (7,3,'2026-03-01 08:00+00',25.0);
CREATE TABLE signups (email text, created_at timestamptz);
INSERT INTO signups VALUES
 ('a@x.io','2026-03-01'),('a@x.io','2026-03-02'),('A@x.io','2026-03-03'),
 ('b@x.io','2026-03-01'),('b@x.io','2026-03-01');`,
    presets: [
      { label: 'DISTINCT ON', sql: `SELECT DISTINCT ON (device_id) device_id, id, ts, temp
FROM readings
ORDER BY device_id, ts DESC, id DESC;`, note: 'Device 2 → id 6, deterministically, because of <code>id DESC</code>.' },
      { label: 'ROW_NUMBER vs RANK', sql: `SELECT device_id, id, ts,
       row_number() OVER w AS rn,
       rank()       OVER w AS rnk
FROM readings
WINDOW w AS (PARTITION BY device_id ORDER BY ts DESC)
ORDER BY device_id, ts DESC, id;`, note: '<code>rank()</code> gives both 12:00 rows rank 1; <code>row_number()</code> picks one arbitrarily. Use rank when ties should all be returned.' },
      { label: 'LATERAL (incl. missing)', sql: `SELECT d.id, d.name, r.ts, r.temp
FROM devices d
LEFT JOIN LATERAL (
  SELECT ts, temp FROM readings r
  WHERE r.device_id = d.id
  ORDER BY ts DESC, id DESC
  LIMIT 1
) r ON true
ORDER BY d.id;`, note: 'Device 4 (spare) appears with NULLs. With an index on (device_id, ts DESC, id DESC), each device is one index probe.' },
      { label: 'Self anti-join', sql: `SELECT r.*
FROM readings r
WHERE NOT EXISTS (
  SELECT 1 FROM readings n
  WHERE n.device_id = r.device_id
    AND (n.ts, n.id) > (r.ts, r.id)
)
ORDER BY device_id;`, note: 'Portable to any SQL engine. Without the <code>id</code> part (<code>n.ts &gt; r.ts</code>) both tied rows of device 2 survive.' },
      { label: 'Delete duplicates', sql: `-- exact duplicates (b@x.io twice, same timestamp): keep one per email
DELETE FROM signups
WHERE ctid IN (
  SELECT ctid FROM (
    SELECT ctid, row_number() OVER (PARTITION BY lower(email) ORDER BY created_at, ctid) rn
    FROM signups) s
  WHERE rn > 1);
SELECT * FROM signups ORDER BY 1;
-- prevent recurrence
CREATE UNIQUE INDEX IF NOT EXISTS signups_email_uq ON signups (lower(email));`, note: 'Partition by <code>lower(email)</code>, otherwise A@x.io survives as a “different” user, and the unique index creation then fails.' },
      { label: 'Performance', sql: `DROP TABLE IF EXISTS big, big_dev;
CREATE TABLE big AS
SELECT g AS id, g % 200 AS device_id, timestamptz '2026-01-01' + g * interval '1 second' AS ts, random() AS v
FROM generate_series(1, 60000) g;
CREATE INDEX ON big (device_id, ts DESC, id DESC);
CREATE TABLE big_dev AS SELECT DISTINCT device_id AS id FROM big;
ANALYZE big; ANALYZE big_dev;
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF)
SELECT DISTINCT ON (device_id) * FROM big ORDER BY device_id, ts DESC, id DESC;
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF)
SELECT d.id, b.* FROM big_dev d
CROSS JOIN LATERAL (SELECT * FROM big WHERE device_id = d.id ORDER BY ts DESC, id DESC LIMIT 1) b;`, note: 'Compare the <i>Execution Time</i> lines: DISTINCT ON reads all 60,000 rows; LATERAL does 200 index probes (one row each). With 60,000 keys of 1 row each, the order flips.' }
    ]
  },
  gotchas: [
    { trap: 'DISTINCT ON with a mismatched ORDER BY', code: `SELECT DISTINCT ON (device_id) * FROM readings ORDER BY ts DESC;\n-- ERROR: SELECT DISTINCT ON expressions must match initial ORDER BY expressions`, why: 'Postgres implements DISTINCT ON by sorting on the DISTINCT ON keys first and keeping the first row of each run.', fix: 'Put the DISTINCT ON expressions first in ORDER BY, then the “which one” ordering. Wrap in a subquery to re-sort the output.' },
    { trap: 'No tie-breaker', why: 'Two rows with equal <code>ts</code> make “first” undefined. The choice can change with the plan, parallelism or data layout.', fix: 'End the ordering with a unique column: <code>ts DESC, id DESC</code>.' },
    { trap: 'max() then join back', code: `SELECT r.* FROM readings r\nJOIN (SELECT device_id, max(ts) m FROM readings GROUP BY 1) x\n  ON x.device_id = r.device_id AND r.ts = x.m;   -- ties → 2 rows`, why: 'Scans the table twice and returns every tied row.', fix: 'Use DISTINCT ON, ROW_NUMBER or LATERAL.' },
    { trap: 'Deleting duplicates by ctid in a live system', why: 'ctid changes when a row is updated (or moved by VACUUM FULL / pg_repack). A ctid from one statement may point to a different row version later.', fix: 'Do the lookup and DELETE in one statement (as in the preset). Never store ctids.' },
    { trap: 'CREATE UNIQUE INDEX fails after the cleanup', why: 'New duplicates arrived between the DELETE and the index build, or the dedup key (case, whitespace) differs from the index key.', fix: 'Use the same expression in both. In production: <code>CREATE UNIQUE INDEX CONCURRENTLY</code>; if it fails it leaves an INVALID index you must drop and retry.' },
    { trap: 'LATERAL without the right index', why: 'Without <code>(device_id, ts DESC)</code> each probe is a scan plus sort: N keys × full scan.', fix: 'Create the composite index. A plain <code>(device_id, ts)</code> works too, scanned backward.' }
  ],
  scenarios: [
    { title: 'IoT dashboard “current temperature” query takes 14 s',
      symptom: 'A 900M-row readings table, 20k devices. The tile query uses <code>DISTINCT ON (device_id) … ORDER BY device_id, ts DESC</code> and spills a sort to disk.',
      diagnose: `EXPLAIN (ANALYZE, BUFFERS)\nSELECT DISTINCT ON (device_id) * FROM readings ORDER BY device_id, ts DESC;\n-- Sort Method: external merge  Disk: 41GB`,
      cause: 'DISTINCT ON reads every row to keep 20k. The work is proportional to the table, not the answer.',
      fix: 'Drive from the small devices table with LATERAL LIMIT 1 over an index on <code>(device_id, ts DESC)</code>: 20k index probes. Or maintain a <code>device_latest</code> table via upsert on insert.',
      fixCode: `SELECT d.id, r.*\nFROM devices d\nCROSS JOIN LATERAL (\n  SELECT * FROM readings WHERE device_id = d.id\n  ORDER BY ts DESC LIMIT 1) r;` },
    { title: 'Unique index migration fails at 3 a.m.',
      symptom: 'Migration <code>CREATE UNIQUE INDEX CONCURRENTLY users_email_uq ON users (lower(email))</code> fails with “could not create unique index”, leaving an INVALID index that still slows writes.',
      diagnose: `SELECT lower(email), count(*) FROM users GROUP BY 1 HAVING count(*) > 1;\nSELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;`,
      cause: 'The dedup script compared <code>email</code> case-sensitively; the index uses <code>lower(email)</code>. Also, sign-ups kept creating duplicates during the run.',
      fix: 'Drop the invalid index, dedup on the same expression, block new duplicates in the app (or with a trigger) while you rebuild, then retry CONCURRENTLY.',
      fixCode: `DROP INDEX CONCURRENTLY users_email_uq;\nDELETE FROM users u USING users k\nWHERE lower(u.email) = lower(k.email) AND u.id > k.id;` },
    { title: 'Price shown flips between two values',
      symptom: 'Product page shows €19.99 or €24.99 at random. Both prices have <code>valid_from = 2026-05-01</code>.',
      diagnose: `SELECT product_id, valid_from, count(*) FROM prices\nGROUP BY 1, 2 HAVING count(*) > 1;`,
      cause: '<code>row_number() OVER (PARTITION BY product_id ORDER BY valid_from DESC)</code> without a tie-breaker. A parallel plan picked differently each time.',
      fix: 'Add <code>id DESC</code> to the ordering, and a unique constraint on <code>(product_id, valid_from)</code> so the ambiguity can’t exist.' }
  ],
  puzzles: [
    { kind: 'predict', q: 'What happens?', code: `SELECT DISTINCT ON (device_id) device_id, temp\nFROM readings\nORDER BY ts DESC;`, options: ['3 rows, latest per device', '7 rows', 'Error', '1 row'], answer: 2, explain: '“SELECT DISTINCT ON expressions must match initial ORDER BY expressions”. <code>device_id</code> must come first in ORDER BY.' },
    { kind: 'predict', q: 'How many rows have rank 1?', code: `SELECT count(*) FROM (\n  SELECT rank() OVER (PARTITION BY device_id ORDER BY ts DESC) r FROM readings) s\nWHERE r = 1;`, options: ['3', '4', '7', '1'], answer: 1, explain: 'Device 1: one, device 2: two (tie at 12:00), device 3: one → <b>4</b>. With <code>row_number()</code> it would be 3.' },
    { kind: 'predict', q: 'Rows returned?', code: `SELECT d.id, r.temp FROM devices d\nLEFT JOIN LATERAL (\n  SELECT temp FROM readings r WHERE r.device_id = d.id\n  ORDER BY ts DESC LIMIT 1) r ON true;`, options: ['3', '4', '7', '8'], answer: 1, explain: 'One per device, and LEFT JOIN keeps device 4 with NULL: <b>4</b>. <code>CROSS JOIN LATERAL</code> would return 3.' },
    { kind: 'predict', q: 'How many rows survive this anti-join (no tie-breaker)?', code: `SELECT r.id FROM readings r\nWHERE NOT EXISTS (\n  SELECT 1 FROM readings n\n  WHERE n.device_id = r.device_id AND n.ts > r.ts);`, options: ['3', '4', '5', '7'], answer: 1, explain: 'Ids 2, 5, 6, 7: neither 12:00 row of device 2 has a strictly newer sibling, so both survive: <b>4</b>.' },
    { kind: 'predict', q: 'How many rows remain?', code: `DELETE FROM signups a USING signups b\nWHERE a.email = b.email AND a.ctid > b.ctid;\nSELECT count(*) FROM signups;`, options: ['2', '3', '4', '5'], answer: 1, explain: 'One a@x.io, one b@x.io, and <b>A@x.io</b> survives because <code>=</code> on text is case-sensitive: <b>3</b>.' },
    { kind: 'concept', q: 'Which approach is usually fastest for “latest row” over 5,000 keys × 100,000 rows each, with an index on (key, ts DESC)?', options: ['DISTINCT ON', 'ROW_NUMBER() = 1', 'Keys table + LATERAL … LIMIT 1', 'GROUP BY + join back'], answer: 2, explain: '5,000 index probes vs sorting or scanning 500M rows. Without a keys table, a recursive CTE “loose index scan” gets the distinct keys cheaply too.' }
  ],
  interview: [
    { q: 'Explain DISTINCT ON and its ORDER BY rule.', a: '<p><code>DISTINCT ON (exprs)</code> keeps the first row of each group of equal <code>exprs</code>, where “first” is defined by ORDER BY. The DISTINCT ON expressions must be the leftmost ORDER BY items, because it is implemented as sort (or index order) + “keep first of each run” (a Unique node).</p>', fu: 'How do you then order the output by ts? (Wrap it in a subquery.)', lvl: 'core' },
    { q: 'ROW_NUMBER vs RANK vs DENSE_RANK for top-N per group?', a: '<p>row_number: exactly N per group, ties broken arbitrarily unless you add a tie-breaker. rank: all ties at position 1, then a gap. dense_rank: ties share a number with no gaps, so “top 3 distinct values”.</p>', lvl: 'core' },
    { q: 'When does LATERAL beat DISTINCT ON?', a: '<p>When keys are few and each has many rows, and an index on <code>(key, ts DESC)</code> exists. Cost ≈ keys × one index descent, independent of history size. DISTINCT ON reads everything. When most rows are “latest” (few versions per key), a single sorted pass wins.</p>', lvl: 'deep' },
    { q: 'You don’t have a keys table. How do you get distinct keys cheaply from a huge table?', a: '<p>A recursive CTE “loose index scan”: start with <code>min(key)</code>, then repeatedly <code>SELECT min(key) WHERE key &gt; previous</code>. Each step is one index descent. Postgres has no built-in skip scan for this case yet (PG18 added skip scan for multicolumn B-tree lookups with an unconstrained leading column, a different case).</p>', lvl: 'deep' },
    { q: 'How do you delete exact duplicate rows with no primary key?', a: '<p>Use ctid as the tie-breaker: <code>DELETE … WHERE ctid IN (SELECT ctid FROM (SELECT ctid, row_number() OVER (PARTITION BY cols ORDER BY ctid) rn …) WHERE rn &gt; 1)</code>. Do it in one statement; then add a unique index so it can’t recur.</p>', lvl: 'core' },
    { q: 'Large dedup on a busy 200M-row table: how?', a: '<p>Batch it: find duplicate keys first (GROUP BY HAVING count &gt; 1) into a temp table, delete in key ranges of a few thousand, commit per batch, watch replication lag. Then <code>CREATE UNIQUE INDEX CONCURRENTLY</code>. If the dup ratio is huge, a CTAS of the distinct rows + swap is cheaper.</p>', lvl: 'deep' },
    { q: 'Why does a max()+join-back query return duplicates?', a: '<p>It joins on the timestamp value, so every row tied at the max matches. It also scans twice.</p>', lvl: 'core' },
    { q: 'How would you keep “latest per key” O(1) to read?', a: '<p>Maintain a side table with one row per key, upserted on each insert: <code>ON CONFLICT (key) DO UPDATE … WHERE EXCLUDED.ts &gt; latest.ts</code>. The WHERE makes out-of-order arrivals safe. Trade-off: one extra write per insert and hot-row contention for busy keys.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Spring Data native query: latest per device', lang: 'java', code: `public interface LatestReading { Long getDeviceId(); Instant getTs(); BigDecimal getTemp(); }

@Query(value = """
    SELECT d.id AS deviceId, r.ts AS ts, r.temp AS temp
    FROM devices d
    LEFT JOIN LATERAL (
      SELECT ts, temp FROM readings
      WHERE device_id = d.id ORDER BY ts DESC, id DESC LIMIT 1
    ) r ON true
    WHERE d.site_id = :site""", nativeQuery = true)
List<LatestReading> latestForSite(@Param("site") long siteId);`, note: 'JPQL has no DISTINCT ON or LATERAL; Hibernate 6.1+ HQL supports <code>lateral</code> joins and window functions, but a native query is clearer here.' }
  ]
});

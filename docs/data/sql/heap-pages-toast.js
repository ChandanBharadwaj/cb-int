IA.register({
  track: 'sql',
  slug: 'heap-pages-toast',
  title: 'Heap pages, tuples and TOAST',
  tagline: 'Every Postgres table is a file of <b>8 KB pages</b>. Each page holds a header, an array of line pointers growing down, and row versions (tuples) growing up. UPDATE writes a <b>new tuple</b>, so the row’s <code>ctid</code> changes, unless it can stay on the page as a <b>HOT</b> update.',
  tldr: {
    problem: 'Bloat, write amplification, “why did this tiny UPDATE touch 6 indexes”, why a 10 KB JSON column doesn’t make the row 10 KB: all of these come from the page layout.',
    model: 'A row = one or more <b>tuple versions</b>, each with a 23-byte header (<code>xmin</code>, <code>xmax</code>, <code>ctid</code>, flags). Indexes point at <code>(page, slot)</code>. A HOT update keeps the new version on the same page and skips index writes. Values over ~2 KB get compressed and/or moved to a TOAST table.',
    hook: '“We changed only <code>last_seen_at</code>, so why did WAL volume triple?” Because <code>last_seen_at</code> was indexed, so no update was HOT.',
    facts: [
      { v: '8192 B', l: 'default block size, fixed at compile time. At most 291 tuples fit on one heap page' },
      { v: '23 B + align', l: 'tuple header (padded to 24) plus 4 B per line pointer: a narrow row costs ~30 bytes of overhead' },
      { v: '~2 KB', l: 'the TOAST threshold: wider tuples get their large values compressed (pglz, or lz4 PG14+) and/or stored out of line' }
    ]
  },
  intro: {
    what: 'On disk a table isn’t a spreadsheet; it’s a file chopped into <b>8 KB pages</b>. Each page holds a handful of rows. Postgres never overwrites a row in place: an UPDATE writes a <b>new copy</b> and marks the old one as expired. That one design choice explains vacuum, bloat and much of indexing.',
    analogy: { icon: '🗂️', title: 'A notebook page with a table of contents', text: 'Each page has a small index at the top (“entry 1 is at line 40, entry 2 at line 31…”) written downward, while the entries are written from the bottom of the page upward. When they meet, the page is full. Correcting an entry means crossing it out and writing a new one, and updating the contents line.' },
    steps: [
      { t: 'Every row has a hidden address', d: '<code>ctid</code> = (page number, slot on the page).', code: 'SELECT ctid, * FROM accounts LIMIT 3;\n-- (0,1) (0,2) (0,3)' },
      { t: 'UPDATE creates a new version', d: 'The old version gets <code>xmax</code> set; the new one gets a new ctid.', code: 'UPDATE accounts SET note = \'hi\' WHERE id = 2;\nSELECT ctid FROM accounts WHERE id = 2;   -- (0,4)' },
      { t: 'Old versions are cleaned later', d: 'Once no transaction can see them, VACUUM (or page pruning) frees the space for reuse.' },
      { t: 'Big values go elsewhere', d: 'Long text / JSONB / bytea values are compressed and, if still large, sliced into ~2 KB chunks in a side table called TOAST.' }
    ],
    terms: [
      ['page / block', 'The 8 KB unit Postgres reads and writes. Tables and indexes are arrays of pages.'],
      ['tuple', 'One physical version of a row.'],
      ['ctid', '(block, line pointer) address of a tuple version. Not stable: changes on UPDATE, VACUUM FULL, CLUSTER.'],
      ['xmin / xmax', 'Ids of the transaction that created / deleted (or locked) this version. Visibility is decided from these.'],
      ['HOT update', 'Heap-Only Tuple: the new version stays on the same page and no indexed column changed, so no index entries are added.'],
      ['TOAST', 'The Oversized-Attribute Storage Technique: compression plus out-of-line storage for large values.']
    ]
  },
  visual: {
    title: 'Inside one 8 KB heap page',
    caption: 'Rows are ~1.3 KB each so a page fills quickly. Pick a fillfactor and what the UPDATE touches, then press Play. Watch pd_lower / pd_upper, the old tuple’s xmax and t_ctid, and whether the index gets a new entry.'
  },
  playground: {
    setup: `
CREATE TABLE acct (id int PRIMARY KEY, status text, note text) WITH (fillfactor = 70);
CREATE INDEX acct_status ON acct (status);
INSERT INTO acct SELECT g, 'new', repeat('x', 1300) FROM generate_series(1, 12) g;
CREATE TABLE acct_full (LIKE acct INCLUDING ALL) WITH (fillfactor = 100);
INSERT INTO acct_full SELECT * FROM acct;
CREATE TABLE docs (id int PRIMARY KEY, body text);
INSERT INTO docs VALUES
 (1, repeat('a', 100)),
 (2, repeat('a', 10000)),
 (3, (SELECT string_agg(md5(g::text), '') FROM generate_series(1, 200) g));`,
    presets: [
      { label: 'ctid, xmin, xmax', sql: `SELECT ctid, xmin, xmax, id FROM acct WHERE id <= 3 ORDER BY id;
UPDATE acct SET note = 'v2' WHERE id = 2;
SELECT ctid, xmin, xmax, id FROM acct WHERE id <= 3 ORDER BY id;`, note: 'Row 2 moves from (0,2) to a new slot on the same page, with a new xmin. The old version is still physically there until pruned.' },
      { label: 'Rows per page vs fillfactor', sql: `SELECT 'ff70' AS t, (ctid::text::point)[0]::int AS page, count(*) FROM acct GROUP BY 1, 2
UNION ALL
SELECT 'ff100', (ctid::text::point)[0]::int, count(*) FROM acct_full GROUP BY 1, 2
ORDER BY 1, 2;
SELECT pg_relation_size('acct') AS ff70_bytes, pg_relation_size('acct_full') AS ff100_bytes;`, note: 'fillfactor 70 stops INSERTs at 70% of the page, so 4 rows instead of 6. The reserve is used only by UPDATEs of rows on that page.' },
      { label: 'HOT or not?', sql: `UPDATE acct SET note = 'changed' WHERE id = 1;        -- non-indexed column, room on page
UPDATE acct SET status = 'paid' WHERE id = 5;        -- indexed column
UPDATE acct_full SET note = note || '!' WHERE id = 1; -- page is full
SELECT 'acct' AS t, pg_stat_get_xact_tuples_updated('acct'::regclass) AS updates,
       pg_stat_get_xact_tuples_hot_updated('acct'::regclass) AS hot
UNION ALL
SELECT 'acct_full', pg_stat_get_xact_tuples_updated('acct_full'::regclass),
       pg_stat_get_xact_tuples_hot_updated('acct_full'::regclass);
SELECT 'acct_full row 1 now at' AS what, ctid FROM acct_full WHERE id = 1;`, note: 'acct: 2 updates, 1 HOT (the status one had to insert into both indexes). acct_full: the new version didn’t fit, so it moved to another page: not HOT. In production read <code>n_tup_hot_upd</code> in <code>pg_stat_user_tables</code>.' },
      { label: 'TOAST', sql: `SELECT id, length(body) AS chars, pg_column_size(body) AS stored_bytes,
       pg_column_compression(body) AS compression
FROM docs ORDER BY id;
SELECT c.relname, pg_relation_size(c.oid) AS heap_bytes,
       c.reltoastrelid::regclass AS toast_table,
       pg_relation_size(c.reltoastrelid) AS toast_bytes
FROM pg_class c WHERE relname = 'docs';`, note: 'Row 2: 10,000 repeated chars compress to ~125 bytes and stay inline. Row 3: 6,400 hex chars don’t compress enough, so they go out of line into the TOAST table.' },
      { label: 'Alignment padding', sql: `DROP TABLE IF EXISTS bad, good;
CREATE TABLE bad  (a int2, b int8, c int2, d int8);
CREATE TABLE good (b int8, d int8, a int2, c int2);
INSERT INTO bad VALUES (1, 2, 3, 4);
INSERT INTO good VALUES (2, 4, 1, 3);
SELECT 'bad' AS t, pg_column_size(bad.*) FROM bad
UNION ALL SELECT 'good', pg_column_size(good.*) FROM good;`, note: 'int8 must start on an 8-byte boundary, so each int2 before it wastes 6 bytes. Same data, 56 vs 44 bytes per row (header included). On a billion rows that is 12 GB.' },
      { label: 'Page count', sql: `SELECT pg_relation_size('acct') / current_setting('block_size')::int AS pages,
       count(*) AS rows,
       max(ctid) AS last_ctid
FROM acct;`, note: 'Sizes are always a multiple of 8,192. A seq scan reads every page, including pages that are mostly dead tuples (bloat).' }
    ]
  },
  gotchas: [
    { trap: 'Using ctid as a row id', why: 'ctid changes on every non-HOT and HOT update, and on VACUUM FULL / CLUSTER / pg_repack. Stored ctids point at the wrong row or nothing.', fix: 'Use it only inside a single statement (e.g. dedup deletes). Use the primary key everywhere else.' },
    { trap: 'Indexing a frequently-updated column', code: `CREATE INDEX ON sessions (last_seen_at);   -- updated on every request`, why: 'Any change to an indexed column disables HOT: every update inserts into <b>every</b> index on the table, and writes more WAL.', fix: 'Don’t index hot columns unless you must. PG16+ HOT ignores BRIN-only (summarizing) indexes. Watch <code>n_tup_hot_upd / n_tup_upd</code>.' },
    { trap: 'Fillfactor 100 on an update-heavy table', why: 'No free space on the page means the new version goes to another page: not HOT, and the table spreads out.', fix: '<code>ALTER TABLE … SET (fillfactor = 80)</code> for tables with frequent updates of non-indexed columns. It applies to new pages; rewrite (VACUUM FULL / pg_repack) to apply it everywhere.' },
    { trap: 'SELECT * pulls TOASTed columns', why: 'Large out-of-line values are fetched (and decompressed) only when the column is read. <code>SELECT *</code> reads them all.', fix: 'Select only the columns you need. In JPA, use projections or move big columns to a separate entity with lazy loading.' },
    { trap: 'Updating a small field in a TOASTed row', why: 'Unchanged TOAST values are not rewritten (the pointer is copied), but modifying the big JSONB column rewrites the whole value, even for a one-key change.', fix: 'Keep frequently changed fields out of the big document. Split hot and cold columns into separate tables.' },
    { trap: 'Column order padding', why: 'Fixed-width types align to their size (int8, timestamptz: 8; int4: 4). Mixed order adds padding to every row.', fix: 'Order new tables: 8-byte columns, then 4, then 2, then variable-length. It usually isn’t worth a rewrite of an existing table.' }
  ],
  scenarios: [
    { title: 'WAL volume triples after an “innocent” index',
      symptom: 'Replica lag and backup size grow after a migration added <code>CREATE INDEX ON users (last_login_at)</code> for an admin report.',
      diagnose: `SELECT relname, n_tup_upd, n_tup_hot_upd,\n       round(100.0 * n_tup_hot_upd / nullif(n_tup_upd, 0), 1) AS hot_pct\nFROM pg_stat_user_tables ORDER BY n_tup_upd DESC LIMIT 5;\n-- users: hot_pct 96 → 2`,
      cause: '<code>last_login_at</code> is updated on every login. Before, those updates were HOT. Now every update inserts into all 7 indexes on <code>users</code>.',
      fix: 'Drop the index; serve the report from a replica with a seq scan, or a BRIN index (summarizing; PG16+ still allows HOT).',
      fixCode: `DROP INDEX CONCURRENTLY users_last_login_at_idx;\nALTER TABLE users SET (fillfactor = 85);` },
    { title: '“SELECT * FROM orders” is slow but count(*) is fast',
      symptom: 'An API listing 50 orders takes 900 ms. EXPLAIN shows the index scan finishes in 2 ms.',
      diagnose: `SELECT avg(pg_column_size(payload)) FROM orders;   -- 180 KB\nSELECT pg_size_pretty(pg_relation_size(reltoastrelid)) FROM pg_class WHERE relname = 'orders';`,
      cause: 'Each order carries a ~180 KB raw webhook JSON in a TOASTed column. SELECT * de-TOASTs 50 × 180 KB: ~90 chunk fetches per row plus decompression.',
      fix: 'Project only the needed columns; move <code>payload</code> to an <code>order_payloads</code> table; consider <code>lz4</code> compression (PG14+).',
      fixCode: `ALTER TABLE orders ALTER COLUMN payload SET COMPRESSION lz4;   -- new values only` },
    { title: 'Table is 3× larger than its data',
      symptom: 'A 2M-row queue table is 9 GB. Seq scans are slow even though few rows are live.',
      diagnose: `SELECT n_live_tup, n_dead_tup, last_autovacuum FROM pg_stat_user_tables WHERE relname = 'jobs';`,
      cause: 'Every state change writes a new tuple. A long-running transaction held back the xmin horizon, so vacuum couldn’t remove dead tuples; the file grew and never shrinks.',
      fix: 'Kill the long transaction, VACUUM, then rewrite once with pg_repack. Lower <code>autovacuum_vacuum_scale_factor</code> for that table and set fillfactor so state updates stay HOT.' }
  ],
  puzzles: [
    { kind: 'predict', q: 'Row 2 is at (0,2) and the page has room. Where is it after this UPDATE?', code: `UPDATE acct SET note = 'v2' WHERE id = 2;\nSELECT ctid FROM acct WHERE id = 2;`, options: ['(0,2)', '(0,5)', '(1,1)', '(3,1)'], answer: 1, explain: 'The new version goes in the next free slot on the same page: <b>(0,5)</b> (page 0 had 4 rows with fillfactor 70). The old version at (0,2) gets xmax set.' },
    { kind: 'predict', q: 'How many rows land on page 0 of acct_full (fillfactor 100, ~1.3 KB rows)?', code: `SELECT count(*) FROM acct_full WHERE (ctid::text::point)[0] = 0;`, options: ['4', '5', '6', '8'], answer: 2, explain: '6 × ~1.34 KB ≈ 8 KB. With fillfactor 70 it’s 4.' },
    { kind: 'predict', q: 'What does pg_column_size report for 10,000 repeated ‘a’ characters?', code: `SELECT pg_column_size(body) FROM docs WHERE id = 2;`, options: ['10,004', '~2,000', '~125', '18'], answer: 2, explain: 'The row exceeded ~2 KB, so TOAST compressed the value; pglz squeezes the repetition to about <b>125 bytes</b>, which then fits inline.' },
    { kind: 'predict', q: 'Bytes per row for (int2, int8, int2, int8), header included?', code: `CREATE TABLE p (a int2, b int8, c int2, d int8);\nINSERT INTO p VALUES (1, 2, 3, 4);\nSELECT pg_column_size(p.*) FROM p;`, options: ['44', '48', '56', '64'], answer: 2, explain: '24 (header) + 2 + 6 pad + 8 + 2 + 6 pad + 8 = <b>56</b>. Reordered as (int8, int8, int2, int2) it’s 44.' },
    { kind: 'concept', q: 'Which UPDATE can be HOT?', options: ['One that changes an indexed column', 'One whose new version fits on the same page and changes no indexed column', 'Any update with fillfactor < 100', 'Only updates inside VACUUM'], answer: 1, explain: 'Both conditions are required. (PG16+: changes to columns covered only by summarizing indexes such as BRIN don’t block HOT.)' },
    { kind: 'concept', q: 'An index entry points at (0,2). Row 2 was HOT-updated to (0,5), then the page was pruned. What is at line pointer 2 now?', options: ['Nothing; the index entry is deleted', 'A redirect line pointer to slot 5', 'The old tuple, kept forever', 'The new tuple, moved back'], answer: 1, explain: 'Pruning removes the dead tuple but keeps slot 2 as a <b>REDIRECT</b> to 5, so the unchanged index entry still finds the row.' }
  ],
  interview: [
    { q: 'Describe the layout of a heap page.', a: '<p>24-byte page header (LSN, checksum, flags, <code>pd_lower</code>, <code>pd_upper</code>, <code>pd_special</code>), then an array of 4-byte line pointers growing toward the end, free space, and tuples growing from the end toward the start. The page is full when pd_lower meets pd_upper. Heap pages have no special space; index pages use it (e.g. B-tree sibling links).</p>', lvl: 'core' },
    { q: 'What is in a tuple header?', a: '<p><code>t_xmin</code>, <code>t_xmax</code>, <code>t_cid</code>/<code>t_xvac</code>, <code>t_ctid</code> (points to itself or to the newer version), <code>t_infomask</code>/<code>t_infomask2</code> (hint bits, HOT flags, attribute count, has-nulls) and <code>t_hoff</code>, then an optional null bitmap. 23 bytes, padded to 24.</p>', lvl: 'deep' },
    { q: 'Explain HOT updates and why they matter.', a: '<p>If no indexed column changes and the new version fits on the same page, Postgres links old → new via t_ctid within the page and marks them HEAP_HOT_UPDATED / HEAP_ONLY_TUPLE. No index entries are inserted. Later, pruning (on any page access) can reclaim the dead version and turn its line pointer into a redirect, without VACUUM. This saves index writes, WAL and index bloat.</p>', fu: 'How do you raise the HOT ratio? (Fillfactor, fewer indexes on hot columns.)', lvl: 'deep' },
    { q: 'What does fillfactor do on a table?', a: '<p>It caps how full INSERTs (and COPY) may fill a page; UPDATEs can use the rest. Default 100 for tables, 90 for B-tree indexes. Lower it for tables with frequent updates so new versions stay on the same page (HOT).</p>', lvl: 'core' },
    { q: 'How does TOAST work?', a: '<p>When a tuple exceeds ~2 KB (TOAST_TUPLE_THRESHOLD), Postgres processes varlena columns by strategy (PLAIN, MAIN, EXTERNAL, EXTENDED). EXTENDED (the default for text/jsonb) first compresses (pglz, or lz4 in PG14+), then if still too large stores the value out of line in <code>pg_toast.pg_toast_&lt;oid&gt;</code> as ~2 KB chunks, leaving an 18-byte pointer. Values are fetched only when the column is accessed.</p>', fu: 'When would you SET STORAGE EXTERNAL? (Large values that don’t compress, or substring access on uncompressed text.)', lvl: 'deep' },
    { q: 'Why does ctid change on UPDATE, and why is that a problem?', a: '<p>MVCC never overwrites; the new version lives at a new (page, slot). Anything that remembers a ctid across statements can then point to a dead or different tuple. It is useful only within a statement or with <code>WHERE ctid = …</code> under a lock (TID scan).</p>', lvl: 'core' },
    { q: 'What does column order have to do with storage?', a: '<p>Fixed-length types are aligned (int8, float8, timestamptz: 8 bytes, int4: 4, int2: 2), and padding is inserted before them. Putting widest fixed columns first, then narrower, then varlena, removes padding. NULLs take no data space, only a bit in the null bitmap.</p>', lvl: 'core' },
    { q: 'Why doesn’t a table file shrink after a big DELETE?', a: '<p>VACUUM marks space reusable (free space map) but only truncates empty pages at the very end of the file. Reclaiming the rest needs a rewrite: VACUUM FULL (ACCESS EXCLUSIVE lock) or pg_repack / pg_squeeze online.</p>', lvl: 'core' },
    { q: 'What is the visibility map and how does it relate to pages?', a: '<p>Two bits per heap page: all-visible (lets index-only scans skip heap fetches, and vacuum skip the page) and all-frozen (lets anti-wraparound vacuum skip it). Any change on the page clears the bits until the next vacuum sets them again.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'JPA: keep big columns off the hot path', lang: 'java', code: `@Entity
class Order {
  @Id Long id;
  String status;
  Instant updatedAt;

  // big, rarely read: separate entity, loaded on demand
  @OneToOne(fetch = FetchType.LAZY, mappedBy = "order")
  OrderPayload payload;
}

@Entity
class OrderPayload {
  @Id Long orderId;
  @MapsId @OneToOne(fetch = FetchType.LAZY) Order order;
  @JdbcTypeCode(SqlTypes.JSON) String body;   // TOASTed jsonb
}`, note: 'Hibernate’s dirty checking updates all mapped columns by default. Use <code>@DynamicUpdate</code> so a status change doesn’t rewrite (and de-TOAST) the payload.' },
    { title: 'Monitor HOT ratio from Spring', lang: 'java', code: `@Scheduled(fixedRate = 300_000)
void hotRatio() {
  jdbc.query("""
      SELECT relname, n_tup_upd, n_tup_hot_upd FROM pg_stat_user_tables
      WHERE n_tup_upd > 10000""",
    rs -> { meter.gauge("pg.hot_ratio", Tags.of("table", rs.getString(1)),
        rs.getDouble(3) / rs.getDouble(2)); });
}` }
  ]
});

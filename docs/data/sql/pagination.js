IA.register({
  track: 'sql',
  slug: 'pagination',
  title: 'Pagination: OFFSET vs keyset',
  tagline: '<code>OFFSET 100000</code> means “read 100,000 rows and throw them away”. Keyset (seek) pagination remembers <b>where you stopped</b> and jumps there through the index, so page 5,000 costs the same as page 1.',
  tldr: {
    problem: 'Deep pages get linearly slower, and while users scroll, new rows shift every page: duplicates and silently skipped rows.',
    model: 'OFFSET counts rows from the start every time. Keyset says <code>WHERE (created_at, id) &lt; (:last_ts, :last_id)</code> and lets a composite B-tree index <b>seek</b> straight to the next row.',
    hook: '“Why does page 1 take 2 ms and page 4,000 take 3 s with the same LIMIT 25?” Because LIMIT doesn’t limit work; OFFSET + LIMIT rows are produced.',
    facts: [
      { v: 'O(offset)', l: 'rows produced and discarded for every OFFSET page, even with a perfect index' },
      { v: '(a, b) < (x, y)', l: 'a row-value comparison is a single index condition on <code>(a, b)</code>. Handwritten <code>a &lt; x AND b &lt; y</code> is wrong' },
      { v: 'count(*)', l: 'an exact total is a full index or heap scan, often more expensive than the page itself' }
    ]
  },
  intro: {
    what: 'Apps rarely show all rows at once; they show <b>pages</b> of, say, 20. The easy way is “skip 40, take 20” (<code>OFFSET 40 LIMIT 20</code>). The faster way is “give me 20 rows older than the last one I saw” (<b>keyset</b> pagination).',
    analogy: { icon: '📖', title: 'A bookmark vs counting pages', text: 'OFFSET is reopening a book and counting 300 pages from the front every time you want to continue. Keyset is a bookmark: you open straight at it. If someone glues a new page in at the front, the counter lands on the wrong page; the bookmark doesn’t move.' },
    steps: [
      { t: 'Always sort by something unique', d: 'Pages are only stable if the order is total. Add the primary key as a tie-breaker.', code: 'ORDER BY created_at DESC, id DESC' },
      { t: 'OFFSET paging', d: 'Simple and supports “jump to page 7”, but slower on every page.', code: 'SELECT * FROM posts\nORDER BY created_at DESC, id DESC\nLIMIT 20 OFFSET 40;   -- page 3' },
      { t: 'Keyset paging', d: 'Pass the last row’s sort values back as the cursor.', code: 'SELECT * FROM posts\nWHERE (created_at, id) < ($1, $2)\nORDER BY created_at DESC, id DESC\nLIMIT 20;' },
      { t: 'Back it with an index', d: 'The index must match the ORDER BY columns so Postgres can seek and read in order.', code: 'CREATE INDEX ON posts (created_at, id);' }
    ],
    terms: [
      ['LIMIT / OFFSET', 'Return at most N rows / skip the first M rows of the sorted result.'],
      ['keyset (seek) pagination', 'Filter by “after the last row seen” instead of skipping a count.'],
      ['cursor token', 'An opaque string (often base64 JSON) holding the last row’s sort values, sent to the client.'],
      ['tie-breaker', 'A unique column added to ORDER BY so no two rows compare equal.'],
      ['composite index', 'An index on several columns in a fixed order, e.g. <code>(created_at, id)</code>.']
    ]
  },
  visual: {
    title: 'Watch rows being read, discarded and returned',
    caption: 'Each box is an index entry in sort order (newest first). Grey = read and thrown away, green = returned. Try a deep page, then try a new post arriving between page 1 and page 2.'
  },
  playground: {
    setup: `
CREATE TABLE posts (id int PRIMARY KEY, created_at timestamptz NOT NULL, title text);
-- 10,000 posts, two per minute (so created_at has ties)
INSERT INTO posts
SELECT i, timestamptz '2026-01-01 00:00+00' + ((i + 1) / 2) * interval '1 minute', 'post ' || i
FROM generate_series(1, 10000) i;
CREATE INDEX posts_created_id ON posts (created_at, id);
ANALYZE posts;`,
    presets: [
      { label: 'OFFSET deep page', sql: `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT * FROM posts
ORDER BY created_at DESC, id DESC
LIMIT 10 OFFSET 9000;`, note: 'The index scan produces <b>9,010 rows</b> so Limit can drop 9,000 of them. Work grows with the page number.' },
      { label: 'Keyset seek', sql: `EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT * FROM posts
WHERE (created_at, id) < ('2026-01-01 00:50+00', 100)
ORDER BY created_at DESC, id DESC
LIMIT 10;`, note: 'Note <code>Index Cond: (ROW(created_at, id) &lt; ROW(…))</code>: one seek, then 10 rows. A handful of buffers no matter how deep.' },
      { label: 'Keyset page', sql: `-- page 1
SELECT id, created_at FROM posts ORDER BY created_at DESC, id DESC LIMIT 5;
-- page 2: cursor = last row of page 1 (created_at, id)
SELECT id, created_at FROM posts
WHERE (created_at, id) < ('2026-01-04 11:18+00', 9996)
ORDER BY created_at DESC, id DESC LIMIT 5;` },
      { label: 'OFFSET + concurrent insert', sql: `DELETE FROM posts WHERE id = 10001;   -- makes the preset re-runnable
-- page 1
SELECT id FROM posts ORDER BY created_at DESC, id DESC LIMIT 5 OFFSET 0;
-- meanwhile a new post arrives
INSERT INTO posts VALUES (10001, '2026-02-01', 'breaking news');
-- page 2
SELECT id FROM posts ORDER BY created_at DESC, id DESC LIMIT 5 OFFSET 5;`, note: 'id 9996 was the last row of page 1 and is now the first row of page 2: a <b>duplicate</b>. A delete would instead make one row vanish between pages.' },
      { label: 'Wrong cursor predicate', sql: `-- WRONG: separate comparisons skip rows that tie on created_at
SELECT id FROM posts
WHERE created_at <= '2026-01-01 00:50+00' AND id < 100
ORDER BY created_at DESC, id DESC LIMIT 3;
-- WRONG too
SELECT id FROM posts
WHERE created_at < '2026-01-01 00:50+00' AND id < 100
ORDER BY created_at DESC, id DESC LIMIT 3;
-- RIGHT
SELECT id FROM posts
WHERE (created_at, id) < ('2026-01-01 00:50+00', 100)
ORDER BY created_at DESC, id DESC LIMIT 3;`, note: 'The second query skips id 99 (same minute as 100). The first works here only because ids happen to grow with time. Row comparison is the safe form.' },
      { label: 'Total count cost', sql: `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF) SELECT count(*) FROM posts;
-- cheap estimate instead
SELECT reltuples::bigint AS approx_rows FROM pg_class WHERE relname = 'posts';`, note: 'An exact count reads every row (or every index entry). For “about 10k results”, the planner estimate is free.' }
    ]
  },
  gotchas: [
    { trap: 'Non-unique ORDER BY', code: `ORDER BY created_at DESC LIMIT 20 OFFSET 20   -- ties can swap between pages`, why: 'Rows with equal sort keys have no defined order. Different plans (or a parallel scan) can return them in a different order on each page, so rows repeat or disappear.', fix: 'Always append a unique column: <code>ORDER BY created_at DESC, id DESC</code>.' },
    { trap: 'a &lt; x AND b &lt; y is not “after (x, y)”', why: 'It drops every row with <code>a = x</code> (and rows with <code>a &lt; x</code> but a larger b).', fix: 'Use the row comparison <code>(a, b) &lt; (x, y)</code>, which Postgres turns into a single index condition.' },
    { trap: 'Mixed sort directions', code: `ORDER BY score DESC, id ASC   -- (score, id) < (…) no longer matches`, why: 'A row comparison applies one direction to all columns.', fix: 'Expand it: <code>score &lt; :s OR (score = :s AND id &gt; :id)</code>, and index <code>(score DESC, id ASC)</code>. Or negate a numeric column so both directions agree.' },
    { trap: 'OFFSET looks fine in dev', why: 'With 500 rows every page is instant. Crawlers and “last page” buttons hit OFFSET 200000 in production.', fix: 'Cap OFFSET (e.g. 1,000), or switch to keyset. Test with production-sized data.' },
    { trap: 'Total count on every request', why: '<code>SELECT count(*)</code> with the same filters can cost more than the page query, and it runs on every page view.', fix: 'Show “more results” instead, cache the count, or use the planner estimate (<code>EXPLAIN</code> rows or <code>reltuples</code>).' },
    { trap: 'Cursors that expose internals', why: 'A raw <code>?after_id=123</code> lets clients craft values and couples them to your sort.', fix: 'Encode the sort tuple (plus sort name and a version) in an opaque, signed base64 token.' },
    { trap: 'Nullable sort column', why: 'NULLs sort last in ASC and first in DESC, and <code>(NULL, id) &lt; (…)</code> is NULL, so those rows never appear in later pages.', fix: 'Make the column NOT NULL, or COALESCE it in both the index and the query.' }
  ],
  scenarios: [
    { title: 'Search API p99 goes from 40 ms to 9 s after a crawler finds it',
      symptom: 'CPU on the primary pinned at 100%. <code>pg_stat_statements</code> shows one query with huge <code>shared_blks_hit</code> per call.',
      diagnose: `SELECT query, calls, mean_exec_time, shared_blks_hit / calls AS blks_per_call\nFROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 5;\n-- access log: ?page=48211`,
      cause: 'A bot walks <code>?page=1..50000</code>. Each deep page is OFFSET n×25, so it reads and discards up to 1.2M index entries and heap rows per request.',
      fix: 'Switch the API to keyset cursors; keep page numbers only for the first ~40 pages for humans; rate-limit deep pages.',
      fixCode: `SELECT * FROM products\nWHERE category_id = $1 AND (created_at, id) < ($2, $3)\nORDER BY created_at DESC, id DESC LIMIT 25;\n-- index: (category_id, created_at, id)` },
    { title: 'Export job emits 0.4% duplicate rows and misses others',
      symptom: 'A nightly CSV export pages through <code>orders</code> with OFFSET while the shop is live. Finance finds duplicates; some orders are missing.',
      diagnose: `SELECT order_id, count(*) FROM export_rows GROUP BY 1 HAVING count(*) > 1;`,
      cause: 'Rows inserted or deleted ahead of the cursor shift every later page. Each page is its own snapshot.',
      fix: 'Keyset over an immutable unique key (<code>id</code>), or export in a single REPEATABLE READ transaction, or simply <code>COPY (SELECT …) TO STDOUT</code>.',
      fixCode: `SELECT * FROM orders WHERE id > $1 ORDER BY id LIMIT 10000;   -- loop with last id` },
    { title: 'Admin grid takes 6 s even on page 1',
      symptom: 'Spring Data <code>Page&lt;Order&gt;</code> endpoint is slow on every page, including the first.',
      diagnose: `-- Hibernate SQL log: two statements per request\nselect … from orders where status=? order by … limit ?;\nselect count(o.id) from orders o where status=?;   -- 5.8 s`,
      cause: '<code>Page</code> always runs a count query. With a non-selective filter that is a scan of millions of rows.',
      fix: 'Return <code>Slice</code> (fetches size+1 to detect “has next”, no count) or <code>Window</code> with a keyset <code>ScrollPosition</code>.' }
  ],
  puzzles: [
    { kind: 'predict', q: 'Page 1 has been shown. A new post arrives. Which id appears on both page 1 and page 2?', code: `SELECT id FROM posts ORDER BY created_at DESC, id DESC LIMIT 5 OFFSET 0;   -- 10000..9996\nINSERT INTO posts VALUES (10001, '2026-02-01', 'new');\nSELECT id FROM posts ORDER BY created_at DESC, id DESC LIMIT 5 OFFSET 5;`, options: ['10001', '9996', '9995', 'None'], answer: 1, explain: 'Everything shifted down one place, so the last row of page 1 (<b>9996</b>) is now row 6, the first row of page 2. Post 10001 is never seen unless the user goes back.' },
    { kind: 'bug', q: 'The cursor is (00:50, id 100). Ids 99 and 100 share that minute. What is the first row returned?', code: `SELECT id FROM posts\nWHERE created_at < '2026-01-01 00:50+00' AND id < 100\nORDER BY created_at DESC, id DESC LIMIT 1;`, options: ['99', '98', '100', 'No rows'], answer: 1, explain: '99 has <code>created_at = 00:50</code>, which fails the strict <code>&lt;</code>. It is skipped forever: you get <b>98</b>. <code>(created_at, id) &lt; (…, 100)</code> returns 99.' },
    { kind: 'predict', q: 'With the index on (created_at, id), roughly how many rows does the index scan produce?', code: `SELECT * FROM posts ORDER BY created_at DESC, id DESC\nLIMIT 10 OFFSET 5000;`, options: ['10', '5,000', '5,010', '10,000'], answer: 2, explain: 'Limit needs OFFSET + LIMIT = <b>5,010</b> rows from below it. The index avoids a sort, not the scanning.' },
    { kind: 'concept', q: 'Which index lets this keyset query seek and avoid a sort?', code: `WHERE tenant_id = $1 AND (created_at, id) < ($2, $3)\nORDER BY created_at DESC, id DESC LIMIT 20`, options: ['(created_at, id)', '(tenant_id, created_at, id)', '(id, created_at, tenant_id)', '(created_at, id, tenant_id)'], answer: 1, explain: 'Equality column first, then the sort columns in order. The scan is one contiguous range inside one tenant, read backward.' },
    { kind: 'concept', q: 'Spring Data: which return type avoids the extra count query but still tells you whether there is a next page?', options: ['Page&lt;T&gt;', 'List&lt;T&gt;', 'Slice&lt;T&gt;', 'Stream&lt;T&gt;'], answer: 2, explain: '<code>Slice</code> fetches <code>size + 1</code> rows to compute <code>hasNext()</code>. <code>Page</code> adds a count query. (List has no paging metadata.)' },
    { kind: 'concept', q: 'What can keyset pagination NOT do cheaply?', options: ['Next page', 'Previous page', 'Jump to page 731', 'Stable results under inserts'], answer: 2, explain: 'Previous is the same query with the comparison and ORDER BY reversed. Jumping to an arbitrary page number needs a count of rows before it, which is what OFFSET does.' }
  ],
  interview: [
    { q: 'Why is OFFSET slow even with an index?', a: '<p>The executor’s Limit node pulls OFFSET + LIMIT rows from its child and discards the first OFFSET. The index gives the order for free, but every skipped row is still read, visibility-checked (heap fetch unless index-only with an all-visible page), and passed up. Cost is linear in the offset.</p>', lvl: 'core' },
    { q: 'Write a keyset query for “newest first” with a stable tie-breaker.', a: '<p><code>WHERE (created_at, id) &lt; ($1, $2) ORDER BY created_at DESC, id DESC LIMIT n</code> with an index on <code>(created_at, id)</code> (scanned backward). The cursor is the last row’s <code>(created_at, id)</code>.</p>', fu: 'What if the sort is score DESC, id ASC? (Expand to OR form; index (score DESC, id).)', lvl: 'core' },
    { q: 'What are the consistency problems with OFFSET under concurrent writes?', a: '<p>Each page is a separate query and snapshot. Inserts before the current position push rows down (duplicates). Deletes pull rows up (skips). Keyset is anchored to a value, so it never duplicates, though rows inserted <i>behind</i> the cursor aren’t seen until you restart.</p>', lvl: 'core' },
    { q: 'How do you design a cursor token?', a: '<p>Serialize the sort-key tuple plus the sort name and filters hash, base64url it, optionally HMAC-sign it. Reject tokens whose filters don’t match the request. Don’t expose raw SQL values, and keep the format versioned so you can change sorts.</p>', lvl: 'deep' },
    { q: 'How do you show a total count without killing the database?', a: '<p>Options: don’t (infinite scroll, “more”), cap it (<code>SELECT count(*) FROM (SELECT 1 … LIMIT 1001) s</code> → “1000+”), use <code>EXPLAIN</code> estimates or <code>reltuples</code>, or maintain counters. Exact <code>count(*)</code> under MVCC has no shortcut: rows must be visibility-checked.</p>', lvl: 'deep' },
    { q: 'Page vs Slice vs Window in Spring Data?', a: '<p><code>Page</code>: content + total count (extra count query). <code>Slice</code>: content + hasNext (fetch size+1). <code>Window</code> (Spring Data 3.1+): scrolling API with <code>ScrollPosition.offset()</code> or <code>ScrollPosition.keyset()</code>; for keyset it builds the seek predicate from the last entity’s sort properties.</p>', lvl: 'core' },
    { q: 'Does the row comparison (a, b) &lt; (x, y) use the index?', a: '<p>Yes, for a B-tree on <code>(a, b)</code> it becomes a single <code>Index Cond: ROW(a, b) &lt; ROW(x, y)</code>, i.e. a seek to the boundary then a range scan. An OR expansion is semantically the same but is harder for the planner to turn into a single range.</p>', lvl: 'deep' },
    { q: 'How would you paginate a 500M-row table for a backfill job?', a: '<p>Keyset on the primary key: <code>WHERE id &gt; $last ORDER BY id LIMIT 5000</code>, commit per batch, sleep to respect replication lag. Never OFFSET. For very hot tables consider ctid range scans (PG14+ TID Range Scan).</p>', lvl: 'deep' },
    { q: 'What about server-side cursors (DECLARE CURSOR) for paging?', a: '<p>They hold a transaction (and a snapshot, and possibly the xmin horizon) open across user think time: vacuum can’t clean up, and with PgBouncer transaction pooling they don’t even work. Fine inside a single batch job, wrong for web paging.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Spring Data Window with keyset scrolling', lang: 'java', code: `interface PostRepo extends JpaRepository<Post, Long> {
  Window<Post> findFirst20ByOrderByCreatedAtDescIdDesc(ScrollPosition position);
}

// first page
Window<Post> w = repo.findFirst20ByOrderByCreatedAtDescIdDesc(ScrollPosition.keyset());
// next page: position built from the last element's sort keys
if (w.hasNext()) {
  Window<Post> next = repo.findFirst20ByOrderByCreatedAtDescIdDesc(w.positionAt(w.size() - 1));
}`, note: 'Spring Data 3.1+. Serialize <code>KeysetScrollPosition.getKeys()</code> into your cursor token for a REST API.' },
    { title: 'Slice instead of Page', lang: 'java', code: `Slice<Order> findByStatus(String status, Pageable p);   // no count query

// Page<Order> findByStatus(...) would also run:
//   select count(o) from Order o where o.status = ?` },
    { title: 'Plain JDBC keyset', lang: 'java', code: `String sql = """
    SELECT id, created_at, title FROM posts
    WHERE (created_at, id) < (?, ?)
    ORDER BY created_at DESC, id DESC
    LIMIT ?""";
List<Post> page = jdbc.query(sql, mapper, cursor.ts(), cursor.id(), size);` }
  ]
});

IA.register({
  track: 'sql',
  slug: 'btree-internals',
  title: 'B-tree indexes from the inside',
  tagline: 'A B-tree is a <b>sorted list of keys split into 8 KB pages</b>, with a few levels of signposts on top. A lookup walks root → internal → leaf; a range scan then walks <b>sideways along leaf links</b>. Column order in a composite index decides which predicates can narrow that walk.',
  tldr: {
    problem: 'Teams add indexes by guesswork: <code>(created_at, tenant_id)</code> when queries filter <code>tenant_id = ?</code> first, a DESC sort the index can’t serve, or an “index-only” scan that still hits the heap for every row.',
    model: 'Entries are sorted by the first column, then the second within ties, and so on. A predicate narrows the scan only while the columns to its left are fixed by <b>equality</b>. Everything after the first range column is just a filter on the scanned entries.',
    hook: '“The index has both columns, so why does it read 40,000 entries to return 12 rows?” Because the range column comes first.',
    facts: [
      { v: '3–4 levels', l: 'is enough for hundreds of millions of rows: each internal page holds hundreds of downlinks' },
      { v: 'PG13', l: 'B-tree deduplication: repeated keys stored once with a list of TIDs. Low-cardinality indexes shrink 2–3×' },
      { v: 'PG18', l: 'skip scan: an index can be used even when the leading column has no condition, by probing each distinct leading value' }
    ]
  },
  intro: {
    what: 'An index is a separate, <b>sorted</b> copy of one or more columns, with a pointer to each row. Because it is sorted, Postgres can find a value by jumping around instead of reading every row, like looking up a word in a dictionary.',
    analogy: { icon: '📚', title: 'A library’s signposts', text: 'The entrance sign says “A–F left, G–P middle, Q–Z right”. In the aisle a shelf label says “Ga–Gl”. On the shelf the books are in order, and the shelves are connected end to end, so to grab every book from “Go” to “Ha” you walk along the shelves without going back to the entrance.' },
    steps: [
      { t: 'Create one', d: 'Postgres builds a B-tree by default.', code: 'CREATE INDEX ON orders (customer_id);' },
      { t: 'Point lookup', d: 'Root → internal → leaf: 3–4 page reads, then one heap read for the row.', code: 'SELECT * FROM orders\nWHERE customer_id = 42;' },
      { t: 'Range scan', d: 'Find the start, then walk the linked leaf pages in order.', code: 'WHERE created_at >= now() - interval \'1 day\'' },
      { t: 'Several columns', d: 'Sorted by the first column, then the second. Put equality columns first, the range column last.', code: 'CREATE INDEX ON orders\n  (tenant_id, created_at);' }
    ],
    terms: [
      ['root / internal / leaf page', 'Top signpost page / middle signpost pages / bottom pages holding every key with its row pointer.'],
      ['TID', 'The heap address (block, slot) a leaf entry points to; same thing as a row’s ctid.'],
      ['leftmost prefix', 'The leading columns of a composite index that a query constrains with equality.'],
      ['index-only scan', 'Answering a query from the index alone, without reading the table, when all needed columns are in the index and the page is all-visible.'],
      ['INCLUDE', 'Extra payload columns stored in leaf entries only (PG11+), not part of the sort key.']
    ]
  },
  visual: {
    title: 'Walk the tree',
    caption: 'Pick a query. Highlighted pages are the ones read. Green keys matched, grey keys were examined and rejected. The composite modes use an index on <code>(tenant, day)</code> or the wrong order <code>(day, tenant)</code>.'
  },
  playground: {
    setup: `
CREATE TABLE orders (id int PRIMARY KEY, tenant_id int NOT NULL, status text NOT NULL,
                     created_at timestamptz NOT NULL, total numeric);
INSERT INTO orders
SELECT g, g % 50, (ARRAY['new','paid','shipped','void'])[1 + g % 4],
       timestamptz '2026-01-01' + g * interval '5 minutes', (g % 1000)
FROM generate_series(1, 20000) g;
CREATE INDEX o_t_s_c ON orders (tenant_id, status, created_at);
CREATE INDEX o_cov   ON orders (tenant_id, created_at) INCLUDE (total);
ANALYZE orders;`,
    presets: [
      { label: 'Leftmost prefix', sql: `EXPLAIN (COSTS OFF) SELECT id FROM orders
WHERE tenant_id = 7 AND status = 'paid' AND created_at >= '2026-03-01';
EXPLAIN (COSTS OFF) SELECT id FROM orders
WHERE created_at >= '2026-03-01' AND created_at < '2026-03-02';`, note: 'All three columns bound the first scan. The second query has no condition on the leading columns: before PG18 that meant a seq scan; PG18 may still use the index by skip-scanning each (tenant, status) prefix. Add ANALYZE to see <i>Index Searches</i>.' },
      { label: 'Skip scan (PG18)', sql: `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT id FROM orders WHERE status = 'paid' AND created_at >= '2026-02-15';`, note: 'No condition on the leading <code>tenant_id</code>, yet the index is used: <b>Index Searches: ~50</b>, one descent per tenant. Before PG18 this needed a full index scan or a seq scan.' },
      { label: 'VACUUM first', sql: `VACUUM orders;`, note: 'VACUUM can’t run inside a multi-statement batch, so it has its own preset. It sets the visibility-map bits that index-only scans need.' },
      { label: 'Index-only + heap fetches', sql: `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT created_at, total FROM orders
WHERE tenant_id = 3 AND created_at < '2026-02-01';`, note: 'Run after the VACUUM preset: <b>Heap Fetches: 0</b>. Then run the next preset and come back: heap fetches jump, because updated pages are no longer all-visible.' },
      { label: 'Dirty the pages', sql: `UPDATE orders SET total = total + 1 WHERE tenant_id = 3;
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT created_at, total FROM orders
WHERE tenant_id = 3 AND created_at < '2026-02-01';`, note: 'Still an “Index Only Scan”, but every entry needs a heap visit to check visibility. Same plan name, very different cost.' },
      { label: 'Dedup + DESC/NULLS', sql: `DROP INDEX IF EXISTS st_dedup, st_nodedup;
CREATE INDEX st_dedup   ON orders (status);
CREATE INDEX st_nodedup ON orders (status) WITH (deduplicate_items = off);
SELECT pg_size_pretty(pg_relation_size('st_dedup'))   AS dedup,
       pg_size_pretty(pg_relation_size('st_nodedup')) AS no_dedup;
EXPLAIN (COSTS OFF) SELECT id FROM orders WHERE tenant_id = 7 ORDER BY created_at DESC LIMIT 5;
EXPLAIN (COSTS OFF) SELECT id FROM orders WHERE tenant_id = 7 ORDER BY created_at DESC NULLS LAST LIMIT 5;`, note: 'Dedup: roughly a third of the size for 4 distinct values. DESC is a backward scan, but DESC <b>NULLS LAST</b> doesn’t match the index order (ASC NULLS LAST read backward is DESC NULLS FIRST), so it sorts.' }
    ]
  },
  gotchas: [
    { trap: 'Range column first', code: `CREATE INDEX ON events (created_at, tenant_id);\n-- WHERE tenant_id = 7 AND created_at > now() - '7 days'`, why: 'The scan covers every tenant’s entries for 7 days; <code>tenant_id</code> is checked per entry, not used to narrow the range.', fix: 'Equality columns first, range last: <code>(tenant_id, created_at)</code>.' },
    { trap: '“Index Only Scan” with huge Heap Fetches', why: 'The visibility map bit for the page is not set (recently modified, or never vacuumed), so each entry needs a heap visit.', fix: 'Make autovacuum run more often on append/update-heavy tables (PG13+ also triggers on inserts: <code>autovacuum_vacuum_insert_threshold</code>).' },
    { trap: 'Mixed sort directions', code: `ORDER BY tenant_id ASC, created_at DESC   -- index (tenant_id, created_at)`, why: 'An index can be read forward or backward, which flips all columns at once. A mixed order needs a sort (PG13+ can do an Incremental Sort).', fix: 'Create the index with matching directions: <code>(tenant_id, created_at DESC)</code>.' },
    { trap: 'NULLS FIRST/LAST mismatch', why: 'Default is ASC NULLS LAST, whose backward scan is DESC NULLS FIRST. <code>ORDER BY x DESC NULLS LAST</code> doesn’t match either direction.', fix: 'Index <code>(x DESC NULLS LAST)</code>, or declare the column NOT NULL and drop the NULLS clause.' },
    { trap: 'Random UUID keys', why: 'v4 UUIDs insert at random leaf positions: page splits everywhere, a 50–70% fill factor, and poor cache locality. Sequential keys split only the rightmost page.', fix: 'Use bigint identity or time-ordered UUIDs (UUIDv7; <code>uuidv7()</code> built in since PG18).' },
    { trap: 'Too many overlapping indexes', why: '<code>(a)</code>, <code>(a, b)</code> and <code>(a, b, c)</code>: each write maintains all three and blocks HOT updates on those columns.', fix: 'Keep the widest that serves the queries; check <code>pg_stat_user_indexes.idx_scan = 0</code> before dropping others.' }
  ],
  scenarios: [
    { title: 'Tenant dashboard: 2 s for 20 rows',
      symptom: 'A multi-tenant SaaS query <code>WHERE tenant_id = $1 AND created_at &gt; now() - interval \'30 days\' ORDER BY created_at DESC LIMIT 20</code> is slow for small tenants.',
      diagnose: `EXPLAIN (ANALYZE, BUFFERS) …;\n-- Index Scan Backward using events_created_tenant\n--   Filter: (tenant_id = 42)  Rows Removed by Filter: 412807`,
      cause: 'The index is <code>(created_at, tenant_id)</code>. The scan walks all tenants’ recent entries newest-first and filters, until it finds 20 for tenant 42.',
      fix: 'Index <code>(tenant_id, created_at)</code>: one descent to tenant 42’s newest entry, read 20, stop.',
      fixCode: `CREATE INDEX CONCURRENTLY events_tenant_created\n  ON events (tenant_id, created_at);\nDROP INDEX CONCURRENTLY events_created_tenant;` },
    { title: 'Insert throughput halves after switching ids to UUID',
      symptom: 'After moving primary keys from bigint to <code>gen_random_uuid()</code>, WAL volume doubles and the PK index is 2× the expected size.',
      diagnose: `SELECT pg_size_pretty(pg_relation_size('orders_pkey'));\nSELECT * FROM pg_stat_wal;   -- wal_fpi (full-page images) up`,
      cause: 'Random keys touch random leaf pages: constant page splits, half-empty pages, and the first touch of each page after a checkpoint writes a full-page image.',
      fix: 'Use time-ordered keys (UUIDv7 / ULID, or bigint). Inserts then go to the rightmost leaf, which Postgres optimizes (fastpath).' },
    { title: 'Index-only scan regresses every afternoon',
      symptom: 'A covering-index report is 30 ms in the morning and 4 s by 3 p.m.',
      diagnose: `EXPLAIN (ANALYZE) …   -- Heap Fetches: 2,800,000\nSELECT last_autovacuum, n_ins_since_vacuum FROM pg_stat_user_tables WHERE relname = 'events';`,
      cause: 'All-day inserts and updates clear visibility-map bits; autovacuum only runs at night. The planner still picks index-only, but every row needs a heap visit.',
      fix: 'Per-table autovacuum tuning so the VM stays fresh.',
      fixCode: `ALTER TABLE events SET (\n  autovacuum_vacuum_insert_scale_factor = 0.01,\n  autovacuum_vacuum_scale_factor = 0.02);` }
  ],
  puzzles: [
    { kind: 'concept', q: 'Index on (tenant_id, status, created_at). Which predicate set narrows the scan with ALL three columns?', options: ['tenant_id = 7 AND created_at &gt; X', 'tenant_id = 7 AND status = \'paid\' AND created_at &gt; X', 'status = \'paid\' AND created_at &gt; X', 'tenant_id &gt; 7 AND status = \'paid\''], answer: 1, explain: 'Each column narrows the range only while every column to its left has an equality. In A, created_at is checked within tenant 7 (status skipped). In D, the range on tenant_id ends the narrowing.' },
    { kind: 'concept', q: 'You ran <code>VACUUM orders</code>, then <code>UPDATE orders SET total = total + 1 WHERE tenant_id = 3</code>. Now <code>SELECT created_at, total … WHERE tenant_id = 3</code> uses the covering index o_cov. What does EXPLAIN ANALYZE show? (Try it with the presets.)', options: ['Seq Scan', 'Index Only Scan, Heap Fetches 0', 'Index Only Scan, Heap Fetches &gt; 0', 'Error'], answer: 2, explain: 'Still an Index Only Scan (total is INCLUDEd), but the updated pages lost their all-visible bit, so every entry is checked against the heap.' },
    { kind: 'predict', q: 'Does this use a backward index scan or a sort?', code: `EXPLAIN (COSTS OFF)\nSELECT id FROM orders WHERE tenant_id = 7\nORDER BY created_at DESC NULLS LAST LIMIT 5;`, options: ['Index Scan Backward, no sort', 'Sort on top of an index scan', 'Seq Scan + Sort only', 'Error'], answer: 1, explain: 'The index provides DESC NULLS FIRST when read backward. NULLS LAST doesn’t match, so a <b>Sort</b> appears (here over a bitmap scan on tenant 7).' },
    { kind: 'predict', q: 'Ratio of index sizes with and without deduplication on a 4-value status column (20k rows)?', code: `CREATE INDEX a ON orders (status);\nCREATE INDEX b ON orders (status) WITH (deduplicate_items = off);\nSELECT pg_relation_size('b') / pg_relation_size('a') AS ratio;`, options: ['1', '~3', '~10', '~50'], answer: 1, explain: 'About <b>3×</b>: each distinct key is stored once per posting list with many TIDs (6 bytes each) instead of a full index tuple per row.' },
    { kind: 'concept', q: 'What does INCLUDE (total) change compared with (tenant_id, created_at, total)?', options: ['Nothing', 'total is in leaf pages only and not part of the sort/uniqueness', 'total becomes searchable', 'The index becomes a hash index'], answer: 1, explain: 'INCLUDE columns are payload: they enable index-only scans, are not in internal pages, can’t be used in Index Cond, and don’t count toward UNIQUE.' },
    { kind: 'concept', q: 'Why does a range scan never need to go back up to the root to move to the next leaf?', options: ['Leaves are contiguous on disk', 'Each leaf has a right-sibling link', 'The planner preloads all leaves', 'Internal pages are cached'], answer: 1, explain: 'Lehman–Yao B-link trees: every page links to its right sibling (and has a high key), so scans walk sideways and tolerate concurrent splits.' }
  ],
  interview: [
    { q: 'Walk through a B-tree lookup in Postgres.', a: '<p>Read the metapage to find the root; binary-search the root’s keys for the downlink; repeat in internal pages; in the leaf, binary-search for the first matching entry. For each match, read the heap tuple at its TID (unless index-only and the page is all-visible). Range scans continue along right-sibling links until the high key or an entry exceeds the bound.</p>', lvl: 'core' },
    { q: 'Explain the leftmost-prefix rule precisely.', a: '<p>Index conditions on leading columns with <code>=</code> (or IN) narrow the scan. The first column with a range condition still narrows it (start/stop), but columns after it can only be checked as filters within the scanned range. Columns with no condition before a constrained one stop narrowing, except PG18 skip scan, which probes each distinct value of the unconstrained leading column(s); good when they have few distinct values.</p>', fu: 'How do you order (status, tenant_id, created_at)? (Equality columns first, most selective usually first unless another query needs a different prefix; range last.)', lvl: 'deep' },
    { q: 'What makes an index-only scan actually index-only?', a: '<p>All referenced columns must be in the index (key or INCLUDE), and the heap page must be marked all-visible in the visibility map; otherwise Postgres fetches the heap tuple to check visibility. EXPLAIN ANALYZE’s <code>Heap Fetches</code> shows how often that happened.</p>', lvl: 'core' },
    { q: 'What happens on a page split?', a: '<p>When a leaf is full, Postgres first tries to delete dead entries (simple deletion; PG14+ bottom-up deletion for version churn) and deduplicate (PG13+). If still full, it splits: allocates a new right page, moves about half the entries (or most, for rightmost inserts), sets sibling links and the high key, then inserts a downlink in the parent, which may split recursively. A root split adds a level.</p>', lvl: 'deep' },
    { q: 'What is B-tree deduplication?', a: '<p>PG13+: duplicate keys are merged into a posting-list tuple (key + sorted TID array), applied lazily when a page would otherwise split. It shrinks low-cardinality and MVCC-version-heavy indexes. Unique indexes use it too, for MVCC version duplicates. It is not available for INCLUDE indexes or for some types (numeric, jsonb, float, nondeterministic collations).</p>', lvl: 'deep' },
    { q: 'Why can an index on (a, b) serve ORDER BY a DESC, b DESC but not a DESC, b ASC?', a: '<p>A backward scan reverses all columns. Mixed directions need an index declared <code>(a DESC, b ASC)</code> (or the reverse), or a sort step. PG13+ incremental sort reduces the cost when the prefix is already sorted.</p>', lvl: 'core' },
    { q: 'B-tree fillfactor: when change it?', a: '<p>Default 90 for B-trees. Monotonic inserts (identity, timestamps) can use 100, since only the rightmost page gets inserts. Random inserts or updates of indexed values benefit from lower (70–80) to delay splits.</p>', lvl: 'deep' },
    { q: 'How do you find unused or duplicate indexes?', a: '<p><code>pg_stat_user_indexes.idx_scan</code> (check all replicas, and since the last stats reset), and compare <code>indkey</code> prefixes in <code>pg_index</code> for redundancy. Keep indexes that back constraints. Drop with <code>DROP INDEX CONCURRENTLY</code>.</p>', lvl: 'core' },
    { q: 'Why can an index bloat even without deletes?', a: '<p>Every non-HOT update adds a new index entry; the old one stays until vacuum. Random-key splits leave half-full pages. VACUUM recycles empty pages but never merges half-full ones. <code>REINDEX CONCURRENTLY</code> (PG12+) rebuilds online.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'JPA: declare the composite index in the right order', lang: 'java', code: `@Entity
@Table(name = "events", indexes = {
  // equality column first, range/sort column last
  @Index(name = "events_tenant_created", columnList = "tenant_id, created_at DESC")
})
class Event {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
  @Column(name = "tenant_id") long tenantId;
  @Column(name = "created_at") Instant createdAt;
}

// served by one descent + LIMIT
List<Event> findTop20ByTenantIdOrderByCreatedAtDesc(long tenantId);`, note: 'Hibernate only creates <code>@Index</code> with schema generation. In production, create indexes in Flyway/Liquibase migrations with <code>CONCURRENTLY</code> (outside a transaction).' }
  ]
});

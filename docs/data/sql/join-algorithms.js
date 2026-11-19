IA.register({
  track: 'sql',
  slug: 'join-algorithms',
  title: 'Join algorithms',
  tagline: 'Postgres can execute a join in three ways: <b>nested loop</b>, <b>hash join</b> and <b>merge join</b>. The SQL is the same; the cost differs by orders of magnitude. The planner picks one from its row estimates, so a wrong estimate gives you the wrong algorithm.',
  tldr: {
    problem: 'A join that took 30 ms takes 30 minutes after the data grew, and the query text never changed. The planner switched algorithm, or kept one that no longer fits.',
    model: '<b>Nested loop</b>: for each outer row, look up matches (ideally via an index). <b>Hash</b>: build a hash table on one side, probe it with the other. <b>Merge</b>: walk two sorted inputs side by side, like a zipper.',
    hook: 'Nested loop is perfect for 10 outer rows and a disaster for 10 million. Hash join is the opposite. The row estimate decides which you get.',
    facts: [
      { v: 'O(N·log M)', l: 'nested loop with an index on the inner side. Without an index it is O(N·M)' },
      { v: 'work_mem × 2', l: 'memory for a hash table: <code>work_mem × hash_mem_multiplier</code> (default 2.0 since PG15). Beyond it, the join splits into batches on disk' },
      { v: 'PG14', l: '<b>Memoize</b> caches inner-side results of a nested loop, so repeated outer keys skip the index probe' }
    ]
  },
  intro: {
    what: 'A join query says <i>what</i> to match (e.g. orders with their customers), not <i>how</i>. Postgres has three algorithms to do the matching. They give the same answer, but their speed depends on how many rows each side has, whether there are indexes, and whether the data is already sorted.',
    analogy: { icon: '📚', title: 'Matching returned books to borrower cards', text: '<b>Nested loop</b>: for each book, look the borrower up in an alphabetical card index. Great for 5 books. <b>Hash</b>: first sort all cards into 26 boxes by the first letter, then drop each book into the right box. Great for 5,000 books. <b>Merge</b>: if both the books and the cards are already alphabetical, walk both piles together and match as you go.' },
    steps: [
      { t: 'Nested loop', d: 'For every row on the outer side, find matching rows on the inner side. With an index on the inner join column, each lookup is a fast B-tree search.', code: 'for o in orders:\n  for c in customers_index.lookup(o.customer_id):\n    emit(o, c)' },
      { t: 'Hash join', d: 'Read the smaller side completely into a hash table keyed by the join column (build). Then stream the bigger side and look each row up in the table (probe).' },
      { t: 'Merge join', d: 'Sort both sides by the join key (or read them in order from an index). Then advance two pointers, emitting a row whenever the keys are equal.' },
      { t: 'See which one ran', d: 'EXPLAIN shows the chosen algorithm as the join node.', code: 'EXPLAIN SELECT *\nFROM orders o JOIN customers c ON c.id = o.customer_id;\n-- Hash Join / Nested Loop / Merge Join' }
    ],
    terms: [
      ['outer / inner', 'In a nested loop, the outer side drives the loop; the inner side is searched once per outer row.'],
      ['build / probe', 'In a hash join, the build side goes into the hash table; the probe side looks rows up in it.'],
      ['work_mem', 'Memory each sort or hash operation may use before spilling to temporary files on disk.'],
      ['batch', 'When a hash table does not fit in memory, both inputs are split into batches written to disk, and joined one batch at a time.'],
      ['equi-join', 'A join on equality (<code>a.x = b.y</code>). Hash and merge joins require it; nested loop handles any condition.']
    ]
  },
  visual: {
    title: 'Watch all three algorithms',
    caption: 'Join 6 orders to 5 customers on <code>customer_id</code>. Pick an algorithm and its option, then press Play. The counters show how much work each algorithm does. Order 105 points to customer 7, which does not exist.'
  },
  extras: [
    { id: 'join-algorithms-cost', title: 'Cost intuition: which algorithm wins?', label: 'Calculator', caption: 'Drag the row counts and toggle the indexes. The bars use a <b>simplified</b> cost model (not the planner’s real formulas) to show the shape of the trade-off: nested loop wins on a small outer side, hash on two large unsorted inputs, merge when both are already sorted, and Memoize when the outer side repeats a few keys.' }
  ],
  playground: {
    setup: `
CREATE TABLE customers (id int PRIMARY KEY, name text NOT NULL, tier text NOT NULL);
CREATE TABLE orders (id bigint PRIMARY KEY, customer_id int NOT NULL, amount numeric(10,2) NOT NULL);
CREATE TABLE payments (id bigint PRIMARY KEY, order_id bigint NOT NULL, method text NOT NULL);
INSERT INTO customers SELECT g, 'cust ' || g, (ARRAY['free','pro','ent'])[1 + g % 3] FROM generate_series(1, 2000) g;
INSERT INTO orders SELECT g, 1 + (g * 7919) % 2000, (g % 500) + 0.99 FROM generate_series(1, 50000) g;
INSERT INTO payments SELECT g, 1 + (g * 31) % 50000, (ARRAY['card','sepa','paypal'])[1 + g % 3] FROM generate_series(1, 50000) g;
CREATE INDEX orders_customer_idx ON orders (customer_id);
ANALYZE;`,
    presets: [
      { label: 'Hash join', sql: `EXPLAIN (ANALYZE, COSTS OFF)\nSELECT c.name, o.amount\nFROM orders o JOIN customers c ON c.id = o.customer_id;`, note: 'Two full inputs, no selective filter: hash the 2,000 customers (Batches: 1), then stream 50,000 orders through it.' },
      { label: 'Nested loop', sql: `EXPLAIN (ANALYZE, COSTS OFF)\nSELECT c.name, o.amount\nFROM customers c JOIN orders o ON o.customer_id = c.id\nWHERE c.id = 42;`, note: 'One outer row, so one index lookup on the inner side is cheapest.' },
      { label: 'Merge join', sql: `EXPLAIN (ANALYZE, COSTS OFF)\nSELECT c.id, o.id\nFROM customers c JOIN orders o ON o.customer_id = c.id\nORDER BY c.id;`, note: 'ORDER BY on the join key makes sorted input valuable: both sides come in order from indexes and the result is already sorted.' },
      { label: 'Hash spills', sql: `SET work_mem = '64kB';\nEXPLAIN (ANALYZE, COSTS OFF)\nSELECT p.method, sum(o.amount)\nFROM payments p JOIN orders o ON o.id = p.order_id\nGROUP BY 1;\nRESET work_mem;`, note: 'Find <code>Batches: 16</code> and <code>temp read/written</code>. Run it again without the SET: Batches: 1.' },
      { label: 'Memoize', sql: `-- PG14+: force a nested loop to show the cache\nSET enable_hashjoin = off; SET enable_mergejoin = off;\nEXPLAIN (ANALYZE, COSTS OFF)\nSELECT c.name, o.amount\nFROM orders o JOIN customers c ON c.id = o.customer_id\nWHERE o.id <= 20000;\nRESET enable_hashjoin; RESET enable_mergejoin;`, note: '20,000 outer rows but only 2,000 distinct customer ids: <code>Hits: 18000  Misses: 2000</code>. The index is probed 2,000 times instead of 20,000.' },
      { label: 'Non-equi join', sql: `-- only a nested loop can do a range condition\nEXPLAIN (COSTS OFF)\nSELECT count(*)\nFROM customers a JOIN customers b ON b.id BETWEEN a.id AND a.id + 2;`, note: 'No equality, so hash and merge are impossible. The inner side is a parameterized index scan.' }
    ]
  },
  gotchas: [
    { trap: 'Nested loop chosen on a 1-row estimate', code: `Nested Loop (rows=1) (actual rows=1800000)\n  -> Seq Scan on events (rows=1) (actual rows=1800000)\n  -> Index Scan on users (loops=1800000)`, why: 'The planner believed the outer side had 1 row. Nested loop is then the cheapest plan. With 1.8 M rows it does 1.8 M random index probes.', fix: 'Fix the estimate: ANALYZE, extended statistics, or rewrite the predicate. Disabling nested loops globally hurts every short OLTP query.' },
    { trap: 'Hash join quietly spilling', why: 'When the build side exceeds <code>work_mem × hash_mem_multiplier</code>, Postgres splits both inputs into batches on disk. EXPLAIN shows <code>Batches: 16</code> and temp buffers. Disk I/O makes it several times slower.', fix: 'Raise <code>work_mem</code> for that session or transaction only (<code>SET LOCAL</code>), or reduce the build side (fewer columns, filter first).' },
    { trap: 'Raising work_mem globally', why: 'work_mem applies to <i>each</i> sort or hash node in <i>each</i> backend, and parallel workers each get their own. 200 connections × 4 hash nodes × 256 MB can exhaust RAM and trigger the OOM killer.', fix: 'Keep the global value modest. Raise it per role (<code>ALTER ROLE reporting SET work_mem = …</code>) or per transaction.' },
    { trap: 'Hash join on a skewed key', why: 'If one key value is very common (e.g. <code>tenant_id</code> of your biggest customer), all its rows land in one bucket and one batch. That batch cannot be split further and can blow past work_mem.', fix: 'Check the most-common values in <code>pg_stats</code>. Postgres tries to handle MCVs with a special “skew” optimization, but very skewed data may still need a query rewrite.' },
    { trap: 'Merge join needs sorted input', why: 'If there is no index providing the order, both sides must be sorted first. Two big Sorts can cost more than one hash build.', fix: 'Merge join pays off when the input order comes for free from an index, or when the result must be sorted by the join key anyway.' },
    { trap: 'Using enable_* in production', code: `SET enable_nestloop = off;  -- in application.properties … forever`, why: 'These settings are meant for experiments. They don’t forbid a method; they make it look extremely expensive (PG18 EXPLAIN shows <code>Disabled: true</code>). Every query on that connection is affected.', fix: 'Use them in a session to test a hypothesis, then fix the estimate or the schema. If you must, scope it with <code>SET LOCAL</code> in one transaction.' }
  ],
  scenarios: [
    { title: 'Batch job: 4 minutes became 6 hours after a data migration',
      symptom: 'A nightly job joins a freshly populated <code>import_rows</code> table to <code>products</code>. After a migration doubled the import size, it never finishes.',
      diagnose: `EXPLAIN SELECT … FROM import_rows i JOIN products p ON p.sku = i.sku;\n--  Nested Loop  (rows=1)\n--    -> Seq Scan on import_rows i  (rows=1)     -- really 3.2 M\n--    -> Index Scan using products_sku_idx (loops=3.2 M)`,
      cause: 'The job truncates and reloads <code>import_rows</code> and queries it immediately. Autovacuum had not analyzed it, so the planner estimated 1 row and chose a nested loop.',
      fix: 'ANALYZE right after the load. The planner then chooses a hash join on products, which finishes in minutes.',
      fixCode: `TRUNCATE import_rows;\nCOPY import_rows FROM …;\nANALYZE import_rows;` },
    { title: 'Reporting replica runs out of memory',
      symptom: 'The OOM killer restarts Postgres on the reporting replica during month-end close.',
      diagnose: `SHOW work_mem;             -- 512MB (someone raised it for “faster reports”)\nSHOW hash_mem_multiplier;  -- 2\nSELECT count(*) FROM pg_stat_activity WHERE state = 'active';  -- 60`,
      cause: 'Each hash node could use up to 1 GB. 60 active reports, several hash nodes each, plus parallel workers that each get their own allowance: far more than the machine’s RAM.',
      fix: 'Set a modest global work_mem (e.g. 32 MB). Raise it per role for the few heavy reports, and limit concurrency with a separate connection pool.',
      fixCode: `ALTER SYSTEM SET work_mem = '32MB';\nALTER ROLE monthly_close SET work_mem = '256MB';\nSELECT pg_reload_conf();` },
    { title: 'Hot endpoint regresses after an upgrade to PG14',
      symptom: 'An endpoint got faster for most users, but one tenant’s request got slower. Its plan now shows a Memoize node with high evictions.',
      diagnose: `EXPLAIN (ANALYZE) …\n--  Memoize (actual rows=1 loops=900000)\n--    Hits: 1200  Misses: 898800  Evictions: 880000`,
      cause: 'The planner expected many repeated keys (estimated n_distinct too low), so it added a cache. In reality almost every key was unique, so the cache only added overhead.',
      fix: 'Fix the n_distinct estimate (<code>ALTER TABLE … ALTER COLUMN … SET (n_distinct = …)</code>, then ANALYZE). As a temporary workaround, turn off <code>enable_memoize</code> for that one query’s transaction.',
      fixCode: `ALTER TABLE events ALTER COLUMN device_id SET (n_distinct = -0.9);\nANALYZE events;` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Which join node does Postgres use here (one customer, an index on orders.customer_id)?', code: `EXPLAIN (COSTS OFF)\nSELECT c.name, o.amount FROM customers c\nJOIN orders o ON o.customer_id = c.id WHERE c.id = 42;`, options: ['Hash Join', 'Merge Join', 'Nested Loop', 'No join node'], answer: 2, explain: 'One outer row needs one index lookup. A <b>Nested Loop</b> is by far the cheapest.' },
    { kind: 'predict', q: 'With work_mem = 64kB, how many batches does the hash join on 50,000 orders use?', code: `SET work_mem = '64kB';\nEXPLAIN (ANALYZE, COSTS OFF, TIMING OFF)\nSELECT p.method, sum(o.amount)\nFROM payments p JOIN orders o ON o.id = p.order_id GROUP BY 1;`, options: ['1', '2', '16', '50000'], answer: 2, explain: 'The 50,000-row hash table needs about 2 MB but only 128 kB is allowed (64 kB × hash_mem_multiplier 2). Batches are a power of two: <b>16</b>, written to temp files.' },
    { kind: 'concept', q: 'Which algorithm can execute <code>ON b.ts BETWEEN a.start AND a.end</code>?', options: ['Hash join only', 'Merge join only', 'Nested loop only', 'Any of the three'], answer: 2, explain: 'Hash join needs equality to hash on; merge join needs a mergeable equality. A range condition leaves only the <b>nested loop</b>, ideally with an index on <code>b.ts</code>.' },
    { kind: 'predict', q: 'PG18: what does the plan for this self-join on the primary key contain?', code: `EXPLAIN (COSTS OFF)\nSELECT count(*) FROM orders o JOIN orders p ON p.id = o.id;`, options: ['Hash Join', 'Merge Join', 'Nested Loop with Memoize', 'No join at all'], answer: 3, explain: 'PG18 added <b>self-join elimination</b>: joining a table to itself on its unique key is redundant, so the planner removes the join and scans <code>orders</code> once. In PG17 and earlier you would see a real join.' },
    { kind: 'predict', q: 'In the Memoize preset (20,000 orders, 2,000 distinct customers), how many cache misses are reported?', code: `SET enable_hashjoin = off; SET enable_mergejoin = off;\nEXPLAIN (ANALYZE, COSTS OFF, TIMING OFF)\nSELECT c.name, o.amount FROM orders o\nJOIN customers c ON c.id = o.customer_id WHERE o.id <= 20000;`, options: ['0', '2,000', '18,000', '20,000'], answer: 1, explain: 'Each distinct key misses once and then stays cached: <b>2,000 misses</b> and 18,000 hits. The inner index scan shows loops=2000, not 20000.' },
    { kind: 'concept', q: 'Why does a hash join usually build on the <i>smaller</i> input?', options: ['Smaller inputs sort faster', 'The hash table must fit in memory; the bigger side is only streamed', 'Postgres requires the build side to have a unique key', 'Probing is more expensive than building'], answer: 1, explain: 'Only the build side is held in memory. Building on the small side keeps the hash table in work_mem (one batch); the big side streams through once.' }
  ],
  interview: [
    { q: 'Compare nested loop, hash and merge join. When does each win?', a: '<ul><li><b>Nested loop</b>: small outer side and an index on the inner join key; also the only option for non-equality conditions. Low startup cost, so good with LIMIT.</li><li><b>Hash</b>: large, unsorted inputs with an equality condition; needs memory for the build side.</li><li><b>Merge</b>: both inputs already sorted (indexes), or the output must be sorted by the key anyway; very large inputs where a hash would spill.</li></ul>', lvl: 'core' },
    { q: 'What happens when a hash join’s build side does not fit in memory?', a: '<p>Postgres splits the work into <b>batches</b> (a power of two). Rows of both inputs are routed to a batch by bits of their hash. Batch 0 is processed in memory; the others are written to temp files and joined one by one afterwards. If a batch turns out to be too big at run time, Postgres doubles the number of batches during execution. Hash memory is <code>work_mem × hash_mem_multiplier</code>.</p>', fu: 'How does skew make this worse? (All rows with one hot key go to the same batch, which cannot be split.)', lvl: 'deep' },
    { q: 'What is Memoize, and when is it useful?', a: '<p>PG14+. A cache between a nested loop and its parameterized inner side, keyed by the outer join value. If the outer side has many duplicate keys, repeated lookups are answered from memory. It is chosen from the n_distinct estimate, so a wrong estimate can add a useless cache (watch <code>Evictions</code> and the hit ratio). Disable with <code>enable_memoize</code>.</p>', lvl: 'core' },
    { q: 'How does a merge join handle duplicate keys on both sides?', a: '<p>It uses <b>mark and restore</b> on the inner input: when it meets a run of equal keys, it marks the first inner row, and for every outer row with the same key it rewinds to the mark. The inner node must support mark/restore (index scans and Sort do); otherwise a Materialize node is added.</p>', lvl: 'deep' },
    { q: 'Why would the planner choose a nested loop for a huge join?', a: '<p>Because it believed the outer side was tiny. The usual causes are stale stats, correlated predicates, functions on columns, or a join estimate multiplied through several levels. The join algorithm is a <i>consequence</i> of the estimate; fixing the estimate is the real fix.</p>', lvl: 'core' },
    { q: 'What are the hash join variants you may see in EXPLAIN?', a: '<p>Hash Join, Hash Left/Right Join, Hash Full Join, Hash Semi Join (EXISTS), Hash Anti Join (NOT EXISTS), and Hash Right Semi/Anti Join (PG16+ added Right Anti; PG18 Right Semi), where the planner hashes the side you wrote first. <b>Parallel Hash</b> (PG11+) builds one shared hash table that all workers fill and probe.</p>', lvl: 'deep' },
    { q: 'How do you test whether a different join algorithm would be faster?', a: '<p>In one session: <code>SET enable_hashjoin = off</code> (or nestloop / mergejoin), then EXPLAIN ANALYZE again and compare actual times. Then reset it. Use the result to understand <i>why</i> the planner misjudged; don’t ship the setting.</p>', lvl: 'core' },
    { q: 'How do join_collapse_limit and the number of tables affect join planning?', a: '<p>The planner searches join orders exhaustively up to <code>join_collapse_limit</code> / <code>from_collapse_limit</code> (8). Above that, explicit JOINs are kept in written order. From <code>geqo_threshold</code> (12) tables, the genetic optimizer searches heuristically, so plans for very wide joins can vary between runs.</p>', lvl: 'deep' },
    { q: 'How does Hibernate’s N+1 problem relate to join algorithms?', a: '<p>N+1 is a nested loop executed in the <i>application</i>: one query for the parents, then one query per parent over the network. Each lookup pays a round trip, not just an index probe. A fetch join or <code>@BatchSize</code> lets Postgres pick a hash or merge join, or at least batch the lookups with <code>IN (…)</code>.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Per-transaction work_mem for one heavy report (Spring + JdbcTemplate)', lang: 'java', code: `@Transactional(readOnly = true)
public List<Row> monthEndReport() {
  // SET LOCAL lasts until the transaction ends; it does not leak into the pool
  jdbc.execute("SET LOCAL work_mem = '256MB'");
  return jdbc.query(REPORT_SQL, rowMapper);
}`, note: 'A plain <code>SET</code> would stay on the pooled Hikari connection and affect the next borrower. <code>SET LOCAL</code> is scoped to the transaction.' },
    { title: 'Turning application-side N+1 into one database join', lang: 'java', code: `// N+1: 1 query for orders + 1 per order for its customer (a nested loop over the network)
List<Order> orders = orderRepo.findByStatus("OPEN");
orders.forEach(o -> o.getCustomer().getName());   // lazy load per row

// One query: Postgres can now pick a hash join
@Query("select o from Order o join fetch o.customer where o.status = :s")
List<Order> findOpenWithCustomer(@Param("s") String s);

// or keep lazy loading but batch the lookups: WHERE id IN (?, ?, … 50)
@Entity @BatchSize(size = 50)   // on the target entity for to-one associations
public class Customer { … }` }
  ]
});

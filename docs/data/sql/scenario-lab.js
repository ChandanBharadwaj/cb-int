IA.register({
  track: 'sql',
  slug: 'scenario-lab',
  title: 'Scenario lab: 12 real systems',
  tagline: 'Twelve systems an architect is asked about in interviews and design reviews. For each: <b>guess first</b>, then compare with the pick, the deciding numbers, the alternatives that lose, and <b>what breaks at 10×</b>.',
  tldr: {
    problem: 'Knowing what each database does is not the same as choosing one under constraints. Interviews test whether you can tie a choice to <i>numbers</i> and name its next failure.',
    model: 'Read the brief → extract the hard numbers (writes/s, size, regions, latency, consistency) → find the one requirement that forces a choice → pick the simplest store that meets it → name the rejected options and the 10× bottleneck.',
    hook: 'Half of the twelve end up on Postgres or a Postgres extension. The others are decided by one number: a write rate, a hop count, a region outage rule, or a scan size.',
    facts: [
      { v: '12', l: 'scenarios, from payments to RAG memory' },
      { v: '1', l: 'deciding requirement per scenario is the usual case; find it before naming products' },
      { v: '10×', l: 'growth question: what breaks first, and what would you change?' }
    ]
  },
  intro: {
    what: 'This page is practice. Each card describes a real kind of system with a few numbers. You choose which database you would use as the <b>main store</b>, then reveal how an experienced architect would choose and why. There is rarely one perfect answer; there is usually one <b>best-justified</b> answer.',
    analogy: { icon: '🩺', title: 'Like a doctor’s differential diagnosis', text: 'A doctor lists possible causes, then uses one or two test results to rule most of them out. An architect lists possible stores, then uses one or two numbers (write rate, number of regions, query shape) to rule most of them out.' },
    steps: [
      { t: 'Read the numbers', d: 'Writes per second, data size, number of regions, latency target, how strict consistency must be.' },
      { t: 'Find the dominant query', d: 'Lookup by key? Search with typos? Hops through a graph? Aggregates over billions of rows? Nearest vectors?' },
      { t: 'Start with Postgres', d: 'Ask: does any number or query break it? If not, Postgres (maybe with an extension) is the pick.' },
      { t: 'Name the next failure', d: 'Say what breaks at 10× and how you would respond. This is what separates a senior answer from a list of products.' }
    ],
    terms: [
      ['primary store', 'The source of truth for the data.'],
      ['secondary store', 'A derived copy (cache, search index, graph, warehouse), rebuilt from the primary.'],
      ['last-writer-wins (LWW)', 'Conflict rule in multi-region stores: the later timestamp wins and the other write is lost.'],
      ['hot partition / hotspot', 'One key or range receiving far more traffic than others.'],
      ['10× test', 'Asking what fails first if load or data grows tenfold.']
    ]
  },
  visual: {
    title: 'Guess, then reveal',
    caption: 'Pick a scenario card, read the brief, choose your guess, then press Play to reveal the pick, the reasoning, the rejected alternatives and what breaks at 10×. Green = the pick, amber = a defensible alternative.'
  },
  extras: [
    { id: 'scenario-lab-matrix', title: 'All twelve at a glance', label: 'Cheat sheet', caption: 'Answers are hidden until you show them. Sort by any column; filter by Postgres-based vs specialist primary.' }
  ],
  gotchas: [
    { trap: 'Naming products before requirements', why: 'Starting with “we’ll use Kafka, Cassandra and Elasticsearch” signals pattern-matching, not design.', fix: 'Restate the numbers and the dominant query first, then pick. Say “Postgres unless…” and finish the sentence.' },
    { trap: 'Ignoring the write rate vs read rate split', why: 'Read scale is cheap (replicas, caches). Write scale beyond one node is what forces sharding or a different store.', fix: 'Always separate reads/s and writes/s in your estimate.' },
    { trap: 'Treating “global” as one requirement', why: 'Global reads, global writes, and data residency lead to completely different designs.', fix: 'Ask which one it is. Most “global” apps need regional reads and a home region per user.' },
    { trap: 'Forgetting how the secondary store is fed', why: 'Adding Redis, Elasticsearch or a graph DB without saying how it stays in sync leaves the hardest part out.', fix: 'Say “fed by CDC from Postgres (or an outbox), idempotent consumers, rebuildable”.' },
    { trap: 'No 10× answer', why: 'Every design has a next bottleneck. Not naming it suggests the design was not stress-tested.', fix: 'For each pick, name the first limit (hot key, partition size, memory, scan cost) and the response.' }
  ],
  scenarios: [
    { title: 'Design review: “we chose Cassandra for the ledger”',
      symptom: 'A team proposes Cassandra for a payments ledger “because it scales”. Expected volume: 800 transfers/s.',
      cause: 'Transfers need multi-row atomicity and invariants (no negative balance). Cassandra’s lightweight transactions are per-partition and expensive; cross-account invariants would be pushed into application code.',
      fix: 'Postgres with a double-entry, append-only ledger. Document the exit criteria (sustained write rate, multi-region writes) that would justify revisiting.' },
    { title: 'Incident: leaderboard rank page times out at peak',
      symptom: '“Your rank” runs <code>SELECT count(*) FROM scores WHERE score &gt; $1</code> on every page view; p99 is 4 s in the evening.',
      cause: 'Rank for an arbitrary player is a count over millions of rows per request. Indexes help but the work still grows with the number of better players.',
      fix: 'Keep scores in Postgres, mirror them into a Redis sorted set (<code>ZADD</code>, <code>ZREVRANK</code>), rebuild Redis from Postgres on loss.' },
    { title: 'Incident: RAG returns another tenant’s document',
      symptom: 'An assistant quoted a document the user should not see.',
      cause: 'Vectors lived in a separate vector store; permissions were copied there at ingest time and not updated when access was revoked.',
      fix: 'Move vectors to pgvector next to the ACL tables and filter in the same query, or sync permission changes via CDC with tests that check revocation.' }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which single number most often decides between Postgres and a partitioned NoSQL store?', options: ['Total number of tables', 'Sustained write rate (and whether writes must be accepted in several regions)', 'Number of developers', 'Average row size'], answer: 1, explain: 'Reads scale with replicas and caches. Writes beyond one primary, or in several regions at once, force partitioning or consensus.' },
    { kind: 'concept', q: 'A leaderboard needs “rank of any player” at 30k updates/s. Best design?', options: ['Postgres ORDER BY with OFFSET', 'Redis sorted set for ranking, Postgres for durable scores', 'Cassandra table ordered by score', 'Elasticsearch sort'], answer: 1, explain: 'Sorted sets give O(log N) rank and range queries in memory. Keep the truth in Postgres so Redis can be rebuilt.' },
    { kind: 'concept', q: 'For the fraud graph, why not recursive CTEs in Postgres?', options: ['Postgres has no recursion', '4-hop traversals over a billion edges explode intermediate results; a graph store follows adjacency directly', 'CTEs can’t use indexes', 'Graph DBs are always faster'], answer: 1, explain: 'Recursive CTEs are fine for shallow traversals. Deep, variable-length traversals over huge graphs are where graph DBs earn their place.' },
    { kind: 'concept', q: 'Global user profiles must keep accepting writes during a region outage, and rare conflicting edits may be resolved by last-writer-wins. Best fit?', options: ['Single-primary Postgres', 'DynamoDB global tables or Cassandra', 'Neo4j', 'A columnar warehouse'], answer: 1, explain: 'Multi-leader key-value stores accept local writes in each region and replicate asynchronously. LWW is acceptable here by assumption.' },
    { kind: 'concept', q: 'Multi-tenant SaaS with 8,000 tenants. Which isolation model scales best operationally?', options: ['Database per tenant', 'Schema per tenant', 'Shared schema with tenant_id + RLS (Citus later)', 'One Postgres cluster per tenant'], answer: 2, explain: 'Shared schema keeps one migration path and one connection pool. RLS adds a safety net; distribute by tenant_id when needed.' },
    { kind: 'concept', q: 'Audit log with 7-year retention and tamper evidence. Which design fits?', options: ['Elasticsearch index with ILM', 'Append-only partitioned Postgres table, UPDATE/DELETE revoked, old partitions exported to locked object storage', 'Redis streams', 'A mutable table with an updated_at column'], answer: 1, explain: 'Insert-only plus partitioning keeps recent data fast and archive cheap; object storage retention locks give compliance for the long tail.' }
  ],
  interview: [
    { q: 'Walk me through how you would answer “design the storage for a chat app”.', a: '<p>Clarify scale (DAU, messages/s, retention), read patterns (latest N per channel, search, unread counts), consistency (ordering per channel), and geography. At moderate scale: Postgres with <code>(channel_id, id DESC)</code> index and partitioning. At very high write rates: wide-column with partition <code>(channel_id, bucket)</code>, clustering by message id. Add search via CDC, Redis for presence/unread counts. Name the 10× risks: huge channels, tombstones, fan-out.</p>', lvl: 'core' },
    { q: 'How do you justify picking Postgres in an interview without sounding unambitious?', a: '<p>Tie it to numbers: “2k writes/s peak and 500 GB fit a single tuned primary with headroom; we need multi-row transactions and ad-hoc queries.” Then show you know the limits: “If writes pass ~X or we need multi-region writes, the plan is Citus/distributed SQL; search moves to Elasticsearch via CDC at Y QPS.” That shows judgment, not timidity.</p>', lvl: 'core' },
    { q: 'What is the 10× question and how do you answer it?', a: '<p>Multiply the key dimension (writes, data, tenants, QPS) by 10 and find the first component to saturate: a hot key, a partition size, memory for an index, scan cost, connection count. Then give the response: shard, bucket, cache, pre-aggregate, move to a specialist store, or change the requirement.</p>', lvl: 'core' },
    { q: 'When does a cache become a second store you must design carefully?', a: '<p>When it holds data not easily rebuilt (leaderboards, counters, sessions), or when stale reads have business impact. Then you need persistence settings, a rebuild path from the primary, invalidation rules, and capacity planning, just like a database.</p>', lvl: 'deep' },
    { q: 'IoT telemetry: TimescaleDB or ClickHouse?', a: '<p>TimescaleDB when you want Postgres (joins with device metadata, transactions, one operational stack) and operational queries on recent data, at up to roughly tens of thousands of rows/s per node with batching. ClickHouse when analytics over billions of rows dominates and you accept a separate system with different update semantics. Many teams use both: Timescale (or Postgres) for operations, ClickHouse for analytics, fed by Kafka.</p>', lvl: 'deep' },
    { q: 'Product search: why feed Elasticsearch via CDC instead of writing to it from the service?', a: '<p>Dual writes fail partially (one succeeds, the other doesn’t), with no atomicity. CDC reads committed changes from the database log in order, so the index converges to the truth; consumers upsert by id with a version to stay idempotent, and you can always reindex from the source.</p>', lvl: 'core' },
    { q: 'For RAG, what changes your mind from pgvector to a dedicated vector DB?', a: '<p>Measured limits: vector count and dimensions beyond what fits a node’s memory with acceptable build times; QPS beyond replicas; recall/latency targets not met with tuning; required features (e.g. built-in hybrid ranking, very large multi-tenant isolation). Against it: a second store, permission sync, and consistency on deletes.</p>', lvl: 'deep' },
    { q: 'Global profile store: DynamoDB global tables vs distributed SQL?', a: '<p>Global tables: local reads and writes in every region, asynchronous replication, LWW conflicts, very simple operations, key-based access only. Distributed SQL: strong consistency and SQL, but writes wait for a cross-region quorum unless data is homed regionally. Choose by whether a lost concurrent edit is acceptable and by the latency budget for writes.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Leaderboard: Postgres truth + Redis rank (Spring)', lang: 'java', code: `@Transactional
public void recordScore(long playerId, long matchId, int score) {
  matchRepo.save(new MatchResult(matchId, playerId, score));          // durable truth
  int best = scoreRepo.upsertBest(playerId, score);                    // INSERT ... ON CONFLICT DO UPDATE
  // after commit: update the derived ranking
  TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
    @Override public void afterCommit() {
      redis.opsForZSet().add("lb:season:42", String.valueOf(playerId), best);
    }
  });
}

public Long rankOf(long playerId) {             // 0-based rank, highest score first
  return redis.opsForZSet().reverseRank("lb:season:42", String.valueOf(playerId));
}`, note: 'If Redis loses data, rebuild the sorted set from the <code>best_score</code> table. For stronger guarantees, publish the update through an outbox instead of afterCommit.' }
  ]
});

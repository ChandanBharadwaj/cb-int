IA.register({
  track: 'sql',
  slug: 'db-decision-navigator',
  title: 'Decision navigator: which database?',
  tagline: 'Picking a database is a <b>search for forcing requirements</b>. Start with Postgres, then ask, one question at a time, <i>which requirement Postgres cannot meet</i>. If none does, you are done.',
  tldr: {
    problem: 'Teams pick stores by fashion or by the last outage they read about, then pay for years in sync jobs, double on-call and lost transactions.',
    model: 'Default to one relational primary. Add or switch stores only when a <b>named, measured requirement</b> (write rate, geography, access pattern, data size) forces it, and write down what would change your mind.',
    hook: '“Why not MongoDB / Cassandra / a vector DB?” is answered by “which requirement does Postgres fail, at what number?” If you cannot name the number, keep Postgres.',
    facts: [
      { v: '1', l: 'store is the cheapest number of stores. Each extra one adds a sync path, a backup story and an on-call rotation' },
      { v: 'CDC', l: 'is how secondary stores (search, warehouse, cache) should usually be fed: from the primary’s log, not by dual writes' },
      { v: 'undo?', l: 'is the architect’s key question: how hard is it to reverse? A cache is easy to remove; a primary store migration takes quarters' }
    ]
  },
  intro: {
    what: 'Applications keep their data in a <b>database</b>. There are many kinds: relational (tables + SQL), document, key-value, search, graph, analytics, and more. Each is very good at some jobs and poor at others. Choosing one means matching <b>what your app needs to do with data</b> to what the database is good at.',
    analogy: { icon: '🧰', title: 'A general-purpose toolbox, and specialist tools', text: 'A good multi-tool handles most jobs around the house. You buy a specialist tool (a tile cutter, a pipe bender) only when a job comes up that the multi-tool really can’t do. Postgres is the multi-tool. Specialist stores are bought for a specific job, and each one has to be stored, maintained and learned.' },
    steps: [
      { t: 'Describe the workload', d: 'Many small reads and writes from users (<b>OLTP</b>), or big scans and aggregates for reports (<b>OLAP</b>), or both?' },
      { t: 'Write down the hard numbers', d: 'Writes per second, total data size, how many regions must accept writes, and the latency budget. Vague words like “huge” do not count.' },
      { t: 'List the access patterns', d: 'Lookup by key, ad-hoc filters, full-text search, graph hops, “find similar” (vectors), time ranges. Each one may or may not need a special index or store.' },
      { t: 'Look for a forcing requirement', d: 'Start with Postgres. Switch or add a store only when one requirement clearly breaks it. Record why, and what would make you undo it.' }
    ],
    widget: 'db-decision-navigator-intro',
    terms: [
      ['OLTP', 'Online transaction processing: many short reads and writes, each touching a few rows (orders, logins).'],
      ['OLAP', 'Online analytical processing: few queries, each scanning millions of rows to aggregate (reports, dashboards).'],
      ['primary store', 'The source of truth. If it says the order exists, it exists.'],
      ['secondary store', 'A derived copy built for one access pattern (search index, cache, warehouse). It can be rebuilt from the primary.'],
      ['forcing requirement', 'A measured need the current choice cannot meet, e.g. “writes must be accepted in 3 regions during a region outage”.']
    ]
  },
  visual: {
    title: 'Walk the decision tree',
    caption: 'Answer the questions, then press Play. Each node checks whether your answer <b>forces</b> a move away from the Postgres default. The panel at the bottom shows the recommendation, the trade-offs, and what would change it.'
  },
  extras: [
    { id: 'db-decision-navigator-forcing', title: 'Forcing-function table', label: 'Forcing table', caption: 'Where a single Postgres stops, roughly, and what usually comes next. Filter by access pattern or sort by any column. Thresholds are rules of thumb, not limits: measure your own workload.' }
  ],
  gotchas: [
    { trap: '“We might need web scale” as a requirement', why: 'Choosing a distributed store for a future that may never come costs you joins, transactions and ad-hoc queries today, which are what you need for finding product-market fit.', fix: 'Write the actual number (e.g. 3k writes/s peak) and the growth that would break the design. Revisit at 30–50% of that limit.' },
    { trap: 'Picking a store per microservice by taste', why: 'Five services with five different engines means five backup, upgrade and failover runbooks, and a team that is expert in none.', fix: 'Adopt a small <b>paved road</b> (e.g. Postgres + Redis + one warehouse). Exceptions need a written forcing requirement.' },
    { trap: 'Treating a search index or cache as the source of truth', why: 'Elasticsearch and Redis can lose acknowledged writes in some failure modes, and are built to be rebuilt. If they are the only copy, a rebuild is impossible.', fix: 'Keep the truth in the primary. Feed derived stores from CDC or an outbox, so you can always rebuild them.' },
    { trap: 'Benchmarking with the wrong shape', why: 'A key-value benchmark says nothing about a workload that is 30% ad-hoc filters and joins. Vendor benchmarks are tuned for the vendor’s best case.', fix: 'Replay your own query mix (pg_stat_statements top 20) at 2–3× expected peak on the candidate.' },
    { trap: 'Ignoring the ops budget', why: 'A self-managed Cassandra or Elasticsearch cluster needs people who understand compaction, repairs, shard sizing and JVM heaps.', fix: 'Count the ops cost as a requirement. A managed service, or staying on one engine, is often the right answer for a small team.' },
    { trap: 'Not writing down “what would change my mind”', why: 'Without exit criteria, decisions are never revisited, or are revisited on a whim after every incident.', fix: 'End every database ADR with 2–3 measurable triggers (e.g. “p99 write latency > 50 ms at peak after tuning”).' }
  ],
  scenarios: [
    { title: 'Startup moved to a NoSQL store for scale; month 6: reporting is impossible',
      symptom: 'Finance needs “revenue by plan by month, excluding refunds”. Each report is a custom batch job that scans every document.',
      cause: 'The store was chosen for a write rate (~200 writes/s) that a single Postgres handles easily. Ad-hoc questions were the real access pattern, and the new store does not support joins or ad-hoc aggregates well.',
      fix: 'Move the system of record back to Postgres (dual-write, backfill, shadow-read, cut over), and use CDC into a warehouse for reporting. Record the measured write rate in the ADR.' },
    { title: 'Three stores, one customer record, three different answers',
      symptom: 'Support sees a customer’s new email in the app, but search and the CRM export still show the old one, sometimes for days.',
      cause: 'The service dual-writes to Postgres, Elasticsearch and a Redis cache. Partial failures are not retried, so the copies drift.',
      fix: 'Make Postgres the only write target. Publish changes through a transactional outbox or Debezium CDC, with idempotent consumers. Add a nightly reconciliation count. See <a href="polyglot-persistence.html">Polyglot persistence</a>.' },
    { title: 'Multi-region “active-active” on a single-primary Postgres',
      symptom: 'EU users see 180 ms extra latency on every write; a US region outage stops writes for everyone for 20 minutes.',
      cause: 'The requirement “accept writes in both regions during a region outage” was real but was never written down, so the design used a single primary with cross-region replicas.',
      fix: 'Either relax the requirement (EU writes go to the US, failover in minutes), or move the affected data to a distributed SQL store with regional placement. See <a href="distributed-sql.html">Distributed SQL</a>.' }
  ],
  puzzles: [
    { kind: 'concept', q: 'A B2B SaaS app: 400 writes/s at peak, 300 GB, one region, lots of ad-hoc admin filters, a search box over names. Best primary?', options: ['MongoDB', 'PostgreSQL, using pg_trgm/tsvector for the search box', 'Cassandra', 'Elasticsearch as the primary'], answer: 1, explain: 'Nothing here forces a move. 400 writes/s and 300 GB fit comfortably on one Postgres node, and a name search box fits trigram or full-text indexes. Elasticsearch is not built to be a system of record.' },
    { kind: 'concept', q: 'Which requirement is a <b>true forcing function</b> away from a single-primary Postgres?', options: ['“We want to be able to scale”', 'Writes must succeed in two regions while the network between them is partitioned', 'The team prefers JSON', 'Data will reach 200 GB next year'], answer: 1, explain: 'A single primary cannot accept writes on both sides of a partition. You need a multi-leader design or a consensus-based distributed database (and the latency that comes with it). The others are preferences or sizes Postgres handles.' },
    { kind: 'concept', q: 'Product wants semantic search over 2 million support articles. You already run Postgres. First move?', options: ['Add a dedicated vector database', 'Add pgvector with an HNSW index and measure recall and latency', 'Move everything to Elasticsearch', 'Store embeddings in Redis'], answer: 1, explain: '2M vectors is well within what pgvector handles on one node, and you keep transactional filters (tenant, permissions) in the same query. A dedicated vector DB is justified by much larger sets, very high QPS, or features you measured you need.' },
    { kind: 'concept', q: 'The ops team is two people, no DBA. Which choice adds the most operational risk?', options: ['Managed Postgres with a read replica', 'Self-managed Cassandra + self-managed Elasticsearch', 'Managed Postgres + managed Redis', 'Postgres + a managed warehouse'], answer: 1, explain: 'Each self-managed distributed store needs its own expertise (repairs, compaction, shard sizing, JVM tuning). Ops budget is a real requirement.' },
    { kind: 'concept', q: 'Dashboards run GROUP BY over 2 billion events, and they slow down the OLTP database. Best fix?', options: ['Add more indexes on the OLTP tables', 'Stream changes via CDC to a columnar store and point dashboards there', 'Switch the OLTP database to MongoDB', 'Run dashboards less often'], answer: 1, explain: 'Large aggregates are an OLAP access pattern. A columnar engine scans only the needed columns, compressed, and the OLTP primary stops paying for reporting.' },
    { kind: 'concept', q: 'What belongs in the “what would change my mind” section of a database ADR?', options: ['A list of competitor databases', 'Measurable triggers, e.g. sustained 20k writes/s or a multi-region write requirement', 'The vendor’s benchmark results', 'Nothing; decisions should be final'], answer: 1, explain: 'Exit criteria must be measurable so the decision is revisited at the right time and not on instinct.' }
  ],
  interview: [
    { q: 'Walk me through how you would choose a database for a new system.', a: '<p>Start from the <b>access patterns and numbers</b>, not from products: workload type (OLTP / OLAP / mixed), consistency per entity, data shape, write rate, data size and growth, geography of writes, latency budget, and team skills. Default to a relational primary (usually Postgres), then test each requirement against it. Move or add a store only for a forcing requirement, and record trade-offs and exit criteria in an ADR.</p>', fu: 'What if the interviewer says “assume 1M writes per second”? (Then ask: what kind of writes, what consistency, what reads? Then pick a partitioned store with a partition key designed for the access pattern.)', lvl: 'core' },
    { q: 'Why is “start with Postgres” a reasonable default, and when is it wrong?', a: '<p>It covers transactions, constraints, joins, ad-hoc SQL, JSONB, full-text, geospatial (PostGIS), vectors (pgvector) and time series (partitioning / Timescale), with mature tooling and managed offerings. It is wrong when a requirement breaks a single primary: multi-region writes during partitions, sustained write rates beyond one node after tuning, petabyte-scale analytics, or a dominant access pattern a specialist does much better (deep graph traversal, relevance-ranked search at scale).</p>', lvl: 'core' },
    { q: 'How do you size whether one Postgres node is enough?', a: '<p>Measure, don’t guess. Estimate peak writes/s and rows per write, WAL volume per second, working-set size against RAM, and the largest tables. Load-test the top queries from <code>pg_stat_statements</code> at 2–3× peak. Look at vertical headroom (bigger instance), read replicas for reads, and partitioning for very large tables before you consider sharding.</p>', lvl: 'deep' },
    { q: 'What is the difference between a primary and a secondary store, and why does it matter?', a: '<p>The primary is the source of truth, protected by transactions and backups. A secondary (search index, cache, warehouse, vector index) is <b>derived</b> and must be rebuildable from the primary. That decides the sync design (CDC/outbox from the primary), backup priorities, and which store you check when they disagree.</p>', lvl: 'core' },
    { q: 'A PM asks for MongoDB “because our data is JSON”. How do you respond?', a: '<p>Ask what queries the data must answer and what must be atomic. If documents are self-contained, rarely joined, and the team knows Mongo, it can be fine. But JSON alone is not a forcing requirement: Postgres JSONB with GIN indexes stores and queries JSON, and keeps relational joins and constraints for the parts that need them.</p>', lvl: 'core' },
    { q: 'How do you factor team skills and ops budget into the decision?', a: '<p>As a hard requirement with a cost. Each engine needs upgrade, backup/restore, failover, monitoring and capacity skills. A small team should prefer managed services and fewer engines; a store the team cannot restore from backup is a liability, whatever its benchmark.</p>', lvl: 'core' },
    { q: 'How do you make a database decision reversible?', a: '<p>Put data access behind repositories or a service boundary, keep the schema and events documented, and feed secondaries from CDC so they can be swapped. For the primary, keep migration paths in mind: logical replication, a dual-write → backfill → shadow-read → cutover playbook, and stable IDs that don’t depend on one engine.</p>', lvl: 'deep' },
    { q: 'Name three signals that it is time to add a second store.', a: '<ul><li>A query class (e.g. 10-billion-row aggregates, relevance-ranked fuzzy search) dominates load and cannot be fixed with indexes or replicas.</li><li>A latency target (sub-millisecond hot key reads at very high QPS) that a cache meets far more cheaply.</li><li>An isolation need: analytics must not affect OLTP, so you move it to a separate store.</li></ul>', lvl: 'deep' },
    { q: 'What goes into a database ADR?', a: '<p>Context and numbers, options considered, decision, consequences (positive and negative), operational plan (backups, failover, owners), sync strategy for derived stores, and <b>exit criteria</b>. Keep it to one page, and link the load-test results.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Keep the store swappable: a port in Spring', lang: 'java', code: `// Domain code depends on this port, not on JPA or a vendor SDK.
public interface ProductSearch {
  List<ProductHit> search(String query, long tenantId, int limit);
}

// v1: Postgres full-text, same transaction boundary as the catalog
@Repository
class PgProductSearch implements ProductSearch {
  private final JdbcTemplate jdbc;
  PgProductSearch(JdbcTemplate jdbc) { this.jdbc = jdbc; }
  public List<ProductHit> search(String q, long tenantId, int limit) {
    return jdbc.query("""
      SELECT id, name, ts_rank(tsv, websearch_to_tsquery('english', ?)) AS r
      FROM product
      WHERE tenant_id = ? AND tsv @@ websearch_to_tsquery('english', ?)
      ORDER BY r DESC LIMIT ?""",
      (rs, i) -> new ProductHit(rs.getLong("id"), rs.getString("name")),
      q, tenantId, q, limit);
  }
}
// v2 (only if a forcing requirement appears): an Elasticsearch adapter fed by CDC.`, note: 'The port makes adding a specialist store an adapter change, not a rewrite.' }
  ]
});

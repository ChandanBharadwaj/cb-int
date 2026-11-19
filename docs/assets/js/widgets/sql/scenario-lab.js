/* Scenario data shared by the scenario-lab widget and its matrix. Option indexes:
   0 Postgres, 1 Postgres + Redis, 2 DynamoDB / Cassandra, 3 MongoDB, 4 Elasticsearch, 5 Neo4j,
   6 TimescaleDB / ClickHouse, 7 Distributed SQL, 8 Columnar warehouse, 9 Postgres + pgvector */
IA.scenarioLab = [
  { title: 'Payments ledger', brief: 'Record money movements between accounts for a fintech. Every transfer debits one account and credits another. Auditors must be able to rebuild any balance.',
    facts: ['2,000 transfers/s at peak', 'Single region, strict RPO 0 for committed transfers', 'Invariant: balances never go negative; entries sum to zero'],
    pick: 0, alt: [7], pickText: 'Postgres: an append-only double-entry ledger',
    why: ['Multi-row ACID transactions: debit + credit commit together or not at all.', 'Constraints and <code>SELECT … FOR UPDATE</code> (or SERIALIZABLE) protect the no-negative-balance invariant.', 'Synchronous standby gives RPO 0 within a region; 2k writes/s fits one tuned node.', 'Entries are immutable rows; balances are derived (and can be cached in a balance table updated in the same transaction).'],
    rejected: [['DynamoDB / Cassandra', 'transactions across items are limited or expensive (Cassandra LWT); invariants across accounts get hard.'], ['MongoDB', 'possible with multi-document transactions, but you give up relational constraints for no gain.'], ['Distributed SQL', 'only needed if the ledger must accept writes in several regions; costs commit latency.']],
    tenx: ['Hot accounts (a big merchant) become a lock hotspot: split into sub-accounts or post to the balance asynchronously.', 'The entries table grows fast: partition by month, archive closed periods.', 'Multi-region requirement appears: evaluate distributed SQL with regional placement.'] },
  { title: 'E-commerce catalog', brief: 'A catalog of 3 million products with very different attributes per category (shoes have sizes, TVs have panel types). Mostly reads.',
    facts: ['5,000 reads/s, 20 writes/s', 'Category-specific attributes, frequent new categories', 'Filters by price, brand and a few attributes; a search box'],
    pick: 0, alt: [3, 1], pickText: 'Postgres with JSONB attributes (add a search engine later)',
    why: ['Core fields (price, brand, stock) as columns with constraints; the long tail of attributes in <code>jsonb</code> with GIN indexes.', 'Joins to inventory, pricing and orders stay transactional.', 'Read load is handled by replicas and an HTTP cache/CDN.'],
    rejected: [['MongoDB', 'a good fit for variable documents, but adds a second store if orders live in Postgres; JSONB covers it.'], ['Elasticsearch as the primary', 'not a system of record; feed it from Postgres when search needs grow.'], ['EAV tables', 'entity-attribute-value tables make every filter a self-join.']],
    tenx: ['Search relevance, facets and typo tolerance: add Elasticsearch/OpenSearch fed by CDC.', 'Read QPS: more replicas, Redis for hot product pages.', 'Huge JSONB documents updated often: split hot fields out (whole TOASTed value is rewritten on update).'] },
  { title: 'Chat / messages', brief: 'A consumer chat app. Users read the latest messages of a channel and scroll back. Messages are rarely edited.',
    facts: ['150,000 message writes/s at peak, multiple data centres', 'Read pattern: latest N messages per channel, then older pages', 'Eventual consistency between DCs is acceptable'],
    pick: 2, alt: [], pickText: 'Wide-column store (Cassandra / ScyllaDB), partitioned by (channel, time bucket)',
    why: ['The write rate exceeds what one primary sustains; LSM writes are append-only and cheap.', 'One query dominates: partition key <code>(channel_id, bucket)</code>, clustering by message id/time DESC serves it from one partition.', 'Multi-DC replication with tunable consistency is built in.'],
    rejected: [['Postgres', 'perfect at 1/100th of this volume; here a single primary’s write rate and table size are the limit (sharding would be needed).'], ['MongoDB', 'can shard, but the model gains nothing over wide-column for append-heavy timelines.'], ['Elasticsearch', 'for message search only, fed from the store.']],
    tenx: ['Huge channels create hot, oversized partitions: smaller buckets.', 'Deletes and TTLs create tombstones: tune compaction (time-window).', 'Message search needs a separate index.'] },
  { title: 'IoT telemetry', brief: 'Industrial sensors report metrics. Operators view recent charts per device; analysts query monthly trends. Data older than 1 year is deleted.',
    facts: ['100,000 devices × 1 reading / 10 s = 10,000 rows/s', 'Queries: last 24 h per device; hourly rollups per site', 'Retention: 13 months'],
    pick: 6, alt: [0], pickText: 'TimescaleDB (Postgres extension); ClickHouse if analytics dominate',
    why: ['Hypertables partition by time automatically; queries on recent data touch only recent chunks.', 'Native compression of old chunks and retention by dropping whole chunks.', 'Continuous aggregates keep hourly rollups up to date.', '10k rows/s with batched inserts fits one node, and it is still SQL with joins to device metadata.'],
    rejected: [['Plain Postgres', 'works with native partitioning + BRIN, but you rebuild rollups and retention yourself.'], ['Cassandra', 'handles the writes, but ad-hoc analysis and rollups are hard.'], ['Row-by-row inserts', 'batch via COPY or multi-row INSERT, often through Kafka.']],
    tenx: ['100k rows/s: ingest through Kafka, consider ClickHouse for analytics, keep Timescale for operational views.', 'High cardinality (tags per series) blows up indexes.', 'Late/out-of-order data hitting compressed chunks is expensive.'] },
  { title: 'Game leaderboard', brief: 'A mobile game shows a global top 100 and “your rank” to every player after each match.',
    facts: ['10 million players', '30,000 score updates/s in the evening peak', '“Your rank” must be fast for any player'],
    pick: 1, alt: [], pickText: 'Postgres for the truth, Redis sorted sets for ranking',
    why: ['Redis <code>ZADD</code> / <code>ZREVRANK</code> / <code>ZREVRANGE</code> are O(log N) in memory: rank of any player in sub-millisecond.', 'Postgres keeps match results and final scores durably (and can rebuild Redis).', 'Each store does what it is best at; Redis is a derived structure.'],
    rejected: [['Postgres only', '<code>ORDER BY score DESC LIMIT 100</code> is fine, but “rank of player X” is a count over millions of rows per request.'], ['DynamoDB / Cassandra', 'no global ordering across partitions.'], ['Redis only', 'risk of losing scores; persistence settings are a trade-off.']],
    tenx: ['One sorted set hits memory and single-thread limits: shard by region/season/bracket.', 'Rebuild time from Postgres after a Redis loss.', 'Write fan-out to friends’ leaderboards.'] },
  { title: 'Fraud graph', brief: 'Detect fraud rings: accounts that share devices, cards, IPs or addresses, several hops apart. Analysts explore connections interactively.',
    facts: ['200 M accounts, 1 B links', 'Queries: “accounts within 4 hops sharing a device or card”', 'Near-real-time scoring for new signups'],
    pick: 5, alt: [], pickText: 'Neo4j (graph DB) as a secondary store, fed from the Postgres system of record',
    why: ['Variable-length traversals (1–4 hops) are the main query; native graph storage follows relationships directly.', 'Graph algorithms (connected components, centrality) are available as libraries.', 'Postgres stays the source of truth; the graph is rebuilt/updated via CDC.'],
    rejected: [['Postgres recursive CTEs', 'fine for 1–2 hops; 4 hops over a billion edges explodes the intermediate results.'], ['Elasticsearch', 'finds matching documents, not paths.'], ['Graph as the primary', 'keeps money and identity data away from a store built for traversal.']],
    tenx: ['Supernodes (a shared public IP, a default device id) make traversals explode: cap or exclude them.', 'Graph too big for one machine: sharding graphs is hard; precompute features.', 'CDC lag delays fraud signals.'] },
  { title: 'Product search', brief: 'Shoppers type free text with typos, filter by facets (brand, size, colour) and expect relevance ranking with synonyms.',
    facts: ['3 M products, 2,000 searches/s', 'Facets with counts on every query', 'Index freshness within a minute is fine'],
    pick: 4, alt: [], pickText: 'Elasticsearch / OpenSearch, fed from Postgres via CDC',
    why: ['Inverted index with analyzers, synonyms, fuzzy matching and BM25 relevance.', 'Aggregations give facet counts in the same query.', 'Near-real-time freshness (refresh ~1 s) is within the requirement.'],
    rejected: [['Postgres tsvector + pg_trgm', 'great start; struggles with facets at this QPS, relevance tuning and typo tolerance together.'], ['Elasticsearch as the source of truth', 'no transactions, reindexing, can’t rebuild from itself.'], ['Dual writes from the app', 'drift; use CDC or an outbox.']],
    tenx: ['Reindex time grows: use index aliases and blue/green indexes.', 'Shard sizing and heap pressure from aggregations.', 'Semantic search requests: add vectors (hybrid search).'] },
  { title: 'RAG / AI-agent memory', brief: 'An assistant retrieves relevant chunks from customer documents and stores agent memories. Every result must respect tenant and document permissions.',
    facts: ['8 M chunks, 1536-dim embeddings', '300 retrieval queries/s', 'Strict per-tenant and per-document access control'],
    pick: 9, alt: [], pickText: 'Postgres + pgvector (HNSW), filters and permissions in the same query',
    why: ['Similarity search next to tenant and ACL columns: one query, one transaction, one backup.', 'Deleting a document deletes its chunks atomically (no orphan vectors elsewhere).', '8 M vectors fits a well-sized node; HNSW gives millisecond k-NN.'],
    rejected: [['Dedicated vector DB', 'adds a sync path and a second copy of permissions; worth it at much larger scale.'], ['Elasticsearch kNN', 'possible for hybrid search, but it is another store to keep consistent.'], ['Exact search (no index)', 'linear scan of 8 M vectors per query is too slow.']],
    tenx: ['80 M vectors: HNSW memory and build time grow; partition by tenant, consider quantization or a dedicated vector DB.', 'Selective filters return too few results: iterative scans (pgvector 0.8+) or per-tenant partitions.', 'Embedding model change means re-embedding everything.'] },
  { title: 'Multi-tenant SaaS', brief: 'A B2B project-management app. Most tenants are small; a few are huge. Every query is scoped to one tenant.',
    facts: ['8,000 tenants, top 10 tenants hold 40% of the data', '3,000 writes/s total', 'Tenant isolation is a security requirement'],
    pick: 0, alt: [7], pickText: 'Postgres, shared schema with tenant_id + row-level security (Citus when it outgrows one node)',
    why: ['A <code>tenant_id</code> on every table, leading every index; RLS policies as a safety net.', 'One schema to migrate, one pool of connections, cheap per tenant.', 'Citus can later distribute by tenant_id with co-located tables, keeping queries single-shard.'],
    rejected: [['Database per tenant', '8,000 databases: migrations, connections and monitoring explode.'], ['Schema per tenant', 'catalog bloat and slow migrations at thousands of schemas.'], ['Distributed SQL from day one', 'pays latency and complexity before it is needed.']],
    tenx: ['Noisy neighbours: move the biggest tenants to their own shard or cluster.', 'Cross-tenant analytics: CDC to a warehouse.', 'RLS mistakes: test that every query path sets the tenant context.'] },
  { title: 'Global user profile', brief: 'Profiles (name, settings, preferences) for a consumer app used on three continents. Logins must keep working if a whole region goes down.',
    facts: ['Read-heavy: 200k reads/s, 2k writes/s', 'Users mostly edit their own profile from one device at a time', 'Writes must succeed locally during a region outage'],
    pick: 2, alt: [7], pickText: 'Multi-region key-value: DynamoDB global tables (or Cassandra)',
    why: ['Each region accepts reads and writes locally with low latency and stays up if another region fails.', 'Access is by user id: a perfect key-value pattern.', 'Concurrent edits of one profile in two regions are rare, so last-writer-wins is acceptable.'],
    rejected: [['Single-primary Postgres + replicas', 'writes cross an ocean and stop during a primary-region outage.'], ['Distributed SQL', 'strongly consistent but every write pays a cross-region quorum; justified if profile edits must never be lost to LWW.'], ['MongoDB', 'possible with global clusters, no clear advantage for key access.']],
    tenx: ['Conflicting edits: model per-field updates or version counters instead of whole-item overwrites.', 'Data residency (GDPR): some profiles must stay in one region.', 'Search over profiles needs a separate index.'] },
  { title: 'Audit log', brief: 'Record every security-relevant action (logins, permission changes, data exports). Entries must never be changed, and must be kept 7 years.',
    facts: ['1,500 events/s', 'Queries: by user or resource over a time range, mostly recent', 'Tamper-evidence required by compliance'],
    pick: 0, alt: [6], pickText: 'Postgres: append-only, time-partitioned table; old partitions exported to object storage',
    why: ['Insert-only table with UPDATE/DELETE revoked; optionally a hash chain column for tamper evidence.', 'Written in the same transaction as the action, so nothing is lost or invented (or via an outbox).', 'Monthly partitions: recent queries are fast; old months are exported to Parquet on object storage with a retention lock.'],
    rejected: [['Elasticsearch', 'great for exploring logs, not a durable record.'], ['Kafka alone', 'retention and querying are not built for a 7-year archive.'], ['Mutable rows', 'any UPDATE path breaks the audit guarantee.']],
    tenx: ['Volume: move cold partitions to Parquet and query them through a warehouse.', 'Write rate: batch inserts or separate audit database.', 'Search across years: index the archive with a lake query engine.'] },
  { title: 'Analytics dashboard', brief: 'Executives and 200 internal users explore revenue, funnels and cohorts over 3 years of orders and events.',
    facts: ['4 B event rows, growing 10 M/day', 'Ad-hoc GROUP BYs over many dimensions', 'Data can be 5 minutes old'],
    pick: 8, alt: [6], pickText: 'Columnar warehouse (BigQuery / Snowflake / ClickHouse), fed by CDC from Postgres',
    why: ['Scans of billions of rows over a few columns: columnar storage, compression and vectorized execution.', 'Isolation: dashboards never touch the OLTP primary.', 'CDC (Debezium / logical decoding) gives minutes of freshness and captures deletes.'],
    rejected: [['The OLTP primary', 'scans evict the working set and slow checkout.'], ['A read replica', 'OK for small data; 4 B rows of row storage is too slow and heavy queries conflict with replication.'], ['Elasticsearch aggregations', 'possible for some dashboards, but not for ad-hoc SQL joins.']],
    tenx: ['Cost per query grows: partition/cluster tables, pre-aggregate, limit SELECT *.', 'Concurrency: more compute clusters or a semantic layer with caching.', 'CDC schema changes break pipelines: use a schema registry and contracts.'] }
];
/* Scenario lab: pick a scenario card, guess the store, then Play/Step to reveal the architect's pick, why, rejected alternatives and what breaks at 10x. */
IA.widget('scenario-lab', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-sl-style')) document.head.append(el('style', { id: 'w-sl-style', html: `
.w-sl-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.w-sl-card { text-align: left; border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 10px; padding: 8px 10px; cursor: pointer; font: inherit; font-size: 13px; }
.w-sl-card .n { font-family: var(--mono); font-size: 11px; color: var(--text-3); }
.w-sl-card.on { border-color: var(--accent); background: var(--accent-soft); }
.w-sl-card.done::after { content: ' ✓'; color: var(--ok); font-weight: 700; }
.w-sl-brief { border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; background: var(--surface-2); margin: 12px 0 8px; }
.w-sl-brief h4 { margin: 0 0 4px; } .w-sl-brief ul { margin: 6px 0 0; padding-left: 18px; font-size: 13px; }
.w-sl-guess button.right { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 18%, var(--surface)); color: var(--text); }
.w-sl-guess button.wrong { border-color: var(--err); background: color-mix(in srgb, var(--err) 14%, var(--surface)); color: var(--text); }
.w-sl-guess button.near { border-color: var(--warn); }
.w-sl-rev { display: grid; gap: 8px; margin-top: 8px; }
.w-sl-panel { border: 1px solid var(--border); border-left: 4px solid var(--accent); border-radius: 10px; padding: 8px 12px; background: var(--surface); animation: capin .35s ease both; font-size: 13.5px; }
.w-sl-panel.k-rej { border-left-color: var(--err); } .w-sl-panel.k-ten { border-left-color: var(--warn); } .w-sl-panel.k-pick { border-left-color: var(--ok); }
.w-sl-panel .kicker { margin-bottom: 2px; } .w-sl-panel ul { margin: 0; padding-left: 18px; }
` }));
  const OPT = ['Postgres', 'Postgres + Redis', 'DynamoDB / Cassandra', 'MongoDB', 'Elasticsearch', 'Neo4j', 'TimescaleDB / ClickHouse', 'Distributed SQL', 'Columnar warehouse', 'Postgres + pgvector'];
  const S = IA.scenarioLab || [];
  let cur = 0, guess = null, gen = 0, k = 0, running = false, speed = 2400; const done = new Set(); let score = 0;
  const mkSeg = (label, items, c, on) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === c ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const cards = el('div', { class: 'w-sl-cards', role: 'list' });
  const brief = el('div', { class: 'w-sl-brief' });
  const gseg = el('div', { class: 'seg w-sl-guess', role: 'radiogroup', 'aria-label': 'Your guess' });
  const rev = el('div', { class: 'w-sl-rev' });
  const stats = el('div', { class: 'w-stats' });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }), bStep = el('button', { class: 'btn', text: 'Step ›' }), bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  root.append(cards, brief, el('div', { class: 'kicker', text: 'Your guess: primary store' }), gseg,
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), mkSeg('Speed', [[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], 2400, (v) => { speed = v; })), cap, rev, stats);
  const cardEls = S.map((s, i) => { const b = el('button', { class: 'w-sl-card', role: 'listitem' }, el('div', { class: 'n', text: `#${i + 1}` }), s.title); b.addEventListener('click', () => { cur = i; reset(); }); cards.append(b); return b; });
  OPT.forEach((o, i) => { const b = el('button', { text: o }); b.addEventListener('click', () => { if (k > 0) return; guess = i; [...gseg.children].forEach((x, j) => x.classList.toggle('on', j === i)); say(`You guessed <b>${o}</b>. Press Play (or Step) to see the architect’s pick.`); }); gseg.append(b); });
  const panel = (cls, kick, body) => el('div', { class: 'w-sl-panel ' + cls }, el('div', { class: 'kicker', text: kick }), body);
  function frames() {
    const s = S[cur];
    return [
      () => { const ok = guess === s.pick, near = (s.alt || []).includes(guess);
        [...gseg.children].forEach((x, j) => { x.classList.toggle('right', j === s.pick); x.classList.toggle('wrong', j === guess && !ok && !near); x.classList.toggle('near', j === guess && near); });
        if (!done.has(cur)) { done.add(cur); if (ok) score++; cardEls[cur].classList.add('done'); }
        rev.append(panel('k-pick', 'Architect’s pick', el('div', { html: `<b>${s.pickText}</b>` })));
        say(guess == null ? 'No guess made, so here is the pick.' : ok ? 'Correct. Now check whether your reasoning matches.' : near ? 'Close: your choice is a defensible alternative, but not the best fit here.' : 'Not this time. Read the reasoning: the requirement that decides it is usually one number.');
        paintStats(); },
      () => { rev.append(panel('', 'Why', el('ul', null, s.why.map((w) => el('li', { html: w }))))); say('The deciding requirements.'); },
      () => { rev.append(panel('k-rej', 'Rejected alternatives', el('ul', null, s.rejected.map(([a, b]) => el('li', { html: `<b>${a}</b>: ${b}` }))))); say('Why the other obvious choices lose here.'); },
      () => { rev.append(panel('k-ten', 'What breaks at 10×', el('ul', null, s.tenx.map((w) => el('li', { html: w }))))); say('An architect names the next bottleneck before it arrives.'); }
    ];
  }
  let F = [];
  function paintStats() { stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `revealed <b>${done.size}</b> / ${S.length}` }), el('span', { class: 'w-stat', html: `exact guesses <b>${score}</b>` })); }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; bStep.disabled = false; guess = null; rev.innerHTML = ''; F = frames();
    cardEls.forEach((c, i) => c.classList.toggle('on', i === cur));
    [...gseg.children].forEach((x) => x.classList.remove('on', 'right', 'wrong', 'near'));
    const s = S[cur]; brief.innerHTML = ''; brief.append(el('div', { class: 'kicker', text: `Scenario ${cur + 1}` }), el('h4', { text: s.title }), el('p', { html: s.brief, style: { margin: '0', fontSize: '14px' } }), el('ul', null, s.facts.map((f) => el('li', { html: f }))));
    say('Read the brief, pick your guess below, then press Play.'); paintStats();
  }
  const say = (t) => { cap.firstChild.innerHTML = t; };
  function step() { if (k >= F.length) return false; F[k++](); if (k >= F.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= F.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 600 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  if (S.length) reset(); else root.append(el('p', { class: 'muted', text: 'No scenarios loaded.' }));
});

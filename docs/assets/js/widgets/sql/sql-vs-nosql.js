/* SQL vs NoSQL: pick a family, step through use case → model → read/write path → strength → failure mode → Postgres equivalent. */
IA.widget('sql-vs-nosql', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-svn-style')) document.head.append(el('style', { id: 'w-svn-style', html: `
.w-svn-lanes { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
.w-svn-lane { border: 1px solid var(--border); border-radius: 12px; padding: 8px; background: var(--surface-2); min-width: 0; }
.w-svn-lane h5 { margin: 0 0 6px; font-size: 12.5px; font-family: var(--mono); }
.w-svn-it { border: 1px solid var(--border); background: var(--surface); border-radius: 8px; padding: 5px 7px; font-family: var(--mono); font-size: 11.5px; margin-bottom: 5px; transition: all .3s; word-break: break-word; white-space: pre-wrap; }
.w-svn-it.hot { border-color: var(--accent); background: var(--accent-soft); }
.w-svn-it.new { border-color: var(--ok); animation: capin .35s ease both; }
.w-svn-it.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 12%, var(--surface)); }
.w-svn-it.dim { opacity: .4; }
.w-svn-phase { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 0; }
.w-svn-phase span { font-size: 12px; padding: 2px 8px; border-radius: 99px; border: 1px solid var(--border); color: var(--text-3); }
.w-svn-phase span.on { border-color: var(--accent); color: var(--accent); font-weight: 600; }
.w-svn-phase span.fail.on { border-color: var(--err); color: var(--err); }
` }));
  // ops: h=[keys] highlight, a=[lane,key,text,cls] add, c=[key,cls] add class, t=[key,text] set text
  const F = {
    doc: { name: 'Document · MongoDB', lanes: [['col', 'orders collection', [['d1', '{_id: 42,\n customer: {id: 7, name: "Asha"},\n items: [{sku: "A1", qty: 2}],\n total: 250}']]], ['idx', 'indexes', [['x1', '_id (default)'], ['x2', 'customer.id']]]],
      steps: [
        ['Use case: a product catalog or order history, where each request reads or writes <b>one whole aggregate</b>.', {}],
        ['Model: the order and its line items are one JSON (BSON) document. No join is needed to load it.', { h: ['d1'] }],
        ['Read/write path: <code>findOne({_id: 42})</code> fetches everything in one lookup; an update to the document is atomic.', { h: ['d1', 'x1'] }],
        ['Strength: flexible schema, natural mapping to objects, built-in sharding by a shard key.', { h: ['x2'] }],
        ['<b>Failure mode</b>: Asha’s name is copied into every order. When she changes it, thousands of documents are stale. Unbounded arrays grow documents toward the 16 MB limit.', { a: ['col', 'd2', '{_id: 43, customer: {id: 7, name: "Asha"} …}', 'bad'], c: ['d1', 'bad'] }],
        ['Postgres: a <code>jsonb</code> column with a GIN index covers flexible attributes, while customers stay a normal table joined by id.', { a: ['idx', 'pg', 'PG: orders.doc jsonb + GIN', 'new'] }]
      ] },
    kv: { name: 'Key-value · Redis, DynamoDB', lanes: [['p0', 'partition A', [['k1', 'user#1 → {…}'], ['k2', 'user#4 → {…}']]], ['p1', 'partition B', [['k3', 'user#2 → {…}'], ['k4', 'product#99 → {…}']]], ['p2', 'partition C', [['k5', 'user#3 → {…}']]]],
      steps: [
        ['Use case: sessions, carts, user profiles, rate limits, feature flags: always read by a known key.', {}],
        ['Model: <code>hash(partition key)</code> picks the partition. DynamoDB adds a sort key for ordered items within a partition.', { h: ['k1', 'k3', 'k5'] }],
        ['Read path: <code>GET user#2</code> goes straight to partition B: constant time, no planner. Redis keeps it in memory for sub-millisecond reads.', { h: ['k3'] }],
        ['Strength: predictable latency at almost any scale, if every query is by key.', {}],
        ['<b>Failure mode: hot partition.</b> A flash sale sends all traffic to <code>product#99</code>. Partition B hits its per-partition limit and throttles, while A and C sit idle. Queries by anything but the key need a scan or a secondary index.', { c: ['k4', 'bad'], h: [] }],
        ['Postgres: a primary-key lookup is also O(log n) and very fast; hash partitioning exists. Redis still wins for sub-ms, very high-QPS hot keys.', { a: ['p2', 'pg', 'PG: PK B-tree, PARTITION BY HASH', 'new'] }]
      ] },
    wide: { name: 'Wide-column · Cassandra', lanes: [['q', 'queries first', [['q1', 'Q1: messages in a channel,\n newest first']]], ['mem', 'write path', [['cl', 'commit log (append)'], ['mt', 'memtable (sorted, in RAM)']]], ['ss', 'SSTables on disk', [['s1', 'SSTable 1'], ['s2', 'SSTable 2']]]],
      steps: [
        ['Use case: very high write rates with known queries: chat messages, events, IoT, across data centres.', { h: ['q1'] }],
        ['Query-first model: table <code>messages_by_channel</code>, partition key <code>(channel_id, day)</code>, clustering key <code>ts DESC</code>. One table per query; data is duplicated.', { h: ['q1'], a: ['q', 'q2', 'PRIMARY KEY ((channel_id, day), ts)', 'new'] }],
        ['Write path (LSM): append to the commit log and insert into the memtable. No read before write, so writes are fast. Memtables flush to immutable SSTables.', { h: ['cl', 'mt'], a: ['ss', 's3', 'SSTable 3 (flushed)', 'new'] }],
        ['Read path: merge the memtable and several SSTables for that partition (bloom filters skip most). Compaction merges SSTables in the background.', { h: ['mt', 's1', 's2', 's3'] }],
        ['<b>Failure mode</b>: a query you did not model (“all messages containing ‘refund’”) needs <code>ALLOW FILTERING</code>, a cluster-wide scan. Deletes leave tombstones that slow reads; unbucketed partitions grow without bound.', { a: ['q', 'q3', 'Q2 (not modelled): by keyword?', 'bad'] }],
        ['Postgres: a B-tree on <code>(channel_id, ts DESC)</code> serves Q1, and ad-hoc queries still work. It stops at the write rate one primary sustains.', { a: ['ss', 'pg', 'PG: index (channel_id, ts DESC)', 'new'] }]
      ] },
    graph: { name: 'Graph · Neo4j', lanes: [['n', 'nodes', [['a', '(ana:Person)'], ['b', '(ben:Person)'], ['c', '(cy:Person)'], ['d', '(acct:Account)']]], ['e', 'relationships', [['r1', 'ana -[:FOLLOWS]-> ben'], ['r2', 'ben -[:FOLLOWS]-> cy'], ['r3', 'cy -[:OWNS]-> acct'], ['r4', 'ana -[:OWNS]-> acct']]]],
      steps: [
        ['Use case: fraud rings, recommendations, network/permission paths: questions about <b>how things connect</b>, at variable depth.', {}],
        ['Model: nodes and typed relationships, both with properties. Each node stores direct references to its relationships.', { h: ['a', 'r1', 'r4'] }],
        ['Traversal: <code>MATCH (a:Person {name:"ana"})-[:FOLLOWS*1..3]->(p)</code> hops by following pointers. Cost depends on the edges touched, not the total graph size.', { h: ['a', 'r1', 'b', 'r2', 'c'] }],
        ['Strength: “two people who share an account and are within 3 hops” is a short query and fast, where SQL needs repeated self-joins.', { h: ['r3', 'r4', 'd'] }],
        ['<b>Failure mode</b>: a supernode (a celebrity with millions of followers, or a shared default device id) makes every traversal through it explode. Big aggregates and sharding are weak points.', { a: ['n', 'sn', '(celebrity) 3M edges', 'bad'] }],
        ['Postgres: an edges table plus <code>WITH RECURSIVE</code> handles shallow, bounded traversals. Deep, variable-length paths over large graphs favour a graph DB.', { a: ['e', 'pg', 'PG: follows(src,dst) + recursive CTE', 'new'] }]
      ] },
    search: { name: 'Search · Elasticsearch', lanes: [['docs', 'documents', [['d1', '1: "red running shoe"'], ['d2', '2: "blue running jacket"'], ['d3', '3: "red wool sock"']]], ['inv', 'inverted index', [['t1', 'red → 1, 3'], ['t2', 'run → 1, 2'], ['t3', 'shoe → 1']]], ['seg', 'refresh', [['rf', 'buffer → segment every 1 s']]]],
      steps: [
        ['Use case: product search, log search, typo-tolerant, relevance-ranked text with facets.', {}],
        ['Model: an analyzer splits and stems text into terms; the <b>inverted index</b> maps each term to the documents (postings) containing it.', { h: ['t1', 't2', 't3'] }],
        ['Query “red running”: look up both postings lists, intersect/union, score with BM25, return the top hits. Doc 1 matches both terms, so it ranks first.', { h: ['t1', 't2', 'd1'] }],
        ['Near-real-time: a new document sits in a buffer until the next <b>refresh</b> (default 1 s) makes it searchable. Search is eventually consistent.', { a: ['docs', 'd4', '4: "red trail shoe" (not yet searchable)', 'hot'], h: ['rf'] }],
        ['<b>Failure mode</b>: used as the primary DB. No multi-document transactions, mapping changes need a reindex, and lost or late writes can’t be recovered from elsewhere.', { c: ['d4', 'bad'] }],
        ['Postgres: <code>tsvector</code> + GIN gives stemming and ranking; <code>pg_trgm</code> gives fuzzy matching. Elasticsearch wins on relevance tuning, facets and scale. Feed it via CDC.', { a: ['inv', 'pg', 'PG: tsvector + GIN, pg_trgm', 'new'] }]
      ] },
    ts: { name: 'Time-series · TimescaleDB', lanes: [['hyper', 'hypertable readings', [['c1', 'chunk Jan 01 (compressed)'], ['c2', 'chunk Jan 02 (compressed)'], ['c3', 'chunk Jan 03 (hot)']]], ['agg', 'continuous aggregate', [['ca', 'hourly avg per device']]]],
      steps: [
        ['Use case: metrics, IoT telemetry, prices: append-mostly rows with a timestamp, queried by time range.', {}],
        ['Model: a hypertable is automatically split into time <b>chunks</b> (child tables). New rows land in the latest chunk.', { h: ['c3'] }],
        ['Query “last 6 hours”: chunk exclusion skips old chunks entirely, so only the hot chunk is read.', { h: ['c3'], c: ['c1', 'dim'] }],
        ['Strength: old chunks are compressed in a columnar layout; retention drops whole chunks (cheap); continuous aggregates keep rollups up to date.', { h: ['c1', 'c2', 'ca'] }],
        ['<b>Failure mode</b>: queries without a time predicate scan every chunk; very high series cardinality and frequent updates to compressed chunks are costly.', { c: ['c1', 'bad'], a: ['hyper', 'q', 'SELECT … WHERE device = 7 (no time filter)', 'bad'] }],
        ['It <i>is</i> Postgres (an extension). Without it: native range partitioning + BRIN indexes + materialized views. ClickHouse wins for huge analytic scans.', { a: ['agg', 'pg', 'PG: PARTITION BY RANGE (ts), BRIN', 'new'] }]
      ] },
    vec: { name: 'Vector · pgvector vs dedicated', lanes: [['emb', 'embeddings', [['e1', 'chunk 1 → [0.12, -0.4, …]'], ['e2', 'chunk 2 → [0.10, -0.38, …]'], ['e3', 'chunk 3 → [-0.9, 0.2, …]']]], ['hnsw', 'HNSW graph', [['l2', 'layer 2: few nodes'], ['l1', 'layer 1'], ['l0', 'layer 0: all nodes']]]],
      steps: [
        ['Use case: semantic search, RAG retrieval, recommendations, deduplication: “find items <b>similar</b> to this”.', {}],
        ['Model: a model turns text into an embedding vector. Similar meaning = small distance (cosine / L2 / inner product).', { h: ['e1', 'e2'] }],
        ['Query: an HNSW index enters at the top layer and greedily walks toward the query vector, layer by layer, returning approximate nearest neighbours fast.', { h: ['l2', 'l1', 'l0'] }],
        ['Strength: millisecond k-NN over millions of vectors. The answer is <b>approximate</b>: recall depends on index parameters.', { h: ['e1', 'e2', 'l0'] }],
        ['<b>Failure mode</b>: filters. “Top 10 similar, but only tenant 7” post-filters the ANN result, so you may get 2 rows instead of 10. Also: re-embedding everything when the model changes.', { a: ['emb', 'f', 'WHERE tenant = 7 → only 2 of 10 left', 'bad'] }],
        ['pgvector keeps vectors next to the rows: filters, joins, ACID and one backup. A dedicated vector DB is for very large collections or QPS beyond one node, at the cost of a sync path.', { a: ['hnsw', 'pg', 'PG: vector(1536) + HNSW index', 'new'] }]
      ] }
  };
  const PH = ['use case', 'model', 'access path', 'strength', 'failure mode', 'in Postgres'];
  let fam = 'doc', gen = 0, k = 0, running = false, speed = 2400;
  const mkSeg = (label, items, cur, on) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const stage = el('div', { class: 'w-svn-lanes' });
  const phase = el('div', { class: 'w-svn-phase' });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }), bStep = el('button', { class: 'btn', text: 'Step ›' }), bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  root.append(el('div', { class: 'w-controls' }, mkSeg('Family', Object.entries(F).map(([v, f]) => [v, f.name.split(' · ')[0]]), fam, (v) => { fam = v; reset(); })),
    el('div', { class: 'w-stage' }, el('div', { class: 'kicker', text: '' }), stage, phase),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), mkSeg('Speed', [[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], 2400, (v) => { speed = v; })), cap);
  const kick = root.querySelector('.w-stage .kicker');
  const items = {}; const lanes = {}; let phs = [];
  function draw() {
    stage.innerHTML = ''; for (const x in items) delete items[x]; const f = F[fam]; kick.textContent = f.name;
    f.lanes.forEach(([id, t, list]) => { const L = el('div', { class: 'w-svn-lane' }, el('h5', { text: t })); list.forEach(([key, txt]) => { items[key] = el('div', { class: 'w-svn-it', text: txt }); L.append(items[key]); }); lanes[id] = L; stage.append(L); });
    phase.innerHTML = ''; phs = PH.map((p, i) => el('span', { class: i === 4 ? 'fail' : '', text: p })); phase.append(...phs);
  }
  function apply(o) {
    Object.values(items).forEach((n) => n.classList.remove('hot'));
    if (o.a) { const [ln, key, txt, cls] = o.a; items[key] = el('div', { class: 'w-svn-it ' + (cls || 'new'), text: txt }); lanes[ln].append(items[key]); }
    if (o.c) items[o.c[0]].classList.add(o.c[1]);
    (o.h || []).forEach((x) => items[x] && items[x].classList.add('hot'));
  }
  const say = (t) => { cap.firstChild.innerHTML = t; };
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; bStep.disabled = false; draw(); say('Press Play or Step to walk through this family. Watch for the red step: its classic failure mode.'); }
  function step() { const S = F[fam].steps; if (k >= S.length) return false; const [t, o] = S[k]; apply(o); phs.forEach((p, i) => p.classList.toggle('on', i === k)); say(t); k++; if (k >= S.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= F[fam].steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 600 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

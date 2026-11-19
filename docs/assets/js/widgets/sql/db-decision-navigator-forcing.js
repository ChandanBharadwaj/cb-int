/* Sortable / filterable table: where a single Postgres stops and what usually comes next. */
IA.widget('db-decision-navigator-forcing', (root, ctx) => {
  const { el } = ctx;
  const H = ['Need', 'Postgres answer', 'Rough limit (measure!)', 'Usual next step', 'Pattern'];
  const ROWS = [
    ['Relational OLTP, transactions', 'Core engine', 'Write rate a tuned node sustains; often tens of thousands of simple writes/s', 'Citus sharding or distributed SQL', 'oltp'],
    ['Read scaling', 'Streaming read replicas', 'Replica lag tolerance; writes still on one primary', 'More replicas, cache, then sharding', 'oltp'],
    ['Flexible documents', 'JSONB + GIN', 'Very large documents updated often (whole row rewritten)', 'Document store (MongoDB)', 'doc'],
    ['Full-text search', 'tsvector + GIN, pg_trgm', 'Relevance tuning, facets, fuzzy search at high QPS over large corpora', 'Elasticsearch / OpenSearch via CDC', 'search'],
    ['Similarity search', 'pgvector (HNSW / IVFFlat)', 'Vector count or QPS beyond one node’s memory / CPU', 'Dedicated vector DB', 'vector'],
    ['Time series', 'Range partitioning, BRIN, TimescaleDB', 'Very high ingest with long retention on one node', 'Timescale multi-node style setups, ClickHouse', 'ts'],
    ['Graph traversal', 'Recursive CTEs', 'Deep, variable-length traversals on large graphs', 'Neo4j (graph DB)', 'graph'],
    ['Analytics / BI', 'Replicas, materialized views, partitions', 'Scans of billions of rows; many concurrent heavy queries', 'Columnar: ClickHouse, BigQuery, Snowflake, Redshift', 'olap'],
    ['Hot key reads', 'Shared buffers + indexes', 'Sub-ms latency at very high QPS on few keys', 'Redis cache-aside', 'kv'],
    ['Multi-region writes', 'One primary + cross-region replicas', 'Must accept writes in two regions during a partition', 'CockroachDB / Spanner / YugabyteDB', 'geo'],
    ['Massive key-value writes', 'Partitioned tables', 'Sustained very high writes, eventual consistency OK, key access only', 'Cassandra / ScyllaDB / DynamoDB', 'kv'],
    ['Queues / events', 'SKIP LOCKED queue table, LISTEN/NOTIFY', 'High fan-out streaming, replay by many consumers', 'Kafka', 'events']
  ];
  const PAT = [['all', 'All'], ['oltp', 'OLTP'], ['doc', 'Docs'], ['search', 'Search'], ['vector', 'Vector'], ['ts', 'Time series'], ['graph', 'Graph'], ['olap', 'OLAP'], ['kv', 'Key-value'], ['geo', 'Geo'], ['events', 'Events']];
  let f = 'all', q = '', sortC = 0, dir = 1;
  const seg = el('div', { class: 'seg', 'aria-label': 'Filter by pattern' });
  PAT.forEach(([v, l]) => { const b = el('button', { text: l, class: v === f ? 'on' : '' }); b.addEventListener('click', () => { f = v; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); paint(); }); seg.append(b); });
  const inp = el('input', { type: 'search', placeholder: 'Filter text…', 'aria-label': 'Filter text', style: { padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)', color: 'var(--text)', maxWidth: '100%' } });
  inp.addEventListener('input', () => { q = inp.value.toLowerCase(); paint(); });
  const host = el('div', { class: 'tscroll' });
  const count = el('div', { class: 'tiny' });
  root.append(el('div', { class: 'w-controls' }, seg), el('div', { class: 'w-controls' }, inp), host, count);
  function paint() {
    const rows = ROWS.filter((r) => (f === 'all' || r[4] === f) && (!q || r.join(' ').toLowerCase().includes(q))).sort((a, b) => a[sortC].localeCompare(b[sortC]) * dir);
    const ths = H.slice(0, 4).map((h, i) => { const th = el('th', { text: h + (i === sortC ? (dir > 0 ? ' ▲' : ' ▼') : ''), style: { cursor: 'pointer' }, tabindex: '0', 'aria-sort': i === sortC ? (dir > 0 ? 'ascending' : 'descending') : 'none' });
      const go = () => { if (sortC === i) dir = -dir; else { sortC = i; dir = 1; } paint(); }; th.addEventListener('click', go); th.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }); return th; });
    host.innerHTML = ''; host.append(el('table', { class: 't rg' }, el('thead', null, el('tr', null, ths)), el('tbody', null, rows.map((r) => el('tr', null, r.slice(0, 4).map((c, i) => el('td', { html: i === 0 ? `<b>${c}</b>` : c })))))));
    count.textContent = `${rows.length} of ${ROWS.length} rows. Click a header to sort.`;
  }
  paint();
});

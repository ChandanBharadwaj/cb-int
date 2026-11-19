/* Sortable / filterable: each NoSQL family, its canonical use, failure mode, the Postgres feature that covers it, and where Postgres stops. */
IA.widget('sql-vs-nosql-matrix', (root, ctx) => {
  const { el } = ctx;
  const H = ['Family', 'Example', 'Canonical use', 'Classic failure mode', 'Postgres covers it with', 'Where Postgres stops'];
  const R = [
    ['Document', 'MongoDB', 'Catalog, CMS, aggregates read whole', 'Duplicated data drifts; unbounded arrays; 16 MB docs', 'jsonb + GIN, expression indexes', 'Native auto-sharding of documents; team already on Mongo'],
    ['Key-value', 'Redis, DynamoDB', 'Sessions, carts, rate limits, profiles', 'Hot partition; queries not by key', 'PK lookups, hash partitioning, UNLOGGED tables', 'Sub-ms reads at very high QPS (Redis); serverless scale (DynamoDB)'],
    ['Wide-column', 'Cassandra, ScyllaDB', 'Chat, events, IoT writes across DCs', 'Unmodelled queries, tombstones, huge partitions', 'Composite B-tree indexes, partitioning', 'Write rate beyond one primary; multi-DC writes'],
    ['Graph', 'Neo4j', 'Fraud rings, recommendations, paths', 'Supernodes; global aggregates; sharding', 'Edge tables + WITH RECURSIVE', 'Deep variable-length traversals on large graphs'],
    ['Search', 'Elasticsearch, OpenSearch', 'Product / log search, facets', 'Used as primary DB; NRT visibility; reindexing', 'tsvector + GIN, pg_trgm, unaccent', 'Relevance tuning, facets, typo tolerance at large scale'],
    ['Time-series', 'TimescaleDB, InfluxDB', 'Metrics, telemetry, prices', 'No time predicate scans all; high cardinality', 'Range partitioning, BRIN, TimescaleDB (extension)', 'Huge analytic scans: columnar stores like ClickHouse'],
    ['Vector', 'pgvector, dedicated vector DBs', 'RAG, semantic search, recommendations', 'Approximate recall; filtered k-NN returns too few', 'pgvector HNSW / IVFFlat', 'Very large collections or QPS beyond one node']
  ];
  let q = '', sortC = 0, dir = 1, cols = 'all';
  const inp = el('input', { type: 'search', placeholder: 'Filter…', 'aria-label': 'Filter', style: { padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)', color: 'var(--text)', maxWidth: '100%' } });
  inp.addEventListener('input', () => { q = inp.value.toLowerCase(); paint(); });
  const seg = el('div', { class: 'seg', 'aria-label': 'Columns' });
  [['all', 'All columns'], ['nosql', 'The family'], ['pg', 'Postgres view']].forEach(([v, l]) => { const b = el('button', { text: l, class: v === cols ? 'on' : '' }); b.addEventListener('click', () => { cols = v; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); paint(); }); seg.append(b); });
  const host = el('div', { class: 'tscroll' });
  root.append(el('div', { class: 'w-controls' }, seg, inp), host);
  function paint() {
    const C = cols === 'all' ? [0, 1, 2, 3, 4, 5] : cols === 'nosql' ? [0, 1, 2, 3] : [0, 4, 5];
    const rows = R.filter((r) => !q || r.join(' ').toLowerCase().includes(q)).sort((a, b) => a[sortC].localeCompare(b[sortC]) * dir);
    const ths = C.map((c) => { const th = el('th', { text: H[c] + (c === sortC ? (dir > 0 ? ' ▲' : ' ▼') : ''), tabindex: '0', style: { cursor: 'pointer' } }); const go = () => { if (sortC === c) dir = -dir; else { sortC = c; dir = 1; } paint(); }; th.addEventListener('click', go); th.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }); return th; });
    host.innerHTML = ''; host.append(el('table', { class: 't rg' }, el('thead', null, el('tr', null, ths)), el('tbody', null, rows.map((r) => el('tr', null, C.map((c) => el('td', { html: c === 0 ? `<b>${r[c]}</b>` : r[c], style: c === 3 ? { color: 'var(--err)' } : null })))))));
  }
  paint();
});

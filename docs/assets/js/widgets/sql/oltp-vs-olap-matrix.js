/* Sortable / filterable positioning table of OLAP engines (plus Postgres as the baseline). */
IA.widget('oltp-vs-olap-matrix', (root, ctx) => {
  const { el } = ctx;
  const H = ['Engine', 'Deployment', 'Storage / compute', 'Strong at', 'Watch out for'];
  const R = [
    ['Postgres (baseline)', 'Self-hosted / managed', 'Row store; replicas for isolation', 'Mixed workloads up to moderate size; rollups, BRIN, partitions', 'Large scans read whole rows; shares resources with OLTP'],
    ['ClickHouse', 'Open source self-hosted / managed cloud', 'Columnar MergeTree; shared-nothing (cloud: separated storage)', 'Very fast scans and aggregates, real-time ingest, logs/events', 'Updates/deletes are heavy; joins need care; ops if self-hosted'],
    ['Snowflake', 'Managed (AWS, Azure, GCP)', 'Separated storage and compute (virtual warehouses)', 'Concurrency via independent warehouses, data sharing, ELT', 'Credit-based cost can grow with idle or oversized warehouses'],
    ['BigQuery', 'Serverless (Google Cloud)', 'Separated; pay per bytes scanned or reserved slots', 'No cluster management, huge scans, ML/GIS functions', 'SELECT * and unpartitioned scans are expensive'],
    ['Redshift', 'Managed (AWS), provisioned or serverless', 'Columnar MPP; RA3 separates managed storage', 'AWS-native warehousing, Postgres-like SQL', 'Sort/dist keys and vacuum/analyze tuning on provisioned clusters'],
    ['DuckDB', 'Embedded library (in-process)', 'Columnar, vectorized, single machine', 'Local analytics, Parquet/CSV, notebooks, CI tests', 'Single-node; not a multi-user server']
  ];
  let q = '', sortC = 0, dir = 1, f = 'all';
  const seg = el('div', { class: 'seg', 'aria-label': 'Deployment' });
  [['all', 'All'], ['managed', 'Managed / serverless'], ['self', 'Self-hosted / embedded']].forEach(([v, l]) => { const b = el('button', { text: l, class: v === f ? 'on' : '' }); b.addEventListener('click', () => { f = v; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); paint(); }); seg.append(b); });
  const inp = el('input', { type: 'search', placeholder: 'Filter…', 'aria-label': 'Filter', style: { padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)', color: 'var(--text)', maxWidth: '100%' } });
  inp.addEventListener('input', () => { q = inp.value.toLowerCase(); paint(); });
  const host = el('div', { class: 'tscroll' });
  root.append(el('div', { class: 'w-controls' }, seg, inp), host);
  function paint() {
    const ok = (r) => f === 'all' || (f === 'managed' ? /managed|serverless/i.test(r[1]) : /self-hosted|embedded/i.test(r[1]));
    const rows = R.filter((r) => ok(r) && (!q || r.join(' ').toLowerCase().includes(q))).sort((a, b) => a[sortC].localeCompare(b[sortC]) * dir);
    const ths = H.map((h, c) => { const th = el('th', { text: h + (c === sortC ? (dir > 0 ? ' ▲' : ' ▼') : ''), tabindex: '0', style: { cursor: 'pointer' } }); const go = () => { if (sortC === c) dir = -dir; else { sortC = c; dir = 1; } paint(); }; th.addEventListener('click', go); th.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }); return th; });
    host.innerHTML = ''; host.append(el('table', { class: 't rg' }, el('thead', null, el('tr', null, ths)), el('tbody', null, rows.map((r) => el('tr', null, r.map((c, i) => el('td', { html: i === 0 ? `<b>${c}</b>` : c })))))));
  }
  paint();
});

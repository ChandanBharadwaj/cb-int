/* Sortable / filterable matrix: what each "distributed" product actually distributes. */
IA.widget('distributed-sql-matrix', (root, ctx) => {
  const { el } = ctx;
  const H = ['Product', 'What is distributed', 'Replication', 'Multi-region writes', 'SQL dialect', 'Pick it when', 'Watch out for'];
  const R = [
    ['Postgres + replicas + partitioning', 'Reads (replicas); table size (partitions)', 'Physical streaming, async or sync', 'No (one primary)', 'Postgres', 'Almost always first: one writer is enough', 'Failover is to a replica; async replicas can lose recent writes'],
    ['Amazon Aurora', 'Storage (6 copies, 3 AZs)', 'Quorum writes 4/6 in storage; Global Database for other regions', 'No (one writer)', 'Postgres or MySQL compatible', 'Managed Postgres with fast failover, low-lag readers', 'Writes don’t scale out; I/O-based pricing'],
    ['Citus', 'Tables sharded by a distribution column over worker nodes', 'Per-node Postgres replication (HA standbys)', 'No', 'Postgres (extension)', 'Multi-tenant SaaS, real-time analytics keyed by tenant/device', 'Cross-shard transactions and joins; picking the key'],
    ['CockroachDB', 'Ranges, each a Raft group; leaders spread over nodes', 'Raft (majority)', 'Yes, with locality (REGIONAL BY ROW, GLOBAL)', 'Postgres wire protocol, own engine', 'Strongly consistent multi-region OLTP', 'Retries (SERIALIZABLE), latency from placement, licence terms'],
    ['Google Spanner', 'Splits, each a Paxos group', 'Paxos + TrueTime', 'Yes', 'GoogleSQL or PostgreSQL dialect', 'Global OLTP on Google Cloud with external consistency', 'GCP only; commit wait; schema design for splits'],
    ['YugabyteDB', 'Tablets, each a Raft group', 'Raft (majority); async xCluster option', 'Yes', 'Reuses the Postgres query layer (YSQL); also Cassandra-like YCQL', 'Postgres-compatible distributed OLTP, self-hosted or managed', 'Feature/extension gaps vs Postgres; tablet hotspots']
  ];
  let q = '', sortC = 0, dir = 1, mw = 'all';
  const seg = el('div', { class: 'seg', 'aria-label': 'Multi-region writes' });
  [['all', 'All'], ['yes', 'Multi-region writes'], ['no', 'Single writer']].forEach(([v, l]) => { const b = el('button', { text: l, class: v === mw ? 'on' : '' }); b.addEventListener('click', () => { mw = v; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); paint(); }); seg.append(b); });
  const inp = el('input', { type: 'search', placeholder: 'Filter…', 'aria-label': 'Filter', style: { padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)', color: 'var(--text)', maxWidth: '100%' } });
  inp.addEventListener('input', () => { q = inp.value.toLowerCase(); paint(); });
  const host = el('div', { class: 'tscroll' });
  root.append(el('div', { class: 'w-controls' }, seg, inp), host);
  function paint() {
    const rows = R.filter((r) => (mw === 'all' || (mw === 'yes') === r[3].startsWith('Yes')) && (!q || r.join(' ').toLowerCase().includes(q))).sort((a, b) => a[sortC].localeCompare(b[sortC]) * dir);
    const ths = H.map((h, c) => { const th = el('th', { text: h + (c === sortC ? (dir > 0 ? ' ▲' : ' ▼') : ''), tabindex: '0', style: { cursor: 'pointer' } }); const go = () => { if (sortC === c) dir = -dir; else { sortC = c; dir = 1; } paint(); }; th.addEventListener('click', go); th.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }); return th; });
    host.innerHTML = ''; host.append(el('table', { class: 't rg' }, el('thead', null, el('tr', null, ths)), el('tbody', null, rows.map((r) => el('tr', null, r.map((c, i) => el('td', { html: i === 0 ? `<b>${c}</b>` : c })))))));
  }
  paint();
});

/* Filterable / sortable comparison matrix of the four relational engines. */
IA.widget('relational-compared-matrix', (root, ctx) => {
  const { el } = ctx;
  const E = ['PostgreSQL', 'MySQL (InnoDB)', 'Oracle', 'SQL Server'];
  const R = [
    ['Storage', 'Table layout', 'Heap; all indexes are secondary', 'Clustered on PK (always)', 'Heap by default; index-organized tables optional', 'Clustered index by default; heaps allowed'],
    ['Storage', 'Index points to', 'Physical TID (page, slot)', 'PK value', 'ROWID', 'Clustered key (or RID on heaps)'],
    ['MVCC', 'Old versions kept in', 'Table heap (dead tuples)', 'Undo log', 'Undo segments', 'Version store (tempdb, or in-DB with ADR); opt-in for RC'],
    ['MVCC', 'Cleanup', 'VACUUM / autovacuum, freezing', 'Purge threads', 'Undo retention', 'Version store cleanup'],
    ['MVCC', 'Default isolation', 'READ COMMITTED', 'REPEATABLE READ', 'READ COMMITTED', 'READ COMMITTED (locking unless RCSI)'],
    ['Replication', 'Built-in HA / replicas', 'Physical streaming; logical (PG10+)', 'Binlog async / semi-sync; Group Replication', 'Data Guard; RAC (shared disk)', 'Always On Availability Groups; log shipping'],
    ['Replication', 'Scale-out writes', 'Not in core; Citus extension', 'Vitess (external)', 'RAC shares one database across nodes', 'Not built in'],
    ['Features', 'Extensibility', 'Rich: custom types, index methods, extensions', 'Plugins; limited', 'Large built-in feature set', 'CLR integration; large built-in set'],
    ['Features', 'JSON', 'jsonb + GIN indexes', 'JSON type, generated-column indexes', 'JSON support (native type in recent releases)', 'JSON functions; native json type in newer versions'],
    ['Features', 'Process model', 'Process per connection: pool it', 'Thread per connection', 'Dedicated or shared server processes', 'Threads'],
    ['Cost', 'Licence', 'PostgreSQL Licence (permissive, free)', 'GPLv2 Community; commercial Enterprise', 'Commercial, per processor / named user; paid options', 'Commercial per core or server+CAL; free Express/Developer editions'],
    ['Ecosystem', 'Managed offerings', 'Every major cloud; many vendors', 'Every major cloud', 'Oracle Cloud; RDS for Oracle', 'Azure SQL; RDS for SQL Server'],
    ['Ecosystem', 'Typical home', 'New builds, startups, geospatial, AI features', 'Web/LAMP estates, high-volume simple OLTP', 'Large enterprises, ERP, banking', 'Microsoft/.NET enterprises, BI stack']
  ];
  const AREAS = ['All', 'Storage', 'MVCC', 'Replication', 'Features', 'Cost', 'Ecosystem'];
  let area = 'All', q = '', sortC = 0, dir = 1, show = new Set(E);
  const seg = el('div', { class: 'seg', 'aria-label': 'Area' });
  AREAS.forEach((a) => { const b = el('button', { text: a, class: a === area ? 'on' : '' }); b.addEventListener('click', () => { area = a; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); paint(); }); seg.append(b); });
  const eseg = el('div', { class: 'seg', 'aria-label': 'Engines shown' });
  E.forEach((e) => { const b = el('button', { text: e, class: 'on', 'aria-pressed': 'true' }); b.addEventListener('click', () => { if (show.has(e) && show.size > 1) show.delete(e); else show.add(e); b.classList.toggle('on', show.has(e)); b.setAttribute('aria-pressed', String(show.has(e))); paint(); }); eseg.append(b); });
  const inp = el('input', { type: 'search', placeholder: 'Search…', 'aria-label': 'Search', style: { padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)', color: 'var(--text)', maxWidth: '100%' } });
  inp.addEventListener('input', () => { q = inp.value.toLowerCase(); paint(); });
  const host = el('div', { class: 'tscroll' });
  root.append(el('div', { class: 'w-controls' }, seg), el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'engines' }), eseg), el('div', { class: 'w-controls' }, inp), host);
  function paint() {
    const cols = [0, 1, ...E.map((e, i) => (show.has(e) ? i + 2 : -1)).filter((i) => i >= 0)];
    const H = ['Area', 'Dimension', ...E];
    const rows = R.filter((r) => (area === 'All' || r[0] === area) && (!q || r.join(' ').toLowerCase().includes(q))).sort((a, b) => a[sortC].localeCompare(b[sortC]) * dir);
    const ths = cols.map((c) => { const th = el('th', { text: H[c] + (c === sortC ? (dir > 0 ? ' ▲' : ' ▼') : ''), tabindex: '0', style: { cursor: 'pointer' } }); const go = () => { if (sortC === c) dir = -dir; else { sortC = c; dir = 1; } paint(); }; th.addEventListener('click', go); th.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }); return th; });
    host.innerHTML = ''; host.append(el('table', { class: 't rg' }, el('thead', null, el('tr', null, ths)), el('tbody', null, rows.map((r) => el('tr', null, cols.map((c) => el('td', { html: c === 1 ? `<b>${r[c]}</b>` : r[c] })))))));
  }
  paint();
});

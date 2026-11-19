/* Index types comparison matrix: pick query needs, highlight types that serve all of them. */
IA.widget('index-types-matrix', (root, ctx) => {
  const { el } = ctx;
  if (!document.getElementById('w-ixm-css')) document.head.append(el('style', { id: 'w-ixm-css', text: `
.w-ixm table.t td,.w-ixm table.t th{text-align:center;white-space:nowrap}
.w-ixm table.t td:first-child,.w-ixm table.t th:first-child{text-align:left}
.w-ixm td.y{color:var(--ok);font-weight:700}
.w-ixm td.n{color:var(--text-3)}
.w-ixm td.p{color:var(--warn);font-weight:700}
.w-ixm tr.fit td{background:var(--accent-soft)}
.w-ixm tr.nofit td{opacity:.4}
.w-ixm th.sel{color:var(--accent)}
.w-ixm .chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}` }));
  const COLS = [
    ['eq', '= equality'], ['range', '< > BETWEEN'], ['order', 'ORDER BY'], ['prefix', "LIKE 'abc%'"], ['contains', '@> ? (contains)'],
    ['fts', '@@ full-text'], ['overlap', '&& overlap'], ['knn', '<-> nearest'], ['unique', 'UNIQUE'], ['multi', 'multi-column'], ['ios', 'index-only scan'], ['small', 'tiny size'], ['cheapw', 'cheap writes']];
  // y = yes, p = partly / with extension or opclass, n = no
  const ROWS = [
    ['B-tree', { eq: 'y', range: 'y', order: 'y', prefix: 'p', contains: 'n', fts: 'n', overlap: 'n', knn: 'n', unique: 'y', multi: 'y', ios: 'y', small: 'n', cheapw: 'y' }, 'Default. LIKE prefix needs C collation or text_pattern_ops.'],
    ['Hash', { eq: 'y', range: 'n', order: 'n', prefix: 'n', contains: 'n', fts: 'n', overlap: 'n', knn: 'n', unique: 'n', multi: 'n', ios: 'n', small: 'p', cheapw: 'y' }, 'Equality only; can beat B-tree size for long keys. WAL-logged since PG10.'],
    ['GIN', { eq: 'p', range: 'n', order: 'n', prefix: 'p', contains: 'y', fts: 'y', overlap: 'y', knn: 'n', unique: 'n', multi: 'y', ios: 'n', small: 'n', cheapw: 'n' }, 'Arrays (&& overlap too), jsonb, tsvector; LIKE/ILIKE \'%x%\' with pg_trgm. Expensive writes.'],
    ['GiST', { eq: 'p', range: 'p', order: 'n', prefix: 'n', contains: 'y', fts: 'y', overlap: 'y', knn: 'y', unique: 'n', multi: 'y', ios: 'p', small: 'p', cheapw: 'p' }, 'Ranges, geometry, exclusion constraints, KNN. Scalars via btree_gist.'],
    ['SP-GiST', { eq: 'y', range: 'p', order: 'n', prefix: 'y', contains: 'p', fts: 'n', overlap: 'p', knn: 'y', unique: 'n', multi: 'n', ios: 'p', small: 'p', cheapw: 'p' }, 'Quadtrees / radix tries: points, inet, text prefixes (^@).'],
    ['BRIN', { eq: 'p', range: 'y', order: 'n', prefix: 'n', contains: 'n', fts: 'n', overlap: 'p', knn: 'n', unique: 'n', multi: 'y', ios: 'n', small: 'y', cheapw: 'y' }, 'Only when the column correlates with physical order. Lossy.']
  ];
  const sel = new Set(['contains']);
  const chips = el('div', { class: 'chips' });
  const host = el('div', { class: 'tscroll' });
  const verdict = el('div', { class: 'caption' }, el('div', { class: 't' }));
  COLS.forEach(([id, l]) => { const b = el('button', { class: 'btn' + (sel.has(id) ? ' primary' : ''), text: l, 'aria-pressed': String(sel.has(id)) });
    b.addEventListener('click', () => { sel.has(id) ? sel.delete(id) : sel.add(id); b.classList.toggle('primary', sel.has(id)); b.setAttribute('aria-pressed', String(sel.has(id))); render(); }); chips.append(b); });
  const mark = { y: '✓', p: '◐', n: '–' };
  function render() {
    const fits = ROWS.filter(([, c]) => [...sel].every((s) => c[s] !== 'n'));
    const tb = el('tbody');
    ROWS.forEach(([name, c, note]) => { const ok = fits.some((f) => f[0] === name);
      tb.append(el('tr', { class: sel.size ? (ok ? 'fit' : 'nofit') : '', title: note }, el('td', { html: `<b>${name}</b>` }), ...COLS.map(([id]) => el('td', { class: c[id], text: mark[c[id]] })))); });
    host.innerHTML = '';
    host.append(el('table', { class: 't rg' }, el('thead', null, el('tr', null, el('th', { text: 'type' }), ...COLS.map(([id, l]) => el('th', { class: sel.has(id) ? 'sel' : '', text: l })))), tb));
    verdict.firstChild.innerHTML = !sel.size ? 'Pick one or more needs above.' : fits.length
      ? `Candidates: <b>${fits.map((f) => f[0]).join(', ')}</b>. ` + fits.map((f) => `<br>${f[0]}: ${f[2]}`).join('')
      : 'No single index type covers all of these. Use two indexes (Postgres can BitmapAnd them) or split the query.';
  }
  root.append(chips, host, el('div', { class: 'tiny', html: '✓ supported · ◐ partly / needs an opclass or extension · – no' }), verdict);
  render();
});

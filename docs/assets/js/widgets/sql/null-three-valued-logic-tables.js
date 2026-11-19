/* NULL truth tables: pick A and B, see every operator's result, and the full AND / OR / NOT tables with the cell highlighted. */
IA.widget('null-three-valued-logic-tables', (root, ctx) => {
  const { el } = ctx;
  const V = ['T', 'F', 'U']; const N = { T: 'TRUE', F: 'FALSE', U: 'NULL' };
  const and = (a, b) => (a === 'F' || b === 'F' ? 'F' : a === 'U' || b === 'U' ? 'U' : 'T');
  const or = (a, b) => (a === 'T' || b === 'T' ? 'T' : a === 'U' || b === 'U' ? 'U' : 'F');
  const not = (a) => (a === 'T' ? 'F' : a === 'F' ? 'T' : 'U');
  const eq = (a, b) => (a === 'U' || b === 'U' ? 'U' : a === b ? 'T' : 'F');
  const dist = (a, b) => (a === b ? 'F' : 'T');
  let A = 'T'; let B = 'U';
  const col = (v) => (v === 'T' ? 'var(--ok)' : v === 'F' ? 'var(--err)' : 'var(--warn)');
  const seg = (cur, on) => { const s = el('div', { class: 'seg' }); V.forEach((v) => { const b = el('button', { text: N[v], class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const out = el('div', { class: 'w-stats', style: { flexWrap: 'wrap' } });
  const tables = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '10px', marginTop: '10px' } });
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'A =' }), seg(A, (v) => { A = v; paint(); })),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'B =' }), seg(B, (v) => { B = v; paint(); })), out, tables);
  function table(title, fn) {
    return el('div', { class: 'tscroll' }, el('table', { class: 't rg' }, el('thead', null, el('tr', null, el('th', { text: title }), V.map((b) => el('th', { text: N[b] })))),
      el('tbody', null, V.map((a) => el('tr', null, el('th', { text: N[a] }), V.map((b) => { const r = fn(a, b); return el('td', { text: N[r] === 'NULL' ? 'UNKNOWN' : N[r], style: { color: col(r), fontWeight: a === A && b === B ? 800 : 400, background: a === A && b === B ? 'var(--accent-soft)' : '' } }); }))))));
  }
  function paint() {
    const R = [['A AND B', and(A, B)], ['A OR B', or(A, B)], ['NOT A', not(A)], ['A = B', eq(A, B)], ['A IS DISTINCT FROM B', dist(A, B)], ['A IS NULL', A === 'U' ? 'T' : 'F']];
    out.innerHTML = ''; R.forEach(([l, v]) => out.append(el('span', { class: 'w-stat', html: `<code>${l}</code> → <b style="color:${col(v)}">${v === 'U' ? 'UNKNOWN' : N[v]}</b>` })));
    tables.innerHTML = ''; tables.append(table('AND', and), table('OR', or), table('A = B', eq),
      el('div', { class: 'tscroll' }, el('table', { class: 't rg' }, el('thead', null, el('tr', null, el('th', { text: 'A' }), el('th', { text: 'NOT A' }))), el('tbody', null, V.map((a) => el('tr', null, el('th', { text: N[a] }), el('td', { text: not(a) === 'U' ? 'UNKNOWN' : N[not(a)], style: { color: col(not(a)), fontWeight: a === A ? 800 : 400, background: a === A ? 'var(--accent-soft)' : '' } })))))));
  }
  paint();
});

/* Correlated columns: city + zip estimates without / with extended statistics (numbers verified on the playground data). */
IA.widget('statistics-correlated', (root, ctx) => {
  const { el } = ctx;
  if (!document.getElementById('w-stats-c-css')) document.head.append(el('style', { id: 'w-stats-c-css', text: `
.w-stats-c-row { display: grid; grid-template-columns: 190px 1fr 70px; gap: 8px; align-items: center; margin: 6px 0; font-size: 14px; }
.w-stats-c-bar { height: 18px; border-radius: 5px; background: var(--text-3); transition: width .4s ease; min-width: 2px; }
.w-stats-c-row.act .w-stats-c-bar { background: var(--ok); }
.w-stats-c-row.cur { font-weight: 700; } .w-stats-c-row.cur .w-stats-c-bar { background: var(--accent); }
.w-stats-c-row.bad span:last-child { color: var(--err); }
@media (max-width: 520px) { .w-stats-c-row { grid-template-columns: 120px 1fr 56px; font-size: 12.5px; } }` }));
  // [label, zip, actual, none, dependencies, mcv]
  const Q = { match: ['z073 (a zip in city07)', 200, 10, 200, 200], mismatch: ['z123 (a zip in city12)', 0, 10, 200, 1] };
  let q = 'match'; let mode = 'none';
  const mkSeg = (items, cur, on) => { const s = el('div', { class: 'seg' }); items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const code = el('div', { class: 'codebox' }); const bars = el('div'); const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: "WHERE city = 'city07' AND zip =" }), mkSeg(Object.entries(Q).map(([k, v]) => [k, v[0]]), q, (v) => { q = v; draw(); })),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'extended statistics' }), mkSeg([['none', 'none'], ['dep', 'dependencies'], ['mcv', 'mcv']], mode, (v) => { mode = v; draw(); })), code, bars, cap);
  function draw() {
    const [, act, none, dep, mcv] = Q[q]; const z = q === 'match' ? 'z073' : 'z123';
    code.innerHTML = ''; code.append(el('pre', { html: IA.highlight((mode === 'none' ? '-- no extended statistics\n' : `CREATE STATISTICS s (${mode === 'dep' ? 'dependencies' : 'mcv'}) ON city, zip FROM people;\nANALYZE people;\n`) + `EXPLAIN SELECT * FROM people WHERE city = 'city07' AND zip = '${z}';`, 'sql') }));
    const max = 220; const rows = [['actual rows', act, 'act'], ['no extended stats', none, mode === 'none' ? 'cur' : ''], ['dependencies', dep, mode === 'dep' ? 'cur' : ''], ['mcv', mcv, mode === 'mcv' ? 'cur' : '']];
    bars.innerHTML = '';
    rows.forEach(([l, v, c]) => { const bad = c !== 'act' && (Math.max(v, 1) / Math.max(act, 1) >= 10 || Math.max(act, 1) / Math.max(v, 1) >= 10);
      bars.append(el('div', { class: `w-stats-c-row ${c}${bad ? ' bad' : ''}` }, el('span', { text: l }), el('div', null, el('div', { class: 'w-stats-c-bar', style: { width: (100 * v / max) + '%' } })), el('span', { text: 'rows=' + v }))); });
    const msg = {
      none: `Independence: P(city07) × P(${z}) = 0.05 × 0.01 = 0.0005 → 20,000 × 0.0005 = <b>10</b>. ${q === 'match' ? 'Real: 200. 20× too low, so the planner may pick a nested loop.' : 'Real: 0. Close by luck.'}`,
      dep: `Functional dependency zip ⇒ city with degree 1.0: P = P(zip) × (d + (1 − d) × P(city)) = 0.01 → <b>200</b>. ${q === 'match' ? 'Exact.' : 'But dependencies assume the values are <i>compatible</i>. z123 belongs to city12, so the real count is 0. Dependencies cannot see that.'}`,
      mcv: `The multi-column MCV list stores actual (city, zip) combinations and their frequencies. ${q === 'match' ? '(city07, z073) is in the list with frequency 0.01 → <b>200</b>.' : '(city07, z123) never occurs, so the estimate drops to <b>1</b> (the minimum). Only mcv catches impossible combinations.'}`
    };
    cap.firstChild.innerHTML = msg[mode];
  }
  draw();
});

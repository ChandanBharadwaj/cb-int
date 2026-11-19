/* Subqueries: how often does the inner query run? InitPlan once, SubPlan per row, or decorrelated into a hash join. */
IA.widget('subqueries', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-sq-style')) document.head.append(el('style', { id: 'w-sq-style', text: `
.w-sq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 560px) { .w-sq-grid { grid-template-columns: 1fr; } }
.w-sq-t td, .w-sq-t th { padding: 5px 9px; white-space: nowrap; transition: background .3s; }
.w-sq-t tr.cur td { background: var(--accent-soft); font-weight: 700; }
.w-sq-t tr.scan td { background: color-mix(in srgb, var(--warn) 22%, transparent); }
.w-sq-t td.ok { color: var(--ok); font-weight: 700; } .w-sq-t td.no { color: var(--text-3); }
.w-sq-box { border: 2px dashed var(--border); border-radius: 12px; padding: 10px; }
.w-sq-box.run { border-color: var(--warn); }
.w-sq-box.cached { border-color: var(--ok); border-style: solid; }` }));
  const O = [[101, 1, 250], [102, 1, 80], [103, 2, 40], [104, 2, 60], [105, 3, 99]];
  const REF = [102, 104];
  const MODES = {
    uncorr: { l: 'uncorrelated', sql: 'SELECT id FROM orders o\nWHERE amount > (SELECT avg(amount) FROM orders);', plan: 'InitPlan: runs once' },
    corr: { l: 'correlated', sql: 'SELECT id FROM orders o\nWHERE amount > (SELECT avg(amount) FROM orders o2\n                WHERE o2.customer_id = o.customer_id);', plan: 'SubPlan: runs per outer row' },
    exists: { l: 'EXISTS → semi join', sql: 'SELECT id FROM orders o\nWHERE EXISTS (SELECT 1 FROM refunds r\n              WHERE r.order_id = o.id);', plan: 'pulled up: Hash Semi Join' },
    select: { l: 'scalar in SELECT', sql: 'SELECT id,\n  (SELECT count(*) FROM orders o2\n   WHERE o2.customer_id = o.customer_id) AS n\nFROM orders o;', plan: 'SubPlan in target list: per row' }
  };
  let mode = 'corr'; let scale = 5; let speed = 2400; let gen = 0; let running = false; let k = 0; let execs = 0; let read = 0; let cache = null;
  const seg = (label, items, cur, on) => { const s = el('div', { class: 'seg', 'aria-label': label });
    items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segM = seg('Query shape', Object.entries(MODES).map(([v, m]) => [v, m.l]), mode, (v) => { mode = v; reset(); });
  const segN = seg('Outer rows', [[5, '5 outer rows'], [1e6, 'imagine 1,000,000']], scale, (v) => { scale = v; reset(); });
  const segS = seg('Speed', [[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const sqlBox = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const outerT = el('tbody'); const innerT = el('tbody'); const innerHead = el('div', { class: 'kicker', text: 'inner query' }); const innerVal = el('div', { class: 'tiny' });
  const innerBox = el('div', { class: 'w-sq-box' }, innerHead, el('div', { class: 'tscroll' }, el('table', { class: 't rg w-sq-t' }, el('thead', null, el('tr', null)), innerT)), innerVal);
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: '' })); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-controls' }, segN), sqlBox,
    el('div', { class: 'w-sq-grid' }, el('div', null, el('div', { class: 'kicker', text: 'outer: orders o' }), el('div', { class: 'tscroll' }, el('table', { class: 't rg w-sq-t' }, el('thead', null, el('tr', null, ['id', 'cust', 'amt', 'kept?'].map((h) => el('th', { text: h })))), outerT))), innerBox),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const res = {};
  function innerRows() { return mode === 'exists' ? REF.map((r) => [r]) : O; }
  function render(cur, scanned) {
    outerT.innerHTML = '';
    O.forEach((r, i) => outerT.append(el('tr', { class: i === cur ? 'cur' : '' }, el('td', { text: String(r[0]) }), el('td', { text: String(r[1]) }), el('td', { text: String(r[2]) }),
      el('td', { class: res[i] == null ? '' : res[i] === true ? 'ok' : res[i] === false ? 'no' : 'ok', text: res[i] == null ? '·' : res[i] === true ? 'yes' : res[i] === false ? 'no' : String(res[i]) }))));
    const head = innerBox.querySelector('thead tr'); head.innerHTML = ''; (mode === 'exists' ? ['refunds.order_id'] : ['id', 'cust', 'amt']).forEach((h) => head.append(el('th', { text: h })));
    innerT.innerHTML = ''; innerRows().forEach((r, j) => innerT.append(el('tr', { class: scanned && scanned.includes(j) ? 'scan' : '' }, r.map((v) => el('td', { text: String(v) })))));
    const f = (n) => (scale === 5 ? String(n) : n.toLocaleString('en-US'));
    const mult = (n) => (scale === 5 ? n : Math.round(n * scale / 5));
    const ex = mode === 'uncorr' || mode === 'exists' ? Math.min(execs, 1) : mult(execs);
    stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `inner executions <b>${f(ex)}</b>` }), el('span', { class: 'w-stat', html: `plan <b>${MODES[mode].plan}</b>` }));
  }
  function step() {
    const M = mode;
    if (k === 0 && (M === 'uncorr' || M === 'exists')) { k = 0.5; execs = 1;
      if (M === 'uncorr') { cache = O.reduce((a, r) => a + r[2], 0) / O.length; innerBox.className = 'w-sq-box cached'; innerVal.textContent = `avg = ${cache} (cached for the whole query)`; render(null, O.map((r, j) => j));
        narr.firstChild.textContent = 'The subquery doesn’t mention the outer row, so Postgres runs it ONCE up front as an InitPlan and keeps the value.'; }
      else { innerBox.className = 'w-sq-box cached'; innerVal.textContent = 'hash table built: {102, 104}'; render(null, [0, 1]);
        narr.firstChild.textContent = 'EXISTS is decorrelated: the planner turns it into a semi join. It scans refunds once and builds a hash table on order_id.'; }
      return true; }
    const i = Math.floor(k); if (i >= O.length) return false; k = i + 1;
    const r = O[i];
    if (M === 'uncorr') { res[i] = r[2] > cache; render(i, []); narr.firstChild.textContent = `Order ${r[0]}: ${r[2]} > ${cache}? ${res[i] ? 'yes' : 'no'}. No re-execution; the cached value is reused.`; }
    else if (M === 'exists') { res[i] = REF.includes(r[0]); render(i, res[i] ? [REF.indexOf(r[0])] : []); narr.firstChild.textContent = `Order ${r[0]}: one hash probe → ${res[i] ? 'found, keep it (once, even if several refunds match)' : 'not found, drop it'}.`; }
    else { execs++; innerBox.className = 'w-sq-box run'; const sc = O.map((x, j) => j).filter((j) => O[j][1] === r[1]); const sub = sc.map((j) => O[j][2]);
      if (M === 'corr') { const a = sub.reduce((p, q) => p + q, 0) / sub.length; res[i] = r[2] > a; innerVal.textContent = `customer ${r[1]}: avg = ${a}`;
        narr.firstChild.textContent = `Order ${r[0]}: re-run the subquery with o.customer_id = ${r[1]} → avg ${a}. ${r[2]} > ${a}? ${res[i] ? 'yes' : 'no'}.${i > 0 && O[i - 1][1] === r[1] ? ' Same customer as the previous row, computed again anyway.' : ''}`; }
      else { res[i] = sub.length; innerVal.textContent = `customer ${r[1]}: count = ${sub.length}`; narr.firstChild.textContent = `Row ${r[0]}: the scalar subquery runs again for this row (count = ${sub.length}). One extra query per output row: an N+1 hiding inside one SQL statement.`; }
      render(i, sc); }
    if (k >= O.length) { bStep.disabled = true; narr.firstChild.textContent += M === 'corr' || M === 'select' ? ` Done: ${scale === 5 ? 5 : '1,000,000'} executions of the inner query. Rewrite as a join to a GROUP BY or a window function to make it one pass.` : ' Done: the inner side was read once.'; }
    return true;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; execs = 0; cache = null; Object.keys(res).forEach((x) => delete res[x]); bStep.disabled = false; innerBox.className = 'w-sq-box'; innerVal.textContent = '';
    innerHead.textContent = mode === 'exists' ? 'inner: refunds r' : 'inner: orders o2';
    sqlBox.innerHTML = ''; sqlBox.append(el('pre', { html: IA.highlight(MODES[mode].sql, 'sql') })); render(null, []);
    narr.firstChild.textContent = 'Press Play and watch how many times the inner query executes.';
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= O.length) reset(); running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 600 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

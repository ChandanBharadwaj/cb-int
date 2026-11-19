/* GROUP BY buckets: rows routed through WHERE into region buckets, aggregates, HAVING, ROLLUP grand total with GROUPING(). */
IA.widget('grouping', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-grp-css')) document.head.append(el('style', { id: 'w-grp-css', text: `
.w-grp-lay { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: 14px; }
@media (max-width: 640px) { .w-grp-lay { grid-template-columns: 1fr; } }
.w-grp table { border-collapse: collapse; font-family: var(--mono); font-size: 12.5px; width: 100%; }
.w-grp td, .w-grp th { border: 1px solid var(--border); padding: 4px 7px; text-align: left; }
.w-grp th { background: var(--surface-2); color: var(--text-3); font-weight: 600; }
.w-grp h5 { margin: 0 0 4px; font-family: var(--mono); font-size: 13px; }
.w-grp tr.cur td { background: var(--accent-soft); }
.w-grp tr.rej td { opacity: .35; text-decoration: line-through; }
.w-grp tr.done td { color: var(--text-3); }
.w-grp .nul { color: var(--err); font-style: italic; }
.w-grp .bk { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; }
.w-grp .b { border: 2px solid var(--border); border-radius: 10px; padding: 6px 8px; background: var(--surface); min-height: 96px; font-family: var(--mono); font-size: 12px; }
.w-grp .b.hot { border-color: var(--accent); background: var(--accent-soft); }
.w-grp .b.out { opacity: .35; border-style: dashed; }
.w-grp .b.tot { border-color: var(--warn); }
.w-grp .b .k { font-weight: 700; font-size: 13px; margin-bottom: 4px; }
.w-grp .b .gv { display: inline-block; padding: 1px 6px; margin: 2px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--border); }
.w-grp .b .gv.new { animation: capin .35s ease both; border-color: var(--accent); }
.w-grp .b .agg { margin-top: 6px; border-top: 1px dashed var(--border); padding-top: 4px; color: var(--text-2); }
` }));
  const S = [[1, 'EU', 'pen', 50, 'paid'], [2, 'US', 'pen', 120, 'paid'], [3, 'EU', 'ink', 30, 'refunded'], [4, null, 'pen', 40, 'paid'], [5, 'US', 'mug', 20, 'paid'], [6, 'EU', 'mug', 90, 'paid'], [7, null, 'ink', 15, 'refunded'], [8, 'US', 'ink', 60, 'refunded']];
  const KEYS = ['EU', 'US', null];
  let where = true; let having = false; let rollup = false; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (label, opts, cur, pick) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); pick(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const sqlBox = el('div', { class: 'codebox', style: { marginBottom: '10px' } }); const left = el('div'); const right = el('div'); const resHost = el('div', { class: 'tscroll' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('span', { class: 'n', text: '0' }), el('div', { class: 't' }));
  root.classList.add('w-grp');
  root.append(el('div', { class: 'w-controls' }, seg('WHERE', [[true, "WHERE status = 'paid'"], [false, 'no WHERE']], where, (v) => { where = v; reset(); }),
    seg('HAVING', [[false, 'no HAVING'], [true, 'HAVING sum > 100']], having, (v) => { having = v; reset(); }), seg('ROLLUP', [[false, 'GROUP BY region'], [true, 'GROUP BY ROLLUP (region)']], rollup, (v) => { rollup = v; reset(); })),
    sqlBox, el('div', { class: 'w-stage' }, el('div', { class: 'w-grp-lay' }, left, right)),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg('Speed', [[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; })),
    narr, el('h5', { text: 'result', style: { margin: '12px 0 4px', fontFamily: 'var(--mono)' } }), resHost);
  const kname = (r) => (r == null ? 'NULL' : r);
  function build() {
    const out = []; const B = new Map(KEYS.map((x) => [x, []])); const rej = new Set(); const st = { phase: 'route', aggs: false, gone: new Set(), total: false };
    const snap = (o) => out.push({ ...o, B: new Map([...B].map(([kk, v]) => [kk, v.slice()])), rej: new Set(rej), aggs: st.aggs, gone: new Set(st.gone), total: st.total });
    S.forEach((r, i) => {
      if (where && r[4] !== 'paid') { rej.add(i); snap({ i, why: `Row ${r[0]} (${kname(r[1])}, ${r[3]}, ${r[4]}): WHERE status = 'paid' is false. Rejected before grouping; no bucket ever sees it.` }); return; }
      B.get(r[1]).push(r); snap({ i, hot: r[1], why: `Row ${r[0]}: region ${kname(r[1])} → bucket ${kname(r[1])}.${r[1] == null ? ' NULL is a bucket key like any other: all NULL regions land together.' : ''}` });
    });
    st.aggs = true;
    const sum = (kk) => B.get(kk).reduce((a, r) => a + r[3], 0);
    snap({ why: 'Aggregates run once per bucket: count(*) and sum(amount). Each bucket now collapses to one row.' });
    if (rollup) { st.total = true; snap({ hot: 'TOTAL', why: `ROLLUP adds the grand total: all ${[...B.values()].flat().length} surviving rows, region shown as NULL with GROUPING(region) = 1. The other NULL row is a real data value, with GROUPING = 0.` }); }
    if (having) {
      KEYS.forEach((kk) => { if (sum(kk) <= 100) st.gone.add(kk); });
      if (rollup && [...B.values()].flat().reduce((a, r) => a + r[3], 0) <= 100) st.gone.add('TOTAL');
      snap({ why: `HAVING sum(amount) > 100 runs after aggregation, on whole groups: ${st.gone.size ? [...st.gone].map(kname).join(', ') + ' removed' : 'none removed'}.${rollup ? ' It also applies to the ROLLUP total row.' : ''}` });
    }
    return out;
  }
  const cell = (v, n) => el('td', { class: v == null && n ? 'nul' : '', text: v == null ? (n ? 'NULL' : '') : String(v) });
  function render(upto) {
    const s = upto ? steps[upto - 1] : null; const lastI = s ? (s.i != null ? s.i : S.length) : -1;
    const tb = el('tbody'); S.forEach((r, i) => tb.append(el('tr', { class: s && s.rej.has(i) && i <= lastI ? 'rej' : s && i === s.i ? 'cur' : i < lastI ? 'done' : '' }, cell(r[0]), cell(r[1], true), cell(r[2]), cell(r[3]), cell(r[4]))));
    left.innerHTML = ''; left.append(el('h5', { text: 'sales' }), el('div', { class: 'tscroll' }, el('table', null, el('thead', null, el('tr', null, ['id', 'region', 'product', 'amt', 'status'].map((h) => el('th', { text: h })))), tb)));
    const bk = el('div', { class: 'bk' });
    const card = (kk, rows, isTot) => { const sum = rows.reduce((a, r) => a + r[3], 0);
      return el('div', { class: 'b' + (s && s.hot === (isTot ? 'TOTAL' : kk) ? ' hot' : '') + (isTot ? ' tot' : '') + (s && s.gone.has(isTot ? 'TOTAL' : kk) ? ' out' : '') },
        el('div', { class: 'k', html: isTot ? 'NULL <span class="tiny">GROUPING=1 (total)</span>' : kk == null ? '<span class="nul">NULL</span> <span class="tiny">GROUPING=0 (data)</span>' : kk }),
        el('div', null, isTot ? el('span', { class: 'tiny', text: 'all buckets' }) : rows.map((r) => el('span', { class: 'gv' + (s && s.i != null && S[s.i] === r && !reduced ? ' new' : ''), text: r[3] }))),
        s && s.aggs ? el('div', { class: 'agg', text: `count ${rows.length} · sum ${sum}` }) : null); };
    KEYS.forEach((kk) => bk.append(card(kk, s ? s.B.get(kk) : [], false)));
    if (s && s.total) bk.append(card(null, [...s.B.values()].flat(), true));
    right.innerHTML = ''; right.append(el('h5', { text: 'buckets' }), bk);
    const rb = el('tbody');
    if (s && s.aggs) {
      const rows = KEYS.map((kk) => [kk, 0, s.B.get(kk)]).concat(s.total ? [[null, 1, [...s.B.values()].flat()]] : []);
      rows.forEach(([kk, g, rs]) => { if (s.gone.has(g ? 'TOTAL' : kk)) return; rb.append(el('tr', null, cell(kk, true), el('td', { text: String(g) }), el('td', { text: String(rs.length) }), el('td', { text: String(rs.reduce((a, r) => a + r[3], 0)) }))); });
    }
    resHost.innerHTML = ''; resHost.append(el('table', { class: 't rg' }, el('thead', null, el('tr', null, ['region', 'GROUPING(region)', 'count', 'sum'].map((h) => el('th', { text: h })))), rb));
  }
  function say(n, t) { narr.firstChild.textContent = String(n); narr.replaceChild(el('div', { class: 't', text: t }), narr.lastChild); }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = build(); render(0); bStep.disabled = false;
    const sql = `SELECT region, GROUPING(region), count(*), sum(amount)\nFROM sales\n${where ? "WHERE status = 'paid'\n" : ''}GROUP BY ${rollup ? 'ROLLUP (region)' : 'region'}${having ? '\nHAVING sum(amount) > 100' : ''};`;
    sqlBox.innerHTML = ''; sqlBox.append(el('pre', { html: IA.highlight(sql, 'sql') }));
    say(0, 'FROM → WHERE → GROUP BY → aggregates → HAVING. Press Play to route each row.');
  }
  function step() {
    if (k >= steps.length) return false; const s = steps[k++]; render(k); say(k, s.why);
    if (k >= steps.length) bStep.disabled = true;
    return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 600 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

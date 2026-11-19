/* LATERAL top-N: animated nested loop. Per customer, run the parameterized subquery via index (read N, stop) or seq scan + sort. */
IA.widget('lateral-top-n', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-lat-css')) document.head.append(el('style', { id: 'w-lat-css', text: `
.w-lat-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: 14px; }
@media (max-width: 560px) { .w-lat-grid { grid-template-columns: 1fr; } }
.w-lat table { border-collapse: collapse; font-family: var(--mono); font-size: 12.5px; width: 100%; }
.w-lat td, .w-lat th { border: 1px solid var(--border); padding: 4px 7px; text-align: left; }
.w-lat th { background: var(--surface-2); color: var(--text-3); font-weight: 600; }
.w-lat h5 { margin: 0 0 4px; font-family: var(--mono); font-size: 13px; }
.w-lat tr.cur td { background: var(--accent-soft); }
.w-lat tr.read td { background: color-mix(in srgb, var(--warn) 22%, transparent); }
.w-lat tr.take td { background: color-mix(in srgb, var(--ok) 26%, transparent); font-weight: 700; }
.w-lat tr.range td:first-child { box-shadow: inset 3px 0 0 var(--accent); }
.w-lat tr.idle td { color: var(--text-3); }
.w-lat .nul { color: var(--err); font-style: italic; }
.w-lat .sub { font-family: var(--mono); font-size: 12px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 6px 9px; margin-bottom: 8px; white-space: pre-wrap; color: var(--text-2); }
.w-lat .sub b { color: var(--accent); }
` }));
  const C = [[1, 'Asha'], [2, 'Ben'], [3, 'Chen'], [4, 'Dina']];
  const O = [[101, 1, '01-05'], [102, 1, '02-11'], [103, 1, '03-02'], [104, 1, '03-02'], [105, 2, '01-20'], [106, 2, '02-28'], [107, 4, '02-01'], [108, 4, '02-15'], [109, 4, '03-09']];
  const IDX = O.slice().sort((a, b) => a[1] - b[1] || (b[2] > a[2] ? 1 : b[2] < a[2] ? -1 : b[0] - a[0]));
  let N = 2; let left = false; let idx = true; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (label, opts, cur, pick) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); pick(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const sqlBox = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const outer = el('div'); const inner = el('div'); const resHost = el('div', { class: 'tscroll' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('span', { class: 'n', text: '0' }), el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-lat');
  root.append(
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'LIMIT' }), seg('N', [[1, '1'], [2, '2'], [3, '3']], N, (v) => { N = v; reset(); }),
      seg('Join', [[false, 'CROSS JOIN LATERAL'], [true, 'LEFT JOIN LATERAL … ON true']], left, (v) => { left = v; reset(); })),
    el('div', { class: 'w-controls' }, seg('Index', [[true, 'index (customer_id, created_at DESC)'], [false, 'no index']], idx, (v) => { idx = v; reset(); })),
    sqlBox, el('div', { class: 'w-stage' }, el('div', { class: 'w-lat-grid' }, outer, inner)),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg('Speed', [[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; })),
    narr, el('h5', { text: 'result', style: { margin: '12px 0 4px' } }), resHost, stats);

  function build() {
    const out = []; let read = 0;
    C.forEach(([id, name], ci) => {
      const mine = IDX.filter((o) => o[1] === id); const take = mine.slice(0, N);
      const r = idx ? take.length : O.length; read += r;
      const probeWhy = idx
        ? `Loop ${ci + 1}: c.id = ${id}. Descend the index to (${id}, newest). ${mine.length ? `Entries are already newest-first: read ${take.length}, then Limit stops.` : 'The range is empty: nothing to read.'}`
        : `Loop ${ci + 1}: c.id = ${id}. No usable index: scan all ${O.length} orders, keep ${mine.length} with customer_id = ${id}, sort them by created_at DESC, keep ${take.length}.`;
      out.push({ ci, phase: 'probe', mine, take, read, why: probeWhy });
      const rows = take.length ? take.map((o) => [name, o[0], o[2]]) : left ? [[name, null, null]] : [];
      const emitWhy = take.length ? `Emit ${take.length} row${take.length > 1 ? 's' : ''} for ${name}${mine.length > N ? ` (${mine.length - N} older order${mine.length - N > 1 ? 's' : ''} never touched${idx ? '' : ', but they were still scanned and sorted'})` : ''}.`
        : left ? `${name}’s subquery is empty. LEFT JOIN … ON true keeps the customer, padded with NULLs.` : `${name}’s subquery is empty. CROSS JOIN LATERAL drops the customer, just like an inner join.`;
      out.push({ ci, phase: 'emit', mine, take, rows, read, why: emitWhy });
    });
    return out;
  }
  const cell = (v) => v == null ? el('td', { class: 'nul', text: 'NULL' }) : el('td', { text: String(v) });
  function render(upto) {
    const s = upto ? steps[upto - 1] : null; const res = [];
    for (let i = 0; i < upto; i++) if (steps[i].rows) res.push(...steps[i].rows);
    const ob = el('tbody'); C.forEach(([id, name], ci) => ob.append(el('tr', { class: s && s.ci === ci ? 'cur' : '' }, cell(id), cell(name))));
    outer.innerHTML = ''; outer.append(el('h5', { text: 'customers c (outer loop)' }), el('table', null, el('thead', null, el('tr', null, el('th', { text: 'id' }), el('th', { text: 'name' }))), ob));
    const cid = s ? C[s.ci][0] : null;
    const sub = el('div', { class: 'sub', html: `SELECT … WHERE customer_id = <b>${cid == null ? 'c.id' : cid}</b>\nORDER BY created_at DESC, id DESC LIMIT <b>${N}</b>` });
    const ib = el('tbody'); const list = idx ? IDX : O;
    list.forEach((o) => { let cls = 'idle';
      if (s) { const mine = o[1] === cid; const tk = s.take.includes(o);
        if (idx) cls = tk ? 'take range' : mine ? 'range' : 'idle';
        else cls = tk && s.phase === 'emit' ? 'take' : tk || mine ? 'read range' : 'read'; }
      ib.append(el('tr', { class: cls }, cell(o[1]), cell('2026-' + o[2]), cell(o[0]))); });
    inner.innerHTML = '';
    inner.append(el('h5', { text: idx ? 'index orders(customer_id, created_at DESC)' : 'orders heap (seq scan, then sort)' }), sub,
      el('table', null, el('thead', null, el('tr', null, el('th', { text: 'customer_id' }), el('th', { text: 'created_at' }), el('th', { text: 'order id' }))), ib));
    const rb = el('tbody'); res.forEach((r) => rb.append(el('tr', null, r.map(cell))));
    resHost.innerHTML = ''; resHost.append(el('table', { class: 't rg' }, el('thead', null, el('tr', null, ['name', 'o.id', 'created_at'].map((h) => el('th', { text: h })))), rb));
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `loops <b>${s ? s.ci + 1 : 0}</b> / ${C.length}` }), el('span', { class: 'w-stat', html: `order rows read <b>${s ? s.read : 0}</b>` }),
      el('span', { class: 'w-stat', html: `result rows <b>${res.length}</b>` }));
  }
  function say(n, t) { narr.firstChild.textContent = String(n); narr.replaceChild(el('div', { class: 't', text: t }), narr.lastChild); }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = build(); render(0); bStep.disabled = false;
    const sql = `SELECT c.name, o.id, o.created_at\nFROM customers c\n${left ? 'LEFT JOIN' : 'CROSS JOIN'} LATERAL (\n  SELECT id, created_at FROM orders o\n  WHERE o.customer_id = c.id\n  ORDER BY created_at DESC, id DESC\n  LIMIT ${N}) o${left ? ' ON true' : ''};`;
    sqlBox.innerHTML = ''; sqlBox.append(el('pre', { html: IA.highlight(sql, 'sql') }));
    say(0, `Plan: Nested Loop → for each customer → Limit → ${idx ? 'Index Scan (customer_id = c.id)' : 'Sort → Seq Scan (Filter: customer_id = c.id)'}. Press Play.`);
  }
  function step() {
    if (k >= steps.length) return false; const s = steps[k++]; render(k); say(k, s.why);
    if (k >= steps.length) { bStep.disabled = true; const best = C.reduce((a, [id]) => a + Math.min(N, O.filter((o) => o[1] === id).length), 0);
      say(k, s.why + ` Done: ${s.read} order rows read${idx ? ` (the minimum possible: ${best})` : ` vs ${best} with the index. With 200M orders, that gap is the whole incident`}.`); }
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

/* Join fan-out: per-order expansion 1 → N → N×M, live aggregates vs truth; DISTINCT band-aid and pre-aggregate fix. */
IA.widget('join-fan-out', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-fan-css')) document.head.append(el('style', { id: 'w-fan-css', text: `
.w-fan table { border-collapse: collapse; font-family: var(--mono); font-size: 12.5px; width: 100%; }
.w-fan td, .w-fan th { border: 1px solid var(--border); padding: 4px 7px; text-align: left; }
.w-fan th { background: var(--surface-2); color: var(--text-3); font-weight: 600; }
.w-fan h5 { margin: 0 0 4px; font-family: var(--mono); font-size: 13px; }
.w-fan .src { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
@media (max-width: 560px) { .w-fan .src { grid-template-columns: 1fr 1fr; } }
.w-fan tr.cur td { background: var(--accent-soft); }
.w-fan tr.g1 td:first-child { box-shadow: inset 4px 0 0 var(--accent); }
.w-fan tr.g2 td:first-child { box-shadow: inset 4px 0 0 var(--warn); }
.w-fan tr.g3 td:first-child { box-shadow: inset 4px 0 0 var(--ok); }
.w-fan tr.fresh td { animation: capin .35s ease both; }
.w-fan .rep { color: var(--err); font-weight: 700; }
.w-fan .mult { font-family: var(--mono); font-size: 22px; font-weight: 700; text-align: center; margin: 8px 0; color: var(--accent); }
.w-fan .w-stat.bad b { color: var(--err); } .w-fan .w-stat.good b { color: var(--ok); }
` }));
  const O = [[1, 100], [2, 50], [3, 50]];
  const I = [[1, 1, 'pen'], [2, 1, 'ink'], [3, 1, 'pad'], [4, 2, 'mug'], [5, 3, 'cap'], [6, 3, 'hat']];
  const P = [[1, 1, 60], [2, 1, 40], [3, 2, 50], [4, 3, 50]];
  const SQL = {
    items: 'SELECT sum(o.total), count(i.id)\nFROM orders o\nJOIN order_items i ON i.order_id = o.id;',
    both: 'SELECT sum(o.total), sum(p.amount), count(i.id)\nFROM orders o\nJOIN order_items i ON i.order_id = o.id\nJOIN payments p    ON p.order_id = o.id;',
    distinct: 'SELECT count(DISTINCT i.id), sum(DISTINCT p.amount)\nFROM orders o\nJOIN order_items i ON i.order_id = o.id\nJOIN payments p    ON p.order_id = o.id;',
    pre: 'SELECT sum(o.total), sum(p.paid), sum(i.n)\nFROM orders o\nJOIN (SELECT order_id, count(*) n FROM order_items GROUP BY 1) i ON i.order_id = o.id\nJOIN (SELECT order_id, sum(amount) paid FROM payments GROUP BY 1) p ON p.order_id = o.id;'
  };
  let mode = 'both'; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (label, opts, cur, pick) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); pick(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const sqlBox = el('div', { class: 'codebox', style: { marginBottom: '10px' } }); const src = el('div', { class: 'src' }); const mult = el('div', { class: 'mult', text: '' }); const resHost = el('div', { class: 'tscroll' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('span', { class: 'n', text: '0' }), el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-fan');
  root.append(el('div', { class: 'w-controls' }, seg('Query', [['items', '⨝ items'], ['both', '⨝ items ⨝ payments'], ['distinct', 'DISTINCT band-aid'], ['pre', 'pre-aggregate fix']], mode, (v) => { mode = v; reset(); })),
    sqlBox, el('div', { class: 'w-stage' }, src, mult, resHost),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg('Speed', [[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; })), narr, stats);

  function build() {
    const out = []; const rows = [];
    const snap = (o) => out.push({ ...o, rows: rows.slice() });
    if (mode === 'pre') {
      const n = {}; I.forEach(([, oid]) => { n[oid] = (n[oid] || 0) + 1; }); const pd = {}; P.forEach(([, oid, a]) => { pd[oid] = (pd[oid] || 0) + a; });
      snap({ hi: { I: true }, m: '6 items → 3 rows', why: 'First reduce order_items to the order grain: GROUP BY order_id gives exactly one row per order (n = 3, 1, 2).' });
      snap({ hi: { P: true }, m: '4 payments → 3 rows', why: 'Same for payments: one row per order (paid = 100, 50, 50). Both derived tables are now unique on order_id.' });
      O.forEach(([oid, tot]) => { rows.push({ g: oid, oid, tot, sku: 'n=' + n[oid], amt: pd[oid] }); snap({ cur: oid, m: `order ${oid}: 1 → 1 → 1`, why: `Order ${oid} joins exactly one items row and one payments row. The join cannot multiply anything.` }); });
      return out;
    }
    O.forEach(([oid, tot]) => {
      const its = I.filter((x) => x[1] === oid); const ps = P.filter((x) => x[1] === oid);
      if (mode === 'items') {
        its.forEach((it) => rows.push({ g: oid, oid, tot, sku: it[2], iid: it[0] }));
        snap({ cur: oid, m: `order ${oid}: 1 → ${its.length}`, why: `Order ${oid} has ${its.length} item${its.length > 1 ? 's' : ''}, so it appears on ${its.length} row${its.length > 1 ? 's' : ''}. Its total (${tot}) is copied onto each one${its.length > 1 ? ` and will be summed ${its.length}×` : ''}.` });
      } else {
        const tmp = its.map((it) => ({ g: oid, oid, tot, sku: it[2], iid: it[0] }));
        snap({ cur: oid, m: `order ${oid}: 1 → ${its.length}`, why: `Join items: order ${oid} becomes ${its.length} row${its.length > 1 ? 's' : ''}.`, pending: tmp });
        its.forEach((it) => ps.forEach((p) => rows.push({ g: oid, oid, tot, sku: it[2], iid: it[0], amt: p[2] })));
        snap({ cur: oid, m: `order ${oid}: 1 → ${its.length} → ${its.length * ps.length}`, why: `Now join payments: each of those ${its.length} row${its.length > 1 ? 's' : ''} pairs with each of ${ps.length} payment${ps.length > 1 ? 's' : ''}: ${its.length} × ${ps.length} = ${its.length * ps.length}. Items and payments are unrelated, so you get every combination.` });
      }
    });
    return out;
  }
  const cell = (v, cls) => el('td', { class: cls || '', text: v == null ? '' : String(v) });
  function measures(rows) {
    const sumT = rows.reduce((a, r) => a + r.tot, 0);
    if (mode === 'pre') return [['sum(o.total)', sumT, 200], ['sum(paid)', rows.reduce((a, r) => a + r.amt, 0), 200], ['sum(n)', rows.reduce((a, r) => a + +r.sku.slice(2), 0), 6]];
    if (mode === 'items') return [['sum(o.total)', sumT, 200], ['count(i.id)', rows.length, 6]];
    if (mode === 'distinct') return [['count(DISTINCT i.id)', new Set(rows.map((r) => r.iid)).size, 6], ['sum(DISTINCT p.amount)', [...new Set(rows.map((r) => r.amt))].reduce((a, b) => a + b, 0), 200]];
    return [['sum(o.total)', sumT, 200], ['sum(p.amount)', rows.reduce((a, r) => a + r.amt, 0), 200], ['count(i.id)', rows.length, 6]];
  }
  function render(upto) {
    const s = upto ? steps[upto - 1] : null;
    const mini = (t, head, data, hiKey, ok) => el('div', null, el('h5', { text: t }), el('table', null, el('thead', null, el('tr', null, head.map((h) => el('th', { text: h })))),
      el('tbody', null, data.map((r) => el('tr', { class: (s && ((s.cur && r[hiKey] === s.cur) || (s.hi && s.hi[ok]))) ? 'cur' : '' }, r.map((v) => cell(v)))))));
    src.innerHTML = ''; src.append(mini('orders', ['id', 'total'], O, 0, 'O'), mini('order_items', ['id', 'order', 'sku'], I, 1, 'I'), mini('payments', ['id', 'order', 'amt'], P, 1, 'P'));
    mult.textContent = s ? s.m : (mode === 'pre' ? 'aggregate first, then join' : 'rows per order: 1 → ?');
    const rows = s ? (s.pending ? s.rows.concat(s.pending) : s.rows) : [];
    const seen = new Set(); const tb = el('tbody');
    rows.forEach((r) => { const rep = seen.has(r.oid); seen.add(r.oid);
      tb.append(el('tr', { class: 'g' + r.g + (s && r.oid === s.cur && !reduced ? ' fresh' : '') }, cell(r.oid), cell(r.tot, rep && mode !== 'pre' ? 'rep' : ''), cell(r.sku), mode === 'items' ? null : cell(r.amt == null ? '…' : r.amt))); });
    const head = ['o.id', 'o.total', mode === 'pre' ? 'i.n' : 'i.sku'].concat(mode === 'items' ? [] : [mode === 'pre' ? 'p.paid' : 'p.amount']);
    resHost.innerHTML = ''; resHost.append(el('h5', { text: `joined rows (${rows.length})` }), el('table', null, el('thead', null, el('tr', null, head.map((h) => el('th', { text: h })))), tb));
    stats.innerHTML = '';
    const m = measures(s ? s.rows : []); const fin = upto === steps.length;
    m.forEach(([n, v, t]) => stats.append(el('span', { class: 'w-stat' + (fin ? (v === t ? ' good' : ' bad') : ''), html: `${n} <b>${v}</b> <span class="tiny">truth ${t}</span>` })));
  }
  function say(n, t) { narr.firstChild.textContent = String(n); narr.replaceChild(el('div', { class: 't', text: t }), narr.lastChild); }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = build(); render(0); bStep.disabled = false;
    sqlBox.innerHTML = ''; sqlBox.append(el('pre', { html: IA.highlight(SQL[mode], 'sql') }));
    say(0, 'Press Play. Red totals in the result are copies of the same order’s value.');
  }
  function step() {
    if (k >= steps.length) return false; const s = steps[k++]; render(k); say(k, s.why);
    if (k >= steps.length) { bStep.disabled = true;
      const end = { items: 'Done: sum(o.total) = 450, not 200. The row count (6 items) is right, but the order-level measure is counted once per item.',
        both: 'Done: 9 rows from 3 orders. Revenue 750, payments 450, item count 9: every measure is wrong, and nothing raised an error.',
        distinct: 'Done: COUNT(DISTINCT i.id) = 6 is right, but SUM(DISTINCT p.amount) = 150: the two real 50 payments collapsed into one. A band-aid that hides the bug.',
        pre: 'Done: 3 rows, every measure equals the truth. Aggregate to the parent grain first, then join 1:1.' };
      say(k, end[mode]); }
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

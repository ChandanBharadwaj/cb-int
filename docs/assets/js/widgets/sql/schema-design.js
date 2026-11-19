/* Schema design: animated decomposition from a spreadsheet-style table through 1NF, 2NF, 3NF, and optional denormalization for reads. */
IA.widget('schema-design', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-sd-style')) {
    document.head.append(el('style', { id: 'w-sd-style', text: `
.w-sd .mini-tables table { font-size: 12px; }
.w-sd .mini-tables td, .w-sd .mini-tables th { padding: 3px 6px; }
.w-sd th.pk { color: var(--accent); } .w-sd th.fk { color: var(--ok); }
.w-sd td.dup { background: color-mix(in srgb, var(--warn) 22%, transparent); }
.w-sd td.multi { background: color-mix(in srgb, var(--err) 18%, transparent); }
.w-sd td.calc, .w-sd th.calc { background: var(--accent-soft); }
.w-sd .mt { animation: capin .4s ease both; }
` }));
  }
  let goal = 'read'; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segG = seg([['write', 'stop at 3NF (OLTP)'], ['read', 'then denormalize for a hot read']], () => goal, (v) => { goal = v; reset(); }, 'Goal');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const stage = el('div', { class: 'mini-tables', style: { justifyContent: 'flex-start' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-sd');
  root.append(el('div', { class: 'w-controls' }, segG), el('div', { class: 'tscroll', style: { padding: '10px', border: '0' } }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  // table spec: { name, cols: [[name, 'pk'|'fk'|'calc'|'']], rows: [[...]], mark: (r, c) => class }
  const T = (name, cols, rows, mark) => ({ name, cols, rows, mark });
  function show(tables, st) {
    stage.innerHTML = '';
    tables.forEach((t) => stage.append(el('div', { class: 'mt' }, el('h5', { text: t.name }),
      el('table', null, el('thead', null, el('tr', null, t.cols.map(([c, k2]) => el('th', { class: k2 || '', text: (k2 === 'pk' ? '🔑 ' : k2 === 'fk' ? '→ ' : '') + c })))),
        el('tbody', null, t.rows.map((r, i) => el('tr', null, r.map((v, j) => el('td', { class: t.mark ? t.mark(i, j) || '' : '', text: String(v) })))))))));
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `rows to update when Asha moves: <b>${st.move}</b>` }), el('span', { class: 'w-stat', html: `tables <b>${tables.length}</b>` }), el('span', { class: 'w-stat', html: `joins to print an order <b>${st.joins}</b>` }));
  }
  const RAW = T('orders (spreadsheet)', [['order', ''], ['customer', ''], ['city', ''], ['items', '']],
    [[1, 'Asha', 'Pune', 'kettle×2 @30, mug×1 @8'], [2, 'Ben', 'Austin', 'mug×4 @8'], [3, 'Asha', 'Pune', 'kettle×1 @30']], (i, j) => j === 3 ? 'multi' : '');
  const NF1 = T('order_lines', [['order_id', 'pk'], ['product_id', 'pk'], ['product', ''], ['price', ''], ['qty', ''], ['customer', ''], ['city', '']],
    [[1, 10, 'kettle', 30, 2, 'Asha', 'Pune'], [1, 11, 'mug', 8, 1, 'Asha', 'Pune'], [2, 11, 'mug', 8, 4, 'Ben', 'Austin'], [3, 10, 'kettle', 30, 1, 'Asha', 'Pune']],
    (i, j) => (j === 5 || j === 6) && [0, 1, 3].includes(i) ? 'dup' : (j === 2 || j === 3) ? 'dup' : '');
  const ITEMS = T('order_items', [['order_id', 'pk'], ['product_id', 'pk'], ['qty', '']], [[1, 10, 2], [1, 11, 1], [2, 11, 4], [3, 10, 1]]);
  const PRODUCTS = T('products', [['id', 'pk'], ['name', ''], ['price', '']], [[10, 'kettle', 30], [11, 'mug', 8]]);
  const ORD2 = T('orders', [['id', 'pk'], ['customer', ''], ['city', '']], [[1, 'Asha', 'Pune'], [2, 'Ben', 'Austin'], [3, 'Asha', 'Pune']], (i, j) => j === 2 && i !== 1 ? 'dup' : '');
  const ORD3 = T('orders', [['id', 'pk'], ['customer_id', 'fk']], [[1, 1], [2, 2], [3, 1]]);
  const CUST = T('customers', [['id', 'pk'], ['name', ''], ['city', '']], [[1, 'Asha', 'Pune'], [2, 'Ben', 'Austin']]);
  const ORD4 = T('orders', [['id', 'pk'], ['customer_id', 'fk'], ['total', 'calc'], ['item_count', 'calc']], [[1, 1, 68, 3], [2, 2, 32, 4], [3, 1, 30, 1]], (i, j) => j >= 2 ? 'calc' : '');
  function plan() {
    const s = [
      { tables: [RAW], st: { move: 2, joins: 0 }, t: 'Start: what a spreadsheet export looks like. The <b>items</b> cell holds a list (red), so you can’t index, constrain or join it. This is not even in <b>first normal form</b>.' },
      { tables: [NF1], st: { move: 3, joins: 0 }, t: '<b>1NF</b>: one value per cell, one row per order line. Key = (order_id, product_id). But look at the yellow cells: product and customer data repeat on every line. Change Asha’s city and you must update 3 rows. Miss one and the data contradicts itself (an <b>update anomaly</b>).' },
      { tables: [ITEMS, PRODUCTS, ORD2], st: { move: 2, joins: 2 }, t: '<b>2NF</b>: no column may depend on just <i>part</i> of the key. Product name and price depend only on product_id, so they move to <code>products</code>. Customer and city depend only on order_id, so they move to <code>orders</code>. Only qty needs the whole key.' },
      { tables: [ITEMS, PRODUCTS, ORD3, CUST], st: { move: 1, joins: 3 }, t: '<b>3NF</b>: no column may depend on another non-key column. city depends on the customer, not on the order (a <b>transitive</b> dependency), so customers become their own table. Asha’s move is now a 1-row update. “Every non-key column depends on the key, the whole key, and nothing but the key.”' }
    ];
    if (goal === 'read') s.push({ tables: [ITEMS, PRODUCTS, ORD4, CUST], st: { move: 1, joins: 1 }, t: '<b>Denormalize on purpose</b>: the order list page shows totals 10,000 times a second. Storing <code>total</code> and <code>item_count</code> on orders (blue) avoids a join and an aggregate on every read. The price: you must keep them correct (same transaction, trigger, or a materialized view refreshed on a schedule). Normalize first, then denormalize where a measured read path needs it.' });
    else s.push({ tables: [ITEMS, PRODUCTS, ORD3, CUST], st: { move: 1, joins: 3 }, t: 'For OLTP, 3NF is the usual target: each fact lives in exactly one place, so constraints can protect it. Note that <code>order_items</code> should also store the <b>price at the time of sale</b>: that is a different fact from the current product price, not duplication.' });
    return s;
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = plan(); bStep.disabled = false; show([RAW], { move: 2, joins: 0 }); say('An orders “table” copied from a spreadsheet. Press Play to normalize it step by step.'); k = 1; }
  function step() { if (k >= steps.length) return false; const x = steps[k++]; show(x.tables, x.st); say(x.t); if (k >= steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => { if (running) { running = false; bPlay.textContent = '▶ Play'; return; } if (k >= steps.length) reset(); running = true; bPlay.textContent = '⏸ Pause'; const g = gen; while (running && g === gen && step()) await sleep(reduced ? 700 : speed); if (g === gen) { running = false; bPlay.textContent = '▶ Play'; } });
  reset();
});

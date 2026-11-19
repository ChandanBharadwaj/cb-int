/* Transactional vs analytical vs event data: one checkout feeds three lanes. */
IA.widget('transactional-data', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-txd-css')) document.head.append(el('style', { id: 'w-txd-css', text: `
.w-txd-lanes{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin:10px 0}
.w-txd-lane{border:1px solid var(--border);border-radius:10px;background:var(--surface);padding:8px 10px;min-width:0}
.w-txd-lane.on{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}
.w-txd-lane h5{margin:0;font-size:13px;color:var(--text)}
.w-txd-lane .tiny{display:block;margin-bottom:6px}
.w-txd-rows{font-family:var(--mono);font-size:12px;display:flex;flex-direction:column;gap:3px}
.w-txd-r{border:1px solid var(--border);border-radius:5px;padding:2px 6px;background:var(--surface-2);overflow-wrap:anywhere;transition:all .3s}
.w-txd-r.new{border-color:var(--accent);background:var(--accent-soft)}
.w-txd-r.gone{text-decoration:line-through;opacity:.45;border-color:var(--err)}
.w-txd-r.ok{border-color:var(--ok)}
.w-txd-bars{display:flex;align-items:flex-end;gap:6px;height:70px;margin-top:6px}
.w-txd-bars div{flex:1;background:var(--accent);opacity:.7;border-radius:3px 3px 0 0;position:relative;transition:height .5s}
.w-txd-bars span{position:absolute;bottom:-16px;left:0;right:0;text-align:center;font-size:10px;color:var(--text-3)}` }));
  let outcome = 'ok'; let gen = 0; let k = 0; let running = false; let speed = 2400; let steps = [];
  const seg = (opts, cur, on) => { const s = el('div', { class: 'seg' }); opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segO = seg([['ok', 'payment succeeds'], ['fail', 'payment fails mid-way']], outcome, (v) => { outcome = v; reset(); });
  const lane = (t, d) => { const rows = el('div', { class: 'w-txd-rows' }); const n = el('div', { class: 'w-txd-lane' }, el('h5', { text: t }), el('span', { class: 'tiny', text: d }), rows); return { n, rows }; };
  const L = { tx: lane('① Transactional (OLTP)', 'current state · small writes · ACID'), ev: lane('② Event log', 'append-only · immutable · ordered'), an: lane('③ Analytical (OLAP)', 'history · big scans · aggregates') };
  const bars = el('div', { class: 'w-txd-bars' });
  L.an.n.append(bars);
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; });
  const num = el('span', { class: 'n', text: '0' });
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, num, el('div', { class: 't' }));
  const say = (h) => cap.replaceChild(el('div', { class: 't', html: h }), cap.lastChild);
  root.append(el('div', { class: 'w-controls' }, segO), el('div', { class: 'w-txd-lanes' }, L.tx.n, L.ev.n, L.an.n),
    el('div', { class: 'w-controls' }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), cap);
  const R = {};
  const row = (lane, id, txt, cls) => { const r = el('div', { class: 'w-txd-r ' + (cls || ''), text: txt }); L[lane].rows.append(r); R[id] = r; return r; };
  const DAYS = [['Mon', 30], ['Tue', 44], ['Wed', 38], ['Thu', 52]];
  function drawBars(extra) { bars.innerHTML = ''; DAYS.forEach(([d, v], i) => { const h = i === 3 ? v + extra : v; bars.append(el('div', { style: { height: h + 'px' } }, el('span', { text: d }))); }); }
  function plan() {
    const ok = outcome === 'ok';
    const s = [
      { lane: 'tx', run: () => row('tx', 'b', 'BEGIN;', 'new'), cap: 'The user clicks <b>Pay</b>. The service opens a <b>transaction</b>: everything until COMMIT happens all-or-nothing.' },
      { lane: 'tx', run: () => row('tx', 'o', "INSERT orders (77, 'Asha', 24.00, 'NEW')", 'new'), cap: 'A small write: one new order row. OLTP work touches a handful of rows by primary key, thousands of times a second.' },
      { lane: 'tx', run: () => { R.st.textContent = 'stock TEAPOT: 5 → 4'; R.st.classList.add('new'); }, cap: 'Decrement stock. This is <b>current state</b>: the row is updated in place; the old value 5 is gone from this table.' },
      { lane: 'tx', run: () => row('tx', 'ob', 'INSERT outbox (OrderPlaced #77)', 'new'), cap: 'Write the event into an <b>outbox</b> table in the <i>same</i> transaction, so the event exists only if the order does.' }
    ];
    if (ok) {
      s.push({ lane: 'tx', run: () => { row('tx', 'c', 'COMMIT ✓', 'ok'); Object.values(R).forEach((r) => r.classList.remove('new')); }, cap: '<b>COMMIT</b>. Atomic, consistent, isolated from other checkouts, durable once the WAL is flushed: that is ACID.' });
      s.push({ lane: 'ev', run: () => row('ev', 'e', 'offset 1042  OrderPlaced {id:77, total:24.00}', 'new'), cap: 'A relay publishes the outbox row to an <b>event log</b> (e.g. Kafka). Events are appended, never updated: “order 77 was placed at 09:30”.' });
      s.push({ lane: 'ev', run: () => row('ev', 'e2', 'offset 1043  StockReserved {sku:TEAPOT, qty:1}', 'new'), cap: 'Each fact is a new entry with a growing offset. Consumers can replay the log from any offset to rebuild state.' });
      s.push({ lane: 'an', run: () => row('an', 'f', 'fact_sales += (2026-03-05, TEAPOT, 24.00)', 'new'), cap: 'The warehouse loads events into a <b>fact table</b>. It keeps <b>history</b>: every sale ever, not just current stock.' });
      s.push({ lane: 'an', run: () => drawBars(14), cap: 'Analysts run <b>big scans with aggregates</b>: <code>SUM(amount) GROUP BY day</code> over millions of rows. Different workload, often a different engine (columnar).' });
    } else {
      s.push({ lane: 'tx', run: () => { row('tx', 'r', 'ROLLBACK ✗ (card declined)', 'gone'); ['o', 'ob'].forEach((x) => R[x].classList.add('gone')); R.st.textContent = 'stock TEAPOT: 5'; R.st.classList.remove('new'); }, cap: 'Payment fails, so <b>ROLLBACK</b>. The order insert, the stock change and the outbox row all vanish together. Atomicity.' });
      s.push({ lane: 'ev', run: () => row('ev', 'none', '(nothing published)', ''), cap: 'No committed outbox row means no event. Had the service published to Kafka <i>before</i> commit, consumers would see an order that never existed.' });
      s.push({ lane: 'an', run: () => row('an', 'none2', '(no new fact)', ''), cap: 'The warehouse only ever sees committed facts. Revenue stays correct. If you want failed payments analysed, emit a separate PaymentFailed event.' });
    }
    return s;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = plan();
    Object.values(L).forEach((l) => { l.rows.innerHTML = ''; l.n.classList.remove('on'); }); Object.keys(R).forEach((x) => delete R[x]);
    row('tx', 'st', 'stock TEAPOT: 5'); row('ev', 'e0', 'offset 1041  OrderPlaced {id:76, …}'); drawBars(0);
    num.textContent = '0/' + steps.length; bStep.disabled = false;
    say('One checkout, three kinds of data. Press Play, then try “payment fails” to see what a rollback does to each lane.');
  }
  function step() { if (k >= steps.length) return false; const s = steps[k++]; Object.entries(L).forEach(([n, l]) => l.n.classList.toggle('on', n === s.lane)); s.run(); say(s.cap); num.textContent = k + '/' + steps.length; if (k >= steps.length) bStep.disabled = true; return true; }
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

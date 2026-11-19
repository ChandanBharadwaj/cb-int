/* Why SQL: declarative vs imperative. You say WHAT; the planner weighs plans and picks HOW. */
IA.widget('why-sql', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-wsq-css')) document.head.append(el('style', { id: 'w-wsq-css', text: `
.w-wsq-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin:10px 0}
.w-wsq-box{border:1px solid var(--border);border-radius:10px;background:var(--surface);padding:8px 10px;min-width:0}
.w-wsq-box h5{margin:0 0 6px;font-size:12px;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em}
.w-wsq-box pre{margin:0;font-family:var(--mono);font-size:12px;white-space:pre-wrap;word-break:break-word}
.w-wsq-plan{display:grid;grid-template-columns:minmax(0,9em) 1fr minmax(0,5em);gap:4px 8px;align-items:center;font-size:12.5px;padding:4px 6px;border-radius:6px;transition:all .3s;opacity:.35}
.w-wsq-plan.show{opacity:1}
.w-wsq-plan.win{background:var(--accent-soft);outline:1px solid var(--accent)}
.w-wsq-plan.no{text-decoration:line-through;opacity:.35}
.w-wsq-bar{height:10px;border-radius:5px;background:var(--text-3);width:0;transition:width .6s}
.w-wsq-plan.win .w-wsq-bar{background:var(--accent)}
.w-wsq-plan b{font-family:var(--mono);font-weight:600}` }));
  let rows = 'big'; let idx = 'yes'; let sel = 'few'; let gen = 0; let k = 0; let running = false; let speed = 2400; let steps = [];
  const seg = (opts, cur, on) => { const s = el('div', { class: 'seg' }); opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segR = seg([['small', 'table: 50 rows'], ['big', 'table: 10M rows']], rows, (v) => { rows = v; reset(); });
  const segI = seg([['yes', 'index on city'], ['no', 'no index']], idx, (v) => { idx = v; reset(); });
  const segF = seg([['few', "city = 'Pune' (0.1%)"], ['many', "city = 'Delhi' (60%)"]], sel, (v) => { sel = v; reset(); });
  const sqlBox = el('div', { class: 'w-wsq-box' }, el('h5', { text: 'You write: WHAT' }), el('pre'));
  const javaBox = el('div', { class: 'w-wsq-box' }, el('h5', { text: 'Imperative alternative: HOW, hard-coded' }), el('pre', { text: 'List<Customer> out = new ArrayList<>();\nfor (Customer c : allCustomers())   // always a full loop\n  if (c.city().equals(city)) out.add(c);\nout.sort(comparing(Customer::name));' }));
  const planHost = el('div', { class: 'w-wsq-box' }, el('h5', { text: 'Planner: candidate plans and estimated cost' }));
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; });
  const num = el('span', { class: 'n', text: '0' });
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, num, el('div', { class: 't' }));
  const say = (h) => cap.replaceChild(el('div', { class: 't', html: h }), cap.lastChild);
  root.append(el('div', { class: 'w-controls' }, segR), el('div', { class: 'w-controls' }, segI), el('div', { class: 'w-controls' }, segF),
    el('div', { class: 'w-wsq-cols' }, sqlBox, javaBox), planHost,
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), cap);
  let P = [];
  function candidates() {
    // illustrative relative costs, shaped like Postgres' choices
    const big = rows === 'big'; const few = sel === 'few';
    const c = [{ n: 'Seq Scan', d: 'read every row, test city', cost: big ? 100 : 3 }];
    if (idx === 'yes') {
      c.push({ n: 'Index Scan', d: 'walk the index, fetch each match', cost: big ? (few ? 4 : 260) : 4 });
      c.push({ n: 'Bitmap Heap Scan', d: 'collect matches, read pages in order', cost: big ? (few ? 6 : 115) : 5 });
    }
    return c;
  }
  function plan() {
    P = candidates(); const best = P.reduce((a, b) => (b.cost < a.cost ? b : a));
    const why = best.n === 'Seq Scan'
      ? (rows === 'small' ? 'The table fits in a page or two. Reading it all is cheaper than touching an index first.' : idx === 'no' ? 'No index exists, so a full scan is the only access path.' : '60% of rows match. Jumping around via the index would read most pages anyway, randomly. A sequential read wins.')
      : best.n === 'Index Scan' ? 'Only ~0.1% of 10M rows match. The index finds them directly.' : 'Matches spread over many pages; a bitmap reads each page once in physical order.';
    return [
      { cap: 'You state <b>what</b> you want: rows from customers in a city, sorted by name. Nothing about loops, files or indexes.', run: () => {} },
      { cap: 'The parser checks the text; the rewriter expands views. Then the <b>planner</b> lists the ways it could fetch the rows.', run: () => planRows.forEach((r) => r.node.classList.add('show')) },
      { cap: 'It estimates each plan’s cost from table statistics (<code>pg_class.reltuples</code>, <code>pg_stats</code> histograms of <code>city</code>).', run: () => planRows.forEach((r) => { r.bar.style.width = Math.min(100, r.c.cost / 2.6) + '%'; }) },
      { cap: `Cheapest wins: <b>${best.n}</b>. ${why}`, run: () => planRows.forEach((r) => r.node.classList.add(r.c === best ? 'win' : 'no')) },
      { cap: 'The Java loop would do the same thing every time. SQL’s plan changes when data or indexes change, <b>without touching the query</b>. Flip the toggles and play again.', run: () => {} }
    ];
  }
  let planRows = [];
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = plan();
    sqlBox.lastChild.innerHTML = IA.highlight(`SELECT name, email\nFROM customers\nWHERE city = '${sel === 'few' ? 'Pune' : 'Delhi'}'\nORDER BY name;`, 'sql');
    while (planHost.children.length > 1) planHost.lastChild.remove();
    planRows = P.map((c) => { const bar = el('div', { class: 'w-wsq-bar' }); const node = el('div', { class: 'w-wsq-plan' }, el('b', { text: c.n }), el('div', null, el('div', { class: 'tiny', text: c.d }), bar), el('span', { class: 'tiny', text: 'cost ≈ ' + c.cost })); planHost.append(node); return { node, bar, c }; });
    planHost.append(el('div', { class: 'tiny', text: 'Costs are illustrative; run EXPLAIN for real numbers.', style: { marginTop: '4px' } }));
    num.textContent = '0/' + steps.length; bStep.disabled = false;
    say('Set the table size, index and filter, then press Play to see which plan the planner picks.');
  }
  function step() { if (k >= steps.length) return false; const s = steps[k++]; s.run(); say(s.cap); num.textContent = k + '/' + steps.length; if (k >= steps.length) bStep.disabled = true; return true; }
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

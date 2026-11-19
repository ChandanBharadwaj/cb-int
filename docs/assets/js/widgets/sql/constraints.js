/* Constraints: animated ON DELETE actions rippling through customers → orders → order_items. */
IA.widget('constraints', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-con-css')) document.head.append(el('style', { id: 'w-con-css', text: `
.w-con .rb{fill:var(--surface);stroke:var(--border);transition:all .35s}
.w-con .rb.hot{stroke:var(--accent);stroke-width:2;fill:var(--accent-soft)}
.w-con .rb.del{stroke:var(--err);stroke-dasharray:4 3;fill:color-mix(in srgb,var(--err) 12%,transparent)}
.w-con .rb.nul{stroke:var(--warn);stroke-width:2}
.w-con .rb.err{stroke:var(--err);stroke-width:3}
.w-con .lk{stroke:var(--border);stroke-width:1.5;fill:none;transition:all .35s}
.w-con .lk.hot{stroke:var(--accent);stroke-width:2.5}
.w-con .lk.gone{opacity:.15}
.w-con text.del{text-decoration:line-through;opacity:.5}` }));
  root.classList.add('w-con');
  const CU = [{ id: 1, n: 'Asha' }, { id: 2, n: 'Ben' }, { id: 3, n: 'Chen' }];
  const OR = [{ id: 101, c: 1 }, { id: 102, c: 1 }, { id: 103, c: 2 }, { id: 104, c: 3 }];
  const IT = [{ id: 1, o: 101, s: 'TEA' }, { id: 2, o: 101, s: 'MUG' }, { id: 3, o: 102, s: 'POT' }, { id: 4, o: 103, s: 'TEA' }, { id: 5, o: 104, s: 'CUP' }];
  let oAct = 'CASCADE'; let iAct = 'CASCADE'; let gen = 0; let k = 0; let running = false; let speed = 2400; let steps = [];
  const seg = (opts, cur, on) => { const s = el('div', { class: 'seg' }); opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const A = ['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION'].map((a) => [a, a]);
  const segO = seg(A, oAct, (v) => { oAct = v; reset(); });
  const segI = seg(A.filter(([a]) => a !== 'SET NULL'), iAct, (v) => { iAct = v; reset(); });
  const ddl = el('div', { class: 'codebox', style: { marginBottom: '8px' } });
  const W = 760, RH = 36, TOP = 50;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${TOP + RH * 5 + 10}`, role: 'img', 'aria-label': 'Customers, orders and order_items with foreign-key links; deleting a customer ripples through them' });
  const stats = el('div', { class: 'w-stats' });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; });
  const num = el('span', { class: 'n', text: '0' });
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, num, el('div', { class: 't' }));
  const say = (h) => cap.replaceChild(el('div', { class: 't', html: h }), cap.lastChild);
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'orders.customer_id ON DELETE' }), segO),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'order_items.order_id ON DELETE' }), segI), ddl,
    el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), cap, stats);
  const X = { c: 20, o: 280, i: 540 }; const BW = 200;
  const R = { c: {}, o: {}, i: {} }; const L = { o: {}, i: {} };
  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 13, fill: 'var(--text)', text: t }, o || {}));
  function draw() {
    stage.innerHTML = '';
    const links = svg('g'); stage.append(links);
    [['c', 'customers'], ['o', 'orders'], ['i', 'order_items']].forEach(([k2, t]) => stage.append(T(X[k2] + 4, 22, t, { 'font-weight': 700, 'font-size': 14 })));
    const row = (k2, j, label, id) => { const y = TOP + j * RH; const r = svg('rect', { class: 'rb', x: X[k2], y, width: BW, height: RH - 8, rx: 6 }); const t = T(X[k2] + 10, y + 19, label, { 'font-family': 'var(--mono)', 'font-size': 12.5 }); stage.append(r, t); R[k2][id] = { r, t, y: y + (RH - 8) / 2 }; };
    CU.forEach((c, j) => row('c', j, `id ${c.id} · ${c.n}`, c.id));
    OR.forEach((o, j) => row('o', j, `id ${o.id} · customer_id ${o.c}`, o.id));
    IT.forEach((it, j) => row('i', j, `id ${it.id} · order_id ${it.o} · ${it.s}`, it.id));
    OR.forEach((o) => { const a = R.c[o.c], b = R.o[o.id]; const p = svg('path', { class: 'lk', d: `M${X.o} ${b.y} C ${X.o - 30} ${b.y}, ${X.c + BW + 30} ${a.y}, ${X.c + BW} ${a.y}` }); links.append(p); L.o[o.id] = p; });
    IT.forEach((it) => { const a = R.o[it.o], b = R.i[it.id]; const p = svg('path', { class: 'lk', d: `M${X.i} ${b.y} C ${X.i - 30} ${b.y}, ${X.o + BW + 30} ${a.y}, ${X.o + BW} ${a.y}` }); links.append(p); L.i[it.id] = p; });
  }
  const mark = (k2, id, cls) => { const o = R[k2][id]; o.r.setAttribute('class', 'rb ' + cls); o.t.setAttribute('class', cls === 'del' ? 'del' : ''); };
  function plan() {
    const s = []; const os = OR.filter((o) => o.c === 1); const its = IT.filter((i) => os.some((o) => o.id === i.o));
    const fail = (what, act) => `<b>ERROR: update or delete on table "${what}" violates foreign key constraint.</b> ${act === 'RESTRICT' ? 'RESTRICT checks immediately, at the row.' : 'NO ACTION checks at the end of the statement (or at COMMIT if the constraint is deferred), and the rows still exist, so it fails too.'} The whole statement is rolled back: <b>nothing</b> was deleted, including the cascades that already ran.`;
    s.push({ cap: '<code>DELETE FROM customers WHERE id = 1;</code> Postgres deletes Asha’s row, then each foreign key’s internal trigger looks for rows that point at it.', run: () => mark('c', 1, 'hot') });
    s.push({ cap: `Two orders reference customer 1: <b>${os.map((o) => o.id).join(', ')}</b>. Their FK says <code>ON DELETE ${oAct}</code>. (An index on <code>orders.customer_id</code> makes this lookup fast; Postgres doesn’t create one for you.)`, run: () => os.forEach((o) => { mark('o', o.id, 'hot'); L.o[o.id].setAttribute('class', 'lk hot'); }) });
    if (oAct === 'RESTRICT' || oAct === 'NO ACTION') {
      s.push({ cap: fail('customers', oAct), run: () => { mark('c', 1, 'err'); os.forEach((o) => mark('o', o.id, 'err')); }, tally: 'rolled back: 0 rows deleted' });
      return s;
    }
    if (oAct === 'SET NULL') {
      s.push({ cap: '<b>SET NULL</b>: the orders survive as orphans with <code>customer_id = NULL</code> (the column must be nullable). Their items are untouched, because the orders still exist.', run: () => { mark('c', 1, 'del'); os.forEach((o) => { mark('o', o.id, 'nul'); R.o[o.id].t.textContent = `id ${o.id} · customer_id NULL`; L.o[o.id].setAttribute('class', 'lk gone'); }); }, tally: 'deleted 1 customer · 2 orders set to NULL' });
      return s;
    }
    s.push({ cap: '<b>CASCADE</b>: the referencing orders are deleted too. Each deletion fires the next foreign key down the chain.', run: () => { mark('c', 1, 'del'); os.forEach((o) => { mark('o', o.id, 'del'); L.o[o.id].setAttribute('class', 'lk gone'); }); } });
    s.push({ cap: `Orders ${os.map((o) => o.id).join(', ')} are referenced by ${its.length} items: <code>order_items.order_id ON DELETE ${iAct}</code>.`, run: () => its.forEach((i) => { mark('i', i.id, 'hot'); L.i[i.id].setAttribute('class', 'lk hot'); }) });
    if (iAct === 'CASCADE') s.push({ cap: `Cascade continues: ${its.length} items deleted. One innocent-looking DELETE removed <b>${1 + os.length + its.length} rows</b> across three tables, all in one atomic statement.`, run: () => its.forEach((i) => { mark('i', i.id, 'del'); L.i[i.id].setAttribute('class', 'lk gone'); }), tally: `deleted 1 customer · ${os.length} orders · ${its.length} items` });
    else s.push({ cap: fail('orders', iAct), run: () => { mark('c', 1, 'err'); os.forEach((o) => mark('o', o.id, 'err')); its.forEach((i) => mark('i', i.id, 'err')); }, tally: 'rolled back: 0 rows deleted' });
    return s;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = plan(); draw();
    ddl.innerHTML = ''; ddl.append(el('pre', { html: IA.highlight(`orders.customer_id    REFERENCES customers ON DELETE ${oAct}\norder_items.order_id  REFERENCES orders    ON DELETE ${iAct}\n\nDELETE FROM customers WHERE id = 1;`, 'sql') }));
    stats.innerHTML = ''; num.textContent = '0/' + steps.length; bStep.disabled = false;
    say('Choose what each foreign key does on delete, then press Play to delete customer 1 (Asha).');
  }
  function step() {
    if (k >= steps.length) return false; const s = steps[k++]; s.run(); say(s.cap); num.textContent = k + '/' + steps.length;
    if (s.tally) { stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `<b>${s.tally}</b>` })); }
    if (k >= steps.length) bStep.disabled = true; return true;
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

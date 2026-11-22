/* OSIV: one request's phases vs the lifetimes of persistence context, transaction and JDBC connection, with open-in-view on and off. */
IA.widget('jpa-n-plus-1-osiv', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const PH = ['Interceptor', 'Controller', 'Service @Tx', 'HTTP call', 'Jackson', 'Response'];
  const ROWS = ['Persistence context', 'Transaction', 'JDBC connection', 'SQL / events'];
  const PLAN = {
    on: { pc: [0, 5], tx: [2, 2], conn: [2, 5], sql: { 2: 'BEGIN · select order · COMMIT', 4: 'select … from order_line …', 5: '200 OK' }, caps: [
      '<code>OpenEntityManagerInViewInterceptor</code> opens an EntityManager for the request and binds it to the thread. No connection yet.',
      'The controller calls the service.',
      '<code>@Transactional</code> joins the already-open EntityManager: BEGIN, select the order, COMMIT. The transaction ends, but with Spring’s Hibernate defaults the <b>connection stays held</b> by the open session.',
      'The controller calls a pricing API for 300 ms. The pooled connection sits unused but checked out the whole time.',
      'Jackson calls <code>order.getLines()</code>. The session is still open, so Hibernate lazily runs a SELECT, <b>outside any transaction</b> (auto-commit). It works, and it hides an N+1 in the JSON layer.',
      'The response is written; the interceptor closes the EntityManager and only now returns the connection to Hikari. Connection hold time ≈ request time.'] },
    off: { pc: [2, 2], tx: [2, 2], conn: [2, 2], sql: { 2: 'BEGIN · select order · COMMIT', 4: 'LazyInitializationException', 5: '500' }, caps: [
      'With <code>spring.jpa.open-in-view=false</code> nothing is opened for the request.',
      'The controller calls the service.',
      'The transaction opens the EntityManager and the connection, selects the order, commits, and closes both. The connection goes back to the pool right away.',
      'The 300 ms HTTP call holds no database resources.',
      'Jackson touches <code>order.getLines()</code>: the collection was never loaded and the session is closed → <b>LazyInitializationException</b>.',
      'The client gets a 500. The fix isn’t to turn OSIV back on: fetch the lines in the service (<code>@EntityGraph</code>) and return a DTO. Then the connection is held only for the transaction.'] }
  };
  let mode = 'on'; let k = 0; let gen = 0; let running = false;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'open-in-view' });
  [['on', 'open-in-view: true (Boot default)'], ['off', 'open-in-view: false']].forEach(([v, l]) => { const b = el('button', { text: l, class: v === mode ? 'on' : '' }); b.addEventListener('click', () => { mode = v; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const W = 700; const H = 230; const X0 = 150; const CW = (W - X0 - 10) / PH.length;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Request phases across, resource lifetimes down' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(el('div', { class: 'w-controls' }, seg), el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr);
  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 12, fill: 'var(--text)', text: t }, o || {}));
  function draw() {
    const P = PLAN[mode]; stage.innerHTML = '';
    PH.forEach((p, i) => { const x = X0 + i * CW;
      stage.append(svg('rect', { x: x + 2, y: 8, width: CW - 4, height: 26, rx: 6, fill: i === k ? 'var(--accent-soft)' : 'var(--surface-2)', stroke: i === k ? 'var(--accent)' : 'var(--border)' }), T(x + CW / 2, 25, p, { 'text-anchor': 'middle', 'font-size': 11, 'font-weight': i === k ? 700 : 400 }));
      stage.append(svg('line', { x1: x, y1: 40, x2: x, y2: H - 8, stroke: 'var(--border)', 'stroke-dasharray': '2 4' })); });
    ROWS.forEach((r, j) => stage.append(T(10, 66 + j * 44, r, { 'font-size': 11.5, fill: 'var(--text-2)' })));
    const bar = (j, [a, b], color, label) => { if (k < a) return; const e = Math.min(b, k);
      stage.append(svg('rect', { x: X0 + a * CW + 4, y: 50 + j * 44, width: (e - a + 1) * CW - 8, height: 24, rx: 6, fill: color, opacity: 0.85 }), T(X0 + a * CW + 10, 66 + j * 44, label, { 'font-size': 10.5, fill: '#fff', 'font-weight': 700 })); };
    bar(0, P.pc, 'var(--accent)', 'EM open');
    bar(1, P.tx, 'var(--accent-2)', 'tx');
    bar(2, P.conn, mode === 'on' && k >= 3 ? 'var(--warn)' : 'var(--k-store)', 'conn held');
    Object.keys(P.sql).forEach((i) => { i = Number(i); if (i > k) return; const bad = /Exception|500/.test(P.sql[i]);
      stage.append(T(X0 + i * CW + CW / 2, 66 + 3 * 44, P.sql[i].length > 20 ? P.sql[i].slice(0, 19) + '…' : P.sql[i], { 'text-anchor': 'middle', 'font-size': 9.5, 'font-family': 'var(--mono)', fill: bad ? 'var(--err)' : i === 4 ? 'var(--warn)' : 'var(--text)', 'font-weight': bad ? 700 : 400 })); });
    const P2 = PLAN[mode]; const tone = mode === 'off' && k >= 4 ? 'err' : mode === 'on' && (k === 3 || k === 4) ? 'warn' : null;
    narr.className = 'caption' + (tone ? ' ' + tone : '');
    narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k + 1}/${PH.length}` }), el('div', { class: 't', html: P2.caps[k] }));
    bStep.disabled = k >= PH.length - 1;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = 0; draw(); }
  bStep.addEventListener('click', () => { gen++; stop(); if (k < PH.length - 1) { k++; draw(); } });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { gen++; stop(); return; }
    if (k >= PH.length - 1) k = 0;
    if (reduced) { k = PH.length - 1; draw(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen; draw();
    while (running && g === gen && k < PH.length - 1) { await sleep(2600); if (g !== gen) return; k++; draw(); }
    if (g === gen) stop();
  });
  reset();
});

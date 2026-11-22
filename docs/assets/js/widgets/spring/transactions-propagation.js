/* @Transactional: call stack through proxies, transaction state, and the SQL each pooled connection sends to Postgres, for six propagation / rollback scenarios. */
IA.widget('transactions-propagation', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  // frame deltas: push (stack entries), pop (n), tx {id: patch}, sql [conn, text, cls], cap, tone
  const P = (n) => ({ n, proxy: true }); const M = (n, o) => Object.assign({ n }, o || {});
  const S = {
    ro: { label: 'Inner REQUIRED throws, outer catches', steps: [
      { push: [M('Controller.importAll()')], cap: 'The controller calls <code>batchService.placeAll(orders)</code>. The reference it holds is a Spring proxy, not your class.' },
      { push: [P('BatchService proxy · TransactionInterceptor')], tx: { tx1: { st: 'active', conn: 1 } }, sql: [1, 'BEGIN'], cap: 'REQUIRED, and no transaction is bound to this thread, so the manager <b>creates</b> tx1: it borrows connection #1 from Hikari, turns off auto-commit and binds it to the thread. pgjdbc sends <code>BEGIN</code> with the first statement.' },
      { push: [M('BatchService.placeAll()')], cap: 'Your loop runs on the target object.' },
      { push: [P('OrderService proxy · REQUIRED'), M('OrderService.place(o1)')], sql: [1, 'INSERT INTO orders … -- o1'], cap: 'The inner proxy finds tx1 already bound: “Participating in existing transaction”. Same connection, same physical transaction.' },
      { pop: 2, push: [P('OrderService proxy · REQUIRED'), M('OrderService.place(o2)', { err: true })], tx: { tx1: { st: 'rollback-only' } }, tone: 'warn', cap: 'Order o2 is invalid: <code>IllegalArgumentException</code>. The inner proxy didn’t create tx1, so it can’t roll it back. It does the only thing a participant can: marks tx1 <b>rollback-only</b>.' },
      { pop: 2, cap: '<code>placeAll</code> catches the exception, logs “skipped o2” and carries on. It has no idea the transaction is already doomed.', tone: 'warn' },
      { push: [P('OrderService proxy · REQUIRED'), M('OrderService.place(o3)')], sql: [1, 'INSERT INTO orders … -- o3'], cap: 'o3 is inserted into a transaction that can no longer commit.' },
      { pop: 3, tx: { tx1: { st: 'rolled back' } }, sql: [1, 'ROLLBACK', 'err'], tone: 'err', cap: '<code>placeAll</code> returns normally, so the outer proxy tries to commit. tx1 is rollback-only, so Spring sends <code>ROLLBACK</code> and throws <b>UnexpectedRollbackException</b>. o1 and o3 are gone too.' },
      { pop: 1, tone: 'err', cap: 'Fix: give each order its own unit of work (REQUIRES_NEW from another bean, or a <code>TransactionTemplate</code> per chunk), or validate without throwing.' }] },
    rn: { label: 'REQUIRES_NEW audit', steps: [
      { push: [M('Controller.place()'), P('OrderService proxy · REQUIRED')], tx: { tx1: { st: 'active', conn: 1 } }, sql: [1, 'BEGIN'], cap: 'tx1 starts on connection #1.' },
      { push: [M('OrderService.place(o)')], sql: [1, 'INSERT INTO orders …'], cap: 'The order row is written but not committed. Other sessions can’t see it.' },
      { push: [P('AuditService proxy · REQUIRES_NEW')], tx: { tx1: { st: 'suspended' }, tx2: { st: 'active', conn: 2 } }, sql: [2, 'BEGIN'], tone: 'warn', cap: 'REQUIRES_NEW <b>suspends</b> tx1: it unbinds connection #1 from the thread, but the connection stays checked out and Postgres shows it <code>idle in transaction</code>. tx2 needs a <b>second</b> connection from the pool.' },
      { push: [M('AuditService.record(o)')], sql: [2, 'INSERT INTO audit …'], cap: 'The audit row goes to Postgres on connection #2, in a completely separate transaction.' },
      { pop: 2, tx: { tx2: { st: 'committed' }, tx1: { st: 'active' } }, sql: [2, 'COMMIT', 'ok'], tone: 'ok', cap: 'The inner proxy commits tx2 and returns connection #2 to the pool. Then it rebinds connection #1: tx1 resumes.' },
      { tx: { tx1: { st: 'rolled back' } }, sql: [1, 'ROLLBACK', 'err'], push: [], cap: 'Back in <code>place()</code>, a stock check throws <code>IllegalStateException</code>. The outer proxy rolls back tx1: the order disappears, but the committed audit row stays.', tone: 'warn' },
      { pop: 3, tone: 'warn', cap: 'That is the point of REQUIRES_NEW. The cost: while inside <code>record()</code>, this thread held two connections. With a pool of 10 and 10 concurrent requests, every thread holds one and waits for a second: a pool deadlock until <code>connectionTimeout</code>.' }] },
    ne: { label: 'NESTED savepoint (JDBC)', steps: [
      { push: [M('caller'), P('Outer proxy · REQUIRED'), M('outer()')], tx: { tx1: { st: 'active', conn: 1 } }, sql: [1, 'BEGIN'], cap: '<code>DataSourceTransactionManager</code> (JdbcTemplate). tx1 on connection #1.' },
      { sql: [1, 'INSERT INTO a VALUES (1)'], cap: 'Row 1.' },
      { push: [P('Inner proxy · NESTED'), M('inner.run()')], tx: { tx1: { st: 'active · savepoint' } }, sql: [1, 'SAVEPOINT SAVEPOINT_1'], cap: 'NESTED doesn’t take a new connection. It sets a JDBC <b>savepoint</b> on the same connection.' },
      { sql: [1, 'INSERT INTO a VALUES (2)'], cap: 'Row 2, after the savepoint.' },
      { pop: 2, tx: { tx1: { st: 'active' } }, sql: [1, 'ROLLBACK TO SAVEPOINT SAVEPOINT_1', 'warn'], tone: 'warn', cap: '<code>inner.run()</code> throws. The proxy rolls back <b>to the savepoint</b> and releases it. Only row 2 is undone, and tx1 is <i>not</i> marked rollback-only.' },
      { sql: [1, 'RELEASE SAVEPOINT SAVEPOINT_1'], cap: 'Spring releases the savepoint. The outer method catches the exception and continues.' },
      { sql: [1, 'INSERT INTO a VALUES (3)'], cap: 'Row 3.' },
      { pop: 2, tx: { tx1: { st: 'committed' } }, sql: [1, 'COMMIT', 'ok'], tone: 'ok', cap: 'Commit: rows 1 and 3. With JPA, <code>JpaTransactionManager</code> allows NESTED by default in 6.x (<code>nestedTransactionAllowed</code>; the default flips to <code>false</code> in 7.0), but the savepoint doesn’t roll back the persistence context’s in-memory state.' }] },
    self: { label: 'Self-invocation (this.audit())', steps: [
      { push: [M('Controller.place()'), P('OrderService proxy · REQUIRED'), M('OrderService.place(o)')], tx: { tx1: { st: 'active', conn: 1 } }, sql: [1, 'BEGIN'], cap: 'tx1 on connection #1.' },
      { sql: [1, 'INSERT INTO orders …'], cap: 'Order row written.' },
      { push: [M('OrderService.audit(o)  ← this.audit()', { bypass: true })], sql: [1, 'INSERT INTO audit …'], tone: 'warn', cap: '<code>this.audit(o)</code> is a plain Java call on the target. There is no proxy in between, so <code>@Transactional(REQUIRES_NEW)</code> on <code>audit()</code> is never read. The audit INSERT goes to <b>connection #1</b>, inside tx1.' },
      { pop: 1, tx: { tx1: { st: 'rolled back' } }, sql: [1, 'ROLLBACK', 'err'], tone: 'err', cap: '<code>place()</code> then throws. The rollback removes the order <b>and</b> the audit row that was supposed to survive it.' },
      { pop: 3, tone: 'err', cap: 'Fix: move <code>audit()</code> to another bean, or use <code>TransactionTemplate</code> with REQUIRES_NEW. Same trap for <code>@Async</code>, <code>@Cacheable</code> and <code>@Retryable</code>.' }] },
    chk: { label: 'Checked exception', steps: [
      { push: [M('Job.run()'), P('ImportService proxy · REQUIRED'), M('ImportService.importFile(p)')], tx: { tx1: { st: 'active', conn: 1 } }, sql: [1, 'BEGIN'], cap: 'tx1 on connection #1.' },
      { sql: [1, 'INSERT INTO batch …'], cap: 'The batch header row is written.' },
      { pop: 1, tone: 'warn', cap: 'Parsing fails with <code>IOException</code>, a <b>checked</b> exception. The interceptor checks the rollback rules: not a <code>RuntimeException</code>, not an <code>Error</code>, no <code>rollbackFor</code>.' },
      { tx: { tx1: { st: 'committed' } }, sql: [1, 'COMMIT', 'warn'], tone: 'warn', cap: 'So it <b>commits</b>, and then rethrows the IOException to the caller. A half-imported batch is now permanent.' },
      { pop: 2, tone: 'warn', cap: 'Fix: <code>@Transactional(rollbackFor = Exception.class)</code>, or (Framework 6.2) <code>@EnableTransactionManagement(rollbackOn = ALL_EXCEPTIONS)</code>.' }] },
    rd: { label: 'readOnly + entity change', steps: [
      { push: [M('Controller.rename()'), P('ProductService proxy · readOnly'), M('ProductService.rename(7)')], tx: { tx1: { st: 'active · read-only', conn: 1 } }, sql: [1, 'BEGIN READ ONLY'], cap: 'Spring calls <code>setReadOnly(true)</code> on the connection, so pgjdbc starts the transaction as <code>BEGIN READ ONLY</code>. On the Hibernate side, the session gets <code>FlushMode.MANUAL</code> and read-only entities.' },
      { sql: [1, 'SELECT … FROM product WHERE id = 7'], cap: '<code>findById</code> loads the product. Being read-only, Hibernate keeps no snapshot for dirty checking.' },
      { cap: '<code>p.setName("New name")</code> changes the Java object only.', tone: 'warn' },
      { pop: 1, tx: { tx1: { st: 'committed' } }, sql: [1, 'COMMIT'], tone: 'warn', cap: 'At commit nothing is flushed: no UPDATE is sent and no error is raised. The rename is silently lost. (An explicit write would fail with <code>25006 cannot execute UPDATE in a read-only transaction</code>.)' },
      { pop: 2, tone: 'warn', cap: 'Use <code>readOnly</code> for queries only. It is a good default on query services and lets a routing DataSource send them to a replica.' }] }
  };
  function build(id) {
    const F = []; let stack = []; let tx = {}; let log = [];
    S[id].steps.forEach((d) => {
      if (d.pop) stack = stack.slice(0, Math.max(0, stack.length - d.pop));
      if (d.push) stack = stack.concat(d.push);
      if (d.tx) { tx = Object.assign({}, tx); Object.keys(d.tx).forEach((k) => { tx[k] = Object.assign({}, tx[k] || {}, d.tx[k]); }); }
      if (d.sql) log = log.concat([d.sql]);
      F.push({ stack: stack.slice(), tx: JSON.parse(JSON.stringify(tx)), log: log.slice(), cap: d.cap, tone: d.tone, newSql: !!d.sql });
    });
    return F;
  }
  let sc = 'ro'; let F = build(sc); let k = 0; let gen = 0; let running = false; let speed = 2600;
  const mkSeg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segSc = mkSeg(Object.keys(S).map((x) => [x, S[x].label]), sc, (v) => { sc = v; F = build(v); reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = mkSeg([[3800, 'Slow'], [2600, 'Normal'], [1300, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const W = 700; const H = 330;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Call stack with proxies, transaction states, and SQL sent on each connection' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(el('div', { class: 'w-controls' }, segSc), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr);
  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 12, fill: 'var(--text)', text: t }, o || {}));
  const stCol = (st) => /rolled|rollback/.test(st) ? 'var(--err)' : /committed/.test(st) ? 'var(--ok)' : /suspended/.test(st) ? 'var(--warn)' : 'var(--accent)';
  function draw(f) {
    stage.innerHTML = '';
    stage.append(T(10, 18, 'Call stack (one thread)', { 'font-weight': 700, 'font-size': 13 }), T(270, 18, 'Transactions', { 'font-weight': 700, 'font-size': 13 }), T(438, 18, 'Sent to Postgres', { 'font-weight': 700, 'font-size': 13 }));
    f.stack.forEach((s, i) => {
      const y = 28 + i * 34; const top = i === f.stack.length - 1;
      const stroke = s.err ? 'var(--err)' : s.bypass ? 'var(--warn)' : s.proxy ? 'var(--accent-2)' : top ? 'var(--accent)' : 'var(--border)';
      stage.append(svg('rect', { x: 10 + (s.proxy ? 0 : 8), y, width: 238 - (s.proxy ? 0 : 8), height: 28, rx: s.proxy ? 14 : 6, fill: top ? 'var(--accent-soft)' : s.proxy ? 'color-mix(in srgb, var(--accent-2) 10%, var(--surface))' : 'var(--surface)', stroke, 'stroke-width': top || s.err || s.bypass ? 2 : 1, 'stroke-dasharray': s.bypass ? '5 3' : '' }));
      stage.append(T(22 + (s.proxy ? 0 : 6), y + 18, (s.proxy ? '⛩ ' : '') + s.n, { 'font-size': 10.8, 'font-family': 'var(--mono)', fill: s.err ? 'var(--err)' : 'var(--text)' }));
    });
    if (!f.stack.length) stage.append(T(20, 50, '(returned to caller)', { fill: 'var(--text-3)' }));
    Object.keys(f.tx).forEach((id, i) => {
      const t = f.tx[id]; const y = 28 + i * 70; const c = stCol(t.st);
      stage.append(svg('rect', { x: 262, y, width: 160, height: 60, rx: 8, fill: 'var(--surface)', stroke: c, 'stroke-width': 1.8 }));
      stage.append(T(272, y + 18, id, { 'font-weight': 700, 'font-family': 'var(--mono)' }), T(272, y + 35, t.st, { fill: c, 'font-size': 11.5, 'font-weight': 700 }), T(272, y + 51, `on connection #${t.conn}`, { fill: 'var(--text-3)', 'font-size': 10.5 }));
    });
    // Hikari pool
    const inUse = new Set(Object.values(f.tx).filter((t) => !/committed|rolled/.test(t.st)).map((t) => t.conn));
    stage.append(T(262, 210, 'Hikari pool (size 10)', { 'font-size': 11, fill: 'var(--text-2)' }));
    for (let i = 0; i < 10; i++) { const x = 262 + (i % 5) * 32; const y = 218 + Math.floor(i / 5) * 26; const used = inUse.has(i + 1);
      stage.append(svg('rect', { x, y, width: 28, height: 20, rx: 4, fill: used ? 'var(--accent)' : 'var(--surface-2)', stroke: 'var(--border)' }), T(x + 14, y + 14, `#${i + 1}`, { 'text-anchor': 'middle', 'font-size': 9.5, fill: used ? '#fff' : 'var(--text-3)' })); }
    // SQL lanes
    [1, 2].forEach((c, j) => {
      const y0 = 28 + j * 150; const lines = f.log.filter((l) => l[0] === c);
      stage.append(svg('rect', { x: 432, y: y0, width: 258, height: 140, rx: 8, fill: 'var(--surface-2)', stroke: inUse.has(c) ? 'var(--accent)' : 'var(--border)', 'stroke-dasharray': lines.length ? '' : '4 3' }));
      stage.append(T(442, y0 + 16, `connection #${c}${c === 1 ? '' : ' (only if a 2nd is borrowed)'}`, { 'font-size': 10.5, fill: 'var(--text-3)' }));
      lines.slice(-6).forEach((l, i) => {
        const last = f.newSql && l === f.log[f.log.length - 1];
        stage.append(T(442, y0 + 36 + i * 17, l[1], { 'font-family': 'var(--mono)', 'font-size': 11, 'font-weight': last ? 700 : 400, fill: l[2] === 'err' ? 'var(--err)' : l[2] === 'ok' ? 'var(--ok)' : l[2] === 'warn' ? 'var(--warn)' : 'var(--text)' }));
      });
    });
  }
  function show() {
    const f = F[k]; draw(f);
    narr.className = 'caption' + (f.tone ? ' ' + f.tone : '');
    narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k + 1}/${F.length}` }), el('div', { class: 't', html: f.cap }));
    bStep.disabled = k >= F.length - 1;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = 0; show(); }
  bStep.addEventListener('click', () => { gen++; stop(); if (k < F.length - 1) { k++; show(); } });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { gen++; stop(); return; }
    if (k >= F.length - 1) k = 0;
    if (reduced) { k = F.length - 1; show(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen; show();
    while (running && g === gen && k < F.length - 1) { await sleep(speed); if (g !== gen) return; k++; show(); }
    if (g === gen) stop();
  });
  reset();
});

/* Application events on a thread timeline: synchronous listeners, @TransactionalEventListener phases, rollback, @Async, and no transaction at all. */
IA.widget('spring-events', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-evt-style')) {
    document.head.append(el('style', { id: 'w-evt-style', text: `
.w-evt svg text { font-family: var(--mono); }
.w-evt .lane { fill: var(--surface-2); stroke: var(--border); }
.w-evt .blk rect { stroke-width: 1.6; }
.w-evt .blk.tx rect { fill: var(--accent-soft); stroke: var(--accent); }
.w-evt .blk.db rect { fill: color-mix(in srgb, var(--k-store) 14%, var(--surface)); stroke: var(--k-store); }
.w-evt .blk.pub rect { fill: color-mix(in srgb, var(--k-queue) 14%, var(--surface)); stroke: var(--k-queue); }
.w-evt .blk.lst rect { fill: color-mix(in srgb, var(--ok) 14%, var(--surface)); stroke: var(--ok); }
.w-evt .blk.held rect { fill: none; stroke: var(--k-queue); stroke-dasharray: 5 4; }
.w-evt .blk.skip rect { fill: none; stroke: var(--text-3); stroke-dasharray: 4 4; }
.w-evt .blk.skip text { fill: var(--text-3); text-decoration: line-through; }
.w-evt .blk.bad rect { fill: color-mix(in srgb, var(--err) 14%, var(--surface)); stroke: var(--err); }
.w-evt .blk.warn rect { fill: color-mix(in srgb, var(--warn) 16%, var(--surface)); stroke: var(--warn); }
.w-evt .blk.new rect { stroke-width: 3; }
.w-evt .blk text { fill: var(--text); font-size: 11.5px; }
.w-evt .txband { fill: none; stroke: var(--accent); stroke-width: 2; }
` }));
  }
  // block: [lane 0|1, slot, width in slots, label line 1, label line 2, class]
  const SC = {
    sync: { label: '@EventListener (sync)', intro: 'Two plain <code>@EventListener</code>s, <code>@Order(1)</code> and <code>@Order(2)</code>, listen for <code>OrderPlaced</code>, published inside a <code>@Transactional</code> method.', tx: [0, 6],
      steps: [
        { b: [0, 0, 1, 'BEGIN', 'tx T1', 'tx'], say: '<code>placeOrder()</code> enters its transactional proxy: transaction T1 starts on the request thread.' },
        { b: [0, 1, 1, 'INSERT', 'order', 'db'], say: 'The order row is inserted (not yet committed).' },
        { b: [0, 2, 1, 'publish', 'OrderPlaced', 'pub'], say: '<code>publisher.publishEvent(new OrderPlaced(id))</code>. The multicaster finds matching listeners and, with no executor configured, calls them <b>right now</b>, on this thread.' },
        { b: [0, 3, 1, 'A @Order(1)', 'send email', 'lst'], say: 'Listener A runs first (lower order value). It is inside T1, and the email goes out <i>before</i> the order is committed.', tone: 'warn' },
        { b: [0, 4, 1, 'B @Order(2)', 'reserve stock', 'lst'], say: 'Listener B runs next, also inside T1. Its DB writes join T1, so they commit or roll back together with the order.' },
        { b: [0, 5, 1, 'publish', 'returns', 'pub'], say: 'Only now does <code>publishEvent()</code> return. Synchronous listeners add their latency to the request.' },
        { b: [0, 6, 1, 'COMMIT', 'tx T1', 'tx'], tone: 'ok', say: 'T1 commits. Synchronous events are just method calls with less coupling: same thread, same transaction, exceptions propagate.' }] },
    thr: { label: 'listener throws', intro: 'Same setup, but listener B throws an exception.', tx: [0, 6],
      steps: [
        { b: [0, 0, 1, 'BEGIN', 'tx T1', 'tx'], say: 'T1 starts.' },
        { b: [0, 1, 1, 'INSERT', 'order', 'db'], say: 'Order inserted.' },
        { b: [0, 2, 1, 'publish', 'OrderPlaced', 'pub'], say: 'Event published; listeners are called synchronously.' },
        { b: [0, 3, 1, 'A @Order(1)', 'email SENT', 'lst'], say: 'Listener A sends the confirmation email.' },
        { b: [0, 4, 1, 'B @Order(2)', 'throws!', 'bad'], tone: 'err', say: 'Listener B throws <code>OutOfStockException</code>. It propagates out of <code>publishEvent()</code> and out of <code>placeOrder()</code>…' },
        { b: [0, 5, 2, 'ROLLBACK', 'order gone', 'bad'], tone: 'err', say: '…so T1 rolls back. The order no longer exists, but the customer already has an email confirming it. Side effects that can’t be undone belong after the commit.' }] },
    commit: { label: 'AFTER_COMMIT', intro: 'The email listener is now <code>@TransactionalEventListener</code> (default phase <code>AFTER_COMMIT</code>).', tx: [0, 5],
      steps: [
        { b: [0, 0, 1, 'BEGIN', 'tx T1', 'tx'], say: 'T1 starts.' },
        { b: [0, 1, 1, 'INSERT', 'order', 'db'], say: 'Order inserted.' },
        { b: [0, 2, 1, 'publish', 'OrderPlaced', 'pub'], say: '<code>publishEvent()</code>: a transactional listener isn’t called. Instead a <b>transaction synchronization</b> is registered on T1.' },
        { b: [0, 3, 1, 'held for', 'AFTER_COMMIT', 'held'], say: 'The event waits (dashed). <code>publishEvent()</code> returns at once and the method continues.' },
        { b: [0, 4, 1, 'UPDATE', 'stock', 'db'], say: 'More work in T1.' },
        { b: [0, 5, 1, 'COMMIT', 'tx T1', 'tx'], say: 'T1 commits successfully…' },
        { b: [0, 6, 1, 'email', 'listener', 'lst'], tone: 'ok', say: '…and only then does the listener run, still on the request thread. The email now describes an order that really exists.' },
        { b: [0, 7, 2, 'INSERT', 'email_log (lost!)', 'warn'], tone: 'warn', say: 'Careful: in <code>AFTER_COMMIT</code> the transaction has already committed. A DB write in the listener is not committed unless the listener starts its own transaction: <code>@Transactional(propagation = REQUIRES_NEW)</code>.' }] },
    rb: { label: 'rollback', intro: 'Two transactional listeners: one <code>AFTER_COMMIT</code> (email), one <code>AFTER_ROLLBACK</code> (release the hold). The payment fails.', tx: [0, 4],
      steps: [
        { b: [0, 0, 1, 'BEGIN', 'tx T1', 'tx'], say: 'T1 starts.' },
        { b: [0, 1, 1, 'INSERT', 'order', 'db'], say: 'Order inserted.' },
        { b: [0, 2, 1, 'publish', 'OrderPlaced', 'pub'], say: 'Event published and held for the transaction outcome.' },
        { b: [0, 3, 1, 'charge', 'DECLINED', 'bad'], tone: 'err', say: 'The payment call throws a runtime exception.' },
        { b: [0, 4, 1, 'ROLLBACK', 'tx T1', 'bad'], tone: 'err', say: 'T1 rolls back.' },
        { b: [0, 5, 1, 'email', 'AFTER_COMMIT', 'skip'], say: 'The <code>AFTER_COMMIT</code> listener is <b>never called</b>: no commit happened. No misleading email.' },
        { b: [0, 6, 2, 'release hold', 'AFTER_ROLLBACK', 'lst'], tone: 'ok', say: 'The <code>AFTER_ROLLBACK</code> listener runs instead. <code>AFTER_COMPLETION</code> would run in both cases; <code>BEFORE_COMMIT</code> runs inside T1, just before it commits.' }] },
    async: { label: '@Async listener', intro: 'The listener is <code>@Async @EventListener</code> (with <code>@EnableAsync</code>). Watch the second lane.', tx: [0, 5],
      steps: [
        { b: [0, 0, 1, 'BEGIN', 'tx T1', 'tx'], say: 'T1 starts on the request thread.' },
        { b: [0, 1, 1, 'INSERT', 'order', 'db'], say: 'Order inserted, uncommitted.' },
        { b: [0, 2, 1, 'publish', 'OrderPlaced', 'pub'], say: 'The listener’s proxy hands the call to a task executor and returns immediately.' },
        { b: [1, 3, 2, 'listener', 'SELECT order…', 'warn'], tone: 'warn', say: 'On <code>task-1</code>, the listener queries the order. T1 hasn’t committed, and this thread is not in T1, so it may find <b>nothing</b>. It is a race.' },
        { b: [0, 3, 2, 'more work', '…', 'db'], say: 'Meanwhile the request continues. Thread-bound context (the transaction, security context, MDC, request scope) did not travel to task-1.' },
        { b: [0, 5, 1, 'COMMIT', 'tx T1', 'tx'], say: 'T1 commits.' },
        { b: [1, 5, 2, 'throws', 'logged only', 'bad'], tone: 'err', say: 'If the async listener throws, the publisher never knows: it goes to the <code>AsyncUncaughtExceptionHandler</code>. For “after commit, off the request thread”, combine <code>@Async</code> with <code>@TransactionalEventListener</code>.' }] },
    notx: { label: 'no transaction', intro: 'A <code>@TransactionalEventListener</code>, but the publishing method is <b>not</b> transactional.', tx: null,
      steps: [
        { b: [0, 0, 2, 'INSERT', 'auto-commit', 'db'], say: 'No <code>@Transactional</code> on the publisher: the insert auto-commits immediately.' },
        { b: [0, 2, 1, 'publish', 'OrderPlaced', 'pub'], say: 'The event is published. There is no transaction to attach a synchronization to…' },
        { b: [0, 3, 2, 'listener', 'DISCARDED', 'skip'], tone: 'err', say: '…so by default the transactional listener is <b>not invoked at all</b>. No error, just silence (a debug log line).' },
        { b: [0, 5, 3, 'fallbackExecution', '= true → runs now', 'lst'], tone: 'ok', say: 'Set <code>@TransactionalEventListener(fallbackExecution = true)</code> to run it immediately when there is no transaction, or make sure the publisher is transactional.' }] }
  };
  let sc = 'sync'; let k = 0; let gen = 0; let running = false; let speed = 2200;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segSc = seg(Object.keys(SC).map((x) => [x, SC[x].label]), sc, (v) => { sc = v; reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3400, 'Slow'], [2200, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const stage = svg('svg', { viewBox: '0 0 760 230', role: 'img', 'aria-label': 'Timeline with the request thread lane and an executor thread lane' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-evt');
  root.append(el('div', { class: 'w-controls' }, segSc), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr);
  const X0 = 10; const SW = 82; const LY = [46, 150]; const BH = 52;
  function render() {
    const S = SC[sc]; stage.innerHTML = '';
    ['http-nio-exec-1 (request)', 'task-1 (executor)'].forEach((n, i) => stage.append(svg('rect', { class: 'lane', x: 4, y: LY[i] - 10, width: 752, height: BH + 20, rx: 10 }), svg('text', { x: 12, y: LY[i] - 16, 'font-size': 12, fill: 'var(--text-3)', text: n })));
    stage.append(svg('text', { x: 690, y: 220, 'font-size': 11.5, fill: 'var(--text-3)', text: 'time →' }));
    const shown = S.steps.slice(0, k).map((s) => s.b);
    if (S.tx && k > 0) { const end = shown.some((b) => b[1] >= S.tx[1]) ? S.tx[1] : Math.max(...shown.filter((b) => b[0] === 0).map((b) => b[1] + b[2] - 1)); stage.append(svg('rect', { class: 'txband', x: X0 + S.tx[0] * SW - 3, y: LY[0] - 6, width: (end - S.tx[0] + 1) * SW + 2, height: BH + 12, rx: 9 }), svg('text', { x: X0 + S.tx[0] * SW, y: LY[0] + BH + 20, 'font-size': 11, fill: 'var(--accent)', text: 'T1 open' })); }
    shown.forEach((b, i) => {
      const [lane, slot, w, l1, l2, cls] = b; const x = X0 + slot * SW; const y = LY[lane];
      const g = svg('g', { class: 'blk ' + cls + (i === k - 1 ? ' new' : '') });
      g.append(svg('rect', { x, y, width: w * SW - 6, height: BH, rx: 8 }), svg('text', { x: x + 7, y: y + 21, 'font-weight': 700, text: l1 }), svg('text', { x: x + 7, y: y + 39, text: l2 }));
      if (i === k - 1 && !reduced) { g.style.opacity = '0'; g.style.transition = 'opacity .4s'; requestAnimationFrame(() => requestAnimationFrame(() => { g.style.opacity = '1'; })); }
      stage.append(g);
    });
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${SC[sc].steps.length}` }), el('div', { class: 't', html: h })); }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; render(); say(SC[sc].intro); bStep.disabled = false; }
  function step() { const st = SC[sc].steps; if (k >= st.length) return false; k++; render(); say(st[k - 1].say, st[k - 1].tone); if (k >= st.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= SC[sc].steps.length) reset();
    if (reduced) { while (step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

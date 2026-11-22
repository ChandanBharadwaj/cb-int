/* @Async thread hand-off: what the caller's ThreadLocals look like on the worker; TaskDecorator propagation; saturated default pool; virtual threads moving the bottleneck to Hikari. */
IA.widget('async-scheduling', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-as-style')) {
    document.head.append(el('style', { id: 'w-as-style', text: `
.w-as svg text { font-family: var(--mono); }
.w-as .bx { fill: var(--surface); stroke: var(--border); stroke-width: 1.6; transition: fill .3s, stroke .3s; }
.w-as .bx.hot { stroke: var(--accent); stroke-width: 2.6; fill: var(--accent-soft); }
.w-as .bx.bad { stroke: var(--err); stroke-width: 2.4; }
.w-as .bx.ok { stroke: var(--ok); stroke-width: 2.2; }
.w-as .tl { fill: var(--surface-2); stroke: var(--border); stroke-width: 1.2; }
.w-as .tl.ok { stroke: var(--ok); fill: color-mix(in srgb, var(--ok) 10%, var(--surface-2)); }
.w-as .tl.lost { stroke: var(--err); stroke-dasharray: 5 3; fill: color-mix(in srgb, var(--err) 8%, var(--surface-2)); }
.w-as .tl.na { opacity: .55; }
.w-as .tok { fill: var(--accent); stroke: var(--surface); stroke-width: 3; transition: transform .7s ease; }
` }));
  }
  const KEYS = ['SecurityContext', 'MDC', 'transaction', 'request'];
  const CALLER = ['alice (JWT)', 'traceId=4bf92f35…', 'tx#81 open · JPA session', 'POST /orders'];
  const EMPTY = [['(empty) → null auth', 'lost'], ['(empty) → no traceId', 'lost'], ['(none)', 'lost'], ['(none)', 'lost']];
  const P = { caller: [126, 252], proxy: [338, 56], queue: [338, 170], worker: [590, 252] };
  const SC = {
    lost: { label: 'context lost', intro: '<code>OrderController</code> → <code>orderService.place()</code> (<code>@Transactional</code>) → <code>mailer.sendReceipt(order)</code>, which is <code>@Async</code>. Default Boot executor.',
      steps: [
        { at: 'caller', hi: { caller: 'hot' }, w: null, q: { busy: 0, queued: 0 }, say: 'On the request thread, four kinds of context live in ThreadLocals: the security context, the logging MDC, the transaction (with its JPA session), and the current request.' },
        { at: 'proxy', hi: { proxy: 'hot' }, w: null, q: { busy: 0, queued: 0 }, log: 'AsyncExecutionInterceptor: submit sendReceipt(order) to applicationTaskExecutor', say: 'The call reaches Mailer’s proxy. <code>AsyncExecutionInterceptor</code> wraps it in a task and submits it. The caller gets control back at once (<code>void</code>) and carries on.' },
        { at: 'queue', hi: { queue: 'hot' }, w: null, q: { busy: 1, queued: 0 }, say: 'A free pool thread takes the task. Only the method <b>arguments</b> travel with it: the <code>order</code> entity object, nothing else.' },
        { at: 'worker', hi: { worker: 'bad' }, w: EMPTY, wn: 'task-1', q: { busy: 1, queued: 0 }, tone: 'err', say: 'On <code>task-1</code> every ThreadLocal is empty. The worker never saw the request thread’s values.' },
        { at: 'worker', hi: { worker: 'bad' }, w: EMPTY, wn: 'task-1', q: { busy: 1, queued: 0 }, tone: 'err', log: 'task-1: getAuthentication() = null · log line without traceId · order.getLines() → LazyInitializationException · request-scoped bean → IllegalStateException', logc: 'e', say: 'Consequences: <code>getAuthentication()</code> is null, log lines have no trace id, <code>order.getLines()</code> throws <code>LazyInitializationException</code> (the session belongs to tx#81 on the other thread), and a request-scoped bean fails. And the email may go out <b>before</b> tx#81 commits, or for an order that then rolls back.' }] },
    deco: { label: 'with TaskDecorator', intro: 'Same call, but the executor has a <code>TaskDecorator</code> (e.g. <code>ContextPropagatingTaskDecorator</code>) and is wrapped by <code>DelegatingSecurityContextAsyncTaskExecutor</code>. The method takes an <b>order id</b> instead of the entity.',
      steps: [
        { at: 'caller', hi: { caller: 'hot' }, w: null, q: { busy: 0, queued: 0 }, say: 'Same request-thread context.' },
        { at: 'proxy', hi: { proxy: 'hot' }, w: null, q: { busy: 0, queued: 0 }, log: 'decorate(task): capture SecurityContext + MDC/observation on the caller thread', say: 'When the task is <b>submitted</b>, the decorator runs on the caller thread and captures the current values into the task object.' },
        { at: 'queue', hi: { queue: 'hot' }, w: null, q: { busy: 1, queued: 0 }, say: 'The decorated task waits for a thread.' },
        { at: 'worker', hi: { worker: 'ok' }, w: [['alice (copied)', 'ok'], ['traceId=4bf92f35… (copied)', 'ok'], ['(none) by design', 'na'], ['(none) by design', 'na']], wn: 'task-1', q: { busy: 1, queued: 0 }, tone: 'ok', log: 'task-1: restore context → run → load order 91 in its own @Transactional', logc: 'o', say: 'Before running, the decorator <b>restores</b> security and MDC on the worker. Transactions and the request are <b>not</b> copied, and must not be: the worker opens its own transaction and loads order 91 by id.' },
        { at: 'worker', hi: { worker: 'ok' }, w: [['(cleared)', 'na'], ['(cleared)', 'na'], ['(none)', 'na'], ['(none)', 'na']], wn: 'task-1', q: { busy: 0, queued: 0 }, tone: 'ok', say: 'In <code>finally</code>, the decorator clears what it set. Pool threads are reused; forgetting this leaks alice’s identity into the next task that runs on <code>task-1</code>.' }] },
    full: { label: 'default pool saturated', intro: 'A marketing send calls <code>@Async sendPromo()</code> 1 000 times in a loop. Boot’s default executor: <b>8</b> core threads, <b>unbounded</b> queue.',
      steps: [
        { at: 'proxy', hi: { proxy: 'hot' }, w: null, q: { busy: 8, queued: 992 }, log: '1 000 submits in 40 ms — none rejected', say: 'All 1 000 submissions return instantly. Eight tasks start; 992 go into the queue. A <code>ThreadPoolExecutor</code> only creates threads beyond the core size when the queue is <b>full</b>, and an unbounded queue never is.' },
        { at: 'queue', hi: { queue: 'bad' }, w: [['(empty)', 'na'], ['(empty)', 'na'], ['(none)', 'na'], ['(none)', 'na']], wn: 'task-1 … task-8', q: { busy: 8, queued: 760 }, tone: 'warn', say: 'Each email takes 300 ms: about 27 per second. The last task starts ~37 s after it was submitted. Meanwhile <b>every other</b> <code>@Async</code> method in the app shares this queue, so a password-reset email waits behind 900 promos.' },
        { at: 'queue', hi: { queue: 'bad' }, w: [['(empty)', 'na'], ['(empty)', 'na'], ['(none)', 'na'], ['(none)', 'na']], wn: 'task-1 … task-8', q: { busy: 8, queued: 520 }, tone: 'err', log: 'SIGTERM during the backlog → queued tasks are discarded unless await-termination is set (and long enough)', logc: 'e', say: 'A deploy now loses the queued tasks: they only ever existed in memory. Fix: a dedicated, bounded executor for bulk work with a rejection policy, and a durable queue for work that must not be lost.' }] },
    vt: { label: 'virtual threads', intro: '<code>spring.threads.virtual.enabled=true</code> (Boot 3.2+, Java 21). The same 1 000 calls; each task does a DB query. Hikari has 20 connections.',
      steps: [
        { at: 'proxy', hi: { proxy: 'hot' }, w: null, q: { vt: true, busy: 1000, queued: 0 }, log: 'SimpleAsyncTaskExecutor (virtual): 1 000 virtual threads started', say: 'The executor is now a <code>SimpleAsyncTaskExecutor</code> with virtual threads: no pool, no queue, one new virtual thread per task. All 1 000 start at once.' },
        { at: 'worker', hi: { worker: 'hot' }, w: EMPTY, wn: 'task-17 (virtual)', q: { vt: true, busy: 1000, queued: 0 }, say: 'Context propagation works exactly as before: a virtual thread has its own (empty) ThreadLocals. Same decorator needed.' },
        { at: 'queue', hi: { queue: 'bad' }, w: EMPTY, wn: 'task-17 (virtual)', q: { vt: true, busy: 1000, queued: 0, hikari: true }, tone: 'err', log: 'HikariPool: active 20/20 · pending 980 → connection-timeout after 30 s', logc: 'e', say: 'The limit just moved: 20 run queries, <b>980 wait</b> for a connection inside Hikari. Virtual threads make blocking cheap; they don’t make the database bigger. Limit concurrency explicitly (<code>spring.task.execution.simple.concurrency-limit</code>, a semaphore, a bulkhead) and fail fast on connection timeouts.' }] }
  };
  let sc = 'lost'; let k = 0; let gen = 0; let running = false; let speed = 2600; let st;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segSc = seg(Object.keys(SC).map((x) => [x, SC[x].label]), sc, (v) => { sc = v; reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1300, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const stage = svg('svg', { viewBox: '0 0 760 290', role: 'img', 'aria-label': 'Caller thread and worker thread with their ThreadLocal values, the async proxy and the executor queue' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const log = el('div', { class: 'w-log', 'aria-label': 'Log' });
  root.classList.add('w-as');
  root.append(el('div', { class: 'w-controls' }, segSc), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, log);
  const tok = svg('circle', { class: 'tok', r: 10, cx: 0, cy: 0 }); const layer = svg('g'); stage.append(layer, tok);
  function thread(x, title, vals, cls) {
    layer.append(svg('rect', { class: 'bx ' + (cls || ''), x, y: 14, width: 228, height: 228, rx: 12 }),
      svg('text', { x: x + 12, y: 36, 'font-size': 12.5, 'font-weight': 700, fill: 'var(--text)', text: title }));
    KEYS.forEach((kk, j) => { const y = 50 + j * 46; const v = vals ? vals[j] : null;
      layer.append(svg('rect', { class: 'tl ' + (v ? v[1] : ''), x: x + 10, y, width: 208, height: 40, rx: 7 }),
        svg('text', { x: x + 20, y: y + 16, 'font-size': 10.5, fill: 'var(--text-3)', text: kk }),
        svg('text', { x: x + 20, y: y + 32, 'font-size': 11, 'font-weight': 700, fill: v && v[1] === 'lost' ? 'var(--err)' : v && v[1] === 'ok' ? 'var(--ok)' : 'var(--text)', text: v ? v[0] : '—' })); });
  }
  function render() {
    const hi = st.hi || {}; layer.innerHTML = '';
    thread(12, 'http-nio-8080-exec-3', CALLER.map((v) => [v, '']), hi.caller);
    thread(520, st.wn ? st.wn : 'worker (not started)', st.w, hi.worker);
    layer.append(svg('rect', { class: 'bx ' + (hi.proxy || ''), x: 258, y: 24, width: 244, height: 56, rx: 10 }),
      svg('text', { x: 270, y: 46, 'font-size': 12, 'font-weight': 700, fill: 'var(--text)', text: 'Mailer proxy' }),
      svg('text', { x: 270, y: 66, 'font-size': 10.5, fill: 'var(--text-3)', text: 'AsyncExecutionInterceptor' }));
    const q = st.q || { busy: 0, queued: 0 };
    layer.append(svg('rect', { class: 'bx ' + (hi.queue || ''), x: 258, y: 96, width: 244, height: 146, rx: 10 }),
      svg('text', { x: 270, y: 118, 'font-size': 12, 'font-weight': 700, fill: 'var(--text)', text: q.vt ? 'virtual-thread executor' : 'applicationTaskExecutor' }));
    if (q.vt) {
      layer.append(svg('text', { x: 270, y: 140, 'font-size': 11, fill: 'var(--text-2)', text: `no pool · no queue · ${q.busy} running` }));
      if (q.hikari) { layer.append(svg('text', { x: 270, y: 166, 'font-size': 11, 'font-weight': 700, fill: 'var(--err)', text: 'HikariPool: 20/20 active' }), svg('text', { x: 270, y: 184, 'font-size': 11, 'font-weight': 700, fill: 'var(--err)', text: '980 threads waiting' }));
        for (let j = 0; j < 20; j++) layer.append(svg('rect', { x: 270 + j * 11, y: 196, width: 9, height: 16, rx: 2, fill: 'var(--err)', opacity: 0.8 })); }
    } else {
      layer.append(svg('text', { x: 270, y: 140, 'font-size': 10.5, fill: 'var(--text-3)', text: 'threads (core 8)' }));
      for (let j = 0; j < 8; j++) layer.append(svg('rect', { x: 270 + j * 27, y: 148, width: 23, height: 18, rx: 3, fill: j < q.busy ? 'var(--accent)' : 'var(--surface-2)', stroke: 'var(--border)' }));
      layer.append(svg('text', { x: 270, y: 186, 'font-size': 10.5, fill: 'var(--text-3)', text: 'queue (unbounded)' }));
      const w = Math.min(220, q.queued / 1000 * 220);
      layer.append(svg('rect', { x: 270, y: 194, width: 220, height: 18, rx: 3, fill: 'var(--surface-2)', stroke: 'var(--border)' }), svg('rect', { x: 270, y: 194, width: w, height: 18, rx: 3, fill: 'var(--warn)', opacity: 0.8 }),
        svg('text', { x: 270, y: 232, 'font-size': 11, 'font-weight': 700, fill: q.queued > 100 ? 'var(--err)' : 'var(--text-2)', text: `${q.queued} queued · ${q.busy}/8 busy` }));
    }
    layer.append(svg('text', { x: 12, y: 268, 'font-size': 11, fill: 'var(--text-3)', text: 'caller: returns immediately after submit' }), svg('text', { x: 748, y: 268, 'font-size': 11, fill: 'var(--text-3)', 'text-anchor': 'end', text: 'worker: runs the method later' }));
    const [x, y] = P[st.at] || P.caller;
    if (reduced) tok.style.transition = 'none';
    tok.style.transform = `translate(${x}px, ${y}px)`;
    log.innerHTML = ''; st.log.forEach(([t, cl]) => log.append(el('div', { text: t, style: { color: cl === 'e' ? 'var(--err)' : cl === 'o' ? 'var(--ok)' : '' } }))); log.scrollTop = log.scrollHeight;
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${SC[sc].steps.length}` }), el('div', { class: 't', html: h })); }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; st = { at: 'caller', hi: {}, log: [], q: sc === 'vt' ? { vt: true, busy: 0, queued: 0 } : { busy: 0, queued: 0 } }; render(); say(SC[sc].intro); bStep.disabled = false; }
  function step() {
    const steps = SC[sc].steps; if (k >= steps.length) return false; const s = steps[k++];
    const logs = st.log; st = Object.assign({}, s, { log: logs });
    if (s.log) logs.push([s.log, s.logc]);
    render(); say(s.say, s.tone);
    if (k >= steps.length) bStep.disabled = true; return true;
  }
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

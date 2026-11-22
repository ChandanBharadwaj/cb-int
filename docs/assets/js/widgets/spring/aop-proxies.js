/* AOP proxies: follow a call through the proxy's interceptor chain to the target; self-invocation, final methods and JDK proxies. */
IA.widget('aop-proxies', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-aop-style')) {
    document.head.append(el('style', { id: 'w-aop-style', text: `
.w-aop svg text { font-family: var(--mono); }
.w-aop .bx { fill: var(--surface); stroke: var(--border); stroke-width: 1.6; transition: fill .3s, stroke .3s, opacity .3s; }
.w-aop .bx.hot { stroke: var(--accent); stroke-width: 2.6; fill: var(--accent-soft); }
.w-aop .bx.ok { stroke: var(--ok); stroke-width: 2.2; fill: color-mix(in srgb, var(--ok) 11%, var(--surface)); }
.w-aop .bx.bad { stroke: var(--err); stroke-width: 2.4; fill: color-mix(in srgb, var(--err) 11%, var(--surface)); }
.w-aop .bx.off { opacity: .35; stroke-dasharray: 5 4; }
.w-aop .px { fill: color-mix(in srgb, var(--accent) 6%, var(--surface)); stroke: var(--accent); stroke-width: 1.8; stroke-dasharray: 8 5; }
.w-aop .tg { fill: var(--surface-2); stroke: var(--text-3); stroke-width: 1.6; }
.w-aop .tok { fill: var(--accent); stroke: var(--surface); stroke-width: 3; }
.w-aop .tok.bad { fill: var(--err); }
.w-aop .sl { fill: none; stroke: var(--err); stroke-width: 2.4; stroke-dasharray: 6 4; }
.w-aop-log { font-family: var(--mono); font-size: 12px; line-height: 1.55; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; max-height: 150px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--text-2); margin-top: 10px; }
.w-aop-log .e { color: var(--err); } .w-aop-log .o { color: var(--ok); }
` }));
  }
  const N = {
    caller: [10, 115, 140, 66], i0: [190, 66, 310, 46], i1: [190, 128, 310, 46], i2: [190, 190, 310, 46], m1: [565, 70, 185, 56], m2: [565, 190, 185, 56]
  };
  const c = (id, dx, dy) => { const [x, y, w, h] = N[id]; return [x + (dx == null ? w / 2 : dx), y + (dy == null ? h / 2 : dy)]; };
  const SC = {
    ext: { label: 'external call', proxy: 'OrderService$$SpringCGLIB$$0', intro: 'OrderController calls <code>orderService.placeOrder()</code>. The field holds the <b>proxy</b>, not your object.',
      steps: [
        { tok: c('caller'), hi: { caller: 'hot' }, say: 'The controller calls <code>placeOrder()</code> on what it believes is OrderService. It is a CGLIB subclass generated at startup by the auto-proxy creator.' },
        { tok: [345, 46], say: 'The proxy’s override looks up the <b>advisor chain</b> for this method (computed once, then cached) and starts a <code>MethodInvocation</code>.' },
        { tok: c('i0'), hi: { i0: 'hot' }, log: 'TimingAspect @Around → start timer', say: '<code>@Order(1)</code> means highest precedence, so this aspect is <b>outermost</b>: first in, last out. <code>pjp.proceed()</code> moves to the next interceptor.' },
        { tok: c('i1'), hi: { i0: 'ok', i1: 'hot' }, log: 'SecurityAspect @Before → hasRole(BUYER) ✓', say: 'A <code>@Before</code> advice runs, then the chain continues automatically. If it threw, the target would never run.' },
        { tok: c('i2'), hi: { i0: 'ok', i1: 'ok', i2: 'hot' }, log: 'TransactionInterceptor → begin (connection bound to thread)', say: 'The transaction interceptor has the lowest precedence by default, so it is the <b>innermost</b> layer, closest to your code.' },
        { tok: c('m1'), hi: { i0: 'ok', i1: 'ok', i2: 'ok', m1: 'hot' }, log: 'OrderService.placeOrder() → INSERT INTO orders …', say: 'Finally the <b>target</b>, your real object, runs <code>placeOrder()</code>. Inside it, <code>this</code> is the target, not the proxy.' },
        { tok: c('i2'), hi: { i2: 'hot', m1: 'ok' }, log: 'TransactionInterceptor → commit', logc: 'o', say: 'Return values unwind back through the same layers in reverse. The method returned normally, so the transaction commits.' },
        { tok: c('i0'), hi: { i0: 'hot', i2: 'ok', m1: 'ok' }, log: 'TimingAspect @Around → placeOrder took 14 ms', say: 'The outermost <code>@Around</code> measured everything inside it, including the commit.' },
        { tok: c('caller'), hi: { caller: 'ok' }, tone: 'ok', say: 'Back at the caller. Every advised feature (transactions, caching, security, retries, <code>@Async</code>) works by being one of these layers.' }] },
    self: { label: 'self-invocation', proxy: 'OrderService$$SpringCGLIB$$0', intro: '<code>placeOrder()</code> calls <code>this.audit()</code>, which is annotated <code>@Transactional(propagation = REQUIRES_NEW)</code>.',
      steps: [
        { tok: c('caller'), hi: { caller: 'hot' }, say: 'Same external call as before: it enters through the proxy.' },
        { tok: c('i2'), hi: { i0: 'ok', i1: 'ok', i2: 'hot' }, log: 'TimingAspect → SecurityAspect → TransactionInterceptor: begin T1', say: 'The chain runs (shown in one step this time) and opens transaction T1.' },
        { tok: c('m1'), hi: { i0: 'ok', i1: 'ok', i2: 'ok', m1: 'hot' }, log: 'placeOrder() → INSERT order', say: 'The target runs <code>placeOrder()</code>.' },
        { tok: c('m2'), hi: { m1: 'ok', m2: 'bad' }, self: true, log: 'this.audit() → INSERT audit_log   (still in T1!)', logc: 'e', tone: 'err', say: '<code>this.audit()</code> is a plain Java call on the target. It never leaves the target box, so no interceptor sees it: <b>no REQUIRES_NEW</b>, no new transaction. The audit row is written in T1.' },
        { tok: c('m1'), hi: { m1: 'bad', m2: 'bad' }, self: true, log: 'placeOrder() throws PaymentDeclined', logc: 'e', tone: 'err', say: 'Payment fails and <code>placeOrder()</code> throws…' },
        { tok: c('i2'), hi: { i2: 'bad', m2: 'bad' }, log: 'TransactionInterceptor → rollback T1 (order AND audit row gone)', logc: 'e', tone: 'err', say: '…so T1 rolls back, taking the audit row with it. The audit you wanted to keep is lost. Fix: move <code>audit()</code> to another bean, or use <code>TransactionTemplate</code>.' }] },
    fin: { label: 'final method', proxy: 'OrderService$$SpringCGLIB$$0', final: true, intro: '<code>placeOrder()</code> is declared <code>public final</code>. CGLIB works by overriding methods in a subclass…',
      steps: [
        { tok: c('caller'), hi: { caller: 'hot' }, log: 'startup: Final method [OrderService.placeOrder] cannot get proxied via CGLIB … might lead to NPEs against uninitialized fields in the proxy instance', logc: 'e', say: 'At startup Spring logged this, but only at DEBUG level, so it is easy to miss. Now the controller calls <code>placeOrder()</code> on the proxy.' },
        { tok: [345, 46], hi: { i0: 'off', i1: 'off', i2: 'off' }, tone: 'warn', say: 'There is no override to enter. Java dispatches straight to the inherited <code>final</code> method: the interceptor chain is <b>skipped entirely</b>.' },
        { tok: [505, 254], hi: { i0: 'off', i1: 'off', i2: 'off' }, bad: true, log: 'NullPointerException: Cannot invoke "OrderRepository.save(Object)" because "this.repo" is null', logc: 'e', tone: 'err', say: 'Worse, the body runs <b>on the proxy instance</b>, not the target. The proxy was created without running your constructor, so its fields are null: <code>repo.save()</code> throws an NPE.' },
        { tok: c('caller'), hi: { caller: 'bad', i0: 'off', i1: 'off', i2: 'off' }, tone: 'err', say: 'Rule: methods you want advised must be non-final and non-private (and on a non-final class). Kotlin classes are final by default; the <code>kotlin-spring</code> plugin opens them.' }] },
    jdk: { label: 'JDK proxy', proxy: 'jdk.proxy2.$Proxy87 implements OrderService', jdk: true, intro: 'With <code>spring.aop.proxy-target-class=false</code>, a bean that implements an interface gets a <b>JDK dynamic proxy</b>: a sibling class implementing the interface, not a subclass.',
      steps: [
        { tok: c('caller'), hi: { caller: 'hot' }, say: 'A caller that injects the <b>interface</b> <code>OrderService</code> is fine: the proxy implements it.' },
        { tok: c('i2'), hi: { i0: 'ok', i1: 'ok', i2: 'ok' }, say: 'Interface methods go through the chain exactly as with CGLIB (<code>InvocationHandler.invoke</code> instead of an overridden method).' },
        { tok: c('m1'), hi: { i0: 'ok', i1: 'ok', i2: 'ok', m1: 'ok' }, tone: 'ok', say: 'The target <code>OrderServiceImpl</code> runs. So far identical.' },
        { tok: c('caller'), hi: { caller: 'bad' }, log: 'BeanNotOfRequiredTypeException: Bean named \'orderService\' is expected to be of type \'OrderServiceImpl\' but was actually of type \'jdk.proxy2.$Proxy87\'', logc: 'e', tone: 'err', say: 'But a bean that injects the <b>class</b> <code>OrderServiceImpl</code> fails at startup: the proxy is not an OrderServiceImpl. Public methods that aren’t on the interface are not advised either.' },
        { tone: 'ok', say: 'That is why Spring Boot defaults to <code>spring.aop.proxy-target-class=true</code> (since 2.0): CGLIB proxies for everything, so injecting either the class or the interface works.' }] }
  };
  let sc = 'ext'; let k = 0; let gen = 0; let running = false; let speed = 2200; let st;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segSc = seg(Object.keys(SC).map((x) => [x, SC[x].label]), sc, (v) => { sc = v; reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3400, 'Slow'], [2200, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const stage = svg('svg', { viewBox: '0 0 760 290', role: 'img', 'aria-label': 'Caller, proxy with three interceptors, and target object; a dot follows the call' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const log = el('div', { class: 'w-aop-log', 'aria-label': 'Call log' });
  root.classList.add('w-aop');
  root.append(el('div', { class: 'w-controls' }, segSc), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, log);
  const LBL = { caller: ['OrderController', 'field: OrderService'], i0: ['@Around TimingAspect', '@Order(1)'], i1: ['@Before SecurityAspect', '@Order(2)'], i2: ['TransactionInterceptor', 'LOWEST_PRECEDENCE'], m1: ['placeOrder()', '@Transactional'], m2: ['audit()', 'REQUIRES_NEW'] };
  let tok;
  function render() {
    const S = SC[sc];
    stage.innerHTML = '';
    stage.append(svg('rect', { class: 'px', x: 172, y: 22, width: 346, height: 256, rx: 14 }), svg('text', { x: 186, y: 44, 'font-size': 12.5, fill: 'var(--accent)', 'font-weight': 700, text: S.proxy }),
      svg('rect', { class: 'tg', x: 548, y: 22, width: 206, height: 256, rx: 14 }), svg('text', { x: 562, y: 44, 'font-size': 12.5, fill: 'var(--text-2)', 'font-weight': 700, text: S.jdk ? 'OrderServiceImpl (target)' : 'OrderService (target)' }));
    if (S.final) stage.append(svg('text', { x: 186, y: 258, 'font-size': 12, fill: 'var(--err)', text: 'inherited final placeOrder() · fields null' }));
    Object.keys(N).forEach((id) => {
      const [x, y, w, h] = N[id]; const l = LBL[id].slice();
      if (S.final && id === 'm1') l[0] = 'final placeOrder()';
      if (S.jdk && id === 'caller') l[1] = 'field: OrderService (iface)';
      stage.append(svg('rect', { class: 'bx ' + ((st.hi && st.hi[id]) || ''), x, y, width: w, height: h, rx: 9 }), svg('text', { x: x + 12, y: y + 20, 'font-size': 13.5, 'font-weight': 700, fill: 'var(--text)', text: l[0] }), svg('text', { x: x + 12, y: y + 37, 'font-size': 11.5, fill: 'var(--text-3)', text: l[1] }));
    });
    if (st.self) stage.append(svg('path', { class: 'sl', d: `M${N.m1[0] + 40} ${N.m1[1] + N.m1[3]} L ${N.m2[0] + 40} ${N.m2[1]}` }), svg('text', { x: 620, y: 168, 'font-size': 12, fill: 'var(--err)', text: 'this.audit()' }));
    tok = svg('circle', { class: 'tok' + (st.bad ? ' bad' : ''), r: 11, cx: 0, cy: 0 });
    const [tx, ty] = st.tok || c('caller');
    tok.style.transform = `translate(${st.prev ? st.prev[0] : tx}px, ${st.prev ? st.prev[1] : ty}px)`;
    if (!reduced) tok.style.transition = 'transform .7s ease';
    stage.append(tok);
    if (st.prev) requestAnimationFrame(() => requestAnimationFrame(() => { tok.style.transform = `translate(${tx}px, ${ty}px)`; }));
    log.innerHTML = ''; st.log.forEach(([t, cl]) => log.append(el('div', { class: cl || '', text: t }))); log.scrollTop = log.scrollHeight;
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${SC[sc].steps.length}` }), el('div', { class: 't', html: h })); }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; st = { hi: {}, log: [], tok: c('caller') }; render(); say(SC[sc].intro); bStep.disabled = false; }
  function step() {
    const steps = SC[sc].steps; if (k >= steps.length) return false; const s = steps[k++];
    const prev = st.tok; const logs = st.log;
    st = { hi: s.hi || {}, tok: s.tok || prev, prev: reduced ? null : prev, self: s.self, bad: s.bad, log: logs };
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

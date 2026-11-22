/* Advice order: three layers (timing aspect, logging aspect, transaction interceptor) nested by @Order; step through the calls in and out. */
IA.widget('aop-proxies-order', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-aopo-style')) {
    document.head.append(el('style', { id: 'w-aopo-style', text: `
.w-aopo svg text { font-family: var(--mono); }
.w-aopo .ly { fill: var(--surface); stroke: var(--border); stroke-width: 1.6; transition: fill .3s, stroke .3s; }
.w-aopo .ly.hot { stroke: var(--accent); stroke-width: 2.8; fill: var(--accent-soft); }
.w-aopo .ly.bad { stroke: var(--err); stroke-width: 2.6; }
.w-aopo ol { margin: 8px 0 0; padding-left: 22px; font-family: var(--mono); font-size: 12.5px; line-height: 1.7; }
.w-aopo li.fut { color: var(--text-3); opacity: .5; }
.w-aopo li.now { color: var(--accent); font-weight: 700; }
.w-aopo li.err { color: var(--err); }
` }));
  }
  const L = { timing: { n: 'TimingAspect', a: '@Around' }, logging: { n: 'LoggingAspect', a: '@Before / @AfterReturning / @AfterThrowing / @After' }, tx: { n: 'TransactionInterceptor', a: 'begin / commit / rollback' } };
  const ORD = {
    a: { label: 'Timing(1) → Logging(2) → Tx', layers: ['timing', 'logging', 'tx'], orders: ['@Order(1)', '@Order(2)', 'LOWEST_PRECEDENCE (default)'] },
    b: { label: 'Tx(0) → Timing → Logging', layers: ['tx', 'timing', 'logging'], orders: ['@EnableTransactionManagement(order = 0)', '@Order(1)', '@Order(2)'] },
    c: { label: 'Logging(1) → Tx(2) → Timing', layers: ['logging', 'tx', 'timing'], orders: ['@Order(1)', '@EnableTransactionManagement(order = 2)', '@Order(3)'] }
  };
  let ord = 'a'; let thr = false; let k = 0; let gen = 0; let running = false; let lines = [];
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segO = seg(Object.keys(ORD).map((x) => [x, ORD[x].label]), ord, (v) => { ord = v; reset(); }, 'Layer order');
  const segT = seg([[false, 'target returns'], [true, 'target throws']], thr, (v) => { thr = v; reset(); }, 'Outcome');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 760 250', role: 'img', 'aria-label': 'Nested layers of advice around the target method' });
  const list = el('ol');
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-aopo');
  root.append(el('div', { class: 'w-controls' }, segO), el('div', { class: 'w-controls' }, segT), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), list, narr);
  function build() {
    const out = []; const layers = ORD[ord].layers;
    const go = (i) => {
      if (i === layers.length) { out.push({ d: 3, t: thr ? 'target.placeOrder() throws PaymentDeclined' : 'target.placeOrder() returns', err: thr }); return; }
      const ly = layers[i];
      if (ly === 'timing') { out.push({ d: i, t: 'TimingAspect @Around: start timer, pjp.proceed()' }); go(i + 1); out.push({ d: i, t: thr ? 'TimingAspect @Around: finally → record time, rethrow' : 'TimingAspect @Around: stop timer, return result' }); }
      if (ly === 'logging') { out.push({ d: i, t: 'LoggingAspect @Before' }); go(i + 1); out.push({ d: i, t: thr ? 'LoggingAspect @AfterThrowing' : 'LoggingAspect @AfterReturning: "order placed"', err: thr }); out.push({ d: i, t: 'LoggingAspect @After (like finally)' }); }
      if (ly === 'tx') { out.push({ d: i, t: 'TransactionInterceptor: begin' }); go(i + 1); out.push({ d: i, t: thr ? 'TransactionInterceptor: rollback (RuntimeException)' : 'TransactionInterceptor: commit', err: thr }); }
    };
    go(0); return out;
  }
  function insight() {
    const ls = ORD[ord].layers; const li = ls.indexOf('logging'); const ti = ls.indexOf('tx'); const mi = ls.indexOf('timing');
    const a = li < ti ? '<b>Logging is outside the transaction</b>: <code>@AfterReturning</code> runs after the commit, so “order placed” really means committed.' : '<b>Logging is inside the transaction</b>: <code>@AfterReturning</code> logs “order placed” <i>before</i> the commit. If the commit then fails (a deferred constraint, an optimistic-lock flush), the log lies.';
    const b = mi < ti ? ' Timing wraps the transaction, so it includes commit time.' : ' Timing is inside the transaction, so it misses commit and connection-acquisition time.';
    return a + b + ' Within one aspect (Spring 5.2.7+), <code>@After</code> runs after <code>@AfterReturning</code>/<code>@AfterThrowing</code>.';
  }
  function render() {
    const O = ORD[ord]; const cur = lines[k - 1];
    stage.innerHTML = '';
    O.layers.forEach((ly, i) => {
      const x = 10 + i * 46; const y = 10 + i * 46; const w = 740 - i * 92; const h = 230 - i * 92 + (i === 2 ? 30 : 0);
      stage.append(svg('rect', { class: 'ly' + (cur && cur.d === i ? (cur.err ? ' bad' : ' hot') : ''), x, y, width: w, height: Math.max(h, 70), rx: 14 }),
        svg('text', { x: x + 14, y: y + 22, 'font-size': 13.5, 'font-weight': 700, fill: 'var(--text)', text: `${i + 1}. ${L[ly].n}` }),
        svg('text', { x: x + 14 + (L[ly].n.length + 4) * 8.2, y: y + 22, 'font-size': 11.5, fill: 'var(--text-3)', text: O.orders[i] }));
    });
    const tx = 118; const ty = 132;
    stage.append(svg('rect', { class: 'ly' + (cur && cur.d === 3 ? (cur.err ? ' bad' : ' hot') : ''), x: tx, y: ty, width: 524, height: 40, rx: 10 }),
      svg('text', { x: tx + 14, y: ty + 25, 'font-size': 13.5, 'font-weight': 700, fill: 'var(--text)', text: 'target: placeOrder()' }));
    list.innerHTML = '';
    lines.forEach((l, i) => list.append(el('li', { class: i < k - 1 ? (l.err ? 'err' : '') : i === k - 1 ? 'now' + (l.err ? ' err' : '') : 'fut', text: l.t, style: { marginLeft: `${l.d * 14}px` } })));
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; lines = build(); render(); say('Lower <code>@Order</code> value = higher precedence = <b>outer</b> layer: first on the way in, last on the way out. Press Play or Step.'); bStep.disabled = false; }
  function step() { if (k >= lines.length) return false; k++; render(); if (k >= lines.length) { bStep.disabled = true; say(insight(), thr ? 'warn' : 'ok'); } return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= lines.length) reset();
    if (reduced) { while (step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(1100);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

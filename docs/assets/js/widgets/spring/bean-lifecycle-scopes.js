/* Bean lifecycle: step one bean through instantiate → populate → aware → BPP before → init → BPP after (proxy) → in use → destroy. */
IA.widget('bean-lifecycle-scopes', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-blc-style')) {
    document.head.append(el('style', { id: 'w-blc-style', text: `
.w-blc-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 12px; align-items: start; }
@media (max-width: 680px) { .w-blc-grid { grid-template-columns: 1fr; } }
.w-blc-ph { list-style: none; margin: 0; padding: 0; display: grid; gap: 5px; }
.w-blc-ph li { border: 1px solid var(--border); border-radius: 9px; padding: 6px 10px; background: var(--surface); font-size: 13px; display: grid; grid-template-columns: 22px 1fr; gap: 8px; align-items: baseline; transition: background .3s, border-color .3s; }
.w-blc-ph li .i { font-family: var(--mono); font-size: 11px; color: var(--text-3); }
.w-blc-ph li code { font-size: 12px; }
.w-blc-ph li .who { display: block; font-size: 11.5px; color: var(--text-3); }
.w-blc-ph li.done { border-color: color-mix(in srgb, var(--ok) 50%, var(--border)); }
.w-blc-ph li.done .i { color: var(--ok); }
.w-blc-ph li.now { border-color: var(--accent); background: var(--accent-soft); }
.w-blc-ph li.off { opacity: .45; text-decoration: line-through; }
.w-blc-ph li.grp { border-style: dashed; background: var(--surface-2); }
.w-blc svg text { font-family: var(--mono); }
.w-blc .obj { fill: var(--surface); stroke: var(--text-3); stroke-width: 1.6; }
.w-blc .obj.live { stroke: var(--ok); stroke-width: 2.2; }
.w-blc .obj.dead { stroke: var(--err); stroke-dasharray: 5 4; }
.w-blc .prx { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2; stroke-dasharray: 7 4; }
.w-blc .fld { font-size: 13px; fill: var(--text-2); }
.w-blc .fld.set { fill: var(--ok); }
.w-blc .fld.nul { fill: var(--err); }
` }));
  }
  const PH = [
    { t: 'Instantiate', c: 'new OrderService(repo)', who: 'constructor resolution · InstantiationStrategy' },
    { t: 'Populate properties', c: '@Autowired / @Value fields & setters', who: 'AutowiredAnnotationBeanPostProcessor' },
    { t: 'Aware callbacks', c: 'setBeanName(), setBeanFactory()', who: 'invokeAwareMethods' },
    { t: 'BPP before-init', c: 'ApplicationContextAware, @PostConstruct', who: 'postProcessBeforeInitialization' },
    { t: 'InitializingBean', c: 'afterPropertiesSet()', who: 'invokeInitMethods' },
    { t: 'Custom init method', c: '@Bean(initMethod = "warmUp")', who: 'invokeInitMethods' },
    { t: 'BPP after-init', c: 'AOP proxies are created here', who: 'postProcessAfterInitialization' },
    { t: 'In use', c: 'getBean() / injected into others', who: 'singleton cache' },
    { t: 'Destroy (context close)', c: '@PreDestroy → destroy() → destroyMethod', who: 'DisposableBeanAdapter' }
  ];
  const MODES = { plain: 'singleton', tx: 'singleton + @Transactional', proto: 'prototype' };
  let mode = 'plain'; let k = 0; let gen = 0; let running = false; let speed = 2400;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segM = seg(Object.entries(MODES), mode, (v) => { mode = v; reset(); }, 'Bean kind');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const list = el('ol', { class: 'w-blc-ph' });
  const stage = svg('svg', { viewBox: '0 0 380 250', role: 'img', 'aria-label': 'The bean object, its fields, and the proxy that may wrap it' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const codeHost = el('div', { style: { marginTop: '10px' } });
  root.classList.add('w-blc');
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-blc-grid' }, list, el('div', null, el('div', { class: 'w-stage' }, stage), codeHost)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr);
  codeHost.append(ctx.codeBox(`@Service
class OrderService implements BeanNameAware, InitializingBean, DisposableBean {
  private final OrderRepository repo;          // constructor
  @Autowired private AuditService audit;       // populate
  OrderService(OrderRepository repo) { this.repo = repo; }
  public void setBeanName(String n) { … }       // aware
  @PostConstruct void init() { … }              // BPP before-init
  public void afterPropertiesSet() { … }
  @PreDestroy void stop() { … }
  public void destroy() { … }
}`, 'java'));

  const SAY = {
    plain: [
      'The container resolves the constructor arguments (orderRepository) and calls the constructor. The object exists, but <code>audit</code> is still null: field injection hasn’t happened yet.',
      '<b>Populate</b>: <code>AutowiredAnnotationBeanPostProcessor</code> injects <code>@Autowired</code> fields and setters and resolves <code>@Value</code>. All dependencies are set now.',
      '<b>Aware</b> callbacks: <code>BeanNameAware</code>, <code>BeanClassLoaderAware</code>, <code>BeanFactoryAware</code>. The bean learns its name and its factory.',
      'Every <code>BeanPostProcessor</code>’s <code>postProcessBeforeInitialization</code>. <code>ApplicationContextAware</code> is handled here, and <code>CommonAnnotationBeanPostProcessor</code> calls <code>@PostConstruct</code>. It is the first moment all fields are guaranteed to be set.',
      '<code>InitializingBean.afterPropertiesSet()</code> runs after <code>@PostConstruct</code>. Prefer the annotation: it doesn’t couple your class to Spring interfaces.',
      'Then the custom init method from <code>@Bean(initMethod = …)</code>, if any. Order: <code>@PostConstruct</code> → <code>afterPropertiesSet</code> → init method.',
      '<code>postProcessAfterInitialization</code>: the bean has no advice, so the auto-proxy creator returns the <b>same object</b>. What a BPP returns here is what goes into the container.',
      'The singleton is cached and handed to everyone who asks. One instance, shared by all threads.',
      'On <code>context.close()</code> (or JVM shutdown hook): <code>@PreDestroy</code>, then <code>DisposableBean.destroy()</code>, then the destroy method. For <code>@Bean</code> methods, a public <code>close()</code> or <code>shutdown()</code> is inferred automatically.'
    ],
    tx: {
      6: '<code>postProcessAfterInitialization</code>: the auto-proxy creator sees <code>@Transactional</code> and returns a <b>CGLIB proxy</b> wrapping the raw object. The container stores the proxy, not your object.',
      7: 'Everyone who injects OrderService receives the <b>proxy</b>. Note what this implies: inside <code>@PostConstruct</code> you were still the raw object, so calling a <code>@Transactional</code> method from it runs without a transaction.'
    },
    proto: {
      7: 'Prototype: a <b>new instance per <code>getBean()</code></b> or injection point. Spring runs the full init sequence, hands the object over, and then <b>forgets it</b>.',
      8: 'Destroy callbacks are <b>never</b> called for prototypes: the container keeps no reference to them. If a prototype holds resources, the caller must clean up.'
    }
  };
  function stateAt(i) {
    return { obj: i >= 0, audit: i >= 1, name: i >= 2, init: i >= 3, proxy: mode === 'tx' && i >= 6, used: i >= 7, dead: i >= 8 && mode !== 'proto' };
  }
  function render() {
    list.innerHTML = '';
    PH.forEach((p, i) => {
      const cls = i < k - 1 ? 'done' : i === k - 1 ? 'now' : '';
      const off = mode === 'proto' && i === 8 && k - 1 >= 8;
      list.append(el('li', { class: (off ? 'off ' : '') + cls }, el('span', { class: 'i', text: i < k - 1 ? '✓' : String(i + 1) }),
        el('div', null, el('b', { text: p.t }), ' ', el('code', { text: p.c }), el('span', { class: 'who', text: p.who }))));
    });
    const s = stateAt(k - 1);
    stage.innerHTML = '';
    stage.append(svg('text', { x: 10, y: 22, 'font-size': 13, fill: 'var(--text-3)', text: k ? `getBean("orderService") →` : 'BeanDefinition only (no object yet)' }));
    if (s.proxy) {
      stage.append(svg('rect', { class: 'prx', x: 14, y: 36, width: 352, height: 204, rx: 14 }),
        svg('text', { x: 28, y: 58, 'font-size': 13, fill: 'var(--accent)', 'font-weight': 700, text: 'OrderService$$SpringCGLIB$$0 (proxy)' }),
        svg('text', { x: 28, y: 76, 'font-size': 11.5, fill: 'var(--text-2)', text: 'TransactionInterceptor → target' }));
    }
    if (s.obj) {
      const oy = s.proxy ? 90 : 46; const ox = s.proxy ? 36 : 22; const w = s.proxy ? 308 : 336;
      stage.append(svg('rect', { class: 'obj' + (s.dead ? ' dead' : s.used ? ' live' : ''), x: ox, y: oy, width: w, height: 138, rx: 10 }),
        svg('text', { x: ox + 12, y: oy + 24, 'font-size': 14, 'font-weight': 700, fill: 'var(--text)', text: 'OrderService@5f2a (raw)' }));
      const f = [['repo', 'OrderRepository', true], ['audit', s.audit ? 'AuditService' : 'null', s.audit], ['beanName', s.name ? '"orderService"' : 'null', s.name], ['initialised', s.init ? 'true' : 'false', s.init]];
      f.forEach(([n, v, ok], j) => stage.append(svg('text', { class: 'fld ' + (ok ? 'set' : 'nul'), x: ox + 16, y: oy + 52 + j * 21, text: `${n} = ${v}` })));
      if (s.dead) stage.append(svg('text', { x: ox + 12, y: oy + 132, 'font-size': 12, fill: 'var(--err)', text: 'destroyed: resources released' }));
      else if (mode === 'proto' && k - 1 >= 7) stage.append(svg('text', { x: ox + 12, y: oy + 132, 'font-size': 12, fill: 'var(--warn)', text: 'not tracked by the container' }));
    }
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${PH.length}` }), el('div', { class: 't', html: h })); }
  function msg(i) { const o = SAY[mode] && !Array.isArray(SAY[mode]) ? SAY[mode][i] : null; return o || SAY.plain[i]; }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; render(); say(`A <b>${MODES[mode]}</b> bean. Press Play or Step to move it through each lifecycle phase.`); bStep.disabled = false; }
  function step() {
    if (k >= PH.length) return false; k++; render();
    const tone = mode === 'proto' && k === 9 ? 'warn' : (mode === 'tx' && k === 7) ? 'ok' : '';
    say(msg(k - 1), tone);
    if (k >= PH.length) bStep.disabled = true; return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= PH.length) reset();
    if (reduced) { while (step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

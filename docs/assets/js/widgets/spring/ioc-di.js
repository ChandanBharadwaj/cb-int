/* IoC & DI: watch ApplicationContext refresh turn bean definitions into wired singletons; ambiguity, @Primary/@Qualifier, and circular references. */
IA.widget('ioc-di', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-ioc-style')) {
    document.head.append(el('style', { id: 'w-ioc-style', text: `
.w-ioc .nd rect { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: fill .3s, stroke .3s; }
.w-ioc .nd text.nm { fill: var(--text); font-family: var(--mono); font-weight: 700; font-size: 15px; }
.w-ioc .nd text.lb { fill: var(--text-2); font-family: var(--mono); font-size: 12px; }
.w-ioc .nd.idle { opacity: .3; }
.w-ioc .nd.def rect { stroke-dasharray: 6 4; stroke: var(--text-3); }
.w-ioc .nd.raw rect { stroke-dasharray: 6 4; stroke: var(--accent); fill: var(--accent-soft); stroke-width: 2; }
.w-ioc .nd.creating rect { stroke: var(--warn); stroke-width: 2; fill: color-mix(in srgb, var(--warn) 14%, var(--surface)); }
.w-ioc .nd.ready rect { stroke: var(--ok); stroke-width: 2; fill: color-mix(in srgb, var(--ok) 12%, var(--surface)); }
.w-ioc .nd.err rect { stroke: var(--err); stroke-width: 2; fill: color-mix(in srgb, var(--err) 12%, var(--surface)); }
.w-ioc .nd.skip { opacity: .55; }
.w-ioc .nd.hot rect { stroke-width: 3.5; }
.w-ioc .eg { fill: none; stroke: var(--edge); stroke-width: 1.8; }
.w-ioc .eg.try { stroke: var(--warn); stroke-width: 2.4; }
.w-ioc .eg.ok { stroke: var(--ok); stroke-width: 2.4; }
.w-ioc .eg.err { stroke: var(--err); stroke-width: 2.4; stroke-dasharray: 6 4; }
.w-ioc .eg.skip { stroke: var(--text-3); stroke-dasharray: 3 5; }
.w-ioc-log { font-family: var(--mono); font-size: 12px; line-height: 1.55; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; max-height: 170px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--text-2); margin-top: 10px; }
.w-ioc-log .e { color: var(--err); } .w-ioc-log .o { color: var(--ok); }
` }));
  }
  const BW = 220, BH = 56;
  const POS = { ctrl: [10, 110], svc: [270, 110], repo: [530, 20], stripe: [530, 110], paypal: [530, 200], audit: [270, 225] };
  const NAME = { ctrl: 'OrderController', svc: 'OrderService', repo: 'OrderRepository', stripe: 'StripeGateway', paypal: 'PaypalGateway', audit: 'AuditService' };
  const head = [
    { log: ':: Spring Boot ::  (v3.x)   Starting App using Java 21', say: '<code>SpringApplication.run()</code> creates the ApplicationContext (for a servlet app, <code>AnnotationConfigServletWebServerApplicationContext</code>). No beans exist yet: every box is greyed out.' },
    { all: 'def', log: 'Component scan: com.shop → bean definitions registered', say: 'Component scanning reads <b>classes</b>, not objects. Each <code>@Component</code> becomes a <b>BeanDefinition</b>: class, scope, constructor, qualifiers. Dashed boxes are recipes, not instances.' },
    { log: 'BeanFactoryPostProcessors ran; BeanPostProcessors registered', say: 'BeanFactoryPostProcessors may still add or edit definitions (@Configuration/@Bean parsing, <code>${…}</code> placeholders). BeanPostProcessors are registered next. Only then are the ordinary singletons created, eagerly.' },
    { n: { ctrl: 'creating' }, lab: { ctrl: 'in creation…' }, hot: ['ctrl'], e: [['ctrl', 'svc', 'try']], log: 'Creating shared instance of singleton bean \'orderController\'', say: '<code>preInstantiateSingletons()</code> walks the definitions. orderController’s only constructor needs an <code>OrderService</code>, so Spring resolves that first, depth-first.' }
  ];
  const finish = (extra) => [
    { n: { svc: 'ready' }, lab: { svc: 'singleton ✓' }, hot: ['svc'], e: [['ctrl', 'svc', 'try']], say: extra || 'The OrderService constructor now runs with both arguments. Its fields are <code>final</code>, so no other bean ever sees a half-built object.' },
    { n: { ctrl: 'ready' }, lab: { ctrl: 'singleton ✓' }, hot: ['ctrl'], e: [['ctrl', 'svc', 'ok']], log: 'Started App in … seconds', logc: 'o', say: 'orderController is done. Refresh ends with a <code>ContextRefreshedEvent</code>; Boot then publishes <code>ApplicationReadyEvent</code>. Every singleton exists and is fully wired.', tone: 'ok' }
  ];
  const svcStart = (lab) => ({ n: { svc: 'creating' }, lab: { svc: lab || 'in creation…' }, hot: ['svc'], e: [['svc', 'repo', 'try'], ['svc', 'stripe', 'try']], say: '<code>OrderService(OrderRepository repo, PaymentGateway gateway)</code> has one constructor, so it needs no <code>@Autowired</code> (Spring 4.3+). Spring resolves each parameter <b>by type</b>.' });
  const repoOk = { n: { repo: 'ready' }, lab: { repo: 'singleton ✓' }, hot: ['repo'], e: [['svc', 'repo', 'ok']], say: 'orderRepository has no dependencies: instantiated, initialised and put in the singleton cache.' };
  const S = {
    ok: { label: 'Constructor (happy)', nodes: ['ctrl', 'svc', 'repo', 'stripe'], lab0: { ctrl: '@RestController', svc: '@Service', repo: '@Repository', stripe: '@Component' },
      intro: 'One implementation of <code>PaymentGateway</code>, constructor injection everywhere. Press Play or Step.',
      steps: [...head, svcStart(), repoOk,
        { n: { stripe: 'ready' }, lab: { stripe: 'singleton ✓' }, hot: ['stripe'], e: [['svc', 'stripe', 'ok']], say: '<code>PaymentGateway</code> has exactly one candidate, stripeGateway. A unique match by type, so Spring creates it and passes it in.' },
        ...finish()] },
    two: { label: '2 candidates', nodes: ['ctrl', 'svc', 'repo', 'stripe', 'paypal'], lab0: { ctrl: '@RestController', svc: '@Service', repo: '@Repository', stripe: '@Component', paypal: '@Component' },
      intro: 'A second <code>PaymentGateway</code> implementation was added. Nothing says which one OrderService wants.',
      steps: [...head, svcStart(), repoOk,
        { n: { stripe: 'err', paypal: 'err', svc: 'err' }, lab: { svc: 'UnsatisfiedDependency' }, hot: ['stripe', 'paypal'], e: [['svc', 'stripe', 'err'], ['svc', 'paypal', 'err']], log: 'NoUniqueBeanDefinitionException: expected single matching bean but found 2: paypalGateway,stripeGateway', logc: 'e', tone: 'err',
          say: 'Two beans match the type. No <code>@Primary</code>, no <code>@Qualifier</code>, and the parameter name <code>gateway</code> matches neither bean name, so the last-resort name match fails too.' },
        { n: { ctrl: 'err' }, lab: { ctrl: 'creation failed' }, e: [['ctrl', 'svc', 'err']], log: 'APPLICATION FAILED TO START\nParameter 1 of constructor in com.shop.OrderService required a single bean, but 2 were found:\n  - paypalGateway  - stripeGateway\nAction: Consider marking one of the beans as @Primary, updating the consumer to accept multiple beans, or using @Qualifier…', logc: 'e', tone: 'err',
          say: 'The error propagates up through orderController, and the context closes. Boot’s failure analyzer prints the fix options. Failing fast at startup is the point of eager singletons: you find out now, not on the first request.' }] },
    primary: { label: '@Primary', nodes: ['ctrl', 'svc', 'repo', 'stripe', 'paypal'], lab0: { ctrl: '@RestController', svc: '@Service', repo: '@Repository', stripe: '@Component @Primary', paypal: '@Component' },
      intro: 'Same two gateways, but <code>StripeGateway</code> is marked <code>@Primary</code>.',
      steps: [...head, svcStart(), repoOk,
        { n: { stripe: 'ready', paypal: 'skip' }, lab: { stripe: 'singleton ✓ (primary)' }, hot: ['stripe'], e: [['svc', 'stripe', 'ok'], ['svc', 'paypal', 'skip']], say: '<code>@Primary</code> breaks the tie: when several candidates match the type, the primary one is injected.' },
        ...finish(),
        { n: { paypal: 'ready' }, lab: { paypal: 'singleton ✓ (unused here)' }, hot: ['paypal'], say: 'paypalGateway is still created: it is an eager singleton in its own right. <code>@Primary</code> only decides what gets injected where there is a choice.', tone: 'ok' }] },
    qual: { label: '@Qualifier', nodes: ['ctrl', 'svc', 'repo', 'stripe', 'paypal'], lab0: { ctrl: '@RestController', svc: '@Qualifier("paypalGateway")', repo: '@Repository', stripe: '@Component @Primary', paypal: '@Component' },
      intro: 'StripeGateway is still <code>@Primary</code>, but the constructor parameter now says <code>@Qualifier("paypalGateway")</code>.',
      steps: [...head, svcStart('@Qualifier("paypalGateway")'), repoOk,
        { n: { paypal: 'ready', stripe: 'skip' }, lab: { paypal: 'singleton ✓ (qualified)' }, hot: ['paypal'], e: [['svc', 'paypal', 'ok'], ['svc', 'stripe', 'skip']], say: 'The qualifier narrows the candidates <b>first</b>, so <code>@Primary</code> on stripeGateway is never consulted. Qualifier beats primary.' },
        ...finish(),
        { n: { stripe: 'ready' }, lab: { stripe: 'singleton ✓ (unused here)' }, say: 'stripeGateway is created anyway, as its own singleton. Other injection points without a qualifier would still get it, because it is primary.', tone: 'ok' }] },
    cyc: { label: 'Cycle: constructor', nodes: ['ctrl', 'svc', 'audit'], lab0: { ctrl: '@RestController', svc: 'ctor(AuditService)', repo: '@Repository', audit: 'ctor(OrderService)' },
      intro: 'OrderService needs AuditService in its constructor, and AuditService needs OrderService in its constructor.',
      steps: [...head,
        { n: { svc: 'creating' }, lab: { svc: 'in creation…' }, hot: ['svc'], e: [['svc', 'audit', 'try']], say: 'Spring marks orderService as <b>currently in creation</b> and goes to build its constructor argument, auditService.' },
        { n: { audit: 'creating' }, lab: { audit: 'in creation…' }, hot: ['audit'], e: [['audit', 'svc', 'try']], say: 'AuditService’s constructor needs OrderService. That bean is in creation, but no object exists yet, because its constructor has not returned. There is nothing to hand over.', tone: 'warn' },
        { n: { audit: 'err', svc: 'err', ctrl: 'err' }, lab: { audit: 'BeanCurrentlyInCreation', svc: 'creation failed', ctrl: 'creation failed' }, e: [['audit', 'svc', 'err'], ['svc', 'audit', 'err'], ['ctrl', 'svc', 'err']], log: 'BeanCurrentlyInCreationException: Error creating bean with name \'orderService\': Requested bean is currently in creation: Is there an unresolvable circular reference?', logc: 'e', tone: 'err',
          say: 'Startup fails. A constructor cycle can <b>never</b> be resolved, whatever <code>spring.main.allow-circular-references</code> says.' },
        { log: 'APPLICATION FAILED TO START\nThe dependencies of some of the beans in the application context form a cycle:\n┌─────┐\n|  orderService\n↑     ↓\n|  auditService\n└─────┘', logc: 'e', tone: 'err',
          say: 'Fix the design: extract the shared logic into a third bean, or decouple with an application event. As a last resort, <code>@Lazy</code> on one parameter injects a lazy-resolution proxy instead of the real bean.' }] },
    fld: { label: 'Cycle: field + allow', nodes: ['ctrl', 'svc', 'audit'], lab0: { ctrl: '@RestController', svc: '@Autowired audit (field)', repo: '@Repository', audit: '@Autowired svc (field)' },
      intro: 'The same cycle with <b>field</b> injection and <code>spring.main.allow-circular-references=true</code>. Watch the three singleton caches in the bar under the log.',
      steps: [...head,
        { n: { svc: 'raw' }, lab: { svc: 'new’d, fields null' }, hot: ['svc'], cache: [[], [], ['orderService']], say: 'Phase 1, <b>instantiate</b>: the no-arg constructor runs and the fields are still null. Spring registers an <code>ObjectFactory</code> for an early reference in the 3rd-level cache (<code>singletonFactories</code>).' },
        { n: { audit: 'raw' }, lab: { audit: 'new’d, fields null' }, hot: ['audit'], e: [['svc', 'audit', 'try']], cache: [[], [], ['orderService', 'auditService']], say: 'Phase 2, <b>populate</b> orderService: its field needs auditService, which is instantiated the same way.' },
        { hot: ['svc'], e: [['audit', 'svc', 'ok']], cache: [[], ['orderService'], ['auditService']], say: 'Populating auditService needs orderService. It is in creation, but an early factory exists. Spring calls it (<code>getEarlyBeanReference</code>, where AOP may wrap it in a proxy) and moves the result to <code>earlySingletonObjects</code>.', tone: 'warn' },
        { n: { audit: 'ready' }, lab: { audit: 'singleton ✓' }, hot: ['audit'], cache: [['auditService'], ['orderService'], []], say: 'auditService is complete: it holds a reference to an orderService that is <i>not finished yet</i>. Any code in its init callbacks that calls orderService could see null fields.' },
        { n: { svc: 'ready' }, lab: { svc: 'singleton ✓' }, hot: ['svc'], e: [['svc', 'audit', 'ok']], cache: [['auditService', 'orderService'], [], []], say: 'orderService finishes. It works only because of the property. Since <b>Boot 2.6 the default is false</b>, and the same code fails at startup with the cycle report.' },
        { n: { ctrl: 'ready' }, lab: { ctrl: 'singleton ✓' }, e: [['ctrl', 'svc', 'ok']], log: 'Started App in … seconds', logc: 'o', tone: 'ok', say: 'Context up. If orderService needed a proxy that is <i>not</i> created early (classic case: <code>@Async</code>), you would instead get “has been injected into other beans in its raw version”.' }] }
  };
  let sc = 'ok'; let k = 0; let gen = 0; let running = false; let speed = 2400; let st;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segSc = seg(Object.keys(S).map((x) => [x, S[x].label]), sc, (v) => { sc = v; reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const stage = svg('svg', { viewBox: '0 0 760 292', role: 'img', 'aria-label': 'Bean dependency graph: controller, service, repository and gateway beans with their wiring state' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const log = el('div', { class: 'w-ioc-log', 'aria-label': 'Startup log' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-ioc');
  root.append(el('div', { class: 'w-controls' }, segSc), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, log, stats);

  const anchor = (a, b) => {
    const [ax, ay] = POS[a]; const [bx, by] = POS[b];
    if (bx > ax) return `M${ax + BW} ${ay + BH / 2} C ${ax + BW + 30} ${ay + BH / 2}, ${bx - 30} ${by + BH / 2}, ${bx} ${by + BH / 2}`;
    if (by > ay) return `M${ax + 70} ${ay + BH} L ${bx + 70} ${by}`;
    return `M${ax + 150} ${ay} L ${bx + 150} ${by + BH}`;
  };
  const MK = { '': 'var(--edge)', try: 'var(--warn)', ok: 'var(--ok)', err: 'var(--err)', skip: 'var(--text-3)' };
  function render() {
    stage.innerHTML = '';
    const defs = svg('defs');
    Object.entries(MK).forEach(([c, col]) => defs.append(svg('marker', { id: 'ioc-ar-' + (c || 'n'), viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: col }))));
    stage.append(defs);
    st.edges.forEach(([a, b, c]) => stage.append(svg('path', { class: 'eg ' + c, d: anchor(a, b), 'marker-end': `url(#ioc-ar-${c || 'n'})` })));
    S[sc].nodes.forEach((id) => {
      const [x, y] = POS[id];
      const g = svg('g', { class: 'nd ' + st.n[id] + (st.hot.includes(id) ? ' hot' : '') });
      g.append(svg('rect', { x, y, width: BW, height: BH, rx: 9 }), svg('text', { class: 'nm', x: x + 12, y: y + 23, text: NAME[id] }), svg('text', { class: 'lb', x: x + 12, y: y + 43, text: st.lab[id] }));
      stage.append(g);
    });
    log.innerHTML = '';
    st.log.forEach(([t, c]) => log.append(el('div', { class: c || '', text: t })));
    log.scrollTop = log.scrollHeight;
    stats.innerHTML = '';
    const n = S[sc].nodes.length; const ready = S[sc].nodes.filter((id) => st.n[id] === 'ready').length;
    stats.append(el('span', { class: 'w-stat', html: `singletons ready <b>${ready}</b> / ${n}` }));
    if (st.cache) ['singletonObjects', 'earlySingletonObjects', 'singletonFactories'].forEach((nm, i) => stats.append(el('span', { class: 'w-stat', html: `${i + 1}. ${nm} <b>[${st.cache[i].join(', ')}]</b>` })));
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${S[sc].steps.length}` }), el('div', { class: 't', html: h })); }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    st = { n: {}, lab: {}, hot: [], edges: [], log: [], cache: null };
    S[sc].nodes.forEach((id) => { st.n[id] = 'idle'; st.lab[id] = S[sc].lab0[id] || ''; });
    render(); say(S[sc].intro); bStep.disabled = false;
  }
  function step() {
    const steps = S[sc].steps; if (k >= steps.length) return false;
    const s = steps[k++];
    if (s.all) S[sc].nodes.forEach((id) => { st.n[id] = s.all; });
    Object.assign(st.n, s.n || {}); Object.assign(st.lab, s.lab || {}); st.hot = s.hot || [];
    (s.e || []).forEach(([a, b, c]) => { st.edges = st.edges.filter((x) => !(x[0] === a && x[1] === b)); st.edges.push([a, b, c]); });
    if (s.log) st.log.push([s.log, s.logc]);
    if (s.cache) st.cache = s.cache;
    render(); say(s.say, s.tone);
    if (k >= steps.length) bStep.disabled = true;
    return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= S[sc].steps.length) reset();
    if (reduced) { while (step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

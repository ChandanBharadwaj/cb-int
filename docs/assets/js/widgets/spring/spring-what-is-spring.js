/* spring-what-is-spring: beginner step-through widget (scenarios, boxes and arrows, startup log). */
IA.widget('spring-what-is-spring', (root, ctx) => {
  const C = {
    id: 'spring-what-is-spring', vb: '0 0 760 300', aria: 'How a Spring Boot starter on the classpath becomes ready-made beans through auto-configuration', logLabel: 'Startup log',
    nodes: {
      pom: [10, 20, 220, 'pom.xml', 'your dependencies'],
      jars: [10, 120, 220, 'classpath', 'jars on disk'],
      auto: [270, 120, 220, 'auto-config', 'Boot reads conditions'],
      ctx: [530, 120, 220, 'ApplicationContext', 'the bean container'],
      tomcat: [530, 20, 220, 'Tomcat', 'web server bean'],
      json: [530, 225, 220, 'ObjectMapper', 'JSON bean'],
      mine: [270, 225, 220, 'BookController', 'your @RestController'],
      xml: [270, 20, 220, 'your config', '@Bean for everything']
    },
    sc: {
      boot: { label: 'Spring Boot', nodes: ['pom', 'jars', 'auto', 'ctx', 'tomcat', 'json', 'mine'],
        intro: 'You added one line, <code>spring-boot-starter-web</code>, and wrote one controller. Press Play to see what Boot does for you.',
        steps: [
          { n: { pom: 'on' }, lab: { pom: 'starter-web' }, hot: ['pom'], say: 'A <b>starter</b> is a dependency that pulls in a curated set of other dependencies. <code>spring-boot-starter-web</code> brings Spring MVC, Jackson and embedded Tomcat, at versions that are tested together.' },
          { n: { jars: 'on' }, lab: { jars: 'spring-webmvc, tomcat, jackson…' }, hot: ['jars'], e: [['pom', 'jars', 'ok', 'resolves']], log: 'Maven resolved ~30 jars from one starter', say: 'Maven or Gradle downloads those jars. They are now on the <b>classpath</b>: the set of classes the JVM can load.' },
          { n: { auto: 'work' }, hot: ['auto'], e: [['jars', 'auto', 'try', 'is Tomcat here?']], log: ':: Spring Boot ::  (v3.x)  Java 17+', say: 'At startup Boot checks a list of <b>auto-configuration</b> classes. Each one asks a question like “is the Tomcat class on the classpath?” and “has the user already defined this bean?”.' },
          { n: { ctx: 'on', tomcat: 'ok', json: 'ok' }, lab: { tomcat: 'auto-configured ✓', json: 'auto-configured ✓' }, hot: ['tomcat', 'json'], e: [['auto', 'ctx', 'ok'], ['ctx', 'tomcat', 'ok'], ['ctx', 'json', 'ok']], say: 'The answers are yes, so Boot registers ready-made beans: a Tomcat web server, Spring MVC’s <code>DispatcherServlet</code> and a Jackson <code>ObjectMapper</code>. You wrote none of them.' },
          { n: { mine: 'ok' }, lab: { mine: 'found by component scan ✓' }, hot: ['mine'], e: [['mine', 'ctx', 'ok', 'scanned']], say: 'Your own classes marked <code>@RestController</code>, <code>@Service</code> and so on are found by <b>component scanning</b> and added to the same container.' },
          { log: 'Tomcat started on port 8080 (http)\nStarted DemoApplication in 1.9 seconds', logc: 'o', tone: 'ok', n: { ctx: 'ok' }, say: 'The app is listening on port 8080. Auto-configuration in one sentence: <b>Boot looks at what is on your classpath and what beans you already defined, and configures sensible defaults for the rest.</b>' }
        ] },
      plain: { label: 'Plain Spring', nodes: ['xml', 'ctx', 'tomcat', 'json', 'mine'],
        intro: 'Spring Framework without Boot. Spring still does dependency injection, but you set up the infrastructure yourself.',
        steps: [
          { n: { xml: 'work' }, hot: ['xml'], say: 'You write configuration classes that declare each infrastructure bean yourself: the DispatcherServlet, a JSON message converter, a DataSource, a transaction manager…' },
          { n: { ctx: 'on', json: 'ok' }, lab: { json: 'declared by you' }, e: [['xml', 'ctx', 'ok'], ['ctx', 'json', 'ok']], say: 'The ApplicationContext is the same idea as in Boot: a container of beans. The difference is <b>who declares them</b>.' },
          { n: { mine: 'ok' }, e: [['mine', 'ctx', 'ok']], say: 'Your controllers and services are wired by the container exactly as in Boot. DI is a <b>Spring Framework</b> feature, not a Boot feature.' },
          { n: { tomcat: 'off' }, lab: { tomcat: 'external server' }, hot: ['tomcat'], log: 'Packaged demo.war → copy into an installed Tomcat', say: 'Traditionally you built a <code>.war</code> and deployed it into a separately installed server. Boot flips this: the server is <b>embedded</b> inside your app.', tone: 'warn' },
          { say: 'Summary: <b>Spring Framework</b> = the core (DI container, MVC, transactions, data access). <b>Spring Boot</b> = an opinionated layer on top: starters, auto-configuration, embedded server and a runnable jar.', tone: 'ok' }
        ] },
      back: { label: 'Boot backs off', nodes: ['jars', 'auto', 'ctx', 'json', 'mine'], nm0: { mine: 'JsonConfig' }, lab0: { mine: 'your @Bean ObjectMapper' },
        intro: 'Defaults are not a cage. Here you define your own <code>ObjectMapper</code> bean. Watch the auto-configuration step aside.',
        steps: [
          { n: { mine: 'ok' }, lab: { mine: 'user bean registered ✓' }, hot: ['mine'], e: [['mine', 'ctx', 'ok', 'your bean']], say: 'Your <code>@Configuration</code> class is processed first, so your <code>ObjectMapper</code> bean definition is already in the container.' },
          { n: { jars: 'on', auto: 'work' }, hot: ['auto'], e: [['jars', 'auto', 'try']], say: 'Jackson’s auto-configuration asks: is Jackson on the classpath? Yes. Is there <b>already</b> an <code>ObjectMapper</code> bean? Also yes.' },
          { n: { json: 'off' }, lab: { json: 'skipped: user bean exists' }, hot: ['json'], log: 'JacksonAutoConfiguration … @ConditionalOnMissingBean (ObjectMapper) found bean → did not match', say: 'So it <b>backs off</b>. This is <code>@ConditionalOnMissingBean</code> at work. Your bean wins; the default is not created.', tone: 'warn' },
          { n: { ctx: 'ok' }, say: 'Rule of thumb: to change a default, first look for a property (<code>spring.jackson.*</code>). If that is not enough, define your own bean. See <a href="auto-configuration.html">Auto-configuration</a> for the deep dive.', tone: 'ok' }
        ] }
    }
  };
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-sb-style')) {
    document.head.append(el('style', { id: 'w-sb-style', text: `
.w-sb .nd rect { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: fill .3s, stroke .3s; }
.w-sb .nd text.nm { fill: var(--text); font-family: var(--mono); font-weight: 700; font-size: 15px; }
.w-sb .nd text.lb { fill: var(--text-2); font-family: var(--mono); font-size: 12px; }
.w-sb .nd.idle { opacity: .35; }
.w-sb .nd.on rect { stroke: var(--accent); stroke-width: 2; fill: var(--accent-soft); }
.w-sb .nd.work rect { stroke: var(--warn); stroke-width: 2; fill: color-mix(in srgb, var(--warn) 14%, var(--surface)); }
.w-sb .nd.ok rect { stroke: var(--ok); stroke-width: 2; fill: color-mix(in srgb, var(--ok) 12%, var(--surface)); }
.w-sb .nd.err rect { stroke: var(--err); stroke-width: 2; fill: color-mix(in srgb, var(--err) 12%, var(--surface)); }
.w-sb .nd.off { opacity: .5; } .w-sb .nd.off rect { stroke-dasharray: 5 4; }
.w-sb .nd.hot rect { stroke-width: 3.5; }
.w-sb .eg { fill: none; stroke: var(--edge); stroke-width: 1.8; }
.w-sb .eg.try { stroke: var(--warn); stroke-width: 2.4; }
.w-sb .eg.ok { stroke: var(--ok); stroke-width: 2.4; }
.w-sb .eg.err { stroke: var(--err); stroke-width: 2.4; stroke-dasharray: 6 4; }
.w-sb .el { fill: var(--text-2); font-family: var(--mono); font-size: 12px; paint-order: stroke; stroke: var(--bg); stroke-width: 4px; }
.w-sb-log { font-family: var(--mono); font-size: 12px; line-height: 1.55; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; max-height: 160px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--text-2); margin-top: 10px; }
.w-sb-log .e { color: var(--err); } .w-sb-log .o { color: var(--ok); }
` }));
  }
  const N = C.nodes; const S = C.sc;
  let sc = Object.keys(S)[0]; let k = 0; let gen = 0; let running = false; let speed = 2600; let st;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segSc = seg(Object.keys(S).map((x) => [x, S[x].label]), sc, (v) => { sc = v; reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1200, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const stage = svg('svg', { viewBox: C.vb, role: 'img', 'aria-label': C.aria });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const log = el('div', { class: 'w-sb-log', 'aria-label': C.logLabel || 'Log' });
  root.classList.add('w-sb');
  root.append(el('div', { class: 'w-controls' }, segSc), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, log);
  const box = (id) => { const n = N[id]; return { x: n[0], y: n[1], w: n[2] || 200, h: 56 }; };
  const anchor = (a, b) => {
    const A = box(a); const B = box(b);
    const acx = A.x + A.w / 2; const acy = A.y + A.h / 2; const bcx = B.x + B.w / 2; const bcy = B.y + B.h / 2;
    let p, q;
    if (Math.abs(bcx - acx) * 0.5 > Math.abs(bcy - acy)) {
      p = [bcx > acx ? A.x + A.w : A.x, acy]; q = [bcx > acx ? B.x : B.x + B.w, bcy];
    } else {
      p = [acx, bcy > acy ? A.y + A.h : A.y]; q = [bcx, bcy > acy ? B.y : B.y + B.h];
    }
    return { d: `M${p[0]} ${p[1]} L ${q[0]} ${q[1]}`, mx: (p[0] + q[0]) / 2, my: (p[1] + q[1]) / 2 };
  };
  const MK = { n: 'var(--edge)', try: 'var(--warn)', ok: 'var(--ok)', err: 'var(--err)' };
  function render() {
    stage.innerHTML = '';
    const defs = svg('defs');
    Object.entries(MK).forEach(([c, col]) => defs.append(svg('marker', { id: C.id + '-ar-' + c, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: col }))));
    stage.append(defs);
    const labels = [];
    st.edges.forEach(([a, b, c, t]) => { const g = anchor(a, b); stage.append(svg('path', { class: 'eg ' + (c || ''), d: g.d, 'marker-end': `url(#${C.id}-ar-${c || 'n'})` })); if (t) labels.push(svg('text', { class: 'el', x: g.mx, y: g.my - 6, 'text-anchor': 'middle', text: t })); });
    S[sc].nodes.forEach((id) => {
      const b = box(id);
      const g = svg('g', { class: 'nd ' + st.n[id] + (st.hot.includes(id) ? ' hot' : '') });
      g.append(svg('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 9 }), svg('text', { class: 'nm', x: b.x + 12, y: b.y + 23, text: st.nm[id] }), svg('text', { class: 'lb', x: b.x + 12, y: b.y + 43, text: st.lab[id] }));
      stage.append(g);
    });
    labels.forEach((t) => stage.append(t));
    log.innerHTML = '';
    st.log.forEach(([t, c]) => log.append(el('div', { class: c || '', text: t })));
    log.scrollTop = log.scrollHeight;
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${S[sc].steps.length}` }), el('div', { class: 't', html: h })); }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    st = { n: {}, nm: {}, lab: {}, hot: [], edges: [], log: [] };
    S[sc].nodes.forEach((id) => { st.n[id] = 'idle'; st.nm[id] = (S[sc].nm0 || {})[id] || N[id][3]; st.lab[id] = (S[sc].lab0 || {})[id] || N[id][4] || ''; });
    render(); say(S[sc].intro); bStep.disabled = false;
  }
  function step() {
    const steps = S[sc].steps; if (k >= steps.length) return false;
    const s = steps[k++];
    if (s.clear) st.edges = [];
    Object.assign(st.n, s.n || {}); Object.assign(st.lab, s.lab || {}); Object.assign(st.nm, s.nm || {}); st.hot = s.hot || [];
    (s.e || []).forEach(([a, b, c, t]) => { st.edges = st.edges.filter((x) => !(x[0] === a && x[1] === b)); st.edges.push([a, b, c, t]); });
    if (s.log) st.log.push([s.log, s.logc]);
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

/* spring-layers: beginner step-through widget (scenarios, boxes and arrows, startup log). */
IA.widget('spring-layers', (root, ctx) => {
  const C = {
    id: 'spring-layers', vb: '0 0 760 300', aria: 'Layered architecture: controller, service and repository beans, request flow and constructor injection', logLabel: 'Trace',
    nodes: {
      client: [10, 20, 160, 'client', 'HTTP'],
      ctl: [200, 20, 170, 'Controller', 'web layer'],
      svc: [400, 20, 170, 'Service', 'business rules'],
      repo: [590, 20, 165, 'Repository', 'data access'],
      db: [590, 150, 165, 'database', 'tables'],
      ctx: [200, 150, 370, 'ApplicationContext', 'creates and injects beans'],
      fake: [400, 225, 170, 'FakeRepo', 'in a unit test'],
      dto: [10, 150, 160, 'BookDto', 'JSON shape']
    },
    sc: {
      flow: { label: 'Request flow', nodes: ['client', 'ctl', 'svc', 'repo', 'db', 'dto'],
        intro: 'A request to borrow a book travels down through three layers and back. Each layer has one job.',
        steps: [
          { n: { client: 'on' }, e: [['client', 'ctl', 'try', 'POST /loans']], hot: ['ctl'], say: 'The <b>controller</b> speaks HTTP: it reads the path, the JSON body and the headers, and calls the service. It holds no business rules.', log: 'LoanController.borrow(bookId=42, memberId=7)' },
          { n: { ctl: 'on', svc: 'work' }, hot: ['svc'], e: [['ctl', 'svc', 'try', 'borrow(42, 7)']], say: 'The <b>service</b> holds the rules: “a member can have at most 3 loans”, “the book must be available”. It knows nothing about HTTP.', log: 'LoanService.borrow → checks: member loans = 2 (max 3) ✓' },
          { n: { repo: 'work' }, hot: ['repo'], e: [['svc', 'repo', 'try', 'save(loan)']], say: 'The <b>repository</b> talks to the database. With Spring Data JPA it is often just an interface.', log: 'LoanRepository.save(Loan)' },
          { n: { db: 'ok', repo: 'ok' }, hot: ['db'], e: [['repo', 'db', 'ok', 'INSERT']], say: 'SQL runs. The data layer is the only one that knows table names.', log: 'insert into loan (book_id, member_id, due) values (?, ?, ?)' },
          { n: { svc: 'ok' }, e: [['svc', 'repo', 'ok'], ['ctl', 'svc', 'ok']], say: 'Results flow back up. The service returns a domain object (<code>Loan</code>).' },
          { n: { ctl: 'ok', dto: 'ok' }, hot: ['dto'], e: [['ctl', 'dto', 'ok', 'map'], ['client', 'ctl', 'ok', '201 Created']], tone: 'ok', say: 'The controller maps it to a response <b>DTO</b> and returns 201. Each layer only calls the layer below it, so each can change or be tested on its own.' }
        ] },
      wire: { label: 'Startup wiring', nodes: ['ctl', 'svc', 'repo', 'ctx'],
        lab0: { ctl: '@RestController', svc: '@Service', repo: 'JpaRepository' },
        intro: 'Who creates these objects? Not you. The container does, at startup, using each constructor.',
        steps: [
          { n: { ctx: 'work' }, hot: ['ctx'], say: 'Component scan finds classes marked with <b>stereotype</b> annotations: <code>@Component</code>, and its specialisations <code>@Service</code>, <code>@Repository</code>, <code>@Controller</code>/<code>@RestController</code>.' },
          { n: { repo: 'ok' }, lab: { repo: 'bean ✓' }, hot: ['repo'], e: [['ctx', 'repo', 'ok', 'new']], say: 'The repository has no dependencies, so it is created first. (Spring Data generates the class behind your interface.)' },
          { n: { svc: 'ok' }, lab: { svc: 'new LoanService(repo) ✓' }, hot: ['svc'], e: [['ctx', 'svc', 'ok', 'new'], ['svc', 'repo', 'ok', 'injected']], say: '<code>LoanService</code> has one constructor that takes a <code>LoanRepository</code>. Spring passes in the bean it just made. That is <b>constructor injection</b>.' },
          { n: { ctl: 'ok' }, lab: { ctl: 'new LoanController(svc) ✓' }, hot: ['ctl'], e: [['ctx', 'ctl', 'ok', 'new'], ['ctl', 'svc', 'ok', 'injected']], say: 'Same for the controller. A single constructor needs no <code>@Autowired</code>. Fields can be <code>final</code>.' },
          { n: { ctx: 'ok' }, tone: 'ok', say: 'All three are <b>singletons</b>: one shared instance each, reused for every request. Keep them stateless. More in <a href="ioc-di.html">IoC &amp; DI</a>.' }
        ] },
      test: { label: 'Swap for a test', nodes: ['ctl', 'svc', 'repo', 'fake'],
        intro: 'Because the service receives its repository through the constructor, a test can hand it something else.',
        steps: [
          { n: { svc: 'on' }, hot: ['svc'], say: 'In a plain JUnit test there is no Spring at all. You call the constructor yourself.' },
          { n: { repo: 'off' }, lab: { repo: 'not needed' }, say: 'No database, no context startup.', tone: 'warn' },
          { n: { fake: 'ok' }, hot: ['fake'], e: [['svc', 'fake', 'ok', 'new LoanService(fake)']], say: 'Pass a fake or a Mockito mock: <code>new LoanService(mock(LoanRepository.class))</code>. This is hard to do with field injection, which is one reason constructor injection is recommended.' },
          { n: { svc: 'ok' }, tone: 'ok', say: 'The test runs in milliseconds and checks the business rule only. Layers plus constructor injection make this easy. See <a href="boot-testing.html">Testing Boot apps</a>.' }
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

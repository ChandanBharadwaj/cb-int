/* Container Apps: revisions with labels and weighted traffic split, KEDA scaling from zero on a Service Bus queue, and Dapr sidecars inside an environment. */
IA.widget('container-apps', (root, ctx) => {
  /* ---- shared Azure widget kit (identical in every azure widget file) ---- */
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-az-style')) {
    document.head.append(el('style', { id: 'w-az-style', text: `
.w-az .nb rect { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: fill .4s, stroke .4s; }
.w-az .nb { transition: opacity .45s; }
.w-az .nb text { fill: var(--text); font-size: 13px; font-family: var(--sans); }
.w-az .nb text.s { fill: var(--text-3); font-size: 10.5px; font-family: var(--mono); }
.w-az .nb.hot rect { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-soft); }
.w-az .nb.ok rect { stroke: var(--ok); stroke-width: 2.5; fill: color-mix(in srgb, var(--ok) 15%, var(--surface)); }
.w-az .nb.warn rect { stroke: var(--warn); stroke-width: 2.5; fill: color-mix(in srgb, var(--warn) 16%, var(--surface)); }
.w-az .nb.bad rect { stroke: var(--err); stroke-width: 2.5; fill: color-mix(in srgb, var(--err) 15%, var(--surface)); }
.w-az .nb.bad text.s, .w-az .nb.warn text.s, .w-az .nb.ok text.s, .w-az .nb.hot text.s { fill: var(--text-2); }
.w-az .nb.dim { opacity: .32; }
.w-az .nb.gone { opacity: .1; }
.w-az .eg { stroke: var(--border); stroke-width: 1.6; fill: none; transition: stroke .4s, opacity .4s; }
.w-az .eg.hot { stroke: var(--accent); stroke-width: 2.6; }
.w-az .eg.ok { stroke: var(--ok); stroke-width: 2.6; }
.w-az .eg.warn { stroke: var(--warn); stroke-width: 2.6; }
.w-az .eg.bad { stroke: var(--err); stroke-width: 2.6; stroke-dasharray: 6 4; }
.w-az .eg.dim { opacity: .25; }
.w-az .zn { fill: color-mix(in srgb, var(--surface-2) 70%, transparent); stroke: var(--border); stroke-dasharray: 6 5; transition: stroke .4s, fill .4s; }
.w-az .zn.bad { stroke: var(--err); fill: color-mix(in srgb, var(--err) 9%, transparent); }
.w-az .zn.hot { stroke: var(--accent); }
.w-az .lbl { fill: var(--text-2); font-size: 12px; font-family: var(--sans); }
.w-az .lbl.m { font-family: var(--mono); font-size: 11px; fill: var(--text-3); }
.w-az .pkt { fill: var(--accent); stroke: var(--surface); stroke-width: 2; }
.w-az .bar { transition: width .6s ease, x .6s ease; }
.w-az.rm * { transition: none !important; animation: none !important; }
` }));
  }
  root.classList.add('w-az'); if (reduced) root.classList.add('rm');
  const Z = {};
  const clearZ = () => { for (const k in Z) delete Z[k]; };
  const seg = (opts, cur, on, label) => {
    const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' });
      b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); });
    return s;
  };
  const node = (g, id, x, y, w, h, t, s) => {
    const n = svg('g', { class: 'nb' });
    n.append(svg('rect', { x, y, width: w, height: h, rx: 8 }));
    n.append(svg('text', { x: x + w / 2, y: s != null ? y + h / 2 - 3 : y + h / 2 + 4, 'text-anchor': 'middle', text: t }));
    let se = null;
    if (s != null) { se = svg('text', { class: 's', x: x + w / 2, y: y + h / 2 + 12, 'text-anchor': 'middle', text: s }); n.append(se); }
    g.append(n); Z[id] = { n, base: 'nb', sub: se, sub0: s || '', x, y, w, h }; return n;
  };
  const edge = (g, id, d) => { const p = svg('path', { class: 'eg', d }); g.append(p); Z[id] = { n: p, base: 'eg' }; return p; };
  const link = (g, id, a, b) => {
    const A = Z[a]; const B = Z[b];
    const x1 = A.x + A.w / 2; const y1 = A.y + A.h; const x2 = B.x + B.w / 2; const y2 = B.y; const my = (y1 + y2) / 2;
    return edge(g, id, `M${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`);
  };
  const hlink = (g, id, a, b) => {
    const A = Z[a]; const B = Z[b]; const y1 = A.y + A.h / 2; const y2 = B.y + B.h / 2;
    const [x1, x2] = A.x < B.x ? [A.x + A.w, B.x] : [A.x, B.x + B.w]; const mx = (x1 + x2) / 2;
    return edge(g, id, `M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`);
  };
  const mid = (id) => { const z = Z[id]; return [z.x + z.w / 2, z.y + z.h / 2]; };
  function paint(s) {
    for (const id in Z) { const z = Z[id]; const c = s && s.c && s.c[id];
      z.n.setAttribute('class', z.base + (c ? ' ' + c : ''));
      if (z.sub) z.sub.textContent = s && s.sub && s.sub[id] != null ? s.sub[id] : z.sub0; }
  }
  const cum = () => { let acc = {}; let sub = {};
    return { set(c, sb) { Object.assign(acc, c || {}); Object.assign(sub, sb || {}); return { c: { ...acc }, sub: { ...sub } }; }, clear() { acc = {}; sub = {}; } }; };
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const say = (n, h, cls) => { narr.className = 'caption' + (cls ? ' ' + cls : ''); narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: String(n) }), el('div', { class: 't', html: h })); };
  let gen = 0;
  const pkt = svg('circle', { r: 7, class: 'pkt', opacity: 0 });
  function fly(ids, ms) {
    const g = gen; const pts = ids.map((p) => (typeof p === 'string' ? mid(p) : p));
    return new Promise((res) => {
      if (reduced || pts.length < 2) return res();
      const L = []; let tot = 0;
      for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(d); tot += d; }
      const dur = ms || 900; const t0 = performance.now(); pkt.setAttribute('opacity', 1);
      const fr = (t) => {
        if (g !== gen) { pkt.setAttribute('opacity', 0); return res(); }
        let d = Math.min(1, (t - t0) / dur) * tot; let i = 0;
        while (i < L.length - 1 && d > L[i]) { d -= L[i]; i++; }
        const f = L[i] ? Math.min(1, d / L[i]) : 1; const [x1, y1] = pts[i]; const [x2, y2] = pts[i + 1];
        pkt.setAttribute('cx', x1 + (x2 - x1) * f); pkt.setAttribute('cy', y1 + (y2 - y1) * f);
        if (t - t0 < dur) requestAnimationFrame(fr); else { pkt.setAttribute('opacity', 0); res(); }
      };
      requestAnimationFrame(fr);
    });
  }
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const controls = el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset);
  let steps = []; let k = 0; let running = false; let busy = false;
  function makeStepper(plan, intro, onReset, pause) {
    const reset = () => {
      gen++; running = false; busy = false; bPlay.textContent = '▶ Play'; k = 0;
      if (onReset) onReset(); steps = plan(); paint(null); say(0, intro()); bStep.disabled = false;
    };
    const step = async () => {
      if (busy || k >= steps.length) return false;
      busy = true; const g = gen; const s = steps[k++];
      if (s.pre) paint(s.pre);
      if (s.fly) await fly(s.fly, s.ms);
      if (g !== gen) return false;
      paint(s); if (s.run) s.run(); say(k, s.t, s.cls); busy = false;
      if (k >= steps.length) bStep.disabled = true;
      return true;
    };
    bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
    bReset.addEventListener('click', reset);
    bPlay.addEventListener('click', async () => {
      if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
      if (k >= steps.length) reset();
      running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
      while (running && g === gen && await step()) { if (k >= steps.length) break; await sleep(reduced ? 700 : (pause || 2600)); }
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    });
    return reset;
  }
  /* ---- end kit ---- */
  let mode = 'traffic';
  const stage = svg('svg', { viewBox: '0 0 640 340', role: 'img', 'aria-label': 'Container Apps revisions, KEDA scaling or Dapr sidecars' });
  const segM = seg([['traffic', 'Revisions & traffic split'], ['keda', 'KEDA scale on a queue'], ['dapr', 'Environment & Dapr']], mode, (v) => { mode = v; reset(); }, 'Mechanism');
  const stats = el('div', { class: 'w-stats' });
  const stat = (h) => { stats.innerHTML = ''; h.forEach((x) => stats.append(el('span', { class: 'w-stat', html: x }))); };
  let barA; let barB; let barT;
  const split = (a) => { if (!barA) return; const W = 600 * a / 100; barA.setAttribute('width', W); barB.setAttribute('x', 20 + W); barB.setAttribute('width', 600 - W); barT.textContent = `v1 ${a}%  ·  v2 ${100 - a}%`; };
  function build() {
    stage.innerHTML = ''; clearZ(); barA = null;
    const bg = svg('g'); const e = svg('g'); const g = svg('g');
    if (mode === 'traffic') {
      node(g, 'ing', 10, 110, 150, 60, 'Ingress (Envoy)', 'ca-orders.<env-domain>');
      node(g, 'qa', 10, 210, 150, 56, 'Tester', 'ca-orders---green…');
      node(g, 'r1', 250, 40, 220, 70, 'ca-orders--v1', 'image orders:1.4 · 3 replicas');
      node(g, 'r2', 250, 170, 220, 70, 'ca-orders--v2', 'not deployed');
      node(g, 'lab', 500, 170, 130, 70, 'label: green', 'stable URL to v2');
      hlink(e, 'e1', 'ing', 'r1'); hlink(e, 'e2', 'ing', 'r2'); hlink(e, 'e3', 'qa', 'r2'); hlink(e, 'e4', 'r2', 'lab');
      barA = svg('rect', { class: 'bar', x: 20, y: 286, width: 600, height: 18, rx: 4, fill: 'var(--accent)' });
      barB = svg('rect', { class: 'bar', x: 620, y: 286, width: 0, height: 18, rx: 4, fill: 'var(--ok)' });
      barT = svg('text', { class: 'lbl m', x: 20, y: 326, text: '' });
      bg.append(svg('text', { class: 'lbl', x: 20, y: 278, text: 'traffic weights (blue = v1, green = v2)' }), barA, barB, barT);
      split(100);
    } else if (mode === 'keda') {
      node(g, 'q', 10, 130, 160, 70, 'Service Bus queue', 'orders: 0 msgs');
      node(g, 'k', 210, 20, 210, 60, 'KEDA scaler', 'messageCount 20 / replica');
      node(g, 'hpa', 210, 250, 210, 60, 'Desired replicas', '0 (min 0, max 5)');
      for (let i = 0; i < 5; i++) node(g, 'p' + i, 462, 14 + i * 64, 168, 50, 'worker replica ' + (i + 1), 'JVM up');
      hlink(e, 'eq', 'q', 'k'); link(e, 'ek', 'k', 'hpa');
      for (let i = 0; i < 5; i++) hlink(e, 'ep' + i, 'hpa', 'p' + i);
    } else {
      const r = svg('rect', { class: 'zn', x: 8, y: 8, width: 378, height: 324, rx: 12 });
      bg.append(r, svg('text', { class: 'lbl', x: 18, y: 28, text: 'environment cae-orders: shared VNet, logs, DNS' })); Z.env = { n: r, base: 'zn' };
      node(g, 'a', 24, 60, 150, 56, 'orders', 'Spring Boot');
      node(g, 'da', 214, 60, 150, 56, 'daprd sidecar', 'localhost:3500');
      node(g, 'b', 24, 250, 150, 56, 'shipping', 'Python / FastAPI');
      node(g, 'db', 214, 250, 150, 56, 'daprd sidecar', 'localhost:3500');
      node(g, 'ps', 420, 60, 210, 56, 'component: pubsub', 'Azure Service Bus');
      node(g, 'st', 420, 155, 210, 56, 'component: statestore', 'Cosmos DB / Redis');
      node(g, 'sv', 420, 250, 210, 56, 'scopes: [orders, shipping]', 'per-component access');
      hlink(e, 'x1', 'a', 'da'); hlink(e, 'x2', 'b', 'db'); hlink(e, 'x3', 'da', 'ps'); link(e, 'x4', 'da', 'db');
      edge(e, 'x5', 'M364 100 C 395 120, 395 170, 420 183'); edge(e, 'x6', 'M420 100 C 395 140, 390 230, 364 270');
    }
    stage.append(bg, e, g, pkt); stat([]);
  }
  function plan() {
    const A = cum(); const S = [];
    if (mode === 'traffic') {
      S.push({ ...A.set({ r1: 'ok', e1: 'ok', ing: 'hot', r2: 'gone', e2: 'gone', e3: 'gone', e4: 'gone', lab: 'gone', qa: 'dim' }), run: () => split(100), t: 'A <b>revision</b> is an immutable snapshot of the app’s template (image, env vars, resources, scale rules). In the default <b>single</b> revision mode, a new revision replaces the old one. Here we switch to <b>multiple</b> mode to control traffic ourselves.' });
      S.push({ ...A.set({ r2: 'hot', e2: 'dim' }, { r2: 'image orders:1.5 · 0% traffic' }), run: () => split(100), t: 'Deploying image <code>orders:1.5</code> is a <i>revision-scope</i> change, so it creates <code>ca-orders--v2</code>. With multiple revisions it starts at <b>0% traffic</b>. (Changing a secret or ingress is application-scope: it doesn’t create a revision.)' });
      S.push({ fly: ['qa', 'r2'], ...A.set({ lab: 'ok', e4: 'ok', qa: 'hot', e3: 'ok' }), t: 'Add a <b>label</b> (<code>green</code>). It gives v2 a stable URL, <code>ca-orders---green.&lt;env-domain&gt;</code>, for smoke tests before any user sees it.' });
      S.push({ fly: ['ing', 'r2'], ...A.set({ e2: 'ok', r2: 'ok' }, { r1: 'image orders:1.4 · 90%', r2: 'image orders:1.5 · 10%' }), run: () => split(90), t: '<b>Canary</b>: send 10% of traffic to v2 with <code>az containerapp ingress traffic set --revision-weight ca-orders--v1=90 ca-orders--v2=10</code>. Watch error rate and p95 in App Insights, split by <code>cloud_RoleInstance</code> or revision.', cls: 'warn' });
      S.push({ fly: ['ing', 'r2'], ...A.set({}, { r1: 'image orders:1.4 · 50%', r2: 'image orders:1.5 · 50%' }), run: () => split(50), t: 'Metrics look good, so go to 50/50. Weighted routing is per request, not sticky, unless you enable <b>session affinity</b> on ingress.' });
      S.push({ fly: ['ing', 'r2'], ...A.set({ e1: 'dim', r1: 'warn' }, { r1: 'active · 0% (rollback ready)', r2: 'image orders:1.5 · 100%' }), run: () => split(0), t: '100% to v2. Keep v1 <b>active at 0%</b> for a while: rollback is one traffic command, with no image pull or cold start (if it kept min replicas).', cls: 'ok' });
      S.push({ ...A.set({ r1: 'gone', e1: 'gone' }, { r1: 'deactivated' }), run: () => split(0), t: '<b>Deactivate</b> v1 when you’re confident. It stops costing anything, and it can be reactivated later. Automate the whole canary in CI, or with blue/green labels.', cls: 'ok' });
      return S;
    }
    if (mode === 'keda') {
      const reps = (n, sub) => { const c = {}; for (let i = 0; i < 5; i++) { c['p' + i] = i < n ? (sub || 'ok') : 'gone'; c['ep' + i] = i < n ? 'ok' : 'gone'; } return c; };
      S.push({ ...A.set({ ...reps(0), q: 'ok' }), run: () => stat(['queue <b>0</b>', 'replicas <b>0</b>']), t: '<b>Scale to zero</b>: with <code>minReplicas: 0</code> and a Service Bus scale rule, an idle worker app costs nothing. KEDA keeps watching the queue on the app’s behalf.' });
      S.push({ fly: ['q', 'k'], ...A.set({ q: 'warn', k: 'hot', eq: 'hot' }, { q: 'orders: 50 msgs', hpa: '⌈50 / 20⌉ = 3' }), run: () => stat(['queue <b>50</b>', 'polling (default 30 s)']), t: 'Messages arrive. KEDA polls the queue (Microsoft Learn documents a 30 s default polling interval) and computes desired replicas = ⌈50 ÷ 20⌉ = <b>3</b>.' });
      S.push({ fly: ['k', 'hpa'], ...A.set({ ...reps(3, 'hot'), hpa: 'hot', ek: 'hot' }, { p0: 'starting JVM', p1: 'starting JVM', p2: 'starting JVM' }), run: () => stat(['queue <b>50</b>', 'replicas <b>3</b> starting']), t: 'Activation from 0 → 1, then the Kubernetes HPA underneath scales to 3. Each replica pays image pull and JVM start, which is fine for a queue worker (the messages wait) and painful for an HTTP API.', cls: 'warn' });
      S.push({ fly: ['q', 'k', 'hpa'], ...A.set({ ...reps(5) }, { q: 'orders: 180 msgs', hpa: '⌈180 / 20⌉ = 9 → max 5', p0: 'JVM up', p1: 'JVM up', p2: 'JVM up' }), run: () => stat(['queue <b>180</b>', 'replicas <b>5</b> (max)']), t: 'A burst: 9 replicas wanted, capped at <code>maxReplicas: 5</code>. Size the max for what downstream can take: 5 replicas × 10 concurrent handlers × 1 DB connection each must fit your Postgres pool.', cls: 'warn' });
      S.push({ fly: ['q', 'k'], ...A.set({ ...reps(2), q: 'warn' }, { q: 'orders: 30 msgs', hpa: '⌈30 / 20⌉ = 2' }), run: () => stat(['queue <b>30</b>', 'replicas <b>2</b>']), t: 'The queue drains, and scale-in removes replicas. On SIGTERM a replica should stop taking new messages and finish (or abandon) in-flight ones. Spring’s graceful shutdown and a settled message lock matter here.' });
      S.push({ ...A.set({ ...reps(0), q: 'ok', k: '', hpa: '' }, { q: 'orders: 0 msgs', hpa: '0 after cool-down' }), run: () => stat(['queue <b>0</b>', 'replicas <b>0</b> after cool-down']), t: 'Empty queue. After the <b>cool-down period</b> (300 s by default per Microsoft Learn) the app goes back to zero. CPU or memory rules can’t scale to zero; event rules (queues, HTTP concurrency) can.', cls: 'ok' });
      return S;
    }
    S.push({ ...A.set({ env: 'hot', a: 'ok', b: 'ok' }), t: 'An <b>environment</b> is the secure boundary for a group of apps: one VNet (yours or managed), one Log Analytics destination, internal DNS. Apps in it reach each other by name (<code>http://shipping</code>) over internal ingress.' });
    S.push({ ...A.set({ da: 'hot', db: 'hot', x1: 'hot', x2: 'hot' }), t: 'Enable <b>Dapr</b> on an app and a <code>daprd</code> sidecar runs next to it. Your code talks to <code>localhost:3500</code> over HTTP or gRPC, whatever the language.' });
    S.push({ fly: ['a', 'da', 'ps'], ...A.set({ ps: 'ok', x3: 'ok' }), t: '<b>Pub/sub</b>: <code>POST /v1.0/publish/pubsub/order-created</code>. The <code>pubsub</code> component, defined once on the environment, maps that to Azure Service Bus and authenticates with a managed identity.' });
    S.push({ fly: ['ps', 'db', 'b'], ...A.set({ x6: 'ok', db: 'ok' }), t: 'Dapr delivers the event to the shipping sidecar, which calls shipping’s subscribed HTTP route. Retries and dead-lettering follow the component and broker settings.', cls: 'ok' });
    S.push({ fly: ['a', 'da', 'db', 'b'], ...A.set({ x4: 'ok' }), t: '<b>Service invocation</b>: <code>GET localhost:3500/v1.0/invoke/shipping/method/quote</code>. Sidecar-to-sidecar calls get service discovery, retries and tracing.' });
    S.push({ fly: ['da', 'st'], ...A.set({ st: 'ok', x5: 'ok', sv: 'warn' }), t: '<b>State</b> and secrets work the same way. Components are <b>scoped</b> to the apps that may use them, so swapping Service Bus for Kafka changes YAML, not code. Dapr is optional: many Spring teams just use Spring Cloud Azure.', cls: 'ok' });
    return S;
  }
  const intro = () => ({ traffic: 'Press Play: deploy v2 as a new revision, test it through a label, then shift traffic 0 → 10 → 50 → 100%.', keda: 'Press Play: messages arrive and KEDA scales the worker from zero, caps it at max, then returns to zero.', dapr: 'Press Play: two apps in one environment talk through Dapr sidecars and shared components.' }[mode]);
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), stats, controls, narr);
  const reset = makeStepper(plan, intro, build);
  reset();
});

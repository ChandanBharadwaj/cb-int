/* Compute decision tree: walk five workloads through VMs / Functions / AKS / Container Apps / App Service, with a comparison table. */
IA.widget('compute-choice', (root, ctx) => {
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
  const CASES = {
    api: { label: 'Spring Boot REST API (JAR)', a: [0, 0, 0, 0], why: ['It’s a plain Spring Boot JAR on Java 21. No OS tweaks.', 'It serves HTTP all day; it isn’t a burst of short events.', 'One team, three services. Nobody needs CRDs or a mesh.', 'The team deploys a JAR today and doesn’t want to own a Dockerfile yet.'] },
    events: { label: 'Blob upload → parse → DB', a: [0, 1], why: ['Pure code, no OS needs.', 'Yes: each upload is a short, independent unit of work, idle for hours at night. Triggers and bindings do the plumbing.'] },
    legacy: { label: 'Vendor app needing an OS agent', a: [1], why: ['It needs a vendor agent installed on the OS and a fixed licence MAC/hostname. That is IaaS.'] },
    platform: { label: '40 microservices, platform team', a: [0, 0, 1], why: ['Containers, no OS-level needs.', 'Long-running services, not functions.', 'Yes: they run Argo CD, operators, a service mesh and DaemonSets, and have a team to run the cluster.'] },
    agent: { label: 'AI agent API + workers (container)', a: [0, 0, 0, 1], why: ['Python and Java containers; no OS needs.', 'The API is long-lived, and workers drain a queue in bursts. Mostly services, not functions.', 'No need for the Kubernetes API, just scale rules and revisions.', 'Yes: they ship images, want scale-to-zero for workers (KEDA on queue depth) and traffic splitting for prompt or model changes.'] }
  };
  let cs = 'api';
  const stage = svg('svg', { viewBox: '0 0 640 396', role: 'img', 'aria-label': 'Decision tree for choosing Azure compute' });
  const segC = seg(Object.entries(CASES).map(([k, v]) => [k, v.label]), cs, (v) => { cs = v; reset(); }, 'Workload');
  const tbl = el('div', { class: 'tscroll', style: { marginTop: '12px' } });
  const COLS = [['vm', 'VMs / VMSS'], ['fn', 'Functions'], ['aks', 'AKS'], ['aca', 'Container Apps'], ['app', 'App Service']];
  const ROWS = [
    ['You deploy', 'VM image + your installs', 'functions (code or container)', 'manifests / Helm charts', 'container image', 'JAR / WAR / code (or a container)'],
    ['Scale to zero', 'no (you can deallocate)', 'yes (Flex / Consumption)', 'user node pools only, with effort', 'yes (KEDA)', 'no (min 1 instance)'],
    ['You patch', 'OS, runtime, app', 'app', 'app + cluster upgrades, node images', 'app + base image', 'app (runtime chosen from a list)'],
    ['Kubernetes API', '—', '—', 'full', 'hidden (KEDA, Dapr, Envoy underneath)', '—'],
    ['Typical Java fit', 'legacy, special agents', 'event handlers, glue, schedulers', 'big platforms, many teams', 'microservices, agents, jobs', 'classic Spring Boot web apps']
  ];
  function drawTable(hi) {
    tbl.innerHTML = '';
    const th = el('tr', null, el('th', { text: '' }), COLS.map(([k, l]) => el('th', { text: l, style: k === hi ? { color: 'var(--accent)' } : null })));
    const body = el('tbody', null, ROWS.map((r) => el('tr', null, r.map((c, i) => el('td', { text: c, style: i && COLS[i - 1][0] === hi ? { background: 'var(--accent-soft)' } : null })))));
    tbl.append(el('table', { class: 't' }, el('thead', null, th), body));
  }
  function build() {
    stage.innerHTML = ''; clearZ();
    const g = svg('g'); const e = svg('g'); const lb = svg('g');
    const Q = ['Need OS-level control?', 'Short, event-triggered units of work?', 'Need the Kubernetes API itself?', 'Shipping a container image?'];
    const QS = ['OS agents, kernel, licences, drivers', 'queue msg, blob, timer, HTTP burst', 'CRDs, operators, mesh, DaemonSets', 'or a JAR/WAR code deploy'];
    Q.forEach((q, i) => node(g, 'q' + i, 176, 8 + i * 84, 300, 52, q, QS[i]));
    node(g, 'vm', 8, 10, 140, 48, 'VMs / VMSS', 'IaaS');
    node(g, 'fn', 8, 94, 140, 48, 'Azure Functions', 'Flex Consumption');
    node(g, 'aks', 8, 178, 140, 48, 'AKS', 'managed Kubernetes');
    node(g, 'aca', 496, 262, 136, 48, 'Container Apps', 'serverless containers');
    node(g, 'app', 176, 344, 300, 46, 'App Service', 'PaaS web apps, JAR deploy');
    ['vm', 'fn', 'aks'].forEach((id, i) => { hlink(e, 'y' + i, 'q' + i, id); lb.append(svg('text', { class: 'lbl m', x: 154, y: 28 + i * 84, text: 'yes' })); });
    [0, 1, 2].forEach((i) => { link(e, 'n' + i, 'q' + i, 'q' + (i + 1)); lb.append(svg('text', { class: 'lbl m', x: 332, y: 74 + i * 84, text: 'no' })); });
    hlink(e, 'y3', 'q3', 'aca'); lb.append(svg('text', { class: 'lbl m', x: 478, y: 280, text: 'yes' }));
    link(e, 'n3', 'q3', 'app'); lb.append(svg('text', { class: 'lbl m', x: 332, y: 326, text: 'no' }));
    stage.append(e, lb, g, pkt);
    drawTable(null);
  }
  const LEAF = ['vm', 'fn', 'aks', 'aca'];
  const NOTE = {
    vm: '<b>VMs or VM Scale Sets.</b> You own patching, hardening and scaling. Ask again later: can the agent run as a sidecar? Then Container Apps or AKS might work.',
    fn: '<b>Azure Functions</b> on <b>Flex Consumption</b>: per-event scaling, scale to zero, VNet integration and always-ready instances when cold starts hurt. Keep each function short and idempotent; use Durable Functions for workflows.',
    aks: '<b>AKS.</b> You get the whole Kubernetes ecosystem, and you also own upgrades, node pools, networking choices and policy. Choose it for a platform, not for one service.',
    aca: '<b>Container Apps</b>: revisions with traffic splitting, KEDA scale rules (including to zero), Dapr, jobs, managed identity, and GPU workload profiles where the region offers them. Kubernetes runs underneath, but you never touch it.',
    app: '<b>App Service</b> (Linux, Java SE 21): deploy the JAR, use slots for zero-downtime swaps, built-in auth, autoscale. Container Apps would also fit once the team ships images.'
  };
  function plan() {
    const A = cum(); const S = []; const c = CASES[cs];
    let i = 0;
    for (; i < c.a.length; i++) {
      const yes = c.a[i] === 1;
      S.push({ ...A.set({ ['q' + i]: 'hot' }), t: `<b>Q${i + 1}.</b> ${c.why[i]} → <b>${yes ? 'yes' : 'no'}</b>` });
      if (yes) {
        const leaf = LEAF[i];
        S.push({ fly: ['q' + i, leaf], ...A.set({ ['q' + i]: 'ok', ['y' + i]: 'ok', [leaf]: 'ok' }), run: () => drawTable(leaf), t: NOTE[leaf], cls: 'ok' });
        return S;
      }
      if (i < 3) S.push({ fly: ['q' + i, 'q' + (i + 1)], ...A.set({ ['q' + i]: 'dim', ['n' + i]: 'hot', ['y' + i]: 'dim', [LEAF[i]]: 'dim' }), t: `No → next question.` });
    }
    S.push({ fly: ['q3', 'app'], ...A.set({ q3: 'dim', n3: 'ok', y3: 'dim', aca: 'dim', app: 'ok' }), run: () => drawTable('app'), t: NOTE.app, cls: 'ok' });
    return S;
  }
  const intro = () => `Workload: <b>${CASES[cs].label}</b>. Press Play to walk the tree, or pick another workload.`;
  root.append(el('div', { class: 'w-controls' }, segC), el('div', { class: 'w-stage' }, stage), controls, narr, tbl,
    el('div', { class: 'tiny', style: { marginTop: '6px' }, text: 'A starting point, not a law. Team skills, existing platforms, networking and cost often decide between two good answers.' }));
  const reset = makeStepper(plan, intro, build, 2200);
  reset();
});

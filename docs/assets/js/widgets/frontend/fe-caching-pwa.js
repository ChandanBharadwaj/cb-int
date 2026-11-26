/* Caching: browser cache, CDN and revalidation; the service worker lifecycle; caching strategies. */
IA.widget('fe-caching-pwa', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  // Scene format: nodes [id, x, y, w, h, label, sub?]; edges [id, from, to, label?]; steps { hot, ok, err, dim, txt: {id: label}, cap }
  const SCENES = {
  'HTTP cache & CDN': {
    h: 280, intro: 'Follow <code>GET /api/products</code> through browser cache, CDN and origin. Press Play.',
    nodes: [['br', 20, 40, 150, 60, 'Browser', 'private cache'], ['cdn', 300, 40, 160, 60, 'CDN edge', 'shared cache'],
      ['org', 590, 40, 150, 60, 'Origin', 'Spring Boot'], ['hdr', 20, 170, 720, 70, 'Response headers', '']],
    edges: [['e1', 'br', 'cdn'], ['e2', 'cdn', 'org'], ['e3', 'org', 'cdn'], ['e4', 'cdn', 'br']], hideEdges: true,
    steps: [
      { hot: ['br', 'cdn', 'org', 'e1', 'e2'], txt: { hdr: 'first request: miss everywhere' }, cap: 'Cold caches: the request goes all the way to the origin.' },
      { hot: ['org', 'e3', 'e4'], txt: { hdr: 'Cache-Control: public, max-age=60, s-maxage=300' }, sub: { hdr: 'ETag: "v42" · Vary: Accept-Encoding' }, cap: '<code>max-age</code> is for browsers, <code>s-maxage</code> overrides it for shared caches (CDN). The <code>ETag</code> identifies this version.' },
      { ok: ['br'], txt: { hdr: 'within 60 s: fresh in browser cache' }, sub: { hdr: 'no network request at all' }, cap: 'Reload within a minute: served from the browser cache, zero network.' },
      { hot: ['br', 'cdn', 'e1'], ok: ['cdn'], txt: { hdr: 'after 60 s: browser stale, CDN still fresh (300 s)' }, sub: { hdr: 'CDN answers, origin untouched' }, cap: 'The browser copy is stale; the CDN copy isn’t. The edge answers in a few ms.' },
      { hot: ['cdn', 'org', 'e2', 'e3'], txt: { hdr: 'after 300 s: If-None-Match: "v42" → 304 Not Modified' }, sub: { hdr: 'revalidation: headers only, no body' }, cap: 'Both stale: the CDN revalidates with <code>If-None-Match</code>. Unchanged → <b>304</b> with no body. Cheap, but still a round trip.' },
      { ok: ['hdr'], txt: { hdr: 'stale-while-revalidate=600' }, sub: { hdr: 'serve stale instantly, refresh in the background' }, cap: '<code>stale-while-revalidate</code> hides that round trip: users get the slightly old copy now, the cache refreshes behind the scenes.' }
    ]
  },
  'Service worker lifecycle': {
    h: 270, intro: 'A PWA ships v2 while users have v1 open. Press Play.',
    nodes: [['reg', 20, 30, 150, 56, 'register()', '/sw.js, scope /'], ['inst', 200, 30, 160, 56, 'install', 'precache app shell'],
      ['wait', 390, 30, 160, 56, 'waiting', 'v1 still controls tabs'], ['act', 580, 30, 160, 56, 'activate', 'delete old caches'],
      ['fetch', 300, 160, 260, 70, 'fetch events', 'SW intercepts requests']],
    edges: [['e1', 'reg', 'inst'], ['e2', 'inst', 'wait'], ['e3', 'wait', 'act'], ['e4', 'act', 'fetch']],
    steps: [
      { hot: ['reg', 'e1'], cap: 'The page registers <code>/sw.js</code>. Service workers require HTTPS (localhost is allowed for dev). Later, the browser re-checks <code>sw.js</code> for byte changes on navigation (by default bypassing the HTTP cache for the script itself).' },
      { hot: ['inst', 'e2'], cap: '<code>install</code>: v2 precaches the new app shell into a <b>new</b> cache (<code>shell-v2</code>). If any file fails, install fails and v1 keeps running.' },
      { hot: ['wait', 'e3'], cap: '<b>waiting</b>: v2 is ready but v1 still controls open tabs, so one page never mixes two versions. It activates when all v1 tabs close, or when you call <code>skipWaiting()</code> (often after a “New version, reload?” prompt).' },
      { hot: ['act', 'e4'], cap: '<code>activate</code>: delete old caches. <code>clients.claim()</code> takes control of open pages immediately.' },
      { ok: ['fetch'], txt: { fetch: 'offline: served from Cache Storage' }, sub: { fetch: 'cache-first for assets, network-first for API' }, cap: 'Now every request from the scope goes through the SW’s <code>fetch</code> handler, which can answer from Cache Storage even with no network.' }
    ]
  },
  'Strategies': {
    h: 260, intro: 'Which caching strategy for which request? Step through.',
    nodes: [['req', 20, 100, 140, 56, 'request', ''], ['c', 250, 40, 200, 56, 'Cache Storage', ''], ['n', 250, 160, 200, 56, 'Network', ''],
      ['use', 540, 100, 200, 56, 'Use for', '']],
    edges: [['e1', 'req', 'c'], ['e2', 'req', 'n'], ['e3', 'c', 'n']], hideEdges: true,
    steps: [
      { hot: ['c', 'e1'], txt: { req: 'cache-first', use: 'hashed JS/CSS, fonts' }, sub: { use: 'never changes for a given URL' }, cap: '<b>Cache first</b>: answer from cache, go to network only on a miss. Fastest, risk of staleness (fine for hashed files).' },
      { hot: ['n', 'e2'], ok: ['c'], txt: { req: 'network-first', use: 'API data, HTML' }, sub: { use: 'fresh when online, works offline' }, cap: '<b>Network first</b>: try the network (with a timeout), fall back to the cached copy when offline.' },
      { hot: ['c', 'n', 'e1', 'e3'], txt: { req: 'stale-while-revalidate', use: 'avatars, non-critical JSON' }, sub: { use: 'instant, then updated for next time' }, cap: '<b>Stale-while-revalidate</b>: serve cached copy instantly, fetch a fresh one in the background for next time.' },
      { hot: ['n', 'e2'], txt: { req: 'network-only', use: 'payments, auth, POSTs' }, sub: { use: 'never cache' }, cap: '<b>Network only</b> for anything that must not be stale or replayed. Workbox ships all these strategies ready-made.' }
    ]
  }
};
  const W = 760; let mode = Object.keys(SCENES)[0]; let k = 0; let running = false; let gen = 0;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scenario' });
  Object.keys(SCENES).forEach((m) => { const b = el('button', { text: m, class: m === mode ? 'on' : '' });
    b.addEventListener('click', () => { mode = m; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { role: 'img', 'aria-label': 'Boxes for browser, CDN, origin and service worker stages with arrows for requests' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('span', { class: 'n', text: '0' }), el('div', { class: 't', text: '' }));
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, seg), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, stats);
  const S = () => SCENES[mode];
  const has = (arr, id) => (arr || []).indexOf(id) >= 0;
  function anchor(n, tx, ty) {
    const cx = n[1] + n[3] / 2, cy = n[2] + n[4] / 2; const dx = tx - cx, dy = ty - cy;
    const s = Math.min(dx ? (n[3] / 2 + 4) / Math.abs(dx) : 1e9, dy ? (n[4] / 2 + 4) / Math.abs(dy) : 1e9);
    return [cx + dx * s, cy + dy * s];
  }
  function draw() {
    const sc = S(); const st = k ? sc.steps[k - 1] : (sc.start || {}); const H = sc.h || 300;
    stage.setAttribute('viewBox', `0 0 ${W} ${H}`); stage.innerHTML = '';
    const defs = svg('defs'); ['m-n', 'm-h'].forEach((id, i) => defs.append(svg('marker', { id: id + '-fe-caching-pwa', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M0 0L10 5L0 10z', style: `fill:${i ? 'var(--accent)' : 'var(--text-3)'}` })))); stage.append(defs);
    const byId = {}; sc.nodes.forEach((n) => { byId[n[0]] = n; });
    (sc.edges || []).forEach((e) => {
      const a = byId[e[1]], b = byId[e[2]]; if (!a || !b) return;
      const hot = has(st.hot, e[0]), err = has(st.err, e[0]), ok = has(st.ok, e[0]), dim = has(st.dim, e[0]) || (sc.hideEdges && !hot && !err && !ok);
      const [x1, y1] = anchor(a, b[1] + b[3] / 2, b[2] + b[4] / 2); const [x2, y2] = anchor(b, a[1] + a[3] / 2, a[2] + a[4] / 2);
      const col = err ? 'var(--err)' : ok ? 'var(--ok)' : hot ? 'var(--accent)' : 'var(--border)';
      const ln = svg('line', { x1, y1, x2, y2, 'marker-end': `url(#${hot || ok || err ? 'm-h' : 'm-n'}-fe-caching-pwa)`, style: `stroke:${col};stroke-width:${hot || ok || err ? 2.4 : 1.4};opacity:${dim ? 0.15 : 1}` });
      if ((hot || ok || err) && !reduced) { ln.style.strokeDasharray = '6 5'; ln.animate && ln.animate([{ strokeDashoffset: 22 }, { strokeDashoffset: 0 }], { duration: 700, iterations: Infinity }); }
      stage.append(ln);
      const lab = (st.etxt || {})[e[0]] != null ? st.etxt[e[0]] : e[3];
      if (lab && !dim) stage.append(svg('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 5, 'text-anchor': 'middle', 'font-size': 11, style: `fill:${hot || ok || err ? col : 'var(--text-3)'}`, text: lab }));
    });
    sc.nodes.forEach((n) => {
      const id = n[0]; const hot = has(st.hot, id), ok = has(st.ok, id), err = has(st.err, id), dim = has(st.dim, id);
      const col = err ? 'var(--err)' : ok ? 'var(--ok)' : hot ? 'var(--accent)' : 'var(--border)';
      const g = svg('g', { style: `opacity:${dim ? 0.3 : 1};transition:opacity .4s` });
      g.append(svg('rect', { x: n[1], y: n[2], width: n[3], height: n[4], rx: 8, style: `fill:${hot || ok || err ? 'var(--accent-soft)' : 'var(--surface-2)'};stroke:${col};stroke-width:${hot || ok || err ? 2.2 : 1.2};transition:all .4s` }));
      const label = (st.txt || {})[id] != null ? st.txt[id] : n[5]; const sub = (st.sub || {})[id] != null ? st.sub[id] : n[6];
      const cx = n[1] + n[3] / 2; const lines = String(label).split('\n');
      const base = n[2] + n[4] / 2 - (lines.length - 1) * 7 - (sub ? 6 : 0) + 5;
      lines.forEach((t, i) => g.append(svg('text', { x: cx, y: base + i * 14, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, style: `fill:${err ? 'var(--err)' : 'var(--text)'}`, text: t })));
      if (sub) g.append(svg('text', { x: cx, y: base + (lines.length - 1) * 14 + 15, 'text-anchor': 'middle', 'font-size': 10.5, style: 'fill:var(--text-3)', text: sub }));
      stage.append(g);
    });
    narr.firstChild.textContent = String(k); narr.lastChild.innerHTML = st.cap || sc.intro || 'Press Play or Step.';
    narr.className = 'caption' + (st.err && st.err.length ? ' err' : st.ok && st.ok.length ? ' ok' : '');
    stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `step <b>${k}</b>/${sc.steps.length}` }));
    (st.stats || []).forEach(([l, v]) => stats.append(el('span', { class: 'w-stat', html: `${l} <b>${v}</b>` })));
    bStep.disabled = k >= sc.steps.length;
  }
  function step() { if (k >= S().steps.length) return false; k++; draw(); return true; }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; draw(); }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= S().steps.length) reset();
    if (reduced) { k = S().steps.length; draw(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(2600);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

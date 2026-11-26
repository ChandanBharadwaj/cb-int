/* One request per rendering mode: where HTML is produced, when, and what the browser must do before content appears. */
IA.widget('fe-rendering-modes', (root, ctx) => {
  const NS = () => [
    { id: 'br', x: 20, y: 120, w: 170, h: 70, t: 'Browser', s: '' },
    { id: 'cdn', x: 235, y: 120, w: 170, h: 70, t: 'CDN / edge', s: '' },
    { id: 'srv', x: 450, y: 30, w: 170, h: 70, t: 'App server', s: '' },
    { id: 'api', x: 450, y: 210, w: 170, h: 70, t: 'API / DB', s: '' }];
  const ED = [['br', 'cdn'], ['cdn', 'srv'], ['srv', 'api'], ['br', 'api']];
  const S = {
    W: 640, H: 300, aria: 'Browser, CDN, app server and API boxes with request flow', segLabel: 'Mode',
    modes: {
      csr: { label: 'CSR', nodes: NS(), edges: ED, frames: [
        { on: { br: 'acc', cdn: 'ok' }, e: { 'br>cdn': 'acc' }, s: { cdn: 'index.html (empty div)' }, cap: 'CSR: the CDN returns an almost empty HTML shell instantly. Fast TTFB, but nothing to see.' },
        { on: { br: 'warn' }, s: { br: 'download + run JS' }, cap: 'The browser downloads the JS bundle, parses and runs it. Users see a blank page or spinner.', tone: 'warn' },
        { on: { api: 'acc' }, e: { 'br>api': 'acc' }, s: { br: 'fetch /api/products' }, cap: 'Only after the app boots does it fetch data: a waterfall (HTML → JS → data).' },
        { on: { br: 'ok' }, s: { br: 'renders content' }, cap: 'Content appears last. Crawlers that do not run JS see nothing. Great for apps behind login (dashboards).', stat: [['HTML built', 'in browser'], ['content visible', 'after JS + data']] }] },
      ssr: { label: 'SSR', nodes: NS(), edges: ED, frames: [
        { on: { br: 'acc', cdn: 'dim', srv: 'acc' }, e: { 'br>cdn': 'acc', 'cdn>srv': 'acc' }, s: { srv: 'render per request' }, cap: 'SSR: every request reaches the server, which renders HTML for this user, now.' },
        { on: { api: 'acc' }, e: { 'srv>api': 'acc' }, s: { api: 'server-side fetch' }, cap: 'Data is fetched server-side, close to the DB (no browser waterfall). TTFB includes this time.', tone: 'warn' },
        { on: { br: 'ok' }, s: { br: 'full HTML painted' }, cap: 'Full HTML arrives and paints early. Then JS downloads and hydrates to make it interactive.' },
        { s: { br: 'hydrated' }, cap: 'Fresh, personalised and SEO-friendly; costs server CPU on every request and harder caching.', tone: 'ok', stat: [['HTML built', 'per request'], ['freshness', 'always'], ['TTFB', 'server time']] }] },
      ssg: { label: 'SSG', nodes: NS(), edges: ED, frames: [
        { on: { srv: 'acc', api: 'acc' }, e: { 'srv>api': 'acc' }, s: { srv: 'build: render all pages' }, cap: 'SSG: at build time (CI), every page is rendered to a static HTML file.' },
        { on: { srv: 'dim', api: 'dim', cdn: 'ok' }, s: { cdn: '/p/42.html cached' }, cap: 'The files are uploaded to a CDN. No app server is in the request path at all.' },
        { on: { br: 'ok' }, e: { 'br>cdn': 'ok' }, s: { br: 'instant HTML' }, cap: 'Requests are pure CDN hits: fastest and cheapest. But data is as old as the last build, and 100k pages mean long builds.', tone: 'ok', stat: [['HTML built', 'at build'], ['freshness', 'until next deploy']] }] },
      isr: { label: 'ISR / revalidate', nodes: NS(), edges: ED, frames: [
        { on: { cdn: 'ok', br: 'ok' }, e: { 'br>cdn': 'ok' }, s: { cdn: 'cached, age 30s' }, cap: 'ISR (Next.js “revalidate”): pages are static and cached, but with a lifetime, e.g. revalidate = 60 seconds.' },
        { on: { cdn: 'warn' }, s: { cdn: 'age 75s: stale' }, cap: 'After 60s the page is stale. The next visitor still gets the stale copy immediately (stale-while-revalidate).', tone: 'warn' },
        { on: { srv: 'acc', api: 'acc' }, e: { 'cdn>srv': 'acc', 'srv>api': 'acc' }, s: { srv: 'regenerate in background' }, cap: 'In the background the server re-renders that one page with fresh data.' },
        { on: { cdn: 'ok', srv: 'dim', api: 'dim' }, s: { cdn: 'fresh copy, age 0' }, cap: 'The new HTML replaces the cached one for later visitors. On-demand revalidation (revalidatePath / revalidateTag) can refresh on a CMS webhook instead of a timer.', tone: 'ok', stat: [['HTML built', 'build + on expiry'], ['freshness', '≤ window (stale served once)']] }] }
    }
  };
  /* Generic step-through stage: modes → nodes, edges and cumulative frames. */
  const { el, svg, sleep, reduced } = ctx;
  const COL = { ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--err)', acc: 'var(--accent)', off: 'var(--border)' };
  const keys = Object.keys(S.modes); let mode = keys[0]; let k = 0; let gen = 0; let running = false;
  const seg = el('div', { class: 'seg', 'aria-label': S.segLabel || 'Variant' });
  keys.forEach((v) => { const b = el('button', { text: S.modes[v].label, class: v === mode ? 'on' : '' }); b.addEventListener('click', () => { mode = v; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeEl = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const st = svg('svg', { viewBox: `0 0 ${S.W} ${S.H}`, role: 'img', 'aria-label': S.aria });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('span', { class: 'n', text: '0' }), el('div', { class: 't', text: '' }));
  const stats = el('div', { class: 'w-stats' });
  root.append(keys.length > 1 ? el('div', { class: 'w-controls' }, seg) : null, codeEl, el('div', { class: 'w-stage' }, st), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, stats);
  let N = {}; let E = {};
  const tr = reduced ? 'none' : 'all .6s ease';
  function draw() {
    st.innerHTML = ''; N = {}; E = {}; const M = S.modes[mode];
    const byId = {}; M.nodes.forEach((n) => { byId[n.id] = n; });
    (M.edges || []).forEach(([a, b]) => { const A = byId[a]; const B = byId[b];
      const l = svg('line', { x1: A.x + A.w / 2, y1: A.y + A.h / 2, x2: B.x + B.w / 2, y2: B.y + B.h / 2, stroke: 'var(--border)', 'stroke-width': 3, style: { transition: tr } });
      st.append(l); E[a + '>' + b] = l; });
    M.nodes.forEach((n) => {
      const g = svg('g', { style: { transition: tr } });
      const r = svg('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 10, fill: n.fill || 'var(--surface-2)', stroke: 'var(--border)', 'stroke-width': 2, 'stroke-dasharray': n.dash ? '7 5' : '', style: { transition: tr } });
      const fs = n.fs || 16;
      const t = svg('text', { x: n.x + 10, y: n.y + fs + 6, 'font-size': fs, 'font-weight': 700, fill: 'var(--text)', text: n.t || '' });
      const s = svg('text', { x: n.x + 10, y: n.y + fs * 2 + 10, 'font-size': fs - 3, fill: 'var(--text-2)', text: n.s || '' });
      g.append(r, t, s); st.append(g); N[n.id] = { g, r, t, s, n };
      if (n.hide) g.style.opacity = '0';
    });
  }
  function apply(f) {
    Object.entries(f.on || {}).forEach(([id, c]) => { const x = N[id]; if (!x) return;
      if (c === 'hide') { x.g.style.opacity = '0'; return; }
      if (c === 'dim') { x.g.style.opacity = '0.35'; return; }
      x.g.style.opacity = '1'; x.r.setAttribute('stroke', COL[c] || c); x.r.setAttribute('stroke-width', c === 'off' ? 2 : 3.5);
      x.r.setAttribute('fill', c === 'off' ? (x.n.fill || 'var(--surface-2)') : 'var(--accent-soft)'); });
    Object.entries(f.e || {}).forEach(([id, c]) => { const l = E[id]; if (l) { l.setAttribute('stroke', COL[c] || c); l.setAttribute('stroke-dasharray', c === 'off' ? '' : '6 5'); } });
    Object.entries(f.t || {}).forEach(([id, v]) => { if (N[id]) N[id].t.textContent = v; });
    Object.entries(f.s || {}).forEach(([id, v]) => { if (N[id]) N[id].s.textContent = v; });
    Object.entries(f.geo || {}).forEach(([id, [x, y, w, h]]) => { const q = N[id]; if (!q) return; const fs = q.n.fs || 16;
      q.r.setAttribute('x', x); q.r.setAttribute('y', y); q.r.setAttribute('width', w); q.r.setAttribute('height', h);
      q.t.setAttribute('x', x + 10); q.t.setAttribute('y', y + fs + 6); q.s.setAttribute('x', x + 10); q.s.setAttribute('y', y + fs * 2 + 10); });
  }
  function show() {
    const M = S.modes[mode]; draw(); stats.innerHTML = ''; let statList = null;
    for (let i = 0; i < k; i++) { apply(M.frames[i]); if (M.frames[i].stat) statList = M.frames[i].stat; }
    narr.firstChild.textContent = String(k); narr.className = 'caption' + (k && M.frames[k - 1].tone ? ' ' + M.frames[k - 1].tone : '');
    narr.lastChild.textContent = k ? M.frames[k - 1].cap : (M.start || S.start || 'Press Play, or Step through it.');
    (statList || []).forEach(([l, v]) => stats.append(el('span', { class: 'w-stat', html: `${l} <b>${v}</b>` })));
    bStep.disabled = k >= M.frames.length;
  }
  function step() { if (k >= S.modes[mode].frames.length) return false; k++; show(); return true; }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    const M = S.modes[mode]; codeEl.style.display = M.code ? '' : 'none'; codeEl.innerHTML = '';
    if (M.code) codeEl.append(el('pre', { html: IA.highlight(M.code, M.lang || 'ts') }));
    if (reduced) { k = 0; } show(); }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (reduced) { k = S.modes[mode].frames.length; show(); return; }
    if (k >= S.modes[mode].frames.length) reset(); running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(S.speed || 2600);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

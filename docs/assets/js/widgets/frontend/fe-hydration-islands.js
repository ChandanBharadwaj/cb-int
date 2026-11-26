/* Same product page, four strategies: which components ship and run JS, and when. Grey = static HTML, amber = JS downloading/hydrating, green = interactive. */
IA.widget('fe-hydration-islands', (root, ctx) => {
  const PG = () => [
    { id: 'hdr', x: 20, y: 10, w: 600, h: 46, t: 'Header (static)', s: '' },
    { id: 'gal', x: 20, y: 66, w: 290, h: 110, t: 'Image carousel', s: 'interactive' },
    { id: 'art', x: 330, y: 66, w: 290, h: 110, t: 'Description', s: 'static text' },
    { id: 'buy', x: 20, y: 186, w: 290, h: 56, t: 'Add to cart', s: 'interactive' },
    { id: 'rev', x: 330, y: 186, w: 290, h: 56, t: 'Reviews', s: 'below the fold' },
    { id: 'ftr', x: 20, y: 252, w: 600, h: 46, t: 'Footer (static)', s: '' }];
  const S = {
    W: 640, H: 310, aria: 'A product page made of components; colours show which hydrate', segLabel: 'Strategy',
    modes: {
      full: { label: 'Full hydration', nodes: PG(), frames: [
        { on: { hdr: 'off', gal: 'off', art: 'off', buy: 'off', rev: 'off', ftr: 'off' }, cap: 'SSR HTML is painted. It looks done, but no button works yet: event handlers are not attached.', stat: [['JS', '0 KB yet']] },
        { on: { hdr: 'warn', gal: 'warn', art: 'warn', buy: 'warn', rev: 'warn', ftr: 'warn' }, cap: 'The whole app’s JS downloads. Hydration re-runs every component on the client to rebuild the tree and attach listeners, static ones included.', tone: 'warn', stat: [['JS', 'whole app ~300 KB'], ['main thread', 'one long task']] },
        { on: { hdr: 'ok', gal: 'ok', art: 'ok', buy: 'ok', rev: 'ok', ftr: 'ok' }, cap: 'Everything is interactive at once. Clicks during the long hydration task wait → poor INP. The “uncanny valley”: looks ready, isn’t.', tone: 'err' }] },
      prog: { label: 'Progressive', nodes: PG(), frames: [
        { on: { buy: 'warn' }, cap: 'Progressive / selective hydration (React 18+ with Suspense boundaries): hydrate in chunks, highest priority first, yielding between them.' },
        { on: { buy: 'ok', gal: 'warn' }, cap: 'React also bumps a boundary’s priority if the user interacts with it before it hydrated, and replays the event.', tone: 'ok' },
        { on: { gal: 'ok', rev: 'warn', hdr: 'warn', art: 'warn', ftr: 'warn' }, cap: 'Remaining parts hydrate during idle time. Still the whole app’s JS in the end, but no single blocking task.' },
        { on: { rev: 'ok', hdr: 'ok', art: 'ok', ftr: 'ok' }, cap: 'Better responsiveness, same total bytes.', stat: [['JS', 'whole app, chunked']] }] },
      islands: { label: 'Islands (Astro)', lang: 'text', code: '---\nimport Carousel from "./Carousel.tsx"; import Buy from "./Buy.tsx"; import Reviews from "./Reviews.tsx";\n---\n<Carousel client:load />\n<Buy client:idle />\n<Reviews client:visible />\n<p>Description is plain HTML: 0 JS</p>', nodes: PG(), frames: [
        { on: { hdr: 'dim', art: 'dim', ftr: 'dim' }, cap: 'Astro renders everything to HTML and ships 0 JS by default. Only components with a client:* directive become islands.', tone: 'ok' },
        { on: { gal: 'warn' }, s: { gal: 'client:load' }, cap: 'client:load hydrates the carousel island right away, independently of the rest.' },
        { on: { gal: 'ok', buy: 'ok' }, s: { buy: 'client:idle' }, cap: 'client:idle waits for requestIdleCallback before hydrating Add to cart.' },
        { on: { rev: 'ok' }, s: { rev: 'client:visible' }, cap: 'client:visible hydrates Reviews only when it scrolls into view (IntersectionObserver). Static parts never ship JS.', tone: 'ok', stat: [['JS', 'only 3 islands'], ['static parts', '0 KB']] }] },
      resume: { label: 'Resumability (Qwik)', lang: 'text', code: '<button on:click="q-chunk-a1b2.js#addToCart" q:id="7">Add to cart</button>\n<!-- state serialised into the HTML; no component re-runs on load -->', nodes: PG(), frames: [
        { on: { hdr: 'dim', gal: 'dim', art: 'dim', buy: 'dim', rev: 'dim', ftr: 'dim' }, cap: 'Qwik serialises listeners and state into the HTML. On load it executes no component code; a ~1 KB global loader listens for events.', tone: 'ok', stat: [['JS at load', '~1 KB loader']] },
        { on: { buy: 'warn' }, s: { buy: 'click → fetch handler chunk' }, cap: 'User clicks Add to cart. The loader reads on:click, fetches just that handler chunk (usually already prefetched by a service worker) and runs it.' },
        { on: { buy: 'ok' }, s: { buy: 'handled, nothing re-rendered' }, cap: 'The app “resumes” where the server stopped. No hydration pass at all, so cost is O(interaction), not O(page).', tone: 'ok' },
        { on: { gal: 'ok' }, s: { gal: 'its chunk loads on first swipe' }, cap: 'Trade-off: the first interaction may need a network fetch (mitigated by prefetch), and serialised state grows the HTML.', tone: 'warn' }] }
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

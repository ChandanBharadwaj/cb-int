/* Three kinds of state: local useState, a global client store, and a server-state cache (TanStack Query) with staleness, dedupe and invalidation. */
IA.widget('fe-state-management', (root, ctx) => {
  const T = () => [
    { id: 'app', x: 220, y: 10, w: 200, h: 54, t: 'App', s: '' },
    { id: 'hdr', x: 20, y: 100, w: 180, h: 54, t: 'Header', s: 'cart badge' },
    { id: 'list', x: 230, y: 100, w: 180, h: 54, t: 'ProductList', s: '' },
    { id: 'card', x: 230, y: 190, w: 180, h: 54, t: 'ProductCard', s: '' },
    { id: 'side', x: 440, y: 100, w: 180, h: 54, t: 'Sidebar', s: '' },
    { id: 'store', x: 20, y: 230, w: 180, h: 60, t: 'store / cache', s: '', dash: true },
    { id: 'api', x: 440, y: 230, w: 180, h: 60, t: 'Server API', s: '' }];
  const ED = [['app', 'hdr'], ['app', 'list'], ['app', 'side'], ['list', 'card']];
  const S = {
    W: 640, H: 300, aria: 'Component tree with a store and a server API', segLabel: 'State kind',
    modes: {
      local: { label: 'Local', code: 'function ProductCard() {\n  const [open, setOpen] = useState(false); // only this card cares\n}', nodes: T(), edges: ED, frames: [
        { on: { card: 'acc', store: 'hide', api: 'dim' }, s: { card: 'open = false' }, cap: 'UI state used by one component (is this accordion open?) belongs in that component.' },
        { on: { card: 'ok' }, s: { card: 'open = true' }, cap: 'Changing it re-renders only ProductCard and its children. Nobody else knows or cares.', tone: 'ok' },
        { on: { hdr: 'warn', side: 'warn' }, cap: 'If two distant components need it, lift it to their common parent… which is App here: now every change re-renders a wide subtree and props are drilled through layers.', tone: 'warn' }] },
      global: { label: 'Global store', code: "const useCart = create<Cart>((set) => ({\n  items: [], add: (p) => set((s) => ({ items: [...s.items, p] })),\n}));\nconst count = useCart((s) => s.items.length); // selector", nodes: T(), edges: ED, frames: [
        { on: { store: 'acc', api: 'dim' }, t: { store: 'cart store' }, s: { store: 'Zustand / Pinia / Redux' }, cap: 'Client state shared across the app (cart, theme, wizard steps) lives in a store outside the tree.' },
        { on: { card: 'acc' }, s: { card: 'add(product)' }, cap: 'ProductCard calls add(). The store updates immutably and notifies subscribers.' },
        { on: { hdr: 'ok', list: 'dim', side: 'dim' }, s: { hdr: 'badge: 3' }, cap: 'Only components whose selector result changed re-render: Header’s badge. ProductList and Sidebar are untouched.', tone: 'ok' },
        { on: { side: 'err' }, s: { side: 'useCart() → whole object' }, cap: 'Trap: subscribing to the whole store (or returning a new object from a selector) re-renders on every change. Select the smallest value.', tone: 'err' }] },
      server: { label: 'Server state (Query)', code: "const q = useQuery({ queryKey: ['products', page], queryFn: fetchProducts, staleTime: 30_000 });\nconst m = useMutation({ mutationFn: save,\n  onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }) });", nodes: T(), edges: ED, frames: [
        { on: { list: 'acc', side: 'acc', store: 'acc' }, t: { store: 'QueryClient cache' }, s: { store: "['products',1]: loading" }, cap: 'Two components call useQuery with the same key. The requests are de-duplicated: one fetch.' },
        { on: { api: 'acc' }, s: { api: 'GET /products?page=1' }, cap: 'Server state is a cache of data you don’t own. The server is the source of truth.' },
        { on: { list: 'ok', side: 'ok', store: 'ok' }, s: { store: 'fresh (staleTime 30s)' }, cap: 'Both render from cache. Within staleTime no refetch happens on remount.', tone: 'ok' },
        { on: { store: 'warn' }, s: { store: 'stale → shown, refetching' }, cap: 'Later the data is stale. On remount, window refocus or reconnect, Query shows cached data instantly and refetches in the background (stale-while-revalidate).', tone: 'warn' },
        { on: { card: 'acc', api: 'acc' }, s: { card: 'useMutation(save)', api: 'PUT /products/7' }, cap: 'A mutation saves a product. onSuccess invalidates [\'products\'] → active queries refetch.', },
        { on: { store: 'ok', card: 'ok' }, s: { store: 'fresh again' }, cap: 'No hand-written loading flags, caching or sync code. Rule: do not copy server data into a global store; let the query cache own it.', tone: 'ok', stat: [['fetches', 'deduped'], ['gcTime default', '5 min'], ['staleTime default', '0']] }] }
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

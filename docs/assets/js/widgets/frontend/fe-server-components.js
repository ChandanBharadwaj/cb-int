/* React Server Components in the Next.js App Router: the server/client split, streaming with Suspense, and a server action round-trip. */
IA.widget('fe-server-components', (root, ctx) => {
  const T = () => [
    { id: 'page', x: 220, y: 10, w: 200, h: 56, t: 'Page', s: 'server' },
    { id: 'hdr', x: 10, y: 110, w: 190, h: 56, t: 'Header', s: 'server' },
    { id: 'prod', x: 225, y: 110, w: 190, h: 56, t: 'ProductInfo', s: 'server · await db' },
    { id: 'rev', x: 440, y: 110, w: 190, h: 56, t: '<Suspense> Reviews', s: 'server · slow API' },
    { id: 'cart', x: 225, y: 210, w: 190, h: 56, t: 'AddToCart', s: "'use client'" },
    { id: 'db', x: 440, y: 230, w: 190, h: 56, t: 'DB / API', s: '' }];
  const ED = [['page', 'hdr'], ['page', 'prod'], ['page', 'rev'], ['prod', 'cart'], ['prod', 'db'], ['rev', 'db']];
  const S = {
    W: 640, H: 300, aria: 'Component tree with server components, a client component and a data source', segLabel: 'Flow',
    modes: {
      split: { label: 'Server vs client', code: "// AddToCart.tsx\n'use client';\nexport function AddToCart({ id }: { id: string }) {\n  const [n, setN] = useState(1); /* … */\n}", nodes: T(), edges: ED, frames: [
        { on: { page: 'acc', hdr: 'acc', prod: 'acc', rev: 'acc' }, cap: 'In the App Router every component is a Server Component by default. They run only on the server (at build or request time) and may be async.' },
        { on: { db: 'acc' }, e: { 'prod>db': 'acc' }, cap: 'ProductInfo awaits the DB directly: no API route, no useEffect fetch, and secrets/ORM code never reach the browser bundle.' },
        { on: { cart: 'warn' }, cap: "'use client' marks a boundary: AddToCart and everything it imports become client code (bundled, SSR’d to HTML, then hydrated)." , tone: 'warn' },
        { on: { page: 'ok', hdr: 'ok', prod: 'ok', rev: 'ok' }, s: { page: 'RSC payload' }, cap: 'Server output is serialised into the RSC payload (“Flight”): a tree description with holes referencing client components and their props.' },
        { on: { cart: 'ok' }, cap: 'The browser renders the payload. Only AddToCart’s JS ships and hydrates. Props crossing the boundary must be serialisable (no functions, except server actions).', tone: 'ok', stat: [['JS shipped for', 'AddToCart only'], ['server comps', '0 KB JS']] }] },
      stream: { label: 'Streaming + Suspense', code: 'export default function Page() {\n  return (<>\n    <ProductInfo />\n    <Suspense fallback={<Spinner />}>\n      <Reviews />        {/* slow */}\n    </Suspense>\n  </>);\n}', nodes: T(), edges: ED, frames: [
        { on: { page: 'acc', hdr: 'ok', prod: 'ok' }, cap: 'The server renders what is ready. Reviews suspends (its await is slow), so its Suspense fallback is used.' },
        { on: { rev: 'warn' }, s: { rev: 'fallback: spinner' }, cap: 'The first chunk of HTML (shell + spinner) is flushed right away over one HTTP response (chunked transfer). TTFB is not held hostage by the slowest query.', tone: 'warn' },
        { on: { db: 'acc' }, e: { 'rev>db': 'acc' }, s: { db: 'reviews API: 1.8s' }, cap: 'The connection stays open while the reviews fetch finishes.' },
        { on: { rev: 'ok' }, s: { rev: 'streamed in' }, cap: 'React streams the finished HTML plus a tiny inline script that swaps it into place of the fallback. loading.tsx is a Suspense boundary around a whole route segment.', tone: 'ok', stat: [['responses', '1, streamed'], ['first paint', 'not blocked by Reviews']] }] },
      action: { label: 'Server action', code: "// actions.ts\n'use server';\nexport async function addToCart(fd: FormData) {\n  const user = await auth();              // re-check auth: it's a public endpoint\n  await db.cart.add(user.id, fd.get('id'));\n  revalidatePath('/cart');\n}", nodes: T(), edges: ED, frames: [
        { on: { cart: 'acc' }, s: { cart: '<form action={addToCart}>' }, cap: 'A server action is an async function marked “use server”. Passed to <form action>, it works even before JS loads (progressive enhancement).' },
        { on: { page: 'acc' }, e: { 'prod>cart': 'acc' }, s: { page: 'POST (action id)' }, cap: 'Submitting sends a POST to the same route with an action ID. The framework generated that endpoint for you: treat it as public, validate input and check auth.', tone: 'warn' },
        { on: { db: 'acc' }, e: { 'prod>db': 'acc' }, s: { db: 'INSERT cart_item' }, cap: 'The action runs on the server and writes to the DB.' },
        { on: { page: 'ok', prod: 'ok', cart: 'ok', db: 'ok' }, s: { page: 'fresh RSC payload' }, cap: 'revalidatePath invalidates cached data; the response carries the updated RSC payload, so the UI updates in one round-trip. useActionState / useFormStatus (React 19) expose pending state and results.', tone: 'ok' }] }
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

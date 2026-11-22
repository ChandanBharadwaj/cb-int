/* Scopes: the prototype-in-singleton trap vs ObjectProvider vs a request-scoped proxy, across three HTTP requests. */
IA.widget('bean-lifecycle-scopes-scopes', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-bsc-style')) {
    document.head.append(el('style', { id: 'w-bsc-style', text: `
.w-bsc svg text { font-family: var(--mono); }
.w-bsc .bx { fill: var(--surface); stroke: var(--border); stroke-width: 1.6; transition: fill .3s, stroke .3s; }
.w-bsc .bx.hot { stroke: var(--accent); stroke-width: 2.6; fill: var(--accent-soft); }
.w-bsc .bx.bad { stroke: var(--err); stroke-width: 2.4; fill: color-mix(in srgb, var(--err) 12%, var(--surface)); }
.w-bsc .bx.gone { opacity: .35; stroke-dasharray: 5 4; }
.w-bsc .bx.prx { fill: var(--accent-soft); stroke: var(--accent); stroke-dasharray: 6 4; }
.w-bsc .ln { fill: none; stroke: var(--edge); stroke-width: 1.6; }
.w-bsc .ln.hot { stroke: var(--accent); stroke-width: 2.6; }
.w-bsc .ln.bad { stroke: var(--err); stroke-width: 2.4; stroke-dasharray: 6 4; }
` }));
  }
  const USERS = [['Asha', 'book'], ['Ben', 'mug'], ['Chen', 'pen']];
  const MODES = {
    inject: { label: 'prototype, injected', code: '@Component @Scope("prototype") class Cart { … }\n\n@RestController class CartController {\n  private final Cart cart;            // injected ONCE\n  CartController(Cart cart) { this.cart = cart; }\n}' },
    provider: { label: 'ObjectProvider<Cart>', code: '@Component @Scope("prototype") class Cart { … }\n\n@RestController class CartController {\n  private final ObjectProvider<Cart> carts;\n  @PostMapping("/cart") void add(…) { carts.getObject().add(item); }\n}' },
    request: { label: '@RequestScope (proxy)', code: '@Component @RequestScope          // proxyMode = TARGET_CLASS\nclass Cart { … }\n\n@RestController class CartController {\n  private final Cart cart;            // a CGLIB scoped proxy\n  CartController(Cart cart) { this.cart = cart; }\n}' },
    noproxy: { label: 'request scope, no proxy', code: '@Component @Scope("request")       // proxyMode = DEFAULT (NO)\nclass Cart { … }\n\n@RestController class CartController {\n  CartController(Cart cart) { … }     // at startup: no request!\n}' }
  };
  let mode = 'inject'; let k = 0; let gen = 0; let running = false; let speed = 2400; let st; let steps = [];
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segM = seg(Object.keys(MODES).map((m) => [m, MODES[m].label]), mode, (v) => { mode = v; reset(); }, 'How Cart is obtained');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 760 270', role: 'img', 'aria-label': 'Three HTTP requests, the singleton controller, and the Cart instances they reach' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const codeHost = el('div', { style: { marginBottom: '10px' } });
  root.classList.add('w-bsc');
  root.append(el('div', { class: 'w-controls' }, segM), codeHost, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr);

  function plan() {
    const S = [];
    if (mode === 'noproxy') {
      S.push({ ctrl: 'bad', carts: [{ id: '?', items: [], st: 'bad' }], line: [['c', 0, 'bad']], tone: 'err', say: 'At startup the singleton controller needs a Cart. Cart is request-scoped, but there is no HTTP request on the main thread: <code>Scope \'request\' is not active for the current thread; consider defining a scoped proxy for this bean if you intend to refer to it from a singleton</code>. Startup fails.' });
      S.push({ tone: 'err', say: 'Fix: <code>@RequestScope</code> (proxy by default), <code>@Scope(value = "request", proxyMode = ScopedProxyMode.TARGET_CLASS)</code>, or inject <code>ObjectProvider&lt;Cart&gt;</code> and look it up inside the request.' });
      return S;
    }
    if (mode === 'inject') S.push({ ctrl: '', carts: [{ id: 1, items: [], st: '' }], line: [['c', 0, '']], say: 'Startup: the singleton controller is created once, and its constructor needs a Cart. Prototype means “new instance <b>per injection</b>”, and there is exactly one injection: Cart#1.' });
    if (mode === 'provider') S.push({ ctrl: '', carts: [], line: [], say: 'Startup: the controller holds an <code>ObjectProvider&lt;Cart&gt;</code>, a small factory handle. No Cart exists yet.' });
    if (mode === 'request') S.push({ ctrl: 'prx', carts: [], line: [], say: 'Startup: the controller receives a <b>scoped proxy</b> (a CGLIB subclass of Cart). The proxy holds no data. On every method call it looks up the real Cart in the current request’s attributes.' });
    USERS.forEach(([u, item], i) => {
      const prev = S[S.length - 1]; const carts = prev.carts.map((c) => ({ ...c, items: [...c.items], st: c.st === 'hot' ? '' : c.st }));
      let idx; let say;
      if (mode === 'inject') { idx = 0; carts[0].items.push(`${u}: ${item}`); say = i === 0 ? `Request 1: ${u} adds a ${item}. Cart#1 now holds 1 item.` : `Request ${i + 1}: ${u} adds a ${item} to <b>the same Cart#1</b>. ${u} can see ${i === 1 ? 'Asha’s' : 'everyone’s'} items. This is the prototype-in-singleton trap: shared mutable state across users, and a race under concurrency.`; }
      if (mode === 'provider') { carts.push({ id: i + 1, items: [`${u}: ${item}`], st: '' }); idx = carts.length - 1; say = `Request ${i + 1}: <code>getObject()</code> creates Cart#${i + 1}, with full init callbacks. ${i === 2 ? 'Each call gets a fresh cart. Nothing destroys them: the container does not track prototypes, so the GC collects them when unreferenced.' : 'Isolated, but a new cart per call. For a cart that lasts the whole visit you would want session scope.'}`; }
      if (mode === 'request') { carts.forEach((c) => { if (c.st !== 'gone') c.st = 'gone'; }); carts.push({ id: i + 1, items: [`${u}: ${item}`], st: '' }); idx = carts.length - 1; say = `Request ${i + 1}: the proxy finds no <code>scopedTarget.cart</code> in this request, so it creates Cart#${i + 1}. Calls within the same request reach the same instance.${i > 0 ? ` When request ${i} ended, Cart#${i} was destroyed (<code>@PreDestroy</code> runs for request-scoped beans).` : ''}`; }
      carts[idx].st = 'hot';
      S.push({ req: i, ctrl: mode === 'request' ? 'prx' : '', carts, line: [['r', i, 'hot'], ['c', idx, 'hot']], tone: mode === 'inject' && i > 0 ? 'err' : '', say });
    });
    const last = S[S.length - 1];
    const fin = { ...last, req: null, line: [], carts: last.carts.map((c) => ({ ...c, st: mode === 'request' ? 'gone' : '' })) };
    fin.tone = mode === 'inject' ? 'err' : 'ok';
    fin.say = { inject: 'Result: 1 cart, 3 items, 3 users. Fix: <code>ObjectProvider&lt;Cart&gt;</code>, a <code>@Lookup</code> method, or the right scope with a scoped proxy.', provider: 'Result: 3 carts, each isolated. <code>ObjectProvider</code> (or <code>@Lookup</code>) is the idiomatic way to get a new prototype from a singleton.', request: 'Result: one Cart per request, cleaned up when the request ends, through one proxy injected once. Session scope works the same way, keyed by HTTP session.' }[mode];
    S.push(fin);
    return S;
  }
  const RX = 10; const CX = 270; const PX = 540; const W = 210; const H = 62; const ry = (i) => 20 + i * 86;
  function render() {
    stage.innerHTML = '';
    const line = (x1, y1, x2, y2, c) => stage.append(svg('path', { class: 'ln ' + c, d: `M${x1} ${y1} C ${x1 + 40} ${y1}, ${x2 - 40} ${y2}, ${x2} ${y2}` }));
    (st.line || []).forEach(([kind, i, c]) => { if (kind === 'r') line(RX + W, ry(i) + H / 2, CX, ry(1) + H / 2, c); else line(CX + W, ry(1) + H / 2, PX, ry(i) + H / 2, c); });
    USERS.forEach(([u], i) => {
      stage.append(svg('rect', { class: 'bx' + (st.req === i ? ' hot' : ''), x: RX, y: ry(i), width: W, height: H, rx: 9 }),
        svg('text', { x: RX + 12, y: ry(i) + 25, 'font-size': 14, 'font-weight': 700, fill: 'var(--text)', text: `request ${i + 1}` }),
        svg('text', { x: RX + 12, y: ry(i) + 46, 'font-size': 12, fill: 'var(--text-2)', text: `${u} · POST /cart` }));
    });
    stage.append(svg('rect', { class: 'bx' + (st.ctrl === 'bad' ? ' bad' : ''), x: CX, y: ry(1) - 20, width: W, height: H + 40, rx: 9 }),
      svg('text', { x: CX + 12, y: ry(1) + 4, 'font-size': 14, 'font-weight': 700, fill: 'var(--text)', text: 'CartController' }),
      svg('text', { x: CX + 12, y: ry(1) + 22, 'font-size': 12, fill: 'var(--text-3)', text: 'singleton (1 instance)' }));
    if (st.ctrl === 'prx') stage.append(svg('rect', { class: 'bx prx', x: CX + 10, y: ry(1) + 32, width: W - 20, height: 28, rx: 6 }), svg('text', { x: CX + 20, y: ry(1) + 51, 'font-size': 12, fill: 'var(--accent)', text: 'cart → Cart$$SpringCGLIB' }));
    else stage.append(svg('text', { x: CX + 12, y: ry(1) + 52, 'font-size': 12, fill: 'var(--text-2)', text: mode === 'provider' ? 'carts: ObjectProvider<Cart>' : 'cart: Cart' }));
    st.carts.slice(-3).forEach((c, j) => {
      stage.append(svg('rect', { class: 'bx ' + (c.st || ''), x: PX, y: ry(j), width: W, height: H, rx: 9 }),
        svg('text', { x: PX + 12, y: ry(j) + 22, 'font-size': 14, 'font-weight': 700, fill: c.st === 'bad' ? 'var(--err)' : 'var(--text)', text: c.st === 'bad' ? 'Cart (cannot create)' : `Cart#${c.id}${c.st === 'gone' ? ' (destroyed)' : ''}` }),
        svg('text', { x: PX + 12, y: ry(j) + 42, 'font-size': 12, fill: c.items.length > 1 ? 'var(--err)' : 'var(--text-2)', text: c.st === 'bad' ? 'no request bound' : `${c.items.length} item${c.items.length === 1 ? '' : 's'}` }),
        svg('text', { x: PX + 12, y: ry(j) + 56, 'font-size': 10.5, fill: 'var(--text-3)', text: c.items.slice(-3).map((s) => s.split(':')[0]).join(', ') }));
    });
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${steps.length}` }), el('div', { class: 't', html: h })); }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = plan();
    st = { ctrl: '', carts: [], line: [], req: null };
    codeHost.innerHTML = ''; codeHost.append(ctx.codeBox(MODES[mode].code, 'java'));
    render(); say('Three users each add one item to their cart. Press Play or Step.'); bStep.disabled = false;
  }
  function step() { if (k >= steps.length) return false; st = { req: null, ...steps[k++] }; render(); say(st.say, st.tone); if (k >= steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    if (reduced) { while (step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

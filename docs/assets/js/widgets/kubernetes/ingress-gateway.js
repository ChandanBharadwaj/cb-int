/* Ingress & Gateway API: a request goes through the L4 LB, TLS termination (SNI), rule matching with precedence, then the backend Service. */
IA.widget('ingress-gateway', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8s-ing-style')) {
    document.head.append(el('style', { id: 'w-k8s-ing-style', text: `
.w-ing .bx { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: all .25s; }
.w-ing .bx.hot { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-soft); }
.w-ing .bx.ok { stroke: var(--ok); stroke-width: 2.5; }
.w-ing .bx.warn { stroke: var(--warn); stroke-width: 2.5; }
.w-ing .bx.err { stroke: var(--err); stroke-width: 2.5; }
.w-ing .bx.dim { opacity: .35; }
.w-ing .ttl { font: 600 13px var(--sans); fill: var(--text); }
.w-ing .sub { font: 500 10.5px var(--mono); fill: var(--text-3); }
.w-ing .wire { stroke: var(--border); stroke-width: 1.5; fill: none; }
.w-ing table.t td.m { color: var(--ok); font-weight: 700; } .w-ing table.t td.x { color: var(--err); }
.w-ing table.t tr.win td { background: var(--accent-soft); }
.w-ing table.t tr.cur td { outline: 1px solid var(--accent); }
.w-ing .req { font-family: var(--mono); font-size: 12.5px; }
` }));
  }
  const REQS = [
    { id: 'r1', l: '/api/orders/42', scheme: 'https', host: 'shop.example.com', path: '/api/orders/42', hdr: null },
    { id: 'r2', l: '/apiv2/orders', scheme: 'https', host: 'shop.example.com', path: '/apiv2/orders', hdr: null },
    { id: 'r3', l: '/api/health', scheme: 'https', host: 'shop.example.com', path: '/api/health', hdr: null },
    { id: 'r4', l: '/api/orders + x-canary', scheme: 'https', host: 'shop.example.com', path: '/api/orders', hdr: 'x-canary: true' },
    { id: 'r5', l: 'http:// /cart', scheme: 'http', host: 'shop.example.com', path: '/cart', hdr: null },
    { id: 'r6', l: 'admin.example.com', scheme: 'https', host: 'admin.example.com', path: '/', hdr: null }];
  const ING = [
    { id: 'I1', m: 'Exact /api/health', type: 'Exact', p: '/api/health', be: 'health' },
    { id: 'I2', m: 'Prefix /api', type: 'Prefix', p: '/api', be: 'orders-api' },
    { id: 'I3', m: 'Prefix /', type: 'Prefix', p: '/', be: 'web' }];
  // Gateway rules listed in precedence order (Exact, longest prefix, more header matches, …)
  const GW = [
    { id: 'G1', m: 'Exact /api/health', type: 'Exact', p: '/api/health', be: 'health' },
    { id: 'G2', m: 'PathPrefix /api + header x-canary=true', type: 'Prefix', p: '/api', hdr: 'x-canary: true', be: 'orders-api-v2' },
    { id: 'G3', m: 'PathPrefix /api', type: 'Prefix', p: '/api', be: 'orders-api ×90 / orders-api-v2 ×10', w: true },
    { id: 'G4', m: 'PathPrefix /', type: 'Prefix', p: '/', be: 'web' }];
  const BACK = ['web', 'orders-api', 'orders-api-v2', 'health', 'edge'];
  let mode = 'gw'; let req = REQS[0]; let gen = 0; let running = false; let k = 0; let steps = []; let speed = 2400;
  let ruleState = {}; let win = null;

  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segMode = seg([['ing', 'Ingress (networking.k8s.io/v1)'], ['gw', 'Gateway API (HTTPRoute)']], mode, (v) => { mode = v; reset(); }, 'API');
  const segReq = seg(REQS.map((r) => [r.id, r.l]), req.id, (v) => { req = REQS.find((r) => r.id === v); reset(); }, 'Request');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1200, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const reqLine = el('div', { class: 'codebox req', style: { padding: '8px 12px', marginBottom: '10px' } });
  const W = 760; const H = 300;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Client, cloud load balancer, proxy, and backend Services' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const tblHost = el('div', { class: 'tscroll' });
  const hdrs = el('div', { class: 'w-stats' });
  root.classList.add('w-ing');
  root.append(el('div', { class: 'w-controls' }, segMode), el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'request' }), segReq), reqLine,
    el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr,
    el('h3', { class: 'sub-h', text: 'Routing rules for shop.example.com', style: { fontSize: '14px', margin: '12px 0 6px' } }), tblHost, hdrs);
  const say = (h, tone) => { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };

  // ---------- geometry ----------
  const P = { client: { x: 20, y: 120, w: 120, h: 60 }, lb: { x: 175, y: 120, w: 120, h: 60 }, px: { x: 335, y: 70, w: 190, h: 160 } };
  const BY = (i) => 14 + i * 56; const BX = 590; const BW = 160; const BH = 46;
  let layer;
  const box = (b, cls) => svg('rect', { class: 'bx ' + (cls || ''), x: b.x, y: b.y, width: b.w, height: b.h, rx: 10 });
  const txt = (x, y, t, cls, a) => svg('text', { x, y, class: cls || 'ttl', 'text-anchor': a || 'middle', text: t });
  const mid = (b, side) => ({ x: side === 'r' ? b.x + b.w : side === 'l' ? b.x : b.x + b.w / 2, y: b.y + b.h / 2 });
  function draw(st) {
    st = st || {}; stage.innerHTML = '';
    const backs = mode === 'gw' ? BACK : BACK.filter((b) => b !== 'orders-api-v2');
    BACK.forEach((b, i) => { if (!backs.includes(b)) return;
      const bb = { x: BX, y: BY(i), w: BW, h: BH };
      stage.append(svg('path', { class: 'wire', d: `M${P.px.x + P.px.w} ${P.px.y + P.px.h / 2} C ${BX - 40} ${P.px.y + P.px.h / 2}, ${BX - 40} ${BY(i) + BH / 2}, ${BX} ${BY(i) + BH / 2}` })); });
    stage.append(svg('path', { class: 'wire', d: `M140 150 L175 150 M295 150 L335 150` }));
    stage.append(box(P.client, st.client), txt(80, 146, 'browser', 'ttl'), txt(80, 164, '198.51.100.4', 'sub'));
    stage.append(box(P.lb, st.lb), txt(235, 146, 'cloud LB (L4)', 'ttl'), txt(235, 164, '34.120.8.9 :80 :443', 'sub'));
    stage.append(box(P.px, st.px), txt(430, 94, mode === 'gw' ? 'Gateway “edge”' : 'ingress controller', 'ttl'), txt(430, 112, mode === 'gw' ? 'GatewayClass: envoy' : 'IngressClass: traefik', 'sub'),
      txt(430, 140, st.tls || 'listeners :80, :443', 'sub'), txt(430, 160, st.rule || '', 'sub'), txt(430, 196, 'routes to pod IPs from', 'sub'), txt(430, 210, 'EndpointSlices', 'sub'));
    backs.forEach((b) => { const i = BACK.indexOf(b); const bb = { x: BX, y: BY(i), w: BW, h: BH };
      const cls = st.back === b ? (st.backTone || 'ok') : (st.back ? 'dim' : '');
      stage.append(box(bb, cls), txt(BX + BW / 2, BY(i) + 20, b === 'edge' ? (st.edgeLabel || 'redirect / 404') : 'svc/' + b, 'ttl'), txt(BX + BW / 2, BY(i) + 36, b === 'edge' ? 'answered by the proxy' : '→ pods :8080', 'sub')); });
    layer = svg('g'); stage.append(layer);
  }
  const backPt = (b) => ({ x: BX, y: BY(BACK.indexOf(b)) + BH / 2 });
  function fly(pts, color) {
    return new Promise((res) => {
      const c = color || 'var(--accent)';
      const dot = svg('circle', { r: 7, fill: c, class: 'packet', style: `color:${c}` }); layer.append(dot);
      const end = pts[pts.length - 1];
      if (reduced) { dot.setAttribute('cx', end.x); dot.setAttribute('cy', end.y); res(); return; }
      const segs = []; let tot = 0;
      for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); segs.push(d); tot += d; }
      const dur = Math.min(1300, speed * 0.45); const t0 = performance.now();
      const tick = (t) => { let f = Math.min(1, (t - t0) / dur) * tot; let i = 0;
        while (i < segs.length - 1 && f > segs[i]) { f -= segs[i]; i++; }
        const a = pts[i]; const b = pts[i + 1]; const r = segs[i] ? Math.min(1, f / segs[i]) : 1;
        dot.setAttribute('cx', a.x + (b.x - a.x) * r); dot.setAttribute('cy', a.y + (b.y - a.y) * r);
        if (t - t0 < dur) requestAnimationFrame(tick); else res(); };
      requestAnimationFrame(tick);
    });
  }

  // ---------- matching ----------
  const elems = (p) => p.split('/').filter(Boolean);
  function match(rule, r) {
    if (rule.type === 'Exact') return r.path === rule.p ? [true, 'path is exactly ' + rule.p] : [false, `${r.path} ≠ ${rule.p}`];
    const a = elems(rule.p); const b = elems(r.path);
    const ok = a.every((x, i) => b[i] === x);
    if (!ok) return [false, `element “${b[0] || ''}” ≠ “${a[0]}”`];
    if (rule.hdr) {
      if (mode === 'ing') return [true, 'header ignored'];
      return r.hdr === rule.hdr ? [true, 'prefix + header match'] : [false, 'prefix ok, header x-canary missing'];
    }
    return [true, rule.p === '/' ? 'everything matches /' : `elements start with /${a.join('/')}`];
  }
  function renderTable() {
    const rules = mode === 'gw' ? GW : ING;
    const tb = el('tbody');
    rules.forEach((r) => { const s = ruleState[r.id];
      tb.append(el('tr', { class: (win === r.id ? 'win' : '') + (s && s.cur ? ' cur' : '') },
        el('td', { text: r.id }), el('td', { html: `<code>${r.m}</code>` }), el('td', { text: r.be }),
        el('td', { class: s ? (s.ok ? 'm' : 'x') : '', text: s ? (s.ok ? '✓ ' : '✗ ') + s.why : '' }))); });
    tblHost.innerHTML = '';
    tblHost.append(el('table', { class: 't rg' }, el('thead', null, el('tr', null, ['#', mode === 'gw' ? 'match (sorted by precedence)' : 'path', 'backend', 'result'].map((h) => el('th', { text: h })))), tb));
  }
  function renderReq() {
    reqLine.innerHTML = '';
    reqLine.append(el('div', { text: `GET ${req.scheme}://${req.host}${req.path}` }), req.hdr ? el('div', { text: req.hdr, style: { color: 'var(--text-3)' } }) : null);
  }
  function showHdrs(list) { hdrs.innerHTML = ''; (list || []).forEach((h) => hdrs.append(el('span', { class: 'w-stat', html: h }))); }

  function plan() {
    const S = []; const C = mid(P.client, 'r'); const L = mid(P.lb, 'l'); const LR = mid(P.lb, 'r'); const X = mid(P.px, 'l');
    S.push({ st: { client: 'hot', lb: 'hot' }, fly: [C, L], say: `DNS for <code>${req.host}</code> points at the cloud LB. It is <b>L4</b>: it forwards the TCP connection to the proxy’s Service without reading any HTTP.` });
    if (req.scheme === 'http') {
      S.push({ st: { lb: 'hot', px: 'hot', tls: 'listener :80 (plain HTTP)' }, fly: [LR, X], say: mode === 'gw' ? 'The Gateway’s <code>http</code> listener on :80 accepts it. Only the <code>redirect</code> HTTPRoute is attached to that listener.' : 'The controller receives plain HTTP on :80. Because this host has a <code>tls</code> section, most controllers redirect to HTTPS (ingress-nginx answers 308 by default).' });
      S.push({ st: { px: 'hot', back: 'edge', backTone: 'warn', edgeLabel: mode === 'gw' ? '301 → https' : '308 → https', rule: mode === 'gw' ? 'filter: RequestRedirect' : 'ssl-redirect' }, fly: [mid(P.px, 'r'), backPt('edge')], color: 'var(--warn)', say: `The proxy answers itself with <b>${mode === 'gw' ? '301' : '308'}</b> <code>Location: https://shop.example.com/cart</code>. No backend pod is involved. The browser retries on :443.`, tone: 'warn', done: true });
      return S;
    }
    const known = req.host === 'shop.example.com';
    S.push({ st: { lb: 'hot', px: known ? 'hot' : 'err', tls: known ? 'SNI → cert shop-tls' : 'SNI admin… → no cert' }, fly: [LR, X], say: known
      ? `TLS handshake. The client sends SNI <code>shop.example.com</code>; the proxy picks the certificate from Secret <code>shop-tls</code> (type <code>kubernetes.io/tls</code>) and <b>terminates TLS</b>. From here on it can read the HTTP request.`
      : (mode === 'gw' ? 'No listener has hostname <code>admin.example.com</code>, so nothing on this Gateway serves it. Depending on the implementation the TLS handshake fails or the client gets a 404.' : 'No TLS entry covers <code>admin.example.com</code>. The controller falls back to its default certificate, so the browser shows a certificate warning.'), tone: known ? '' : 'err' });
    if (!known) {
      if (mode === 'ing') S.push({ st: { px: 'err', back: 'edge', backTone: 'err', edgeLabel: 'default backend 404' }, fly: [mid(P.px, 'r'), backPt('edge')], color: 'var(--err)', say: 'If the user clicks through, no rule matches the host, so the request goes to the controller’s <b>default backend</b>: 404.', tone: 'err', done: true });
      return S;
    }
    const rules = mode === 'gw' ? GW : ING;
    const res = rules.map((r) => ({ r, m: match(r, req) }));
    let winner;
    if (mode === 'gw') winner = res.find((x) => x.m[0]);
    else { const ms = res.filter((x) => x.m[0]); ms.sort((a, b) => (b.r.p.length - a.r.p.length) || (a.r.type === 'Exact' ? -1 : 1)); winner = ms[0]; }
    res.forEach((x, i) => S.push({ rs: { id: x.r.id, ok: x.m[0], why: x.m[1] }, st: { px: 'hot', tls: 'TLS terminated', rule: `checking ${x.r.id}` }, say: `<b>${x.r.id}</b> <code>${x.r.m}</code>: ${x.m[0] ? 'match' : 'no match'} (${x.m[1]}).${mode === 'gw' && i === 0 ? ' Gateway API sorts candidate rules by precedence: Exact path, longest prefix, method, most header matches, most query matches.' : ''}${mode === 'ing' && i === 0 ? ' Ingress collects every matching path; the <b>longest</b> wins, and Exact wins a tie.' : ''}` }));
    let be = winner.r.be; let extra = mode === 'ing' && req.hdr ? ' Ingress v1 has no header matching, so the canary header is ignored; a canary needs controller-specific annotations.' : '';
    if (winner.r.w) { be = Math.random() < 0.9 ? 'orders-api' : 'orders-api-v2'; extra = ` The rule has weights 90/10, and this request drew <b>${be}</b>. Weights apply per <i>request</i>, unlike a ClusterIP, which balances per connection.`; }
    S.push({ win: winner.r.id, st: { px: 'hot', back: be, backTone: 'hot', tls: 'TLS terminated', rule: `winner: ${winner.r.id}` }, fly: [mid(P.px, 'r'), backPt(be)], hd: ['X-Forwarded-Proto <b>https</b>', 'X-Forwarded-For <b>198.51.100.4</b>', 'Host <b>shop.example.com</b>'],
      say: `Winner: <b>${winner.r.id}</b> → <code>svc/${be}</code>.${extra} The proxy opens a <b>plain HTTP</b> connection to a pod IP from the Service’s EndpointSlices and adds <code>X-Forwarded-*</code> headers. Spring needs <code>server.forward-headers-strategy</code> set to trust them.` });
    S.push({ win: winner.r.id, st: { back: be, backTone: 'ok', tls: 'TLS terminated', rule: `winner: ${winner.r.id}` }, fly: [backPt(be), mid(P.px, 'r'), X, LR, L, C], color: 'var(--ok)', hd: ['X-Forwarded-Proto <b>https</b>', 'X-Forwarded-For <b>198.51.100.4</b>'], say: `200 OK from ${be}. The proxy re-encrypts the response on the client’s TLS session.`, tone: 'ok', done: true });
    return S;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; ruleState = {}; win = null;
    renderReq(); draw(); steps = plan(); renderTable(); showHdrs(); bStep.disabled = false;
    say(mode === 'gw' ? 'Gateway API: the platform team owns the Gateway (listeners, certificate), and the app team owns the HTTPRoute. Press Play.' : 'Ingress v1: host + path rules, TLS via a Secret. Anything fancier lives in controller annotations. Press Play.');
  }
  async function step() {
    if (k >= steps.length) return false;
    const s = steps[k++]; const g = gen;
    Object.values(ruleState).forEach((v) => { v.cur = false; });
    if (s.rs) ruleState[s.rs.id] = { ok: s.rs.ok, why: s.rs.why, cur: true };
    if (s.win) win = s.win;
    draw(s.st); renderTable(); say(s.say, s.tone); showHdrs(s.hd);
    if (s.fly) await fly(s.fly, s.color);
    if (g !== gen) return false;
    if (k >= steps.length) bStep.disabled = true;
    return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    if (reduced) { while (g === gen && k < steps.length) await step(); }
    else while (running && g === gen && await step()) { if (k < steps.length) await sleep(speed * 0.55); }
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

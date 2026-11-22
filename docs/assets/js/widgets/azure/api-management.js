/* APIM policy pipeline: inbound (validate-jwt, rate-limit-by-key, cache-lookup, managed identity) → backend → outbound → on-error, plus version set and revision routing. */
IA.widget('api-management', (root, ctx) => {
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
  let mode = 'ok';
  const stage = svg('svg', { viewBox: '0 0 640 340', role: 'img', 'aria-label': 'API Management policy pipeline with inbound, backend, outbound and on-error sections' });
  const segM = seg([['ok', '200 OK'], ['429', '429 rate limit'], ['401', '401 bad token'], ['err', 'Backend timeout'], ['cache', 'Cache hit'], ['ver', 'Versions & revisions']], mode, (v) => { mode = v; reset(); }, 'Case');
  const stats = el('div', { class: 'w-stats' });
  const stat = (pairs) => { stats.innerHTML = ''; pairs.forEach(([k, v]) => stats.append(el('span', { class: 'w-stat', html: `${k} <b>${v}</b>` }))); };
  function build() {
    stage.innerHTML = ''; clearZ();
    const bg = svg('g'); const e = svg('g'); const g = svg('g');
    const reg = (id, x, y, w, h, label) => { const r = svg('rect', { class: 'zn', x, y, width: w, height: h, rx: 12 }); bg.append(r, svg('text', { class: 'lbl', x: x + 10, y: y + 18, text: label })); Z[id] = { n: r, base: 'zn' }; };
    if (mode === 'ver') {
      node(g, 'c1', 10, 30, 180, 56, 'Mobile app v1', 'GET /orders/v1/…');
      node(g, 'c2', 10, 135, 180, 56, 'Web app', 'GET /orders/v2/…');
      node(g, 'c3', 10, 240, 180, 56, 'QA', 'GET /orders/v2;rev=3/…');
      node(g, 'vs', 225, 135, 160, 56, 'Version set “orders”', 'scheme: path segment');
      node(g, 'a1', 420, 30, 210, 56, 'Orders v1', 'rev 4 (current)');
      node(g, 'a2', 420, 135, 210, 56, 'Orders v2', 'rev 2 (current)');
      node(g, 'a3', 420, 240, 210, 56, 'Orders v2 · rev 3', 'not current (testing)');
      ['c1', 'c2', 'c3'].forEach((c, i) => hlink(e, 'ec' + i, c, 'vs'));
      ['a1', 'a2', 'a3'].forEach((a, i) => hlink(e, 'ea' + i, 'vs', a));
      stage.append(bg, e, g, pkt);
      stat([['breaking change', 'new version'], ['safe change', 'new revision']]);
      return;
    }
    reg('zi', 120, 6, 510, 112, 'inbound');
    reg('zb', 370, 130, 260, 106, 'backend');
    reg('zo', 250, 246, 380, 88, 'outbound');
    reg('ze', 120, 246, 122, 88, 'on-error');
    node(g, 'cl', 10, 40, 100, 60, 'Client', 'key + JWT');
    node(g, 'i1', 130, 36, 115, 64, 'validate-jwt', 'aud, roles');
    node(g, 'i2', 255, 36, 115, 64, 'rate-limit-by-key', 'per subscription');
    node(g, 'i3', 380, 36, 115, 64, 'cache-lookup', 'vary by page');
    node(g, 'i4', 505, 36, 115, 64, 'MI token', 'set-backend');
    node(g, 'b1', 380, 160, 115, 64, 'forward-request', 'retry on 5xx');
    node(g, 'srv', 505, 160, 115, 64, 'orders-svc', 'Spring Boot');
    node(g, 'o1', 505, 268, 115, 56, 'set-header', 'strip internals');
    node(g, 'o2', 380, 268, 115, 56, 'cache-store', '30 s');
    node(g, 'er', 130, 268, 104, 56, 'return-response', 'JSON error');
    hlink(e, 'e0', 'cl', 'i1'); hlink(e, 'e1', 'i1', 'i2'); hlink(e, 'e2', 'i2', 'i3'); hlink(e, 'e3', 'i3', 'i4');
    edge(e, 'e4', 'M562 100 C 562 135, 437 125, 437 160'); hlink(e, 'e5', 'b1', 'srv'); link(e, 'e6', 'srv', 'o1'); hlink(e, 'e7', 'o1', 'o2');
    edge(e, 'e8', 'M380 296 C 300 296, 60 230, 60 100'); edge(e, 'e9', 'M182 268 C 182 200, 60 170, 60 100');
    edge(e, 'eH', 'M437 100 C 437 180, 300 200, 300 268');
    stage.append(bg, e, g, pkt);
    stat([['status', '—'], ['backend called', 'no'], ['counter', '36 / 100 per min']]);
  }
  function plan() {
    const A = cum(); const S = [];
    const st = (s, b, c) => () => stat([['status', s], ['backend called', b], ['counter', c]]);
    if (mode === 'ver') {
      S.push({ fly: ['c1', 'vs', 'a1'], ...A.set({ c1: 'ok', ec0: 'ok', ea0: 'ok', a1: 'ok', a3: 'dim', ea2: 'dim' }), t: 'A <b>version set</b> groups versions of one API. With the path-segment scheme, <code>/orders/v1</code> goes to v1. Old mobile apps keep working.' , cls: 'ok' });
      S.push({ fly: ['c2', 'vs', 'a2'], ...A.set({ c2: 'ok', ec1: 'ok', ea1: 'ok', a2: 'ok' }), t: 'v2 is a <b>separate API</b> with a different contract (a renamed field). Both versions run side by side, each with its own policies and backend.', cls: 'ok' });
      S.push({ fly: ['c3', 'vs', 'a3'], ...A.set({ c3: 'hot', ec2: 'hot', ea2: 'hot', a3: 'hot' }), t: 'A <b>revision</b> is a change to the same version. Revision 3 adds an optional field. QA calls it explicitly with <code>;rev=3</code>, while everyone else still gets rev 2.' });
      S.push({ ...A.set({ a3: 'ok', a2: 'dim' }, { a3: 'rev 3 (current)', a2: 'rev 2 (kept for rollback)' }), t: '“Make current” with a change-log entry: every v2 call now uses rev 3. Instant, and you can switch back. That’s why revisions must be <b>non-breaking</b>.', cls: 'ok' });
      S.push({ fly: ['c2', 'vs', 'a3'], ...A.set({ ea1: 'dim', ea2: 'ok' }), t: 'The web app is now on rev 3 without changing its URL.', cls: 'ok' });
      S.push({ ...A.set({ a1: 'warn' }, { a1: 'deprecated: sunset 2027-06' }), t: 'v1 is marked deprecated. An outbound <code>set-header</code> can add <code>Deprecation</code>/<code>Sunset</code> headers, and the developer portal shows the date. Remove it only when its traffic is gone.', cls: 'warn' });
      return S;
    }
    S.push({ fly: ['cl', 'i1'], ...A.set({ cl: 'hot', e0: 'hot', i1: mode === '401' ? 'bad' : 'ok' }, mode === '401' ? { i1: 'aud mismatch' } : {}), run: st('…', 'no', '36 / 100 per min'),
      t: mode === '401' ? '<code>validate-jwt</code> checks signature, issuer, expiry, audience and required claims. This token was issued for <code>api://billing</code>, not <code>api://orders</code>.' : '<code>GET /orders/v2/orders/42</code> arrives with a subscription key and a bearer token. <code>validate-jwt</code> checks signature (via the OpenID metadata), issuer, expiry, <code>aud</code> and the <code>roles</code> claim.', cls: mode === '401' ? 'err' : '' });
    if (mode === '401') {
      S.push({ fly: ['i1', 'er'], ...A.set({ zi: 'bad', ze: 'hot', er: 'warn', e9: 'warn' }), run: st('401', 'no', 'not counted'), t: 'A failing policy jumps straight to <b>on-error</b>. Rate limit, cache and backend never run. on-error returns a clean JSON body with the request ID.', cls: 'warn' });
      S.push({ fly: ['er', 'cl'], ...A.set({ cl: 'bad' }), t: '<b>401 Unauthorized</b>. The Spring backend was never touched, so it never sees unauthenticated traffic. Keep the backend unreachable except through APIM, or this check can be bypassed.', cls: 'err' });
      return S;
    }
    S.push({ fly: ['i1', 'i2'], ...A.set({ e1: 'hot', i2: mode === '429' ? 'bad' : 'ok' }, mode === '429' ? { i2: '101 / 100' } : { i2: '37 / 100' }), run: st('…', 'no', mode === '429' ? '101 / 100 per min' : '37 / 100 per min'),
      t: mode === '429' ? 'This subscription has already made 100 calls in the current minute. The counter key is <code>context.Subscription.Id</code>, so other callers are unaffected.' : '<code>rate-limit-by-key</code> increments this subscription’s counter: 37 of 100 this minute. (Counters are approximate across gateway instances.)', cls: mode === '429' ? 'err' : '' });
    if (mode === '429') {
      S.push({ fly: ['i2', 'cl'], ...A.set({ cl: 'bad', i3: 'dim', i4: 'dim', zb: 'bad' }), run: st('429 + Retry-After', 'no', '101 / 100 per min'), t: 'The gateway answers <b>429 Too Many Requests</b> with a <code>Retry-After</code> header. The backend is protected. Clients should back off; a <code>quota</code> policy would return 403 for long-period limits instead.', cls: 'err' });
      return S;
    }
    if (mode === 'cache') {
      S.push({ fly: ['i2', 'i3'], ...A.set({ e2: 'ok', i3: 'ok' }, { i3: 'HIT (12 s old)' }), run: st('…', 'no', '37 / 100 per min'), t: '<code>cache-lookup</code> finds a response stored 12 seconds ago for the same URL and <code>page</code> parameter.', cls: 'ok' });
      S.push({ fly: ['i3', 'cl'], ...A.set({ cl: 'ok', i4: 'dim', zb: '', b1: 'dim', srv: 'dim' }), run: st('200 (from cache)', 'no', '37 / 100 per min'), t: '<b>200 from cache.</b> No token request, no backend call. Vary the cache by everything that changes the response (query parameters, headers, the caller if data is per user), or one user may see another’s data.', cls: 'ok' });
      return S;
    }
    S.push({ fly: ['i2', 'i3'], ...A.set({ e2: 'hot', i3: 'warn' }, { i3: 'miss' }), t: '<code>cache-lookup</code>: no fresh entry, so processing continues.', cls: 'warn' });
    S.push({ fly: ['i3', 'i4'], ...A.set({ e3: 'hot', i4: 'ok' }), t: '<code>authentication-managed-identity</code> gets an Entra token for <code>api://orders-backend</code> using APIM’s own identity, and <code>set-backend-service</code> picks the backend. No secrets in policies.', cls: 'ok' });
    if (mode === 'err') {
      S.push({ fly: ['i4', 'b1', 'srv'], ...A.set({ e4: 'hot', b1: 'warn', e5: 'bad', srv: 'bad' }, { srv: 'no response (20 s)', b1: 'timeout' }), run: st('…', 'yes (timed out)', '37 / 100 per min'), t: '<code>forward-request timeout="20"</code>: the backend is stuck in a long GC pause and doesn’t answer.', cls: 'err' });
      S.push({ fly: ['b1', 'srv'], ...A.set({ b1: 'bad' }, { b1: 'retry 2 × failed' }), t: 'The <code>retry</code> policy tries again, but only retry operations that are safe to repeat (GETs, or writes with idempotency keys).', cls: 'err' });
      S.push({ fly: ['b1', 'er'], ...A.set({ zb: 'bad', ze: 'hot', er: 'warn', e9: 'warn' }), run: st('504 / 500 (shaped)', 'yes (timed out)', '37 / 100 per min'), t: 'The forward error jumps to <b>on-error</b>. <code>context.LastError</code> holds the reason. <code>return-response</code> sends a consistent JSON error with <code>context.RequestId</code>, so support can find the trace.', cls: 'warn' });
      S.push({ fly: ['er', 'cl'], ...A.set({ cl: 'bad' }), t: 'The client gets a clean error instead of a hanging connection. Add a circuit breaker on the backend entity so a dead backend fails fast instead of tying up gateway connections for 20 s each.', cls: 'err' });
      return S;
    }
    S.push({ fly: ['i4', 'b1', 'srv'], ...A.set({ e4: 'ok', b1: 'ok', e5: 'ok', srv: 'ok' }, { srv: '200 OK' }), run: st('200', 'yes', '37 / 100 per min'), t: 'The <b>backend</b> section forwards the call. Spring Security validates the APIM-issued token’s audience. The service returns 200.', cls: 'ok' });
    S.push({ fly: ['srv', 'o1'], ...A.set({ e6: 'ok', o1: 'ok' }), t: '<b>Outbound</b>: <code>set-header exists-action="delete"</code> removes <code>X-Powered-By</code> and other internal headers.', cls: 'ok' });
    S.push({ fly: ['o1', 'o2'], ...A.set({ e7: 'ok', o2: 'ok' }, { o2: 'stored 30 s' }), t: '<code>cache-store</code> saves the response for 30 seconds, so the next identical request can be served without the backend.', cls: 'ok' });
    S.push({ fly: ['o2', 'cl'], ...A.set({ e8: 'ok', cl: 'ok' }), t: '<b>200 OK</b> to the client. One pipeline, written once, applied to every API that inherits it through <code>&lt;base /&gt;</code>.', cls: 'ok' });
    return S;
  }
  const intro = () => ({ ok: 'A normal call through every stage. Press Play.', '429': 'A caller over its limit. Press Play.', '401': 'A token for the wrong audience. Press Play.', err: 'A backend that stops answering. Press Play.', cache: 'A response already in the gateway cache. Press Play.', ver: 'Two versions and a revision in test. Press Play.' }[mode]);
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), controls, narr, stats);
  const reset = makeStepper(plan, intro, build, 2800);
  reset();
});

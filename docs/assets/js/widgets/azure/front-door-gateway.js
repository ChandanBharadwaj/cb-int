/* Global vs regional load balancing: Front Door edge routing + failover + origin lock-down, Application Gateway path rules + probes, WAF Detection vs Prevention, and Traffic Manager DNS failover with TTLs. */
IA.widget('front-door-gateway', (root, ctx) => {
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
  let mode = 'afd';
  const stage = svg('svg', { viewBox: '0 0 640 320', role: 'img', 'aria-label': 'Traffic flowing through Front Door, Application Gateway, WAF and Traffic Manager' });
  const segM = seg([['afd', 'Front Door (global)'], ['agw', 'App Gateway (regional)'], ['waf', 'WAF'], ['tm', 'Traffic Manager (DNS)']], mode, (v) => { mode = v; reset(); }, 'View');
  const stats = el('div', { class: 'w-stats' });
  const stat = (pairs) => { stats.innerHTML = ''; pairs.forEach(([k, v]) => stats.append(el('span', { class: 'w-stat', html: `${k} <b>${v}</b>` }))); };
  function build() {
    stage.innerHTML = ''; clearZ();
    const bg = svg('g'); const e = svg('g'); const g = svg('g');
    const reg = (id, x, y, w, h, label) => { const r = svg('rect', { class: 'zn', x, y, width: w, height: h, rx: 12 }); bg.append(r, svg('text', { class: 'lbl', x: x + 10, y: y + 16, text: label })); Z[id] = { n: r, base: 'zn' }; };
    if (mode === 'afd') {
      node(g, 'u1', 10, 24, 150, 56, 'User in Paris', 'shop.example.com');
      node(g, 'u2', 10, 240, 150, 56, 'User in New York', 'shop.example.com');
      node(g, 'p1', 200, 24, 170, 56, 'Edge POP: Paris', 'TLS + WAF + cache');
      node(g, 'p2', 200, 240, 170, 56, 'Edge POP: New York', 'TLS + WAF + cache');
      node(g, 'rt', 200, 132, 170, 56, 'route /api/* → og-api', 'probes /actuator/…/readiness');
      node(g, 'o1', 440, 24, 190, 56, 'Origin: West Europe', 'app-shop-weu · healthy');
      node(g, 'o2', 440, 240, 190, 56, 'Origin: East US', 'app-shop-eus · healthy');
      node(g, 'atk', 440, 132, 190, 56, 'Direct request', 'to *.azurewebsites.net');
      hlink(e, 'a1', 'u1', 'p1'); hlink(e, 'a2', 'u2', 'p2'); link(e, 'r1', 'p1', 'rt'); edge(e, 'r2', 'M285 240 L 285 188');
      hlink(e, 'w1', 'p1', 'o1'); hlink(e, 'w2', 'p2', 'o2'); edge(e, 'x1', 'M370 52 C 410 52, 400 268, 440 268');
      stat([['scope', 'global'], ['layer', 'L7 HTTP(S)'], ['failover', 'per request']]);
    } else if (mode === 'agw') {
      reg('vnet', 160, 4, 476, 312, 'vnet-shop (West Europe)');
      node(g, 'cl', 10, 132, 140, 56, 'Client', 'GET /api/orders');
      node(g, 'agw', 176, 132, 170, 56, 'App Gateway v2', 'listener :443 shop.…');
      node(g, 'pm', 176, 236, 170, 56, 'URL path map', '/api/* · default');
      node(g, 'api1', 380, 30, 120, 56, 'api-1', 'pool-api');
      node(g, 'api2', 510, 30, 120, 56, 'api-2', 'pool-api');
      node(g, 'web1', 380, 236, 120, 56, 'web-1', 'pool-web');
      node(g, 'web2', 510, 236, 120, 56, 'web-2', 'pool-web');
      hlink(e, 'c1', 'cl', 'agw'); link(e, 'pmE', 'agw', 'pm');
      edge(e, 'ea1', 'M346 160 C 370 160, 380 58, 380 58'); edge(e, 'ea2', 'M346 160 C 450 130, 560 120, 570 86');
      edge(e, 'ew1', 'M346 160 C 370 160, 380 264, 380 264'); edge(e, 'ew2', 'M346 160 C 450 200, 560 200, 570 236');
      stat([['scope', 'one region'], ['layer', 'L7 HTTP(S)'], ['backends', 'can be private (VNet)']]);
    } else if (mode === 'waf') {
      node(g, 'atk', 10, 30, 170, 56, 'Attacker', "q=' OR 1=1 --");
      node(g, 'cus', 10, 234, 170, 56, 'Customer', 'notes: “select … from”');
      node(g, 'waf', 230, 132, 180, 56, 'WAF policy', 'Default Rule Set · Detection');
      node(g, 'org', 460, 30, 170, 56, 'orders-api', 'origin');
      node(g, 'log', 460, 234, 170, 56, 'WAF log', 'Log Analytics');
      hlink(e, 'i1', 'atk', 'waf'); hlink(e, 'i2', 'cus', 'waf'); hlink(e, 'o1', 'waf', 'org'); hlink(e, 'o2', 'waf', 'log');
      stat([['mode', 'Detection'], ['blocked', '0'], ['logged', '0']]);
    } else {
      node(g, 'cl', 10, 132, 150, 56, 'Client', 'sftp.example.com');
      node(g, 'tm', 210, 24, 190, 56, 'Traffic Manager', 'priority · TTL 300 s');
      node(g, 'dc', 210, 240, 190, 56, 'Client DNS cache', '—');
      node(g, 'e1', 450, 24, 180, 56, 'Primary: West Europe', 'probe OK');
      node(g, 'e2', 450, 240, 180, 56, 'Secondary: North Europe', 'probe OK');
      hlink(e, 'q1', 'cl', 'tm'); hlink(e, 'q2', 'cl', 'dc'); hlink(e, 'd1', 'cl', 'e1'); hlink(e, 'd2', 'cl', 'e2'); hlink(e, 'pr', 'tm', 'e1');
      stat([['scope', 'global'], ['layer', 'DNS (any protocol)'], ['failover', 'after TTL + caches']]);
    }
    stage.append(bg, e, g, pkt);
  }
  function plan() {
    const A = cum(); const S = [];
    if (mode === 'afd') {
      S.push({ fly: ['u1', 'p1'], ...A.set({ u1: 'hot', a1: 'hot', p1: 'ok', atk: 'dim', x1: 'dim' }), t: 'Front Door’s address is <b>anycast</b>: the Paris user’s TCP and TLS connection ends at the nearest Microsoft edge location, a few milliseconds away.' });
      S.push({ fly: ['p1', 'rt', 'p1'], ...A.set({ rt: 'ok', r1: 'ok' }), t: 'The edge matches a <b>route</b> (host <code>shop.example.com</code>, path <code>/api/*</code>) to origin group <code>og-api</code>. Health probes from the edges know both origins are up.' });
      S.push({ fly: ['p1', 'o1'], ...A.set({ o1: 'ok', w1: 'ok', u1: 'ok' }), t: 'Among healthy origins with the same priority, Front Door picks those within the <b>latency sensitivity</b> window of the fastest: West Europe. The request travels on Microsoft’s backbone.', cls: 'ok' });
      S.push({ fly: ['u2', 'p2', 'o2'], ...A.set({ u2: 'ok', a2: 'ok', p2: 'ok', w2: 'ok', o2: 'ok' }), t: 'The New York user lands on a New York edge and is sent to East US. One host name, active-active in two regions.', cls: 'ok' });
      S.push({ ...A.set({ o1: 'bad', w1: 'bad' }, { o1: 'probes failing' }), t: 'West Europe goes down. Probes from the edges start failing, and the origin is marked unhealthy after the configured sample threshold.', cls: 'err' });
      S.push({ fly: ['u1', 'p1', 'o2'], ...A.set({ x1: 'warn', u1: 'warn' }), t: 'The Paris user’s next request goes to <b>East US</b>: slower, but up. There is no DNS change and no client cache to wait for. Failover is per request, at the edge.', cls: 'warn' });
      S.push({ fly: ['atk', 'o1'], ...A.set({ atk: 'bad', o1: 'ok' }, { atk: '403 at the origin', o1: 'recovered' }), t: 'Someone calls the origin’s <code>azurewebsites.net</code> host name directly to bypass the WAF. The origin allows only the <code>AzureFrontDoor.Backend</code> tag <b>with</b> <code>X-Azure-FDID</code> = your profile, so it refuses. (Premium: use Private Link origins instead.)', cls: 'ok' });
      return S;
    }
    if (mode === 'agw') {
      S.push({ fly: ['cl', 'agw'], ...A.set({ cl: 'hot', c1: 'hot', agw: 'ok' }), t: 'Application Gateway has an IP (public, private or both) <b>inside one region</b>. A <b>listener</b> on 443 for <code>shop.example.com</code> terminates TLS with a certificate that can come from Key Vault.' });
      S.push({ fly: ['agw', 'pm', 'agw'], ...A.set({ pm: 'ok', pmE: 'ok' }, { pm: 'matched /api/*' }), t: 'The listener’s rule uses a <b>URL path map</b>: <code>/api/*</code> → <code>pool-api</code>; everything else → the default pool <code>pool-web</code>.' });
      S.push({ fly: ['agw', 'api1'], ...A.set({ api1: 'ok', ea1: 'ok' }), t: 'The request goes to <code>api-1</code> over the VNet, with the HTTP settings for that pool (backend protocol, host name, timeout, connection draining).', cls: 'ok' });
      S.push({ fly: ['agw', 'web2'], ...A.set({ web2: 'ok', ew2: 'ok' }, { cl: 'GET /static/app.js' }), t: '<code>GET /static/app.js</code> doesn’t match <code>/api/*</code>, so it goes to the default pool.', cls: 'ok' });
      S.push({ ...A.set({ api2: 'bad', ea2: 'bad' }, { api2: 'probe: 503' }), t: 'The custom probe on <code>/actuator/health/readiness</code> fails for <code>api-2</code> three times in a row. It is taken out of rotation.', cls: 'err' });
      S.push({ fly: ['agw', 'api1'], ...A.set({ api1: 'ok' }, { cl: 'GET /api/orders' }), t: 'API traffic now flows only to <code>api-1</code>. App Gateway v2 is zone-redundant and autoscales, but it is still <b>one region</b>: for regional failure, put Front Door in front.', cls: 'warn' });
      return S;
    }
    if (mode === 'waf') {
      const st = (m, b, l) => () => stat([['mode', m], ['blocked', b], ['logged', l]]);
      S.push({ fly: ['atk', 'waf'], ...A.set({ atk: 'hot', i1: 'hot', waf: 'warn', cus: 'dim', i2: 'dim' }, { waf: 'match 942100 (SQLi)' }), t: 'The attacker sends a SQL-injection probe. The managed rule set matches it, and its anomaly score passes the threshold.', cls: 'warn' });
      S.push({ fly: ['waf', 'log'], ...A.set({ log: 'ok', o2: 'ok' }), run: st('Detection', '0', '1'), t: 'In <b>Detection</b> mode the WAF only <b>logs</b> the match…' });
      S.push({ fly: ['waf', 'org'], ...A.set({ org: 'bad', o1: 'bad' }, { org: 'received the payload!' }), t: '…and forwards the request. Your app must cope with it on its own. Detection is for a short tuning period only.', cls: 'err' });
      S.push({ fly: ['atk', 'waf'], ...A.set({ waf: 'ok', org: '', o1: 'dim' }, { waf: 'Prevention · 403', org: 'origin' }), run: st('Prevention', '1', '2'), t: 'Switched to <b>Prevention</b>: the same request gets <b>403</b> at the edge and never reaches the origin.', cls: 'ok' });
      S.push({ fly: ['cus', 'waf'], ...A.set({ cus: 'bad', i2: 'bad', i1: 'dim', atk: 'dim' }), run: st('Prevention', '2', '3'), t: 'A real customer’s delivery note, “please select the side door from the lane”, also scores as SQL injection. A <b>false positive</b> blocks a checkout.', cls: 'err' });
      S.push({ fly: ['cus', 'waf', 'org'], ...A.set({ cus: 'ok', i2: 'ok', o1: 'ok', org: 'ok', waf: 'ok' }, { waf: 'exclusion: body.notes for SQLI' }), run: st('Prevention', '2', '3'), t: 'Add an <b>exclusion</b> for the JSON field <code>notes</code>, for the SQLI rule group only. The attacker’s query-string payload is still blocked. Validate input in the API too.', cls: 'ok' });
      return S;
    }
    S.push({ fly: ['cl', 'tm', 'cl'], ...A.set({ cl: 'hot', q1: 'hot', tm: 'ok', pr: 'ok', e2: 'dim', d2: 'dim' }), t: 'The client resolves <code>sftp.example.com</code> (a CNAME to <code>sftp-shop.trafficmanager.net</code>). Traffic Manager answers with the <b>primary</b> endpoint’s address.' });
    S.push({ fly: ['cl', 'dc'], ...A.set({ dc: 'ok', q2: 'ok' }, { dc: 'primary, cached 300 s' }), t: 'The answer is cached for the TTL, 300 seconds, by the client and every resolver on the way.' });
    S.push({ fly: ['cl', 'e1'], ...A.set({ e1: 'ok', d1: 'ok', cl: 'ok' }), t: 'The client connects <b>directly</b> to West Europe on TCP 22. Traffic Manager is not in the data path, which is why it works for any protocol.', cls: 'ok' });
    S.push({ ...A.set({ e1: 'bad', d1: 'bad', pr: 'bad' }, { e1: 'probe failing' }), t: 'West Europe fails. Traffic Manager’s probes notice, and it starts answering with the secondary.', cls: 'err' });
    S.push({ fly: ['cl', 'dc', 'cl', 'e1'], ...A.set({ cl: 'bad', dc: 'warn' }, { dc: 'still primary (TTL left)' }), t: 'But this client still has the old answer cached and keeps failing until the TTL runs out. Some resolvers and apps (including long-running JVMs with DNS caching) hold it even longer.', cls: 'err' });
    S.push({ fly: ['cl', 'tm', 'cl', 'e2'], ...A.set({ cl: 'ok', e2: 'ok', d2: 'ok', dc: 'ok', q1: 'ok' }, { dc: 'secondary' }), t: 'After the TTL the client re-resolves and reaches North Europe. Use a short TTL for failover profiles. For HTTP(S), Front Door avoids this wait entirely.', cls: 'ok' });
    return S;
  }
  const intro = () => ({ afd: 'Front Door with origins in two regions. Press Play.', agw: 'Application Gateway inside one region. Press Play.', waf: 'A WAF policy in Detection mode. Press Play.', tm: 'Traffic Manager priority routing for a non-HTTP service. Press Play.' }[mode]);
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), controls, narr, stats);
  const reset = makeStepper(plan, intro, build, 2800);
  reset();
});

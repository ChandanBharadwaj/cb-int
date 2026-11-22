/* Spring on Azure: reference architecture with the request path, identity-first startup (one managed identity, no secrets) and end-to-end observability. */
IA.widget('spring-on-azure', (root, ctx) => {
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
  let mode = 'req';
  const stage = svg('svg', { viewBox: '0 0 640 340', role: 'img', 'aria-label': 'Reference architecture for a Spring Boot app on Azure: request path, identity-first startup, or observability' });
  const segM = seg([['req', 'Request path'], ['id', 'Identity-first startup'], ['obs', 'Observability']], mode, (v) => { mode = v; reset(); }, 'View');
  const stats = el('div', { class: 'w-stats' });
  const stat = (h) => { stats.innerHTML = ''; h.forEach((x) => stats.append(el('span', { class: 'w-stat', html: x }))); };
  const zrect = (g, id, x, y, w, h, label) => { const r = svg('rect', { class: 'zn', x, y, width: w, height: h, rx: 10 }); g.append(r, svg('text', { class: 'lbl', x: x + 8, y: y + 17, text: label })); Z[id] = { n: r, base: 'zn' }; };
  function build() {
    stage.innerHTML = ''; clearZ();
    const bg = svg('g'); const e = svg('g'); const g = svg('g');
    node(g, 'usr', 10, 14, 110, 50, 'Users', 'browser / SPA');
    node(g, 'fd', 150, 14, 160, 50, 'Front Door + WAF', 'TLS · routing');
    node(g, 'ent', 470, 14, 160, 50, 'Entra ID', 'users + workload tokens');
    zrect(bg, 'env', 10, 84, 300, 160, 'Container Apps environment (VNet)');
    node(g, 'api', 22, 110, 132, 52, 'orders-api', 'Spring Boot 3');
    node(g, 'wrk', 166, 110, 132, 52, 'orders-worker', 'KEDA: queue length');
    node(g, 'mi', 22, 178, 276, 52, 'id-orders (user-assigned MI)', 'AZURE_CLIENT_ID');
    zrect(bg, 'pe', 330, 84, 300, 248, 'private endpoints');
    node(g, 'pg', 342, 110, 136, 50, 'Postgres Flexible', 'zone-redundant HA');
    node(g, 'rds', 488, 110, 130, 50, 'Redis', 'cache-aside');
    node(g, 'sb', 342, 172, 136, 50, 'Service Bus', 'topic orders-placed');
    node(g, 'kv', 488, 172, 130, 50, 'Key Vault', 'partner API key');
    node(g, 'cfg', 342, 234, 136, 50, 'App Configuration', 'settings + flags');
    node(g, 'blob', 488, 234, 130, 50, 'Blob Storage', 'invoices');
    node(g, 'acr', 10, 264, 140, 58, 'ACR', 'image by digest');
    node(g, 'ai', 166, 264, 144, 58, 'App Insights', 'Log Analytics');
    hlink(e, 'uf', 'usr', 'fd');
    edge(e, 'ue', 'M65 14 C 65 2, 550 2, 550 14');
    edge(e, 'fa', 'M230 64 C 230 88, 88 86, 88 110');
    edge(e, 'ap', 'M154 128 C 250 70, 330 100, 342 128');
    edge(e, 'ar', 'M154 122 C 260 60, 520 60, 553 110');
    edge(e, 'as', 'M154 146 C 240 160, 300 196, 342 196');
    edge(e, 'sw', 'M342 186 C 310 186, 300 150, 298 140');
    edge(e, 'wb', 'M298 150 C 380 300, 450 280, 488 258');
    edge(e, 'me', 'M298 200 C 400 200, 440 60, 470 40');
    edge(e, 'mk', 'M298 214 C 420 214, 460 200, 488 196');
    edge(e, 'mc', 'M298 222 C 320 240, 330 258, 342 258');
    edge(e, 'mp', 'M298 190 C 320 170, 330 150, 342 140');
    edge(e, 'ma', 'M80 230 L 80 264');
    edge(e, 'at', 'M88 162 C 88 200, 238 230, 238 264'); edge(e, 'wt', 'M232 162 C 232 200, 238 230, 238 264');
    stage.append(bg, e, g, pkt);
    stat([]);
  }
  function plan() {
    const A = cum(); const S = [];
    if (mode === 'req') {
      S.push({ fly: ['usr', [65, 2], [550, 2], 'ent'], ...A.set({ usr: 'hot', ue: 'hot', ent: 'hot' }), run: () => stat(['token aud: <b>api://orders</b>']), t: 'The user signs in with <b>Entra ID</b> (OIDC) and the SPA gets an access token for the orders API’s app registration.' });
      S.push({ fly: ['usr', 'fd', [230, 88], 'api'], ...A.set({ uf: 'hot', fd: 'ok', fa: 'hot', api: 'hot', env: 'hot' }, { fd: 'WAF passed · X-Azure-FDID' }), t: '<b>Front Door</b> terminates TLS, applies WAF rules and routes to the nearest healthy origin. The Container App only accepts traffic from your Front Door profile (service tag + <code>X-Azure-FDID</code>, or Private Link).' });
      S.push({ ...A.set({ api: 'ok' }, { api: 'JWT valid' }), t: 'Spring Security, as an <b>OAuth2 resource server</b>, validates the token’s issuer, audience and signature, and maps app roles to authorities. No session state, so any replica can serve the next request.', cls: 'ok' });
      S.push({ fly: ['api', [260, 60], 'rds'], ...A.set({ ar: 'hot', rds: 'warn', pe: 'hot' }, { rds: 'miss: product 42' }), t: 'Cache-aside: read the product from <b>Redis</b> over its private endpoint. A miss falls through to Postgres and fills the cache with a TTL.', cls: 'warn' });
      S.push({ fly: ['api', [250, 80], 'pg'], ...A.set({ ap: 'ok', pg: 'ok' }, { pg: 'order + outbox, 1 tx' }), run: () => stat(['Hikari pool <b>8</b> × replicas ≤ budget']), t: 'The order and an outbox row are written in <b>one Postgres transaction</b>, through a small Hikari pool. Replicas × pool size must fit the server’s connection limit.', cls: 'ok' });
      S.push({ fly: ['api', [300, 196], 'sb'], ...A.set({ as: 'ok', sb: 'hot' }, { sb: 'OrderPlaced published' }), t: 'An <code>OrderPlaced</code> event goes to a <b>Service Bus</b> topic. The API answers 201 now; shipping happens asynchronously, so a slow carrier API can’t slow checkout.' });
      S.push({ fly: ['sb', [300, 150], 'wrk'], ...A.set({ sw: 'ok', wrk: 'ok', sb: 'ok' }, { wrk: 'scaled 0 → 3' }), t: '<b>KEDA</b> scales the worker on subscription backlog (capped by <code>maxReplicas</code>). The handler is idempotent and completes the message only after its work commits; failures retry, then dead-letter.', cls: 'ok' });
      S.push({ fly: ['wrk', [380, 300], 'blob'], ...A.set({ wb: 'ok', blob: 'ok' }, { blob: 'invoice-1042.pdf' }), run: () => stat(['user latency: API only', 'heavy work: async']), t: 'The worker writes the invoice to <b>Blob Storage</b>. Every hop stayed on private endpoints inside the VNet; only Front Door is public.', cls: 'ok' });
      return S;
    }
    if (mode === 'id') {
      S.push({ ...A.set({ api: 'hot', mi: 'hot', env: 'hot' }), run: () => stat(['secrets in config: <b>0</b>']), t: 'A new replica starts. Its configuration holds only <b>endpoints</b> and the identity’s <code>AZURE_CLIENT_ID</code>, nothing secret. The platform attached <code>id-orders</code> to the app.' });
      S.push({ fly: ['acr', [80, 264], 'mi'], ...A.set({ ma: 'ok', acr: 'ok' }, { acr: 'AcrPull via MI' }), t: 'Even the image pull uses the identity: the registry grants <b>AcrPull</b> to <code>id-orders</code>, so there is no registry password.', cls: 'ok' });
      S.push({ fly: ['mi', [440, 60], 'ent'], ...A.set({ me: 'hot', ent: 'hot' }, { ent: 'token per resource' }), run: () => stat(['token source: <b>managed identity endpoint</b>']), t: 'Spring Cloud Azure’s credential asks the platform’s managed identity endpoint for <b>Entra tokens</b>, one per target resource (database, Service Bus, Key Vault…), cached and refreshed before expiry.' });
      S.push({ fly: ['mi', [320, 240], 'cfg'], ...A.set({ mc: 'ok', cfg: 'ok' }, { cfg: 'Data Reader role' }), t: 'Settings and feature flags load from <b>App Configuration</b> with a data-reader role. Labels select the environment; the image is the same everywhere.', cls: 'ok' });
      S.push({ fly: ['mi', [440, 210], 'kv'], ...A.set({ mk: 'ok', kv: 'ok' }, { kv: 'Secrets User role' }), t: '<b>Key Vault</b> holds only what Entra can’t replace: the partner’s API key. The Key Vault property source reads it at startup with <i>Key Vault Secrets User</i> on that vault.', cls: 'ok' });
      S.push({ fly: ['mi', [320, 170], 'pg'], ...A.set({ mp: 'ok', pg: 'ok' }, { pg: 'token as password' }), t: '<b>Postgres</b>: the passwordless JDBC plugin sends a token as the password for the role <code>id-orders</code>, created once with <code>pgaadauth_create_principal</code> and granted only DML rights.', cls: 'ok' });
      S.push({ ...A.set({ sb: 'ok', blob: 'ok', rds: 'ok' }, { sb: 'Sender/Receiver', blob: 'Data Contributor', rds: 'Entra auth' }), run: () => stat(['secrets in config: <b>0</b>', 'roles: <b>scoped per resource</b>']), t: 'Service Bus (<i>Data Sender/Receiver</i>), Blob (<i>Storage Blob Data Contributor</i>) and Redis (Entra authentication where enabled) use the same identity. Nothing to rotate; revoking access is removing a role assignment.', cls: 'ok' });
      return S;
    }
    S.push({ ...A.set({ api: 'hot', wrk: 'hot', ai: 'hot' }, { api: 'role orders-api', wrk: 'role orders-worker' }), run: () => stat(['agent 3.x in every image']), t: 'Each image includes the <b>Application Insights Java agent</b> (via <code>JAVA_TOOL_OPTIONS</code>) with a distinct <b>role name</b>, so the Application Map shows each service separately.' });
    S.push({ fly: ['fd', [230, 88], 'api'], ...A.set({ fa: 'hot', fd: 'ok' }, { api: 'trace 7c1e…' }), t: 'A request arrives with a <code>traceparent</code> header (or gets a new trace). The agent records the request span; its trace id becomes <code>OperationId</code>.' });
    S.push({ fly: ['api', [250, 80], 'pg'], ...A.set({ ap: 'ok', ar: 'ok', pg: 'ok', rds: 'ok' }, { pg: 'dependency: SQL 14 ms', rds: 'dependency: GET 1 ms' }), t: 'JDBC and Redis calls become <b>dependency</b> spans automatically, with timing and success, under the same trace.', cls: 'ok' });
    S.push({ fly: ['api', [300, 196], 'sb', [300, 150], 'wrk'], ...A.set({ as: 'ok', sw: 'ok', sb: 'ok', wrk: 'ok' }, { sb: 'context in message', wrk: 'same OperationId' }), t: 'Publishing to Service Bus carries the trace context in the message. The worker’s processing span <b>joins the same trace</b>, seconds later and on another replica.', cls: 'ok' });
    S.push({ fly: ['api', [88, 200], 'ai'], ...A.set({ at: 'ok', wt: 'ok', ai: 'ok' }, { ai: 'traces + logs' }), run: () => stat(['one trace · 2 roles · 4 hops']), t: 'Telemetry and Container Apps console/system logs land in one <b>Log Analytics</b> workspace. One query by <code>OperationId</code> shows the whole order, from Front Door to invoice.', cls: 'ok' });
    S.push({ ...A.set({ ai: 'warn' }, { ai: 'alert: p95 > SLO' }), t: 'Alert on what users feel (failure rate and p95 per operation), plus a few causes (dead-letter count, DB connections near the limit). Every alert links to a runbook.', cls: 'warn' });
    return S;
  }
  const intro = () => ({ req: 'Press Play: follow one order through every component.', id: 'Press Play: one managed identity, every connection, zero secrets.', obs: 'Press Play: the same order, seen as one distributed trace.' }[mode]);
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), stats, controls, narr);
  const reset = makeStepper(plan, intro, build);
  reset();
});

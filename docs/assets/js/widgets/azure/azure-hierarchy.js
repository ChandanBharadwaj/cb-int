/* Azure hierarchy: build tenant → MG → subscription → RG → resource, see inheritance, and follow one ARM request through RBAC and Policy. */
IA.widget('azure-hierarchy', (root, ctx) => {
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
  let mode = 'tree';
  const stage = svg('svg', { viewBox: '0 0 640 410', role: 'img', 'aria-label': 'Azure resource hierarchy or ARM request pipeline' });
  const segM = seg([['tree', 'Hierarchy'], ['ok', 'ARM: success'], ['rbac', 'ARM: 403 no role'], ['pol', 'ARM: policy deny']], mode, (v) => { mode = v; reset(); }, 'Mode');
  const legend = el('div', { class: 'tiny', style: { marginTop: '6px' } });
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), controls, narr, legend);

  function buildTree() {
    const g = svg('g');
    node(g, 'ten', 210, 8, 220, 44, 'Entra ID tenant', 'corp.onmicrosoft.com');
    node(g, 'root', 210, 80, 220, 44, 'Tenant root group', 'management group');
    node(g, 'plat', 40, 152, 200, 44, 'mg-platform', 'management group');
    node(g, 'lz', 380, 152, 220, 44, 'mg-landing-zones', 'management group');
    node(g, 'subC', 40, 224, 200, 44, 'sub-connectivity', 'subscription');
    node(g, 'subP', 296, 224, 164, 44, 'sub-orders-prod', 'subscription');
    node(g, 'subD', 472, 224, 156, 44, 'sub-orders-dev', 'subscription');
    node(g, 'rgH', 40, 296, 200, 44, 'rg-hub-network', 'resource group');
    node(g, 'rgP', 296, 296, 164, 44, 'rg-orders-prod', 'resource group');
    node(g, 'rgD', 472, 296, 156, 44, 'rg-orders-dev', 'resource group');
    node(g, 'vnet', 80, 364, 120, 38, 'vnet-hub');
    node(g, 'app', 262, 364, 64, 38, 'app');
    node(g, 'pg', 332, 364, 64, 38, 'pg');
    node(g, 'kv', 402, 364, 64, 38, 'kv');
    node(g, 'appD', 500, 364, 100, 38, 'app-dev');
    const e = svg('g');
    [['e1', 'ten', 'root'], ['e2', 'root', 'plat'], ['e3', 'root', 'lz'], ['e4', 'plat', 'subC'], ['e5', 'lz', 'subP'], ['e6', 'lz', 'subD'],
      ['e7', 'subC', 'rgH'], ['e8', 'subP', 'rgP'], ['e9', 'subD', 'rgD'], ['e10', 'rgH', 'vnet'], ['e11', 'rgP', 'app'], ['e12', 'rgP', 'pg'], ['e13', 'rgP', 'kv'], ['e14', 'rgD', 'appD']]
      .forEach(([id, a, b]) => link(e, id, a, b));
    stage.append(e, g);
  }
  function buildArm() {
    const g = svg('g'); const e = svg('g');
    node(g, 'cli', 20, 30, 160, 54, 'az CLI / Bicep', 'portal, SDK, Terraform');
    node(g, 'entra', 240, 30, 160, 54, 'Entra ID', 'issues access token');
    node(g, 'arm', 460, 30, 160, 54, 'ARM', 'management.azure.com');
    node(g, 'rbac', 460, 170, 160, 54, 'RBAC check', 'role + deny assignments');
    node(g, 'pol', 240, 170, 160, 54, 'Azure Policy', 'deny / modify / audit');
    node(g, 'rp', 20, 170, 160, 54, 'Resource provider', 'e.g. DBforPostgreSQL');
    node(g, 'res', 20, 310, 160, 54, 'pg-orders', 'flexibleServers');
    node(g, 'log', 240, 310, 160, 54, 'Activity log', 'who / what / when');
    hlink(e, 'a1', 'cli', 'entra'); hlink(e, 'a2', 'entra', 'arm'); link(e, 'a3', 'arm', 'rbac'); hlink(e, 'a4', 'rbac', 'pol'); hlink(e, 'a5', 'pol', 'rp'); link(e, 'a6', 'rp', 'res'); hlink(e, 'a7', 'res', 'log');
    stage.append(e, g,
      svg('text', { class: 'lbl m', x: 440, y: 300, text: 'PUT /subscriptions/{id}' }),
      svg('text', { class: 'lbl m', x: 440, y: 316, text: '  /resourceGroups/rg-orders-prod' }),
      svg('text', { class: 'lbl m', x: 440, y: 332, text: '  /providers/Microsoft.DBforPostgreSQL' }),
      svg('text', { class: 'lbl m', x: 440, y: 348, text: '  /flexibleServers/pg-orders' }));
  }
  function onReset() {
    stage.innerHTML = ''; clearZ();
    if (mode === 'tree') buildTree(); else buildArm();
    stage.append(pkt);
    legend.innerHTML = mode === 'tree' ? 'Blue = the level being explained. Amber = inherited from an assignment above.' : 'Green = check passed. Red = request rejected. The dot is the HTTP request.';
  }
  function plan() {
    const A = cum(); const S = [];
    if (mode === 'tree') {
      S.push({ ...A.set({ ten: 'hot' }), t: 'A <b>Microsoft Entra ID tenant</b> is the identity directory: users, groups, app registrations, managed identities. Every subscription trusts exactly <b>one</b> tenant for sign-in and RBAC.' });
      S.push({ ...A.set({ ten: '', root: 'hot', e1: 'hot' }), t: 'The <b>Tenant root group</b> is created for you, and its ID equals the tenant ID. A role or Policy assigned here applies to <i>every</i> subscription, so only the platform team should touch it.' });
      S.push({ ...A.set({ root: '', e1: '', plat: 'hot', lz: 'hot', e2: 'hot', e3: 'hot' }), t: '<b>Management groups</b> group subscriptions for governance. Each child has exactly one parent, and Microsoft Learn documents up to six levels below the root. Organise them by <i>policy needs</i> (platform vs landing zones), not by org chart.' });
      S.push({ ...A.set({ plat: '', lz: '', e2: '', e3: '', subC: 'hot', subP: 'hot', subD: 'hot', e4: 'hot', e5: 'hot', e6: 'hot' }), t: '<b>Subscriptions</b> are the billing, quota and isolation boundary. A common pattern is one subscription per workload per environment, created by an automated “subscription vending” process.' });
      S.push({ ...A.set({ subC: '', subP: '', subD: '', e4: '', e5: '', e6: '', rgH: 'hot', rgP: 'hot', rgD: 'hot', e7: 'hot', e8: 'hot', e9: 'hot' }), t: '<b>Resource groups</b> are a lifecycle container: things that are deployed, secured and deleted together. Delete the RG and everything in it goes. The RG’s region only stores its metadata.' });
      S.push({ ...A.set({ rgH: '', rgP: '', rgD: '', e7: '', e8: '', e9: '', vnet: 'hot', app: 'hot', pg: 'hot', kv: 'hot', appD: 'hot', e10: 'hot', e11: 'hot', e12: 'hot', e13: 'hot', e14: 'hot' }), t: '<b>Resources</b> live in exactly one RG. Each has an ID that spells out its scope path: <code>/subscriptions/…/resourceGroups/rg-orders-prod/providers/Microsoft.DBforPostgreSQL/flexibleServers/pg</code>. A resource can sit in a different region from its RG.' });
      A.clear();
      S.push({ ...A.set({ lz: 'hot', subP: 'warn', subD: 'warn', rgP: 'warn', rgD: 'warn', app: 'warn', pg: 'warn', kv: 'warn', appD: 'warn', e5: 'warn', e6: 'warn', e8: 'warn', e9: 'warn', e11: 'warn', e12: 'warn', e13: 'warn', e14: 'warn', plat: 'dim', subC: 'dim', rgH: 'dim', vnet: 'dim' }),
        t: 'Why the tree matters: an RBAC role, a Policy or a lock assigned at <code>mg-landing-zones</code> is <b>inherited</b> by every subscription, RG and resource under it. The platform branch is untouched. See <a href="rbac-policy.html">RBAC &amp; Policy</a>.', cls: 'warn' });
      A.clear();
      S.push({ ...A.set({ ten: 'hot', root: 'hot', lz: 'hot', subP: 'hot', rgP: 'hot', pg: 'ok', e1: 'hot', e3: 'hot', e5: 'hot', e8: 'hot', e12: 'hot', plat: 'dim', subC: 'dim', rgH: 'dim', vnet: 'dim', subD: 'dim', rgD: 'dim', appD: 'dim' }),
        t: 'The effective permissions on <code>pg</code> are the <b>union</b> of every assignment on this path: root group → mg-landing-zones → sub-orders-prod → rg-orders-prod → pg. Moving a subscription to another management group changes that path, and its inherited roles and policies change with it.', cls: 'ok' });
      return S;
    }
    S.push({ ...A.set({ cli: 'hot' }), t: '<code>az deployment group create -g rg-orders-prod -f main.bicep</code>. The CLI compiles Bicep to an ARM JSON template locally, then needs a token for the control plane.' });
    S.push({ pre: A.set({}), fly: ['cli', 'entra'], ...A.set({ entra: 'ok', a1: 'ok' }), t: 'Entra ID issues an access token whose audience is <code>https://management.azure.com/</code>. This token works only for the <b>control plane</b> (ARM). It cannot read a blob or a Key Vault secret.' });
    S.push({ fly: ['entra', 'arm'], ...A.set({ arm: 'hot', a2: 'hot' }), t: 'Every control-plane call, whether it comes from the portal, CLI, SDK or Terraform, is an HTTPS request to <b>Azure Resource Manager</b>: a <code>PUT</code> on the resource ID with an <code>api-version</code>.' });
    if (mode === 'rbac') {
      S.push({ fly: ['arm', 'rbac'], ...A.set({ rbac: 'bad', a3: 'bad' }), t: '<b>403 AuthorizationFailed</b>: no role assignment on this scope or any parent grants <code>Microsoft.DBforPostgreSQL/flexibleServers/write</code>. Fix: give the deploying identity Contributor (or a narrower role) on the RG, then wait for propagation (usually minutes).', cls: 'err' });
      return S;
    }
    S.push({ fly: ['arm', 'rbac'], ...A.set({ rbac: 'ok', a3: 'ok' }), t: 'ARM checks <b>RBAC</b>: does any role assigned at the resource, RG, subscription or management group allow the action, and does no deny assignment block it? Here yes: Contributor is assigned on <code>rg-orders-prod</code>.' });
    if (mode === 'pol') {
      S.push({ fly: ['rbac', 'pol'], ...A.set({ pol: 'bad', a4: 'bad' }), t: '<b>403 RequestDisallowedByPolicy</b>: the template says <code>location: \'eastus\'</code>, but an “Allowed locations” policy on <code>mg-landing-zones</code> only permits the EU regions. RBAC said yes; Policy still says no. Fix the template, or ask for a scoped exemption.', cls: 'err' });
      return S;
    }
    S.push({ fly: ['rbac', 'pol'], ...A.set({ pol: 'ok', a4: 'ok' }), t: '<b>Azure Policy</b> evaluates the request body. A <i>Deny</i> effect would reject it, and a <i>Modify</i> effect could add a missing tag. Write and delete requests are also checked against <b>resource locks</b>.' });
    S.push({ fly: ['pol', 'rp'], ...A.set({ rp: 'hot', a5: 'ok' }), t: 'ARM forwards the request to the <b>resource provider</b>. The provider must be registered in the subscription, otherwise you get <code>MissingSubscriptionRegistration</code>. Long operations return <code>202</code>, and ARM polls them.' });
    S.push({ fly: ['rp', 'res'], ...A.set({ rp: 'ok', res: 'ok', a6: 'ok' }), t: 'The server exists. Its ID is its address in the hierarchy, so every later RBAC check walks that same path.', cls: 'ok' });
    S.push({ fly: ['res', 'log'], ...A.set({ log: 'ok', a7: 'ok' }), t: 'The write is recorded in the subscription’s <b>Activity log</b>: caller, operation and status. Activity logs are kept for 90 days. Export them to Log Analytics if you need them longer.', cls: 'ok' });
    return S;
  }
  const intro = () => (mode === 'tree' ? 'Press Play to build the hierarchy from the tenant down, then see how assignments inherit.' : 'Press Play to follow one ARM request, from token to resource, through every check.');
  const reset = makeStepper(plan, intro, onReset);
  reset();
});

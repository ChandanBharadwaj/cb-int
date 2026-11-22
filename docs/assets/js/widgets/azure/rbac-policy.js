/* RBAC & Policy: role assignments inheriting down scopes (control vs data plane, NotActions) and a deploy evaluated by Policy effects (deny, modify, deployIfNotExists, audit). */
IA.widget('rbac-policy', (root, ctx) => {
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
  let mode = 'rbac';
  const stage = svg('svg', { viewBox: '0 0 640 330', role: 'img', 'aria-label': 'Scope tree with role or policy assignments flowing down' });
  const segM = seg([['rbac', 'RBAC: roles inherit down'], ['policy', 'Policy: evaluate a deploy']], mode, (v) => { mode = v; reset(); }, 'Mode');
  function build() {
    stage.innerHTML = ''; clearZ();
    const g = svg('g'); const e = svg('g');
    node(g, 'mg', 16, 14, 228, 46, 'mg-landing-zones', 'no assignments');
    node(g, 'sub', 16, 94, 228, 46, 'sub-orders-prod', '—');
    node(g, 'rg', 16, 174, 228, 46, 'rg-orders-prod', '—');
    node(g, 'st', 16, 262, 108, 50, 'storage', '—');
    node(g, 'app', 136, 262, 108, 50, 'web app', '—');
    link(e, 't1', 'mg', 'sub'); link(e, 't2', 'sub', 'rg'); link(e, 't3', 'rg', 'st'); link(e, 't4', 'rg', 'app');
    if (mode === 'rbac') {
      stage.append(svg('text', { class: 'lbl', x: 300, y: 12, text: 'Effective access of group “dev-team”' }));
      [['cRead', 'Read any resource (control plane)'], ['cMod', 'Change / restart the web app'], ['cRbac', 'Assign roles to others'], ['cBlob', 'Read blobs with an Entra token'], ['cKeys', 'List storage account keys'], ['cDel', 'Delete rg-orders-prod']]
        .forEach(([id, t], i) => node(g, id, 300, 22 + i * 51, 324, 40, t, 'denied'));
    } else {
      node(g, 'req', 300, 14, 324, 46, 'PUT storage account “stlogs”', 'location: eastus, no tags');
      node(g, 'pDeny', 300, 94, 156, 50, 'Allowed locations', 'effect: deny');
      node(g, 'pMod', 468, 94, 156, 50, 'Inherit tag “owner”', 'effect: modify');
      node(g, 'pDine', 300, 176, 156, 50, 'Diagnostic settings', 'deployIfNotExists');
      node(g, 'pAud', 468, 176, 156, 50, 'Existing resources', 'compliance scan');
      node(g, 'diag', 300, 262, 156, 50, 'diag → Log Analytics', 'not yet');
      node(g, 'old', 468, 262, 156, 50, 'st-legacy', 'eastus, pre-policy');
      link(e, 'p1', 'pDeny', 'pDine'); link(e, 'p2', 'pDine', 'diag'); link(e, 'p3', 'pAud', 'old');
    }
    stage.append(e, g, pkt);
  }
  function plan() {
    const A = cum(); const S = [];
    if (mode === 'rbac') {
      S.push({ ...A.set({ mg: 'hot', sub: 'warn', rg: 'warn', st: 'warn', app: 'warn', t1: 'warn', t2: 'warn', t3: 'warn', t4: 'warn', cRead: 'ok' }, { mg: 'Reader → dev-team', sub: 'inherited Reader', rg: 'inherited Reader', st: 'Reader', app: 'Reader', cRead: 'Reader @ mg' }),
        t: 'A <b>role assignment</b> = <i>who</i> (principal) + <i>what</i> (role definition) + <i>where</i> (scope). <b>Reader</b> at the management group is inherited by every subscription, RG and resource under it.' });
      S.push({ ...A.set({ rg: 'hot', cMod: 'ok', cDel: 'ok', cRbac: 'bad' }, { rg: 'Contributor (+ inherited Reader)', st: 'Reader+Contrib.', app: 'Reader+Contrib.', cMod: 'Contributor @ rg', cDel: 'Contributor @ rg', cRbac: 'Contributor excludes Microsoft.Authorization writes' }),
        t: 'Add <b>Contributor</b> on the RG. Effective permissions are the <b>union</b> of every assignment on the path, so the team can now change and even delete everything in the RG. Contributor can’t grant access to others: that needs Owner, User Access Administrator or RBAC Administrator.' });
      S.push({ ...A.set({ cBlob: 'bad' }, { cBlob: 'Contributor has no DataActions' }),
        t: 'But reading blobs with their own Entra token fails. Contributor’s permissions are <code>Actions</code> (control plane). Blob reads are <code>DataActions</code>, granted by data roles such as <b>Storage Blob Data Reader</b>.', cls: 'warn' });
      S.push({ ...A.set({ cKeys: 'bad' }, { cKeys: 'Contributor can call listKeys!' }),
        t: 'The catch: Contributor <i>can</i> call <code>listKeys</code>, and an account key gives full data access, bypassing RBAC. Set <code>allowSharedKeyAccess: false</code> on the account so that Entra plus data roles is the only way in.', cls: 'err' });
      S.push({ ...A.set({ st: 'ok', cBlob: 'ok', cKeys: 'ok' }, { st: 'Blob Data Reader', cBlob: 'Blob Data Reader @ storage', cKeys: 'keys disabled on the account' }),
        t: 'Assign <b>Storage Blob Data Reader</b> at the <i>storage account</i> scope (or a single container). That is least privilege at the smallest scope: data access is explicit, and shared keys are off.', cls: 'ok' });
      S.push({ ...A.set({ cDel: 'warn' }, { cDel: 'NotActions don’t deny' }),
        t: 'Want “Contributor but no delete”? A custom role with <code>NotActions: [*/delete]</code> only <i>removes from that role</i>. It doesn’t deny anything if another role still grants delete. Use a <b>CanNotDelete lock</b> for protection; deny assignments are created only by Azure features such as deployment stacks and managed apps.', cls: 'warn' });
      return S;
    }
    S.push({ ...A.set({ mg: 'hot', sub: 'warn', rg: 'warn', st: 'warn', app: 'warn', t1: 'warn', t2: 'warn', t3: 'warn', t4: 'warn', pDeny: 'hot', pMod: 'hot', pDine: 'hot', pAud: 'hot' }, { mg: 'initiative: lz-baseline', sub: 'inherited', rg: 'tag owner=team-orders', st: 'inherited', app: 'inherited' }),
      t: 'An <b>initiative</b> (policy set) “lz-baseline” is assigned at the management group. It bundles policies with different <b>effects</b>, and every scope below inherits it.' });
    S.push({ fly: ['req', 'pDeny'], ...A.set({ req: 'hot', pDeny: 'bad' }), t: 'A deploy asks for <code>eastus</code>. Policy runs <b>inside the ARM request</b>, so <b>deny</b> rejects it with <code>RequestDisallowedByPolicy</code> before anything is created. RBAC said yes; Policy still says no.', cls: 'err' });
    S.push({ ...A.set({ req: 'hot', pDeny: 'ok', pMod: 'ok' }, { req: 'location: westeurope, no tags' }), fly: ['req', 'pMod'], t: 'Retry in <code>westeurope</code>. <b>Modify</b> changes the request on the way in: the missing <code>owner</code> tag is copied from the RG. (<b>Append</b> is the older, simpler variant.)', cls: 'ok' });
    S.push({ fly: ['pMod', 'rg', 'st'], ...A.set({ st: 'ok', req: 'ok' }, { st: 'stlogs created', req: 'created' }), t: 'The storage account is created, already tagged and in an allowed region.', cls: 'ok' });
    S.push({ fly: ['pDine', 'diag'], ...A.set({ pDine: 'ok', diag: 'ok' }, { diag: 'deployed by policy MI' }), t: '<b>DeployIfNotExists</b> notices there are no diagnostic settings and deploys them through a template, running as the <b>assignment’s managed identity</b>. That identity needs a role (for example, Monitoring Contributor) at the scope.', cls: 'ok' });
    S.push({ fly: ['pAud', 'old'], ...A.set({ pAud: 'warn', old: 'warn' }, { old: 'NON-COMPLIANT (kept)' }), t: 'Resources that already existed aren’t deleted. The compliance scan marks <code>st-legacy</code> <b>non-compliant</b>. Fix it with a <i>remediation task</i> (for modify and deployIfNotExists) or by hand, or grant a time-boxed <b>exemption</b>.', cls: 'warn' });
    return S;
  }
  const intro = () => (mode === 'rbac' ? 'RBAC: press Play to add role assignments at different scopes and watch the effective access change.' : 'Policy: press Play to assign an initiative, then send a deploy through its effects.');
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), controls, narr);
  const reset = makeStepper(plan, intro, build);
  reset();
});

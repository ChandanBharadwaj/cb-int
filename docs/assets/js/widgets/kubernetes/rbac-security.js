/* RBAC & Pod security: follow one API request through authentication → RBAC (subject → binding → role → verb/resource) → admission (Pod Security) → etcd. */
IA.widget('rbac-security', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8rb-style')) {
    document.head.append(el('style', { id: 'w-k8rb-style', text: `
.k8rb svg text { font-family: var(--sans); }
.k8rb .st { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: all .3s; }
.k8rb .st.cur { stroke: var(--accent); stroke-width: 3; fill: var(--accent-soft); }
.k8rb .st.ok { stroke: var(--ok); fill: color-mix(in srgb, var(--ok) 14%, var(--surface)); }
.k8rb .st.bad { stroke: var(--err); stroke-width: 2.5; fill: color-mix(in srgb, var(--err) 14%, var(--surface)); }
.k8rb .st.skip { stroke-dasharray: 5 4; opacity: .55; }
.k8rb .sl { font-size: 12.5px; font-weight: 700; fill: var(--text); }
.k8rb .ss { font-size: 10px; fill: var(--text-3); font-family: var(--mono); }
.k8rb .req { font-family: var(--mono); font-size: 12px; fill: var(--text); }
.k8rb .ph { font-size: 11px; font-weight: 700; fill: var(--text-3); letter-spacing: .04em; }
.k8rb .bx { fill: var(--surface-2); stroke: var(--border); stroke-width: 1.2; transition: all .3s; }
.k8rb .bx.scan { stroke: var(--accent-2); stroke-dasharray: 4 3; stroke-width: 2; }
.k8rb .bx.hit { stroke: var(--ok); stroke-width: 2.5; }
.k8rb .bx.miss { stroke: var(--err); stroke-width: 2; opacity: .75; }
.k8rb .bn { font-size: 12px; font-weight: 700; fill: var(--text); }
.k8rb .bm { font-size: 10.5px; fill: var(--text-2); font-family: var(--mono); }
.k8rb .rule.ok { fill: var(--ok); font-weight: 700; } .k8rb .rule.bad { fill: var(--err); }
.k8rb .lnk { stroke: var(--ok); stroke-width: 2.5; fill: none; }
.k8rb .lnk.bad { stroke: var(--err); stroke-dasharray: 5 4; }
` }));
  }
  const STAGES = [['Request', 'HTTPS + credential'], ['Authentication', 'who are you?'], ['Authorization', 'RBAC: may you?'], ['Admission', 'mutate · validate'], ['etcd / response', 'persist or return']];
  const BIND = [
    { n: 'RoleBinding orders-config', s: 'ns: shop', sub: 'ServiceAccount shop/orders', ref: '→ Role config-reader' },
    { n: 'RoleBinding devs-edit', s: 'ns: shop', sub: 'Group team-shop', ref: '→ ClusterRole edit' },
    { n: 'ClusterRoleBinding system:discovery', s: 'cluster-wide', sub: 'Group system:authenticated', ref: '→ ClusterRole system:discovery' }
  ];
  const ROLES = [
    { n: 'Role config-reader', s: 'ns: shop', rules: ['"" configmaps: get, list, watch'] },
    { n: 'ClusterRole edit', s: 'aggregated, reused per namespace', rules: ['pods, deployments, services,', 'secrets, configmaps…: create, get,', 'list, update, patch, delete'] },
    { n: 'ClusterRole system:discovery', s: 'cluster-wide', rules: ['nonResourceURLs /api, /apis,', '/version, /healthz: get'] }
  ];
  const SA = 'system:serviceaccount:shop:orders';
  const authn = (who, groups, how) => ({ st: ['ok', 'cur'], say: `<b>Authentication</b>: ${how} The subject becomes <code>${who}</code> with groups ${groups}. Authentication only says <i>who</i>; it grants nothing.` });
  const scan = (ns) => ({ st: ['ok', 'ok', 'cur'], scan: [0, 1, 2], say: `<b>RBAC</b> collects every binding that could apply: RoleBindings in namespace <code>${ns}</code> plus all ClusterRoleBindings. It looks for <i>one</i> rule that allows this exact verb + resource + API group.` });
  const SC = {
    get: { l: 'SA reads a ConfigMap', req: `${SA}  GET  configmaps/app-config  -n shop`, steps: [
      { st: ['cur'], say: 'The <code>orders</code> pod calls <code>GET /api/v1/namespaces/shop/configmaps/app-config</code> with its projected service-account token as a Bearer token.' },
      authn(SA, '<code>system:serviceaccounts</code>, <code>system:serviceaccounts:shop</code>, <code>system:authenticated</code>', 'the API server checks the token’s signature, audience and expiry (and that the pod it was bound to still exists).'),
      scan('shop'),
      { st: ['ok', 'ok', 'cur'], hit: [0], role: 0, rule: [0, 0, 'ok'], link: [0, 0, 'ok'], say: '<b>orders-config</b> lists the subject <code>ServiceAccount shop/orders</code>. Its roleRef is Role <b>config-reader</b>, whose rule covers <code>""</code> (core group) · <code>configmaps</code> · <code>get</code>. One matching rule is enough: <b>allowed</b>.', tone: 'ok' },
      { st: ['ok', 'ok', 'ok', 'skip', 'cur'], hit: [0], role: 0, rule: [0, 0, 'ok'], link: [0, 0, 'ok'], say: 'Admission webhooks and Pod Security only run on writes (create, update, patch, delete, connect). A read goes straight to storage.' },
      { st: ['ok', 'ok', 'ok', 'skip', 'ok'], hit: [0], role: 0, rule: [0, 0, 'ok'], link: [0, 0, 'ok'], say: '<b>200 OK</b>. Check it yourself: <code>kubectl auth can-i get configmaps -n shop --as=system:serviceaccount:shop:orders</code> → <code>yes</code>.', tone: 'ok', done: true }
    ] },
    secrets: { l: 'SA lists Secrets', req: `${SA}  LIST  secrets  -n shop`, steps: [
      { st: ['cur'], say: 'Same pod, new call: <code>GET /api/v1/namespaces/shop/secrets</code>, the <b>list</b> verb. Maybe a library tries to discover its own credentials.' },
      authn(SA, '<code>system:serviceaccounts:shop</code>, <code>system:authenticated</code> …', 'the token is valid, so authentication succeeds.'),
      scan('shop'),
      { st: ['ok', 'ok', 'cur'], hit: [0], miss: [], role: 0, rule: [0, 0, 'bad'], link: [0, 0, 'bad'], say: '<b>orders-config</b> matches the subject, but config-reader only covers <code>configmaps</code>. No match for <code>secrets</code>.' },
      { st: ['ok', 'ok', 'cur'], miss: [0, 1, 2], role: 2, rule: [2, 0, 'bad'], say: '<b>devs-edit</b> binds Group <code>team-shop</code>; the SA is not in it. <b>system:discovery</b> matches <code>system:authenticated</code>, but only for discovery URLs. Nothing else to try.' },
      { st: ['ok', 'ok', 'bad', 'skip', 'skip'], miss: [0, 1, 2], say: '<b>403 Forbidden</b>: <code>secrets is forbidden: User "system:serviceaccount:shop:orders" cannot list resource "secrets" in API group "" in the namespace "shop"</code>. RBAC is deny-by-default and purely additive: there are no deny rules, so “block” means “never grant”.', tone: 'err', done: true }
    ] },
    ns: { l: 'SA reads another namespace', req: `${SA}  GET  configmaps/app-config  -n billing`, steps: [
      { st: ['cur'], say: 'The same SA now asks for a ConfigMap in namespace <code>billing</code>.' },
      authn(SA, '<code>system:serviceaccounts:shop</code>, <code>system:authenticated</code> …', 'the token is valid.'),
      scan('billing'),
      { st: ['ok', 'ok', 'cur'], miss: [0, 1], role: 0, rule: [0, 0, 'bad'], say: '<b>orders-config</b> lives in <code>shop</code>. A RoleBinding grants permissions <i>only in its own namespace</i>, even if it points at a ClusterRole. In <code>billing</code> there is no binding for this SA.' },
      { st: ['ok', 'ok', 'bad', 'skip', 'skip'], miss: [0, 1, 2], say: '<b>403 Forbidden</b>. To allow it, the billing team creates a RoleBinding in <code>billing</code> whose subject is <code>ServiceAccount shop/orders</code>; subjects can come from other namespaces.', tone: 'err', done: true }
    ] },
    priv: { l: 'Dev creates a privileged Pod', req: 'alice (team-shop)  CREATE  pods/debug  -n shop  privileged: true', steps: [
      { st: ['cur'], say: 'Developer <code>alice</code> runs <code>kubectl apply</code> on a debug Pod with <code>securityContext.privileged: true</code>.' },
      authn('alice', '<code>team-shop</code>, <code>system:authenticated</code>', 'her OIDC ID token is verified against the cluster’s issuer; the groups come from a token claim.'),
      scan('shop'),
      { st: ['ok', 'ok', 'cur'], hit: [1], role: 1, rule: [1, 0, 'ok'], link: [1, 1, 'ok'], say: '<b>devs-edit</b> binds Group <code>team-shop</code> to ClusterRole <b>edit</b>. Because the binding is a <i>RoleBinding</i>, edit applies only inside <code>shop</code>. <code>create pods</code> is allowed.', tone: 'ok' },
      { st: ['ok', 'ok', 'ok', 'cur'], hit: [1], role: 1, link: [1, 1, 'ok'], say: '<b>Admission</b>: mutating admission runs first (default SA, defaults, webhooks), then validating. The <b>PodSecurity</b> admission plugin reads the namespace label <code>pod-security.kubernetes.io/enforce: restricted</code>.' },
      { st: ['ok', 'ok', 'ok', 'bad', 'skip'], hit: [1], role: 1, link: [1, 1, 'ok'], say: '<b>403 Forbidden</b>: <code>violates PodSecurity "restricted:latest": privileged, allowPrivilegeEscalation != false, unrestricted capabilities, runAsNonRoot != true, seccompProfile</code>. RBAC said “you may create Pods”; admission said “not <i>this</i> Pod”. They are separate gates.', tone: 'err', done: true }
    ] },
    ok: { l: 'Dev creates a restricted Pod', req: 'alice (team-shop)  CREATE  pods/orders-debug  -n shop  (restricted)', steps: [
      { st: ['cur'], say: 'Alice fixes the manifest: <code>runAsNonRoot: true</code>, <code>allowPrivilegeEscalation: false</code>, <code>capabilities.drop: [ALL]</code>, <code>seccompProfile: RuntimeDefault</code>.' },
      authn('alice', '<code>team-shop</code>, <code>system:authenticated</code>', 'OIDC token verified.'),
      scan('shop'),
      { st: ['ok', 'ok', 'cur'], hit: [1], role: 1, rule: [1, 0, 'ok'], link: [1, 1, 'ok'], say: 'devs-edit → ClusterRole edit → <code>create pods</code>: allowed.', tone: 'ok' },
      { st: ['ok', 'ok', 'ok', 'ok', 'cur'], hit: [1], role: 1, link: [1, 1, 'ok'], say: 'PodSecurity <code>restricted</code> checks pass. Any ValidatingAdmissionPolicy (CEL, GA in 1.30) or webhook also passes.' },
      { st: ['ok', 'ok', 'ok', 'ok', 'ok'], hit: [1], role: 1, link: [1, 1, 'ok'], say: '<b>201 Created</b>: the Pod is stored in etcd and the scheduler picks it up. Its containers run as non-root with no capabilities and the runtime’s default seccomp filter.', tone: 'ok', done: true }
    ] }
  };
  let mode = 'get'; let steps = []; let k = 0; let gen = 0; let running = false; let speed = 2600;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const W = 760; const H = 330;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'API request pipeline with RBAC bindings and roles' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('k8rb');
  root.append(el('div', { class: 'w-controls' }, seg(Object.entries(SC).map(([v, s]) => [v, s.l]), mode, (v) => { mode = v; reset(); }, 'Request')),
    el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg([[3800, 'Slow'], [2600, 'Normal'], [1300, 'Fast']], speed, (v) => { speed = v; }, 'Speed')), narr);
  const say = (h, tone) => { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const BX = (i) => 10 + i * 149; const BW = 135;
  function draw(s) {
    stage.innerHTML = '';
    STAGES.forEach(([t, sub], i) => {
      const cls = s.st[i] || '';
      stage.append(svg('rect', { class: 'st ' + cls, x: BX(i), y: 10, width: BW, height: 52, rx: 10 }),
        svg('text', { class: 'sl', x: BX(i) + BW / 2, y: 32, 'text-anchor': 'middle', text: t }),
        svg('text', { class: 'ss', x: BX(i) + BW / 2, y: 49, 'text-anchor': 'middle', text: cls === 'bad' ? '✗ 403' : cls === 'skip' ? 'skipped' : sub }));
      if (i < 4) stage.append(svg('path', { d: `M${BX(i) + BW + 2} 36 l10 0 m-4 -4 l4 4 l-4 4`, stroke: 'var(--text-3)', fill: 'none', 'stroke-width': 1.5 }));
    });
    stage.append(svg('text', { class: 'req', x: 10, y: 86, text: '› ' + SC[mode].req }));
    stage.append(svg('text', { class: 'ph', x: 10, y: 110, text: 'BINDINGS (subject → roleRef)' }), svg('text', { class: 'ph', x: 400, y: 110, text: 'ROLES (rules: apiGroup · resource · verbs)' }));
    const rbac = s.st[2] === 'cur' || s.st[2] === 'ok' || s.st[2] === 'bad';
    BIND.forEach((b, i) => {
      const y = 118 + i * 70;
      let cls = 'bx';
      if (rbac && s.scan && s.scan.includes(i)) cls += ' scan';
      if (s.hit && s.hit.includes(i)) cls += ' hit'; else if (s.miss && s.miss.includes(i)) cls += ' miss';
      stage.append(svg('rect', { class: cls, x: 10, y, width: 340, height: 62, rx: 8 }),
        svg('text', { class: 'bn', x: 20, y: y + 18, text: b.n }), svg('text', { class: 'ss', x: 340, y: y + 18, 'text-anchor': 'end', text: b.s }),
        svg('text', { class: 'bm', x: 20, y: y + 36, text: 'subject: ' + b.sub }), svg('text', { class: 'bm', x: 20, y: y + 52, text: b.ref }));
    });
    ROLES.forEach((r, i) => {
      const y = 118 + i * 70; const on = s.role === i;
      const ruleCls = s.rule && s.rule[0] === i ? s.rule[2] : '';
      stage.append(svg('rect', { class: 'bx' + (on ? (ruleCls === 'bad' ? ' miss' : ' hit') : ''), x: 400, y, width: 350, height: 62, rx: 8 }),
        svg('text', { class: 'bn', x: 410, y: y + 18, text: r.n }), svg('text', { class: 'ss', x: 740, y: y + 18, 'text-anchor': 'end', text: r.s }));
      r.rules.forEach((line, j) => stage.append(svg('text', { class: 'bm' + (on && ruleCls ? ' rule ' + ruleCls : ''), x: 410, y: y + 34 + j * 12, text: line })));
    });
    if (s.link) {
      const [b, r, tone] = s.link; const y1 = 118 + b * 70 + 31; const y2 = 118 + r * 70 + 31;
      const p = svg('path', { class: 'lnk' + (tone === 'bad' ? ' bad' : ''), d: `M350 ${y1} C 375 ${y1}, 375 ${y2}, 400 ${y2}` });
      if (!reduced) { p.style.strokeDasharray = tone === 'bad' ? '5 4' : '120'; if (tone !== 'bad') { p.style.strokeDashoffset = '120'; p.style.transition = 'stroke-dashoffset .8s ease'; requestAnimationFrame(() => { p.style.strokeDashoffset = '0'; }); } }
      stage.append(p);
    }
    if (s.rule && s.rule[2] === 'ok') stage.append(svg('text', { x: 744, y: 118 + s.rule[0] * 70 + 56, 'text-anchor': 'end', 'font-size': 16, 'font-weight': 800, fill: 'var(--ok)', text: '✓' }));
    if (s.rule && s.rule[2] === 'bad') stage.append(svg('text', { x: 744, y: 118 + s.rule[0] * 70 + 56, 'text-anchor': 'end', 'font-size': 16, 'font-weight': 800, fill: 'var(--err)', text: '✗' }));
  }
  function show(s) { draw(s); say(s.say, s.tone); }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; steps = SC[mode].steps; k = 0; bStep.disabled = false; show(steps[k++]); }
  function step() { if (k >= steps.length) return false; show(steps[k++]); if (k >= steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    if (reduced) { while (g === gen && step()); } else while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

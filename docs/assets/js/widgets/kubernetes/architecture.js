/* Cluster architecture: one kubectl apply travelling API server → admission → etcd → controllers → scheduler → kubelet → runtime → EndpointSlice → kube-proxy, with optional failures. */
IA.widget('architecture', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8ar-style')) {
    document.head.append(el('style', { id: 'w-k8ar-style', text: `
.k8ar svg text { font-family: var(--sans); }
.k8ar .c rect { fill: var(--surface-2); stroke: var(--border); stroke-width: 1.3; transition: fill .35s, stroke .35s; }
.k8ar .c text { fill: var(--text); font-size: 12.5px; font-weight: 600; }
.k8ar .c text.s { fill: var(--text-3); font-size: 10.5px; font-weight: 400; font-family: var(--mono); }
.k8ar .c.hot rect { stroke: var(--accent); stroke-width: 2.2; fill: var(--accent-soft); }
.k8ar .c.err rect { stroke: var(--err); stroke-width: 2.2; fill: color-mix(in srgb, var(--err) 12%, transparent); }
.k8ar .c.ok rect { stroke: var(--ok); stroke-width: 2; }
.k8ar .achip rect { fill: var(--surface); stroke: var(--border); transition: fill .3s, stroke .3s; }
.k8ar .achip text { font-size: 10.5px; fill: var(--text-2); font-family: var(--mono); }
.k8ar .achip.hot rect { stroke: var(--accent); fill: var(--accent-soft); stroke-width: 2; }
.k8ar .achip.ok rect { stroke: var(--ok); }
.k8ar .achip.err rect { stroke: var(--err); fill: color-mix(in srgb, var(--err) 14%, transparent); stroke-width: 2; }
.k8ar .frame { fill: none; stroke: var(--k-external); stroke-dasharray: 3 4; }
.k8ar .lab { fill: var(--text-3); font-size: 11px; }
.k8ar .key { font-family: var(--mono); font-size: 10.5px; fill: var(--text-2); }
.k8ar .key.new { fill: var(--accent); font-weight: 700; }
.k8ar .key.warn { fill: var(--warn); }
.k8ar .pod rect { stroke-width: 1.5; }
.k8ar .pkt { fill: var(--accent); }
.k8ar .pkt.err { fill: var(--err); }
.k8ar .rules { font-family: var(--mono); font-size: 10.5px; fill: var(--k-compute); }
` }));
  }
  let brk = 'none'; let gen = 0; let running = false; let speed = 2600; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segB = seg([['none', 'nothing broken'], ['webhook', 'webhook down'], ['etcd', 'etcd lost quorum'], ['sched', 'scheduler down']], () => brk, (v) => { brk = v; reset(); }, 'Failure to inject');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1300, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const stage = svg('svg', { viewBox: '0 0 760 470', role: 'img', 'aria-label': 'Control plane components above, a worker node below, a message dot moving between them' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('k8ar');
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'break' }), segB), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);

  const comp = (id, x, y, w, h, t, s) => { const g = svg('g', { class: 'c' }); g.append(svg('rect', { x, y, width: w, height: h, rx: 9 }), svg('text', { x: x + 10, y: y + 20, text: t }));
    if (s) g.append(svg('text', { class: 's', x: x + 10, y: y + 36, text: s })); C[id] = { g, cx: x + w / 2, cy: y + h / 2 }; return g; };
  const C = {};
  stage.append(svg('rect', { class: 'frame', x: 128, y: 8, width: 624, height: 262, rx: 12 }), svg('text', { class: 'lab', x: 140, y: 140, text: 'control plane' }),
    svg('rect', { class: 'frame', x: 8, y: 282, width: 744, height: 180, rx: 12 }), svg('text', { class: 'lab', x: 20, y: 300, text: 'worker node-1' }));
  stage.append(comp('kubectl', 12, 40, 100, 56, 'kubectl', 'apply -f web.yaml'));
  stage.append(comp('api', 140, 20, 440, 100, 'kube-apiserver', ''));
  const CH = ['authn', 'authz', 'mutating', 'schema', 'validating'];
  const chips = {}; CH.forEach((c, i) => { const x = 150 + i * 84; const g = svg('g', { class: 'achip' }); g.append(svg('rect', { x, y: 64, width: 76, height: 26, rx: 6 }), svg('text', { x: x + 8, y: 81, text: c })); chips[c] = g; stage.append(g);
    if (i) stage.append(svg('text', { x: x - 7, y: 81, 'font-size': 10, fill: 'var(--text-3)', text: '›' })); });
  stage.append(svg('text', { x: 150, y: 108, 'font-size': 10.5, fill: 'var(--text-3)', text: 'admission chain (in order), then persist → etcd' }));
  stage.append(comp('etcd', 600, 20, 146, 244, 'etcd (Raft ×3)', ''));
  const keysG = svg('g'); stage.append(keysG);
  stage.append(comp('cm', 140, 150, 210, 70, 'kube-controller-manager', 'Deployment · ReplicaSet ·'), svg('text', { x: 150, y: 202, 'font-size': 10.5, fill: 'var(--text-3)', 'font-family': 'var(--mono)', text: 'EndpointSlice controllers' }));
  stage.append(comp('sched', 370, 150, 210, 70, 'kube-scheduler', 'filter → score → bind'));
  stage.append(comp('kubelet', 20, 312, 160, 62, 'kubelet', 'watch pods on node-1'));
  stage.append(comp('rt', 196, 312, 176, 62, 'containerd → runc', 'CRI · CNI gives pod IP'));
  stage.append(comp('pods', 388, 306, 206, 92, 'Pods', ''));
  stage.append(comp('kp', 610, 312, 132, 62, 'kube-proxy', 'programs rules'));
  const podsG = svg('g'); const rules = svg('text', { class: 'rules', x: 22, y: 440, text: '' }); const rules2 = svg('text', { class: 'rules', x: 22, y: 455, text: '' });
  const pkt = svg('circle', { class: 'pkt', r: 7, cx: 0, cy: 0, opacity: 0 });
  stage.append(podsG, rules, rules2, pkt);

  let S;
  const P = (id) => [C[id].cx, C[id].cy];
  const chipP = (c) => { const i = CH.indexOf(c); return [188 + i * 84, 77]; };
  function fresh() { return { hi: [], err: [], chip: {}, keys: [], pods: [], rules: '', ok: [] }; }
  function draw() {
    Object.keys(C).forEach((id) => C[id].g.setAttribute('class', 'c' + (S.err.includes(id) ? ' err' : S.hi.includes(id) ? ' hot' : S.ok.includes(id) ? ' ok' : '')));
    CH.forEach((c) => chips[c].setAttribute('class', 'achip' + (S.chip[c] ? ' ' + S.chip[c] : '')));
    keysG.innerHTML = '';
    S.keys.forEach((kk, i) => keysG.append(svg('text', { class: 'key ' + (kk.c || ''), x: 608, y: 64 + i * 16, text: kk.t })));
    if (!S.keys.length) keysG.append(svg('text', { class: 'key', x: 608, y: 64, text: '/registry/… (empty)' }));
    podsG.innerHTML = '';
    S.pods.forEach((p, i) => { const x = 396 + i * 66; const g = svg('g', { class: 'pod' });
      const col = p.st === 'Ready' ? 'var(--ok)' : p.st === 'Pending' ? 'var(--warn)' : 'var(--accent)';
      g.append(svg('rect', { x, y: 334, width: 60, height: 54, rx: 7, fill: 'var(--surface)', stroke: col }), svg('text', { x: x + 6, y: 352, 'font-size': 10.5, 'font-family': 'var(--mono)', fill: 'var(--text)', text: p.n }),
        svg('text', { x: x + 6, y: 368, 'font-size': 10, fill: col, text: p.st }), svg('text', { x: x + 6, y: 382, 'font-size': 9.5, 'font-family': 'var(--mono)', fill: 'var(--text-3)', text: p.ip || '' }));
      podsG.append(g); });
    rules.textContent = S.rules ? 'iptables/nftables: KUBE-SVC-web (10.96.12.4:80) →' : ''; rules2.textContent = S.rules || '';
    stats.innerHTML = '';
    const st = (h) => stats.append(el('span', { class: 'w-stat', html: h }));
    st(`objects in etcd <b>${S.keys.length}</b>`); st(`pods running <b>${S.pods.filter((p) => p.st === 'Ready' || p.st === 'Running').length}</b>`);
    st(`direct component-to-component calls <b>0</b>`);
  }
  async function fly(path, err) {
    if (!path || !path.length) return;
    pkt.setAttribute('class', 'pkt' + (err ? ' err' : ''));
    if (reduced) { const [x, y] = path[path.length - 1]; pkt.setAttribute('cx', x); pkt.setAttribute('cy', y); pkt.setAttribute('opacity', 1); return; }
    const g = gen; pkt.setAttribute('opacity', 1);
    let [x0, y0] = path[0]; pkt.setAttribute('cx', x0); pkt.setAttribute('cy', y0);
    for (let i = 1; i < path.length; i++) {
      const [x1, y1] = path[i]; const t0 = performance.now(); const dur = Math.max(260, speed / (2.2 * (path.length - 1)));
      await new Promise((res) => { const f = (t) => { if (g !== gen) return res(); const u = Math.min(1, (t - t0) / dur); const e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        pkt.setAttribute('cx', x0 + (x1 - x0) * e); pkt.setAttribute('cy', y0 + (y1 - y0) * e); if (u < 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
      x0 = x1; y0 = y1;
    }
  }
  const pods = (st, ip) => ['web-a', 'web-b', 'web-c'].map((n, i) => ({ n, st, ip: ip ? `10.1.0.${7 + i}` : '' }));
  function plan() {
    const L = [];
    const add = (o) => L.push(o);
    add({ path: [P('kubectl'), [140, 70]], hi: ['kubectl', 'api'], t: '<code>kubectl apply</code> reads your kubeconfig and sends the Deployment (replicas: 3) to the API server over HTTPS. Client-side apply sends a three-way-merge PATCH; <code>--server-side</code> sends an apply PATCH and the server tracks field owners.' });
    add({ path: [[140, 70], chipP('authn')], hi: ['api'], chip: { authn: 'hot' }, t: '<b>Authentication</b>: who is this? A client certificate, an OIDC token or a ServiceAccount token resolves to a user, say <code>alice</code>, and her groups.' });
    add({ path: [chipP('authn'), chipP('authz')], hi: ['api'], chip: { authn: 'ok', authz: 'hot' }, t: '<b>Authorization</b>: may <code>alice</code> <code>patch</code> <code>deployments</code> in namespace <code>shop</code>? RBAC (plus Node authorizer, webhooks) answers. A “no” is a 403 here.' });
    add({ path: [chipP('authz'), chipP('mutating')], hi: ['api'], chip: { authn: 'ok', authz: 'ok', mutating: 'hot' }, t: '<b>Mutating admission</b>: built-in plugins and webhooks may change the object: fill defaults, inject a sidecar, add labels. They run first so validation sees the final object.' });
    add({ path: [chipP('mutating'), chipP('schema')], hi: ['api'], chip: { authn: 'ok', authz: 'ok', mutating: 'ok', schema: 'hot' }, t: '<b>Schema validation</b>: is it a well-formed <code>apps/v1</code> Deployment? Is the selector matching the template labels? Immutable fields untouched?' });
    if (brk === 'webhook') {
      add({ path: [chipP('schema'), chipP('validating')], err: true, hi: ['api'], chip: { authn: 'ok', authz: 'ok', mutating: 'ok', schema: 'ok', validating: 'err' }, t: '<b>Validating admission</b> calls a webhook whose pods are gone. With <code>failurePolicy: Fail</code> the API server waits <code>timeoutSeconds</code>, then rejects: <code>failed calling webhook … context deadline exceeded</code>.' });
      add({ path: [chipP('validating'), P('kubectl')], err: true, hi: ['kubectl'], errs: ['kubectl'], chip: { authn: 'ok', authz: 'ok', mutating: 'ok', schema: 'ok', validating: 'err' }, t: 'kubectl gets the error. <b>Nothing reached etcd</b>, so nothing downstream ever hears about it. Every matching write in the cluster fails the same way until the webhook is fixed or excluded.' });
      return L;
    }
    add({ path: [chipP('schema'), chipP('validating')], hi: ['api'], chip: { authn: 'ok', authz: 'ok', mutating: 'ok', schema: 'ok', validating: 'hot' }, t: '<b>Validating admission</b>: ResourceQuota, PodSecurity, ValidatingAdmissionPolicy (CEL, GA 1.30) and validating webhooks may only accept or reject. All passed.' });
    if (brk === 'etcd') {
      add({ path: [chipP('validating'), [600, 70]], err: true, hi: ['api'], errs: ['etcd'], chip: { authn: 'ok', authz: 'ok', mutating: 'ok', schema: 'ok', validating: 'ok' }, keys: [{ t: 'no leader: 1 of 3 up', c: 'warn' }], t: 'The API server writes to etcd, but only 1 of 3 members is up. No quorum (needs 2), no leader, no commit. The request fails with <code>etcdserver: request timed out</code>.' });
      add({ path: [[600, 70], P('kubectl')], err: true, errs: ['etcd', 'kubectl'], keys: [{ t: 'no leader: 1 of 3 up', c: 'warn' }], pods: [{ n: 'old-1', st: 'Running', ip: '10.1.0.3' }, { n: 'old-2', st: 'Running', ip: '10.1.0.4' }], t: 'Nothing new can happen. But look at the node: yesterday’s pods are <b>still running and serving</b>. The data plane does not need etcd, it just can’t change or heal until quorum returns.' });
      return L;
    }
    const k1 = [{ t: 'deployments/shop/web', c: 'new' }];
    add({ path: [chipP('validating'), [600, 70]], hi: ['etcd'], chip: { authn: 'ok', authz: 'ok', mutating: 'ok', schema: 'ok', validating: 'ok' }, keys: k1, t: 'Persist: the API server writes the object to <b>etcd</b>. Raft commits it on a quorum (2 of 3) and it gets a new <code>resourceVersion</code>. kubectl prints <code>deployment.apps/web configured</code>. Your command is done; the cluster has barely started.' });
    const k2 = [{ t: 'deployments/shop/web' }, { t: 'replicasets/shop/web-7c9', c: 'new' }];
    add({ path: [[600, 70], [440, 118], P('cm'), [300, 118], [600, 90]], hi: ['cm'], keys: k2, t: 'Every component <b>watches</b> the API server. The <b>Deployment controller</b> gets an event, sees no ReplicaSet for this pod template, and creates <code>web-7c9</code> (hash of the template) with an <code>ownerReference</code> back to the Deployment.' });
    const k3 = k2.map((x) => ({ t: x.t })).concat(['web-a', 'web-b', 'web-c'].map((n) => ({ t: `pods/shop/${n}  node=∅`, c: 'new' })));
    add({ path: [[600, 90], P('cm'), [600, 110]], hi: ['cm'], keys: k3, pods: [], t: 'The <b>ReplicaSet controller</b> sees desired 3, actual 0, and creates 3 Pod objects. They are just records: no node, no IP, phase <code>Pending</code>.' });
    if (brk === 'sched') {
      add({ path: [[600, 110], P('sched')], err: true, errs: ['sched'], keys: k3.map((x) => ({ t: x.t, c: x.t.includes('∅') ? 'warn' : '' })), t: 'The scheduler should pick these up, but it is crash-looping. Nobody writes <code>nodeName</code>, so the kubelet on node-1 never sees them.' });
      add({ path: [], errs: ['sched'], keys: k3.map((x) => ({ t: x.t, c: x.t.includes('∅') ? 'warn' : '' })), t: 'The pods stay <b>Pending forever</b>, and <code>kubectl describe pod</code> shows <b>no events at all</b>: not even FailedScheduling, because nobody tried. That silence is the tell for a missing scheduler.' });
      return L;
    }
    const k4 = k2.map((x) => ({ t: x.t })).concat(['web-a', 'web-b', 'web-c'].map((n) => ({ t: `pods/shop/${n}  node=node-1`, c: 'new' })));
    add({ path: [[600, 110], P('sched'), [600, 130]], hi: ['sched'], keys: k4, t: 'The <b>scheduler</b> watches pods with empty <code>nodeName</code>. It filters nodes by free <b>requests</b>, taints and affinity, scores the rest, and writes a <b>Binding</b> (here all three land on node-1, to keep the picture small).' });
    add({ path: [[600, 130], [400, 280], P('kubelet')], hi: ['kubelet'], keys: k4.map((x) => ({ t: x.t })), pods: pods('Pending'), t: 'The <b>kubelet</b> on node-1 watches pods with <code>nodeName=node-1</code>. Three new ones arrive. It admits them locally (enough resources?) and starts work.' });
    add({ path: [P('kubelet'), P('rt'), P('pods')], hi: ['rt', 'pods'], keys: k4.map((x) => ({ t: x.t })), pods: pods('Starting', true), t: 'Over <b>CRI</b> the kubelet asks containerd for a pod sandbox (network namespace; the <b>CNI</b> plugin assigns the IP), pulls the image, then creates and starts init containers, sidecars and the app container via runc.' });
    const k5 = k4.map((x) => ({ t: x.t })).concat([{ t: 'pods/…/status Ready', c: 'new' }]);
    add({ path: [P('pods'), P('kubelet'), [400, 280], [600, 150]], hi: ['kubelet'], ok: ['pods'], keys: k5, pods: pods('Ready', true), t: 'The kubelet runs the probes. When readiness passes it patches each pod’s <b>status</b>: <code>Running</code>, condition <code>Ready=True</code>, <code>podIP</code>. Status is written by the kubelet, not by the controllers.' });
    const k6 = k5.map((x) => ({ t: x.t })).concat([{ t: 'endpointslices/shop/web-x7', c: 'new' }]);
    add({ path: [[600, 150], P('cm'), [600, 170]], hi: ['cm'], ok: ['pods'], keys: k6, pods: pods('Ready', true), t: 'The <b>EndpointSlice controller</b> watches Services and pods. Service <code>web</code> selects these pods, and they are Ready, so it writes their IPs into an EndpointSlice.' });
    add({ path: [[600, 170], [700, 290], P('kp')], hi: ['kp'], ok: ['pods'], keys: k6.map((x) => ({ t: x.t })), pods: pods('Ready', true), rules: '10.1.0.7:8080 | 10.1.0.8:8080 | 10.1.0.9:8080', t: '<b>kube-proxy</b> on <i>every</i> node watches EndpointSlices and rewrites kernel rules: ClusterIP 10.96.12.4 → one of the three pod IPs. kube-proxy only programs; the kernel forwards the packets.' });
    add({ path: [], ok: ['pods', 'kp', 'kubelet', 'cm', 'sched', 'etcd', 'api'], keys: k6.map((x) => ({ t: x.t })), pods: pods('Ready', true), rules: '10.1.0.7:8080 | 10.1.0.8:8080 | 10.1.0.9:8080', t: 'Done. Count the arrows: <b>every hop went through the API server</b>. No component called another directly. Each one watched for objects in a certain state, did one job and wrote the result back. That is why any one can restart without losing work.' });
    return L;
  }
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; S = fresh(); steps = plan(); pkt.setAttribute('opacity', 0); draw(); bStep.disabled = false;
    say(brk === 'none' ? 'Press Play or Step to follow the request. Then pick a failure above and play it again.' : 'Failure armed. Press Play to see where the chain stops.'); }
  async function step() {
    if (k >= steps.length) return false; const s = steps[k++]; const g = gen;
    say(`<b>${k}/${steps.length}</b> · ` + s.t);
    S.hi = s.hi || []; S.err = s.errs || []; S.ok = s.ok || []; S.chip = s.chip || {}; if (s.keys) S.keys = s.keys; if (s.pods) S.pods = s.pods; S.rules = s.rules || '';
    draw(); await fly(s.path, s.err); if (g !== gen) return false;
    if (k >= steps.length) bStep.disabled = true; return true;
  }
  let stepping = false;
  bStep.addEventListener('click', async () => { running = false; bPlay.textContent = '▶ Play'; if (stepping) return; stepping = true; await step(); stepping = false; });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    if (reduced) { while (k < steps.length) await step(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && await step()) await sleep(speed * 0.6);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

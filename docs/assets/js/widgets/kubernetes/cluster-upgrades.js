/* Upgrades & cluster ops: step through a control-plane-first upgrade, checking the version-skew rules after every step (HA API servers ±1, controllers ≤ API and ≥ API−1, kubelets ≤ API and ≥ API−3, kubectl ±1). */
IA.widget('cluster-upgrades', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8up-style')) {
    document.head.append(el('style', { id: 'w-k8up-style', text: `
.k8up svg text { font-family: var(--sans); }
.k8up .bx { fill: var(--surface); stroke: var(--border); stroke-width: 1.4; transition: all .3s; }
.k8up .bx.new { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2.2; }
.k8up .bx.hot { stroke: var(--accent-2); stroke-width: 3; }
.k8up .bx.bad { stroke: var(--err); stroke-width: 3; fill: color-mix(in srgb, var(--err) 12%, var(--surface)); }
.k8up .bx.drain { stroke: var(--warn); stroke-width: 2.6; stroke-dasharray: 5 4; }
.k8up .bx.snap { stroke: var(--ok); stroke-width: 2.6; fill: color-mix(in srgb, var(--ok) 12%, var(--surface)); }
.k8up .bn { font-size: 10.5px; fill: var(--text-2); font-family: var(--mono); }
.k8up .bv { font-size: 14px; font-weight: 800; fill: var(--text); font-family: var(--mono); }
.k8up .rl { font-size: 11px; font-weight: 700; fill: var(--text-3); letter-spacing: .04em; }
.k8up .pn { fill: var(--surface-2); stroke: var(--border); }
.k8up .ck { font-size: 11.5px; font-family: var(--mono); fill: var(--text); }
.k8up .ck.ok { fill: var(--ok); } .k8up .ck.bad { fill: var(--err); font-weight: 700; }
` }));
  }
  const V = (m) => '1.' + m;
  const base = (cp, a, b, kc) => ({ api: [cp, cp, cp], cm: cp, sch: cp, A: [a, a, a], B: [b, b, b], kc: kc == null ? cp : kc });
  const mod = (s, f) => { const n = JSON.parse(JSON.stringify(s)); f(n); return n; };
  function scenarios() {
    const s0 = base(31, 31, 31);
    const safe = [
      { v: s0, say: 'All components on <b>1.31</b>; target <b>1.32</b>. Pre-flight: read the 1.32 changelog, look for APIs removed in 1.32 (here <code>flowcontrol.apiserver.k8s.io/v1beta3</code>) in your manifests, charts and the <code>apiserver_requested_deprecated_apis</code> metric, check add-on compatibility (CNI, CSI, ingress, operators), and that PDBs allow disruptions.' },
      { v: s0, snap: true, say: '<b>Back up etcd</b> (<code>etcdctl snapshot save</code>) and record the etcd version. A control-plane upgrade can migrate stored data; the snapshot is your only way back. Managed services do this for you, but you still own backups of your workloads’ state.' },
      { v: mod(s0, (n) => { n.api[0] = 32; }), hot: ['api0'], say: 'Upgrade the <b>API servers first</b>, one at a time. During this step 1.31 and 1.32 API servers serve together, which the skew policy allows (within one minor).' },
      { v: mod(s0, (n) => { n.api = [32, 32, 32]; }), hot: ['api1', 'api2'], say: 'All API servers on 1.32. Controller manager and scheduler are still on 1.31: allowed, because they may be one minor <i>older</i> than the API server, never newer.' },
      { v: mod(s0, (n) => { n.api = [32, 32, 32]; n.cm = 32; n.sch = 32; }), hot: ['cm', 'sch'], say: 'Then the <b>controller manager, scheduler</b> (and cloud controller manager). The control plane is done. kubectl 1.31 is fine: kubectl may differ by one minor in either direction.' },
      { v: mod(s0, (n) => { n.api = [32, 32, 32]; n.cm = 32; n.sch = 32; n.A[0] = 32; }), drain: ['A0'], say: '<b>Nodes</b>, one at a time (or by surge): cordon, drain (PDBs pace the evictions), upgrade the kubelet or replace the node with a new image, uncordon. Many managed services add a fresh node and remove the old one instead of upgrading in place.' },
      { v: mod(s0, (n) => { n.api = [32, 32, 32]; n.cm = 32; n.sch = 32; n.A = [32, 32, 32]; }), hot: ['A1', 'A2'], say: 'Pool A done. Pool B still runs 1.31 kubelets, which is fine: kubelets may be up to <b>three</b> minors older than the API server (since 1.28; it was two before). That gives you time, but not forever.' },
      { v: mod(s0, (n) => { n.api = [32, 32, 32]; n.cm = 32; n.sch = 32; n.A = [32, 32, 32]; n.B = [32, 32, 32]; n.kc = 32; }), hot: ['B0', 'B1', 'B2'], done: true, say: 'Everything on 1.32. Post-flight: watch error rates and Pod restarts, confirm add-ons are healthy, then plan the next minor. Kubernetes supports roughly the last three minor releases, about a year of patches each, so staying current is a recurring job.', tone: 'ok' }
    ];
    const l0 = base(31, 28, 31);
    const lag = [
      { v: l0, say: 'Control plane on <b>1.31</b>. Pool A was forgotten on <b>1.28</b> kubelets; pool B is on 1.31. 1.28 is three minors behind the API server: the oldest kubelet the skew policy allows.' },
      { v: mod(l0, (n) => { n.api = [32, 32, 32]; }), bad: ['A0', 'A1', 'A2'], say: 'Upgrade the API servers to 1.32 now and pool A becomes <b>four</b> minors older: <b>outside the supported skew</b>. Old kubelets may not understand fields or API behaviour the new control plane relies on. Managed services usually block this upgrade.', tone: 'err' },
      { v: l0, say: 'Roll back the plan, not the cluster: the rule is that the control plane can only move up when <i>every</i> node is within three minors of the new version.' },
      { v: mod(l0, (n) => { n.A = [31, 31, 31]; }), hot: ['A0', 'A1', 'A2'], say: 'Bring pool A forward first. kubeadm upgrades a node one minor at a time (1.28 → 1.29 → 1.30 → 1.31); with managed node pools or immutable node images you usually replace the nodes with new ones at the control plane’s version.' },
      { v: mod(l0, (n) => { n.A = [31, 31, 31]; n.api = [32, 32, 32]; n.cm = 32; n.sch = 32; }), hot: ['api0', 'api1', 'api2', 'cm', 'sch'], say: 'Now the control plane can go to 1.32: every kubelet is at most one minor behind.' },
      { v: mod(l0, (n) => { n.A = [32, 32, 32]; n.B = [32, 32, 32]; n.api = [32, 32, 32]; n.cm = 32; n.sch = 32; n.kc = 32; }), done: true, say: 'And the nodes follow. Keep node pools on auto-upgrade or a regular schedule, and alert when any kubelet lags the control plane by two or more minors.', tone: 'ok' }
    ];
    const k0 = base(31, 31, 31);
    const skip = [
      { v: k0, say: 'All on <b>1.31</b>, and the goal is <b>1.33</b>. Tempting: upgrade the control plane straight to 1.33 to save a maintenance window.' },
      { v: mod(k0, (n) => { n.api[0] = 33; }), bad: ['api0'], jump: true, say: '<b>Not supported.</b> Control-plane upgrades go one minor at a time: 1.31 and 1.33 API servers would differ by two, and each release’s storage migrations, feature-gate graduations and API removals assume the previous minor ran first.', tone: 'err' },
      { v: mod(k0, (n) => { n.api = [32, 32, 32]; n.cm = 32; n.sch = 32; n.kc = 32; }), hot: ['api0', 'api1', 'api2', 'cm', 'sch', 'kc'], say: 'Step one: control plane to 1.32 (and your kubectl, which must stay within one minor). Nodes can stay on 1.31 for now.' },
      { v: mod(k0, (n) => { n.api = [33, 33, 33]; n.cm = 33; n.sch = 33; n.kc = 33; }), hot: ['api0', 'api1', 'api2', 'cm', 'sch', 'kc'], say: 'Step two: control plane to 1.33, after checking 1.33’s removals too. Nodes on 1.31 are two minors behind: still within skew. This is how the n−3 kubelet rule lets you upgrade the control plane twice and the nodes once.' },
      { v: mod(k0, (n) => { n.api = [33, 33, 33]; n.cm = 33; n.sch = 33; n.A = [33, 33, 33]; n.B = [33, 33, 33]; n.kc = 33; }), done: true, say: 'Nodes replaced directly with 1.33 images (where your platform supports that; with kubeadm, upgrade in-place nodes one minor at a time). Fewer node rotations means fewer drains, which matters for stateful workloads.', tone: 'ok' }
    ];
    return { safe: { l: 'Safe upgrade 1.31 → 1.32', steps: safe }, lag: { l: 'Lagging node pool', steps: lag }, skip: { l: 'Skip a minor?', steps: skip } };
  }
  const SC = scenarios();
  function checks(v, jump) {
    const lo = Math.min(...v.api); const hi = Math.max(...v.api); const nodes = [...v.A, ...v.B];
    const r = [];
    r.push([hi - lo <= 1 && !jump, `API servers within 1 minor of each other (${V(lo)}…${V(hi)})`]);
    r.push([v.cm <= lo && v.cm >= hi - 1 && v.sch <= lo && v.sch >= hi - 1, `controller-manager/scheduler ≤ API and ≥ API−1 (${V(v.cm)}, ${V(v.sch)})`]);
    const nMin = Math.min(...nodes); const nMax = Math.max(...nodes);
    r.push([nMax <= lo, `kubelets not newer than the API server (newest ${V(nMax)})`]);
    r.push([nMin >= hi - 3, `kubelets at most 3 minors older (oldest ${V(nMin)}, API ${V(hi)})`]);
    r.push([v.api.every((a) => Math.abs(a - v.kc) <= 1), `kubectl ${V(v.kc)} within ±1 of every API server`]);
    if (jump) r.push([false, 'control plane moved more than one minor at once']);
    return r;
  }
  let mode = 'safe'; let k = 0; let gen = 0; let running = false; let speed = 3000;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const W = 760; const H = 336;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Cluster components with their versions and the version-skew checks' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('k8up');
  root.append(el('div', { class: 'w-controls' }, seg(Object.entries(SC).map(([v, s]) => [v, s.l]), mode, (v) => { mode = v; reset(); }, 'Scenario')),
    el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg([[4200, 'Slow'], [3000, 'Normal'], [1500, 'Fast']], speed, (v) => { speed = v; }, 'Speed')), narr);
  const say = (h, tone) => { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function draw(s) {
    stage.innerHTML = '';
    const v = s.v; const first = SC[mode].steps[0].v; const maxNow = Math.max(...v.api);
    const box = (id, x, y, w, name, ver, was) => {
      let cls = 'bx';
      if (s.bad && s.bad.includes(id)) cls += ' bad';
      else if (s.drain && s.drain.includes(id)) cls += ' drain';
      else if (ver > was) cls += ' new';
      if (s.hot && s.hot.includes(id)) cls += ' hot';
      stage.append(svg('rect', { class: cls, x, y, width: w, height: 46, rx: 8 }), svg('text', { class: 'bn', x: x + w / 2, y: y + 16, 'text-anchor': 'middle', text: name }),
        svg('text', { class: 'bv', x: x + w / 2, y: y + 36, 'text-anchor': 'middle', text: V(ver) }));
    };
    stage.append(svg('text', { class: 'rl', x: 10, y: 18, text: 'CONTROL PLANE' }));
    v.api.forEach((a, i) => box('api' + i, 10 + i * 92, 26, 84, 'apiserver-' + (i + 1), a, first.api[i]));
    box('cm', 290, 26, 104, 'controller-mgr', v.cm, first.cm);
    box('sch', 402, 26, 84, 'scheduler', v.sch, first.sch);
    const ex = 500; const ecls = 'bx' + (s.snap ? ' snap' : '');
    stage.append(svg('rect', { class: ecls, x: ex, y: 26, width: 250, height: 46, rx: 8 }), svg('text', { class: 'bn', x: ex + 125, y: 42, 'text-anchor': 'middle', text: 'etcd (versioned separately)' }),
      svg('text', { class: 'bn', x: ex + 125, y: 62, 'text-anchor': 'middle', fill: s.snap ? 'var(--ok)' : 'var(--text-2)', text: s.snap ? '✓ snapshot saved: snapshot-pre-1.32.db' : 'back up before every upgrade' }));
    stage.append(svg('text', { class: 'rl', x: 10, y: 98, text: 'NODE POOL A (kubelet, kube-proxy)' }), svg('text', { class: 'rl', x: 390, y: 98, text: 'NODE POOL B' }));
    v.A.forEach((a, i) => box('A' + i, 10 + i * 124, 106, 116, 'node-a' + (i + 1), a, first.A[i]));
    v.B.forEach((a, i) => box('B' + i, 390 + i * 124, 106, 116, 'node-b' + (i + 1), a, first.B[i]));
    stage.append(svg('text', { class: 'rl', x: 10, y: 178, text: 'CLIENT' }));
    box('kc', 10, 186, 116, 'kubectl', v.kc, first.kc);
    const cs = checks(v, s.jump);
    stage.append(svg('rect', { class: 'pn', x: 150, y: 170, width: 600, height: 160, rx: 9 }), svg('text', { class: 'rl', x: 164, y: 190, text: `VERSION-SKEW CHECKS (API server ${V(maxNow)})` }));
    cs.forEach(([ok, t], i) => stage.append(svg('text', { class: 'ck ' + (ok ? 'ok' : 'bad'), x: 164, y: 214 + i * 19, text: (ok ? '✓ ' : '✗ ') + t })));
  }
  const steps = () => SC[mode].steps;
  function show(s) { draw(s); say(s.say, s.tone); }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; bStep.disabled = false; show(steps()[k++]); }
  function step() { if (k >= steps().length) return false; show(steps()[k++]); if (k >= steps().length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps().length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    if (reduced) { while (g === gen && step()); } else while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

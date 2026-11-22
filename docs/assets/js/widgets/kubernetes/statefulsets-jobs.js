/* StatefulSet, DaemonSet, Job, CronJob: ordered identity and PVCs, one-pod-per-node, retry back-off, and CronJob concurrency policies. */
IA.widget('statefulsets-jobs', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8sj-style')) {
    document.head.append(el('style', { id: 'w-k8sj-style', text: `
.k8sj svg text { font-family: var(--sans); }
.k8sj .bx { fill: var(--surface-2); stroke: var(--border); stroke-width: 1.4; transition: fill .35s, stroke .35s, opacity .35s; }
.k8sj .bx.ready { fill: color-mix(in srgb, var(--ok) 16%, var(--surface)); stroke: var(--ok); }
.k8sj .bx.start { fill: var(--surface); stroke: var(--warn); stroke-dasharray: 5 3; }
.k8sj .bx.term { fill: var(--surface); stroke: var(--k-external); opacity: .5; }
.k8sj .bx.none { fill: none; stroke: var(--border); stroke-dasharray: 3 4; }
.k8sj .bx.v2 { stroke-width: 2.4; }
.k8sj .pvc { fill: color-mix(in srgb, var(--k-store) 14%, var(--surface)); stroke: var(--k-store); }
.k8sj .pvc.ret { stroke-dasharray: 4 3; opacity: .7; }
.k8sj .t1 { fill: var(--text); font-size: 12.5px; font-weight: 700; font-family: var(--mono); }
.k8sj .t2 { fill: var(--text-2); font-size: 11px; font-family: var(--mono); }
.k8sj .t3 { fill: var(--text-3); font-size: 10.5px; }
.k8sj .lnk { stroke: var(--k-store); stroke-width: 1.5; }
.k8sj .run { fill: var(--accent); opacity: .85; }
.k8sj .fail { fill: var(--err); opacity: .85; }
.k8sj .okb { fill: var(--ok); opacity: .85; }
.k8sj .killed { fill: var(--err); opacity: .55; }
.k8sj .bo { fill: none; stroke: var(--warn); stroke-width: 2; stroke-dasharray: 4 3; }
.k8sj .tick { stroke: var(--text-3); stroke-dasharray: 2 3; }
.k8sj .cur { stroke: var(--accent); stroke-width: 2; }
.k8sj .ax { fill: var(--text-3); font-size: 10px; font-family: var(--mono); }
.k8sj .skip { fill: var(--err); font-size: 13px; font-weight: 800; }
.k8sj .taint { fill: var(--warn); font-size: 10.5px; font-family: var(--mono); }
` }));
  }
  let mode = 'sts'; let part = 0; let pol = 'Allow'; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = []; let S;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['sts', 'StatefulSet'], ['ds', 'DaemonSet'], ['job', 'Job'], ['cron', 'CronJob']], () => mode, (v) => { mode = v; opt(); reset(); }, 'Controller');
  const segP = seg([[0, 'partition 0'], [2, 'partition 2']], () => part, (v) => { part = v; reset(); }, 'Partition');
  const segC = seg([['Allow', 'Allow'], ['Forbid', 'Forbid'], ['Replace', 'Replace']], () => pol, (v) => { pol = v; reset(); }, 'concurrencyPolicy');
  const optRow = el('div', { class: 'w-controls' });
  function opt() { optRow.innerHTML = ''; if (mode === 'sts') optRow.append(el('span', { class: 'tiny', text: 'rolling update' }), segP); if (mode === 'cron') optRow.append(el('span', { class: 'tiny', text: 'concurrencyPolicy' }), segC); }
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1200, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const stage = svg('svg', { viewBox: '0 0 760 270', role: 'img', 'aria-label': 'Workload controller state' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('k8sj');
  root.append(el('div', { class: 'w-controls' }, segM), optRow, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  opt();
  const T = (x, y, c, t) => svg('text', { class: c, x, y, text: t });
  const st = (h) => stats.append(el('span', { class: 'w-stat', html: h }));

  /* ---------- StatefulSet ---------- */
  function stsPlan() {
    const P = () => S.pods; const ip = () => '10.1.' + (2 + Math.floor(Math.random() * 3)) + '.' + (10 + Math.floor(Math.random() * 80));
    const L = [];
    const set = (i, o) => { S.pods[i] = Object.assign(S.pods[i] || {}, o); };
    L.push({ run: () => { set(0, { st: 'start', rev: 'v1', ip: ip() }); S.pvc[0] = 'bound'; }, t: '<code>kubectl apply</code> a StatefulSet <code>web</code>, replicas 3. Only <b>web-0</b> is created, with PVC <code>data-web-0</code> from the volumeClaimTemplate.' });
    L.push({ run: () => { set(0, { st: 'ready' }); set(1, { st: 'start', rev: 'v1', ip: ip() }); S.pvc[1] = 'bound'; }, t: 'web-0 is Running and Ready, so <b>web-1</b> is created (OrderedReady). A replica that joins a cluster can rely on web-0 already being up.' });
    L.push({ run: () => { set(1, { st: 'ready' }); set(2, { st: 'start', rev: 'v1', ip: ip() }); S.pvc[2] = 'bound'; }, t: 'web-1 Ready → <b>web-2</b> created.' });
    L.push({ run: () => { set(2, { st: 'ready' }); S.dns = true; }, t: 'All three Ready. The headless Service gives each a stable DNS name: <code>web-0.web.shop.svc.cluster.local</code> and so on.' });
    L.push({ run: () => { set(1, { st: 'term' }); }, t: '<code>kubectl delete pod web-1</code> (or its node dies).' });
    L.push({ run: () => { set(1, { st: 'start', ip: ip() }); }, t: 'It comes back as <b>web-1</b>, not a random name, and mounts the <b>same</b> <code>data-web-1</code>. The IP changed; the DNS name did not. That is why peers must use DNS.' });
    L.push({ run: () => { set(1, { st: 'ready' }); }, t: 'web-1 Ready again, with its data intact.' });
    L.push({ run: () => { S.target = 'v2'; set(2, { st: 'term' }); }, t: `Change the image to v2. Rolling updates go from the <b>highest ordinal</b> down: web-2 is terminated first.${part ? ' With <code>partition: 2</code> only ordinals ≥ 2 may be updated.' : ''}` });
    L.push({ run: () => { set(2, { st: 'start', rev: 'v2', ip: ip() }); }, t: 'web-2 is recreated on v2, same PVC. The controller now waits for it to be Ready before going on. A v2 that never becomes Ready stops the rollout right here.' });
    L.push({ run: () => { set(2, { st: 'ready' }); }, t: 'web-2 (v2) is Ready.' });
    if (!part) {
      L.push({ run: () => { set(1, { st: 'start', rev: 'v2', ip: ip() }); }, t: 'Next: web-1 is replaced on v2 and must become Ready…' });
      L.push({ run: () => { set(1, { st: 'ready' }); set(0, { st: 'start', rev: 'v2', ip: ip() }); }, t: '…then web-0, last. Ordinal 0 is often the bootstrap or primary node, so it is updated last.' });
      L.push({ run: () => { set(0, { st: 'ready' }); }, t: 'Rollout complete: all on v2.' });
    } else L.push({ run: () => {}, t: 'Stop. web-0 and web-1 stay on <b>v1</b> because their ordinals are below the partition. That is a canary: watch web-2, then lower the partition to 1, then 0.' });
    L.push({ run: () => { set(2, { st: 'term' }); }, t: '<code>kubectl scale sts web --replicas=1</code>: removal is in <b>reverse</b> order, one at a time. web-2 goes first.' });
    L.push({ run: () => { set(2, { st: 'none' }); S.pvc[2] = 'ret'; set(1, { st: 'term' }); }, t: 'web-2 is gone, but <b>data-web-2 is retained</b> (default <code>whenScaled: Retain</code>). Then web-1 terminates.' });
    L.push({ run: () => { set(1, { st: 'none' }); S.pvc[1] = 'ret'; }, t: 'One pod left. Two PVCs with data and no pod: safe, but they cost money and hold stale data.' });
    L.push({ run: () => { set(1, { st: 'start', ip: ip(), rev: S.target === 'v2' && !part ? 'v2' : 'v1' }); S.pvc[1] = 'bound'; }, t: 'Scale back to 3: web-1 is created and <b>reattaches data-web-1</b>, with whatever data it had when it left. Great for a database replica; surprising if you expected a clean disk.' });
    return L;
  }
  function stsDraw() {
    stage.setAttribute('viewBox', '0 0 760 270'); stage.innerHTML = '';
    for (let i = 0; i < 3; i++) { const x = 30 + i * 244; const p = S.pods[i] || { st: 'none' }; const cls = 'bx ' + p.st + (p.rev === 'v2' && p.st !== 'none' ? ' v2' : '');
      stage.append(svg('rect', { class: cls, x, y: 24, width: 210, height: 86, rx: 10 }), T(x + 12, 46, 't1', `web-${i}`));
      if (p.st !== 'none') stage.append(T(x + 12, 66, 't2', `${p.rev} · ${p.st === 'ready' ? 'Ready' : p.st === 'start' ? 'starting' : 'terminating'}`), T(x + 12, 86, 't2', `IP ${p.ip}`));
      else stage.append(T(x + 12, 70, 't3', 'no pod'));
      if (S.pvc[i]) { stage.append(svg('line', { class: 'lnk', x1: x + 105, y1: 110, x2: x + 105, y2: 140 }), svg('rect', { class: 'pvc' + (S.pvc[i] === 'ret' ? ' ret' : ''), x, y: 140, width: 210, height: 44, rx: 8 }),
        T(x + 12, 160, 't2', `PVC data-web-${i}`), T(x + 12, 176, 't3', S.pvc[i] === 'ret' ? 'Bound to its PV, no pod: retained' : 'Bound · ReadWriteOnce · 20Gi')); }
      if (S.dns && p.st !== 'none') stage.append(T(x, 212, 't3', `web-${i}.web.shop.svc.cluster.local`)); }
    stage.append(T(30, 250, 't3', `headless Service “web” (clusterIP: None) · podManagementPolicy: OrderedReady · partition: ${part}`));
    stats.innerHTML = ''; st(`ready <b>${S.pods.filter((p) => p && p.st === 'ready').length}</b>`); st(`PVCs <b>${S.pvc.filter(Boolean).length}</b>`); st(`update target <b>${S.target}</b>`);
  }
  /* ---------- DaemonSet ---------- */
  function dsPlan() {
    const L = []; const N = (i, o) => Object.assign(S.nodes[i], o);
    L.push({ run: () => { [0, 1, 2].forEach((i) => N(i, { pod: 'ready' })); }, t: 'DaemonSet <code>log-agent</code> on a 3-node cluster: one pod per node. The controller pins each pod to its node with node affinity; the default scheduler binds it.' });
    L.push({ run: () => { N(3, { exists: true, pod: 'start' }); }, t: '<b>node-4 joins</b>. Nobody scales anything: the DaemonSet controller sees a new eligible node and creates a pod for it.' });
    L.push({ run: () => { N(3, { pod: 'ready' }); N(1, { taint: 'gpu=true:NoSchedule' }); }, t: 'node-2 gets a <code>NoSchedule</code> taint. The running agent <b>stays</b>: NoSchedule only blocks new pods. A new node with this taint would get no agent unless the DaemonSet tolerates it.' });
    L.push({ run: () => { N(2, { cordon: true }); }, t: '<code>kubectl drain node-3 --ignore-daemonsets</code>: app pods are evicted, but the agent keeps running. DaemonSet pods tolerate <code>unschedulable</code>, so evicting them would be pointless.' });
    L.push({ run: () => { S.rev = 'v2'; N(0, { pod: 'none' }); }, t: 'Update the image (RollingUpdate, <code>maxUnavailable: 1</code>, the default). node-1’s agent is deleted <b>first</b>, so node-1 has no log agent for a moment. With <code>maxSurge: 1</code> the new pod would start before the old one stops.' });
    L.push({ run: () => { N(0, { pod: 'ready', v2: true }); N(1, { pod: 'start', v2: true }); }, t: 'node-1 now runs v2 and is Ready; node-2 is next. One node at a time across the whole cluster: large clusters roll slowly unless you raise maxUnavailable (e.g. 10%).' });
    L.push({ run: () => { [1, 2, 3].forEach((i) => N(i, { pod: 'ready', v2: true })); }, t: 'All nodes on v2, including the tainted and the cordoned node. Classic DaemonSets: CNI agents, kube-proxy, log shippers, node exporters, CSI node plugins.' });
    return L;
  }
  function dsDraw() {
    stage.setAttribute('viewBox', '0 0 760 220'); stage.innerHTML = '';
    S.nodes.forEach((n, i) => { const x = 14 + i * 186; if (!n.exists) { stage.append(svg('rect', { class: 'bx none', x, y: 20, width: 170, height: 150, rx: 12 }), T(x + 12, 44, 't3', `node-${i + 1} (not yet)`)); return; }
      stage.append(svg('rect', { class: 'bx', x, y: 20, width: 170, height: 150, rx: 12 }), T(x + 12, 42, 't1', `node-${i + 1}`));
      if (n.taint) stage.append(T(x + 12, 60, 'taint', n.taint)); if (n.cordon) stage.append(T(x + 12, n.taint ? 74 : 60, 'taint', 'cordoned · drained'));
      stage.append(svg('rect', { class: 'bx ' + (n.pod || 'none'), x: x + 14, y: 86, width: 142, height: 50, rx: 8 }));
      if (n.pod && n.pod !== 'none') stage.append(T(x + 24, 106, 't2', 'log-agent'), T(x + 24, 124, 't3', (n.v2 ? 'v2' : 'v1') + ' · ' + (n.pod === 'ready' ? 'Ready' : 'starting')));
      else stage.append(T(x + 24, 114, 't3', 'no agent')); });
    stage.append(T(14, 200, 't3', 'kubectl get ds log-agent → DESIRED = CURRENT = number of eligible nodes'));
    stats.innerHTML = ''; const nodes = S.nodes.filter((n) => n.exists); st(`desired <b>${nodes.length}</b>`); st(`ready <b>${nodes.filter((n) => n.pod === 'ready').length}</b>`); st(`updated <b>${nodes.filter((n) => n.v2).length}</b>`);
  }
  /* ---------- Job ---------- */
  function jobPlan() {
    const L = []; const A = (o) => S.att.push(o);
    L.push({ now: 20, run: () => { A({ a: 0, b: 20, s: 'fail' }); }, t: 'Job <code>import</code>, <code>backoffLimit: 3</code>, <code>restartPolicy: Never</code>. Pod 1 runs and exits 1 (the input file is missing).' });
    L.push({ now: 30, run: () => { S.bo.push([20, 30]); }, t: 'The Job controller waits <b>10 s</b> before creating a new pod.' });
    L.push({ now: 50, run: () => { A({ a: 30, b: 50, s: 'fail' }); }, t: 'Pod 2: a <b>new pod</b> (Never), so the old pod and its logs remain for inspection. It fails too. Failures: 2.' });
    L.push({ now: 70, run: () => { S.bo.push([50, 70]); }, t: 'Back-off doubles: <b>20 s</b>.' });
    L.push({ now: 90, run: () => { A({ a: 70, b: 90, s: 'fail' }); }, t: 'Pod 3 fails. Failures: 3 = backoffLimit; one more retry is allowed.' });
    L.push({ now: 130, run: () => { S.bo.push([90, 130]); }, t: 'Back-off <b>40 s</b>. It keeps doubling up to a 6-minute cap, so a high backoffLimit can mean an hour of retrying.' });
    L.push({ now: 150, run: () => { A({ a: 130, b: 150, s: 'fail' }); S.failed = true; }, t: 'Pod 4 fails. Failures (4) exceed backoffLimit (3): condition <b>Failed</b>, reason <code>BackoffLimitExceeded</code>. A <code>podFailurePolicy</code> with <code>FailJob</code> on this exit code would have stopped after pod 1.' });
    return L;
  }
  function jobDraw() {
    stage.setAttribute('viewBox', '0 0 760 250'); stage.innerHTML = ''; const X = (t) => 120 + t / 160 * 620;
    for (let i = 0; i < 4; i++) stage.append(T(14, 44 + i * 40, 't2', `pod ${i + 1}`), svg('rect', { class: 'bx', x: 120, y: 28 + i * 40, width: 620, height: 24, rx: 5 }));
    S.att.forEach((a, i) => stage.append(svg('rect', { class: a.s, x: X(a.a), y: 31 + i * 40, width: X(a.b) - X(a.a), height: 18, rx: 4 }), T(X(a.b) + 4, 44 + i * 40, 't2', 'exit 1')));
    S.bo.forEach(([a, b], i) => stage.append(svg('rect', { class: 'bo', x: X(a), y: 31 + (i + 1) * 40, width: X(b) - X(a), height: 18, rx: 4 }), T(X(a) + 4, 26 + (i + 1) * 40, 'taint', `back-off ${b - a}s`)));
    for (let t = 0; t <= 160; t += 20) stage.append(T(X(t) - 8, 200, 'ax', t + 's'));
    stage.append(svg('line', { class: 'cur', x1: X(S.now), x2: X(S.now), y1: 20, y2: 188 }));
    if (S.failed) stage.append(T(120, 230, 'skip', 'Job Failed: BackoffLimitExceeded'));
    stats.innerHTML = ''; st(`pods created <b>${S.att.length}</b>`); st(`failed <b>${S.att.length}</b> / backoffLimit 3`); st(`status <b>${S.failed ? 'Failed' : 'Active'}</b>`);
  }
  /* ---------- CronJob ---------- */
  function cronPlan() {
    const L = []; const D = 90;
    [0, 60, 120, 180, 240, 300].forEach((t) => {
      L.push({ now: t, run: () => {
        S.runs.forEach((r) => { if (!r.killed && r.a + D <= t) r.done = true; });
        if (t === 300) return;
        const active = S.runs.filter((r) => !r.done && !r.killed && r.a + D > t);
        if (!active.length || pol === 'Allow') { S.runs.push({ a: t, lane: active.some((r) => r.lane === 0) ? 1 : 0 }); return; }
        if (pol === 'Forbid') { S.skips.push(t); return; }
        active.forEach((r) => { r.killed = t; }); S.runs.push({ a: t, lane: 0 });
      }, t: (() => { if (t === 300) return pol === 'Allow' ? 'Five minutes: five runs started, two always overlapping. Fine for independent work; dangerous for anything that touches the same rows twice.' : pol === 'Forbid' ? 'Five minutes: three runs, two ticks skipped. Each run sees the previous one finished; the effective interval stretched to 2 minutes.' : 'Five minutes: five runs started, <b>none finished</b>. Replace only suits jobs shorter than their interval, where only the latest run matters.';
        if (t === 0) return `CronJob <code>* * * * *</code> (every minute), each run takes <b>90 s</b>, concurrencyPolicy <b>${pol}</b>. 00:00: first Job created.`;
        return pol === 'Allow' ? `00:${String(t / 60).padStart(2, '0')}:00: the previous run is still active, but Allow starts another one anyway. Two copies now run at once.`
          : pol === 'Forbid' ? `00:0${t / 60}:00: ` + (t % 120 ? 'the previous run is still active, so this tick is <b>skipped</b>.' : 'the previous run finished at 1:30, so a new Job starts.')
          : `00:0${t / 60}:00: Replace <b>deletes the running Job</b> (30 s before it would finish) and starts a fresh one.`; })() });
    });
    return L;
  }
  function cronDraw() {
    stage.setAttribute('viewBox', '0 0 760 220'); stage.innerHTML = ''; const X = (t) => 90 + t / 330 * 650; const D = 90;
    [0, 1].forEach((l) => stage.append(T(10, 64 + l * 46, 't2', `lane ${l + 1}`), svg('rect', { class: 'bx', x: 90, y: 48 + l * 46, width: 650, height: 26, rx: 5 })));
    [0, 60, 120, 180, 240, 300].forEach((t) => stage.append(svg('line', { class: 'tick', x1: X(t), x2: X(t), y1: 30, y2: 150 }), T(X(t) - 14, 170, 'ax', `0${t / 60}:00`)));
    S.runs.forEach((r) => { const end = Math.min(r.killed || r.a + D, S.now); if (end <= r.a) return; stage.append(svg('rect', { class: r.killed ? 'killed' : (r.a + D <= S.now ? 'okb' : 'run'), x: X(r.a), y: 51 + r.lane * 46, width: X(end) - X(r.a), height: 20, rx: 4 }));
      if (r.killed && r.killed <= S.now) stage.append(T(X(r.killed) - 30, 44 + r.lane * 46, 'taint', 'killed')); });
    S.skips.forEach((t) => stage.append(T(X(t) - 5, 28, 'skip', '✕')));
    stage.append(svg('line', { class: 'cur', x1: X(S.now), x2: X(S.now), y1: 30, y2: 150 }), T(90, 200, 't3', 'green = finished · blue = running · red = deleted by Replace · ✕ = tick skipped (Forbid)'));
    const done = S.runs.filter((r) => !r.killed && r.a + D <= S.now).length; const act = S.runs.filter((r) => !r.killed && r.a + D > S.now && r.a <= S.now).length;
    stats.innerHTML = ''; st(`Jobs started <b>${S.runs.length}</b>`); st(`completed <b>${done}</b>`); st(`active now <b>${act}</b>`); st(`skipped <b>${S.skips.length}</b>`);
  }
  const M = { sts: [stsPlan, stsDraw, () => ({ pods: [], pvc: [], dns: false, target: 'v1' })], ds: [dsPlan, dsDraw, () => ({ rev: 'v1', nodes: [0, 1, 2, 3].map((i) => ({ exists: i < 3, pod: null })) })],
    job: [jobPlan, jobDraw, () => ({ att: [], bo: [], now: 0, failed: false })], cron: [cronPlan, cronDraw, () => ({ runs: [], skips: [], now: 0 })] };
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; S = M[mode][2](); steps = M[mode][0](); M[mode][1](); bStep.disabled = false; say('Press Play or Step.'); }
  function step() { if (k >= steps.length) return false; const s = steps[k++]; if (s.now != null) S.now = s.now; s.run(); M[mode][1](); say(`<b>${k}/${steps.length}</b> · ` + s.t); if (k >= steps.length) bStep.disabled = true; return true; }
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

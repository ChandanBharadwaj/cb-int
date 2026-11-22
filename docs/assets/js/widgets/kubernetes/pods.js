/* Pods: lifecycle timeline per container (init, native sidecar, classic sidecar, app), pod phase lane, restart back-off and termination order. */
IA.widget('pods', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8po-style')) {
    document.head.append(el('style', { id: 'w-k8po-style', text: `
.k8po svg text { font-family: var(--sans); }
.k8po .ln { fill: var(--text); font-size: 12px; font-weight: 600; }
.k8po .ln2 { fill: var(--text-3); font-size: 10.5px; font-family: var(--mono); }
.k8po .track { fill: var(--surface-2); stroke: var(--border); }
.k8po .s-run { fill: var(--accent); opacity: .85; }
.k8po .s-term { fill: var(--k-external); opacity: .7; }
.k8po .s-wait { fill: none; stroke: var(--warn); stroke-width: 2; stroke-dasharray: 4 3; }
.k8po .p-Pending { fill: color-mix(in srgb, var(--warn) 30%, var(--surface)); stroke: var(--warn); }
.k8po .p-Running { fill: color-mix(in srgb, var(--accent) 22%, var(--surface)); stroke: var(--accent); }
.k8po .p-Succeeded { fill: color-mix(in srgb, var(--ok) 25%, var(--surface)); stroke: var(--ok); }
.k8po .p-Failed { fill: color-mix(in srgb, var(--err) 22%, var(--surface)); stroke: var(--err); }
.k8po .ptxt { fill: var(--text); font-size: 11px; font-weight: 600; }
.k8po .mk-ok { fill: var(--ok); } .k8po .mk-fail { fill: var(--err); } .k8po .mk-ready { fill: var(--k-compute); }
.k8po .mtxt { font-size: 10px; fill: var(--text-2); font-family: var(--mono); }
.k8po .vl { stroke: var(--text-3); stroke-dasharray: 3 3; }
.k8po .vtxt { font-size: 10.5px; fill: var(--text-2); }
.k8po .cur { stroke: var(--accent); stroke-width: 2; }
.k8po .axis { font-size: 10px; fill: var(--text-3); font-family: var(--mono); }
` }));
  }
  const I = Infinity;
  const PRE = {
    deploy: { label: 'Deployment: init + native sidecar', T: 60,
      lanes: [['pod phase', ''], ['migrate', 'init container'], ['log-agent', 'native sidecar'], ['app', 'Spring Boot']],
      phase: [[0, 10, 'Pending'], [10, 53, 'Running']],
      segs: [[1, 0, 8, 'run'], [2, 8, 51, 'run'], [2, 51, 53, 'term'], [3, 10, 45, 'run'], [3, 45, 51, 'term']],
      marks: [[1, 8, 'ok', 'exit 0'], [3, 30, 'ready', 'Ready'], [3, 51, 'ok', 'exit 0'], [2, 53, 'ok', 'stopped']],
      vl: [[45, 'kubectl delete'], [53, 'pod removed']],
      steps: [[0, 'Phase <b>Pending</b>. The pod is bound to a node; the kubelet creates the sandbox (the CNI assigns the IP) and pulls images. <code>migrate</code>, the first init container, runs. kubectl shows <code>Init:0/2</code>.'],
        [8, '<code>migrate</code> exits 0, so the next init container starts: <code>log-agent</code> with <code>restartPolicy: Always</code>, a <b>native sidecar</b>. The kubelet does not wait for it to exit, only for it to start (and pass its startupProbe, if any).'],
        [10, 'Init is done, so <code>app</code> starts and the phase becomes <b>Running</b>. But <code>Ready=False</code>: the JVM is still starting and gets no traffic yet.'],
        [30, 'The readiness probe passes (Spring context up, caches warm). <code>Ready=True</code>, and the pod IP is added to the Service’s EndpointSlice.'],
        [45, '<code>kubectl delete pod</code>: deletionTimestamp set, the pod is removed from endpoints, and the kubelet runs preStop then sends SIGTERM to the <b>app only</b>. The sidecar keeps running so the app can still ship its last logs.'],
        [51, 'The app finishes draining and exits 0. Now the kubelet SIGTERMs the native sidecars, in <b>reverse</b> declaration order.'],
        [53, 'The sidecar stops and the pod object is removed. Everything (preStop, app drain, sidecar stop) had to fit inside <code>terminationGracePeriodSeconds</code>.']] },
    jobClassic: { label: 'Job + classic sidecar', T: 60,
      lanes: [['pod phase', ''], ['report', 'main container'], ['db-proxy', 'regular container']],
      phase: [[0, 2, 'Pending'], [2, I, 'Running']],
      segs: [[1, 2, 20, 'run'], [2, 2, I, 'run']],
      marks: [[1, 20, 'ok', 'exit 0']], vl: [],
      steps: [[0, 'A Job pod (<code>restartPolicy: Never</code>) with the DB proxy as a <b>regular</b> container. Phase <b>Pending</b> while images pull.'],
        [2, 'Both containers start <b>in parallel</b>; the report may even try the DB before the proxy listens. Phase <b>Running</b>.'],
        [20, '<code>report</code> finishes and exits 0. But the pod only succeeds when <b>every</b> regular container has terminated, and the proxy has no reason to exit.'],
        [60, 'Still Running. The Job stays active forever; only <code>activeDeadlineSeconds</code> would end it, as <b>Failed</b> (DeadlineExceeded). Switch to “Job + native sidecar” to compare.']] },
    jobNative: { label: 'Job + native sidecar', T: 40,
      lanes: [['pod phase', ''], ['db-proxy', 'native sidecar'], ['report', 'main container']],
      phase: [[0, 3, 'Pending'], [3, 21, 'Running'], [21, I, 'Succeeded']],
      segs: [[1, 0, 20, 'run'], [1, 20, 21, 'term'], [2, 3, 20, 'run']],
      marks: [[1, 3, 'ready', 'startupProbe ok'], [2, 20, 'ok', 'exit 0'], [1, 21, 'ok', 'stopped']], vl: [[20, 'main done']],
      steps: [[0, 'Same Job, but the proxy is declared in <code>initContainers</code> with <code>restartPolicy: Always</code>. It starts <b>first</b>, alone.'],
        [3, 'The proxy’s startupProbe (TCP 5432) passes. Only now does <code>report</code> start, so its first DB connection works. Phase <b>Running</b>.'],
        [20, '<code>report</code> exits 0. All <b>main</b> containers are done, so the kubelet sends SIGTERM to the sidecar.'],
        [21, 'The sidecar stops; its exit code is ignored for the pod result. Phase <b>Succeeded</b>, and the Job is <b>Complete</b>.']] },
    crash: { label: 'Crash loop (Always)', T: 120,
      lanes: [['pod phase', ''], ['app', 'restartPolicy: Always']],
      phase: [[0, 1, 'Pending'], [1, I, 'Running']],
      segs: [[1, 1, 6, 'run'], [1, 6, 16, 'wait'], [1, 16, 21, 'run'], [1, 21, 41, 'wait'], [1, 41, 46, 'run'], [1, 46, 86, 'wait'], [1, 86, 91, 'run'], [1, 91, 171, 'wait']],
      marks: [[1, 6, 'fail', 'exit 1'], [1, 21, 'fail', 'exit 1'], [1, 46, 'fail', 'exit 1'], [1, 91, 'fail', 'exit 1']], vl: [],
      restarts: [16, 41, 86],
      steps: [[1, 'The app starts. It reads a missing config value and exits with code 1 after 5 s.'],
        [6, 'Exit 1. <code>restartPolicy: Always</code>, so the kubelet will restart it <b>in place</b>, after a back-off of 10 s. The container state is <code>Waiting: CrashLoopBackOff</code>.'],
        [16, 'Restart #1: same pod, same IP, same node; a fresh container from the image.'],
        [21, 'Crashes again. The back-off doubles to 20 s.'],
        [41, 'Restart #2.'],
        [46, 'Crash. Back-off 40 s. Note the top lane: phase is still <b>Running</b> the whole time. CrashLoopBackOff is a container reason, not a phase.'],
        [86, 'Restart #3. The back-off keeps doubling up to a <b>5 minute</b> cap and resets only after 10 minutes of running without a crash.'],
        [91, 'Crash. Next wait 80 s. Read the reason with <code>kubectl logs --previous</code>: the current container has not logged anything yet.']] },
    initFail: { label: 'Init fails (Never)', T: 30,
      lanes: [['pod phase', ''], ['migrate', 'init container'], ['app', 'never started']],
      phase: [[0, 7, 'Pending'], [7, I, 'Failed']],
      segs: [[1, 0, 7, 'run']], marks: [[1, 7, 'fail', 'exit 1']], vl: [],
      steps: [[0, 'A pod with <code>restartPolicy: Never</code>. The init container <code>migrate</code> runs; the app waits. Phase <b>Pending</b>.'],
        [7, '<code>migrate</code> exits 1. With <code>Never</code>, a failed init container fails the pod: phase <b>Failed</b>, and the app never starts.'],
        [30, 'With <code>Always</code> or <code>OnFailure</code> the kubelet would instead retry <code>migrate</code> with back-off: STATUS <code>Init:CrashLoopBackOff</code>, phase stays <b>Pending</b>.']] }
  };
  let pre = 'deploy'; let gen = 0; let running = false; let speed = 2600; let k = 0; let now = 0;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segP = seg(Object.keys(PRE).map((x) => [x, PRE[x].label]), () => pre, (v) => { pre = v; reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1300, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const stage = svg('svg', { viewBox: '0 0 760 250', role: 'img', 'aria-label': 'Timeline with one lane per container and a pod phase lane' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('k8po');
  root.append(el('div', { class: 'w-controls' }, segP), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const X0 = 170, XW = 570, LY = (i) => 18 + i * 46;
  function draw() {
    const P = PRE[pre]; const x = (t) => X0 + Math.min(t, P.T) / P.T * XW; const H = LY(P.lanes.length) + 4;
    stage.setAttribute('viewBox', `0 0 760 ${H + 30}`); stage.innerHTML = '';
    P.lanes.forEach(([n, d], i) => { const y = LY(i);
      stage.append(svg('text', { class: 'ln', x: 8, y: y + 14, text: n }), svg('text', { class: 'ln2', x: 8, y: y + 28, text: d }), svg('rect', { class: 'track', x: X0, y, width: XW, height: 26, rx: 5 })); });
    P.phase.forEach(([a, b, ph]) => { if (now < a) return; const e = Math.min(b, now); if (e <= a) return;
      stage.append(svg('rect', { class: 'p-' + ph, x: x(a), y: LY(0), width: Math.max(1, x(e) - x(a)), height: 26, rx: 5 }));
      if (x(e) - x(a) > 56) stage.append(svg('text', { class: 'ptxt', x: x(a) + 6, y: LY(0) + 17, text: ph })); });
    P.segs.forEach(([l, a, b, st]) => { if (now <= a) return; const e = Math.min(b, now); const y = LY(l) + 3;
      stage.append(svg('rect', { class: 's-' + st, x: x(a), y, width: Math.max(1, x(e) - x(a)), height: 20, rx: 4 })); });
    P.marks.forEach(([l, t, kd, lab]) => { if (now < t) return; const y = LY(l);
      if (kd === 'ready') { stage.append(svg('rect', { class: 'mk-ready', x: x(t) - 1.5, y: y - 2, width: 3, height: 30 }), svg('text', { class: 'mtxt', x: x(t) + 4, y: y - 3, text: lab })); return; }
      stage.append(svg('circle', { class: 'mk-' + kd, cx: x(t), cy: y + 13, r: 6 }), svg('text', { x: x(t) - 3.5, y: y + 17, 'font-size': 10, fill: 'var(--surface)', text: kd === 'ok' ? '✓' : '✕' }), svg('text', { class: 'mtxt', x: x(t) + 9, y: y - 3, text: lab })); });
    P.vl.forEach(([t, lab]) => { if (now < t) return; stage.append(svg('line', { class: 'vl', x1: x(t), x2: x(t), y1: LY(0) - 6, y2: H }), svg('text', { class: 'vtxt', x: Math.min(x(t) + 3, 690), y: H + 12, text: lab })); });
    for (let t = 0; t <= P.T; t += P.T / 6) stage.append(svg('text', { class: 'axis', x: x(t) - 6, y: H + 26, text: Math.round(t) + 's' }));
    stage.append(svg('line', { class: 'cur', x1: x(now), x2: x(now), y1: LY(0) - 8, y2: H }));
    const ph = (P.phase.find(([a, b]) => now >= a && now < b) || P.phase[P.phase.length - 1]);
    const restarts = (P.restarts || []).filter((t) => now >= t).length;
    stats.innerHTML = ''; const st = (h) => stats.append(el('span', { class: 'w-stat', html: h }));
    st(`t = <b>${Math.round(now)} s</b>`); st(`status.phase <b>${pre === 'deploy' && now >= 53 ? '(deleted)' : ph[2]}</b>`);
    if (pre === 'crash') st(`restartCount <b>${restarts}</b>`);
    if (pre === 'deploy') st(`Ready <b>${now >= 30 && now < 45 ? 'True' : 'False'}</b>`);
    if (pre.startsWith('job')) st(`Job <b>${pre === 'jobNative' && now >= 21 ? 'Complete' : 'Active'}</b>`);
  }
  async function animTo(t) {
    const g = gen; const from = now;
    if (reduced || t <= from) { now = t; draw(); return; }
    const dur = Math.min(speed * 0.7, 300 + (t - from) / PRE[pre].T * speed * 2); const t0 = performance.now();
    await new Promise((res) => { const f = (ts) => { if (g !== gen) return res(); const u = Math.min(1, (ts - t0) / dur); now = from + (t - from) * u; draw(); if (u < 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  }
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; now = 0; draw(); bStep.disabled = false; say('Press Play or Step to advance the clock event by event. Switch scenarios above.'); }
  async function step() { const P = PRE[pre]; if (k >= P.steps.length) return false; const [t, txt] = P.steps[k++]; const g = gen;
    say(`<b>t=${t}s</b> · ` + txt); await animTo(t); if (g !== gen) return false; if (k >= P.steps.length) bStep.disabled = true; return true; }
  let busy = false;
  bStep.addEventListener('click', async () => { running = false; bPlay.textContent = '▶ Play'; if (busy) return; busy = true; await step(); busy = false; });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= PRE[pre].steps.length) reset();
    if (reduced) { while (await step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && await step()) await sleep(speed * 0.8);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

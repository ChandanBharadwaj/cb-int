/* Debugging workloads: a decision tree from the STATUS column to the evidence and the usual causes, with a terminal log and the kubelet's exponential restart back-off. */
IA.widget('debugging', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8dbg-style')) {
    document.head.append(el('style', { id: 'w-k8dbg-style', text: `
.k8dbg svg text { font-family: var(--sans); }
.k8dbg .nd { fill: var(--surface); stroke: var(--border); stroke-width: 1.4; transition: all .3s; }
.k8dbg .nd.on { stroke: var(--accent); stroke-width: 2.8; fill: var(--accent-soft); }
.k8dbg .nd.cause { stroke: var(--warn); stroke-width: 2.8; fill: color-mix(in srgb, var(--warn) 14%, var(--surface)); }
.k8dbg .nd.fix { stroke: var(--ok); stroke-width: 2.8; fill: color-mix(in srgb, var(--ok) 14%, var(--surface)); }
.k8dbg .nd.dim { opacity: .45; }
.k8dbg .nt { font-size: 12px; font-weight: 700; fill: var(--text); }
.k8dbg .ns { font-size: 9.8px; fill: var(--text-2); font-family: var(--mono); }
.k8dbg .ed { stroke: var(--border); stroke-width: 1.4; fill: none; }
.k8dbg .ed.on { stroke: var(--accent); stroke-width: 2.6; }
.k8dbg .ax { font-size: 10px; fill: var(--text-3); font-family: var(--mono); }
.k8dbg .run { fill: var(--err); }
.k8dbg .wait { fill: var(--surface-2); stroke: var(--border); }
.k8dbg .wl { font-size: 10px; fill: var(--text-2); font-family: var(--mono); }
.k8dbg .w-log { max-height: 180px; }
.k8dbg .w-log .c { color: var(--accent); } .k8dbg .w-log .e { color: var(--err); } .k8dbg .w-log .o { color: var(--ok); } .k8dbg .w-log .m { color: var(--text-3); }
` }));
  }
  const BR = [
    { id: 'pending', t: 'Pending', s: 'not scheduled', look: ['describe pod', '→ FailedScheduling'], cause: ['requests > free,', 'taints, affinity, PVC'] },
    { id: 'pull', t: 'ImagePullBackOff', s: 'ErrImagePull first', look: ['describe pod', '→ Failed to pull image'], cause: ['wrong tag, auth,', 'rate limit, arch'] },
    { id: 'crash', t: 'CrashLoopBackOff', s: 'starts, then exits', look: ['logs --previous', '+ Exit Code'], cause: ['bad config/env, dep', 'at boot, probe kills'] },
    { id: 'oom', t: 'OOMKilled', s: 'exit code 137', look: ['describe: Last State', 'Reason OOMKilled'], cause: ['limit < heap+non-heap,', 'leak, JVM flags'] },
    { id: 'unready', t: 'Running 0/1', s: 'READY column', look: ['describe → Unhealthy', 'kubectl debug + curl'], cause: ['wrong probe path/port,', 'dep in readiness'] }
  ];
  const L = (c, t) => [c, t];
  const SC = {
    pending: [
      { at: 'root', say: 'Always start with the <b>STATUS</b> and <b>RESTARTS</b> columns. They tell you which branch of the tree you are in.', log: [L('c', '$ kubectl get pods -n shop'), L('m', 'NAME                      READY   STATUS    RESTARTS   AGE'), L('', 'orders-7c9f6d8b5-x2kq8    0/1     Pending   0          4m')] },
      { at: 'br', say: '<b>Pending</b> with 0 restarts and no node: the Pod was never scheduled. No container ever ran, so there are no logs to read.' },
      { at: 'look', say: 'The scheduler explains itself in an <b>Event</b> on the Pod. Read the whole message: it counts nodes per reason.', log: [L('c', '$ kubectl describe pod orders-7c9f6d8b5-x2kq8 -n shop | tail -4'), L('m', 'Events:'), L('e', '  Warning  FailedScheduling  default-scheduler  0/3 nodes are available: 1 node(s) had untolerated taint {dedicated: batch}, 2 Insufficient memory. preemption: 0/3 nodes are available: 3 No preemption victims found for incoming pod.')] },
      { at: 'cause', say: 'Scheduling uses <b>requests</b>, not real usage. The Pod asks for 6Gi; the two general nodes have less than that <i>unrequested</i>, even if <code>kubectl top</code> shows them half idle. The third node is tainted.', tone: 'warn', log: [L('c', '$ kubectl describe node node-2 | grep -A6 "Allocated resources"'), L('', '  memory   13.1Gi (90%)   ...')] },
      { at: 'fix', say: 'Fix the request (measure first), add capacity (a Cluster Autoscaler or Karpenter would add a node here), or add a toleration if the Pod belongs on that node. Other Pending causes: a PVC that can’t bind, a nodeSelector nobody matches, a zone with no capacity.', tone: 'ok', log: [L('c', '$ kubectl set resources deploy/orders -n shop --requests=memory=2Gi --limits=memory=2Gi'), L('o', 'deployment.apps/orders resource requirements updated')] }
    ],
    pull: [
      { at: 'root', say: 'The Pod is scheduled (it has a node) but no container starts.', log: [L('c', '$ kubectl get pods -n shop'), L('m', 'NAME                      READY   STATUS             RESTARTS   AGE'), L('', 'orders-6d4b9c7f8-p9xq2    0/1     ImagePullBackOff   0          3m')] },
      { at: 'br', say: '<b>ErrImagePull</b> is the first failure; <b>ImagePullBackOff</b> means the kubelet is waiting before trying again, with a growing delay (up to 5 minutes). Restarts stay at 0 because no container ever ran.' },
      { at: 'look', say: 'The kubelet’s Event carries the registry’s answer. That answer tells you which cause it is.', log: [L('c', '$ kubectl describe pod orders-6d4b9c7f8-p9xq2 -n shop | grep -A1 Failed'), L('e', '  Warning  Failed  kubelet  Failed to pull image "registry.example.com/orders:7.3": rpc error: ... manifest unknown'), L('e', '  Warning  Failed  kubelet  Error: ErrImagePull'), L('m', '  Normal   BackOff kubelet  Back-off pulling image "registry.example.com/orders:7.3"')] },
      { at: 'cause', say: '<code>manifest unknown</code> / <code>not found</code> → the tag doesn’t exist (CI pushed 7.3.0, the chart says 7.3). <code>401</code>/<code>403</code> → missing or wrong <code>imagePullSecrets</code>. <code>429 toomanyrequests</code> → registry rate limit. <code>no matching manifest for linux/arm64</code> → you built for amd64 only.', tone: 'warn' },
      { at: 'fix', say: 'Deploy immutable tags or digests that CI actually pushed, and verify them before the rollout. For private registries, attach the pull secret to the ServiceAccount so every Pod gets it.', tone: 'ok', log: [L('c', '$ kubectl patch sa default -n shop -p \'{"imagePullSecrets":[{"name":"regcred"}]}\''), L('c', '$ kubectl set image deploy/orders app=registry.example.com/orders@sha256:4f1c… -n shop'), L('o', 'deployment.apps/orders image updated')] }
    ],
    crash: [
      { at: 'root', say: 'Restarts keep climbing and STATUS alternates between <code>Running</code>, <code>Error</code> and <code>CrashLoopBackOff</code>.', tl: 1, log: [L('c', '$ kubectl get pods -n shop -w'), L('m', 'NAME                      READY   STATUS             RESTARTS      AGE'), L('', 'orders-5b8d7c6f9-k2m4n    0/1     CrashLoopBackOff   4 (62s ago)   3m')] },
      { at: 'br', say: '<b>CrashLoopBackOff</b> is not an error by itself: it is the kubelet <i>waiting</i> between restarts. The delay doubles: 10 s, 20 s, 40 s … capped at 5 minutes, and it resets after the container has run cleanly for 10 minutes.', tl: 4 },
      { at: 'look', say: 'The current container may have just started and have no useful output. Read the <b>previous</b> container’s log, and its exit code.', tl: 5, log: [L('c', '$ kubectl logs orders-5b8d7c6f9-k2m4n -n shop --previous | tail -3'), L('e', '***************************'), L('e', 'APPLICATION FAILED TO START'), L('e', 'Failed to configure a DataSource: \'url\' attribute is not specified'), L('c', '$ kubectl get pod orders-5b8d7c6f9-k2m4n -n shop -o jsonpath=\'{.status.containerStatuses[0].lastState}\''), L('', '{"terminated":{"exitCode":1,"reason":"Error",...}}')] },
      { at: 'cause', say: '<b>Exit code 1</b> = the app exited by itself. Here a Secret key was renamed and <code>SPRING_DATASOURCE_URL</code> is empty. If the previous log is clean and the events show <code>Liveness probe failed</code> then <code>Killing</code>, the kubelet killed it instead (exit 137 or 143): a probe problem, not an app crash.', tone: 'warn', tl: 6 },
      { at: 'fix', say: 'Fix the config and roll out. The back-off only affects how fast you notice: after the fix, new Pods from the new ReplicaSet start immediately. While waiting in back-off a Pod looks idle; do not mistake that for “stuck”.', tone: 'ok', tl: 7, log: [L('c', '$ kubectl rollout restart deploy/orders -n shop && kubectl rollout status deploy/orders -n shop'), L('o', 'deployment "orders" successfully rolled out')] }
    ],
    oom: [
      { at: 'root', say: 'Restarts climb every few minutes or hours, often under load.', log: [L('c', '$ kubectl get pods -n shop'), L('m', 'NAME                      READY   STATUS      RESTARTS      AGE'), L('', 'orders-7f9c8b6d5-q8w2e    1/1     Running     3 (12m ago)   2h')] },
      { at: 'br', say: 'The STATUS may briefly show <code>OOMKilled</code>, but usually you catch it in <b>Last State</b>. The kernel’s cgroup OOM killer sent SIGKILL: no shutdown hooks, no log line from the JVM.' },
      { at: 'look', say: 'Exit code <b>137</b> = 128 + 9 (SIGKILL). Reason <b>OOMKilled</b> means the container hit its memory limit.', log: [L('c', '$ kubectl describe pod orders-7f9c8b6d5-q8w2e -n shop | grep -A4 "Last State"'), L('e', '    Last State:     Terminated'), L('e', '      Reason:       OOMKilled'), L('e', '      Exit Code:    137'), L('', '    Limits:  memory: 1Gi')] },
      { at: 'cause', say: 'A JVM with <code>-Xmx1g</code> in a 1Gi limit is guaranteed to die: metaspace, thread stacks, code cache and direct buffers live <i>outside</i> the heap. A Java <code>OutOfMemoryError</code> is different: the JVM throws it inside a running process (exit code 1 or a hung app).', tone: 'warn' },
      { at: 'fix', say: 'Size the heap as a fraction of the limit (<code>-XX:MaxRAMPercentage=70</code>) and leave room for non-heap. See <a href="jvm-on-k8s.html">Java/Spring on Kubernetes</a> and <a href="resources-qos.html">Requests, limits & QoS</a>.', tone: 'ok', log: [L('c', '$ kubectl set env deploy/orders -n shop JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70"'), L('o', 'deployment.apps/orders env updated')] }
    ],
    unready: [
      { at: 'root', say: 'The Pod is Running and never restarts, yet the Service returns 503 or connection refused.', log: [L('c', '$ kubectl get pods -n shop'), L('m', 'NAME                      READY   STATUS    RESTARTS   AGE'), L('', 'orders-6c7d8e9f0-z7x6c    0/1     Running   0          9m')] },
      { at: 'br', say: '<b>READY 0/1</b>: the readiness probe fails, so the Pod is not in the Service’s EndpointSlices. Check <code>kubectl get endpointslices -l kubernetes.io/service-name=orders</code>.' },
      { at: 'look', say: 'The Event shows the probe’s result. Then test from inside the network namespace with an <b>ephemeral debug container</b> (GA in 1.25): your distroless image has no shell or curl, the debug image does.', log: [L('e', '  Warning  Unhealthy  kubelet  Readiness probe failed: HTTP probe failed with statuscode: 404'), L('c', '$ kubectl debug -it orders-6c7d8e9f0-z7x6c -n shop --image=nicolaka/netshoot --target=app -- sh'), L('c', '~ # curl -s -o /dev/null -w "%{http_code}" localhost:8080/actuator/health/readiness'), L('', '404'), L('c', '~ # curl -s localhost:8081/actuator/health/readiness'), L('o', '{"status":"UP"}')] },
      { at: 'cause', say: 'The app moved Actuator to a management port (8081) but the probe still targets 8080. Ephemeral containers share the Pod’s network, so <code>localhost</code> reaches the app; <code>--target</code> also shares its process namespace (if the runtime supports it) so you can see the JVM’s processes.', tone: 'warn' },
      { at: 'fix', say: 'Point the probe at the right port, or keep health on the main port with <code>management.endpoint.health.probes.add-additional-paths=true</code> and probe <code>/readyz</code>. Ephemeral containers can’t be removed; they disappear with the Pod.', tone: 'ok', log: [L('c', '$ kubectl patch deploy orders -n shop --type=json -p \'[{"op":"replace","path":"/spec/template/spec/containers/0/readinessProbe/httpGet/path","value":"/readyz"}]\''), L('o', 'deployment.apps/orders patched')] }
    ]
  };
  let mode = 'crash'; let k = 0; let gen = 0; let running = false; let speed = 3000; let logLines = [];
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const W = 760; const H = 372;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Debugging decision tree: status, evidence, cause' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const log = el('div', { class: 'w-log', 'aria-label': 'Terminal' });
  root.classList.add('k8dbg');
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'symptom' }), seg(BR.map((b) => [b.id, b.t]), mode, (v) => { mode = v; reset(); }, 'Symptom')),
    el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg([[4200, 'Slow'], [3000, 'Normal'], [1500, 'Fast']], speed, (v) => { speed = v; }, 'Speed')), narr, log);
  const say = (h, tone) => { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const NX = (i) => 8 + i * 150; const NWD = 144;
  const ORDER = ['root', 'br', 'look', 'cause', 'fix'];
  function box(x, y, w, h, cls, t, lines) {
    stage.append(svg('rect', { class: 'nd ' + cls, x, y, width: w, height: h, rx: 9 }), svg('text', { class: 'nt', x: x + w / 2, y: y + 17, 'text-anchor': 'middle', text: t }));
    lines.forEach((ln, j) => stage.append(svg('text', { class: 'ns', x: x + w / 2, y: y + 32 + j * 12, 'text-anchor': 'middle', text: ln })));
  }
  function draw(s) {
    stage.innerHTML = '';
    const lvl = ORDER.indexOf(s.at); const bi = BR.findIndex((b) => b.id === mode);
    box(250, 6, 260, 44, lvl === 0 ? 'on' : '', 'kubectl get pods', ['STATUS? RESTARTS? READY?']);
    BR.forEach((b, i) => {
      const mine = i === bi; const x = NX(i);
      const edOn = mine && lvl >= 1;
      stage.append(svg('path', { class: 'ed' + (edOn ? ' on' : ''), d: `M380 50 C 380 64, ${x + NWD / 2} 60, ${x + NWD / 2} 78` }));
      box(x, 78, NWD, 44, mine && lvl >= 1 ? 'on' : (lvl >= 1 ? 'dim' : ''), b.t, [b.s]);
      stage.append(svg('path', { class: 'ed' + (mine && lvl >= 2 ? ' on' : ''), d: `M${x + NWD / 2} 122 L${x + NWD / 2} 140` }));
      box(x, 140, NWD, 54, mine && lvl >= 2 ? 'on' : (lvl >= 1 ? 'dim' : ''), 'Look at', b.look);
      stage.append(svg('path', { class: 'ed' + (mine && lvl >= 3 ? ' on' : ''), d: `M${x + NWD / 2} 194 L${x + NWD / 2} 212` }));
      box(x, 212, NWD, 54, mine && lvl === 3 ? 'cause' : mine && lvl === 4 ? 'fix' : (lvl >= 1 ? 'dim' : ''), mine && lvl === 4 ? 'Fixed' : 'Usual causes', b.cause);
    });
    // back-off timeline
    const y0 = 292; const T = 660; const X = (t) => 20 + (t / T) * 720;
    stage.append(svg('text', { class: 'nt', x: 20, y: y0 - 6, text: mode === 'crash' ? 'Restart back-off for this Pod (container runs ~3 s, then exits)' : mode === 'pull' ? 'Image pulls back off the same way: 10 s, 20 s, 40 s … max 5 min' : 'kubelet restart back-off (CrashLoopBackOff): 10 s → 20 s → 40 s → 80 s → 160 s → 300 s cap' }));
    stage.append(svg('line', { x1: 20, y1: y0 + 38, x2: 740, y2: y0 + 38, stroke: 'var(--border)' }));
    [0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660].forEach((t) => stage.append(svg('text', { class: 'ax', x: X(t), y: y0 + 54, 'text-anchor': 'middle', text: t + 's' })));
    const n = mode === 'crash' ? (s.tl || 0) : 7; const backs = [10, 20, 40, 80, 160, 300]; let t = 0;
    for (let r = 0; r < n; r++) {
      stage.append(svg('rect', { class: 'run', x: X(t), y: y0 + 6, width: Math.max(3, X(t + 3) - X(t)), height: 26, rx: 2, opacity: mode === 'crash' ? 1 : 0.35 }));
      t += 3; const b = backs[Math.min(r, backs.length - 1)];
      if (r < n - 1 && t + b <= T) {
        stage.append(svg('rect', { class: 'wait', x: X(t), y: y0 + 12, width: X(t + b) - X(t), height: 14, rx: 3, opacity: mode === 'crash' ? 1 : 0.35 }));
        if (X(t + b) - X(t) > 26) stage.append(svg('text', { class: 'wl', x: (X(t) + X(t + b)) / 2, y: y0 + 23, 'text-anchor': 'middle', text: b + 's' }));
      }
      t += b; if (t > T) break;
    }
  }
  function renderLog() { log.innerHTML = ''; logLines.forEach(([c, t]) => log.append(el('div', { class: c, text: t }))); log.scrollTop = log.scrollHeight; }
  function show(s) { if (s.log) logLines = logLines.concat(s.log); draw(s); say(s.say, s.tone); renderLog(); }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; logLines = []; bStep.disabled = false; show(SC[mode][k++]); }
  function step() { const st = SC[mode]; if (k >= st.length) return false; show(st[k++]); if (k >= st.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= SC[mode].length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    if (reduced) { while (g === gen && step()); } else while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

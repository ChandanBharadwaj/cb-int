/* Observability: the metrics, logs and traces pipelines of a Spring Boot Pod, plus an incident walk through the golden signals. */
IA.widget('observability', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8ob-style')) {
    document.head.append(el('style', { id: 'w-k8ob-style', text: `
.k8ob svg text { font-family: var(--sans); }
.k8ob .bx { fill: var(--surface); stroke: var(--border); stroke-width: 1.4; transition: all .3s; }
.k8ob .bx.on { stroke: var(--accent); stroke-width: 2.8; fill: var(--accent-soft); }
.k8ob .bx.hot { stroke: var(--err); stroke-width: 2.8; fill: color-mix(in srgb, var(--err) 12%, var(--surface)); }
.k8ob .bx.dim { opacity: .4; }
.k8ob .bt { font-size: 12px; font-weight: 700; fill: var(--text); }
.k8ob .bs { font-size: 9.8px; fill: var(--text-2); font-family: var(--mono); }
.k8ob .frame { fill: none; stroke: var(--text-3); stroke-dasharray: 5 5; }
.k8ob .fl { font-size: 10.5px; fill: var(--text-3); font-family: var(--mono); }
.k8ob .col { font-size: 10.5px; font-weight: 700; fill: var(--text-3); letter-spacing: .05em; }
.k8ob .ed { stroke: var(--border); stroke-width: 1.6; fill: none; }
.k8ob .ed.on { stroke: var(--accent); stroke-width: 3; stroke-dasharray: 7 6; }
.k8ob .ed.on.anim { animation: k8obflow .9s linear infinite; }
.k8ob .ed.hot { stroke: var(--err); stroke-width: 3; stroke-dasharray: 7 6; }
.k8ob .ed.hot.anim { animation: k8obflow .9s linear infinite; }
.k8ob .ed.dim { opacity: .35; }
.k8ob .tag { font-size: 10px; font-weight: 700; fill: var(--accent); font-family: var(--mono); }
@keyframes k8obflow { to { stroke-dashoffset: -26; } }
` }));
  }
  const CX = [24, 284, 544]; const RY = [38, 112, 186, 260]; const BW = 196; const BH = 58;
  const B = {
    s0: [0, 0, 'App: /actuator/prometheus', ['Micrometer meters in memory', 'text format on GET']],
    s1: [0, 1, 'App: OpenTelemetry', ['Java agent or Micrometer', 'Tracing: spans + traceparent']],
    s2: [0, 2, 'kubelet · cAdvisor', ['CPU, memory, throttling', 'per container']],
    s3: [0, 3, 'stdout → /var/log/pods', ['runtime writes each line;', 'kubelet rotates the files']],
    c0: [1, 0, 'Prometheus', ['PULL: scrape every 15–30 s', 'targets via Kubernetes SD']],
    c1: [1, 1, 'OTel Collector', ['PUSH: OTLP in, batch,', 'k8s attributes, tail-sample']],
    c2: [1, 2, 'metrics-server', ['latest value only,', 'in memory, no history']],
    c3: [1, 3, 'Log agent (DaemonSet)', ['tails node files, adds', 'namespace/pod/labels']],
    u0: [2, 0, 'Dashboards & alerts', ['PromQL: rate(),', 'histogram_quantile()']],
    u1: [2, 1, 'Trace backend', ['Tempo / Jaeger / vendor:', 'look up by traceId']],
    u2: [2, 2, 'HPA · kubectl top', ['Metrics API', 'metrics.k8s.io']],
    u3: [2, 3, 'Log backend', ['Loki / Elasticsearch:', 'filter by labels, traceId']]
  };
  const pos = (id) => { const [c, r] = B[id]; return { x: CX[c], y: RY[r] }; };
  const E = {
    m1: ['s0', 'c0'], m2: ['c0', 'u0'], m3: ['s2', 'c0'], r1: ['s2', 'c2'], r2: ['c2', 'u2'],
    t1: ['s1', 'c1'], t2: ['c1', 'u1'], l1: ['s3', 'c3'], l2: ['c3', 'u3'], x1: ['u0', 'u1'], x2: ['u3', 'u1']
  };
  function edgePath(a, b) {
    const A = pos(a); const Bp = pos(b);
    if (A.x === Bp.x) { // same column: correlation links on the right side
      const x = A.x + BW; const y1 = A.y + BH / 2; const y2 = Bp.y + BH / 2;
      return `M${x} ${y1} C ${x + 18} ${y1}, ${x + 18} ${y2}, ${x} ${y2}`;
    }
    const x1 = A.x + BW; const y1 = A.y + BH / 2; const x2 = Bp.x; const y2 = Bp.y + BH / 2;
    return `M${x1} ${y1} C ${x1 + 34} ${y1}, ${x2 - 34} ${y2}, ${x2} ${y2}`;
  }
  const SC = {
    metrics: { l: 'Metrics', steps: [
      { on: ['s0'], say: '<b>Micrometer</b> (built into Spring Boot Actuator) keeps counters, gauges, timers and histograms in memory. With <code>micrometer-registry-prometheus</code> on the classpath, <code>/actuator/prometheus</code> renders the current values as text. Nothing is sent anywhere yet.' },
      { on: ['s0', 'c0'], e: ['m1'], say: '<b>Prometheus pulls</b>. It discovers Pods through the Kubernetes API (with the Prometheus Operator: a <code>ServiceMonitor</code> or <code>PodMonitor</code> selects them by label) and scrapes each one every 15–30 s. A Pod that dies between scrapes loses its last few seconds of data; counters are cumulative, so <code>rate()</code> copes with restarts.' },
      { on: ['c0', 'u0'], e: ['m2'], say: 'Dashboards and alert rules query Prometheus with PromQL: request rate, error ratio, latency percentiles from histogram buckets. Alerts go through Alertmanager.' },
      { on: ['s2', 'c0'], e: ['m3'], say: 'Prometheus also scrapes the kubelet’s cAdvisor endpoint (container CPU, memory, <code>container_cpu_cfs_throttled_periods_total</code>) and usually <b>kube-state-metrics</b> (object state: restarts, desired vs available replicas, Pending Pods). These are the infrastructure half of every dashboard.' },
      { on: ['s2', 'c2', 'u2'], e: ['r1', 'r2'], say: 'A <b>separate</b> pipeline: <b>metrics-server</b> collects CPU and memory from every kubelet (about every 15 s by default) and serves only the latest value through the <code>metrics.k8s.io</code> API. The HPA, VPA and <code>kubectl top</code> read it. It is not a monitoring system: no history, no app metrics, no alerts.', tone: 'ok', done: true }
    ] },
    logs: { l: 'Logs', steps: [
      { on: ['s3'], say: 'The 12-factor rule: the app writes to <b>stdout/stderr</b>, one event per line (JSON with Spring Boot 3.4+ structured logging, or a Logback encoder). The container runtime writes those lines to <code>/var/log/pods/&lt;ns&gt;_&lt;pod&gt;_&lt;uid&gt;/&lt;container&gt;/</code>, and the kubelet rotates them. <code>kubectl logs</code> reads these files.' },
      { on: ['s3', 'c3'], e: ['l1'], say: 'A <b>node agent</b> (Fluent Bit, Vector, the OTel Collector’s filelog receiver) runs as a DaemonSet, tails every file on the node and adds metadata from the API: namespace, Pod, container, labels. One agent per node, no change to the apps.' },
      { on: ['c3', 'u3'], e: ['l2'], say: 'The agent ships to a <b>log backend</b> with buffering and retries. Keep index labels low-cardinality (namespace, app, level); put request IDs and trace IDs in the log body, not in labels.' },
      { on: ['s3', 'c3', 'u3'], e: ['l1', 'l2'], say: 'Alternatives: a <b>sidecar</b> per Pod (only when an app can only log to files; it doubles the containers), or the app <b>pushing</b> directly to the backend (logs are lost or block the app when the backend is slow). Logs written to files inside the container never reach <code>kubectl logs</code> and vanish with the Pod.', tone: 'ok', done: true }
    ] },
    traces: { l: 'Traces', steps: [
      { on: ['s1'], say: '<b>Tracing</b> records one request across services as a tree of spans. The OpenTelemetry Java agent auto-instruments Spring MVC/WebFlux, JDBC, Kafka and HTTP clients; Spring Boot 3 also offers Micrometer Tracing with an OTel bridge.' },
      { on: ['s1'], say: 'The trace context travels in the W3C <code>traceparent</code> header (trace ID, parent span ID, sampled flag) on every outgoing call. If any hop drops the header, for example a hand-built HTTP client, the trace breaks in two.' },
      { on: ['s1', 'c1'], e: ['t1'], say: 'Spans are <b>pushed</b> over OTLP to an <b>OpenTelemetry Collector</b>: an agent per node (DaemonSet) and/or a gateway Deployment. It batches, retries, and its <code>k8sattributes</code> processor adds Pod, namespace and Deployment names.' },
      { on: ['c1', 'u1'], e: ['t2'], say: '<b>Sampling</b>: head sampling decides at the first service (e.g. 10%) and is cheap but blind. <b>Tail sampling</b> in a gateway collector waits for the whole trace and keeps all errors and slow requests. All spans of one trace must reach the same collector replica for that to work.', tone: 'ok', done: true }
    ] },
    incident: { l: 'Incident: p99 alert', steps: [
      { on: ['u0'], hot: ['u0'], say: '<b>Alert</b>: checkout p99 latency above 2 s for 5 minutes. Look at the four <b>golden signals</b> together: <b>latency</b> (up), <b>traffic</b> (normal), <b>errors</b> (5xx slightly up), <b>saturation</b> (?).' },
      { on: ['u0', 'c0', 's2'], e: ['m3'], say: 'Saturation: CPU is fine and throttling is flat, but <code>hikaricp_connections_pending</code> climbs and <code>hikaricp_connections_active</code> sits at the pool maximum on every Pod. The database pool is the bottleneck, not the Pods.' },
      { on: ['u0', 'u1'], e: ['x1'], hot: ['u1'], say: 'An <b>exemplar</b> on the latency histogram links a slow bucket to a trace ID. The trace shows 1.9 s waiting in <code>HikariDataSource.getConnection</code> before a 40 ms query.' },
      { on: ['u1', 'u3'], e: ['x2'], hot: ['u3'], say: 'Logs filtered by that <code>traceId</code> (put into the MDC by the tracing bridge) show a new batch endpoint holding connections for whole seconds while it streams rows.' },
      { on: ['u0', 'u1', 'u3'], e: ['x1', 'x2'], say: 'Metrics told you <i>that</i> and <i>where</i>, the trace told you <i>which step</i>, the logs told you <i>why</i>. The fix is a separate pool (or a bulkhead) for the batch endpoint. Correlation needs the same service name, version and trace ID on all three signals.', tone: 'ok', done: true }
    ] }
  };
  let mode = 'metrics'; let k = 0; let gen = 0; let running = false; let speed = 3200;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const W = 760; const H = 346;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Metrics, logs and traces pipelines from a Pod to backends' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('k8ob');
  root.append(el('div', { class: 'w-controls' }, seg(Object.entries(SC).map(([v, s]) => [v, s.l]), mode, (v) => { mode = v; reset(); }, 'Signal')),
    el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg([[4400, 'Slow'], [3200, 'Normal'], [1600, 'Fast']], speed, (v) => { speed = v; }, 'Speed')), narr);
  const say = (h, tone) => { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function draw(s) {
    stage.innerHTML = '';
    [['ON THE NODE', 0], ['COLLECT', 1], ['STORE & USE', 2]].forEach(([t, c]) => stage.append(svg('text', { class: 'col', x: CX[c], y: 20, text: t })));
    stage.append(svg('rect', { class: 'frame', x: 14, y: 30, width: BW + 20, height: 312, rx: 12 }), svg('text', { class: 'fl', x: 24, y: 334, text: 'node-2 · Pod orders-7c9 (Spring Boot)' }));
    Object.entries(E).forEach(([id, [a, b]]) => {
      const on = (s.e || []).includes(id); const hot = on && s.hot && s.hot.includes(b);
      if ((id === 'x1' || id === 'x2') && !on) return;
      stage.append(svg('path', { class: 'ed' + (on ? (hot ? ' hot' : ' on') + (reduced ? '' : ' anim') : (s.on.length ? ' dim' : '')), d: edgePath(a, b) }));
    });
    Object.entries(B).forEach(([id, [c, r, t, sub]]) => {
      const x = CX[c]; const y = RY[r];
      const cls = s.hot && s.hot.includes(id) ? 'hot' : s.on.includes(id) ? 'on' : 'dim';
      stage.append(svg('rect', { class: 'bx ' + cls, x, y, width: BW, height: BH, rx: 9 }), svg('text', { class: 'bt', x: x + 10, y: y + 18, text: t }));
      sub.forEach((ln, j) => stage.append(svg('text', { class: 'bs', x: x + 10, y: y + 34 + j * 12, text: ln })));
    });
    const tags = { metrics: [['c0', 'pull'], ['c2', 'pull']], logs: [['c3', 'tail']], traces: [['c1', 'push']], incident: [] }[mode];
    tags.forEach(([id, t]) => { const p = pos(id); stage.append(svg('text', { class: 'tag', x: p.x + BW - 8, y: p.y + 18, 'text-anchor': 'end', text: t })); });
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

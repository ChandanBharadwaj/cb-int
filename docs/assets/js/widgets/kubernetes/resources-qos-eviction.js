/* QoS & eviction: one node's memory over a day. Scheduling by requests, a container OOMKilled at its own limit, node memory pressure and the kubelet's eviction ranking. */
IA.widget('resources-qos-eviction', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8ev-style')) {
    document.head.append(el('style', { id: 'w-k8ev-style', text: `
.k8ev svg text { font-family: var(--sans); }
.k8ev .track { fill: var(--surface-2); stroke: var(--border); }
.k8ev .sys { fill: var(--k-external); opacity: .6; }
.k8ev .q-G { fill: var(--k-service); } .k8ev .q-B { fill: var(--k-compute); } .k8ev .q-BE { fill: var(--warn); }
.k8ev .mseg { opacity: .85; transition: width .5s, x .5s; }
.k8ev .thr { stroke: var(--err); stroke-width: 2; stroke-dasharray: 4 3; }
.k8ev .alloc { stroke: var(--text-2); stroke-width: 1.5; }
.k8ev .lt { fill: var(--text-2); font-size: 10.5px; }
.k8ev .pcard { fill: var(--surface); stroke: var(--border); stroke-width: 1.4; transition: stroke .3s, opacity .3s; }
.k8ev .pcard.hot { stroke: var(--accent); stroke-width: 2.4; }
.k8ev .pcard.dead { stroke: var(--err); stroke-width: 2.4; }
.k8ev .pcard.pend { stroke: var(--warn); stroke-dasharray: 5 3; }
.k8ev .gone { opacity: .4; }
.k8ev .nm { fill: var(--text); font-size: 12px; font-weight: 700; font-family: var(--mono); }
.k8ev .sm { fill: var(--text-2); font-size: 10.5px; font-family: var(--mono); }
.k8ev .badge { font-size: 10px; font-weight: 700; fill: var(--surface); }
.k8ev .ubar { transition: width .5s; }
.k8ev .req { stroke: var(--text); stroke-width: 2; }
.k8ev .st { font-size: 11px; font-weight: 700; }
` }));
  }
  const CAP = 8.5, THR = 8.4, ALLOC = 8.0;
  const base = () => ({ sys: 0.45, pods: [
    { n: 'api-g', q: 'G', req: 2, lim: 2, use: 1.6, st: 'Running' },
    { n: 'api-b', q: 'B', req: 1, lim: 3, use: 1.2, st: 'Running' },
    { n: 'worker', q: 'B', req: 1, lim: 1.5, use: 0.9, st: 'Running' },
    { n: 'debug', q: 'BE', req: 0, lim: 0, use: 0.3, st: 'Running' },
    { n: 'report', q: 'B', req: 4.5, lim: 5, use: 0, st: 'not created' }], hot: [], pressure: false });
  let S; let gen = 0; let running = false; let speed = 2800; let k = 0;
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 760 300', role: 'img', 'aria-label': 'Node memory bar with per-pod usage, eviction threshold, and pod cards' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('k8ev');
  root.append(el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, stats);
  const P = (n) => S.pods.find((p) => p.n === n);
  const QN = { G: 'Guaranteed', B: 'Burstable', BE: 'BestEffort' };
  const onNode = () => S.pods.filter((p) => p.st === 'Running' || p.st === 'OOMKilled → restarted');
  const steps = [
    { run: () => { S.hot = ['api-g', 'api-b', 'worker', 'debug']; }, t: 'Node <b>node-7</b>: 8.5 Gi of memory, 0.5 Gi reserved for the system and the eviction threshold, so <b>8 Gi allocatable</b>. Four pods, one per QoS shape. Requests sum to 4 Gi; real usage is about 4 Gi too.' },
    { run: () => { P('report').st = 'Pending'; S.hot = ['report']; }, t: 'A new pod <code>report</code> requests <b>4.5 Gi</b>. Requested so far: 4 Gi; 4 + 4.5 = 8.5 &gt; 8 allocatable, so the scheduler says <code>Insufficient memory</code> and it stays <b>Pending</b>, although 4 Gi are actually free. The scheduler only counts requests.' },
    { run: () => { P('worker').use = 1.5; S.hot = ['worker']; }, t: '<code>worker</code> grows to its <b>1.5 Gi limit</b> (its heap was sized without headroom)…' },
    { run: () => { const w = P('worker'); w.st = 'OOMKilled → restarted'; w.use = 0.4; S.hot = ['worker']; S.dead = 'worker'; }, t: '…and the kernel’s cgroup OOM killer ends it: <b>OOMKilled, exit 137</b>. That is the container’s own limit, not node pressure. Same pod, same node, restartCount +1. The node is fine.' },
    { run: () => { S.dead = null; P('api-b').use = 2.8; P('debug').use = 1.6; S.hot = ['api-b', 'debug']; }, t: 'Afternoon. <code>api-b</code> (request 1, limit 3) uses 2.8 Gi: <b>allowed</b>, it is below its limit. <code>debug</code> (no requests) uses 1.6 Gi. Both now live on memory nobody reserved for them.' },
    { run: () => { P('api-g').use = 1.95; P('api-b').use = 2.95; P('worker').use = 1.45; P('debug').use = 1.65; S.pressure = true; S.hot = []; }, t: 'Night batch traffic: total usage crosses the <b>hard eviction threshold</b> (<code>memory.available &lt; 100Mi</code>). The node reports <b>MemoryPressure</b> and the kubelet must pick a victim.' },
    { run: () => { S.hot = ['api-b', 'debug', 'worker']; S.rank = true; }, t: 'Ranking: (1) is usage above request? <code>api-b</code> +1.95, <code>debug</code> +1.65, <code>worker</code> +0.45 yes; <code>api-g</code> no. (2) priority: all equal. (3) amount above request: <b>api-b first</b>. A Burstable pod goes before the BestEffort one; QoS class is not the sort key.' },
    { run: () => { const b = P('api-b'); b.st = 'Evicted'; b.use = 0; S.pressure = false; S.hot = ['api-b']; S.rank = false; }, t: '<code>api-b</code> is <b>evicted</b>: terminated gracefully, phase Failed, reason Evicted. Its Deployment creates a replacement on another node. The node also gets the <code>memory-pressure:NoSchedule</code> taint for a while, which only BestEffort pods don’t tolerate.' },
    { run: () => { S.hot = ['api-g']; }, t: 'Survivor: <code>api-g</code>, Guaranteed and under its request. Lesson for JVMs: set memory <b>request = limit</b>. And if usage spikes faster than the kubelet’s check interval, the <b>kernel</b> OOM killer may act first, choosing by <code>oom_score_adj</code>: BestEffort 1000, Burstable in between, Guaranteed −997.' }
  ];
  function draw() {
    stage.innerHTML = ''; const X0 = 20, W = 720; const xm = (g) => X0 + g / CAP * W;
    stage.append(svg('text', { class: 'lt', x: X0, y: 16, text: 'node-7 memory (8.5 Gi): usage by pod, coloured by QoS class' }), svg('rect', { class: 'track', x: X0, y: 24, width: W, height: 30, rx: 5 }));
    let acc = 0; const segs = [['system', 'sys', S.sys]].concat(onNode().map((p) => [p.n, 'q-' + p.q, p.use]));
    segs.forEach(([n, c, u]) => { if (u <= 0) return; stage.append(svg('rect', { class: 'mseg ' + c, x: xm(acc), y: 26, width: Math.max(0, xm(acc + u) - xm(acc) - 1), height: 26 }));
      if (u > 0.7) stage.append(svg('text', { x: xm(acc) + 4, y: 43, 'font-size': 10, fill: 'var(--surface)', 'font-family': 'var(--mono)', text: n })); acc += u; });
    stage.append(svg('line', { class: 'alloc', x1: xm(ALLOC + 0.45), x2: xm(ALLOC + 0.45), y1: 20, y2: 60 }), svg('line', { class: 'thr', x1: xm(THR), x2: xm(THR), y1: 20, y2: 60 }),
      svg('text', { class: 'lt', x: xm(THR) - 150, y: 72, text: 'eviction threshold: 100Mi left →' }));
    const reqSum = S.pods.filter((p) => p.st === 'Running' || p.st.startsWith('OOM')).reduce((a, p) => a + p.req, 0);
    stage.append(svg('text', { class: 'lt', x: X0, y: 72, text: `requests on node: ${reqSum} Gi of ${ALLOC} Gi allocatable` }));
    S.pods.forEach((p, i) => { const x = 20 + i * 146, y = 92; const gone = p.st === 'Evicted' || p.st === 'not created';
      const c = S.dead === p.n || p.st === 'Evicted' ? 'dead' : p.st === 'Pending' ? 'pend' : S.hot.includes(p.n) ? 'hot' : '';
      const g = svg('g', { class: gone && p.st !== 'Evicted' ? 'gone' : '' });
      g.append(svg('rect', { class: 'pcard ' + c, x, y, width: 136, height: 180, rx: 10 }), svg('text', { class: 'nm', x: x + 10, y: y + 22, text: p.n }));
      const bc = p.q === 'G' ? 'var(--k-service)' : p.q === 'B' ? 'var(--k-compute)' : 'var(--warn)';
      g.append(svg('rect', { x: x + 10, y: y + 30, width: 86, height: 16, rx: 8, fill: bc }), svg('text', { class: 'badge', x: x + 17, y: y + 42, text: QN[p.q] }));
      g.append(svg('text', { class: 'sm', x: x + 10, y: y + 64, text: `req ${p.req ? p.req + 'Gi' : '—'}` }), svg('text', { class: 'sm', x: x + 10, y: y + 80, text: `lim ${p.lim ? p.lim + 'Gi' : '—'}` }),
        svg('text', { class: 'sm', x: x + 10, y: y + 96, text: `use ${p.use.toFixed(2)}Gi` }));
      const mx = 3.2; const bx = x + 10, bw = 116; g.append(svg('rect', { class: 'track', x: bx, y: y + 104, width: bw, height: 12, rx: 3 }), svg('rect', { class: 'ubar', x: bx, y: y + 104, width: Math.min(bw, p.use / mx * bw), height: 12, rx: 3, fill: bc }));
      if (p.req) g.append(svg('line', { class: 'req', x1: bx + Math.min(bw, p.req / mx * bw), x2: bx + Math.min(bw, p.req / mx * bw), y1: y + 101, y2: y + 119 }));
      if (p.lim) g.append(svg('line', { x1: bx + Math.min(bw, p.lim / mx * bw), x2: bx + Math.min(bw, p.lim / mx * bw), y1: y + 101, y2: y + 119, stroke: 'var(--err)', 'stroke-width': 2 }));
      if (S.rank && p.st === 'Running') { const over = p.use - p.req; g.append(svg('text', { class: 'sm', x: x + 10, y: y + 136, fill: over > 0 ? 'var(--err)' : 'var(--ok)', text: over > 0 ? `+${over.toFixed(2)} over req` : 'under request' })); }
      const col = p.st === 'Running' ? 'var(--ok)' : p.st === 'Pending' ? 'var(--warn)' : p.st === 'not created' ? 'var(--text-3)' : 'var(--err)';
      g.append(svg('text', { class: 'st', x: x + 10, y: y + 160, fill: col, text: p.st.length > 18 ? 'OOMKilled' : p.st }));
      if (p.st.startsWith('OOM')) g.append(svg('text', { class: 'sm', x: x + 10, y: y + 174, text: 'exit 137, restarted' }));
      stage.append(g); });
    const used = S.sys + onNode().reduce((a, p) => a + p.use, 0);
    stats.innerHTML = ''; const st = (h) => stats.append(el('span', { class: 'w-stat', html: h }));
    st(`node usage <b>${used.toFixed(2)} Gi</b> / ${CAP}`); st(`memory.available <b>${Math.max(0, (CAP - used) * 1024).toFixed(0)} Mi</b>`); st(`MemoryPressure <b>${S.pressure ? 'True' : 'False'}</b>`);
  }
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; S = base(); S.dead = null; S.rank = false; draw(); bStep.disabled = false; say('Press Play or Step. Black tick = request, red tick = limit on each pod’s usage bar.'); }
  function step() { if (k >= steps.length) return false; const s = steps[k++]; s.run(); draw(); say(`<b>${k}/${steps.length}</b> · ` + s.t); if (k >= steps.length) bStep.disabled = true; return true; }
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

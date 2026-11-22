/* Autoscaling (extra): Pending pods → node autoscaler (Cluster Autoscaler or Karpenter) → new node → pods Ready, then scale-down/consolidation. */
IA.widget('autoscaling-nodes', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8s-ca-style')) {
    document.head.append(el('style', { id: 'w-k8s-ca-style', text: `
.w-ca .st { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: all .3s; }
.w-ca .st.on { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-soft); }
.w-ca .st.done { stroke: var(--ok); }
.w-ca .ttl { font: 600 12px var(--sans); fill: var(--text); }
.w-ca .sub { font: 500 10px var(--mono); fill: var(--text-3); }
.w-ca .node { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: all .4s; }
.w-ca .node.new { stroke: var(--accent-2); stroke-width: 2.5; }
.w-ca .node.nr { stroke-dasharray: 5 4; }
.w-ca .node.gone { opacity: .25; stroke-dasharray: 3 3; }
.w-ca .pod { fill: var(--accent); transition: all .5s; }
.w-ca .pod.pend { fill: var(--warn); }
.w-ca .pod.start { fill: var(--accent-2); opacity: .6; }
.w-ca .arrow { stroke: var(--border); stroke-width: 1.5; }
` }));
  }
  let who = 'ca'; let gen = 0; let running = false; let k = 0; let steps = []; let speed = 2600;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const W = 760; const H = 290;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Pipeline from Pending pods to Ready pods, and a cluster with existing and new nodes' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-ca');
  root.append(el('div', { class: 'w-controls' }, seg([['ca', 'Cluster Autoscaler (node groups)'], ['kp', 'Karpenter (NodePools)']], who, (v) => { who = v; reset(); }, 'Node autoscaler')),
    el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr);
  const say = (h, tone) => { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };

  const STAGES = () => [['Pods Pending', 'FailedScheduling'], [who === 'ca' ? 'CA simulates' : 'Karpenter solves', who === 'ca' ? 'template per group' : 'pod requirements'], [who === 'ca' ? 'ASG +2' : 'NodeClaim ×1', who === 'ca' ? 'm5.xlarge ×2' : 'c7i.2xlarge'], ['Node joins', 'NotReady → Ready'], ['Pods start', 'pull · JVM · probe'], ['Scale down', who === 'ca' ? '<50% req, 10 min' : 'consolidation']];
  function draw(st) {
    stage.innerHTML = '';
    STAGES().forEach(([a, b], i) => {
      const x = 8 + i * 125;
      stage.append(svg('rect', { class: 'st ' + (st.stage === i ? 'on' : st.stage > i ? 'done' : ''), x, y: 10, width: 116, height: 50, rx: 9 }),
        svg('text', { class: 'ttl', x: x + 58, y: 31, 'text-anchor': 'middle', text: a }), svg('text', { class: 'sub', x: x + 58, y: 48, 'text-anchor': 'middle', text: b }));
      if (i < 5) stage.append(svg('line', { class: 'arrow', x1: x + 116, x2: x + 125, y1: 35, y2: 35 }));
    });
    // cluster
    const nodes = [{ x: 16, l: 'node-1 (4 vCPU)', pods: 3 }, { x: 196, l: 'node-2 (4 vCPU)', pods: 3 }];
    nodes.forEach((n) => { stage.append(svg('rect', { class: 'node', x: n.x, y: 96, width: 168, height: 120, rx: 10 }), svg('text', { class: 'ttl', x: n.x + 10, y: 116, text: n.l }), svg('text', { class: 'sub', x: n.x + 10, y: 132, text: '3.5 of 3.9 vCPU requested' }));
      for (let p = 0; p < n.pods; p++) stage.append(svg('circle', { class: 'pod', cx: n.x + 30 + p * 40, cy: 172, r: 13 })); });
    const newN = st.newNodes || [];
    newN.forEach((n, i) => { const x = 376 + i * 196;
      stage.append(svg('rect', { class: 'node new ' + (n.state === 'nr' ? 'nr' : n.state === 'gone' ? 'gone' : ''), x, y: 96, width: newN.length > 1 ? 180 : 200, height: 120, rx: 10 }),
        svg('text', { class: 'ttl', x: x + 10, y: 116, text: n.l }), svg('text', { class: 'sub', x: x + 10, y: 132, text: n.state === 'nr' ? 'NotReady · CNI starting' : n.state === 'gone' ? 'drained & terminated' : n.state === 'boot' ? 'booting VM…' : 'Ready' })); });
    // pending / placed pods
    const pend = st.pend || 0; const placed = st.placed || [];
    for (let p = 0; p < pend; p++) stage.append(svg('circle', { class: 'pod pend', cx: 400 + p * 36, cy: 256, r: 12 }));
    if (pend) stage.append(svg('text', { class: 'sub', x: 400 + pend * 36, y: 260, text: 'Pending (1 vCPU request each)' }));
    placed.forEach((p) => stage.append(svg('circle', { class: 'pod ' + (p.ready ? '' : 'start'), cx: p.x, cy: 172, r: 13 })));
    if (!pend && !placed.length && st.stage === -1) stage.append(svg('text', { class: 'sub', x: 400, y: 256, text: 'HPA about to scale 6 → 10' }));
  }
  function plan() {
    const S = []; const ca = who === 'ca';
    const two = (state) => [{ l: 'node-3 (new)', state }, { l: 'node-4 (new)', state }];
    const one = (state) => [{ l: 'node-3 (8 vCPU, new)', state }];
    const nn = (s) => (ca ? two(s) : one(s));
    const slots = ca ? [416, 456, 612, 652] : [406, 446, 486, 526];
    S.push({ st: { stage: 0, pend: 4 }, say: 'The HPA raises replicas from 6 to 10. The scheduler finds no node with 1 vCPU of <b>requests</b> free, so 4 pods are <b>Pending</b> with <code>FailedScheduling: Insufficient cpu</code>. Note: high CPU <i>usage</i> alone would never trigger a node autoscaler.', tone: 'warn' });
    S.push({ st: { stage: 1, pend: 4 }, say: ca ? 'The Cluster Autoscaler (every 10 s by default) runs the scheduler’s logic against a <b>template node</b> for each node group: “if I add one m5.xlarge, would these pods fit?” An <b>expander</b> (least-waste, priority, price…) picks the group. It needs 2 nodes for 4 pods once DaemonSets are counted.' : 'Karpenter batches the pending pods for a moment and reads their combined requirements: CPU/memory requests, architecture, zone, capacity type (spot or on-demand), taints and affinities. It looks for the cheapest instance type in the NodePool that fits them all: here <b>one</b> 8 vCPU node.' });
    S.push({ st: { stage: 2, pend: 4, newNodes: nn('boot') }, say: ca ? 'CA raises the Auto Scaling group’s desired capacity by 2. The cloud provider launches VMs from the group’s launch template. CA doesn’t choose instance types: the node group already fixed them.' : 'Karpenter creates a <code>NodeClaim</code> and launches the instance directly (EC2 Fleet on AWS). There is no node group in between, so instance types can vary per launch.' });
    S.push({ st: { stage: 3, pend: 4, newNodes: nn('nr') }, say: 'The VM boots, the kubelet registers the Node, and it carries the <code>node.kubernetes.io/not-ready</code> taint until the CNI is up. This whole stretch is usually a minute or more and is outside Kubernetes’ control.' });
    S.push({ st: { stage: 4, pend: 0, newNodes: nn('ready'), placed: slots.map((x) => ({ x, ready: false })) }, say: 'The node turns Ready and the scheduler binds the 4 pods. Now come the image pull (pre-pulled or small images help), JVM start-up and the readiness probe. Only then do the pods join the Service’s EndpointSlices.' });
    S.push({ st: { stage: 4, pend: 0, newNodes: nn('ready'), placed: slots.map((x) => ({ x, ready: true })) }, say: 'Pods are Ready and serving. Total delay from the HPA decision: metrics + node provisioning + start-up. For latency-sensitive services keep headroom (placeholder pods with a low PriorityClass) so the wait for a node happens in the background.', tone: 'ok' });
    S.push({ st: { stage: 5, pend: 0, newNodes: ca ? [{ l: 'node-3 (new)', state: 'ready' }, { l: 'node-4 (new)', state: 'gone' }] : [{ l: 'node-3 (8 vCPU, new)', state: 'gone' }], placed: ca ? [{ x: 416, ready: true }, { x: 456, ready: true }] : [] },
      say: ca ? 'Later the load falls and the HPA removes pods. A node whose pods request under 50% of its capacity (<code>--scale-down-utilization-threshold</code>) for 10 minutes (<code>--scale-down-unneeded-time</code>) is drained, respecting PDBs and <code>safe-to-evict</code>, and terminated.' : 'Karpenter <b>consolidation</b> (<code>WhenEmptyOrUnderutilized</code>) notices it can move the remaining pods onto existing capacity, or onto a cheaper node, drains this node within the NodePool’s disruption budgets, and deletes it. <code>karpenter.sh/do-not-disrupt</code> pods block that.', done: true });
    return S;
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = plan(); bStep.disabled = false; draw({ stage: -1 }); say('Two nodes, both full by requests. Press Play.'); }
  function step() { if (k >= steps.length) return false; const s = steps[k++]; draw(s.st); say(s.say, s.tone); if (k >= steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    if (reduced) { while (g === gen && step()); }
    else while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

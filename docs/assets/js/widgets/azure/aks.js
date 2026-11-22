/* AKS: scheduling across system, user and spot node pools with the cluster autoscaler, and a surge upgrade with cordon, drain and PDBs. */
IA.widget('aks', (root, ctx) => {
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
  let mode = 'pools';
  const stage = svg('svg', { viewBox: '0 0 640 336', role: 'img', 'aria-label': 'AKS node pools and scheduling, or a surge upgrade' });
  const segM = seg([['pools', 'Node pools & scheduling'], ['upgrade', 'Surge upgrade']], mode, (v) => { mode = v; reset(); }, 'Mechanism');
  const zrect = (g, id, x, y, w, h, label) => { const r = svg('rect', { class: 'zn', x, y, width: w, height: h, rx: 10 }); g.append(r, svg('text', { class: 'lbl', x: x + 8, y: y + 17, text: label })); Z[id] = { n: r, base: 'zn' }; };
  function build() {
    stage.innerHTML = ''; clearZ();
    const bg = svg('g'); const e = svg('g'); const g = svg('g');
    if (mode === 'pools') {
      node(g, 'cp', 200, 6, 240, 46, 'Control plane (managed)', 'API server · scheduler · etcd');
      node(g, 'pod', 460, 6, 170, 46, 'Deployment orders-api', 'replicas: 3');
      zrect(bg, 'gS', 8, 72, 200, 258, 'system pool · 3 nodes · z1-3');
      zrect(bg, 'gU', 220, 72, 200, 258, 'user pool · autoscale 2–6');
      zrect(bg, 'gP', 432, 72, 200, 258, 'spot pool · autoscale 0–5');
      ['s', 'u', 'p'].forEach((k, j) => { for (let i = 0; i < 3; i++) node(g, k + i, 18 + j * 212, 96 + i * 76, 180, 62, (k === 's' ? 'sys' : k === 'u' ? 'user' : 'spot') + ' node ' + (i + 1), k === 's' ? 'CoreDNS, metrics-server' : '—'); });
      link(e, 'c1', 'cp', 'u0'); link(e, 'c2', 'cp', 'p0');
    } else {
      node(g, 'cp', 180, 6, 280, 46, 'Control plane', 'v1.30');
      zrect(bg, 'gU', 8, 72, 624, 258, 'user pool “apps” · max-surge 1');
      for (let i = 0; i < 3; i++) node(g, 'n' + i, 20 + i * 152, 110, 140, 90, 'node ' + (i + 1), 'v1.30 · 2 pods');
      node(g, 'sg', 476, 110, 144, 90, 'surge node', '—');
      node(g, 'pdb', 20, 240, 600, 60, 'kubectl drain → Eviction API → checks PodDisruptionBudget', 'orders-api: 3 replicas, minAvailable 2 → 1 eviction at a time');
      for (let i = 0; i < 3; i++) link(e, 'l' + i, 'cp', 'n' + i);
      link(e, 'l3', 'cp', 'sg');
    }
    stage.append(bg, e, g, pkt);
  }
  function plan() {
    const A = cum(); const S = [];
    if (mode === 'pools') {
      const hide = { u2: 'gone', p0: 'gone', p1: 'gone', p2: 'gone', c2: 'gone' };
      S.push({ ...A.set({ ...hide, s0: 'ok', s1: 'ok', s2: 'ok', gS: 'hot' }), t: 'Every cluster needs a <b>system</b> node pool for CoreDNS, metrics-server and other add-ons. In production, run it across zones, and taint it <code>CriticalAddonsOnly=true:NoSchedule</code> so app pods stay off it.' });
      S.push({ fly: ['pod', 'cp', 'u0'], ...A.set({ u0: 'ok', u1: 'ok', c1: 'ok', gU: 'hot' }, { u0: 'orders-api ×2', u1: 'orders-api ×1' }), t: 'The scheduler places <code>orders-api</code> on the <b>user</b> pool. A nodeSelector <code>agentpool: apps</code> (or simply the system taint) keeps it there. User pools can have different VM sizes, OS (Linux or Windows) and upgrade timing.' });
      S.push({ ...A.set({ pod: 'warn', u0: 'warn', u1: 'warn' }, { pod: 'replicas: 9 → 3 Pending', u0: 'orders-api ×3 (full)', u1: 'orders-api ×3 (full)' }), t: 'HPA raises replicas to 9. Requests no longer fit, and 3 pods are <b>Pending</b>. The <b>cluster autoscaler</b> sees unschedulable pods and adds a node, which takes minutes, not seconds.', cls: 'warn' });
      S.push({ fly: ['cp', 'u2'], ...A.set({ u2: 'ok', u0: 'ok', u1: 'ok', pod: 'ok' }, { u2: 'orders-api ×3', pod: 'replicas: 9 running' }), t: 'Node 3 joins (2–6 is this pool’s autoscaler range), and the Pending pods schedule. Pods with accurate <b>requests</b> make this work, because the autoscaler and scheduler only see requests, not real usage.', cls: 'ok' });
      S.push({ fly: ['cp', 'p0'], ...A.set({ p0: 'ok', c2: 'ok', gP: 'hot' }, { p0: 'batch-embed job', pod: 'Job: tolerates spot' }), t: 'A batch embedding Job <b>tolerates</b> <code>kubernetes.azure.com/scalesetpriority=spot:NoSchedule</code> and selects the spot pool. Spot pools can scale from zero and cost much less, but nodes can be evicted at any time.' });
      S.push({ ...A.set({ p0: 'bad', c2: 'bad' }, { p0: 'EVICTED by Azure' }), t: '<b>Spot eviction</b>: Azure reclaims the capacity. The Job’s pod dies and is retried. Use spot only for interruptible, checkpointed work. Never for the only replica of anything.', cls: 'err' });
      S.push({ fly: ['cp', 'p1'], ...A.set({ p0: 'gone', p1: 'ok', c2: 'ok' }, { p1: 'batch-embed (retry)' }), t: 'The autoscaler finds spot capacity again (or doesn’t: spot pools need a fallback plan), and the Job resumes from its checkpoint.', cls: 'ok' });
      return S;
    }
    S.push({ ...A.set({ cp: 'hot', sg: 'gone', l3: 'gone' }, { cp: 'v1.30 → v1.31' }), t: '<code>az aks upgrade -k 1.31</code>: the <b>control plane</b> is upgraded first. Minor versions can’t be skipped, so 1.29 → 1.31 means two upgrades. Check removed APIs first.' });
    S.push({ ...A.set({ cp: 'ok', sg: 'hot', l3: 'hot' }, { cp: 'v1.31', sg: 'v1.31 (buffer)' }), t: 'Node pool upgrade: AKS adds <b>surge</b> (buffer) nodes on the new version. More surge means a faster upgrade but needs more quota and IPs; Microsoft Learn suggests 33% for production pools.' });
    S.push({ fly: ['n0', 'sg'], ...A.set({ n0: 'warn', sg: 'ok', pdb: 'hot' }, { n0: 'cordoned · draining', sg: 'v1.31 · 2 pods' }), t: 'Node 1 is <b>cordoned</b> and <b>drained</b>. Each pod is evicted through the Eviction API, which respects PodDisruptionBudgets: only one orders-api pod may be down at a time. Evicted pods reschedule onto the surge node.', cls: 'warn' });
    S.push({ ...A.set({ n0: 'ok', pdb: '' }, { n0: 'v1.31 (now buffer)' }), t: 'The drained node is <b>reimaged</b> to v1.31 and becomes the buffer for the next node. The cycle repeats node by node.', cls: 'ok' });
    S.push({ ...A.set({ n1: 'bad', pdb: 'bad' }, { n1: 'drain stuck', pdb: 'payments PDB: minAvailable 3 of 3 replicas → 0 evictions allowed' }), t: 'What goes wrong: another team set <code>minAvailable: 3</code> on its 3-replica <code>payments</code> Deployment, which has a pod on node 2. No eviction is ever allowed, the drain times out, and the upgrade fails or stalls on that node.', cls: 'err' });
    S.push({ fly: ['n1', 'n0'], ...A.set({ n1: 'ok', n2: 'ok', pdb: 'ok', sg: 'gone', l3: 'gone' }, { n1: 'v1.31', n2: 'v1.31', n0: 'v1.31', pdb: 'fixed: maxUnavailable 1 · upgrade completes', sg: '' }), t: 'With <code>maxUnavailable: 1</code> the drain proceeds, all nodes reach v1.31, and the last buffer node is deleted. Separately, keep <b>node images</b> current (<code>--node-image-only</code> or the node OS auto-upgrade channel) inside a planned maintenance window.', cls: 'ok' });
    return S;
  }
  const intro = () => (mode === 'pools' ? 'Press Play: schedule pods across system, user and spot pools, trigger the cluster autoscaler, then survive a spot eviction.' : 'Press Play: upgrade the control plane, then the node pool with a surge node, cordon and drain. Watch a bad PDB stall it.');
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), controls, narr);
  const reset = makeStepper(plan, intro, build);
  reset();
});

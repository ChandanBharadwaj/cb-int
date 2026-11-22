/* AKS networking: where pod IPs come from in kubenet, Azure CNI (flat) and Azure CNI Overlay, and what that means for routing, SNAT and subnet size. */
IA.widget('aks-net', (root, ctx) => {
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
  let mode = 'overlay';
  const stage = svg('svg', { viewBox: '0 0 640 330', role: 'img', 'aria-label': 'Where pod IPs come from in kubenet, Azure CNI and Azure CNI Overlay' });
  const segM = seg([['kubenet', 'kubenet (legacy)'], ['cni', 'Azure CNI (pods in VNet)'], ['overlay', 'Azure CNI Overlay']], mode, (v) => { mode = v; reset(); }, 'Network plugin');
  const stats = el('div', { class: 'w-stats' });
  const stat = (h) => { stats.innerHTML = ''; h.forEach((x) => stats.append(el('span', { class: 'w-stat', html: x }))); };
  const IP = {
    kubenet: { a: ['10.244.0.5', '10.244.0.6'], b: ['10.244.1.7', '10.244.1.8'], ra: 'pod CIDR 10.244.0.0/24', rb: 'pod CIDR 10.244.1.0/24' },
    cni: { a: ['10.0.1.10', '10.0.1.11'], b: ['10.0.1.40', '10.0.1.41'], ra: 'pre-allocated VNet IPs', rb: 'pre-allocated VNet IPs' },
    overlay: { a: ['10.244.0.5', '10.244.0.6'], b: ['10.244.1.7', '10.244.1.8'], ra: 'overlay /24 10.244.0.0', rb: 'overlay /24 10.244.1.0' }
  };
  function build() {
    stage.innerHTML = ''; clearZ();
    const bg = svg('g'); const e = svg('g'); const g = svg('g'); const ip = IP[mode];
    const r = svg('rect', { class: 'zn', x: 8, y: 8, width: 624, height: 316, rx: 12 }); Z.vnet = { n: r, base: 'zn' };
    const s = svg('rect', { class: 'zn', x: 20, y: 44, width: 420, height: 268, rx: 10 }); Z.sub = { n: s, base: 'zn' };
    bg.append(r, s, svg('text', { class: 'lbl', x: 18, y: 28, text: 'VNet 10.0.0.0/16' }), svg('text', { class: 'lbl', x: 30, y: 62, text: 'subnet aks-nodes 10.0.1.0/24' }));
    node(g, 'nA', 32, 76, 196, 50, 'node A', '10.0.1.4');
    node(g, 'nB', 236, 76, 196, 50, 'node B', mode === 'cni' ? '10.0.1.35' : '10.0.1.5');
    node(g, 'pA1', 32, 150, 94, 50, 'pod', ip.a[0]); node(g, 'pA2', 134, 150, 94, 50, 'pod', ip.a[1]);
    node(g, 'pB1', 236, 150, 94, 50, 'pod', ip.b[0]); node(g, 'pB2', 338, 150, 94, 50, 'pod', ip.b[1]);
    node(g, 'rA', 32, 230, 196, 44, ip.ra);
    node(g, 'rB', 236, 230, 196, 44, ip.rb);
    node(g, 'vm', 462, 76, 160, 50, 'VM (other subnet)', '10.0.2.4');
    node(g, 'rt', 462, 176, 160, 60, mode === 'kubenet' ? 'route table (UDR)' : mode === 'cni' ? 'subnet IP usage' : 'Azure overlay routing', mode === 'kubenet' ? 'one route per node' : mode === 'cni' ? '—' : 'no UDRs to manage');
    link(e, 'a1', 'nA', 'pA1'); link(e, 'a2', 'nA', 'pA2'); link(e, 'b1', 'nB', 'pB1'); link(e, 'b2', 'nB', 'pB2');
    edge(e, 'pp', 'M126 200 C 180 222, 240 222, 283 200');
    edge(e, 'pv', 'M80 150 C 120 40, 400 40, 462 100');
    stage.append(bg, e, g, pkt); stat([]);
  }
  function plan() {
    const A = cum(); const S = [];
    S.push({ ...A.set({ nA: 'ok', nB: 'ok', sub: 'hot' }), run: () => stat(['node IPs from the VNet subnet']), t: 'In all three models, <b>nodes</b> get IPs from your VNet subnet. The difference is where <b>pod</b> IPs come from.' });
    if (mode === 'kubenet') {
      S.push({ ...A.set({ pA1: 'warn', pA2: 'warn', pB1: 'warn', pB2: 'warn', rA: 'warn', rB: 'warn' }), run: () => stat(['pod IPs: <b>not</b> in the VNet']), t: '<b>kubenet</b>: pods get IPs from a separate pod CIDR, one /24 per node. They aren’t VNet addresses, so the subnet only needs room for nodes.' });
      S.push({ fly: ['pA2', 'rt', 'pB1'], ...A.set({ rt: 'hot', pp: 'hot' }), t: 'Pod-to-pod across nodes goes through a <b>route table</b> that AKS maintains: “10.244.1.0/24 → node B”. Route-table limits cap cluster size (Microsoft Learn documents 400 nodes), and bringing your own subnet means managing the UDR association.', cls: 'warn' });
      S.push({ fly: ['pA1', 'vm'], ...A.set({ pv: 'warn', vm: 'warn' }), t: 'Pod → VM: traffic is <b>SNATed</b> to node A’s IP. The VM can’t open a connection to <code>10.244.0.5</code>; inbound must go through a Service or load balancer.', cls: 'warn' });
      S.push({ ...A.set({ rt: 'bad' }, { rt: 'retirement announced' }), run: () => stat(['use Overlay for new clusters']), t: 'Microsoft has announced kubenet’s retirement (see Microsoft Learn for the date), and features such as Windows node pools and some network policies don’t support it. <b>New clusters: use Azure CNI Overlay.</b>', cls: 'err' });
      return S;
    }
    if (mode === 'cni') {
      S.push({ ...A.set({ pA1: 'ok', pA2: 'ok', pB1: 'ok', pB2: 'ok', rA: 'warn', rB: 'warn' }), run: () => stat(['pod IPs: <b>real VNet IPs</b>']), t: '<b>Azure CNI (flat / node-subnet mode)</b>: every pod gets a real IP from the VNet subnet. Each node <b>pre-allocates</b> IPs for its max pods when it is created.' });
      S.push({ fly: ['pA1', 'vm'], ...A.set({ pv: 'ok', vm: 'ok' }), t: 'The VM (or on-prem, over VPN or ExpressRoute) can reach <code>10.0.1.10</code> directly, with no NAT. That is useful when something outside must call pods directly, or for firewall rules per pod IP.', cls: 'ok' });
      S.push({ ...A.set({ rt: 'warn', sub: 'warn' }, { rt: '(1 + maxPods) per node' }), run: () => stat(['50 nodes × (1 + 30) = <b>1,550 IPs</b>', '/24 holds <b>251</b> usable']), t: 'The cost is <b>IP consumption</b>: each node takes 1 + maxPods addresses up front. 50 nodes with maxPods 30 need ~1,550 IPs, and a /24 has 251 usable.', cls: 'warn' });
      S.push({ ...A.set({ rt: 'bad', sub: 'bad' }, { rt: 'subnet full' }), t: 'Scale-out and upgrades (surge nodes need IPs too) fail with subnet-full errors. Fixes: a bigger subnet planned up front, the dynamic pod-subnet variant, or <b>Overlay</b>.', cls: 'err' });
      return S;
    }
    S.push({ ...A.set({ pA1: 'ok', pA2: 'ok', pB1: 'ok', pB2: 'ok', rA: 'ok', rB: 'ok' }), run: () => stat(['pod IPs: private overlay CIDR']), t: '<b>Azure CNI Overlay</b>: pods get IPs from a private overlay CIDR (for example 10.244.0.0/16), with a /24 per node. The VNet only spends IPs on nodes, and you can reuse the same pod CIDR in many clusters.' });
    S.push({ fly: ['pA2', 'rt', 'pB1'], ...A.set({ rt: 'ok', pp: 'ok' }), t: 'Pod-to-pod across nodes is routed by Azure’s network for the overlay, so there are no route tables to manage. Performance is comparable to flat CNI.', cls: 'ok' });
    S.push({ fly: ['pA1', 'vm'], ...A.set({ pv: 'warn', vm: 'warn' }), t: 'Pod → outside the cluster: <b>SNAT to the node IP</b>, as with kubenet. Outside clients can’t reach pod IPs directly; expose workloads through Services, an internal load balancer or ingress.', cls: 'warn' });
    S.push({ ...A.set({ vnet: 'hot' }), run: () => stat(['scales to large clusters', 'small node subnet']), t: '<b>The usual default for new clusters.</b> Pair it with Cilium (Azure CNI powered by Cilium) for eBPF data path and network policy. Choose flat CNI only when pods truly need routable VNet IPs.', cls: 'ok' });
    return S;
  }
  const intro = () => ({ kubenet: 'kubenet: pods hide behind node IPs and a route table. Press Play.', cni: 'Azure CNI (flat): every pod takes a VNet IP. Press Play and watch the subnet fill.', overlay: 'Azure CNI Overlay: pods use a private overlay range. Press Play.' }[mode]);
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), stats, controls, narr);
  const reset = makeStepper(plan, intro, build);
  reset();
});

/* Services: one connection through DNS → kube-proxy rules (iptables/IPVS) → DNAT → pod, for ClusterIP, NodePort, LoadBalancer and headless. */
IA.widget('services', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8s-svc-style')) {
    document.head.append(el('style', { id: 'w-k8s-svc-style', text: `
.w-svc .bx { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: all .25s; }
.w-svc .bx.hot { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-soft); }
.w-svc .bx.err { stroke: var(--err); stroke-width: 2.5; }
.w-svc .bx.ok { stroke: var(--ok); stroke-width: 2.5; }
.w-svc .bx.off { stroke-dasharray: 5 4; opacity: .55; }
.w-svc .ttl { font: 600 13px var(--sans); fill: var(--text); }
.w-svc .sub { font: 500 11px var(--mono); fill: var(--text-3); }
.w-svc .rl { font: 500 11.5px var(--mono); fill: var(--text-2); }
.w-svc .rl.hot { fill: var(--accent); font-weight: 700; }
.w-svc .rl.err { fill: var(--err); font-weight: 700; }
.w-svc .rlbg { fill: transparent; }
.w-svc .rlbg.hot { fill: var(--accent-soft); }
.w-svc .wire { stroke: var(--border); stroke-width: 1.5; fill: none; stroke-dasharray: 4 4; }
.w-svc .pod { cursor: pointer; }
.w-svc table.t td.y { color: var(--ok); font-weight: 600; } .w-svc table.t td.n { color: var(--err); font-weight: 600; }
` }));
  }
  const PODS = [
    { n: 'orders-a', ip: '10.244.1.17', node: 'node-1', ready: true },
    { n: 'orders-b', ip: '10.244.2.31', node: 'node-2', ready: true },
    { n: 'orders-c', ip: '10.244.2.32', node: 'node-2', ready: true }];
  const NODES = ['node-1', 'node-2', 'node-3'];
  const NODE_IP = { 'node-1': '10.0.1.11', 'node-2': '10.0.1.12', 'node-3': '10.0.1.13' };
  const VIP = '10.96.12.34';
  let type = 'ClusterIP'; let etp = 'Cluster'; let entry = 'node-3'; let mode = 'iptables';
  let gen = 0; let running = false; let k = 0; let steps = []; let speed = 2600;

  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segType = seg([['ClusterIP', 'ClusterIP'], ['NodePort', 'NodePort'], ['LoadBalancer', 'LoadBalancer'], ['Headless', 'Headless']], type, (v) => { type = v; reset(); }, 'Service type');
  const segEtp = seg([['Cluster', 'externalTrafficPolicy: Cluster'], ['Local', 'externalTrafficPolicy: Local']], etp, (v) => { etp = v; reset(); }, 'External traffic policy');
  const segEntry = seg(NODES.map((n) => [n, 'enter on ' + n]), entry, (v) => { entry = v; reset(); }, 'Entry node');
  const segMode = seg([['iptables', 'kube-proxy: iptables'], ['ipvs', 'kube-proxy: IPVS']], mode, (v) => { mode = v; reset(); }, 'kube-proxy mode');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1300, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const extRow = el('div', { class: 'w-controls' }, segEtp, segEntry);
  const W = 760; const H = 390;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Client on the left, kube-proxy rules on a node in the middle, three pods on the right' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const sliceHost = el('div', { class: 'tscroll' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-svc');
  root.append(el('div', { class: 'w-controls' }, segType, segMode), extRow,
    el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr,
    el('h3', { class: 'sub-h', text: 'EndpointSlice orders-x7k2p (click a pod to fail its readiness probe)', style: { fontSize: '14px', margin: '12px 0 6px' } }), sliceHost, stats);

  const say = (h, tone) => { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const ready = () => PODS.filter((p) => p.ready);
  const ext = () => type === 'NodePort' || type === 'LoadBalancer';
  const where = () => (ext() ? entry : 'node-1');
  const letter = (p) => p.n.slice(-1).toUpperCase();

  // ---------- rule text for the node that handles the packet ----------
  function rules(node) {
    const R = []; const rd = ready();
    if (type === 'Headless') {
      R.push({ id: 'none', t: 'clusterIP: None → kube-proxy writes no rules' });
      R.push({ id: 'none2', t: 'client dials pod IPs; the CNI routes them' });
      return R;
    }
    if (mode === 'ipvs') {
      R.push({ id: 'dev', t: `kube-ipvs0: ${VIP} bound (dummy interface)` });
      if (ext()) R.push({ id: 'np', t: `ipset KUBE-NODE-PORT-TCP: 30080 → virtual server` });
      R.push({ id: 'vs', t: `IPVS TCP ${ext() ? NODE_IP[node] + ':30080' : VIP + ':80'} rr` });
      const pool = ext() && etp === 'Local' ? rd.filter((p) => p.node === node) : rd;
      if (!pool.length) R.push({ id: 'rej', t: 'no real servers → connection fails' });
      pool.forEach((p) => R.push({ id: 'sep' + letter(p), t: `  → ${p.ip}:8080  Masq  weight 1`, pod: p }));
      return R;
    }
    if (ext()) {
      R.push({ id: 'np', t: 'KUBE-NODEPORTS --dport 30080 → KUBE-EXT' });
      if (etp === 'Cluster') R.push({ id: 'ext', t: 'KUBE-EXT  mark for SNAT → KUBE-SVC' });
      else R.push({ id: 'ext', t: 'KUBE-EXT  → KUBE-SVL (local endpoints only)' });
    } else R.push({ id: 'svc', t: `KUBE-SERVICES -d ${VIP} :80 → KUBE-SVC` });
    const local = ext() && etp === 'Local';
    const pool = local ? rd.filter((p) => p.node === node) : rd;
    const chain = local ? 'KUBE-SVL' : 'KUBE-SVC';
    if (!pool.length) { R.push({ id: 'rej', t: local ? `${chain}  (no local endpoints) → DROP` : `no endpoints → REJECT (icmp port-unreachable)` }); return R; }
    pool.forEach((p, i) => { const left = pool.length - i; R.push({ id: 'jmp' + letter(p), t: `${chain}  ${left > 1 ? '--probability ' + (1 / left).toFixed(3) : '(always)'} → KUBE-SEP-${letter(p)}`, pod: p }); });
    pool.forEach((p) => R.push({ id: 'sep' + letter(p), t: `KUBE-SEP-${letter(p)}  DNAT → ${p.ip}:8080`, pod: p }));
    return R;
  }

  // ---------- drawing ----------
  const RX = 196; const RY = 96; const RW = 352; const LH = 22;
  const PX = 588; const PW = 162; const PY = [86, 186, 286]; const PH = 70;
  let layer = null;
  const box = (x, y, w, h, cls) => svg('rect', { class: 'bx ' + (cls || ''), x, y, width: w, height: h, rx: 10 });
  const txt = (x, y, t, cls, anchor) => svg('text', { x, y, class: cls || 'ttl', 'text-anchor': anchor || 'start', text: t });
  function draw(st) {
    st = st || {};
    stage.innerHTML = '';
    const node = st.node || where();
    // client side
    const cl = clientPos();
    stage.append(box(cl.x - 70, cl.y - 30, 140, 60, st.client || ''), txt(cl.x, cl.y - 6, ext() ? 'external client' : 'checkout pod', 'ttl', 'middle'), txt(cl.x, cl.y + 12, ext() ? '203.0.113.7' : '10.244.1.40 · node-1', 'sub', 'middle'));
    if (type === 'LoadBalancer') { stage.append(box(10, 250, 150, 64, st.lb || ''), txt(85, 276, 'cloud LB', 'ttl', 'middle'), txt(85, 294, '34.120.8.9:443', 'sub', 'middle'));
      stage.append(svg('path', { class: 'wire', d: 'M85 166 L85 250' })); }
    if (!ext()) { stage.append(box(200, 14, 160, 50, st.dns || ''), txt(280, 36, 'CoreDNS', 'ttl', 'middle'), txt(280, 53, '10.96.0.10:53', 'sub', 'middle')); }
    // rules box
    const R = rules(node);
    const rh = Math.max(150, 40 + R.length * LH + 10);
    stage.append(box(RX, RY, RW, rh, st.rules || ''), txt(RX + 12, RY + 22, `${node} · ${type === 'Headless' ? 'no Service rules' : mode === 'ipvs' ? 'kube-proxy (IPVS)' : 'kube-proxy (iptables, nat table)'}`, 'ttl'));
    R.forEach((r, i) => {
      const y = RY + 34 + i * LH; const hot = (st.hi || []).includes(r.id);
      stage.append(svg('rect', { class: 'rlbg' + (hot ? ' hot' : ''), x: RX + 6, y, width: RW - 12, height: LH - 2, rx: 4 }), txt(RX + 12, y + 15, r.t, 'rl' + (hot ? (r.id === 'rej' ? ' err' : ' hot') : '')));
      r.y = y + LH / 2;
    });
    // pods
    PODS.forEach((p, i) => {
      const y = PY[i]; const cls = !p.ready ? 'off' : (st.pod === i ? (st.podTone || 'hot') : '');
      const g = svg('g', { class: 'pod', role: 'button', tabindex: 0, 'aria-label': `${p.n}: ${p.ready ? 'ready' : 'not ready'}. Click to toggle readiness.` });
      g.append(box(PX, y, PW, PH, cls), txt(PX + 10, y + 20, p.n, 'ttl'), txt(PX + 10, y + 38, p.ip + ':8080', 'sub'),
        txt(PX + 10, y + 56, p.node + (p.ready ? ' · Ready' : ' · NOT ready'), 'sub'));
      const tog = () => { p.ready = !p.ready; reset(true, p); };
      g.addEventListener('click', tog); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tog(); } });
      stage.append(g);
    });
    layer = svg('g'); stage.append(layer);
    return R;
  }
  function clientPos() { return type === 'LoadBalancer' ? { x: 85, y: 136 } : { x: 85, y: 190 }; }
  const podPt = (p) => ({ x: PX, y: PY[PODS.indexOf(p)] + PH / 2 });
  function fly(pts, color) {
    return new Promise((res) => {
      const dot = svg('circle', { r: 7, fill: color || 'var(--accent)', class: 'packet', style: `color:${color || 'var(--accent)'}` });
      layer.append(dot);
      const end = pts[pts.length - 1];
      if (reduced) { dot.setAttribute('cx', end.x); dot.setAttribute('cy', end.y); res(); return; }
      const segs = []; let tot = 0;
      for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); segs.push(d); tot += d; }
      const dur = Math.min(1400, speed * 0.45); const t0 = performance.now();
      const tick = (t) => { let f = Math.min(1, (t - t0) / dur) * tot; let i = 0;
        while (i < segs.length - 1 && f > segs[i]) { f -= segs[i]; i++; }
        const a = pts[i]; const b = pts[i + 1]; const r = segs[i] ? Math.min(1, f / segs[i]) : 1;
        dot.setAttribute('cx', a.x + (b.x - a.x) * r); dot.setAttribute('cy', a.y + (b.y - a.y) * r);
        if (t - t0 < dur) requestAnimationFrame(tick); else res(); };
      requestAnimationFrame(tick);
    });
  }

  // ---------- plan one connection ----------
  function plan() {
    const S = []; const cl = clientPos(); const rd = ready();
    const rIn = { x: RX, y: RY + 45 };
    if (type === 'Headless') {
      S.push({ st: { dns: 'hot', client: 'hot' }, fly: [{ x: cl.x + 70, y: cl.y - 10 }, { x: 200, y: 40 }], say: `Lookup <code>orders-headless.shop.svc.cluster.local</code>. There is no ClusterIP, so CoreDNS answers with one A record per <b>ready</b> endpoint: <code>${rd.map((p) => p.ip).join(', ') || '(none)'}</code>.` });
      if (!rd.length) { S.push({ st: { dns: 'err' }, say: 'No ready endpoints, so the answer has no A records. The client cannot connect at all. (<code>publishNotReadyAddresses: true</code> would list them anyway.)', tone: 'err' }); return S; }
      const p = rd[Math.floor(Math.random() * rd.length)];
      S.push({ st: { client: 'hot', pod: PODS.indexOf(p) }, fly: [{ x: cl.x + 70, y: cl.y }, { x: 380, y: 370 }, podPt(p)], say: `The client picks <code>${p.ip}</code> itself and connects straight to it. kube-proxy is not involved. gRPC <code>round_robin</code> would open a connection to <i>every</i> address and spread requests.` });
      S.push({ st: { pod: PODS.indexOf(p), podTone: 'ok' }, say: 'Catch: the JVM caches the DNS answer (<code>networkaddress.cache.ttl</code>, 30 s by default without a security manager), and many clients resolve only once. After a rollout they may keep dialling IPs of pods that no longer exist.', tone: 'warn' });
      return S;
    }
    let node = where(); let snat = false;
    if (!ext()) {
      S.push({ st: { dns: 'hot', client: 'hot' }, fly: [{ x: cl.x + 70, y: cl.y - 10 }, { x: 200, y: 40 }], say: `DNS: <code>orders.shop.svc.cluster.local</code> → <code>${VIP}</code>. This is a <b>virtual</b> IP. No interface owns it and nothing listens on it.` });
      S.push({ st: { client: 'hot', rules: 'hot', hi: [mode === 'ipvs' ? 'vs' : 'svc'] }, fly: [{ x: cl.x + 70, y: cl.y }, rIn], say: `The SYN to <code>${VIP}:80</code> leaves the pod and hits netfilter on <b>node-1</b>, the client’s own node. ${mode === 'ipvs' ? 'IPVS owns the VIP (bound to the <code>kube-ipvs0</code> dummy device) and looks up its virtual server in a hash table.' : '<code>KUBE-SERVICES</code> matches the destination IP and port and jumps to the Service chain.'}` });
    } else {
      if (type === 'LoadBalancer') {
        const healthy = etp === 'Local' ? NODES.filter((n) => rd.some((p) => p.node === n)) : NODES.slice();
        S.push({ st: { client: 'hot', lb: 'hot' }, fly: [{ x: cl.x, y: cl.y + 30 }, { x: 85, y: 250 }], say: `The client hits the cloud LB. ${etp === 'Local' ? `It health-checks <code>healthCheckNodePort</code> on each node; only nodes with a ready local pod pass: <b>${healthy.join(', ') || 'none'}</b>.` : 'With <code>Cluster</code> every node passes the health check, so every node is a target.'}` });
        if (!healthy.length) { S.push({ st: { lb: 'err' }, say: 'No healthy targets. The LB drops or resets the connection.', tone: 'err' }); return S; }
        if (!healthy.includes(node)) node = healthy[0];
        entry = node; [...segEntry.children].forEach((b) => b.classList.toggle('on', b.textContent === 'enter on ' + node));
        S.push({ st: { lb: 'hot', rules: 'hot', node, hi: [mode === 'ipvs' ? 'np' : 'np'] }, fly: [{ x: 160, y: 282 }, rIn], say: `The LB forwards to <code>${NODE_IP[node]}:30080</code> (${node}), the Service’s NodePort.` });
      } else {
        S.push({ st: { client: 'hot', rules: 'hot', hi: ['np'] }, fly: [{ x: cl.x + 70, y: cl.y }, rIn], say: `The client connects to <code>${NODE_IP[node]}:30080</code> on <b>${node}</b>. Every node opens the NodePort, even nodes with no pods.` });
      }
    }
    const R = rules(node);
    const local = ext() && etp === 'Local';
    const pool = local ? rd.filter((p) => p.node === node) : rd;
    if (!pool.length) {
      S.push({ st: { rules: 'err', node, hi: ['rej'] }, say: local ? `<code>externalTrafficPolicy: Local</code>: ${node} may only use endpoints on itself, and it has none. The packet is <b>dropped</b>, so the client times out.` : 'The Service has <b>no ready endpoints</b>. kube-proxy installed a REJECT rule, so the client gets an immediate “connection refused”. Check the EndpointSlice and the selector.', tone: 'err' });
      return S;
    }
    if (ext() && mode === 'iptables') S.push({ st: { rules: 'hot', node, hi: ['ext'] }, say: etp === 'Cluster' ? 'Cluster policy: the packet is marked for <b>SNAT</b> in case it leaves this node. Any ready pod in the cluster may be chosen.' : 'Local policy: jump to <code>KUBE-SVL-…</code>, which lists only this node’s endpoints. No SNAT, so the pod sees the real client IP.' });
    const p = pool[Math.floor(Math.random() * pool.length)];
    const pi = pool.indexOf(p);
    if (mode === 'ipvs') S.push({ st: { rules: 'hot', node, hi: ['vs', 'sep' + letter(p)] }, say: `IPVS picks real server <code>${p.ip}:8080</code> with round-robin. It rewrites the destination in the kernel (NAT “Masq” mode). The ${pool.length} real servers come from the EndpointSlice.` });
    else {
      const chain = R.filter((r) => r.id.startsWith('jmp')).slice(0, pi + 1).map((r) => r.id);
      const ps = pool.map((_, i) => (pool.length - i > 1 ? (1 / (pool.length - i)).toFixed(3) : 'always')).join(' → ');
      S.push({ st: { rules: 'hot', node, hi: chain }, say: `Random pick: the jump rules are tried in order with probabilities ${ps}. ${pi ? `The first ${pi === 1 ? 'rule did' : pi + ' rules did'} not fire; ` : ''}<b>KUBE-SEP-${letter(p)}</b> wins. Every endpoint gets 1/${pool.length} of new connections.` });
      S.push({ st: { rules: 'hot', node, hi: ['sep' + letter(p)] }, say: `<code>KUBE-SEP-${letter(p)}</code> DNATs the destination to <code>${p.ip}:8080</code>, and conntrack records the translation.` });
    }
    snat = ext() && etp === 'Cluster' && p.node !== node;
    const src = ext() ? (snat ? `${NODE_IP[node]} (SNAT, client IP lost)` : '203.0.113.7 (real client)') : '10.244.1.40';
    S.push({ st: { rules: 'hot', node, pod: PODS.indexOf(p), hi: [] }, fly: [{ x: RX + RW, y: RY + 60 }, podPt(p)], say: `The CNI routes the packet to <b>${p.n}</b> on ${p.node}${p.node !== node ? ' (a cross-node hop)' : ''}. The pod sees source <code>${src}</code>.`, src });
    S.push({ st: { pod: PODS.indexOf(p), podTone: 'ok', node }, fly: [podPt(p), { x: RX + RW, y: RY + 80 }, { x: cl.x + 70, y: cl.y + 10 }], color: 'var(--ok)', say: `The reply goes back through conntrack, which rewrites the source back to ${ext() ? 'the address the client dialled' : `<code>${VIP}:80</code>`}. Every later packet on this connection goes to ${p.n}: balancing is <b>per connection</b>. Press Play again to open a new one.`, tone: 'ok', src });
    return S;
  }

  function renderSlice(changed) {
    const tb = el('tbody');
    PODS.forEach((p) => tb.append(el('tr', { style: changed === p && !reduced ? { animation: 'capin .4s ease both' } : null },
      el('td', { text: p.ip }), el('td', { text: p.node }), el('td', { class: p.ready ? 'y' : 'n', text: String(p.ready) }), el('td', { class: p.ready ? 'y' : 'n', text: String(p.ready) }), el('td', { text: 'false' }))));
    sliceHost.innerHTML = '';
    sliceHost.append(el('table', { class: 't rg' }, el('thead', null, el('tr', null, ['address', 'nodeName', 'ready', 'serving', 'terminating'].map((h) => el('th', { text: h })))), tb));
  }
  function renderStats(src) {
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `ready endpoints <b>${ready().length}</b> / 3` }),
      el('span', { class: 'w-stat', html: `ClusterIP <b>${type === 'Headless' ? 'None' : VIP}</b>` }),
      ext() ? el('span', { class: 'w-stat', html: `nodePort <b>30080</b>` } ) : null,
      src ? el('span', { class: 'w-stat', html: `source IP seen by pod <b>${src}</b>` }) : null);
  }
  function reset(fromToggle, changed) {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    extRow.style.display = ext() ? '' : 'none';
    segEntry.style.display = type === 'NodePort' ? '' : 'none';
    segMode.style.display = type === 'Headless' ? 'none' : '';
    draw(); steps = plan(); bStep.disabled = false; renderSlice(changed); renderStats();
    if (fromToggle && changed) say(`<b>${changed.n}</b> is now ${changed.ready ? 'ready again' : '<b>not ready</b> (its readiness probe failed)'}. The EndpointSlice controller flips <code>ready</code>, and kube-proxy on every node rewrites its rules: ${ready().length} endpoint${ready().length === 1 ? '' : 's'} left.${changed.ready ? '' : ' The pod keeps running; it just stops getting <i>new</i> connections.'}`, changed.ready ? 'ok' : 'warn');
    else say({ ClusterIP: 'Press Play to open one TCP connection from the checkout pod to <code>orders</code>.', NodePort: 'NodePort: every node listens on 30080. Pick the entry node, then Play.', LoadBalancer: 'LoadBalancer = cloud LB → NodePort → the same Service rules. Play to follow it.', Headless: 'Headless: no virtual IP, no kube-proxy rules. DNS hands out pod IPs.' }[type]);
  }
  async function step() {
    if (k >= steps.length) return false;
    const s = steps[k++]; const g = gen;
    draw(s.st); say(s.say, s.tone); renderStats(s.src);
    if (s.fly) await fly(s.fly, s.color);
    if (g !== gen) return false;
    if (k >= steps.length) bStep.disabled = true;
    return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', () => { PODS.forEach((p) => { p.ready = true; }); reset(); });
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    if (reduced) { while (g === gen && k < steps.length) await step(); }
    else while (running && g === gen && await step()) { if (k < steps.length) await sleep(speed * 0.6); }
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

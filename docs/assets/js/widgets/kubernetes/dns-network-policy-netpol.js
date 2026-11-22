/* DNS & NetworkPolicy (extra): toggle policies and test connections; egress is checked at the sender, ingress at the receiver. */
IA.widget('dns-network-policy-netpol', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8s-np-style')) {
    document.head.append(el('style', { id: 'w-k8s-np-style', text: `
.w-np .ns { fill: none; stroke: var(--border); stroke-width: 1.5; stroke-dasharray: 6 4; }
.w-np .nsl { font: 600 11px var(--mono); fill: var(--text-3); }
.w-np .bx { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: all .25s; }
.w-np .bx.hot { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-soft); }
.w-np .bx.ok { stroke: var(--ok); stroke-width: 2.5; }
.w-np .bx.err { stroke: var(--err); stroke-width: 2.5; }
.w-np .bx.iso { stroke-width: 2.5; stroke: var(--warn); }
.w-np .ttl { font: 600 12.5px var(--sans); fill: var(--text); }
.w-np .sub { font: 500 10px var(--mono); fill: var(--text-3); }
.w-np .gate { font: 700 16px var(--sans); }
.w-np .pols { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 6px; margin-bottom: 10px; }
.w-np .pol { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-2); border-radius: 9px; padding: 7px 10px; font-size: 12.5px; cursor: pointer; }
.w-np .pol b { font-family: var(--mono); font-size: 12px; color: var(--text); display: block; }
.w-np .pol.on { border-color: var(--accent); background: var(--accent-soft); color: var(--text); }
.w-np .pol.on b::before { content: '● '; color: var(--accent); }
.w-np .pol:not(.on) b::before { content: '○ '; color: var(--text-3); }
` }));
  }
  const PODS = {
    frontend: { ns: 'shop', app: 'frontend', x: 36, y: 60 },
    orders: { ns: 'shop', app: 'orders', x: 186, y: 60 },
    postgres: { ns: 'shop', app: 'postgres', x: 336, y: 60 },
    prometheus: { ns: 'monitoring', app: 'prometheus', x: 36, y: 262 },
    coredns: { ns: 'kube-system', app: 'kube-dns', x: 290, y: 262 },
    stripe: { ns: null, app: null, x: 560, y: 262, ext: true, label: 'api.stripe.com' } };
  // peer: { ns?: name (undefined = policy namespace), app?: label (undefined = any pod) }
  const POLS = [
    { id: 'P1', name: 'default-deny-ingress', d: 'all shop pods · Ingress · no rules', sel: null, type: 'Ingress', rules: [], on: true },
    { id: 'P2', name: 'orders-from-frontend', d: 'app=orders ← app=frontend :8080', sel: 'orders', type: 'Ingress', rules: [{ peer: { app: 'frontend' }, port: 8080 }], on: true },
    { id: 'P3', name: 'postgres-from-orders', d: 'app=postgres ← app=orders :5432', sel: 'postgres', type: 'Ingress', rules: [{ peer: { app: 'orders' }, port: 5432 }], on: true },
    { id: 'P4', name: 'allow-prometheus', d: 'all shop pods ← ns monitoring AND app=prometheus :8081', sel: null, type: 'Ingress', rules: [{ peer: { ns: 'monitoring', app: 'prometheus' }, port: 8081 }], on: false },
    { id: 'P5', name: 'default-deny-egress', d: 'all shop pods · Egress · no rules', sel: null, type: 'Egress', rules: [], on: false },
    { id: 'P6', name: 'allow-dns', d: 'all shop pods → kube-system/kube-dns :53 UDP+TCP', sel: null, type: 'Egress', rules: [{ peer: { ns: 'kube-system', app: 'kube-dns' }, port: 53 }], on: false },
    { id: 'P7', name: 'egress-within-shop', d: 'all shop pods → any pod in shop', sel: null, type: 'Egress', rules: [{ peer: {} }], on: false }];
  const CONNS = [
    ['frontend', 'orders', 8080], ['orders', 'postgres', 5432], ['frontend', 'postgres', 5432],
    ['prometheus', 'orders', 8081], ['orders', 'coredns', 53], ['orders', 'stripe', 443]];
  let conn = 0; let cni = 'cilium'; let gen = 0; let running = false; let k = 0; let steps = []; let speed = 2400;

  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const label = (c) => `${c[0]} → ${PODS[c[1]].label || c[1]}:${c[2]}`;
  const segConn = seg(CONNS.map((c, i) => [i, label(c)]), conn, (v) => { conn = v; reset(); }, 'Connection');
  const segCni = seg([['cilium', 'CNI: Calico / Cilium (enforces)'], ['flannel', 'CNI: plain flannel (no policy)']], cni, (v) => { cni = v; reset(); }, 'CNI');
  const pols = el('div', { class: 'pols' });
  POLS.forEach((p) => { const b = el('button', { class: 'pol' + (p.on ? ' on' : ''), 'aria-pressed': String(p.on) }, el('b', { text: `${p.id} ${p.name}` }), el('span', { text: p.d }));
    b.addEventListener('click', () => { p.on = !p.on; b.classList.toggle('on', p.on); b.setAttribute('aria-pressed', String(p.on)); reset(); }); pols.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const W = 760; const H = 350;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Namespaces shop, monitoring and kube-system with pods, plus an external host' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-np');
  root.append(el('div', { class: 'tiny', text: 'Policies in namespace shop (click to toggle):', style: { marginBottom: '6px' } }), pols,
    el('div', { class: 'w-controls' }, segCni), el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'test' }), segConn),
    el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, stats);
  const say = (h, tone) => { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };

  // ---------- policy evaluation ----------
  const selects = (p, pod) => pod.ns === 'shop' && (p.sel == null || pod.app === PODS[p.sel].app);
  const peerOk = (peer, other) => !other.ext && (peer.ns || 'shop') === other.ns && (peer.app == null || peer.app === other.app);
  function check(dir, pod, other, port) {
    if (cni === 'flannel') return { ok: true, why: 'the CNI does not implement NetworkPolicy, so nothing is enforced', pols: [] };
    const ps = POLS.filter((p) => p.on && p.type === dir && selects(p, pod));
    if (!ps.length) return { ok: true, iso: false, why: `no ${dir} policy selects it, so it is <b>not isolated</b> for ${dir.toLowerCase()}`, pols: [] };
    const allow = ps.filter((p) => p.rules.some((r) => peerOk(r.peer, other) && (r.port == null || r.port === port)));
    if (allow.length) return { ok: true, iso: true, why: `isolated by ${ps.map((p) => p.id).join(', ')}; allowed by <b>${allow.map((p) => p.id + ' ' + p.name).join(', ')}</b>`, pols: allow };
    return { ok: false, iso: true, why: `isolated by ${ps.map((p) => p.id).join(', ')}, and <b>no rule</b> allows ${other.ext ? 'that external host' : other.app + ' in ' + other.ns} on :${port}${dir === 'Egress' && other.ext ? ' (core NetworkPolicy can only allow external traffic by <code>ipBlock</code> CIDR, not by name)' : ''}`, pols: [] };
  }

  // ---------- drawing ----------
  let layer;
  const PW = 130; const PH = 58;
  const center = (p) => ({ x: p.x + PW / 2, y: p.y + PH / 2 });
  const isoOf = (pod) => cni !== 'flannel' && pod.ns === 'shop' && POLS.some((p) => p.on && selects(p, pod));
  function draw(st) {
    st = st || {}; stage.innerHTML = '';
    const nsBox = (x, y, w, h, t) => stage.append(svg('rect', { class: 'ns', x, y, width: w, height: h, rx: 12 }), svg('text', { class: 'nsl', x: x + 10, y: y + 16, text: t }));
    nsBox(16, 30, 470, 120, 'namespace shop'); nsBox(16, 232, 190, 106, 'namespace monitoring'); nsBox(270, 232, 190, 106, 'namespace kube-system'); nsBox(540, 232, 200, 106, 'outside the cluster');
    Object.entries(PODS).forEach(([id, p]) => {
      const cls = st[id] || (isoOf(p) ? 'iso' : '');
      stage.append(svg('rect', { class: 'bx ' + cls, x: p.x, y: p.y, width: PW, height: PH, rx: 10 }),
        svg('text', { class: 'ttl', x: p.x + PW / 2, y: p.y + 24, 'text-anchor': 'middle', text: p.label || id }),
        svg('text', { class: 'sub', x: p.x + PW / 2, y: p.y + 42, 'text-anchor': 'middle', text: p.ext ? '203.0.113.50' : (isoOf(p) ? 'isolated' : 'not isolated') }));
    });
    if (st.gate) stage.append(svg('text', { class: 'gate', x: st.gate.x, y: st.gate.y, 'text-anchor': 'middle', fill: st.gate.ok ? 'var(--ok)' : 'var(--err)', text: st.gate.ok ? '✓' : '✗' }));
    stage.append(svg('text', { class: 'sub', x: 520, y: 60, text: 'orange outline = isolated' }), svg('text', { class: 'sub', x: 520, y: 78, text: 'by at least one policy' }));
    layer = svg('g'); stage.append(layer);
  }
  function fly(pts, color) {
    return new Promise((res) => {
      const c = color || 'var(--accent)';
      const dot = svg('circle', { r: 7, fill: c, class: 'packet', style: `color:${c}` }); layer.append(dot);
      const end = pts[pts.length - 1];
      if (reduced) { dot.setAttribute('cx', end.x); dot.setAttribute('cy', end.y); res(); return; }
      const segs = []; let tot = 0;
      for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); segs.push(d); tot += d; }
      const dur = Math.min(1300, speed * 0.5); const t0 = performance.now();
      const tick = (t) => { let f = Math.min(1, (t - t0) / dur) * tot; let i = 0;
        while (i < segs.length - 1 && f > segs[i]) { f -= segs[i]; i++; }
        const a = pts[i]; const b = pts[i + 1]; const r = segs[i] ? Math.min(1, f / segs[i]) : 1;
        dot.setAttribute('cx', a.x + (b.x - a.x) * r); dot.setAttribute('cy', a.y + (b.y - a.y) * r);
        if (t - t0 < dur) requestAnimationFrame(tick); else res(); };
      requestAnimationFrame(tick);
    });
  }
  function plan() {
    const [s, d, port] = CONNS[conn]; const A = PODS[s]; const B = PODS[d]; const S = [];
    const a = center(A); const b = center(B); const midp = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + (A.y === B.y ? -46 : 0) };
    S.push({ st: { [s]: 'hot' }, say: `<b>${s}</b> opens a connection to <b>${B.label || d}</b> on :${port}${d === 'coredns' ? ' (a DNS lookup; every name resolution needs this)' : ''}. A policy can only affect a pod it <i>selects</i>. Egress is checked on the sender, ingress on the receiver.` });
    const eg = check('Egress', A, B, port);
    S.push({ st: { [s]: eg.ok ? 'ok' : 'err', gate: { x: a.x, y: A.y - 6, ok: eg.ok } }, say: `Egress at <b>${s}</b>: ${eg.why}.`, tone: eg.ok ? '' : 'err' });
    if (!eg.ok) { S.push({ st: { [s]: 'err', gate: { x: a.x, y: A.y - 6, ok: false } }, fly: [a, { x: a.x + (midp.x - a.x) * 0.4, y: a.y + (midp.y - a.y) * 0.4 }], color: 'var(--err)', say: `Dropped as it leaves ${s}. The app sees a timeout${d === 'coredns' ? ', so Java throws <code>UnknownHostException</code> for every name, including services you did allow' : ''}. Fix: add an egress allow rule${d === 'coredns' ? ' (P6 allow-dns)' : d === 'stripe' ? ' with an <code>ipBlock</code>, or use a CNI with FQDN policies' : ' (for example P7)'}.`, tone: 'err', done: true }); return S; }
    S.push({ st: { [s]: 'ok', [d]: 'hot' }, fly: [a, midp, b], say: `The packet crosses the network to ${B.label || d}${B.ns && B.ns !== A.ns ? ` in namespace ${B.ns}` : ''}.` });
    if (B.ext) { S.push({ st: { [s]: 'ok', [d]: 'ok' }, say: 'External hosts are not pods, so there is no ingress check on our side. The connection succeeds, and replies are allowed automatically because policies are stateful.', tone: 'ok', done: true }); return S; }
    const ig = check('Ingress', B, A, port);
    S.push({ st: { [d]: ig.ok ? 'ok' : 'err', gate: { x: b.x, y: B.y - 6, ok: ig.ok } }, say: `Ingress at <b>${d}</b>: ${ig.why}.${!ig.ok && s === 'prometheus' ? ' Turn on P4: monitoring is in another namespace, so the rule must use a <code>namespaceSelector</code>.' : ''}`, tone: ig.ok ? 'ok' : 'err' });
    S.push({ st: { [d]: ig.ok ? 'ok' : 'err' }, say: ig.ok ? `Connected. Replies on this connection are allowed implicitly. Policies are unioned: ${ig.pols.length > 1 ? 'several policies allowed it, and none could “deny” it.' : 'removing one allow never needs a matching deny.'}${cni === 'flannel' ? ' (Nothing was enforced at all: that is the flannel trap.)' : ''}` : `Dropped at ${d}. The client times out (no RST). Kubelet probes still pass, because traffic from the pod’s own node is always allowed, so the pod looks healthy.`, tone: ig.ok ? 'ok' : 'err', done: true });
    return S;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; draw(); steps = plan(); bStep.disabled = false;
    const on = POLS.filter((p) => p.on);
    stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `policies on <b>${on.length}</b>` }), el('span', { class: 'w-stat', html: `deny rules in the API <b>0</b>` }), el('span', { class: 'w-stat', html: `enforced <b>${cni === 'flannel' ? 'no' : 'yes'}</b>` }));
    say(`Test <b>${label(CONNS[conn])}</b>. Press Play.`);
  }
  async function step() {
    if (k >= steps.length) return false;
    const s = steps[k++]; const g = gen;
    draw(s.st); say(s.say, s.tone);
    if (s.fly) await fly(s.fly, s.color);
    if (g !== gen) return false;
    if (k >= steps.length) bStep.disabled = true;
    return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    if (reduced) { while (g === gen && k < steps.length) await step(); }
    else while (running && g === gen && await step()) { if (k < steps.length) await sleep(speed * 0.5); }
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

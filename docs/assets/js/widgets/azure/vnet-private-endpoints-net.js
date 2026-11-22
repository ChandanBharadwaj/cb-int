/* VNet extras: NSG inbound rule evaluation by priority (first match wins, defaults, stateful return), and hub-spoke peering, UDRs through a hub firewall, and gateway transit. */
IA.widget('vnet-private-endpoints-net', (root, ctx) => {
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
  let mode = 'nsg';
  const stage = svg('svg', { viewBox: '0 0 640 330', role: 'img', 'aria-label': 'NSG rules evaluated in priority order, and hub-spoke routing' });
  const segM = seg([['nsg', 'NSG evaluation'], ['hub', 'Hub-spoke routing']], mode, (v) => { mode = v; reset(); }, 'Mechanism');
  const RULES = [['r1', '100 · Allow · TCP 443', 'from AzureFrontDoor.Backend'], ['r2', '200 · Allow · TCP 8080', 'from VirtualNetwork'], ['r3', '300 · Deny · TCP 22', 'from Internet'],
    ['d1', '65000 · Allow (default)', 'AllowVnetInBound'], ['d2', '65001 · Allow (default)', 'AllowAzureLoadBalancerInBound'], ['d3', '65500 · Deny (default)', 'DenyAllInBound']];
  function build() {
    stage.innerHTML = ''; clearZ();
    const bg = svg('g'); const e = svg('g'); const g = svg('g');
    const reg = (id, x, y, w, h, label) => { const r = svg('rect', { class: 'zn', x, y, width: w, height: h, rx: 12 }); bg.append(r, svg('text', { class: 'lbl', x: x + 10, y: y + 16, text: label })); Z[id] = { n: r, base: 'zn' }; };
    if (mode === 'nsg') {
      node(g, 'src', 10, 135, 160, 60, 'packet', '—');
      reg('nsg', 190, 4, 270, 322, 'nsg-apps (inbound, by priority)');
      RULES.forEach(([id, t, s], i) => node(g, id, 200, 26 + i * 50, 250, 44, t, s));
      node(g, 'vm', 480, 135, 150, 60, 'orders-api', 'snet-apps 10.1.0.0/24');
      edge(e, 'eIn', 'M170 165 L 200 165'); edge(e, 'eOut', 'M450 165 L 480 165');
    } else {
      node(g, 'onp', 10, 30, 150, 56, 'On-premises', '192.168.0.0/16');
      reg('hub', 176, 6, 296, 150, 'vnet-hub 10.0.0.0/16');
      node(g, 'gw', 190, 40, 128, 56, 'VPN / ER gateway', 'gateway transit');
      node(g, 'fw', 332, 40, 128, 56, 'Azure Firewall', '10.0.1.4');
      node(g, 'inet', 490, 40, 140, 56, 'Internet', 'egress');
      reg('s1', 8, 180, 300, 146, 'spoke 1');
      reg('s2', 332, 180, 300, 146, 'spoke 2');
      node(g, 'a1', 24, 220, 268, 60, 'orders-api', '10.1.0.0/16 · rt-spoke1');
      node(g, 'a2', 348, 220, 268, 60, 'payments-api', '10.2.0.0/16 · rt-spoke2');
      hlink(e, 'eOn', 'onp', 'gw'); hlink(e, 'eGF', 'gw', 'fw'); hlink(e, 'eFI', 'fw', 'inet');
      edge(e, 'p1', 'M254 96 C 254 160, 158 170, 158 220'); edge(e, 'p2', 'M396 96 C 396 160, 482 170, 482 220');
      hlink(e, 'eD', 'a1', 'a2');
    }
    stage.append(bg, e, g, pkt);
  }
  const ruleState = (checked, hit, cls) => { const o = {}; RULES.forEach(([id], i) => { o[id] = i < checked ? 'dim' : i === hit ? cls : ''; }); if (hit < 0) RULES.forEach(([id]) => { o[id] = ''; }); return o; };
  function plan() {
    const A = cum(); const S = [];
    if (mode === 'nsg') {
      const pk = (label, rules, hit, ok, t, cls) => S.push({ fly: ['src', RULES[hit][0]], ...A.set({ ...ruleState(rules, hit, ok ? 'ok' : 'bad'), src: 'hot', eIn: 'hot', vm: ok ? 'ok' : 'bad', eOut: ok ? 'ok' : 'bad' }, { src: label }), t, cls });
      pk('Front Door → :443', 0, 0, true, 'A request from Front Door’s back end on 443. Rules are checked from the <b>lowest number</b> up. Rule 100 matches the <code>AzureFrontDoor.Backend</code> service tag: <b>allowed</b>, and no further rules are read.', 'ok');
      pk('10.2.0.4 (peered) → :8080', 1, 1, true, 'From a VM in a peered spoke on 8080. Rule 100 doesn’t match (wrong source, wrong port). Rule 200 does: peered address space counts as <code>VirtualNetwork</code>. <b>Allowed.</b>', 'ok');
      pk('203.0.113.9 → :22', 2, 2, false, 'SSH from the internet. 100 and 200 don’t match; rule 300 denies it explicitly. <b>Dropped</b>, silently: there is no reject message.', 'err');
      pk('203.0.113.9 → :5432', 5, 5, false, 'Postgres port from the internet. None of your rules match, and neither do the default allows (it isn’t VNet or Load Balancer traffic), so the last default, <b>DenyAllInBound</b> (65500), drops it.', 'err');
      S.push({ fly: ['vm', 'src'], ...A.set({ ...ruleState(0, -1), src: 'ok', vm: 'ok', eOut: 'ok', eIn: 'ok' }, { src: '← response to Front Door' }), t: 'NSGs are <b>stateful</b>: the response to the allowed 443 request goes back out without any outbound rule. For inbound traffic the subnet NSG is evaluated first, then the NIC’s NSG; both must allow.', cls: 'ok' });
      S.push({ fly: ['src', 'd2'], ...A.set({ ...ruleState(4, 4, 'ok'), src: 'hot', vm: 'ok' }, { src: 'Azure LB probe' }), t: 'Watch the defaults: a custom “deny all” at priority 4000 would also block the Azure Load Balancer health probe allowed at 65001, and your backend would be marked down. Allow the <code>AzureLoadBalancer</code> tag explicitly above any broad deny.', cls: 'warn' });
      return S;
    }
    S.push({ ...A.set({ p1: 'ok', p2: 'ok', eD: 'dim' }), t: '<b>Hub-spoke</b>: each spoke is peered with the hub. Peering gives low-latency private connectivity between <b>exactly two</b> VNets.' });
    S.push({ fly: ['a1', 'a2'], ...A.set({ eD: 'bad', a2: 'bad', a1: 'warn' }, { a1: 'calls 10.2.0.10 → timeout' }), t: 'orders-api calls payments-api. There is no route from spoke 1 to spoke 2: peering is <b>not transitive</b>, so the hub doesn’t forward traffic between spokes by itself.', cls: 'err' });
    S.push({ ...A.set({ eD: 'dim', a1: 'hot', a2: 'hot' }, { a1: 'UDR 10.0.0.0/8 → 10.0.1.4', a2: 'UDR 10.0.0.0/8 → 10.0.1.4' }), t: 'Attach a <b>route table</b> to both spokes’ subnets: other private ranges (and usually 0.0.0.0/0) → the firewall’s private IP, next hop type <code>VirtualAppliance</code>.' });
    S.push({ fly: ['a1', 'fw', 'a2'], ...A.set({ p1: 'hot', p2: 'hot', fw: 'ok', a1: 'ok', a2: 'ok' }), t: 'Now spoke-to-spoke traffic goes through the hub firewall, which allows it by policy (orders → payments on 443) and logs it. Return traffic follows the same path, so routing stays symmetric.', cls: 'ok' });
    S.push({ fly: ['a1', 'fw', 'inet'], ...A.set({ eFI: 'ok', inet: 'ok' }), t: 'The 0.0.0.0/0 route sends internet egress through the firewall too, which lets you allow only the FQDNs your apps need (Maven mirrors, an LLM API, your SaaS).', cls: 'ok' });
    S.push({ fly: ['onp', 'gw', 'a1'], ...A.set({ onp: 'ok', eOn: 'ok', gw: 'ok' }), t: 'On-premises reaches the spokes through the hub’s VPN or ExpressRoute gateway: <code>allowGatewayTransit</code> on the hub side of each peering, <code>useRemoteGateways</code> on the spoke side. One gateway serves every spoke.', cls: 'ok' });
    S.push({ ...A.set({}), t: 'Put shared DNS (DNS Private Resolver, private DNS zones) in the hub as well, so every spoke and on-premises resolve private endpoints the same way. At larger scale, Azure Virtual WAN manages this topology for you.', cls: 'ok' });
    return S;
  }
  const intro = () => (mode === 'nsg' ? 'Inbound NSG on snet-apps. Press Play to send six packets.' : 'A hub with a firewall and two spokes. Press Play.');
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), controls, narr);
  const reset = makeStepper(plan, intro, build, 3000);
  reset();
});

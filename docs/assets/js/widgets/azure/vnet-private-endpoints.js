/* Private endpoint DNS: public name → privatelink CNAME → private IP via a linked private DNS zone; the unlinked-zone failure, a service endpoint, and resolution from on-premises. */
IA.widget('vnet-private-endpoints', (root, ctx) => {
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
  let mode = 'pe';
  const stage = svg('svg', { viewBox: '0 0 640 330', role: 'img', 'aria-label': 'DNS resolution of a storage account name to a private endpoint IP' });
  const segM = seg([['pe', 'Private endpoint + linked zone'], ['nolink', 'Zone not linked'], ['se', 'Service endpoint'], ['onprem', 'From on-premises']], mode, (v) => { mode = v; reset(); }, 'Case');
  const ans = el('div', { class: 'codebox', style: { marginTop: '8px' } });
  const show = (lines) => { ans.innerHTML = ''; ans.append(el('pre', { html: IA.highlight(lines.join('\n'), 'bash') })); };
  const NAME = 'stordersprod.blob.core.windows.net';
  function build() {
    stage.innerHTML = ''; clearZ();
    const bg = svg('g'); const e = svg('g'); const g = svg('g');
    const reg = (id, x, y, w, h, label) => { const r = svg('rect', { class: 'zn', x, y, width: w, height: h, rx: 12 }); bg.append(r, svg('text', { class: 'lbl', x: x + 10, y: y + 16, text: label })); Z[id] = { n: r, base: 'zn' }; };
    reg('vnet', 2, 4, 196, 322, mode === 'onprem' ? 'Azure: hub + spoke' : 'vnet-orders (spoke)');
    node(g, 'app', 14, 30, 172, 56, mode === 'onprem' ? 'orders-api' : 'orders-api', mode === 'se' ? 'snet-apps (SE: Storage)' : 'snet-apps');
    node(g, 'res', 14, 140, 172, 56, mode === 'onprem' ? 'DNS Private Resolver' : 'Azure DNS', mode === 'onprem' ? 'inbound 10.0.5.4 (hub)' : '168.63.129.16');
    node(g, 'pe', 14, 250, 172, 56, 'Private endpoint', mode === 'se' ? '(none)' : 'snet-pe · 10.1.2.5');
    node(g, 'pub', 235, 30, 180, 56, 'Public DNS', 'blob.core.windows.net');
    node(g, 'pz', 235, 140, 180, 56, 'Private DNS zone', 'privatelink.blob…');
    node(g, 'pip', 235, 250, 180, 56, 'Public endpoint', '20.60.144.4');
    node(g, 'onp', 460, 30, 170, 56, mode === 'onprem' ? 'Laptop on VPN' : 'Laptop on internet', mode === 'onprem' ? 'corp network' : 'outside Azure');
    node(g, 'st', 460, 140, 170, 56, 'stordersprod', mode === 'se' ? 'firewall: allow snet-apps' : 'public access: Disabled');
    if (mode === 'onprem') node(g, 'cd', 460, 250, 170, 56, 'Corporate DNS', 'fwd blob.core.windows.net');
    link(e, 'eQ', 'app', 'res'); hlink(e, 'eP', 'res', 'pub'); hlink(e, 'eZ', 'res', 'pz');
    edge(e, 'eC', 'M100 250 C 100 225, 120 225, 120 196');
    edge(e, 'eT', 'M186 278 C 330 330, 440 230, 460 168');
    edge(e, 'eI', 'M415 278 C 440 278, 440 168, 460 168');
    edge(e, 'eA', 'M186 58 C 215 58, 210 278, 235 278');
    hlink(e, 'eO', 'onp', 'pub'); edge(e, 'eOI', 'M545 86 C 545 200, 430 250, 415 268');
    if (mode === 'onprem') { edge(e, 'eCR', 'M460 290 C 330 330, 230 220, 186 168'); edge(e, 'eV', 'M630 58 C 640 58, 640 278, 630 278'); }
    stage.append(bg, e, g, pkt);
    show(['$ nslookup ' + NAME, '# press Play']);
  }
  const off = (ids) => { const o = {}; ids.forEach((i) => { o[i] = 'dim'; }); return o; };
  function plan() {
    const A = cum(); const S = [];
    if (mode === 'pe' || mode === 'nolink') {
      const linked = mode === 'pe';
      S.push({ fly: ['app', 'res'], ...A.set({ ...off(['onp', 'eO', 'eOI']), app: 'hot', eQ: 'hot', res: 'hot' }), run: () => show(['$ nslookup ' + NAME, ';; asking 168.63.129.16 …']), t: 'The Spring app opens <code>https://' + NAME + '</code>. The JVM asks the VNet’s DNS: Azure-provided DNS at <b>168.63.129.16</b>.' });
      S.push({ fly: ['res', 'pub', 'res'], ...A.set({ pub: 'ok', eP: 'ok' }), run: () => show(['$ nslookup ' + NAME, NAME + '  CNAME  stordersprod.privatelink.blob.core.windows.net']),
        t: 'Public DNS answers with a <b>CNAME</b> to <code>stordersprod.privatelink.blob.core.windows.net</code>. Azure adds this alias automatically once the account has a private endpoint.' });
      if (linked) {
        S.push({ fly: ['res', 'pz', 'res'], ...A.set({ pz: 'ok', eZ: 'ok' }, { pz: 'A stordersprod → 10.1.2.5' }), run: () => show(['$ nslookup ' + NAME, NAME + '  CNAME  stordersprod.privatelink.blob.core.windows.net', 'stordersprod.privatelink.blob.core.windows.net  A  10.1.2.5   # from the linked private zone']),
          t: 'The resolver checks private DNS zones <b>linked to this VNet</b>. <code>privatelink.blob.core.windows.net</code> is linked and has an A record (kept in sync by the endpoint’s zone group): <b>10.1.2.5</b>.', cls: 'ok' });
        S.push({ fly: ['res', 'app'], ...A.set({ app: 'ok', res: 'ok' }), t: 'The app gets a private IP for the <b>normal public name</b>. No connection-string change, and the TLS certificate (issued for <code>*.blob.core.windows.net</code>) still validates.', cls: 'ok' });
        S.push({ fly: ['app', 'res', 'pe', 'st'], ...A.set({ pe: 'ok', st: 'ok', eC: 'ok', eT: 'ok' }), t: 'Traffic goes to the private endpoint’s NIC in <code>snet-pe</code> and on to the storage account over Private Link. It never touches the public endpoint, so public access can stay <b>disabled</b>.', cls: 'ok' });
        S.push({ fly: ['onp', 'pub', 'onp'], ...A.set({ onp: 'warn', eO: 'warn' }), run: () => show(['# from a laptop on the internet', NAME + '  CNAME  stordersprod.privatelink.blob.core.windows.net', 'stordersprod.privatelink…  CNAME  blob.ams23prdstr05a.store.core.windows.net', 'blob.ams23prdstr05a.store.core.windows.net  A  20.60.144.4']),
          t: 'Outside the VNet the same name follows the CNAME chain to the <b>public IP</b>. Same name, different answer depending on where you ask.' });
        S.push({ fly: ['onp', 'pip', 'st'], ...A.set({ pip: 'bad', eOI: 'bad', eI: 'bad', onp: 'bad' }), t: 'And the public endpoint refuses: public network access is disabled, so the laptop gets 403. That is the goal.', cls: 'ok' });
        return S;
      }
      S.push({ ...A.set({ pz: 'bad', eZ: 'bad' }, { pz: 'linked to vnet-hub only' }), t: 'The zone exists, but it is linked only to the <b>hub</b> VNet. This VNet’s resolver can’t see it, so it keeps following the public chain.', cls: 'err' });
      S.push({ fly: ['res', 'pub', 'res', 'app'], ...A.set({ app: 'warn' }), run: () => show(['$ nslookup ' + NAME, NAME + '  CNAME  stordersprod.privatelink.blob.core.windows.net', 'stordersprod.privatelink…  CNAME  blob.ams23prdstr05a.store.core.windows.net', 'blob.ams23prdstr05a.store.core.windows.net  A  20.60.144.4   # public!']),
        t: 'The app gets the <b>public</b> IP, 20.60.144.4.', cls: 'warn' });
      S.push({ fly: ['app', 'pip', 'st'], ...A.set({ eA: 'bad', pip: 'bad', eI: 'bad', st: 'bad', app: 'bad' }, { app: '403 AuthorizationFailure' }), t: 'The request reaches the public endpoint, where public access is disabled: <b>403</b> (or a timeout if egress is blocked). The private endpoint is healthy and unused.', cls: 'err' });
      S.push({ fly: ['res', 'pz', 'res', 'app'], ...A.set({ pz: 'ok', eZ: 'ok', app: 'ok', st: 'ok', pip: 'dim', eA: 'dim', eI: 'dim' }, { pz: 'linked: hub + vnet-orders', app: 'resolves 10.1.2.5' }), run: () => show(['$ az network private-dns link vnet create -z privatelink.blob.core.windows.net -n link-vnet-orders …', '$ nslookup ' + NAME, '… A  10.1.2.5']),
        t: 'Fix: add a virtual network link from the zone to <code>vnet-orders</code> (or point the spoke at a central DNS resolver). Always test with <code>nslookup</code> <b>from the workload</b>.', cls: 'ok' });
      return S;
    }
    if (mode === 'se') {
      S.push({ ...A.set({ ...off(['pe', 'pz', 'eZ', 'eC', 'eT', 'onp', 'eO']), app: 'hot' }), t: 'No private endpoint this time. Instead, <code>snet-apps</code> has a <b>service endpoint</b> for <code>Microsoft.Storage</code>, and the storage firewall allows that subnet.' });
      S.push({ fly: ['app', 'res', 'pub', 'res', 'app'], ...A.set({ res: 'ok', pub: 'ok', eQ: 'ok', eP: 'ok' }), run: () => show(['$ nslookup ' + NAME, '… A  20.60.144.4    # still the public IP, no privatelink CNAME']), t: 'DNS is untouched: the name resolves to the <b>public IP</b>. There is no private IP and no DNS work.' });
      S.push({ fly: ['app', 'pip', 'st'], ...A.set({ eA: 'ok', pip: 'ok', eI: 'ok', st: 'ok', app: 'ok' }), t: 'Traffic to that public IP takes an optimised route over the Azure backbone, and arrives with the <b>subnet’s identity</b> as its source. The firewall rule “allow vnet-orders/snet-apps” matches.', cls: 'ok' });
      S.push({ fly: ['onp', 'pip', 'st'], ...A.set({ onp: 'bad', eOI: 'bad', pip: 'warn' }), t: 'Limits: an on-premises or peered-VNet client doesn’t come from that subnet, so it is refused (or you have to open the public firewall to it). And the subnet can reach <b>any</b> storage account over the same path unless a service endpoint policy restricts it.', cls: 'warn' });
      return S;
    }
    S.push({ fly: ['onp', 'cd'], ...A.set({ ...off(['app', 'eA', 'eQ', 'pip', 'eI', 'eO', 'eOI']), onp: 'hot', eV: 'hot', cd: 'hot' }), run: () => show(['# laptop on VPN', '$ nslookup ' + NAME, ';; asking corporate DNS …']), t: 'An engineer on the corporate VPN asks <b>corporate DNS</b> for the normal public name.' });
    S.push({ fly: ['cd', 'res'], ...A.set({ eCR: 'hot', res: 'hot' }), t: 'Corporate DNS has a <b>conditional forwarder for the public zone</b> <code>blob.core.windows.net</code> pointing to the DNS Private Resolver’s inbound endpoint in the hub (10.0.5.4). Forwarding only <code>privatelink.blob…</code> would not catch this query.' });
    S.push({ fly: ['res', 'pub', 'res'], ...A.set({ pub: 'ok', eP: 'ok' }), run: () => show(['$ nslookup ' + NAME, NAME + '  CNAME  stordersprod.privatelink.blob.core.windows.net']), t: 'The resolver runs inside Azure, so it uses Azure DNS: public DNS returns the <code>privatelink</code> CNAME…' });
    S.push({ fly: ['res', 'pz', 'res'], ...A.set({ pz: 'ok', eZ: 'ok', res: 'ok' }, { pz: 'A stordersprod → 10.1.2.5' }), run: () => show(['$ nslookup ' + NAME, NAME + '  CNAME  stordersprod.privatelink.blob.core.windows.net', 'stordersprod.privatelink.blob.core.windows.net  A  10.1.2.5']), t: '…and the private zone, linked to the hub VNet where the resolver lives, returns <b>10.1.2.5</b>.', cls: 'ok' });
    S.push({ fly: ['res', 'cd', 'onp'], ...A.set({ eCR: 'ok', cd: 'ok', onp: 'ok' }), t: 'The answer flows back to the laptop. 168.63.129.16 itself is only reachable from inside Azure, which is why on-premises needs an inbound endpoint or a forwarder VM.', cls: 'ok' });
    S.push({ fly: ['onp', 'pe', 'st'], ...A.set({ pe: 'ok', eT: 'ok', st: 'ok' }), t: 'The laptop connects to 10.1.2.5 over VPN or ExpressRoute → hub → peering → the private endpoint. The storage account still has public access disabled.', cls: 'ok' });
    return S;
  }
  const intro = () => ({ pe: 'A private endpoint with a correctly linked zone. Press Play to follow the lookup.', nolink: 'The zone exists but isn’t linked to this VNet. Press Play.', se: 'A service endpoint instead of a private endpoint. Press Play.', onprem: 'A laptop on the corporate network. Press Play.' }[mode]);
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), controls, narr, ans);
  const reset = makeStepper(plan, intro, build, 3000);
  reset();
});

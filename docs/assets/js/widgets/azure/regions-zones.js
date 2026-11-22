/* Regions & zones: fail a zone under zonal vs zone-redundant deployments, fail a region and fail over to its pair, plus a composite SLA calculator. */
IA.widget('regions-zones', (root, ctx) => {
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
  let mode = 'zr';
  const stage = svg('svg', { viewBox: '0 0 640 372', role: 'img', 'aria-label': 'A region with three availability zones, and its paired region' });
  const segM = seg([['zonal', 'Zonal (pinned to zone 1)'], ['zr', 'Zone-redundant'], ['region', 'Region outage + pair']], mode, (v) => { mode = v; reset(); }, 'Deployment style');
  const zr = {};
  function build() {
    stage.innerHTML = ''; clearZ();
    const bg = svg('g'); const e = svg('g'); const g = svg('g');
    const reg = (id, x, y, w, h, label) => { const r = svg('rect', { class: 'zn', x, y, width: w, height: h, rx: 12 }); bg.append(r, svg('text', { class: 'lbl', x: x + 10, y: y + 18, text: label })); Z[id] = { n: r, base: 'zn' }; };
    reg('rW', 8, 56, 436, 310, 'West Europe (primary region)');
    reg('rN', 452, 56, 180, 310, 'North Europe (its pair)');
    [0, 1, 2].forEach((i) => reg('z' + (i + 1), 18 + i * 142, 128, 132, 228, 'Zone ' + (i + 1)));
    node(g, 'fd', 220, 6, 200, 38, 'Front Door', 'global entry, health probes');
    node(g, 'lb', 128, 76, 196, 40, 'Load balancer / App Service', 'zone-redundant front end');
    [0, 1, 2].forEach((i) => { node(g, 'a' + (i + 1), 28 + i * 142, 162, 112, 42, 'app', 'instance');
      node(g, 'd' + (i + 1), 28 + i * 142, 270, 112, 46, 'Postgres', '—'); });
    node(g, 'aN', 466, 162, 152, 42, 'app', 'warm standby');
    node(g, 'dN', 466, 270, 152, 46, 'Postgres', 'read replica (async)');
    link(e, 'eF', 'fd', 'lb'); [1, 2, 3].forEach((i) => link(e, 'eL' + i, 'lb', 'a' + i));
    edge(e, 'eN', `M420 25 C 545 25, 542 120, 542 162`);
    edge(e, 'eR', `M140 293 C 250 340, 380 340, 466 293`);
    edge(e, 'eS', `M140 293 L 170 293`);
    stage.append(bg, e, g, pkt);
  }
  function plan() {
    const A = cum(); const S = [];
    const off = { aN: 'dim', dN: 'dim', eN: 'dim', eR: 'dim', rN: '' };
    if (mode === 'zonal') {
      S.push({ ...A.set({ ...off, a2: 'gone', a3: 'gone', d2: 'gone', d3: 'gone', eL2: 'gone', eL3: 'gone', eS: 'gone', a1: 'ok', d1: 'ok', eL1: 'ok', eF: 'ok' }, { d1: 'single server', d2: '', d3: '' }),
        t: '<b>Zonal</b>: you pin the VM (or app) and the database to <b>zone 1</b>. Latency between them is as low as it gets, but you have one failure domain. Zonal = <i>you</i> chose a zone. It isn’t redundancy.' });
      S.push({ fly: ['fd', 'lb', 'a1', 'd1'], ...A.set({}), t: 'Requests flow Front Door → load balancer → app in zone 1 → Postgres in zone 1.' });
      S.push({ ...A.set({ z1: 'bad', a1: 'bad', d1: 'bad', eL1: 'bad' }), t: 'Zone 1 loses power or cooling. Each zone has independent power, cooling and networking, so zones 2 and 3 are fine, but nothing of yours runs there.', cls: 'err' });
      S.push({ fly: ['fd', 'lb'], ...A.set({ lb: 'bad', eF: 'bad' }), t: '<b>Outage.</b> There is no healthy backend. You wait for the zone to recover, or restore into another zone from backups (and lose writes since the last backup, unless backups are zone-redundant and recent). Zonal is a choice for latency, not for resilience.', cls: 'err' });
      return S;
    }
    S.push({ ...A.set({ ...off, a1: 'ok', a2: 'ok', a3: 'ok', d1: 'ok', d2: 'hot', d3: 'gone', eL1: 'ok', eL2: 'ok', eL3: 'ok', eF: 'ok', eS: 'hot' }, { d1: 'primary', d2: 'standby (sync)', d3: '' }),
      t: '<b>Zone-redundant</b>: the platform spreads app instances across all three zones, and Postgres Flexible Server with zone-redundant HA keeps a <b>standby in another zone</b>, replicated synchronously.' });
    if (mode === 'region') A.set({ aN: 'hot', dN: 'hot', eR: 'hot' });
    S.push({ fly: ['fd', 'lb', 'a2', 'd1'], ...A.set({}), t: mode === 'region' ? 'Normal traffic stays in West Europe. North Europe runs a <b>warm standby</b>: a small app deployment and an asynchronous Postgres read replica.' : 'Any instance can serve a request. App instances in zones 2 and 3 talk to the primary in zone 1. Cross-zone latency is low, so it rarely matters for a CRUD API.' });
    if (mode === 'zr') {
      S.push({ ...A.set({ z1: 'bad', a1: 'bad', d1: 'bad', eL1: 'bad', eS: 'bad' }), t: 'Zone 1 fails, taking an app instance and the database primary with it.', cls: 'err' });
      S.push({ fly: ['fd', 'lb', 'a3'], ...A.set({ a1: 'gone', eL1: 'gone' }), t: 'Health probes take zone 1’s instance out of rotation, and traffic flows to zones 2 and 3. You lost a third of your capacity, so size for “one zone down” (N+1).', cls: 'warn' });
      S.push({ ...A.set({ d2: 'ok' }, { d2: 'new primary', d1: 'failed' }), t: '<b>Automatic HA failover</b>: the standby is promoted and the server keeps the same hostname. Open connections break, so the app must reconnect (Hikari will evict them) and retry. Committed transactions aren’t lost, because replication was synchronous.', cls: 'warn' });
      S.push({ fly: ['fd', 'lb', 'a2', 'd2'], ...A.set({}), t: '<b>Survived a zone failure inside the region.</b> No DNS changes and no human decision. That is the main reason to choose zone-redundant SKUs for production.', cls: 'ok' });
      return S;
    }
    S.push({ ...A.set({ rW: 'bad', z1: 'bad', z2: 'bad', z3: 'bad', a1: 'bad', a2: 'bad', a3: 'bad', d1: 'bad', d2: 'bad', lb: 'bad', eF: 'bad', eL1: 'bad', eL2: 'bad', eL3: 'bad', eS: 'bad', eR: 'bad' }),
      t: 'A rare <b>region-wide</b> incident. Zone redundancy can’t help here, because all three zones are in the region.', cls: 'err' });
    S.push({ fly: ['fd', 'aN'], ...A.set({ fd: 'warn', eN: 'ok', aN: 'ok' }), t: 'Front Door’s health probes fail for West Europe, so it routes to the North Europe origin automatically. The app tier fails over in about the time of a few probe intervals.', cls: 'warn' });
    S.push({ ...A.set({ dN: 'warn' }, { dN: 'promote replica?' }), t: 'The database is the hard part. The replica is <b>asynchronous</b>, so the last seconds of writes may be missing (RPO &gt; 0). Promoting it is a runbook decision with a clear owner. Practise it.', cls: 'warn' });
    S.push({ fly: ['fd', 'aN', 'dN'], ...A.set({ dN: 'ok', fd: 'ok' }, { dN: 'primary (promoted)' }), t: '<b>Running in the paired region.</b> Pairs give you sequential platform updates (one region of a pair at a time), recovery priority and the GRS replication target. They don’t give you automatic app failover: you build that with Front Door, replicas and IaC.', cls: 'ok' });
    return S;
  }
  const intro = () => ({ zonal: 'Zonal: everything pinned to zone 1. Press Play to fail that zone.', zr: 'Zone-redundant: spread across zones. Press Play to fail zone 1.', region: 'Multi-region: zone-redundant primary plus a warm standby in the paired region. Press Play to lose the whole region.' }[mode]);

  // composite SLA calculator
  const comps = [['Front Door', 99.99, true], ['App Service (2+ instances)', 99.95, true], ['Postgres Flexible (zone-redundant HA)', 99.99, true], ['Azure Cache for Redis', 99.9, false], ['Service Bus', 99.9, false]];
  const sel = comps.map((c) => c[2]); let twoReg = false;
  const out = el('div', { class: 'w-stats' });
  const list = el('div', { class: 'w-controls', style: { marginTop: '6px' } });
  comps.forEach((c, i) => { const cb = el('input', { type: 'checkbox' }); cb.checked = sel[i]; cb.addEventListener('change', () => { sel[i] = cb.checked; calc(); });
    list.append(el('label', null, cb, `${c[0]} ${c[1]}%`)); });
  const cb2 = el('input', { type: 'checkbox' }); cb2.addEventListener('change', () => { twoReg = cb2.checked; calc(); });
  list.append(el('label', null, cb2, 'run the regional stack in 2 regions (active-active)'));
  function calc() {
    const p = comps.map((c, i) => (sel[i] ? c[1] / 100 : 1));
    const global = p[0]; const regional = p.slice(1).reduce((a, b) => a * b, 1);
    const reg = twoReg ? 1 - (1 - regional) * (1 - regional) : regional;
    const tot = global * reg; const mins = (1 - tot) * 30 * 24 * 60;
    out.innerHTML = '';
    out.append(el('span', { class: 'w-stat', html: `regional chain <b>${(regional * 100).toFixed(3)}%</b>` }),
      el('span', { class: 'w-stat', html: `composite <b>${(tot * 100).toFixed(3)}%</b>` }),
      el('span', { class: 'w-stat', html: `≈ <b>${mins.toFixed(0)} min</b> allowed downtime / 30 days` }));
  }
  calc();
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), controls, narr,
    el('h3', { class: 'sub-h', text: 'Composite SLA calculator', style: { fontSize: '14px', margin: '14px 0 4px' } }),
    el('div', { class: 'tiny', html: 'Example SLA figures only; check the current Microsoft SLA for your SKU. Components in series multiply; two independent regions in parallel give 1 − (1 − p)².' }), list, out);
  const reset = makeStepper(plan, intro, build);
  reset();
});

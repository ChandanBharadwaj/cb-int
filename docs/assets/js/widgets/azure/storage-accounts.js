/* Storage redundancy: watch a write land on racks, zones and the paired region for LRS / ZRS / GRS / GZRS, then fail a rack, a zone and the region. */
IA.widget('storage-accounts', (root, ctx) => {
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
  let mode = 'zrs';
  const stage = svg('svg', { viewBox: '0 0 640 380', role: 'img', 'aria-label': 'Primary region with three zones of racks, and a paired region, showing where blob copies are stored' });
  const segM = seg([['lrs', 'LRS'], ['zrs', 'ZRS'], ['grs', 'GRS'], ['gzrs', 'GZRS']], mode, (v) => { mode = v; reset(); }, 'Redundancy SKU');
  const stats = el('div', { class: 'w-stats' });
  const COPIES = {
    lrs: ['z1r1', 'z1r2', 'z1r3'], zrs: ['z1r1', 'z2r1', 'z3r1'],
    grs: ['z1r1', 'z1r2', 'z1r3'], gzrs: ['z1r1', 'z2r1', 'z3r1']
  };
  const geo = () => mode === 'grs' || mode === 'gzrs';
  const zonal = () => mode === 'zrs' || mode === 'gzrs';
  function build() {
    stage.innerHTML = ''; clearZ();
    const bg = svg('g'); const e = svg('g'); const g = svg('g');
    const reg = (id, x, y, w, h, label) => { const r = svg('rect', { class: 'zn', x, y, width: w, height: h, rx: 12 }); bg.append(r, svg('text', { class: 'lbl', x: x + 10, y: y + 18, text: label })); Z[id] = { n: r, base: 'zn' }; };
    reg('rP', 8, 58, 436, 316, 'Primary region');
    reg('rS', 452, 58, 180, 316, 'Paired region');
    [0, 1, 2].forEach((i) => reg('z' + (i + 1), 18 + i * 142, 86, 132, 280, 'Zone ' + (i + 1)));
    reg('dS', 462, 86, 160, 280, 'one datacenter');
    [0, 1, 2].forEach((i) => [0, 1, 2].forEach((j) => node(g, `z${i + 1}r${j + 1}`, 28 + i * 142, 112 + j * 82, 112, 62, 'rack ' + (j + 1), '·')));
    [0, 1, 2].forEach((j) => node(g, 's' + (j + 1), 472, 112 + j * 82, 140, 62, 'rack ' + (j + 1), '·'));
    node(g, 'app', 18, 6, 170, 42, 'orders-api', 'PUT invoice.pdf');
    node(g, 'fe', 236, 6, 200, 42, 'Blob endpoint', 'stordersprod.blob…');
    hlink(e, 'eA', 'app', 'fe');
    edge(e, 'eG', 'M436 27 C 540 27, 542 50, 542 86');
    stage.append(bg, e, g, pkt);
    const n = geo() ? 6 : 3;
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `copies <b>${n}</b>` }),
      el('span', { class: 'w-stat', html: `primary copies in <b>${zonal() ? '3 zones' : '1 datacenter'}</b>` }),
      el('span', { class: 'w-stat', html: `geo copy <b>${geo() ? 'async, paired region' : 'none'}</b>` }),
      el('span', { class: 'w-stat', html: `Archive tier <b>${zonal() ? 'not supported' : 'supported'}</b>` }));
  }
  function plan() {
    const A = cum(); const S = []; const cp = COPIES[mode];
    const all = ['z1r1', 'z1r2', 'z1r3', 'z2r1', 'z2r2', 'z2r3', 'z3r1', 'z3r2', 'z3r3'];
    const base = {}; const sb = {};
    all.forEach((id) => { if (!cp.includes(id)) base[id] = 'dim'; });
    ['s1', 's2', 's3'].forEach((id) => { if (!geo()) base[id] = 'dim'; });
    if (!geo()) { base.eG = 'dim'; base.rS = ''; base.dS = ''; }
    const desc = {
      lrs: '<b>LRS</b>: three copies inside <b>one datacenter</b>, on different racks (fault domains) and upgrade domains. Cheapest, and it survives disk, node and rack failures.',
      zrs: '<b>ZRS</b>: three copies, <b>one in each availability zone</b> of the region. A write is acknowledged only when all three zones have it.',
      grs: '<b>GRS</b>: LRS in the primary region (three copies in one datacenter), plus an <b>asynchronous</b> LRS copy in the paired region. Six copies in total.',
      gzrs: '<b>GZRS</b>: ZRS in the primary region (one copy per zone), plus an <b>asynchronous</b> LRS copy in the paired region. The most resilient option.'
    }[mode];
    S.push({ ...A.set(base, sb), t: desc });
    S.push({ fly: ['app', 'fe'], ...A.set({ app: 'hot', fe: 'hot', eA: 'hot' }), t: 'The app PUTs <code>invoice.pdf</code> to the account’s endpoint. The storage front end authenticates the call (Entra token or SAS) and routes it to the partition that owns this blob name.' });
    const sub1 = {}; cp.forEach((id) => { sub1[id] = 'copy ✓'; });
    const ok1 = {}; cp.forEach((id) => { ok1[id] = 'ok'; });
    S.push({ fly: ['fe', ...cp], ms: 1500, ...A.set(ok1, sub1), t: zonal() ? 'The data is written <b>synchronously</b> to a copy in each of the three zones. Cross-zone latency is small, so writes are only slightly slower than LRS.' : 'The data is written <b>synchronously</b> to three racks in the same datacenter. They are separate fault domains, but they share the building, its power and its zone.' });
    S.push({ fly: ['fe', 'app'], ...A.set({ app: 'ok', fe: 'ok', eA: 'ok' }), t: '<b>201 Created</b> goes back only after all three primary copies are durable. That is why a successful write is never lost to a single disk, node or rack failure.', cls: 'ok' });
    if (geo()) {
      S.push({ fly: ['fe', 's1', 's2', 's3'], ms: 1600, ...A.set({ eG: 'warn', s1: 'warn', s2: 'warn', s3: 'warn' }, { s1: 'copy (async)', s2: 'copy (async)', s3: 'copy (async)' }),
        t: 'Later, <b>after</b> the 201, the write is shipped to the paired region and stored there three times (LRS). The gap is the <b>Last Sync Time</b>: typically under 15 minutes per Microsoft Learn, with no SLA.', cls: 'warn' });
    }
    S.push({ ...A.set({ [cp[0]]: 'bad' }, { [cp[0]]: 'failed' }), t: 'A <b>rack fails</b> (or a disk, or a node). Two primary copies remain, and the platform re-creates the third copy elsewhere. Every SKU shrugs this off.', cls: 'warn' });
    const z1 = { z1: 'bad', z1r1: 'bad', z1r2: 'bad', z1r3: 'bad' };
    const z1s = { z1r1: 'zone down', z1r2: cp.includes('z1r2') ? 'zone down' : '·', z1r3: cp.includes('z1r3') ? 'zone down' : '·' };
    if (zonal()) {
      S.push({ ...A.set(z1, z1s), t: '<b>Zone 1 goes down.</b> The copy in zone 1 is unreachable, but zones 2 and 3 still have the blob.', cls: 'err' });
      S.push({ fly: ['app', 'fe', 'z2r1'], ...A.set({ z2r1: 'ok', z3r1: 'ok' }, { z2r1: 'serving', z3r1: 'serving' }), t: '<b>Still available</b>, for reads and writes, with no failover and no DNS change. This is why ZRS or GZRS is the production default for anything zone-redundant above it.', cls: 'ok' });
    } else {
      S.push({ ...A.set({ ...z1, fe: 'bad', app: 'bad', eA: 'bad' }, z1s), t: '<b>Zone 1 goes down</b>, and it held the datacenter with all three primary copies. The data is probably safe on disk, but the account is <b>unavailable</b> until the zone recovers.', cls: 'err' });
      if (mode === 'grs') S.push({ ...A.set({}), t: 'With plain GRS the secondary can’t be read until you fail over. With <b>RA-GRS</b> the app could read (possibly stale) data from <code>stordersprod-secondary.blob.core.windows.net</code> right now.', cls: 'warn' });
    }
    const allBad = { rP: 'bad', z2: 'bad', z3: 'bad', fe: 'bad', app: 'bad', eA: 'bad' };
    const allSub = {}; cp.forEach((id) => { allBad[id] = 'bad'; allSub[id] = 'region down'; });
    S.push({ ...A.set(allBad, allSub), t: 'Now a rare <b>region-wide</b> outage. Zone redundancy can’t help, because all three zones are in the region.', cls: 'err' });
    if (geo()) {
      S.push({ ...A.set({ s1: 'ok', s2: 'ok', s3: 'ok', eG: 'ok', fe: 'warn' }, { s1: 'new primary', s2: 'new primary', s3: 'new primary', fe: 'DNS → paired region' }),
        t: 'You start a <b>customer-managed (unplanned) failover</b>. DNS for the endpoint now points at the paired region, which becomes the primary. Writes newer than the Last Sync Time are <b>lost</b>.', cls: 'warn' });
      S.push({ fly: ['app', 'fe', 's1'], ...A.set({ app: 'ok', eA: 'ok', fe: 'ok' }), t: 'The app works again with the same URL. The account is now <b>locally redundant</b> in the new primary, so re-enable geo redundancy afterwards. Treat this as a DR runbook with a named owner, not as automatic HA.', cls: 'ok' });
    } else {
      S.push({ ...A.set({}), t: '<b>Outage</b> until the region recovers, and if the datacenter is destroyed the data is gone. Only GRS and GZRS keep a copy outside the region. Use them for data you can’t recreate.', cls: 'err' });
    }
    return S;
  }
  const intro = () => ({ lrs: 'LRS: three copies, one datacenter. Press Play.', zrs: 'ZRS: three copies across three zones. Press Play.', grs: 'GRS: LRS plus an async copy in the paired region. Press Play.', gzrs: 'GZRS: ZRS plus an async copy in the paired region. Press Play.' }[mode]);
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), controls, narr, stats);
  const reset = makeStepper(plan, intro, build, 2800);
  reset();
});

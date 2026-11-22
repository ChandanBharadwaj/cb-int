/* Cosmos DB consistency slider: a writer in West Europe writes v1..v3 while readers in East US read; what each of the five levels allows, plus latency and read-RU cost. */
IA.widget('cosmos-db-consistency', (root, ctx) => {
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
  const LV = ['Strong', 'Bounded staleness', 'Session', 'Consistent prefix', 'Eventual'];
  let lvl = 2;
  const stage = svg('svg', { viewBox: '0 0 640 300', role: 'img', 'aria-label': 'A writer and two readers across two regions under a chosen consistency level' });
  const range = el('input', { type: 'range', min: 0, max: 4, step: 1, value: lvl, 'aria-label': 'Consistency level' });
  const name = el('b', { text: LV[lvl] });
  range.addEventListener('input', () => { lvl = +range.value; name.textContent = LV[lvl]; reset(); });
  const scale = el('div', { class: 'tiny', text: 'stronger ← Strong · Bounded · Session · Prefix · Eventual → faster, cheaper' });
  const stats = el('div', { class: 'w-stats' });
  const COST = [
    ['cross-region (waits for all regions)', '≈ 2×', 'no', 'always latest'],
    ['local', '≈ 2×', 'yes', 'lags ≤ K versions or T'],
    ['local', '1×', 'yes', 'own writes always'],
    ['local', '1×', 'yes', 'stale but ordered'],
    ['local', '1×', 'yes', 'stale, may be out of order']
  ];
  const stat = () => { const c = COST[lvl]; stats.innerHTML = '';
    [['write latency', c[0]], ['read RU', c[1]], ['multi-region writes', c[2]], ['reads', c[3]]].forEach(([k, v]) => stats.append(el('span', { class: 'w-stat', html: `${k} <b>${v}</b>` }))); };
  function build() {
    stage.innerHTML = ''; clearZ();
    const bg = svg('g'); const e = svg('g'); const g = svg('g');
    const reg = (id, x, y, w, h, label) => { const r = svg('rect', { class: 'zn', x, y, width: w, height: h, rx: 12 }); bg.append(r, svg('text', { class: 'lbl', x: x + 10, y: y + 18, text: label })); Z[id] = { n: r, base: 'zn' }; };
    reg('rW', 8, 8, 300, 284, 'West Europe (write region)');
    reg('rE', 332, 8, 300, 284, 'East US (read region)');
    node(g, 'w', 28, 40, 260, 56, 'Writer (session S1)', 'writes v1, v2, v3');
    node(g, 'rw', 28, 150, 260, 60, 'Replicas, West', '—');
    node(g, 're', 352, 150, 260, 60, 'Replicas, East', '—');
    node(g, 'r1', 352, 40, 260, 56, 'Reader in S1 (same user)', 'reads: —');
    node(g, 'r2', 352, 228, 260, 56, 'Reader in S2 (another user)', 'reads: —');
    link(e, 'eW', 'w', 'rw'); hlink(e, 'eR', 'rw', 're'); link(e, 'e1', 'r1', 're'); link(e, 'e2', 're', 'r2');
    stage.append(bg, e, g, pkt); stat();
  }
  function plan() {
    const A = cum(); const S = [];
    if (lvl === 0) {
      S.push({ fly: ['w', 'rw'], ...A.set({ w: 'hot', eW: 'hot', rw: 'warn' }, { rw: 'v3 pending' }), t: '<b>Strong</b>: the writer sends v3. West’s replicas have it, but the write isn’t acknowledged yet…', cls: 'warn' });
      S.push({ fly: ['rw', 're', 'rw'], ...A.set({ eR: 'ok', re: 'ok', rw: 'ok' }, { rw: 'v3 committed', re: 'v3 committed' }), t: '…because Strong requires the write to be committed in <b>every region</b> first. The writer pays a cross-region round trip on every write, which is why Strong needs a single write region.', cls: 'warn' });
      S.push({ fly: ['rw', 'w'], ...A.set({ w: 'ok', eW: 'ok' }), t: 'Acknowledged. Now every reader, anywhere, sees v3.' });
      S.push({ fly: ['r2', 're', 'r2'], ...A.set({ r2: 'ok', e2: 'ok', r1: 'ok', e1: 'ok' }, { r2: 'reads: v3', r1: 'reads: v3' }), t: 'Reads are <b>linearizable</b>: the latest committed version, always. Each read uses a quorum of two replicas, so it costs about 2× the RUs.', cls: 'ok' });
      return S;
    }
    S.push({ fly: ['w', 'rw'], ...A.set({ w: 'ok', eW: 'ok', rw: 'ok' }, { rw: 'v1 → v2 → v3' }), t: `<b>${LV[lvl]}</b>: the writer’s three writes are acknowledged by West’s local quorum right away. Writes are fast and local.` });
    S.push({ fly: ['rw', 're'], ...A.set({ eR: 'warn', re: 'warn' }, { re: 'has v1 (v2, v3 in flight)' }), t: 'Replication to East US is asynchronous. For a moment East has only v1.', cls: 'warn' });
    if (lvl === 1) {
      S.push({ fly: ['r2', 're', 'r2'], ...A.set({ r2: 'warn', e2: 'warn' }, { r2: 'reads: v1 or v2' }), t: '<b>Bounded staleness</b>: East may lag, but never by more than K versions or T seconds (you configure both; multi-region accounts have higher minimums). Reads are always in order.', cls: 'warn' });
      S.push({ ...A.set({ rw: 'warn' }, { rw: 'writes throttled if lag > bound' }), t: 'If East fell further behind than the bound, Cosmos DB would slow down writes until it caught up. You trade some write availability for a hard staleness limit.', cls: 'warn' });
      S.push({ fly: ['rw', 're'], ...A.set({ re: 'ok', eR: 'ok', r2: 'ok', r1: 'ok' }, { re: 'v3', r2: 'reads: v3', r1: 'reads: v3' }), t: 'Caught up. Reads cost about 2× RUs, like Strong, because they also use two replicas.', cls: 'ok' });
      return S;
    }
    if (lvl === 2) {
      S.push({ fly: ['r1', 're', 'r1'], ...A.set({ r1: 'ok', e1: 'ok' }, { r1: 'reads: v3 (token)' }), t: '<b>Session</b>: the same user’s read carries <b>session token</b> “v3”. A replica that hasn’t seen v3 can’t answer it, so the SDK waits or retries elsewhere. The user always sees their own write.', cls: 'ok' });
      S.push({ fly: ['r2', 're', 'r2'], ...A.set({ r2: 'warn', e2: 'warn' }, { r2: 'reads: v1' }), t: 'A different user, in another session, can still read <b>v1</b>. Session guarantees read-your-writes and monotonic reads per session, not global freshness.', cls: 'warn' });
      S.push({ ...A.set({ r1: 'bad' }, { r1: 'pod B, no token → v1?' }), t: 'The trap: the token lives in the client. If the same user’s next request hits <b>another pod</b> whose CosmosClient has no token for v3, it behaves like another session. Pass the token along, or keep the flow sticky.', cls: 'err' });
      return S;
    }
    if (lvl === 3) {
      S.push({ fly: ['r1', 're', 'r1'], ...A.set({ r1: 'warn', e1: 'warn' }, { r1: 'reads: v1' }), t: '<b>Consistent prefix</b>: even the writer’s own read in East may return v1. There is no read-your-writes guarantee.', cls: 'warn' });
      S.push({ fly: ['rw', 're'], ...A.set({ re: 'ok' }, { re: 'v1, v2 (v3 in flight)' }), t: 'Replication continues in order.' });
      S.push({ fly: ['r2', 're', 'r2'], ...A.set({ r2: 'ok', e2: 'ok' }, { r2: 'reads: v1 → v2 → v3' }), t: 'Readers may be behind, but they see writes in the order they happened: v1, then v2, then v3. Never v3 followed by v1.', cls: 'ok' });
      return S;
    }
    S.push({ fly: ['r2', 're', 'r2'], ...A.set({ r2: 'warn', e2: 'warn' }, { r2: 'reads: v2' }), t: '<b>Eventual</b>: this read hit a replica that already has v2…', cls: 'warn' });
    S.push({ fly: ['r2', 're', 'r2'], ...A.set({ r2: 'bad' }, { r2: 'reads: v2 → v1 (!)' }), t: '…and the next read hit a replica that has only v1. Reads can go <b>backwards</b>. That is fine for like counts or telemetry, but wrong for a balance or an order status.', cls: 'err' });
    S.push({ fly: ['rw', 're'], ...A.set({ re: 'ok', eR: 'ok', r2: 'ok' }, { re: 'v3', r2: 'reads: v3 (eventually)' }), t: 'With no new writes, all replicas converge on v3. Eventual is the cheapest and lowest-latency level. Session is the default for a reason.', cls: 'ok' });
    return S;
  }
  const intro = () => `${LV[lvl]}. Press Play to write v1, v2, v3 and read from another region.`;
  root.append(el('div', { class: 'w-controls' }, el('label', null, 'Consistency ', range, ' ', name)), scale, el('div', { class: 'w-stage' }, stage), controls, narr, stats);
  const reset = makeStepper(plan, intro, build, 2800);
  reset();
});

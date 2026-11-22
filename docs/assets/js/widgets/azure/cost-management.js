/* Cost management: one day of hourly compute, covered by reservation, savings plan, pay-as-you-go and Spot, with idle leaks and over-commitment waste. */
IA.widget('cost-management', (root, ctx) => {
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
  const stage = svg('svg', { viewBox: '0 0 640 330', role: 'img', 'aria-label': 'Hourly compute usage for one day, stacked by reservation, savings plan, pay-as-you-go and Spot coverage' });
  const stats = el('div', { class: 'w-stats' });
  const stat = (h) => { stats.innerHTML = ''; h.forEach((x) => stats.append(el('span', { class: 'w-stat', html: x }))); };
  const RATE = { payg: 1, sp: 0.75, res: 0.6, spot: 0.2 };
  const BASE = 6;
  const WEB = [2, 2, 2, 2, 2, 2, 3, 4, 6, 8, 9, 10, 10, 10, 9, 8, 7, 6, 5, 4, 3, 3, 2, 2];
  const BATCH = WEB.map((_, h) => (h >= 1 && h <= 4 ? 4 : 0));
  const X0 = 46; const SLOT = 24.2; const BW = 17; const YB = 282; const U = 11;
  const COL = { res: 'var(--accent-2)', sp: 'var(--accent)', payg: 'var(--warn)', spot: 'var(--ok)', leak: 'var(--err)' };
  let chart = null;
  function build() {
    stage.innerHTML = '';
    const ax = svg('g');
    for (let v = 0; v <= 20; v += 5) {
      const y = YB - v * U;
      ax.append(svg('line', { x1: X0 - 4, y1: y, x2: 632, y2: y, stroke: 'var(--border)', 'stroke-dasharray': v ? '3 4' : null }));
      ax.append(svg('text', { class: 'lbl m', x: X0 - 8, y: y + 4, 'text-anchor': 'end', text: String(v) }));
    }
    [0, 6, 12, 18, 23].forEach((h) => ax.append(svg('text', { class: 'lbl m', x: X0 + h * SLOT + BW / 2, y: YB + 16, 'text-anchor': 'middle', text: String(h).padStart(2, '0') + ':00' })));
    ax.append(svg('text', { class: 'lbl m', x: 4, y: 40, text: 'units' }));
    const leg = svg('g');
    [['res', 'reservation'], ['sp', 'savings plan'], ['payg', 'pay-as-you-go'], ['spot', 'Spot'], ['leak', 'idle leaks']].forEach(([k, l], i) => {
      const x = 60 + i * 116;
      leg.append(svg('rect', { x, y: 8, width: 12, height: 12, rx: 3, fill: COL[k], opacity: 0.85 }), svg('text', { class: 'lbl', x: x + 17, y: 18, text: l }));
    });
    leg.append(svg('rect', { x: 60, y: 28, width: 12, height: 10, rx: 2, fill: 'none', stroke: 'var(--text-3)', 'stroke-dasharray': '3 2' }), svg('text', { class: 'lbl m', x: 77, y: 37, text: 'dashed = committed but unused (paid anyway)' }));
    chart = svg('g');
    stage.append(ax, leg, chart);
    draw({ R: 0, S: 0, spot: false, leak: 1.5 });
  }
  function calc(st) {
    let cost = 0; let base = 0; let spUsed = 0; let resUsed = 0; const rows = [];
    for (let h = 0; h < 24; h++) {
      const batch = BATCH[h]; const u = BASE + WEB[h] + (st.spot ? 0 : batch);
      base += (BASE + WEB[h] + batch + st.leak) * RATE.payg;
      const res = Math.min(u, st.R); const rem = u - res; const cap = st.S / RATE.sp; const sp = Math.min(rem, cap); const payg = rem - sp;
      resUsed += res; spUsed += sp;
      cost += st.R * RATE.res + st.S + payg * RATE.payg + (st.spot ? batch * RATE.spot : 0) + st.leak * RATE.payg;
      rows.push({ res, sp, payg, spot: st.spot ? batch : 0, leak: st.leak, resFree: st.R - res, spFree: cap - sp });
    }
    const spUtil = st.S ? spUsed / (24 * st.S / RATE.sp) : null; const resUtil = st.R ? resUsed / (24 * st.R) : null;
    const wasted = rows.reduce((a, r) => a + r.resFree * RATE.res + r.spFree * RATE.sp, 0);
    return { rows, cost, base, spUtil, resUtil, wasted };
  }
  function draw(st, hi) {
    if (!chart) return;
    chart.innerHTML = '';
    const r = calc(st);
    r.rows.forEach((row, h) => {
      const x = X0 + h * SLOT; let y = YB;
      const put = (v, k, extra) => { if (v <= 0) return; const hgt = v * U; y -= hgt;
        chart.append(svg('rect', { class: 'bar', x, y, width: BW, height: hgt, fill: COL[k], opacity: hi && hi !== k ? 0.25 : 0.85, ...(extra || {}) })); };
      put(row.leak, 'leak'); put(row.res, 'res');
      if (row.resFree > 0) { const hgt = row.resFree * U; y -= hgt; chart.append(svg('rect', { x: x + 1, y, width: BW - 2, height: hgt, fill: 'none', stroke: COL.res, 'stroke-dasharray': '3 2' })); }
      put(row.sp, 'sp');
      if (row.spFree > 0) { const hgt = row.spFree * U; y -= hgt; chart.append(svg('rect', { x: x + 1, y, width: BW - 2, height: hgt, fill: 'none', stroke: COL.sp, 'stroke-dasharray': '3 2', 'stroke-width': 1.5 })); }
      put(row.payg, 'payg'); put(row.spot, 'spot');
    });
    const pct = (v) => (v == null ? '–' : Math.round(v * 100) + '%');
    stat([`cost/day <b>${r.cost.toFixed(0)}</b> units`, `vs all-PAYG <b>${r.base ? Math.round((1 - r.cost / r.base) * 100) : 0}%</b> less`, `reservation used <b>${pct(r.resUtil)}</b>`, `savings plan used <b>${pct(r.spUtil)}</b>`, `paid but unused <b>${r.wasted.toFixed(0)}</b>`]);
    return r;
  }
  const P0 = { R: 0, S: 0, spot: false, leak: 1.5 };
  function plan() {
    const S = [];
    const at = (st, hi) => () => draw(st, hi);
    S.push({ run: at(P0), t: 'Every bar is one hour of compute. With no commitments, all of it is <b>pay-as-you-go</b> at the list rate: a steady 6 units of 24/7 services, a daytime web peak, a 01:00–05:00 batch job, and a red band of idle resources.' });
    S.push({ run: at(P0, 'leak'), t: 'The red band is <b>paid for and does nothing</b>: unattached disks, unused Standard public IPs, an empty App Service plan, a dev VM “stopped” but not deallocated. Find them with Resource Graph. This is the cheapest saving there is: delete, no commitment.', cls: 'err' });
    const P1 = { ...P0, leak: 0 };
    S.push({ run: at(P1), t: 'Leaks deleted. Next, right-size (not shown): never commit to capacity you are about to remove.', cls: 'ok' });
    const P2 = { ...P1, R: 6 };
    S.push({ run: at(P2, 'res'), t: 'A <b>reservation</b> covers the 6 units that run every hour (Postgres compute, baseline nodes). It is applied <b>first</b>. Used 100% of the time, it is the cheapest rate here.', cls: 'ok' });
    const P3 = { ...P2, S: 1.5 };
    S.push({ run: at(P3, 'sp'), t: 'A <b>savings plan</b> commits 1.5 units of spend per hour, enough for 2 more units of flexible compute (App Service, Container Apps, VMs in any region), the floor above the reservation. Applied after reservations; the peak stays pay-as-you-go.', cls: 'ok' });
    const P4 = { ...P2, S: 6 };
    S.push({ run: at(P4, 'sp'), t: '<b>Over-committed</b>: someone sized the plan from the average day. Dashed boxes are commitment paid for but unused at night: <i>use it or lose it</i>, every hour, for the whole term. The discount on the day is partly eaten by the waste at night.', cls: 'warn' });
    const P5 = { ...P3, spot: true };
    S.push({ run: at(P5, 'spot'), t: 'Back to the right-sized plan, and the batch job moves to <b>Spot</b> capacity at a steep discount. It may be evicted, so the job checkpoints and retries. Never put the only replica of something critical on Spot.', cls: 'ok' });
    S.push({ run: at(P5), t: 'Final mix: idle deleted, the floor reserved, a small savings plan, PAYG for the peak, Spot for batch. Now set a <b>budget</b> with actual and forecast alerts: it warns you when this picture changes, but it won’t stop anything.', cls: 'ok' });
    return S;
  }
  const intro = () => 'Press Play or Step. Watch the bill per day (in illustrative units) and the utilisation of each commitment.';
  root.append(el('div', { class: 'w-stage' }, stage), stats, controls, narr);
  const reset = makeStepper(plan, intro, build, 3200);
  reset();
});

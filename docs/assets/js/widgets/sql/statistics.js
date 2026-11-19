/* Statistics: ANALYZE sample -> MCV list -> equi-depth histogram -> range / equality estimate vs actual. */
IA.widget('statistics', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-stats-css')) document.head.append(el('style', { id: 'w-stats-css', text: `
.w-stats-dot { fill: var(--text-3); }
.w-stats-dot.mcv { fill: var(--warn); }
.w-stats-dot.b0 { fill: var(--accent); } .w-stats-dot.b1 { fill: var(--ok); }
.w-stats-dot.gone { opacity: .15; }
.w-stats-bar { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 1.2; }
.w-stats-shade { fill: var(--ok); opacity: .22; }
.w-stats-in { animation: ${reduced ? 'none' : 'capin .45s ease both'}; }
.w-stats-sl { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 14px; margin-top: 8px; }
.w-stats-sl input { flex: 1; min-width: 160px; }` }));
  let dist = 'skew'; let B = 6; let speed = 2400; let gen = 0; let running = false; let k = 0; let C = 300;
  const MCV = [[150, 7], [600, 5]];
  function data() {
    const n = 48; const v = [];
    for (let i = 0; i < n; i++) { const u = (i + 0.5) / n; v.push(Math.round(1000 * (dist === 'skew' ? u ** 2.3 : u))); }
    MCV.forEach(([val, c]) => { for (let i = 0; i < c; i++) v.push(val); });
    return v.sort((a, b) => a - b);
  }
  const mkSeg = (items, cur, on) => { const s = el('div', { class: 'seg' }); items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segD = mkSeg([['skew', 'skewed data'], ['uni', 'uniform data']], dist, (v) => { dist = v; reset(); });
  const segB = mkSeg([[4, '4 buckets'], [6, '6 buckets'], [12, '12 buckets']], B, (v) => { B = v; reset(); });
  const segS = mkSeg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 760 330', role: 'img', 'aria-label': 'Sample values on a number line, MCVs and equi-depth histogram buckets', style: { width: '100%' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const slIn = el('input', { type: 'range', min: 0, max: 1000, step: 5, value: C, 'aria-label': 'predicate constant' }); const slOut = el('b', { text: '' });
  slIn.addEventListener('input', () => { C = +slIn.value; if (k >= STEPS) render(STEPS - 1); else slOut.textContent = `income < ${C}`; });
  const mcvHost = el('div', { class: 'tscroll' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segD, segB), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-stats-sl' }, el('span', { class: 'tiny', text: 'predicate' }), slIn, slOut),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, mcvHost, stats);
  const X = (v) => 40 + v / 1000 * 680; const BASE = 132;
  let V = []; let rest = []; let bounds = [];
  const STEPS = 6;
  function prep() {
    V = data(); const counts = {}; V.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
    rest = V.filter((v) => counts[v] < 3);
    bounds = []; for (let j = 0; j <= B; j++) bounds.push(rest[Math.round(j * (rest.length - 1) / B)]);
  }
  function estimate(c) {
    const N = V.length; const mcvFrac = MCV.reduce((s, m) => s + m[1], 0) / N;
    const mcvBelow = MCV.filter((m) => m[0] < c).reduce((s, m) => s + m[1], 0) / N;
    let h = 0; let detail = '';
    if (c <= bounds[0]) h = 0; else if (c > bounds[B]) h = 1;
    else { for (let j = 0; j < B; j++) { const lo = bounds[j], hi = bounds[j + 1]; if (c > hi) h += 1; else { const f = hi > lo ? (c - lo) / (hi - lo) : 0; h += f; detail = `${j} full bucket${j === 1 ? '' : 's'} + ${f.toFixed(2)} of bucket ${j + 1}`; break; } } h /= B; }
    const sel = mcvBelow + h * (1 - mcvFrac);
    const actual = V.filter((v) => v < c).length / N;
    return { sel, actual, mcvBelow, h, mcvFrac, detail };
  }
  function render(step) {
    stage.innerHTML = '';
    const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 12, fill: 'var(--text-2)', text: t }, o || {}));
    // axis
    stage.append(svg('line', { x1: 40, y1: BASE + 8, x2: 720, y2: BASE + 8, stroke: 'var(--border)' }), svg('line', { x1: 40, y1: 300, x2: 720, y2: 300, stroke: 'var(--border)' }));
    [0, 250, 500, 750, 1000].forEach((t) => stage.append(T(X(t) - 10, 318, String(t), { fill: 'var(--text-3)', 'font-size': 11 })));
    stage.append(T(40, 22, step === 0 ? 'ANALYZE sample (one dot = one row)' : step === 1 ? 'most common values found' : 'non-MCV values, split into equal-count buckets', { 'font-weight': 700, fill: 'var(--text)', 'font-size': 13 }));
    const counts = {}; V.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
    const bins = {}; let ri = -1;
    V.forEach((v) => { const isM = counts[v] >= 3; if (!isM) ri++; const bx = Math.round(X(v) / 9); bins[bx] = (bins[bx] || 0) + 1;
      let cls = 'w-stats-dot'; if (step >= 1 && isM) cls += ' mcv'; if (step >= 2 && isM) cls += ' gone';
      if (step >= 3 && !isM) { let b = 0; for (let j = 0; j < B; j++) if (ri >= Math.round(j * (rest.length - 1) / B)) b = j; cls += ' b' + (b % 2); }
      stage.append(svg('circle', { class: cls, cx: X(v), cy: BASE - (bins[bx] - 1) * 9, r: 4 })); });
    if (step >= 1) MCV.forEach(([v, c]) => stage.append(T(X(v) - 20, BASE - c * 9 - 8, `${v} ×${c}`, { fill: 'var(--warn)', 'font-weight': 700, class: 'w-stats-in' })));
    if (step >= 3) bounds.forEach((b, j) => { stage.append(svg('line', { x1: X(b), y1: 34, x2: X(b), y2: 300, stroke: 'var(--accent)', 'stroke-dasharray': '3 3', class: 'w-stats-in' }));
      stage.append(T(X(b) - 8, 162 + (j % 2) * 13, String(b), { 'font-size': 10.5, fill: 'var(--accent)', class: 'w-stats-in' })); });
    if (step >= 4) { const area = 120 * 40 / B; // equal area per bucket
      for (let j = 0; j < B; j++) { const w = Math.max(2, X(bounds[j + 1]) - X(bounds[j])); const h = Math.min(120, area / w * 4); stage.append(svg('rect', { class: 'w-stats-bar w-stats-in', x: X(bounds[j]), y: 300 - h, width: w, height: h })); }
      stage.append(T(40, 196, 'same rows per bucket → narrow buckets are tall', { 'font-size': 11, fill: 'var(--text-3)' })); }
    if (step >= 5) { stage.append(svg('rect', { class: 'w-stats-shade', x: 40, y: 34, width: Math.max(0, X(C) - 40), height: 266 }), svg('line', { x1: X(C), y1: 30, x2: X(C), y2: 304, stroke: 'var(--ok)', 'stroke-width': 2.5 }), T(Math.min(X(C) + 4, 660), 44, `< ${C}`, { fill: 'var(--ok)', 'font-weight': 700 })); }
    // MCV table + stats
    mcvHost.innerHTML = ''; stats.innerHTML = '';
    if (step >= 1) mcvHost.append(el('table', { class: 't rg', style: { marginTop: '8px' } }, el('thead', null, el('tr', null, ['pg_stats column', 'value'].map((h) => el('th', { text: h })))),
      el('tbody', null, el('tr', null, el('td', { text: 'most_common_vals' }), el('td', { text: '{' + MCV.map((m) => m[0]).join(',') + '}' })), el('tr', null, el('td', { text: 'most_common_freqs' }), el('td', { text: '{' + MCV.map((m) => (m[1] / V.length).toFixed(3)).join(',') + '}' })),
        step >= 3 ? el('tr', null, el('td', { text: 'histogram_bounds' }), el('td', { text: '{' + bounds.join(',') + '}' })) : null)));
    slOut.textContent = `income < ${C}`;
    if (step >= 5) { const e = estimate(C); const rows = (x) => Math.round(x * 60000).toLocaleString('en-US');
      stats.append(el('span', { class: 'w-stat', html: `estimate <b>${rows(e.sel)}</b> rows` }), el('span', { class: 'w-stat', html: `actual <b>${rows(e.actual)}</b> rows` }), el('span', { class: 'w-stat', html: `error <b>${e.actual ? (e.sel / e.actual).toFixed(2) + '×' : '-'}</b>` }));
      if (step === 5) narr.firstChild.innerHTML = `<code>income &lt; ${C}</code> on a 60,000-row table: MCVs below ${C} give <b>${e.mcvBelow.toFixed(3)}</b>. Histogram: ${e.detail || (e.h >= 1 ? 'all buckets' : 'no buckets')} = ${e.h.toFixed(3)} × (1 − ${e.mcvFrac.toFixed(3)} MCV share) = ${(e.h * (1 - e.mcvFrac)).toFixed(3)}. Selectivity ${e.sel.toFixed(3)}. Drag the slider; try fewer buckets.`; }
  }
  const WHY = [
    () => 'ANALYZE reads a random sample of rows (300 × statistics target = 30,000 by default). Here: 60 sampled values of <code>income</code>.',
    () => `Values that are clearly more common than the rest go into the <b>MCV list</b> with their frequencies: 150 appears 7 times (${(7 / 60).toFixed(3)}), 600 appears 5 times.`,
    () => 'MCVs are taken out. The histogram only describes the <b>remaining</b> values, so a frequent value cannot distort a bucket.',
    () => `The remaining ${48} values are sorted and cut into ${B} buckets with the <b>same number of values</b> each (equi-depth). The cut points are <code>histogram_bounds</code>.${dist === 'skew' ? ' Dense low values give narrow buckets.' : ''}`,
    () => 'Each bucket holds the same share of rows. The planner assumes values are spread evenly <i>inside</i> a bucket, so narrow buckets mean high density.',
    () => ''
  ];
  async function step() { if (k >= STEPS) return false; const s = k++; render(s); if (s < 5) narr.firstChild.innerHTML = WHY[s](); if (k >= STEPS) { bStep.disabled = true; narr.firstChild.innerHTML += ' For <code>= 150</code> the planner uses the MCV frequency (0.117). For a non-MCV value like <code>= 333</code>: (1 − 0.2) / (n_distinct − 2).'; } return true; }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; bStep.disabled = false; k = 0; prep(); render(0); narr.firstChild.innerHTML = 'Press Play or Step to run ANALYZE on this column.'; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= STEPS) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && await step()) await sleep(reduced ? 600 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

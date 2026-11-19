/* percentile_cont vs percentile_disc: sort, locate the fraction, pick (disc) or interpolate (cont). */
IA.widget('pivot-percentiles', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const SETS = { even: [25, 90, 12, 40, 18, 15], odd: [25, 90, 12, 18, 15] };
  let set = 'even'; let p = 0.5; let speed = 2400; let gen = 0; let running = false; let k = 0;
  const seg = (label, items, cur, on) => { const s = el('div', { class: 'seg', 'aria-label': label });
    items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segD = seg('Data', [['even', '6 latencies (even n)'], ['odd', '5 latencies (odd n)']], set, (v) => { set = v; reset(); });
  const segP = seg('Fraction', [[0.25, 'p = 0.25'], [0.5, 'p = 0.5 (median)'], [0.9, 'p = 0.9']], p, (v) => { p = v; reset(); });
  const segS = seg('Speed', [[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const sqlBox = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const W = 700; const H = 250; const st = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Values as boxes; markers show the disc pick and the cont interpolation' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: '' }));
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segD), el('div', { class: 'w-controls' }, segP), sqlBox, el('div', { class: 'w-stage' }, st),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const BW = 92; const GAP = 14;
  const calc = () => { const v = SETS[set].slice().sort((a, b) => a - b); const n = v.length; const pos = p * (n - 1); const lo = Math.floor(pos); const hi = Math.ceil(pos); const f = pos - lo;
    const cont = v[lo] + f * (v[hi] - v[lo]); let di = 0; while ((di + 1) / n < p - 1e-9) di++; return { v, n, pos, lo, hi, f, cont, di, disc: v[di], avg: v.reduce((a, b) => a + b, 0) / n }; };
  const x0 = (n) => (W - (n * BW + (n - 1) * GAP)) / 2;
  function draw(stage) {
    st.innerHTML = ''; const c = calc(); const vals = stage === 0 ? SETS[set] : c.v; const n = vals.length; const X = x0(n);
    vals.forEach((val, i) => { const x = X + i * (BW + GAP);
      const isDisc = stage >= 3 && i === c.di; const inCont = stage >= 4 && (i === c.lo || i === c.hi);
      st.append(svg('rect', { x, y: 40, width: BW, height: 54, rx: 10, fill: isDisc ? 'var(--warn)' : inCont ? 'var(--accent-soft)' : 'var(--surface-2)', stroke: inCont ? 'var(--accent)' : 'var(--border)', 'stroke-width': inCont ? 2 : 1 }),
        svg('text', { x: x + BW / 2, y: 78, 'text-anchor': 'middle', 'font-size': 30, 'font-weight': 700, fill: isDisc ? '#fff' : 'var(--text)', text: String(val) }));
      if (stage >= 2) st.append(svg('text', { x: x + BW / 2, y: 28, 'text-anchor': 'middle', 'font-size': 19, fill: 'var(--text-3)', text: `${(i + 1)}/${n}` }),
        svg('text', { x: x + BW / 2, y: 118, 'text-anchor': 'middle', 'font-size': 19, fill: 'var(--text-3)', text: `pos ${i}` })); });
    if (stage >= 4) { const mx = X + c.pos * (BW + GAP) + BW / 2;
      st.append(svg('line', { x1: mx, y1: 132, x2: mx, y2: 160, stroke: 'var(--accent)', 'stroke-width': 3 }), svg('circle', { cx: mx, cy: 132, r: 7, fill: 'var(--accent)' }),
        svg('text', { x: Math.min(Math.max(mx, 170), W - 170), y: 192, 'text-anchor': 'middle', 'font-size': 24, 'font-weight': 700, fill: 'var(--accent)', text: `cont = ${+c.cont.toFixed(2)} (pos ${+c.pos.toFixed(2)})` })); }
    if (stage >= 3) { const dx = X + c.di * (BW + GAP) + BW / 2; st.append(svg('text', { x: Math.min(Math.max(dx, 80), W - 80), y: 232, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 700, fill: 'var(--warn)', text: `disc = ${c.disc}` })); }
  }
  const STEPS = [
    () => 'The rows arrive in whatever order the scan produces. An ordered-set aggregate needs them sorted: that’s what WITHIN GROUP (ORDER BY ms) says.',
    () => 'Sorted. Now each value has a position 0…n−1 and a cumulative fraction (cume_dist) i/n.',
    () => { const c = calc(); return `percentile_disc(${p}): return the first value whose cume_dist ≥ ${p}. That is value #${c.di + 1}: ${c.disc}. Always an actual row value.`; },
    () => { const c = calc(); return `percentile_cont(${p}): position = ${p} × (n−1) = ${+c.pos.toFixed(2)}. ${c.f === 0 ? `That lands exactly on ${c.v[c.lo]}, no interpolation needed.` : `Between ${c.v[c.lo]} and ${c.v[c.hi]}: ${c.v[c.lo]} + ${+c.f.toFixed(2)} × (${c.v[c.hi]} − ${c.v[c.lo]}) = ${+c.cont.toFixed(2)}. A value that may not exist in the data.`}`; },
    () => { const c = calc(); return `Compare: disc ${c.disc}, cont ${+c.cont.toFixed(2)}, avg ${+c.avg.toFixed(2)}. The 90 ms outlier drags the average, not the median. ${set === 'even' && p === 0.5 ? 'With an even n, cont gives the textbook median (mean of the two middle values); disc gives the lower one.' : ''}`; }
  ];
  function step() {
    if (k >= STEPS.length) return false; k++; draw([0, 2, 3, 4, 4][k - 1]); narr.firstChild.textContent = STEPS[k - 1]();
    const c = calc(); stats.innerHTML = '';
    if (k >= 3) stats.append(el('span', { class: 'w-stat', html: `disc <b>${c.disc}</b>` })); if (k >= 4) stats.append(el('span', { class: 'w-stat', html: `cont <b>${+c.cont.toFixed(2)}</b>` })); if (k >= 5) stats.append(el('span', { class: 'w-stat', html: `avg <b>${+c.avg.toFixed(2)}</b>` }));
    if (k >= STEPS.length) bStep.disabled = true; return true;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; bStep.disabled = false; stats.innerHTML = ''; draw(0);
    sqlBox.innerHTML = ''; sqlBox.append(el('pre', { html: IA.highlight(`SELECT percentile_disc(${p}) WITHIN GROUP (ORDER BY ms) AS disc,\n       percentile_cont(${p}) WITHIN GROUP (ORDER BY ms) AS cont\nFROM latency;   -- ${SETS[set].join(', ')}`, 'sql') }));
    narr.firstChild.textContent = 'Press Play. Pick a fraction and an even or odd row count; disc and cont only agree sometimes.';
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= STEPS.length) reset(); running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 600 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

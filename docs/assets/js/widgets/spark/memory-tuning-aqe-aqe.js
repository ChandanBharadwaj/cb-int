/* AQE partition coalescing: adjacent small shuffle partitions merged toward the advisory size. */
IA.widget('memory-tuning-aqe-aqe', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const SIZES = [3, 41, 12, 8, 30, 2, 5, 55, 9, 14, 22, 6, 1, 38, 17, 4, 26, 11, 7, 48, 3, 19, 10, 33]; // MB
  const ADV = 64; const W = 760, H = 230;
  const STEPS = [
    'The map stage wrote its shuffle output into N partitions (24 shown here; 200 by default). Before AQE, the reduce stage would run one task per partition, many of them tiny.',
    'AQE reads the real size of each partition from the map output statistics (in MB above each bar).',
    'It walks the partitions in order and packs <b>adjacent</b> ones together until a group reaches about 64 MB (<code>advisoryPartitionSizeInBytes</code>).',
    'The reduce stage now runs one task per group. In the plan this shows as <code>AQEShuffleRead coalesced</code>. Note it only merges: a single 500 MB partition would stay 500 MB (skew splitting is a separate join feature).'
  ];
  let k = 0; let running = false; let gen = 0;
  const groups = []; let cur = []; let acc = 0;
  SIZES.forEach((s, i) => { if (acc + s > ADV && cur.length) { groups.push(cur); cur = []; acc = 0; } cur.push(i); acc += s; });
  if (cur.length) groups.push(cur);
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Bars for shuffle partitions grouped into coalesced tasks' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, stats);
  function render() {
    stage.innerHTML = '';
    const bw = 26, gap = 4, base = 170;
    const gOf = (i) => groups.findIndex((g) => g.includes(i));
    if (k >= 2) groups.forEach((g, gi) => {
      const x = 20 + g[0] * (bw + gap) - 2; const w = g.length * (bw + gap);
      stage.append(svg('rect', { x, y: 20, width: w, height: base - 14, rx: 6, fill: gi % 2 ? 'var(--accent-soft)' : 'none', stroke: 'var(--accent)', 'stroke-dasharray': '4 3' }),
        svg('text', { x: x + w / 2, y: base + 44, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--accent)', text: `task ${gi + 1}` }));
    });
    SIZES.forEach((s, i) => {
      const h = s * 2; const x = 20 + i * (bw + gap);
      const r = svg('rect', { x, y: base - h, width: bw, height: h, rx: 3, fill: k >= 2 ? 'var(--accent)' : 'var(--text-3)' });
      if (!reduced) r.style.transition = 'fill .5s';
      stage.append(r);
      if (k >= 1) stage.append(svg('text', { x: x + bw / 2, y: base - h - 4, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-2)', text: s }));
      stage.append(svg('text', { x: x + bw / 2, y: base + 16, 'text-anchor': 'middle', 'font-size': 9, fill: 'var(--text-3)', text: 'p' + i }));
      void gOf;
    });
    narr.firstChild.innerHTML = STEPS[k];
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `reduce tasks <b>${k >= 3 ? groups.length : SIZES.length}</b>` }), el('span', { class: 'w-stat', html: `total <b>${SIZES.reduce((a, b) => a + b, 0)} MB</b>` }));
    bStep.disabled = k >= STEPS.length - 1;
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; render(); }
  function step() { if (k >= STEPS.length - 1) return false; k++; render(); return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= STEPS.length - 1) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 700 : 2400);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

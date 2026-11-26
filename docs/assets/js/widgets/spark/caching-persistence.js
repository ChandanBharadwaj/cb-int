/* Caching & persistence: three actions over one DataFrame, with no cache, with cache(), and with eviction. */
IA.widget('caching-persistence', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const W = 760, H = 270;
  const BOX = [
    { id: 'scan', x: 10, l: 'scan parquet' }, { id: 'filter', x: 130, l: 'filter' }, { id: 'join', x: 250, l: 'join dim' },
    { id: 'cache', x: 380, l: 'cache blocks' }
  ];
  const ACT = [{ id: 'a1', y: 20, l: 'count()' }, { id: 'a2', y: 100, l: 'groupBy().show()' }, { id: 'a3', y: 180, l: 'write.parquet()' }];
  const PIPE = ['scan', 'filter', 'join'];
  // block states: '' empty, 'mem', 'disk', 'gone'
  const PLANS = {
    none: [
      { hot: [], blocks: '----', scans: 0, t: 'No cache. Three actions use the same DataFrame <code>clean</code>. Press Step.' },
      { hot: [...PIPE, 'a1'], blocks: '----', scans: 1, t: '<code>count()</code> runs the whole lineage: scan → filter → join.' },
      { hot: [...PIPE, 'a2'], blocks: '----', scans: 2, t: '<code>groupBy().show()</code> runs it <b>again</b> from the files. Nothing was kept.' },
      { hot: [...PIPE, 'a3'], blocks: '----', scans: 3, t: '<code>write</code> runs it a third time. 3 scans of the source for one logical dataset.' }
    ],
    cache: [
      { hot: ['cache'], blocks: '....', scans: 0, t: '<code>clean.cache()</code>: the plan is <i>marked</i> (dashed blocks). No work happens yet: cache is lazy.' },
      { hot: [...PIPE, 'cache', 'a1'], blocks: 'MMMD', scans: 1, t: 'The first action computes each partition once and stores it. One block didn’t fit in memory and went to disk (MEMORY_AND_DISK).' },
      { hot: ['cache', 'a2'], blocks: 'MMMD', scans: 1, t: 'The second action finds the cached sub-plan (<code>InMemoryTableScan</code>) and reads blocks. No scan.' },
      { hot: ['cache', 'a3'], blocks: 'MMMD', scans: 1, t: 'Third action, same. Afterwards call <code>clean.unpersist()</code> to free the memory.' }
    ],
    evict: [
      { hot: ['cache'], blocks: '....', scans: 0, t: '<code>rdd.persist(MEMORY_ONLY)</code>: marked, lazy.' },
      { hot: [...PIPE, 'cache', 'a1'], blocks: 'MMM-', scans: 1, t: 'First action. Partition 4 doesn’t fit in storage memory, and MEMORY_ONLY never writes to disk, so it is simply not cached.' },
      { hot: ['cache', 'a2'], blocks: 'MXX-', scans: 1, t: 'A big shuffle needs execution memory. Blocks 2 and 3 are <b>evicted</b> (LRU).' },
      { hot: [...PIPE, 'cache', 'a3'], blocks: 'MRRR', scans: '1 + ¾', t: 'Next action: block 1 is read from memory; partitions 2–4 are <b>recomputed from lineage</b> (red). Correct results, but much of the saving is gone.' }
    ]
  };
  const MODES = { none: 'No cache', cache: 'cache()', evict: 'MEMORY_ONLY + evict' };
  let mode = 'cache'; let k = 0; let running = false; let gen = 0;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Caching mode' });
  Object.entries(MODES).forEach(([v, l]) => { const b = el('button', { text: l, class: v === mode ? 'on' : '' }); b.addEventListener('click', () => { mode = v; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Pipeline of scan, filter, join and cache feeding three actions' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, seg), el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, stats);

  function render() {
    const s = PLANS[mode][k]; stage.innerHTML = '';
    const hot = new Set(s.hot); const y0 = 100;
    const box = (x, y, w, l, on) => [svg('rect', { x, y, width: w, height: 44, rx: 9, fill: on ? 'var(--accent-soft)' : 'var(--surface-2)', stroke: on ? 'var(--accent)' : 'var(--border)', 'stroke-width': on ? 2 : 1, style: reduced ? '' : 'transition: all .4s' }),
      svg('text', { x: x + w / 2, y: y + 27, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--text)', text: l })];
    BOX.forEach((b, i) => {
      if (b.id === 'cache') {
        stage.append(svg('text', { x: b.x + 70, y: y0 - 22, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--text-3)', text: mode === 'none' ? '(no cache)' : 'cached blocks' }));
        [...s.blocks].forEach((c, j) => {
          const fill = { M: 'var(--ok)', D: 'var(--warn)', R: 'var(--err)', X: 'var(--surface-2)', '.': 'none', '-': 'var(--surface-2)' }[c];
          stage.append(svg('rect', { x: b.x + j * 36, y: y0 - 10, width: 30, height: 64, rx: 6, fill, stroke: hot.has('cache') ? 'var(--accent)' : 'var(--border)', 'stroke-dasharray': c === '.' || c === 'X' ? '4 3' : '', opacity: mode === 'none' ? 0.35 : 1 }),
            svg('text', { x: b.x + j * 36 + 15, y: y0 + 28, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text)', text: { M: 'mem', D: 'disk', R: 'redo', X: 'evict', '.': '', '-': '' }[c] }));
        });
      } else stage.append(...box(b.x, y0, 105, b.l, hot.has(b.id)));
      if (i < BOX.length - 1) stage.append(svg('path', { d: `M${b.x + 108} ${y0 + 22} L${BOX[i + 1].x - 4} ${y0 + 22}`, stroke: hot.has(BOX[i + 1].id) || hot.has(b.id) ? 'var(--accent)' : 'var(--edge)', 'stroke-width': 2, fill: 'none' }));
    });
    ACT.forEach((a) => {
      stage.append(...box(600, a.y + 20, 150, a.l, hot.has(a.id)));
      stage.append(svg('path', { d: `M528 ${y0 + 22} C 565 ${y0 + 22}, 565 ${a.y + 42}, 598 ${a.y + 42}`, stroke: hot.has(a.id) ? 'var(--accent)' : 'var(--edge)', 'stroke-width': hot.has(a.id) ? 2.5 : 1.5, fill: 'none' }));
    });
    stage.append(svg('text', { x: 10, y: 240, 'font-size': 12, fill: 'var(--text-3)', text: 'green = in memory · amber = on local disk · red = recomputed from lineage' }));
    narr.firstChild.innerHTML = s.t;
    stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `source scans <b>${s.scans}</b>` }), el('span', { class: 'w-stat', html: `actions run <b>${Math.max(0, k - (mode === 'none' ? 0 : 0))}</b> / 3` }));
    bStep.disabled = k >= PLANS[mode].length - 1;
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; render(); }
  function step() { if (k >= PLANS[mode].length - 1) return false; k++; render(); return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= PLANS[mode].length - 1) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 700 : 2400);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

/* Memory, tuning & AQE: executor memory layout (reserved / user / unified / overhead) and execution borrowing, eviction and spill. */
IA.widget('memory-tuning-aqe', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const W = 760, H = 250, X0 = 20, BW = 720;
  let heap = 20; let k = 0; let running = false; let gen = 0;
  const STEPS = [
    'The container = heap + overhead. Inside the heap: 300 MB reserved, user memory (40% of the rest) and unified memory (60%). The dashed line is <code>storageFraction</code> = 0.5.',
    'A <code>cache()</code> fills storage. Execution is idle, so storage <b>borrows</b> past the dashed line (cached blocks shown in green).',
    'A shuffle starts and needs execution memory. Execution <b>evicts</b> cached blocks that sit above the dashed line, taking that space back.',
    'Execution wants even more, but storage below the line is protected. The task <b>spills</b> sorted runs to local disk (amber) and merges them later.',
    'Python workers and netty buffers grow outside the heap. If they exceed the overhead, the cluster manager kills the container (exit 137). That is not a Java OOM.'
  ];
  const slider = el('input', { type: 'range', min: 4, max: 64, step: 1, value: heap, 'aria-label': 'Executor heap in GB' });
  const sLab = el('span', { class: 'tiny' });
  slider.addEventListener('input', () => { heap = +slider.value; render(); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Stacked bar of executor memory regions' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'executor memory' }), slider, sLab),
    el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, stats);

  function render() {
    const ovh = Math.max(0.384, heap * 0.1); const total = heap + ovh;
    const usable = heap - 0.3; const unified = usable * 0.6; const user = usable * 0.4;
    const sc = BW / total; const g = (v) => v * sc;
    sLab.textContent = `${heap} GB heap + ${ovh.toFixed(1)} GB overhead`;
    stage.innerHTML = '';
    const rect = (x, w, y, h, fill, label, sub, dash) => {
      const r = svg('rect', { x, y, width: Math.max(0, w), height: h, rx: 4, fill, stroke: 'var(--border)', 'stroke-dasharray': dash || '' });
      if (!reduced) r.style.transition = 'all .6s ease';
      stage.append(r);
      if (label && w > 46) stage.append(svg('text', { x: x + 6, y: y + 18, 'font-size': 12, fill: 'var(--text)', text: label }));
      if (sub && w > 46) stage.append(svg('text', { x: x + 6, y: y + 34, 'font-size': 11, fill: 'var(--text-2)', text: sub }));
    };
    const Y = 50, HH = 80;
    let x = X0;
    rect(x, g(0.3), Y, HH, 'var(--surface-2)', '', ''); x += g(0.3);
    rect(x, g(user), Y, HH, 'var(--surface-2)', 'user', user.toFixed(1) + ' GB'); x += g(user);
    const ux = x; rect(ux, g(unified), Y, HH, 'var(--surface)', '', ''); x += g(unified);
    rect(x, g(ovh), Y, HH, 'var(--accent-soft)', 'overhead', ovh.toFixed(1) + ' GB', '4 3');
    // unified contents
    const half = unified * 0.5;
    let stor = 0, exec = 0, spill = 0, evicted = false;
    if (k >= 1) stor = unified * 0.8;
    if (k >= 2) { stor = half; exec = unified * 0.5; evicted = true; }
    if (k >= 3) { spill = unified * 0.6; }
    if (stor) rect(ux, g(stor), Y + 6, HH - 12, 'color-mix(in srgb, var(--ok) 35%, transparent)', 'storage', stor.toFixed(1) + ' GB');
    if (exec) rect(ux + g(unified - exec), g(exec), Y + 6, HH - 12, 'color-mix(in srgb, var(--accent) 35%, transparent)', 'execution', exec.toFixed(1) + ' GB');
    if (!stor && !exec) stage.append(svg('text', { x: ux + 8, y: Y + 46, 'font-size': 12, fill: 'var(--text-2)', text: `unified ${unified.toFixed(1)} GB (free)` }));
    stage.append(svg('line', { x1: ux + g(half), x2: ux + g(half), y1: Y - 8, y2: Y + HH + 8, stroke: 'var(--text-2)', 'stroke-dasharray': '5 4' }),
      svg('text', { x: ux + g(half) - 40, y: Y - 12, 'font-size': 11, fill: 'var(--text-3)', text: 'storageFraction' }));
    stage.append(svg('text', { x: X0, y: 30, 'font-size': 12, fill: 'var(--text-3)', text: '300 MB reserved ▸' }));
    if (evicted) stage.append(svg('text', { x: ux + g(half) + 6, y: Y + HH + 24, 'font-size': 12, fill: 'var(--err)', text: '← cached blocks above the line evicted' }));
    // disk
    const DY = 175;
    stage.append(svg('rect', { x: X0, y: DY, width: 300, height: 50, rx: 8, fill: 'var(--surface-2)', stroke: 'var(--border)' }), svg('text', { x: X0 + 8, y: DY + 18, 'font-size': 12, fill: 'var(--text-3)', text: 'local disk (spill + shuffle files)' }));
    if (spill) { const r = svg('rect', { x: X0 + 8, y: DY + 26, width: Math.min(284, g(spill) * 0.6), height: 16, rx: 3, fill: 'var(--warn)' }); stage.append(r, svg('text', { x: X0 + 320, y: DY + 40, 'font-size': 12, fill: 'var(--text-2)', text: `spilled ≈ ${spill.toFixed(1)} GB (deserialized size)` })); }
    if (k >= 4) stage.append(svg('rect', { x: X0 + g(heap), y: Y - 4, width: g(ovh) * 1.25, height: HH + 8, rx: 4, fill: 'none', stroke: 'var(--err)', 'stroke-width': 3 }),
      svg('text', { x: Math.min(W - 180, X0 + g(heap)), y: Y + HH + 40, 'font-size': 12, fill: 'var(--err)', text: 'over the limit → container killed' }));
    narr.firstChild.innerHTML = STEPS[k];
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `unified <b>${unified.toFixed(1)} GB</b>` }), el('span', { class: 'w-stat', html: `per task (5 cores) <b>≈ ${(unified / 5).toFixed(1)} GB</b>` }), el('span', { class: 'w-stat', html: `container <b>${total.toFixed(1)} GB</b>` }));
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
    while (running && g === gen && step()) await sleep(reduced ? 700 : 2600);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

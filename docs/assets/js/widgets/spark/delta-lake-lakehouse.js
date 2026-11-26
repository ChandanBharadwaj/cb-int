/* Delta Lake: data files + _delta_log commits, time travel to a version, and what VACUUM removes. */
IA.widget('delta-lake-lakehouse', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const LOG = [
    { v: 0, op: 'WRITE', add: ['f1', 'f2'], rm: [], t: '<b>v0 WRITE</b>: Spark writes two Parquet files, then commits <code>000…0.json</code> with two <i>add</i> actions. Until that file exists, readers see nothing.' },
    { v: 1, op: 'APPEND', add: ['f3'], rm: [], t: '<b>v1 APPEND</b>: one new file, one new commit. Existing files are untouched.' },
    { v: 2, op: 'MERGE', add: ['f4'], rm: ['f2'], t: '<b>v2 MERGE</b>: rows in f2 matched. Parquet is immutable, so f2 is rewritten as f4 (copy-on-write). The log says <i>remove f2, add f4</i>. f2 stays on disk for time travel.' },
    { v: 3, op: 'OPTIMIZE', add: ['f5'], rm: ['f1', 'f3', 'f4'], t: '<b>v3 OPTIMIZE</b>: three small files compacted into f5. Same data, fewer files. Again only a commit: old files remain.' },
    { v: 'VACUUM', op: 'VACUUM', add: [], rm: [], t: '<b>VACUUM</b> (after the 7-day retention): files not referenced by the latest version (f1–f4) are physically deleted. Now try time travel to v0–v2: their files are gone.' }
  ];
  const FILES = ['f1', 'f2', 'f3', 'f4', 'f5'];
  let k = 0; let tv = null; let running = false; let gen = 0;
  const live = (ver) => { const s = new Set(); LOG.slice(0, ver + 1).forEach((c) => { c.add.forEach((f) => s.add(f)); c.rm.forEach((f) => s.delete(f)); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segV = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Time travel version' });
  const stage = svg('svg', { viewBox: '0 0 760 280', role: 'img', 'aria-label': 'Data files on the left and transaction log commits on the right' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'time travel: VERSION AS OF' }), segV), narr, stats);
  function paintSeg() {
    segV.innerHTML = '';
    const maxV = Math.min(k, 3);
    [['latest', null], ...LOG.slice(0, maxV + 1).filter((c) => typeof c.v === 'number').map((c) => ['v' + c.v, c.v])].forEach(([l, v]) => {
      const b = el('button', { text: l, class: tv === v ? 'on' : '' }); b.addEventListener('click', () => { tv = v; render(); }); segV.append(b);
    });
  }
  function render() {
    paintSeg(); stage.innerHTML = '';
    const vacuumed = k >= 4; const curV = Math.min(k, 3);
    const readV = tv == null ? curV : tv;
    const readSet = live(readV);
    const existing = new Set(); LOG.slice(0, curV + 1).forEach((c) => c.add.forEach((f) => existing.add(f)));
    if (vacuumed) ['f1', 'f2', 'f3', 'f4'].forEach((f) => existing.delete(f));
    stage.append(svg('text', { x: 20, y: 24, 'font-size': 13, 'font-weight': 700, fill: 'var(--text)', text: 'sales/  (Parquet data files)' }),
      svg('text', { x: 420, y: 24, 'font-size': 13, 'font-weight': 700, fill: 'var(--text)', text: '_delta_log/' }));
    let missing = 0;
    FILES.forEach((f, i) => {
      const x = 20 + (i % 3) * 120, y = 44 + Math.floor(i / 3) * 90;
      const shown = LOG.slice(0, curV + 1).some((c) => c.add.includes(f));
      if (!shown) return;
      const ex = existing.has(f); const used = readSet.has(f);
      if (used && !ex) missing++;
      const r = svg('rect', { x, y, width: 100, height: 70, rx: 8, fill: !ex ? 'none' : used ? 'var(--accent-soft)' : 'var(--surface-2)', stroke: used ? (ex ? 'var(--accent)' : 'var(--err)') : 'var(--border)', 'stroke-width': used ? 2.5 : 1, 'stroke-dasharray': ex ? '' : '5 4' });
      if (!reduced) r.style.transition = 'all .5s';
      stage.append(r, svg('text', { x: x + 50, y: y + 32, 'text-anchor': 'middle', 'font-size': 14, fill: ex ? 'var(--text)' : 'var(--text-3)', text: f + '.parquet' }),
        svg('text', { x: x + 50, y: y + 52, 'text-anchor': 'middle', 'font-size': 11, fill: !ex ? 'var(--err)' : used ? 'var(--accent)' : 'var(--text-3)', text: !ex ? (used ? 'MISSING' : 'deleted') : used ? 'read by v' + readV : 'unreferenced' }));
    });
    LOG.slice(0, k + 1).forEach((c, i) => {
      const y = 40 + i * 44; const on = (typeof c.v === 'number' && c.v === readV);
      stage.append(svg('rect', { x: 420, y, width: 320, height: 36, rx: 7, fill: on ? 'var(--accent-soft)' : 'var(--surface)', stroke: on ? 'var(--accent)' : 'var(--border)' }),
        svg('text', { x: 430, y: y + 22, 'font-size': 12, fill: 'var(--text)', text: typeof c.v === 'number' ? `${String(c.v).padStart(4, '0')}.json  ${c.op}  ${c.add.map((f) => '+' + f).join(' ')} ${c.rm.map((f) => '−' + f).join(' ')}` : 'VACUUM: delete unreferenced files (table data unchanged)' }));
    });
    let t = LOG[k].t;
    if (tv != null && tv !== curV) t += missing ? ` <b>Reading v${tv} fails</b>: ${missing} of its files were vacuumed.` : ` Reading v${tv}: uses ${[...readSet].join(', ')}.`;
    narr.firstChild.innerHTML = t;
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `table version <b>${curV}</b>` }), el('span', { class: 'w-stat', html: `files on storage <b>${existing.size}</b>` }), el('span', { class: 'w-stat', html: `files in v${readV} <b>${readSet.size}</b>` }));
    bStep.disabled = k >= LOG.length - 1;
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; tv = null; render(); }
  function step() { if (k >= LOG.length - 1) return false; k++; render(); return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= LOG.length - 1) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 700 : 2600);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

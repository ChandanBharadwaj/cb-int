/* Join strategies: rows (dots) moving between executors for broadcast, sort-merge, skewed and AQE-split joins. */
IA.widget('join-strategies', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const KEYS = ['A', 'B', 'C', 'D'];
  const KC = { A: 'var(--k-queue)', B: 'var(--k-service)', C: 'var(--k-store)', D: 'var(--k-compute)' };
  const W = 760, H = 340, EX = (i) => 15 + i * 185, EW = 170, EY = 120, EH = 160;
  const MODES = {
    broadcast: 'Broadcast hash', smj: 'Sort-merge', skew: 'Skewed key', aqe: 'AQE skew split'
  };
  let mode = 'broadcast'; let k = 0; let running = false; let gen = 0;

  // data: big side = circles, small side = squares
  function dataset(skewed) {
    const big = []; let id = 0;
    const counts = skewed ? { A: 16, B: 3, C: 3, D: 2 } : { A: 5, B: 5, C: 4, D: 4 };
    let rot = 0;
    KEYS.forEach((key) => { for (let n = 0; n < counts[key]; n++) big.push({ id: id++, key, side: 'big', home: (rot++ * 3 + n) % 4 }); });
    const small = KEYS.map((key, i) => ({ id: id++, key, side: 'small', home: (i + 2) % 4 }));
    return { big, small };
  }
  const STEPS = {
    broadcast: [
      'Start: the big table (circles) is spread over 4 executors. The small table (squares, 4 rows) sits in one partition. Estimated size < 10 MB, so Spark plans a BroadcastHashJoin.',
      'The small side is collected to the <b>driver</b> and built into a hash table.',
      'The hash table is broadcast: every executor gets a full copy. The big side has not moved.',
      'Each task streams its local big rows and probes the local hash table. No shuffle of the big side: <b>0 big rows moved</b>.'
    ],
    smj: [
      'Start: both sides are big, so Spark plans a SortMergeJoin. Rows sit wherever the files put them.',
      'Shuffle (Exchange): every row is sent to the partition that owns <code>hash(key) % N</code>. Here key A → executor 1, B → 2, and so on. Both sides move.',
      'Each reduce task sorts its partition by key (spilling to disk if needed).',
      'Merge: walk both sorted runs together and emit matches. Every task does similar work because keys are balanced.'
    ],
    skew: [
      'Start: key A holds most of the big rows (a hot customer, or NULL).',
      'Shuffle: all A rows go to the same partition. That task now has 4–8× the work of the others.',
      'The stage can’t finish until its slowest task does. Bars show task time: one straggler, three idle cores.'
    ],
    aqe: [
      'Same skewed data. AQE (Spark 3.2+ default) waits for the shuffle map stage, then reads the real partition sizes.',
      'Shuffle as before: partition A is much larger than 5 × the median (and over 256 MB in real life), so it is marked <b>skewed</b>.',
      'AQE splits partition A into smaller sub-partitions and <b>replicates</b> the matching small-side partition (square A) to each split.',
      'Task times are now even. Same result, no code change. Salting does the same by hand when AQE can’t help (e.g. aggregations).'
    ]
  };

  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Join strategy' });
  Object.entries(MODES).forEach(([v, l]) => { const b = el('button', { text: l, class: v === mode ? 'on' : '' }); b.addEventListener('click', () => { mode = v; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Driver at the top, four executors below, coloured dots are rows by join key' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, seg), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, stats);

  let D, nodes, bars, copies;
  function draw() {
    stage.innerHTML = '';
    stage.append(svg('rect', { x: 290, y: 8, width: 180, height: 62, rx: 10, fill: 'var(--surface-2)', stroke: 'var(--border)' }),
      svg('text', { x: 380, y: 26, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: 'var(--text)', text: 'driver' }));
    for (let i = 0; i < 4; i++) {
      stage.append(svg('rect', { x: EX(i), y: EY, width: EW, height: EH, rx: 10, fill: 'var(--surface)', stroke: 'var(--border)' }),
        svg('text', { x: EX(i) + 8, y: EY + 18, 'font-size': 12, fill: 'var(--text-3)', text: `executor ${i + 1}` }));
    }
    KEYS.forEach((key, i) => stage.append(svg('circle', { cx: 20 + i * 60, cy: 92, r: 6, fill: KC[key] }), svg('text', { x: 30 + i * 60, y: 96, 'font-size': 11, fill: 'var(--text-2)', text: 'key ' + key })));
    stage.append(svg('text', { x: 520, y: 96, 'font-size': 11, fill: 'var(--text-3)', text: '● big side   ■ small side' }));
    D = dataset(mode === 'skew' || mode === 'aqe');
    nodes = new Map(); copies = svg('g'); bars = svg('g');
    [...D.big, ...D.small].forEach((r) => {
      const n = r.side === 'big' ? svg('circle', { cx: 0, cy: 0, r: 6, fill: KC[r.key] }) : svg('rect', { x: -6, y: -6, width: 12, height: 12, rx: 2, fill: KC[r.key], stroke: 'var(--text)', 'stroke-width': 1 });
      if (!reduced) n.style.transition = 'transform .9s ease, opacity .5s';
      nodes.set(r.id, n); stage.append(n);
    });
    stage.append(copies, bars);
  }
  const put = (r, x, y) => { nodes.get(r.id).style.transform = `translate(${x}px, ${y}px)`; };
  function layout(assign, sorted) {
    // assign(r) -> executor index (or 'driver'); place in grid
    const slot = { driver: 0, 0: 0, 1: 0, 2: 0, 3: 0 };
    let rows = [...D.big, ...D.small];
    if (sorted) rows = rows.slice().sort((a, b) => a.key.localeCompare(b.key) || (a.side > b.side ? 1 : -1));
    rows.forEach((r) => {
      const e = assign(r); const n = slot[e]++;
      if (e === 'driver') put(r, 320 + n * 20, 50);
      else put(r, EX(e) + 16 + (n % 8) * 20, EY + 40 + Math.floor(n / 8) * 22);
    });
    return slot;
  }
  function drawBars(load, label) {
    bars.innerHTML = '';
    const max = Math.max(...load);
    load.forEach((v, i) => {
      const w = Math.max(4, (v / max) * (EW - 10));
      bars.append(svg('rect', { x: EX(i), y: EY + EH + 12, width: w, height: 12, rx: 3, fill: v === max && max > 2 * Math.min(...load) ? 'var(--err)' : 'var(--accent)' }),
        svg('text', { x: EX(i), y: EY + EH + 40, 'font-size': 11, fill: 'var(--text-3)', text: `${label} ${v}` }));
    });
  }
  function broadcastCopies() {
    copies.innerHTML = '';
    for (let i = 0; i < 4; i++) KEYS.forEach((key, j) => copies.append(svg('rect', { x: EX(i) + 16 + j * 20 - 6, y: EY + EH - 30, width: 12, height: 12, rx: 2, fill: KC[key], stroke: 'var(--text)', 'stroke-width': 1, opacity: 0.9 })));
    for (let i = 0; i < 4; i++) copies.append(svg('text', { x: EX(i) + 100, y: EY + EH - 20, 'font-size': 11, fill: 'var(--text-3)', text: 'hash copy' }));
  }
  const owner = (key) => KEYS.indexOf(key);
  function render() {
    copies.innerHTML = ''; bars.innerHTML = '';
    const home = (r) => r.home;
    let moved = 0; const load = [0, 0, 0, 0];
    if (mode === 'broadcast') {
      if (k === 0) layout(home);
      if (k >= 1) layout((r) => (r.side === 'small' ? 'driver' : r.home));
      if (k >= 2) { D.small.forEach((r) => { nodes.get(r.id).style.opacity = k >= 2 ? '0.35' : '1'; }); broadcastCopies(); }
      D.big.forEach((r) => { load[r.home]++; });
      if (k >= 3) drawBars(load, 'rows probed');
      moved = k >= 1 ? D.small.length : 0;
      stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `big rows shuffled <b>0</b>` }), el('span', { class: 'w-stat', html: `small rows copied <b>${k >= 2 ? D.small.length * 4 : 0}</b>` }));
    } else {
      const shuffled = k >= 1;
      const aqeSplit = mode === 'aqe' && k >= 2;
      let aIdx = 0;
      const assign = (r) => {
        if (!shuffled) return r.home;
        if (aqeSplit && r.key === 'A' && r.side === 'big') return (aIdx++) % 4;
        return owner(r.key);
      };
      D.small.forEach((r) => { nodes.get(r.id).style.opacity = '1'; });
      layout(assign, (mode === 'smj' && k >= 2) || (mode !== 'smj' && shuffled));
      if (aqeSplit) {
        for (let i = 1; i < 4; i++) copies.append(svg('rect', { x: EX(i) + EW - 26, y: EY + 8, width: 12, height: 12, rx: 2, fill: KC.A, stroke: 'var(--text)', 'stroke-width': 1 }), svg('text', { x: EX(i) + EW - 64, y: EY + 18, 'font-size': 10, fill: 'var(--text-3)', text: 'replica' }));
      }
      if (shuffled) {
        aIdx = 0;
        [...D.big, ...D.small].forEach((r) => { const e = aqeSplit && r.key === 'A' && r.side === 'big' ? (aIdx++) % 4 : owner(r.key); load[e]++; if (r.home !== owner(r.key)) moved++; });
        if (mode !== 'smj' || k >= 3) drawBars(load, 'task rows');
        if (mode === 'skew' && k === 1) { bars.innerHTML = ''; }
        if (mode === 'skew' && k >= 2) drawBars(load, 'task rows');
        if (mode === 'aqe' && k === 1) { bars.innerHTML = ''; drawBars(load, 'task rows'); }
      }
      stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `rows shuffled <b>${moved}</b> / ${D.big.length + D.small.length}` }), el('span', { class: 'w-stat', html: `largest task <b>${shuffled ? Math.max(...load) : '–'}</b> rows` }));
    }
    narr.firstChild.innerHTML = STEPS[mode][k];
    bStep.disabled = k >= STEPS[mode].length - 1;
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; draw(); render(); }
  function step() { if (k >= STEPS[mode].length - 1) return false; k++; render(); return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= STEPS[mode].length - 1) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 700 : 2600);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

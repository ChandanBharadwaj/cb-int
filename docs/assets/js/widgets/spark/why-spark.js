/* Why Spark: MapReduce disk round-trips vs Spark in-memory pipelines, and laptop vs cluster. */
IA.widget('why-spark', (root, ctx) => {
  const W = 760, H = 300, MID = 'ws-arr', ARIA = 'Data flow comparison between MapReduce and Spark';
  const N = (id, x, y, label, sub, w = 110, h = 52) => ({ id, x, y, w, h, label, sub });
  const E = (id, a, b, label) => ({ id, a, b, label });
  const SCENES = [
    { name: 'MapReduce (2 iterations)', intro: 'Classic Hadoop MapReduce: every job reads from and writes to HDFS (disk). An iterative algorithm is a chain of jobs.',
      nodes: [N('h0', 20, 120, 'HDFS', 'input'), N('m1', 160, 40, 'map', 'job 1'), N('r1', 160, 200, 'reduce', 'job 1'), N('h1', 310, 120, 'HDFS', 'temp output'), N('m2', 460, 40, 'map', 'job 2'), N('r2', 460, 200, 'reduce', 'job 2'), N('h2', 620, 120, 'HDFS', 'final')],
      edges: [E('a', [130, 140], [160, 70], 'read'), E('b', [215, 92], [215, 200], 'shuffle (disk)'), E('c', [270, 220], [310, 160], 'write'), E('d', [420, 140], [460, 70], 'read again'), E('e', [515, 92], [515, 200], 'shuffle (disk)'), E('f', [570, 220], [620, 160], 'write')],
      steps: [
        { on: ['h0', 'm1'], edges: ['a'], t: 'Job 1 reads the input from HDFS.' },
        { on: ['m1', 'r1'], edges: ['b'], t: 'Map output is written to <b>local disk</b>, then pulled by reducers (the shuffle).' },
        { on: ['r1', 'h1'], edges: ['c'], t: 'Reduce writes the result back to HDFS, replicated (3× by default).' },
        { on: ['h1', 'm2'], edges: ['d'], warn: ['h1'], t: 'Iteration 2 must <b>read it all back</b> from disk. Ten iterations = ten full disk round-trips.' },
        { on: ['m2', 'r2'], edges: ['e'], t: 'Another shuffle through disk.' },
        { on: ['r2', 'h2'], edges: ['f'], t: 'Done. Correct and fault-tolerant, but disk I/O dominates for iterative work (ML, graph) and interactive queries.' }] },
    { name: 'Spark (2 iterations)', intro: 'Spark builds a plan of steps (a DAG) and keeps intermediate data in executor memory where it can.',
      code: 'df = spark.read.parquet("s3://events/")   # lazy\nclean = df.filter("valid").cache()           # keep in memory\nfor i in range(2):\n    model = step(clean, model)               # reuses cached data\nresult.write.parquet("s3://out/")',
      nodes: [N('src', 20, 120, 'Storage', 'S3 / HDFS'), N('p', 170, 120, 'filter', 'lazy plan'), N('c', 320, 120, 'cache', 'executor RAM'), N('i1', 480, 40, 'iteration 1', 'from memory', 130), N('i2', 480, 200, 'iteration 2', 'from memory', 130), N('out', 650, 120, 'Storage', 'final', 90)],
      edges: [E('a', [130, 146], [170, 146], 'read once'), E('b', [280, 146], [320, 146]), E('c', [430, 140], [480, 70]), E('d', [430, 152], [480, 220]), E('e', [610, 220], [650, 160], 'write')],
      steps: [
        { on: ['src', 'p'], t: 'Transformations just record a plan. Nothing is read yet: Spark is <b>lazy</b>.' },
        { on: ['src', 'p', 'c'], edges: ['a', 'b'], t: 'The first action runs the plan: read once, filter, and <code>cache()</code> keeps the partitions in executor memory.' },
        { on: ['c', 'i1'], edges: ['c'], t: 'Iteration 1 reads from memory, not from storage.' },
        { on: ['c', 'i2'], edges: ['d'], t: 'Iteration 2 reuses the same cached data. No disk round-trip.' },
        { on: ['i2', 'out'], edges: ['e'], t: 'Only the final result is written. Shuffles still touch local disk in Spark too; the win is avoiding the HDFS write/read between steps.' }] },
    { name: 'Laptop vs cluster', intro: 'Why not just pandas? A single machine has one RAM and a few cores. Spark splits the data into partitions and spreads them over many machines.',
      groups: [{ x: 300, y: 10, w: 450, h: 280, label: 'cluster' }],
      nodes: [N('lap', 20, 110, 'Laptop', '16 GB RAM', 140, 60), N('d1', 330, 40, 'executor 1', 'partitions 0-24', 190), N('d2', 540, 40, 'executor 2', 'partitions 25-49', 190), N('d3', 330, 180, 'executor 3', 'partitions 50-74', 190), N('d4', 540, 180, 'executor 4', 'partitions 75-99', 190)],
      edges: [E('a', [160, 140], [330, 66]), E('b', [160, 140], [540, 66]), E('c', [160, 140], [330, 206]), E('d', [160, 140], [540, 206])],
      steps: [
        { on: ['lap'], labels: { lap: '5 GB CSV: fine' }, t: 'Small data (fits in RAM): pandas, Polars or DuckDB on one machine is simpler and often faster than Spark.' },
        { warn: ['lap'], labels: { lap: '800 GB: out of memory' }, t: 'Data far bigger than one machine’s RAM or disk: a single process can’t hold it, and one CPU takes hours.' },
        { on: ['d1', 'd2', 'd3', 'd4'], edges: ['a', 'b', 'c', 'd'], labels: { lap: '100 partitions' }, t: 'Spark splits the data into <b>partitions</b> (say 100). Each executor processes its share in parallel.' },
        { on: ['d1', 'd2', 'd3', 'd4'], warn: ['d3'], labels: { d3: 'machine lost' }, t: 'If a machine dies, Spark recomputes only its lost partitions from the recorded plan (lineage). No manual retry logic.' }] }
  ];
  // Scene player: nodes (boxes), edges (arrows), groups, and steps that light them up.
  const { el, svg, sleep, reduced } = ctx;
  let si = 0; let k = -1; let running = false; let gen = 0;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scene' });
  if (SCENES.length > 1) SCENES.forEach((s, i) => { const b = el('button', { text: s.name, class: i === 0 ? 'on' : '' }); b.addEventListener('click', () => { si = i; [...seg.children].forEach((x, j) => x.classList.toggle('on', j === i)); reset(); }); seg.append(b); });
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': ARIA, style: 'width:100%;height:auto' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: '' }));
  const codeHost = el('div', { class: 'codebox', style: { marginBottom: '10px', display: 'none' } });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const counter = el('span', { class: 'tiny' });
  root.append(SCENES.length > 1 ? el('div', { class: 'w-controls' }, seg) : '', codeHost, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, counter), narr);
  const mk = () => svg('defs', null, svg('marker', { id: MID, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0L10 5L0 10z', fill: 'var(--accent)' })));
  function draw() {
    const S = SCENES[si]; const s = k >= 0 ? S.steps[k] : {};
    const on = new Set(s.on || []); const warn = new Set(s.warn || []); const eon = new Set(s.edges || []); const lab = s.labels || {};
    stage.innerHTML = ''; stage.append(mk());
    (S.groups || []).forEach((g) => { stage.append(svg('rect', { x: g.x, y: g.y, width: g.w, height: g.h, rx: 10, fill: 'none', stroke: 'var(--border)', 'stroke-dasharray': '5 4' }), svg('text', { x: g.x + 8, y: g.y + 15, 'font-size': 11, fill: 'var(--text-3)', text: g.label })); });
    (S.edges || []).forEach((e) => { const a = eon.has(e.id);
      stage.append(svg('line', { x1: e.a[0], y1: e.a[1], x2: e.b[0], y2: e.b[1], stroke: a ? 'var(--accent)' : 'var(--border)', 'stroke-width': a ? 2.5 : 1.2, 'stroke-dasharray': a ? null : '3 4', 'marker-end': a ? `url(#${MID})` : null }));
      if (e.label && a) stage.append(svg('text', { x: (e.a[0] + e.b[0]) / 2 + 4, y: (e.a[1] + e.b[1]) / 2 - 4, 'font-size': 11, fill: 'var(--accent)', text: e.label })); });
    (S.nodes || []).forEach((n) => { const a = on.has(n.id); const w = warn.has(n.id); const sub = lab[n.id] != null ? lab[n.id] : n.sub;
      stage.append(svg('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 8, fill: a ? 'var(--accent-soft)' : 'var(--surface)', stroke: w ? 'var(--warn)' : a ? 'var(--accent)' : 'var(--border)', 'stroke-width': a || w ? 2 : 1 }));
      stage.append(svg('text', { x: n.x + n.w / 2, y: n.y + (sub ? n.h / 2 - 3 : n.h / 2 + 4), 'text-anchor': 'middle', 'font-size': n.fs || 13, 'font-weight': 700, fill: 'var(--text)', text: n.label }));
      if (sub) stage.append(svg('text', { x: n.x + n.w / 2, y: n.y + n.h / 2 + 13, 'text-anchor': 'middle', 'font-size': 11, fill: w ? 'var(--warn)' : lab[n.id] != null ? 'var(--accent)' : 'var(--text-3)', text: sub })); });
    narr.firstChild.innerHTML = k >= 0 ? s.t : (S.intro || 'Press Play, or Step through one stage at a time.');
    const code = k >= 0 ? (s.code || S.code) : S.code;
    codeHost.style.display = code ? '' : 'none'; codeHost.innerHTML = '';
    if (code) codeHost.append(el('pre', { html: IA.highlight ? IA.highlight(code, S.lang || 'python') : ctx.esc(code) }));
    counter.textContent = `step ${k + 1} / ${S.steps.length}`;
    bStep.disabled = k >= S.steps.length - 1;
  }
  function stop() { gen++; running = false; bPlay.textContent = '▶ Play'; }
  function reset() { stop(); k = reduced ? SCENES[si].steps.length - 1 : -1; draw(); }
  function step() { if (k >= SCENES[si].steps.length - 1) return false; k++; draw(); return true; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', () => { stop(); k = -1; draw(); });
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= SCENES[si].steps.length - 1) k = -1;
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 700 : 2600);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

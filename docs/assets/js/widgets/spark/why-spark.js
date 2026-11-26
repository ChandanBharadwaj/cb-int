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
  /* Shared step-through shell for the Python Basics widgets.
     S = [{ label, lang?, code: [lines], intro?, steps: [{ line: n | [n], cap, out?, st }] }]
     renderState(st, scenario) returns an HTML string for the state panel. */
  function pybStepper(root, ctx, S, renderState, opt) {
    const { el, sleep, reduced } = ctx;
    opt = opt || {};
    if (!document.getElementById('w-pyb-base')) {
      document.head.append(el('style', { id: 'w-pyb-base', text: `
.pyb .code{font-family:var(--mono);font-size:12.5px;line-height:1.55;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);padding:8px 0;overflow-x:auto}
.pyb .code>div{padding:0 12px;white-space:pre;border-left:3px solid transparent;min-height:1.55em}
.pyb .code>div.on{background:var(--accent-soft);border-left-color:var(--accent)}
.pyb .out{font-family:var(--mono);font-size:12.5px;border:1px dashed var(--border);border-radius:10px;padding:8px 12px;min-height:2.4em;white-space:pre-wrap;color:var(--text);background:var(--surface)}
.pyb .out .err{color:var(--err)}
.pyb .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin:8px 0 4px}
.pyb .grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:12px;align-items:start}
@media (max-width:720px){.pyb .grid{grid-template-columns:1fr}}
.pyb .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:2px 0}
.pyb .cell{font-family:var(--mono);font-size:12.5px;padding:3px 9px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)}
.pyb .cell.hot{border-color:var(--accent);background:var(--accent-soft)}
.pyb .cell.ok{border-color:var(--ok)}
.pyb .cell.bad{border-color:var(--err);color:var(--err)}
.pyb .cell.dim{opacity:.45}
.pyb .cell.new{animation:capin .35s ease both}
.pyb .box{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--surface-2);margin-bottom:8px}
.pyb .box.hot{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}
.pyb .box.miss{border-style:dashed;opacity:.75}
.pyb .box.bad{border-color:var(--err)}
.pyb .box h5{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)}
.pyb .kv{font-family:var(--mono);font-size:12.5px;color:var(--text);padding:1px 0}
.pyb .kv b{color:var(--accent)}
.pyb .kv.hot{background:var(--accent-soft);border-radius:4px}
.pyb .note{font-size:12.5px;color:var(--text-2)}
.pyb .pillx{display:inline-block;font-family:var(--mono);font-size:12px;padding:2px 10px;border-radius:999px;border:1px solid var(--border);color:var(--text-3)}
.pyb .pillx.live{border-color:var(--err);color:var(--err);background:color-mix(in srgb,var(--err) 10%,transparent)}
.pyb .pillx.ok{border-color:var(--ok);color:var(--ok)}
.pyb .arrow{color:var(--text-3);font-family:var(--mono)}
` }));
    }
    root.classList.add('pyb');
    let si = 0; let k = 0; let running = false; let gen = 0;
    const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': opt.segLabel || 'Scenario' });
    S.forEach((s, i) => { const b = el('button', { text: s.label, class: i === 0 ? 'on' : '' }); b.addEventListener('click', () => { si = i; [...seg.children].forEach((x, j) => x.classList.toggle('on', j === i)); reset(); }); seg.append(b); });
    const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
    const bStep = el('button', { class: 'btn', text: 'Step ›' });
    const bReset = el('button', { class: 'btn', text: '↺ Reset' });
    const counter = el('span', { class: 'tiny' });
    const codeHost = el('div', { class: 'code' });
    const stateHost = el('div');
    const outHost = el('div', { class: 'out', 'aria-live': 'polite' });
    const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
    root.append(el('div', { class: 'w-controls' }, seg),
      el('div', { class: 'grid' },
        el('div', null, el('div', { class: 'lbl', text: 'code' }), codeHost, el('div', { class: 'lbl', text: 'output (stdout)' }), outHost),
        el('div', null, el('div', { class: 'lbl', text: opt.stateLabel || 'what Python holds' }), stateHost)),
      el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, counter), narr);
    function render() {
      const s = S[si]; const st = k ? s.steps[k - 1] : null;
      const on = st ? [].concat(st.line == null ? [] : st.line) : [];
      codeHost.innerHTML = '';
      s.code.forEach((ln, i) => codeHost.append(el('div', { class: on.includes(i) ? 'on' : '', html: ln ? IA.highlight(ln, s.lang || 'python') : ' ' })));
      const outs = []; for (let i = 0; i < k; i++) if (s.steps[i].out != null) outs.push(s.steps[i]);
      outHost.innerHTML = outs.map((o) => o.err ? '<span class="err">' + ctx.esc(o.out) + '</span>' : ctx.esc(o.out)).join('\n');
      stateHost.innerHTML = renderState(st ? st.st : (s.init || {}), s, k);
      narr.firstChild.innerHTML = st ? st.cap : (s.intro || 'Press <b>Play</b> or <b>Step</b> to run the code one line at a time.');
      counter.textContent = `step ${k} / ${s.steps.length}`;
      bStep.disabled = k >= s.steps.length;
    }
    function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; render(); }
    function step() { if (k >= S[si].steps.length) return false; k++; render(); return true; }
    bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
    bReset.addEventListener('click', reset);
    bPlay.addEventListener('click', async () => {
      if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
      if (reduced) { k = S[si].steps.length; render(); return; }
      if (k >= S[si].steps.length) reset();
      running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
      while (running && g === gen && step()) await sleep(1900);
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    });
    reset();
  }
});

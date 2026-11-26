/* Spark architecture: driver, cluster manager, executors and task scheduling; plus Spark Connect. */
IA.widget('spark-architecture', (root, ctx) => {
  const W = 760, H = 320, MID = 'sa-arr', ARIA = 'Driver, cluster manager and executors exchanging messages';
  const N = (id, x, y, label, sub, w = 150, h = 54) => ({ id, x, y, w, h, label, sub });
  const E = (id, a, b, label) => ({ id, a, b, label });
  const SCENES = [
    { name: 'Run a job', intro: 'One application = one driver + many executors. Press Play to follow <code>df.groupBy("country").count().show()</code>.',
      code: 'spark = SparkSession.builder.appName("orders").getOrCreate()\ndf = spark.read.parquet("s3://orders/")   # 3 partitions\ndf.groupBy("country").count().show()     # action',
      groups: [{ x: 300, y: 150, w: 450, h: 165, label: 'worker nodes' }],
      nodes: [N('drv', 20, 40, 'Driver', 'SparkSession + scheduler', 200, 64), N('cm', 470, 30, 'Cluster manager', 'YARN / K8s / Standalone', 210), N('e1', 315, 200, 'Executor 1', '2 cores', 130, 80), N('e2', 460, 200, 'Executor 2', '2 cores', 130, 80), N('e3', 605, 200, 'Executor 3', '2 cores', 130, 80), N('st', 20, 220, 'Storage', 'S3 / HDFS / JDBC', 200, 64)],
      edges: [E('ask', [220, 60], [470, 55], 'request executors'), E('l1', [575, 84], [380, 200]), E('l2', [575, 84], [525, 200], 'launch'), E('l3', [575, 84], [670, 200]), E('t1', [220, 96], [380, 200], 'tasks'), E('t2', [220, 96], [525, 200]), E('t3', [220, 96], [670, 200]), E('r1', [315, 250], [220, 250], 'read partitions'), E('back', [380, 200], [150, 104], 'results')],
      steps: [
        { on: ['drv'], t: '<code>spark-submit</code> (or your notebook) starts the <b>driver</b>: your Python program plus a JVM holding the <code>SparkSession</code>.' },
        { on: ['drv', 'cm'], edges: ['ask'], t: 'The driver asks the <b>cluster manager</b> for executors (e.g. 3 × 2 cores, 4 GB each).' },
        { on: ['cm', 'e1', 'e2', 'e3'], edges: ['l1', 'l2', 'l3'], t: 'The cluster manager starts <b>executor</b> JVMs on worker nodes. They register back with the driver.' },
        { on: ['drv'], labels: { drv: 'job → 2 stages → 3+N tasks' }, t: 'Your code only built a plan until <code>show()</code>. The action makes the driver create a <b>job</b>, split it into <b>stages</b> at the shuffle, and each stage into one <b>task per partition</b>.' },
        { on: ['drv', 'e1', 'e2', 'e3'], edges: ['t1', 't2', 't3'], labels: { e1: 'task 0 running', e2: 'task 1 running', e3: 'task 2 running' }, t: 'The scheduler sends tasks to free cores. 2 cores per executor = 2 tasks at once per executor.' },
        { on: ['e1', 'st'], edges: ['r1'], t: 'Executors read their partitions directly from storage. Data does not flow through the driver.' },
        { on: ['e1', 'e2', 'e3'], labels: { e1: 'shuffle by country', e2: 'shuffle by country', e3: 'shuffle by country' }, t: 'Stage 1 writes shuffle files; stage 2 tasks fetch the rows for “their” countries from every executor.' },
        { on: ['drv', 'e1'], edges: ['back'], labels: { drv: 'prints 20 rows' }, t: 'Only the small final result (the rows <code>show()</code> needs) comes back to the driver. <code>collect()</code> on a huge DataFrame would bring it <i>all</i> back and crash the driver.' }] },
    { name: 'Spark Connect (3.4+)', intro: 'Spark Connect splits the client from the driver. Your app sends unresolved plans over gRPC; the driver runs on the server.',
      code: 'from pyspark.sql import SparkSession\nspark = SparkSession.builder.remote("sc://spark-host:15002").getOrCreate()\nspark.range(10).filter("id % 2 = 0").count()',
      nodes: [N('cl', 20, 120, 'Thin client', 'Python / Scala / Go', 170, 64), N('srv', 300, 110, 'Spark Connect server', 'driver + SparkSession', 210, 84), N('ex', 600, 40, 'Executors', 'run tasks', 140), N('ex2', 600, 200, 'Executors', 'run tasks', 140)],
      edges: [E('g', [190, 140], [300, 140], 'gRPC: plan'), E('x1', [510, 140], [600, 70]), E('x2', [510, 160], [600, 226]), E('ar', [300, 170], [190, 170], 'Arrow batches')],
      steps: [
        { on: ['cl'], t: 'The client builds a DataFrame plan locally. No JVM is needed in the client process.' },
        { on: ['cl', 'srv'], edges: ['g'], t: 'On an action, the plan (protobuf) goes over <b>gRPC</b> (default port 15002) to the server.' },
        { on: ['srv', 'ex', 'ex2'], edges: ['x1', 'x2'], t: 'The server-side driver optimises and runs it on executors as usual.' },
        { on: ['cl', 'srv'], edges: ['ar'], t: 'Results stream back as Apache Arrow batches. Trade-off: the RDD API and <code>SparkContext</code> are not available over Connect.' }] }
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

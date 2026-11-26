/* PySpark setup: what actually runs when you `pip install pyspark` and start a session, vs notebooks/Databricks. */
IA.widget('pyspark-setup', (root, ctx) => {
  const W = 760, H = 300, MID = 'ps-arr', ARIA = 'Processes involved in a local PySpark session';
  const N = (id, x, y, label, sub, w = 170, h = 60) => ({ id, x, y, w, h, label, sub, fs: 12 });
  const E = (id, a, b, label) => ({ id, a, b, label });
  const SCENES = [
    { name: 'Local (pip)', intro: 'One laptop, two processes: Python and a JVM. Press Play.',
      groups: [{ x: 290, y: 10, w: 460, h: 280, label: 'JVM (needs Java 17+ for Spark 4.x)' }],
      nodes: [N('pip', 20, 20, 'pip install pyspark', 'Python pkg + Spark jars', 230), N('py', 20, 130, 'python app.py', 'your code', 230), N('jvm', 320, 130, 'Driver JVM', 'SparkSession', 180), N('t', 550, 60, 'executor threads', 'local[*] = 1 per core', 180), N('ui', 550, 200, 'Spark UI', 'localhost:4040', 180)],
      edges: [E('i', [135, 80], [135, 130], 'installs'), E('g', [250, 160], [320, 160], 'Py4J'), E('x', [500, 150], [550, 90], 'tasks'), E('u', [500, 175], [550, 225])],
      steps: [
        { on: ['pip'], code: 'python -m venv .venv && source .venv/bin/activate\npip install "pyspark==4.0.*"   # or 3.5.* ; check the docs for supported Pythons\njava -version                  # Spark 4: 17 or 21. Spark 3.5: 8, 11 or 17', t: 'The PyPI package bundles the Spark jars (hundreds of MB). It does <b>not</b> bundle Java.' },
        { on: ['py'], code: 'from pyspark.sql import SparkSession\nspark = (SparkSession.builder\n         .master("local[*]")\n         .appName("hello")\n         .getOrCreate())', t: 'Your script imports pyspark and asks for a SparkSession.' },
        { on: ['py', 'jvm'], edges: ['g'], t: 'PySpark launches a JVM (via <code>spark-submit</code> under the hood) and talks to it through <b>Py4J</b>. No Java on PATH / <code>JAVA_HOME</code>? This is where you get “Java gateway process exited”.' },
        { on: ['jvm', 't'], edges: ['x'], t: '<code>local[*]</code>: driver and executor share one JVM; tasks run on threads, one per core. Same API as a cluster.' },
        { on: ['jvm', 'ui'], edges: ['u'], t: 'Open the Spark UI at <code>http://localhost:4040</code> (4041 if 4040 is taken) to see jobs and stages.' },
        { on: ['py', 'jvm'], warn: ['py'], labels: { py: 'Python UDF: rows → Python workers' }, t: 'DataFrame operations run in the JVM. Python UDFs and RDD lambdas need separate Python worker processes and serialisation, which is slower.' }] },
    { name: 'Notebook / Databricks', intro: 'In Databricks (and most managed platforms) the cluster and the <code>spark</code> object already exist.',
      nodes: [N('nb', 20, 120, 'Notebook cell', 'browser', 170), N('drv', 280, 120, 'Cluster driver', 'spark is predefined', 190), N('e1', 570, 40, 'Worker 1', 'executor', 170), N('e2', 570, 200, 'Worker 2', 'executor', 170)],
      edges: [E('a', [190, 150], [280, 150], 'run cell'), E('b', [470, 140], [570, 70]), E('c', [470, 160], [570, 226])],
      steps: [
        { on: ['nb'], code: 'df = spark.read.table("main.sales.orders")   # Unity Catalog: catalog.schema.table\ndisplay(df.limit(10))', t: 'No install, no builder: a <code>spark</code> session is predefined. <code>display()</code> is a Databricks notebook helper, not PySpark.' },
        { on: ['nb', 'drv'], edges: ['a'], t: 'The cell runs on the cluster’s driver. The Spark version is fixed by the <b>Databricks Runtime</b> you pick.' },
        { on: ['drv', 'e1', 'e2'], edges: ['b', 'c'], t: 'Work fans out to workers. Libraries you <code>%pip install</code> must be installed on the cluster, not just your laptop.' }] }
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

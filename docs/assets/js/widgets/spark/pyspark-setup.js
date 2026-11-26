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

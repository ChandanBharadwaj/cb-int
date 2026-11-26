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

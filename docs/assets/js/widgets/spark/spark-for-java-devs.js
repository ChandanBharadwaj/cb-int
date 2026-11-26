/* Spark for Java developers: where code runs: Py4J driver bridge, executor JVMs, Python workers (pickle vs Arrow), Spark Connect. */
IA.widget('spark-for-java-devs', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const N = {
    py: { x: 20, y: 30, w: 150, l: 'Python script', s: 'your code' },
    jvm: { x: 250, y: 30, w: 170, l: 'Driver JVM', s: 'Catalyst planner' },
    srv: { x: 250, y: 30, w: 170, l: 'Spark Connect server', s: 'driver JVM, remote' },
    e1: { x: 520, y: 30, w: 210, l: 'Executor JVM', s: 'codegen tasks' },
    pw: { x: 520, y: 170, w: 210, l: 'Python worker', s: 'runs your UDF' }
  };
  const PATHS = {
    builtin: { label: 'Built-in functions', nodes: ['py', 'jvm', 'e1'], steps: [
      [['py'], [], 'Your script calls <code>df.withColumn("u", F.upper("name"))</code>. Nothing runs on data yet.'],
      [['py', 'jvm'], [['py', 'jvm', 'Py4J call']], 'Py4J forwards the call to the driver JVM, which adds an expression to the logical plan.'],
      [['jvm', 'e1'], [['jvm', 'e1', 'tasks (bytecode)']], 'On an action, Catalyst optimises the plan, generates Java bytecode (whole-stage codegen) and ships tasks to executors.'],
      [['e1'], [], 'Executors process rows in Spark’s binary format, entirely in the JVM. <b>No Python on the data path.</b> Same speed as Scala or Java.']] },
    udf: { label: 'Python UDF', nodes: ['py', 'jvm', 'e1', 'pw'], steps: [
      [['py'], [], 'A row-wise <code>@udf</code>. The function itself is pickled (cloudpickle) on the driver.'],
      [['py', 'jvm', 'e1'], [['py', 'jvm', 'Py4J + pickled fn'], ['jvm', 'e1', 'tasks']], 'The plan contains a <code>BatchEvalPython</code> node. Tasks go to executors with the pickled function.'],
      [['e1', 'pw'], [['e1', 'pw', 'rows (pickled)']], 'The executor JVM starts or reuses a Python worker and streams rows to it, serialized with pickle.'],
      [['pw', 'e1'], [['pw', 'e1', 'results (pickled)']], 'Python calls your function per row and sends results back. Two serializations per row, plus a Python interpreter per core. Catalyst can’t see inside.']] },
    pandas: { label: 'pandas UDF (Arrow)', nodes: ['py', 'jvm', 'e1', 'pw'], steps: [
      [['py'], [], 'A <code>@pandas_udf</code> takes and returns pandas Series.'],
      [['py', 'jvm', 'e1'], [['py', 'jvm', 'Py4J'], ['jvm', 'e1', 'tasks']], 'The plan has <code>ArrowEvalPython</code>. Tasks go to executors as before.'],
      [['e1', 'pw'], [['e1', 'pw', 'Arrow batches (columnar)']], 'Rows are converted to <b>Arrow</b> column batches (10,000 rows by default) and sent to the worker.'],
      [['pw', 'e1'], [['pw', 'e1', 'Arrow batch back']], 'Your vectorised pandas/NumPy code runs once per batch. Far less overhead than row-wise pickle, still slower than built-ins.']] },
    connect: { label: 'Spark Connect', nodes: ['py', 'srv', 'e1'], steps: [
      [['py'], [], 'Spark Connect (3.4+): the client is a thin library. No local JVM.'],
      [['py', 'srv'], [['py', 'srv', 'gRPC: unresolved plan']], 'DataFrame calls build a plan in the client, sent as protobuf over gRPC when you run an action.'],
      [['srv', 'e1'], [['srv', 'e1', 'tasks']], 'The server analyses, optimises and runs it on the cluster like any Spark job.'],
      [['srv', 'py'], [['srv', 'py', 'Arrow results']], 'Results stream back as Arrow batches. Clients can be Python, Scala, Go, or a JVM app. Client crashes don’t kill the driver.']] }
  };
  let mode = 'builtin'; let k = 0; let running = false; let gen = 0;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Code path' });
  Object.entries(PATHS).forEach(([v, p]) => { const b = el('button', { text: p.label, class: v === mode ? 'on' : '' }); b.addEventListener('click', () => { mode = v; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 760 270', role: 'img', 'aria-label': 'Boxes for Python, driver JVM, executor JVM and Python worker with arrows for data flow' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  root.append(el('div', { class: 'w-controls' }, seg), el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr);
  const c = (id) => { const n = N[id]; return [n.x + n.w / 2, n.y + 35]; };
  function render() {
    const P = PATHS[mode]; const [hot, arrows, text] = P.steps[k]; const H = new Set(hot);
    stage.innerHTML = '';
    stage.append(svg('defs', null, svg('marker', { id: 'jd-arr', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: 'var(--accent)' }))));
    stage.append(svg('text', { x: 20, y: 20, 'font-size': 11, fill: 'var(--text-3)', text: mode === 'connect' ? 'client machine' : 'driver machine' }), svg('text', { x: 520, y: 20, 'font-size': 11, fill: 'var(--text-3)', text: 'worker node' }));
    P.nodes.forEach((id) => { const n = N[id]; const on = H.has(id);
      const r = svg('rect', { x: n.x, y: n.y, width: n.w, height: 70, rx: 10, fill: on ? 'var(--accent-soft)' : 'var(--surface-2)', stroke: on ? 'var(--accent)' : 'var(--border)', 'stroke-width': on ? 2.5 : 1 });
      if (!reduced) r.style.transition = 'all .4s';
      stage.append(r, svg('text', { x: n.x + n.w / 2, y: n.y + 30, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, fill: 'var(--text)', text: n.l }),
        svg('text', { x: n.x + n.w / 2, y: n.y + 50, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-2)', text: n.s })); });
    arrows.forEach(([a, b, l], i) => {
      const [x1, y1] = c(a); const [x2, y2] = c(b); const na = N[a], nb = N[b];
      let sx, sy, ex, ey;
      if (na.y === nb.y) { const dir = x2 > x1 ? 1 : -1; sx = dir > 0 ? na.x + na.w : na.x; ex = dir > 0 ? nb.x : nb.x + nb.w; sy = ey = y1 + (dir > 0 ? -8 : 12); }
      else { const dir = y2 > y1 ? 1 : -1; sx = ex = x1 + (dir > 0 ? -60 : 20); sy = dir > 0 ? na.y + 70 : na.y; ey = dir > 0 ? nb.y : nb.y + 70; }
      const p = svg('path', { d: `M${sx} ${sy} L${ex} ${ey}`, stroke: 'var(--accent)', 'stroke-width': 2.5, fill: 'none', 'marker-end': 'url(#jd-arr)' });
      if (!reduced) { p.style.strokeDasharray = '400'; p.style.strokeDashoffset = '400'; p.style.transition = 'stroke-dashoffset .9s ease'; requestAnimationFrame(() => { p.style.strokeDashoffset = '0'; }); }
      const vert = na.y !== nb.y; const down = vert && nb.y > na.y;
      const lx = vert ? sx + (down ? -6 : 6) : (sx + ex) / 2; const ly = (sy + ey) / 2 - (vert ? 0 : 8) + i * 0;
      stage.append(p, svg('text', { x: lx, y: ly, 'text-anchor': vert ? (down ? 'end' : 'start') : 'middle', 'font-size': 11, fill: 'var(--accent)', text: l }));
    });
    narr.firstChild.innerHTML = text;
    bStep.disabled = k >= P.steps.length - 1;
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; render(); }
  function step() { if (k >= PATHS[mode].steps.length - 1) return false; k++; render(); return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= PATHS[mode].steps.length - 1) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 700 : 2600);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

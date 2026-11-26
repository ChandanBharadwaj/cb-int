/* DataFrame basics: each call returns a new immutable DataFrame; schema flows through; show() runs it. */
IA.widget('dataframes-basics', (root, ctx) => {
  const W = 760, H = 300, MID = 'db-arr', ARIA = 'A chain of DataFrames with their schemas';
  const N = (id, x, y, label, sub, w = 170, h = 60) => ({ id, x, y, w, h, label, sub, fs: 12 });
  const E = (id, a, b, label) => ({ id, a, b, label });
  const SCENES = [
    { name: 'Build a pipeline', intro: 'Every method returns a <b>new</b> DataFrame. Watch the schema change at each box. Nothing is read until <code>show()</code>.',
      nodes: [N('src', 20, 20, 'orders.csv', 'file on disk'), N('d0', 20, 120, 'df', 'id, country, amount, ts'), N('d1', 210, 120, 'df.select(...)', 'id, country, amount'), N('d2', 400, 120, '.filter(...)', 'same columns, fewer rows'), N('d3', 590, 120, '.withColumn(...)', '+ amount_eur', 160), N('show', 590, 230, 'show()', 'ACTION', 160, 54), N('plan', 210, 230, 'Catalyst plan', 'optimised', 360, 54)],
      edges: [E('r', [105, 80], [105, 120], 'spark.read'), E('a', [190, 150], [210, 150]), E('b', [380, 150], [400, 150]), E('c', [570, 150], [590, 150]), E('s', [670, 180], [670, 230]), E('p', [590, 256], [570, 256])],
      steps: [
        { on: ['src', 'd0'], edges: ['r'], code: 'df = spark.read.csv("orders.csv", header=True, schema="id INT, country STRING, amount DOUBLE, ts TIMESTAMP")\ndf.printSchema()', t: '<code>spark.read</code> gives a DataFrame: rows + a <b>schema</b> (column names and types). With an explicit schema, Spark doesn’t even open the file yet.' },
        { on: ['d0', 'd1'], edges: ['a'], code: 'from pyspark.sql import functions as F\ndf2 = df.select("id", "country", "amount")', t: '<code>select</code> picks columns. <code>df</code> is untouched: DataFrames are <b>immutable</b>, like Java <code>String</code>.' },
        { on: ['d1', 'd2'], edges: ['b'], code: 'df3 = df2.filter((F.col("amount") > 100) & (F.col("country") == "DE"))', t: '<code>filter</code> (alias <code>where</code>) keeps matching rows. Combine conditions with <code>&amp;</code> / <code>|</code> and parentheses, not Python <code>and</code>.' },
        { on: ['d2', 'd3'], edges: ['c'], code: 'df4 = df3.withColumn("amount_eur", F.round(F.col("amount") * 0.92, 2))', t: '<code>withColumn</code> adds (or replaces) one column from an expression.' },
        { on: ['d3', 'plan'], edges: ['p'], labels: { plan: 'filter pushed into the scan; ts never read' }, code: 'df4.explain()', t: 'Still nothing has run. Spark’s optimiser (<b>Catalyst</b>) sees the whole chain and rewrites it: push the filter down, prune unused columns.' },
        { on: ['show', 'plan'], edges: ['s'], labels: { show: 'reads file → 20 rows' }, code: 'df4.show(5, truncate=False)', t: '<code>show()</code> is an <b>action</b>: now a job runs and prints up to 20 rows (truncated to 20 chars per cell) by default.' }] }
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

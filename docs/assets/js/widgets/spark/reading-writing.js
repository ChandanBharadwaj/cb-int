/* Reading & writing: schema inference vs explicit schema, output directory layout with partitionBy, save modes. */
IA.widget('reading-writing', (root, ctx) => {
  const W = 760, H = 320, MID = 'rw-arr', ARIA = 'Files being read into partitions and written out as directories';
  const N = (id, x, y, label, sub, w = 150, h = 50) => ({ id, x, y, w, h, label, sub, fs: 12 });
  const E = (id, a, b, label) => ({ id, a, b, label });
  const SCENES = [
    { name: 'Read', intro: 'Reading CSV: inferring the schema costs an extra pass over the data. Giving it costs nothing.',
      nodes: [N('f1', 20, 30, 'part1.csv', '1.2 GB'), N('f2', 20, 130, 'part2.csv', '1.2 GB'), N('f3', 20, 230, 'part3.csv', '0.4 GB'), N('sc', 300, 130, 'schema', '?', 170, 60), N('p', 580, 130, 'DataFrame', '~23 partitions', 160, 60)],
      edges: [E('a', [170, 55], [300, 150]), E('b', [170, 155], [300, 160], 'scan to infer'), E('c', [170, 255], [300, 170]), E('d', [470, 160], [580, 160], 'lazy')],
      steps: [
        { on: ['f1', 'f2', 'f3', 'sc'], edges: ['a', 'b', 'c'], labels: { sc: 'inferring… (extra job)' }, code: 'df = spark.read.csv("s3://raw/orders/", header=True, inferSchema=True)', t: '<code>inferSchema=True</code> makes Spark <b>read the data</b> to guess types, before you’ve called any action.' },
        { on: ['sc'], warn: ['sc'], labels: { sc: 'zip: int  (07001 → 7001)' }, t: 'Guesses can be wrong: ZIP codes become ints and lose leading zeros; a mostly-empty column becomes string.' },
        { on: ['sc', 'p'], edges: ['d'], labels: { sc: 'explicit DDL schema' }, code: 'schema = "id BIGINT, zip STRING, amount DECIMAL(10,2), ts TIMESTAMP"\ndf = (spark.read.option("header", True).option("mode", "FAILFAST")\n        .schema(schema).csv("s3://raw/orders/"))', t: 'An explicit schema is faster and deterministic. <code>mode</code>: PERMISSIVE (default, bad fields → null), DROPMALFORMED, or FAILFAST.' },
        { on: ['p'], labels: { p: '2.8 GB / 128 MB ≈ 23' }, t: 'Splittable files are cut into ~128 MB input partitions (<code>spark.sql.files.maxPartitionBytes</code>), so one big file can still be read in parallel. Gzipped CSV is not splittable: 1 file = 1 task.' }] },
    { name: 'Write + partitionBy', intro: 'A write produces a <b>directory</b>, not one file: one part-file per task, per partition value.',
      nodes: [N('t0', 20, 40, 'task 0', 'rows: DE, FR'), N('t1', 20, 140, 'task 1', 'rows: DE, IN'), N('t2', 20, 240, 'task 2', 'rows: IN'), N('de', 330, 30, 'country=DE/', '', 190), N('fr', 330, 105, 'country=FR/', '', 190), N('in', 330, 180, 'country=IN/', '', 190), N('ok', 330, 255, '_SUCCESS', 'marker file', 190), N('q', 580, 130, 'reader', 'WHERE country=\'IN\'', 160, 60)],
      edges: [E('a', [170, 60], [330, 55]), E('b', [170, 70], [330, 130]), E('c', [170, 160], [330, 60]), E('d', [170, 170], [330, 200]), E('e', [170, 265], [330, 210]), E('f', [520, 205], [580, 165], 'reads only IN')],
      steps: [
        { on: ['t0', 't1', 't2'], code: '(df.write.mode("overwrite")\n   .partitionBy("country")\n   .parquet("s3://lake/orders/"))', t: 'Three tasks each hold a mix of countries.' },
        { on: ['t0', 'de', 'fr'], edges: ['a', 'b'], labels: { de: 'part-00000…parquet', fr: 'part-00000…parquet' }, t: '<code>partitionBy("country")</code>: each task writes one file per country value it holds, into <code>country=&lt;value&gt;/</code>. The column is moved into the path, not stored in the file.' },
        { on: ['t1', 't2', 'de', 'in'], edges: ['c', 'd', 'e'], labels: { de: '2 files', in: '2 files' }, t: 'Files = tasks × distinct values. 200 tasks × 1,000 values can mean 200,000 tiny files. Repartition by the same column first to get ~1 file per value.' },
        { on: ['ok'], labels: { ok: 'job committed' }, t: 'The committer writes <code>_SUCCESS</code> when the job finishes. Readers should ignore half-written output from failed jobs.' },
        { on: ['in', 'q'], edges: ['f'], t: '<b>Partition pruning</b>: a filter on <code>country</code> lists only the matching directories. Pick low-cardinality columns you filter on (date, region), never ids.' }] },
    { name: 'Save modes', intro: 'What happens when <code>s3://lake/orders/</code> already exists? Step through the four modes.',
      nodes: [N('old', 40, 120, 'existing data', 'country=DE, FR', 200, 64), N('new', 300, 120, 'new DataFrame', 'country=FR, IN', 200, 64), N('res', 560, 120, 'result', '', 180, 64)],
      edges: [E('a', [500, 152], [560, 152])],
      steps: [
        { warn: ['res'], edges: ['a'], labels: { res: 'AnalysisException' }, code: 'df.write.parquet(path)                    # mode "errorifexists" (default)', t: '<b>errorifexists</b> / <code>error</code> (default): fail if the path exists. Safe, so a rerun can’t silently clobber data.' },
        { on: ['old', 'new', 'res'], edges: ['a'], labels: { res: 'DE, FR, FR, IN' }, code: 'df.write.mode("append").parquet(path)', t: '<b>append</b>: add new files next to old ones. Rerunning a failed job appends <b>duplicates</b>.' },
        { on: ['new', 'res'], warn: ['old'], edges: ['a'], labels: { res: 'FR, IN  (DE gone!)', old: 'deleted' }, code: 'df.write.mode("overwrite").partitionBy("country").parquet(path)', t: '<b>overwrite</b> with the default static mode replaces the <i>whole</i> table: DE is gone.' },
        { on: ['old', 'new', 'res'], edges: ['a'], labels: { res: 'DE (kept), FR (new), IN' }, code: 'spark.conf.set("spark.sql.sources.partitionOverwriteMode", "dynamic")\ndf.write.mode("overwrite").partitionBy("country").parquet(path)', t: 'With <code>partitionOverwriteMode=dynamic</code>, only partitions present in the new data (FR, IN) are replaced. DE survives.' },
        { on: ['old', 'res'], edges: ['a'], labels: { res: 'DE, FR (unchanged)' }, code: 'df.write.mode("ignore").parquet(path)', t: '<b>ignore</b>: if the path exists, silently do nothing. Easy to miss in logs.' }] }
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

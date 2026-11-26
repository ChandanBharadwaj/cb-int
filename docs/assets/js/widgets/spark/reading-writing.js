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

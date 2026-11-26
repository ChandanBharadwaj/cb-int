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

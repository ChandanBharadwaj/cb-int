/* RDD basics: lazy lineage building, actions, narrow vs wide dependencies across partitions. */
IA.widget('rdd-basics', (root, ctx) => {
  const W = 760, H = 320, MID = 'rb-arr', ARIA = 'An RDD lineage graph across three partitions';
  const N = (id, x, y, label, sub, w = 120, h = 48) => ({ id, x, y, w, h, label, sub, fs: 12 });
  const E = (id, a, b, label) => ({ id, a, b, label });
  const cols = [20, 170, 320, 470, 620]; const rows = [40, 130, 220];
  const names = ['textFile', 'flatMap', 'map', 'reduceByKey', 'collect'];
  const nodes = []; const edges = [];
  names.forEach((nm, c) => rows.forEach((y, r) => nodes.push(N(`${c}${r}`, cols[c], y, c === 4 ? (r === 1 ? 'driver' : '') : `P${r}`, c === 4 ? (r === 1 ? 'list' : '') : nm, 120, 48))));
  const vis = nodes.filter((n) => !(n.id[0] === '4' && n.id[1] !== '1'));
  for (let c = 0; c < 2; c++) rows.forEach((y, r) => edges.push(E(`n${c}${r}`, [cols[c] + 120, y + 24], [cols[c + 1], y + 24])));
  rows.forEach((y, r) => rows.forEach((y2, r2) => edges.push(E(`w${r}${r2}`, [cols[2] + 120, y + 24], [cols[3], y2 + 24]))));
  rows.forEach((y, r) => edges.push(E(`c${r}`, [cols[3] + 120, y + 24], [cols[4], rows[1] + 24])));
  const all = (p) => rows.map((_, r) => p + r);
  const wide = []; rows.forEach((_, r) => rows.forEach((_, r2) => wide.push(`w${r}${r2}`)));
  const SCENES = [
    { name: 'Word count', intro: 'Each column is one RDD; each box is one partition. Nothing runs until the action at the end.',
      code: 'lines  = sc.textFile("logs/*.txt", 3)          # RDD[str]\nwords  = lines.flatMap(lambda l: l.split())    # transformation\npairs  = words.map(lambda w: (w, 1))           # transformation\ncounts = pairs.reduceByKey(lambda a, b: a + b) # transformation (wide)\ncounts.collect()                               # ACTION → runs',
      nodes: vis, edges,
      steps: [
        { on: all('0'), labels: { '00': 'planned', '01': 'planned', '02': 'planned' }, t: '<code>textFile</code> returns instantly. It only records “read these files into 3 partitions”.' },
        { on: [...all('0'), ...all('1')], labels: { 10: 'planned', 11: 'planned', 12: 'planned' }, t: '<code>flatMap</code> adds a step to the <b>lineage</b>. Still no data read. Each output partition depends on exactly one parent partition: a <b>narrow</b> dependency.' },
        { on: [...all('1'), ...all('2')], labels: { 20: 'planned', 21: 'planned', 22: 'planned' }, t: '<code>map</code>: another narrow step. Spark will later <b>pipeline</b> textFile → flatMap → map inside one task per partition.' },
        { on: [...all('2'), ...all('3')], labels: { 30: 'planned', 31: 'planned', 32: 'planned' }, t: '<code>reduceByKey</code> needs all values of a word together. Any parent partition may feed any child: a <b>wide</b> dependency, which means a <b>shuffle</b> and a stage boundary.' },
        { on: [...all('0'), ...all('1'), ...all('2')], edges: ['n00', 'n01', 'n02', 'n10', 'n11', 'n12'], labels: { 20: 'combine locally', 21: 'combine locally', 22: 'combine locally' }, t: '<code>collect()</code> is an <b>action</b>. Now a job starts. Stage 1: 3 tasks each read, split, map and pre-combine counts (map-side combine).' },
        { on: [...all('2'), ...all('3')], edges: wide, t: 'Shuffle: each word is routed to one reduce partition by hash. This is the expensive network + disk step.' },
        { on: [...all('3'), '41'], edges: ['c0', 'c1', 'c2'], labels: { 41: '[("spark", 42), …]' }, t: 'Stage 2: reduce tasks finish the sums. <code>collect</code> ships every result to the driver, so use it only on small results.' },
        { on: all('3'), warn: ['21'], labels: { 21: 'lost → recompute' }, t: 'Fault tolerance: if a partition is lost, Spark replays its lineage (read → flatMap → map) for just that partition.' }] }
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

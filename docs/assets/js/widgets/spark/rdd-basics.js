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

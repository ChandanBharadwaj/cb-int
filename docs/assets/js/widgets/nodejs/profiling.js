/* Profiling Node: a sampling profiler records one stack per ms (a time-ordered stack chart),
   then the samples are merged into a flame graph (width = samples). Before/after a fix. */
IA.widget('profiling', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-prof-style')) {
    document.head.append(el('style', { id: 'w-prof-style', text: `
.w-prof .fr { stroke: var(--surface); stroke-width: 1; }
.w-prof .c-app { fill: var(--accent-2); }
.w-prof .c-lib { fill: var(--accent); }
.w-prof .c-v8 { fill: var(--warn); }
.w-prof .c-gc { fill: var(--err); }
.w-prof .c-idle { fill: var(--surface-2); stroke: var(--border); }
.w-prof .fr.hot { stroke: var(--text); stroke-width: 2.5; }
.w-prof .fr.new { animation: w-prof-in .35s ease both; }
@keyframes w-prof-in { from { opacity: 0; } to { opacity: 1; } }
.w-prof .fl { fill: #fff; font-family: var(--mono); font-size: 10.5px; font-weight: 700; pointer-events: none; }
.w-prof .fl.d { fill: var(--text-2); }
.w-prof .t1 { fill: var(--text); font-size: 13px; font-weight: 700; }
.w-prof .t2 { fill: var(--text-3); font-size: 11.5px; }
.w-prof .ax { stroke: var(--border); stroke-width: 1; }
.w-prof .tick { stroke: var(--accent); stroke-width: 2; }
.w-prof-key { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--text-2); margin-top: 6px; }
.w-prof-key i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -2px; margin-right: 5px; }
.w-prof-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-top: 8px; }
.w-prof-tbl td, .w-prof-tbl th { padding: 3px 6px; border-bottom: 1px solid var(--border); text-align: left; }
.w-prof-tbl td.n { text-align: right; font-family: var(--mono); }
.w-prof-tbl tr.hot td { background: var(--accent-soft); font-weight: 700; }
` }));
  }
  const CAT = { handleRequest: 'app', render: 'lib', template: 'lib', escapeHtml: 'lib', 'RegExp.replace': 'v8', getProducts: 'app', 'JSON.parse': 'v8', 'pg.query': 'app', applyDiscounts: 'app', '(garbage collector)': 'gc', '(idle)': 'idle' };
  const S = {
    H: ['handleRequest'],
    R: ['handleRequest', 'render', 'template'],
    E: ['handleRequest', 'render', 'template', 'escapeHtml'],
    X: ['handleRequest', 'render', 'template', 'escapeHtml', 'RegExp.replace'],
    J: ['handleRequest', 'getProducts', 'JSON.parse'],
    Q: ['handleRequest', 'getProducts', 'pg.query'],
    D: ['handleRequest', 'applyDiscounts'],
    G: ['(garbage collector)'],
    I: ['(idle)']
  };
  const RUNS = {
    before: 'IIHQJJDHRXXEXXEXXXEXRGGXXEXXRHII'.split(''),
    after: 'IIHQJJDHRREHRGIIIIIIIIIIIIIIIIII'.split('')
  };
  const PER = 2;   // samples per step

  function tree(samples) {
    const rootN = { name: 'all', n: 0, kids: new Map() };
    samples.forEach((k) => { const st = S[k]; rootN.n++; let cur = rootN;
      st.forEach((f) => { if (!cur.kids.has(f)) cur.kids.set(f, { name: f, n: 0, kids: new Map() }); cur = cur.kids.get(f); cur.n++; }); });
    return rootN;
  }
  function selfTimes(node, acc) { node.kids.forEach((c) => { const kidSum = [...c.kids.values()].reduce((a, b) => a + b.n, 0); acc[c.name] = (acc[c.name] || 0) + c.n - kidSum; selfTimes(c, acc); }); return acc; }

  let mode = 'before'; let k = 0; let gen = 0; let playing = false; let speed = 900;
  const seg = (opts, cur, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); set(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 600 330', role: 'img', 'aria-label': 'Stack chart of samples over time and the merged flame graph' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const tbl = el('table', { class: 'w-prof-tbl' });
  const stats = el('div', { class: 'w-stats' });
  const key = el('div', { class: 'w-prof-key' }, ...[['var(--accent-2)', 'your code'], ['var(--accent)', 'template library'], ['var(--warn)', 'V8 built-ins'], ['var(--err)', 'GC'], ['var(--surface-2)', '(idle): waiting for I/O']].map(([c, t]) => el('span', null, el('i', { style: { background: c, border: '1px solid var(--border)' } }), t)));
  root.classList.add('w-prof');
  root.append(el('div', { class: 'w-controls' }, seg([['before', 'Before fix'], ['after', 'After fix: cache escaped output']], mode, (v) => { mode = v; reset(); }, 'Profile')),
    el('div', { class: 'w-stage' }, stage), key, narr,
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg([[1500, 'Slow'], [900, 'Normal'], [400, 'Fast']], speed, (v) => { speed = v; }, 'Speed')), stats, tbl);

  const total = () => RUNS[mode].length;
  const sampleSteps = () => Math.ceil(total() / PER);
  const nFrames = () => sampleSteps() + 3;   // + merge, + hot spot, + summary
  const X0 = 10; const W = 580; const FH = 17;
  const label = (g, x, y, w, name, cat) => { if (w < 26) return; const max = Math.floor(w / 6.6); g.append(svg('text', { class: 'fl' + (cat === 'idle' ? ' d' : ''), x: x + 3, y: y + 12, text: name.length > max ? name.slice(0, Math.max(1, max - 1)) + '…' : name })); };
  function render() {
    stage.innerHTML = '';
    const run = RUNS[mode]; const T = run.length; const ns = Math.min(T, k * PER);
    const shown = run.slice(0, ns);
    // stack chart (time ordered, grows downward)
    stage.append(svg('text', { class: 't1', x: X0, y: 14, text: 'stack chart: one sample per 1 ms, in time order' }));
    stage.append(svg('line', { class: 'ax', x1: X0, x2: X0 + W, y1: 22, y2: 22 }));
    const cw = W / T;
    shown.forEach((key2, i) => { S[key2].forEach((f, d) => {
      const g = svg('g'); stage.append(g);
      g.append(svg('rect', { class: `fr c-${CAT[f]}` + (i >= ns - PER && k <= sampleSteps() && !reduced ? ' new' : ''), x: X0 + i * cw, y: 24 + d * FH, width: cw, height: FH - 1 }));
    }); });
    if (k > 0 && k <= sampleSteps()) stage.append(svg('line', { class: 'tick', x1: X0 + ns * cw, x2: X0 + ns * cw, y1: 18, y2: 112 }));
    stage.append(svg('text', { class: 't2', x: X0 + W, y: 122, 'text-anchor': 'end', text: `${ns} of ${T} samples (${ns} ms)` }));
    // flame graph (merged, grows upward)
    const merged = k > sampleSteps();
    const base = 318;
    stage.append(svg('text', { class: 't1', x: X0, y: 146, text: merged ? 'flame graph: merged stacks, width = samples, x order is arbitrary' : 'flame graph: appears when the samples are merged' }));
    let hotName = null;
    if (merged) {
      const tr = tree(run); const self = selfTimes(tr, {});
      hotName = Object.entries(self).filter(([n]) => n !== '(idle)').sort((a, b) => b[1] - a[1])[0][0];
      const showHot = k >= sampleSteps() + 2;
      const draw = (node, x, depth) => {
        const kids = [...node.kids.values()].sort((a, b) => a.name.localeCompare(b.name));
        let cx = x;
        kids.forEach((c) => {
          const w = (c.n / tr.n) * W; const y = base - (depth + 1) * (FH + 1);
          const g = svg('g'); stage.append(g);
          g.append(svg('rect', { class: `fr c-${CAT[c.name]}` + (showHot && c.name === hotName ? ' hot' : '') + (k === sampleSteps() + 1 && !reduced ? ' new' : ''), x: cx, y, width: Math.max(1, w - 1), height: FH, rx: 2 }));
          g.append(svg('title', { text: `${c.name}: ${c.n} samples (${Math.round(c.n / tr.n * 100)}%)` }));
          label(g, cx, y, w, c.name, CAT[c.name]);
          draw(c, cx, depth + 1);
          cx += w;
        });
      };
      draw(tr, X0, 0);
      // table of self vs total time
      const totals = {}; const walk = (n) => n.kids.forEach((c) => { totals[c.name] = (totals[c.name] || 0) + c.n; walk(c); }); walk(tr);
      tbl.innerHTML = '';
      tbl.append(el('tr', null, el('th', { text: 'function' }), el('th', { text: 'self' }), el('th', { text: 'total' })));
      Object.keys(totals).sort((a, b) => self[b] - self[a]).forEach((n) => tbl.append(el('tr', { class: showHot && n === hotName ? 'hot' : '' },
        el('td', { text: n }), el('td', { class: 'n', text: Math.round(self[n] / T * 100) + '%' }), el('td', { class: 'n', text: Math.round(totals[n] / T * 100) + '%' }))));
    } else tbl.innerHTML = '';
    // caption
    let cap;
    const sel = (n) => Math.round((selfTimes(tree(run), {})[n] || 0) / T * 100);
    if (k === 0) cap = 'The profiler interrupts the main thread every 1 ms and records its call stack. Press Play or Step to collect samples.';
    else if (!merged) {
      const last = S[shown[shown.length - 1]];
      cap = last[0] === '(idle)' ? 'Sample: <code>(idle)</code>. The thread is waiting in the event loop, for example for a database reply. Waiting costs no CPU, so a CPU profile can’t show what you were waiting for.'
        : last[0] === '(garbage collector)' ? 'Sample: <code>(garbage collector)</code>. GC runs on the main thread too; heavy allocation shows up here.'
          : `Sample: <code>${last.join(' → ')}</code>. Columns read top-down: the caller at the top, the function actually running at the bottom.`;
    } else if (k === sampleSteps() + 1) cap = 'Merged: identical stack prefixes are combined, so each box’s width is the number of samples that include it. The order left to right is alphabetical, <b>not time</b>.';
    else if (k === sampleSteps() + 2) cap = mode === 'before'
      ? `The hot spot is the widest frame with little on top of it: <code>${hotName}</code>, with <b>${sel(hotName)}%</b> self time, called via <code>escapeHtml ← template ← render</code>. Optimize there first, not in <code>applyDiscounts</code> (${sel('applyDiscounts')}%).`
      : `After caching the escaped template output, <code>render</code> is a thin slice and most samples are <code>(idle)</code>: the same traffic now needs far less CPU. The top self time is <code>${hotName}</code> at ${sel(hotName)}%.`;
    else cap = mode === 'before' ? 'Workflow: profile under realistic load → find the widest self time → fix one thing → profile again. Switch to <b>After fix</b> to compare.' : 'Compare both runs: same requests, much less CPU. Keep the before/after profiles with the change.';
    narr.firstChild.innerHTML = cap;
    const busy = shown.filter((x) => x !== 'I').length;
    stats.innerHTML = '';
    [['samples', ns], ['CPU busy', ns ? Math.round(busy / ns * 100) + '%' : '—'], ['step', `${k}/${nFrames()}`]].forEach(([a, b]) => stats.append(el('span', { class: 'w-stat', html: `${a} <b>${b}</b>` })));
  }
  function reset() { gen++; playing = false; bPlay.textContent = '▶ Play'; k = 0; bStep.disabled = false; render(); }
  function step() { if (k >= nFrames()) { bStep.disabled = true; return false; } k++; render(); if (k >= nFrames()) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { playing = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (playing) { playing = false; bPlay.textContent = '▶ Play'; return; }
    if (reduced) { k = nFrames(); render(); bStep.disabled = true; return; }
    if (k >= nFrames()) reset();
    playing = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (playing && g === gen && step()) await sleep(k > sampleSteps() ? speed * 2.4 : speed);
    if (g === gen) { playing = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

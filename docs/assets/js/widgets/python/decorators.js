/* Decorators: definition time (decorators applied bottom-up, name bound last) and call time (the call travels
   through each wrapper layer and back), with and without functools.wraps. */
IA.widget('decorators', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-py-base')) {
    document.head.append(el('style', { id: 'w-py-base', text: `
.wpy-code{font-family:var(--mono);font-size:12.5px;line-height:1.55;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);padding:8px 0;overflow-x:auto}
.wpy-code>div{padding:0 12px;white-space:pre;border-left:3px solid transparent}
.wpy-code>div.on{background:var(--accent-soft);border-left-color:var(--accent)}
.wpy-out{font-family:var(--mono);font-size:12.5px;border:1px dashed var(--border);border-radius:10px;padding:8px 12px;min-height:2.4em;white-space:pre-wrap;color:var(--text);background:var(--surface)}
.wpy-lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin:8px 0 4px}
.wpy-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:12px;align-items:start}
@media (max-width:720px){.wpy-grid{grid-template-columns:1fr}}
` }));
  }
  if (!document.getElementById('w-pyde-style')) {
    document.head.append(el('style', { id: 'w-pyde-style', text: `
.w-pyde .ly{fill:var(--surface);stroke:var(--border);stroke-width:1.5;transition:stroke .3s,fill .3s}
.w-pyde .ly.l1{fill:var(--surface-2)}
.w-pyde .ly.new{stroke:var(--warn);stroke-width:2.5}
.w-pyde .ly.hot{stroke:var(--accent);stroke-width:3;fill:var(--accent-soft)}
.w-pyde .ly.err{stroke:var(--err);stroke-width:3}
.w-pyde .tag{fill:var(--surface);stroke:var(--accent);stroke-width:2}
.w-pyde .tag.unb{stroke:var(--border);stroke-dasharray:4 3}
.w-pyde .ar{fill:none;stroke:var(--accent);stroke-width:2}
.w-pyde .ah{fill:var(--accent)}
.w-pyde .meta{font-family:var(--mono);font-size:12.5px;display:grid;grid-template-columns:auto 1fr;gap:2px 10px}
.w-pyde .meta .bad{color:var(--err)} .w-pyde .meta .good{color:var(--ok)}
` }));
  }
  const CODE = ['@timed', '@retry(times=3)', 'def fetch(url):', '    """GET a URL."""', '    return http_get(url)', '', 'fetch("https://api")', 'print(fetch.__name__)'];
  const LAYERS = [
    { name: 'fetch  (the original function)', x: 210, y: 112, w: 362, h: 66 },
    { name: 'retry’s wrapper  (closure: func=fetch, times=3)', x: 180, y: 66, w: 422, h: 140 },
    { name: 'timed’s wrapper  (closure: func=retry’s wrapper)', x: 150, y: 22, w: 482, h: 208 }
  ];
  // vis: how many layers exist; bound: which layer the name points to; hot: active layer; note: text in that layer
  const STEPS = [
    { line: 0, vis: 0, bound: null, cap: 'Decorator expressions are evaluated first, <b>top to bottom</b>. <code>timed</code> is just a name lookup that finds a function.' },
    { line: 1, vis: 0, bound: null, cap: '<code>retry(times=3)</code> is a <b>call</b>, and it runs now. It returns the actual decorator: a closure that remembers <code>times=3</code>. This is what “parameterized decorator” means: a decorator factory.' },
    { line: 2, vis: 1, bound: null, newL: 0, cap: '<code>def</code> builds the function object. Note the name <code>fetch</code> is <b>not bound yet</b>: the decorators get the function first.' },
    { line: 1, vis: 2, bound: null, newL: 1, cap: 'Decorators are <b>applied bottom-up</b>: the nearest one first. <code>retry</code>’s decorator receives the function and returns a wrapper that closes over it.' },
    { line: 0, vis: 3, bound: null, newL: 2, cap: '<code>timed</code> receives <i>that wrapper</i> (not the original) and wraps it again.' },
    { line: 2, vis: 3, bound: 2, meta: true, cap: 'Only now is <code>fetch</code> bound, to the <b>outermost</b> wrapper. <code>@d</code> is sugar for <code>fetch = d(fetch)</code>. Check the metadata panel, then flip the <code>wraps</code> toggle.' },
    { line: 6, vis: 3, bound: 2, meta: true, hot: 2, note: 'start = perf_counter()', cap: 'A call enters the outermost layer first. <code>timed</code>’s wrapper starts its clock and calls <code>func(*args, **kwargs)</code>.' },
    { line: 6, vis: 3, bound: 2, meta: true, hot: 1, note: 'attempt 1 of 3', cap: '<code>retry</code>’s wrapper starts attempt 1.' },
    { line: 4, vis: 3, bound: 2, meta: true, hot: 0, err: true, note: 'raises TimeoutError', cap: 'The real function runs and raises.' },
    { line: 6, vis: 3, bound: 2, meta: true, hot: 1, note: 'caught · attempt 2 of 3', cap: '<code>retry</code>’s wrapper catches the exception and tries again. <code>timed</code> never sees the failure.' },
    { line: 4, vis: 3, bound: 2, meta: true, hot: 0, note: 'returns "ok"', cap: 'Second attempt succeeds.' },
    { line: 6, vis: 3, bound: 2, meta: true, hot: 2, note: 'log elapsed, return "ok"', log: true, cap: 'The return value travels back out through each layer. <code>timed</code> logs the total, including the retry, under the name it reads from <code>func.__name__</code>.' },
    { line: 7, vis: 3, bound: 2, meta: true, print: true, cap: 'Without <code>@functools.wraps(func)</code>, every decorated function reports itself as <code>wrapper</code>: logs, metrics, tracebacks, <code>help()</code> and frameworks that read signatures all get confused.' }
  ];
  let wraps = true, k = 0, gen = 0, running = false;
  const segW = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'functools.wraps' });
  [[true, 'with @functools.wraps'], [false, 'without wraps']].forEach(([v, l]) => { const b = el('button', { text: l, class: v === wraps ? 'on' : '' }); b.addEventListener('click', () => { wraps = v; [...segW.children].forEach((x) => x.classList.toggle('on', x === b)); render(); }); segW.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeHost = el('div', { class: 'wpy-code' });
  const out = el('div', { class: 'wpy-out' });
  const meta = el('div', { class: 'meta' });
  const stage = svg('svg', { viewBox: '0 0 640 250', role: 'img', 'aria-label': 'The name fetch points at nested wrapper layers around the original function' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-pyde');
  root.append(el('div', { class: 'w-controls' }, segW),
    el('div', { class: 'wpy-grid' },
      el('div', null, el('div', { class: 'wpy-lbl', text: 'code' }), codeHost, el('div', { class: 'wpy-lbl', text: 'output' }), out, el('div', { class: 'wpy-lbl', text: 'what fetch looks like from outside' }), meta),
      el('div', null, el('div', { class: 'wpy-lbl', text: 'layers' }), el('div', { class: 'w-stage' }, stage))),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  function render() {
    const n = STEPS.length; const cur = k ? STEPS[k - 1] : null;
    codeHost.innerHTML = '';
    CODE.forEach((ln, i) => codeHost.append(el('div', { class: cur && cur.line === i ? 'on' : '', html: ln ? IA.highlight(ln, 'python') : '&nbsp;' })));
    const lines = [];
    if (STEPS.slice(0, k).some((s) => s.log)) lines.push(`${wraps ? 'fetch' : 'wrapper'} took 0.20s`);
    if (STEPS.slice(0, k).some((s) => s.print)) lines.push(wraps ? 'fetch' : 'wrapper');
    out.textContent = lines.join('\n');
    meta.innerHTML = '';
    const rows = cur && cur.meta
      ? (wraps ? [['__name__', "'fetch'", 'good'], ['__doc__', "'GET a URL.'", 'good'], ['__wrapped__', 'retry’s wrapper', 'good'], ['signature', '(url)', 'good']]
        : [['__name__', "'wrapper'", 'bad'], ['__doc__', 'None', 'bad'], ['__wrapped__', 'AttributeError', 'bad'], ['signature', '(*args, **kwargs)', 'bad']])
      : [['fetch', 'not bound yet', '']];
    rows.forEach(([a, b, c]) => meta.append(el('span', { text: a }), el('span', { class: c, text: b })));
    // svg
    stage.innerHTML = '';
    const vis = cur ? cur.vis : 0;
    for (let i = vis - 1; i >= 0; i--) {
      const L = LAYERS[i];
      let cls = 'ly' + (i === 1 ? ' l1' : '');
      if (cur && cur.newL === i) cls += ' new';
      if (cur && cur.hot === i) cls += cur.err ? ' err' : ' hot';
      stage.append(svg('rect', { class: cls, x: L.x, y: L.y, width: L.w, height: L.h, rx: 14 }),
        svg('text', { x: L.x + 12, y: L.y + 18, 'font-size': 12, 'font-weight': 700, fill: 'var(--text-2)', text: L.name }));
      if (cur && cur.hot === i && cur.note) stage.append(svg('text', { x: L.x + 12, y: L.y + 38, 'font-size': 13, 'font-family': 'var(--mono)', fill: cur.err ? 'var(--err)' : 'var(--accent)', text: '▶ ' + cur.note }));
    }
    if (!vis) stage.append(svg('text', { x: 390, y: 130, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--text-3)', text: 'no function object yet' }));
    const bound = cur ? cur.bound : null;
    stage.append(svg('rect', { class: 'tag' + (bound == null ? ' unb' : ''), x: 8, y: 108, width: 96, height: 34, rx: 17 }),
      svg('text', { x: 56, y: 130, 'text-anchor': 'middle', 'font-size': 15, 'font-family': 'var(--mono)', 'font-weight': 700, fill: bound == null ? 'var(--text-3)' : 'var(--text)', text: 'fetch' }));
    if (bound != null) {
      const L = LAYERS[bound]; const y = 125;
      const p = svg('path', { class: 'ar', d: `M104 ${y} L ${L.x - 9} ${y}` });
      if (!reduced && cur === STEPS[5]) { p.style.strokeDasharray = '60'; p.style.strokeDashoffset = '60'; p.style.transition = 'stroke-dashoffset .6s ease'; requestAnimationFrame(() => requestAnimationFrame(() => { p.style.strokeDashoffset = '0'; })); }
      stage.append(p, svg('polygon', { class: 'ah', points: `${L.x},${y} ${L.x - 9},${y - 5} ${L.x - 9},${y + 5}` }));
    }
    narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: `${k}/${n}` }), el('div', { class: 't', html: cur ? cur.cap : 'Press <b>Play</b> or <b>Step</b>. Steps 1–6 happen once, when the module is imported. Steps 7–12 happen on every call.' }));
    bStep.disabled = k >= n;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = 0; render(); }
  function step() { if (k >= STEPS.length) return false; k++; render(); return k < STEPS.length; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= STEPS.length) { k = 0; render(); }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(reduced ? 900 : 2500); }
    if (g === gen) stop();
  });
  reset();
});

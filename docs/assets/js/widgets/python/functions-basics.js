/* Functions: def/return, default & keyword args, *args/**kwargs, lambda; watch how arguments bind to parameters. */
IA.widget('functions-basics', (root, ctx) => {
  const SCENES = [
    { name: 'def & return', intro: 'Define with <code>def</code>, give back a value with <code>return</code>. No return types, no <code>public static</code>.', java: 'static int[] minMax(int[] xs) { ... }  // two results needs an array or record',
      code: ['def min_max(xs):', '    return min(xs), max(xs)', '', 'lo, hi = min_max([4, 1, 9])', 'r = print("hi")'],
      steps: [
        { line: 0, vars: [['min_max', '<function min_max>', 1]], cap: '<code>def</code> runs at this point and binds the name to a function object. The body has not run yet.' },
        { line: 1, vars: [['xs', '[4, 1, 9]', 1]], cap: 'Calling it binds <code>xs</code> inside a fresh local scope.' },
        { line: 3, vars: [['lo', 1, 1], ['hi', 9, 1]], cap: '<code>return a, b</code> returns <b>one tuple</b>; the caller unpacks it.' },
        { line: 4, vars: [['lo', 1], ['hi', 9], ['r', 'None', 1]], out: 'hi', cap: 'A function with no <code>return</code> returns <code>None</code>. <code>print</code> is one of them.' }
      ] },
    { name: 'defaults & keywords', intro: 'Parameters can have defaults, and callers can pass arguments <b>by name</b> in any order.', java: 'no named args; you would write overloads or a builder',
      code: ['def greet(name, greeting="Hello", punct="!"):', '    return f"{greeting}, {name}{punct}"', '', 'greet("Ann")', 'greet("Bo", punct="?")', 'greet(greeting="Hi", name="Cy")'],
      steps: [
        { line: 3, vars: [['name', "'Ann'", 1], ['greeting', "'Hello' (default)"], ['punct', "'!' (default)"]], out: "'Hello, Ann!'", cap: 'Only the required argument; the defaults fill in the rest.' },
        { line: 4, vars: [['name', "'Bo'", 1], ['greeting', "'Hello' (default)"], ['punct', "'?'", 1]], out: "'Hello, Bo?'", cap: 'Skip <code>greeting</code> and set <code>punct</code> by name.' },
        { line: 5, vars: [['name', "'Cy'", 1], ['greeting', "'Hi'", 1], ['punct', "'!' (default)"]], out: "'Hi, Cy!'", cap: 'All by keyword, any order. Positional arguments must come before keyword ones.' }
      ] },
    { name: '*args / **kwargs', intro: '<code>*args</code> collects extra positional arguments into a tuple; <code>**kwargs</code> collects extra keyword arguments into a dict.', java: 'String... args is the varargs part; there is no **kwargs',
      code: ['def log(msg, *args, level="INFO", **extra):', '    ...', '', 'log("hi %s %s", "a", "b", user="ann", id=7)'],
      steps: [
        { line: 3, vars: [['msg', "'hi %s %s'", 1]], cap: 'The first positional argument fills <code>msg</code>.' },
        { line: 3, vars: [['msg', "'hi %s %s'"], ['args', "('a', 'b')", 1]], cap: 'Leftover positionals land in the tuple <code>args</code>.' },
        { line: 3, vars: [['msg', "'hi %s %s'"], ['args', "('a', 'b')"], ['level', "'INFO' (default)", 1]], cap: '<code>level</code> sits after <code>*args</code>, so it is <b>keyword-only</b>: it can never be filled positionally.' },
        { line: 3, vars: [['msg', "'hi %s %s'"], ['args', "('a', 'b')"], ['level', "'INFO' (default)"], ['extra', "{'user': 'ann', 'id': 7}", 1]], cap: 'Unknown keywords land in the dict <code>extra</code>. The names <code>args</code>/<code>kwargs</code> are convention; the stars do the work.' }
      ] },
    { name: 'lambda', intro: 'A <code>lambda</code> is a one-expression anonymous function, mostly used as a <code>key=</code> argument.', java: 'people.sort(Comparator.comparing(p -> p.age()))',
      code: ['people = [("ann", 31), ("bo", 25)]', 'by_age = lambda p: p[1]', 'people.sort(key=by_age)'],
      steps: [
        { line: 0, vars: [['people', "[('ann', 31), ('bo', 25)]", 1]], cap: 'A list of (name, age) tuples.' },
        { line: 1, vars: [['people', "[('ann', 31), ('bo', 25)]"], ['by_age', '<function <lambda>>', 1]], cap: '<code>lambda p: p[1]</code> is the same as <code>def f(p): return p[1]</code>. One expression, implicit return. (Assigning one to a name is legal, but style guides say use <code>def</code>.)' },
        { line: 2, vars: [['people', "[('bo', 25), ('ann', 31)]", 1], ['by_age', '<function <lambda>>']], cap: '<code>sort</code> calls the key once per item and sorts by the results.' }
      ] }
  ];
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-pyb-style')) {
    document.head.append(el('style', { id: 'w-pyb-style', text: `
.w-pyb .code{font-family:var(--mono);font-size:12.5px;line-height:1.55;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);padding:8px 0;overflow-x:auto}
.w-pyb .code>div{padding:0 12px;white-space:pre;border-left:3px solid transparent}
.w-pyb .code>div.on{background:var(--accent-soft);border-left-color:var(--accent)}
.w-pyb .out{font-family:var(--mono);font-size:12.5px;border:1px dashed var(--border);border-radius:10px;padding:8px 12px;min-height:2.4em;white-space:pre-wrap;color:var(--text);background:var(--surface)}
.w-pyb .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin:8px 0 4px}
.w-pyb .grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:start}
.w-pyb .java{font-family:var(--mono);font-size:12px;color:var(--text-2);border-left:3px solid var(--warn);padding:4px 10px;margin-top:8px;white-space:pre-wrap}
.w-pyb .vb{fill:var(--surface);stroke:var(--border);stroke-width:1.5}
.w-pyb .vb.hot{stroke:var(--accent);stroke-width:2.5;fill:var(--accent-soft)}
@media (max-width:720px){.w-pyb .grid{grid-template-columns:1fr}}
` }));
  }
  let si = 0, k = 0, gen = 0, running = false;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Example' });
  SCENES.forEach((s, i) => { const b = el('button', { text: s.name, class: i === 0 ? 'on' : '' }); b.addEventListener('click', () => { si = i; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeHost = el('div', { class: 'code' });
  const out = el('div', { class: 'out' });
  const java = el('div', { class: 'java' });
  const stage = svg('svg', { viewBox: '0 0 400 260', role: 'img', 'aria-label': 'Variables and their current values' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-pyb');
  root.append(el('div', { class: 'w-controls' }, seg),
    el('div', { class: 'grid' },
      el('div', null, el('div', { class: 'lbl', text: 'python' }), codeHost, java),
      el('div', null, el('div', { class: 'lbl', text: 'variables' }), el('div', { class: 'w-stage' }, stage), el('div', { class: 'lbl', text: 'output' }), out)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  function render() {
    const S = SCENES[si]; const n = S.steps.length; const cur = k ? S.steps[k - 1] : null;
    codeHost.innerHTML = '';
    S.code.forEach((ln, i) => codeHost.append(el('div', { class: cur && cur.line === i ? 'on' : '', html: ln ? IA.highlight(ln, 'python') : '&nbsp;' })));
    java.textContent = 'Java: ' + S.java;
    out.textContent = cur ? (cur.out || '') : '';
    stage.innerHTML = '';
    const vars = cur ? (cur.vars || []) : [];
    if (!vars.length) stage.append(svg('text', { x: 200, y: 130, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--text-3)', text: 'no variables yet' }));
    vars.forEach(([name, val, hot], i) => {
      const y = 12 + i * 48;
      const g = svg('g', null,
        svg('text', { x: 92, y: y + 25, 'text-anchor': 'end', 'font-size': 14, 'font-family': 'var(--mono)', 'font-weight': 700, fill: 'var(--text)', text: name }),
        svg('line', { x1: 98, y1: y + 20, x2: 118, y2: y + 20, stroke: 'var(--text-3)', 'stroke-width': 1.5 }),
        svg('rect', { class: 'vb' + (hot ? ' hot' : ''), x: 120, y, width: 272, height: 36, rx: 8 }),
        svg('text', { x: 132, y: y + 23, 'font-size': 13, 'font-family': 'var(--mono)', fill: hot ? 'var(--accent)' : 'var(--text-2)', text: String(val) }));
      if (hot && !reduced) { g.style.opacity = '0'; g.style.transition = 'opacity .4s'; requestAnimationFrame(() => requestAnimationFrame(() => { g.style.opacity = '1'; })); }
      stage.append(g);
    });
    narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: `${k}/${n}` }), el('div', { class: 't', html: cur ? cur.cap : S.intro }));
    bStep.disabled = k >= n;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = reduced ? SCENES[si].steps.length : 0; render(); }
  function step() { const n = SCENES[si].steps.length; if (k >= n) return false; k++; render(); return k < n; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', () => { gen++; stop(); k = 0; render(); });
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= SCENES[si].steps.length) { k = 0; render(); }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(reduced ? 900 : 2200); }
    if (g === gen) stop();
  });
  reset();
});

/* Functions: closures kept alive on the heap, default and rest parameters, and how this is bound. */
IA.widget('js-functions-basics', (root, ctx) => {
  /* ---- shared step-through player (code on the left, state picture on the right) ---- */
  const { el, svg, sleep, reduced } = ctx;
  function stepper(cfg) {
    const uid = 'nb' + Math.random().toString(36).slice(2, 8);
    if (!document.getElementById('w-nb-style')) {
      document.head.append(el('style', { id: 'w-nb-style', text: `
.w-nb-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; align-items: start; }
.w-nb-code pre { margin: 0; }
.w-nb-code .ln { display: block; padding: 0 6px; border-left: 3px solid transparent; border-radius: 3px; white-space: pre; }
.w-nb-code .ln.cur { background: var(--accent-soft); border-left-color: var(--accent); }
.w-nb-code .ln.done { opacity: .55; }
.w-nb .bx { fill: var(--surface); stroke: var(--border); }
.w-nb .bx.hot { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2; }
.w-nb .bx.ok { stroke: var(--ok); stroke-width: 2; }
.w-nb .bx.err { stroke: var(--err); stroke-width: 2; fill: color-mix(in srgb, var(--err) 10%, var(--surface)); }
.w-nb .bx.warn { stroke: var(--warn); stroke-width: 2; }
.w-nb .bx.dim { opacity: .45; }
.w-nb .bx.lane { fill: var(--surface-2); }
.w-nb .tt { fill: var(--text); font-size: 13px; font-family: var(--mono); }
.w-nb .tt.h { font-family: var(--sans); font-weight: 700; font-size: 13px; }
.w-nb .tt.m { fill: var(--text-3); font-size: 11px; font-family: var(--sans); }
.w-nb .tt.ok { fill: var(--ok); } .w-nb .tt.err { fill: var(--err); } .w-nb .tt.acc { fill: var(--accent); } .w-nb .tt.warn { fill: var(--warn); }
.w-nb .ar { stroke: var(--text-3); stroke-width: 1.6; fill: none; }
.w-nb .ar.hot { stroke: var(--accent); stroke-width: 2.2; }
.w-nb .fresh { animation: nbIn .45s ease both; }
@keyframes nbIn { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .w-nb .fresh { animation: none; } }
` }));
    }
    root.classList.add('w-nb');
    const modes = cfg.modes;
    let mi = 0; let k = 0; let gen = 0; let running = false; let speed = 2600;
    const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': cfg.modeLabel || 'Example' });
    modes.forEach((m, i) => { const b = el('button', { text: m.label, class: i === 0 ? 'on' : '' }); b.addEventListener('click', () => { mi = i; [...seg.children].forEach((x, j) => x.classList.toggle('on', j === i)); reset(); }); seg.append(b); });
    const pre = el('pre'); const codeHost = el('div', { class: 'codebox w-nb-code' }, el('div', { class: 'ch' }, el('span', { class: 'fname' })), pre);
    const W = cfg.W || 420, H = cfg.H || 300;
    const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': cfg.aria || 'Step-by-step picture of the program state' });
    const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('span', { class: 'n', text: '0' }), el('div', { class: 't', text: 'Press Play, or Step to go one line at a time.' }));
    const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
    const bStep = el('button', { class: 'btn', text: 'Step ›' });
    const bReset = el('button', { class: 'btn', text: '↺ Reset' });
    const segS = el('div', { class: 'seg', 'aria-label': 'Speed' });
    [['Slow', 3800], ['Normal', 2600], ['Fast', 1300]].forEach(([l, v]) => { const b = el('button', { text: l, class: v === speed ? 'on' : '' }); b.addEventListener('click', () => { speed = v; [...segS.children].forEach((x) => x.classList.toggle('on', x === b)); }); segS.append(b); });
    root.append(modes.length > 1 ? el('div', { class: 'w-controls' }, seg) : '',
      el('div', { class: 'w-nb-grid' }, codeHost, el('div', { class: 'w-stage' }, stage)),
      el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr);
    // drawing helpers handed to cfg.draw
    const defs = svg('defs', null, svg('marker', { id: uid + 'a', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--text-3)' })),
      svg('marker', { id: uid + 'h', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--accent)' })));
    const D = {
      box: (x, y, w, h, cls, fresh) => svg('rect', { x, y, width: w, height: h, rx: 7, class: 'bx ' + (cls || '') + (fresh ? ' fresh' : '') }),
      t: (x, y, s, cls, anchor, fresh) => svg('text', { x, y, class: 'tt ' + (cls || '') + (fresh ? ' fresh' : ''), 'text-anchor': anchor || 'start', text: String(s) }),
      ar: (x1, y1, x2, y2, hot, curve) => svg('path', { d: curve ? `M${x1},${y1} C${x1 + curve},${y1} ${x2 + curve},${y2} ${x2},${y2}` : `M${x1},${y1} L${x2},${y2}`, class: 'ar' + (hot ? ' hot' : ''), 'marker-end': `url(#${uid}${hot ? 'h' : 'a'})` }),
      W, H
    };
    let lineEls = [];
    function renderCode() {
      const m = modes[mi]; pre.innerHTML = '';
      codeHost.querySelector('.fname').textContent = m.file || 'example.js';
      lineEls = m.code.split('\n').map((ln) => { const s = el('span', { class: 'ln' }); s.innerHTML = IA.highlight(ln || ' ', m.lang || 'js'); pre.append(s); return s; });
    }
    function show(i) {
      const m = modes[mi]; const st = m.steps[i];
      lineEls.forEach((l, j) => { const cur = st && [].concat(st.line == null ? [] : st.line).includes(j + 1); l.classList.toggle('cur', cur); });
      stage.innerHTML = ''; stage.append(defs);
      const g = svg('g'); stage.append(g);
      cfg.draw(g, st || null, D, i, m);
      narr.className = 'caption' + (st && st.tone ? ' ' + st.tone : '');
      narr.firstChild.textContent = st ? `${i + 1}/${m.steps.length}` : '0';
      narr.lastChild.innerHTML = st ? st.cap : (m.intro || 'Press Play, or Step to go one line at a time.');
    }
    function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; renderCode(); if (reduced) { k = modes[mi].steps.length; show(k - 1); } else show(-1); }
    function step() { const n = modes[mi].steps.length; if (k >= n) return false; show(k); k++; return k < n; }
    async function play() {
      if (running) { gen++; running = false; bPlay.textContent = '▶ Play'; return; }
      if (k >= modes[mi].steps.length) reset();
      if (reduced) { k = modes[mi].steps.length; show(k - 1); return; }
      const g = ++gen; running = true; bPlay.textContent = '❚❚ Pause';
      while (g === gen && step()) { await sleep(speed); }
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    }
    bPlay.addEventListener('click', play);
    bStep.addEventListener('click', () => { gen++; running = false; bPlay.textContent = '▶ Play'; if (k >= modes[mi].steps.length) reset(); step(); });
    bReset.addEventListener('click', reset);
    reset();
  }
  // vars: [name, tag, value, cls, ref]; tag 'frame' draws a stack-frame header
  const sA = [
    { line: [1, 2, 3, 4], cap: 'Declaring <code>makeCounter</code> creates a function object. Nothing inside it runs yet.', vars: [['global', 'frame'], ['makeCounter', 'function', '', 'hot', 'f']], heap: [['f', 'function makeCounter']] },
    { line: 6, cap: 'Calling it pushes a new <b>frame</b> on the call stack, with its own <code>count = 0</code>.', vars: [['global', 'frame'], ['makeCounter', 'function', '', '', 'f'], ['makeCounter()', 'frame'], ['count', 'let', '0', 'hot']], heap: [['f', 'function makeCounter']] },
    { line: 3, cap: 'The arrow function is created <i>inside</i> that call. It keeps a link to the scope it was born in: that link is the <b>closure</b>.', vars: [['global', 'frame'], ['makeCounter', 'function', '', '', 'f'], ['makeCounter()', 'frame'], ['count', 'let', '0']], heap: [['f', 'function makeCounter'], ['s', 'scope { count: 0 }', 'hot'], ['a', '() => ++count  ⟶ scope', 'hot']] },
    { line: 6, cap: 'The call returns and its frame is popped. Normally <code>count</code> would be garbage now, but the arrow still references its scope, so it survives on the heap.', vars: [['global', 'frame'], ['makeCounter', 'function', '', '', 'f'], ['next', 'const', '', 'hot', 'a']], heap: [['f', 'function makeCounter'], ['s', 'scope { count: 0 }', 'warn'], ['a', '() => ++count  ⟶ scope']] },
    { line: 7, cap: '<code>next()</code> runs the arrow. It finds <code>count</code> in its remembered scope and increments it: returns 1.', tone: 'ok', vars: [['global', 'frame'], ['makeCounter', 'function', '', '', 'f'], ['next', 'const', '', '', 'a'], ['next()', 'frame'], ['returns', '', '1', 'ok']], heap: [['f', 'function makeCounter'], ['s', 'scope { count: 1 }', 'hot'], ['a', '() => ++count  ⟶ scope']] },
    { line: 8, cap: 'Same scope, same <code>count</code>: returns 2. This is private state without a class, like a private field only one lambda can see.', tone: 'ok', vars: [['global', 'frame'], ['makeCounter', 'function', '', '', 'f'], ['next', 'const', '', '', 'a'], ['next()', 'frame'], ['returns', '', '2', 'ok']], heap: [['f', 'function makeCounter'], ['s', 'scope { count: 2 }', 'hot'], ['a', '() => ++count  ⟶ scope']] }
  ];
  const sB = [
    { line: 1, cap: 'A <b>default parameter</b> is used when the argument is missing (or <code>undefined</code>). <code>...rest</code> collects all remaining arguments into a real array, like Java varargs.', vars: [['global', 'frame'], ['greet', 'function', '', 'hot']] },
    { line: 4, cap: '<code>greet()</code>: no arguments, so <code>name</code> takes its default and <code>rest</code> is an empty array.', vars: [['greet()', 'frame'], ['name', 'param', "'world'", 'hot'], ['rest', 'param', '[]', 'hot']] },
    { line: 5, cap: '<code>greet(\'Ada\', 1, 2)</code>: the first argument fills <code>name</code>, the others land in <code>rest</code>.', vars: [['greet(…)', 'frame'], ['name', 'param', "'Ada'", 'hot'], ['rest', 'param', '[1, 2]', 'hot']] },
    { line: 6, cap: 'Passing <code>undefined</code> explicitly also triggers the default. Passing <code>null</code> does not.', tone: 'warn', vars: [['greet(undefined)', 'frame'], ['name', 'param', "'world'", 'warn'], ['rest', 'param', '[]']] },
    { line: 7, cap: 'Extra arguments are never an error in JavaScript, and missing ones are just <code>undefined</code>. There is no overloading: one name, one function.', vars: [['add(1)', 'frame'], ['a', 'param', '1'], ['b', 'param', 'undefined', 'warn'], ['returns', '', 'NaN', 'err']] }
  ];
  const sC = [
    { line: [1, 2, 3, 4, 5], cap: 'A method is just a function stored on an object. <code>this</code> is decided by <b>how it is called</b>, not where it is written.', vars: [['global', 'frame'], ['user', 'const', '', 'hot', 'u']], heap: [['u', "{ name: 'Ada', hi() }"]] },
    { line: 6, cap: '<code>user.hi()</code>: called with <code>user.</code> in front, so <code>this</code> = user and it returns \'Ada\'.', tone: 'ok', vars: [['user.hi()', 'frame'], ['this', '', '', 'ok', 'u'], ['returns', '', "'Ada'", 'ok']], heap: [['u', "{ name: 'Ada', hi() }"]] },
    { line: [7, 8], cap: 'Copying the method into a variable and calling <code>f()</code> drops the object. <code>this</code> is <code>undefined</code> in strict code (ESM, classes), so <code>this.name</code> throws a TypeError.', tone: 'err', vars: [['f()', 'frame'], ['this', '', 'undefined', 'err']], heap: [['u', "{ name: 'Ada', hi() }"]] },
    { line: 9, cap: '<code>bind</code> makes a copy with <code>this</code> fixed for good. This is why callbacks like <code>setTimeout(user.hi)</code> lose <code>this</code> unless bound.', tone: 'ok', vars: [['bound()', 'frame'], ['this', '', '', 'ok', 'u'], ['returns', '', "'Ada'", 'ok']], heap: [['u', "{ name: 'Ada', hi() }"]] },
    { line: 10, cap: 'Arrow functions have no <code>this</code> of their own: they use the <code>this</code> of the surrounding code. Inside a method, an arrow callback “just works”.', vars: [['user.later()', 'frame'], ['this', '', '', 'ok', 'u'], ['arrow uses', '', 'outer this', 'ok']], heap: [['u', "{ name: 'Ada', hi() }"]] }
  ];
  stepper({
    W: 420, H: 300, aria: 'Call stack on the left, heap objects and closures on the right',
    modes: [
      { label: 'closure counter', code: "function makeCounter() {\n  let count = 0;\n  return () => ++count;\n}\n\nconst next = makeCounter();\nnext();   // 1\nnext();   // 2", steps: sA },
      { label: 'default & rest', code: "function greet(name = 'world', ...rest) {\n  return `${name} +${rest.length}`;\n}\ngreet();             // 'world +0'\ngreet('Ada', 1, 2);  // 'Ada +2'\ngreet(undefined);    // 'world +0'\nconst add = (a, b) => a + b; add(1); // NaN", steps: sB },
      { label: 'this', code: "const user = {\n  name: 'Ada',\n  hi() { return this.name; },\n  later() { setTimeout(() => console.log(this.name)); },\n};\nuser.hi();             // 'Ada'\nconst f = user.hi;\nf();                   // TypeError in strict mode\nconst bound = user.hi.bind(user); bound(); // 'Ada'\nuser.later();          // arrow keeps this → 'Ada'", steps: sC }
    ],
    draw(g, st, D) {
      g.append(D.box(6, 6, 190, 288, 'lane'), D.t(16, 26, 'call stack', 'h'), D.box(214, 6, 200, 288, 'lane'), D.t(224, 26, 'heap', 'h'));
      if (!st) return;
      const pos = {};
      (st.heap || []).forEach(([id, label, c], i) => { const y = 50 + i * 62; pos[id] = y + 20; g.append(D.box(222, y, 184, 40, c || '', c === 'hot'), D.t(230, y + 25, label.length > 23 ? label.slice(0, 22) + '…' : label)); });
      let y = 38;
      st.vars.forEach(([n, tag, v, c, ref]) => {
        if (tag === 'frame') { g.append(D.t(14, y + 14, '▸ ' + n, 'acc')); y += 22; return; }
        g.append(D.box(14, y, 172, 30, c || '', c === 'hot'), D.t(22, y + 13, tag, 'm'), D.t(22, y + 26, n), D.t(178, y + 20, ref ? '●' : v, c === 'err' ? 'err' : 'acc', 'end'));
        if (ref) g.append(D.ar(184, y + 15, 220, pos[ref], c === 'hot'));
        y += 36;
      });
      if (pos.a && pos.s) g.append(D.ar(404, pos.a, 404, pos.s + 4, false, 12));
    }
  });
});

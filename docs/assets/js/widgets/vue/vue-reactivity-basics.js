/* ref & reactive: how reads are tracked and writes trigger re-renders, and how destructuring breaks the link. */
IA.widget('vue-reactivity-basics', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const W = 760;
  const T = (g, x, y, s, o = {}) => { const n = svg('text', { x, y, 'font-size': o.fs || 13, 'text-anchor': o.a || 'start', fill: o.c || 'var(--text)', 'font-family': o.mono ? 'var(--mono)' : null, 'font-weight': o.b ? 700 : null, text: s }); g.append(n); return n; };
  const B = (g, x, y, w, h, label, o = {}) => {
    const stroke = o.err ? 'var(--err)' : o.ok ? 'var(--ok)' : o.warn ? 'var(--warn)' : o.hot ? 'var(--accent)' : 'var(--border)';
    g.append(svg('rect', { x, y, width: w, height: h, rx: 8, fill: o.hot ? 'var(--accent-soft)' : (o.fill || 'var(--surface)'), stroke, 'stroke-width': (o.hot || o.err || o.ok || o.warn) ? 2.2 : 1.4, 'stroke-dasharray': o.dash ? '5 4' : null, opacity: o.dim ? 0.4 : 1 }));
    if (label != null) { const ls = String(label).split('\n'); ls.forEach((ln, i) => T(g, x + w / 2, y + h / 2 + 5 + (i - (ls.length - 1) / 2) * 17, ln, { a: 'middle', fs: o.fs, mono: o.mono, b: o.b, c: o.dim ? 'var(--text-3)' : o.err ? 'var(--err)' : o.ok ? 'var(--ok)' : 'var(--text)' })); }
  };
  const A = (g, x1, y1, x2, y2, o = {}) => {
    const c = o.err ? 'var(--err)' : o.ok ? 'var(--ok)' : o.hot ? 'var(--accent)' : 'var(--text-3)'; const ang = Math.atan2(y2 - y1, x2 - x1), L = 9;
    g.append(svg('line', { x1, y1, x2, y2, stroke: c, 'stroke-width': o.hot || o.err ? 2.4 : 1.6, 'stroke-dasharray': o.dash ? '5 4' : null }),
      svg('polygon', { points: `${x2},${y2} ${x2 - L * Math.cos(ang - 0.45)},${y2 - L * Math.sin(ang - 0.45)} ${x2 - L * Math.cos(ang + 0.45)},${y2 - L * Math.sin(ang + 0.45)}`, fill: c }));
    if (o.label) T(g, (x1 + x2) / 2 + (o.lx || 0), (y1 + y2) / 2 - 7 + (o.ly || 0), o.label, { a: 'middle', fs: 11, c });
  };
  function mount(cfg) {
    let mode = cfg.modes ? cfg.modes.opts[0][0] : null; let steps = []; let k = 0; let running = false; let gen = 0;
    const stage = svg('svg', { viewBox: `0 0 ${W} ${cfg.H}`, role: 'img', 'aria-label': cfg.aria });
    const num = el('span', { class: 'n', text: '1' }); const say = el('div', { class: 't' });
    const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, num, say);
    const codeHost = el('div', { class: 'codebox', style: { marginTop: '10px' } });
    const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
    const bStep = el('button', { class: 'btn', text: 'Step ›' });
    const bReset = el('button', { class: 'btn', text: '↺ Reset' });
    const top = [];
    if (cfg.modes) {
      const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': cfg.modes.label });
      cfg.modes.opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === mode ? 'on' : '' }); b.addEventListener('click', () => { mode = v; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
      top.push(el('div', { class: 'w-controls' }, seg));
    }
    root.append(...top, el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, codeHost);
    function show(i) {
      const s = steps[i]; stage.innerHTML = ''; const g = svg('g'); stage.append(g); s.draw(g, mode);
      num.textContent = `${i + 1}/${steps.length}`; say.remove(); say.innerHTML = s.say; narr.append(say);
      narr.className = 'caption' + (s.tone ? ' ' + s.tone : '');
      codeHost.innerHTML = ''; codeHost.style.display = s.code ? '' : 'none';
      if (s.code) codeHost.append(el('pre', { html: IA.highlight(s.code, s.lang || 'ts') }));
      bStep.disabled = i >= steps.length - 1;
    }
    function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; steps = cfg.steps(mode); k = 0; show(0); }
    function step() { if (k >= steps.length - 1) return false; show(++k); return true; }
    bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
    bReset.addEventListener('click', reset);
    bPlay.addEventListener('click', async () => {
      if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
      if (k >= steps.length - 1) reset();
      if (reduced) { k = steps.length - 1; show(k); return; }
      running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
      while (running && g === gen && step()) await sleep(cfg.speed || 2600);
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    });
    reset();
  }
  function scene(g, o) {
    // o: { src, srcHot, dep, eff, effHot, dom, domHot, err, readA, writeA }
    B(g, 30, 70, 220, 90, o.src, { mono: true, hot: o.srcHot, err: o.srcErr, fs: 12 });
    T(g, 140, 58, o.srcTitle, { a: 'middle', fs: 12, c: 'var(--text-3)' });
    B(g, 300, 190, 200, 60, o.dep, { mono: true, hot: o.depHot, fs: 12 });
    T(g, 400, 270, 'dependency map (who read what)', { a: 'middle', fs: 11, c: 'var(--text-3)' });
    B(g, 540, 70, 190, 90, o.eff, { mono: true, hot: o.effHot, fs: 12 });
    T(g, 635, 58, 'render effect', { a: 'middle', fs: 12, c: 'var(--text-3)' });
    if (o.readA) A(g, 540, 100, 252, 100, { hot: true, label: 'get → track()' });
    if (o.trackA) A(g, 250, 140, 330, 188, { hot: true, label: 'record', lx: -30 });
    if (o.writeA) A(g, 470, 188, 560, 162, { hot: true, label: 'trigger()', lx: 30 });
    if (o.dom) { B(g, 540, 200, 190, 50, o.dom, { mono: true, ok: o.domOk, err: o.domErr, fs: 12 }); T(g, 635, 268, 'DOM', { a: 'middle', fs: 11, c: 'var(--text-3)' }); }
    if (o.note) T(g, 30, 30, o.note, { b: true, fs: 14 });
  }
  const REF = [
    { say: '<code>ref(0)</code> returns a small wrapper object. The number lives in <code>.value</code>, whose getter and setter Vue controls.', code: "const count = ref(0)\nconsole.log(count)        // RefImpl { value: 0 }", o: { note: 'ref: a box with a .value', srcTitle: 'count (RefImpl)', src: '{ value: 0 }', srcHot: true, dep: 'count → [ ]', eff: 'not run yet' } },
    { say: 'The render effect runs. The template reads <code>{{ count }}</code>; templates <b>auto-unwrap</b> top-level refs, so this is really <code>count.value</code>. The getter calls <code>track()</code>.', code: '<p>{{ count }}</p>   <!-- no .value in templates -->', lang: 'text', o: { note: 'read = subscribe', srcTitle: 'count (RefImpl)', src: '{ value: 0 }', dep: 'count → [ ]', eff: 'render()\nreads count', effHot: true, readA: true } },
    { say: '<code>track()</code> records “the render effect depends on <code>count</code>”.', o: { note: 'read = subscribe', srcTitle: 'count (RefImpl)', src: '{ value: 0 }', dep: 'count → [render]', depHot: true, eff: 'render()', trackA: true, dom: '<p>0</p>', domOk: true } },
    { say: 'In script you write <code>count.value++</code>. The setter calls <code>trigger()</code>, which looks up the map and <b>schedules</b> the render effect (batched, once per tick).', code: 'function inc() { count.value++ }   // .value in script!', o: { note: 'write = notify', srcTitle: 'count (RefImpl)', src: '{ value: 1 }', srcHot: true, dep: 'count → [render]', depHot: true, eff: 'render() queued', effHot: true, writeA: true, dom: '<p>0</p>' } },
    { say: 'Render runs again and the DOM is patched. Forget <code>.value</code> (<code>count++</code> in script) and you reassign a <code>const</code>: a TypeScript/runtime error, not a silent bug. With <code>let</code>, it would be silent.', o: { note: 'write = notify', srcTitle: 'count (RefImpl)', src: '{ value: 1 }', dep: 'count → [render]', eff: 'render()', effHot: true, dom: '<p>1</p>', domOk: true } }
  ];
  const REACT = [
    { say: '<code>reactive({...})</code> returns a <b>Proxy</b> around your object. No <code>.value</code>: you use it like a normal object.', code: "const state = reactive({ user: { name: 'Ann' }, items: [] })", o: { note: 'reactive: a Proxy', srcTitle: 'state (Proxy)', src: "{ user: {name:'Ann'},\n  items: [] }", srcHot: true, dep: 'state.user.name → [ ]', eff: 'not run yet' } },
    { say: 'Render reads <code>state.user.name</code>. The Proxy <code>get</code> trap tracks each property it passes through. Nested objects are wrapped <b>lazily</b>, on access: reactivity is deep.', o: { note: 'deep tracking, per property', srcTitle: 'state (Proxy)', src: "{ user: {name:'Ann'},\n  items: [] }", dep: 'user, user.name\n→ [render]', depHot: true, eff: 'render()\nreads user.name', effHot: true, readA: true, trackA: true, dom: '<p>Ann</p>', domOk: true } },
    { say: '<code>state.items.push(x)</code> and <code>state.user.name = \'Bo\'</code> both trigger. Unlike Vue 2, adding new keys and array index writes are detected too.', code: "state.user.name = 'Bo'\nstate.items.push({ id: 1 })", o: { note: 'writes through the Proxy trigger', srcTitle: 'state (Proxy)', src: "{ user: {name:'Bo'},\n  items: [1 item] }", srcHot: true, dep: 'user.name → [render]', depHot: true, eff: 'render() queued', effHot: true, writeA: true, dom: '<p>Ann</p>' } },
    { say: 'Limits: <code>reactive()</code> only accepts objects (not <code>0</code> or <code>\'\'</code>), and you cannot <b>replace</b> the whole object: <code>state = reactive({...})</code> breaks the link. That is why many teams default to <code>ref()</code>.', o: { note: 'reactive: objects only, never reassign', srcTitle: 'state (Proxy)', src: "{ user: {name:'Bo'},\n  items: [1 item] }", dep: 'user.name → [render]', eff: 'render()', dom: '<p>Bo</p>', domOk: true } }
  ];
  const TRAP = [
    { say: 'A common trap: destructuring a reactive object.', code: "const state = reactive({ count: 0 })\nlet { count } = state     // copies the number 0", o: { note: 'destructuring copies the value', srcTitle: 'state (Proxy)', src: '{ count: 0 }', dep: 'state.count → [ ]', eff: 'count = 0\n(plain number)', effHot: true } },
    { say: 'The template uses the local <code>count</code>, a plain number. The Proxy was read once (during destructuring), but nothing links the variable to it.', o: { note: 'no link back to the Proxy', srcTitle: 'state (Proxy)', src: '{ count: 0 }', srcErr: true, dep: 'nothing tracked\nfor render', eff: 'render()\nreads local count', dom: '<p>0</p>' } },
    { say: '<code>state.count++</code> fires <code>trigger()</code>, but no effect ever read <code>state.count</code>, and the local copy never changes anyway. The UI stays at 0. No error. This is the #1 “Vue stopped updating” bug.', code: 'state.count++   // UI still shows 0', o: { note: 'UI silently stale', srcTitle: 'state (Proxy)', src: '{ count: 1 }', srcHot: true, dep: 'nothing to trigger', eff: 'count = 0', dom: '<p>0</p>', domErr: true } },
    { say: 'Fix: <code>toRefs(state)</code> turns each property into a ref linked to the Proxy, or just use <code>state.count</code> directly. Same trap with Pinia stores: use <code>storeToRefs()</code>.', code: 'const { count } = toRefs(state)   // count.value ⇄ state.count', o: { note: 'toRefs keeps the link', srcTitle: 'state (Proxy)', src: '{ count: 1 }', dep: 'count → [render]', depHot: true, eff: 'render()\nreads count.value', effHot: true, readA: true, trackA: true, dom: '<p>1</p>', domOk: true } }
  ];
  mount({ aria: 'How ref and reactive track reads and trigger renders', H: 290, modes: { label: 'Concept', opts: [['ref', 'ref & .value'], ['reactive', 'reactive (Proxy)'], ['trap', 'Destructuring trap']] },
    steps: (m) => ({ ref: REF, reactive: REACT, trap: TRAP })[m].map((s) => ({ ...s, draw: (g) => scene(g, s.o) })) });
});

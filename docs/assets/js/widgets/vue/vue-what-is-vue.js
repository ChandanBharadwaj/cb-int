/* What Vue is: progressive adoption layers, and the state → render → DOM loop. */
IA.widget('vue-what-is-vue', (root, ctx) => {
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
  const LAYERS = [
    ['Vue core', 'reactivity + templates + components', 'One <code>&lt;script&gt;</code> tag can enhance a single server-rendered page. No build step needed.'],
    ['SFC + Vite', '.vue files, TypeScript, HMR', 'Most real projects: Single-File Components compiled by Vite. Template, script and style live in one file.'],
    ['Vue Router', 'URLs → components', 'Add client-side routing and you have a single-page app (SPA).'],
    ['Pinia', 'shared state stores', 'Add a store when several distant components need the same state. Pinia is the official store.'],
    ['Nuxt / SSR', 'server rendering, file routing', 'Render on the server for SEO and first paint. Nuxt is the meta-framework on top of Vue.']
  ];
  function adopt() {
    return LAYERS.map((L, i) => ({
      say: `<b>Layer ${i + 1}: ${L[0]}.</b> ${L[2]}` + (i === 4 ? ' You only pay for the layers you use: that is what “progressive” means.' : ''),
      draw(g) {
        T(g, 380, 24, 'Adopt only what you need', { a: 'middle', b: true, fs: 15 });
        LAYERS.forEach((l, j) => {
          const w = 260 + j * 100, x = 380 - w / 2, y = 250 - j * 44;
          B(g, x, y, w, 38, null, { hot: j === i, dim: j > i });
          T(g, 380, y + 17, l[0], { a: 'middle', b: true, c: j > i ? 'var(--text-3)' : 'var(--text)' });
          T(g, 380, y + 32, l[1], { a: 'middle', fs: 11, c: 'var(--text-3)' });
        });
      }
    }));
  }
  const loopSteps = [
    ['state', 'You declare <b>state</b>: <code>const count = ref(0)</code>. Vue wraps it so reads and writes can be observed.'],
    ['render', 'Vue runs the component’s <b>render function</b> (compiled from your template). While it runs, Vue records that it <i>read</i> <code>count</code>.'],
    ['vdom', 'The render function returns a <b>virtual DOM</b>: plain JS objects describing the HTML you want.'],
    ['dom', 'Vue creates the real <b>DOM</b> nodes from it. The user sees <code>Clicked 0 times</code>.'],
    ['event', 'The user clicks. Your handler runs <code>count.value++</code>. Vue knows exactly which render read <code>count</code>.'],
    ['patch', 'Only that component re-renders. Vue diffs the old and new virtual DOM and patches just the changed text node. You never touch the DOM yourself.']
  ];
  function loop() {
    const pos = { state: [40, 120], render: [230, 120], vdom: [420, 120], dom: [600, 120] };
    return loopSteps.map(([id, say], i) => ({
      say, code: i < 4 ? 'const count = ref(0)\n// template: <button @click="count++">Clicked {{ count }} times</button>' : 'count.value++   // in a handler; in the template just count++',
      draw(g) {
        const on = (k) => id === k || (id === 'event' && k === 'state') || (id === 'patch' && (k === 'dom' || k === 'vdom' || k === 'render'));
        Object.entries(pos).forEach(([k, [x, y]]) => B(g, x, y, 130, 54, { state: 'state\nref(0)', render: 'render()\n(from template)', vdom: 'virtual DOM\n{ type: button }', dom: 'real DOM\n<button>' }[k], { hot: on(k), mono: k !== 'render', fs: 12 }));
        A(g, 170, 147, 228, 147, { hot: i >= 1, label: 'read → track' });
        A(g, 360, 147, 418, 147, { hot: i >= 2 });
        A(g, 550, 147, 598, 147, { hot: i >= 3, label: i >= 5 ? 'patch' : 'create' });
        if (i >= 4) { g.append(svg('path', { d: 'M665 176 C 665 250, 105 250, 105 178', fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, 'stroke-dasharray': '5 4' })); T(g, 380, 236, 'click → count.value++ → trigger', { a: 'middle', fs: 12, c: 'var(--accent)' }); }
        T(g, 665, 104, i >= 5 ? 'Clicked 1 times' : (i >= 3 ? 'Clicked 0 times' : ''), { a: 'middle', mono: true, fs: 12, c: 'var(--ok)' });
        T(g, 380, 40, 'Vue’s core loop: reactive state drives rendering', { a: 'middle', b: true, fs: 15 });
      }
    }));
  }
  mount({ aria: 'Vue adoption layers and the reactive render loop', H: 300, modes: { label: 'View', opts: [['adopt', 'Progressive adoption'], ['loop', 'State → DOM loop']] }, steps: (m) => (m === 'adopt' ? adopt() : loop()) });
});

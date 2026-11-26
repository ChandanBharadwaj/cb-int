/* Components: props flow down, events flow up, and v-model on a component is sugar for both. */
IA.widget('vue-components', (root, ctx) => {
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
  function sc(g, o) {
    T(g, 30, 28, o.note, { b: true, fs: 14 });
    B(g, 200, 44, 360, 76, null, { hot: o.pHot });
    T(g, 216, 68, 'Parent.vue', { b: true });
    T(g, 216, 92, o.pState, { mono: true, fs: 12 });
    T(g, 216, 110, o.pTpl || '', { mono: true, fs: 11, c: 'var(--text-3)' });
    B(g, 200, 196, 360, 76, null, { hot: o.cHot, err: o.cErr });
    T(g, 216, 220, o.cName || 'Counter.vue', { b: true });
    T(g, 216, 244, o.cState, { mono: true, fs: 12 });
    T(g, 216, 262, o.cTpl || '', { mono: true, fs: 11, c: o.cErr ? 'var(--err)' : 'var(--text-3)' });
    A(g, 300, 122, 300, 194, { hot: o.down, label: o.downL || 'props ↓', lx: -46 });
    A(g, 460, 194, 460, 122, { hot: o.up, err: o.upErr, label: o.upL || 'emit ↑', lx: 52 });
  }
  const FLOW = [
    { say: 'The parent owns the state: <code>count = 0</code>. It passes it to the child as a <b>prop</b>.', code: '<Counter :count="count" @increment="count++" />', lang: 'text', o: { note: 'one-way data flow', pState: 'const count = ref(0)', pTpl: '<Counter :count="count" @increment=… />', cState: 'props.count = 0', down: true, pHot: true } },
    { say: 'The child declares what it accepts with <code>defineProps</code>. With TypeScript, the type <i>is</i> the declaration; the compiler generates the runtime check.', code: "const props = defineProps<{ count: number; label?: string }>()\nconst emit = defineEmits<{ increment: [] }>()", o: { note: 'the child’s contract', pState: 'const count = ref(0)', cState: 'defineProps<{ count: number }>()', cHot: true } },
    { say: 'The user clicks in the child. The child does <b>not</b> change the prop. It emits an event: “please increment”.', code: '<button @click="emit(\'increment\')">{{ count }}</button>', lang: 'text', o: { note: 'events go up', pState: 'const count = ref(0)', cState: "emit('increment')", cHot: true, up: true } },
    { say: 'The parent’s listener runs <code>count++</code>. The parent re-renders and passes the new prop down. The child shows 1.', o: { note: 'parent updates, prop flows down', pState: 'const count = ref(1)', cState: 'props.count = 1', pHot: true, down: true } },
    { say: 'What if the child writes <code>props.count++</code>? Props are <b>readonly</b>: Vue warns in dev and ignores the write. The parent is the single source of truth, so state changes are easy to trace.', code: 'props.count++   // [Vue warn]: Set operation on key "count" failed: target is readonly.', o: { note: 'mutating a prop = bug', pState: 'const count = ref(1)', cState: 'props.count++  ✗', cErr: true, upErr: true, upL: 'no!' } }
  ];
  const MODEL = [
    { say: 'You write <code>v-model</code> on a custom component, just like on an <code>&lt;input&gt;</code>.', code: '<SearchBox v-model="query" />', lang: 'text', o: { note: 'v-model on a component', pState: "const query = ref('')", pTpl: '<SearchBox v-model="query" />', cName: 'SearchBox.vue', cState: '?' } },
    { say: 'The compiler expands it into a prop named <code>modelValue</code> plus a listener for <code>update:modelValue</code>.', code: '<SearchBox\n  :modelValue="query"\n  @update:modelValue="v => query = v" />', lang: 'text', o: { note: 'it is just a prop + an event', pState: "const query = ref('')", pTpl: ':modelValue + @update:modelValue', cName: 'SearchBox.vue', cState: 'props.modelValue', down: true, downL: 'modelValue', pHot: true } },
    { say: 'Vue 3.4+: <code>defineModel()</code> in the child returns a ref that reads the prop and emits the update when you assign it.', code: "const model = defineModel<string>({ default: '' })\n// <input v-model=\"model\" />", o: { note: 'defineModel (3.4+)', pState: "const query = ref('')", cName: 'SearchBox.vue', cState: 'const model = defineModel<string>()', cTpl: '<input v-model="model" />', cHot: true } },
    { say: 'Typing “vue” assigns <code>model.value = \'vue\'</code>, which emits <code>update:modelValue</code>. The parent’s <code>query</code> changes and flows back down. Still one-way data flow underneath.', o: { note: 'two-way feel, one-way mechanics', pState: "const query = ref('vue')", cName: 'SearchBox.vue', cState: "model.value = 'vue'", up: true, upL: 'update:modelValue', down: true, downL: 'modelValue', pHot: true, cHot: true } },
    { say: 'Several models on one component use arguments: <code>v-model:first</code> and <code>v-model:last</code> map to <code>defineModel(\'first\')</code> and <code>defineModel(\'last\')</code>.', code: '<UserName v-model:first="f" v-model:last="l" />\n// child: const first = defineModel(\'first\'); const last = defineModel(\'last\')', lang: 'ts', o: { note: 'named models', pState: 'f, l', pTpl: 'v-model:first · v-model:last', cName: 'UserName.vue', cState: "defineModel('first'), defineModel('last')", down: true, up: true, downL: 'first, last', upL: 'update:first / last' } }
  ];
  mount({ aria: 'Props down, events up, and component v-model', H: 290, modes: { label: 'Concept', opts: [['flow', 'Props down, events up'], ['model', 'v-model on a component']] },
    steps: (m) => (m === 'flow' ? FLOW : MODEL).map((s) => ({ ...s, draw: (g) => sc(g, s.o) })) });
});

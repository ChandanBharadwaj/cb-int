/* computed & watch: computed caching via a dirty flag, and when watch / watchEffect callbacks fire. */
IA.widget('vue-computed-watch', (root, ctx) => {
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
  function cscene(g, o) {
    T(g, 30, 30, o.note, { b: true, fs: 14 });
    B(g, 30, 60, 170, 56, `price = ${o.price}`, { mono: true, hot: o.pHot });
    B(g, 30, 140, 170, 56, `qty = ${o.qty}`, { mono: true, hot: o.qHot });
    B(g, 30, 220, 170, 46, `theme = '${o.theme}'`, { mono: true, hot: o.tHot, fs: 12 });
    B(g, 290, 90, 200, 80, null, { hot: o.cHot, warn: o.dirty });
    T(g, 390, 116, 'total = computed(…)', { a: 'middle', mono: true, fs: 12 });
    T(g, 390, 138, `cached: ${o.cache}`, { a: 'middle', mono: true, fs: 12 });
    T(g, 390, 158, o.dirty ? 'dirty ✱' : 'clean', { a: 'middle', fs: 12, c: o.dirty ? 'var(--warn)' : 'var(--ok)' });
    A(g, 200, 88, 288, 118, { hot: o.pHot }); A(g, 200, 168, 288, 146, { hot: o.qHot });
    B(g, 560, 60, 170, 56, 'read #1 in template', { fs: 12, hot: o.r === 1 }); B(g, 560, 140, 170, 56, 'read #2 in template', { fs: 12, hot: o.r === 2 });
    A(g, 490, 120, 558, 90, { hot: o.r === 1 }); A(g, 490, 140, 558, 166, { hot: o.r === 2 });
    T(g, 390, 220, `getter runs so far: ${o.runs}`, { a: 'middle', b: true, c: 'var(--accent)' });
    if (o.tHot) T(g, 390, 250, 'theme is not a dependency → total untouched', { a: 'middle', fs: 12, c: 'var(--text-3)' });
  }
  const C = [
    { say: '<code>total</code> is declared. The getter has <b>not</b> run yet: computed is lazy.', code: 'const total = computed(() => price.value * qty.value)', o: { note: 'computed: lazy + cached', price: 10, qty: 2, theme: 'dark', cache: '—', dirty: true, runs: 0 } },
    { say: 'The template reads <code>total</code>. The getter runs once, tracks <code>price</code> and <code>qty</code>, and caches <b>20</b>.', o: { note: 'first read computes', price: 10, qty: 2, theme: 'dark', cache: 20, cHot: true, r: 1, runs: 1, pHot: true, qHot: true } },
    { say: 'A second read (another place in the template) returns the cached value. The getter does not run again.', o: { note: 'later reads hit the cache', price: 10, qty: 2, theme: 'dark', cache: 20, r: 2, runs: 1 } },
    { say: '<code>theme</code> changes. It is not a dependency, so the cache stays valid. A plain method <code>total()</code> would re-run on every render.', o: { note: 'unrelated change: no recompute', price: 10, qty: 2, theme: 'light', cache: 20, tHot: true, runs: 1 } },
    { say: '<code>qty</code> becomes 3. Vue only marks the computed <b>dirty</b>; it does not recompute yet.', o: { note: 'dependency changed: mark dirty', price: 10, qty: 3, theme: 'light', cache: 20, dirty: true, qHot: true, runs: 1 } },
    { say: 'Next read recomputes: <b>30</b>, then caches again. Keep getters pure: no fetches, no mutations. Side effects belong in <code>watch</code>.', o: { note: 'recompute on next read', price: 10, qty: 3, theme: 'light', cache: 30, cHot: true, r: 1, runs: 2 } }
  ];
  function wscene(g, o) {
    T(g, 30, 30, o.note, { b: true, fs: 14 });
    B(g, 30, 60, 200, 56, `userId = ${o.id}`, { mono: true, hot: o.idHot });
    B(g, 30, 150, 200, 56, `filter = '${o.f}'`, { mono: true, hot: o.fHot });
    B(g, 330, 50, 400, 76, null, { hot: o.w1 });
    T(g, 345, 74, 'watch(userId, (n, old) => load(n))', { mono: true, fs: 12 });
    T(g, 345, 98, o.w1t, { fs: 12, c: o.w1 ? 'var(--accent)' : 'var(--text-3)' });
    B(g, 330, 146, 400, 76, null, { hot: o.w2 });
    T(g, 345, 170, 'watchEffect(() => search(userId.value, filter.value))', { mono: true, fs: 11 });
    T(g, 345, 194, o.w2t, { fs: 12, c: o.w2 ? 'var(--accent)' : 'var(--text-3)' });
    A(g, 230, 88, 328, 88, { hot: o.w1 && o.idHot }); A(g, 230, 100, 328, 170, { hot: o.w2 && o.idHot }); A(g, 230, 178, 328, 186, { hot: o.w2 && o.fHot });
    T(g, 30, 260, o.log, { mono: true, fs: 12, c: 'var(--text-2)' });
  }
  const Wt = [
    { say: 'Setup runs. <code>watch</code> is <b>lazy</b>: it records its source but does not call the callback. <code>watchEffect</code> runs <b>immediately</b> and tracks whatever it reads.', o: { note: 'setup', id: 1, f: '', w1t: 'source: userId · not called yet', w2t: 'ran once · tracks userId, filter', w2: true, log: 'log: search(1, "")' } },
    { say: '<code>userId</code> changes to 2. Both fire. <code>watch</code> gets <code>(2, 1)</code>: new and old value. <code>watchEffect</code> gets no old value.', o: { note: 'a shared source changes', id: 2, f: '', idHot: true, w1: true, w2: true, w1t: 'callback(2, 1)', w2t: 're-ran', log: 'log: load(2) · search(2, "")' } },
    { say: '<code>filter</code> changes. Only <code>watchEffect</code> re-runs, because only it read <code>filter</code>. <code>watch</code> reacts only to its explicit source.', o: { note: 'only the effect read filter', id: 2, f: 'vue', fHot: true, w2: true, w1t: 'not called', w2t: 're-ran', log: 'log: search(2, "vue")' } },
    { say: 'Options: <code>{ immediate: true }</code> makes <code>watch</code> run at setup; <code>{ deep: true }</code> watches nested mutations of an object; <code>{ once: true }</code> (3.4+) fires once. Callbacks run before the component’s DOM update by default; <code>flush: \'post\'</code> runs after.', code: "watch(userId, load, { immediate: true })\nwatch(() => form.address, save, { deep: true })\nwatch(el, measure, { flush: 'post' })", o: { note: 'options', id: 2, f: 'vue', w1: true, w1t: 'immediate · deep · once · flush', w2t: 'watchPostEffect = flush: post', log: '' } }
  ];
  mount({ aria: 'Computed caching and watcher triggering', H: 290, modes: { label: 'Concept', opts: [['c', 'computed caching'], ['w', 'watch vs watchEffect']] },
    steps: (m) => (m === 'c' ? C.map((s) => ({ ...s, draw: (g) => cscene(g, s.o) })) : Wt.map((s) => ({ ...s, draw: (g) => wscene(g, s.o) }))) });
});

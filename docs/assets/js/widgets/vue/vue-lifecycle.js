/* Lifecycle: the hook timeline, parent/child ordering, and nextTick after a state change. */
IA.widget('vue-lifecycle', (root, ctx) => {
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
  const HOOKS = [
    ['setup', '<code>&lt;script setup&gt;</code> runs once per instance. Refs exist, but there is <b>no DOM</b> yet. Template refs are <code>null</code>.', 'creation'],
    ['onBeforeMount', 'Render is about to run for the first time. Rarely needed.', 'creation'],
    ['onMounted', 'The component’s DOM is in the document. Safe to measure elements, focus inputs, start a chart library, add window listeners. Not called during SSR.', 'mount'],
    ['onBeforeUpdate', 'State changed and a re-render is about to patch the DOM. You can read the old DOM here.', 'update'],
    ['onUpdated', 'The DOM is patched. Avoid changing state here: it can loop.', 'update'],
    ['onBeforeUnmount', 'The component is about to be removed (e.g. <code>v-if</code> went false, route changed). Still fully working.', 'unmount'],
    ['onUnmounted', 'Gone. Clean up anything Vue doesn’t own: <code>clearInterval</code>, <code>removeEventListener</code>, close sockets, abort fetches. Watchers and computeds created in setup are stopped automatically.', 'unmount']
  ];
  function life() {
    return HOOKS.map(([h, say], i) => ({
      say: `<b><code>${h}</code></b>: ${say}`,
      code: i === 2 || i === 6 ? "const el = useTemplateRef<HTMLInputElement>('box')   // 3.5+\nlet id: number\nonMounted(() => { el.value?.focus(); id = setInterval(poll, 5000) })\nonUnmounted(() => clearInterval(id))" : null,
      draw(g) {
        T(g, 30, 26, 'One component instance, from birth to removal', { b: true, fs: 14 });
        HOOKS.forEach(([hh, , ph], j) => {
          const x = 20 + j * 104; const y = ph === 'update' ? 140 : 80;
          B(g, x, y, 98, 44, hh, { mono: true, fs: 10, hot: j === i, dim: j > i });
          if (j < HOOKS.length - 1) { const ny = HOOKS[j + 1][2] === 'update' ? 140 : 80; A(g, x + 98, y + 22, x + 104, ny + 22, { hot: j < i }); }
        });
        const dom = i >= 2 && i <= 5;
        B(g, 20, 220, 720, 40, i < 2 ? 'DOM: nothing yet' : i === 6 ? 'DOM: removed' : i === 3 ? 'DOM: old version (about to patch)' : 'DOM: <input ref="box"> in the document', { mono: true, fs: 12, ok: dom && i !== 3, warn: i === 3, dim: !dom && i !== 6, err: i === 6 });
        if (i === 4) { g.append(svg('path', { d: 'M436 136 C 436 110, 340 110, 340 136', fill: 'none', stroke: 'var(--text-3)', 'stroke-dasharray': '4 3' })); T(g, 388, 112, 'every re-render', { a: 'middle', fs: 11, c: 'var(--text-3)' }); }
      }
    }));
  }
  const ORDER = [
    ['Parent setup', 'p', 'setup'], ['Parent onBeforeMount', 'p', 'bm'], ['Child setup', 'c', 'setup'], ['Child onBeforeMount', 'c', 'bm'], ['Child onMounted', 'c', 'm'], ['Parent onMounted', 'p', 'm']
  ];
  function order() {
    return ORDER.map(([t, who], i) => ({
      say: i < 4 ? `<b>${t}</b>. Rendering goes top-down: the parent starts rendering and meets <code>&lt;Child&gt;</code>, which is created inside it.` : i === 4 ? '<b>Child onMounted</b> fires <b>first</b>: a parent isn’t “mounted” until all its children are in the DOM.' : '<b>Parent onMounted</b> fires last. So in the parent’s onMounted, child DOM and child template refs are ready. Unmount follows the same rule: children’s <code>onUnmounted</code> run before the parent’s.',
      tone: i >= 4 ? 'ok' : null,
      draw(g) {
        B(g, 40, 40, 300, 220, null, { hot: who === 'p' }); T(g, 56, 64, 'Parent', { b: true });
        B(g, 80, 120, 220, 110, null, { hot: who === 'c' }); T(g, 96, 144, 'Child', { b: true });
        T(g, 420, 40, 'console', { b: true, fs: 12, c: 'var(--text-3)' });
        ORDER.slice(0, i + 1).forEach(([tt], j) => T(g, 420, 66 + j * 30, `${j + 1}. ${tt}`, { mono: true, fs: 12, c: j === i ? 'var(--accent)' : 'var(--text-2)', b: j === i }));
      }
    }));
  }
  const TICK = [
    { say: 'The DOM shows <code>0</code>. A handler runs <code>count.value++</code>.', code: 'count.value++', dom: '<p>0</p>', st: 1, q: '' },
    { say: 'Vue <b>does not</b> patch synchronously. It queues the component’s update job and keeps going, so 100 changes in one handler cause one render.', code: "count.value++\nconsole.log(p.value!.textContent)   // '0' – DOM not updated yet!", dom: '<p>0</p>', st: 1, q: 'update(Comp)', bad: true },
    { say: '<code>await nextTick()</code> waits for that queue to flush (a microtask). The patch runs.', code: "count.value++\nawait nextTick()\nconsole.log(p.value!.textContent)   // '1'", dom: '<p>0</p> → patching', st: 1, q: 'flushing…', hot: true },
    { say: 'Now the DOM matches the state. Use this when you must measure or scroll right after a change, e.g. scroll a chat to the newest message.', dom: '<p>1</p>', st: 1, q: '', ok: true }
  ];
  function tick() {
    return TICK.map((s) => ({ ...s, tone: s.bad ? 'warn' : s.ok ? 'ok' : null, draw(g) {
      T(g, 30, 26, 'State changes now, the DOM catches up a tick later', { b: true, fs: 14 });
      B(g, 30, 60, 200, 60, `count.value = ${s.st}`, { mono: true, hot: true });
      B(g, 280, 60, 200, 60, `queue: ${s.q || '(empty)'}`, { mono: true, fs: 12, warn: !!s.q });
      B(g, 530, 60, 200, 60, s.dom, { mono: true, fs: 12, err: s.bad, ok: s.ok, hot: s.hot });
      A(g, 230, 90, 278, 90, { hot: !!s.q }); A(g, 480, 90, 528, 90, { hot: s.hot || s.ok, label: 'flush' });
      T(g, 380, 170, 'sync code  →  microtask: flush queue  →  nextTick() resolves', { a: 'middle', mono: true, fs: 12, c: 'var(--text-2)' });
    } }));
  }
  mount({ aria: 'Vue lifecycle hooks, parent child order and nextTick', H: 280, modes: { label: 'Concept', opts: [['life', 'Hook timeline'], ['order', 'Parent / child order'], ['tick', 'nextTick']] },
    steps: (m) => (m === 'life' ? life() : m === 'order' ? order() : tick()) });
});

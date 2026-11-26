/* Composition API: grouping code by feature instead of by option, and composables as reusable stateful functions. */
IA.widget('vue-composition-api', (root, ctx) => {
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
  const FEAT = [['search', 'var(--accent)'], ['paging', 'var(--warn)'], ['auth', 'var(--ok)']];
  const OPTS = [['data()', ['search', 'paging', 'auth']], ['computed', ['search', 'paging']], ['watch', ['search', 'auth']], ['methods', ['search', 'paging', 'auth']], ['mounted()', ['paging', 'auth']]];
  function org(i) {
    return (g) => {
      T(g, 30, 26, 'Options API: grouped by option', { b: true, fs: 13 }); T(g, 420, 26, 'Composition API: grouped by feature', { b: true, fs: 13 });
      const pick = i === 0 ? null : FEAT[Math.min(i - 1, 2)][0];
      let y = 40;
      OPTS.forEach(([o, fs]) => {
        T(g, 30, y + 14, o, { mono: true, fs: 12, c: 'var(--text-2)' });
        fs.forEach((f, j) => { const c = FEAT.find((x) => x[0] === f)[1]; g.append(svg('rect', { x: 120 + j * 82, y, width: 74, height: 20, rx: 5, fill: c, opacity: pick && pick !== f ? 0.15 : 0.8 })); });
        y += 44;
      });
      if (i >= 1) {
        FEAT.forEach(([f, c], j) => {
          const on = pick === f; const yy = 40 + j * 74;
          g.append(svg('rect', { x: 420, y: yy, width: 310, height: 62, rx: 8, fill: c, opacity: on ? 0.75 : 0.18 }));
          T(g, 436, yy + 26, `use${f[0].toUpperCase()}${f.slice(1)}()`, { mono: true, b: true, c: on ? 'var(--bg)' : 'var(--text)' });
          T(g, 436, yy + 46, 'state + computed + watch + methods', { fs: 11, c: on ? 'var(--bg)' : 'var(--text-3)' });
        });
      }
    };
  }
  const ORG = [
    { say: 'One component, three features: search, paging, auth. In the <b>Options API</b> each feature is split across <code>data</code>, <code>computed</code>, <code>watch</code>, <code>methods</code>, hooks.' },
    { say: 'To understand <b>search</b> you jump between five sections. In <code>&lt;script setup&gt;</code> all search code sits together, and can move into a <code>useSearch()</code> function.', code: "const { query, results } = useSearch()\nconst { page, next } = usePaging(results)\nconst { user } = useAuth()" },
    { say: 'Same for <b>paging</b>: one block, one place to read, test and reuse.' },
    { say: 'And <b>auth</b>. The Options API is still supported in Vue 3; the Composition API is the recommended style for new TypeScript code because types flow through plain functions and variables.' }
  ].map((s, i) => ({ ...s, draw: org(i) }));
  function comp(i, shared) {
    return (g) => {
      T(g, 30, 26, shared ? 'state declared OUTSIDE the function: one copy' : 'state declared INSIDE the function: one copy per call', { b: true, fs: 13 });
      B(g, 270, 46, 220, 62, shared ? 'useCounter.ts\nlet count = ref(0)  // module' : 'useCounter.ts\nfunction() { ref(0) }', { mono: true, fs: 11, hot: i === 0 });
      const vals = shared ? [i >= 2 ? 1 : 0, i >= 2 ? 1 : 0] : [i >= 2 ? 1 : 0, 0];
      [[60, 'CompA.vue'], [480, 'CompB.vue']].forEach(([x, n], j) => {
        B(g, x, 170, 220, 80, `${n}\ncount = ${vals[j]}`, { mono: true, hot: i >= 1 && (j === 0 ? i >= 2 : false), fs: 12, warn: shared && i >= 2 && j === 1 });
        if (i >= 1) A(g, 380, 108, x + 110, 168, { hot: true, label: 'useCounter()' });
      });
      if (shared) { if (i >= 1) B(g, 300, 128, 160, 30, 'same ref', { warn: true, fs: 12 }); }
      else if (i >= 1) { T(g, 170, 270, 'own ref', { a: 'middle', fs: 11, c: 'var(--text-3)' }); T(g, 590, 270, 'own ref', { a: 'middle', fs: 11, c: 'var(--text-3)' }); }
    };
  }
  const COMP = (shared) => [
    { say: shared ? 'Now the ref is created at <b>module level</b>, outside the function. Modules are evaluated once.' : 'A <b>composable</b> is a function, by convention named <code>useX</code>, that uses Vue’s reactivity and returns refs. This one creates its ref <b>inside</b> the function.', code: shared ? "const count = ref(0)                 // module scope\nexport function useCounter() { return { count, inc: () => count.value++ } }" : "export function useCounter() {\n  const count = ref(0)               // per call\n  return { count, inc: () => count.value++ }\n}" },
    { say: 'Two components call <code>useCounter()</code> from their <code>&lt;script setup&gt;</code>.' },
    { say: shared ? 'Clicking in A also changes B: they share one ref. Handy for a tiny global store; dangerous in SSR, where one module copy serves <b>all users’</b> requests. Prefer Pinia for shared state.' : 'Clicking in A changes only A. Each call made its own state, like <code>new</code> in Java. Composables reuse <b>logic</b>, not state.', tone: shared ? 'warn' : 'ok' }
  ].map((s, i) => ({ ...s, draw: comp(i, shared) }));
  mount({ aria: 'Options versus Composition API, and composable state', H: 290, modes: { label: 'Concept', opts: [['org', 'Options vs Composition'], ['own', 'Composable: per-call state'], ['shared', 'Composable: module state']] },
    steps: (m) => (m === 'org' ? ORG : COMP(m === 'shared')) });
});

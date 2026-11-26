/* Signals vs a VDOM re-render: what re-runs when count changes, and how a push-pull graph avoids glitches. */
IA.widget('fe-signals', (root, ctx) => {
  const G = () => [
    { id: 'count', x: 20, y: 120, w: 170, h: 64, t: 'count', s: 'signal = 1' },
    { id: 'dbl', x: 240, y: 40, w: 170, h: 64, t: 'double', s: 'computed = 2' },
    { id: 'big', x: 240, y: 200, w: 170, h: 64, t: 'isBig', s: 'computed = false' },
    { id: 'txt', x: 455, y: 40, w: 175, h: 64, t: 'effect: <span>', s: 'text = "2"' },
    { id: 'cls', x: 455, y: 200, w: 175, h: 64, t: 'effect: class', s: 'small' }];
  const ED = [['count', 'dbl'], ['count', 'big'], ['dbl', 'txt'], ['big', 'cls']];
  const S = {
    W: 640, H: 290, aria: 'Dependency graph: a signal, two computeds and two effects', segLabel: 'Model',
    modes: {
      sig: { label: 'Signals (Solid)', code: 'const [count, setCount] = createSignal(1);\nconst double = createMemo(() => count() * 2);\nconst isBig = createMemo(() => count() > 5);\n// JSX compiles to effects bound to exact DOM nodes\nsetCount(2);', nodes: G(), edges: ED, frames: [
        { on: { count: 'acc' }, e: { 'count>dbl': 'acc', 'count>big': 'acc' }, cap: 'Reading count() inside a computed or effect subscribes it automatically: the graph is built by tracking reads at run time.' },
        { on: { count: 'warn' }, s: { count: 'signal = 2' }, cap: 'setCount(2). Push phase: count marks its subscribers dirty (or “check”). Nothing is recomputed yet.', tone: 'warn' },
        { on: { dbl: 'ok', txt: 'ok' }, s: { dbl: 'computed = 4', txt: 'text = "4"' }, e: { 'dbl>txt': 'ok' }, cap: 'Pull phase: double recomputes (4), so its effect updates exactly one text node. No component function re-ran.', tone: 'ok' },
        { on: { big: 'ok', cls: 'dim' }, s: { big: 'computed = false (same)' }, cap: 'isBig recomputes but is still false. Equal value → its downstream effect is skipped. Cost scales with what changed, not with the component tree.', tone: 'ok', stat: [['component re-runs', '0'], ['DOM writes', '1']] }] },
      vdom: { label: 'VDOM (React)', code: 'function Counter() {\n  const [count, setCount] = useState(1);\n  const double = count * 2;\n  return <Big flag={count > 5}><span>{double}</span></Big>;\n}', nodes: [
        { id: 'set', x: 20, y: 120, w: 170, h: 64, t: 'setCount(2)', s: 'schedule render' },
        { id: 'fn', x: 240, y: 40, w: 170, h: 64, t: 'Counter()', s: 're-runs' },
        { id: 'kids', x: 240, y: 200, w: 170, h: 64, t: '<Big> subtree', s: 're-renders too' },
        { id: 'diff', x: 455, y: 40, w: 175, h: 64, t: 'diff old/new', s: 'reconcile' },
        { id: 'dom', x: 455, y: 200, w: 175, h: 64, t: 'DOM patch', s: '' }], edges: [['set', 'fn'], ['fn', 'kids'], ['fn', 'diff'], ['diff', 'dom']], frames: [
        { on: { set: 'warn' }, cap: 'React tracks state per component, not per value. setCount schedules a re-render of Counter.' },
        { on: { fn: 'acc' }, e: { 'set>fn': 'acc' }, cap: 'The whole function runs again and returns a new virtual tree.' },
        { on: { kids: 'warn' }, e: { 'fn>kids': 'acc' }, cap: 'Children re-render by default even if their props are equal, unless memoised (memo, or React Compiler 1.0 auto-memoisation).', tone: 'warn' },
        { on: { diff: 'acc', dom: 'ok' }, s: { dom: 'text "2" → "4"' }, e: { 'fn>diff': 'acc', 'diff>dom': 'ok' }, cap: 'Reconciliation diffs old vs new and patches one text node. Same DOM result, more JS work: proportional to the subtree, not to the change.', stat: [['component re-runs', '2'], ['DOM writes', '1']] }] },
      glitch: { label: 'Diamond / glitch', code: 'const full = computed(() => first() + " " + last());\nconst upper = computed(() => first().toUpperCase());\neffect(() => log(full() + " / " + upper()));\nbatch(() => { setFirst("ann"); });', nodes: [
        { id: 'first', x: 20, y: 120, w: 170, h: 64, t: 'first', s: '"bob"' },
        { id: 'full', x: 240, y: 40, w: 170, h: 64, t: 'full', s: '"bob lee"' },
        { id: 'up', x: 240, y: 200, w: 170, h: 64, t: 'upper', s: '"BOB"' },
        { id: 'eff', x: 455, y: 120, w: 175, h: 64, t: 'effect (log)', s: 'bob lee / BOB' }], edges: [['first', 'full'], ['first', 'up'], ['full', 'eff'], ['up', 'eff']], frames: [
        { on: { first: 'warn' }, s: { first: '"ann"' }, cap: 'A diamond: the effect depends on first through two paths.' },
        { on: { full: 'err', eff: 'err' }, s: { full: '"ann lee"', eff: 'ann lee / BOB  ✗' }, cap: 'A naive push-based system runs the effect as soon as full changes, while upper is still old: a glitch (inconsistent state was observed).', tone: 'err' },
        { on: { full: 'ok', up: 'ok', eff: 'warn' }, s: { up: '"ANN"', eff: 'pending' }, cap: 'Push-pull fixes it: the write only marks nodes dirty; effects are queued and, when they run, pull their sources, which recompute in dependency order.' },
        { on: { eff: 'ok' }, s: { eff: 'ann lee / ANN  ✓ (once)' }, cap: 'The effect runs once, with consistent values. Solid, Vue, Angular, Preact and the TC39 proposal all aim for glitch-free reads like this.', tone: 'ok' }] }
    }
  };
  /* Generic step-through stage: modes → nodes, edges and cumulative frames. */
  const { el, svg, sleep, reduced } = ctx;
  const COL = { ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--err)', acc: 'var(--accent)', off: 'var(--border)' };
  const keys = Object.keys(S.modes); let mode = keys[0]; let k = 0; let gen = 0; let running = false;
  const seg = el('div', { class: 'seg', 'aria-label': S.segLabel || 'Variant' });
  keys.forEach((v) => { const b = el('button', { text: S.modes[v].label, class: v === mode ? 'on' : '' }); b.addEventListener('click', () => { mode = v; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeEl = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const st = svg('svg', { viewBox: `0 0 ${S.W} ${S.H}`, role: 'img', 'aria-label': S.aria });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('span', { class: 'n', text: '0' }), el('div', { class: 't', text: '' }));
  const stats = el('div', { class: 'w-stats' });
  root.append(keys.length > 1 ? el('div', { class: 'w-controls' }, seg) : null, codeEl, el('div', { class: 'w-stage' }, st), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, stats);
  let N = {}; let E = {};
  const tr = reduced ? 'none' : 'all .6s ease';
  function draw() {
    st.innerHTML = ''; N = {}; E = {}; const M = S.modes[mode];
    const byId = {}; M.nodes.forEach((n) => { byId[n.id] = n; });
    (M.edges || []).forEach(([a, b]) => { const A = byId[a]; const B = byId[b];
      const l = svg('line', { x1: A.x + A.w / 2, y1: A.y + A.h / 2, x2: B.x + B.w / 2, y2: B.y + B.h / 2, stroke: 'var(--border)', 'stroke-width': 3, style: { transition: tr } });
      st.append(l); E[a + '>' + b] = l; });
    M.nodes.forEach((n) => {
      const g = svg('g', { style: { transition: tr } });
      const r = svg('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 10, fill: n.fill || 'var(--surface-2)', stroke: 'var(--border)', 'stroke-width': 2, 'stroke-dasharray': n.dash ? '7 5' : '', style: { transition: tr } });
      const fs = n.fs || 16;
      const t = svg('text', { x: n.x + 10, y: n.y + fs + 6, 'font-size': fs, 'font-weight': 700, fill: 'var(--text)', text: n.t || '' });
      const s = svg('text', { x: n.x + 10, y: n.y + fs * 2 + 10, 'font-size': fs - 3, fill: 'var(--text-2)', text: n.s || '' });
      g.append(r, t, s); st.append(g); N[n.id] = { g, r, t, s, n };
      if (n.hide) g.style.opacity = '0';
    });
  }
  function apply(f) {
    Object.entries(f.on || {}).forEach(([id, c]) => { const x = N[id]; if (!x) return;
      if (c === 'hide') { x.g.style.opacity = '0'; return; }
      if (c === 'dim') { x.g.style.opacity = '0.35'; return; }
      x.g.style.opacity = '1'; x.r.setAttribute('stroke', COL[c] || c); x.r.setAttribute('stroke-width', c === 'off' ? 2 : 3.5);
      x.r.setAttribute('fill', c === 'off' ? (x.n.fill || 'var(--surface-2)') : 'var(--accent-soft)'); });
    Object.entries(f.e || {}).forEach(([id, c]) => { const l = E[id]; if (l) { l.setAttribute('stroke', COL[c] || c); l.setAttribute('stroke-dasharray', c === 'off' ? '' : '6 5'); } });
    Object.entries(f.t || {}).forEach(([id, v]) => { if (N[id]) N[id].t.textContent = v; });
    Object.entries(f.s || {}).forEach(([id, v]) => { if (N[id]) N[id].s.textContent = v; });
    Object.entries(f.geo || {}).forEach(([id, [x, y, w, h]]) => { const q = N[id]; if (!q) return; const fs = q.n.fs || 16;
      q.r.setAttribute('x', x); q.r.setAttribute('y', y); q.r.setAttribute('width', w); q.r.setAttribute('height', h);
      q.t.setAttribute('x', x + 10); q.t.setAttribute('y', y + fs + 6); q.s.setAttribute('x', x + 10); q.s.setAttribute('y', y + fs * 2 + 10); });
  }
  function show() {
    const M = S.modes[mode]; draw(); stats.innerHTML = ''; let statList = null;
    for (let i = 0; i < k; i++) { apply(M.frames[i]); if (M.frames[i].stat) statList = M.frames[i].stat; }
    narr.firstChild.textContent = String(k); narr.className = 'caption' + (k && M.frames[k - 1].tone ? ' ' + M.frames[k - 1].tone : '');
    narr.lastChild.textContent = k ? M.frames[k - 1].cap : (M.start || S.start || 'Press Play, or Step through it.');
    (statList || []).forEach(([l, v]) => stats.append(el('span', { class: 'w-stat', html: `${l} <b>${v}</b>` })));
    bStep.disabled = k >= M.frames.length;
  }
  function step() { if (k >= S.modes[mode].frames.length) return false; k++; show(); return true; }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    const M = S.modes[mode]; codeEl.style.display = M.code ? '' : 'none'; codeEl.innerHTML = '';
    if (M.code) codeEl.append(el('pre', { html: IA.highlight(M.code, M.lang || 'ts') }));
    if (reduced) { k = 0; } show(); }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (reduced) { k = S.modes[mode].frames.length; show(); return; }
    if (k >= S.modes[mode].frames.length) reset(); running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(S.speed || 2600);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

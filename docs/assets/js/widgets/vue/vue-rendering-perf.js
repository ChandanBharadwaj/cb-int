/* Rendering & performance: compiler-informed patching (static hoisting, patch flags, block tree), then the opt-in tools. */
IA.widget('vue-rendering-perf', (root, ctx) => {
  const SLUG = 'vue-rendering-perf';
  const SCENES = {
  'Compiler hints': {
    w: 760, h: 300, label: 'A block tree: static nodes are skipped, only dynamic children are diffed',
    nodes: [
      { id: 'root', x: 280, y: 14, w: 200, h: 50, t: '<div> block root', s: 'dynamicChildren[2]' },
      { id: 'h1', x: 20, y: 110, w: 170, h: 60, t: '<h1>Orders</h1>', s: 'static · cached', fs: 12 },
      { id: 'p', x: 205, y: 110, w: 170, h: 60, t: '<p>{{ total }}</p>', s: 'PatchFlag TEXT', fs: 12 },
      { id: 'btn', x: 390, y: 110, w: 170, h: 60, t: '<b :class="c">', s: 'PatchFlag CLASS', fs: 12 },
      { id: 'foot', x: 575, y: 110, w: 170, h: 60, t: '<footer>…</footer>', s: 'static · cached', fs: 12 },
      { id: 'diff', x: 205, y: 220, w: 355, h: 60, t: 'patch: compare 2 nodes, 1 prop each', s: 'not the whole tree' }
    ],
    edges: [{ id: 'a', f: 'root', t: 'h1' }, { id: 'b', f: 'root', t: 'p' }, { id: 'c', f: 'root', t: 'btn' }, { id: 'd', f: 'root', t: 'foot' }, { id: 'e', f: 'p', t: 'diff' }, { id: 'f', f: 'btn', t: 'diff' }],
    frames: [
      { hot: ['root'], cap: 'Vue keeps a <b>virtual DOM</b>: render functions return plain objects (VNodes), and the renderer patches the real DOM by comparing old and new VNodes.' },
      { hot: ['h1', 'foot'], dim: ['p', 'btn'], cap: 'The template compiler sees that <code>&lt;h1&gt;</code> and <code>&lt;footer&gt;</code> can never change. It creates their VNodes <b>once</b> (hoisted out of the render function up to 3.4, cached per instance since 3.5) and skips them on every update. Large static runs are even stringified into one <code>innerHTML</code> chunk.' },
      { hot: ['p', 'btn'], dim: ['h1', 'foot'], cap: 'Dynamic nodes get a <b>patch flag</b> saying exactly what can change: TEXT, CLASS, STYLE, PROPS (with the prop names)…' },
      { hot: ['root', 'p', 'btn'], on: ['b', 'c'], dim: ['h1', 'foot'], cap: 'The block root collects its dynamic descendants into a flat <code>dynamicChildren</code> array. On update Vue walks that array, not the tree.' },
      { ok: ['diff'], on: ['e', 'f'], dim: ['h1', 'foot'], cap: 'Update cost scales with the number of <b>dynamic</b> nodes, not template size. Hand-written render functions and JSX miss most of these hints.' }
    ]
  },
  'Opt-in tools': {
    w: 760, h: 270, label: 'shallowRef, v-memo, KeepAlive and lazy loading',
    nodes: [
      { id: 'sr', x: 20, y: 20, w: 350, h: 100, t: 'shallowRef(bigArray)', s: 'only .value replacement triggers' },
      { id: 'vm', x: 390, y: 20, w: 350, h: 100, t: 'v-memo="[row.id === selected]"', s: 'skip sub-tree unless deps change', fs: 12 },
      { id: 'ka', x: 20, y: 150, w: 350, h: 100, t: '<KeepAlive :max="5">', s: 'cache instances: onActivated' },
      { id: 'lz', x: 390, y: 150, w: 350, h: 100, t: 'defineAsyncComponent / () => import()', s: 'split chunks; Vue 3.5 lazy hydration', fs: 12 }
    ],
    edges: [],
    frames: [
      { hot: ['sr'], cap: '<code>shallowRef</code>: Vue does not wrap 50,000 rows in proxies. You must replace the array (<code>rows.value = next</code>) or call <code>triggerRef(rows)</code>; <code>rows.value.push()</code> does not re-render.', code: "const rows = shallowRef<Row[]>([])\nrows.value = await api.rows()          // triggers\nrows.value.push(x)                     // does NOT trigger\nrows.value = [...rows.value, x]        // triggers" },
      { hot: ['vm'], cap: '<code>v-memo</code> caches a sub-tree and re-renders it only when a dep changes. With <code>v-for</code>, selecting one of 1,000 rows re-renders 2 rows instead of 1,000. Forgetting a dep shows stale UI.', code: '<div v-for="row in rows" :key="row.id" v-memo="[row.id === selectedId]">\n  <p :class="{ on: row.id === selectedId }">{{ row.name }}</p>\n</div>' },
      { hot: ['ka'], cap: '<code>&lt;KeepAlive&gt;</code> keeps switched-out components alive (state, scroll, form input). They get <code>onDeactivated</code>/<code>onActivated</code> instead of unmount/mount. Set <code>max</code>: it is an LRU cache.' },
      { hot: ['lz'], cap: 'Lazy loading ships less JavaScript: route-level <code>() =&gt; import()</code> and <code>defineAsyncComponent</code>. For SSR, Vue 3.5 adds lazy hydration strategies such as <code>hydrateOnVisible()</code>.' },
      { ok: ['sr', 'vm', 'ka', 'lz'], cap: 'Order of operations in an interview: measure (DevTools performance, Lighthouse), fix the data shape and list size (pagination, virtual scrolling), then reach for these tools.' }
    ]
  }
};
  /* Generic step-through scene: boxes + arrows; each frame highlights some of them and explains. */
  const { el, svg, sleep, reduced } = ctx;
  const names = Object.keys(SCENES);
  let cur = names[0]; let k = 0; let running = false; let gen = 0;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scenario' });
  names.forEach((n) => { const b = el('button', { text: n, class: n === cur ? 'on' : '' }); b.addEventListener('click', () => { cur = n; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { role: 'img' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  const codeHost = el('div', { style: { marginTop: '8px' } });
  if (names.length > 1) root.append(el('div', { class: 'w-controls' }, seg));
  root.append(el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, stats, codeHost);
  const KC = { a: 'var(--accent)', ok: 'var(--ok)', err: 'var(--err)', warn: 'var(--warn)', m: 'var(--text-3)' };
  function box(n, f) {
    const hot = (f.hot || []).includes(n.id), bad = (f.bad || []).includes(n.id), ok = (f.ok || []).includes(n.id), dim = (f.dim || []).includes(n.id) || (n.hidden && !(f.show || []).includes(n.id) && !hot && !bad && !ok);
    if (n.hidden && dim && !(f.show || []).includes(n.id) && !hot && !bad && !ok) return null;
    const stroke = bad ? KC.err : ok ? KC.ok : hot ? KC.a : 'var(--border)';
    const fill = bad ? 'color-mix(in srgb, var(--err) 14%, var(--surface))' : ok ? 'color-mix(in srgb, var(--ok) 14%, var(--surface))' : hot ? 'var(--accent-soft)' : n.fill || 'var(--surface)';
    const t = (f.set && f.set[n.id] != null) ? f.set[n.id] : n.t; const s = (f.sub && f.sub[n.id] != null) ? f.sub[n.id] : n.s;
    const g = svg('g', { opacity: dim && !n.hidden ? 0.35 : 1, style: reduced ? '' : 'transition: opacity .4s' });
    g.append(svg('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 8, fill, stroke, 'stroke-width': hot || bad || ok ? 2.2 : 1.2 }));
    const lines = String(t).split('\n'); const fs = n.fs || 13; const total = lines.length + (s ? 1 : 0);
    const y0 = n.y + n.h / 2 - ((total - 1) * (fs + 3)) / 2 + fs / 3;
    lines.forEach((ln, i) => g.append(svg('text', { x: n.x + n.w / 2, y: y0 + i * (fs + 3), 'text-anchor': 'middle', 'font-size': fs, 'font-weight': i === 0 ? 700 : 400, fill: 'var(--text)', 'font-family': n.mono ? 'var(--mono)' : null, text: ln })));
    if (s) g.append(svg('text', { x: n.x + n.w / 2, y: y0 + lines.length * (fs + 3), 'text-anchor': 'middle', 'font-size': fs - 2, fill: bad ? KC.err : 'var(--text-2)', 'font-family': 'var(--mono)', text: s }));
    return g;
  }
  function anchor(a, b) {
    const cx = a.x + a.w / 2, cy = a.y + a.h / 2, dx = (b.x + b.w / 2) - cx, dy = (b.y + b.h / 2) - cy;
    const sx = dx ? (a.w / 2) / Math.abs(dx) : Infinity, sy = dy ? (a.h / 2) / Math.abs(dy) : Infinity; const s = Math.min(sx, sy);
    return [cx + dx * s, cy + dy * s];
  }
  function draw() {
    const S = SCENES[cur]; const f = S.frames[k] || {}; const by = {}; S.nodes.forEach((n) => { by[n.id] = n; });
    stage.innerHTML = ''; stage.setAttribute('viewBox', `0 0 ${S.w || 760} ${S.h || 300}`); stage.setAttribute('aria-label', S.label || cur);
    const mk = svg('marker', { id: 'ah-' + SLUG, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0L10 5L0 10z', fill: 'context-stroke' }));
    const mkA = svg('marker', { id: 'aa-' + SLUG, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0L10 5L0 10z', fill: 'var(--accent)' }));
    const mkM = svg('marker', { id: 'am-' + SLUG, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0L10 5L0 10z', fill: 'var(--text-3)' }));
    const mkE = svg('marker', { id: 'ae-' + SLUG, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0L10 5L0 10z', fill: 'var(--err)' }));
    stage.append(svg('defs', null, mk, mkA, mkM, mkE));
    (S.groups || []).forEach((gp) => stage.append(svg('rect', { x: gp.x, y: gp.y, width: gp.w, height: gp.h, rx: 10, fill: 'none', stroke: 'var(--border)', 'stroke-dasharray': '5 4' }), svg('text', { x: gp.x + 8, y: gp.y + 15, 'font-size': 11, fill: 'var(--text-3)', text: gp.t })));
    (S.edges || []).forEach((e) => {
      const on = (f.on || []).includes(e.id), bad = (f.badEdge || []).includes(e.id);
      if (e.hidden && !on && !bad) return;
      const [x1, y1] = anchor(by[e.f], by[e.t]); const [x2, y2] = anchor(by[e.t], by[e.f]);
      const col = bad ? KC.err : on ? KC.a : 'var(--text-3)';
      const p = svg('line', { x1, y1, x2, y2, stroke: col, 'stroke-width': on || bad ? 2.4 : 1.2, 'stroke-dasharray': e.dash || bad ? '5 4' : null, opacity: on || bad ? 1 : 0.55, 'marker-end': `url(#${bad ? 'ae' : on ? 'aa' : 'am'}-${SLUG})` });
      stage.append(p);
      if (e.l) stage.append(svg('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 5, 'text-anchor': 'middle', 'font-size': 11, fill: on ? 'var(--accent)' : 'var(--text-3)', text: e.l }));
    });
    S.nodes.forEach((n) => { const g = box(n, f); if (g) stage.append(g); });
    (f.notes || []).forEach((t) => stage.append(svg('text', { x: t.x, y: t.y, 'font-size': t.fs || 12, 'text-anchor': t.a || 'start', fill: t.c ? KC[t.c] : 'var(--text-2)', 'font-weight': 600, text: t.t })));
    narr.firstChild.innerHTML = f.cap || '';
    stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `step <b>${k + 1}</b> / ${S.frames.length}` }));
    (f.stats || []).forEach((s) => stats.append(el('span', { class: 'w-stat', html: s })));
    codeHost.innerHTML = ''; if (f.code || S.code) codeHost.append(ctx.codeBox(f.code || S.code, f.lang || S.lang || 'ts'));
    bStep.disabled = k >= S.frames.length - 1;
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; draw(); }
  function step() { const S = SCENES[cur]; if (k >= S.frames.length - 1) return false; k++; draw(); return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= SCENES[cur].frames.length - 1) { k = 0; draw(); }
    if (reduced) { k = SCENES[cur].frames.length - 1; draw(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen) { await sleep(2600); if (!running || g !== gen || !step()) break; }
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

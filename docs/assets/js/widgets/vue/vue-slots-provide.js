/* Slots & provide/inject: who owns the markup, who owns the data, and how values tunnel down the tree. */
IA.widget('vue-slots-provide', (root, ctx) => {
  const SLUG = 'vue-slots-provide';
  const SCENES = {
  'Scoped slot': {
    w: 760, h: 300, label: 'Parent passes a slot function to a child; the child calls it with data',
    nodes: [
      { id: 'p', x: 20, y: 30, w: 230, h: 90, t: 'Parent.vue', s: '<template #row="{ user }">' },
      { id: 'fn', x: 20, y: 180, w: 230, h: 80, t: 'slot function', s: 'row(props) → VNodes' },
      { id: 'c', x: 300, y: 30, w: 210, h: 90, t: 'UserTable.vue', s: 'v-for user in users' },
      { id: 'call', x: 300, y: 180, w: 210, h: 80, t: '<slot name="row"', s: ':user="u" />' },
      { id: 'dom', x: 560, y: 100, w: 180, h: 100, t: 'DOM', s: '<tr> × 3' }
    ],
    edges: [
      { id: 'e1', f: 'p', t: 'c', l: 'renders' }, { id: 'e2', f: 'p', t: 'fn', l: 'compiles to' },
      { id: 'e3', f: 'fn', t: 'call', l: 'passed in $slots' }, { id: 'e4', f: 'call', t: 'dom', l: 'VNodes' }, { id: 'e5', f: 'c', t: 'call' }
    ],
    frames: [
      { hot: ['p'], cap: 'The parent writes the <b>markup</b> for each row, but it does not have the loop variable. It only declares <code>#row="{ user }"</code>.', code: '<UserTable :users="users">\n  <template #row="{ user }">\n    <td>{{ user.name }}</td><td>{{ user.email }}</td>\n  </template>\n</UserTable>' },
      { hot: ['fn'], on: ['e2'], cap: 'The compiler turns that template into a <b>function</b>: <code>row(props) → VNodes</code>. A slot is just a render callback, like a Java lambda.' },
      { hot: ['c', 'fn'], on: ['e1', 'e3'], cap: 'The function travels to the child inside <code>$slots</code> (in <code>&lt;script setup&gt;</code>: <code>useSlots()</code>). The child owns the data and the loop.' },
      { hot: ['call'], on: ['e5'], cap: 'For each user, the child calls <code>&lt;slot name="row" :user="u"/&gt;</code>. The attributes become the <b>slot props</b> object.', code: '<!-- UserTable.vue -->\n<tr v-for="u in users" :key="u.id">\n  <slot name="row" :user="u">{{ u.name }}</slot>  <!-- fallback content -->\n</tr>' },
      { ok: ['dom'], on: ['e4'], cap: 'The VNodes the parent described end up inside the child’s <code>&lt;tr&gt;</code>. Rule: <b>markup scope is the parent’s</b> (it sees parent state); slot props are the only child data it sees.' }
    ]
  },
  'provide / inject': {
    w: 760, h: 320, label: 'An ancestor provides a ref; a deep descendant injects it without prop drilling',
    nodes: [
      { id: 'app', x: 280, y: 16, w: 200, h: 56, t: 'App', s: "provide('theme', theme)" },
      { id: 'lay', x: 280, y: 100, w: 200, h: 50, t: 'Layout' },
      { id: 'side', x: 60, y: 180, w: 200, h: 50, t: 'Sidebar' },
      { id: 'card', x: 500, y: 180, w: 200, h: 50, t: 'Card' },
      { id: 'btn', x: 500, y: 258, w: 200, h: 50, t: 'Button', s: "inject('theme')" },
      { id: 'other', x: 60, y: 258, w: 200, h: 50, t: 'Modal (teleported)', s: 'still in the component tree' }
    ],
    edges: [
      { id: 'a', f: 'app', t: 'lay' }, { id: 'b', f: 'lay', t: 'side' }, { id: 'c', f: 'lay', t: 'card' }, { id: 'd', f: 'card', t: 'btn' }, { id: 'e', f: 'side', t: 'other' }
    ],
    frames: [
      { hot: ['app'], cap: '<code>App</code> calls <code>provide(\'theme\', theme)</code> in setup, where <code>theme</code> is a <code>ref</code>. Nothing is passed as a prop.', code: "// App.vue\nconst theme = ref<'light' | 'dark'>('light')\nprovide(ThemeKey, { theme: readonly(theme), toggle: () => (theme.value = theme.value === 'light' ? 'dark' : 'light') })" },
      { hot: ['btn'], on: ['a', 'c', 'd'], cap: '<code>Button</code> calls <code>inject(ThemeKey)</code>. Vue walks up the <b>component</b> parent chain (not the DOM) to the nearest provider. Layout and Card never touch it.' },
      { hot: ['app', 'btn'], on: ['a', 'c', 'd'], cap: 'Because the provided value is a <b>ref</b>, Button re-renders when App toggles it. Provide a plain string and the child gets a one-off copy that never updates.', code: "// Button.vue\nconst { theme, toggle } = inject(ThemeKey)!   // typed with InjectionKey<T>\n// theme.value is reactive; mutate only through toggle()" },
      { hot: ['other'], on: ['a', 'b', 'e'], cap: 'A component rendered through <code>&lt;Teleport&gt;</code> lives elsewhere in the DOM but keeps its place in the component tree, so inject still finds App’s value.' },
      { bad: ['side'], cap: 'No provider above and no default? <code>inject()</code> returns <code>undefined</code> and logs a dev warning. Pass a default: <code>inject(key, fallback)</code>, or a factory with <code>inject(key, () =&gt; x, true)</code>.' }
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

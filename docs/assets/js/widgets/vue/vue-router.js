/* Vue Router 4: what happens between router.push() and the new component on screen. */
IA.widget('vue-router', (root, ctx) => {
  const SLUG = 'vue-router';
  const SCENES = {
  'Navigation': {
    w: 760, h: 300, label: 'Navigation pipeline: push, match, guards, resolve lazy chunk, confirm, render',
    nodes: [
      { id: 'push', x: 14, y: 30, w: 130, h: 60, t: 'router.push', s: "'/users/42'" },
      { id: 'match', x: 170, y: 30, w: 140, h: 60, t: 'matcher', s: '/users/:id' },
      { id: 'leave', x: 336, y: 30, w: 140, h: 60, t: 'beforeRouteLeave', s: 'old view' },
      { id: 'each', x: 502, y: 30, w: 140, h: 60, t: 'beforeEach', s: 'global (auth)' },
      { id: 'enter', x: 502, y: 140, w: 140, h: 60, t: 'beforeEnter', s: 'route record' },
      { id: 'lazy', x: 336, y: 140, w: 140, h: 60, t: 'import()', s: 'UserView chunk' },
      { id: 'resolve', x: 170, y: 140, w: 140, h: 60, t: 'beforeResolve', s: 'global' },
      { id: 'ok', x: 14, y: 140, w: 130, h: 60, t: 'confirmed', s: 'URL updated' },
      { id: 'view', x: 14, y: 230, w: 300, h: 56, t: '<RouterView> renders UserView', s: 'afterEach, then DOM update' },
      { id: 'login', x: 502, y: 230, w: 140, h: 56, t: "redirect '/login'", s: '?redirect=/users/42', hidden: true }
    ],
    edges: [
      { id: 'a', f: 'push', t: 'match' }, { id: 'b', f: 'match', t: 'leave' }, { id: 'c', f: 'leave', t: 'each' }, { id: 'd', f: 'each', t: 'enter' },
      { id: 'e', f: 'enter', t: 'lazy' }, { id: 'f', f: 'lazy', t: 'resolve' }, { id: 'g', f: 'resolve', t: 'ok' }, { id: 'h', f: 'ok', t: 'view' }, { id: 'x', f: 'each', t: 'login', hidden: true }
    ],
    frames: [
      { hot: ['push'], cap: '<code>router.push()</code> returns a <b>Promise</b>. Nothing on screen changes yet.' },
      { hot: ['match'], on: ['a'], cap: 'The matcher ranks route paths and picks <code>/users/:id</code>. <code>route.params.id</code> is the <b>string</b> <code>"42"</code>, not a number.' },
      { hot: ['leave'], on: ['b'], cap: 'In-component <code>onBeforeRouteLeave</code> of the current view runs first: the place for “unsaved changes?” prompts. Returning <code>false</code> cancels.' },
      { hot: ['each'], on: ['c'], cap: 'Global <code>beforeEach</code> runs in registration order. Return <code>true</code>/<code>undefined</code> to continue, <code>false</code> to cancel, or a route location to redirect.', code: "router.beforeEach((to) => {\n  const auth = useAuthStore()            // Pinia works here: app is installed\n  if (to.meta.requiresAuth && !auth.isLoggedIn)\n    return { path: '/login', query: { redirect: to.fullPath } }\n})" },
      { bad: ['login'], show: ['login'], badEdge: ['x'], cap: 'Not logged in: the guard returns a location. The current navigation is <b>aborted</b> and a new one to <code>/login</code> starts, which runs the guards again. Guard <code>/login</code> itself, or you loop forever.' },
      { hot: ['enter'], on: ['d'], cap: 'Logged in: per-route <code>beforeEnter</code> runs. It fires only when <i>entering</i> the route, not when only params change (<code>/users/42 → /users/43</code>).' },
      { hot: ['lazy'], on: ['e'], cap: 'Lazy route: <code>component: () =&gt; import(\'./UserView.vue\')</code>. The chunk downloads now, then its <code>beforeRouteEnter</code> runs.' },
      { hot: ['resolve'], on: ['f'], cap: '<code>beforeResolve</code>: all in-component guards and async components are resolved. Last chance to cancel, e.g. to check permissions declared in the component.' },
      { ok: ['ok', 'view'], on: ['g', 'h'], cap: 'Navigation is confirmed: the URL updates, global <code>afterEach</code> hooks run, then the DOM update renders the new component in <code>&lt;RouterView&gt;</code> and <code>scrollBehavior</code> runs. The <code>push()</code> promise resolves.' }
    ]
  },
  'Params reuse': {
    w: 760, h: 240, label: 'Same component instance reused when only params change',
    nodes: [
      { id: 'a', x: 30, y: 40, w: 200, h: 70, t: '/users/42', s: 'UserView #1 created' },
      { id: 'b', x: 280, y: 40, w: 200, h: 70, t: '/users/43', s: 'same instance!' },
      { id: 'w', x: 530, y: 40, w: 200, h: 70, t: 'watch(() => route.params.id)', fs: 11 },
      { id: 'm', x: 280, y: 150, w: 200, h: 60, t: 'onMounted', s: 'does NOT run again' }
    ],
    edges: [{ id: 'x', f: 'a', t: 'b', l: 'push' }, { id: 'y', f: 'b', t: 'w' }, { id: 'z', f: 'b', t: 'm' }],
    frames: [
      { hot: ['a'], cap: 'Visiting <code>/users/42</code> creates UserView. <code>onMounted</code> fetches user 42.' },
      { hot: ['b'], on: ['x'], cap: 'Click “next user”: <code>/users/43</code> matches the <b>same route record</b>, so Vue Router reuses the component instance instead of destroying it.' },
      { bad: ['m'], badEdge: ['z'], cap: 'The classic bug: data still shows user 42, because <code>onMounted</code> does not run again.' },
      { ok: ['w'], on: ['y'], cap: 'Fix: watch the param (<code>{ immediate: true }</code>), or use <code>onBeforeRouteUpdate</code>, or force a new instance with <code>&lt;RouterView :key="route.fullPath"/&gt;</code>.', code: "const route = useRoute()\nwatch(() => route.params.id, (id) => load(String(id)), { immediate: true })" }
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

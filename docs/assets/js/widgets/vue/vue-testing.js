/* Testing Vue: the pyramid of unit (composables/stores), component (Vue Test Utils) and e2e (Playwright), and the async trap. */
IA.widget('vue-testing', (root, ctx) => {
  const SLUG = 'vue-testing';
  const SCENES = {
  'Component test': {
    w: 760, h: 280, label: 'mount, interact, await the re-render, assert',
    nodes: [
      { id: 'm', x: 20, y: 30, w: 160, h: 70, t: 'mount(Counter)', s: 'jsdom / happy-dom' },
      { id: 't', x: 210, y: 30, w: 160, h: 70, t: "trigger('click')", s: 'returns a Promise' },
      { id: 'q', x: 400, y: 30, w: 160, h: 70, t: 'scheduler queue', s: 're-render pending' },
      { id: 'a', x: 590, y: 30, w: 150, h: 70, t: 'expect(text)', s: '"1"' },
      { id: 'bad', x: 400, y: 170, w: 340, h: 70, t: 'no await → still "0"', s: 'flaky / failing assertion', hidden: true }
    ],
    edges: [{ id: 'e1', f: 'm', t: 't' }, { id: 'e2', f: 't', t: 'q', l: 'state++' }, { id: 'e3', f: 'q', t: 'a', l: 'flush' }, { id: 'e4', f: 't', t: 'bad', hidden: true }],
    frames: [
      { hot: ['m'], cap: 'Vitest runs the test in Node with a fake DOM (jsdom or happy-dom). <code>mount()</code> from <code>@vue/test-utils</code> renders the real component.', code: "import { mount } from '@vue/test-utils'\nimport { test, expect } from 'vitest'\nimport Counter from './Counter.vue'\n\ntest('increments', async () => {\n  const w = mount(Counter)\n  await w.get('button').trigger('click')\n  expect(w.get('[data-test=count]').text()).toBe('1')\n})" },
      { hot: ['t'], on: ['e1'], cap: 'Find elements by a stable selector such as <code>data-test</code>, then <code>trigger(\'click\')</code>. The handler runs synchronously and changes state.' },
      { hot: ['q'], on: ['e2'], cap: 'Vue does not patch the DOM at once; the update is queued (see Reactivity internals). <code>trigger()</code> returns <code>nextTick()</code>.' },
      { bad: ['bad'], show: ['bad'], badEdge: ['e4'], cap: 'Forget <code>await</code> and the assertion reads the old DOM: <code>"0"</code>.' },
      { ok: ['a'], on: ['e3'], cap: 'With <code>await</code>, the queue flushes first and the text is <code>"1"</code>. For API calls you also need <code>flushPromises()</code>.' }
    ]
  },
  'Pyramid': {
    w: 760, h: 260, label: 'What to test at each layer',
    nodes: [
      { id: 'u', x: 20, y: 170, w: 720, h: 70, t: 'unit: composables, stores, utils', s: 'Vitest · ms each · most tests' },
      { id: 'c', x: 120, y: 90, w: 520, h: 66, t: 'component: Vue Test Utils (or Testing Library)', s: 'props in → DOM + emitted events out' },
      { id: 'e', x: 240, y: 16, w: 280, h: 60, t: 'e2e: Playwright', s: 'real browser + real or mocked API' }
    ],
    edges: [],
    frames: [
      { hot: ['u'], cap: 'Composables and Pinia stores are plain TypeScript: test them without mounting. Use <code>setActivePinia(createPinia())</code> in <code>beforeEach</code>.', code: "beforeEach(() => setActivePinia(createPinia()))\ntest('total', () => {\n  const cart = useCartStore()\n  cart.add({ id: 1, price: 5 })\n  expect(cart.total).toBe(5)\n})" },
      { hot: ['c'], cap: 'Component tests check the <b>public contract</b>: given props and user events, which DOM and which <code>emitted()</code> events. Stub heavy children; <code>@pinia/testing</code>’s <code>createTestingPinia()</code> stubs actions.' },
      { hot: ['e'], cap: 'Playwright drives Chromium, Firefox and WebKit against the built app. Few tests, covering critical journeys (login, checkout). Mock the network with <code>page.route()</code> when needed.', lang: 'ts', code: "test('login', async ({ page }) => {\n  await page.goto('/login')\n  await page.getByLabel('Email').fill('a@b.c')\n  await page.getByRole('button', { name: 'Sign in' }).click()\n  await expect(page).toHaveURL(/dashboard/)\n})" }
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

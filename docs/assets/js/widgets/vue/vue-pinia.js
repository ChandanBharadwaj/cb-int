/* Pinia: one store instance shared by many components, and how storeToRefs keeps destructuring reactive. */
IA.widget('vue-pinia', (root, ctx) => {
  const SLUG = 'vue-pinia';
  const SCENES = {
  'Shared store': {
    w: 760, h: 300, label: 'Two components using the same Pinia store instance',
    nodes: [
      { id: 'pinia', x: 280, y: 14, w: 200, h: 50, t: 'pinia (app.use)', s: 'registry of stores' },
      { id: 'store', x: 260, y: 110, w: 240, h: 90, t: "useCartStore('cart')", s: 'state: items[] · getter: total' },
      { id: 'hdr', x: 20, y: 120, w: 190, h: 70, t: 'Header.vue', s: 'badge: {{ cart.count }}' },
      { id: 'page', x: 550, y: 120, w: 190, h: 70, t: 'ProductPage.vue', s: 'cart.add(p)' },
      { id: 'dt', x: 260, y: 240, w: 240, h: 46, t: 'Vue DevTools timeline', s: 'action: add' }
    ],
    edges: [{ id: 'a', f: 'pinia', t: 'store', l: 'creates once' }, { id: 'b', f: 'page', t: 'store', l: 'action' }, { id: 'c', f: 'store', t: 'hdr', l: 'reactive read' }, { id: 'd', f: 'store', t: 'dt' }],
    frames: [
      { hot: ['pinia'], cap: '<code>app.use(createPinia())</code> installs an empty registry. Stores are created <b>lazily</b>, the first time some component calls <code>useCartStore()</code>.', code: "export const useCartStore = defineStore('cart', () => {\n  const items = ref<Item[]>([])                         // state\n  const total = computed(() => items.value.reduce((s, i) => s + i.price, 0)) // getter\n  function add(i: Item) { items.value.push(i) }        // action\n  return { items, total, add }\n})" },
      { hot: ['store'], on: ['a'], cap: 'First call: Pinia runs the setup function once and caches the result under the id <code>\'cart\'</code>. It is a singleton <b>per Pinia instance</b> (per request on the server), much like a Spring singleton bean per context.' },
      { hot: ['page'], on: ['b'], cap: 'ProductPage calls <code>cart.add(p)</code>. Actions are plain functions; they can be async and call other stores.' },
      { ok: ['hdr'], on: ['c'], cap: 'Header read <code>cart.count</code> in its template, so it was tracked. The push triggers only the components that read that state.' },
      { hot: ['dt'], on: ['d'], cap: 'Every action and state change shows in DevTools, which is a reason to prefer actions over mutating store state from anywhere.' }
    ]
  },
  'storeToRefs': {
    w: 760, h: 260, label: 'Destructuring a store with and without storeToRefs',
    nodes: [
      { id: 'st', x: 20, y: 90, w: 200, h: 80, t: 'cart (reactive)', s: '{ items, total, add }' },
      { id: 'bad', x: 300, y: 20, w: 200, h: 80, t: 'const { total } = cart', s: 'plain number 0', fs: 12 },
      { id: 'good', x: 300, y: 160, w: 200, h: 80, t: 'storeToRefs(cart)', s: 'total: Ref<number>' },
      { id: 'ui1', x: 560, y: 20, w: 180, h: 80, t: 'template', s: 'stuck at 0' },
      { id: 'ui2', x: 560, y: 160, w: 180, h: 80, t: 'template', s: 'updates' }
    ],
    edges: [{ id: 'a', f: 'st', t: 'bad' }, { id: 'b', f: 'st', t: 'good' }, { id: 'c', f: 'bad', t: 'ui1' }, { id: 'd', f: 'good', t: 'ui2' }],
    frames: [
      { hot: ['st'], cap: 'A store is a <code>reactive()</code> object. Refs inside it are unwrapped, so you write <code>cart.total</code>, not <code>cart.total.value</code>.' },
      { bad: ['bad', 'ui1'], badEdge: ['a', 'c'], cap: 'Destructuring copies the <b>current value</b> out of the proxy. <code>total</code> is now just <code>0</code>; the template never sees changes.' },
      { ok: ['good', 'ui2'], on: ['b', 'd'], cap: '<code>storeToRefs(cart)</code> returns refs that stay linked to the store’s state and getters. It skips actions, so take those from the store directly.', code: "const cart = useCartStore()\nconst { items, total } = storeToRefs(cart)  // refs\nconst { add } = cart                       // actions are fine to destructure" }
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

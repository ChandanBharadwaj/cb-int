/* SSR & Nuxt: request → server render → HTML + payload → hydration, and the hydration-mismatch trap. */
IA.widget('vue-ssr-nuxt', (root, ctx) => {
  const SLUG = 'vue-ssr-nuxt';
  const SCENES = {
  'SSR + hydration': {
    w: 760, h: 300, label: 'Server renders HTML and a state payload; the browser hydrates instead of re-rendering',
    nodes: [
      { id: 'req', x: 20, y: 20, w: 150, h: 60, t: 'GET /products/7' },
      { id: 'srv', x: 210, y: 20, w: 200, h: 60, t: 'Nitro server', s: 'new app per request' },
      { id: 'fetch', x: 450, y: 20, w: 140, h: 60, t: 'useFetch', s: 'awaited on server' },
      { id: 'api', x: 620, y: 20, w: 120, h: 60, t: 'API / DB' },
      { id: 'html', x: 210, y: 130, w: 200, h: 70, t: 'HTML + payload', s: 'window.__NUXT__' },
      { id: 'paint', x: 20, y: 130, w: 150, h: 70, t: 'first paint', s: 'content visible' },
      { id: 'js', x: 450, y: 130, w: 140, h: 70, t: 'JS bundle', s: 'downloads' },
      { id: 'hyd', x: 210, y: 230, w: 380, h: 56, t: 'hydrate: attach listeners to existing DOM', s: 'useFetch reads payload, no refetch' }
    ],
    edges: [{ id: 'a', f: 'req', t: 'srv' }, { id: 'b', f: 'srv', t: 'fetch' }, { id: 'c', f: 'fetch', t: 'api' }, { id: 'd', f: 'srv', t: 'html' }, { id: 'e', f: 'html', t: 'paint' }, { id: 'f', f: 'html', t: 'js' }, { id: 'g', f: 'js', t: 'hyd' }],
    frames: [
      { hot: ['req'], cap: 'SPA: the server sends an empty <code>&lt;div id="app"&gt;</code> and JS builds everything. SSR: the server runs your Vue components and sends real HTML.' },
      { hot: ['srv'], on: ['a'], cap: 'Nuxt’s server (Nitro) creates a <b>fresh app, router and Pinia per request</b>. Module-level state would leak between users, like a mutable static field in a servlet.' },
      { hot: ['fetch', 'api'], on: ['b', 'c'], cap: '<code>await useFetch(\'/api/products/7\')</code> runs on the server during render. Vue waits for async setup before producing HTML.', code: "<script setup lang=\"ts\">\nconst route = useRoute()\nconst { data: product, error } = await useFetch(`/api/products/${route.params.id}`)\n</script>" },
      { hot: ['html'], on: ['d'], cap: 'The response contains the HTML <b>and</b> a serialized payload of fetched data and state.' },
      { ok: ['paint'], on: ['e'], cap: 'The browser paints content before any JS runs: good for first paint, SEO and link previews. Buttons do not work yet.' },
      { hot: ['js', 'hyd'], on: ['f', 'g'], cap: '<b>Hydration</b>: the client app renders virtually, walks the existing DOM, and attaches listeners instead of recreating nodes. <code>useFetch</code> finds its result in the payload, so no second request.' }
    ]
  },
  'Mismatch': {
    w: 760, h: 230, label: 'Hydration mismatch: server and client render different output',
    nodes: [
      { id: 's', x: 20, y: 40, w: 220, h: 70, t: 'server render', s: '12:00:01 (UTC)' },
      { id: 'c', x: 270, y: 40, w: 220, h: 70, t: 'client render', s: '13:00:03 (CET)' },
      { id: 'w', x: 520, y: 40, w: 220, h: 70, t: 'Hydration mismatch', s: 'console warning' },
      { id: 'f', x: 145, y: 150, w: 470, h: 60, t: 'fix: same input on both sides', s: '<ClientOnly>, onMounted, useState, payload' }
    ],
    edges: [{ id: 'a', f: 's', t: 'c' }, { id: 'b', f: 'c', t: 'w' }],
    frames: [
      { hot: ['s'], cap: 'A component renders <code>new Date().toLocaleTimeString()</code>, <code>Math.random()</code>, or reads <code>window</code>/<code>localStorage</code>.' },
      { hot: ['c'], on: ['a'], cap: 'The client renders again during hydration, at a different time, in a different timezone.' },
      { bad: ['w'], badEdge: ['b'], cap: 'Text differs, so Vue warns about a <b>hydration mismatch</b> and patches the node, which can mean flicker, lost listeners, or wrong content in production. Vue 3.4+ prints the details; 3.5 lets you silence a known one with <code>data-allow-mismatch</code>.' },
      { ok: ['f'], cap: 'Make both renders deterministic: browser-only values in <code>onMounted</code> (it runs only on the client) or <code>&lt;ClientOnly&gt;</code>; per-request shared state with <code>useState</code>; and data that travels in the payload.' }
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

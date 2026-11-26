/* Reactivity internals: Proxy get → track, set → trigger, scheduler batching, and why destructuring breaks the link. */
IA.widget('vue-reactivity-internals', (root, ctx) => {
  const SLUG = 'vue-reactivity-internals';
  const SCENES = {
  'track & trigger': {
    w: 760, h: 300, label: 'An effect reads a proxy property (track), a write triggers the effect through the scheduler',
    nodes: [
      { id: 'eff', x: 20, y: 30, w: 200, h: 70, t: 'render effect', s: 'activeSub = this' },
      { id: 'proxy', x: 280, y: 30, w: 200, h: 70, t: 'Proxy(state)', s: 'get / set traps' },
      { id: 'dep', x: 540, y: 30, w: 200, h: 70, t: 'Dep for state.count', s: 'subscribers: { }' },
      { id: 'write', x: 280, y: 160, w: 200, h: 60, t: 'state.count++', s: 'set trap' },
      { id: 'sched', x: 20, y: 160, w: 200, h: 60, t: 'scheduler queue', s: 'flush before paint' },
      { id: 'dom', x: 20, y: 240, w: 200, h: 50, t: 'patch DOM once' }
    ],
    edges: [{ id: 'a', f: 'eff', t: 'proxy', l: 'get count' }, { id: 'b', f: 'proxy', t: 'dep', l: 'track()' }, { id: 'c', f: 'write', t: 'dep', l: 'trigger()' }, { id: 'd', f: 'dep', t: 'sched', l: 'queueJob' }, { id: 'e', f: 'sched', t: 'dom' }],
    frames: [
      { hot: ['eff'], cap: 'Rendering runs inside a <b>reactive effect</b>. Vue sets it as the active subscriber before calling your render function.', code: "const state = reactive({ count: 0 })\n// the template reads {{ state.count }}" },
      { hot: ['proxy'], on: ['a'], cap: 'The template reads <code>state.count</code>. <code>reactive()</code> returned a <b>Proxy</b>, so the read goes through its <code>get</code> trap.' },
      { hot: ['dep'], on: ['b'], set: {}, sub: { dep: 'subscribers: { render }' }, cap: '<code>track()</code> records “the render effect depends on (state, \'count\')”. Internally: a WeakMap target → Map key → Dep (a linked list of subscribers since 3.5).' },
      { hot: ['write'], sub: { dep: 'subscribers: { render }' }, cap: 'Later a click handler runs <code>state.count++</code>. The <code>set</code> trap compares old and new values (<code>Object.is</code>); only a real change continues.' },
      { hot: ['dep', 'sched'], on: ['c', 'd'], sub: { dep: 'subscribers: { render }', sched: 'queue: [render]' }, cap: '<code>trigger()</code> does not re-render immediately. Component updates are <b>queued</b> and de-duplicated, then flushed in a microtask.' },
      { ok: ['dom'], on: ['e'], sub: { dep: 'subscribers: { render }', sched: 'queue: [render]' }, cap: 'Three writes in the same tick cause one render. That is why the DOM is stale right after a write and you need <code>await nextTick()</code> to read it.' }
    ]
  },
  'Destructuring': {
    w: 760, h: 240, label: 'Destructuring a reactive object copies values out of the proxy',
    nodes: [
      { id: 'p', x: 20, y: 80, w: 200, h: 80, t: 'Proxy', s: '{ count: 0 }' },
      { id: 'c', x: 290, y: 20, w: 190, h: 70, t: 'let { count } = state', s: 'count = 0 (number)', fs: 12 },
      { id: 't', x: 290, y: 150, w: 190, h: 70, t: 'toRefs(state).count', s: 'ObjectRefImpl', fs: 12 },
      { id: 'u1', x: 550, y: 20, w: 190, h: 70, t: 'no get trap later', s: 'not tracked' },
      { id: 'u2', x: 550, y: 150, w: 190, h: 70, t: '.value → state.count', s: 'tracked' }
    ],
    edges: [{ id: 'a', f: 'p', t: 'c', l: 'get once' }, { id: 'b', f: 'p', t: 't' }, { id: 'x', f: 'c', t: 'u1' }, { id: 'y', f: 't', t: 'u2' }],
    frames: [
      { hot: ['p'], cap: 'Tracking only happens <b>during a property read on the proxy</b>, while an effect is running.' },
      { bad: ['c', 'u1'], on: ['a'], badEdge: ['x'], cap: 'Destructuring reads <code>state.count</code> once, in setup, and stores the primitive in a local variable. Later reads of <code>count</code> touch no proxy, so nothing is tracked and writes to it change nothing.' },
      { ok: ['t', 'u2'], on: ['b', 'y'], cap: '<code>toRefs()</code> (or <code>toRef(state, \'count\')</code>) gives you a ref whose <code>.value</code> getter reads <code>state.count</code> each time, so the link survives. Vue 3.5 also keeps destructured <code>defineProps</code> reactive by compiling <code>count</code> to <code>props.count</code>.' }
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

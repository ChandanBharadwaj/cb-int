/* Forms: what v-model expands to, how modifiers change it, and the async-submit state machine. */
IA.widget('vue-forms', (root, ctx) => {
  const SLUG = 'vue-forms';
  const SCENES = {
  'v-model': {
    w: 760, h: 250, label: 'v-model on an input expands to a value binding plus an event listener',
    nodes: [
      { id: 'ref', x: 20, y: 90, w: 170, h: 70, t: "age = ref('')", s: 'state' },
      { id: 'in', x: 300, y: 90, w: 170, h: 70, t: '<input>', s: 'DOM' },
      { id: 'mod', x: 560, y: 20, w: 180, h: 70, t: '.number / .trim', s: 'transform' },
      { id: 'lazy', x: 560, y: 160, w: 180, h: 70, t: '.lazy', s: "'input' → 'change'" }
    ],
    edges: [{ id: 'a', f: 'ref', t: 'in', l: ':value' }, { id: 'b', f: 'in', t: 'ref', l: '@input', dash: '4 3' }, { id: 'c', f: 'in', t: 'mod' }, { id: 'd', f: 'in', t: 'lazy' }],
    frames: [
      { hot: ['ref', 'in'], cap: '<code>v-model="age"</code> is sugar for two things: bind the value down, listen for input up.', code: '<input v-model="age" />\n<!-- roughly -->\n<input :value="age" @input="age = $event.target.value" />' },
      { hot: ['in'], on: ['b'], cap: 'The user types <code>42</code>. DOM inputs always produce <b>strings</b>, so <code>age.value === "42"</code>.' },
      { hot: ['mod'], on: ['c'], cap: '<code>v-model.number</code> runs <code>parseFloat</code>; if it fails you keep the original string. <code>.trim</code> strips whitespace. On <code>type="number"</code> inputs Vue applies the number cast automatically.' },
      { hot: ['lazy'], on: ['d'], cap: '<code>.lazy</code> syncs on <code>change</code> (blur or Enter) instead of every keystroke. Useful when every update triggers expensive validation.' },
      { ok: ['ref'], on: ['a', 'b'], cap: 'Checkbox, radio and select use <code>checked</code>/<code>change</code> instead. A checkbox bound to an array toggles membership of its <code>value</code>.' }
    ]
  },
  'Async submit': {
    w: 760, h: 260, label: 'Submit state machine: idle, validating, submitting, success or server errors',
    nodes: [
      { id: 'idle', x: 20, y: 100, w: 130, h: 60, t: 'idle' },
      { id: 'val', x: 190, y: 100, w: 140, h: 60, t: 'validate', s: 'client rules' },
      { id: 'sub', x: 370, y: 100, w: 150, h: 60, t: 'submitting', s: 'button disabled' },
      { id: 'ok', x: 580, y: 30, w: 160, h: 60, t: 'success', s: 'reset / navigate' },
      { id: 'err', x: 580, y: 170, w: 160, h: 60, t: '422 errors', s: 'map to fields' },
      { id: 'fe', x: 190, y: 200, w: 140, h: 50, t: 'field errors', hidden: true }
    ],
    edges: [{ id: 'a', f: 'idle', t: 'val', l: 'submit' }, { id: 'b', f: 'val', t: 'sub', l: 'valid' }, { id: 'c', f: 'sub', t: 'ok' }, { id: 'd', f: 'sub', t: 'err' }, { id: 'e', f: 'val', t: 'fe', hidden: true }, { id: 'f', f: 'err', t: 'idle', dash: '4 3' }],
    frames: [
      { hot: ['idle'], cap: '<code>&lt;form @submit.prevent="onSubmit"&gt;</code>: <code>.prevent</code> stops the browser’s full-page POST.' },
      { hot: ['val'], on: ['a'], cap: 'Run client-side rules first (or a schema library such as Zod or Yup through VeeValidate). They are for UX only. The server must validate again, like Bean Validation on the controller.' },
      { bad: ['fe'], show: ['fe'], badEdge: ['e'], cap: 'Invalid: show field errors and stop. No request.' },
      { hot: ['sub'], on: ['b'], cap: 'Valid: set <code>submitting = true</code> and disable the button, so a double click does not send two POSTs.' , code: "async function onSubmit() {\n  if (submitting.value || !validate()) return\n  submitting.value = true\n  try { await api.createUser(form) ; router.push('/users') }\n  catch (e) { if (isApiError(e) && e.status === 422) errors.value = e.fieldErrors }\n  finally { submitting.value = false }\n}" },
      { ok: ['ok'], on: ['c'], cap: 'Success: navigate away or reset the form.' },
      { bad: ['err'], badEdge: ['d'], on: ['f'], cap: 'Server rejects with 422 (e.g. email taken): map its field errors onto the same error display, and <code>finally</code> re-enables the button.' }
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

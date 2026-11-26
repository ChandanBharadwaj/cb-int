/* Types vs runtime: what survives compilation, how a schema checks at the boundary, brands, and contract drift. */
IA.widget('ts-runtime-validation', (root, ctx) => {
  const P = (id, x, y, w, h, t, s, k, cap, hot) => ({ id, x, y, w, h, t, s, k, cap, hot });
  const LANES = (extra) => [P('ct', 20, 10, 340, 28, 'compile time', '', 'mut'), P('rt', 400, 10, 340, 28, 'runtime', '', 'mut'), ...extra];
  const SCENES = [
    { label: 'Erasure', tag: 'tsc / type stripping', code: `interface User { id: number; name: string }\ntype Id = User['id'];\nfunction show<T extends User>(u: T): string { return u.name; }\nconst u = JSON.parse(raw) as User;\n// emitted: function show(u) { return u.name; }  const u = JSON.parse(raw);`,
      steps: [
        { hl: [1, 2], say: 'Interfaces and type aliases live only on the compile-time side.', nodes: LANES([P('i', 20, 70, 160, 50, 'interface User', '', 'acc'), P('t', 200, 70, 160, 50, "type Id", '', 'acc'), P('x', 400, 70, 340, 50, '(nothing)', 'erased', 'mut', null, true)]), edges: [['i', 'x', '', 'err'], ['t', 'x', '', 'err']] },
        { hl: [3], say: 'A generic function keeps its body. The type parameter, its constraint and the annotations are gone.', nodes: LANES([P('g', 20, 90, 340, 56, 'show<T extends User>(u: T)', 'signature', 'acc'), P('r', 400, 90, 340, 56, 'function show(u)', 'only the body is left', 'ok', null, true)]), edges: [['g', 'r', 'strip']] },
        { hl: [4, 5], say: 'The assertion disappears too. What is left is <code>JSON.parse(raw)</code>: untyped data, unchecked.', nodes: LANES([P('a', 20, 90, 340, 56, 'JSON.parse(raw) as User', 'claim', 'warn'), P('r', 400, 90, 340, 56, 'JSON.parse(raw)', 'no check at all', 'err', null, true)]), edges: [['a', 'r', 'strip', 'err']] }
      ] },
    { label: 'Schema at the edge', tag: 'Zod', code: `const User = z.object({ id: z.number().int(), name: z.string().min(1) });\ntype User = z.infer<typeof User>;\nconst r = User.safeParse(await req.json());\nif (!r.success) return res.status(400).json(r.error.issues);\nsave(r.data);   // r.data: User, checked`,
      steps: [
        { hl: [1], say: 'A schema is a <b>value</b>: an object built by function calls. It exists on both sides.', nodes: LANES([P('s1', 20, 90, 340, 56, 'const User = z.object(…)', 'value', 'ok'), P('s2', 400, 90, 340, 56, 'User schema object', 'still here', 'ok', null, true)]), edges: [['s1', 's2', 'kept', 'ok']] },
        { hl: [2], say: '<code>z.infer</code> derives the static type from the schema. One definition, two uses.', nodes: LANES([P('s1', 20, 70, 340, 50, 'User schema', '', 'ok'), P('t', 20, 170, 340, 50, '{ id: number; name: string }', 'z.infer', 'acc', null, true)]), edges: [['s1', 't', 'infer']] },
        { hl: [3, 4], say: 'At runtime, <code>safeParse</code> checks the incoming <code>unknown</code>. Bad input becomes a 400, not a crash deep inside.', nodes: LANES([P('in', 400, 60, 160, 50, 'req body', 'unknown', 'mut'), P('p', 580, 60, 160, 50, 'safeParse', 'check', 'acc'), P('bad', 400, 170, 160, 50, '400', 'issues[]', 'err'), P('ok', 580, 170, 160, 50, 'r.data', 'User', 'ok')]), edges: [['in', 'p', ''], ['p', 'bad', 'fail', 'err'], ['p', 'ok', 'pass', 'ok']] },
        { hl: [5], say: 'Past the boundary, the type is a <b>fact</b>: the data was checked against the same definition the type came from. Unknown keys were stripped.', nodes: LANES([P('t', 20, 90, 340, 56, 'r.data: User', 'trusted inside', 'ok'), P('d', 400, 90, 340, 56, '{ id: 1, name: "Ada" }', 'extra keys removed', 'ok', null, true)]) }
      ] },
    { label: 'Brands', tag: 'zero runtime cost', code: `type Email = string & { readonly __brand: 'Email' };\nfunction parseEmail(s: string): Email {\n  if (!/^[^@\\s]+@[^@\\s]+$/.test(s)) throw new Error('bad email');\n  return s as Email;\n}\nsendWelcome(parseEmail(input));   // sendWelcome(to: Email)\nsendWelcome(input);               // ✗ string is not Email`,
      steps: [
        { hl: [1], say: 'The brand is a fake property no real string has. Only code that casts can produce an <code>Email</code>.', nodes: LANES([P('b', 20, 90, 340, 56, 'string & { __brand }', 'Email', 'acc'), P('r', 400, 90, 340, 56, 'string', 'at runtime', 'mut')]), edges: [['b', 'r', 'erased']] },
        { hl: [2, 3, 4], say: 'One function does the check and the cast together. That makes the brand mean “validated”.', nodes: LANES([P('s', 20, 60, 160, 50, 'string', 'input', 'mut'), P('p', 200, 60, 160, 50, 'parseEmail', 'check + cast', 'ok'), P('e', 20, 170, 340, 50, 'Email', 'proven', 'ok', null, true), P('r', 400, 110, 340, 56, 'regex test → same string', '', 'ok')]), edges: [['s', 'p', ''], ['p', 'e', '', 'ok']] },
        { hl: [6, 7], say: 'APIs that take <code>Email</code> can’t be handed an unchecked string. At runtime it is still the same plain string.', nodes: LANES([P('a', 20, 60, 340, 50, 'sendWelcome(parseEmail(x))', 'OK', 'ok'), P('b', 20, 170, 340, 50, 'sendWelcome(x)', '✗ string ≠ Email', 'err', null, true), P('r', 400, 110, 340, 56, 'sendWelcome("a@b.c")', 'no wrapper, no cost', 'ok')]) }
      ] },
    { label: 'Contract drift', tag: 'Spring ↔ TS', code: `// Java: record OrderDto(String id, BigDecimal total) {}  → JSON "total": "19.90"\n// hand-written TS: type OrderDto = { id: string; total: number }\n// generated:  npx openapi-typescript /v3/api-docs -o schema.d.ts\ntype OrderDto = components['schemas']['OrderDto'];   // total: string`,
      steps: [
        { hl: [1, 2], say: 'Two hand-written descriptions of one contract. Nothing compares them.', nodes: [P('j', 20, 90, 260, 56, 'Java OrderDto', 'total: "19.90"', 'acc', 'backend'), P('t', 480, 90, 260, 56, 'TS OrderDto', 'total: number', 'warn', 'frontend')], edges: [['j', 't', 'copied by hand', 'err']] },
        { hl: [2], say: 'Runtime: the browser receives a string. <code>total * qty</code> works by coercion; <code>total + tax</code> concatenates. Bugs, not errors.', nodes: [P('w', 20, 90, 260, 56, '"total": "19.90"', 'wire', 'mut'), P('x', 480, 90, 260, 56, '"19.90" + 2', '"19.902"', 'err', null, true)], edges: [['w', 'x', '', 'err']] },
        { hl: [3, 4], say: 'Make the OpenAPI document the single source. Generate TS types in CI; drift becomes a compile error.', nodes: [P('j', 20, 30, 200, 50, 'Spring + springdoc', '', 'acc'), P('o', 280, 30, 200, 50, '/v3/api-docs', 'OpenAPI', 'ok'), P('g', 540, 30, 200, 50, 'openapi-typescript', 'CI', 'ok'), P('t', 540, 160, 200, 50, 'schema.d.ts', 'total: string', 'ok', null, true)], edges: [['j', 'o', ''], ['o', 'g', ''], ['g', 't', '', 'ok']] }
      ] }
  ];
  /* ---- shared step-through engine: code on top (current lines highlighted), a type-flow diagram below ---- */
  const { el, svg, reduced, sleep } = ctx;
  if (!document.getElementById('w-tsx-style')) {
    document.head.append(el('style', { id: 'w-tsx-style', text: `
.w-tsx-code { font-family: var(--mono); font-size: 12.5px; line-height: 1.55; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 0; margin: 0 0 10px; overflow-x: auto; white-space: pre; }
.w-tsx-code div { padding: 0 12px; border-left: 3px solid transparent; color: var(--text-2); transition: background .25s; }
.w-tsx-code div.on { background: var(--accent-soft); border-left-color: var(--accent); color: var(--text); }
.w-tsx-node rect { transition: opacity .35s; }
.w-tsx-svg text { font-family: var(--mono); }
` }));
  }
  const TONE = { acc: 'var(--accent)', ok: 'var(--ok)', err: 'var(--err)', warn: 'var(--warn)', mut: 'var(--text-3)', alt: 'var(--accent-2)' };
  let scene = 0; let step = 0; let gen = 0; let speed = 2600;
  const uid = 'tsx' + Math.random().toString(36).slice(2, 8);
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segScene = seg(SCENES.map((s, i) => [i, s.label]), () => scene, (v) => { scene = v; reset(); }, 'Scenario');
  const segSpeed = seg([[3800, 'Slow'], [2600, 'Normal'], [1200, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const code = el('div', { class: 'w-tsx-code', role: 'region', 'aria-label': 'Code' });
  const H = 250;
  const stage = svg('svg', { viewBox: `0 0 760 ${H}`, class: 'w-tsx-svg', role: 'img', 'aria-label': 'Diagram of how the type checker sees this code', style: 'width:100%;height:auto;display:block' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const counter = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segScene), code, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segSpeed), counter, narr);
  function drawCode() {
    const S = SCENES[scene]; const st = S.steps[step - 1]; const hl = st ? st.hl || [] : [];
    code.innerHTML = '';
    S.code.split('\n').forEach((ln, i) => code.append(el('div', { class: hl.includes(i + 1) ? 'on' : '', text: ln || ' ' })));
  }
  function wrapText(t, max) { const out = []; let cur = '';
    String(t).split(' ').forEach((w) => { if ((cur + ' ' + w).trim().length > max) { if (cur) out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }); if (cur) out.push(cur); return out; }
  function drawStage() {
    stage.innerHTML = '';
    const defs = svg('defs', null, svg('marker', { id: uid + 'a', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--text-3)' })));
    stage.append(defs);
    const S = SCENES[scene]; const st = S.steps[Math.max(0, step - 1)];
    if (!step) { stage.append(svg('text', { x: 380, y: H / 2, 'text-anchor': 'middle', fill: 'var(--text-3)', 'font-size': 15, text: 'Press Play or Step to start.' })); return; }
    const nodes = {}; (st.nodes || []).forEach((n) => { nodes[n.id] = n; });
    (st.edges || []).forEach(([a, b, lab, tone]) => {
      const A = nodes[a]; const B = nodes[b]; if (!A || !B) return;
      const ax = A.x + A.w / 2; const ay = A.y + A.h / 2; const bx = B.x + B.w / 2; const by = B.y + B.h / 2;
      const dx = bx - ax; const dy = by - ay;
      const cut = (N, sx, sy) => { const tx = Math.abs(sx) > 0 ? (N.w / 2) / Math.abs(sx) : 1e9; const ty = Math.abs(sy) > 0 ? (N.h / 2) / Math.abs(sy) : 1e9; return Math.min(tx, ty); };
      const t1 = cut(A, dx, dy); const t2 = cut(B, dx, dy);
      const x1 = ax + dx * t1; const y1 = ay + dy * t1; const x2 = bx - dx * (t2 + 0.02); const y2 = by - dy * (t2 + 0.02);
      stage.append(svg('line', { x1, y1, x2, y2, stroke: TONE[tone] || 'var(--text-3)', 'stroke-width': 1.6, 'marker-end': `url(#${uid}a)`, 'stroke-dasharray': tone === 'err' ? '5 4' : null }));
      if (lab) stage.append(svg('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 6, 'text-anchor': 'middle', 'font-size': 11.5, fill: TONE[tone] || 'var(--text-2)', text: lab }));
    });
    (st.nodes || []).forEach((n) => {
      const c = TONE[n.k] || TONE.acc; const g = svg('g', { class: 'w-tsx-node' });
      g.append(svg('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 9, fill: 'var(--surface)', stroke: c, 'stroke-width': n.hot ? 2.6 : 1.4 }));
      if (n.cap) g.append(svg('text', { x: n.x + 8, y: n.y - 5, 'font-size': 11, fill: 'var(--text-3)', text: n.cap }));
      const lines = String(n.t).split('\n'); const sub = n.s ? wrapText(n.s, Math.max(10, Math.floor(n.w / 6.6))) : [];
      const total = lines.length + sub.length; let y = n.y + n.h / 2 - (total - 1) * 8 + 4;
      lines.forEach((ln) => { g.append(svg('text', { x: n.x + n.w / 2, y, 'text-anchor': 'middle', 'font-size': 13, fill: c, 'font-weight': 600, text: ln })); y += 16; });
      sub.forEach((ln) => { g.append(svg('text', { x: n.x + n.w / 2, y, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-2)', text: ln })); y += 16; });
      if (!reduced) { g.style.opacity = 0; g.style.transition = 'opacity .35s'; requestAnimationFrame(() => { g.style.opacity = 1; }); }
      stage.append(g);
    });
  }
  function paint() {
    const S = SCENES[scene]; drawCode(); drawStage();
    counter.innerHTML = ''; counter.append(el('span', { class: 'w-stat', html: `step <b>${step}</b>/${S.steps.length}` }), el('span', { class: 'w-stat', html: S.tag || 'type-level only: nothing here runs' }));
    narr.innerHTML = ''; narr.append(el('div', { class: 't', html: step ? S.steps[step - 1].say : S.intro || 'Press Play to walk through it, or Step for one move at a time.' }));
    bStep.disabled = step >= S.steps.length;
  }
  function doStep() { const S = SCENES[scene]; if (step < S.steps.length) { step++; paint(); } }
  function reset() { gen++; step = 0; bPlay.textContent = '▶ Play'; paint(); }
  async function play() {
    const g = ++gen; const S = SCENES[scene]; if (step >= S.steps.length) step = 0;
    if (reduced) { step = S.steps.length; paint(); return; }
    bPlay.textContent = '⏸ Playing';
    while (g === gen && step < S.steps.length) { doStep(); await sleep(speed); }
    if (g === gen) bPlay.textContent = '▶ Replay';
  }
  bPlay.addEventListener('click', play); bStep.addEventListener('click', () => { gen++; bPlay.textContent = '▶ Play'; doStep(); }); bReset.addEventListener('click', reset);
  if (reduced) { step = SCENES[0].steps.length; paint(); } else reset();
});

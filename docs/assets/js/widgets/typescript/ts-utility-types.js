/* Utility types: watch Partial, Pick/Omit, satisfies and Awaited<ReturnType> transform a type property by property. */
IA.widget('ts-utility-types', (root, ctx) => {
  const P = (id, x, y, w, h, t, s, k, cap, hot) => ({ id, x, y, w, h, t, s, k, cap, hot });
  const row = (y, items, cap) => items.map(([id, t, s, k, hot], i) => P(id, 20 + i * 185, y, 170, 50, t, s, k, i === 0 ? cap : null, hot));
  const SCENES = [
    { label: 'Partial', code: `interface User { id: string; email: string; age: number }\ntype Patch = Partial<User>;\n// = { [P in keyof User]?: User[P] }\nconst p: Patch = { age: undefined };   // allowed!`,
      steps: [
        { hl: [1], say: 'The source type: three required properties.', nodes: row(40, [['a', 'id', 'string', 'acc'], ['b', 'email', 'string', 'acc'], ['c', 'age', 'number', 'acc']], 'User') },
        { hl: [2, 3], say: '<code>Partial</code> is a mapped type: for each key <code>P in keyof User</code> it copies <code>User[P]</code> and adds <code>?</code>.', nodes: [...row(40, [['a', 'id', 'string', 'mut'], ['b', 'email', 'string', 'mut'], ['c', 'age', 'number', 'mut']], 'User'), ...row(160, [['a2', 'id?', 'string | undefined', 'ok'], ['b2', 'email?', 'string | undefined', 'ok'], ['c2', 'age?', 'number | undefined', 'ok']], 'Partial<User>')], edges: [['a', 'a2', '?'], ['b', 'b2', '?'], ['c', 'c2', '?']] },
        { hl: [4], say: 'Without <code>exactOptionalPropertyTypes</code>, “optional” also means “may be <code>undefined</code>”. Spreading this patch over real data overwrites <code>age</code> with undefined.', nodes: [...row(40, [['a2', 'id?', '(missing)', 'mut'], ['b2', 'email?', '(missing)', 'mut'], ['c2', 'age: undefined', 'present, undefined', 'warn', true]], 'p'), P('m', 200, 170, 360, 56, '{ ...user, ...p }', 'age becomes undefined at runtime', 'err', 'merge')], edges: [['c2', 'm', 'overwrites', 'err']] }
      ] },
    { label: 'Pick / Omit', code: `type Row = Pick<User, 'id' | 'email'>;       // K extends keyof User\ntype NoAge = Omit<User, 'age'>;             // K extends keyof any\ntype Oops = Omit<User, 'agee'>;             // no error, nothing removed`,
      steps: [
        { hl: [1], say: '<code>Pick</code> keeps the listed keys, and its constraint <code>K extends keyof T</code> rejects any key that does not exist.', nodes: [...row(40, [['a', 'id', 'string', 'ok'], ['b', 'email', 'string', 'ok'], ['c', 'age', 'number', 'mut']], 'User'), ...row(160, [['a2', 'id', 'kept', 'ok'], ['b2', 'email', 'kept', 'ok']], 'Pick<User, "id" | "email">')], edges: [['a', 'a2', ''], ['b', 'b2', '']] },
        { hl: [2], say: '<code>Omit</code> is <code>Pick&lt;T, Exclude&lt;keyof T, K&gt;&gt;</code>: compute the keys to keep, then pick them.', nodes: [...row(40, [['a', 'id', 'string', 'ok'], ['b', 'email', 'string', 'ok'], ['c', 'age', 'removed', 'err']], 'User'), ...row(160, [['a2', 'id', 'kept', 'ok'], ['b2', 'email', 'kept', 'ok']], 'Omit<User, "age">')], edges: [['a', 'a2', ''], ['b', 'b2', '']] },
        { hl: [3], say: 'The typo <code>\'agee\'</code> is fine for <code>K extends keyof any</code>. <code>Exclude</code> removes nothing, and <code>age</code> survives. For data leaving your service, use an allow-list.', nodes: [...row(40, [['a', 'id', 'string', 'ok'], ['b', 'email', 'string', 'ok'], ['c', 'age', 'still here', 'warn', true]], 'Omit<User, "agee">'), P('k', 20, 170, 300, 50, '"agee"', 'not a key of User: no error', 'err')], edges: [['k', 'c', 'removes nothing', 'err']] }
      ] },
    { label: 'satisfies', code: `const a: Record<string, string> = { home: '/', user: '/u/:id' };\nconst b = { home: '/', user: '/u/:id' } satisfies Record<string, string>;\na.hmoe;   // OK (any key is allowed)\nb.hmoe;   // ✗ Property 'hmoe' does not exist   (TS 4.9+)`,
      steps: [
        { hl: [1], say: 'An annotation <b>replaces</b> the inferred type. <code>a</code> is now just “some string keys”.', nodes: [P('v', 20, 90, 220, 56, "{ home, user }", 'object literal', 'acc'), P('t', 320, 90, 220, 56, 'Record<string, string>', 'type of a', 'mut', null, true)], edges: [['v', 't', 'annotation: replace']] },
        { hl: [2], say: '<code>satisfies</code> <b>checks</b> the value against the type, then keeps the inferred type <code>{ home: string; user: string }</code>.', nodes: [P('v', 20, 40, 220, 56, "{ home, user }", 'object literal', 'acc'), P('c', 320, 40, 220, 56, 'Record<string, string>', 'check only', 'ok'), P('t', 320, 160, 260, 56, '{ home: string;\nuser: string }', 'type of b', 'ok', null, true)], edges: [['v', 'c', 'fits?', 'ok'], ['v', 't', 'keeps inferred', 'ok']] },
        { hl: [3, 4], say: 'So typos are caught on <code>b</code> but not on <code>a</code>. Use <code>as const satisfies …</code> when you also want literal values like <code>"/"</code>.', nodes: [P('a', 20, 40, 200, 56, 'a.hmoe', 'string (no error)', 'warn'), P('b', 20, 160, 200, 56, 'b.hmoe', '✗ compile error', 'err', null, true)] }
      ] },
    { label: 'Awaited<ReturnType>', code: `async function load(id: string) {\n  return { id, total: 42 };\n}\ntype R = ReturnType<typeof load>;   // Promise<{ id: string; total: number }>\ntype V = Awaited<R>;                // { id: string; total: number }`,
      steps: [
        { hl: [1, 2, 3], say: '<code>load</code> is a <b>value</b>. Utility types take types, so first lift it with <code>typeof</code>.', nodes: [P('f', 20, 90, 220, 56, 'load', 'a value', 'acc'), P('tf', 320, 90, 300, 56, '(id: string) =>\nPromise<{…}>', 'typeof load', 'ok')], edges: [['f', 'tf', 'typeof']] },
        { hl: [4], say: '<code>ReturnType</code> is <code>F extends (...a: any) =&gt; infer R ? R : any</code>. For an async function that is a Promise.', nodes: [P('tf', 20, 90, 230, 56, 'typeof load', '', 'mut'), P('r', 320, 90, 300, 56, 'Promise<{ id; total }>', 'ReturnType', 'acc')], edges: [['tf', 'r', 'infer R']] },
        { hl: [5], say: '<code>Awaited</code> (TS 4.5) peels promises recursively, like <code>await</code>. Now you have the resolved shape.', nodes: [P('r', 20, 90, 260, 56, 'Promise<{ id; total }>', '', 'mut'), P('v', 360, 90, 300, 56, '{ id: string;\ntotal: number }', 'Awaited<R>', 'ok', null, true)], edges: [['r', 'v', 'unwrap']] }
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

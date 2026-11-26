/* Generics: step through how the checker infers, constrains and substitutes a type parameter. */
IA.widget('ts-generics', (root, ctx) => {
  const P = (id, x, y, w, h, t, s, k, cap, hot) => ({ id, x, y, w, h, t, s, k, cap, hot });
  const SCENES = [
    { label: 'Inference', code: `function first<T>(xs: T[]): T | undefined {\n  return xs[0];\n}\nconst n = first([1, 2, 3]);\nconst s = first(['a', 'b']);`,
      steps: [
        { hl: [1], say: 'The declaration introduces <code>T</code>: a blank in the signature. Nothing is known about it yet, so inside the body you can only do what works for <i>any</i> type.', nodes: [P('t', 300, 90, 160, 60, 'T', 'unknown placeholder', 'mut', 'type parameter')] },
        { hl: [4], say: 'Call 1: the argument <code>[1, 2, 3]</code> has type <code>number[]</code>. The checker matches it against the parameter type <code>T[]</code>.', nodes: [P('a', 40, 40, 180, 56, 'number[]', 'argument type', 'acc', 'from [1, 2, 3]'), P('p', 300, 40, 160, 56, 'T[]', 'parameter type', 'mut'), P('t', 300, 160, 160, 56, 'T = ?', '', 'mut')], edges: [['a', 'p', 'match']] },
        { hl: [4], say: 'Structurally, <code>number[]</code> against <code>T[]</code> gives the candidate <b>T = number</b>.', nodes: [P('a', 40, 40, 180, 56, 'number[]', 'argument type', 'acc'), P('p', 300, 40, 160, 56, 'T[]', '', 'mut'), P('t', 300, 160, 160, 56, 'T = number', 'inferred', 'ok', null, true)], edges: [['a', 'p', 'match'], ['p', 't', 'candidate', 'ok']] },
        { hl: [1, 4], say: 'T is substituted into the return type: <code>n: number | undefined</code>. The <code>undefined</code> is there because the array might be empty.', nodes: [P('t', 40, 100, 160, 56, 'T = number', '', 'ok'), P('r', 300, 100, 200, 56, 'T | undefined', 'return type', 'mut'), P('n', 570, 100, 170, 56, 'n', 'number | undefined', 'ok', null, true)], edges: [['t', 'r', 'substitute'], ['r', 'n', '', 'ok']] },
        { hl: [5], say: 'Every call gets a <b>fresh</b> T. Here the candidate is <code>string</code>, so <code>s: string | undefined</code>. The emitted JavaScript is one plain function.', nodes: [P('a', 40, 40, 180, 56, 'string[]', 'argument type', 'acc'), P('t', 300, 40, 160, 56, 'T = string', 'fresh per call', 'ok'), P('n', 570, 40, 170, 56, 's', 'string | undefined', 'ok'), P('js', 220, 160, 320, 60, 'function first(xs) {…}', 'emitted JS: no T anywhere', 'alt', 'after compile')], edges: [['a', 't', ''], ['t', 'n', '']] }
      ] },
    { label: 'Constraints', code: `function longest<T extends { length: number }>(a: T, b: T): T {\n  return a.length >= b.length ? a : b;\n}\nlongest('alice', 'bob');   // "alice" | "bob"\nlongest([1, 2], [1, 2, 3]);  // number[]\nlongest(10, 20);           // ✗`,
      steps: [
        { hl: [1, 2], say: 'The constraint <code>extends { length: number }</code> is an upper bound. It is what lets the body read <code>.length</code>.', nodes: [P('t', 300, 120, 160, 56, 'T', '', 'mut', 'type parameter'), P('c', 290, 20, 180, 56, '{ length: number }', 'upper bound', 'acc', 'constraint')], edges: [['t', 'c', 'must be assignable', 'acc']] },
        { hl: [4], say: 'Two literal candidates: <code>"alice"</code> and <code>"bob"</code>. T is at the top level of the return type, so the literals are kept and unioned.', nodes: [P('a', 30, 40, 150, 50, '"alice"', 'candidate 1', 'acc'), P('b', 30, 140, 150, 50, '"bob"', 'candidate 2', 'acc'), P('t', 300, 90, 200, 56, '"alice" | "bob"', 'T', 'ok', null, true), P('c', 570, 90, 170, 56, '{ length }', 'check: OK', 'ok')], edges: [['a', 't', ''], ['b', 't', ''], ['t', 'c', 'fits', 'ok']] },
        { hl: [5], say: 'Array candidates: <code>number[]</code> twice. T = <code>number[]</code>, which has a length. Fine.', nodes: [P('a', 30, 40, 150, 50, 'number[]', 'candidate 1', 'acc'), P('b', 30, 140, 150, 50, 'number[]', 'candidate 2', 'acc'), P('t', 300, 90, 200, 56, 'number[]', 'T', 'ok'), P('c', 570, 90, 170, 56, '{ length }', 'check: OK', 'ok')], edges: [['a', 't', ''], ['b', 't', ''], ['t', 'c', 'fits', 'ok']] },
        { hl: [6], say: '<code>number</code> has no <code>length</code>, so the constraint check fails: <i>Argument of type \'number\' is not assignable to parameter of type \'{ length: number; }\'</i>.', nodes: [P('a', 30, 90, 150, 50, '10, 20', 'number', 'acc'), P('t', 300, 90, 160, 56, 'T = number', '', 'err'), P('c', 570, 90, 170, 56, '{ length }', '✗ not assignable', 'err', null, true)], edges: [['a', 't', ''], ['t', 'c', 'fails', 'err']] }
      ] },
    { label: 'keyof link', code: `function get<T, K extends keyof T>(obj: T, key: K): T[K] {\n  return obj[key];\n}\nconst user = { id: 1, name: 'Ada' };\nconst nm = get(user, 'name');   // string\nget(user, 'email');             // ✗`,
      steps: [
        { hl: [4, 5], say: 'From <code>obj</code>, T = <code>{ id: number; name: string }</code>.', nodes: [P('t', 40, 90, 260, 56, '{ id: number;\nname: string }', 'T', 'ok', 'inferred from user')] },
        { hl: [1], say: '<code>keyof T</code> is the union of its keys. K is constrained to it.', nodes: [P('t', 40, 90, 220, 56, 'T', '{ id; name }', 'ok'), P('k', 330, 90, 200, 56, '"id" | "name"', 'keyof T', 'acc'), P('K', 590, 90, 140, 56, 'K', 'extends keyof T', 'mut')], edges: [['t', 'k', 'keyof'], ['K', 'k', 'bound', 'acc']] },
        { hl: [5], say: 'The literal <code>\'name\'</code> fits, K = <code>"name"</code>, and the indexed access <code>T[K]</code> becomes <code>string</code>.', nodes: [P('k', 40, 90, 180, 56, 'K = "name"', '', 'ok'), P('ix', 290, 90, 180, 56, 'T["name"]', 'indexed access', 'acc'), P('r', 540, 90, 180, 56, 'nm: string', '', 'ok', null, true)], edges: [['k', 'ix', ''], ['ix', 'r', '', 'ok']] },
        { hl: [6], say: '<code>\'email\'</code> is not in <code>"id" | "name"</code>: compile error. A typo in a property name is caught where it is written.', nodes: [P('k', 40, 90, 180, 56, '"email"', 'argument', 'acc'), P('u', 330, 90, 200, 56, '"id" | "name"', 'keyof T', 'err', null, true)], edges: [['k', 'u', 'not assignable', 'err']] }
      ] },
    { label: 'const & NoInfer', code: `function keep<T extends readonly string[]>(xs: T) { return xs; }\nfunction keepC<const T extends readonly string[]>(xs: T) { return xs; }\nkeep(['x', 'y']);    // string[]\nkeepC(['x', 'y']);   // readonly ["x", "y"]   (TS 5.0+)\nfunction light<C extends string>(cs: C[], init: NoInfer<C>) {}\nlight(['red', 'green'], 'blue');  // ✗  (TS 5.4+)`,
      steps: [
        { hl: [1, 3], say: 'A normal type parameter widens an array literal to <code>string[]</code>.', nodes: [P('a', 40, 90, 200, 56, "['x', 'y']", 'array literal', 'acc'), P('t', 330, 90, 200, 56, 'string[]', 'T', 'mut')], edges: [['a', 't', 'widened']] },
        { hl: [2, 4], say: 'A <code>const</code> type parameter (TS 5.0) infers as if the caller wrote <code>as const</code>: a readonly tuple of literals.', nodes: [P('a', 40, 90, 200, 56, "['x', 'y']", 'array literal', 'acc'), P('t', 330, 90, 300, 56, 'readonly ["x", "y"]', 'T (const)', 'ok', null, true)], edges: [['a', 't', 'kept literal', 'ok']] },
        { hl: [5, 6], say: 'Both <code>cs</code> and <code>init</code> could feed C. <code>NoInfer&lt;C&gt;</code> (TS 5.4) blocks the second one, so C comes only from <code>cs</code>.', nodes: [P('a', 30, 40, 200, 56, "['red', 'green']", 'cs → inference', 'acc'), P('b', 30, 160, 200, 56, "'blue'", 'init: NoInfer', 'mut'), P('c', 330, 40, 220, 56, '"red" | "green"', 'C', 'ok')], edges: [['a', 'c', 'infer', 'ok']] },
        { hl: [6], say: 'Then <code>\'blue\'</code> is only <i>checked</i> against C, and fails. Without NoInfer, C would silently become <code>"red" | "green" | "blue"</code>.', nodes: [P('b', 30, 160, 200, 56, "'blue'", 'init', 'acc'), P('c', 330, 40, 220, 56, '"red" | "green"', 'C', 'ok'), P('e', 330, 160, 220, 56, '✗ not assignable', 'compile error', 'err', null, true)], edges: [['b', 'c', 'check', 'err'], ['b', 'e', '', 'err']] }
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

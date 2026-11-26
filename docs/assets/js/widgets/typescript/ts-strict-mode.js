/* Strict mode: watch proven types, unproven claims (as / !) and any flow through code, and where they fail at runtime. */
IA.widget('ts-strict-mode', (root, ctx) => {
  const P = (id, x, y, w, h, t, s, k, cap, hot) => ({ id, x, y, w, h, t, s, k, cap, hot });
  const SCENES = [
    { label: 'any spreads', tag: 'checker vs runtime', code: `const body = JSON.parse(raw);          // any\nconst items = body.itmes;              // any (typo!)\nconst n = items.length * 2;            // any\nfunction save(total: number) { /*…*/ }\nsave(n);                               // accepted`,
      steps: [
        { hl: [1], say: '<code>JSON.parse</code> returns <code>any</code>. This is the hole.', nodes: [P('a', 20, 90, 180, 56, 'body', 'any', 'warn', null, true)] },
        { hl: [2], say: 'Property access on <code>any</code> is <code>any</code>. Even the typo <code>itmes</code> passes, because nothing is checked.', nodes: [P('a', 20, 90, 160, 56, 'body', 'any', 'warn'), P('b', 230, 90, 160, 56, 'items', 'any (typo)', 'warn', null, true)], edges: [['a', 'b', '.itmes']] },
        { hl: [3], say: 'Arithmetic on <code>any</code> is <code>any</code>.', nodes: [P('a', 20, 90, 160, 56, 'body', 'any', 'warn'), P('b', 230, 90, 160, 56, 'items', 'any', 'warn'), P('c', 440, 90, 140, 56, 'n', 'any', 'warn', null, true)], edges: [['a', 'b', ''], ['b', 'c', '.length * 2']] },
        { hl: [4, 5], say: '<code>any</code> is assignable to <code>number</code>. At runtime <code>items</code> is <code>undefined</code>, so line 3 throws before <code>save</code> is even called. The checker saw none of it.', nodes: [P('c', 20, 90, 140, 56, 'n', 'any', 'warn'), P('s', 230, 90, 200, 56, 'save(total: number)', 'accepts any', 'mut'), P('x', 500, 90, 240, 56, 'TypeError', "reading 'length' of undefined", 'err', 'runtime', true)], edges: [['c', 's', 'no check'], ['s', 'x', '', 'err']] },
        { hl: [1], say: 'The fix is at the boundary: type it <code>unknown</code> and parse. Then the typo is a compile error.', nodes: [P('a', 20, 90, 220, 56, 'body: unknown', 'must narrow', 'ok'), P('p', 300, 90, 200, 56, 'Schema.parse', 'runtime check', 'ok'), P('t', 560, 90, 180, 56, '{ items: Item[] }', 'proven', 'ok', null, true)], edges: [['a', 'p', ''], ['p', 't', '', 'ok']] }
      ] },
    { label: 'Index access', tag: 'noUncheckedIndexedAccess', code: `const prices: Record<string, number> = { apple: 3 };\nconst p = prices['pear'];        // default: number\np.toFixed(2);                    // TypeError at runtime\n// with "noUncheckedIndexedAccess": true\nconst q = prices['pear'];        // number | undefined\nif (q !== undefined) q.toFixed(2);`,
      steps: [
        { hl: [1, 2], say: 'By default, an index signature lookup is trusted: <code>p: number</code>.', nodes: [P('r', 20, 90, 220, 56, "prices['pear']", 'lookup', 'acc'), P('p', 320, 90, 180, 56, 'p: number', 'checker', 'warn', null, true)], edges: [['r', 'p', 'trusted']] },
        { hl: [3], say: 'At runtime the key is missing, so <code>p</code> is <code>undefined</code>.', nodes: [P('p', 20, 90, 180, 56, 'p: number', 'checker', 'warn'), P('v', 280, 90, 180, 56, 'undefined', 'runtime value', 'mut'), P('x', 540, 90, 200, 56, 'TypeError', '.toFixed of undefined', 'err', null, true)], edges: [['p', 'v', 'really'], ['v', 'x', '', 'err']] },
        { hl: [4, 5, 6], say: 'With <code>noUncheckedIndexedAccess</code> the type admits the miss, and flow analysis narrows after the check.', nodes: [P('r', 20, 90, 200, 56, "prices['pear']", '', 'acc'), P('q', 280, 90, 220, 56, 'number | undefined', 'q', 'ok'), P('n', 560, 90, 180, 56, 'number', 'after !== undefined', 'ok', null, true)], edges: [['r', 'q', ''], ['q', 'n', 'narrow', 'ok']] }
      ] },
    { label: 'as & !', tag: 'assertions are erased', code: `const u = JSON.parse('{"id":"7"}') as { id: number };\nconsole.log(u.id + 1);              // "71"\nconst user = cache.get('42')!;      // User | undefined → User\nuser.email;                         // TypeError on a miss`,
      steps: [
        { hl: [1], say: '<code>as</code> is a claim. The checker now believes <code>id</code> is a number; nothing at runtime changed.', nodes: [P('v', 20, 90, 200, 56, '{ id: "7" }', 'runtime value', 'mut'), P('t', 320, 90, 220, 56, '{ id: number }', 'claimed type', 'warn', null, true)], edges: [['v', 't', 'as (no check)', 'err']] },
        { hl: [2], say: 'So <code>+</code> concatenates: <code>"7" + 1</code> is <code>"71"</code>. A wrong value, not an exception, which is worse.', nodes: [P('t', 20, 90, 200, 56, 'u.id + 1', 'checker: number', 'warn'), P('x', 320, 90, 200, 56, '"71"', 'runtime', 'err', null, true)], edges: [['t', 'x', '', 'err']] },
        { hl: [3], say: '<code>!</code> strips <code>undefined</code> from the type, by decree.', nodes: [P('g', 20, 90, 220, 56, 'User | undefined', 'cache.get()', 'acc'), P('t', 320, 90, 160, 56, 'User', 'after !', 'warn', null, true)], edges: [['g', 't', '! (no check)', 'err']] },
        { hl: [4], say: 'On a cache miss the claim is false and the next property read throws. Replace <code>!</code> with a check that fails with a clear message.', nodes: [P('t', 20, 90, 160, 56, 'User', 'claimed', 'warn'), P('x', 260, 90, 220, 56, 'TypeError', 'reading email', 'err'), P('f', 540, 90, 200, 56, 'must(v, msg)', 'proven, clear error', 'ok', 'fix')], edges: [['t', 'x', 'miss', 'err']] }
      ] },
    { label: 'Strict family', tag: 'tsconfig', code: `"strict": true   // enables:\n//   noImplicitAny, strictNullChecks, strictFunctionTypes,\n//   strictBindCallApply, strictPropertyInitialization, noImplicitThis,\n//   alwaysStrict, useUnknownInCatchVariables (4.4), strictBuiltinIteratorReturn (5.6)\n// NOT included: noUncheckedIndexedAccess, exactOptionalPropertyTypes, noImplicitOverride`,
      steps: [
        { hl: [1, 2], say: 'The two flags that matter most: no silent <code>any</code>, and <code>null</code>/<code>undefined</code> as real types.', nodes: [P('a', 20, 90, 220, 56, 'noImplicitAny', 'untyped params → error', 'ok'), P('b', 270, 90, 220, 56, 'strictNullChecks', 'null is its own type', 'ok'), P('c', 520, 90, 220, 56, 'strictFunctionTypes', 'contravariant params', 'ok')] },
        { hl: [3, 4], say: 'The rest of the family. New TypeScript versions can add members (as 4.4 and 5.6 did), so upgrades may surface new errors.', nodes: [P('a', 20, 30, 220, 50, 'strictBindCallApply', '', 'ok'), P('b', 270, 30, 220, 50, 'strictPropertyInit…', '', 'ok'), P('c', 520, 30, 220, 50, 'noImplicitThis', '', 'ok'), P('d', 20, 150, 220, 50, 'alwaysStrict', '', 'ok'), P('e', 270, 150, 220, 50, 'useUnknownInCatch…', 'TS 4.4', 'ok'), P('f', 520, 150, 220, 50, 'strictBuiltinIter…', 'TS 5.6', 'ok')] },
        { hl: [5], say: 'Opt-in extras catch real bugs (missing keys, explicit <code>undefined</code> in optional props, accidental overrides). Enable them separately.', nodes: [P('a', 20, 90, 230, 56, 'noUncheckedIndexed…', 'T | undefined lookups', 'alt'), P('b', 270, 90, 230, 56, 'exactOptionalProp…', '?: ≠ undefined', 'alt'), P('c', 520, 90, 220, 56, 'noImplicitOverride', 'override keyword', 'alt')] }
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

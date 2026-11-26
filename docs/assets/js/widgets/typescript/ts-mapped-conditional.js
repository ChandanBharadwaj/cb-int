/* Mapped & conditional types: evaluate keyof, mapped types, distributive conditionals, infer and template literals step by step. */
IA.widget('ts-mapped-conditional', (root, ctx) => {
  const P = (id, x, y, w, h, t, s, k, cap, hot) => ({ id, x, y, w, h, t, s, k, cap, hot });
  const SCENES = [
    { label: 'keyof & T[K]', code: `type User = { id: number; name: string; tags: string[] };\ntype K = keyof User;          // "id" | "name" | "tags"\ntype V = User[K];             // number | string | string[]\ntype T = User['tags'][number]; // string`,
      steps: [
        { hl: [1], say: 'An object type is a set of (key, value type) pairs.', nodes: [P('a', 20, 90, 220, 50, 'id: number', '', 'acc', 'User'), P('b', 270, 90, 220, 50, 'name: string', '', 'acc'), P('c', 520, 90, 220, 50, 'tags: string[]', '', 'acc')] },
        { hl: [2], say: '<code>keyof</code> collects the keys into a union of literal types.', nodes: [P('a', 20, 30, 220, 44, 'id', '', 'mut'), P('b', 270, 30, 220, 44, 'name', '', 'mut'), P('c', 520, 30, 220, 44, 'tags', '', 'mut'), P('k', 200, 150, 360, 56, '"id" | "name" | "tags"', 'keyof User', 'ok', null, true)], edges: [['a', 'k', ''], ['b', 'k', ''], ['c', 'k', '']] },
        { hl: [3], say: 'Indexing with a union of keys gives the union of their value types.', nodes: [P('k', 20, 90, 280, 56, '"id" | "name" | "tags"', 'K', 'mut'), P('v', 380, 90, 360, 56, 'number | string | string[]', 'User[K]', 'ok', null, true)], edges: [['k', 'v', 'look up each']] },
        { hl: [4], say: 'Chain lookups. <code>[number]</code> on an array type gives its element type.', nodes: [P('a', 20, 90, 200, 56, "User['tags']", 'string[]', 'mut'), P('v', 300, 90, 200, 56, '[number]', 'element', 'acc'), P('r', 570, 90, 170, 56, 'string', 'T', 'ok', null, true)], edges: [['a', 'v', ''], ['v', 'r', '', 'ok']] }
      ] },
    { label: 'Mapped + as', code: `type Getters<T> = {\n  [K in keyof T as \`get\${Capitalize<string & K>}\`]: () => T[K]\n};\ntype G = Getters<{ name: string; age: number }>;\n// { getName: () => string; getAge: () => number }`,
      steps: [
        { hl: [4], say: 'The mapped type loops over <code>keyof T</code> = <code>"name" | "age"</code>, one iteration per key.', nodes: [P('a', 20, 40, 200, 50, 'K = "name"', 'iteration 1', 'acc'), P('b', 20, 160, 200, 50, 'K = "age"', 'iteration 2', 'acc')] },
        { hl: [2], say: 'The <code>as</code> clause (TS 4.1+) computes a new key with a template literal type.', nodes: [P('a', 20, 40, 200, 50, 'K = "name"', '', 'mut'), P('a2', 290, 40, 200, 50, '"getName"', 'new key', 'ok'), P('b', 20, 160, 200, 50, 'K = "age"', '', 'mut'), P('b2', 290, 160, 200, 50, '"getAge"', 'new key', 'ok')], edges: [['a', 'a2', 'as `get${…}`'], ['b', 'b2', 'as `get${…}`']] },
        { hl: [2, 5], say: 'The value type uses the <b>original</b> K: <code>() =&gt; T[K]</code>. Return <code>never</code> from <code>as</code> and the key is dropped.', nodes: [P('a2', 20, 40, 200, 50, '"getName"', '', 'mut'), P('a3', 290, 40, 300, 50, '() => string', 'T["name"]', 'ok', null, true), P('b2', 20, 160, 200, 50, '"getAge"', '', 'mut'), P('b3', 290, 160, 300, 50, '() => number', 'T["age"]', 'ok', null, true)], edges: [['a2', 'a3', ''], ['b2', 'b3', '']] }
      ] },
    { label: 'Distribution', code: `type ToArray<T> = T extends unknown ? T[] : never;\ntype A = ToArray<string | number>;     // string[] | number[]\ntype B = [string | number] extends [unknown] ? (string | number)[] : never;\ntype C = ToArray<never>;              // never`,
      steps: [
        { hl: [1, 2], say: 'T is a <b>naked</b> type parameter, and the argument is a union, so the checker splits it.', nodes: [P('u', 250, 20, 260, 50, 'string | number', 'T', 'acc'), P('a', 60, 140, 200, 50, 'string', 'member 1', 'acc'), P('b', 500, 140, 200, 50, 'number', 'member 2', 'acc')], edges: [['u', 'a', 'split'], ['u', 'b', 'split']] },
        { hl: [2], say: 'Each member goes through the conditional on its own, and the results are unioned again.', nodes: [P('a', 60, 30, 200, 50, 'string', '', 'mut'), P('b', 500, 30, 200, 50, 'number', '', 'mut'), P('a2', 60, 120, 200, 50, 'string[]', '', 'ok'), P('b2', 500, 120, 200, 50, 'number[]', '', 'ok'), P('r', 250, 195, 260, 50, 'string[] | number[]', 'A', 'ok', null, true)], edges: [['a', 'a2', 'T[]'], ['b', 'b2', 'T[]'], ['a2', 'r', ''], ['b2', 'r', '']] },
        { hl: [3], say: 'Wrapped in a tuple, the type is no longer naked: the union is tested as one type.', nodes: [P('u', 60, 90, 260, 56, '[string | number]', 'not naked', 'acc'), P('r', 420, 90, 300, 56, '(string | number)[]', 'B', 'ok', null, true)], edges: [['u', 'r', 'no split']] },
        { hl: [4], say: '<code>never</code> is the empty union. Zero members in, zero out: the result is <code>never</code>, not the false branch.', nodes: [P('u', 60, 90, 200, 56, 'never', '0 members', 'mut'), P('r', 420, 90, 200, 56, 'never', 'C', 'warn', null, true)], edges: [['u', 'r', 'nothing to map']] }
      ] },
    { label: 'infer', code: `type Unpromise<T> = T extends Promise<infer V> ? V : T;\ntype A = Unpromise<Promise<string>>;   // string\ntype B = Unpromise<number>;            // number\ntype Id<T> = T extends \`user_\${infer N extends number}\` ? N : never;  // TS 4.7\ntype C = Id<'user_42'>;                // 42`,
      steps: [
        { hl: [1, 2], say: 'The checker tries to match <code>Promise&lt;string&gt;</code> against the pattern <code>Promise&lt;infer V&gt;</code>. It fits, and V binds to <code>string</code>.', nodes: [P('t', 20, 90, 220, 56, 'Promise<string>', 'T', 'acc'), P('p', 300, 90, 220, 56, 'Promise<infer V>', 'pattern', 'mut'), P('v', 580, 90, 160, 56, 'V = string', 'true branch', 'ok', null, true)], edges: [['t', 'p', 'match'], ['p', 'v', 'bind', 'ok']] },
        { hl: [3], say: '<code>number</code> does not fit the pattern, so the false branch returns T unchanged.', nodes: [P('t', 20, 90, 220, 56, 'number', 'T', 'acc'), P('p', 300, 90, 220, 56, 'Promise<infer V>', 'pattern', 'mut'), P('v', 580, 90, 160, 56, 'number', 'false branch', 'warn')], edges: [['t', 'p', 'no match', 'err'], ['t', 'v', '']] },
        { hl: [4, 5], say: 'Inside a template literal, <code>infer N extends number</code> both matches the text after <code>user_</code> and converts it to a number literal type.', nodes: [P('t', 20, 90, 200, 56, '"user_42"', 'T', 'acc'), P('p', 270, 90, 260, 56, '`user_${infer N extends number}`', '', 'mut'), P('v', 590, 90, 150, 56, 'N = 42', 'number literal', 'ok', null, true)], edges: [['t', 'p', 'match'], ['p', 'v', 'bind', 'ok']] }
      ] },
    { label: 'Template literals', code: `type Verb = 'get' | 'set';\ntype Field = 'name' | 'age';\ntype Method = \`\${Verb}\${Capitalize<Field>}\`;\n// "getName" | "getAge" | "setName" | "setAge"`,
      steps: [
        { hl: [1, 2], say: 'Two unions of string literal types: 2 verbs and 2 fields.', nodes: [P('a', 20, 40, 160, 46, '"get"', 'Verb', 'acc'), P('b', 20, 150, 160, 46, '"set"', '', 'acc'), P('c', 220, 40, 160, 46, '"Name"', 'Capitalize<Field>', 'alt'), P('d', 220, 150, 160, 46, '"Age"', '', 'alt')] },
        { hl: [3, 4], say: 'Every combination is produced: 2 × 2 = 4 members. With bigger unions this multiplies fast (the checker refuses unions over 100,000 members).', nodes: [P('a', 20, 40, 160, 46, '"get"', 'Verb', 'mut'), P('b', 20, 150, 160, 46, '"set"', '', 'mut'), P('c', 220, 40, 160, 46, '"Name"', '', 'mut'), P('d', 220, 150, 160, 46, '"Age"', '', 'mut'),
          P('r1', 470, 10, 200, 40, '"getName"', '', 'ok'), P('r2', 470, 70, 200, 40, '"getAge"', '', 'ok'), P('r3', 470, 130, 200, 40, '"setName"', '', 'ok'), P('r4', 470, 190, 200, 40, '"setAge"', '', 'ok')], edges: [['c', 'r1', ''], ['d', 'r2', ''], ['c', 'r3', ''], ['d', 'r4', '']] }
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

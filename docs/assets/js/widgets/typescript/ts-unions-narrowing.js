/* Unions and narrowing: the type of a variable changes line by line as checks prove more.
   Step-through "type tracker": code on the left, what the checker (or the runtime) knows on the right. */
IA.widget('ts-unions-narrowing', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const SC = [
 {
  "label": "typeof / truthy",
  "code": [
   "function fmt(v: string | number | null) {",
   "  if (v === null) return \"-\";",
   "  if (typeof v === \"number\") {",
   "    return v.toFixed(2);",
   "  }",
   "  return v.trim();",
   "}"
  ],
  "steps": [
   {
    "l": 0,
    "say": "A <b>union</b>: <code>v</code> is one of three types. You can only use what all three share.",
    "env": [
     [
      "v",
      "string | number | null"
     ]
    ]
   },
   {
    "l": 1,
    "tone": "ok",
    "say": "An equality check removes <code>null</code> for the rest of the function (control-flow analysis).",
    "env": [
     [
      "v (after line 2)",
      "string | number",
      "ok"
     ]
    ]
   },
   {
    "l": 3,
    "tone": "ok",
    "say": "Inside the <code>typeof</code> branch, <code>v</code> is a number. <code>toFixed</code> is allowed.",
    "env": [
     [
      "v (here)",
      "number",
      "ok"
     ]
    ]
   },
   {
    "l": 5,
    "tone": "ok",
    "say": "The number branch returned, so only <code>string</code> is left.",
    "env": [
     [
      "v (here)",
      "string",
      "ok"
     ]
    ]
   }
  ]
 },
 {
  "label": "in / instanceof",
  "code": [
   "type Fish = { swim(): void };",
   "type Bird = { fly(): void };",
   "function move(a: Fish | Bird) {",
   "  if (\"swim\" in a) a.swim();",
   "  else a.fly();",
   "}",
   "function msg(e: unknown) {",
   "  return e instanceof Error ? e.message : String(e);",
   "}"
  ],
  "steps": [
   {
    "l": 2,
    "say": "Two object shapes. Neither has a tag property.",
    "env": [
     [
      "a",
      "Fish | Bird"
     ]
    ]
   },
   {
    "l": 3,
    "tone": "ok",
    "say": "<code>\"swim\" in a</code> narrows to members that have <code>swim</code>.",
    "env": [
     [
      "a (if)",
      "Fish",
      "ok"
     ]
    ]
   },
   {
    "l": 4,
    "tone": "ok",
    "say": "The else branch gets what is left.",
    "env": [
     [
      "a (else)",
      "Bird",
      "ok"
     ]
    ]
   },
   {
    "l": 7,
    "tone": "ok",
    "say": "<code>instanceof</code> narrows to a <b>class</b>. It checks the prototype chain at runtime, so it only works for real classes, not interfaces.",
    "env": [
     [
      "e",
      "unknown"
     ],
     [
      "e (true branch)",
      "Error",
      "ok"
     ]
    ]
   }
  ]
 },
 {
  "label": "Discriminated",
  "code": [
   "type Res =",
   "  | { kind: \"ok\"; data: string }",
   "  | { kind: \"err\"; code: number };",
   "function show(r: Res): string {",
   "  switch (r.kind) {",
   "    case \"ok\": return r.data;",
   "    case \"err\": return \"E\" + r.code;",
   "    default: const x: never = r; return x;",
   "  }",
   "}"
  ],
  "steps": [
   {
    "l": 1,
    "say": "Each member has the same <b>tag</b> property with a different literal type.",
    "env": [
     [
      "Res",
      "ok | err (tag: kind)"
     ]
    ]
   },
   {
    "l": 5,
    "tone": "ok",
    "say": "Checking the tag narrows the whole object. <code>r.data</code> exists only here.",
    "env": [
     [
      "r",
      "{ kind: \"ok\"; data }",
      "ok"
     ]
    ]
   },
   {
    "l": 6,
    "tone": "ok",
    "say": "Same for the other tag.",
    "env": [
     [
      "r",
      "{ kind: \"err\"; code }",
      "ok"
     ]
    ]
   },
   {
    "l": 7,
    "tone": "ok",
    "say": "Every case is handled, so <code>r</code> is <code>never</code> here. Add a third member and this line becomes a compile error: <b>exhaustiveness check</b>.",
    "env": [
     [
      "r (default)",
      "never",
      "ok"
     ],
     [
      "add kind \"loading\"",
      "TS2322 here",
      "err"
     ]
    ]
   }
  ]
 }
];
  let sc = 0; let k = -1; let running = false; let gen = 0;
  const W = 760, LH = 24, TOP = 44, CX = 12, CW = 452, PX = 478, PW = 270;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Example' });
  SC.forEach((s, i) => {
    const b = el('button', { text: s.label, class: i === sc ? 'on' : '' });
    b.addEventListener('click', () => { sc = i; [...seg.children].forEach((x, j) => x.classList.toggle('on', j === i)); reset(); });
    seg.append(b);
  });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: `0 0 ${W} 300`, role: 'img', 'aria-label': 'Code on the left; facts known at the highlighted line on the right' });
  const num = el('span', { class: 'n', text: '0' });
  const txt = el('div', { class: 't', text: 'Press Play or Step.' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, num, txt);
  root.append(el('div', { class: 'w-controls' }, seg), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr);
  const TONE = { ok: 'var(--ok)', err: 'var(--err)', warn: 'var(--warn)', info: 'var(--accent)' };
  function draw() {
    const S = SC[sc]; const st = k >= 0 ? S.steps[k] : null;
    const rows = st ? st.env : (S.start || []);
    const H = Math.max(TOP + S.code.length * LH + 16, TOP + rows.length * 46 + 16, 160);
    stage.setAttribute('viewBox', `0 0 ${W} ${H}`);
    stage.innerHTML = '';
    stage.append(svg('text', { x: CX, y: 24, 'font-size': 13, 'font-weight': 700, fill: 'var(--text)', text: S.left || 'code.ts' }),
      svg('text', { x: PX, y: 24, 'font-size': 13, 'font-weight': 700, fill: 'var(--text)', text: S.right || 'What TypeScript knows' }),
      svg('rect', { x: CX - 4, y: TOP - 8, width: CW, height: S.code.length * LH + 10, rx: 8, fill: 'var(--surface-2)', stroke: 'var(--border)' }));
    S.code.forEach((line, i) => {
      const on = st && st.l === i;
      if (on) stage.append(svg('rect', { x: CX - 2, y: TOP - 6 + i * LH, width: CW - 4, height: LH - 2, rx: 5, fill: 'var(--accent-soft)', stroke: TONE[st.tone || 'info'], 'stroke-width': 1.5 }));
      stage.append(svg('text', { x: CX + 4, y: TOP + 11 + i * LH, 'font-size': 12.5, 'font-family': 'var(--mono)', fill: on ? 'var(--text)' : 'var(--text-2)', 'xml:space': 'preserve', text: line }));
    });
    rows.forEach((r, i) => {
      const y = TOP - 8 + i * 46; const c = TONE[r[2]] || 'var(--border)';
      const g = svg('g');
      g.append(svg('rect', { x: PX, y, width: PW, height: 40, rx: 8, fill: 'var(--surface)', stroke: c, 'stroke-width': r[2] ? 2 : 1 }),
        svg('text', { x: PX + 10, y: y + 16, 'font-size': 11, fill: 'var(--text-3)', text: r[0] }),
        svg('text', { x: PX + 10, y: y + 32, 'font-size': 12.5, 'font-family': 'var(--mono)', fill: r[2] ? c : 'var(--text)', text: r[1] }));
      if (!reduced && st) g.style.animation = 'capin .35s ease both';
      stage.append(g);
    });
    const tone = st ? (st.tone || 'info') : 'info';
    narr.className = 'caption' + (tone === 'ok' ? ' ok' : tone === 'err' ? ' err' : tone === 'warn' ? ' warn' : '');
    num.textContent = st ? `${k + 1}/${S.steps.length}` : '0';
    txt.innerHTML = st ? st.say : (S.intro || 'Press Play or Step to walk through the code.');
    bStep.disabled = k >= S.steps.length - 1;
  }
  function step() { if (k >= SC[sc].steps.length - 1) return false; k++; draw(); return true; }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = -1; draw(); }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (reduced) { k = SC[sc].steps.length - 1; draw(); return; }
    if (k >= SC[sc].steps.length - 1) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(2200);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

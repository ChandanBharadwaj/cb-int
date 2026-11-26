/* Basic types: inference, literal widening, arrays and tuples, any vs unknown.
   Step-through "type tracker": code on the left, what the checker (or the runtime) knows on the right. */
IA.widget('ts-basic-types', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const SC = [
 {
  "label": "Inference",
  "code": [
   "let count = 0;",
   "const mode = \"dark\";",
   "let label = mode;",
   "const xs = [1, 2, 3];",
   "const mixed = [1, \"a\"];",
   "count = \"five\";"
  ],
  "steps": [
   {
    "l": 0,
    "say": "No annotation needed: the type is <b>inferred</b> from the initializer.",
    "env": [
     [
      "count",
      "number"
     ]
    ]
   },
   {
    "l": 1,
    "say": "A <code>const</code> can never change, so it keeps the <b>literal type</b> <code>\"dark\"</code>.",
    "env": [
     [
      "count",
      "number"
     ],
     [
      "mode",
      "\"dark\"  (literal)",
      "info"
     ]
    ]
   },
   {
    "l": 2,
    "say": "Assigning to a <code>let</code> <b>widens</b> the literal back to <code>string</code>.",
    "env": [
     [
      "count",
      "number"
     ],
     [
      "mode",
      "\"dark\""
     ],
     [
      "label",
      "string  (widened)",
      "info"
     ]
    ]
   },
   {
    "l": 3,
    "say": "Array element types are inferred too.",
    "env": [
     [
      "count",
      "number"
     ],
     [
      "mode",
      "\"dark\""
     ],
     [
      "label",
      "string"
     ],
     [
      "xs",
      "number[]"
     ]
    ]
   },
   {
    "l": 4,
    "say": "Mixed elements give a union element type, <b>not</b> a tuple.",
    "env": [
     [
      "count",
      "number"
     ],
     [
      "mode",
      "\"dark\""
     ],
     [
      "label",
      "string"
     ],
     [
      "xs",
      "number[]"
     ],
     [
      "mixed",
      "(string | number)[]",
      "info"
     ]
    ]
   },
   {
    "l": 5,
    "tone": "err",
    "say": "Inferred types are still enforced. Same as Java’s <code>var</code>: inferred once, fixed after.",
    "env": [
     [
      "count",
      "number"
     ],
     [
      "error",
      "TS2322: string → number",
      "err"
     ]
    ]
   }
  ]
 },
 {
  "label": "Tuples",
  "code": [
   "const pair: [string, number] = [\"id\", 7];",
   "const [k, v] = pair;",
   "const bad: [string, number] = [7, \"id\"];",
   "const rt: readonly [number, number] = [0, 0];",
   "rt[0] = 1;",
   "pair.push(99);"
  ],
  "steps": [
   {
    "l": 0,
    "say": "A <b>tuple</b> is a fixed-length array where each position has its own type.",
    "env": [
     [
      "pair",
      "[string, number]"
     ]
    ]
   },
   {
    "l": 1,
    "say": "Destructuring keeps the per-position types.",
    "env": [
     [
      "pair",
      "[string, number]"
     ],
     [
      "k",
      "string"
     ],
     [
      "v",
      "number"
     ]
    ]
   },
   {
    "l": 2,
    "tone": "err",
    "say": "Wrong order is an error: position 0 must be a string.",
    "env": [
     [
      "pair",
      "[string, number]"
     ],
     [
      "bad",
      "TS2322",
      "err"
     ]
    ]
   },
   {
    "l": 4,
    "tone": "err",
    "say": "<code>readonly</code> tuples reject writes.",
    "env": [
     [
      "rt",
      "readonly [number, number]"
     ],
     [
      "rt[0] = 1",
      "TS2540 read-only",
      "err"
     ]
    ]
   },
   {
    "l": 5,
    "tone": "warn",
    "say": "A known hole: <code>push</code> on a mutable tuple compiles. At runtime it is just an array, now of length 3.",
    "env": [
     [
      "pair (type)",
      "[string, number]"
     ],
     [
      "pair (runtime)",
      "[\"id\", 7, 99]",
      "warn"
     ]
    ]
   }
  ]
 },
 {
  "label": "any vs unknown",
  "code": [
   "const a: any = JSON.parse(input);",
   "a.user.name.toUpperCase();",
   "const u: unknown = JSON.parse(input);",
   "u.user;",
   "if (typeof u === \"string\") {",
   "  u.toUpperCase();",
   "}"
  ],
  "steps": [
   {
    "l": 0,
    "tone": "warn",
    "say": "<code>any</code> switches checking <b>off</b> for this value, and for everything you derive from it.",
    "env": [
     [
      "a",
      "any",
      "warn"
     ]
    ]
   },
   {
    "l": 1,
    "tone": "warn",
    "say": "Anything goes. This compiles, then crashes at runtime if <code>user</code> is missing.",
    "env": [
     [
      "a",
      "any",
      "warn"
     ],
     [
      "a.user.name…",
      "any (no check)",
      "warn"
     ]
    ]
   },
   {
    "l": 2,
    "say": "<code>unknown</code> is the safe top type: you can store anything in it…",
    "env": [
     [
      "a",
      "any"
     ],
     [
      "u",
      "unknown",
      "info"
     ]
    ]
   },
   {
    "l": 3,
    "tone": "err",
    "say": "…but you cannot <b>use</b> it until you prove what it is.",
    "env": [
     [
      "u",
      "unknown"
     ],
     [
      "u.user",
      "TS18046: u is unknown",
      "err"
     ]
    ]
   },
   {
    "l": 5,
    "tone": "ok",
    "say": "After a check, the type is <b>narrowed</b> and the call is allowed.",
    "env": [
     [
      "u (outside if)",
      "unknown"
     ],
     [
      "u (inside if)",
      "string",
      "ok"
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

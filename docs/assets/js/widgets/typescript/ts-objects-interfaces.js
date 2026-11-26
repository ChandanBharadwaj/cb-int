/* Objects, interfaces and type aliases: structural typing, optional and readonly, index signatures.
   Step-through "type tracker": code on the left, what the checker (or the runtime) knows on the right. */
IA.widget('ts-objects-interfaces', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const SC = [
 {
  "label": "Structural",
  "code": [
   "interface Point { x: number; y: number }",
   "function len(p: Point) {",
   "  return Math.hypot(p.x, p.y);",
   "}",
   "const v = { x: 3, y: 4, label: \"v\" };",
   "len(v);",
   "len({ x: 3, y: 4, label: \"v\" });"
  ],
  "steps": [
   {
    "l": 0,
    "say": "An interface describes a <b>shape</b>: which properties, with which types.",
    "env": [
     [
      "Point",
      "{ x: number; y: number }"
     ]
    ]
   },
   {
    "l": 4,
    "say": "<code>v</code> was never declared as a Point. It just has an x and a y (and more).",
    "env": [
     [
      "Point",
      "{ x; y }"
     ],
     [
      "v",
      "{ x; y; label }"
     ]
    ]
   },
   {
    "l": 5,
    "tone": "ok",
    "say": "<b>Structural typing</b>: <code>v</code> has every member Point needs, so it <i>is</i> a Point. No <code>implements</code> required.",
    "env": [
     [
      "Point",
      "{ x; y }"
     ],
     [
      "v",
      "{ x; y; label }"
     ],
     [
      "len(v)",
      "OK, shape matches",
      "ok"
     ]
    ]
   },
   {
    "l": 6,
    "tone": "err",
    "say": "But a <b>fresh object literal</b> gets an <i>excess property check</i>: <code>label</code> is probably a typo, so it is an error.",
    "env": [
     [
      "Point",
      "{ x; y }"
     ],
     [
      "len({…label})",
      "TS2353 excess property",
      "err"
     ]
    ]
   }
  ]
 },
 {
  "label": "Optional & readonly",
  "code": [
   "interface User {",
   "  readonly id: string;",
   "  email?: string;",
   "}",
   "const u: User = { id: \"u1\" };",
   "u.id = \"u2\";",
   "u.email.toLowerCase();",
   "u.email?.toLowerCase();"
  ],
  "steps": [
   {
    "l": 1,
    "say": "<code>readonly</code>: assignable only when the object is created.",
    "env": [
     [
      "id",
      "readonly string"
     ]
    ]
   },
   {
    "l": 2,
    "say": "<code>?</code>: the property may be absent. Its type becomes <code>string | undefined</code>.",
    "env": [
     [
      "id",
      "readonly string"
     ],
     [
      "email",
      "string | undefined"
     ]
    ]
   },
   {
    "l": 5,
    "tone": "err",
    "say": "Writing a readonly property is a compile error. At runtime nothing stops it: readonly is erased.",
    "env": [
     [
      "u.id = …",
      "TS2540 read-only",
      "err"
     ]
    ]
   },
   {
    "l": 6,
    "tone": "err",
    "say": "With <code>strictNullChecks</code>, you must handle the missing case.",
    "env": [
     [
      "u.email",
      "string | undefined"
     ],
     [
      ".toLowerCase()",
      "TS18048 possibly undefined",
      "err"
     ]
    ]
   },
   {
    "l": 7,
    "tone": "ok",
    "say": "Optional chaining returns <code>undefined</code> instead of throwing.",
    "env": [
     [
      "u.email?.toLowerCase()",
      "string | undefined",
      "ok"
     ]
    ]
   }
  ]
 },
 {
  "label": "Index signatures",
  "code": [
   "interface Headers { [name: string]: string }",
   "const h: Headers = { host: \"a.io\" };",
   "const ua = h[\"user-agent\"];",
   "type Counts = Record<string, number>;",
   "// with noUncheckedIndexedAccess:",
   "const ua2 = h[\"user-agent\"];"
  ],
  "steps": [
   {
    "l": 0,
    "say": "An <b>index signature</b> says: any string key, every value a string. Like <code>Map&lt;String,String&gt;</code> in shape.",
    "env": [
     [
      "Headers",
      "{ [name: string]: string }"
     ]
    ]
   },
   {
    "l": 2,
    "tone": "warn",
    "say": "By default the lookup is typed <code>string</code>, even for a key that is not there. At runtime it is <code>undefined</code>.",
    "env": [
     [
      "ua (type)",
      "string",
      "warn"
     ],
     [
      "ua (runtime)",
      "undefined",
      "warn"
     ]
    ]
   },
   {
    "l": 3,
    "say": "<code>Record&lt;K, V&gt;</code> is the built-in shorthand for the same idea.",
    "env": [
     [
      "Counts",
      "{ [k: string]: number }"
     ]
    ]
   },
   {
    "l": 5,
    "tone": "ok",
    "say": "<code>noUncheckedIndexedAccess</code> makes lookups honest: you must check before use.",
    "env": [
     [
      "ua2",
      "string | undefined",
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

/* Classes and enums: what each modifier means at compile time and what survives at runtime.
   Step-through "type tracker": code on the left, what the checker (or the runtime) knows on the right. */
IA.widget('ts-classes', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const SC = [
 {
  "label": "Modifiers",
  "right": "Checker vs runtime",
  "code": [
   "class Account {",
   "  private balance = 0;",
   "  #pin = \"1234\";",
   "  protected owner = \"ana\";",
   "  readonly id = \"a1\";",
   "}",
   "const a = new Account();",
   "a.balance;",
   "(a as any).balance;"
  ],
  "steps": [
   {
    "l": 1,
    "say": "<code>private</code> is a <b>TypeScript</b> modifier. It is checked at compile time and erased.",
    "env": [
     [
      "balance",
      "private: compile time only",
      "warn"
     ]
    ]
   },
   {
    "l": 2,
    "tone": "ok",
    "say": "<code>#pin</code> is a <b>JavaScript</b> private field. The engine enforces it at runtime.",
    "env": [
     [
      "balance",
      "private: compile time only",
      "warn"
     ],
     [
      "#pin",
      "truly private (runtime)",
      "ok"
     ]
    ]
   },
   {
    "l": 3,
    "say": "<code>protected</code>: visible in subclasses. There is no package-private level as in Java.",
    "env": [
     [
      "balance",
      "private: compile time"
     ],
     [
      "#pin",
      "runtime private"
     ],
     [
      "owner",
      "protected: subclasses"
     ]
    ]
   },
   {
    "l": 7,
    "tone": "err",
    "say": "The checker blocks outside access.",
    "env": [
     [
      "a.balance",
      "TS2341 private",
      "err"
     ]
    ]
   },
   {
    "l": 8,
    "tone": "warn",
    "say": "A cast (or plain JS caller) reads it fine. It also shows in <code>JSON.stringify</code>. <code>#pin</code> would not.",
    "env": [
     [
      "(a as any).balance",
      "0 at runtime",
      "warn"
     ],
     [
      "JSON.stringify(a)",
      "{\"balance\":0,\"owner\":…}",
      "warn"
     ]
    ]
   }
  ]
 },
 {
  "label": "Param properties",
  "right": "Emitted JS",
  "code": [
   "class Repo {",
   "  constructor(",
   "    private readonly db: Db,",
   "    public name: string,",
   "  ) {}",
   "}",
   "// node --experimental-strip-types",
   "//   → ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX"
  ],
  "steps": [
   {
    "l": 2,
    "say": "A <b>parameter property</b>: a modifier on a constructor parameter declares a field and assigns it.",
    "env": [
     [
      "field",
      "db (private, readonly)"
     ]
    ]
   },
   {
    "l": 3,
    "say": "Works with <code>public</code>, <code>protected</code>, <code>private</code> and <code>readonly</code>.",
    "env": [
     [
      "field",
      "db (private, readonly)"
     ],
     [
      "field",
      "name (public)"
     ]
    ]
   },
   {
    "l": 4,
    "say": "tsc emits real code for it: <code>this.db = db; this.name = name;</code>. That is why it is <b>not erasable</b>.",
    "env": [
     [
      "emitted",
      "this.db = db;",
      "info"
     ],
     [
      "emitted",
      "this.name = name;",
      "info"
     ]
    ]
   },
   {
    "l": 7,
    "tone": "err",
    "say": "Node’s type stripping cannot generate code, so it rejects this. So does tsc with <code>erasableSyntaxOnly</code> (TS 5.8+).",
    "env": [
     [
      "strip-types",
      "not supported",
      "err"
     ],
     [
      "fix",
      "declare fields explicitly",
      "ok"
     ]
    ]
   }
  ]
 },
 {
  "label": "enum vs union",
  "right": "Runtime object",
  "code": [
   "enum Dir { Up, Down }",
   "enum Color { Red = \"RED\" }",
   "const Status = { Active: \"ACTIVE\",",
   "  Closed: \"CLOSED\" } as const;",
   "type Status = typeof Status[keyof typeof Status];",
   "type Size = \"S\" | \"M\" | \"L\";"
  ],
  "steps": [
   {
    "l": 0,
    "tone": "warn",
    "say": "A numeric enum emits an object with a <b>reverse mapping</b>.",
    "env": [
     [
      "Dir",
      "{0:\"Up\",1:\"Down\",Up:0,Down:1}",
      "warn"
     ]
    ]
   },
   {
    "l": 1,
    "say": "String enums emit a plain one-way object, no reverse mapping.",
    "env": [
     [
      "Dir",
      "{0:\"Up\",1:\"Down\",Up:0,Down:1}"
     ],
     [
      "Color",
      "{ Red: \"RED\" }"
     ]
    ]
   },
   {
    "l": 3,
    "tone": "ok",
    "say": "The erasable alternative: an <code>as const</code> object (still a runtime value)…",
    "env": [
     [
      "Status",
      "{ Active, Closed } (plain JS)",
      "ok"
     ]
    ]
   },
   {
    "l": 4,
    "tone": "ok",
    "say": "…plus a type derived from it: <code>\"ACTIVE\" | \"CLOSED\"</code>.",
    "env": [
     [
      "Status (value)",
      "plain object"
     ],
     [
      "Status (type)",
      "\"ACTIVE\" | \"CLOSED\"",
      "ok"
     ]
    ]
   },
   {
    "l": 5,
    "tone": "ok",
    "say": "Or just a <b>union of literals</b>: zero runtime code at all.",
    "env": [
     [
      "Size",
      "\"S\" | \"M\" | \"L\"",
      "ok"
     ],
     [
      "runtime",
      "nothing emitted",
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

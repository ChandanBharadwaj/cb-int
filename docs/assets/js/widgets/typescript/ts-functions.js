/* Typing functions: parameters, optional and default values, overloads, void vs never.
   Step-through "type tracker": code on the left, what the checker (or the runtime) knows on the right. */
IA.widget('ts-functions', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const SC = [
 {
  "label": "Params & defaults",
  "code": [
   "function greet(name: string, title?: string,",
   "               punct = \"!\"): string {",
   "  return (title ?? \"\") + name + punct;",
   "}",
   "greet(\"Ana\");",
   "greet(\"Ana\", undefined, \"?\");",
   "greet();"
  ],
  "steps": [
   {
    "l": 0,
    "say": "Parameters need annotations (they are not inferred from callers). <code>title?</code> is <b>optional</b>: its type is <code>string | undefined</code>.",
    "env": [
     [
      "name",
      "string"
     ],
     [
      "title",
      "string | undefined",
      "info"
     ]
    ]
   },
   {
    "l": 1,
    "say": "A <b>default</b> makes it optional and infers the type from the default.",
    "env": [
     [
      "name",
      "string"
     ],
     [
      "title",
      "string | undefined"
     ],
     [
      "punct",
      "string (default \"!\")",
      "info"
     ]
    ]
   },
   {
    "l": 2,
    "say": "The return type is checked against <code>: string</code>.",
    "env": [
     [
      "name",
      "string"
     ],
     [
      "title",
      "string | undefined"
     ],
     [
      "punct",
      "string"
     ],
     [
      "returns",
      "string",
      "ok"
     ]
    ]
   },
   {
    "l": 5,
    "say": "Defaults apply only when the argument is <code>undefined</code>, so passing <code>undefined</code> “skips” a slot.",
    "env": [
     [
      "call",
      "greet(\"Ana\", undefined, \"?\")",
      "ok"
     ]
    ]
   },
   {
    "l": 6,
    "tone": "err",
    "say": "Missing a required parameter is an error. Unlike JS, arity is checked.",
    "env": [
     [
      "greet()",
      "TS2554: expected 1-3 args",
      "err"
     ]
    ]
   }
  ]
 },
 {
  "label": "Overloads",
  "left": "parse.ts",
  "code": [
   "function parse(x: string): number;",
   "function parse(x: number[]): number[];",
   "function parse(x: string | number[]) {",
   "  return typeof x === \"string\"",
   "    ? Number(x) : x.map(Number);",
   "}",
   "const a = parse(\"42\");",
   "const b = parse([1, 2]);"
  ],
  "steps": [
   {
    "l": 0,
    "say": "Overload <b>signatures</b> have no body. They are what callers see.",
    "env": [
     [
      "sig 1",
      "(x: string) => number"
     ]
    ]
   },
   {
    "l": 1,
    "say": "A second signature.",
    "env": [
     [
      "sig 1",
      "(x: string) => number"
     ],
     [
      "sig 2",
      "(x: number[]) => number[]"
     ]
    ]
   },
   {
    "l": 2,
    "tone": "warn",
    "say": "One <b>implementation</b> with a wide type. It is hidden from callers. JS has only one function, so you branch at runtime.",
    "env": [
     [
      "sig 1",
      "(x: string) => number"
     ],
     [
      "sig 2",
      "(x: number[]) => number[]"
     ],
     [
      "impl",
      "not callable directly",
      "warn"
     ]
    ]
   },
   {
    "l": 6,
    "tone": "ok",
    "say": "The checker picks the <b>first matching</b> signature from the top.",
    "env": [
     [
      "a",
      "number",
      "ok"
     ]
    ]
   },
   {
    "l": 7,
    "tone": "ok",
    "say": "Here signature 2 matches. Often a union parameter or generics is simpler than overloads.",
    "env": [
     [
      "a",
      "number"
     ],
     [
      "b",
      "number[]",
      "ok"
     ]
    ]
   }
  ]
 },
 {
  "label": "void vs never",
  "code": [
   "function log(msg: string): void {",
   "  console.log(msg);",
   "}",
   "function fail(msg: string): never {",
   "  throw new Error(msg);",
   "}",
   "const port = env.PORT ?? fail(\"PORT missing\");"
  ],
  "steps": [
   {
    "l": 0,
    "say": "<code>void</code>: the function returns, but the value is not meant to be used.",
    "env": [
     [
      "log",
      "(msg: string) => void"
     ]
    ]
   },
   {
    "l": 3,
    "say": "<code>never</code>: the function <b>never returns normally</b>. It throws or loops forever.",
    "env": [
     [
      "log",
      "(msg: string) => void"
     ],
     [
      "fail",
      "(msg: string) => never",
      "info"
     ]
    ]
   },
   {
    "l": 6,
    "tone": "ok",
    "say": "<code>never</code> vanishes in a union (<code>string | never</code> is <code>string</code>), so <code>port</code> is a plain <code>string</code>.",
    "env": [
     [
      "env.PORT",
      "string | undefined"
     ],
     [
      "fail(...)",
      "never"
     ],
     [
      "port",
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

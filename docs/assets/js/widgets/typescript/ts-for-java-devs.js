/* TypeScript for Java developers: the same code read with nominal (Java) and structural (TS) rules.
   Step-through "type tracker": code on the left, what the checker (or the runtime) knows on the right. */
IA.widget('ts-for-java-devs', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const SC = [
 {
  "label": "Nominal vs structural",
  "right": "Java says / TS says",
  "code": [
   "interface UserId { value: string }",
   "interface OrderId { value: string }",
   "function cancel(id: OrderId) { /* … */ }",
   "const u: UserId = { value: \"u-1\" };",
   "cancel(u);",
   "type OrderId2 = string & { __brand: \"Order\" };"
  ],
  "steps": [
   {
    "l": 1,
    "say": "Two interfaces with the same shape. In Java they would be unrelated types.",
    "env": [
     [
      "Java",
      "UserId ≠ OrderId (names)"
     ],
     [
      "TS",
      "same shape = same type",
      "warn"
     ]
    ]
   },
   {
    "l": 4,
    "tone": "warn",
    "say": "Java: compile error. TypeScript: <b>fine</b>. Assignability is decided by structure, not by name.",
    "env": [
     [
      "Java",
      "incompatible types",
      "err"
     ],
     [
      "TS",
      "OK",
      "warn"
     ]
    ]
   },
   {
    "l": 5,
    "tone": "ok",
    "say": "To get nominal-like safety, use a <b>branded type</b>: an intersection with a fake tag only the constructor function adds.",
    "env": [
     [
      "TS",
      "brand makes ids distinct",
      "ok"
     ]
    ]
   }
  ]
 },
 {
  "label": "Generics",
  "right": "Java says / TS says",
  "code": [
   "function first<T>(xs: T[]): T | undefined {",
   "  return xs[0];",
   "}",
   "const n = first([1, 2]);",
   "function make<T>(): T { return new T(); }",
   "let animals: Animal[] = dogs;",
   "animals.push(new Cat());"
  ],
  "steps": [
   {
    "l": 0,
    "say": "Generics look almost the same. Both languages erase them at runtime.",
    "env": [
     [
      "Java",
      "erased, List<String>"
     ],
     [
      "TS",
      "erased, T[]"
     ]
    ]
   },
   {
    "l": 3,
    "tone": "ok",
    "say": "TS infers <code>T = number</code> from the argument, like Java’s inference for generic methods.",
    "env": [
     [
      "n",
      "number | undefined",
      "ok"
     ]
    ]
   },
   {
    "l": 4,
    "tone": "err",
    "say": "<code>T</code> is type-only, so <code>new T()</code> is impossible. Pass a constructor or factory instead (like a <code>Class&lt;T&gt;</code> token).",
    "env": [
     [
      "Java",
      "new T() illegal too"
     ],
     [
      "TS",
      "TS2693 T is only a type",
      "err"
     ]
    ]
   },
   {
    "l": 6,
    "tone": "warn",
    "say": "TS arrays are <b>covariant and unchecked</b>. Java throws <code>ArrayStoreException</code> at runtime; TS says nothing, ever.",
    "env": [
     [
      "Java (arrays)",
      "ArrayStoreException",
      "err"
     ],
     [
      "TS",
      "compiles, runs, corrupt",
      "warn"
     ]
    ]
   }
  ]
 },
 {
  "label": "Overloading",
  "right": "Java says / TS says",
  "code": [
   "class Printer {",
   "  print(x: string): void {}",
   "  print(x: number): void {}",
   "}",
   "class Printer2 {",
   "  print(x: string | number): void {",
   "    if (typeof x === \"number\") { /* … */ }",
   "  }",
   "}"
  ],
  "steps": [
   {
    "l": 2,
    "tone": "err",
    "say": "Java dispatches on parameter types. In TS this is a <b>duplicate implementation</b> error: one JS object can hold only one <code>print</code>.",
    "env": [
     [
      "Java",
      "two methods",
      "ok"
     ],
     [
      "TS",
      "TS2393 duplicate",
      "err"
     ]
    ]
   },
   {
    "l": 5,
    "tone": "ok",
    "say": "TS style: one method, a union parameter, and a runtime check. Overload <i>signatures</i> can sit on top if the return type depends on the input.",
    "env": [
     [
      "Java",
      "compile-time dispatch"
     ],
     [
      "TS",
      "one method + typeof",
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

/* Why TypeScript: the same file through tsc, tsx and Node type stripping.
   Step-through "type tracker": code on the left, what the checker (or the runtime) knows on the right. */
IA.widget('ts-why-setup', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const SC = [
 {
  "label": "tsc (check + emit)",
  "left": "price.ts",
  "right": "Pipeline",
  "code": [
   "function total(p: number, qty: number): number {",
   "  return p * qty;",
   "}",
   "total(\"9.99\", 2);",
   "",
   "// $ npx tsc --noEmit   (type-check only)",
   "// $ npx tsc            (check + write .js)",
   "// $ node dist/price.js"
  ],
  "steps": [
   {
    "l": 0,
    "say": "You write normal JavaScript plus <b>annotations</b> (<code>: number</code>). The annotations are for the checker only.",
    "env": [
     [
      "source",
      "price.ts",
      "info"
     ],
     [
      "types",
      "p: number, qty: number"
     ]
    ]
   },
   {
    "l": 3,
    "tone": "err",
    "say": "In your editor the TypeScript language service flags this <b>as you type</b>: a string is not a number. Same engine as <code>tsc</code>.",
    "env": [
     [
      "source",
      "price.ts"
     ],
     [
      "editor",
      "TS2345: \"9.99\" not number",
      "err"
     ]
    ]
   },
   {
    "l": 5,
    "tone": "err",
    "say": "<code>tsc --noEmit</code> type-checks the whole project and exits non-zero. This is the line CI should run.",
    "env": [
     [
      "source",
      "price.ts"
     ],
     [
      "tsc --noEmit",
      "exit 2, 1 error",
      "err"
     ],
     [
      "output files",
      "none"
     ]
    ]
   },
   {
    "l": 6,
    "tone": "warn",
    "say": "Plain <code>tsc</code> <b>still writes the .js</b> despite the error, unless <code>noEmitOnError</code> is set. Errors are advisory by default.",
    "env": [
     [
      "source",
      "price.ts"
     ],
     [
      "tsc",
      "1 error, but emitted",
      "warn"
     ],
     [
      "dist/price.js",
      "function total(p, qty)…"
     ]
    ]
   },
   {
    "l": 7,
    "tone": "warn",
    "say": "Node runs the emitted JS. Types are gone, so <code>\"9.99\" * 2</code> coerces to <code>19.98</code>. No runtime check ever happens.",
    "env": [
     [
      "dist/price.js",
      "types erased"
     ],
     [
      "node",
      "runs fine",
      "warn"
     ],
     [
      "result",
      "19.98 (by coercion)",
      "warn"
     ]
    ]
   }
  ]
 },
 {
  "label": "tsx / Node strip",
  "left": "price.ts",
  "right": "Pipeline",
  "code": [
   "function total(p: number, qty: number): number {",
   "  return p * qty;",
   "}",
   "total(\"9.99\", 2);",
   "",
   "// $ npx tsx price.ts",
   "// $ node --experimental-strip-types price.ts",
   "//   (flag needed on Node 22.6+; on by default later)"
  ],
  "steps": [
   {
    "l": 5,
    "tone": "warn",
    "say": "<b>tsx</b> transpiles each file with esbuild and runs it. Fast, but it <b>does not type-check</b>. The error is silently ignored.",
    "env": [
     [
      "tsx",
      "strip types → run",
      "warn"
     ],
     [
      "type errors",
      "not reported",
      "warn"
     ]
    ]
   },
   {
    "l": 6,
    "tone": "warn",
    "say": "Node 22.6+ can <b>strip</b> type annotations itself (replacing them with whitespace). Also no type-checking.",
    "env": [
     [
      "node",
      "strip types → run",
      "warn"
     ],
     [
      "type errors",
      "not reported",
      "warn"
     ]
    ]
   },
   {
    "l": 0,
    "say": "Stripping only works for <b>erasable</b> syntax: annotations, interfaces, type aliases, <code>as</code>. These can be deleted and the JS still works.",
    "env": [
     [
      "erasable",
      ": T, interface, type, as",
      "ok"
     ],
     [
      "not erasable",
      "enum, namespace, param props",
      "err"
     ]
    ]
   },
   {
    "l": 7,
    "tone": "ok",
    "say": "The usual split: <b>run</b> with tsx or Node stripping for speed, <b>check</b> with <code>tsc --noEmit</code> in the editor and in CI.",
    "env": [
     [
      "dev / run",
      "tsx or node",
      "ok"
     ],
     [
      "check",
      "tsc --noEmit (CI)",
      "ok"
     ],
     [
      "build",
      "tsc or a bundler",
      "ok"
     ]
    ]
   }
  ]
 },
 {
  "label": "tsconfig",
  "left": "tsconfig.json",
  "right": "What each option does",
  "code": [
   "{",
   "  \"compilerOptions\": {",
   "    \"target\": \"ES2022\",",
   "    \"module\": \"NodeNext\",",
   "    \"strict\": true,",
   "    \"noUncheckedIndexedAccess\": true,",
   "    \"outDir\": \"dist\",",
   "    \"noEmitOnError\": true",
   "  },",
   "  \"include\": [\"src\"]",
   "}"
  ],
  "steps": [
   {
    "l": 2,
    "say": "<code>target</code>: which JS version to emit. Newer syntax is down-levelled to it.",
    "env": [
     [
      "target",
      "output JS level"
     ]
    ]
   },
   {
    "l": 3,
    "say": "<code>module</code>/<code>moduleResolution</code>: how imports are resolved and emitted. <code>NodeNext</code> follows Node’s ESM/CJS rules.",
    "env": [
     [
      "target",
      "output JS level"
     ],
     [
      "module",
      "NodeNext = Node rules"
     ]
    ]
   },
   {
    "l": 4,
    "tone": "ok",
    "say": "<code>strict</code> turns on a family of checks, including <code>strictNullChecks</code> and <code>noImplicitAny</code>. Always on for new code.",
    "env": [
     [
      "target",
      "output JS level"
     ],
     [
      "module",
      "NodeNext = Node rules"
     ],
     [
      "strict",
      "null checks, no implicit any",
      "ok"
     ]
    ]
   },
   {
    "l": 5,
    "tone": "ok",
    "say": "<code>noUncheckedIndexedAccess</code> (not part of strict) makes <code>arr[i]</code> be <code>T | undefined</code>.",
    "env": [
     [
      "target",
      "output JS level"
     ],
     [
      "module",
      "NodeNext = Node rules"
     ],
     [
      "strict",
      "null checks, no implicit any",
      "ok"
     ],
     [
      "noUncheckedIndexedAccess",
      "arr[i]: T | undefined",
      "ok"
     ]
    ]
   },
   {
    "l": 7,
    "tone": "ok",
    "say": "<code>noEmitOnError</code>: refuse to write JS when there are type errors.",
    "env": [
     [
      "target",
      "output JS level"
     ],
     [
      "module",
      "NodeNext = Node rules"
     ],
     [
      "strict",
      "null checks, no implicit any",
      "ok"
     ],
     [
      "noUncheckedIndexedAccess",
      "arr[i]: T | undefined",
      "ok"
     ],
     [
      "noEmitOnError",
      "errors block output",
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

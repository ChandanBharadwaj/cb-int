/* Control flow & errors: the try/catch/finally path, for…of vs for…in, and switch fall-through. */
IA.widget('js-control-flow-errors', (root, ctx) => {
  /* ---- shared step-through player (code on the left, state picture on the right) ---- */
  const { el, svg, sleep, reduced } = ctx;
  function stepper(cfg) {
    const uid = 'nb' + Math.random().toString(36).slice(2, 8);
    if (!document.getElementById('w-nb-style')) {
      document.head.append(el('style', { id: 'w-nb-style', text: `
.w-nb-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; align-items: start; }
.w-nb-code pre { margin: 0; }
.w-nb-code .ln { display: block; padding: 0 6px; border-left: 3px solid transparent; border-radius: 3px; white-space: pre; }
.w-nb-code .ln.cur { background: var(--accent-soft); border-left-color: var(--accent); }
.w-nb-code .ln.done { opacity: .55; }
.w-nb .bx { fill: var(--surface); stroke: var(--border); }
.w-nb .bx.hot { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2; }
.w-nb .bx.ok { stroke: var(--ok); stroke-width: 2; }
.w-nb .bx.err { stroke: var(--err); stroke-width: 2; fill: color-mix(in srgb, var(--err) 10%, var(--surface)); }
.w-nb .bx.warn { stroke: var(--warn); stroke-width: 2; }
.w-nb .bx.dim { opacity: .45; }
.w-nb .bx.lane { fill: var(--surface-2); }
.w-nb .tt { fill: var(--text); font-size: 13px; font-family: var(--mono); }
.w-nb .tt.h { font-family: var(--sans); font-weight: 700; font-size: 13px; }
.w-nb .tt.m { fill: var(--text-3); font-size: 11px; font-family: var(--sans); }
.w-nb .tt.ok { fill: var(--ok); } .w-nb .tt.err { fill: var(--err); } .w-nb .tt.acc { fill: var(--accent); } .w-nb .tt.warn { fill: var(--warn); }
.w-nb .ar { stroke: var(--text-3); stroke-width: 1.6; fill: none; }
.w-nb .ar.hot { stroke: var(--accent); stroke-width: 2.2; }
.w-nb .fresh { animation: nbIn .45s ease both; }
@keyframes nbIn { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .w-nb .fresh { animation: none; } }
` }));
    }
    root.classList.add('w-nb');
    const modes = cfg.modes;
    let mi = 0; let k = 0; let gen = 0; let running = false; let speed = 2600;
    const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': cfg.modeLabel || 'Example' });
    modes.forEach((m, i) => { const b = el('button', { text: m.label, class: i === 0 ? 'on' : '' }); b.addEventListener('click', () => { mi = i; [...seg.children].forEach((x, j) => x.classList.toggle('on', j === i)); reset(); }); seg.append(b); });
    const pre = el('pre'); const codeHost = el('div', { class: 'codebox w-nb-code' }, el('div', { class: 'ch' }, el('span', { class: 'fname' })), pre);
    const W = cfg.W || 420, H = cfg.H || 300;
    const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': cfg.aria || 'Step-by-step picture of the program state' });
    const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('span', { class: 'n', text: '0' }), el('div', { class: 't', text: 'Press Play, or Step to go one line at a time.' }));
    const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
    const bStep = el('button', { class: 'btn', text: 'Step ›' });
    const bReset = el('button', { class: 'btn', text: '↺ Reset' });
    const segS = el('div', { class: 'seg', 'aria-label': 'Speed' });
    [['Slow', 3800], ['Normal', 2600], ['Fast', 1300]].forEach(([l, v]) => { const b = el('button', { text: l, class: v === speed ? 'on' : '' }); b.addEventListener('click', () => { speed = v; [...segS.children].forEach((x) => x.classList.toggle('on', x === b)); }); segS.append(b); });
    root.append(modes.length > 1 ? el('div', { class: 'w-controls' }, seg) : '',
      el('div', { class: 'w-nb-grid' }, codeHost, el('div', { class: 'w-stage' }, stage)),
      el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr);
    // drawing helpers handed to cfg.draw
    const defs = svg('defs', null, svg('marker', { id: uid + 'a', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--text-3)' })),
      svg('marker', { id: uid + 'h', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--accent)' })));
    const D = {
      box: (x, y, w, h, cls, fresh) => svg('rect', { x, y, width: w, height: h, rx: 7, class: 'bx ' + (cls || '') + (fresh ? ' fresh' : '') }),
      t: (x, y, s, cls, anchor, fresh) => svg('text', { x, y, class: 'tt ' + (cls || '') + (fresh ? ' fresh' : ''), 'text-anchor': anchor || 'start', text: String(s) }),
      ar: (x1, y1, x2, y2, hot, curve) => svg('path', { d: curve ? `M${x1},${y1} C${x1 + curve},${y1} ${x2 + curve},${y2} ${x2},${y2}` : `M${x1},${y1} L${x2},${y2}`, class: 'ar' + (hot ? ' hot' : ''), 'marker-end': `url(#${uid}${hot ? 'h' : 'a'})` }),
      W, H
    };
    let lineEls = [];
    function renderCode() {
      const m = modes[mi]; pre.innerHTML = '';
      codeHost.querySelector('.fname').textContent = m.file || 'example.js';
      lineEls = m.code.split('\n').map((ln) => { const s = el('span', { class: 'ln' }); s.innerHTML = IA.highlight(ln || ' ', m.lang || 'js'); pre.append(s); return s; });
    }
    function show(i) {
      const m = modes[mi]; const st = m.steps[i];
      lineEls.forEach((l, j) => { const cur = st && [].concat(st.line == null ? [] : st.line).includes(j + 1); l.classList.toggle('cur', cur); });
      stage.innerHTML = ''; stage.append(defs);
      const g = svg('g'); stage.append(g);
      cfg.draw(g, st || null, D, i, m);
      narr.className = 'caption' + (st && st.tone ? ' ' + st.tone : '');
      narr.firstChild.textContent = st ? `${i + 1}/${m.steps.length}` : '0';
      narr.lastChild.innerHTML = st ? st.cap : (m.intro || 'Press Play, or Step to go one line at a time.');
    }
    function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; renderCode(); if (reduced) { k = modes[mi].steps.length; show(k - 1); } else show(-1); }
    function step() { const n = modes[mi].steps.length; if (k >= n) return false; show(k); k++; return k < n; }
    async function play() {
      if (running) { gen++; running = false; bPlay.textContent = '▶ Play'; return; }
      if (k >= modes[mi].steps.length) reset();
      if (reduced) { k = modes[mi].steps.length; show(k - 1); return; }
      const g = ++gen; running = true; bPlay.textContent = '❚❚ Pause';
      while (g === gen && step()) { await sleep(speed); }
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    }
    bPlay.addEventListener('click', play);
    bStep.addEventListener('click', () => { gen++; running = false; bPlay.textContent = '▶ Play'; if (k >= modes[mi].steps.length) reset(); step(); });
    bReset.addEventListener('click', reset);
    reset();
  }
  // nodes: [label, cls]; out: console lines; vars: [k, v]
  const N = (hot, cls, labels) => labels.map((l, i) => [l, hot.includes(i) ? cls[hot.indexOf(i)] || 'hot' : (cls.dim && !hot.includes(i) ? 'dim' : '')]);
  const L = ['try { … }', 'throw new Error(…)', 'catch (e) { … }', 'finally { … }', 'return value'];
  const sA = [
    { line: 12, cap: '<code>load(0)</code> is called. <code>0</code> is falsy, so it will fail the check.', nodes: N([], [], L), out: [], vars: [['id', '0']] },
    { line: [2, 3], cap: 'Inside <code>try</code>, <code>!id</code> is true, so we <b>throw</b>. Any value can be thrown, but always throw an <code>Error</code>: it records a stack trace.', tone: 'err', nodes: N([0, 1], ['hot', 'err'], L), out: [], vars: [['id', '0']] },
    { line: [6, 7], cap: 'The rest of <code>try</code> is skipped. Control jumps to <code>catch</code>, where <code>e</code> is the Error. Unlike Java, there is one catch block and no exception types to list.', nodes: N([2], ['warn'], L), out: [], vars: [['id', '0'], ['e.message', "'id required'"]] },
    { line: 7, cap: '<code>return</code> in catch prepares the result… but <code>finally</code> must run first.', nodes: N([2, 4], ['warn', 'dim'], L), out: [], vars: [['pending return', "'failed: id required'"]] },
    { line: [8, 9], cap: '<code>finally</code> always runs: after success, after catch, even after a return. Use it for cleanup (close a file, release a lock), like Java.', nodes: N([3], ['hot'], L), out: ['cleanup'], vars: [['pending return', "'failed: id required'"]] },
    { line: 12, cap: 'Now the pending value is returned. Output: <code>cleanup</code>, then the caller gets <code>\'failed: id required\'</code>.', tone: 'ok', nodes: N([4], ['ok'], L), out: ['cleanup', "→ 'failed: id required'"], vars: [] },
    { line: 13, cap: '<code>load(7)</code>: no throw, so <code>catch</code> is skipped. <code>finally</code> still runs before the return value leaves the function.', tone: 'ok', nodes: N([0, 3, 4], ['hot', 'hot', 'ok'], L), out: ['cleanup', "→ 'failed: id required'", 'cleanup', "→ 'ok 7'"], vars: [['id', '7']] }
  ];
  const F = ["0: 'a'", "1: 'b'", "extra: 'x'"];
  const sB = [
    { line: [1, 2], cap: 'An array with an extra (non-index) property. Arrays are objects, so this is allowed, though unusual.', nodes: F.map((f) => [f, '']), out: [], vars: [] },
    { line: [3, 4], cap: '<code>for…of</code> walks the <b>values</b> of any iterable (arrays, strings, Maps, Sets). Like Java’s enhanced <code>for (String s : list)</code>.', nodes: [[F[0], 'hot'], [F[1], ''], [F[2], 'dim']], out: ['of: a'], vars: [['s', "'a'"]] },
    { line: [3, 4], cap: 'Index properties only, in order. The extra property is ignored.', tone: 'ok', nodes: [[F[0], ''], [F[1], 'hot'], [F[2], 'dim']], out: ['of: a', 'of: b'], vars: [['s', "'b'"]] },
    { line: [5, 6], cap: '<code>for…in</code> walks the <b>keys</b> of an object, as <b>strings</b>: <code>\'0\'</code>, not <code>0</code>.', tone: 'warn', nodes: [[F[0], 'warn'], [F[1], ''], [F[2], '']], out: ['of: a', 'of: b', "in: '0'"], vars: [['k', "'0'"]] },
    { line: [5, 6], cap: '…and every other enumerable property too, including inherited ones. That’s why <code>for…in</code> on arrays is a bug magnet.', tone: 'err', nodes: [[F[0], ''], [F[1], 'warn'], [F[2], 'err']], out: ['of: a', 'of: b', "in: '0'", "in: '1'", "in: 'extra'"], vars: [['k', "'extra'"]] },
    { line: [7, 8], cap: 'For objects, prefer <code>Object.entries(obj)</code> with <code>for…of</code>: own properties only, with keys and values together.', tone: 'ok', nodes: [['Object.entries(cfg)', 'ok']], out: ["in: 'extra'", 'port = 8080', 'host = db'], vars: [['[k, v]', "['host','db']"]] }
  ];
  const S = ["case 'GET':", "case 'HEAD':", "case 'POST':", 'default:'];
  const sC = [
    { line: 1, cap: '<code>switch</code> compares with <code>===</code>. <code>method</code> is \'GET\'.', nodes: S.map((s) => [s, '']), out: [], vars: [['method', "'GET'"]] },
    { line: [2, 3, 4], cap: '\'GET\' matches. Stacked cases share one body, as in Java’s classic switch.', nodes: [[S[0], 'hot'], [S[1], 'hot'], [S[2], ''], [S[3], '']], out: ['read'], vars: [['method', "'GET'"]] },
    { line: 5, cap: '<code>break</code> leaves the switch. Without it, execution <b>falls through</b> into the next case: there is no arrow-switch like Java 14+.', tone: 'ok', nodes: [[S[0], ''], [S[1], ''], [S[2], 'dim'], [S[3], 'dim']], out: ['read'], vars: [] },
    { line: [6, 7], cap: 'In the POST case the <code>break</code> was forgotten…', tone: 'warn', nodes: [[S[0], ''], [S[1], ''], [S[2], 'warn'], [S[3], '']], out: ['read', 'write'], vars: [['method', "'POST'"]] },
    { line: [8, 9], cap: '…so a POST also runs <code>default</code>. Fall-through bugs are why many teams prefer an object lookup or if/else chain. ESLint’s <code>no-fallthrough</code> catches it.', tone: 'err', nodes: [[S[0], ''], [S[1], ''], [S[2], 'warn'], [S[3], 'err']], out: ['read', 'write', 'unsupported'], vars: [['method', "'POST'"]] }
  ];
  stepper({
    W: 420, H: 300, aria: 'Control-flow boxes on the left, console output on the right',
    modes: [
      { label: 'try / catch / finally', code: "function load(id) {\n  try {\n    if (!id) throw new Error('id required');\n    return 'ok ' + id;\n  }\n  catch (e) {\n    return 'failed: ' + e.message;\n  } finally {\n    console.log('cleanup');\n  }\n}\nload(0);\nload(7);", steps: sA },
      { label: 'for…of vs for…in', code: "const arr = ['a', 'b'];\narr.extra = 'x';\nfor (const s of arr)\n  console.log('of:', s);\nfor (const k in arr)\n  console.log('in:', k);\nfor (const [k, v] of Object.entries(cfg))\n  console.log(k, '=', v);", steps: sB },
      { label: 'switch', code: "switch (method) {\n  case 'GET':\n  case 'HEAD':\n    console.log('read');\n    break;\n  case 'POST':\n    console.log('write');   // no break!\n  default:\n    console.log('unsupported');\n}", steps: sC }
    ],
    draw(g, st, D) {
      g.append(D.box(6, 6, 200, 288, 'lane'), D.t(16, 26, 'flow', 'h'), D.box(218, 6, 196, 180, 'lane'), D.t(228, 26, 'console', 'h'), D.box(218, 196, 196, 98, 'lane'), D.t(228, 216, 'variables', 'h'));
      if (!st) return;
      st.nodes.forEach(([l, c], i) => { const y = 40 + i * 50; g.append(D.box(16, y, 180, 36, c, c && c !== 'dim'), D.t(106, y + 23, l, c === 'err' ? 'err' : '', 'middle')); if (i) g.append(D.ar(106, y - 13, 106, y - 1, c === 'hot')); });
      st.out.slice(-7).forEach((o, i, a) => g.append(D.t(228, 50 + i * 20, o.length > 24 ? o.slice(0, 23) + '…' : o, o.startsWith('→') ? 'ok' : '', 'start', i === a.length - 1)));
      st.vars.slice(0, 2).forEach(([k, v], i) => g.append(D.t(228, 236 + i * 30, k, 'm'), D.t(228, 250 + i * 30, v.length > 24 ? v.slice(0, 23) + '…' : v)));
    }
  });
});

/* Variables & types: let/const/var scopes, values vs references, typeof and == vs ===. */
IA.widget('js-variables-types', (root, ctx) => {
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
  // state: vars [name, decl, value, cls, refId?], heap [id, label, cls], rows [expr, result, note, cls]
  const sA = [
    { line: 1, cap: '<code>var</code> is the old way. It is function-scoped and can be re-declared. You will see it in old code; don’t write it.', vars: [['a', 'var', '1', 'hot']] },
    { line: 2, cap: '<code>let</code> is block-scoped (lives inside the nearest <code>{ }</code>) and can be reassigned. Like a normal Java local variable.', vars: [['a', 'var', '1'], ['b', 'let', '2', 'hot']] },
    { line: 3, cap: '<code>const</code> is block-scoped and can’t be reassigned. Like Java’s <code>final</code>. Use it by default.', vars: [['a', 'var', '1'], ['b', 'let', '2'], ['c', 'const', '3', 'hot']] },
    { line: 4, cap: 'Reassigning a <code>let</code> is fine.', tone: 'ok', vars: [['a', 'var', '1'], ['b', 'let', '20', 'ok'], ['c', 'const', '3']] },
    { line: 5, cap: 'Reassigning a <code>const</code> throws <code>TypeError: Assignment to constant variable.</code> at runtime. There is no compiler to catch it earlier (TypeScript or a linter can).', tone: 'err', vars: [['a', 'var', '1'], ['b', 'let', '20'], ['c', 'const', '3', 'err']] },
    { line: [7, 8], cap: 'Inside a block, <code>let</code> creates a <b>new</b> variable that disappears at <code>}</code>. <code>var</code> ignores blocks, so a <code>var</code> declared in an <code>if</code> leaks out to the whole function.', vars: [['a', 'var', '1'], ['b', 'let', '20'], ['c', 'const', '3'], ['b (inner)', 'let', '99', 'hot']] },
    { line: 9, cap: 'Back outside the block, the inner <code>b</code> is gone and the outer <code>b</code> is still 20.', tone: 'ok', vars: [['a', 'var', '1'], ['b', 'let', '20', 'ok'], ['c', 'const', '3']] }
  ];
  const sB = [
    { line: 1, cap: 'A <b>primitive</b> (number, string, boolean, null, undefined, bigint, symbol) is stored right in the variable.', vars: [['x', 'let', '5', 'hot']] },
    { line: 2, cap: 'Assigning copies the value. <code>y</code> gets its own 5.', vars: [['x', 'let', '5'], ['y', 'let', '5', 'hot']] },
    { line: 3, cap: 'Changing <code>y</code> doesn’t touch <code>x</code>. Same as Java <code>int</code>.', vars: [['x', 'let', '5'], ['y', 'let', '6', 'ok']] },
    { line: 4, cap: 'An <b>object</b> lives on the heap. The variable holds a <b>reference</b> (an arrow), exactly like a Java object reference.', vars: [['x', 'let', '5'], ['y', 'let', '6'], ['p', 'const', '', 'hot', 'o1']], heap: [['o1', "{ name: 'Ada' }", 'hot']] },
    { line: 5, cap: '<code>q = p</code> copies the <b>arrow</b>, not the object. Now two variables point to one object.', vars: [['x', 'let', '5'], ['y', 'let', '6'], ['p', 'const', '', '', 'o1'], ['q', 'const', '', 'hot', 'o1']], heap: [['o1', "{ name: 'Ada' }"]] },
    { line: 6, cap: 'Mutating through <code>q</code> changes the shared object. <code>const</code> only stops <i>reassigning</i> q; it doesn’t freeze the object.', tone: 'warn', vars: [['x', 'let', '5'], ['y', 'let', '6'], ['p', 'const', '', '', 'o1'], ['q', 'const', '', '', 'o1']], heap: [['o1', "{ name: 'Bob' }", 'warn']] },
    { line: 7, cap: 'So this prints <code>5 Bob</code>: x was copied, p was shared.', tone: 'ok', vars: [['x', 'let', '5', 'ok'], ['y', 'let', '6'], ['p', 'const', '', 'ok', 'o1'], ['q', 'const', '', '', 'o1']], heap: [['o1', "{ name: 'Bob' }"]] }
  ];
  const TY = [["typeof 42", "'number'", 'ints and doubles are both number'], ["typeof 'hi'", "'string'", ''], ["typeof true", "'boolean'", ''], ["typeof undefined", "'undefined'", 'declared, never assigned'], ["typeof null", "'object'", 'a 1995 bug kept forever', 'warn'], ["typeof [1, 2]", "'object'", 'use Array.isArray()', 'warn'], ["typeof (() => 1)", "'function'", ''], ["typeof 10n", "'bigint'", 'arbitrary-size integer']];
  const sC = TY.map((r, i) => ({ line: i + 1, cap: r[2] ? `<code>${r[0]}</code> → <code>${r[1]}</code>: ${r[2]}.` : `<code>${r[0]}</code> → <code>${r[1]}</code>.`, tone: r[3], rows: TY.slice(0, i + 1).map((x, j) => [x[0], x[1], x[2], j === i ? 'hot' : x[3]]) }));
  const EQ = [["1 === 1", 'true', 'same type, same value', 'ok'], ["'1' === 1", 'false', '=== never converts types', 'ok'], ["'1' == 1", 'true', "== converts '1' to the number 1 first", 'warn'], ["0 == ''", 'true', "'' becomes 0", 'warn'], ["null == undefined", 'true', 'a special rule', 'warn'], ["null == 0", 'false', 'null only == null/undefined', 'warn'], ["NaN === NaN", 'false', 'use Number.isNaN(x)', 'err'], ["[1] === [1]", 'false', 'two different objects', 'err']];
  const sD = EQ.map((r, i) => ({ line: i + 1, cap: `<code>${r[0]}</code> is <b>${r[1]}</b>: ${r[2]}.`, tone: r[3], rows: EQ.slice(0, i + 1).map((x, j) => [x[0], x[1], x[2], j === i ? 'hot' : x[3]]) }));
  stepper({
    W: 420, H: 300, aria: 'Variables on the left, heap objects on the right',
    modes: [
      { label: 'let / const / var', code: "var a = 1;\nlet b = 2;\nconst c = 3;\nb = 20;\nc = 30;   // TypeError\n\nif (true) {\n  let b = 99;\n}\nconsole.log(b);   // 20", steps: sA },
      { label: 'values vs references', code: "let x = 5;\nlet y = x;\ny = 6;\nconst p = { name: 'Ada' };\nconst q = p;\nq.name = 'Bob';\nconsole.log(x, p.name); // 5 Bob", steps: sB },
      { label: 'typeof', code: TY.map((r) => r[0]).join('\n'), steps: sC },
      { label: '== vs ===', code: EQ.map((r) => r[0]).join('\n'), steps: sD }
    ],
    draw(g, st, D) {
      if (st && st.rows) {
        g.append(D.t(10, 20, 'expression', 'h'), D.t(170, 20, 'result', 'h'), D.t(250, 20, 'why', 'h'));
        st.rows.forEach(([e, r, n, c], i) => { const y = 30 + i * 33; g.append(D.box(6, y, 408, 28, c === 'hot' ? 'hot' : c || '', c === 'hot'), D.t(14, y + 18, e), D.t(170, y + 18, r, r === 'true' ? 'ok' : r === 'false' ? 'err' : 'acc'), D.t(250, y + 18, n.length > 26 ? n.slice(0, 25) + '…' : n, 'm')); });
        return;
      }
      g.append(D.box(6, 6, 190, 288, 'lane'), D.t(16, 26, 'variables', 'h'), D.box(214, 6, 200, 288, 'lane'), D.t(224, 26, 'heap (objects)', 'h'));
      if (!st) return;
      const pos = {};
      (st.heap || []).forEach(([id, label, c], i) => { const y = 90 + i * 60; pos[id] = y + 20; g.append(D.box(226, y, 178, 40, c || '', c === 'hot'), D.t(236, y + 25, label)); });
      st.vars.forEach(([n, decl, v, c, ref], i) => {
        const y = 38 + i * 36; g.append(D.box(14, y, 172, 30, c || '', c === 'hot'), D.t(22, y + 13, decl, 'm'), D.t(22, y + 26, n), D.t(178, y + 20, ref ? '●' : v, c === 'err' ? 'err' : 'acc', 'end'));
        if (ref) g.append(D.ar(184, y + 15, 224, pos[ref], c === 'hot'));
      });
    }
  });
});

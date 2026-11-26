/* Objects & arrays: a map/filter/reduce pipeline, destructuring and spread, and a JSON round trip. */
IA.widget('js-objects-arrays', (root, ctx) => {
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
  // rows: [label, [[chipText, cls], …]]
  const O = [['#1 30 ✓', ''], ['#2 15 ✗', ''], ['#3 50 ✓', ''], ['#4 5 ✓', '']];
  const sA = [
    { line: [1, 2, 3, 4, 5, 6], cap: 'An array of <b>object literals</b>. <code>{ id: 1, amt: 30, paid: true }</code> is like an instance of a tiny record, with no class needed.', rows: [['orders', O]] },
    { line: 8, cap: '<code>filter</code> calls the arrow once per element and keeps those that return true. It returns a <b>new</b> array; <code>orders</code> is untouched.', rows: [['orders', O.map(([t], i) => [t, i === 1 ? 'dim' : 'hot'])], ['.filter(o => o.paid)', [['#1 30', 'ok'], ['#3 50', 'ok'], ['#4 5', 'ok']]]] },
    { line: 9, cap: '<code>map</code> transforms each element: here object → its amount. Same length in, same length out.', rows: [['orders', O], ['.filter(o => o.paid)', [['#1 30', ''], ['#3 50', ''], ['#4 5', '']]], ['.map(o => o.amt)', [['30', 'hot'], ['50', 'hot'], ['5', 'hot']]]] },
    { line: 10, cap: '<code>reduce</code> folds the array into one value. The accumulator starts at <code>0</code> (the second argument): 0 + 30 = 30…', rows: [['orders', O], ['.filter(o => o.paid)', [['#1 30', ''], ['#3 50', ''], ['#4 5', '']]], ['.map(o => o.amt)', [['30', 'hot'], ['50', ''], ['5', '']]], ['.reduce((s, a) => s + a, 0)', [['acc = 30', 'warn']]]] },
    { line: 10, cap: '…30 + 50 = 80…', rows: [['orders', O], ['.filter(o => o.paid)', [['#1 30', ''], ['#3 50', ''], ['#4 5', '']]], ['.map(o => o.amt)', [['30', ''], ['50', 'hot'], ['5', '']]], ['.reduce((s, a) => s + a, 0)', [['acc = 80', 'warn']]]] },
    { line: [10, 11], cap: '…80 + 5 = <b>85</b>. Java’s <code>orders.stream().filter(…).mapToInt(…).sum()</code> is the same pipeline, but JavaScript array methods are <b>eager</b>: each step builds a full array.', tone: 'ok', rows: [['orders', O], ['.filter(o => o.paid)', [['#1 30', ''], ['#3 50', ''], ['#4 5', '']]], ['.map(o => o.amt)', [['30', ''], ['50', ''], ['5', 'hot']]], ['.reduce((s, a) => s + a, 0)', [['total = 85', 'ok']]]] }
  ];
  const U = [["id: 7", ''], ["name: 'Ada'", ''], ["city: 'Oslo'", '']];
  const sB = [
    { line: 1, cap: 'An object literal: keys and values. Keys are strings (quotes optional for simple names).', rows: [['user', U]] },
    { line: 2, cap: '<b>Destructuring</b> pulls properties out into variables by name. <code>...rest</code> collects what’s left into a new object.', rows: [['user', U.map(([t], i) => [t, i === 1 ? 'hot' : ''])], ['const { name, …rest }', [["name = 'Ada'", 'hot'], ["rest = { id: 7, city: 'Oslo' }", 'ok']]]] },
    { line: 3, cap: 'Array destructuring works by <b>position</b>. Skipping with a comma is allowed.', rows: [['user', U], ['const [first, , third]', [["first = 'a'", 'hot'], ["third = 'c'", 'hot']]]] },
    { line: 4, cap: '<b>Spread</b> copies properties into a new object. Later keys win, so <code>city</code> is overwritten. This is how you “update” immutably.', tone: 'ok', rows: [['user', U], ['{ …user, city: \'Pune\' }', [['id: 7', ''], ["name: 'Ada'", ''], ["city: 'Pune'", 'ok']]]] },
    { line: 5, cap: 'Spread is <b>shallow</b>. A nested object is still shared between the copy and the original, like a shallow <code>clone()</code> in Java.', tone: 'warn', rows: [['user', U], ['copy = { …user }', [['id: 7', ''], ["name: 'Ada'", ''], ["city: 'Oslo'", '']]], ['copy.tags === user.tags', [['true (shared!)', 'warn']]]] }
  ];
  const sC = [
    { line: [1, 2], cap: 'An object with a Date, a nested array and an <code>undefined</code> field.', rows: [['order', [['id: 1', ''], ['at: Date', ''], ['items: [2]', ''], ['note: undefined', '']]]] },
    { line: 3, cap: '<code>JSON.stringify</code> turns it into a <b>string</b>, the format of HTTP bodies. The Date becomes an ISO string; the <code>undefined</code> field is <b>dropped</b>.', tone: 'warn', rows: [['order', [['id: 1', ''], ['at: Date', 'warn'], ['items: [2]', ''], ['note: undefined', 'err']]], ['JSON text', [['{"id":1,"at":"2025-01-01T…","items":[2]}', 'hot']]]] },
    { line: 4, cap: '<code>JSON.parse</code> builds plain objects again. <code>at</code> is now a <b>string</b>, not a Date. JSON has no dates, so you convert them yourself (Jackson does this for you in Java).', tone: 'warn', rows: [['order', [['id: 1', ''], ['at: Date', ''], ['items: [2]', ''], ['note: undefined', '']]], ['JSON text', [['{"id":1,"at":"2025-01-01T…","items":[2]}', '']]], ['parsed', [['id: 1', 'ok'], ["at: '2025-…'", 'warn'], ['items: [2]', 'ok']]]] },
    { line: 5, cap: 'Invalid JSON throws a <code>SyntaxError</code>. Always wrap <code>JSON.parse</code> on untrusted input in try/catch.', tone: 'err', rows: [['JSON.parse("{bad}")', [['SyntaxError', 'err']]]] }
  ];
  stepper({
    W: 420, H: 300, aria: 'Rows of values showing each step of the data transformation',
    modes: [
      { label: 'map / filter / reduce', code: "const orders = [\n  { id: 1, amt: 30, paid: true },\n  { id: 2, amt: 15, paid: false },\n  { id: 3, amt: 50, paid: true },\n  { id: 4, amt: 5, paid: true },\n];\nconst total = orders\n  .filter((o) => o.paid)\n  .map((o) => o.amt)\n  .reduce((sum, a) => sum + a, 0);\nconsole.log(total); // 85", steps: sA },
      { label: 'destructuring & spread', code: "const user = { id: 7, name: 'Ada', city: 'Oslo' };\nconst { name, ...rest } = user;\nconst [first, , third] = ['a', 'b', 'c'];\nconst moved = { ...user, city: 'Pune' };\nconst copy = { ...user };  // shallow!", steps: sB },
      { label: 'JSON', code: "const order = { id: 1, at: new Date('2025-01-01'),\n  items: [2], note: undefined };\nconst text = JSON.stringify(order);\nconst back = JSON.parse(text);\nJSON.parse('{bad}');  // SyntaxError", steps: sC }
    ],
    draw(g, st, D) {
      if (!st) { g.append(D.t(210, 150, 'press Play', 'm', 'middle')); return; }
      st.rows.forEach(([label, chips], r) => {
        const y = 10 + r * 72;
        g.append(D.t(8, y + 14, label, 'acc'));
        const n = chips.length; const gap = 6; const w = n === 1 ? Math.max(130, Math.min(404, chips[0][0].length * 7.8 + 20)) : Math.min(130, (404 - gap * (n - 1)) / n);
        chips.forEach(([t, c], i) => {
          const x = 8 + i * (w + gap); const maxc = Math.floor(w / 7.6);
          g.append(D.box(x, y + 22, w, 34, c, c === 'hot' || c === 'ok'), D.t(x + w / 2, y + 44, t.length > maxc ? t.slice(0, maxc - 1) + '…' : t, c === 'err' ? 'err' : '', 'middle'));
        });
        if (r > 0) g.append(D.ar(400, y - 14, 400, y + 2));
      });
    }
  });
});

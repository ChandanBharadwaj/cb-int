/* Strings: the string pool vs plain heap Strings, constant folding, compact strings (LATIN1 vs UTF16) and concatenation in loops. */
IA.widget('strings-interning', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-jt-style')) {
    document.head.append(el('style', { id: 'w-jt-style', text: `
.jt-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 12px; align-items: start; }
@media (max-width: 760px) { .jt-grid { grid-template-columns: 1fr; } }
.jt-code { font-family: var(--mono); font-size: 12.5px; line-height: 1.6; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 0; overflow-x: auto; }
.jt-code div { padding: 0 10px; white-space: pre; border-left: 3px solid transparent; }
.jt-code div.on { background: var(--accent-soft); border-left-color: var(--accent); }
.jt-out { font-family: var(--mono); font-size: 12.5px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 6px 10px; margin-top: 8px; min-height: 2.2em; white-space: pre-wrap; }
.jt-out .h { font-size: 11px; color: var(--text-3); font-family: var(--sans); }
.jt-out .e { color: var(--err); }
.jt-box { fill: var(--surface); stroke: var(--border); stroke-width: 1.2; }
.jt-box.hot { stroke: var(--accent); stroke-width: 2; fill: var(--accent-soft); }
.jt-box.chg { stroke: var(--warn); stroke-width: 2; }
.jt-box.gc { stroke-dasharray: 4 3; opacity: .45; }
.jt-box.bad { stroke: var(--err); stroke-width: 2; }
.jt-box.ok { stroke: var(--ok); stroke-width: 2; }
.jt-box.frame { fill: var(--surface-2); }
.jt-arrow { fill: none; stroke: var(--accent); stroke-width: 1.8; }
.jt-arrow.chg { stroke: var(--warn); stroke-width: 2.4; }
.jt-arrow.gc { opacity: .35; }
` }));
  }
  // mem mode: v: [[name, '@ID' | text]], o: { ID: [x, y, value, pool?, cls] }, hot: [...]
  // bytes mode: b: [[label, coder, cells[], note, cls]]
  const SC = {
    pool: { label: 'Literal, new, intern()', code: [
      'String a = "hi";',
      'String b = "hi";',
      'String c = new String("hi");',
      'String d = c.intern();',
      'System.out.println((a == b) + " " + (a == c) + " " + (a == d));'],
    steps: [
      { l: 0, v: [['a', '@P1']], o: { P1: [260, 50, '"hi"', 1] }, hot: ['a', 'P1'], s: 'A string <b>literal</b> is resolved to a String in the <b>string pool</b>, a JVM-wide table of canonical Strings. The pool lives in the heap (since Java 7), so unused entries can be garbage-collected.' },
      { l: 1, v: [['a', '@P1'], ['b', '@P1']], o: { P1: [260, 50, '"hi"', 1] }, hot: ['b'], s: 'The same literal resolves to the <b>same</b> pooled object. Literals are interned automatically (JLS §3.10.5).' },
      { l: 2, v: [['a', '@P1'], ['b', '@P1'], ['c', '@H1']], o: { P1: [260, 50, '"hi"', 1], H1: [300, 190, '"hi"', 0, 'hot'] }, hot: ['c'], s: '<code>new String("hi")</code> always creates a <b>new</b> object outside the pool, with equal contents. (It may share the pooled string’s internal byte array.)' },
      { l: 3, v: [['a', '@P1'], ['b', '@P1'], ['c', '@H1'], ['d', '@P1']], o: { P1: [260, 50, '"hi"', 1, 'hot'], H1: [300, 190, '"hi"', 0] }, hot: ['d'], s: '<code>intern()</code> looks the contents up in the pool and returns the canonical instance, adding it first if it isn’t there.' },
      { l: 4, v: [['a', '@P1'], ['b', '@P1'], ['c', '@H1'], ['d', '@P1']], o: { P1: [260, 50, '"hi"', 1], H1: [300, 190, '"hi"', 0] }, hot: [], out: 'true false true', s: 'Prints <b>true false true</b>. Pooling is why <code>==</code> on Strings “works” in demos and fails on strings from user input, files, JSON or concatenation. Always use <code>equals</code>.' }
    ] },
    fold: { label: 'Constant folding', code: [
      'String a = "hello";',
      'String b = "hel" + "lo";         // folded by javac',
      'final String h = "hel";',
      'String c = h + "lo";             // still constant',
      'String p = "hel";',
      'String d = p + "lo";             // runtime concat',
      'System.out.println((a == b) + " " + (a == c) + " " + (a == d));'],
    steps: [
      { l: 0, v: [['a', '@P1']], o: { P1: [260, 50, '"hello"', 1] }, hot: ['a', 'P1'], s: 'A pooled literal.' },
      { l: 1, v: [['a', '@P1'], ['b', '@P1']], o: { P1: [260, 50, '"hello"', 1] }, hot: ['b'], s: '<code>"hel" + "lo"</code> is a <b>constant expression</b>. javac computes it at compile time and the class file contains the single literal <code>"hello"</code>, so it is the same pooled object.' },
      { l: 2, v: [['a', '@P1'], ['b', '@P1'], ['h', '@P2']], o: { P1: [260, 50, '"hello"', 1], P2: [385, 50, '"hel"', 1] }, hot: ['h'], s: 'A <code>final</code> local initialised with a constant is a <b>constant variable</b>.' },
      { l: 3, v: [['a', '@P1'], ['b', '@P1'], ['h', '@P2'], ['c', '@P1']], o: { P1: [260, 50, '"hello"', 1, 'hot'], P2: [385, 50, '"hel"', 1] }, hot: ['c'], s: 'So <code>h + "lo"</code> is still a constant expression, folded at compile time and pooled.' },
      { l: 4, v: [['a', '@P1'], ['b', '@P1'], ['h', '@P2'], ['c', '@P1'], ['p', '@P2']], o: { P1: [260, 50, '"hello"', 1], P2: [385, 50, '"hel"', 1] }, hot: ['p'], s: 'Same value, but <code>p</code> isn’t final, so it is not a constant variable.' },
      { l: 5, v: [['a', '@P1'], ['b', '@P1'], ['h', '@P2'], ['c', '@P1'], ['p', '@P2'], ['d', '@H1']], o: { P1: [260, 50, '"hello"', 1], P2: [385, 50, '"hel"', 1], H1: [300, 190, '"hello"', 0, 'hot'] }, hot: ['d'], s: 'Concatenation at <b>runtime</b> (via <code>invokedynamic</code> and <code>StringConcatFactory</code> since Java 9, JEP 280) builds a <b>new</b> String that is not pooled.' },
      { l: 6, v: [['a', '@P1'], ['b', '@P1'], ['h', '@P2'], ['c', '@P1'], ['p', '@P2'], ['d', '@H1']], o: { P1: [260, 50, '"hello"', 1], P2: [385, 50, '"hel"', 1], H1: [300, 190, '"hello"', 0] }, hot: [], out: 'true true false', s: 'Prints <b>true true false</b>. Removing one <code>final</code> keyword changes the result of <code>==</code>. Another reason never to compare Strings with it.' }
    ] },
    compact: { label: 'Compact strings', code: [
      'String a = "hello";   // every char ≤ U+00FF',
      'String b = "h€llo";   // € is U+20AC',
      'String c = "👍";       // U+1F44D, outside the BMP',
      'System.out.println(a.length() + " " + b.length() + " " + c.length());',
      'System.out.println(c.codePointCount(0, c.length()));'],
    steps: [
      { l: 0, b: [['"hello"', 'LATIN1', ['68', '65', '6C', '6C', '6F'], '5 bytes: 1 byte per char', 'hot']], s: 'Since Java 9 (JEP 254, <b>compact strings</b>) a String stores a <code>byte[]</code> plus a <code>coder</code>. If every char fits in Latin-1 (≤ U+00FF), it uses one byte per char.' },
      { l: 1, b: [['"hello"', 'LATIN1', ['68', '65', '6C', '6C', '6F'], '5 bytes'], ['"h€llo"', 'UTF16', ['0068', '20AC', '006C', '006C', '006F'], '10 bytes: one char above U+00FF', 'chg']], s: 'One character outside Latin-1 switches the <b>whole</b> string to UTF-16: two bytes per char. Mostly-ASCII text with one emoji or € sign doubles in size.' },
      { l: 2, b: [['"hello"', 'LATIN1', ['68', '65', '6C', '6C', '6F'], '5 bytes'], ['"h€llo"', 'UTF16', ['0068', '20AC', '006C', '006C', '006F'], '10 bytes'], ['"👍"', 'UTF16', ['D83D', 'DC4D'], 'one code point = a surrogate pair', 'bad']], s: 'A character outside the Basic Multilingual Plane (emoji, some CJK) needs <b>two</b> UTF-16 code units, a <b>surrogate pair</b>. Java’s <code>char</code> is a code unit, not a character.' },
      { l: 3, b: [['"hello"', 'LATIN1', ['68', '65', '6C', '6C', '6F'], 'length() 5'], ['"h€llo"', 'UTF16', ['0068', '20AC', '006C', '006C', '006F'], 'length() 5'], ['"👍"', 'UTF16', ['D83D', 'DC4D'], 'length() 2', 'bad']], out: '5 5 2', s: '<code>length()</code> counts UTF-16 code units, whatever the internal coder. Prints <b>5 5 2</b>: the thumbs-up has a length of 2.' },
      { l: 4, b: [['"hello"', 'LATIN1', ['68', '65', '6C', '6C', '6F'], 'length() 5'], ['"h€llo"', 'UTF16', ['0068', '20AC', '006C', '006C', '006F'], 'length() 5'], ['"👍"', 'UTF16', ['D83D', 'DC4D'], '1 code point', 'ok']], out: '1', s: 'Prints <b>1</b>. Use <code>codePoints()</code> to iterate characters, and never <code>substring</code> through the middle of a pair. What a user sees as one character can be even more code points (👍🏽 is two, a family emoji many); counting those needs <code>BreakIterator</code>.' }
    ] },
    loop: { label: '+= in a loop', code: [
      'String s = "";',
      'for (int i = 0; i < 3; i++) {',
      '  s += i;                   // a new String each time',
      '}',
      'var sb = new StringBuilder();',
      'for (int i = 0; i < 3; i++) sb.append(i);',
      'System.out.println(s + " " + sb);'],
    steps: [
      { l: 0, v: [['s', '@P1']], o: { P1: [260, 50, '""', 1] }, hot: ['s'], s: 'Start with the empty literal.' },
      { l: 2, v: [['s', '@H1'], ['i', '0']], o: { P1: [260, 50, '""', 1], H1: [260, 170, '"0"', 0, 'hot'] }, hot: ['s'], s: 'Strings are immutable, so <code>s += i</code> allocates a new String and copies the old characters into it.' },
      { l: 2, v: [['s', '@H2'], ['i', '1']], o: { P1: [260, 50, '""', 1], H1: [260, 170, '"0"', 0, 'gc'], H2: [390, 170, '"01"', 0, 'hot'] }, hot: ['s'], s: 'Again: copy 1 char, plus 1. The previous String becomes garbage.' },
      { l: 2, v: [['s', '@H3'], ['i', '2']], o: { P1: [260, 50, '""', 1], H1: [260, 170, '"0"', 0, 'gc'], H2: [390, 170, '"01"', 0, 'gc'], H3: [260, 230, '"012"', 0, 'hot'] }, hot: ['s'], s: 'Copy 2, plus 1. For n iterations that is about n²/2 characters copied. With 100,000 appends it is billions of copies.' },
      { l: 5, v: [['s', '@H3'], ['sb', '@B1']], o: { P1: [260, 50, '""', 1], H3: [260, 230, '"012"', 0], B1: [390, 230, 'buf[16] "012"', 0, 'hot'] }, hot: ['sb'], s: 'A <code>StringBuilder</code> appends into one growable buffer (default capacity 16, grown by roughly doubling), so the loop is amortised O(n).' },
      { l: 6, v: [['s', '@H3'], ['sb', '@B1']], o: { P1: [260, 50, '""', 1], H3: [260, 230, '"012"', 0], B1: [390, 230, 'buf[16] "012"', 0] }, hot: [], out: '012 012', s: 'Prints <b>012 012</b>. A single <code>a + b + c</code> expression is fine: it compiles to one indy call. The problem is <code>+=</code> inside a loop. Use StringBuilder, <code>String.join</code> or <code>Collectors.joining</code>.' }
    ] }
  };

  const ids = Object.keys(SC); let cur = ids[0]; let k = -1; let gen = 0; let running = false;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scenario' });
  ids.forEach((id) => { const b = el('button', { text: SC[id].label, class: id === cur ? 'on' : '' }); b.addEventListener('click', () => { cur = id; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const code = el('div', { class: 'jt-code' });
  const out = el('div', { class: 'jt-out', 'aria-label': 'Program output' });
  const W = 520, H = 300;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Local variables pointing at Strings inside or outside the string pool, or the bytes inside each String' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(el('div', { class: 'w-controls' }, seg),
    el('div', { class: 'jt-grid' }, el('div', null, code, out), el('div', { class: 'w-stage' }, stage)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 12, fill: 'var(--text)', 'font-family': 'var(--mono)', text: t }, o || {}));
  const H3 = (x, y, t) => T(x, y, t, { 'font-size': 11, fill: 'var(--text-3)', 'font-family': 'var(--sans)', 'font-weight': 700 });
  function drawMem(st) {
    stage.append(svg('defs', null, svg('marker', { id: 'jt-ah-st', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: 'var(--accent)' }))));
    stage.append(H3(8, 16, 'STACK: main()'), H3(250, 16, 'HEAP'));
    stage.append(svg('rect', { x: 248, y: 26, width: 266, height: 110, rx: 12, fill: 'var(--accent-soft)', stroke: 'var(--accent)', 'stroke-dasharray': '5 4' }), T(258, 128, 'string pool (canonical Strings)', { 'font-size': 10.5, fill: 'var(--accent)', 'font-family': 'var(--sans)' }));
    const hot = new Set(st.hot || []);
    const pos = {};
    Object.entries(st.o).forEach(([id, [x, y, val, , cls]]) => {
      pos[id] = { x, y };
      stage.append(svg('rect', { class: 'jt-box ' + (hot.has(id) ? 'hot ' : '') + (cls || ''), x, y, width: 118, height: 44, rx: 8 }));
      stage.append(T(x + 8, y + 14, 'String #' + id, { 'font-size': 9.5, fill: 'var(--text-3)' }), T(x + 59, y + 34, val, { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, opacity: cls === 'gc' ? 0.5 : 1 }));
    });
    st.v.forEach(([n, v], i) => {
      const y = 26 + i * 30; const h = hot.has(n);
      stage.append(svg('rect', { class: 'jt-box' + (h ? ' chg' : ''), x: 8, y, width: 150, height: 24, rx: 6 }), T(18, y + 16, n, { fill: 'var(--text-2)' }));
      if (v[0] === '@') {
        stage.append(svg('circle', { cx: 146, cy: y + 12, r: 4, fill: h ? 'var(--warn)' : 'var(--accent)' }));
        const o = pos[v.slice(1)]; if (!o) return;
        const x2 = o.x - 2, y2 = o.y + 22;
        const p = svg('path', { class: 'jt-arrow' + (h ? ' chg' : ''), d: `M150 ${y + 12} C 200 ${y + 12}, ${x2 - 50} ${y2}, ${x2} ${y2}`, 'marker-end': 'url(#jt-ah-st)' });
        if (h && !reduced) { p.style.strokeDasharray = '500'; p.style.strokeDashoffset = '500'; p.style.transition = 'stroke-dashoffset .8s ease'; requestAnimationFrame(() => { p.style.strokeDashoffset = '0'; }); }
        stage.append(p);
      } else stage.append(T(150, y + 16, v, { 'text-anchor': 'end' }));
    });
  }
  function drawBytes(st) {
    stage.append(H3(8, 16, 'INSIDE EACH STRING: byte[] value + coder'));
    st.b.forEach(([label, coder, cells, note, cls], i) => {
      const y = 28 + i * 88;
      const wide = coder === 'UTF16';
      stage.append(svg('rect', { class: 'jt-box ' + (cls || ''), x: 4, y, width: 512, height: 78, rx: 9 }));
      stage.append(T(14, y + 20, label, { 'font-size': 14, 'font-weight': 700 }), T(110, y + 20, 'coder = ' + coder, { 'font-size': 11.5, fill: wide ? 'var(--warn)' : 'var(--ok)' }), T(506, y + 20, note, { 'text-anchor': 'end', 'font-size': 10.5, fill: 'var(--text-2)', 'font-family': 'var(--sans)' }));
      const cw = wide ? 64 : 36;
      cells.forEach((c, j) => {
        const x = 14 + j * (cw + 6);
        if (wide) {
          stage.append(svg('rect', { class: 'jt-box frame', x, y: y + 32, width: cw / 2 - 1, height: 34, rx: 4 }), svg('rect', { class: 'jt-box frame', x: x + cw / 2 + 1, y: y + 32, width: cw / 2 - 1, height: 34, rx: 4 }));
          stage.append(T(x + cw / 4, y + 54, c.slice(0, 2), { 'text-anchor': 'middle', 'font-size': 11 }), T(x + cw * 3 / 4, y + 54, c.slice(2), { 'text-anchor': 'middle', 'font-size': 11 }));
        } else {
          stage.append(svg('rect', { class: 'jt-box frame', x, y: y + 32, width: cw, height: 34, rx: 4 }), T(x + cw / 2, y + 54, c, { 'text-anchor': 'middle', 'font-size': 11 }));
        }
      });
    });
    stage.append(T(8, 294, 'UTF16 pairs shown as code units; byte order in memory is platform-dependent', { 'font-size': 9.5, fill: 'var(--text-3)', 'font-family': 'var(--sans)' }));
  }
  function draw(st) {
    stage.innerHTML = '';
    if (!st) { stage.append(T(8, 40, 'press Play or Step', { fill: 'var(--text-3)', 'font-family': 'var(--sans)' })); return; }
    if (st.b) drawBytes(st); else drawMem(st);
  }
  function paint() {
    const S = SC[cur]; const st = k >= 0 ? S.steps[k] : null;
    code.innerHTML = '';
    S.code.forEach((ln, i) => code.append(el('div', { class: st && st.l === i ? 'on' : '', html: IA.highlight(ln, 'java') || ' ' })));
    out.innerHTML = ''; out.append(el('div', { class: 'h', text: 'stdout' }));
    S.steps.slice(0, k + 1).forEach((s) => { if (s.out) out.append(el('div', { text: s.out })); });
    draw(st);
    narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: st ? `${k + 1}/${S.steps.length}` : '0' }), el('div', { class: 't', html: st ? st.s : 'Pick a scenario, then press <b>Play</b> or <b>Step</b>. Arrows into the dashed pool region point at canonical, shared Strings.' }));
    bStep.disabled = k >= S.steps.length - 1;
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = -1; paint(); }
  function step() { const S = SC[cur]; if (k >= S.steps.length - 1) return false; k++; paint(); return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= SC[cur].steps.length - 1) k = -1;
    if (reduced) { k = SC[cur].steps.length - 1; paint(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(2600);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

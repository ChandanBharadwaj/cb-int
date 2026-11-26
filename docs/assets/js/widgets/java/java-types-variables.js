/* Variables & primitive types: boxes of fixed size, widening vs narrowing casts, overflow wrap-around and autoboxing. */
IA.widget('java-types-variables', (root, ctx) => {
  const ARIA = 'Variables shown as boxes with their type, size and current value, changing as each line of Java runs';
  const INTRO = 'Pick a scenario, then press <b>Play</b> or <b>Step</b>. Each box is a variable: its <b>type</b> and size on top, its value below. Orange = just changed, red = a surprise (overflow, lost data, null).';
  const SC = {
    prims: { label: 'Primitives', cols: 2, code: [
      'int age = 30;',
      'long views = 3_000_000_000L;',
      'double price = 9.99;',
      'boolean active = true;',
      "char grade = 'A';",
      'var name = "Ada";   // inferred: String'],
    steps: [
      { l: 0, b: [['int age · 32 bits', '30', 'hot']], s: '<code>int</code> holds whole numbers from about −2.1 billion to +2.1 billion. The type is fixed when you declare the variable.' },
      { l: 1, b: [['int age · 32 bits', '30', 'ok'], ['long views · 64 bits', '3000000000', 'hot']], s: '3 billion is too big for <code>int</code>, so use <code>long</code>. The <code>L</code> suffix makes the literal a long; <code>_</code> is only for readability.' },
      { l: 2, b: [['int age · 32 bits', '30', 'ok'], ['long views · 64 bits', '3000000000', 'ok'], ['double price · 64 bits', '9.99 (approx.)', 'hot']], s: '<code>double</code> is a binary floating-point number. It is close to 9.99, not exact. Fine for measurements; use <code>BigDecimal</code> for money.' },
      { l: 3, b: [['int age · 32 bits', '30', 'ok'], ['long views · 64 bits', '3000000000', 'ok'], ['double price · 64 bits', '9.99 (approx.)', 'ok'], ['boolean active', 'true', 'hot']], s: '<code>boolean</code> is only <code>true</code> or <code>false</code>. Unlike C, it is not a number: <code>if (1)</code> does not compile.' },
      { l: 4, b: [['int age · 32 bits', '30', 'ok'], ['long views · 64 bits', '3000000000', 'ok'], ['double price · 64 bits', '9.99 (approx.)', 'ok'], ['boolean active', 'true', 'ok'], ['char grade · 16 bits', "'A' (code 65)", 'hot']], s: '<code>char</code> is one UTF-16 code unit in single quotes. Under the hood it is the number 65, which is why <code>grade + 1</code> is 66.' },
      { l: 5, b: [['int age · 32 bits', '30', 'ok'], ['long views · 64 bits', '3000000000', 'ok'], ['double price · 64 bits', '9.99 (approx.)', 'ok'], ['boolean active', 'true', 'ok'], ['char grade · 16 bits', "'A' (code 65)", 'ok'], ['String name (var) → object', '"Ada"', 'hot']], s: '<code>var</code> (Java 10+) lets the compiler infer the type from the right-hand side. The type is still fixed: <code>name = 5;</code> would not compile. <code>String</code> is a class, not a primitive: the variable holds a reference to an object.' }
    ] },
    casts: { label: 'Casting', cols: 2, code: [
      'int i = 130;',
      'long l = i;            // widening: automatic',
      'double d = i;          // widening: automatic',
      'byte b = (byte) i;     // narrowing: explicit',
      'int t = (int) 3.99;    // drops the fraction',
      'long r = Math.round(3.99);'],
    steps: [
      { l: 0, b: [['int i', '130', 'hot']], s: 'Start with an <code>int</code>.' },
      { l: 1, b: [['int i', '130', 'ok'], ['long l', '130', 'hot']], s: '<b>Widening</b>: a small type into a bigger one. Nothing can be lost, so Java does it automatically.' },
      { l: 2, b: [['int i', '130', 'ok'], ['long l', '130', 'ok'], ['double d', '130.0', 'hot']], s: '<code>int</code> → <code>double</code> is also automatic. (Very large <code>long</code> values can lose precision going to <code>double</code>, but small ints are exact.)' },
      { l: 3, b: [['int i', '130', 'ok'], ['long l', '130', 'ok'], ['double d', '130.0', 'ok'], ['byte b · 8 bits', '-126', 'bad']], s: '<b>Narrowing</b> needs a cast, because data can be lost. A <code>byte</code> holds −128..127. Java keeps only the low 8 bits: 130 − 256 = <b>−126</b>. No error, no warning at run time.' },
      { l: 4, b: [['int i', '130', 'ok'], ['long l', '130', 'ok'], ['double d', '130.0', 'ok'], ['byte b · 8 bits', '-126', 'bad'], ['int t', '3', 'chg']], s: 'Casting <code>double</code> to <code>int</code> <b>truncates toward zero</b>. 3.99 becomes 3, and −3.99 would become −3.' },
      { l: 5, b: [['int i', '130', 'ok'], ['long l', '130', 'ok'], ['double d', '130.0', 'ok'], ['byte b · 8 bits', '-126', 'bad'], ['int t', '3', 'chg'], ['long r', '4', 'ok']], s: 'To round, call <code>Math.round</code>. It returns a <code>long</code> for a <code>double</code> argument, and rounds halves up (2.5 → 3, −2.5 → −2).' }
    ] },
    overflow: { label: 'Overflow', cols: 2, code: [
      'int max = Integer.MAX_VALUE;',
      'int next = max + 1;',
      'long ok = max + 1L;',
      'int safe = Math.addExact(max, 1);'],
    steps: [
      { l: 0, b: [['int max', '2147483647', 'hot']], s: '<code>Integer.MAX_VALUE</code> is 2³¹ − 1, the largest <code>int</code>.' },
      { l: 1, b: [['int max', '2147483647', 'ok'], ['int next', '-2147483648', 'bad']], s: 'Add one and it <b>wraps around</b> to the smallest <code>int</code>, like a car odometer rolling over. Java does not throw: the result is silently wrong.' },
      { l: 2, b: [['int max', '2147483647', 'ok'], ['int next', '-2147483648', 'bad'], ['long ok', '2147483648', 'ok']], s: 'Make one operand <code>long</code> (<code>1L</code>) and the whole sum is done in 64 bits. Correct.' },
      { l: 3, b: [['int max', '2147483647', 'ok'], ['int next', '-2147483648', 'bad'], ['long ok', '2147483648', 'ok'], ['int safe', 'ArithmeticException', 'bad']], out: 'Exception: integer overflow', s: '<code>Math.addExact</code> (also <code>multiplyExact</code>, <code>toIntExact</code>) throws instead of wrapping. Use it where a wrong number is worse than a crash, such as quantities and money in cents.' }
    ] },
    boxing: { label: 'Wrappers', cols: 2, code: [
      'int n = 42;',
      'Integer boxed = n;        // autoboxing',
      'int back = boxed;         // unboxing',
      'Integer a = 1000, b = 1000;',
      'boolean same = (a == b);  // compares references!',
      'Integer missing = null;',
      'int x = missing;          // unboxing null'],
    steps: [
      { l: 0, b: [['int n (primitive)', '42', 'hot']], s: 'A primitive stores the value directly.' },
      { l: 1, b: [['int n (primitive)', '42', 'ok'], ['Integer boxed → object', 'Integer[42]', 'hot']], s: '<b>Autoboxing</b>: Java wraps the int in an <code>Integer</code> object for you. Wrappers exist because collections like <code>List&lt;Integer&gt;</code> can only hold objects.' },
      { l: 2, b: [['int n (primitive)', '42', 'ok'], ['Integer boxed → object', 'Integer[42]', 'ok'], ['int back', '42', 'hot']], s: '<b>Unboxing</b> goes the other way, also automatic.' },
      { l: [3, 4], b: [['Integer a → object #1', 'Integer[1000]', 'ok'], ['Integer b → object #2', 'Integer[1000]', 'ok'], ['boolean same', 'false', 'bad']], s: '<code>==</code> on objects asks “same object?”, not “same value?”. Two separate <code>Integer</code> objects → <b>false</b>. (Values −128..127 are cached, so small numbers may look equal: a trap.) Use <code>a.equals(b)</code>.' },
      { l: [5, 6], b: [['Integer missing', 'null', 'chg'], ['int x', 'NullPointerException', 'bad']], out: 'Exception: NullPointerException', s: 'A wrapper can be <code>null</code>; a primitive cannot. Unboxing <code>null</code> throws a <code>NullPointerException</code>, often from a <code>Map.get</code> that found nothing.' }
    ] }
  };
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-jb-style')) {
    document.head.append(el('style', { id: 'w-jb-style', text: `
.jb-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; align-items: start; }
@media (max-width: 760px) { .jb-grid { grid-template-columns: 1fr; } }
.jb-code { font-family: var(--mono); font-size: 12.5px; line-height: 1.6; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 0; overflow-x: auto; }
.jb-code div { padding: 0 10px; white-space: pre; border-left: 3px solid transparent; }
.jb-code div.on { background: var(--accent-soft); border-left-color: var(--accent); }
.jb-out { font-family: var(--mono); font-size: 12.5px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 6px 10px; margin-top: 8px; min-height: 2.2em; white-space: pre-wrap; }
.jb-out .h { font-size: 11px; color: var(--text-3); font-family: var(--sans); }
.jb-box { fill: var(--surface); stroke: var(--border); stroke-width: 1.2; }
.jb-box.hot { stroke: var(--accent); stroke-width: 2; fill: var(--accent-soft); }
.jb-box.chg { stroke: var(--warn); stroke-width: 2; }
.jb-box.bad { stroke: var(--err); stroke-width: 2; }
.jb-box.ok { stroke: var(--ok); stroke-width: 2; }
.jb-box.gc { stroke-dasharray: 4 3; opacity: .5; }
` }));
  }
  const ids = Object.keys(SC); let cur = ids[0]; let k = -1; let gen = 0; let running = false;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scenario' });
  ids.forEach((id) => { const b = el('button', { text: SC[id].label, class: id === cur ? 'on' : '' }); b.addEventListener('click', () => { cur = id; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const code = el('div', { class: 'jb-code' });
  const out = el('div', { class: 'jb-out', 'aria-label': 'Program output' });
  const W = 520;
  const stage = svg('svg', { viewBox: `0 0 ${W} 120`, role: 'img', 'aria-label': ARIA });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(el('div', { class: 'w-controls' }, seg),
    el('div', { class: 'jb-grid' }, el('div', null, code, out), el('div', { class: 'w-stage' }, stage)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);
  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 12, fill: 'var(--text)', 'font-family': 'var(--mono)', text: t }, o || {}));
  function draw(S, st) {
    stage.innerHTML = '';
    const cols = S.cols || 2; const gap = 8; const bw = (W - 8 - gap * (cols - 1)) / cols; const bh = S.bh || 50;
    const boxes = st ? st.b : [];
    const rows = Math.max(1, Math.ceil(boxes.length / cols));
    stage.setAttribute('viewBox', `0 0 ${W} ${30 + rows * (bh + gap)}`);
    stage.append(T(6, 16, S.head || 'variables in memory', { 'font-size': 10.5, fill: 'var(--text-3)', 'font-family': 'var(--sans)', 'font-weight': 700 }));
    boxes.forEach(([lab, val, cls], i) => {
      const x = 4 + (i % cols) * (bw + gap); const y = 24 + Math.floor(i / cols) * (bh + gap);
      const r = svg('rect', { class: 'jb-box ' + (cls || ''), x, y, width: bw, height: bh, rx: 7 });
      stage.append(r, T(x + 8, y + 16, lab, { 'font-size': 10, fill: cls === 'bad' ? 'var(--err)' : cls === 'chg' ? 'var(--warn)' : 'var(--text-3)', 'font-family': 'var(--sans)', 'font-weight': 700 }),
        T(x + 8, y + 36, val, { 'font-size': 12.5 }));
      if (cls && st === S.steps[k] && !reduced) { r.style.transition = 'opacity .35s'; r.style.opacity = '0.2'; requestAnimationFrame(() => { r.style.opacity = '1'; }); }
    });
    if (!st) stage.append(T(8, 50, 'press Play or Step', { fill: 'var(--text-3)', 'font-family': 'var(--sans)', 'font-size': 11 }));
  }
  function paint() {
    const S = SC[cur]; const st = k >= 0 ? S.steps[k] : null;
    const on = st ? [].concat(st.l) : [];
    code.innerHTML = '';
    S.code.forEach((ln, i) => code.append(el('div', { class: on.includes(i) ? 'on' : '', html: IA.highlight(ln, S.lang || 'java') || ' ' })));
    out.innerHTML = ''; out.append(el('div', { class: 'h', text: S.outHead || 'stdout' }));
    S.steps.slice(0, k + 1).forEach((s) => { if (s.out) out.append(el('div', { text: s.out })); });
    draw(S, st);
    narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: st ? `${k + 1}/${S.steps.length}` : '0' }), el('div', { class: 't', html: st ? st.s : INTRO }));
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

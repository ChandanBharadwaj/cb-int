/* Sealed types & pattern matching: feed a value into a pattern switch and watch each case test its type, deconstruct and check its guard. Toggle a new permitted subtype to see exhaustiveness fail. */
IA.widget('sealed-pattern-matching', (root, ctx) => {
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
  const fmt = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));
  const INPUTS = [
    { label: 'Circle(0)', t: 'Circle', v: { r: 0 } },
    { label: 'Circle(2)', t: 'Circle', v: { r: 2 } },
    { label: 'Rect(3, 3)', t: 'Rect', v: { w: 3, h: 3 } },
    { label: 'Rect(2, 5)', t: 'Rect', v: { w: 2, h: 5 } },
    { label: 'Square(1)', t: 'Square', v: { side: 1 } },
    { label: 'null', t: 'null', v: null }
  ];
  const BASE = [
    'sealed interface Shape permits Circle, Square, Rect {}',
    'record Circle(double r) implements Shape {}',
    'record Square(double side) implements Shape {}',
    'record Rect(double w, double h) implements Shape {}',
    '',
    'static String describe(Shape s) {',
    '  return switch (s) {',
    '    case null -> "nothing";',
    '    case Circle c when c.r() == 0 -> "a point";',
    '    case Circle c -> "circle r=" + c.r();',
    '    case Rect(double w, double h) when w == h -> "square-ish " + w;',
    '    case Rect(var w, var h) -> "rect " + w + "x" + h;',
    '    case Square sq -> "square " + sq.side();',
    '  };',
    '}'];
  const CASES = [
    { line: 7, short: 'case null', t: 'null', res: () => 'nothing' },
    { line: 8, short: 'case Circle c when c.r() == 0', t: 'Circle', bind: (v) => `c = Circle[r=${fmt(v.r)}]`, guard: (v) => v.r === 0, gt: (v) => `c.r() == 0 → ${fmt(v.r)} == 0`, res: () => 'a point' },
    { line: 9, short: 'case Circle c', t: 'Circle', bind: (v) => `c = Circle[r=${fmt(v.r)}]`, res: (v) => 'circle r=' + fmt(v.r) },
    { line: 10, short: 'case Rect(double w, double h) when w == h', t: 'Rect', bind: (v) => `deconstruct: w = ${fmt(v.w)}, h = ${fmt(v.h)}`, guard: (v) => v.w === v.h, gt: (v) => `w == h → ${fmt(v.w)} == ${fmt(v.h)}`, res: (v) => 'square-ish ' + fmt(v.w) },
    { line: 11, short: 'case Rect(var w, var h)', t: 'Rect', bind: (v) => `deconstruct: w = ${fmt(v.w)}, h = ${fmt(v.h)}`, res: (v) => 'rect ' + fmt(v.w) + 'x' + fmt(v.h) },
    { line: 12, short: 'case Square sq', t: 'Square', bind: (v) => `sq = Square[side=${fmt(v.side)}]`, res: (v) => 'square ' + fmt(v.side) }
  ];
  let inp = 1; let tri = false; let k = -1; let gen = 0; let running = false; let steps = [];

  const segIn = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Input value' });
  INPUTS.forEach((x, i) => { const b = el('button', { text: 'describe(' + (x.t === 'null' ? 'null' : 'new ' + x.label) + ')', class: i === inp ? 'on' : '' }); b.addEventListener('click', () => { inp = i; [...segIn.children].forEach((y) => y.classList.toggle('on', y === b)); reset(); }); segIn.append(b); });
  const segTri = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Hierarchy' });
  [[false, 'permits Circle, Square, Rect'], [true, '+ add Triangle to permits']].forEach(([v, l]) => { const b = el('button', { text: l, class: v === tri ? 'on' : '' }); b.addEventListener('click', () => { tri = v; [...segTri.children].forEach((y) => y.classList.toggle('on', y === b)); reset(); }); segTri.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const code = el('div', { class: 'jt-code' });
  const out = el('div', { class: 'jt-out', 'aria-label': 'Result' });
  const W = 520, H = 300;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'The sealed hierarchy on top, the switch cases below with the result of each test' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(el('div', { class: 'w-controls' }, segIn), el('div', { class: 'w-controls' }, segTri),
    el('div', { class: 'jt-grid' }, el('div', null, code, out), el('div', { class: 'w-stage' }, stage)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  function codeLines() {
    const c = BASE.slice();
    if (tri) { c[0] = 'sealed interface Shape permits Circle, Square, Rect, Triangle {}'; c.splice(4, 0, 'record Triangle(double b, double h) implements Shape {}'); }
    return c;
  }
  const off = () => (tri ? 1 : 0);
  function plan() {
    const x = INPUTS[inp]; const st = [];
    if (tri) {
      st.push({ l: 6 + off(), marks: {}, node: 'Triangle', s: '<b>Compile error</b>: “the switch expression does not cover all possible input values”. Shape now allows Triangle, and no case handles it. Sealing lets the compiler <b>prove</b> every case is covered. So a new subtype breaks every switch that forgot it, at compile time. A <code>default</code> branch would hide this. Don’t add one to a switch over a sealed type.', out: ['error: the switch expression does not cover all possible input values', 1] });
      return st;
    }
    st.push({ l: 6, marks: {}, node: x.t, s: `The selector is <code>${x.t === 'null' ? 'null' : x.label}</code>. Cases are tried <b>top to bottom</b>. The first one whose pattern matches and whose guard is true wins.` });
    const marks = {};
    for (let i = 0; i < CASES.length; i++) {
      const c = CASES[i];
      const typeOk = c.t === x.t;
      if (!typeOk) {
        marks[i] = ['✗ type', 'bad'];
        st.push({ l: c.line, marks: { ...marks }, cur: i, node: x.t, s: x.t === 'null' && i > 0 ? '' : `<code>${c.short.replace(/</g, '&lt;')}</code>: the value is not a ${c.t === 'null' ? 'null' : c.t}, so this case doesn’t match.` });
        continue;
      }
      if (c.t === 'null') {
        marks[i] = ['✓ match', 'ok'];
        st.push({ l: c.line, marks: { ...marks }, cur: i, node: 'null', s: '<code>case null</code> (Java 21) handles null inside the switch. Without it, a pattern switch on null throws <b>NullPointerException</b>, just as old-style switches always did.', done: true, res: c.res() });
        break;
      }
      marks[i] = ['✓ type', 'hot'];
      st.push({ l: c.line, marks: { ...marks }, cur: i, node: x.t, s: `Type matches. ${c.bind(x.v)}. ${c.line === 10 || c.line === 11 ? 'A <b>record pattern</b> (Java 21) unpacks the record’s fields into variables. Patterns can nest.' : 'A <b>type pattern</b> binds the value, already cast, to a new variable.'}` });
      if (c.guard) {
        const g = c.guard(x.v);
        marks[i] = [g ? '✓ guard' : '✗ guard', g ? 'ok' : 'chg'];
        st.push({ l: c.line, marks: { ...marks }, cur: i, node: x.t, s: `Guard <code>when ${c.gt(x.v)}</code> is <b>${g}</b>. ${g ? '' : 'The pattern matched, but the condition is false, so try the next case.'}` });
        if (!g) continue;
      }
      marks[i] = ['✓ match', 'ok'];
      st.push({ l: c.line, marks: { ...marks }, cur: i, node: x.t, done: true, res: c.res(x.v), s: `Selected. The switch evaluates to <code>"${c.res(x.v)}"</code>. No fall-through: arrow cases run exactly one branch.` });
      break;
    }
    return st.filter((s) => s.s !== '');
  }

  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 11.5, fill: 'var(--text)', 'font-family': 'var(--mono)', text: t }, o || {}));
  function draw(st) {
    stage.innerHTML = '';
    // hierarchy
    const kids = ['Circle', 'Square', 'Rect'].concat(tri ? ['Triangle'] : []);
    stage.append(svg('rect', { class: 'jt-box frame' + (st && st.node === 'null' ? ' gc' : ''), x: 170, y: 8, width: 180, height: 34, rx: 8 }),
      T(260, 23, 'sealed interface', { 'text-anchor': 'middle', 'font-size': 9.5, fill: 'var(--text-3)', 'font-family': 'var(--sans)' }), T(260, 37, 'Shape', { 'text-anchor': 'middle', 'font-weight': 700 }));
    const kw = 116, gap = (520 - kids.length * kw) / (kids.length + 1);
    kids.forEach((n, i) => {
      const x = gap + i * (kw + gap);
      const hit = st && st.node === n;
      const isTri = n === 'Triangle';
      stage.append(svg('path', { d: `M260 42 L${x + kw / 2} 72`, stroke: isTri ? 'var(--err)' : 'var(--border)', 'stroke-width': 1.5, fill: 'none', 'stroke-dasharray': isTri ? '4 3' : null }));
      stage.append(svg('rect', { class: 'jt-box ' + (isTri ? 'bad' : hit ? 'hot' : ''), x, y: 72, width: kw, height: 30, rx: 7 }), T(x + kw / 2, 91, 'record ' + n, { 'text-anchor': 'middle', 'font-size': 11 }));
    });
    stage.append(T(8, 122, tri ? 'case labels: Triangle is not covered' : 'case labels (first match wins)', { 'font-family': 'var(--sans)', 'font-weight': 700, 'font-size': 11, fill: tri ? 'var(--err)' : 'var(--text-3)' }));
    CASES.forEach((c, i) => {
      const y = 130 + i * 27;
      const m = st && st.marks ? st.marks[i] : null;
      const isCur = st && st.cur === i;
      stage.append(svg('rect', { class: 'jt-box ' + (isCur ? 'hot' : m && m[1] === 'bad' ? 'gc' : ''), x: 4, y, width: 420, height: 23, rx: 6 }), T(12, y + 16, c.short, { 'font-size': 11 }));
      if (m) stage.append(svg('rect', { class: 'jt-box ' + m[1], x: 430, y, width: 86, height: 23, rx: 6 }), T(473, y + 16, m[0], { 'text-anchor': 'middle', 'font-size': 11, 'font-family': 'var(--sans)', fill: m[1] === 'bad' ? 'var(--err)' : m[1] === 'chg' ? 'var(--warn)' : m[1] === 'ok' ? 'var(--ok)' : 'var(--accent)' }));
    });
  }
  function paint() {
    const st = k >= 0 ? steps[k] : null;
    code.innerHTML = '';
    codeLines().forEach((ln, i) => code.append(el('div', { class: st && st.l === i ? 'on' : '', html: IA.highlight(ln, 'java') || ' ' })));
    out.innerHTML = ''; out.append(el('div', { class: 'h', text: tri ? 'javac' : 'result' }));
    steps.slice(0, k + 1).forEach((s) => { if (s.out) out.append(el('div', { class: s.out[1] ? 'e' : '', text: s.out[0] })); if (s.res != null) out.append(el('div', { text: '"' + s.res + '"' })); });
    draw(st);
    narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: st ? `${k + 1}/${steps.length}` : '0' }), el('div', { class: 't', html: st ? st.s : 'Choose an input, then press <b>Play</b> or <b>Step</b> to watch each case test its pattern and guard. Then add <b>Triangle</b> to the sealed hierarchy.' }));
    bStep.disabled = k >= steps.length - 1;
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = -1; steps = plan(); paint(); }
  function step() { if (k >= steps.length - 1) return false; k++; paint(); return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length - 1) k = -1;
    if (reduced) { k = steps.length - 1; paint(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(2200);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

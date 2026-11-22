/* References & pass-by-value: step through stack frames and heap objects, with arrows for every reference. */
IA.widget('references-pass-by-value', (root, ctx) => {
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
.jt-box.frame { fill: var(--surface-2); }
.jt-arrow { fill: none; stroke: var(--accent); stroke-width: 1.8; }
.jt-arrow.chg { stroke: var(--warn); stroke-width: 2.4; }
.jt-arrow.gc { opacity: .35; }
` }));
  }
  const MAIN = 'public static void main(String[] args) {';
  // value '@ID' = a reference to heap object ID. hot: names to highlight ("frame.var" or object id)
  const SC = {
    swap: { label: 'Reassign a parameter', code: [
      MAIN,
      '  Point p = new Point(1, 1);',
      '  Point q = new Point(9, 9);',
      '  swap(p, q);',
      '  System.out.println(p.x);',
      '}',
      'static void swap(Point a, Point b) {',
      '  Point t = a;',
      '  a = b;',
      '  b = t;',
      '}'],
    steps: [
      { l: 1, f: [['main', [['p', '@P1']]]], h: { P1: [40, 'Point', [['x', '1'], ['y', '1']]] }, hot: ['main.p', 'P1'], s: '<code>new Point(1, 1)</code> is created on the <b>heap</b>. The local variable <code>p</code> lives in main’s <b>stack frame</b> and holds only a reference (think: an address) to it.' },
      { l: 2, f: [['main', [['p', '@P1'], ['q', '@P2']]]], h: { P1: [40, 'Point', [['x', '1'], ['y', '1']]], P2: [150, 'Point', [['x', '9'], ['y', '9']]] }, hot: ['main.q', 'P2'], s: 'A second object, a second reference.' },
      { l: 3, f: [['main', [['p', '@P1'], ['q', '@P2']]], ['swap', [['a', '@P1'], ['b', '@P2']]]], h: { P1: [40, 'Point', [['x', '1'], ['y', '1']]], P2: [150, 'Point', [['x', '9'], ['y', '9']]] }, hot: ['swap.a', 'swap.b'], s: 'Calling <code>swap</code> pushes a new frame and <b>copies the values</b> of <code>p</code> and <code>q</code> into the parameters <code>a</code> and <code>b</code>. Those values are references, so now two variables point at each object.' },
      { l: 7, f: [['main', [['p', '@P1'], ['q', '@P2']]], ['swap', [['a', '@P1'], ['b', '@P2'], ['t', '@P1']]]], h: { P1: [40, 'Point', [['x', '1'], ['y', '1']]], P2: [150, 'Point', [['x', '9'], ['y', '9']]] }, hot: ['swap.t'], s: '<code>t = a</code> copies a reference. No object is copied.' },
      { l: 8, f: [['main', [['p', '@P1'], ['q', '@P2']]], ['swap', [['a', '@P2'], ['b', '@P2'], ['t', '@P1']]]], h: { P1: [40, 'Point', [['x', '1'], ['y', '1']]], P2: [150, 'Point', [['x', '9'], ['y', '9']]] }, hot: ['swap.a'], s: '<code>a = b</code> re-points swap’s <i>own</i> variable <code>a</code>. main’s <code>p</code> is a different slot and does not move.' },
      { l: 9, f: [['main', [['p', '@P1'], ['q', '@P2']]], ['swap', [['a', '@P2'], ['b', '@P1'], ['t', '@P1']]]], h: { P1: [40, 'Point', [['x', '1'], ['y', '1']]], P2: [150, 'Point', [['x', '9'], ['y', '9']]] }, hot: ['swap.b'], s: 'Inside swap the references are now crossed. Only swap’s copies changed.' },
      { l: 10, f: [['main', [['p', '@P1'], ['q', '@P2']]]], h: { P1: [40, 'Point', [['x', '1'], ['y', '1']]], P2: [150, 'Point', [['x', '9'], ['y', '9']]] }, hot: [], s: 'swap returns. Its frame, with <code>a</code>, <code>b</code> and <code>t</code>, is thrown away. Nothing in main ever changed.' },
      { l: 4, f: [['main', [['p', '@P1'], ['q', '@P2']]]], h: { P1: [40, 'Point', [['x', '1'], ['y', '1']]], P2: [150, 'Point', [['x', '9'], ['y', '9']]] }, hot: ['main.p', 'P1'], out: '1', s: 'Prints <b>1</b>. Java passes references <b>by value</b>: a method can never re-point its caller’s variables, so a classic <code>swap</code> is impossible.' }
    ] },
    mutate: { label: 'Mutate through a parameter', code: [
      MAIN,
      '  Point p = new Point(1, 1);',
      '  move(p);',
      '  System.out.println(p.x);',
      '}',
      'static void move(Point a) {',
      '  a.x = 5;',
      '  a = new Point(7, 7);',
      '  a.x = 8;',
      '}'],
    steps: [
      { l: 1, f: [['main', [['p', '@P1']]]], h: { P1: [40, 'Point', [['x', '1'], ['y', '1']]] }, hot: ['main.p', 'P1'], s: 'One Point on the heap, referenced by <code>p</code>.' },
      { l: 2, f: [['main', [['p', '@P1']]], ['move', [['a', '@P1']]]], h: { P1: [40, 'Point', [['x', '1'], ['y', '1']]] }, hot: ['move.a'], s: 'The call copies the reference into <code>a</code>. Caller and callee now share <b>one object</b>.' },
      { l: 6, f: [['main', [['p', '@P1']]], ['move', [['a', '@P1']]]], h: { P1: [40, 'Point', [['x', '5', 1], ['y', '1']]] }, hot: ['P1'], s: '<code>a.x = 5</code> follows the reference and writes into the shared object. main will see this.' },
      { l: 7, f: [['main', [['p', '@P1']]], ['move', [['a', '@P2']]]], h: { P1: [40, 'Point', [['x', '5'], ['y', '1']]], P2: [150, 'Point', [['x', '7'], ['y', '7']]] }, hot: ['move.a', 'P2'], s: '<code>a = new Point(7, 7)</code> re-points only the local <code>a</code>. From here on, writes through <code>a</code> go somewhere main cannot see.' },
      { l: 8, f: [['main', [['p', '@P1']]], ['move', [['a', '@P2']]]], h: { P1: [40, 'Point', [['x', '5'], ['y', '1']]], P2: [150, 'Point', [['x', '8', 1], ['y', '7']]] }, hot: ['P2'], s: 'This write lands on the new object.' },
      { l: 9, f: [['main', [['p', '@P1']]]], h: { P1: [40, 'Point', [['x', '5'], ['y', '1']]], P2: [150, 'Point', [['x', '8'], ['y', '7']], 'gc'] }, hot: [], s: 'move returns. The second Point has no references left, so it is <b>unreachable</b>: garbage for the GC.' },
      { l: 3, f: [['main', [['p', '@P1']]]], h: { P1: [40, 'Point', [['x', '5'], ['y', '1']]], P2: [150, 'Point', [['x', '8'], ['y', '7']], 'gc'] }, hot: ['main.p', 'P1'], out: '5', s: 'Prints <b>5</b>. Mutating the object is visible to the caller. Reassigning the parameter is not.' }
    ] },
    eq: { label: '== vs equals', code: [
      MAIN,
      '  String a = new String("hi");',
      '  String b = new String("hi");',
      '  String c = a;',
      '  System.out.println(a == b);',
      '  System.out.println(a.equals(b));',
      '  System.out.println(a == c);',
      '}'],
    steps: [
      { l: 1, f: [['main', [['a', '@S1']]]], h: { S1: [40, 'String', [['value', '"hi"']]] }, hot: ['main.a', 'S1'], s: '<code>new String(…)</code> always creates a fresh object on the heap.' },
      { l: 2, f: [['main', [['a', '@S1'], ['b', '@S2']]]], h: { S1: [40, 'String', [['value', '"hi"']]], S2: [130, 'String', [['value', '"hi"']]] }, hot: ['main.b', 'S2'], s: 'Another fresh object with the same characters. Equal contents, different identity.' },
      { l: 3, f: [['main', [['a', '@S1'], ['b', '@S2'], ['c', '@S1']]]], h: { S1: [40, 'String', [['value', '"hi"']]], S2: [130, 'String', [['value', '"hi"']]] }, hot: ['main.c'], s: '<code>c = a</code> copies the reference: <code>a</code> and <code>c</code> are <b>aliases</b> for one object.' },
      { l: 4, f: [['main', [['a', '@S1'], ['b', '@S2'], ['c', '@S1']]]], h: { S1: [40, 'String', [['value', '"hi"']], 'hot'], S2: [130, 'String', [['value', '"hi"']], 'hot'] }, hot: ['main.a', 'main.b'], out: 'false', s: '<code>==</code> on references compares the <b>addresses</b>. Two arrows to two boxes: <b>false</b>.' },
      { l: 5, f: [['main', [['a', '@S1'], ['b', '@S2'], ['c', '@S1']]]], h: { S1: [40, 'String', [['value', '"hi"', 1]]], S2: [130, 'String', [['value', '"hi"', 1]]] }, hot: [], out: 'true', s: '<code>equals</code> follows both arrows and compares the <b>contents</b>: <b>true</b>.' },
      { l: 6, f: [['main', [['a', '@S1'], ['b', '@S2'], ['c', '@S1']]]], h: { S1: [40, 'String', [['value', '"hi"']]], S2: [130, 'String', [['value', '"hi"']]] }, hot: ['main.a', 'main.c', 'S1'], out: 'true', s: 'Both arrows end at the same box: <b>true</b>. Use <code>==</code> for primitives, enums and deliberate identity checks; use <code>equals</code> for values.' }
    ] },
    alias: { label: 'Aliasing bug', code: [
      MAIN,
      '  List<String> base = new ArrayList<>();',
      '  base.add("a");',
      '  List<String> copy = base;   // not a copy',
      '  copy.add("b");',
      '  System.out.println(base);',
      '  List<String> real = new ArrayList<>(base);',
      '  real.add("c");',
      '  System.out.println(base);',
      '}'],
    steps: [
      { l: 1, f: [['main', [['base', '@L1']]]], h: { L1: [40, 'ArrayList', [['size', '0']]] }, hot: ['main.base', 'L1'], s: 'One list object.' },
      { l: 2, f: [['main', [['base', '@L1']]]], h: { L1: [40, 'ArrayList', [['size', '1'], ['[0]', '"a"', 1]]] }, hot: ['L1'], s: 'Add <code>"a"</code>.' },
      { l: 3, f: [['main', [['base', '@L1'], ['copy', '@L1']]]], h: { L1: [40, 'ArrayList', [['size', '1'], ['[0]', '"a"']]] }, hot: ['main.copy'], s: 'The name says “copy”, but assignment copies only the reference. Two names, <b>one list</b>.' },
      { l: 4, f: [['main', [['base', '@L1'], ['copy', '@L1']]]], h: { L1: [40, 'ArrayList', [['size', '2', 1], ['[0]', '"a"'], ['[1]', '"b"', 1]]] }, hot: ['L1'], s: 'Writing through <code>copy</code> changes the list that <code>base</code> sees too.' },
      { l: 5, f: [['main', [['base', '@L1'], ['copy', '@L1']]]], h: { L1: [40, 'ArrayList', [['size', '2'], ['[0]', '"a"'], ['[1]', '"b"']]] }, hot: ['main.base'], out: '[a, b]', s: 'Prints <b>[a, b]</b>: the classic aliasing bug.' },
      { l: 6, f: [['main', [['base', '@L1'], ['copy', '@L1'], ['real', '@L2']]]], h: { L1: [40, 'ArrayList', [['size', '2'], ['[0]', '"a"'], ['[1]', '"b"']]], L2: [160, 'ArrayList', [['size', '2'], ['[0]', '"a"'], ['[1]', '"b"']]] }, hot: ['main.real', 'L2'], s: 'The copy constructor builds a <b>new list</b>. It is a shallow copy: the String elements are shared, which is safe only because Strings are immutable.' },
      { l: 7, f: [['main', [['base', '@L1'], ['copy', '@L1'], ['real', '@L2']]]], h: { L1: [40, 'ArrayList', [['size', '2'], ['[0]', '"a"'], ['[1]', '"b"']]], L2: [160, 'ArrayList', [['size', '3', 1], ['[0]', '"a"'], ['[1]', '"b"'], ['[2]', '"c"', 1]]] }, hot: ['L2'], s: 'Only the new list grows.' },
      { l: 8, f: [['main', [['base', '@L1'], ['copy', '@L1'], ['real', '@L2']]]], h: { L1: [40, 'ArrayList', [['size', '2'], ['[0]', '"a"'], ['[1]', '"b"']]], L2: [160, 'ArrayList', [['size', '3'], ['[0]', '"a"'], ['[1]', '"b"'], ['[2]', '"c"']]] }, hot: ['main.base', 'L1'], out: '[a, b]', s: 'Prints <b>[a, b]</b>. Rule: when you need independence, copy the object (or make it immutable). Copying the reference is not enough.' }
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
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Stack frames on the left, heap objects on the right, arrows for references' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(el('div', { class: 'w-controls' }, seg),
    el('div', { class: 'jt-grid' }, el('div', null, code, out), el('div', { class: 'w-stage' }, stage)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 12.5, fill: 'var(--text)', 'font-family': 'var(--mono)', text: t }, o || {}));
  function draw(st) {
    stage.innerHTML = '';
    stage.append(svg('defs', null,
      svg('marker', { id: 'jt-ah-ref', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: 'var(--accent)' })),
      svg('marker', { id: 'jt-ah-chg', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: 'var(--warn)' }))));
    stage.append(T(10, 18, 'STACK (frames)', { 'font-size': 11, fill: 'var(--text-3)', 'font-family': 'var(--sans)', 'font-weight': 700 }),
      T(300, 18, 'HEAP (objects)', { 'font-size': 11, fill: 'var(--text-3)', 'font-family': 'var(--sans)', 'font-weight': 700 }));
    if (!st) { stage.append(T(10, 50, 'nothing yet: press Play or Step', { fill: 'var(--text-3)', 'font-family': 'var(--sans)' })); return; }
    const hot = new Set(st.hot || []);
    const objPos = {};
    Object.entries(st.h).forEach(([id, [y, title, rows, cls]]) => {
      const x = 300, w = 200, h = 24 + rows.length * 20 + 6;
      objPos[id] = { x, y, h };
      stage.append(svg('rect', { class: 'jt-box ' + (hot.has(id) ? 'hot ' : '') + (cls || ''), x, y, width: w, height: h, rx: 8 }));
      stage.append(T(x + 10, y + 17, title, { 'font-weight': 700, 'font-family': 'var(--sans)', opacity: cls === 'gc' ? 0.5 : 1 }),
        T(x + w - 10, y + 17, id === 'gc' ? '' : '#' + id, { 'font-size': 10.5, fill: 'var(--text-3)', 'text-anchor': 'end' }));
      rows.forEach(([kk, v, chg], i) => {
        const ry = y + 24 + i * 20 + 14;
        stage.append(T(x + 12, ry, kk, { fill: 'var(--text-2)', opacity: cls === 'gc' ? 0.5 : 1 }), T(x + w - 12, ry, v, { 'text-anchor': 'end', fill: chg ? 'var(--warn)' : 'var(--text)', 'font-weight': chg ? 700 : 400, opacity: cls === 'gc' ? 0.5 : 1 }));
      });
    });
    let y = 30; const arrows = [];
    st.f.forEach(([name, vars], fi) => {
      const h = 26 + vars.length * 24 + 6;
      const isTop = fi === st.f.length - 1;
      stage.append(svg('rect', { class: 'jt-box frame' + (isTop ? ' hot' : ''), x: 10, y, width: 180, height: h, rx: 8 }));
      stage.append(T(20, y + 18, name + '()', { 'font-family': 'var(--sans)', 'font-weight': 700 }), T(180, y + 18, isTop ? 'running' : 'waiting', { 'font-size': 10.5, fill: 'var(--text-3)', 'text-anchor': 'end', 'font-family': 'var(--sans)' }));
      vars.forEach(([n, v], i) => {
        const ry = y + 26 + i * 24;
        const key = name + '.' + n;
        stage.append(svg('rect', { class: 'jt-box' + (hot.has(key) ? ' chg' : ''), x: 18, y: ry, width: 164, height: 20, rx: 5 }));
        stage.append(T(26, ry + 14, n, { fill: 'var(--text-2)' }));
        if (v[0] === '@') {
          stage.append(svg('circle', { cx: 168, cy: ry + 10, r: 4, fill: hot.has(key) ? 'var(--warn)' : 'var(--accent)' }));
          arrows.push({ x1: 172, y1: ry + 10, to: v.slice(1), chg: hot.has(key) });
        } else stage.append(T(174, ry + 14, v, { 'text-anchor': 'end' }));
      });
      y += h + 12;
    });
    arrows.forEach((a) => {
      const o = objPos[a.to]; if (!o) return;
      const x2 = o.x - 2, y2 = o.y + 14;
      const p = svg('path', { class: 'jt-arrow' + (a.chg ? ' chg' : ''), d: `M${a.x1} ${a.y1} C ${a.x1 + 60} ${a.y1}, ${x2 - 60} ${y2}, ${x2} ${y2}`, 'marker-end': `url(#jt-ah-${a.chg ? 'chg' : 'ref'})` });
      if (!reduced && a.chg) { p.style.strokeDasharray = '400'; p.style.strokeDashoffset = '400'; p.style.transition = 'stroke-dashoffset .8s ease'; requestAnimationFrame(() => { p.style.strokeDashoffset = '0'; }); }
      stage.append(p);
    });
  }
  function paint() {
    const S = SC[cur]; const st = k >= 0 ? S.steps[k] : null;
    code.innerHTML = '';
    S.code.forEach((ln, i) => code.append(el('div', { class: st && st.l === i ? 'on' : '', html: IA.highlight(ln, 'java') || ' ' })));
    out.innerHTML = ''; out.append(el('div', { class: 'h', text: 'stdout' }));
    S.steps.slice(0, k + 1).forEach((s) => { if (s.out) out.append(el('div', { text: s.out })); });
    draw(st);
    narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: st ? `${k + 1}/${S.steps.length}` : '0' }), el('div', { class: 't', html: st ? st.s : 'Pick a scenario, then press <b>Play</b> or <b>Step</b>. Watch which arrows move and which boxes change.' }));
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
    while (running && g === gen && step()) await sleep(2300);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

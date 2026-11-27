/* Immutability & records: who still holds a reference to the list? final fields, defensive copies, views vs copies. */
IA.widget('immutability-records', (root, ctx) => {
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
  // f: frames [[name, [[var, value]]]]; h: { ID: [y, title, rows [[k, v, changed?]], cls] }; '@ID' = reference; out: [text, isError]
  const PEN = [['size', '1'], ['[0]', '"pen"']];
  const PEN_INK = [['size', '2', 1], ['[0]', '"pen"'], ['[1]', '"ink"', 1]];
  const SC = {
    leak: { label: 'final ≠ immutable', code: [
      'record Order(List<String> items) {}',
      '',
      'var items = new ArrayList<String>();',
      'items.add("pen");',
      'var order = new Order(items);',
      'items.add("ink");',
      'System.out.println(order.items());',
      'order.items().clear();',
      'System.out.println(order.items());'],
    steps: [
      { l: 3, f: [['main', [['items', '@L1']]]], h: { L1: [150, 'ArrayList', PEN] }, hot: ['main.items', 'L1'], s: 'The caller builds a mutable list.' },
      { l: 4, f: [['main', [['items', '@L1'], ['order', '@O1']]]], h: { O1: [36, 'Order (record)', [['final items', '@L1']]], L1: [150, 'ArrayList', PEN] }, hot: ['main.order', 'O1'], s: 'The record stores the <b>reference</b> it was given in a <code>final</code> field. <code>final</code> means the field can never point elsewhere. It says nothing about the list itself.' },
      { l: 5, f: [['main', [['items', '@L1'], ['order', '@O1']]]], h: { O1: [36, 'Order (record)', [['final items', '@L1']]], L1: [150, 'ArrayList', PEN_INK] }, hot: ['L1'], s: 'The caller still points at the same list and changes it. The “immutable” order changes too.' },
      { l: 6, f: [['main', [['items', '@L1'], ['order', '@O1']]]], h: { O1: [36, 'Order (record)', [['final items', '@L1']]], L1: [150, 'ArrayList', [['size', '2'], ['[0]', '"pen"'], ['[1]', '"ink"']]] }, hot: ['O1'], out: ['[pen, ink]'], s: 'Prints <b>[pen, ink]</b>.' },
      { l: 7, f: [['main', [['items', '@L1'], ['order', '@O1']]]], h: { O1: [36, 'Order (record)', [['final items', '@L1']]], L1: [150, 'ArrayList', [['size', '0', 1]]] }, hot: ['L1'], s: 'The accessor <code>items()</code> returns the same reference, so anyone holding the order can empty it.' },
      { l: 8, f: [['main', [['items', '@L1'], ['order', '@O1']]]], h: { O1: [36, 'Order (record)', [['final items', '@L1']]], L1: [150, 'ArrayList', [['size', '0']]] }, hot: ['O1', 'L1'], out: ['[]'], s: 'Prints <b>[]</b>. A record is only <i>shallowly</i> immutable. To be truly immutable, every reachable object must be immutable too.' }
    ] },
    copy: { label: 'Defensive copy', code: [
      'record Order(List<String> items) {',
      '  Order { items = List.copyOf(items); }   // compact ctor',
      '}',
      'var items = new ArrayList<String>();',
      'items.add("pen");',
      'var order = new Order(items);',
      'items.add("ink");',
      'System.out.println(order.items());',
      'order.items().add("x");'],
    steps: [
      { l: 4, f: [['main', [['items', '@L1']]]], h: { L1: [100, 'ArrayList', PEN] }, hot: ['main.items', 'L1'], s: 'Same mutable list as before.' },
      { l: 1, f: [['main', [['items', '@L1']]], ['Order(…)', [['items (param)', '@L1']]]], h: { O1: [36, 'Order (record)', [['final items', '(unset)']]], L1: [100, 'ArrayList', PEN] }, hot: ['Order(…).items (param)'], s: 'A <b>compact constructor</b> (Java 16+) gets the record’s values as parameters. The fields are not set yet.' },
      { l: 1, f: [['main', [['items', '@L1']]], ['Order(…)', [['items (param)', '@L2']]]], h: { O1: [36, 'Order (record)', [['final items', '(unset)']]], L1: [100, 'ArrayList', PEN], L2: [200, 'List.copyOf → unmodifiable', [['[0]', '"pen"']]] }, hot: ['Order(…).items (param)', 'L2'], s: '<code>List.copyOf</code> makes an unmodifiable copy, and the code re-points the <i>parameter</i> to it.' },
      { l: 5, f: [['main', [['items', '@L1'], ['order', '@O1']]]], h: { O1: [36, 'Order (record)', [['final items', '@L2', 1]]], L1: [100, 'ArrayList', PEN], L2: [200, 'List.copyOf → unmodifiable', [['[0]', '"pen"']]] }, hot: ['main.order', 'O1'], s: 'At the end of the compact constructor the compiler assigns each field from its parameter: <code>this.items = items</code>. The order points at the copy. The caller’s list is no longer reachable from it.' },
      { l: 6, f: [['main', [['items', '@L1'], ['order', '@O1']]]], h: { O1: [36, 'Order (record)', [['final items', '@L2']]], L1: [100, 'ArrayList', PEN_INK], L2: [200, 'List.copyOf → unmodifiable', [['[0]', '"pen"']]] }, hot: ['L1'], s: 'The caller changes its own list. The order is unaffected.' },
      { l: 7, f: [['main', [['items', '@L1'], ['order', '@O1']]]], h: { O1: [36, 'Order (record)', [['final items', '@L2']]], L1: [100, 'ArrayList', [['size', '2'], ['[0]', '"pen"'], ['[1]', '"ink"']]], L2: [200, 'List.copyOf → unmodifiable', [['[0]', '"pen"']]] }, hot: ['O1', 'L2'], out: ['[pen]'], s: 'Prints <b>[pen]</b>.' },
      { l: 8, f: [['main', [['items', '@L1'], ['order', '@O1']]]], h: { O1: [36, 'Order (record)', [['final items', '@L2']]], L1: [100, 'ArrayList', [['size', '2'], ['[0]', '"pen"'], ['[1]', '"ink"']]], L2: [200, 'List.copyOf → unmodifiable', [['[0]', '"pen"']], 'bad'] }, hot: [], out: ['UnsupportedOperationException', 1], s: 'Writing through the accessor throws <b>UnsupportedOperationException</b>. No copy is needed on the way out because the stored list can’t change.' }
    ] },
    view: { label: 'View vs copy', code: [
      'var base = new ArrayList<>(List.of("a"));',
      'var view = Collections.unmodifiableList(base);',
      'var copy = List.copyOf(base);',
      'base.add("b");',
      'System.out.println(view);',
      'System.out.println(copy);',
      'view.add("c");'],
    steps: [
      { l: 0, f: [['main', [['base', '@L1']]]], h: { L1: [100, 'ArrayList', [['size', '1'], ['[0]', '"a"']]] }, hot: ['main.base', 'L1'], s: 'A mutable list.' },
      { l: 1, f: [['main', [['base', '@L1'], ['view', '@V1']]]], h: { V1: [36, 'UnmodifiableList', [['list', '@L1']]], L1: [100, 'ArrayList', [['size', '1'], ['[0]', '"a"']]] }, hot: ['main.view', 'V1'], s: '<code>Collections.unmodifiableList</code> wraps the list. It blocks writes made <i>through the wrapper</i>, but it is a <b>view</b>: it reads the original list every time.' },
      { l: 2, f: [['main', [['base', '@L1'], ['view', '@V1'], ['copy', '@L2']]]], h: { V1: [36, 'UnmodifiableList', [['list', '@L1']]], L1: [100, 'ArrayList', [['size', '1'], ['[0]', '"a"']]], L2: [200, 'List.copyOf → unmodifiable', [['[0]', '"a"']]] }, hot: ['main.copy', 'L2'], s: '<code>List.copyOf</code> (Java 10+) copies the elements into a new unmodifiable list. It shares nothing with <code>base</code> except the element objects.' },
      { l: 3, f: [['main', [['base', '@L1'], ['view', '@V1'], ['copy', '@L2']]]], h: { V1: [36, 'UnmodifiableList', [['list', '@L1']]], L1: [100, 'ArrayList', [['size', '2', 1], ['[0]', '"a"'], ['[1]', '"b"', 1]]], L2: [200, 'List.copyOf → unmodifiable', [['[0]', '"a"']]] }, hot: ['L1'], s: 'Anyone with the original reference can still write.' },
      { l: 4, f: [['main', [['base', '@L1'], ['view', '@V1'], ['copy', '@L2']]]], h: { V1: [36, 'UnmodifiableList', [['list', '@L1']], 'hot'], L1: [100, 'ArrayList', [['size', '2'], ['[0]', '"a"'], ['[1]', '"b"']], 'hot'], L2: [200, 'List.copyOf → unmodifiable', [['[0]', '"a"']]] }, hot: ['main.view'], out: ['[a, b]'], s: 'The view follows its arrow to the changed list and prints <b>[a, b]</b>. “Unmodifiable” is not “immutable”.' },
      { l: 5, f: [['main', [['base', '@L1'], ['view', '@V1'], ['copy', '@L2']]]], h: { V1: [36, 'UnmodifiableList', [['list', '@L1']]], L1: [100, 'ArrayList', [['size', '2'], ['[0]', '"a"'], ['[1]', '"b"']]], L2: [200, 'List.copyOf → unmodifiable', [['[0]', '"a"']], 'hot'] }, hot: ['main.copy'], out: ['[a]'], s: 'The copy is a snapshot: <b>[a]</b>.' },
      { l: 6, f: [['main', [['base', '@L1'], ['view', '@V1'], ['copy', '@L2']]]], h: { V1: [36, 'UnmodifiableList', [['list', '@L1']], 'bad'], L1: [100, 'ArrayList', [['size', '2'], ['[0]', '"a"'], ['[1]', '"b"']]], L2: [200, 'List.copyOf → unmodifiable', [['[0]', '"a"']]] }, hot: ['main.view'], out: ['UnsupportedOperationException', 1], s: 'Both throw on writes through themselves. Use a view to stop callers from writing; use a copy when you need a value that never changes.' }
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
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Stack frames on the left, heap objects on the right, arrows for references between them' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(el('div', { class: 'w-controls' }, seg),
    el('div', { class: 'jt-grid' }, el('div', null, code, out), el('div', { class: 'w-stage' }, stage)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 12, fill: 'var(--text)', 'font-family': 'var(--mono)', text: t }, o || {}));
  const HX = 250, HW = 195;
  function anim(p) { if (reduced) return; p.style.strokeDasharray = '500'; p.style.strokeDashoffset = '500'; p.style.transition = 'stroke-dashoffset .8s ease'; requestAnimationFrame(() => { p.style.strokeDashoffset = '0'; }); }
  function draw(st) {
    stage.innerHTML = '';
    stage.append(svg('defs', null,
      svg('marker', { id: 'jt-ah-im', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: 'var(--accent)' })),
      svg('marker', { id: 'jt-ah-im2', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: 'var(--warn)' }))));
    stage.append(T(10, 18, 'STACK', { 'font-size': 11, fill: 'var(--text-3)', 'font-family': 'var(--sans)', 'font-weight': 700 }),
      T(HX, 18, 'HEAP', { 'font-size': 11, fill: 'var(--text-3)', 'font-family': 'var(--sans)', 'font-weight': 700 }));
    if (!st) { stage.append(T(10, 50, 'nothing yet: press Play or Step', { fill: 'var(--text-3)', 'font-family': 'var(--sans)' })); return; }
    const hot = new Set(st.hot || []);
    const pos = {}; const links = [];
    Object.entries(st.h).forEach(([id, [y, title, rows, cls]]) => {
      const h = 24 + rows.length * 19 + 6;
      pos[id] = { y, h };
      stage.append(svg('rect', { class: 'jt-box ' + (hot.has(id) ? 'hot ' : '') + (cls || ''), x: HX, y, width: HW, height: h, rx: 8 }));
      stage.append(T(HX + 10, y + 17, title, { 'font-weight': 700, 'font-family': 'var(--sans)', 'font-size': 11.5 }));
      rows.forEach(([kk, v, chg], i) => {
        const ry = y + 24 + i * 19 + 13;
        stage.append(T(HX + 12, ry, kk, { fill: 'var(--text-2)', 'font-size': 11.5 }));
        if (v[0] === '@') { stage.append(svg('circle', { cx: HX + HW - 14, cy: ry - 4, r: 4, fill: chg ? 'var(--warn)' : 'var(--accent)' })); links.push({ y1: ry - 4, to: v.slice(1), chg }); }
        else stage.append(T(HX + HW - 12, ry, v, { 'text-anchor': 'end', fill: chg ? 'var(--warn)' : 'var(--text)', 'font-weight': chg ? 700 : 400, 'font-size': 11.5 }));
      });
    });
    let y = 30; const arrows = [];
    st.f.forEach(([name, vars], fi) => {
      const h = 26 + vars.length * 24 + 6;
      const isTop = fi === st.f.length - 1;
      stage.append(svg('rect', { class: 'jt-box frame' + (isTop ? ' hot' : ''), x: 10, y, width: 190, height: h, rx: 8 }));
      stage.append(T(20, y + 18, name, { 'font-family': 'var(--sans)', 'font-weight': 700 }));
      vars.forEach(([n, v], i) => {
        const ry = y + 26 + i * 24; const key = name + '.' + n;
        stage.append(svg('rect', { class: 'jt-box' + (hot.has(key) ? ' chg' : ''), x: 18, y: ry, width: 174, height: 20, rx: 5 }));
        stage.append(T(26, ry + 14, n, { fill: 'var(--text-2)', 'font-size': 11.5 }));
        if (v[0] === '@') { stage.append(svg('circle', { cx: 180, cy: ry + 10, r: 4, fill: hot.has(key) ? 'var(--warn)' : 'var(--accent)' })); arrows.push({ y1: ry + 10, to: v.slice(1), chg: hot.has(key) }); }
        else stage.append(T(186, ry + 14, v, { 'text-anchor': 'end' }));
      });
      y += h + 12;
    });
    arrows.forEach((a) => {
      const o = pos[a.to]; if (!o) return;
      const y2 = o.y + 14;
      const p = svg('path', { class: 'jt-arrow' + (a.chg ? ' chg' : ''), d: `M184 ${a.y1} C 220 ${a.y1}, ${HX - 36} ${y2}, ${HX - 2} ${y2}`, 'marker-end': `url(#jt-ah-im${a.chg ? '2' : ''})` });
      if (a.chg) anim(p); stage.append(p);
    });
    links.forEach((a, i) => {
      const o = pos[a.to]; if (!o) return;
      const y2 = o.y + 14; const bx = HX + HW + 24 + i * 12;
      const p = svg('path', { class: 'jt-arrow' + (a.chg ? ' chg' : ''), d: `M${HX + HW - 10} ${a.y1} C ${bx + 20} ${a.y1}, ${bx + 20} ${y2}, ${HX + HW + 2} ${y2}`, 'marker-end': `url(#jt-ah-im${a.chg ? '2' : ''})` });
      if (a.chg) anim(p); stage.append(p);
    });
  }
  function paint() {
    const S = SC[cur]; const st = k >= 0 ? S.steps[k] : null;
    code.innerHTML = '';
    S.code.forEach((ln, i) => code.append(el('div', { class: st && st.l === i ? 'on' : '', html: IA.highlight(ln, 'java') || ' ' })));
    out.innerHTML = ''; out.append(el('div', { class: 'h', text: 'stdout / exceptions' }));
    S.steps.slice(0, k + 1).forEach((s) => { if (s.out) out.append(el('div', { class: s.out[1] ? 'e' : '', text: s.out[0] })); });
    draw(st);
    narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: st ? `${k + 1}/${S.steps.length}` : '0' }), el('div', { class: 't', html: st ? st.s : 'Pick a scenario, then press <b>Play</b> or <b>Step</b>. Count the arrows into each list: every arrow is someone who can still change it.' }));
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
    while (running && g === gen && step()) await sleep(2500);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

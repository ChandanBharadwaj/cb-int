/* Generics & erasure: what javac checks vs what the JVM runs. Erasure + casts, heap pollution, bridge methods, PECS. */
IA.widget('generics-erasure', (root, ctx) => {
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
  // r: rows [javac sees, JVM runs, cls]; list: [[value, runtimeClass, cls]]; lad: { dst, src, ok, note }; out: [text, isErr]
  const SC = {
    erase: { label: 'Erasure & casts', code: [
      'List<String> xs = new ArrayList<>();',
      'xs.add("hi");',
      'String s = xs.get(0);',
      'var other = new ArrayList<Integer>();',
      'System.out.println(xs.getClass() == other.getClass());'],
    steps: [
      { l: 0, r: [['List<String> xs = new ArrayList<>()', 'List xs = new ArrayList()']], list: [], s: '<b>Type erasure</b>: javac checks the type arguments and then removes them. The class file contains a plain <code>List</code>, and the ArrayList stores <code>Object</code> references.' },
      { l: 1, r: [['List<String> xs = new ArrayList<>()', 'List xs = new ArrayList()'], ['xs.add("hi")   ✓ checked: String', 'xs.add("hi")   // add(Object)']], list: [['"hi"', 'String', 'hot']], s: 'The compiler rejects <code>xs.add(42)</code> here. At runtime, <code>add</code> takes any Object.' },
      { l: 2, r: [['List<String> xs = new ArrayList<>()', 'List xs = new ArrayList()'], ['xs.add("hi")   ✓ checked: String', 'xs.add("hi")   // add(Object)'], ['String s = xs.get(0)', 's = (String) xs.get(0)   ← checkcast', 'hot']], list: [['"hi"', 'String']], s: '<code>get</code> returns Object after erasure, so javac <b>inserts a cast</b> where the value is used. Remember this cast: it is where type errors surface at runtime.' },
      { l: 4, r: [['List<String> xs = new ArrayList<>()', 'List xs = new ArrayList()'], ['xs.add("hi")   ✓ checked: String', 'xs.add("hi")   // add(Object)'], ['String s = xs.get(0)', 's = (String) xs.get(0)   ← checkcast'], ['ArrayList<String> vs <Integer>', 'one class: ArrayList.class', 'hot']], list: [['"hi"', 'String']], out: ['true'], s: 'Prints <b>true</b>: there is only one <code>ArrayList.class</code>. That is why <code>new T()</code>, <code>T.class</code>, <code>x instanceof List&lt;String&gt;</code> and overloading <code>f(List&lt;String&gt;)</code> with <code>f(List&lt;Integer&gt;)</code> are all illegal.' }
    ] },
    pollute: { label: 'Heap pollution', code: [
      'List<String> names = new ArrayList<>();',
      'List raw = names;                 // raw type',
      'raw.add(42);                      // unchecked',
      'System.out.println(names.size());',
      'String s = names.get(0);'],
    steps: [
      { l: 0, r: [['List<String> names', 'List names']], list: [], s: 'A list of Strings, as far as the compiler knows.' },
      { l: 1, r: [['List<String> names', 'List names'], ['List raw = names   ⚠ raw type', 'same object, no type checks', 'hot']], list: [], s: 'A <b>raw type</b> turns generic checks off for that variable. It still points at the same list.' },
      { l: 2, r: [['List<String> names', 'List names'], ['List raw = names   ⚠ raw type', 'same object, no type checks'], ['raw.add(42)   ⚠ unchecked call', 'add(Object): accepted', 'bad']], list: [['42', 'Integer', 'bad']], s: '<b>Heap pollution</b>: a <code>List&lt;String&gt;</code> variable now points at a list holding an Integer. Nothing fails yet. The compiler only warned.' },
      { l: 3, r: [['List<String> names', 'List names'], ['List raw = names   ⚠ raw type', 'same object, no type checks'], ['raw.add(42)   ⚠ unchecked call', 'add(Object): accepted']], list: [['42', 'Integer', 'bad']], out: ['1'], s: 'Prints <b>1</b>. Code that doesn’t touch the element as a String works fine.' },
      { l: 4, r: [['List<String> names', 'List names'], ['List raw = names   ⚠ raw type', 'same object, no type checks'], ['raw.add(42)   ⚠ unchecked call', 'add(Object): accepted'], ['String s = names.get(0)', '(String) get(0) → fails', 'bad']], list: [['42', 'Integer', 'bad']], out: ['ClassCastException: Integer cannot be cast to String', 1], s: 'The added cast fails <b>at the read</b>, maybe in another class, hours later. The stack trace blames innocent code. Treat unchecked warnings as errors, or wrap with <code>Collections.checkedList</code> to fail at the bad write.' }
    ] },
    bridge: { label: 'Bridge method', code: [
      'record Name(String v) implements Comparable<Name> {',
      '  public int compareTo(Name o) { return v.compareTo(o.v); }',
      '}',
      'Comparable raw = new Name("a");',
      'raw.compareTo("oops");'],
    steps: [
      { l: 0, r: [['interface Comparable<T>', 'int compareTo(Object)']], list: null, s: '<code>Comparable&lt;T&gt;.compareTo(T)</code> erases to <code>compareTo(Object)</code>. That is the method the JVM dispatches on.' },
      { l: 1, r: [['interface Comparable<T>', 'int compareTo(Object)'], ['compareTo(Name o)', 'int compareTo(Name)', 'hot'], ['(not in your source)', 'bridge: compareTo(Object o)', 'chg'], ['', '  { return compareTo((Name) o); }', 'chg']], list: null, s: 'Your method becomes <code>compareTo(Name)</code>. In bytecode, that doesn’t override <code>compareTo(Object)</code>. So the compiler adds a hidden <b>bridge method</b> that casts and calls yours. <code>javap -p</code> shows it, and <code>Method.isBridge()</code> is true for it.' },
      { l: 3, r: [['interface Comparable<T>', 'int compareTo(Object)'], ['compareTo(Name o)', 'int compareTo(Name)'], ['(not in your source)', 'bridge: compareTo(Object o)'], ['Comparable raw = new Name("a")', 'raw type: nothing checked', 'hot']], list: null, s: 'Through a raw <code>Comparable</code>, the compiler accepts any argument.' },
      { l: 4, r: [['interface Comparable<T>', 'int compareTo(Object)'], ['compareTo(Name o)', 'int compareTo(Name)'], ['(not in your source)', 'bridge: (Name) o  → fails', 'bad'], ['raw.compareTo("oops")', 'invokes compareTo(Object)', 'hot']], list: null, out: ['ClassCastException: String cannot be cast to Name', 1], s: 'The call lands in the bridge, and its cast throws <b>ClassCastException</b>. This is also why sorting a raw list of mixed types fails inside <code>compareTo</code>.' }
    ] },
    pecs: { label: 'PECS: extends / super', code: [
      'static <T> void copy(List<? super T> dst,',
      '                     List<? extends T> src) {',
      '  for (T t : src) dst.add(t);',
      '}',
      'List<Integer> ints = List.of(1, 2);',
      'List<Number> nums = new ArrayList<>();',
      'List<Object> objs = new ArrayList<>();',
      'copy(nums, ints);',
      'copy(objs, ints);',
      'copy(ints, nums);   // ?'],
    steps: [
      { l: 1, r: [['src: List<? extends T>', 'producer: read T out of it'], ['dst: List<? super T>', 'consumer: put T into it']], lad: { note: 'T = ?' }, s: '<b>P</b>roducer <b>E</b>xtends, <b>C</b>onsumer <b>S</b>uper. <code>src</code> only gives out Ts, so a list of any <i>subtype</i> of T is fine. <code>dst</code> only takes Ts, so a list of any <i>supertype</i> works.' },
      { l: 2, r: [['src: List<? extends T>', 'producer: read T out of it'], ['dst: List<? super T>', 'consumer: put T into it'], ['src.add(t)', '✗ only null can be added', 'bad'], ['T x = dst.get(0)', '✗ you only get Object', 'bad']], lad: { note: 'inside copy' }, s: 'The price of flexibility: you can’t add to <code>? extends T</code>, because the real list might be a <code>List&lt;Double&gt;</code>. You can’t read a T from <code>? super T</code>, because the real list might be a <code>List&lt;Object&gt;</code>.' },
      { l: 7, r: [['copy(nums, ints)', 'T = Integer', 'ok']], lad: { T: 2, dst: 1, src: 2, ok: true }, s: 'With <code>T = Integer</code>: <code>List&lt;Number&gt;</code> is a <code>List&lt;? super Integer&gt;</code> ✓ and <code>List&lt;Integer&gt;</code> is a <code>List&lt;? extends Integer&gt;</code> ✓.' },
      { l: 8, r: [['copy(nums, ints)', 'T = Integer', 'ok'], ['copy(objs, ints)', 'T = Integer', 'ok']], lad: { T: 2, dst: 0, src: 2, ok: true }, s: 'Object is also a supertype of Integer ✓. One method now serves every sensible combination. Without wildcards, <code>copy(List&lt;T&gt;, List&lt;T&gt;)</code> would accept only identical element types.' },
      { l: 9, r: [['copy(nums, ints)', 'T = Integer', 'ok'], ['copy(objs, ints)', 'T = Integer', 'ok'], ['copy(ints, nums)', 'no T exists → compile error', 'bad']], lad: { T: null, dst: 2, src: 1, ok: false }, s: 'We would need Integer to be a supertype of T and T to be a supertype of Number. No such T exists, so javac rejects the call. Generics push this bug to <b>compile time</b>, which is their whole point.' }
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
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'What the compiler sees next to what the JVM runs, plus the runtime list contents or a type ladder' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(el('div', { class: 'w-controls' }, seg),
    el('div', { class: 'jt-grid' }, el('div', null, code, out), el('div', { class: 'w-stage' }, stage)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 11, fill: 'var(--text)', 'font-family': 'var(--mono)', text: t }, o || {}));
  const LAD = ['Object', 'Number', 'Integer'];
  function draw(st) {
    stage.innerHTML = '';
    stage.append(T(8, 16, 'javac sees (types checked)', { 'font-family': 'var(--sans)', 'font-weight': 700, fill: 'var(--text-3)' }),
      T(266, 16, 'JVM runs (after erasure)', { 'font-family': 'var(--sans)', 'font-weight': 700, fill: 'var(--text-3)' }));
    if (!st) { stage.append(T(8, 44, 'press Play or Step', { fill: 'var(--text-3)', 'font-family': 'var(--sans)', 'font-size': 12 })); return; }
    st.r.forEach(([a, b, cls], i) => {
      const y = 24 + i * 25;
      stage.append(svg('rect', { class: 'jt-box ' + (cls || ''), x: 4, y, width: 254, height: 21, rx: 5 }), svg('rect', { class: 'jt-box frame ' + (cls || ''), x: 262, y, width: 254, height: 21, rx: 5 }));
      stage.append(T(10, y + 14.5, a), T(268, y + 14.5, b, { fill: cls === 'bad' ? 'var(--err)' : 'var(--text)' }));
    });
    const top = 158;
    if (st.list) {
      stage.append(T(8, top, 'runtime object: ArrayList  →  Object[] elementData', { 'font-family': 'var(--sans)', 'font-weight': 700, fill: 'var(--text-3)' }));
      stage.append(svg('rect', { class: 'jt-box frame', x: 4, y: top + 10, width: 512, height: 92, rx: 8 }));
      for (let i = 0; i < 4; i++) {
        const e = st.list[i]; const x = 16 + i * 124;
        stage.append(svg('rect', { class: 'jt-box ' + (e ? (e[2] || '') : 'gc'), x, y: top + 24, width: 112, height: 62, rx: 7 }));
        stage.append(T(x + 8, top + 40, '[' + i + ']', { fill: 'var(--text-3)', 'font-size': 10 }));
        if (e) { stage.append(T(x + 56, top + 60, e[0], { 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }), T(x + 56, top + 78, 'getClass(): ' + e[1], { 'text-anchor': 'middle', 'font-size': 9.5, fill: e[2] === 'bad' ? 'var(--err)' : 'var(--text-2)' })); }
        else stage.append(T(x + 56, top + 62, 'null', { 'text-anchor': 'middle', fill: 'var(--text-3)' }));
      }
    } else if (st.lad) {
      const L = st.lad;
      stage.append(T(8, top, 'type ladder: ' + (L.note || (L.ok ? 'T = Integer works' : 'no T satisfies both bounds')), { 'font-family': 'var(--sans)', 'font-weight': 700, fill: L.ok === false ? 'var(--err)' : 'var(--text-3)' }));
      LAD.forEach((n, i) => {
        const y = top + 12 + i * 40;
        const isT = L.T === i;
        stage.append(svg('rect', { class: 'jt-box ' + (isT ? 'hot' : ''), x: 200, y, width: 120, height: 30, rx: 7 }), T(260, y + 19, n + (isT ? '  (T)' : ''), { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700 }));
        if (i < 2) stage.append(svg('path', { class: 'jt-arrow', d: `M260 ${y + 30} L260 ${y + 40}` }));
        if (L.dst === i) stage.append(svg('rect', { class: 'jt-box ' + (L.ok ? 'ok' : 'bad'), x: 20, y, width: 160, height: 30, rx: 7 }), T(100, y + 19, 'dst: List<' + n + '>', { 'text-anchor': 'middle', 'font-size': 11 }));
        if (L.src === i) stage.append(svg('rect', { class: 'jt-box ' + (L.ok ? 'ok' : 'bad'), x: 340, y, width: 170, height: 30, rx: 7 }), T(425, y + 19, 'src: List<' + n + '>', { 'text-anchor': 'middle', 'font-size': 11 }));
      });
      if (L.T != null) {
        // bracket for ? super T (T..Object) on the left, ? extends T (T and below) on the right
        const yT = top + 12 + L.T * 40;
        stage.append(svg('path', { class: 'jt-arrow', d: `M190 ${top + 12} L186 ${top + 12} L186 ${yT + 30} L190 ${yT + 30}` }), T(184, top + 132, '? super T: T and above', { 'text-anchor': 'end', 'font-size': 10, fill: 'var(--text-2)' }));
        stage.append(svg('path', { class: 'jt-arrow', d: `M330 ${yT} L334 ${yT} L334 ${yT + 30} L330 ${yT + 30}` }), T(336, top + 132, '? extends T: T and below', { 'font-size': 10, fill: 'var(--text-2)' }));
      }
    }
  }
  function paint() {
    const S = SC[cur]; const st = k >= 0 ? S.steps[k] : null;
    code.innerHTML = '';
    S.code.forEach((ln, i) => code.append(el('div', { class: st && st.l === i ? 'on' : '', html: IA.highlight(ln, 'java') || ' ' })));
    out.innerHTML = ''; out.append(el('div', { class: 'h', text: 'stdout / exceptions' }));
    S.steps.slice(0, k + 1).forEach((s) => { if (s.out) out.append(el('div', { class: s.out[1] ? 'e' : '', text: s.out[0] })); });
    draw(st);
    narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: st ? `${k + 1}/${S.steps.length}` : '0' }), el('div', { class: 't', html: st ? st.s : 'Pick a scenario, then press <b>Play</b> or <b>Step</b>. Compare the left column (what javac checks) with the right (what actually runs).' }));
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
    while (running && g === gen && step()) await sleep(2800);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

/* Choosing collections: what an operation actually does inside ArrayList, LinkedList, ArrayDeque, TreeMap and EnumMap/EnumSet. */
IA.widget('choosing-collections', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let mode = 'front'; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['front', 'insert at the front'], ['middle', 'get(3)'], ['tree', 'TreeMap navigation'], ['enum', 'EnumMap / EnumSet']], () => mode, (v) => { mode = v; reset(); }, 'Operation');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const W = 760, H = 300;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Internal layout of the collections being compared' });
  const codeHost = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), codeHost, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const code = (src) => { codeHost.innerHTML = ''; codeHost.append(el('pre', { html: IA.highlight(src, 'java') })); };
  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 13, fill: 'var(--text)', text: t }, o || {}));
  const box = (x, y, w, h, hot, o) => svg('rect', Object.assign({ x, y, width: w, height: h, rx: 5, fill: hot ? 'var(--accent-soft)' : 'var(--surface)', stroke: hot ? 'var(--accent)' : 'var(--border)', 'stroke-width': hot ? 2 : 1 }, o || {}));
  let S;

  function drawLinear() {
    const CX = 170, CW = 62;
    // ArrayList
    stage.append(T(20, 46, 'ArrayList', { 'font-weight': 700 }), T(20, 64, S.alNote || '', { 'font-size': 11, fill: 'var(--text-3)' }));
    S.al.forEach((v, i) => { stage.append(box(CX + i * CW, 28, CW - 4, 34, S.alHot.has(i), v == null ? { 'stroke-dasharray': '3 3' } : null));
      stage.append(T(CX + i * CW + (CW - 4) / 2, 50, v == null ? '' : v, { 'text-anchor': 'middle', 'font-family': 'var(--mono)' }));
      stage.append(T(CX + i * CW + (CW - 4) / 2, 76, String(i), { 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-3)' })); });
    if (S.alArrows) S.alArrows.forEach((i) => stage.append(svg('path', { d: `M${CX + i * CW + 40} 24 q 16 -14 32 0`, fill: 'none', stroke: 'var(--warn)', 'stroke-width': 1.6 })));
    // LinkedList
    const LY = 120; const NW = 52, NS = 82;
    stage.append(T(20, LY + 18, 'LinkedList', { 'font-weight': 700 }), T(20, LY + 36, S.llNote || '', { 'font-size': 11, fill: 'var(--text-3)' }));
    S.ll.forEach((v, i) => { const x = CX + i * NS;
      stage.append(box(x, LY, NW, 32, S.llHot.has(i)), T(x + NW / 2, LY + 21, v, { 'text-anchor': 'middle', 'font-family': 'var(--mono)' }));
      if (i < S.ll.length - 1) stage.append(svg('path', { d: `M${x + NW} ${LY + 12} H ${x + NS}`, stroke: 'var(--text-3)', 'stroke-width': 1.4, 'marker-end': 'url(#cc-arr)' }), svg('path', { d: `M${x + NS} ${LY + 22} H ${x + NW}`, stroke: 'var(--border)', 'stroke-width': 1.2 })); });
    if (S.llWalk != null) stage.append(T(CX + S.llWalk * NS + NW / 2, LY + 50, '▲ x', { 'text-anchor': 'middle', fill: 'var(--accent)', 'font-weight': 700, 'font-size': 12 }));
    stage.append(T(CX, LY - 6, 'first', { 'font-size': 10, fill: 'var(--text-3)' }), T(CX + (S.ll.length - 1) * NS, LY - 6, 'last', { 'font-size': 10, fill: 'var(--text-3)' }));
    // ArrayDeque
    const DY = 214;
    stage.append(T(20, DY + 18, 'ArrayDeque', { 'font-weight': 700 }), T(20, DY + 36, S.adNote || '', { 'font-size': 11, fill: 'var(--text-3)' }));
    S.ad.forEach((v, i) => { stage.append(box(CX + i * CW, DY, CW - 4, 34, S.adHot.has(i), v == null ? { 'stroke-dasharray': '3 3' } : null));
      stage.append(T(CX + i * CW + (CW - 4) / 2, DY + 22, v == null ? '' : v, { 'text-anchor': 'middle', 'font-family': 'var(--mono)' })); });
    stage.append(T(CX + S.head * CW + (CW - 4) / 2, DY + 54, '▲ head', { 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--accent)' }));
    stage.append(T(CX + S.tail * CW + (CW - 4) / 2, DY + 70, '▲ tail', { 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-3)' }));
  }
  const TREE = [[40, 0, 3], [20, 1, 1], [60, 1, 5], [10, 2, 0], [30, 2, 2], [50, 2, 4], [70, 2, 6]];
  function drawTree() {
    const px = (i) => 120 + i * 90; const py = (d) => 50 + d * 80;
    const P = {}; TREE.forEach(([key, d, i]) => { P[key] = [px(i), py(d)]; });
    [[40, 20], [40, 60], [20, 10], [20, 30], [60, 50], [60, 70]].forEach(([a, b]) => stage.append(svg('line', { x1: P[a][0], y1: P[a][1], x2: P[b][0], y2: P[b][1], stroke: S.edge && S.edge.has(a + '-' + b) ? 'var(--accent)' : 'var(--border)', 'stroke-width': S.edge && S.edge.has(a + '-' + b) ? 2.5 : 1.5 })));
    TREE.forEach(([key]) => { const [x, y] = P[key]; const hot = S.path.has(key); const res = S.res.has(key);
      stage.append(svg('circle', { cx: x, cy: y, r: 22, fill: res ? 'var(--accent-soft)' : 'var(--surface)', stroke: res ? 'var(--ok)' : hot ? 'var(--accent)' : 'var(--border)', 'stroke-width': res || hot ? 2.5 : 1.5 }));
      stage.append(T(x, y + 5, String(key), { 'text-anchor': 'middle', 'font-family': 'var(--mono)', 'font-weight': 700 })); });
    if (S.probe != null) stage.append(T(W - 20, 30, `probe = ${S.probe}`, { 'text-anchor': 'end', 'font-family': 'var(--mono)', fill: 'var(--accent)', 'font-weight': 700 }));
    if (S.best != null) stage.append(T(W - 20, 50, `best so far = ${S.best}`, { 'text-anchor': 'end', 'font-family': 'var(--mono)', fill: 'var(--text-2)' }));
    stage.append(T(W / 2, H - 14, 'TreeMap = red-black tree: height ≤ 2·log₂(n+1), so every navigation is O(log n)', { 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--text-3)' }));
  }
  const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  function drawEnum() {
    const CX = 170, CW = 80;
    stage.append(T(20, 50, 'EnumMap', { 'font-weight': 700 }), T(20, 68, 'Object[] vals', { 'font-size': 11, fill: 'var(--text-3)' }));
    DAYS.forEach((d, i) => { stage.append(T(CX + i * CW + 37, 26, d + ' (' + i + ')', { 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-3)' }));
      stage.append(box(CX + i * CW, 34, CW - 6, 34, S.eHot === i, S.vals[i] == null ? { 'stroke-dasharray': '3 3' } : null));
      stage.append(T(CX + i * CW + 37, 56, S.vals[i] == null ? 'null' : S.vals[i], { 'text-anchor': 'middle', 'font-family': 'var(--mono)', fill: S.vals[i] == null ? 'var(--text-3)' : 'var(--text)' })); });
    stage.append(T(20, 150, 'EnumSet', { 'font-weight': 700 }), T(20, 168, 'long elements (bits)', { 'font-size': 11, fill: 'var(--text-3)' }));
    for (let i = 6; i >= 0; i--) { const x = CX + (6 - i) * CW; const on = (S.bits >> i) & 1;
      stage.append(T(x + 37, 126, DAYS[i], { 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-3)' }));
      stage.append(box(x, 134, CW - 6, 34, S.bHot === i, on ? { fill: 'var(--accent-soft)', stroke: 'var(--accent)' } : null));
      stage.append(T(x + 37, 156, String(on), { 'text-anchor': 'middle', 'font-family': 'var(--mono)', 'font-weight': 700 })); }
    stage.append(T(CX, 200, `elements = 0b${S.bits.toString(2).padStart(7, '0')} = ${S.bits}`, { 'font-family': 'var(--mono)', fill: 'var(--text-2)' }));
    stage.append(T(CX, 230, S.eNote || '', { 'font-size': 12, fill: 'var(--text-3)' }));
  }
  function render() {
    stage.innerHTML = '';
    stage.append(svg('defs', null, svg('marker', { id: 'cc-arr', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: 'var(--text-3)' }))));
    if (mode === 'tree') drawTree(); else if (mode === 'enum') drawEnum(); else drawLinear();
    stats.innerHTML = ''; (S.stats || []).forEach(([l, v]) => stats.append(el('span', { class: 'w-stat', html: `${l} <b>${v}</b>` })));
  }
  const linState = () => ({ al: ['A', 'B', 'C', 'D', 'E', 'F', null, null], alHot: new Set(), ll: ['A', 'B', 'C', 'D', 'E', 'F'], llHot: new Set(), ad: ['A', 'B', 'C', 'D', 'E', 'F', null, null], adHot: new Set(), head: 0, tail: 6, llWalk: null, stats: [] });
  function plan() {
    const st = [];
    if (mode === 'front') {
      code('list.add(0, "Z");         // ArrayList and LinkedList\ndeque.addFirst("Z");      // ArrayDeque');
      st.push({ run: () => { S.alArrows = [5, 4, 3, 2, 1, 0]; S.al = ['Z', 'A', 'B', 'C', 'D', 'E', 'F', null]; S.alHot = new Set([0]); S.alNote = '6 elements shifted'; S.stats = [['ArrayList', 'O(n): System.arraycopy of 6 refs']]; },
        t: 'ArrayList keeps elements in one array. Inserting at index 0 means <code>System.arraycopy</code> moves <b>every element</b> one slot right. It is a fast memmove, but still O(n): with a million elements, a million references move.' });
      st.push({ run: () => { S.alArrows = null; S.ll = ['Z', 'A', 'B', 'C', 'D', 'E', 'F']; S.llHot = new Set([0]); S.llNote = '1 node + 2 links'; S.stats.push(['LinkedList', 'O(1): new Node, relink first']); },
        t: 'LinkedList allocates a new 24-byte <code>Node</code> and relinks <code>first</code>. O(1) and nothing moves. This is the one case where LinkedList is fine; it is also exactly what ArrayDeque does better.' });
      st.push({ run: () => { S.head = 7; S.ad[7] = 'Z'; S.adHot = new Set([7]); S.adNote = 'head wraps to 7'; S.stats.push(['ArrayDeque', 'O(1): head moves back one slot, wrapping']); },
        t: 'ArrayDeque is a <b>circular</b> array. <code>addFirst</code> moves <code>head</code> back one slot, wrapping from 0 to the last index. One write, no allocation, and the elements stay contiguous, which is friendly to the CPU cache.' });
      st.push({ run: () => { S.alHot = new Set(); S.llHot = new Set(); S.adHot = new Set(); }, t: 'Rule of thumb: need a stack or queue? <b>ArrayDeque</b>. Need a list with index access? <b>ArrayList</b>. LinkedList is rarely the right answer in modern Java; even its O(1) middle insert first needs an O(n) walk to find the spot.' });
    } else if (mode === 'middle') {
      code('String s = list.get(3);');
      st.push({ run: () => { S.alHot = new Set([3]); S.alNote = '1 array read'; S.stats = [['ArrayList', '1 read: elementData[3]']]; }, t: 'ArrayList: <code>elementData[3]</code> is address arithmetic, one memory read. O(1), and neighbours are probably in the same cache line already.' });
      [0, 1, 2, 3].forEach((i) => st.push({ run: () => { S.llWalk = i; S.llHot = new Set([i]); S.llNote = `${i} hop${i === 1 ? '' : 's'}`; },
        t: i === 0 ? 'LinkedList: <code>node(3)</code> starts at <code>first</code> (index 3 is in the first half; it would start at <code>last</code> otherwise) and follows <code>next</code> pointers.' : i < 3 ? `Hop ${i}. Each hop is a dependent load from a node that may be anywhere on the heap: a likely cache miss.` : 'Arrived after 3 hops. O(n/2) per get, so <code>for (int i…) list.get(i)</code> on a LinkedList is <b>O(n²)</b>. Iterate with a for-each instead.' }));
      st.push({ run: () => { S.adHot = new Set([3]); S.adNote = 'no get(int)'; S.stats.push(['LinkedList', '3 pointer hops'], ['ArrayDeque', 'no index access']); }, t: 'ArrayDeque has no <code>get(int)</code> at all; it is a deque, not a list. Need both index access and cheap ends? An ArrayList used from the end, or (Java 21) <code>List.reversed()</code> views via <code>SequencedCollection</code>.' });
    } else if (mode === 'tree') {
      code('TreeMap<Integer, String> t = …;   // keys 10..70\nt.floorKey(45);                   // greatest key ≤ 45\nt.subMap(20, true, 50, false);    // view of [20, 50)');
      const walk = [[40, null, '45 &gt; 40: 40 is a candidate (≤ 45). Go right for something closer.'], [60, '40-60', '45 &lt; 60: too big. Go left.'], [50, '60-50', '45 &lt; 50: too big. Go left: no child.']];
      walk.forEach(([key, edge, t], i) => st.push({ run: () => { S.probe = 45; S.path.add(key); if (edge) S.edge.add(edge); if (key === 40) S.best = 40; S.stats = [['nodes visited', i + 1]]; }, t: `<code>floorKey(45)</code>: compare with <b>${key}</b>. ${t}` }));
      st.push({ run: () => { S.res = new Set([40]); }, t: 'Hit a null child, so the answer is the best candidate: <b>40</b>. Three comparisons for 7 keys; about 20 for a million. <code>floor</code>, <code>ceiling</code>, <code>lower</code>, <code>higher</code> all work this way.' });
      st.push({ run: () => { S.path = new Set(); S.edge = new Set(); S.probe = null; S.best = null; S.res = new Set([20, 30, 40]); S.stats = [['subMap size', 3]]; }, t: '<code>subMap(20, true, 50, false)</code> is a <b>live view</b>, not a copy: [20, 30, 40]. Writes through the view hit the map, and putting a key outside the range throws <code>IllegalArgumentException</code>. Typical use: time-bucketed data, rate-limit windows, “next slot after now”.' });
    } else {
      code('enum Day { MON, TUE, WED, THU, FRI, SAT, SUN }\nMap<Day, String> shifts = new EnumMap<>(Day.class);\nshifts.put(Day.WED, "ana"); shifts.put(Day.MON, "raj");\nSet<Day> weekend = EnumSet.of(Day.SAT, Day.SUN);');
      st.push({ run: () => { S.vals[2] = 'ana'; S.eHot = 2; S.eNote = 'put(WED): vals[WED.ordinal()] = vals[2]: no hashing, no Node'; S.stats = [['EnumMap size', 1]]; }, t: '<code>EnumMap</code> is just an array indexed by <code>ordinal()</code>. <code>put(WED, …)</code> writes slot 2. No <code>hashCode</code>, no node objects, no collisions.' });
      st.push({ run: () => { S.vals[0] = 'raj'; S.eHot = 0; S.eNote = 'iteration follows declaration order, not insertion order'; S.stats = [['EnumMap size', 2]]; }, t: 'Iteration walks the array, so order is <b>declaration order</b> (MON before WED), even though WED was put first.' });
      st.push({ run: () => { S.bits = 0b1100000; S.bHot = null; S.eHot = null; S.eNote = 'EnumSet.of(SAT, SUN): one long, bits 5 and 6'; }, t: '<code>EnumSet</code> for ≤ 64 constants is a <code>RegularEnumSet</code>: a single <code>long</code>. SAT is bit 5 and SUN bit 6.' });
      st.push({ run: () => { S.bHot = 6; S.eNote = 'contains(SUN): (elements & (1L << 6)) != 0'; S.stats = [['contains', 'one AND']]; }, t: '<code>contains</code>, <code>add</code> and <code>remove</code> are single bit operations; <code>containsAll</code>, union and intersection are one AND/OR across the whole set. Use EnumSet instead of bit flags or <code>Set&lt;Day&gt;</code> as a HashSet.' });
    }
    return st;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    S = mode === 'tree' ? { path: new Set(), edge: new Set(), res: new Set(), probe: null, best: null, stats: [] }
      : mode === 'enum' ? { vals: Array(7).fill(null), bits: 0, eHot: null, bHot: null, stats: [] } : linState();
    steps = plan(); render(); bStep.disabled = false;
    say(mode === 'front' ? 'Six elements in each structure. Press Play to insert “Z” at the front of all three and compare the work.'
      : mode === 'middle' ? 'Same six elements. Press Play to read index 3 from each.'
      : mode === 'tree' ? 'A TreeMap holding 10, 20 … 70. Press Play to find the greatest key ≤ 45, then take a range view.'
      : 'Days of the week as an enum. Press Play to see what EnumMap and EnumSet really store.');
  }
  function step() {
    if (k >= steps.length) return false; const s = steps[k++]; s.run(); render(); say(typeof s.t === 'function' ? s.t() : s.t);
    if (k >= steps.length) bStep.disabled = true; return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 700 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

/* Streams: elements flow one at a time through the pipeline (laziness, short-circuit), stateful ops act as barriers, and toMap fails on a duplicate key. */
IA.widget('streams-collectors', (root, ctx) => {
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
  // each step: set: [[row, col, text, cls]] applied cumulatively; at: [row, col]; out: line; res: result text; err: true
  const SC = {
    lazy: { label: 'Lazy + short-circuit', cols: ['filter len > 1', 'map upper', 'findFirst'], rows: ['"a"', '"bb"', '"ccc"', '"dd"'], code: [
      'Optional<String> r = Stream.of("a", "bb", "ccc", "dd")',
      '    .filter(s -> { log("filter " + s); return s.length() > 1; })',
      '    .map(s -> { log("map " + s); return s.toUpperCase(); })',
      '    .findFirst();',
      'System.out.println(r);'],
    steps: [
      { l: 0, set: [], s: 'Building the pipeline runs <b>nothing</b>. <code>filter</code> and <code>map</code> are <b>lazy</b> intermediate operations: they only describe stages. Work starts when a terminal operation pulls elements.' },
      { l: 1, at: [0, 0], set: [[0, 0, '✗ dropped', 'bad']], out: 'filter a', s: '<code>findFirst</code> pulls the first element. It goes through the stages <b>one element at a time</b>, vertically, not stage by stage. "a" fails the filter.' },
      { l: 1, at: [1, 0], set: [[1, 0, '✓ pass', 'ok']], out: 'filter bb', s: 'Next element: "bb" passes the filter…' },
      { l: 2, at: [1, 1], set: [[1, 1, '"BB"', 'ok']], out: 'map bb', s: '…and goes straight on to <code>map</code>, before "ccc" has even been looked at.' },
      { l: 3, at: [1, 2], set: [[1, 2, '✓ found', 'hot'], [2, 0, 'never seen', 'gc'], [3, 0, 'never seen', 'gc']], res: 'Optional[BB]', s: '<code>findFirst</code> is <b>short-circuiting</b>: it has its answer, so the pipeline stops. "ccc" and "dd" are never filtered or mapped. That is why streams can work on infinite sources (<code>Stream.iterate</code>) when paired with <code>limit</code>, <code>findFirst</code> or <code>anyMatch</code>.' },
      { l: 4, at: null, set: [], out: 'Optional[BB]', s: 'Total work: 2 filter calls and 1 map call, instead of 4 + 3. The log shows the interleaving. Never rely on side effects in stream lambdas for correctness; use <code>peek</code>/logging only for debugging.' }
    ] },
    barrier: { label: 'sorted() is a barrier', cols: ['peek', 'sorted', 'map', 'findFirst'], rows: ['3', '1', '2'], code: [
      'Stream.of(3, 1, 2)',
      '    .peek(x -> log("peek " + x))',
      '    .sorted()',
      '    .map(x -> { log("map " + x); return x * 10; })',
      '    .findFirst();'],
    steps: [
      { l: 1, at: [0, 0], set: [[0, 0, 'seen', 'ok']], out: 'peek 3', s: '3 is pulled and peeked…' },
      { l: 2, at: [0, 1], set: [[0, 1, 'buffered', 'chg']], s: '…then <code>sorted</code> <b>holds on to it</b>. It can’t emit anything until it has seen every element, because the smallest might come last. That makes it a <b>stateful</b> operation.' },
      { l: 1, at: [1, 0], set: [[1, 0, 'seen', 'ok'], [1, 1, 'buffered', 'chg']], out: 'peek 1', s: '1 is peeked and buffered.' },
      { l: 1, at: [2, 0], set: [[2, 0, 'seen', 'ok'], [2, 1, 'buffered', 'chg']], out: 'peek 2', s: '2 is peeked and buffered. The source is exhausted, so sorted now sorts its buffer: [1, 2, 3].' },
      { l: 3, at: [1, 2], set: [[1, 1, 'emit #1', 'hot'], [1, 2, '10', 'ok']], out: 'map 1', s: 'Only now does anything flow downstream: the smallest element, 1, is mapped to 10.' },
      { l: 4, at: [1, 3], set: [[1, 3, '✓ found', 'hot'], [0, 2, 'never', 'gc'], [2, 2, 'never', 'gc']], s: '<code>findFirst</code> short-circuits <i>after</i> the barrier: every element was still read and buffered. With an infinite source, <code>sorted()</code> never returns. <code>distinct()</code> is stateful too (it remembers what it has seen), and <code>limit()</code>/<code>skip()</code> must respect encounter order, which gets expensive in parallel.' }
    ] },
    tomap: { label: 'toMap duplicate key', cols: ['key: charAt(0)', 'toMap'], rows: ['"apple"', '"avocado"', '"banana"'], code: [
      'Map<Character, String> byInitial = Stream.of("apple", "avocado", "banana")',
      '    .collect(Collectors.toMap(s -> s.charAt(0), s -> s));',
      '',
      '// fix: say what to do on collision',
      '//   toMap(s -> s.charAt(0), s -> s, (a, b) -> a + "," + b)',
      '// or group: groupingBy(s -> s.charAt(0))'],
    steps: [
      { l: 1, at: [0, 0], set: [[0, 0, "'a'", 'ok']], s: '<code>toMap</code> computes the key for "apple": <code>\'a\'</code>.' },
      { l: 1, at: [0, 1], set: [[0, 1, "put a=apple", 'ok']], s: 'The key is new, so the entry is stored.' },
      { l: 1, at: [1, 0], set: [[1, 0, "'a'", 'chg']], s: '"avocado" also has key <code>\'a\'</code>.' },
      { l: 1, at: [1, 1], set: [[1, 1, '✗ duplicate', 'bad'], [2, 0, 'never', 'gc']], err: 'IllegalStateException: Duplicate key a (attempted merging values apple and avocado)', s: 'The two-argument <code>toMap</code> has no merge function, so a duplicate key <b>throws</b> <code>IllegalStateException</code>. It doesn’t overwrite. This is a common production failure when “ids are unique” turns out to be false.' },
      { l: 4, at: null, set: [], s: 'Fixes: pass a merge function as the third argument (keep first, keep last, combine), use <code>groupingBy</code> to collect a <code>List</code> per key, or use the 4-argument form to choose the map type (<code>TreeMap::new</code>, <code>LinkedHashMap::new</code>). Also: <code>toMap</code> throws <code>NullPointerException</code> for a <b>null value</b>, because it uses <code>Map.merge</code> internally.' }
    ] },
    noterm: { label: 'No terminal op', cols: ['peek', 'map'], rows: ['1', '2', '3'], code: [
      'Stream<Integer> s = Stream.of(1, 2, 3)',
      '    .peek(x -> log("peek " + x))',
      '    .map(x -> x * 2);',
      'System.out.println("built");',
      's.forEach(x -> {});',
      's.forEach(x -> {});   // again?'],
    steps: [
      { l: 2, at: null, set: [], s: 'A pipeline with only intermediate operations. Nothing has run: no element has been read.' },
      { l: 3, at: null, set: [], out: 'built', s: 'Prints <b>built</b>, and no peek output appears. A stream with no terminal operation does no work at all, which is a classic “why isn’t my logging/saving happening?” bug.' },
      { l: 4, at: [2, 1], set: [[0, 0, 'seen', 'ok'], [0, 1, '2', 'ok'], [1, 0, 'seen', 'ok'], [1, 1, '4', 'ok'], [2, 0, 'seen', 'ok'], [2, 1, '6', 'ok']], out: 'peek 1\npeek 2\npeek 3', s: 'The terminal <code>forEach</code> pulls every element through.' },
      { l: 5, at: null, set: [], err: 'IllegalStateException: stream has already been operated upon or closed', s: 'A stream can be consumed <b>once</b>. Keep a <code>Supplier&lt;Stream&lt;T&gt;&gt;</code> or the source collection if you need to traverse it again.' }
    ] }
  };

  const ids = Object.keys(SC); let cur = ids[0]; let k = -1; let gen = 0; let running = false;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scenario' });
  ids.forEach((id) => { const b = el('button', { text: SC[id].label, class: id === cur ? 'on' : '' }); b.addEventListener('click', () => { cur = id; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const code = el('div', { class: 'jt-code' });
  const out = el('div', { class: 'jt-out', 'aria-label': 'Log output' });
  const W = 520, H = 300;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'A grid with one row per element and one column per pipeline stage, showing what each stage did with each element' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(el('div', { class: 'w-controls' }, seg),
    el('div', { class: 'jt-grid' }, el('div', null, code, out), el('div', { class: 'w-stage' }, stage)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 11.5, fill: 'var(--text)', 'font-family': 'var(--mono)', text: t }, o || {}));
  function draw(S) {
    stage.innerHTML = '';
    const cells = {};
    let res = null; let err = null;
    S.steps.slice(0, k + 1).forEach((s) => { s.set.forEach(([r, c, t, cls]) => { cells[r + ',' + c] = [t, cls]; }); if (s.res) res = s.res; if (s.err) err = s.err; });
    const at = k >= 0 ? S.steps[k].at : null;
    const LW = 80, nc = S.cols.length, cw = (512 - LW - 8) / nc, rh = 42, top = 34;
    stage.append(T(8, 22, 'element', { 'font-size': 10.5, fill: 'var(--text-3)', 'font-family': 'var(--sans)', 'font-weight': 700 }));
    S.cols.forEach((c, j) => {
      const x = LW + 8 + j * cw;
      stage.append(T(x + cw / 2, 22, c, { 'text-anchor': 'middle', 'font-size': 10.5, fill: 'var(--text-3)', 'font-family': 'var(--sans)', 'font-weight': 700 }));
      if (j > 0) stage.append(T(x - 2, top + S.rows.length * rh / 2, '→', { 'text-anchor': 'middle', fill: 'var(--text-3)' }));
    });
    S.rows.forEach((r, i) => {
      const y = top + i * rh;
      stage.append(svg('rect', { class: 'jt-box frame' + (at && at[0] === i ? ' hot' : ''), x: 4, y, width: LW, height: rh - 8, rx: 7 }), T(4 + LW / 2, y + 22, r, { 'text-anchor': 'middle', 'font-weight': 700 }));
      S.cols.forEach((c, j) => {
        const x = LW + 8 + j * cw + 6;
        const cell = cells[i + ',' + j];
        const isAt = at && at[0] === i && at[1] === j;
        const rect = svg('rect', { class: 'jt-box ' + (cell ? cell[1] : 'gc') + (isAt ? ' hot' : ''), x, y, width: cw - 12, height: rh - 8, rx: 7 });
        stage.append(rect, T(x + (cw - 12) / 2, y + 22, cell ? cell[0] : '·', { 'text-anchor': 'middle', 'font-size': 11, fill: cell && cell[1] === 'bad' ? 'var(--err)' : cell && cell[1] === 'gc' ? 'var(--text-3)' : 'var(--text)' }));
        if (isAt && !reduced) { rect.style.transition = 'opacity .35s'; rect.style.opacity = '0.2'; requestAnimationFrame(() => { rect.style.opacity = '1'; }); }
      });
    });
    const by = top + S.rows.length * rh + 8;
    stage.append(svg('rect', { class: 'jt-box ' + (err ? 'bad' : res ? 'ok' : 'frame'), x: 4, y: by, width: 512, height: 36, rx: 8 }),
      T(14, by + 23, err ? '⚡ ' + err : res ? 'result: ' + res : k < 0 ? 'press Play or Step' : 'terminal operation pending…', { 'font-size': err ? 9.8 : 11.5, fill: err ? 'var(--err)' : 'var(--text)' }));
  }
  function paint() {
    const S = SC[cur]; const st = k >= 0 ? S.steps[k] : null;
    code.innerHTML = '';
    S.code.forEach((ln, i) => code.append(el('div', { class: st && st.l === i ? 'on' : '', html: IA.highlight(ln, 'java') || ' ' })));
    out.innerHTML = ''; out.append(el('div', { class: 'h', text: 'log / stdout' }));
    S.steps.slice(0, k + 1).forEach((s) => { if (s.out) out.append(el('div', { text: s.out })); if (s.err) out.append(el('div', { class: 'e', text: s.err })); });
    draw(S);
    narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: st ? `${k + 1}/${S.steps.length}` : '0' }), el('div', { class: 't', html: st ? st.s : 'Pick a scenario, then press <b>Play</b> or <b>Step</b>. Each row is an element and each column a stage. Watch elements travel <b>across a row</b> one at a time.' }));
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
    while (running && g === gen && step()) await sleep(2400);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

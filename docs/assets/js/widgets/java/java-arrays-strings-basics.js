/* Arrays & strings basics: array slots and indexes, immutable String methods, StringBuilder's growing buffer, and text-block indentation. */
IA.widget('java-arrays-strings-basics', (root, ctx) => {
  const ARIA = 'Array slots with their indexes, String objects and a StringBuilder buffer changing as each line of Java runs';
  const INTRO = 'Pick a scenario, then press <b>Play</b> or <b>Step</b>. In <b>Arrays</b> each box is one slot, labelled with its index. In the string scenarios boxes are variables and the objects they point to. Orange = just changed, red = error or surprise.';
  const SC = {
    arr: { label: 'Arrays', cols: 5, head: 'array slots: [index] value', code: [
      'int[] scores = new int[5];',
      'scores[0] = 90;',
      'scores[3] = 75;',
      'int n = scores.length;',
      'scores[5] = 60;',
      'String[] names = {"Ann", "Bo"};'],
    steps: [
      { l: 0, b: [['[0]', '0', 'hot'], ['[1]', '0', 'hot'], ['[2]', '0', 'hot'], ['[3]', '0', 'hot'], ['[4]', '0', 'hot']], s: '<code>new int[5]</code> makes 5 slots in a row, all set to the default <b>0</b>. The size is fixed forever.' },
      { l: 1, b: [['[0]', '90', 'hot'], ['[1]', '0'], ['[2]', '0'], ['[3]', '0'], ['[4]', '0']], s: 'Indexes start at <b>0</b>. <code>scores[0]</code> is the first slot.' },
      { l: 2, b: [['[0]', '90', 'ok'], ['[1]', '0'], ['[2]', '0'], ['[3]', '75', 'hot'], ['[4]', '0']], s: 'Any slot can be read or written directly by index, in constant time.' },
      { l: 3, b: [['[0]', '90', 'ok'], ['[1]', '0'], ['[2]', '0'], ['[3]', '75', 'ok'], ['[4]', '0'], ['length', '5', 'chg']], s: '<code>length</code> is a field (no parentheses) for arrays. The last index is <code>length - 1</code> = 4.' },
      { l: 4, b: [['[0]', '90', 'ok'], ['[1]', '0'], ['[2]', '0'], ['[3]', '75', 'ok'], ['[4]', '0'], ['[5]', 'no slot!', 'bad']], out: 'ArrayIndexOutOfBoundsException: Index 5 out of bounds for length 5', s: 'Java checks every index at run time. Slot 5 doesn’t exist, so it throws instead of corrupting memory (as C might).' },
      { l: 5, b: [['[0]', '"Ann"', 'hot'], ['[1]', '"Bo"', 'hot']], s: 'An <b>array initialiser</b> <code>{…}</code> sets size and contents at once. Arrays of objects default to <code>null</code> when created with <code>new String[n]</code>.' }
    ] },
    str: { label: 'String methods', cols: 2, code: [
      'String s = "  Hello, Java  ";',
      'String t = s.trim();',
      'int len = t.length();',
      'char c = t.charAt(7);',
      'String sub = t.substring(0, 5);',
      's.toUpperCase();          // result ignored!',
      'String up = t.toUpperCase();'],
    steps: [
      { l: 0, b: [['s →', '"  Hello, Java  "', 'hot']], s: 'A <code>String</code> is an object holding text. Strings are <b>immutable</b>: no method ever changes this object.' },
      { l: 1, b: [['s →', '"  Hello, Java  "', 'ok'], ['t → new object', '"Hello, Java"', 'hot']], s: '<code>trim()</code> returns a <b>new</b> String without the outer spaces. (<code>strip()</code>, Java 11+, also handles Unicode spaces.)' },
      { l: 2, b: [['s →', '"  Hello, Java  "', 'ok'], ['t →', '"Hello, Java"', 'ok'], ['int len', '11', 'hot']], s: 'For Strings <code>length()</code> is a method, with parentheses. (Arrays: <code>length</code> field. Lists: <code>size()</code>.)' },
      { l: 3, b: [['s →', '"  Hello, Java  "', 'ok'], ['t →', '"Hello, Java"', 'ok'], ['int len', '11', 'ok'], ['char c', "'J'  (index 7)", 'hot']], s: '<code>charAt(i)</code> uses 0-based indexes: H=0 e=1 l=2 l=3 o=4 ,=5 space=6 <b>J=7</b>.' },
      { l: 4, b: [['s →', '"  Hello, Java  "', 'ok'], ['t →', '"Hello, Java"', 'ok'], ['int len', '11', 'ok'], ['char c', "'J'", 'ok'], ['sub →', '"Hello"', 'hot']], s: '<code>substring(begin, end)</code>: <code>begin</code> is included, <code>end</code> is <b>excluded</b>. Indexes 0..4 → "Hello".' },
      { l: 5, b: [['s → (unchanged)', '"  Hello, Java  "', 'bad'], ['t →', '"Hello, Java"', 'ok'], ['result', 'thrown away', 'gc']], s: 'Classic bug: <code>toUpperCase()</code> returned a new String, and nobody kept it. <code>s</code> is untouched.' },
      { l: 6, b: [['s →', '"  Hello, Java  "', 'ok'], ['t →', '"Hello, Java"', 'ok'], ['up →', '"HELLO, JAVA"', 'ok']], s: 'Always assign the result. Other common methods: <code>indexOf</code>, <code>contains</code>, <code>replace</code>, <code>split</code>, <code>startsWith</code>, <code>isBlank</code> (Java 11+), <code>repeat</code> (Java 11+).' }
    ] },
    sb: { label: 'StringBuilder', cols: 2, code: [
      'String csv = "";',
      'for (int i = 0; i < 3; i++) csv += i + ",";',
      'StringBuilder sb = new StringBuilder();',
      'for (int i = 0; i < 3; i++) sb.append(i).append(",");',
      'sb.setLength(sb.length() - 1);',
      'String out = sb.toString();'],
    steps: [
      { l: 0, b: [['csv →', '""', 'hot']], s: 'Building text with <code>+=</code> in a loop…' },
      { l: 1, b: [['csv →', '"0,1,2,"', 'chg'], ['objects created', '3 new Strings', 'bad']], s: '…makes a <b>new String every pass</b> and copies all the old characters. For n pieces, that is about n² copies. Fine for 3, slow for 100,000.' },
      { l: 2, b: [['csv →', '"0,1,2,"', 'ok'], ['sb → buffer', '[ ] (capacity 16)', 'hot']], s: 'A <code>StringBuilder</code> is a <b>mutable</b> buffer of characters with spare room.' },
      { l: 3, b: [['csv →', '"0,1,2,"', 'ok'], ['sb → same buffer', '[0,1,2,]', 'ok']], s: '<code>append</code> writes into the same buffer and returns the builder, so calls chain. It grows only when full.' },
      { l: 4, b: [['csv →', '"0,1,2,"', 'ok'], ['sb → same buffer', '[0,1,2]', 'chg']], s: 'Builders can be edited in place: <code>setLength</code>, <code>insert</code>, <code>reverse</code>, <code>deleteCharAt</code>. Here we drop the last comma.' },
      { l: 5, b: [['csv →', '"0,1,2,"', 'ok'], ['sb → buffer', '[0,1,2]', 'ok'], ['out →', '"0,1,2"', 'ok']], s: '<code>toString()</code> makes the final immutable String. For joining, <code>String.join(",", list)</code> or <code>Collectors.joining(",")</code> is even simpler.' }
    ] },
    tb: { label: 'Text blocks', cols: 1, bh: 80, code: [
      'String json = """',
      '    {',
      '      "name": "Ada"',
      '    }',
      '    """;'],
    steps: [
      { l: 0, b: [['opening """', 'must be followed by a line break', 'hot']], s: 'A <b>text block</b> (Java 15+) starts with <code>"""</code> and a newline. Ideal for JSON, SQL and HTML in code.' },
      { l: [1, 2, 3], b: [['incidental indentation', '4 spaces on every line: removed', 'chg']], s: 'Java finds the smallest indent among the lines <i>and</i> the closing <code>"""</code> (here 4 spaces). It strips that from every line. Extra indent stays.' },
      { l: 4, b: [['json →', '{⏎  "name": "Ada"⏎}⏎', 'ok']], s: 'The result: three lines, the inner line keeps its 2 extra spaces, and there is a trailing newline because the closing <code>"""</code> is on its own line. No <code>\\n</code> or <code>\\"</code> escapes needed.' }
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

/* Operators & control flow: trace integer division, if/else, a switch expression vs fall-through, and each loop kind. */
IA.widget('java-operators-control-flow', (root, ctx) => {
  const ARIA = 'A step-by-step trace of Java code showing the current line, the value of each variable and which branch or loop iteration runs';
  const INTRO = 'Pick a scenario, then press <b>Play</b> or <b>Step</b>. The highlighted line is about to run; the boxes show variables and conditions. Green = condition true, dashed = skipped, red = a surprise.';
  const SC = {
    math: { label: 'Division', cols: 2, code: [
      'int a = 7, b = 2;',
      'int q = a / b;',
      'int r = a % b;',
      'double d = a / b;',
      'double e = (double) a / b;',
      'int n = -7 / 2, m = -7 % 2;'],
    steps: [
      { l: 0, b: [['int a', '7', 'hot'], ['int b', '2', 'hot']], s: 'Two ints.' },
      { l: 1, b: [['int a', '7', 'ok'], ['int b', '2', 'ok'], ['a / b', '3', 'chg']], s: '<code>int / int</code> is <b>integer division</b>: the fraction is thrown away. 7 / 2 is 3.' },
      { l: 2, b: [['int a', '7', 'ok'], ['int b', '2', 'ok'], ['a / b', '3', 'ok'], ['a % b', '1', 'hot']], s: '<code>%</code> is the remainder: 7 = 3 × 2 + <b>1</b>. Handy for “every other row” (<code>i % 2 == 0</code>).' },
      { l: 3, b: [['int a', '7', 'ok'], ['int b', '2', 'ok'], ['a / b', '3', 'ok'], ['a % b', '1', 'ok'], ['double d', '3.0', 'bad']], s: 'Trap: the division happens in <code>int</code> <b>first</b>, then 3 becomes 3.0. The target type doesn’t change how the right side is computed.' },
      { l: 4, b: [['int a', '7', 'ok'], ['int b', '2', 'ok'], ['a / b', '3', 'ok'], ['a % b', '1', 'ok'], ['double d', '3.0', 'bad'], ['double e', '3.5', 'ok']], s: 'Cast one operand first: <code>(double) a</code> is 7.0, so the division is floating-point. 3.5.' },
      { l: 5, b: [['-7 / 2', '-3', 'chg'], ['-7 % 2', '-1', 'chg']], s: 'Integer division rounds <b>toward zero</b>. The remainder takes the sign of the left side. So <code>n % 2 == 1</code> is false for negative odd numbers. Test <code>n % 2 != 0</code>. (<code>Math.floorDiv</code>/<code>floorMod</code> round down instead.)' }
    ] },
    branch: { label: 'if / else', cols: 2, code: [
      'int score = 72;',
      'String grade;',
      'if (score >= 90) {',
      '    grade = "A";',
      '} else if (score >= 70) {',
      '    grade = "B";',
      '} else {',
      '    grade = "C";',
      '}',
      'System.out.println(grade);'],
    steps: [
      { l: 0, b: [['int score', '72', 'hot']], s: 'Start with a score.' },
      { l: 2, b: [['int score', '72', 'ok'], ['score >= 90', 'false', 'gc']], s: 'The first condition is checked. False, so its block is skipped.' },
      { l: 4, b: [['int score', '72', 'ok'], ['score >= 90', 'false', 'gc'], ['score >= 70', 'true', 'ok']], s: 'Then the next <code>else if</code>. True.' },
      { l: 5, b: [['int score', '72', 'ok'], ['score >= 90', 'false', 'gc'], ['score >= 70', 'true', 'ok'], ['String grade', '"B"', 'hot']], s: 'Only the first true branch runs. The remaining <code>else</code> is skipped entirely.' },
      { l: 9, b: [['int score', '72', 'ok'], ['String grade', '"B"', 'ok']], out: 'B', s: 'The compiler accepts <code>grade</code> here because every path sets it. Remove the <code>else</code> and it won’t compile.' }
    ] },
    sw: { label: 'switch', cols: 2, code: [
      'int day = 6;',
      'String kind = switch (day) {',
      '    case 6, 7 -> "weekend";',
      '    case 1, 2, 3, 4, 5 -> "weekday";',
      '    default -> "invalid";',
      '};',
      '// old style: falls through without break',
      'switch (day) {',
      '    case 6: System.out.println("Sat");',
      '    case 7: System.out.println("Sun");',
      '}'],
    steps: [
      { l: [1, 2], b: [['int day', '6', 'ok'], ['matches', 'case 6, 7', 'hot']], s: 'A <b>switch expression</b> (Java 14+) produces a value. <code>case 6, 7 -></code> lists several labels; the arrow form never falls through.' },
      { l: 5, b: [['int day', '6', 'ok'], ['String kind', '"weekend"', 'ok']], s: 'Only the matching arm runs. A switch expression must cover every possible value. Here <code>default</code> does that.' },
      { l: 8, b: [['int day', '6', 'ok'], ['String kind', '"weekend"', 'ok'], ['jump to', 'case 6:', 'hot']], out: 'Sat', s: 'The classic <b>colon</b> form jumps to the matching label and starts running…' },
      { l: 9, b: [['int day', '6', 'ok'], ['String kind', '"weekend"', 'ok'], ['fall-through!', 'case 7: runs too', 'bad']], out: 'Sun', s: '…and keeps going into the next case, because there is no <code>break</code>. This <b>fall-through</b> is a famous source of bugs; the arrow form avoids it.' }
    ] },
    loops: { label: 'Loops', cols: 3, code: [
      'for (int i = 0; i < 3; i++) {',
      '    System.out.println("for " + i);',
      '}',
      'int n = 10;',
      'while (n < 3) { n++; }        // 0 times',
      'do { n++; } while (n < 3);   // at least once',
      'int[] xs = {4, 5};',
      'for (int x : xs) System.out.println("each " + x);'],
    steps: [
      { l: 0, b: [['int i', '0', 'hot'], ['i < 3', 'true', 'ok']], s: 'A <code>for</code> loop has three parts: start (<code>i = 0</code>), condition (checked before each pass) and update (<code>i++</code>, after each pass).' },
      { l: 1, b: [['int i', '0', 'ok'], ['i < 3', 'true', 'ok']], out: 'for 0', s: 'Body runs.' },
      { l: 1, b: [['int i', '1', 'hot'], ['i < 3', 'true', 'ok']], out: 'for 1', s: 'Update, check, body.' },
      { l: 1, b: [['int i', '2', 'hot'], ['i < 3', 'true', 'ok']], out: 'for 2', s: 'Third pass.' },
      { l: 0, b: [['int i', '3', 'hot'], ['i < 3', 'false', 'gc']], s: '<code>i</code> becomes 3, the condition is false, the loop ends. <code>i</code> only exists inside the loop.' },
      { l: 4, b: [['int n', '10', 'ok'], ['n < 3', 'false', 'gc']], s: '<code>while</code> checks <b>first</b>: false, so the body never runs.' },
      { l: 5, b: [['int n', '11', 'chg'], ['n < 3', 'false', 'gc']], s: '<code>do … while</code> runs the body <b>first</b>, then checks. It always runs at least once: n becomes 11.' },
      { l: 7, b: [['int[] xs', '{4, 5}', 'ok'], ['int x', '4', 'hot']], out: 'each 4', s: 'The <b>enhanced for</b> loop (“for each”) gives you each element in turn, with no index to get wrong.' },
      { l: 7, b: [['int[] xs', '{4, 5}', 'ok'], ['int x', '5', 'hot']], out: 'each 5', s: '<code>x</code> is a copy of the element. Assigning to <code>x</code> doesn’t change the array. Use an index loop for that.' }
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

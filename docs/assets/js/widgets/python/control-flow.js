/* Control flow: step through range loops, break/continue, for…else and match, watching variables and output. */
IA.widget('control-flow', (root, ctx) => {
  const SCENES = [
    { name: 'for + range', intro: 'Press <b>Step</b> to run <code>for i in range(1, 7, 2)</code> one iteration at a time.', java: 'for (int i = 1; i < 7; i += 2) { ... }',
      code: ['total = 0', 'for i in range(1, 7, 2):', '    total += i', 'print(total)'],
      steps: [
        { line: 0, vars: [['total', 0, 1]], cap: '<code>total = 0</code>: no type, no <code>int</code> keyword. A name is bound to a value.' },
        { line: 1, vars: [['total', 0], ['i', 1, 1]], cap: '<code>range(1, 7, 2)</code> yields 1, 3, 5: start included, stop <b>excluded</b>, step 2. First <code>i</code> is 1.' },
        { line: 2, vars: [['total', 1, 1], ['i', 1]], cap: 'The indented line is the loop body. Indentation replaces Java’s braces.' },
        { line: 1, vars: [['total', 1], ['i', 3, 1]], cap: 'Next value from range: 3.' },
        { line: 2, vars: [['total', 4, 1], ['i', 3]], cap: '<code>total += i</code> → 4. (There is no <code>i++</code> in Python.)' },
        { line: 1, vars: [['total', 4], ['i', 5, 1]], cap: 'Next: 5. 7 is the stop value, so it never appears.' },
        { line: 2, vars: [['total', 9, 1], ['i', 5]], cap: 'total → 9.' },
        { line: 3, vars: [['total', 9], ['i', 5]], out: '9', cap: 'Loop over. Note <code>i</code> still exists after the loop (value 5): Python loop variables are not block-scoped.' }
      ] },
    { name: 'break / continue', intro: 'Skip odd numbers with <code>continue</code>, stop at the first number over 6 with <code>break</code>.', java: 'same keywords, same meaning: for (int n : nums) { if (...) continue; if (...) break; }',
      code: ['for n in [2, 3, 4, 8, 10]:', '    if n % 2:', '        continue', '    if n > 6:', '        break', '    print(n)'],
      steps: [
        { line: 0, vars: [['n', 2, 1]], cap: 'A <code>for</code> loop walks any iterable directly, like Java’s enhanced for.' },
        { line: 5, vars: [['n', 2]], out: '2', cap: '2 is even and not &gt; 6, so it prints.' },
        { line: 0, vars: [['n', 3, 1]], out: '2', cap: 'Next: 3.' },
        { line: 2, vars: [['n', 3]], out: '2', cap: '<code>n % 2</code> is 1, which is <b>truthy</b>. <code>continue</code> jumps to the next item.' },
        { line: 5, vars: [['n', 4, 1]], out: '2\n4', cap: '4 prints.' },
        { line: 4, vars: [['n', 8, 1]], out: '2\n4', cap: '8 &gt; 6: <code>break</code> leaves the loop. 10 is never seen.' }
      ] },
    { name: 'for … else', intro: 'The <code>else</code> on a loop runs only if the loop <b>finished without break</b>. Here we search for a negative number.', java: 'no equivalent: you would use a boolean found flag, or a labelled break',
      code: ['for x in [4, 7, 1]:', '    if x < 0:', '        print("found", x)', '        break', 'else:', '    print("all non-negative")'],
      steps: [
        { line: 0, vars: [['x', 4, 1]], cap: 'Check 4.' },
        { line: 0, vars: [['x', 7, 1]], cap: 'Check 7.' },
        { line: 0, vars: [['x', 1, 1]], cap: 'Check 1. No item was negative, so <code>break</code> never ran.' },
        { line: 5, vars: [['x', 1]], out: 'all non-negative', cap: 'The loop ran out of items normally, so the <code>else</code> block runs. Read it as “no break”.' }
      ] },
    { name: 'match (3.10+)', intro: '<code>match</code> compares a value against <b>patterns</b> top to bottom; the first that fits wins.', java: 'like a Java 21 switch with record patterns: case Point(int x, int y) -> ...',
      code: ['cmd = ["go", "north"]', 'match cmd:', '    case ["quit"]:', '        print("bye")', '    case ["go", where]:', '        print("moving", where)', '    case _:', '        print("unknown")'],
      steps: [
        { line: 0, vars: [['cmd', "['go', 'north']", 1]], cap: 'A list of two strings.' },
        { line: 2, vars: [['cmd', "['go', 'north']"]], cap: '<code>["quit"]</code> needs a one-item list equal to “quit”. Length 2 ≠ 1: no match.' },
        { line: 4, vars: [['cmd', "['go', 'north']"], ['where', "'north'", 1]], cap: 'Two items, first is “go”: matches. The bare name <code>where</code> <b>captures</b> the second item.' },
        { line: 5, vars: [['cmd', "['go', 'north']"], ['where', "'north'"]], out: 'moving north', cap: 'Only the first matching case runs. There is no fall-through and no <code>break</code> needed. <code>case _</code> is the default.' }
      ] }
  ];
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-pyb-style')) {
    document.head.append(el('style', { id: 'w-pyb-style', text: `
.w-pyb .code{font-family:var(--mono);font-size:12.5px;line-height:1.55;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);padding:8px 0;overflow-x:auto}
.w-pyb .code>div{padding:0 12px;white-space:pre;border-left:3px solid transparent}
.w-pyb .code>div.on{background:var(--accent-soft);border-left-color:var(--accent)}
.w-pyb .out{font-family:var(--mono);font-size:12.5px;border:1px dashed var(--border);border-radius:10px;padding:8px 12px;min-height:2.4em;white-space:pre-wrap;color:var(--text);background:var(--surface)}
.w-pyb .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin:8px 0 4px}
.w-pyb .grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:start}
.w-pyb .java{font-family:var(--mono);font-size:12px;color:var(--text-2);border-left:3px solid var(--warn);padding:4px 10px;margin-top:8px;white-space:pre-wrap}
.w-pyb .vb{fill:var(--surface);stroke:var(--border);stroke-width:1.5}
.w-pyb .vb.hot{stroke:var(--accent);stroke-width:2.5;fill:var(--accent-soft)}
@media (max-width:720px){.w-pyb .grid{grid-template-columns:1fr}}
` }));
  }
  let si = 0, k = 0, gen = 0, running = false;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Example' });
  SCENES.forEach((s, i) => { const b = el('button', { text: s.name, class: i === 0 ? 'on' : '' }); b.addEventListener('click', () => { si = i; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeHost = el('div', { class: 'code' });
  const out = el('div', { class: 'out' });
  const java = el('div', { class: 'java' });
  const stage = svg('svg', { viewBox: '0 0 400 260', role: 'img', 'aria-label': 'Variables and their current values' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-pyb');
  root.append(el('div', { class: 'w-controls' }, seg),
    el('div', { class: 'grid' },
      el('div', null, el('div', { class: 'lbl', text: 'python' }), codeHost, java),
      el('div', null, el('div', { class: 'lbl', text: 'variables' }), el('div', { class: 'w-stage' }, stage), el('div', { class: 'lbl', text: 'output' }), out)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  function render() {
    const S = SCENES[si]; const n = S.steps.length; const cur = k ? S.steps[k - 1] : null;
    codeHost.innerHTML = '';
    S.code.forEach((ln, i) => codeHost.append(el('div', { class: cur && cur.line === i ? 'on' : '', html: ln ? IA.highlight(ln, 'python') : '&nbsp;' })));
    java.textContent = 'Java: ' + S.java;
    out.textContent = cur ? (cur.out || '') : '';
    stage.innerHTML = '';
    const vars = cur ? (cur.vars || []) : [];
    if (!vars.length) stage.append(svg('text', { x: 200, y: 130, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--text-3)', text: 'no variables yet' }));
    vars.forEach(([name, val, hot], i) => {
      const y = 12 + i * 48;
      const g = svg('g', null,
        svg('text', { x: 92, y: y + 25, 'text-anchor': 'end', 'font-size': 14, 'font-family': 'var(--mono)', 'font-weight': 700, fill: 'var(--text)', text: name }),
        svg('line', { x1: 98, y1: y + 20, x2: 118, y2: y + 20, stroke: 'var(--text-3)', 'stroke-width': 1.5 }),
        svg('rect', { class: 'vb' + (hot ? ' hot' : ''), x: 120, y, width: 272, height: 36, rx: 8 }),
        svg('text', { x: 132, y: y + 23, 'font-size': 13, 'font-family': 'var(--mono)', fill: hot ? 'var(--accent)' : 'var(--text-2)', text: String(val) }));
      if (hot && !reduced) { g.style.opacity = '0'; g.style.transition = 'opacity .4s'; requestAnimationFrame(() => requestAnimationFrame(() => { g.style.opacity = '1'; })); }
      stage.append(g);
    });
    narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: `${k}/${n}` }), el('div', { class: 't', html: cur ? cur.cap : S.intro }));
    bStep.disabled = k >= n;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = reduced ? SCENES[si].steps.length : 0; render(); }
  function step() { const n = SCENES[si].steps.length; if (k >= n) return false; k++; render(); return k < n; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', () => { gen++; stop(); k = 0; render(); });
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= SCENES[si].steps.length) { k = 0; render(); }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(reduced ? 900 : 2200); }
    if (g === gen) stop();
  });
  reset();
});

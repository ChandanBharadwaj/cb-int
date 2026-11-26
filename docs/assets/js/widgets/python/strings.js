/* Strings: index ruler for slicing, immutability and split/join. */
(function () {
  /* Shared beginner stepper: code (highlighted line) + output + a state panel that can show
     a character ruler (chars), an expression reduction (expr) and name -> object bindings (vars). */
  function stepper(root, ctx, SC, opts) {
    const { el, svg, sleep, reduced } = ctx;
    if (!document.getElementById('w-pyb-style')) {
      document.head.append(el('style', { id: 'w-pyb-style', text: `
.wpyb-code{font-family:var(--mono);font-size:12.5px;line-height:1.6;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);padding:8px 0;overflow-x:auto}
.wpyb-code>div{padding:0 12px;white-space:pre;border-left:3px solid transparent;min-height:1.6em}
.wpyb-code>div.on{background:var(--accent-soft);border-left-color:var(--accent)}
.wpyb-out{font-family:var(--mono);font-size:12.5px;border:1px dashed var(--border);border-radius:10px;padding:8px 12px;min-height:2.4em;white-space:pre-wrap;color:var(--text);background:var(--surface)}
.wpyb-out .err{color:var(--err)}
.wpyb-lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin:8px 0 4px}
.wpyb-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:start}
@media (max-width:720px){.wpyb-grid{grid-template-columns:1fr}}
.wpyb .nb{fill:var(--surface);stroke:var(--border);stroke-width:1.5}
.wpyb .ob{fill:var(--surface);stroke:var(--border);stroke-width:1.5}
.wpyb .ob.chg{stroke:var(--warn);stroke-width:2.5;fill:color-mix(in srgb,var(--warn) 12%,var(--surface))}
.wpyb .ar{fill:none;stroke:var(--accent);stroke-width:2}
.wpyb .cb{fill:var(--surface);stroke:var(--border);stroke-width:1.5}
.wpyb .cb.hi{fill:var(--accent-soft);stroke:var(--accent);stroke-width:2.5}
.wpyb .ex{fill:var(--surface-2);stroke:var(--border)}
.wpyb .ex.last{stroke:var(--accent);stroke-width:2}
` }));
    }
    const TYPE_COL = { int: 'var(--accent)', float: 'var(--warn)', str: 'var(--accent-2)', bool: 'var(--ok)', NoneType: 'var(--text-3)', list: 'var(--accent)', function: 'var(--text-3)', error: 'var(--err)' };
    let si = 0; let k = 0; let running = false; let gen = 0; let st;
    root.classList.add('wpyb');
    const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scenario' });
    SC.forEach((s, i) => { const b = el('button', { text: s.label, class: i === 0 ? 'on' : '' });
      b.addEventListener('click', () => { si = i; [...seg.children].forEach((c, j) => c.classList.toggle('on', j === i)); reset(); }); seg.append(b); });
    const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
    const bStep = el('button', { class: 'btn', text: 'Step ›' });
    const bReset = el('button', { class: 'btn', text: '↺ Reset' });
    const codeBox = el('div', { class: 'wpyb-code' });
    const outBox = el('div', { class: 'wpyb-out', 'aria-live': 'polite' });
    const stage = svg('svg', { viewBox: '0 0 420 120', role: 'img', 'aria-label': opts.aria || 'Program state' });
    const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
    const stepInfo = el('span', { class: 'tiny' });
    root.append(el('div', { class: 'w-controls' }, seg),
      el('div', { class: 'wpyb-grid' },
        el('div', null, el('div', { class: 'wpyb-lbl', text: opts.codeLabel || 'code' }), codeBox, el('div', { class: 'wpyb-lbl', text: 'output' }), outBox),
        el('div', null, el('div', { class: 'wpyb-lbl', text: opts.stageLabel || 'what Python holds' }), el('div', { class: 'w-stage' }, stage))),
      el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, stepInfo), cap);

    function txt(x, y, t, a) { return svg('text', Object.assign({ x, y, 'font-size': 13, fill: 'var(--text)', text: t }, a || {})); }
    function draw() {
      stage.innerHTML = ''; let y = 8;
      if (st.chars) {
        const c = st.chars; const n = c.s.length; const bw = Math.min(44, Math.floor(400 / Math.max(n, 1))); const x0 = (420 - bw * n) / 2;
        if (c.label) { stage.append(txt(210, y + 14, c.label, { 'text-anchor': 'middle', 'font-family': 'var(--mono)', 'font-weight': 700, fill: 'var(--accent)' })); }
        y += 24;
        stage.append(txt(x0 - 4, y + 10, '+', { 'font-size': 10, fill: 'var(--text-3)', 'text-anchor': 'end' }));
        for (let i = 0; i < n; i++) {
          const hi = (c.hi || []).includes(i);
          stage.append(txt(x0 + i * bw + bw / 2, y + 10, String(i), { 'font-size': 10, fill: 'var(--text-3)', 'text-anchor': 'middle' }));
          stage.append(svg('rect', { class: 'cb' + (hi ? ' hi' : ''), x: x0 + i * bw + 1, y: y + 16, width: bw - 2, height: 34, rx: 5 }));
          stage.append(txt(x0 + i * bw + bw / 2, y + 38, c.s[i] === ' ' ? '␣' : c.s[i], { 'font-size': 16, 'font-family': 'var(--mono)', 'text-anchor': 'middle', 'font-weight': hi ? 700 : 400 }));
          stage.append(txt(x0 + i * bw + bw / 2, y + 64, String(i - n), { 'font-size': 10, fill: 'var(--text-3)', 'text-anchor': 'middle' }));
        }
        stage.append(txt(x0 - 4, y + 64, '−', { 'font-size': 10, fill: 'var(--text-3)', 'text-anchor': 'end' }));
        y += 76;
        if (c.result != null) { stage.append(txt(210, y + 12, '→ ' + c.result, { 'text-anchor': 'middle', 'font-family': 'var(--mono)', 'font-weight': 700 })); y += 22; }
        y += 6;
      }
      if (st.expr) {
        st.expr.forEach((e, i) => {
          const last = i === st.expr.length - 1;
          stage.append(svg('rect', { class: 'ex' + (last ? ' last' : ''), x: 30, y, width: 380, height: 26, rx: 6 }));
          if (i) stage.append(txt(16, y + 18, '→', { fill: 'var(--text-3)', 'text-anchor': 'middle' }));
          stage.append(txt(42, y + 18, e, { 'font-family': 'var(--mono)', 'font-weight': last ? 700 : 400 }));
          y += 32;
        });
        y += 6;
      }
      if (st.vars && st.vars.length) {
        st.vars.forEach(([name, type, val]) => {
          const chg = (st.chg || []).includes(name);
          stage.append(svg('rect', { class: 'nb', x: 4, y, width: 96, height: 30, rx: 6 }));
          stage.append(txt(52, y + 20, name, { 'text-anchor': 'middle', 'font-family': 'var(--mono)', 'font-weight': 700 }));
          stage.append(svg('path', { class: 'ar', d: `M100 ${y + 15} L142 ${y + 15}` }));
          stage.append(svg('path', { d: `M142 ${y + 15} l-7 -4 v8 z`, fill: 'var(--accent)' }));
          stage.append(svg('rect', { class: 'ob' + (chg ? ' chg' : ''), x: 146, y, width: 270, height: 30, rx: 6 }));
          stage.append(svg('rect', { x: 150, y: y + 6, width: 70, height: 18, rx: 9, fill: TYPE_COL[type] || 'var(--text-3)', opacity: 0.18 }));
          stage.append(txt(185, y + 19, type, { 'font-size': 11, 'text-anchor': 'middle', fill: TYPE_COL[type] || 'var(--text-3)', 'font-weight': 700 }));
          stage.append(txt(228, y + 20, val, { 'font-family': 'var(--mono)' }));
          y += 38;
        });
      }
      if (y <= 8) stage.append(txt(210, 40, opts.empty || '(nothing yet)', { 'text-anchor': 'middle', fill: 'var(--text-3)' }));
      stage.setAttribute('viewBox', `0 0 420 ${Math.max(y + 4, 60)}`);
    }
    function paintCode() {
      const s = SC[si];
      [...codeBox.children].forEach((d, i) => d.classList.toggle('on', i === st.line));
      outBox.innerHTML = '';
      st.out.forEach((o) => outBox.append(el('div', { class: o.err ? 'err' : '', text: o.t })));
      stepInfo.textContent = `step ${k} / ${s.steps.length}`;
    }
    function reset() {
      gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; const s = SC[si];
      st = { line: -1, vars: [], out: [], chars: null, expr: null, chg: [] };
      codeBox.innerHTML = '';
      s.code.forEach((l) => codeBox.append(el('div', { html: IA.highlight(l || ' ', s.lang || 'python') })));
      cap.firstChild.innerHTML = s.intro || 'Press <b>Play</b> or <b>Step</b> to run one line at a time.';
      bStep.disabled = false; draw(); paintCode();
    }
    function step() {
      const s = SC[si]; if (k >= s.steps.length) return false;
      const p = s.steps[k++];
      if (p.line != null) st.line = p.line;
      if (p.vars) st.vars = p.vars;
      if ('chars' in p) st.chars = p.chars;
      if ('expr' in p) st.expr = p.expr;
      st.chg = p.chg || [];
      if (p.out != null) String(p.out).split('\n').forEach((t) => st.out.push({ t, err: !!p.err }));
      cap.firstChild.innerHTML = p.cap;
      draw(); paintCode();
      if (k >= s.steps.length) bStep.disabled = true;
      return true;
    }
    bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
    bReset.addEventListener('click', reset);
    bPlay.addEventListener('click', async () => {
      if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
      if (k >= SC[si].steps.length) reset();
      if (reduced) { while (step()); return; }
      running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
      while (running && g === gen && step()) await sleep(2200);
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    });
    reset();
  }
  IA.widget('strings', (root, ctx) => {
  const SC = [
    { label: 'Index & slice', code: ['s = "Python"', 's[0]', 's[-1]', 's[1:4]', 's[::2]', 's[::-1]'],
      intro: 'Every character has two indexes: from the front (0, 1, 2…) and from the back (−1, −2…). A slice <code>[start:stop:step]</code> includes start and <b>excludes</b> stop.',
      steps: [
        { line: 0, vars: [['s', 'str', '"Python"']], chars: { s: 'Python', hi: [], label: 's' }, chg: ['s'], cap: 'A str is an immutable sequence of Unicode characters.' },
        { line: 1, chars: { s: 'Python', hi: [0], label: 's[0]', result: "'P'" }, cap: 'Indexing gives a one-character string. Python has no separate <code>char</code> type.' },
        { line: 2, chars: { s: 'Python', hi: [5], label: 's[-1]', result: "'n'" }, cap: 'Negative indexes count from the end: <code>s[-1]</code> is <code>s[len(s)-1]</code>.' },
        { line: 3, chars: { s: 'Python', hi: [1, 2, 3], label: 's[1:4]', result: "'yth'" }, cap: 'Indexes 1, 2, 3. Stop (4) is excluded, like Java’s <code>substring(1, 4)</code>.' },
        { line: 4, chars: { s: 'Python', hi: [0, 2, 4], label: 's[::2]', result: "'Pto'" }, cap: 'Omitted start/stop mean “from the beginning / to the end”. Step 2 takes every second character.' },
        { line: 5, chars: { s: 'Python', hi: [0, 1, 2, 3, 4, 5], label: 's[::-1]', result: "'nohtyP'" }, cap: 'A negative step walks backwards: the idiomatic way to reverse a string. Slices never raise <code>IndexError</code>; out-of-range bounds are clipped.' }
      ] },
    { label: 'Immutability', code: ['s = "cat"', 't = s.upper()', 's[0] = "b"', 's = "b" + s[1:]'],
      intro: 'Strings cannot change. Every “modifying” method returns a <b>new</b> string.',
      steps: [
        { line: 0, vars: [['s', 'str', '"cat"']], chars: { s: 'cat', hi: [], label: 's' }, chg: ['s'], cap: 'One str object.' },
        { line: 1, vars: [['s', 'str', '"cat"'], ['t', 'str', '"CAT"']], chg: ['t'], cap: '<code>upper()</code> builds a new object. <code>s</code> is untouched. Same as Java’s <code>String</code>.' },
        { line: 2, out: "TypeError: 'str' object does not support item assignment", err: true, chars: { s: 'cat', hi: [0], label: 's[0] = "b"' }, cap: 'You cannot assign into a string.' },
        { line: 3, vars: [['s', 'str', '"bat"'], ['t', 'str', '"CAT"']], chars: { s: 'bat', hi: [0], label: 's (rebound)' }, chg: ['s'], cap: 'Build a new string and <b>rebind</b> the name. The old <code>"cat"</code> object is freed when nothing refers to it.' }
      ] },
    { label: 'split & join', code: ['line = "a,b,c"', 'parts = line.split(",")', 'out = "-".join(parts)', 'print(parts, out)'],
      intro: '<code>split</code> turns one string into a list; <code>join</code> turns a list back into one string.',
      steps: [
        { line: 0, vars: [['line', 'str', '"a,b,c"']], chars: { s: 'a,b,c', hi: [1, 3], label: 'separators' }, chg: ['line'], cap: 'The commas are the separators.' },
        { line: 1, vars: [['line', 'str', '"a,b,c"'], ['parts', 'list', "['a', 'b', 'c']"]], chg: ['parts'], cap: '<code>split(",")</code> cuts at each comma. With no argument, <code>split()</code> splits on runs of whitespace and drops empty pieces.' },
        { line: 2, vars: [['line', 'str', '"a,b,c"'], ['parts', 'list', "['a', 'b', 'c']"], ['out', 'str', '"a-b-c"']], chars: { s: 'a-b-c', hi: [1, 3], label: '"-".join(parts)' }, chg: ['out'], cap: '<code>join</code> is a method on the <b>separator</b>, not on the list. Java: <code>String.join("-", parts)</code>.' },
        { line: 3, out: "['a', 'b', 'c'] a-b-c", cap: 'Joining a list is linear time. Building a string with <code>+=</code> in a loop can be quadratic in general; prefer <code>join</code>.' }
      ] }
  ];
  stepper(root, ctx, SC, { aria: 'String characters with positive and negative indexes', stageLabel: 'characters & names', empty: 'nothing yet' });
  });
})();

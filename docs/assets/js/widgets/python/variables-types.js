/* Variables & types: a name is rebound to objects of different types; casting builds new objects. */
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
  IA.widget('variables-types', (root, ctx) => {
  const SC = [
    { label: 'Dynamic typing', code: ['x = 42', 'x = 3.5', 'x = "hi"', 'x = None', 'print(type(x))'],
      intro: 'In Java the <i>variable</i> has a type. In Python the <i>object</i> has the type, and a name can point at anything.',
      steps: [
        { line: 0, vars: [['x', 'int', '42']], chg: ['x'], cap: 'An int object 42 is created and the name <code>x</code> is bound to it. No <code>int x</code> declaration.' },
        { line: 1, vars: [['x', 'float', '3.5']], chg: ['x'], cap: 'Rebinding: <code>x</code> now points at a float. Legal. In Java this line would not compile.' },
        { line: 2, vars: [['x', 'str', '"hi"']], chg: ['x'], cap: 'Now a str. The <b>type travels with the object</b>, not with the name.' },
        { line: 3, vars: [['x', 'NoneType', 'None']], chg: ['x'], cap: '<code>None</code> is Python’s “no value”, like Java <code>null</code>. It is a real object, the only instance of <code>NoneType</code>.' },
        { line: 4, out: "<class 'NoneType'>", cap: '<code>type(obj)</code> tells you the type at run time. Python is dynamically typed but <b>strongly</b> typed: it won’t silently mix types.' }
      ] },
    { label: 'Casting', code: ['s = "42"', 'n = int(s)', 'f = float(s)', 'b = bool(s)', 'print(n + 1, f, b)', 'int("4.2")'],
      intro: 'Conversions are explicit calls: <code>int()</code>, <code>float()</code>, <code>str()</code>, <code>bool()</code>. Each builds a <b>new</b> object.',
      steps: [
        { line: 0, vars: [['s', 'str', '"42"']], chg: ['s'], cap: 'Text from input, a file or an HTTP request is always a str.' },
        { line: 1, vars: [['s', 'str', '"42"'], ['n', 'int', '42']], chg: ['n'], cap: '<code>int("42")</code> parses the text, like <code>Integer.parseInt</code>. <code>s</code> is unchanged.' },
        { line: 2, vars: [['s', 'str', '"42"'], ['n', 'int', '42'], ['f', 'float', '42.0']], chg: ['f'], cap: '<code>float()</code> parses to a 64-bit IEEE 754 double (Java’s <code>double</code>).' },
        { line: 3, vars: [['s', 'str', '"42"'], ['n', 'int', '42'], ['f', 'float', '42.0'], ['b', 'bool', 'True']], chg: ['b'], cap: '<code>bool(str)</code> is True for any <b>non-empty</b> string, even <code>"False"</code> or <code>"0"</code>. It does not parse.' },
        { line: 4, out: '43 42.0 True', cap: '<code>"42" + 1</code> would raise <code>TypeError</code>. Convert first, then do arithmetic.' },
        { line: 5, out: "ValueError: invalid literal for int() with base 10: '4.2'", err: true, cap: '<code>int()</code> on text needs a whole-number string. Use <code>int(float("4.2"))</code> if you really mean truncation.' }
      ] },
    { label: 'Big ints & bool', code: ['big = 2 ** 64', 't = True', 'print(big)', 'print(t + t, isinstance(t, int))'],
      intro: 'Python’s int has no fixed size, and bool is a subclass of int.',
      steps: [
        { line: 0, vars: [['big', 'int', '18446744073709551616']], chg: ['big'], cap: 'No overflow: int grows as needed (arbitrary precision). Java’s <code>long</code> would have wrapped; you would need <code>BigInteger</code>.' },
        { line: 1, vars: [['big', 'int', '18446744073709551616'], ['t', 'bool', 'True']], chg: ['t'], cap: '<code>True</code> and <code>False</code> are capitalised. They are singletons.' },
        { line: 2, out: '18446744073709551616', cap: 'Printed exactly.' },
        { line: 3, out: '2 True', cap: '<code>True</code> behaves as 1 and <code>False</code> as 0 in arithmetic, because <code>bool</code> subclasses <code>int</code>.' }
      ] }
  ];
  stepper(root, ctx, SC, { aria: 'Names and the typed objects they point to', stageLabel: 'name → object (type, value)', empty: 'no names yet' });
  });
})();

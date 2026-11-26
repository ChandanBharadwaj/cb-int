/* Running Python: step a script top to bottom, see indentation as syntax, and compare the REPL with a script. */
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
  IA.widget('py-setup-first-program', (root, ctx) => {
  const SC = [
    { label: 'Script, top to bottom', code: ['# hello.py: run with  python3 hello.py', 'print("Hello")', 'name = "Ada"', 'def greet(who):', '    print("Hi", who)', 'greet(name)', 'print("bye")'],
      intro: 'A script has no <code>main</code>. Python starts at line 1 and runs each statement in order. Press <b>Step</b>.',
      steps: [
        { line: 0, cap: 'A line starting with <code>#</code> is a <b>comment</b>. Python skips it.' },
        { line: 1, out: 'Hello', cap: '<code>print()</code> writes its arguments to stdout and adds a newline. No class, no <code>System.out</code>, no semicolon.' },
        { line: 2, vars: [['name', 'str', '"Ada"']], chg: ['name'], cap: 'An assignment creates the name <code>name</code> and binds it to a str object. No type declaration.' },
        { line: 3, vars: [['name', 'str', '"Ada"'], ['greet', 'function', 'greet(who)']], chg: ['greet'], cap: '<code>def</code> is a statement too. Running it <b>creates a function object</b> and binds it to <code>greet</code>. The body does not run yet.' },
        { line: 5, cap: 'Now the function is called. Python jumps into the indented body.' },
        { line: 4, out: 'Hi Ada', cap: 'The body is the indented block under <code>def</code>. <code>print</code> with several arguments puts one space between them.' },
        { line: 6, out: 'bye', cap: 'The block ended where the indentation went back. The script ends after the last line; the process exits with status 0.' }
      ] },
    { label: 'Indentation is syntax', code: ['x = 7', 'if x > 5:', '    print("big")', '    print("still inside if")', 'print("always")'],
      intro: 'Python has no <code>{ }</code> for blocks. The colon opens a block; the indentation <i>is</i> the block.',
      steps: [
        { line: 0, vars: [['x', 'int', '7']], chg: ['x'], cap: 'Bind <code>x</code> to the int 7.' },
        { line: 1, cap: '<code>if x &gt; 5:</code> is True. The colon says “an indented block follows”. No parentheses needed around the condition.' },
        { line: 2, out: 'big', cap: 'Lines indented under the <code>if</code> (4 spaces, by convention) belong to it.' },
        { line: 3, out: 'still inside if', cap: 'Same indentation, same block. In Java you would need braces to get two statements inside the <code>if</code>.' },
        { line: 4, out: 'always', cap: 'Back at column 0: the block is over. Indent this line by mistake and it would only run when <code>x &gt; 5</code>. No compiler warning, just different behaviour.' }
      ] },
    { label: 'REPL vs script', lang: 'python', code: ['>>> 2 + 3', '>>> x = 10', '>>> x * 2', '>>> "hi"', '>>> print("hi")'],
      intro: 'Run <code>python3</code> with no file and you get the <b>REPL</b> (read–eval–print loop). It echoes the value of each expression.',
      steps: [
        { line: 0, out: '5', cap: 'The REPL evaluates the expression and <b>echoes its repr</b>. In a script, a bare <code>2 + 3</code> line prints nothing.' },
        { line: 1, vars: [['x', 'int', '10']], chg: ['x'], cap: 'Assignments are statements, not expressions, so the REPL echoes nothing.' },
        { line: 2, out: '20', cap: 'Names persist for the whole REPL session.' },
        { line: 3, out: "'hi'", cap: 'Echo uses <code>repr()</code>, so a string shows its quotes. That is the developer view.' },
        { line: 4, out: 'hi', cap: '<code>print()</code> uses <code>str()</code>: no quotes. <code>print</code> returns <code>None</code>, and the REPL never echoes <code>None</code>. In a script, always use <code>print</code>.' }
      ] }
  ];
  stepper(root, ctx, SC, { aria: 'Names created by the program so far', stageLabel: 'names in memory', empty: 'no names yet' });
  });
})();

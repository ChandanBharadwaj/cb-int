/* Running Node: terminal session with nvm, the REPL, a first script and npm scripts. */
IA.widget('node-setup-first-script', (root, ctx) => {
  /* ---- shared step-through player (code on the left, state picture on the right) ---- */
  const { el, svg, sleep, reduced } = ctx;
  function stepper(cfg) {
    const uid = 'nb' + Math.random().toString(36).slice(2, 8);
    if (!document.getElementById('w-nb-style')) {
      document.head.append(el('style', { id: 'w-nb-style', text: `
.w-nb-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; align-items: start; }
.w-nb-code pre { margin: 0; }
.w-nb-code .ln { display: block; padding: 0 6px; border-left: 3px solid transparent; border-radius: 3px; white-space: pre; }
.w-nb-code .ln.cur { background: var(--accent-soft); border-left-color: var(--accent); }
.w-nb-code .ln.done { opacity: .55; }
.w-nb .bx { fill: var(--surface); stroke: var(--border); }
.w-nb .bx.hot { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2; }
.w-nb .bx.ok { stroke: var(--ok); stroke-width: 2; }
.w-nb .bx.err { stroke: var(--err); stroke-width: 2; fill: color-mix(in srgb, var(--err) 10%, var(--surface)); }
.w-nb .bx.warn { stroke: var(--warn); stroke-width: 2; }
.w-nb .bx.dim { opacity: .45; }
.w-nb .bx.lane { fill: var(--surface-2); }
.w-nb .tt { fill: var(--text); font-size: 13px; font-family: var(--mono); }
.w-nb .tt.h { font-family: var(--sans); font-weight: 700; font-size: 13px; }
.w-nb .tt.m { fill: var(--text-3); font-size: 11px; font-family: var(--sans); }
.w-nb .tt.ok { fill: var(--ok); } .w-nb .tt.err { fill: var(--err); } .w-nb .tt.acc { fill: var(--accent); } .w-nb .tt.warn { fill: var(--warn); }
.w-nb .ar { stroke: var(--text-3); stroke-width: 1.6; fill: none; }
.w-nb .ar.hot { stroke: var(--accent); stroke-width: 2.2; }
.w-nb .fresh { animation: nbIn .45s ease both; }
@keyframes nbIn { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .w-nb .fresh { animation: none; } }
` }));
    }
    root.classList.add('w-nb');
    const modes = cfg.modes;
    let mi = 0; let k = 0; let gen = 0; let running = false; let speed = 2600;
    const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': cfg.modeLabel || 'Example' });
    modes.forEach((m, i) => { const b = el('button', { text: m.label, class: i === 0 ? 'on' : '' }); b.addEventListener('click', () => { mi = i; [...seg.children].forEach((x, j) => x.classList.toggle('on', j === i)); reset(); }); seg.append(b); });
    const pre = el('pre'); const codeHost = el('div', { class: 'codebox w-nb-code' }, el('div', { class: 'ch' }, el('span', { class: 'fname' })), pre);
    const W = cfg.W || 420, H = cfg.H || 300;
    const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': cfg.aria || 'Step-by-step picture of the program state' });
    const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('span', { class: 'n', text: '0' }), el('div', { class: 't', text: 'Press Play, or Step to go one line at a time.' }));
    const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
    const bStep = el('button', { class: 'btn', text: 'Step ›' });
    const bReset = el('button', { class: 'btn', text: '↺ Reset' });
    const segS = el('div', { class: 'seg', 'aria-label': 'Speed' });
    [['Slow', 3800], ['Normal', 2600], ['Fast', 1300]].forEach(([l, v]) => { const b = el('button', { text: l, class: v === speed ? 'on' : '' }); b.addEventListener('click', () => { speed = v; [...segS.children].forEach((x) => x.classList.toggle('on', x === b)); }); segS.append(b); });
    root.append(modes.length > 1 ? el('div', { class: 'w-controls' }, seg) : '',
      el('div', { class: 'w-nb-grid' }, codeHost, el('div', { class: 'w-stage' }, stage)),
      el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr);
    // drawing helpers handed to cfg.draw
    const defs = svg('defs', null, svg('marker', { id: uid + 'a', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--text-3)' })),
      svg('marker', { id: uid + 'h', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--accent)' })));
    const D = {
      box: (x, y, w, h, cls, fresh) => svg('rect', { x, y, width: w, height: h, rx: 7, class: 'bx ' + (cls || '') + (fresh ? ' fresh' : '') }),
      t: (x, y, s, cls, anchor, fresh) => svg('text', { x, y, class: 'tt ' + (cls || '') + (fresh ? ' fresh' : ''), 'text-anchor': anchor || 'start', text: String(s) }),
      ar: (x1, y1, x2, y2, hot, curve) => svg('path', { d: curve ? `M${x1},${y1} C${x1 + curve},${y1} ${x2 + curve},${y2} ${x2},${y2}` : `M${x1},${y1} L${x2},${y2}`, class: 'ar' + (hot ? ' hot' : ''), 'marker-end': `url(#${uid}${hot ? 'h' : 'a'})` }),
      W, H
    };
    let lineEls = [];
    function renderCode() {
      const m = modes[mi]; pre.innerHTML = '';
      codeHost.querySelector('.fname').textContent = m.file || 'example.js';
      lineEls = m.code.split('\n').map((ln) => { const s = el('span', { class: 'ln' }); s.innerHTML = IA.highlight(ln || ' ', m.lang || 'js'); pre.append(s); return s; });
    }
    function show(i) {
      const m = modes[mi]; const st = m.steps[i];
      lineEls.forEach((l, j) => { const cur = st && [].concat(st.line == null ? [] : st.line).includes(j + 1); l.classList.toggle('cur', cur); });
      stage.innerHTML = ''; stage.append(defs);
      const g = svg('g'); stage.append(g);
      cfg.draw(g, st || null, D, i, m);
      narr.className = 'caption' + (st && st.tone ? ' ' + st.tone : '');
      narr.firstChild.textContent = st ? `${i + 1}/${m.steps.length}` : '0';
      narr.lastChild.innerHTML = st ? st.cap : (m.intro || 'Press Play, or Step to go one line at a time.');
    }
    function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; renderCode(); if (reduced) { k = modes[mi].steps.length; show(k - 1); } else show(-1); }
    function step() { const n = modes[mi].steps.length; if (k >= n) return false; show(k); k++; return k < n; }
    async function play() {
      if (running) { gen++; running = false; bPlay.textContent = '▶ Play'; return; }
      if (k >= modes[mi].steps.length) reset();
      if (reduced) { k = modes[mi].steps.length; show(k - 1); return; }
      const g = ++gen; running = true; bPlay.textContent = '❚❚ Pause';
      while (g === gen && step()) { await sleep(speed); }
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    }
    bPlay.addEventListener('click', play);
    bStep.addEventListener('click', () => { gen++; running = false; bPlay.textContent = '▶ Play'; if (k >= modes[mi].steps.length) reset(); step(); });
    bReset.addEventListener('click', reset);
    reset();
  }
  const T = (lines, files, hot, extra) => Object.assign({ term: lines, files, hot }, extra);
  const F0 = [];
  const F1 = [['hello/', 'folder'], ['package.json', 'name, version, scripts']];
  const F2 = [...F1, ['index.js', 'your script']];
  const F3 = [['hello/', 'folder'], ['package.json', 'scripts.start added'], ['index.js', 'your script']];
  const s1 = [
    { line: 1, cap: '<b>nvm</b> (Node Version Manager) downloads Node 22 into your home folder. No admin rights, and you can keep several versions side by side, like SDKMAN! for JDKs.', ...T(['$ nvm install 22', 'Downloading node v22.x …', 'Now using node v22.x (npm v10.x)'], F0) },
    { line: 2, cap: '<code>nvm use 22</code> switches this shell to Node 22. A <code>.nvmrc</code> file containing <code>22</code> lets the whole team run plain <code>nvm use</code>.', ...T(['$ nvm install 22', 'Now using node v22.x (npm v10.x)', '$ nvm use 22', 'Now using node v22.x'], F0) },
    { line: 3, cap: 'Check what you are running. The output is something like <code>v22.11.0</code>. Node 22 is an LTS (long-term support) line.', ...T(['$ nvm use 22', 'Now using node v22.x', '$ node -v', 'v22.11.0'], F0) },
    { line: 4, cap: 'Plain <code>node</code> with no file starts the <b>REPL</b> (Read–Eval–Print Loop). It is like <code>jshell</code>: type an expression, see its value.', ...T(['$ node -v', 'v22.11.0', '$ node', 'Welcome to Node.js v22.11.0.', '>'], F0) },
    { line: 5, cap: 'The REPL prints the value of each expression. No <code>main</code>, no class, no compile step.', ...T(['$ node', 'Welcome to Node.js v22.11.0.', '> 1 + 1', '2'], F0) },
    { line: 6, cap: 'A declaration has no value, so the REPL prints <code>undefined</code>. That is normal, not an error.', ...T(['> 1 + 1', '2', "> const name = 'Ada'", 'undefined'], F0) },
    { line: 7, cap: 'Back-ticks make a <b>template literal</b>: <code>${…}</code> drops a value into the string, like <code>String.format</code> but inline.', ...T(['> 1 + 1', '2', "> const name = 'Ada'", 'undefined', '> `hi ${name}`', "'hi Ada'"], F0) },
    { line: 8, cap: '<code>.exit</code> (or Ctrl+D, or Ctrl+C twice) leaves the REPL and returns to the shell.', tone: 'ok', ...T(['> `hi ${name}`', "'hi Ada'", '> .exit', '$'], F0) }
  ];
  const s2 = [
    { line: 1, cap: 'A Node project is just a folder. There is no required layout like Maven’s <code>src/main/java</code>.', ...T(['$ mkdir hello && cd hello'], [['hello/', 'empty folder']], 'hello/') },
    { line: 2, cap: '<code>npm init -y</code> writes <b>package.json</b>: the project’s name, version, scripts and dependencies. Think <code>pom.xml</code>, but JSON and much shorter.', ...T(['$ mkdir hello && cd hello', '$ npm init -y', 'Wrote to …/hello/package.json'], F1, 'package.json') },
    { line: 3, cap: 'A script is any <code>.js</code> file. Top-level code runs from top to bottom. <code>process.argv</code> is the command line: [node path, script path, …your args].', ...T(['$ npm init -y', 'Wrote to …/hello/package.json', '$ echo "console.log(…)" > index.js'], F2, 'index.js') },
    { line: 4, cap: '<code>node index.js Ada</code> runs the file. <code>process.argv[2]</code> is the first argument you typed, so it prints <code>Hello Ada</code>.', tone: 'ok', ...T(['$ node index.js Ada', 'Hello Ada'], F2, 'index.js') },
    { line: 5, cap: '<b>scripts</b> in package.json are named shell commands: <code>"start": "node index.js"</code>. Teams put build, test and lint commands here.', ...T(['$ node index.js Ada', 'Hello Ada', '$ npm pkg set scripts.start="node index.js"'], F3, 'package.json') },
    { line: 6, cap: '<code>npm run start</code> runs that command. Arguments after <code>--</code> are passed through to your script, so it prints <code>Hello Bob</code>. <code>npm start</code> and <code>npm test</code> also work without <code>run</code>.', tone: 'ok', ...T(['$ npm run start -- Bob', '', '> hello@1.0.0 start', '> node index.js Bob', '', 'Hello Bob'], F3, 'package.json') }
  ];
  stepper({
    W: 420, H: 270, aria: 'A terminal on the left and the project folder on the right',
    modes: [
      { label: 'Install & REPL', file: 'terminal', lang: 'bash', code: "nvm install 22\nnvm use 22\nnode -v\nnode\n> 1 + 1\n> const name = 'Ada'\n> `hi ${name}`\n> .exit", steps: s1 },
      { label: 'Script & npm scripts', file: 'terminal', lang: 'bash', code: "mkdir hello && cd hello\nnpm init -y\necho \"console.log('Hello', process.argv[2])\" > index.js\nnode index.js Ada\nnpm pkg set scripts.start=\"node index.js\"\nnpm run start -- Bob", steps: s2 }
    ],
    draw(g, st, D) {
      g.append(D.box(6, 6, 262, 258, 'lane'), D.t(16, 26, 'terminal', 'h'));
      g.append(D.box(278, 6, 136, 258, 'lane'), D.t(288, 26, 'project folder', 'h'));
      if (!st) { g.append(D.t(16, 52, '$', 'm')); return; }
      st.term.slice(-10).forEach((l, i, a) => g.append(D.t(16, 52 + i * 21, l.length > 31 ? l.slice(0, 30) + '…' : l, l.startsWith('$') || l.startsWith('>') ? 'acc' : '', 'start', i === a.length - 1)));
      if (!st.files.length) g.append(D.t(288, 52, '(nothing yet)', 'm'));
      st.files.forEach(([n, d], i) => { const y = 40 + i * 58; const hot = n === st.hot; g.append(D.box(286, y, 120, 48, hot ? 'hot' : '', hot), D.t(294, y + 20, n), D.t(294, y + 38, d, 'm')); });
    }
  });
});

/* Running Java: follow Main.java through javac, the .class file and the JVM; compare with single-file mode and JShell. */
IA.widget('java-setup-first-program', (root, ctx) => {
  const ARIA = 'The stages a Java program passes through: source file, compiler, bytecode file and JVM, with what each holds at every step';
  const INTRO = 'Pick a way to run Java, then press <b>Play</b> or <b>Step</b>. The left side is what you type; the boxes on the right are the files and programs involved. Orange outline = what is happening now, green = done, red = an error.';
  const SC = {
    classic: { label: 'javac + java', head: 'files & tools', lang: 'bash', outHead: 'terminal', code: [
      '# Main.java',
      'public class Main {',
      '    public static void main(String[] args) {',
      '        System.out.println("Hello, Java!");',
      '    }',
      '}',
      '$ javac Main.java',
      '$ ls',
      '$ java Main'],
    steps: [
      { l: [1, 2, 3, 4, 5], b: [['1 · source', 'Main.java (text)', 'hot'], ['2 · compiler', 'javac (in the JDK)', 'gc'], ['3 · bytecode', 'Main.class (not yet)', 'gc'], ['4 · runtime', 'JVM (java)', 'gc']], s: 'You write <b>source code</b> in a plain text file. The file name must match the <code>public class</code> name: <code>Main</code> → <code>Main.java</code>.' },
      { l: 6, b: [['1 · source', 'Main.java', 'ok'], ['2 · compiler', 'javac checks types…', 'hot'], ['3 · bytecode', 'Main.class (not yet)', 'gc'], ['4 · runtime', 'JVM (java)', 'gc']], s: '<code>javac</code> is the Java <b>compiler</b>. It reads the source, checks syntax and types, and refuses to continue if something is wrong.' },
      { l: 7, b: [['1 · source', 'Main.java', 'ok'], ['2 · compiler', 'javac: no errors', 'ok'], ['3 · bytecode', 'Main.class (bytes)', 'hot'], ['4 · runtime', 'JVM (java)', 'gc']], out: 'Main.class  Main.java', s: 'Success prints nothing. A new file appears: <code>Main.class</code>. It holds <b>bytecode</b>: instructions for the JVM, not for your CPU.' },
      { l: 8, b: [['1 · source', 'Main.java', 'ok'], ['2 · compiler', 'javac', 'ok'], ['3 · bytecode', 'Main.class', 'ok'], ['4 · runtime', 'JVM finds main(…)', 'hot']], s: '<code>java Main</code> starts the <b>JVM</b>. Note: the class name, <i>not</i> <code>Main.class</code>. The JVM loads the class and looks for <code>public static void main(String[] args)</code>.' },
      { l: 3, b: [['1 · source', 'Main.java', 'ok'], ['2 · compiler', 'javac', 'ok'], ['3 · bytecode', 'Main.class', 'ok'], ['4 · runtime', 'JVM runs main', 'ok']], out: 'Hello, Java!', s: 'The JVM runs <code>main</code> line by line. <code>System.out.println</code> writes a line to the terminal. When <code>main</code> returns, the program ends.' }
    ] },
    single: { label: 'java Main.java', head: 'files & tools', lang: 'bash', outHead: 'terminal', code: [
      '# same Main.java as before',
      '$ java Main.java',
      '$ ls',
      '$ java Main.java Ada Linus'],
    steps: [
      { l: 1, b: [['1 · source', 'Main.java', 'ok'], ['2 · compiler', 'built into java', 'hot'], ['3 · bytecode', 'in memory only', 'hot'], ['4 · runtime', 'JVM', 'gc']], s: '<b>Single-file source-code mode</b> (Java 11+): give <code>java</code> a <code>.java</code> file and it compiles it in memory first.' },
      { l: 1, b: [['1 · source', 'Main.java', 'ok'], ['2 · compiler', 'built into java', 'ok'], ['3 · bytecode', 'in memory only', 'ok'], ['4 · runtime', 'JVM runs main', 'ok']], out: 'Hello, Java!', s: 'Same output, one command. Great for learning, scripts and interview snippets.' },
      { l: 2, b: [['1 · source', 'Main.java', 'ok'], ['2 · compiler', '—', 'gc'], ['3 · bytecode', 'no .class on disk', 'chg'], ['4 · runtime', 'JVM exited', 'gc']], out: 'Main.java', s: 'No <code>Main.class</code> was written. Each run compiles again. Real projects still use a build tool (Maven or Gradle) that runs <code>javac</code> for you.' },
      { l: 3, b: [['args[0]', '"Ada"', 'hot'], ['args[1]', '"Linus"', 'hot'], ['args.length', '2', 'ok'], ['note', 'words after the file', 'gc']], s: 'Words after the file name become <code>args</code>, the <code>String[]</code> parameter of <code>main</code>. With no extra words, <code>args.length</code> is 0 (never null).' }
    ] },
    jshell: { label: 'JShell', head: 'JShell session', lang: 'java', outHead: 'jshell replies', code: [
      'jshell> int x = 6 * 7',
      'jshell> x + 1',
      'jshell> "hi".toUpperCase()',
      'jshell> /exit'],
    steps: [
      { l: 0, b: [['x', 'int 42', 'hot']], out: 'x ==> 42', s: '<b>JShell</b> (Java 9+) is an interactive prompt: type a line, see the result. No class, no <code>main</code>, no semicolon needed for a single line.' },
      { l: 1, b: [['x', 'int 42', 'ok'], ['$2', 'int 43', 'hot']], out: '$2 ==> 43', s: 'An expression without a name is saved in a scratch variable such as <code>$2</code>.' },
      { l: 2, b: [['x', 'int 42', 'ok'], ['$2', 'int 43', 'ok'], ['$3', 'String "HI"', 'hot']], out: '$3 ==> "HI"', s: 'Perfect for trying an API before you write it in a real file.' },
      { l: 3, b: [['session', 'ended', 'gc']], out: '|  Goodbye', s: '<code>/exit</code> leaves. Commands that start with <code>/</code> control JShell itself (<code>/vars</code>, <code>/help</code>).' }
    ] },
    error: { label: 'Compile error', head: 'files & tools', lang: 'java', outHead: 'terminal', code: [
      'public class Main {',
      '    public static void main(String[] args) {',
      '        System.out.println("Hi")',
      '    }',
      '}'],
    steps: [
      { l: 2, b: [['1 · source', 'Main.java (bug)', 'chg'], ['2 · compiler', 'javac reading…', 'hot'], ['3 · bytecode', '—', 'gc'], ['4 · runtime', '—', 'gc']], s: 'A missing semicolon at the end of line 3.' },
      { l: 2, b: [['1 · source', 'Main.java (bug)', 'bad'], ['2 · compiler', '1 error', 'bad'], ['3 · bytecode', 'not created', 'gc'], ['4 · runtime', 'never starts', 'gc']], out: "Main.java:3: error: ';' expected", s: 'The compiler stops with a file name, line number and message. Nothing runs. A compiled language catches mistakes <b>before</b> anything runs.' }
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

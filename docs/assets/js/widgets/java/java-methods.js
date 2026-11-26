/* Java methods: stack frames, overload resolution, static vs instance, varargs. */
(function () {
  /* Shared step-through shell for the Java Basics widgets (copied per file so each file stands alone).
     S = [{ label, code: [lines], intro?, steps: [{ line: n | [n], cap, out?, err?, st }] }]
     st = { boxes: [{ name, kv: [[k, v]], hot?, miss?, bad?, hotKey? }], frame?, note? } */
  function jbStepper(root, ctx, S, opt) {
    const { el, sleep, reduced, esc: e } = ctx;
    opt = opt || {};
    if (!document.getElementById('w-jb-base')) {
      document.head.append(el('style', { id: 'w-jb-base', text: `
.jb .code{font-family:var(--mono);font-size:12.5px;line-height:1.55;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);padding:8px 0;overflow-x:auto}
.jb .code>div{padding:0 12px;white-space:pre;border-left:3px solid transparent;min-height:1.55em}
.jb .code>div.on{background:var(--accent-soft);border-left-color:var(--accent)}
.jb .out{font-family:var(--mono);font-size:12.5px;border:1px dashed var(--border);border-radius:10px;padding:8px 12px;min-height:2.4em;white-space:pre-wrap;color:var(--text);background:var(--surface)}
.jb .out .err{color:var(--err)}
.jb .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin:8px 0 4px}
.jb .grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:12px;align-items:start}
@media (max-width:720px){.jb .grid{grid-template-columns:1fr}}
.jb .box{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--surface-2);margin-bottom:8px}
.jb .box.hot{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}
.jb .box.miss{border-style:dashed;opacity:.75}
.jb .box.bad{border-color:var(--err)}
.jb .box h5{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)}
.jb .kv{font-family:var(--mono);font-size:12.5px;color:var(--text);padding:1px 0;overflow-wrap:anywhere}
.jb .kv b{color:var(--accent)}
.jb .kv.hot{background:var(--accent-soft);border-radius:4px}
.jb .note{font-size:12.5px;color:var(--text-2)}
.jb .arrow{color:var(--text-3);font-family:var(--mono);text-align:center;font-size:12px}
` }));
    }
    root.classList.add('jb');
    let si = 0; let k = 0; let running = false; let gen = 0;
    const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': opt.segLabel || 'Scenario' });
    S.forEach((s, i) => { const b = el('button', { text: s.label, class: i === 0 ? 'on' : '' }); b.addEventListener('click', () => { si = i; [...seg.children].forEach((x, j) => x.classList.toggle('on', j === i)); reset(); }); seg.append(b); });
    const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
    const bStep = el('button', { class: 'btn', text: 'Step ›' });
    const bReset = el('button', { class: 'btn', text: '↺ Reset' });
    const counter = el('span', { class: 'tiny' });
    const codeHost = el('div', { class: 'code' });
    const stateHost = el('div');
    const outHost = el('div', { class: 'out', 'aria-live': 'polite' });
    const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
    root.append(el('div', { class: 'w-controls' }, seg),
      el('div', { class: 'grid' },
        el('div', null, el('div', { class: 'lbl', text: 'code' }), codeHost, el('div', { class: 'lbl', text: 'output (System.out)' }), outHost),
        el('div', null, el('div', { class: 'lbl', text: opt.stateLabel || 'what the JVM holds' }), stateHost)),
      el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, counter), narr);
    function renderState(st) {
      let h = '';
      if (st.frame) h += `<div class="box"><h5>running call</h5><div class="kv">${e(st.frame)}</div></div>`;
      (st.boxes || []).forEach((b, i) => {
        if (i && opt.arrow) h += `<div class="arrow">${e(opt.arrow)}</div>`;
        h += `<div class="box ${b.hot ? 'hot' : ''} ${b.miss ? 'miss' : ''} ${b.bad ? 'bad' : ''}"><h5>${e(b.name)}</h5>` +
          (b.kv.length ? b.kv.map(([kk, v]) => `<div class="kv ${kk === b.hotKey ? 'hot' : ''}">${e(kk)}${v === '' ? '' : ': <b>' + e(v) + '</b>'}</div>`).join('') : '<div class="note">(empty)</div>') + '</div>';
      });
      if (st.note) h += `<div class="note">${st.note}</div>`;
      return h || '<div class="note">Press Step.</div>';
    }
    function render() {
      const s = S[si]; const st = k ? s.steps[k - 1] : null;
      const on = st ? [].concat(st.line == null ? [] : st.line) : [];
      codeHost.innerHTML = '';
      s.code.forEach((ln, i) => codeHost.append(el('div', { class: on.includes(i) ? 'on' : '', html: ln ? IA.highlight(ln, 'java') : ' ' })));
      const outs = []; for (let i = 0; i < k; i++) if (s.steps[i].out != null) outs.push(s.steps[i]);
      outHost.innerHTML = outs.map((o) => o.err ? '<span class="err">' + e(o.out) + '</span>' : e(o.out)).join('\n');
      stateHost.innerHTML = renderState(st ? st.st : (s.init || {}));
      narr.firstChild.innerHTML = st ? st.cap : (s.intro || 'Press <b>Play</b> or <b>Step</b> to run the code one line at a time.');
      counter.textContent = `step ${k} / ${s.steps.length}`;
      bStep.disabled = k >= s.steps.length;
    }
    function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; render(); }
    function step() { if (k >= S[si].steps.length) return false; k++; render(); return true; }
    bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
    bReset.addEventListener('click', reset);
    bPlay.addEventListener('click', async () => {
      if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
      if (reduced) { k = S[si].steps.length; render(); return; }
      if (k >= S[si].steps.length) reset();
      running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
      while (running && g === gen && step()) await sleep(1900);
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    });
    reset();
  }
  IA.widget('java-methods', (root, ctx) => {
    const S = [
      { label: 'Call & return', code: [
        'static int square(int n) {',
        '    int r = n * n;',
        '    return r;',
        '}',
        'public static void main(String[] args) {',
        '    int x = 4;',
        '    int y = square(x + 1);',
        '    System.out.println(y);',
        '}'],
      steps: [
        { line: [4, 5], cap: 'The JVM starts in <code>main</code>. It gets a <b>stack frame</b>: a private box for its local variables.', st: { boxes: [{ name: 'frame: main', kv: [['x', '4']], hot: true, hotKey: 'x' }] } },
        { line: 6, cap: 'Before the call, the argument expression <code>x + 1</code> is evaluated to <code>5</code>. Java passes that <b>value</b>, a copy.', st: { boxes: [{ name: 'frame: main', kv: [['x', '4'], ['y', '(waiting)']], hot: true }], note: 'argument value: 5' } },
        { line: [0, 6], cap: 'A new frame is pushed for <code>square</code>. The parameter <code>n</code> is a brand-new local variable holding 5.', st: { boxes: [{ name: 'frame: square', kv: [['n', '5']], hot: true, hotKey: 'n' }, { name: 'frame: main', kv: [['x', '4'], ['y', '(waiting)']] }] } },
        { line: 1, cap: '<code>r</code> lives only inside <code>square</code>. <code>main</code> cannot see it.', st: { boxes: [{ name: 'frame: square', kv: [['n', '5'], ['r', '25']], hot: true, hotKey: 'r' }, { name: 'frame: main', kv: [['x', '4'], ['y', '(waiting)']] }] } },
        { line: 2, cap: '<code>return r;</code> hands the value 25 back and the <code>square</code> frame is thrown away. Its locals are gone.', st: { boxes: [{ name: 'frame: square', kv: [['(popped)', '']], miss: true }, { name: 'frame: main', kv: [['x', '4'], ['y', '25']], hot: true, hotKey: 'y' }] } },
        { line: 7, cap: '<code>y</code> holds the returned value. <code>x</code> is still 4: the method never had access to it.', out: '25', st: { boxes: [{ name: 'frame: main', kv: [['x', '4'], ['y', '25']], hot: true }] } }
      ] },
      { label: 'Overloading', code: [
        'static String f(int a)    { return "int"; }',
        'static String f(long a)   { return "long"; }',
        'static String f(Object a) { return "Object"; }',
        'static String f(int... a) { return "varargs"; }',
        '',
        'f(1);      // int literal',
        'f(1L);     // long literal',
        'f((short) 1);',
        'f("hi");',
        'f();'],
      steps: [
        { line: [0, 1, 2, 3], cap: 'Four methods share the name <code>f</code> but have different <b>parameter lists</b>. That is overloading. The compiler picks one at <b>compile time</b> from the argument types.', st: { boxes: [{ name: 'candidates', kv: [['f(int)', ''], ['f(long)', ''], ['f(Object)', ''], ['f(int...)', '']], hot: true }] } },
        { line: [5, 0], cap: '<code>1</code> is an <code>int</code>. An exact match wins.', out: 'int', st: { boxes: [{ name: 'f(1)', kv: [['f(int)', 'exact ✓'], ['f(long)', 'widening'], ['f(Object)', 'boxing'], ['f(int...)', 'varargs']], hot: true, hotKey: 'f(int)' }] } },
        { line: [6, 1], cap: '<code>1L</code> is a <code>long</code>. <code>f(int)</code> is not allowed: long → int would lose data. Exact match <code>f(long)</code>.', out: 'long', st: { boxes: [{ name: 'f(1L)', kv: [['f(int)', 'no (narrowing)'], ['f(long)', 'exact ✓'], ['f(Object)', 'boxing']], hot: true, hotKey: 'f(long)' }] } },
        { line: [7, 0], cap: 'A <code>short</code> has no exact match. Phase 1 allows <b>widening</b> (short → int, short → long). The most specific is <code>int</code>. Boxing and varargs are only tried if phase 1 finds nothing.', out: 'int', st: { boxes: [{ name: 'f((short) 1)', kv: [['phase 1: widening', 'f(int), f(long) → f(int) ✓'], ['phase 2: boxing', '(not needed)'], ['phase 3: varargs', '(not needed)']], hot: true, hotKey: 'phase 1: widening' }] } },
        { line: [8, 2], cap: 'A <code>String</code> is not a number, but every object is an <code>Object</code>.', out: 'Object', st: { boxes: [{ name: 'f("hi")', kv: [['f(Object)', 'String is an Object ✓']], hot: true, hotKey: 'f(Object)' }] } },
        { line: [9, 3], cap: 'No arguments: only varargs fits. <code>a</code> is an empty <code>int[]</code>.', out: 'varargs', st: { boxes: [{ name: 'f()', kv: [['f(int...)', 'a = new int[0] ✓']], hot: true, hotKey: 'f(int...)' }] } }
      ] },
      { label: 'static vs instance', code: [
        'class Counter {',
        '    static int created = 0;   // one per class',
        '    int count = 0;            // one per object',
        '    Counter() { created++; }',
        '    void inc() { count++; }   // needs an object',
        '    static int total() { return created; }',
        '}',
        'Counter a = new Counter(); Counter b = new Counter();',
        'a.inc(); a.inc(); b.inc();',
        'System.out.println(a.count + " " + b.count + " " + Counter.total());'],
      steps: [
        { line: [1, 5], cap: '<code>static</code> members belong to the <b>class</b>. There is exactly one <code>created</code>, however many objects exist.', st: { boxes: [{ name: 'class Counter (static)', kv: [['created', '0'], ['total()', 'static method']], hot: true }] } },
        { line: [7, 3], cap: 'Two objects. Each has its <b>own</b> <code>count</code>. Both constructors bump the shared <code>created</code>.', st: { boxes: [{ name: 'class Counter (static)', kv: [['created', '2']], hot: true, hotKey: 'created' }, { name: 'object a', kv: [['count', '0']] }, { name: 'object b', kv: [['count', '0']] }] } },
        { line: [8, 4], cap: 'An instance method runs <b>on an object</b>: inside <code>inc()</code>, <code>count</code> means <code>this.count</code>.', st: { boxes: [{ name: 'class Counter (static)', kv: [['created', '2']] }, { name: 'object a', kv: [['count', '2']], hot: true, hotKey: 'count' }, { name: 'object b', kv: [['count', '1']], hot: true, hotKey: 'count' }] } },
        { line: [9, 5], cap: 'A static method is called on the class: <code>Counter.total()</code>. It has no <code>this</code>, so it cannot read <code>count</code> without an object.', out: '2 1 2', st: { boxes: [{ name: 'class Counter (static)', kv: [['created', '2']], hot: true, hotKey: 'created' }, { name: 'object a', kv: [['count', '2']] }, { name: 'object b', kv: [['count', '1']] }], note: 'In a static method, <code>count++</code> would not compile: “non-static variable count cannot be referenced from a static context”.' } }
      ] },
      { label: 'Varargs', code: [
        'static int sum(int... nums) {',
        '    int s = 0;',
        '    for (int n : nums) s += n;',
        '    return s;',
        '}',
        'sum();',
        'sum(1, 2, 3);',
        'sum(new int[]{4, 5});'],
      steps: [
        { line: 0, cap: '<code>int... nums</code> means “zero or more ints”. Inside the method, <code>nums</code> is just an <code>int[]</code>. It must be the <b>last</b> parameter.', st: { boxes: [{ name: 'sum(int... nums)', kv: [['nums', 'int[]']], hot: true }] } },
        { line: [5, 2], cap: 'No arguments: the compiler creates an <b>empty array</b>. The loop runs zero times.', out: '0', st: { boxes: [{ name: 'frame: sum', kv: [['nums', '[]'], ['s', '0']], hot: true, hotKey: 'nums' }] } },
        { line: [6, 2], cap: 'The compiler rewrites <code>sum(1, 2, 3)</code> to <code>sum(new int[]{1, 2, 3})</code>.', out: '6', st: { boxes: [{ name: 'frame: sum', kv: [['nums', '[1, 2, 3]'], ['s', '6']], hot: true, hotKey: 'nums' }] } },
        { line: [7, 2], cap: 'You may also pass an array yourself. It is used as-is (no copy), so the method could modify the caller’s array.', out: '9', st: { boxes: [{ name: 'frame: sum', kv: [['nums', '[4, 5]  (caller’s array)'], ['s', '9']], hot: true, hotKey: 'nums' }] } }
      ] }
    ];
    jbStepper(root, ctx, S, { segLabel: 'Methods scenario', stateLabel: 'stack frames and candidates' });
  });
})();

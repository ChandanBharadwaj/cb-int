/* Lambdas: how invokedynamic links a lambda once, what a capturing lambda copies, and when a bound method reference evaluates its receiver. */
IA.widget('lambdas-functional', (root, ctx) => {
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
  // st: { site: [state, cls], boot: cls|null, hc: [title, rows]|null, inst: [[label, detail, cls]], impl: [text, cls]|null, links: ['site-boot','boot-hc','hc-inst','inst-impl'], out }
  const SC = {
    link: { label: 'invokedynamic, once', code: [
      'for (int i = 0; i < 2; i++) {',
      '  Runnable r = () -> System.out.println("hi");',
      '  r.run();',
      '}',
      '// javac generated, roughly:',
      '//   private static void lambda$main$0() { System.out.println("hi"); }',
      '//   Runnable r = invokedynamic run() [LambdaMetafactory]'],
    steps: [
      { l: 5, site: ['not linked yet', ''], impl: ['private static lambda$main$0()', 'hot'], s: 'At compile time javac moves the lambda body into a <b>private synthetic method</b> of your class. No inner class file is generated, unlike an anonymous class.' },
      { l: 6, site: ['invokedynamic: not linked', 'hot'], impl: ['private static lambda$main$0()', ''], s: 'The lambda expression itself becomes an <code>invokedynamic</code> instruction whose bootstrap method is <code>LambdaMetafactory.metafactory</code>.' },
      { l: 1, site: ['linking… (first execution)', 'chg'], boot: 'hot', impl: ['private static lambda$main$0()', ''], links: ['site-boot'], s: 'The <b>first</b> time this instruction runs, the JVM calls the bootstrap method with a lookup, the target interface (<code>Runnable</code>) and a handle to <code>lambda$main$0</code>.' },
      { l: 1, site: ['linking…', 'chg'], boot: 'hot', hc: ['hidden class Main$$Lambda', ['implements Runnable', 'run() → lambda$main$0()']], impl: ['private static lambda$main$0()', ''], links: ['site-boot', 'boot-hc'], s: 'The metafactory spins a small class implementing <code>Runnable</code>. Since Java 15 it is a <b>hidden class</b> (JEP 371): not discoverable by name and unloadable with its defining class.' },
      { l: 1, site: ['linked: constant call site', 'ok'], hc: ['hidden class Main$$Lambda', ['implements Runnable', 'run() → lambda$main$0()']], inst: [['instance #1', 'no captured state', 'hot']], impl: ['private static lambda$main$0()', ''], links: ['hc-inst'], s: 'The call site is now <b>linked</b> for good. This lambda captures nothing, so in OpenJDK the site returns one shared instance every time.' },
      { l: 2, site: ['linked', 'ok'], hc: ['hidden class Main$$Lambda', ['implements Runnable', 'run() → lambda$main$0()']], inst: [['instance #1', 'no captured state', 'hot']], impl: ['private static lambda$main$0()', 'hot'], links: ['hc-inst', 'inst-impl'], out: 'hi', s: '<code>r.run()</code> is an ordinary <code>invokeinterface</code>. The hidden class forwards to <code>lambda$main$0</code>, which the JIT can usually inline.' },
      { l: 1, site: ['linked', 'ok'], hc: ['hidden class Main$$Lambda', ['implements Runnable', 'run() → lambda$main$0()']], inst: [['instance #1', 'same object, reused', 'hot']], impl: ['private static lambda$main$0()', ''], links: ['hc-inst'], s: 'Second iteration: <b>no bootstrap, no class spinning</b>. The linked site hands back the same instance. Linking cost is paid once per call site, not once per evaluation.' },
      { l: 2, site: ['linked', 'ok'], hc: ['hidden class Main$$Lambda', ['implements Runnable', 'run() → lambda$main$0()']], inst: [['instance #1', 'no captured state']], impl: ['private static lambda$main$0()', 'hot'], links: ['inst-impl'], out: 'hi', s: 'Prints <b>hi</b> again. Don’t rely on lambda identity (<code>==</code>) or on a lambda’s class name: both are implementation details.' }
    ] },
    capture: { label: 'Capturing a local', code: [
      'int base = 10;',
      'IntUnaryOperator add = x -> x + base;',
      '// base++;   ← error: must be effectively final',
      'System.out.println(add.applyAsInt(5));',
      '// javac: private static int lambda$main$0(int base, int x)'],
    steps: [
      { l: 0, site: ['not linked', ''], frame: [['base', '10']], s: 'A local variable on main’s stack frame.' },
      { l: 1, site: ['linking…', 'chg'], boot: 'hot', frame: [['base', '10']], links: ['site-boot'], impl: ['lambda$main$0(int base, int x)', ''], s: 'The body uses <code>base</code>, so javac adds it as an <b>extra leading parameter</b> of the synthetic method, and the indy call site takes the captured value as an argument.' },
      { l: 1, site: ['linked: factory call site', 'ok'], hc: ['hidden class Main$$Lambda', ['final int arg$1', 'applyAsInt(x) → lambda$main$0(arg$1, x)']], inst: [['instance', 'arg$1 = 10 (a copy)', 'hot']], frame: [['base', '10']], impl: ['lambda$main$0(int base, int x)', ''], links: ['boot-hc', 'hc-inst'], s: 'A capturing lambda gets a <b>new instance per evaluation</b>, with the captured <b>value copied</b> into a final field. The lambda never sees the variable, only its value at capture time.' },
      { l: 2, site: ['linked', 'ok'], hc: ['hidden class Main$$Lambda', ['final int arg$1', 'applyAsInt(x) → lambda$main$0(arg$1, x)']], inst: [['instance', 'arg$1 = 10 (stale!)', 'bad']], frame: [['base', '11 ?']], impl: ['lambda$main$0(int base, int x)', ''], s: 'That is why captured locals must be <b>effectively final</b> (Java 8). If <code>base++</code> were allowed, the copy and the variable would silently disagree. Fields and array elements aren’t copied (only the reference to <code>this</code> or the array is), so they can change, and thread-safety is then your problem.' },
      { l: 3, site: ['linked', 'ok'], hc: ['hidden class Main$$Lambda', ['final int arg$1', 'applyAsInt(x) → lambda$main$0(arg$1, x)']], inst: [['instance', 'arg$1 = 10', 'hot']], frame: [['base', '10']], impl: ['lambda$main$0(10, 5)', 'hot'], links: ['inst-impl'], out: '15', s: 'Prints <b>15</b>. <code>IntUnaryOperator</code> takes and returns a primitive <code>int</code>, so there is no boxing, unlike <code>Function&lt;Integer, Integer&gt;</code>.' }
    ] },
    mref: { label: 'Bound method ref & null', code: [
      'String prefix = null;',
      'Supplier<Integer> s1 = () -> prefix.length();',
      'System.out.println("s1 created");',
      'Supplier<Integer> s2 = prefix::length;',
      'System.out.println("s2 created");'],
    steps: [
      { l: 0, site: ['', ''], frame: [['prefix', 'null']], s: 'A null reference.' },
      { l: 1, site: ['lambda: captures prefix', 'ok'], frame: [['prefix', 'null']], inst: [['s1', 'arg$1 = null (not used yet)', 'hot']], s: 'The lambda captures the value <code>null</code>, which is fine. <code>prefix.length()</code> would only run, and throw, when <code>s1.get()</code> is called.' },
      { l: 2, site: ['', ''], frame: [['prefix', 'null']], inst: [['s1', 'arg$1 = null']], out: 's1 created', s: 'Prints <b>s1 created</b>.' },
      { l: 3, site: ['bound ref: receiver now', 'bad'], frame: [['prefix', 'null']], inst: [['s1', 'arg$1 = null'], ['s2', 'never created', 'bad']], outE: 'NullPointerException', s: 'For a <b>bound</b> method reference <code>expr::method</code>, the receiver expression is evaluated <b>when the reference is created</b> (JLS §15.13.3), and a null receiver throws immediately. So <b>s2 created</b> is never printed.' },
      { l: 3, site: ['kinds of method references', 'ok'], frame: [['prefix', 'null']], inst: [['static', 'Integer::parseInt'], ['bound', 'prefix::length'], ['unbound', 'String::length'], ['constructor', 'ArrayList::new']], s: 'The four kinds. An <b>unbound</b> reference (<code>String::length</code>) takes the receiver as its first argument (<code>Function&lt;String, Integer&gt;</code>), so nothing is evaluated early.' }
    ] }
  };

  const ids = Object.keys(SC); let cur = ids[0]; let k = -1; let gen = 0; let running = false;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scenario' });
  ids.forEach((id) => { const b = el('button', { text: SC[id].label, class: id === cur ? 'on' : '' }); b.addEventListener('click', () => { cur = id; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const code = el('div', { class: 'jt-code' });
  const out = el('div', { class: 'jt-out', 'aria-label': 'Program output' });
  const W = 520, H = 300;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'The invokedynamic call site, the bootstrap method, the generated hidden class, its instances and the synthetic method that holds the lambda body' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(el('div', { class: 'w-controls' }, seg),
    el('div', { class: 'jt-grid' }, el('div', null, code, out), el('div', { class: 'w-stage' }, stage)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 11.5, fill: 'var(--text)', 'font-family': 'var(--mono)', text: t }, o || {}));
  const H3 = (x, y, t) => T(x, y, t, { 'font-size': 10.5, fill: 'var(--text-3)', 'font-family': 'var(--sans)', 'font-weight': 700 });
  const box = (x, y, w, h, cls) => svg('rect', { class: 'jt-box ' + (cls || ''), x, y, width: w, height: h, rx: 8 });
  function arrow(d, hot) {
    const p = svg('path', { class: 'jt-arrow' + (hot ? ' chg' : ''), d, 'marker-end': 'url(#jt-ah-lf)' });
    if (!reduced) { p.style.strokeDasharray = '400'; p.style.strokeDashoffset = '400'; p.style.transition = 'stroke-dashoffset .7s ease'; requestAnimationFrame(() => { p.style.strokeDashoffset = '0'; }); }
    return p;
  }
  function draw(st) {
    stage.innerHTML = '';
    stage.append(svg('defs', null, svg('marker', { id: 'jt-ah-lf', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: 'var(--warn)' }))));
    if (!st) { stage.append(T(8, 40, 'press Play or Step', { fill: 'var(--text-3)', 'font-family': 'var(--sans)' })); return; }
    const L = new Set(st.links || []);
    // left: frame, call site, bootstrap
    let y = 10;
    if (st.frame) {
      stage.append(H3(8, y + 10, 'STACK: main()'));
      st.frame.forEach(([n, v], i) => { stage.append(box(8, y + 16 + i * 26, 200, 22, ''), T(16, y + 31 + i * 26, n, { fill: 'var(--text-2)' }), T(200, y + 31 + i * 26, v, { 'text-anchor': 'end', fill: v.includes('?') ? 'var(--err)' : 'var(--text)' })); });
      y += 24 + st.frame.length * 26;
    }
    if (st.site && st.site[0]) {
      stage.append(H3(8, y + 12, 'CALL SITE'), box(8, y + 18, 200, 34, st.site[1]), T(16, y + 39, st.site[0], { 'font-size': 10.5 }));
    }
    const siteY = y + 35;
    stage.append(H3(8, 168, 'BOOTSTRAP'), box(8, 174, 200, 46, st.boot ? 'hot' : 'gc'), T(16, 193, 'LambdaMetafactory', { 'font-size': 11 }), T(16, 210, '.metafactory(…)', { 'font-size': 11, fill: 'var(--text-2)' }));
    stage.append(H3(8, 244, 'RUNS'), T(8, 262, st.boot ? 'now (first execution only)' : 'once per call site', { 'font-size': 10.5, fill: 'var(--text-2)', 'font-family': 'var(--sans)' }));
    // right: hidden class, instances, impl method
    if (st.hc) {
      stage.append(H3(250, 20, 'GENERATED AT RUNTIME'), box(250, 26, 264, 24 + st.hc[1].length * 17, 'frame'), T(260, 43, st.hc[0], { 'font-weight': 700, 'font-family': 'var(--sans)' }));
      st.hc[1].forEach((r, i) => stage.append(T(262, 61 + i * 17, r, { 'font-size': 10.5, fill: 'var(--text-2)' })));
    }
    (st.inst || []).forEach(([a, b, cls], i) => {
      const iy = 100 + i * 34;
      stage.append(box(250, iy, 264, 30, cls), T(260, iy + 19, a, { 'font-size': 11, 'font-weight': 700 }), T(506, iy + 19, b, { 'font-size': 10, 'text-anchor': 'end', fill: cls === 'bad' ? 'var(--err)' : 'var(--text-2)' }));
    });
    if (st.impl) stage.append(H3(250, 238, 'IN YOUR CLASS (javac)'), box(250, 244, 264, 34, st.impl[1]), T(260, 265, st.impl[0], { 'font-size': 11 }));
    if (L.has('site-boot')) stage.append(arrow(`M60 ${siteY + 18} L60 172`, true));
    if (L.has('boot-hc')) stage.append(arrow('M208 190 C 240 190, 230 40, 248 40', true));
    if (L.has('hc-inst')) stage.append(arrow('M382 ' + (26 + 24 + (st.hc ? st.hc[1].length * 17 : 0)) + ' L382 98', true));
    if (L.has('inst-impl')) stage.append(arrow('M490 130 C 510 180, 510 220, 490 242', true));
  }
  function paint() {
    const S = SC[cur]; const st = k >= 0 ? S.steps[k] : null;
    code.innerHTML = '';
    S.code.forEach((ln, i) => code.append(el('div', { class: st && st.l === i ? 'on' : '', html: IA.highlight(ln, 'java') || ' ' })));
    out.innerHTML = ''; out.append(el('div', { class: 'h', text: 'stdout / exceptions' }));
    S.steps.slice(0, k + 1).forEach((s) => { if (s.out) out.append(el('div', { text: s.out })); if (s.outE) out.append(el('div', { class: 'e', text: s.outE })); });
    draw(st);
    narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: st ? `${k + 1}/${S.steps.length}` : '0' }), el('div', { class: 't', html: st ? st.s : 'Pick a scenario, then press <b>Play</b> or <b>Step</b>. Orange arrows show what happens at this step: linking, instantiation or a call.' }));
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
    while (running && g === gen && step()) await sleep(2700);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

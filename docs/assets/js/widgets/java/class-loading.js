/* Class loading: parent-first delegation, linking & <clinit> order, static-init deadlock,
   ClassCastException across loaders, and a metaspace leak across redeploys. */
IA.widget('class-loading', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let mode = 'delegate'; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['delegate', 'delegation'], ['init', 'linking & init order'], ['deadlock', 'static init deadlock'], ['cce', 'X cannot be cast to X'], ['leak', 'metaspace leak']], () => mode, (v) => { mode = v; reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const W = 760, H = 320;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Class loader hierarchy and class state' });
  const codeHost = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), codeHost, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const code = (src) => { codeHost.innerHTML = ''; codeHost.append(el('pre', { html: IA.highlight(src, 'java') })); };

  /* ---- generic box diagram ---- */
  const TONE = { '': ['var(--surface)', 'var(--border)'], hot: ['var(--accent-soft)', 'var(--accent)'], ok: ['var(--surface)', 'var(--ok)'], err: ['var(--surface)', 'var(--err)'], warn: ['var(--surface)', 'var(--warn)'], dim: ['var(--surface-2)', 'var(--border)'] };
  const LC = { '': 'var(--border)', hot: 'var(--accent)', ok: 'var(--ok)', err: 'var(--err)', warn: 'var(--warn)' };
  let S;
  const clip = (a, b) => { const cx = a.x + a.w / 2, cy = a.y + a.h / 2; const dx = b.x + b.w / 2 - cx, dy = b.y + b.h / 2 - cy; const t = Math.min(dx ? (a.w / 2) / Math.abs(dx) : 1e9, dy ? (a.h / 2) / Math.abs(dy) : 1e9); return [cx + dx * t, cy + dy * t]; };
  function render() {
    stage.innerHTML = '';
    stage.append(svg('defs', null, ...['', 'hot', 'ok', 'err', 'warn'].map((t) => svg('marker', { id: 'cl-a' + t, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: LC[t] })))));
    (S.edges || []).forEach((e) => { const a = S.nodes[e.from], b = S.nodes[e.to]; if (!a || !b) return; const [x1, y1] = clip(a, b); const [x2, y2] = clip(b, a); const st = e.state || '';
      stage.append(svg('line', { x1, y1, x2, y2, stroke: LC[st], 'stroke-width': st ? 2.4 : 1.4, 'stroke-dasharray': e.dash ? '5 4' : null, 'marker-end': `url(#cl-a${st})` }));
      if (e.label) stage.append(svg('text', { x: (x1 + x2) / 2 + 6, y: (y1 + y2) / 2 - 4, 'font-size': 11, fill: LC[st] === 'var(--border)' ? 'var(--text-3)' : LC[st], text: e.label })); });
    Object.values(S.nodes).forEach((n) => { const [f, s] = TONE[n.state || ''];
      stage.append(svg('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 8, fill: f, stroke: s, 'stroke-width': n.state && n.state !== 'dim' ? 2.2 : 1.2, 'stroke-dasharray': n.state === 'dim' ? '4 3' : null }));
      stage.append(svg('text', { x: n.x + n.w / 2, y: n.y + (n.sub ? 18 : n.h / 2 + 5), 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: n.state === 'dim' ? 'var(--text-3)' : 'var(--text)', text: n.label }));
      if (n.sub) String(n.sub).split('\n').forEach((ln, i) => stage.append(svg('text', { x: n.x + n.w / 2, y: n.y + 34 + i * 14, 'text-anchor': 'middle', 'font-size': 11, 'font-family': 'var(--mono)', fill: 'var(--text-2)', text: ln })));
      if (n.tag) stage.append(svg('text', { x: n.x + n.w + 8, y: n.y + n.h / 2 + 4, 'font-size': 11.5, 'font-weight': 700, fill: LC[n.tagC || 'hot'], text: n.tag })); });
    (S.notes || []).forEach((t) => stage.append(svg('text', { x: t.x, y: t.y, 'font-size': t.size || 12, 'text-anchor': t.anchor || 'start', 'font-family': t.mono ? 'var(--mono)' : null, 'font-weight': t.bold ? 700 : 400, fill: t.c || 'var(--text-2)', text: t.t })));
    (S.bars || []).forEach((b) => { stage.append(svg('rect', { x: b.x, y: b.y, width: b.w, height: 14, rx: 4, fill: 'var(--surface-2)', stroke: 'var(--border)' }), svg('rect', { x: b.x, y: b.y, width: Math.max(0, b.w * Math.min(1, b.v / b.max)), height: 14, rx: 4, fill: b.c || 'var(--accent)' }), svg('text', { x: b.x, y: b.y - 5, 'font-size': 11, fill: 'var(--text-3)', text: b.label })); });
    stats.innerHTML = ''; (S.stats || []).forEach(([l, v]) => stats.append(el('span', { class: 'w-stat', html: `${l} <b>${v}</b>` })));
  }
  const N = (id, x, y, w, h, label, sub) => { S.nodes[id] = { x, y, w, h, label, sub, state: '' }; };
  const set = (id, o) => Object.assign(S.nodes[id], o);
  const hierarchy = () => {
    N('boot', 270, 14, 220, 44, 'Bootstrap loader', 'java.base, …  (native, null)');
    N('plat', 270, 92, 220, 44, 'Platform loader', 'java.sql, java.xml.crypto, …');
    N('app', 270, 170, 220, 44, 'App (system) loader', 'classpath / module path');
    S.edges = [{ from: 'plat', to: 'boot', label: 'parent', dash: true }, { from: 'app', to: 'plat', label: 'parent', dash: true }];
  };
  function plan() {
    const st = []; const P = (run, t) => st.push({ run, t });
    if (mode === 'delegate') {
      hierarchy(); N('child', 270, 252, 220, 44, 'Plugin loader (child-first)', 'plugins/acme-1.2.jar');
      S.edges.push({ from: 'child', to: 'app', label: 'parent', dash: true });
      code('Class<?> s = loader.loadClass("java.lang.String");\nClass<?> o = loader.loadClass("com.acme.OrderService");');
      P(() => { set('app', { state: 'hot', tag: 'findLoadedClass? no' }); }, '<code>loadClass("java.lang.String")</code> on the App loader. Step 1: has this loader already loaded it? No.');
      P(() => { set('app', { tag: 'delegate ↑' }); S.edges[1].state = 'hot'; set('plat', { state: 'hot', tag: 'delegate ↑' }); S.edges[0].state = 'hot'; }, 'Step 2: <b>ask the parent first</b>. Platform asks its parent, the bootstrap loader.');
      P(() => { set('boot', { state: 'ok', tag: 'found in java.base ✓', tagC: 'ok' }); }, 'Bootstrap finds <code>java/lang/String</code> in the runtime image. That Class object is returned down the chain, so every loader in the JVM shares one <code>String</code>. You can’t sneak in your own <code>java.lang.String</code>: defining a <code>java.*</code> class from a custom loader throws <code>SecurityException</code>.');
      P(() => { Object.keys(S.nodes).forEach((id) => set(id, { state: '', tag: '' })); S.edges.forEach((e) => { e.state = ''; }); set('app', { state: 'hot', tag: 'not loaded yet' }); }, 'Now <code>com.acme.OrderService</code>. Same procedure.');
      P(() => { S.edges[1].state = 'hot'; S.edges[0].state = 'hot'; set('boot', { state: 'err', tag: 'not found', tagC: 'err' }); set('plat', { state: 'err', tag: 'not found', tagC: 'err' }); }, 'Bootstrap and Platform don’t have it; each returns “not found” (ClassNotFoundException internally).');
      P(() => { set('app', { state: 'ok', tag: 'findClass → defineClass ✓', tagC: 'ok' }); S.stats = [['defining loader', 'app']]; }, 'Only then does the App loader call its own <code>findClass</code>: read the bytes from the classpath JAR, then <code>defineClass</code>. A class’s identity is <b>(binary name, defining loader)</b>.');
      P(() => { Object.keys(S.nodes).forEach((id) => set(id, { state: '', tag: '' })); S.edges.forEach((e) => { e.state = ''; }); set('child', { state: 'ok', tag: 'own jackson 2.13 ✓', tagC: 'ok' }); }, 'Servlet containers and plugin systems often invert the order for their own classes: a <b>child-first</b> loader looks in its JAR before asking the parent, so each webapp can ship its own Jackson version. They still delegate <code>java.*</code> (and usually the container API) to the parent.');
    } else if (mode === 'init') {
      code('class Counter {\n    static Counter INSTANCE = new Counter();\n    static int count = 0;\n    static int other;\n    Counter() { count++; other++; }\n}\n// first active use: Counter.count');
      const ph = [['load', 'Loading', 'defineClass'], ['verify', 'Verify', 'type-safe?'], ['prep', 'Prepare', 'statics = 0/null'], ['resolve', 'Resolve', 'refs → direct'], ['init', 'Initialize', 'run <clinit>']];
      ph.forEach(([id, l, s], i) => N(id, 14 + i * 150, 30, 136, 54, l, s));
      S.edges = ph.slice(1).map(([id], i) => ({ from: ph[i][0], to: id }));
      S.notes = [{ x: 14, y: 116, t: 'Linking = Verify + Prepare + Resolve', c: 'var(--text-3)' }];
      N('fields', 230, 150, 300, 120, 'Counter statics', 'INSTANCE = —\ncount    = —\nother    = —');
      const f = (a, b, c) => set('fields', { sub: `INSTANCE = ${a}\ncount    = ${b}\nother    = ${c}` });
      P(() => { set('load', { state: 'ok' }); }, '<b>Loading</b>: a loader finds the bytes and creates the <code>Class</code>. Nothing in your code has run yet.');
      P(() => { set('verify', { state: 'ok' }); }, '<b>Verification</b> checks the bytecode is well-formed and type-safe (stack depths, types, branch targets).');
      P(() => { set('prep', { state: 'ok' }); f('null', '0', '0'); set('fields', { state: 'hot' }); }, '<b>Preparation</b> allocates the static fields and sets <b>default values</b>: null, 0, false. No initializers run yet.');
      P(() => { set('resolve', { state: 'ok' }); set('fields', { state: '' }); }, '<b>Resolution</b> turns symbolic references (names in the constant pool) into direct ones. HotSpot does this lazily, on first use of each reference.');
      P(() => { set('init', { state: 'hot' }); }, 'First <b>active use</b> (<code>new</code>, a static method call, a read or write of a non-constant static field, reflection, or a subclass being initialised) triggers <b>initialization</b>: the JVM runs <code>&lt;clinit&gt;</code>, which contains every static initializer and static block <b>in source order</b>.');
      P(() => { f('Counter@1', '1', '1'); set('fields', { state: 'hot' }); }, 'First line: <code>INSTANCE = new Counter()</code>. The constructor runs <b>during</b> class init and increments both counters: count = 1, other = 1.');
      P(() => { f('Counter@1', '0', '1'); }, 'Next line: <code>count = 0</code>. It overwrites the 1. <code>other</code> has no initializer, so it keeps its 1. Final answer: <b>count 0, other 1</b>.');
      P(() => { set('init', { state: 'ok' }); set('fields', { state: 'ok' }); S.notes.push({ x: 14, y: 300, t: 'Not a trigger: static final compile-time constants (inlined), Counter.class, new Counter[10]', c: 'var(--text-3)' }); }, 'Init happens once, under a per-class lock, and its effects are visible to every thread afterwards. Reading a <code>static final int K = 42</code> does <b>not</b> trigger it, because javac inlined the constant; neither does <code>Counter.class</code> or creating an array of Counter.');
    } else if (mode === 'deadlock') {
      code('class A { static final B DEP = B.INSTANCE; static final A INSTANCE = new A(); }\nclass B { static final A DEP = A.INSTANCE; static final B INSTANCE = new B(); }\n// T1: A.INSTANCE      T2: B.INSTANCE   (at the same time)');
      N('t1', 20, 40, 180, 50, 'Thread T1', 'idle'); N('t2', 560, 40, 180, 50, 'Thread T2', 'idle');
      N('A', 230, 150, 130, 60, 'class A', 'not initialized'); N('B', 400, 150, 130, 60, 'class B', 'not initialized');
      S.edges = [];
      P(() => { set('t1', { state: 'hot', sub: 'A.<clinit>' }); set('A', { state: 'hot', sub: 'in progress (T1)' }); S.edges.push({ from: 't1', to: 'A', label: 'owns init', state: 'hot' }); }, 'T1 touches <code>A</code> first. The JVM marks A “being initialized by T1” and T1 starts running <code>A.&lt;clinit&gt;</code>.');
      P(() => { set('t2', { state: 'hot', sub: 'B.<clinit>' }); set('B', { state: 'hot', sub: 'in progress (T2)' }); S.edges.push({ from: 't2', to: 'B', label: 'owns init', state: 'hot' }); }, 'At the same moment T2 touches <code>B</code>, and starts <code>B.&lt;clinit&gt;</code>.');
      P(() => { set('t1', { state: 'warn', sub: 'waits for B' }); S.edges.push({ from: 't1', to: 'B', label: 'needs B', state: 'warn' }); }, 'A’s first static initializer reads <code>B.INSTANCE</code>. B is being initialized by <b>another</b> thread, so T1 must wait until T2 finishes.');
      P(() => { set('t2', { state: 'warn', sub: 'waits for A' }); S.edges.push({ from: 't2', to: 'A', label: 'needs A', state: 'warn' }); }, 'B’s first static initializer reads <code>A.INSTANCE</code>. A is in progress by T1, so T2 waits too.');
      P(() => { set('t1', { state: 'err', sub: 'stuck forever' }); set('t2', { state: 'err', sub: 'stuck forever' }); S.notes = [{ x: W / 2, y: 280, t: 'Deadlock: no timeout, and no Java-level lock cycle for jstack to report', anchor: 'middle', c: 'var(--err)', bold: true }]; S.stats = [['threads stuck', 2]]; },
        'Deadlock. Both threads wait on the other class’s initialization, forever. In a thread dump both sit in a <code>&lt;clinit&gt;</code> frame; jstack’s “Found one Java-level deadlock” check typically doesn’t flag it. On a single thread there is no deadlock, but a cycle lets one class see the other’s statics as <b>null</b>.');
      P(() => { S.notes.push({ x: W / 2, y: 304, t: 'Fix: break the cycle, or use the lazy holder idiom', anchor: 'middle', c: 'var(--text-2)' }); }, 'Fix: remove the cycle between static initializers. Move shared state into a third class, or initialise lazily (holder idiom, a method). Keep <code>static {}</code> blocks free of I/O, locks and thread starts; a static block that starts a thread which touches the same class, then <code>join</code>s it, deadlocks with just one class.');
    } else if (mode === 'cce') {
      hierarchy(); N('la', 60, 252, 230, 48, 'Loader A', 'defines com.acme.Plugin'); N('lb', 470, 252, 230, 48, 'Loader B', 'defines com.acme.Plugin');
      S.edges.push({ from: 'la', to: 'app', label: 'parent', dash: true }, { from: 'lb', to: 'app', label: 'parent', dash: true });
      code('Object p = loaderA.loadClass("com.acme.Plugin").getDeclaredConstructor().newInstance();\n// … handed to code whose Plugin type was loaded by loader B:\nPlugin plugin = (Plugin) p;');
      P(() => { set('la', { state: 'hot', tag: '' }); S.notes = [{ x: 60, y: 238, t: 'Class #1 = (com.acme.Plugin, A)', mono: true, c: 'var(--accent)' }]; }, 'Loader A finds <code>com.acme.Plugin</code> in its own JAR (the parent doesn’t have it) and defines it. Call that Class #1.');
      P(() => { set('lb', { state: 'hot' }); S.notes.push({ x: 470, y: 238, t: 'Class #2 = (com.acme.Plugin, B)', mono: true, c: 'var(--accent)' }); }, 'Loader B does the same from an identical JAR. Same name, same bytes, but a <b>different Class object</b>: #2.');
      P(() => { set('la', { state: 'ok' }); set('lb', { state: 'err' }); S.notes.push({ x: 505, y: 120, t: 'instance of #1 → cast to #2', bold: true, c: 'var(--err)' }); }, 'An object made from Class #1 reaches code compiled against Plugin and linked by loader B. The cast checks <code>#1 is-a #2</code>: false.');
      P(() => { S.notes.push({ x: W / 2, y: 316, t: 'ClassCastException: class com.acme.Plugin cannot be cast to class com.acme.Plugin', anchor: 'middle', size: 10.5, mono: true, c: 'var(--err)' }); }, 'Result: <b>com.acme.Plugin cannot be cast to com.acme.Plugin</b>. Since Java 11 the message names both loaders, which is your clue. Classic causes: Spring Boot DevTools’ restart loader vs a library that cached a class in the base loader, duplicate JARs in a webapp and the container, OSGi bundles.');
      P(() => { set('app', { state: 'ok', sub: 'shared Plugin interface' }); set('la', { state: '' }); set('lb', { state: '' }); S.notes = [{ x: W / 2, y: 238, t: 'Both see the one Plugin interface from the parent', anchor: 'middle', c: 'var(--ok)' }]; }, 'Fix: put the <b>shared type in the parent</b> loader (only the API, e.g. a Plugin interface), and keep implementations in the children. Then both children resolve Plugin to the same Class through delegation.');
    } else {
      N('pool', 20, 30, 210, 60, 'Container thread pool', 'loaded by: app loader'); N('w1', 280, 30, 200, 60, 'WebappLoader #1', 'app v1 · 8k classes');
      N('w2', 280, 120, 200, 60, 'WebappLoader #2', '—'); N('w3', 280, 210, 200, 60, 'WebappLoader #3', '—');
      ['w2', 'w3'].forEach((id) => set(id, { state: 'dim' }));
      S.edges = []; S.bars = [{ x: 530, y: 60, w: 210, label: 'metaspace used', v: 60, max: 256, c: 'var(--accent)' }];
      S.notes = [{ x: 530, y: 100, t: '-XX:MaxMetaspaceSize=256m', mono: true, c: 'var(--text-3)', size: 11 }];
      code('// inside the webapp\nprivate static final ThreadLocal<Formatter> FMT = ThreadLocal.withInitial(Formatter::new);\n// FMT.get() on a container worker thread, never FMT.remove()');
      const meta = (v) => { S.bars[0].v = v; S.stats = [['metaspace', v + ' MB'], ['live webapp loaders', S.live]]; };
      S.live = 1;
      P(() => { set('w1', { state: 'hot' }); S.edges.push({ from: 'pool', to: 'w1', label: 'pins', state: 'warn' }); meta(60); }, 'App v1 runs. A request thread from the <b>container’s</b> pool calls <code>FMT.get()</code>. The worker’s ThreadLocalMap now holds a <code>Formatter</code> whose class was defined by WebappLoader #1.');
      P(() => { set('w1', { state: 'err', sub: 'undeployed, but pinned' }); set('w2', { state: 'hot', sub: 'app v2 · 8k classes' }); S.live = 2; meta(118); }, 'Hot redeploy. v1 is undeployed and should become garbage, together with its loader and all 8k classes’ metadata. But a long-lived pool thread still references a v1 object → its Class → <b>its loader</b> → every class that loader defined.');
      P(() => { S.edges.push({ from: 'pool', to: 'w2', state: 'warn' }); set('w2', { state: 'err', sub: 'undeployed, but pinned' }); set('w3', { state: 'hot', sub: 'app v3 · 8k classes' }); S.live = 3; meta(176); }, 'Each redeploy leaks one more loader. Class metadata lives in <b>metaspace</b> (native memory, outside the heap), and a class can only be unloaded when its defining loader is unreachable.');
      P(() => { S.bars[0].c = 'var(--err)'; meta(256); S.notes.push({ x: 530, y: 140, t: 'OutOfMemoryError: Metaspace', bold: true, c: 'var(--err)' }); }, 'A few redeploys later: <b>java.lang.OutOfMemoryError: Metaspace</b>. Without <code>MaxMetaspaceSize</code> it isn’t an error, just native memory growth until the container’s limit kills the process.');
      P(() => { S.notes.push({ x: 530, y: 166, t: 'jcmd <pid> VM.classloader_stats', mono: true, size: 11, c: 'var(--text-2)' }, { x: 530, y: 184, t: 'heap dump → loader → path to GC roots', size: 11, c: 'var(--text-2)' }); }, 'Diagnose: <code>jcmd &lt;pid&gt; VM.classloader_stats</code> shows many loaders of the same type; in a heap dump, find old loader instances and follow the <b>path to GC roots</b> (MAT). Usual roots: ThreadLocals on pooled threads, JDBC drivers registered in <code>DriverManager</code>, threads started by the app, static caches in parent-loaded libraries, shutdown hooks. Fix: <code>remove()</code> ThreadLocals, deregister drivers, stop threads on shutdown, and prefer restarting the JVM over hot redeploy.');
    }
    return st;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    S = { nodes: {}, edges: [], notes: [], bars: [], stats: [] };
    steps = plan(); render(); bStep.disabled = false;
    say({ delegate: 'Three built-in loaders plus a plugin loader. Press Play to load a JDK class, then an application class.', init: 'What happens between “the JVM needs class Counter” and “Counter.count has a value”? Press Play.', deadlock: 'Two classes whose static initializers need each other, touched by two threads at once.', cce: 'Two sibling loaders load the same class name from the same JAR. Press Play.', leak: 'A webapp is hot-redeployed several times in one JVM. Watch metaspace.' }[mode]);
  }
  function step() {
    if (k >= steps.length) return false; const s = steps[k++]; s.run(); render(); say(typeof s.t === 'function' ? s.t() : s.t);
    if (k >= steps.length) bStep.disabled = true; return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 700 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

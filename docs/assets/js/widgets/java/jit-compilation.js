/* JIT compilation: tiered compilation (interpreter → C1 → C2), inlining + escape analysis,
   speculative optimisation and deoptimization, and microbenchmark traps. */
IA.widget('jit-compilation', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let mode = 'tiers'; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['tiers', 'tiers: interpreter → C1 → C2'], ['inline', 'inlining & escape analysis'], ['deopt', 'deoptimization'], ['jmh', 'benchmark traps']], () => mode, (v) => { mode = v; reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const W = 760, H = 320;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'JIT compiler state' });
  const codeHost = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), codeHost, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const code = (src, lang) => { codeHost.innerHTML = ''; codeHost.append(el('pre', { html: IA.highlight(src, lang || 'java') })); };

  const TONE = { '': ['var(--surface)', 'var(--border)'], hot: ['var(--accent-soft)', 'var(--accent)'], ok: ['var(--surface)', 'var(--ok)'], err: ['var(--surface)', 'var(--err)'], warn: ['var(--surface)', 'var(--warn)'], dim: ['var(--surface-2)', 'var(--border)'] };
  const LC = { '': 'var(--text-3)', hot: 'var(--accent)', ok: 'var(--ok)', err: 'var(--err)', warn: 'var(--warn)' };
  let S;
  const clip = (a, b) => { const cx = a.x + a.w / 2, cy = a.y + a.h / 2; const dx = b.x + b.w / 2 - cx, dy = b.y + b.h / 2 - cy; const t = Math.min(dx ? (a.w / 2) / Math.abs(dx) : 1e9, dy ? (a.h / 2) / Math.abs(dy) : 1e9); return [cx + dx * t, cy + dy * t]; };
  function render() {
    stage.innerHTML = '';
    stage.append(svg('defs', null, ...['', 'hot', 'ok', 'err', 'warn'].map((t) => svg('marker', { id: 'jt-a' + t, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: LC[t] })))));
    (S.edges || []).forEach((e) => { const a = S.nodes[e.from], b = S.nodes[e.to]; if (!a || !b) return; const [x1, y1] = clip(a, b); const [x2, y2] = clip(b, a); const st = e.state || '';
      stage.append(svg('line', { x1, y1, x2, y2, stroke: LC[st], 'stroke-width': st ? 2.2 : 1.3, 'stroke-dasharray': e.dash ? '5 4' : null, 'marker-end': `url(#jt-a${st})` }));
      if (e.label) stage.append(svg('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 6, 'text-anchor': 'middle', 'font-size': 11, fill: LC[st], text: e.label })); });
    Object.values(S.nodes).forEach((n) => { const [f, s] = TONE[n.state || ''];
      stage.append(svg('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 7, fill: f, stroke: s, 'stroke-width': n.state && n.state !== 'dim' ? 2.2 : 1.2, 'stroke-dasharray': n.state === 'dim' ? '4 3' : null }));
      if (n.label) stage.append(svg('text', { x: n.x + n.w / 2, y: n.y + (n.sub ? 18 : n.h / 2 + 5), 'text-anchor': 'middle', 'font-size': n.fs || 13, 'font-weight': 700, fill: n.state === 'dim' ? 'var(--text-3)' : 'var(--text)', text: n.label }));
      if (n.sub) String(n.sub).split('\n').forEach((ln, i) => stage.append(svg('text', { x: n.x + n.w / 2, y: n.y + 34 + i * 14, 'text-anchor': 'middle', 'font-size': 11, 'font-family': 'var(--mono)', fill: 'var(--text-2)', text: ln }))); });
    (S.bars || []).forEach((b) => { stage.append(svg('text', { x: b.x, y: b.y + 12, 'font-size': 12, fill: 'var(--text-2)', text: b.label }));
      stage.append(svg('rect', { x: b.x + 190, y: b.y, width: 400, height: 16, rx: 4, fill: 'var(--surface-2)', stroke: 'var(--border)' }), svg('rect', { x: b.x + 190, y: b.y, width: Math.max(2, 400 * Math.min(1, b.v / b.max)), height: 16, rx: 4, fill: b.c || 'var(--accent)' }));
      stage.append(svg('text', { x: b.x + 598, y: b.y + 12, 'font-size': 12, 'font-family': 'var(--mono)', fill: 'var(--text)', text: b.txt })); });
    (S.notes || []).forEach((t) => stage.append(svg('text', { x: t.x, y: t.y, 'font-size': t.size || 12, 'text-anchor': t.anchor || 'start', 'font-family': t.mono ? 'var(--mono)' : null, 'font-weight': t.bold ? 700 : 400, fill: t.c || 'var(--text-2)', text: t.t })));
    stats.innerHTML = ''; (S.stats || []).forEach(([l, v]) => stats.append(el('span', { class: 'w-stat', html: `${l} <b>${v}</b>` })));
  }
  const N = (id, x, y, w, h, label, sub, o) => { S.nodes[id] = Object.assign({ x, y, w, h, label, sub, state: '' }, o || {}); };
  const set = (id, o) => Object.assign(S.nodes[id], o);

  function plan() {
    const st = []; const P = (run, t) => st.push({ run, t });
    if (mode === 'tiers') {
      code('static long price(Order o) { … }      // called on every request\n// watch it: -XX:+PrintCompilation   or   jcmd <pid> Compiler.queue');
      N('t0', 20, 40, 160, 66, 'Tier 0', 'interpreter\ncounts calls'); N('t3', 210, 40, 160, 66, 'Tier 3', 'C1 + full profiling\n(types, branches)');
      N('t4', 400, 40, 160, 66, 'Tier 4', 'C2: optimised\nusing the profile'); N('cc', 590, 40, 150, 66, 'Code cache', 'compiled code');
      N('t2', 210, 132, 160, 40, 'Tier 2 / Tier 1', 'C1 variants', { fs: 12 });
      S.edges = [{ from: 't0', to: 't3' }, { from: 't3', to: 't4' }, { from: 't4', to: 'cc', dash: true }, { from: 't0', to: 't2', dash: true }];
      S.bars = [{ x: 20, y: 210, label: 'relative speed (illustrative)', v: 1, max: 40, txt: '1×', c: 'var(--text-3)' }];
      const spd = (v, txt, c) => { S.bars[0].v = v; S.bars[0].txt = txt; S.bars[0].c = c; };
      P(() => { set('t0', { state: 'hot' }); S.stats = [['invocations', '1–200'], ['running', 'bytecode interpreter']]; spd(1, '1×', 'var(--text-3)'); }, 'Every method starts in the <b>interpreter</b> (tier 0), which executes bytecode one instruction at a time and counts invocations and loop back-edges. Startup is instant, execution is slow.');
      P(() => { set('t0', { state: '' }); set('t3', { state: 'hot' }); S.edges[0].state = 'hot'; S.stats = [['invocations', '~200+'], ['running', 'C1 code with profiling']]; spd(10, '~10×', 'var(--accent-2)'); }, 'After a few hundred calls (<code>Tier3InvocationThreshold</code>, default 200) the method is queued for <b>C1</b>, a fast compiler. Tier 3 code also <b>profiles</b>: which receiver types each call site sees, which branches are taken. Compilation happens on background compiler threads; the app keeps running in the interpreter meanwhile.');
      P(() => { set('t3', { state: '' }); set('t4', { state: 'hot' }); S.edges[1].state = 'hot'; S.edges[2].state = 'ok'; set('cc', { state: 'ok' }); S.stats = [['invocations', '~5,000+'], ['running', 'C2 code']]; spd(36, '~30–50×', 'var(--ok)'); }, 'When it is clearly hot (thousands of calls; <code>Tier4InvocationThreshold</code> 5000 and related thresholds), <b>C2</b> recompiles it using the profile: aggressive inlining, escape analysis, loop unrolling, vectorisation, and <b>speculation</b> (e.g. “this call site only ever sees ArrayList”). The result goes to the code cache.');
      P(() => { set('t4', { state: '' }); set('t2', { state: 'warn' }); S.edges[3].state = 'warn'; S.stats = [['why tier 2', 'C2 queue is long'], ['tier 1', 'trivial methods']]; }, 'Variants: trivial methods (getters) go to <b>tier 1</b> (C1, no profiling) since C2 can’t do better; when the C2 queue is long, methods may run in <b>tier 2</b> (light profiling) for a while. All of this is <code>-XX:+TieredCompilation</code>, the default since JDK 8.');
      P(() => { set('t2', { state: '' }); S.notes = [{ x: 20, y: 270, t: 'OSR: a long loop inside main() is compiled and entered mid-loop ("%" in PrintCompilation)', size: 12, c: 'var(--text-2)' }, { x: 20, y: 292, t: 'Warm-up = the time until the hot paths reach tier 4: seconds to minutes after a deploy', size: 12, bold: true, c: 'var(--text)' }]; },
        'A method called once but looping a billion times gets <b>on-stack replacement</b> (OSR): the running loop is swapped into compiled code. And this whole journey is <b>warm-up</b>: after a deploy, latency is worse until hot paths are compiled. Readiness probes, traffic ramp-up, CDS/AOT caches (Java 24+ via Leyden JEPs) or CRaC can help.');
    } else if (mode === 'inline') {
      code('double total(List<Line> lines) {\n    double t = 0;\n    for (Line l : lines) t += l.price().times(l.qty()).amount();   // small methods + a temp object\n    return t;\n}');
      N('total', 20, 40, 170, 50, 'total()', 'loop'); N('price', 230, 20, 150, 44, 'Line.price()', '10 bytes'); N('times', 230, 78, 150, 44, 'Money.times()', 'new Money(…)');
      N('amount', 230, 136, 150, 44, 'Money.amount()', '5 bytes'); N('heap', 560, 70, 180, 60, 'Heap', 'one Money per line');
      S.edges = [{ from: 'total', to: 'price', label: 'call' }, { from: 'total', to: 'times', label: 'call' }, { from: 'total', to: 'amount', label: 'call' }, { from: 'times', to: 'heap', label: 'allocates', state: 'warn' }];
      S.stats = [['calls per line', 3], ['allocations per line', 1]];
      P(() => { set('total', { state: 'hot' }); }, 'Before inlining, each iteration makes three real calls (stack frame, arguments, return) and allocates a temporary <code>Money</code>.');
      P(() => { ['price', 'amount'].forEach((id) => set(id, { state: 'ok', sub: 'inlined' })); S.edges[0].state = 'ok'; S.edges[2].state = 'ok'; S.stats = [['calls per line', 1], ['allocations per line', 1]]; }, '<b>Inlining</b>: C2 copies small or hot callees into the caller. Defaults: methods up to <code>MaxInlineSize</code> (35 bytes of bytecode) are always candidates; hot ones up to <code>FreqInlineSize</code> (325 bytes). Inlining is the “mother of all optimisations” because it gives the compiler a bigger region to optimise.');
      P(() => { set('times', { state: 'ok', sub: 'inlined' }); S.edges[1].state = 'ok'; S.stats = [['calls per line', 0], ['allocations per line', 1]]; }, '<code>Money.times()</code> is inlined too. Now the whole loop body is one compiled block, and C2 can see that the new <code>Money</code> never leaves it.');
      P(() => { set('heap', { state: 'dim', sub: 'no allocation' }); S.edges[3].state = ''; S.edges[3].label = 'eliminated'; set('times', { sub: 'scalar replaced' }); S.stats = [['calls per line', 0], ['allocations per line', 0]]; }, '<b>Escape analysis</b>: the Money object doesn’t escape (not stored in a field, not returned, not passed to a non-inlined call). C2 <b>scalar-replaces</b> it: its fields become local registers and no object is allocated at all. Locks on non-escaping objects are removed too (lock elision).');
      P(() => { S.notes = [{ x: 20, y: 230, t: 'Escape analysis fails when the object reaches a call that is not inlined, a field, a collection, or a method too big to inline.', size: 12 }, { x: 20, y: 252, t: 'Verify: JFR allocation events, or -XX:+UnlockDiagnosticVMOptions -XX:+PrintInlining', mono: true, size: 11, c: 'var(--text-3)' }]; },
        'This is fragile: one non-inlined call (a method grew past the size limit, a megamorphic call site, a log statement) and the object escapes again. Write clear small methods and measure allocations with JFR rather than guessing.');
    } else if (mode === 'deopt') {
      code('double sum(List<Shape> shapes) {\n    double s = 0;\n    for (Shape sh : shapes) s += sh.area();   // virtual call site\n    return s;\n}');
      N('site', 20, 40, 220, 70, 'call site: sh.area()', 'profile: Circle 100%'); N('code', 290, 40, 220, 70, 'C2 code', '(not compiled yet)'); N('interp', 560, 40, 180, 70, 'Interpreter', '');
      N('prof', 20, 160, 720, 50, '', '');
      S.edges = [{ from: 'site', to: 'code' }, { from: 'code', to: 'interp', dash: true }];
      const prof = (t) => set('prof', { label: t, fs: 12 });
      P(() => { set('site', { state: 'hot' }); prof('Warm-up traffic: only Circle objects reach this call site'); S.stats = [['receiver types seen', 1]]; }, 'Profiling (tier 3) records that the call site has only ever seen <code>Circle</code>.');
      P(() => { set('code', { state: 'ok', sub: 'if (type != Circle) trap\ninline Circle.area()' }); S.edges[0].state = 'ok'; S.stats = [['call site', 'monomorphic, inlined']]; }, 'C2 <b>speculates</b>: it inlines <code>Circle.area()</code> directly, guarded by a cheap type check. If the guard ever fails it hits an <b>uncommon trap</b> instead of handling the other case. Fast code for what actually happens.');
      P(() => { set('site', { state: 'warn', sub: 'Square arrives!' }); prof('A Square reaches the call site; the type guard fails'); }, 'New traffic brings a <code>Square</code>. The guard fails.');
      P(() => { set('code', { state: 'err', sub: 'made not entrant' }); set('interp', { state: 'hot', sub: 'running again' }); S.edges[1].state = 'err'; S.edges[1].label = 'deoptimize'; S.stats = [['deopt', 1], ['state', 'interpreted']]; }, '<b>Deoptimization</b>: the JVM rebuilds the interpreter frames from the compiled frame and continues in the interpreter; the compiled method is marked “made not entrant”. Correctness is never at risk; you just pay a slowdown and a recompile. JFR records these as <code>jdk.Deoptimization</code> events.');
      P(() => { set('site', { state: 'hot', sub: 'Circle 60% · Square 40%' }); set('code', { state: 'ok', sub: 'bimorphic: 2 guarded inlines' }); set('interp', { state: '', sub: '' }); S.edges[1].state = ''; S.edges[1].label = ''; S.stats = [['receiver types seen', 2], ['call site', 'bimorphic, inlined']]; }, 'After re-profiling, C2 recompiles. With two types it inlines both behind type checks (<b>bimorphic</b>).');
      P(() => { set('site', { state: 'warn', sub: 'Circle · Square · Triangle · …' }); set('code', { state: 'warn', sub: 'megamorphic: vtable/itable call' }); S.stats = [['receiver types seen', '3+'], ['call site', 'megamorphic, not inlined']]; }, 'Three or more types with no dominant one (C2 still inlines a type that takes ~90% of calls): the site is <b>megamorphic</b>. C2 emits a real virtual call (vtable or itable lookup) and can’t inline, which also blocks escape analysis downstream. Hot polymorphic loops are a reason to restructure code, e.g. by grouping work per type.');
    } else {
      code('// naive "benchmark"\nlong t0 = System.nanoTime();\nfor (int i = 0; i < 1_000_000; i++) Math.log(i);          // result unused\nSystem.out.println((System.nanoTime() - t0) / 1_000_000.0 + " ns/op");');
      S.bars = [];
      const bar = (label, v, txt, c) => S.bars.push({ x: 20, y: 40 + S.bars.length * 44, label, v, max: 60, txt, c });
      P(() => { bar('naive, 1st run', 55, '≈55 ns/op', 'var(--warn)'); S.stats = [['includes', 'interpreter + compile time']]; }, 'The first naive run measures mostly the <b>interpreter</b> and the compilation itself: no warm-up. The number tells you nothing about steady state.');
      P(() => { bar('naive, 5th run', 0.4, '≈0.3 ns/op', 'var(--err)'); S.stats = [['impossible', 'log() in under 1 ns?']]; }, 'Run it a few more times in the same JVM and it becomes absurdly fast. C2 saw that the result of <code>Math.log</code> is never used and removed the call: <b>dead-code elimination</b>. You are timing an empty loop.');
      P(() => { S.notes = [{ x: 20, y: 200, t: 'Other traps: constant folding (inputs known at compile time) · OSR-compiled loops differ from normal ones', size: 12 }, { x: 20, y: 220, t: '· profile pollution between benchmarks in one JVM · GC pauses · CPU frequency scaling · System.currentTimeMillis()', size: 12 }]; }, 'Other classic traps: inputs that are compile-time constants get <b>folded</b>; a single long loop is compiled with OSR, which optimises differently; benchmarks run in one JVM <b>pollute each other’s profiles</b> (the first one gets monomorphic call sites, later ones don’t).');
      P(() => { bar('JMH + Blackhole', 18, '≈18 ns/op', 'var(--ok)'); S.notes.push({ x: 20, y: 262, t: '@Warmup · @Measurement · @Fork(2) · return the result or Blackhole.consume() · @State inputs', mono: true, size: 11.5, c: 'var(--ok)' }); S.stats = [['JMH', 'warm-up, forks, no DCE']]; },
        '<b>JMH</b> fixes this: separate warm-up and measurement iterations, a fresh JVM per fork (no profile pollution), and results that are returned or fed to a <code>Blackhole</code> so they can’t be eliminated. Inputs come from <code>@State</code> fields, not constants. Numbers here are illustrative; measure on your hardware.');
    }
    return st;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    S = { nodes: {}, edges: [], notes: [], bars: [], stats: [] };
    steps = plan(); render(); bStep.disabled = false;
    say({ tiers: 'Follow one hot method from its first call to optimised machine code. Press Play.', inline: 'A pricing loop calls three tiny methods and creates a temporary object per line. Press Play to watch C2 optimise it.', deopt: 'C2 compiles code based on what it has seen. Press Play to see what happens when that changes.', jmh: 'Why <code>System.nanoTime()</code> around a loop lies. Press Play.' }[mode]);
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

/* Java 8 → 21 tour: a clickable release timeline (LTS highlighted, what became final where) and an LTS-to-LTS migration walk with the traps at each hop. */
IA.widget('java-versions', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let mode = 'timeline'; let gen = 0; let running = false; let speed = 3000; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['timeline', 'timeline'], ['migrate', 'migration 8 → 21']], () => mode, (v) => { mode = v; reset(); }, 'View');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[4200, 'Slow'], [3000, 'Normal'], [1600, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const W = 760, H = 340, X0 = 34, X1 = 730, Y0 = 2014, Y1 = 2026, AY = 62;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Timeline of Java releases from 8 to 25 with LTS releases highlighted, and a panel describing the selected release' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const R = (x, y, w, h, o = {}) => svg('rect', { x, y, width: w, height: h, rx: o.rx == null ? 8 : o.rx, fill: o.fill || 'var(--surface)', stroke: o.stroke || 'var(--border)', 'stroke-width': o.sw || 1, 'stroke-dasharray': o.dash || null });
  const T = (x, y, s, o = {}) => svg('text', { x, y, 'font-size': o.fs || 12, 'font-weight': o.fw || null, 'text-anchor': o.a || 'start', 'font-family': o.mono ? 'var(--mono)' : null, fill: o.fill || 'var(--text)', text: s });

  const REL = [
    { v: 8, d: 2014.2, lts: true, h: 'Java 8 (LTS) · March 2014', f: ['Lambdas, method references, default methods', 'Streams API, Optional, CompletableFuture', 'java.time (JSR-310) replaces Date/Calendar', 'Metaspace replaces PermGen', 'Still widely deployed; long vendor support'] },
    { v: 9, d: 2017.7, h: 'Java 9 · September 2017', f: ['Module system (JPMS), jlink, JShell', 'List.of / Set.of / Map.of', 'G1 becomes the default GC', 'Compact strings (Latin-1 byte[])', 'VarHandle, StackWalker, ProcessHandle'] },
    { v: 10, d: 2018.2, h: 'Java 10 · March 2018 (6-month cadence starts)', f: ['var for local variables', 'List.copyOf, Optional.orElseThrow()', 'Container awareness on by default', 'Application class-data sharing'] },
    { v: 11, d: 2018.7, lts: true, h: 'Java 11 (LTS) · September 2018', f: ['Standard HttpClient (HTTP/2, async)', 'String.isBlank / strip / lines / repeat, Files.readString', 'Run a source file directly: java Main.java', 'JFR open-sourced; ZGC (experimental); TLS 1.3', 'Removed: Java EE modules (JAXB, JAX-WS) and CORBA'] },
    { v: 14, d: 2020.2, h: 'Java 12–14 · 2019–2020', f: ['Switch expressions with -> and yield (final in 14)', 'Helpful NullPointerException messages (14)', 'JFR event streaming (14)', 'Previews: records, text blocks, instanceof patterns'] },
    { v: 15, d: 2020.7, h: 'Java 15 · September 2020', f: ['Text blocks (""" … """)', 'ZGC and Shenandoah production-ready', 'Hidden classes', 'Removed Nashorn; biased locking disabled'] },
    { v: 16, d: 2021.2, h: 'Java 16 · March 2021', f: ['Records', 'Pattern matching for instanceof', 'Stream.toList()', 'JDK internals strongly encapsulated by default'] },
    { v: 17, d: 2021.7, lts: true, h: 'Java 17 (LTS) · September 2021', f: ['Sealed classes and interfaces', '--illegal-access removed: internals closed', 'RandomGenerator API; macOS/AArch64 port', 'Security Manager deprecated for removal', 'Baseline for Spring Boot 3 (jakarta.*)'] },
    { v: 18, d: 2022.2, h: 'Java 18–20 · 2022–2023', f: ['UTF-8 by default (18)', 'jwebserver; @snippet in javadoc (18)', 'Finalization deprecated for removal (18)', 'Previews: virtual threads, record patterns, switch patterns', 'Thread.stop always throws (20)'] },
    { v: 21, d: 2023.7, lts: true, h: 'Java 21 (LTS) · September 2023', f: ['Virtual threads', 'Pattern matching for switch + record patterns', 'Sequenced collections (getFirst, reversed…)', 'Generational ZGC (opt-in)', 'Previews: structured concurrency, scoped values'] },
    { v: 25, d: 2025.7, lts: true, next: true, h: 'Java 25 (LTS) · September 2025', f: ['Next LTS after 21', '22–24 brought: FFM API, unnamed variables, stream gatherers', 'JDK 24: synchronized no longer pins virtual threads', '25: scoped values final, compact source files', '25: compact object headers as a product option'] }
  ];
  const HOPS = [
    { from: 8, to: 11, breaks: ['javax.xml.bind / JAX-WS / CORBA removed', 'Version string "1.8.0_x" → "11.0.x"', 'Default GC Parallel → G1', 'Illegal-reflective-access warnings'], fixes: ['Add jakarta.xml.bind + jaxb-runtime jars', 'Use Runtime.version().feature()', 'Compare GC logs; pick GC explicitly', 'Upgrade libraries now, while it is a warning'] },
    { from: 11, to: 17, breaks: ['InaccessibleObjectException (JEP 396/403)', 'Old Lombok/Mockito/ByteBuddy/ASM fail', 'Nashorn gone (since 15)', 'Spring Boot 3 also needs jakarta.*'], fixes: ['Upgrade; --add-opens only as a stopgap', 'Bump build plugins with the JDK', 'GraalJS or drop server-side JS', 'OpenRewrite recipes for javax → jakarta'] },
    { from: 17, to: 21, breaks: ['Default charset is UTF-8 (since 18)', 'Dynamic agent warnings (JEP 451)', 'Class-file version 65 for tools', 'synchronized + blocking pins virtual threads'], fixes: ['Pass charsets explicitly', 'Load Mockito/agents with -javaagent', 'Upgrade Gradle, Jacoco, Spring', 'ReentrantLock around blocking I/O'] }
  ];
  const xOf = (d) => X0 + (d - Y0) / (Y1 - Y0) * (X1 - X0);

  let S;
  function axis() {
    stage.append(svg('line', { x1: X0, y1: AY, x2: X1, y2: AY, stroke: 'var(--border)', 'stroke-width': 2 }));
    for (let y = Y0; y <= Y1; y += 2) { const x = xOf(y); stage.append(svg('line', { x1: x, y1: AY + 4, x2: x, y2: AY + 10, stroke: 'var(--text-3)' }), T(x, AY + 24, String(y), { a: 'middle', fs: 10.5, fill: 'var(--text-3)' })); }
    REL.forEach((r, i) => {
      const x = xOf(r.d); const sel = S.sel === i; const done = S.seen.has(i);
      const inHop = S.hop != null && r.v >= HOPS[S.hop].from && r.v <= HOPS[S.hop].to;
      const c = svg('circle', { cx: x, cy: AY, r: r.lts ? 10 : 6, fill: sel ? 'var(--accent)' : r.lts ? (done || inHop ? 'var(--accent-soft)' : 'var(--surface)') : done ? 'var(--surface-2)' : 'var(--surface)', stroke: r.lts ? 'var(--accent)' : 'var(--text-3)', 'stroke-width': sel ? 3 : 2, style: 'cursor:pointer' });
      c.addEventListener('click', () => jump(i));
      stage.append(c);
      stage.append(T(x, AY - 16, String(r.v), { a: 'middle', fs: r.lts ? 13 : 11, fw: r.lts ? 700 : 500, fill: sel ? 'var(--accent)' : r.lts ? 'var(--text)' : 'var(--text-3)' }));
    });
    stage.append(T(X1, 18, '● LTS   • feature release', { a: 'end', fs: 11, fill: 'var(--text-3)' }));
  }
  function render() {
    stage.innerHTML = ''; axis();
    if (mode === 'timeline' && S.sel != null) {
      const r = REL[S.sel];
      stage.append(R(16, 110, W - 32, 214, { fill: 'var(--surface-2)', stroke: r.lts ? 'var(--accent)' : 'var(--border)', sw: r.lts ? 2 : 1 }));
      stage.append(T(32, 138, r.h, { fs: 15, fw: 700, fill: r.lts ? 'var(--accent)' : 'var(--text)' }));
      r.f.forEach((f, i) => stage.append(T(40, 168 + i * 28, '▸ ' + f, { fs: 13, fill: 'var(--text)' })));
      const x = xOf(r.d); stage.append(svg('line', { x1: x, y1: AY + 12, x2: x, y2: 110, stroke: r.lts ? 'var(--accent)' : 'var(--text-3)', 'stroke-dasharray': '3 3' }));
    }
    if (mode === 'migrate' && S.hop != null) {
      const h = HOPS[S.hop]; const a = REL.find((r) => r.v === h.from), b = REL.find((r) => r.v === h.to);
      stage.append(svg('line', { x1: xOf(a.d), y1: AY + 30, x2: xOf(b.d), y2: AY + 30, stroke: 'var(--accent)', 'stroke-width': 4 }));
      stage.append(T((xOf(a.d) + xOf(b.d)) / 2, AY + 46, `hop ${S.hop + 1}: Java ${h.from} → ${h.to}`, { a: 'middle', fs: 12, fw: 700, fill: 'var(--accent)' }));
      const colW = (W - 48) / 2;
      [['what breaks', h.breaks, 'var(--err)'], ['fix', h.fixes, 'var(--ok)']].forEach(([title, items, col], c) => {
        const x = 16 + c * (colW + 16); const show = c === 0 || S.fixed;
        stage.append(R(x, 124, colW, 200, { fill: 'var(--surface-2)', stroke: show ? col : 'var(--border)', sw: show ? 2 : 1, dash: show ? null : '5 4' }));
        stage.append(T(x + 14, 148, title, { fs: 13.5, fw: 700, fill: show ? col : 'var(--text-3)' }));
        if (show) items.forEach((it, i) => stage.append(T(x + 14, 178 + i * 34, (c ? '✓ ' : '✗ ') + it, { fs: 12, fill: 'var(--text)' })));
        else stage.append(T(x + colW / 2, 230, 'Step to reveal', { a: 'middle', fs: 12, fill: 'var(--text-3)' }));
      });
    }
    if (mode === 'migrate' && S.done) {
      stage.append(R(16, 124, W - 32, 200, { fill: 'var(--surface-2)', stroke: 'var(--ok)', sw: 2 }));
      ['Order that works: build tools → libraries → JDK in CI → JDK in prod → new features.', 'Scan first: jdeps --jdk-internals and jdeprscan on every jar, not just yours.', 'Set JVM flags explicitly (GC, heap %, charsets), so new defaults can’t change behavior.', 'Spring Boot 2 → 3 is its own hop: Java 17+, javax → jakarta, Hibernate 6.', 'Then adopt: records, sealed + switch patterns, virtual threads, sequenced collections.'].forEach((t, i) => stage.append(T(32, 156 + i * 34, (i + 1) + '. ' + t, { fs: 12.5 })));
    }
    statLine();
  }
  function statLine() {
    stats.innerHTML = ''; const add = (h) => stats.append(el('span', { class: 'w-stat', html: h }));
    if (mode === 'timeline') { add(`selected <b>${S.sel == null ? '—' : 'Java ' + REL[S.sel].v}</b>`); add(`LTS <b>8 · 11 · 17 · 21 · 25</b>`); }
    else { add(`hop <b>${S.hop == null ? '—' : (S.hop + 1) + ' / 3'}</b>`); }
  }
  function plan() {
    const st = [];
    if (mode === 'timeline') {
      REL.forEach((r, i) => st.push({ run: () => { S.sel = i; S.seen.add(i); }, t: () => (r.lts ? `<b>${r.h}</b>. LTS releases get years of updates from vendors; most teams move from one to the next.` : `<b>${r.h}</b>. A feature release: supported until the next one, six months later. Its finished features land in the next LTS.`) + (r.v === 21 ? ' This site assumes Java 21 throughout.' : '') }));
    } else {
      HOPS.forEach((h, i) => {
        st.push({ run: () => { S.hop = i; S.fixed = false; S.done = false; }, t: `Hop ${i + 1}: <b>Java ${h.from} → ${h.to}</b>. These are the things that typically break. Step again for the fixes.` });
        st.push({ run: () => { S.fixed = true; }, t: `Fixes for Java ${h.from} → ${h.to}. Most are library and build upgrades rather than code changes.` });
      });
      st.push({ run: () => { S.hop = null; S.done = true; }, t: 'The playbook. You can jump straight from 8 to 21. But you pay for every hop’s traps at once, so scan for all of them first.' });
    }
    return st;
  }
  function jump(i) {
    if (mode !== 'timeline') { mode = 'timeline'; [...segM.children].forEach((b, j) => b.classList.toggle('on', j === 0)); reset(); }
    running = false; bPlay.textContent = '▶ Play'; k = i; step();
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    S = { sel: null, seen: new Set(), hop: null, fixed: false, done: false };
    steps = plan(); render(); bStep.disabled = false;
    say(mode === 'timeline' ? 'Press Play or Step to walk the releases, or click any dot.' : 'Three LTS hops from Java 8 to 21. Press Play or Step.');
  }
  function step() {
    if (k >= steps.length) return false; const s = steps[k++]; s.run(); render(); say(typeof s.t === 'function' ? s.t() : s.t);
    bStep.disabled = k >= steps.length; return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 900 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

/* AOT & native: what happens at build time vs at every start, for the JVM, AOT on the JVM, native image and CRaC, plus two closed-world failures. Durations are illustrative. */
IA.widget('aot-native', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const B = (l, w, say, c) => ({ l, w, say, c });
  const COMPILE = B('javac + package', 1.2, 'The usual build: compile and package a jar.');
  const AOTP = B('AOT processing', 1.6, '<b>AOT processing</b> (<code>process-aot</code>/<code>processAot</code>): Boot refreshes the context <i>in the build</i>, evaluates conditions and profiles, and generates Java code that registers each bean definition, plus CGLIB proxy classes and <code>RuntimeHints</code>.', 'acc');
  const SC = {
    jvm: { label: 'regular JVM', curve: 'jit', intro: 'A typical Spring Boot service on the JVM, no AOT. Watch where the startup time goes.',
      build: [COMPILE],
      run: [B('JVM start', 0.4, 'The JVM starts and loads the classes it needs, one by one, from the jar.'),
        B('scan + parse config', 1.1, 'Spring scans packages for components and parses <code>@Configuration</code> classes and <code>AutoConfiguration.imports</code>.'),
        B('evaluate conditions', 0.9, 'Hundreds of <code>@ConditionalOn…</code> checks decide which auto-configurations apply. See <a href="auto-configuration.html">Auto-configuration</a>.'),
        B('create beans (reflection)', 1.3, 'Bean definitions are instantiated through reflection, proxies are generated with CGLIB at runtime, and JPA builds its metamodel.'),
        B('ready', 0.25, 'Ready: “Started … in a few seconds”. The code is still interpreted or lightly compiled.', 'ok')] },
    aot: { label: 'AOT on the JVM', curve: 'jit', intro: 'Same app, built with AOT processing and started with <code>-Dspring.aot.enabled=true</code> on a normal JVM.',
      build: [COMPILE, AOTP],
      run: [B('JVM start', 0.4, 'The JVM starts as usual.'),
        B('generated bean registration', 0.35, 'Instead of scanning, parsing and evaluating conditions, the app runs the <b>generated</b> initializer: plain method calls that register the pre-computed bean definitions.', 'acc'),
        B('create beans', 1.2, 'Beans are still created at runtime (now with generated instance suppliers rather than reflection), and the rest of the JVM work is unchanged.'),
        B('ready', 0.25, 'Faster than before, but the gain is modest: class loading and JIT warm-up remain. The closed-world rules for the bean set already apply here.', 'ok')] },
    native: { label: 'native image', curve: 'native', intro: 'The same AOT output, compiled by GraalVM <code>native-image</code> into a single executable.',
      build: [COMPILE, AOTP,
        B('points-to analysis', 4.2, '<code>native-image</code> analyses everything <b>reachable</b> from <code>main</code>, using the reachability metadata for reflection, resources and proxies. Unreachable code is left out. This step takes minutes and gigabytes of memory.', 'warn'),
        B('AOT compile + heap snapshot', 3.2, 'Reachable code is compiled to machine code; objects initialized at build time are stored in the <b>image heap</b>. The result is one binary for one OS and CPU architecture.', 'warn')],
      run: [B('exec + image heap', 0.05, 'Start = map the binary and its pre-built heap into memory. No class loading, no bytecode, no JIT.', 'acc'),
        B('register + create beans', 0.12, 'The generated bean registration runs as compiled code.', 'acc'),
        B('ready', 0.25, 'Ready in tens to hundreds of milliseconds for a typical service, with a smaller memory footprint. Throughput is good from the first request but there is no JIT to optimize further.', 'ok')] },
    miss: { label: 'missing hint', curve: 'none', intro: 'Native image again. A controller returns an <code>Object</code> built from a DTO that is only used through a helper; Spring didn’t register it for reflection.',
      build: [COMPILE, AOTP, B('points-to analysis', 4.2, 'The analysis never sees reflective access to <code>OrderDto</code>’s getters: no metadata, so their reflection data is not included.', 'warn'), B('compile + snapshot', 3.2, 'The binary builds fine. Nothing warns you.', 'warn')],
      run: [B('start', 0.17, 'Starts in milliseconds as expected.', 'acc'),
        B('GET /orders/7 → {}', 1.2, 'Jackson looks up <code>OrderDto</code>’s properties by reflection and finds none: the response is <code>{}</code> (other cases throw <code>ClassNotFoundException</code> or <code>NoSuchMethodException</code>). Fix: <code>@RegisterReflectionForBinding(OrderDto.class)</code> or a <code>RuntimeHintsRegistrar</code>, and run <code>nativeTest</code>.', 'bad')] },
    prof: { label: 'profile at runtime', curve: 'none', intro: 'The image was built in CI with no profile active. In production it is started with <code>--spring.profiles.active=prod</code>.',
      build: [COMPILE, B('AOT processing (no profile)', 1.6, 'AOT evaluated <code>@Profile("prod")</code> as false and <code>@ConditionalOnProperty(payments.mode=live)</code> as false: only the stub gateway’s definition was generated.', 'warn'), B('native-image', 7.4, 'The binary contains exactly that bean set.', 'warn')],
      run: [B('start --profiles=prod', 0.17, 'The profile is active for property sources, so <code>application-prod.yml</code> values are bound…', 'acc'),
        B('stub gateway in prod', 1.2, '…but the beans defined under <code>@Profile("prod")</code> don’t exist: the bean set was fixed at build time. Fix: build with the profiles you need, or choose implementations at runtime from properties inside one bean.', 'bad')] },
    crac: { label: 'CRaC', curve: 'warm', intro: 'A regular JVM app on a CRaC-enabled JDK (Linux), Boot 3.2+. A pipeline step starts it once and takes a checkpoint.',
      build: [COMPILE,
        B('training start (+ warm-up)', 3.0, 'The app starts normally in the pipeline; optionally you send warm-up traffic so the JIT compiles hot paths.'),
        B('checkpoint', 1.0, 'Spring stops lifecycle beans (pools close their sockets), then the JVM writes its whole state to disk: heap, loaded classes, JIT-compiled code. That includes any secrets in memory.', 'warn')],
      run: [B('restore', 0.1, '<code>java -XX:CRaCRestoreFrom=…</code> maps the saved state back in: no class loading, no Spring startup.', 'acc'),
        B('lifecycle start', 0.15, 'Spring restarts lifecycle beans: connection pools reconnect, schedulers resume.', 'acc'),
        B('ready (warm)', 0.25, 'Serving in milliseconds with already-compiled code, while keeping a full JVM (no closed world). Costs: Linux only, a CRaC JDK, and protecting the snapshot.', 'ok')] }
  };
  let sc = 'jvm'; let k = 0; let gen = 0; let running = false; let speed = 2400;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segSc = seg(Object.keys(SC).map((x) => [x, SC[x].label]), sc, (v) => { sc = v; reset(); }, 'Mode');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1200, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const stage = svg('svg', { viewBox: '0 0 760 300', role: 'img', 'aria-label': 'Build-time phases, run-time phases and throughput after start' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(el('div', { class: 'w-controls' }, segSc), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr);
  const steps = () => { const S = SC[sc]; const a = S.build.map((b, i) => ['b', i]).concat(S.run.map((b, i) => ['r', i])); if (S.curve !== 'none') a.push(['t', 0]); return a; };
  const FILL = { acc: 'var(--accent)', ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--err)' };
  function row(y, title, sub, blocks, shown, scaleMax, hot) {
    stage.append(svg('text', { x: 14, y: y - 8, 'font-size': 12, 'font-weight': 700, 'font-family': 'var(--mono)', fill: 'var(--text)', text: title }),
      svg('text', { x: 746, y: y - 8, 'font-size': 10.5, 'font-family': 'var(--mono)', fill: 'var(--text-3)', 'text-anchor': 'end', text: sub }),
      svg('rect', { x: 14, y, width: 732, height: 44, rx: 8, fill: 'var(--surface-2)', stroke: 'var(--border)' }));
    let x = 18; const total = Math.max(scaleMax, blocks.reduce((s, b) => s + b.w, 0)); const W = 724;
    blocks.forEach((b, i) => { const w = Math.max(6, (b.w / total) * W - 3); if (i < shown) {
      const col = FILL[b.c] || 'var(--text-3)';
      stage.append(svg('rect', { x, y: y + 4, width: w, height: 36, rx: 6, fill: `color-mix(in srgb, ${col} ${i === hot ? 32 : 18}%, var(--surface))`, stroke: col, 'stroke-width': i === hot ? 2.4 : 1.2 }));
      if (w > 40) stage.append(svg('text', { x: x + 6, y: y + 26, 'font-size': 10.5, 'font-family': 'var(--mono)', fill: 'var(--text)', text: b.l.length * 6.2 > w - 8 ? b.l.slice(0, Math.max(3, Math.floor((w - 8) / 6.2) - 1)) + '…' : b.l }));
      else if (i === shown - 1) stage.append(svg('text', { x: x + w + 4, y: y + 26, 'font-size': 10.5, 'font-family': 'var(--mono)', fill: 'var(--text-2)', text: b.l }));
    } x += w + 3; });
  }
  function render() {
    const S = SC[sc]; const st = steps().slice(0, k); const cur = st[st.length - 1];
    const nb = st.filter((s) => s[0] === 'b').length; const nr = st.filter((s) => s[0] === 'r').length; const showT = st.some((s) => s[0] === 't');
    stage.innerHTML = '';
    row(30, 'BUILD TIME', 'once, in CI (illustrative)', S.build, nb, 11, cur && cur[0] === 'b' ? cur[1] : -1);
    row(116, 'RUN TIME', 'every container start (illustrative)', S.run, nr, 4.2, cur && cur[0] === 'r' ? cur[1] : -1);
    // throughput
    stage.append(svg('text', { x: 14, y: 196, 'font-size': 12, 'font-weight': 700, 'font-family': 'var(--mono)', fill: 'var(--text)', text: 'THROUGHPUT AFTER START' }),
      svg('path', { d: 'M40 286 L746 286 M40 286 L40 206', stroke: 'var(--border)', 'stroke-width': 1.4, fill: 'none' }),
      svg('text', { x: 746, y: 298, 'font-size': 10, 'text-anchor': 'end', 'font-family': 'var(--mono)', fill: 'var(--text-3)', text: 'time since start → (minutes)' }));
    if (showT) {
      const pts = []; for (let i = 0; i <= 60; i++) { const t = i / 60; let v;
        if (S.curve === 'jit') v = t < 0.06 ? 0 : 0.92 * (1 - Math.exp(-(t - 0.06) * 6));
        else if (S.curve === 'native') v = t < 0.005 ? 0 : 0.74;
        else v = t < 0.005 ? 0 : 0.9;
        pts.push(`${40 + t * 700} ${286 - v * 76}`); }
      stage.append(svg('path', { d: 'M' + pts.join(' L'), fill: 'none', stroke: S.curve === 'native' ? 'var(--accent)' : S.curve === 'warm' ? 'var(--ok)' : 'var(--warn)', 'stroke-width': 2.6 }));
      stage.append(svg('text', { x: 400, y: 214, 'font-size': 10.5, 'font-family': 'var(--mono)', fill: 'var(--text-2)', 'text-anchor': 'middle', text: S.curve === 'jit' ? 'slow start, JIT warms up, then high peak' : S.curve === 'native' ? 'full speed at once, no further JIT gains (often a lower peak)' : 'restored already warm' }));
    }
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${steps().length}` }), el('div', { class: 't', html: h })); }
  function sayCur() {
    const S = SC[sc]; const cur = steps()[k - 1];
    if (!cur) return say(S.intro);
    if (cur[0] === 't') return say(S.curve === 'jit' ? 'After start the JIT compiles hot methods using real profiles. Early requests are slower; peak throughput comes minutes later. Readiness probes should allow for it.' : S.curve === 'native' ? 'A native image runs compiled code from the first request but can’t re-optimize for the live workload. Many long-running services reach a higher peak on the JVM; Oracle GraalVM’s profile-guided optimization narrows the gap.' : 'CRaC restores JIT-compiled code, so it is warm immediately.', S.curve === 'native' ? 'warn' : 'ok');
    const b = (cur[0] === 'b' ? S.build : S.run)[cur[1]];
    say(b.say, b.c === 'bad' ? 'err' : b.c === 'ok' ? 'ok' : b.c === 'warn' ? 'warn' : '');
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; render(); sayCur(); bStep.disabled = false; }
  function step() { if (k >= steps().length) return false; k++; render(); sayCur(); if (k >= steps().length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps().length) reset();
    if (reduced) { while (step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

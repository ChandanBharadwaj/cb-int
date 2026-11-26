/* spring-config-basics: beginner step-through widget (scenarios, boxes and arrows, startup log). */
IA.widget('spring-config-basics', (root, ctx) => {
  const C = {
    id: 'spring-config-basics', vb: '0 0 760 300', aria: 'Property sources stacking up, and the winning value flowing into @Value and @ConfigurationProperties beans', logLabel: 'Resolved values',
    nodes: {
      props: [10, 225, 230, 'application.yml', 'app.greeting: Hello'],
      dev: [10, 150, 230, 'application-dev.yml', 'app.greeting: Hi (dev)'],
      env: [10, 75, 230, 'env variable', 'APP_GREETING=Hey'],
      cli: [10, 0, 230, 'command line', '--app.greeting=Yo'],
      envr: [280, 112, 200, 'Environment', 'all sources merged'],
      val: [520, 30, 230, '@Value bean', '${app.greeting}'],
      cp: [520, 190, 230, 'AppProperties', '@ConfigurationProperties']
    },
    sc: {
      base: { label: 'One file', nodes: ['props', 'envr', 'val', 'cp'],
        intro: 'Just <code>application.yml</code> in <code>src/main/resources</code>. Press Play.',
        steps: [
          { n: { props: 'ok' }, hot: ['props'], say: 'Boot loads <code>application.properties</code> or <code>application.yml</code> from the classpath automatically. Both formats mean the same thing: <code>app.greeting=Hello</code> equals the YAML nesting <code>app:</code> → <code>greeting: Hello</code>.' },
          { n: { envr: 'ok' }, lab: { envr: 'app.greeting = Hello' }, hot: ['envr'], e: [['props', 'envr', 'ok']], say: 'Every source ends up in one place, the <b>Environment</b>: a lookup from key to value.' },
          { n: { val: 'ok' }, lab: { val: 'greeting = "Hello"' }, hot: ['val'], e: [['envr', 'val', 'ok', '@Value']], log: '@Value("${app.greeting}") → "Hello"', say: '<code>@Value("${app.greeting}")</code> injects one value. Good for a single setting.' },
          { n: { cp: 'ok' }, lab: { cp: 'greeting, timeout, retries' }, hot: ['cp'], e: [['envr', 'cp', 'ok', 'bind app.*']], log: 'AppProperties[greeting=Hello, timeout=PT5S, retries=3]', logc: 'o', tone: 'ok', say: '<code>@ConfigurationProperties(prefix = "app")</code> binds a whole group into a typed object, a record in Boot 3. Types are converted: <code>5s</code> → <code>Duration</code>, <code>3</code> → <code>int</code>.' }
        ] },
      prof: { label: 'dev profile', nodes: ['props', 'dev', 'envr', 'val', 'cp'],
        intro: 'Start with <code>--spring.profiles.active=dev</code>. Boot also loads <code>application-dev.yml</code>.',
        steps: [
          { n: { props: 'ok' }, hot: ['props'], say: 'The default file is always loaded first.' },
          { n: { dev: 'ok' }, hot: ['dev'], say: 'Because the <b>dev</b> profile is active, <code>application-dev.yml</code> is loaded too.' },
          { n: { envr: 'ok' }, lab: { envr: 'app.greeting = Hi (dev)' }, e: [['props', 'envr', 'n'], ['dev', 'envr', 'ok', 'wins']], hot: ['envr'], say: 'Profile-specific files <b>override</b> the default file for the same key. Keys that dev does not mention keep their default value.' },
          { n: { val: 'ok', cp: 'ok' }, lab: { val: 'greeting = "Hi (dev)"', cp: 'greeting = Hi (dev)' }, e: [['envr', 'val', 'ok'], ['envr', 'cp', 'ok']], log: 'The following 1 profile is active: "dev"', logc: 'o', tone: 'ok', say: 'Use profiles for per-environment differences: local H2 vs real Postgres, verbose logging in dev. More in <a href="configuration-profiles.html">Profiles &amp; conditions</a>.' }
        ] },
      prec: { label: 'Who wins?', nodes: ['props', 'dev', 'env', 'cli', 'envr', 'val'],
        intro: 'The same key is set in four places. Higher in the stack wins. Press Play.',
        steps: [
          { n: { props: 'on' }, e: [['props', 'envr', 'n']], lab: { envr: 'Hello' }, say: 'Lowest: the packaged <code>application.yml</code>.' },
          { n: { dev: 'on', envr: 'on' }, e: [['dev', 'envr', 'n']], lab: { envr: 'Hi (dev)' }, say: 'Profile file beats the default file.' },
          { n: { env: 'on' }, e: [['env', 'envr', 'n']], lab: { envr: 'Hey' }, say: 'OS <b>environment variables</b> beat config files. <code>APP_GREETING</code> maps to <code>app.greeting</code> by relaxed binding (upper-case, dots → underscores). This is how containers and cloud platforms configure apps.' },
          { n: { cli: 'ok', envr: 'ok' }, e: [['cli', 'envr', 'ok', 'wins']], lab: { envr: 'app.greeting = Yo' }, hot: ['cli'], say: '<b>Command-line arguments</b> beat all of these.' },
          { n: { val: 'ok' }, lab: { val: 'greeting = "Yo"' }, e: [['envr', 'val', 'ok']], log: 'cli > env var > application-dev.yml > application.yml', logc: 'o', tone: 'ok', say: 'Simplified order shown here; the full list has more sources. See <a href="externalized-config.html">Externalized configuration</a>. Never put secrets in the jar’s files: inject them from the environment.' }
        ] }
    }
  };
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-sb-style')) {
    document.head.append(el('style', { id: 'w-sb-style', text: `
.w-sb .nd rect { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: fill .3s, stroke .3s; }
.w-sb .nd text.nm { fill: var(--text); font-family: var(--mono); font-weight: 700; font-size: 15px; }
.w-sb .nd text.lb { fill: var(--text-2); font-family: var(--mono); font-size: 12px; }
.w-sb .nd.idle { opacity: .35; }
.w-sb .nd.on rect { stroke: var(--accent); stroke-width: 2; fill: var(--accent-soft); }
.w-sb .nd.work rect { stroke: var(--warn); stroke-width: 2; fill: color-mix(in srgb, var(--warn) 14%, var(--surface)); }
.w-sb .nd.ok rect { stroke: var(--ok); stroke-width: 2; fill: color-mix(in srgb, var(--ok) 12%, var(--surface)); }
.w-sb .nd.err rect { stroke: var(--err); stroke-width: 2; fill: color-mix(in srgb, var(--err) 12%, var(--surface)); }
.w-sb .nd.off { opacity: .5; } .w-sb .nd.off rect { stroke-dasharray: 5 4; }
.w-sb .nd.hot rect { stroke-width: 3.5; }
.w-sb .eg { fill: none; stroke: var(--edge); stroke-width: 1.8; }
.w-sb .eg.try { stroke: var(--warn); stroke-width: 2.4; }
.w-sb .eg.ok { stroke: var(--ok); stroke-width: 2.4; }
.w-sb .eg.err { stroke: var(--err); stroke-width: 2.4; stroke-dasharray: 6 4; }
.w-sb .el { fill: var(--text-2); font-family: var(--mono); font-size: 12px; paint-order: stroke; stroke: var(--bg); stroke-width: 4px; }
.w-sb-log { font-family: var(--mono); font-size: 12px; line-height: 1.55; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; max-height: 160px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--text-2); margin-top: 10px; }
.w-sb-log .e { color: var(--err); } .w-sb-log .o { color: var(--ok); }
` }));
  }
  const N = C.nodes; const S = C.sc;
  let sc = Object.keys(S)[0]; let k = 0; let gen = 0; let running = false; let speed = 2600; let st;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segSc = seg(Object.keys(S).map((x) => [x, S[x].label]), sc, (v) => { sc = v; reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1200, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const stage = svg('svg', { viewBox: C.vb, role: 'img', 'aria-label': C.aria });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const log = el('div', { class: 'w-sb-log', 'aria-label': C.logLabel || 'Log' });
  root.classList.add('w-sb');
  root.append(el('div', { class: 'w-controls' }, segSc), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, log);
  const box = (id) => { const n = N[id]; return { x: n[0], y: n[1], w: n[2] || 200, h: 56 }; };
  const anchor = (a, b) => {
    const A = box(a); const B = box(b);
    const acx = A.x + A.w / 2; const acy = A.y + A.h / 2; const bcx = B.x + B.w / 2; const bcy = B.y + B.h / 2;
    let p, q;
    if (Math.abs(bcx - acx) * 0.5 > Math.abs(bcy - acy)) {
      p = [bcx > acx ? A.x + A.w : A.x, acy]; q = [bcx > acx ? B.x : B.x + B.w, bcy];
    } else {
      p = [acx, bcy > acy ? A.y + A.h : A.y]; q = [bcx, bcy > acy ? B.y : B.y + B.h];
    }
    return { d: `M${p[0]} ${p[1]} L ${q[0]} ${q[1]}`, mx: (p[0] + q[0]) / 2, my: (p[1] + q[1]) / 2 };
  };
  const MK = { n: 'var(--edge)', try: 'var(--warn)', ok: 'var(--ok)', err: 'var(--err)' };
  function render() {
    stage.innerHTML = '';
    const defs = svg('defs');
    Object.entries(MK).forEach(([c, col]) => defs.append(svg('marker', { id: C.id + '-ar-' + c, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: col }))));
    stage.append(defs);
    const labels = [];
    st.edges.forEach(([a, b, c, t]) => { const g = anchor(a, b); stage.append(svg('path', { class: 'eg ' + (c || ''), d: g.d, 'marker-end': `url(#${C.id}-ar-${c || 'n'})` })); if (t) labels.push(svg('text', { class: 'el', x: g.mx, y: g.my - 6, 'text-anchor': 'middle', text: t })); });
    S[sc].nodes.forEach((id) => {
      const b = box(id);
      const g = svg('g', { class: 'nd ' + st.n[id] + (st.hot.includes(id) ? ' hot' : '') });
      g.append(svg('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 9 }), svg('text', { class: 'nm', x: b.x + 12, y: b.y + 23, text: st.nm[id] }), svg('text', { class: 'lb', x: b.x + 12, y: b.y + 43, text: st.lab[id] }));
      stage.append(g);
    });
    labels.forEach((t) => stage.append(t));
    log.innerHTML = '';
    st.log.forEach(([t, c]) => log.append(el('div', { class: c || '', text: t })));
    log.scrollTop = log.scrollHeight;
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${S[sc].steps.length}` }), el('div', { class: 't', html: h })); }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    st = { n: {}, nm: {}, lab: {}, hot: [], edges: [], log: [] };
    S[sc].nodes.forEach((id) => { st.n[id] = 'idle'; st.nm[id] = (S[sc].nm0 || {})[id] || N[id][3]; st.lab[id] = (S[sc].lab0 || {})[id] || N[id][4] || ''; });
    render(); say(S[sc].intro); bStep.disabled = false;
  }
  function step() {
    const steps = S[sc].steps; if (k >= steps.length) return false;
    const s = steps[k++];
    if (s.clear) st.edges = [];
    Object.assign(st.n, s.n || {}); Object.assign(st.lab, s.lab || {}); Object.assign(st.nm, s.nm || {}); st.hot = s.hot || [];
    (s.e || []).forEach(([a, b, c, t]) => { st.edges = st.edges.filter((x) => !(x[0] === a && x[1] === b)); st.edges.push([a, b, c, t]); });
    if (s.log) st.log.push([s.log, s.logc]);
    render(); say(s.say, s.tone);
    if (k >= steps.length) bStep.disabled = true;
    return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= S[sc].steps.length) reset();
    if (reduced) { while (step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

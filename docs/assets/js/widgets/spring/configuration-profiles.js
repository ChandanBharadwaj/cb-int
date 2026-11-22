/* @Configuration full vs lite mode: does calling dataSource() from another @Bean method return the bean, or a brand-new pool? */
IA.widget('configuration-profiles', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-cfg-style')) {
    document.head.append(el('style', { id: 'w-cfg-style', text: `
.w-cfg svg text { font-family: var(--mono); }
.w-cfg .bx { fill: var(--surface); stroke: var(--border); stroke-width: 1.6; transition: fill .3s, stroke .3s, opacity .3s; }
.w-cfg .bx.idle { opacity: .3; }
.w-cfg .bx.hot { stroke: var(--accent); stroke-width: 2.6; fill: var(--accent-soft); }
.w-cfg .bx.ok { stroke: var(--ok); stroke-width: 2.2; fill: color-mix(in srgb, var(--ok) 11%, var(--surface)); }
.w-cfg .bx.bad { stroke: var(--err); stroke-width: 2.4; fill: color-mix(in srgb, var(--err) 11%, var(--surface)); }
.w-cfg .band { fill: none; stroke: var(--accent); stroke-width: 2; stroke-dasharray: 8 5; }
.w-cfg .ln { fill: none; stroke: var(--edge); stroke-width: 1.7; }
.w-cfg .ln.ok { stroke: var(--ok); stroke-width: 2.4; }
.w-cfg .ln.bad { stroke: var(--err); stroke-width: 2.4; }
.w-cfg .ln.hot { stroke: var(--accent); stroke-width: 2.6; }
` }));
  }
  const CODE = {
    full: '@Configuration                       // proxyBeanMethods = true (default)\nclass DbConfig {\n  @Bean DataSource dataSource() { return new HikariDataSource(cfg); }\n  @Bean JdbcTemplate jdbcTemplate() { return new JdbcTemplate(dataSource()); }\n  @Bean PlatformTransactionManager txManager() {\n    return new DataSourceTransactionManager(dataSource());\n  }\n}',
    lite: '@Configuration(proxyBeanMethods = false)   // or @Component: "lite" mode\nclass DbConfig {\n  @Bean DataSource dataSource() { return new HikariDataSource(cfg); }\n  @Bean JdbcTemplate jdbcTemplate() { return new JdbcTemplate(dataSource()); }\n  @Bean PlatformTransactionManager txManager() {\n    return new DataSourceTransactionManager(dataSource());\n  }\n}',
    param: '@Configuration(proxyBeanMethods = false)   // lite, done right\nclass DbConfig {\n  @Bean DataSource dataSource() { return new HikariDataSource(cfg); }\n  @Bean JdbcTemplate jdbcTemplate(DataSource ds) { return new JdbcTemplate(ds); }\n  @Bean PlatformTransactionManager txManager(DataSource ds) {\n    return new DataSourceTransactionManager(ds);\n  }\n}'
  };
  const LABEL = { full: 'full: @Configuration', lite: 'lite: proxyBeanMethods=false', param: 'lite + parameters' };
  let mode = 'full'; let k = 0; let gen = 0; let running = false; let speed = 2600; let st; let steps = [];
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segM = seg(Object.entries(LABEL), mode, (v) => { mode = v; reset(); }, 'Configuration mode');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1200, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const codeHost = el('div', { style: { marginBottom: '10px' } });
  const stage = svg('svg', { viewBox: '0 0 760 280', role: 'img', 'aria-label': 'Bean methods on the left, the beans they produce in the middle, connection pools on the right' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-cfg');
  root.append(el('div', { class: 'w-controls' }, segM), codeHost, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);

  const M = ['dataSource()', 'jdbcTemplate()', 'txManager()'];
  const B = ['DataSource', 'JdbcTemplate', 'TxManager'];
  const y = (i) => 40 + i * 80; const W = 200; const H = 56; const MX = 20; const BX = 290; const PX = 545;
  function plan() {
    const S = []; const full = mode === 'full'; const param = mode === 'param';
    S.push({ cls: full ? 'DbConfig$$SpringCGLIB$$0' : 'DbConfig', m: ['', '', ''], say: full
      ? '<code>ConfigurationClassPostProcessor</code> parses DbConfig, registers 3 bean definitions and <b>enhances</b> the class: the container instantiates a CGLIB subclass whose <code>@Bean</code> methods are intercepted (the dashed band).'
      : 'DbConfig is parsed and 3 bean definitions are registered. In lite mode the class is <b>not</b> enhanced: its methods are plain Java methods.' });
    S.push({ m: ['hot', '', ''], b: ['ok', '', ''], p: [1], ln: [['mb', 0, 'hot'], ['bp', 0, 0, 'ok']], say: 'The container calls <code>dataSource()</code> to create the <b>dataSource</b> bean: HikariPool-1 is created, registered and managed (closed on shutdown, visible to metrics).' });
    if (full) {
      S.push({ m: ['hot', 'hot', ''], b: ['ok', 'ok', ''], p: [1], ln: [['mm', 1, 'hot'], ['mb', 1, 'ok'], ['bp', 1, 0, 'ok']], say: '<code>jdbcTemplate()</code> calls <code>dataSource()</code>. The interceptor notices the container isn’t the caller and returns <code>beanFactory.getBean("dataSource")</code> instead of running the method body: the same HikariPool-1.', tone: 'ok' });
      S.push({ m: ['hot', '', 'hot'], b: ['ok', 'ok', 'ok'], p: [1], ln: [['mm', 2, 'hot'], ['mb', 2, 'ok'], ['bp', 2, 0, 'ok']], say: '<code>txManager()</code> does the same and also gets HikariPool-1. Inter-bean method calls respect the singleton scope.', tone: 'ok' });
      S.push({ m: ['', '', ''], b: ['ok', 'ok', 'ok'], p: [1], ln: [['bp', 1, 0, 'ok'], ['bp', 2, 0, 'ok']], say: 'One pool. <code>JdbcTemplate</code> and the transaction manager share it, so JDBC calls inside <code>@Transactional</code> use the bound connection. The cost: CGLIB subclassing (class can’t be final) and a bit of startup time.', tone: 'ok' });
    } else if (param) {
      S.push({ m: ['', 'hot', ''], b: ['ok', 'ok', ''], p: [1], ln: [['mb', 1, 'ok'], ['bp', 1, 0, 'ok']], say: '<code>jdbcTemplate(DataSource ds)</code>: the container resolves the parameter from the context, exactly like constructor injection. It is the dataSource bean, HikariPool-1. No proxy needed.', tone: 'ok' });
      S.push({ m: ['', '', 'hot'], b: ['ok', 'ok', 'ok'], p: [1], ln: [['mb', 2, 'ok'], ['bp', 2, 0, 'ok']], say: '<code>txManager(DataSource ds)</code> gets the same bean. One pool.', tone: 'ok' });
      S.push({ m: ['', '', ''], b: ['ok', 'ok', 'ok'], p: [1], ln: [['bp', 1, 0, 'ok'], ['bp', 2, 0, 'ok']], say: 'Same result as full mode, without the CGLIB subclass. Spring Boot’s own auto-configurations use <code>proxyBeanMethods = false</code> for this reason.', tone: 'ok' });
    } else {
      S.push({ m: ['hot', 'hot', ''], b: ['ok', 'ok', ''], p: [1, 2], ln: [['mm', 1, 'hot'], ['mb', 1, 'ok'], ['bp', 1, 1, 'bad']], say: '<code>jdbcTemplate()</code> calls <code>dataSource()</code>, and that is now an ordinary Java call. The body runs again: <b>HikariPool-2</b>, a pool that isn’t a bean. Nobody closes it, and it doesn’t show in metrics.', tone: 'err' });
      S.push({ m: ['hot', '', 'hot'], b: ['ok', 'ok', 'ok'], p: [1, 2, 3], ln: [['mm', 2, 'hot'], ['mb', 2, 'ok'], ['bp', 2, 2, 'bad']], say: '<code>txManager()</code> calls it a third time: <b>HikariPool-3</b>.', tone: 'err' });
      S.push({ m: ['', '', ''], b: ['ok', 'bad', 'bad'], p: [1, 2, 3], ln: [['bp', 1, 1, 'bad'], ['bp', 2, 2, 'bad']], say: 'Three pools, three times the connections. Worse: the transaction manager binds a connection from pool 3, while <code>JdbcTemplate</code> borrows from pool 2, so its queries run <b>outside</b> your <code>@Transactional</code> and don’t roll back.', tone: 'err' });
    }
    return S;
  }
  function render() {
    stage.innerHTML = '';
    const curve = (x1, y1, x2, y2, c) => stage.append(svg('path', { class: 'ln ' + c, d: `M${x1} ${y1} C ${x1 + 35} ${y1}, ${x2 - 35} ${y2}, ${x2} ${y2}` }));
    (st.ln || []).forEach((l) => {
      if (l[0] === 'mb') curve(MX + W, y(l[1]) + H / 2, BX, y(l[1]) + H / 2, l[2]);
      if (l[0] === 'bp') curve(BX + W, y(l[1]) + H / 2, PX, y(l[2]) + H / 2, l[3]);
      if (l[0] === 'mm') stage.append(svg('path', { class: 'ln ' + l[2], d: `M${MX + 18} ${y(l[1])} C ${MX - 6} ${y(l[1]) - 30}, ${MX - 6} ${y(0) + H + 30}, ${MX + 18} ${y(0) + H}`, 'stroke-dasharray': '5 4' }));
    });
    stage.append(svg('text', { x: MX, y: 22, 'font-size': 13, fill: 'var(--text-3)', text: st.cls || 'DbConfig' }), svg('text', { x: BX, y: 22, 'font-size': 13, fill: 'var(--text-3)', text: 'beans in the context' }), svg('text', { x: PX, y: 22, 'font-size': 13, fill: 'var(--text-3)', text: 'connection pools' }));
    if (mode === 'full' && k > 0) stage.append(svg('rect', { class: 'band', x: MX - 12, y: 30, width: W + 24, height: 236, rx: 14 }));
    M.forEach((m, i) => stage.append(svg('rect', { class: 'bx ' + (k ? (st.m[i] || '') : 'idle'), x: MX, y: y(i), width: W, height: H, rx: 9 }), svg('text', { x: MX + 14, y: y(i) + 25, 'font-size': 14, 'font-weight': 700, fill: 'var(--text)', text: '@Bean ' + m }),
      svg('text', { x: MX + 14, y: y(i) + 44, 'font-size': 11.5, fill: 'var(--text-3)', text: mode === 'full' && k > 0 ? 'intercepted' : 'plain method' })));
    B.forEach((b, i) => stage.append(svg('rect', { class: 'bx ' + ((st.b && st.b[i]) || 'idle'), x: BX, y: y(i), width: W, height: H, rx: 9 }), svg('text', { x: BX + 14, y: y(i) + 25, 'font-size': 14, 'font-weight': 700, fill: 'var(--text)', text: b }),
      svg('text', { x: BX + 14, y: y(i) + 44, 'font-size': 11.5, fill: 'var(--text-3)', text: i === 0 ? 'bean "dataSource"' : i === 1 ? 'bean "jdbcTemplate"' : 'bean "txManager"' })));
    [1, 2, 3].forEach((p, i) => { const on = (st.p || []).includes(p); stage.append(svg('rect', { class: 'bx ' + (on ? (p === 1 ? 'ok' : 'bad') : 'idle'), x: PX, y: y(i), width: W, height: H, rx: 9 }),
      svg('text', { x: PX + 14, y: y(i) + 25, 'font-size': 14, 'font-weight': 700, fill: 'var(--text)', text: `HikariPool-${p}` }),
      svg('text', { x: PX + 14, y: y(i) + 44, 'font-size': 11.5, fill: p === 1 ? 'var(--text-3)' : 'var(--err)', text: on ? (p === 1 ? 'managed bean' : 'unmanaged, never closed') : '' })); });
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `pools opened <b>${(st.p || []).length}</b>` }), el('span', { class: 'w-stat', html: `max connections <b>${(st.p || []).length * 10}</b> (10 per pool)` }));
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${steps.length}` }), el('div', { class: 't', html: h })); }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = plan(); st = { m: ['', '', ''] };
    codeHost.innerHTML = ''; codeHost.append(ctx.codeBox(CODE[mode], 'java'));
    render(); say('Three <code>@Bean</code> methods; two of them need the DataSource. Press Play or Step and count the connection pools.'); bStep.disabled = false;
  }
  function step() { if (k >= steps.length) return false; st = { ...st, tone: "", ...steps[k++] }; render(); say(st.say, st.tone); if (k >= steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    if (reduced) { while (step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

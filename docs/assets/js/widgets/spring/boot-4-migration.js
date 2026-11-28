/* Boot 3 → 4: walk a Boot 3.5 service to Boot 4, one part at a time (what you have → what Boot 4 expects → what breaks and the fix), then what Boot 4.1 adds. */
IA.widget('boot-4-migration', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let gen = 0; let running = false; let speed = 3200; let k = 0; let S;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[4600, 'Slow'], [3200, 'Normal'], [1700, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');

  const ROWS = [
    { k: 'Baseline', a: 'Java 17+ · Jakarta EE 10 · Servlet 6.0', b: 'Java 17+ (25 fine) · EE 11 · Servlet 6.1',
      t: '<b>Baseline.</b> The Java minimum did not move: still 17, with 25 recommended as the latest LTS. Jakarta EE went to 11 (Servlet 6.1, JPA 3.2, Bean Validation 3.1). Packages are still <code>jakarta.*</code>. First get to the latest Boot 3.5 and clear every deprecation: Boot 4 removed them all.' },
    { k: 'Server', a: 'Tomcat 10.1 · Jetty 12 · Undertow', b: 'Tomcat 11 · Jetty 12.1 · no Undertow',
      t: '<b>Embedded server.</b> Servlet 6.1 means Tomcat 11 or Jetty 12.1. Undertow has no Servlet 6.1 support, so <code>spring-boot-starter-undertow</code> is gone. Fully executable jars (the launch script) are gone too: run with <code>java -jar</code>.' },
    { k: 'Starters', a: 'starter-web + one big autoconfigure jar', b: 'starter-webmvc + a module per technology',
      t: '<b>Modules.</b> Every technology has its own module and starter: <code>spring-boot-starter-webmvc</code>, <code>-flyway</code>, <code>-aspectj</code>… A bare library such as <code>flyway-core</code> no longer switches its auto-configuration on. No error, it just does not run. Bridge with <code>spring-boot-starter-classic</code>, then move to specific starters.' },
    { k: 'JSON', a: 'Jackson 2 · com.fasterxml · ObjectMapper', b: 'Jackson 3 · tools.jackson · JsonMapper',
      t: '<b>Jackson 3.</b> Imports move to <code>tools.jackson</code>. Only the annotations stay in <code>com.fasterxml.jackson.annotation</code>. Customise with <code>JsonMapperBuilderCustomizer</code>. A leftover Jackson 2 <code>ObjectMapper</code> bean is ignored by Spring MVC. <code>spring.jackson.use-jackson2-defaults=true</code> eases the move.' },
    { k: 'Tests', a: '@MockBean · TestRestTemplate for free', b: '@MockitoBean · @AutoConfigureTestRestTemplate',
      t: '<b>Tests.</b> <code>@MockBean</code> and <code>@SpyBean</code> are removed: use <code>@MockitoBean</code> / <code>@MockitoSpyBean</code>. <code>@SpringBootTest</code> no longer registers <code>TestRestTemplate</code> for you. New: <code>RestTestClient</code>. Test starters are per technology. JUnit 6 is the baseline.' },
    { k: 'Null-safety', a: 'org.springframework.lang.@Nullable', b: 'org.jspecify @Nullable / @NullMarked',
      t: '<b>JSpecify.</b> Spring’s APIs are annotated with JSpecify, which also covers generics, arrays and varargs. Java code behaves the same at run time. Kotlin and null-checking builds see stricter types and may need small fixes.' },
    { k: 'Resilience', a: 'Spring Retry or Resilience4j add-ons', b: '@Retryable · @ConcurrencyLimit built in',
      t: '<b>Built-in retry.</b> Framework 7 has <code>@Retryable</code> and <code>@ConcurrencyLimit</code>, enabled by <code>@EnableResilientMethods</code>, plus a <code>RetryTemplate</code> in spring-core. <code>maxRetries = 3</code> means 4 calls. Boot 4 no longer manages the Spring Retry version. Circuit breakers still need Resilience4j.' },
    { k: 'API versions', a: 'hand-rolled /v1 and /v2 paths', b: '@GetMapping(version = "1.2+")',
      t: '<b>API versioning.</b> Put the version on the mapping and tell Spring where to read it: <code>spring.mvc.apiversion.use.header=X-Version</code>. Once enabled, a version is required: set <code>spring.mvc.apiversion.default</code> or old clients get a 400.' }
  ];
  const EXTRA = ['gRPC: auto-configured servers and clients', 'InetAddressFilter on HTTP clients (SSRF)', 'spring.datasource.connection-fetch=lazy', 'Context propagation for @Async'];

  const W = 760, RH = 38, Y0 = 44, H = Y0 + ROWS.length * RH + 62;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Eight parts of a Spring Boot 3.5 service on the left and what each becomes in Spring Boot 4 on the right, migrated one row at a time' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const R = (x, y, w, h, o = {}) => svg('rect', { x, y, width: w, height: h, rx: 7, fill: o.fill || 'var(--surface)', stroke: o.stroke || 'var(--border)', 'stroke-width': o.sw || 1, 'stroke-dasharray': o.dash || null });
  const T = (x, y, s, o = {}) => svg('text', { x, y, 'font-size': o.fs || 12, 'font-weight': o.fw || null, 'text-anchor': o.a || 'start', 'font-family': o.mono ? 'var(--mono)' : null, fill: o.fill || 'var(--text)', text: s });

  const CX = 14, CK = 92, CA = 112, CW = 296, CB = 446;
  function render() {
    stage.innerHTML = '';
    stage.append(T(CA + 8, 24, 'Boot 3.5 · Framework 6.2', { fs: 13, fw: 700, fill: 'var(--text-3)' }));
    stage.append(T(CB + 8, 24, 'Boot 4 · Framework 7', { fs: 13, fw: 700, fill: 'var(--accent)' }));
    ROWS.forEach((r, i) => {
      const y = Y0 + i * RH; const done = S.done.has(i); const hot = S.hot === i;
      const g = svg('g', { style: 'cursor:pointer' });
      g.append(svg('rect', { x: 4, y: y - 3, width: W - 8, height: RH - 2, rx: 8, fill: hot ? 'var(--accent-soft)' : 'transparent' }));
      g.append(T(CX, y + 19, r.k, { fs: 12, fw: 700, fill: hot ? 'var(--accent)' : 'var(--text)' }));
      g.append(R(CA, y, CW, RH - 8, { fill: 'var(--surface-2)', stroke: done ? 'var(--border)' : 'var(--text-3)' }));
      g.append(T(CA + 8, y + 19, r.a, { fs: 11.5, fill: done ? 'var(--text-3)' : 'var(--text)' }));
      g.append(T(CA + CW + 19, y + 20, '→', { a: 'middle', fs: 15, fw: 700, fill: done ? 'var(--ok)' : 'var(--text-3)' }));
      g.append(R(CB, y, W - CB - 14, RH - 8, { fill: 'var(--surface-2)', stroke: done ? 'var(--ok)' : 'var(--border)', sw: done ? 2 : 1, dash: done ? null : '5 4' }));
      g.append(T(CB + 8, y + 19, done ? r.b : 'not migrated yet', { fs: 11.5, fill: done ? 'var(--text)' : 'var(--text-3)' }));
      g.addEventListener('click', () => jump(i));
      stage.append(g);
    });
    const y = Y0 + ROWS.length * RH + 6;
    stage.append(R(CX, y, W - 2 * CX, 46, { fill: 'var(--surface-2)', stroke: S.extra ? 'var(--accent)' : 'var(--border)', sw: S.extra ? 2 : 1, dash: S.extra ? null : '5 4' }));
    stage.append(T(CX + 10, y + 19, 'Boot 4.1 (June 2026)', { fs: 12, fw: 700, fill: S.extra ? 'var(--accent)' : 'var(--text-3)' }));
    if (S.extra) { stage.append(T(CX + 150, y + 19, EXTRA[0] + '  ·  ' + EXTRA[1], { fs: 11.5 })); stage.append(T(CX + 150, y + 37, EXTRA[2] + '  ·  ' + EXTRA[3], { fs: 11.5 })); }
    else stage.append(T(CX + 150, y + 19, 'finish the 4.0 migration first', { fs: 11.5, fill: 'var(--text-3)' }));
    stats.innerHTML = ''; const add = (h) => stats.append(el('span', { class: 'w-stat', html: h }));
    add(`migrated <b>${S.done.size} / ${ROWS.length}</b>`); add(`target <b>${S.extra ? 'Boot 4.1' : S.done.size ? 'Boot 4.0' : 'Boot 3.5'}</b>`);
  }
  const STEPS = ROWS.map((r, i) => ({ run: () => { S.done.add(i); S.hot = i; }, t: r.t }));
  STEPS.push({ run: () => { S.hot = null; S.extra = true; }, t: '<b>Boot 4.1.</b> With 4.0 done, 4.1 is a small step. It adds Spring gRPC auto-configuration, an <code>InetAddressFilter</code> for HTTP clients to block requests to chosen addresses (SSRF), lazy JDBC connections, and more observability. It also removes what 4.0 deprecated.' });
  function start() { S = { done: new Set(), hot: null, extra: false }; }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; start(); render(); bStep.disabled = false;
    say('A Boot 3.5 service. Press Play or Step to migrate it part by part, or click a row.');
  }
  function step() {
    if (k >= STEPS.length) return false; const s = STEPS[k++]; s.run(); render(); say(s.t);
    bStep.disabled = k >= STEPS.length; return true;
  }
  function jump(i) {
    gen++; running = false; bPlay.textContent = '▶ Play'; start();
    for (let j = 0; j < i; j++) S.done.add(j);
    k = i; step();
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= STEPS.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
  if (reduced) { while (step()); say('End state: every part migrated to Boot 4, then Boot 4.1. Press Reset, then Step, to walk through each change.'); }
});

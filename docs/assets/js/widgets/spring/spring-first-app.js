/* spring-first-app: beginner step-through widget (scenarios, boxes and arrows, startup log). */
IA.widget('spring-first-app', (root, ctx) => {
  const C = {
    id: 'spring-first-app', vb: '0 0 760 300', aria: 'Startup of a first Spring Boot app: main method, component scan, embedded Tomcat, first request', logLabel: 'Console',
    nodes: {
      main: [10, 20, 220, 'main()', 'DemoApplication'],
      run: [270, 20, 220, 'SpringApplication', '.run(…)'],
      scan: [530, 20, 220, 'component scan', 'com.example.demo.**'],
      ctl: [530, 120, 220, 'HelloController', '@RestController'],
      other: [530, 225, 220, 'OtherController', 'com.example.api'],
      tomcat: [270, 120, 220, 'embedded Tomcat', 'port 8080'],
      client: [10, 120, 220, 'curl / browser', 'GET /hello'],
      src: [10, 20, 220, 'src/ + pom.xml', 'your project'],
      mvn: [270, 20, 220, './mvnw package', 'compile + test'],
      jar: [530, 20, 220, 'demo-0.0.1.jar', 'executable “fat” jar'],
      jvm: [530, 160, 220, 'java -jar …', 'JVM process'],
      lib: [270, 160, 220, 'BOOT-INF/lib', 'all dependency jars']
    },
    sc: {
      start: { label: 'Start & first request', nodes: ['main', 'run', 'scan', 'ctl', 'tomcat', 'client'],
        intro: 'A project generated on start.spring.io with the <b>Spring Web</b> dependency, plus one controller. Press Play.',
        steps: [
          { n: { main: 'on' }, hot: ['main'], say: 'It is an ordinary Java program. The JVM calls <code>public static void main</code> in the class annotated <code>@SpringBootApplication</code>.' },
          { n: { run: 'work' }, hot: ['run'], e: [['main', 'run', 'ok']], log: '  .   ____          _\n :: Spring Boot ::   (v3.x)', say: '<code>SpringApplication.run(DemoApplication.class, args)</code> prints the banner, reads configuration and creates the ApplicationContext.' },
          { n: { scan: 'work' }, hot: ['scan'], e: [['run', 'scan', 'try']], say: '<code>@SpringBootApplication</code> = <code>@Configuration</code> + <code>@EnableAutoConfiguration</code> + <code>@ComponentScan</code>. The scan starts at the <b>package of this class</b> and includes every sub-package.' },
          { n: { ctl: 'ok' }, lab: { ctl: 'bean created ✓' }, hot: ['ctl'], e: [['scan', 'ctl', 'ok', 'found']], say: '<code>HelloController</code> lives in <code>com.example.demo.web</code>, a sub-package, so it is found and becomes a bean.' },
          { n: { tomcat: 'ok', run: 'ok' }, hot: ['tomcat'], e: [['run', 'tomcat', 'ok']], log: 'Tomcat started on port 8080 (http) with context path \'/\'\nStarted DemoApplication in 1.7 seconds', logc: 'o', say: 'Auto-configuration started an <b>embedded Tomcat</b> inside the same JVM. No server to install, no war to deploy.' },
          { n: { client: 'on' }, hot: ['client', 'ctl'], e: [['client', 'tomcat', 'try', 'GET /hello'], ['tomcat', 'ctl', 'try']], say: 'You run <code>curl localhost:8080/hello</code>. Tomcat hands the request to Spring MVC, which finds the method mapped to <code>/hello</code>.' },
          { e: [['tomcat', 'ctl', 'ok'], ['client', 'tomcat', 'ok', '200 "Hello"']], log: '$ curl localhost:8080/hello\nHello, Spring', logc: 'o', tone: 'ok', say: 'The method’s return value goes back as the response body. Your first Boot app works.' }
        ] },
      miss: { label: 'Controller not found', nodes: ['main', 'run', 'scan', 'other', 'tomcat', 'client'],
        intro: 'Same app, but the controller was put in <code>com.example.api</code>, a <b>sibling</b> of <code>com.example.demo</code>, not a child.',
        steps: [
          { n: { main: 'on', run: 'work' }, e: [['main', 'run', 'ok']], say: 'Startup begins as normal.' },
          { n: { scan: 'work' }, hot: ['scan'], e: [['run', 'scan', 'try']], say: 'The scan covers <code>com.example.demo</code> and below. <code>com.example.api</code> is outside that tree.' },
          { n: { other: 'off' }, lab: { other: 'never scanned' }, hot: ['other'], tone: 'warn', say: 'No error, no warning. The class is simply never seen, so no bean is created.' },
          { n: { tomcat: 'ok', run: 'ok' }, e: [['run', 'tomcat', 'ok']], log: 'Started DemoApplication in 1.6 seconds', logc: 'o', say: 'The app starts happily. Nothing is mapped to <code>/hello</code>.' },
          { n: { client: 'err' }, e: [['client', 'tomcat', 'err', '404']], log: '$ curl -i localhost:8080/hello\nHTTP/1.1 404\n{"status":404,"error":"Not Found","path":"/hello"}', logc: 'e', tone: 'err', say: 'A 404. Fix: move the class under the main class’s package (the usual layout), or widen the scan with <code>@SpringBootApplication(scanBasePackages = "com.example")</code>.' }
        ] },
      pkg: { label: 'Package & run', nodes: ['src', 'mvn', 'jar', 'lib', 'jvm'],
        intro: 'From source code to something you can ship. Press Play.',
        steps: [
          { n: { src: 'on' }, hot: ['src'], say: 'During development you can run the app from the IDE (run <code>main</code>) or with <code>./mvnw spring-boot:run</code> (Gradle: <code>./gradlew bootRun</code>).' },
          { n: { mvn: 'work' }, hot: ['mvn'], e: [['src', 'mvn', 'try']], log: '$ ./mvnw package\n[INFO] Tests run: 1, Failures: 0\n[INFO] BUILD SUCCESS', logc: 'o', say: '<code>./mvnw package</code> compiles, runs the tests, and the Spring Boot Maven plugin repackages the result. Gradle: <code>./gradlew bootJar</code>.' },
          { n: { jar: 'ok', mvn: 'ok' }, hot: ['jar'], e: [['mvn', 'jar', 'ok']], say: 'The output in <code>target/</code> is an <b>executable jar</b>: your classes plus a special launcher.' },
          { n: { lib: 'ok' }, hot: ['lib'], e: [['jar', 'lib', 'ok', 'contains']], say: 'Inside, <code>BOOT-INF/classes</code> holds your code and <code>BOOT-INF/lib</code> holds every dependency jar, Tomcat included. That is why it is called a “fat” or “uber” jar.' },
          { n: { jvm: 'ok' }, hot: ['jvm'], e: [['jar', 'jvm', 'ok']], log: '$ java -jar target/demo-0.0.1-SNAPSHOT.jar\nTomcat started on port 8080 (http)', logc: 'o', tone: 'ok', say: 'One command runs it anywhere with a Java 17+ runtime. The same jar goes into a Docker image or a cloud platform.' }
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

/* Spring Boot basics drill: a timed drill of 30 beginner interview questions across the 6 Basics topics. Misses link back to the topic pages. */
IA.widget('tricky-spring-basics', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  /*Q-START*/
  const Q = [
    // ---------- What Spring is ----------
    { t: 'What Spring is', s: 'spring-what-is-spring', q: 'What is the difference between Spring Framework and Spring Boot?', o: ['They are competitors', 'Boot builds on the Framework: it adds auto-configuration, starters and an embedded server so you need little setup', 'Boot replaces dependency injection', 'Framework is only for web apps'], a: 1, x: 'Spring Framework is the core (IoC container, MVC, transactions). Spring Boot is opinionated setup on top of it.' },
    { t: 'What Spring is', s: 'spring-what-is-spring', q: 'What is <b>auto-configuration</b>, in one sentence?', o: ['Code generation at build time', 'Boot creates beans for you based on what is on the classpath and your properties, and backs off if you define your own', 'Automatic database migrations', 'A UI wizard'], a: 1, x: 'Add the JPA starter and a DataSource appears; define your own DataSource bean and Boot’s is skipped (<code>@ConditionalOnMissingBean</code>).' },
    { t: 'What Spring is', s: 'spring-what-is-spring', q: 'What is a “starter” such as <code>spring-boot-starter-web</code>?', o: ['A main class', 'A dependency that pulls in a tested set of libraries for one feature (here: Spring MVC, Jackson, embedded Tomcat)', 'A CLI command', 'A Spring profile'], a: 1, x: 'Starters are dependency bundles. Versions are managed by Boot’s BOM, so you usually do not write version numbers.' },
    { t: 'What Spring is', s: 'spring-what-is-spring', q: 'What does <b>Inversion of Control</b> mean in Spring?', o: ['You call new for every class', 'The container creates your objects and wires their dependencies; your code receives them instead of building them', 'Controllers call the database directly', 'Spring reverses method order'], a: 1, x: 'Objects managed by the container are <b>beans</b>; giving them their dependencies is dependency injection.' },
    { t: 'What Spring is', s: 'spring-what-is-spring', q: 'Spring Boot 3 requires at least which Java version?', o: ['8', '11', '17', '21'], a: 2, x: 'Boot 3 / Framework 6 need Java 17+ and moved from <code>javax.*</code> to <code>jakarta.*</code> packages.' },
    // ---------- First Boot app ----------
    { t: 'First Boot app', s: 'spring-first-app', q: '<code>@SpringBootApplication</code> combines which three annotations?', o: ['@Controller, @Service, @Repository', '@Configuration, @EnableAutoConfiguration, @ComponentScan', '@Bean, @Value, @Autowired', '@RestController, @RequestMapping, @Component'], a: 1, x: 'It marks a configuration class, turns on auto-configuration and scans the class’s package and sub-packages for components.' },
    { t: 'First Boot app', s: 'spring-first-app', q: 'Your main class is in <code>com.acme.app</code>; a <code>@Service</code> is in <code>com.acme.billing</code>. What happens?', o: ['It is found', 'It is not scanned, so injecting it fails: NoSuchBeanDefinitionException', 'Boot warns and creates it anyway', 'It is found only in tests'], a: 1, x: 'Component scanning starts at the main class’s package. Put the main class in the root package (<code>com.acme</code>).' },
    { t: 'First Boot app', s: 'spring-first-app', q: 'How does a Boot web app usually run in production?', o: ['Deployed as a WAR to an external Tomcat only', 'As an executable “fat” jar with an embedded server: java -jar app.jar', 'Only with mvn spring-boot:run', 'In the IDE'], a: 1, x: 'The Boot plugin packages your code and dependencies into one runnable jar; Tomcat is embedded.' },
    { t: 'First Boot app', s: 'spring-first-app', q: 'On which port does a Boot web app listen by default, and how do you change it?', o: ['80, with --port', '8080, with server.port', '3000, with PORT', '8443, with tomcat.port'], a: 1, x: 'Set <code>server.port=9090</code> in application.properties, or <code>SERVER_PORT=9090</code> as an environment variable.' },
    { t: 'First Boot app', s: 'spring-first-app', q: 'Where do you create a new Boot project with chosen dependencies?', o: ['npm init spring', 'start.spring.io (Spring Initializr), or the IDE wizard that uses it', 'Maven Central', 'spring.io/docs'], a: 1, x: 'Initializr generates the build file (Maven or Gradle), the main class and a test.' },
    // ---------- Layers ----------
    { t: 'Layers', s: 'spring-layers', q: 'Which is the usual flow in a layered Spring app?', o: ['Repository → Controller → Service', 'Controller → Service → Repository', 'Service → Controller → Repository', 'Controller → Repository only'], a: 1, x: 'Controllers handle HTTP, services hold business logic and transactions, repositories talk to the database.' },
    { t: 'Layers', s: 'spring-layers', q: 'Why is constructor injection recommended over <code>@Autowired</code> on fields?', o: ['It is faster', 'Dependencies can be final, are obvious, and the class can be tested with plain new without Spring', 'Field injection does not work', 'It avoids proxies'], a: 1, x: 'With a single constructor, Spring injects it without <code>@Autowired</code>. Missing dependencies fail at startup, not at first use.' },
    { t: 'Layers', s: 'spring-layers', q: 'What do <code>@Service</code> and <code>@Repository</code> have in common?', o: ['Nothing', 'Both are specialisations of @Component, so scanning registers them as beans', 'Both open transactions', 'Both are only for JPA'], a: 1, x: 'The stereotype names document the role. <code>@Repository</code> also enables translation of database exceptions to Spring’s DataAccessException.' },
    { t: 'Layers', s: 'spring-layers', q: 'A class has <code>@Service</code> and is injected into two controllers. How many instances exist by default?', o: ['One per controller', 'One: beans are singletons by default', 'One per request', 'A new one per method call'], a: 1, x: 'The default scope is singleton (one per container), so do not keep per-request state in fields.' },
    { t: 'Layers', s: 'spring-layers', q: 'You write <code>new OrderService(repo)</code> yourself inside a controller. What do you lose?', o: ['Nothing', 'It is not a Spring bean: no injection into it and no proxies such as @Transactional', 'It will not compile', 'Spring replaces it'], a: 1, x: 'Only objects the container creates are managed. Inject the service instead of constructing it.' },
    // ---------- REST basics ----------
    { t: 'REST basics', s: 'spring-rest-basics', q: 'What is the difference between <code>@Controller</code> and <code>@RestController</code>?', o: ['None', '@RestController = @Controller + @ResponseBody: return values are written to the response body (JSON), not resolved as view names', '@RestController only supports GET', '@Controller cannot return JSON at all'], a: 1, x: 'With plain <code>@Controller</code>, returning a String means a template name unless the method has <code>@ResponseBody</code>.' },
    { t: 'REST basics', s: 'spring-rest-basics', q: 'For <code>GET /users/7?active=true</code>, which annotations read 7 and active?', o: ['@RequestBody and @PathVariable', '@PathVariable and @RequestParam', '@RequestParam and @RequestHeader', '@PathVariable for both'], a: 1, x: '<code>@GetMapping("/users/{id}")</code> with <code>@PathVariable Long id</code>, plus <code>@RequestParam boolean active</code> for the query string.' },
    { t: 'REST basics', s: 'spring-rest-basics', q: 'A <code>@PostMapping</code> method takes <code>@RequestBody UserDto dto</code>. Who turns the JSON into the object?', o: ['You, with a parser', 'Jackson, through Spring’s HTTP message converters', 'Hibernate', 'Tomcat'], a: 1, x: 'The web starter includes Jackson. Objects returned from the method are serialised to JSON the same way.' },
    { t: 'REST basics', s: 'spring-rest-basics', q: 'A controller method returns an object normally. What status code is sent?', o: ['201', '200', '204', '202'], a: 1, x: 'The default is 200 OK. For 201 Created, return <code>ResponseEntity.created(uri).body(x)</code> or use <code>@ResponseStatus(HttpStatus.CREATED)</code>.' },
    { t: 'REST basics', s: 'spring-rest-basics', q: 'A client sends <code>GET /users/abc</code> to <code>@PathVariable Long id</code>. What does it get?', o: ['200 with id null', '400 Bad Request: type conversion fails', '404 Not Found', '500'], a: 1, x: 'Spring cannot convert "abc" to Long (MethodArgumentTypeMismatchException), which maps to 400.' },
    // ---------- Configuration ----------
    { t: 'Configuration', s: 'spring-config-basics', q: '<code>server.port=8080</code> is in application.properties and the environment has <code>SERVER_PORT=9000</code>. Which wins?', o: ['8080', '9000: environment variables override the file', 'Startup fails', 'Whichever was read last at random'], a: 1, x: 'Externalised config has an order; environment variables and command-line arguments beat application.properties. Relaxed binding maps SERVER_PORT to server.port.' },
    { t: 'Configuration', s: 'spring-config-basics', q: 'What does <code>@Value("${app.timeout:30}")</code> inject when app.timeout is not set?', o: ['null', '30', 'Startup error', 'The string "${app.timeout:30}"'], a: 1, x: 'The part after the colon is the default. Without a default, a missing property fails startup.' },
    { t: 'Configuration', s: 'spring-config-basics', q: 'Why use <code>@ConfigurationProperties(prefix = "app")</code> instead of many @Value fields?', o: ['It is required for YAML', 'It binds a whole group of settings into one typed object, with validation and IDE hints', 'It is faster at runtime', '@Value is deprecated'], a: 1, x: 'One record or class (<code>AppProperties</code>) holds <code>app.*</code>; it is easy to inject, test and validate with <code>@Validated</code>.' },
    { t: 'Configuration', s: 'spring-config-basics', q: 'You run with <code>spring.profiles.active=dev</code>. Which files are loaded?', o: ['Only application-dev.properties', 'application.properties, then application-dev.properties, whose values override', 'Only application.properties', 'All application-*.properties files'], a: 1, x: 'Profile-specific files are added on top of the default file, so they only need the differences.' },
    { t: 'Configuration', s: 'spring-config-basics', q: 'Where should a database password come from in production?', o: ['Hard-coded in application.properties in git', 'An environment variable or secret store, referenced by the property', 'A Java constant', 'The README'], a: 1, x: 'Keep secrets out of the repository: <code>spring.datasource.password=${DB_PASSWORD}</code>, with the value injected by the platform.' },
    // ---------- Data JPA ----------
    { t: 'Data JPA', s: 'spring-data-jpa-basics', q: 'What is the minimum for a JPA entity?', o: ['@Table only', '@Entity, an @Id field and a no-arg constructor', '@Repository', '@Column on every field'], a: 1, x: 'Hibernate needs to create instances (no-arg constructor, may be protected) and identify rows (<code>@Id</code>, often with <code>@GeneratedValue</code>).' },
    { t: 'Data JPA', s: 'spring-data-jpa-basics', q: '<code>interface UserRepository extends JpaRepository&lt;User, Long&gt; {}</code>. Who writes the implementation?', o: ['You must', 'Spring Data creates one at runtime, with save, findById, findAll, delete and more', 'Hibernate generates Java source', 'Nobody: it fails'], a: 1, x: 'Spring Data generates a proxy implementation. The type parameters are the entity type and its id type.' },
    { t: 'Data JPA', s: 'spring-data-jpa-basics', q: 'What does <code>List&lt;User&gt; findByEmailAndActiveTrue(String email)</code> do?', o: ['Nothing without @Query', 'Spring Data derives the query from the method name: email = ? and active = true', 'Compile error', 'Returns all users'], a: 1, x: '<b>Derived queries</b> parse the method name. A misspelled property fails at startup, which is good.' },
    { t: 'Data JPA', s: 'spring-data-jpa-basics', q: 'What does <code>findById(id)</code> return?', o: ['The entity or null', 'An Optional&lt;User&gt;', 'A List', 'It throws when not found'], a: 1, x: 'Handle the empty case: <code>findById(id).orElseThrow(() -&gt; new NotFound(id))</code>.' },
    { t: 'Data JPA', s: 'spring-data-jpa-basics', q: 'Why is <code>spring.jpa.hibernate.ddl-auto=create-drop</code> dangerous on a real database?', o: ['It is slow', 'It drops the schema (and all data) on shutdown and recreates it on start', 'It disables transactions', 'It only works with H2'], a: 1, x: 'Fine for tests with H2. In production use <code>validate</code> or <code>none</code> and a migration tool such as Flyway or Liquibase.' },
  ];
  /*Q-END*/
  const TOPICS = ['All', ...[...new Set(Q.map((q) => q.t))]];
  const slugOf = {}; Q.forEach((q) => { slugOf[q.t] = q.s; });
  if (!document.getElementById('w-tv-style')) {
    document.head.append(el('style', { id: 'w-tv-style', text: `
.w-tv-bar { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; margin: 8px 0; }
.w-tv-bar div { height: 100%; background: var(--accent); }
.w-tv-bar div.low { background: var(--err); }
.w-tv-opts { display: grid; gap: 6px; margin-top: 10px; }
.w-tv-opts button { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 9px; padding: 9px 12px; font-size: 14px; cursor: pointer; overflow-wrap: anywhere; }
.w-tv-opts button:hover:not(:disabled) { border-color: var(--accent); }
.w-tv-opts button.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 15%, transparent); }
.w-tv-opts button.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 15%, transparent); }
.w-tv-opts button:disabled { cursor: default; }
.w-tv-q { font-size: 16px; margin: 6px 0 8px; }
.w-tv-rev { border-top: 1px solid var(--border); padding: 10px 0; }
.w-tv-rev:first-child { border-top: 0; }
` }));
  }
  let topic = 'All'; let count = 10; let secs = 60; let gen = 0; let deck = []; let i = 0; let score = 0; let misses = []; let left = 0; let answered = false; let started = false; let tick = null;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segT = seg(TOPICS.map((t) => [t, t]), () => topic, (v) => { topic = v; reset(); }, 'Topic');
  const segN = seg([[10, '10 questions'], [20, '20'], [30, 'all 30']], () => count, (v) => { count = v; reset(); }, 'Number of questions');
  const segS = seg([[90, 'Slow · 90 s'], [60, 'Normal · 60 s'], [30, 'Fast · 30 s']], () => secs, (v) => { secs = v; reset(); }, 'Time per question');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Start' }); const bStep = el('button', { class: 'btn', text: 'Skip ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const card = el('div', { class: 'card', style: { padding: '14px', marginTop: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segT), el('div', { class: 'w-controls' }, segN, el('span', { class: 'tiny', text: 'time per question' }), segS),
    el('div', { class: 'w-controls' }, bPlay, bStep, bReset), stats, card, narr);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function shuffle(a) { const r = a.slice(); for (let j = r.length - 1; j > 0; j--) { const m = Math.floor(Math.random() * (j + 1)); [r[j], r[m]] = [r[m], r[j]]; } return r; }
  function renderStats() { stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `question <b>${Math.min(i + 1, deck.length)}</b>/${deck.length}` }), el('span', { class: 'w-stat', html: `score <b>${score}</b>` }), el('span', { class: 'w-stat', html: `missed <b>${misses.length}</b>` }), el('span', { class: 'w-stat', html: `time <b>${started && !answered ? left + ' s' : '–'}</b>` })); }
  function stopTimer() { if (tick) { clearInterval(tick); tick = null; } }
  function show() {
    const q = deck[i]; answered = false; left = secs; card.innerHTML = '';
    const bar = el('div'); const barWrap = el('div', { class: 'w-tv-bar' }, bar);
    const opts = el('div', { class: 'w-tv-opts' });
    card.append(el('div', { class: 'w-controls', style: { marginBottom: '0' } }, el('span', { class: 'pill accent', text: q.t }), el('span', { class: 'tiny', text: `#${i + 1}` })), barWrap, el('div', { class: 'w-tv-q', html: q.q }));
    if (q.code) card.append(ctx.codeBox(q.code, 'java'));
    q.o.forEach((o, j) => { const b = el('button', { html: `<b>${'ABCD'[j]}.</b> ${o}` }); b.addEventListener('click', () => answer(j)); opts.append(b); });
    card.append(opts);
    const paint = () => { bar.style.width = (left / secs) * 100 + '%'; bar.className = left <= 10 ? 'low' : ''; if (!reduced) bar.style.transition = 'width 1s linear'; };
    paint(); renderStats(); say('Pick an answer before the bar runs out. Skip counts as a miss.');
    stopTimer(); const g = gen;
    tick = setInterval(() => { if (g !== gen || answered) { stopTimer(); return; } left--; paint(); renderStats(); if (left <= 0) answer(-1); }, 1000);
    card.opts = opts;
  }
  function answer(j) {
    if (answered || !started) return; answered = true; stopTimer();
    const q = deck[i]; const ok = j === q.a;
    if (ok) score++; else misses.push({ q, j });
    [...card.opts.children].forEach((b, m) => { b.disabled = true; if (m === q.a) b.classList.add('ok'); else if (m === j) b.classList.add('bad'); });
    card.append(el('div', { class: 'pz-exp', html: (j === -1 ? '<b>Time’s up.</b> ' : j === -2 ? '<b>Skipped.</b> ' : ok ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.x }));
    bStep.textContent = i + 1 < deck.length ? 'Next ›' : 'Finish ›'; renderStats();
    say(ok ? 'Correct. Press Next.' : 'Read the explanation, then press Next.');
  }
  function next() {
    if (!started) return;
    if (!answered) { answer(-2); return; }
    i++; bStep.textContent = 'Skip ›';
    if (i >= deck.length) return finish();
    show();
  }
  function finish() {
    started = false; stopTimer(); bStep.disabled = true; bPlay.textContent = '▶ Again'; card.innerHTML = '';
    const by = {}; deck.forEach((q) => { by[q.t] = by[q.t] || [0, 0]; by[q.t][1]++; }); deck.forEach((q) => { if (!misses.some((m) => m.q === q)) by[q.t][0]++; });
    card.append(el('h3', { text: `Score: ${score} / ${deck.length}`, style: { margin: '0 0 8px' } }),
      el('div', { class: 'w-stats' }, Object.entries(by).map(([t, [a, n]]) => el('span', { class: 'w-stat', html: `<a href="${slugOf[t]}.html">${t}</a> <b>${a}/${n}</b>` }))));
    if (misses.length) {
      card.append(el('h4', { text: 'Review your misses', style: { margin: '14px 0 4px' } }));
      misses.forEach(({ q, j }) => { const r = el('div', { class: 'w-tv-rev' }, el('div', { html: `<span class="pill">${q.t}</span> ${q.q}` }));
        if (q.code) r.append(ctx.codeBox(q.code, 'java'));
        r.append(el('div', { class: 'tiny', html: `You: ${j < 0 ? (j === -1 ? 'time ran out' : 'skipped') : q.o[j]} · Correct: <b>${q.o[q.a]}</b>` }), el('div', { class: 'pz-exp', html: q.x + ` <a href="${q.s}.html">Review the topic →</a>` }));
        card.append(r); });
    } else card.append(el('p', { text: 'No misses. Try “all 30” on Fast.' }));
    renderStats(); say(`Done: ${score}/${deck.length}. ` + (misses.length ? 'Your misses are listed above with explanations.' : ''));
  }
  function reset() {
    gen++; stopTimer(); started = false; answered = false; i = 0; score = 0; misses = [];
    const pool = Q.filter((q) => topic === 'All' || q.t === topic); deck = shuffle(pool).slice(0, count);
    bPlay.textContent = '▶ Start'; bStep.textContent = 'Skip ›'; bStep.disabled = true; card.innerHTML = '';
    card.append(el('p', { html: `<b>${deck.length}</b> question${deck.length === 1 ? '' : 's'} (${topic === 'All' ? 'all topics' : topic}), <b>${secs} s</b> each. No running code: predict the result in your head, like in an interview.`, style: { margin: 0 } }));
    renderStats(); say('Choose a topic, how many questions and the time limit, then press Start.');
  }
  bPlay.addEventListener('click', () => { reset(); started = true; bStep.disabled = false; bPlay.textContent = '↻ Restart'; show(); });
  bStep.addEventListener('click', next);
  bReset.addEventListener('click', reset);
  reset();
});

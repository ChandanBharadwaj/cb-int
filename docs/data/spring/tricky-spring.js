IA.register({
  track: 'spring',
  slug: 'tricky-spring',
  title: 'Tricky Spring (timed)',
  tagline: 'Fifty “what happens now?” questions from every topic in the Spring track, against the clock: proxies that don’t intercept, transactions that don’t roll back, beans that don’t exist, offsets that get replayed. Each one is a trap that has caused a real bug. Score yourself per topic and follow the links back for the ones you miss.',
  tldr: {
    problem: 'Senior Spring interviews rarely ask you to recite annotations. They show you ten lines and ask what happens at startup, on the second call, after an exception or when the pod is killed.',
    model: 'Almost every trick is one of five things: <b>the proxy</b> (self-invocation, final/private methods, advice order), <b>the bean set</b> (conditions, profiles, auto-configuration backing off), <b>thread-bound state</b> (transactions, security context, MDC on another thread), <b>defaults</b> (rollback rules, pool sizes, ack modes, exposure) and <b>at-least-once</b> (retries, redelivery, duplicates).',
    hook: '“A <code>@Transactional</code> method throws <code>IOException</code> after an insert. Is the row there?” Yes: by default only unchecked exceptions and errors roll back. If you can say why in one sentence, start the drill.',
    facts: [
      { v: '50', l: 'questions covering all 26 content topics of the track, from IoC to native images' },
      { v: '60 s', l: 'per question by default; Slow (90 s) and Fast (30 s) modes too' },
      { v: 'Boot 3.x', l: 'every answer assumes Spring Boot 3.x / Framework 6.x defaults unless the question says otherwise' }
    ]
  },
  intro: {
    what: 'This page is a <b>drill</b>, not a lesson. You get a short snippet or situation, a timer, and four answers. Answer in your head, as you would in an interview, then read the explanation. At the end you get your score per topic and a review of every miss, with links to the topic pages.',
    analogy: { icon: '⏱️', title: 'Chess puzzles for Spring', text: 'Chess players improve by solving positions quickly, not by reading about openings. Each question is a “position”: a small piece of Spring code where the obvious answer is wrong for a specific reason.' },
    steps: [
      { t: 'Find the proxy', d: 'Is the call crossing a Spring proxy? Self-calls, <code>private</code>/<code>final</code> methods and objects made with <code>new</code> get no transactions, caching, security or async.' },
      { t: 'Ask which beans exist', d: 'Conditions, profiles and <code>@ConditionalOnMissingBean</code> decide the bean set. Your own bean usually makes Boot’s back off.' },
      { t: 'Ask which thread runs it', d: 'Transactions, security context and MDC are ThreadLocals. A different thread means none of them.' },
      { t: 'Recall the default', d: 'Rollback on unchecked only, 10 Hikari connections, 8 async threads, BATCH ack mode, only <code>health</code> exposed.' },
      { t: 'Assume it happens twice', d: 'Retries, redelivery and crashes mean at-least-once. What does your code do with the duplicate?' }
    ],
    terms: [
      ['proxy', 'The generated object in front of your bean that runs transactions, caching, security and async.'],
      ['bean set', 'The beans that actually exist after conditions and profiles have been evaluated.'],
      ['ThreadLocal', 'Per-thread storage used for transactions, the security context and logging MDC.'],
      ['at-least-once', 'A delivery guarantee where duplicates are possible and must be handled.'],
      ['back off', 'An auto-configuration not creating its bean because you defined one.']
    ]
  },
  visual: {
    title: 'The drill',
    caption: 'Pick a module (or All), how many questions, and the time per question, then press Start. Skip counts as a miss. At the end you get a per-topic score and your misses, each with a link to its topic page.'
  },
  gotchas: [
    { trap: 'Answering from Spring Boot 2 memory', why: 'Many defaults changed: <code>WebSecurityConfigurerAdapter</code> is gone, circular references are prohibited (since 2.6), only <code>health</code> is exposed over HTTP (since 2.5), <code>spring.factories</code> no longer registers auto-configurations, graceful shutdown is the default (3.4).', fix: 'Say the version you are answering for (“in Boot 3.x…”), and mention the older behaviour if you know it. Interviewers like seeing that you track changes.' },
    { trap: 'Forgetting that the annotation needs a proxy', why: 'About a third of the tricky questions reduce to “does this call go through the proxy?”. If it doesn’t, the annotation does nothing, silently.', fix: 'Trace the call: which object holds the reference, and is it the proxy or <code>this</code>? See <a href="aop-proxies.html">AOP &amp; proxies</a>.' },
    { trap: 'Guessing instead of reasoning out loud', why: 'An interviewer learns more from “the inner method marks the transaction rollback-only, so the outer commit fails” than from the right letter.', fix: 'State the mechanism first, then the answer. If unsure, say how you would verify it in a minute (a test, a log level, <code>/actuator/conditions</code>).' }
  ],
  interview: [
    { q: 'How do you approach a “what happens here?” Spring question?', a: '<p>Out loud, in this order: which beans exist (conditions, profiles, what backs off), how the call reaches the method (through a proxy or not, which interceptors in which order), which thread runs it (and so which transaction and security context), and what the defaults are for anything not configured. Then answer. Interviewers grade the reasoning more than the final letter.</p>', lvl: 'core' },
    { q: 'You don’t know the answer. What do you say?', a: '<p>Narrow it down: “It depends on whether the call goes through the proxy. Here it is a self-call, so I believe the annotation is ignored. I would confirm with a test asserting <code>TransactionSynchronizationManager.isActualTransactionActive()</code>.” Showing how you would check it quickly is a strong answer for a senior engineer.</p>', lvl: 'core' },
    { q: 'Which three Spring traps cause the most production bugs?', a: '<p>1) Proxy bypass: self-invocation and private methods with <code>@Transactional</code>, <code>@Cacheable</code>, <code>@Async</code>. 2) Transaction boundaries: checked exceptions committing, rollback-only participants, side effects (Kafka, HTTP) inside transactions. 3) Thread-bound context lost on async hand-offs, plus at-least-once messaging without idempotency.</p>', lvl: 'deep' },
    { q: 'How do you check a tricky claim during a real review?', a: '<p>A focused test: <code>@SpringBootTest</code> or a slice with the bean in question, asserting the observable effect (a row exists, a mock was called once, the thread name differs). For configuration, <code>/actuator/conditions</code> and <code>/actuator/beans</code>, or <code>--debug</code> for the condition evaluation report. For security and transactions, raise the log level of <code>org.springframework.security</code> or <code>org.springframework.transaction</code> to TRACE/DEBUG.</p>', lvl: 'core' },
    { q: 'Which defaults would you change in almost every production service?', a: '<ul><li>Timeouts on every HTTP client (<a href="http-clients.html">HTTP clients</a>).</li><li><code>spring.jpa.open-in-view=false</code> (<a href="jpa-n-plus-1.html">JPA fetching</a>).</li><li>Bounded executors instead of the unbounded default queue (<a href="async-scheduling.html">@Async</a>).</li><li>An error handler with back-off and a DLT for Kafka (<a href="kafka-messaging.html">Kafka</a>).</li><li><code>MaxRAMPercentage</code> and a preStop delay for containers (<a href="startup-performance.html">Startup &amp; runtime</a>).</li></ul>', lvl: 'deep' }
  ]
});

IA.register({
  track: 'spring',
  slug: 'webflux-reactive',
  title: 'WebFlux & reactive',
  tagline: 'WebFlux serves thousands of connections with a <b>handful of Netty event-loop threads</b>, as long as nothing on those threads ever blocks. <code>Mono</code> and <code>Flux</code> are lazy recipes; <b>subscription</b> runs them and <b>demand</b> (backpressure) paces them. One JDBC call in the wrong place and the whole server stops.',
  tldr: {
    problem: 'A WebFlux service that is fast in tests and freezes under load (health checks time out too), “nothing happens” bugs because nobody subscribed, and lost MDC/trace IDs because thread-locals don’t follow the pipeline.',
    model: 'An event loop is a single thread that multiplexes many sockets: read some bytes, run a few operators, register a callback, move on. I/O completion schedules the next stage, possibly on another thread. Blocking work belongs on <code>Schedulers.boundedElastic()</code>, or in Spring MVC.',
    hook: '“Is WebFlux faster than MVC?” Not per request. It uses fewer threads for many concurrent, I/O-bound requests. With JDBC/JPA, or with Java 21 virtual threads, MVC is usually the better choice.',
    facts: [
      { v: 'max(cores, 4)', l: 'default Reactor Netty I/O worker (event-loop) threads, named <code>reactor-http-nio-N</code> (or <code>-epoll-N</code> with native transport)' },
      { v: '10 × cores', l: 'default thread cap of <code>Schedulers.boundedElastic()</code>, with up to 100,000 queued tasks per thread' },
      { v: '256', l: 'default <code>flatMap</code> concurrency: up to 256 inner publishers (for example, HTTP calls) subscribed at once' }
    ]
  },
  intro: {
    what: 'In classic Spring MVC each request gets its own thread, and that thread waits while the database or another service answers. <b>WebFlux</b> is reactive: a few threads (the <b>event loop</b>) start work, and instead of waiting they register “call me back when the data arrives” and serve other requests. You write that as a pipeline of operators on <code>Mono</code> (0 or 1 value) and <code>Flux</code> (0 to N values).',
    analogy: { icon: '🍽️', title: 'One waiter, many tables', text: 'An MVC waiter takes an order, walks to the kitchen and <i>stands there</i> until the food is ready: you need one waiter per busy table. A WebFlux waiter takes the order, gives it to the kitchen and serves other tables; the bell (a callback) tells them when a dish is ready. It works brilliantly until one waiter decides to cook a dish themselves (a blocking call): then all of their tables wait.' },
    steps: [
      { t: 'Mono and Flux are recipes', d: 'Building a pipeline does nothing. Work starts when something subscribes: WebFlux does that for the <code>Mono</code> you return from a controller.', code: 'Mono<Order> order = client.get().uri("/orders/{id}", id)\n    .retrieve().bodyToMono(Order.class);   // no HTTP call yet' },
      { t: 'Operators transform values as they arrive', d: '<code>map</code> for synchronous transforms, <code>flatMap</code> to call something that returns another <code>Mono</code>/<code>Flux</code>.' },
      { t: 'Never block an event-loop thread', d: 'No JDBC, no <code>Thread.sleep</code>, no <code>.block()</code> inside a pipeline. Wrap unavoidable blocking calls and move them to <code>boundedElastic</code>.' },
      { t: 'The consumer controls the pace', d: 'Subscribers <code>request(n)</code> items. A slow client means fewer reads from upstream, not an ever-growing buffer. That is backpressure.' }
    ],
    terms: [
      ['Mono / Flux', 'Reactor’s publishers of 0–1 and 0–N values, ending in complete or error.'],
      ['event loop', 'A thread that handles many connections by never waiting; Reactor Netty runs a small fixed set of them.'],
      ['subscribe', 'Starts the pipeline. Without a subscriber nothing executes.'],
      ['backpressure', 'Flow control: the subscriber says how many items it can take (<code>request(n)</code>).'],
      ['Scheduler', 'Where work runs: <code>parallel()</code> for CPU, <code>boundedElastic()</code> for blocking calls.'],
      ['R2DBC', 'A reactive, non-blocking database API. JDBC and JPA are blocking.']
    ]
  },
  visual: {
    title: 'Four event loops, one blocking call',
    caption: 'Pick a mode and press Play. Each lane is a Netty event-loop thread; each tick is 50 ms. Watch what a 200 ms JDBC call does when it runs on the loop, compared with non-blocking I/O and with offloading to <code>boundedElastic</code>. The ♥ request is <code>/actuator/health</code>.'
  },
  extras: [
    { id: 'webflux-reactive-backpressure', title: 'Backpressure: who sets the pace?', label: 'Backpressure', caption: 'A fast producer (10 items per tick) and a slow consumer (2 per tick). Compare pushing without demand, <code>request(n)</code> demand, dropping, and a bounded buffer.' }
  ],
  gotchas: [
    { trap: 'A blocking call on an event-loop thread',
      code: `@GetMapping("/orders/{id}")\nMono<Order> get(@PathVariable long id) {\n  return Mono.just(jdbcTemplate.queryForObject(SQL, mapper, id));   // blocks reactor-http-nio-3\n}`,
      why: 'There are only <code>max(cores, 4)</code> event loops, and each serves many connections. While one waits for Postgres, every connection assigned to it waits too, including health checks.',
      fix: 'Use R2DBC or a reactive client. If you must call blocking code, wrap it: <code>Mono.fromCallable(() -&gt; …).subscribeOn(Schedulers.boundedElastic())</code>. Run BlockHound in tests to catch regressions.' },
    { trap: 'Mono.just(expensiveCall()) runs immediately, once',
      code: `Mono<Rate> m = Mono.just(fxClient.fetchRate());   // called NOW, at assembly\nMono<Rate> lazy = Mono.fromCallable(fxClient::fetchRate);   // called per subscription`,
      why: 'Java evaluates arguments before calling <code>just</code>. The call happens on the assembling thread, even if nothing ever subscribes, and retries replay the same cached value.',
      fix: 'Use <code>Mono.fromCallable</code>, <code>Mono.defer</code> or <code>Mono.fromSupplier</code> for anything with side effects or cost.' },
    { trap: 'Nothing happens: the pipeline is never subscribed',
      code: `public Mono<Void> audit(Event e) { return repo.save(e).then(); }\n\nvoid handle(Event e) {\n  audit(e);          // returned Mono dropped → no INSERT\n}`,
      why: 'Publishers are lazy. A <code>Mono</code> that is created and dropped never runs.',
      fix: 'Return it and compose it into the chain (<code>.then(audit(e))</code>, <code>flatMap</code>). Calling <code>subscribe()</code> by hand is fire-and-forget: errors and backpressure get lost.' },
    { trap: '.block() inside a reactive pipeline',
      why: 'On a Netty thread Reactor refuses: <code>IllegalStateException: block()/blockFirst()/blockLast() are blocking, which is not supported in thread reactor-http-nio-2</code>. On other threads it may “work” and deadlock under load.',
      fix: 'Compose instead of blocking: <code>flatMap</code>, <code>zip</code>, <code>then</code>. Blocking is only for the edges of non-reactive code (main methods, tests, an MVC controller calling <code>WebClient</code>).' },
    { trap: 'flatMap fans out 256 calls at once',
      code: `Flux.fromIterable(ids)                     // 5,000 ids\n    .flatMap(id -> client.get().uri("/price/{id}", id).retrieve().bodyToMono(Price.class))`,
      why: 'Default concurrency is 256 inner subscriptions. A downstream API sized for 20 concurrent calls sees 256, and the client’s connection pool queues or times out.',
      fix: 'Pass a concurrency: <code>.flatMap(this::price, 16)</code>. Use <code>concatMap</code> when order matters, <code>flatMapSequential</code> for concurrency with ordered output.' },
    { trap: 'MDC and trace IDs disappear',
      why: 'Thread-locals belong to a thread, and a reactive request hops between event loops and schedulers. Logging that reads the MDC sees another request’s values or none.',
      fix: 'Use Reactor’s <code>Context</code>. With Micrometer’s context-propagation library, Boot 3.2+ can restore thread-locals automatically: <code>spring.reactor.context-propagation=auto</code>.' },
    { trap: 'Mixing JPA into WebFlux',
      why: 'JPA is blocking and thread-bound: its <code>EntityManager</code> and <code>@Transactional</code> are tied to a thread. Wrapping every repository call in <code>boundedElastic</code> gives you thread-per-request with extra complexity.',
      fix: 'Pick one model per service: WebFlux + R2DBC (<code>R2dbcTransactionManager</code>, transactions held in the Reactor Context), or MVC + JPA (optionally on virtual threads).' }
  ],
  scenarios: [
    { title: 'All endpoints freeze at 30 requests per second; health checks fail and pods restart',
      symptom: 'A new “order history” endpoint was added to a WebFlux gateway. Under modest load every endpoint’s latency jumps to seconds, Kubernetes liveness probes time out and pods get killed in a loop.',
      diagnose: `# thread dump (jcmd <pid> Thread.print) on a 2-vCPU pod: all 4 event loops look like this
"reactor-http-nio-3" #41 daemon RUNNABLE
   at sun.nio.ch.SocketDispatcher.read0(Native Method)
   at org.postgresql.core.VisibleBufferedInputStream.read(...)
   at org.springframework.jdbc.core.JdbcTemplate.query(...)
   at com.acme.history.HistoryHandler.lambda$get$0(HistoryHandler.java:42)`,
      diagnoseLang: 'text',
      cause: 'The handler called <code>JdbcTemplate</code> inside <code>map</code>. With 4 event loops and a 150 ms query, the server can finish about 4 / 0.15 ≈ 27 history requests per second, and while doing so it can’t serve anything else, probes included.',
      fix: 'Short term: offload to <code>boundedElastic</code>. Proper fix: R2DBC, or move this service to Spring MVC. Add BlockHound to the integration tests.',
      fixCode: `Mono<List<Order>> history(long userId) {\n  return Mono.fromCallable(() -> jdbc.query(SQL, mapper, userId))\n             .subscribeOn(Schedulers.boundedElastic());   // event loop stays free\n}\n\n// test setup\nstatic { BlockHound.install(); }   // throws on blocking calls in non-blocking threads` },
    { title: 'Streaming export runs the pod out of memory',
      symptom: 'An endpoint streams 2M rows as NDJSON. Slow clients (mobile, a partner’s 1 Mbps link) cause heap usage to climb until the pod is OOM-killed.',
      diagnose: `Flux<Row> rows = Flux.create(sink -> {          // pushes regardless of demand\n  jdbc.query("SELECT * FROM events", rs -> { sink.next(map(rs)); });\n  sink.complete();\n});`,
      cause: '<code>Flux.create</code> with a blocking JDBC loop ignores demand. The default <code>OverflowStrategy.BUFFER</code> queues every row in memory while the slow socket drains.',
      fix: 'Use a source that honours demand: R2DBC (<code>DatabaseClient</code> streams rows as they are requested), or <code>Flux.generate</code>/<code>Flux.create</code> that checks <code>sink.requestedFromDownstream()</code>. Cap the client side with <code>limitRate</code>.',
      fixCode: `@GetMapping(value = "/export", produces = MediaType.APPLICATION_NDJSON_VALUE)\nFlux<Event> export() {\n  return db.sql("SELECT * FROM events ORDER BY id")\n           .map((row, meta) -> Event.from(row))\n           .all()\n           .limitRate(500);         // request upstream in batches of 500\n}` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Which threads run the two stages?', code: `Mono.fromCallable(() -> Thread.currentThread().getName())\n    .subscribeOn(Schedulers.boundedElastic())\n    .publishOn(Schedulers.parallel())\n    .map(src -> src + " → " + Thread.currentThread().getName())\n    .subscribe(System.out::println);`, options: ['boundedElastic-1 → parallel-1', 'main → parallel-1', 'parallel-1 → boundedElastic-1', 'boundedElastic-1 → boundedElastic-1'], answer: 0, explain: '<code>subscribeOn</code> decides where the subscription, and so the source (<code>fromCallable</code>), runs. <code>publishOn</code> switches the thread for every operator <i>after</i> it.' },
    { kind: 'predict', q: 'Two <code>subscribeOn</code>s. Where does the source run?', code: `Mono.fromCallable(this::load)\n    .subscribeOn(Schedulers.boundedElastic())\n    .map(this::transform)\n    .subscribeOn(Schedulers.parallel())\n    .subscribe();`, options: ['parallel', 'boundedElastic', 'The calling thread', 'Both, alternately'], answer: 1, explain: 'Subscription travels upstream, so the <code>subscribeOn</code> <b>closest to the source</b> determines where the source runs. The later one only affects the short hop before it.' },
    { kind: 'predict', q: 'How many times is <code>fetchRate()</code> (an HTTP call) executed?', code: `Mono<Rate> m = Mono.just(fxClient.fetchRate());\nm.subscribe(); \nm.subscribe();\n\nMono<Rate> n = Mono.fromCallable(fxClient::fetchRate);\nn.subscribe();\nn.subscribe();`, options: ['m: 2, n: 2', 'm: 1, n: 2', 'm: 0, n: 2', 'm: 1, n: 1'], answer: 1, explain: '<code>Mono.just</code> receives an already computed value: the call ran once, when the line executed. <code>fromCallable</code> defers the call to each subscription, so two subscribers make two calls.' },
    { kind: 'predict', q: '2-vCPU pod, default Reactor Netty settings. Each request runs a 200 ms JDBC query inside <code>map</code>. Roughly what is the maximum throughput of the <b>whole</b> server?', options: ['~10 req/s', '~20 req/s', '~200 req/s', 'Unlimited: WebFlux is non-blocking'], answer: 1, explain: 'Event loops = <code>max(2, 4)</code> = 4. Each one is blocked 200 ms per request: 4 × 5 = <b>~20 req/s</b>, for every endpoint on the server, since the loops are shared.' },
    { kind: 'predict', q: 'What happens?', code: `@GetMapping("/user/{id}")\nMono<UserView> view(@PathVariable String id) {\n  User u = userClient.get(id).block();          // WebClient call\n  return Mono.just(UserView.of(u));\n}`, options: ['Works, just slower', 'IllegalStateException: block() is not supported in thread reactor-http-nio-N', 'Deadlock forever', 'Compile error'], answer: 1, explain: 'Reactor marks Netty event-loop threads as non-blocking and fails fast when <code>block()</code> is called on them. Compose with <code>userClient.get(id).map(UserView::of)</code>.' },
    { kind: 'concept', q: 'A subscriber calls <code>request(10)</code> on <code>Flux.range(1, 1_000_000)</code> and never requests more. How many elements are emitted?', options: ['1,000,000', '256 (prefetch)', '10', '0 until complete() is called'], answer: 2, explain: 'Reactive Streams publishers may emit at most what was requested. <code>range</code> honours demand exactly: 10 <code>onNext</code> signals, then it waits.' },
    { kind: 'concept', q: 'Which service is the best fit for WebFlux rather than Spring MVC (Boot 3.3, Java 21)?', options: ['CRUD over Postgres with JPA', 'A batch job reading CSV files', 'An API gateway fanning out to slow services and streaming SSE to 20k clients', 'A service whose team has never used Reactor and depends on a blocking SDK'], answer: 2, explain: 'WebFlux shines with many concurrent, long-lived or slow I/O-bound connections and streaming, where it is reactive end to end. JPA, blocking SDKs and teams new to Reactor fit MVC, which with virtual threads also handles high concurrency of blocking I/O.' }
  ],
  interview: [
    { q: 'Explain Mono, Flux and what “lazy” means.', a: '<p><code>Mono&lt;T&gt;</code> emits 0 or 1 value then completes or errors; <code>Flux&lt;T&gt;</code> emits 0–N. Building one assembles a chain of operator objects; nothing runs until a <code>Subscriber</code> subscribes. Subscription travels <i>up</i> the chain to the source, demand (<code>request(n)</code>) travels up, and data and terminal signals travel <i>down</i>. Each subscription runs the pipeline again (cold publishers), unless you share it with <code>cache()</code> or <code>share()</code>.</p>', lvl: 'core' },
    { q: 'How does the Netty event loop model work in WebFlux?', a: '<p>Reactor Netty starts <code>max(cores, 4)</code> event-loop threads. Each owns a selector and many channels (connections); a connection stays on its loop. The loop reads bytes, decodes the request, and runs your pipeline until it reaches an asynchronous boundary (a WebClient call, an R2DBC query). Completion is a callback that continues the pipeline, often on another loop. Throughput depends on never blocking those threads.</p>', fu: 'Why is the default not 200 threads like Tomcat? (Threads are only needed for CPU work, not for waiting.)', lvl: 'deep' },
    { q: 'subscribeOn vs publishOn?', a: '<p><code>subscribeOn</code> changes the thread on which the subscription happens, so it affects the source and everything until another switch, wherever you place it; the one closest to the source wins. <code>publishOn</code> changes the thread for downstream signals from that point on. Typical use: <code>fromCallable(blocking).subscribeOn(boundedElastic())</code>, and <code>publishOn(parallel())</code> before CPU-heavy work.</p>', lvl: 'core' },
    { q: 'What is backpressure, and does it work over HTTP?', a: '<p>The Reactive Streams protocol lets a subscriber signal demand with <code>request(n)</code>, so a publisher never sends more than it can take. In WebFlux, demand from the response writer reaches your <code>Flux</code>; when a client reads slowly, Reactor Netty writes and reads less, and TCP flow control pushes back to the peer. It only works end to end if every source honours demand: <code>Flux.create</code> pushing from a JDBC loop doesn’t.</p>', fu: 'Strategies when you can’t slow the source? (onBackpressureBuffer with a bound, onBackpressureDrop, onBackpressureLatest, sample.)', lvl: 'deep' },
    { q: 'How do you call a blocking library from WebFlux?', a: '<p>Wrap it: <code>Mono.fromCallable(() -&gt; lib.call()).subscribeOn(Schedulers.boundedElastic())</code>. <code>boundedElastic</code> caps threads at 10 × cores and queues the rest, so it protects the event loops but isn’t infinite. If most of the service is blocking, that is a sign to use MVC.</p>', lvl: 'core' },
    { q: 'When would you choose Spring MVC over WebFlux today?', a: '<ul><li>The data layer is JDBC/JPA, or important SDKs are blocking.</li><li>The team knows imperative code; stack traces and debugging are simpler.</li><li>Java 21 + Boot 3.2+ virtual threads (<code>spring.threads.virtual.enabled</code>) give MVC cheap concurrency for blocking I/O.</li></ul><p>Choose WebFlux for streaming (SSE, WebSocket), gateways and fan-out to many slow services, with a reactive driver all the way down.</p>', lvl: 'core' },
    { q: 'How do transactions work with R2DBC?', a: '<p>A <code>ReactiveTransactionManager</code> (<code>R2dbcTransactionManager</code>) binds the connection to the Reactor <code>Context</code>, not to a thread, so the transaction follows the pipeline across threads. <code>@Transactional</code> on a method returning <code>Mono</code>/<code>Flux</code> works, and so does <code>TransactionalOperator.transactional(flux)</code>. Postgres sees the same <code>BEGIN … COMMIT</code> on one connection.</p>', lvl: 'deep' },
    { q: 'How do you find blocking calls before production does?', a: '<p>BlockHound: a Java agent that instruments known blocking JDK methods and throws when they are called from non-blocking threads (Reactor’s event loops and <code>parallel</code>). Install it in tests. Also look at thread dumps for <code>reactor-http-nio</code> threads in socket reads or <code>park</code>, and at the event-loop pending-task metrics.</p>', lvl: 'deep' },
    { q: 'flatMap vs concatMap vs flatMapSequential?', a: '<p><code>flatMap</code> subscribes to inner publishers eagerly (up to the concurrency, 256 by default) and emits results as they arrive, interleaved. <code>concatMap</code> runs one inner at a time and preserves order. <code>flatMapSequential</code> runs inners concurrently but reorders output to match the input. Always set a concurrency when the inner call hits a remote system.</p>', lvl: 'core' },
    { q: 'How does error handling differ from try/catch?', a: '<p>Errors are terminal signals that travel downstream. Use <code>onErrorResume</code> (fallback publisher), <code>onErrorReturn</code>, <code>onErrorMap</code> (translate), <code>retryWhen(Retry.backoff(…))</code> (resubscribe). After an error, the sequence is over. In WebFlux, unhandled errors go to <code>@ExceptionHandler</code>s and <code>WebExceptionHandler</code>s, much like MVC.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Non-blocking end to end', lang: 'java', code: `@RestController
class OrderController {
  private final DatabaseClient db;          // R2DBC
  private final WebClient pricing;

  @GetMapping("/orders/{id}")
  Mono<OrderView> get(@PathVariable long id) {
    Mono<Order> order = db.sql("SELECT * FROM orders WHERE id = :id").bind("id", id)
        .map((row, meta) -> Order.from(row)).one();
    return order.flatMap(o -> pricing.get().uri("/price/{sku}", o.sku())
            .retrieve().bodyToMono(Price.class)
            .timeout(Duration.ofSeconds(2))
            .map(p -> OrderView.of(o, p)))
        .switchIfEmpty(Mono.error(new OrderNotFoundException(id)));
  }

  @GetMapping(value = "/orders/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  Flux<OrderEvent> stream() {               // SSE: one connection, many events
    return events.asFlux().onBackpressureLatest();
  }
}` },
    { title: 'Offloading a blocking SDK', lang: 'java', code: `@Service
class LegacyTaxService {
  private final TaxSdk sdk;                 // blocking, thread-safe

  Mono<Tax> tax(Order o) {
    return Mono.fromCallable(() -> sdk.calculate(o.toSdk()))   // lazy, per subscription
        .subscribeOn(Schedulers.boundedElastic())              // never on reactor-http-nio
        .timeout(Duration.ofSeconds(3));
  }
}

// Bounded fan-out to a rate-limited API
Flux<Price> prices(List<String> skus) {
  return Flux.fromIterable(skus).flatMap(this::price, 16);   // not the default 256
}` },
    { title: 'Config', lang: 'yaml', code: `spring:
  main:
    web-application-type: reactive    # if both web starters are on the classpath, MVC wins otherwise
  reactor:
    context-propagation: auto         # Boot 3.2+: restore MDC/trace thread-locals across operators
  r2dbc:
    url: r2dbc:postgresql://db:5432/app
    pool:
      max-size: 20                    # R2DBC has its own pool; Hikari isn't used
logging:
  level:
    reactor.netty.http.server: INFO` }
  ]
});

IA.register({
  track: 'spring',
  slug: 'resilience',
  title: 'Resilience patterns',
  tagline: 'When a dependency slows down or fails, your service should fail <b>fast</b> and <b>small</b>, not hang and take its callers down with it. Resilience4j gives you the pieces: a <b>time limiter</b> to bound waiting, a <b>bulkhead</b> to bound concurrency, a <b>circuit breaker</b> to stop calling something that is down, and <b>retry</b> for transient blips. Used carelessly, retry is also how outages spread.',
  tldr: {
    problem: 'A slow downstream fills your thread pool, your service stops answering health checks, and your callers retry, tripling the load on the thing that was already struggling.',
    model: 'Order matters. Timeouts first (every remote call). A bulkhead caps how many threads one dependency can hold. A circuit breaker watches a sliding window of outcomes: at or above the failure (or slow-call) threshold it <b>opens</b> and rejects calls instantly, after a wait it lets a few trial calls through (<b>half-open</b>), and closes again if they succeed. Retry only idempotent calls, with jittered back-off, at one layer.',
    hook: '“Three services each retry three times. How many calls hit the database when it fails?” Up to 3 × 3 × 3 = <b>27</b> per user request. That is a retry storm, and it is why retries belong at one layer, with a budget.',
    facts: [
      { v: '50% / 100 calls', l: 'Resilience4j circuit-breaker defaults: <code>failureRateThreshold</code> 50 and a count-based window of 100 with <code>minimumNumberOfCalls</code> 100' },
      { v: '60 s', l: 'default <code>waitDurationInOpenState</code>, then 10 permitted calls in half-open' },
      { v: 'Retry outermost', l: 'default aspect order in the Spring Boot module: Retry(CircuitBreaker(RateLimiter(TimeLimiter(Bulkhead(call)))))' }
    ]
  },
  intro: {
    what: 'Remote calls fail in two ways: they error, or they get slow. Slow is worse, because every waiting request holds a thread. Resilience patterns put limits around each call: how long to wait, how many calls at once, when to stop trying for a while, and when to try again. In Spring Boot 3 you usually use <b>Resilience4j</b>, through annotations or its functional API.',
    analogy: { icon: '⚡', title: 'The fuse box in your house', text: 'A circuit breaker is the fuse: when a device shorts, the fuse trips so the whole house doesn’t burn. You don’t keep flipping it back on immediately; you wait, try once, and leave it on if it holds. Bulkheads are separate circuits for the kitchen and the bedroom, so a toaster can’t black out the whole house.' },
    steps: [
      { t: 'Set timeouts on every remote call', d: 'Connect and read timeouts on the HTTP client and DB driver. Without them, nothing else helps. See <a href="http-clients.html">HTTP clients</a>.' },
      { t: 'Wrap the call', d: 'Annotate a method on a Spring bean (it works through a proxy, like <code>@Transactional</code>).', code: '@CircuitBreaker(name = "inventory", fallbackMethod = "cached")\npublic Stock stock(String sku) { … }' },
      { t: 'Configure per dependency', d: 'Each name (<code>inventory</code>) gets its own window, thresholds and wait time in <code>application.yml</code>.' },
      { t: 'Decide the fallback', d: 'Cached value, a default, a partial response, or a clear error. A fallback that calls another fragile service just moves the problem.' },
      { t: 'Watch it', d: 'Breaker states and call outcomes are Micrometer metrics, and there is an Actuator health indicator.' }
    ],
    terms: [
      ['circuit breaker', 'Tracks failure and slow-call rates; CLOSED → OPEN → HALF_OPEN → CLOSED.'],
      ['retry', 'Calls again after a failure, with a wait. Only safe for idempotent operations.'],
      ['bulkhead', 'Limits concurrent calls to one dependency (semaphore or a dedicated thread pool).'],
      ['time limiter', 'Bounds how long an async call (<code>CompletableFuture</code>) may take.'],
      ['fallback', 'The method that runs when the call fails or is rejected.'],
      ['retry storm', 'Retries at many layers multiplying load on a failing dependency.']
    ]
  },
  visual: {
    title: 'A circuit breaker on a call timeline',
    caption: 'The breaker uses a small window so you can follow it: 10 calls, <code>minimumNumberOfCalls</code> 5, 50% threshold, 10 s wait, 3 trial calls. Press Play: each step is one call. The top shows the state, the middle the sliding window, the bottom the timeline with rejected calls in grey. Try the <b>slow calls</b> scenario: the breaker opens with zero errors.'
  },
  extras: [
    { id: 'resilience-storm', title: 'Retry storm calculator', label: 'Retry storm', caption: 'Choose how many layers retry and how many attempts each makes, then press Play to see when the calls hit the failing service. Fixed back-off makes synchronized waves; exponential back-off with jitter spreads them out. Retrying only at the edge keeps the multiplier at the attempt count.' }
  ],
  gotchas: [
    { trap: 'No timeouts, so the breaker never sees a failure', why: 'A call that hangs for minutes is neither a success nor a failure yet. The breaker records it only when it completes; meanwhile every request thread is stuck in it.', fix: 'Set client timeouts (connect, read; pool acquisition) first. Configure <code>slowCallDurationThreshold</code> so slow calls count against the breaker even when they eventually succeed.' },
    { trap: 'Retrying when the breaker is open', code: `resilience4j.retry.instances.inventory.max-attempts: 3
# Retry wraps CircuitBreaker: each attempt gets CallNotPermittedException…
# …and Retry retries it (with waits) because it retries every exception by default`, lang: 'yaml', why: 'Retry is the outer aspect by default. Without exception filters it retries <code>CallNotPermittedException</code> too, adding latency for a call that is guaranteed to be rejected.', fix: 'Add <code>CallNotPermittedException</code> (and business exceptions) to <code>ignore-exceptions</code> of the retry, or list only transient exceptions in <code>retry-exceptions</code>.' },
    { trap: 'Fallback method with the wrong signature', code: `@CircuitBreaker(name = "inventory", fallbackMethod = "fallback")
public Stock stock(String sku) { … }
private Stock fallback(Throwable t) { … }   // NoSuchMethodException at call time`, why: 'The fallback must have the same parameters as the original method plus one trailing exception parameter, and a compatible return type. A mismatch is found only when the fallback is needed.', fix: '<code>Stock fallback(String sku, Throwable t)</code>. Narrower exception types are allowed and the closest match wins. Test the fallback by forcing the breaker open (<code>circuitBreaker.transitionToForcedOpenState()</code>).' },
    { trap: 'Annotations that silently do nothing', why: 'Resilience4j annotations are applied by aspects. Without <code>spring-boot-starter-aop</code> on the classpath, or on self-invoked or private methods, nothing intercepts the call. See <a href="aop-proxies.html">AOP &amp; proxies</a>.', fix: 'Add the AOP starter, call the method from another bean, and assert in a test that <code>CircuitBreakerRegistry</code> has the instance and that its metrics change.' },
    { trap: '<code>@TimeLimiter</code> on a synchronous method', why: 'The time limiter only applies to methods returning <code>CompletableFuture</code> (or reactive types). On a blocking method it has nothing to time out, and the annotation doesn’t make the call async.', fix: 'For blocking calls, use the HTTP client’s read timeout. Use <code>@TimeLimiter</code> together with <code>@Bulkhead(type = THREADPOOL)</code> or an async method that returns <code>CompletableFuture</code>.' },
    { trap: 'Retrying non-idempotent operations', code: `@Retry(name = "payments")
public Receipt charge(Card c, Money m) { return gateway.charge(c, m); }  // timed out after the charge happened`, why: 'A timeout doesn’t mean the remote side didn’t act. Retrying a charge can charge twice.', fix: 'Retry only idempotent calls, or make them idempotent with an idempotency key the server deduplicates on. Retry on connection errors (request never sent) rather than read timeouts.' },
    { trap: 'Fixed back-off retries in lockstep', why: 'When a dependency fails, all clients fail at the same moment and retry after exactly the same wait, producing waves of load that can keep it down.', fix: 'Use exponential back-off with jitter (<code>enable-exponential-backoff</code> and <code>enable-randomized-wait</code>, or <code>IntervalFunction.ofExponentialRandomBackoff</code>) and cap total retry time.' }
  ],
  scenarios: [
    { title: 'A slow recommendations API takes down checkout',
      symptom: 'Checkout p99 jumps from 300 ms to 30 s, then the service fails its readiness probes. The only change upstream: the recommendations service is degraded, answering in 20–40 s.',
      diagnose: `# thread dump: all 200 Tomcat threads look like this
"http-nio-8080-exec-187" WAITING
   at java.net.SocketInputStream.read(...)
   at …RecommendationsClient.forCart(RecommendationsClient.java:41)
# client had no read timeout; breaker configured, but only on failures`,
      cause: 'An optional call with no read timeout blocked every request thread. The breaker never opened because calls never completed with an error.',
      fix: 'Read timeout of 500 ms on the client, a slow-call threshold on the breaker, a small bulkhead for this optional dependency, and a fallback that returns no recommendations.',
      fixCode: `resilience4j:
  circuitbreaker:
    instances:
      recommendations:
        sliding-window-size: 50
        minimum-number-of-calls: 20
        failure-rate-threshold: 50
        slow-call-duration-threshold: 400ms
        slow-call-rate-threshold: 50
        wait-duration-in-open-state: 20s
  bulkhead:
    instances:
      recommendations:
        max-concurrent-calls: 20          # at most 20 threads waiting on it
        max-wait-duration: 0`, lang: 'yaml' },
    { title: 'The database “recovers” and falls over again, every minute',
      symptom: 'After a failover, the database comes back, gets hit by a huge burst within a second, and becomes unresponsive again. The cycle repeats for 20 minutes.',
      diagnose: `# request rate at the DB proxy, per second
t+0 s  3 100   t+1 s  0   t+2 s  9 300   t+3 s 0   t+6 s 27 800 …
# three layers (gateway → orders → inventory) each with Retry max-attempts 3, wait 1 s fixed`,
      cause: 'Retries at three layers multiplied each user request by up to 27, and fixed waits synchronized them into waves. Each wave arrived exactly as the database tried to warm up.',
      fix: 'Retry at one layer only (closest to the dependency), with exponential back-off and jitter; other layers fail fast. Put a circuit breaker in front of the database calls so callers stop retrying into an open circuit.',
      fixCode: `resilience4j:
  retry:
    instances:
      inventory-db:
        max-attempts: 3
        wait-duration: 200ms
        enable-exponential-backoff: true
        exponential-backoff-multiplier: 2
        enable-randomized-wait: true
        randomized-wait-factor: 0.5
        ignore-exceptions:
          - io.github.resilience4j.circuitbreaker.CallNotPermittedException`, lang: 'yaml' },
    { title: 'The breaker never opens in staging, and opens on one error in production',
      symptom: 'Load tests in staging never trip the breaker even with the dependency down. In production a single error during a quiet night opens it.',
      diagnose: `# staging: default minimum-number-of-calls 100, load test made 60 calls per window
# production: minimum-number-of-calls: 1 (copied from a blog), sliding-window-size: 10`,
      cause: 'The breaker only evaluates the rate once <code>minimumNumberOfCalls</code> calls are in the window. In staging it never got there; in production one failure out of one call is a 100% failure rate.',
      fix: 'Pick the window from real traffic: enough calls for the rate to mean something, a time-based window for bursty traffic, and test the breaker with the same call volume production sees.',
      fixCode: `resilience4j.circuitbreaker.instances.inventory:
  sliding-window-type: TIME_BASED
  sliding-window-size: 30          # seconds
  minimum-number-of-calls: 20
  failure-rate-threshold: 50
  permitted-number-of-calls-in-half-open-state: 5
  automatic-transition-from-open-to-half-open-enabled: true`, lang: 'yaml' }
  ],
  puzzles: [
    { kind: 'predict', q: 'Count-based window of 10, <code>minimumNumberOfCalls</code> 5, threshold 50%. The first four calls all fail. State after call 4?', options: ['OPEN', 'HALF_OPEN', 'CLOSED', 'FORCED_OPEN'], answer: 2, explain: 'With fewer than <code>minimumNumberOfCalls</code> recorded calls, the failure rate isn’t evaluated. The fifth call is the first one that can open it.' },
    { kind: 'predict', q: 'Window of 10, 4 failures and 4 successes recorded (min calls 5, threshold 50%). The circuit is…', options: ['OPEN: the rate is equal to or greater than the threshold', 'CLOSED: 50% is not above 50%', 'HALF_OPEN', 'Undefined'], answer: 0, explain: 'Resilience4j opens when the failure rate is <b>equal to or greater</b> than the threshold. 4/8 = 50%.' },
    { kind: 'predict', q: 'The breaker is OPEN. What does the caller get, and does the remote service see the call?', options: ['The call is sent, then fails fast', 'A 503 from the remote service', 'A queued call that runs after the wait', 'CallNotPermittedException (or the fallback); the remote service sees nothing'], answer: 3, explain: 'An open breaker rejects in-process with <code>CallNotPermittedException</code>. With a <code>fallbackMethod</code>, the fallback receives that exception. That is the point: no load on the failing service, and no waiting.' },
    { kind: 'concept', q: 'With the Spring Boot Resilience4j aspects at their default order, a method has <code>@Retry</code> (3 attempts) and <code>@CircuitBreaker</code>. What does the breaker record for one call that fails three times?', options: ['1 failure', '3 failures', '0: Retry hides the failures', 'Depends on the fallback'], answer: 1, explain: 'Retry is the outermost aspect, so each attempt passes through the circuit breaker and is recorded. That is usually what you want: the breaker sees the real failure rate and can open mid-retry.' },
    { kind: 'concept', q: 'Which operation is safe to retry automatically on a read timeout?', options: ['POST /payments/charge', 'POST /emails/send', 'GET /products/42', 'PUT /orders/7/status?toggle=true'], answer: 2, explain: 'A GET is idempotent: repeating it doesn’t change state. The others may have taken effect before the timeout. Retry them only with an idempotency key the server honours.' },
    { kind: 'predict', q: 'A gateway, a BFF and an orders service each retry up to 4 attempts. The inventory DB is down. How many DB calls can one user request cause?', options: ['4', '12', '64', '256'], answer: 2, explain: 'Each layer multiplies: 4 × 4 × 4 = 64 calls from the orders service to the DB for one request at the gateway (the DB is one hop below orders). Retry at one layer, fail fast elsewhere.' },
    { kind: 'concept', q: 'What does a semaphore bulkhead with <code>maxConcurrentCalls: 10</code> and <code>maxWaitDuration: 0</code> do with the 11th concurrent call?', options: ['Rejects it at once with BulkheadFullException', 'Queues it until a slot frees', 'Runs it on a new thread', 'Opens the circuit breaker'], answer: 0, explain: 'With zero wait, a call that can’t get a permit is rejected immediately. That keeps a slow dependency from holding more than 10 of your request threads.' }
  ],
  interview: [
    { q: 'Explain the circuit breaker states.', a: '<p><b>CLOSED</b>: calls flow; outcomes go into a sliding window (count- or time-based). When at least <code>minimumNumberOfCalls</code> are recorded and the failure rate or slow-call rate reaches its threshold, it goes <b>OPEN</b>: calls are rejected immediately with <code>CallNotPermittedException</code>. After <code>waitDurationInOpenState</code> it goes <b>HALF_OPEN</b> (on the next call, or automatically if enabled) and permits a fixed number of trial calls. If their failure rate is below the threshold it closes; otherwise it opens again. There are also DISABLED, FORCED_OPEN and METRICS_ONLY states for operations.</p>', lvl: 'core' },
    { q: 'In what order do you apply the patterns, and why?', a: '<p>Resilience4j’s Spring aspects apply Retry(CircuitBreaker(RateLimiter(TimeLimiter(Bulkhead(call))))) by default. The bulkhead is innermost so it only holds a permit while the call runs; the time limiter bounds each attempt; the breaker records each attempt; retry is outermost so it can make another attempt that goes through all of them again, and sees <code>CallNotPermittedException</code> when the breaker opens. You can change the order with the <code>*AspectOrder</code> properties.</p>', lvl: 'deep' },
    { q: 'How do you avoid retry storms?', a: '<ul><li>Retry at one layer, usually closest to the dependency; other layers fail fast.</li><li>Exponential back-off with jitter; cap attempts and total time.</li><li>Don’t retry when the breaker is open, on 4xx, or on non-idempotent calls.</li><li>Honour <code>Retry-After</code> and 429s.</li><li>Use retry budgets or token buckets (retry at most X% of requests) where the library supports it.</li></ul>', lvl: 'core' },
    { q: 'Semaphore bulkhead vs thread-pool bulkhead?', a: '<p>A <b>semaphore</b> bulkhead limits concurrent calls on the caller’s thread: cheap, works with blocking and virtual threads, but the caller still waits for the call. A <b>thread-pool</b> bulkhead runs the call on a dedicated pool with a queue and returns a <code>CompletableFuture</code>, so it combines with a time limiter, at the cost of thread hand-offs and lost ThreadLocal context. With virtual threads, the semaphore bulkhead is the natural choice: threads are cheap, and the downstream’s capacity is the real limit.</p>', lvl: 'deep' },
    { q: 'What makes a good fallback?', a: '<p>Something useful that doesn’t depend on the failed system: the last cached value (marked stale), a default, a degraded response (no recommendations), or a clear error with <code>Retry-After</code>. Bad fallbacks call another remote service without its own protection, hide errors from monitoring, or return fake success for writes.</p>', lvl: 'core' },
    { q: 'Count-based vs time-based sliding window?', a: '<p>Count-based keeps the last N outcomes: predictable, but at low traffic old outcomes linger for a long time. Time-based aggregates the last N seconds in buckets: reflects “now” better for bursty traffic, but the number of calls varies, so set <code>minimumNumberOfCalls</code> sensibly.</p>', lvl: 'deep' },
    { q: 'Why are slow calls a separate threshold?', a: '<p>A dependency that answers in 20 s instead of 200 ms is often more dangerous than one that errors, because it holds threads and connections. <code>slowCallDurationThreshold</code> marks calls above a duration as slow, and <code>slowCallRateThreshold</code> opens the breaker when too many are slow, even if they all succeed.</p>', lvl: 'core' },
    { q: 'How do you observe resilience components in production?', a: '<p>With Actuator and Micrometer: metrics such as <code>resilience4j.circuitbreaker.state</code>, <code>resilience4j.circuitbreaker.calls</code> (by kind: successful, failed, ignored, not_permitted) and <code>resilience4j.retry.calls</code>. The circuit-breaker health indicator can be included in health groups (be careful: don’t put an optional dependency’s breaker in the readiness group, or an open breaker takes your pods out of service). Event consumers can log state transitions.</p>', lvl: 'core' },
    { q: 'Is the circuit breaker per instance or global?', a: '<p>Per JVM: each instance of your service has its own state, based on its own calls. That is usually fine and avoids coordination. Each instance opens independently, so a downstream sees a gradual drop rather than a cliff.</p>', lvl: 'core' },
    { q: 'What do newer Spring versions offer without Resilience4j?', a: '<p>Spring Retry (<code>@Retryable</code>, <code>@EnableRetry</code>) has been around for years. Spring Framework 7 (with Boot 4) adds core retry and concurrency-limit support (<code>@Retryable</code> and <code>@ConcurrencyLimit</code> in <code>spring-context</code>, switched on with <code>@EnableResilientMethods</code>; <code>RetryTemplate</code> in <code>spring-core</code>). Resilience4j remains the usual choice for circuit breakers and bulkheads on Boot 3.x, directly or through Spring Cloud CircuitBreaker.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Annotated client with fallback', lang: 'java', code: `@Service
class InventoryGateway {
  private final RestClient client;
  private final StockCache cache;
  InventoryGateway(RestClient inventoryClient, StockCache cache) { this.client = inventoryClient; this.cache = cache; }

  @CircuitBreaker(name = "inventory", fallbackMethod = "fromCache")
  @Retry(name = "inventory")
  @Bulkhead(name = "inventory")                       // semaphore by default
  public Stock stock(String sku) {
    Stock s = client.get().uri("/stock/{sku}", sku).retrieve().body(Stock.class);
    cache.put(sku, s);
    return s;
  }

  Stock fromCache(String sku, CallNotPermittedException e) {     // breaker open
    return cache.get(sku).map(Stock::stale).orElseThrow(() -> new InventoryUnavailable(sku, e));
  }
  Stock fromCache(String sku, Exception e) {                     // any other failure
    return cache.get(sku).map(Stock::stale).orElseThrow(() -> new InventoryUnavailable(sku, e));
  }
}` , note: 'Needs <code>io.github.resilience4j:resilience4j-spring-boot3</code> and <code>spring-boot-starter-aop</code>.' },
    { title: 'application.yml', lang: 'yaml', code: `resilience4j:
  circuitbreaker:
    configs:
      default:
        sliding-window-type: COUNT_BASED
        sliding-window-size: 50
        minimum-number-of-calls: 20
        failure-rate-threshold: 50
        slow-call-duration-threshold: 1s
        slow-call-rate-threshold: 60
        wait-duration-in-open-state: 30s
        permitted-number-of-calls-in-half-open-state: 5
        register-health-indicator: true
        ignore-exceptions:
          - com.shop.inventory.SkuNotFoundException        # a 404 is not an outage
    instances:
      inventory: { base-config: default }
  retry:
    instances:
      inventory:
        max-attempts: 3                                    # includes the first call
        wait-duration: 200ms
        enable-exponential-backoff: true
        exponential-backoff-multiplier: 2
        enable-randomized-wait: true
        retry-exceptions:
          - org.springframework.web.client.ResourceAccessException   # I/O errors, timeouts
  bulkhead:
    instances:
      inventory: { max-concurrent-calls: 30, max-wait-duration: 10ms }

spring.http.client:                         # Boot 3.4+: timeouts for auto-configured clients
  connect-timeout: 1s
  read-timeout: 2s` },
    { title: 'Functional API (no annotations)', lang: 'java', code: `CircuitBreaker cb = registry.circuitBreaker("inventory");
Retry retry = retryRegistry.retry("inventory");

Supplier<Stock> call = () -> client.get().uri("/stock/{s}", sku).retrieve().body(Stock.class);
Supplier<Stock> guarded = Decorators.ofSupplier(call)
    .withCircuitBreaker(cb)          // inner
    .withRetry(retry)                // outer: same order as the annotations
    .withFallback(List.of(CallNotPermittedException.class, ResourceAccessException.class),
                  e -> cache.get(sku).orElseThrow())
    .decorate();
Stock s = guarded.get();` , note: 'Works on any object, including ones Spring didn’t create, and makes the order explicit.' }
  ]
});

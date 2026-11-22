IA.register({
  track: 'spring',
  slug: 'actuator-observability',
  title: 'Actuator & observability',
  tagline: 'Actuator gives a Boot app a management surface: <b>health</b> (and the liveness/readiness probes built from it), <b>metrics</b> through Micrometer, and <b>traces</b> through Micrometer Tracing and OpenTelemetry. Wire them well and an incident takes minutes to understand; wire them badly and the probes themselves cause the outage, or <code>/actuator/heapdump</code> leaks your secrets.',
  tldr: {
    problem: 'A database blip restarts every pod, a metric tag explodes Prometheus, traces stop at the first HTTP call, and management endpoints are reachable from the internet.',
    model: '<b>Health</b> is a tree of contributors (<code>db</code>, <code>diskSpace</code>, <code>livenessState</code>, …) arranged into <b>groups</b>; Kubernetes probes hit the <code>liveness</code> and <code>readiness</code> groups. <b>Observations</b> (Micrometer) wrap requests, client calls and your own code and feed both a <code>MeterRegistry</code> (timers, counters) and a tracer (spans, propagated through <code>traceparent</code>). Endpoints are <b>enabled</b>, then <b>exposed</b>, then <b>secured</b>.',
    hook: '“What goes in the liveness probe?” Only “is this JVM wedged?”. Never a shared dependency like the database: when it goes down, Kubernetes restarts every pod and turns a blip into an outage.',
    facts: [
      { v: 'health', l: 'the only endpoint exposed over HTTP by default (Boot 2.5+); everything else needs <code>management.endpoints.web.exposure.include</code>' },
      { v: '0.1', l: 'default <code>management.tracing.sampling.probability</code>: 10% of traces are sampled unless you change it' },
      { v: 'Boot 3.0', l: 'Micrometer Observation and Micrometer Tracing replace Spring Cloud Sleuth; tracing bridges exist for OpenTelemetry and Brave' }
    ]
  },
  intro: {
    what: 'Once an app runs in production you need to ask it questions: are you alive, are you ready for traffic, how fast are requests, what is slow, where did this request go? <b>Spring Boot Actuator</b> adds endpoints such as <code>/actuator/health</code> and <code>/actuator/prometheus</code>, and Boot’s <b>observability</b> support records timings (metrics) and follows each request across services (traces), so logs, metrics and traces can be linked by one trace id.',
    analogy: { icon: '🩺', title: 'A patient monitor in a hospital', text: 'Health checks are the nurse asking “are you awake?” (liveness) and “can you take visitors?” (readiness). Metrics are the heart-rate monitor: numbers over time. A trace is the chart that follows one patient from reception to radiology to the ward. You wouldn’t declare a patient dead because the hospital lift is broken, and you shouldn’t restart a pod because the database is.' },
    steps: [
      { t: 'Add the starter', d: '<code>spring-boot-starter-actuator</code>. <code>/actuator/health</code> works immediately.', code: 'curl localhost:8080/actuator/health\n{"status":"UP"}', lang: 'bash' },
      { t: 'Expose only what you need', d: 'Pick endpoints explicitly, ideally on a separate management port.', code: 'management:\n  server:\n    port: 8081\n  endpoints:\n    web:\n      exposure:\n        include: health,info,prometheus', lang: 'yaml' },
      { t: 'Point Kubernetes at the probe groups', d: '<code>/actuator/health/liveness</code> and <code>/actuator/health/readiness</code>. Boot enables them automatically on Kubernetes.' },
      { t: 'Scrape metrics and export traces', d: 'Add <code>micrometer-registry-prometheus</code> for metrics, and a tracing bridge plus exporter (e.g. OpenTelemetry + OTLP) for traces.' }
    ],
    terms: [
      ['health indicator', 'A component reporting UP/DOWN for one thing (database, disk, a downstream service).'],
      ['health group', 'A named subset of indicators with its own endpoint, e.g. <code>readiness</code>.'],
      ['Micrometer', 'The metrics facade used by Boot: timers, counters, gauges, distribution summaries, with tags.'],
      ['observation', 'Micrometer’s unit of instrumentation: one wrapped operation that can produce metrics and spans.'],
      ['span / trace', 'A span is one timed operation; a trace is the tree of spans for one request across services.'],
      ['cardinality', 'The number of distinct tag-value combinations of a metric. High cardinality costs memory and money.']
    ]
  },
  visual: {
    title: 'Probes through an outage and a deploy',
    caption: 'Three pods share one database. Pick where the <code>db</code> health indicator lives (nowhere in the probes, readiness, or liveness), then press Play: startup, a database outage, recovery and a rolling deploy. Watch the Service’s endpoint count and the restart counters.'
  },
  extras: [
    { id: 'actuator-observability-trace', title: 'One request, two services, one trace', label: 'Tracing', caption: 'Step through a trace being built: server span, database span, client span with the <code>traceparent</code> header, the downstream service, and the metric the same observation records. Then switch to a hand-made client and watch the trace break in two.' }
  ],
  gotchas: [
    { trap: 'Shared dependencies in the liveness group', code: `management.endpoint.health.group.liveness.include: livenessState,db   # restarts every pod on a DB blip`, why: 'A failing liveness probe makes the kubelet restart the container. If the check is a dependency all pods share, every pod fails together, restarts together, and comes back cold into <code>CrashLoopBackOff</code>.', fix: 'Liveness = <code>livenessState</code> (plus checks for truly local, unrecoverable states). Put dependencies in readiness only when removing <i>this</i> pod helps; for a shared database, often leave them out of both and let requests fail fast.' },
    { trap: 'exposure.include: "*" on the application port', why: '<code>heapdump</code> contains every secret in memory, <code>env</code> and <code>configprops</code> describe your infrastructure, <code>loggers</code> can be changed with a POST, and <code>threaddump</code> reveals internals. On the main port behind a public ingress, that’s a data leak.', fix: 'List endpoints explicitly, serve them on <code>management.server.port</code> that isn’t routed publicly, protect them with Spring Security (<code>EndpointRequest.toAnyEndpoint()</code>), and keep <code>show-values</code> masked.' },
    { trap: 'High-cardinality tags', code: `registry.counter("orders.placed", "userId", user.id()).increment();   // one time series per user`, why: 'Each distinct tag combination is a separate time series in the app’s memory and in Prometheus. User ids, order ids, raw URIs or exception messages as tags grow without bound.', fix: 'Tag with bounded values (status, outcome, region, URI template). Put per-entity detail in traces and logs. Use a <code>MeterFilter</code> to deny or cap a tag.' },
    { trap: 'Clients built by hand are invisible', code: `RestClient client = RestClient.create("http://inventory");   // no metrics, no traceparent`, why: 'Instrumentation is applied by Boot’s auto-configured <code>RestClient.Builder</code>, <code>RestTemplateBuilder</code> and <code>WebClient.Builder</code>. A client created directly has no observation registered, so there are no client metrics and no trace propagation.', fix: 'Inject the builder: <code>RestClient.Builder builder</code> → <code>builder.baseUrl(…).build()</code>.' },
    { trap: 'Trace context lost across threads', why: 'The current observation and span live in ThreadLocals. Work handed to a plain executor, <code>CompletableFuture.supplyAsync</code> or a raw thread starts with no context: new traces and logs without trace ids.', fix: 'Use Boot-managed executors where possible, and decorate others with Spring 6.1’s <code>ContextPropagatingTaskDecorator</code> (Micrometer context-propagation). For Reactor, enable automatic context propagation (<code>spring.reactor.context-propagation=auto</code>, Boot 3.2+).' },
    { trap: 'Expensive health checks on every probe', why: 'Kubernetes probes every few seconds per pod with a 1 s timeout by default. A health indicator that runs a slow query or calls a remote service makes probes time out under load, which looks like a dead pod.', fix: 'Keep probe groups cheap. Cache expensive checks, give indicators timeouts, and raise probe <code>timeoutSeconds</code> to match what you actually check.' }
  ],
  scenarios: [
    { title: 'A 40-second database failover becomes a 12-minute outage',
      symptom: 'During a planned primary failover, every pod of the order service restarted, then sat in <code>CrashLoopBackOff</code> long after the database was back.',
      diagnose: `kubectl get pods            # RESTARTS 4-6, STATUS CrashLoopBackOff
kubectl describe pod order-7f…  # Liveness probe failed: HTTP probe failed with statuscode: 503

# application.yml
management.endpoint.health.group.liveness.include: livenessState,db`,
      cause: 'The <code>db</code> indicator was added to the liveness group “so broken pods get restarted”. A shared-dependency failure failed every liveness probe at once.',
      fix: 'Take dependencies out of liveness. Decide deliberately about readiness. Add a startup probe so slow starts aren’t mistaken for hangs, and make connection pools fail fast instead of hanging.',
      fixCode: `management:
  endpoint:
    health:
      probes:
        enabled: true
      group:
        liveness:
          include: livenessState
        readiness:
          include: readinessState      # add only dependencies whose loss this pod alone can route around
---
# deployment.yaml
startupProbe:
  httpGet: { path: /actuator/health/liveness, port: 8081 }
  failureThreshold: 30
  periodSeconds: 2
livenessProbe:
  httpGet: { path: /actuator/health/liveness, port: 8081 }
readinessProbe:
  httpGet: { path: /actuator/health/readiness, port: 8081 }`, lang: 'yaml' },
    { title: 'Prometheus runs out of memory after a “helpful” metric',
      symptom: 'Prometheus memory doubles within a day, scrapes of the checkout service take seconds, and its <code>/actuator/prometheus</code> response is 80 MB.',
      diagnose: `# top series by metric name in Prometheus
topk(5, count by (__name__) ({job="checkout"}))
# → checkout_cart_value_count with ~400k series

registry.summary("checkout.cart.value", "customerId", c.id()).record(total);`,
      cause: 'A distribution summary tagged with <code>customerId</code>: one set of time series per customer, held in the app and stored by Prometheus.',
      fix: 'Drop the tag and record per-customer detail in traces or logs. Add a guard filter so this can’t ship again.',
      fixCode: `@Bean
MeterFilter denyCustomerTags() {
  return MeterFilter.denyNameStartsWith("checkout.debug");
}
@Bean
MeterFilter capUriTags() {
  return MeterFilter.maximumAllowableTags("http.server.requests", "uri", 200, MeterFilter.deny());
}
// and record without the unbounded tag:
registry.summary("checkout.cart.value", "channel", channel).record(total);` },
    { title: 'Secrets found in a heap dump downloaded from production',
      symptom: 'A penetration test downloads a heap dump from <code>https://shop.example.com/actuator/heapdump</code> and extracts the database password and an OAuth client secret from it.',
      diagnose: `curl -sI https://shop.example.com/actuator/heapdump   # 200, Content-Type: application/octet-stream
# application.yml
management.endpoints.web.exposure.include: "*"`,
      cause: 'All endpoints were exposed on the application port during debugging and never reverted. The ingress routed <code>/actuator/**</code> like any other path.',
      fix: 'Rotate every secret in that process. Move management to its own port that the ingress doesn’t route, expose a minimal list, and require authentication for anything beyond health.',
      fixCode: `management:
  server:
    port: 8081
  endpoints:
    web:
      exposure:
        include: health,info,prometheus
  endpoint:
    health:
      show-details: when-authorized
      roles: OPS
---
@Bean @Order(1)
SecurityFilterChain management(HttpSecurity http) throws Exception {
  return http.securityMatcher(EndpointRequest.toAnyEndpoint())
      .authorizeHttpRequests(a -> a
          .requestMatchers(EndpointRequest.to(HealthEndpoint.class, PrometheusScrapeEndpoint.class)).permitAll()
          .anyRequest().hasRole("OPS"))
      .httpBasic(Customizer.withDefaults())
      .build();
}`, lang: 'java' }
  ],
  puzzles: [
    { kind: 'concept', q: 'Fresh Boot 3.x app with the actuator starter and no management properties. Which endpoints are reachable over HTTP?', options: ['All of them', 'health and info', 'health only', 'None until you enable them'], answer: 2, explain: 'Most endpoints are enabled but only <code>health</code> is <b>exposed</b> over the web by default (since 2.5, when <code>info</code> was removed from the default). Exposure is controlled by <code>management.endpoints.web.exposure.include</code>.' },
    { kind: 'predict', q: 'Probes enabled with default groups. The database goes down. What do the probes return?', options: ['liveness DOWN, readiness DOWN', 'liveness UP, readiness DOWN', 'liveness UP, readiness UP', 'Both time out'], answer: 2, explain: 'By default the liveness group contains only <code>livenessState</code> and the readiness group only <code>readinessState</code>. The <code>db</code> indicator affects <code>/actuator/health</code>, but not the probe groups, unless you include it.' },
    { kind: 'predict', q: 'What HTTP status does <code>/actuator/health</code> return when the aggregate status is <code>OUT_OF_SERVICE</code>?', options: ['200', '500', '503', '204'], answer: 2, explain: 'The default mapping returns 503 for <code>DOWN</code> and <code>OUT_OF_SERVICE</code>, and 200 for <code>UP</code> and <code>UNKNOWN</code>. Customise with <code>management.endpoint.health.status.http-mapping.*</code>.' },
    { kind: 'concept', q: 'A request to <code>/orders/42</code> is timed by <code>http.server.requests</code>. What is the <code>uri</code> tag?', options: ['/orders/42', '/orders/{id}', '/orders', 'UNKNOWN'], answer: 1, explain: 'The tag uses the matched <b>URI template</b>, which keeps cardinality bounded. Requests that match no handler are tagged with special values such as <code>NOT_FOUND</code> instead of their raw path.' },
    { kind: 'predict', q: 'Tracing is set up (OTel bridge + OTLP exporter), nothing else configured. You send 100 requests in dev. About how many traces reach the backend?', options: ['100', 'About 10', '0: sampling is off by default', '1'], answer: 1, explain: '<code>management.tracing.sampling.probability</code> defaults to 0.1. Set it to 1.0 in development; in production pick a rate (or tail sampling in a collector) that fits your volume.' },
    { kind: 'predict', q: 'Does the downstream service join the same trace?', code: `@Service
class InventoryClient {
  private final RestClient http = RestClient.create("http://inventory");
  Stock get(String sku) { return http.get().uri("/stock/{s}", sku).retrieve().body(Stock.class); }
}`, options: ['Yes, Boot instruments every RestClient', 'No: a client not built from the auto-configured builder has no observation, so no traceparent header is sent', 'Only if the downstream service uses Boot too', 'Only for WebClient'], answer: 1, explain: 'Boot registers the observation on the <code>RestClient.Builder</code> it auto-configures. <code>RestClient.create()</code> bypasses it. Inject the builder.' },
    { kind: 'concept', q: 'Which health details does <code>/actuator/health</code> show by default in Boot 3.x?', options: ['Full details of every indicator', 'Only the overall status', 'Details for authenticated users', 'Components but not details'], answer: 1, explain: '<code>management.endpoint.health.show-details</code> (and <code>show-components</code>) default to <code>never</code>, so anonymous callers see only <code>{"status":"UP"}</code>. Use <code>when-authorized</code> with roles for operators.' }
  ],
  interview: [
    { q: 'Liveness vs readiness vs startup probes: what should each check in a Spring Boot app?', a: '<ul><li><b>Startup</b>: has the app finished starting? Holds off the other probes, so a slow start isn’t killed. Point it at the liveness endpoint with a generous <code>failureThreshold</code>.</li><li><b>Liveness</b>: is the process healthy or irrecoverably broken (deadlock, corrupted state)? Boot’s <code>livenessState</code>, which you can set to <code>BROKEN</code> yourself. Never shared dependencies.</li><li><b>Readiness</b>: should this pod get traffic right now? <code>readinessState</code> (refusing during startup and shutdown), plus dependencies only if losing them is local to this pod.</li></ul>', lvl: 'core' },
    { q: 'How do Boot’s availability states work?', a: '<p><code>ApplicationAvailability</code> tracks <code>LivenessState</code> (<code>CORRECT</code>/<code>BROKEN</code>) and <code>ReadinessState</code> (<code>ACCEPTING_TRAFFIC</code>/<code>REFUSING_TRAFFIC</code>). Boot publishes <code>AvailabilityChangeEvent</code>s: liveness becomes correct once the context is refreshed, readiness accepts traffic after <code>ApplicationReadyEvent</code>, and readiness refuses traffic again at the start of shutdown. Your code can publish these events too, e.g. to mark the app broken or to take it out of rotation during a cache rebuild.</p>', lvl: 'deep' },
    { q: 'Write a custom health indicator. What should you watch out for?', a: '<p>Implement <code>HealthIndicator</code> (or extend <code>AbstractHealthIndicator</code>) as a bean named <code>fooHealthIndicator</code>, which shows up as <code>foo</code>. Return <code>Health.up().withDetail(…)</code> or <code>down(ex)</code>. Keep it fast and bounded by a timeout, avoid leaking secrets in details, and decide which group it belongs to. Expensive checks can be cached or made reactive.</p>', lvl: 'core' },
    { q: 'Timer, counter, gauge, distribution summary: when do you use each?', a: '<ul><li><b>Counter</b>: something that only goes up (orders placed, errors).</li><li><b>Timer</b>: latency and count of an operation; can publish histogram buckets for percentiles.</li><li><b>Gauge</b>: a current value sampled on read (queue size, pool active connections). Hold a strong reference to the observed object.</li><li><b>DistributionSummary</b>: distribution of non-time values (payload size, cart value).</li></ul><p>Prefer histograms (<code>percentiles-histogram</code>) over client-side percentiles, because they can be aggregated across instances.</p>', lvl: 'core' },
    { q: 'What is the Micrometer Observation API and why did Boot 3 adopt it?', a: '<p>An <code>Observation</code> wraps an operation once (start, stop, error, key-values), and registered handlers turn it into whatever you need: a timer metric, a span, a log line. Spring MVC/WebFlux, RestClient, WebClient, Spring Data, Kafka and others are instrumented this way, so metrics and traces stay consistent. Your own code can use <code>Observation.createNotStarted(name, registry).observe(() -&gt; …)</code> or <code>@Observed</code> (with an <code>ObservedAspect</code> bean).</p>', lvl: 'deep' },
    { q: 'How do you set up distributed tracing in Boot 3?', a: '<ol><li>Add <code>spring-boot-starter-actuator</code>, a bridge (<code>micrometer-tracing-bridge-otel</code> or <code>-brave</code>) and an exporter (<code>opentelemetry-exporter-otlp</code> or Zipkin).</li><li>Set <code>management.otlp.tracing.endpoint</code> (or the Zipkin endpoint) and <code>management.tracing.sampling.probability</code>.</li><li>Build HTTP clients from the auto-configured builders so <code>traceparent</code> is propagated (W3C is the default format).</li><li>Logs get trace and span ids automatically in Boot 3.2+.</li><li>Propagate context across thread hops.</li></ol>', lvl: 'core' },
    { q: 'How do you secure Actuator endpoints?', a: '<ul><li>Expose a minimal list; health and prometheus are often enough.</li><li>Serve them on <code>management.server.port</code>, reachable only inside the cluster.</li><li>With Spring Security, add a <code>SecurityFilterChain</code> matched by <code>EndpointRequest.toAnyEndpoint()</code>: permit health and scrape endpoints, require a role for the rest.</li><li>Keep <code>show-details</code> and <code>show-values</code> at <code>never</code> or <code>when-authorized</code>.</li><li>Treat <code>heapdump</code>, <code>env</code>, <code>loggers</code> and <code>shutdown</code> as admin operations.</li></ul>', lvl: 'core' },
    { q: 'Why is metric cardinality a production concern?', a: '<p>Every unique combination of tag values is a separate time series, kept in the app’s registry and stored and indexed by the backend. Unbounded tags (user ids, raw paths, exception messages) grow memory and cost without limit and slow queries. Keep tag values bounded, use URI templates, cap tags with a <code>MeterFilter</code>, and put high-cardinality detail in traces and logs, which are sampled and indexed differently.</p>', lvl: 'core' },
    { q: 'How do logs, metrics and traces connect during an incident?', a: '<p>A dashboard shows a latency spike on a timer (metric). Exemplars, or the time window, lead to slow traces. A trace shows which span is slow and gives a trace id. Searching logs by that trace id, which Boot 3.2+ puts in every line, shows the error. That chain only works if the same observation produces all three and context survives thread and service hops.</p>', lvl: 'deep' },
    { q: 'How does graceful shutdown interact with readiness?', a: '<p>On <code>SIGTERM</code>, Boot marks readiness <code>REFUSING_TRAFFIC</code>. With <code>server.shutdown=graceful</code> (the default since Boot 3.4) the web server stops accepting new requests and waits for in-flight ones, up to <code>spring.lifecycle.timeout-per-shutdown-phase</code> (default 30 s). Because endpoint removal in Kubernetes is asynchronous, teams often add a short <code>preStop</code> sleep so the load balancer stops sending traffic first.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Production-ready management config', lang: 'yaml', code: `management:
  server:
    port: 8081                         # not routed by the public ingress
  endpoints:
    web:
      exposure:
        include: health,info,prometheus
  endpoint:
    health:
      probes:
        enabled: true                  # auto-enabled on Kubernetes anyway
      show-details: when-authorized
      roles: OPS
      group:
        readiness:
          include: readinessState
  metrics:
    distribution:
      percentiles-histogram:
        http.server.requests: true     # histogram buckets for p95/p99 in Prometheus
    tags:
      application: \${spring.application.name}
  tracing:
    sampling:
      probability: 0.1
  otlp:
    tracing:
      endpoint: http://otel-collector:4318/v1/traces` },
    { title: 'Custom metrics, observations and health', lang: 'java', code: `@Service
class CheckoutService {
  private final Counter placed;
  private final ObservationRegistry observations;

  CheckoutService(MeterRegistry meters, ObservationRegistry observations) {
    this.placed = Counter.builder("orders.placed").tag("channel", "web").register(meters);
    this.observations = observations;
  }

  Receipt checkout(Cart cart) {
    return Observation.createNotStarted("checkout", observations)
        .lowCardinalityKeyValue("payment", cart.paymentType())   // becomes a metric tag and a span tag
        .highCardinalityKeyValue("cart.id", cart.id())          // span only, never a metric tag
        .observe(() -> { Receipt r = doCheckout(cart); placed.increment(); return r; });
  }
}

@Component
class PaymentGatewayHealthIndicator extends AbstractHealthIndicator {   // shows up as "paymentGateway"
  private final PaymentClient client;
  PaymentGatewayHealthIndicator(PaymentClient client) { this.client = client; }
  @Override protected void doHealthCheck(Health.Builder b) {
    b.status(client.ping(Duration.ofMillis(300)) ? Status.UP : Status.DOWN);
  }
}` },
    { title: 'Tracing dependencies (Maven)', lang: 'text', code: `<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
<dependency>
  <groupId>io.micrometer</groupId>
  <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
<dependency>
  <groupId>io.micrometer</groupId>
  <artifactId>micrometer-tracing-bridge-otel</artifactId>
</dependency>
<dependency>
  <groupId>io.opentelemetry</groupId>
  <artifactId>opentelemetry-exporter-otlp</artifactId>
</dependency>
<!-- versions come from the Boot BOM -->` },
    { title: 'Keep trace context across threads', lang: 'java', code: `@Bean
ThreadPoolTaskExecutor reportExecutor() {
  var ex = new ThreadPoolTaskExecutor();
  ex.setCorePoolSize(4);
  ex.setTaskDecorator(new ContextPropagatingTaskDecorator());   // Spring 6.1+: copies trace/MDC context
  return ex;
}

@Bean
RestClient inventoryClient(RestClient.Builder builder) {          // instrumented builder
  return builder.baseUrl("http://inventory").build();
}`, note: 'For Reactor pipelines, set <code>spring.reactor.context-propagation=auto</code> (Boot 3.2+).' }
  ]
});

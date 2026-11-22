IA.register({
  track: 'spring',
  slug: 'http-clients',
  title: 'HTTP clients',
  tagline: 'Every outbound call borrows a <b>pooled connection</b> and a <b>thread</b>, and holds both until the other side answers or a <b>timeout</b> fires. Pick <code>RestClient</code> (blocking) or <code>WebClient</code> (reactive), declare APIs as <b>HTTP interfaces</b>, and size the pool and timeouts for the day the downstream gets slow.',
  tldr: {
    problem: 'A slow partner API takes down your service: no response timeout, a pool of 5 connections per host, and 200 Tomcat threads queued behind it. Or metrics explode because every URL became its own tag.',
    model: 'Request → acquire a connection from the pool (wait if none: <b>acquire timeout</b>) → connect if new (<b>connect timeout</b>) → send → wait for bytes (<b>response/read timeout</b>) → return the connection. Total latency budget = the sum, times retries.',
    hook: '“What timeouts does your HTTP client have?” If the answer is “the defaults”, they are minutes long or infinite, depending on the library.',
    facts: [
      { v: '6.1', l: 'Spring Framework version (Boot 3.2) that added <code>RestClient</code>, a fluent synchronous client on <code>RestTemplate</code>’s infrastructure' },
      { v: '25 / 5', l: 'Apache HttpClient 5 pool defaults: 25 connections in total, <b>5 per route</b> (host)' },
      { v: '45 s', l: 'Reactor Netty’s default pending-acquire timeout for <code>WebClient</code>’s pool; its default max connections is <code>max(cores, 8) × 2</code>' }
    ]
  },
  intro: {
    what: 'Your service often calls other services over HTTP: a payment API, a pricing service. Spring gives you clients that build the request, send it, and convert the JSON response into Java objects. Under the hood, a client keeps a <b>pool of open connections</b> so it doesn’t reconnect each time, and it needs <b>timeouts</b> so a slow server can’t make your code wait forever.',
    analogy: { icon: '🚕', title: 'A taxi rank', text: 'The pool is a taxi rank with a fixed number of cabs per destination. A trip borrows a cab and returns it. If the destination’s roads jam, every cab is stuck there, and new passengers queue at the rank. Timeouts are the rules: “wait at most 1 minute for a cab”, “give up if the drive takes over 5 minutes”.' },
    steps: [
      { t: 'Pick the client', d: '<code>RestClient</code> for normal blocking code (Spring MVC), <code>WebClient</code> for reactive code. <code>RestTemplate</code> still works but is in maintenance mode.', code: 'Order o = restClient.get().uri("/orders/{id}", id)\n    .retrieve().body(Order.class);' },
      { t: 'Use Boot’s builder', d: 'Inject <code>RestClient.Builder</code>: it already has Jackson, metrics and tracing configured.' },
      { t: 'Set timeouts', d: 'A connect timeout (can we reach it?), a read/response timeout (is it answering?), and a pool-acquire timeout (are we waiting for our own pool?).' },
      { t: 'Describe the API as an interface', d: 'An HTTP interface is a Java interface with <code>@GetExchange</code> methods; Spring generates the client.', code: '@HttpExchange("/orders")\ninterface OrderApi {\n  @GetExchange("/{id}") Order get(@PathVariable long id);\n}' }
    ],
    terms: [
      ['RestClient', 'Synchronous fluent client (Framework 6.1+). Blocks the calling thread until the response arrives.'],
      ['WebClient', 'Non-blocking client returning <code>Mono</code>/<code>Flux</code>; part of WebFlux, usable from MVC too.'],
      ['connection pool', 'Reusable keep-alive TCP/TLS connections, limited per host and in total.'],
      ['route', 'A pool partition, usually scheme + host + port. Limits often apply per route.'],
      ['HTTP interface', 'A Java interface annotated with <code>@HttpExchange</code>, backed by a generated proxy.']
    ]
  },
  visual: {
    title: 'The day the payment API got slow',
    caption: 'Press Play. Each tick is 100 ms and 4 requests arrive per tick. At 0.6 s the downstream’s latency jumps from 100 ms to 3 s. Compare library defaults with tuned pool and timeouts: watch the connection slots, callers waiting for a connection, and Tomcat threads.'
  },
  gotchas: [
    { trap: 'No response timeout',
      why: 'Defaults vary: <code>HttpURLConnection</code> (Spring’s <code>SimpleClientHttpRequestFactory</code>) waits forever for reads; Apache HttpClient 5 has no response timeout unless configured; Reactor Netty has no response timeout by default. A hung peer holds your thread and connection indefinitely.',
      fix: 'Always set connect and response timeouts explicitly, below your own caller’s timeout. For <code>WebClient</code>, add <code>.timeout(Duration)</code> on the <code>Mono</code> for a total deadline.' },
    { trap: 'Read timeout isn’t a total deadline',
      why: 'Socket/read timeouts measure the gap between bytes. A server that drips a byte every 4 s never trips a 5 s read timeout, and a 10 MB response can take minutes.',
      fix: 'Add an overall deadline: <code>Mono.timeout</code> for WebClient, Resilience4j <code>TimeLimiter</code>, or a <code>CompletableFuture.orTimeout</code> around a blocking call. See <a href="resilience.html">Resilience patterns</a>.' },
    { trap: 'RestClient.create() or new RestTemplate() loses observability',
      code: `RestClient c = RestClient.create("https://pay.example.com");   // no metrics, no trace headers\n\nRestClient c2 = builder.baseUrl("https://pay.example.com").build(); // Boot's builder: observed`,
      why: 'Boot auto-configures <code>RestClient.Builder</code>, <code>WebClient.Builder</code> and <code>RestTemplateBuilder</code> with message converters, the <code>ObservationRegistry</code> (<code>http.client.requests</code> metrics, trace propagation) and customizers. Static factories skip all of it.',
      fix: 'Inject the builder (it is prototype-scoped, so each injection gets its own copy) and build one client per downstream.' },
    { trap: 'String-concatenated URIs explode metric cardinality',
      code: `client.get().uri("/orders/" + id)          // uri tag = /orders/81723, /orders/81724, …\nclient.get().uri("/orders/{id}", id)       // uri tag = /orders/{id}`,
      why: 'The observation uses the URI <i>template</i> as the <code>uri</code> tag. With a pre-built string there is no template, so every id becomes a new time series in Prometheus.',
      fix: 'Always pass URI templates with variables. Check <code>/actuator/metrics/http.client.requests</code> for runaway tag values.' },
    { trap: 'Pool per route too small for the call volume',
      why: 'Apache HttpClient 5 allows 5 connections per route by default. At 100 ms latency, 5 connections carry about 50 req/s to that host; beyond that, callers wait for a connection, and that wait isn’t visible in the downstream’s latency.',
      fix: 'Size per-route connections ≈ peak req/s × p99 latency (Little’s law) plus headroom, set a short connection-request timeout, and expose the pool metrics.' },
    { trap: 'Stale pooled connections behind a load balancer',
      why: 'Load balancers drop idle connections silently (Azure Load Balancer’s default idle timeout is 4 minutes; AWS ALB’s is 60 s). The next request on that connection fails with “Connection reset” or <code>NoHttpResponseException</code>.',
      fix: 'Evict idle connections before the LB does (<code>evictIdleConnections</code>), validate after inactivity, and set Reactor Netty’s <code>maxIdleTime</code>. Retry idempotent requests once on these errors.' },
    { trap: 'Retrying non-idempotent POSTs',
      why: 'A timeout doesn’t mean the server didn’t do the work. Retrying a payment POST can charge twice.',
      fix: 'Retry only idempotent methods, or send an <code>Idempotency-Key</code> the server deduplicates. Retries multiply the latency budget: 3 tries × 5 s is a 15 s request.' }
  ],
  scenarios: [
    { title: 'Checkout down for 20 minutes because the fraud API slowed down',
      symptom: 'The fraud-check provider’s p99 went from 120 ms to 8 s. Checkout latency hit 60 s, Tomcat’s 200 threads were all busy, and health checks failed. CPU was idle.',
      diagnose: `# thread dump: ~190 threads in the same frame
"http-nio-8080-exec-117" WAITING (parking)
   at org.apache.hc.core5.pool.StrictConnPool.lease(...)
   at org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManager.lease(...)
   at com.acme.fraud.FraudClient.check(FraudClient.java:41)`,
      diagnoseLang: 'text',
      cause: 'Default pool (5 per route) and no response timeout. Five threads waited on slow responses; every other request thread queued in <code>lease()</code> waiting for one of those five connections, with HttpClient’s minutes-long default connection-request timeout.',
      fix: 'Short acquire timeout, response timeout below the checkout SLA, a pool sized for peak, and a circuit breaker with a fallback (“accept and review later”).',
      fixCode: `var cm = PoolingHttpClientConnectionManagerBuilder.create()
    .setMaxConnPerRoute(40).setMaxConnTotal(100)
    .setDefaultConnectionConfig(ConnectionConfig.custom()
        .setConnectTimeout(Timeout.ofSeconds(1))
        .setSocketTimeout(Timeout.ofSeconds(2)).build())
    .build();
var http = HttpClients.custom().setConnectionManager(cm)
    .setDefaultRequestConfig(RequestConfig.custom()
        .setConnectionRequestTimeout(Timeout.ofMilliseconds(200))   // don't queue behind a sick host
        .setResponseTimeout(Timeout.ofSeconds(2)).build())
    .evictIdleConnections(TimeValue.ofSeconds(30))
    .build();` },
    { title: 'WebClient: “Pool#acquire has been pending for more than the configured timeout of 45000ms”',
      symptom: 'A batch job that enriches 50k records via <code>WebClient</code> fails after a minute with <code>PoolAcquirePendingLimitException</code> and <code>PoolAcquireTimeoutException</code>.',
      diagnose: `Flux.fromIterable(records)\n    .flatMap(r -> client.get().uri("/enrich/{id}", r.id())\n                        .retrieve().bodyToMono(Enriched.class))   // concurrency 256\n    .collectList().block();`,
      cause: '<code>flatMap</code> subscribes 256 requests at once, but the default <code>ConnectionProvider</code> allows <code>max(cores, 8) × 2</code> connections (16 on a small pod) and a bounded pending queue. The rest wait 45 s or are rejected.',
      fix: 'Match concurrency to the pool and to what the downstream can take, and configure the provider explicitly.',
      fixCode: `ConnectionProvider pool = ConnectionProvider.builder("enrich")
    .maxConnections(32)
    .pendingAcquireTimeout(Duration.ofSeconds(2))
    .maxIdleTime(Duration.ofSeconds(30))      // below the LB idle timeout
    .build();
HttpClient http = HttpClient.create(pool)
    .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 1_000)
    .responseTimeout(Duration.ofSeconds(3));
WebClient client = builder.clientConnector(new ReactorClientHttpConnector(http)).build();

Flux.fromIterable(records).flatMap(this::enrich, 32);   // concurrency = pool size` },
    { title: 'Prometheus memory doubled after a new integration',
      symptom: 'Prometheus series count grew by 400k in a day. The top metric was <code>http_client_requests_seconds_bucket</code>.',
      diagnose: `curl -s localhost:8080/actuator/metrics/http.client.requests | jq '.availableTags[] | select(.tag=="uri") | .values | length'\n# 51873`,
      diagnoseLang: 'bash',
      cause: 'The new client built URIs with string concatenation (<code>"/customers/" + id + "/orders"</code>), so every id became a distinct <code>uri</code> tag value.',
      fix: 'Use URI templates. As a guard, add a <code>MeterFilter</code> that caps the number of distinct <code>uri</code> values for client metrics.',
      fixCode: `client.get().uri("/customers/{id}/orders", id)   // tag: /customers/{id}/orders\n\n@Bean MeterFilter capClientUris() {\n  return MeterFilter.maximumAllowableTags("http.client.requests", "uri", 100, MeterFilter.deny());\n}` }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which statement about <code>RestClient</code> (Framework 6.1) is true?', options: ['It is reactive and returns Mono', 'It is synchronous and reuses RestTemplate’s infrastructure (request factories, converters, interceptors)', 'It requires WebFlux on the classpath', 'It replaces HTTP interfaces'], answer: 1, explain: '<code>RestClient</code> is a fluent, blocking API built on <code>ClientHttpRequestFactory</code> and <code>HttpMessageConverter</code>s, like <code>RestTemplate</code>. You can even create one from an existing template with <code>RestClient.create(restTemplate)</code>.' },
    { kind: 'predict', q: 'Apache HttpClient 5 with a default pool. 50 Tomcat threads call the same host at once, and each response takes 1 s. Roughly how long does the 50th caller wait in total?', options: ['~1 s', '~5 s', '~10 s', '~50 s'], answer: 2, explain: 'Default <b>5 connections per route</b>. The calls run in waves of 5: 50 / 5 = 10 waves × 1 s ≈ <b>10 s</b> for the last caller. Most of that is waiting for your own pool, not the downstream.' },
    { kind: 'predict', q: 'A peer sends one byte every 4 seconds for a 100-byte response. The client has a 5 s read (socket) timeout. What happens?', options: ['Times out after 5 s', 'Completes after ~400 s', 'Times out after 4 s', 'Fails immediately'], answer: 1, explain: 'The socket timeout is the maximum gap between packets, and each gap is 4 s. The request completes after roughly 400 s. You need an overall deadline as well.' },
    { kind: 'predict', q: 'What does the Micrometer <code>uri</code> tag look like for this call?', code: `restClient.get().uri("/orders/" + orderId + "/lines").retrieve().body(Lines.class);`, options: ['/orders/{id}/lines', '/orders/81723/lines (one value per order)', 'UNKNOWN', 'none'], answer: 1, explain: 'There is no template to report, so the tag is the expanded path, one series per order id. Use <code>.uri("/orders/{id}/lines", orderId)</code>.' },
    { kind: 'concept', q: 'Which adapter lets an <code>@HttpExchange</code> interface use <code>RestClient</code>?', code: `HttpServiceProxyFactory f = HttpServiceProxyFactory\n    .builderFor(/* ??? */.create(restClient)).build();\nOrderApi api = f.createClient(OrderApi.class);`, options: ['WebClientAdapter', 'RestClientAdapter', 'RestTemplateAdapter', 'HttpInterfaceAdapter'], answer: 1, explain: '<code>RestClientAdapter</code> (6.1). <code>WebClientAdapter</code> backs reactive interfaces, and <code>RestTemplateAdapter</code> exists for migrations.' },
    { kind: 'predict', q: 'A <code>WebClient</code> on a 4-core pod with a default <code>ConnectionProvider</code>. <code>flatMap</code> fires 256 concurrent calls to one host. How many TCP connections open at most?', options: ['256', '16', '8', '500'], answer: 1, explain: 'Default max connections = <code>max(cores, 8) × 2</code> = 16. The rest wait in the pending-acquire queue (up to 45 s by default), so set <code>flatMap</code> concurrency and the provider together.' },
    { kind: 'concept', q: 'The client has connect 1 s, response 2 s, and the retry policy makes 3 attempts with no backoff. What’s the worst-case latency against a host that accepts connections but never answers?', options: ['2 s', '3 s', '6 s', '9 s'], answer: 2, explain: 'Each attempt connects quickly and then waits the full 2 s response timeout: 3 × 2 = 6 s, plus any acquire wait. Retries multiply your timeout; your caller’s timeout must be larger, or retries are pointless.' }
  ],
  interview: [
    { q: 'RestTemplate vs RestClient vs WebClient: which do you use and why?', a: '<ul><li><b>RestClient</b> (6.1+): new blocking code in MVC apps. Fluent API, same infrastructure as RestTemplate.</li><li><b>WebClient</b>: reactive apps, streaming responses, or many concurrent calls composed with Reactor. It can be used from MVC with <code>block()</code> at the edge, but don’t mix models casually.</li><li><b>RestTemplate</b>: existing code. It is in maintenance mode, and the Spring team has announced its deprecation for the Framework 7.x line, so migrate opportunistically.</li></ul>', lvl: 'core' },
    { q: 'What timeouts exist on an HTTP call, and how do you pick values?', a: '<p><b>Acquire</b> (waiting for a pooled connection), <b>connect</b> (TCP + TLS handshake), <b>response/read</b> (time to first byte, or the gap between bytes), and an <b>overall deadline</b>. Pick from the downstream’s p99 plus margin, and keep the sum (× retries) below your own caller’s timeout. Acquire should be short: waiting on your own pool usually means the downstream is already sick.</p>', fu: 'Why is a 30 s timeout in a 10 s request chain a bug? (The caller has already given up; you keep doing wasted work.)', lvl: 'core' },
    { q: 'How do you size an outbound connection pool?', a: '<p>Little’s law: concurrent connections ≈ throughput × latency. 200 req/s at 50 ms p99 needs about 10; give headroom (×2) and cap it at what the downstream can take. Per-route limits matter more than the total. Watch pool metrics (leased, pending, available) and alert on pending &gt; 0 for long periods.</p>', lvl: 'deep' },
    { q: 'What are HTTP interfaces?', a: '<p>Declarative clients: an interface with <code>@HttpExchange</code>/<code>@GetExchange</code>/<code>@PostExchange</code> methods, parameters annotated <code>@PathVariable</code>, <code>@RequestParam</code>, <code>@RequestBody</code>, <code>@RequestHeader</code>. <code>HttpServiceProxyFactory</code> creates a proxy over a <code>RestClientAdapter</code>, <code>WebClientAdapter</code> or <code>RestTemplateAdapter</code>. Return types can be blocking (<code>Order</code>, <code>ResponseEntity</code>) or reactive (<code>Mono</code>). Framework 7 / Boot 4 add group-based registration of many interfaces.</p>', fu: 'How does it compare with OpenFeign? (Built into Spring, no extra starter; Spring Cloud OpenFeign is in maintenance mode.)', lvl: 'core' },
    { q: 'How are HTTP errors handled by RestClient?', a: '<p><code>retrieve()</code> throws <code>HttpClientErrorException</code> (4xx) or <code>HttpServerErrorException</code> (5xx), both <code>RestClientResponseException</code>s carrying status, headers and body. Customise with <code>.onStatus(HttpStatusCode::is4xxClientError, (req, res) -&gt; …)</code> or a builder-level <code>defaultStatusHandler</code>. Use <code>exchange()</code> for full control. I/O failures and timeouts surface as <code>ResourceAccessException</code>.</p>', lvl: 'core' },
    { q: 'Which underlying HTTP library does Boot pick for RestClient?', a: '<p>Boot detects a <code>ClientHttpRequestFactory</code> from the classpath: Apache HttpClient 5 first, then Jetty, then Reactor Netty, then the JDK <code>HttpClient</code>, and finally <code>SimpleClientHttpRequestFactory</code>. The detection order and the Boot 3.4 <code>spring.http.client.*</code> properties are version-specific, so set the factory explicitly when timeouts and pooling matter.</p>', lvl: 'deep' },
    { q: 'How do you propagate trace context and correlation IDs on outbound calls?', a: '<p>Use Boot’s auto-configured builders. With Micrometer Tracing on the classpath, the client observation injects <code>traceparent</code> (W3C) or B3 headers and records <code>http.client.requests</code>. For custom headers, add a <code>ClientHttpRequestInterceptor</code> (RestClient) or <code>ExchangeFilterFunction</code> (WebClient) via a builder customizer.</p>', lvl: 'core' },
    { q: 'What happens to a pooled connection when the server or load balancer closes it while idle?', a: '<p>The client doesn’t know until it writes the next request and gets a reset or an empty response (<code>NoHttpResponseException</code>). Prevent it by evicting idle connections sooner than the server or LB idle timeout, and validate connections after inactivity. Retry only safe or idempotent requests on these specific errors.</p>', lvl: 'deep' },
    { q: 'Should every outbound call be wrapped in a circuit breaker?', a: '<p>Calls to dependencies that can fail independently of you, yes, when there is a sensible fallback or fast failure is better than waiting. A breaker stops threads piling up behind a sick dependency. It is not a replacement for timeouts: the breaker only opens because timeouts produced failures. See <a href="resilience.html">Resilience patterns</a>.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'RestClient with real timeouts', lang: 'java', code: `@Configuration
class PaymentsClientConfig {
  @Bean
  RestClient paymentsRestClient(RestClient.Builder builder) {      // Boot's builder: metrics + tracing
    var cm = PoolingHttpClientConnectionManagerBuilder.create()
        .setMaxConnPerRoute(40).setMaxConnTotal(80)
        .setDefaultConnectionConfig(ConnectionConfig.custom()
            .setConnectTimeout(Timeout.ofSeconds(1))
            .setSocketTimeout(Timeout.ofSeconds(3)).build())
        .build();
    var http = HttpClients.custom().setConnectionManager(cm)
        .setDefaultRequestConfig(RequestConfig.custom()
            .setConnectionRequestTimeout(Timeout.ofMilliseconds(300))
            .setResponseTimeout(Timeout.ofSeconds(3)).build())
        .evictIdleConnections(TimeValue.ofSeconds(30))
        .build();
    return builder
        .baseUrl("https://payments.internal")
        .requestFactory(new HttpComponentsClientHttpRequestFactory(http))
        .defaultHeader("Accept", "application/json")
        .defaultStatusHandler(HttpStatusCode::is5xxServerError,
            (req, res) -> { throw new PaymentsUnavailable(res.getStatusCode()); })
        .build();
  }
}

Payment p = payments.post().uri("/payments")
    .header("Idempotency-Key", cmd.key())
    .body(cmd).retrieve().body(Payment.class);` },
    { title: 'HTTP interface', lang: 'java', code: `@HttpExchange(url = "/orders", accept = "application/json")
public interface OrderApi {
  @GetExchange("/{id}")
  Order get(@PathVariable long id);

  @GetExchange
  List<Order> search(@RequestParam String customer, @RequestParam(defaultValue = "0") int page);

  @PostExchange
  ResponseEntity<Order> create(@RequestBody CreateOrder cmd, @RequestHeader("Idempotency-Key") String key);
}

@Bean
OrderApi orderApi(RestClient.Builder builder) {          // Framework 6.1+
  RestClient rc = builder.baseUrl("https://orders.internal").build();
  return HttpServiceProxyFactory.builderFor(RestClientAdapter.create(rc))
      .build().createClient(OrderApi.class);
}` },
    { title: 'WebClient pool & timeouts', lang: 'java', code: `@Bean
WebClient pricingClient(WebClient.Builder builder) {
  ConnectionProvider pool = ConnectionProvider.builder("pricing")
      .maxConnections(50)
      .pendingAcquireTimeout(Duration.ofMillis(500))
      .maxIdleTime(Duration.ofSeconds(30))
      .evictInBackground(Duration.ofSeconds(60))
      .metrics(true)
      .build();
  HttpClient http = HttpClient.create(pool)
      .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 1_000)
      .responseTimeout(Duration.ofSeconds(2));
  return builder.baseUrl("https://pricing.internal")
      .clientConnector(new ReactorClientHttpConnector(http))
      .build();
}

Mono<Price> price(String sku) {
  return pricing.get().uri("/price/{sku}", sku).retrieve().bodyToMono(Price.class)
      .timeout(Duration.ofSeconds(3));          // overall deadline, including retries below it
}` },
    { title: 'Pool metrics to watch', lang: 'bash', code: `# Apache HttpClient 5 (Micrometer binder) / Reactor Netty pool metrics
curl -s localhost:8080/actuator/metrics/http.client.requests | jq '.measurements'
curl -s localhost:8080/actuator/metrics/reactor.netty.connection.provider.pending.connections
curl -s localhost:8080/actuator/metrics/reactor.netty.connection.provider.active.connections

# pending > 0 for minutes = callers waiting on YOUR pool, not on the downstream`, note: 'Reactor Netty pool metrics need <code>.metrics(true)</code> on the provider. Apache HttpClient pool metrics need Micrometer’s <code>PoolingHttpClientConnectionManagerMetricsBinder</code>.' }
  ]
});

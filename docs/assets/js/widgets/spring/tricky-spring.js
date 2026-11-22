/* Tricky Spring: a timed drill of 50 behaviour questions across all Spring track topics, with per-topic scores and a review of misses linking back to the topic pages. */
IA.widget('tricky-spring', (root, ctx) => {
  const { el, reduced } = ctx;
  const TOPIC = {
    'ioc-di': ['IoC & DI', 'Core'], 'bean-lifecycle-scopes': ['Lifecycle & scopes', 'Core'], 'configuration-profiles': ['@Configuration & profiles', 'Core'], 'aop-proxies': ['AOP & proxies', 'Core'], 'spring-events': ['Application events', 'Core'],
    'auto-configuration': ['Auto-configuration', 'Boot'], 'starters-dependencies': ['Starters & dependencies', 'Boot'], 'externalized-config': ['Externalized config', 'Boot'], 'actuator-observability': ['Actuator', 'Boot'], 'boot-testing': ['Testing in Boot', 'Boot'],
    'mvc-request-flow': ['MVC request flow', 'Web'], 'errors-validation': ['Errors & validation', 'Web'], 'webflux-reactive': ['WebFlux', 'Web'], 'http-clients': ['HTTP clients', 'Web'],
    'transactions-propagation': ['@Transactional', 'Data'], 'jpa-n-plus-1': ['JPA fetching', 'Data'], 'spring-data': ['Spring Data', 'Data'], 'hikari-pooling': ['HikariCP', 'Data'],
    'security-filter-chain': ['Security filter chain', 'Security'], 'oauth2-jwt': ['OAuth2 & JWT', 'Security'],
    'kafka-messaging': ['Kafka', 'Distributed'], 'resilience': ['Resilience', 'Distributed'], 'caching': ['Caching', 'Distributed'], 'async-scheduling': ['@Async & scheduling', 'Distributed'],
    'aot-native': ['AOT & native', 'Production'], 'startup-performance': ['Startup & runtime', 'Production']
  };
  /*Q-START*/
  const Q = [
    // ---------- Core ----------
    { s: 'ioc-di', q: 'Two beans implement <code>PaymentGateway</code>: <code>stripeGateway</code> and <code>paypalGateway</code>, neither is <code>@Primary</code>. What happens at startup?', code: `@Service
class Checkout {
  Checkout(PaymentGateway gateway) { … }
}`, o: ['The first registered bean is injected', 'NoUniqueBeanDefinitionException: expected single matching bean but found 2', 'null is injected', 'Both are injected as a list'], a: 1, x: 'Two candidates and no <code>@Primary</code>/<code>@Qualifier</code>. Spring’s last fallback is to match the <b>parameter name</b> against bean names; <code>gateway</code> matches neither, so startup fails. Naming the parameter <code>stripeGateway</code> would work (with <code>-parameters</code>), but a qualifier is clearer.' },
    { s: 'ioc-di', q: 'A and B depend on each other through their constructors. Boot 3.x, <code>spring.main.allow-circular-references=true</code>. Result?', code: `@Service class A { A(B b) { … } }
@Service class B { B(A a) { … } }`, o: ['Works: the property allows cycles', 'Startup fails: a constructor cycle can’t be resolved, whatever the property', 'Works with a CGLIB proxy', 'A gets a null B'], a: 1, x: 'The property (default <code>false</code> since Boot 2.6) only lets Spring resolve cycles through early references for field/setter injection. With constructors neither object can be created first: <code>BeanCurrentlyInCreationException</code>. Break the cycle, or inject <code>ObjectProvider&lt;B&gt;</code> / use <code>@Lazy</code>.' },
    { s: 'bean-lifecycle-scopes', q: 'A singleton injects a prototype-scoped bean and calls it twice. How many prototype instances does it use?', code: `@Component @Scope("prototype") class Draft { }
@Service class Editor {
  private final Draft draft;
  Editor(Draft draft) { this.draft = draft; }
  void a() { draft.… }  void b() { draft.… }
}`, o: ['One per call: 2', 'One: injected once, when the singleton was created', 'One per thread', 'Startup fails: scope mismatch'], a: 1, x: 'Injection happens once. To get a fresh prototype per use, inject <code>ObjectProvider&lt;Draft&gt;</code> and call <code>getObject()</code>, use <code>@Lookup</code>, or a scoped proxy.' },
    { s: 'bean-lifecycle-scopes', q: 'A bean has all of these. In what order do they run?', code: `constructor
@PostConstruct void init()
afterPropertiesSet()            // InitializingBean
@Bean(initMethod = "start")`, o: ['constructor, afterPropertiesSet, @PostConstruct, start', 'constructor, @PostConstruct, afterPropertiesSet, start', 'constructor, start, @PostConstruct, afterPropertiesSet', '@PostConstruct, constructor, afterPropertiesSet, start'], a: 1, x: 'Construct, inject, then <code>@PostConstruct</code> (run by a BeanPostProcessor before initialization), then <code>InitializingBean.afterPropertiesSet()</code>, then the custom init method. Destruction mirrors it: <code>@PreDestroy</code>, <code>destroy()</code>, destroy method.' },
    { s: 'configuration-profiles', q: 'How many <code>HikariDataSource</code> objects are created?', code: `@Configuration(proxyBeanMethods = false)
class DbConfig {
  @Bean DataSource ds() { return new HikariDataSource(); }
  @Bean JdbcTemplate a() { return new JdbcTemplate(ds()); }
  @Bean JdbcTemplate b() { return new JdbcTemplate(ds()); }
}`, o: ['1', '2', '3', 'Startup fails'], a: 2, x: 'In “lite” mode there is no CGLIB subclass intercepting <code>ds()</code>: each call is plain Java. The container creates its own <code>ds</code> bean, and <code>a()</code> and <code>b()</code> each create another. With the default <code>proxyBeanMethods = true</code>, both calls return the singleton: 1. Better: take <code>DataSource</code> as a parameter of <code>a</code> and <code>b</code>.' },
    { s: 'aop-proxies', q: 'Spring 6.x, class-based (CGLIB) proxy. Another bean in the same package calls <code>reindex()</code>. Is there a transaction?', code: `@Service
class SearchService {
  @Transactional
  protected void reindex() { … }
}`, o: ['No: only public methods are transactional', 'Yes: since Spring 6.0, protected and package-private methods work with class-based proxies', 'Only with AspectJ', 'Startup error'], a: 1, x: 'Spring Framework 6.0 extended <code>@Transactional</code> to non-private methods on class-based proxies. <code>private</code> methods still can’t be intercepted, and self-calls still bypass the proxy.' },
    { s: 'aop-proxies', q: 'Aspect A is <code>@Order(1)</code> and its <code>@Around</code> catches every exception and returns a default. The transaction advisor has the default (lowest) precedence. The method inserts a row, then throws. What happens?', o: ['Row committed, caller gets the default', 'Transaction rolled back, caller gets the default', 'Row committed, caller gets the exception', 'Rolled back, caller gets the exception'], a: 1, x: 'Lower order = outer. The transaction interceptor is <b>inside</b> A, so it sees the exception first and rolls back. A then swallows it and returns the default: the caller thinks it worked, the data is gone.' },
    { s: 'spring-events', q: 'A <code>@Transactional</code> service publishes an event. A plain <code>@EventListener</code> throws <code>IllegalStateException</code>. What happens to the service’s transaction?', o: ['Commits: listeners are isolated', 'The exception propagates out of publishEvent(), and the transaction rolls back unless the publisher catches it', 'The listener is retried', 'The event is queued for later'], a: 1, x: '<code>@EventListener</code> runs synchronously on the publisher’s thread, inside its transaction. Its exception is thrown from <code>publishEvent()</code>. Use <code>@TransactionalEventListener</code> or <code>@Async</code> to decouple.' },
    { s: 'spring-events', q: 'An event is published <b>outside</b> any transaction. The listener is <code>@TransactionalEventListener</code> (default phase). Is it called?', o: ['Yes, immediately', 'No: with no transaction it is skipped, unless fallbackExecution = true', 'Yes, after the next commit anywhere', 'It throws IllegalStateException'], a: 1, x: 'The listener binds to the current transaction’s AFTER_COMMIT phase. No transaction, nothing to bind to: the event is dropped (logged at debug). Set <code>fallbackExecution = true</code> to run it immediately in that case.' },
    // ---------- Boot ----------
    { s: 'auto-configuration', q: 'You declare <code>@Bean ObjectMapper objectMapper() { return new ObjectMapper(); }</code>. Is <code>spring.jackson.serialization.write-dates-as-timestamps=false</code> applied?', o: ['Yes, Boot post-processes every ObjectMapper', 'No: Boot’s ObjectMapper backs off and the spring.jackson.* properties only configure Boot’s builder', 'Only for MVC', 'Startup fails: duplicate ObjectMapper'], a: 1, x: 'Boot’s Jackson auto-configuration is <code>@ConditionalOnMissingBean</code>. Your mapper replaces it, and nothing applies the properties to it. To customize, declare a <code>Jackson2ObjectMapperBuilderCustomizer</code> instead (Boot 3.x, Jackson 2).' },
    { s: 'auto-configuration', q: 'Where does a Boot 3.x library register its auto-configuration classes?', o: ['META-INF/spring.factories under EnableAutoConfiguration', 'META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports', 'application.yml', '@ComponentScan of the library package'], a: 1, x: 'Since Boot 3.0, auto-configurations are only read from the <code>AutoConfiguration.imports</code> file (one class per line), and should be annotated <code>@AutoConfiguration</code>. The <code>spring.factories</code> key was deprecated in 2.7 and removed in 3.0.' },
    { s: 'starters-dependencies', q: 'With <code>spring-boot-starter-parent</code>, what is the right way to move all Jackson modules to a newer patch version?', o: ['Add &lt;version&gt; to jackson-databind only', 'Override the managed version property, e.g. &lt;jackson-bom.version&gt;', 'Exclude Jackson from every starter', 'Use a newer Boot starter for Jackson only'], a: 1, x: 'Boot manages versions through properties feeding its BOM. Setting <code>jackson-bom.version</code> moves all Jackson artifacts together. A version on one dependency moves only that artifact and can leave modules mismatched.' },
    { s: 'starters-dependencies', q: 'No dependency management. Maven resolves A → lib 1.2 (depth 2) and B → C → lib 1.5 (depth 3). Which lib version ends up on the classpath? (And Gradle?)', o: ['Maven 1.5 · Gradle 1.5', 'Maven 1.2 · Gradle 1.5', 'Maven 1.2 · Gradle 1.2', 'Both fail with a conflict'], a: 1, x: 'Maven uses “nearest wins” (ties: first declared), so 1.2 at depth 2 beats 1.5. Gradle picks the highest version by default. That difference is a classic cause of “works in Gradle, NoSuchMethodError in Maven”; Boot’s BOM avoids most of it.' },
    { s: 'externalized-config', q: '<code>application.yml</code> says <code>server.port: 8080</code>, the environment has <code>SERVER_PORT=9000</code>, and the app starts with <code>--server.port=7000</code>. Port?', o: ['8080', '9000', '7000', 'Startup fails: conflicting values'], a: 2, x: 'Command-line arguments rank above OS environment variables, which rank above packaged <code>application.yml</code>. (Test properties and devtools globals sit even higher.)' },
    { s: 'externalized-config', q: 'Which environment variable sets <code>app.retry.max-attempts</code>?', o: ['APP_RETRY_MAX-ATTEMPTS', 'APP_RETRY_MAXATTEMPTS', 'app.retry.max_attempts', 'APP.RETRY.MAX_ATTEMPTS'], a: 1, x: 'Relaxed binding from environment variables: replace dots with underscores, remove dashes, uppercase. So <code>APP_RETRY_MAXATTEMPTS</code>. Dashes aren’t valid in most shells’ variable names anyway.' },
    { s: 'actuator-observability', q: 'Boot 3.x, only <code>spring-boot-starter-actuator</code> added, no properties. Which endpoints are reachable over HTTP?', o: ['health and info', 'health only', 'all of them', 'none until management.server.port is set'], a: 1, x: 'Since Boot 2.5 only <code>health</code> is exposed over the web by default. Others need <code>management.endpoints.web.exposure.include</code>, and should be secured.' },
    { s: 'actuator-observability', q: 'Your liveness group includes the database health indicator. The database fails over for 90 seconds. What does Kubernetes do?', o: ['Nothing: liveness ignores dependencies', 'Restarts every pod, which then start into a database that is still down', 'Removes pods from the Service only', 'Scales the deployment up'], a: 1, x: 'Failing liveness means “restart me”. A shared dependency failing then restarts the whole fleet at once. Put dependencies in readiness (or nowhere), keep liveness about the process itself.' },
    { s: 'boot-testing', q: 'The controller needs <code>OrderService</code>, a <code>@Service</code>. What happens?', code: `@WebMvcTest(OrderController.class)
class OrderControllerTest {
  @Autowired MockMvc mvc;
}`, o: ['OrderService is loaded automatically', 'The context fails to start: no OrderService bean in the web slice', 'OrderService is replaced by a mock automatically', 'The test runs without a controller'], a: 1, x: 'A test slice only includes web components (controllers, advice, converters, filters…). Services aren’t scanned, so the controller can’t be created. Add <code>@MockitoBean OrderService orders;</code> (Boot 3.4+; <code>@MockBean</code> before).' },
    { s: 'boot-testing', q: 'Your test suite starts 14 Spring contexts and takes 9 minutes. The most common reason?', o: ['JUnit runs tests in parallel', 'Test classes differ in @MockitoBean sets, properties or profiles, so each combination gets its own cached context', 'Spring never caches contexts', 'Testcontainers restarts the database'], a: 1, x: 'The test context cache key includes the configuration, active profiles, property overrides and mock-bean definitions. Standardize them (a shared base class or a few test configurations) to reuse contexts.' },
    // ---------- Web ----------
    { s: 'mvc-request-flow', q: 'For one request, which runs first?', o: ['HandlerInterceptor.preHandle', 'A servlet Filter', 'A HandlerMethodArgumentResolver', '@ControllerAdvice @InitBinder'], a: 1, x: 'Filters run in the servlet container before the <code>DispatcherServlet</code>. Inside it: handler mapping picks the handler, interceptors’ <code>preHandle</code>, then argument resolution (with binders), then your method.' },
    { s: 'mvc-request-flow', q: 'The client sends <code>Accept: application/json</code>. What is the response body?', code: `@GetMapping("/hello")
String hello() { return "hello"; }      // in a @RestController`, o: ['"hello" (a JSON string with quotes)', 'hello (raw text, no quotes)', '{"value":"hello"}', '406 Not Acceptable'], a: 1, x: 'For a <code>String</code> return value, <code>StringHttpMessageConverter</code> comes before the Jackson converter and accepts any media type, so it writes the raw characters. Clients parsing JSON then fail. Return an object or a record instead.' },
    { s: 'errors-validation', q: 'A <code>@Valid @RequestBody</code> fails validation. No <code>@ControllerAdvice</code>, Boot 3.x defaults. What does the client get?', o: ['500 Internal Server Error', '400 with Boot’s default error JSON (a ProblemDetail only if you enable it)', '422 with field errors', '200 with an empty body'], a: 1, x: '<code>MethodArgumentNotValidException</code> maps to 400. Boot renders its standard error attributes; field errors aren’t included by default (<code>server.error.include-binding-errors</code>). Set <code>spring.mvc.problemdetails.enabled=true</code> for RFC 9457 bodies, or write an advice.' },
    { s: 'errors-validation', q: 'Is the email validated when a controller calls this?', code: `@Service
class SignupService {
  public void register(@Email @NotBlank String email) { … }
}`, o: ['Yes, Bean Validation applies everywhere', 'No: method validation on beans requires @Validated on the class', 'Only in tests', 'Only if the controller has @Valid'], a: 1, x: 'Constraint annotations on service method parameters are enforced by <code>MethodValidationPostProcessor</code>, which only proxies classes annotated <code>@Validated</code>. (Spring 6.1 added built-in method validation for <i>controller</i> parameters.)' },
    { s: 'webflux-reactive', q: 'Is the order saved?', code: `@PostMapping("/orders")
Mono<Void> place(@RequestBody Order o) {
  repo.save(o);                 // ReactiveCrudRepository
  return Mono.empty();
}`, o: ['Yes, when save() is called', 'No: the Mono from save() is never subscribed', 'Yes, at the end of the request', 'It throws an exception'], a: 1, x: 'Reactive calls are lazy: nothing happens until someone subscribes. The returned <code>Mono.empty()</code> is subscribed by WebFlux; the save’s <code>Mono</code> is dropped. Write <code>return repo.save(o).then();</code>.' },
    { s: 'webflux-reactive', q: 'Inside a WebFlux handler running on <code>reactor-http-nio-2</code>, code calls <code>webClient.get()…bodyToMono(X.class).block()</code>. What happens?', o: ['It works but is slow', 'IllegalStateException: block() is not supported on this (non-blocking) thread', 'Deadlock with no error', 'It switches to a virtual thread'], a: 1, x: 'Reactor marks event-loop threads as non-blocking and <code>block()</code> fails fast there. Compose with <code>flatMap</code> instead, or, for unavoidable blocking code, <code>subscribeOn(Schedulers.boundedElastic())</code>.' },
    { s: 'http-clients', q: 'What turns a <code>@HttpExchange</code> interface into a working client in Spring 6.1+?', code: `@HttpExchange("/stock")
interface StockApi { @GetExchange("/{sku}") Stock get(@PathVariable String sku); }`, o: ['Component scanning finds it automatically', 'HttpServiceProxyFactory with an adapter, e.g. RestClientAdapter.create(restClient)', 'Spring Cloud OpenFeign only', 'A @RestController implementing it'], a: 1, x: '<code>HttpServiceProxyFactory.builderFor(RestClientAdapter.create(client)).build().createClient(StockApi.class)</code> creates a JDK proxy that issues the calls. Timeouts, base URL and interceptors come from the underlying <code>RestClient</code>.' },
    { s: 'http-clients', q: 'A partner API stops responding but keeps the TCP connection open. Your client has a connect timeout of 2 s and no read timeout. Effect?', o: ['Calls fail after 2 s', 'Calls can hang for a very long time, holding request threads until they run out', 'The circuit breaker opens immediately', 'The JVM kills the call after 30 s'], a: 1, x: 'The connect timeout only covers establishing the connection. Without a read (response) timeout, a stalled server keeps your thread waiting, depending on the client library possibly indefinitely. Always set both.' },
    // ---------- Data ----------
    { s: 'transactions-propagation', q: 'The method inserts a row, then throws <code>IOException</code>. Default <code>@Transactional</code>. Is the row in the database afterwards?', o: ['No: any exception rolls back', 'Yes: checked exceptions commit by default', 'Only if the caller catches it', 'Depends on the isolation level'], a: 1, x: 'By default Spring rolls back for <code>RuntimeException</code> and <code>Error</code> only. Use <code>rollbackFor = Exception.class</code> (or wrap the checked exception) if it should roll back.' },
    { s: 'transactions-propagation', q: 'Outer <code>@Transactional</code> loop calls <code>inner.save(o)</code> (REQUIRED) on another bean; one call throws a runtime exception, the outer catches it and continues. What happens at the end?', o: ['The other orders commit', 'UnexpectedRollbackException: everything rolls back', 'Only the failed order rolls back', 'Deadlock'], a: 1, x: 'The inner proxy participates in the outer transaction and can’t roll it back alone, so it marks it rollback-only. The outer commit then rolls back and throws <code>UnexpectedRollbackException</code>. Use REQUIRES_NEW per item or validate without throwing.' },
    { s: 'transactions-propagation', q: 'Inside <code>@Transactional(readOnly = true)</code> with JPA/Hibernate you load an entity and call a setter. Is the change written?', o: ['Yes, at commit, by dirty checking', 'No: Spring sets Hibernate’s flush mode to MANUAL (and the session read-only), so nothing is flushed', 'It throws immediately', 'Only if you call save()'], a: 1, x: 'For read-only transactions Spring’s Hibernate integration disables flushing and marks the session read-only, which also skips dirty-checking snapshots. Read-only is a performance hint and a guard, not just documentation.' },
    { s: 'jpa-n-plus-1', q: '<code>orderRepo.findAll()</code> returns 100 orders, each with a lazy <code>@ManyToOne customer</code> (100 different customers). The view reads <code>order.getCustomer().getName()</code> for each. How many SQL queries?', o: ['1', '2', '101', '200'], a: 2, x: 'One query for orders, then one per uninitialized customer proxy on first access: the N+1 problem. Fix with a fetch join, an entity graph, or batch fetching (<code>hibernate.default_batch_fetch_size</code>).' },
    { s: 'jpa-n-plus-1', q: 'Hibernate 6, <code>Pageable</code> of 20 with a <code>JOIN FETCH</code> on a collection (<code>o.lines</code>). What happens?', o: ['SQL LIMIT 20 on the joined rows', 'Warning HHH90003004: all rows are fetched and paginated in memory', 'Hibernate splits it into two queries automatically', 'Syntax error'], a: 1, x: 'Limiting joined rows would cut collections in half, so Hibernate fetches everything and pages in memory, with a warning (or an error if <code>hibernate.query.fail_on_pagination_over_collection_fetch=true</code>). Page the parent ids first, then fetch.' },
    { s: 'jpa-n-plus-1', q: 'Boot defaults. A controller serializes an entity and touches a lazy collection after the service’s transaction ended. Result?', o: ['LazyInitializationException', 'It works, because open-in-view keeps the EntityManager open for the whole request (Boot logs a warning)', 'The collection is empty', 'A new transaction is started'], a: 1, x: '<code>spring.jpa.open-in-view</code> defaults to <code>true</code>, so lazy loading works in the view, at the cost of holding a connection for the whole request and hidden queries. Many teams set it to false.' },
    { s: 'spring-data', q: 'What is the difference in SQL between returning <code>Page&lt;Order&gt;</code> and <code>Slice&lt;Order&gt;</code> from a derived query?', o: ['None', 'Page also runs a count query; Slice fetches size + 1 rows to know if there is a next page', 'Slice runs a count query', 'Page loads all rows'], a: 1, x: 'A <code>Page</code> needs the total, so Spring Data issues a <code>count</code> query, which can be expensive. <code>Slice</code> asks for one extra row instead. Use Slice for infinite scrolling.' },
    { s: 'spring-data', q: 'The entity has a manually assigned UUID id (no <code>@Version</code>, not <code>Persistable</code>). What SQL does <code>repo.save(new Doc(uuid, …))</code> run?', o: ['INSERT only', 'SELECT by id, then INSERT (save() calls merge())', 'UPDATE, then INSERT', 'MERGE statement'], a: 1, x: '<code>SimpleJpaRepository.save</code> calls <code>persist</code> only for new entities, detected by a null id (or version). An assigned id looks “not new”, so it calls <code>merge</code>, which first SELECTs. Implement <code>Persistable</code> or add a <code>@Version</code> field.' },
    { s: 'hikari-pooling', q: 'Boot defaults (HikariCP). 50 concurrent requests each hold a connection for 1 s. What happens to requests beyond the pool size?', o: ['A new connection is opened for each', 'They wait for a free connection, up to the 30 s connectionTimeout, then fail; the default pool size is 10', 'They fail immediately', 'They run without a connection'], a: 1, x: 'Hikari’s defaults are <code>maximumPoolSize = 10</code> and <code>connectionTimeout = 30000 ms</code>. Waiting threads see <code>SQLTransientConnectionException: … request timed out after 30000ms</code>. Size the pool for the database, and shorten the timeout to fail fast.' },
    // ---------- Security ----------
    { s: 'security-filter-chain', q: 'The user’s only authority is <code>"ADMIN"</code>. Result of the request?', code: `.requestMatchers("/admin/**").hasRole("ADMIN")`, o: ['Allowed', '403 Forbidden', '401 Unauthorized', 'Startup error'], a: 1, x: '<code>hasRole("ADMIN")</code> requires the authority <code>ROLE_ADMIN</code>. The user is authenticated, so it is a 403 from the access denied handler.' },
    { s: 'security-filter-chain', q: 'Session-cookie app, Security 6 defaults. A logged-in browser sends <code>POST /profile</code> without a CSRF token. Which component answers?', o: ['AuthorizationFilter with 403', 'CsrfFilter with 403, before authentication rules are consulted', 'The controller', 'ExceptionTranslationFilter with 401'], a: 1, x: '<code>CsrfFilter</code> sits early in the chain and rejects state-changing requests without a valid token by calling the access denied handler itself.' },
    { s: 'oauth2-jwt', q: 'A resource server is configured with only <code>issuer-uri</code>. A valid token from the same issuer but with <code>aud: reporting-api</code> calls <code>payments-api</code>. Result?', o: ['401: wrong audience', 'Authenticated: audience is not validated by default', '403', 'The IdP is called to check'], a: 1, x: 'Default validation covers signature, <code>exp</code>/<code>nbf</code> and <code>iss</code>. Add an audience check (Boot’s <code>jwt.audiences</code> property or a <code>JwtClaimValidator</code> on <code>aud</code>).' },
    { s: 'oauth2-jwt', q: 'A JWT contains <code>"scope": "orders.read orders.write"</code>. Which check passes with Spring Security’s defaults?', o: ['hasRole("orders.read")', 'hasAuthority("SCOPE_orders.read")', 'hasAuthority("orders.read")', 'hasAuthority("SCOPE_orders.read orders.write")'], a: 1, x: 'The default <code>JwtGrantedAuthoritiesConverter</code> splits the scope claim and prefixes each value with <code>SCOPE_</code>.' },
    // ---------- Distributed & async ----------
    { s: 'kafka-messaging', q: 'AckMode.BATCH (default). A poll returns offsets 100–109; the listener finishes 100–106 and the pod is killed. Where does the next consumer start?', o: ['107', '100', '110', 'The end of the partition'], a: 1, x: 'The batch commit never happened, so the committed offset is still 100: 100–106 are processed again. Listeners must be idempotent.' },
    { s: 'kafka-messaging', q: 'Spring Kafka 3.x with no error handler configured. A record throws on every attempt. What happens?', o: ['Retried forever', 'Delivered 10 times in total, then logged and skipped', 'Sent to orders.DLT', 'The container stops'], a: 1, x: '<code>DefaultErrorHandler</code> defaults to <code>FixedBackOff(0, 9)</code> and a logging recoverer. A DLT needs a <code>DeadLetterPublishingRecoverer</code>.' },
    { s: 'resilience', q: 'Count-based window, <code>minimumNumberOfCalls</code> 5, threshold 50%. Recorded: 4 failures, 4 successes. State?', o: ['CLOSED: 50% is not above 50%', 'OPEN: equal to the threshold opens it', 'HALF_OPEN', 'It needs 10 calls first'], a: 1, x: 'Resilience4j opens when the failure rate is equal to or greater than the threshold, once the minimum number of calls is recorded.' },
    { s: 'resilience', q: 'Gateway, BFF and orders service each retry 3 attempts. The database behind orders is down. Maximum DB calls per user request?', o: ['3', '9', '27', '81'], a: 2, x: '3 × 3 × 3 = 27: each layer multiplies the attempts of the layer below. Retry at one layer, fail fast elsewhere, and use jittered back-off.' },
    { s: 'caching', q: 'Both are called with 42, <code>byId</code> first. What does <code>summary(42)</code> return?', code: `@Cacheable("users") public User byId(long id) { … }
@Cacheable("users") public UserSummary summary(long id) { … }`, o: ['A fresh UserSummary', 'The cached User, so the caller fails with ClassCastException', 'null', 'Startup error'], a: 1, x: 'The default key is only the arguments: both methods use key <code>42</code> in cache <code>users</code>. Use different cache names or include the method name in the key.' },
    { s: 'caching', q: 'How many times does the repository run?', code: `public List<Product> many(List<Long> ids) { return ids.stream().map(this::find).toList(); }
@Cacheable("products") public Product find(long id) { return repo.load(id); }
// controller: service.many(List.of(1L, 1L, 1L));`, o: ['1', '2', '3', '0'], a: 2, x: 'Each <code>this.find</code> is a self-call that bypasses the cache proxy, so all three load. Calls to <code>service.find(1)</code> from another bean would be cached.' },
    { s: 'async-scheduling', q: 'Boot’s auto-configured <code>applicationTaskExecutor</code> (platform threads) receives 1 000 <code>@Async</code> tasks at once. How many run concurrently?', o: ['1 000', '8, the rest queue', 'One per CPU core', 'Integer.MAX_VALUE'], a: 1, x: 'Core size 8 and an unbounded queue: a <code>ThreadPoolExecutor</code> only adds threads beyond the core size when the queue is full, which never happens.' },
    { s: 'async-scheduling', q: 'Inside an <code>@Async</code> method called from an authenticated request, what does <code>SecurityContextHolder.getContext().getAuthentication()</code> return by default?', o: ['The caller’s Authentication', 'null: the security context is a ThreadLocal of the request thread', 'An anonymous token', 'It throws'], a: 1, x: 'The task runs on a pool thread. Propagate context with <code>DelegatingSecurityContextAsyncTaskExecutor</code> or a <code>TaskDecorator</code>, or pass the user as an argument.' },
    // ---------- Production ----------
    { s: 'aot-native', q: 'A native image was built in CI without any properties set. In production it starts with <code>payments.mode=live</code>. Which bean exists?', code: `@Bean @ConditionalOnProperty(name = "payments.mode", havingValue = "live") PaymentGateway live() { … }
@Bean @ConditionalOnMissingBean PaymentGateway stub() { … }`, o: ['live', 'stub: conditions were evaluated at build time', 'Both', 'Neither: startup fails'], a: 1, x: 'AOT processing evaluates bean-defining conditions during the build and generates registration code for the result. Property values still bind at runtime, but the bean set is fixed.' },
    { s: 'startup-performance', q: 'JDK 21 in a container with a 2 GiB memory limit and no heap flags. Default max heap?', o: ['2 GiB', '1 GiB', '512 MiB', '256 MiB'], a: 2, x: '<code>MaxRAMPercentage</code> defaults to 25% of the container limit. Set it explicitly (often 60–75%) and leave room for non-heap memory.' },
    { s: 'startup-performance', q: 'A pod shows <code>OOMKilled</code>, exit code 137, and no <code>java.lang.OutOfMemoryError</code> in the logs. Most likely?', o: ['The heap was full', 'Total process memory (heap + non-heap) exceeded the cgroup limit and the kernel killed it', 'A liveness probe failed', 'CPU throttling'], a: 1, x: 'A heap OOM is a Java exception you can see. OOMKilled is the kernel enforcing the container limit: thread stacks, metaspace, code cache, direct buffers and native allocations count too. Use Native Memory Tracking.' }
  ];
  /*Q-END*/
  Q.forEach((q) => { q.t = TOPIC[q.s][0]; q.m = TOPIC[q.s][1]; });
  const MODS = ['All', 'Core', 'Boot', 'Web', 'Data', 'Security', 'Distributed', 'Production'];
  if (!document.getElementById('w-ts-style')) {
    document.head.append(el('style', { id: 'w-ts-style', text: `
.w-ts-bar { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; margin: 8px 0; }
.w-ts-bar div { height: 100%; background: var(--accent); }
.w-ts-bar div.low { background: var(--err); }
.w-ts-opts { display: grid; gap: 6px; margin-top: 10px; }
.w-ts-opts button { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 9px; padding: 9px 12px; font-size: 14px; cursor: pointer; overflow-wrap: anywhere; }
.w-ts-opts button:hover:not(:disabled) { border-color: var(--accent); }
.w-ts-opts button.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 15%, transparent); }
.w-ts-opts button.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 15%, transparent); }
.w-ts-opts button:disabled { cursor: default; }
.w-ts-q { font-size: 16px; margin: 6px 0 8px; }
.w-ts-rev { border-top: 1px solid var(--border); padding: 10px 0; }
.w-ts-rev:first-child { border-top: 0; }
.w-ts-stat a { color: inherit; }
` }));
  }
  let mod = 'All'; let count = 10; let secs = 60; let gen = 0; let deck = []; let i = 0; let score = 0; let misses = []; let left = 0; let answered = false; let started = false; let tick = null;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg(MODS.map((t) => [t, t === 'Distributed' ? 'Distributed & async' : t]), () => mod, (v) => { mod = v; reset(); }, 'Module');
  const segN = seg([[10, '10 questions'], [25, '25'], [50, `all ${Q.length}`]], () => count, (v) => { count = v; reset(); }, 'Number of questions');
  const segS = seg([[90, 'Slow · 90 s'], [60, 'Normal · 60 s'], [30, 'Fast · 30 s']], () => secs, (v) => { secs = v; reset(); }, 'Time per question');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Start' }); const bStep = el('button', { class: 'btn', text: 'Skip ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const card = el('div', { class: 'card', style: { padding: '14px', marginTop: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-controls' }, segN, el('span', { class: 'tiny', text: 'time per question' }), segS),
    el('div', { class: 'w-controls' }, bPlay, bStep, bReset), stats, card, narr);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const link = (q) => `<a href="${q.s}.html">${q.t}</a>`;
  function shuffle(a) { const r = a.slice(); for (let j = r.length - 1; j > 0; j--) { const m = Math.floor(Math.random() * (j + 1)); [r[j], r[m]] = [r[m], r[j]]; } return r; }
  function renderStats() { stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `question <b>${Math.min(i + 1, deck.length)}</b>/${deck.length}` }), el('span', { class: 'w-stat', html: `score <b>${score}</b>` }), el('span', { class: 'w-stat', html: `missed <b>${misses.length}</b>` }), el('span', { class: 'w-stat', html: `time <b>${started && !answered ? left + ' s' : '–'}</b>` })); }
  function stopTimer() { if (tick) { clearInterval(tick); tick = null; } }
  function show() {
    const q = deck[i]; answered = false; left = secs; card.innerHTML = '';
    const bar = el('div'); const barWrap = el('div', { class: 'w-ts-bar' }, bar);
    const opts = el('div', { class: 'w-ts-opts' });
    card.append(el('div', { class: 'w-controls', style: { marginBottom: '0' } }, el('span', { class: 'pill accent', text: q.t }), el('span', { class: 'pill', text: q.m === 'Distributed' ? 'Distributed & async' : q.m }), el('span', { class: 'tiny', text: `#${i + 1}` })), barWrap, el('div', { class: 'w-ts-q', html: q.q }));
    if (q.code) card.append(ctx.codeBox(q.code, q.lang || 'java'));
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
    card.append(el('div', { class: 'pz-exp', html: (j === -1 ? '<b>Time’s up.</b> ' : j === -2 ? '<b>Skipped.</b> ' : ok ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.x + ` <span class="tiny">More: ${link(q)}</span>` }));
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
    const by = {}; deck.forEach((q) => { by[q.s] = by[q.s] || [0, 0, q]; by[q.s][1]++; if (!misses.some((m) => m.q === q)) by[q.s][0]++; });
    const rows = Object.values(by).sort((x, y) => (x[0] / x[1]) - (y[0] / y[1]));
    card.append(el('h3', { text: `Score: ${score} / ${deck.length}`, style: { margin: '0 0 8px' } }),
      el('div', { class: 'tiny', text: 'Per topic, weakest first. Click a topic to study it.' }),
      el('div', { class: 'w-stats' }, rows.map(([a, n, q]) => el('span', { class: 'w-stat w-ts-stat', html: `${link(q)} <b style="color:${a === n ? 'var(--ok)' : a === 0 ? 'var(--err)' : 'var(--warn)'}">${a}/${n}</b>` }))));
    if (misses.length) {
      card.append(el('h4', { text: 'Review your misses', style: { margin: '14px 0 4px' } }));
      misses.forEach(({ q, j }) => { const r = el('div', { class: 'w-ts-rev' }, el('div', { html: `<span class="pill">${q.t}</span> ${q.q}` }));
        if (q.code) r.append(ctx.codeBox(q.code, q.lang || 'java'));
        r.append(el('div', { class: 'tiny', html: `You: ${j < 0 ? (j === -1 ? 'time ran out' : 'skipped') : q.o[j]} · Correct: <b>${q.o[q.a]}</b>` }), el('div', { class: 'pz-exp', html: q.x + ` <a href="${q.s}.html">Study ${q.t} →</a>` }));
        card.append(r); });
    } else card.append(el('p', { text: `No misses. Try all ${Q.length} on Fast.` }));
    renderStats(); say(`Done: ${score}/${deck.length}. ` + (misses.length ? 'Your misses are listed above, each with a link to its topic page.' : ''));
  }
  function reset() {
    gen++; stopTimer(); started = false; answered = false; i = 0; score = 0; misses = [];
    const pool = Q.filter((q) => mod === 'All' || q.m === mod); deck = shuffle(pool).slice(0, count);
    bPlay.textContent = '▶ Start'; bStep.textContent = 'Skip ›'; bStep.disabled = true; card.innerHTML = '';
    card.append(el('p', { html: `<b>${deck.length}</b> question${deck.length === 1 ? '' : 's'} (${mod === 'All' ? 'all modules' : mod}), <b>${secs} s</b> each. Answer from Spring Boot 3.x / Framework 6.x defaults unless the question says otherwise.`, style: { margin: 0 } }));
    renderStats(); say('Choose a module, how many questions and the time limit, then press Start.');
  }
  bPlay.addEventListener('click', () => { reset(); started = true; bStep.disabled = false; bPlay.textContent = '↻ Restart'; show(); });
  bStep.addEventListener('click', next);
  bReset.addEventListener('click', reset);
  reset();
});

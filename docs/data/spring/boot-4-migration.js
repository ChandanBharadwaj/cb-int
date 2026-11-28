IA.register({
  track: 'spring',
  slug: 'boot-4-migration',
  title: 'Boot 3 → 4: what changed',
  tagline: 'Spring Framework 7 and Spring Boot 4 are the current generation. The Java minimum is still <b>17</b>. The big moves are elsewhere: Boot is split into <b>small modules</b> with one starter per technology, JSON is <b>Jackson 3</b>, null-safety uses <b>JSpecify</b>, and <b>API versioning</b> and <b>retry</b> are built in. Undertow is gone. Boot 4.1 adds gRPC, an SSRF filter for HTTP clients and lazy JDBC connections.',
  tldr: {
    problem: 'Most tutorials, answers and code samples are Boot 3. An interviewer asks “have you moved to Boot 4?” and expects more than “it is newer”. The upgrade itself fails in predictable places: Jackson imports, missing starters, removed test annotations, renamed properties.',
    model: 'Think in four layers. <b>Baseline</b>: Java 17+, Jakarta EE 11, Servlet 6.1, so Tomcat 11 or Jetty 12.1. <b>Packaging</b>: one module and one starter per technology. <b>Libraries</b>: Jackson 3, Hibernate 7, Spring Security 7, JUnit 6. <b>New features</b>: API versioning, <code>@Retryable</code> and <code>@ConcurrencyLimit</code>, HTTP service client groups, <code>RestTestClient</code>.',
    hook: '“What breaks when you go from Boot 3 to Boot 4?” Name three: Jackson 3 moved to <code>tools.jackson</code>; <code>@MockBean</code> is removed; a technology without its own starter loses its auto-configuration. Then say how you would do it: latest 3.5 first, classic starters as a bridge, then one module at a time.',
    facts: [
      { v: '4.0 · 4.1', l: 'Spring Boot 4.0.0 shipped on 20 November 2025, a week after Spring Framework 7.0. Boot 4.1.0 followed on 10 June 2026' },
      { v: 'Java 17', l: 'is still the minimum for Boot 4 and Framework 7. Java 25 is supported and recommended as the latest LTS. Native images need GraalVM 25+' },
      { v: 'Jackson 3', l: '<code>tools.jackson</code> is its group id and package. Annotations stay in <code>com.fasterxml.jackson.annotation</code>' }
    ]
  },
  intro: {
    what: 'Spring Boot 4 is the next major version after Boot 3. It sits on Spring Framework 7. Your controllers, services and repositories look the same. What changes is the ground under them: which jars you depend on, which JSON library runs, which test annotations exist, and a few defaults. A major version is also when everything that was deprecated gets removed.',
    analogy: { icon: '🏠', title: 'Same house, new wiring', text: 'The rooms are where they were (controllers, services, repositories). But the fuse box was replaced with many small labelled breakers (modules), the plumbing brand changed (Jackson 3), and the old sockets that had a warning sticker for years are gone (deprecated APIs). You move back in room by room.' },
    steps: [
      { t: 'Get to the latest Boot 3.5 first', d: 'Fix every deprecation warning there. Boot 4 removes what 3.x deprecated.', code: '<parent>\n  <groupId>org.springframework.boot</groupId>\n  <artifactId>spring-boot-starter-parent</artifactId>\n  <version>3.5.x</version>   <!-- then 4.0.x, then 4.1.x -->\n</parent>', lang: 'text' },
      { t: 'Switch to 4.0 with the classic starters', d: 'They put every Boot module on the classpath, like 3.x did. You fix code first and dependencies later.', code: '<artifactId>spring-boot-starter-classic</artifactId>\n<!-- tests -->\n<artifactId>spring-boot-starter-test-classic</artifactId>', lang: 'text' },
      { t: 'Fix Jackson and tests', d: 'Move imports to <code>tools.jackson</code>. Replace <code>@MockBean</code> with <code>@MockitoBean</code>.', code: 'import tools.jackson.databind.json.JsonMapper;      // was com.fasterxml.jackson.databind.ObjectMapper\nimport com.fasterxml.jackson.annotation.JsonProperty; // annotations did not move' },
      { t: 'Move to one starter per technology', d: 'Replace the classic starters with the ones you use.', code: 'spring-boot-starter-webmvc      (was spring-boot-starter-web)\nspring-boot-starter-data-jpa\nspring-boot-starter-flyway      (was plain flyway-core)\nspring-boot-starter-security-oauth2-resource-server', lang: 'text' },
      { t: 'Then use what is new', d: 'API versioning, built-in retry, and on 4.1 gRPC and lazy connections.' }
    ],
    terms: [
      ['Spring Framework 7', 'The core framework under Boot 4. Jakarta EE 11 baseline, JSpecify null-safety, Jackson 3, API versioning, built-in retry.'],
      ['modularisation', 'Boot 4 split its one large auto-configure jar into a module per technology: <code>spring-boot-webmvc</code>, <code>spring-boot-data-jpa</code>, <code>spring-boot-flyway</code>…'],
      ['classic starter', '<code>spring-boot-starter-classic</code>: brings all modules, as Boot 3 did. A temporary bridge for migrations.'],
      ['Jackson 3', 'The JSON library’s new major version. Package <code>tools.jackson</code>. The main mapper type is <code>JsonMapper</code>.'],
      ['JSpecify', 'A shared set of nullness annotations (<code>@Nullable</code>, <code>@NullMarked</code>) that Spring now uses instead of its own.'],
      ['API versioning', 'Framework 7 routes a request to a handler by its version: <code>@GetMapping(version = "1.1")</code>.']
    ]
  },
  visual: {
    title: 'Walk a Boot 3.5 service to Boot 4',
    caption: 'Each row is one part of a Boot 3.5 service. Press <b>Play</b> or <b>Step</b> to migrate one row at a time: the left side is what you have, the right side is what Boot 4 expects, and the note below says what breaks and how to fix it. Click any row to jump to it. The last step shows what Boot 4.1 adds.'
  },
  gotchas: [
    { trap: 'Your Jackson customisation is ignored after the upgrade', code: `@Bean
com.fasterxml.jackson.databind.ObjectMapper objectMapper() {   // Jackson 2 type
  return new ObjectMapper().setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE);
}
// Boot 4: responses are camelCase again. Nothing failed.`, why: 'Boot 4 auto-configures a Jackson 3 <code>JsonMapper</code> and Spring MVC uses that. A Jackson 2 <code>ObjectMapper</code> bean still compiles if some library brings Jackson 2 along, but the web layer does not use it.', fix: 'Use <code>spring.jackson.*</code> properties or a <code>JsonMapperBuilderCustomizer</code> bean (it replaces <code>Jackson2ObjectMapperBuilderCustomizer</code>). To replace the mapper, define a <code>JsonMapper</code> bean. <code>spring.jackson.use-jackson2-defaults=true</code> keeps Jackson 2’s default behaviour while you migrate.' },
    { trap: 'A technology without its starter loses its auto-configuration', code: `<!-- Boot 3: enough to run migrations at startup -->
<dependency><groupId>org.flywaydb</groupId><artifactId>flyway-core</artifactId></dependency>

<!-- Boot 4: the auto-configuration lives in its own module -->
<dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-flyway</artifactId></dependency>`, lang: 'text', why: 'In Boot 3 one jar held all auto-configuration, so adding a library was enough. In Boot 4 each technology has its own module. No module on the classpath means no auto-configuration, and no error.', fix: 'Add the matching <code>spring-boot-starter-&lt;technology&gt;</code>. During migration, <code>spring-boot-starter-classic</code> brings them all. Check the condition evaluation report (<code>--debug</code>), see <a href="auto-configuration.html">Auto-configuration</a>.' },
    { trap: '@MockBean and @SpyBean no longer exist', code: `@MockBean OrderService orders;      // Boot 4: does not compile
@MockitoBean OrderService orders;   // Framework 6.2+, the only option in Boot 4`, why: 'Boot 3.4 deprecated them. Boot 4 removed them. <code>@SpringBootTest</code> also stopped registering <code>TestRestTemplate</code> for you.', fix: 'Use <code>@MockitoBean</code> / <code>@MockitoSpyBean</code>. They work on test fields, not inside <code>@Configuration</code> classes. Add <code>@AutoConfigureTestRestTemplate</code>, or switch to <code>RestTestClient</code> with <code>@AutoConfigureRestTestClient</code>. See <a href="boot-testing.html">Testing in Boot</a>.' },
    { trap: 'Undertow is not an option any more', code: `<artifactId>spring-boot-starter-undertow</artifactId>   <!-- Boot 4: no such starter -->`, lang: 'text', why: 'Boot 4 needs Servlet 6.1. Undertow does not support it, so Boot dropped the starter and the embedded-server support.', fix: 'Use Tomcat 11 (default) or Jetty 12.1 (<code>spring-boot-starter-jetty</code>). Re-test anything tuned for Undertow: thread pools, access logs, HTTP/2 settings.' },
    { trap: 'The built-in @Retryable is not Spring Retry’s @Retryable', code: `@Retryable(maxAttempts = 3)   // Spring Retry: 3 calls in total
@Retryable(maxRetries = 3)    // Framework 7: 1 call + 3 retries = 4 calls`, why: 'Framework 7 ships its own <code>@Retryable</code> and <code>@ConcurrencyLimit</code> in <code>spring-context</code>, switched on with <code>@EnableResilientMethods</code>. The attributes differ, and when retries run out the last exception is thrown to the caller. Boot 4 also stopped managing the Spring Retry version.', fix: 'Pick one. For the built-in one, check the import (<code>org.springframework.resilience.annotation</code>) and recount attempts. If you stay on Spring Retry, declare its version yourself. Circuit breakers still need a library, see <a href="resilience.html">Resilience patterns</a>.' },
    { trap: 'Renamed properties are silently ignored', code: `management.tracing.enabled=false          # Boot 4: management.tracing.export.enabled
spring.data.mongodb.uri=mongodb://…       # Boot 4: spring.mongodb.uri
spring.session.redis.namespace=app        # Boot 4: spring.session.data.redis.namespace`, lang: 'text', why: 'An unknown property is not an error. The app starts with the default instead.', fix: 'Add <code>spring-boot-properties-migrator</code> at runtime scope during the upgrade. It logs each renamed key and maps it for now. Remove it when the log is clean.' },
    { trap: 'Defaults that moved', why: 'Liveness and readiness probes are on by default, not only on Kubernetes. DevTools live reload is off by default. <code>spring-boot-starter-batch</code> keeps job metadata in memory. Fully executable jars (the embedded launch script) are gone.', fix: 'Read the migration guide once, top to bottom. For Batch with a database, use <code>spring-boot-starter-batch-jdbc</code>. Run the jar with <code>java -jar</code> or a container image.' }
  ],
  scenarios: [
    { title: 'After the 4.0 upgrade the app starts, then every query fails',
      symptom: 'A new environment comes up green. The first request fails with <code>relation "orders" does not exist</code>. Existing environments are fine.',
      diagnose: `./mvnw dependency:tree | grep -i flyway
# [INFO] +- org.flywaydb:flyway-core:jar:…:compile
# [INFO] +- org.flywaydb:flyway-database-postgresql:jar:…:runtime
#          (no org.springframework.boot:spring-boot-flyway)

java -jar app.jar --debug | grep -i Flyway      # nothing: the auto-configuration is not a candidate`,
      cause: 'The service depended on <code>flyway-core</code> only. In Boot 3 that triggered Flyway’s auto-configuration. In Boot 4 it lives in the <code>spring-boot-flyway</code> module, which nobody added. Migrations never ran. Old databases already had the schema, so only the new one failed.',
      fix: 'Add the Flyway starter. Make “schema is at the expected version” part of readiness, so a missing migration blocks the rollout.',
      fixCode: `<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-flyway</artifactId>
</dependency>`, lang: 'text' },
    { title: 'Mobile clients get snake_case back as camelCase',
      symptom: 'After the upgrade, <code>GET /orders/42</code> returns <code>"createdAt"</code> instead of <code>"created_at"</code>. No test failed, because the tests built their own mapper.',
      diagnose: `./mvnw dependency:tree -Dincludes=tools.jackson.core,com.fasterxml.jackson.core
# +- tools.jackson.core:jackson-databind:jar:3.0.x                 <-- used by Spring MVC
# \\- com.fasterxml.jackson.core:jackson-databind:jar:2.x          <-- from a vendor SDK

@Bean ObjectMapper objectMapper() { … }    // imports com.fasterxml.jackson.databind.ObjectMapper`,
      cause: 'The naming strategy was set on a Jackson 2 <code>ObjectMapper</code> bean. A vendor SDK still pulls Jackson 2, so the class compiled. Boot 4’s MVC converters use the Jackson 3 <code>JsonMapper</code>, which never saw the setting.',
      fix: 'Configure Jackson 3. Add a contract test that goes through MockMvc or a real HTTP call, so the real converters are used.',
      fixCode: `# application.yml: the simplest fix
spring:
  jackson:
    property-naming-strategy: SNAKE_CASE

# or in code:
# @Bean JsonMapperBuilderCustomizer naming() {
#   return builder -> builder.propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE);
# }`, fixLang: 'yaml' },
    { title: 'API versioning switched on: old clients get 400',
      symptom: 'The team adds <code>@GetMapping(version = "2")</code> next to the old handler and sets a version header. Clients that send no header start getting <code>400 Bad Request</code>.',
      diagnose: `spring:
  mvc:
    apiversion:
      use:
        header: X-Version        # versioning is now on for every mapping

# curl -i localhost:8080/orders/42
# HTTP/1.1 400      (MissingApiVersionException)`,
      cause: 'Once versioning is enabled, a version is <b>required</b> by default. A request without one is rejected, even for handlers that declare no version.',
      fix: 'Set a default version for clients that send none. Roll the header out to clients before you make it mandatory.',
      fixCode: `spring:
  mvc:
    apiversion:
      default: 1.0.0             # used when the request carries no version
      use:
        header: X-Version`, lang: 'yaml' }
  ],
  puzzles: [
    { kind: 'concept', q: 'What is the minimum Java version for Spring Boot 4.0?', options: ['17', '21', '25', '11'], answer: 0, explain: 'Framework 7 and Boot 4 kept the <b>Java 17</b> baseline. Java 25 is supported and recommended as the latest LTS, but not required. What moved is the Jakarta EE baseline (EE 11, Servlet 6.1) and, for native images, GraalVM 25+.' },
    { kind: 'concept', q: 'Framework 7 API versioning. A request arrives with version 1.3. Which handler runs?', code: `@RestController
@RequestMapping("/account/{id}")
class AccountController {
  @GetMapping                    Account a() { … }   // (1)
  @GetMapping(version = "1.1")   Account b() { … }   // (2)
  @GetMapping(version = "1.2+")  Account c() { … }   // (3)
  @GetMapping(version = "1.5")   Account d() { … }   // (4)
}`, options: ['(1): no version always wins', '(2): the closest lower fixed version', '(3): the baseline 1.2+ covers 1.3', '400: 1.3 is not declared anywhere'], answer: 2, explain: 'A fixed version such as <code>"1.1"</code> matches only itself. A <b>baseline</b> such as <code>"1.2+"</code> matches 1.2 and later versions, until a higher mapping takes over (here 1.5). A mapping with no version matches anything but has the lowest priority.' },
    { kind: 'concept', q: 'Framework 7’s built-in retry. The method always throws. How many times does it run?', code: `@Retryable(maxRetries = 3, delay = 100)
public void sendNotification() { throw new MessageDeliveryException("down"); }`, options: ['3', '4', '1: retries need Spring Retry on the classpath', 'Until it succeeds'], answer: 1, explain: '<code>maxRetries</code> counts <b>retries</b>, not attempts: 1 first call + 3 retries = <b>4</b>. Then the last exception is thrown to the caller. Spring Retry’s <code>maxAttempts = 3</code> means 3 calls in total. The annotation only works after <code>@EnableResilientMethods</code>, and only through the proxy.' },
    { kind: 'concept', q: 'Boot 4, Jackson 3. Which import is still correct?', options: ['<code>com.fasterxml.jackson.databind.ObjectMapper</code>', '<code>com.fasterxml.jackson.annotation.JsonProperty</code>', '<code>com.fasterxml.jackson.core.JsonProcessingException</code>', '<code>org.springframework.boot.jackson.JsonComponent</code>'], answer: 1, explain: 'Jackson 3 moved to the <code>tools.jackson</code> group and package, <b>except</b> the annotations, which stay in <code>com.fasterxml.jackson.annotation</code>. On the Boot side, <code>@JsonComponent</code> became <code>@JacksonComponent</code> and <code>@JsonMixin</code> became <code>@JacksonMixin</code>.' },
    { kind: 'concept', q: 'Which embedded servlet containers does Boot 4 support?', options: ['Tomcat, Jetty and Undertow', 'Tomcat and Jetty', 'Tomcat only', 'Jetty and Netty'], answer: 1, explain: 'Boot 4 needs Servlet 6.1: Tomcat 11 and Jetty 12.1. Undertow has no Servlet 6.1 support, so its starter was removed. Reactor Netty is for WebFlux, not servlet apps.' },
    { kind: 'concept', q: 'You upgrade to Boot 4 and replace <code>spring-boot-starter-web</code> with <code>spring-boot-starter-webmvc</code>. The app has <code>liquibase-core</code> as a plain dependency. What happens at startup?', options: ['Liquibase runs as before', 'Startup fails: Liquibase needs a starter', 'The app starts, but Liquibase’s auto-configuration is not there, so no changelog runs', 'Boot falls back to Flyway'], answer: 2, explain: 'Boot 4 has one module per technology. Without <code>spring-boot-starter-liquibase</code> (or the classic starter) the Liquibase auto-configuration is not on the classpath. There is no error. Silent absence is the main trap of the modular layout.' },
    { kind: 'concept', q: 'Boot 4.1: <code>spring.datasource.connection-fetch=lazy</code>. What changes?', options: ['Hikari opens its pool only on the first request', 'A transaction takes a pooled connection only when a statement actually needs it', 'Entities are loaded lazily by default', 'The DataSource bean is created lazily'], answer: 1, explain: 'Boot wraps the pooled DataSource in a <code>LazyConnectionDataSourceProxy</code>. A <code>@Transactional</code> method that returns from a cache, or fails validation first, never borrows a connection. That eases pool pressure, see <a href="hikari-pooling.html">HikariCP & connection pools</a>.' }
  ],
  interview: [
    { q: 'What are the headline changes in Spring Boot 4 and Framework 7?', a: '<ul><li><b>Baseline</b>: Java 17+ (25 recommended), Jakarta EE 11, Servlet 6.1, Kotlin 2.2, GraalVM 25 for native.</li><li><b>Modules</b>: one module and one starter per technology, instead of one large auto-configure jar.</li><li><b>Libraries</b>: Jackson 3, Hibernate 7, Spring Security 7, Spring Data 2025.1, Tomcat 11, Jetty 12.1, JUnit 6, Testcontainers 2.</li><li><b>Null-safety</b>: JSpecify annotations across the portfolio.</li><li><b>New</b>: API versioning, <code>@Retryable</code> / <code>@ConcurrencyLimit</code>, HTTP service client groups, <code>JmsClient</code>, <code>RestTestClient</code>, an OpenTelemetry starter.</li><li><b>Removed</b>: Undertow, executable launch scripts, <code>@MockBean</code>, everything deprecated in 3.x.</li></ul>', lvl: 'core' },
    { q: 'Did the Java baseline change? What about Jakarta EE?', a: '<p>Java stayed at 17. Jakarta EE moved from 9/10 to <b>11</b>: Servlet 6.1, JPA 3.2, Bean Validation 3.1. The package names are still <code>jakarta.*</code>, so there is no second rename. Framework 7 also dropped support for <code>javax.annotation</code> and <code>javax.inject</code> annotations: use <code>jakarta.annotation.PostConstruct</code> and <code>jakarta.inject.Inject</code>.</p>', lvl: 'core' },
    { q: 'What does “Boot 4 is modularised” mean, and why did they do it?', a: '<p>Boot 3 shipped nearly all auto-configuration in one jar. Boot 4 splits it by technology: module <code>spring-boot-&lt;tech&gt;</code>, package <code>org.springframework.boot.&lt;tech&gt;</code>, starter <code>spring-boot-starter-&lt;tech&gt;</code>, and a matching <code>-test</code> starter. You get a smaller classpath and clearer ownership. The cost: a library alone no longer switches its auto-configuration on. Some starters were renamed, for example <code>spring-boot-starter-web</code> → <code>spring-boot-starter-webmvc</code> and <code>spring-boot-starter-aop</code> → <code>spring-boot-starter-aspectj</code>. The old names are deprecated.</p>', fu: 'How do you soften the migration? (<code>spring-boot-starter-classic</code> and <code>spring-boot-starter-test-classic</code> bring every module. Use them first, remove them later.)', lvl: 'core' },
    { q: 'How do you migrate from Jackson 2 to Jackson 3?', a: '<ol><li>Change imports from <code>com.fasterxml.jackson</code> to <code>tools.jackson</code>. Leave annotation imports alone.</li><li>Replace <code>Jackson2ObjectMapperBuilderCustomizer</code> with <code>JsonMapperBuilderCustomizer</code>. Define a <code>JsonMapper</code> bean, not an <code>ObjectMapper</code> bean, if you replace the mapper.</li><li>Rename properties: <code>spring.jackson.read.*</code> → <code>spring.jackson.json.read.*</code>, same for <code>write</code>.</li><li><code>@JsonComponent</code> → <code>@JacksonComponent</code>, <code>@JsonMixin</code> → <code>@JacksonMixin</code>.</li><li>Set <code>spring.jackson.use-jackson2-defaults=true</code> if you need the old default behaviour for a while.</li></ol><p>If a library still needs Jackson 2, both can live side by side. The deprecated <code>spring-boot-jackson2</code> module with <code>spring.jackson2.*</code> properties is the stopgap.</p>', lvl: 'deep' },
    { q: 'What is JSpecify, and what does it change for you?', a: '<p>JSpecify is a common set of nullness annotations. Framework 7 and the rest of the portfolio use <code>org.jspecify.annotations.Nullable</code> and <code>@NullMarked</code> instead of Spring’s own <code>org.springframework.lang</code> annotations, which followed JSR 305 and are now deprecated. JSpecify can also describe generics, arrays and varargs. In Java nothing changes at run time. Null-checking build tools and <b>Kotlin</b> see more precise types, so some code needs a <code>?</code> or a null check to compile.</p>', lvl: 'deep' },
    { q: 'How does API versioning work in Framework 7 and Boot 4?', a: '<p>You declare the version on the mapping: <code>@GetMapping(version = "1.1")</code>, or a baseline <code>"1.2+"</code>. You tell Spring where the version comes from: a header, a query parameter, a media-type parameter or a path segment. In Boot, <code>spring.mvc.apiversion.use.header=X-Version</code> and <code>spring.mvc.apiversion.default=1.0.0</code>, or override <code>configureApiVersioning</code> in a <code>WebMvcConfigurer</code>. Versions are parsed as semantic versions. A missing or unsupported version is a 400. A deprecation handler can add <code>Deprecation</code> and <code>Sunset</code> response headers. <code>RestClient</code>, <code>WebClient</code> and HTTP service clients can send the version too.</p>', fu: 'WebFlux? (The same model, with <code>spring.webflux.apiversion.*</code>.)', lvl: 'deep' },
    { q: 'Built-in retry vs Spring Retry vs Resilience4j: what do you use now?', a: '<ul><li><b>Framework 7</b>: <code>@Retryable</code> (with <code>maxRetries</code>, <code>delay</code>, <code>multiplier</code>, <code>jitter</code>, <code>maxDelay</code>, <code>includes</code>/<code>excludes</code>), <code>@ConcurrencyLimit</code>, and a programmatic <code>RetryTemplate</code> in <code>org.springframework.core.retry</code>. Enable the annotations with <code>@EnableResilientMethods</code>. With <code>@Transactional</code>, retry sits outside, so every attempt gets a new transaction.</li><li><b>Spring Retry</b>: the older, separate project. Boot 4 no longer manages its version.</li><li><b>Resilience4j</b>: still the choice for circuit breakers, rate limiters, bulkheads and time limiters.</li></ul>', lvl: 'core' },
    { q: 'Why was Undertow dropped, and what else was removed?', a: '<p>Boot 4 requires Servlet 6.1 and Undertow does not support it. Also removed: fully executable jars (the embedded launch script), the classic jar loader, <code>@MockBean</code>/<code>@SpyBean</code>, reactive Pulsar auto-configuration, and direct support for Spring Session Hazelcast and MongoDB (those projects are now led by their vendors). On the Framework side: <code>ListenableFuture</code>, OkHttp 3 support, suffix-pattern and trailing-slash matching options, and <code>spring-jcl</code>.</p>', lvl: 'deep' },
    { q: 'What changed for tests?', a: '<ul><li><code>@MockBean</code> / <code>@SpyBean</code> → <code>@MockitoBean</code> / <code>@MockitoSpyBean</code>.</li><li><code>@SpringBootTest</code> no longer provides <code>TestRestTemplate</code> on its own: add <code>@AutoConfigureTestRestTemplate</code>, or use the new <code>RestTestClient</code>.</li><li>Test starters are per technology, for example <code>spring-boot-starter-security-test</code> for <code>@WithMockUser</code>.</li><li>JUnit 6 is the baseline. JUnit 4 support in the Spring TestContext framework is deprecated.</li><li>Framework 7 can pause cached test contexts that are not in use.</li></ul>', lvl: 'core' },
    { q: 'What did Boot 4.1 add?', a: '<ul><li><b>gRPC</b>: auto-configuration for Spring gRPC servers and clients, standalone on Netty or through the servlet stack over HTTP/2.</li><li><b>SSRF mitigation</b>: blocking and reactive HTTP clients accept an <code>InetAddressFilter</code> that blocks outgoing requests to chosen addresses.</li><li><b>Lazy JDBC connections</b>: <code>spring.datasource.connection-fetch=lazy</code>.</li><li><b>Observability</b>: context propagation for <code>@Async</code>, more OpenTelemetry properties, SSL bundles for OTLP exporters.</li><li><b>Smaller items</b>: <code>@RedisListener</code> endpoint auto-configuration, SpEL-based JWT authority mapping for resource servers, Log4j file rotation, a Spring Batch MongoDB starter.</li><li><b>Upgrade notes</b>: APIs deprecated in 4.0 are removed, Derby support is deprecated, jOOQ 3.20+ is required.</li></ul>', lvl: 'deep' },
    { q: 'How would you plan a Boot 3 → 4 upgrade for a real service?', a: '<ol><li>Move to the latest 3.5.x. Remove every use of deprecated APIs. Replace <code>@MockBean</code> now: <code>@MockitoBean</code> exists since 3.4.</li><li>Check that your other dependencies have Boot 4 lines (Spring Cloud, vendor starters, anything touching Jackson or Hibernate).</li><li>Switch the parent to 4.0.x with the <b>classic</b> starters and <code>spring-boot-properties-migrator</code>. Get it compiling: Jackson imports, moved packages, removed classes.</li><li>Run the full test suite and compare the condition evaluation report with the old one.</li><li>Replace the classic starters with per-technology starters. Diff the report again.</li><li>Roll out behind a canary. Watch JSON contracts, health groups and startup time.</li><li>Then 4.1, then adopt new features.</li></ol>', lvl: 'deep' }
  ],
  code: [
    { title: 'pom.xml: before and after', lang: 'text', code: `<!-- Boot 3.5 -->
<parent>… <artifactId>spring-boot-starter-parent</artifactId> <version>3.5.x</version> </parent>
<dependencies>
  <dependency>…<artifactId>spring-boot-starter-web</artifactId></dependency>
  <dependency>…<artifactId>spring-boot-starter-aop</artifactId></dependency>
  <dependency>…<artifactId>spring-boot-starter-oauth2-resource-server</artifactId></dependency>
  <dependency><groupId>org.flywaydb</groupId><artifactId>flyway-core</artifactId></dependency>
  <dependency>…<artifactId>spring-boot-starter-test</artifactId><scope>test</scope></dependency>
</dependencies>

<!-- Boot 4.x -->
<parent>… <artifactId>spring-boot-starter-parent</artifactId> <version>4.1.x</version> </parent>
<dependencies>
  <dependency>…<artifactId>spring-boot-starter-webmvc</artifactId></dependency>
  <dependency>…<artifactId>spring-boot-starter-aspectj</artifactId></dependency>
  <dependency>…<artifactId>spring-boot-starter-security-oauth2-resource-server</artifactId></dependency>
  <dependency>…<artifactId>spring-boot-starter-flyway</artifactId></dependency>
  <!-- test starters are per technology and bring spring-boot-starter-test with them -->
  <dependency>…<artifactId>spring-boot-starter-webmvc-test</artifactId><scope>test</scope></dependency>
  <dependency>…<artifactId>spring-boot-starter-security-test</artifactId><scope>test</scope></dependency>
</dependencies>`, note: 'The test starter names follow the documented pattern <code>spring-boot-starter-&lt;technology&gt;-test</code>. While migrating, <code>spring-boot-starter-classic</code> and <code>spring-boot-starter-test-classic</code> replace the whole list.' },
    { title: 'API versioning', lang: 'java', code: `@RestController
@RequestMapping("/orders/{id}")
class OrderController {

  @GetMapping(version = "1")               // exactly version 1
  OrderV1 getV1(@PathVariable long id) { … }

  @GetMapping(version = "2+")              // version 2 and later
  OrderV2 getV2(@PathVariable long id) { … }
}

// application.yml
// spring:
//   mvc:
//     apiversion:
//       default: 1.0.0        # for clients that send no version
//       use:
//         header: X-Version

// or in code, when you need more than one source or a custom order:
@Configuration
class WebConfig implements WebMvcConfigurer {
  @Override
  public void configureApiVersioning(ApiVersionConfigurer configurer) {
    configurer.useRequestHeader("X-Version");
  }
}`, note: 'Versions are parsed as semantic versions, so <code>"1"</code> is 1.0.0. See <a href="mvc-request-flow.html">Spring MVC request flow</a> for where mapping happens.' },
    { title: 'Built-in retry and concurrency limit', lang: 'java', code: `import org.springframework.resilience.annotation.ConcurrencyLimit;
import org.springframework.resilience.annotation.EnableResilientMethods;
import org.springframework.resilience.annotation.Retryable;

@Configuration
@EnableResilientMethods
class ResilienceConfig {}

@Service
class NotificationService {

  @Retryable(includes = MessageDeliveryException.class,
             maxRetries = 4, delay = 100, jitter = 10, multiplier = 2, maxDelay = 1000)
  public void send(Notification n) { gateway.deliver(n); }   // 1 call + up to 4 retries

  @ConcurrencyLimit(10)                                      // at most 10 callers inside at once
  public Report render(long id) { return slowRenderer.render(id); }
}

// programmatic, no proxy involved
var policy = RetryPolicy.builder()
    .includes(MessageDeliveryException.class)
    .maxRetries(4)
    .delay(Duration.ofMillis(100))
    .multiplier(2)
    .maxDelay(Duration.ofSeconds(1))
    .build();
var retryTemplate = new RetryTemplate(policy);               // org.springframework.core.retry`, note: 'The annotations are proxy-based, so the self-invocation trap applies: see <a href="aop-proxies.html">AOP & proxies</a>. No circuit breaker here; for that see <a href="resilience.html">Resilience patterns</a>.' },
    { title: 'application.yml for Boot 4.x', lang: 'yaml', code: `spring:
  jackson:
    use-jackson2-defaults: true        # 4.0: keep Jackson 2 default behaviour during migration
    # 4.0: spring.jackson.read.* / write.* keys moved to spring.jackson.json.read.* / json.write.*
  datasource:
    connection-fetch: lazy             # 4.1: borrow a connection only when a statement needs it
  threads:
    virtual:
      enabled: true                    # since 3.2, unchanged

management:
  tracing:
    export:
      enabled: true                    # 4.0: was management.tracing.enabled
  endpoint:
    health:
      probes:
        enabled: true                  # 4.0: now the default everywhere, not only on Kubernetes`, note: 'Add <code>spring-boot-properties-migrator</code> while upgrading. It reports every key that was renamed.' }
  ]
});

IA.register({
  track: 'spring',
  slug: 'boot-testing',
  title: 'Testing in Boot',
  tagline: 'A Spring test is only as fast as the <b>number of application contexts</b> it builds. Slices load a thin layer, <code>@MockitoBean</code> swaps one bean, Testcontainers gives you a real Postgres, and the <b>context cache</b> decides whether all of that happens once or forty times.',
  tldr: {
    problem: 'Suites that take 20 minutes, tests that pass against H2 and fail against Postgres, and “green” <code>@Transactional</code> tests that never sent an INSERT to the database.',
    model: 'Each test class asks the TestContext framework for a context. The request is reduced to a <b>key</b> (config classes, profiles, properties, mocks, customizers). Same key → reuse the cached context. New key → build another one, with its own beans, Hikari pool and connections.',
    hook: '“Why is our suite slow?” Count the contexts. Every distinct set of <code>@MockitoBean</code>s, profiles or properties is another full Spring startup.',
    facts: [
      { v: '32', l: 'contexts kept by default in the TestContext cache (<code>spring.test.context.cache.maxSize</code>), evicted least-recently-used' },
      { v: 'Boot 3.4', l: '<code>@MockBean</code> / <code>@SpyBean</code> deprecated in favour of Spring Framework 6.2’s <code>@MockitoBean</code> / <code>@MockitoSpyBean</code>' },
      { v: 'Boot 3.1', l: '<code>@ServiceConnection</code> turns a Testcontainers container into connection details, replacing hand-written <code>@DynamicPropertySource</code>' }
    ]
  },
  intro: {
    what: 'A Spring Boot app is a big graph of objects (“beans”) wired together at startup. A test can start <b>all</b> of it (<code>@SpringBootTest</code>), or only one layer, such as the web layer or the JPA layer (a <b>test slice</b>). Beans the test doesn’t want to run for real, like a payment client, are replaced with <b>mocks</b>. For the database you start a throwaway real Postgres in Docker with <b>Testcontainers</b>.',
    analogy: { icon: '🎭', title: 'A theatre rehearsal', text: 'A full dress rehearsal (<code>@SpringBootTest</code>) needs every actor, the set and the lights, so you can’t do it often. A scene rehearsal (a slice) needs only the actors in that scene; a stand-in (a mock) reads the lines of anyone missing. And if the stage is already set up from the previous rehearsal, you don’t tear it down and rebuild it: that is the context cache.' },
    steps: [
      { t: 'Pick the smallest slice that proves the point', d: 'Controller logic and JSON? <code>@WebMvcTest</code>. Queries and mappings? <code>@DataJpaTest</code>. Wiring and end-to-end flow? <code>@SpringBootTest</code>.' },
      { t: 'Mock what you don’t own', d: 'In a slice, the beans outside it don’t exist. Supply them with <code>@MockitoBean</code> (Boot 3.4+), or <code>@MockBean</code> on older versions.', code: '@WebMvcTest(OrderController.class)\nclass OrderControllerTest {\n  @Autowired MockMvcTester mvc;\n  @MockitoBean OrderService orders;   // replaces the real bean\n}' },
      { t: 'Use a real database', d: 'H2 isn’t Postgres: no <code>jsonb</code>, different locking, different SQL. A container with <code>@ServiceConnection</code> wires the URL, user and password for you.' },
      { t: 'Keep configurations identical', d: 'Tests that share the same annotations share one cached context. Put the common setup in a base class or a meta-annotation and the suite starts Spring once.' }
    ],
    widget: 'boot-testing-intro',
    terms: [
      ['ApplicationContext', 'The container holding every bean. Building one is what makes Spring tests slow.'],
      ['test slice', 'An annotation such as <code>@WebMvcTest</code> that auto-configures only one layer.'],
      ['@MockitoBean', 'Replaces (or adds) a bean in the test context with a Mockito mock. Reset after each test.'],
      ['Testcontainers', 'A library that starts Docker containers (Postgres, Kafka…) from a test and cleans them up.'],
      ['@ServiceConnection', 'Tells Boot to read the connection details (JDBC URL, credentials) from the container.'],
      ['context cache', 'A static, per-JVM map from configuration key to started context, shared by all test classes.']
    ]
  },
  visual: {
    title: 'Watch the context cache: hits, misses and dead containers',
    caption: 'Pick a suite and press Play. Each test class computes a cache key from its annotations. A <b>miss</b> builds a new context (and opens another Hikari pool to Postgres); a <b>hit</b> reuses one. The third suite shows what happens when a cached context outlives its container.'
  },
  gotchas: [
    { trap: 'Every different @MockitoBean set is a new context',
      code: `class OrderApiIT  { @MockitoBean PaymentClient pay; }\nclass RefundApiIT { @MockitoBean PaymentClient pay;\n                    @MockitoBean EmailSender mail; }   // different key → 2nd context`,
      why: 'Bean overrides are part of the context cache key. Two classes that mock different beans can’t share a context, so each one pays the full startup and keeps its own pool open.',
      fix: 'Declare the mocks once in an abstract base class (or a meta-annotation) that all integration tests extend, even if a test doesn’t use every mock.' },
    { trap: '@DirtiesContext as a cleanup tool',
      why: 'It closes and evicts the context after the class (or method). The next class with the same key builds it again. Ten annotated classes = ten extra startups.',
      fix: 'Reset state instead: truncate tables in <code>@BeforeEach</code>, use <code>@Sql</code>, or rely on test-transaction rollback. Keep <code>@DirtiesContext</code> for tests that really mutate the context (for example, refreshing beans).' },
    { trap: '@Transactional test passes, production fails on the constraint',
      code: `@DataJpaTest\nclass OrderRepoTest {\n  @Test void dup() {\n    repo.save(new Order("A-1"));\n    repo.save(new Order("A-1"));   // unique(order_no)… test is green\n  } // rollback: no flush, INSERTs never sent (SEQUENCE ids)\n}`,
      why: 'With sequence-generated ids Hibernate defers INSERTs until flush. The test transaction rolls back at the end, and rollback doesn’t flush, so Postgres never sees the statement that would violate the constraint.',
      fix: 'Call <code>saveAndFlush</code> or <code>entityManager.flush()</code> in tests that assert on constraints, triggers or DB defaults. Assert with <code>assertThrows(DataIntegrityViolationException.class, …)</code>.' },
    { trap: 'RANDOM_PORT + @Transactional doesn’t roll back',
      why: 'With a real server the request runs on a Tomcat worker thread in its own transaction, which commits. The test’s transaction is on the JUnit thread and only rolls back what that thread did.',
      fix: 'Clean up explicitly (truncate in <code>@AfterEach</code>, or <code>@Sql(executionPhase = AFTER_TEST_METHOD)</code>). Use <code>MOCK</code> (the default) with MockMvc if you want the request in the test thread.' },
    { trap: 'Lazy loading works in the test, throws in production',
      why: 'The test method’s transaction keeps the persistence context open, so <code>order.getLines()</code> loads lazily. In production the service transaction has ended before the controller touches the collection.',
      fix: 'Test service methods without a surrounding test transaction, or call <code>TestTransaction.end()</code> before asserting. See <a href="jpa-n-plus-1.html">JPA fetching &amp; N+1</a>.' },
    { trap: 'H2 “compatibility mode” as a Postgres stand-in',
      why: 'H2 doesn’t implement <code>jsonb</code>, <code>ON CONFLICT</code> the same way, partial indexes, <code>SKIP LOCKED</code> semantics or Postgres error codes. Flyway migrations written for Postgres often won’t even run.',
      fix: 'Use <code>postgres:16</code> (your production major) in Testcontainers. Since Boot 3.4, <code>@DataJpaTest</code> detects a container-sourced database (e.g. via <code>@ServiceConnection</code>) and keeps it; on older versions add <code>@AutoConfigureTestDatabase(replace = NONE)</code> so Boot doesn’t swap in an embedded database.' },
    { trap: '@MockitoBean isn’t a drop-in for every @MockBean',
      why: '<code>@MockBean</code> could be declared on fields of <code>@Configuration</code> classes. The Framework’s bean-override annotations are resolved on <b>test classes</b> (fields, and their enclosing or super classes), not on configuration classes.',
      fix: 'Move such mocks into the test class or a shared base class. If you need a real stand-in object, use <code>@TestBean</code> with a static factory method.' }
  ],
  scenarios: [
    { title: 'CI integration tests fail with “too many clients already”',
      symptom: 'After a dozen new <code>*IT</code> classes, the pipeline started failing halfway through with <code>FATAL: sorry, too many clients already</code> from the shared Postgres service container.',
      diagnose: `# application-test.yml\nlogging.level.org.springframework.test.context.cache: DEBUG\n\n# CI log, near the end of the run:\n# Spring test ApplicationContext cache statistics:\n# [DefaultContextCache@1a2b size = 11, maxSize = 32, parentContextCount = 0,\n#  hitCount = 31, missCount = 11]`,
      diagnoseLang: 'yaml',
      cause: '11 different context keys (different mocks, profiles and inline properties), each kept alive in the cache with a Hikari pool of 10 connections. 11 × 10 = 110, more than Postgres’s default <code>max_connections = 100</code>.',
      fix: 'Unify configuration into one base class, so the suite builds 1–2 contexts. As a safety net, shrink the pool in tests and cap the cache.',
      fixCode: `# src/test/resources/application-test.yml\nspring:\n  datasource:\n    hikari:\n      maximum-pool-size: 4\n      minimum-idle: 1\n# junit-platform.properties or -D: spring.test.context.cache.maxSize=8`,
      fixLang: 'yaml' },
    { title: 'Second test class fails with “Connection refused” to a Testcontainers port',
      symptom: 'Each IT class passes on its own. Run together, the first class passes and the rest fail with <code>Connection to localhost:55021 refused</code>.',
      diagnose: `@Testcontainers\n@SpringBootTest\nabstract class AbstractIT {\n  @Container @ServiceConnection\n  static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16-alpine");\n}`,
      cause: 'The JUnit <code>@Testcontainers</code> extension starts static <code>@Container</code> fields before a class and <b>stops</b> them after it. The Spring context is cached across classes, so the second class reuses a context whose DataSource points at the stopped container’s mapped port.',
      fix: 'Tie the container’s lifecycle to the Spring context, not to the test class: declare it as a <code>@Bean</code> with <code>@ServiceConnection</code> (Boot 3.1+). Boot starts it before the DataSource and stops it when the context closes.',
      fixCode: `@TestConfiguration(proxyBeanMethods = false)\nclass Containers {\n  @Bean @ServiceConnection\n  PostgreSQLContainer<?> postgres() {\n    return new PostgreSQLContainer<>("postgres:16-alpine");\n  }\n}\n\n@SpringBootTest @Import(Containers.class)\nabstract class AbstractIT { }` },
    { title: 'Payment test “passes” but charges are sent twice in staging',
      symptom: 'A test asserts that <code>pay.charge()</code> is called once. In staging an order is charged twice after a retry.',
      diagnose: `@SpringBootTest @Transactional\nclass CheckoutIT {\n  @MockitoBean PaymentClient pay;\n  @Test void chargesOnce() {\n    checkout.place(cmd);\n    verify(pay, times(1)).charge(any());\n  }\n}`,
      cause: 'The charge happens in a <code>@TransactionalEventListener(phase = AFTER_COMMIT)</code>. The test’s transaction never commits, so the listener never runs; the single call came from a different code path. The retry duplication lived in the listener.',
      fix: 'Commit inside the test with <code>TestTransaction</code>, or drop <code>@Transactional</code> from the test and clean up data explicitly. Then assert on what happens after commit.',
      fixCode: `checkout.place(cmd);\nTestTransaction.flagForCommit();\nTestTransaction.end();          // AFTER_COMMIT listeners run here\nverify(pay, times(1)).charge(any());` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Two test classes, otherwise identical <code>@SpringBootTest</code>s. How many application contexts does the run build?', code: `@SpringBootTest class A { @MockitoBean PaymentClient pay; }\n@SpringBootTest class B { @MockitoBean PaymentClient pay;\n                          @MockitoBean EmailSender mail; }\n@SpringBootTest class C { @MockitoBean PaymentClient pay; }`, options: ['1', '2', '3', '1, but B’s mocks leak into A'], answer: 1, explain: 'Bean overrides are part of the cache key. A and C share a key, so C reuses A’s context. B adds <code>EmailSender</code>, which is a different key, so it gets its own context: <b>2</b>.' },
    { kind: 'predict', q: 'The entity uses <code>@GeneratedValue(strategy = SEQUENCE)</code>. What does Postgres receive during this test?', code: `@DataJpaTest\nclass RepoTest {\n  @Test void roundTrip() {\n    var saved = repo.save(new Order("A-1"));\n    assertThat(repo.findById(saved.getId())).isPresent();\n  }   // test transaction rolls back\n}`, options: ['nextval, INSERT, SELECT', 'nextval only', 'INSERT and SELECT', 'nextval and INSERT, no SELECT'], answer: 1, explain: '<code>persist</code> needs an id, so Hibernate calls <code>nextval</code>, but the INSERT waits for a flush. <code>findById</code> is answered from the persistence context (first-level cache), so no SELECT and no auto-flush happen. Rollback doesn’t flush, so the INSERT is never sent. With <code>IDENTITY</code>, the INSERT would be sent immediately.' },
    { kind: 'predict', q: 'What happens when this test runs?', code: `@WebMvcTest(OrderController.class)\nclass OrderControllerTest {\n  @Autowired MockMvcTester mvc;\n  // OrderController has a constructor dependency on OrderService (@Service)\n  @Test void get() { assertThat(mvc.get().uri("/orders/1")).hasStatusOk(); }\n}`, options: ['Passes: Boot scans the @Service', 'Context fails: no OrderService bean', 'Returns 500 because the service is null', 'Returns 404'], answer: 1, explain: '<code>@WebMvcTest</code> only picks up web components (controllers, advice, filters, converters, <code>WebMvcConfigurer</code>…). <code>@Service</code> beans aren’t loaded, so constructor injection fails and the context doesn’t start (<code>UnsatisfiedDependencyException</code>). Add <code>@MockitoBean OrderService</code>.' },
    { kind: 'predict', q: 'After this test finishes, is the row still in Postgres?', code: `@SpringBootTest(webEnvironment = RANDOM_PORT)\n@Transactional\nclass OrderHttpIT {\n  @Autowired TestRestTemplate http;\n  @Test void create() {\n    http.postForEntity("/orders", new CreateOrder("A-1"), Void.class);\n  }\n}`, options: ['No: the test transaction rolls it back', 'Yes: the server thread committed its own transaction', 'No: TestRestTemplate joins the test transaction', 'It depends on isolation level'], answer: 1, explain: 'The HTTP request is handled by an embedded server thread. Its service transaction commits independently. The test-managed transaction is bound to the JUnit thread and has nothing to roll back. You need explicit cleanup.' },
    { kind: 'concept', q: 'Which change in Boot 3.4 / Framework 6.2 explains the new mock annotation?', options: ['Mockito 5 removed @MockBean', 'Bean overriding moved into the TestContext framework: @MockitoBean, @MockitoSpyBean, @TestBean', '@MockBean only works with JUnit 4', 'Boot dropped Mockito for EasyMock'], answer: 1, explain: 'Spring Framework 6.2 added a general <b>bean override</b> mechanism to the TestContext framework, with <code>@MockitoBean</code>, <code>@MockitoSpyBean</code> and <code>@TestBean</code>. Boot 3.4 deprecated its own <code>@MockBean</code>/<code>@SpyBean</code> in favour of them.' },
    { kind: 'concept', q: 'A suite has 40 <code>@SpringBootTest</code> classes, each with <code>@DirtiesContext</code> and the same configuration. How many contexts get built?', options: ['1', '2', '32 (cache max)', '40'], answer: 3, explain: '<code>@DirtiesContext</code> (default: after the class) closes and evicts the context, so each of the 40 classes starts a fresh one. The cache never gets a hit.' },
    { kind: 'concept', q: 'What does <code>@ServiceConnection</code> on a <code>PostgreSQLContainer</code> actually produce?', options: ['A <code>spring.datasource.url</code> entry in application.yml', 'A <code>JdbcConnectionDetails</code> bean that the DataSource auto-configuration uses', 'An H2 DataSource in Postgres mode', 'A JNDI binding'], answer: 1, explain: 'Boot 3.1 introduced <code>ConnectionDetails</code> abstractions. <code>@ServiceConnection</code> registers a <code>JdbcConnectionDetails</code> (or <code>R2dbcConnectionDetails</code>) built from the running container, and it takes precedence over <code>spring.datasource.*</code> properties.' }
  ],
  interview: [
    { q: 'When do you use a test slice instead of @SpringBootTest?', a: '<p>When the behaviour under test lives in one layer. <code>@WebMvcTest</code> checks mapping, validation, status codes and JSON without a database. <code>@DataJpaTest</code> checks queries and mappings against a real schema. <code>@SpringBootTest</code> is for wiring and end-to-end flows. Slices start faster and fail for the right reasons, but each slice is a separate context, so don’t build a dozen variants.</p>', fu: 'What does @DataJpaTest add by default? (Test-managed transactions that roll back, SQL logging, an embedded DB replacement unless told otherwise, Flyway/Liquibase.)', lvl: 'core' },
    { q: 'How does the Spring test context cache work, and what goes into the key?', a: '<p>The TestContext framework keeps a static map per JVM (per test fork) from a <code>MergedContextConfiguration</code> to a started context. The key includes the configuration classes or locations, initializers, active profiles, property sources and inline properties, the parent, the context loader and <b>context customizers</b>, which is where Boot’s slices, <code>@MockitoBean</code>s and <code>@ServiceConnection</code> fields live. The default size limit is 32, with LRU eviction. <code>@DirtiesContext</code> removes an entry.</p>', fu: 'How do you see it? (DEBUG on org.springframework.test.context.cache prints hit/miss counts.)', lvl: 'deep' },
    { q: '@MockBean vs @MockitoBean: what changed and what breaks on migration?', a: '<p>Boot 3.4 deprecated <code>@MockBean</code> and <code>@SpyBean</code>. Spring Framework 6.2 provides <code>@MockitoBean</code> and <code>@MockitoSpyBean</code> as part of a general bean-override feature (also <code>@TestBean</code>). They work in plain Spring tests too. Mocks are still reset after each test by default. Migration traps: they aren’t supported on fields in <code>@Configuration</code> classes, and spying needs an existing bean to wrap.</p>', lvl: 'core' },
    { q: 'Testcontainers: @DynamicPropertySource vs @ServiceConnection?', a: '<p><code>@DynamicPropertySource</code> registers properties (<code>spring.datasource.url</code>, user, password) from the container: it works everywhere, but you write and maintain the mapping. <code>@ServiceConnection</code> (Boot 3.1+) lets Boot create a <code>ConnectionDetails</code> bean from the container type or image name, for JDBC, R2DBC, Kafka, Redis, Mongo and more. Declare containers as <code>@Bean</code>s in a <code>@TestConfiguration</code> so their lifecycle follows the context.</p>', fu: 'How do you run the app locally against the same containers? (A test main: SpringApplication.from(App::main).with(Containers.class).run(args).)', lvl: 'core' },
    { q: 'Why can a @Transactional test give you false confidence?', a: '<ul><li>No commit: <code>AFTER_COMMIT</code> listeners, deferred constraints and commit-time triggers never run.</li><li>No flush: with sequence ids, INSERTs may never reach Postgres.</li><li>One persistence context: <code>findById</code> returns the same instance from the cache, not a fresh load, and lazy loading works where production would throw.</li><li>It hides missing <code>@Transactional</code> on the service, because the test already provides one.</li></ul>', lvl: 'deep' },
    { q: 'A 25-minute integration suite. How do you make it fast?', a: '<ol><li>Measure: enable cache DEBUG logging and count misses; profile one context’s startup.</li><li>Collapse configurations into one base class or meta-annotation (same mocks, profiles and properties).</li><li>Remove <code>@DirtiesContext</code>; reset data with SQL instead.</li><li>Start containers once per context, not per class.</li><li>Move logic tests to plain unit tests or slices.</li><li>Then parallelise forks (each fork has its own cache and its own containers).</li></ol>', lvl: 'deep' },
    { q: 'MOCK vs RANDOM_PORT web environments?', a: '<p><code>MOCK</code> (the default) creates a mock servlet environment: no port, requests go through MockMvc on the test thread, and a test transaction covers them. <code>RANDOM_PORT</code> starts the real embedded server: real filters, real HTTP, real serialization, but requests run on server threads and commit on their own.</p>', lvl: 'core' },
    { q: 'How would you test a REQUIRES_NEW audit write, or an after-commit listener?', a: '<p>Don’t wrap the test in <code>@Transactional</code>, or end the test transaction explicitly: <code>TestTransaction.flagForCommit(); TestTransaction.end();</code>. Then assert with a fresh query (a <code>JdbcTemplate</code> count). For async listeners use Awaitility rather than <code>Thread.sleep</code>.</p>', lvl: 'deep' },
    { q: 'What is MockMvcTester?', a: '<p>Added in Spring Framework 6.2 and auto-configured by Boot 3.4 when AssertJ is present. It wraps MockMvc with AssertJ-style assertions: <code>assertThat(mvc.get().uri("/orders/1")).hasStatusOk().bodyJson()…</code>. The classic <code>mockMvc.perform(...).andExpect(...)</code> style still works.</p>', lvl: 'core' },
    { q: 'Why not test against H2?', a: '<p>Because you are testing a different database. SQL dialect, <code>jsonb</code>, locking, isolation behaviour, error codes, index types and Flyway scripts all differ. A Postgres container starts in a few seconds, and with context caching you pay that once per configuration.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Containers as beans (Boot 3.1+)', lang: 'java', code: `@TestConfiguration(proxyBeanMethods = false)
public class Containers {
  @Bean @ServiceConnection            // → JdbcConnectionDetails
  PostgreSQLContainer<?> postgres() {
    return new PostgreSQLContainer<>("postgres:16-alpine");
  }
}

// One base class = one cache key = one context for the whole suite
@SpringBootTest
@Import(Containers.class)
@ActiveProfiles("test")
public abstract class AbstractIT {
  @MockitoBean protected PaymentClient payments;   // Boot 3.4+
  @MockitoBean protected EmailSender email;
}

// src/test/java: run the app locally against the same container
public class TestApp {
  public static void main(String[] args) {
    SpringApplication.from(App::main).with(Containers.class).run(args);
  }
}`, note: 'The container starts before the DataSource bean and stops when the context closes, so it lives exactly as long as the cached context.' },
    { title: '@WebMvcTest + MockMvcTester', lang: 'java', code: `@WebMvcTest(OrderController.class)
class OrderControllerTest {
  @Autowired MockMvcTester mvc;                // Framework 6.2 / Boot 3.4
  @MockitoBean OrderService orders;

  @Test void notFoundIsProblemDetail() {
    when(orders.find(42L)).thenThrow(new OrderNotFound(42L));
    assertThat(mvc.get().uri("/orders/42"))
        .hasStatus(HttpStatus.NOT_FOUND)
        .bodyJson().extractingPath("$.status").isEqualTo(404);
  }
}`, note: 'Security filter chains are included in <code>@WebMvcTest</code>; add <code>@WithMockUser</code> or import your security config.' },
    { title: '@DataJpaTest against Postgres', lang: 'java', code: `@DataJpaTest
@AutoConfigureTestDatabase(replace = Replace.NONE)   // needed before Boot 3.4; 3.4+ keeps a @ServiceConnection DB
@Import(Containers.class)
class OrderRepositoryTest {
  @Autowired OrderRepository repo;
  @Autowired TestEntityManager em;

  @Test void orderNoIsUnique() {
    repo.saveAndFlush(new Order("A-1"));
    assertThrows(DataIntegrityViolationException.class,
        () -> repo.saveAndFlush(new Order("A-1")));   // flush → INSERT → 23505
  }
}` },
    { title: 'Test config', lang: 'yaml', code: `# src/test/resources/application-test.yml
spring:
  datasource:
    hikari:
      maximum-pool-size: 4     # every cached context keeps its own pool
  jpa:
    properties:
      hibernate.format_sql: true
logging:
  level:
    org.springframework.test.context.cache: DEBUG   # hit/miss statistics
    org.hibernate.SQL: DEBUG                         # what Postgres receives` }
  ]
});

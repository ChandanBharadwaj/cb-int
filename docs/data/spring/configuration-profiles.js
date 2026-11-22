IA.register({
  track: 'spring',
  slug: 'configuration-profiles',
  title: '@Configuration & profiles',
  tagline: 'A <code>@Configuration</code> class is a factory written in Java. In <b>full</b> mode Spring subclasses it with CGLIB so that calling one <code>@Bean</code> method from another returns the shared bean. In <b>lite</b> mode it’s just a method call. <code>@Profile</code> and <code>@Conditional</code> decide which recipes are registered at all, and they are evaluated <i>in order</i>.',
  tldr: {
    problem: 'Two connection pools where you expected one, transactions that don’t cover your JDBC calls, a fake payment gateway active in staging, and a <code>@ConditionalOnBean</code> that never matches.',
    model: 'Configuration is processed in two steps: <b>parse and register definitions</b> (conditions and profiles are checked here, in processing order), then <b>create beans</b>. <code>proxyBeanMethods = true</code> (the default for <code>@Configuration</code>) routes inter-bean calls through the container; <code>false</code> makes them plain Java, so pass dependencies as <code>@Bean</code> method parameters instead.',
    hook: '“What’s the difference between @Configuration and @Component with @Bean methods?” The CGLIB proxy. Call <code>dataSource()</code> twice in full mode and you get one bean; in lite mode you get two objects.',
    facts: [
      { v: 'proxyBeanMethods', l: 'attribute added in Spring 5.2; Boot’s own auto-configurations set it to <code>false</code> to skip CGLIB' },
      { v: '&, |, !', l: 'operators allowed in <code>@Profile</code> expressions since Spring 5.1, e.g. <code>@Profile("prod & !eu")</code>' },
      { v: 'user config → auto-config', l: 'auto-configurations are imported by a <code>DeferredImportSelector</code>, so they are processed <b>after</b> your configuration classes' }
    ]
  },
  intro: {
    what: 'Sometimes you can’t put <code>@Component</code> on a class, because it comes from a library (a connection pool, an HTTP client). Instead you write a <b>configuration class</b> with <code>@Bean</code> methods: each method builds and returns one object, and Spring registers the result as a bean. <b>Profiles</b> let you switch whole sets of beans on or off per environment (<code>dev</code>, <code>prod</code>), and <b>conditions</b> do the same based on properties, classes on the classpath, or other beans.',
    analogy: { icon: '🏭', title: 'A factory floor with switches', text: 'Each <code>@Bean</code> method is a machine that produces one part. In full mode, a supervisor stands at every machine: if a second machine asks for “a DataSource”, the supervisor hands over the one already built instead of building another. Profiles are the breaker switches on the wall: flip “prod” and the test machines simply aren’t powered.' },
    steps: [
      { t: 'Write a @Bean method', d: 'The method name becomes the bean name. Parameters are injected like constructor arguments.', code: '@Configuration\nclass HttpConfig {\n  @Bean RestClient restClient(RestClient.Builder b) {\n    return b.baseUrl("https://api.example.com").build();\n  }\n}' },
      { t: 'Prefer parameters over method calls', d: 'Asking for a dependency as a parameter works in every mode. Calling another <code>@Bean</code> method only returns the shared bean in full mode.' },
      { t: 'Tag environment-specific beans', d: '<code>@Profile("dev")</code> on a class or <code>@Bean</code> method registers it only when that profile is active.', code: 'spring:\n  profiles:\n    active: dev', lang: 'yaml' },
      { t: 'Use conditions for “only if”', d: '<code>@ConditionalOnProperty</code>, <code>@ConditionalOnClass</code> and friends (Spring Boot) are checked when the definition is registered, before any bean is created.' }
    ],
    terms: [
      ['@Configuration', 'A class of <code>@Bean</code> methods. Proxied with CGLIB by default (“full mode”).'],
      ['lite mode', '<code>@Bean</code> methods in a <code>@Component</code> or in <code>@Configuration(proxyBeanMethods = false)</code>. No interception.'],
      ['@Profile', 'Register a bean only when certain profiles are active. Shorthand for a <code>@Conditional</code>.'],
      ['@Conditional', 'Register a definition only if a <code>Condition</code> class says yes.'],
      ['@Import', 'Pull other configuration classes, selectors or registrars into this one.'],
      ['default profile', 'The profile that is active when no other profile is.']
    ]
  },
  visual: {
    title: 'Count the connection pools',
    caption: 'The same three <code>@Bean</code> methods in three modes. Press Play and watch what happens when <code>jdbcTemplate()</code> and <code>txManager()</code> ask for the DataSource. In lite mode, look at which pool each bean ends up using.'
  },
  extras: [
    { id: 'configuration-profiles-conditions', title: 'Which definitions get registered?', label: 'Conditions', caption: 'Toggle the active profiles, one property and the classpath. Every row is a bean definition guarded by a profile or condition. Rows that flip are highlighted.' }
  ],
  gotchas: [
    { trap: 'Inter-bean calls in lite mode create new objects', code: `@Configuration(proxyBeanMethods = false)
class DbConfig {
  @Bean DataSource dataSource() { return new HikariDataSource(cfg); }
  @Bean JdbcTemplate jdbc() { return new JdbcTemplate(dataSource()); } // 2nd pool!
}`, why: 'Without the CGLIB subclass nothing intercepts <code>dataSource()</code>, so the body runs again and you get an unmanaged object, here a whole second connection pool.', fix: 'Declare dependencies as <code>@Bean</code> method parameters: <code>JdbcTemplate jdbc(DataSource ds)</code>. That works in both modes and is what Boot’s auto-configurations do.' },
    { trap: 'final classes, private or final @Bean methods in full mode', code: `@Configuration
final class AppConfig { … }          // "@Configuration class 'AppConfig' may not be final"

@Bean private Clock clock() { … }    // "@Bean method 'clock' must not be private or final"`, why: 'CGLIB proxies by subclassing and overriding. It can’t subclass a final class or override private or final methods.', fix: 'Remove <code>final</code>, or switch to <code>proxyBeanMethods = false</code> (which also suits records-of-config and native images) and use parameters.' },
    { trap: 'static @Bean methods are never intercepted', why: 'A static method can’t be overridden, so even in full mode a call to a static <code>@Bean</code> method from another <code>@Bean</code> method runs its body again.', fix: 'Use <code>static</code> only for BeanPostProcessor / BeanFactoryPostProcessor beans (so they don’t force early creation of the config class), and never call them directly.' },
    { trap: '@Profile("!prod") is true in staging, CI and on laptops', why: 'A negated profile matches whenever that profile isn’t active, including environments nobody thought about and the case where no profile is set at all.', fix: 'Opt in, don’t opt out: <code>@Profile({"dev", "test"})</code> for fakes. Fail fast if a required profile is missing (a condition, or a startup check).' },
    { trap: '@ConditionalOnBean in your own configuration', code: `@Configuration
@ConditionalOnBean(DataSource.class)   // evaluated before DataSourceAutoConfiguration
class ReportingConfig { … }`, why: 'Conditions are evaluated as definitions are registered. Your configuration classes are processed before auto-configurations, so Boot’s DataSource isn’t there yet. The result depends on processing order.', fix: 'Use <code>@ConditionalOnBean</code>/<code>@ConditionalOnMissingBean</code> only in auto-configuration classes, with explicit <code>after</code>/<code>before</code> ordering. In your app, use a property or class condition, or just inject <code>ObjectProvider</code>.' },
    { trap: 'Two definitions with the same bean name', code: `@Bean Clock clock() { … }     // in AppConfig
@Bean Clock clock() { … }     // in TestSupportConfig, accidentally scanned
// BeanDefinitionOverrideException: Invalid bean definition with name 'clock'`, why: 'Plain Spring lets a later definition silently replace an earlier one. Spring Boot sets <code>spring.main.allow-bean-definition-overriding=false</code> (since 2.1), so it fails instead.', fix: 'Rename one, or restructure so only one is imported. Don’t turn overriding back on to hide it; which one wins then depends on processing order.' },
    { trap: '@Bean return type hides the real type from early checks', why: 'Before the method runs, the container only knows the declared return type. Declaring <code>Object</code> or a broad interface can make type-based lookups made before instantiation (such as <code>@ConditionalOnMissingBean(HikariDataSource.class)</code>) miss your bean.', fix: 'Declare the most specific return type you are happy to expose.' }
  ],
  scenarios: [
    { title: 'Payments “succeed” in staging, and so do staging’s real card tests',
      symptom: 'Staging used the real gateway for months, then a config clean-up activated profile <code>staging</code> instead of <code>prod</code> and every payment there was approved instantly, including the end-to-end tests meant to hit the real sandbox.',
      diagnose: `// the fake was guarded by a negation
@Profile("!prod")
@Component class AlwaysApproveGateway implements PaymentGateway { … }

# logs on startup
The following 1 profile is active: "staging"`,
      cause: '<code>!prod</code> is true for every non-prod environment. Renaming the staging profile switched the fake on.',
      fix: 'Make fakes opt-in, and add a guard that fails startup if no known environment profile is active.',
      fixCode: `@Profile({"local", "test"})
@Component class AlwaysApproveGateway implements PaymentGateway { … }

# profile groups (Boot 2.4+) keep environment profiles explicit
spring:
  profiles:
    group:
      staging: [real-payments, sandbox-urls]
      prod:    [real-payments, prod-urls]` },
    { title: 'After a “startup optimisation”, a rollback leaves half the rows',
      symptom: 'A batch job fails halfway and calls rollback, but rows written through <code>JdbcTemplate</code> stay committed. Hikari metrics show three pools instead of one.',
      diagnose: `# Actuator: hikaricp_connections metrics show pools HikariPool-1..3
# the recent diff:
-@Configuration
+@Configuration(proxyBeanMethods = false)   // "faster startup"
 class DbConfig {
   @Bean JdbcTemplate jdbcTemplate() { return new JdbcTemplate(dataSource()); }`,
      cause: 'Turning off bean-method proxying made <code>dataSource()</code> a plain call. The transaction manager and <code>JdbcTemplate</code> got different pools, so JDBC work never joined the transaction.',
      fix: 'Inject the DataSource as a parameter everywhere. Better still, delete the hand-written config and let Boot auto-configure the DataSource, <code>JdbcTemplate</code> and transaction manager from <code>spring.datasource.*</code>.',
      fixCode: `@Configuration(proxyBeanMethods = false)
class DbConfig {
  @Bean JdbcTemplate jdbcTemplate(DataSource ds) { return new JdbcTemplate(ds); }
  @Bean PlatformTransactionManager txManager(DataSource ds) { return new DataSourceTransactionManager(ds); }
}` },
    { title: 'Reporting endpoints return 404 in some builds but not others',
      symptom: 'The <code>/reports</code> controller sometimes isn’t registered. It depends on which modules are on the classpath.',
      diagnose: `# run with --debug and read the condition evaluation report
ReportingConfig:
   Did not match:
      - @ConditionalOnBean (types: javax.sql.DataSource; SearchStrategy: all) did not find any beans`,
      cause: 'A <code>@ConditionalOnBean(DataSource.class)</code> on a user configuration class. It is evaluated before <code>DataSourceAutoConfiguration</code> registers the DataSource, so it only matched in builds where another user config happened to define one first.',
      fix: 'Condition on what you actually know at parse time (a property or a class), or move the configuration into an auto-configuration ordered after <code>DataSourceAutoConfiguration</code>.',
      fixCode: `@AutoConfiguration(after = DataSourceAutoConfiguration.class)
@ConditionalOnBean(DataSource.class)
class ReportingAutoConfiguration { … }
// listed in META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Full mode (<code>@Configuration</code> with defaults). How many <code>HikariDataSource</code> objects are created?', code: `@Configuration
class DbConfig {
  @Bean DataSource dataSource() { return new HikariDataSource(cfg()); }
  @Bean JdbcTemplate jdbc() { return new JdbcTemplate(dataSource()); }
  @Bean NamedParameterJdbcTemplate named() { return new NamedParameterJdbcTemplate(dataSource()); }
}`, options: ['1', '2', '3', 'Depends on bean creation order'], answer: 0, explain: 'The CGLIB subclass intercepts the inner <code>dataSource()</code> calls and returns the singleton from the container. One pool.' },
    { kind: 'predict', q: 'Same class with <code>@Configuration(proxyBeanMethods = false)</code>. How many?', options: ['1', '2', '3', 'Startup fails'], answer: 2, explain: 'One for the <code>dataSource</code> bean, plus one per direct call: 3. Only the first is a managed bean. Use method parameters instead.' },
    { kind: 'predict', q: 'Full mode. <code>ids()</code> is <code>static</code>. Do <code>a</code> and <code>b</code> share the IdGenerator bean?', code: `@Configuration
class IdConfig {
  @Bean static IdGenerator ids() { return new IdGenerator(); }
  @Bean A a() { return new A(ids()); }
  @Bean B b() { return new B(ids()); }
}`, options: ['Yes: full mode intercepts every @Bean call', 'No: static methods are never intercepted, so each call creates a new IdGenerator', 'Startup fails: static @Bean methods are not allowed', 'Yes: CGLIB generates a static bridge for static methods'], answer: 1, explain: 'A static method can’t be overridden by the CGLIB subclass, so calls to it are plain Java even in full mode: three IdGenerators in total (the bean plus two strays). Static <code>@Bean</code> is meant for post-processors, and they should not be called directly.' },
    { kind: 'predict', q: 'No profile is set. Which beans are registered?', code: `@Profile("!prod")   @Bean A a() { … }
@Profile("default") @Bean B b() { … }
@Profile("dev")     @Bean C c() { … }`, options: ['A only', 'A and B', 'B only', 'None'], answer: 1, explain: '<code>!prod</code> is true because prod isn’t active. With no active profile, the <b>default</b> profile is active, so B registers. C needs dev.' },
    { kind: 'predict', q: 'Now <code>spring.profiles.active=dev</code>. Which beans?', options: ['A, B and C', 'A and C', 'C only', 'B and C'], answer: 1, explain: 'Activating any profile turns the default profile off, so B disappears. A (<code>!prod</code>) and C (<code>dev</code>) remain.' },
    { kind: 'predict', q: 'Spring Boot 3.x. Two scanned configuration classes both declare <code>@Bean Clock clock()</code>. What happens?', options: ['The last one processed wins', 'The first one wins', 'Startup fails with BeanDefinitionOverrideException', 'Both are registered under different names'], answer: 2, explain: 'Bean names must be unique. Boot sets <code>allow-bean-definition-overriding=false</code>, so the second registration fails. Plain Spring Framework would let the later one override silently.' },
    { kind: 'concept', q: 'Why do Spring Boot’s own auto-configuration classes use <code>proxyBeanMethods = false</code>?', options: ['To allow final classes', 'To avoid generating a CGLIB subclass per configuration class (startup time, memory, native images), since they never call @Bean methods directly', 'Because auto-configurations can’t be proxied', 'To disable @Conditional processing'], answer: 1, explain: 'There are hundreds of auto-configuration classes. Skipping CGLIB enhancement saves time and memory and suits AOT/native images. It is safe because they wire dependencies through method parameters, never inter-bean calls.' }
  ],
  interview: [
    { q: 'What does @Configuration add over @Component?', a: '<p>Both register <code>@Bean</code> methods. <code>@Configuration</code> (with the default <code>proxyBeanMethods = true</code>) makes Spring generate a CGLIB subclass whose <code>@Bean</code> methods check the container first, so inter-bean method calls return the shared singleton (or respect whatever scope the bean has). With <code>@Component</code> or <code>proxyBeanMethods = false</code> (“lite” mode) those calls are plain Java.</p>', lvl: 'core' },
    { q: 'How does the full-mode interception actually decide?', a: '<p>The generated subclass’s <code>BeanMethodInterceptor</code> checks whether the method is being invoked by the container as the factory method for that bean. If so, it calls the real method. Otherwise (your own call from another <code>@Bean</code> method), it resolves the bean from the <code>BeanFactory</code> by name and returns that.</p>', lvl: 'deep' },
    { q: 'When would you choose proxyBeanMethods = false?', a: '<p>Almost always for new code, as long as you inject dependencies as method parameters. It avoids the CGLIB class, allows final classes and methods, starts slightly faster and is friendlier to AOT/native images. Keep full mode only for legacy configs that rely on inter-bean calls.</p>', lvl: 'core' },
    { q: 'How do you activate profiles, and what is a profile group?', a: '<p><code>spring.profiles.active</code> through any property source: <code>application.yml</code>, <code>SPRING_PROFILES_ACTIVE</code>, <code>--spring.profiles.active=prod</code>. <code>spring.profiles.include</code> adds more. Profile groups (Boot 2.4+) expand one name into several: <code>spring.profiles.group.prod=prod-db,prod-mq</code>. Since 2.4, you can’t set <code>spring.profiles.active</code> inside a profile-specific document.</p>', lvl: 'core' },
    { q: 'How is @Profile implemented?', a: '<p>It is meta-annotated with <code>@Conditional(ProfileCondition.class)</code>. The condition reads the profile expression and asks <code>Environment.acceptsProfiles(Profiles.of(…))</code>. So profiles are just one kind of condition, evaluated at registration time.</p>', lvl: 'core' },
    { q: 'Write a custom condition.', a: '<p>Implement <code>Condition.matches(ConditionContext, AnnotatedTypeMetadata)</code>. The context gives you the <code>Environment</code>, <code>BeanFactory</code>, <code>ResourceLoader</code> and class loader. Use it with <code>@Conditional(MyCondition.class)</code>, ideally wrapped in your own annotation. In Boot, extend <code>SpringBootCondition</code> so the result shows up with a message in the condition evaluation report.</p>', fu: 'What is ConfigurationCondition for? (Choosing the phase: PARSE_CONFIGURATION or REGISTER_BEAN, which matters for bean conditions.)', lvl: 'deep' },
    { q: 'In what order are configuration classes processed?', a: '<p><code>ConfigurationClassPostProcessor</code> starts from the registered configuration classes (your <code>@SpringBootApplication</code> class), follows <code>@ComponentScan</code>, member classes and <code>@Import</code> recursively, and processes each class’s <code>@Bean</code> methods. <code>DeferredImportSelector</code>s (which is how auto-configuration is imported) run <b>after</b> all other configuration has been parsed. That is what lets auto-configuration back off when you define your own bean.</p>', lvl: 'deep' },
    { q: 'What are the three kinds of @Import target?', a: '<ul><li>A <code>@Configuration</code> (or any component) class.</li><li>An <code>ImportSelector</code> that returns class names to import, computed at runtime. <code>DeferredImportSelector</code> runs after normal configuration.</li><li>An <code>ImportBeanDefinitionRegistrar</code> that registers definitions programmatically (used by <code>@EnableJpaRepositories</code> and similar).</li></ul><p>Most <code>@Enable…</code> annotations are just <code>@Import</code> of one of these.</p>', lvl: 'deep' },
    { q: 'Can @Profile be used on a @Bean method?', a: '<p>Yes, on classes and on <code>@Bean</code> methods. One caveat: with overloaded <code>@Bean</code> methods of the same name, conditions are only considered on the first declaration. Use distinct method names (and <code>@Bean(name = …)</code> if the bean names must match).</p>', lvl: 'core' },
    { q: 'Should business beans be profile-dependent?', a: '<p>Sparingly. Profiles are good for infrastructure (local Testcontainers, cloud secret stores). Behaviour switches are clearer as properties with <code>@ConditionalOnProperty</code>, or as feature flags evaluated at runtime, because they can change without rebuilding which beans exist.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Lite-mode config done right', lang: 'java', code: `@Configuration(proxyBeanMethods = false)
class HttpClientsConfig {

  @Bean
  RestClient inventoryClient(RestClient.Builder builder, InventoryProps props) {
    return builder.baseUrl(props.url()).build();
  }

  @Bean
  @Profile({"local", "test"})
  InventoryApi fakeInventory() { return new InMemoryInventory(); }

  @Bean
  @ConditionalOnProperty(name = "inventory.cache.enabled", havingValue = "true")
  InventoryApi cachedInventory(RestClient inventoryClient, CacheManager caches) {
    return new CachedInventory(inventoryClient, caches);
  }
}`, note: 'Dependencies arrive as parameters, so no CGLIB proxy is needed.' },
    { title: 'Profiles and groups in application.yml', lang: 'yaml', code: `spring:
  profiles:
    group:
      prod: [prod-db, otel]
      local: [h2, fake-payments]
---
spring:
  config:
    activate:
      on-profile: prod-db
  datasource:
    url: jdbc:postgresql://db.internal:5432/shop
---
spring:
  config:
    activate:
      on-profile: h2
  datasource:
    url: jdbc:h2:mem:shop`, note: 'Activate with <code>SPRING_PROFILES_ACTIVE=prod</code>. <code>spring.config.activate.on-profile</code> replaced <code>spring.profiles</code> in documents in Boot 2.4.' },
    { title: 'A custom condition with a report message', lang: 'java', code: `@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Conditional(OnRegionCondition.class)
public @interface ConditionalOnRegion { String value(); }

class OnRegionCondition extends SpringBootCondition {
  @Override
  public ConditionOutcome getMatchOutcome(ConditionContext ctx, AnnotatedTypeMetadata md) {
    String want = (String) md.getAnnotationAttributes(ConditionalOnRegion.class.getName()).get("value");
    String have = ctx.getEnvironment().getProperty("app.region", "unknown");
    return want.equals(have)
        ? ConditionOutcome.match("region is " + have)
        : ConditionOutcome.noMatch("region is " + have + ", wanted " + want);
  }
}` }
  ]
});

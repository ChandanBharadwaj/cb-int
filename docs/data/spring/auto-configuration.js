IA.register({
  track: 'spring',
  slug: 'auto-configuration',
  title: 'Auto-configuration',
  tagline: 'Auto-configuration is not magic, it is <b>a list of ordinary <code>@Configuration</code> classes guarded by conditions</b>. Boot reads the list from the classpath, processes it <i>after</i> your own configuration, and each class asks: are the right classes present, is a property set, and has the user already defined this bean? Every answer is recorded in the <b>condition evaluation report</b>.',
  tldr: {
    problem: 'A bean you expected isn’t there (“No qualifying bean of type JdbcTemplate”), a bean you defined silently disabled a whole group of Boot features, or an internal starter stopped working after the Boot 3 upgrade.',
    model: 'Candidates come from <code>META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports</code>. They are imported by a <code>DeferredImportSelector</code> (so after user config), sorted by <code>after</code>/<code>before</code>, and evaluated one by one. Class-level conditions skip the whole class; <code>@ConditionalOnMissingBean</code> on a <code>@Bean</code> method makes Boot <b>back off</b> when you supplied your own.',
    hook: '“How would you find out why Boot didn’t configure X?” Run with <code>--debug</code> or hit <code>/actuator/conditions</code> and read the negative matches.',
    facts: [
      { v: '2.7 → 3.0', l: '<code>AutoConfiguration.imports</code> and <code>@AutoConfiguration</code> arrived in Boot 2.7; Boot 3.0 removed auto-configuration registration through <code>spring.factories</code>' },
      { v: '--debug', l: 'prints the condition evaluation report at startup; <code>/actuator/conditions</code> serves the same data as JSON' },
      { v: 'proxyBeanMethods = false', l: '<code>@AutoConfiguration</code> is meta-annotated with <code>@Configuration(proxyBeanMethods = false)</code>' }
    ]
  },
  intro: {
    what: 'Add <code>spring-boot-starter-data-jpa</code> and a database URL, and you get a connection pool, an <code>EntityManagerFactory</code>, a transaction manager and repositories, without writing any of them. That’s <b>auto-configuration</b>: Boot ships hundreds of configuration classes that each look at what is on your classpath and what you have already defined, and fill in sensible defaults for everything else.',
    analogy: { icon: '🏠', title: 'A furnished apartment that respects your furniture', text: 'You move into an apartment that comes furnished. But the landlord has a rule: if you bring your own sofa, the provided sofa goes back to storage. If you have no TV, no TV stand is set up. Each piece of furniture has a little card saying when it is installed. The condition evaluation report is the binder of all those cards, with ✓ or ✗ on each.' },
    steps: [
      { t: 'Starters put jars on the classpath', d: '<code>spring-boot-starter-jdbc</code> brings Spring JDBC and HikariCP. Their classes being present is the first condition.' },
      { t: 'Boot lists candidate configurations', d: 'Each jar can ship an <code>AutoConfiguration.imports</code> file listing configuration classes, one per line.' },
      { t: 'Conditions decide', d: '<code>@ConditionalOnClass</code>, <code>@ConditionalOnProperty</code>, <code>@ConditionalOnMissingBean</code> and friends are checked in order.', code: '@AutoConfiguration\n@ConditionalOnClass(JdbcTemplate.class)\nclass JdbcTemplateAutoConfiguration { … }' },
      { t: 'Your beans win', d: 'Because your configuration is processed first, defining your own <code>DataSource</code> makes Boot skip its own.' },
      { t: 'Ask why', d: 'Run with <code>--debug</code> to see which configurations matched and why the others didn’t.', code: 'java -jar app.jar --debug', lang: 'bash' }
    ],
    terms: [
      ['auto-configuration', 'A <code>@AutoConfiguration</code> class, listed in an imports file and guarded by conditions.'],
      ['starter', 'A dependency that bundles the libraries for one feature (and usually its auto-configuration).'],
      ['back off', 'An auto-configured bean not being created because you already defined one.'],
      ['@ConditionalOnMissingBean', 'Register this bean only if no bean of that type (or name) exists yet.'],
      ['condition evaluation report', 'The list of positive and negative matches, with the reason for each.']
    ]
  },
  visual: {
    title: 'Watch Boot decide what to configure',
    caption: 'Choose what is on the classpath, whether you define your own DataSource, and one property. Press Play or Step: candidates are read, your beans are registered, then each auto-configuration is evaluated in order. Green beans come from Boot, blue from you. The report fills in underneath.'
  },
  gotchas: [
    { trap: 'Still registered in spring.factories after the Boot 3 upgrade', code: `# META-INF/spring.factories: ignored for auto-config since Boot 3.0
org.springframework.boot.autoconfigure.EnableAutoConfiguration=com.acme.audit.AuditAutoConfiguration`, why: 'Boot 2.7 deprecated the <code>EnableAutoConfiguration</code> key in <code>spring.factories</code>, and 3.0 stopped reading it. The class is simply never considered: no error, it just isn’t in the report.', fix: 'List it in <code>META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports</code> and annotate it with <code>@AutoConfiguration</code>. (Other <code>spring.factories</code> keys, such as listeners and failure analyzers, are still read.)' },
    { trap: 'A second DataSource makes JdbcTemplate and the transaction manager disappear', why: '<code>JdbcTemplateAutoConfiguration</code> and <code>DataSourceTransactionManagerAutoConfiguration</code> use <code>@ConditionalOnSingleCandidate(DataSource.class)</code>. With two DataSources and no primary, neither matches.', fix: 'Mark one DataSource <code>@Primary</code>, or define the dependent beans yourself with explicit qualifiers.' },
    { trap: 'Your own ObjectMapper turns off spring.jackson.* settings', code: `@Bean ObjectMapper objectMapper() { return new ObjectMapper(); }   // Boot's backs off`, why: 'Boot’s ObjectMapper is <code>@ConditionalOnMissingBean</code>. Yours replaces it entirely, so <code>spring.jackson.*</code> properties, the JavaTimeModule and other registered modules no longer apply. Dates suddenly serialise as numbers.', fix: 'Customise instead of replacing: a <code>Jackson2ObjectMapperBuilderCustomizer</code> bean, or <code>spring.jackson.*</code> properties. The same pattern applies to most auto-configured beans (<code>RestClientCustomizer</code>, <code>HikariConfig</code> properties…).' },
    { trap: 'Auto-configuration classes picked up by component scan', why: 'If your auto-configuration lives in a package your app scans, it is registered as ordinary user configuration: processed early, <code>after</code>/<code>before</code> ordering ignored, and bean conditions evaluated against an incomplete registry.', fix: 'Put auto-configurations in their own package that is never scanned, and load them only through the imports file.' },
    { trap: '@ConditionalOnBean without ordering', code: `@AutoConfiguration
@ConditionalOnBean(DataSource.class)        // may run before DataSourceAutoConfiguration
class AuditAutoConfiguration { … }`, why: 'Bean conditions only see definitions registered so far. Without <code>after = DataSourceAutoConfiguration.class</code>, this may be evaluated first and never match.', fix: 'Always declare <code>@AutoConfiguration(after = …)</code> for the configurations whose beans you condition on.' },
    { trap: '@ConditionalOnClass on a @Bean method whose signature uses the class', why: 'Conditions on a <code>@Bean</code> method are checked after the configuration class itself has been loaded and introspected. If its method signatures reference a class that isn’t on the classpath, introspection can fail with <code>NoClassDefFoundError</code> before your condition gets a chance.', fix: 'Put optional-library beans in a nested <code>static</code> <code>@Configuration</code> class with <code>@ConditionalOnClass</code> on the class, and use the <code>name = "…"</code> form when the class may be missing.' }
  ],
  scenarios: [
    { title: '“No qualifying bean of type JdbcTemplate” after adding a reporting database',
      symptom: 'The app fails to start after a second DataSource for a read replica was added. Errors mention <code>JdbcTemplate</code> and <code>transactionManager</code>, which nobody defined in the first place.',
      diagnose: `java -jar app.jar --debug
...
JdbcTemplateAutoConfiguration:
   Did not match:
      - @ConditionalOnSingleCandidate (types: javax.sql.DataSource; SearchStrategy: all)
        did not find a primary bean from beans 'appDataSource', 'reportingDataSource'`,
      cause: 'Two DataSource beans and no primary: every auto-configuration guarded by <code>@ConditionalOnSingleCandidate(DataSource)</code> backed off.',
      fix: 'Mark the main DataSource <code>@Primary</code> and inject the reporting one with a qualifier.',
      fixCode: `@Configuration(proxyBeanMethods = false)
class DataSources {
  @Bean @Primary @ConfigurationProperties("app.datasource")
  HikariDataSource appDataSource() { return DataSourceBuilder.create().type(HikariDataSource.class).build(); }

  @Bean @ConfigurationProperties("reporting.datasource")
  HikariDataSource reportingDataSource() { return DataSourceBuilder.create().type(HikariDataSource.class).build(); }
}` },
    { title: 'API dates turn into numbers after a “small Jackson tweak”',
      symptom: 'Mobile clients break: <code>createdAt</code> is now <code>1732268400.000000000</code> instead of an ISO string, and <code>spring.jackson.property-naming-strategy</code> seems to be ignored.',
      diagnose: `GET /actuator/conditions
"JacksonAutoConfiguration.JacksonObjectMapperConfiguration#jacksonObjectMapper": {
  "notMatched": [{ "condition": "OnBeanCondition",
    "message": "@ConditionalOnMissingBean ... found beans of type 'com.fasterxml.jackson.databind.ObjectMapper' objectMapper" }]
}`,
      cause: 'A developer added <code>@Bean ObjectMapper objectMapper()</code> to enable one feature. Boot’s mapper backed off, together with all its configured modules and properties.',
      fix: 'Delete the bean and use a customizer, which is applied to Boot’s builder.',
      fixCode: `@Bean
Jackson2ObjectMapperBuilderCustomizer jsonCustomizer() {
  return b -> b.featuresToEnable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
}` },
    { title: 'Company starter silently stops working on Boot 3',
      symptom: 'After upgrading to Boot 3, services using <code>acme-audit-spring-boot-starter</code> start fine but no audit events are written. Nothing in the logs.',
      diagnose: `jar tf acme-audit-autoconfigure.jar | grep META-INF
META-INF/spring.factories            # only this, no AutoConfiguration.imports

# --debug report: AuditAutoConfiguration appears in neither positive nor negative matches`,
      cause: 'The starter registered its auto-configuration only via <code>spring.factories</code>, which Boot 3 no longer reads for auto-configuration. A class that isn’t a candidate isn’t evaluated, so it isn’t in the report either.',
      fix: 'Migrate the registration, and add an <code>ApplicationContextRunner</code> test that fails if the auto-configuration isn’t picked up.',
      fixCode: `# src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
com.acme.audit.AuditAutoConfiguration

@AutoConfiguration(after = DataSourceAutoConfiguration.class)
public class AuditAutoConfiguration { … }` }
  ],
  puzzles: [
    { kind: 'predict', q: 'You define your own <code>@Bean DataSource</code>. <code>spring-boot-starter-jdbc</code> is on the classpath. How many DataSource beans exist?', options: ['2: yours and Boot’s Hikari pool', '1: yours; Boot’s is @ConditionalOnMissingBean and backs off', '1: Boot’s, because auto-configuration overrides', 'Startup fails: duplicate DataSource'], answer: 1, explain: 'Your configuration is processed before auto-configuration, so when Boot’s pooled DataSource configuration checks <code>@ConditionalOnMissingBean(DataSource.class)</code>, it finds yours and backs off.' },
    { kind: 'predict', q: 'You define two DataSource beans, neither <code>@Primary</code>, and nothing else. Which of these does Boot still auto-configure?', options: ['JdbcTemplate and a DataSourceTransactionManager', 'Only JdbcTemplate', 'Neither: both need a single candidate', 'Both, wired to the first DataSource'], answer: 2, explain: 'Both auto-configurations are guarded by <code>@ConditionalOnSingleCandidate(DataSource.class)</code>, which needs exactly one candidate or one marked primary.' },
    { kind: 'predict', q: 'A library built for Boot 2.6 registers its auto-configuration only in <code>META-INF/spring.factories</code>. On Boot 3.x it is…', options: ['Loaded, with a deprecation warning', 'Not loaded at all', 'Loaded only if @EnableAutoConfiguration is present', 'Loaded but evaluated last'], answer: 1, explain: 'Boot 3.0 reads auto-configuration candidates only from <code>AutoConfiguration.imports</code>. The <code>spring.factories</code> entry is ignored, so the class is never a candidate.' },
    { kind: 'concept', q: 'A <code>@Bean</code> method in an auto-configuration has a bare <code>@ConditionalOnMissingBean</code> (no attributes). What does it check?', code: `@Bean
@ConditionalOnMissingBean
AuditWriter auditWriter(DataSource ds) { … }`, options: ['That no bean named auditWriter exists', 'That no bean of the method’s return type (AuditWriter) exists', 'That no DataSource exists', 'That no bean at all exists'], answer: 1, explain: 'With no type or name given, it defaults to the <code>@Bean</code> method’s return type. That is another reason to declare the most specific return type.' },
    { kind: 'concept', q: 'Where do you look first to learn why a Boot feature isn’t configured?', options: ['The Maven dependency tree', 'The condition evaluation report: --debug or /actuator/conditions', 'Spring’s source code', 'The JVM class histogram'], answer: 1, explain: 'The report lists every candidate as a positive or negative match with the exact condition and reason. The dependency tree is the next step if a class condition failed.' },
    { kind: 'predict', q: 'Your auto-configuration has <code>@ConditionalOnBean(DataSource.class)</code> and no ordering. The app uses Boot’s auto-configured DataSource. Does it match?', options: ['Always', 'Never', 'Not guaranteed: it depends on whether it is evaluated after DataSourceAutoConfiguration', 'Only with @Primary'], answer: 2, explain: 'Bean conditions see only the definitions registered so far. Without <code>after = DataSourceAutoConfiguration.class</code> the evaluation order isn’t guaranteed to put it later. Always declare the ordering you depend on.' },
    { kind: 'predict', q: '<code>@ConditionalOnProperty(prefix = "acme.audit", name = "enabled", matchIfMissing = true)</code>. Property value is <code>no</code>. Match?', options: ['Yes: only "false" disables it', 'No: anything but "true" disables it', 'Startup fails: not a boolean', 'Yes: matchIfMissing wins'], answer: 0, explain: 'Without <code>havingValue</code>, the condition matches when the property exists and is <b>not</b> <code>false</code> (case-insensitive). <code>no</code> is not <code>false</code>, so it matches. Specify <code>havingValue = "true"</code> if you want strict opt-in.' }
  ],
  interview: [
    { q: 'How does Spring Boot auto-configuration work?', a: '<p><code>@SpringBootApplication</code> includes <code>@EnableAutoConfiguration</code>, which imports <code>AutoConfigurationImportSelector</code>, a <code>DeferredImportSelector</code>. After user configuration has been parsed, it loads candidate class names from every <code>AutoConfiguration.imports</code> file, removes exclusions, applies a fast metadata-based filter (missing classes), sorts by <code>after</code>/<code>before</code>/<code>@AutoConfigureOrder</code>, and returns them for normal configuration processing, where each class’s conditions decide whether it and its <code>@Bean</code> methods are registered.</p>', lvl: 'core' },
    { q: 'Name the conditions you use most and what they check.', a: '<ul><li><code>@ConditionalOnClass</code> / <code>OnMissingClass</code>: classpath.</li><li><code>@ConditionalOnBean</code> / <code>OnMissingBean</code> / <code>OnSingleCandidate</code>: existing bean definitions.</li><li><code>@ConditionalOnProperty</code>: property value (with <code>havingValue</code>, <code>matchIfMissing</code>).</li><li><code>@ConditionalOnWebApplication(type = SERVLET)</code> / <code>OnNotWebApplication</code>.</li><li><code>@ConditionalOnResource</code>, <code>@ConditionalOnExpression</code> (SpEL), <code>@ConditionalOnJava</code>, <code>@ConditionalOnCloudPlatform</code>, <code>@ConditionalOnThreading</code> (Boot 3.2+, e.g. virtual threads).</li></ul>', lvl: 'core' },
    { q: 'Why is user configuration processed before auto-configuration, and what does that enable?', a: '<p>Because auto-configuration is imported by a deferred import selector. By the time a <code>@ConditionalOnMissingBean</code> in auto-configuration is evaluated, every bean you defined is already registered, so Boot can back off reliably. The reverse doesn’t hold, which is why bean conditions in user configuration are unreliable.</p>', lvl: 'core' },
    { q: 'How do you write your own auto-configuration?', a: '<ol><li>A class annotated <code>@AutoConfiguration</code> (optionally <code>after</code>/<code>before</code>), in a package that is not component-scanned.</li><li>Class-level guards: <code>@ConditionalOnClass</code> for the library, <code>@ConditionalOnProperty</code> for an off switch.</li><li><code>@Bean</code> methods with <code>@ConditionalOnMissingBean</code>, so users can replace each bean.</li><li><code>@EnableConfigurationProperties</code> for a typed properties class, plus <code>spring-boot-configuration-processor</code> for IDE metadata.</li><li>List the class in <code>META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports</code>.</li><li>Test with <code>ApplicationContextRunner</code>.</li></ol><p>Ship it as an <code>-autoconfigure</code> module plus a thin <code>-starter</code> that depends on it and the libraries.</p>', lvl: 'deep' },
    { q: 'How do you disable a specific auto-configuration?', a: '<p><code>@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)</code>, <code>excludeName</code> for classes that may be absent, or <code>spring.autoconfigure.exclude=…</code> in properties (handy per profile). Usually it is better to fix the condition: remove the dependency, set the property, or define your own bean so Boot backs off.</p>', lvl: 'core' },
    { q: 'What is the condition evaluation report, and how do you get it?', a: '<p>A record, kept by <code>ConditionEvaluationReport</code>, of every condition evaluated for every auto-configuration class and bean method: positive matches, negative matches with reasons, exclusions and unconditional classes. Print it with <code>--debug</code> / <code>debug=true</code> (when startup fails, Boot’s error message tells you to re-run with debug enabled to see it), or read it at runtime from <code>/actuator/conditions</code>.</p>', lvl: 'core' },
    { q: 'How do you test an auto-configuration?', a: '<p><code>ApplicationContextRunner</code> builds a lightweight context per test: <code>withConfiguration(AutoConfigurations.of(MyAutoConfiguration.class))</code>, then <code>withPropertyValues</code>, <code>withUserConfiguration</code> (to test back-off) and <code>withClassLoader(new FilteredClassLoader(SomeLib.class))</code> (to test class conditions). Assert with <code>context -&gt; assertThat(context).hasSingleBean(X.class)</code> or <code>.doesNotHaveBean(…)</code>.</p>', lvl: 'deep' },
    { q: 'Why does @ConditionalOnClass usually take Class objects even though the class may be missing?', a: '<p>Annotation attribute values are read from bytecode with ASM-based metadata, without loading the class, so a class literal for an absent class doesn’t break evaluation at class level. Problems arise when the class is <i>loaded</i>, for example via reflection on <code>@Bean</code> method signatures. That’s why Boot isolates optional types in nested configuration classes and offers the <code>name</code> attribute.</p>', lvl: 'deep' },
    { q: 'What is spring-autoconfigure-metadata.properties?', a: '<p>A file generated at build time by <code>spring-boot-autoconfigure-processor</code>, recording each auto-configuration’s class conditions and ordering. Boot uses it to filter out candidates whose required classes are missing <b>without loading</b> the configuration classes, which keeps startup fast despite hundreds of candidates.</p>', lvl: 'deep' },
    { q: 'Auto-configured bean vs customizer: which do you override?', a: '<p>Prefer customizers and properties: <code>Jackson2ObjectMapperBuilderCustomizer</code>, <code>RestClientCustomizer</code>, <code>WebServerFactoryCustomizer</code>, <code>HikariDataSource</code> via <code>spring.datasource.hikari.*</code>. Replacing the bean means you also lose everything else Boot configured on it. Replace only when you need a fundamentally different implementation.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Your own auto-configuration', lang: 'java', code: `@AutoConfiguration(after = DataSourceAutoConfiguration.class)
@ConditionalOnClass(AuditWriter.class)
@ConditionalOnProperty(prefix = "acme.audit", name = "enabled", havingValue = "true", matchIfMissing = true)
@EnableConfigurationProperties(AuditProperties.class)
public class AuditAutoConfiguration {

  @Bean
  @ConditionalOnMissingBean
  @ConditionalOnSingleCandidate(DataSource.class)
  AuditWriter auditWriter(DataSource ds, AuditProperties props) {
    return new JdbcAuditWriter(ds, props.table());
  }

  @Bean
  @ConditionalOnMissingBean
  AuditAspect auditAspect(AuditWriter writer) { return new AuditAspect(writer); }
}

@ConfigurationProperties("acme.audit")
public record AuditProperties(boolean enabled, @DefaultValue("audit_log") String table) {}` },
    { title: 'Register it (Boot 2.7+ / 3.x)', lang: 'text', code: `# src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
com.acme.audit.autoconfigure.AuditAutoConfiguration

# module layout
acme-audit-spring-boot-autoconfigure   ← the class above + imports file
acme-audit-spring-boot-starter         ← depends on autoconfigure + the libraries, no code`, note: 'Add <code>spring-boot-configuration-processor</code> (annotation processor) so <code>acme.audit.*</code> gets IDE completion.' },
    { title: 'Test conditions with ApplicationContextRunner', lang: 'java', code: `class AuditAutoConfigurationTest {
  private final ApplicationContextRunner runner = new ApplicationContextRunner()
      .withConfiguration(AutoConfigurations.of(DataSourceAutoConfiguration.class, AuditAutoConfiguration.class))
      .withPropertyValues("spring.datasource.url=jdbc:h2:mem:t");

  @Test void createsWriterByDefault() {
    runner.run(ctx -> assertThat(ctx).hasSingleBean(AuditWriter.class));
  }
  @Test void backsOffWhenUserDefinesOne() {
    runner.withBean(AuditWriter.class, () -> mock(AuditWriter.class))
          .run(ctx -> assertThat(ctx).getBean(AuditWriter.class).isNotInstanceOf(JdbcAuditWriter.class));
  }
  @Test void offSwitch() {
    runner.withPropertyValues("acme.audit.enabled=false")
          .run(ctx -> assertThat(ctx).doesNotHaveBean(AuditWriter.class));
  }
  @Test void noLibraryNoConfig() {
    runner.withClassLoader(new FilteredClassLoader(AuditWriter.class))
          .run(ctx -> assertThat(ctx).doesNotHaveBean(AuditAspect.class));
  }
}` },
    { title: 'Read the report', lang: 'bash', code: `# at startup
java -jar app.jar --debug | sed -n '/CONDITIONS EVALUATION REPORT/,/Unconditional classes/p'

# at runtime (management.endpoints.web.exposure.include=conditions)
curl -s localhost:8080/actuator/conditions \\
  | jq '.contexts[].negativeMatches | with_entries(select(.key | test("Jdbc")))'` }
  ]
});

IA.register({
  track: 'spring',
  slug: 'spring-config-basics',
  title: 'Configuration basics',
  tagline: 'Settings live <b>outside your code</b>: in <code>application.properties</code> or <code>application.yml</code>, overridable by environment variables and command-line arguments. Read one value with <code>@Value</code>, or a whole group with <code>@ConfigurationProperties</code>. <b>Profiles</b> switch sets of values per environment.',
  tldr: {
    problem: 'Hard-coded URLs, ports and passwords mean rebuilding the app for every environment, and secrets ending up in Git.',
    model: 'All sources merge into one <b>Environment</b>. For each key the <b>highest-priority source wins</b> (command line &gt; env vars &gt; profile file &gt; default file, simplified). Beans read from that Environment.',
    hook: '“@Value or @ConfigurationProperties?” <code>@Value</code> for one-off values; <code>@ConfigurationProperties</code> for typed, grouped, validated settings with relaxed binding.',
    facts: [
      { v: '.properties = .yml', l: '<code>a.b.c=1</code> and nested YAML <code>a: b: c: 1</code> are the same key' },
      { v: 'APP_TIMEOUT', l: 'env var that binds to <code>app.timeout</code> (upper case, dots → underscores, dashes removed)' },
      { v: 'application-{profile}', l: 'file loaded only when that profile is active, overriding the default file' }
    ]
  },
  intro: {
    what: 'Your app needs values that change between your laptop and production: database URL, port, a feature switch, an API timeout. Instead of writing them into Java code, you put them in a configuration file and Spring <b>injects</b> them. In production you override them with environment variables, without rebuilding.',
    analogy: { icon: '🎛️', title: 'A mixing desk', text: 'Each source of settings is a fader on a mixing desk: the packaged file at the bottom, the profile file above it, environment variables higher, command-line arguments at the top. For any one setting, the highest fader that is “up” is what the audience hears.' },
    steps: [
      { t: 'Write the file', d: 'In <code>src/main/resources</code>. Pick one format.', code: '# application.yml\nserver:\n  port: 8080\napp:\n  greeting: Hello\n  timeout: 5s\n  retries: 3', lang: 'yaml' },
      { t: 'Inject one value', d: '<code>${…}</code> is a placeholder; <code>:</code> gives a default.', code: '@Service\nclass Greeter {\n  private final String greeting;\n  Greeter(@Value("${app.greeting:Hi}") String greeting) { this.greeting = greeting; }\n}' },
      { t: 'Bind a group into a record', d: 'Typed, with conversion (<code>5s</code> → <code>Duration</code>).', code: '@ConfigurationProperties(prefix = "app")\nrecord AppProperties(String greeting, Duration timeout, int retries) {}\n\n@SpringBootApplication\n@ConfigurationPropertiesScan        // registers the record as a bean\npublic class DemoApplication { … }' },
      { t: 'Override at deploy time', d: 'No rebuild needed.', code: 'APP_GREETING=Hey java -jar app.jar\njava -jar app.jar --app.greeting=Yo', lang: 'bash' },
      { t: 'Profiles', d: 'Activate a named set of overrides.', code: '# application-dev.yml is loaded only when "dev" is active\njava -jar app.jar --spring.profiles.active=dev', lang: 'bash' }
    ],
    terms: [
      ['property', 'A key and value, e.g. <code>server.port=8080</code>.'],
      ['Environment', 'Spring’s merged view of all property sources and active profiles.'],
      ['placeholder', '<code>${key}</code> or <code>${key:default}</code>, resolved from the Environment.'],
      ['relaxed binding', 'Boot matches <code>app.max-size</code>, <code>app.maxSize</code> and <code>APP_MAXSIZE</code> to the same property in <code>@ConfigurationProperties</code>.'],
      ['profile', 'A name (dev, test, prod) that switches on extra config files and beans.']
    ]
  },
  visual: {
    title: 'Where does a value come from?',
    caption: 'Choose <b>One file</b>, <b>dev profile</b> or <b>Who wins?</b> and press Play or Step. Watch which source feeds the Environment and which bean receives the value.'
  },
  gotchas: [
    { trap: 'Secrets committed in application.yml', code: 'spring:\n  datasource:\n    password: s3cr3t   # now in Git history forever', lang: 'yaml', why: 'The file ships inside the jar and lives in version control.', fix: 'Reference a placeholder and inject the real value from the environment or a secret store: <code>password: ${DB_PASSWORD}</code>.' },
    { trap: 'Typo in a property name fails silently', code: 'sever.port=9090   # nothing happens', lang: 'text', why: 'Unknown keys are simply ignored by Boot.', fix: 'Use your IDE’s Boot support (it flags unknown keys), and prefer <code>@ConfigurationProperties</code> with <code>@Validated</code> for your own settings.' },
    { trap: '<code>@Value</code> on a static field', code: '@Value("${app.greeting}") static String greeting;  // stays null', why: 'Spring injects into bean instances, not static fields.', fix: 'Use an instance field or constructor parameter.' },
    { trap: '<code>@ConfigurationProperties</code> class not registered', why: 'The annotation alone does not create a bean; injection then fails with “No qualifying bean of type AppProperties”.', fix: 'Add <code>@ConfigurationPropertiesScan</code> on the main class, or <code>@EnableConfigurationProperties(AppProperties.class)</code>.' },
    { trap: 'Missing value crashes startup', code: 'Could not resolve placeholder \'app.api-key\' in value "${app.api-key}"', lang: 'text', why: 'A <code>@Value</code> placeholder with no source and no default is an error.', fix: 'Provide the value per environment, or add a default: <code>${app.api-key:}</code> (empty) if it is truly optional.' },
    { trap: 'Mixing .properties and .yml for the same keys', why: 'Both are loaded; if both define a key, <code>.properties</code> wins. Confusing to debug.', fix: 'Pick one format per project.' }
  ],
  scenarios: [
    { title: 'Production connects to the dev database', symptom: 'After a deploy, prod writes appear in the shared dev database.', diagnose: 'Startup log shows <code>The following 1 profile is active: "dev"</code>. The jar’s <code>application.yml</code> contains <code>spring.profiles.active: dev</code>.', cause: 'Someone set the active profile inside the packaged file; the prod deployment never overrode it.', fix: 'Never set the active profile in the packaged default file. Set it per environment from outside.', fixCode: '# Kubernetes / container env\nSPRING_PROFILES_ACTIVE=prod\nSPRING_DATASOURCE_URL=jdbc:postgresql://prod-db:5432/app', lang: 'yaml' },
    { title: 'Timeout setting “does nothing”', symptom: 'Ops set <code>APP_HTTP_TIMEOUT=30s</code> but calls still time out after 5 seconds.', diagnose: 'The property is <code>app.http-timeout</code>, bound by <code>@ConfigurationProperties("app") record AppProperties(Duration httpTimeout)</code>.', cause: 'For env vars, Boot turns underscores into dots and drops dashes. <code>APP_HTTP_TIMEOUT</code> means <code>app.http.timeout</code>, a different (nested) key, so it was ignored.', fix: 'Use the env var name that maps to the kebab-case key: remove the dash, keep the dots as underscores.', fixCode: 'APP_HTTPTIMEOUT=30s   # → app.httptimeout, matches app.http-timeout via relaxed binding', lang: 'bash' }
  ],
  puzzles: [
    { kind: 'predict', q: '<code>application.yml</code> has <code>app.greeting: Hello</code>, the env var <code>APP_GREETING=Hey</code> is set, and the app starts with <code>--app.greeting=Yo</code>. What is injected?', options: ['Hello', 'Hey', 'Yo', 'Startup fails: conflicting values'], answer: 2, explain: 'Command-line arguments have higher priority than OS environment variables, which beat config files.' },
    { kind: 'predict', q: 'Profile <code>dev</code> is active. <code>application.yml</code> sets <code>a=1</code> and <code>b=1</code>; <code>application-dev.yml</code> sets only <code>a=2</code>. Values?', options: ['a=1, b=1', 'a=2, b unset', 'a=2, b=1', 'a=1, b unset'], answer: 2, explain: 'Profile files override key by key. Keys they do not mention keep their default values.' },
    { kind: 'concept', q: 'What does <code>@Value("${app.size:10}")</code> do if <code>app.size</code> is not set anywhere?', options: ['Startup fails', 'Injects 10', 'Injects null', 'Injects the string "${app.size:10}"'], answer: 1, explain: 'The part after <code>:</code> is the default value.' },
    { kind: 'concept', q: 'Why prefer <code>@ConfigurationProperties</code> for a group of settings?', options: ['It is faster at runtime', 'Typed binding, relaxed names, validation, and one place for the group', 'It is the only way to read YAML', 'It encrypts values'], answer: 1, explain: 'It gives you a typed object (with <code>Duration</code>, lists, nested records), supports <code>@Validated</code>, and IDE metadata.' },
    { kind: 'concept', q: 'Which env var binds to <code>spring.datasource.url</code>?', options: ['spring.datasource.url', 'SPRING_DATASOURCE_URL', 'SpringDatasourceUrl', 'DATASOURCE-URL'], answer: 1, explain: 'Upper-case, replace dots with underscores. Most shells do not allow dots in variable names.' },
    { kind: 'concept', q: 'How do you activate the <code>prod</code> profile from outside the jar?', options: ['Rename the jar to prod.jar', '<code>--spring.profiles.active=prod</code> or <code>SPRING_PROFILES_ACTIVE=prod</code>', 'Add @Profile("prod") to the main class', 'Delete application-dev.yml'], answer: 1, explain: 'Profiles are activated through the <code>spring.profiles.active</code> property, from any source.' }
  ],
  interview: [
    { q: 'application.properties vs application.yml?', a: '<p>Same content, different syntax. YAML is nicer for nesting and lists; properties are flat and unambiguous. If both exist and define a key, <code>.properties</code> wins. Pick one.</p>', lvl: 'core' },
    { q: 'How does Boot decide which value wins?', a: '<p>A fixed precedence of property sources. Simplified: command-line args &gt; Java system properties &gt; OS environment variables &gt; profile-specific files &gt; default <code>application.*</code> files. Files outside the jar beat files inside. Full list: <a href="externalized-config.html">Externalized configuration</a>.</p>', lvl: 'core' },
    { q: '@Value vs @ConfigurationProperties?', a: '<ul><li><code>@Value</code>: one value, supports SpEL, limited relaxed binding.</li><li><code>@ConfigurationProperties</code>: a typed group, full relaxed binding, validation, metadata. Preferred for your own settings.</li></ul>', lvl: 'core' },
    { q: 'What is a profile?', a: '<p>A named switch. When active, <code>application-{name}.*</code> files are loaded and beans annotated <code>@Profile("name")</code> are created. Typical names: <code>dev</code>, <code>test</code>, <code>prod</code>. More: <a href="configuration-profiles.html">Profiles &amp; conditions</a>.</p>', lvl: 'core' },
    { q: 'How should secrets be handled?', a: '<p>Keep them out of the jar and Git. Inject via environment variables, mounted files or a secret manager (Vault, Azure Key Vault), referenced through placeholders.</p>', lvl: 'core' },
    { q: 'What is relaxed binding?', a: '<p>Boot maps different spellings to one property for <code>@ConfigurationProperties</code>: <code>app.max-size</code>, <code>app.maxSize</code>, <code>app.max_size</code> and <code>APP_MAXSIZE</code>. Kebab-case is the canonical form in files.</p>', lvl: 'core' },
    { q: 'How do you validate configuration at startup?', a: '<p>Annotate the properties class with <code>@Validated</code> and its fields with Jakarta constraints (<code>@NotBlank</code>, <code>@Min</code>). Invalid config fails startup with a clear message instead of failing later at runtime.</p>', lvl: 'deep' },
    { q: 'Does changing a property require a rebuild?', a: '<p>No, if you override it from outside (env var, command line, external file). Values are read at startup, so a restart is needed unless you use a refresh mechanism (e.g. Spring Cloud).</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Typed, validated settings', lang: 'java', code: `@Validated
@ConfigurationProperties(prefix = "app.catalog")
public record CatalogProperties(
    @NotBlank String baseUrl,
    @DefaultValue("5s") Duration timeout,
    @Min(1) @DefaultValue("3") int retries,
    List<String> featuredAuthors) {}

@SpringBootApplication
@ConfigurationPropertiesScan
public class LibraryApp { public static void main(String[] a) { SpringApplication.run(LibraryApp.class, a); } }

@Service
class CatalogClient {
  private final CatalogProperties props;
  CatalogClient(CatalogProperties props) { this.props = props; }
}`, note: '<code>@Validated</code> needs <code>spring-boot-starter-validation</code> on the classpath.' },
    { title: 'Matching YAML with a dev profile', lang: 'yaml', code: `# application.yml
app:
  catalog:
    base-url: https://catalog.example.com
    featured-authors: [Herbert, Austen]
---
# same file, profile-specific section (Boot 2.4+ syntax)
spring:
  config:
    activate:
      on-profile: dev
app:
  catalog:
    base-url: http://localhost:9000
    timeout: 30s` }
  ]
});

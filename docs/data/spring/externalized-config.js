IA.register({
  track: 'spring',
  slug: 'externalized-config',
  title: 'Externalized configuration',
  tagline: 'Boot merges a dozen-plus <b>property sources</b> (files in the jar, files beside it, environment variables, system properties, command-line arguments, secret mounts) into one <code>Environment</code>. For any key, the <b>highest-precedence source that defines it wins</b>. <code>@ConfigurationProperties</code> then binds a whole prefix into a typed, validated object and remembers where each value came from.',
  tldr: {
    problem: 'Production connects to the staging database because of a stray environment variable, a typo in a property name silently falls back to a default, and secrets end up in Git or in an Actuator response.',
    model: 'Think of a stack, highest first: command line → <code>SPRING_APPLICATION_JSON</code> → Java system properties → OS environment → config files (profile-specific outside the jar → outside the jar → profile-specific inside → inside) → <code>@PropertySource</code> → defaults. Lookup stops at the first source that has the key. Binding is <b>relaxed</b>: <code>max-retries</code>, <code>maxRetries</code> and <code>APP_PRICING_MAXRETRIES</code> all reach the same field.',
    hook: '“Where did this value come from?” <code>/actuator/env</code> and <code>/actuator/configprops</code> show every source and the <b>origin</b> of each bound property; binding errors at startup print it too.',
    facts: [
      { v: 'Boot 2.4', l: 'config data rewrite: <code>spring.config.import</code>, <code>spring.config.activate.on-profile</code>, profile groups, and multi-document files processed in order' },
      { v: 'Boot 3.0', l: '<code>/actuator/env</code> and <code>/actuator/configprops</code> mask all values by default (<code>show-values: never</code>)' },
      { v: 'last wins', l: 'within one file and across files at one precedence level, later documents override earlier ones' }
    ]
  },
  intro: {
    what: 'The same jar should run on your laptop, in CI and in production, with different database URLs, timeouts and credentials. So settings live <b>outside</b> the code, in property files, environment variables or command-line flags. Spring Boot reads all of them into one place, the <b>Environment</b>, with a fixed rule for which one wins when they disagree. Your code asks for typed settings and never cares where they came from.',
    analogy: { icon: '🗂️', title: 'A stack of transparent sheets', text: 'Picture the default settings printed on the bottom sheet. Each source above it is a transparent sheet with a few values written on it. Looking down from the top, for each setting you see the first sheet that has something written in that spot. The command line is the top sheet; the jar’s <code>application.yml</code> is near the bottom.' },
    steps: [
      { t: 'Put defaults in application.yml', d: 'It ships inside the jar and documents every setting.', code: 'app:\n  pricing:\n    max-retries: 3\n    timeout: 2s', lang: 'yaml' },
      { t: 'Override per environment', d: 'Environment variables are the usual way in containers. Dots become underscores, dashes are dropped, everything is uppercase.', code: 'APP_PRICING_MAXRETRIES=5\nSPRING_PROFILES_ACTIVE=prod', lang: 'bash' },
      { t: 'Bind to a typed object', d: 'One record per feature, validated at startup.', code: '@ConfigurationProperties("app.pricing")\n@Validated\nrecord PricingProps(@Min(0) @Max(10) int maxRetries, Duration timeout) {}' },
      { t: 'Keep secrets out of files in Git', d: 'Inject them from the platform (Kubernetes secrets, Vault, a cloud key vault) via environment variables or <code>spring.config.import</code>.' }
    ],
    terms: [
      ['property source', 'One place properties come from: a file, the environment, system properties, the command line.'],
      ['Environment', 'Spring’s merged view of all property sources plus the active profiles.'],
      ['relaxed binding', 'Matching <code>max-retries</code>, <code>maxRetries</code>, <code>max_retries</code> and <code>MAXRETRIES</code> to the same field.'],
      ['@ConfigurationProperties', 'Binds every property under a prefix into a typed bean.'],
      ['origin', 'The file and line, or variable name, a bound value came from.'],
      ['configtree', 'A config import that turns a directory of files (e.g. mounted secrets) into properties: file name = key, contents = value.']
    ]
  },
  visual: {
    title: 'Which value wins?',
    caption: 'Rows are property sources, highest precedence at the top. Click rows to make a source define <code>app.pricing.max-retries</code> or not, switch the <code>prod</code> profile, and pick the environment variable’s value. Press Play to watch Boot search from the top, bind, then validate.'
  },
  gotchas: [
    { trap: 'A leftover environment variable beats every file', why: 'Environment variables sit above all config files. A <code>SPRING_DATASOURCE_URL</code> baked into a base image, a shared ConfigMap or a CI runner overrides your carefully written <code>application-prod.yml</code>.', fix: 'Keep the set of variables per deployment small and reviewed. When a value surprises you, check its origin in <code>/actuator/env</code> (authorised users) or <code>/actuator/configprops</code>.' },
    { trap: 'Typos bind to nothing, silently', code: `app:
  pricing:
    timout: 500ms        # typo: the default 2s is used`, why: 'By default, unknown properties under a prefix are ignored, and a misspelled prefix is just another unused key.', fix: 'Use <code>spring-boot-configuration-processor</code> for IDE completion and warnings, make critical values required (<code>@NotNull</code>, no default), and consider <code>@ConfigurationProperties(prefix = "app.pricing", ignoreUnknownFields = false)</code>.' },
    { trap: 'spring.config.location replaces the defaults', code: `java -jar app.jar --spring.config.location=file:/etc/app/   # application.yml in the jar is now ignored`, why: '<code>spring.config.location</code> <b>replaces</b> the default search locations, so classpath defaults disappear and properties you never set in <code>/etc/app/</code> are missing.', fix: 'Use <code>spring.config.additional-location</code> to add locations, or <code>spring.config.import</code> from inside the main file.' },
    { trap: 'Nested objects aren’t validated unless you ask', code: `@ConfigurationProperties("app") @Validated
record AppProps(@NotNull Db db) {}
record Db(@NotBlank String url) {}     // not validated: missing @Valid on 'db'`, why: 'Bean Validation cascades only through properties annotated <code>@Valid</code>. Validation also needs an implementation on the classpath (<code>spring-boot-starter-validation</code>).', fix: 'Annotate nested properties with <code>@Valid</code> and add the validation starter. Test with an <code>ApplicationContextRunner</code> that sets invalid values.' },
    { trap: 'Secrets visible where you don’t expect them', why: 'Values passed as <code>-Dpassword=…</code> or <code>--password=…</code> appear in <code>ps</code> output and some crash reports. Values in <code>application-prod.yml</code> live forever in Git history. Setting <code>management.endpoint.env.show-values=always</code> publishes them over HTTP.', fix: 'Inject secrets through environment variables or mounted files (<code>configtree:</code>) from a secret store; keep Actuator’s <code>show-values</code> at <code>never</code> or <code>when-authorized</code>; rotate anything that was ever committed.' },
    { trap: '@Value scattered everywhere', code: `@Value("\${app.pricing.max-retries:3}") int retries;   // in 6 classes, with 3 different defaults`, why: '<code>@Value</code> has no validation, no metadata, weaker relaxed binding and duplicates defaults across classes. Renaming a key means a text search.', fix: 'Group related settings in one <code>@ConfigurationProperties</code> record and inject that. Keep <code>@Value</code> for one-off values or SpEL.' }
  ],
  scenarios: [
    { title: 'Production writes to the staging database',
      symptom: 'After moving to a new base image, a production service’s orders appear in the staging database. The <code>prod</code> profile is active and <code>application-prod.yml</code> has the right URL.',
      diagnose: `# as an authorised operator (show-values: when-authorized)
curl -s -u ops localhost:8081/actuator/env/spring.datasource.url | jq '.propertySources[] | {name, value: .property.value}'
{ "name": "systemEnvironment", "value": "jdbc:postgresql://staging-db:5432/shop" }
{ "name": "Config resource 'class path resource [application-prod.yml]'", "value": "jdbc:postgresql://prod-db:5432/shop" }`,
      cause: 'The new base image set <code>SPRING_DATASOURCE_URL</code> for a smoke test. Environment variables outrank every config file, so the profile file was shadowed.',
      fix: 'Remove the variable from the image, set datasource settings explicitly in the deployment, and add a startup check that the URL host matches the environment.',
      fixCode: `@Component
class EnvironmentGuard implements ApplicationRunner {
  private final DataSourceProperties ds; private final Environment env;
  EnvironmentGuard(DataSourceProperties ds, Environment env) { this.ds = ds; this.env = env; }
  public void run(ApplicationArguments a) {
    if (env.acceptsProfiles(Profiles.of("prod")) && ds.getUrl().contains("staging"))
      throw new IllegalStateException("prod profile with staging datasource");
  }
}` },
    { title: 'Timeouts “configured” to 500 ms, actually 30 s',
      symptom: 'During a downstream slowdown, threads pile up waiting 30 s per call. The team insists the client timeout is set to 500 ms.',
      diagnose: `GET /actuator/configprops   →  "app.inventory": { "readTimeout": "PT30S" }   # the default

# application-prod.yml
app:
  inventory:
    read-timout: 500ms     # ← typo`,
      cause: 'A misspelled key was silently ignored, so the record kept its default.',
      fix: 'Fail on unknown fields for critical prefixes, and lint configuration in CI using the generated metadata.',
      fixCode: `@ConfigurationProperties(prefix = "app.inventory", ignoreUnknownFields = false)
@Validated
public record InventoryProps(
    @NotNull URI baseUrl,
    @NotNull Duration connectTimeout,
    @NotNull Duration readTimeout) {}       // no defaults: must be set explicitly` },
    { title: 'Database password found in Git history',
      symptom: 'A security review finds <code>spring.datasource.password</code> in <code>application-prod.yml</code>, committed two years ago and copied into three other repositories.',
      diagnose: `git log -S 'spring.datasource.password' --oneline -- '*.yml' '*.properties'`,
      cause: 'Secrets were treated as configuration and stored with it.',
      fix: 'Rotate the credential first. Then store it in the secret manager, mount it into the pod, and import it as a config tree, so the value never appears in files in Git, image layers or command lines.',
      fixCode: `# Kubernetes: secret mounted at /run/secrets/db/  (file "spring.datasource.password")
spring:
  config:
    import: "optional:configtree:/run/secrets/db/"

# or as an environment variable from the secret
env:
  - name: SPRING_DATASOURCE_PASSWORD
    valueFrom: { secretKeyRef: { name: shop-db, key: password } }`, lang: 'yaml' }
  ],
  puzzles: [
    { kind: 'predict', q: 'The profile <code>prod</code> is active. Which value does <code>app.pricing.max-retries</code> get?', code: `# classpath:application.yml        → 3
# classpath:application-prod.yml   → 5
# env APP_PRICING_MAXRETRIES=7`, options: ['3', '5', '7', 'Startup fails: conflicting values'], answer: 2, explain: 'OS environment variables have higher precedence than any config file, profile-specific or not.' },
    { kind: 'predict', q: 'Started with <code>java -Dserver.port=8081 -jar app.jar --server.port=8082</code>. Which port?', options: ['8080', '8081', '8082', 'Startup fails'], answer: 2, explain: 'Command-line arguments outrank Java system properties.' },
    { kind: 'predict', q: 'Profile <code>prod</code> is active. Which wins?', code: `# classpath:application-prod.yml (inside the jar) → 5
# ./config/application.yml (next to the jar)      → 7`, options: ['5: profile-specific always beats plain', '7: files outside the jar beat files inside', 'Whichever is loaded last alphabetically', 'Startup fails'], answer: 1, explain: 'Order (low → high): jar file, jar profile file, outside file, outside profile file. Location outranks “profile-specific”, so an outside <code>application.yml</code> beats an inside <code>application-prod.yml</code>.' },
    { kind: 'concept', q: 'Which environment variable sets <code>app.pricing.max-retries</code> according to Boot’s documented conversion rule?', options: ['app.pricing.max-retries', 'APP_PRICING_MAX-RETRIES', 'APP_PRICING_MAXRETRIES', 'APP.PRICING.MAX_RETRIES'], answer: 2, explain: 'Rule: replace dots with underscores, remove dashes, convert to uppercase. Lists use indexes: <code>APP_HOSTS_0_NAME</code> for <code>app.hosts[0].name</code>.' },
    { kind: 'predict', q: 'Boot 3.x, default settings. What does <code>/actuator/env</code> show for <code>spring.datasource.password</code> (assuming the endpoint is exposed)?', options: ['The password in clear text', '******', 'The key is omitted entirely', '403 Forbidden'], answer: 1, explain: 'Since Boot 3.0, <code>management.endpoint.env.show-values</code> defaults to <code>never</code>, so every value is masked. <code>when-authorized</code> shows values to users with the configured roles.' },
    { kind: 'predict', q: 'What happens at startup?', code: `# application-prod.yml
spring:
  profiles:
    active: prod,metrics`, options: ['Both profiles are activated', 'Ignored silently', 'Startup fails: spring.profiles.active is invalid in a profile-specific resource', 'Only metrics is added'], answer: 2, explain: 'Since Boot 2.4 you can’t set <code>spring.profiles.active</code> (or <code>include</code>) in a profile-specific file or document; Boot throws an <code>InvalidConfigDataPropertyException</code>. Use profile groups instead.' },
    { kind: 'concept', q: '<code>@ConfigurationProperties("app.db") @Validated record AppDb(@NotNull Pool pool)</code>, and <code>Pool</code> has <code>@Min(1) int size</code>. <code>app.db.pool.size=0</code>. Result?', options: ['Startup fails: size must be ≥ 1', 'Starts: Pool isn’t validated without @Valid on pool', 'Starts with size = 1', 'Startup fails: records can’t be validated'], answer: 1, explain: 'Validation cascades only into properties marked <code>@Valid</code>. Add <code>@Valid @NotNull Pool pool</code> to validate nested constraints.' }
  ],
  interview: [
    { q: 'List Spring Boot’s property source precedence.', a: '<p>Highest first (the common ones): test properties (<code>@TestPropertySource</code>, <code>@DynamicPropertySource</code>, <code>@SpringBootTest(properties)</code>), command-line arguments, <code>SPRING_APPLICATION_JSON</code>, servlet config/context params, JNDI, Java system properties, OS environment variables, <code>random.*</code>, config data files, <code>@PropertySource</code>, and <code>SpringApplication.setDefaultProperties</code>. Within config data: profile-specific outside the jar &gt; outside &gt; profile-specific inside &gt; inside.</p>', fu: 'Where does a Kubernetes ConfigMap fit? (Wherever you inject it: as env vars, as a mounted file imported by config data, or via Spring Cloud Kubernetes.)', lvl: 'core' },
    { q: '@ConfigurationProperties vs @Value?', a: '<p><code>@ConfigurationProperties</code>: binds a whole prefix into a typed object, full relaxed binding, conversion (<code>Duration</code>, <code>DataSize</code>, lists, maps), JSR-380 validation, IDE metadata, shows up in <code>/actuator/configprops</code>. <code>@Value</code>: one value, supports SpEL, no validation, no metadata. Prefer properties classes for anything structured.</p>', lvl: 'core' },
    { q: 'How do you register and make @ConfigurationProperties immutable?', a: '<p>Use a record (or a class with one constructor): Boot 3 uses constructor binding automatically when there is a single parameterised constructor (<code>@ConstructorBinding</code> is only needed to pick among several). Register it with <code>@ConfigurationPropertiesScan</code> on the application class or <code>@EnableConfigurationProperties(Props.class)</code>. Defaults go in <code>@DefaultValue</code>.</p>', lvl: 'core' },
    { q: 'How does relaxed binding work for environment variables?', a: '<p>The canonical form is lowercase kebab-case (<code>app.pricing.max-retries</code>). For an environment variable, replace dots with underscores, remove dashes and uppercase: <code>APP_PRICING_MAXRETRIES</code>. List elements use their index: <code>APP_SERVERS_0_HOST</code>. Map keys can’t keep special characters through environment variables, so use <code>SPRING_APPLICATION_JSON</code> or a file for complex maps.</p>', lvl: 'core' },
    { q: 'What does spring.config.import do?', a: '<p>Imports more config data from inside a config file (Boot 2.4+): <code>optional:file:./local.yml</code>, <code>configtree:/run/secrets/</code> (directory → properties), or vendor locations such as Spring Cloud Vault, Config Server (<code>configserver:</code>) and cloud secret managers. Imports are processed right after the file that declares them, and their values override that file. Without <code>optional:</code>, a missing location fails startup.</p>', lvl: 'deep' },
    { q: 'How should secrets reach a Boot app in Kubernetes?', a: '<ul><li>From a secret store (Vault, Azure Key Vault, AWS Secrets Manager), synced to Kubernetes Secrets or read directly.</li><li>Into the pod as env vars (<code>secretKeyRef</code>) or a mounted volume read via <code>configtree:</code>; files are easier to rotate without restarting.</li><li>Never in images, Git, or command-line arguments.</li><li>Actuator values masked (Boot 3 default), and logs free of bound secret values.</li></ul><p>Prefer identity-based access (workload identity, managed identity) over long-lived passwords where possible.</p>', lvl: 'deep' },
    { q: 'How do multi-document YAML files and profiles interact?', a: '<p>A file can contain several documents separated by <code>---</code>. Documents are processed top to bottom, so later ones override earlier ones; a document with <code>spring.config.activate.on-profile: prod</code> only applies when prod is active (and can also use <code>on-cloud-platform</code>). Profile expressions like <code>prod &amp; !eu</code> are allowed. You can’t activate profiles from inside a profile-activated document.</p>', lvl: 'core' },
    { q: 'How do you find out where a property value came from?', a: '<p><code>/actuator/env/{name}</code> lists every source that defines the key, in precedence order (values masked unless authorised). <code>/actuator/configprops</code> shows bound properties classes with origins such as <code>class path resource [application.yml] - 5:18</code>. Binding failures at startup print the property, value, origin and reason.</p>', lvl: 'core' },
    { q: 'Can configuration change at runtime?', a: '<p>Plain Boot binds at startup. To change values without redeploying: Spring Cloud’s <code>@RefreshScope</code> plus a refresh trigger (re-creates those beans), re-reading mounted files yourself, or a feature-flag service evaluated per request. Most teams treat config as immutable per deployment and roll out changes like code.</p>', lvl: 'deep' },
    { q: 'What problems does validating configuration at startup prevent?', a: '<p>Nonsense values (negative pool sizes, timeouts of 0, missing URLs) fail the deployment, which a readiness probe and rolling update then stop, instead of surfacing as retry storms or hangs under load. Combine <code>@Validated</code> constraints, no defaults for environment-specific values, and fail-fast imports (non-optional).</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Typed, validated properties', lang: 'java', code: `@ConfigurationProperties("app.inventory")
@Validated
public record InventoryProps(
    @NotNull URI baseUrl,
    @DefaultValue("1s")  Duration connectTimeout,
    @DefaultValue("3s")  Duration readTimeout,
    @Min(0) @Max(10) @DefaultValue("2") int maxRetries,
    @Valid @NotNull Auth auth) {

  public record Auth(@NotBlank String clientId, @NotBlank String clientSecret) {}
}

@SpringBootApplication
@ConfigurationPropertiesScan            // registers every @ConfigurationProperties type in the package
public class ShopApplication { … }`, note: 'Needs <code>spring-boot-starter-validation</code>. Add <code>spring-boot-configuration-processor</code> as an annotation processor for IDE metadata.' },
    { title: 'application.yml with profiles and imports', lang: 'yaml', code: `app:
  inventory:
    base-url: http://localhost:8089
    max-retries: 2
spring:
  config:
    import:
      - "optional:file:./local.yml"                 # developer overrides, not in Git
      - "optional:configtree:/run/secrets/shop/"    # mounted secrets in k8s
---
spring:
  config:
    activate:
      on-profile: prod
app:
  inventory:
    base-url: https://inventory.internal
    read-timeout: 800ms` },
    { title: 'Kubernetes: env vars and mounted secrets', lang: 'yaml', code: `env:
  - name: SPRING_PROFILES_ACTIVE
    value: prod
  - name: APP_INVENTORY_MAXRETRIES          # relaxed binding → app.inventory.max-retries
    value: "3"
volumeMounts:
  - name: shop-secrets
    mountPath: /run/secrets/shop            # files: app.inventory.auth.client-secret, …
    readOnly: true
volumes:
  - name: shop-secrets
    secret:
      secretName: shop-inventory-auth` },
    { title: 'Actuator: see sources without leaking values', lang: 'yaml', code: `management:
  endpoints:
    web:
      exposure:
        include: health,info,env,configprops
  endpoint:
    env:
      show-values: when-authorized          # Boot 3 default is never
      roles: OPS
    configprops:
      show-values: when-authorized
      roles: OPS` }
  ]
});

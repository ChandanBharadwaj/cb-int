IA.register({
  track: 'spring',
  slug: 'aot-native',
  title: 'AOT & native image',
  tagline: 'A normal Spring Boot app discovers itself at startup: it scans the classpath, parses <code>@Configuration</code> classes, evaluates conditions and uses reflection to build beans. <b>AOT processing</b> (Boot 3.0+) does that work at <b>build time</b> and generates plain Java code for it. <b>GraalVM native image</b> then compiles the app into a binary that starts in milliseconds, under a <b>closed-world</b> assumption: what isn’t known at build time doesn’t exist.',
  tldr: {
    problem: 'Seconds of startup and a JIT warm-up hurt scale-to-zero, serverless and fast autoscaling. Native images fix that, then fail at runtime on reflection nobody declared, on a profile that “doesn’t work”, or on a build that needs 8 GB of RAM in CI.',
    model: 'Build: Boot starts the application context <i>in the build</i>, records the bean definitions as generated code and writes <b>RuntimeHints</b> (reflection, resources, proxies, serialization) as reachability metadata. <code>native-image</code> analyses everything reachable from <code>main</code>, compiles it ahead of time and snapshots part of the heap. Run: no classpath scanning, no condition evaluation, no runtime bytecode generation.',
    hook: '“Why does <code>--spring.profiles.active=prod</code> not change which beans exist in my native app?” Conditions and profiles that decide <i>which beans</i> exist were evaluated at build time. Property <i>values</i> still bind at runtime; the bean set is fixed.',
    facts: [
      { v: 'Boot 3.0', l: 'GraalVM native image support became part of Spring Boot itself (it replaced the experimental Spring Native project)' },
      { v: 'build time', l: 'where <code>@Profile</code>, <code>@ConditionalOnProperty</code> and other bean-defining conditions are evaluated in an AOT-processed app' },
      { v: 'Boot 3.2', l: 'first Boot version with CRaC support (checkpoint/restore of a warmed-up JVM, on a CRaC-enabled JDK, Linux only)' }
    ]
  },
  intro: {
    what: 'Java normally starts slowly and gets fast later: the JVM loads classes, Spring figures out your beans, and the JIT compiler optimizes hot code as it runs. <b>Native image</b> moves all of that to build time and produces one executable file. It starts almost instantly and uses less memory, but the build is slow and some dynamic Java features need to be declared in advance.',
    analogy: { icon: '🍱', title: 'Meal prep vs cooking to order', text: 'A JVM app cooks to order: it can make anything on the menu, but the first plates are slow while the kitchen warms up. A native image is meal prep: everything is chopped, cooked and boxed on Sunday, so lunch takes seconds. You can only eat what you prepared; asking for an unplanned dish (reflection on an unknown class) gets you nothing.' },
    steps: [
      { t: 'AOT processing', d: 'The build plugin runs your app’s context setup and generates Java source for bean definitions, plus hint files.', code: './mvnw -Pnative native:compile\n./gradlew nativeCompile' },
      { t: 'Static analysis', d: 'GraalVM follows every reachable call from <code>main</code>. Unreachable code is left out; reflection needs metadata.' },
      { t: 'Compile and snapshot', d: 'Reachable code is compiled to machine code; some initialized objects are stored in the image heap.' },
      { t: 'Run the binary', d: 'Starts fast with low memory: no JIT warm-up, no classpath scanning.' },
      { t: 'Or keep the JVM', d: 'Use the AOT-generated code on the JVM (<code>-Dspring.aot.enabled=true</code>), class-data sharing, or CRaC for faster starts without going native.' }
    ],
    terms: [
      ['AOT processing', 'Spring’s build-time step that turns bean definitions into generated code and writes RuntimeHints.'],
      ['closed world', 'The assumption that all code and resources are known at build time.'],
      ['reachability metadata', 'JSON files telling native-image about reflection, resources, proxies and serialization it can’t see statically.'],
      ['RuntimeHints', 'Spring’s API for contributing that metadata (<code>RuntimeHintsRegistrar</code>).'],
      ['image heap', 'Objects created at build time and stored in the binary.'],
      ['CRaC', 'Coordinated Restore at Checkpoint: save a running JVM’s state and restore it later.']
    ]
  },
  visual: {
    title: 'Build time vs run time',
    caption: 'The top row is what happens in your build, the bottom row what happens every time a container starts; the small chart shows request throughput after start. Press Play for the regular JVM, then compare <b>AOT on the JVM</b>, <b>native</b> and <b>CRaC</b>, and see two ways the closed world bites. Durations are illustrative.'
  },
  gotchas: [
    { trap: 'Reflection the analysis can’t see', code: `Class<?> type = Class.forName(config.get("handler"));   // name only known at runtime
objectMapper.readValue(json, Map.class)… convert to a class used only here`, why: 'Native image only keeps reflective access to classes, methods and fields registered in metadata. Spring generates hints for what it knows (beans, <code>@RequestBody</code> types of controllers, configuration properties), but not for classes you load by name or bind only through your own reflection.', fix: 'Register hints: <code>@RegisterReflectionForBinding(Payload.class)</code> for JSON types, or a <code>RuntimeHintsRegistrar</code> imported with <code>@ImportRuntimeHints</code>. Run the test suite as a native test (<code>nativeTest</code>) to find what is missing.' },
    { trap: 'Profiles and conditional beans set at runtime', code: `@Bean @Profile("prod") Clock prodClock() { … }
./app --spring.profiles.active=prod     # prodClock is not there in the native binary`, why: 'AOT processing evaluates the conditions that decide which beans exist, once, at build time. The generated bean registration code contains only the result.', fix: 'Pass the profiles to AOT processing at build time (e.g. <code>spring.profiles.active</code> in the <code>process-aot</code> configuration), or turn bean-level switches into property-driven behaviour inside one bean. Property <i>values</i> are still read at runtime.' },
    { trap: 'Libraries without metadata', why: 'Many libraries use reflection, dynamic proxies or resources internally. Without metadata (shipped by the library or in the GraalVM reachability metadata repository), they fail in the native image only.', fix: 'Check the library’s native support before choosing native. The GraalVM build plugins pull metadata from the shared reachability-metadata repository; the tracing agent (<code>-agentlib:native-image-agent</code>) can record missing metadata from a JVM run.' },
    { trap: 'Expecting JIT-level peak throughput', why: 'A native image is compiled before it has seen any traffic. A JVM’s JIT optimizes using live profiles and often reaches higher peak throughput on long-running, CPU-heavy services. GraalVM Community Edition also only offers the Serial GC.', fix: 'Choose native for startup time, memory footprint and short-lived workloads (scale to zero, CLIs, functions). Benchmark your own service. Oracle GraalVM offers profile-guided optimization and G1 if you need more.' },
    { trap: 'Native builds in a small CI runner', why: '<code>native-image</code> runs a whole-program analysis that takes minutes and several GB of memory. A 4 GB runner fails or swaps.', fix: 'Give native builds a bigger runner or build the image with buildpacks (<code>spring-boot:build-image -Pnative</code>), and run JVM tests on every commit with native tests on a schedule or before release.' },
    { trap: 'Secrets and state inside a CRaC checkpoint', why: 'A CRaC checkpoint is a dump of the JVM’s memory. It contains whatever the app held: decrypted secrets, tokens, caches, random seeds. Open sockets and files must be closed before the checkpoint.', fix: 'Take checkpoints in a controlled build step, protect the image like a secret, reload secrets after restore, and let Spring’s lifecycle stop and restart pools and clients (Boot 3.2+ does this for its managed components). Re-seed anything that must differ per instance.' }
  ],
  scenarios: [
    { title: 'A native service returns empty JSON objects',
      symptom: 'The JVM build works. The native build starts in 70 ms, but one endpoint returns <code>{}</code> for objects that should have fields, and an import job fails with <code>ClassNotFoundException</code>.',
      diagnose: `# the controller returns ResponseEntity<Object> built from a Map → DTO conversion in a helper
# the import job does: Class.forName("com.shop.imports." + format + "Parser")
# GraalVM can't see either use statically, so no reflection metadata exists`,
      cause: 'The DTO was serialized through a generic type, so Spring’s hint generation didn’t see it as a binding type; Jackson found no accessible properties. The parser classes were only referenced by name.',
      fix: 'Register the binding types and the dynamically loaded classes, and add native tests for both paths.',
      fixCode: `@Configuration
@RegisterReflectionForBinding({ OrderDto.class, LineDto.class })   // Jackson (de)serialization
@ImportRuntimeHints(ImportHints.class)
class NativeConfig { }

class ImportHints implements RuntimeHintsRegistrar {
  @Override public void registerHints(RuntimeHints hints, ClassLoader cl) {
    for (String f : List.of("Csv", "Json", "Edi"))
      hints.reflection().registerType(TypeReference.of("com.shop.imports." + f + "Parser"),
          MemberCategory.INVOKE_PUBLIC_CONSTRUCTORS);
    hints.resources().registerPattern("imports/*.schema.json");
  }
}` },
    { title: 'Production uses the in-memory payment stub',
      symptom: 'After moving to native images, the production deployment calls the stub payment gateway. The JVM image with the same config worked.',
      diagnose: `@Bean @ConditionalOnProperty(name = "payments.mode", havingValue = "live") PaymentGateway live(…)
@Bean @ConditionalOnMissingBean PaymentGateway stub()
# CI ran process-aot with default properties → payments.mode unset → stub chosen at build time`,
      cause: 'The condition was evaluated during AOT processing in CI, where <code>payments.mode</code> wasn’t set. The binary only contained the stub bean, regardless of runtime config.',
      fix: 'Don’t select beans by environment in native builds. Keep both implementations as beans and pick at runtime from a property, or build separate images with the right properties at build time. Add a startup check that logs which gateway is active.',
      fixCode: `@Bean
PaymentGateway paymentGateway(PaymentsProperties props, LiveGateway live, StubGateway stub) {
  return switch (props.mode()) {                    // decided at runtime, works in native
    case LIVE -> live;
    case STUB -> stub;
  };
}` },
    { title: 'Cold starts time out after scaling to zero',
      symptom: 'A Knative service scaled to zero times out on the first request after idle periods: the JVM app needs about 6 s to be ready, the gateway waits 5 s.',
      diagnose: `# startup log (JVM)
Started BillingApplication in 5.84 seconds (process running for 6.41)
# most of it: classpath scanning, auto-configuration, Hibernate metamodel, JIT-less first requests`,
      cause: 'Scale-to-zero turns every cold start into user-facing latency, and a regular JVM start of a mid-sized Boot app took longer than the gateway timeout.',
      fix: 'Build a native image (startup in tens to hundreds of milliseconds for typical services) or, if a library blocks native, use CRaC or class-data sharing with AOT on the JVM. Measure: try all options against your own startup log.',
      fixCode: `# native image via buildpacks (no local GraalVM needed)
./mvnw -Pnative spring-boot:build-image -Dspring-boot.build-image.imageName=billing:native
# or with GraalVM installed
./mvnw -Pnative native:compile && ./target/billing`, lang: 'bash' }
  ],
  puzzles: [
    { kind: 'concept', q: 'In an AOT-processed (native) app, when is <code>@ConditionalOnProperty(name = "feature.x.enabled")</code> on a bean evaluated?', options: ['On every startup', 'At build time, during AOT processing', 'On first use of the bean', 'Never: it is ignored in native'], answer: 1, explain: 'AOT processing records the outcome of bean-defining conditions in generated code. Changing the property at runtime doesn’t add or remove the bean. Property values injected into beans still bind at runtime.' },
    { kind: 'concept', q: 'Which of these typically needs an explicit runtime hint in a native image?', options: ['A @Service injected by constructor', 'A class loaded with Class.forName(name) where the name comes from config', 'A @RestController method parameter type', 'An @ConfigurationProperties record'], answer: 1, explain: 'Spring generates hints for beans, controller binding types and configuration properties. A class name computed at runtime is invisible to the static analysis, so you register it with <code>RuntimeHints</code>.' },
    { kind: 'concept', q: 'What does <code>-Dspring.aot.enabled=true</code> do on a regular JVM?', options: ['Compiles the app to a native binary', 'Uses the AOT-generated bean definition code instead of runtime configuration processing', 'Enables the JIT', 'Disables reflection'], answer: 1, explain: 'If the app was built with AOT processing, the JVM can run the generated initialization code, skipping some startup work. Gains are modest compared with native, and the same closed-world rules for conditions apply.' },
    { kind: 'concept', q: 'For a long-running, CPU-heavy service with steady traffic, which statement is most accurate?', options: ['Native image always has higher throughput', 'A warmed-up JVM with JIT often matches or beats native peak throughput; native wins on startup and memory', 'They are identical', 'Native can’t serve HTTP'], answer: 1, explain: 'The JIT optimizes with real runtime profiles. Native image trades that for instant start and lower footprint (PGO in Oracle GraalVM narrows the gap). Benchmark your own workload.' },
    { kind: 'concept', q: 'What happens to a Hikari connection pool when you take a CRaC checkpoint of a Boot 3.2+ app?', options: ['The open connections are saved in the image and reused after restore', 'Spring stops lifecycle beans before the checkpoint (closing connections) and starts them again after restore', 'CRaC fails if a DataSource exists', 'Connections are kept but marked stale'], answer: 1, explain: 'Open sockets can’t be checkpointed. Spring Framework 6.1 integrates with CRaC: on checkpoint it stops <code>Lifecycle</code> beans, on restore it starts them, and the pool reconnects.' },
    { kind: 'concept', q: 'Why can’t a native image use CGLIB to create a proxy class at runtime?', options: ['CGLIB is too slow', 'There is no runtime class definition: proxy classes must be generated at build time, which Spring AOT does for the beans it knows', 'Native image has no interfaces', 'Proxies are disabled in Spring 6'], answer: 1, explain: 'The closed world means no new bytecode at runtime. Spring AOT generates the CGLIB proxy classes (for <code>@Configuration</code> classes and AOP proxies) during the build; JDK dynamic proxies need proxy hints.' }
  ],
  interview: [
    { q: 'What does Spring AOT processing actually generate?', a: '<p>During the build, Boot refreshes the application context in a special AOT mode that creates bean <i>definitions</i> but not beans. From them it generates Java source: classes registering each bean definition and how to instantiate and inject it (no reflection, no scanning), CGLIB proxy classes for <code>@Configuration</code> and AOP, and <code>RuntimeHints</code> written as GraalVM reachability metadata (reflection, resources, proxies, serialization). At runtime the app runs the generated initializer instead of parsing configuration.</p>', lvl: 'core' },
    { q: 'What are the restrictions of the closed-world assumption for Spring apps?', a: '<ul><li>The classpath is fixed at build time.</li><li>The bean set is fixed: <code>@Profile</code> and conditions that create beans are evaluated during the build.</li><li>No runtime bytecode generation: proxies are generated at build time.</li><li>Reflection, resources, dynamic proxies and serialization need metadata.</li><li>Lazy-loaded or plugin code discovered at runtime doesn’t work.</li></ul>', lvl: 'core' },
    { q: 'When would you choose native image, and when not?', a: '<p>Choose it for fast startup and low memory: scale to zero, serverless functions, CLIs, many small services on dense nodes, fast autoscaling. Avoid it when build time and complexity outweigh the gain: long-running services with steady load where the JVM’s JIT and GC options shine, apps that rely on libraries without native support, or teams without CI capacity for native builds and native tests.</p>', lvl: 'core' },
    { q: 'How do you add missing metadata?', a: '<p>For Spring apps, contribute <code>RuntimeHints</code>: <code>@RegisterReflectionForBinding</code> for data types, <code>@ImportRuntimeHints</code> with a <code>RuntimeHintsRegistrar</code> for reflection, resources, proxies and serialization, or <code>@Reflective</code> on members. For third-party libraries, use metadata shipped in the jar (<code>META-INF/native-image/</code>) or the GraalVM reachability metadata repository. The native-image tracing agent can record what a JVM run uses.</p>', lvl: 'deep' },
    { q: 'How do you test a native application?', a: '<p>Run the normal tests on the JVM on every commit. Before release, run them as native tests (<code>./gradlew nativeTest</code> or <code>./mvnw -PnativeTest test</code>): the test suite itself is compiled into a native image. Some tests can’t run there (heavy mocking); exclude them with <code>@DisabledInAotMode</code>. Also smoke-test the final container image.</p>', lvl: 'core' },
    { q: 'Explain CRaC and compare it with native image.', a: '<p>CRaC (Coordinated Restore at Checkpoint, an OpenJDK project, available in JDKs such as Azul Zulu and BellSoft Liberica) snapshots a running JVM to disk and restores it later in milliseconds, with classes loaded and JIT-compiled code warm. Boot 3.2+ (Spring Framework 6.1) supports it: lifecycle beans are stopped before the checkpoint and restarted after restore; <code>-Dspring.context.checkpoint=onRefresh</code> takes an automatic checkpoint at startup. Compared with native: it is still a full JVM (no closed world, full JIT), but Linux-only, needs a CRaC JDK, and the snapshot contains memory contents, including secrets.</p>', lvl: 'deep' },
    { q: 'What changes in memory and GC with native image?', a: '<p>Native images usually use less memory at startup: no JIT compiler, no class metadata loading, part of the heap pre-initialized. GraalVM Community Edition uses the Serial GC by default (Oracle GraalVM also offers G1 on Linux), so heap sizing and pause behaviour differ from the JVM; set <code>-Xmx</code> explicitly in containers. JVM tools like JFR exist in a reduced form; heap dumps and debugging need build options.</p>', lvl: 'deep' },
    { q: 'What other options exist to start a Spring app faster without native?', a: '<p>Class-data sharing (an AppCDS archive created from a training run; Boot 3.3+ documents it with <code>-Dspring.context.exit=onRefresh</code>), AOT mode on the JVM, CRaC, lazy initialization, trimming auto-configuration and classpath, and newer JDK work (JDK 24’s ahead-of-time class loading and linking cache from Project Leyden). See <a href="startup-performance.html">Startup &amp; runtime performance</a>.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Build a native image', lang: 'bash', code: `# Maven, with spring-boot-starter-parent: the native profile is predefined
./mvnw -Pnative native:compile            # needs GraalVM (JDK 17+; 21+ for virtual threads)
./target/orders                           # run the binary

# container image via buildpacks, no local GraalVM
./mvnw -Pnative spring-boot:build-image

# Gradle with the org.graalvm.buildtools.native plugin
./gradlew nativeCompile && build/native/nativeCompile/orders
./gradlew nativeTest                      # run tests as a native image

# AOT-generated code on a normal JVM
java -Dspring.aot.enabled=true -jar target/orders.jar` },
    { title: 'Runtime hints for what Spring can’t see', lang: 'java', code: `@SpringBootApplication
@ImportRuntimeHints(OrdersApplication.Hints.class)
@RegisterReflectionForBinding({ WebhookEvent.class, WebhookEvent.Line.class })
public class OrdersApplication {
  public static void main(String[] args) { SpringApplication.run(OrdersApplication.class, args); }

  static class Hints implements RuntimeHintsRegistrar {
    @Override public void registerHints(RuntimeHints hints, ClassLoader cl) {
      hints.resources().registerPattern("templates/*.mustache");
      hints.reflection().registerType(LegacyCodec.class, MemberCategory.INVOKE_DECLARED_CONSTRUCTORS, MemberCategory.INVOKE_DECLARED_METHODS);
      hints.proxies().registerJdkProxy(AuditListener.class);
      hints.serialization().registerType(SessionToken.class);
    }
  }
}

// verify hints in a plain JVM unit test
@Test void hintsCoverCodec() {
  RuntimeHints hints = new RuntimeHints();
  new OrdersApplication.Hints().registerHints(hints, getClass().getClassLoader());
  assertThat(RuntimeHintsPredicates.reflection().onType(LegacyCodec.class)).accepts(hints);
}` },
    { title: 'CRaC checkpoint and restore', lang: 'bash', code: `# CRaC-enabled JDK (e.g. Azul Zulu or Liberica with CRaC), Linux, Boot 3.2+, org.crac dependency
java -Dspring.context.checkpoint=onRefresh -XX:CRaCCheckpointTo=/opt/crac -jar app.jar
#   → context refreshed, lifecycle beans stopped, JVM state written to /opt/crac, process exits

java -XX:CRaCRestoreFrom=/opt/crac
#   → JVM restored, lifecycle beans restarted (pools reconnect), serving requests

# manual checkpoint of a warmed-up process instead of onRefresh
jcmd app.jar JDK.checkpoint`, note: 'The checkpoint files hold the JVM’s memory. Treat them like secrets and build them in a controlled pipeline step.' }
  ]
});

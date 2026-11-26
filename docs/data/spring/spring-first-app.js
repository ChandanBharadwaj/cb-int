IA.register({
  track: 'spring',
  slug: 'spring-first-app',
  title: 'Your first Boot app',
  tagline: 'Generate a project on <b>start.spring.io</b>, add one controller, run <code>main</code>. Boot starts an <b>embedded Tomcat</b> on port 8080, and <code>./mvnw package</code> turns it all into one runnable jar.',
  tldr: {
    problem: 'Beginners lose hours on project setup: which dependencies, which versions, which folder, why the controller gives 404.',
    model: '<code>main()</code> → <code>SpringApplication.run()</code> → component scan <b>from the main class’s package down</b> → auto-configuration → embedded server listening → requests reach your beans.',
    hook: '“What does <code>@SpringBootApplication</code> do?” It combines <code>@Configuration</code>, <code>@EnableAutoConfiguration</code> and <code>@ComponentScan</code>.',
    facts: [
      { v: '8080', l: 'default HTTP port of the embedded server; change with <code>server.port</code>' },
      { v: '3 in 1', l: '<code>@SpringBootApplication</code> = <code>@SpringBootConfiguration</code> + <code>@EnableAutoConfiguration</code> + <code>@ComponentScan</code>' },
      { v: 'java -jar', l: 'how a packaged Boot app runs: the jar contains your code and all dependencies' }
    ]
  },
  intro: {
    what: 'You will build a tiny web app that answers <code>GET /hello</code>. The site <b>start.spring.io</b> (Spring Initializr) generates a ready project: a build file, a main class and folders. You add one class, press Run, and open <code>localhost:8080/hello</code> in a browser.',
    analogy: { icon: '🍱', title: 'A meal kit', text: 'start.spring.io is the meal-kit order form: pick the dish (Java, Maven, Boot 3.x) and the ingredients (Spring Web). The box arrives with everything measured. Your only job is the last step of cooking: writing your own class.' },
    steps: [
      { t: 'Generate', d: 'On start.spring.io choose Maven (or Gradle), Java 17 or 21, the latest Boot 3.x, and add the <b>Spring Web</b> dependency. Download and unzip.' },
      { t: 'Look around', d: '<code>pom.xml</code> (build file), <code>mvnw</code> (Maven wrapper, no install needed), <code>src/main/java/…/DemoApplication.java</code>, <code>src/main/resources/application.properties</code>, <code>src/test/java</code>.' },
      { t: 'Add a controller', d: 'Put it in the same package as the main class, or below it.', code: '@RestController\nclass HelloController {\n  @GetMapping("/hello")\n  String hello() { return "Hello, Spring"; }\n}' },
      { t: 'Run', d: 'Run <code>main</code> in the IDE, or from a terminal:', code: './mvnw spring-boot:run      # Gradle: ./gradlew bootRun', lang: 'bash' },
      { t: 'Package and ship', d: 'Build one executable jar and run it anywhere with Java 17+.', code: './mvnw package\njava -jar target/demo-0.0.1-SNAPSHOT.jar', lang: 'bash' }
    ],
    terms: [
      ['Spring Initializr', 'The project generator at start.spring.io (also built into IntelliJ and VS Code).'],
      ['Maven / Gradle', 'Build tools: download dependencies, compile, test, package. Maven uses <code>pom.xml</code>, Gradle uses <code>build.gradle(.kts)</code>.'],
      ['wrapper (mvnw / gradlew)', 'A script in the project that downloads the right build-tool version, so everyone builds the same way.'],
      ['embedded Tomcat', 'A web server running inside your app’s JVM, started by Boot.'],
      ['executable (fat) jar', 'One jar holding your classes plus every dependency, runnable with <code>java -jar</code>.']
    ]
  },
  visual: {
    title: 'Watch your app start',
    caption: 'Pick a scenario and press Play or Step. <b>Start &amp; first request</b> shows the happy path, <b>Controller not found</b> shows the classic package mistake, <b>Package &amp; run</b> shows the build.'
  },
  gotchas: [
    { trap: 'Controller outside the main package → 404', code: 'com.example.demo.DemoApplication   // @SpringBootApplication\ncom.example.api.HelloController     // sibling package: NOT scanned', lang: 'text', why: 'Component scanning starts at the package of the <code>@SpringBootApplication</code> class and goes down only.', fix: 'Keep the main class in the root package (<code>com.example.demo</code>) and everything else in sub-packages.' },
    { trap: 'Port 8080 already in use', code: 'Web server failed to start. Port 8080 was already in use.', lang: 'text', why: 'Another app (often a previous run of yours) is still listening.', fix: 'Stop the old process, or set <code>server.port=8081</code>. <code>server.port=0</code> picks a random free port (handy in tests).' },
    { trap: 'Running the plain jar instead of the repackaged one', why: 'Without the <code>spring-boot-maven-plugin</code> (or the Boot Gradle plugin), <code>package</code> produces a normal jar without dependencies or launcher: “no main manifest attribute”.', fix: 'Keep the plugin the Initializr generated. With Gradle use <code>bootJar</code>; the <code>-plain.jar</code> is not the runnable one.' },
    { trap: 'Expecting a page at <code>/</code>', why: 'A new app has no mapping for <code>/</code>, so the browser shows the “Whitelabel Error Page” (404). That means the app <b>is</b> running.', fix: 'Call your mapped path (<code>/hello</code>), or add <code>src/main/resources/static/index.html</code>.' },
    { trap: 'App starts then exits immediately', why: 'No web starter on the classpath means no server, so <code>main</code> finishes and the JVM exits. Common when “Spring Web” was not ticked.', fix: 'Add <code>spring-boot-starter-web</code>. (A non-web app that exits is fine if that is what you wanted.)' }
  ],
  scenarios: [
    { title: 'Every endpoint returns 404 after a package refactor', symptom: 'After moving classes into “cleaner” packages, every endpoint returns 404. Startup log looks normal.', diagnose: 'Log shows no mapping lines for the moved controllers; the main class is in <code>com.acme.app</code>, controllers now in <code>com.acme.web</code>.', cause: 'The controllers left the component-scan tree, so no beans were created and nothing was mapped.', fix: 'Move the main class up to the common root package, or set the scan root explicitly.', fixCode: '@SpringBootApplication(scanBasePackages = "com.acme")\npublic class App { … }' },
    { title: 'Container keeps restarting', symptom: 'In Docker the app starts and stops in a loop with exit code 0.', diagnose: 'The image runs <code>java -jar app-plain.jar</code> from a Gradle build.', cause: 'The plain jar has no Boot launcher or dependencies; with a different artifact the web server never started and the process ended.', fix: 'Copy the <code>bootJar</code> output (or disable the plain jar).', fixCode: 'tasks.named("jar") { enabled = false }   // build.gradle.kts: only the boot jar is produced', lang: 'text' }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which three annotations does <code>@SpringBootApplication</code> combine?', options: ['@Component, @Service, @Repository', '@SpringBootConfiguration (@Configuration), @EnableAutoConfiguration, @ComponentScan', '@RestController, @RequestMapping, @ResponseBody', '@EnableWebMvc, @EnableJpa, @EnableCaching'], answer: 1, explain: 'It marks the class as a configuration source, turns on auto-configuration, and scans components from its own package downward.' },
    { kind: 'predict', q: 'Main class is <code>com.shop.ShopApp</code>. Which controller is <b>not</b> picked up by default?', options: ['com.shop.web.OrderController', 'com.shop.OrderController', 'com.shopping.OrderController', 'com.shop.a.b.c.OrderController'], answer: 2, explain: '<code>com.shopping</code> is a different package, not a sub-package of <code>com.shop</code>. The prefix match is by package segments, not text.' },
    { kind: 'concept', q: 'What does <code>./mvnw package</code> produce for a Boot project?', options: ['A war you must deploy to Tomcat', 'An executable jar with your classes and all dependencies', 'Only .class files in target/classes', 'A Docker image'], answer: 1, explain: 'The Spring Boot Maven plugin repackages the jar so it runs with <code>java -jar</code>. Images are a separate goal (<code>spring-boot:build-image</code>).' },
    { kind: 'concept', q: 'You open <code>http://localhost:8080/</code> and see “Whitelabel Error Page … 404”. What does that tell you?', options: ['Tomcat is not installed', 'The app is running; nothing is mapped to /', 'Java version is too old', 'The pom is broken'], answer: 1, explain: 'The error page is rendered by your running Boot app. It just has no handler for <code>/</code>.' },
    { kind: 'concept', q: 'Why commit <code>mvnw</code> / <code>gradlew</code> to the repo?', options: ['They contain your secrets', 'So everyone and CI use the same build-tool version without installing it', 'They are required by the JVM', 'They speed up Tomcat'], answer: 1, explain: 'The wrapper downloads the pinned Maven or Gradle version on first use.' },
    { kind: 'concept', q: 'How do you change the port to 9090?', options: ['Edit Tomcat’s server.xml', '<code>server.port=9090</code> in application.properties', 'Pass <code>-port 9090</code> to javac', 'Rename the jar'], answer: 1, explain: 'Embedded server settings live under <code>server.*</code>. You could also pass <code>--server.port=9090</code> on the command line.' }
  ],
  interview: [
    { q: 'Walk me through what happens when a Boot app starts.', a: '<ol><li>JVM calls <code>main</code>; it calls <code>SpringApplication.run</code>.</li><li>Boot prepares the Environment (properties, profiles).</li><li>It creates the ApplicationContext, scans components, applies auto-configuration.</li><li>Singleton beans are created and wired.</li><li>The embedded web server starts; <code>ApplicationReadyEvent</code> fires.</li></ol>', lvl: 'core' },
    { q: 'What does @SpringBootApplication do?', a: '<p>Shortcut for <code>@SpringBootConfiguration</code> (a <code>@Configuration</code>), <code>@EnableAutoConfiguration</code> and <code>@ComponentScan</code> rooted at the annotated class’s package.</p>', lvl: 'core' },
    { q: 'Why put the main class in the root package?', a: '<p>Because component scanning (and JPA entity/repository scanning) defaults to that package and its sub-packages. Classes elsewhere are not found unless you configure extra packages.</p>', lvl: 'core' },
    { q: 'Maven or Gradle: does it matter for Boot?', a: '<p>Not for the app. Both are fully supported, with a Boot plugin each (<code>spring-boot-maven-plugin</code>, <code>org.springframework.boot</code> Gradle plugin) that manages versions and builds the executable jar.</p>', lvl: 'core' },
    { q: 'What is inside a Boot executable jar?', a: '<p><code>BOOT-INF/classes</code> (your code and resources), <code>BOOT-INF/lib</code> (dependency jars), and Boot’s launcher classes. The manifest’s <code>Main-Class</code> is the launcher, which then calls your main class (<code>Start-Class</code>).</p>', lvl: 'deep' },
    { q: 'How do you run a Boot app during development?', a: '<p>Run <code>main</code> from the IDE, or <code>./mvnw spring-boot:run</code> / <code>./gradlew bootRun</code>. <code>spring-boot-devtools</code> adds automatic restart on classpath changes.</p>', lvl: 'core' },
    { q: 'Jar or war?', a: '<p>Jar with embedded server is the default and the usual choice for containers. A war is still possible (extend <code>SpringBootServletInitializer</code>) when you must deploy into an existing servlet container.</p>', lvl: 'core' },
    { q: 'Which web server does starter-web use, and can you change it?', a: '<p>Tomcat by default. Exclude <code>spring-boot-starter-tomcat</code> and add <code>spring-boot-starter-jetty</code> (or Undertow, where supported by your Boot version) to switch.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Project layout', lang: 'text', code: `demo/
├─ pom.xml                     # parent: spring-boot-starter-parent 3.x
├─ mvnw, mvnw.cmd, .mvn/       # Maven wrapper
└─ src/
   ├─ main/java/com/example/demo/
   │  ├─ DemoApplication.java  # @SpringBootApplication, root package
   │  └─ web/HelloController.java
   ├─ main/resources/
   │  ├─ application.properties
   │  └─ static/               # optional static files (index.html)
   └─ test/java/com/example/demo/
      └─ DemoApplicationTests.java  # @SpringBootTest: context loads`, note: 'Everything under <code>com.example.demo</code> is scanned.' },
    { title: 'Key parts of pom.xml', lang: 'text', code: `<parent>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-parent</artifactId>
  <version>3.x.y</version>  <!-- pick the current 3.x release -->
</parent>
<properties><java.version>17</java.version></properties>
<dependencies>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>   <!-- no version: managed -->
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
  </dependency>
</dependencies>
<build><plugins><plugin>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-maven-plugin</artifactId>  <!-- makes the jar executable -->
</plugin></plugins></build>` },
    { title: 'Gradle equivalent', lang: 'text', code: `plugins {
  java
  id("org.springframework.boot") version "3.x.y"
  id("io.spring.dependency-management") version "1.1.x"
}
java { toolchain { languageVersion = JavaLanguageVersion.of(17) } }
dependencies {
  implementation("org.springframework.boot:spring-boot-starter-web")
  testImplementation("org.springframework.boot:spring-boot-starter-test")
}
// ./gradlew bootRun   |   ./gradlew bootJar → build/libs/demo-0.0.1-SNAPSHOT.jar` }
  ]
});

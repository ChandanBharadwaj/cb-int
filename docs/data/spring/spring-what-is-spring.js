IA.register({
  track: 'spring',
  slug: 'spring-what-is-spring',
  title: 'What Spring & Boot are',
  tagline: '<b>Spring Framework</b> is a container that creates your objects and wires them together. <b>Spring Boot</b> sits on top and sets up the boring parts for you: starters, auto-configuration and an embedded server.',
  tldr: {
    problem: 'A real Java backend needs a web server, JSON, a database pool, transactions, security and config. Wiring all that by hand is slow and easy to get wrong.',
    model: 'Spring = <b>a bean container + libraries</b> (MVC, Data, Security…). Boot = <b>opinions on top</b>: add a starter, Boot sees the jars on your classpath and configures sensible defaults, backing off when you define your own.',
    hook: '“What is the difference between Spring and Spring Boot?” Boot is not a different framework. It is Spring, plus starters, auto-configuration, an embedded server and an executable jar.',
    facts: [
      { v: '17+', l: 'minimum Java version for Spring Boot 3.x (built on Spring Framework 6). Boot 4 (Framework 7) kept the same minimum' },
      { v: 'jakarta.*', l: 'Boot 3 moved from <code>javax.*</code> to Jakarta EE 9+ package names' },
      { v: '1 starter', l: '<code>spring-boot-starter-web</code> brings Spring MVC, Jackson and embedded Tomcat. Boot 4: it is named <code>spring-boot-starter-webmvc</code>; the old name is deprecated' }
    ]
  },
  intro: {
    what: 'A backend app is made of many objects that need each other: a controller needs a service, a service needs a repository, the repository needs a database connection. <b>Spring</b> creates these objects for you (they are called <b>beans</b>) and hands each one the others it needs. <b>Spring Boot</b> is the quick-start kit: you pick features, and it pre-configures everything those features need.',
    analogy: { icon: '🏠', title: 'A house kit versus a pile of bricks', text: 'Spring Framework is a box of excellent building parts and a crew that assembles them for you. Spring Boot is the same parts sold as a ready-to-live-in kit: wiring, plumbing and doors already fitted to a standard plan. You can still knock down a wall (override a default) whenever you want.' },
    steps: [
      { t: 'Spring Framework: the core', d: 'The <b>IoC container</b> (ApplicationContext) creates beans and injects their dependencies. Around it sit modules: Spring MVC for web, transactions, data access, testing.' },
      { t: 'Spring Boot: starters', d: 'One dependency per feature. Versions are managed for you, so libraries match.', code: '<dependency>\n  <groupId>org.springframework.boot</groupId>\n  <artifactId>spring-boot-starter-web</artifactId>\n</dependency>', lang: 'text' },
      { t: 'Spring Boot: auto-configuration', d: 'At startup Boot checks what is on the classpath and which beans you already defined, then adds sensible default beans for the rest.' },
      { t: 'Spring Boot: embedded server + runnable jar', d: 'Tomcat runs inside your app. You ship one jar and start it with <code>java -jar app.jar</code>.' },
      { t: 'The ecosystem', d: 'Spring Data (databases), Spring Security (auth), Spring Cloud (distributed systems), Spring Batch, Spring Kafka… each with its own starter.' }
    ],
    terms: [
      ['bean', 'An object created and managed by the Spring container.'],
      ['IoC container / ApplicationContext', 'The part of Spring that creates beans and injects dependencies. “Inversion of control”: the framework builds your objects, not you.'],
      ['dependency injection (DI)', 'Giving an object what it needs (usually via its constructor) instead of it creating those things itself.'],
      ['starter', 'A Boot dependency that bundles a tested set of libraries for one feature.'],
      ['auto-configuration', 'Boot classes that create default beans when certain conditions hold (a class is present, a bean is missing, a property is set).'],
      ['classpath', 'All the classes and jars the JVM can load for your app.']
    ]
  },
  visual: {
    title: 'From a starter to ready-made beans',
    caption: 'Pick <b>Spring Boot</b>, <b>Plain Spring</b> or <b>Boot backs off</b>, then press Play or Step. Green boxes are beans that exist; dashed boxes were skipped.'
  },
  gotchas: [
    { trap: 'Thinking Boot replaces Spring', why: 'Boot has no DI container of its own. Every Boot app is a Spring Framework app; Boot just configures it.', fix: 'Learn the core ideas (beans, DI, the context) first: <a href="ioc-di.html">IoC &amp; DI</a>. Boot knowledge builds on them.' },
    { trap: 'Adding versions to every starter', code: '<artifactId>spring-boot-starter-web</artifactId>\n<version>3.1.0</version>  <!-- fighting the parent -->', lang: 'text', why: 'The Boot parent POM (or the Gradle plugin with dependency management) already picks matching versions. Hard-coding versions can mix incompatible jars.', fix: 'Leave out <code>&lt;version&gt;</code> for Boot-managed dependencies. Upgrade by changing the Boot version once. See <a href="starters-dependencies.html">Starters &amp; dependencies</a>.' },
    { trap: 'Copying Boot 2 tutorials into Boot 3', code: 'import javax.persistence.Entity;   // Boot 2\nimport jakarta.persistence.Entity; // Boot 3', why: 'Boot 3 uses Jakarta EE 9+ namespaces. Old <code>javax.*</code> imports for persistence, servlet and validation no longer compile.', fix: 'Use <code>jakarta.*</code> imports and Java 17+. Check the tutorial’s Boot version before copying.' },
    { trap: 'Treating auto-configuration as magic you cannot see', why: 'When a bean appears or does not, beginners guess. Boot actually records every decision.', fix: 'Start with <code>--debug</code> (or <code>debug=true</code>) to print the <b>conditions evaluation report</b>: which auto-configurations matched and why. Deep dive: <a href="auto-configuration.html">Auto-configuration</a>.' },
    { trap: 'Adding starters “just in case”', why: 'Each starter can trigger auto-configuration. Adding <code>spring-boot-starter-data-jpa</code> without a database configured makes startup fail looking for a DataSource.', fix: 'Add a starter only when you use the feature, and configure what it needs (e.g. a datasource URL).' }
  ],
  scenarios: [
    { title: 'App fails to start right after adding the JPA starter', symptom: 'A working web app now dies at startup with “Failed to configure a DataSource: \'url\' attribute is not specified and no embedded datasource could be configured.”', diagnose: 'The only change was adding <code>spring-boot-starter-data-jpa</code> to the pom.', cause: 'The starter put JPA and a connection pool on the classpath, so DataSource auto-configuration kicked in. No URL was configured and no embedded database (H2) was present.', fix: 'Either configure a real database or add H2 for local work. Remove the starter if you do not need JPA yet.', fixCode: 'spring.datasource.url=jdbc:postgresql://localhost:5432/library\nspring.datasource.username=app\nspring.datasource.password=${DB_PASSWORD}', lang: 'text' },
    { title: 'Custom JSON settings silently ignored', symptom: 'Dates still serialize as numbers although a developer “configured” Jackson.', diagnose: 'Searching the code shows a <code>new ObjectMapper()</code> created inside a service and configured there, while controllers use the Spring-managed one.', cause: 'Spring MVC uses the <b>bean</b> from the container, built by Boot’s Jackson auto-configuration. An object you <code>new</code> yourself is invisible to Spring.', fix: 'Configure the managed mapper through properties, or define a bean so auto-configuration backs off.', fixCode: 'spring.jackson.serialization.write-dates-as-timestamps=false', lang: 'text' }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which statement best describes Spring Boot?', options: ['A replacement for Spring Framework with its own DI container', 'An opinionated layer on Spring Framework: starters, auto-configuration, embedded server', 'A Java application server like WildFly', 'A code generator that writes your controllers'], answer: 1, explain: 'Boot reuses Spring Framework’s container and modules. It adds dependency management (starters), auto-configuration, an embedded server and executable-jar packaging.' },
    { kind: 'concept', q: 'What does <code>spring-boot-starter-web</code> mainly do?', options: ['Generates a website template', 'Pulls in a tested set of dependencies: Spring MVC, Jackson, embedded Tomcat', 'Starts a browser when the app starts', 'Enables Spring Security'], answer: 1, explain: 'A starter is a dependency descriptor. It brings libraries onto the classpath; auto-configuration then reacts to them.' },
    { kind: 'concept', q: 'You define your own <code>ObjectMapper</code> bean. What does Boot’s Jackson auto-configuration do?', options: ['Creates a second ObjectMapper and fails startup', 'Overwrites yours with its default', 'Backs off and uses yours (@ConditionalOnMissingBean)', 'Merges both mappers'], answer: 2, explain: 'Most auto-configured beans are guarded by <code>@ConditionalOnMissingBean</code>. If you defined one, the default is skipped.' },
    { kind: 'concept', q: 'Dependency injection is a feature of…', options: ['Spring Boot only', 'Spring Framework (Boot uses it)', 'The JVM', 'Jakarta Servlet'], answer: 1, explain: 'The IoC container is in Spring Framework (<code>spring-context</code>). Plain Spring apps without Boot have DI too.' },
    { kind: 'concept', q: 'Minimum Java version for Spring Boot 3.x?', options: ['8', '11', '17', '21'], answer: 2, explain: 'Boot 3 is built on Spring Framework 6, which requires Java 17. Java 21 is supported and common, but not required. Boot 4: still 17, with Java 25 recommended.' },
    { kind: 'concept', q: 'Which project would you add to protect endpoints with login and roles?', options: ['Spring Data', 'Spring Batch', 'Spring Security', 'Spring Cloud Config'], answer: 2, explain: 'Spring Security handles authentication and authorization. Add <code>spring-boot-starter-security</code>.' }
  ],
  interview: [
    { q: 'What is the difference between Spring and Spring Boot?', a: '<p>Spring Framework provides the IoC container and modules (MVC, transactions, data access). Spring Boot builds on it with <b>starters</b> (managed dependencies), <b>auto-configuration</b>, an <b>embedded server</b>, an executable jar and production features like Actuator. Boot reduces setup; it does not change how Spring works.</p>', lvl: 'core' },
    { q: 'What is a bean?', a: '<p>An object whose lifecycle is managed by the Spring container: created, given its dependencies, optionally initialised and later destroyed. By default there is one shared instance (singleton scope) per container.</p>', lvl: 'core' },
    { q: 'Explain auto-configuration in one sentence.', a: '<p>Boot looks at what is on the classpath, which beans you already defined and which properties are set, and registers default beans for whatever is still missing.</p>', fu: 'How can you see which auto-configurations applied? (<code>--debug</code> conditions report, or Actuator’s <code>conditions</code> endpoint.)', lvl: 'core' },
    { q: 'What is a starter?', a: '<p>A dependency (often with no code of its own) that pulls in a curated, version-aligned set of libraries for one feature, e.g. <code>spring-boot-starter-data-jpa</code>.</p>', lvl: 'core' },
    { q: 'What is inversion of control?', a: '<p>Instead of your code creating its collaborators with <code>new</code>, the framework creates them and passes them in. Control over object creation is “inverted” to the container. DI is the usual way to do it.</p>', lvl: 'core' },
    { q: 'Why does Boot use an embedded server?', a: '<p>The app becomes a self-contained jar started with <code>java -jar</code>. There is no separate server to install or keep in version sync, which fits containers and cloud platforms. War deployment to an external server is still possible.</p>', lvl: 'core' },
    { q: 'How do you override a default that Boot configured?', a: '<ol><li>Set a property (e.g. <code>server.port=9090</code>).</li><li>If that is not enough, define your own bean of that type; the auto-configuration backs off.</li><li>As a last resort, exclude the auto-configuration class.</li></ol>', lvl: 'core' },
    { q: 'Name some projects in the Spring ecosystem.', a: '<p>Spring Data (JPA, JDBC, MongoDB…), Spring Security, Spring Cloud, Spring Batch, Spring Integration, Spring for Apache Kafka, Spring AI. Most have a Boot starter.</p>', lvl: 'core' },
    { q: 'What changed going from Boot 2 to Boot 3?', a: '<p>Java 17 baseline, Spring Framework 6, Jakarta EE 9+ (<code>jakarta.*</code> packages), observability via Micrometer, and support for GraalVM native images (AOT).</p>', fu: 'And Boot 3 to Boot 4? (Still Java 17. Framework 7, Jakarta EE 11, modular starters, Jackson 3, no Undertow. See <a href="boot-4-migration.html">Boot 3 → 4</a>.)', lvl: 'deep' }
  ],
  code: [
    { title: 'Smallest Boot app', lang: 'java', code: `package com.example.demo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication
public class DemoApplication {
  public static void main(String[] args) {
    SpringApplication.run(DemoApplication.class, args);
  }
}

@RestController
class HelloController {
  @GetMapping("/hello")
  String hello() { return "Hello, Spring"; }
}`, note: 'One starter, two classes. Tomcat, MVC and JSON were configured by Boot.' },
    { title: 'Overriding a default', lang: 'java', code: `@Configuration
class JsonConfig {
  // Boot's JacksonAutoConfiguration sees this bean and backs off.
  @Bean
  ObjectMapper objectMapper() {
    return JsonMapper.builder()
        .findAndAddModules()
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
        .build();
  }
}`, note: 'Prefer <code>spring.jackson.*</code> properties or a <code>Jackson2ObjectMapperBuilderCustomizer</code> first: replacing the whole bean also drops Boot’s other defaults. Boot 4: JSON is Jackson 3, so the bean is a <code>JsonMapper</code> and the customizer is <code>JsonMapperBuilderCustomizer</code>.' }
  ]
});

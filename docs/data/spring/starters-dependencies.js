IA.register({
  track: 'spring',
  slug: 'starters-dependencies',
  title: 'Starters & dependency management',
  tagline: 'A <b>starter</b> is a dependency that brings a tested set of libraries for one feature. The <b>Boot BOM</b> (<code>spring-boot-dependencies</code>) pins the version of every one of them, so the whole classpath is a combination someone has tested. Most dependency trouble starts when something escapes that BOM: a transitive version Maven picked by depth, a Gradle platform that lost to a higher version, or a hand-written <code>&lt;version&gt;</code>.',
  tldr: {
    problem: '<code>NoSuchMethodError</code> or <code>ClassNotFoundException</code> at runtime, a CVE you can’t patch until “the next Boot release”, and builds where Maven and Gradle resolve the same libraries to different versions.',
    model: 'Starters declare <i>what</i>; the BOM declares <i>which version</i>. Maven without management picks the <b>nearest</b> declaration in the tree. Gradle picks the <b>highest</b>. A Maven BOM in <code>&lt;dependencyManagement&gt;</code> overrides both depth and version for every artifact it lists. To change a managed version, override the BOM’s <b>property</b> so the whole library family moves together.',
    hook: '“How do you upgrade one library that Boot manages?” Override its version property (<code>&lt;jackson-bom.version&gt;</code>, <code>tomcat.version</code>), then check <code>mvn dependency:tree</code>. Don’t add a bare <code>&lt;version&gt;</code> to one artifact.',
    facts: [
      { v: 'nearest vs highest', l: 'the default conflict rule in Maven (nearest definition in the tree) vs Gradle (highest requested version)' },
      { v: 'Java 17', l: 'minimum Java version for Spring Boot 3.x / Spring Framework 6.x, which also moved from <code>javax.*</code> to <code>jakarta.*</code>' },
      { v: 'spring-boot-dependencies', l: 'the BOM behind <code>spring-boot-starter-parent</code>, the Gradle plugin and <code>SpringBootPlugin.BOM_COORDINATES</code>' }
    ]
  },
  intro: {
    what: 'A Java app depends on libraries, which depend on other libraries (<b>transitive</b> dependencies). Picking compatible versions of dozens of them by hand is painful. Spring Boot solves this two ways: <b>starters</b> (e.g. <code>spring-boot-starter-web</code>) pull in everything a feature needs, and a <b>BOM</b> (bill of materials) fixes the version of each library, so you usually write dependencies with no version at all.',
    analogy: { icon: '🧾', title: 'A meal kit with a fixed shopping list', text: 'A starter is a meal kit: one box, everything for the recipe. The BOM is the store’s fixed price list: every ingredient has exactly one version on the shelf. Trouble starts when you bring your own spice jar from home (a hard-coded version), or when two recipes ask for different jars and the cashier picks one by a rule you didn’t know.' },
    steps: [
      { t: 'Inherit or import the BOM', d: 'With Maven, use <code>spring-boot-starter-parent</code> as the parent. With Gradle, apply the Spring Boot plugin (plus dependency management).', code: '<parent>\n  <groupId>org.springframework.boot</groupId>\n  <artifactId>spring-boot-starter-parent</artifactId>\n  <version>3.3.5</version>\n</parent>', lang: 'text' },
      { t: 'Add starters without versions', d: 'The BOM supplies the version.', code: '<dependency>\n  <groupId>org.springframework.boot</groupId>\n  <artifactId>spring-boot-starter-web</artifactId>\n</dependency>', lang: 'text' },
      { t: 'Look at what you really got', d: 'The dependency tree shows every transitive library and which version won.', code: 'mvn dependency:tree\n./gradlew dependencies --configuration runtimeClasspath', lang: 'bash' },
      { t: 'Change versions through properties', d: 'To move a managed library, set its BOM property, e.g. <code>&lt;jackson-bom.version&gt;</code>.' }
    ],
    terms: [
      ['starter', 'A dependency (mostly just a POM) that pulls in the libraries for one feature.'],
      ['BOM', '“Bill of materials”: a POM whose <code>&lt;dependencyManagement&gt;</code> lists versions only, to be imported elsewhere.'],
      ['transitive dependency', 'A library you get because one of your dependencies needs it.'],
      ['dependency mediation', 'The rule a build tool uses to choose one version when several are requested.'],
      ['exclusion', 'Telling the build to drop a transitive dependency, e.g. Tomcat when switching to Jetty.']
    ]
  },
  visual: {
    title: 'Who wins the version conflict?',
    caption: 'Your app pulls <code>jackson-databind</code> through two paths: Boot’s web starter (depth 3) and an old SDK (depth 2). Pick a build setup and whether the SDK wants an older or newer version, then press Play. Versions are illustrative.'
  },
  gotchas: [
    { trap: 'Maven picks the nearest version, not the newest', why: 'Without dependency management, a library two levels deep beats the same library three levels deep, even if it is years older. Boot’s integration code then calls a method that doesn’t exist in that version.', fix: 'Use the Boot parent or import its BOM, so managed artifacts ignore depth. Add the Maven Enforcer rules <code>dependencyConvergence</code> or <code>requireUpperBoundDeps</code> to catch unmanaged conflicts.' },
    { trap: 'Version properties don’t work when you import the BOM instead of inheriting it', code: `<properties>
  <jackson-bom.version>2.18.2</jackson-bom.version>   <!-- ignored: no parent -->
</properties>
<dependencyManagement><dependencies>
  <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-dependencies</artifactId>
    <version>3.3.5</version><type>pom</type><scope>import</scope></dependency>`, why: 'Properties override a <b>parent’s</b> values. An imported BOM is resolved on its own, with its own properties.', fix: 'Without the parent, import the library’s own BOM (here <code>jackson-bom</code>) <b>before</b> <code>spring-boot-dependencies</code> in <code>&lt;dependencyManagement&gt;</code>: the first declaration wins.' },
    { trap: 'Pinning one artifact of a family', code: `<dependency>
  <groupId>com.fasterxml.jackson.core</groupId>
  <artifactId>jackson-databind</artifactId>
  <version>2.18.2</version>        <!-- databind new, core & annotations still old -->
</dependency>`, why: 'An explicit version wins for that artifact only. Libraries released as a family (Jackson, Netty, Micrometer, Hibernate) expect matching versions across modules.', fix: 'Override the family’s BOM property (<code>jackson-bom.version</code>, <code>netty.version</code>), so every module moves together.' },
    { trap: 'Gradle platform() doesn’t enforce versions', why: 'With <code>implementation(platform(...))</code> the BOM’s versions are constraints that join normal conflict resolution, so a transitive dependency asking for a <i>higher</i> version wins. Maven users expect the BOM version.', fix: 'Accept it (it is often fine), or use <code>enforcedPlatform(...)</code>, a <code>strictly</code> constraint, or the <code>io.spring.dependency-management</code> plugin, which applies Maven-style semantics.' },
    { trap: 'javax.* libraries on Boot 3', why: 'Boot 3 uses Jakarta EE 9+ (<code>jakarta.servlet</code>, <code>jakarta.persistence</code>). A library compiled against <code>javax.servlet</code> still resolves fine, then fails at runtime with <code>ClassNotFoundException: javax.servlet.Filter</code> or simply isn’t picked up.', fix: 'Upgrade to the library’s Jakarta release (often a separate artifact or a <code>jakarta</code> classifier). Search the tree for <code>javax.servlet</code> and <code>javax.persistence</code> during the upgrade.' },
    { trap: 'Swapping an implementation without excluding the default', code: `<dependency><artifactId>spring-boot-starter-web</artifactId>
  <exclusions><exclusion><groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-tomcat</artifactId></exclusion></exclusions>
</dependency>
<dependency><artifactId>spring-boot-starter-jetty</artifactId></dependency>`, why: 'Starters bring a default (Tomcat, Logback, HikariCP). If you add an alternative but keep the default, both are on the classpath, and auto-configuration may still pick the default, or the app ends up with conflicting implementations (two SLF4J bindings, for example).', fix: 'Exclude the default starter, add the alternative, and verify with the dependency tree and the startup log.' }
  ],
  scenarios: [
    { title: '<code>NoSuchMethodError</code> in Jackson after adding a PDF SDK',
      symptom: 'Right after a release that added a vendor SDK, some endpoints fail with <code>java.lang.NoSuchMethodError: \'com.fasterxml.jackson.databind…\'</code>. Others work. Tests passed.',
      diagnose: `mvn dependency:tree -Dverbose -Dincludes=com.fasterxml.jackson.core
[INFO] +- com.vendor:pdf-sdk:jar:4.1:compile
[INFO] |  \\- com.fasterxml.jackson.core:jackson-databind:jar:2.12.7:compile
[INFO] \\- org.springframework.boot:spring-boot-starter-web:jar:3.3.5:compile
[INFO]    \\- ...spring-boot-starter-json
[INFO]       \\- (com.fasterxml.jackson.core:jackson-databind:jar:2.17.2:compile - omitted for conflict with 2.12.7)`,
      cause: 'The project imported Boot’s plugins but managed versions by hand, without the BOM. Maven’s nearest-wins rule chose the SDK’s old databind, while jackson-core and the JSR-310 module stayed on newer versions.',
      fix: 'Adopt the Boot parent (or import the BOM) so Jackson is managed, and add the Enforcer to fail the build on unmanaged conflicts. Then confirm the SDK works with the newer Jackson.',
      fixCode: `<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-enforcer-plugin</artifactId>
  <executions><execution><id>enforce</id><goals><goal>enforce</goal></goals>
    <configuration><rules><dependencyConvergence/></rules></configuration>
  </execution></executions>
</plugin>` },
    { title: 'A Tomcat CVE is out; the matching Boot release is two weeks away',
      symptom: 'Security scanning flags the embedded Tomcat version. The fix exists in a newer Tomcat patch release, but no Boot release includes it yet.',
      diagnose: `mvn dependency:tree -Dincludes=org.apache.tomcat.embed
[INFO] \\- org.apache.tomcat.embed:tomcat-embed-core:jar:10.1.x:compile`,
      cause: 'Tomcat’s version comes from the Boot BOM. Adding a version to one tomcat artifact would leave the others (websocket, el) on the old version.',
      fix: 'Override the BOM property for the whole Tomcat family, deploy, and remove the override when you upgrade Boot.',
      fixCode: `<!-- pom.xml with spring-boot-starter-parent -->
<properties>
  <tomcat.version>10.1.NN</tomcat.version>   <!-- the patched release -->
</properties>

// Gradle with io.spring.dependency-management
extra["tomcat.version"] = "10.1.NN"` },
    { title: 'Boot 3 upgrade: the app starts, but the audit filter never runs',
      symptom: 'After the upgrade, a third-party request-audit filter is silently missing. In another service the same library fails with <code>ClassNotFoundException: javax.servlet.Filter</code>.',
      diagnose: `./gradlew dependencyInsight --dependency javax.servlet-api
javax.servlet:javax.servlet-api:4.0.1
   \\--- com.vendor:audit-filter:2.3     ← compiled against javax.*`,
      cause: 'The library implements <code>javax.servlet.Filter</code>. Boot 3’s embedded server only knows <code>jakarta.servlet.Filter</code>, so the bean is not registered as a servlet filter (or the class fails to load).',
      fix: 'Upgrade to the vendor’s Jakarta-compatible release, and exclude stray <code>javax.servlet-api</code> artifacts so the problem can’t hide.',
      fixCode: `dependencies {
  implementation("com.vendor:audit-filter-jakarta:3.0.1")
}
configurations.all {
  exclude(group = "javax.servlet", module = "javax.servlet-api")
}` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Maven, no dependency management. Which jackson-databind ends up on the classpath?', code: `app
├─ lib-a → jackson-databind 2.12.7        (depth 2)
└─ lib-b → lib-c → jackson-databind 2.17.2 (depth 3)`, options: ['2.17.2: newest wins', '2.12.7: nearest wins', 'Both', 'Build fails: conflict'], answer: 1, explain: 'Maven’s mediation picks the <b>nearest</b> definition in the tree (and, at equal depth, the first declared). Version numbers don’t matter.' },
    { kind: 'predict', q: 'Same tree, built with Gradle and no platform. Which version?', options: ['2.12.7', '2.17.2', 'Both', 'Build fails'], answer: 1, explain: 'Gradle’s default conflict resolution selects the <b>highest</b> requested version.' },
    { kind: 'predict', q: 'Maven with <code>spring-boot-starter-parent</code>, whose BOM manages jackson-databind 2.17.2. A transitive dependency asks for 2.18.1. Which version?', options: ['2.18.1: higher wins', '2.17.2: the managed version wins', 'Both', 'Build fails'], answer: 1, explain: 'In Maven, <code>&lt;dependencyManagement&gt;</code> overrides the version of transitive dependencies, up <i>or</i> down. That can downgrade a library another dependency needs, so check the tree after adding SDKs.' },
    { kind: 'predict', q: 'Gradle with <code>implementation(platform(SpringBootPlugin.BOM_COORDINATES))</code>, BOM says 2.17.2, a transitive asks for 2.18.1. Which version?', options: ['2.17.2', '2.18.1', 'Both', 'Build fails'], answer: 1, explain: 'A Gradle <code>platform</code> contributes constraints that take part in conflict resolution, and the highest version still wins. <code>enforcedPlatform</code> or the dependency-management plugin would keep 2.17.2.' },
    { kind: 'concept', q: 'You import <code>spring-boot-dependencies</code> (no parent) and set <code>&lt;jackson-bom.version&gt;2.18.2&lt;/jackson-bom.version&gt;</code> in your properties. What happens?', options: ['Jackson moves to 2.18.2', 'Nothing: the property only works with the parent', 'Build fails', 'Only jackson-databind moves'], answer: 1, explain: 'Property overrides work through inheritance. An imported BOM is evaluated with its own properties. Import <code>jackson-bom</code> 2.18.2 before Boot’s BOM instead.' },
    { kind: 'concept', q: 'What is inside <code>spring-boot-starter-web</code>’s jar?', options: ['The DispatcherServlet and Tomcat classes', 'Essentially nothing: it is a POM that depends on spring-web, spring-webmvc, Jackson, Tomcat and the base starter', 'The web auto-configuration classes', 'A shaded copy of Spring MVC'], answer: 1, explain: 'Starters are dependency descriptors. Auto-configuration lives in <code>spring-boot-autoconfigure</code>; the libraries live in their own jars.' },
    { kind: 'concept', q: 'Besides the BOM, what does <code>spring-boot-starter-parent</code> add to a Maven build?', options: ['Nothing else', 'Plugin configuration: Java release level, UTF-8 encoding, -parameters, resource filtering with @…@, and a configured spring-boot-maven-plugin', 'An embedded Maven repository', 'Automatic dependency upgrades'], answer: 1, explain: 'The parent extends <code>spring-boot-dependencies</code> and adds sensible plugin defaults. Without it you configure those yourself (notably <code>-parameters</code>, which Spring needs for parameter-name matching).' }
  ],
  interview: [
    { q: 'What is a Spring Boot starter?', a: '<p>A dependency descriptor for one capability, such as <code>spring-boot-starter-data-jpa</code>: Spring Data JPA, Hibernate, HikariCP, the JDBC starter and the base starter (core, auto-configuration, logging, YAML). It contains little or no code. The auto-configuration that reacts to those libraries lives in <code>spring-boot-autoconfigure</code> (or the library’s own <code>-autoconfigure</code> module).</p>', lvl: 'core' },
    { q: 'Parent POM vs importing the BOM?', a: '<p>The parent <code>spring-boot-starter-parent</code> inherits from the BOM <b>and</b> configures plugins (compiler level, <code>-parameters</code>, encoding, resource filtering, the Boot Maven plugin), and allows version overrides through properties. Importing <code>spring-boot-dependencies</code> with <code>scope=import</code> gives you only the managed versions. Use it when you already have a corporate parent; override versions by importing other BOMs <i>before</i> Boot’s.</p>', lvl: 'core' },
    { q: 'How do Maven and Gradle resolve version conflicts?', a: '<p>Maven: managed versions first (<code>dependencyManagement</code>, at any depth); otherwise the <b>nearest</b> declaration in the tree, ties broken by declaration order. Gradle: the <b>highest</b> version among all requests and constraints, unless a <code>strictly</code>/enforced constraint, a forced version or a resolution strategy says otherwise. The Spring dependency-management Gradle plugin reproduces Maven’s BOM behaviour.</p>', lvl: 'core' },
    { q: 'How do you diagnose a NoSuchMethodError or ClassNotFoundException that appears after adding a dependency?', a: '<ol><li>Find the class’s jar: <code>mvn dependency:tree -Dverbose -Dincludes=group</code> or <code>./gradlew dependencyInsight --dependency name</code>.</li><li>Look for “omitted for conflict” entries, or mixed versions in one family.</li><li>Fix through the BOM (property or imported family BOM), an exclusion, or upgrading the offending dependency.</li><li>Prevent recurrence with Enforcer (<code>dependencyConvergence</code>) or Gradle’s <code>failOnVersionConflict()</code>.</li></ol>', lvl: 'core' },
    { q: 'How do you override a version Boot manages?', a: '<p>With the parent: set the BOM property, e.g. <code>&lt;jackson-bom.version&gt;</code>, <code>&lt;tomcat.version&gt;</code>, <code>&lt;hibernate.version&gt;</code>. With the Gradle dependency-management plugin: <code>extra["jackson-bom.version"] = "…"</code>. With Gradle platforms: a constraint, or a platform for that library. Property names are listed in Boot’s reference documentation (“Dependency Versions”). Keep overrides temporary and documented.</p>', lvl: 'core' },
    { q: 'Why use the Spring Boot Maven or Gradle plugin at all?', a: '<p>It repackages the app into an executable jar (your classes plus dependency jars under <code>BOOT-INF/lib</code>, with a launcher), can build OCI images with buildpacks (<code>spring-boot:build-image</code> / <code>bootBuildImage</code>), runs the app (<code>spring-boot:run</code>/<code>bootRun</code>), supports AOT processing for native images, and can generate build info for the Actuator <code>info</code> endpoint.</p>', lvl: 'core' },
    { q: 'How would you structure a company-internal starter?', a: '<p>Two modules: <code>acme-x-spring-boot-autoconfigure</code> with the <code>@AutoConfiguration</code> classes, properties and the imports file (library dependencies marked optional), and <code>acme-x-spring-boot-starter</code>, which depends on the autoconfigure module plus the libraries and has no code. Don’t name it <code>spring-boot-starter-*</code>: that prefix is reserved for official starters. Publish a BOM if you ship several artifacts.</p>', lvl: 'deep' },
    { q: 'What changed for dependencies in Boot 3?', a: '<ul><li>Java 17 minimum.</li><li>Jakarta EE 9/10 namespaces: <code>jakarta.servlet</code>, <code>jakarta.persistence</code>, <code>jakarta.validation</code>; libraries need Jakarta-compatible versions.</li><li>Hibernate 6, Tomcat 10, Jetty 11+ baselines.</li><li>Auto-configuration registration only through <code>AutoConfiguration.imports</code>.</li><li>Micrometer Tracing replaces Spring Cloud Sleuth.</li></ul>', lvl: 'core' },
    { q: 'Gradle: Spring dependency-management plugin or native platform?', a: '<p>The plugin gives Maven-like behaviour (managed versions win, property overrides with <code>extra[…]</code>) and is what start.spring.io configures for Gradle. Native <code>platform()</code> is lighter and idiomatic Gradle, but its versions are only recommendations; use <code>enforcedPlatform</code> or strict constraints where you need the BOM to win. Pick one style per build.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Maven: parent, starters, override', lang: 'text', code: `<project>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.5</version>
    <relativePath/>
  </parent>

  <properties>
    <java.version>21</java.version>
    <jackson-bom.version>2.18.2</jackson-bom.version>   <!-- moves the whole Jackson family -->
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
      <exclusions>                                       <!-- Tomcat → Jetty -->
        <exclusion>
          <groupId>org.springframework.boot</groupId>
          <artifactId>spring-boot-starter-tomcat</artifactId>
        </exclusion>
      </exclusions>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-jetty</artifactId>
    </dependency>
  </dependencies>

  <build><plugins>
    <plugin>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-maven-plugin</artifactId>
    </plugin>
  </plugins></build>
</project>` },
    { title: 'Maven without the parent', lang: 'text', code: `<dependencyManagement>
  <dependencies>
    <!-- 1. overrides first: the first BOM to manage an artifact wins -->
    <dependency>
      <groupId>com.fasterxml.jackson</groupId>
      <artifactId>jackson-bom</artifactId>
      <version>2.18.2</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
    <!-- 2. then Boot -->
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-dependencies</artifactId>
      <version>3.3.5</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>
<!-- you must now configure maven-compiler-plugin (-parameters) and the Boot plugin's repackage goal yourself -->` },
    { title: 'Gradle (Kotlin DSL): both styles', lang: 'text', code: `// Style A: Spring dependency-management plugin (Maven semantics)
plugins {
  java
  id("org.springframework.boot") version "3.3.5"
  id("io.spring.dependency-management") version "1.1.6"
}
extra["jackson-bom.version"] = "2.18.2"
dependencies {
  implementation("org.springframework.boot:spring-boot-starter-web")
}

// Style B: native Gradle platform
plugins {
  java
  id("org.springframework.boot") version "3.3.5"
}
dependencies {
  implementation(platform(org.springframework.boot.gradle.plugin.SpringBootPlugin.BOM_COORDINATES))
  implementation("org.springframework.boot:spring-boot-starter-web")
}
configurations.all { resolutionStrategy.failOnVersionConflict() }   // optional: make conflicts loud` },
    { title: 'Inspect what you got', lang: 'bash', code: `# Maven: full tree, with conflicts shown
mvn dependency:tree -Dverbose -Dincludes=com.fasterxml.jackson.core

# Gradle: why this version?
./gradlew dependencyInsight --dependency jackson-databind --configuration runtimeClasspath

# what's actually inside the fat jar
jar tf target/app.jar | grep BOOT-INF/lib | sort` }
  ]
});

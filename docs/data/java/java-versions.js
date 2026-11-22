IA.register({
  track: 'java',
  slug: 'java-versions',
  title: 'Java 8 → 21 tour',
  tagline: 'Java now ships <b>every six months</b>, with a long-term-support release every two years: <b>8, 11, 17, 21</b> (and 25). Each LTS hop brings features you will be asked about (records, sealed types, pattern matching, virtual threads) and traps that break builds (removed Java EE modules, strong encapsulation, UTF-8 by default).',
  tldr: {
    problem: 'Teams still run Java 8 or 11 because upgrades “might break something”. Interviewers ask what changed and whether you have done a migration. The breakages are predictable: missing <code>javax.xml.bind</code>, <code>InaccessibleObjectException</code> from old libraries, charset changes, and build tools that don’t know the new version.',
    model: 'Think in LTS hops. <b>8 → 11</b>: modules, <code>var</code>, <code>HttpClient</code>, Java EE modules removed. <b>11 → 17</b>: records, sealed classes, text blocks, switch expressions, helpful NPEs, JDK internals strongly encapsulated. <b>17 → 21</b>: virtual threads, pattern matching for switch, record patterns, sequenced collections, generational ZGC. Upgrade libraries first, then the JDK, then adopt features.',
    hook: '“What broke when you moved from 8 to 17?” A strong answer names the Java EE removal (JAXB, JAX-WS), illegal reflective access becoming an error in 16–17, and how you found them (<code>jdeps --jdk-internals</code>, running tests on the new JDK in CI first).',
    facts: [
      { v: '8 · 11 · 17 · 21', l: 'LTS releases (March 2014, September 2018, September 2021, September 2023). Java 25 (September 2025) is the next LTS' },
      { v: '6 months', l: 'release cadence since Java 10 (March 2018). Features may ship as <i>preview</i> or <i>incubator</i> first and change before becoming final' },
      { v: 'Java 17', l: 'is the minimum for Spring Boot 3, which also moved from <code>javax.*</code> to <code>jakarta.*</code> (Jakarta EE 9+)' }
    ]
  },
  intro: {
    what: 'Java releases a new version twice a year. Most are supported for only six months; every two years (since 17), one is a <b>long-term support (LTS)</b> release that vendors patch for years. Companies usually jump from LTS to LTS. Each jump adds language features (shorter, safer code), JVM improvements (faster GC, less memory) and removes old, unsafe things, which is where upgrades bite.',
    analogy: { icon: '🚆', title: 'Express trains and stopping trains', text: 'A new train leaves every six months and stops at every station (feature releases). Every two years an express train (LTS) leaves that will keep running for many years. Most passengers wait for the express. If you skip three expresses, the trip gets bumpy: the station you knew (an old API) may no longer exist.' },
    steps: [
      { t: 'Know the LTS line', d: '8 → 11 → 17 → 21 → 25. Feature releases in between are previews of what the next LTS contains.' },
      { t: 'Learn the headline features', d: 'Lambdas and streams (8), modules and <code>var</code> (9–10), records, text blocks and sealed classes (14–17), virtual threads and pattern-matching switch (21).', code: 'record Point(int x, int y) {}                          // 16\nString json = """\n    {"x": 1}\n    """;                                               // 15\nif (obj instanceof Point(int x, int y)) { … }          // 21' },
      { t: 'Upgrade libraries before the JDK', d: 'Old versions of Lombok, Mockito, ByteBuddy, Hibernate, Jackson and build plugins are the usual blockers.' },
      { t: 'Compile with <code>--release</code>', d: 'It checks you only use APIs of the target version, not just its bytecode level.', code: '<maven.compiler.release>21</maven.compiler.release>', lang: 'text' }
    ],
    terms: [
      ['LTS', 'Long-term support: a release vendors (Oracle, Adoptium, Amazon Corretto, Azul, Microsoft…) patch for years.'],
      ['preview feature', 'Fully specified but not final; needs <code>--enable-preview</code> and may change (e.g. string templates were withdrawn).'],
      ['JEP', 'JDK Enhancement Proposal: the numbered design document for each feature (JEP 444 = virtual threads).'],
      ['JPMS', 'The Java Platform Module System (Java 9). It split the JDK into modules and encapsulated internals.'],
      ['strong encapsulation', 'JDK internals (e.g. <code>sun.*</code>, private fields of <code>java.*</code>) can’t be reflected into without <code>--add-opens</code>; the default since 16, mandatory since 17.']
    ]
  },
  visual: {
    title: 'Walk the release timeline, then plan a migration',
    caption: '<b>timeline</b>: press Play or Step to walk from Java 8 to 21; LTS releases are the large dots, and each stop lists what became final there. <b>migration</b>: hop 8 → 11 → 17 → 21 and see the traps waiting at each step, with the fix. Pick a release dot to jump to it.'
  },
  gotchas: [
    { trap: 'Java EE modules are gone in Java 11', code: `java.lang.NoClassDefFoundError: javax/xml/bind/JAXBException
// also javax.xml.ws (JAX-WS), javax.activation, javax.annotation (@PostConstruct), CORBA`, why: 'JEP 320 removed the Java EE and CORBA modules that Java 8 bundled. Code compiled on 8 still links against them at run time.', fix: 'Add the standalone artifacts (e.g. <code>jakarta.xml.bind:jakarta.xml.bind-api</code> plus a runtime such as <code>org.glassfish.jaxb:jaxb-runtime</code>; use the 2.3.x line if you still need the <code>javax.xml.bind</code> package names).' },
    { trap: 'Reflection into JDK internals fails on 17', code: `java.lang.reflect.InaccessibleObjectException:
  Unable to make field private final byte[] java.lang.String.value accessible:
  module java.base does not "opens java.lang" to unnamed module`, why: 'Java 9–15 only warned about illegal reflective access. Java 16 denied it by default (JEP 396) and Java 17 removed the <code>--illegal-access</code> switch (JEP 403). Old serializers, mocking and bytecode libraries break.', fix: 'Upgrade the library first. As a stopgap, open exactly the package needed: <code>--add-opens java.base/java.lang=ALL-UNNAMED</code>. Find offenders with <code>jdeps --jdk-internals</code>.' },
    { trap: 'Default charset became UTF-8 in Java 18', code: `new FileReader("export.csv")          // was the platform charset (Windows-1252 on many Windows boxes)
Files.readString(path)                  // always UTF-8 (since 11)`, why: 'JEP 400 made UTF-8 the default for APIs that use the default charset. Code that relied on the OS charset (often on Windows) silently reads or writes different bytes.', fix: 'Always pass a charset explicitly: <code>new FileReader(f, StandardCharsets.UTF_8)</code>, <code>Files.newBufferedReader(p, cs)</code>. For a temporary rollback, <code>-Dfile.encoding=COMPAT</code>.' },
    { trap: 'Parsing the version string', code: `System.getProperty("java.version")   // "1.8.0_402" on 8, "21.0.2" on 21
// code that does .split("\\\\.")[1] thinks Java 21 is "Java 0"`, why: 'JEP 223 (Java 9) dropped the “1.” prefix. Startup checks and some old tools mis-detect versions.', fix: 'Use <code>Runtime.version().feature()</code> (Java 10+), which returns 21.' },
    { trap: 'The default GC changed under you', why: 'Java 9 made G1 the default collector (JEP 248), replacing Parallel. Throughput-tuned batch jobs may see different pause and CPU profiles after an 8 → 11+ upgrade. In small containers (under 2 CPUs or about 1.8 GB), the JVM picks Serial instead.', fix: 'Choose the GC explicitly when it matters (<code>-XX:+UseParallelGC</code> for throughput batch, G1 for services, generational ZGC on 21 for low pauses) and compare GC logs before and after. See <a href="garbage-collection.html">Garbage collection</a>.' },
    { trap: 'Old build tools and agents don’t know the new class-file version', code: `Unsupported class file major version 65        // 65 = Java 21
WARNING: A Java agent has been loaded dynamically … (Mockito inline mock maker)`, why: 'ASM-based tools (old Gradle, Jacoco, Spring’s bytecode scanning, Lombok) must understand the new class-file version. Java 21 also warns when agents load dynamically (JEP 451), and a future release will deny it by default.', fix: 'Upgrade Gradle/Maven plugins, Jacoco, Lombok, Mockito and ByteBuddy together with the JDK. Load Mockito as a <code>-javaagent</code> in tests, or add <code>-XX:+EnableDynamicAgentLoading</code> knowingly.' }
  ],
  scenarios: [
    { title: 'The 8 → 17 upgrade passes CI but crashes on startup in staging',
      symptom: 'Unit tests pass on JDK 17. In staging the service dies at boot with <code>InaccessibleObjectException</code> from a PDF library that wasn’t covered by tests.',
      diagnose: `jdeps --jdk-internals --multi-release 17 --class-path 'libs/*' app.jar
# pdfkit-2.1.jar -> java.base
#    com.pdfkit.FontCache  -> sun.font.FontManager   JDK internal API (java.desktop)
# Warning: JDK internal APIs are unsupported and private to JDK implementation…`,
      cause: 'An old library reflected into JDK internals. Java 8 allowed it; 16 denied it by default; 17 removed the escape hatch. The code path ran only when rendering the first invoice.',
      fix: 'Upgrade the library (or replace it). If you must ship now, add the narrowest <code>--add-opens</code> / <code>--add-exports</code> and a ticket to remove it. Run <code>jdeps</code> on every dependency as part of the upgrade, not just your code.',
      fixCode: `# temporary, documented, and tracked
JAVA_TOOL_OPTIONS="--add-exports java.desktop/sun.font=ALL-UNNAMED"`, lang: 'bash' },
    { title: 'OOMKilled pods on an old Java 8 build',
      symptom: 'A legacy service in Kubernetes with a 1 GiB memory limit gets OOMKilled under load, but its heap metrics look fine.',
      diagnose: `kubectl exec "$POD" -- java -XX:+PrintFlagsFinal -version | grep -E 'MaxHeapSize|UseContainerSupport'
# MaxHeapSize = 8388608000        ← a quarter of the NODE's 32 GB, not of the 1 GiB limit
# (no UseContainerSupport flag on this 8u build)`,
      cause: 'Before 8u191 (and JDK 10), the JVM sized its heap and thread pools from the host’s memory and CPUs, ignoring cgroup limits. It let the heap grow past the container limit, and the kernel killed it.',
      fix: 'Move to a current JDK (11, 17 or 21, or at least a recent 8u) where container support is on by default, and size the heap as a fraction of the limit, leaving room for metaspace, threads and direct memory.',
      fixCode: `# Java 11+ (and 8u191+)
JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"`, lang: 'bash' },
    { title: 'Accented names garbled after moving a Windows batch job to Java 21',
      symptom: 'A nightly import running on Windows Server produces “RenÃ©” instead of “René” after the JDK upgrade. The Linux deployment of the same job is fine.',
      diagnose: `// java 17 on Windows:  Charset.defaultCharset()  → windows-1252
// java 21 on Windows:  Charset.defaultCharset()  → UTF-8   (JEP 400, Java 18)
Reader r = new FileReader(file);          // uses the default charset`,
      cause: 'The partner’s file is Windows-1252. On Java 17 the default charset happened to match. Since Java 18 the default is UTF-8 everywhere, so the same bytes decode differently.',
      fix: 'Declare the charset the file actually uses; never depend on the default.',
      fixCode: `try (BufferedReader r = Files.newBufferedReader(file, Charset.forName("windows-1252"))) {
    r.lines().map(Importer::parse).forEach(repo::save);
}` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Java 21 pattern matching. What does this print?', code: `public class Main {
    sealed interface Shape {}
    record Circle(double r) implements Shape {}
    record Square(double side) implements Shape {}

    static String describe(Object o) {
        return switch (o) {
            case Circle(double r) when r > 10 -> "big circle";
            case Circle c -> "circle";
            case Square(double s) -> "square " + s;
            case null -> "null!";
            default -> "other";
        };
    }

    public static void main(String[] a) {
        System.out.println(describe(new Circle(11)) + ", " + describe(new Circle(1)) + ", "
                + describe(new Square(2)) + ", " + describe(null) + ", " + describe("x"));
    }
}`, options: ['big circle, circle, square 2.0, null!, other', 'circle, circle, square 2, null!, other', 'big circle, circle, square 2.0, then NullPointerException', 'It does not compile: default is not allowed with sealed types'], answer: 0, run: true, expect: 'big circle, circle, square 2.0, null!, other', explain: 'Java 21 finalised pattern matching for switch (JEP 441) and record patterns (JEP 440). Cases are tried top to bottom; the guard <code>when r &gt; 10</code> sends the big circle to the first case. <code>case null</code> is allowed, so a null selector no longer throws. The switch is over <code>Object</code>, so it needs <code>default</code>. <code>double</code> concatenation prints <b>2.0</b>.' },
    { kind: 'predict', q: 'Sequenced collections (Java 21). Output?', code: `import java.util.*;

public class Main {
    public static void main(String[] a) {
        List<Integer> list = new ArrayList<>(List.of(1, 2, 3));
        list.addFirst(0);
        SequencedSet<String> set = new LinkedHashSet<>(List.of("a", "b", "c"));
        System.out.println(list.getLast() + " " + list.reversed() + " " + set.reversed().getFirst());
    }
}`, options: ['3 [3, 2, 1, 0] c', '0 [3, 2, 1, 0] a', '3 [0, 1, 2, 3] c', 'It does not compile on 21: addFirst is Deque-only'], answer: 0, run: true, expect: '3 [3, 2, 1, 0] c', explain: 'JEP 431 added <code>SequencedCollection</code> with <code>addFirst/addLast</code>, <code>getFirst/getLast</code>, <code>removeFirst/removeLast</code> and <code>reversed()</code> (a reversed <i>view</i>) to List, Deque, LinkedHashSet, SortedSet and friends, plus <code>SequencedMap</code>. Before 21, “last element of a list” was <code>list.get(list.size() - 1)</code>.' },
    { kind: 'predict', q: 'Java 11 string methods. What does this print?', code: `public class Main {
    public static void main(String[] a) {
        String s = "\\u2005hi\\u2005";          // U+2005 is a Unicode space, not ASCII
        System.out.println(s.trim().length() + " " + s.strip().length() + " "
                + "ab".repeat(3) + " " + "   ".isBlank());
    }
}`, options: ['2 2 ababab true', '4 2 ababab true', '4 4 ababab false', '2 4 ab3 true'], answer: 1, run: true, expect: '4 2 ababab true', explain: '<code>trim()</code> (since 1.0) only removes characters ≤ U+0020, so the U+2005 spaces stay: length <b>4</b>. Java 11’s <code>strip()</code> uses <code>Character.isWhitespace</code> and removes them: <b>2</b>. Also new in 11: <code>repeat</code>, <code>isBlank</code>, <code>lines()</code>, <code>stripLeading/Trailing</code>.' },
    { kind: 'predict', q: 'Helpful NullPointerExceptions (Java 14+, on by default since 15). What is printed?', code: `public class Main {
    static String name;

    public static void main(String[] a) {
        try {
            System.out.println(name.length());
        } catch (NullPointerException e) {
            System.out.println(e.getMessage());
        }
    }
}`, options: ['null', 'java.lang.NullPointerException', 'Cannot invoke "String.length()" because "Main.name" is null', 'name is null'], answer: 2, run: true, expect: 'Cannot invoke "String.length()" because "Main.name" is null', explain: 'JEP 358 (Java 14, enabled by default from 15) computes a message describing <i>which</i> reference was null. On Java 8 the message was <code>null</code>. For local variables the name appears only if the class has debug info (<code>-g</code>); otherwise you see something like <code>"&lt;local1&gt;"</code>.' },
    { kind: 'predict', q: '<code>var</code> with a diamond. Output?', code: `import java.util.*;

public class Main {
    public static void main(String[] a) {
        var list = new ArrayList<>();
        list.add(1);
        list.add("two");
        var n = 10;
        var d = n / 4;
        System.out.println(list + " " + d);
    }
}`, options: ['It does not compile: mixed types', '[1, two] 2', '[1, two] 2.5', '[1, "two"] 2'], answer: 1, run: true, expect: '[1, two] 2', explain: '<code>var</code> (Java 10, JEP 286) infers from the initializer. A bare diamond infers <code>ArrayList&lt;Object&gt;</code>, so anything goes in. <code>n</code> is an <code>int</code>, so <code>n / 4</code> is integer division: <b>2</b>. <code>var</code> is static typing with less ceremony, not dynamic typing.' },
    { kind: 'concept', q: 'You move a Java 8 service to Java 11 and get <code>NoClassDefFoundError: javax/xml/bind/JAXBException</code>. Why?', options: ['JAXB was deprecated, and deprecated classes are hidden', 'JEP 320 removed the Java EE modules (JAXB, JAX-WS, …) from the JDK in Java 11', 'The module system blocks javax.* packages by default', 'Java 11 renamed javax to jakarta'], answer: 1, explain: 'They were deprecated for removal in 9 and <b>removed in 11</b>. Add them as normal dependencies. The <code>javax → jakarta</code> rename is a separate Jakarta EE 9 change, which you meet when moving to Spring Boot 3.' },
    { kind: 'concept', q: 'Which of these became final (non-preview) in Java 21?', options: ['Structured concurrency', 'String templates', 'Virtual threads, record patterns and pattern matching for switch', 'Scoped values'], answer: 2, explain: 'Java 21 finalised virtual threads (JEP 444), record patterns (JEP 440), pattern matching for switch (JEP 441), sequenced collections (JEP 431) and generational ZGC (JEP 439). Structured concurrency and scoped values were previews; string templates were a preview that was later withdrawn.' },
    { kind: 'concept', q: 'An old library calls <code>setAccessible(true)</code> on a private field of <code>java.lang.String</code>. On Java 11 you see a warning. On Java 17 you get…', options: ['The same warning', 'InaccessibleObjectException, unless the package is opened with --add-opens', 'A SecurityException from the Security Manager', 'It works silently'], answer: 1, explain: 'Java 9–15: “WARNING: An illegal reflective access operation has occurred”. Java 16 made <code>--illegal-access=deny</code> the default (JEP 396); Java 17 removed the option (JEP 403). Now only an explicit <code>--add-opens java.base/java.lang=ALL-UNNAMED</code> allows it.' }
  ],
  interview: [
    { q: 'Which Java versions are LTS, and how does the release model work?', a: '<p>Since Java 10 (2018), a feature release ships every six months (March and September). LTS releases are 8, 11, 17, 21 and 25; since 17, every two years (before that, every three). Vendors such as Oracle, Eclipse Adoptium, Amazon Corretto, Azul, Microsoft and Red Hat publish builds and patch LTS lines for years. Non-LTS releases are supported until the next release.</p>', lvl: 'core' },
    { q: 'What were the big changes in Java 8?', a: '<p>Lambdas and method references, the Streams API, default and static interface methods, <code>Optional</code>, <code>java.time</code> (JSR-310) replacing <code>Date</code>/<code>Calendar</code>, <code>CompletableFuture</code>, and on the JVM side Metaspace replacing PermGen. Also Nashorn (later removed in 15).</p>', lvl: 'core' },
    { q: 'What did Java 9–11 add?', a: '<ul><li><b>9</b>: the module system (JPMS), JShell, <code>List.of/Set.of/Map.of</code>, G1 as default GC, compact strings, <code>VarHandle</code>, private interface methods, <code>ProcessHandle</code>, multi-release JARs.</li><li><b>10</b>: <code>var</code> for locals, <code>List.copyOf</code>, container awareness on by default.</li><li><b>11 (LTS)</b>: standard <code>HttpClient</code>, <code>String.isBlank/strip/lines/repeat</code>, <code>Files.readString</code>, running a single source file (<code>java Main.java</code>), JFR open-sourced, ZGC (experimental), TLS 1.3; Java EE and CORBA modules removed.</li></ul>', lvl: 'core' },
    { q: 'What did Java 12–17 add?', a: '<ul><li>Switch expressions with <code>-&gt;</code> and <code>yield</code> (final in 14).</li><li>Helpful NullPointerExceptions (14).</li><li>Text blocks (15).</li><li>ZGC and Shenandoah production-ready (15).</li><li>Records and pattern matching for <code>instanceof</code> (16), <code>Stream.toList()</code> (16).</li><li>Sealed classes (17), the <code>RandomGenerator</code> API (17).</li><li>Strong encapsulation of JDK internals (default in 16, mandatory in 17).</li></ul>', lvl: 'core' },
    { q: 'What is new in Java 21?', a: '<ul><li>Virtual threads (JEP 444).</li><li>Pattern matching for switch (JEP 441) and record patterns (JEP 440), which together with sealed types give exhaustive, data-oriented code.</li><li>Sequenced collections (JEP 431): <code>getFirst</code>, <code>getLast</code>, <code>reversed</code>.</li><li>Generational ZGC (JEP 439, opt-in with <code>-XX:+ZGenerational</code> in 21).</li><li>Small APIs: <code>Math.clamp</code>, <code>StringBuilder.repeat</code>, <code>String.indexOf(ch, from, to)</code>.</li><li>Previews: structured concurrency, scoped values, unnamed patterns and variables, unnamed classes and instance main methods.</li></ul>', lvl: 'core' },
    { q: 'How would you plan an upgrade from Java 8 to 21?', a: '<ol><li>Inventory: <code>jdeps --jdk-internals</code> and <code>jdeprscan</code> over the app and all dependencies.</li><li>Upgrade the build (Maven/Gradle, plugins, Jacoco) and the libraries known to touch internals (Lombok, Mockito, ByteBuddy, Hibernate, Jackson, Spring).</li><li>Add a CI job on the new JDK, compiling with <code>--release 21</code>, while production still runs the old one.</li><li>Fix removals (Java EE modules, Nashorn), reflection (<code>--add-opens</code> only as a stopgap), charset assumptions, version-string parsing.</li><li>Roll out with GC logs and JFR on, comparing latency and memory.</li><li>Only then adopt new language features.</li></ol><p>If you are on Spring Boot 2, the move to Boot 3 (Java 17+, <code>jakarta.*</code>) is a separate step; tools such as OpenRewrite automate much of it.</p>', lvl: 'deep' },
    { q: 'What is the module system, and do you have to use it?', a: '<p>JPMS (Java 9) groups packages into modules with explicit <code>requires</code> and <code>exports</code> in <code>module-info.java</code>, and enforces encapsulation. The JDK itself is modular, which enabled <code>jlink</code> for custom runtime images. Applications don’t have to be modular: code on the class path lives in the “unnamed module” and works as before. Its real impact on most teams was the strong encapsulation of JDK internals.</p>', lvl: 'deep' },
    { q: 'What is a preview feature?', a: '<p>A complete, specified language or VM feature that isn’t permanent yet. You must opt in with <code>--enable-preview</code> at compile and run time, and class files compiled that way only run on that exact JDK version. Previews can change or be withdrawn: string templates previewed in 21 and 22 and were then dropped. Incubator modules (<code>jdk.incubator.*</code>) are the API equivalent.</p>', lvl: 'core' },
    { q: 'Which things were removed or disabled between 8 and 21?', a: '<ul><li>Java EE and CORBA modules (11), Nashorn JavaScript engine (15), the experimental AOT and Graal JIT (17), RMI activation (17), Applet API deprecated for removal (17).</li><li>Biased locking disabled and deprecated (15).</li><li>Security Manager deprecated for removal (17; permanently disabled in 24).</li><li>Finalization deprecated for removal (18).</li><li><code>Thread.stop</code> throws <code>UnsupportedOperationException</code> (20).</li><li>Boxed-primitive constructors such as <code>new Integer(1)</code> deprecated for removal (16).</li></ul>', lvl: 'deep' }
  ],
  code: [
    { title: 'Build config for Java 21', lang: 'text', code: `<!-- pom.xml -->
<properties>
  <java.version>21</java.version>                          <!-- Spring Boot parent reads this -->
  <maven.compiler.release>21</maven.compiler.release>      <!-- checks APIs, not just bytecode -->
</properties>

<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-enforcer-plugin</artifactId>
  <executions><execution><goals><goal>enforce</goal></goals>
    <configuration><rules>
      <requireJavaVersion><version>[21,)</version></requireJavaVersion>
    </rules></configuration>
  </execution></executions>
</plugin>

// build.gradle.kts
java { toolchain { languageVersion = JavaLanguageVersion.of(21) } }`, note: 'Prefer <code>release</code> over <code>source</code>/<code>target</code>: with only <code>target</code>, code compiled on 21 for 8 can still call APIs that don’t exist on 8.' },
    { title: 'Find upgrade blockers before they find you', lang: 'bash', code: `# uses of JDK internal APIs, in your jar and every dependency
jdeps --jdk-internals --multi-release 21 --class-path 'target/lib/*' target/app.jar

# uses of deprecated / removed APIs
jdeprscan --release 21 --class-path 'target/lib/*' target/app.jar

# what the running JVM actually decided (GC, heap, container limits)
java -XX:+PrintCommandLineFlags -version
java -Xlog:os+container=info -version      # cgroup limits as seen by the JVM`, note: 'Run the test suite on the target JDK in CI for a while before switching production.' },
    { title: 'The same code, Java 8 vs Java 21', lang: 'java', code: `// Java 8
public final class Money {
    private final BigDecimal amount; private final String currency;
    public Money(BigDecimal amount, String currency) { this.amount = amount; this.currency = currency; }
    /* getters, equals, hashCode, toString … 40 lines */
}
String label(Object o) {
    if (o instanceof Money) { Money m = (Money) o; return m.getAmount() + " " + m.getCurrency(); }
    else if (o instanceof String) { return (String) o; }
    return "?";
}

// Java 21
public record Money(BigDecimal amount, String currency) {}
String label(Object o) {
    return switch (o) {
        case Money(var amount, var currency) -> amount + " " + currency;
        case String s -> s;
        default -> "?";
    };
}`, note: 'See <a href="sealed-pattern-matching.html">Sealed types & pattern matching</a> and <a href="immutability-records.html">Immutability & records</a>.' }
  ]
});

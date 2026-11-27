IA.register({
  track: 'java',
  slug: 'java-versions',
  title: 'Java 8 → 21 tour',
  tagline: 'Java now ships <b>every six months</b>. Every two years one release gets long-term support: <b>8, 11, 17, 21</b> (and 25). Each of these hops brings features you’ll be asked about: records, sealed types, pattern matching, virtual threads. Each also brings traps that break builds: removed Java EE modules, locked-down JDK internals, UTF-8 by default.',
  tldr: {
    problem: 'Teams still run Java 8 or 11 because upgrades “might break something”. Interviewers ask what changed and whether you’ve migrated. The breakages are predictable. <code>javax.xml.bind</code> goes missing. Old libraries throw <code>InaccessibleObjectException</code>. Charsets change. Build tools don’t know the new version.',
    model: 'Think in long-term-support hops. <b>8 → 11</b>: modules, <code>var</code>, <code>HttpClient</code>, Java EE modules removed. <b>11 → 17</b>: records, sealed classes, text blocks, switch expressions, helpful NPEs, JDK internals locked down. <b>17 → 21</b>: virtual threads, pattern matching for switch, record patterns, sequenced collections, generational ZGC. Upgrade libraries first, then the JDK, then use new features.',
    hook: '“What broke when you moved from 8 to 17?” A strong answer names the Java EE removal (JAXB, JAX-WS). It names reflection into JDK internals becoming an error in 16–17. And it says how you found them: <code>jdeps --jdk-internals</code>, and running tests on the new JDK in CI first.',
    facts: [
      { v: '8 · 11 · 17 · 21', l: 'LTS releases (March 2014, September 2018, September 2021, September 2023). Java 25 (September 2025) is the next LTS' },
      { v: '6 months', l: 'release cadence since Java 10 (March 2018). Features may ship first as <i>preview</i> or <i>incubator</i> and change before they’re final' },
      { v: 'Java 17', l: 'is the minimum for Spring Boot 3, which also moved from <code>javax.*</code> to <code>jakarta.*</code> (Jakarta EE 9+)' }
    ]
  },
  intro: {
    what: 'Java ships a new version twice a year. Most get six months of support. Every two years (since 17), one is a <b>long-term support (LTS)</b> release that vendors patch for years. Companies usually jump from LTS to LTS. Each jump adds language features and JVM improvements. It also removes old, unsafe things, and that’s where upgrades bite.',
    analogy: { icon: '🚆', title: 'Express trains and stopping trains', text: 'A new train leaves every six months and stops everywhere (feature releases). Every two years an express (LTS) leaves that runs for many years. Most passengers wait for the express. Skip three expresses and the trip gets bumpy: your old station (an old API) may be gone.' },
    steps: [
      { t: 'Know the LTS line', d: '8 → 11 → 17 → 21 → 25. The releases in between preview what the next LTS will contain.' },
      { t: 'Learn the headline features', d: 'Lambdas and streams (8). Modules and <code>var</code> (9–10). Records, text blocks and sealed classes (14–17). Virtual threads and pattern-matching switch (21).', code: 'record Point(int x, int y) {}                          // 16\nString json = """\n    {"x": 1}\n    """;                                               // 15\nif (obj instanceof Point(int x, int y)) { … }          // 21' },
      { t: 'Upgrade libraries before the JDK', d: 'Old versions of Lombok, Mockito, ByteBuddy, Hibernate, Jackson and build plugins are the usual blockers.' },
      { t: 'Compile with <code>--release</code>', d: 'It checks you use only APIs of the target version, not just its bytecode level.', code: '<maven.compiler.release>21</maven.compiler.release>', lang: 'text' }
    ],
    terms: [
      ['LTS', 'Long-term support: a release that vendors (Oracle, Adoptium, Amazon Corretto, Azul, Microsoft…) patch for years.'],
      ['preview feature', 'Fully specified but not final. Needs <code>--enable-preview</code> and may change (string templates were withdrawn).'],
      ['JEP', 'JDK Enhancement Proposal: the numbered design document for each feature (JEP 444 = virtual threads).'],
      ['JPMS', 'The Java Platform Module System (Java 9). It split the JDK into modules and hid its internals.'],
      ['strong encapsulation', 'You can’t reflect into JDK internals (e.g. <code>sun.*</code>, private fields of <code>java.*</code>) without <code>--add-opens</code>. Default since 16, mandatory since 17.']
    ]
  },
  visual: {
    title: 'Walk the release timeline, then plan a migration',
    caption: '<b>timeline</b>: press Play or Step to walk from Java 8 to 21. Large dots are LTS releases. Each stop lists what became final there. <b>migration</b>: hop 8 → 11 → 17 → 21 and see the traps at each step, with the fix. Pick a dot to jump to it.'
  },
  gotchas: [
    { trap: 'Java EE modules are gone in Java 11', code: `java.lang.NoClassDefFoundError: javax/xml/bind/JAXBException
// also javax.xml.ws (JAX-WS), javax.activation, javax.annotation (@PostConstruct), CORBA`, why: 'Java 11 removed the Java EE and CORBA modules that Java 8 bundled. Code compiled on 8 still needs them at run time.', fix: 'Add the standalone artifacts, e.g. <code>jakarta.xml.bind:jakarta.xml.bind-api</code> plus a runtime like <code>org.glassfish.jaxb:jaxb-runtime</code>. Use the 2.3.x line if you still need the <code>javax.xml.bind</code> package names.' },
    { trap: 'Reflection into JDK internals fails on 17', code: `java.lang.reflect.InaccessibleObjectException:
  Unable to make field private final byte[] java.lang.String.value accessible:
  module java.base does not "opens java.lang" to unnamed module`, why: 'Java 9–15 only warned about reflection into JDK internals. Java 16 denied it by default. Java 17 removed the <code>--illegal-access</code> switch. Old serializers, mocking and bytecode libraries break.', fix: 'Upgrade the library first. As a stopgap, open only the package needed: <code>--add-opens java.base/java.lang=ALL-UNNAMED</code>. Find offenders with <code>jdeps --jdk-internals</code>.' },
    { trap: 'Default charset became UTF-8 in Java 18', code: `new FileReader("export.csv")          // was the platform charset (Windows-1252 on many Windows boxes)
Files.readString(path)                  // always UTF-8 (since 11)`, why: 'Java 18 made UTF-8 the default charset. Code that relied on the OS charset (often on Windows) now reads or writes different bytes, with no error.', fix: 'Always pass a charset: <code>new FileReader(f, StandardCharsets.UTF_8)</code>, <code>Files.newBufferedReader(p, cs)</code>. For a temporary rollback, use <code>-Dfile.encoding=COMPAT</code>.' },
    { trap: 'Parsing the version string', code: `System.getProperty("java.version")   // "1.8.0_402" on 8, "21.0.2" on 21
// code that does .split("\\\\.")[1] thinks Java 21 is "Java 0"`, why: 'Java 9 dropped the “1.” prefix. Startup checks and some old tools get the version wrong.', fix: 'Use <code>Runtime.version().feature()</code> (Java 10+), which returns 21.' },
    { trap: 'The default GC changed under you', why: 'Java 9 made G1 the default collector instead of Parallel. Batch jobs tuned for throughput may see different pauses and CPU after 8 → 11+. In small containers (under 2 CPUs or ~1.8 GB), the JVM picks Serial instead.', fix: 'Pick the GC yourself when it matters: <code>-XX:+UseParallelGC</code> for batch, G1 for services, generational ZGC on 21 for low pauses. Compare GC logs before and after. See <a href="garbage-collection.html">Garbage collection</a>.' },
    { trap: 'Old build tools and agents don’t know the new class-file version', code: `Unsupported class file major version 65        // 65 = Java 21
WARNING: A Java agent has been loaded dynamically … (Mockito inline mock maker)`, why: 'Bytecode tools (old Gradle, Jacoco, Spring’s scanning, Lombok) must understand the new class-file version. Java 21 also warns when agents load at run time. A future release will block that by default.', fix: 'Upgrade Gradle/Maven plugins, Jacoco, Lombok, Mockito and ByteBuddy along with the JDK. Load Mockito as a <code>-javaagent</code> in tests, or add <code>-XX:+EnableDynamicAgentLoading</code> on purpose.' }
  ],
  scenarios: [
    { title: 'The 8 → 17 upgrade passes CI but crashes on startup in staging',
      symptom: 'Unit tests pass on JDK 17. In staging the service dies at boot with <code>InaccessibleObjectException</code> from a PDF library the tests didn’t cover.',
      diagnose: `jdeps --jdk-internals --multi-release 17 --class-path 'libs/*' app.jar
# pdfkit-2.1.jar -> java.base
#    com.pdfkit.FontCache  -> sun.font.FontManager   JDK internal API (java.desktop)
# Warning: JDK internal APIs are unsupported and private to JDK implementation…`,
      cause: 'An old library reflected into JDK internals. Java 8 allowed it. 16 denied it by default. 17 removed the escape hatch. The code ran only when rendering the first invoice.',
      fix: 'Upgrade or replace the library. If you must ship now, add the narrowest <code>--add-opens</code> / <code>--add-exports</code> and a ticket to remove it. Run <code>jdeps</code> on every dependency, not just your code.',
      fixCode: `# temporary, documented, and tracked
JAVA_TOOL_OPTIONS="--add-exports java.desktop/sun.font=ALL-UNNAMED"`, lang: 'bash' },
    { title: 'OOMKilled pods on an old Java 8 build',
      symptom: 'A legacy service in Kubernetes with a 1 GiB limit gets OOMKilled under load. Its heap metrics look fine.',
      diagnose: `kubectl exec "$POD" -- java -XX:+PrintFlagsFinal -version | grep -E 'MaxHeapSize|UseContainerSupport'
# MaxHeapSize = 8388608000        ← a quarter of the NODE's 32 GB, not of the 1 GiB limit
# (no UseContainerSupport flag on this 8u build)`,
      cause: 'Before 8u191 (and JDK 10), the JVM sized itself from the host’s memory and CPUs. It ignored container limits. The heap grew past the limit and the kernel killed it.',
      fix: 'Move to a current JDK (11, 17, 21, or a recent 8u) where container support is on by default. Size the heap as a share of the limit. Leave room for metaspace, threads and direct memory.',
      fixCode: `# Java 11+ (and 8u191+)
JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"`, lang: 'bash' },
    { title: 'Accented names garbled after moving a Windows batch job to Java 21',
      symptom: 'After the JDK upgrade, a nightly import on Windows Server writes “RenÃ©” instead of “René”. The same job on Linux is fine.',
      diagnose: `// java 17 on Windows:  Charset.defaultCharset()  → windows-1252
// java 21 on Windows:  Charset.defaultCharset()  → UTF-8   (JEP 400, Java 18)
Reader r = new FileReader(file);          // uses the default charset`,
      cause: 'The partner’s file is Windows-1252. On Java 17 the default charset happened to match. Since Java 18 the default is UTF-8 everywhere, so the same bytes decode differently.',
      fix: 'Name the charset the file really uses. Never depend on the default.',
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
}`, options: ['big circle, circle, square 2.0, null!, other', 'circle, circle, square 2, null!, other', 'big circle, circle, square 2.0, then NullPointerException', 'It does not compile: default is not allowed with sealed types'], answer: 0, run: true, expect: 'big circle, circle, square 2.0, null!, other', explain: 'Java 21 finalized pattern matching for switch and record patterns. Cases run top to bottom. The guard <code>when r &gt; 10</code> sends the big circle to the first case. <code>case null</code> is allowed, so a null no longer throws. The switch is over <code>Object</code>, so it needs <code>default</code>. <code>double</code> concatenation prints <b>2.0</b>.' },
    { kind: 'predict', q: 'Sequenced collections (Java 21). Output?', code: `import java.util.*;

public class Main {
    public static void main(String[] a) {
        List<Integer> list = new ArrayList<>(List.of(1, 2, 3));
        list.addFirst(0);
        SequencedSet<String> set = new LinkedHashSet<>(List.of("a", "b", "c"));
        System.out.println(list.getLast() + " " + list.reversed() + " " + set.reversed().getFirst());
    }
}`, options: ['3 [3, 2, 1, 0] c', '0 [3, 2, 1, 0] a', '3 [0, 1, 2, 3] c', 'It does not compile on 21: addFirst is Deque-only'], answer: 0, run: true, expect: '3 [3, 2, 1, 0] c', explain: 'Java 21 added <code>SequencedCollection</code>. It brings <code>addFirst/addLast</code>, <code>getFirst/getLast</code>, <code>removeFirst/removeLast</code> and <code>reversed()</code> (a reversed <i>view</i>) to List, Deque, LinkedHashSet, SortedSet and more. There’s also <code>SequencedMap</code>. Before 21, the last element was <code>list.get(list.size() - 1)</code>.' },
    { kind: 'predict', q: 'Java 11 string methods. What does this print?', code: `public class Main {
    public static void main(String[] a) {
        String s = "\\u2005hi\\u2005";          // U+2005 is a Unicode space, not ASCII
        System.out.println(s.trim().length() + " " + s.strip().length() + " "
                + "ab".repeat(3) + " " + "   ".isBlank());
    }
}`, options: ['2 2 ababab true', '4 2 ababab true', '4 4 ababab false', '2 4 ab3 true'], answer: 1, run: true, expect: '4 2 ababab true', explain: '<code>trim()</code> only removes characters ≤ U+0020. The U+2005 spaces stay: length <b>4</b>. Java 11’s <code>strip()</code> uses <code>Character.isWhitespace</code> and removes them: <b>2</b>. Also new in 11: <code>repeat</code>, <code>isBlank</code>, <code>lines()</code>, <code>stripLeading/Trailing</code>.' },
    { kind: 'predict', q: 'Helpful NullPointerExceptions (Java 14+, on by default since 15). What is printed?', code: `public class Main {
    static String name;

    public static void main(String[] a) {
        try {
            System.out.println(name.length());
        } catch (NullPointerException e) {
            System.out.println(e.getMessage());
        }
    }
}`, options: ['null', 'java.lang.NullPointerException', 'Cannot invoke "String.length()" because "Main.name" is null', 'name is null'], answer: 2, run: true, expect: 'Cannot invoke "String.length()" because "Main.name" is null', explain: 'Since Java 14 (on by default from 15), the message says <i>which</i> reference was null. On Java 8 the message was <code>null</code>. Local variable names appear only with debug info (<code>-g</code>). Otherwise you see something like <code>"&lt;local1&gt;"</code>.' },
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
}`, options: ['It does not compile: mixed types', '[1, two] 2', '[1, two] 2.5', '[1, "two"] 2'], answer: 1, run: true, expect: '[1, two] 2', explain: '<code>var</code> (Java 10) takes its type from the initializer. A bare diamond gives <code>ArrayList&lt;Object&gt;</code>, so anything goes in. <code>n</code> is an <code>int</code>, so <code>n / 4</code> is integer division: <b>2</b>. <code>var</code> is still static typing, with less typing.' },
    { kind: 'concept', q: 'You move a Java 8 service to Java 11 and get <code>NoClassDefFoundError: javax/xml/bind/JAXBException</code>. Why?', options: ['JAXB was deprecated, and deprecated classes are hidden', 'JEP 320 removed the Java EE modules (JAXB, JAX-WS, …) from the JDK in Java 11', 'The module system blocks javax.* packages by default', 'Java 11 renamed javax to jakarta'], answer: 1, explain: 'They were deprecated in 9 and <b>removed in 11</b>. Add them as normal dependencies. The <code>javax → jakarta</code> rename is a separate Jakarta EE 9 change. You meet it when moving to Spring Boot 3.' },
    { kind: 'concept', q: 'Which of these became final (non-preview) in Java 21?', options: ['Structured concurrency', 'String templates', 'Virtual threads, record patterns and pattern matching for switch', 'Scoped values'], answer: 2, explain: 'Java 21 finalized virtual threads, record patterns, pattern matching for switch, sequenced collections and generational ZGC. Structured concurrency and scoped values were previews. String templates were a preview that was later withdrawn.' },
    { kind: 'concept', q: 'An old library calls <code>setAccessible(true)</code> on a private field of <code>java.lang.String</code>. On Java 11 you see a warning. On Java 17 you get…', options: ['The same warning', 'InaccessibleObjectException, unless the package is opened with --add-opens', 'A SecurityException from the Security Manager', 'It works silently'], answer: 1, explain: 'Java 9–15 printed “WARNING: An illegal reflective access operation has occurred”. Java 16 denied it by default. Java 17 removed the option. Now only an explicit <code>--add-opens java.base/java.lang=ALL-UNNAMED</code> allows it.' }
  ],
  interview: [
    { q: 'Which Java versions are LTS, and how does the release model work?', a: '<p>Since Java 10 (2018), a release ships every six months (March and September). LTS releases are 8, 11, 17, 21 and 25. Since 17 they come every two years (before, every three). Vendors like Oracle, Adoptium, Corretto, Azul, Microsoft and Red Hat build and patch LTS lines for years. Other releases get support until the next one.</p>', lvl: 'core' },
    { q: 'What were the big changes in Java 8?', a: '<p>Lambdas and method references. The Streams API. Default and static interface methods. <code>Optional</code>. <code>java.time</code> replacing <code>Date</code>/<code>Calendar</code>. <code>CompletableFuture</code>. On the JVM side, Metaspace replaced PermGen. Also Nashorn (removed in 15).</p>', lvl: 'core' },
    { q: 'What did Java 9–11 add?', a: '<ul><li><b>9</b>: modules (JPMS), JShell, <code>List.of/Set.of/Map.of</code>, G1 as default GC, compact strings, <code>VarHandle</code>, private interface methods, <code>ProcessHandle</code>, multi-release JARs.</li><li><b>10</b>: <code>var</code> for locals, <code>List.copyOf</code>, container awareness on by default.</li><li><b>11 (LTS)</b>: standard <code>HttpClient</code>, <code>String.isBlank/strip/lines/repeat</code>, <code>Files.readString</code>, running one source file (<code>java Main.java</code>), open-source JFR, experimental ZGC, TLS 1.3. Java EE and CORBA modules removed.</li></ul>', lvl: 'core' },
    { q: 'What did Java 12–17 add?', a: '<ul><li>Switch expressions with <code>-&gt;</code> and <code>yield</code> (final in 14).</li><li>Helpful NullPointerExceptions (14).</li><li>Text blocks (15).</li><li>ZGC and Shenandoah production-ready (15).</li><li>Records and pattern matching for <code>instanceof</code> (16), <code>Stream.toList()</code> (16).</li><li>Sealed classes (17), the <code>RandomGenerator</code> API (17).</li><li>Strong encapsulation of JDK internals (default in 16, mandatory in 17).</li></ul>', lvl: 'core' },
    { q: 'What is new in Java 21?', a: '<ul><li>Virtual threads.</li><li>Pattern matching for switch and record patterns. With sealed types they give exhaustive, data-oriented code.</li><li>Sequenced collections: <code>getFirst</code>, <code>getLast</code>, <code>reversed</code>.</li><li>Generational ZGC (opt-in with <code>-XX:+ZGenerational</code> in 21).</li><li>Small APIs: <code>Math.clamp</code>, <code>StringBuilder.repeat</code>, <code>String.indexOf(ch, from, to)</code>.</li><li>Previews: structured concurrency, scoped values, unnamed patterns and variables, unnamed classes and instance main methods.</li></ul>', lvl: 'core' },
    { q: 'How would you plan an upgrade from Java 8 to 21?', a: '<ol><li>Take stock: run <code>jdeps --jdk-internals</code> and <code>jdeprscan</code> over the app and all dependencies.</li><li>Upgrade the build (Maven/Gradle, plugins, Jacoco). Upgrade libraries that touch internals (Lombok, Mockito, ByteBuddy, Hibernate, Jackson, Spring).</li><li>Add a CI job on the new JDK with <code>--release 21</code>, while production stays on the old one.</li><li>Fix removals (Java EE modules, Nashorn), reflection (<code>--add-opens</code> only as a stopgap), charset assumptions and version parsing.</li><li>Roll out with GC logs and JFR on. Compare latency and memory.</li><li>Only then use new language features.</li></ol><p>On Spring Boot 2, the move to Boot 3 (Java 17+, <code>jakarta.*</code>) is a separate step. Tools like OpenRewrite automate much of it.</p>', lvl: 'deep' },
    { q: 'What is the module system, and do you have to use it?', a: '<p>JPMS (Java 9) groups packages into modules. Each module lists what it <code>requires</code> and <code>exports</code> in <code>module-info.java</code>, and the JVM enforces it. The JDK itself is modular, which made <code>jlink</code> custom runtimes possible. Your app doesn’t have to be modular. Class-path code lives in the “unnamed module” and works as before. For most teams, the real impact was the lockdown of JDK internals.</p>', lvl: 'deep' },
    { q: 'What is a preview feature?', a: '<p>A complete, specified feature that isn’t permanent yet. You opt in with <code>--enable-preview</code> when compiling and running. Those class files run only on that exact JDK version. Previews can change or vanish: string templates previewed in 21 and 22, then were dropped. Incubator modules (<code>jdk.incubator.*</code>) are the API version of this.</p>', lvl: 'core' },
    { q: 'Which things were removed or disabled between 8 and 21?', a: '<ul><li>Java EE and CORBA modules (11), Nashorn (15), the experimental AOT and Graal JIT (17), RMI activation (17). Applet API deprecated for removal (17).</li><li>Biased locking disabled (15).</li><li>Security Manager deprecated for removal (17), disabled for good in 24.</li><li>Finalization deprecated for removal (18).</li><li><code>Thread.stop</code> throws <code>UnsupportedOperationException</code> (20).</li><li>Constructors like <code>new Integer(1)</code> deprecated for removal (16).</li></ul>', lvl: 'deep' }
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
java { toolchain { languageVersion = JavaLanguageVersion.of(21) } }`, note: 'Prefer <code>release</code> over <code>source</code>/<code>target</code>. With only <code>target</code>, code built on 21 for 8 can still call APIs missing on 8.' },
    { title: 'Find upgrade blockers before they find you', lang: 'bash', code: `# uses of JDK internal APIs, in your jar and every dependency
jdeps --jdk-internals --multi-release 21 --class-path 'target/lib/*' target/app.jar

# uses of deprecated / removed APIs
jdeprscan --release 21 --class-path 'target/lib/*' target/app.jar

# what the running JVM actually decided (GC, heap, container limits)
java -XX:+PrintCommandLineFlags -version
java -Xlog:os+container=info -version      # cgroup limits as seen by the JVM`, note: 'Run the tests on the target JDK in CI for a while before switching production.' },
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

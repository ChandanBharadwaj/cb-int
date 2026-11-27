IA.register({
  track: 'java',
  slug: 'class-loading',
  title: 'Class loading',
  tagline: 'The JVM knows a class by its <b>name plus the loader that defined it</b>. A loader asks its parent first. Static setup code runs exactly once, under a lock. That explains “X cannot be cast to X”, <code>NoClassDefFoundError: Could not initialize class</code>, startup deadlocks and metaspace leaks.',
  tldr: {
    problem: 'Class-loading bugs look impossible. A cast between two same-named classes fails. A class that exists “isn’t found”. Startup hangs with idle CPUs. Metaspace grows after every redeploy.',
    model: '<b>Load</b>: find the bytes and define the class. <b>Link</b>: check them, give statics default values, resolve references when needed. <b>Initialize</b>: run the static code (<code>&lt;clinit&gt;</code>) in source order, once, on first use. Loaders form a chain: Bootstrap → Platform → App → your own. Each asks its parent first.',
    hook: '“Why does <code>(Plugin) obj</code> throw <i>Plugin cannot be cast to Plugin</i>?” Two loaders each defined their own Plugin class. Same name, different types.',
    facts: [
      { v: '3', l: 'built-in loaders since Java 9: bootstrap (native, shows as <code>null</code>), platform (replaced the “extension” loader) and app' },
      { v: 'once', l: 'static setup runs at most once per class per loader. If it throws, the class is marked broken. Every later use fails with <code>NoClassDefFoundError</code>' },
      { v: 'native', l: 'class data lives in <b>metaspace</b>, outside the heap (since Java 8). No limit unless you set <code>-XX:MaxMetaspaceSize</code>' }
    ]
  },
  intro: {
    what: 'The JVM doesn’t load every class at startup. It loads each one the first time it’s needed. A <b>class loader</b> finds the bytes (in a JAR, a folder, the JDK or memory). It turns them into a <code>Class</code> object and checks them. Then the class’s <code>static</code> code runs once.',
    analogy: { icon: '📚', title: 'Libraries with a central archive', text: 'Your local library (app loader) gets a request. It first asks the regional library (platform), which asks the national archive (bootstrap). Only if nobody above has the book does it search its own shelves. Two local libraries can each own the same title. But they are <i>different copies</i>: a stamp from one isn’t valid in the other.' },
    steps: [
      { t: 'Loaders form a chain', d: 'Each loader has a parent and asks it first. So JDK classes always come from the JDK.', code: 'ClassLoader l = OrderService.class.getClassLoader();   // app loader\nl.getParent();              // platform loader\nString.class.getClassLoader();   // null = bootstrap' },
      { t: 'Loading is lazy', d: 'A class loads when first used, not at startup. Run with <code>-Xlog:class+load</code> to watch.' },
      { t: 'Static code runs once, on first use', d: 'Static fields and <code>static {}</code> blocks run top to bottom. They run the first time you create an instance, call a static method or read a static field.' },
      { t: 'Identity = name + loader', d: 'One class name loaded by two loaders makes two different types. Casts between them fail.' }
    ],
    terms: [
      ['class loader', 'An object that finds class bytes and defines <code>Class</code> objects.'],
      ['parent delegation', 'Asking the parent loader first, then searching yourself (<i>delegation</i>).'],
      ['<code>&lt;clinit&gt;</code>', 'The static setup code the compiler generates: all static field initializers and static blocks, in source order.'],
      ['linking', 'Checking the bytecode, giving statics default values, and turning names into real references.'],
      ['metaspace', 'Native memory where the JVM keeps class metadata (methods, bytecode, constant pools).'],
      ['TCCL', 'A loader attached to a thread (the <i>TCCL</i>). Frameworks use it to find your classes.']
    ]
  },
  visual: {
    title: 'Loaders, linking and initialization, step by step',
    caption: 'Pick a scenario and press Play. <b>delegation</b> follows <code>loadClass</code> up and down the chain. <b>linking & init order</b> shows when statics get their values. The last three replay classic production failures.'
  },
  gotchas: [
    { trap: 'Static initializer order surprises', code: `class Registry {
    static final Registry INSTANCE = new Registry();   // constructor runs now…
    static final Map<String, Handler> HANDLERS = new HashMap<>();
    Registry() { HANDLERS.put("x", …); }               // …HANDLERS is still null → NPE
}`, why: 'Static setup runs top to bottom. Code that runs early, like a constructor, sees later fields at default values.', fix: 'Declare dependencies first and singletons last. Or use an <code>enum</code> singleton or the holder idiom.' },
    { trap: 'A failed static init poisons the class for the JVM’s lifetime', code: `static final Config CFG = Config.load(System.getenv("CFG_PATH"));   // throws once
// 1st use: ExceptionInInitializerError (with the real cause)
// every later use: NoClassDefFoundError: Could not initialize class …`, why: 'If a class’s setup fails, the JVM marks it broken and never retries. Only the first error shows the real cause.', fix: 'Search the logs for the <b>first</b> <code>ExceptionInInitializerError</code>. Avoid risky I/O in static setup. Load config in a bean or factory method instead.' },
    { trap: 'Calling an overridable method from a constructor', why: 'The parent constructor runs before the child’s fields are set. So the override sees <code>null</code>/0 fields.', fix: 'Make methods called from constructors <code>private</code> or <code>final</code>. Or call them from a factory method after construction.' },
    { trap: '<code>Class.forName(name)</code> runs static initializers', why: 'The one-argument form loads <b>and initializes</b> the class with the caller’s loader. <code>ClassLoader.loadClass</code> loads without initializing.', fix: 'For scanning or plugin discovery, use <code>Class.forName(name, false, loader)</code>. Initialize on purpose later.' },
    { trap: 'Wrong thread context class loader in pools', why: 'ServiceLoader, JNDI, JAXB and many libraries find classes through <code>Thread.currentThread().getContextClassLoader()</code>. Pool threads (e.g. <code>ForkJoinPool.commonPool()</code>) may carry a different loader than request threads. You then see ClassNotFoundException only in async code, for example under a Spring Boot fat jar.', fix: 'Pass an explicit loader (<code>ServiceLoader.load(Svc.class, MyApp.class.getClassLoader())</code>). Or use your own executors with a ThreadFactory that sets it. Or set it around the call.' },
    { trap: 'Inlined constants don’t update', code: `public static final int MAX_RETRIES = 3;   // in library v1; v2 changes it to 5
// clients compiled against v1 still use 3, even with the v2 JAR on the classpath`, why: 'javac copies compile-time constants (primitives and Strings) into the caller’s bytecode. Reading them doesn’t even initialize the class.', fix: 'Expose values that may change through a method or a non-constant field (<code>static final int MAX = Integer.parseInt("3")</code> is not a constant). Recompile callers on upgrades.' },
    { trap: 'Cycles between static initializers', why: 'If A’s setup needs B and B’s needs A, one thread sees half-set statics (nulls). Two threads can deadlock forever.', fix: 'Break the cycle. Initialize lazily with a holder class. Keep static blocks free of I/O, locks and thread starts.' }
  ],
  scenarios: [
    { title: '“NoClassDefFoundError: Could not initialize class” on every request',
      symptom: 'After a config change, every pricing call fails with <code>NoClassDefFoundError: Could not initialize class com.acme.pricing.TaxTables</code>. The class is clearly in the JAR.',
      diagnose: `grep -n "ExceptionInInitializerError" app.log | head -1
# 08:00:02 ... java.lang.ExceptionInInitializerError
#   Caused by: java.lang.IllegalStateException: TAX_REGION not set
#     at com.acme.pricing.TaxTables.<clinit>(TaxTables.java:18)`,
      cause: 'A static block read an environment variable that was removed. The first use failed with ExceptionInInitializerError, logged once at startup. Now the class is broken. Every use throws NoClassDefFoundError without the cause.',
      fix: 'Restore the variable and restart. The JVM never retries class setup. Then move the loading into a Spring bean, so a failure stops startup with a clear message.',
      fixCode: `@Configuration
class TaxConfig {
    @Bean TaxTables taxTables(@Value("\${tax.region}") String region) {   // fails fast at startup
        return TaxTables.load(region);
    }
}` },
    { title: '“com.acme.Cart cannot be cast to com.acme.Cart” in local dev only',
      symptom: 'With Spring Boot DevTools on, reading a cached session fails with a ClassCastException between two identical names. Production works.',
      diagnose: `java.lang.ClassCastException: class com.acme.Cart cannot be cast to class com.acme.Cart
 (com.acme.Cart is in unnamed module of loader 'app';
  com.acme.Cart is in unnamed module of loader
  org.springframework.boot.devtools.restart.classloader.RestartClassLoader @5a2e4553)`,
      cause: 'DevTools loads your classes in a restart loader and JAR dependencies in the app loader. A cache library in the app loader rebuilt Cart with its own loader. Your code sees the restart loader’s Cart.',
      fix: 'Tell DevTools to load that library in the restart loader too, or exclude it from restarts. Or turn DevTools off for that profile.',
      fixCode: `# src/main/resources/META-INF/spring-devtools.properties
restart.include.cachelib=/cachelib-[\\\\w\\\\d-.]+\\\\.jar` },
    { title: 'Metaspace grows by 40 MB a day in a rules service',
      symptom: 'The heap stays flat, but memory climbs until the container kills the process. With <code>MaxMetaspaceSize</code> set in staging, it fails with <code>OutOfMemoryError: Metaspace</code>.',
      diagnose: `jcmd <pid> VM.classloader_stats | sort -k3 -n | tail -3
#  … 18,233 loaders of type groovy.lang.GroovyClassLoader$InnerLoader
jcmd <pid> VM.metaspace | head -20`,
      cause: 'Each request compiled its rule script with a new engine. Each compile makes a new class in a new loader. A static cache kept every script, and so every loader and class, alive forever.',
      fix: 'Compile each script once. Cache it by content hash in a bounded cache. Set <code>-XX:MaxMetaspaceSize</code> so a leak fails loudly. Alert on metaspace use.',
      fixCode: `private final Cache<String, Script> compiled = Caffeine.newBuilder()
    .maximumSize(500).build();          // evicted entries let their loaders be unloaded

Script script(String source) {
    return compiled.get(sha256(source), h -> shell.parse(source));
}` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    static class Counter {
        static Counter INSTANCE = new Counter();
        static int count = 0;
        static int other;
        Counter() { count++; other++; }
    }

    public static void main(String[] a) {
        System.out.println(Counter.count + " " + Counter.other);
    }
}`, options: ['1 1', '0 1', '0 0', '1 0'], answer: 1, run: true, expect: '0 1', explain: 'First both fields are set to 0. Then the static code runs in order. The constructor makes both 1, then <code>count = 0</code> resets count. <code>other</code> has no initializer, so it stays 1: <b>0 1</b>.' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    static class A {
        static final int K = 42;
        static final Integer B = 7;
        static { System.out.print("init "); }
    }

    public static void main(String[] a) {
        System.out.print(A.K + " ");
        System.out.println(A.B);
    }
}`, options: ['init 42 7', '42 init 7', '42 7', 'init 42 init 7'], answer: 1, run: true, expect: '42 init 7', explain: '<code>K</code> is a compile-time constant, so javac inlines 42 and A isn’t initialized. <code>B</code> is an <code>Integer</code>, and boxing isn’t a constant. Reading it runs the static code, which prints "init ". Then <code>println</code> prints 7: <b>42 init 7</b>.' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    static class P {
        static { System.out.print("P "); }
        static int x = 1;
    }
    static class C extends P {
        static { System.out.print("C "); }
    }

    public static void main(String[] a) {
        System.out.println(C.x);
    }
}`, options: ['P C 1', 'C P 1', 'P 1', '1'], answer: 2, run: true, expect: 'P 1', explain: 'Reading a static field initializes only the class that <b>declares</b> it, even through a subclass. <code>x</code> lives in P, so C is never initialized: <b>P 1</b>.' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    static class P {
        P() { System.out.print("P() "); hello(); }
        void hello() { System.out.print("P.hello "); }
    }
    static class C extends P {
        String name = "c";
        C() { System.out.print("C() "); }
        @Override void hello() { System.out.print("C.hello:" + name + " "); }
    }

    public static void main(String[] a) {
        new C();
        System.out.println();
    }
}`, options: ['P() P.hello C()', 'P() C.hello:c C()', 'P() C.hello:null C()', 'C() P() C.hello:c'], answer: 2, run: true, expect: 'P() C.hello:null C()', explain: 'The P constructor runs first and calls <code>hello()</code>. That call goes to C’s override. C’s field (<code>name = "c"</code>) is set only after <code>super()</code> returns. So name is still null: <b>P() C.hello:null C()</b>.' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    static class Bad {
        static int v = 1 / Integer.parseInt("0");
    }

    public static void main(String[] a) {
        for (int i = 0; i < 2; i++) {
            try {
                System.out.print(Bad.v);
            } catch (Throwable t) {
                System.out.print(t.getClass().getSimpleName() + " ");
            }
        }
        System.out.println();
    }
}`, options: ['ArithmeticException ArithmeticException', 'ExceptionInInitializerError ExceptionInInitializerError', 'ExceptionInInitializerError NoClassDefFoundError', 'ArithmeticException NoClassDefFoundError'], answer: 2, run: true, expect: 'ExceptionInInitializerError NoClassDefFoundError', explain: 'An exception from static setup is wrapped in <b>ExceptionInInitializerError</b>. The class is marked broken. The JVM never retries, so the second access throws <b>NoClassDefFoundError</b> (“Could not initialize class Main$Bad”). In production, always look for the first error.' },
    { kind: 'concept', q: 'What is the difference between <code>Class.forName("com.acme.X")</code> and <code>loader.loadClass("com.acme.X")</code>?', options: ['None', 'forName loads and initialises; loadClass only loads', 'loadClass initialises; forName only loads', 'forName bypasses delegation'], answer: 1, explain: 'One-argument <code>forName</code> uses the caller’s loader and <b>initializes</b> the class, so static blocks run. <code>loadClass</code> loads but doesn’t initialize. Old JDBC code used <code>Class.forName("…Driver")</code> to run the driver’s static registration. JDBC 4 drivers register themselves.' },
    { kind: 'concept', q: 'Loader A and loader B (siblings, same parent) each load <code>com.acme.Plugin</code> from identical JARs. Which statement is true?', options: ['The JVM detects they are identical and shares one Class', 'They are two distinct classes; instances of one aren’t instances of the other', 'The second load throws LinkageError', 'Only static fields are shared'], answer: 1, explain: 'At runtime a class is (name, defining loader). These are <b>two classes</b>, each with its own statics. <code>instanceof</code> and casts between them fail. Fix: load the shared interface once, in a common parent. A LinkageError comes when the <i>same</i> loader defines one name twice.' }
  ],
  interview: [
    { q: 'Describe the parent delegation model. Why does it exist?', a: '<p><code>loadClass</code> checks whether it already loaded the class. If not, it asks the parent. Only if the parent fails does it call its own <code>findClass</code>. So core classes always come from the JDK (no fake <code>java.lang.String</code>). Every loader shares one copy of a class. Lookup stays predictable. Since Java 9, a class in a named module comes from the loader that owns the module.</p>', fu: 'When is delegation reversed? (Servlet containers and many plugin systems look in the child first, so each app can bundle its own library versions.)', lvl: 'core' },
    { q: 'What are the phases of class loading, and when does each happen?', a: '<ol><li><b>Loading</b>: find the bytes and create the Class object.</li><li><b>Linking</b>: <i>verify</i> the bytecode is safe, <i>prepare</i> statics with default values, <i>resolve</i> names to references (lazily in HotSpot).</li><li><b>Initialization</b>: run <code>&lt;clinit&gt;</code> on first use.</li></ol><p>Loading can happen long before initialization, e.g. when a class only appears in a signature.</p>', lvl: 'core' },
    { q: 'What triggers class initialization?', a: '<p>First real use: <code>new</code>, calling a static method, or touching a static field that isn’t a constant. Also some reflection (<code>Class.forName</code>), initializing a subclass (the parent goes first), or being the main class. These don’t count: <code>X.class</code>, <code>new X[10]</code>, inlined constants, or a static field reached through a subclass.</p>', lvl: 'core' },
    { q: 'How is static initialization made thread-safe, and how can it deadlock?', a: '<p>The JVM runs static setup under a per-class lock. Other threads wait until it finishes. Then they see all its writes. That’s why the holder idiom gives lazy, thread-safe singletons with no <code>volatile</code>. It deadlocks when two classes’ setups need each other and two threads start one each.</p>', lvl: 'deep' },
    { q: 'Why might you see ClassCastException: X cannot be cast to X?', a: '<p>Two loaders each defined X, and you cast an object of one to the other’s type. Common causes: DevTools’ restart loader, the same JAR in a webapp and the container’s lib, plugin frameworks, or deserializing with the wrong loader. Since Java 11 the message names both loaders. Fix: make the shared type visible from one common parent.</p>', lvl: 'core' },
    { q: 'ClassNotFoundException vs NoClassDefFoundError?', a: '<ul><li><b>ClassNotFoundException</b> (checked): a lookup by name failed, e.g. <code>Class.forName</code>, <code>loadClass</code>, deserialization.</li><li><b>NoClassDefFoundError</b> (an Error): a class present at compile time can’t be used at run time. It is missing from the classpath, its setup failed earlier, or a dependency is missing.</li></ul>', lvl: 'core' },
    { q: 'When can a class be unloaded?', a: '<p>Only when its <b>defining loader</b> becomes unreachable, with every class it defined and every instance of them. Classes from the built-in loaders never unload. Unloading happens during GC and frees metaspace. One stray reference pins the whole loader: a ThreadLocal, a static in a parent library, a running thread.</p>', lvl: 'deep' },
    { q: 'What is metaspace and how do you size and monitor it?', a: '<p>Native memory for class data, added in Java 8 to replace the fixed-size PermGen. By default only available memory limits it. <code>-XX:MaxMetaspaceSize</code> caps it. <code>-XX:MetaspaceSize</code> sets the first GC trigger. Monitor with <code>jcmd &lt;pid&gt; VM.metaspace</code>, <code>VM.classloader_stats</code>, the <code>jvm.memory.used{area=nonheap,id=Metaspace}</code> metric, and <code>-Xlog:class+load,class+unload</code>. Since Java 16 it returns memory to the OS more readily.</p>', lvl: 'deep' },
    { q: 'What is the thread context class loader for?', a: '<p>It lets code from a parent loader find classes in a child. Delegation alone can’t do that. DriverManager, ServiceLoader, JNDI and many frameworks use it. Containers set it to the webapp loader on request threads. Bugs appear when work moves to threads with a different one. They also appear when it keeps an undeployed webapp’s loader alive.</p>', lvl: 'deep' },
    { q: 'How do you implement a lazy, thread-safe singleton without locks?', a: '<p>Use the holder idiom: a private static nested <code>Holder</code> class with a <code>static final</code> instance. The JVM initializes Holder on the first <code>getInstance()</code> call, under its lock, exactly once. Or use a one-element <code>enum</code>, which is also safe against serialization and reflection. In Spring you rarely need either: beans are singletons by default.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Watching class loading in production', lang: 'bash', code: `# which classes load, from where (unified logging, Java 9+)
java -Xlog:class+load=info,class+unload=info:file=/tmp/classes.log -jar app.jar

# loaders and their class counts / metaspace use on a live JVM
jcmd <pid> VM.classloaders          # loader tree (Java 11+)
jcmd <pid> VM.classloader_stats
jcmd <pid> VM.metaspace

# fail loudly instead of eating native memory
java -XX:MaxMetaspaceSize=256m -XX:+HeapDumpOnOutOfMemoryError -jar app.jar`, note: 'A class count that keeps creeping up after warm-up (<code>jvm.classes.loaded</code>) is the first sign of a class-generation leak.' },
    { title: 'Plugin loader with a shared API', lang: 'java', code: `// Plugin (the interface) lives in the app; implementations live in plugin JARs
public interface Plugin { String name(); void start(); }

List<Plugin> loadPlugins(Path dir) throws IOException {
    List<Plugin> out = new ArrayList<>();
    try (var jars = Files.list(dir)) {
        for (Path jar : jars.filter(p -> p.toString().endsWith(".jar")).toList()) {
            URLClassLoader cl = new URLClassLoader(new URL[]{ jar.toUri().toURL() },
                                                   Plugin.class.getClassLoader());   // parent = app
            ServiceLoader.load(Plugin.class, cl).forEach(out::add);  // META-INF/services
            // keep 'cl' to close() it when the plugin is unloaded
        }
    }
    return out;
}`, note: 'Every plugin finds <code>Plugin</code> through its parent. So they all share one interface class, and casts work.' },
    { title: 'Lazy init without locks', lang: 'java', code: `public final class GeoIndex {
    private GeoIndex() { /* expensive: loads 200 MB of polygons */ }

    private static final class Holder {               // not initialised until first use
        static final GeoIndex INSTANCE = new GeoIndex();
    }
    public static GeoIndex get() { return Holder.INSTANCE; }   // JVM class-init lock = thread-safe
}

// or, when serialisation/reflection safety matters:
public enum Clock2 { INSTANCE; public Instant now() { return Instant.now(); } }` }
  ]
});

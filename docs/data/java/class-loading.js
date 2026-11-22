IA.register({
  track: 'java',
  slug: 'class-loading',
  title: 'Class loading',
  tagline: 'A class is identified by its <b>name plus the loader that defined it</b>. Loaders ask their parent first, link lazily, and run static initializers exactly once under a lock. That explains “X cannot be cast to X”, <code>NoClassDefFoundError: Could not initialize class</code>, static-init deadlocks and metaspace leaks.',
  tldr: {
    problem: 'Class-loading bugs look impossible: a cast between two classes with the same name fails, a class that exists “isn’t found”, startup hangs with idle CPUs, or metaspace grows after every redeploy.',
    model: '<b>Load</b> (find bytes, <code>defineClass</code>) → <b>link</b> (verify, prepare statics to defaults, resolve references lazily) → <b>initialize</b> (run <code>&lt;clinit&gt;</code> in source order, once, on first active use). Loaders form a parent chain: Bootstrap → Platform → App → your custom loaders, and by default they delegate parent-first.',
    hook: '“Why does <code>(Plugin) obj</code> throw <i>Plugin cannot be cast to Plugin</i>?” Because two loaders each defined their own Plugin class. Same name, different runtime types.',
    facts: [
      { v: '3', l: 'built-in loaders since Java 9: bootstrap (native, shows as <code>null</code>), platform (replaced the “extension” loader) and app/system' },
      { v: 'once', l: 'static initialization runs at most once per class per loader. If it throws, the class is marked erroneous and every later use fails with <code>NoClassDefFoundError</code>' },
      { v: 'native', l: 'class metadata lives in <b>metaspace</b>, outside the heap (since Java 8, replacing PermGen). Unbounded unless you set <code>-XX:MaxMetaspaceSize</code>' }
    ]
  },
  intro: {
    what: 'Your <code>.class</code> files (and JDK classes) aren’t all loaded at startup. The JVM loads a class the first time it needs it. A <b>class loader</b> finds the bytes (in a JAR, a folder, the JDK image, or memory), turns them into a <code>Class</code> object, checks them, and finally runs the class’s <code>static</code> code once.',
    analogy: { icon: '📚', title: 'Libraries with a central archive', text: 'Your local library (app loader) gets a request. It first asks the regional library (platform), which asks the national archive (bootstrap). Only if nobody above has the book does the local library look on its own shelves. Two local libraries can each own a copy of the same title, but they are <i>different copies</i>: a stamp from one isn’t valid in the other.' },
    steps: [
      { t: 'Loaders form a chain', d: 'Each loader has a parent. By default it asks the parent first, so JDK classes always come from the JDK.', code: 'ClassLoader l = OrderService.class.getClassLoader();   // app loader\nl.getParent();              // platform loader\nString.class.getClassLoader();   // null = bootstrap' },
      { t: 'Loading is lazy', d: 'A class is loaded when first referenced, not at startup. Run with <code>-Xlog:class+load</code> to watch it happen.' },
      { t: 'Static code runs once, on first use', d: 'Static fields and <code>static {}</code> blocks run top to bottom the first time you create an instance, call a static method or read a static field.' },
      { t: 'Identity = name + loader', d: 'The same class name loaded by two loaders gives two different types. Casting between them fails.' }
    ],
    terms: [
      ['class loader', 'An object that finds class bytes and defines <code>Class</code> objects.'],
      ['parent delegation', 'Asking the parent loader first, then searching yourself.'],
      ['<code>&lt;clinit&gt;</code>', 'The compiler-generated static initializer: all static field initializers and static blocks, in source order.'],
      ['linking', 'Verification, preparation (defaults for statics) and resolution (symbol → reference).'],
      ['metaspace', 'Native memory where the JVM keeps class metadata (methods, bytecode, constant pools).'],
      ['TCCL', 'Thread context class loader: a loader attached to a thread, which frameworks use to find user classes.']
    ]
  },
  visual: {
    title: 'Loaders, linking and initialization, step by step',
    caption: 'Pick a scenario and press Play. <b>delegation</b> follows <code>loadClass</code> up and down the chain. <b>linking & init order</b> shows exactly when statics get their values. The last three replay classic production failures.'
  },
  gotchas: [
    { trap: 'Static initializer order surprises', code: `class Registry {
    static final Registry INSTANCE = new Registry();   // constructor runs now…
    static final Map<String, Handler> HANDLERS = new HashMap<>();
    Registry() { HANDLERS.put("x", …); }               // …HANDLERS is still null → NPE
}`, why: '<code>&lt;clinit&gt;</code> runs initializers top to bottom. Code that runs early (a constructor, a static method) sees later fields at their default values.', fix: 'Declare dependencies first, keep singletons last, or use an <code>enum</code> singleton or the holder idiom.' },
    { trap: 'A failed static init poisons the class for the JVM’s lifetime', code: `static final Config CFG = Config.load(System.getenv("CFG_PATH"));   // throws once
// 1st use: ExceptionInInitializerError (with the real cause)
// every later use: NoClassDefFoundError: Could not initialize class …`, why: 'A class whose initialization failed is marked erroneous and is never retried. Later errors don’t carry the original cause; only the first one does.', fix: 'Search the logs for the <b>first</b> <code>ExceptionInInitializerError</code>. Don’t do fallible I/O in static initializers; load config in a bean or factory method where failures are handled.' },
    { trap: 'Calling an overridable method from a constructor', why: 'The superclass constructor runs before the subclass’s field initializers, so the override sees <code>null</code>/0 fields.', fix: 'Make methods called from constructors <code>private</code> or <code>final</code>, or move the call to a factory method after construction.' },
    { trap: '<code>Class.forName(name)</code> runs static initializers', why: 'The one-argument form loads <b>and initializes</b> using the caller’s loader. <code>ClassLoader.loadClass</code> loads without initializing.', fix: 'For scanning or plugin discovery, use <code>Class.forName(name, false, loader)</code> and initialise deliberately.' },
    { trap: 'Wrong thread context class loader in pools', why: 'ServiceLoader, JNDI, JAXB and many libraries look up classes via <code>Thread.currentThread().getContextClassLoader()</code>. Threads created by the JDK (e.g. <code>ForkJoinPool.commonPool()</code>) or by a library may carry a different TCCL than your request threads, which shows up as ClassNotFoundException only in async code, for example under a Spring Boot fat-jar launcher.', fix: 'Pass an explicit loader (<code>ServiceLoader.load(Svc.class, MyApp.class.getClassLoader())</code>), use your own executors with a ThreadFactory that sets the TCCL, or set it around the call.' },
    { trap: 'Inlined constants don’t update', code: `public static final int MAX_RETRIES = 3;   // in library v1; v2 changes it to 5
// clients compiled against v1 still use 3, even with the v2 JAR on the classpath`, why: 'javac copies compile-time constants (primitives and Strings with constant initializers) into the client’s bytecode. Reading them doesn’t even trigger class initialization.', fix: 'Expose values that may change through a static method or a non-constant field (<code>static final int MAX = Integer.parseInt("3")</code> is not a constant), and recompile clients on upgrades.' },
    { trap: 'Cycles between static initializers', why: 'If A’s <code>&lt;clinit&gt;</code> needs B and B’s needs A, then one thread sees half-initialised statics (nulls), and two threads can deadlock forever with no timeout.', fix: 'Break the cycle. Initialise lazily with a holder class, and keep static blocks free of I/O, locks and thread starts.' }
  ],
  scenarios: [
    { title: '“NoClassDefFoundError: Could not initialize class” on every request',
      symptom: 'After a config change, every call to the pricing endpoint fails with <code>NoClassDefFoundError: Could not initialize class com.acme.pricing.TaxTables</code>. The class is clearly in the JAR.',
      diagnose: `grep -n "ExceptionInInitializerError" app.log | head -1
# 08:00:02 ... java.lang.ExceptionInInitializerError
#   Caused by: java.lang.IllegalStateException: TAX_REGION not set
#     at com.acme.pricing.TaxTables.<clinit>(TaxTables.java:18)`,
      cause: 'A static initializer read an environment variable that was removed. The first use failed with ExceptionInInitializerError, which was logged once at startup. From then on the class is erroneous, and every use throws NoClassDefFoundError without the root cause.',
      fix: 'Restore the variable and restart; class init is never retried. Then move the loading into a Spring bean so a failure stops startup with a clear message.',
      fixCode: `@Configuration
class TaxConfig {
    @Bean TaxTables taxTables(@Value("\${tax.region}") String region) {   // fails fast at startup
        return TaxTables.load(region);
    }
}` },
    { title: '“com.acme.Cart cannot be cast to com.acme.Cart” in local dev only',
      symptom: 'With Spring Boot DevTools on, reading a cached session object fails with a ClassCastException between two identical class names. Production works.',
      diagnose: `java.lang.ClassCastException: class com.acme.Cart cannot be cast to class com.acme.Cart
 (com.acme.Cart is in unnamed module of loader 'app';
  com.acme.Cart is in unnamed module of loader
  org.springframework.boot.devtools.restart.classloader.RestartClassLoader @5a2e4553)`,
      cause: 'DevTools loads your project classes in a restart loader and JAR dependencies in the base (app) loader. A cache library in the base loader deserialised Cart with its own loader, while your code sees the restart loader’s Cart.',
      fix: 'Tell DevTools to load that library in the restart loader too, or exclude it from restarts. Or turn DevTools off for that profile.',
      fixCode: `# src/main/resources/META-INF/spring-devtools.properties
restart.include.cachelib=/cachelib-[\\\\w\\\\d-.]+\\\\.jar` },
    { title: 'Metaspace grows by 40 MB a day in a rules service',
      symptom: 'No heap growth, but RSS climbs steadily until the container is OOM-killed. With <code>MaxMetaspaceSize</code> set in staging, it fails with <code>OutOfMemoryError: Metaspace</code>.',
      diagnose: `jcmd <pid> VM.classloader_stats | sort -k3 -n | tail -3
#  … 18,233 loaders of type groovy.lang.GroovyClassLoader$InnerLoader
jcmd <pid> VM.metaspace | head -20`,
      cause: 'Each request compiled its rule script with a new script engine, which generates a new class in a new loader. A static cache kept the compiled scripts, and therefore their loaders and classes, reachable forever.',
      fix: 'Compile each distinct script once and cache it by content hash with a bounded cache. Set <code>-XX:MaxMetaspaceSize</code> so a leak fails loudly, and alert on metaspace usage.',
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
}`, options: ['1 1', '0 1', '0 0', '1 0'], answer: 1, run: true, expect: '0 1', explain: 'Preparation sets both to 0. <code>&lt;clinit&gt;</code> then runs in source order: the constructor makes both 1, then <code>count = 0</code> resets count. <code>other</code> has no initializer, so it stays 1: <b>0 1</b>.' },
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
}`, options: ['init 42 7', '42 init 7', '42 7', 'init 42 init 7'], answer: 1, run: true, expect: '42 init 7', explain: '<code>K</code> is a compile-time constant, so javac inlines 42 and A isn’t initialised. <code>B</code> is an <code>Integer</code> (boxing isn’t a constant expression), so reading it triggers <code>&lt;clinit&gt;</code>, which prints "init " before <code>println</code> prints 7: <b>42 init 7</b>.' },
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
}`, options: ['P C 1', 'C P 1', 'P 1', '1'], answer: 2, run: true, expect: 'P 1', explain: 'A static field reference initialises only the class that <b>declares</b> the field (JLS 12.4.1), even when accessed through a subclass. <code>x</code> lives in P, so C is never initialised: <b>P 1</b>.' },
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
}`, options: ['P() P.hello C()', 'P() C.hello:c C()', 'P() C.hello:null C()', 'C() P() C.hello:c'], answer: 2, run: true, expect: 'P() C.hello:null C()', explain: 'The P constructor runs first and calls <code>hello()</code>, which dispatches virtually to C’s override. C’s field initializer (<code>name = "c"</code>) runs only after <code>super()</code> returns, so name is still null: <b>P() C.hello:null C()</b>.' },
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
}`, options: ['ArithmeticException ArithmeticException', 'ExceptionInInitializerError ExceptionInInitializerError', 'ExceptionInInitializerError NoClassDefFoundError', 'ArithmeticException NoClassDefFoundError'], answer: 2, run: true, expect: 'ExceptionInInitializerError NoClassDefFoundError', explain: 'An exception escaping <code>&lt;clinit&gt;</code> is wrapped in <b>ExceptionInInitializerError</b>, and the class is marked erroneous. The JVM never retries, so the second access throws <b>NoClassDefFoundError</b> (“Could not initialize class Main$Bad”). In production, always look for the first error.' },
    { kind: 'concept', q: 'What is the difference between <code>Class.forName("com.acme.X")</code> and <code>loader.loadClass("com.acme.X")</code>?', options: ['None', 'forName loads and initialises; loadClass only loads', 'loadClass initialises; forName only loads', 'forName bypasses delegation'], answer: 1, explain: 'One-argument <code>forName</code> uses the caller’s loader and <b>initialises</b> the class (static blocks run). <code>loadClass</code> loads, and may link, but doesn’t initialise. JDBC 3-era code relied on <code>Class.forName("…Driver")</code> to run the driver’s static registration; JDBC 4 drivers register themselves through ServiceLoader.' },
    { kind: 'concept', q: 'Loader A and loader B (siblings, same parent) each load <code>com.acme.Plugin</code> from identical JARs. Which statement is true?', options: ['The JVM detects they are identical and shares one Class', 'They are two distinct classes; instances of one aren’t instances of the other', 'The second load throws LinkageError', 'Only static fields are shared'], answer: 1, explain: 'Runtime class identity is (binary name, defining loader). These are <b>two classes</b>, each with its own statics; <code>instanceof</code> and casts between them fail. The fix is to load the shared type (an interface) once, in a common parent. A LinkageError happens when the <i>same</i> loader is asked to define the same name twice, or on loader constraint violations.' }
  ],
  interview: [
    { q: 'Describe the parent delegation model. Why does it exist?', a: '<p><code>loadClass</code> checks whether this loader already loaded the class, then asks the parent, and only if the parent fails calls its own <code>findClass</code>. Benefits: core classes always come from the JDK (no fake <code>java.lang.String</code>), every loader shares one copy of a class, and the lookup is predictable. Since Java 9 the built-in loaders also route by module: a class in a named module is loaded by the loader that owns that module.</p>', fu: 'When is delegation inverted? (Servlet containers’ webapp loaders and many plugin systems are child-first for application classes, so each app can bundle its own library versions.)', lvl: 'core' },
    { q: 'What are the phases of class loading, and when does each happen?', a: '<ol><li><b>Loading</b>: find bytes, <code>defineClass</code>, create the Class object.</li><li><b>Linking</b>: <i>verification</i> (bytecode safety), <i>preparation</i> (allocate statics with default values), <i>resolution</i> (symbolic → direct references; lazy in HotSpot).</li><li><b>Initialization</b>: run <code>&lt;clinit&gt;</code> on first active use.</li></ol><p>Loading can happen well before initialization, e.g. when a class is only referenced in a signature.</p>', lvl: 'core' },
    { q: 'What triggers class initialization?', a: '<p>First active use: <code>new</code>, invoking a static method, reading or writing a static field that isn’t a compile-time constant, some reflective calls (<code>Class.forName</code>, <code>newInstance</code>), initialising a subclass (the superclass goes first), or the class being the main class. Not triggers: <code>X.class</code>, <code>new X[10]</code>, reading inlined constants, or a static field reached through a subclass (that initialises only the declaring class).</p>', lvl: 'core' },
    { q: 'How is static initialization made thread-safe, and how can it deadlock?', a: '<p>The JVM runs <code>&lt;clinit&gt;</code> under a per-class initialization lock; other threads that need the class wait until it finishes, and then they see all its writes (a happens-before edge). This is why the holder idiom gives lazy, thread-safe singletons with no <code>volatile</code>. It deadlocks when two classes’ initializers need each other and two threads start one each, or when <code>&lt;clinit&gt;</code> waits on a thread that needs the same class.</p>', lvl: 'deep' },
    { q: 'Why might you see ClassCastException: X cannot be cast to X?', a: '<p>Two loaders each defined X, and an object of one is cast to the other’s type. Typical setups: Spring Boot DevTools’ restart loader vs the base loader, the same JAR in both a webapp and the container’s lib, plugin frameworks, or deserialisation using the wrong loader. The Java 11+ message names both loaders. Fix it by making the shared type visible from one common parent.</p>', lvl: 'core' },
    { q: 'ClassNotFoundException vs NoClassDefFoundError?', a: '<ul><li><b>ClassNotFoundException</b> (checked): an explicit lookup by name failed: <code>Class.forName</code>, <code>loadClass</code>, deserialisation.</li><li><b>NoClassDefFoundError</b> (an Error): a class that was present at compile time can’t be linked at run time: missing from the classpath, a failed earlier initialization (“Could not initialize class”), or a dependency missing during linking.</li></ul>', lvl: 'core' },
    { q: 'When can a class be unloaded?', a: '<p>Only when its <b>defining loader</b> becomes unreachable, together with every Class it defined and every instance of them. Classes from the bootstrap, platform and app loaders are never unloaded. Unloading happens during GC (full or concurrent cycles, depending on the collector) and frees metaspace. One stray reference to any class or instance from that loader (a ThreadLocal, a static in a parent-loaded library, a running thread) pins the whole loader.</p>', lvl: 'deep' },
    { q: 'What is metaspace and how do you size and monitor it?', a: '<p>Native memory for class metadata, introduced in Java 8 to replace the fixed-size PermGen. By default it is limited only by available memory; <code>-XX:MaxMetaspaceSize</code> caps it and <code>-XX:MetaspaceSize</code> sets the first GC trigger. Monitor with <code>jcmd &lt;pid&gt; VM.metaspace</code>, <code>VM.classloader_stats</code>, the <code>jvm.memory.used{area=nonheap,id=Metaspace}</code> Micrometer metric, and <code>-Xlog:class+load,class+unload</code>. JEP 387 (Java 16) made metaspace return memory to the OS more readily.</p>', lvl: 'deep' },
    { q: 'What is the thread context class loader for?', a: '<p>It lets code loaded by a parent loader find classes from a child, which delegation can’t do. JDBC’s DriverManager, ServiceLoader (by default), JNDI and many frameworks use it. Containers set it to the webapp loader on request threads. Bugs appear when work moves to threads with a different TCCL (common pool, library-created threads), or when the TCCL keeps an undeployed webapp’s loader alive.</p>', lvl: 'deep' },
    { q: 'How do you implement a lazy, thread-safe singleton without locks?', a: '<p>The initialization-on-demand holder idiom: a private static nested <code>Holder</code> class with a <code>static final</code> instance. The JVM initialises Holder on the first <code>getInstance()</code> call, under its class-init lock, exactly once. Or use a single-element <code>enum</code>, which is also safe against serialisation and reflection. In Spring you rarely need either: beans are singletons by default.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Watching class loading in production', lang: 'bash', code: `# which classes load, from where (unified logging, Java 9+)
java -Xlog:class+load=info,class+unload=info:file=/tmp/classes.log -jar app.jar

# loaders and their class counts / metaspace use on a live JVM
jcmd <pid> VM.classloaders          # loader tree (Java 11+)
jcmd <pid> VM.classloader_stats
jcmd <pid> VM.metaspace

# fail loudly instead of eating native memory
java -XX:MaxMetaspaceSize=256m -XX:+HeapDumpOnOutOfMemoryError -jar app.jar`, note: 'A slowly increasing class count after warm-up (Micrometer <code>jvm.classes.loaded</code>) is the earliest signal of a class-generation leak.' },
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
}`, note: 'Every plugin resolves <code>Plugin</code> through its parent, so all of them share one interface Class and casts work.' },
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

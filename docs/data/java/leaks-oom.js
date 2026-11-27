IA.register({
  track: 'java',
  slug: 'leaks-oom',
  title: 'Memory leaks & OOM',
  tagline: 'A Java memory leak is memory that is <b>still reachable but no longer needed</b>. The GC can’t free it. So the memory left after each GC keeps rising. Then an <code>OutOfMemoryError</code> (or the kernel) ends it. The error message names the area that ran out. A heap dump names the culprit.',
  tldr: {
    problem: 'Services slow down over days, then fall over. Pods restart with exit code 137. Batch jobs die at 80%. The OOM stack trace usually blames an innocent thread that happened to allocate last.',
    model: 'Read the OOM <b>message</b> to find the area: heap, metaspace, direct, native threads. No message at all means a container kill. For heap leaks, watch usage <b>after GC</b> over time. Take a <b>heap dump</b>. Follow the <b>dominator tree</b> and the path to GC roots to the reference that shouldn’t exist. Common holders: static collections, ThreadLocals, listeners, sessions, persistence contexts.',
    hook: '“How do you find a memory leak in production?” Confirm it with the after-GC trend. Capture a heap dump (on OOM, or two an hour apart). Open it in MAT and sort by retained size. Read the path to GC roots.',
    facts: [
      { v: '137', l: 'exit code of a process killed by SIGKILL (128 + 9). A Kubernetes OOMKilled JVM shows it. No Java error, no heap dump' },
      { v: '≈ heap size', l: 'a heap dump is about the size of the live heap. It holds every string in memory, including tokens and personal data. Store and share it with care' },
      { v: '7+', l: 'distinct OOM messages: Java heap space, GC overhead limit exceeded, Metaspace, Compressed class space, direct buffer memory, unable to create native thread, requested array size exceeds VM limit' }
    ]
  },
  intro: {
    what: 'Java frees memory for you, but only for objects nothing refers to. Say your code keeps a reference by accident, like adding to a list that is never cleared. That object can never be freed. Do that on every request and memory grows until the JVM runs out: an <b>OutOfMemoryError</b>.',
    analogy: { icon: '🧳', title: 'A cloakroom that never returns coats', text: 'Guests hand in coats and get a ticket. If the cloakroom never throws away tickets of guests who left, the coats stay forever. The room fills up and nobody new can check in. The hangers (the GC) are fine. The bookkeeping is wrong.' },
    steps: [
      { t: 'Leak = still referenced', d: 'The GC keeps everything reachable. A leak is a reference you forgot about, often in a static field or a long-lived object.', code: 'static final List<Order> RECENT = new ArrayList<>();\nvoid handle(Order o) { RECENT.add(o); }   // grows forever' },
      { t: 'Look at the floor, not the peak', d: 'Heap usage always rises and falls. If the lowest point after each GC keeps rising for hours, something leaks.' },
      { t: 'Capture evidence automatically', d: 'Ask the JVM to write a heap dump when it runs out of memory.', code: 'java -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/dumps -jar app.jar' },
      { t: 'Analyse the dump', d: 'Open the <code>.hprof</code> file in Eclipse MAT or IntelliJ. Find the object that holds the most memory. Follow who refers to it.' }
    ],
    terms: [
      ['heap dump', 'A snapshot of every object in the heap and the references between them (<code>.hprof</code>).'],
      ['shallow size', 'Memory used by one object itself.'],
      ['retained size', 'Memory freed if that object became unreachable: itself plus everything only it keeps alive (<i>retained size</i>).'],
      ['dominator tree', 'A tree where each object’s parent is the one every path to it goes through. Sorted by retained size, it shows what holds the memory.'],
      ['GC root', 'Where reachability starts: thread stacks, static fields, JNI references, running threads.'],
      ['OOMKilled', 'The container runtime killed the process for going over its memory limit.']
    ]
  },
  visual: {
    title: 'From the first symptom to the guilty reference',
    caption: 'Pick a scenario and press Play. <b>a leak over time</b> shows the rising floor. <b>leak patterns</b> draws three classic reference chains. <b>heap dump in MAT</b> walks a dominator tree. <b>OOM kinds</b> and <b>container limits</b> cover every way a JVM runs out.'
  },
  gotchas: [
    { trap: 'Caches without a bound, or with accidental unique keys', code: `private static final Map<String, Report> CACHE = new ConcurrentHashMap<>();
CACHE.computeIfAbsent(userId + ":" + Instant.now(), k -> build());   // a new key every call`, why: 'A static map lives forever. Without a size limit or expiry it only grows. A key with a timestamp, request id or mutable object makes every entry unique.', fix: 'Use a bounded cache (Caffeine <code>maximumSize</code>, <code>expireAfterWrite</code>). Expose its size and evictions as metrics.' },
    { trap: 'ThreadLocal on pooled threads without <code>remove()</code>', code: `static final ThreadLocal<UserContext> CTX = new ThreadLocal<>();
CTX.set(ctx);       // in a filter
// … no finally { CTX.remove(); }`, why: 'Request threads live as long as the JVM. Values stay in each thread’s map. The next request on that thread can see the last user’s data. That’s a memory leak and a data leak.', fix: 'Always <code>remove()</code> in a <code>finally</code> block. Prefer request-scoped beans, or <code>ScopedValue</code> (preview in Java 21) with virtual threads.' },
    { trap: 'Listeners and callbacks that are never unregistered', why: 'A long-lived publisher (event bus, singleton, static registry) holds every subscriber. Lambdas and inner classes also hold their outer object.', fix: 'Return a handle that unregisters (<code>AutoCloseable</code>). Or unregister in <code>@PreDestroy</code>. Or let the framework manage it (Spring <code>@EventListener</code> on beans).' },
    { trap: 'One giant persistence context in a batch job', code: `@Transactional
void reprice() {
    for (Product p : repo.findAll()) p.setPrice(calc(p));   // 2M managed entities in one session
}`, why: 'JPA keeps every loaded entity, plus a copy for change checks, until the transaction ends. A big batch keeps millions of objects alive.', fix: 'Work in chunks: page through, and <code>flush()</code> and <code>clear()</code> every N rows. Or use Spring Batch, or plain JDBC for bulk updates.' },
    { trap: 'Catching OutOfMemoryError and carrying on', why: 'After an OOM, some thread may have died halfway through an update. A lock may never be released, a cache half-filled. The JVM is in an unknown state.', fix: 'Don’t catch it, except to log and exit. Use <code>-XX:+ExitOnOutOfMemoryError</code> so the orchestrator restarts a clean instance.' },
    { trap: 'Heap dumps that are lost or leak secrets', why: 'In a container, the default dump path is the working directory. It vanishes on restart and may be too small. Dumps also hold passwords, tokens and personal data as plain strings.', fix: 'Point <code>HeapDumpPath</code> at a mounted volume with enough space. Restrict access. Delete dumps after analysis.' },
    { trap: 'Mistaking “high heap usage” for a leak', why: 'The JVM fills the heap before collecting. Old-gen use near the max can be normal. Restarting on high usage only hides real problems.', fix: 'Judge by the after-GC trend (<code>jvm.gc.live.data.size</code>, or the “after” value in GC logs) and by GC time. Not by used heap.' }
  ],
  scenarios: [
    { title: 'Monthly invoice batch dies at 70% with Java heap space',
      symptom: 'A Spring Boot batch re-prices 3 million line items. It fails after 40 minutes with <code>OutOfMemoryError: Java heap space</code>. Smaller months succeed.',
      diagnose: `# MAT dominator tree of the OOM dump
# org.hibernate.engine.internal.StatefulPersistenceContext   retained 5.6 GB (91%)
#   └ entitiesByKey: HashMap with 2,100,000 entries`,
      cause: 'The whole job ran in one <code>@Transactional</code> method. Hibernate kept every loaded entity and its snapshot in the persistence context.',
      fix: 'Work in chunks, with a fresh persistence context for each.',
      fixCode: `@Transactional
public void repriceChunk(List<Long> ids) {
    for (Long id : ids) repo.findById(id).ifPresent(li -> li.setPrice(calc(li)));
}   // caller loops over id chunks of 1,000; each chunk = its own transaction

// or inside one long transaction:
if (++n % 1_000 == 0) { em.flush(); em.clear(); }` },
    { title: 'Heap floor rises 300 MB a day after adding a metric',
      symptom: 'Since a release, heap use after GC climbs steadily. The service needs a restart every three days. GC CPU grows too.',
      diagnose: `jcmd <pid> GC.class_histogram | head -8
#   1: 3,412,880  …  io.micrometer.core.instrument.ImmutableTag
#   2:   853,220  …  io.micrometer.core.instrument.Meter$Id
# → a meter per distinct tag value`,
      cause: 'A new counter was tagged with <code>orderId</code>. Each new tag value creates a meter that the registry keeps forever. The number of meters has no bound.',
      fix: 'Tag only values with few options (status, route, region). Put ids in logs or traces. Add a meter filter as a safety net.',
      fixCode: `registry.counter("orders.placed", "channel", order.channel()).increment();   // bounded values

@Bean MeterFilter cardinalityGuard() {
    return MeterFilter.maximumAllowableTags("orders.placed", "channel", 20, MeterFilter.deny());
}` },
    { title: '“OutOfMemoryError: unable to create native thread” with a half-empty heap',
      symptom: 'After a few hours, requests fail with <code>unable to create native thread</code>. Heap use is 40%.',
      diagnose: `jcmd <pid> Thread.print | grep -c '^"pool-'
# 9,412
jcmd <pid> Thread.print | grep '^"pool-' | head -3
# "pool-4711-thread-1" … WAITING (parking)`,
      cause: 'A helper created <code>Executors.newFixedThreadPool(4)</code> on every call and never shut it down. Idle pool threads never exit. Threads piled up until the pod’s limit ran out.',
      fix: 'Create one shared executor as a bean and shut it down with the app. Or use try-with-resources on an <code>ExecutorService</code> (Java 19+).',
      fixCode: `@Bean(destroyMethod = "shutdown")
ExecutorService enrichPool() { return Executors.newFixedThreadPool(4); }

// or, for a one-off fan-out (Java 21): close() waits for tasks, then shuts down
try (var ex = Executors.newVirtualThreadPerTaskExecutor()) {
    ids.forEach(id -> ex.submit(() -> enrich(id)));
}` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `import java.util.concurrent.*;

public class Main {
    static final ThreadLocal<String> USER = new ThreadLocal<>();

    public static void main(String[] a) throws Exception {
        ExecutorService pool = Executors.newSingleThreadExecutor();
        pool.submit(() -> USER.set("alice")).get();          // "request" 1
        String seen = pool.submit(() -> USER.get()).get();   // "request" 2
        pool.shutdown();
        System.out.println(seen);
    }
}`, options: ['null', 'alice', 'It depends on GC timing', 'IllegalStateException'], answer: 1, run: true, expect: 'alice', explain: 'Both tasks run on the same pool thread, and nobody called <code>remove()</code>. So the second “request” sees <b>alice</b>. In a web server that leaks memory and leaks data between users. Always clear ThreadLocals in <code>finally</code>.' },
    { kind: 'predict', q: 'Run with a default heap. What does this print?', code: `public class Main {
    public static void main(String[] a) {
        try {
            long[] big = new long[Integer.MAX_VALUE];
            System.out.println(big.length);
        } catch (OutOfMemoryError e) {
            System.out.println(e.getMessage());
        }
    }
}`, options: ['2147483647', 'Java heap space', 'Requested array size exceeds VM limit', 'NegativeArraySizeException'], answer: 2, run: true, expect: 'Requested array size exceeds VM limit', explain: 'HotSpot’s maximum array length is a bit below <code>Integer.MAX_VALUE</code>, to leave room for the header. So this fails before the heap is checked, whatever <code>-Xmx</code> is. Here the stack trace does point at the real culprit, usually a size from bad input.' },
    { kind: 'concept', q: 'A pod restarts with <code>Reason: OOMKilled, Exit Code: 137</code>. The logs contain no OutOfMemoryError. What happened?', options: ['The JVM threw OOM but logging failed', 'The kernel killed the process because the container exceeded its memory limit', 'Kubernetes evicted the pod for low disk', 'The JVM exited normally with code 137'], answer: 1, explain: 'The container passed its memory limit. The kernel sent SIGKILL (128 + 9 = 137). The JVM can’t throw, dump or run shutdown hooks. Usually nobody budgeted for non-heap memory. Lower <code>MaxRAMPercentage</code>, cap native areas, check NMT.' },
    { kind: 'concept', q: 'In MAT, an object has shallow size 16 B and retained size 1.4 GB. What does that tell you?', options: ['MAT miscounted', 'The object itself is tiny, but 1.4 GB would be freed if it became unreachable', '1.4 GB of objects point to it', 'It was allocated 1.4 GB ago'], answer: 1, explain: '<b>Retained</b> size is everything that object alone keeps alive. A tiny holder on top of 1.4 GB is the classic leak sign. Then use “Path to GC Roots” to see why the holder is alive.' },
    { kind: 'concept', q: 'ThreadLocalMap entries use a <b>weak</b> reference to the ThreadLocal key. Why can values still leak?', options: ['Weak references are ignored on pooled threads', 'Only the key is weak; the value is strongly held by the thread’s map until the entry is removed or overwritten', 'The GC never processes weak references', 'They can’t; ThreadLocals never leak'], answer: 1, explain: 'If the ThreadLocal itself is collected, its entry goes stale. But the <b>value</b> stays reachable from the live thread until a later lookup cleans it. With a static ThreadLocal (the usual case), the key never goes away. The value lives as long as the thread, which in a pool is forever. Call <code>remove()</code>.' },
    { kind: 'concept', q: 'Heap usage graphs for a service show used heap between 60% and 95% all day. GC logs show after-GC usage flat at ~35%. Is it leaking?', options: ['Yes: 95% is dangerous', 'No: the live set is stable; the saw-tooth is normal', 'Only if it reaches 100%', 'Yes, because old gen is nearly full'], answer: 1, explain: 'Used heap includes garbage not yet collected. The value <b>after GC</b> shows the live data, and it is flat. Nothing piles up. A leak shows as a rising floor. Alert on live data size and GC time, not raw heap used.' },
    { kind: 'concept', q: 'You need a heap dump from a production JVM that is still running. Which is the safest first step?', options: ['kill -9 the process and look for a core file', 'Take the instance out of the load balancer, then <code>jcmd &lt;pid&gt; GC.heap_dump /volume/x.hprof</code>', 'Add <code>-Xmx</code> and restart', 'Call System.gc() and check memory'], answer: 1, explain: '<code>GC.heap_dump</code> pauses the JVM for a full GC and the write. A big heap can take tens of seconds, so drain traffic first. Write to a volume with room for about the heap size. Without the <code>live</code> option, unreachable objects are included too.' }
  ],
  interview: [
    { q: 'What is a memory leak in a garbage-collected language?', a: '<p>Objects you no longer need that are still <b>reachable</b> from a GC root, so the GC must keep them. Common holders: unbounded static caches, ThreadLocals on pool threads, listeners never removed, big HTTP sessions, long persistence contexts, class loaders pinned after redeploys. You see a rising after-GC floor, more frequent GCs, and finally OOM.</p>', lvl: 'core' },
    { q: 'Walk me through diagnosing a heap leak in production.', a: '<ol><li>Confirm: usage after GC (or <code>jvm.gc.live.data.size</code>) and GC time rise over time.</li><li>Capture: the dump from <code>HeapDumpOnOutOfMemoryError</code>, or <code>jcmd GC.heap_dump</code> after draining traffic. Two dumps some time apart are ideal.</li><li>Analyze in MAT: Leak Suspects, Dominator Tree by retained size, Histogram, dump comparison.</li><li>Explain: follow Path to GC Roots for the big holder. Inspect a few instances to find the bug (e.g. unique keys).</li><li>Fix, then check the floor stays flat under load.</li></ol>', lvl: 'core' },
    { q: 'Name the kinds of OutOfMemoryError and what each points to.', a: '<ul><li><b>Java heap space</b> / <b>GC overhead limit exceeded</b>: live data too big for the heap (leak or small heap).</li><li><b>Metaspace</b> / <b>Compressed class space</b>: too many classes, or a class-loader leak.</li><li><b>Cannot reserve … direct buffer memory</b>: NIO buffers hit <code>MaxDirectMemorySize</code>.</li><li><b>unable to create native thread</b>: OS thread limits or no memory for stacks.</li><li><b>Requested array size exceeds VM limit</b>: an absurd array size.</li><li>No error but exit 137: the kernel enforced the container limit.</li></ul>', lvl: 'core' },
    { q: 'Shallow vs retained size, and what is a dominator?', a: '<p>Shallow size is the object’s own memory. Retained size is what would be freed without it: the object plus everything reachable <i>only</i> through it. A dominates B if every path from the roots to B goes through A. The dominator tree, sorted by retained size, points straight at what holds the memory.</p>', lvl: 'deep' },
    { q: 'Why do ThreadLocals leak, and how do you use them safely?', a: '<p>Each thread has a <code>ThreadLocalMap</code>. Its keys are weak, but its values are strong. Pool threads live forever, so a value never removed lives forever. It also leaks to the next task on that thread. Call <code>set</code> in a try and <code>remove()</code> in finally (a filter or interceptor). Avoid large values. With virtual threads, prefer <code>ScopedValue</code>.</p>', lvl: 'core' },
    { q: 'How do container memory limits interact with the JVM?', a: '<p>The kernel applies the limit to the whole process: heap, metaspace, code cache, stacks, direct buffers, GC data and native libraries. Going over means SIGKILL, with no Java error. The JVM (JDK 10+, 8u191+) reads the limit and sets the default heap to 25% (<code>MaxRAMPercentage</code>). Services usually use 50–75%, cap direct memory and metaspace, and check with NMT.</p>', lvl: 'core' },
    { q: 'How do you get a heap dump, and what are the costs?', a: '<ul><li>Automatically: <code>-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=…</code>.</li><li>On demand: <code>jcmd &lt;pid&gt; GC.heap_dump file</code> (live objects, full GC first), <code>jmap -dump:live,format=b,file=…</code>, or the Actuator <code>/actuator/heapdump</code> endpoint (secure it!).</li></ul><p>Costs: the app pauses for the whole write, the file is about heap-sized, and it holds sensitive data.</p>', lvl: 'core' },
    { q: 'Besides heap dumps, what tools help with memory problems?', a: '<ul><li>GC logs and Micrometer metrics for trends.</li><li><code>jcmd GC.class_histogram</code> for a quick count by class (forces a full GC).</li><li>JFR’s <b>Old Object Sample</b> event samples long-lived objects with where they were allocated. Cheap enough for production.</li><li>async-profiler in allocation mode shows who allocates.</li><li>NMT (<code>VM.native_memory</code>) for non-heap growth. <code>VM.classloader_stats</code> and <code>VM.metaspace</code> for class leaks.</li></ul>', lvl: 'deep' },
    { q: 'What do WeakHashMap and weak references help with, and where do they fail?', a: '<p>WeakHashMap drops an entry once nothing else holds its key. That’s good for extra data on objects you don’t own. It fails when the value points back to the key, since the entry keeps itself alive. It fails with interned strings or small boxed keys, which are never collected. It fails when you need a size bound: use Caffeine with <code>weakKeys()</code> or <code>maximumSize</code>. Weak references can’t fix strong references elsewhere.</p>', lvl: 'deep' },
    { q: 'Should a service catch OutOfMemoryError?', a: '<p>Usually no. The error can hit any thread at any allocation. Locks, caches and invariants are left half-done. Log, dump and exit (<code>-XX:+ExitOnOutOfMemoryError</code>), and let the orchestrator restart. The rare exception is one isolated big allocation with a fallback, like loading a huge image. Even then, checking the size first is better.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'OOM-ready JVM flags', lang: 'bash', code: `JAVA_TOOL_OPTIONS="\\
  -XX:MaxRAMPercentage=60 \\
  -XX:MaxMetaspaceSize=256m -XX:MaxDirectMemorySize=256m \\
  -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/dumps \\
  -XX:+ExitOnOutOfMemoryError \\
  -XX:StartFlightRecording=disk=true,maxage=6h,settings=default,dumponexit=true,filename=/dumps/app.jfr"

# on demand (drain traffic first)
jcmd <pid> GC.heap_dump /dumps/$(date +%s).hprof
jcmd <pid> JFR.dump name=1 filename=/dumps/now.jfr   # includes Old Object Sample events`, note: '<code>/dumps</code> should be a mounted volume with room for a heap-sized file. Treat dumps as sensitive data.' },
    { title: 'ThreadLocal hygiene in a servlet filter', lang: 'java', code: `@Component
class TenantFilter extends OncePerRequestFilter {
    static final ThreadLocal<String> TENANT = new ThreadLocal<>();

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        TENANT.set(req.getHeader("X-Tenant"));
        try {
            chain.doFilter(req, res);
        } finally {
            TENANT.remove();          // never skip this on a pooled thread
        }
    }
}`, note: 'Async work (<code>@Async</code>, CompletableFuture) runs on other threads and won’t see the value. Pass it explicitly, or use a TaskDecorator that copies and clears it.' },
    { title: 'A cache that can’t leak', lang: 'java', code: `@Bean
Cache<String, Quote> quoteCache(MeterRegistry registry) {
    Cache<String, Quote> c = Caffeine.newBuilder()
        .maximumSize(50_000)                       // hard bound
        .expireAfterWrite(Duration.ofMinutes(10))  // stale data goes away
        .recordStats()
        .build();
    CaffeineCacheMetrics.monitor(registry, c, "quotes");   // size, hits, evictions
    return c;
}`, note: 'If evictions are high and the hit rate low, the key is probably more unique than you think.' }
  ]
});

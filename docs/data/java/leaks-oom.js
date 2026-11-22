IA.register({
  track: 'java',
  slug: 'leaks-oom',
  title: 'Memory leaks & OOM',
  tagline: 'A Java memory leak is memory that is <b>still reachable but no longer needed</b>. The GC can’t help, so the after-GC floor rises until an <code>OutOfMemoryError</code> (or the kernel) ends it. The message names the area that ran out; a heap dump names the culprit.',
  tldr: {
    problem: 'Services that slow down over days and then fall over, pods that restart with exit code 137, batch jobs that die at 80%. The OOM stack trace usually points at an innocent thread that just happened to allocate last.',
    model: 'Read the OOM <b>message</b> to find the area (heap, metaspace, direct, native threads, or no message at all for a container kill). For heap leaks, watch <b>after-GC usage</b> over time, take a <b>heap dump</b>, and follow the <b>dominator tree</b> and path to GC roots to the reference that should not exist. Typical roots: static collections, ThreadLocals on pooled threads, listeners, sessions, persistence contexts.',
    hook: '“How do you find a memory leak in production?” Confirm it with the after-GC trend, capture a heap dump (on OOM, or two dumps an hour apart), open it in MAT, sort the dominator tree by retained size, and read the path to GC roots.',
    facts: [
      { v: '137', l: 'exit code of a process killed by SIGKILL (128 + 9): what a Kubernetes OOMKilled JVM shows. No Java error and no heap dump' },
      { v: '≈ heap size', l: 'a heap dump file is roughly the size of the live heap and contains every string in memory, including tokens and personal data: store and share it accordingly' },
      { v: '7+', l: 'distinct OOM messages: Java heap space, GC overhead limit exceeded, Metaspace, Compressed class space, direct buffer memory, unable to create native thread, requested array size exceeds VM limit' }
    ]
  },
  intro: {
    what: 'Java frees memory automatically, but only for objects nothing refers to any more. If your code keeps a reference by accident (an object added to a list that is never cleared, say), that object can never be freed. Do that on every request and memory grows until the JVM runs out: an <b>OutOfMemoryError</b>.',
    analogy: { icon: '🧳', title: 'A cloakroom that never returns coats', text: 'Guests hand in coats and get a ticket. If the cloakroom never throws away tickets of guests who left, the coats stay forever, the room fills up and eventually nobody new can check in. Nothing is broken about the hangers (the GC); the bookkeeping is wrong.' },
    steps: [
      { t: 'Leak = still referenced', d: 'The GC keeps everything reachable. A leak is a reference you forgot about, often in a static field or a long-lived object.', code: 'static final List<Order> RECENT = new ArrayList<>();\nvoid handle(Order o) { RECENT.add(o); }   // grows forever' },
      { t: 'Look at the floor, not the peak', d: 'Heap usage always rises and falls. If the lowest point after each GC keeps rising over hours, something is leaking.' },
      { t: 'Capture evidence automatically', d: 'Ask the JVM to write a heap dump when it runs out of memory.', code: 'java -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/dumps -jar app.jar' },
      { t: 'Analyse the dump', d: 'Open the <code>.hprof</code> file in Eclipse MAT (or IntelliJ). Look for the object that retains the most memory and follow who refers to it.' }
    ],
    terms: [
      ['heap dump', 'A snapshot of every object in the heap and the references between them (<code>.hprof</code>).'],
      ['shallow size', 'Memory used by one object itself.'],
      ['retained size', 'Memory that would be freed if that object became unreachable: itself plus everything only it keeps alive.'],
      ['dominator tree', 'A tree where each object’s parent is the object that every path to it goes through; sorted by retained size, it shows what holds the memory.'],
      ['GC root', 'Where reachability starts: thread stacks, static fields, JNI references, running threads.'],
      ['OOMKilled', 'The container runtime killed the process for exceeding its memory limit.']
    ]
  },
  visual: {
    title: 'From the first symptom to the guilty reference',
    caption: 'Pick a scenario and press Play. <b>a leak over time</b> shows the rising after-GC floor. <b>leak patterns</b> draws the three classic reference chains. <b>heap dump in MAT</b> walks a dominator tree. <b>OOM kinds</b> and <b>container limits</b> cover every way a JVM runs out.'
  },
  gotchas: [
    { trap: 'Caches without a bound, or with accidental unique keys', code: `private static final Map<String, Report> CACHE = new ConcurrentHashMap<>();
CACHE.computeIfAbsent(userId + ":" + Instant.now(), k -> build());   // a new key every call`, why: 'A static map is reachable forever. Without a size limit or expiry it only grows, and a key with a timestamp, a request id or a mutable object makes every entry unique.', fix: 'Use a bounded cache (Caffeine <code>maximumSize</code>, <code>expireAfterWrite</code>), and expose its size and evictions as metrics.' },
    { trap: 'ThreadLocal on pooled threads without <code>remove()</code>', code: `static final ThreadLocal<UserContext> CTX = new ThreadLocal<>();
CTX.set(ctx);       // in a filter
// … no finally { CTX.remove(); }`, why: 'Request threads are reused for the life of the JVM, so values stay in each thread’s map, and the next request on that thread can see the previous user’s context: a memory leak and a data leak.', fix: 'Always <code>remove()</code> in a <code>finally</code> block. Prefer request-scoped beans, or <code>ScopedValue</code> (preview in Java 21) with virtual threads.' },
    { trap: 'Listeners and callbacks that are never unregistered', why: 'A long-lived publisher (an event bus, a singleton service, a static registry) holds strong references to every subscriber. Lambdas and inner classes also capture their enclosing object.', fix: 'Return a handle that unregisters (<code>AutoCloseable</code>), unregister in <code>@PreDestroy</code>, or let a framework manage the lifecycle (Spring <code>@EventListener</code> on beans).' },
    { trap: 'One giant persistence context in a batch job', code: `@Transactional
void reprice() {
    for (Product p : repo.findAll()) p.setPrice(calc(p));   // 2M managed entities in one session
}`, why: 'JPA keeps every loaded entity (plus a snapshot for dirty checking) in the persistence context until the transaction ends. A big batch keeps millions of objects reachable.', fix: 'Process in chunks: page through, <code>flush()</code> and <code>clear()</code> every N rows, or use Spring Batch, a stream with <code>clear()</code>, or plain JDBC for bulk updates.' },
    { trap: 'Catching OutOfMemoryError and carrying on', why: 'After an OOM some thread may have died halfway through updating shared state (a lock never released, a half-filled cache). The JVM is in an unknown state.', fix: 'Don’t catch it, except to log and exit. Use <code>-XX:+ExitOnOutOfMemoryError</code> (or <code>CrashOnOutOfMemoryError</code>) so the orchestrator restarts a clean instance.' },
    { trap: 'Heap dumps that are lost or leak secrets', why: 'Inside a container, the default dump path is the working directory, which disappears on restart, and may be too small for a multi-GB file. Dumps also contain passwords, tokens and personal data in plain strings.', fix: 'Point <code>HeapDumpPath</code> at a mounted volume with enough space, restrict access, and delete dumps after analysis.' },
    { trap: 'Mistaking “high heap usage” for a leak', why: 'The JVM happily fills the heap before collecting; old-gen usage near the max can be normal. Restarting on high usage just hides real problems.', fix: 'Judge by the after-GC trend (Micrometer <code>jvm.gc.live.data.size</code>, or the “after” value in GC logs) and by GC time, not by used heap.' }
  ],
  scenarios: [
    { title: 'Monthly invoice batch dies at 70% with Java heap space',
      symptom: 'A Spring Boot batch that re-prices 3 million line items fails after 40 minutes with <code>OutOfMemoryError: Java heap space</code>. Smaller months succeed.',
      diagnose: `# MAT dominator tree of the OOM dump
# org.hibernate.engine.internal.StatefulPersistenceContext   retained 5.6 GB (91%)
#   └ entitiesByKey: HashMap with 2,100,000 entries`,
      cause: 'The whole job ran in one <code>@Transactional</code> method, so Hibernate kept every loaded entity and its dirty-checking snapshot in the persistence context.',
      fix: 'Work in chunks with a fresh persistence context per chunk.',
      fixCode: `@Transactional
public void repriceChunk(List<Long> ids) {
    for (Long id : ids) repo.findById(id).ifPresent(li -> li.setPrice(calc(li)));
}   // caller loops over id chunks of 1,000; each chunk = its own transaction

// or inside one long transaction:
if (++n % 1_000 == 0) { em.flush(); em.clear(); }` },
    { title: 'Heap floor rises 300 MB a day after adding a metric',
      symptom: 'Since a release, after-GC heap usage climbs steadily and the service needs a restart every three days. CPU in GC grows over the same period.',
      diagnose: `jcmd <pid> GC.class_histogram | head -8
#   1: 3,412,880  …  io.micrometer.core.instrument.ImmutableTag
#   2:   853,220  …  io.micrometer.core.instrument.Meter$Id
# → a meter per distinct tag value`,
      cause: 'A new counter was tagged with <code>orderId</code>. Every distinct tag value creates a new meter that the registry keeps forever: an unbounded-cardinality leak.',
      fix: 'Tag only low-cardinality values (status, route template, region). Put ids in logs or traces instead, and add a meter filter as a safety net.',
      fixCode: `registry.counter("orders.placed", "channel", order.channel()).increment();   // bounded values

@Bean MeterFilter cardinalityGuard() {
    return MeterFilter.maximumAllowableTags("orders.placed", "channel", 20, MeterFilter.deny());
}` },
    { title: '“OutOfMemoryError: unable to create native thread” with a half-empty heap',
      symptom: 'After a few hours of traffic, requests start failing with <code>unable to create native thread</code>. Heap usage is 40%.',
      diagnose: `jcmd <pid> Thread.print | grep -c '^"pool-'
# 9,412
jcmd <pid> Thread.print | grep '^"pool-' | head -3
# "pool-4711-thread-1" … WAITING (parking)`,
      cause: 'A helper created <code>Executors.newFixedThreadPool(4)</code> on every call and never shut it down. Idle pool threads never exit, so threads accumulated until the pod’s pids limit (or memory for their stacks) ran out.',
      fix: 'Create one shared executor as a bean and shut it down with the application context, or use try-with-resources on an <code>ExecutorService</code> (Java 19+).',
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
}`, options: ['null', 'alice', 'It depends on GC timing', 'IllegalStateException'], answer: 1, run: true, expect: 'alice', explain: 'Both tasks run on the same pooled thread, and nobody called <code>remove()</code>, so the second “request” sees <b>alice</b>. In a web server that is both a memory leak (values pile up per thread) and a data leak between users. Always clear ThreadLocals in <code>finally</code>.' },
    { kind: 'predict', q: 'Run with a default heap. What does this print?', code: `public class Main {
    public static void main(String[] a) {
        try {
            long[] big = new long[Integer.MAX_VALUE];
            System.out.println(big.length);
        } catch (OutOfMemoryError e) {
            System.out.println(e.getMessage());
        }
    }
}`, options: ['2147483647', 'Java heap space', 'Requested array size exceeds VM limit', 'NegativeArraySizeException'], answer: 2, run: true, expect: 'Requested array size exceeds VM limit', explain: 'HotSpot’s maximum array length is slightly below <code>Integer.MAX_VALUE</code> (room is needed for the header), so this request fails before the heap is even checked, whatever <code>-Xmx</code> is. It is one of the few OOMs where the stack trace points at the real culprit, typically a size computed from bad input.' },
    { kind: 'concept', q: 'A pod restarts with <code>Reason: OOMKilled, Exit Code: 137</code>. The logs contain no OutOfMemoryError. What happened?', options: ['The JVM threw OOM but logging failed', 'The kernel killed the process because the container exceeded its memory limit', 'Kubernetes evicted the pod for low disk', 'The JVM exited normally with code 137'], answer: 1, explain: 'The cgroup memory limit was exceeded and the kernel’s OOM killer sent SIGKILL (128 + 9 = 137). The JVM gets no chance to throw, dump or run shutdown hooks. Usually non-heap memory was not budgeted: lower <code>MaxRAMPercentage</code>, cap native areas, check NMT.' },
    { kind: 'concept', q: 'In MAT, an object has shallow size 16 B and retained size 1.4 GB. What does that tell you?', options: ['MAT miscounted', 'The object itself is tiny, but 1.4 GB would be freed if it became unreachable', '1.4 GB of objects point to it', 'It was allocated 1.4 GB ago'], answer: 1, explain: '<b>Retained</b> size is everything that object exclusively keeps alive (it dominates it). A 16-byte static holder or a small cache object at the top of a 1.4 GB retained subtree is the classic leak signature. Then use “Path to GC Roots” to see why the holder itself is alive.' },
    { kind: 'concept', q: 'ThreadLocalMap entries use a <b>weak</b> reference to the ThreadLocal key. Why can values still leak?', options: ['Weak references are ignored on pooled threads', 'Only the key is weak; the value is strongly held by the thread’s map until the entry is removed or overwritten', 'The GC never processes weak references', 'They can’t; ThreadLocals never leak'], answer: 1, explain: 'If the ThreadLocal object is collected, its entry becomes stale but the <b>value</b> stays strongly reachable from the live thread until a later lookup happens to clean it up. With a static ThreadLocal (the usual case) the key never goes away, so the value lives as long as the thread: forever, in a pool. Call <code>remove()</code>.' },
    { kind: 'concept', q: 'Heap usage graphs for a service show used heap between 60% and 95% all day. GC logs show after-GC usage flat at ~35%. Is it leaking?', options: ['Yes: 95% is dangerous', 'No: the live set is stable; the saw-tooth is normal', 'Only if it reaches 100%', 'Yes, because old gen is nearly full'], answer: 1, explain: 'Used heap includes garbage not yet collected. The <b>after-GC</b> value approximates the live set, and it is flat, so nothing accumulates. A leak shows as a rising floor. Alert on live data size and GC time, not on raw heap used.' },
    { kind: 'concept', q: 'You need a heap dump from a production JVM that is still running. Which is the safest first step?', options: ['kill -9 the process and look for a core file', 'Take the instance out of the load balancer, then <code>jcmd &lt;pid&gt; GC.heap_dump /volume/x.hprof</code>', 'Add <code>-Xmx</code> and restart', 'Call System.gc() and check memory'], answer: 1, explain: '<code>GC.heap_dump</code> (or <code>jmap -dump:live,…</code>) pauses the JVM for a full GC and while writing, which can take tens of seconds for a big heap, so drain traffic first. Write to a volume with space for roughly the heap size. Without the <code>live</code> option (or with <code>-all</code> in jcmd), unreachable objects are included too.' }
  ],
  interview: [
    { q: 'What is a memory leak in a garbage-collected language?', a: '<p>Objects that are no longer needed but are still <b>reachable</b> from a GC root, so the collector must keep them. Typical holders: static collections and caches without bounds, ThreadLocals on pooled threads, listeners never unregistered, HTTP sessions holding big graphs, long persistence contexts, class loaders pinned after redeploys. The symptom is a rising after-GC floor, more frequent GCs, and eventually OOM.</p>', lvl: 'core' },
    { q: 'Walk me through diagnosing a heap leak in production.', a: '<ol><li>Confirm: after-GC usage or <code>jvm.gc.live.data.size</code> rising over time; GC time rising.</li><li>Capture: the dump from <code>HeapDumpOnOutOfMemoryError</code>, or <code>jcmd GC.heap_dump</code> (drain traffic first); ideally two dumps some time apart.</li><li>Analyse in MAT: Leak Suspects, Dominator Tree by retained size, Histogram, compare dumps.</li><li>Explain: Path to GC Roots (excluding weak/soft) for the big retainer; inspect a few instances to find the bug (e.g. unique keys).</li><li>Fix, then verify the floor stays flat under load.</li></ol>', lvl: 'core' },
    { q: 'Name the kinds of OutOfMemoryError and what each points to.', a: '<ul><li><b>Java heap space</b> / <b>GC overhead limit exceeded</b>: live set too big for the heap (leak or undersized).</li><li><b>Metaspace</b> / <b>Compressed class space</b>: too many classes or a class-loader leak.</li><li><b>Cannot reserve … direct buffer memory</b>: off-heap NIO buffers at <code>MaxDirectMemorySize</code>.</li><li><b>unable to create native thread</b>: OS thread limits or memory for stacks.</li><li><b>Requested array size exceeds VM limit</b>: an absurd array size.</li><li>No error but exit 137: the container limit, enforced by the kernel.</li></ul>', lvl: 'core' },
    { q: 'Shallow vs retained size, and what is a dominator?', a: '<p>Shallow size is the object’s own memory. Retained size is what would be freed if it were removed: the object plus everything reachable <i>only</i> through it. Object A dominates B if every path from the roots to B goes through A. The dominator tree, sorted by retained size, points straight at the objects responsible for most memory.</p>', lvl: 'deep' },
    { q: 'Why do ThreadLocals leak, and how do you use them safely?', a: '<p>Each thread has a <code>ThreadLocalMap</code>; entries have a weak key (the ThreadLocal) but a strong value. With pooled threads that live forever, a value that is never removed lives forever, and leaks to the next task on that thread. Use <code>set</code> in a try and <code>remove()</code> in finally (a servlet filter or interceptor), avoid large values, and in app servers never store objects of webapp classes on container threads. With virtual threads, prefer <code>ScopedValue</code>.</p>', lvl: 'core' },
    { q: 'How do container memory limits interact with the JVM?', a: '<p>The kernel enforces the cgroup limit on the whole process RSS: heap plus metaspace, code cache, thread stacks, direct buffers, GC structures and native libraries. Exceeding it means SIGKILL, with no Java-level error. The JVM (JDK 10+, and 8u191+) reads the limit and sizes the default heap at 25% (<code>MaxRAMPercentage</code>). Typical service setting: 50–75%, plus caps on direct memory and metaspace, and verification with NMT.</p>', lvl: 'core' },
    { q: 'How do you get a heap dump, and what are the costs?', a: '<ul><li>Automatically: <code>-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=…</code>.</li><li>On demand: <code>jcmd &lt;pid&gt; GC.heap_dump file</code> (live objects; full GC first), <code>jmap -dump:live,format=b,file=…</code>, or the Actuator <code>/actuator/heapdump</code> endpoint (secure it!).</li></ul><p>Costs: a stop-the-world pause for the whole write, disk space about the size of the heap, and sensitive data in the file.</p>', lvl: 'core' },
    { q: 'Besides heap dumps, what tools help with memory problems?', a: '<ul><li>GC logs and Micrometer metrics for trends.</li><li><code>jcmd GC.class_histogram</code> for a quick count by class (forces a full GC).</li><li>JFR with the <b>Old Object Sample</b> event: samples long-lived objects with their allocation stack traces, cheap enough for production.</li><li>async-profiler in allocation mode for who allocates.</li><li>NMT (<code>VM.native_memory</code>) for non-heap growth; <code>VM.classloader_stats</code> and <code>VM.metaspace</code> for class leaks.</li></ul>', lvl: 'deep' },
    { q: 'What do WeakHashMap and weak references help with, and where do they fail?', a: '<p>WeakHashMap drops an entry once its key is only weakly reachable: good for metadata attached to objects you don’t own. It fails when the value references the key (the entry keeps itself alive), when keys are interned strings or boxed small values (never collected), or when you really need a size bound (use Caffeine with <code>weakKeys()</code> or <code>maximumSize</code>). Weak references don’t fix a design that holds strong references elsewhere.</p>', lvl: 'deep' },
    { q: 'Should a service catch OutOfMemoryError?', a: '<p>Generally no. The error can strike any thread at any allocation, leaving locks, caches and invariants half-updated. Log, dump and exit (<code>-XX:+ExitOnOutOfMemoryError</code>) and let the orchestrator restart. The rare exception is a deliberate, isolated big allocation where you can fall back (e.g. trying to load a huge image), and even then a size check up front is better.</p>', lvl: 'core' }
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
jcmd <pid> JFR.dump name=1 filename=/dumps/now.jfr   # includes Old Object Sample events`, note: '<code>/dumps</code> should be a mounted volume with room for at least one heap-sized file. Treat dumps as sensitive data.' },
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
}`, note: 'Async work (<code>@Async</code>, CompletableFuture) runs on other threads and won’t see the value; pass it explicitly or use a TaskDecorator that copies and clears it.' },
    { title: 'A cache that can’t leak', lang: 'java', code: `@Bean
Cache<String, Quote> quoteCache(MeterRegistry registry) {
    Cache<String, Quote> c = Caffeine.newBuilder()
        .maximumSize(50_000)                       // hard bound
        .expireAfterWrite(Duration.ofMinutes(10))  // stale data goes away
        .recordStats()
        .build();
    CaffeineCacheMetrics.monitor(registry, c, "quotes");   // size, hits, evictions
    return c;
}`, note: 'If the eviction count is high and the hit rate low, the key is probably more unique than you think.' }
  ]
});

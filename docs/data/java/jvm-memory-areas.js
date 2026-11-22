IA.register({
  track: 'java',
  slug: 'jvm-memory-areas',
  title: 'JVM memory areas',
  tagline: 'A JVM process is much more than <code>-Xmx</code>. The <b>heap</b> holds objects in generations, every thread has a <b>stack</b> of frames, class metadata lives in <b>metaspace</b>, JIT output in the <b>code cache</b>, and NIO uses <b>direct memory</b>. All of it counts against your container limit.',
  tldr: {
    problem: 'Pods get OOM-killed with the heap half empty, a heap increase from 30 to 40 GB makes things worse, and a list of a million <code>Long</code>s eats 28 MB. All of these come from not knowing where memory really goes.',
    model: '<b>Heap</b> (shared, GC-managed: young = eden + survivors, old) · <b>thread stacks</b> (one per platform thread, frames with locals and references) · <b>metaspace</b> (class metadata, native) · <b>code cache</b> (JIT code) · <b>direct buffers</b> (off-heap NIO) · GC structures, symbols, malloc. Every object pays a 12-byte header and 8-byte alignment.',
    hook: '“The container limit is 2 GiB and <code>-Xmx</code> is 2 GiB. What happens?” The kernel OOM-kills the process (exit code 137), with no Java error, because non-heap memory has nowhere to go.',
    facts: [
      { v: '12 + 4', l: 'bytes of header + padding: <code>new Object()</code> is 16 bytes on 64-bit HotSpot with compressed class pointers (JDK 21 default)' },
      { v: '~32 GB', l: 'the heap size where compressed oops (4-byte references) stop working: 2³² offsets × 8-byte alignment. Above it, references are 8 bytes' },
      { v: '25%', l: 'default <code>MaxRAMPercentage</code>: without <code>-Xmx</code>, a container-aware JVM (JDK 10+) takes a quarter of the container limit as max heap' }
    ]
  },
  intro: {
    what: 'When your program runs, the JVM sets aside several kinds of memory. Objects you create with <code>new</code> go in the <b>heap</b>, which the garbage collector cleans up. Each running method call gets a small workspace on its thread’s <b>stack</b> for local variables. The JVM also needs memory for the <b>classes themselves</b>, for <b>compiled machine code</b>, and for buffers shared with the operating system.',
    analogy: { icon: '🏢', title: 'An office building', text: 'The heap is the shared open-plan floor where all the documents (objects) sit, and a cleaner (the GC) removes the ones nobody uses. Each worker (thread) has a personal notepad (stack) for the task in hand, torn off when the task ends. The building also has a reference library (metaspace), a print room for fast copies (code cache) and a loading dock to the street (direct memory). The rent (container limit) covers the whole building, not just the open floor.' },
    steps: [
      { t: 'Objects live on the heap', d: '<code>new</code> allocates on the heap. Variables hold <b>references</b> to objects, not the objects themselves.', code: 'Order o = new Order();   // o (a reference) is on the stack; the Order is on the heap' },
      { t: 'Method calls use the stack', d: 'Each call pushes a frame with its parameters and local variables. Returning pops it. Too deep a recursion → <code>StackOverflowError</code>.' },
      { t: 'The heap has generations', d: 'New objects start in the young generation. The few that live long are moved to the old generation, which is collected less often.' },
      { t: 'There is memory outside the heap', d: 'Classes, compiled code, thread stacks and NIO buffers all use native memory, so total process memory is always more than <code>-Xmx</code>.', code: 'java -XX:NativeMemoryTracking=summary -jar app.jar\njcmd <pid> VM.native_memory summary' }
    ],
    terms: [
      ['heap', 'Shared memory for objects, managed by the garbage collector. Sized by <code>-Xms</code>/<code>-Xmx</code>.'],
      ['stack frame', 'Per-call storage for parameters, locals and intermediate values.'],
      ['metaspace', 'Native memory for class metadata. Replaced PermGen in Java 8.'],
      ['TLAB', 'Thread-local allocation buffer: a slice of eden one thread allocates into without locking.'],
      ['compressed oops', '4-byte object references (offsets) instead of 8-byte pointers, for heaps under ~32 GB.'],
      ['RSS', 'Resident set size: the physical memory a process actually uses. What the container limit is checked against.']
    ]
  },
  visual: {
    title: 'Where a JVM’s memory goes',
    caption: 'Pick an area and press Play. <b>process memory map</b> adds up a realistic container budget. <b>stack & frames</b>, <b>heap generations</b>, <b>object header</b> and <b>direct memory</b> each zoom into one area.'
  },
  gotchas: [
    { trap: 'Setting <code>-Xmx</code> equal to the container limit', why: 'Metaspace, code cache, thread stacks, direct buffers, GC structures and malloc arenas all live outside the heap. When RSS crosses the cgroup limit, the kernel kills the process with SIGKILL (exit 137): no OutOfMemoryError, no heap dump.', fix: 'Use <code>-XX:MaxRAMPercentage=50</code>–<code>75</code> instead of a fixed <code>-Xmx</code>, cap direct memory and metaspace, and measure real usage with Native Memory Tracking.' },
    { trap: 'Growing the heap past ~32 GB', why: 'Compressed oops switch off and every reference becomes 8 bytes. Reference-heavy heaps grow by 20–40%, so a 36 GB heap can hold less live data than a 31 GB one, and caches get less effective.', fix: 'Stay at or below ~31 GB, check with <code>-XX:+PrintFlagsFinal | grep UseCompressedOops</code>, or use <code>-XX:ObjectAlignmentInBytes=16</code> (compressed up to 64 GB, more padding). Often the real fix is splitting the workload.' },
    { trap: 'Boxed collections of numbers', code: `List<Long> ids = …;     // 1M ids ≈ 1M × (24 B Long + 4 B ref) ≈ 28 MB
long[] ids2 = …;        // 1M ids = 8 MB + 16 B header`, why: 'Each boxed value is a full object with a header, alignment padding and a reference to it. Values outside the small cache (−128…127 for Integer and Long) are separate objects.', fix: 'Use primitive arrays, <code>IntStream</code>/<code>LongStream</code>, or a primitive collections library (fastutil, Eclipse Collections) for large numeric data.' },
    { trap: 'Thousands of platform threads', why: 'Each thread reserves <code>-Xss</code> of stack (1 MB by default on Linux x64) plus kernel structures. 2,000 blocked request threads can commit hundreds of MB that never shows up in heap metrics.', fix: 'Bound your thread pools. For blocking I/O at high concurrency, use virtual threads (Java 21), whose stacks live on the heap while unmounted. Lower <code>-Xss</code> only with care: deep frameworks hit StackOverflowError.' },
    { trap: 'Direct memory is invisible in heap dashboards', why: 'Netty, Kafka clients, gRPC and NIO file I/O allocate off-heap. The memory is freed only when the GC collects the small <code>DirectByteBuffer</code> wrapper, which may sit in the old gen for hours.', fix: 'Set <code>-XX:MaxDirectMemorySize</code>, watch <code>jvm.buffer.memory.used</code>, and keep <code>-XX:+DisableExplicitGC</code> off (direct allocation relies on <code>System.gc()</code> under pressure).' },
    { trap: 'Metaspace is unbounded by default', why: 'A class-generation leak (proxies, scripting engines, redeploys) grows native memory until the container kills the process.', fix: 'Set <code>-XX:MaxMetaspaceSize</code> (e.g. 256m–512m) so leaks fail with a clear <code>OutOfMemoryError: Metaspace</code>, and alert on the metaspace metric. See <a href="class-loading.html">Class loading</a>.' }
  ],
  scenarios: [
    { title: 'Pod OOMKilled while the heap dashboard shows 55%',
      symptom: 'A Spring Boot service in a 2 GiB pod restarts every few hours with <code>OOMKilled</code>, exit code 137. Heap usage never exceeds 1.1 of 1.5 GB. No OutOfMemoryError in the logs.',
      diagnose: `# restart with NMT, wait for the growth, then:
jcmd 1 VM.native_memory summary
#   Java Heap (reserved=1536MB, committed=1536MB)
#   Class     (committed=168MB)
#   Thread    (committed=231MB)   ← 412 threads
#   Other     (committed=310MB)   ← direct buffers`,
      cause: '<code>-Xmx1536m</code> in a 2 GiB pod left ~500 MB for everything else. A burst of slow downstream calls grew the Tomcat pool to 400 threads, and a Kafka consumer’s direct buffers grew with it. Heap committed + native went past 2 GiB.',
      fix: 'Size the heap as a percentage, cap the other areas, and bound the thread pool.',
      fixCode: `JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60 -XX:MaxMetaspaceSize=256m \\
  -XX:MaxDirectMemorySize=192m -XX:+ExitOnOutOfMemoryError"
# application.yml
server.tomcat.threads.max: 100` },
    { title: '“More heap” made the cache hold fewer entries',
      symptom: 'An in-memory pricing cache was moved from <code>-Xmx30g</code> to <code>-Xmx40g</code> to fit more products. Afterwards it held about the same number of entries before evicting, and GC pauses grew.',
      diagnose: `java -Xmx30g -XX:+PrintFlagsFinal -version | grep UseCompressedOops   # true
java -Xmx40g -XX:+PrintFlagsFinal -version | grep UseCompressedOops   # false`,
      cause: 'Above ~32 GB, compressed oops are disabled. The cache is mostly references (map nodes, keys, small value objects), so the same data needed roughly a third more memory, eating the extra 10 GB.',
      fix: 'Go back to ≤ 31 GB, compact the data (primitive arrays, fewer small objects), or shard the cache across instances. <code>-XX:ObjectAlignmentInBytes=16</code> is an option if you must go to 32–64 GB.',
      fixCode: `-Xms31g -Xmx31g -XX:+UseG1GC   # stays in compressed-oops territory` },
    { title: 'StackOverflowError when serialising an order',
      symptom: 'GET <code>/orders/{id}</code> returns 500 with <code>HttpMessageNotWritableException: Could not write JSON: Infinite recursion (StackOverflowError)</code>.',
      cause: 'The JPA entities are bidirectional: <code>Order.lines → OrderLine.order → Order …</code>. Jackson follows the cycle until the thread’s stack (<code>-Xss</code>, 1 MB) is exhausted.',
      fix: 'Return DTOs instead of entities, or break the cycle for Jackson.',
      fixCode: `record OrderDto(long id, List<LineDto> lines) {}
record LineDto(String sku, int qty) {}

// or, on the entities:
@OneToMany(mappedBy = "order") @JsonManagedReference List<OrderLine> lines;
@ManyToOne @JsonBackReference Order order;` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    static int depth = 0;
    static void down() { depth++; down(); }

    public static void main(String[] a) {
        try {
            down();
        } catch (StackOverflowError e) {
            System.out.println("caught " + (depth > 1000));
        }
    }
}`, options: ['Nothing: the JVM crashes', 'caught true', 'caught false', 'OutOfMemoryError'], answer: 1, run: true, expect: 'caught true', explain: 'Each call pushes a small frame onto the thread’s stack (1 MB by default), so thousands of calls fit before the JVM throws <b>StackOverflowError</b>. It is an <code>Error</code>, but you can catch it: the frames unwind and the stack is usable again. Don’t rely on that in real code, since state may be half-updated.' },
    { kind: 'predict', q: 'What does this print?', code: `import java.nio.ByteBuffer;

public class Main {
    public static void main(String[] a) {
        ByteBuffer heap = ByteBuffer.allocate(16);
        ByteBuffer direct = ByteBuffer.allocateDirect(16);
        System.out.println(heap.isDirect() + " " + heap.hasArray() + " "
            + direct.isDirect() + " " + direct.hasArray());
    }
}`, options: ['false true true true', 'false true true false', 'true false false true', 'false false true false'], answer: 1, run: true, expect: 'false true true false', explain: 'A heap buffer wraps a <code>byte[]</code> on the heap (<code>hasArray()</code> true). A direct buffer points at native memory outside the heap, so there is no backing array to expose. Native I/O can use direct memory without an extra copy, which is why NIO and Netty prefer it.' },
    { kind: 'concept', q: 'On 64-bit HotSpot (JDK 21, heap < 32 GB, defaults), how big is <code>new Object()</code>?', options: ['8 bytes', '12 bytes', '16 bytes', '24 bytes'], answer: 2, explain: '8-byte mark word + 4-byte compressed class pointer = 12 bytes, padded to the 8-byte alignment: <b>16 bytes</b>. Experimental compact headers in Java 24 (JEP 450) shrink the header to 8 bytes.' },
    { kind: 'concept', q: 'Where do static fields live in HotSpot since JDK 8?', options: ['In PermGen', 'In metaspace, next to the class metadata', 'On the heap, inside the java.lang.Class object', 'On the main thread’s stack'], answer: 2, explain: 'Since JDK 8 static fields are stored in the class’s <code>java.lang.Class</code> mirror on the <b>heap</b>; metaspace holds metadata such as methods, bytecode and constant pools. The String pool moved from PermGen to the heap in JDK 7. That’s why a huge static cache shows up in heap dumps, not in metaspace.' },
    { kind: 'concept', q: 'A service holds a large map of small objects. You raise <code>-Xmx</code> from 31g to 36g. What is the most likely effect?', options: ['5 GB more usable space', 'Roughly the same or less usable space, because references grow to 8 bytes', 'Faster GC because of more headroom', 'The JVM refuses to start'], answer: 1, explain: 'Past ~32 GB, compressed oops are disabled. In a reference-heavy heap the extra 5 GB is eaten by 8-byte references, so live-data capacity can stay flat or drop. Check <code>UseCompressedOops</code> with <code>-XX:+PrintFlagsFinal</code>.' },
    { kind: 'concept', q: 'A pod has a 2 GiB memory limit and the JVM runs with <code>-Xmx2g</code>. Under load, what usually happens first?', options: ['OutOfMemoryError: Java heap space', 'The kernel OOM-kills the process (exit 137) without a Java error', 'The JVM shrinks the heap automatically', 'GC pauses grow but nothing fails'], answer: 1, explain: 'Heap plus metaspace, code cache, thread stacks, direct buffers and native allocations exceed the cgroup limit before the heap itself is full. The kernel sends SIGKILL; there is no heap dump and no stack trace. Leave headroom with <code>MaxRAMPercentage</code>.' }
  ],
  interview: [
    { q: 'What memory areas does the JVM have?', a: '<p>By the JVM spec: the <b>heap</b> (shared objects), the <b>method area</b> (per-class data; HotSpot implements it as metaspace), the <b>run-time constant pool</b> (per class), one <b>JVM stack</b> per thread (frames), <b>native method stacks</b>, and a <b>pc register</b> per thread. In practice add HotSpot’s code cache, direct buffers, GC structures and other native allocations to get the process total.</p>', lvl: 'core' },
    { q: 'Stack vs heap?', a: '<ul><li><b>Stack</b>: per thread, LIFO frames, holds primitives and references for each call, freed instantly on return, limited by <code>-Xss</code>.</li><li><b>Heap</b>: shared by all threads, holds every object and array, reclaimed by the GC, sized by <code>-Xms</code>/<code>-Xmx</code>.</li></ul><p>The JIT may still keep a non-escaping object’s fields in registers (scalar replacement), but semantically objects are on the heap.</p>', lvl: 'core' },
    { q: 'Why did Java 8 replace PermGen with metaspace?', a: '<p>PermGen was a fixed-size part of the heap for class metadata and interned strings, so apps with many classes or redeploys hit <code>OutOfMemoryError: PermGen space</code> and needed manual tuning. Metaspace stores metadata in native memory, grows on demand, and is freed per class loader when loaders are unloaded. Interned strings and statics moved onto the regular heap (JDK 7 and 8).</p>', lvl: 'core' },
    { q: 'How is the heap organised generationally, and why?', a: '<p>Most objects die young, so the heap separates a <b>young</b> generation (eden + two survivor spaces) from an <b>old</b> one. Young GCs copy the few live objects out of eden and discard the rest, so their cost is proportional to survivors. Objects that survive several cycles are promoted. G1 does this with regions tagged eden/survivor/old/humongous instead of fixed contiguous spaces. ZGC is generational since Java 21 (JEP 439, opt-in with <code>-XX:+ZGenerational</code>).</p>', lvl: 'core' },
    { q: 'What is in an object header?', a: '<p>On 64-bit HotSpot: an 8-byte <b>mark word</b> (identity hash code once computed, GC age bits, lock state) and a <b>klass pointer</b> to the class metadata (4 bytes when compressed, the default). Arrays add a 4-byte length. Objects are aligned to 8 bytes. So: Object 16 B, Integer 16 B, Long 24 B, an empty <code>String</code> 24 B plus its array.</p>', fu: 'How do you measure it? (JOL: <code>ClassLayout.parseClass(Foo.class).toPrintable()</code>.)', lvl: 'deep' },
    { q: 'What are compressed oops?', a: '<p>Ordinary object pointers stored as 32-bit offsets from the heap base, shifted left by 3 (the 8-byte alignment) when decoded. That addresses 2³² × 8 = 32 GB with 4-byte references, saving memory and cache space. Enabled by default below ~32 GB. A 4 GB or smaller heap can even use unscaled (no shift) mode. <code>ObjectAlignmentInBytes=16</code> extends the range to 64 GB.</p>', lvl: 'deep' },
    { q: 'What is a TLAB?', a: '<p>A thread-local allocation buffer: a chunk of eden handed to one thread. Allocation is a pointer bump plus a bounds check, with no synchronisation. When the TLAB is full the thread gets a new one; big objects that don’t fit go to a slower shared path (or straight to humongous regions in G1). This is why allocating short-lived objects in Java is so cheap.</p>', lvl: 'deep' },
    { q: 'What is direct memory, and when would you use it?', a: '<p>Off-heap memory from <code>ByteBuffer.allocateDirect</code> (or the FFM API’s <code>Arena</code>/<code>MemorySegment</code>, preview in 21 and final in 22). The OS can do I/O on it without copying from the heap, and the GC doesn’t move or scan it. The costs: allocation is slow, it is freed only when the wrapper is collected (or the arena is closed), and it is capped by <code>MaxDirectMemorySize</code>. Use pooled direct buffers for network and file I/O.</p>', lvl: 'deep' },
    { q: 'How does the JVM size itself inside a container?', a: '<p>Since JDK 10 (backported to 8u191) the JVM reads cgroup limits (<code>UseContainerSupport</code>, on by default); cgroup v2 support came in JDK 15 and was backported to 11 and 8 updates. Without <code>-Xmx</code>, max heap = <code>MaxRAMPercentage</code> (25%) of the limit, and the CPU count drives GC and compiler thread counts. For services, set <code>MaxRAMPercentage</code> to 50–75% and check with <code>java -XX:+PrintFlagsFinal -version</code> inside the image.</p>', lvl: 'core' },
    { q: 'How do you find out where native memory goes?', a: '<p>Start with <code>-XX:NativeMemoryTracking=summary</code> (a few percent overhead), then <code>jcmd &lt;pid&gt; VM.native_memory summary</code>. Take a <code>baseline</code> and later a <code>summary.diff</code> to see what grows. NMT covers JVM-internal allocations (heap, class, thread, code, GC, symbols, direct buffers under “Other”), but not malloc calls from third-party native libraries; compare with RSS (<code>pmap</code>, <code>/proc/&lt;pid&gt;/status</code>) for those.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Container-friendly JVM flags', lang: 'bash', code: `# Dockerfile / Kubernetes env, JDK 21
JAVA_TOOL_OPTIONS="\\
  -XX:MaxRAMPercentage=60 \\
  -XX:MaxMetaspaceSize=256m \\
  -XX:MaxDirectMemorySize=256m \\
  -XX:ReservedCodeCacheSize=128m \\
  -Xss512k \\
  -XX:+ExitOnOutOfMemoryError \\
  -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/dumps"

# verify what the JVM actually picked inside the container
java -XX:+PrintFlagsFinal -version | grep -E 'MaxHeapSize|UseCompressedOops|ActiveProcessorCount'`, note: 'Test <code>-Xss512k</code> with your deepest code path first. With <code>ExitOnOutOfMemoryError</code> the orchestrator restarts a broken JVM instead of leaving it half-alive.' },
    { title: 'Native Memory Tracking', lang: 'bash', code: `java -XX:NativeMemoryTracking=summary -jar app.jar

jcmd <pid> VM.native_memory baseline
# … let it run under load …
jcmd <pid> VM.native_memory summary.diff
#  - Thread (reserved=+180MB, committed=+180MB) (threads #+180)
#  - Other  (committed=+96MB)       ← direct ByteBuffers`, note: 'NMT shows JVM-internal memory. If RSS is much higher than the NMT total, suspect native libraries or glibc arena fragmentation (try <code>MALLOC_ARENA_MAX=2</code>).' },
    { title: 'Measuring object size with JOL', lang: 'java', code: `// org.openjdk.jol:jol-core
import org.openjdk.jol.info.ClassLayout;
import org.openjdk.jol.info.GraphLayout;

record Price(long cents, String currency) {}

public static void main(String[] args) {
    System.out.println(ClassLayout.parseClass(Price.class).toPrintable());
    Map<String, Price> m = loadPrices();
    System.out.println(GraphLayout.parseInstance(m).totalSize() + " bytes reachable");
}`, note: 'Spring Boot Actuator exposes the same areas as Micrometer metrics: <code>jvm.memory.used{area=heap|nonheap, id=…}</code>, <code>jvm.buffer.memory.used</code>, <code>jvm.threads.live</code>.' }
  ]
});

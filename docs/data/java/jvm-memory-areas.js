IA.register({
  track: 'java',
  slug: 'jvm-memory-areas',
  title: 'JVM memory areas',
  tagline: 'A JVM uses far more memory than <code>-Xmx</code>. Objects live on the <b>heap</b>. Each thread has a <b>stack</b>. Class data sits in <b>metaspace</b>, compiled code in the <b>code cache</b>, and NIO buffers in <b>direct memory</b>. Your container limit counts all of it.',
  tldr: {
    problem: 'Your pod gets killed while the heap is half empty. A bigger heap makes things worse. A million <code>Long</code>s eat 28 MB. Each surprise comes from not knowing where memory goes.',
    model: '<b>Heap</b> (shared, GC-managed: young = eden + survivors, old) · <b>thread stacks</b> (one per platform thread, frames with locals and references) · <b>metaspace</b> (class metadata, native) · <b>code cache</b> (JIT code) · <b>direct buffers</b> (off-heap NIO) · GC structures, symbols, malloc. Every object pays a 12-byte header and 8-byte alignment.',
    hook: '“The container limit is 2 GiB and <code>-Xmx</code> is 2 GiB. What happens?” The kernel kills the process (exit code 137). You get no Java error. The non-heap memory had nowhere to fit.',
    facts: [
      { v: '12 + 4', l: 'bytes of header + padding: <code>new Object()</code> is 16 bytes on 64-bit HotSpot with compressed class pointers (JDK 21 default)' },
      { v: '~32 GB', l: 'the heap size where 4-byte references (<i>compressed oops</i>) stop working: 2³² offsets × 8-byte alignment. Above it, references take 8 bytes' },
      { v: '25%', l: 'default <code>MaxRAMPercentage</code>: without <code>-Xmx</code>, the JVM (JDK 10+) takes a quarter of the container limit as max heap' }
    ]
  },
  intro: {
    what: 'Your running program needs several kinds of memory. Objects you make with <code>new</code> go on the <b>heap</b>, and the garbage collector cleans it. Each method call gets a small workspace on its thread’s <b>stack</b>. The JVM also stores the <b>classes</b>, the <b>compiled machine code</b>, and buffers it shares with the OS.',
    analogy: { icon: '🏢', title: 'An office building', text: 'The heap is the open floor where all the documents (objects) sit. A cleaner (the GC) bins the ones nobody uses. Each worker (thread) has a notepad (stack) for the current task. The building also has a library (metaspace), a print room (code cache) and a loading dock (direct memory). The rent (container limit) covers the whole building.' },
    steps: [
      { t: 'Objects live on the heap', d: '<code>new</code> puts the object on the heap. Your variable holds an address that points to it (a <b>reference</b>), not the object itself.', code: 'Order o = new Order();   // o (a reference) is on the stack; the Order is on the heap' },
      { t: 'Method calls use the stack', d: 'Each call adds a frame with its parameters and locals. Returning removes it. Recurse too deep and you get <code>StackOverflowError</code>.' },
      { t: 'The heap has generations', d: 'New objects start in the young generation. The few that live long move to the old generation. The GC checks that one less often.' },
      { t: 'There is memory outside the heap', d: 'Classes, compiled code, thread stacks and NIO buffers use native memory. So the process always uses more than <code>-Xmx</code>.', code: 'java -XX:NativeMemoryTracking=summary -jar app.jar\njcmd <pid> VM.native_memory summary' }
    ],
    terms: [
      ['heap', 'Shared memory for objects, managed by the garbage collector. Sized by <code>-Xms</code>/<code>-Xmx</code>.'],
      ['stack frame', 'Per-call storage for parameters, locals and intermediate values.'],
      ['metaspace', 'Native memory for class metadata. Replaced PermGen in Java 8.'],
      ['TLAB', 'A slice of eden that one thread fills without locking (a <i>thread-local allocation buffer</i>).'],
      ['compressed oops', 'Object references stored as 4-byte offsets instead of 8-byte pointers. Works for heaps under ~32 GB.'],
      ['RSS', 'Resident set size: the physical memory the process really uses. The container limit checks this number.']
    ]
  },
  visual: {
    title: 'Where a JVM’s memory goes',
    caption: 'Pick an area and press Play. <b>process memory map</b> adds up a real container budget. The other views each zoom into one area.'
  },
  gotchas: [
    { trap: 'Setting <code>-Xmx</code> equal to the container limit', why: 'Metaspace, code cache, thread stacks, direct buffers and GC data all live outside the heap. When total memory passes the limit, the kernel kills the process (exit 137). You get no OutOfMemoryError and no heap dump.', fix: 'Use <code>-XX:MaxRAMPercentage=50</code>–<code>75</code> instead of a fixed <code>-Xmx</code>. Cap direct memory and metaspace. Measure real usage with Native Memory Tracking.' },
    { trap: 'Growing the heap past ~32 GB', why: 'Compressed oops turn off, so every reference takes 8 bytes. Heaps full of references grow 20–40%. A 36 GB heap can hold less data than a 31 GB one.', fix: 'Stay at or below ~31 GB. Check with <code>-XX:+PrintFlagsFinal | grep UseCompressedOops</code>. Or use <code>-XX:ObjectAlignmentInBytes=16</code> (works up to 64 GB, more padding). Often the real fix is to split the workload.' },
    { trap: 'Boxed collections of numbers', code: `List<Long> ids = …;     // 1M ids ≈ 1M × (24 B Long + 4 B ref) ≈ 28 MB
long[] ids2 = …;        // 1M ids = 8 MB + 16 B header`, why: 'Each boxed value is a full object with a header and padding, plus a reference to it. Only −128…127 are cached for Integer and Long. Every other value is a new object.', fix: 'For large numeric data, use primitive arrays, <code>IntStream</code>/<code>LongStream</code>, or a primitive collections library (fastutil, Eclipse Collections).' },
    { trap: 'Thousands of platform threads', why: 'Each thread reserves <code>-Xss</code> of stack (1 MB by default on Linux x64). 2,000 blocked threads can hold hundreds of MB. Heap metrics never show it.', fix: 'Limit your thread pools. For lots of blocking I/O, use virtual threads (Java 21). Their stacks sit on the heap while parked. Lower <code>-Xss</code> with care: deep frameworks hit StackOverflowError.' },
    { trap: 'Direct memory is invisible in heap dashboards', why: 'Netty, Kafka clients, gRPC and NIO file I/O allocate outside the heap. That memory comes back only when the GC collects the small <code>DirectByteBuffer</code> wrapper. That wrapper may sit in the old gen for hours.', fix: 'Set <code>-XX:MaxDirectMemorySize</code> and watch <code>jvm.buffer.memory.used</code>. Keep <code>-XX:+DisableExplicitGC</code> off: direct allocation calls <code>System.gc()</code> under pressure.' },
    { trap: 'Metaspace is unbounded by default', why: 'Code that keeps generating classes (proxies, script engines, redeploys) grows native memory until the container kills the process.', fix: 'Set <code>-XX:MaxMetaspaceSize</code> (e.g. 256m–512m). Then a leak fails with a clear <code>OutOfMemoryError: Metaspace</code>. Alert on the metaspace metric. See <a href="class-loading.html">Class loading</a>.' }
  ],
  scenarios: [
    { title: 'Pod OOMKilled while the heap dashboard shows 55%',
      symptom: 'A Spring Boot service in a 2 GiB pod restarts every few hours with <code>OOMKilled</code>, exit code 137. Heap use stays under 1.1 of 1.5 GB. The logs show no OutOfMemoryError.',
      diagnose: `# restart with NMT, wait for the growth, then:
jcmd 1 VM.native_memory summary
#   Java Heap (reserved=1536MB, committed=1536MB)
#   Class     (committed=168MB)
#   Thread    (committed=231MB)   ← 412 threads
#   Other     (committed=310MB)   ← direct buffers`,
      cause: '<code>-Xmx1536m</code> left only ~500 MB for everything else. Slow downstream calls grew the Tomcat pool to 400 threads. A Kafka consumer’s direct buffers grew too. Together they passed 2 GiB.',
      fix: 'Size the heap as a percentage, cap the other areas, and bound the thread pool.',
      fixCode: `JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60 -XX:MaxMetaspaceSize=256m \\
  -XX:MaxDirectMemorySize=192m -XX:+ExitOnOutOfMemoryError"
# application.yml
server.tomcat.threads.max: 100` },
    { title: '“More heap” made the cache hold fewer entries',
      symptom: 'A pricing cache moved from <code>-Xmx30g</code> to <code>-Xmx40g</code> to hold more products. It still held about the same number of entries. GC pauses got longer.',
      diagnose: `java -Xmx30g -XX:+PrintFlagsFinal -version | grep UseCompressedOops   # true
java -Xmx40g -XX:+PrintFlagsFinal -version | grep UseCompressedOops   # false`,
      cause: 'Above ~32 GB, compressed oops turn off. The cache is mostly references, so the same data needed about a third more memory. That ate the extra 10 GB.',
      fix: 'Go back to ≤ 31 GB, shrink the data (primitive arrays, fewer small objects), or split the cache across instances. If you must use 32–64 GB, try <code>-XX:ObjectAlignmentInBytes=16</code>.',
      fixCode: `-Xms31g -Xmx31g -XX:+UseG1GC   # stays in compressed-oops territory` },
    { title: 'StackOverflowError when serialising an order',
      symptom: 'GET <code>/orders/{id}</code> returns 500 with <code>HttpMessageNotWritableException: Could not write JSON: Infinite recursion (StackOverflowError)</code>.',
      cause: 'The JPA entities point both ways: <code>Order.lines → OrderLine.order → Order …</code>. Jackson follows the loop until the thread’s 1 MB stack runs out.',
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
}`, options: ['Nothing: the JVM crashes', 'caught true', 'caught false', 'OutOfMemoryError'], answer: 1, run: true, expect: 'caught true', explain: 'Each call adds a small frame to the thread’s stack (1 MB by default). Thousands fit before the JVM throws <b>StackOverflowError</b>. You can catch it: the frames unwind and the stack works again. Don’t rely on that in real code. State may be half-updated.' },
    { kind: 'predict', q: 'What does this print?', code: `import java.nio.ByteBuffer;

public class Main {
    public static void main(String[] a) {
        ByteBuffer heap = ByteBuffer.allocate(16);
        ByteBuffer direct = ByteBuffer.allocateDirect(16);
        System.out.println(heap.isDirect() + " " + heap.hasArray() + " "
            + direct.isDirect() + " " + direct.hasArray());
    }
}`, options: ['false true true true', 'false true true false', 'true false false true', 'false false true false'], answer: 1, run: true, expect: 'false true true false', explain: 'A heap buffer wraps a <code>byte[]</code> on the heap, so <code>hasArray()</code> is true. A direct buffer points at memory outside the heap, so it has no array. The OS can do I/O on direct memory without an extra copy. That’s why NIO and Netty prefer it.' },
    { kind: 'concept', q: 'On 64-bit HotSpot (JDK 21, heap < 32 GB, defaults), how big is <code>new Object()</code>?', options: ['8 bytes', '12 bytes', '16 bytes', '24 bytes'], answer: 2, explain: '8-byte mark word + 4-byte class pointer = 12 bytes. Padding to 8-byte alignment gives <b>16 bytes</b>. Java 24’s experimental compact headers shrink the header to 8 bytes.' },
    { kind: 'concept', q: 'Where do static fields live in HotSpot since JDK 8?', options: ['In PermGen', 'In metaspace, next to the class metadata', 'On the heap, inside the java.lang.Class object', 'On the main thread’s stack'], answer: 2, explain: 'Since JDK 8, static fields live in the class’s <code>java.lang.Class</code> object on the <b>heap</b>. Metaspace holds methods, bytecode and constant pools. So a huge static cache shows up in heap dumps, not metaspace.' },
    { kind: 'concept', q: 'A service holds a large map of small objects. You raise <code>-Xmx</code> from 31g to 36g. What is the most likely effect?', options: ['5 GB more usable space', 'Roughly the same or less usable space, because references grow to 8 bytes', 'Faster GC because of more headroom', 'The JVM refuses to start'], answer: 1, explain: 'Past ~32 GB, compressed oops turn off. In a heap full of references, 8-byte references eat the extra 5 GB. Usable space can stay flat or drop. Check <code>UseCompressedOops</code> with <code>-XX:+PrintFlagsFinal</code>.' },
    { kind: 'concept', q: 'A pod has a 2 GiB memory limit and the JVM runs with <code>-Xmx2g</code>. Under load, what usually happens first?', options: ['OutOfMemoryError: Java heap space', 'The kernel OOM-kills the process (exit 137) without a Java error', 'The JVM shrinks the heap automatically', 'GC pauses grow but nothing fails'], answer: 1, explain: 'Heap plus metaspace, code cache, stacks and direct buffers pass the limit before the heap fills. The kernel kills the process. You get no heap dump and no stack trace. Leave headroom with <code>MaxRAMPercentage</code>.' }
  ],
  interview: [
    { q: 'What memory areas does the JVM have?', a: '<p>The JVM defines a shared <b>heap</b> for objects and a <b>method area</b> for class data (HotSpot calls it metaspace). Each class has a <b>run-time constant pool</b>. Each thread has a <b>JVM stack</b>, a <b>native method stack</b> and a <b>pc register</b>. In real processes, add the code cache, direct buffers and GC structures.</p>', lvl: 'core' },
    { q: 'Stack vs heap?', a: '<ul><li><b>Stack</b>: one per thread. Holds primitives and references for each call. Freed the moment the call returns. Limited by <code>-Xss</code>.</li><li><b>Heap</b>: shared by all threads. Holds every object and array. The GC reclaims it. Sized by <code>-Xms</code>/<code>-Xmx</code>.</li></ul><p>The JIT may keep a short-lived object’s fields in registers. Logically, objects still live on the heap.</p>', lvl: 'core' },
    { q: 'Why did Java 8 replace PermGen with metaspace?', a: '<p>PermGen was a fixed-size part of the heap for class data and interned strings. Apps with many classes or redeploys hit <code>OutOfMemoryError: PermGen space</code> and needed tuning. Metaspace uses native memory and grows as needed. It is freed when a class loader is unloaded. Interned strings and statics moved to the normal heap.</p>', lvl: 'core' },
    { q: 'How is the heap organised generationally, and why?', a: '<p>Most objects die young. So the heap splits a <b>young</b> generation (eden + two survivor spaces) from an <b>old</b> one. A young GC copies the few live objects out and drops the rest. Its cost depends on survivors, not garbage. Objects that survive several rounds get promoted. G1 does this with tagged regions instead of fixed spaces. ZGC is generational since Java 21.</p>', lvl: 'core' },
    { q: 'What is in an object header?', a: '<p>On 64-bit HotSpot it has an 8-byte <b>mark word</b> (hash code, GC age, lock state). Then comes a pointer to the class data (4 bytes, compressed by default). Arrays add a 4-byte length. Objects align to 8 bytes. So Object and Integer are 16 B, Long is 24 B, and an empty <code>String</code> is 24 B plus its array.</p>', fu: 'How do you measure it? (JOL: <code>ClassLayout.parseClass(Foo.class).toPrintable()</code>.)', lvl: 'deep' },
    { q: 'What are compressed oops?', a: '<p>References stored as 32-bit offsets from the heap start. The JVM shifts them left by 3 (8-byte alignment) to decode. That reaches 2³² × 8 = 32 GB with 4-byte references. You save memory and cache space. They are on by default below ~32 GB. <code>ObjectAlignmentInBytes=16</code> stretches the range to 64 GB.</p>', lvl: 'deep' },
    { q: 'What is a TLAB?', a: '<p>A chunk of eden given to one thread (a <i>thread-local allocation buffer</i>). Allocating means bumping a pointer and checking a bound. No locking. When it fills, the thread gets a new one. Big objects take a slower shared path. That’s why short-lived objects are so cheap in Java.</p>', lvl: 'deep' },
    { q: 'What is direct memory, and when would you use it?', a: '<p>Memory outside the heap, from <code>ByteBuffer.allocateDirect</code> or the FFM API’s <code>Arena</code>/<code>MemorySegment</code> (final in 22). The OS can do I/O on it without a copy. The GC doesn’t move or scan it. But allocating it is slow. It is freed only when the wrapper is collected or the arena closes. <code>MaxDirectMemorySize</code> caps it. Use pooled direct buffers for network and file I/O.</p>', lvl: 'deep' },
    { q: 'How does the JVM size itself inside a container?', a: '<p>Since JDK 10 (and 8u191), the JVM reads the container’s limits (<code>UseContainerSupport</code>, on by default). Without <code>-Xmx</code>, max heap is 25% of the limit (<code>MaxRAMPercentage</code>). The CPU count sets GC and compiler thread counts. For services, set <code>MaxRAMPercentage</code> to 50–75%. Check with <code>java -XX:+PrintFlagsFinal -version</code> inside the image.</p>', lvl: 'core' },
    { q: 'How do you find out where native memory goes?', a: '<p>Start with <code>-XX:NativeMemoryTracking=summary</code> (a few percent overhead). Then run <code>jcmd &lt;pid&gt; VM.native_memory summary</code>. Take a <code>baseline</code>, then a <code>summary.diff</code> later to see what grows. NMT covers the JVM’s own memory, not native libraries. For those, compare with RSS (<code>pmap</code>, <code>/proc/&lt;pid&gt;/status</code>).</p>', lvl: 'deep' }
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
java -XX:+PrintFlagsFinal -version | grep -E 'MaxHeapSize|UseCompressedOops|ActiveProcessorCount'`, note: 'Test <code>-Xss512k</code> on your deepest code path first. <code>ExitOnOutOfMemoryError</code> lets the orchestrator restart a broken JVM.' },
    { title: 'Native Memory Tracking', lang: 'bash', code: `java -XX:NativeMemoryTracking=summary -jar app.jar

jcmd <pid> VM.native_memory baseline
# … let it run under load …
jcmd <pid> VM.native_memory summary.diff
#  - Thread (reserved=+180MB, committed=+180MB) (threads #+180)
#  - Other  (committed=+96MB)       ← direct ByteBuffers`, note: 'NMT shows the JVM’s own memory. If RSS is much higher, suspect native libraries or glibc fragmentation (try <code>MALLOC_ARENA_MAX=2</code>).' },
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

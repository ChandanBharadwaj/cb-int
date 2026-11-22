IA.register({
  track: 'java',
  slug: 'java-memory-model',
  title: 'Java Memory Model',
  tagline: 'The JMM answers one question: <b>when is a write by one thread guaranteed to be visible to a read in another?</b> The answer is “when a <i>happens-before</i> edge connects them”. Without that edge, the JIT and the CPU may reorder, cache or delay writes, and your code sees stale or half-built objects.',
  tldr: {
    problem: 'Concurrency bugs that pass every test: a stop flag that is never seen, a singleton whose fields read as zero, a counter that loses updates. They appear only under load, after JIT warm-up, or on a different CPU (x86 → ARM).',
    model: 'Each thread runs its own program order. Writes become visible to other threads only through a <b>happens-before</b> chain: unlock → later lock of the same monitor, volatile write → later read of the same variable, <code>start()</code> → the new thread, the thread’s actions → <code>join()</code>. Edges are transitive. No edge means a <b>data race</b>, and then almost anything may be observed.',
    hook: '“Why is double-checked locking broken without <code>volatile</code>?” Because the reference can be published <i>before</i> the constructor’s writes are visible, so another thread skips the lock and reads a half-initialised object.',
    facts: [
      { v: 'Java 5', l: 'JSR-133 rewrote the memory model: it gave <code>volatile</code> acquire/release semantics and defined <code>final</code>-field guarantees. Volatile DCL is safe only from Java 5 on' },
      { v: 'DRF ⇒ SC', l: 'a program with no data races (every conflicting access ordered by happens-before) behaves as if sequentially consistent' },
      { v: '64-bit', l: 'plain <code>long</code>/<code>double</code> writes may be split into two 32-bit halves (JLS §17.7). <code>volatile</code> ones are always atomic' }
    ]
  },
  intro: {
    what: 'Your code runs on CPUs with private caches and <b>store buffers</b>, and it is compiled by a JIT that reorders and caches values in registers to go faster. Inside one thread, nobody can tell: the result is as if every line ran in order. But <b>another thread</b> can see those shortcuts: writes in a different order, or not at all. The <b>Java Memory Model</b> is the contract that says which reorderings are allowed and which tools (<code>volatile</code>, <code>synchronized</code>, <code>final</code>, <code>java.util.concurrent</code>) forbid them.',
    analogy: { icon: '📮', title: 'Letters and a mailbox', text: 'Each thread writes letters (memory writes) and drops them in its own outbox (the store buffer). The postman empties outboxes when he likes, not always in the order the letters were written. If you write “the parcel is in the shed” and then “go and fetch it”, your friend may get the second letter first. A <code>volatile</code> write is a registered letter: the postman must deliver everything you wrote <i>before</i> it, first.' },
    steps: [
      { t: 'One thread: no surprises', d: 'Within a thread, the JIT may reorder freely, but only in ways that thread can’t observe (“as-if-serial”).' },
      { t: 'Two threads: a race', d: 'If two threads touch the same variable, at least one writes, and nothing orders them, that is a <b>data race</b>. The reader may see an old value, a new one, or (for <code>long</code>) half of each.', code: 'boolean stop;          // plain field\n// thread A: while (!stop) work();\n// thread B: stop = true;   // A may never see it' },
      { t: 'Create a happens-before edge', d: 'Mark the flag <code>volatile</code>, guard both sides with the same lock, or use an <code>AtomicBoolean</code>. Then the write is guaranteed to become visible.', code: 'volatile boolean stop;' },
      { t: 'Publish objects safely', d: 'Hand an object to other threads through a volatile field, a lock, a concurrent collection, a static initializer, or make it immutable with <code>final</code> fields.' }
    ],
    terms: [
      ['happens-before', 'A guarantee that the effects of action A are visible to action B and A is ordered before it. Built from a few rules and transitivity.'],
      ['data race', 'Two accesses to the same variable from different threads, at least one a write, not ordered by happens-before.'],
      ['volatile', 'A field whose writes and reads act as release and acquire, are atomic, and are in one global order.'],
      ['safe publication', 'Making an object reference and the object’s contents visible to another thread together.'],
      ['store buffer', 'A per-core queue of writes not yet in the cache. It lets a core read <i>before</i> its own earlier writes reach other cores.'],
      ['reordering', 'Executing or making visible memory operations in a different order than the source code, by the compiler or the CPU.']
    ]
  },
  visual: {
    title: 'Watch writes sit in store buffers, and volatile create happens-before',
    caption: 'Pick a litmus test, choose <b>plain</b> or <b>volatile</b>, and press Play or Step. Writes go into each thread’s store buffer before reaching memory; reads come from memory (or the thread’s own buffer). Green arrows are happens-before edges. This is a hardware-flavoured picture of what the JMM <i>allows</i>; real JITs and CPUs pick among those outcomes.'
  },
  gotchas: [
    { trap: 'A stop flag without volatile may never be seen', code: `private boolean running = true;
public void run() { while (running) { process(); } }   // JIT may hoist the read
public void stop() { running = false; }`, why: 'Nothing orders the write with the reads, so the JIT may read <code>running</code> once and loop forever. It typically appears after C2 compiles the loop, so it “works” in short tests. A <code>println</code> in the loop often hides it by accident.', fix: '<code>volatile boolean running</code> or an <code>AtomicBoolean</code>. For tasks, prefer interruption: <code>while (!Thread.currentThread().isInterrupted())</code>.' },
    { trap: '<code>volatile</code> doesn’t make <code>count++</code> atomic', code: `volatile long hits;
hits++;   // read, add, write: two threads can read the same value`, why: 'Volatile gives visibility and ordering for each single read or write. A read-modify-write is three steps, and another thread can interleave between them, so updates are lost.', fix: '<code>AtomicLong.incrementAndGet()</code>, <code>LongAdder</code> for hot counters, or a lock. See <a href="concurrency-bugs.html">Concurrency bugs</a>.' },
    { trap: 'Double-checked locking without volatile', code: `private static Helper inst;            // not volatile
static Helper get() {
    if (inst == null)                         // racy read, outside the lock
        synchronized (Helper.class) {
            if (inst == null) inst = new Helper();
        }
    return inst;                              // may be non-null but half-built
}`, why: 'The write of the reference may become visible before the constructor’s field writes. The first check runs outside the lock, so the reader has no happens-before edge with the writer and may see default field values.', fix: 'Make <code>inst</code> <code>volatile</code> (correct since Java 5), or better, use the holder idiom or an enum. Both rely on class initialisation, which the JVM makes thread-safe.' },
    { trap: 'Letting <code>this</code> escape from a constructor', code: `class Listener {
    private final Config cfg;
    Listener(EventBus bus, Config cfg) {
        bus.register(this);          // another thread can call us now…
        this.cfg = cfg;              // …before this line runs
    }
}`, why: 'The final-field guarantee only holds for objects that are <b>properly constructed</b>: no reference to <code>this</code> escapes before the constructor ends. Starting a thread or registering a callback in the constructor breaks it.', fix: 'Finish construction first, then register: a static factory method or a separate <code>start()</code>. In Spring, use <code>@PostConstruct</code> or <code>SmartLifecycle</code>.' },
    { trap: 'A volatile reference doesn’t protect later mutation', code: `volatile Map<String, Rule> rules = new HashMap<>();
rules.put("x", r);   // other threads read the map concurrently: still a race`, why: 'Volatile orders the <i>reference</i> write with later reads of the reference. Mutating the object after publishing it creates new, unordered writes.', fix: 'Publish immutable snapshots: build a new map, wrap it with <code>Map.copyOf</code>, then assign it to the volatile field (copy-on-write). Or use a concurrent collection.' },
    { trap: 'Locking on different objects gives no ordering', code: `synchronized (a) { x = 1; }      // thread 1
synchronized (b) { print(x); }   // thread 2: no edge with thread 1`, why: 'The monitor rule is per monitor: an unlock happens-before a later lock of the <b>same</b> monitor. Two locks are two unrelated orders.', fix: 'Guard each piece of shared state with exactly one lock, and document which (<code>@GuardedBy("lock")</code>).' }
  ],
  scenarios: [
    { title: 'Workers ignore the drain flag after a few minutes of uptime',
      symptom: 'On deploy, the old pods are told to “drain” via an admin endpoint that sets a flag. In staging it works. In production the pods keep consuming from the queue until SIGKILL.',
      diagnose: `// consumer loop
private boolean draining;              // set by the admin endpoint's thread
while (!draining) { handle(queue.poll(1, SECONDS)); }
// -XX:+PrintCompilation shows Consumer::run compiled by C2 (tier 4) shortly after start`,
      cause: 'A plain field read in a hot loop. Once C2 compiled the loop, the read was effectively done once, so the flag written by the HTTP thread was never observed. Staging restarted pods often enough that the loop rarely reached C2.',
      fix: 'Make the flag volatile (or an <code>AtomicBoolean</code>). Better, stop consumers through their executor’s shutdown and interruption, which the JMM orders for you.',
      fixCode: `private volatile boolean draining;   // write → read is now a happens-before edge

// or: let the executor do it
consumerPool.shutdownNow();          // interrupts; poll() throws InterruptedException` },
    { title: 'Rare NullPointerException after moving to ARM (Graviton) nodes',
      symptom: 'After migrating from x86 to ARM instances, one in a few million requests fails with an NPE on <code>settings.region()</code>, right after a settings reload.',
      diagnose: `class SettingsHolder {
    Settings current;                       // plain field
    void reload() { Settings s = new Settings(); s.region = load(); current = s; }
}
// Settings.region is a non-final field`,
      cause: 'Racy publication. On x86 (TSO), stores aren’t reordered with other stores, so the bug was hidden. ARM’s weaker model (and the JIT) may make the reference visible before the <code>region</code> write. The code was always wrong; the hardware stopped forgiving it.',
      fix: 'Publish an immutable object through a volatile field. A <code>record</code> has final fields, so even a racy reader would see them initialised; the volatile field also guarantees readers see the latest snapshot.',
      fixCode: `record Settings(String region, Duration timeout) {}

class SettingsHolder {
    private volatile Settings current = Settings.defaults();
    void reload() { current = new Settings(loadRegion(), loadTimeout()); }
    Settings get() { return current; }
}` },
    { title: 'A request counter is 3% lower than the access log',
      symptom: 'An in-house metric counts requests with a <code>volatile long</code>. Under load it reports noticeably fewer requests than the load balancer’s logs.',
      diagnose: `private volatile long requests;
void onRequest() { requests++; }   // 200 request threads`,
      cause: 'Volatile makes each read and write visible, but <code>++</code> is a read, then a write. Two threads read 41 and both write 42: one update is lost. The higher the contention, the more is lost.',
      fix: 'Use <code>LongAdder</code> for a hot counter (striped cells, summed on read), or <code>AtomicLong</code> when you need an exact value per increment. Or just use Micrometer’s <code>Counter</code>, which is built on that.',
      fixCode: `private final LongAdder requests = new LongAdder();
void onRequest() { requests.increment(); }
long total() { return requests.sum(); }` }
  ],
  puzzles: [
    { kind: 'predict', q: 'No volatile, no locks. What does this print?', code: `public class Main {
    static int a;
    static int b;

    public static void main(String[] args) throws Exception {
        a = 1;
        Thread t = new Thread(() -> { b = a + 1; });
        t.start();
        t.join();
        System.out.println(a + " " + b);
    }
}`, options: ['1 2', '1 1', '0 1', 'Could be any of these'], answer: 0, run: true, expect: '1 2', explain: 'Two happens-before rules cover this: everything before <code>t.start()</code> is visible to the new thread (so it reads <code>a = 1</code>), and everything the thread did is visible after <code>t.join()</code> returns (so main reads <code>b = 2</code>). Always <b>1 2</b>, with plain fields.' },
    { kind: 'predict', q: 'Plain fields again, this time through an executor. Output?', code: `import java.util.concurrent.*;

public class Main {
    static int[] data = new int[3];

    public static void main(String[] args) throws Exception {
        ExecutorService ex = Executors.newSingleThreadExecutor();
        data[0] = 10;
        Future<Integer> f = ex.submit(() -> { data[1] = data[0] * 2; return data[1] + 1; });
        data[2] = f.get();
        System.out.println(data[0] + " " + data[1] + " " + data[2]);
        ex.shutdown();
    }
}`, options: ['10 20 21', '10 0 21', '10 20 1', 'Not guaranteed: data race'], answer: 0, run: true, expect: '10 20 21', explain: '<code>java.util.concurrent</code> documents “memory consistency effects”: actions before <code>submit</code> happen-before the task runs, and the task’s actions happen-before <code>Future.get()</code> returns. So the task sees 10, and main sees 20: <b>10 20 21</b>. That is why handing work to an executor needs no extra volatile.' },
    { kind: 'concept', q: 'x and y are plain <code>int</code> fields, both 0. Thread 1 runs <code>x = 1; r1 = y;</code>. Thread 2 runs <code>y = 1; r2 = x;</code>. Which outcome is allowed by the JMM?', options: ['Only (r1, r2) = (1, 1)', '(0, 1), (1, 0) and (1, 1), but never (0, 0)', 'All four, including (0, 0)', 'It throws a ConcurrentModificationException'], answer: 2, explain: 'With plain fields this is a data race, and <b>(0, 0)</b> is allowed. It even happens on x86: each store waits in its core’s store buffer while the following load reads the old value from cache. Make x and y <code>volatile</code> and (0, 0) becomes impossible: volatile accesses form a single total order consistent with each thread’s program order.' },
    { kind: 'concept', q: '<code>boolean stop</code> is a plain field. A worker runs <code>while (!stop) { i++; }</code>; main sleeps one second and sets <code>stop = true</code>. What can happen?', options: ['The worker always stops within a second', 'The worker may loop forever', 'The JVM throws IllegalMonitorStateException', 'The worker stops but i is reset to 0'], answer: 1, explain: 'There is no happens-before edge, so the JIT may hoist the read out of the loop (<code>if (!stop) while (true) i++;</code>). This is a classic real-world hang after C2 compilation. <code>volatile</code> forbids it.' },
    { kind: 'concept', q: 'Two threads each run <code>for (int i = 0; i &lt; 10_000; i++) counter++;</code> on a <code>volatile int counter</code>, then both are joined. The final value is:', options: ['Exactly 20,000', 'At most 20,000, often less', 'At least 20,000', 'Always 10,000'], answer: 1, explain: 'Each <code>++</code> is a volatile read followed by a volatile write. Another thread can write in between, and one increment is lost. Volatile guarantees visibility, not atomicity. <code>AtomicInteger.incrementAndGet()</code> gives exactly 20,000.' },
    { kind: 'concept', q: '<code>class P { final int x; int y; P() { x = 1; y = 2; } }</code>. Thread 1 does <code>shared = new P();</code> through a <b>plain</b> field; thread 2 reads <code>shared</code> and sees it non-null. What is guaranteed?', options: ['x == 1 and y == 2', 'x == 1; y may be 0 or 2', 'Nothing: both may be 0', 'y == 2; x may be 0'], answer: 1, explain: 'Final-field semantics (JLS §17.5): when a constructor finishes without leaking <code>this</code>, any thread that sees the reference sees the final fields’ constructed values, even through a data race. Non-final fields get no such guarantee. That is why immutable objects with all-final fields are safe to share.' },
    { kind: 'concept', q: 'Which of these does <b>not</b> create a happens-before edge from thread A’s write to thread B’s read?', options: ['A unlocks monitor M; B later locks M', 'A writes volatile v; B later reads v', 'A writes inside synchronized(lockA); B reads inside synchronized(lockB)', 'A puts into a ConcurrentHashMap; B gets that key'], answer: 2, explain: 'The monitor rule is per monitor. Two different locks give two unrelated orders, so <b>no edge</b>. Concurrent collections document that an insert happens-before a later retrieval of that element.' },
    { kind: 'concept', q: 'Why is double-checked locking safe once the field is <code>volatile</code>?', options: ['volatile makes the constructor run atomically', 'The volatile write of the reference is a release: the constructor’s writes are visible to any thread whose volatile read sees the reference', 'volatile prevents two threads from entering the synchronized block', 'It isn’t; DCL is always broken'], answer: 1, explain: 'Program order puts the constructor’s writes before the volatile write. The volatile write happens-before every later volatile read of the same field. By transitivity, a reader that sees the non-null reference also sees the fully built object. Before Java 5 (JSR-133), volatile didn’t give this, which is why old articles call DCL broken.' }
  ],
  interview: [
    { q: 'What is happens-before? Name the main rules.', a: '<p>A partial order on actions: if A happens-before B, A’s effects are visible to B and A is ordered before it. Rules: <b>program order</b> within a thread; <b>monitor</b>: unlock → every later lock of the same monitor; <b>volatile</b>: write → every later read of the same variable; <b>thread start</b>: <code>start()</code> → first action of the new thread; <b>thread termination</b>: last action → <code>join()</code> returning; <b>interrupt</b> → the interrupted thread detecting it; <b>constructor end → finalizer</b>; and <b>transitivity</b>. <code>java.util.concurrent</code> adds its own (executor submit → task, task → <code>Future.get</code>, queue put → take, latch countDown → await).</p>', lvl: 'core' },
    { q: 'What exactly does <code>volatile</code> guarantee?', a: '<ul><li><b>Visibility</b>: a read sees the most recent write in the synchronization order.</li><li><b>Ordering</b>: a write is a release (earlier writes can’t move after it); a read is an acquire (later reads can’t move before it). All volatile accesses form one total order.</li><li><b>Atomicity of a single access</b>, including <code>long</code>/<code>double</code>.</li></ul><p>It doesn’t make compound actions (<code>++</code>, check-then-act) atomic, and doesn’t give mutual exclusion.</p>', fu: 'When is volatile enough? (One writer, or writes that don’t depend on the current value, such as a flag or publishing an immutable snapshot.)', lvl: 'core' },
    { q: 'Why was double-checked locking broken, and what are the correct alternatives?', a: '<p><code>inst = new Helper()</code> is “allocate, run constructor, write reference”, but nothing stops the reference write from becoming visible first. A thread doing the unsynchronized first check can see a non-null reference to an object whose fields are still defaults. Fixes: make the field <code>volatile</code> (Java 5+), use the <b>holder idiom</b> (<code>static class Holder { static final Helper I = new Helper(); }</code>), which relies on lazy, thread-safe class initialisation, or an <b>enum</b> singleton. In Spring, just let the container create the singleton bean.</p>', lvl: 'core' },
    { q: 'What are the ways to safely publish an object?', a: '<ul><li>Initialise it in a static initializer (class init is synchronized by the JVM).</li><li>Store the reference in a <code>volatile</code> field or an <code>AtomicReference</code>.</li><li>Store it in a <code>final</code> field of a properly constructed object.</li><li>Store it in a field guarded by a lock that readers also take.</li><li>Put it in a thread-safe collection (ConcurrentHashMap, BlockingQueue, …) or hand it to an executor.</li></ul><p>Immutable objects (all fields final, no <code>this</code> escape) are safe even when published through a race, though readers may see a stale reference.</p>', lvl: 'core' },
    { q: 'Explain final-field semantics.', a: '<p>At the end of a constructor there is a conceptual <b>freeze</b> of the final fields. A thread that obtains a reference to the object <i>after</i> the constructor finished is guaranteed to see the frozen values of final fields, and of objects reachable through them as of the freeze, even with no synchronisation. Conditions: <code>this</code> must not escape during construction, and the guarantee doesn’t extend to non-final fields or to changes made after the freeze. Changing finals via reflection breaks it.</p>', lvl: 'deep' },
    { q: 'Is <code>synchronized</code> about “flushing caches to main memory”?', a: '<p>That mental model is common but misleading. CPU caches are kept coherent by hardware (MESI and friends). The real sources of staleness are the <b>compiler</b> (keeping values in registers, reordering) and <b>store buffers</b> / out-of-order execution. Locks and volatiles constrain both: the JIT may not move accesses across them, and it emits barrier instructions where the CPU needs them. The JMM itself only talks about happens-before, not caches.</p>', lvl: 'deep' },
    { q: 'How does HotSpot implement volatile on x86 and on ARM?', a: '<p>x86 is TSO: it only reorders a store with a later load. HotSpot emits plain <code>mov</code>s for volatile loads and stores, plus a full fence after a volatile store (typically <code>lock addl $0,(rsp)</code>) to forbid store→load reordering. On AArch64 it uses load-acquire / store-release instructions (<code>ldar</code>/<code>stlr</code>). In both cases the JIT also refrains from reordering across volatile accesses.</p>', lvl: 'deep' },
    { q: 'What is a data race, and what does “DRF-SC” promise?', a: '<p>A data race is two accesses to the same variable from different threads, at least one a write, not ordered by happens-before. The JMM promises that if all sequentially consistent executions of a program are race-free, the program behaves sequentially consistently: you can reason as if threads interleave one statement at a time. Racy programs still get some guarantees (no out-of-thin-air values, type safety), but not intuitive ones.</p>', lvl: 'deep' },
    { q: 'What are VarHandle access modes?', a: '<p>Since Java 9, <code>VarHandle</code> exposes graded orderings on any field or array element: <b>plain</b> (no guarantees), <b>opaque</b> (no tearing, eventual visibility, per-variable coherence), <b>acquire/release</b> (one-way ordering, like a lock’s acquire and release: enough for message passing), and <b>volatile</b> (full, with a total order). Plus atomic CAS, getAndAdd and others. <code>Atomic*</code> classes use these internally. In application code, <code>volatile</code> and <code>Atomic*</code> are usually enough.</p>', lvl: 'deep' },
    { q: 'Can a reader see a “torn” long?', a: '<p>JLS §17.7 allows a non-volatile <code>long</code> or <code>double</code> write to be split into two 32-bit writes, so a racing reader could see the high half of one value and the low half of another. On 64-bit HotSpot this doesn’t happen in practice, but the spec permits it. Volatile <code>long</code>/<code>double</code>, and references, are always atomic.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Lazy singletons, three correct ways', lang: 'java', code: `// 1) Holder idiom: lazy and lock-free after init; class init is thread-safe
final class Registry {
    private Registry() {}
    private static final class Holder { static final Registry INSTANCE = new Registry(); }
    static Registry get() { return Holder.INSTANCE; }   // Holder initialised on first call
}

// 2) Volatile double-checked locking (Java 5+)
final class Client {
    private static volatile Client inst;
    static Client get() {
        Client c = inst;                       // one volatile read on the fast path
        if (c == null) {
            synchronized (Client.class) {
                c = inst;
                if (c == null) inst = c = new Client();
            }
        }
        return c;
    }
}

// 3) Enum: serialization- and reflection-safe
enum Clock { INSTANCE; Instant now() { return Instant.now(); } }`, note: 'In a Spring app, singleton beans are created by the container and safely published to request threads. You rarely need these by hand.' },
    { title: 'Copy-on-write config snapshots', lang: 'java', code: `record RoutingTable(Map<String, URI> routes, Instant loadedAt) {
    RoutingTable { routes = Map.copyOf(routes); }   // immutable, final fields
}

@Component
class Routes {
    private final AtomicReference<RoutingTable> table =
            new AtomicReference<>(new RoutingTable(Map.of(), Instant.EPOCH));

    URI resolve(String key) { return table.get().routes().get(key); }   // lock-free reads

    @Scheduled(fixedDelay = 30_000)
    void reload() {
        Map<String, URI> fresh = loadFromDb();             // build off to the side
        table.set(new RoutingTable(fresh, Instant.now()));  // publish atomically
    }
}`, note: 'Readers never see a half-updated table: they see either the old snapshot or the new one. Use <code>updateAndGet</code> if updates depend on the current value.' },
    { title: 'Acquire/release message passing with VarHandle', lang: 'java', code: `final class Mailbox {
    private Object payload;                  // plain
    private boolean ready;                   // accessed through READY
    private static final VarHandle READY;
    static {
        try { READY = MethodHandles.lookup().findVarHandle(Mailbox.class, "ready", boolean.class); }
        catch (ReflectiveOperationException e) { throw new ExceptionInInitializerError(e); }
    }

    void send(Object p) {
        payload = p;                         // plain write…
        READY.setRelease(this, true);        // …made visible by the release
    }

    Object poll() {
        if ((boolean) READY.getAcquire(this)) return payload;   // acquire pairs with release
        return null;
    }
}`, note: 'Single producer, single consumer. This is what a <code>volatile</code> flag would give you, minus the full StoreLoad fence. Reach for it only when profiling says the fence matters.' }
  ]
});

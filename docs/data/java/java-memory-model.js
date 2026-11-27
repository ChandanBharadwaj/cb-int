IA.register({
  track: 'java',
  slug: 'java-memory-model',
  title: 'Java Memory Model',
  tagline: 'The Java Memory Model (JMM) answers one question: <b>when is a write in one thread sure to be seen by a read in another?</b> Answer: when an ordering link (<i>happens-before</i>) connects them. Without that link, the JIT and CPU may reorder, cache or delay writes. Your code then sees stale or half-built objects.',
  tldr: {
    problem: 'Some concurrency bugs pass every test. A stop flag is never seen. A singleton’s fields read as zero. A counter loses updates. They show up only under load, after JIT warm-up, or on another CPU (x86 → ARM).',
    model: 'Each thread runs in its own order. Another thread sees its writes only through a <b>happens-before</b> chain. Unlock → later lock of the same lock. Volatile write → later read of the same variable. <code>start()</code> → the new thread. The thread’s work → <code>join()</code>. Chains link up. No chain means a <b>data race</b>, and then almost anything can happen.',
    hook: '“Why is double-checked locking broken without <code>volatile</code>?” The reference can become visible <i>before</i> the constructor’s writes. Another thread skips the lock and reads a half-built object.',
    facts: [
      { v: 'Java 5', l: 'JSR-133 rewrote the memory model. It gave <code>volatile</code> its ordering rules and defined what <code>final</code> fields guarantee. Volatile double-checked locking is safe only from Java 5 on' },
      { v: 'DRF ⇒ SC', l: 'a program with no data races behaves as if threads take turns, one step at a time' },
      { v: '64-bit', l: 'plain <code>long</code>/<code>double</code> writes may be split into two 32-bit halves. <code>volatile</code> ones never are' }
    ]
  },
  intro: {
    what: 'CPUs have private caches and queues of pending writes (<b>store buffers</b>). The JIT reorders code and keeps values in registers to go faster. Inside one thread, you can’t tell: it looks as if every line ran in order. But <b>another thread</b> can see these shortcuts. It may see writes in a different order, or not at all. The <b>Java Memory Model</b> says which reorderings are allowed. It also says which tools forbid them: <code>volatile</code>, <code>synchronized</code>, <code>final</code>, <code>java.util.concurrent</code>.',
    analogy: { icon: '📮', title: 'Letters and a mailbox', text: 'Each thread writes letters (memory writes) and drops them in its own outbox (the store buffer). The postman empties outboxes when he likes, not always in order. Write “the parcel is in the shed”, then “go fetch it”, and your friend may get the second letter first. A <code>volatile</code> write is a registered letter. The postman must deliver everything you wrote <i>before</i> it first.' },
    steps: [
      { t: 'One thread: no surprises', d: 'Within a thread, the JIT may reorder freely, but only in ways that thread can’t notice.' },
      { t: 'Two threads: a race', d: 'Two threads touch the same variable, one writes, and nothing orders them: that’s a <b>data race</b>. The reader may see the old value, the new one, or (for <code>long</code>) half of each.', code: 'boolean stop;          // plain field\n// thread A: while (!stop) work();\n// thread B: stop = true;   // A may never see it' },
      { t: 'Create a happens-before edge', d: 'Mark the flag <code>volatile</code>, guard both sides with the same lock, or use an <code>AtomicBoolean</code>. Then the write is sure to become visible.', code: 'volatile boolean stop;' },
      { t: 'Publish objects safely', d: 'Hand an object to other threads through a volatile field, a lock, a concurrent collection or a static initializer. Or make it immutable with <code>final</code> fields.' }
    ],
    terms: [
      ['happens-before', 'A promise that action A’s effects are visible to action B, and A comes first. Built from a few rules that chain together.'],
      ['data race', 'Two accesses to one variable from different threads, at least one a write, with nothing ordering them.'],
      ['volatile', 'A field whose reads and writes are atomic, ordered, and seen in one global order.'],
      ['safe publication', 'Making an object’s reference and its contents visible to another thread together (<i>publication</i>).'],
      ['store buffer', 'A per-core queue of writes not yet in the cache. A core can read <i>before</i> its own earlier writes reach other cores.'],
      ['reordering', 'Running or showing memory operations in a different order than the source code. The compiler or the CPU can do it.']
    ]
  },
  visual: {
    title: 'Watch writes sit in store buffers, and volatile create happens-before',
    caption: 'Pick a test, choose <b>plain</b> or <b>volatile</b>, and press Play or Step. Writes wait in each thread’s store buffer before reaching memory. Reads come from memory or the thread’s own buffer. Green arrows are happens-before links. This shows what the JMM <i>allows</i>. Real JITs and CPUs pick among those outcomes.'
  },
  gotchas: [
    { trap: 'A stop flag without volatile may never be seen', code: `private boolean running = true;
public void run() { while (running) { process(); } }   // JIT may hoist the read
public void stop() { running = false; }`, why: 'Nothing orders the write with the reads. So the JIT may read <code>running</code> once and loop forever. It often appears only after C2 compiles the loop, so short tests pass. A <code>println</code> in the loop often hides it by accident.', fix: 'Use <code>volatile boolean running</code> or an <code>AtomicBoolean</code>. For tasks, prefer interruption: <code>while (!Thread.currentThread().isInterrupted())</code>.' },
    { trap: '<code>volatile</code> doesn’t make <code>count++</code> atomic', code: `volatile long hits;
hits++;   // read, add, write: two threads can read the same value`, why: 'Volatile makes each single read or write visible and ordered. But <code>++</code> is three steps. Another thread can slip in between, and updates are lost.', fix: 'Use <code>AtomicLong.incrementAndGet()</code>, <code>LongAdder</code> for hot counters, or a lock. See <a href="concurrency-bugs.html">Concurrency bugs</a>.' },
    { trap: 'Double-checked locking without volatile', code: `private static Helper inst;            // not volatile
static Helper get() {
    if (inst == null)                         // racy read, outside the lock
        synchronized (Helper.class) {
            if (inst == null) inst = new Helper();
        }
    return inst;                              // may be non-null but half-built
}`, why: 'The reference may become visible before the constructor’s field writes. The first check runs outside the lock. So the reader has no link to the writer and may see default field values.', fix: 'Make <code>inst</code> <code>volatile</code> (correct since Java 5). Better, use the holder idiom or an enum. Both rely on class setup, which the JVM makes thread-safe.' },
    { trap: 'Letting <code>this</code> escape from a constructor', code: `class Listener {
    private final Config cfg;
    Listener(EventBus bus, Config cfg) {
        bus.register(this);          // another thread can call us now…
        this.cfg = cfg;              // …before this line runs
    }
}`, why: 'The final-field promise holds only for objects that are <b>properly constructed</b>. No reference to <code>this</code> may escape before the constructor ends. Starting a thread or registering a callback in the constructor breaks it.', fix: 'Finish construction first, then register: use a static factory or a separate <code>start()</code>. In Spring, use <code>@PostConstruct</code> or <code>SmartLifecycle</code>.' },
    { trap: 'A volatile reference doesn’t protect later mutation', code: `volatile Map<String, Rule> rules = new HashMap<>();
rules.put("x", r);   // other threads read the map concurrently: still a race`, why: 'Volatile orders the write of the <i>reference</i>. Changing the object after publishing it makes new, unordered writes.', fix: 'Publish immutable snapshots. Build a new map, wrap it with <code>Map.copyOf</code>, then assign it to the volatile field. Or use a concurrent collection.' },
    { trap: 'Locking on different objects gives no ordering', code: `synchronized (a) { x = 1; }      // thread 1
synchronized (b) { print(x); }   // thread 2: no edge with thread 1`, why: 'The lock rule works per lock: an unlock links to a later lock of the <b>same</b> lock. Two locks give two unrelated orders.', fix: 'Guard each piece of shared state with exactly one lock. Write down which (<code>@GuardedBy("lock")</code>).' }
  ],
  scenarios: [
    { title: 'Workers ignore the drain flag after a few minutes of uptime',
      symptom: 'On deploy, an admin endpoint sets a flag telling old pods to “drain”. In staging it works. In production the pods keep reading the queue until SIGKILL.',
      diagnose: `// consumer loop
private boolean draining;              // set by the admin endpoint's thread
while (!draining) { handle(queue.poll(1, SECONDS)); }
// -XX:+PrintCompilation shows Consumer::run compiled by C2 (tier 4) shortly after start`,
      cause: 'A plain field read in a hot loop. Once C2 compiled the loop, it read the flag only once. So the HTTP thread’s write was never seen. Staging restarted pods often, so the loop rarely reached C2.',
      fix: 'Make the flag volatile or an <code>AtomicBoolean</code>. Better, stop consumers through executor shutdown and interruption. The JMM orders those for you.',
      fixCode: `private volatile boolean draining;   // write → read is now a happens-before edge

// or: let the executor do it
consumerPool.shutdownNow();          // interrupts; poll() throws InterruptedException` },
    { title: 'Rare NullPointerException after moving to ARM (Graviton) nodes',
      symptom: 'After moving from x86 to ARM, one in a few million requests fails with an NPE on <code>settings.region()</code>, right after a settings reload.',
      diagnose: `class SettingsHolder {
    Settings current;                       // plain field
    void reload() { Settings s = new Settings(); s.region = load(); current = s; }
}
// Settings.region is a non-final field`,
      cause: 'Unsafe publication. x86 never reorders one store with another, so the bug stayed hidden. ARM’s looser rules (and the JIT) may show the reference before the <code>region</code> write. The code was always wrong. The hardware stopped forgiving it.',
      fix: 'Publish an immutable object through a volatile field. A <code>record</code> has final fields, so even a racing reader sees them set. The volatile field also makes readers see the latest snapshot.',
      fixCode: `record Settings(String region, Duration timeout) {}

class SettingsHolder {
    private volatile Settings current = Settings.defaults();
    void reload() { current = new Settings(loadRegion(), loadTimeout()); }
    Settings get() { return current; }
}` },
    { title: 'A request counter is 3% lower than the access log',
      symptom: 'An in-house metric counts requests with a <code>volatile long</code>. Under load it reports far fewer requests than the load balancer logs.',
      diagnose: `private volatile long requests;
void onRequest() { requests++; }   // 200 request threads`,
      cause: 'Volatile makes each read and write visible, but <code>++</code> is a read, then a write. Two threads read 41 and both write 42. One update is lost. More contention, more loss.',
      fix: 'Use <code>LongAdder</code> for a hot counter, or <code>AtomicLong</code> when you need an exact value per increment. Or use Micrometer’s <code>Counter</code>, built on these.',
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
}`, options: ['1 2', '1 1', '0 1', 'Could be any of these'], answer: 0, run: true, expect: '1 2', explain: 'Two rules cover this. Everything before <code>t.start()</code> is visible to the new thread, so it reads <code>a = 1</code>. Everything the thread did is visible after <code>t.join()</code>, so main reads <code>b = 2</code>. Always <b>1 2</b>, with plain fields.' },
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
}`, options: ['10 20 21', '10 0 21', '10 20 1', 'Not guaranteed: data race'], answer: 0, run: true, expect: '10 20 21', explain: '<code>java.util.concurrent</code> promises ordering here. Work before <code>submit</code> is visible to the task. The task’s work is visible after <code>Future.get()</code> returns. So the task sees 10 and main sees 20: <b>10 20 21</b>. That’s why handing work to an executor needs no extra volatile.' },
    { kind: 'concept', q: 'x and y are plain <code>int</code> fields, both 0. Thread 1 runs <code>x = 1; r1 = y;</code>. Thread 2 runs <code>y = 1; r2 = x;</code>. Which outcome is allowed by the JMM?', options: ['Only (r1, r2) = (1, 1)', '(0, 1), (1, 0) and (1, 1), but never (0, 0)', 'All four, including (0, 0)', 'It throws a ConcurrentModificationException'], answer: 2, explain: 'With plain fields this is a data race, and <b>(0, 0)</b> is allowed. It even happens on x86. Each store waits in its core’s store buffer while the next load reads the old value. Make x and y <code>volatile</code> and (0, 0) becomes impossible. Volatile accesses fall into one total order.' },
    { kind: 'concept', q: '<code>boolean stop</code> is a plain field. A worker runs <code>while (!stop) { i++; }</code>; main sleeps one second and sets <code>stop = true</code>. What can happen?', options: ['The worker always stops within a second', 'The worker may loop forever', 'The JVM throws IllegalMonitorStateException', 'The worker stops but i is reset to 0'], answer: 1, explain: 'Nothing links the write to the read. So the JIT may move the read out of the loop (<code>if (!stop) while (true) i++;</code>). This is a classic real hang after C2 compiles. <code>volatile</code> forbids it.' },
    { kind: 'concept', q: 'Two threads each run <code>for (int i = 0; i &lt; 10_000; i++) counter++;</code> on a <code>volatile int counter</code>, then both are joined. The final value is:', options: ['Exactly 20,000', 'At most 20,000, often less', 'At least 20,000', 'Always 10,000'], answer: 1, explain: 'Each <code>++</code> is a volatile read, then a volatile write. Another thread can write in between, and one increment is lost. Volatile gives visibility, not atomicity. <code>AtomicInteger.incrementAndGet()</code> gives exactly 20,000.' },
    { kind: 'concept', q: '<code>class P { final int x; int y; P() { x = 1; y = 2; } }</code>. Thread 1 does <code>shared = new P();</code> through a <b>plain</b> field; thread 2 reads <code>shared</code> and sees it non-null. What is guaranteed?', options: ['x == 1 and y == 2', 'x == 1; y may be 0 or 2', 'Nothing: both may be 0', 'y == 2; x may be 0'], answer: 1, explain: 'When a constructor finishes without leaking <code>this</code>, any thread that sees the reference sees the final fields’ values. That holds even through a data race. Non-final fields get no such promise. That’s why immutable objects with all-final fields are safe to share.' },
    { kind: 'concept', q: 'Which of these does <b>not</b> create a happens-before edge from thread A’s write to thread B’s read?', options: ['A unlocks monitor M; B later locks M', 'A writes volatile v; B later reads v', 'A writes inside synchronized(lockA); B reads inside synchronized(lockB)', 'A puts into a ConcurrentHashMap; B gets that key'], answer: 2, explain: 'The lock rule works per lock. Two different locks give two unrelated orders, so <b>no link</b>. Concurrent collections promise that an insert is visible to a later read of that element.' },
    { kind: 'concept', q: 'Why is double-checked locking safe once the field is <code>volatile</code>?', options: ['volatile makes the constructor run atomically', 'The volatile write of the reference is a release: the constructor’s writes are visible to any thread whose volatile read sees the reference', 'volatile prevents two threads from entering the synchronized block', 'It isn’t; DCL is always broken'], answer: 1, explain: 'In program order, the constructor’s writes come before the volatile write. The volatile write links to every later volatile read of the field. So a reader who sees the reference also sees the fully built object. Before Java 5, volatile didn’t promise this. That’s why old articles call it broken.' }
  ],
  interview: [
    { q: 'What is happens-before? Name the main rules.', a: '<p>An ordering between actions. If A happens-before B, B sees A’s effects. Rules: <b>program order</b> within a thread. <b>Lock</b>: unlock → later lock of the same lock. <b>Volatile</b>: write → later read of the same variable. <b>Thread start</b>: <code>start()</code> → the new thread’s first action. <b>Thread end</b>: last action → <code>join()</code> returning. <b>Interrupt</b> → the thread noticing it. Plus <b>transitivity</b>: chains link up. <code>java.util.concurrent</code> adds more: submit → task, task → <code>Future.get</code>, put → take, countDown → await.</p>', lvl: 'core' },
    { q: 'What exactly does <code>volatile</code> guarantee?', a: '<ul><li><b>Visibility</b>: a read sees the latest write.</li><li><b>Ordering</b>: earlier writes can’t move after a volatile write. Later reads can’t move before a volatile read. All volatile accesses form one total order.</li><li><b>Atomic single access</b>, including <code>long</code>/<code>double</code>.</li></ul><p>It doesn’t make compound actions (<code>++</code>, check-then-act) atomic. It doesn’t give mutual exclusion.</p>', fu: 'When is volatile enough? (One writer, or writes that don’t depend on the current value: a flag, or publishing an immutable snapshot.)', lvl: 'core' },
    { q: 'Why was double-checked locking broken, and what are the correct alternatives?', a: '<p><code>inst = new Helper()</code> means allocate, run the constructor, write the reference. Nothing stops the reference write from becoming visible first. A thread doing the unlocked first check can see a non-null object whose fields are still defaults. Fixes: make the field <code>volatile</code> (Java 5+). Or use the <b>holder idiom</b> (<code>static class Holder { static final Helper I = new Helper(); }</code>), which relies on thread-safe class setup. Or use an <b>enum</b>. In Spring, let the container make the singleton bean.</p>', lvl: 'core' },
    { q: 'What are the ways to safely publish an object?', a: '<ul><li>Set it up in a static initializer (the JVM locks class setup).</li><li>Store the reference in a <code>volatile</code> field or an <code>AtomicReference</code>.</li><li>Store it in a <code>final</code> field of a properly built object.</li><li>Store it in a field guarded by a lock that readers also take.</li><li>Put it in a thread-safe collection, or hand it to an executor.</li></ul><p>Immutable objects (all fields final, no <code>this</code> escape) are safe even through a race. Readers may still see an old reference.</p>', lvl: 'core' },
    { q: 'Explain final-field semantics.', a: '<p>At the end of a constructor, the final fields are “frozen”. A thread that gets the reference <i>after</i> that sees the frozen values. It also sees objects reachable through them as of the freeze. No locking needed. Conditions: <code>this</code> must not escape during construction. Non-final fields and later changes aren’t covered. Changing finals by reflection breaks it.</p>', lvl: 'deep' },
    { q: 'Is <code>synchronized</code> about “flushing caches to main memory”?', a: '<p>That picture is common but misleading. Hardware keeps CPU caches in sync. Staleness really comes from the <b>compiler</b> (registers, reordering) and from <b>store buffers</b> and out-of-order execution. Locks and volatiles limit both. The JIT may not move accesses across them, and it adds barrier instructions where the CPU needs them. The JMM itself only talks about happens-before, not caches.</p>', lvl: 'deep' },
    { q: 'How does HotSpot implement volatile on x86 and on ARM?', a: '<p>x86 only reorders a store with a later load. So HotSpot uses plain <code>mov</code>s for volatile loads and stores. It adds a full fence after a volatile store (often <code>lock addl $0,(rsp)</code>). On AArch64 it uses load-acquire / store-release instructions (<code>ldar</code>/<code>stlr</code>). Either way, the JIT won’t reorder across volatile accesses.</p>', lvl: 'deep' },
    { q: 'What is a data race, and what does “DRF-SC” promise?', a: '<p>A data race is two accesses to one variable from different threads, at least one a write, with no ordering. The JMM promises: if your program has no races, it behaves as if threads take turns, one statement at a time (<i>DRF-SC</i>). Racy programs still get a few promises, like no made-up values and type safety. But nothing intuitive.</p>', lvl: 'deep' },
    { q: 'What are VarHandle access modes?', a: '<p>Since Java 9, <code>VarHandle</code> offers graded orderings on any field or array element. <b>plain</b>: no promises. <b>opaque</b>: no torn values, seen eventually. <b>acquire/release</b>: one-way ordering, like a lock, enough for message passing. <b>volatile</b>: full ordering. It also has atomic CAS, getAndAdd and more. <code>Atomic*</code> classes use these inside. In app code, <code>volatile</code> and <code>Atomic*</code> are usually enough.</p>', lvl: 'deep' },
    { q: 'Can a reader see a “torn” long?', a: '<p>Java allows a non-volatile <code>long</code> or <code>double</code> write to be split into two 32-bit writes. A racing reader could see half of one value and half of another. On 64-bit HotSpot this doesn’t happen in practice, but the rules allow it. Volatile <code>long</code>/<code>double</code>, and references, are always atomic.</p>', lvl: 'deep' }
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
enum Clock { INSTANCE; Instant now() { return Instant.now(); } }`, note: 'In Spring, the container creates singleton beans and publishes them safely to request threads. You rarely need these by hand.' },
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
}`, note: 'Readers never see a half-updated table. They see the old snapshot or the new one. Use <code>updateAndGet</code> if updates depend on the current value.' },
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
}`, note: 'One producer, one consumer. This gives what a <code>volatile</code> flag would, minus the full fence. Use it only when profiling says the fence matters.' }
  ]
});

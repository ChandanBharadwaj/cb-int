IA.register({
  track: 'java',
  slug: 'virtual-threads',
  title: 'Virtual threads (Java 21)',
  tagline: 'A virtual thread is a <b>Java object with a stack</b>, run by a small pool of <i>carrier</i> platform threads. When it blocks on I/O it <b>unmounts</b>: its stack goes to the heap and the carrier runs someone else. That makes blocking cheap, so thread-per-request scales to millions, unless the thread is <b>pinned</b>.',
  tldr: {
    problem: 'Platform threads are expensive (an OS thread each), so servers cap them at a few hundred and turn to async callbacks to scale. That trades simple blocking code for callback chains, lost stack traces and ThreadLocal headaches.',
    model: 'The JDK scheduler (a <code>ForkJoinPool</code>, one carrier per core by default) <b>mounts</b> a runnable virtual thread on a carrier. When the virtual thread blocks on a socket, a lock or <code>sleep</code>, its continuation <b>yields</b>: frames are copied to the heap, the carrier is freed. When the I/O is ready, the thread is rescheduled, possibly on another carrier. <b>Pinning</b> (Java 21: blocking inside <code>synchronized</code>, or in native code) keeps the carrier blocked too.',
    hook: '“Should I pool virtual threads?” No. They are cheap, disposable and meant to be created per task. Limit the scarce resource (DB connections, a partner’s rate limit) with a <code>Semaphore</code> or the resource’s own pool.',
    facts: [
      { v: 'Java 21', l: 'virtual threads are final (JEP 444, previewed in 19 and 20). Structured concurrency (JEP 453) and scoped values (JEP 446) are still <b>preview</b> in 21' },
      { v: '#cores', l: 'carrier threads by default (<code>jdk.virtualThreadScheduler.parallelism</code>). Millions of virtual threads can share them' },
      { v: 'JDK 24', l: '(JEP 491) lets virtual threads unmount inside <code>synchronized</code>, removing most pinning. Native frames and foreign-function calls still pin' }
    ]
  },
  intro: {
    what: 'A classic Java thread is a wrapper around an operating-system thread. The OS can only handle a few thousand of them comfortably, so a web server keeps a pool of, say, 200, and the 201st concurrent request waits. Most of the time those threads are just <b>waiting</b>: for the database, for an HTTP call. A <b>virtual thread</b> is a thread managed by the JVM instead of the OS. While it waits, it takes up no OS thread at all, only a bit of heap. So you can have one per request, or one per task, by the hundred thousand, and still write plain, blocking, easy-to-debug code.',
    analogy: { icon: '🧑‍🍳', title: 'Chefs and recipe cards', text: 'Carrier threads are the few chefs in a kitchen; virtual threads are recipe cards. A chef works on one card until it says “bake for 40 minutes”. Instead of standing at the oven, the chef clips the card to the oven door (unmount) and picks up the next card. When the timer rings, any free chef takes that card and carries on. Pinning is a card that says “hold this pan and don’t let go”: the chef is stuck at the oven, and with only a few chefs, the whole kitchen slows down.' },
    steps: [
      { t: 'Create one per task', d: 'No pool sizing: each task gets a fresh virtual thread.', code: 'try (var ex = Executors.newVirtualThreadPerTaskExecutor()) {\n    for (var id : ids) ex.submit(() -> fetch(id));   // blocking calls are fine\n}   // close() waits for all tasks' },
      { t: 'Write ordinary blocking code', d: 'JDBC, <code>HttpClient.send</code>, <code>Thread.sleep</code>, <code>BlockingQueue.take</code>: the JDK makes them unmount instead of blocking the carrier.' },
      { t: 'Avoid pinning on Java 21', d: 'Don’t block inside <code>synchronized</code>; use <code>ReentrantLock</code>. Find pinning with JFR (<code>jdk.VirtualThreadPinned</code>).', code: 'private final ReentrantLock lock = new ReentrantLock();\nlock.lock();\ntry { return client.call(); } finally { lock.unlock(); }' },
      { t: 'Bound what is actually scarce', d: 'Virtual threads remove the thread limit, not the database’s limit. Keep connection pools, rate limiters and semaphores.' }
    ],
    terms: [
      ['virtual thread', 'A <code>java.lang.Thread</code> implemented by the JVM, not 1:1 with an OS thread. Always a daemon thread.'],
      ['carrier thread', 'A platform thread from the virtual-thread scheduler that a virtual thread is currently running on.'],
      ['mount / unmount', 'Attaching a virtual thread’s stack to a carrier to run it / saving it to the heap when it blocks.'],
      ['continuation', 'The JDK-internal object holding a virtual thread’s frames, which can yield and be resumed later.'],
      ['pinning', 'A virtual thread that blocks but can’t unmount, so its carrier is blocked too.'],
      ['structured concurrency', 'Treating a group of subtasks as one unit with a scope: they finish, fail or are cancelled together (<code>StructuredTaskScope</code>, preview in 21).']
    ]
  },
  visual: {
    title: 'Watch virtual threads mount, unmount and get pinned',
    caption: 'Pick a scenario and press Play or Step. Two <b>carrier</b> threads run whichever virtual thread is <b>mounted</b>; the others wait in the scheduler’s run queue or are <b>parked</b> with their stack on the heap while I/O is pending. In <b>pinning</b>, switch between JDK 21 and JDK 24+ behaviour. <b>structured concurrency</b> shows a scope cancelling its sibling when one subtask fails.'
  },
  gotchas: [
    { trap: 'Blocking inside <code>synchronized</code> pins the carrier (Java 21–23)', code: `synchronized (this) {
    return http.send(req, ofString());   // virtual thread can't unmount: carrier blocked
}`, why: 'Before JDK 24, a monitor’s owner was tracked by the carrier’s identity, so a virtual thread holding or waiting on a monitor couldn’t leave its carrier. The scheduler doesn’t add carriers to compensate. With 8 carriers, 8 pinned threads stall every other virtual thread.', fix: 'Use <code>ReentrantLock</code> around blocking work, keep <code>synchronized</code> sections short and CPU-only, upgrade libraries that pin (many JDBC drivers and pools have), or move to JDK 24+.' },
    { trap: 'Pooling virtual threads', code: `Executors.newFixedThreadPool(200, Thread.ofVirtual().factory());   // ✗ the worst of both`, why: 'Virtual threads are cheap to create; a pool of them adds a queue and a cap but saves nothing. Pooling also defeats the point: concurrency is limited again by an arbitrary number.', fix: '<code>Executors.newVirtualThreadPerTaskExecutor()</code>, one thread per task. If you need a limit, it is a limit on a <i>resource</i>: use a <code>Semaphore</code>.' },
    { trap: 'Expecting a speed-up for CPU-bound work', why: 'Virtual threads run on as many carriers as there are cores. They make <i>waiting</i> cheap; they don’t create CPU. A CPU-bound job runs no faster, and very long computations can hog carriers, because the scheduler isn’t time-sliced.', fix: 'Use a fixed-size platform pool (or parallel streams / ForkJoin) for CPU work, and virtual threads for I/O-bound tasks.' },
    { trap: 'Removing the thread cap moves the bottleneck downstream', why: 'With 200 Tomcat threads, at most 200 requests reached the database. With virtual threads, 5,000 can. They queue on a 10-connection Hikari pool and time out, or overwhelm a partner API.', fix: 'Keep the connection pool as the limiter and set <code>connectionTimeout</code>. Add semaphores or rate limiters in front of fragile dependencies. Load-test after enabling virtual threads.' },
    { trap: 'ThreadLocal caches multiply by a million', code: `static final ThreadLocal<byte[]> BUF = ThreadLocal.withInitial(() -> new byte[64 * 1024]);
// 1 per pooled thread was 200 × 64 KB; 1 per virtual thread is 1,000,000 × 64 KB`, why: 'ThreadLocals work on virtual threads, but each thread gets its own copy. The “one per thread” caching trick assumed few, long-lived threads.', fix: 'Don’t cache expensive objects in ThreadLocals; share immutable ones (<code>DateTimeFormatter</code> instead of <code>SimpleDateFormat</code>). For request context, scoped values (preview in 21) are the intended replacement.' },
    { trap: 'Native calls and some file I/O still hold the carrier', why: 'A virtual thread can’t unmount with a native frame on its stack (JNI, FFM downcalls), even on JDK 24+. Many file-system operations block the OS thread; the JDK compensates by temporarily adding carriers, which works but isn’t free.', fix: 'Expect file-heavy or native-heavy workloads to benefit less. Watch JFR’s <code>jdk.VirtualThreadPinned</code> and carrier counts.' }
  ],
  scenarios: [
    { title: 'Throughput collapsed after enabling virtual threads in Spring Boot',
      symptom: 'After setting <code>spring.threads.virtual.enabled=true</code> (Boot 3.2, Java 21), throughput fell sharply under load and some requests hung for seconds, although CPU was low.',
      diagnose: `# record pinning events for 60 s
jcmd <pid> JFR.start duration=60s filename=pin.jfr
jfr print --events jdk.VirtualThreadPinned pin.jfr | head -40
#   duration = 812 ms
#   stackTrace = [ ... java.lang.Object.wait / socketRead ...
#     com.legacy.SoapClient.call(...)   line: 88   ← inside synchronized
# (Java 21–23: -Djdk.tracePinnedThreads=full also prints stacks)`,
      cause: 'A legacy SOAP client made its HTTP call inside a <code>synchronized</code> method. On Java 21 each such call pinned a carrier for the whole network round-trip. With 8 carriers, 8 slow calls blocked every virtual thread in the JVM.',
      fix: 'Replace the monitor with a <code>ReentrantLock</code> (or remove the lock: the client was thread-safe), upgrade libraries known to pin, or move to JDK 24+, where JEP 491 removes this kind of pinning.',
      fixCode: `private final ReentrantLock lock = new ReentrantLock();

Response call(Request r) {
    lock.lock();                       // parks the virtual thread, doesn't pin
    try { return transport.send(r); }
    finally { lock.unlock(); }
}` },
    { title: '“Connection is not available, request timed out after 30000ms”',
      symptom: 'The same release that enabled virtual threads started throwing <code>SQLTransientConnectionException</code> from HikariCP at peak, and the database CPU hit 100%.',
      diagnose: `# Hikari metrics
hikaricp.connections.active   10 / 10
hikaricp.connections.pending  3,400
# before: Tomcat max 200 threads capped concurrent DB work at 200 → now uncapped`,
      cause: 'The platform-thread pool had been an accidental concurrency limit. With virtual threads, thousands of requests reached the data layer at once and waited for 10 connections; slow queries made the wait exceed the 30 s timeout.',
      fix: 'Decide the limit deliberately: keep the pool small (it protects the database), lower <code>connectionTimeout</code> to fail fast, and put a semaphore in front of expensive endpoints. Fix the slow queries the flood exposed.',
      fixCode: `@Component
class ReportGate {
    private final Semaphore permits = new Semaphore(20);     // at most 20 heavy reports at once

    <T> T run(Callable<T> work) throws Exception {
        if (!permits.tryAcquire(2, TimeUnit.SECONDS)) throw new TooBusyException();
        try { return work.call(); } finally { permits.release(); }
    }
}` },
    { title: 'Heap grows by gigabytes in a fan-out batch job',
      symptom: 'A job that fans out to 500,000 virtual threads runs out of heap, although each task handles a tiny record.',
      diagnose: `jcmd <pid> GC.class_histogram | head
#  num   #instances   #bytes   class name
#    1:     500,214  32.7 GB   [B        ← byte arrays
# heap dump: retained by ThreadLocal$ThreadLocalMap entries of VirtualThread objects`,
      cause: 'A serialisation library cached a 64 KB buffer per thread in a <code>ThreadLocal</code>. That was harmless with a 16-thread pool; with half a million live virtual threads it was half a million buffers.',
      fix: 'Bound how many tasks are in flight (a semaphore or batches), and configure the library to use a shared buffer pool. Treat ThreadLocal caching as incompatible with thread-per-task.' }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] a) {
        Thread vt = Thread.ofVirtual().name("v1").unstarted(() -> { });
        System.out.println(vt.isVirtual() + " " + vt.isDaemon() + " " + vt.getName());
        try {
            vt.setDaemon(false);
        } catch (IllegalArgumentException e) {
            System.out.println("always daemon");
        }
    }
}`, options: ['true false v1', 'true true v1, then always daemon', 'true true v1', 'false true v1, then always daemon'], answer: 1, run: true, expect: 'true true v1\nalways daemon', explain: 'Virtual threads are <b>always daemon threads</b>: the JVM doesn’t wait for them at exit, and <code>setDaemon(false)</code> throws <code>IllegalArgumentException</code>. Their priority is also fixed. That is why you wait for them explicitly (<code>join</code>, or an executor’s <code>close()</code>).' },
    { kind: 'predict', q: 'Ten thousand tasks, each sleeping 10 ms. What is printed?', code: `import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

public class Main {
    public static void main(String[] a) {
        AtomicInteger n = new AtomicInteger();
        try (var ex = Executors.newVirtualThreadPerTaskExecutor()) {
            for (int i = 0; i < 10_000; i++)
                ex.submit(() -> { Thread.sleep(10); return n.incrementAndGet(); });
        }
        System.out.println(n.get());
    }
}`, options: ['0', 'A number below 10000', '10000', 'OutOfMemoryError: unable to create native thread'], answer: 2, run: true, expect: '10000', explain: '<code>close()</code> (Java 19+) waits for every submitted task, so all 10,000 increments happen before the print: <b>10000</b>. Each sleeping virtual thread is unmounted, so this takes a fraction of a second on a few carriers. With 10,000 platform threads it would still work on most machines, but with far more memory and scheduling cost.' },
    { kind: 'predict', q: 'What is the name of a thread from <code>newVirtualThreadPerTaskExecutor()</code>?', code: `import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) throws Exception {
        try (var ex = Executors.newVirtualThreadPerTaskExecutor()) {
            Future<String> f = ex.submit(() ->
                "[" + Thread.currentThread().getName() + "] " + Thread.currentThread().isVirtual());
            System.out.println(f.get());
        }
    }
}`, options: ['[pool-1-thread-1] true', '[] true', '[ForkJoinPool-1-worker-1] true', '[virtual-1] false'], answer: 1, run: true, expect: '[] true', explain: 'Virtual threads created by that executor have <b>no name</b> (the empty string), so name-based log patterns show nothing. Use <code>Thread.ofVirtual().name("worker-", 0).factory()</code> with <code>Executors.newThreadPerTaskExecutor(factory)</code> if you want names. The carrier (ForkJoinPool-1-worker-N) shows up only in <code>toString()</code>.' },
    { kind: 'concept', q: 'Java 21, 4 carriers. Four virtual threads each enter a <code>synchronized</code> block and make a 2-second HTTP call inside it. What happens to the 1,000 other runnable virtual threads?', options: ['Nothing; they run on the other carriers', 'They wait: all 4 carriers are pinned for 2 s', 'The scheduler adds 4 carriers to compensate', 'The pinned threads are unmounted after a timeout'], answer: 1, explain: 'Blocking while holding a monitor pins the virtual thread to its carrier on Java 21–23, and the scheduler doesn’t compensate for pinning. With every carrier pinned, no other virtual thread can run. JDK 24 (JEP 491) fixed this for <code>synchronized</code>; on 21, use <code>ReentrantLock</code>.' },
    { kind: 'concept', q: 'You enable virtual threads for an image-resizing service that is 95% CPU-bound. Throughput will most likely:', options: ['Increase roughly in proportion to the number of virtual threads', 'Stay about the same', 'Double, because carriers never block', 'Drop to zero because of pinning'], answer: 1, explain: 'Virtual threads multiplex onto about one carrier per core. They help when threads spend time <b>waiting</b>. CPU-bound work is limited by cores either way, so expect about the same throughput (sometimes slightly worse). Use a fixed platform pool sized to the cores.' },
    { kind: 'concept', q: 'On JDK 24+, which of these can still pin a virtual thread?', options: ['Blocking inside a synchronized method', 'Object.wait() inside synchronized', 'Blocking while a native (JNI) or foreign-function frame is on the stack', 'ReentrantLock.lock() under contention'], answer: 2, explain: 'JEP 491 (JDK 24) made monitors virtual-thread friendly: a virtual thread can now unmount while blocked entering, holding or waiting on a monitor. A <b>native frame</b> on the stack still prevents unmounting. <code>ReentrantLock</code> never pinned.' },
    { kind: 'concept', q: 'With <code>StructuredTaskScope.ShutdownOnFailure</code> (Java 21 preview), you fork <code>findUser</code> and <code>fetchOrders</code>. <code>fetchOrders</code> throws after 50 ms; <code>findUser</code> would take 2 s. What does <code>scope.join().throwIfFailed()</code> do?', options: ['Waits 2 s for findUser, then throws', 'Shuts the scope down at 50 ms, interrupts findUser, and throws ExecutionException', 'Returns normally; you must check each subtask', 'Throws immediately without stopping findUser'], answer: 1, explain: 'The first failure shuts the scope down, which <b>interrupts</b> the remaining subtasks; <code>join()</code> returns once they have finished, and <code>throwIfFailed()</code> throws an <code>ExecutionException</code> with the cause. No orphaned work outlives the scope. (The API changed in later previews; in JDK 25 you write <code>StructuredTaskScope.open()</code> with a Joiner.)' },
    { kind: 'concept', q: 'A virtual thread calls <code>socket.getInputStream().read()</code> and no data has arrived. What happens under the hood?', options: ['The carrier thread blocks in the kernel read()', 'The read is registered with an I/O poller, the virtual thread parks and unmounts, and the carrier runs another virtual thread', 'The JVM spins until data arrives', 'An exception is thrown because virtual threads can’t block'], answer: 1, explain: 'The JDK’s socket implementation puts the socket in non-blocking mode, registers interest with a poller (epoll/kqueue/IOCP) and parks the virtual thread, which unmounts. When the poller sees data, it unparks the thread, which is scheduled onto any free carrier and retries the read.' }
  ],
  interview: [
    { q: 'How are virtual threads implemented?', a: '<p>A virtual thread is a <code>Thread</code> whose code runs inside a JDK-internal <b>continuation</b>. A scheduler (a FIFO-mode <code>ForkJoinPool</code> with parallelism = cores by default) mounts it on a carrier platform thread. When it hits a blocking operation that the JDK has adapted (sockets, <code>LockSupport.park</code> and everything built on it, <code>sleep</code>), the continuation <b>yields</b>: its frames are copied into heap “stack chunk” objects and the carrier becomes free. Unparking resubmits the thread to the scheduler; on resume, frames are copied back lazily.</p>', lvl: 'core' },
    { q: 'What is pinning, and what causes it?', a: '<p>A virtual thread that blocks while it can’t unmount, so its carrier is blocked too. On Java 21–23: blocking while inside a <code>synchronized</code> block or method (or in <code>Object.wait</code>), and blocking with a native method or foreign function on the stack. Detect it with the JFR event <code>jdk.VirtualThreadPinned</code> (recorded when pinned longer than 20 ms by default) or <code>-Djdk.tracePinnedThreads</code> (21–23). JDK 24’s JEP 491 removed the <code>synchronized</code> cases.</p>', fu: 'Why is short pinning OK? (A few microseconds of CPU work under a monitor costs nothing; it is blocking while pinned that hurts.)', lvl: 'core' },
    { q: 'When should you not use virtual threads?', a: '<ul><li>CPU-bound work: no benefit; use a core-sized pool.</li><li>Code that blocks inside <code>synchronized</code> on Java 21–23, or calls native code a lot.</li><li>When you rely on ThreadLocal caching of expensive objects.</li><li>When you need thread priorities, or a non-daemon thread keeping the JVM alive.</li><li>Already non-blocking, reactive pipelines that work well: there is little to gain from rewriting them.</li></ul>', lvl: 'core' },
    { q: 'Virtual threads vs reactive programming (WebFlux, Reactor)?', a: '<p>Both aim to use few OS threads for many concurrent waits. Reactive does it with non-blocking APIs and operator chains; virtual threads let you keep blocking, imperative code and still scale. Virtual threads give readable stack traces, normal debugging, and ordinary exception handling and try/finally. Reactive still offers back-pressure as a first-class concept and streaming operators. For typical request/response services on Java 21, virtual threads are usually simpler.</p>', lvl: 'deep' },
    { q: 'How do you enable virtual threads in Spring Boot?', a: '<p>Boot 3.2+ on Java 21: <code>spring.threads.virtual.enabled=true</code>. Tomcat/Jetty then run each request on a virtual thread, and the auto-configured <code>applicationTaskExecutor</code> (for <code>@Async</code>) and the task scheduler use virtual threads too. Custom executor beans you define are unaffected. Boot also recommends <code>spring.main.keep-alive=true</code> if nothing else keeps the JVM alive, since virtual threads are daemon threads.</p>', lvl: 'core' },
    { q: 'Should you pool virtual threads? How do you limit concurrency?', a: '<p>Don’t pool them; create one per task. Pools exist to amortise expensive threads and to cap concurrency. Virtual threads are cheap, and the cap belongs on the resource: a <code>Semaphore</code> with N permits around calls to a fragile partner, the DB connection pool for the database, a rate limiter for an API with quotas.</p>', lvl: 'core' },
    { q: 'What is structured concurrency?', a: '<p>Subtasks are started inside a <b>scope</b> and must finish before the scope closes, like a block for concurrent code. A failure policy (<code>ShutdownOnFailure</code>: cancel the rest on first failure; <code>ShutdownOnSuccess</code>: take the first success) handles cancellation, and thread dumps show the parent/child tree. In Java 21 it is <code>StructuredTaskScope</code>, a preview API (<code>--enable-preview</code>, JEP 453). It stayed in preview in later releases, and the API was reshaped (JDK 25 uses <code>StructuredTaskScope.open(Joiner)</code>).</p>', lvl: 'deep' },
    { q: 'What are scoped values, and why are they better than ThreadLocal for virtual threads?', a: '<p>A <code>ScopedValue</code> binds a value for the dynamic extent of a call: <code>ScopedValue.where(USER, u).run(() -&gt; handle())</code>. It is immutable, automatically unbound when the scope ends (no leaks across reused threads), cheap to inherit by child threads in a structured scope, and doesn’t need a per-thread mutable map. Preview in Java 21 (JEP 446); finalised in a later release (JDK 25).</p>', lvl: 'deep' },
    { q: 'How do you see virtual threads in a thread dump?', a: '<p><code>jstack</code> and <code>jcmd Thread.print</code> show platform threads, including carriers, but not unmounted virtual threads. Use <code>jcmd &lt;pid&gt; Thread.dump_to_file -format=json dump.json</code> (or plain text), which includes virtual threads grouped by their executor or structured scope. JFR has <code>jdk.VirtualThreadStart</code>/<code>End</code> (off by default), <code>jdk.VirtualThreadPinned</code> and <code>jdk.VirtualThreadSubmitFailed</code>.</p>', lvl: 'deep' },
    { q: 'Does a long CPU loop in a virtual thread starve others?', a: '<p>It can. The scheduler isn’t time-sliced: a virtual thread runs until it blocks or finishes. With N carriers, N virtual threads computing for a long time keep everything else waiting. Keep CPU-heavy work on a platform pool, or break it into smaller tasks.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Spring Boot 3.2+ on Java 21', lang: 'yaml', code: `spring:
  threads:
    virtual:
      enabled: true          # Tomcat requests, @Async, @Scheduled on virtual threads
  main:
    keep-alive: true         # virtual threads are daemons; keep the JVM up
  datasource:
    hikari:
      maximum-pool-size: 20  # still the real limit on DB concurrency
      connection-timeout: 2000   # fail fast instead of piling up waiters

# JFR, to catch pinning in staging (Java 21–23):
# JAVA_TOOL_OPTIONS=-XX:StartFlightRecording=settings=profile,filename=app.jfr`, note: 'After enabling, load-test the downstream systems: the thread pool used to limit concurrency for free.' },
    { title: 'Fan-out with a resource limit', lang: 'java', code: `record Enriched(Customer c, CreditScore s) {}

List<Enriched> enrich(List<Customer> customers) throws InterruptedException {
    Semaphore bureau = new Semaphore(25);                     // partner allows 25 in flight
    try (var ex = Executors.newVirtualThreadPerTaskExecutor()) {
        List<Future<Enriched>> fs = customers.stream()
            .map(c -> ex.submit(() -> {
                bureau.acquire();                             // parks the virtual thread, cheap
                try { return new Enriched(c, creditBureau.score(c.id())); }   // plain blocking call
                finally { bureau.release(); }
            }))
            .toList();
        List<Enriched> out = new ArrayList<>();
        for (var f : fs) {
            try { out.add(f.get()); }
            catch (ExecutionException e) { log.warn("score failed", e.getCause()); }
        }
        return out;
    }   // close() waits for stragglers
}` },
    { title: 'Structured concurrency (Java 21 preview)', lang: 'java', code: `// javac --release 21 --enable-preview …   (API as of JDK 21; reshaped in later previews)
Page load(long userId) throws InterruptedException, ExecutionException {
    try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
        StructuredTaskScope.Subtask<User> user = scope.fork(() -> users.find(userId));
        StructuredTaskScope.Subtask<List<Order>> orders = scope.fork(() -> orders.recent(userId));

        scope.join()              // wait for both, or for the first failure
             .throwIfFailed();    // a failure cancels (interrupts) the sibling

        return new Page(user.get(), orders.get());
    }                             // no subtask can outlive this block
}`, note: 'Thread dumps in JSON format show the scope as the parent of both subtasks.' }
  ]
});

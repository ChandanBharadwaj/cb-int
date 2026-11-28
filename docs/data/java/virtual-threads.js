IA.register({
  track: 'java',
  slug: 'virtual-threads',
  title: 'Virtual threads (Java 21)',
  tagline: 'A virtual thread is a <b>Java object with a stack</b>. A few real OS-backed threads (<i>carriers</i>) run it. When it waits on I/O, it steps off its carrier (<b>unmounts</b>). Its stack moves to the heap, and the carrier runs someone else. So waiting is cheap, and one thread per request scales to millions. The catch: a thread can get stuck to its carrier (<b>pinned</b>).',
  tldr: {
    problem: 'Platform threads are costly: each one is an OS thread. So servers cap them at a few hundred and use async callbacks to scale. You lose simple blocking code. You get callback chains, lost stack traces and ThreadLocal headaches.',
    model: 'The JDK scheduler is a <code>ForkJoinPool</code> with one carrier per core. It puts a ready virtual thread on a carrier (<b>mounts</b> it). When the thread waits on a socket, a lock or <code>sleep</code>, it <b>yields</b>. Its frames are copied to the heap, and the carrier is free. When the I/O is ready, the thread is scheduled again, maybe on another carrier. <b>Pinning</b> keeps the carrier blocked too. On Java 21 that happens when you block inside <code>synchronized</code> or in native code.',
    hook: '“Should I pool virtual threads?” No. They are cheap and made to be created per task. Limit the scarce thing (DB connections, a partner’s rate limit) with a <code>Semaphore</code> or that resource’s own pool.',
    facts: [
      { v: 'Java 21', l: 'virtual threads are final (previewed in 19 and 20). Scoped values became final in 25 (JEP 506). Structured concurrency is still <b>preview</b> (sixth preview in 26)' },
      { v: '#cores', l: 'carrier threads by default (<code>jdk.virtualThreadScheduler.parallelism</code>). Millions of virtual threads can share them' },
      { v: 'JDK 24', l: 'lets virtual threads unmount inside <code>synchronized</code>, which removes most pinning. Native code and foreign-function calls still pin' }
    ]
  },
  intro: {
    what: 'A classic Java thread wraps an operating-system thread. The OS handles a few thousand of them at most. So a web server keeps a pool of, say, 200. Request 201 has to wait. Most of the time those threads are <b>waiting</b>: for the database, for an HTTP call. A <b>virtual thread</b> is run by the JVM, not the OS. While it waits, it uses no OS thread, only a bit of heap. So you can have one per request or per task, by the hundred thousand. And you still write plain, easy-to-debug code.',
    analogy: { icon: '🧑‍🍳', title: 'Chefs and recipe cards', text: 'Carrier threads are the few chefs in a kitchen. Virtual threads are recipe cards. A chef works on one card until it says “bake for 40 minutes”. The chef doesn’t stand at the oven. They clip the card to the oven door (unmount) and pick up the next card. When the timer rings, any free chef takes that card and carries on. Pinning is a card that says “hold this pan and don’t let go”. The chef is stuck at the oven. With only a few chefs, the whole kitchen slows down.' },
    steps: [
      { t: 'Create one per task', d: 'No pool sizing: each task gets a fresh virtual thread.', code: 'try (var ex = Executors.newVirtualThreadPerTaskExecutor()) {\n    for (var id : ids) ex.submit(() -> fetch(id));   // blocking calls are fine\n}   // close() waits for all tasks' },
      { t: 'Write ordinary blocking code', d: 'JDBC, <code>HttpClient.send</code>, <code>Thread.sleep</code>, <code>BlockingQueue.take</code>. The JDK makes them unmount instead of blocking the carrier.' },
      { t: 'Avoid pinning on Java 21', d: 'Don’t block inside <code>synchronized</code>; use <code>ReentrantLock</code>. Find pinning with JFR (<code>jdk.VirtualThreadPinned</code>).', code: 'private final ReentrantLock lock = new ReentrantLock();\nlock.lock();\ntry { return client.call(); } finally { lock.unlock(); }' },
      { t: 'Bound what is actually scarce', d: 'Virtual threads remove the thread limit, not the database’s limit. Keep connection pools, rate limiters and semaphores.' }
    ],
    terms: [
      ['virtual thread', 'A <code>java.lang.Thread</code> run by the JVM, without its own OS thread. Always a daemon thread.'],
      ['carrier thread', 'The real (platform) thread a virtual thread is running on right now.'],
      ['mount / unmount', 'Putting a virtual thread’s stack on a carrier to run it / moving it to the heap when it waits.'],
      ['continuation', 'The JDK object that holds a virtual thread’s frames. It can pause and resume later.'],
      ['pinning', 'A virtual thread that blocks but can’t unmount, so its carrier is blocked too.'],
      ['structured concurrency', 'Treating a group of subtasks as one unit, inside a scope. They finish, fail or are cancelled together (<code>StructuredTaskScope</code>, a preview API in 21 and still a preview in 25 and 26).']
    ]
  },
  visual: {
    title: 'Watch virtual threads mount, unmount and get pinned',
    caption: 'Pick a scenario and press Play or Step. Two <b>carrier</b> threads run whichever virtual thread is <b>mounted</b>. The others wait in the run queue, or sleep (<b>parked</b>) with their stack on the heap while I/O is pending. In <b>pinning</b>, switch between JDK 21 and JDK 24+ behaviour. <b>structured concurrency</b> shows a scope cancelling its sibling when one subtask fails.'
  },
  gotchas: [
    { trap: 'Blocking inside <code>synchronized</code> pins the carrier (Java 21–23)', code: `synchronized (this) {
    return http.send(req, ofString());   // virtual thread can't unmount: carrier blocked
}`, why: 'Before JDK 24, a lock’s owner was tracked by the carrier. So a virtual thread holding or waiting on a <code>synchronized</code> lock couldn’t leave its carrier. The scheduler doesn’t add carriers to make up for it. With 8 carriers, 8 pinned threads stall every other virtual thread.', fix: 'Use <code>ReentrantLock</code> around blocking work. Keep <code>synchronized</code> blocks short and CPU-only. Upgrade libraries that pin (many JDBC drivers and pools have fixed it). Or move to JDK 24+.' },
    { trap: 'Pooling virtual threads', code: `Executors.newFixedThreadPool(200, Thread.ofVirtual().factory());   // ✗ the worst of both`, why: 'Virtual threads are cheap to create. A pool adds a queue and a cap but saves nothing. It also defeats the point: you are back to a random limit on how much runs at once.', fix: '<code>Executors.newVirtualThreadPerTaskExecutor()</code>, one thread per task. If you need a limit, it is a limit on a <i>resource</i>: use a <code>Semaphore</code>.' },
    { trap: 'Expecting a speed-up for CPU-bound work', why: 'Virtual threads run on one carrier per core. They make <i>waiting</i> cheap. They don’t add CPU. A CPU-heavy job runs no faster. Long computations can hog carriers, because the scheduler never takes a running thread off.', fix: 'Use a fixed-size platform pool (or parallel streams / ForkJoin) for CPU work. Use virtual threads for tasks that wait on I/O.' },
    { trap: 'Removing the thread cap moves the bottleneck downstream', why: 'With 200 Tomcat threads, at most 200 requests reached the database. With virtual threads, 5,000 can. They queue on a 10-connection Hikari pool and time out. Or they flood a partner API.', fix: 'Let the connection pool be the limit, and set <code>connectionTimeout</code>. Put semaphores or rate limiters in front of fragile services. Load-test after turning on virtual threads.' },
    { trap: 'ThreadLocal caches multiply by a million', code: `static final ThreadLocal<byte[]> BUF = ThreadLocal.withInitial(() -> new byte[64 * 1024]);
// 1 per pooled thread was 200 × 64 KB; 1 per virtual thread is 1,000,000 × 64 KB`, why: 'ThreadLocals work on virtual threads, but each thread gets its own copy. The “one per thread” cache trick assumed few, long-lived threads.', fix: 'Don’t cache costly objects in ThreadLocals. Share ones that never change (<code>DateTimeFormatter</code> instead of <code>SimpleDateFormat</code>). For request context, scoped values are the replacement (final in Java 25, JEP 506; preview in 21).' },
    { trap: 'Native calls and some file I/O still hold the carrier', why: 'A virtual thread can’t unmount while native code is on its stack (JNI, FFM calls), even on JDK 24+. Many file operations block the OS thread. The JDK makes up for it by adding carriers for a while. That works, but isn’t free.', fix: 'Expect less gain for work heavy on files or native code. Watch JFR’s <code>jdk.VirtualThreadPinned</code> and the carrier count.' }
  ],
  scenarios: [
    { title: 'Throughput collapsed after enabling virtual threads in Spring Boot',
      symptom: 'After setting <code>spring.threads.virtual.enabled=true</code> (Boot 3.2, Java 21), throughput fell sharply under load. Some requests hung for seconds, though CPU was low.',
      diagnose: `# record pinning events for 60 s
jcmd <pid> JFR.start duration=60s filename=pin.jfr
jfr print --events jdk.VirtualThreadPinned pin.jfr | head -40
#   duration = 812 ms
#   stackTrace = [ ... java.lang.Object.wait / socketRead ...
#     com.legacy.SoapClient.call(...)   line: 88   ← inside synchronized
# (Java 21–23: -Djdk.tracePinnedThreads=full also prints stacks)`,
      cause: 'An old SOAP client made its HTTP call inside a <code>synchronized</code> method. On Java 21, each call pinned a carrier for the whole network trip. With 8 carriers, 8 slow calls blocked every virtual thread in the JVM.',
      fix: 'Replace <code>synchronized</code> with a <code>ReentrantLock</code>, or drop the lock (the client was thread-safe). Upgrade libraries known to pin. Or move to JDK 24+, which removes this kind of pinning.',
      fixCode: `private final ReentrantLock lock = new ReentrantLock();

Response call(Request r) {
    lock.lock();                       // parks the virtual thread, doesn't pin
    try { return transport.send(r); }
    finally { lock.unlock(); }
}` },
    { title: '“Connection is not available, request timed out after 30000ms”',
      symptom: 'The release that turned on virtual threads started throwing <code>SQLTransientConnectionException</code> from HikariCP at peak. Database CPU hit 100%.',
      diagnose: `# Hikari metrics
hikaricp.connections.active   10 / 10
hikaricp.connections.pending  3,400
# before: Tomcat max 200 threads capped concurrent DB work at 200 → now uncapped`,
      cause: 'The old thread pool had been a limit by accident. With virtual threads, thousands of requests hit the data layer at once and waited for 10 connections. Slow queries pushed the wait past the 30 s timeout.',
      fix: 'Pick the limit on purpose. Keep the pool small: it protects the database. Lower <code>connectionTimeout</code> to fail fast. Put a semaphore in front of costly endpoints. Fix the slow queries the flood exposed.',
      fixCode: `@Component
class ReportGate {
    private final Semaphore permits = new Semaphore(20);     // at most 20 heavy reports at once

    <T> T run(Callable<T> work) throws Exception {
        if (!permits.tryAcquire(2, TimeUnit.SECONDS)) throw new TooBusyException();
        try { return work.call(); } finally { permits.release(); }
    }
}` },
    { title: 'Heap grows by gigabytes in a fan-out batch job',
      symptom: 'A job that starts 500,000 virtual threads runs out of heap, though each task handles a tiny record.',
      diagnose: `jcmd <pid> GC.class_histogram | head
#  num   #instances   #bytes   class name
#    1:     500,214  32.7 GB   [B        ← byte arrays
# heap dump: retained by ThreadLocal$ThreadLocalMap entries of VirtualThread objects`,
      cause: 'A serialisation library cached a 64 KB buffer per thread in a <code>ThreadLocal</code>. With a 16-thread pool, that was harmless. With half a million virtual threads, it was half a million buffers.',
      fix: 'Limit how many tasks run at once (a semaphore or batches). Set the library to use a shared buffer pool. ThreadLocal caching doesn’t mix with one thread per task.' }
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
}`, options: ['true false v1', 'true true v1, then always daemon', 'true true v1', 'false true v1, then always daemon'], answer: 1, run: true, expect: 'true true v1\nalways daemon', explain: 'Virtual threads are <b>always daemon threads</b>. The JVM doesn’t wait for them at exit, and <code>setDaemon(false)</code> throws <code>IllegalArgumentException</code>. Their priority is fixed too. So you wait for them yourself (<code>join</code>, or an executor’s <code>close()</code>).' },
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
}`, options: ['0', 'A number below 10000', '10000', 'OutOfMemoryError: unable to create native thread'], answer: 2, run: true, expect: '10000', explain: '<code>close()</code> (Java 19+) waits for every task. So all 10,000 increments happen before the print: <b>10000</b>. Each sleeping virtual thread is unmounted, so this takes a fraction of a second on a few carriers. 10,000 platform threads would still work on most machines, but cost far more memory and switching.' },
    { kind: 'predict', q: 'What is the name of a thread from <code>newVirtualThreadPerTaskExecutor()</code>?', code: `import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) throws Exception {
        try (var ex = Executors.newVirtualThreadPerTaskExecutor()) {
            Future<String> f = ex.submit(() ->
                "[" + Thread.currentThread().getName() + "] " + Thread.currentThread().isVirtual());
            System.out.println(f.get());
        }
    }
}`, options: ['[pool-1-thread-1] true', '[] true', '[ForkJoinPool-1-worker-1] true', '[virtual-1] false'], answer: 1, run: true, expect: '[] true', explain: 'Virtual threads from that executor have <b>no name</b> (the empty string). Log patterns that print the name show nothing. Want names? Use <code>Thread.ofVirtual().name("worker-", 0).factory()</code> with <code>Executors.newThreadPerTaskExecutor(factory)</code>. The carrier (ForkJoinPool-1-worker-N) shows up only in <code>toString()</code>.' },
    { kind: 'concept', q: 'Java 21, 4 carriers. Four virtual threads each enter a <code>synchronized</code> block and make a 2-second HTTP call inside it. What happens to the 1,000 other runnable virtual threads?', options: ['Nothing; they run on the other carriers', 'They wait: all 4 carriers are pinned for 2 s', 'The scheduler adds 4 carriers to compensate', 'The pinned threads are unmounted after a timeout'], answer: 1, explain: 'On Java 21–23, blocking inside <code>synchronized</code> pins the virtual thread to its carrier. The scheduler doesn’t make up for it. With every carrier pinned, no other virtual thread can run. JDK 24 fixed this for <code>synchronized</code>. On 21, use <code>ReentrantLock</code>.' },
    { kind: 'concept', q: 'You enable virtual threads for an image-resizing service that is 95% CPU-bound. Throughput will most likely:', options: ['Increase roughly in proportion to the number of virtual threads', 'Stay about the same', 'Double, because carriers never block', 'Drop to zero because of pinning'], answer: 1, explain: 'Virtual threads share about one carrier per core. They help when threads spend time <b>waiting</b>. CPU work is limited by cores either way. So expect about the same throughput, sometimes a bit worse. Use a fixed platform pool sized to the cores.' },
    { kind: 'concept', q: 'On JDK 24+, which of these can still pin a virtual thread?', options: ['Blocking inside a synchronized method', 'Object.wait() inside synchronized', 'Blocking while a native (JNI) or foreign-function frame is on the stack', 'ReentrantLock.lock() under contention'], answer: 2, explain: 'JDK 24 made <code>synchronized</code> friendly to virtual threads. A virtual thread can now unmount while entering, holding or waiting on a monitor. A <b>native frame</b> on the stack still prevents unmounting. <code>ReentrantLock</code> never pinned.' },
    { kind: 'concept', q: 'With <code>StructuredTaskScope.ShutdownOnFailure</code> (Java 21 preview), you fork <code>findUser</code> and <code>fetchOrders</code>. <code>fetchOrders</code> throws after 50 ms; <code>findUser</code> would take 2 s. What does <code>scope.join().throwIfFailed()</code> do?', options: ['Waits 2 s for findUser, then throws', 'Shuts the scope down at 50 ms, interrupts findUser, and throws ExecutionException', 'Returns normally; you must check each subtask', 'Throws immediately without stopping findUser'], answer: 1, explain: 'The first failure shuts the scope down. That <b>interrupts</b> the other subtasks. <code>join()</code> returns as soon as the scope shuts down. (Closing the scope then waits for those subtasks to finish.) <code>throwIfFailed()</code> throws an <code>ExecutionException</code> with the cause. No leftover work outlives the scope. (The API changed in later previews; in JDK 25 you write <code>StructuredTaskScope.open()</code> with a Joiner.)' },
    { kind: 'concept', q: 'A virtual thread calls <code>socket.getInputStream().read()</code> and no data has arrived. What happens under the hood?', options: ['The carrier thread blocks in the kernel read()', 'The read is registered with an I/O poller, the virtual thread parks and unmounts, and the carrier runs another virtual thread', 'The JVM spins until data arrives', 'An exception is thrown because virtual threads can’t block'], answer: 1, explain: 'The JDK puts the socket in non-blocking mode. It asks a watcher (the poller: epoll/kqueue/IOCP) to report data, and parks the virtual thread, which unmounts. When the poller sees data, it wakes the thread. The thread goes onto any free carrier and retries the read.' }
  ],
  interview: [
    { q: 'How are virtual threads implemented?', a: '<p>A virtual thread is a <code>Thread</code> whose code runs inside a JDK object that can pause and resume (a <b>continuation</b>). A scheduler mounts it on a carrier thread. The scheduler is a <code>ForkJoinPool</code> with one thread per core by default. When the thread hits a waiting call the JDK has adapted (sockets, <code>LockSupport.park</code> and all built on it, <code>sleep</code>), it <b>yields</b>. Its frames are copied into “stack chunk” objects on the heap, and the carrier is free. Waking puts the thread back in the scheduler’s queue. On resume, frames are copied back as needed.</p>', lvl: 'core' },
    { q: 'What is pinning, and what causes it?', a: '<p>A virtual thread that waits while it can’t unmount, so its carrier waits too. On Java 21–23 the causes are: waiting inside a <code>synchronized</code> block or method (or in <code>Object.wait</code>), and waiting with native code or a foreign function on the stack. Find it with the JFR event <code>jdk.VirtualThreadPinned</code> (logged for pins over 20 ms by default). Or use <code>-Djdk.tracePinnedThreads</code> (21–23). JDK 24 removed the <code>synchronized</code> cases.</p>', fu: 'Why is short pinning OK? (A few microseconds of CPU work under a monitor costs nothing. Waiting while pinned is what hurts.)', lvl: 'core' },
    { q: 'When should you not use virtual threads?', a: '<ul><li>CPU-heavy work: no gain. Use a pool sized to the cores.</li><li>Code that waits inside <code>synchronized</code> on Java 21–23, or calls native code a lot.</li><li>Code that relies on ThreadLocal caches of costly objects.</li><li>When you need thread priorities, or a non-daemon thread to keep the JVM alive.</li><li>Reactive code that already works well: little to gain from a rewrite.</li></ul>', lvl: 'core' },
    { q: 'Virtual threads vs reactive programming (WebFlux, Reactor)?', a: '<p>Both use few OS threads for many waits at once. Reactive does it with non-blocking APIs and operator chains. Virtual threads let you keep plain, step-by-step blocking code and still scale. You get readable stack traces, normal debugging, and ordinary try/catch/finally. Reactive still has built-in back-pressure and streaming operators. For typical request/response services on Java 21, virtual threads are usually simpler.</p>', lvl: 'deep' },
    { q: 'How do you enable virtual threads in Spring Boot?', a: '<p>Boot 3.2+ on Java 21: <code>spring.threads.virtual.enabled=true</code>. Tomcat/Jetty then run each request on a virtual thread. The built-in <code>applicationTaskExecutor</code> (for <code>@Async</code>) and the task scheduler use them too. Your own executor beans don’t change. Virtual threads are daemon threads, so Boot suggests <code>spring.main.keep-alive=true</code> if nothing else keeps the JVM alive.</p>', lvl: 'core' },
    { q: 'Should you pool virtual threads? How do you limit concurrency?', a: '<p>Don’t pool them. Create one per task. Pools exist to reuse costly threads and to cap how many run. Virtual threads are cheap, so put the cap on the resource. Use a <code>Semaphore</code> with N permits around a fragile partner. Use the DB connection pool for the database. Use a rate limiter for an API with quotas.</p>', lvl: 'core' },
    { q: 'What is structured concurrency?', a: '<p>Subtasks start inside a <b>scope</b> and must finish before it closes. Think of a code block, but for concurrent work. A failure rule handles cancelling. <code>ShutdownOnFailure</code> cancels the rest on the first failure. <code>ShutdownOnSuccess</code> takes the first success. Thread dumps show the parent/child tree. In Java 21 it is <code>StructuredTaskScope</code>, a preview API (<code>--enable-preview</code>). It is still a preview in JDK 25 (fifth preview) and 26 (sixth), and the API changed: JDK 25 uses <code>StructuredTaskScope.open(Joiner)</code>.</p>', lvl: 'deep' },
    { q: 'What are scoped values, and why are they better than ThreadLocal for virtual threads?', a: '<p>A <code>ScopedValue</code> sets a value for the length of one call: <code>ScopedValue.where(USER, u).run(() -&gt; handle())</code>. It can’t be changed. It is cleared when the call ends, so nothing leaks to reused threads. Child threads in a structured scope get it cheaply. No per-thread map is needed. Preview in Java 21, final in JDK 25.</p>', lvl: 'deep' },
    { q: 'How do you see virtual threads in a thread dump?', a: '<p><code>jstack</code> and <code>jcmd Thread.print</code> show platform threads, carriers included. They don’t show unmounted virtual threads. Use <code>jcmd &lt;pid&gt; Thread.dump_to_file -format=json dump.json</code> (or plain text). It lists virtual threads grouped by executor or scope. JFR has <code>jdk.VirtualThreadStart</code>/<code>End</code> (off by default), <code>jdk.VirtualThreadPinned</code> and <code>jdk.VirtualThreadSubmitFailed</code>.</p>', lvl: 'deep' },
    { q: 'Does a long CPU loop in a virtual thread starve others?', a: '<p>It can. The scheduler never takes a running thread off. A virtual thread runs until it blocks or finishes. With N carriers, N virtual threads computing for a long time keep everything else waiting. Keep CPU-heavy work on a platform pool, or break it into smaller tasks.</p>', lvl: 'deep' }
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
# JAVA_TOOL_OPTIONS=-XX:StartFlightRecording=settings=profile,filename=app.jfr`, note: 'After turning it on, load-test the systems you call. The old thread pool used to limit traffic for free.' },
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

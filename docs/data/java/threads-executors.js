IA.register({
  track: 'java',
  slug: 'threads-executors',
  title: 'Threads & executors',
  tagline: 'A <code>ThreadPoolExecutor</code> is <b>a queue in front of a set of workers</b>, with a rule for what to do when both are full. It tries <i>core threads → queue → extra threads → reject</i>, in that order. Most pool bugs come from that order, a queue with no limit, or a shutdown nobody waited for.',
  tldr: {
    problem: 'Pools rarely fail loudly. They hide work in a queue with no limit until requests get very slow. They hide errors inside a <code>Future</code> nobody reads. They never grow past core size. Or they lose running tasks when the pod stops.',
    model: '<code>execute(task)</code>: if fewer than <b>core</b> threads, start one. Else <b>offer</b> the task to the queue. If the queue says no, start a thread, up to <b>max</b>. Else call the <b>RejectedExecutionHandler</b>. Workers loop on <code>queue.take()</code>. Threads above core exit after <code>keepAliveTime</code> with no work.',
    hook: '“I set core 10, max 100. Why do I never see more than 10 threads?” The queue has no limit. <code>offer()</code> always succeeds, so step 3 (grow to max) never runs.',
    facts: [
      { v: 'core → queue → max', l: 'the order <code>execute()</code> tries. Extra threads are only created when the queue is <b>full</b>' },
      { v: '6', l: 'thread states in <code>Thread.State</code>: NEW, RUNNABLE, BLOCKED, WAITING, TIMED_WAITING, TERMINATED' },
      { v: 'Java 19', l: '<code>ExecutorService</code> became <code>AutoCloseable</code>: <code>close()</code> calls <code>shutdown()</code> and waits for running and queued tasks to finish' }
    ]
  },
  intro: {
    what: 'A <b>thread</b> runs code on its own, side by side with other threads. Making one is costly: each is an OS thread with its own stack. So servers keep a set of ready threads (a <b>pool</b>) and hand them small jobs. An <b>executor</b> is that pool plus a <b>queue</b> of waiting jobs. You submit a task, and a free worker picks it up. When all workers are busy, tasks wait in the queue. When the queue is full too, the executor must say no.',
    analogy: { icon: '🍳', title: 'A restaurant kitchen', text: 'The core cooks are always on shift. Orders that come in while they are busy go on the ticket rail (the queue). If the rail fills up, the manager calls in extra cooks (up to max). They go home after a quiet spell (keepAlive). If the rail is full and every cook is in, the host turns guests away. Or asks them to cook it themselves (CallerRunsPolicy).' },
    steps: [
      { t: 'Never create a thread per request by hand', d: 'Use an <code>ExecutorService</code>. It reuses threads, caps how many run at once, and gives you one place to shut down.', code: 'ExecutorService pool = Executors.newFixedThreadPool(8);\nFuture<Report> f = pool.submit(() -> buildReport(id));\nReport r = f.get(5, TimeUnit.SECONDS);' },
      { t: 'Know the five knobs', d: 'Core size, max size, keepAlive, the queue (with or without a limit) and the rejection policy. The <code>Executors</code> helpers pick these for you, sometimes badly.' },
      { t: 'Decide what “full” means', d: 'Give the queue a limit and a rejection policy. Then overload becomes a visible error or slows the sender (<i>back-pressure</i>). Without them, memory and wait times grow forever.' },
      { t: 'Shut it down', d: 'Pool threads keep the JVM alive, so a forgotten pool stops your app from exiting. Call <code>shutdown()</code> then <code>awaitTermination()</code>. On Java 19+, use try-with-resources.' }
    ],
    terms: [
      ['platform thread', 'A Java thread that sits on its own OS thread. Costly to create. It has a fixed-size stack, often 1 MB on 64-bit Linux.'],
      ['corePoolSize', 'Threads the pool keeps even when idle (unless <code>allowCoreThreadTimeOut(true)</code>).'],
      ['maximumPoolSize', 'The most threads the pool may have. Only reached when the queue refuses a task.'],
      ['work queue', 'Where tasks wait for a worker. <code>ArrayBlockingQueue</code> has a limit. <code>LinkedBlockingQueue</code> has none by default. <code>SynchronousQueue</code> holds nothing.'],
      ['rejection policy', 'What happens when the pool is full or shut down: Abort (throw), CallerRuns, Discard, DiscardOldest.'],
      ['Future', 'A handle to a submitted task’s result or exception: <code>get()</code>, <code>cancel()</code>, <code>isDone()</code>.']
    ]
  },
  visual: {
    title: 'Watch tasks hit core threads, the queue, extra threads and the rejection policy',
    caption: 'Pick a scenario. In <b>bounded pool</b>, also pick a rejection policy. Press Play or Step. Eight long tasks arrive at <code>ThreadPoolExecutor(core 2, max 4, ArrayBlockingQueue(2))</code>. <b>fixed pool trap</b> shows why a queue with no limit never reaches max. The two shutdown scenarios compare <code>shutdown()</code> and <code>shutdownNow()</code>. <b>thread lifecycle</b> walks one thread through every <code>Thread.State</code>.'
  },
  gotchas: [
    { trap: 'Max pool size does nothing with an unbounded queue', code: `new ThreadPoolExecutor(10, 100, 60, SECONDS,
    new LinkedBlockingQueue<>());      // capacity Integer.MAX_VALUE
// never more than 10 threads; the queue absorbs everything`, why: '<code>execute()</code> adds threads above core only when <code>queue.offer()</code> fails. A queue with no limit never refuses. So the pool stays at core size while the backlog keeps growing.', fix: 'Use an <code>ArrayBlockingQueue</code> with a size that matches the wait you can accept. Add an explicit rejection policy. Want “grow first, then queue”? Set core = max and <code>allowCoreThreadTimeOut(true)</code>.' },
    { trap: '<code>Executors.newFixedThreadPool</code> and <code>newCachedThreadPool</code> have hidden extremes', why: 'Fixed: core = max = n with an <b>unbounded</b> <code>LinkedBlockingQueue</code>, so overload becomes memory and latency. Cached: core 0, max <code>Integer.MAX_VALUE</code>, a <code>SynchronousQueue</code> and 60 s keepAlive, so overload becomes <b>thousands of threads</b>. You may hit <code>OutOfMemoryError: unable to create native thread</code>.', fix: 'In services, build the <code>ThreadPoolExecutor</code> yourself (or a Spring <code>ThreadPoolTaskExecutor</code>). Give it a queue limit, a max, a named <code>ThreadFactory</code> and a rejection policy.' },
    { trap: '<code>submit()</code> swallows exceptions', code: `pool.submit(() -> { throw new IllegalStateException("boom"); });
// nothing logged, ever, unless someone calls future.get()`, why: '<code>submit</code> wraps the task in a <code>FutureTask</code>. It catches the exception and stores it in the Future. <code>execute</code> lets it escape, so the default handler prints it. The worker thread is then replaced.', fix: 'Call <code>get()</code>, or use CompletableFuture with <code>exceptionally</code>. Or catch and log inside the task, or override <code>afterExecute</code>. For work you don’t wait on, use <code>execute</code>, so failures at least get printed.' },
    { trap: 'A periodic task silently stops after one exception', code: `scheduler.scheduleAtFixedRate(this::syncPrices, 0, 1, MINUTES);
// one NullPointerException in syncPrices → no more runs, no log line`, why: 'If one run throws, the <code>ScheduledExecutorService</code> cancels all later runs. The exception sits in the returned <code>ScheduledFuture</code>, which nobody reads.', fix: 'Wrap the body in <code>try { … } catch (Exception e) { log.error(…); }</code>. Or use Spring <code>@Scheduled</code>: it logs the error and keeps the schedule.' },
    { trap: 'Tasks that wait for other tasks in the same pool', code: `Future<A> a = pool.submit(this::loadA);
return pool.submit(() -> combine(a.get(), loadB())).get();   // all workers can end up waiting`, why: 'Say every worker waits in <code>get()</code> for a task still in the queue. Nobody is left to run it. This is a <b>thread-starvation deadlock</b>. It only shows up under load, when the pool is full.', fix: 'Don’t wait on work in the same pool. Use one pool per stage, chain CompletableFutures, or use virtual threads (no fixed worker count).' },
    { trap: 'No graceful shutdown on SIGTERM', why: 'Kubernetes sends SIGTERM. The JVM runs shutdown hooks, then exits. Daemon threads die mid-task. Other pool threads keep the JVM alive past <code>terminationGracePeriodSeconds</code>, until SIGKILL. Either way, queued work is lost.', fix: '<code>shutdown()</code>, then <code>awaitTermination(timeout)</code>, then <code>shutdownNow()</code>. In Spring Boot, set <code>spring.task.execution.shutdown.await-termination=true</code> and <code>await-termination-period</code>. Keep it shorter than the grace period.' },
    { trap: 'Ignoring <code>InterruptedException</code>', code: `try { Thread.sleep(1000); } catch (InterruptedException e) { }   // flag cleared, lost`, why: 'Interruption is how <code>shutdownNow()</code> and <code>Future.cancel(true)</code> ask a task to stop. Catching the exception clears the interrupt flag. If you then ignore it, the task and the pool never stop.', fix: 'Rethrow it. Or set the flag again with <code>Thread.currentThread().interrupt()</code> and return. In long CPU loops, check <code>Thread.interrupted()</code>.' }
  ],
  scenarios: [
    { title: 'p99 latency climbs from 80 ms to 40 s during a partner outage',
      symptom: 'A partner API slows to 30 s per call. Within minutes, every request that uses it takes tens of seconds. Heap use climbs, and the service is finally killed for lack of memory. Thread count stays flat at 20.',
      diagnose: `// metrics from the executor
pool.getPoolSize()        // 20
pool.getActiveCount()     // 20
pool.getQueue().size()    // 184,000 and growing

// the bean
Executors.newFixedThreadPool(20)   // LinkedBlockingQueue, unbounded`,
      cause: 'All 20 workers are stuck on the slow partner. New tasks pile up in the queue, each holding its request data. Memory grows, and each task waits behind all earlier ones.',
      fix: 'Limit the queue. Reject early with a clear error, or return 503. Put a timeout on the partner call so no worker is held for 30 s. Export pool metrics (Micrometer’s <code>ExecutorServiceMetrics</code>) and alert on queue length.',
      fixCode: `ThreadPoolExecutor partnerPool = new ThreadPoolExecutor(
    20, 20, 0, TimeUnit.SECONDS,
    new ArrayBlockingQueue<>(200),                       // ~200 × avg latency is the worst wait
    Thread.ofPlatform().name("partner-", 0).factory(),   // Java 21 builder
    new ThreadPoolExecutor.AbortPolicy());               // caller maps RejectedExecutionException → 503` },
    { title: 'Nightly price sync “runs” but prices are three days old',
      symptom: 'Health checks are green and the scheduler bean is alive, but the price table hasn’t changed since Monday. There are no errors in the logs.',
      diagnose: `jcmd <pid> Thread.print | grep -A3 price-sync
# "price-sync-1" WAITING (parking) ... DelayedWorkQueue.take
# the thread is idle: no run is scheduled any more`,
      cause: 'The job used <code>scheduleAtFixedRate</code>. On Monday one run hit a NullPointerException on an empty response. The executor stored it in the <code>ScheduledFuture</code> and cancelled every later run.',
      fix: 'Catch and log inside the scheduled code, so one bad run doesn’t cancel the schedule. Add a “last successful sync” metric and alert when it gets old.',
      fixCode: `scheduler.scheduleAtFixedRate(() -> {
    try {
        syncPrices();
        lastSuccess.set(Instant.now());
    } catch (Exception e) {
        log.error("price sync failed; will retry next tick", e);
    }
}, 0, 1, TimeUnit.MINUTES);` },
    { title: 'Orders accepted, then lost on every deploy',
      symptom: 'After each rolling deploy, a few orders are “accepted” by the API. But their confirmation emails never go out.',
      diagnose: `// the email step runs on @Async with the default Boot executor
// pod logs end with:
//   Commencing graceful shutdown. Waiting for active requests to complete
//   ... JVM exits 2 s later; no "email sent" for the last tasks`,
      cause: 'The HTTP layer shut down cleanly, but the task executor didn’t wait. Queued and running <code>@Async</code> tasks were dropped when the app closed. The work lived only in memory.',
      fix: 'Make the executor wait on shutdown. For work that must not be lost, write it to an outbox table in the same transaction. Then process it from there.',
      fixCode: `# application.yml (Spring Boot 3.x)
spring:
  lifecycle:
    timeout-per-shutdown-phase: 25s
  task:
    execution:
      shutdown:
        await-termination: true
        await-termination-period: 20s`, fixLang: 'yaml' },
    { title: 'Service freezes only at peak traffic',
      symptom: 'Under peak load the service stops responding completely. CPU drops to almost zero. A restart fixes it until the next peak.',
      diagnose: `jcmd <pid> Thread.print
# "report-7" WAITING (parking)
#   at java.util.concurrent.FutureTask.get(...)
#   at ReportService.lambda$build$2(ReportService.java:58)
# ... all 16 "report-*" threads are in FutureTask.get`,
      cause: 'Each report task sent sub-tasks to the <b>same</b> 16-thread pool and waited for them. At peak, all 16 workers were parents waiting for children stuck in the queue. That is a thread-starvation deadlock.',
      fix: 'Chain steps instead of waiting (<code>CompletableFuture.supplyAsync(…, ioPool).thenCombine(…)</code>). Or give sub-tasks their own pool. Or, on Java 21, run each request on a virtual thread, so waiting costs no pool slot.' }
  ],
  puzzles: [
    { kind: 'predict', q: 'Core 1, max 1, a queue of capacity 1, default AbortPolicy. The first task blocks until the gate opens. What does this print?', code: `import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) throws Exception {
        CountDownLatch gate = new CountDownLatch(1);
        ThreadPoolExecutor ex = new ThreadPoolExecutor(1, 1, 0, TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(1));
        for (int i = 1; i <= 3; i++) {
            int id = i;
            try {
                ex.execute(() -> {
                    try { gate.await(); } catch (InterruptedException e) { }
                    System.out.println("ran " + id);
                });
                System.out.println("accepted " + id);
            } catch (RejectedExecutionException e) {
                System.out.println("rejected " + id);
            }
        }
        gate.countDown();
        ex.shutdown();
        ex.awaitTermination(5, TimeUnit.SECONDS);
        System.out.println("done");
    }
}`, options: ['accepted 1, accepted 2, accepted 3, ran 1, ran 2, ran 3, done', 'accepted 1, accepted 2, rejected 3, ran 1, ran 2, done', 'accepted 1, rejected 2, rejected 3, ran 1, done', 'accepted 1, accepted 2, rejected 3, done'], answer: 1, run: true, expect: 'accepted 1\naccepted 2\nrejected 3\nran 1\nran 2\ndone', explain: 'Task 1 starts the only worker and blocks on the gate. Task 2 fills the queue (capacity 1). Task 3: the queue is full and poolSize = max. So <b>AbortPolicy</b> throws <code>RejectedExecutionException</code> to the caller. After the gate opens, the single worker runs 1 and then 2. <code>shutdown()</code> still lets queued tasks finish.' },
    { kind: 'predict', q: 'Same full pool, but with <code>CallerRunsPolicy</code>. Task 3 doesn’t wait on the gate. It prints the thread it runs on. Output?', code: `import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) throws Exception {
        CountDownLatch gate = new CountDownLatch(1);
        ThreadPoolExecutor ex = new ThreadPoolExecutor(1, 1, 0, TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(1), new ThreadPoolExecutor.CallerRunsPolicy());
        Runnable blocker = () -> { try { gate.await(); } catch (InterruptedException e) { } };
        ex.execute(blocker);
        ex.execute(blocker);
        ex.execute(() -> System.out.println("task 3 on " + Thread.currentThread().getName()));
        System.out.println("submitted");
        gate.countDown();
        ex.shutdown();
    }
}`, options: ['task 3 on pool-1-thread-1, then submitted', 'submitted, then task 3 on pool-1-thread-1', 'task 3 on main, then submitted', 'RejectedExecutionException'], answer: 2, run: true, expect: 'task 3 on main\nsubmitted', explain: 'The pool is full. So <code>CallerRunsPolicy</code> runs task 3 <b>on the thread that submitted it</b> (main), before <code>execute</code> returns. That slows the sender down: it is busy and can’t submit more. If task 3 were the blocker, main would wait on the gate it must open. The program would hang.' },
    { kind: 'predict', q: 'Core size 3. Each task is submitted and finished (<code>get()</code>) before the next. How many threads does the pool hold at the end?', code: `import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) throws Exception {
        ThreadPoolExecutor ex = new ThreadPoolExecutor(3, 3, 0, TimeUnit.SECONDS,
                new LinkedBlockingQueue<>());
        for (int i = 0; i < 3; i++) ex.submit(() -> 42).get();
        System.out.println(ex.getPoolSize());
        ex.shutdown();
    }
}`, options: ['1', '2', '3', '0'], answer: 2, run: true, expect: '3', explain: 'While <code>poolSize &lt; corePoolSize</code>, <code>execute</code> starts a <b>new</b> thread for each task, even if other workers are idle. Three submissions, three core threads. Call <code>prestartAllCoreThreads()</code> if you want them created up front.' },
    { kind: 'predict', q: 'What does this print (stdout)?', code: `import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) throws Exception {
        ExecutorService ex = Executors.newSingleThreadExecutor();
        Future<?> f = ex.submit(() -> { throw new IllegalStateException("boom"); });
        ex.shutdown();
        ex.awaitTermination(5, TimeUnit.SECONDS);
        System.out.println("done=" + f.isDone());
        try {
            f.get();
        } catch (ExecutionException e) {
            System.out.println("cause=" + e.getCause().getMessage());
        }
    }
}`, options: ['A stack trace, then done=true', 'done=false', 'done=true, then cause=boom', 'done=true only'], answer: 2, run: true, expect: 'done=true\ncause=boom', explain: 'A task that throws is still “done”. <code>submit</code> stores the exception in the Future and prints nothing. <code>get()</code> rethrows it inside an <code>ExecutionException</code>. Without <code>get()</code>, the failure leaves no trace.' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] a) throws Exception {
        Thread t = new Thread(() -> { });
        System.out.println(t.getState());
        t.start();
        t.join();
        System.out.println(t.getState());
        try {
            t.start();
        } catch (IllegalThreadStateException e) {
            System.out.println("no restart");
        }
    }
}`, options: ['NEW, TERMINATED, no restart', 'NEW, RUNNABLE, no restart', 'RUNNABLE, TERMINATED, (runs again)', 'NEW, TERMINATED, (runs again)'], answer: 0, run: true, expect: 'NEW\nTERMINATED\nno restart', explain: 'Before <code>start()</code> a thread is <b>NEW</b>. <code>join()</code> waits until it has finished, so it is <b>TERMINATED</b>. You can start a thread only once. The second <code>start()</code> throws <code>IllegalThreadStateException</code>. That is one reason pools reuse workers by looping, not by restarting them.' },
    { kind: 'concept', q: '<code>new ThreadPoolExecutor(2, 10, 60, SECONDS, new LinkedBlockingQueue&lt;&gt;())</code> receives 1,000 slow tasks at once. What is the largest pool size?', options: ['10', '2', '1,000', 'It depends on CPU count'], answer: 1, explain: 'The queue has no limit and accepts every task. So the “grow to max” step never runs: <b>2</b> threads, 998 queued tasks. Max only matters when the queue can say no.' },
    { kind: 'concept', q: 'You call <code>shutdownNow()</code>. A running task is in a tight CPU loop that never checks interruption. What happens?', options: ['The JVM kills the thread', 'The task keeps running; awaitTermination may time out', 'The task gets an InterruptedException at the next bytecode', 'shutdownNow blocks until the task completes'], answer: 1, explain: '<code>shutdownNow()</code> empties the queue, returns those tasks, and <b>interrupts</b> workers. An interrupt is only a request. It sets a flag and wakes threads in <code>sleep</code>/<code>wait</code>/<code>join</code>/interruptible I/O. A loop that never checks <code>Thread.interrupted()</code> keeps running. You can’t safely kill a thread (<code>Thread.stop</code> throws UnsupportedOperationException since Java 20).' },
    { kind: 'concept', q: 'A service on a 4-CPU container calls a database. Each request spends about 10 ms on CPU and 90 ms waiting on I/O. Roughly what pool size keeps the CPUs busy?', options: ['4', '5', '40', '400'], answer: 2, explain: 'Rule of thumb: threads ≈ cores × (1 + wait / compute) = 4 × (1 + 90/10) = <b>40</b>. Then check what downstream can take: 40 threads need up to 40 DB connections. Little’s law agrees: work in flight = throughput × latency.' }
  ],
  interview: [
    { q: 'Walk me through what <code>ThreadPoolExecutor.execute()</code> does.', a: '<ol><li>Fewer than <code>corePoolSize</code> threads running? Start a new worker with this task as its first job.</li><li>Otherwise call <code>workQueue.offer(task)</code>. If it works, check again that the pool is running and has a worker.</li><li>If the queue refuses, start an extra worker, up to <code>maximumPoolSize</code>.</li><li>If that fails too, or the pool is shut down, call the <code>RejectedExecutionHandler</code>.</li></ol><p>Workers loop. They run their first task, then <code>take()</code> from the queue (<code>poll(keepAlive)</code> when above core).</p>', fu: 'Why does a new extra thread run the incoming task, not the oldest queued one? (It is created with that task as its first job. So when the pool is full, new tasks can jump the queue.)', lvl: 'core' },
    { q: 'Compare the built-in rejection policies.', a: '<ul><li><b>AbortPolicy</b> (default): throws <code>RejectedExecutionException</code>. You see it, and the caller decides.</li><li><b>CallerRunsPolicy</b>: runs the task on the thread that submitted it. That slows the sender, but it can stall a request thread or event loop. It drops the task if the pool is shut down.</li><li><b>DiscardPolicy</b>: drops it without a word. Only for optional work, with a metric.</li><li><b>DiscardOldestPolicy</b>: drops the oldest queued task and retries. Risky with priority queues.</li></ul>', lvl: 'core' },
    { q: 'How do you size a thread pool?', a: '<p>CPU-heavy work: about one thread per core (<code>Runtime.availableProcessors()</code>, which respects container limits since JDK 10 and 8u191). I/O-heavy work: start at cores × (1 + wait/compute), then measure. Cap it at what downstream can take: DB pool size, partner rate limits. Little’s law says tasks in flight = throughput × latency. Size the queue from the wait you accept: queue length × task time = extra wait.</p>', fu: 'What changes with virtual threads? (For blocking I/O, you stop sizing a pool. You limit the scarce resource instead, with a Semaphore or the connection pool.)', lvl: 'core' },
    { q: 'What is the difference between <code>shutdown()</code>, <code>shutdownNow()</code> and <code>awaitTermination()</code>?', a: '<p><code>shutdown()</code> stops taking new tasks. Running and queued tasks still finish. It returns at once. <code>shutdownNow()</code> also empties the queue, returns the tasks that never started, and interrupts running workers. <code>awaitTermination(t)</code> waits until all tasks finish or time runs out. The usual pattern: <code>shutdown()</code>, <code>awaitTermination</code>, then <code>shutdownNow()</code> and a second wait. On Java 19+, <code>close()</code> does shutdown + wait, with no timeout.</p>', lvl: 'core' },
    { q: 'What are the thread states, and which one is a thread in when it waits on a ReentrantLock?', a: '<p>NEW, RUNNABLE, BLOCKED, WAITING, TIMED_WAITING, TERMINATED. <b>BLOCKED</b> is only for entering a <code>synchronized</code> block (or re-entering after <code>wait</code>). Waiting on a <code>ReentrantLock</code>, latch or queue puts the thread to sleep with <code>LockSupport.park</code>. So it is <b>WAITING</b> (TIMED_WAITING with a timeout). A thread stuck in a native socket read shows as <b>RUNNABLE</b>.</p>', fu: 'Why does that matter in a thread dump? (A pool full of RUNNABLE threads in socketRead0 is waiting on the network, not burning CPU.)', lvl: 'deep' },
    { q: '<code>execute</code> vs <code>submit</code>: what happens to an exception?', a: '<p><code>execute(Runnable)</code>: the exception escapes <code>run()</code>. The worker dies and is replaced. The thread’s <code>UncaughtExceptionHandler</code> prints it. <code>submit</code>: the task is wrapped in a <code>FutureTask</code>, which catches and stores the error. You only see it through <code>Future.get()</code>, as an <code>ExecutionException</code>. <code>afterExecute(r, t)</code> gets <code>t</code> only for <code>execute</code>. For <code>submit</code>, check the Future.</p>', lvl: 'core' },
    { q: 'What does keepAliveTime do, and can core threads time out?', a: '<p>A worker above <code>corePoolSize</code> waits with <code>queue.poll(keepAliveTime)</code>. If that returns null, it exits. Threads have no “core” label. Whichever times out first, while the count is above core, leaves. <code>allowCoreThreadTimeOut(true)</code> applies the timeout to all threads. Then an idle pool can shrink to zero.</p>', lvl: 'deep' },
    { q: 'Why is <code>newCachedThreadPool</code> risky in a service?', a: '<p>It uses a <code>SynchronousQueue</code>, which holds nothing and only hands tasks over. Max is <code>Integer.MAX_VALUE</code>. Every task that finds no idle thread makes a new one. Under a burst or a slow dependency, that means thousands of threads, each with its own stack. Then the OS refuses (<code>OutOfMemoryError: unable to create native thread</code>), or the machine grinds to a halt.</p>', lvl: 'core' },
    { q: 'How does Spring Boot configure <code>@Async</code> executors?', a: '<p>Boot sets up an <code>applicationTaskExecutor</code> for you. It is a <code>ThreadPoolTaskExecutor</code> with core size 8 and a queue with no limit (<code>spring.task.execution.pool.*</code>). So, like a fixed pool, it never grows past 8 unless you set <code>queue-capacity</code>. With <code>spring.threads.virtual.enabled=true</code> (Boot 3.2+, Java 21), it uses a <code>SimpleAsyncTaskExecutor</code> on virtual threads. Give each workload its own executor bean, so one can’t starve another.</p>', fu: 'What happens to @Async methods called from the same class? (Nothing async: the call bypasses the proxy.)', lvl: 'deep' },
    { q: 'How do you stop a running task?', a: '<p>You ask it to stop, and the task must agree. Interrupt it (<code>future.cancel(true)</code> or <code>shutdownNow()</code>). Waiting calls like <code>sleep</code>, <code>wait</code> and <code>BlockingQueue.take</code> then throw <code>InterruptedException</code>. CPU loops must check <code>Thread.currentThread().isInterrupted()</code>. Catch <code>InterruptedException</code> only to clean up, then set the flag again or rethrow. <code>Thread.stop()</code> could leave shared data half-changed. Since Java 20 it always throws.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'A production ThreadPoolExecutor', lang: 'java', code: `ThreadPoolExecutor pool = new ThreadPoolExecutor(
        16,                                   // core: steady-state concurrency
        32,                                   // max: only used when the queue is full
        30, TimeUnit.SECONDS,                 // keepAlive for threads above core
        new ArrayBlockingQueue<>(500),        // bounded: overload becomes visible
        Thread.ofPlatform().name("pricing-", 0).daemon(false).factory(),   // Java 21 builder
        new ThreadPoolExecutor.CallerRunsPolicy()) {   // back-pressure to the producer

    @Override protected void afterExecute(Runnable r, Throwable t) {
        super.afterExecute(r, t);
        if (t != null) log.error("task failed", t);   // only set for execute(), not submit()
    }
};

// expose it: Micrometer binds pool size, active, queued, completed
ExecutorServiceMetrics.monitor(meterRegistry, pool, "pricing");`, note: 'Use CallerRuns only when you are happy to slow the sender, like a batch reader. Never on a Netty event loop: use AbortPolicy and return 503.' },
    { title: 'Spring @Async with a dedicated executor', lang: 'java', code: `@Configuration
@EnableAsync
class AsyncConfig {
    @Bean(name = "mailExecutor")
    ThreadPoolTaskExecutor mailExecutor() {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(4);
        ex.setMaxPoolSize(8);
        ex.setQueueCapacity(100);                     // bounded, so max is reachable
        ex.setThreadNamePrefix("mail-");
        ex.setWaitForTasksToCompleteOnShutdown(true);  // finish queued mail on shutdown
        ex.setAwaitTerminationSeconds(20);             // < K8s terminationGracePeriodSeconds
        ex.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
        return ex;
    }
}

@Service
class Mailer {
    @Async("mailExecutor")
    public CompletableFuture<Void> sendConfirmation(Order o) { … }
}`, note: 'Spring Boot 3.2+ on Java 21: <code>spring.threads.virtual.enabled=true</code> switches the auto-configured executor (not this custom bean) to virtual threads.' },
    { title: 'Graceful shutdown, by hand and on Java 19+', lang: 'java', code: `// the classic pattern (from the ExecutorService javadoc)
void shutdownAndAwait(ExecutorService pool) {
    pool.shutdown();                                    // no new tasks
    try {
        if (!pool.awaitTermination(20, TimeUnit.SECONDS)) {
            List<Runnable> never = pool.shutdownNow();  // interrupt running, drain queued
            log.warn("{} tasks never started", never.size());
            if (!pool.awaitTermination(5, TimeUnit.SECONDS))
                log.error("pool did not terminate");
        }
    } catch (InterruptedException e) {
        pool.shutdownNow();
        Thread.currentThread().interrupt();             // keep the interrupt
    }
}

// Java 19+: ExecutorService is AutoCloseable; close() = shutdown + wait (no timeout)
try (ExecutorService ex = Executors.newVirtualThreadPerTaskExecutor()) {
    ids.forEach(id -> ex.submit(() -> fetch(id)));
}   // blocks here until every task is done` }
  ]
});

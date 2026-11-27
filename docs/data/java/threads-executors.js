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
    what: 'A <b>thread</b> is an independent line of execution inside your program. Creating a platform thread is expensive (it is an OS thread with its own stack), so servers keep a <b>pool</b> of threads and hand them small jobs. An <b>executor</b> is that pool plus a <b>queue</b> of waiting jobs. You submit a task; a free worker picks it up; when all workers are busy, tasks wait in the queue; when the queue is full too, the executor must say no.',
    analogy: { icon: '🍳', title: 'A restaurant kitchen', text: 'The core cooks are always on shift. Orders that arrive while they are busy go on the ticket rail (the queue). If the rail fills up, the manager calls in temporary cooks (up to max), who go home after a quiet spell (keepAlive). If the rail is full and every cook is in, the host turns guests away, or asks them to cook it themselves (CallerRunsPolicy).' },
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
      ['work queue', 'Where tasks wait for a worker: <code>ArrayBlockingQueue</code> (bounded), <code>LinkedBlockingQueue</code> (unbounded by default), <code>SynchronousQueue</code> (no capacity).'],
      ['rejection policy', 'What happens when the pool is full or shut down: Abort (throw), CallerRuns, Discard, DiscardOldest.'],
      ['Future', 'A handle to a submitted task’s result or exception: <code>get()</code>, <code>cancel()</code>, <code>isDone()</code>.']
    ]
  },
  visual: {
    title: 'Watch tasks hit core threads, the queue, extra threads and the rejection policy',
    caption: 'Pick a scenario. In <b>bounded pool</b>, also pick a rejection policy, then press Play or Step: eight long tasks arrive at <code>ThreadPoolExecutor(core 2, max 4, ArrayBlockingQueue(2))</code>. <b>fixed pool trap</b> shows why max is never reached with an unbounded queue. The two shutdown scenarios compare <code>shutdown()</code> and <code>shutdownNow()</code>. <b>thread lifecycle</b> walks one thread through every <code>Thread.State</code>.'
  },
  gotchas: [
    { trap: 'Max pool size does nothing with an unbounded queue', code: `new ThreadPoolExecutor(10, 100, 60, SECONDS,
    new LinkedBlockingQueue<>());      // capacity Integer.MAX_VALUE
// never more than 10 threads; the queue absorbs everything`, why: '<code>execute()</code> adds threads above core only when <code>queue.offer()</code> fails. A queue with no limit never refuses. So the pool stays at core size while the backlog keeps growing.', fix: 'Use an <code>ArrayBlockingQueue</code> with a size that matches the wait you can accept. Add an explicit rejection policy. Want “grow first, then queue”? Set core = max and <code>allowCoreThreadTimeOut(true)</code>.' },
    { trap: '<code>Executors.newFixedThreadPool</code> and <code>newCachedThreadPool</code> have hidden extremes', why: 'Fixed: core = max = n with an <b>unbounded</b> <code>LinkedBlockingQueue</code>, so overload becomes memory and latency. Cached: core 0, max <code>Integer.MAX_VALUE</code>, a <code>SynchronousQueue</code> and 60 s keepAlive, so overload becomes <b>thousands of threads</b>. You may hit <code>OutOfMemoryError: unable to create native thread</code>.', fix: 'In services, build the <code>ThreadPoolExecutor</code> yourself (or a Spring <code>ThreadPoolTaskExecutor</code>) with a bounded queue, a max, a named <code>ThreadFactory</code> and a rejection policy.' },
    { trap: '<code>submit()</code> swallows exceptions', code: `pool.submit(() -> { throw new IllegalStateException("boom"); });
// nothing logged, ever, unless someone calls future.get()`, why: '<code>submit</code> wraps the task in a <code>FutureTask</code>. It catches the exception and stores it in the Future. <code>execute</code> lets it escape, so the default handler prints it. The worker thread is then replaced.', fix: 'Call <code>get()</code> (or use CompletableFuture with <code>exceptionally</code>), catch and log inside the task, or override <code>afterExecute</code>. Use <code>execute</code> for fire-and-forget work so failures are at least printed.' },
    { trap: 'A periodic task silently stops after one exception', code: `scheduler.scheduleAtFixedRate(this::syncPrices, 0, 1, MINUTES);
// one NullPointerException in syncPrices → no more runs, no log line`, why: 'If one run throws, the <code>ScheduledExecutorService</code> cancels all later runs. The exception sits in the returned <code>ScheduledFuture</code>, which nobody reads.', fix: 'Wrap the body in <code>try { … } catch (Exception e) { log.error(…); }</code>, or use Spring <code>@Scheduled</code>, whose error handler logs and keeps the schedule.' },
    { trap: 'Tasks that wait for other tasks in the same pool', code: `Future<A> a = pool.submit(this::loadA);
return pool.submit(() -> combine(a.get(), loadB())).get();   // all workers can end up waiting`, why: 'Say every worker waits in <code>get()</code> for a task still in the queue. Nobody is left to run it. This is a <b>thread-starvation deadlock</b>. It only shows up under load, when the pool is full.', fix: 'Don’t block on same-pool work. Use separate pools per stage, CompletableFuture composition, or virtual threads (no fixed worker count).' },
    { trap: 'No graceful shutdown on SIGTERM', why: 'Kubernetes sends SIGTERM. The JVM runs shutdown hooks, then exits. Daemon threads die mid-task. Other pool threads keep the JVM alive past <code>terminationGracePeriodSeconds</code>, until SIGKILL. Either way, queued work is lost.', fix: '<code>shutdown()</code>, then <code>awaitTermination(timeout)</code>, then <code>shutdownNow()</code>. In Spring Boot set <code>spring.task.execution.shutdown.await-termination=true</code> and <code>await-termination-period</code>, and keep it shorter than the grace period.' },
    { trap: 'Ignoring <code>InterruptedException</code>', code: `try { Thread.sleep(1000); } catch (InterruptedException e) { }   // flag cleared, lost`, why: 'Interruption is how <code>shutdownNow()</code> and <code>Future.cancel(true)</code> ask a task to stop. Catching the exception clears the interrupt flag. If you then ignore it, the task and the pool never stop.', fix: 'Propagate it, or restore the flag with <code>Thread.currentThread().interrupt()</code> and return. Check <code>Thread.interrupted()</code> in long CPU loops.' }
  ],
  scenarios: [
    { title: 'p99 latency climbs from 80 ms to 40 s during a partner outage',
      symptom: 'A partner API slows to 30 s per call. Within minutes every request that touches it takes tens of seconds, heap usage climbs, and the service is eventually OOM-killed. Thread count stays flat at 20.',
      diagnose: `// metrics from the executor
pool.getPoolSize()        // 20
pool.getActiveCount()     // 20
pool.getQueue().size()    // 184,000 and growing

// the bean
Executors.newFixedThreadPool(20)   // LinkedBlockingQueue, unbounded`,
      cause: 'All 20 workers are stuck on the slow partner. New tasks pile up in the queue, each holding its request data. Memory grows, and each task waits behind all earlier ones.',
      fix: 'Bound the queue, reject early with a clear error (or shed load with a 503), and put a timeout on the partner call so a worker is never held for 30 s. Export pool metrics (Micrometer’s <code>ExecutorServiceMetrics</code>) and alert on queue depth.',
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
      fix: 'Catch and log inside the scheduled body so one bad run doesn’t cancel the schedule. Add a “last successful sync” metric and alert on its age.',
      fixCode: `scheduler.scheduleAtFixedRate(() -> {
    try {
        syncPrices();
        lastSuccess.set(Instant.now());
    } catch (Exception e) {
        log.error("price sync failed; will retry next tick", e);
    }
}, 0, 1, TimeUnit.MINUTES);` },
    { title: 'Orders accepted, then lost on every deploy',
      symptom: 'After each rolling deploy, a handful of orders are “accepted” by the API but their confirmation emails never go out.',
      diagnose: `// the email step runs on @Async with the default Boot executor
// pod logs end with:
//   Commencing graceful shutdown. Waiting for active requests to complete
//   ... JVM exits 2 s later; no "email sent" for the last tasks`,
      cause: 'The HTTP layer shut down cleanly, but the task executor didn’t wait. Queued and running <code>@Async</code> tasks were dropped when the app closed. The work lived only in memory.',
      fix: 'Make the executor wait on shutdown, and for work that must not be lost, write it to a durable outbox table in the same transaction and process it from there.',
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
      fix: 'Compose instead of blocking (<code>CompletableFuture.supplyAsync(…, ioPool).thenCombine(…)</code>), give sub-tasks their own pool, or on Java 21 run each request on a virtual thread so blocking costs no pool slot.' }
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
    { kind: 'predict', q: 'Same saturated pool, but with <code>CallerRunsPolicy</code>. Task 3 doesn’t wait on the gate; it prints the thread it runs on. Output?', code: `import java.util.concurrent.*;

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
}`, options: ['NEW, TERMINATED, no restart', 'NEW, RUNNABLE, no restart', 'RUNNABLE, TERMINATED, (runs again)', 'NEW, TERMINATED, (runs again)'], answer: 0, run: true, expect: 'NEW\nTERMINATED\nno restart', explain: 'Before <code>start()</code> a thread is <b>NEW</b>. <code>join()</code> waits until it has finished, so it is <b>TERMINATED</b>. A thread can be started only once: the second <code>start()</code> throws <code>IllegalThreadStateException</code>. That is one reason pools reuse worker threads by looping, not by restarting them.' },
    { kind: 'concept', q: '<code>new ThreadPoolExecutor(2, 10, 60, SECONDS, new LinkedBlockingQueue&lt;&gt;())</code> receives 1,000 slow tasks at once. What is the largest pool size?', options: ['10', '2', '1,000', 'It depends on CPU count'], answer: 1, explain: 'The queue has no limit and accepts every task. So the “grow to max” step never runs: <b>2</b> threads, 998 queued tasks. Max only matters when the queue can say no.' },
    { kind: 'concept', q: 'You call <code>shutdownNow()</code>. A running task is in a tight CPU loop that never checks interruption. What happens?', options: ['The JVM kills the thread', 'The task keeps running; awaitTermination may time out', 'The task gets an InterruptedException at the next bytecode', 'shutdownNow blocks until the task completes'], answer: 1, explain: '<code>shutdownNow()</code> empties the queue, returns those tasks, and <b>interrupts</b> workers. An interrupt is only a request. It sets a flag and wakes threads in <code>sleep</code>/<code>wait</code>/<code>join</code>/interruptible I/O. A loop that never checks <code>Thread.interrupted()</code> keeps running. You can’t safely kill a thread (<code>Thread.stop</code> throws UnsupportedOperationException since Java 20).' },
    { kind: 'concept', q: 'A service on a 4-vCPU container calls a database: each request spends about 10 ms on CPU and 90 ms waiting on I/O. Roughly what pool size keeps the CPUs busy?', options: ['4', '5', '40', '400'], answer: 2, explain: 'Rule of thumb: threads ≈ cores × (1 + wait / compute) = 4 × (1 + 90/10) = <b>40</b>. Then check what downstream can take: 40 threads need up to 40 DB connections. Little’s law agrees: work in flight = throughput × latency.' }
  ],
  interview: [
    { q: 'Walk me through what <code>ThreadPoolExecutor.execute()</code> does.', a: '<ol><li>If fewer than <code>corePoolSize</code> threads are running, start a new worker with this task as its first task.</li><li>Otherwise <code>workQueue.offer(task)</code>. If it succeeds, re-check that the pool is still running and has at least one worker.</li><li>If the queue refuses, try to start a non-core worker, up to <code>maximumPoolSize</code>.</li><li>If that fails too (or the pool is shut down), call the <code>RejectedExecutionHandler</code>.</li></ol><p>Workers loop: run the first task, then <code>take()</code> (or <code>poll(keepAlive)</code> when above core) from the queue.</p>', fu: 'Why does a new non-core thread run the incoming task rather than the oldest queued one? (It is created with the task as firstTask, so newer tasks can overtake queued ones: no FIFO guarantee under saturation.)', lvl: 'core' },
    { q: 'Compare the built-in rejection policies.', a: '<ul><li><b>AbortPolicy</b> (default): throws <code>RejectedExecutionException</code>. Visible; the caller decides.</li><li><b>CallerRunsPolicy</b>: runs the task on the submitting thread. Gives back-pressure, but can stall a request thread or an event loop, and it discards the task if the pool is shut down.</li><li><b>DiscardPolicy</b>: drops silently. Only for truly optional work, with a metric.</li><li><b>DiscardOldestPolicy</b>: drops the queue head and retries. Dangerous with priority queues.</li></ul>', lvl: 'core' },
    { q: 'How do you size a thread pool?', a: '<p>CPU-bound: about the number of cores (<code>Runtime.availableProcessors()</code>, container-aware since JDK 10 and 8u191). I/O-bound: cores × (1 + wait/compute) as a start, then measure. Cap it by what downstream can take: DB pool size, partner rate limits. Little’s law (concurrency = throughput × latency) tells you how many in-flight tasks you need for a target throughput. Size the queue from the latency you accept: queue length × service time = extra wait.</p>', fu: 'What changes with virtual threads? (For blocking I/O you stop sizing a pool; you limit the scarce resource with a Semaphore or the connection pool instead.)', lvl: 'core' },
    { q: 'What is the difference between <code>shutdown()</code>, <code>shutdownNow()</code> and <code>awaitTermination()</code>?', a: '<p><code>shutdown()</code> stops accepting tasks and lets running and queued tasks finish; it returns immediately. <code>shutdownNow()</code> also drains the queue (returning the never-started tasks) and interrupts running workers. <code>awaitTermination(t)</code> blocks until all tasks have finished or the timeout passes. The standard pattern: <code>shutdown()</code>, <code>awaitTermination</code>, then <code>shutdownNow()</code> and a second wait. Java 19+ <code>close()</code> does shutdown + wait without a timeout.</p>', lvl: 'core' },
    { q: 'What are the thread states, and which one is a thread in when it waits on a ReentrantLock?', a: '<p>NEW, RUNNABLE, BLOCKED, WAITING, TIMED_WAITING, TERMINATED. <b>BLOCKED</b> is only for entering a <code>synchronized</code> monitor (or re-entering after <code>wait</code>). Waiting on a <code>ReentrantLock</code>, latch or queue parks the thread via <code>LockSupport.park</code>, so it is <b>WAITING</b> (or TIMED_WAITING with a timeout). A thread blocked in a native socket read shows as <b>RUNNABLE</b>.</p>', fu: 'Why does that matter in a thread dump? (A pool full of RUNNABLE threads in socketRead0 is waiting on the network, not burning CPU.)', lvl: 'deep' },
    { q: '<code>execute</code> vs <code>submit</code>: what happens to an exception?', a: '<p><code>execute(Runnable)</code>: the exception propagates out of <code>run()</code>, the worker thread dies (and is replaced), and the thread’s <code>UncaughtExceptionHandler</code> prints it. <code>submit</code>: the task is wrapped in a <code>FutureTask</code>, which catches the throwable and stores it. You only see it via <code>Future.get()</code> as an <code>ExecutionException</code>. <code>afterExecute(r, t)</code> sees <code>t</code> only for <code>execute</code>; for <code>submit</code> you must inspect the Future.</p>', lvl: 'core' },
    { q: 'What does keepAliveTime do, and can core threads time out?', a: '<p>A worker above <code>corePoolSize</code> waits with <code>queue.poll(keepAliveTime)</code>; if that returns null it exits. The pool doesn’t mark threads as “core”: whichever thread times out first while the count exceeds core leaves. <code>allowCoreThreadTimeOut(true)</code> applies the timeout to all threads, letting an idle pool shrink to zero.</p>', lvl: 'deep' },
    { q: 'Why is <code>newCachedThreadPool</code> risky in a service?', a: '<p>It uses a <code>SynchronousQueue</code> (no capacity: a hand-off) and max <code>Integer.MAX_VALUE</code>. Every task that finds no idle thread creates one. Under a burst or a slow dependency it creates thousands of platform threads, each with its own stack, until the OS refuses (<code>OutOfMemoryError: unable to create native thread</code>) or the box thrashes.</p>', lvl: 'core' },
    { q: 'How does Spring Boot configure <code>@Async</code> executors?', a: '<p>Boot auto-configures an <code>applicationTaskExecutor</code>: a <code>ThreadPoolTaskExecutor</code> with core size 8 and an unbounded queue by default (<code>spring.task.execution.pool.*</code>). So, like a fixed pool, it never grows past 8 unless you set a <code>queue-capacity</code>. With <code>spring.threads.virtual.enabled=true</code> (Boot 3.2+, Java 21) it uses a <code>SimpleAsyncTaskExecutor</code> on virtual threads instead. Define your own executor bean per workload to isolate them (bulkheads).</p>', fu: 'What happens to @Async methods called from the same class? (Nothing async: the call bypasses the proxy.)', lvl: 'deep' },
    { q: 'How do you stop a running task?', a: '<p>Cooperatively. Interrupt it (<code>future.cancel(true)</code> or <code>shutdownNow()</code>) and make the task respond: blocking calls like <code>sleep</code>, <code>wait</code>, <code>BlockingQueue.take</code> throw <code>InterruptedException</code>; CPU loops check <code>Thread.currentThread().isInterrupted()</code>. Catch <code>InterruptedException</code> only to clean up, then restore the flag or rethrow. <code>Thread.stop()</code> was deprecated because it could leave locks’ invariants broken, and since Java 20 it always throws.</p>', lvl: 'core' }
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
ExecutorServiceMetrics.monitor(meterRegistry, pool, "pricing");`, note: 'Use CallerRuns only when the producer is a thread you are willing to slow down (a batch reader). Never on a Netty event loop: use AbortPolicy and return 503.' },
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

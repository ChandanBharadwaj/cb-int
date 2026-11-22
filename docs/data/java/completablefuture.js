IA.register({
  track: 'java',
  slug: 'completablefuture',
  title: 'CompletableFuture',
  tagline: 'A <code>CompletableFuture</code> is a <b>node in a dependency graph</b>. Each <code>then…</code> call adds a node that fires when its inputs complete, on <i>some</i> thread. Most bugs come from three questions: which method (<code>thenApply</code> or <code>thenCompose</code>), which thread runs the callback, and where the exception went.',
  tldr: {
    problem: 'Async code that is slower than the blocking version, exceptions that disappear, “timeouts” that leave work running, nested <code>CompletableFuture&lt;CompletableFuture&lt;T&gt;&gt;</code>, and a shared common pool quietly starved by blocking I/O.',
    model: '<code>thenApply</code> = map (T → U). <code>thenCompose</code> = flatMap (T → CF&lt;U&gt;). <code>thenCombine</code> joins two. A failure skips every normal stage downstream (each completes exceptionally with a <code>CompletionException</code>) until <code>exceptionally</code> / <code>handle</code> turns it back into a value. Non-async callbacks run on whichever thread completes the previous stage, or on the caller if it is already done; <code>…Async</code> without an executor runs on <code>ForkJoinPool.commonPool()</code>.',
    hook: '“Does <code>future.cancel(true)</code> or <code>orTimeout</code> stop the HTTP call?” No. They complete the future; the thread running the supplier keeps going. Put the timeout on the client.',
    facts: [
      { v: 'Java 8', l: 'introduced <code>CompletableFuture</code> and <code>CompletionStage</code>. Java 9 added <code>orTimeout</code>, <code>completeOnTimeout</code>, <code>failedFuture</code> and <code>delayedExecutor</code>; Java 12 added <code>exceptionallyCompose</code>' },
      { v: 'cores − 1', l: 'default parallelism of <code>ForkJoinPool.commonPool()</code>, the executor for every <code>…Async</code> call without one. Parallel streams share it' },
      { v: 'no interrupt', l: '<code>cancel(true)</code> on a CompletableFuture completes it with <code>CancellationException</code>; the <code>mayInterruptIfRunning</code> flag has no effect on the running task' }
    ]
  },
  intro: {
    what: 'Some work takes time: calling another service, reading a file, querying a database. Instead of blocking a thread until it finishes, you can start it and get back a <b>future</b>: a box that will contain the result later. A <code>CompletableFuture</code> lets you say <i>what to do next</i> when the box fills (“then transform it”, “then call another service with it”, “when both are done, combine them”, “if it fails, use a default”) and builds a small pipeline that runs as results arrive.',
    analogy: { icon: '🧾', title: 'Restaurant buzzers', text: 'You order and get a buzzer instead of standing at the counter. You can say “when the burger buzzes, add ketchup” (thenApply), “when it buzzes, order a dessert and give me the dessert’s buzzer” (thenCompose), or “when the burger <i>and</i> the fries buzz, put them on one tray” (thenCombine). If the kitchen burns the burger, every “then” step is skipped until someone says “in that case, give me a salad” (exceptionally).' },
    steps: [
      { t: 'Start async work on your own executor', d: 'Pass an executor sized for the job. Without one, the work runs on the shared common pool.', code: 'CompletableFuture<User> user =\n    CompletableFuture.supplyAsync(() -> userClient.get(id), ioPool);' },
      { t: 'Chain the next step', d: '<code>thenApply</code> for a plain transformation, <code>thenCompose</code> when the next step itself returns a future.', code: 'CompletableFuture<List<Order>> orders =\n    user.thenCompose(u -> orderClient.forUser(u.id()));   // returns CF<List<Order>>' },
      { t: 'Combine and handle failure', d: 'Run independent calls in parallel, combine their results, and decide what a failure turns into.', code: 'price.thenCombine(stock, Offer::new)\n     .exceptionally(ex -> Offer.unavailable());' },
      { t: 'Block only at the edge', d: 'Call <code>join()</code> (or <code>get(timeout)</code>) once, at the boundary, or return the future to a framework that understands it (Spring MVC, WebFlux).' }
    ],
    terms: [
      ['stage', 'One step in the pipeline (<code>CompletionStage</code>). Each <code>then…</code> call returns a new stage.'],
      ['thenApply / thenCompose', 'Map vs flat-map. Compose avoids <code>CompletableFuture&lt;CompletableFuture&lt;T&gt;&gt;</code>.'],
      ['…Async variants', 'Run the callback on an executor instead of on the completing thread.'],
      ['commonPool', 'The JVM-wide <code>ForkJoinPool</code> used by default for async work and parallel streams.'],
      ['CompletionException', 'The unchecked wrapper around a failure as it passes through stages and <code>join()</code>.'],
      ['allOf / anyOf', 'Wait for all of several futures (result <code>Void</code>), or the first to finish (result <code>Object</code>).']
    ]
  },
  visual: {
    title: 'Watch the dependency graph fire',
    caption: 'Pick a scenario and press Play or Step. Each box is a stage: dashed = not complete, blue = running, green = completed with a value, red = completed exceptionally. Arrows light up when a completion triggers a dependent stage. The second line of each box shows the value and the thread that ran it.'
  },
  gotchas: [
    { trap: 'Blocking I/O on the common pool', code: `CompletableFuture.supplyAsync(() -> restTemplate.getForObject(url, Quote.class));
// no executor → ForkJoinPool.commonPool(): cores − 1 threads for the whole JVM`, why: 'The common pool is small and shared with every parallel stream and every other default async call. A few slow HTTP calls occupy all its threads, and unrelated work queues behind them.', fix: 'Always pass an executor for I/O: a bounded <code>ThreadPoolExecutor</code>, or on Java 21 <code>Executors.newVirtualThreadPerTaskExecutor()</code>. Keep the common pool for short CPU work.' },
    { trap: '<code>thenApply</code> with a function that returns a future', code: `CompletableFuture<CompletableFuture<List<Order>>> nested =
    user.thenApply(u -> orderClient.forUser(u.id()));   // ✗ a future of a future`, why: '<code>thenApply</code> wraps whatever the function returns. If that is a future, you get nesting, and code that calls <code>join()</code> on the outer one gets an incomplete inner future.', fix: 'Use <code>thenCompose</code> (flatMap). Rule: if your lambda returns a <code>CompletableFuture</code>, compose.' },
    { trap: 'Exceptions vanish in fire-and-forget chains', code: `CompletableFuture.runAsync(() -> audit.write(event), pool);   // result never read`, why: 'A failure completes the future exceptionally and stops there. Unlike <code>Thread</code>, nothing calls an uncaught-exception handler, so if nobody joins or attaches a handler, the error is never logged.', fix: 'End fire-and-forget chains with <code>.whenComplete((r, ex) -&gt; { if (ex != null) log.error(…); })</code> or <code>.exceptionally(…)</code>.' },
    { trap: '<code>orTimeout</code> and <code>cancel</code> don’t stop the work', why: 'They complete <i>the future</i> (with <code>TimeoutException</code> or <code>CancellationException</code>). A CompletableFuture has no link to the thread running the supplier, so the HTTP call, and the thread and connection it holds, keep going.', fix: 'Set timeouts where the work happens: connect and read timeouts on the HTTP client, <code>statement_timeout</code> on the query. Use <code>orTimeout</code> as a last safety net for the caller.' },
    { trap: '<code>whenComplete</code> doesn’t recover; <code>handle</code> does', code: `f.whenComplete((v, ex) -> log.warn("failed", ex))   // still failed afterwards
 .handle((v, ex) -> ex == null ? v : DEFAULT);        // now a normal value`, why: '<code>whenComplete</code> is a side-effect hook: the resulting stage keeps the original result or exception. <code>handle</code> and <code>exceptionally</code> map the outcome to a new value.', fix: 'Log with <code>whenComplete</code>, recover with <code>exceptionally</code> (failure only) or <code>handle</code> (both cases).' },
    { trap: 'Unwrapping the wrong exception', code: `.exceptionally(ex -> ex instanceof PartnerDownException ? fallback() : rethrow(ex))
// ex is often a CompletionException wrapping PartnerDownException`, why: 'Failures passed on from an earlier stage arrive wrapped in <code>CompletionException</code>, and so do exceptions thrown inside <code>supplyAsync</code>. Only a future completed directly with <code>completeExceptionally</code> / <code>failedFuture</code> delivers the raw exception to its own handlers.', fix: 'Unwrap: <code>Throwable cause = ex instanceof CompletionException ce &amp;&amp; ce.getCause() != null ? ce.getCause() : ex;</code>' },
    { trap: 'ThreadLocals don’t follow the callback', why: 'MDC (trace ids), Spring Security’s <code>SecurityContextHolder</code>, and transaction state are thread-bound. A callback running on another pool thread sees none of them, or worse, stale values left by a previous task.', fix: 'Capture what you need before going async and pass it explicitly, wrap the executor with a decorator (Spring <code>TaskDecorator</code>, <code>ContextExecutorService</code> from Micrometer context-propagation), or use <code>DelegatingSecurityContextExecutor</code>.' }
  ],
  scenarios: [
    { title: 'Parallel stream reports get slow whenever a partner is slow',
      symptom: 'A nightly report built with <code>parallelStream()</code> normally takes 2 minutes. On days when the pricing partner is slow, it takes 40 minutes, although the report never calls the partner.',
      diagnose: `jcmd <pid> Thread.print | grep -A4 'ForkJoinPool.commonPool-worker'
# "ForkJoinPool.commonPool-worker-3" RUNNABLE
#   at sun.nio.ch.SocketDispatcher.read0(Native Method)
#   ...
#   at PricingClient.quote(PricingClient.java:52)
#   at CompletableFuture$AsyncSupply.run(...)
# all 7 workers (8 vCPU − 1) are in PricingClient`,
      cause: 'Pricing calls use <code>supplyAsync</code> without an executor, so they run on the common pool. When the partner slows down, its blocking calls occupy every worker, and the parallel stream’s tasks wait behind them.',
      fix: 'Give I/O its own executor, and keep the common pool for CPU-bound work. On Java 21, virtual threads are a good fit for many blocking calls.',
      fixCode: `private final ExecutorService pricingPool =
        Executors.newVirtualThreadPerTaskExecutor();          // Java 21; or a bounded TPE

CompletableFuture<Quote> quote(String sku) {
    return CompletableFuture.supplyAsync(() -> client.quote(sku), pricingPool)
                            .orTimeout(2, TimeUnit.SECONDS);   // caller-side safety net
}` },
    { title: 'Gateway returns 504 quickly, but the partner connection pool is always exhausted',
      symptom: 'After adding <code>orTimeout(500 ms)</code>, the API correctly answers 504 when the partner is slow. But the HTTP client’s connection pool stays at 100% and even fast requests start timing out.',
      diagnose: `// metrics
http.client.connections.active{pool="partner"}   100 / 100
http.client.requests{outcome="timeout"}          rising
// the client was built with no read timeout:
HttpClient.newBuilder().build();    // request timeout not set`,
      cause: '<code>orTimeout</code> completes the caller’s future, but the underlying requests keep running for up to 30 s each, holding a connection and a thread. New requests queue for connections and time out too.',
      fix: 'Set the timeout on the request itself so the work stops and the connection is released. Keep <code>orTimeout</code> slightly longer as a backstop.',
      fixCode: `HttpRequest req = HttpRequest.newBuilder(uri)
        .timeout(Duration.ofMillis(450))        // the call itself gives up
        .GET().build();

return client.sendAsync(req, BodyHandlers.ofString())
             .thenApply(this::parse)
             .orTimeout(500, TimeUnit.MILLISECONDS);` },
    { title: 'Async audit logs lose their trace id and user',
      symptom: 'After moving audit writes to <code>@Async</code> methods returning <code>CompletableFuture</code>, audit rows have an empty <code>trace_id</code> and occasionally the <b>wrong</b> user.',
      diagnose: `// log line from the async thread
// [audit-3] traceId= user=alice   ← request was made by bob
// MDC and SecurityContextHolder are ThreadLocal-based`,
      cause: 'The callback runs on a pool thread. ThreadLocal state isn’t copied there; and because pool threads are reused, a value left behind by an earlier task (alice) leaked into a later one.',
      fix: 'Decorate the executor so each task gets the submitting thread’s context and clears it afterwards. Spring’s <code>TaskDecorator</code> is the hook.',
      fixCode: `@Bean
ThreadPoolTaskExecutor auditExecutor() {
    ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
    ex.setCorePoolSize(4); ex.setQueueCapacity(500); ex.setThreadNamePrefix("audit-");
    ex.setTaskDecorator(task -> {
        Map<String, String> mdc = MDC.getCopyOfContextMap();          // captured on the caller
        SecurityContext sec = SecurityContextHolder.getContext();
        return () -> {
            try { if (mdc != null) MDC.setContextMap(mdc); SecurityContextHolder.setContext(sec); task.run(); }
            finally { MDC.clear(); SecurityContextHolder.clearContext(); }   // no leaks into the next task
        };
    });
    return ex;
}` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Which thread runs each callback?', code: `import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        ExecutorService io = Executors.newSingleThreadExecutor(r -> new Thread(r, "io"));
        CompletableFuture<String> done = CompletableFuture.completedFuture("x");
        done.thenRun(() -> System.out.println("thenRun on " + Thread.currentThread().getName()));
        done.thenRunAsync(() -> System.out.println("thenRunAsync on " + Thread.currentThread().getName()), io).join();
        io.shutdown();
    }
}`, options: ['thenRun on io, thenRunAsync on io', 'thenRun on main, thenRunAsync on io', 'thenRun on ForkJoinPool.commonPool-worker-1, thenRunAsync on io', 'thenRun on main, thenRunAsync on main'], answer: 1, run: true, expect: 'thenRun on main\nthenRunAsync on io', explain: 'A non-async callback on an <b>already completed</b> future runs immediately, on the thread that registers it: <b>main</b>. If the future were still pending, it would run on the thread that later completes it. The <code>…Async</code> variant always goes to the given executor: <b>io</b>.' },
    { kind: 'predict', q: 'Exceptions and wrapping. What does this print?', code: `import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        CompletableFuture<String> f = CompletableFuture.failedFuture(new IllegalStateException("x"));
        String r1 = f.exceptionally(e -> e.getClass().getSimpleName()).join();
        String r2 = f.thenApply(s -> s + "!")
                     .exceptionally(e -> e.getClass().getSimpleName()).join();
        System.out.println(r1 + " " + r2);
    }
}`, options: ['IllegalStateException IllegalStateException', 'IllegalStateException CompletionException', 'CompletionException CompletionException', 'x! IllegalStateException'], answer: 1, run: true, expect: 'IllegalStateException CompletionException', explain: '<code>f</code> was completed directly with the exception, so its own handler sees the raw <b>IllegalStateException</b>. <code>thenApply</code> is skipped, and the stage it created completes with the failure <b>wrapped in a CompletionException</b>, which is what the second handler sees. Always unwrap <code>getCause()</code> before checking types.' },
    { kind: 'predict', q: '<code>handle</code> vs <code>whenComplete</code>. Output?', code: `import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        CompletableFuture<Integer> f = CompletableFuture.supplyAsync(() -> 10 / 0);
        int v = f.handle((x, e) -> e == null ? x : -1).join();
        try {
            f.whenComplete((x, e) -> { }).join();
        } catch (CompletionException e) {
            System.out.println("still failed: " + e.getCause().getClass().getSimpleName());
        }
        System.out.println(v);
    }
}`, options: ['still failed: ArithmeticException, then -1', '-1 only', 'still failed: CompletionException, then -1', 'An ArithmeticException stack trace'], answer: 0, run: true, expect: 'still failed: ArithmeticException\n-1', explain: '<code>handle</code> maps both outcomes to a value: <b>-1</b>. <code>whenComplete</code> only observes; its stage completes with the same failure, so <code>join()</code> throws a <code>CompletionException</code> whose cause is the <b>ArithmeticException</b>. Note the output order: the catch prints before <code>v</code>.' },
    { kind: 'predict', q: 'What do <code>allOf</code> and the follow-up stage return?', code: `import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        CompletableFuture<Integer> x = CompletableFuture.supplyAsync(() -> 1);
        CompletableFuture<Integer> y = CompletableFuture.supplyAsync(() -> 2);
        CompletableFuture<Void> all = CompletableFuture.allOf(x, y);
        System.out.println(all.join());
        System.out.println(all.thenApply(v -> x.join() + y.join()).join());
    }
}`, options: ['[1, 2] then 3', 'null then 3', '3 then 3', 'null then null'], answer: 1, run: true, expect: 'null\n3', explain: '<code>allOf</code> returns <code>CompletableFuture&lt;Void&gt;</code>: it only signals “all done”, so <code>join()</code> gives <b>null</b>. Read the results from the original futures inside the follow-up stage; <code>join()</code> there doesn’t block because they are complete.' },
    { kind: 'predict', q: 'A future that never completes, with two kinds of timeout. Output?', code: `import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        CompletableFuture<String> slow = new CompletableFuture<>();
        System.out.println(slow.completeOnTimeout("fallback", 50, TimeUnit.MILLISECONDS).join());

        CompletableFuture<String> slow2 = new CompletableFuture<>();
        try {
            slow2.orTimeout(50, TimeUnit.MILLISECONDS).join();
        } catch (CompletionException e) {
            System.out.println(e.getCause().getClass().getSimpleName());
        }
    }
}`, options: ['fallback, then TimeoutException', 'fallback, then it hangs', 'TimeoutException twice', 'null, then TimeoutException'], answer: 0, run: true, expect: 'fallback\nTimeoutException', explain: 'Java 9+: <code>completeOnTimeout</code> completes the future <b>normally</b> with a default value; <code>orTimeout</code> completes it <b>exceptionally</b> with <code>TimeoutException</code>. Both mutate and return the same future. The timer thread is a daemon, so the JVM still exits.' },
    { kind: 'concept', q: 'What is the type of <code>user.thenApply(u -&gt; orders.forUser(u))</code>, where <code>forUser</code> returns <code>CompletableFuture&lt;List&lt;Order&gt;&gt;</code>?', options: ['CompletableFuture<List<Order>>', 'CompletableFuture<CompletableFuture<List<Order>>>', 'List<Order>', 'It doesn’t compile'], answer: 1, explain: '<code>thenApply</code> wraps the function’s return value as-is, so you get a <b>future of a future</b>. <code>thenCompose</code> flattens it to <code>CompletableFuture&lt;List&lt;Order&gt;&gt;</code>, just as <code>flatMap</code> does for streams and Optional.' },
    { kind: 'concept', q: 'A supplier is blocked in a 30-second HTTP call. You call <code>future.cancel(true)</code>. What happens?', options: ['The worker thread is interrupted and the call aborts', 'The future completes with CancellationException; the HTTP call keeps running', 'cancel returns false because the task is running', 'The JVM kills the thread'], answer: 1, explain: 'For CompletableFuture, <code>mayInterruptIfRunning</code> “has no effect because interrupts are not used to control processing”. The future (and its dependents) complete exceptionally, but the supplier’s thread is never told. Contrast <code>FutureTask</code> from <code>ExecutorService.submit</code>, where <code>cancel(true)</code> does interrupt.' },
    { kind: 'concept', q: '<code>CompletableFuture.anyOf(primary, mirror)</code>: primary fails after 10 ms, mirror succeeds after 50 ms. The result is:', options: ['The mirror’s value, after 50 ms', 'Completed exceptionally after 10 ms', 'null', 'It waits for both'], answer: 1, explain: '<code>anyOf</code> completes with whatever finishes <b>first</b>, success or failure. Here that is the failure. For “first success wins”, attach <code>exceptionally</code> to each input that never completes on failure, or write a small helper that only completes on success and fails when all have failed.' }
  ],
  interview: [
    { q: '<code>thenApply</code> vs <code>thenCompose</code> vs <code>thenCombine</code>?', a: '<ul><li><b>thenApply(fn)</b>: T → U, like <code>map</code>.</li><li><b>thenCompose(fn)</b>: T → CompletionStage&lt;U&gt;, like <code>flatMap</code>. Use it when the next step is itself async.</li><li><b>thenCombine(other, bifn)</b>: waits for two independent stages and combines their results.</li></ul><p>Also <code>thenAccept</code> (consume), <code>thenRun</code> (ignore the value), and <code>applyToEither</code> / <code>acceptEither</code> (first of two).</p>', lvl: 'core' },
    { q: 'Which thread runs a non-async callback?', a: '<p>If the stage is still pending when you register the callback, the thread that later <b>completes</b> it runs the callback (often a pool thread or an HTTP client’s I/O thread). If it is already complete, the <b>registering</b> thread runs it immediately. That is non-deterministic in general, so heavy or blocking callbacks should use <code>…Async(fn, executor)</code>. Running a heavy callback on a Netty event loop or the JDK HttpClient’s selector thread stalls other connections.</p>', lvl: 'core' },
    { q: 'What executor does <code>supplyAsync</code> use by default, and why does it matter?', a: '<p><code>ForkJoinPool.commonPool()</code>, whose parallelism defaults to the number of CPUs minus one (if that is below 2, CompletableFuture uses a new thread per task instead). It is shared JVM-wide, including by parallel streams. Blocking I/O there starves everything else. Pass an executor for I/O, and size it (or use virtual threads on Java 21).</p>', fu: 'Can you change the common pool size? (<code>-Djava.util.concurrent.ForkJoinPool.common.parallelism=N</code>, but fixing the executor choice is better.)', lvl: 'core' },
    { q: 'How do exceptions propagate through a chain?', a: '<p>When a stage fails, every dependent normal stage (<code>thenApply</code>, <code>thenCompose</code>, …) is skipped and completes exceptionally with a <code>CompletionException</code> wrapping the cause. <code>exceptionally(fn)</code> runs only on failure and returns a replacement value; <code>handle(fn)</code> runs on both; <code>whenComplete</code> runs on both but passes the original outcome through. Java 12+ has <code>exceptionallyCompose</code> for async fallbacks. <code>join()</code> throws <code>CompletionException</code>; <code>get()</code> throws checked <code>ExecutionException</code>.</p>', lvl: 'core' },
    { q: 'How do you implement a timeout?', a: '<p>Java 9+: <code>orTimeout(d, unit)</code> fails the future with <code>TimeoutException</code>; <code>completeOnTimeout(v, d, unit)</code> completes it with a default. Both only affect the future, not the underlying work, so also configure the client’s own timeout. On Java 8 you would schedule <code>completeExceptionally</code> on a <code>ScheduledExecutorService</code> and use <code>applyToEither</code>.</p>', lvl: 'core' },
    { q: 'How do <code>allOf</code> and <code>anyOf</code> behave?', a: '<p><code>allOf(cfs…)</code> returns <code>CompletableFuture&lt;Void&gt;</code> that completes when all inputs complete; if any failed, it completes exceptionally (with one of the failures), but only <b>after all</b> have finished. You then read results via <code>join()</code> on each input. <code>anyOf</code> returns <code>CompletableFuture&lt;Object&gt;</code> completed by the first input to finish, success or failure. Neither cancels the others.</p>', fu: 'How do you collect a List from many futures? (<code>allOf(arr).thenApply(v -&gt; list.stream().map(CompletableFuture::join).toList())</code>.)', lvl: 'core' },
    { q: 'What is the difference between <code>join()</code> and <code>get()</code>?', a: '<p>Both block. <code>get()</code> is from <code>Future</code>: it throws checked <code>ExecutionException</code> and <code>InterruptedException</code>, and has a timed overload. <code>join()</code> throws unchecked <code>CompletionException</code> (or <code>CancellationException</code>), so it fits in lambdas, and isn’t interruptible. Java 19 added <code>resultNow()</code>, <code>exceptionNow()</code> and <code>state()</code> to <code>Future</code> for already-completed futures.</p>', lvl: 'core' },
    { q: 'How does CompletableFuture fit with Spring?', a: '<p><code>@Async</code> methods may return <code>CompletableFuture&lt;T&gt;</code>; Spring completes it from its task executor. Spring MVC controllers may return a <code>CompletableFuture</code>: the servlet thread is released and the response is written when it completes (async request processing). Thread-bound context (transactions, SecurityContext, MDC) doesn’t follow by default; use a <code>TaskDecorator</code> or context propagation. In WebFlux you would use <code>Mono.fromFuture</code>.</p>', lvl: 'deep' },
    { q: 'CompletableFuture vs virtual threads: when would you choose which?', a: '<p>On Java 21, many fan-out/fan-in flows read more simply as plain blocking code on virtual threads: submit tasks to a <code>newVirtualThreadPerTaskExecutor()</code>, call <code>get()</code>, and stack traces and debuggers make sense again. CompletableFuture still shines for composing callbacks from non-blocking APIs (the JDK <code>HttpClient.sendAsync</code>, reactive drivers), for timeouts and fallbacks as values, and on platform threads where blocking is expensive. Structured concurrency (preview in 21) aims to replace much of the fan-out use case.</p>', lvl: 'deep' },
    { q: 'How do you avoid blocking inside a chain?', a: '<p>Don’t call <code>join()</code> or <code>get()</code> inside a callback. Use <code>thenCompose</code> to sequence async calls and <code>thenCombine</code> / <code>allOf</code> to wait for several. A <code>join()</code> inside a callback that runs on a bounded pool can cause a thread-starvation deadlock: the callback waits for work that needs a thread from the same pool.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Fan-out aggregator with timeouts and fallbacks', lang: 'java', code: `@Service
class ProductPageService {
    private final ExecutorService io = Executors.newVirtualThreadPerTaskExecutor();   // Java 21

    CompletableFuture<ProductPage> page(String sku) {
        var price   = supplyAsync(() -> pricing.price(sku), io)
                        .completeOnTimeout(Price.UNKNOWN, 300, MILLISECONDS);     // optional data
        var stock   = supplyAsync(() -> inventory.stock(sku), io)
                        .orTimeout(500, MILLISECONDS);                            // required data
        var reviews = supplyAsync(() -> reviewsApi.top(sku, 5), io)
                        .exceptionally(ex -> List.of());                         // degrade quietly

        return CompletableFuture.allOf(price, stock, reviews)
                .thenApply(v -> new ProductPage(sku, price.join(), stock.join(), reviews.join()))
                .whenComplete((p, ex) -> { if (ex != null) log.warn("page {} failed", sku, ex); });
    }
}`, note: 'The timeouts above protect the caller only. The clients behind <code>pricing</code>, <code>inventory</code> and <code>reviewsApi</code> still need their own connect and read timeouts.' },
    { title: 'Spring MVC: return the future, free the request thread', lang: 'java', code: `@RestController
class QuoteController {
    private final QuoteService quotes;

    @GetMapping("/quotes/{sku}")
    CompletableFuture<ResponseEntity<Quote>> quote(@PathVariable String sku) {
        return quotes.quote(sku)                                   // CompletableFuture<Quote>
                .thenApply(ResponseEntity::ok)
                .exceptionally(ex -> {
                    Throwable cause = ex instanceof CompletionException ce ? ce.getCause() : ex;
                    return cause instanceof TimeoutException
                            ? ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT).build()
                            : ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
                });
    }
}`, note: 'Spring MVC treats a returned <code>CompletableFuture</code> as async request processing. <code>spring.mvc.async.request-timeout</code> sets the outer limit.' },
    { title: 'Collect a list of results', lang: 'java', code: `static <T> CompletableFuture<List<T>> sequence(List<CompletableFuture<T>> futures) {
    return CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new))
            .thenApply(v -> futures.stream().map(CompletableFuture::join).toList());
}

// usage: fetch 50 customers concurrently, at most 10 at a time
Semaphore limit = new Semaphore(10);
List<CompletableFuture<Customer>> fs = ids.stream()
        .map(id -> CompletableFuture.supplyAsync(() -> {
            limit.acquireUninterruptibly();
            try { return crm.get(id); } finally { limit.release(); }
        }, io))
        .toList();
List<Customer> all = sequence(fs).join();`, note: 'If any input fails, <code>allOf</code> fails after every input has finished, and the <code>join()</code> calls inside <code>thenApply</code> never run.' }
  ]
});

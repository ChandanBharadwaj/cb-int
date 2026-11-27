IA.register({
  track: 'java',
  slug: 'completablefuture',
  title: 'CompletableFuture',
  tagline: 'A <code>CompletableFuture</code> is one step in a chain of steps. Each <code>then…</code> call adds a step. It runs when its inputs are ready, on <i>some</i> thread. Most bugs come from three questions. Which method: <code>thenApply</code> or <code>thenCompose</code>? Which thread runs the callback? Where did the exception go?',
  tldr: {
    problem: 'Async code that is slower than the blocking version. Exceptions that vanish. “Timeouts” that leave work running. Nested <code>CompletableFuture&lt;CompletableFuture&lt;T&gt;&gt;</code>. And a shared pool clogged by slow I/O.',
    model: '<code>thenApply</code> = map (T → U). <code>thenCompose</code> = flatMap (T → CF&lt;U&gt;). <code>thenCombine</code> joins two. A failure skips every normal step after it. Each one fails with a <code>CompletionException</code>, until <code>exceptionally</code> / <code>handle</code> turns it back into a value. Plain callbacks run on the thread that finished the step before. If that step is already done, they run on the caller. <code>…Async</code> with no executor runs on <code>ForkJoinPool.commonPool()</code>.',
    hook: '“Does <code>future.cancel(true)</code> or <code>orTimeout</code> stop the HTTP call?” No. They only finish the future. The thread doing the work keeps going. Put the timeout on the client.',
    facts: [
      { v: 'Java 8', l: 'introduced <code>CompletableFuture</code> and <code>CompletionStage</code>. Java 9 added <code>orTimeout</code>, <code>completeOnTimeout</code>, <code>failedFuture</code> and <code>delayedExecutor</code>; Java 12 added <code>exceptionallyCompose</code>' },
      { v: 'cores − 1', l: 'threads in <code>ForkJoinPool.commonPool()</code> by default. Every <code>…Async</code> call with no executor uses it. Parallel streams share it' },
      { v: 'no interrupt', l: '<code>cancel(true)</code> on a CompletableFuture finishes it with <code>CancellationException</code>. The <code>mayInterruptIfRunning</code> flag does nothing to the running task' }
    ]
  },
  intro: {
    what: 'Some work takes time: calling a service, reading a file, querying a database. You don’t have to make a thread wait for it. Start it and get back a box that will hold the result later (a <b>future</b>). A <code>CompletableFuture</code> lets you say <i>what to do next</i> when the box fills. “Then change it.” “Then call another service with it.” “When both are done, combine them.” “If it fails, use a default.” The steps run as results arrive.',
    analogy: { icon: '🧾', title: 'Restaurant buzzers', text: 'You order and get a buzzer, instead of standing at the counter. You can say “when the burger buzzes, add ketchup” (thenApply). Or “when it buzzes, order a dessert and give me the dessert’s buzzer” (thenCompose). Or “when the burger <i>and</i> the fries buzz, put them on one tray” (thenCombine). If the kitchen burns the burger, every “then” step is skipped. Until someone says “in that case, give me a salad” (exceptionally).' },
    steps: [
      { t: 'Start async work on your own executor', d: 'Pass an executor sized for the job. Without one, the work runs on the shared common pool.', code: 'CompletableFuture<User> user =\n    CompletableFuture.supplyAsync(() -> userClient.get(id), ioPool);' },
      { t: 'Chain the next step', d: '<code>thenApply</code> for a plain transformation, <code>thenCompose</code> when the next step itself returns a future.', code: 'CompletableFuture<List<Order>> orders =\n    user.thenCompose(u -> orderClient.forUser(u.id()));   // returns CF<List<Order>>' },
      { t: 'Combine and handle failure', d: 'Run independent calls in parallel, combine their results, and decide what a failure turns into.', code: 'price.thenCombine(stock, Offer::new)\n     .exceptionally(ex -> Offer.unavailable());' },
      { t: 'Block only at the edge', d: 'Call <code>join()</code> (or <code>get(timeout)</code>) once, at the edge. Or return the future to a framework that handles it (Spring MVC, WebFlux).' }
    ],
    terms: [
      ['stage', 'One step in the pipeline (<code>CompletionStage</code>). Each <code>then…</code> call returns a new stage.'],
      ['thenApply / thenCompose', 'Map vs flat-map. Compose avoids <code>CompletableFuture&lt;CompletableFuture&lt;T&gt;&gt;</code>.'],
      ['…Async variants', 'Run the callback on an executor instead of on the completing thread.'],
      ['commonPool', 'The JVM-wide <code>ForkJoinPool</code> used by default for async work and parallel streams.'],
      ['CompletionException', 'The unchecked wrapper around a failure as it passes through steps and <code>join()</code>.'],
      ['allOf / anyOf', 'Wait for all of several futures (result <code>Void</code>), or the first to finish (result <code>Object</code>).']
    ]
  },
  visual: {
    title: 'Watch the dependency graph fire',
    caption: 'Pick a scenario and press Play or Step. Each box is a step. Dashed = not done, blue = running, green = done with a value, red = failed. An arrow lights up when one step triggers the next. The second line of each box shows the value and the thread that ran it.'
  },
  gotchas: [
    { trap: 'Blocking I/O on the common pool', code: `CompletableFuture.supplyAsync(() -> restTemplate.getForObject(url, Quote.class));
// no executor → ForkJoinPool.commonPool(): cores − 1 threads for the whole JVM`, why: 'The common pool is small. Every parallel stream and default async call shares it. A few slow HTTP calls take all its threads, and other work waits behind them.', fix: 'Always pass an executor for I/O. Use a <code>ThreadPoolExecutor</code> with limits, or on Java 21 <code>Executors.newVirtualThreadPerTaskExecutor()</code>. Keep the common pool for short CPU work.' },
    { trap: '<code>thenApply</code> with a function that returns a future', code: `CompletableFuture<CompletableFuture<List<Order>>> nested =
    user.thenApply(u -> orderClient.forUser(u.id()));   // ✗ a future of a future`, why: '<code>thenApply</code> wraps whatever the function returns. If that is a future, you get a future inside a future. Calling <code>join()</code> on the outer one gives you an unfinished inner one.', fix: 'Use <code>thenCompose</code> (flatMap). Rule: if your lambda returns a <code>CompletableFuture</code>, compose.' },
    { trap: 'Exceptions vanish in fire-and-forget chains', code: `CompletableFuture.runAsync(() -> audit.write(event), pool);   // result never read`, why: 'A failure marks the future as failed and stops there. Unlike a <code>Thread</code>, no default handler prints it. If nobody joins or adds a handler, the error is never logged.', fix: 'End fire-and-forget chains with <code>.whenComplete((r, ex) -&gt; { if (ex != null) log.error(…); })</code> or <code>.exceptionally(…)</code>.' },
    { trap: '<code>orTimeout</code> and <code>cancel</code> don’t stop the work', why: 'They finish <i>the future</i> with <code>TimeoutException</code> or <code>CancellationException</code>. A CompletableFuture has no link to the thread doing the work. So the HTTP call keeps going, with its thread and connection.', fix: 'Set timeouts where the work happens: connect and read timeouts on the HTTP client, <code>statement_timeout</code> on the query. Keep <code>orTimeout</code> as a last safety net for the caller.' },
    { trap: '<code>whenComplete</code> doesn’t recover; <code>handle</code> does', code: `f.whenComplete((v, ex) -> log.warn("failed", ex))   // still failed afterwards
 .handle((v, ex) -> ex == null ? v : DEFAULT);        // now a normal value`, why: '<code>whenComplete</code> only looks. Its step keeps the original result or exception. <code>handle</code> and <code>exceptionally</code> turn the outcome into a new value.', fix: 'Log with <code>whenComplete</code>, recover with <code>exceptionally</code> (failure only) or <code>handle</code> (both cases).' },
    { trap: 'Unwrapping the wrong exception', code: `.exceptionally(ex -> ex instanceof PartnerDownException ? fallback() : rethrow(ex))
// ex is often a CompletionException wrapping PartnerDownException`, why: 'Failures from an earlier step arrive wrapped in <code>CompletionException</code>. So do exceptions thrown inside <code>supplyAsync</code>. Only a future failed directly, with <code>completeExceptionally</code> / <code>failedFuture</code>, gives its own handlers the bare exception.', fix: 'Unwrap: <code>Throwable cause = ex instanceof CompletionException ce &amp;&amp; ce.getCause() != null ? ce.getCause() : ex;</code>' },
    { trap: 'ThreadLocals don’t follow the callback', why: 'MDC (trace ids), Spring Security’s <code>SecurityContextHolder</code>, and transaction state live on one thread. A callback on another pool thread sees none of them. Worse, it may see old values left by an earlier task.', fix: 'Grab what you need before going async and pass it along. Or wrap the executor so it copies context (Spring <code>TaskDecorator</code>, <code>ContextExecutorService</code> from Micrometer context-propagation). Or use <code>DelegatingSecurityContextExecutor</code>.' }
  ],
  scenarios: [
    { title: 'Parallel stream reports get slow whenever a partner is slow',
      symptom: 'A nightly report built with <code>parallelStream()</code> usually takes 2 minutes. When the pricing partner is slow, it takes 40. Yet the report never calls the partner.',
      diagnose: `jcmd <pid> Thread.print | grep -A4 'ForkJoinPool.commonPool-worker'
# "ForkJoinPool.commonPool-worker-3" RUNNABLE
#   at sun.nio.ch.SocketDispatcher.read0(Native Method)
#   ...
#   at PricingClient.quote(PricingClient.java:52)
#   at CompletableFuture$AsyncSupply.run(...)
# all 7 workers (8 vCPU − 1) are in PricingClient`,
      cause: 'Pricing calls use <code>supplyAsync</code> with no executor, so they run on the common pool. When the partner slows down, its calls hold every worker. The parallel stream’s tasks wait behind them.',
      fix: 'Give I/O its own executor. Keep the common pool for CPU work. On Java 21, virtual threads suit many blocking calls.',
      fixCode: `private final ExecutorService pricingPool =
        Executors.newVirtualThreadPerTaskExecutor();          // Java 21; or a bounded TPE

CompletableFuture<Quote> quote(String sku) {
    return CompletableFuture.supplyAsync(() -> client.quote(sku), pricingPool)
                            .orTimeout(2, TimeUnit.SECONDS);   // caller-side safety net
}` },
    { title: 'Gateway returns 504 quickly, but the partner connection pool is always exhausted',
      symptom: 'After adding <code>orTimeout(500 ms)</code>, the API answers 504 when the partner is slow, as planned. But the HTTP client’s connection pool stays full, and even fast requests start timing out.',
      diagnose: `// metrics
http.client.connections.active{pool="partner"}   100 / 100
http.client.requests{outcome="timeout"}          rising
// the client was built with no read timeout:
HttpClient.newBuilder().build();    // request timeout not set`,
      cause: '<code>orTimeout</code> finishes the caller’s future. But the real requests keep running for up to 30 s each, holding a connection and a thread. New requests queue for connections and time out too.',
      fix: 'Set the timeout on the request itself, so the work stops and the connection is freed. Keep <code>orTimeout</code> a bit longer, as a backup.',
      fixCode: `HttpRequest req = HttpRequest.newBuilder(uri)
        .timeout(Duration.ofMillis(450))        // the call itself gives up
        .GET().build();

return client.sendAsync(req, BodyHandlers.ofString())
             .thenApply(this::parse)
             .orTimeout(500, TimeUnit.MILLISECONDS);` },
    { title: 'Async audit logs lose their trace id and user',
      symptom: 'Audit writes moved to <code>@Async</code> methods that return <code>CompletableFuture</code>. Now audit rows have an empty <code>trace_id</code>, and sometimes the <b>wrong</b> user.',
      diagnose: `// log line from the async thread
// [audit-3] traceId= user=alice   ← request was made by bob
// MDC and SecurityContextHolder are ThreadLocal-based`,
      cause: 'The callback runs on a pool thread. ThreadLocal values aren’t copied there. Pool threads are reused, so a value left by an earlier task (alice) leaked into a later one.',
      fix: 'Wrap the executor so each task gets the caller’s context and clears it afterwards. Spring’s <code>TaskDecorator</code> does this.',
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
}`, options: ['thenRun on io, thenRunAsync on io', 'thenRun on main, thenRunAsync on io', 'thenRun on ForkJoinPool.commonPool-worker-1, thenRunAsync on io', 'thenRun on main, thenRunAsync on main'], answer: 1, run: true, expect: 'thenRun on main\nthenRunAsync on io', explain: 'A plain callback on a future that is <b>already done</b> runs at once, on the thread that adds it: <b>main</b>. If the future were still pending, it would run on the thread that later finishes it. The <code>…Async</code> variant always goes to the given executor: <b>io</b>.' },
    { kind: 'predict', q: 'Exceptions and wrapping. What does this print?', code: `import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        CompletableFuture<String> f = CompletableFuture.failedFuture(new IllegalStateException("x"));
        String r1 = f.exceptionally(e -> e.getClass().getSimpleName()).join();
        String r2 = f.thenApply(s -> s + "!")
                     .exceptionally(e -> e.getClass().getSimpleName()).join();
        System.out.println(r1 + " " + r2);
    }
}`, options: ['IllegalStateException IllegalStateException', 'IllegalStateException CompletionException', 'CompletionException CompletionException', 'x! IllegalStateException'], answer: 1, run: true, expect: 'IllegalStateException CompletionException', explain: '<code>f</code> was failed directly with the exception. So its own handler sees the bare <b>IllegalStateException</b>. <code>thenApply</code> is skipped. Its step fails with the error <b>wrapped in a CompletionException</b>. That is what the second handler sees. Always unwrap <code>getCause()</code> before checking types.' },
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
}`, options: ['still failed: ArithmeticException, then -1', '-1 only', 'still failed: CompletionException, then -1', 'An ArithmeticException stack trace'], answer: 0, run: true, expect: 'still failed: ArithmeticException\n-1', explain: '<code>handle</code> turns both outcomes into a value: <b>-1</b>. <code>whenComplete</code> only looks. Its step fails with the same error, so <code>join()</code> throws a <code>CompletionException</code>. Its cause is the <b>ArithmeticException</b>. Note the order: the catch prints before <code>v</code>.' },
    { kind: 'predict', q: 'What do <code>allOf</code> and the follow-up stage return?', code: `import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        CompletableFuture<Integer> x = CompletableFuture.supplyAsync(() -> 1);
        CompletableFuture<Integer> y = CompletableFuture.supplyAsync(() -> 2);
        CompletableFuture<Void> all = CompletableFuture.allOf(x, y);
        System.out.println(all.join());
        System.out.println(all.thenApply(v -> x.join() + y.join()).join());
    }
}`, options: ['[1, 2] then 3', 'null then 3', '3 then 3', 'null then null'], answer: 1, run: true, expect: 'null\n3', explain: '<code>allOf</code> returns <code>CompletableFuture&lt;Void&gt;</code>. It only says “all done”, so <code>join()</code> gives <b>null</b>. Read the results from the original futures in the next step. <code>join()</code> there doesn’t wait, because they are done.' },
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
}`, options: ['fallback, then TimeoutException', 'fallback, then it hangs', 'TimeoutException twice', 'null, then TimeoutException'], answer: 0, run: true, expect: 'fallback\nTimeoutException', explain: 'Java 9+: <code>completeOnTimeout</code> finishes the future <b>normally</b>, with a default value. <code>orTimeout</code> <b>fails</b> it with <code>TimeoutException</code>. Both change and return the same future. The timer thread is a daemon, so the JVM still exits.' },
    { kind: 'concept', q: 'What is the type of <code>user.thenApply(u -&gt; orders.forUser(u))</code>, where <code>forUser</code> returns <code>CompletableFuture&lt;List&lt;Order&gt;&gt;</code>?', options: ['CompletableFuture<List<Order>>', 'CompletableFuture<CompletableFuture<List<Order>>>', 'List<Order>', 'It doesn’t compile'], answer: 1, explain: '<code>thenApply</code> wraps the function’s result as-is, so you get a <b>future of a future</b>. <code>thenCompose</code> flattens it to <code>CompletableFuture&lt;List&lt;Order&gt;&gt;</code>. That is what <code>flatMap</code> does for streams and Optional.' },
    { kind: 'concept', q: 'A supplier is blocked in a 30-second HTTP call. You call <code>future.cancel(true)</code>. What happens?', options: ['The worker thread is interrupted and the call aborts', 'The future completes with CancellationException; the HTTP call keeps running', 'cancel returns false because the task is running', 'The JVM kills the thread'], answer: 1, explain: 'For CompletableFuture, <code>mayInterruptIfRunning</code> does nothing. The future and the steps after it fail, but the worker thread is never told. Contrast <code>FutureTask</code> from <code>ExecutorService.submit</code>, where <code>cancel(true)</code> does interrupt.' },
    { kind: 'concept', q: '<code>CompletableFuture.anyOf(primary, mirror)</code>: primary fails after 10 ms, mirror succeeds after 50 ms. The result is:', options: ['The mirror’s value, after 50 ms', 'Completed exceptionally after 10 ms', 'null', 'It waits for both'], answer: 1, explain: '<code>anyOf</code> completes with whatever finishes <b>first</b>, success or failure. Here that is the failure. For “first success wins”, write a small helper. It finishes on the first success, and fails only when all have failed.' }
  ],
  interview: [
    { q: '<code>thenApply</code> vs <code>thenCompose</code> vs <code>thenCombine</code>?', a: '<ul><li><b>thenApply(fn)</b>: T → U, like <code>map</code>.</li><li><b>thenCompose(fn)</b>: T → CompletionStage&lt;U&gt;, like <code>flatMap</code>. Use it when the next step is itself async.</li><li><b>thenCombine(other, bifn)</b>: waits for two separate steps and combines their results.</li></ul><p>Also <code>thenAccept</code> (use the value), <code>thenRun</code> (ignore it), and <code>applyToEither</code> / <code>acceptEither</code> (first of two).</p>', lvl: 'core' },
    { q: 'Which thread runs a non-async callback?', a: '<p>If the step is still pending when you add the callback, the thread that later <b>finishes</b> it runs the callback. That is often a pool thread or an HTTP client’s I/O thread. If it is already done, the thread that <b>adds</b> it runs it at once. You can’t predict which, so heavy or blocking callbacks should use <code>…Async(fn, executor)</code>. Running a heavy callback on a Netty event loop or the JDK HttpClient’s selector thread stalls other connections.</p>', lvl: 'core' },
    { q: 'What executor does <code>supplyAsync</code> use by default, and why does it matter?', a: '<p><code>ForkJoinPool.commonPool()</code>. By default it has one thread fewer than the CPU count. (If that is below 2, CompletableFuture starts a new thread per task instead.) The whole JVM shares it, parallel streams too. Slow I/O there starves everything else. Pass a sized executor for I/O, or use virtual threads on Java 21.</p>', fu: 'Can you change the common pool size? (<code>-Djava.util.concurrent.ForkJoinPool.common.parallelism=N</code>. But picking the right executor is better.)', lvl: 'core' },
    { q: 'How do exceptions propagate through a chain?', a: '<p>When a step fails, every normal step after it (<code>thenApply</code>, <code>thenCompose</code>, …) is skipped. Each fails with a <code>CompletionException</code> wrapping the cause. <code>exceptionally(fn)</code> runs only on failure and returns a stand-in value. <code>handle(fn)</code> runs in both cases. <code>whenComplete</code> runs in both cases but passes the original outcome on. Java 12+ has <code>exceptionallyCompose</code> for async fallbacks. <code>join()</code> throws <code>CompletionException</code>. <code>get()</code> throws the checked <code>ExecutionException</code>.</p>', lvl: 'core' },
    { q: 'How do you implement a timeout?', a: '<p>Java 9+: <code>orTimeout(d, unit)</code> fails the future with <code>TimeoutException</code>. <code>completeOnTimeout(v, d, unit)</code> finishes it with a default. Both affect only the future, not the work. So set the client’s own timeout too. On Java 8, schedule <code>completeExceptionally</code> on a <code>ScheduledExecutorService</code> and use <code>applyToEither</code>.</p>', lvl: 'core' },
    { q: 'How do <code>allOf</code> and <code>anyOf</code> behave?', a: '<p><code>allOf(cfs…)</code> returns a <code>CompletableFuture&lt;Void&gt;</code>. It finishes when all inputs finish. If any failed, it fails with one of the errors, but only <b>after all</b> are done. Then read each result with <code>join()</code>. <code>anyOf</code> returns a <code>CompletableFuture&lt;Object&gt;</code>. The first input to finish sets it, success or failure. Neither cancels the others.</p>', fu: 'How do you collect a List from many futures? (<code>allOf(arr).thenApply(v -&gt; list.stream().map(CompletableFuture::join).toList())</code>.)', lvl: 'core' },
    { q: 'What is the difference between <code>join()</code> and <code>get()</code>?', a: '<p>Both wait. <code>get()</code> comes from <code>Future</code>. It throws the checked <code>ExecutionException</code> and <code>InterruptedException</code>, and has a version with a timeout. <code>join()</code> throws the unchecked <code>CompletionException</code> (or <code>CancellationException</code>). So it fits in lambdas. You can’t interrupt it. Java 19 added <code>resultNow()</code>, <code>exceptionNow()</code> and <code>state()</code> to <code>Future</code> for already-completed futures.</p>', lvl: 'core' },
    { q: 'How does CompletableFuture fit with Spring?', a: '<p><code>@Async</code> methods may return <code>CompletableFuture&lt;T&gt;</code>. Spring finishes it from its task executor. Spring MVC controllers may return a <code>CompletableFuture</code>. The servlet thread is freed, and the response is written when the future finishes. Thread-bound context (transactions, SecurityContext, MDC) doesn’t follow by default. Use a <code>TaskDecorator</code> or context propagation. In WebFlux you would use <code>Mono.fromFuture</code>.</p>', lvl: 'deep' },
    { q: 'CompletableFuture vs virtual threads: when would you choose which?', a: '<p>On Java 21, many “start several calls, then combine” flows read better as plain blocking code on virtual threads. Submit tasks to a <code>newVirtualThreadPerTaskExecutor()</code> and call <code>get()</code>. Stack traces and debuggers make sense again. CompletableFuture still shines for chaining callbacks from non-blocking APIs (the JDK <code>HttpClient.sendAsync</code>, reactive drivers). Also for timeouts and fallbacks as values, and on platform threads where blocking is costly. Structured concurrency (preview in 21) aims to replace much of the fan-out use.</p>', lvl: 'deep' },
    { q: 'How do you avoid blocking inside a chain?', a: '<p>Don’t call <code>join()</code> or <code>get()</code> inside a callback. Use <code>thenCompose</code> to run async calls in order. Use <code>thenCombine</code> / <code>allOf</code> to wait for several. A <code>join()</code> inside a callback on a fixed-size pool can deadlock. The callback waits for work that needs a thread from the same pool.</p>', lvl: 'deep' }
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
}`, note: 'Spring MVC handles a returned <code>CompletableFuture</code> as an async request. <code>spring.mvc.async.request-timeout</code> sets the outer limit.' },
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
List<Customer> all = sequence(fs).join();`, note: 'If any input fails, <code>allOf</code> fails once every input is done. The <code>join()</code> calls inside <code>thenApply</code> never run.' }
  ]
});

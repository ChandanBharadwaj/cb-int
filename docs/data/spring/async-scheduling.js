IA.register({
  track: 'spring',
  slug: 'async-scheduling',
  title: '@Async & scheduling',
  tagline: '<code>@Async</code> hands your method call to an <b>executor</b> through a proxy and returns at once. The work then runs on another thread, which means without the caller’s ThreadLocals: no security context, no MDC trace id, no transaction, no request. <code>@Scheduled</code> runs jobs on a scheduler thread, on <i>every</i> instance, unless something like ShedLock says otherwise. Boot 3.2 adds virtual threads to both.',
  tldr: {
    problem: 'Emails sent with no trace id in the logs, <code>getAuthentication()</code> returning null in a background task, a nightly job that ran four times because there are four pods, or an async pool silently queueing 50 000 tasks.',
    model: 'The proxy’s <code>AsyncExecutionInterceptor</code> wraps the call in a task and submits it to an <code>Executor</code> (Boot’s <code>applicationTaskExecutor</code>: 8 core threads, unbounded queue). Everything stored in ThreadLocals stays on the caller’s thread unless a <code>TaskDecorator</code> copies it. Scheduling is per JVM: a distributed lock (ShedLock) turns “every pod” into “one pod”.',
    hook: '“Why is <code>SecurityContextHolder</code> empty inside my @Async method?” It is a ThreadLocal, and the method runs on a pool thread. Wrap the executor (<code>DelegatingSecurityContextAsyncTaskExecutor</code>) or use a context-propagating <code>TaskDecorator</code>.',
    facts: [
      { v: '8 threads', l: 'Boot’s auto-configured <code>applicationTaskExecutor</code>: core size 8 with an unbounded queue, so extra tasks queue rather than add threads' },
      { v: '1 thread', l: 'Boot’s default <code>@Scheduled</code> pool size (<code>spring.task.scheduling.pool.size</code>): one slow job delays all others' },
      { v: 'Boot 3.2', l: '<code>spring.threads.virtual.enabled=true</code> (Java 21+) switches Tomcat, the task executor and the scheduler to virtual threads' }
    ]
  },
  intro: {
    what: 'Sometimes a request shouldn’t wait for slow side work, like sending an email. <code>@Async</code> says “run this on another thread and don’t wait”. <code>@Scheduled</code> says “run this every 5 minutes” or “at 02:00”. Both are easy to add and both run your code on threads you didn’t create, which changes what that code can see.',
    analogy: { icon: '📮', title: 'Dropping a letter in a mailbox', text: 'You hand the letter over and walk away; a postal worker delivers it later. The worker doesn’t have your house keys, your ID badge or your notes, only what you wrote in the letter. If you want them to know something, it has to go in the envelope (the task decorator).' },
    steps: [
      { t: 'Enable it', d: '<code>@EnableAsync</code> and/or <code>@EnableScheduling</code> on a configuration class.' },
      { t: 'Annotate a public method on a bean', d: 'Called from another bean, through the proxy. Return <code>void</code> or <code>CompletableFuture</code>.', code: '@Async\npublic CompletableFuture<Receipt> send(Order o) { … }' },
      { t: 'The proxy submits a task', d: 'The caller gets control back immediately (or a future). A pool thread runs the method later.' },
      { t: 'Carry context explicitly', d: 'Pass what you need as arguments, or use a <code>TaskDecorator</code> to copy MDC, security and tracing context.' },
      { t: 'Schedule with care', d: '<code>@Scheduled(fixedDelay = 60_000)</code> runs on each instance. Add ShedLock for jobs that must run once per cluster.' }
    ],
    terms: [
      ['TaskExecutor', 'Spring’s executor abstraction; <code>ThreadPoolTaskExecutor</code> wraps a JDK thread pool.'],
      ['TaskDecorator', 'Wraps each submitted <code>Runnable</code>; used to copy ThreadLocal context to the worker.'],
      ['fixedRate / fixedDelay', 'Start every N ms vs wait N ms after the previous run ends.'],
      ['cron', 'Spring cron has 6 fields, seconds first: <code>0 0 2 * * *</code> = 02:00 daily.'],
      ['ShedLock', 'A library that takes a lock row (DB, Redis…) so only one instance runs a scheduled job.'],
      ['virtual thread', 'A JDK 21 thread that is cheap to create and block; the JVM mounts it on a small pool of carrier threads.']
    ]
  },
  visual: {
    title: 'Watch a call hop threads',
    caption: 'The left box is the request thread with its ThreadLocals; the right is the worker that runs the <code>@Async</code> method. Press Play and see what survives the hand-off. Then add a <b>TaskDecorator</b>, fill the pool to see queueing, and switch to <b>virtual threads</b>.'
  },
  extras: [
    { id: 'async-scheduling-shedlock', title: '@Scheduled on three pods, with and without ShedLock', label: 'ShedLock', caption: 'A cron job fires at the same second on three instances. Step through without a lock, with ShedLock, and with a pod that dies holding the lock to see what <code>lockAtMostFor</code> and <code>lockAtLeastFor</code> are for.' }
  ],
  gotchas: [
    { trap: 'Context is lost on the worker thread', code: `@Async
public void exportReport(long id) {
  var user = SecurityContextHolder.getContext().getAuthentication();   // null
  log.info("export {}", id);                                           // no traceId in MDC
}`, why: 'Security context, MDC, request attributes and Micrometer/OTel context are ThreadLocals of the request thread. The task runs on <code>task-3</code>, where they are empty.', fix: 'Pass values as arguments where you can. Otherwise register a <code>TaskDecorator</code> bean (Boot applies it to the auto-configured executor): Spring 6.1’s <code>ContextPropagatingTaskDecorator</code> propagates Micrometer-registered context (tracing, MDC with the right accessors); wrap with <code>DelegatingSecurityContextAsyncTaskExecutor</code> for security.' },
    { trap: 'Expecting the caller’s transaction', code: `@Transactional
public void place(Order o) { repo.save(o); mailer.sendConfirmation(o); }   // @Async inside

@Async
public void sendConfirmation(Order o) { o.getLines().size(); }   // LazyInitializationException`, why: 'Transactions are bound to the thread. The async method runs outside the caller’s transaction, may run before it commits (seeing no row), and has no open persistence context for lazy loading.', fix: 'Pass ids, not entities, and load what you need inside the async method (with its own <code>@Transactional</code> if needed). To run only after commit, trigger it from an <code>@TransactionalEventListener(phase = AFTER_COMMIT)</code>. See <a href="transactions-propagation.html">@Transactional</a>.' },
    { trap: 'Unbounded queue hides overload', why: 'Boot’s default executor has 8 core threads and an unbounded queue, so it never grows past 8 and never rejects. Under load, tasks queue for minutes, memory grows, and on shutdown queued work is lost.', fix: 'Size it for the work (<code>spring.task.execution.pool.core-size</code>, <code>max-size</code>, <code>queue-capacity</code>), choose a rejection policy (<code>CallerRunsPolicy</code> applies back-pressure), and export <code>executor.queued</code> / <code>executor.active</code> metrics.' },
    { trap: 'Exceptions from void @Async methods vanish', why: 'There is no caller to throw to. For <code>void</code> methods, Spring passes the exception to an <code>AsyncUncaughtExceptionHandler</code>, which by default only logs it. For <code>CompletableFuture</code> methods, it completes the future exceptionally, and nobody sees it if nobody looks.', fix: 'Return <code>CompletableFuture</code> and handle completion, or implement <code>AsyncConfigurer.getAsyncUncaughtExceptionHandler()</code> to count and alert.' },
    { trap: 'Self-invoked or private @Async runs synchronously', code: `public void checkout(Cart c) { …; this.notifyWarehouse(c); }   // blocks the request
@Async public void notifyWarehouse(Cart c) { … }`, why: 'Like every proxy-based feature, the interceptor only sees calls coming through the proxy. See <a href="aop-proxies.html">AOP &amp; proxies</a>.', fix: 'Call it on another bean. A test that asserts <code>Thread.currentThread().getName()</code> differs inside the method catches this.' },
    { trap: 'One scheduler thread for all jobs', code: `@Scheduled(cron = "0 */5 * * * *") void syncCatalog() { … }   // sometimes takes 20 min
@Scheduled(fixedRate = 10_000)    void heartbeat()   { … }   // stops for 20 min`, why: 'Boot’s <code>ThreadPoolTaskScheduler</code> has one thread by default. A long job blocks every other scheduled method in the application.', fix: 'Raise <code>spring.task.scheduling.pool.size</code>, or have the scheduled method hand heavy work to a dedicated executor. With virtual threads (Boot 3.2+), the scheduler starts a virtual thread per run.' },
    { trap: 'Scheduled jobs run on every instance', why: 'Scheduling is per JVM. With 4 replicas, a nightly invoice job runs 4 times.', fix: 'Use ShedLock (<code>@SchedulerLock</code> + a lock table), a leader-election mechanism, or move the job to a Kubernetes CronJob or a dedicated worker. Make the job idempotent regardless.' }
  ],
  scenarios: [
    { title: 'Customers receive the invoice email four times',
      symptom: 'Every morning since the move to Kubernetes, some customers get 4 identical invoice emails. The service runs 4 replicas.',
      diagnose: `# logs at 06:00:00 on each pod
pod-a  InvoiceJob started   pod-b  InvoiceJob started
pod-c  InvoiceJob started   pod-d  InvoiceJob started
@Scheduled(cron = "0 0 6 * * *") public void sendInvoices() { … }`,
      cause: 'A <code>@Scheduled</code> method written for a single VM now runs on every replica at the same second.',
      fix: 'Add ShedLock with a JDBC lock provider, and make the job idempotent (mark invoices as sent in the same transaction as recording the send).',
      fixCode: `@Configuration
@EnableScheduling
@EnableSchedulerLock(defaultLockAtMostFor = "PT30M")
class SchedulingConfig {
  @Bean LockProvider lockProvider(DataSource ds) {
    return new JdbcTemplateLockProvider(JdbcTemplateLockProvider.Configuration.builder()
        .withJdbcTemplate(new JdbcTemplate(ds)).usingDbTime().build());
  }
}

@Scheduled(cron = "0 0 6 * * *", zone = "Europe/Amsterdam")
@SchedulerLock(name = "sendInvoices", lockAtMostFor = "PT20M", lockAtLeastFor = "PT1M")
public void sendInvoices() { … }
-- CREATE TABLE shedlock(name VARCHAR(64) PRIMARY KEY, lock_until TIMESTAMP NOT NULL,
--                       locked_at TIMESTAMP NOT NULL, locked_by VARCHAR(255) NOT NULL);` },
    { title: 'Audit entries without a user after adding @Async',
      symptom: 'After making audit logging asynchronous, half the audit rows have <code>user = null</code> and log lines lack <code>traceId</code>. The other half are fine.',
      diagnose: `-- rows with a user all come from one code path that still calls AuditService synchronously
SELECT source, count(*) FILTER (WHERE user_id IS NULL) AS no_user, count(*) FROM audit GROUP BY source;
# log: [task-4] audit … traceId=   (empty)   vs   [http-nio-8080-exec-7] … traceId=4bf92f35…
SecurityContextHolder strategy: MODE_THREADLOCAL (default)`,
      cause: 'The audit method read the user from <code>SecurityContextHolder</code> and the trace id from MDC, both ThreadLocals of the request thread. On the executor thread they were empty.',
      fix: 'Capture the user and trace id as arguments at the call site. As a safety net, decorate the executor so security and observation context propagate.',
      fixCode: `@Bean(name = "auditExecutor")
Executor auditExecutor(ThreadPoolTaskExecutorBuilder builder) {   // Boot 3.2+ builder
  ThreadPoolTaskExecutor pool = builder.corePoolSize(4).maxPoolSize(4).queueCapacity(10_000)
      .threadNamePrefix("audit-").taskDecorator(new ContextPropagatingTaskDecorator())   // Spring 6.1+
      .build();
  pool.initialize();
  return new DelegatingSecurityContextAsyncTaskExecutor(pool);     // copies the SecurityContext
}

@Async("auditExecutor")
public void record(AuditEvent e) { … }` },
    { title: 'Virtual threads turn on, the connection pool falls over',
      symptom: 'After setting <code>spring.threads.virtual.enabled=true</code>, throughput is great until a traffic peak, then requests fail with <code>SQLTransientConnectionException: Connection is not available, request timed out after 30000ms</code>.',
      diagnose: `hikaricp.connections.pending  → 1 800
hikaricp.connections.active   → 20 (maximum-pool-size)
# before: 200 Tomcat platform threads capped concurrency; now every request gets a virtual thread`,
      cause: 'The Tomcat thread pool had been the implicit limit on concurrent DB work. Virtual threads removed it, so thousands of requests queued on 20 connections and timed out.',
      fix: 'Limit concurrency where the scarce resource is: keep the Hikari pool sized for the database, and add a semaphore or bulkhead in front of expensive paths. Shorten the connection timeout so overload fails fast.',
      fixCode: `spring:
  threads:
    virtual:
      enabled: true
  datasource:
    hikari:
      maximum-pool-size: 20
      connection-timeout: 2s          # fail fast instead of 30 s queues
  task:
    execution:
      simple:
        concurrency-limit: 200        # caps @Async tasks on the virtual-thread executor`, lang: 'yaml' }
  ],
  puzzles: [
    { kind: 'predict', q: 'What is printed (Boot 3.x defaults plus <code>@EnableAsync</code> on a configuration class, called from a controller)?', code: `@Service class A { @Autowired B b;
  public void run() { System.out.println("A " + Thread.currentThread().getName()); b.work(); } }
@Service class B {
  @Async public void work() { System.out.println("B " + Thread.currentThread().getName()); } }`, options: ['A http-nio-8080-exec-1 / B http-nio-8080-exec-1', 'A task-1 / B task-1', 'A http-nio-8080-exec-1 / B task-1', 'Nothing: @Async needs a return value'], answer: 2, explain: 'With <code>@EnableAsync</code>, the call through B’s proxy is submitted to Boot’s <code>applicationTaskExecutor</code>, whose threads are named <code>task-N</code>. (Without <code>@EnableAsync</code>, both lines would show the request thread.)' },
    { kind: 'concept', q: 'Boot’s default <code>applicationTaskExecutor</code> (platform threads) receives 1 000 tasks at once. How many run concurrently?', options: ['8; the rest wait in the queue', '1 000', 'Integer.MAX_VALUE', 'Number of CPU cores'], answer: 0, explain: 'Core size 8 and an unbounded queue: a <code>ThreadPoolExecutor</code> only adds threads beyond the core size when the queue is full, which never happens. The other 992 queue.' },
    { kind: 'predict', q: 'Single scheduler thread. The job takes 7 s. How often does it start?', code: `@Scheduled(fixedRate = 5_000)
void poll() { work(7_000); }`, options: ['Every 5 s, overlapping', 'Every 5 s, skipping when busy', 'Every 12 s', 'Every 7 s: late runs start right after the previous one ends, never concurrently'], answer: 3, explain: 'With fixed rate, a run that overruns makes the next one start late, but runs of the same task never overlap. With <code>fixedDelay = 5_000</code> it would be 7 + 5 = every 12 s.' },
    { kind: 'concept', q: 'What does this cron expression mean in Spring?', code: `@Scheduled(cron = "0 15 2 * * MON-FRI")`, options: ['Every 15 minutes from 02:00', 'At 02:15:00 on weekdays', 'At 15:02 on weekdays', 'Invalid: cron has 5 fields'], answer: 1, explain: 'Spring cron has six fields: second, minute, hour, day of month, month, day of week. So second 0, minute 15, hour 2, Monday to Friday. Use <code>zone</code> to pin the time zone.' },
    { kind: 'concept', q: 'ShedLock with <code>lockAtMostFor = "PT10M"</code>. The pod running the job is killed after 2 minutes. When can another pod run it?', options: ['Immediately', 'Never: the lock must be deleted by hand', 'After the lock expires, 10 minutes after it was taken (at the next scheduled run after that)', 'After lockAtLeastFor'], answer: 2, explain: '<code>lockAtMostFor</code> is the safety net for dead lock holders: the row’s <code>lock_until</code> is set that far ahead. Set it well above the job’s normal duration, or a slow job may run twice.' },
    { kind: 'concept', q: 'With <code>spring.threads.virtual.enabled=true</code> on Java 21, what changes for <code>@Async</code>?', options: ['Nothing', '@Async is disabled', 'Tasks run on the caller’s thread', 'The auto-configured executor becomes a SimpleAsyncTaskExecutor that starts a virtual thread per task, with no pool or queue'], answer: 3, explain: 'Boot 3.2+ configures a virtual-thread <code>SimpleAsyncTaskExecutor</code>. Every task gets a fresh virtual thread, so concurrency is no longer capped by a pool; add a concurrency limit if the downstream needs one.' },
    { kind: 'concept', q: 'On Java 21, a virtual thread blocks on I/O inside a <code>synchronized</code> block. What happens?', options: ['It pins its carrier thread until the block ends', 'It unmounts as usual', 'Deadlock', 'IllegalMonitorStateException'], answer: 0, explain: 'On Java 21–23, blocking while holding a monitor pins the carrier thread, which can starve the small carrier pool. JEP 491 (Java 24) removes this pinning for <code>synchronized</code>. Before that, prefer <code>ReentrantLock</code> around blocking calls.' }
  ],
  interview: [
    { q: 'How does @Async work?', a: '<p><code>@EnableAsync</code> registers <code>AsyncAnnotationBeanPostProcessor</code>, which proxies beans with <code>@Async</code> methods. The proxy’s <code>AsyncExecutionInterceptor</code> picks an executor (the qualifier in <code>@Async("name")</code>, an <code>AsyncConfigurer</code>, a unique <code>TaskExecutor</code> bean, or a bean named <code>taskExecutor</code>; in Boot, the auto-configured <code>applicationTaskExecutor</code>), wraps the invocation in a <code>Callable</code> and submits it. For <code>CompletableFuture</code> return types it returns a future tied to the task.</p>', lvl: 'core' },
    { q: 'What does Boot configure for async and scheduling?', a: '<ul><li><code>applicationTaskExecutor</code>: <code>ThreadPoolTaskExecutor</code>, core 8, unbounded queue, prefix <code>task-</code> (<code>spring.task.execution.*</code>). Boot backs off if you define your own <code>Executor</code> bean.</li><li><code>taskScheduler</code>: <code>ThreadPoolTaskScheduler</code>, 1 thread, prefix <code>scheduling-</code> (<code>spring.task.scheduling.*</code>).</li><li>With virtual threads enabled (3.2+): <code>SimpleAsyncTaskExecutor</code> and <code>SimpleAsyncTaskScheduler</code> on virtual threads.</li></ul>', lvl: 'core' },
    { q: 'How do you propagate context to async tasks?', a: '<p>Prefer explicit arguments. For cross-cutting context, a <code>TaskDecorator</code> captures values on the submitting thread and restores them on the worker, clearing them in <code>finally</code>. Spring 6.1’s <code>ContextPropagatingTaskDecorator</code> uses Micrometer’s context-propagation library, so tracing and anything with a registered <code>ThreadLocalAccessor</code> (e.g. MDC, security with the right accessor) flows. For security alone, <code>DelegatingSecurityContextAsyncTaskExecutor</code> wraps an executor. Request-scoped beans can’t be used on workers.</p>', lvl: 'deep' },
    { q: 'fixedRate vs fixedDelay vs cron?', a: '<p><b>fixedRate</b>: start every N ms measured from start times; an overrun delays the next start, runs of the same method don’t overlap. <b>fixedDelay</b>: wait N ms after the previous run ends. <b>cron</b>: calendar-based, 6 fields with seconds, optional <code>zone</code>. Use <code>initialDelay</code> to avoid every instance starting jobs at boot.</p>', lvl: 'core' },
    { q: 'How do you run a scheduled job once in a cluster?', a: '<p>ShedLock: annotate with <code>@SchedulerLock(name, lockAtMostFor, lockAtLeastFor)</code>; at fire time each instance tries to update the lock row where <code>lock_until &lt;= now()</code>, and only the winner runs. <code>lockAtMostFor</code> bounds a lock held by a dead node; <code>lockAtLeastFor</code> keeps the lock briefly after a fast run so instances with skewed clocks don’t run it again. Alternatives: Quartz in clustered mode, leader election, Kubernetes CronJobs. ShedLock does not queue missed runs.</p>', lvl: 'core' },
    { q: 'Virtual threads in Spring Boot: what changes, what doesn’t?', a: '<p>Boot 3.2+ with <code>spring.threads.virtual.enabled=true</code> on Java 21 runs Tomcat/Jetty request handling, <code>@Async</code>, <code>@Scheduled</code> and several listener containers on virtual threads. Blocking code scales without big thread pools. It doesn’t make CPU work faster, doesn’t remove limits on connections (Hikari) or downstream capacity, and on Java 21–23 <code>synchronized</code> blocks around I/O pin carrier threads. ThreadLocals still work, but are per virtual thread; don’t cache expensive objects in them.</p>', fu: 'Should you pool virtual threads? No. They are meant to be created per task; limit concurrency with semaphores instead.', lvl: 'deep' },
    { q: 'How do exceptions from @Async methods surface?', a: '<p>For <code>CompletableFuture</code>/<code>Future</code> returns, the exception completes the future; the caller sees it on <code>join()</code>/<code>get()</code> or in <code>whenComplete</code>. For <code>void</code>, it goes to the <code>AsyncUncaughtExceptionHandler</code> (default: log at error). Configure one via <code>AsyncConfigurer</code> to add metrics or alerts.</p>', lvl: 'core' },
    { q: 'How do you shut down executors gracefully?', a: '<p>Set <code>spring.task.execution.shutdown.await-termination=true</code> and <code>await-termination-period</code> (same for scheduling), so running tasks can finish when the context closes. Queued tasks in memory are still lost if the period ends. Work that must not be lost belongs in a durable queue or outbox, not in an in-memory executor.</p>', lvl: 'deep' },
    { q: 'When would you not use @Async?', a: '<p>When the work must survive a crash or deploy (use a message broker or outbox), when you need retries and visibility (a job queue), when the caller actually needs the result before responding, or when it hides a capacity problem by queueing. <code>@Async</code> is fine for best-effort side work in the same JVM.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'A named, bounded executor', lang: 'java', code: `@Configuration
@EnableAsync
class AsyncConfig implements AsyncConfigurer {
  @Bean(name = "mailExecutor")
  ThreadPoolTaskExecutor mailExecutor() {
    var ex = new ThreadPoolTaskExecutor();
    ex.setCorePoolSize(4);
    ex.setMaxPoolSize(16);
    ex.setQueueCapacity(500);                                    // bounded: threads grow past core when full
    ex.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());   // back-pressure
    ex.setThreadNamePrefix("mail-");
    ex.setTaskDecorator(new ContextPropagatingTaskDecorator());  // Spring 6.1+
    ex.setWaitForTasksToCompleteOnShutdown(true);
    ex.setAwaitTerminationSeconds(20);
    return ex;
  }
  @Override public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
    return (ex, method, params) -> log.error("async failure in {}", method.getName(), ex);
  }
}

@Service
class Mailer {
  @Async("mailExecutor")
  public CompletableFuture<MessageId> sendReceipt(long orderId, String traceId) { … }
}` },
    { title: 'Boot properties', lang: 'yaml', code: `spring:
  threads:
    virtual:
      enabled: false                  # true on Java 21+: virtual-thread executor & scheduler (Boot 3.2+)
  task:
    execution:
      pool:
        core-size: 8
        max-size: 32
        queue-capacity: 1000
      thread-name-prefix: app-task-
      shutdown:
        await-termination: true
        await-termination-period: 20s
    scheduling:
      pool:
        size: 4
      thread-name-prefix: sched-` },
    { title: 'A minimal MDC-copying decorator', lang: 'java', code: `@Bean
TaskDecorator mdcDecorator() {          // Boot applies a single TaskDecorator bean to its executor
  return runnable -> {
    Map<String, String> mdc = MDC.getCopyOfContextMap();          // captured on the caller thread
    SecurityContext sec = SecurityContextHolder.getContext();
    return () -> {
      Map<String, String> previous = MDC.getCopyOfContextMap();
      try {
        if (mdc != null) MDC.setContextMap(mdc);
        SecurityContextHolder.setContext(sec);
        runnable.run();
      } finally {                                                   // pool threads are reused: clean up
        if (previous != null) MDC.setContextMap(previous); else MDC.clear();
        SecurityContextHolder.clearContext();
      }
    };
  };
}` }
  ]
});

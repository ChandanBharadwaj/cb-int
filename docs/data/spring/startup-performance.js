IA.register({
  track: 'spring',
  slug: 'startup-performance',
  title: 'Startup & runtime performance',
  tagline: 'Three moments decide how a Boot service behaves in production: how fast it <b>starts</b> (lazy init, class-data sharing, a lean classpath), how cleanly it <b>stops</b> (graceful shutdown that lets in-flight requests finish), and whether it <b>fits</b> its container (heap plus everything that isn’t heap). Most incidents here are not Spring bugs but defaults that don’t match the platform.',
  tldr: {
    problem: 'Pods that take 40 s to become ready, 502s on every deploy, and containers that get OOMKilled although the heap looks half empty.',
    model: 'Startup = JVM + class loading + Spring’s configuration work + bean creation + warm-up. Shutdown = SIGTERM → readiness goes to refusing traffic → web server stops accepting and drains → lifecycle phases stop (listeners, schedulers) → beans destroyed. Memory = heap + metaspace + code cache + thread stacks + direct buffers + GC and native overhead, all under one cgroup limit.',
    hook: '“The heap is limited to 512 MB in a 1 GB container, why is it OOMKilled?” The kernel counts the whole process. Hundreds of threads, metaspace, the code cache, Netty’s direct buffers and the GC’s own structures can fill the other half. Measure with Native Memory Tracking before raising <code>MaxRAMPercentage</code>.',
    facts: [
      { v: '25%', l: 'default maximum heap of a container-aware JVM: <code>MaxRAMPercentage=25</code> of the container memory limit, if you set nothing' },
      { v: 'Boot 3.4', l: 'graceful shutdown of the embedded web server became the default (<code>server.shutdown=graceful</code>; before 3.4 you had to enable it)' },
      { v: '30 s', l: 'default <code>spring.lifecycle.timeout-per-shutdown-phase</code>, which is also Kubernetes’ default <code>terminationGracePeriodSeconds</code>' }
    ]
  },
  intro: {
    what: 'A Spring Boot app in a container is started, stopped and moved around all the time: deploys, autoscaling, node maintenance. It should start quickly, stop without dropping requests, and use the memory it was given without being killed. Each of these has a few settings that matter a lot.',
    analogy: { icon: '🏪', title: 'Opening and closing a shop', text: 'Opening: you can unlock the door before every shelf is stocked (lazy init) and pre-pack the usual items (class-data sharing). Closing: first take the “open” sign down (readiness), let the customers inside finish (graceful drain), then lock up. And the shop has a fixed floor area: stock (heap) is only part of it; counters, aisles and the back room (non-heap) need space too.' },
    steps: [
      { t: 'Measure startup', d: 'Read the “Started … in X seconds” line, then use <code>/actuator/startup</code> with <code>BufferingApplicationStartup</code> to see which beans are slow.' },
      { t: 'Cut startup work', d: 'Remove unused starters, consider lazy init for dev, use CDS (Boot 3.3+) or AOT/native for production.' },
      { t: 'Stop gracefully', d: 'Graceful shutdown, readiness probes, and a <code>preStop</code> delay so the load balancer stops sending traffic first.', code: 'server.shutdown: graceful\nspring.lifecycle.timeout-per-shutdown-phase: 20s' },
      { t: 'Size memory as a whole', d: 'Set the container limit, give the heap a percentage, and leave room for non-heap memory.', code: 'JAVA_TOOL_OPTIONS: -XX:MaxRAMPercentage=70' },
      { t: 'Verify under load', d: 'Watch RSS vs limit, GC pauses and deploy-time error rates, not just heap usage.' }
    ],
    terms: [
      ['lazy initialization', 'Creating beans on first use instead of at startup (<code>spring.main.lazy-initialization</code>).'],
      ['CDS / AppCDS', 'Class-data sharing: a pre-parsed archive of classes the JVM maps at startup instead of loading each class from jars.'],
      ['graceful shutdown', 'Stop accepting new requests, let in-flight ones finish within a timeout, then stop.'],
      ['preStop hook', 'A Kubernetes hook that runs before SIGTERM; a short sleep gives endpoints time to update.'],
      ['RSS', 'Resident set size: the memory the process actually uses, which the cgroup limit applies to.'],
      ['NMT', 'Native Memory Tracking: a JVM feature that breaks down non-heap memory (<code>jcmd &lt;pid&gt; VM.native_memory</code>).']
    ]
  },
  visual: {
    title: 'A pod is deleted during traffic',
    caption: 'Time 0 is when Kubernetes deletes the pod. Rows show whether the Service still routes to it, what the kubelet does, what Tomcat does, and each request’s fate (green: served, red: cut or refused). Press Play for each configuration and count the red bars.'
  },
  extras: [
    { id: 'startup-performance-memory', title: 'Where the container’s memory goes', label: 'Memory', caption: 'Set the container limit, the heap percentage and the thread count. The bar stacks heap and the main non-heap areas against the limit. Push threads or the heap percentage up until the container would be OOMKilled.' },
    { id: 'startup-performance-startup', title: 'What startup options buy you', label: 'Startup', caption: 'Toggle startup options for a mid-sized service and press Play to watch the startup timeline. Bars are illustrative; measure your own app with <code>/actuator/startup</code>.' }
  ],
  gotchas: [
    { trap: 'Lazy initialization hides failures until traffic arrives', code: `spring.main.lazy-initialization: true
# app "starts" in 1.2 s; the first request to /reports fails:
# BeanCreationException: … Could not resolve placeholder 'reports.bucket'`, lang: 'yaml', why: 'With lazy init, misconfigured beans aren’t created at startup, so readiness passes and the error appears on the first request, in production, per instance. The first request also pays for creating the beans it uses.', fix: 'Use lazy init for local development and tests, not for production. If you use it, exclude critical beans with <code>@Lazy(false)</code> and warm up endpoints before marking the pod ready.' },
    { trap: 'No preStop delay: 502s on every deploy', why: 'When a pod is deleted, endpoint removal and SIGTERM happen in parallel. Graceful shutdown makes Tomcat stop accepting immediately, but kube-proxy and ingress controllers may route new requests to the pod for a few more seconds. Those connections are refused.', fix: 'Add a <code>preStop</code> sleep (5–10 s) so the pod keeps serving while endpoints update, then graceful shutdown drains. Kubernetes 1.30+ has a built-in <code>sleep</code> action for preStop; on older clusters use <code>exec</code> with <code>sleep</code> if the image has a shell.' },
    { trap: 'Grace period shorter than the drain', code: `spring.lifecycle.timeout-per-shutdown-phase: 60s
terminationGracePeriodSeconds: 30        # default`, why: 'Kubernetes sends SIGKILL when the grace period ends, counted from the start of the preStop hook. A 60 s drain under a 30 s grace period is cut off at 30 s, mid-request and mid-batch.', fix: '<code>terminationGracePeriodSeconds</code> ≥ preStop sleep + <code>timeout-per-shutdown-phase</code> × (phases that drain) + a margin. Keep request timeouts shorter than the drain timeout.' },
    { trap: 'Leaving the heap at 25% of the limit', why: 'A container-aware JVM with no heap flags takes 25% of the memory limit as max heap. In a 2 GB container that is 512 MB of heap and 1.5 GB mostly unused, while the app runs GC constantly.', fix: 'Set <code>-XX:MaxRAMPercentage</code> (often 60–75% for typical services; less when you have many threads or large direct buffers), or let the Paketo buildpack’s memory calculator compute <code>-Xmx</code>. Then verify RSS under load.' },
    { trap: 'OOMKilled with a healthy heap', code: `kubectl describe pod … → Last State: Terminated, Reason: OOMKilled, Exit Code: 137
# but heap used 300 MB of 700 MB max`, lang: 'bash', why: 'The cgroup limit applies to the whole process. Thread stacks (up to 1 MB reserved each by default on 64-bit Linux, committed as used), metaspace, the JIT code cache, direct buffers (Netty, NIO), GC data structures and malloc arenas all count.', fix: 'Turn on <code>-XX:NativeMemoryTracking=summary</code>, compare <code>jcmd &lt;pid&gt; VM.native_memory summary</code> with the container RSS, cap what is unbounded (<code>-XX:MaxMetaspaceSize</code>, <code>-XX:MaxDirectMemorySize</code>, thread pools), and size heap from what is left.' },
    { trap: 'Tiny CPU limits change the JVM’s choices', why: 'The JVM uses the container CPU quota for <code>availableProcessors()</code>. With fewer than 2 CPUs or under about 1.8 GB of memory, it doesn’t consider the machine “server class” and picks the Serial GC; GC threads, ForkJoin parallelism and Netty event loops shrink too. Startup and JIT compilation are also CPU-hungry.', fix: 'Give JVM services at least 2 CPUs (or a higher limit than request), choose the GC explicitly (<code>-XX:+UseG1GC</code>), and check <code>-XX:+PrintFlagsFinal</code> / <code>java -XshowSettings:system</code> in the container.' },
    { trap: 'CDS archive that is never used', why: 'A CDS archive only works with the same JVM build, the same classpath in the same order and flat jars. Run from the fat jar, or with a different JDK image, and the JVM silently ignores the archive (or warns, with <code>-Xshare:auto</code>).', fix: 'Extract the jar (<code>java -Djarmode=tools -jar app.jar extract</code>, Boot 3.3+), do the training run and the real run with the same image, and check with <code>-Xlog:cds</code> or <code>-Xshare:on</code>, which fails if the archive can’t be used.' }
  ],
  scenarios: [
    { title: 'Errors spike for 5 seconds on every rollout',
      symptom: 'Each deployment produces a burst of 502/503 at the ingress, about 0.5% of requests, lasting a few seconds per terminating pod. Application logs show nothing unusual.',
      diagnose: `# ingress log
upstream connect error … connection refused  upstream: 10.42.3.17:8080
# 10.42.3.17 was a terminating pod; Tomcat had stopped accepting 1–3 s earlier
kubectl get endpointslices -w   → address removed ~2 s after the pod got SIGTERM`,
      cause: 'The pod stopped accepting connections as soon as it got SIGTERM, while the ingress and kube-proxy still routed to it until the endpoint change propagated.',
      fix: 'Delay SIGTERM with a preStop sleep, keep graceful shutdown on, and size the grace period for both.',
      fixCode: `# deployment.yaml
spec:
  terminationGracePeriodSeconds: 45
  containers:
    - name: orders
      lifecycle:
        preStop:
          sleep:
            seconds: 10          # K8s 1.30+; else exec: ["sh", "-c", "sleep 10"]
      readinessProbe:
        httpGet: { path: /actuator/health/readiness, port: 8080 }
# application.yml
server.shutdown: graceful
spring.lifecycle.timeout-per-shutdown-phase: 25s`, lang: 'yaml' },
    { title: 'OOMKilled every few hours, heap never above 60%',
      symptom: 'A service in a 1 GiB container is killed with exit code 137 a few times a day. Heap metrics never exceed 60% of <code>-Xmx700m</code>.',
      diagnose: `jcmd 1 VM.native_memory summary
-                 Java Heap (reserved=716800KB, committed=716800KB)
-                     Class (committed=96512KB)
-                    Thread (committed=221184KB)    # 210 threads
-                      Code (committed=62000KB)
-                        GC (committed=58000KB)
-                     Other (committed=140000KB)    # direct buffers (Netty)
# committed total ≈ 1.27 GiB > 1 GiB limit`,
      cause: 'A fixed <code>-Xmx700m</code> left only ~300 MB for everything else. Thread stacks, Netty direct buffers, metaspace, code cache and GC structures needed far more, so RSS crossed the cgroup limit under load.',
      fix: 'Size from the limit down: lower the heap share, cap direct memory, and shrink thread counts. Or raise the limit. Alert on RSS (container_memory_working_set_bytes) vs limit, not on heap.',
      fixCode: `env:
  - name: JAVA_TOOL_OPTIONS
    value: >-
      -XX:MaxRAMPercentage=55
      -XX:MaxDirectMemorySize=128m
      -XX:ReservedCodeCacheSize=128m
      -XX:MaxMetaspaceSize=192m
      -XX:NativeMemoryTracking=summary
resources:
  requests: { memory: 1Gi, cpu: "1" }
  limits:   { memory: 1Gi }`, lang: 'yaml' },
    { title: 'Readiness takes 45 seconds after a dependency upgrade',
      symptom: 'Pods take 45 s to become ready (was 12 s). Autoscaling reacts too slowly during morning peaks.',
      diagnose: `management.endpoints.web.exposure.include: startup
// main: app.setApplicationStartup(new BufferingApplicationStartup(4096));
GET /actuator/startup → longest steps:
  spring.beans.instantiate  beanName=entityManagerFactory   18.2 s
  spring.beans.instantiate  beanName=searchIndexWarmup       11.7 s`,
      cause: 'The new Hibernate version validated the schema against 900 tables at startup, and a warm-up bean loaded a search index synchronously in <code>@PostConstruct</code>.',
      fix: 'Turn schema validation off in production (Flyway already verifies migrations). Make the warm-up cheaper (load a prebuilt index snapshot instead of rebuilding it) and run it from an <code>ApplicationReadyEvent</code> listener, so the web server and Actuator are up while readiness still waits for it. Add CDS for class loading.',
      fixCode: `spring.jpa.hibernate.ddl-auto: none

@Component
class SearchWarmup {
  private final SearchIndex index;
  SearchWarmup(SearchIndex index) { this.index = index; }

  // Boot publishes ReadinessState.ACCEPTING_TRAFFIC right after the ApplicationReadyEvent
  // listeners return, so the pod only becomes ready once the index is loaded.
  @EventListener(ApplicationReadyEvent.class)
  void warm() { index.loadSnapshot(); }
}` }
  ],
  puzzles: [
    { kind: 'predict', q: 'No heap flags, container memory limit 2 GiB, JDK 21. What is the default max heap?', options: ['2 GiB', '1 GiB', '512 MiB', '256 MiB'], answer: 2, explain: 'A container-aware JVM uses <code>MaxRAMPercentage=25</code> of the limit: 512 MiB. That is often too small for a service, hence <code>-XX:MaxRAMPercentage</code>.' },
    { kind: 'concept', q: 'Boot 3.4+ defaults. SIGTERM arrives while 5 requests are in flight. What does Tomcat do?', options: ['Drops them immediately', 'Stops accepting new connections and lets the 5 finish, up to the shutdown phase timeout', 'Keeps accepting until all are done', 'Waits for SIGKILL'], answer: 1, explain: 'Graceful shutdown is the default since Boot 3.4: the web server stops accepting, in-flight requests complete within <code>spring.lifecycle.timeout-per-shutdown-phase</code> (30 s default), then the context continues closing.' },
    { kind: 'concept', q: 'Why does a preStop sleep help, even with graceful shutdown?', options: ['It warms up the JIT', 'Endpoint removal is asynchronous: the sleep keeps the pod serving while load balancers stop routing to it, before SIGTERM', 'It flushes logs', 'Kubernetes requires it'], answer: 1, explain: 'Kubernetes starts removing the pod from endpoints and runs preStop at the same time. Without the delay, SIGTERM makes the server stop accepting while traffic is still being routed to it.' },
    { kind: 'concept', q: 'What is the main risk of <code>spring.main.lazy-initialization=true</code> in production?', options: ['Higher memory usage', 'Configuration errors surface on first use instead of at startup, after the pod is already ready', 'Beans become prototype-scoped', 'It disables auto-configuration'], answer: 1, explain: 'Startup gets faster because beans aren’t created, which also means broken beans aren’t detected. The first request that needs them pays the creation cost or fails.' },
    { kind: 'concept', q: 'A pod is OOMKilled (exit 137), but no <code>java.lang.OutOfMemoryError</code> appears in the logs. What does that tell you?', options: ['The heap was full', 'The process exceeded the cgroup memory limit; the kernel killed it, and the JVM had no chance to log', 'The JVM crashed with a segfault', 'Kubernetes evicted it for CPU'], answer: 1, explain: 'A heap OOM is a Java exception you can log and dump (<code>-XX:+HeapDumpOnOutOfMemoryError</code>). OOMKilled is the kernel terminating the process for total memory, usually due to non-heap growth or too large a heap share.' },
    { kind: 'concept', q: 'You created a CDS archive with a training run and pass <code>-XX:SharedArchiveFile=app.jsa</code>, but startup is unchanged. Most likely cause?', options: ['CDS only works with native images', 'The classpath or JVM differs from the training run (e.g. running the fat jar instead of the extracted layout), so the archive is not used', 'CDS needs lazy initialization', 'The archive must be on a tmpfs'], answer: 1, explain: 'The archive is validated against the JVM and classpath. Boot 3.3+ documents extracting the jar and running the same extracted layout for training and production. Add <code>-Xlog:cds</code> or <code>-Xshare:on</code> to see whether it is used.' },
    { kind: 'concept', q: 'Container limit 1 CPU, 1 GiB, no GC flags, JDK 21. Which GC does the JVM pick?', options: ['G1', 'Serial', 'ZGC', 'Parallel'], answer: 1, explain: 'G1 is chosen only on a “server-class machine”: at least 2 available processors and about 1792 MB of memory. Otherwise the JVM selects Serial. Set <code>-XX:+UseG1GC</code> explicitly if you want G1.' }
  ],
  interview: [
    { q: 'How would you speed up the startup of a Spring Boot service?', a: '<ol><li>Measure: startup log, <code>/actuator/startup</code> with <code>BufferingApplicationStartup</code>, or JFR.</li><li>Do less: remove unused starters and auto-configurations, avoid heavy work in <code>@PostConstruct</code> (schema validation, cache warm-up) or move it after start.</li><li>Load classes faster: CDS (Boot 3.3+ has documented support), and on JDK 24+ the Leyden AOT cache.</li><li>Do it at build time: Spring AOT on the JVM or a GraalVM native image; or restore a warm JVM with CRaC.</li><li>Give the container enough CPU during startup.</li></ol>', lvl: 'core' },
    { q: 'Walk through a graceful shutdown in Kubernetes.', a: '<p>The pod is marked terminating; endpoint removal starts and the <code>preStop</code> hook runs. After preStop, the kubelet sends SIGTERM. The JVM runs shutdown hooks; Spring publishes readiness <code>REFUSING_TRAFFIC</code> and closes the context: <code>SmartLifecycle</code> beans stop by phase. The web server stops accepting and waits for in-flight requests (<code>timeout-per-shutdown-phase</code>); message listener containers stop and commit; schedulers stop; then beans are destroyed (pools closed). If all of that exceeds <code>terminationGracePeriodSeconds</code> (counted from the start), SIGKILL ends it.</p>', lvl: 'deep' },
    { q: 'How does the JVM decide its memory settings in a container?', a: '<p>Since JDK 10 (and 8u191) the JVM reads cgroup limits. Max heap defaults to <code>MaxRAMPercentage</code> (25%) of the memory limit, initial heap to <code>InitialRAMPercentage</code> (1.5625%). CPU limits set <code>availableProcessors()</code>, which drives GC thread counts and GC selection. Non-heap areas have their own defaults: metaspace is unbounded unless capped, the reserved code cache is 240 MB with tiered compilation, direct memory defaults to the max heap size, and each thread has a stack.</p>', lvl: 'core' },
    { q: 'How do you find what uses memory outside the heap?', a: '<p>Native Memory Tracking: start with <code>-XX:NativeMemoryTracking=summary</code>, then <code>jcmd &lt;pid&gt; VM.native_memory summary</code> (and <code>baseline</code> / <code>summary.diff</code> to see growth). Compare its committed total with the container RSS; a large gap points to native libraries or malloc fragmentation (glibc arenas; <code>MALLOC_ARENA_MAX</code> helps). Micrometer’s <code>jvm.memory.used{area=nonheap}</code> and <code>jvm.buffer.memory.used</code> cover part of it in dashboards.</p>', lvl: 'deep' },
    { q: 'What are liveness, readiness and startup probes for a Boot app?', a: '<p>Boot exposes <code>/actuator/health/liveness</code> and <code>/actuator/health/readiness</code> (automatically enabled on Kubernetes). Readiness gates traffic: false during startup and shutdown, or when a critical dependency is down. Liveness should only fail when the app is broken beyond recovery (don’t include the database). A startup probe with a generous threshold protects slow starts from liveness restarts. See <a href="actuator-observability.html">Actuator &amp; observability</a>.</p>', lvl: 'core' },
    { q: 'What does lazy initialization change, exactly?', a: '<p>Bean definitions are all registered, but singletons are only instantiated when first requested (by injection into another eager bean, by <code>getBean</code>, or on first use through a lazy proxy). Beans needed at startup (web server, lifecycle beans, those marked <code>@Lazy(false)</code>) are still created. Effects: faster startup and possibly less memory, but slower first requests and late discovery of misconfiguration.</p>', lvl: 'core' },
    { q: 'How do you size thread pools and memory together?', a: '<p>Each platform thread costs a stack (reserved 1 MB by default, committed as it grows) plus some JVM bookkeeping. 200 Tomcat threads, a 50-thread executor and library threads can easily mean 150–250 MB. Choose pool sizes from the downstream capacity (DB connections, partner limits), then compute heap as limit − non-heap estimate − headroom. With virtual threads, stacks live on the heap and grow with depth, so heap sizing absorbs them.</p>', lvl: 'deep' },
    { q: 'Why is the first minute after startup slow, and what can you do?', a: '<p>Code starts interpreted, and the JIT compiles hot methods as it gathers profiles; caches and connection pools are cold too. Mitigations: keep readiness false until a warm-up (synthetic requests, pre-filling caches, opening pool connections with <code>minimum-idle</code>), give enough CPU for JIT threads, and roll out gradually. CRaC restores already-compiled code; native image has no warm-up phase.</p>', lvl: 'core' },
    { q: 'What happens to Kafka consumers and scheduled jobs on shutdown?', a: '<p>Listener containers are <code>SmartLifecycle</code> beans: on context close they stop polling, finish the current records and commit (depending on ack mode), then leave the group, which triggers a rebalance. Scheduled tasks stop being triggered; with <code>spring.task.scheduling.shutdown.await-termination=true</code>, running ones may finish. Anything still running at SIGKILL is lost, so jobs and listeners must be idempotent. See <a href="kafka-messaging.html">Kafka with Spring</a>.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Startup analysis', lang: 'java', code: `@SpringBootApplication
public class OrdersApplication {
  public static void main(String[] args) {
    SpringApplication app = new SpringApplication(OrdersApplication.class);
    app.setApplicationStartup(new BufferingApplicationStartup(4096));   // feeds /actuator/startup
    app.run(args);
  }
}
// management.endpoints.web.exposure.include: health,startup
// POST /actuator/startup drains the buffer; GET returns it without draining` },
    { title: 'CDS with Boot 3.3+', lang: 'bash', code: `# 1. extract the fat jar into a CDS-friendly layout
java -Djarmode=tools -jar target/orders.jar extract --destination app
# 2. training run: start the context, exit after refresh, write the archive
java -XX:ArchiveClassesAtExit=app/orders.jsa -Dspring.context.exit=onRefresh -jar app/orders.jar
# 3. production run with the same JDK and layout
java -XX:SharedArchiveFile=app/orders.jsa -Xlog:cds=info -jar app/orders.jar
# buildpacks: BP_JVM_CDS_ENABLED=true does steps 1–3 during the image build`, note: 'Training and production must use the same JDK and classpath; otherwise the archive is ignored.' },
    { title: 'Shutdown and probes', lang: 'yaml', code: `server:
  shutdown: graceful                       # default since Boot 3.4
spring:
  lifecycle:
    timeout-per-shutdown-phase: 25s
  task:
    execution.shutdown: { await-termination: true, await-termination-period: 20s }
management:
  endpoint.health.probes.enabled: true     # automatic on Kubernetes
  endpoint.health.group.readiness.include: readinessState, db
---
# Kubernetes container spec
terminationGracePeriodSeconds: 45          # ≥ preStop + drain + margin
lifecycle:
  preStop: { sleep: { seconds: 10 } }      # K8s 1.30+
startupProbe:   { httpGet: { path: /actuator/health/liveness,  port: 8080 }, failureThreshold: 30, periodSeconds: 2 }
readinessProbe: { httpGet: { path: /actuator/health/readiness, port: 8080 }, periodSeconds: 5 }
livenessProbe:  { httpGet: { path: /actuator/health/liveness,  port: 8080 }, periodSeconds: 10 }` },
    { title: 'Container JVM flags', lang: 'docker', code: `FROM eclipse-temurin:21-jre
COPY app/ /app/
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=65 -XX:+UseG1GC -XX:MaxDirectMemorySize=128m \\
    -XX:+ExitOnOutOfMemoryError -XX:NativeMemoryTracking=summary -Xlog:gc*:stdout:time,level,tags"
ENTRYPOINT ["java", "-XX:SharedArchiveFile=/app/orders.jsa", "-jar", "/app/orders.jar"]`, note: '<code>ExitOnOutOfMemoryError</code> turns a heap OOM into a clean restart instead of a half-working JVM.' }
  ]
});

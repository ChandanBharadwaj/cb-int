IA.register({
  track: 'kubernetes',
  slug: 'jvm-on-k8s',
  title: 'Java/Spring on Kubernetes',
  tagline: 'The JVM sizes itself from what the container allows: <b>heap</b> from the memory limit, <b>GC and thread pools</b> from the CPU limit. Get those two right, wire <b>Actuator probes</b> and <b>graceful shutdown</b> to the Pod lifecycle, ship <b>layered images</b>, and most “Kubernetes problems” with Spring Boot disappear.',
  tldr: {
    problem: 'A service that ran fine on a VM gets OOMKilled with no stack trace, stalls on p99 at 40% CPU, drops requests on every deploy, and rebuilds an 80 MB image layer for a one-line change. Each has a specific cause in how the JVM meets cgroups and the Pod lifecycle.',
    model: '<b>Memory</b>: heap (<code>MaxRAMPercentage</code> × limit) + non-heap (metaspace, code cache, thread stacks, direct buffers, GC structures, native) must fit under <code>limits.memory</code>. <b>CPU</b>: <code>availableProcessors()</code> comes from the CPU limit and drives GC choice and thread counts; the limit is enforced as a quota per 100 ms. <b>Lifecycle</b>: startup probe → readiness → traffic; on delete, preStop → SIGTERM → Spring drains → exit within the grace period.',
    hook: '“-Xmx equal to the memory limit: what happens?” The container is OOMKilled (exit 137) once the heap fills, because metaspace, thread stacks and native memory live outside the heap and have no room left.',
    facts: [
      { v: '25%', l: 'default <code>MaxRAMPercentage</code>: with no flags a JVM in a 2Gi container gets a 512 MiB max heap' },
      { v: '< 2 CPUs', l: 'the JVM picks SerialGC when it sees fewer than 2 processors (or under ~1.8 GB of memory): <code>limits.cpu: 1</code> means single-threaded GC' },
      { v: '30 s', l: 'default <code>terminationGracePeriodSeconds</code>, and Spring Boot’s default <code>spring.lifecycle.timeout-per-shutdown-phase</code>. preStop time counts against the grace period' }
    ]
  },
  intro: {
    what: 'A container is a Linux process with limits (cgroups). Modern JVMs (JDK 10+, and 8u191+) detect those limits and treat them as the machine: the memory limit becomes “physical RAM”, the CPU limit becomes the processor count. Your job is to tell the JVM how much of that memory to use for the heap, leave room for everything else, and make the Spring Boot app cooperate with Kubernetes’ health checks and shutdown sequence.',
    analogy: { icon: '🧳', title: 'Packing a suitcase with a strict weight limit', text: 'The airline weighs the whole suitcase (the container limit), not just the clothes (the heap). Shoes, toiletries and the bag itself (metaspace, threads, native memory) count too. Fill the bag with clothes up to the limit and you are over at check-in, every time.' },
    steps: [
      { t: 'Size the heap as a percentage', d: 'Let the heap follow the limit instead of hard-coding <code>-Xmx</code>.', code: 'env:\n- name: JAVA_TOOL_OPTIONS\n  value: "-XX:MaxRAMPercentage=70 -XX:+ExitOnOutOfMemoryError"' },
      { t: 'Request what you use, limit memory equally', d: 'Memory request = limit gives predictable scheduling and no surprise evictions. CPU: request generously; a CPU limit throttles.', code: 'resources:\n  requests: { cpu: "2", memory: 2Gi }\n  limits:   { memory: 2Gi }' },
      { t: 'Wire Actuator to the probes', d: 'Spring Boot exposes liveness and readiness groups automatically on Kubernetes.', code: 'readinessProbe:\n  httpGet: { path: /actuator/health/readiness, port: 8080 }\nlivenessProbe:\n  httpGet: { path: /actuator/health/liveness, port: 8080 }' },
      { t: 'Shut down gracefully', d: 'Keep serving while routing updates, then drain in-flight requests.', code: 'lifecycle:\n  preStop:\n    sleep: { seconds: 10 }      # sleep action: on by default since 1.30, GA in 1.34\nterminationGracePeriodSeconds: 45' }
    ],
    terms: [
      ['MaxRAMPercentage', 'Max heap as a percentage of the memory the JVM sees (the container limit). Default 25.'],
      ['non-heap', 'Metaspace, code cache, thread stacks, direct buffers, GC data and native allocations. Counted by the container, invisible to <code>-Xmx</code>.'],
      ['availableProcessors', 'What the JVM believes it has; from the CPU limit (rounded up) or <code>-XX:ActiveProcessorCount</code>.'],
      ['CFS throttling', 'The kernel pauses a container that used its CPU quota before the 100 ms period ends.'],
      ['graceful shutdown', 'Spring stops accepting new requests and lets in-flight ones finish before closing the context.'],
      ['layered image', 'An image split into dependencies, resources and classes, so a code change rebuilds and pushes only a small layer.']
    ]
  },
  visual: {
    title: 'The JVM’s memory inside a container limit',
    caption: 'Choose a memory limit, a heap setting and a thread count, then press Play (or Step) to go from boot to peak load. The bar stacks every memory area against the dashed limit line; the verdict at peak says whether the JVM runs out of heap, the container is OOMKilled, or it fits. The numbers are a realistic model of a mid-sized Spring Boot service, not a measurement.'
  },
  extras: [
    { id: 'jvm-on-k8s-cpu', title: 'CPU limits through the JVM’s eyes', label: 'CPU', caption: 'Pick a CPU limit and press Play (or Step). See the cgroup settings the kubelet writes, what the JVM concludes (processor count, GC, thread pools), and how the CFS quota stretches a short burst of work across 100 ms periods.' }
  ],
  gotchas: [
    { trap: '<code>-Xmx</code> equal to (or near) the memory limit', code: `env:
- name: JAVA_OPTS
  value: "-Xmx2g"          # copied from the VM
resources:
  limits: { memory: 2Gi }  # heap alone can use all of it`, why: 'Metaspace (often 100–200 MiB for Spring), code cache, a stack per thread, direct buffers, GC structures and malloc arenas all live outside the heap. When the heap grows to <code>-Xmx</code> under load, the cgroup total passes the limit and the kernel kills the process: exit 137, OOMKilled, no Java stack trace, no heap dump.', fix: 'Use <code>-XX:MaxRAMPercentage</code>: about 50–60 for a 1Gi limit, 70–75 for 2–4Gi, since non-heap is roughly fixed. Measure non-heap with Native Memory Tracking (<code>-XX:NativeMemoryTracking=summary</code>, then <code>jcmd 1 VM.native_memory summary</code>).' },
    { trap: 'No JVM flags at all', why: 'With no heap setting the JVM uses 25% of the limit. A 4Gi container runs with a 1 GiB heap: lots of GC and maybe <code>OutOfMemoryError: Java heap space</code> while 3 GiB sits unused. Very old JVMs (JDK 8 before 8u191) don’t see the limit at all and size from the node’s RAM. cgroup v2 support needs JDK 15+, 11.0.16+ or 8u372+.', fix: 'Always set <code>MaxRAMPercentage</code> (and <code>InitialRAMPercentage</code> if you want a warm heap). Check the result inside the Pod: <code>java -XshowSettings:system -version</code> or <code>jcmd 1 VM.flags | grep MaxHeapSize</code>.' },
    { trap: '<code>limits.cpu: 1</code> silently switches to SerialGC', code: `kubectl exec deploy/orders -- jcmd 1 VM.flags | tr ' ' '\\n' | grep -E 'UseSerialGC|UseG1GC'
# -XX:+UseSerialGC     ← one GC thread, stop-the-world`, lang: 'bash', why: 'The JVM counts the CPU limit as its processors. With fewer than 2, it isn’t a “server class machine”, so ergonomics choose SerialGC, the common ForkJoinPool gets parallelism 1, and libraries size pools for one core. Pauses grow with the heap.', fix: 'Give latency-sensitive JVMs at least 2 CPUs, or set the GC explicitly (<code>-XX:+UseG1GC</code>) and <code>-XX:ActiveProcessorCount=2</code>. Many teams drop the CPU limit entirely and rely on requests.' },
    { trap: 'CPU limits throttle bursts even when average CPU is low', why: 'A limit of 1 CPU is a quota of 100 ms CPU per 100 ms period, shared by all threads. Eight busy threads (requests, GC, JIT) use it in 12.5 ms and the container is paused for the remaining 87.5 ms. Dashboards average this away; users see p99 spikes.', fix: 'Watch <code>container_cpu_cfs_throttled_periods_total</code>. Prefer requests without limits for JVM services (or a limit well above the request), and keep <code>availableProcessors</code> consistent with what the Pod really gets. See <a href="resources-qos.html">Requests, limits & QoS</a>.' },
    { trap: 'A start script that doesn’t <code>exec</code> java', code: `#!/bin/sh
# start.sh: ENTRYPOINT ["/start.sh"]
echo "starting orders"
java $JAVA_OPTS -jar /app/app.jar      # child of sh; sh is PID 1
# fix:  exec java $JAVA_OPTS -jar /app/app.jar`, lang: 'bash', why: 'The kubelet sends SIGTERM to PID 1. Here that is the shell, which doesn’t forward it, so the JVM never starts its graceful shutdown. After the grace period everything gets SIGKILL: exit 137, in-flight requests cut off, no shutdown hooks.', fix: 'Use the exec form <code>ENTRYPOINT ["java", …]</code>, or <code>exec java …</code> as the last line of the script. Pass JVM options through <code>JAVA_TOOL_OPTIONS</code>, which the JVM reads by itself.' },
    { trap: 'Grace period shorter than preStop plus Spring’s drain', why: '<code>terminationGracePeriodSeconds</code> starts when the Pod is deleted, and the preStop hook runs inside it. With a 30 s grace, a 15 s preStop and Spring’s 30 s shutdown phase, the kubelet sends SIGKILL at 30 s, halfway through the drain.', fix: 'Grace ≥ preStop + <code>spring.lifecycle.timeout-per-shutdown-phase</code> + a few seconds for closing pools and flushing (e.g. 10 + 30 + 5 = 45 s).' },
    { trap: 'One fat-jar layer per build', why: '<code>COPY app.jar</code> puts 80–150 MB of dependencies and your few hundred KB of classes in one layer. Every commit pushes and pulls the whole thing, slowing CI and node startup during scale-outs.', fix: 'Layered images: Jib, Cloud Native Buildpacks (<code>spring-boot:build-image</code>), or a Dockerfile that extracts Spring Boot’s layers (dependencies, spring-boot-loader, snapshot-dependencies, application). Only the application layer changes on most commits.' }
  ],
  scenarios: [
    { title: 'OOMKilled under load after the move from VMs',
      symptom: 'The <code>pricing</code> service ran for years on 4 GB VMs with <code>-Xmx2g</code>. On Kubernetes, with a 2Gi limit and the same <code>JAVA_OPTS</code>, Pods restart a few times a day at peak with exit code 137. The app logs show nothing.',
      diagnoseLang: 'bash',
      diagnose: `kubectl describe pod pricing-6f9c-x2 | grep -A3 'Last State'   # OOMKilled, 137
kubectl exec pricing-6f9c-x2 -- jcmd 1 VM.native_memory summary | grep -E 'Total|Java Heap|Class|Thread|Code|GC|Internal'
#  Total: committed=2310MB
#  Java Heap: committed=2048MB    Class: committed=148MB    Thread: committed=181MB
#  Code: committed=61MB           GC: committed=97MB
# (NMT enabled with -XX:NativeMemoryTracking=summary for the investigation)`,
      cause: 'The heap alone was allowed the whole limit. On the VM, non-heap memory used RAM outside the 2 GB heap; in the container it competes for the same 2 GiB.',
      fix: 'Size the heap relative to the limit, keep request = limit for memory, and make heap exhaustion fail fast and visibly.',
      fixCode: `resources:
  requests: { cpu: "2", memory: 2Gi }
  limits:   { memory: 2Gi }
env:
- name: JAVA_TOOL_OPTIONS
  value: >-
    -XX:MaxRAMPercentage=70
    -XX:+ExitOnOutOfMemoryError
    -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/dumps
# heap ≈ 1434 MiB; ~600 MiB left for metaspace, threads, code cache, GC and native` },
    { title: 'A burst of 502s on every deployment',
      symptom: 'Each rollout of <code>checkout</code> produces 20–50 HTTP 502s at the ingress for a few seconds per terminating Pod. The app logs show a clean shutdown.',
      diagnoseLang: 'bash',
      diagnose: `# ingress-nginx logs at the moment a Pod terminates
kubectl logs -n ingress-nginx deploy/ingress-nginx-controller | grep 'connect() failed (111: Connection refused)'
kubectl get deploy checkout -o jsonpath='{.spec.template.spec.containers[0].lifecycle}'   # (empty)
kubectl get deploy checkout -o jsonpath='{.spec.template.spec.terminationGracePeriodSeconds}'   # 30
# application.yaml: server.shutdown not set (Boot 3.3 → immediate)`,
      cause: 'On deletion, the EndpointSlice update and SIGTERM happen at the same time. The JVM closed its listener immediately, while the ingress controller and kube-proxy still routed new requests to the Pod for a second or two. With immediate shutdown, in-flight requests were also cut.',
      fix: 'Keep accepting traffic while routing converges (preStop sleep), then drain gracefully, inside a grace period that covers both. Spring Boot 3.4+ enables graceful shutdown by default; set it explicitly on older versions.',
      fixCode: `spec:
  terminationGracePeriodSeconds: 45        # 10 preStop + 30 drain + 5 margin
  containers:
  - name: app
    lifecycle:
      preStop:
        sleep: { seconds: 10 }             # K8s 1.30+ (GA in 1.34); else exec: ["sleep","10"]
---
# application.yaml
server:
  shutdown: graceful
spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s` },
    { title: 'p99 latency spikes at 35% average CPU',
      symptom: 'After a platform team added <code>limits.cpu: 1</code> to all Deployments “for fairness”, the <code>search</code> API’s p99 went from 120 ms to over 900 ms. Average CPU usage is 0.35 cores.',
      diagnoseLang: 'bash',
      diagnose: `kubectl exec deploy/search -- jcmd 1 VM.flags | tr ' ' '\\n' | grep -E 'GC|ActiveProcessor'
#  -XX:+UseSerialGC
kubectl exec deploy/search -- jcmd 1 GC.heap_info | head -2   # def new generation ... (Serial)
# PromQL: throttled share of periods
#  rate(container_cpu_cfs_throttled_periods_total{container="app"}[5m])
#    / rate(container_cpu_cfs_periods_total{container="app"}[5m])   ≈ 0.4`,
      cause: 'Two effects of the same limit. The JVM saw 1 processor and chose SerialGC, so every young collection stopped all threads and ran on one core. And request bursts used the 100 ms quota in a fraction of the period, so 40% of periods were throttled.',
      fix: 'Remove the CPU limit for this service (keep a realistic request), or set at least 2–4 CPUs; pin the GC and processor count so ergonomics don’t depend on the limit.',
      fixCode: `resources:
  requests: { cpu: "2", memory: 3Gi }
  limits:   { memory: 3Gi }               # no CPU limit: no CFS throttling
env:
- name: JAVA_TOOL_OPTIONS
  value: "-XX:+UseG1GC -XX:ActiveProcessorCount=2 -XX:MaxRAMPercentage=72"` }
  ],
  puzzles: [
    { kind: 'predict', q: 'JDK 21, no JVM flags, <code>limits.memory: 2Gi</code>. What is the maximum heap?', options: ['512 MiB', '2 GiB', '1 GiB', 'A quarter of the node’s RAM'], answer: 0, explain: 'The JVM sees the container limit as physical memory and applies the default <code>MaxRAMPercentage=25</code>: <b>512 MiB</b>. That is why you set it explicitly.' },
    { kind: 'scenario', q: 'A Spring Boot service with 200 Tomcat threads runs with <code>-XX:MaxRAMPercentage=75</code> in a <b>1Gi</b> container. What is the most likely outcome at sustained peak load?', options: ['Fine: 25% is plenty of headroom', 'OutOfMemoryError: Java heap space', 'OOMKilled: a 768 MiB heap plus ~300–400 MiB of non-heap exceeds 1 GiB', 'The JVM refuses to start'], answer: 2, explain: 'Non-heap memory doesn’t scale down with the container. In a small container it can be a third of the limit, so 75% leaves too little. Use about 50–60% at 1 GiB, or give it 2 GiB.' },
    { kind: 'predict', q: '<code>limits.cpu: 1</code> on a 16-core node, JDK 21, no GC flags. Which collector runs?', options: ['G1', 'ZGC', 'Serial', 'Parallel'], answer: 2, explain: 'One available processor means the JVM doesn’t consider the machine server class, so ergonomics pick <b>SerialGC</b>. Set <code>-XX:+UseG1GC</code> explicitly or give the Pod 2+ CPUs.' },
    { kind: 'predict', q: '<code>requests.cpu: 2</code>, <b>no CPU limit</b>, 16-core node, JDK 21. What does <code>Runtime.availableProcessors()</code> return?', options: ['2', '16', '1', '8'], answer: 1, explain: 'Without a quota there is nothing to cap the count, and current JDKs ignore CPU shares (requests) by default, so it returns the node’s <b>16</b>. GC threads and pools are then sized for 16 cores; consider <code>-XX:ActiveProcessorCount</code>.' },
    { kind: 'scenario', q: 'Grace period 30 s, preStop <code>sleep 20</code>, Spring graceful shutdown with a 30 s phase timeout. A 35 s report request starts at the moment the Pod is deleted (t = 0). What happens to it?', options: ['It completes at t = 35 s: Spring waits up to 30 s after SIGTERM', 'It is cut off at t = 20 s, when SIGTERM arrives', 'It is cut off at t = 30 s by SIGKILL: the preStop time counts against the grace period, so Spring only gets 10 s to drain', 'The kubelet extends the grace period until in-flight requests finish'], answer: 2, explain: 'The grace period starts at deletion. preStop runs 0–20 s, SIGTERM arrives at 20 s, and Spring would wait until 50 s, but the kubelet sends SIGKILL at 30 s. Budget grace ≥ preStop + drain timeout + margin.' },
    { kind: 'scenario', q: 'The image uses <code>ENTRYPOINT ["/start.sh"]</code>, and the script’s last line is <code>java -jar /app/app.jar</code> (no <code>exec</code>). The Pod is deleted. What happens?', options: ['The shell (PID 1) gets SIGTERM and doesn’t forward it; the JVM keeps running until SIGKILL after the grace period (exit 137)', 'Spring shuts down gracefully', 'Kubernetes sends SIGTERM to every process', 'The JVM exits with 143 immediately'], answer: 0, explain: 'Only PID 1 receives the signal. A shell running a child doesn’t pass SIGTERM on, so the app never starts its shutdown. Use <code>exec</code> or the exec form of ENTRYPOINT.' },
    { kind: 'concept', q: 'Spring Boot flips readiness to REFUSING_TRAFFIC when shutdown starts. Why do you still need a preStop sleep?', options: ['You don’t', 'Readiness probes are disabled during termination', 'preStop makes Spring flush logs', 'Endpoint removal starts at Pod deletion anyway; the problem is the propagation delay to kube-proxy and ingress controllers, during which new requests still arrive. preStop keeps the app serving through that window'], answer: 3, explain: 'A terminating Pod is removed from ready endpoints as soon as it is deleted; readiness doesn’t speed that up. What takes time is every node and proxy learning about it. Without the sleep, the app stops accepting connections before routing stops sending them.' },
    { kind: 'concept', q: 'You change one class and rebuild with Jib. Which image layer changes?', options: ['All layers', 'Only the classes (application) layer', 'The dependencies layer', 'The base image layer'], answer: 1, explain: 'Jib puts dependencies, snapshot dependencies, resources and classes in separate layers, and builds reproducibly (fixed timestamps), so unchanged layers keep the same digest and are neither pushed nor pulled again.' }
  ],
  interview: [
    { q: 'How do you size the JVM heap for a container?', a: '<p>Set the memory request equal to the limit, and size the heap as a fraction of it with <code>-XX:MaxRAMPercentage</code>, leaving room for non-heap: metaspace, code cache, thread stacks (about one per thread), direct buffers, GC structures and native allocations. Non-heap is roughly fixed (often 300–500 MiB for a Spring service), so the right percentage grows with the limit: ~50–60% at 1 GiB, ~70–75% at 2–4 GiB. Verify with Native Memory Tracking and <code>container_memory_working_set_bytes</code> under realistic load, not at idle.</p>', fu: 'Why not set -Xmx? (It works if you keep it in sync with the limit, but percentages follow the limit automatically when someone changes resources.)', lvl: 'core' },
    { q: 'OOMKilled vs OutOfMemoryError: how do you tell, and what do you do?', a: '<p><b>OOMKilled</b>: <code>lastState.terminated.reason: OOMKilled</code>, exit 137, no Java log. The container total exceeded the limit; heap plus non-heap is too big for the limit. Lower the heap percentage, find native growth (NMT, thread count, direct buffers), or raise the limit. <b>OutOfMemoryError</b>: a Java exception in the log; the heap (or metaspace, or direct memory) hit its own JVM limit. Raise the heap or fix the leak (heap dump). Add <code>-XX:+ExitOnOutOfMemoryError</code> so a broken JVM restarts instead of limping on.</p>', lvl: 'core' },
    { q: 'What does a CPU limit do to a JVM?', a: '<ul><li><b>Ergonomics</b>: <code>availableProcessors()</code> = the limit rounded up. Below 2 the default GC becomes Serial; GC thread counts, the common ForkJoinPool, Netty event loops and many libraries size themselves from it.</li><li><b>Throttling</b>: the limit is a CFS quota per 100 ms period across all threads; bursts (GC, JIT, request spikes) exhaust it and the container is paused until the next period, which shows up as tail latency.</li></ul><p>Without a limit, current JDKs see all node cores (they ignore CPU shares by default), so consider <code>-XX:ActiveProcessorCount</code>.</p>', lvl: 'deep' },
    { q: 'Should JVM services have CPU limits?', a: '<p>Many teams set CPU <b>requests</b> (for scheduling and fair share under contention) and no CPU <b>limit</b> for latency-sensitive services, because throttling hurts p99 and an idle core is wasted anyway. Limits still make sense for noisy batch jobs, multi-tenant clusters with strict isolation, or cost controls; then set them well above the request and pin <code>ActiveProcessorCount</code> and the GC. Memory is different: always set a memory limit (equal to the request).</p>', lvl: 'deep' },
    { q: 'How do Spring Boot Actuator probes map to Kubernetes probes?', a: '<p>Since Boot 2.3, Actuator exposes the <code>liveness</code> and <code>readiness</code> health groups, backed by <code>LivenessState</code> and <code>ReadinessState</code>; they are enabled automatically when the app detects Kubernetes. Readiness becomes ACCEPTING_TRAFFIC after startup runners finish and REFUSING_TRAFFIC at shutdown. Keep external dependencies out of liveness; add them to readiness only deliberately. With a separate management port, set <code>add-additional-paths</code> and probe <code>/livez</code> and <code>/readyz</code> on the main port. Add a startup probe for slow boots. Details on <a href="probes.html">Probes</a>.</p>', lvl: 'core' },
    { q: 'Walk through a graceful shutdown of a Spring Boot Pod.', a: '<ol><li>Pod deleted: the endpoint is marked terminating (traffic starts draining away) and the kubelet runs the <b>preStop</b> hook, e.g. sleep 10 s, while the app keeps serving.</li><li>SIGTERM to PID 1 (the JVM, if you used exec form).</li><li>Spring: readiness → REFUSING_TRAFFIC, the web server stops accepting connections and waits for in-flight requests up to <code>timeout-per-shutdown-phase</code>; then SmartLifecycle beans stop (Kafka listeners, schedulers), the context closes pools.</li><li>The JVM exits (143). If anything is still running when the grace period ends, SIGKILL.</li></ol><p>Spring Boot 3.4 made graceful shutdown the default; set <code>server.shutdown=graceful</code> on older versions. See <a href="disruptions-pdb.html">Disruptions & PDBs</a> for the routing race.</p>', lvl: 'core' },
    { q: 'Jib vs buildpacks vs a Dockerfile: how do you build Spring Boot images?', a: '<ul><li><b>Jib</b> (Maven/Gradle plugin): no Docker daemon, no Dockerfile; layers dependencies, resources and classes separately; reproducible; pushes straight to the registry. You choose the base image and user.</li><li><b>Buildpacks</b> (<code>spring-boot:build-image</code> / <code>bootBuildImage</code>, Paketo): produce a layered, non-root image with a JRE and a <b>memory calculator</b> that sets heap flags from the container limit at startup; base images are patched by rebasing.</li><li><b>Dockerfile</b> with Spring Boot’s layer extraction: full control (for example a jlink-ed JRE), more to maintain.</li></ul>', lvl: 'core' },
    { q: 'How does the Paketo memory calculator decide the heap size?', a: '<p>At container start it reads the memory limit and subtracts estimates for everything that isn’t heap: direct memory, metaspace (from the number of classes in the app), reserved code cache, and thread stacks (a default of 250 threads × the stack size). The remainder becomes <code>-Xmx</code>. If your app runs more threads (or uses lots of direct memory), tell it via <code>BPL_JVM_THREAD_COUNT</code> or JVM options, or it can over-allocate heap.</p>', lvl: 'deep' },
    { q: 'How do you make a Spring Boot app start faster on Kubernetes, and why does it matter?', a: '<p>Startup time drives probe budgets, rollout duration and how fast autoscaling helps under a spike. Options: give the JVM CPU during startup (a limit throttles class loading and JIT), Class Data Sharing / AppCDS (Spring Boot 3.3+ can produce a CDS-friendly layout), lazy initialization for non-critical beans, fewer auto-configurations, GraalVM native images (much faster start and smaller footprint, with build-time constraints), or checkpoint/restore (CRaC) where supported.</p>', lvl: 'deep' },
    { q: 'What should requests and limits look like for a typical Spring Boot service?', a: '<p>Memory: request = limit = measured peak footprint plus margin (e.g. 2Gi), with <code>MaxRAMPercentage</code> ~70. CPU: request = steady-state usage at peak (e.g. 1–2 cores), limit unset or well above. The memory request matters most: a JVM rarely gives memory back to the OS quickly, so a request below its real footprint makes the Pod a likely eviction candidate under node pressure.</p>', lvl: 'core' },
    { q: 'Virtual threads on Kubernetes: what changes?', a: '<p>With Java 21 virtual threads (<code>spring.threads.virtual.enabled=true</code> in Boot 3.2+), request handling no longer needs hundreds of platform threads, so thread-stack memory shrinks and blocking I/O scales better. It doesn’t remove limits elsewhere: the DB connection pool and downstream capacity still cap throughput, and CPU limits still throttle. Carrier threads default to the processor count, which again comes from the CPU limit.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Deployment for a Spring Boot service', lang: 'yaml', code: `apiVersion: apps/v1
kind: Deployment
metadata: { name: orders, namespace: shop }
spec:
  replicas: 3
  selector: { matchLabels: { app: orders } }
  template:
    metadata:
      labels: { app: orders }
    spec:
      terminationGracePeriodSeconds: 45
      containers:
      - name: app
        image: registry.example.com/orders@sha256:4f1c…    # built by Jib or buildpacks
        ports: [{ name: http, containerPort: 8080 }]
        resources:
          requests: { cpu: "2", memory: 2Gi }
          limits:   { memory: 2Gi }
        env:
        - name: JAVA_TOOL_OPTIONS
          value: >-
            -XX:MaxRAMPercentage=70
            -XX:+ExitOnOutOfMemoryError
            -XX:ActiveProcessorCount=2
        startupProbe:
          httpGet: { path: /livez, port: http }
          periodSeconds: 5
          failureThreshold: 36
        livenessProbe:
          httpGet: { path: /livez, port: http }
          periodSeconds: 10
          timeoutSeconds: 3
        readinessProbe:
          httpGet: { path: /readyz, port: http }
          periodSeconds: 5
        lifecycle:
          preStop:
            sleep: { seconds: 10 }
        securityContext:
          runAsNonRoot: true
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities: { drop: ["ALL"] }
        volumeMounts: [{ name: tmp, mountPath: /tmp }]
      volumes: [{ name: tmp, emptyDir: {} }]` },
    { title: 'application.yaml', lang: 'yaml', code: `# Spring Boot 3.x
server:
  shutdown: graceful                    # default from Boot 3.4
spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s
  threads:
    virtual:
      enabled: true                     # Java 21 + Boot 3.2+
management:
  endpoint:
    health:
      probes:
        enabled: true                   # automatic on Kubernetes
        add-additional-paths: true      # /livez and /readyz on the main port
      group:
        readiness:
          include: readinessState       # add ",db" only deliberately
  endpoints:
    web:
      exposure:
        include: health,prometheus` },
    { title: 'Layered Dockerfile', lang: 'docker', code: `# Spring Boot 3.3+: extract layers with the "tools" jar mode
FROM eclipse-temurin:21-jre AS extract
WORKDIR /build
COPY target/orders.jar app.jar
RUN java -Djarmode=tools -jar app.jar extract --layers --launcher --destination extracted

FROM eclipse-temurin:21-jre
RUN useradd --uid 1000 --no-create-home app
USER 1000
WORKDIR /app
# least-changing layers first: only "application" changes on most commits
COPY --from=extract /build/extracted/dependencies/ ./
COPY --from=extract /build/extracted/spring-boot-loader/ ./
COPY --from=extract /build/extracted/snapshot-dependencies/ ./
COPY --from=extract /build/extracted/application/ ./
# exec form: the JVM is PID 1 and receives SIGTERM
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]` },
    { title: 'Jib and buildpacks', lang: 'bash', code: `# Jib: no Docker daemon, layered, reproducible
./mvnw compile jib:build \\
  -Dimage=registry.example.com/orders:7.2 \\
  -Djib.from.image=eclipse-temurin:21-jre \\
  -Djib.container.user=1000 \\
  -Djib.container.jvmFlags=-XX:MaxRAMPercentage=70,-XX:+ExitOnOutOfMemoryError

# Buildpacks (Paketo): needs a Docker-compatible daemon
./mvnw spring-boot:build-image \\
  -Dspring-boot.build-image.imageName=registry.example.com/orders:7.2
# runtime tuning of the memory calculator, set on the container:
#   BPL_JVM_THREAD_COUNT=300      (default 250)
#   JAVA_TOOL_OPTIONS=-XX:+ExitOnOutOfMemoryError

# check what the JVM decided, inside the running Pod
kubectl exec deploy/orders -- java -XshowSettings:system -version 2>&1 | head -12
kubectl exec deploy/orders -- jcmd 1 VM.flags` }
  ]
});

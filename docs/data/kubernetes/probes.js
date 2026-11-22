IA.register({
  track: 'kubernetes',
  slug: 'probes',
  title: 'Probes',
  tagline: 'Three probes, three questions. <b>Startup</b>: has it finished booting? <b>Liveness</b>: is it stuck beyond repair, so restart it? <b>Readiness</b>: should it get traffic right now? Mix them up and the kubelet becomes the cause of your outage.',
  tldr: {
    problem: 'Slow-starting JVMs killed in a restart loop, a 40-second database blip that restarts every pod at once, healthy pods killed at peak load because the health endpoint took 1.2 s. Probes cause more outages than they prevent when they are tuned by copy-paste.',
    model: 'The kubelet runs each probe every <code>periodSeconds</code>, with a <code>timeoutSeconds</code> per attempt. <code>failureThreshold</code> consecutive failures trigger the action: startup or liveness → <b>kill and restart the container</b>; readiness → <b>remove the pod from Service endpoints</b> (no restart). Until the startup probe succeeds, the other two don’t run.',
    hook: '“Should liveness check the database?” No. If the DB is down, restarting the app doesn’t fix the DB; it just adds a fleet of cold JVMs to the recovery.',
    facts: [
      { v: '10 / 1 / 3', l: 'defaults: <code>periodSeconds</code> 10, <code>timeoutSeconds</code> 1, <code>failureThreshold</code> 3. A hung container is killed roughly 20–30 s after it hangs' },
      { v: 'startup first', l: 'while a startupProbe is defined and has not yet succeeded, liveness and readiness probes are not run at all' },
      { v: 'readiness ≠ restart', l: 'a failing readiness probe only takes the pod out of EndpointSlices. restartCount does not change' }
    ]
  },
  intro: {
    what: 'Kubernetes can’t look inside your app, so it asks: every few seconds the <b>kubelet</b> on the node calls an endpoint you choose (HTTP, TCP, gRPC or a command). A <b>startup probe</b> waits for a slow app to finish booting. A <b>liveness probe</b> detects an app that is stuck for good and restarts it. A <b>readiness probe</b> decides whether the pod should receive traffic right now. Spring Boot Actuator provides exactly these endpoints.',
    analogy: { icon: '🏥', title: 'Three questions at a hospital', text: 'Startup: “has the patient come round from anaesthetic?” Ask patiently; don’t act yet. Liveness: “is the heart beating?” If not, use the defibrillator: drastic, so be sure. Readiness: “can they see visitors?” If not, just close the door for a while; nobody gets a defibrillator for being tired.' },
    steps: [
      { t: 'Spring gives you the endpoints', d: 'On Kubernetes, Actuator exposes liveness and readiness health groups automatically.', code: 'curl localhost:8080/actuator/health/liveness   # {"status":"UP"}\ncurl localhost:8080/actuator/health/readiness', lang: 'bash' },
      { t: 'Startup probe: patient while booting', d: 'Allow up to <code>periodSeconds × failureThreshold</code> to boot. Nothing else is probed until it passes.', code: 'startupProbe:\n  httpGet: { path: /actuator/health/liveness, port: 8080 }\n  periodSeconds: 5\n  failureThreshold: 36     # up to 180 s' },
      { t: 'Liveness probe: restart only if stuck', d: 'Check only the app’s own state, never dependencies.', code: 'livenessProbe:\n  httpGet: { path: /actuator/health/liveness, port: 8080 }\n  periodSeconds: 10\n  timeoutSeconds: 3' },
      { t: 'Readiness probe: traffic on or off', d: 'Fails during warm-up, during shutdown, or when the pod can’t serve. The pod stays running.', code: 'readinessProbe:\n  httpGet: { path: /actuator/health/readiness, port: 8080 }\n  periodSeconds: 5' }
    ],
    terms: [
      ['startupProbe', 'Holds off the other probes until the app has booted; failing it too often restarts the container.'],
      ['livenessProbe', 'Restarts the container after <code>failureThreshold</code> consecutive failures.'],
      ['readinessProbe', 'Adds or removes the pod from Service endpoints; never restarts it.'],
      ['periodSeconds / timeoutSeconds', 'How often to probe, and how long one attempt may take before it counts as a failure.'],
      ['failureThreshold / successThreshold', 'Consecutive failures before acting; consecutive successes before “ok” again (must be 1 for liveness and startup).'],
      ['health group', 'A Spring Boot Actuator subset of health indicators, such as <code>liveness</code> and <code>readiness</code>.']
    ]
  },
  visual: {
    title: 'Probe timeline for a Spring Boot pod that needs 60 s to boot',
    caption: 'Pick a configuration and press Play. Dots are probe results (green pass, red fail); the container lane shows boot (light), running (blue) and restarts (red). The bottom lane shows when the pod is in the Service. Step jumps to the next interesting event.'
  },
  gotchas: [
    { trap: 'Liveness without a startup probe on a slow JVM', code: `livenessProbe:
  httpGet: { path: /actuator/health/liveness, port: 8080 }
  initialDelaySeconds: 30    # boot takes 45–90 s depending on node and CPU limit`, why: 'If boot takes longer than <code>initialDelaySeconds + periodSeconds × failureThreshold</code>, the container is killed before it ever starts, and again, and again: CrashLoopBackOff with no error in the app log. CPU limits and busy nodes make boot time vary a lot.', fix: 'Add a <code>startupProbe</code> with a generous budget (e.g. 5 s × 36 = 3 min) and keep liveness strict after that. Don’t use <code>initialDelaySeconds</code> as a boot timer.' },
    { trap: 'Liveness checks the database', why: 'When the DB fails over, every pod’s liveness fails at once, and the kubelet restarts the whole fleet. The DB comes back after 40 s; your service comes back after a minute or more of cold JVM starts, all hitting the DB together.', fix: 'Liveness = “is this process broken beyond repair?” Use Spring’s <code>livenessState</code> only (the default <code>liveness</code> group). Never <code>include: "*"</code>.' },
    { trap: '<code>timeoutSeconds: 1</code> under load', why: 'At peak, CPU throttling, a GC pause or a full Tomcat thread pool makes the health endpoint take more than 1 s. Three slow answers in a row and the kubelet restarts a perfectly healthy pod, which moves its load to the others, which then also slow down.', fix: 'Liveness timeout 3–5 s and a higher failureThreshold; keep the endpoint cheap. Serve health on a separate thread pool or port, and fix the throttling. See <a href="resources-qos.html">Requests, limits & QoS</a>.' },
    { trap: 'One endpoint for liveness and readiness', why: 'If both probes hit <code>/actuator/health</code>, anything that should only make the pod <i>unready</i> (warming up, a dependency down, graceful shutdown) also gets it <i>killed</i>.', fix: 'Use <code>/actuator/health/liveness</code> and <code>/actuator/health/readiness</code>: separate groups, different meanings.' },
    { trap: 'Readiness on a shared dependency turns degradation into outage', why: 'If every replica’s readiness includes the same database, a DB blip makes all replicas unready together. The Service has zero endpoints and clients get 503 or connection refused, even for endpoints that don’t need the DB.', fix: 'Include a dependency in readiness only if the pod truly can’t serve anything without it, and know that the result is “all or nothing”. Prefer circuit breakers and fallbacks inside the app.' },
    { trap: 'Health on the management port lies about the main port', why: 'With <code>management.server.port: 8081</code>, probes hit a separate server. If the main connector on 8080 is exhausted or broken, the probes on 8081 still pass.', fix: 'Set <code>management.endpoint.health.probes.add-additional-paths: true</code> (Boot 2.6+) and probe <code>/livez</code> and <code>/readyz</code> on the main port.' },
    { trap: 'Exec probes that start a JVM or a shell every 10 s', why: 'An <code>exec</code> probe forks a process inside the container each period; a <code>jcmd</code> or a script with curl costs CPU and memory (it counts against your limit) and can hang.', fix: 'Prefer <code>httpGet</code>, <code>tcpSocket</code> or <code>grpc</code> (GA since 1.27). They are run by the kubelet and cost the app one request.' }
  ],
  scenarios: [
    { title: 'CrashLoopBackOff after a dependency upgrade, with clean logs',
      symptom: 'After upgrading a library, new pods restart every ~90 s. The app log ends mid-startup, with no exception. <code>kubectl describe</code> shows <code>Liveness probe failed: connection refused</code> then <code>Killing</code>.',
      diagnoseLang: 'bash',
      diagnose: `kubectl describe pod orders-6c7-p9x | grep -E 'Liveness|Killing|Started'
kubectl logs orders-6c7-p9x --previous | grep 'Started OrdersApplication'
#   (nothing: it was killed before startup finished)
kubectl get deploy orders -o jsonpath='{.spec.template.spec.containers[0].livenessProbe}'
#   initialDelaySeconds: 45, periodSeconds: 10, failureThreshold: 3`,
      cause: 'Classpath scanning grew and startup now takes ~80 s on a CPU-limited pod. Liveness allowed 45 + 3 × 10 = 75 s. Each restart starts the boot from zero.',
      fix: 'Add a startup probe sized for the slowest realistic boot; drop the initial delay on liveness.',
      fixCode: `startupProbe:
  httpGet: { path: /actuator/health/liveness, port: 8080 }
  periodSeconds: 5
  failureThreshold: 36        # 180 s budget
livenessProbe:
  httpGet: { path: /actuator/health/liveness, port: 8080 }
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3
readinessProbe:
  httpGet: { path: /actuator/health/readiness, port: 8080 }
  periodSeconds: 5
  failureThreshold: 3` },
    { title: 'A 40-second DB failover became a 6-minute outage',
      symptom: 'The managed Postgres failed over in about 40 s. Every one of 30 <code>payments</code> pods restarted within the same minute, and the service returned errors for six minutes.',
      diagnoseLang: 'bash',
      diagnose: `kubectl get pods -l app=payments   # RESTARTS 1 on every pod, same age
kubectl exec deploy/payments -- curl -s localhost:8080/actuator/health/liveness
#   {"status":"UP","components":{"db":{...},"diskSpace":...}}   ← db in liveness!
grep -r 'group.liveness' src/main/resources/`,
      cause: 'Someone had set <code>management.endpoint.health.group.liveness.include=*</code>. The DB indicator failed for 40 s, liveness failed three times, and all 30 pods were killed. Cold JVMs then booted together, stampeded the new primary with connection pools, and warmed up slowly.',
      fix: 'Liveness reports only the application’s own state. Decide separately whether readiness should include the DB.',
      fixCode: `management:
  endpoint:
    health:
      probes:
        enabled: true
        add-additional-paths: true       # /livez and /readyz on the main port
      group:
        liveness:
          include: livenessState         # never external dependencies
        readiness:
          include: readinessState         # add ",db" only if the pod is useless without it` },
    { title: 'Pods restarted at peak load during a sale',
      symptom: 'At peak traffic, pods restarted one after another. Each restart pushed more load to the survivors, which then restarted too. No OOMKilled; reason <code>Liveness probe failed: … context deadline exceeded</code>.',
      diagnoseLang: 'bash',
      diagnose: `kubectl get events --field-selector reason=Unhealthy | grep -c deadline
# container_cpu_cfs_throttled_periods_total rising sharply on every pod
# probe: timeoutSeconds 1, failureThreshold 3`,
      cause: 'A 1-CPU limit throttled the JVM under load; actuator responses took 1.5–3 s. With a 1 s timeout, three slow answers in a row restarted healthy but busy pods, and each restart cost a 60 s cold start at the worst possible moment.',
      fix: 'Make liveness tolerant (timeout 3–5 s, threshold 3–5), keep readiness responsive so overloaded pods shed load instead of dying, and remove the CPU limit or size it properly.',
      fixCode: `livenessProbe:
  httpGet: { path: /livez, port: 8080 }
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 5
resources:
  requests: { cpu: "2", memory: 2Gi }
  limits: { memory: 2Gi }             # no CPU limit: no CFS throttling` }
  ],
  puzzles: [
    { kind: 'scenario', q: 'A liveness probe with all defaults (period 10 s, timeout 1 s, threshold 3). The app deadlocks at t = 0. About when is the container killed?', options: ['After 1 s', 'About 20–30 s later', 'After 60 s', 'Never: the process is still running'], answer: 1, explain: 'The next probe (within 10 s) fails, then two more 10 s apart. The third consecutive failure triggers the kill, so 20–30 s after the hang depending on where in the period it happened.' },
    { kind: 'predict', q: '<code>startupProbe: { periodSeconds: 10, failureThreshold: 30 }</code>. How long may the app take to start before it is restarted?', options: ['30 s', '100 s', '300 s', 'Unlimited'], answer: 2, explain: '30 attempts × 10 s ≈ <b>300 s</b>. Liveness and readiness don’t run during that time. As soon as one startup attempt succeeds, the other probes take over.' },
    { kind: 'scenario', q: 'One pod’s readiness probe fails for 5 minutes. What happens?', options: ['It is restarted after 3 failures', 'It is removed from the Service’s endpoints; it keeps running and restartCount stays the same', 'It is evicted and rescheduled', 'The Deployment replaces it'], answer: 1, explain: 'Readiness only controls the pod’s <code>Ready</code> condition, and with it EndpointSlice membership. Nothing restarts it, and the Deployment controller does not replace unready pods (outside a rollout it just reports fewer available replicas).' },
    { kind: 'scenario', q: 'Liveness includes the DB health indicator. The database is down for 3 minutes. 20 replicas. What happens?', options: ['Pods go unready, then come back', 'All 20 are restarted about 30 s in; they keep failing and restarting, with growing back-off, until the DB returns', 'Only one pod restarts', 'Nothing: Spring caches health'], answer: 1, explain: 'Every pod’s liveness fails at the same moment, so all are killed. Restarted pods fail liveness again once booted, so they crash-loop with back-off. When the DB returns, pods may still be sitting in a back-off of a minute or more, then need a cold start.' },
    { kind: 'scenario', q: 'A pod has a startupProbe that has not succeeded yet. Is it in the Service’s endpoints?', options: ['Yes, from container start', 'No: readiness is not even run yet, so Ready is False', 'Yes, if liveness passes', 'Only for TCP Services'], answer: 1, explain: 'Readiness starts only after the startup probe succeeds, and a pod starts as not Ready. So a booting pod never gets traffic early, which is one more reason to use a startup probe.' },
    { kind: 'concept', q: 'You set <code>successThreshold: 3</code> on a liveness probe. What happens?', options: ['Liveness needs 3 passes to be healthy again', 'The API server rejects the pod spec: liveness and startup successThreshold must be 1', 'It is silently ignored', 'Readiness inherits it'], answer: 1, explain: 'Validation requires <code>successThreshold: 1</code> for liveness and startup probes. It is only meaningful for readiness (e.g. require 2 passes before taking traffic again).' },
    { kind: 'concept', q: 'With default Spring Boot probe groups, what does <code>/actuator/health/liveness</code> return while the database is down?', options: ['DOWN', 'UP: the liveness group contains only livenessState', 'OUT_OF_SERVICE', '503 with the db component'], answer: 1, explain: 'By default the <code>liveness</code> group has only <code>livenessState</code> and <code>readiness</code> only <code>readinessState</code>. External indicators such as <code>db</code> are excluded from both unless you add them.' },
    { kind: 'scenario', q: 'All 6 replicas fail readiness at the same time. A client in the cluster calls the ClusterIP Service. What does it get?', options: ['Traffic still goes to all 6', 'The Service has no ready endpoints: connection refused (or a 503 from an ingress)', 'Kubernetes ignores readiness when all pods fail it', 'The request waits until a pod is ready'], answer: 1, explain: 'With zero ready endpoints, kube-proxy installs a reject rule for the ClusterIP and connections are refused; an ingress controller typically answers 503. There is no “fail open”. That is the risk of readiness on shared dependencies.' }
  ],
  interview: [
    { q: 'Explain the difference between liveness, readiness and startup probes.', a: '<p><b>Startup</b>: “has it booted?”; failures beyond the threshold restart the container, and the other probes wait for it. <b>Liveness</b>: “is it irrecoverably stuck?”; failures restart the container. <b>Readiness</b>: “can it serve now?”; failures remove it from Service endpoints, no restart. Startup protects slow boots, liveness heals deadlocks, readiness steers traffic during warm-up, overload and shutdown.</p>', lvl: 'core' },
    { q: 'What should a liveness probe check?', a: '<p>Only conditions that a <b>restart would fix</b>: a deadlock, an event loop or thread pool that is permanently stuck, a corrupted internal state. Not dependencies (DB, Kafka, downstream APIs), not slowness. In Spring Boot, the <code>LivenessState</code> becomes BROKEN if you publish it, for example from a watchdog. When in doubt, a weak liveness probe is better than an aggressive one.</p>', lvl: 'core' },
    { q: 'How do you tune probes for a Spring Boot app with a slow, variable startup?', a: '<ul><li>startupProbe on <code>/actuator/health/liveness</code> with a budget above the slowest observed boot (measure under the real CPU limit).</li><li>liveness: period 10 s, timeout 3–5 s, threshold 3+.</li><li>readiness: period 5 s on <code>/actuator/health/readiness</code>; Spring reports ACCEPTING_TRAFFIC only after all runners finish, so warm-up done in an <code>ApplicationRunner</code> naturally delays readiness.</li><li><code>minReadySeconds</code> on the Deployment so rollouts wait a little longer.</li></ul>', fu: 'How would you warm up the JIT before taking traffic? (Replay representative requests in a runner, or use CDS/AppCDS, CRaC or Leyden-style ahead-of-time features to shorten the cold phase.)', lvl: 'deep' },
    { q: 'How does Spring Boot integrate with Kubernetes probes?', a: '<p>Since Boot 2.3, Actuator has <code>LivenessState</code> (CORRECT/BROKEN) and <code>ReadinessState</code> (ACCEPTING_TRAFFIC/REFUSING_TRAFFIC) and exposes them as the <code>liveness</code> and <code>readiness</code> health groups, enabled automatically when the app detects Kubernetes (or with <code>management.endpoint.health.probes.enabled=true</code>). The app publishes changes with <code>AvailabilityChangeEvent</code>; on shutdown readiness flips to REFUSING_TRAFFIC.</p>', lvl: 'core' },
    { q: 'Describe a probe-induced outage and how to prevent it.', a: '<p>Typical chain: a shared dependency fails or load spikes → probes fail on <b>all</b> pods at once (dependency in liveness, or timeouts under throttling) → kubelet restarts everything → cold JVMs, empty caches and connection storms extend the outage. Prevention: no dependencies in liveness, generous liveness timeouts and thresholds, startup probes, readiness that sheds load rather than kills, and avoiding CPU throttling.</p>', lvl: 'deep' },
    { q: 'Which probe types are there?', a: '<p><code>httpGet</code> (2xx–3xx = success), <code>tcpSocket</code> (connection opens), <code>grpc</code> (standard gRPC health protocol, GA since 1.27) and <code>exec</code> (exit code 0). The kubelet runs HTTP, TCP and gRPC probes from the node, against the pod IP; exec runs inside the container and costs a process each time.</p>', lvl: 'core' },
    { q: 'What happens to traffic and probes during termination?', a: '<p>As soon as the pod is marked for deletion, its endpoints are flagged as terminating and not ready, so new traffic stops whatever readiness says (with the propagation lag that preStop sleeps cover). Spring flips readiness to REFUSING_TRAFFIC on shutdown, consistent with that. Keep the health endpoint responsive while draining, so a slow shutdown is not mistaken for a hang. A probe-level <code>terminationGracePeriodSeconds</code> lets a liveness-triggered kill use a shorter grace period than a normal deletion.</p>', lvl: 'deep' },
    { q: 'Why is initialDelaySeconds a poor substitute for a startup probe?', a: '<p>It is a fixed delay applied to every start. Too small and slow boots are killed; too large and every restart, including real crash recovery, waits that long before liveness can detect anything, and readiness is delayed even when the app is up early. A startup probe adapts: it ends as soon as the app is up, with a maximum budget.</p>', lvl: 'core' },
    { q: 'Should readiness include downstream dependencies?', a: '<p>It depends on what the pod can do without them. If nothing works without the DB, failing readiness is honest but turns a DB problem into “no endpoints” (503s everywhere), and the pods come back the moment the DB does. If some endpoints still work, keep readiness local and handle dependency failure in the app (circuit breaker, cached responses, clear errors). Never let readiness depend on another service that depends on you: that is a deadlock at startup.</p>', lvl: 'deep' },
    { q: 'How do probe failures show up, and how do you debug them?', a: '<p>Events with reason <code>Unhealthy</code> (“Liveness probe failed: HTTP probe failed with statuscode: 503” or “context deadline exceeded”), then <code>Killing</code> for liveness. <code>kubectl describe pod</code> shows them with the probe config. Reproduce from inside: <code>kubectl exec</code> and <code>curl -w \'%{time_total}\'</code> the endpoint; check CPU throttling and GC logs when the cause is timeouts.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Probes for a Spring Boot service', lang: 'yaml', code: `containers:
- name: app
  image: registry/orders:7.2
  ports: [{ name: http, containerPort: 8080 }]
  startupProbe:                         # boot budget: 5 s × 36 = 180 s
    httpGet: { path: /livez, port: http }
    periodSeconds: 5
    failureThreshold: 36
  livenessProbe:                        # only "is this JVM broken?"
    httpGet: { path: /livez, port: http }
    periodSeconds: 10
    timeoutSeconds: 3
    failureThreshold: 3
  readinessProbe:                       # traffic on/off; fast to react
    httpGet: { path: /readyz, port: http }
    periodSeconds: 5
    timeoutSeconds: 2
    failureThreshold: 3
    successThreshold: 1` },
    { title: 'Actuator configuration', lang: 'yaml', code: `# application.yaml (Spring Boot 3.x)
management:
  endpoints:
    web:
      exposure:
        include: health,info,prometheus
  endpoint:
    health:
      probes:
        enabled: true                   # automatic on Kubernetes
        add-additional-paths: true      # /livez and /readyz on the MAIN port
      group:
        liveness:
          include: livenessState
        readiness:
          include: readinessState       # add ",db" only deliberately
      show-details: never` },
    { title: 'Warm up before accepting traffic', lang: 'java', code: `@Component
class WarmUp implements ApplicationRunner {
    private final OrderService orders;
    WarmUp(OrderService orders) { this.orders = orders; }

    // Spring Boot publishes ReadinessState.ACCEPTING_TRAFFIC only after all
    // ApplicationRunners have finished, so /readyz stays DOWN during this loop.
    @Override
    public void run(ApplicationArguments args) {
        for (int i = 0; i < 2_000; i++) orders.quote(SampleData.order(i));   // JIT + caches + pool
    }
}

@Component
class Watchdog {
    private final ApplicationEventPublisher events;
    Watchdog(ApplicationEventPublisher events) { this.events = events; }

    void onFatalState() {   // e.g. a worker thread pool is permanently wedged
        AvailabilityChangeEvent.publish(events, this, LivenessState.BROKEN);   // liveness → DOWN → restart
    }
}`, note: 'Keep the warm-up inside the startup probe’s budget.' }
  ]
});

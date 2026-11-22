IA.register({
  track: 'kubernetes',
  slug: 'disruptions-pdb',
  title: 'Disruptions & PDBs',
  tagline: 'Pods get killed on purpose all the time: drains, upgrades, autoscaler scale-downs. A <b>PodDisruptionBudget</b> limits how many go at once, but only for evictions. A clean exit also needs <b>graceful termination</b>: stop receiving traffic first, then finish in-flight work, then exit before the SIGKILL.',
  tldr: {
    problem: 'Node upgrades that take out every replica at once, drains that hang forever, and 502s on every deploy because pods die while the load balancer still sends them traffic.',
    model: 'Voluntary disruptions go through the <b>Eviction API</b>, which checks the PDB (<code>disruptionsAllowed</code>) and answers 429 when the budget is spent. Termination: <code>deletionTimestamp</code> → the endpoint is removed <i>in parallel</i> with <b>preStop</b> → <b>SIGTERM</b> → <code>terminationGracePeriodSeconds</code> (30 s by default, counting from the start, preStop included) → <b>SIGKILL</b>.',
    hook: '“Why do we get 502s during rollouts even with Spring graceful shutdown?” Because SIGTERM arrives at the same moment the endpoint removal starts propagating. A short <code>preStop</code> sleep closes that race.',
    facts: [
      { v: '429', l: 'what the Eviction API returns when evicting a pod would break its PDB. <code>kubectl drain</code> keeps retrying (every 5 s) until it fits or times out' },
      { v: '30 s', l: 'default <code>terminationGracePeriodSeconds</code>. preStop time counts against it, so a 10 s sleep leaves 20 s for the app' },
      { v: '3.4', l: 'the Spring Boot version that turned graceful shutdown on by default (<code>server.shutdown=graceful</code>, 30 s per shutdown phase)' }
    ]
  },
  intro: {
    what: 'A <b>disruption</b> is anything that stops a pod. Some you choose (draining a node for an upgrade, a rollout, the autoscaler removing a node): these are <b>voluntary</b>. Some just happen (a node crashes, the kernel OOM-kills a process): these are <b>involuntary</b>. A <b>PodDisruptionBudget</b> tells Kubernetes “never take more than N of these pods down at once on purpose”. <b>Graceful termination</b> is how each pod shuts down without dropping requests.',
    analogy: { icon: '🏪', title: 'Closing a shop for the night', text: 'First you flip the sign to “closed” and lock the door to new customers (remove the endpoint). You wait a moment for people already walking up (preStop sleep). You serve the customers still inside (graceful shutdown). At closing time the lights go off whoever is left (SIGKILL). A PDB is the rule that two of your three branches must stay open while one is being renovated.' },
    steps: [
      { t: 'Know which disruptions a PDB covers', d: 'Only evictions: <code>kubectl drain</code>, Cluster Autoscaler/Karpenter scale-down, many managed node upgrades. <b>Not</b> <code>kubectl delete pod</code>, Deployment rollouts, node crashes or kubelet node-pressure eviction.' },
      { t: 'Write a PDB', d: 'Either a minimum that must stay available, or a maximum that may be unavailable.', code: 'apiVersion: policy/v1\nkind: PodDisruptionBudget\nmetadata: { name: orders }\nspec:\n  maxUnavailable: 1\n  selector: { matchLabels: { app: orders } }' },
      { t: 'Drain a node', d: 'Cordon (no new pods), then evict each pod through the Eviction API, which respects PDBs.', code: 'kubectl drain node-1 --ignore-daemonsets --delete-emptydir-data --timeout=10m', lang: 'bash' },
      { t: 'Shut down gracefully', d: 'Give the routing layer time to forget the pod, then let Spring finish in-flight requests.', code: 'lifecycle:\n  preStop:\n    sleep: { seconds: 10 }   # K8s 1.30+ (beta, on by default)\nterminationGracePeriodSeconds: 45' },
      { t: 'Check the budget', d: '<code>ALLOWED DISRUPTIONS 0</code> means the next drain step will wait.', code: 'kubectl get pdb -A\n# NAMESPACE  NAME    MIN AVAILABLE  MAX UNAVAILABLE  ALLOWED DISRUPTIONS\n# shop       orders  N/A            1                1', lang: 'bash' }
    ],
    terms: [
      ['voluntary disruption', 'Caused by an operator or controller action: drain, scale-down, upgrade, rollout, delete.'],
      ['involuntary disruption', 'Hardware or kernel failure, node crash, cloud VM loss, OOM kill, node-pressure eviction.'],
      ['Eviction API', '<code>POST …/pods/&lt;name&gt;/eviction</code>: a polite delete that is refused (429) if it would break a PDB.'],
      ['cordon', 'Mark a node unschedulable. Existing pods keep running.'],
      ['preStop hook', 'A command, HTTP call or sleep run before SIGTERM is sent to the container.'],
      ['grace period', 'Time between the start of termination and SIGKILL (<code>terminationGracePeriodSeconds</code>).']
    ]
  },
  visual: {
    title: 'Drain a node against a PDB',
    caption: 'Choose a PDB and press Play to drain node-1, which runs two of the three replicas. Watch the eviction responses (201 or 429), the budget, and the replacement pods that must become Ready before the next eviction is allowed.'
  },
  extras: [
    { id: 'disruptions-pdb-shutdown', title: 'Graceful termination: the race against routing', label: 'Shutdown', caption: 'Toggle the preStop sleep, Spring’s shutdown mode, the grace period and the ENTRYPOINT form. Step through the termination of one pod and count which requests succeed, get refused, or are cut off mid-flight.' }
  ],
  gotchas: [
    { trap: 'A PDB that allows zero disruptions blocks every drain', code: `spec:\n  minAvailable: 1      # with replicas: 1 → disruptionsAllowed: 0, forever\n  selector: { matchLabels: { app: batch-api } }`, why: '<code>minAvailable</code> equal to the replica count (or <code>maxUnavailable: 0</code>) means no eviction can ever succeed. Node upgrades stall, and the platform team ends up using <code>--disable-eviction</code> or deleting pods by hand, which is worse.', fix: 'Run at least 2 replicas for anything with a PDB, and prefer <code>maxUnavailable: 1</code>, which keeps working as replica counts change. Alert on PDBs with <code>disruptionsAllowed == 0</code> for long periods.' },
    { trap: 'PDBs don’t protect against rollouts or deletes', why: 'A Deployment rolling update uses its own <code>maxUnavailable</code>/<code>maxSurge</code>, not the PDB. <code>kubectl delete pod</code> and node crashes bypass it too, and so does the kubelet evicting pods under node memory or disk pressure.', fix: 'Set the Deployment strategy deliberately (for example <code>maxUnavailable: 0, maxSurge: 25%</code>), spread replicas across nodes and zones, and size requests and limits so node-pressure eviction is rare.' },
    { trap: 'SIGTERM races the endpoint removal', why: 'When a pod is deleted, the EndpointSlice update and the kubelet’s preStop/SIGTERM start <b>at the same time</b>. kube-proxy on every node, ingress controllers and cloud LBs need a moment to stop routing. If the app closes its listener at once, the requests still routed there fail.', fix: 'Add a <code>preStop</code> sleep (5–15 s) so the pod keeps serving while routing converges, then let Spring’s graceful shutdown drain in-flight requests.' },
    { trap: 'preStop + app shutdown longer than the grace period', why: 'The grace period counts from the start of termination and includes preStop. With a 20 s sleep, a 30 s Spring shutdown phase and the default 30 s grace, the JVM gets SIGKILL 10 s into its shutdown.', fix: 'Budget it: <code>terminationGracePeriodSeconds ≥ preStop + spring.lifecycle.timeout-per-shutdown-phase + a few seconds</code>.' },
    { trap: 'Shell-form ENTRYPOINT swallows SIGTERM', code: `# Dockerfile\nENTRYPOINT java -jar /app.jar          # shell form: /bin/sh is PID 1\nENTRYPOINT ["java", "-jar", "/app.jar"] # exec form: java is PID 1 ✓`, lang: 'docker', why: 'In shell form, <code>sh -c</code> becomes PID 1 and doesn’t forward SIGTERM to the JVM. Spring never starts its graceful shutdown. The pod sits for the whole grace period, then gets SIGKILL: shutdown hooks don’t run, Kafka offsets aren’t committed, connections aren’t closed.', fix: 'Use exec form, or <code>exec java …</code> in an entrypoint script. Buildpacks and Jib images already do this. Check with <code>kubectl exec … -- ps -o pid,comm</code> that java is PID 1.' },
    { trap: 'Evicting unhealthy pods is blocked by default', why: 'With the default <code>unhealthyPodEvictionPolicy: IfHealthyBudget</code>, running-but-not-ready pods can be evicted only while the budget is healthy. A Deployment stuck in a crash loop can therefore block a drain, although those pods serve nothing.', fix: 'Set <code>unhealthyPodEvictionPolicy: AlwaysAllow</code> (GA in 1.31) on most PDBs, so broken pods never block node maintenance.' }
  ],
  scenarios: [
    { title: 'Cluster upgrade stuck for 6 hours on one node',
      symptom: 'A managed node-pool upgrade stopped progressing. One old node is cordoned and still runs a single pod.',
      diagnose: `kubectl get pdb -A | awk '$5 == 0'\n# shop   legacy-api   1   N/A   0      ← minAvailable 1, replicas 1\nkubectl get events -A --field-selector reason=EvictionBlocked 2>/dev/null | tail -2\n# Cannot evict pod as it would violate the pod's disruption budget.`,
      diagnoseLang: 'bash',
      cause: 'A single-replica Deployment had <code>minAvailable: 1</code>. Every eviction returned 429, so the drain retried forever. Depending on the provider, the upgrade either waits or force-deletes after its own timeout.',
      fix: 'Run 2+ replicas with <code>maxUnavailable: 1</code>, or drop the PDB for workloads that can tolerate a short outage. Add a policy check (for example Kyverno or Gatekeeper) rejecting PDBs that allow 0 disruptions.',
      fixCode: `apiVersion: policy/v1\nkind: PodDisruptionBudget\nmetadata: { name: legacy-api, namespace: shop }\nspec:\n  maxUnavailable: 1\n  unhealthyPodEvictionPolicy: AlwaysAllow\n  selector: { matchLabels: { app: legacy-api } }` },
    { title: '502s for a few seconds on every deploy',
      symptom: 'Every rollout of the Spring Boot API produces a burst of 502/503 at the ingress, even though <code>server.shutdown=graceful</code> is set and the readiness probe is correct.',
      diagnose: `kubectl logs -n ingress deploy/ingress-controller | grep ' 502 ' | awk '{print $4}' | sort | uniq -c\n# 37 [22/Nov/2026:10:14:03   ← exactly when old pods received SIGTERM\nkubectl get deploy api -o jsonpath='{.spec.template.spec.containers[0].lifecycle}'\n# (empty: no preStop)`,
      diagnoseLang: 'bash',
      cause: 'On SIGTERM, Spring’s graceful shutdown stops accepting new connections immediately and only finishes requests that are already running. The ingress controller and kube-proxy learn about the terminating endpoint a few seconds later, so they still send new requests to the closing pod.',
      fix: 'Keep the pod serving for a few seconds after termination starts with a preStop sleep, then shut down gracefully, and give it enough grace period.',
      fixCode: `spec:\n  terminationGracePeriodSeconds: 45\n  containers:\n    - name: app\n      lifecycle:\n        preStop:\n          sleep: { seconds: 10 }     # 1.30+; older: exec ["sh","-c","sleep 10"]\n# application.yaml\n# server.shutdown: graceful\n# spring.lifecycle.timeout-per-shutdown-phase: 25s` },
    { title: 'Node drain took the whole service down for 40 seconds',
      symptom: 'During routine patching, <code>payments</code> returned errors for about 40 seconds although it has 3 replicas.',
      diagnose: `kubectl get pods -l app=payments -o wide --sort-by=.spec.nodeName\n# payments-a  node-7\n# payments-b  node-7\n# payments-c  node-7      ← all three on the drained node\nkubectl get pdb -l app=payments   # No resources found`,
      diagnoseLang: 'bash',
      cause: 'No spread constraints and no PDB. The scheduler had packed all replicas onto one node, and the drain evicted all three at once. The replacements needed about 40 s of JVM start-up before they were ready.',
      fix: 'Add a PDB, so the drain evicts one pod at a time and waits for replacements to become Ready. Add topology spread across nodes and zones so one node never holds every replica.',
      fixCode: `apiVersion: policy/v1\nkind: PodDisruptionBudget\nmetadata: { name: payments }\nspec:\n  maxUnavailable: 1\n  selector: { matchLabels: { app: payments } }\n---\n# in the Deployment pod template\ntopologySpreadConstraints:\n  - { maxSkew: 1, topologyKey: kubernetes.io/hostname, whenUnsatisfiable: ScheduleAnyway,\n      labelSelector: { matchLabels: { app: payments } } }` }
  ],
  puzzles: [
    { kind: 'scenario', q: '3 replicas, PDB <code>minAvailable: 2</code>. node-1 runs 2 of them. You drain node-1. What happens to the second eviction?', options: ['Succeeds immediately', 'Gets 429 until the first replacement pod is Ready elsewhere', 'Fails permanently', 'Deletes the pod without SIGTERM'], answer: 1, explain: 'After the first eviction only 2 healthy pods remain, so <code>disruptionsAllowed = 2 − 2 = 0</code>. The drain retries until the ReplicaSet’s replacement is Ready on another node, then the budget allows one more.' },
    { kind: 'predict', q: 'A Deployment has 5 replicas and a PDB with <code>minAvailable: 50%</code>. How many disruptions are allowed when all pods are healthy?', options: ['1', '2', '3', '0'], answer: 1, explain: 'Percentages in <code>minAvailable</code> round <b>up</b>: 50% of 5 = 2.5 → 3 must stay available. 5 healthy − 3 = <b>2</b> allowed.' },
    { kind: 'scenario', q: 'Deployment strategy <code>maxUnavailable: 2</code>, PDB <code>maxUnavailable: 0</code>. You change the image. Does the rollout proceed?', options: ['No, the PDB blocks it', 'Yes: Deployment rollouts don’t use the Eviction API', 'Only one pod at a time', 'Only if minAvailable is set'], answer: 1, explain: 'The Deployment controller deletes old pods according to its own strategy. PDBs only gate <b>evictions</b> (drains, autoscaler scale-down). That PDB will, however, block every node drain.' },
    { kind: 'concept', q: 'A node runs out of memory and the kubelet evicts pods to protect itself. Is the PDB respected?', options: ['Yes, always', 'No: node-pressure eviction is involuntary and ignores PDBs', 'Only for Guaranteed pods', 'Only when the PDB uses minAvailable'], answer: 1, explain: 'Kubelet node-pressure eviction doesn’t go through the Eviction API’s budget check. PDBs cover voluntary, API-initiated evictions only. (API-initiated eviction is also what <code>kubectl drain</code> uses.)' },
    { kind: 'predict', q: '<code>terminationGracePeriodSeconds: 30</code>, <code>preStop</code> sleeps 20 s, and Spring’s shutdown phase timeout is 30 s. A request needs 15 s to finish when SIGTERM arrives. What happens to it?', options: ['It completes', 'It is cut off by SIGKILL after about 10 s', 'It is retried automatically', 'The grace period is extended to fit'], answer: 1, explain: 'The grace period starts with the preStop hook. After 20 s of sleep, Spring has 10 s left before SIGKILL at t = 30 s. (The kubelet only adds a one-off 2 s extension if the <i>preStop hook itself</i> is still running.)' },
    { kind: 'bug', q: 'The Dockerfile has <code>ENTRYPOINT java -jar app.jar</code> (shell form). The pod is deleted with the default grace period. What do you observe?', options: ['Spring logs a graceful shutdown immediately', 'The pod stays Terminating for about 30 s, then the JVM is SIGKILLed without running shutdown hooks', 'The container exits with code 0 at once', 'Kubernetes rejects the image'], answer: 1, explain: '<code>/bin/sh -c</code> is PID 1 and doesn’t forward SIGTERM, so the JVM never hears it. After the grace period everything is SIGKILLed (exit code 137). Use exec form.' },
    { kind: 'scenario', q: 'An engineer runs <code>kubectl delete pod orders-a</code> while the PDB shows <code>ALLOWED DISRUPTIONS 0</code>. What happens?', options: ['429 Too Many Requests', 'The pod is deleted (gracefully); PDBs don’t apply to plain deletes', 'The delete waits for the budget', 'The PDB is deleted instead'], answer: 1, explain: 'Only the Eviction API checks PDBs. A DELETE goes straight through (still with the normal graceful termination). That is why “just delete the pod” during a drain can cause the outage the PDB was meant to prevent.' }
  ],
  interview: [
    { q: 'Voluntary vs involuntary disruptions, with examples?', a: '<p><b>Voluntary</b>: <code>kubectl drain</code>, node upgrades, Cluster Autoscaler/Karpenter scale-down or consolidation, deleting a Deployment, rollouts, a manual pod delete. <b>Involuntary</b>: hardware or kernel failure, VM deletion or spot reclaim (unless a termination handler turns it into a drain), network partition, kubelet node-pressure eviction, OOM kills. PDBs only limit the voluntary ones that use the Eviction API. Replicas, spread and fast start-up handle the rest.</p>', lvl: 'core' },
    { q: 'How does a PDB actually work?', a: '<p>The disruption controller watches pods matching the selector and the owning controller’s expected count, and keeps <code>status.currentHealthy</code>, <code>desiredHealthy</code> and <code>disruptionsAllowed</code> up to date. When an eviction request arrives, the API server checks <code>disruptionsAllowed &gt; 0</code>, decrements it atomically and deletes the pod. Otherwise it returns <b>429</b>. Pods that are not ready, or already terminating, don’t count as healthy.</p>', fu: 'Why prefer maxUnavailable over minAvailable? (It stays meaningful when the HPA changes the replica count.)', lvl: 'core' },
    { q: 'What exactly does kubectl drain do?', a: '<ol><li>Cordon (<code>spec.unschedulable: true</code>).</li><li>List the pods on the node, skipping mirror pods. It refuses to continue on DaemonSet pods without <code>--ignore-daemonsets</code>, on emptyDir data without <code>--delete-emptydir-data</code>, and on bare pods without <code>--force</code>.</li><li>Evict each pod through the Eviction API, retrying 429s every 5 s.</li><li>Wait for the pods to terminate, up to <code>--timeout</code>.</li></ol><p><code>--disable-eviction</code> uses plain DELETE and bypasses PDBs. Use it only as a last resort.</p>', lvl: 'core' },
    { q: 'Walk through pod termination step by step.', a: '<ol><li>The API server sets <code>deletionTimestamp</code> and the grace period, and the pod shows Terminating.</li><li><b>In parallel</b>: the EndpointSlice controller marks the endpoint <code>ready=false, terminating=true</code> (kube-proxy and ingress update later), and the kubelet runs each container’s <b>preStop</b> hook.</li><li>After preStop, the kubelet sends <b>SIGTERM</b> to PID 1 of each container.</li><li>When the grace period runs out, it sends <b>SIGKILL</b> (with a one-off 2 s extension if preStop is still running).</li><li>Native sidecars (1.29+) are stopped after the main containers, in reverse order.</li></ol>', lvl: 'deep' },
    { q: 'How do you make a Spring Boot service shut down without dropping requests?', a: '<ul><li><code>server.shutdown=graceful</code> (the default since Boot 3.4) with <code>spring.lifecycle.timeout-per-shutdown-phase</code>.</li><li>A <code>preStop</code> sleep of 5–15 s so routing converges first.</li><li><code>terminationGracePeriodSeconds</code> ≥ preStop + shutdown timeout + margin.</li><li>Exec-form ENTRYPOINT so the JVM receives SIGTERM.</li><li>Readiness on <code>/actuator/health/readiness</code>.</li><li>Clients with retries on idempotent calls.</li><li>For consumers, stop polling and commit offsets in a shutdown hook (Spring Kafka does this on context close).</li></ul>', lvl: 'core' },
    { q: 'Why is a preStop sleep needed at all? Isn’t removing the endpoint enough?', a: '<p>Endpoint removal is <i>eventually</i> consistent: the EndpointSlice change must reach kube-proxy on every node and every ingress controller or cloud LB, and each must reprogram itself. That takes from under a second to several seconds, while SIGTERM is sent immediately. The sleep keeps the old pod serving through that window. Native <code>sleep</code> preStop (beta and enabled by default since 1.30) avoids needing a <code>sleep</code> binary in distroless images.</p>', lvl: 'deep' },
    { q: 'What does unhealthyPodEvictionPolicy change?', a: '<p>With the default <code>IfHealthyBudget</code>, pods that are running but not ready can be evicted only when the application is not already disrupted (<code>currentHealthy ≥ desiredHealthy</code>). With <code>AlwaysAllow</code> (GA in 1.31), not-ready pods can always be evicted. That stops a crash-looping Deployment from blocking node drains, and it is a sensible default for most services.</p>', lvl: 'deep' },
    { q: 'How do spot or preemptible nodes fit in?', a: '<p>The cloud gives a short notice (on AWS, two minutes for spot). A node termination handler (the AWS Node Termination Handler, Karpenter’s interruption handling, or the provider’s built-in equivalent) catches the notice and cordons and drains the node, turning an involuntary loss into a voluntary eviction that respects PDBs where time allows. Size grace periods and start-up times to fit inside the notice.</p>', lvl: 'core' },
    { q: 'How do PDBs interact with the Cluster Autoscaler and Karpenter?', a: '<p>Both drain through evictions. CA won’t pick a node for scale-down if moving its pods would violate a PDB. Karpenter respects PDBs during consolidation and has its own NodePool disruption budgets (for example “at most 10% of nodes at a time”). Over-tight PDBs therefore keep expensive nodes alive.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'PDB + graceful pod', lang: 'yaml', code: `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: orders, namespace: shop }
spec:
  maxUnavailable: 1
  unhealthyPodEvictionPolicy: AlwaysAllow      # GA 1.31
  selector: { matchLabels: { app: orders } }
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: orders, namespace: shop }
spec:
  replicas: 3
  strategy:
    rollingUpdate: { maxUnavailable: 0, maxSurge: 1 }
  selector: { matchLabels: { app: orders } }
  template:
    metadata: { labels: { app: orders } }
    spec:
      terminationGracePeriodSeconds: 45        # >= 10 (preStop) + 25 (Spring) + margin
      containers:
        - name: app
          image: registry.example.com/orders:2.3.1
          lifecycle:
            preStop:
              sleep: { seconds: 10 }           # K8s 1.30+ (beta, on by default)
          readinessProbe:
            httpGet: { path: /actuator/health/readiness, port: 8081 }
            periodSeconds: 5` },
    { title: 'Spring Boot shutdown settings', lang: 'yaml', code: `# application.yaml (Spring Boot 3.4+: graceful is already the default)
server:
  shutdown: graceful
spring:
  lifecycle:
    timeout-per-shutdown-phase: 25s
management:
  server:
    port: 8081
  endpoint:
    health:
      probes:
        enabled: true` },
    { title: 'Exec-form entrypoint', lang: 'docker', code: `FROM eclipse-temurin:21-jre
COPY build/libs/app.jar /app.jar
# exec form: java is PID 1 and receives SIGTERM
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app.jar"]

# if you need a script, end it with exec:
# #!/bin/sh
# ... setup ...
# exec java -jar /app.jar "$@"` },
    { title: 'Maintenance commands', lang: 'bash', code: `kubectl get pdb -A                                   # ALLOWED DISRUPTIONS
kubectl drain node-1 --ignore-daemonsets --delete-emptydir-data --timeout=15m
kubectl uncordon node-1

# evict one pod by hand (respects PDB) instead of deleting it
kubectl create --raw /api/v1/namespaces/shop/pods/orders-a/eviction -f - <<'EOF'
{"apiVersion":"policy/v1","kind":"Eviction","metadata":{"name":"orders-a","namespace":"shop"}}
EOF` }
  ]
});

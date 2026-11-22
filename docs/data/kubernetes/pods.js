IA.register({
  track: 'kubernetes',
  slug: 'pods',
  title: 'Pods',
  tagline: 'A pod is the smallest thing Kubernetes schedules: one or more containers that share a <b>network namespace, volumes and a fate</b>. Learn the start order (init → sidecars → app), the five phases, and what <code>restartPolicy</code> really restarts, and most “why is it stuck?” questions answer themselves.',
  tldr: {
    problem: 'Jobs that never finish because a sidecar keeps running. Apps that crash at boot because their proxy is not up yet. Pods that show <code>Running</code> while they crash every minute. All of these are pod-lifecycle misunderstandings.',
    model: 'Init containers run <b>one at a time, to completion</b>. Native sidecars (init containers with <code>restartPolicy: Always</code>) start in order and <b>keep running</b>. Then app containers start together. Phase summarises the pod; container <b>state</b> and <b>conditions</b> (Ready) tell the real story.',
    hook: '“What is the phase of a pod in CrashLoopBackOff?” Running. CrashLoopBackOff is the <i>waiting reason</i> of a container between restarts.',
    facts: [
      { v: '5', l: 'pod phases: Pending, Running, Succeeded, Failed, Unknown. “CrashLoopBackOff”, “Terminating” and “Init:0/2” are kubectl display strings, not phases' },
      { v: '10 s → 5 min', l: 'container restart back-off: grows exponentially from 10 s, is capped at 5 minutes, and resets after 10 minutes of running fine' },
      { v: '1.29', l: 'native sidecars on by default (beta). Alpha in 1.28, GA in 1.33. Declared as an init container with <code>restartPolicy: Always</code>' }
    ]
  },
  intro: {
    what: 'You don’t run containers directly in Kubernetes; you run <b>pods</b>. A pod wraps one main container (your Spring Boot app) and sometimes helpers: a <b>sidecar</b> that runs alongside (a log shipper, a database proxy), or an <b>init container</b> that runs once before the app (a schema migration). All containers in a pod land on the same node, share one IP address (they talk over <code>localhost</code>) and can share volumes. The pod moves through <b>phases</b> from Pending to Running to Succeeded or Failed.',
    analogy: { icon: '🫛', title: 'A pea pod', text: 'The peas (containers) grow in one pod: they are planted together, share the same shell (network and volumes), and are thrown away together. You never move one pea to another pod. If you need more peas, you grow more pods.' },
    steps: [
      { t: 'One pod, one IP', d: 'Every container in the pod shares the network namespace. The app on port 8080 and a sidecar on 9090 reach each other on <code>localhost</code>. Two containers can’t both listen on 8080.' },
      { t: 'Init containers run first, one by one', d: 'Each must exit with code 0 before the next starts. Use them for one-off setup such as fetching config or waiting for a schema.', code: 'initContainers:\n- name: migrate\n  image: registry/app-migrations:1.4\n  args: ["migrate"]' },
      { t: 'Sidecars start and keep running', d: 'Since 1.29 a sidecar is an init container with <code>restartPolicy: Always</code>. It starts before your app and is stopped after it.', code: 'initContainers:\n- name: log-agent\n  image: registry/log-agent:2.0\n  restartPolicy: Always' },
      { t: 'Then the app', d: 'App containers start together. The pod is <b>Running</b> once at least one container runs, but it only gets traffic once it is <b>Ready</b>.', code: 'kubectl get pod web-7c9-x2k -o wide\nkubectl describe pod web-7c9-x2k   # states, restarts, events', lang: 'bash' },
      { t: 'Restarts follow restartPolicy', d: '<code>Always</code> (the only option for Deployments), <code>OnFailure</code> or <code>Never</code>. The kubelet restarts the <b>container</b> in place. A new pod comes only from a controller.' }
    ],
    terms: [
      ['pod', 'One or more containers scheduled together on one node, sharing a network namespace and volumes.'],
      ['init container', 'Runs to completion before app containers start; they run sequentially.'],
      ['sidecar', 'A helper container that runs for the pod’s whole life. Native sidecars (1.29+) have managed start and stop order.'],
      ['phase', '<code>status.phase</code>: a one-word summary. Pending, Running, Succeeded, Failed or Unknown.'],
      ['restartPolicy', 'Pod-level rule for restarting exited containers: Always, OnFailure or Never.'],
      ['CrashLoopBackOff', 'A container waiting reason: it keeps exiting, so the kubelet waits longer before each restart.']
    ]
  },
  visual: {
    title: 'Pod lifecycle, container by container',
    caption: 'Pick a scenario and press Play. Each lane is a container; the top lane is the pod phase. Blue = running, green tick = exited 0, red = exited non-zero, dashed orange = waiting in back-off, grey = terminating after SIGTERM.'
  },
  gotchas: [
    { trap: 'A regular sidecar keeps a Job running forever', code: `# Job pod, sidecar as a normal container
containers:
- name: report        # exits 0 after 5 minutes
- name: db-proxy      # never exits → pod stays Running, Job never completes`, why: 'A pod only succeeds when <b>all</b> its regular containers have terminated. A proxy or log agent has no reason to exit, so the Job hangs until <code>activeDeadlineSeconds</code> fails it.', fix: 'Make the helper a native sidecar: move it to <code>initContainers</code> with <code>restartPolicy: Always</code> (1.29+). The kubelet stops it once the main containers finish, and its exit code is ignored.' },
    { trap: 'The app starts before its proxy is ready', why: 'Regular containers start in parallel. Spring Boot opens its connection pool at startup; if the DB proxy sidecar is not listening yet, startup fails and the container crash-loops a few times.', fix: 'Native sidecars start <b>before</b> app containers. Give the sidecar a <code>startupProbe</code>: the kubelet waits for it to succeed before starting the next container.' },
    { trap: 'Phase “Running” does not mean healthy', why: 'A container that crashes every few seconds keeps the pod in phase <code>Running</code>: its state flips between Running and <code>Waiting: CrashLoopBackOff</code>. A Running pod that fails readiness gets no traffic.', fix: 'Alert on <code>restartCount</code> increases and the <code>Ready</code> condition, not on phase. <code>kubectl get pod</code>’s STATUS column shows the more useful reason.' },
    { trap: 'Init containers that are not idempotent', why: 'Init containers rerun whenever the pod is recreated, and can rerun if the pod sandbox is restarted (for example after a node reboot). Every replica runs its own copy.', fix: 'Make init work idempotent. For schema migrations across many replicas, rely on the tool’s lock (Flyway and Liquibase lock in the database) or run them once as a Job before the rollout.' },
    { trap: '<code>restartPolicy</code> is per pod, and Deployments force Always', why: 'You can’t set OnFailure on one container and Never on another (native sidecars are the exception: they are always restarted). Deployments, ReplicaSets, StatefulSets and DaemonSets only accept <code>Always</code>. Jobs accept only <code>OnFailure</code> or <code>Never</code>.', fix: 'Pick the workload type by lifecycle: long-running service → Deployment; run to completion → Job.' },
    { trap: 'SIGTERM arrives while traffic is still routed to the pod', code: `lifecycle:
  preStop:
    sleep: { seconds: 5 }   # 1.30+ (GA in 1.34); older: exec ["sleep","5"]
terminationGracePeriodSeconds: 45`, why: 'On deletion the kubelet starts the shutdown and the endpoints controller removes the pod from EndpointSlices <b>in parallel</b>. kube-proxy on other nodes and external load balancers lag by a second or more, so requests still arrive after Spring stops accepting.', fix: 'Add a short <code>preStop</code> sleep, enable Spring graceful shutdown, and keep <code>terminationGracePeriodSeconds</code> greater than preStop + shutdown time. The grace period covers both.' }
  ],
  scenarios: [
    { title: 'The nightly export Job never finishes',
      symptom: 'After a DB proxy sidecar was added to the export Job, the Job shows <code>1/1</code> pods Running for hours. The export itself logged “done” after 6 minutes.',
      diagnoseLang: 'bash',
      diagnose: `kubectl get pod -l job-name=export -o jsonpath='{range .items[0].status.containerStatuses[*]}{.name}{" "}{.state}{"\\n"}{end}'
# export    {"terminated":{"exitCode":0,"reason":"Completed"}}
# db-proxy  {"running":{"startedAt":"..."}}`,
      cause: 'The proxy was added as a regular container. A pod reaches <code>Succeeded</code> only when every regular container has terminated, and the proxy never does.',
      fix: 'Declare the proxy as a native sidecar (1.29+). Add <code>activeDeadlineSeconds</code> as a safety net.',
      fixCode: `spec:
  activeDeadlineSeconds: 3600
  template:
    spec:
      restartPolicy: Never
      initContainers:
      - name: db-proxy
        image: registry/db-proxy:2.1
        restartPolicy: Always          # native sidecar
        startupProbe:
          tcpSocket: { port: 5432 }
          periodSeconds: 1
          failureThreshold: 30
      containers:
      - name: export
        image: registry/export:3.2` },
    { title: '502s on every rollout, even with graceful shutdown on',
      symptom: 'Each deploy produces a short burst of 502s at the ingress. Spring logs show graceful shutdown starting and finishing cleanly.',
      diagnoseLang: 'bash',
      diagnose: `kubectl get events --field-selector involvedObject.name=web-7c9-x2k
# Killing  Stopping container app
# ingress logs: upstream 10.1.0.7:8080 connection refused   (≈1 s after Killing)`,
      cause: 'SIGTERM and endpoint removal are concurrent. The ingress controller and kube-proxy on other nodes were still sending traffic to the pod for about a second after Tomcat stopped accepting connections.',
      fix: 'Delay shutdown with a preStop sleep so routing catches up first, then let Spring drain in-flight requests.',
      fixCode: `# pod spec
terminationGracePeriodSeconds: 40
containers:
- name: app
  lifecycle:
    preStop:
      sleep: { seconds: 5 }
---
# application.yaml (graceful is the default from Spring Boot 3.4)
server:
  shutdown: graceful
spring:
  lifecycle:
    timeout-per-shutdown-phase: 25s` },
    { title: 'Pods crash once or twice at every start, then settle',
      symptom: 'New pods show <code>RESTARTS 1</code> or <code>2</code> after every rollout. The first log lines say <code>Connection refused: localhost:5432</code> from HikariCP.',
      diagnoseLang: 'bash',
      diagnose: `kubectl logs web-7c9-x2k -c app --previous | head
# HikariPool-1 - Exception during pool initialization ... Connection refused
kubectl get pod web-7c9-x2k -o jsonpath='{.status.containerStatuses[*].name}'
# app db-proxy        ← proxy is a regular container, started in parallel`,
      cause: 'The app and its DB proxy start at the same time. Spring Boot is faster to try the database than the proxy is to start listening, so the first attempts fail and the app exits.',
      fix: 'Move the proxy into <code>initContainers</code> with <code>restartPolicy: Always</code> and a startupProbe. The app container now starts only after the proxy accepts connections.',
      fixCode: `initContainers:
- name: db-proxy
  image: registry/db-proxy:2.1
  restartPolicy: Always
  startupProbe:
    tcpSocket: { port: 5432 }
    periodSeconds: 1
    failureThreshold: 30
containers:
- name: app
  image: registry/web:5.0` }
  ],
  puzzles: [
    { kind: 'scenario', q: '<code>kubectl get pod</code> shows STATUS <code>CrashLoopBackOff</code>, RESTARTS 14. What is <code>status.phase</code>?', options: ['CrashLoopBackOff', 'Failed', 'Running', 'Pending'], answer: 2, explain: 'With <code>restartPolicy: Always</code> the kubelet keeps restarting the container, so the pod is still <b>Running</b>. CrashLoopBackOff is the container’s <code>state.waiting.reason</code> between attempts, which kubectl shows in STATUS.' },
    { kind: 'scenario', q: 'A Job pod has two regular containers: <code>batch</code> exits 0 after 5 min, <code>log-agent</code> runs forever. What does the Job show after 1 hour?', options: ['Complete: the main container succeeded', 'Failed: one container never exited', 'Still active: the pod stays Running', 'Complete, and log-agent is SIGKILLed'], answer: 2, explain: 'Kubernetes doesn’t know which regular container is “main”. The pod succeeds only when all regular containers terminate. Native sidecars fix this: they are stopped automatically after the main containers finish.' },
    { kind: 'scenario', q: '<code>restartPolicy: Never</code>. The first init container exits with code 1. What happens?', options: ['It is retried with back-off', 'The app containers start anyway', 'The pod goes to phase Failed; app containers never start', 'The pod stays Pending forever'], answer: 2, explain: 'With Never, a failed init container fails the whole pod. With <code>Always</code> or <code>OnFailure</code> the kubelet would retry the init container with back-off (<code>Init:CrashLoopBackOff</code>) and the pod would stay <b>Pending</b>.' },
    { kind: 'scenario', q: 'Init containers: <code>log-agent</code> (restartPolicy: Always, with a startupProbe), then <code>migrate</code>. When does <code>migrate</code> start?', options: ['After log-agent exits', 'As soon as the log-agent container has started and its startupProbe has succeeded', 'At the same time as log-agent', 'After the app container is Ready'], answer: 1, explain: 'A native sidecar never “completes”, so the kubelet moves on once it has <b>started</b>, and, if it has a startupProbe, once that succeeds. It keeps running alongside migrate and later the app containers.' },
    { kind: 'concept', q: 'A container has been crashing for an hour. What is the longest the kubelet now waits between restarts?', options: ['10 seconds', '1 minute', '5 minutes', 'It stops restarting after 6 tries'], answer: 2, explain: 'The back-off grows exponentially from 10 s and is capped at <b>5 minutes</b>. The kubelet never gives up with <code>restartPolicy: Always</code>. The back-off resets after the container runs for 10 minutes without crashing. (A Job’s <code>backoffLimit</code> is a different mechanism; see <a href="statefulsets-jobs.html">Jobs</a>.)' },
    { kind: 'scenario', q: 'Two containers in one pod both try to listen on port 8080. What happens?', options: ['Both work: each container has its own network', 'The second to bind fails with “address already in use”', 'Kubernetes rejects the pod spec', 'Traffic is load-balanced between them'], answer: 1, explain: 'Containers in a pod share <b>one network namespace</b>: one IP, one port space. Nothing stops you declaring it, so it fails at runtime, when the second process tries to bind.' },
    { kind: 'scenario', q: 'You delete a pod with two native sidecars (<code>proxy</code>, then <code>log-agent</code>) and one app container. In what order do they get SIGTERM?', options: ['All three at once', 'app first; when it exits, log-agent, then proxy', 'proxy, log-agent, then app', 'app and proxy together, then log-agent'], answer: 1, explain: 'Since 1.29 the kubelet terminates <b>main containers first</b>, then native sidecars in <b>reverse</b> order of their declaration, so the proxy is still there while the app drains. All of it must fit in <code>terminationGracePeriodSeconds</code>.' }
  ],
  interview: [
    { q: 'Why does Kubernetes schedule pods and not containers?', a: '<p>Some processes must be co-located and share resources: an app and its proxy, a log shipper reading its files. The pod is that unit: shared network namespace (one IP, <code>localhost</code>), shared volumes, same node, same lifecycle. It also gives one place to hang scheduling, security context and restart policy.</p>', lvl: 'core' },
    { q: 'Explain the pod phases and how they relate to container states.', a: '<p><b>Pending</b>: accepted, but not all containers are running yet (scheduling, image pulls, init containers). <b>Running</b>: bound to a node, init done, at least one container running or restarting. <b>Succeeded</b>: all containers terminated with 0 and will not restart. <b>Failed</b>: all terminated, at least one failed. <b>Unknown</b>: the node stopped reporting. Each container separately has a state: <code>Waiting</code> (with reason), <code>Running</code> or <code>Terminated</code> (with exit code and reason).</p>', lvl: 'core' },
    { q: 'What are native sidecars and what problems do they solve?', a: '<p>Init containers with <code>restartPolicy: Always</code> (alpha 1.28, beta and on by default in 1.29, GA in 1.33). They start before app containers in declaration order (waiting for their startupProbe), keep running and are restarted if they exit, do not block pod completion, and are terminated after the app containers in reverse order. That fixes three classic issues: Jobs that never finish, apps that start before their proxy, and proxies that die before the app has drained.</p>', fu: 'How did people work around it before? (Shared emptyDir with a “done” file, or calling the proxy’s quit endpoint from the app.)', lvl: 'deep' },
    { q: 'What does restartPolicy actually restart?', a: '<p>The <b>container</b>, in place, on the same node, by the kubelet, with exponential back-off. The pod keeps its name, IP and volumes. A pod is never rescheduled to another node by restartPolicy; a <b>new</b> pod on another node only comes from a controller (ReplicaSet, Job…) replacing a deleted or failed one.</p>', lvl: 'core' },
    { q: 'What are the common multi-container patterns?', a: '<ul><li><b>Sidecar</b>: extends the app (log shipping, service-mesh proxy, secret refresher).</li><li><b>Ambassador</b>: a local proxy to an outside service (a DB proxy on localhost).</li><li><b>Adapter</b>: converts the app’s output to a standard format (a metrics exporter).</li><li><b>Init</b>: one-off setup before start.</li></ul><p>Rule of thumb: put containers in one pod only if they must share a lifecycle and a node. Otherwise use separate Deployments that scale independently.</p>', lvl: 'core' },
    { q: 'Walk through what happens when a pod is deleted.', a: '<ol><li>The API server sets <code>deletionTimestamp</code> and a grace period (default 30 s).</li><li>In parallel: the EndpointSlice controller marks the pod not ready and removes it from Services; the kubelet starts shutdown.</li><li>The kubelet runs each container’s <code>preStop</code> hook, then sends SIGTERM (main containers first, then native sidecars in reverse order).</li><li>When the grace period runs out, remaining processes get SIGKILL.</li><li>The kubelet confirms, and the object is removed from etcd.</li></ol>', fu: 'Why add a preStop sleep if Spring already has graceful shutdown? (Endpoint removal propagates asynchronously; the sleep gives load balancers time to stop sending new requests.)', lvl: 'deep' },
    { q: 'How do containers in a pod share data and processes?', a: '<p>Network: always shared (one IP and port space). Storage: through volumes mounted into several containers, typically an <code>emptyDir</code>. Processes: separate PID namespaces by default; set <code>shareProcessNamespace: true</code> to let them see and signal each other (then the pause container is PID 1).</p>', lvl: 'core' },
    { q: 'What is the pause container?', a: '<p>The infrastructure (“sandbox”) container the runtime creates first for each pod. It holds the network namespace (and IPC/UTS) so app containers can crash and restart without losing the pod’s IP. It does nothing but sleep, and reaps zombies when the PID namespace is shared.</p>', lvl: 'deep' },
    { q: 'What are ephemeral containers?', a: '<p>Temporary containers added to a <b>running</b> pod for debugging, via <code>kubectl debug -it pod/web --image=busybox --target=app</code> (GA in 1.25). They share the pod’s namespaces (and the target container’s PID namespace with <code>--target</code>), cannot have ports or probes, and are never restarted. Ideal for distroless images that have no shell.</p>', lvl: 'core' },
    { q: 'Pending vs ContainerCreating vs Init:0/2: what is each telling you?', a: '<p>All are phase <b>Pending</b>. Pending with no node: not scheduled yet (check FailedScheduling events). <code>ContainerCreating</code>: scheduled; the kubelet is creating the sandbox, pulling images or mounting volumes (check events for image pull or volume errors). <code>Init:0/2</code>: the first of two init containers is still running, or failing and retrying (<code>Init:CrashLoopBackOff</code>). See <a href="debugging.html">Debugging</a>.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Init + native sidecar + graceful stop', lang: 'yaml', code: `apiVersion: apps/v1
kind: Deployment
metadata: { name: web }
spec:
  replicas: 3
  selector: { matchLabels: { app: web } }
  template:
    metadata: { labels: { app: web } }
    spec:
      terminationGracePeriodSeconds: 40
      initContainers:
      - name: wait-schema                 # classic init: runs to completion
        image: registry/web-migrations:5.0
        args: ["check-schema"]
      - name: db-proxy                    # native sidecar (1.29+)
        image: registry/db-proxy:2.1
        restartPolicy: Always
        startupProbe:
          tcpSocket: { port: 5432 }
          periodSeconds: 1
          failureThreshold: 30
      containers:
      - name: app
        image: registry/web:5.0
        ports: [{ containerPort: 8080 }]
        env:
        - { name: SPRING_DATASOURCE_URL, value: "jdbc:postgresql://localhost:5432/shop" }
        lifecycle:
          preStop:
            sleep: { seconds: 5 }         # 1.30+ (GA in 1.34); else exec: ["sleep","5"]` },
    { title: 'Inspect the lifecycle', lang: 'bash', code: `# phase, conditions and every container's state
kubectl get pod web-7c9-x2k -o jsonpath='{.status.phase}{"\\n"}'
kubectl get pod web-7c9-x2k -o jsonpath='{range .status.conditions[*]}{.type}={.status}{"\\n"}{end}'
kubectl get pod web-7c9-x2k -o jsonpath='{range .status.initContainerStatuses[*]}{.name}: {.state}{"\\n"}{end}'

# why did it restart? logs of the previous container instance
kubectl logs web-7c9-x2k -c app --previous

# last termination: exit code 137 = SIGKILL (often OOM), 143 = SIGTERM
kubectl get pod web-7c9-x2k -o jsonpath='{.status.containerStatuses[0].lastState.terminated}'` },
    { title: 'Spring Boot shutdown settings', lang: 'yaml', code: `# application.yaml
server:
  shutdown: graceful                    # default since Spring Boot 3.4
spring:
  lifecycle:
    timeout-per-shutdown-phase: 25s     # < terminationGracePeriodSeconds - preStop
management:
  endpoint:
    health:
      probes:
        enabled: true                   # /actuator/health/liveness and /readiness`, note: 'On SIGTERM Spring flips readiness to REFUSING_TRAFFIC, stops accepting new requests and waits for in-flight ones, up to the timeout.' }
  ]
});

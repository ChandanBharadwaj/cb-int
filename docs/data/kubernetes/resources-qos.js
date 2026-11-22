IA.register({
  track: 'kubernetes',
  slug: 'resources-qos',
  title: 'Requests, limits & QoS',
  tagline: '<b>Requests</b> are a reservation: the scheduler places pods by them and the kernel shares CPU by them. <b>Limits</b> are a ceiling: CPU over it is <b>throttled</b> in 100 ms slices, memory over it is <b>OOMKilled</b>. The combination decides your <b>QoS class</b>, and with it who dies first when a node runs short.',
  tldr: {
    problem: 'p99 latency triples while the CPU graph says 30%. Pods get OOMKilled with a heap that looks fine. A batch job on the node evicts your API pods. Pods stay Pending on a cluster that is mostly idle. All four are requests and limits behaving exactly as designed.',
    model: 'Scheduling: Σ requests ≤ node allocatable, regardless of real usage. CPU (compressible): requests set the share (<code>cpu.weight</code>), limits set a CFS quota per 100 ms period, and hitting it pauses <b>all</b> threads until the next period. Memory (incompressible): exceeding the limit triggers the cgroup OOM killer; node-level shortage triggers kubelet eviction.',
    hook: '“Why is my service slow at 30% CPU?” Averages hide bursts. Eight threads can spend a 1-CPU quota in 12.5 ms and then sit throttled for 87.5 ms of every 100.',
    facts: [
      { v: '100 ms', l: 'default CFS period. A 500m limit means 50 ms of CPU time per 100 ms, summed over every thread in the container' },
      { v: '137', l: 'exit code of an OOMKilled container (128 + SIGKILL). The kernel killed it for exceeding its own limit; that is not an eviction' },
      { v: '3', l: 'QoS classes: Guaranteed (requests = limits for CPU and memory, every container), Burstable (anything in between), BestEffort (no requests or limits at all)' }
    ]
  },
  intro: {
    what: 'Every container can say how much CPU and memory it needs. The <b>request</b> is what you are guaranteed: Kubernetes only puts the pod on a node with that much unreserved. The <b>limit</b> is the maximum you may use: go over the CPU limit and you are slowed down; go over the memory limit and the container is killed. Pods that ask for nothing get whatever is left, and are the first to go when the node runs out.',
    analogy: { icon: '🍕', title: 'Office pizza', text: 'Requests are slices reserved with your name on them: the organiser won’t invite more people than there are reserved slices. Limits are “no more than three slices each”. CPU is like time at the microwave: if you’ve used your 30 seconds this minute, you wait for the next minute (throttling). Memory is like seats: if you take more seats than allowed you are asked to leave (OOMKilled), and if the room is full, people without a reservation are asked to leave first (eviction).' },
    steps: [
      { t: 'Set requests and limits per container', d: 'CPU in cores or millicores (<code>500m</code> = half a core); memory in bytes (<code>512Mi</code>).', code: 'resources:\n  requests: { cpu: 500m, memory: 1Gi }\n  limits:   { memory: 1Gi }' },
      { t: 'The scheduler only looks at requests', d: 'A node with 4 CPUs allocatable and 3.5 CPUs requested fits only pods requesting ≤ 0.5, even if the node is idle.', code: 'kubectl describe node node-1 | grep -A8 "Allocated resources"', lang: 'bash' },
      { t: 'CPU limit = throttling', d: 'The limit becomes a quota per 100 ms. Use it up early and every thread waits for the next period.', code: 'cat /sys/fs/cgroup/cpu.stat   # nr_periods nr_throttled throttled_usec', lang: 'bash' },
      { t: 'Memory limit = OOMKilled', d: 'Exceed it and the kernel kills the process. <code>kubectl describe pod</code> shows <code>Last State: Terminated, Reason: OOMKilled, Exit Code: 137</code>.' },
      { t: 'QoS decides who is evicted first', d: 'When the node itself runs low on memory, the kubelet evicts pods that use more than they requested first.', code: 'kubectl get pod web-7c9-x2k -o jsonpath=\'{.status.qosClass}\'', lang: 'bash' }
    ],
    terms: [
      ['request', 'Reserved amount; used for scheduling and for the CPU share under contention.'],
      ['limit', 'Maximum; enforced by the kernel (CPU quota, memory OOM kill).'],
      ['allocatable', 'Node capacity minus kube-reserved, system-reserved and the eviction threshold: what pods may request.'],
      ['CFS quota / period', 'The Linux scheduler’s bandwidth control: <code>cpu.max</code> = quota and period in µs (e.g. <code>50000 100000</code>).'],
      ['throttling', 'A container that used its quota is not run until the next period starts.'],
      ['QoS class', 'Guaranteed, Burstable or BestEffort: derived from requests and limits, shown in <code>status.qosClass</code>.'],
      ['eviction', 'The kubelet terminating pods to reclaim memory, disk or PIDs when the node crosses a threshold.']
    ]
  },
  visual: {
    title: 'CFS throttling, 100 ms at a time',
    caption: 'Pick a CPU limit and a workload, then press Play or Step (one step = one 100 ms period). Each lane is a thread: blue runs, red hatching is <b>throttled</b> (has work, no quota left), grey is idle. The top bar shows how much of each period’s quota was used.'
  },
  extras: [
    { id: 'resources-qos-eviction', title: 'Scheduling, OOMKilled and eviction on one node', label: 'QoS & eviction', caption: 'Step through a node’s day: scheduling by requests, a container over its memory limit, then node memory pressure. Watch which pod the kubelet picks, and why it is not simply “BestEffort first”.' }
  ],
  gotchas: [
    { trap: 'CPU limits throttle bursty JVMs at low average usage', why: 'Throttling is per 100 ms period, summed over all threads. A request handled by a parallel stream, a GC cycle with several threads, or JIT compilation can spend the quota in a few milliseconds and then wait for the rest of the period. The 1-minute average CPU looks low; p99 latency is terrible.', fix: 'For latency-sensitive services, set a CPU <b>request</b> and consider no CPU limit (many teams do; enforce fairness with requests and namespace quotas instead). If you need limits, size them for bursts, not averages, and alert on the throttled ratio.' },
    { trap: '<code>-Xmx</code> equal to the memory limit', code: `resources: { limits: { memory: 1Gi } }
env: [{ name: JAVA_TOOL_OPTIONS, value: "-Xmx1g" }]   # no room for anything else`, why: 'The cgroup counts the whole process: heap plus metaspace, code cache (up to 240 MB), thread stacks (≈1 MB each × 200 Tomcat threads), direct and Netty buffers, GC structures and malloc arenas. The heap reaches 1 GiB and the container is killed with exit 137, with no <code>OutOfMemoryError</code> in the logs.', fix: '<code>-XX:MaxRAMPercentage=70</code>–<code>75</code> and leave the rest for native memory. Measure with <code>-XX:NativeMemoryTracking=summary</code> and <code>jcmd 1 VM.native_memory</code>.' },
    { trap: 'No requests at all: BestEffort', why: 'A pod without requests is scheduled as if it needs nothing, so it can land on a packed node. Under memory pressure it exceeds its (zero) request immediately and is among the first evicted; its <code>oom_score_adj</code> is 1000, so the kernel OOM killer also prefers it.', fix: 'Always set requests. Enforce defaults per namespace with a <code>LimitRange</code>. See <a href="multi-tenancy-cost.html">Namespaces, quotas & cost</a>.' },
    { trap: 'Memory request far below the limit for a JVM', why: 'A JVM rarely gives heap back to the OS, so once it has grown, usage stays near the high-water mark. With request 512Mi and limit 2Gi the scheduler packs nodes for 512Mi while pods really hold 2Gi. The node runs out, and the kubelet evicts pods that are above their request: yours.', fix: 'For JVMs set memory <b>request = limit</b>. It is honest about what the process will hold and gets the pod sooner to Guaranteed QoS.' },
    { trap: 'Requests-only pods see every host core', why: 'Since JDK 19 (and 17.0.5, 11.0.17) the JVM ignores CPU shares, so a pod with <code>requests.cpu: 2</code> and no limit on a 64-core node sees 64 processors. It sizes GC threads, the ForkJoin common pool and many libraries’ thread pools for 64.', fix: 'Pass <code>-XX:ActiveProcessorCount=&lt;request&gt;</code> (rounded up) when running without CPU limits.' },
    { trap: 'Alerting on the wrong memory metric', why: '<code>container_memory_usage_bytes</code> includes page cache that the kernel can reclaim. The kubelet’s eviction decisions and the OOM risk follow the <b>working set</b> (usage minus inactive file cache).', fix: 'Alert on <code>container_memory_working_set_bytes</code> relative to the limit, and on <code>kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}</code>.' },
    { trap: 'Requests copied from a template, never measured', why: 'Requests far above real usage waste money and make pods Pending on half-empty nodes; requests far below it overcommit nodes and cause throttling and evictions.', fix: 'Right-size from observed p95–p99 usage over a representative week. VPA in recommendation mode (<code>updateMode: "Off"</code>) gives per-container suggestions. In-place resize (alpha in 1.27, beta and on by default in 1.33) lets you change resources without recreating pods on recent versions.' }
  ],
  scenarios: [
    { title: 'p99 at 800 ms while CPU usage shows 30%',
      symptom: 'An API’s p99 latency jumps from 80 ms to 800 ms after moving to Kubernetes. Grafana shows CPU usage at 0.3 of its 1-CPU limit. Adding replicas helps only a little.',
      diagnose: `# fraction of periods in which the container was throttled
sum(rate(container_cpu_cfs_throttled_periods_total{pod=~"api-.*"}[5m]))
  / sum(rate(container_cpu_cfs_periods_total{pod=~"api-.*"}[5m]))      # → 0.62
kubectl exec api-7c9-x2k -- cat /sys/fs/cgroup/cpu.stat
#   nr_periods 81234  nr_throttled 50366  throttled_usec 2.1e9`,
      cause: 'Each request fans out on the ForkJoin common pool plus a short parallel GC. Bursts of 8 runnable threads spend the 100 ms quota in about 12 ms; for the rest of the period every thread, including Tomcat’s, is paused. The average stays at 30% because most periods are mostly idle.',
      fix: 'Remove the CPU limit (keep a realistic request), or raise it to cover bursts, and cap parallelism to the CPU you actually have.',
      fixCode: `resources:
  requests: { cpu: "1", memory: 2Gi }
  limits:   { memory: 2Gi }            # no CPU limit
env:
- name: JAVA_TOOL_OPTIONS
  value: "-XX:ActiveProcessorCount=2 -XX:MaxRAMPercentage=75"` },
    { title: 'OOMKilled every few hours, heap graph looks fine',
      symptom: 'A reactive gateway restarts every 3–6 hours with <code>OOMKilled</code>, exit 137. The heap never exceeds 60% of <code>-Xmx</code>, and there is no OutOfMemoryError in the logs.',
      diagnose: `kubectl get pod gw-5f8-k2l -o jsonpath='{.status.containerStatuses[0].lastState.terminated.reason}'
#   OOMKilled
kubectl exec gw-5f8-k2l -- jcmd 1 VM.native_memory summary | grep -E 'Total|Java Heap|Thread|Other|Internal'
#   Other (committed): 410MB   ← direct buffers growing`,
      cause: 'Off-heap memory: Netty direct buffers grew under a slow-consumer pattern. Heap (1.2 GB) + metaspace + threads + 400 MB of direct memory exceeded the 2 GiB limit, and the kernel killed the process. The JVM never saw an allocation failure, so it never threw.',
      fix: 'Bound direct memory, leave headroom between heap and limit, and track native memory. Treat the memory limit as the budget for the whole process.',
      fixCode: `env:
- name: JAVA_TOOL_OPTIONS
  value: >-
    -XX:MaxRAMPercentage=60
    -XX:MaxDirectMemorySize=256m
    -XX:NativeMemoryTracking=summary
    -XX:+ExitOnOutOfMemoryError
resources:
  requests: { memory: 2Gi }
  limits:   { memory: 2Gi }` },
    { title: 'A nightly batch job evicted the API pods',
      symptom: 'At 02:00 several <code>orders</code> pods were evicted: <code>The node was low on resource: memory. Threshold quantity: 100Mi, available: 82Mi. Container app was using 1.9Gi, request is 512Mi</code>.',
      diagnose: `kubectl get events -A --field-selector reason=Evicted
kubectl describe node node-7 | grep -A3 Conditions      # MemoryPressure True at 02:03
kubectl get pod -o custom-columns=NAME:.metadata.name,QOS:.status.qosClass -n orders`,
      cause: 'A batch Job with a low memory request was scheduled onto the same nodes. Together with the API pods (request 512Mi, real usage ~1.9Gi) the node ran out of memory. The kubelet evicts first pods whose usage exceeds their request, ranked by priority and then by how far above request they are, and the API pods were furthest above.',
      fix: 'Make requests honest (JVM: request = limit), give critical services a higher PriorityClass, and keep batch work on its own node pool.',
      fixCode: `apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata: { name: critical-api }
value: 100000
description: "customer-facing APIs"
---
spec:
  priorityClassName: critical-api
  containers:
  - name: app
    resources:
      requests: { cpu: 500m, memory: 2Gi }
      limits:   { memory: 2Gi }` }
  ],
  puzzles: [
    { kind: 'scenario', q: 'node-1 has 4 CPUs allocatable. Two pods each request 1.5 CPU but actually use 0.2. A new pod requests 1.5 CPU. Where can it go?', options: ['node-1: only 0.4 CPU is really in use', 'Not node-1: 1.5 + 1.5 + 1.5 = 4.5 > 4 requested', 'node-1, but it will be throttled', 'node-1 after evicting one pod'], answer: 1, explain: 'The scheduler compares the sum of <b>requests</b> with allocatable, not live usage. If no node fits, the pod stays Pending with <code>Insufficient cpu</code>, even on an idle cluster.' },
    { kind: 'predict', q: 'CPU limit 500m (50 ms per 100 ms period). A single-threaded request needs 80 ms of CPU and arrives at the start of a period. When does it finish?', options: ['80 ms', '130 ms', '160 ms', '180 ms'], answer: 1, explain: 'It runs 50 ms, the quota is gone, and it is throttled for the remaining 50 ms of the period. In the next period it runs the last 30 ms: 100 + 30 = <b>130 ms</b>.' },
    { kind: 'predict', q: 'CPU limit 1 (100 ms quota per period). A request spawns 4 threads, each needing 30 ms of CPU, on a node with plenty of idle cores. Roughly how long until all 4 finish?', options: ['30 ms', '~105 ms', '120 ms', '~200 ms'], answer: 1, explain: 'Four threads burn 4 ms of quota per ms, so the 100 ms quota is gone after 25 ms. Each thread still needs 5 ms and waits for the next period, then finishes 5 ms in: about <b>105 ms</b> instead of 30.' },
    { kind: 'concept', q: 'A container has <code>requests: {cpu: 500m, memory: 1Gi}</code> and <code>limits: {cpu: 1, memory: 1Gi}</code>. Its QoS class?', options: ['Guaranteed', 'Burstable', 'BestEffort', 'Guaranteed for memory, Burstable for CPU'], answer: 1, explain: 'Guaranteed requires requests = limits for <b>both</b> CPU and memory in <b>every</b> container (including init containers). Here CPU differs, so the pod is <b>Burstable</b>. QoS is one class per pod.' },
    { kind: 'concept', q: 'A container sets only <code>limits: {cpu: 1, memory: 1Gi}</code> and no requests. Its QoS class?', options: ['BestEffort: no requests', 'Burstable', 'Guaranteed: requests default to the limits', 'Rejected by the API server'], answer: 2, explain: 'If a request is omitted but a limit is set, the request defaults to the limit. Requests then equal limits for both resources: <b>Guaranteed</b>. (A LimitRange can also inject defaults.)' },
    { kind: 'scenario', q: 'A container exceeds its memory limit. What happens?', options: ['The kubelet evicts the pod to another node', 'The kernel OOM-kills the process; the kubelet restarts the container in the same pod (exit 137, OOMKilled)', 'Its memory is swapped out', 'It is throttled until usage drops'], answer: 1, explain: 'The memory limit is enforced by the cgroup: the kernel’s OOM killer ends the process. Same pod, same node, restartCount +1, subject to back-off. Eviction is a different mechanism, triggered by <b>node</b>-level pressure.' },
    { kind: 'scenario', q: 'The node is under memory pressure. Same priority for all. Which pod does the kubelet evict first?', options: ['BestEffort pod using 300Mi', 'Burstable pod: request 1Gi, using 2Gi', 'Guaranteed pod: request = limit = 3Gi, using 2.8Gi', 'The pod using the most memory overall'], answer: 1, explain: 'The kubelet ranks by (1) whether usage exceeds the request, (2) priority, (3) usage <b>above the request</b>. Both the BestEffort (300Mi over its 0 request) and the Burstable pod (1Gi over) exceed their requests; the Burstable pod exceeds by more, so it goes first. QoS class itself is not the sort key, a common misconception.' },
    { kind: 'scenario', q: 'A pod with <code>requests.cpu: 1</code> and no CPU limit uses 3 CPUs on a busy node. Other pods now need their requested CPU. What happens?', options: ['It is evicted for exceeding its request', 'It is throttled to exactly 1 CPU', 'CPU is shared in proportion to requests: it keeps at least its 1 CPU, and the others get theirs', 'It is OOMKilled'], answer: 2, explain: 'CPU is <b>compressible</b>: nobody is killed or evicted for CPU. Under contention the kernel divides time by <code>cpu.weight</code>, which comes from requests. Without a limit there is no quota, so no throttling, just a smaller share.' }
  ],
  interview: [
    { q: 'What is the difference between requests and limits?', a: '<p><b>Requests</b> are used for scheduling (sum ≤ node allocatable) and for the CPU share under contention (<code>cpu.weight</code>); they are a guarantee. <b>Limits</b> are enforced ceilings: a CFS quota for CPU (throttling) and <code>memory.max</code> for memory (OOM kill). A pod may use more than its request when the node has spare capacity, up to its limit.</p>', lvl: 'core' },
    { q: 'Explain CFS throttling and why it hurts latency.', a: '<p>A CPU limit becomes <code>cpu.max = quota period</code>, e.g. 100000/100000 for 1 CPU. Within each 100 ms period, all threads of the cgroup share that quota; once it is used up, none of them run until the period ends. Multi-threaded bursts (parallel request handling, GC, JIT) use the quota in a fraction of the period and then stall, adding up to tens of ms to whatever is in flight. Averages hide it; <code>nr_throttled</code>/<code>nr_periods</code> shows it.</p>', fu: 'Should you remove CPU limits? (A real debate: many teams drop them for latency-sensitive services and rely on requests for fairness; others keep them for predictability or multi-tenant isolation. Know the trade-off.)', lvl: 'deep' },
    { q: 'How are QoS classes determined, and what do they affect?', a: '<p><b>Guaranteed</b>: every container has CPU and memory requests equal to limits. <b>BestEffort</b>: no container has any request or limit. <b>Burstable</b>: everything else. QoS sets the kernel <code>oom_score_adj</code> (Guaranteed −997, BestEffort 1000, Burstable scaled by memory request) and the cgroup layout; with the static CPU manager, Guaranteed pods with integer CPUs can get exclusive cores.</p>', lvl: 'core' },
    { q: 'How does node-pressure eviction choose a victim?', a: '<p>When a signal such as <code>memory.available</code> crosses a threshold (hard default on Linux: <code>&lt; 100Mi</code>), the kubelet ranks pods by: whether usage exceeds requests, then pod priority, then usage relative to requests. So BestEffort and over-request Burstable pods go first, and Guaranteed pods well under their limits go last. Evicted pods get phase Failed with reason Evicted; their controllers create replacements elsewhere.</p>', lvl: 'deep' },
    { q: 'OOMKilled vs Evicted: what is the difference?', a: '<p><b>OOMKilled</b>: the container exceeded its <i>own</i> memory limit (or the node hit a kernel OOM first); the kernel killed the process, the container restarts in place. <b>Evicted</b>: the <i>node</i> ran short, the kubelet chose this pod and terminated it gracefully; the pod is Failed and must be replaced by its controller, usually on another node.</p>', lvl: 'core' },
    { q: 'How do you size memory for a Spring Boot container?', a: '<ul><li>Measure: heap after full warm-up and peak load, plus native memory (NMT).</li><li>Set request = limit (JVMs keep their high-water mark).</li><li><code>-XX:MaxRAMPercentage=70–75</code>, leaving 25–30% for metaspace, code cache, threads, direct buffers.</li><li>Cap direct memory and thread pools; <code>-XX:+ExitOnOutOfMemoryError</code> so a heap OOM restarts cleanly.</li></ul>', lvl: 'deep' },
    { q: 'How does the JVM decide how many CPUs it has in a container?', a: '<p>From the CFS quota: <code>ceil(quota / period)</code>, so a 1500m limit reports 2. Since JDK 19, 17.0.5 and 11.0.17 it no longer uses CPU shares, so without a limit it sees the host’s cores. That number sizes GC threads, the ForkJoin common pool and JIT compiler threads. Override with <code>-XX:ActiveProcessorCount</code>.</p>', lvl: 'deep' },
    { q: 'What is node allocatable?', a: '<p>Capacity minus <code>kube-reserved</code> (kubelet, runtime), <code>system-reserved</code> (OS daemons) and the hard eviction threshold. The scheduler uses allocatable, not capacity. If reservations are too small, system daemons compete with pods and the node can hit a kernel OOM before the kubelet evicts anything.</p>', lvl: 'deep' },
    { q: 'What are LimitRange and ResourceQuota?', a: '<p><b>LimitRange</b> (per namespace) sets default requests and limits for containers that omit them, plus min/max values. <b>ResourceQuota</b> caps the namespace totals (Σ requests.cpu, Σ limits.memory, object counts). With a quota on a resource, every new pod must specify it, which is why LimitRange defaults are usually paired with quotas.</p>', lvl: 'core' },
    { q: 'How would you right-size requests across many services?', a: '<p>Collect per-container usage (p95/p99 CPU, max working set) over a representative period, compare with requests, and adjust: VPA in “Off” (recommendation) mode, Goldilocks, or your own Prometheus queries. Watch throttling and OOM kills after changes. Bin-packing efficiency and cost follow from requests, not usage.</p>', fu: 'Can VPA and HPA work together? (Not on the same metric: don’t let VPA change CPU while HPA scales on CPU utilisation, which is computed relative to requests.)', lvl: 'core' },
    { q: 'What changed with in-place pod resize?', a: '<p>Historically, changing a container’s resources meant recreating the pod. <code>InPlacePodVerticalScaling</code> (alpha in 1.27, beta and on by default in 1.33) lets you patch CPU and memory of a running pod via the <code>resize</code> subresource; <code>resizePolicy</code> says whether a change needs a container restart. A JVM won’t grow its max heap on its own, so memory resizes usually still need a restart to be useful.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Resources for a JVM service', lang: 'yaml', code: `containers:
- name: app
  image: registry/orders:7.2
  resources:
    requests:
      cpu: "1"              # scheduling + CPU share under contention
      memory: 2Gi           # = limit for JVMs
    limits:
      memory: 2Gi           # whole-process budget, not just heap
      # cpu limit intentionally omitted: no CFS throttling
  env:
  - name: JAVA_TOOL_OPTIONS
    value: >-
      -XX:MaxRAMPercentage=75
      -XX:ActiveProcessorCount=2
      -XX:+ExitOnOutOfMemoryError
---
apiVersion: v1
kind: LimitRange
metadata: { name: defaults, namespace: orders }
spec:
  limits:
  - type: Container
    defaultRequest: { cpu: 250m, memory: 512Mi }
    default: { memory: 512Mi }` },
    { title: 'Find throttling and OOM kills', lang: 'text', code: `# PromQL: throttled share of CFS periods, per pod (alert above ~0.25)
sum by (pod) (rate(container_cpu_cfs_throttled_periods_total{container!=""}[5m]))
  / sum by (pod) (rate(container_cpu_cfs_periods_total{container!=""}[5m]))

# working set vs limit (what OOM and eviction care about)
max by (pod, container) (container_memory_working_set_bytes{container!=""})
  / max by (pod, container) (kube_pod_container_resource_limits{resource="memory"})

# containers whose last termination was an OOM kill
kube_pod_container_status_last_terminated_reason{reason="OOMKilled"} == 1` },
    { title: 'Look inside the cgroup and the JVM', lang: 'bash', code: `kubectl exec deploy/orders -- cat /sys/fs/cgroup/cpu.max      # "max 100000" = no CPU limit
kubectl exec deploy/orders -- cat /sys/fs/cgroup/cpu.stat     # nr_periods, nr_throttled, throttled_usec
kubectl exec deploy/orders -- cat /sys/fs/cgroup/memory.max   # 2147483648
kubectl exec deploy/orders -- cat /sys/fs/cgroup/memory.events # oom, oom_kill counters

kubectl exec deploy/orders -- jcmd 1 VM.native_memory summary # needs -XX:NativeMemoryTracking=summary
kubectl exec deploy/orders -- jcmd 1 GC.heap_info

kubectl describe node node-7 | grep -A10 'Allocated resources'
kubectl get pods -A -o custom-columns=NS:.metadata.namespace,POD:.metadata.name,QOS:.status.qosClass` }
  ]
});

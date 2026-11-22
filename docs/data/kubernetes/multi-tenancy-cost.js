IA.register({
  track: 'kubernetes',
  slug: 'multi-tenancy-cost',
  title: 'Namespaces, quotas & cost',
  tagline: 'A namespace is a <b>name scope</b>, not a wall. Isolation comes from what you attach to it: <b>RBAC</b>, <b>NetworkPolicy</b>, <b>Pod Security</b>, a <b>ResourceQuota</b> for the total and a <b>LimitRange</b> for each container. And cost follows <b>requests</b>, the capacity you reserve, not the CPU you burn.',
  tldr: {
    problem: 'Shared clusters go wrong in two ways: one team’s job starves everyone, or every team over-requests “to be safe” and the cluster costs three times what it uses. Quotas then block rollouts in confusing ways, and nobody can say which team spends what.',
    model: 'At Pod admission, <b>LimitRanger</b> (mutating) fills default requests and limits and enforces per-container min/max; <b>ResourceQuota</b> (validating) adds the Pod’s requests and limits to the namespace totals and rejects it if any hard limit would be exceeded. The scheduler and the cluster autoscaler also work on requests, so requests decide how many nodes you pay for.',
    hook: '“The workers use 50m CPU each, so why is the quota full?” Because quota counts <b>requests</b> at admission. Usage never enters the calculation.',
    facts: [
      { v: 'requests', l: 'what quota, the scheduler and node autoscaling count: reserved capacity, not usage' },
      { v: 'request = limit', l: 'if a container sets only a limit, its request defaults to that limit, so you reserve the maximum' },
      { v: 'default-allow', l: 'a new namespace has no NetworkPolicy: its Pods can reach, and be reached by, every other namespace' }
    ]
  },
  intro: {
    what: 'Many teams can share one cluster. Each gets one or more <b>namespaces</b>. A <b>ResourceQuota</b> caps the namespace total (e.g. 8 CPUs of requests, 10 Pods, no LoadBalancers). A <b>LimitRange</b> sets defaults and bounds for each container, so a Pod without resource settings still gets sensible ones. Cost comes from the nodes the cluster needs, and the number of nodes depends on the <b>requests</b> everyone declares, so right-sizing requests is the main cost lever.',
    analogy: { icon: '🏬', title: 'A shopping centre', text: 'Each shop rents units (namespace + quota): it can’t take more floor space than it pays for. The building rules (LimitRange) say no single display may block the corridor. Rent is charged on the units you reserve (requests), not on how many customers you get. Shops that rent three units and use one make the landlord build a bigger centre.' },
    steps: [
      { t: 'Give each team a namespace', d: 'With labels for ownership and cost allocation.', code: 'kubectl create namespace team-a\nkubectl label namespace team-a team=a cost-center=1234', lang: 'bash' },
      { t: 'Cap the total with a ResourceQuota', d: 'Compute requests and limits, object counts, even LoadBalancer Services.', code: 'kind: ResourceQuota\nspec:\n  hard:\n    requests.cpu: "8"\n    requests.memory: 16Gi\n    limits.memory: 24Gi\n    pods: "20"\n    services.loadbalancers: "0"' },
      { t: 'Set per-container defaults with a LimitRange', d: 'So Pods without resources aren’t rejected by the quota, and no single container is huge.', code: 'kind: LimitRange\nspec:\n  limits:\n  - type: Container\n    defaultRequest: { cpu: 250m, memory: 512Mi }\n    default: { memory: 1Gi }\n    max: { memory: 4Gi }' },
      { t: 'Compare requests with real usage', d: 'The gap between them is money.', code: 'kubectl top pods -n team-a\nkubectl describe quota -n team-a', lang: 'bash' }
    ],
    terms: [
      ['namespace', 'A scope for names, RBAC, quotas and policies. Not a network or kernel boundary on its own.'],
      ['ResourceQuota', 'Namespace-wide hard limits on total requests/limits, storage and object counts, checked at admission.'],
      ['LimitRange', 'Per-container (or per-Pod/PVC) defaults, minimums, maximums and limit/request ratios in a namespace.'],
      ['multi-tenancy', 'Several teams or customers sharing a cluster; “soft” (trusted teams) or “hard” (untrusted tenants).'],
      ['right-sizing', 'Setting requests (and limits) from measured usage instead of guesses.'],
      ['showback / chargeback', 'Reporting (or billing) cluster cost per team, usually by namespace or label.']
    ]
  },
  visual: {
    title: 'Quota admission in a shared namespace',
    caption: 'Press Play (or Step) to send nine Pod creations into namespace <code>team-a</code>: LimitRanger fills in defaults, LimitRange rejects an oversized container, and ResourceQuota adds each Pod’s requests to the totals until a worker no longer fits. Toggle the LimitRange off and run it again to see what changes.'
  },
  gotchas: [
    { trap: 'A quota on requests without a LimitRange', code: `kubectl apply -f third-party-chart.yaml
# Error from server (Forbidden): pods "exporter-x" is forbidden: failed quota: team-a-quota:
#   must specify limits.memory for: exporter; requests.cpu for: exporter; requests.memory for: exporter`, lang: 'bash', why: 'Once a quota tracks <code>requests.cpu</code>, <code>requests.memory</code> or <code>limits.memory</code>, every new Pod must declare them. Third-party charts, debug Pods and init containers often don’t, and they fail with 403 (or a ReplicaSet <code>FailedCreate</code>).', fix: 'Always pair a compute quota with a LimitRange that sets <code>defaultRequest</code> and <code>default</code>. LimitRanger runs before quota, so the defaults are counted.' },
    { trap: 'Rollouts need quota headroom', why: 'A rolling update with <code>maxSurge</code> temporarily runs extra Pods. If the namespace quota is exactly full, the surge Pods are rejected. With <code>maxUnavailable: 0</code> the rollout can’t proceed at all; the Deployment sits at “1 of N updated” with <code>FailedCreate</code> on the new ReplicaSet.', fix: 'Leave headroom of at least maxSurge × per-Pod requests in each namespace quota, or allow some unavailability. Alert on quota usage above ~85%.' },
    { trap: 'Setting only limits reserves the maximum', code: `resources:
  limits: { cpu: "2", memory: 4Gi }   # requests silently = limits
# the scheduler reserves 2 CPU / 4Gi per Pod, even if it averages 0.2 CPU`, why: 'When a container has a limit and no request, Kubernetes sets the request equal to the limit. Quota usage and node reservations jump to the maximum, and the cluster autoscaler adds nodes for capacity nobody uses.', fix: 'Set requests explicitly from measured usage (p90–p95 for CPU; peak footprint for JVM memory), and limits deliberately. Use a LimitRange <code>maxLimitRequestRatio</code> if you want to bound overcommit.' },
    { trap: 'Treating a namespace as a security boundary', why: 'Out of the box, Pods in different namespaces can talk to each other, share nodes and the kernel, and see cluster-scoped objects (CRDs, StorageClasses, IngressClasses). A namespace admin with broad RBAC can often do more than intended (create Pods with any ServiceAccount in that namespace, for example).', fix: 'Per tenant namespace: RoleBindings to <code>admin</code>/<code>edit</code> only there, a default-deny NetworkPolicy plus explicit allows, Pod Security <code>restricted</code>, quota and LimitRange. For untrusted tenants: dedicated node pools (taints), sandboxed runtimes, virtual clusters or separate clusters.' },
    { trap: 'LimitRange and quota changes don’t touch running Pods', why: 'Both are admission-time checks. Lowering a quota below current usage doesn’t evict anything; it blocks new Pods until usage drops. Changing a LimitRange default only affects Pods created afterwards.', fix: 'After a change, roll the workloads you want to pick it up, and check <code>kubectl describe quota</code> for namespaces already over the new hard values.' },
    { trap: 'Cost reports that ignore idle and shared capacity', why: 'Summing per-Pod usage leaves out idle node capacity, DaemonSets, system Pods and the control plane, often a large share of the bill. Charging by usage alone also rewards over-requesting.', fix: 'Allocate by <code>max(request, usage)</code> per Pod (what OpenCost/Kubecost do), spread idle and shared costs explicitly, and require <code>team</code>/<code>cost-center</code> labels (enforced by an admission policy).' }
  ],
  scenarios: [
    { title: 'A one-line config change could not roll out',
      symptom: 'A Deployment with 8 replicas in <code>team-b</code> shows “1 of 8 updated replicas” for an hour. No errors on any Pod; there is simply no new Pod.',
      diagnoseLang: 'bash',
      diagnose: `kubectl rollout status deploy/billing -n team-b      # waiting...
kubectl get rs -n team-b -l app=billing                # new RS: desired 1, current 0
kubectl describe rs billing-6c9f -n team-b | tail -2
#  FailedCreate  exceeded quota: team-b-quota, requested: requests.cpu=1,
#                used: requests.cpu=8, limited: requests.cpu=8
kubectl get deploy billing -n team-b -o jsonpath='{.spec.strategy.rollingUpdate}'
#  {"maxSurge":1,"maxUnavailable":0}`,
      cause: 'The quota was sized to exactly 8 × 1 CPU. The rollout must start one surge Pod before stopping an old one (maxUnavailable 0), and quota rejected it.',
      fix: 'Give the namespace surge headroom, or let the rollout replace Pods in place. Then right-size: the Pods averaged 0.3 CPU, so a 500m request frees far more than the surge needs.',
      fixCode: `apiVersion: v1
kind: ResourceQuota
metadata: { name: team-b-quota, namespace: team-b }
spec:
  hard:
    requests.cpu: "10"        # 8 replicas + surge + a debug Pod
    requests.memory: 20Gi
    limits.memory: 28Gi
---
# or, if capacity is tight:
strategy:
  rollingUpdate: { maxSurge: 0, maxUnavailable: 1 }` },
    { title: 'The cluster bill doubled in a quarter while traffic grew 15%',
      symptom: 'Node count went from 30 to 62. Average node CPU utilisation is 18%. Every team says their services are “sized for peak”.',
      diagnoseLang: 'text',
      diagnose: `# requested vs used CPU per namespace (cores)
sum by (namespace) (kube_pod_container_resource_requests{resource="cpu"})
sum by (namespace) (rate(container_cpu_usage_seconds_total{container!=""}[1h]))
#  team-search   requested 96   used p95 11
#  team-reports  requested 64   used p95  4   ← limits only: requests = limits
# memory: JVMs requesting 8Gi with a 2Gi working set`,
      cause: 'Requests were copied from limits or from worst-case guesses. Scheduling and the cluster autoscaler work on requests, so nodes were added for reserved, unused capacity.',
      fix: 'Run VPA in recommendation-only mode (or use usage history) to set requests near p95 CPU and real peak memory; review monthly; show each team its requested-vs-used cost. Keep memory request = limit for JVMs, sized to the measured footprint. Let the node autoscaler consolidate underused nodes.',
      fixCode: `apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata: { name: search, namespace: team-search }
spec:
  targetRef: { apiVersion: apps/v1, kind: Deployment, name: search }
  updatePolicy:
    updateMode: "Off"          # recommendations only; you apply them via Git
# kubectl describe vpa search -n team-search   → Target / Upper Bound per container`,
      lang: 'yaml' },
    { title: 'Preview environments created 40 cloud load balancers',
      symptom: 'The cloud bill shows dozens of load balancers nobody remembers creating. Each preview namespace’s chart exposed the app with <code>type: LoadBalancer</code>.',
      diagnoseLang: 'bash',
      diagnose: `kubectl get svc -A --field-selector spec.type=LoadBalancer | wc -l     # 41
kubectl get ns -l purpose=preview --sort-by=.metadata.creationTimestamp | head`,
      cause: 'Every Service of type LoadBalancer provisions a cloud load balancer billed by the hour. Preview namespaces were never cleaned up, and nothing limited the Service type.',
      fix: 'Expose previews through the shared Ingress or Gateway, forbid LoadBalancers in tenant namespaces with an object-count quota, and delete preview namespaces automatically (TTL controller or the CI job’s cleanup step).',
      fixCode: `apiVersion: v1
kind: ResourceQuota
metadata: { name: objects, namespace: preview-pr-1234 }
spec:
  hard:
    services.loadbalancers: "0"
    services.nodeports: "0"
    persistentvolumeclaims: "2"
    requests.storage: 20Gi
    count/deployments.apps: "10"` }
  ],
  puzzles: [
    { kind: 'scenario', q: 'Namespace quota: <code>requests.cpu: 4</code>, no LimitRange. A Pod sets <code>limits.cpu: 1</code> and no request. What happens?', options: ['Admitted, counting 1 CPU: the request defaults to the limit', 'Rejected: it must specify requests.cpu', 'Admitted, counting 0', 'Admitted only if a node has 1 free CPU'], answer: 0, explain: 'A container with only a limit gets request = limit before quota is evaluated, so the quota sees a 1 CPU request. (Memory would need its own request or limit if the quota tracks it.)' },
    { kind: 'scenario', q: 'A Deployment wants 5 replicas, but the quota has room for 4. What do you see?', options: ['The Deployment is rejected', 'All 5 are created and one stays Pending', '4 Pods run; the ReplicaSet records FailedCreate for the fifth and retries; READY shows 4/5', 'The quota is raised automatically'], answer: 2, explain: 'Quota rejects Pod creations, not the Deployment. The ReplicaSet keeps trying and will succeed as soon as quota frees up.' },
    { kind: 'concept', q: 'Do ResourceQuota’s <code>requests.cpu</code> numbers include actual CPU usage?', options: ['Yes, sampled from metrics-server', 'Only for BestEffort Pods', 'Only when the HPA is enabled', 'No: they sum the requests of non-terminal Pods at admission time'], answer: 3, explain: 'Quota is pure accounting of declared resources. A namespace can be “full” while its Pods are idle, which is exactly why right-sizing frees quota.' },
    { kind: 'scenario', q: 'You lower a namespace’s quota from 16 to 8 CPU while its Pods request 12. What happens?', options: ['Pods are evicted until usage is 8', 'Nothing to running Pods; new Pods are rejected until requested CPU drops below 8', 'The change is rejected by the API server', 'Pods are throttled to 8 CPU in total'], answer: 1, explain: 'Quota is checked at admission only. <code>status.used</code> shows 12/8, and every new Pod (including rollout surge Pods) is rejected until it drops.' },
    { kind: 'concept', q: 'Which isolation model fits untrusted customers running arbitrary code?', options: ['One namespace each with a quota', 'Namespaces plus RBAC are enough', 'Hard isolation: separate clusters (or at least dedicated nodes with sandboxed runtimes and strict policies), not shared namespaces', 'One Deployment each'], answer: 2, explain: 'Namespaces share the kernel, nodes, network and cluster-scoped APIs. They work for cooperating internal teams (“soft” multi-tenancy) with RBAC, NetworkPolicy, Pod Security and quotas. Untrusted code needs stronger boundaries.' },
    { kind: 'concept', q: 'A team requests 4 CPU per Pod but uses 0.3. Who pays for the difference?', options: ['Everyone: the scheduler reserves 4 CPU per Pod, so the cluster needs more nodes; fair cost allocation charges max(request, usage)', 'Nobody: unused CPU is free', 'Only the team, through throttling', 'The cloud provider'], answer: 0, explain: 'Reserved capacity can’t be scheduled to anyone else. That is the cost, even if the CPU sits idle.' },
    { kind: 'scenario', q: 'You change a LimitRange’s <code>defaultRequest.memory</code> from 512Mi to 1Gi. What happens to running Pods that got the old default?', options: ['They are restarted with 1Gi', 'Their requests are updated in place', 'They are evicted if the node lacks memory', 'Nothing: defaults are applied once, at creation'], answer: 3, explain: 'LimitRanger mutates the Pod at admission. Existing Pods keep the values they were created with until they are replaced.' }
  ],
  interview: [
    { q: 'What is the difference between ResourceQuota and LimitRange?', a: '<p><b>ResourceQuota</b> limits <i>totals</i> per namespace: sums of requests and limits, storage, and object counts (Pods, Services, LoadBalancers, PVCs, or <code>count/&lt;resource&gt;</code>). <b>LimitRange</b> works <i>per object</i>: default requests/limits for containers, min/max per container or Pod, max limit/request ratio, PVC size bounds. LimitRanger is a mutating admission plugin and runs first; ResourceQuota validates afterwards, so defaults count against the quota.</p>', lvl: 'core' },
    { q: 'Describe the multi-tenancy models on Kubernetes.', a: '<ul><li><b>Namespace per team</b> (soft): shared cluster and nodes; isolation by RBAC, NetworkPolicy, Pod Security, quotas. Cheap, fine for trusted internal teams.</li><li><b>Dedicated nodes per tenant</b>: taints, tolerations and node affinity in addition; reduces noisy neighbours and kernel sharing.</li><li><b>Virtual clusters</b> (e.g. vcluster): each tenant gets its own API server and control plane objects, workloads run on a shared host cluster.</li><li><b>Cluster per tenant</b> (hard): strongest isolation, highest cost and fleet-management effort.</li></ul>', lvl: 'core' },
    { q: 'What do you put in a namespace “template” for a new team?', a: '<p>Namespace labels (team, cost center, Pod Security level), RoleBindings for the team’s group, ResourceQuota (compute, storage, object counts, no LoadBalancers if you have a shared ingress), LimitRange with defaults, a default-deny NetworkPolicy plus allowances for DNS, ingress and monitoring, and optionally default PDB/priority settings. Delivered by GitOps, or by a tool like Capsule or Hierarchical Namespaces.</p>', lvl: 'deep' },
    { q: 'How do you right-size workloads?', a: '<p>Measure, then set requests: CPU around p90–p95 of usage (requests are for scheduling and fair share; bursts can use idle capacity if there is no limit), memory at the real peak plus margin, with limit = request for memory. Sources: Prometheus usage history, VPA in <code>Off</code> mode for recommendations, load tests. Re-check after releases. For JVMs, size the container from the JVM’s footprint (heap + non-heap), not the other way round.</p>', lvl: 'core' },
    { q: 'Why can a cluster be expensive and underutilised at the same time?', a: '<p>Because capacity is allocated by requests. Over-requested Pods reserve CPU and memory that nobody else may use; the cluster autoscaler adds nodes when Pods are Pending on requests, and can’t remove nodes whose (unused) reservations still fit. Also: DaemonSets on every node, Pods that block scale-down (PDBs with 0 allowed disruptions, local storage), and fragmentation (requests that don’t pack well).</p>', lvl: 'deep' },
    { q: 'How do you attribute cluster cost to teams?', a: '<p>Per Pod: <code>max(request, usage)</code> for CPU and memory, priced from the node’s cost, plus storage and network where measurable. Group by namespace or labels. Distribute idle capacity and shared services (ingress, monitoring, control plane) by a stated rule. OpenCost (CNCF) and Kubecost implement this. Make the numbers visible to teams; showback alone changes behaviour.</p>', lvl: 'deep' },
    { q: 'What are quota scopes and PriorityClass quotas for?', a: '<p>A quota can apply only to Pods matching a scope: <code>BestEffort</code>/<code>NotBestEffort</code>, <code>Terminating</code>/<code>NotTerminating</code> (Pods with or without <code>activeDeadlineSeconds</code>), or a <code>PriorityClass</code> via <code>scopeSelector</code>. Example: allow high-priority Pods only in system namespaces by giving every other namespace a quota of 0 Pods for that class.</p>', lvl: 'deep' },
    { q: 'What breaks when quotas are too tight?', a: '<p>Rollouts (surge Pods rejected), HPA scale-outs (the HPA sets replicas, the ReplicaSet can’t create them), Jobs and CronJobs that overlap, and debugging (ephemeral containers don’t count, but a debug Pod copy does). Symptoms appear on ReplicaSets and Jobs as <code>FailedCreate</code>, not on Pods. Leave headroom and alert on usage ratios.</p>', lvl: 'core' },
    { q: 'Which cost levers exist beyond right-sizing?', a: '<ul><li>Bin packing and consolidation (Karpenter, Cluster Autoscaler scale-down settings).</li><li>Spot/preemptible nodes for fault-tolerant workloads, with PDBs and graceful shutdown.</li><li>Scaling to zero off-hours (KEDA, CronJobs that scale Deployments) for non-production.</li><li>Shared ingress instead of per-Service LoadBalancers; cleaning up orphaned PVs and preview namespaces.</li><li>ARM nodes for multi-arch images.</li></ul>', lvl: 'core' }
  ],
  code: [
    { title: 'Quota + LimitRange for a team', lang: 'yaml', code: `apiVersion: v1
kind: ResourceQuota
metadata: { name: team-a-quota, namespace: team-a }
spec:
  hard:
    requests.cpu: "8"
    requests.memory: 16Gi
    limits.memory: 24Gi
    pods: "40"
    requests.storage: 200Gi
    persistentvolumeclaims: "10"
    services.loadbalancers: "0"       # use the shared Ingress/Gateway
---
apiVersion: v1
kind: LimitRange
metadata: { name: defaults, namespace: team-a }
spec:
  limits:
  - type: Container
    defaultRequest: { cpu: 250m, memory: 512Mi }
    default: { memory: 1Gi }          # default limit; no default CPU limit on purpose
    max: { memory: 8Gi }
  - type: PersistentVolumeClaim
    max: { storage: 50Gi }` },
    { title: 'Namespace baseline: isolation', lang: 'yaml', code: `apiVersion: v1
kind: Namespace
metadata:
  name: team-a
  labels:
    team: a
    cost-center: "1234"
    pod-security.kubernetes.io/enforce: restricted
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny, namespace: team-a }
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: allow-dns-and-ingress, namespace: team-a }
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
  ingress:
  - from: [{ namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: ingress-nginx } } }]
  egress:
  - to: [{ namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: kube-system } } }]
    ports: [{ port: 53, protocol: UDP }, { port: 53, protocol: TCP }]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: { name: team-a-admins, namespace: team-a }
subjects: [{ kind: Group, name: team-a, apiGroup: rbac.authorization.k8s.io }]
roleRef: { kind: ClusterRole, name: admin, apiGroup: rbac.authorization.k8s.io }` },
    { title: 'Right-sizing queries', lang: 'text', code: `# CPU: requested vs p95 used, per workload container (cores)
sum by (namespace, pod, container) (kube_pod_container_resource_requests{resource="cpu"})
quantile_over_time(0.95,
  sum by (namespace, pod, container) (rate(container_cpu_usage_seconds_total{container!=""}[5m]))[7d:5m])

# memory: requested vs max working set over a week
sum by (namespace, pod, container) (kube_pod_container_resource_requests{resource="memory"})
max_over_time(container_memory_working_set_bytes{container!=""}[7d])

# quota pressure per namespace
kube_resourcequota{type="used"} / ignoring(type) kube_resourcequota{type="hard"} > 0.85` },
    { title: 'Inspect quota and defaults', lang: 'bash', code: `kubectl describe quota -n team-a          # used / hard per resource
kubectl describe limitrange -n team-a
# what did LimitRanger fill in for a Pod?
kubectl get pod debug -n team-a -o jsonpath='{.spec.containers[0].resources}'
# who is over-requesting? (requires metrics-server)
kubectl top pods -n team-a --sort-by=cpu
kubectl get pods -n team-a -o custom-columns=NAME:.metadata.name,REQ_CPU:.spec.containers[*].resources.requests.cpu,REQ_MEM:.spec.containers[*].resources.requests.memory` }
  ]
});

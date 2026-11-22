IA.register({
  track: 'kubernetes',
  slug: 'scheduling',
  title: 'Scheduler, affinity & taints',
  tagline: 'The scheduler answers one question per pod: <b>which node?</b> It <b>filters</b> out nodes that can’t run the pod, <b>scores</b> the rest, and binds to the best. Every <code>Pending</code> pod is a filter that said no, and the event message tells you which one.',
  tldr: {
    problem: 'Pods stuck <code>Pending</code> while the cluster looks half empty, all replicas packed onto one node or zone, or GPU nodes filling up with ordinary web pods.',
    model: 'Per pod: <b>Filter</b> (resources by <i>requests</i>, node affinity, taints/tolerations, topology spread, pod (anti-)affinity, volumes) → <b>Score</b> (least allocated, image locality, preferred affinities, spread) → <b>Bind</b>. Taints <i>repel</i>; tolerations only <i>permit</i>. Affinity <i>attracts</i>. Topology spread <i>balances</i>.',
    hook: '“The node uses 20% CPU, so why won’t my pod fit?” The scheduler adds up <b>requests</b>, not usage. And <code>0/12 nodes are available: …</code> lists exactly which filters rejected the nodes.',
    facts: [
      { v: '300 s', l: 'default <code>tolerationSeconds</code> for the <code>not-ready</code> and <code>unreachable</code> NoExecute taints, added to every pod by admission: why pods linger on a dead node for ~5 minutes' },
      { v: '1.30', l: 'GA for <code>schedulingGates</code> (hold pods until removed) and for <code>minDomains</code> in topology spread constraints' },
      { v: '3 effects', l: 'for taints: <code>NoSchedule</code>, <code>PreferNoSchedule</code> (soft), and <code>NoExecute</code> (also evicts running pods without a toleration)' }
    ]
  },
  intro: {
    what: 'When you create a pod, it has no node yet. The <b>kube-scheduler</b> watches for such pods and picks a node for each. First it removes nodes that can’t work: not enough free CPU or memory (by the pod’s <i>requests</i>), wrong labels, a taint the pod doesn’t tolerate. Then it ranks the remaining nodes and writes the winner into the pod. The kubelet on that node starts it.',
    analogy: { icon: '🪑', title: 'Seating guests at a wedding', text: 'Filtering: the table must have enough free seats (requests), the guest must be allowed there (“family only” tables are taints, a family badge is a toleration), and some guests insist on a window table (required node affinity). Scoring: among the allowed tables, prefer emptier ones, ones near friends (pod affinity), and spread each family across the room (topology spread) so one spilled drink doesn’t ruin everyone’s evening.' },
    steps: [
      { t: 'Requests are what count', d: 'The scheduler only checks that the sum of requests on a node stays within its allocatable capacity.', code: 'resources:\n  requests: { cpu: 500m, memory: 1Gi }\n  limits:   { memory: 1Gi }' },
      { t: 'Pin with node affinity', d: '“Only nodes with this label” (required), or “prefer these” (preferred, with a weight).', code: 'affinity:\n  nodeAffinity:\n    requiredDuringSchedulingIgnoredDuringExecution:\n      nodeSelectorTerms:\n        - matchExpressions:\n            - { key: disktype, operator: In, values: [ssd] }' },
      { t: 'Keep pods off nodes with taints', d: 'Taint a node, and only pods that tolerate the taint may land there.', code: 'kubectl taint nodes gpu-1 gpu=true:NoSchedule', lang: 'bash' },
      { t: 'Spread replicas', d: 'A topology spread constraint keeps replica counts per zone (or node) within <code>maxSkew</code> of each other.', code: 'topologySpreadConstraints:\n  - maxSkew: 1\n    topologyKey: topology.kubernetes.io/zone\n    whenUnsatisfiable: DoNotSchedule\n    labelSelector: { matchLabels: { app: web } }' },
      { t: 'Read the Pending reason', d: 'The event lists every filter that failed, with node counts.', code: 'kubectl describe pod web-7d9…\n# 0/5 nodes are available: 1 Insufficient cpu,\n#   1 node(s) had untolerated taint {gpu: true}, ...', lang: 'bash' }
    ],
    terms: [
      ['filter (predicate)', 'A yes/no check per node; any “no” removes the node.'],
      ['score (priority)', 'A 0–100 rating per node from each scoring plugin, weighted and summed.'],
      ['taint / toleration', 'A node-side “keep out” mark, and a pod-side permission to ignore it.'],
      ['node affinity', 'Pod rules about node labels: required (filter) or preferred (score).'],
      ['pod (anti-)affinity', 'Rules about which <i>other pods</i> share a topology domain (node, zone) with this one.'],
      ['topology spread', 'Constraints that keep matching pods evenly distributed across domains.']
    ]
  },
  visual: {
    title: 'Filter, score, bind',
    caption: 'Change the pod’s request, toleration and affinities, then press Play. Each filter plugin strikes out nodes with its reason. The survivors are scored (illustrative numbers), and the highest wins. If nothing survives, you get the real-style <code>FailedScheduling</code> message.'
  },
  extras: [
    { id: 'scheduling-spread', title: 'Topology spread: where may the next replica go?', label: 'Spread', caption: 'Add replicas one at a time. For each zone the widget computes <code>count + 1 − global minimum</code> and compares it with <code>maxSkew</code>. Make zone c full and see why <code>DoNotSchedule</code> leaves pods Pending while <code>ScheduleAnyway</code> keeps going.' }
  ],
  gotchas: [
    { trap: 'Scheduling uses requests, not real usage', why: 'A node at 15% CPU usage can still be “full” if its pods request 95% of allocatable. Conversely, pods with tiny requests get packed onto a node they will then saturate.', fix: 'Set requests from observed usage (p90–p95), use VPA in recommendation mode to find them, and alert on requests-vs-allocatable as well as usage. See <a href="resources-qos.html">Requests, limits & QoS</a>.' },
    { trap: 'A toleration doesn’t send pods to a node', why: 'Tolerating <code>gpu=true:NoSchedule</code> only <i>allows</i> GPU nodes. The pod can still land anywhere else, and a dedicated pool fills with unrelated pods that happen to have broad tolerations.', fix: 'For dedicated nodes, combine a taint (keep others out) with a node label plus required node affinity on the intended pods (pull them in).' },
    { trap: 'Required pod anti-affinity caps your replicas', code: `podAntiAffinity:\n  requiredDuringSchedulingIgnoredDuringExecution:\n    - labelSelector: { matchLabels: { app: web } }\n      topologyKey: kubernetes.io/hostname   # 1 per node, strictly`, why: 'With <code>required</code> anti-affinity per hostname, replica N+1 on N nodes stays Pending. During a rolling update, surge pods may also not fit. Inter-pod affinity is also expensive to compute in large clusters.', fix: 'Prefer <code>topologySpreadConstraints</code> (cheaper and more flexible), or use <code>preferred</code> anti-affinity. Keep <code>required</code> for hard rules such as “never two replicas of a quorum member on one node”.' },
    { trap: '<code>DoNotSchedule</code> spread + one full zone = Pending', why: 'The skew is measured against the global minimum over <i>eligible</i> domains. If zone c has 0 replicas but no free capacity, zones a and b already exceed <code>maxSkew</code>, so no node passes. The cluster autoscaler can help only if it can add nodes in zone c.', fix: 'Use <code>ScheduleAnyway</code> for best-effort spreading, keep spare capacity per zone, or tune <code>nodeAffinityPolicy</code>/<code>nodeTaintsPolicy</code> so ineligible nodes don’t count. Read the extra widget below.' },
    { trap: '“IgnoredDuringExecution” really means ignored', why: 'Node affinity and anti-affinity are checked only at scheduling time. Relabel a node, or let other pods arrive, and running pods stay where they are. Spread also drifts after scale-downs and node replacements.', fix: 'Use the descheduler (a separate project) to evict pods that violate current rules, or rely on rollouts to re-place pods. Only <code>NoExecute</code> taints act on running pods.' },
    { trap: 'Preemption can evict your pods', why: 'A pending pod with a higher <code>PriorityClass</code> makes the scheduler (in PostFilter) evict lower-priority pods to make room. PDBs are respected on a best-effort basis only.', fix: 'Give production a higher priority than batch jobs, use <code>preemptionPolicy: Never</code> for high-priority work that should queue rather than evict, and keep <code>system-cluster-critical</code> for real system pods.' }
  ],
  scenarios: [
    { title: 'Pods Pending with 40% free CPU in the cluster',
      symptom: 'A scale-up to 30 replicas leaves 9 pods Pending. Dashboards show cluster CPU usage around 35%.',
      diagnose: `kubectl describe pod api-6b7…-zq | grep -A3 FailedScheduling\n# 0/8 nodes are available: 6 Insufficient cpu, 2 node(s) had untolerated taint {dedicated: kafka}.\nkubectl describe nodes | grep -A6 'Allocated resources' | grep cpu\n#   cpu  3870m (98%)  6 (153%)     ← requests at 98% of allocatable`,
      diagnoseLang: 'bash',
      cause: 'The Spring Boot pods request <code>cpu: 1</code> each (copied from a template), while they use about 250m in steady state. Requests fill the nodes long before usage does.',
      fix: 'Right-size requests from metrics (VPA recommendations, or Prometheus <code>container_cpu_usage_seconds_total</code> p95). Keep a CPU <i>request</i> generous enough for JVM start-up, and consider no CPU limit (avoids throttling) with a memory limit equal to the request.',
      fixCode: `resources:\n  requests: { cpu: 300m, memory: 768Mi }\n  limits:   { memory: 768Mi }   # no CPU limit: no CFS throttling during JIT warm-up` },
    { title: 'All three replicas died together in one zone outage',
      symptom: 'A zone failure took out every replica of <code>checkout</code>, although the cluster spans three zones.',
      diagnose: `kubectl get pods -l app=checkout -o wide\nkubectl get nodes -L topology.kubernetes.io/zone\n# all three pods on nodes in eu-west-1b`,
      diagnoseLang: 'bash',
      cause: 'Without explicit constraints the scheduler only applies its soft default spreading, and scoring preferred nodes with the image already pulled and free capacity, which all happened to be in zone b.',
      fix: 'Add a zone spread constraint (and a hostname one), plus a PDB. Use <code>matchLabelKeys: [pod-template-hash]</code> so a rolling update counts only the new ReplicaSet’s pods.',
      fixCode: `topologySpreadConstraints:\n  - maxSkew: 1\n    topologyKey: topology.kubernetes.io/zone\n    whenUnsatisfiable: DoNotSchedule\n    labelSelector: { matchLabels: { app: checkout } }\n    matchLabelKeys: [pod-template-hash]\n  - maxSkew: 1\n    topologyKey: kubernetes.io/hostname\n    whenUnsatisfiable: ScheduleAnyway\n    labelSelector: { matchLabels: { app: checkout } }` },
    { title: 'Expensive GPU nodes full of log shippers and web pods',
      symptom: 'ML training jobs can’t start: the GPU node pool is full, but <code>nvidia-smi</code> shows idle GPUs.',
      diagnose: `kubectl get pods -A -o wide --field-selector spec.nodeName=gpu-node-1\n# web-…, batch-…, fluent-bit-…   ← none of them use GPUs\nkubectl get pod web-… -o jsonpath='{.spec.tolerations}'\n# [{"operator":"Exists"}]   ← tolerates EVERY taint`,
      diagnoseLang: 'bash',
      cause: 'A shared Helm chart gave every workload <code>tolerations: [{operator: Exists}]</code> so that “pods always schedule”. That disables all taints.',
      fix: 'Remove blanket tolerations (keep them only for node agents in DaemonSets). Taint the GPU pool, and give training pods both the toleration and a required node affinity for the pool label.',
      fixCode: `tolerations:\n  - { key: nvidia.com/gpu, operator: Exists, effect: NoSchedule }\naffinity:\n  nodeAffinity:\n    requiredDuringSchedulingIgnoredDuringExecution:\n      nodeSelectorTerms:\n        - matchExpressions: [{ key: pool, operator: In, values: [gpu] }]` }
  ],
  puzzles: [
    { kind: 'scenario', q: 'A node has 4 CPU allocatable. Pods on it request 3 CPU in total but use only 0.4. A new pod requests 1.5 CPU. Is this node feasible?', options: ['Yes, actual usage is low', 'No: 3 + 1.5 > 4 by requests', 'Yes, if the pod has no limit', 'Only for Burstable pods'], answer: 1, explain: 'NodeResourcesFit compares the sum of <b>requests</b> with allocatable. Usage doesn’t matter to the scheduler (usage matters to the kubelet’s eviction logic).' },
    { kind: 'scenario', q: 'You run <code>kubectl taint nodes n1 maint=true:NoSchedule</code>. What happens to pods already running on n1 without a toleration?', options: ['They are evicted immediately', 'They are evicted after 300 s', 'They keep running; only new pods are kept off', 'They are restarted in place'], answer: 2, explain: '<code>NoSchedule</code> only affects scheduling. <code>NoExecute</code> also evicts running pods that don’t tolerate it (after their <code>tolerationSeconds</code>, if set). That is the difference between “cordon-like” and “drain-like” taints.' },
    { kind: 'predict', q: 'A Deployment has 4 replicas with <i>required</i> pod anti-affinity on <code>kubernetes.io/hostname</code>. The cluster has 3 schedulable nodes. How many pods are Running?', options: ['4', '3, and 1 Pending', '1', '0: the Deployment is invalid'], answer: 1, explain: 'One pod per node, strictly. The fourth stays Pending with “didn’t match pod anti-affinity rules”, unless the cluster autoscaler adds a node.' },
    { kind: 'predict', q: 'Zones a, b and c hold 2, 1 and 0 matching pods. <code>maxSkew: 1</code>, <code>DoNotSchedule</code>. Where can the next pod go?', options: ['a or b', 'b or c', 'only c', 'anywhere'], answer: 2, explain: 'Skew = count in the candidate zone + 1 − global minimum (0). a → 3, b → 2, c → 1. Only c is ≤ 1. If zone c has no free capacity, the pod stays Pending.' },
    { kind: 'concept', q: 'Node affinity has two <code>nodeSelectorTerms</code>: [zone In (a)] and [disktype In (ssd)]. A node is in zone b with disktype=ssd. Does it match?', options: ['Yes: terms are ORed', 'No: terms are ANDed', 'Only if it is also in zone a', 'It depends on the weights'], answer: 0, explain: '<code>nodeSelectorTerms</code> are ORed. <code>matchExpressions</code> <i>within</i> a term are ANDed. (Plain <code>nodeSelector</code> plus affinity: both must hold.)' },
    { kind: 'bug', q: 'A workload tolerates <code>gpu=true:NoSchedule</code> and has no affinity. The GPU nodes are empty, and general nodes have room too. Where does it land?', options: ['Always on a GPU node', 'Never on a GPU node', 'Wherever scoring puts it: GPU or general nodes', 'On no node until affinity is added'], answer: 2, explain: 'Tolerations remove a filter; they don’t add an attraction. To <i>pin</i> it, add required node affinity for the GPU label as well.' },
    { kind: 'predict', q: '<code>0/9 nodes are available: 4 Insufficient memory, 3 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }, 2 node(s) didn’t match Pod’s node affinity/selector.</code> How many nodes would fit if you halved the pod’s memory request (and nothing else changed)?', options: ['Up to 4', '9', '7', '2'], answer: 0, explain: 'Only the 4 “Insufficient memory” nodes failed on resources. The 3 control-plane nodes and the 2 affinity mismatches fail regardless of size. Each node is reported under the reason it failed on.' },
    { kind: 'concept', q: 'A Spring Boot pod has a <code>schedulingGates</code> entry. What does the scheduler do with it?', options: ['Schedules it with low priority', 'Ignores it until every gate is removed from the pod', 'Schedules it, but the kubelet waits', 'Rejects it'], answer: 1, explain: 'Pod scheduling readiness (GA 1.30): a gated pod is <code>SchedulingGated</code> and not considered at all. A controller (a quota system or a batch queue such as Kueue) removes the gates when the pod may proceed.' }
  ],
  interview: [
    { q: 'Describe the scheduling cycle.', a: '<p>For each pod in the active queue (ordered by priority): <b>PreFilter/Filter</b> find feasible nodes (in big clusters it stops after finding enough, per <code>percentageOfNodesToScore</code>). If none are feasible, <b>PostFilter</b> tries preemption. <b>PreScore/Score/NormalizeScore</b> rate the feasible nodes 0–100 per plugin, weighted. <b>Reserve</b> claims resources in the scheduler’s cache, <b>Permit</b> can wait (gang scheduling). The <b>binding cycle</b> (PreBind, for example volume binding, then Bind) runs asynchronously.</p>', fu: 'Why is binding asynchronous? (So a slow volume bind doesn’t block scheduling the next pod.)', lvl: 'deep' },
    { q: 'Name important filter and score plugins.', a: '<p>Filters: <code>NodeUnschedulable</code>, <code>NodeName</code>, <code>TaintToleration</code>, <code>NodeAffinity</code>, <code>NodePorts</code>, <code>NodeResourcesFit</code>, <code>VolumeBinding</code>/<code>VolumeZone</code>/<code>NodeVolumeLimits</code>, <code>PodTopologySpread</code>, <code>InterPodAffinity</code>. Scores: <code>NodeResourcesFit</code> (LeastAllocated by default; MostAllocated for bin-packing), <code>NodeResourcesBalancedAllocation</code>, <code>ImageLocality</code>, <code>NodeAffinity</code> (preferred terms), <code>TaintToleration</code> (PreferNoSchedule), <code>InterPodAffinity</code>, <code>PodTopologySpread</code>.</p>', lvl: 'deep' },
    { q: 'Taints and tolerations vs node affinity?', a: '<p>Taints are on <b>nodes</b> and repel. Tolerations are on <b>pods</b> and only let a pod ignore a taint. Node affinity is on pods and attracts or requires nodes by label. Dedicated pools need both: taint plus toleration keeps others out, label plus affinity keeps the intended pods in.</p>', lvl: 'core' },
    { q: 'What do the taint effects do?', a: '<ul><li><code>NoSchedule</code>: new pods without a toleration are rejected; running ones stay.</li><li><code>PreferNoSchedule</code>: a soft version, lower score only.</li><li><code>NoExecute</code>: also evicts running pods without a toleration, or after their <code>tolerationSeconds</code>.</li></ul><p>The node lifecycle controller adds <code>node.kubernetes.io/not-ready</code> and <code>unreachable</code> NoExecute taints, and pods get 300 s default tolerations for them. DaemonSet pods tolerate them without a time limit.</p>', lvl: 'core' },
    { q: 'Topology spread constraints: how is skew computed?', a: '<p>For each candidate node: the number of matching pods in that node’s domain (plus 1 for this pod) minus the <b>global minimum</b> across eligible domains. With <code>DoNotSchedule</code> the node is filtered out if that exceeds <code>maxSkew</code>; with <code>ScheduleAnyway</code> it becomes a score penalty. <code>minDomains</code> (GA 1.30) treats the global minimum as 0 until that many domains exist, which forces spreading onto new zones or nodes. <code>matchLabelKeys</code> (for example <code>pod-template-hash</code>) scopes counting to one ReplicaSet revision.</p>', lvl: 'deep' },
    { q: 'Pod affinity vs anti-affinity: use cases?', a: '<p><b>Affinity</b>: co-locate chatty pairs in the same zone or node (a cache with its app) to cut latency and cross-zone cost. <b>Anti-affinity</b>: keep replicas apart per node or zone for availability. Both take a <code>topologyKey</code>. Required inter-pod affinity is expensive (the scheduler checks existing pods across the cluster), so prefer topology spread for “keep apart” at scale.</p>', lvl: 'core' },
    { q: 'How does preemption work?', a: '<p>If a pod finds no feasible node, PostFilter looks for nodes where evicting <b>lower-priority</b> pods would make it fit, picks a node that minimises the damage (respects PDBs where possible, fewest and lowest-priority victims), deletes the victims gracefully, and sets <code>status.nominatedNodeName</code>. The pod is scheduled once the room is free. <code>preemptionPolicy: Never</code> opts a priority class out of preempting.</p>', lvl: 'deep' },
    { q: 'A pod is Pending. Walk me through your checks.', a: '<ol><li><code>kubectl describe pod</code>: the FailedScheduling message and its per-reason counts.</li><li>Resources: requests vs allocatable (<code>kubectl describe node</code> → Allocated resources).</li><li>Taints on candidate nodes vs the pod’s tolerations.</li><li>Node selectors and affinity vs node labels.</li><li>PVC topology (volume node affinity).</li><li>Spread or anti-affinity math.</li><li>Is the cluster autoscaler reacting? Check its events and status ConfigMap.</li><li>Quotas (those fail at admission, not scheduling) and scheduling gates.</li></ol>', lvl: 'core' },
    { q: 'Can you run multiple schedulers or customise scoring?', a: '<p>Yes. <code>KubeSchedulerConfiguration</code> profiles can enable/disable plugins and set weights (for example MostAllocated for bin-packing batch nodes). Pods pick a profile or another scheduler with <code>spec.schedulerName</code>. Custom logic goes in scheduler-framework plugins compiled into a scheduler build, or via extenders (older, slower). Batch systems often add Kueue or Volcano on top.</p>', lvl: 'deep' },
    { q: 'How do JVM workloads interact with scheduling?', a: '<p>Start-up needs much more CPU than steady state (class loading, JIT). With low requests, many pods start at once on one node and slow each other down, and probes fail. Options: requests sized for start-up, no CPU limit, topology spread so rollouts don’t stack on one node, and the startup probe tuned. See <a href="jvm-on-k8s.html">Java/Spring on Kubernetes</a>.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Production-ish pod placement', lang: 'yaml', code: `apiVersion: apps/v1
kind: Deployment
metadata: { name: checkout }
spec:
  replicas: 6
  selector: { matchLabels: { app: checkout } }
  template:
    metadata: { labels: { app: checkout } }
    spec:
      priorityClassName: prod-high
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
              - matchExpressions: [{ key: pool, operator: In, values: [general] }]
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 50
              preference:
                matchExpressions: [{ key: karpenter.sh/capacity-type, operator: In, values: [on-demand] }]
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector: { matchLabels: { app: checkout } }
          matchLabelKeys: [pod-template-hash]
      containers:
        - name: app
          image: registry.example.com/checkout:1.42.0
          resources:
            requests: { cpu: 500m, memory: 1Gi }
            limits:   { memory: 1Gi }
---
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata: { name: prod-high }
value: 100000
preemptionPolicy: PreemptLowerPriority` },
    { title: 'Dedicated node pool', lang: 'bash', code: `# keep everything else off, and label it so the right pods can target it
kubectl taint nodes -l pool=kafka dedicated=kafka:NoSchedule
kubectl label nodes -l pool=kafka workload=kafka

# where would the scheduler put things? check capacity by requests
kubectl describe nodes | grep -E 'Name:|cpu |memory ' | paste - - -
kubectl get events --field-selector reason=FailedScheduling -A` }
  ]
});

IA.register({
  track: 'kubernetes',
  slug: 'autoscaling',
  title: 'HPA, VPA & Cluster Autoscaler',
  tagline: 'Three loops at three levels: the <b>HPA</b> changes the replica count, the <b>VPA</b> changes pod requests, and the <b>Cluster Autoscaler</b> or <b>Karpenter</b> changes the number of nodes. They are chained: HPA adds pods, pods go Pending, nodes appear. Each loop has delays you must design for.',
  tldr: {
    problem: 'Traffic doubles at 9:00 and p99 explodes for four minutes, or replicas flap up and down every minute, or the HPA never scales down a JVM service, or new pods wait Pending for a node.',
    model: 'HPA every 15 s: <code>desired = ceil(current × currentMetric / target)</code>, skipped within a <b>10% tolerance</b>, rate-limited by <b>policies</b>, and scale-down smoothed by a <b>300 s stabilization window</b>. Utilization is measured against <b>requests</b>. Pending pods trigger node autoscaling. VPA rewrites requests (with evictions, or in-place where supported).',
    hook: '“4 replicas at 90% CPU, target 60%: how many?” <code>ceil(4 × 90/60) = 6</code>. Then: “why did it take 5 minutes to scale back down?” The default scale-down stabilization window.',
    facts: [
      { v: '15 s', l: 'default HPA sync period (<code>--horizontal-pod-autoscaler-sync-period</code>), and metrics-server’s default scrape resolution' },
      { v: '0.1', l: 'default tolerance: if <code>|current/target − 1| ≤ 0.1</code>, the HPA does nothing (per-HPA tolerance: alpha in 1.33, beta and on by default in 1.35)' },
      { v: '300 s', l: 'default scale-down stabilization: the HPA uses the <i>highest</i> recommendation from the last 5 minutes. Scale-up has a 0 s window by default' }
    ]
  },
  intro: {
    what: 'Load changes during the day. A <b>HorizontalPodAutoscaler</b> watches a metric (usually CPU utilization relative to the pod’s request) and changes a Deployment’s replica count to keep it near a target. A <b>VerticalPodAutoscaler</b> suggests or applies better CPU and memory requests. When new pods don’t fit anywhere, a <b>node autoscaler</b> (Cluster Autoscaler or Karpenter) adds machines, and it removes them again when they sit idle.',
    analogy: { icon: '🛒', title: 'Supermarket checkouts', text: 'The HPA is the shift manager who opens more tills when queues get long (more replicas), but waits a while before closing them in case the rush returns (stabilization). The VPA notices that one till always needs two cashiers and changes the staffing plan (requests). The Cluster Autoscaler is the landlord who adds a new shop floor when you run out of space for tills (nodes), and takes it back when it stays empty.' },
    steps: [
      { t: 'Install a metrics source', d: 'metrics-server provides the Metrics API (<code>metrics.k8s.io</code>) that CPU/memory HPAs read.', code: 'kubectl top pods -n shop     # works only if metrics-server is running', lang: 'bash' },
      { t: 'Set requests', d: 'CPU utilization % = usage ÷ <b>request</b>. Without a request the HPA can’t compute a percentage for that resource.' },
      { t: 'Create the HPA', d: 'Target 60% average CPU, between 2 and 20 replicas.', code: 'apiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata: { name: orders }\nspec:\n  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: orders }\n  minReplicas: 2\n  maxReplicas: 20\n  metrics:\n    - type: Resource\n      resource: { name: cpu, target: { type: Utilization, averageUtilization: 60 } }' },
      { t: 'Watch it work', d: 'The HPA status shows the current metric, the target and its last decision.', code: 'kubectl get hpa orders -w\n# NAME    REFERENCE          TARGETS        MINPODS  MAXPODS  REPLICAS\n# orders  Deployment/orders  cpu: 142%/60%  2        20       4', lang: 'bash' },
      { t: 'Make room for new pods', d: 'If the cluster is full, new replicas stay Pending until the Cluster Autoscaler or Karpenter adds a node. That usually takes minutes, not seconds.' }
    ],
    terms: [
      ['metrics-server', 'Scrapes the kubelets’ resource metrics (cAdvisor) and serves the Metrics API. It is for autoscaling, not long-term monitoring.'],
      ['custom / external metrics', '<code>custom.metrics.k8s.io</code> (per-object, for example requests per second from Prometheus Adapter) and <code>external.metrics.k8s.io</code> (for example queue depth, used by KEDA).'],
      ['stabilization window', 'A look-back period: on scale-down the HPA uses the highest recommendation in the window, which prevents flapping.'],
      ['VPA modes', '<code>Off</code> (recommend only), <code>Initial</code> (set requests at pod creation), <code>Recreate</code>/<code>Auto</code> (evict to apply), and <code>InPlaceOrRecreate</code> in newer VPA releases.'],
      ['Cluster Autoscaler', 'Resizes node groups (ASGs, MIGs, VMSS) when pods are unschedulable, and removes underused nodes.'],
      ['Karpenter', 'Provisions individual nodes sized for pending pods (no fixed node groups) and consolidates them later.']
    ]
  },
  visual: {
    title: 'The HPA control loop, one sync at a time',
    caption: 'Pick a load pattern and press Play. Each step is one 15-second HPA sync. The panel shows the formula with real numbers, the tolerance check, the scale-up policy cap and the scale-down stabilization window. New pods need two syncs (JVM start-up) before they take traffic.'
  },
  extras: [
    { id: 'autoscaling-nodes', title: 'When pods don’t fit: Cluster Autoscaler vs Karpenter', label: 'Nodes', caption: 'Step through a scale-up from Pending pods to Ready replicas, then the scale-down. Switch the node autoscaler to compare how each picks capacity.' }
  ],
  gotchas: [
    { trap: 'Utilization is relative to requests', why: 'A pod requesting 100m and using 300m shows 300%. Tiny requests make the HPA hyper-aggressive; huge requests make it lazy. A request change alone changes the replica count.', fix: 'Set requests from real usage first (VPA in <code>Off</code> mode is a good recommender), then tune the target. Use <code>ContainerResource</code> metrics (GA 1.30) so a sidecar’s usage doesn’t skew the average.' },
    { trap: 'Memory-based HPA on the JVM never scales down', why: 'The JVM grows its heap up to <code>-Xmx</code>/<code>MaxRAMPercentage</code> and rarely gives memory back to the OS. Memory per pod stays high after the load is gone, so the HPA keeps the replicas.', fix: 'Scale JVM services on CPU, requests per second or queue depth. Use memory for limits and VPA recommendations, not for HPA targets.' },
    { trap: 'GitOps or <code>kubectl apply</code> resets <code>replicas</code>', code: `# deployment.yaml still has:\nspec:\n  replicas: 3      # every sync puts it back to 3; the HPA then scales it again`, why: 'The Deployment’s <code>replicas</code> field is owned by the HPA once it exists. Re-applying a manifest that sets it causes a tug-of-war: replica counts jump and pods churn.', fix: 'Remove <code>spec.replicas</code> from manifests managed by an HPA (or ignore that field in Argo CD: <code>ignoreDifferences</code>).' },
    { trap: 'Start-up CPU spikes trigger runaway scale-up', why: 'JIT compilation and class loading burn CPU for the first 30–90 s of a Spring Boot pod. If those pods were counted at face value, each scale-up would “prove” more scale-up was needed.', fix: 'The HPA already ignores CPU samples from pods in their first minutes (<code>--horizontal-pod-autoscaler-cpu-initialization-period</code>, 5 min) until they are ready. Have a correct readiness/startup probe so “ready” really means ready. Consider CDS/AOT caches to shorten warm-up.' },
    { trap: 'Running VPA and HPA on the same metric', why: 'If the VPA raises CPU requests while the HPA targets CPU utilization, utilization drops, so the HPA scales in, the pods get busier, the VPA raises requests again… The two loops fight.', fix: 'Let the HPA scale on CPU or a custom metric, and use the VPA only for memory (<code>controlledResources: [memory]</code>), or run the VPA in <code>Off</code> mode for recommendations.' },
    { trap: 'Node autoscaling is slow, and it ignores usage', why: 'Cluster Autoscaler and Karpenter react to <b>Pending pods</b> (unschedulable by requests), not to high CPU. A new VM must boot, join, start the CNI and pull images: usually minutes. Scale-down also looks at requests and respects PDBs and <code>safe-to-evict</code> annotations.', fix: 'Keep headroom: overprovisioning with low-priority “pause” pods that get preempted, a higher <code>minReplicas</code> before known peaks, or scheduled scaling (KEDA cron). Make images small and pre-pulled.' }
  ],
  scenarios: [
    { title: 'Morning traffic spike: 4 minutes of 503s, then too many pods',
      symptom: 'At 09:00 traffic triples within 30 s. Error rate peaks for about 4 minutes, then the Deployment overshoots to 20 replicas, which sit idle for 5 minutes.',
      diagnose: `kubectl describe hpa orders | sed -n '/Events/,$p'\n#  New size: 8; reason: cpu resource utilization (percentage of request) above target\n#  New size: 16; reason: ...\nkubectl get events --field-selector involvedObject.kind=Pod,reason=FailedScheduling -n shop | tail -3`,
      diagnoseLang: 'bash',
      cause: 'Three delays stack up: metrics resolution plus the sync period (15 s + 15 s), JVM start-up (about 45 s before ready), and new nodes for the extra pods (2–3 minutes). Meanwhile the old pods are saturated. The overshoot comes from scaling on CPU that was inflated by queueing, and the 300 s scale-down window keeps the peak.',
      fix: 'Raise <code>minReplicas</code> before the known peak (KEDA cron scaler or a scheduled job), keep node headroom with low-priority placeholder pods, scale on requests per second (a leading indicator), and set an explicit scale-up behaviour.',
      fixCode: `behavior:\n  scaleUp:\n    stabilizationWindowSeconds: 0\n    policies:\n      - { type: Percent, value: 100, periodSeconds: 15 }\n      - { type: Pods,    value: 6,   periodSeconds: 15 }\n    selectPolicy: Max\n  scaleDown:\n    stabilizationWindowSeconds: 300\n    policies:\n      - { type: Percent, value: 20, periodSeconds: 60 }   # shed at most 20%/min` },
    { title: 'Replica count flaps between 6 and 9 all day',
      symptom: 'A Kafka consumer Deployment scales up and down every few minutes. Each scale event triggers a consumer-group rebalance, which pauses consumption and creates more lag.',
      diagnose: `kubectl get hpa consumer -o yaml | grep -A12 'behavior:'\n#   scaleDown:\n#     stabilizationWindowSeconds: 0     ← someone "fixed slow scale-down"`,
      diagnoseLang: 'bash',
      cause: 'With a zero scale-down window, every dip in CPU removes pods. The rebalance then causes a lag spike, and lag-driven CPU scales back up. The loop feeds itself.',
      fix: 'Scale consumers on lag (KEDA Kafka scaler) rather than CPU, restore a scale-down window, and cap the scale-down rate. Use cooperative rebalancing (the <code>CooperativeStickyAssignor</code>) to make each change cheaper.',
      fixCode: `apiVersion: keda.sh/v1alpha1\nkind: ScaledObject\nmetadata: { name: consumer }\nspec:\n  scaleTargetRef: { name: consumer }\n  minReplicaCount: 2\n  maxReplicaCount: 12          # <= partition count\n  advanced:\n    horizontalPodAutoscalerConfig:\n      behavior:\n        scaleDown: { stabilizationWindowSeconds: 600 }\n  triggers:\n    - type: kafka\n      metadata: { bootstrapServers: kafka:9092, consumerGroup: orders, topic: orders, lagThreshold: "500" }` },
    { title: 'Cluster Autoscaler won’t remove a nearly empty node',
      symptom: 'Three nodes run at under 10% of requested CPU for days, yet the node group never shrinks. The bill keeps growing.',
      diagnose: `kubectl -n kube-system logs deploy/cluster-autoscaler | grep -i "cannot be removed" | tail -3\n#  node ip-10-0-3-12 cannot be removed: pod shop/report-0 has local storage\n#  node ip-10-0-4-19 cannot be removed: not enough pod disruption budget to move kube-system/coredns-…`,
      diagnoseLang: 'bash',
      cause: 'Scale-down only removes a node if all its pods can be moved: no PDB violation, no bare pods without a controller, no <code>safe-to-evict: "false"</code>, and (depending on settings) no local storage. One stubborn pod pins a whole node.',
      fix: 'Give system pods PDBs that allow one disruption, annotate pods whose scratch data is disposable as safe to evict, and avoid bare pods. Karpenter users check <code>karpenter.sh/do-not-disrupt</code> and the NodePool disruption budgets.',
      fixCode: `metadata:\n  annotations:\n    cluster-autoscaler.kubernetes.io/safe-to-evict: "true"   # emptyDir data is disposable\n---\napiVersion: policy/v1\nkind: PodDisruptionBudget\nmetadata: { name: coredns, namespace: kube-system }\nspec:\n  maxUnavailable: 1\n  selector: { matchLabels: { k8s-app: kube-dns } }` }
  ],
  puzzles: [
    { kind: 'predict', q: '4 replicas, average CPU utilization 90%, target 60%. What does the HPA compute?', options: ['5', '6', '7', '8'], answer: 1, explain: '<code>ceil(4 × 90 / 60) = ceil(6.0) = 6</code>. The ratio 1.5 is far outside the 0.1 tolerance, and the default scale-up policy (max of +100% or +4 pods per 15 s) allows going from 4 to 6.' },
    { kind: 'predict', q: '10 replicas at 53% average CPU, target 50%. What happens?', options: ['Scale to 11', 'Scale to 12', 'No change', 'Scale to 9'], answer: 2, explain: 'The ratio is 53/50 = 1.06. <code>|1.06 − 1| = 0.06 ≤ 0.1</code>, inside the default tolerance, so the HPA skips scaling. Without the tolerance it would be <code>ceil(10.6) = 11</code>.' },
    { kind: 'predict', q: 'Pods request 250m CPU and each uses 200m. There are 3 replicas and the target is 50%. Desired replicas?', options: ['3', '4', '5', '6'], answer: 2, explain: 'Utilization = 200/250 = 80%. <code>ceil(3 × 80 / 50) = ceil(4.8) = 5</code>.' },
    { kind: 'predict', q: 'An HPA has two metrics. CPU suggests 5 replicas; requests-per-second suggests 8. Result?', options: ['5', '6 (rounded average)', '8', '13'], answer: 2, explain: 'With multiple metrics the HPA computes a proposal for each and takes the <b>largest</b>, so no metric is left under-provisioned.' },
    { kind: 'scenario', q: 'Load drops sharply at 12:00. Each sync now recommends 3 replicas. Over the past 5 minutes the recommendations peaked at 9. Default behaviour. Replicas at 12:01?', options: ['3', '9', '6', '2 (minReplicas)'], answer: 1, explain: 'The scale-down stabilization window (300 s) uses the <b>highest</b> recommendation within the window: 9. Replicas fall only as the older, higher recommendations age out of the window.' },
    { kind: 'predict', q: 'Current replicas 2. A sudden spike gives a raw recommendation of 20. Default scale-up policies. What is the maximum after one sync?', options: ['4', '6', '20', '3'], answer: 1, explain: 'Default scale-up: Percent 100% (2 → 4) or Pods 4 (2 → 6) per 15 s, with <code>selectPolicy: Max</code>, so 6. The next sync can go to 12, then 20.' },
    { kind: 'concept', q: 'Which statement about the Cluster Autoscaler is true?', options: ['It adds nodes when node CPU usage is above 80%', 'It resizes running pods', 'It works without node groups on every cloud', 'It adds nodes when pods are unschedulable and a node group could fit them'], answer: 3, explain: 'CA simulates scheduling Pending pods onto a template node from each node group and grows a group that fits. Usage doesn’t trigger it. Karpenter skips node groups and picks instance types directly.' },
    { kind: 'concept', q: 'KEDA scales a Kafka consumer from 0. Who does what?', options: ['KEDA activates 0 → 1 itself, and manages an HPA (fed by its external metrics) for 1 → N', 'KEDA replaces the HPA entirely', 'The HPA scales from 0 natively', 'The Cluster Autoscaler scales it'], answer: 0, explain: 'A plain HPA can’t scale from or to zero (that is behind an alpha feature gate). KEDA’s operator handles activation to and from 0, creates an HPA, and serves the trigger’s value through <code>external.metrics.k8s.io</code> for the 1 → N range.' }
  ],
  interview: [
    { q: 'Explain the HPA algorithm precisely.', a: '<p>Every sync (15 s) the controller fetches the metric for all pods of the target, computes <code>ratio = current / target</code>, and if <code>|ratio − 1| &gt; tolerance</code> (0.1) proposes <code>ceil(currentReplicas × ratio)</code>. Pods without metrics or not yet ready are handled conservatively: assumed 0% usage when scaling up, 100% when scaling down, so a scale is not overstated. With several metrics the largest proposal wins. The <code>behavior</code> stabilization windows and rate policies are then applied, and the result is clamped to <code>[minReplicas, maxReplicas]</code>.</p>', fu: 'What does the HPA do with a pod whose CPU sample comes from its first minutes? (Ignores it until it is ready and past the initialization period.)', lvl: 'deep' },
    { q: 'Describe the metrics pipeline.', a: '<p>cAdvisor in the kubelet measures containers → the kubelet exposes <code>/metrics/resource</code> → metrics-server scrapes it (15 s by default) and serves <code>metrics.k8s.io</code> through the API aggregation layer → the HPA reads it. For custom metrics, an adapter (Prometheus Adapter, KEDA, a cloud adapter) registers <code>custom.metrics.k8s.io</code> or <code>external.metrics.k8s.io</code>. <code>kubectl top</code> reads the same API.</p>', lvl: 'core' },
    { q: 'How do you tune scale-up and scale-down behaviour?', a: '<p><code>spec.behavior.scaleUp/scaleDown</code>: a <code>stabilizationWindowSeconds</code> (look-back, taking the max for scale-down and the min for scale-up) and <code>policies</code> (Pods or Percent per <code>periodSeconds</code>), with <code>selectPolicy</code> Max/Min/Disabled. Fast up, slow down is the usual shape. Disabling scale-down (<code>selectPolicy: Disabled</code>) is handy during incidents.</p>', lvl: 'core' },
    { q: 'What does the VPA do, and which mode would you use?', a: '<p>The recommender builds usage histograms and suggests requests (target, lower and upper bounds). The updater evicts pods whose requests are far off (in Recreate/Auto). The admission controller rewrites requests on new pods. Start with <code>updateMode: Off</code> and read <code>status.recommendation</code>. <code>Initial</code> is safe for batch. Eviction-based modes need PDBs and enough replicas. Kubernetes in-place pod resize (beta and on by default since 1.33, GA in 1.35) lets newer VPA versions apply changes without a restart, via <code>InPlaceOrRecreate</code>.</p>', lvl: 'core' },
    { q: 'Cluster Autoscaler vs Karpenter?', a: '<ul><li><b>Cluster Autoscaler</b>: works with predefined node groups (ASG/MIG/VMSS) and picks which group to grow with an expander (least-waste, priority, price…). Scale-down removes nodes under about 50% requested utilization for about 10 minutes when their pods can move. Mature, and works across clouds.</li><li><b>Karpenter</b> (v1.0 since 2024; AWS, plus Azure via AKS node auto-provisioning): no node groups. It reads Pending pods’ requirements and launches right-sized instances (spot or on-demand mixes), then <b>consolidates</b> by replacing or removing underused nodes, within disruption budgets.</li></ul>', lvl: 'deep' },
    { q: 'What is KEDA, and when is it better than a plain HPA?', a: '<p>Event-driven autoscaling (a CNCF graduated project). <code>ScaledObject</code>/<code>ScaledJob</code> with scalers for Kafka lag, SQS/Service Bus depth, Prometheus queries, cron and dozens more. It scales to zero and back and generates the HPA for you. Use it for queue consumers and bursty workers, where CPU is a lagging or misleading signal.</p>', lvl: 'core' },
    { q: 'Why are JVM services hard to autoscale, and what helps?', a: '<ul><li>Slow start (JIT, Spring context): hide it with startup probes, CDS/AOT or CRaC where possible, and pre-scaling.</li><li>CPU spikes at start-up: the HPA’s CPU initialization period helps.</li><li>Memory doesn’t fall after load drops: don’t scale on memory.</li><li>GC can look like load: watch GC time.</li><li>Thread pools and connection pools cap throughput before CPU does: scale on RPS or latency.</li></ul>', lvl: 'deep' },
    { q: 'How long does it take from a traffic spike to a new pod serving, worst case?', a: '<p>Roughly the sum of: metric collection (up to about 15 s) + HPA sync (up to 15 s) + scheduling (fast if room exists) + <b>node provisioning</b> if not (often 1–3 minutes) + image pull + app start-up and readiness. For a JVM that easily adds up to minutes. That is why headroom and leading indicators matter more than a perfect target.</p>', lvl: 'core' },
    { q: 'What stops a node from being scaled down?', a: '<p>Pods that can’t be moved: PDBs with no disruptions allowed, bare pods (no controller), <code>safe-to-evict: "false"</code> or Karpenter’s <code>do-not-disrupt</code>, some kube-system pods without PDBs, pods with node-affinity that fits nowhere else, and (depending on configuration) pods with local storage. Also the scale-down utilization threshold and the unneeded time.</p>', lvl: 'deep' },
    { q: 'What is overprovisioning with placeholder pods?', a: '<p>Run a Deployment of low-priority “pause” pods that request real capacity. When real pods arrive they preempt the placeholders immediately (no wait for a node). The evicted placeholders go Pending and trigger the node autoscaler in the background. You pay for the headroom; you buy minutes of latency back.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'HPA v2 with behaviour', lang: 'yaml', code: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: orders, namespace: shop }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: orders }
  minReplicas: 3
  maxReplicas: 30
  metrics:
    - type: ContainerResource            # GA 1.30: ignore sidecars
      containerResource:
        name: cpu
        container: app
        target: { type: Utilization, averageUtilization: 60 }
    - type: Pods                         # from Prometheus Adapter
      pods:
        metric: { name: http_server_requests_per_second }
        target: { type: AverageValue, averageValue: "80" }
  behavior:
    scaleUp:
      policies: [{ type: Percent, value: 100, periodSeconds: 15 }, { type: Pods, value: 4, periodSeconds: 15 }]
      selectPolicy: Max
    scaleDown:
      stabilizationWindowSeconds: 300
      policies: [{ type: Percent, value: 25, periodSeconds: 60 }]` },
    { title: 'VPA recommendations only', lang: 'yaml', code: `apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata: { name: orders }
spec:
  targetRef: { apiVersion: apps/v1, kind: Deployment, name: orders }
  updatePolicy: { updateMode: "Off" }     # just recommend
  resourcePolicy:
    containerPolicies:
      - containerName: app
        controlledResources: [memory]     # leave CPU to the HPA
        minAllowed: { memory: 512Mi }
        maxAllowed: { memory: 4Gi }
# kubectl get vpa orders -o jsonpath='{.status.recommendation}'` },
    { title: 'Expose RPS from Spring Boot', lang: 'yaml', code: `# application.yaml: Micrometer -> Prometheus; Prometheus Adapter maps
# rate(http_server_requests_seconds_count[1m]) to http_server_requests_per_second
management:
  endpoints:
    web:
      exposure:
        include: health,prometheus
  metrics:
    distribution:
      percentiles-histogram:
        http.server.requests: true
  server:
    port: 8081          # separate port for scraping and probes` },
    { title: 'Karpenter NodePool', lang: 'yaml', code: `apiVersion: karpenter.sh/v1
kind: NodePool
metadata: { name: general }
spec:
  template:
    spec:
      requirements:
        - { key: karpenter.sh/capacity-type, operator: In, values: [spot, on-demand] }
        - { key: kubernetes.io/arch, operator: In, values: [amd64, arm64] }
      nodeClassRef: { group: karpenter.k8s.aws, kind: EC2NodeClass, name: default }
  limits: { cpu: "400" }
  disruption:
    consolidationPolicy: WhenEmptyOrUnderutilized
    consolidateAfter: 2m
    budgets: [{ nodes: "10%" }]` }
  ]
});

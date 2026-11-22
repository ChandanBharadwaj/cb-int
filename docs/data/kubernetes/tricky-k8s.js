IA.register({
  track: 'kubernetes',
  slug: 'tricky-k8s',
  title: '★ Tricky Kubernetes (timed)',
  tagline: 'Fifty “what happens next?” scenarios from every Kubernetes topic, against the clock. Each one is a trap that has caused a real outage or a confused hour of debugging: probes that kill healthy Pods, quotas that block rollouts, JVMs that don’t fit their limits.',
  tldr: {
    problem: 'Senior Kubernetes interviews rarely ask for YAML from memory. They describe a cluster in a weird state and ask what happens next, why, and what you would check first.',
    model: 'Almost every trick comes from one of five ideas: <b>controllers reconcile</b> (desired vs actual, through labels and owner references), <b>requests are reservations</b> (scheduling, quota, cost), <b>limits are enforcement</b> (CPU throttles, memory kills), <b>admission is separate from authorization</b>, and <b>routing lags the Pod lifecycle</b> (endpoints, probes, SIGTERM).',
    hook: 'A Pod sits in <code>CrashLoopBackOff</code> with a clean log and restarts every ~90 s. If you immediately ask “is it the liveness probe or the app’s exit code?”, start the drill.',
    facts: [
      { v: '50', l: 'scenario questions covering all 24 topics of the track, two or three per topic' },
      { v: '60 s', l: 'per question by default. Slow (90 s) and Fast (30 s) modes too' },
      { v: 'shuffled', l: 'questions and answer options are shuffled on every run; misses link back to their topic page' }
    ]
  },
  intro: {
    what: 'This page is a <b>drill</b>, not a lesson. You get a short cluster scenario, a timer and four answers. Decide in your head, as you would in an interview, then read the explanation. At the end you get your score per topic, and every miss is listed with its explanation and a link to the page that covers it.',
    analogy: { icon: '⏱️', title: 'Flight-simulator emergencies', text: 'Pilots don’t learn engine failures from the manual alone; they practise them until the first three checks are automatic. Each question here is a small emergency: the obvious answer is wrong for a specific reason.' },
    steps: [
      { t: 'Find the controller', d: 'Who owns this object, and what does it reconcile? Deployment → ReplicaSet → Pods; selectors and owner references decide membership.' },
      { t: 'Separate reservation from usage', d: 'Scheduling, quota and cost use <b>requests</b>. Throttling and OOM kills come from <b>limits</b>. Usage only matters for eviction and autoscaling.' },
      { t: 'Ask which gate said no', d: 'Authentication, RBAC, admission (Pod Security, quota, webhooks), the scheduler, or the kubelet. Each leaves its message in a different place.' },
      { t: 'Draw the timeline', d: 'For rollouts, probes and shutdown: what happens at t = 0, after each period, at the grace period? Most surprises are about ordering.' }
    ],
    terms: [
      ['reconcile', 'Compare desired state with actual state and act to close the gap.'],
      ['request / limit', 'What a container reserves (scheduling) vs the maximum it may use (enforced by the kernel).'],
      ['admission', 'The API-server stage after RBAC that can mutate or reject objects.'],
      ['skew', 'Allowed version differences between components during upgrades.'],
      ['grace period', 'Time between SIGTERM (after preStop) and SIGKILL when a Pod is deleted.']
    ]
  },
  visual: {
    title: 'The drill',
    caption: 'Pick a module (or All), how many questions and the time per question, then press Start. Skip counts as a miss. At the end you see your score per topic, with links, and a review of every miss.'
  },
  gotchas: [
    { trap: 'Answering from Docker or VM habits', why: 'A container restart is not a Pod restart, a Pod is not rescheduled when its node is slow, and “the process got killed” usually means a cgroup limit or a probe, not the OS. Habits from VMs and docker-compose lead to wrong first guesses.', fix: 'Name the Kubernetes component that acted: kubelet (probes, restarts, eviction), scheduler (placement), a controller (replicas), the kernel (OOM, throttling).' },
    { trap: 'Forgetting version-dependent behaviour', why: 'Native sidecars (1.29+ on by default), kubelet skew n−3 (1.28+), Pod Security Admission (GA 1.25), CEL validation (GA 1.29), ValidatingAdmissionPolicy (GA 1.30), cgroup v2 support in the JDK: the right answer can depend on the version.', fix: 'Say which version you assume (“on 1.30…”). Interviewers like a candidate who knows that behaviour changed and roughly when.' },
    { trap: 'Guessing instead of naming the evidence', why: 'In a real incident the answer is in an Event, a status field or a metric. An interviewer asking “why is it Pending?” wants to hear where you would look.', fix: 'Pair every answer with its evidence: <code>describe</code> Events, <code>lastState.terminated</code>, ReplicaSet <code>FailedCreate</code>, <code>container_cpu_cfs_throttled_periods_total</code>. See <a href="debugging.html">Debugging workloads</a>.' },
    { trap: 'Treating the managed service as magic', why: 'EKS, GKE and AKS run the control plane, but the skew rules, API removals, PDBs, quotas, requests and probes are still yours. Many “cloud provider issues” are workload configuration.', fix: 'Separate what the provider owns (control plane, node images) from what you own (everything in your manifests), and reason about the second part first.' }
  ],
  scenarios: [
    { title: 'Use the drill like an incident review',
      symptom: 'You scored 30/50, with misses spread across topics. Re-reading everything takes too long.',
      diagnose: 'Look at the per-topic breakdown after a full 50-question run.\nTopics under 50% → read the topic page’s gotchas and scenarios first.\nTopics at 100% twice → skip them next time (pick a module instead).',
      diagnoseLang: 'text',
      cause: 'Misses cluster around a few mental models (requests vs limits, admission vs RBAC, lifecycle timing). Fixing a model fixes several questions at once.',
      fix: 'For each miss, write one sentence: “I thought X, but Y because Z.” Then run the module again on Fast.',
      fixCode: 'Example:\nI thought a PDB protects against rolling updates,\nbut it only applies to evictions,\nbecause the Deployment controller deletes Pods directly using its own maxUnavailable.',
      fixLang: 'text' },
    { title: 'Practising out loud for the interview',
      symptom: 'You know the answers when reading, but in interviews the explanation comes out tangled.',
      diagnose: 'Pick 10 questions on Slow. For each, answer out loud in three parts before clicking:\n1. what happens\n2. why (which component, which rule)\n3. what you would check or change',
      diagnoseLang: 'text',
      cause: 'Recognition is easier than recall. Saying the mechanism out loud is the skill interviews test.',
      fix: 'Use the timer as the interviewer’s patience: 60 s for the whole three-part answer. Repeat until the structure is automatic.',
      fixCode: '“The Pod stays Pending: the scheduler filters on requests, not usage.\nNo node has 6Gi unrequested memory, which the FailedScheduling event would show.\nI’d right-size the request or let the autoscaler add a node.”',
      fixLang: 'text' }
  ],
  puzzles: [
    { kind: 'scenario', q: 'Combined: a Spring Boot Pod has <code>limits.cpu: 1</code>, a liveness probe with <code>timeoutSeconds: 1</code>, and boots in 70 s with no startup probe (<code>initialDelaySeconds: 30</code>). What is the most likely first symptom after deploy?', options: ['CrashLoopBackOff with a clean log: liveness fails during the slow, throttled boot and restarts it before it is up', 'OOMKilled', 'Pending: not enough CPU', 'ImagePullBackOff'], answer: 0, explain: 'A CPU limit stretches JVM startup; without a startup probe, liveness gives it only about 30 s plus three failed periods, roughly 50–60 s. Every restart begins from zero. See <a href="probes.html">Probes</a> and <a href="jvm-on-k8s.html">Java/Spring on Kubernetes</a>.' },
    { kind: 'scenario', q: 'Combined: namespace quota is exactly full, the Deployment uses <code>maxSurge: 1, maxUnavailable: 0</code>, and you push a new image. What happens?', options: ['The rollout replaces Pods one by one', 'The quota is ignored during rollouts', 'Nothing rolls: the surge Pod is rejected by quota (FailedCreate on the new ReplicaSet), and no old Pod may go first', 'Old Pods are evicted to make room'], answer: 2, explain: 'Rollouts need headroom for surge Pods. Raise the quota, or allow <code>maxUnavailable: 1</code>. See <a href="multi-tenancy-cost.html">Namespaces, quotas & cost</a>.' },
    { kind: 'scenario', q: 'Combined: GitOps with self-heal manages a Deployment that also has an HPA. The chart renders <code>replicas: 3</code>. Load rises and the HPA wants 9. What do you observe?', options: ['9 replicas, stable', 'The HPA is disabled by Argo CD', 'The Deployment is deleted and recreated', 'Replicas flap between 3 and 9 as the HPA and the sync fight'], answer: 3, explain: 'Two controllers own one field. Remove <code>replicas</code> from the rendered manifest or ignore it in the GitOps tool. See <a href="helm-kustomize-gitops.html">Helm, Kustomize & GitOps</a>.' },
    { kind: 'scenario', q: 'Combined: a node drain during a cluster upgrade hangs. The only Pod left is a 1-replica service with <code>minAvailable: 1</code>, and a validating webhook with <code>failurePolicy: Fail</code> runs on that same node. What is the risk if someone force-deletes Pods to finish?', options: ['None', 'The single replica goes down, and if the webhook’s Pods go too, no Pod can be created anywhere until the webhook is back', 'The upgrade rolls back', 'The PDB recreates the Pod'], answer: 1, explain: 'Force-deleting bypasses the PDB, and a webhook that matches its own namespace can block its own replacement. See <a href="cluster-upgrades.html">Upgrades & cluster ops</a> and <a href="operators-crds.html">Operators & CRDs</a>.' },
    { kind: 'scenario', q: 'Combined: a developer can create Pods in <code>shop</code> (Pod Security <code>baseline</code>) but not read Secrets. Which statement is true?', options: ['They can’t reach Secret values at all', 'baseline blocks Secret volumes', 'They can mount any Secret in shop into a Pod they create; baseline doesn’t restrict Secret volumes', 'Only cluster-admins can mount Secrets'], answer: 2, explain: 'RBAC on Secrets doesn’t cover indirect access through workloads, and no Pod Security level restricts Secret volumes. See <a href="rbac-security.html">RBAC & Pod security</a>.' }
  ],
  interview: [
    { q: 'How do you approach a “what happens next?” Kubernetes question?', a: '<p>Out loud, in order: which object and which controller own the situation; what that controller reconciles towards; which component acts next (scheduler, kubelet, a controller, admission, the kernel); and what evidence it leaves (Event, status, metric). Then give the outcome and the fix. Interviewers grade the chain of reasoning more than the final answer.</p>', lvl: 'core' },
    { q: 'Which three mental models explain most Kubernetes surprises?', a: '<ol><li><b>Reconciliation through selectors</b>: membership is labels, not identity; controllers fight if two own a field.</li><li><b>Requests reserve, limits enforce</b>: requests drive scheduling, quota, cost; limits throttle CPU and OOM-kill memory.</li><li><b>Lifecycle timing</b>: endpoints, probes, preStop, SIGTERM and grace periods run concurrently, and routing always lags.</li></ol>', lvl: 'core' },
    { q: 'You don’t know the answer. What do you say?', a: '<p>Narrow it down and say how you would check: “Either the scheduler never picked it up or it was filtered out. I would look at the Pod’s Events: a FailedScheduling message lists the reasons per node; no events at all would point at the scheduler itself.” Knowing where the evidence lives is often the senior answer.</p>', lvl: 'core' },
    { q: 'Which Kubernetes misconfigurations cause the most production incidents?', a: '<ul><li>Probes: dependencies in liveness, 1 s timeouts, no startup probe.</li><li>Resources: memory limits that don’t fit the JVM, CPU limits that throttle, requests copied from limits.</li><li>Shutdown: no preStop, shell-form entrypoints, grace periods too short.</li><li>Disruption: PDBs that allow zero evictions, single replicas.</li><li>Control plane: webhooks with <code>failurePolicy: Fail</code> and no namespace exclusions.</li><li>Upgrades: removed APIs still in charts.</li></ul>', lvl: 'deep' },
    { q: 'How do you check a tricky claim quickly in a real cluster?', a: '<p>Use a scratch namespace (or a kind cluster) and small manifests: <code>kubectl apply --dry-run=server</code> to see admission results, <code>kubectl auth can-i</code> for RBAC, <code>kubectl explain</code> for field semantics and defaults, <code>kubectl get -o yaml</code> after creation to see what was defaulted, and Events for what the controllers did.</p>', lvl: 'core' },
    { q: 'What would you look at first in an unfamiliar cluster during an incident?', a: '<p>Recent changes (rollouts, GitOps sync history, node pool upgrades), then cluster-wide Events sorted by time, Pods not Running/Ready across namespaces, node conditions (MemoryPressure, DiskPressure, NotReady), and the golden-signal dashboards of the affected service. Start broad for two minutes, then follow the strongest signal. See <a href="observability.html">Observability</a>.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Five-minute triage', lang: 'bash', code: `# what changed?
kubectl rollout history deploy -n shop
kubectl get events -A --sort-by=.lastTimestamp | tail -30
# what is unhealthy?
kubectl get pods -A --field-selector=status.phase!=Running,status.phase!=Succeeded
kubectl get nodes -o custom-columns=NAME:.metadata.name,READY:.status.conditions[?(@.type=="Ready")].status,MEM:.status.conditions[?(@.type=="MemoryPressure")].status
# one Pod in detail
kubectl describe pod POD -n shop | sed -n '/Last State/,/Events/p'
kubectl logs POD -n shop --previous | tail -50
# who may do what / what would admission say?
kubectl auth can-i --list -n shop --as=system:serviceaccount:shop:orders
kubectl apply --dry-run=server -f manifest.yaml` },
    { title: 'A manifest that avoids most traps', lang: 'yaml', code: `spec:
  replicas: 3                               # omit if an HPA owns it
  strategy: { rollingUpdate: { maxSurge: 1, maxUnavailable: 0 } }
  template:
    spec:
      terminationGracePeriodSeconds: 45     # ≥ preStop + drain + margin
      topologySpreadConstraints:
      - { maxSkew: 1, topologyKey: topology.kubernetes.io/zone, whenUnsatisfiable: ScheduleAnyway, labelSelector: { matchLabels: { app: orders } } }
      containers:
      - name: app
        resources:
          requests: { cpu: "1", memory: 2Gi }    # measured, not guessed
          limits:   { memory: 2Gi }              # no CPU limit for a latency-sensitive JVM
        env: [{ name: JAVA_TOOL_OPTIONS, value: "-XX:MaxRAMPercentage=70 -XX:+ExitOnOutOfMemoryError" }]
        startupProbe:   { httpGet: { path: /livez,  port: 8080 }, periodSeconds: 5, failureThreshold: 36 }
        livenessProbe:  { httpGet: { path: /livez,  port: 8080 }, timeoutSeconds: 3 }
        readinessProbe: { httpGet: { path: /readyz, port: 8080 }, periodSeconds: 5 }
        lifecycle: { preStop: { sleep: { seconds: 10 } } }
---
# plus: a PDB with maxUnavailable: 1, a namespace quota with surge headroom` }
  ]
});

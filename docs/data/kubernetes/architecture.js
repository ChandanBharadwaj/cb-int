IA.register({
  track: 'kubernetes',
  slug: 'architecture',
  title: 'Cluster architecture',
  tagline: 'Kubernetes is a <b>database with watchers</b>. The API server fronts etcd; the scheduler, controllers, kubelets and kube-proxy never call each other. They each <b>watch</b> objects, do one job and write the result back. Follow one <code>kubectl apply</code> and the whole design falls out.',
  tldr: {
    problem: 'When a pod is stuck Pending, a deploy is rejected or Services stop updating, you need to know <b>which component owns that step</b>. Otherwise you are restarting things at random.',
    model: 'Control plane: <b>API server</b> (the only door to etcd; authn → authz → admission → persist), <b>etcd</b> (the state), <b>scheduler</b> (sets <code>nodeName</code>), <b>controller manager</b> (reconcile loops). Node: <b>kubelet</b> (makes pods real through CRI), <b>kube-proxy</b> (programs Service rules), the container runtime and CNI.',
    hook: '“What happens when you run kubectl apply?” Walk it: request → admission → etcd → Deployment controller → ReplicaSet controller → scheduler → kubelet → runtime → status → EndpointSlice → kube-proxy.',
    facts: [
      { v: '1', l: 'component talks to etcd: the API server. Everything else reads and writes through its REST API and watches' },
      { v: '⌊n/2⌋+1', l: 'etcd members needed for quorum. 3 members survive 1 failure, 5 survive 2; 4 members still only survive 1' },
      { v: 'n−3', l: 'oldest kubelet minor version supported against an API server (since 1.28). A kubelet must never be newer than the API server' }
    ]
  },
  intro: {
    what: 'A Kubernetes cluster is a group of machines (<b>nodes</b>) plus a <b>control plane</b> that manages them. You never tell a node “start this container”. You store a description of what you want (an <b>object</b>, written in YAML) in the cluster’s database through the <b>API server</b>. Small programs watch that database, notice the new object and each do their part, until containers are running on some node.',
    analogy: { icon: '🍽️', title: 'A restaurant ticket rail', text: 'The waiter (kubectl) pins an order ticket on the rail (API server + etcd). Nobody shouts at anyone. The head chef (scheduler) reads unassigned tickets and writes a station on each. Each station cook (kubelet) watches for tickets with their station and cooks. The expediter (controllers) keeps checking that the number of plates matches the order and writes new tickets when one is dropped. Everyone talks only to the rail.' },
    steps: [
      { t: 'You describe, the API server stores', d: 'kubectl sends your YAML to the API server over HTTPS. It checks who you are, whether you are allowed, and whether the object is valid, then saves it in etcd.', code: 'kubectl apply -f deployment.yaml\nkubectl get deployment web -o yaml   # what is stored now', lang: 'bash' },
      { t: 'Controllers turn one object into others', d: 'The Deployment controller sees a new Deployment and creates a ReplicaSet. The ReplicaSet controller sees that and creates Pod objects. They are still only records.' },
      { t: 'The scheduler picks a node', d: 'It watches pods with no node assigned, filters nodes that fit (CPU, memory, taints), scores the rest and writes the winner into <code>spec.nodeName</code>.' },
      { t: 'The kubelet makes it real', d: 'The kubelet on that node sees a pod assigned to it and asks the container runtime to pull the image and start the containers. It reports status back.', code: 'kubectl get pod -o wide   # NODE and IP columns filled in', lang: 'bash' },
      { t: 'Traffic finds it', d: 'Once the pod is Ready, its IP is added to the Service’s EndpointSlice and kube-proxy on every node updates its forwarding rules.' }
    ],
    terms: [
      ['API server', '<code>kube-apiserver</code>: the REST front door. Authenticates, authorises, runs admission, stores objects, serves watches.'],
      ['etcd', 'A consistent key-value store (Raft consensus) holding every object in the cluster.'],
      ['scheduler', 'Assigns each new pod to a node by filtering and scoring.'],
      ['controller', 'A loop that watches objects and acts to make the actual state match the desired state.'],
      ['kubelet', 'The agent on every node that runs the pods assigned to it, via the container runtime (CRI).'],
      ['kube-proxy', 'The node agent that turns Services and EndpointSlices into iptables, IPVS or nftables rules.']
    ]
  },
  visual: {
    title: 'Follow one kubectl apply through the cluster',
    caption: 'Press Play to send a 3-replica Deployment through the request path. The dot is the message; the etcd panel shows what is stored. Then pick something to <b>break</b> and play again to see where the chain stops.'
  },
  gotchas: [
    { trap: 'A down admission webhook blocks every deploy', code: `kind: ValidatingWebhookConfiguration
webhooks:
- name: policy.example.com
  failurePolicy: Fail        # unreachable webhook → request rejected
  timeoutSeconds: 10         # every API write waits this long first`, why: 'Webhooks are called synchronously on the write path. If the webhook’s own pods are evicted and <code>failurePolicy: Fail</code>, every matching create or update fails, sometimes including the pods that would bring the webhook back.', fix: 'Exclude <code>kube-system</code> and the webhook’s own namespace with a <code>namespaceSelector</code>, keep <code>timeoutSeconds</code> low, run 2+ replicas with a PDB. For simple rules, prefer in-process <b>ValidatingAdmissionPolicy</b> (CEL, GA in 1.30): no network hop at all.' },
    { trap: '“The control plane is down, so my app is down”', why: 'Running pods do not depend on the control plane. The kubelet keeps containers running, kube-proxy keeps its last rules. What you lose is <b>change</b>: no scheduling, no self-healing, no scaling, no endpoint updates, no deploys.', fix: 'During a control-plane outage, don’t restart nodes or kubelets: you would destroy pods that nothing can recreate. Run 3 control-plane nodes (or a managed control plane) for HA.' },
    { trap: 'An even number of etcd members', why: 'Quorum is ⌊n/2⌋+1. Four members need 3 for quorum, so they still tolerate only 1 failure, with more members to fail and slower writes. Two members tolerate zero.', fix: 'Run 3 or 5 members on low-latency disks (etcd is fsync-bound). Back it up with <code>etcdctl snapshot save</code>; see <a href="cluster-upgrades.html">Upgrades & cluster ops</a>.' },
    { trap: 'Polling the API server like a database', why: 'Scripts and home-grown controllers that LIST all pods every few seconds load the API server and etcd. API Priority and Fairness (GA in 1.29) will queue or reject them with 429, sometimes along with other clients in the same flow.', fix: 'Use <b>informers</b> (one LIST, then a WATCH and a local cache) from client-go, fabric8 or the official Java client. Filter with label and field selectors.' },
    { trap: 'Upgrading kubelets before the control plane', why: 'The supported skew is one-way: kubelets may be up to <b>three</b> minor versions <i>older</i> than the API server (since 1.28), never newer. kubectl is supported within ±1 minor version.', fix: 'Upgrade order: etcd if needed → API servers → controller manager and scheduler → nodes. Never skip API server minor versions.' },
    { trap: 'Thinking kube-proxy carries your packets', why: 'In iptables, IPVS and nftables modes kube-proxy only <b>programs</b> kernel rules; packets never pass through the kube-proxy process. If it crashes, traffic keeps flowing on stale rules, and new endpoints are silently ignored on that node.', fix: 'Alert on kube-proxy health and on <code>kubeproxy_sync_proxy_rules_last_timestamp_seconds</code> going stale. Some CNIs (Cilium with kube-proxy replacement) remove kube-proxy entirely.' }
  ],
  scenarios: [
    { title: 'Every deploy fails with “failed calling webhook”',
      symptom: 'All <code>kubectl apply</code> calls for Deployments fail cluster-wide: <code>Internal error occurred: failed calling webhook "validate.policy.example.com": … context deadline exceeded</code>. Nothing was changed in the apps.',
      diagnoseLang: 'bash',
      diagnose: `kubectl get validatingwebhookconfigurations
kubectl get pods -n policy-system          # 0/2 running: evicted during a node drain
kubectl get validatingwebhookconfiguration policy -o yaml | grep -E 'failurePolicy|timeoutSeconds|namespaceSelector'`,
      cause: 'The policy webhook’s two replicas sat on the same node, which was drained. With <code>failurePolicy: Fail</code> and no namespace exclusion, the API server rejected every matching request. The rule also matched Pods in its own namespace, so even the webhook’s replacement pods were rejected: a deadlock.',
      fix: 'Restore the webhook (temporarily patch <code>failurePolicy: Ignore</code> or delete the configuration), then make it robust: anti-affinity across nodes, a PDB, a namespace exclusion and a short timeout. Move simple rules to ValidatingAdmissionPolicy.',
      fixCode: `webhooks:
- name: validate.policy.example.com
  failurePolicy: Fail
  timeoutSeconds: 3
  namespaceSelector:
    matchExpressions:
    - key: kubernetes.io/metadata.name
      operator: NotIn
      values: ["kube-system", "policy-system"]` },
    { title: 'New pods sit in Pending with no events at all',
      symptom: 'After a self-managed control-plane upgrade, scaled-up pods stay <code>Pending</code>. <code>kubectl describe pod</code> shows <b>no events</b>, not even <code>FailedScheduling</code>.',
      diagnoseLang: 'bash',
      diagnose: `kubectl get pods -n kube-system -l component=kube-scheduler
#   kube-scheduler-cp1   0/1   CrashLoopBackOff
kubectl get lease -n kube-system kube-scheduler -o jsonpath='{.spec.holderIdentity} {.spec.renewTime}'
kubectl logs -n kube-system kube-scheduler-cp1 --previous`,
      cause: 'The scheduler’s static pod manifest referenced a removed flag, so it crashed on start. No scheduler means nobody even <i>tries</i> to place pods, so there is no FailedScheduling event. The absence of events is the clue.',
      fix: 'Fix the manifest in <code>/etc/kubernetes/manifests/</code>; the kubelet restarts static pods automatically. Run the scheduler on every control-plane node so leader election (a Lease) can fail over.',
      fixCode: `# on the control-plane node
sudo vi /etc/kubernetes/manifests/kube-scheduler.yaml   # remove the obsolete flag
kubectl get pods -A --field-selector=status.phase=Pending   # drains within seconds`, lang: 'bash' },
    { title: 'API server returns 429 and kubectl hangs at 9 a.m.',
      symptom: 'Every morning deploys and <code>kubectl</code> are slow for minutes, some controllers log <code>429 Too Many Requests</code>.',
      diagnoseLang: 'bash',
      diagnose: `kubectl get --raw /metrics | grep apiserver_flowcontrol_rejected_requests_total
# audit log: thousands of LIST /api/v1/pods from user-agent "report-job/1.0"
kubectl get flowschemas`,
      cause: 'A reporting CronJob started 50 parallel workers, each running a full <code>LIST pods</code> across all namespaces (tens of thousands of objects) in a loop. API Priority and Fairness shed load, but the workers shared a priority level with other workloads.',
      fix: 'Rewrite the job to use one informer (or a paginated LIST with <code>limit</code>/<code>continue</code>), and give it its own low-priority FlowSchema so it can only hurt itself.',
      fixCode: `apiVersion: flowcontrol.apiserver.k8s.io/v1
kind: FlowSchema
metadata: { name: report-job }
spec:
  priorityLevelConfiguration: { name: workload-low }
  matchingPrecedence: 1000
  rules:
  - subjects:
    - kind: ServiceAccount
      serviceAccount: { name: report-job, namespace: reporting }
    resourceRules:
    - verbs: ["list", "watch", "get"]
      apiGroups: [""]
      resources: ["pods"]
      clusterScope: true
      namespaces: ["*"]` }
  ],
  puzzles: [
    { kind: 'scenario', q: 'The scheduler is down. You scale a Deployment from 3 to 5 replicas. What happens?', options: ['kubectl scale is rejected', 'The ReplicaSet gets replicas: 5 and 2 new Pod objects are created; they stay Pending', 'Nothing at all is written until the scheduler returns', 'The 3 existing pods restart'], answer: 1, explain: 'The API server, Deployment controller and ReplicaSet controller all work, so the new Pod objects exist. Only the step “set <code>spec.nodeName</code>” is missing, so they stay <b>Pending</b>. The existing pods are untouched.' },
    { kind: 'scenario', q: 'Two of three etcd members die. What happens to the 200 running pods?', options: ['They are all killed within the kubelet’s grace period', 'They keep running and serving traffic; the API cannot accept writes', 'They keep running, but Services stop routing to them', 'The scheduler moves them to healthy nodes'], answer: 1, explain: 'Without quorum etcd cannot commit writes (and linearizable reads fail), so the API server is effectively read-only or unavailable. Kubelets keep their containers running and kube-proxy keeps its rules. You just can’t <b>change</b> anything, and nothing self-heals.' },
    { kind: 'concept', q: 'Which component creates the <b>Pod</b> objects for a Deployment?', options: ['The Deployment controller', 'The ReplicaSet controller', 'The scheduler', 'The kubelet'], answer: 1, explain: 'The Deployment controller creates and scales <b>ReplicaSets</b>. The ReplicaSet controller (also in kube-controller-manager) creates the Pods, each with an <code>ownerReference</code> to the ReplicaSet. The scheduler only binds them; the kubelet only runs them.' },
    { kind: 'concept', q: 'Who gives a new pod its IP address?', options: ['The API server, when the pod is created', 'The scheduler, along with the node', 'The CNI plugin, called by the container runtime while it creates the pod sandbox', 'kube-proxy'], answer: 2, explain: 'The kubelet calls the runtime’s <code>RunPodSandbox</code> over CRI. The runtime creates the network namespace and calls the <b>CNI</b> plugin, which allocates the IP and wires up the interface. The kubelet then reports <code>status.podIP</code>.' },
    { kind: 'scenario', q: 'kube-proxy crashes on node-3 and stays down. A client pod on node-3 calls a ClusterIP Service whose pods have not changed. Does the call work?', options: ['Yes, the existing kernel rules still forward it', 'No, kube-proxy carries all Service traffic', 'Only if the target pod is also on node-3', 'Only via DNS, not the ClusterIP'], answer: 0, explain: 'kube-proxy only programs iptables/IPVS/nftables rules. The kernel does the forwarding. Stale rules keep working until endpoints change; then node-3 keeps sending to old pod IPs.' },
    { kind: 'scenario', q: 'A mutating webhook injects a sidecar <b>without</b> resource limits. A ValidatingAdmissionPolicy requires limits on every container. Your Deployment’s app container has limits. What happens?', options: ['Admitted: validation saw your original manifest', 'Rejected: validating admission runs after mutation and sees the injected sidecar', 'Admitted, then the sidecar is removed', 'It depends on which webhook responds first'], answer: 1, explain: 'Order on the write path: authentication → authorization → <b>mutating</b> admission → schema validation → <b>validating</b> admission → etcd. Validation sees the final, mutated object, which is exactly why it runs last.' },
    { kind: 'concept', q: 'Your API servers run 1.31. Which kubelet version is <b>not</b> supported?', options: ['1.28', '1.29', '1.31', '1.32'], answer: 3, explain: 'Since 1.28 the kubelet may be up to three minor versions older (1.28–1.31 here) but never newer than the API server. That is why you upgrade the control plane first.' }
  ],
  interview: [
    { q: 'Walk me through what happens when you run <code>kubectl apply -f deployment.yaml</code>.', a: '<ol><li>kubectl sends a PATCH (client-side apply, or <code>--server-side</code>) over HTTPS.</li><li>The API server <b>authenticates</b> (cert, OIDC, SA token), <b>authorizes</b> (RBAC), runs <b>mutating</b> admission, schema validation and <b>validating</b> admission, then writes to <b>etcd</b>.</li><li>The <b>Deployment controller</b> (watching Deployments) creates a ReplicaSet.</li><li>The <b>ReplicaSet controller</b> creates N Pods with no node.</li><li>The <b>scheduler</b> filters and scores nodes and binds each pod (<code>spec.nodeName</code>).</li><li>The <b>kubelet</b> on that node sees the pod, calls the runtime over CRI (sandbox + CNI, image pull, start), runs probes and patches pod status.</li><li>When Ready, the <b>EndpointSlice controller</b> adds the IP; <b>kube-proxy</b> on every node updates rules.</li></ol>', fu: 'Where can it get stuck, and how would you see it? (Admission errors in kubectl output, ReplicaSet events, FailedScheduling, ImagePullBackOff, readiness.)', lvl: 'core' },
    { q: 'Why does only the API server talk to etcd?', a: '<p>It centralises authentication, authorization, admission, validation, versioning and conversion between API versions, so no client can write an invalid or unauthorised object. It also lets the API server serve <b>watches</b> from a cache, so thousands of watchers do not each hit etcd. etcd stays a dumb, consistent store.</p>', lvl: 'core' },
    { q: 'How do watches work, and what is a resourceVersion?', a: '<p>Every write gets a monotonically increasing <code>resourceVersion</code> (from etcd’s revision). A client LISTs, notes the version, then WATCHes from it and receives ADDED/MODIFIED/DELETED events. If it falls too far behind, it gets <code>410 Gone</code> and must re-list. Informers wrap this with a local cache and periodic resync. <code>resourceVersion</code> is also used for optimistic concurrency: an update with a stale version gets <code>409 Conflict</code>.</p>', lvl: 'deep' },
    { q: 'How does the scheduler choose a node?', a: '<p>For each pod: <b>filter</b> (enough allocatable for the <i>requests</i>, node selector and affinity, taints and tolerations, volume topology, ports) then <b>score</b> the feasible nodes (spreading, balanced allocation, image locality, preferred affinity) and pick the best. Then it <b>binds</b>, writing the node name. If nothing fits it may <b>preempt</b> lower-priority pods. See <a href="scheduling.html">Scheduling</a>.</p>', lvl: 'core' },
    { q: 'What runs inside kube-controller-manager?', a: '<p>One binary, many independent control loops: Deployment, ReplicaSet, StatefulSet, DaemonSet, Job, CronJob, Node lifecycle (marks nodes NotReady, triggers eviction), EndpointSlice, Namespace, ServiceAccount, the garbage collector and more. Cloud-specific loops (load balancers, node addresses, routes) live in the <b>cloud-controller-manager</b>.</p>', lvl: 'core' },
    { q: 'How is the control plane made highly available?', a: '<p>API servers are stateless and run active-active behind a load balancer. etcd runs 3 or 5 members with Raft. Scheduler and controller manager run on every control-plane node but only one is active, chosen by <b>leader election</b> on a <code>Lease</code> object in <code>kube-system</code>; the others take over when renewals stop.</p>', lvl: 'deep' },
    { q: 'What does the kubelet actually do?', a: '<p>It registers the node and reports its capacity and conditions, watches pods bound to it, and drives the container runtime over CRI: create the sandbox (network via CNI), pull images, start init containers, sidecars and app containers, mount volumes, run probes, restart containers per <code>restartPolicy</code>, enforce eviction under resource pressure, and patch pod status. It also runs <b>static pods</b> from a local directory, which is how kubeadm runs the control plane itself.</p>', lvl: 'core' },
    { q: 'What happens if the whole control plane goes down?', a: '<p>Existing workloads keep running: containers, Service rules and DNS answers already cached keep working. You lose all change and recovery: no deploys, no rescheduling of pods from failed nodes, no autoscaling, no new endpoints, no new Secrets mounted. CoreDNS keeps serving from its cache for a while, but cannot see changes.</p>', lvl: 'core' },
    { q: 'What is admission control, and what changed in 1.30?', a: '<p>Admission plugins inspect (and optionally modify) requests after authorization, before persistence. Built-in ones include LimitRanger, ResourceQuota, PodSecurity and ServiceAccount; extensions are mutating and validating webhooks. In 1.30 <b>ValidatingAdmissionPolicy</b> went GA: validation rules written in CEL that run inside the API server, with no webhook to keep alive.</p>', lvl: 'deep' },
    { q: 'How does the API server protect itself from noisy clients?', a: '<p><b>API Priority and Fairness</b> (GA in 1.29) classifies requests by FlowSchema into priority levels, each with its own concurrency share and fair queues per flow (user or namespace). Excess requests queue, then get 429. Long-running watches are exempt from concurrency limits once started. Also: <code>--max-requests-inflight</code> as a coarse limit, and clients should use informers and pagination.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Inspect the request path', lang: 'bash', code: `# see the HTTP calls kubectl makes (verbs, URLs, status codes)
kubectl apply --server-side -f web.yaml -v=6

# dry-run through admission without persisting
kubectl apply --server-side --dry-run=server -f web.yaml

# control-plane health, per check
kubectl get --raw='/readyz?verbose'

# who is the active scheduler / controller manager?
kubectl get lease -n kube-system kube-scheduler kube-controller-manager

# the chain of events for one rollout, oldest first
kubectl get events -n shop --sort-by=.metadata.creationTimestamp` },
    { title: 'ValidatingAdmissionPolicy (GA in 1.30)', lang: 'yaml', code: `apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: require-memory-limits
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
    - apiGroups: ["apps"]
      apiVersions: ["v1"]
      operations: ["CREATE", "UPDATE"]
      resources: ["deployments"]
  validations:
  - expression: >-
      object.spec.template.spec.containers.all(c,
        has(c.resources.limits) && 'memory' in c.resources.limits)
    message: "every container needs a memory limit"
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: require-memory-limits
spec:
  policyName: require-memory-limits
  validationActions: ["Deny"]
  matchResources:
    namespaceSelector:
      matchLabels: { policy: enforced }`, note: 'Runs inside the API server: no webhook pods to evict, no network timeout on the write path.' },
    { title: 'Watch pods from Java (fabric8 informer)', lang: 'java', code: `try (KubernetesClient client = new KubernetesClientBuilder().build()) {
    // one LIST, then a WATCH; events are served from a local cache
    SharedIndexInformer<Pod> informer = client.pods().inNamespace("shop")
        .withLabel("app", "web")
        .inform(new ResourceEventHandler<>() {
            public void onAdd(Pod p) { log.info("added {}", p.getMetadata().getName()); }
            public void onUpdate(Pod old, Pod p) {
                log.info("{} phase={}", p.getMetadata().getName(), p.getStatus().getPhase());
            }
            public void onDelete(Pod p, boolean unknownFinalState) { log.info("deleted"); }
        });
    // informer.getStore().list() reads the cache: no API call
}`, note: 'Same pattern the built-in controllers use. Never poll LIST in a loop.' }
  ]
});

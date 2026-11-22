/* Tricky Kubernetes: a timed drill of 50 scenario questions across every Kubernetes topic, scored, with a per-topic breakdown and a review of misses linking back to the topic pages. */
IA.widget('tricky-k8s', (root, ctx) => {
  const { el, reduced } = ctx;
  /*Q-START*/
  const Q = [
    // ---------- M0 Foundations ----------
    { t: 'containers-vs-vms', q: 'Two containers on the same node. What do they share that two VMs on one host don’t?', o: ['Nothing: they are fully isolated', 'The host’s kernel', 'Their root filesystem', 'Always the same network namespace'], a: 1, x: 'Containers are processes isolated with namespaces and limited with cgroups, running on the <b>same kernel</b>. A kernel exploit from one container can reach the node, which is why Pod Security and sandboxed runtimes matter for untrusted code.' },
    { t: 'containers-vs-vms', q: 'You change a file copied by the second-to-last instruction of a Dockerfile. Which layers are rebuilt?', o: ['Only that layer', 'That layer and every layer after it', 'All layers', 'Only the final layer'], a: 1, x: 'Build cache is invalidated from the first changed instruction onwards. Order Dockerfiles from least to most frequently changing: base, dependencies, then application code.' },
    { t: 'architecture', q: 'etcd loses quorum (2 of 3 members down). What happens to Pods that are already running?', o: ['The kubelets kill them', 'They keep running, but the API server can’t serve or change state, so nothing is scheduled, scaled or healed', 'They are moved to other nodes', 'Services stop routing to them immediately'], a: 1, x: 'The data plane keeps its last known state: containers run and kube-proxy rules stay. Everything that needs the API (rollouts, rescheduling after a node failure, HPA) stops until quorum returns.' },
    { t: 'architecture', q: 'You <code>kubectl apply</code> a new Deployment. Which component creates the Pod objects?', o: ['kube-apiserver', 'The kubelet', 'The ReplicaSet controller in kube-controller-manager', 'kube-scheduler'], a: 2, x: 'The Deployment controller creates a ReplicaSet; the ReplicaSet controller creates Pod objects; the scheduler only sets <code>nodeName</code>; the kubelet on that node runs the containers.' },
    { t: 'pods', q: 'A Job’s Pod has the app container plus a log shipper as a <i>regular</i> second container. The app finishes successfully. What happens?', o: ['The Job completes', 'The Pod stays Running because the shipper never exits, so the Job never completes', 'The kubelet kills the shipper automatically', 'The Job fails'], a: 1, x: 'A Pod completes only when all its regular containers have exited. Native sidecars (an init container with <code>restartPolicy: Always</code>, on by default since 1.29) are stopped automatically after the main containers finish.' },
    { t: 'pods', q: 'A Pod has two init containers. The second one keeps failing. What do you see?', o: ['The app containers start anyway', '<code>Init:CrashLoopBackOff</code>: the kubelet retries the failing init container with back-off and never starts the app containers', 'The Pod is deleted', 'Only the first init container is retried'], a: 1, x: 'Init containers run in order and must each succeed before the next starts; app containers start only after all of them. Read its log with <code>kubectl logs pod -c &lt;init-name&gt;</code>.' },
    { t: 'desired-state', q: 'You delete the ReplicaSet behind a running Deployment. What happens?', o: ['The Deployment is deleted too', 'The ReplicaSet and its Pods are deleted (cascading), then the Deployment controller creates a new ReplicaSet and new Pods', 'The Pods keep running without an owner', 'Nothing: ReplicaSets can’t be deleted'], a: 1, x: 'The garbage collector deletes the ReplicaSet’s Pods (background cascading deletion). The Deployment controller sees no ReplicaSet matching its template and creates one again: a short outage, then self-healing.' },
    { t: 'desired-state', q: 'You remove the <code>app: orders</code> label from one Pod of a ReplicaSet that selects <code>app: orders</code>. What happens?', o: ['The Pod is deleted', 'The ReplicaSet releases it (it keeps running, orphaned) and creates a replacement; a Service selecting app=orders stops sending it traffic', 'The label is put back automatically', 'The ReplicaSet scales down by one'], a: 1, x: 'Selectors define membership. Relabelling is a classic way to take a misbehaving Pod out of rotation and keep it for debugging, while the controller restores the replica count.' },
    // ---------- M1 Workloads ----------
    { t: 'deployments-rollouts', q: '<code>replicas: 10</code>, <code>maxSurge: 25%</code>, <code>maxUnavailable: 25%</code>. During a rollout, what are the maximum total Pods and the minimum available Pods?', o: ['12 and 8', '13 and 8', '13 and 7', '12 and 7'], a: 1, x: 'maxSurge rounds <b>up</b> (2.5 → 3, so up to 13 Pods); maxUnavailable rounds <b>down</b> (2.5 → 2, so at least 8 available).' },
    { t: 'deployments-rollouts', q: 'What does <code>kubectl rollout undo deploy/orders</code> roll back?', o: ['Everything the release changed, including ConfigMaps', 'The Pod template, to the previous ReplicaSet’s; ConfigMaps and Secrets it references are not rolled back', 'The image only', 'The Deployment’s replica count'], a: 1, x: 'Rollback scales the previous ReplicaSet back up and becomes a new revision. Config objects aren’t versioned by the Deployment, which is one reason for immutable, hash-suffixed ConfigMaps.' },
    { t: 'statefulsets-jobs', q: 'StatefulSet with the default <code>OrderedReady</code> policy, 3 replicas; <code>web-1</code> is not Ready. You scale to 5. What happens?', o: ['web-3 and web-4 start immediately', 'Nothing new is created until web-1 is Running and Ready', 'web-1 is deleted and recreated', 'web-4 starts first'], a: 1, x: 'With OrderedReady, each Pod waits for all its predecessors to be Running and Ready. Use <code>podManagementPolicy: Parallel</code> when ordering doesn’t matter.' },
    { t: 'statefulsets-jobs', q: 'A Job with <code>backoffLimit: 3</code> and <code>restartPolicy: Never</code> fails every time. How many Pods are created before the Job is marked Failed?', o: ['3', '4: the first attempt plus 3 retries', '6', 'Unlimited'], a: 1, x: 'backoffLimit counts retries; <code>backoffLimit: 0</code> means a single attempt. Retries are delayed exponentially (10 s, 20 s, 40 s …, capped at 6 minutes).' },
    { t: 'probes', q: 'A liveness probe uses all defaults. Under load, the health endpoint answers in 1.5 s. What happens?', o: ['Nothing: the answer is 200', 'Each attempt times out (default timeoutSeconds 1) and counts as a failure; after 3 in a row the container is restarted', 'The probe waits 1.5 s and passes', 'The Pod becomes unready only'], a: 1, x: 'A slow success is a failure. Healthy-but-busy Pods get restarted at peak load. Use a timeout of 3–5 s for liveness and keep the endpoint cheap.' },
    { t: 'probes', q: 'A startup probe allows 120 s; the app boots in 90 s. When does the liveness probe start running?', o: ['After 120 s', 'As soon as the startup probe succeeds, around 90 s', 'Immediately, in parallel', 'After initialDelaySeconds of the startup probe'], a: 1, x: 'The startup probe’s budget is a maximum, not a fixed delay. Once it succeeds, liveness and readiness take over.' },
    { t: 'resources-qos', q: 'A container requests <code>cpu: 500m, memory: 1Gi</code> with limits <code>cpu: 1, memory: 1Gi</code>. QoS class?', o: ['Guaranteed', 'Burstable', 'BestEffort', 'Guaranteed for memory, Burstable for CPU'], a: 1, x: 'Guaranteed needs requests = limits for <b>both</b> CPU and memory in every container. QoS is one class per Pod.' },
    { t: 'resources-qos', q: 'A container runs at its CPU limit for an hour. What does Kubernetes do?', o: ['OOMKills it', 'Nothing: the kernel throttles it (CFS quota), no restart', 'Evicts the Pod', 'Raises the limit'], a: 1, x: 'CPU is compressible: over-limit means throttling. Memory is not: over-limit means the OOM killer. Throttling shows up as latency, not as restarts.' },
    { t: 'resources-qos', q: 'A node runs low on memory. Which Pods does the kubelet evict first?', o: ['The newest Pods', 'Pods using more than their memory request, by priority and by how far usage exceeds the request (BestEffort first in practice)', 'Guaranteed Pods first', 'Random Pods'], a: 1, x: 'The kubelet ranks by whether usage exceeds requests, then priority, then usage relative to requests. Guaranteed Pods and Pods within their requests go last.' },
    // ---------- M2 Networking ----------
    { t: 'services', q: 'A Service selects <code>app: orders</code>; the Pods are labelled <code>app: order</code>. What do clients see?', o: ['DNS fails', 'DNS resolves the ClusterIP, but there are no endpoints, so connections are refused', 'Traffic goes to random Pods', 'The Service is rejected by the API server'], a: 1, x: 'Services don’t validate selectors. Check <code>kubectl get endpointslices -l kubernetes.io/service-name=orders</code>: no endpoints means a selector or readiness problem.' },
    { t: 'services', q: 'What does a DNS lookup of a headless Service (<code>clusterIP: None</code>) return?', o: ['A virtual IP', 'The A/AAAA records of its ready Pods', 'NXDOMAIN', 'The node IPs'], a: 1, x: 'No virtual IP and no kube-proxy load balancing: clients get Pod IPs and choose themselves. StatefulSets use this for stable per-Pod names like <code>web-0.web.ns.svc</code>.' },
    { t: 'ingress-gateway', q: 'An Ingress in namespace <code>shop</code> references TLS Secret <code>shop-tls</code>, which lives in namespace <code>web</code>. What happens?', o: ['The controller reads it across namespaces', 'The Secret must be in the Ingress’s namespace; the controller falls back to its default certificate', 'The Ingress is rejected', 'TLS is disabled silently but HTTP still works on 443'], a: 1, x: 'Ingress TLS references are namespace-local. Users see a certificate warning (e.g. ingress-nginx’s fake default certificate). Gateway API allows cross-namespace references only with an explicit ReferenceGrant.' },
    { t: 'ingress-gateway', q: 'In Gateway API, which resource does an application team usually own?', o: ['GatewayClass', 'Gateway', 'HTTPRoute', 'The controller Deployment'], a: 2, x: 'The infrastructure provider owns GatewayClass, the platform team owns Gateways (listeners, TLS), and app teams attach HTTPRoutes. That role split is a key difference from Ingress.' },
    { t: 'dns-network-policy', q: 'With the default <code>ndots: 5</code>, a Pod in namespace <code>shop</code> resolves <code>api.stripe.com</code>. What happens first?', o: ['The name is resolved as given', 'The search domains are tried first (api.stripe.com.shop.svc.cluster.local, …svc.cluster.local, …cluster.local), then the name as given', 'Only cluster.local is tried', 'CoreDNS rejects names with fewer than 5 dots'], a: 1, x: 'Fewer than 5 dots → search list first, multiplying DNS queries (A and AAAA each). Use a trailing dot (<code>api.stripe.com.</code>) or lower <code>ndots</code> in <code>dnsConfig</code> for chatty external calls.' },
    { t: 'dns-network-policy', q: 'You add a default-deny <b>egress</b> policy and allow egress to the database on 5432. The app fails with <code>UnknownHostException</code>. Why?', o: ['The database is down', 'DNS (port 53 to kube-dns/CoreDNS) is now blocked too', 'NetworkPolicy doesn’t support TCP', 'Egress policies need a restart'], a: 1, x: 'Every default-deny egress setup needs an explicit allow for UDP and TCP 53 to the DNS Pods. It is the most common NetworkPolicy mistake.' },
    // ---------- M3 Config & storage ----------
    { t: 'configmaps-secrets', q: '<code>kubectl get secret db -o yaml</code> shows <code>password: cGFzc3dvcmQ=</code>. What protection does that encoding give?', o: ['AES encryption', 'None: it is base64, readable by anyone who can read the Secret', 'It is hashed', 'It is encrypted with the node key'], a: 1, x: 'Protection comes from RBAC, encryption at rest in etcd (if configured) and keeping Secrets out of Git. base64 only makes binary data fit into YAML.' },
    { t: 'configmaps-secrets', q: 'A ConfigMap key is mounted as a single file with <code>subPath</code>. You update the ConfigMap. What happens to the file in the running Pod?', o: ['It updates within a minute', 'It never updates until the Pod is recreated', 'The Pod restarts', 'The mount fails'], a: 1, x: 'Whole-volume mounts update eventually (via a symlink swap); <code>subPath</code> mounts are bind mounts of one file and are not updated. Env vars never update either.' },
    { t: 'volumes-storage', q: 'A 3-replica Deployment shares one <code>ReadWriteOnce</code> PVC on block storage. The replicas are on different nodes. What happens?', o: ['All three mount it', 'Only Pods on the node where the volume is attached start; the others hang in ContainerCreating with a Multi-Attach error', 'Kubernetes copies the data', 'The PVC is cloned per Pod'], a: 1, x: 'RWO means one <i>node</i> at a time. Use a StatefulSet with a PVC per replica, or RWX storage (file storage) if replicas really must share files.' },
    { t: 'volumes-storage', q: 'The StorageClass has <code>reclaimPolicy: Delete</code>. You delete the PVC. What happens to the data?', o: ['It is kept on the PV', 'The PV and the underlying disk are deleted', 'It is moved to a snapshot', 'Nothing until the namespace is deleted'], a: 1, x: 'Dynamic provisioning with Delete removes the cloud disk too. Use <code>Retain</code> (or snapshots and backups) for data you can’t lose.' },
    // ---------- M4 Scheduling & scaling ----------
    { t: 'scheduling', q: 'You add a <code>NoSchedule</code> taint to a node. What happens to Pods already running there without a toleration?', o: ['They are evicted', 'Nothing: NoSchedule only affects new scheduling; NoExecute evicts', 'They are restarted', 'They become unready'], a: 1, x: 'Use <code>NoExecute</code> (or a drain) to move existing Pods. NoSchedule is how you reserve nodes without disturbing what runs there.' },
    { t: 'scheduling', q: 'Required pod anti-affinity on <code>kubernetes.io/hostname</code>, 4 replicas, 3 schedulable nodes. Result?', o: ['4 Pods, two sharing a node', '3 Running, 1 Pending', 'The Deployment is rejected', '2 Running'], a: 1, x: '<i>Required</i> rules are hard constraints. Use preferred anti-affinity or topology spread with <code>ScheduleAnyway</code> when you want best effort.' },
    { t: 'autoscaling', q: 'HPA target 50% CPU. 4 replicas average 100% utilisation. Desired replicas (before limits and policies)?', o: ['5', '6', '8', '16'], a: 2, x: 'desired = ceil(current × currentMetric / target) = ceil(4 × 100 / 50) = <b>8</b>, then clamped by maxReplicas and scale-up policies.' },
    { t: 'autoscaling', q: 'After a traffic spike ends, the HPA keeps the extra replicas for several minutes. Why?', o: ['metrics-server is lagging', 'The default scale-down stabilization window is 300 s: it uses the highest recommendation of the last 5 minutes', 'Pods can’t be removed while busy', 'The Cluster Autoscaler blocks it'], a: 1, x: 'Scale-down is deliberately slow to avoid flapping. Tune <code>behavior.scaleDown.stabilizationWindowSeconds</code> if your load really drops that fast.' },
    { t: 'disruptions-pdb', q: 'A PDB says <code>maxUnavailable: 0</code>. Does it stop a Deployment rolling update from taking Pods down?', o: ['Yes, the rollout waits', 'No: rollouts use the Deployment’s own maxUnavailable/maxSurge; PDBs only apply to evictions (drains, autoscaler)', 'Only for StatefulSets', 'Yes, but only with kubectl'], a: 1, x: 'PDBs guard the eviction API. Deletes, rollouts and node crashes bypass them. A <code>maxUnavailable: 0</code> PDB does, however, block every drain.' },
    { t: 'disruptions-pdb', q: 'A Pod is deleted during scale-down; the app exits on SIGTERM at once. Some requests still fail. Why?', o: ['The PDB was missing', 'Endpoint removal and SIGTERM happen in parallel; proxies and ingresses still route to the Pod for a moment after it stopped listening', 'SIGTERM drops packets', 'The readiness probe was too slow'], a: 1, x: 'Fix with a short preStop sleep (keep serving while routing converges), then graceful shutdown, within <code>terminationGracePeriodSeconds</code>.' },
    // ---------- M5 Security & operations ----------
    { t: 'rbac-security', q: 'A ServiceAccount can <code>get</code> and <code>list</code> pods, but <code>kubectl logs</code> as that SA returns Forbidden. Why?', o: ['Logs need cluster-admin', 'Logs are the subresource <code>pods/log</code>, which needs its own rule', 'The token expired', 'Logs are only readable from the node'], a: 1, x: 'Subresources are separate in RBAC: <code>pods/log</code>, <code>pods/exec</code>, <code>pods/portforward</code>, <code>deployments/scale</code>, <code>*/status</code>. Grant exactly the ones needed.' },
    { t: 'rbac-security', q: 'Which of these is <b>not</b> required by the Pod Security <code>restricted</code> standard?', o: ['runAsNonRoot: true', 'capabilities drop ALL', 'seccompProfile RuntimeDefault (or Localhost)', 'readOnlyRootFilesystem: true'], a: 3, x: 'A read-only root filesystem is good practice but not part of <code>restricted</code>. The others, plus <code>allowPrivilegeEscalation: false</code>, are.' },
    { t: 'debugging', q: 'A Pod has shown <code>ContainerCreating</code> for 10 minutes. Events: <code>FailedMount … secret "db-creds" not found</code>. What is going on?', o: ['The image is still pulling', 'The Pod is scheduled; the kubelet can’t mount a Secret volume that doesn’t exist and keeps retrying', 'The scheduler can’t find a node', 'The app is crashing'], a: 1, x: 'Scheduled (nodeName set) but stuck in the kubelet. Create the Secret (or fix its name) and the mount succeeds on the next retry. A missing Secret referenced from env vars shows <code>CreateContainerConfigError</code> instead.' },
    { t: 'debugging', q: 'Events show <code>Killing: container app failed liveness probe</code>, then the container ends with exit code 137 and no OOMKilled reason. Meaning?', o: ['Out of memory', 'The kubelet sent SIGTERM, the app didn’t exit within the grace period, and it was SIGKILLed', 'The image is broken', 'The node rebooted'], a: 1, x: '137 = SIGKILL. With a probe kill and no OOMKilled reason, the app ignored or outlasted SIGTERM. Check the ENTRYPOINT (exec form) and shutdown hooks.' },
    { t: 'observability', q: '<code>kubectl top</code> shows 900Mi for a JVM Pod; the JVM reports 400Mi of heap used. Why the difference?', o: ['metrics-server is wrong', 'The container working set includes the whole committed heap, metaspace, threads, code cache, native memory and active page cache', 'kubectl top shows the limit', 'The JVM under-reports'], a: 1, x: 'Container metrics see the process from outside. Compare with <code>jcmd 1 VM.native_memory summary</code> to see where the non-heap memory goes.' },
    { t: 'observability', q: 'Where does an HPA on CPU utilisation get its numbers by default?', o: ['Prometheus', 'The <code>metrics.k8s.io</code> Metrics API, served by metrics-server', 'The kubelet logs', 'kube-state-metrics'], a: 1, x: 'Resource metrics come from metrics-server. Custom and external metrics (for example from Prometheus or KEDA) need an adapter serving <code>custom.metrics.k8s.io</code> / <code>external.metrics.k8s.io</code>.' },
    { t: 'helm-kustomize-gitops', q: 'A Kustomize strategic-merge patch sets the memory limit of container <code>app</code>. The Pod also has a <code>proxy</code> container. What happens to it?', o: ['It is removed: lists are replaced', 'It is kept: strategic merge matches containers by name', 'Its limit is changed too', 'Kustomize fails'], a: 1, x: 'Strategic merge patches know Kubernetes list keys (containers by <code>name</code>). Helm values merging is different: lists there are replaced wholesale.' },
    { t: 'helm-kustomize-gitops', q: 'Argo CD automated sync with <code>prune: false</code> (the default). You remove a ConfigMap’s manifest from Git. What happens?', o: ['The ConfigMap is deleted', 'It stays in the cluster; the app shows OutOfSync with the resource marked for pruning', 'Argo CD recreates it', 'The sync fails'], a: 1, x: 'Pruning is opt-in for safety. Enable <code>prune: true</code> to delete removed objects, and protect stateful ones with <code>Prune=false</code> annotations.' },
    { t: 'operators-crds', q: 'You delete a CRD while 20 custom resources of that kind exist. What happens to them?', o: ['They become orphaned but stay readable', 'They are all deleted with the CRD (their finalizers still have to complete first)', 'The deletion is rejected', 'They are converted to ConfigMaps'], a: 1, x: 'Deleting a CRD deletes every instance. This is why Helm never deletes CRDs from <code>crds/</code>, and why you should guard CRDs in GitOps.' },
    { t: 'operators-crds', q: 'A mutating webhook injects a sidecar; a validating webhook rejects Pods without one. In what order do they run?', o: ['Validating first', 'Mutating first, then schema validation, then validating webhooks', 'In parallel', 'Alphabetically by name'], a: 1, x: 'Mutation must finish before validation, so validators see the final object. Mutating webhooks may be re-invoked if a later mutation changes the object (<code>reinvocationPolicy</code>).' },
    { t: 'jvm-on-k8s', q: 'A JVM runs with <code>-Xmx2g</code> in a container with <code>limits.memory: 2Gi</code>. What happens under sustained load?', o: ['Fine: the heap fits exactly', 'OOMKilled (exit 137) once the heap fills, because non-heap memory has no room left', 'OutOfMemoryError at 1.5 GiB', 'The JVM refuses to start'], a: 1, x: 'Metaspace, thread stacks, code cache, GC structures and native memory live outside the heap. Use <code>-XX:MaxRAMPercentage</code> (about 70–75 at 2Gi) instead.' },
    { t: 'jvm-on-k8s', q: 'The Dockerfile says <code>ENTRYPOINT java -jar /app.jar</code> (shell form, no brackets). The Pod is deleted. What happens?', o: ['Graceful shutdown', 'The command runs under <code>/bin/sh -c</code>, which is PID 1 and doesn’t pass SIGTERM on; the JVM is SIGKILLed after the grace period', 'Kubernetes signals every process in the container', 'The container exits with 0'], a: 1, x: 'Use the exec form <code>ENTRYPOINT ["java", "-jar", "/app.jar"]</code> so the JVM is PID 1 and receives SIGTERM, and pass options via <code>JAVA_TOOL_OPTIONS</code>.' },
    { t: 'jvm-on-k8s', q: 'preStop sleep 15 s, Spring <code>timeout-per-shutdown-phase: 30s</code>, <code>terminationGracePeriodSeconds</code> left at its default. What is the risk?', o: ['None', 'The default grace is 30 s and includes the preStop, so Spring gets only 15 s to drain before SIGKILL', 'The preStop is skipped', 'Spring ignores the timeout'], a: 1, x: 'Budget grace ≥ preStop + drain timeout + margin, here at least 50 s.' },
    { t: 'multi-tenancy-cost', q: 'A namespace quota has <code>pods: "10"</code>. 10 Pods of a finished Job (Succeeded) are still listed. Can a new Pod be created?', o: ['No: 10 Pods exist', 'Yes: quota counts only Pods in a non-terminal phase', 'Only after the Job is deleted', 'Only BestEffort Pods'], a: 1, x: 'Compute and Pod-count quotas cover non-terminal Pods. Finished Pods still clutter the namespace, so set <code>ttlSecondsAfterFinished</code> on Jobs.' },
    { t: 'multi-tenancy-cost', q: 'No NetworkPolicies exist. Can a Pod in namespace <code>team-a</code> call a Service in namespace <code>team-b</code>?', o: ['No: namespaces isolate traffic', 'Yes: by default all Pods can reach each other across namespaces', 'Only with a ClusterRoleBinding', 'Only through an Ingress'], a: 1, x: 'Namespaces scope names and RBAC, not traffic. Tenant isolation needs default-deny NetworkPolicies (and a CNI that enforces them).' },
    { t: 'cluster-upgrades', q: 'The API servers run 1.31. What is the oldest supported kubelet?', o: ['1.30', '1.29', '1.28', '1.27'], a: 2, x: 'Kubelets may be up to three minors older (since 1.28) and never newer. 1.31 − 3 = <b>1.28</b>.' },
    { t: 'cluster-upgrades', q: 'An upgrade removes <code>policy/v1beta1</code> PodDisruptionBudget. What happens to PDBs created with that version?', o: ['They are deleted', 'They keep working and are served as <code>policy/v1</code>; manifests and charts that still use v1beta1 fail to apply', 'They stop being enforced', 'The upgrade is refused'], a: 1, x: 'API removal affects clients, not stored objects. Helm releases that stored the old version need <code>helm mapkubeapis</code>.' }
  ];
  /*Q-END*/
  const LABEL = {
    'containers-vs-vms': 'Containers vs VMs', architecture: 'Architecture', pods: 'Pods', 'desired-state': 'Desired state',
    'deployments-rollouts': 'Deployments', 'statefulsets-jobs': 'StatefulSets & Jobs', probes: 'Probes', 'resources-qos': 'Requests & QoS',
    services: 'Services', 'ingress-gateway': 'Ingress & Gateway', 'dns-network-policy': 'DNS & NetworkPolicy',
    'configmaps-secrets': 'ConfigMaps & Secrets', 'volumes-storage': 'Volumes & PVCs',
    scheduling: 'Scheduling', autoscaling: 'Autoscaling', 'disruptions-pdb': 'Disruptions & PDBs',
    'rbac-security': 'RBAC & security', debugging: 'Debugging', observability: 'Observability', 'helm-kustomize-gitops': 'Helm & GitOps',
    'operators-crds': 'Operators & CRDs', 'jvm-on-k8s': 'JVM on K8s', 'multi-tenancy-cost': 'Quotas & cost', 'cluster-upgrades': 'Upgrades'
  };
  const MODS = [
    ['All', null], ['Foundations', ['containers-vs-vms', 'architecture', 'pods', 'desired-state']],
    ['Workloads', ['deployments-rollouts', 'statefulsets-jobs', 'probes', 'resources-qos']],
    ['Networking', ['services', 'ingress-gateway', 'dns-network-policy']],
    ['Config & storage', ['configmaps-secrets', 'volumes-storage']],
    ['Scheduling & scaling', ['scheduling', 'autoscaling', 'disruptions-pdb']],
    ['Security & ops', ['rbac-security', 'debugging', 'observability', 'helm-kustomize-gitops', 'operators-crds', 'jvm-on-k8s', 'multi-tenancy-cost', 'cluster-upgrades']]
  ];
  const lab = (t) => LABEL[t] || t;
  const link = (t) => `<a href="${t}.html">${lab(t)}</a>`;
  if (!document.getElementById('w-tk8-style')) {
    document.head.append(el('style', { id: 'w-tk8-style', text: `
.w-tk8-bar { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; margin: 8px 0; }
.w-tk8-bar div { height: 100%; background: var(--accent); }
.w-tk8-bar div.low { background: var(--err); }
.w-tk8-opts { display: grid; gap: 6px; margin-top: 10px; }
.w-tk8-opts button { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 9px; padding: 9px 12px; font-size: 14px; cursor: pointer; overflow-wrap: anywhere; }
.w-tk8-opts button:hover:not(:disabled) { border-color: var(--accent); }
.w-tk8-opts button.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 15%, transparent); }
.w-tk8-opts button.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 15%, transparent); }
.w-tk8-opts button:disabled { cursor: default; }
.w-tk8-q { font-size: 16px; margin: 6px 0 8px; }
.w-tk8-rev { border-top: 1px solid var(--border); padding: 10px 0; }
.w-tk8-rev:first-child { border-top: 0; }
.w-tk8-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 6px; margin-top: 8px; }
.w-tk8-grid .w-stat.low b { color: var(--err); } .w-tk8-grid .w-stat.full b { color: var(--ok); }
` }));
  }
  let mod = 'All'; let count = 10; let secs = 60; let gen = 0; let deck = []; let i = 0; let score = 0; let misses = []; let left = 0; let answered = false; let started = false; let tick = null;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg(MODS.map(([m]) => [m, m]), () => mod, (v) => { mod = v; reset(); }, 'Module');
  const segN = seg([[10, '10 questions'], [25, '25'], [50, 'all 50']], () => count, (v) => { count = v; reset(); }, 'Number of questions');
  const segS = seg([[90, 'Slow · 90 s'], [60, 'Normal · 60 s'], [30, 'Fast · 30 s']], () => secs, (v) => { secs = v; reset(); }, 'Time per question');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Start' }); const bStep = el('button', { class: 'btn', text: 'Skip ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const card = el('div', { class: 'card', style: { padding: '14px', marginTop: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-controls' }, segN, el('span', { class: 'tiny', text: 'time per question' }), segS),
    el('div', { class: 'w-controls' }, bPlay, bStep, bReset), stats, card, narr);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function shuffle(a) { const r = a.slice(); for (let j = r.length - 1; j > 0; j--) { const m = Math.floor(Math.random() * (j + 1)); [r[j], r[m]] = [r[m], r[j]]; } return r; }
  function renderStats() { stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `question <b>${Math.min(i + 1, deck.length)}</b>/${deck.length}` }), el('span', { class: 'w-stat', html: `score <b>${score}</b>` }), el('span', { class: 'w-stat', html: `missed <b>${misses.length}</b>` }), el('span', { class: 'w-stat', html: `time <b>${started && !answered ? left + ' s' : '–'}</b>` })); }
  function stopTimer() { if (tick) { clearInterval(tick); tick = null; } }
  function show() {
    const q = deck[i]; answered = false; left = secs; card.innerHTML = '';
    const bar = el('div'); const barWrap = el('div', { class: 'w-tk8-bar' }, bar);
    const opts = el('div', { class: 'w-tk8-opts' });
    card.append(el('div', { class: 'w-controls', style: { marginBottom: '0' } }, el('span', { class: 'pill accent', text: lab(q.t) }), el('span', { class: 'tiny', text: `#${i + 1}` })), barWrap, el('div', { class: 'w-tk8-q', html: q.q }));
    if (q.code) card.append(ctx.codeBox(q.code, q.l || 'yaml'));
    q.o.forEach((o, j) => { const b = el('button', { html: `<b>${'ABCD'[j]}.</b> ${o}` }); b.addEventListener('click', () => answer(j)); opts.append(b); });
    card.append(opts);
    const paint = () => { bar.style.width = (left / secs) * 100 + '%'; bar.className = left <= 10 ? 'low' : ''; if (!reduced) bar.style.transition = 'width 1s linear'; };
    paint(); renderStats(); say('Pick an answer before the bar runs out. Skip counts as a miss.');
    stopTimer(); const g = gen;
    tick = setInterval(() => { if (g !== gen || answered) { stopTimer(); return; } left--; paint(); renderStats(); if (left <= 0) answer(-1); }, 1000);
    card.opts = opts;
  }
  function answer(j) {
    if (answered || !started) return; answered = true; stopTimer();
    const q = deck[i]; const ok = j === q.a;
    if (ok) score++; else misses.push({ q, j });
    [...card.opts.children].forEach((b, m) => { b.disabled = true; if (m === q.a) b.classList.add('ok'); else if (m === j) b.classList.add('bad'); });
    card.append(el('div', { class: 'pz-exp', html: (j === -1 ? '<b>Time’s up.</b> ' : j === -2 ? '<b>Skipped.</b> ' : ok ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.x + ` <span class="tiny">More: ${link(q.t)}</span>` }));
    bStep.textContent = i + 1 < deck.length ? 'Next ›' : 'Finish ›'; renderStats();
    say(ok ? 'Correct. Press Next.' : 'Read the explanation, then press Next.');
  }
  function next() {
    if (!started) return;
    if (!answered) { answer(-2); return; }
    i++; bStep.textContent = 'Skip ›';
    if (i >= deck.length) return finish();
    show();
  }
  function finish() {
    started = false; stopTimer(); bStep.disabled = true; bPlay.textContent = '▶ Again'; card.innerHTML = '';
    const by = {}; deck.forEach((q) => { by[q.t] = by[q.t] || [0, 0]; by[q.t][1]++; }); deck.forEach((q) => { if (!misses.some((m) => m.q === q)) by[q.t][0]++; });
    const order = Object.keys(LABEL).filter((t) => by[t]);
    card.append(el('h3', { text: `Score: ${score} / ${deck.length}`, style: { margin: '0 0 8px' } }),
      el('div', { class: 'tiny', text: 'Per topic (click a topic to open its page):' }),
      el('div', { class: 'w-tk8-grid' }, order.map((t) => { const [a, n] = by[t]; return el('span', { class: 'w-stat' + (a === n ? ' full' : a / n < 0.5 ? ' low' : ''), html: `${link(t)} <b>${a}/${n}</b>` }); })));
    if (misses.length) {
      card.append(el('h4', { text: 'Review your misses', style: { margin: '14px 0 4px' } }));
      misses.forEach(({ q, j }) => { const r = el('div', { class: 'w-tk8-rev' }, el('div', { html: `<span class="pill">${lab(q.t)}</span> ${q.q}` }));
        if (q.code) r.append(ctx.codeBox(q.code, q.l || 'yaml'));
        r.append(el('div', { class: 'tiny', html: `You: ${j < 0 ? (j === -1 ? 'time ran out' : 'skipped') : q.o[j]} · Correct: <b>${q.o[q.a]}</b>` }), el('div', { class: 'pz-exp', html: q.x + ` <b>Revise:</b> ${link(q.t)}` }));
        card.append(r); });
    } else card.append(el('p', { text: 'No misses. Try “all 50” on Fast.' }));
    renderStats(); say(`Done: ${score}/${deck.length}. ` + (misses.length ? 'Your misses are listed above, each with a link to the topic page.' : ''));
  }
  function reset() {
    gen++; stopTimer(); started = false; answered = false; i = 0; score = 0; misses = [];
    const M = MODS.find(([m]) => m === mod)[1];
    const pool = Q.filter((q) => !M || M.includes(q.t));
    // shuffle the questions, and the options within each question (the answer moves with its option)
    deck = shuffle(pool).slice(0, count).map((q) => { const idx = shuffle(q.o.map((_, n) => n)); return Object.assign({}, q, { o: idx.map((n) => q.o[n]), a: idx.indexOf(q.a) }); });
    bPlay.textContent = '▶ Start'; bStep.textContent = 'Skip ›'; bStep.disabled = true; card.innerHTML = '';
    card.append(el('p', { html: `<b>${deck.length}</b> question${deck.length === 1 ? '' : 's'} (${mod === 'All' ? 'all modules' : mod}), <b>${secs} s</b> each. No cluster needed: reason it out, as in an interview.`, style: { margin: 0 } }));
    renderStats(); say('Choose a module, how many questions and the time limit, then press Start.');
  }
  bPlay.addEventListener('click', () => { reset(); started = true; bStep.disabled = false; bPlay.textContent = '↻ Restart'; show(); });
  bStep.addEventListener('click', next);
  bReset.addEventListener('click', reset);
  reset();
});

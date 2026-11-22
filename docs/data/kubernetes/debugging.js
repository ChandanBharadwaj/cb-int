IA.register({
  track: 'kubernetes',
  slug: 'debugging',
  title: 'Debugging workloads',
  tagline: 'Every broken Pod tells you which layer failed: the <b>scheduler</b> (Pending), the <b>registry</b> (ImagePullBackOff), your <b>process</b> (CrashLoopBackOff, OOMKilled) or your <b>probes</b> (Running 0/1). Read the STATUS column, then go to the one place that holds the evidence for that layer.',
  tldr: {
    problem: 'At 3 a.m. people run <code>kubectl logs</code> on a Pod that never started, restart things at random, or wait on a CrashLoopBackOff that is just the kubelet pausing. The evidence was in an Event that expired an hour later.',
    model: 'Status → evidence → cause. <b>Pending</b>: scheduler Events (<code>FailedScheduling</code>). <b>ImagePullBackOff</b>: kubelet Events (registry answer). <b>CrashLoopBackOff</b>: <code>logs --previous</code> plus the last exit code. <b>OOMKilled / 137</b>: Last State and memory limit. <b>Running 0/1</b>: probe Events, then test from inside with <code>kubectl debug</code>.',
    hook: '“CrashLoopBackOff: what does it mean?” The container keeps exiting, and the kubelet is <i>waiting</i> before the next restart: 10 s, doubling up to 5 minutes. The cause is in the previous container’s logs and exit code, not in the status.',
    facts: [
      { v: '10 s → 5 min', l: 'restart back-off: starts at 10 s, doubles, caps at 300 s, and resets after the container runs cleanly for 10 minutes' },
      { v: '137', l: '= 128 + 9 (SIGKILL). With reason OOMKilled it was the memory limit; without, a kill after the grace period. 143 = SIGTERM' },
      { v: '1 h', l: 'default Event retention (<code>kube-apiserver --event-ttl</code>). After that the reason is gone unless you export Events' }
    ]
  },
  intro: {
    what: 'When a Pod misbehaves, Kubernetes has already written down why, but in different places. The <b>scheduler</b> and <b>kubelet</b> record <b>Events</b> (short messages attached to the Pod). Your app writes <b>logs</b> to stdout, which the kubelet keeps per container, including the one before the last restart. The Pod’s <b>status</b> records each container’s state, exit code and reason. Debugging is mostly knowing which of the three to read.',
    analogy: { icon: '🩺', title: 'A triage nurse', text: 'A nurse doesn’t run every test on every patient. Temperature and pulse (the STATUS column) decide which department you go to. Then a specific test there (Events, previous logs, exit code) finds the cause. Running random tests (restarting Pods) wastes the evidence.' },
    steps: [
      { t: 'Look at the summary', d: 'STATUS, READY and RESTARTS tell you the branch.', code: 'kubectl get pods -n shop -o wide', lang: 'bash' },
      { t: 'Read the Events', d: 'Scheduling, pulling, probe failures and kills all show up at the bottom of describe.', code: 'kubectl describe pod orders-5b8d7c6f9-k2m4n -n shop', lang: 'bash' },
      { t: 'Read the previous container’s log', d: 'After a restart, the current container is new. <code>--previous</code> shows the one that died.', code: 'kubectl logs orders-5b8d7c6f9-k2m4n -n shop --previous', lang: 'bash' },
      { t: 'Get a shell next to it', d: 'Minimal images have no shell. An ephemeral debug container brings its own tools into the Pod.', code: 'kubectl debug -it orders-5b8d7c6f9-k2m4n -n shop \\\n  --image=busybox:1.36 --target=app -- sh', lang: 'bash' }
    ],
    terms: [
      ['Event', 'A short record (reason, message, count) the control plane attaches to an object. Kept for about an hour by default.'],
      ['Pending', 'The Pod phase before all containers have started. Unscheduled Pods stay here; so do Pods pulling images.'],
      ['CrashLoopBackOff', 'Not a crash itself: the kubelet is waiting before restarting a container that keeps exiting.'],
      ['exit code', 'The process’s exit status. 128 + N means it was killed by signal N (137 = SIGKILL, 143 = SIGTERM).'],
      ['ephemeral container', 'A temporary container added to a running Pod for debugging (GA in 1.25). It shares the Pod’s network and can target a container’s processes.'],
      ['--previous', 'Flag for <code>kubectl logs</code> that shows the log of the container instance before the last restart.']
    ]
  },
  visual: {
    title: 'The debugging decision tree',
    caption: 'Pick a symptom and press Play (or Step). The tree goes from the STATUS column to the evidence and the usual causes, and the terminal shows the commands and output at each step. For CrashLoopBackOff, watch the restart back-off grow on the timeline.'
  },
  gotchas: [
    { trap: '<code>kubectl logs</code> shows nothing useful after a crash', code: `kubectl logs orders-5b8d7c6f9-k2m4n            # new container: 2 lines of banner
kubectl logs orders-5b8d7c6f9-k2m4n --previous # the one that died: the stack trace`, lang: 'bash', why: 'After a restart, <code>kubectl logs</code> reads the <i>current</i> container, which may have only just started. The kubelet keeps the log of one previous instance.', fix: 'Use <code>--previous</code> (<code>-p</code>). Set <code>terminationMessagePolicy: FallbackToLogsOnError</code> so the last log lines also appear in <code>describe</code> under the container’s termination message.' },
    { trap: 'Waiting for Events that already expired', why: 'Events are kept for one hour by default and are deduplicated (a <code>count</code> and last timestamp). The <code>FailedScheduling</code> or <code>Killing</code> event from last night is gone by the morning stand-up.', fix: 'Export Events to your log system (an event exporter, or your logging agent’s Kubernetes events input). Sort live ones by time: <code>kubectl get events --sort-by=.lastTimestamp</code>, or <code>kubectl events --for pod/&lt;name&gt;</code> in recent kubectl.' },
    { trap: 'Exit code 137 is not always OOM', why: '137 means SIGKILL. The memory limit (reason <code>OOMKilled</code>) is one source. Others: the kubelet killing a container that didn’t stop within <code>terminationGracePeriodSeconds</code> after a liveness failure or deletion, or the node-level OOM killer under memory pressure.', fix: 'Read <code>lastState.terminated.reason</code> and the Events together. <code>Killing … failed liveness probe</code> before a 137 points at probes; <code>OOMKilled</code> points at memory sizing.' },
    { trap: 'The STATUS column is not the Pod phase', why: '<code>ContainerCreating</code>, <code>Init:0/2</code>, <code>Init:CrashLoopBackOff</code>, <code>Terminating</code> and <code>CreateContainerConfigError</code> are computed by kubectl from container states. The phase is only Pending, Running, Succeeded, Failed or Unknown. A Pod in <code>ContainerCreating</code> is scheduled and stuck in the kubelet, often on a volume mount or a missing Secret, which is a different problem from an unscheduled Pending Pod.', fix: 'Check <code>spec.nodeName</code>: empty means a scheduling problem; set means a node or kubelet problem (look for <code>FailedMount</code>, <code>FailedCreatePodSandBox</code>).' },
    { trap: '<code>kubectl exec</code> into a distroless or Jib image', code: `kubectl exec -it orders-5b8 -- sh
# OCI runtime exec failed: exec: "sh": executable file not found in $PATH`, lang: 'bash', why: 'Minimal images have no shell, curl or ps, on purpose. Adding them back for debugging enlarges the attack surface of every production Pod.', fix: 'Use <code>kubectl debug -it &lt;pod&gt; --image=&lt;tools&gt; --target=&lt;container&gt;</code>. It shares the network namespace (localhost reaches the app) and, with <code>--target</code>, the process namespace when the runtime supports it. Or use <code>--copy-to</code> to debug a copy with a different command.' },
    { trap: 'A Deployment with zero Pods has nothing to describe', why: 'If quota, Pod Security, an admission webhook or a missing ServiceAccount rejects Pod creation, no Pod object exists. The error is recorded on the ReplicaSet (<code>FailedCreate</code>), not on the Deployment.', fix: '<code>kubectl describe rs -l app=&lt;name&gt;</code>, and check the Deployment conditions: <code>ReplicaFailure</code> and <code>ProgressDeadlineExceeded</code> appear in <code>kubectl get deploy -o yaml</code>.' },
    { trap: 'Force-deleting a Pod stuck in Terminating', why: '<code>kubectl delete pod --force --grace-period=0</code> removes the object from the API, but if the node is only partitioned the container may still be running. For a StatefulSet that means two Pods with the same identity writing to the same volume.', fix: 'Find out why it is stuck first: a finalizer on the Pod, or an unreachable node. Force-delete StatefulSet Pods only when you know the node is down (or after it is removed from the cluster).' }
  ],
  scenarios: [
    { title: 'A rollout hangs at “1 of 4 updated replicas”',
      symptom: 'CI reports <code>error: deployment "orders" exceeded its progress deadline</code>. Users see no errors: the old Pods are still serving. The new Pod has restarted 7 times.',
      diagnoseLang: 'bash',
      diagnose: `kubectl rollout status deploy/orders -n shop
kubectl get rs -n shop -l app=orders     # new RS: 1 desired, 0 ready; old RS: 3 ready
kubectl logs -n shop -l app=orders,pod-template-hash=5b8d7c6f9 --previous | tail -5
#  Caused by: org.flywaydb.core.api.FlywayException:
#  Validate failed: Migrations have failed validation
kubectl get pod -n shop -l pod-template-hash=5b8d7c6f9 \\
  -o jsonpath='{.items[0].status.containerStatuses[0].lastState.terminated.exitCode}'   # 1`,
      cause: 'A migration file that had already run was edited, so Flyway’s checksum validation fails on boot. With <code>maxUnavailable: 0</code> the rollout keeps the old Pods and waits forever for the new one; after <code>progressDeadlineSeconds</code> (600 s by default) the Deployment is marked as failed but is <i>not</i> rolled back automatically.',
      fix: 'Roll back right away, then fix the migration (never edit an applied migration; add a new one). Make CI fail on <code>rollout status</code> and roll back automatically.',
      fixCode: `kubectl rollout undo deploy/orders -n shop
kubectl rollout status deploy/orders -n shop --timeout=5m

# CI step
kubectl rollout status deploy/orders -n shop --timeout=10m || {
  kubectl rollout undo deploy/orders -n shop; exit 1; }`,
      fixLang: 'bash' },
    { title: 'A StatefulSet Pod stays Pending after a node replacement',
      symptom: 'After a node pool upgrade, <code>postgres-1</code> has been Pending for 40 minutes. The cluster has plenty of free CPU and memory.',
      diagnoseLang: 'bash',
      diagnose: `kubectl describe pod postgres-1 -n data | grep -A2 FailedScheduling
#  0/6 nodes are available: 2 Insufficient memory,
#  4 node(s) had volume node affinity conflict.
kubectl get pv $(kubectl get pvc data-postgres-1 -n data -o jsonpath='{.spec.volumeName}') \\
  -o jsonpath='{.spec.nodeAffinity}'
#  ... topology.kubernetes.io/zone In [eu-west-1a]`,
      cause: 'The Pod’s PersistentVolume is a zonal disk in <code>eu-west-1a</code>. The new node pool has only two nodes in that zone, and both are full. The free nodes are in other zones, where the disk can’t be attached.',
      fix: 'Add capacity in the volume’s zone (a node group per zone, so the autoscaler can scale the right one), and keep headroom there. Use <code>volumeBindingMode: WaitForFirstConsumer</code> on StorageClasses so new volumes are created where the Pod is scheduled.',
      fixCode: `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata: { name: ssd }
provisioner: ebs.csi.aws.com
volumeBindingMode: WaitForFirstConsumer   # create the disk in the Pod's zone
allowVolumeExpansion: true
reclaimPolicy: Retain` },
    { title: 'Pods evicted one after another on the same node',
      symptom: 'Several Pods on <code>node-4</code> show STATUS <code>Evicted</code> or <code>ContainerStatusUnknown</code>, and their replacements land on other nodes. No OOMKilled anywhere.',
      diagnoseLang: 'bash',
      diagnose: `kubectl get pods -A --field-selector=status.phase=Failed -o wide | grep node-4
kubectl get pod reports-6f9d-abc -n bi -o jsonpath='{.status.message}'
#  The node was low on resource: ephemeral-storage. Threshold quantity: 10%,
#  available: 8%. Container app was using 31Gi, which exceeds its request of 0.
kubectl describe node node-4 | grep -i pressure    # DiskPressure True`,
      cause: 'A reporting service wrote temporary CSV exports to its container filesystem (and debug logs to a file) without an <code>ephemeral-storage</code> request or limit. When the node’s disk crossed the eviction threshold, the kubelet evicted Pods, starting with the ones using most above their request.',
      fix: 'Set ephemeral-storage requests and limits, put scratch data on an <code>emptyDir</code> with <code>sizeLimit</code>, and log to stdout only. Clean up the evicted Pod objects; the ReplicaSet has already replaced them.',
      fixCode: `resources:
  requests: { cpu: 500m, memory: 1Gi, ephemeral-storage: 2Gi }
  limits:   { memory: 1Gi, ephemeral-storage: 4Gi }
volumeMounts:
- { name: scratch, mountPath: /work }
volumes:
- name: scratch
  emptyDir: { sizeLimit: 3Gi }` }
  ],
  puzzles: [
    { kind: 'scenario', q: 'A container has crashed 6 times in a row, each time within seconds of starting. Roughly how long does the kubelet wait before the next start?', options: ['About 5 minutes (the cap)', '10 s', '80 s', 'It stops restarting after 5 crashes'], answer: 0, explain: 'The delay doubles from 10 s: 10, 20, 40, 80, 160, then it is capped at 300 s. With <code>restartPolicy: Always</code> the kubelet never gives up; it just waits up to 5 minutes between attempts.' },
    { kind: 'scenario', q: 'A Pod is Pending. <code>kubectl describe</code> shows <b>no Events at all</b>, and <code>spec.nodeName</code> is empty. What is the most likely cause?', options: ['Not enough CPU in the cluster', 'The image doesn’t exist', '<code>spec.schedulerName</code> names a scheduler that isn’t running, so nobody even tries to schedule it', 'The readiness probe fails'], answer: 2, explain: 'Insufficient resources would produce a <code>FailedScheduling</code> event. No events at all means no scheduler picked the Pod up: a custom <code>schedulerName</code> with no running scheduler, or the default scheduler itself down.' },
    { kind: 'concept', q: 'What does exit code 143 tell you?', options: ['The memory limit was hit', 'The image entrypoint was not found', 'The node rebooted', 'The process exited after SIGTERM (128 + 15): a normal stop, from a deletion, rollout or a liveness kill it handled'], answer: 3, explain: '128 + signal number. 15 is SIGTERM. A JVM that exits on SIGTERM reports 143. A 137 (SIGKILL) after a liveness failure means the app didn’t stop within the grace period.' },
    { kind: 'scenario', q: 'An <code>ImagePullBackOff</code> Pod has been stuck for 20 minutes. What is its RESTARTS count?', options: ['About 10', '0', '1', 'It depends on restartPolicy'], answer: 1, explain: 'Restarts count container restarts, and no container has ever run. The kubelet backs off the <i>pull</i> (up to 5 minutes between tries), not a container.' },
    { kind: 'scenario', q: 'A Deployment shows <code>READY 0/3</code> and <code>kubectl get pods -l app=orders</code> returns nothing. Where is the error?', options: ['In the Deployment’s logs', 'In the scheduler’s logs', 'In the ReplicaSet’s Events (FailedCreate: quota, Pod Security, webhook, missing ServiceAccount)', 'In etcd'], answer: 2, explain: 'The ReplicaSet controller creates the Pods. When the API server rejects the create, it records <code>FailedCreate</code> on the ReplicaSet; the Deployment only shows a <code>ReplicaFailure</code> condition.' },
    { kind: 'concept', q: 'You run <code>kubectl debug node/node-3 -it --image=busybox:1.36</code>. Where is the node’s root filesystem?', options: ['Mounted at <code>/host</code>', 'At <code>/</code>', 'Not accessible', 'At <code>/var/lib/kubelet</code>'], answer: 0, explain: 'Node debugging creates a Pod on that node in the host’s namespaces with the node’s filesystem mounted at <code>/host</code>. <code>chroot /host</code> gives you a shell as if on the node. Delete the debug Pod afterwards.' },
    { kind: 'scenario', q: 'STATUS says <code>CreateContainerConfigError</code>. Which is the most likely cause?', options: ['The app throws on startup', 'The node is out of memory', 'The image tag doesn’t exist', 'A referenced Secret/ConfigMap or key is missing, or runAsNonRoot can’t be verified'], answer: 3, explain: 'The kubelet couldn’t build the container’s configuration, so it never started. The Event names the missing object or key (<code>secret "db" not found</code>, <code>couldn’t find key url in Secret</code>).' },
    { kind: 'concept', q: 'You added an ephemeral container to debug a Pod. How do you remove it afterwards?', options: ['<code>kubectl debug --remove</code>', 'You can’t: ephemeral containers stay in the Pod spec until the Pod is deleted', '<code>kubectl delete container</code>', 'It is removed when the shell exits, along with its spec entry'], answer: 1, explain: 'Ephemeral containers are added through the <code>ephemeralcontainers</code> subresource and can’t be removed or restarted. When your shell exits, the container stops, but its entry stays. The Pod is replaced at the next rollout anyway.' }
  ],
  interview: [
    { q: 'A Pod is in CrashLoopBackOff. Walk me through your steps.', a: '<ol><li><code>kubectl describe pod</code>: Last State (exit code, reason), Events (probe failures, Killing, OOMKilled).</li><li><code>kubectl logs --previous</code>: the dying container’s output.</li><li>Classify: exit 1 or another app code → the app chose to exit (config, missing dependency, failed migration). 137 with OOMKilled → memory. Killing after liveness failures → probe tuning or a slow start.</li><li>Compare with the last good version: what changed in image, config, Secrets?</li><li>Fix forward or <code>rollout undo</code>.</li></ol>', fu: 'Why does the back-off exist? (To avoid hammering dependencies and the node with a tight restart loop. It resets after 10 minutes of healthy running.)', lvl: 'core' },
    { q: 'What are the common reasons for a Pod stuck in Pending?', a: '<ul><li>Not enough <b>requested</b> CPU/memory free on any node (usage doesn’t matter).</li><li>nodeSelector, node affinity or topology spread that no node satisfies.</li><li>Taints without matching tolerations.</li><li>PVC not bound, or the PV is in a zone where no node fits (volume node affinity conflict).</li><li>Too many Pods for the node’s limit, or host ports in use.</li><li>No scheduler for its <code>schedulerName</code>.</li></ul><p>The <code>FailedScheduling</code> event lists counts per reason.</p>', lvl: 'core' },
    { q: 'What does kubectl debug do, and what variants are there?', a: '<p>Three modes. <b>Ephemeral container</b> (<code>kubectl debug pod -it --image=… --target=app</code>): adds a tools container to the running Pod, sharing its network and, with <code>--target</code>, its process namespace. <b>Copy</b> (<code>--copy-to=new</code>): creates a copy of the Pod, optionally with a different image or command (<code>-- sh</code>) or with <code>--share-processes</code>, useful when the original crashes too fast to attach. <b>Node</b> (<code>kubectl debug node/x</code>): a Pod in the host namespaces with the node filesystem at <code>/host</code>. Recent kubectl adds <code>--profile</code> (general, baseline, restricted, netadmin, sysadmin) to set the debug container’s security context.</p>', lvl: 'deep' },
    { q: 'How do you debug a Java app inside a Pod with no shell?', a: '<p>Attach an ephemeral container with a JDK image and <code>--target=app</code>, so you share the process namespace. Then <code>jcmd 1 Thread.print</code>, <code>jcmd 1 GC.heap_info</code> or a JFR recording, Recent JDKs find the target’s attach socket through <code>/proc/&lt;pid&gt;/root/tmp</code>, so this works across containers as long as the debug container runs as the same UID as the JVM. Alternatively expose JFR/JMX only on localhost and use <code>kubectl port-forward</code>.</p>', lvl: 'deep' },
    { q: 'What is the difference between OOMKilled and java.lang.OutOfMemoryError?', a: '<p><b>OOMKilled</b> is the Linux kernel killing the container’s process because its cgroup exceeded the memory <i>limit</i>: SIGKILL, exit 137, no Java stack trace, no shutdown hooks. <b>OutOfMemoryError</b> is the JVM failing an allocation inside its own limits (heap, metaspace, direct memory): the process keeps running, logs a stack trace, and may limp on. Fixes differ: the first needs more headroom between heap and limit; the second needs a bigger heap or a leak fix. With <code>-XX:+ExitOnOutOfMemoryError</code> the JVM exits on the second, so Kubernetes restarts it.</p>', lvl: 'core' },
    { q: 'Where do container logs live, and why might some be missing?', a: '<p>The runtime writes each container’s stdout/stderr to files under <code>/var/log/pods/</code> on the node. The kubelet rotates them (by default 10 MiB per file, 5 files) and keeps only the current and previous container instance. Logs disappear when the Pod is deleted or the node goes away. Anything written to files inside the container isn’t visible to <code>kubectl logs</code> at all. That is why you ship logs off the node; see <a href="observability.html">Observability</a>.</p>', lvl: 'core' },
    { q: 'A Pod is Running but the Service returns 503. How do you narrow it down?', a: '<ol><li>READY column: if 0/1, the readiness probe fails; Events show why.</li><li><code>kubectl get endpointslices -l kubernetes.io/service-name=x</code>: are any endpoints ready?</li><li>Service selector vs Pod labels, and <code>targetPort</code> vs the container port.</li><li>From inside: <code>kubectl debug</code> + curl to the Pod IP, then the Service name, then the Ingress. The first hop that fails is the culprit.</li><li>NetworkPolicy denying the traffic.</li></ol>', lvl: 'core' },
    { q: 'What tells you a Pod was killed by its liveness probe and not by the app?', a: '<p>Events with reason <code>Unhealthy</code> (“Liveness probe failed …”), followed by <code>Killing</code> (“Container app failed liveness probe, will be restarted”). The exit code is 143 if the app stopped on SIGTERM, or 137 if it needed SIGKILL. The previous log usually ends mid-work, without an exception. See <a href="probes.html">Probes</a>.</p>', lvl: 'core' },
    { q: 'How do you debug DNS or network issues from a Pod?', a: '<p>Run a netshoot-style ephemeral container in the affected Pod (same network namespace and the same <code>/etc/resolv.conf</code>). Then <code>nslookup orders.shop.svc.cluster.local</code>, <code>curl -v</code> to the Service and to a Pod IP, and check NetworkPolicies that select the Pod. Compare with a Pod in another namespace to find a policy or DNS search-path difference. See <a href="dns-network-policy.html">DNS & NetworkPolicy</a>.</p>', lvl: 'deep' },
    { q: 'How would you make debugging easier before the incident happens?', a: '<ul><li>Ship logs and Events off the cluster, with Pod, namespace and version labels.</li><li><code>terminationMessagePolicy: FallbackToLogsOnError</code>.</li><li><code>-XX:+ExitOnOutOfMemoryError</code> and heap dumps on OOM to a volume.</li><li>Startup failures logged clearly (Spring’s failure analyzers do this).</li><li>RBAC that lets on-call use <code>pods/ephemeralcontainers</code> in production, with an approved debug image.</li><li>Dashboards for restarts, OOMKills and Pending Pods.</li></ul>', lvl: 'deep' }
  ],
  code: [
    { title: 'Triage commands', lang: 'bash', code: `# the overview: status, restarts, node
kubectl get pods -n shop -o wide
# anything not Running, cluster-wide
kubectl get pods -A --field-selector=status.phase!=Running
# events for one Pod, newest last
kubectl events -n shop --for pod/orders-5b8d7c6f9-k2m4n
kubectl get events -n shop --sort-by=.lastTimestamp | tail -20
# why did the last container stop?
kubectl get pod orders-5b8d7c6f9-k2m4n -n shop \\
  -o jsonpath='{range .status.containerStatuses[*]}{.name}{"\\t"}{.lastState.terminated.reason}{"\\t"}{.lastState.terminated.exitCode}{"\\n"}{end}'
# logs: previous instance, one container, all replicas
kubectl logs orders-5b8d7c6f9-k2m4n -n shop -c app --previous
kubectl logs -n shop -l app=orders --all-containers --prefix --since=15m
# init container
kubectl logs orders-5b8d7c6f9-k2m4n -n shop -c wait-for-db` },
    { title: 'kubectl debug, three ways', lang: 'bash', code: `# 1. ephemeral container next to the app (shares network; --target shares processes)
kubectl debug -it orders-5b8 -n shop --image=nicolaka/netshoot --target=app -- bash

# 2. a copy of the Pod with a different command (app crashes too fast to attach)
kubectl debug orders-5b8 -n shop -it --copy-to=orders-dbg \\
  --container=app -- sh -c 'env | sort; sleep 3600'
kubectl delete pod orders-dbg -n shop       # clean up

# 3. a shell on the node (host filesystem at /host)
kubectl debug node/node-3 -it --image=busybox:1.36
#   chroot /host; journalctl -u kubelet --since "10 min ago"

# JVM diagnostics from a JDK debug container
kubectl debug -it orders-5b8 -n shop --image=eclipse-temurin:21-jdk --target=app -- \\
  jcmd 1 Thread.print` },
    { title: 'Pod settings that help debugging', lang: 'yaml', code: `containers:
- name: app
  image: registry.example.com/orders:7.2
  terminationMessagePolicy: FallbackToLogsOnError   # last log lines in 'describe'
  env:
  - name: JAVA_TOOL_OPTIONS
    value: >-
      -XX:MaxRAMPercentage=70
      -XX:+ExitOnOutOfMemoryError
      -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/dumps
  volumeMounts:
  - { name: dumps, mountPath: /dumps }
volumes:
- name: dumps
  emptyDir: { sizeLimit: 4Gi }      # copy out with kubectl cp before the Pod goes` },
    { title: 'Readable startup failures', lang: 'java', code: `// Spring Boot's FailureAnalyzers turn exceptions into the
// "APPLICATION FAILED TO START" block you see in logs --previous.
// Add one for your own fatal misconfigurations:
public class MissingTenantConfigAnalyzer
        extends AbstractFailureAnalyzer<MissingTenantConfigException> {
    @Override
    protected FailureAnalysis analyze(Throwable root, MissingTenantConfigException ex) {
        return new FailureAnalysis(
            "Tenant '" + ex.tenant() + "' has no configuration.",
            "Set TENANTS_" + ex.tenant().toUpperCase() + "_URL in the orders-config ConfigMap.",
            ex);
    }
}
// register in META-INF/spring.factories:
// org.springframework.boot.diagnostics.FailureAnalyzer=com.example.MissingTenantConfigAnalyzer` }
  ]
});

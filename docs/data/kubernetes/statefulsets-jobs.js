IA.register({
  track: 'kubernetes',
  slug: 'statefulsets-jobs',
  title: 'StatefulSet, DaemonSet & Jobs',
  tagline: 'Deployments assume pods are interchangeable and immortal. The other workload controllers drop one of those assumptions: <b>StatefulSets</b> give each pod a name, an order and its own disk; <b>DaemonSets</b> put one pod on every node; <b>Jobs</b> and <b>CronJobs</b> run to completion, with retries and schedules.',
  tldr: {
    problem: 'Databases that lose their data after a reschedule, StatefulSet rollouts frozen on one broken pod, nightly jobs that run four times at once or silently stop running, and batch pods that “succeed” after failing.',
    model: 'StatefulSet: pod <code>web-N</code> ↔ PVC <code>data-web-N</code> ↔ DNS <code>web-N.svc</code>, created 0→N−1, updated and removed N−1→0. DaemonSet: one pod per matching node, following nodes as they come and go. Job: run pods until <code>completions</code> succeed or <code>backoffLimit</code> failures. CronJob: create a Job per schedule tick, under a <code>concurrencyPolicy</code>.',
    hook: '“Why can’t I just run Postgres in a Deployment?” Replicas would share one PVC or get random ones, have random names, start in any order and be replaced in parallel. A StatefulSet (or better, an operator built on one) fixes identity and ordering.',
    facts: [
      { v: 'web-N', l: 'a StatefulSet pod’s identity: stable ordinal name, stable DNS through the headless Service, and its own PVC from <code>volumeClaimTemplates</code>' },
      { v: '10 s → 6 min', l: 'Job pod-failure back-off: 10 s, 20 s, 40 s… capped at 6 minutes. <code>backoffLimit</code> defaults to 6' },
      { v: 'Allow', l: 'default CronJob <code>concurrencyPolicy</code>: a slow run and the next scheduled run overlap unless you choose Forbid or Replace' }
    ]
  },
  intro: {
    what: 'A Deployment is for <b>identical, replaceable</b> copies of a web service. Some software needs more. A database replica needs its <b>own disk</b> and a <b>fixed name</b> other replicas can find; a log collector needs to run <b>on every machine</b>; a nightly report should <b>run once and stop</b>. Kubernetes has a controller for each: StatefulSet, DaemonSet, Job and CronJob.',
    analogy: { icon: '🏨', title: 'Hotel staff', text: 'Waiters in a Deployment are interchangeable: any free one serves you. Room-service staff in a StatefulSet each own a numbered floor and its keys (their volume); a replacement for “floor 2” gets floor 2’s keys back. The DaemonSet is the cleaner assigned to every floor automatically, including new ones. A Job is a contractor booked to repaint one room and leave; a CronJob is the contractor who comes back every night.' },
    steps: [
      { t: 'StatefulSet: names, order, disks', d: 'Pods are <code>db-0</code>, <code>db-1</code>, <code>db-2</code>, created in order. Each gets a PVC from a template. A replaced <code>db-1</code> reattaches <code>data-db-1</code>.', code: 'kubectl get sts,pods,pvc -l app=db', lang: 'bash' },
      { t: 'A headless Service gives stable DNS', d: '<code>clusterIP: None</code> makes DNS return the pod IPs, and each pod gets its own name: <code>db-0.db.shop.svc.cluster.local</code>.' },
      { t: 'DaemonSet: one per node', d: 'Log shippers, node exporters, CNI agents. Add a node and a pod appears on it.', code: 'kubectl get ds -A', lang: 'bash' },
      { t: 'Job: run to completion', d: 'Pods run until the work succeeds. Failures are retried with back-off up to <code>backoffLimit</code>.', code: 'kubectl create job report --image=registry/report:1.2\nkubectl wait --for=condition=complete job/report --timeout=10m', lang: 'bash' },
      { t: 'CronJob: a Job on a schedule', d: 'Standard cron syntax, plus rules for overlapping runs and missed schedules.', code: 'kubectl create cronjob nightly --image=registry/report:1.2 --schedule="15 2 * * *"', lang: 'bash' }
    ],
    terms: [
      ['ordinal', 'The index in a StatefulSet pod’s name (<code>web-2</code>). Determines creation, update and deletion order.'],
      ['headless Service', 'A Service with <code>clusterIP: None</code>: DNS returns pod IPs and per-pod records instead of one virtual IP.'],
      ['volumeClaimTemplates', 'A PVC template in a StatefulSet; each pod gets its own claim, named <code>&lt;template&gt;-&lt;pod&gt;</code>.'],
      ['completions / parallelism', 'How many successful pods a Job needs, and how many may run at once.'],
      ['backoffLimit', 'Failed pod retries before a Job is marked Failed (default 6).'],
      ['concurrencyPolicy', 'What a CronJob does when the previous run is still active: Allow, Forbid or Replace.']
    ]
  },
  visual: {
    title: 'Four controllers, four lifecycles',
    caption: 'Pick a controller and press Play or Step. <b>StatefulSet</b>: ordered creation, identity that survives deletion, reverse-order updates (try partition 2) and retained PVCs. <b>DaemonSet</b>: nodes joining and tainted. <b>Job</b>: retries with back-off. <b>CronJob</b>: a 90 s job on a 1-minute schedule under each concurrency policy.'
  },
  gotchas: [
    { trap: 'A StatefulSet rollout freezes on one broken pod', why: 'With the default <code>OrderedReady</code> management, the controller waits for each updated pod to be Running and Ready before touching the next. If the new revision never becomes Ready, the rollout stops there, and reverting the template is not enough: the controller still waits for that broken pod.', fix: 'Revert the template, then <b>delete the stuck pod</b> so it is recreated from the reverted revision (the documented “forced rollback”). Use <code>partition</code> to canary one ordinal first.' },
    { trap: 'Scaling down keeps the PVCs (and the bill)', why: 'By default a StatefulSet never deletes the PVCs it created, on scale-down or on deletion. That protects data, but a scale-up later reattaches <b>old</b> data to <code>web-3</code>, and unused volumes keep costing money.', fix: 'Decide explicitly with <code>persistentVolumeClaimRetentionPolicy</code> (<code>whenScaled</code> / <code>whenDeleted</code>: Retain or Delete; beta since 1.27, GA in 1.32).' },
    { trap: 'Peers can’t find each other while bootstrapping', why: 'The headless Service only publishes Ready pods by default. Clustered software (Kafka, etcd, Hazelcast, Infinispan) often needs to resolve peers <b>before</b> they are ready, to form the cluster that makes them ready.', fix: 'Set <code>publishNotReadyAddresses: true</code> on the headless Service used for peer discovery, and use a separate normal Service for clients.' },
    { trap: 'A Job runs your code more than once', why: 'Jobs are at-least-once: retries after failure, a node lost mid-run, or a pod evicted all start a new pod. In rare cases two pods of a <code>completions: 1</code> Job can even overlap.', fix: 'Make job work idempotent (upserts, an idempotency key, a “processed” marker). For Spring Batch, use a persistent JobRepository so restarts resume instead of repeating.' },
    { trap: 'CronJob overlaps, and a silent stop after an outage', code: `spec:
  schedule: "*/5 * * * *"
  concurrencyPolicy: Forbid        # default Allow lets runs pile up
  startingDeadlineSeconds: 600     # bound the missed-schedule window
  timeZone: "Europe/Berlin"        # GA in 1.27; default is the controller's zone`, why: 'With <code>Allow</code>, a run slower than the schedule overlaps the next one. And if the controller counts <b>more than 100 missed schedules</b> (for example after a long control-plane outage with no <code>startingDeadlineSeconds</code>), it logs an error and does not start the job.', fix: 'Pick <code>Forbid</code> or <code>Replace</code> deliberately, set <code>startingDeadlineSeconds</code>, set <code>timeZone</code>, and alert on the time since the last successful run.' },
    { trap: 'The batch pod “succeeded” but the job failed', why: 'Kubernetes judges success only by the container’s <b>exit code</b>. A Spring Boot batch app that logs the failure and returns normally exits 0; one that starts an embedded web server never exits at all.', fix: 'Exit with the application’s exit code: <code>System.exit(SpringApplication.exit(ctx))</code>, and set <code>spring.main.web-application-type=none</code> for batch jobs.' },
    { trap: '<code>kubectl drain</code> refuses because of DaemonSet pods', why: 'DaemonSet pods would just be recreated on the same node (they tolerate <code>unschedulable</code>), so drain will not evict them without permission.', fix: 'Use <code>kubectl drain node --ignore-daemonsets --delete-emptydir-data</code>. DaemonSet pods stay and keep running until the node goes away.' }
  ],
  scenarios: [
    { title: 'StatefulSet rollout stuck at db-2 for an hour',
      symptom: 'A config change to a 3-node clustered cache rolled <code>cache-2</code> and stopped. <code>cache-2</code> is in CrashLoopBackOff; <code>cache-0</code> and <code>cache-1</code> are still on the old revision.',
      diagnoseLang: 'bash',
      diagnose: `kubectl rollout status sts/cache
#   Waiting for 1 pods to be ready...
kubectl get pods -l app=cache -L controller-revision-hash
kubectl logs cache-2 --previous | tail -3   # invalid option in the new config`,
      cause: 'OrderedReady rolling update: the controller updates from the highest ordinal and waits for each pod to become Ready. The bad revision never does. After the team reverted the template, the controller kept waiting on the broken <code>cache-2</code>.',
      fix: 'Revert the change, then delete the stuck pod so it is recreated from the reverted revision. Next time, roll out with a partition first.',
      fixCode: `kubectl rollout undo sts/cache
kubectl delete pod cache-2              # forced rollback: recreated from the good revision
# canary the next change on the highest ordinal only:
kubectl patch sts cache -p '{"spec":{"updateStrategy":{"rollingUpdate":{"partition":2}}}}'`, lang: 'bash' },
    { title: 'Customers charged twice by the nightly billing CronJob',
      symptom: 'On the first day of the month a few hundred customers were charged twice. Logs show the billing job running in <b>three</b> overlapping pods.',
      diagnoseLang: 'bash',
      diagnose: `kubectl get jobs -l cronjob=billing --sort-by=.status.startTime
#   billing-28930560   1/1   47m
#   billing-28930575   1/1   38m   ← started while the first was running
kubectl get cronjob billing -o jsonpath='{.spec.schedule} {.spec.concurrencyPolicy}'
#   */15 * * * *  Allow`,
      cause: 'Month-end volume made a run take 47 minutes. With <code>concurrencyPolicy: Allow</code> the next two schedule ticks started more Jobs over the same unprocessed invoices, and the charge step was not idempotent.',
      fix: 'Forbid overlap, and make charging idempotent with an idempotency key per invoice and billing period.',
      fixCode: `apiVersion: batch/v1
kind: CronJob
metadata: { name: billing }
spec:
  schedule: "*/15 * * * *"
  concurrencyPolicy: Forbid
  startingDeadlineSeconds: 300
  jobTemplate:
    spec:
      backoffLimit: 2
      activeDeadlineSeconds: 3600
      template:
        spec:
          restartPolicy: Never
          containers:
          - name: billing
            image: registry/billing:4.2` },
    { title: 'The cleanup CronJob silently stopped running',
      symptom: 'Disk usage climbs. The cleanup CronJob’s <code>LAST SCHEDULE</code> is two days old, right before a long control-plane maintenance.',
      diagnoseLang: 'bash',
      diagnose: `kubectl get cronjob cleanup
#   SCHEDULE    SUSPEND  ACTIVE  LAST SCHEDULE
#   * * * * *   False    0       2d
kubectl get events -n ops --field-selector involvedObject.name=cleanup
#   Cannot determine if job needs to be started: too many missed start times (> 100)`,
      cause: 'An every-minute schedule with no <code>startingDeadlineSeconds</code>. After a long outage the controller counted more than 100 missed start times and refused to start the job.',
      fix: 'Set <code>startingDeadlineSeconds</code>, so only misses inside that window are counted. Alert on “time since last successful run” rather than on failures.',
      fixCode: `spec:
  schedule: "* * * * *"
  startingDeadlineSeconds: 120
  concurrencyPolicy: Forbid`, lang: 'yaml' }
  ],
  puzzles: [
    { kind: 'scenario', q: 'A StatefulSet with <code>replicas: 3</code> (default OrderedReady). <code>web-0</code> starts but never passes readiness. How many pods exist?', options: ['3', '1', '0', '2'], answer: 1, explain: 'OrderedReady creates <code>web-1</code> only after <code>web-0</code> is Running and Ready. With <code>podManagementPolicy: Parallel</code> all three would be created at once (ordering then applies only to rolling updates).' },
    { kind: 'scenario', q: 'You delete pod <code>web-1</code> of a StatefulSet. What comes back?', options: ['A pod with a new random suffix and a new PVC', 'A pod named web-1 that reattaches PVC data-web-1', 'Nothing: StatefulSets don’t self-heal', 'web-3, with a new PVC'], answer: 1, explain: 'Identity is the ordinal. The controller recreates <code>web-1</code>, which mounts the same claim <code>data-web-1</code> and gets the same DNS name. Its IP will usually change, which is why clients use DNS.' },
    { kind: 'predict', q: 'Scale a StatefulSet from 5 to 2 (OrderedReady). What happens?', options: ['Three random pods are deleted at once', 'web-0, web-1, web-2 are deleted', 'web-4, then web-3, then web-2, one at a time; their PVCs are kept', 'web-4, web-3 and web-2 together; their PVCs are deleted'], answer: 2, explain: 'Scale-down goes in reverse ordinal order and waits for each pod to terminate fully before the next. PVCs are retained unless <code>persistentVolumeClaimRetentionPolicy.whenScaled: Delete</code>.' },
    { kind: 'predict', q: '<code>replicas: 4</code>, <code>updateStrategy.rollingUpdate.partition: 2</code>. You change the image. Which pods get it?', options: ['All four', 'web-0 and web-1', 'web-2 and web-3', 'Only web-3'], answer: 2, explain: 'Pods with ordinal ≥ partition are updated (highest first); lower ordinals keep the old revision even if deleted and recreated. Lower the partition step by step to finish the rollout.' },
    { kind: 'predict', q: 'A Job with <code>backoffLimit: 2</code>, <code>restartPolicy: Never</code>, and a container that always exits 1. How many pods are created before the Job is marked Failed?', options: ['1', '2', '3', 'Unlimited, with back-off'], answer: 2, explain: 'The first pod plus 2 retries: <b>3</b> pods, with 10 s and 20 s of back-off between them, then the condition <code>Failed</code>, reason <code>BackoffLimitExceeded</code>. (With OnFailure the restarts happen in place and are counted the same way.)' },
    { kind: 'predict', q: 'CronJob <code>*/5 * * * *</code>, <code>concurrencyPolicy: Forbid</code>. Every run takes 12 minutes. Starting at 00:00, when do runs start in the first half hour?', options: ['00:00, 00:05, 00:10 …', '00:00, 00:15, 00:30', '00:00, 00:12, 00:24', '00:00 only'], answer: 1, explain: 'At 00:05 and 00:10 the 00:00 run is still active, so those ticks are <b>skipped</b>. It ends at 00:12; the next tick is 00:15. Then 00:20 and 00:25 are skipped, and 00:30 runs.' },
    { kind: 'scenario', q: 'Same schedule and 12-minute runtime, but <code>concurrencyPolicy: Replace</code>. What happens?', options: ['Runs queue up', 'Each run is killed at the next tick, 5 minutes in, so no run ever completes', 'Runs overlap', 'Replace behaves like Forbid'], answer: 1, explain: 'Replace deletes the running Job and starts the new one. With a runtime longer than the interval, every run is cancelled. Replace suits “only the latest matters” work that is shorter than the interval.' },
    { kind: 'scenario', q: 'A DaemonSet runs a log agent. You cordon node-3 (<code>kubectl cordon</code>). What happens to node-3’s agent pod, and to a new node-4?', options: ['node-3’s pod is evicted; node-4 gets one', 'node-3’s pod keeps running; node-4 gets one automatically', 'Both nodes are skipped until uncordoned', 'Nothing changes until the DaemonSet is restarted'], answer: 1, explain: 'Cordon only marks the node unschedulable for new pods, and DaemonSet pods tolerate that taint anyway. Any new node that matches the DaemonSet’s node selector and taints gets a pod as soon as it registers.' }
  ],
  interview: [
    { q: 'StatefulSet vs Deployment: what does a StatefulSet guarantee?', a: '<ul><li><b>Stable identity</b>: pod names <code>name-0…N-1</code> that survive rescheduling.</li><li><b>Stable network</b>: per-pod DNS through a headless Service.</li><li><b>Stable storage</b>: a PVC per ordinal from <code>volumeClaimTemplates</code>, reattached on replacement.</li><li><b>Ordering</b> (with OrderedReady): create 0→N−1 one at a time after Ready; delete and update N−1→0.</li></ul><p>It does <b>not</b> do replication, failover or backups; that is the application’s or an operator’s job.</p>', lvl: 'core' },
    { q: 'Would you run Postgres on Kubernetes? How?', a: '<p>Only with an operator (CloudNativePG, Crunchy, Zalando) or a managed database. A bare StatefulSet gives identity and disks, but primary election, streaming replication, failover, backups to object storage, PITR and safe upgrades are all application logic. Also plan for: storage class performance, zone-pinned volumes, PDBs, anti-affinity and resource guarantees (Guaranteed QoS).</p>', lvl: 'deep' },
    { q: 'What are podManagementPolicy and updateStrategy for StatefulSets?', a: '<p><code>podManagementPolicy</code>: <b>OrderedReady</b> (default, one at a time) or <b>Parallel</b> (create and delete all at once; rolling updates are still ordered). <code>updateStrategy</code>: <b>RollingUpdate</b> (default; highest ordinal first, each must be Ready before the next; <code>partition</code> holds lower ordinals back) or <b>OnDelete</b> (new revision applies only when you delete a pod yourself). A <code>maxUnavailable</code> for StatefulSet rolling updates exists behind the <code>MaxUnavailableStatefulSet</code> feature gate (alpha since 1.24, beta in 1.35).</p>', lvl: 'deep' },
    { q: 'How does a DaemonSet schedule its pods?', a: '<p>The DaemonSet controller creates one pod per eligible node with a node affinity pinning it to that node, and the default scheduler binds it. Eligibility: <code>nodeSelector</code>/affinity and taints vs tolerations. The controller adds tolerations automatically for conditions like <code>not-ready</code>, <code>unreachable</code>, disk/memory pressure and <code>unschedulable</code>, so node agents survive those states. Rolling updates default to <code>maxUnavailable: 1</code>; <code>maxSurge</code> is also supported.</p>', lvl: 'core' },
    { q: 'Explain completions, parallelism and Indexed Jobs.', a: '<p><code>completions</code>: how many pods must succeed. <code>parallelism</code>: how many may run at once. Together they give work queues (parallelism only) or fixed fan-out. <code>completionMode: Indexed</code> (GA in 1.24) gives each pod an index (<code>JOB_COMPLETION_INDEX</code>) from 0 to completions−1, so pod 7 processes shard 7: static partitioning without a queue.</p>', lvl: 'core' },
    { q: 'How do backoffLimit, activeDeadlineSeconds and podFailurePolicy interact?', a: '<p><code>backoffLimit</code> counts failed pods (or container restarts with OnFailure), with exponential back-off between them. <code>activeDeadlineSeconds</code> is a hard wall-clock limit for the whole Job and wins over backoffLimit. <code>podFailurePolicy</code> (GA in 1.31) decides per failure: <b>FailJob</b> at once for a known non-retryable exit code, <b>Ignore</b> disruptions such as preemption or eviction so they don’t count, or <b>Count</b> as usual.</p>', fu: 'Why ignore disruptions? (A node drain is not your code’s fault and shouldn’t burn retries.)', lvl: 'deep' },
    { q: 'What does each CronJob concurrencyPolicy do?', a: '<p><b>Allow</b> (default): start every scheduled run, even if previous ones are still active. <b>Forbid</b>: skip a tick while a run is active. <b>Replace</b>: delete the active run and start the new one. Related: <code>startingDeadlineSeconds</code> (how late a missed start may still happen), <code>suspend</code>, <code>successfulJobsHistoryLimit</code> (3) and <code>failedJobsHistoryLimit</code> (1), and <code>timeZone</code> (GA in 1.27).</p>', lvl: 'core' },
    { q: 'How do you clean up finished Jobs?', a: '<p><code>ttlSecondsAfterFinished</code> on the Job (GA since 1.23) deletes it, and its pods, a set time after it completes or fails. CronJobs prune by their history limits instead. Without either, completed Jobs and their pods accumulate in etcd.</p>', lvl: 'core' },
    { q: 'How should a Spring Boot batch application behave as a Kubernetes Job?', a: '<ul><li>No web server: <code>spring.main.web-application-type=none</code>, so the JVM exits when work is done.</li><li>Propagate failure: <code>System.exit(SpringApplication.exit(ctx))</code> so a failed batch job exits non-zero.</li><li>Be idempotent or restartable (Spring Batch JobRepository in a database).</li><li>Handle SIGTERM: stop cleanly within <code>terminationGracePeriodSeconds</code> when evicted.</li><li>Set memory limits sized for the batch’s peak heap, not the web service’s.</li></ul>', lvl: 'deep' },
    { q: 'Why does a StatefulSet need a headless Service, and what DNS records does it create?', a: '<p><code>spec.serviceName</code> names a Service with <code>clusterIP: None</code>. DNS then has an A/AAAA record per ready pod for the Service name (<code>db.shop.svc.cluster.local</code>), and a per-pod record <code>db-0.db.shop.svc.cluster.local</code>. That lets replicas address a specific peer (“the primary is db-0”) instead of a load-balanced virtual IP.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'StatefulSet with headless Service', lang: 'yaml', code: `apiVersion: v1
kind: Service
metadata: { name: cache }
spec:
  clusterIP: None                     # headless: per-pod DNS records
  publishNotReadyAddresses: true      # peers can find each other while bootstrapping
  selector: { app: cache }
  ports: [{ name: peer, port: 7800 }]
---
apiVersion: apps/v1
kind: StatefulSet
metadata: { name: cache }
spec:
  serviceName: cache
  replicas: 3
  podManagementPolicy: OrderedReady
  updateStrategy:
    type: RollingUpdate
    rollingUpdate: { partition: 0 }
  persistentVolumeClaimRetentionPolicy: { whenScaled: Retain, whenDeleted: Retain }
  selector: { matchLabels: { app: cache } }
  template:
    metadata: { labels: { app: cache } }
    spec:
      containers:
      - name: cache
        image: registry/cache:3.1
        env:
        - name: POD_NAME
          valueFrom: { fieldRef: { fieldPath: metadata.name } }   # cache-0, cache-1…
        volumeMounts: [{ name: data, mountPath: /data }]
  volumeClaimTemplates:
  - metadata: { name: data }          # → PVC data-cache-0, data-cache-1…
    spec:
      accessModes: [ReadWriteOnce]
      storageClassName: fast-ssd
      resources: { requests: { storage: 20Gi } }` },
    { title: 'Job with podFailurePolicy, and a CronJob', lang: 'yaml', code: `apiVersion: batch/v1
kind: Job
metadata: { name: reindex }
spec:
  completions: 8
  parallelism: 4
  completionMode: Indexed             # JOB_COMPLETION_INDEX = 0..7
  backoffLimit: 4
  activeDeadlineSeconds: 7200
  ttlSecondsAfterFinished: 86400
  podFailurePolicy:                   # GA in 1.31
    rules:
    - action: FailJob                 # bad input: retrying won't help
      onExitCodes: { containerName: reindex, operator: In, values: [42] }
    - action: Ignore                  # drains / preemption don't burn retries
      onPodConditions: [{ type: DisruptionTarget }]
  template:
    spec:
      restartPolicy: Never            # required with podFailurePolicy
      containers:
      - name: reindex
        image: registry/reindex:2.0
---
apiVersion: batch/v1
kind: CronJob
metadata: { name: nightly-report }
spec:
  schedule: "15 2 * * *"
  timeZone: "Europe/Berlin"
  concurrencyPolicy: Forbid
  startingDeadlineSeconds: 900
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      backoffLimit: 2
      template:
        spec:
          restartPolicy: Never
          containers:
          - name: report
            image: registry/report:1.2` },
    { title: 'Spring Boot batch main that exits correctly', lang: 'java', code: `@SpringBootApplication
public class ReportJobApplication {
    public static void main(String[] args) {
        // application.yaml: spring.main.web-application-type: none
        ConfigurableApplicationContext ctx = SpringApplication.run(ReportJobApplication.class, args);
        // ExitCodeGenerator beans (Spring Batch registers one for failed JobExecutions)
        // decide the code; non-zero → Kubernetes counts a pod failure and retries
        System.exit(SpringApplication.exit(ctx));
    }

    @Bean
    ExitCodeExceptionMapper exitCodes() {
        return ex -> ex instanceof InvalidInputException ? 42   // podFailurePolicy: FailJob
                   : 1;
    }
}`, note: 'Exit code 42 maps to the FailJob rule above: bad input fails the Job at once instead of retrying.' }
  ]
});

IA.register({
  track: 'kubernetes',
  slug: 'operators-crds',
  title: 'Operators & CRDs',
  tagline: 'A <b>CRD</b> teaches the API server a new type; a <b>custom resource</b> is just validated data in etcd. An <b>operator</b> is a controller that watches those objects and keeps reality equal to them: level-triggered, idempotent, with <b>owner references</b> for in-cluster children and <b>finalizers</b> for everything else.',
  tldr: {
    problem: 'Operators are how databases, Kafka, cert-manager and service meshes run on Kubernetes, and how they fail: a webhook outage blocks every deploy, a finalizer keeps a namespace in Terminating for weeks, a status update loop hammers the API server, a CRD upgrade can’t remove an old version.',
    model: 'Watch → <b>queue a key</b> → <b>Reconcile</b>: read desired (spec) and actual (owned objects, external systems), act to close the gap, write <b>status</b> (<code>observedGeneration</code>, conditions), requeue. Never trust events; always recompute. Deletion: <code>deletionTimestamp</code> set, cleanup runs, the controller removes its finalizer, the object goes, and the garbage collector removes dependents.',
    hook: '“Why does a reconcile get a key and not the event?” Because events coalesce and get lost. A level-triggered loop that recomputes from current state handles a missed event, a restart and a human edit with the same code.',
    facts: [
      { v: '1.29', l: 'CEL validation rules in CRD schemas (<code>x-kubernetes-validations</code>) went GA, often removing the need for a validating webhook' },
      { v: 'Fail · 10 s', l: 'defaults for an <code>admissionregistration.k8s.io/v1</code> webhook: <code>failurePolicy: Fail</code>, <code>timeoutSeconds: 10</code>' },
      { v: 'generation', l: 'bumps on spec changes only (with the status subresource); <code>status.observedGeneration</code> says which spec the status describes' }
    ]
  },
  intro: {
    what: 'Kubernetes is extensible. A <b>CustomResourceDefinition</b> (CRD) adds a new kind of object, say <code>PostgresCluster</code>, with a schema. You can then <code>kubectl apply</code> such objects like Deployments. On their own they do nothing. An <b>operator</b> is a program, usually running as a Deployment in the cluster, that watches these objects and does the work a human operator would: create StatefulSets, configure replication, take backups, upgrade carefully.',
    analogy: { icon: '🧑‍🍳', title: 'An order slip and a chef', text: 'The CRD is the order form’s design. A custom resource is a filled-in slip: “one Postgres cluster, three replicas, daily backups”. The operator is the chef who keeps looking at the slips and the kitchen, and fixes whatever doesn’t match, without needing to remember what happened before. The finalizer is a note: “don’t throw this slip away until I’ve cleaned the station.”' },
    steps: [
      { t: 'Define the type', d: 'A CRD with a structural OpenAPI schema and a status subresource.', code: 'kind: CustomResourceDefinition\nspec:\n  group: db.example.com\n  names: { kind: PostgresCluster, plural: postgresclusters }\n  scope: Namespaced\n  versions:\n  - name: v1\n    served: true\n    storage: true\n    subresources: { status: {} }' },
      { t: 'Create an instance', d: 'It is validated and stored like any built-in object.', code: 'apiVersion: db.example.com/v1\nkind: PostgresCluster\nmetadata: { name: main-db, namespace: shop }\nspec: { replicas: 3, version: "16" }' },
      { t: 'The operator reconciles', d: 'It creates owned objects and reports progress in status.', code: 'kubectl get postgrescluster main-db -n shop\n# NAME     REPLICAS   READY   AGE\n# main-db  3          True    4m', lang: 'bash' },
      { t: 'Deletion waits for cleanup', d: 'A finalizer keeps the object until the operator has cleaned up outside the cluster.', code: 'kubectl get postgrescluster main-db -o jsonpath=\'{.metadata.finalizers}\'\n# ["db.example.com/cleanup"]', lang: 'bash' }
    ],
    terms: [
      ['CRD / custom resource', 'The type definition, and an object of that type.'],
      ['controller / operator', 'A control loop for a resource. “Operator” usually means one that encodes app-specific operational knowledge.'],
      ['reconcile', 'One pass of “compare desired with actual and fix the difference”. Must be idempotent.'],
      ['ownerReference', 'A pointer from a child object to its owner; the garbage collector deletes children when the owner is gone.'],
      ['finalizer', 'A string in <code>metadata.finalizers</code>; while present, deletion is postponed so a controller can clean up.'],
      ['admission webhook', 'An HTTPS endpoint the API server calls to mutate or validate objects before storing them.']
    ]
  },
  visual: {
    title: 'The reconcile loop, owner references and finalizers',
    caption: 'Pick a scenario and press Play (or Step). Follow a custom resource from the API server into etcd, the operator’s watch, queue and Reconcile, and the objects it owns. The panel shows the resource’s metadata and status at each step: watch <code>generation</code>, <code>finalizers</code> and <code>deletionTimestamp</code>.'
  },
  gotchas: [
    { trap: 'A webhook with <code>failurePolicy: Fail</code> on all Pods', code: `webhooks:
- name: policy.example.com
  failurePolicy: Fail            # the v1 default
  rules: [{ operations: ["CREATE"], apiGroups: [""], resources: ["pods"], apiVersions: ["v1"] }]
  # no namespaceSelector → includes kube-system and the webhook's own namespace`, why: 'If the webhook’s Pods are down (a node drain, a bad rollout, an expired certificate), every Pod creation in the cluster fails, including the webhook’s own replacement Pods. A circular dependency that can stop a whole cluster from healing.', fix: 'Exclude <code>kube-system</code> and the webhook’s own namespace with a <code>namespaceSelector</code>; run 2+ replicas with a PDB and anti-affinity; keep <code>timeoutSeconds</code> low; use <code>Ignore</code> for non-security webhooks. For simple rules, prefer CEL in the CRD or a ValidatingAdmissionPolicy (GA in 1.30), which run inside the API server.' },
    { trap: 'Writing reconcile logic around events', why: 'Events are coalesced (ten updates may produce one reconcile), can be missed during a restart, and the informer cache may lag behind the API. Code that does “on create, do X; on update, diff old and new” drifts as soon as one event is lost.', fix: 'Reconcile from current state every time: read spec, read actual owned objects, converge. Make every action idempotent (create-or-update, server-side apply, deterministic names). Requeue on errors and periodically.' },
    { trap: 'Updating status in a way that triggers another reconcile, forever', why: 'Writing <code>status.lastReconciled: now()</code> on every pass changes the object, which produces a watch event, which enqueues it again. The operator hot-loops and floods the API server.', fix: 'Write status only when it actually changes, never put timestamps of the reconcile itself in status, and filter events (e.g. controller-runtime’s <code>GenerationChangedPredicate</code>, or JOSDK’s generation-aware event filtering) so status-only changes don’t retrigger.' },
    { trap: 'Finalizers without a living controller', why: 'A finalizer is a promise that some controller will remove it. Uninstall the operator first, or let it crash permanently, and every delete of its resources hangs; namespaces stay <code>Terminating</code> with <code>NamespaceFinalizersRemaining</code>.', fix: 'Delete custom resources before uninstalling the operator (and let Helm/Argo order that). Make cleanup tolerate “already gone”. Patching finalizers away is a last resort that leaks whatever the finalizer was protecting.' },
    { trap: 'Removing a CRD version that is still stored', why: 'etcd keeps objects in the version that was the storage version when they were written; the CRD lists them in <code>status.storedVersions</code>. The API server refuses to drop a version from <code>spec.versions</code> while it is still listed there, so an operator upgrade fails halfway.', fix: 'Switch <code>storage: true</code> to the new version, rewrite every object (a no-op update or the storage version migrator), then remove the old version from <code>status.storedVersions</code>, then from <code>spec.versions</code>. Use a conversion webhook while both versions are served.' },
    { trap: 'Owner references across namespaces', why: 'A namespaced object can only be owned by an object in the same namespace (or a cluster-scoped one). A reference to an owner in another namespace is treated as absent, and the garbage collector may delete the “orphaned” child.', fix: 'Keep owner and dependents in one namespace. For cross-namespace or external resources, use a finalizer on the owner and clean up explicitly, plus labels to find what you created.' },
    { trap: 'Custom resources as a database', why: 'Every CR lives in etcd, is watched by informers (and cached in every controller’s memory), and objects are limited to about 1.5 MiB. Storing logs, large reports or high-churn data in CRs slows the whole control plane.', fix: 'Keep CRs to desired state and a compact status. Put bulk data in a real datastore and reference it.' }
  ],
  scenarios: [
    { title: 'No Pod could be created anywhere for 40 minutes',
      symptom: 'During a node pool upgrade, all new Pods fail to create, in every namespace. Deployments stall; drained nodes leave workloads with fewer replicas. Events: <code>Error creating: Internal error occurred: failed calling webhook "pod-policy.example.com": … context deadline exceeded</code>.',
      diagnoseLang: 'bash',
      diagnose: `kubectl get validatingwebhookconfigurations,mutatingwebhookconfigurations
kubectl get validatingwebhookconfiguration pod-policy -o yaml | grep -E 'failurePolicy|namespaceSelector|timeoutSeconds'
#  failurePolicy: Fail   timeoutSeconds: 30   (no namespaceSelector)
kubectl get pods -n policy-system     # 0/2 Running: both replicas were on drained nodes
kubectl get events -n policy-system | grep FailedCreate   # its own Pods are blocked by itself`,
      cause: 'Both webhook replicas ran on nodes in the same pool and were drained together. The webhook matched all Pods with <code>failurePolicy: Fail</code>, so its own replacement Pods were rejected too: a deadlock. Each create also waited 30 s for the timeout.',
      fix: 'Break the loop by hand (temporarily set <code>failurePolicy: Ignore</code> or delete the configuration; it is re-applied by GitOps later). Then exclude system namespaces and the webhook’s own namespace, spread replicas with a PDB, and lower the timeout.',
      fixCode: `apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata: { name: pod-policy }
webhooks:
- name: pod-policy.example.com
  failurePolicy: Fail
  timeoutSeconds: 3
  namespaceSelector:
    matchExpressions:
    - key: kubernetes.io/metadata.name
      operator: NotIn
      values: ["kube-system", "policy-system"]
  rules:
  - { operations: ["CREATE"], apiGroups: [""], apiVersions: ["v1"], resources: ["pods"] }
  clientConfig:
    service: { namespace: policy-system, name: pod-policy, path: /validate }
  admissionReviewVersions: ["v1"]
  sideEffects: None` },
    { title: 'An in-house operator caused API server throttling',
      symptom: 'After deploying a new <code>TenantConfig</code> operator, <code>kubectl</code> feels slow cluster-wide and other controllers log <code>client-side throttling</code>. The API server’s request rate from one ServiceAccount is in the hundreds per second.',
      diagnoseLang: 'bash',
      diagnose: `# API server metrics: apiserver_request_total by user
kubectl get tenantconfig acme -o yaml | grep -A3 status
#  status:
#    lastReconcileTime: "2026-11-22T09:31:07.412Z"   ← changes every pass
kubectl logs deploy/tenant-operator | grep -c 'Reconciling'   # thousands per minute`,
      cause: 'Every reconcile wrote <code>status.lastReconcileTime</code>. Each write is a change, the informer delivers it, the key is queued again, and the loop runs as fast as the API server allows, for every tenant.',
      fix: 'Write status only when it changes; drop the timestamp. Ignore status-only updates with a generation filter. Requeue periodically on a timer if you need a resync.',
      fixCode: `// Java Operator SDK 4.x/5.x
@ControllerConfiguration(generationAwareEventProcessing = true)  // skip status-only changes (the SDK default)
public class TenantReconciler implements Reconciler<TenantConfig> {
  @Override
  public UpdateControl<TenantConfig> reconcile(TenantConfig t, Context<TenantConfig> ctx) {
    var desired = computeStatus(t, ctx);
    if (desired.equals(t.getStatus())) {
      return UpdateControl.<TenantConfig>noUpdate().rescheduleAfter(Duration.ofMinutes(10));
    }
    t.setStatus(desired);
    return UpdateControl.patchStatus(t);
  }
}`,
      fixLang: 'java' },
    { title: 'Operator upgrade fails: “must appear in spec.versions”',
      symptom: 'The new operator chart drops <code>v1alpha1</code> from its CRD. <code>helm upgrade</code> (or Argo CD) fails to apply the CRD with an error saying stored versions must appear in <code>spec.versions</code>.',
      diagnoseLang: 'bash',
      diagnose: `kubectl get crd postgresclusters.db.example.com -o jsonpath='{.status.storedVersions}'
#  ["v1alpha1","v1"]
kubectl get crd postgresclusters.db.example.com \\
  -o jsonpath='{range .spec.versions[*]}{.name}{" storage="}{.storage}{"\\n"}{end}'`,
      cause: 'Objects created before the move to <code>v1</code> are still persisted as <code>v1alpha1</code> in etcd. Removing the version would make them unreadable, so the API server refuses.',
      fix: 'Rewrite all objects in the storage version, then clear the old entry from <code>storedVersions</code>, then ship the CRD without <code>v1alpha1</code>.',
      fixCode: `# 1. with v1 as storage version, rewrite every object (no-op update)
kubectl get postgresclusters -A \\
  -o jsonpath='{range .items[*]}{.metadata.namespace}{" "}{.metadata.name}{"\\n"}{end}' |
while read ns name; do
  kubectl annotate postgrescluster "$name" -n "$ns" migrated-at="$(date +%s)" --overwrite >/dev/null
done
# (or run the kube-storage-version-migrator)

# 2. tell the API server nothing is stored as v1alpha1 any more
kubectl patch crd postgresclusters.db.example.com --subresource=status --type=merge \\
  -p '{"status":{"storedVersions":["v1"]}}'

# 3. now the CRD without v1alpha1 applies`,
      fixLang: 'bash' }
  ],
  puzzles: [
    { kind: 'scenario', q: 'You install a CRD but no operator, then apply a custom resource. What happens?', options: ['It is validated and stored; nothing else happens, and status stays empty', 'The apply fails: no controller', 'The API server creates a default Deployment', 'It is stored, then garbage-collected'], answer: 0, explain: 'The API server serves the type and validates it. Behaviour comes only from a controller watching it. Some teams use CRDs purely as typed configuration for exactly this reason.' },
    { kind: 'scenario', q: 'A CR has a finalizer. The operator is scaled to 0 and you run <code>kubectl delete</code> on the CR. What do you observe?', options: ['It is deleted immediately', 'The delete is rejected', 'It stays, with <code>deletionTimestamp</code> set, until something removes the finalizer', 'It is deleted after the grace period of 30 s'], answer: 2, explain: 'The API server only marks the object for deletion while finalizers remain. <code>kubectl delete</code> waits (or returns with <code>--wait=false</code>). Scale the operator back up and it finishes the job.' },
    { kind: 'concept', q: 'With the status subresource enabled, the operator updates <code>status.conditions</code>. What happens to <code>metadata.generation</code>?', options: ['It increases by 1', 'It resets to 0', 'It copies resourceVersion', 'Nothing: generation only changes on spec (and metadata deletion) changes'], answer: 3, explain: '<code>resourceVersion</code> changes on every write; <code>generation</code> only on meaningful spec changes. That is what makes <code>observedGeneration</code> and generation-based event filters work.' },
    { kind: 'concept', q: 'What is the default <code>failurePolicy</code> of an <code>admissionregistration.k8s.io/v1</code> webhook?', options: ['Ignore', 'Fail', 'Retry', 'There is no default; it is required'], answer: 1, explain: 'v1 defaults to <code>Fail</code> (v1beta1 defaulted to Ignore). Safe for security, dangerous for availability unless the webhook is highly available and scoped narrowly.' },
    { kind: 'scenario', q: 'A ConfigMap in namespace <code>a</code> has an ownerReference to a CR in namespace <code>b</code>. What does the garbage collector do?', options: ['Deletes the ConfigMap when the CR is deleted', 'Ignores ownerReferences on ConfigMaps', 'Treats the owner as absent, so the ConfigMap can be deleted even though the CR exists', 'Moves the ConfigMap to namespace b'], answer: 2, explain: 'Cross-namespace owner references are not allowed. A namespaced owner must be in the same namespace; otherwise the reference is treated as absent and the dependent becomes eligible for deletion. Recent versions also emit a warning event for it.' },
    { kind: 'concept', q: 'You want <code>spec.replicas</code> to be at least 1 and default to 3. Simplest correct approach in 1.30?', options: ['Schema <code>default: 3</code> and <code>minimum: 1</code> (or a CEL rule) in the CRD; no webhook', 'A mutating and a validating webhook', 'Validate in the operator and set status to Failed', 'A ValidatingAdmissionPolicy that sets the default'], answer: 0, explain: 'Structural schemas support defaults, minimums, enums and patterns; CEL rules (GA in 1.29) cover cross-field checks like <code>self.minReplicas &lt;= self.maxReplicas</code>. Policies validate, they don’t default. Webhooks are for logic that needs external data.' },
    { kind: 'concept', q: 'Why does a reconcile function receive only a namespace/name key?', options: ['To save memory', 'Because the event contains no data', 'The API forbids passing objects', 'Because it should compute from the current state (level-triggered); events coalesce or get lost, so the event itself is not reliable input'], answer: 3, explain: 'The queue deduplicates keys: ten quick updates become one reconcile of the latest state. Combined with periodic resyncs, that makes the loop self-correcting.' },
    { kind: 'scenario', q: 'The operator creates a cloud DNS record for each CR. Which mechanism makes sure the record is removed when the CR is deleted?', options: ['An ownerReference on the DNS record', 'A finalizer on the CR, removed by the operator after it deleted the record', 'The garbage collector', 'A preStop hook'], answer: 1, explain: 'Owner references only work between Kubernetes objects. External resources need a finalizer, so deletion waits for the operator’s cleanup.' }
  ],
  interview: [
    { q: 'What is the operator pattern?', a: '<p>A custom controller plus custom resources that encode operational knowledge for one application: how to deploy it, scale it, back it up, fail over and upgrade. The user declares intent (<code>PostgresCluster: replicas 3, version 16</code>); the operator continuously reconciles the cluster and external systems towards it and reports status. It is the same control-loop design as the built-in controllers, applied to your domain.</p>', lvl: 'core' },
    { q: 'Walk through what happens inside a controller from event to action.', a: '<ol><li>An <b>informer</b> lists and watches the resource and the kinds it owns, keeping a local cache.</li><li>Event handlers map events to the owning object’s key and add it to a <b>rate-limited work queue</b> (deduplicated).</li><li>Workers pop keys and call <b>Reconcile</b>, which reads from the cache, compares desired and actual state, and makes API calls.</li><li>Errors requeue with exponential back-off; success can requeue after a delay.</li><li>Status is written via the status subresource; optimistic concurrency conflicts (stale resourceVersion) just requeue.</li></ol>', lvl: 'deep' },
    { q: 'Level-triggered vs edge-triggered: why does it matter?', a: '<p>Edge-triggered logic reacts to transitions (“a Pod was deleted”) and breaks when a transition is missed. Level-triggered logic looks at the current state (“there should be 3 Pods; there are 2”) and is correct regardless of history. Kubernetes controllers are level-triggered with periodic resyncs, which makes them robust to restarts, missed watch events and manual changes.</p>', lvl: 'core' },
    { q: 'How do finalizers and owner references differ?', a: '<p><b>Owner references</b> express that a child belongs to a parent; the garbage collector deletes children after the parent is gone (background or foreground cascading, or orphaning on request). <b>Finalizers</b> block the deletion of the object itself until a controller removes its entry, so it can clean up things the GC can’t see (cloud resources, DNS, data). Foreground deletion itself is implemented with the <code>foregroundDeletion</code> finalizer.</p>', lvl: 'core' },
    { q: 'Mutating vs validating admission webhooks, and where do CEL policies fit?', a: '<p>Admission order: mutating webhooks (can change the object, e.g. inject a sidecar or defaults), schema validation, then validating webhooks and policies (accept or reject). Webhooks are external HTTPS services: flexible, but on the critical path of every matching request. <b>CEL</b> runs in the API server: CRD validation rules (GA 1.29) and <b>ValidatingAdmissionPolicy</b> (GA 1.30) for any resource; MutatingAdmissionPolicy is much newer (alpha in 1.32) and not GA in the versions this page targets. Prefer CEL for rules that need no external data.</p>', lvl: 'deep' },
    { q: 'How do you version a CRD?', a: '<p>List several versions in <code>spec.versions</code>; exactly one is the <b>storage</b> version. If schemas differ, a <b>conversion webhook</b> converts between them on read and write (otherwise <code>None</code> conversion only changes apiVersion). To retire a version: stop serving it, migrate stored objects to the new storage version, clear it from <code>status.storedVersions</code>, then remove it.</p>', lvl: 'deep' },
    { q: 'What makes a good custom resource status?', a: '<p>Conditions in the standard shape (<code>type</code>, <code>status</code>, <code>reason</code>, <code>message</code>, <code>lastTransitionTime</code>, <code>observedGeneration</code>), with a top-level <code>Ready</code> (or <code>Available</code>) that tools can wait on; <code>observedGeneration</code>; small summary fields for printer columns. No ever-changing timestamps, no large blobs.</p>', lvl: 'core' },
    { q: 'How would you write an operator in Java?', a: '<p>The <b>Java Operator SDK</b> (built on the Fabric8 client; Quarkus and Spring Boot integrations exist) gives you informers, the queue, retries and finalizer handling: implement <code>Reconciler&lt;T&gt;</code>, optionally <code>Cleaner&lt;T&gt;</code> for finalizer-based cleanup, and declare dependent resources. The trade-offs vs Go’s controller-runtime/Kubebuilder are startup time and memory (native images help), and a smaller ecosystem of examples.</p>', lvl: 'deep' },
    { q: 'When should you not write an operator?', a: '<p>When a Helm chart or Kustomize overlay plus built-in controllers already express the desired state: a stateless service needs a Deployment, not a custom controller. Operators earn their cost when there is ongoing operational logic: ordered scaling, failover, backups, upgrades with data migration, external resources. Every operator is another always-running component with cluster permissions to secure, upgrade and monitor.</p>', lvl: 'core' },
    { q: 'How do you make an operator highly available?', a: '<p>Run 2+ replicas with <b>leader election</b> (a Lease object): only the leader reconciles, the others take over if it stops renewing. Reconcile must be safe to run twice in a row and after a crash mid-way (idempotent, deterministic names). Webhooks served by the operator can run on all replicas, and need a PDB and spread.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'CRD with schema, CEL and status', lang: 'yaml', code: `apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata: { name: postgresclusters.db.example.com }
spec:
  group: db.example.com
  scope: Namespaced
  names: { kind: PostgresCluster, plural: postgresclusters, singular: postgrescluster, shortNames: [pgc] }
  versions:
  - name: v1
    served: true
    storage: true
    subresources: { status: {} }           # status writes don't bump generation
    additionalPrinterColumns:
    - { name: Replicas, type: integer, jsonPath: .spec.replicas }
    - { name: Ready, type: string, jsonPath: '.status.conditions[?(@.type=="Ready")].status' }
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            required: [version]
            properties:
              replicas: { type: integer, minimum: 1, default: 3 }
              version:  { type: string, enum: ["15", "16", "17"] }
              storage:  { type: string, default: 20Gi }
            x-kubernetes-validations:           # CEL, GA in 1.29
            - rule: "self.replicas % 2 == 1"
              message: "replicas must be odd for quorum"
            - rule: "self.version >= oldSelf.version"
              message: "downgrades are not supported"
          status:
            type: object
            x-kubernetes-preserve-unknown-fields: true` },
    { title: 'Reconciler with Java Operator SDK', lang: 'java', code: `// Java Operator SDK 4.x/5.x: implementing Cleaner makes the SDK add and remove a finalizer
@ControllerConfiguration
public class PostgresReconciler implements Reconciler<PostgresCluster>, Cleaner<PostgresCluster> {

    private final KubernetesClient client;
    private final BackupStore backups;

    @Override
    public UpdateControl<PostgresCluster> reconcile(PostgresCluster pg, Context<PostgresCluster> ctx) {
        backups.ensureBucket(pg);                                // idempotent, external

        StatefulSet desired = Manifests.statefulSet(pg);         // deterministic name + ownerReference
        client.resource(desired).serverSideApply();              // create or converge

        StatefulSet actual = ctx.getSecondaryResource(StatefulSet.class).orElse(null);
        boolean ready = actual != null && actual.getStatus() != null
                && Objects.equals(actual.getStatus().getReadyReplicas(), pg.getSpec().getReplicas());

        var status = PostgresStatus.of(pg.getMetadata().getGeneration(), ready);
        if (status.equals(pg.getStatus())) return UpdateControl.noUpdate();
        pg.setStatus(status);
        return UpdateControl.patchStatus(pg);                    // via /status
    }

    @Override
    public DeleteControl cleanup(PostgresCluster pg, Context<PostgresCluster> ctx) {
        backups.finalBackupAndArchive(pg);                       // must tolerate "already done"
        return DeleteControl.defaultDelete();                    // SDK removes the finalizer
    }
}` },
    { title: 'ValidatingAdmissionPolicy (no webhook)', lang: 'yaml', code: `# GA in 1.30: CEL evaluated inside the API server
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata: { name: require-team-label }
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
    - apiGroups: ["apps"]
      apiVersions: ["v1"]
      operations: ["CREATE", "UPDATE"]
      resources: ["deployments"]
  validations:
  - expression: "has(object.metadata.labels) && 'team' in object.metadata.labels"
    message: "Deployments must have a 'team' label"
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata: { name: require-team-label }
spec:
  policyName: require-team-label
  validationActions: [Deny]          # or [Warn, Audit] while rolling out
  matchResources:
    namespaceSelector:
      matchLabels: { tenant: "true" }` },
    { title: 'Inspect and unstick', lang: 'bash', code: `# what is blocking this deletion?
kubectl get postgrescluster main-db -n shop -o jsonpath='{.metadata.deletionTimestamp} {.metadata.finalizers}'
kubectl get ns shop -o jsonpath='{.status.conditions[?(@.type=="NamespaceFinalizersRemaining")].message}'

# which webhooks are on the request path?
kubectl get validatingwebhookconfigurations,mutatingwebhookconfigurations \\
  -o custom-columns=NAME:.metadata.name,POLICY:.webhooks[*].failurePolicy,TIMEOUT:.webhooks[*].timeoutSeconds

# who owns this object?
kubectl get sts main-db -n shop -o jsonpath='{.metadata.ownerReferences[*].kind}/{.metadata.ownerReferences[*].name}'

# last resort (cleanup will NOT run):
kubectl patch postgrescluster main-db -n shop --type=merge -p '{"metadata":{"finalizers":null}}'` }
  ]
});

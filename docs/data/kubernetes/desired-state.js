IA.register({
  track: 'kubernetes',
  slug: 'desired-state',
  title: 'Desired state & reconciliation',
  tagline: 'You don’t tell Kubernetes what to <i>do</i>. You tell it what should be <b>true</b>, and controllers keep making it true: observe → diff → act, forever. <b>Labels</b> decide what a controller counts; <b>ownerReferences</b> decide what gets cleaned up.',
  tldr: {
    problem: 'Hotfixes that undo themselves, replica counts that bounce on every deploy, pods that survive their Deployment, namespaces stuck in Terminating. All come from fighting the reconciliation model instead of using it.',
    model: 'Every object has a <code>spec</code> (desired) and a <code>status</code> (observed). A controller watches both, computes the difference and takes the smallest action to close it. It acts on the <b>current level</b>, not on the event that woke it, so it heals after missed events and restarts.',
    hook: '“Why does my <code>kubectl scale</code> keep getting reverted?” Because something else (GitOps, a CI <code>apply</code>, an HPA) owns that field and reconciles it back.',
    facts: [
      { v: 'level', l: 'controllers are level-triggered: each sync compares the whole current state with the spec, so a lost event is healed by the next sync' },
      { v: '3', l: 'deletion propagation policies: Background (kubectl’s default), Foreground and Orphan' },
      { v: 'immutable', l: 'a Deployment’s <code>spec.selector</code> in <code>apps/v1</code>. Changing it means deleting and recreating the Deployment' }
    ]
  },
  intro: {
    what: 'In Kubernetes you write down the <b>end result</b> you want: “three copies of this app, version 5”. That description is stored, and small programs called <b>controllers</b> watch it. Each one keeps comparing what you asked for with what actually exists and fixes any difference: start a missing copy, remove an extra one. Nobody needs to give step-by-step orders, and if something breaks at 3 a.m., the same loop repairs it.',
    analogy: { icon: '🌡️', title: 'A thermostat', text: 'You set 21 °C (desired state). The thermostat keeps measuring the room (observe), compares (diff), and switches the heating on or off (act). It doesn’t care <i>why</i> the room got cold: a window, the night, a broken radiator. It just closes the gap, again and again. Opening the window and shouting “heat on!” (an imperative command) only helps until the thermostat’s next check.' },
    steps: [
      { t: 'Declare, don’t command', d: 'A manifest says what should exist. <code>kubectl apply</code> stores it; the cluster works out the steps.', code: 'kubectl apply -f web.yaml       # declarative\nkubectl scale deploy web --replicas=5   # imperative: a one-off change', lang: 'bash' },
      { t: 'spec vs status', d: 'You write <code>spec</code>. Controllers write <code>status</code>. <code>status.observedGeneration</code> tells you whether the controller has seen your latest spec.', code: 'kubectl get deploy web -o jsonpath=\'{.metadata.generation} {.status.observedGeneration}\'', lang: 'bash' },
      { t: 'Labels and selectors connect things', d: 'A ReplicaSet counts pods whose labels match its selector. A Service sends traffic to pods matching its selector. Change a label and the pod drops out of both.' },
      { t: 'Owner references clean up', d: 'Each pod records which ReplicaSet owns it; each ReplicaSet records its Deployment. Delete the owner and the garbage collector deletes the dependents.' }
    ],
    terms: [
      ['desired state', 'What the <code>spec</code> of an object says should exist.'],
      ['controller', 'A loop that watches objects and acts to make actual state match desired state.'],
      ['reconcile', 'One pass of a controller: observe, compare, act.'],
      ['label / selector', 'Key-value tags on objects, and the queries (<code>app=web</code>, <code>tier in (api,web)</code>) that pick objects by them.'],
      ['ownerReference', 'A pointer in an object’s metadata to the object that owns it; drives garbage collection.'],
      ['finalizer', 'A key in <code>metadata.finalizers</code> that blocks deletion until a controller has done its cleanup and removed it.']
    ]
  },
  visual: {
    title: 'A ReplicaSet controller’s reconcile loop',
    caption: 'Press Play. Each step changes the world (a pod dies, someone scales, someone relabels a pod), and the loop observes → diffs → acts. Pick a deletion policy before the last step to see how garbage collection follows ownerReferences.'
  },
  gotchas: [
    { trap: 'Imperative hotfixes get reverted', code: `kubectl scale deploy web --replicas=10   # 02:00, incident
# 02:03 Argo CD self-heal syncs git: replicas: 4`, lang: 'bash', why: 'With GitOps or a CI pipeline that runs <code>kubectl apply</code>, git is the desired state. Your change is <b>drift</b>, and the next sync “fixes” it.', fix: 'Change the manifest in git, or pause sync deliberately for the incident and record it. For capacity, let an HPA own replicas.' },
    { trap: '<code>replicas</code> in the manifest fights the HPA', why: 'The HPA writes <code>spec.replicas</code>. Every <code>kubectl apply</code> of a manifest that also sets it resets the count to the file’s value, and then the HPA scales again. Under load that is a capacity drop on every deploy.', fix: 'Remove <code>replicas</code> from the manifest once an HPA exists. With server-side apply the field has two managers, so make sure only the HPA owns it.' },
    { trap: 'Overlapping selectors', code: `# Deployment web-v1: selector app=web
# Deployment web-v2: selector app=web   ← same!
# Service web:       selector app=web   → traffic to both`, why: 'Controllers do not steal pods that already have a controller owner, but a Service, PDB or NetworkPolicy matches by label only. Leftover or overlapping workloads silently join the traffic pool.', fix: 'Give each workload a unique label (<code>app</code> + <code>version</code> or <code>component</code>) in its selector. Check with <code>kubectl get pods -l app=web --show-labels</code>.' },
    { trap: 'Relabelling a pod “to debug it” leaks it', why: 'Removing the selector label makes the ReplicaSet release the pod (it drops the ownerReference) and create a replacement. The old pod keeps running, consuming requests, with no owner to ever delete it.', fix: 'It is a valid quarantine trick (out of the Service, still inspectable), but delete the pod when done. Find orphans: pods without <code>ownerReferences</code>.' },
    { trap: 'A namespace stuck in Terminating', why: 'Namespace deletion waits until every object inside is gone. An object with a <b>finalizer</b> whose controller has been uninstalled (an operator’s CR, a load balancer) can never be finalized.', fix: 'Find what is left with <code>kubectl api-resources --verbs=list --namespaced -o name | xargs -n1 kubectl get -n ns --ignore-not-found</code>. Reinstall the controller, or remove the finalizer only once you are sure the external cleanup has been done.' },
    { trap: 'Client-side apply forgets fields you removed', why: 'Client-side <code>kubectl apply</code> computes a three-way merge using the <code>last-applied-configuration</code> annotation. Fields added with <code>kubectl edit</code> or <code>create</code> are not in it, so deleting them from your file does nothing.', fix: 'Use <code>kubectl apply --server-side</code>: the API server tracks which manager owns each field in <code>managedFields</code> and reports conflicts. Preview with <code>kubectl diff</code>.' }
  ],
  scenarios: [
    { title: 'Replicas drop from 12 to 3 on every deploy',
      symptom: 'Every afternoon deploy causes a latency spike. The HPA graph shows replicas falling to 3 right after the deploy, then climbing back over a few minutes.',
      diagnose: `kubectl get deploy web -o yaml --show-managed-fields | grep -B2 -A6 'f:replicas'
#   manager: kubectl-client-side-apply   ← CI sets replicas: 3
#   manager: kube-controller-manager / horizontal-pod-autoscaler
git grep -n 'replicas:' k8s/web/`,
      cause: 'The manifest still had <code>replicas: 3</code>. Each CI apply set the Deployment back to 3, killing nine warm pods; the HPA then had to scale back up through JVM warm-up.',
      fix: 'Delete <code>replicas</code> from the manifest; the HPA owns it. If you use server-side apply, also drop the CI manager’s ownership of the field.',
      fixCode: `# deployment.yaml: no replicas field when an HPA manages it
spec:
  selector: { matchLabels: { app: web } }
  template: ...
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: web }
  minReplicas: 4
  maxReplicas: 20` },
    { title: 'Half the traffic still hits the old version after a migration',
      symptom: 'The team moved <code>web</code> to a new Helm chart. Some requests return old responses, and old pod names show up in access logs.',
      diagnose: `kubectl get pods -l app=web -L app.kubernetes.io/version
kubectl get pod web-6f4-abc -o jsonpath='{.metadata.ownerReferences}'
#   (empty) → orphaned`,
      cause: 'The old Deployment was deleted with <code>--cascade=orphan</code> “to avoid downtime”. Its ReplicaSet was deleted too, but the pods kept running with no owner and kept the <code>app=web</code> label, so the new Service selected them as well.',
      fix: 'Delete the orphans explicitly, and use distinct selectors per release so leftovers cannot join a Service.',
      fixCode: `kubectl get pods -l app=web -o json \\
  | jq -r '.items[] | select(.metadata.ownerReferences == null) | .metadata.name' \\
  | xargs kubectl delete pod`, lang: 'bash' },
    { title: 'A namespace has been Terminating for three days',
      symptom: '<code>kubectl delete ns feature-x</code> never finishes. The namespace status shows <code>NamespaceFinalizersRemaining</code>.',
      diagnose: `kubectl get ns feature-x -o jsonpath='{.status.conditions}' | jq
#   "Some content in the namespace has finalizers remaining: databases.example.com/cleanup"
kubectl get databases.example.com -n feature-x -o jsonpath='{.items[*].metadata.finalizers}'`,
      cause: 'A <code>Database</code> custom resource has a finalizer that the database operator should remove after deleting the real cloud database. The operator had been uninstalled first, so nothing will ever remove it.',
      fix: 'Reinstall the operator so it can clean up properly. If the external resource is already gone, remove the finalizer by hand, knowing that any external cleanup is now your job.',
      fixCode: `kubectl patch databases.example.com orders-db -n feature-x \\
  --type=merge -p '{"metadata":{"finalizers":null}}'`, lang: 'bash' }
  ],
  puzzles: [
    { kind: 'scenario', q: 'A ReplicaSet has <code>replicas: 3</code>, selector <code>app=web</code>. You run <code>kubectl label pod web-x app=debug --overwrite</code>. A minute later, how many pods exist in total?', options: ['3: web-x is deleted', '3: web-x is kept, no replacement', '4: web-x is released and a replacement is created', '2: the ReplicaSet scales down'], answer: 2, explain: 'The ReplicaSet now counts 2 matching pods, so it creates one more. It also <b>releases</b> web-x by removing its ownerReference. web-x keeps running, out of the Service, with nobody to delete it.' },
    { kind: 'scenario', q: 'ReplicaSet web (replicas 3) is healthy. You create a bare pod with label <code>app=web</code> and no owner. What happens?', options: ['Nothing: the bare pod is ignored', 'The ReplicaSet adopts it, sees 4, and deletes one pod', 'The API server rejects the pod', 'The ReplicaSet scales to 4'], answer: 1, explain: 'A controller <b>adopts</b> orphans that match its selector and have no controller owner. Then it has 4 for a desired 3 and deletes one, preferring pods that are not yet ready or are newer, so it is often yours.' },
    { kind: 'scenario', q: 'You run <code>kubectl delete rs web-7c9 --cascade=orphan</code>, then apply a new ReplicaSet with the same selector and <code>replicas: 3</code>. How many new pods are created?', options: ['3', '0: it adopts the three orphans', '6 pods end up running', 'It fails: the selector is in use'], answer: 1, explain: 'Orphaning removes the ownerReferences; the pods keep running. The new ReplicaSet finds 3 matching, unowned pods and adopts them. (It counts by selector, so it adopts them even if their pod template differs from its own.)' },
    { kind: 'scenario', q: 'The ReplicaSet controller was down for 10 minutes. During that time 2 of 5 pods were deleted. What happens when it starts?', options: ['Nothing: it missed the delete events', 'It re-lists, sees 3 of 5, and creates 2', 'It replays the two delete events from etcd', 'It waits for the next pod event'], answer: 1, explain: 'Controllers are <b>level-triggered</b>: on start they LIST everything, then WATCH. Each reconcile compares current state with spec, so missed events don’t matter. That is the central design choice.' },
    { kind: 'concept', q: 'Which pod matches this selector?', code: `selector:
  matchLabels: { app: shop }
  matchExpressions:
  - { key: tier, operator: In, values: [web, api] }
  - { key: canary, operator: DoesNotExist }`, options: ['app=shop, tier=worker', 'app=shop, tier=api, canary=true', 'app=shop, tier=web', 'tier=web'], answer: 2, explain: 'All requirements are <b>AND</b>ed: app must be shop, tier must be web or api, and there must be no <code>canary</code> label at all. Only <code>app=shop, tier=web</code> satisfies all three.' },
    { kind: 'scenario', q: 'You delete a Deployment with <code>--cascade=foreground</code>. What do you see while it runs?', options: ['The Deployment disappears at once; pods vanish later', 'The Deployment stays, with a deletionTimestamp and the <code>foregroundDeletion</code> finalizer, until its ReplicaSets and pods are gone', 'Pods keep running, unowned', 'The Deployment scales to 0, then is deleted by its controller'], answer: 1, explain: 'Foreground: the owner is marked for deletion and blocked by the <code>foregroundDeletion</code> finalizer while the garbage collector deletes dependents (those with <code>blockOwnerDeletion: true</code> must be gone first). Background (the default) deletes the owner immediately and cleans up dependents afterwards.' },
    { kind: 'scenario', q: 'At 02:00 you run <code>kubectl scale deploy web --replicas=10</code>. Argo CD manages the app with self-heal on, and git says <code>replicas: 4</code>. What happens?', options: ['Stays at 10 until the next commit', 'Argo CD detects drift and syncs back to 4, usually within minutes', 'Argo CD updates git to 10', 'The scale command is rejected'], answer: 1, explain: 'With self-heal, any live difference from git is drift and gets reverted. The durable fix is a commit, or an HPA owning <code>replicas</code> (and the field removed from git or ignored in Argo CD).' }
  ],
  interview: [
    { q: 'Declarative vs imperative: what is the difference in Kubernetes?', a: '<p>Imperative: you issue operations (<code>kubectl run</code>, <code>scale</code>, <code>set image</code>, <code>delete</code>). Declarative: you store the desired end state (<code>kubectl apply</code>, GitOps) and controllers converge to it. Declarative configs are reviewable, repeatable and self-healing, and they are the only kind that survive a sync. Imperative is fine for exploration and emergencies, as long as the source of truth is updated afterwards.</p>', lvl: 'core' },
    { q: 'What is a controller, and what does level-triggered mean?', a: '<p>A control loop: watch the objects it cares about, and for each changed key run <code>reconcile(key)</code> that reads current spec and status, compares with reality and acts. <b>Level-triggered</b> means reconcile looks at the current state, not at what the event said. Events only say “look at this key again”. So duplicates, missed events and restarts are harmless, and reconcile must be <b>idempotent</b>.</p>', fu: 'How does a controller avoid hot-looping on errors? (Rate-limited work queue with exponential back-off per key.)', lvl: 'deep' },
    { q: 'How does a Deployment know which pods are its own?', a: '<p>Two mechanisms. The <b>selector</b> decides which pods count. The <b>ownerReference</b> (with <code>controller: true</code>) says who manages a pod, so two controllers with overlapping selectors don’t fight. The Deployment owns ReplicaSets; each ReplicaSet owns pods. The <code>pod-template-hash</code> label keeps ReplicaSets of different template versions from matching each other’s pods.</p>', lvl: 'core' },
    { q: 'How does garbage collection work?', a: '<p>Dependents list owners in <code>metadata.ownerReferences</code>. When an owner is deleted the garbage collector, part of kube-controller-manager, deletes the dependents according to the propagation policy: <b>Background</b> (owner gone at once, dependents deleted after), <b>Foreground</b> (owner kept with a <code>foregroundDeletion</code> finalizer until dependents with <code>blockOwnerDeletion</code> are gone) or <b>Orphan</b> (ownerReferences removed, dependents kept). Owner references must stay within a namespace, or point from namespaced objects to cluster-scoped owners.</p>', lvl: 'deep' },
    { q: 'What is a finalizer, and why do things get stuck in Terminating?', a: '<p>A finalizer is a string in <code>metadata.finalizers</code>. A delete request on an object with finalizers only sets <code>deletionTimestamp</code>; the object stays until every finalizer is removed. Controllers use this to clean up external resources (cloud load balancers, PV storage, a database) first. If the responsible controller is missing or failing, the object is stuck. Removing the finalizer by hand skips that cleanup.</p>', lvl: 'core' },
    { q: 'Labels vs annotations?', a: '<p><b>Labels</b> are for identifying and selecting: short values, indexed, used by selectors in Services, ReplicaSets, NetworkPolicies, PDBs and <code>kubectl -l</code>. <b>Annotations</b> are for non-identifying metadata read by tools: build info, checksums, ingress controller settings, <code>last-applied-configuration</code>. They are not selectable and can be larger.</p>', lvl: 'core' },
    { q: 'What are equality-based and set-based selectors?', a: '<p>Equality: <code>app=web</code>, <code>tier!=cache</code>. Set-based: <code>env in (prod,staging)</code>, <code>tier notin (cache)</code>, <code>canary</code> (exists), <code>!canary</code> (does not exist). In YAML, <code>matchLabels</code> and <code>matchExpressions</code> are ANDed. Services only support <code>matchLabels</code>-style equality selectors; workloads support both.</p>', lvl: 'core' },
    { q: 'How do concurrent writers avoid overwriting each other?', a: '<p><b>Optimistic concurrency</b>: every object has a <code>resourceVersion</code>. An update that carries a stale one is rejected with <code>409 Conflict</code>, and the client re-reads and retries. Server-side apply adds field-level <b>ownership</b>: each field records its manager in <code>managedFields</code>, and applying a field owned by another manager is a conflict unless you <code>--force-conflicts</code>.</p>', lvl: 'deep' },
    { q: 'What are generation and observedGeneration?', a: '<p><code>metadata.generation</code> increments whenever the <code>spec</code> changes. A controller writes <code>status.observedGeneration</code> when it has processed that spec. If they differ, the status describes an older spec. <code>kubectl rollout status</code> relies on this to avoid reporting success for the previous rollout.</p>', lvl: 'deep' },
    { q: 'How do operators extend this model?', a: '<p>An operator is a custom controller for a custom resource (CRD): you declare <code>kind: PostgresCluster, replicas: 3</code> and its reconcile loop creates StatefulSets, Services, backups and failover logic. Same contract: watch, diff, act, idempotent, status reporting, finalizers for external cleanup. See <a href="operators-crds.html">Operators & CRDs</a>.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Inspect owners, labels and drift', lang: 'bash', code: `# what would change if I applied this file? (server-side dry run diff)
kubectl diff -f k8s/web/

# owner chain: pod → ReplicaSet → Deployment
kubectl get pod web-7c9-x2k -o jsonpath='{.metadata.ownerReferences[0].kind}/{.metadata.ownerReferences[0].name}'
kubectl get rs web-7c9 -o jsonpath='{.metadata.ownerReferences[0].kind}/{.metadata.ownerReferences[0].name}'

# set-based selector on the command line
kubectl get pods -l 'app=shop,tier in (web,api),!canary' --show-labels

# deletion policies
kubectl delete deploy web                      # background (default)
kubectl delete deploy web --cascade=foreground
kubectl delete deploy web --cascade=orphan     # pods keep running, unowned

# server-side apply with an explicit field manager
kubectl apply --server-side --field-manager=ci -f k8s/web/` },
    { title: 'Selectors and labels done right', lang: 'yaml', code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  labels: { app.kubernetes.io/name: web, app.kubernetes.io/part-of: shop }
spec:
  selector:                     # immutable in apps/v1: choose carefully
    matchLabels:
      app.kubernetes.io/name: web
      app.kubernetes.io/instance: web-prod
  template:
    metadata:
      labels:
        app.kubernetes.io/name: web
        app.kubernetes.io/instance: web-prod
        app.kubernetes.io/version: "5.0.3"      # not in the selector: changes per release
      annotations:
        checksum/config: "9f2c…"                # roll pods when config changes
    spec:
      containers:
      - name: app
        image: registry/web:5.0.3`, note: 'Put only stable identity labels in the selector. Version labels go on the template, where they can change.' },
    { title: 'A reconcile loop in Java (Java Operator SDK)', lang: 'java', code: `@ControllerConfiguration
public class CacheReconciler implements Reconciler<Cache> {

    @Override
    public UpdateControl<Cache> reconcile(Cache cache, Context<Cache> ctx) {
        int desired = cache.getSpec().getReplicas();
        var pods = ctx.getClient().pods().inNamespace(cache.getMetadata().getNamespace())
            .withLabel("cache", cache.getMetadata().getName()).list().getItems();

        // level-triggered: compare the WHOLE current state with the spec, every time
        if (pods.size() < desired) createPod(cache, ctx);        // sets ownerReference → GC works
        else if (pods.size() > desired) deletePod(pods.get(0), ctx);

        cache.setStatus(new CacheStatus(pods.size(), cache.getMetadata().getGeneration()));
        return UpdateControl.patchStatus(cache);                  // observedGeneration
    }
}`, note: 'Idempotent: running it twice with no change in the world does nothing. Create one pod per pass and let the next event trigger the next pass.' }
  ]
});

IA.register({
  track: 'kubernetes',
  slug: 'deployments-rollouts',
  title: 'Deployments & rollouts',
  tagline: 'A Deployment never touches pods. It manages <b>ReplicaSets</b>, one per version of the pod template, and a rolling update is just two ReplicaSets scaled in opposite directions inside the <code>maxSurge</code> / <code>maxUnavailable</code> budget. Rollback is the same move pointed backwards.',
  tldr: {
    problem: 'Releases that “succeed” in two minutes and take production down, rollouts stuck at one new pod for ten minutes, rollbacks that don’t fix anything. Each one is a misread of how the rollout loop counts pods.',
    model: 'Each sync: scale the new ReplicaSet <b>up</b> while total pods ≤ replicas + maxSurge, then scale old ReplicaSets <b>down</b> while available pods ≥ replicas − maxUnavailable. “Available” means Ready for at least <code>minReadySeconds</code>. No readiness, no safety.',
    hook: '“What do maxSurge and maxUnavailable actually limit?” Surge caps how many <b>extra</b> pods may exist; unavailable caps how far <b>available</b> capacity may drop. Both 0 is rejected.',
    facts: [
      { v: '25% / 25%', l: 'default maxSurge / maxUnavailable. Surge rounds <b>up</b>, unavailable rounds <b>down</b>: with 4 replicas that is +1 / −1, with 10 it is +3 / −2' },
      { v: '600 s', l: 'default <code>progressDeadlineSeconds</code>. After it the rollout is marked failed (ProgressDeadlineExceeded). Nothing is rolled back automatically' },
      { v: '10', l: 'default <code>revisionHistoryLimit</code>: old ReplicaSets kept at 0 replicas so <code>rollout undo</code> has something to go back to' }
    ]
  },
  intro: {
    what: 'A <b>Deployment</b> is how you run a long-lived service: “keep 4 copies of version 5 running”. When you change the version, it doesn’t stop everything and start again. It brings up new copies a few at a time and removes old ones as the new ones become <b>ready</b>, so users never notice. Behind the scenes each version has its own <b>ReplicaSet</b>, the object that keeps a fixed number of identical pods alive.',
    analogy: { icon: '🚌', title: 'Swapping buses on a busy route', text: 'You have 4 buses on a route and want to replace them with new ones without leaving passengers waiting. Rule one: never more than 5 buses on the road (maxSurge 1, the depot is small). Rule two: never fewer than 3 carrying passengers (maxUnavailable 1). A new bus only counts once it has passed its safety check (readiness). Rollback means sending the old buses back out under the same two rules.' },
    steps: [
      { t: 'Deployment → ReplicaSet → Pods', d: 'The Deployment creates a ReplicaSet named after a hash of the pod template. The ReplicaSet creates the pods.', code: 'kubectl get deploy,rs,pods -l app=web', lang: 'bash' },
      { t: 'Change the template, get a rollout', d: 'Only a change to <code>spec.template</code> (image, env, resources, labels…) starts a rollout. Scaling does not.', code: 'kubectl set image deploy/web app=registry/web:5.1', lang: 'bash' },
      { t: 'Old and new run side by side', d: 'The new ReplicaSet grows and the old one shrinks, a few pods at a time, gated by readiness.', code: 'kubectl rollout status deploy/web --timeout=5m', lang: 'bash' },
      { t: 'Going back', d: 'Old ReplicaSets are kept, scaled to 0. Undo copies the previous template back into the Deployment.', code: 'kubectl rollout history deploy/web\nkubectl rollout undo deploy/web', lang: 'bash' }
    ],
    terms: [
      ['ReplicaSet', 'Keeps N identical pods matching its selector. Rarely created by hand; Deployments manage them.'],
      ['revision', 'A numbered version of the pod template, stored on its ReplicaSet as an annotation.'],
      ['maxSurge', 'How many pods above <code>replicas</code> may exist during a rollout (number or %).'],
      ['maxUnavailable', 'How many pods below <code>replicas</code> may be unavailable during a rollout (number or %).'],
      ['available', 'Ready, and has stayed Ready for <code>minReadySeconds</code>.'],
      ['blue-green / canary', 'Release strategies: switch all traffic between two full versions, or send a small share to the new one first.']
    ]
  },
  visual: {
    title: 'Run a rolling update, one controller sync at a time',
    caption: 'Pick replicas, <code>maxSurge</code> and <code>maxUnavailable</code>, and whether v2 passes readiness. Press Play or Step: each step is one sync of the Deployment controller. Watch the two limits in the stats line. With a broken v2, keep stepping to see the deadline and a rollback.'
  },
  extras: [
    { id: 'deployments-rollouts-strategies', title: 'Rolling vs blue-green vs canary', label: 'Strategies', caption: 'The same v1 → v2 release, three ways. Step through and compare how many pods exist and where the traffic goes at each moment.' }
  ],
  gotchas: [
    { trap: 'No readiness probe: every rollout “succeeds”', why: 'Without a readiness probe a pod is Ready as soon as its containers start. The controller sees new pods available at once and deletes old ones, even if the new JVM fails its first request or crashes after 30 s.', fix: 'Add a readiness probe on <code>/actuator/health/readiness</code>, set <code>minReadySeconds</code> (e.g. 10–30 s) so a pod must stay Ready for a while before it counts, and gate CI on <code>kubectl rollout status</code>. See <a href="probes.html">Probes</a>.' },
    { trap: 'Rollback doesn’t roll back your ConfigMap', why: '<code>rollout undo</code> restores the <b>pod template</b>. If the template references <code>configMapRef: app-config</code> and the bad change was inside that ConfigMap, the “old” template still points at the new contents. Also: editing a ConfigMap does not start a rollout at all.', fix: 'Use versioned, immutable ConfigMaps (Kustomize <code>configMapGenerator</code> appends a content hash; Helm can add a <code>checksum/config</code> annotation). Then config changes roll out, and roll back, like code.' },
    { trap: '<code>maxUnavailable: 0</code> with no spare capacity', why: 'With unavailable 0 the controller may only remove an old pod after a <b>surge</b> pod is ready. If the cluster or the namespace quota has no room for that extra pod, it stays Pending and the rollout stalls until the deadline.', fix: 'Leave headroom (or a cluster autoscaler), or allow <code>maxUnavailable: 1</code> when replicas are large enough to lose one. Check <code>kubectl describe pod</code> for FailedScheduling.' },
    { trap: 'Rolling update with a ReadWriteOnce volume', why: 'The new pod may land on another node while the old pod still has the RWO volume attached. It hangs in ContainerCreating with a <code>Multi-Attach error</code>, and with maxUnavailable 0 the old pod never goes away.', fix: 'Use <code>strategy: Recreate</code> for single-writer apps (accepting downtime), or a StatefulSet. Better, move state out of the pod.' },
    { trap: '<code>kubectl rollout undo</code> fights GitOps', why: 'Undo changes the live Deployment. The next CI apply or Argo CD sync puts the bad template back, and the bad version rolls out again.', fix: 'Roll back by reverting the commit. Use <code>rollout undo</code> only as an emergency brake, and suspend auto-sync while you do.' },
    { trap: 'PodDisruptionBudgets don’t protect rollouts', why: 'A PDB limits <b>evictions</b> (drains, autoscaler). The Deployment controller scales ReplicaSets directly and ignores PDBs; only <code>maxUnavailable</code> limits a rollout.', fix: 'Set both: <code>maxUnavailable</code> for rollouts, a PDB for node maintenance. See <a href="disruptions-pdb.html">Disruptions & PDBs</a>.' }
  ],
  scenarios: [
    { title: 'A broken release rolled out “successfully” and took down checkout',
      symptom: 'v5.1 rolled out in 90 seconds; CI was green. Within a minute every checkout request returned 500. All pods showed <code>1/1 Running</code>.',
      diagnose: `kubectl get deploy checkout -o jsonpath='{.spec.template.spec.containers[0].readinessProbe}'
#   (empty)
kubectl rollout history deploy/checkout
kubectl logs deploy/checkout | grep -m3 ERROR   # missing DB column → 500 on first query`,
      cause: 'No readiness probe and <code>minReadySeconds: 0</code>. Each new pod counted as available the moment the container started, so the controller replaced all old pods before any new one had served a request.',
      fix: 'Roll back immediately, then add a real readiness probe and minReadySeconds, and block the pipeline on rollout status.',
      fixCode: `spec:
  minReadySeconds: 20
  progressDeadlineSeconds: 300
  strategy:
    rollingUpdate: { maxSurge: 1, maxUnavailable: 0 }
  template:
    spec:
      containers:
      - name: app
        readinessProbe:
          httpGet: { path: /actuator/health/readiness, port: 8080 }
          periodSeconds: 5
          failureThreshold: 3` },
    { title: 'Rollout stuck at “1 of 6 updated” for ten minutes',
      symptom: '<code>kubectl rollout status</code> prints <code>Waiting for deployment "web" rollout to finish: 1 out of 6 new replicas have been updated...</code> and then times out with ProgressDeadlineExceeded.',
      diagnose: `kubectl get pods -l app=web
#   web-5f8-k2l   0/1   Pending   ← the one surge pod
kubectl describe pod web-5f8-k2l | tail -3
#   0/12 nodes are available: 12 Insufficient cpu.`,
      cause: '<code>maxUnavailable: 0, maxSurge: 1</code> on a full cluster. The surge pod could not be scheduled, so no old pod could be removed, so no room was ever freed.',
      fix: 'Short term: allow one unavailable pod so the controller can free room first. Long term: capacity headroom or a cluster autoscaler, and right-sized requests.',
      fixCode: `kubectl patch deploy web -p '{"spec":{"strategy":{"rollingUpdate":{"maxSurge":1,"maxUnavailable":1}}}}'`, lang: 'bash' },
    { title: 'Rollback made no difference',
      symptom: 'After a release, search results were empty. The team ran <code>kubectl rollout undo</code>; old image, same problem.',
      diagnose: `kubectl rollout history deploy/search --revision=7 | grep -A3 Environment
#   envFrom: configmap search-config
kubectl get cm search-config -o yaml | grep index.name   # changed in the same release`,
      cause: 'The release changed both the image and the shared ConfigMap <code>search-config</code>. Undo restored the old pod template, which still referenced the same ConfigMap name, with its new contents.',
      fix: 'Generate ConfigMaps with a content hash in the name, so each pod template pins its own config, and rolling back the template rolls back the config.',
      fixCode: `# kustomization.yaml
configMapGenerator:
- name: search-config            # becomes search-config-7h2k9g4c8t
  files: [application.yaml]
generatorOptions:
  disableNameSuffixHash: false` }
  ],
  puzzles: [
    { kind: 'predict', q: '<code>replicas: 10</code>, <code>maxSurge: 25%</code>, <code>maxUnavailable: 25%</code>. During the rollout, what are the max total pods and the min available pods?', options: ['12 and 8', '13 and 8', '13 and 7', '12 and 7'], answer: 1, explain: 'maxSurge rounds <b>up</b>: ⌈2.5⌉ = 3, so up to 13 pods. maxUnavailable rounds <b>down</b>: ⌊2.5⌋ = 2, so at least 8 available. Rounding both ways errs on the side of availability.' },
    { kind: 'scenario', q: 'You set <code>maxSurge: 0</code> and <code>maxUnavailable: 0</code>. What happens?', options: ['The rollout replaces pods one at a time', 'The API server rejects the Deployment', 'The rollout never makes progress', 'It falls back to Recreate'], answer: 1, explain: 'Validation rejects it: with no surge and no unavailability the controller could never replace a single pod. One of the two must be greater than zero.' },
    { kind: 'scenario', q: '4 replicas, maxSurge 1, maxUnavailable 0. v2 never passes readiness. After 15 minutes, what is the state?', options: ['4 v2 pods crash-looping', '4 v1 pods serving, 1 v2 pod not ready, condition ProgressDeadlineExceeded', 'Automatically rolled back to v1', '3 v1 pods and 2 v2 pods'], answer: 1, explain: 'The controller surges one v2 pod but may never remove a v1 pod (that would drop availability below 4). After <code>progressDeadlineSeconds</code> (600 s) it sets <code>Progressing=False</code>, reason ProgressDeadlineExceeded, and stops there. Rollback is your job (or a tool like Argo Rollouts).' },
    { kind: 'scenario', q: 'Revisions 1, 2 and 3 exist; 3 is live. You run <code>kubectl rollout undo deploy/web</code>. What does <code>rollout history</code> show afterwards?', options: ['1, 2 (3 is deleted)', '1, 2, 3 with 2 marked live', '1, 3, 4: revision 2’s template became revision 4', '1, 2, 3, 4 with 4 a copy of 3'], answer: 2, explain: 'Undo copies revision 2’s template into the Deployment. The matching ReplicaSet is reused and gets the next revision number, 4. A revision number lives on only one ReplicaSet, so 2 disappears from the list.' },
    { kind: 'scenario', q: 'You change a value in the ConfigMap that the Deployment loads with <code>envFrom</code>. What happens to running pods?', options: ['A rolling update starts', 'Pods restart in place', 'Nothing: env vars are read once at container start, and the template did not change', 'The env vars update live'], answer: 2, explain: 'Only <code>spec.template</code> changes trigger rollouts. Environment variables are fixed at container start. (Volume-mounted ConfigMaps do update the files after a delay, unless mounted with <code>subPath</code>.) Use a hashed name or checksum annotation, or <code>kubectl rollout restart</code>.' },
    { kind: 'scenario', q: 'Mid-rollout from v1 to v2 (half done), you push v3. What does the controller do?', options: ['Finish v2, then start v3', 'Reject the update until v2 completes', '“Rollover”: start scaling up v3 right away and scale down both v1 and v2', 'Roll back to v1 first'], answer: 2, explain: 'The Deployment controller always moves toward the <b>current</b> template. v3 becomes the new ReplicaSet; v1 and v2 are both “old” and are scaled down within the same surge/unavailable budget.' },
    { kind: 'concept', q: 'For a blue-green release using two Deployments (<code>web-blue</code>, <code>web-green</code>), what performs the actual switch?', options: ['kubectl rollout undo', 'Changing the Service’s selector from <code>version: blue</code> to <code>version: green</code>', 'Setting maxSurge: 100%', 'A PodDisruptionBudget'], answer: 1, explain: 'Both fleets run at full size; the Service (or an HTTPRoute) selects one. Switching the selector moves all new connections at once, and switching back is just as fast. Long-lived connections stay on the old pods until they close.' }
  ],
  interview: [
    { q: 'Why does a Deployment use ReplicaSets instead of managing pods itself?', a: '<p>Separation of concerns. A ReplicaSet does one thing: keep N pods of <b>one</b> template. A Deployment handles change: it creates a new ReplicaSet per template version (named by the <code>pod-template-hash</code>) and moves replicas between them. Old ReplicaSets at 0 replicas are the rollout history, which makes rollback just “scale the old one up again”.</p>', lvl: 'core' },
    { q: 'Explain maxSurge and maxUnavailable precisely.', a: '<p>During a rollout: total pods ≤ <code>replicas + maxSurge</code>, available pods ≥ <code>replicas − maxUnavailable</code>. Percentages are of desired replicas; surge rounds up, unavailable rounds down. Surge 1 / unavailable 0 is the safest (needs one pod of headroom); surge 0 / unavailable 1 needs no extra capacity but drops one pod of capacity; 25%/25% (the default) is faster on larger fleets.</p>', fu: 'Which setting would you use for a 2-replica service with a 60 s JVM warm-up? (Surge 1, unavailable 0, plus minReadySeconds and a startup probe.)', lvl: 'core' },
    { q: 'What does “available” mean, and why does minReadySeconds matter?', a: '<p>A pod is available when it has been Ready for at least <code>minReadySeconds</code> (default 0). The rollout counts only available pods. With 0, a pod that passes readiness once and crashes 5 s later still lets the rollout proceed. A modest value catches crash-after-start bugs before old pods are removed.</p>', lvl: 'core' },
    { q: 'How does rollback work?', a: '<p><code>kubectl rollout undo</code> copies the template of the previous revision (or <code>--to-revision=N</code>) into the Deployment. That is an ordinary rollout: the matching old ReplicaSet scales up and the current one scales down, under the same surge and unavailable limits. It only covers the pod template, not ConfigMaps, Secrets, CRDs or database migrations.</p>', lvl: 'core' },
    { q: 'What happens when a rollout cannot progress?', a: '<p>After <code>progressDeadlineSeconds</code> without progress, the controller sets condition <code>Progressing=False</code> with reason <code>ProgressDeadlineExceeded</code>. Nothing else changes; old pods keep serving. <code>kubectl rollout status</code> exits non-zero, which is your pipeline’s cue to alert or undo. Progressive delivery tools (Argo Rollouts, Flagger) add automatic analysis and abort.</p>', lvl: 'core' },
    { q: 'Rolling update vs Recreate: when would you use Recreate?', a: '<p>Recreate scales the old ReplicaSet to 0 first, then creates the new one: guaranteed downtime, but never two versions at once. Use it when versions cannot coexist: a singleton with a ReadWriteOnce volume, an incompatible schema change, or a licence limit. Otherwise prefer rolling updates and make releases backward-compatible.</p>', lvl: 'core' },
    { q: 'How do you do blue-green on Kubernetes?', a: '<p>Run two complete Deployments (blue = live, green = new) with a <code>version</code> label. Smoke-test green via its own Service, then switch the production Service selector (or Gateway API route) to green. Rollback is switching back. Cost: double capacity during the release; long-lived connections keep using blue until they close, so drain before scaling blue down.</p>', lvl: 'core' },
    { q: 'How do you do a canary, and what are the options for traffic splitting?', a: '<p>Simplest: a second Deployment with the same Service label and few replicas, so the share is replicas-proportional (1 of 10 ≈ 10%), with no precise control. Better: weighted routing in an ingress controller, service mesh or Gateway API <code>HTTPRoute</code> <code>backendRefs</code> weights, which lets you send 1% to the canary regardless of pod count. Tools like Argo Rollouts and Flagger automate step weights and metric analysis.</p>', fu: 'What must be true of the database schema? (Both versions must work with it: expand → migrate → contract.)', lvl: 'deep' },
    { q: 'What makes a Spring Boot rolling update truly zero-downtime?', a: '<ul><li>Readiness on <code>/actuator/health/readiness</code>, plus a startup probe for slow boots.</li><li><code>minReadySeconds</code> and <code>maxUnavailable: 0</code> (with headroom).</li><li>Graceful shutdown (<code>server.shutdown=graceful</code>, default since Boot 3.4) and a preStop sleep so endpoints are removed before Tomcat stops.</li><li><code>terminationGracePeriodSeconds</code> longer than preStop + drain.</li><li>Backward-compatible DB migrations and APIs, because old and new pods serve together.</li></ul>', lvl: 'deep' },
    { q: 'What happens if you scale a Deployment in the middle of a rollout?', a: '<p><b>Proportional scaling</b>: the controller spreads the extra (or removed) replicas across the active ReplicaSets in proportion to their current sizes, with leftovers going to the newest. The rollout then continues with the new totals.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'A safe Deployment for a Spring service', lang: 'yaml', code: `apiVersion: apps/v1
kind: Deployment
metadata: { name: web }
spec:
  replicas: 4                       # omit if an HPA owns it
  revisionHistoryLimit: 5
  minReadySeconds: 15
  progressDeadlineSeconds: 300
  strategy:
    type: RollingUpdate
    rollingUpdate: { maxSurge: 1, maxUnavailable: 0 }
  selector: { matchLabels: { app: web } }
  template:
    metadata:
      labels: { app: web }
      annotations:
        kubernetes.io/change-cause: "web 5.1.0 (git 3f9c2e1)"
    spec:
      terminationGracePeriodSeconds: 40
      containers:
      - name: app
        image: registry/web:5.1.0
        startupProbe:
          httpGet: { path: /actuator/health/liveness, port: 8080 }
          periodSeconds: 5
          failureThreshold: 24          # up to 120 s to boot
        readinessProbe:
          httpGet: { path: /actuator/health/readiness, port: 8080 }
          periodSeconds: 5
        lifecycle:
          preStop: { sleep: { seconds: 5 } }` },
    { title: 'Rollout commands', lang: 'bash', code: `kubectl set image deploy/web app=registry/web:5.1.0
kubectl rollout status deploy/web --timeout=6m || kubectl rollout undo deploy/web

kubectl rollout history deploy/web
kubectl rollout history deploy/web --revision=7      # template of revision 7
kubectl rollout undo deploy/web --to-revision=7

kubectl rollout pause deploy/web     # batch several template edits into one rollout
kubectl set env deploy/web FEATURE_X=true
kubectl set resources deploy/web -c app --limits=memory=1Gi
kubectl rollout resume deploy/web

kubectl rollout restart deploy/web   # new rollout with an updated restartedAt annotation` },
    { title: 'Blue-green switch and weighted canary', lang: 'yaml', code: `# blue-green: flip the Service selector
apiVersion: v1
kind: Service
metadata: { name: web }
spec:
  selector: { app: web, version: green }     # was: blue
  ports: [{ port: 80, targetPort: 8080 }]
---
# canary: Gateway API weighted backends (gateway.networking.k8s.io/v1)
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata: { name: web }
spec:
  parentRefs: [{ name: public-gw }]
  rules:
  - backendRefs:
    - { name: web-stable, port: 80, weight: 95 }
    - { name: web-canary, port: 80, weight: 5 }`, note: 'Weights are independent of pod counts. See <a href="ingress-gateway.html">Ingress & Gateway API</a>.' }
  ]
});

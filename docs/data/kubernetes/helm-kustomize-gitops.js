IA.register({
  track: 'kubernetes',
  slug: 'helm-kustomize-gitops',
  title: 'Helm, Kustomize & GitOps',
  tagline: '<b>Helm</b> renders templates from values and tracks releases. <b>Kustomize</b> patches plain YAML with overlays. <b>GitOps</b> (Argo CD, Flux) runs a controller that keeps the cluster equal to Git and flags <b>drift</b>. They answer different questions: how to package, how to vary per environment, and who applies.',
  tldr: {
    problem: 'Copy-pasted manifests per environment drift apart; <code>helm upgrade</code> from laptops leaves nobody sure what runs in production; a hotfix with <code>kubectl edit</code> is silently reverted, or silently kept forever.',
    model: '<b>Render</b> (Helm values → templates, or Kustomize base + overlay) produces plain manifests. <b>Apply</b> sends them to the API server. In GitOps a controller in the cluster <b>pulls</b> from Git, renders, diffs desired against live, and syncs; any difference is drift, shown as <i>OutOfSync</i> and optionally self-healed.',
    hook: '“Someone scaled the Deployment by hand and Argo CD reverted it. Bug or feature?” Feature, if self-heal is on. And if an HPA owns replicas, take <code>replicas</code> out of Git, or the two controllers fight forever.',
    facts: [
      { v: 'Secrets', l: 'Helm 3 stores each release revision as a Secret in the release namespace (Tiller was removed in Helm 3)' },
      { v: '1.14', l: 'kubectl gained built-in Kustomize (<code>kubectl apply -k</code>)' },
      { v: '~3 min', l: 'Argo CD’s default interval for polling Git; webhooks make it near-instant' }
    ]
  },
  intro: {
    what: 'Real apps need the same manifests with small differences per environment (replicas, image tag, memory) and a reliable way to apply them. <b>Helm</b> is a package manager: a <b>chart</b> is a folder of templates plus default <b>values</b>; you install it with your own values to get a <b>release</b>. <b>Kustomize</b> keeps plain YAML and layers small changes on top (<b>overlays</b>). <b>GitOps</b> means Git holds the desired state, and a controller in the cluster applies it continuously.',
    analogy: { icon: '📐', title: 'A form letter, an annotated copy, and a building inspector', text: 'Helm is a form letter: blanks filled from a values sheet. Kustomize is a photocopy of an original with sticky notes on top: “change the date here”. GitOps is an inspector who visits every few minutes with the approved blueprint (Git) and points out, or undoes, anything built differently.' },
    steps: [
      { t: 'Install a chart with your values', d: 'Values files are merged in order; later ones win.', code: 'helm upgrade --install orders ./charts/orders -n shop \\\n  -f values-prod.yaml --atomic --timeout 10m', lang: 'bash' },
      { t: 'See what would be applied', d: 'Render locally and review the output, before it reaches a cluster.', code: 'helm template orders ./charts/orders -f values-prod.yaml | less\nkubectl kustomize overlays/prod | less', lang: 'bash' },
      { t: 'Or patch plain YAML with an overlay', d: 'An overlay references a base and changes only what differs.', code: 'resources: [../../base]\nreplicas: [{ name: orders, count: 6 }]\nimages: [{ name: registry.example.com/orders, newTag: "7.2" }]' },
      { t: 'Let a controller apply from Git', d: 'An Argo CD Application (or Flux Kustomization/HelmRelease) points at a path in a repo.', code: 'spec:\n  source: { repoURL: https://git.example.com/platform/envs, path: prod/orders }\n  destination: { server: https://kubernetes.default.svc, namespace: shop }\n  syncPolicy: { automated: { prune: true, selfHeal: true } }' }
    ],
    terms: [
      ['chart', 'A Helm package: <code>Chart.yaml</code>, <code>values.yaml</code>, <code>templates/</code>, optionally <code>crds/</code> and dependencies.'],
      ['release / revision', 'One installation of a chart in a namespace; each upgrade or rollback adds a revision.'],
      ['base / overlay', 'Kustomize: shared YAML, and a directory that references it and adds patches.'],
      ['GitOps', 'Git is the source of truth; an in-cluster agent pulls and reconciles continuously.'],
      ['drift', 'A difference between the live cluster and Git, e.g. from <code>kubectl edit</code>.'],
      ['sync / self-heal / prune', 'Apply Git to the cluster; re-apply when live changes; delete objects removed from Git.']
    ]
  },
  visual: {
    title: 'Render, apply, reconcile',
    caption: 'Pick a mode and press Play (or Step). Helm shows how values layers merge and where the release is recorded. Kustomize shows a base and overlays. GitOps runs the reconcile loop: a commit, a diff, a sync, then an out-of-band change that the loop detects as drift.'
  },
  gotchas: [
    { trap: '<code>--set</code> guesses types', code: `helm upgrade orders ./chart --set image.tag=1.10    # tag becomes 1.1 (a number)
helm upgrade orders ./chart --set-string image.tag=1.10
# in templates, quote it anyway:  image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"`, lang: 'bash', why: 'Values passed with <code>--set</code> are parsed: <code>1.10</code> becomes a float, <code>true</code> a bool, and large numbers may be rendered in scientific notation. The image reference changes silently.', fix: 'Use <code>--set-string</code> for tags and IDs, prefer values files in Git over <code>--set</code>, and <code>| quote</code> strings in templates.' },
    { trap: 'Lists in values are replaced, not merged', code: `# values.yaml (chart)          # values-prod.yaml
env:                            env:
- { name: TZ, value: UTC }      - { name: LOG_LEVEL, value: WARN }
- { name: JAVA_TOOL_OPTIONS, …}
# result: only LOG_LEVEL. TZ and JAVA_TOOL_OPTIONS are gone.`, why: 'Helm deep-merges maps but replaces arrays as a whole. Overriding one entry drops all the defaults.', fix: 'Design charts with maps for things users override (<code>env: { LOG_LEVEL: WARN }</code> rendered with <code>range</code>), or an <code>extraEnv</code> list appended in the template.' },
    { trap: 'A ConfigMap change doesn’t restart the Pods', why: 'Changing a ConfigMap used via env vars does nothing to running Pods; the Deployment’s Pod template didn’t change, so there is no rollout. Volume-mounted files update eventually, but Spring reads most properties once at startup.', fix: 'Helm: add a checksum annotation of the rendered ConfigMap to the Pod template. Kustomize: use <code>configMapGenerator</code>, whose name hash changes with the content. Both produce a new Pod template, so a normal rolling update.' },
    { trap: 'CRDs in a chart’s <code>crds/</code> folder are never upgraded', why: 'Helm 3 installs files in <code>crds/</code> only on first install. It never upgrades or deletes them, because deleting a CRD deletes every custom resource of that type. You upgrade the operator chart and keep the old schema.', fix: 'Apply CRDs separately (a dedicated chart, or <code>kubectl apply --server-side</code> in the pipeline), or use a chart that manages CRDs as templates deliberately. Argo CD applies CRDs like any other object.' },
    { trap: 'Git and the HPA both own <code>replicas</code>', why: 'The manifest says <code>replicas: 4</code>; the HPA scales to 12. Every sync sets it back to 4, the HPA scales up again, and Pods churn. With Helm, each upgrade does the same.', fix: 'Omit <code>spec.replicas</code> when an HPA is in charge (the common chart pattern is <code>{{- if not .Values.autoscaling.enabled }}</code>), or configure <code>ignoreDifferences</code> for that field in Argo CD.' },
    { trap: 'Plain Secrets committed to Git', why: 'A Secret manifest is base64, not encrypted. Once pushed, it is in the history of every clone forever.', fix: 'Commit encrypted Secrets (Sealed Secrets, SOPS with age or KMS, which Flux decrypts natively) or references (External Secrets Operator pulling from Vault, AWS Secrets Manager, Azure Key Vault). Rotate anything that ever landed in Git.' },
    { trap: 'Prune deletes what you renamed', why: 'With pruning on, an object that disappears from Git is deleted from the cluster. Renaming a PVC or a StatefulSet in Git is a delete plus a create, and a deleted PVC with <code>reclaimPolicy: Delete</code> takes its disk with it.', fix: 'Protect stateful objects: <code>argocd.argoproj.io/sync-options: Prune=false</code>, Helm’s <code>helm.sh/resource-policy: keep</code>, <code>reclaimPolicy: Retain</code> on important StorageClasses. Review prune lists in the diff before syncing.' }
  ],
  scenarios: [
    { title: '“another operation (install/upgrade/rollback) is in progress”',
      symptom: 'Every deploy of <code>orders</code> fails with this Helm error since yesterday, when a CI runner was cancelled during an upgrade.',
      diagnoseLang: 'bash',
      diagnose: `helm history orders -n shop | tail -3
#  41  superseded       orders-3.1.0  Upgrade complete
#  42  pending-upgrade  orders-3.2.0  Preparing upgrade   ← the cancelled run
helm status orders -n shop       # STATUS: pending-upgrade
kubectl get secret -n shop -l owner=helm,name=orders --sort-by=.metadata.creationTimestamp`,
      cause: 'Helm writes the new revision as <code>pending-upgrade</code> before applying and marks it deployed afterwards. The killed process never finished, and Helm refuses to start a new operation over a pending one.',
      fix: 'Roll back to the last good revision (which also clears the lock), then redeploy. In CI, use <code>--atomic</code> (roll back on failure) with a <code>--timeout</code> and don’t let runners be killed mid-deploy; better, let a GitOps controller do the applying.',
      fixCode: `helm rollback orders 41 -n shop --wait
helm upgrade --install orders ./charts/orders -n shop \\
  -f values-prod.yaml --atomic --timeout 10m`,
      fixLang: 'bash' },
    { title: 'Pods churn every three minutes after moving to Argo CD',
      symptom: 'Since <code>orders</code> moved to Argo CD with auto-sync and self-heal, the Deployment jumps between 4 and ~12 replicas. New Pods start and are terminated again before they warm up; latency is worse than before.',
      diagnoseLang: 'bash',
      diagnose: `kubectl get hpa orders -n shop          # DESIRED 12
argocd app diff orders                    # spec.replicas: 4 (git) vs 12 (live)
kubectl get events -n shop --field-selector involvedObject.name=orders | grep -i scaled
#  Scaled up replica set ... to 12   (HPA)
#  Scaled down replica set ... to 4  (sync)`,
      cause: 'The chart still renders <code>replicas: 4</code>. The HPA scales the Deployment up, Argo CD sees drift on <code>spec.replicas</code> and self-heals back to 4, and the HPA scales up again.',
      fix: 'Stop rendering replicas when autoscaling is enabled, and tell Argo CD to ignore the field during the transition.',
      fixCode: `# templates/deployment.yaml
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
---
# Argo CD Application
spec:
  ignoreDifferences:
  - group: apps
    kind: Deployment
    jsonPointers: [/spec/replicas]` },
    { title: 'A rename in Git deleted a database volume',
      symptom: 'A refactoring PR renamed the Kustomize name prefix of a small Postgres StatefulSet. After the merge, Argo CD synced, and the database came back empty.',
      diagnoseLang: 'bash',
      diagnose: `argocd app history reporting
argocd app manifests reporting --revision <previous> | grep -A3 'kind: PersistentVolumeClaim'
kubectl get pv | grep reporting      # old PV gone: reclaimPolicy Delete`,
      cause: 'To Argo CD, the renamed objects were new objects and the old ones were no longer in Git. With <code>prune: true</code> it deleted the old StatefulSet and its PVC, and the StorageClass deleted the disk.',
      fix: 'Restore from backup. Then protect stateful resources from pruning, use <code>Retain</code> for important volumes, and require a human-approved sync when a diff contains deletions of PVCs or StatefulSets.',
      fixCode: `# on StatefulSets and PVCs that hold data
metadata:
  annotations:
    argocd.argoproj.io/sync-options: Prune=false
    helm.sh/resource-policy: keep
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata: { name: ssd-retain }
provisioner: ebs.csi.aws.com
reclaimPolicy: Retain` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Chart default <code>replicaCount: 2</code>. You run <code>helm upgrade -f a.yaml -f b.yaml --set replicaCount=4</code>; a.yaml says 3, b.yaml says 5. Result?', options: ['2', '3', '5', '4'], answer: 3, explain: 'Precedence, lowest to highest: chart values, then each <code>-f</code> in order (b over a), then <code>--set</code>. So <b>4</b>.' },
    { kind: 'predict', q: 'Chart defaults: <code>env: [TZ, JAVA_TOOL_OPTIONS]</code>. Your values file: <code>env: [LOG_LEVEL]</code>. Which env vars are rendered?', options: ['All three', 'Only LOG_LEVEL', 'TZ and JAVA_TOOL_OPTIONS', 'An error: duplicate key'], answer: 1, explain: 'Helm replaces lists entirely; only maps are merged key by key.' },
    { kind: 'concept', q: 'A new chart version changes a CRD in its <code>crds/</code> folder. What does <code>helm upgrade</code> do with it?', options: ['Updates the CRD', 'Nothing: <code>crds/</code> is only installed on first install, never upgraded or deleted', 'Deletes and recreates it', 'Fails the upgrade'], answer: 1, explain: 'Helm 3 deliberately leaves CRDs alone after install, because deleting or replacing one can destroy all its custom resources. Upgrade CRDs as a separate step.' },
    { kind: 'scenario', q: 'An Argo CD app has automated sync with <code>selfHeal: false</code>. Someone runs <code>kubectl set image</code> on its Deployment. What happens?', options: ['Reverted within seconds', 'The app shows OutOfSync and the change stays until the next sync (e.g. a new Git commit or a manual sync)', 'Argo CD deletes the Deployment', 'Nothing is detected'], answer: 1, explain: 'Automated sync without self-heal syncs when the desired state (Git) changes, not when the live state changes. Drift is reported but kept until the next sync.' },
    { kind: 'scenario', q: 'In Kustomize you change a literal in a <code>configMapGenerator</code>. What happens on apply?', options: ['The ConfigMap is updated in place; Pods keep old env values', 'A ConfigMap with a new hash suffix is created and the Deployment reference is rewritten, so the Pods roll', 'Kustomize refuses: generated ConfigMaps are immutable', 'Nothing until the Pods restart'], answer: 1, explain: 'The hash suffix depends on the content, and Kustomize rewrites every reference. A changed Pod template means a rolling update, which is the whole point.' },
    { kind: 'predict', q: 'The current release is revision 7. You run <code>helm rollback orders 6</code>. What does <code>helm history</code> show afterwards?', options: ['Revision 6 is deployed again; 7 is deleted', 'A new revision 8 with revision 6’s manifests', 'Revision 7 is marked failed and 6 deployed', 'Nothing changes until the next upgrade'], answer: 1, explain: 'History only moves forward. A rollback creates a new revision whose content is copied from the target revision.' },
    { kind: 'concept', q: 'Where is Helm 3’s release state stored?', options: ['In a Tiller Pod in kube-system', 'In a Secret per revision in the release’s namespace (configurable to ConfigMaps or SQL)', 'In ~/.helm on the CI runner', 'In the chart repository'], answer: 1, explain: 'Helm 3 removed Tiller. The default storage driver writes <code>sh.helm.release.v1.&lt;name&gt;.v&lt;N&gt;</code> Secrets. Anyone who can read those Secrets can read the rendered values, including any secrets in them.' },
    { kind: 'concept', q: 'Why is GitOps described as “pull-based”?', options: ['Developers pull changes before pushing', 'An agent inside the cluster pulls from Git and applies; CI never needs cluster credentials', 'Kubernetes pulls images', 'Argo CD pulls metrics from Prometheus'], answer: 1, explain: 'The cluster reaches out to Git (and registries), so credentials stay inside the cluster, and the same agent keeps checking for drift after the deploy, which a push from CI cannot do.' }
  ],
  interview: [
    { q: 'Helm or Kustomize: when would you use which?', a: '<p><b>Helm</b> for distributable packages with many options (third-party software, an internal platform chart used by many teams), release history and rollback, hooks and dependencies. <b>Kustomize</b> for your own services where you want plain YAML, small per-environment overlays and no template language. They combine well: Kustomize can inflate a Helm chart and patch the output, and both Argo CD and Flux support each.</p>', lvl: 'core' },
    { q: 'What is GitOps, and what does it give you over CI running kubectl or helm?', a: '<ul><li>Git is the single source of truth: every change is a reviewed commit, and rollback is a revert.</li><li>Pull model: the in-cluster agent applies, so CI needs no cluster credentials.</li><li>Continuous reconciliation: drift is detected (and optionally reverted), not only at deploy time.</li><li>One view of “what is deployed where” across clusters.</li></ul><p>Costs: a promotion workflow between environments, secret handling, and learning to fix production by commit.</p>', lvl: 'core' },
    { q: 'How does Helm upgrade decide what to change?', a: '<p>Helm 3 uses a <b>three-way strategic merge patch</b> between the previous release’s manifest, the new manifest and the live object. Fields the chart owns are updated; fields added by others (a sidecar injector, a manual change the chart never mentions) are preserved. Objects removed from the chart are deleted, unless annotated <code>helm.sh/resource-policy: keep</code>.</p>', lvl: 'deep' },
    { q: 'How do you promote a version from staging to production with GitOps?', a: '<p>Typical layouts: one directory per environment (Kustomize overlays or values files) in an env repo, and promotion is a PR that changes the tag in the prod overlay. Automate it: CI updates staging; after checks pass, a bot opens the prod PR (or tools like Argo CD Image Updater or Flux image automation write the tag). Avoid long-lived branches per environment, which drift and merge badly.</p>', lvl: 'deep' },
    { q: 'What is drift, and how should you handle it?', a: '<p>Drift is any difference between the live object and the desired state in Git: a <code>kubectl edit</code>, a script, an operator changing fields. Detect it (Argo CD OutOfSync, Flux drift detection), then decide per field: revert it (self-heal), adopt it (commit it to Git), or declare it owned by someone else (<code>ignoreDifferences</code> for HPA-managed replicas or injected sidecars). Break-glass changes during incidents should be followed by a commit.</p>', lvl: 'core' },
    { q: 'How do you handle secrets in a GitOps workflow?', a: '<p>Never commit plain Secrets. Options: <b>encrypt</b> in Git (Sealed Secrets: a controller holds the private key; SOPS: encrypt with KMS, age or PGP; Flux decrypts SOPS natively), or <b>reference</b> (External Secrets Operator syncs from Vault or a cloud secret manager into Kubernetes Secrets; or the Secrets Store CSI driver mounts them). Referencing keeps rotation in the secret manager.</p>', lvl: 'deep' },
    { q: 'How do you run database migrations with Helm or GitOps?', a: '<p>Options: a Helm <code>pre-upgrade</code> hook Job (or an Argo CD <code>PreSync</code> hook) that runs Flyway/Liquibase before the new Pods; or migrations run by the app at startup (Spring Boot’s Flyway integration), which then must be backward compatible because old and new Pods overlap during a rolling update. Use expand/contract migrations either way.</p>', lvl: 'deep' },
    { q: 'What are Argo CD sync waves and hooks for?', a: '<p>Ordering within a sync. <b>Hooks</b> (<code>PreSync</code>, <code>Sync</code>, <code>PostSync</code>, <code>SyncFail</code>) run Jobs at a phase. <b>Sync waves</b> (<code>argocd.argoproj.io/sync-wave: "-1"</code>) apply groups of objects in order, waiting for each wave to be healthy, e.g. namespace and CRDs, then the operator, then custom resources.</p>', lvl: 'deep' },
    { q: 'How would you review what a chart upgrade will change before it goes live?', a: '<p>Render both versions and diff: <code>helm template</code> with the same values, or the <code>helm diff</code> plugin against the live release; <code>kubectl diff -f</code> uses a server-side dry run. In GitOps, CI posts the rendered diff on the PR (Argo CD’s <code>argocd app diff</code>, Flux’s <code>flux diff</code>). Watch for deletions and changes to selectors, which are immutable on Deployments.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Chart: Deployment template', lang: 'yaml', code: `# charts/orders/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "orders.fullname" . }}
  labels: {{- include "orders.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels: {{- include "orders.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels: {{- include "orders.selectorLabels" . | nindent 8 }}
      annotations:
        # roll the Pods when the rendered ConfigMap changes
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
    spec:
      containers:
      - name: app
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
        resources: {{- toYaml .Values.resources | nindent 10 }}
        env:
        {{- range $k, $v := .Values.env }}     # a map, so overrides merge
        - name: {{ $k }}
          value: {{ $v | quote }}
        {{- end }}` },
    { title: 'Kustomize base + prod overlay', lang: 'yaml', code: `# overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: shop
resources:
- ../../base
replicas:
- { name: orders, count: 6 }
images:
- name: registry.example.com/orders
  newTag: "7.2"
configMapGenerator:
- name: orders-config
  behavior: merge
  literals:
  - SPRING_PROFILES_ACTIVE=prod
patches:
- target: { kind: Deployment, name: orders }
  patch: |-
    - op: replace
      path: /spec/template/spec/containers/0/resources/limits/memory
      value: 2Gi` },
    { title: 'Argo CD Application', lang: 'yaml', code: `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: orders-prod
  namespace: argocd
spec:
  project: shop
  source:
    repoURL: https://git.example.com/platform/envs.git
    targetRevision: main
    path: prod/orders            # a Kustomize overlay, or a chart + values
  destination:
    server: https://kubernetes.default.svc
    namespace: shop
  syncPolicy:
    automated:
      prune: true                # default false
      selfHeal: true             # default false
    syncOptions:
    - ServerSideApply=true
  ignoreDifferences:
  - group: apps
    kind: Deployment
    jsonPointers: [/spec/replicas]   # owned by the HPA` },
    { title: 'CI checks before merge', lang: 'bash', code: `# lint and render exactly what will be applied
helm lint charts/orders -f envs/prod/values.yaml
helm template orders charts/orders -f envs/prod/values.yaml > /tmp/rendered.yaml
kubectl kustomize envs/prod/orders > /tmp/kustomized.yaml

# validate against the target cluster's API (schemas, deprecated versions)
kubectl apply --dry-run=server -f /tmp/rendered.yaml

# show the diff against what is live
kubectl diff -f /tmp/rendered.yaml || true
argocd app diff orders-prod --local envs/prod/orders || true` }
  ]
});

IA.register({
  track: 'kubernetes',
  slug: 'configmaps-secrets',
  title: 'ConfigMaps & Secrets',
  tagline: 'Configuration lives outside the image, in a ConfigMap or Secret. <b>How you consume it</b> decides whether a change ever reaches the app: env vars never update, volume files update after a delay, <code>subPath</code> files never do. And a Secret is <b>base64, not encryption</b>.',
  tldr: {
    problem: '“I changed the ConfigMap and nothing happened.” Or: “Our database password is in git, base64-encoded, and someone decoded it.”',
    model: 'The API stores key/value data (in etcd). The kubelet copies it into the container at start-up as <b>env vars</b> (a frozen snapshot) or projects it as <b>files</b> in a volume, which it refreshes on its sync loop with an atomic symlink swap. The app must still re-read the file. Secrets add little more than separate RBAC and tmpfs mounts unless you turn on <b>encryption at rest</b>.',
    hook: '“Does a pod see an updated ConfigMap?” Env: never. Volume: yes, eventually (about the kubelet sync period). <code>subPath</code>: never. And your Spring <code>@Value</code> field: only after a refresh or a restart.',
    facts: [
      { v: '1 MiB', l: 'maximum size of one ConfigMap or Secret. Larger config belongs in a volume or an artifact' },
      { v: 'base64', l: 'is how <code>data</code> is encoded in a Secret manifest. <code>echo aHVudGVyMg== | base64 -d</code> prints the password' },
      { v: '1.21', l: '<code>immutable: true</code> for ConfigMaps and Secrets went GA. The kubelet stops watching them, which reduces API server load' }
    ]
  },
  intro: {
    what: 'You build one container image and run it in dev, staging and production. What differs, such as URLs, feature flags and passwords, goes into a <b>ConfigMap</b> (plain settings) or a <b>Secret</b> (sensitive values). The pod spec says how the container receives them: as <b>environment variables</b>, or as <b>files</b> in a mounted folder.',
    analogy: { icon: '📋', title: 'A printed handout vs a noticeboard', text: 'Env vars are a handout given to each worker on their first day: if the policy changes, their copy doesn’t. A volume is a noticeboard in the corridor: the office manager re-pins new notices every so often, but only workers who go and read the board notice. A <code>subPath</code> mount is a photocopy of one notice taped to a desk: it never changes.' },
    steps: [
      { t: 'Create the ConfigMap', d: 'From literals, files, or YAML.', code: 'kubectl create configmap app-config \\\n  --from-literal=FEATURE_X=off \\\n  --from-file=application.yaml', lang: 'bash' },
      { t: 'Consume it as env vars', d: 'Simple, and read once when the container starts.', code: 'envFrom:\n  - configMapRef: { name: app-config }' },
      { t: 'Or as files', d: 'Each key becomes a file under the mount path. The kubelet updates the files when the ConfigMap changes.', code: 'volumes:\n  - name: cfg\n    configMap: { name: app-config }\ncontainers:\n  - name: app\n    volumeMounts: [{ name: cfg, mountPath: /etc/config, readOnly: true }]' },
      { t: 'Secrets work the same way', d: 'Same consumption options. The value is base64 in YAML, mounted on tmpfs, and guarded by separate RBAC. It is <i>not</i> encrypted unless the cluster is configured for it.' },
      { t: 'Roll out changes deliberately', d: 'Most teams restart pods on config change, using a checksum annotation or <code>kubectl rollout restart</code>, so every replica switches at a known time.' }
    ],
    terms: [
      ['ConfigMap', 'A namespaced object of non-secret key/value data.'],
      ['Secret', 'Like a ConfigMap, for sensitive data: <code>data</code> is base64, and it has types such as <code>Opaque</code>, <code>kubernetes.io/tls</code> and <code>kubernetes.io/dockerconfigjson</code>.'],
      ['projected volume', 'A volume that merges ConfigMaps, Secrets, the downward API and service-account tokens into one directory.'],
      ['subPath', 'Mounts one file or subfolder of a volume. Convenient, but it never receives updates.'],
      ['encryption at rest', 'API server config (<code>EncryptionConfiguration</code>) that encrypts Secrets before writing them to etcd, ideally with KMS v2 (GA 1.29).'],
      ['External Secrets', 'Operators that sync values from Vault or a cloud secret manager into Kubernetes Secrets (or mount them directly via the CSI driver).']
    ]
  },
  visual: {
    title: 'Edit a ConfigMap and watch who notices',
    caption: 'Press Play to change <code>FEATURE_X</code> from <code>off</code> to <code>on</code>, then step through time. Four containers consume the same ConfigMap in four ways. Toggle <code>immutable</code> to see why edits get rejected, and use the Secret panel to see what base64 and etcd actually hold.'
  },
  gotchas: [
    { trap: 'Env vars are a snapshot from container start', why: 'The kubelet resolves <code>env</code>/<code>envFrom</code> once, when it creates the container. Editing the ConfigMap changes nothing for running containers. A container restart (not just the pod staying up) picks up the new value, so different replicas can silently disagree after crashes.', fix: 'Treat env-based config as “restart to apply”. Add a checksum annotation to the pod template so a config change triggers a rolling update.' },
    { trap: '<code>subPath</code> mounts never update', code: `volumeMounts:\n  - name: cfg\n    mountPath: /app/config/application.yaml\n    subPath: application.yaml     # frozen at container start`, why: 'Projected volumes update by swapping a <code>..data</code> symlink to a new timestamped directory. A subPath mount binds the original file directly, so it never sees the swap.', fix: 'Mount the whole directory (for example <code>/app/config/</code>) and point Spring at it: <code>spring.config.import=optional:configtree:/app/config/</code> or <code>spring.config.additional-location</code>.' },
    { trap: 'The file changed but the app didn’t', why: 'Spring Boot binds <code>@Value</code> and <code>@ConfigurationProperties</code> at start-up. A new file on disk has no effect until something re-reads it. File watchers that watch the file itself can also miss the symlink swap.', fix: 'Pick one model: restart on change (Reloader, checksum annotations), or refresh in place (Spring Cloud Kubernetes / Spring Cloud Config with <code>@RefreshScope</code>). Watch the directory, not the file.' },
    { trap: 'base64 is encoding, not encryption', code: `kubectl get secret db -o jsonpath='{.data.password}' | base64 -d\n# hunter2`, lang: 'bash', why: 'Anyone with <code>get</code> on Secrets in the namespace, or anyone who can create a pod there (and mount the Secret), can read it. Without an <code>EncryptionConfiguration</code>, etcd and its backups store it in plaintext.', fix: 'Turn on encryption at rest (KMS v2 on self-managed clusters; check your managed provider’s envelope-encryption option), restrict <code>get/list/watch</code> on Secrets, never commit Secret manifests (use Sealed Secrets, SOPS or External Secrets), and prefer short-lived credentials.' },
    { trap: '<code>list</code> on Secrets returns their contents', why: 'RBAC verbs are coarse: <code>list</code> and <code>watch</code> return full objects, values included. A “read-only” role with <code>list secrets</code> is a credential dump.', fix: 'Grant Secret access by <code>resourceNames</code> where possible, and audit with <code>kubectl auth can-i list secrets --as=system:serviceaccount:shop:default -n shop</code>.' },
    { trap: 'A missing ConfigMap blocks start-up', why: 'If a referenced ConfigMap or key doesn’t exist, an env reference leaves the pod in <code>CreateContainerConfigError</code>, and a volume makes it hang in <code>ContainerCreating</code>. That often happens because the Deployment was applied before the ConfigMap.', fix: 'Apply config first (Helm and Kustomize order these), or mark truly optional sources with <code>optional: true</code>.' }
  ],
  scenarios: [
    { title: 'Half the pods run with the new feature flag, half with the old',
      symptom: 'After editing <code>FEATURE_X=on</code> in the ConfigMap, some users see the new checkout and some don’t. Nobody deployed anything.',
      diagnose: `for p in $(kubectl get pods -l app=checkout -o name); do\n  echo "$p $(kubectl exec $p -- printenv FEATURE_X) restarts=$(kubectl get $p -o jsonpath='{.status.containerStatuses[0].restartCount}')"\ndone\n# pod/checkout-7f..-a  on   restarts=2   ← restarted after the edit\n# pod/checkout-7f..-b  off  restarts=0`,
      diagnoseLang: 'bash',
      cause: 'The flag is consumed with <code>envFrom</code>. Containers that crashed and restarted after the edit got the new value; the others kept the snapshot from when they started.',
      fix: 'Make config changes roll out like code: hash the ConfigMap into a pod-template annotation, so any change triggers a controlled rolling update.',
      fixCode: `# Helm: templates/deployment.yaml\nspec:\n  template:\n    metadata:\n      annotations:\n        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}\n# Kustomize: configMapGenerator appends a content hash to the name for the same effect` },
    { title: 'Leaked database password from an “internal” repo',
      symptom: 'A security scan found <code>secret.yaml</code> with <code>data.password: aHVudGVyMg==</code> in a repository mirrored to a vendor. The team believed it was encrypted.',
      diagnose: `git log -p -- k8s/secret.yaml | grep -A1 'password:'\necho aHVudGVyMg== | base64 -d   # hunter2`,
      diagnoseLang: 'bash',
      cause: 'Secrets in YAML are only base64-encoded. Committing them is committing the password.',
      fix: 'Rotate the credential first. Then move the value into a secret manager and let External Secrets Operator sync it, so git holds only a reference.',
      fixCode: `apiVersion: external-secrets.io/v1\nkind: ExternalSecret\nmetadata: { name: db, namespace: shop }\nspec:\n  refreshInterval: 1h\n  secretStoreRef: { kind: ClusterSecretStore, name: aws-secrets-manager }\n  target: { name: db }              # creates/updates Secret "db"\n  data:\n    - secretKey: password\n      remoteRef: { key: prod/shop/db, property: password }` },
    { title: 'TLS certificate renewed, but the service keeps serving the old one',
      symptom: 'cert-manager renewed the certificate Secret, yet clients started failing at the old expiry date. The file in the pod was new.',
      diagnose: `kubectl exec deploy/gateway -- ls -la /etc/tls\n# tls.crt -> ..data/tls.crt     (updated 3 days ago)\nkubectl exec deploy/gateway -- sh -c 'openssl s_client -connect localhost:8443 </dev/null 2>/dev/null | openssl x509 -noout -enddate'\n# notAfter=...  ← still the old certificate`,
      diagnoseLang: 'bash',
      cause: 'The Java service loaded the keystore once at start-up. The kubelet updated the mounted Secret correctly, but nothing told the JVM.',
      fix: 'Use Spring Boot SSL bundles with reloading (Boot 3.2+: <code>reload-on-update: true</code>, which watches the directory), or restart on Secret change with Reloader.',
      fixCode: `# application.yaml (Spring Boot 3.2+)\nspring:\n  ssl:\n    bundle:\n      pem:\n        server:\n          reload-on-update: true\n          keystore:\n            certificate: file:/etc/tls/tls.crt\n            private-key: file:/etc/tls/tls.key\nserver:\n  ssl:\n    bundle: server` }
  ],
  puzzles: [
    { kind: 'predict', q: 'A Deployment uses <code>envFrom: configMapRef: app-config</code>. You change a value and wait 10 minutes; no pods restart. What do the containers see?', options: ['The new value', 'The old value', 'An empty value', 'It depends on the kubelet sync period'], answer: 1, explain: 'Env vars are resolved once, when the container is created. Only a new container (a rollout, or a crash restart) sees the change.' },
    { kind: 'predict', q: 'Same ConfigMap, mounted as a volume at <code>/etc/config</code> (no subPath). After you edit it, the file in a running pod…', options: ['never changes', 'changes immediately', 'changes after a delay of roughly the kubelet sync period plus cache propagation', 'changes only after a pod restart'], answer: 2, explain: 'The kubelet re-projects ConfigMap volumes on its periodic pod sync (default sync frequency 1 minute), plus the delay of its ConfigMap cache or watch. It writes a new directory and atomically swaps the <code>..data</code> symlink.' },
    { kind: 'bug', q: 'The volume is mounted with <code>subPath: application.yaml</code> at <code>/app/application.yaml</code>. You edit the ConfigMap. Does the file change?', options: ['Yes, within about a minute', 'Yes, but only if the volume is readOnly', 'No, subPath mounts never receive updates', 'Only for Secrets'], answer: 2, explain: 'A subPath is a bind mount of the original file, so the symlink swap doesn’t reach it. Mount the directory instead.' },
    { kind: 'concept', q: 'Who can read the value of Secret <code>db</code> in namespace <code>shop</code>?', options: ['Only cluster admins', 'Only pods that reference it', 'Anyone with get/list on secrets in shop, or anyone who can create pods in shop', 'Nobody: it is encrypted'], answer: 2, explain: 'Creating a pod that mounts the Secret and printing it is enough, so “create pods” effectively implies “read Secrets” in that namespace. Without encryption at rest, etcd access is enough too.' },
    { kind: 'predict', q: 'A Secret manifest sets both <code>data.password: b2xk</code> and <code>stringData.password: new</code>. What does the stored Secret contain?', options: ['old', 'new', 'The API rejects it', 'Both, as two keys'], answer: 1, explain: '<code>stringData</code> is a write-only convenience field. It is merged into <code>data</code> on write, and it takes precedence for keys that appear in both.' },
    { kind: 'scenario', q: 'A ConfigMap has <code>immutable: true</code>. You run <code>kubectl edit</code> and change a value. What happens?', options: ['The change is applied, and the pods restart', 'The API server rejects the update', 'The change is stored, but the kubelet ignores it', 'The ConfigMap is recreated'], answer: 1, explain: 'Data in an immutable ConfigMap or Secret can’t be changed. You can only delete and recreate it. The usual pattern is versioned names (<code>app-config-v7</code>) referenced from the Deployment, which a Kustomize hash suffix automates.' },
    { kind: 'scenario', q: 'A Spring Boot 3 app has <code>spring.config.import=configtree:/etc/config/</code> and a bean with <code>@Value("${feature.x}")</code>. The mounted file <code>feature.x</code> updates. What does the bean return?', options: ['The new value, automatically', 'The old value until the context is refreshed or the app restarts', 'null', 'It throws an exception'], answer: 1, explain: 'configtree reads files into the Environment at start-up. Re-reading needs a refresh mechanism (Spring Cloud’s <code>@RefreshScope</code> plus a refresh trigger) or a restart. That is why many teams simply roll the pods.' }
  ],
  interview: [
    { q: 'Env vars vs volume mounts for config: trade-offs?', a: '<p><b>Env</b>: simple, works with any app, fits Spring’s relaxed binding (<code>SPRING_DATASOURCE_URL</code>). But it is frozen at container start, visible to anyone who can describe the pod or read <code>/proc</code>, and easy to leak in crash dumps or logs. <b>Volumes</b>: updates propagate (not with subPath), multi-line files work (<code>application.yaml</code>, certificates), and Secrets land on tmpfs. But the app must re-read the files to benefit.</p>', lvl: 'core' },
    { q: 'How does the kubelet update a mounted ConfigMap, exactly?', a: '<p>Each key in the mount directory is a symlink to <code>..data/&lt;key&gt;</code>, and <code>..data</code> is itself a symlink to a timestamped directory. On a sync, the kubelet writes a new timestamped directory and atomically renames the <code>..data</code> symlink. Readers see either all-old or all-new files, never a mix. Delay: up to the sync period plus the cache/watch delay, set by <code>configMapAndSecretChangeDetectionStrategy</code> (Watch by default).</p>', fu: 'Why do inotify watchers on the file miss it? (The file path is a symlink that never changes; watch the directory for the ..data swap.)', lvl: 'deep' },
    { q: 'Are Kubernetes Secrets secure?', a: '<p>They are <i>better than ConfigMaps</i>: separate RBAC, tmpfs on nodes, sent only to nodes that run pods using them, and optional encryption at rest. But base64 is not encryption, etcd stores plaintext unless <code>EncryptionConfiguration</code> is set, and anyone who can create pods in the namespace can read them. Harden with KMS v2 encryption, tight RBAC (no broad <code>list</code>), audit logging, and external secret managers with rotation.</p>', lvl: 'core' },
    { q: 'How do you trigger a rollout when config changes?', a: '<ul><li>A checksum annotation on the pod template (Helm <code>sha256sum</code>).</li><li>Kustomize <code>configMapGenerator</code>: a hash suffix in the name changes the pod spec.</li><li>A controller such as Stakater Reloader, which watches referenced ConfigMaps/Secrets and patches the Deployment.</li><li>Manual <code>kubectl rollout restart</code>.</li></ul><p>All of them give you a normal rolling update with readiness gates and rollback.</p>', lvl: 'core' },
    { q: 'What are immutable ConfigMaps for?', a: '<p>Safety (no accidental live edits) and scale: the kubelet doesn’t watch immutable objects, which cuts API server watch load in clusters with thousands of pods. Pair them with versioned names so each release references a new object, and garbage-collect old versions.</p>', lvl: 'deep' },
    { q: 'Compare External Secrets Operator, the Secrets Store CSI Driver and Sealed Secrets.', a: '<ul><li><b>External Secrets Operator</b>: CRDs (<code>ExternalSecret</code>, <code>SecretStore</code>) sync values from Vault or AWS/GCP/Azure secret managers into native Secrets on an interval. Apps stay unchanged.</li><li><b>Secrets Store CSI Driver</b>: mounts values straight from the provider into the pod as files (optionally syncing to a Secret), so there is no etcd copy if you skip the sync.</li><li><b>Sealed Secrets / SOPS</b>: encrypt in git; decrypted in-cluster into normal Secrets. Good for GitOps, but rotation is manual.</li></ul>', lvl: 'deep' },
    { q: 'How do Spring Boot apps typically consume Kubernetes config?', a: '<ul><li>Env vars via relaxed binding (<code>SPRING_PROFILES_ACTIVE</code>, <code>SERVER_PORT</code>).</li><li><code>spring.config.import=optional:configtree:/etc/config/</code> for mounted files (keys become property names).</li><li>An <code>application.yaml</code> file mounted as a whole directory.</li><li>Spring Cloud Kubernetes, which reads ConfigMaps/Secrets through the API (needs RBAC) and can refresh beans on change.</li></ul><p>Keep secrets out of logs: Actuator <code>/env</code> masks known keys, so don’t expose it publicly.</p>', lvl: 'core' },
    { q: 'What does encryption at rest protect against, and what not?', a: '<p>It protects etcd data files, snapshots and backups from someone who gets disk or backup access. It does <b>not</b> protect against anyone allowed to read Secrets through the API, pods mounting them, or node compromise (the values are in tmpfs and process memory). KMS v2 (GA 1.29) uses envelope encryption with a key held in an external KMS.</p>', lvl: 'deep' },
    { q: 'Why might a pod be stuck in CreateContainerConfigError?', a: '<p>A referenced ConfigMap/Secret or key is missing for an env var (or a type is invalid). <code>kubectl describe pod</code> shows <code>Error: configmap "app-config" not found</code>. Create it, fix the key name, or set <code>optional: true</code>. A missing volume source shows up instead as a <code>FailedMount</code> event with the pod in ContainerCreating.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Consume four ways', lang: 'yaml', code: `apiVersion: v1
kind: ConfigMap
metadata: { name: app-config, namespace: shop }
data:
  FEATURE_X: "off"
  feature.x: "off"
  application.yaml: |
    shop:
      page-size: 50
---
spec:
  containers:
    - name: app
      env:
        - name: FEATURE_X
          valueFrom: { configMapKeyRef: { name: app-config, key: FEATURE_X } }  # frozen
        - name: DB_PASSWORD
          valueFrom: { secretKeyRef: { name: db, key: password } }
      volumeMounts:
        - { name: cfg, mountPath: /etc/config, readOnly: true }    # updates
        - { name: tls, mountPath: /etc/tls, readOnly: true }       # Secret on tmpfs
  volumes:
    - name: cfg
      configMap: { name: app-config }
    - name: tls
      secret: { secretName: shop-tls, defaultMode: 0400 }` },
    { title: 'Spring Boot reads the mounted tree', lang: 'yaml', code: `# application.yaml (Spring Boot 3.x)
spring:
  config:
    import:
      - optional:configtree:/etc/config/          # file "feature.x" -> property feature.x
      - optional:file:/etc/config/application.yaml
# Secrets as files too, so they never appear in "kubectl describe pod" output
# /etc/db/password -> property "password" (use a sub-folder per prefix)` },
    { title: 'Inspect and verify', lang: 'bash', code: `# what the kubelet projected
kubectl exec deploy/orders -- ls -la /etc/config
# feature.x -> ..data/feature.x
# ..data -> ..2026_11_22_09_14_03.123456789

# decode a Secret (shows why base64 isn't protection)
kubectl get secret db -o jsonpath='{.data.password}' | base64 -d

# is encryption at rest on? (self-managed: check the API server flag)
ps aux | grep -o -- '--encryption-provider-config=[^ ]*'

# who could read secrets?
kubectl auth can-i get secrets -n shop --as=system:serviceaccount:shop:default
kubectl rollout restart deployment/orders -n shop` }
  ]
});

IA.register({
  track: 'kubernetes',
  slug: 'rbac-security',
  title: 'RBAC & Pod security',
  tagline: 'Two different gates. <b>RBAC</b> decides whether <i>this identity</i> may do <i>this verb</i> on <i>this resource</i>. <b>Pod Security</b> and the <code>securityContext</code> decide what a Pod is allowed to <i>be</i> once it runs. Passing one says nothing about the other.',
  tldr: {
    problem: 'Clusters drift toward “everyone is cluster-admin, every Pod runs as root”. Then one leaked CI token can read every Secret, and one container escape owns the node. Locking down too late breaks deploys in confusing ways: Deployments that create zero Pods, images that refuse to start as non-root.',
    model: 'Every API call is <b>authenticated</b> (who?), then <b>authorized</b> (RBAC: is there a binding for this subject whose role has a rule matching verb + resource + API group?), then, for writes, sent through <b>admission</b> (Pod Security, policies, webhooks). RBAC is deny-by-default and purely additive. Pod Security Admission applies the <code>privileged</code>, <code>baseline</code> or <code>restricted</code> standard per namespace via labels.',
    hook: '“Can a user who can’t read Secrets still get them?” Yes, if they can create Pods in that namespace: mount the Secret, or run as a ServiceAccount that can read it. <code>create pods</code> is a powerful permission.',
    facts: [
      { v: 'no deny', l: 'RBAC rules only add permissions. There is no “deny” rule; to block something you remove the grant or use an admission policy' },
      { v: '1.25', l: 'Pod Security Admission went GA and PodSecurityPolicy was removed in the same release' },
      { v: '1.24', l: 'service-account token Secrets stopped being created automatically. Pods get short-lived, audience-bound projected tokens from the TokenRequest API instead' }
    ]
  },
  intro: {
    what: 'Everything in Kubernetes is an API call: <code>kubectl get pods</code>, a controller updating status, your app reading a ConfigMap. Each caller has an identity: a human (from your identity provider) or a <b>ServiceAccount</b> (an identity for software inside the cluster). <b>RBAC</b> (role-based access control) lists what each identity may do. Separately, <b>Pod Security</b> stops Pods that ask for dangerous powers, such as running as root or using the host’s network.',
    analogy: { icon: '🏢', title: 'Office badges and building rules', text: 'Your badge (identity) is checked at the door. The access list says which floors your badge opens (RBAC: Role = “floor 3 access”, RoleBinding = “Alice gets floor 3 access”). Separately, building rules say what you may bring in: no gas cylinders, even on a floor you can enter (Pod Security).' },
    steps: [
      { t: 'A Role lists allowed actions', d: 'Verbs on resources, in one namespace. A ClusterRole is the same, but cluster-wide or reusable.', code: 'kind: Role\nmetadata: { name: config-reader, namespace: shop }\nrules:\n- apiGroups: [""]\n  resources: ["configmaps"]\n  verbs: ["get", "list", "watch"]' },
      { t: 'A binding gives the role to someone', d: 'Users, groups or ServiceAccounts are the subjects.', code: 'kind: RoleBinding\nmetadata: { name: orders-config, namespace: shop }\nsubjects:\n- kind: ServiceAccount\n  name: orders\n  namespace: shop\nroleRef:\n  kind: Role\n  name: config-reader\n  apiGroup: rbac.authorization.k8s.io' },
      { t: 'Ask the cluster', d: '<code>kubectl auth can-i</code> evaluates RBAC exactly as the API server does.', code: 'kubectl auth can-i list secrets -n shop \\\n  --as=system:serviceaccount:shop:orders      # no', lang: 'bash' },
      { t: 'Label the namespace with a Pod Security level', d: 'Pods that break the standard are rejected at admission.', code: 'kubectl label ns shop \\\n  pod-security.kubernetes.io/enforce=restricted \\\n  pod-security.kubernetes.io/warn=restricted', lang: 'bash' }
    ],
    terms: [
      ['Role / ClusterRole', 'A set of rules (API groups, resources, verbs). Role is namespaced; ClusterRole is cluster-scoped and can be reused in any namespace.'],
      ['RoleBinding / ClusterRoleBinding', 'Attaches a role to subjects. A RoleBinding grants only inside its namespace, even when it references a ClusterRole.'],
      ['ServiceAccount', 'A namespaced identity for Pods. The username is <code>system:serviceaccount:&lt;ns&gt;:&lt;name&gt;</code>.'],
      ['projected token', 'A short-lived, audience-bound JWT the kubelet mounts into the Pod and refreshes automatically.'],
      ['Pod Security Standards', 'Three levels: <code>privileged</code> (anything), <code>baseline</code> (blocks known escalations), <code>restricted</code> (hardened best practice).'],
      ['securityContext', 'Pod- and container-level settings: user and group IDs, capabilities, seccomp, read-only root filesystem.']
    ]
  },
  visual: {
    title: 'Follow one request through the API server',
    caption: 'Pick a request and press Play (or Step). Watch authentication turn a token into a subject, RBAC scan the bindings for one matching rule, and admission apply Pod Security to writes. Green = matched, red = no match or rejected.'
  },
  gotchas: [
    { trap: '<code>list</code> or <code>watch</code> on Secrets is the same as <code>get</code>', code: `rules:\n- apiGroups: [""]\n  resources: ["secrets"]\n  verbs: ["list"]          # "only names", right? No: list returns full objects`, why: 'A list response contains the full objects, including <code>data</code>. The same applies to watch. People grant list “so the tool can see what exists” and hand out every Secret in the namespace.', fix: 'Grant Secret access by name with <code>resourceNames</code> and the <code>get</code> verb only. Better: mount the Secret into the Pod and give the app no Secret API access at all.' },
    { trap: '<code>create pods</code> implies access to everything the namespace can reach', why: 'Anyone who can create a Pod can mount any Secret or ConfigMap in that namespace, and run as any ServiceAccount there, inheriting its RBAC. The same is true of anyone who can create Deployments, Jobs or CronJobs. RBAC cannot express “create Pods, but only with these volumes”.', fix: 'Treat workload-creation rights as access to all Secrets in the namespace. Separate sensitive workloads into their own namespaces, and use admission policies (ValidatingAdmissionPolicy, GA in 1.30, or Kyverno/Gatekeeper) to restrict which ServiceAccounts and volumes Pods may use.' },
    { trap: 'Enforce mode rejects Pods, not Deployments', code: `kubectl apply -f deploy.yaml\n# Warning: would violate PodSecurity "restricted:latest": ...\n# deployment.apps/orders created            <- accepted!\nkubectl get rs -l app=orders     # DESIRED 3  CURRENT 0\nkubectl describe rs orders-7c9   # FailedCreate: violates PodSecurity`, lang: 'bash', why: 'Pod Security Admission <code>enforce</code> only evaluates Pod objects. For workload resources (Deployments, Jobs…) it only produces <code>warn</code> and <code>audit</code> results. The Deployment is accepted, then its ReplicaSet fails to create every Pod.', fix: 'Set <code>warn</code> and <code>audit</code> labels together with <code>enforce</code> so <code>kubectl apply</code> prints the violations. When a Deployment has 0 Pods, look at the ReplicaSet’s events.' },
    { trap: '<code>runAsNonRoot: true</code> with a named user in the image', code: `# Dockerfile: USER spring\nsecurityContext:\n  runAsNonRoot: true\n# Error: container has runAsNonRoot and image has non-numeric user (spring),\n#        cannot verify user is non-root  → CreateContainerConfigError`, why: 'The kubelet checks the user ID before starting the container. A user <i>name</i> would have to be resolved inside the image’s <code>/etc/passwd</code>, which the kubelet does not do, so it refuses.', fix: 'Use a numeric UID in the image (<code>USER 1000</code>, or <code>USER 1000:1000</code>), or set <code>runAsUser: 1000</code> in the securityContext. Jib and Paketo images already use numeric non-root users.' },
    { trap: '<code>readOnlyRootFilesystem</code> breaks Spring Boot at startup', why: 'Embedded Tomcat writes to a temp directory (<code>java.io.tmpdir</code>, usually <code>/tmp</code>) for multipart uploads and its work dir. With a read-only root, startup fails with “Unable to create tempDir”.', fix: 'Mount an <code>emptyDir</code> at <code>/tmp</code> (add <code>medium: Memory</code> only if you count it in the memory limit). Keep the root filesystem read-only.' },
    { trap: 'Every Pod gets an API token it never uses', why: 'By default a Pod runs as the namespace’s <code>default</code> ServiceAccount and the token is mounted at <code>/var/run/secrets/kubernetes.io/serviceaccount</code>. If anyone ever bound a role to <code>default</code>, every Pod in the namespace has it; and any RCE in the app gets a valid credential.', fix: 'Give each workload its own ServiceAccount, never bind roles to <code>default</code>, and set <code>automountServiceAccountToken: false</code> on Pods (or the ServiceAccount) that don’t call the API.' },
    { trap: 'fsGroup on a large volume makes Pods slow to start', why: 'With <code>fsGroup</code>, the kubelet recursively changes the group ownership and permissions of the volume on every mount. Millions of files can add minutes to startup.', fix: 'Set <code>fsGroupChangePolicy: OnRootMismatch</code> so the kubelet skips the walk when the root of the volume already has the right ownership.' }
  ],
  scenarios: [
    { title: 'A leaked CI token could read every Secret in the cluster',
      symptom: 'A security review finds the CI system’s kubeconfig in an old build log. The token belongs to ServiceAccount <code>ci/deployer</code>. Nobody is sure what it can do.',
      diagnoseLang: 'bash',
      diagnose: `kubectl auth can-i --list --as=system:serviceaccount:ci:deployer
#  *.*   []   []   [*]          ← everything
kubectl get clusterrolebindings -o wide | grep ci:deployer
#  ci-deployer   ClusterRole/cluster-admin   ...   ci/deployer`,
      cause: 'Years ago, a ClusterRoleBinding to <code>cluster-admin</code> was the quick fix for “the pipeline can’t create Ingresses”. The token was a long-lived legacy Secret token that never expired.',
      fix: 'Revoke at once by deleting the token Secret (or the ServiceAccount). Replace with namespaced RoleBindings to a purpose-built role. Use short-lived tokens, ideally via OIDC federation from the CI provider, so no static kubeconfig exists. Then check the audit log for what the token did.',
      fixCode: `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata: { name: app-deployer }
rules:
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "watch", "create", "update", "patch"]
- apiGroups: [""]
  resources: ["services", "configmaps"]
  verbs: ["get", "list", "watch", "create", "update", "patch"]
- apiGroups: ["networking.k8s.io"]
  resources: ["ingresses"]
  verbs: ["get", "list", "watch", "create", "update", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding                    # one per target namespace
metadata: { name: ci-deployer, namespace: shop }
subjects:
- { kind: ServiceAccount, name: deployer, namespace: ci }
roleRef: { kind: ClusterRole, name: app-deployer, apiGroup: rbac.authorization.k8s.io }` },
    { title: 'Turning on “restricted” emptied a namespace over the weekend',
      symptom: 'The platform team labelled all namespaces <code>enforce=restricted</code> on Friday. Running Pods kept running. During the weekend, nodes were recycled and several services went to 0 replicas. Deployments report <code>0/3 available</code>, but there are no Pod errors to look at, because there are no Pods.',
      diagnoseLang: 'bash',
      diagnose: `kubectl get rs -n payments            # DESIRED 3  CURRENT 0  READY 0
kubectl describe rs payments-5d8 -n payments | tail -3
#  Warning  FailedCreate  ... pods "payments-5d8-x" is forbidden:
#    violates PodSecurity "restricted:latest": allowPrivilegeEscalation != false,
#    unrestricted capabilities, runAsNonRoot != true, seccompProfile
kubectl label --dry-run=server --overwrite ns payments \\
  pod-security.kubernetes.io/enforce=restricted     # lists existing violators`,
      cause: 'Pod Security Admission does not evict running Pods; it rejects new ones. Every Pod recreated after the label change (by a drain, eviction or rollout) was rejected, and the ReplicaSet kept retrying.',
      fix: 'Roll out levels in order: <code>warn</code> + <code>audit</code> first, fix the manifests, use a server-side dry-run of the label to list violators, then <code>enforce</code>. Pin <code>enforce-version</code> so a cluster upgrade can’t tighten the rules unexpectedly.',
      fixCode: `apiVersion: v1
kind: Namespace
metadata:
  name: payments
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: v1.30
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/audit: restricted` },
    { title: 'An SSRF bug became cluster access',
      symptom: 'A pentest shows that the image-preview endpoint of a Spring service can be made to read local files. The tester reads <code>/var/run/secrets/kubernetes.io/serviceaccount/token</code> and uses it to list Pods in the namespace.',
      diagnoseLang: 'bash',
      diagnose: `kubectl get pod preview-7f -o jsonpath='{.spec.serviceAccountName}'   # default
kubectl get rolebindings -n media -o wide | grep default
#  media-view   ClusterRole/view   ...   media/default`,
      cause: 'The app never called the Kubernetes API, but the token was automounted, and someone had bound <code>view</code> to the namespace’s <code>default</code> ServiceAccount for a dashboard.',
      fix: 'Disable automounting for workloads that don’t need the API, give the dashboard its own ServiceAccount, and fix the SSRF. With a projected token the stolen credential also expires (bound to the Pod and time-limited), unlike the old Secret tokens.',
      fixCode: `apiVersion: v1
kind: ServiceAccount
metadata: { name: preview, namespace: media }
automountServiceAccountToken: false
---
# Deployment pod template
spec:
  serviceAccountName: preview
  automountServiceAccountToken: false` }
  ],
  puzzles: [
    { kind: 'concept', q: 'A RoleBinding in namespace <code>shop</code> references the ClusterRole <code>view</code>. What can the subject do?', options: ['Read most resources in <code>shop</code> only', 'Read most resources in every namespace', 'Nothing: a RoleBinding can only reference a Role', 'Read and write in <code>shop</code>'], answer: 0, explain: 'A RoleBinding always limits the grant to its own namespace. Referencing a ClusterRole is the normal way to reuse a standard role (view, edit, admin) per namespace. Note that <code>view</code> deliberately excludes Secrets.' },
    { kind: 'scenario', q: 'A ServiceAccount has <code>list</code> on Secrets in its namespace but not <code>get</code>. Can it read the password in Secret <code>db</code>?', options: ['No: list returns only names', 'Only if the Secret is not immutable', 'Yes: a list response contains the full objects, data included', 'Only with <code>watch</code> too'], answer: 2, explain: 'List and watch return complete objects. <code>kubectl get secrets -o yaml</code> with only list permission shows every value. Restrict Secret access by <code>resourceNames</code> with <code>get</code>.' },
    { kind: 'scenario', q: 'Namespace <code>shop</code> has <code>pod-security.kubernetes.io/enforce=restricted</code>. You apply a Deployment whose Pod template sets <code>privileged: true</code>. What happens?', options: ['kubectl apply fails with 403', 'The Pods start but privileged is ignored', 'The Pods are created and immediately evicted', 'The Deployment is created with a warning; its ReplicaSet can’t create any Pods (FailedCreate events)'], answer: 3, explain: 'Enforce applies to Pod objects only. For workload templates Pod Security returns warnings (and audit annotations) but accepts the object. The ReplicaSet controller then gets 403 on every Pod create.' },
    { kind: 'scenario', q: 'Alice can create Pods in <code>shop</code> but has no RBAC on Secrets. Can she read Secret <code>stripe-key</code> in <code>shop</code>?', options: ['No: RBAC blocks it', 'Yes: she can create a Pod that mounts it (or runs as a ServiceAccount that can read it) and print it', 'Only with exec permission', 'Only if the Secret is in an env var of an existing Pod'], answer: 1, explain: 'Workload creation is an indirect path to every Secret and ServiceAccount in the namespace. This is why sensitive Secrets belong in namespaces with few writers, and why admission policies can restrict volumes and ServiceAccounts.' },
    { kind: 'predict', q: 'The image has <code>USER spring</code>. The Pod sets <code>runAsNonRoot: true</code> and no <code>runAsUser</code>. What do you see?', options: ['Running: spring is not root', 'CrashLoopBackOff with permission denied', 'CreateContainerConfigError: cannot verify a non-numeric user is non-root', 'Pod Security rejects the Pod'], answer: 2, explain: 'The kubelet can only verify numeric UIDs. Use <code>USER 1000</code> in the image or set <code>runAsUser</code>. Pod Security itself is satisfied, because <code>runAsNonRoot: true</code> is set.' },
    { kind: 'concept', q: 'You want “developers can do everything in <code>shop</code> except delete Secrets”. How do you write that in RBAC?', options: ['You can’t write a deny rule. Grant an explicit list of resources and verbs that leaves out Secret delete, or block it with an admission policy', 'Role with <code>verbs: ["*"]</code> plus a rule with <code>deny: [delete]</code> on secrets', 'Use a ClusterRoleBinding with lower priority', 'Put Secrets in a different API group'], answer: 0, explain: 'RBAC is additive: the union of all matching rules. There is no deny and no priority. Write positive rules that exclude the action, or reject it in admission (a ValidatingAdmissionPolicy can match DELETE operations).' },
    { kind: 'concept', q: 'A Pod in 1.30 sets no <code>serviceAccountName</code>. What identity and credential does it get?', options: ['None', 'ServiceAccount <code>default</code>, with a long-lived token Secret', 'The node’s identity', 'ServiceAccount <code>default</code>, with a short-lived projected token mounted and refreshed by the kubelet (unless automount is disabled)'], answer: 3, explain: 'Since 1.24 token Secrets aren’t generated automatically. The ServiceAccount admission plugin sets <code>default</code>, and a projected volume supplies a bound token from the TokenRequest API, rotated before it expires.' },
    { kind: 'concept', q: 'A user has <code>create</code> on Roles and RoleBindings in <code>shop</code>, but only <code>view</code> permissions otherwise. Can they create a Role granting <code>delete pods</code> and bind it to themselves?', options: ['Yes, that’s what create on roles means', 'No: RBAC escalation prevention requires holding the permissions you grant (or the escalate/bind verbs)', 'Only with a ClusterRole', 'Yes, but it only takes effect after an hour'], answer: 1, explain: 'The API server refuses to create or update a Role containing permissions the requester doesn’t already have, unless they hold <code>escalate</code> on roles. Binding a role you don’t fully hold needs the <code>bind</code> verb.' }
  ],
  interview: [
    { q: 'Explain Role, ClusterRole, RoleBinding and ClusterRoleBinding.', a: '<p>Roles hold rules (API groups, resources, verbs, optional resourceNames). A <b>Role</b> lives in one namespace; a <b>ClusterRole</b> is cluster-scoped and can also cover cluster-scoped resources (nodes, PVs, CRDs) and non-resource URLs. A <b>RoleBinding</b> grants a Role <i>or</i> ClusterRole to subjects inside one namespace. A <b>ClusterRoleBinding</b> grants a ClusterRole everywhere. The common pattern is one ClusterRole reused by many RoleBindings.</p>', lvl: 'core' },
    { q: 'How does the API server decide whether a request is allowed?', a: '<ol><li><b>Authentication</b>: client certs, bearer tokens (ServiceAccount JWTs, OIDC) or an authenticating proxy produce a user, groups and extra fields.</li><li><b>Authorization</b>: the configured authorizers (typically Node and RBAC) are asked in order; the first allow wins, and if nobody allows, the request gets 403.</li><li><b>Admission</b> for writes: mutating, then schema validation, then validating admission (Pod Security, ValidatingAdmissionPolicy, webhooks).</li><li>Persist to etcd.</li></ol>', fu: 'Which part does <code>kubectl auth can-i</code> test? (Only authorization: it uses SelfSubjectAccessReview / SubjectAccessReview; it can’t tell you about admission.)', lvl: 'core' },
    { q: 'What changed with service-account tokens in recent versions?', a: '<p>Pods now get <b>bound</b> tokens through the TokenRequest API in a projected volume: audience-bound, time-limited and tied to the Pod, so they stop working when the Pod is deleted. The kubelet refreshes them before expiry; client libraries must re-read the file (current client-go and the Fabric8 / official Java clients do). Since 1.24, Secret-based tokens are no longer generated automatically, and since 1.30 (GA) the control plane labels unused legacy token Secrets as invalid and later deletes them. For a manual token use <code>kubectl create token &lt;sa&gt;</code>.</p>', lvl: 'deep' },
    { q: 'What are the Pod Security Standards and how are they enforced?', a: '<p>Three levels. <b>Privileged</b>: no restrictions. <b>Baseline</b>: blocks known privilege escalations (privileged containers, hostNetwork/PID/IPC, hostPath, host ports, extra capabilities). <b>Restricted</b>: baseline plus <code>runAsNonRoot</code>, <code>allowPrivilegeEscalation: false</code>, drop ALL capabilities (only NET_BIND_SERVICE may be added back), seccomp RuntimeDefault or Localhost, and limited volume types. The built-in Pod Security Admission applies them per namespace with labels for <code>enforce</code>, <code>audit</code> and <code>warn</code>, each optionally pinned to a version.</p>', lvl: 'core' },
    { q: 'Why was PodSecurityPolicy removed, and what replaced it?', a: '<p>PSP was hard to reason about: policies were selected through RBAC on the <i>user or ServiceAccount</i> creating the Pod, mutation and validation were mixed, and the chosen policy was hard to predict. It was deprecated in 1.21 and removed in 1.25. Replacements: Pod Security Admission for the standard levels, plus ValidatingAdmissionPolicy (CEL, GA in 1.30) or Kyverno/OPA Gatekeeper for custom rules.</p>', lvl: 'deep' },
    { q: 'Which RBAC permissions are dangerous even if they look harmless?', a: '<ul><li><code>list</code>/<code>watch</code> on Secrets (full content).</li><li><code>create</code> on Pods or any workload (mount any Secret, use any ServiceAccount in the namespace).</li><li><code>pods/exec</code>, <code>pods/attach</code>, <code>pods/portforward</code>: a shell in someone else’s container.</li><li><code>escalate</code>, <code>bind</code>, <code>impersonate</code>.</li><li><code>update</code> on <code>nodes/status</code>, webhooks configurations or CRDs (can intercept or break the cluster).</li><li><code>create</code> on <code>serviceaccounts/token</code>: mint tokens for others.</li></ul>', lvl: 'deep' },
    { q: 'What does a hardened securityContext look like for a JVM service?', a: '<p>Pod level: <code>runAsNonRoot: true</code>, numeric <code>runAsUser</code>/<code>runAsGroup</code>, <code>fsGroup</code> if volumes need it, <code>seccompProfile: RuntimeDefault</code>. Container level: <code>allowPrivilegeEscalation: false</code>, <code>capabilities.drop: [ALL]</code>, <code>readOnlyRootFilesystem: true</code> with an <code>emptyDir</code> at <code>/tmp</code>. The JVM needs no capabilities to bind port 8080.</p>', lvl: 'core' },
    { q: 'How do you give a Pod access to a cloud service (S3, Blob storage) without static keys?', a: '<p>Workload identity: the cloud trusts the cluster’s ServiceAccount token issuer (OIDC). The Pod gets a projected token with the cloud’s audience; the SDK exchanges it for short-lived cloud credentials mapped to a role. Examples: EKS IRSA / Pod Identity, GKE Workload Identity, Azure Workload Identity. No Secret to leak or rotate.</p>', lvl: 'deep' },
    { q: 'How do you audit who can do what?', a: '<p><code>kubectl auth can-i --list --as=…</code> for one subject; <code>kubectl get rolebindings,clusterrolebindings -A -o wide</code> and filter by subject; tools such as <code>rbac-lookup</code> or <code>kubectl-who-can</code> for reverse lookups. For what actually happened, the API server audit log records user, verb, resource and response code.</p>', lvl: 'core' },
    { q: 'What do the aggregated ClusterRoles admin, edit and view give you?', a: '<p><b>view</b>: read most namespaced objects, but not Secrets or Roles. <b>edit</b>: read and write most objects including Secrets and Pods, but not Roles or RoleBindings. <b>admin</b>: edit plus managing Roles and RoleBindings within the namespace (not the namespace itself or quotas). They are built by <code>aggregationRule</code>: a CRD’s ClusterRole labelled <code>rbac.authorization.k8s.io/aggregate-to-edit: "true"</code> is merged in automatically.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Least-privilege SA for a Spring app', lang: 'yaml', code: `apiVersion: v1
kind: ServiceAccount
metadata: { name: orders, namespace: shop }
automountServiceAccountToken: false      # opt in per Pod
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: { name: orders-config, namespace: shop }
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  resourceNames: ["orders-config"]       # only this object
  verbs: ["get", "watch"]                # Spring Cloud Kubernetes config reload
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: { name: orders-config, namespace: shop }
subjects: [{ kind: ServiceAccount, name: orders, namespace: shop }]
roleRef: { kind: Role, name: orders-config, apiGroup: rbac.authorization.k8s.io }`, note: '<code>resourceNames</code> can’t restrict <code>create</code> (the name isn’t known when the request is authorized) or a plain <code>list</code>; use it for get, update, patch, delete and watching a single named object.' },
    { title: 'Restricted-compliant Pod spec', lang: 'yaml', code: `spec:
  serviceAccountName: orders
  automountServiceAccountToken: true
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
    fsGroupChangePolicy: OnRootMismatch
    seccompProfile: { type: RuntimeDefault }
  containers:
  - name: app
    image: registry.example.com/orders:7.2
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities: { drop: ["ALL"] }
    volumeMounts:
    - { name: tmp, mountPath: /tmp }      # Tomcat temp dir
  volumes:
  - name: tmp
    emptyDir: { sizeLimit: 256Mi }` },
    { title: 'Check permissions from the shell', lang: 'bash', code: `# what can this SA do in shop?
kubectl auth can-i --list -n shop --as=system:serviceaccount:shop:orders

# one specific check (exit code 0 = yes)
kubectl auth can-i get secrets/db -n shop --as=system:serviceaccount:shop:orders

# who am I (1.28+ GA: kubectl auth whoami)
kubectl auth whoami

# preview which running Pods would violate a level
kubectl label --dry-run=server --overwrite ns shop \\
  pod-security.kubernetes.io/enforce=restricted

# mint a short-lived token (no Secret created)
kubectl create token orders -n shop --duration=10m` },
    { title: 'Read the projected token from Java', lang: 'java', code: `// The kubelet rotates this file before expiry: re-read it, never cache it forever.
Path token = Path.of("/var/run/secrets/kubernetes.io/serviceaccount/token");

HttpRequest req = HttpRequest.newBuilder(URI.create(
        "https://kubernetes.default.svc/api/v1/namespaces/shop/configmaps/orders-config"))
    .header("Authorization", "Bearer " + Files.readString(token).trim())
    .build();
// Trust the cluster CA from .../serviceaccount/ca.crt.
// In practice use the official Kubernetes Java client or Fabric8: both reload the token.`, note: 'Old clients that read the token once at startup start failing with 401 once the token expires; many clusters extend Pod token lifetimes for compatibility and log a warning, which hides the bug until that is turned off.' }
  ]
});

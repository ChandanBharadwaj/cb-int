IA.register({
  track: 'kubernetes',
  slug: 'cluster-upgrades',
  title: 'Upgrades & cluster ops',
  tagline: 'Kubernetes ships three minor releases a year and supports each for about 14 months, so upgrading is routine work. Do it in order: <b>back up etcd</b>, fix <b>removed APIs</b>, upgrade the <b>control plane</b> one minor at a time, then <b>drain and replace nodes</b>, always inside the <b>version-skew</b> rules.',
  tldr: {
    problem: 'Clusters fall behind because upgrades feel risky, then a forced upgrade removes an API that half the Helm charts still use, a node pool can’t drain because of a PDB, and the etcd backup turns out to be untested.',
    model: 'Order: API servers → controller manager, scheduler, cloud controller → kubelets and kube-proxy. Skew: HA API servers within 1 minor; controllers not newer than the API server and at most 1 older; kubelets not newer and at most <b>3</b> older (since 1.28); kubectl ±1. Control plane: one minor per upgrade. API removals break clients and manifests, not stored objects.',
    hook: '“Can we upgrade the control plane from 1.30 to 1.32 in one go?” No: one minor at a time. But kubelets may lag by three, so you can move the control plane twice and rotate nodes once.',
    facts: [
      { v: '3 / year', l: 'minor releases; each is supported with patches for about 14 months (12 months plus a 2-month upgrade window)' },
      { v: 'n−3', l: 'oldest kubelet allowed relative to the API server (since 1.28; n−2 before). Never newer than the API server' },
      { v: '1.25', l: 'removed PodSecurityPolicy, <code>policy/v1beta1</code> PodDisruptionBudget and <code>batch/v1beta1</code> CronJob: a classic upgrade breaker' }
    ]
  },
  intro: {
    what: 'A cluster has many parts with their own versions: the API servers, controllers and scheduler (the control plane), etcd (the database), and on every node the kubelet and kube-proxy. Upgrading means moving all of them to a newer Kubernetes minor release without downtime for your apps. The <b>version-skew policy</b> says which mixes of versions are allowed during that process. Managed services (EKS, GKE, AKS) do much of the work, but the order, the API removals and the node drains are still your problem.',
    analogy: { icon: '✈️', title: 'Replacing an aircraft’s systems in flight', text: 'You can’t land the plane. So you upgrade the cockpit first (the control plane), and make sure it still speaks the protocol of older engines (kubelets up to three versions behind). Then you swap the engines one at a time, keeping enough of them running (PDBs). And before you start, you write down exactly where you are (the etcd snapshot).' },
    steps: [
      { t: 'Find what will break', d: 'APIs removed in the target version that your manifests, charts or controllers still use.', code: 'kubectl get --raw /metrics | grep apiserver_requested_deprecated_apis\n# or scan manifests and Helm releases with pluto / kubent', lang: 'bash' },
      { t: 'Back up etcd', d: 'A snapshot of the cluster’s entire state, plus the encryption config and certificates.', code: 'ETCDCTL_API=3 etcdctl snapshot save /backup/etcd-$(date +%F).db \\\n  --endpoints=https://127.0.0.1:2379 --cacert=ca.crt --cert=etcd.crt --key=etcd.key', lang: 'bash' },
      { t: 'Upgrade the control plane, one minor', d: 'Managed: one click or API call. kubeadm: plan, then apply on each control-plane node.', code: 'kubeadm upgrade plan\nkubeadm upgrade apply v1.32.4      # first control-plane node\nkubeadm upgrade node               # the others', lang: 'bash' },
      { t: 'Roll the nodes', d: 'Cordon, drain (respecting PDBs), upgrade or replace, uncordon. One node or one surge batch at a time.', code: 'kubectl drain node-a1 --ignore-daemonsets --delete-emptydir-data --timeout=15m\n# upgrade kubelet / replace node\nkubectl uncordon node-a1', lang: 'bash' }
    ],
    terms: [
      ['minor version', 'The middle number: 1.31 → 1.32. Patch releases (1.32.3 → 1.32.4) are bug and security fixes.'],
      ['version skew', 'The allowed difference in versions between components that talk to each other.'],
      ['deprecated / removed API', 'An API version (e.g. <code>policy/v1beta1</code>) announced for removal, and later no longer served at all.'],
      ['etcd snapshot', 'A point-in-time copy of the key-value store holding every Kubernetes object.'],
      ['cordon / drain', 'Mark a node unschedulable, then evict its Pods through the eviction API (which honours PDBs).'],
      ['surge upgrade', 'Add new nodes at the target version first, move workloads, then remove the old nodes.']
    ]
  },
  visual: {
    title: 'An upgrade, checked against the skew rules',
    caption: 'Pick a scenario and press Play (or Step). Components turn blue when upgraded; the panel re-checks every version-skew rule after each step, and anything outside the policy turns red. Compare the safe order with a forgotten node pool and an attempt to skip a minor.'
  },
  gotchas: [
    { trap: 'Helm releases remember removed API versions', code: `helm upgrade orders ./chart -n shop
# Error: UPGRADE FAILED: unable to build kubernetes objects from current release manifest:
#   resource mapping not found for name: "orders" namespace: "" from "":
#   no matches for kind "PodDisruptionBudget" in version "policy/v1beta1"`, lang: 'bash', why: 'The live object was migrated by the API server and is fine. But Helm diffs against the <i>previous release manifest</i> stored in its release Secret, which still says <code>policy/v1beta1</code>, a version the upgraded cluster no longer serves.', fix: 'Update charts <i>before</i> the cluster upgrade. If it already happened, rewrite the stored release with the <code>helm mapkubeapis</code> plugin, then upgrade with the fixed chart.' },
    { trap: 'Thinking an API removal deletes your objects', why: 'Objects are stored once and served through every version the API server knows. When <code>v1beta1</code> is removed, existing PDBs remain and are served as <code>policy/v1</code>. What breaks is every client still <i>sending</i> or <i>requesting</i> the old version: manifests in Git, Helm charts, operators, CI scripts, monitoring tools.', fix: 'Search code, charts and running controllers for old apiVersions; watch <code>apiserver_requested_deprecated_apis</code> and deprecation warnings from kubectl; fix before the upgrade that removes them. The deprecation guide lists removals per release.' },
    { trap: 'PDBs that make drains impossible', why: 'A PDB with <code>minAvailable</code> equal to the replica count (or a single-replica Deployment with any PDB) allows zero evictions. The node drain waits forever, and managed upgrades either stall for hours or, after a timeout, force-delete the Pods anyway.', fix: 'Audit PDBs before upgrades (<code>kubectl get pdb -A</code>, look for ALLOWED DISRUPTIONS 0), run 2+ replicas for anything with a PDB, and prefer <code>maxUnavailable: 1</code>. See <a href="disruptions-pdb.html">Disruptions & PDBs</a>.' },
    { trap: 'An etcd backup without the encryption key', why: 'With encryption at rest, Secrets in the snapshot are encrypted with a key from the API server’s <code>EncryptionConfiguration</code> (or a KMS key). Restore the snapshot without that key and every Secret is unreadable.', fix: 'Back up etcd snapshots together with the encryption configuration, KMS access and PKI. Test a full restore into a scratch cluster regularly; an untested backup is a hope, not a backup.' },
    { trap: 'New node images change the runtime underneath old JVMs', why: 'Node upgrades often bring a new OS image with cgroup v2. JVMs without cgroup v2 support (JDK 8 before 8u372, 11 before 11.0.16) no longer see the container limit, size the heap from the node’s RAM, and get OOMKilled.', fix: 'Inventory base images before node upgrades; run supported JDK updates (17 and 21 handle cgroup v2). Canary one node pool with representative workloads first.' },
    { trap: 'Upgrading the control plane past webhooks and operators', why: 'Admission webhooks, CNI and CSI drivers, ingress controllers and operators all call the API. A new minor can remove APIs they use or change behaviour they rely on; a broken webhook with <code>failurePolicy: Fail</code> can block every Pod creation right after the upgrade.', fix: 'Check each add-on’s supported Kubernetes versions and upgrade add-ons first where needed. Upgrade a staging cluster with the same add-on versions before production.' }
  ],
  scenarios: [
    { title: 'Every Helm deploy failed the morning after the 1.25 upgrade',
      symptom: 'The managed cluster auto-upgraded from 1.24 to 1.25 overnight. All workloads still run, but every <code>helm upgrade</code> for about a third of the services fails with “no matches for kind PodDisruptionBudget in version policy/v1beta1”.',
      diagnoseLang: 'bash',
      diagnose: `kubectl get pdb -n shop orders -o jsonpath='{.apiVersion}'    # policy/v1 (live object is fine)
helm get manifest orders -n shop | grep -B1 -A1 'kind: PodDisruptionBudget'
#  apiVersion: policy/v1beta1     ← stored in the last release
grep -rn 'policy/v1beta1' charts/                                # templates still use it`,
      cause: 'Charts still rendered <code>policy/v1beta1</code>, removed in 1.25. The stored release manifests did too, so Helm couldn’t even compute the diff, and new renders couldn’t be applied.',
      fix: 'Rewrite the stored releases with <code>helm mapkubeapis</code>, update the chart templates (often with a <code>Capabilities.APIVersions</code> check), and add a CI step that validates rendered manifests against the next Kubernetes version’s schemas.',
      fixCode: `helm plugin install https://github.com/helm/helm-mapkubeapis
helm mapkubeapis orders -n shop            # rewrites the release Secret
# chart template
# apiVersion: {{ if .Capabilities.APIVersions.Has "policy/v1/PodDisruptionBudget" }}policy/v1{{ else }}policy/v1beta1{{ end }}
helm upgrade orders ./charts/orders -n shop -f values-prod.yaml
# CI: validate against the next version
kubeconform -kubernetes-version 1.26.0 -strict rendered.yaml`,
      fixLang: 'bash' },
    { title: 'A node pool upgrade stalled for six hours',
      symptom: 'The managed node-pool upgrade reports “draining node” for hours. Two nodes are cordoned, the rest are untouched. Eventually the provider’s timeout force-drains the nodes and a single-replica service goes down for 4 minutes.',
      diagnoseLang: 'bash',
      diagnose: `kubectl get nodes | grep SchedulingDisabled
kubectl get pdb -A -o wide | awk '$5 == 0'        # ALLOWED DISRUPTIONS = 0
#  payments   ledger-pdb   minAvailable 1   ...   0
kubectl get deploy ledger -n payments -o jsonpath='{.spec.replicas}'   # 1`,
      cause: 'A one-replica Deployment with <code>minAvailable: 1</code> can never be evicted. The drain retried for hours until the upgrade’s timeout bypassed the PDB, which is exactly the outage the PDB was meant to prevent.',
      fix: 'Give anything with a PDB at least 2 replicas (spread across nodes), use <code>maxUnavailable: 1</code>, and add a pre-upgrade check that lists PDBs with 0 allowed disruptions.',
      fixCode: `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: ledger-pdb, namespace: payments }
spec:
  maxUnavailable: 1
  selector: { matchLabels: { app: ledger } }
---
# and in the Deployment
spec:
  replicas: 2
  template:
    spec:
      topologySpreadConstraints:
      - { maxSkew: 1, topologyKey: kubernetes.io/hostname, whenUnsatisfiable: DoNotSchedule, labelSelector: { matchLabels: { app: ledger } } }` },
    { title: 'The disaster-recovery drill: etcd restored, Secrets unreadable',
      symptom: 'In a restore drill, a snapshot is restored into a new control plane. Deployments and ConfigMaps look right, but every <code>kubectl get secret</code> fails and Pods can’t start because their Secret volumes can’t be read.',
      diagnoseLang: 'bash',
      diagnose: `kubectl get secret db -n shop
#  Error from server (InternalError): Internal error occurred: unable to transform key
#  "/registry/secrets/shop/db": no matching prefix found
etcdctl get /registry/secrets/shop/db --print-value-only | head -c 40
#  k8s:enc:aescbc:v1:key1:....    ← encrypted with key1
grep -A3 aescbc /etc/kubernetes/encryption-config.yaml   # new cluster: different key`,
      cause: 'The production API servers encrypt Secrets at rest. The drill restored etcd but generated a fresh encryption configuration, so the stored ciphertext can’t be decrypted.',
      fix: 'Treat the encryption config (or KMS key access), CA and service-account signing keys as part of the backup. Document and rehearse the full restore: stop all API servers, restore the snapshot on every etcd member (or a new single-member cluster), start with the original keys.',
      fixCode: `# backup set (store encrypted, off-cluster)
etcdctl snapshot save etcd.db
cp /etc/kubernetes/encryption-config.yaml  backup/
cp -r /etc/kubernetes/pki                  backup/    # includes sa.key for token signing
# restore (kubeadm-style control plane, all API servers stopped)
etcdutl snapshot restore etcd.db --data-dir /var/lib/etcd-restored
# point etcd at the new data dir, restore the same encryption-config and pki, start API servers`,
      fixLang: 'bash' }
  ],
  puzzles: [
    { kind: 'concept', q: 'The API servers run 1.32. What is the oldest kubelet version the skew policy allows?', options: ['1.31', '1.30', '1.29', '1.28'], answer: 2, explain: 'Since 1.28, kubelets may be up to three minors older than the API server: 1.32 − 3 = <b>1.29</b>. They may never be newer.' },
    { kind: 'scenario', q: 'A new node pool is created with 1.33 kubelets while the control plane is still on 1.32. Supported?', options: ['Yes, within one minor', 'No: kubelets must never be newer than the API server', 'Yes, if kube-proxy is 1.32', 'Only for Windows nodes'], answer: 1, explain: 'The skew is one-directional for kubelets: older is fine (up to three minors), newer is not. That is why the control plane goes first.' },
    { kind: 'concept', q: 'In which order do you upgrade the components?', options: ['Kubelets, then API servers, then controllers', 'API servers, then controller manager / scheduler, then kubelets', 'etcd last, after the nodes', 'Any order, as long as it is within one minor'], answer: 1, explain: 'Controllers and kubelets may lag the API server but must not lead it. So: API servers (one at a time in HA), then controllers, then nodes.' },
    { kind: 'scenario', q: 'You want to go from 1.30 to 1.32. Can you upgrade the control plane directly to 1.32?', options: ['Yes, if all nodes are on 1.30', 'No: control-plane upgrades go one minor at a time (1.30 → 1.31 → 1.32)', 'Yes, with kubeadm --force', 'Only on managed clusters'], answer: 1, explain: 'Skipping a minor is unsupported: storage migrations, feature graduations and API removals assume each minor ran. The nodes, however, can stay on 1.30 through both steps (two minors behind is within skew).' },
    { kind: 'concept', q: '1.25 removed <code>policy/v1beta1</code> PodDisruptionBudget. What happens to PDBs created with that version before the upgrade?', options: ['They are deleted', 'They keep working and are served as <code>policy/v1</code>; only clients using the old version break', 'They stop being enforced', 'The upgrade is blocked until you delete them'], answer: 1, explain: 'The stored object is version-independent from the client’s point of view; the API server serves it through the versions it still supports. Manifests, charts and tools that use the removed version are what fail.' },
    { kind: 'scenario', q: 'You restore an etcd snapshot from 02:00 at 05:00. What happens to a Deployment created at 03:00?', options: ['It is merged back in', 'It is gone: the cluster state is as of 02:00, and controllers converge everything (Pods on nodes included) to that state', 'It stays because Pods are on the nodes', 'Restores only include Secrets'], answer: 1, explain: 'A restore is a full rollback of cluster state. Kubelets will kill containers whose Pods no longer exist. That is why GitOps (re-apply desired state) plus volume backups is often a better recovery path than etcd restore for application changes.' },
    { kind: 'concept', q: 'API server 1.31, your kubectl is 1.29. Supported?', options: ['Yes: kubectl works with any version', 'No: kubectl is supported within one minor of the API server (1.30–1.32 here)', 'Yes, because kubectl is older', 'Only for read commands'], answer: 1, explain: 'kubectl skew is ±1 minor. It often still works, but behaviour around newer or removed fields isn’t guaranteed. Pin kubectl versions in CI to match the cluster.' },
    { kind: 'concept', q: 'How do you find out which clients still call deprecated APIs before an upgrade?', options: ['You can’t until it breaks', 'The API server’s <code>apiserver_requested_deprecated_apis</code> metric and deprecation audit annotations identify the API versions and (via audit logs) the callers', '<code>kubectl get all</code>', 'Only by reading every Helm chart'], answer: 1, explain: 'Since 1.19 the API server returns warnings and records metrics and audit annotations (<code>k8s.io/deprecated</code>) for deprecated API calls. Audit logs give you the user agent and service account; tools like pluto and kubent scan manifests and releases.' }
  ],
  interview: [
    { q: 'Explain the Kubernetes version-skew policy.', a: '<ul><li><b>kube-apiserver</b>: in HA, the newest and oldest instance within 1 minor.</li><li><b>controller manager, scheduler, cloud controller manager</b>: not newer than the API servers they talk to; may be 1 minor older.</li><li><b>kubelet</b>: not newer than the API server; up to 3 minors older (since 1.28; 2 before). kube-proxy follows the same rule.</li><li><b>kubectl</b>: within 1 minor, older or newer.</li></ul><p>Consequences: upgrade the control plane first; nodes can lag; never skip a control-plane minor.</p>', lvl: 'core' },
    { q: 'Walk me through a production cluster upgrade.', a: '<ol><li>Read the release notes and deprecation guide; scan for removed APIs (metrics, pluto/kubent, chart renders) and fix them.</li><li>Check add-on compatibility (CNI, CSI, ingress, cert-manager, operators, webhooks) and upgrade them if needed.</li><li>Check PDBs, capacity headroom and recent etcd backups.</li><li>Upgrade staging with the same versions; run smoke tests.</li><li>Control plane, one minor.</li><li>Node pools: surge or rolling, one pool at a time, watching error rates.</li><li>Post-checks; record what broke for the next time.</li></ol>', lvl: 'core' },
    { q: 'How do API deprecations work in Kubernetes?', a: '<p>Per the deprecation policy, beta API versions are deprecated and removed after a defined period (several releases); GA versions are not removed within a major version. Removal means the API server stops serving that group/version; stored objects are still readable through newer versions. Since 1.19 the API server sends warnings for deprecated calls and records metrics and audit annotations. Known big removals: 1.16 (extensions/v1beta1 workloads), 1.22 (Ingress v1beta1, CRD v1beta1), 1.25 (PSP, PDB v1beta1, CronJob v1beta1), 1.26 (HPA v2beta2), 1.29 and 1.32 (flowcontrol betas).</p>', lvl: 'deep' },
    { q: 'How do you back up and restore etcd?', a: '<p><code>etcdctl snapshot save</code> against one healthy member (it is a consistent snapshot of the whole keyspace), stored off-cluster and encrypted, together with the encryption config, PKI and service-account keys. Restore: stop all API servers, <code>etcdutl snapshot restore</code> into a new data directory on each member (with the original cluster settings or as a new cluster), start etcd, then the API servers. Expect controllers to reconcile toward the restored state. Managed services hide etcd; there you back up workloads (Velero, volume snapshots) and keep desired state in Git.</p>', lvl: 'deep' },
    { q: 'In-place node upgrades vs node replacement?', a: '<p><b>In place</b> (kubeadm): drain, upgrade the kubelet and kubeadm packages, restart, uncordon. Keeps the node’s disks and IP; one minor per step. <b>Replacement</b> (immutable nodes, managed pools, Karpenter): create new nodes from an image at the target version, drain and delete old ones; with surge you never lose capacity. Replacement also picks up OS and runtime patches and avoids configuration drift; it is the common choice in the cloud.</p>', lvl: 'core' },
    { q: 'What makes node drains slow or stuck, and how do you prepare workloads?', a: '<p>PDBs with zero allowed disruptions, single-replica workloads, Pods with long <code>terminationGracePeriodSeconds</code>, slow-starting replacements (JVM warm-up, readiness), Pods that the drain refuses to evict without flags (local storage, unmanaged Pods), and insufficient spare capacity for rescheduling. Prepare: 2+ replicas, sensible PDBs, fast graceful shutdown, startup probes, topology spread, and capacity headroom (or surge nodes).</p>', lvl: 'core' },
    { q: 'How do you keep up with the release cadence?', a: '<p>Three minors a year with about 14 months of patch support each means you must upgrade at least yearly, realistically every release or two. Make it boring: automate pre-flight checks in CI (manifest validation against the next version), keep add-ons current, use managed release channels, upgrade non-production first on a schedule, and treat “days behind latest supported” as a tracked metric.</p>', lvl: 'deep' },
    { q: 'What changes for Java services during a cluster upgrade?', a: '<p>Directly: nothing in the API they use, unless they talk to the Kubernetes API with an old client (Fabric8/official Java client versions support a range of server versions). Indirectly: every Pod is evicted and rescheduled during node rotation, so graceful shutdown, readiness after warm-up and PDBs decide whether users notice; new node images can bring cgroup v2, which old JDKs mishandle. See <a href="jvm-on-k8s.html">Java/Spring on Kubernetes</a>.</p>', lvl: 'core' },
    { q: 'Blue-green clusters vs in-place upgrades?', a: '<p>Blue-green: build a new cluster at the target version, deploy everything (easy with GitOps), shift traffic via DNS or a global load balancer, keep the old cluster for rollback. Pros: real rollback, can skip minors, test under production config. Cons: double cost during migration, stateful workloads and persistent volumes are hard to move, external integrations (IPs, IAM bindings) must be duplicated. In-place is cheaper and the norm; blue-green suits stateless platforms or big jumps.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'etcd snapshot (self-managed)', lang: 'bash', code: `export ETCDCTL_API=3
SNAP=/backup/etcd-$(date +%Y%m%d-%H%M).db
etcdctl snapshot save "$SNAP" \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key
etcdutl snapshot status "$SNAP" -w table        # revision, keys, size
# keep with it: encryption-config.yaml, /etc/kubernetes/pki (incl. sa.key), etcd version
tar czf "$SNAP.keys.tgz" /etc/kubernetes/encryption-config.yaml /etc/kubernetes/pki` },
    { title: 'Find deprecated and removed APIs', lang: 'bash', code: `# which deprecated APIs are being called right now (removed_release label = when it goes)
kubectl get --raw /metrics | grep apiserver_requested_deprecated_apis

# scan manifests, Helm releases and live objects (third-party tools)
pluto detect-helm -o wide --target-versions k8s=v1.32.0
pluto detect-files -d ./manifests
kubent --target-version 1.32.0

# validate rendered charts against the target version's schemas
helm template orders ./charts/orders -f values-prod.yaml \\
  | kubeconform -kubernetes-version 1.32.0 -strict -summary` },
    { title: 'kubeadm upgrade sequence', lang: 'bash', code: `# --- first control-plane node ---
apt-get install -y kubeadm=1.32.4-1.1         # package version format of pkgs.k8s.io
kubeadm upgrade plan
kubeadm upgrade apply v1.32.4
# --- other control-plane nodes ---
kubeadm upgrade node
# --- each control-plane node, then each worker (one at a time) ---
kubectl drain NODE --ignore-daemonsets --delete-emptydir-data --timeout=15m
apt-get install -y kubelet=1.32.4-1.1 kubectl=1.32.4-1.1
kubeadm upgrade node                          # on workers: updates kubelet config
systemctl daemon-reload && systemctl restart kubelet
kubectl uncordon NODE
kubectl get nodes -o wide                     # VERSION column` },
    { title: 'Pre-upgrade checks', lang: 'bash', code: `# versions in the cluster right now
kubectl version
kubectl get nodes -o custom-columns=NAME:.metadata.name,KUBELET:.status.nodeInfo.kubeletVersion,OS:.status.nodeInfo.osImage,RUNTIME:.status.nodeInfo.containerRuntimeVersion

# PDBs that will block drains
kubectl get pdb -A -o custom-columns=NS:.metadata.namespace,NAME:.metadata.name,ALLOWED:.status.disruptionsAllowed | awk 'NR==1 || $3==0'

# webhooks on the critical path
kubectl get validatingwebhookconfigurations,mutatingwebhookconfigurations \\
  -o custom-columns=NAME:.metadata.name,FAIL:.webhooks[*].failurePolicy

# single-replica Deployments (will have a gap during the drain)
kubectl get deploy -A -o json | jq -r '.items[] | select(.spec.replicas==1) | "\\(.metadata.namespace)/\\(.metadata.name)"'` }
  ]
});

IA.register({
  track: 'kubernetes',
  slug: 'volumes-storage',
  title: 'Volumes, PV & PVC',
  tagline: 'A container’s filesystem dies with it. <b>Volumes</b> outlive containers, and <b>PersistentVolumes</b> outlive pods. A PVC is the <i>request</i>, a PV the <i>disk</i>, and a StorageClass the <i>recipe</i>. Most storage incidents come down to <b>zones</b>, <b>access modes</b> and <b>reclaim policy</b>.',
  tldr: {
    problem: 'Pods stuck <code>Pending</code> with “volume node affinity conflict”, <code>ContainerCreating</code> with “Multi-Attach error”, or a <code>kubectl delete</code> that quietly deleted the production disk.',
    model: 'PVC (namespaced request: size, access mode, class) → <b>binding</b> → PV (cluster-scoped, an actual disk with topology). With a StorageClass, a <b>CSI driver</b> creates the disk on demand. Then the volume is <b>attached</b> to a node and <b>mounted</b> into the pod. Block disks live in <b>one zone</b> and, with RWO, on <b>one node</b> at a time.',
    hook: '“Why is my StatefulSet pod Pending after a node failure?” Its zonal disk can’t follow it to a node in another zone. Use <code>WaitForFirstConsumer</code> and keep capacity in every zone.',
    facts: [
      { v: '4', l: 'access modes: RWO (one <i>node</i>), ROX, RWX, and RWOP (one <i>pod</i>, GA 1.29)' },
      { v: 'Delete', l: 'is the default reclaim policy for dynamically provisioned PVs: deleting the PVC deletes the cloud disk. Set <code>reclaimPolicy: Retain</code> on classes for data you care about' },
      { v: 'Immediate', l: 'is the default <code>volumeBindingMode</code>. The disk is created before the scheduler has chosen a node, and so possibly in the wrong zone' }
    ]
  },
  intro: {
    what: 'Anything a container writes to its own filesystem is lost when it restarts. A <b>volume</b> is a directory mounted into the container that lives longer. Some volumes live as long as the pod (<code>emptyDir</code>). Others are real disks that outlive any pod: you ask for one with a <b>PersistentVolumeClaim</b> (“10 GiB, fast SSD”), and Kubernetes binds it to a <b>PersistentVolume</b>, usually by creating a new cloud disk through a <b>StorageClass</b>.',
    analogy: { icon: '🧳', title: 'Hotel luggage storage', text: 'You (the pod) hand in a claim ticket (PVC) asking for “one large locker”. The hotel (the cluster) either gives you a locker it already has (a static PV) or builds one on the spot from its standard design (StorageClass → dynamic provisioning). Lockers are in a specific building (zone). If you change hotels across town, your locker can’t follow you.' },
    steps: [
      { t: 'Ephemeral scratch space', d: '<code>emptyDir</code> is created empty when the pod starts and deleted when the pod goes away. It survives container restarts.', code: 'volumes:\n  - name: tmp\n    emptyDir: { sizeLimit: 1Gi }' },
      { t: 'Ask for durable storage', d: 'A PVC names a size, an access mode and (optionally) a StorageClass.', code: 'apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata: { name: data }\nspec:\n  accessModes: [ReadWriteOnce]\n  storageClassName: gp3\n  resources: { requests: { storage: 20Gi } }' },
      { t: 'The StorageClass provisions it', d: 'Its CSI driver creates a disk and a PV object, then binds it to the PVC.', code: 'kubectl get pvc data\n# NAME  STATUS  VOLUME                   CAPACITY  ACCESS MODES  STORAGECLASS\n# data  Bound   pvc-3f2a…                20Gi      RWO           gp3', lang: 'bash' },
      { t: 'Mount it in the pod', d: 'Reference the claim by name. The disk is attached to the pod’s node and mounted at the path.', code: 'volumes:\n  - name: data\n    persistentVolumeClaim: { claimName: data }' },
      { t: 'Decide what happens on delete', d: 'The PV’s reclaim policy: <code>Delete</code> removes the disk with the claim; <code>Retain</code> keeps it for manual recovery.' }
    ],
    terms: [
      ['PersistentVolume (PV)', 'A cluster-scoped object representing a real piece of storage, with capacity, access modes and node affinity (its zone).'],
      ['PersistentVolumeClaim (PVC)', 'A namespaced request for storage. Pods reference PVCs, never PVs directly.'],
      ['StorageClass', 'A provisioner (a CSI driver), parameters (disk type, IOPS), reclaim policy, binding mode and expansion setting.'],
      ['CSI', 'Container Storage Interface: the plugin API storage vendors implement (controller side: create/attach; node side: mount).'],
      ['access mode', 'How the volume may be mounted: RWO, ROX, RWX, RWOP.'],
      ['WaitForFirstConsumer', 'A binding mode that delays provisioning until a pod is scheduled, so the disk is created in that pod’s zone.']
    ]
  },
  visual: {
    title: 'From PVC to mounted disk (and back)',
    caption: 'The pod can only run in <b>zone b</b>. Pick a binding mode and a reclaim policy, then press Play to watch provisioning, scheduling, attach and mount, and finally what happens when you delete the claim.'
  },
  gotchas: [
    { trap: 'Immediate binding creates the disk in the wrong zone', why: 'With <code>Immediate</code>, the provisioner creates the disk as soon as the PVC exists, before the scheduler knows where the pod will go. If the pod’s other constraints (node affinity, resources, taints) only fit another zone, it is stuck with “volume node affinity conflict”.', fix: 'Use <code>volumeBindingMode: WaitForFirstConsumer</code> for zonal storage. Most cloud defaults already do; check custom classes.' },
    { trap: 'RWO means one node, not one pod', why: 'Two pods on the <i>same</i> node can both mount an RWO volume, and both write to it. On different nodes, the second pod hits “Multi-Attach error” and waits in <code>ContainerCreating</code>.', fix: 'Use <code>ReadWriteOncePod</code> (GA 1.29) when exactly one writer must be guaranteed. For Deployments with an RWO PVC, use <code>strategy: Recreate</code> so the old pod releases the disk before the new one starts.' },
    { trap: 'Deleting the PVC deleted the data', code: `kubectl get storageclass gp3 -o jsonpath='{.reclaimPolicy}'\n# Delete`, lang: 'bash', why: 'Dynamically provisioned PVs inherit the class’s reclaim policy, which is <code>Delete</code> unless set otherwise. <code>helm uninstall</code> or a namespace deletion removes the PVCs, and the cloud disks go with them.', fix: 'Use a <code>Retain</code> class for stateful data, or patch existing PVs: <code>kubectl patch pv &lt;pv&gt; -p \'{"spec":{"persistentVolumeReclaimPolicy":"Retain"}}\'</code>. Take VolumeSnapshots or backups (for example Velero) regardless.' },
    { trap: 'A Released PV won’t bind again by itself', why: 'With <code>Retain</code>, deleting the PVC leaves the PV in <code>Released</code>, still holding a <code>claimRef</code> to the old claim. A new PVC with the same name won’t bind to it automatically, because the data might belong to someone else.', fix: 'To reuse it on purpose, remove <code>spec.claimRef</code> (the PV becomes <code>Available</code>) and create a PVC that names it via <code>volumeName</code>.' },
    { trap: '<code>emptyDir: { medium: Memory }</code> eats the memory limit', why: 'A memory-backed emptyDir is tmpfs. Pages written there are charged to the container’s memory cgroup and can’t be reclaimed, so a big temp file gets the container OOM-killed.', fix: 'Set <code>sizeLimit</code> and size the memory limit to include it, or use a disk-backed emptyDir for large scratch data (for example Spring multipart uploads or JVM heap dumps).' },
    { trap: 'Slow pod start on big volumes: recursive chown', why: 'With <code>fsGroup</code> set, the kubelet by default changes ownership of every file in the volume on every mount. That takes minutes on volumes with millions of files.', fix: 'Set <code>securityContext.fsGroupChangePolicy: OnRootMismatch</code> so it only runs when the root directory’s ownership is wrong.' }
  ],
  scenarios: [
    { title: 'Postgres StatefulSet pod Pending after a zone outage',
      symptom: 'Zone a lost its nodes. <code>pg-1</code> was evicted and stays <code>Pending</code>, although zones b and c have plenty of free capacity.',
      diagnose: `kubectl describe pod pg-1 | sed -n '/Events/,$p'\n#  Warning  FailedScheduling  0/6 nodes are available:\n#  3 node(s) had volume node affinity conflict, 3 node(s) were unschedulable.\nkubectl get pv $(kubectl get pvc data-pg-1 -o jsonpath='{.spec.volumeName}') \\\n  -o jsonpath='{.spec.nodeAffinity.required.nodeSelectorTerms[0].matchExpressions[0].values}'\n# ["eu-west-1a"]`,
      diagnoseLang: 'bash',
      cause: 'The PV is a zonal block disk in <code>eu-west-1a</code>. A pod can only run where its volume can attach, and zone a has no usable nodes.',
      fix: 'This is expected for zonal disks: replication belongs at the database layer. Run Postgres replicas spread across zones (an operator such as CloudNativePG handles failover), so losing a zone means promoting a replica, not moving a disk. Keep <code>WaitForFirstConsumer</code> so new volumes land where their pods are.',
      fixCode: `apiVersion: storage.k8s.io/v1\nkind: StorageClass\nmetadata: { name: gp3-retain }\nprovisioner: ebs.csi.aws.com\nparameters: { type: gp3 }\nreclaimPolicy: Retain\nvolumeBindingMode: WaitForFirstConsumer\nallowVolumeExpansion: true` },
    { title: 'Every deploy hangs for minutes on “Multi-Attach error”',
      symptom: 'A single-replica Deployment with an RWO PVC (a report generator) takes 6+ minutes per rollout. The new pod sits in <code>ContainerCreating</code>.',
      diagnose: `kubectl describe pod reports-7c9…-x2 | grep -A2 FailedAttachVolume\n# Multi-Attach error for volume "pvc-91e…" Volume is already used by pod(s) reports-5d4…-q8`,
      diagnoseLang: 'bash',
      cause: 'The default <code>RollingUpdate</code> strategy starts the new pod before the old one stops. It landed on another node, but the disk can attach to only one node, and the old pod still holds it.',
      fix: 'Use <code>strategy: Recreate</code> for Deployments that own an RWO volume, or make the workload a StatefulSet. Use RWOP to make the single-writer intent explicit.',
      fixCode: `apiVersion: apps/v1\nkind: Deployment\nspec:\n  replicas: 1\n  strategy: { type: Recreate }   # stop old pod, detach, then start new` },
    { title: 'Disk full at 3 a.m.: growing a volume without downtime',
      symptom: 'Kafka/Postgres PVC at 98%. The on-call engineer wants more space before writes fail.',
      diagnose: `kubectl get sc gp3 -o jsonpath='{.allowVolumeExpansion}'   # true?\nkubectl exec pg-0 -- df -h /var/lib/postgresql/data`,
      diagnoseLang: 'bash',
      cause: 'The volume was sized for last year’s data. Volumes never grow on their own.',
      fix: 'If the class allows expansion, raise <code>spec.resources.requests.storage</code> on the PVC. Most CSI drivers expand online, then grow the filesystem. You cannot shrink a PVC. Add alerts on <code>kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes</code>.',
      fixCode: `kubectl patch pvc data-pg-0 -p '{"spec":{"resources":{"requests":{"storage":"200Gi"}}}}'\nkubectl get pvc data-pg-0 -w   # watch conditions: Resizing -> FileSystemResizePending -> done`,
      lang: 'bash' }
  ],
  puzzles: [
    { kind: 'scenario', q: 'A Deployment with 3 replicas mounts one RWO PVC. The scheduler places the pods on 3 different nodes. What happens?', options: ['All 3 run and share the disk', 'One node’s pod runs; pods on other nodes fail to attach (Multi-Attach)', 'The PVC is cloned 3 times', 'The API rejects the Deployment'], answer: 1, explain: 'RWO is enforced per node at attach time. Pods on the node that has the disk attached can mount it; the others wait. Use a StatefulSet with <code>volumeClaimTemplates</code> (one PVC per replica), or RWX storage if sharing is really what you want.' },
    { kind: 'scenario', q: 'StorageClass with <code>volumeBindingMode: Immediate</code>, zonal disks. The pod has a node selector for zone b. The provisioner happened to create the disk in zone a. Result?', options: ['The disk migrates to zone b', 'Pod Pending: volume node affinity conflict', 'The pod runs in zone a anyway', 'A second disk is created in zone b'], answer: 1, explain: 'The PV carries node affinity for zone a, and the pod requires zone b. No node satisfies both. With <code>WaitForFirstConsumer</code>, provisioning waits for scheduling, so the disk is created in the chosen node’s zone.' },
    { kind: 'predict', q: 'PV reclaim policy <code>Retain</code>. You delete the PVC, then recreate a PVC with the same name and spec. What does it bind to?', options: ['The old PV, with the data', 'A newly provisioned volume (or it stays Pending without a class)', 'Nothing: Released PVs block the name', 'The old PV, with its data wiped'], answer: 1, explain: 'The old PV is <code>Released</code> and still has a <code>claimRef</code> to the deleted claim’s UID, so it is not available. The new PVC gets a fresh volume. To recover the old data, clear the claimRef and bind with <code>volumeName</code>.' },
    { kind: 'predict', q: 'A StatefulSet <code>db</code> with <code>volumeClaimTemplates: data</code> scales from 3 to 1, then back to 3, with the default PVC retention policy. What does <code>db-2</code> get?', options: ['A new empty volume', 'Its old PVC data-db-2, with the old data', 'db-0’s volume', 'It fails: the PVC was deleted'], answer: 1, explain: 'By default StatefulSet PVCs are kept on scale-down (<code>persistentVolumeClaimRetentionPolicy</code> <code>whenScaled: Retain</code>), so <code>db-2</code> re-attaches <code>data-db-2</code>. Setting <code>whenScaled: Delete</code> (the policy is GA since 1.32) changes that.' },
    { kind: 'bug', q: 'A container has <code>limits.memory: 1Gi</code> and writes a 1.5 GiB temp file to an <code>emptyDir</code> with <code>medium: Memory</code>. What happens?', options: ['It spills to disk', 'The write fails with ENOSPC only', 'Memory use exceeds the limit, so the container is OOM-killed (or the pod is evicted if sizeLimit is exceeded)', 'Nothing: tmpfs is free'], answer: 2, explain: 'tmpfs pages count toward the container’s memory cgroup and can’t be swapped or dropped. Use a disk-backed emptyDir for large files, or raise the limit and set <code>sizeLimit</code>.' },
    { kind: 'concept', q: 'A PVC omits <code>storageClassName</code>. Another PVC sets <code>storageClassName: ""</code>. Which one uses the cluster’s default StorageClass?', options: ['Both', 'Only the one that omits it', 'Only the empty-string one', 'Neither'], answer: 1, explain: 'Omitted means “use the default class” (the admission plugin fills it in). An explicit empty string means “no class”: bind only to pre-created PVs that also have no class.' },
    { kind: 'scenario', q: 'You edit a 100Gi PVC to request 50Gi to save money. What happens?', options: ['The volume shrinks online', 'The API server rejects the change', 'It shrinks after the pod restarts', 'A new 50Gi volume is created'], answer: 1, explain: 'Shrinking a PVC is not supported, and the request is rejected. To reduce size, create a new smaller volume and migrate the data (a snapshot doesn’t help, since restores must be at least the source size).' }
  ],
  interview: [
    { q: 'Explain PV, PVC and StorageClass, and how they relate.', a: '<p>A <b>PVC</b> is a namespaced request (size, access modes, class). A <b>PV</b> is cluster-scoped storage with capacity, access modes, reclaim policy and node affinity. The PV controller <b>binds</b> one PVC to one PV (1:1). A <b>StorageClass</b> enables dynamic provisioning: a PVC for that class triggers the CSI driver’s external-provisioner to create a disk and a PV. Pods reference PVCs, which decouples apps from the storage details.</p>', lvl: 'core' },
    { q: 'What does the full path from PVC to a mounted filesystem look like?', a: '<ol><li>Provision: the CSI controller <code>CreateVolume</code> creates the PV, which binds to the PVC.</li><li>Schedule: the scheduler’s VolumeBinding plugin respects the PV’s topology.</li><li>Attach: the attach/detach controller creates a <code>VolumeAttachment</code>, and the external-attacher calls <code>ControllerPublishVolume</code> (the cloud attaches the disk).</li><li>Mount: the kubelet calls the CSI node plugin <code>NodeStageVolume</code> (format and mount to a global path) and <code>NodePublishVolume</code> (bind mount into the pod).</li></ol>', fu: 'Which step fails for “Multi-Attach error”? (Attach.) And for “volume node affinity conflict”? (Scheduling.)', lvl: 'deep' },
    { q: 'Immediate vs WaitForFirstConsumer?', a: '<p><code>Immediate</code> provisions and binds when the PVC is created: fine for storage reachable from every node (network filesystems). <code>WaitForFirstConsumer</code> delays it until a pod using the PVC is scheduled. The scheduler picks a node with all constraints in mind and records it on the PVC (<code>volume.kubernetes.io/selected-node</code>), and the disk is created in that topology. Use WFFC for zonal block storage and local volumes.</p>', lvl: 'core' },
    { q: 'Access modes: what do they actually guarantee?', a: '<ul><li><b>RWO</b>: read-write by a single <i>node</i>; several pods on it may share.</li><li><b>ROX</b>: read-only by many nodes.</li><li><b>RWX</b>: read-write by many nodes (NFS, EFS, CephFS, Azure Files).</li><li><b>RWOP</b>: read-write by a single <i>pod</i> (GA 1.29, CSI only).</li></ul><p>They are matching criteria plus attach-time enforcement. They don’t make the application safe for concurrent writers.</p>', lvl: 'core' },
    { q: 'Reclaim policies and PV phases?', a: '<p>Phases: <code>Available</code> → <code>Bound</code> → (PVC deleted) <code>Released</code>, or <code>Failed</code> if automatic reclamation failed. <code>Delete</code> removes the PV and the backing disk. <code>Retain</code> keeps both, and an admin must clean up or rebind. <code>Recycle</code> (scrub with <code>rm -rf</code>) is deprecated. The finalizers <code>kubernetes.io/pvc-protection</code> and <code>pv-protection</code> stop deletion while a pod still uses the volume.</p>', lvl: 'core' },
    { q: 'Name the volume types you’d use in practice.', a: '<ul><li><code>emptyDir</code> (scratch, caches, sharing between containers).</li><li><code>configMap</code>/<code>secret</code>/<code>projected</code> (config, tokens).</li><li><code>persistentVolumeClaim</code> (durable data).</li><li>Generic ephemeral volumes (GA 1.23): a PVC-backed volume whose life follows the pod, for big scratch space with a real StorageClass.</li><li>CSI ephemeral (for example the Secrets Store CSI driver).</li><li><code>hostPath</code> (node agents only; a security risk, and blocked by the Baseline Pod Security Standard).</li></ul>', lvl: 'core' },
    { q: 'How do StatefulSets handle storage?', a: '<p><code>volumeClaimTemplates</code> create one PVC per ordinal (<code>data-db-0</code>, <code>data-db-1</code>…), and a pod always gets the same PVC back after rescheduling. PVCs survive scale-down and StatefulSet deletion by default. <code>persistentVolumeClaimRetentionPolicy</code> (<code>whenDeleted</code>/<code>whenScaled</code>, GA 1.32) can delete them automatically.</p>', lvl: 'core' },
    { q: 'A node dies with a pod holding an RWO volume. Why does recovery take minutes?', a: '<p>The control plane can’t tell a dead node from a partitioned one that is still writing. The pod is marked for deletion after the NoExecute taint’s toleration (300 s by default), but the volume stays attached until it is detached safely. The attach/detach controller has a timeout before force-detaching. With <b>non-graceful node shutdown</b> (GA 1.28), an operator who knows the node is really off can add the taint <code>node.kubernetes.io/out-of-service=nodeshutdown:NoExecute</code> to force-delete pods and detach volumes at once.</p>', lvl: 'deep' },
    { q: 'Should you run Postgres on Kubernetes?', a: '<p>You can, with care: a StatefulSet or (better) an operator (CloudNativePG, Crunchy, Zalando) that handles replication, failover, backups to object storage and upgrades. Use <code>Retain</code> classes, WFFC, anti-affinity across zones, dedicated nodes, and tested restores. Many teams still choose a managed database (RDS, Cloud SQL, Azure Flexible Server) so that storage durability and failover are someone else’s pager.</p>', lvl: 'deep' },
    { q: 'How do you back up and resize volumes?', a: '<p>Snapshots: <code>VolumeSnapshot</code>/<code>VolumeSnapshotClass</code> (GA 1.20; needs the snapshot CRDs and controller plus driver support), with restore via a PVC <code>dataSource</code>. Cluster-level backup tools (Velero) combine snapshots with manifests. Resize: <code>allowVolumeExpansion: true</code> on the class, then edit the PVC request (grow only). Most CSI drivers support online expansion.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'StorageClass + StatefulSet', lang: 'yaml', code: `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata: { name: ssd-retain }
provisioner: ebs.csi.aws.com          # or pd.csi.storage.gke.io, disk.csi.azure.com
parameters: { type: gp3 }
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
---
apiVersion: apps/v1
kind: StatefulSet
metadata: { name: db }
spec:
  serviceName: db
  replicas: 3
  selector: { matchLabels: { app: db } }
  persistentVolumeClaimRetentionPolicy: { whenDeleted: Retain, whenScaled: Retain }
  template:
    metadata: { labels: { app: db } }
    spec:
      securityContext: { fsGroup: 999, fsGroupChangePolicy: OnRootMismatch }
      containers:
        - name: postgres
          image: postgres:17
          volumeMounts: [{ name: data, mountPath: /var/lib/postgresql/data }]
  volumeClaimTemplates:
    - metadata: { name: data }
      spec:
        accessModes: [ReadWriteOncePod]
        storageClassName: ssd-retain
        resources: { requests: { storage: 100Gi } }` },
    { title: 'Scratch space for a Spring app', lang: 'yaml', code: `spec:
  containers:
    - name: app
      env:
        - name: JAVA_TOOL_OPTIONS
          value: >-
            -Djava.io.tmpdir=/scratch
            -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/scratch
      volumeMounts: [{ name: scratch, mountPath: /scratch }]
  volumes:
    - name: scratch
      ephemeral:                          # generic ephemeral volume (GA 1.23)
        volumeClaimTemplate:
          spec:
            accessModes: [ReadWriteOnce]
            storageClassName: gp3
            resources: { requests: { storage: 20Gi } }`, note: 'Heap dumps can be as large as the heap. A disk-backed volume avoids filling the node’s root disk (which triggers eviction) or, with a memory-backed emptyDir, the memory limit.' },
    { title: 'Diagnose storage', lang: 'bash', code: `kubectl get pvc,pv -A -o wide
kubectl describe pvc data-db-0          # events: provisioning, WaitForFirstConsumer
kubectl get volumeattachments           # which node holds which disk
kubectl get pv <pv> -o jsonpath='{.spec.nodeAffinity}'

# recover a Retained PV for a new claim
kubectl patch pv <pv> --type json -p '[{"op":"remove","path":"/spec/claimRef"}]'` }
  ]
});

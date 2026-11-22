IA.register({
  track: 'azure',
  slug: 'aks',
  title: 'AKS',
  tagline: 'AKS is Kubernetes where Microsoft runs the control plane and <b>you</b> run everything else: <b>node pools</b> (VM Scale Sets), the <b>network model</b> (choose Azure CNI Overlay for new clusters), <b>workload identity</b> (Kubernetes tokens federated to Entra) and a steady cadence of <b>upgrades</b> (surge, cordon, drain, PDBs).',
  tldr: {
    problem: 'Clusters that fall out of support, subnets that run out of IPs during an upgrade, pods that borrow the node’s identity, and drains that never finish because of a too-strict PodDisruptionBudget.',
    model: 'Control plane (managed) + node pools (system pool for add-ons, user pools for apps, optional spot or GPU pools). The network plugin decides where pod IPs come from. Workload identity turns a ServiceAccount token into an Entra token. Upgrades run control plane first, then each pool node by node with surge capacity.',
    hook: '“How does a pod in AKS get to Key Vault without a secret?” Workload identity: the projected SA token is signed by the cluster’s OIDC issuer, a federated credential on a user-assigned MI trusts that subject, and Entra exchanges it for an access token.',
    facts: [
      { v: 'N-2', l: 'Kubernetes minor versions are generally supported at a time (per Microsoft Learn), and upgrades can’t skip a minor version' },
      { v: '/24 per node', l: 'of pod IPs in Azure CNI Overlay, taken from a private CIDR, not from your VNet' },
      { v: 'spot taint', l: '<code>kubernetes.azure.com/scalesetpriority=spot:NoSchedule</code> is set on spot pools; pods need a toleration to land there' }
    ]
  },
  intro: {
    what: '<b>Kubernetes</b> runs containers across a group of machines and keeps them running: it restarts failed ones, spreads them out and scales them. <b>AKS</b> is Azure’s managed Kubernetes: Microsoft hosts the “brain” (the control plane) for you, and you choose the worker machines (<b>node pools</b>), how pods get network addresses, and when to upgrade. It is powerful and flexible, and it is also real operational work.',
    analogy: { icon: '🚢', title: 'A port with a harbour master', text: 'Microsoft provides the harbour master’s office (control plane). You own the docks (node pools): big cranes for heavy cargo (GPU), cheap temporary berths that can be reclaimed (spot). Every few months the docks are rebuilt one at a time (upgrades), and ships move to a spare dock while each one is closed.' },
    steps: [
      { t: 'Create a cluster with sane defaults', d: 'Overlay networking, OIDC issuer, workload identity, zones, Standard tier for production.', code: 'az aks create -g rg-plat -n aks-orders --tier standard --zones 1 2 3 \\\n  --network-plugin azure --network-plugin-mode overlay --network-dataplane cilium \\\n  --enable-oidc-issuer --enable-workload-identity --node-count 3' },
      { t: 'Add a user pool for apps', d: 'Keep the system pool for add-ons. Put apps on their own pool, with autoscaling.', code: 'az aks nodepool add -g rg-plat --cluster-name aks-orders -n apps --mode User \\\n  --zones 1 2 3 --enable-cluster-autoscaler --min-count 2 --max-count 10' },
      { t: 'Give pods an Entra identity', d: 'Use a federated credential on a user-assigned identity, plus an annotated ServiceAccount.' },
      { t: 'Plan upgrades', d: 'Set an auto-upgrade channel, maintenance windows, max surge and sensible PDBs.' }
    ],
    terms: [
      ['node pool', 'A group of identical nodes (a VM Scale Set). <b>System</b> pools host critical add-ons; <b>user</b> pools host apps.'],
      ['cluster autoscaler', 'Adds nodes when pods are Pending for lack of resources, and removes underused nodes.'],
      ['Azure CNI Overlay', 'A network mode where pods get IPs from a private overlay range, so they don’t consume VNet IPs.'],
      ['workload identity', 'A federation between the cluster’s OIDC issuer and Entra, giving each ServiceAccount an Azure identity.'],
      ['cordon / drain', 'Mark a node unschedulable, then evict its pods (respecting PDBs) so it can be upgraded.'],
      ['PodDisruptionBudget (PDB)', 'A rule such as “at most 1 orders-api pod unavailable” that voluntary evictions must respect.']
    ]
  },
  visual: {
    title: 'Node pools, scheduling and surge upgrades',
    caption: '<b>Node pools</b>: watch pods land on the user pool, the cluster autoscaler add a node, and a spot node get evicted. <b>Surge upgrade</b>: the control plane first, then a buffer node, cordon and drain through the PDB, and a stuck drain. Two more visuals below: networking models and workload identity.'
  },
  extras: [
    { id: 'aks-net', title: 'Where do pod IPs come from?', label: 'Networking', caption: 'Switch between kubenet, Azure CNI (flat) and Azure CNI Overlay and press Play: see pod IPs, cross-node routing, SNAT to outside, and subnet consumption.' },
    { id: 'aks-wi', title: 'Workload identity token exchange', label: 'Identity', caption: 'Press Play to follow a pod’s service-account token from the webhook to Entra’s federated-credential check to Key Vault.' }
  ],
  gotchas: [
    { trap: 'Letting the cluster drift out of support', why: 'Kubernetes minor versions leave AKS support on a rolling schedule, and you can’t skip minors. A cluster left for a year needs several sequential upgrades, and the charts on it often use removed APIs.', fix: 'Set an auto-upgrade channel (<code>stable</code> or <code>patch</code>) with planned maintenance windows, or own a quarterly upgrade runbook. Scan for deprecated APIs before each minor upgrade. Consider the Premium tier’s LTS versions if you truly can’t keep up.' },
    { trap: 'Flat Azure CNI subnet too small for surge', why: 'In flat CNI each node reserves 1 + maxPods VNet IPs. Upgrades add surge nodes, which need IPs too, so an upgrade or scale-out fails halfway with subnet-full errors.', fix: 'Use <b>CNI Overlay</b> for new clusters. If you need flat CNI, size the subnet for (max nodes + surge) × (maxPods + 1), or use dynamic pod-subnet allocation.' },
    { trap: 'PDB that allows zero disruptions', code: `apiVersion: policy/v1
kind: PodDisruptionBudget
spec:
  minAvailable: 3          # with replicas: 3 → no eviction is ever allowed
  selector: { matchLabels: { app: payments } }`, lang: 'yaml', why: 'Drain uses the Eviction API. If the PDB allows zero disruptions, the drain waits until it times out, and the node upgrade fails or stalls.', fix: 'Use <code>maxUnavailable: 1</code> (or a minAvailable below the replica count), run at least 2–3 replicas spread across nodes and zones, and alert on PDBs with <code>ALLOWED DISRUPTIONS 0</code>.' },
    { trap: 'Pods silently using the node’s identity', why: 'Without workload identity, a pod can call IMDS on its node and get a token for the kubelet or node-pool identity. Every pod on that node shares it, and it often has AcrPull or more.', fix: 'Use workload identity per ServiceAccount, grant the kubelet identity only what nodes need (AcrPull), and consider network policy that blocks pod egress to 169.254.169.254 where your setup allows it.' },
    { trap: 'Apps on the system pool, or pods without requests', why: 'App pods on the system pool can starve CoreDNS and metrics-server. Pods without CPU and memory requests confuse the scheduler and the cluster autoscaler, which only reasons about requests.', fix: 'Taint the system pool <code>CriticalAddonsOnly=true:NoSchedule</code>. Set requests (and memory limits) on every Deployment, and enforce that with Azure Policy for AKS (Gatekeeper) or a LimitRange.' },
    { trap: 'Spot pools for things that must stay up', why: 'Spot nodes can be evicted at any time when Azure needs the capacity, and in a busy region the spot pool may not scale back up for a while.', fix: 'Use spot only for interruptible, checkpointed batch work (embeddings, test runners). Keep a regular pool as fallback, with pod priorities or a second Deployment.' }
  ],
  scenarios: [
    { title: 'Node pool upgrade stuck for two hours',
      symptom: '<code>az aks nodepool upgrade</code> sits at one node, then fails with a drain/eviction error.',
      diagnose: `kubectl get pdb -A
# NAMESPACE  NAME      MIN AVAILABLE  ALLOWED DISRUPTIONS
# payments   payments  3              0
kubectl get events -A --field-selector reason=FailedEviction | tail`,
      cause: 'The <code>payments</code> PDB had <code>minAvailable: 3</code> with 3 replicas, so no eviction was allowed and the drain couldn’t finish.',
      fix: 'Change the PDB to <code>maxUnavailable: 1</code> and resume the upgrade. Add a CI check (or Gatekeeper policy) that rejects PDBs allowing zero disruptions.',
      fixCode: `kubectl -n payments patch pdb payments --type merge -p '{"spec":{"minAvailable":null,"maxUnavailable":1}}'
az aks nodepool upgrade -g rg-plat --cluster-name aks-orders -n apps -k 1.31` },
    { title: 'Scale-out fails: “subnet is full”',
      symptom: 'During a sale the cluster autoscaler can’t add nodes. Activity log: <code>SubnetIsFull</code>. Pods stay Pending.',
      diagnose: `az network vnet subnet show -g rg-net --vnet-name vnet-spoke -n snet-aks \\
  --query "{prefix:addressPrefix, used:length(ipConfigurations)}"
az aks show -g rg-plat -n aks-orders --query networkProfile.{plugin:networkPlugin, mode:networkPluginMode}`,
      cause: 'Flat Azure CNI on a /24. With maxPods 30, every node reserved 31 IPs, and the subnet held only about 8 nodes including surge.',
      fix: 'Short term: add a node pool on a new, larger subnet. Long term: migrate the cluster to CNI Overlay (an in-place update is supported from flat CNI or kubenet in many configurations; check Microsoft Learn), or rebuild with Overlay.',
      fixCode: `az aks update -g rg-plat -n aks-orders --network-plugin-mode overlay --pod-cidr 192.168.0.0/16` },
    { title: 'AADSTS70021 from the Azure SDK in a pod',
      symptom: 'After moving <code>orders-api</code> to namespace <code>orders-v2</code>, every Key Vault call fails: <code>AADSTS70021: No matching federated identity record found for presented assertion</code>.',
      diagnose: `az identity federated-credential list -g rg-identity --identity-name id-orders \\
  --query "[].{subject:subject, issuer:issuer}" -o table
# subject: system:serviceaccount:orders:orders-sa   ← old namespace`,
      cause: 'The federated credential trusts exactly one issuer + subject. The new namespace changed the subject to <code>system:serviceaccount:orders-v2:orders-sa</code>.',
      fix: 'Add a federated credential for the new subject (an identity can hold several), then remove the old one after cut-over.',
      fixCode: `az identity federated-credential create -g rg-identity --identity-name id-orders -n orders-v2 \\
  --issuer "$(az aks show -g rg-plat -n aks-orders --query oidcIssuerProfile.issuerUrl -o tsv)" \\
  --subject system:serviceaccount:orders-v2:orders-sa --audiences api://AzureADTokenExchange` }
  ],
  puzzles: [
    { kind: 'scenario', q: 'Your cluster runs 1.29. The target is 1.31. What does the upgrade path look like?', options: ['One upgrade straight to 1.31', '1.29 → 1.30 → 1.31, control plane then node pools each time', 'Node pools first, then the control plane', 'A new cluster is required'], answer: 1, explain: 'AKS doesn’t allow skipping minor versions. Each hop upgrades the control plane, then the node pools (which can’t be newer than the control plane).' },
    { kind: 'calc', q: 'Flat Azure CNI, maxPods 30. How many VNet IPs do 20 nodes reserve (ignoring surge and Azure’s 5 reserved addresses)?', options: ['20', '600', '620', '30'], answer: 2, explain: 'Each node reserves 1 IP for itself plus 30 for pods: 20 × 31 = <b>620</b>. Add surge nodes for upgrades, and a /24 is clearly too small.' },
    { kind: 'scenario', q: 'In Azure CNI Overlay, can a VM in a peered VNet open a TCP connection directly to a pod IP?', options: ['Yes, overlay IPs are routable everywhere', 'No: pod IPs aren’t routable outside the cluster; expose the pod through a Service, internal LB or ingress', 'Only with kubenet', 'Only over ExpressRoute'], answer: 1, explain: 'Overlay pod IPs are private to the cluster. Pod egress is SNATed to the node IP, and inbound must go through a Service or load balancer. Use flat CNI if pods must be directly addressable.' },
    { kind: 'scenario', q: 'A batch Job must run on the spot pool. What does its pod spec need?', options: ['Only a nodeSelector', 'A toleration for kubernetes.azure.com/scalesetpriority=spot:NoSchedule (plus a node affinity or selector for the spot pool)', 'A PriorityClass', 'hostNetwork: true'], answer: 1, explain: 'Spot pools carry that taint, so pods without a matching toleration are never scheduled there. The selector or affinity makes sure it actually goes there.' },
    { kind: 'scenario', q: 'With workload identity, what must match between the federated credential and the pod?', options: ['The pod name and node name', 'Issuer = cluster OIDC issuer URL, subject = system:serviceaccount:<namespace>:<sa>, and the audience', 'The image digest', 'The node pool’s managed identity'], answer: 1, explain: 'Entra validates the projected SA token’s issuer, subject and audience against the federated credential. Rename the namespace or ServiceAccount and the exchange fails with AADSTS70021.' },
    { kind: 'scenario', q: 'Pods are Pending with “Insufficient cpu”. Cluster autoscaler is enabled on the user pool (max 10, currently 10). What happens?', options: ['The autoscaler adds node 11', 'Nothing: the pool is at max. Raise max-count, add a pool, or lower requests', 'Pods are moved to the system pool automatically', 'HPA scales down'], answer: 1, explain: 'The autoscaler respects the pool’s max count (and your quota). Pending pods stay Pending until there is capacity.' },
    { kind: 'scenario', q: 'During a node pool upgrade with max-surge 1, what happens to the node being upgraded?', options: ['It is deleted immediately and its pods are lost', 'It is cordoned, drained through the Eviction API (respecting PDBs), then reimaged to the new version', 'Pods keep running on it during the reimage', 'It is skipped if it has pods'], answer: 1, explain: 'A buffer node on the new version is added, the old node is cordoned and drained, then reimaged and used as the next buffer. The last buffer is removed at the end.' }
  ],
  interview: [
    { q: 'What does Microsoft manage in AKS, and what do you manage?', a: '<p><b>Microsoft</b>: the control plane (API server, etcd, scheduler, controller manager), its availability (with an uptime SLA on the Standard and Premium tiers), node images and the add-on lifecycle. <b>You</b>: node pool sizing and scaling, upgrade timing, networking choices, ingress, policies, workloads, identity and observability.</p>', lvl: 'core' },
    { q: 'System vs user node pools?', a: '<p>System pools must exist and host critical add-ons (CoreDNS, metrics-server, konnectivity). Use a few nodes across zones and taint them for critical add-ons only. User pools host apps. They can scale to zero, use different SKUs (GPU, memory-optimised), OS (Windows) or spot pricing, and be upgraded separately.</p>', lvl: 'core' },
    { q: 'Compare kubenet, Azure CNI and Azure CNI Overlay.', a: '<ul><li><b>kubenet</b>: pods use a non-VNet CIDR, routed with UDRs, with size limits. Microsoft has announced its retirement.</li><li><b>Azure CNI (flat)</b>: pods get VNet IPs, are directly routable, and consume a lot of IPs.</li><li><b>Overlay</b>: pods get IPs from a private overlay CIDR, use few VNet IPs, scale well, and egress is SNATed to the node IP.</li></ul><p>Overlay is the recommended default for new clusters, often with the Cilium data plane.</p>', lvl: 'core' },
    { q: 'Walk through workload identity end to end.', a: '<ol><li>Enable the OIDC issuer and workload identity on the cluster.</li><li>Create a user-assigned MI and a federated credential with issuer = cluster issuer URL and subject = <code>system:serviceaccount:ns:sa</code>.</li><li>Annotate the ServiceAccount with the client ID, and label the pod.</li><li>The webhook injects <code>AZURE_CLIENT_ID</code>, <code>AZURE_TENANT_ID</code> and <code>AZURE_FEDERATED_TOKEN_FILE</code>.</li><li>The SDK exchanges the projected token with Entra for an access token.</li><li>The target checks RBAC for the MI.</li></ol>', lvl: 'deep' },
    { q: 'How do upgrades work, and how do you make them boring?', a: '<p>Control plane first, then node pools: add surge nodes, cordon and drain each old node (Eviction API with PDBs), reimage, repeat. To make them boring: auto-upgrade channels plus maintenance windows, max surge around 33% for production (per Microsoft Learn), PDBs that allow disruption, multiple replicas spread across zones, readiness probes, pre-checks for deprecated APIs, and a non-prod cluster on the <code>rapid</code> or <code>stable</code> channel ahead of prod.</p>', lvl: 'deep' },
    { q: 'Kubernetes version upgrades vs node image upgrades?', a: '<p>A <b>version</b> upgrade changes the Kubernetes minor or patch version (control plane and kubelet). A <b>node image</b> upgrade refreshes the OS image (security patches, container runtime) without changing the Kubernetes version. Run node image upgrades frequently (the node OS upgrade channel <code>NodeImage</code> or <code>SecurityPatch</code>) and version upgrades on a cadence.</p>', lvl: 'core' },
    { q: 'How do you expose HTTP services on AKS?', a: '<p>Options: the managed NGINX application-routing add-on, Application Gateway for Containers (or the older AGIC), or your own ingress controller or Gateway API implementation. Use an internal load balancer behind Front Door or App Gateway with Private Link for private clusters, and cert-manager or Key Vault for TLS.</p>', lvl: 'core' },
    { q: 'How do you run a Spring Boot service well on AKS?', a: '<ul><li>Requests and limits sized from load tests, with <code>-XX:MaxRAMPercentage</code>.</li><li>Startup, liveness and readiness probes on the actuator groups.</li><li>Graceful shutdown, with <code>terminationGracePeriodSeconds</code> above the shutdown phase plus a preStop sleep.</li><li>An HPA on CPU or custom metrics, PDBs, and topology spread across zones.</li><li>Workload identity for Azure SDKs, and passwordless Postgres.</li><li>OpenTelemetry or the App Insights agent.</li></ul>', lvl: 'deep' },
    { q: 'What do you secure on an AKS cluster?', a: '<ul><li>Entra ID integration with Kubernetes RBAC (or Azure RBAC for Kubernetes) and local accounts disabled.</li><li>A private API server or authorised IP ranges.</li><li>Workload identity, and network policy (Cilium or Azure NPM).</li><li>Azure Policy for AKS (Gatekeeper): no privileged pods, only allowed registries, requests required.</li><li>Defender for Containers, image scanning and signing, node image patching.</li><li>Egress control through Azure Firewall or a NAT gateway.</li></ul>', lvl: 'deep' },
    { q: 'When would you run AI workloads on AKS rather than Container Apps?', a: '<p>When you need GPU node pools with specific SKUs and drivers, the KAITO operator or vLLM with custom scheduling, many models sharing GPUs, Kubernetes-native ML tooling (Kubeflow, Ray), or tight control of networking and data locality. For an agent API that calls Azure OpenAI, Container Apps is usually enough.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Workload identity set-up (az)', lang: 'bash', code: `RG=rg-plat; CLUSTER=aks-orders; NS=orders; SA=orders-sa
az aks update -g $RG -n $CLUSTER --enable-oidc-issuer --enable-workload-identity
ISSUER=$(az aks show -g $RG -n $CLUSTER --query oidcIssuerProfile.issuerUrl -o tsv)

az identity create -g rg-identity -n id-orders
CLIENT_ID=$(az identity show -g rg-identity -n id-orders --query clientId -o tsv)

az identity federated-credential create -g rg-identity --identity-name id-orders -n aks-orders-$NS \\
  --issuer "$ISSUER" --subject system:serviceaccount:$NS:$SA --audiences api://AzureADTokenExchange

az role assignment create --assignee-object-id $(az identity show -g rg-identity -n id-orders --query principalId -o tsv) \\
  --assignee-principal-type ServicePrincipal --role "Key Vault Secrets User" --scope $KV_ID` },
    { title: 'ServiceAccount, Deployment, PDB', lang: 'yaml', code: `apiVersion: v1
kind: ServiceAccount
metadata:
  name: orders-sa
  namespace: orders
  annotations:
    azure.workload.identity/client-id: "<CLIENT_ID>"
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: orders-api, namespace: orders }
spec:
  replicas: 3
  selector: { matchLabels: { app: orders-api } }
  template:
    metadata:
      labels: { app: orders-api, azure.workload.identity/use: "true" }
    spec:
      serviceAccountName: orders-sa
      nodeSelector: { agentpool: apps }
      topologySpreadConstraints:
        - { maxSkew: 1, topologyKey: topology.kubernetes.io/zone, whenUnsatisfiable: ScheduleAnyway,
            labelSelector: { matchLabels: { app: orders-api } } }
      terminationGracePeriodSeconds: 45
      containers:
        - name: app
          image: acrorders.azurecr.io/orders:1.5
          env: [ { name: JAVA_TOOL_OPTIONS, value: "-XX:MaxRAMPercentage=75" } ]
          resources: { requests: { cpu: 500m, memory: 1Gi }, limits: { memory: 1Gi } }
          readinessProbe: { httpGet: { path: /actuator/health/readiness, port: 8080 } }
          livenessProbe:  { httpGet: { path: /actuator/health/liveness,  port: 8080 }, initialDelaySeconds: 30 }
          lifecycle: { preStop: { sleep: { seconds: 5 } } }   # K8s 1.30+ sleep action
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: orders-api, namespace: orders }
spec:
  maxUnavailable: 1
  selector: { matchLabels: { app: orders-api } }`, note: 'Java code needs no change: <code>new DefaultAzureCredentialBuilder().build()</code> picks up <code>WorkloadIdentityCredential</code> from the injected env vars.' },
    { title: 'Upgrade hygiene (az)', lang: 'bash', code: `az aks get-upgrades -g rg-plat -n aks-orders -o table

# channels: control-plane + node versions, and node OS images
az aks update -g rg-plat -n aks-orders --auto-upgrade-channel stable --node-os-upgrade-channel NodeImage

# maintenance window: Sundays 01:00 UTC, 4 hours
az aks maintenanceconfiguration add -g rg-plat --cluster-name aks-orders -n aksManagedAutoUpgradeSchedule \\
  --schedule-type Weekly --day-of-week Sunday --interval-weeks 1 --start-time 01:00 --duration 4 --utc-offset +00:00

# faster, safer pool upgrades
az aks nodepool update -g rg-plat --cluster-name aks-orders -n apps --max-surge 33%

# just refresh the node OS image
az aks nodepool upgrade -g rg-plat --cluster-name aks-orders -n apps --node-image-only` }
  ]
});

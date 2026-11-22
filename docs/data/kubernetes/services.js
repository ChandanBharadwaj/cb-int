IA.register({
  track: 'kubernetes',
  slug: 'services',
  title: 'Services',
  tagline: 'A Service is a <b>stable name and virtual IP</b> in front of a changing set of pods. Nothing listens on that IP. kube-proxy writes rules on every node that rewrite the packet to a real pod, chosen per <i>connection</i>, not per request.',
  tldr: {
    problem: 'Pods come and go and change IPs on every restart. Clients need one address that keeps working, only sends traffic to pods that are ready, and spreads the load.',
    model: 'Selector → <b>EndpointSlices</b> (the ready pod IPs) → kube-proxy on every node turns them into <b>DNAT rules</b> for the ClusterIP. NodePort and LoadBalancer are layers on top of the same rules: LB → node port → ClusterIP rules → pod.',
    hook: '“We scaled to 6 replicas but one pod still takes all the traffic.” Long-lived connections (HTTP/2, gRPC, keep-alive pools) were balanced once, when they were opened.',
    facts: [
      { v: '30000–32767', l: 'the default NodePort range (<code>--service-node-port-range</code> on the API server)' },
      { v: '100', l: 'endpoints per EndpointSlice by default; a Service with 250 ready pods gets 3 slices. EndpointSlices are GA since 1.21, and the old Endpoints API is deprecated since 1.33' },
      { v: '1/n', l: 'iptables mode picks an endpoint with chained <code>statistic --probability</code> rules: 1/3, then 1/2, then the last rule always matches' }
    ]
  },
  intro: {
    what: 'Your <code>orders</code> app runs as three pods. Each pod has its own IP, and that IP changes whenever the pod is replaced. A <b>Service</b> gives the group one fixed name (<code>orders</code>) and one fixed virtual IP. Other apps call the name. Kubernetes keeps a live list of which pods are healthy and quietly sends each new connection to one of them.',
    analogy: { icon: '☎️', title: 'A company switchboard number', text: 'Customers dial one number. The switchboard forwards each call to whichever agent is at a desk and available. Agents join, leave and change desks, but the public number never changes. Once a call is connected it stays with the same agent until someone hangs up, even if other agents become free.' },
    steps: [
      { t: 'Label your pods', d: 'The Deployment’s pod template carries labels such as <code>app: orders</code>. The Service finds pods by those labels, not by name.' },
      { t: 'Create the Service', d: 'It selects pods by label and maps a Service port to the container port.', code: 'apiVersion: v1\nkind: Service\nmetadata: { name: orders }\nspec:\n  selector: { app: orders }\n  ports:\n    - port: 80          # what clients call\n      targetPort: 8080  # what the container listens on' },
      { t: 'Kubernetes tracks the ready pods', d: 'A controller writes <b>EndpointSlices</b>: the IPs of matching pods, each marked ready or not. A pod whose readiness probe fails is marked not ready and stops getting new traffic.' },
      { t: 'Every node learns the route', d: '<b>kube-proxy</b> on each node watches Services and EndpointSlices and writes packet-rewriting rules (iptables, IPVS or nftables). A packet sent to the virtual IP is rewritten to a real pod IP.' },
      { t: 'Call it by name', d: 'From any pod: <code>http://orders</code> (same namespace) or <code>http://orders.shop.svc.cluster.local</code>. DNS gives back the virtual IP.', code: 'kubectl run tmp --rm -it --image=curlimages/curl -- curl -s http://orders.shop/actuator/health', lang: 'bash' }
    ],
    terms: [
      ['ClusterIP', 'The virtual IP of a Service, reachable only inside the cluster. It is the default type.'],
      ['selector', 'The label query that decides which pods belong to the Service.'],
      ['EndpointSlice', 'An object listing pod IPs and ports behind a Service, with ready / serving / terminating conditions.'],
      ['kube-proxy', 'A per-node agent that turns Services into packet-forwarding rules. Some CNIs (for example Cilium) can replace it with eBPF.'],
      ['port / targetPort', '<code>port</code> is what clients connect to; <code>targetPort</code> is the container’s port (a number or a named port).'],
      ['headless Service', '<code>clusterIP: None</code>: no virtual IP. DNS returns the pod IPs themselves.']
    ]
  },
  visual: {
    title: 'Follow a packet through the Service',
    caption: 'Pick a Service type, then press Play to send one connection. Click a pod to fail its readiness probe and watch the EndpointSlice and the kube-proxy rules change. For NodePort and LoadBalancer, flip <code>externalTrafficPolicy</code> and pick the node the traffic enters on.'
  },
  gotchas: [
    { trap: 'Load balancing is per connection, not per request', why: 'kube-proxy rewrites the first packet of a connection and conntrack pins the rest. HTTP/2 and gRPC multiplex every request over one long-lived connection, and JDBC or HTTP keep-alive pools open a few connections at start-up. New pods get nothing until connections are re-opened.', fix: 'For gRPC, use client-side balancing over a <b>headless</b> Service (<code>dns:///</code> with <code>round_robin</code>) or a mesh/L7 proxy. For HTTP pools, cap connection lifetime (for example <code>maxConnectionLifetime</code> / <code>max-life-time</code>) so connections spread again.' },
    { trap: 'Selector typo = empty Service, and “connection refused”', code: `kubectl get endpointslices -l kubernetes.io/service-name=orders\n# ENDPOINTS: <unset>   ← no pod matches the selector`, lang: 'bash', why: 'Services are linked to pods only by labels. A Service with no endpoints still has a ClusterIP. In iptables mode kube-proxy installs a REJECT rule for it, so clients get an immediate “connection refused” rather than a timeout.', fix: 'Compare <code>kubectl get svc orders -o jsonpath=\'{.spec.selector}\'</code> with <code>kubectl get pods --show-labels</code>. Check the EndpointSlice first in every “Service doesn’t work” incident.' },
    { trap: 'targetPort points at the wrong port', why: 'The Service accepts traffic on <code>port</code> and forwards it to <code>targetPort</code>. If Spring Boot listens on 8080 but <code>targetPort</code> says 80, the endpoints look healthy and every connection is refused by the pod.', fix: 'Name the container port (<code>name: http</code>) and use <code>targetPort: http</code>, so the Service follows the container spec.' },
    { trap: 'externalTrafficPolicy: Cluster hides the client IP', why: 'With the default <code>Cluster</code> policy a node may forward to a pod on another node, and it SNATs the packet to its own IP so the reply comes back the same way. Your access logs then show node IPs. <code>Local</code> keeps the client IP but only sends to pods on the receiving node, so load can be uneven and nodes without pods fail the LB health check.', fix: 'Use <code>Local</code> when you need the source IP (allow-lists, rate limiting) and spread pods across nodes. Or terminate at an L7 proxy and read <code>X-Forwarded-For</code>.' },
    { trap: 'You can’t ping a ClusterIP', why: 'In iptables mode the ClusterIP is not bound to any interface. Only the protocol and port in the Service spec are rewritten, so ICMP goes nowhere. (IPVS mode binds the IPs to a dummy interface, so ping may answer there, which proves nothing about the backends.)', fix: 'Test with the real protocol: <code>curl</code>, <code>nc -vz orders 80</code>, or <code>grpcurl</code>.' },
    { trap: 'A headless Service plus JVM DNS caching', why: 'With <code>clusterIP: None</code> DNS returns pod IPs. Java caches successful lookups (<code>networkaddress.cache.ttl</code>, 30 s by default on modern JDKs without a security manager), and many clients resolve only once at start-up, so they keep dialling IPs of pods that were replaced.', fix: 'Use a client that re-resolves (gRPC <code>dns:///</code> does), keep the JVM TTL short, and treat connection failure as a reason to resolve again.' }
  ],
  scenarios: [
    { title: 'Scaled from 2 to 8 pods; CPU on two pods still pinned at 100%',
      symptom: 'An HPA scaled <code>pricing</code> to 8 replicas during a sale. Six new pods sat idle while the two old ones ran hot and p99 latency kept climbing.',
      diagnose: `# which pods are actually receiving connections?\nkubectl exec deploy/checkout -- ss -tn dst :9090 | awk '{print $5}' | sort | uniq -c\n#   48 10.244.1.17:9090\n#   48 10.244.2.31:9090     ← only the two original pods`,
      diagnoseLang: 'bash',
      cause: 'The caller is a Spring Boot service using gRPC over a normal ClusterIP Service. Its channels opened HTTP/2 connections at start-up, and kube-proxy balanced only those connection set-ups. Every request since then has been multiplexed over the same connections.',
      fix: 'Switch to a headless Service and gRPC client-side <code>round_robin</code>. The resolver re-queries DNS and spreads RPCs over every pod. Also set <code>maxConnectionAge</code> on the server so clients reconnect from time to time.',
      fixCode: `apiVersion: v1\nkind: Service\nmetadata: { name: pricing-headless }\nspec:\n  clusterIP: None\n  selector: { app: pricing }\n  ports: [{ name: grpc, port: 9090, targetPort: grpc }]\n---\n# application.yaml (grpc-spring)\ngrpc.client.pricing:\n  address: dns:///pricing-headless.shop.svc.cluster.local:9090\n  default-load-balancing-policy: round_robin` },
    { title: 'Rate limiter blocks the whole internet after a LoadBalancer migration',
      symptom: 'After moving the API from an old VM proxy to a <code>type: LoadBalancer</code> Service, the per-IP rate limiter started throttling every user at once.',
      diagnose: `kubectl logs deploy/api | awk '{print $1}' | sort | uniq -c | sort -rn | head -3\n#  91234 10.0.3.12   ← node IPs, not clients\n#  90877 10.0.4.19`,
      diagnoseLang: 'bash',
      cause: 'With <code>externalTrafficPolicy: Cluster</code> the receiving node SNATs to its own IP before forwarding, so every request looked like it came from 3 addresses.',
      fix: 'Set <code>externalTrafficPolicy: Local</code> (the cloud LB then health-checks <code>healthCheckNodePort</code> and only sends to nodes with a ready pod), and spread the pods with topology spread constraints so the load stays even.',
      fixCode: `spec:\n  type: LoadBalancer\n  externalTrafficPolicy: Local   # keep client source IP\n  selector: { app: api }\n  ports: [{ port: 443, targetPort: https }]` },
    { title: '“Connection refused” right after a chart upgrade',
      symptom: 'A new chart version renamed the pod label from <code>app: orders</code> to <code>app.kubernetes.io/name: orders</code>. The pods were Running and Ready, but every caller got “connection refused”.',
      diagnose: `kubectl get endpointslices -l kubernetes.io/service-name=orders -o wide\n# ADDRESSTYPE  PORTS  ENDPOINTS\n# IPv4         <unset> <unset>`,
      diagnoseLang: 'bash',
      cause: 'The Service selector still said <code>app: orders</code>, so the EndpointSlice was empty and kube-proxy installed a REJECT rule. Traffic came back only when someone rolled the chart back.',
      fix: 'Keep selector labels stable forever. A Deployment’s selector is immutable anyway. Add a post-deploy smoke test that fails when a Service has zero ready endpoints.',
      fixCode: `kubectl wait --for=jsonpath='{.endpoints[0].conditions.ready}'=true \\\n  endpointslice -l kubernetes.io/service-name=orders --timeout=120s`,
      lang: 'bash' }
  ],
  puzzles: [
    { kind: 'predict', q: 'A Service has 3 ready endpoints in iptables mode. What probabilities do the three jump rules in its <code>KUBE-SVC-…</code> chain carry, in order?', options: ['0.333, 0.333, 0.333', '0.333, 0.5, (always)', '0.5, 0.25, 0.25', '1, 1, 1 with round-robin'], answer: 1, explain: 'iptables evaluates rules in order. Rule 1 matches 1/3 of packets. Of the 2/3 left, rule 2 matches 1/2 (another 1/3). The last rule has no probability and catches the rest. Each endpoint ends up with 1/3 of <b>new connections</b>.' },
    { kind: 'scenario', q: 'A Spring Boot service calls <code>inventory</code> (ClusterIP) over gRPC. <code>inventory</code> scales from 1 to 4 pods. What happens to the traffic?', options: ['It spreads evenly within seconds', 'It stays on the first pod until the caller’s connections are re-opened', 'kube-proxy moves existing connections to the new pods', 'Requests fail until the caller restarts'], answer: 1, explain: 'gRPC multiplexes RPCs over a long-lived HTTP/2 connection. kube-proxy only picks a backend when a connection is opened, and conntrack keeps it there. Use a headless Service with client-side balancing, or an L7 proxy.' },
    { kind: 'scenario', q: 'A NodePort Service has <code>externalTrafficPolicy: Local</code>. Its only ready pod runs on node-1. A client connects to <code>node-3:30080</code>. What happens?', options: ['Forwarded to node-1, client IP lost', 'Forwarded to node-1, client IP kept', 'node-3 has no local endpoint, so the packet is dropped', 'node-3 replies with an HTTP 503'], answer: 2, explain: 'With <code>Local</code> a node only uses endpoints on itself, so the client IP never needs SNAT. node-3 has none, and the traffic is dropped. For LoadBalancer Services the cloud LB avoids such nodes by health-checking <code>healthCheckNodePort</code>.' },
    { kind: 'predict', q: 'A headless Service selects 3 pods. One is failing its readiness probe. What does <code>nslookup orders-headless</code> return?', options: ['One ClusterIP', 'Three A records', 'Two A records', 'NXDOMAIN'], answer: 2, explain: 'Headless Services have no ClusterIP; DNS returns an A record per <b>ready</b> endpoint. Not-ready pods are left out unless <code>publishNotReadyAddresses: true</code> is set (StatefulSets use that for peer discovery).' },
    { kind: 'bug', q: 'The selector matches nothing because of a label typo. A client runs <code>curl http://orders</code> (iptables mode). What does it see?', options: ['DNS NXDOMAIN', 'A timeout after 30 s', 'An immediate “connection refused”', 'HTTP 404'], answer: 2, explain: 'The Service still exists, so DNS resolves to its ClusterIP. kube-proxy installs a REJECT rule for Services with no endpoints, so the client gets an immediate refusal. That is a strong hint to look at the EndpointSlice.' },
    { kind: 'predict', q: 'A Service has 250 ready pods. How many EndpointSlices does the controller create by default?', options: ['1', '2', '3', '250'], answer: 2, explain: 'The default is at most 100 endpoints per slice (<code>--max-endpoints-per-slice</code> on kube-controller-manager), so 250 endpoints need 3 slices. Slicing means a single pod change updates one small object, not one huge Endpoints object sent to every node.' },
    { kind: 'concept', q: 'Which statement about a <code>type: LoadBalancer</code> Service is true by default?', options: ['It replaces the ClusterIP', 'It also gets a NodePort and a ClusterIP', 'It routes on HTTP paths', 'It works without a cloud controller or LB implementation'], answer: 1, explain: 'Types stack: LoadBalancer → NodePort → ClusterIP. The cloud LB targets the node port (unless <code>allocateLoadBalancerNodePorts: false</code> and the LB routes straight to pod IPs). It is L4: no paths. That is Ingress or Gateway API. On bare metal you need something like MetalLB, or it stays <code>&lt;pending&gt;</code>.' }
  ],
  interview: [
    { q: 'What actually happens when a pod connects to a ClusterIP?', a: '<p>DNS returns the ClusterIP. The packet leaves the pod and hits netfilter on the node. In iptables mode, <code>KUBE-SERVICES</code> matches the IP and port and jumps to <code>KUBE-SVC-…</code>, which picks a <code>KUBE-SEP-…</code> endpoint chain at random. That chain DNATs to <code>podIP:targetPort</code>. conntrack records the translation, so later packets and the reply (un-DNAT) follow the same path. Nothing ever listens on the ClusterIP.</p>', fu: 'Where does the reply get its source address rewritten back? (conntrack, on the client’s node.)', lvl: 'core' },
    { q: 'ClusterIP vs NodePort vs LoadBalancer vs ExternalName vs headless?', a: '<ul><li><b>ClusterIP</b>: virtual IP inside the cluster (default).</li><li><b>NodePort</b>: also opens a port (30000–32767) on every node.</li><li><b>LoadBalancer</b>: also asks the cloud controller for an external L4 LB that targets the nodes (or pods directly).</li><li><b>ExternalName</b>: just a DNS CNAME, no proxying.</li><li><b>Headless</b> (<code>clusterIP: None</code>): no VIP. DNS returns pod IPs, and clients balance themselves.</li></ul>', lvl: 'core' },
    { q: 'iptables vs IPVS vs nftables mode in kube-proxy?', a: '<p><b>iptables</b> (the Linux default) builds sequential chains. Rule updates rewrite large tables, and matching cost grows with the number of Services. <b>IPVS</b> uses kernel hash tables and supports more algorithms (rr, lc, sh), so it scales better with many Services. <b>nftables</b> mode (alpha 1.29, beta 1.31, GA 1.33) uses sets/maps with incremental updates and is where upstream development is heading. eBPF data planes (for example Cilium) can replace kube-proxy entirely.</p>', fu: 'Why did large clusters see slow rule updates in iptables mode? (Every sync rewrote big rule sets; newer releases sync incrementally.)', lvl: 'deep' },
    { q: 'Why EndpointSlices instead of Endpoints?', a: '<p>One Endpoints object held every address for a Service. A single pod change on a 5,000-pod Service meant re-sending a huge object to every node. EndpointSlices (GA 1.21) shard endpoints (100 per slice by default), support dual-stack and topology hints, and carry per-endpoint <code>ready</code>, <code>serving</code> and <code>terminating</code> conditions. The v1 Endpoints API is deprecated since 1.33 (it still works, but new tooling should read slices).</p>', lvl: 'core' },
    { q: 'What do the ready, serving and terminating conditions mean?', a: '<p><code>ready</code> means serving and not terminating. <code>serving</code> reflects the readiness probe even while the pod is shutting down. <code>terminating</code> is set once the pod has a deletion timestamp. kube-proxy normally uses only ready endpoints. If <i>all</i> endpoints are terminating, it falls back to serving+terminating ones so connections keep working during a full roll-over (the ProxyTerminatingEndpoints behaviour, GA 1.28).</p>', lvl: 'deep' },
    { q: 'When do you choose externalTrafficPolicy: Local?', a: '<p>When you need the client source IP or want to avoid the extra node hop. The trade-offs: traffic only goes to nodes with a ready local pod (the LB health-checks <code>healthCheckNodePort</code>), and load is balanced per node, not per pod. A node with 1 pod and a node with 5 pods get the same share.</p>', lvl: 'core' },
    { q: 'How do StatefulSets use headless Services?', a: '<p>A StatefulSet’s <code>serviceName</code> names a headless Service, which gives each pod a stable DNS name: <code>pg-0.pg.db.svc.cluster.local</code>. Clients and peers can address a particular replica (the primary, a Kafka broker). Peer discovery often sets <code>publishNotReadyAddresses: true</code> so pods can find each other before they are ready.</p>', lvl: 'core' },
    { q: 'How would you route to pods in the same zone to save cross-zone cost?', a: '<p>Set <code>spec.trafficDistribution: PreferClose</code> (beta in 1.31, GA in 1.33). The EndpointSlice controller adds zone hints and kube-proxy prefers same-zone endpoints when they exist. The older mechanism was the <code>service.kubernetes.io/topology-mode: Auto</code> annotation. Also consider <code>internalTrafficPolicy: Local</code> for node-local agents (for example a log collector DaemonSet).</p>', fu: 'What breaks if one zone has far fewer pods? (Those pods take that zone’s whole load.)', lvl: 'deep' },
    { q: 'sessionAffinity: ClientIP: what does it do and what are the limits?', a: '<p>kube-proxy pins a client IP to one endpoint for <code>timeoutSeconds</code> (default 10800 = 3 h). It is L4 and keyed on source IP, so behind SNAT or a proxy many users share one “client”. It is not a substitute for proper session storage (Spring Session with Redis, or stateless JWTs).</p>', lvl: 'core' },
    { q: 'A Service “doesn’t work”. Walk through your debugging order.', a: '<ol><li>DNS: <code>nslookup orders.shop</code> from a pod.</li><li>EndpointSlice: does it list ready addresses? If not, check the selector against the pod labels, then readiness.</li><li>Ports: does <code>targetPort</code> match what the container listens on? Run <code>curl podIP:8080</code> directly.</li><li>NetworkPolicy blocking the source?</li><li>Node data plane: <code>iptables-save | grep orders</code> or <code>ipvsadm -Ln</code>, and kube-proxy logs.</li></ol>', lvl: 'core' }
  ],
  code: [
    { title: 'ClusterIP + headless', lang: 'yaml', code: `apiVersion: v1
kind: Service
metadata: { name: orders, namespace: shop }
spec:
  selector: { app.kubernetes.io/name: orders }
  ports:
    - name: http
      port: 80
      targetPort: http        # named container port
  trafficDistribution: PreferClose   # K8s 1.31+ (GA 1.33)
---
apiVersion: v1
kind: Service
metadata: { name: orders-headless, namespace: shop }
spec:
  clusterIP: None             # DNS returns pod IPs
  selector: { app.kubernetes.io/name: orders }
  ports: [{ name: grpc, port: 9090, targetPort: grpc }]`, note: 'One Deployment can sit behind both: the ClusterIP for HTTP callers, the headless one for gRPC clients that balance themselves.' },
    { title: 'Inspect the data plane', lang: 'bash', code: `# the endpoints kube-proxy will use
kubectl get endpointslices -n shop -l kubernetes.io/service-name=orders -o yaml \\
  | grep -E 'addresses|ready|serving|terminating|nodeName'

# iptables mode, on a node (or a privileged debug pod with hostNetwork)
iptables-save -t nat | grep -E 'KUBE-SVC|KUBE-SEP' | grep orders

# IPVS mode
ipvsadm -Ln -t 10.96.12.34:80

# live connections pinned by conntrack
conntrack -L -d 10.96.12.34 2>/dev/null | head` },
    { title: 'Java: cap connection lifetime', lang: 'java', code: `// Spring Boot 3.x + Apache HttpClient 5: make pooled connections
// expire so new pods behind a ClusterIP get a share of traffic.
@Bean
RestClient ordersClient(RestClient.Builder b) {
    var cm = PoolingHttpClientConnectionManagerBuilder.create()
        .setDefaultConnectionConfig(ConnectionConfig.custom()
            .setTimeToLive(TimeValue.ofMinutes(2))   // re-open every 2 min
            .build())
        .build();
    var http = HttpClients.custom().setConnectionManager(cm).build();
    return b.baseUrl("http://orders.shop")
            .requestFactory(new HttpComponentsClientHttpRequestFactory(http))
            .build();
}`, note: 'The same idea applies to HikariCP (<code>maxLifetime</code>) when the database sits behind a Service.' }
  ]
});

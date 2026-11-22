IA.register({
  track: 'kubernetes',
  slug: 'dns-network-policy',
  title: 'DNS & NetworkPolicy',
  tagline: 'Two things every pod depends on and nobody looks at until they break: <b>DNS</b>, where <code>ndots:5</code> turns one lookup into eight queries, and <b>NetworkPolicy</b>, where the cluster allows everything until the first policy selects a pod, and then only what you listed.',
  tldr: {
    problem: 'Intermittent <code>UnknownHostException</code>, 5-second latency spikes, CoreDNS at 100% CPU. Or a new “default deny” policy that silently breaks DNS, metrics scraping and the database at the same time.',
    model: 'DNS: the pod’s <code>/etc/resolv.conf</code> has three search domains and <code>ndots:5</code>, so any name with fewer than 5 dots is tried <i>with each suffix first</i>. NetworkPolicy: pods start <b>non-isolated</b>. Once any policy selects a pod for a direction, only the <b>union</b> of allow rules applies. There are no deny rules and no ordering, and the CNI plugin enforces it (or doesn’t).',
    hook: '“We added default-deny-egress and every service started failing with UnknownHostException.” You blocked port 53 to CoreDNS.',
    facts: [
      { v: 'ndots:5', l: 'the kubelet default for <code>dnsPolicy: ClusterFirst</code> pods. <code>api.stripe.com</code> has 2 dots, so the search domains are tried first' },
      { v: '8', l: 'DNS queries for one external name with 3 search domains: (3 suffixes + the absolute name) × (A + AAAA)' },
      { v: '0', l: 'NetworkPolicy deny rules in the core API. Policies only add allowed traffic; once a pod is isolated, everything not allowed is dropped' }
    ]
  },
  intro: {
    what: 'Pods find each other by name. <b>CoreDNS</b> runs in the cluster and answers names like <code>orders.shop.svc.cluster.local</code> with a Service IP. A short name like <code>orders</code> works because the pod’s resolver appends search domains for you. <b>NetworkPolicy</b> is the cluster’s firewall: rules that say which pods may talk to which, on which ports. With no policies, everything can talk to everything. The <b>CNI plugin</b> is the component that wires pods into the network and enforces these rules.',
    analogy: { icon: '🏢', title: 'An office phone directory and door badges', text: 'Dialling “Sam” makes the switchboard try “Sam in your team”, then “Sam in your department”, then “Sam in the company”, and only then the outside world. That is the search list. NetworkPolicy is the badge system: all doors are open until a door gets a badge reader, and then only listed badges open it. The CNI plugin is the building manager who installs the readers. Some managers don’t, and then the rules are just paper.' },
    steps: [
      { t: 'Look at a pod’s resolver config', d: 'The kubelet writes it when the pod starts.', code: 'kubectl exec deploy/orders -- cat /etc/resolv.conf\n# search shop.svc.cluster.local svc.cluster.local cluster.local\n# nameserver 10.96.0.10\n# options ndots:5', lang: 'bash' },
      { t: 'Short names use the search list', d: '<code>orders</code> becomes <code>orders.shop.svc.cluster.local</code> (same namespace). <code>orders.payments</code> becomes <code>orders.payments.svc.cluster.local</code> (Service <code>orders</code> in namespace <code>payments</code>).' },
      { t: 'External names pay for it', d: 'A name with fewer dots than <code>ndots</code> tries every search suffix first and gets NXDOMAIN each time. A trailing dot (<code>api.stripe.com.</code>) or a lower <code>ndots</code> avoids that.' },
      { t: 'Add a default-deny policy', d: 'Selecting all pods with no allow rules isolates them for ingress.', code: 'apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata: { name: default-deny-ingress, namespace: shop }\nspec:\n  podSelector: {}\n  policyTypes: [Ingress]' },
      { t: 'Then allow what you need', d: 'Each extra policy adds allowed sources or destinations. The result is the union of all policies selecting the pod.' }
    ],
    terms: [
      ['CoreDNS', 'The cluster DNS server (Service <code>kube-dns</code> in <code>kube-system</code>). It serves <code>cluster.local</code> and forwards the rest upstream.'],
      ['search domains', 'Suffixes the resolver appends to short names, in order.'],
      ['ndots', 'If a name has at least this many dots, try it as-is first; otherwise try the search list first.'],
      ['NXDOMAIN', 'The DNS answer “this name does not exist”.'],
      ['isolated pod', 'A pod selected by at least one NetworkPolicy for a direction (ingress or egress). Only allowed traffic gets through in that direction.'],
      ['CNI plugin', 'Container Network Interface plugin (Calico, Cilium, the cloud VPC CNIs…): gives pods IPs and routes, and enforces NetworkPolicy if it supports it.']
    ]
  },
  visual: {
    title: 'Watch one lookup expand through the search list',
    caption: 'Pick a name and an <code>ndots</code> value, then press Play. Each query goes to CoreDNS. Names inside <code>cluster.local</code> are answered locally; anything else is forwarded upstream. The counter shows what one <code>InetAddress.getByName()</code> really costs.'
  },
  extras: [
    { id: 'dns-network-policy-netpol', title: 'NetworkPolicy: which connections survive?', label: 'Policies', caption: 'Turn policies on and off, pick a connection, and press Play. The packet is checked twice: <b>egress</b> on the sender’s side, then <b>ingress</b> on the receiver’s. Switch the CNI to one without policy support and see every rule ignored.' }
  ],
  gotchas: [
    { trap: 'ndots:5 multiplies external lookups', code: `# one getaddrinfo("api.stripe.com") from a pod, glibc, ndots:5\napi.stripe.com.shop.svc.cluster.local  A/AAAA → NXDOMAIN\napi.stripe.com.svc.cluster.local       A/AAAA → NXDOMAIN\napi.stripe.com.cluster.local           A/AAAA → NXDOMAIN\napi.stripe.com                         A/AAAA → answer`, lang: 'text', why: 'The name has 2 dots, fewer than 5, so the resolver walks the search list first. Cloud nodes often add their own search domains (for example <code>ec2.internal</code>), and those NXDOMAINs go upstream, which is slower.', fix: 'Use FQDNs with a trailing dot in config (<code>api.stripe.com.</code>), or set <code>dnsConfig.options: [{name: ndots, value: "2"}]</code> for pods that mostly call external hosts. Run NodeLocal DNSCache on busy clusters.' },
    { trap: 'Default-deny egress also blocks DNS', why: 'Once a pod is isolated for egress, UDP and TCP 53 to CoreDNS is just another destination. Every name lookup times out, and Java reports <code>UnknownHostException</code> even for the database you explicitly allowed.', fix: 'Ship a DNS allow rule with every egress default-deny: to <code>namespaceSelector: {kubernetes.io/metadata.name: kube-system}</code> + <code>podSelector: {k8s-app: kube-dns}</code>, on UDP <b>and</b> TCP 53 (large answers fall back to TCP).' },
    { trap: 'One list item vs two: AND vs OR', code: `from:\n  - namespaceSelector: { matchLabels: { team: web } }\n    podSelector: { matchLabels: { app: frontend } }   # AND: frontend pods in team=web namespaces\nfrom:\n  - namespaceSelector: { matchLabels: { team: web } }\n  - podSelector: { matchLabels: { app: frontend } }   # OR: every pod in team=web, or frontend in THIS namespace`, why: 'Inside one <code>from</code> element the selectors are ANDed. Separate elements are ORed. A single <code>-</code> character turns a tight rule into a wide-open one.', fix: 'Read policies with <code>kubectl describe networkpolicy</code>, which spells out the logic, and test with real connections, for example a throwaway pod running <code>nc -vz</code>.' },
    { trap: 'Your CNI may not enforce NetworkPolicy at all', why: 'NetworkPolicy is just an API object. Plain flannel, for example, does not implement it: the policy is accepted, shows up in <code>kubectl get</code>, and does nothing.', fix: 'Use a CNI that enforces policy (Calico, Cilium, Antrea, or a cloud CNI with its policy add-on enabled), and keep a CI test that expects a connection to be <i>refused</i>.' },
    { trap: 'Policies are not ordered and cannot deny', why: 'Allow rules from every policy that selects a pod are unioned. A “deny monitoring” policy can’t override another policy’s “allow all from namespace X”. Developers used to firewall rule order get this wrong.', fix: 'Design per pod: what must reach it, and what may it reach. Cluster-wide guardrails with deny and priority need CNI-specific CRDs (Calico, Cilium) or the alpha <code>AdminNetworkPolicy</code> API from SIG Network.' },
    { trap: 'JVM DNS caching vs a changing cluster', why: 'The JDK caches successful lookups for 30 s by default (<code>networkaddress.cache.ttl</code>, when no security manager is installed) and failures for 10 s (<code>networkaddress.cache.negative.ttl</code>). A short CoreDNS outage can stick for 10 s per name. Clients that resolve only once (some JDBC and Kafka set-ups) never see new IPs at all.', fix: 'Leave the TTLs short. Prefer Service names (stable ClusterIPs) over headless names for things you connect to once. Set <code>-Dnetworkaddress.cache.ttl=…</code> in <code>JAVA_TOOL_OPTIONS</code> or in <code>java.security</code>, deliberately.' }
  ],
  scenarios: [
    { title: 'CoreDNS at 100% CPU and random 5-second stalls',
      symptom: 'p99 latency of calls to an external payment API jumps by exactly ~5 s a few times a minute. CoreDNS pods are CPU-throttled.',
      diagnose: `# what is CoreDNS answering?\nkubectl -n kube-system logs deploy/coredns | awk '{print $4, $6}' | sort | uniq -c | sort -rn | head\n#  91022 "AAAA IN api.stripe.com.shop.svc.cluster.local." NXDOMAIN\n#  90877 "A IN api.stripe.com.shop.svc.cluster.local."    NXDOMAIN\n#  ...   (needs the 'log' plugin enabled in the Corefile)`,
      diagnoseLang: 'bash',
      cause: 'Every lookup from <code>ndots:5</code> pods made 8 queries, 6 of them NXDOMAIN, so CoreDNS was overloaded. The 5-second stalls are the resolver’s default timeout. A widely reported cause is a Linux conntrack race when glibc sends A and AAAA queries in parallel over UDP from the same socket, which drops one of them.',
      fix: 'Lower <code>ndots</code> for that Deployment, use a trailing-dot FQDN for the external host, scale CoreDNS, and deploy <b>NodeLocal DNSCache</b> so pods query a node-local cache (which avoids conntrack for those queries).',
      fixCode: `spec:\n  template:\n    spec:\n      dnsConfig:\n        options:\n          - { name: ndots, value: "2" }\n          - { name: single-request-reopen }   # glibc: separate sockets for A/AAAA` },
    { title: 'Security rolled out default-deny; three teams paged at once',
      symptom: 'Right after a namespace-wide <code>default-deny</code> (ingress + egress), orders pods crash-looped with <code>UnknownHostException: postgres</code>, Prometheus targets went DOWN, and readiness probes kept passing.',
      diagnose: `kubectl -n shop get networkpolicy\n# default-deny        <none>   policyTypes: Ingress,Egress\n# allow-orders-to-db  app=orders   (egress to app=postgres:5432)\nkubectl -n shop exec deploy/orders -- getent hosts postgres   # hangs: DNS blocked`,
      diagnoseLang: 'bash',
      cause: 'Egress isolation also cut DNS, so the egress rule to Postgres could never be used: its name couldn’t be resolved. Prometheus in <code>monitoring</code> was blocked on ingress. Probes kept working because the kubelet connects from the pod’s own node, and traffic from the node is always allowed.',
      fix: 'Roll out default-deny together with baseline allows: DNS egress, monitoring ingress on the metrics port, and the known app paths. Stage it per namespace, and watch dropped-flow logs (Cilium Hubble, Calico flow logs) first.',
      fixCode: `apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata: { name: allow-dns, namespace: shop }\nspec:\n  podSelector: {}\n  policyTypes: [Egress]\n  egress:\n    - to:\n        - namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: kube-system } }\n          podSelector: { matchLabels: { k8s-app: kube-dns } }\n      ports:\n        - { protocol: UDP, port: 53 }\n        - { protocol: TCP, port: 53 }` },
    { title: 'Spring service still talks to the old database IP after failover',
      symptom: 'A managed Postgres failed over and its DNS name now points at a new IP. Most pods recovered within a minute, but one batch service kept failing for hours until it was restarted.',
      diagnose: `kubectl exec deploy/batch -- sh -c 'echo $JAVA_TOOL_OPTIONS'\n# -Dsun.net.inetaddr.ttl=-1     ← cache DNS forever\n# (copied from an old "fix DNS flakiness" wiki page)`,
      diagnoseLang: 'bash',
      cause: 'Positive DNS caching was set to “forever”, so new HikariCP connections kept resolving to the old primary.',
      fix: 'Remove the override (the JDK default is 30 s without a security manager), set HikariCP <code>maxLifetime</code> below the failover window, and make the failover runbook include “verify clients re-resolve”.',
      fixCode: `# JAVA_TOOL_OPTIONS\n-Dnetworkaddress.cache.ttl=30 -Dnetworkaddress.cache.negative.ttl=5\n\n# application.yaml\nspring.datasource.hikari.max-lifetime: 600000   # 10 min` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Pod in namespace <code>shop</code>, default resolv.conf (3 search domains, <code>ndots:5</code>), glibc asks for A and AAAA. How many DNS queries does resolving <code>api.stripe.com</code> send?', options: ['2', '4', '6', '8'], answer: 3, explain: '2 dots &lt; 5, so the three search suffixes come first (3 × 2 queries, all NXDOMAIN), then the absolute name (2 more): <b>8</b>. A node-level search domain such as <code>ec2.internal</code> would add 2 more.' },
    { kind: 'predict', q: 'Same pod, but the code uses <code>api.stripe.com.</code> (trailing dot). How many queries?', options: ['2', '4', '6', '8'], answer: 0, explain: 'A trailing dot marks the name as fully qualified, so the search list is skipped: one A and one AAAA query. (Some HTTP clients and TLS SNI dislike the trailing dot, so test it.)' },
    { kind: 'predict', q: 'With <code>ndots:2</code>, resolving <code>orders.payments</code> (Service <code>orders</code> in namespace <code>payments</code>). Which name is answered first?', options: ['orders.payments (absolute)', 'orders.payments.shop.svc.cluster.local', 'orders.payments.svc.cluster.local', 'orders.payments.cluster.local'], answer: 2, explain: 'It has 1 dot, fewer than 2, so the search list comes first. <code>…shop.svc.cluster.local</code> is NXDOMAIN (no namespace “payments” under shop). The second suffix gives <code>orders.payments.svc.cluster.local</code>, which exists: 4 queries in total. With <code>ndots:1</code> the absolute name <code>orders.payments</code> would be tried first and sent upstream to fail, which is why 2 is a common floor.' },
    { kind: 'scenario', q: 'Namespace <code>shop</code> has two policies selecting <code>app=orders</code>: <code>default-deny-ingress</code> (no rules) and <code>allow-frontend</code> (from <code>app=frontend</code> on 8080). Can the frontend connect to orders:8080?', options: ['No, deny wins', 'Yes, the policies are unioned', 'Only if allow-frontend was created later', 'Only if it has a higher priority'], answer: 1, explain: 'There is no deny and no order in NetworkPolicy. The pod is isolated (selected by at least one policy), and the allowed set is the union of all rules: frontend on 8080.' },
    { kind: 'bug', q: 'Which <code>from</code> allows <i>only</i> pods labelled <code>app=prometheus</code> in the namespace <code>monitoring</code>?', code: `# A\nfrom:\n  - namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: monitoring } }\n    podSelector: { matchLabels: { app: prometheus } }\n# B\nfrom:\n  - namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: monitoring } }\n  - podSelector: { matchLabels: { app: prometheus } }`, options: ['A', 'B', 'Both', 'Neither: namespaces can’t be selected by name'], answer: 0, explain: 'A is one element with two selectors, which are ANDed. B is two elements, ORed: every pod in <code>monitoring</code>, <i>or</i> prometheus pods in the policy’s own namespace. The <code>kubernetes.io/metadata.name</code> label is set on every namespace automatically (GA since 1.22).' },
    { kind: 'scenario', q: 'A namespace has a default-deny ingress policy. Will the kubelet’s HTTP readiness probe still reach the pod?', options: ['No, probes are blocked and the pod goes unready', 'Yes, traffic from the pod’s own node is always allowed', 'Only if the probe uses exec', 'Only on hostNetwork pods'], answer: 1, explain: 'The NetworkPolicy spec says an isolated pod still accepts connections from its own node. Probes come from the kubelet on that node, so they keep working. That also means a passing probe proves nothing about whether other pods can reach it.' },
    { kind: 'scenario', q: 'A cluster uses plain flannel. You apply a default-deny policy in <code>shop</code>. What happens to traffic?', options: ['All ingress to shop is dropped', 'Nothing changes: flannel doesn’t enforce NetworkPolicy', 'The API server rejects the policy', 'Pods restart to pick up the policy'], answer: 1, explain: 'The API server stores it happily, but enforcement is the CNI’s job, and plain flannel doesn’t do it. Pair flannel with Calico (“Canal”) or use a policy-capable CNI.' },
    { kind: 'concept', q: 'A Java app calls <code>InetAddress.getByName("orders")</code> in a loop, and CoreDNS goes down for 3 seconds. On a modern JDK with no security manager and default settings, what happens?', options: ['Every call fails while CoreDNS is down', 'Calls keep succeeding from cache for up to 30 s after the last successful lookup', 'The JVM caches forever', 'Java bypasses resolv.conf'], answer: 1, explain: 'Successful lookups are cached for 30 s by default (<code>networkaddress.cache.ttl</code>, implementation default). Failures are cached for 10 s, so if the cache expired during the outage, that name fails for up to 10 s even after CoreDNS is back.' }
  ],
  interview: [
    { q: 'Walk through how a pod resolves <code>orders</code>.', a: '<p>glibc reads <code>/etc/resolv.conf</code>: search <code>shop.svc.cluster.local svc.cluster.local cluster.local</code>, nameserver = the kube-dns ClusterIP, <code>ndots:5</code>. <code>orders</code> has 0 dots, so it tries <code>orders.shop.svc.cluster.local</code> first. CoreDNS’s <code>kubernetes</code> plugin answers from its watch of Services: the ClusterIP for a normal Service, or the pod IPs for a headless one. The JVM then caches the result.</p>', lvl: 'core' },
    { q: 'Why ndots:5, and what would you change?', a: '<p>So that names like <code>svc.ns.svc</code> and even <code>pod-0.svc.ns.svc.cluster</code> resolve through the search path. The cost is that external names with fewer than 5 dots try every suffix first. Options: trailing-dot FQDNs, <code>dnsConfig</code> with <code>ndots: 2</code> on chatty pods, the CoreDNS <code>autopath</code> plugin (answers the search list server-side, but needs <code>pods verified</code>, which costs memory), and NodeLocal DNSCache.</p>', fu: 'What does NodeLocal DNSCache change? (Pods query a cache on their own node over a link-local IP; misses go to CoreDNS over TCP; it avoids conntrack races and cross-node hops.)', lvl: 'deep' },
    { q: 'Explain dnsPolicy values.', a: '<ul><li><b>ClusterFirst</b> (default): cluster DNS, search domains, ndots:5.</li><li><b>Default</b>: inherit the node’s resolv.conf (no cluster names!).</li><li><b>ClusterFirstWithHostNet</b>: needed for <code>hostNetwork: true</code> pods that still want cluster DNS.</li><li><b>None</b>: you supply everything in <code>dnsConfig</code>.</li></ul>', lvl: 'core' },
    { q: 'What is the default network behaviour, and what does “isolated” mean?', a: '<p>By default every pod can reach every pod, in every namespace, with no NAT. That is the Kubernetes network model. A pod becomes isolated for <b>ingress</b> when any policy with <code>Ingress</code> in <code>policyTypes</code> selects it, and likewise for <b>egress</b>. The directions are independent. Once isolated, only connections allowed by some policy (plus, for ingress, from the pod’s own node) are permitted. Replies to allowed connections are always allowed.</p>', lvl: 'core' },
    { q: 'Write a policy: only the frontend may call orders on 8080, and Prometheus may scrape 8081.', a: '<p>One policy selecting <code>app: orders</code>, <code>policyTypes: [Ingress]</code>, with two rules: <code>from podSelector app=frontend, ports 8080</code>, and <code>from namespaceSelector name=monitoring AND podSelector app=prometheus, ports 8081</code>. Add a namespace-wide default-deny-ingress so new pods start closed. With Spring Boot, put Actuator on its own <code>management.server.port</code> so you can open it separately.</p>', lvl: 'core' },
    { q: 'What can’t standard NetworkPolicy do?', a: '<ul><li>Explicit deny or priorities (look at AdminNetworkPolicy or CNI CRDs).</li><li>L7 rules (HTTP paths, methods) or FQDN egress such as “allow api.stripe.com”. Cilium and Calico add these.</li><li>Logging of dropped flows.</li><li>Policy on <code>hostNetwork</code> pods (implementation-defined).</li><li>Matching by Service rather than pod labels.</li></ul><p><code>ipBlock</code> covers external CIDRs, but after SNAT/DNAT the visible addresses are implementation-specific.</p>', lvl: 'deep' },
    { q: 'What exactly does the CNI plugin do?', a: '<p>When the kubelet creates a pod sandbox, the container runtime (containerd, CRI-O) calls the CNI plugin binary (config in <code>/etc/cni/net.d</code>) with <code>ADD</code>. The plugin creates the pod’s network namespace interface (a veth pair), assigns an IP through IPAM, and sets up routes: overlay (VXLAN/Geneve), routed (BGP), or cloud VPC IPs (for example AWS VPC CNI). On delete it runs <code>DEL</code>. Its agent usually also enforces NetworkPolicy (iptables/nftables or eBPF), and some, like Cilium, replace kube-proxy as well.</p>', fu: 'What do you see when the CNI is broken? (Node NotReady with “network plugin not ready”, pods stuck in ContainerCreating with “failed to setup network for sandbox”.)', lvl: 'deep' },
    { q: 'How do you debug “service A can’t reach service B”, with policies in play?', a: '<ol><li>DNS works? <code>getent hosts b</code>.</li><li>Endpoints exist? Check the EndpointSlice.</li><li>Pod-IP direct connect: <code>nc -vz &lt;podIP&gt; 8080</code> from an ephemeral debug container in A.</li><li>List policies selecting <b>both</b> pods: egress on A and ingress on B.</li><li>Check the CNI’s flow logs (Hubble, Calico).</li></ol>', lvl: 'core' },
    { q: 'Java-specific DNS behaviour you’d mention in an interview?', a: '<ul><li><code>networkaddress.cache.ttl</code> defaults to 30 s and <code>negative.ttl</code> to 10 s (with a security manager the positive cache is forever).</li><li>Java uses the OS resolver, so ndots applies.</li><li>Connection pools (HikariCP, HTTP clients) keep resolved sockets: changing DNS does nothing until connections recycle.</li><li>gRPC-java’s <code>dns:///</code> resolver re-resolves on connection failure and periodically.</li></ul>', lvl: 'deep' },
    { q: 'How does CoreDNS decide whether to forward a query?', a: '<p>The default Corefile has the <code>kubernetes cluster.local in-addr.arpa ip6.arpa</code> plugin, which answers authoritatively for the cluster zone, including NXDOMAIN for <code>api.stripe.com.shop.svc.cluster.local</code>. So those misses are cheap. Everything else goes through <code>forward . /etc/resolv.conf</code> (the node’s upstream) with a <code>cache 30</code>. Node-added search domains (<code>ec2.internal</code>) therefore cost a real upstream round-trip per miss.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Baseline policies', lang: 'yaml', code: `# 1) start closed
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny, namespace: shop }
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
---
# 2) everyone may resolve names
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: allow-dns, namespace: shop }
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
    - to:
        - namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: kube-system } }
          podSelector: { matchLabels: { k8s-app: kube-dns } }
      ports: [{ protocol: UDP, port: 53 }, { protocol: TCP, port: 53 }]
---
# 3) app paths: frontend -> orders:8080, prometheus -> orders:8081
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: orders-ingress, namespace: shop }
spec:
  podSelector: { matchLabels: { app: orders } }
  policyTypes: [Ingress]
  ingress:
    - from: [{ podSelector: { matchLabels: { app: frontend } } }]
      ports: [{ port: 8080 }]
    - from:
        - namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: monitoring } }
          podSelector: { matchLabels: { app: prometheus } }
      ports: [{ port: 8081 }]
---
# 4) orders may reach postgres
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: orders-egress, namespace: shop }
spec:
  podSelector: { matchLabels: { app: orders } }
  policyTypes: [Egress]
  egress:
    - to: [{ podSelector: { matchLabels: { app: postgres } } }]
      ports: [{ port: 5432 }]`, note: 'Postgres also needs an ingress policy allowing <code>app: orders</code> on 5432, because default-deny isolates it too.' },
    { title: 'DNS tuning per pod', lang: 'yaml', code: `spec:
  dnsPolicy: ClusterFirst
  dnsConfig:
    options:
      - { name: ndots, value: "2" }
  containers:
    - name: app
      env:
        - name: JAVA_TOOL_OPTIONS
          value: >-
            -Dnetworkaddress.cache.ttl=30
            -Dnetworkaddress.cache.negative.ttl=5` },
    { title: 'Debug DNS and policy from inside', lang: 'bash', code: `# ephemeral debug container sharing the pod's network namespace
kubectl debug -it deploy/orders --image=nicolaka/netshoot --target=app -- bash

dig +search +showsearch api.stripe.com      # watch the search-list walk
dig api.stripe.com. +short                   # FQDN: one query
nc -vz -w 2 postgres 5432                    # does policy allow it?

# which policies select a pod?
kubectl get networkpolicy -n shop -o wide
kubectl describe networkpolicy orders-ingress -n shop` }
  ]
});

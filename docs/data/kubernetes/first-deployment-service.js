IA.register({
  track: 'kubernetes',
  slug: 'first-deployment-service',
  title: 'First Deployment & Service',
  tagline: 'Deploy a Spring Boot app in two objects: a <b>Deployment</b> keeps N copies running; a <b>Service</b> gives them one stable name. Then scale it, kill a pod, and reach it from your laptop with <code>port-forward</code>.',
  tldr: {
    problem: 'Pods are disposable: they die, get rescheduled and come back with new names and IPs. You can neither run them by hand nor point clients at them directly.',
    model: '<b>Deployment</b> → owns a <b>ReplicaSet</b> → keeps <code>replicas</code> <b>Pods</b> alive. <b>Service</b> → label selector → a stable virtual IP and DNS name in front of whichever pods match right now.',
    hook: '“Why not just create a Pod?” A bare Pod isn’t replaced if it or its node dies. A Deployment adds self-healing, scaling and rolling updates; a Service adds stable addressing.',
    facts: [
      { v: '3 objects', l: 'one Deployment apply creates a Deployment, a ReplicaSet and the Pods' },
      { v: 'ClusterIP', l: 'the default Service type: reachable only inside the cluster, by DNS name <code>orders</code> (same namespace) or <code>orders.&lt;ns&gt;.svc.cluster.local</code>' },
      { v: '1 pod', l: '<code>kubectl port-forward svc/orders</code> tunnels to a single pod; it is a dev tool, not load balancing' }
    ]
  },
  intro: {
    what: 'You have an image <code>orders:1.0</code>. To run it on Kubernetes you write a <b>Deployment</b> (“keep 2 copies of this container running”) and a <b>Service</b> (“give those copies one address”). Kubernetes does the rest: it starts pods, restarts them when they die and spreads requests across them.',
    analogy: { icon: '📞', title: 'A support hotline', text: 'Customers call one number. Behind it, a manager (the Deployment) makes sure enough agents (pods) are on shift and replaces anyone who leaves. The hotline number (the Service) never changes, however many agents come and go.' },
    steps: [
      { t: 'Get the image into the cluster', d: 'Push it, or load it into a local cluster.', code: 'kind load docker-image orders:1.0 --name dev', lang: 'bash' },
      { t: 'Apply a Deployment', d: 'See the full file in the code tabs below.', code: 'kubectl apply -f deployment.yaml\nkubectl get deploy,rs,pods -l app=orders', lang: 'bash' },
      { t: 'Scale it', d: 'Change the desired count.', code: 'kubectl scale deploy/orders --replicas=3\nkubectl get pods -l app=orders -w', lang: 'bash' },
      { t: 'Expose it with a Service', d: 'Stable name for the changing pods.', code: 'kubectl apply -f service.yaml\nkubectl get svc orders\nkubectl get endpointslices -l kubernetes.io/service-name=orders', lang: 'bash' },
      { t: 'Reach it from your laptop', d: 'Tunnel a local port through the API server.', code: 'kubectl port-forward svc/orders 8080:80\ncurl localhost:8080/actuator/health', lang: 'bash' }
    ],
    terms: [
      ['Pod', 'The smallest unit Kubernetes runs: one or more containers sharing an IP. See <a href="pods.html">Pods</a>.'],
      ['Deployment', 'Desired state for stateless pods: image, replica count, update strategy.'],
      ['ReplicaSet', 'Created by the Deployment; keeps exactly N pods of one template version.'],
      ['Service', 'Stable virtual IP + DNS name selecting pods by label. See <a href="services.html">Services</a>.'],
      ['port / targetPort', 'The Service’s port (what callers use) vs the container port it forwards to.'],
      ['port-forward', 'A kubectl tunnel from localhost to a pod, for debugging.']
    ]
  },
  visual: {
    title: 'Deploy, scale, expose, self-heal',
    caption: 'Press Play to apply a Deployment, watch the ReplicaSet create pods, scale to 3, put a Service in front, delete a pod and watch it come back with a new IP, then port-forward from your laptop.'
  },
  gotchas: [
    { trap: 'Mixing up <code>port</code>, <code>targetPort</code> and <code>containerPort</code>.', code: 'kind: Service\nspec:\n  ports:\n    - port: 80          # callers use http://orders:80\n      targetPort: 8080  # forwarded to the container’s 8080', lang: 'yaml', why: 'If <code>targetPort</code> doesn’t match the port Spring Boot listens on, connections are refused even though everything is “Running”.', fix: 'Name the container port (<code>name: http</code>) and use <code>targetPort: http</code>. <code>containerPort</code> itself is informational.' },
    { trap: 'Calling pods by IP.', why: 'Pod IPs change on every restart, reschedule and rollout.', fix: 'Always call the Service name: <code>http://orders</code> from the same namespace, <code>http://orders.orders.svc.cluster.local</code> from anywhere.' },
    { trap: 'Expecting <code>port-forward</code> to load-balance or stay up.', why: 'It picks one pod when it starts. If that pod dies, the forward breaks; other replicas never get your requests.', fix: 'Use it for quick local checks only. For real traffic use a Service of type LoadBalancer or an Ingress/Gateway. See <a href="ingress-gateway.html">Ingress & Gateway</a>.' },
    { trap: 'No readiness probe, so traffic hits a JVM that is still starting.', why: 'Without a readiness probe, a pod counts as Ready once its containers start. Spring may need many seconds before it can serve.', fix: 'Add a readiness probe on <code>/actuator/health/readiness</code>. See <a href="probes.html">Probes</a>.' },
    { trap: 'Scaling with <code>kubectl scale</code> and then re-applying the file.', why: 'Apply restores the <code>replicas</code> in the file.', fix: 'Change <code>replicas</code> in the YAML, or remove it and let an HPA manage it.' },
    { trap: 'Running without resource requests.', why: 'The scheduler can’t place pods sensibly, and a JVM without a memory limit may use far more than expected or be evicted first under pressure.', fix: 'Set <code>resources.requests</code> (and a memory limit) from day one. See <a href="resources-qos.html">Requests, limits & QoS</a>.' }
  ],
  scenarios: [
    { title: 'Everything Running, every call refused', symptom: 'Pods are Running 1/1, but <code>curl http://orders</code> from another pod gets “connection refused”.', diagnose: '<code>kubectl get endpointslices -l kubernetes.io/service-name=orders</code> lists pod IPs on port 80. The app listens on 8080.', cause: 'The Service had <code>port: 80</code> and no <code>targetPort</code>, which defaults to the same value as <code>port</code> (80).', fix: 'Set <code>targetPort</code> to the container port (or its name).', fixCode: 'ports:\n  - name: http\n    port: 80\n    targetPort: http   # matches containerPort name in the pod', lang: 'yaml' },
    { title: 'A deploy causes a burst of 502s', symptom: 'Each rollout causes a few seconds of errors from the gateway.', diagnose: 'New pods are marked Ready instantly; Spring logs show “Started” 20 s later.', cause: 'No readiness probe: the Service routed to pods whose app wasn’t listening yet.', fix: 'Add a readiness probe using Boot’s health groups (Spring Boot 2.3+). Graceful shutdown handles the other end.', fixCode: 'readinessProbe:\n  httpGet: { path: /actuator/health/readiness, port: http }\n  periodSeconds: 5\n# application.yaml\n# server.shutdown: graceful', lang: 'yaml' },
    { title: 'Pods stuck Pending after scaling to 10', symptom: '<code>kubectl scale --replicas=10</code>: 3 pods run, 7 stay Pending.', diagnose: '<code>kubectl describe pod</code> → “0/1 nodes are available: Insufficient memory”.', cause: 'Each pod requests 1Gi; the single local node has no room.', fix: 'Lower the replica count locally, right-size requests, or add nodes (kind multi-node config).', fixCode: 'kubectl describe pod -l app=orders | grep -A3 Events\nkubectl top nodes   # needs metrics-server', lang: 'bash' }
  ],
  puzzles: [
    { kind: 'concept', q: 'You <code>kubectl apply</code> a Deployment with <code>replicas: 2</code>. Which objects now exist?', options: ['1 Deployment only', '1 Deployment, 1 ReplicaSet, 2 Pods', '1 Deployment, 2 ReplicaSets, 2 Pods', '2 Deployments'], answer: 1, explain: 'The Deployment controller creates a ReplicaSet; the ReplicaSet controller creates the pods.' },
    { kind: 'concept', q: 'A Service has <code>port: 80</code>, <code>targetPort: 8080</code>. What URL does another pod in the same namespace use?', options: ['http://orders:8080', 'http://orders (port 80)', 'http://&lt;pod-ip&gt;:80', 'http://localhost:8080'], answer: 1, explain: 'Callers use the Service port. The Service forwards to 8080 in the pods.' },
    { kind: 'concept', q: 'You delete one of three pods. What happens to the Service?', options: ['It breaks until you re-create it', 'It removes that pod from its endpoints and adds the replacement once Ready', 'It keeps sending traffic to the old IP', 'It is deleted too'], answer: 1, explain: 'Endpoints track matching Ready pods continuously.' },
    { kind: 'concept', q: 'What is the default Service type?', options: ['NodePort', 'LoadBalancer', 'ClusterIP', 'ExternalName'], answer: 2, explain: 'ClusterIP: a virtual IP reachable only inside the cluster.' },
    { kind: 'concept', q: 'With 3 replicas, <code>kubectl port-forward svc/orders 8080:80</code> sends your requests to…', options: ['All 3 pods in round-robin', 'One pod chosen when the forward starts', 'The node', 'A random pod per request'], answer: 1, explain: 'port-forward resolves the Service to a single pod and tunnels to it.' },
    { kind: 'concept', q: 'Why use a Deployment instead of creating a Pod directly?', options: ['Pods can’t run Java', 'A bare Pod isn’t recreated if it’s deleted or its node fails; a Deployment keeps the desired count and handles rolling updates', 'Deployments are faster', 'Services can only select Deployments'], answer: 1, explain: 'Controllers provide self-healing and updates. Services select pods by label, whatever created them.' }
  ],
  interview: [
    { q: 'Deployment vs ReplicaSet vs Pod?', a: '<p>A Pod runs containers. A ReplicaSet keeps N identical pods. A Deployment manages ReplicaSets over time, creating a new one per template change for rolling updates and rollbacks. See <a href="deployments-rollouts.html">Deployments & rollouts</a>.</p>', lvl: 'core' },
    { q: 'Why do you need a Service?', a: '<p>Pod IPs are ephemeral. A Service gives a stable virtual IP and DNS name, selects pods by label and spreads connections over Ready ones.</p>', lvl: 'core' },
    { q: 'ClusterIP vs NodePort vs LoadBalancer?', a: '<ul><li><b>ClusterIP</b>: internal only.</li><li><b>NodePort</b>: also opens a port (30000–32767 by default) on every node.</li><li><b>LoadBalancer</b>: also asks the cloud for an external load balancer.</li></ul>', lvl: 'core' },
    { q: 'How do you scale a Deployment?', a: '<p>Change <code>spec.replicas</code> (in Git, then apply) or <code>kubectl scale</code>; or let an HorizontalPodAutoscaler set it from metrics.</p>', lvl: 'core' },
    { q: 'What happens when a pod crashes?', a: '<p>The kubelet restarts the container in place (with back-off). If the pod itself is deleted or its node dies, the ReplicaSet creates a new pod, often on another node, with a new name and IP.</p>', lvl: 'core' },
    { q: 'How do you update the image?', a: '<p>Change <code>image</code> in the manifest and apply (or <code>kubectl set image</code>). The Deployment rolls out a new ReplicaSet gradually; <code>kubectl rollout status</code> / <code>rollout undo</code> to watch or roll back.</p>', lvl: 'core' },
    { q: 'How does a Service actually route traffic?', a: '<p>An EndpointSlice controller lists matching pod IPs; kube-proxy (iptables/IPVS/nftables) on each node programs rules so the ClusterIP is translated to one of those IPs, per connection.</p>', fu: 'Why can long-lived connections (HTTP/2, gRPC) end up unbalanced?', lvl: 'deep' },
    { q: 'How do you reach a ClusterIP Service from your laptop?', a: '<p><code>kubectl port-forward svc/orders 8080:80</code> for debugging; for real access, Ingress/Gateway or a LoadBalancer.</p>', lvl: 'core' },
    { q: 'What should a minimal production-ready Spring Boot Deployment include?', a: '<ul><li>Immutable image tag</li><li>Requests + memory limit</li><li>Readiness, liveness (and startup) probes on actuator health groups</li><li>Graceful shutdown</li><li>At least 2 replicas</li></ul>', lvl: 'deep' }
  ],
  code: [
    { title: 'deployment.yaml', lang: 'yaml', code: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: orders\n  labels: { app: orders }\nspec:\n  replicas: 2\n  selector:\n    matchLabels: { app: orders }\n  template:\n    metadata:\n      labels: { app: orders }\n    spec:\n      containers:\n        - name: orders\n          image: ghcr.io/acme/orders:1.0\n          ports:\n            - name: http\n              containerPort: 8080\n          resources:\n            requests: { cpu: 250m, memory: 512Mi }\n            limits:   { memory: 512Mi }\n          readinessProbe:\n            httpGet: { path: /actuator/health/readiness, port: http }\n            periodSeconds: 5' },
    { title: 'service.yaml', lang: 'yaml', code: 'apiVersion: v1\nkind: Service\nmetadata:\n  name: orders\nspec:\n  type: ClusterIP        # default\n  selector: { app: orders }\n  ports:\n    - name: http\n      port: 80\n      targetPort: http' },
    { title: 'The whole loop', lang: 'bash', code: './mvnw -DskipTests package\ndocker build -t orders:1.0 .\nkind load docker-image orders:1.0 --name dev   # or docker push to a registry\n\nkubectl apply -f deployment.yaml -f service.yaml\nkubectl rollout status deploy/orders\nkubectl get deploy,rs,pods,svc -l app=orders\n\nkubectl scale deploy/orders --replicas=3\nkubectl delete pod -l app=orders --wait=false   # watch them come back\nkubectl get pods -l app=orders -w\n\nkubectl port-forward svc/orders 8080:80\ncurl localhost:8080/actuator/health', note: 'With kind and a locally loaded image, use <code>image: orders:1.0</code> in the Deployment.' },
    { title: 'application.yaml', lang: 'yaml', code: 'server:\n  port: 8080\n  shutdown: graceful\nmanagement:\n  endpoint:\n    health:\n      probes:\n        enabled: true   # auto-enabled on Kubernetes; explicit is fine\n  endpoints:\n    web:\n      exposure:\n        include: health,info', note: 'Spring Boot 2.3+ exposes <code>/actuator/health/liveness</code> and <code>/readiness</code>.' }
  ]
});

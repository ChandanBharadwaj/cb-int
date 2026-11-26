IA.register({
  track: 'kubernetes',
  slug: 'kubectl-basics',
  title: 'kubectl basics',
  tagline: 'A handful of verbs covers most days: <code>get</code>, <code>describe</code>, <code>logs</code>, <code>exec</code> and <code>apply</code>. Every one is an HTTPS call to the API server, scoped to a <b>namespace</b>.',
  tldr: {
    problem: 'Beginners copy commands without knowing what they touch, then get lost when a pod is “not working” or a second <code>create</code> fails.',
    model: 'kubectl is a REST client. Reads (<code>get</code>, <code>describe</code>) fetch stored objects. <code>logs</code>/<code>exec</code> are proxied through the API server to the kubelet on the pod’s node. <code>apply</code> writes desired state; controllers do the rest.',
    hook: '“apply vs create?” <code>create</code> is imperative: make a new object, fail if it exists. <code>apply</code> is declarative: make the live object match my file, creating or patching as needed. Safe to repeat.',
    facts: [
      { v: 'default', l: 'the namespace used when neither <code>-n</code> nor the context sets one' },
      { v: '--previous', l: '<code>kubectl logs --previous</code> shows the last terminated container: where a crash’s stack trace lives' },
      { v: 'Events', l: 'shown at the bottom of <code>kubectl describe</code>; kept only for a limited time (about an hour by default)' }
    ]
  },
  intro: {
    what: '<code>kubectl</code> is the command-line tool for Kubernetes. You use it to <b>look</b> at things (what pods are running, why one is failing), to <b>reach into</b> a container (logs, a shell) and to <b>send</b> YAML files that describe what you want running.',
    analogy: { icon: '🛂', title: 'One front desk for the whole building', text: 'In a hotel you never walk into the kitchen; you ask the front desk, and they talk to the right staff. The API server is that desk. kubectl only ever talks to it, even for logs from a container on some far-away node.' },
    steps: [
      { t: 'List things', d: '<code>get</code> takes a resource type and optional name.', code: 'kubectl get pods\nkubectl get deploy,svc -n orders\nkubectl get pods -A          # all namespaces\nkubectl get pod orders-7d9f-abc -o wide', lang: 'bash' },
      { t: 'Ask “why?”', d: '<code>describe</code> shows details and recent Events.', code: 'kubectl describe pod orders-7d9f-abc', lang: 'bash' },
      { t: 'Read the app’s output', d: 'Spring Boot logs to stdout by default, which is what this reads.', code: 'kubectl logs deploy/orders -f\nkubectl logs orders-7d9f-abc --previous', lang: 'bash' },
      { t: 'Look inside a container', d: 'Runs a new process in the running container.', code: 'kubectl exec -it orders-7d9f-abc -- sh\nkubectl exec orders-7d9f-abc -- env | grep SPRING', lang: 'bash' },
      { t: 'Send desired state', d: 'The everyday way to change a cluster.', code: 'kubectl apply -f k8s/\nkubectl get deploy orders -o yaml', lang: 'bash' }
    ],
    terms: [
      ['resource / object', 'A type (Pod, Deployment, Service) and one stored instance of it.'],
      ['namespace', 'A folder for objects. Names must be unique within it. <code>default</code>, <code>kube-system</code> exist from the start.'],
      ['-o yaml / -o wide', 'Output formats: the full object, or extra table columns (node, IP).'],
      ['Events', 'Short records of what happened to an object: scheduled, pulled image, back-off, killed.'],
      ['imperative vs declarative', '“Do this action” (<code>create</code>, <code>scale</code>) vs “make it look like this” (<code>apply</code>).']
    ]
  },
  visual: {
    title: 'What each kubectl command touches',
    caption: 'Three families: <b>get / describe</b> read from the API server; <b>logs / exec</b> are proxied to the kubelet on the pod’s node; <b>apply vs create</b> write objects that controllers act on. Press Play or Step.'
  },
  gotchas: [
    { trap: '“No resources found” although the app is running.', code: 'kubectl get pods            # No resources found in default namespace.\nkubectl get pods -n orders  # there they are\nkubectl get pods -A | grep orders', lang: 'bash', why: 'Every namespaced command uses one namespace: <code>-n</code>, or the context’s default, or <code>default</code>.', fix: 'Pass <code>-n</code>, use <code>-A</code> to search, or set the context namespace: <code>kubectl config set-context --current --namespace=orders</code>.' },
    { trap: 'Mixing <code>create</code>/<code>edit</code>/<code>scale</code> with <code>apply</code> on the same objects.', why: 'The file in Git says one thing, the live object says another. The next <code>apply</code> may quietly revert a manual change (for example, scaling back to the file’s replica count).', fix: 'Pick one source of truth: files in Git plus <code>kubectl apply</code> (or GitOps). Use imperative commands only for quick experiments or to generate YAML: <code>kubectl create deploy x --image=y --dry-run=client -o yaml</code>.' },
    { trap: 'Reading logs from the new container instead of the one that crashed.', why: 'After a restart, <code>kubectl logs</code> shows the <b>current</b> container, which may only have started booting.', fix: '<code>kubectl logs POD --previous</code> (and <code>-c NAME</code> for multi-container pods).' },
    { trap: '<code>kubectl exec … -- bash</code> fails with “executable file not found”.', why: 'Slim and distroless images often have no bash, or no shell at all.', fix: 'Try <code>sh</code>. For distroless, use an ephemeral debug container: <code>kubectl debug -it POD --image=busybox --target=CONTAINER</code>. See <a href="debugging.html">Debugging workloads</a>.' },
    { trap: 'Fixing things by hand inside a container with <code>exec</code>.', why: 'Changes live only in that container’s writable layer. The next restart or rollout throws them away, and the other replicas never had them.', fix: 'Change the image or the manifest and roll out. Use <code>exec</code> to <i>look</i>.' },
    { trap: 'Deleting a pod to “stop” the app.', code: 'kubectl delete pod orders-7d9f-abc   # a new one appears seconds later\nkubectl scale deploy/orders --replicas=0', lang: 'bash', why: 'The pod is owned by a ReplicaSet, which replaces it to keep the desired count.', fix: 'Scale the Deployment, or delete the Deployment itself.' }
  ],
  scenarios: [
    { title: 'Pod restarts every minute, logs look fine', symptom: '<code>kubectl get pods</code> shows <code>RESTARTS 7</code> and <code>CrashLoopBackOff</code>; <code>kubectl logs</code> just shows Spring starting.', diagnose: '<code>kubectl logs POD --previous</code> shows <code>Failed to configure a DataSource</code>. <code>describe</code> shows <code>Last State: Terminated, Exit Code: 1</code>.', cause: 'The plain <code>logs</code> call printed the fresh container, not the one that died.', fix: 'Always check <code>--previous</code> and the Events. Here: add the missing datasource config.', fixCode: 'kubectl logs deploy/orders --previous --tail=50\nkubectl describe pod -l app=orders | sed -n \'/Last State/,/Exit Code/p\'', lang: 'bash' },
    { title: 'The scale-up that kept disappearing', symptom: 'On-call ran <code>kubectl scale deploy/orders --replicas=6</code> during a spike. Ten minutes later it was back to 2.', diagnose: 'A CI pipeline re-ran <code>kubectl apply -f k8s/</code>; the file says <code>replicas: 2</code>.', cause: 'Imperative change vs declarative source of truth: apply restored the file’s value.', fix: 'Change replicas in Git, or let an HPA own replica count and remove <code>replicas</code> from the file. See <a href="autoscaling.html">autoscaling</a>.', fixCode: '# deployment.yaml\nspec:\n  replicas: 6', lang: 'yaml' }
  ],
  puzzles: [
    { kind: 'concept', q: 'You run <code>kubectl create -f app.yaml</code> twice. What happens the second time?', options: ['It updates the objects', 'It fails with AlreadyExists', 'It creates duplicates with new names', 'It deletes and recreates them'], answer: 1, explain: '<code>create</code> only creates. Use <code>apply</code> to create-or-update.' },
    { kind: 'concept', q: 'Which command is safe to run repeatedly from a CI pipeline?', options: ['kubectl create -f k8s/', 'kubectl apply -f k8s/', 'kubectl replace -f k8s/', 'kubectl run'], answer: 1, explain: '<code>apply</code> is idempotent: same file, same result.' },
    { kind: 'concept', q: 'How does <code>kubectl logs</code> get the container’s output?', options: ['It SSHes into the node', 'The API server proxies the request to the kubelet on that node', 'It reads etcd', 'From a log file inside the image'], answer: 1, explain: 'kubectl only talks to the API server; the API server reaches the kubelet, which reads the container runtime’s logs.' },
    { kind: 'concept', q: 'A pod is <code>Pending</code>. Which command most directly tells you why?', options: ['kubectl logs', 'kubectl describe pod', 'kubectl exec', 'kubectl get svc'], answer: 1, explain: 'A Pending pod may have no container yet, so no logs. <code>describe</code> shows Events like “0/1 nodes available: insufficient memory”.' },
    { kind: 'concept', q: 'What does <code>kubectl get pod x -o yaml</code> show that <code>kubectl get pod x</code> doesn’t?', options: ['Nothing more', 'The full object: metadata, spec and the server-filled status', 'Only the logs', 'The Dockerfile'], answer: 1, explain: 'The default output is a summary table; <code>-o yaml</code> prints the whole stored object.' },
    { kind: 'concept', q: 'You delete a pod that belongs to a Deployment with <code>replicas: 3</code>. A minute later?', options: ['2 pods', '3 pods, one with a new name', 'The Deployment is deleted too', '0 pods'], answer: 1, explain: 'The ReplicaSet notices 2 ≠ 3 and creates a replacement with a new random suffix.' },
    { kind: 'concept', q: 'Which namespace does <code>kubectl get pods</code> use if your context has none set?', options: ['kube-system', 'All namespaces', 'default', 'The last one you used'], answer: 2, explain: 'Without <code>-n</code> or a context namespace, kubectl uses <code>default</code>.' }
  ],
  interview: [
    { q: 'apply vs create?', a: '<p><code>create</code> is imperative and fails if the object exists. <code>apply</code> is declarative: it computes a patch between your file, the live object and the last-applied state, so it creates or updates and is idempotent.</p>', fu: 'What is server-side apply and field ownership?', lvl: 'core' },
    { q: 'A pod is in CrashLoopBackOff. What do you run?', a: '<ol><li><code>kubectl describe pod</code>: Last State, exit code, Events.</li><li><code>kubectl logs POD --previous</code>: the crash’s stack trace.</li><li>Exit code 137 + OOMKilled → memory; probe failures in Events → probes.</li></ol>', lvl: 'core' },
    { q: 'What is a namespace for?', a: '<p>Scoping names, and a unit for RBAC, ResourceQuotas and NetworkPolicies. It is not a hard security boundary by itself. Some objects (Nodes, PersistentVolumes, ClusterRoles) are cluster-scoped.</p>', lvl: 'core' },
    { q: 'How do you get a shell in a running container?', a: '<p><code>kubectl exec -it POD -c CONTAINER -- sh</code>. If the image has no shell, use <code>kubectl debug</code> with an ephemeral container.</p>', lvl: 'core' },
    { q: 'How do you see logs for all pods of a Deployment?', a: '<p><code>kubectl logs deploy/orders</code> picks one pod. For all: <code>kubectl logs -l app=orders --all-containers --prefix</code>. For real work, use a log aggregation system.</p>', lvl: 'core' },
    { q: 'What does kubectl actually do on <code>apply</code>?', a: '<p>Reads kubeconfig, authenticates, sends PATCH/POST requests to the API server, which authenticates, authorizes (RBAC), runs admission, validates and stores in etcd. kubectl returns; controllers and kubelets reconcile afterwards. See <a href="architecture.html">architecture</a>.</p>', lvl: 'deep' },
    { q: 'How do you find which fields a resource supports?', a: '<p><code>kubectl explain deployment.spec.strategy</code> prints the schema docs from the cluster itself; <code>kubectl api-resources</code> lists types and short names.</p>', lvl: 'core' },
    { q: 'How do you generate YAML instead of writing it from scratch?', a: '<p><code>kubectl create deployment orders --image=orders:1.0 --dry-run=client -o yaml &gt; deployment.yaml</code>, then edit and <code>apply</code>.</p>', lvl: 'core' },
    { q: 'How do you preview a change before applying?', a: '<p><code>kubectl diff -f k8s/</code> shows what would change against the live objects; <code>--dry-run=server</code> runs validation and admission without saving.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Cheat sheet', lang: 'bash', code: '# look\nkubectl get pods -n orders -o wide\nkubectl get all -n orders\nkubectl describe deploy/orders -n orders\nkubectl get events -n orders --sort-by=.lastTimestamp\n\n# logs & shell\nkubectl logs -f deploy/orders -n orders\nkubectl logs POD --previous -c orders\nkubectl exec -it POD -n orders -- sh\n\n# change\nkubectl diff  -f k8s/\nkubectl apply -f k8s/\nkubectl delete -f k8s/\n\n# learn\nkubectl explain pod.spec.containers.ports\nkubectl api-resources | head' },
    { title: 'Useful output tricks', lang: 'bash', code: '# image of every pod\nkubectl get pods -o jsonpath=\'{range .items[*]}{.metadata.name}{"\\t"}{.spec.containers[0].image}{"\\n"}{end}\'\n\n# custom columns\nkubectl get pods -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName,PHASE:.status.phase\n\n# watch changes live\nkubectl get pods -w\n\n# filter by label\nkubectl get pods -l app=orders,tier=api' },
    { title: 'Generate, then apply', lang: 'bash', code: 'kubectl create namespace orders --dry-run=client -o yaml > k8s/00-namespace.yaml\nkubectl create deployment orders --image=ghcr.io/acme/orders:1.0 \\\n  --port=8080 -n orders --dry-run=client -o yaml > k8s/10-deployment.yaml\nkubectl apply -f k8s/', note: 'Imperative commands are great YAML generators. Commit the YAML, then manage it declaratively.' }
  ]
});

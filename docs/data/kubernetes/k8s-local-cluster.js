IA.register({
  track: 'kubernetes',
  slug: 'k8s-local-cluster',
  title: 'A local cluster',
  tagline: 'You don’t need a cloud account to learn Kubernetes. <b>kind</b>, <b>minikube</b> or <b>Docker Desktop</b> give you a real cluster on your laptop, and a file called <b>kubeconfig</b> tells <code>kubectl</code> which cluster it is talking to.',
  tldr: {
    problem: 'Learning on a shared or production cluster is slow and risky. And with several clusters configured, it is easy to run a command against the wrong one.',
    model: 'A local tool starts a real API server and node(s) in containers or a VM. It writes a <b>context</b> (cluster + user + default namespace) into <code>~/.kube/config</code>. kubectl always uses the <b>current context</b> unless told otherwise.',
    hook: '“How does kubectl know which cluster to hit?” It reads kubeconfig (<code>$KUBECONFIG</code> or <code>~/.kube/config</code>), picks the current context, and talks HTTPS to that cluster’s API server with those credentials.',
    facts: [
      { v: '3 parts', l: 'a kubeconfig has <code>clusters</code> (API URL + CA), <code>users</code> (credentials) and <code>contexts</code> that pair one of each, plus an optional namespace' },
      { v: 'kind-<name>', l: 'the context name kind creates; minikube uses <code>minikube</code>, Docker Desktop uses <code>docker-desktop</code>' },
      { v: '±1 minor', l: 'kubectl is supported within one minor version of the API server (e.g. kubectl 1.30 with a 1.29–1.31 cluster)' }
    ]
  },
  intro: {
    what: 'Kubernetes is a set of programs (an API server, a scheduler, controllers and a node agent) that normally run on many servers. For learning, tools squeeze all of that onto your laptop. You then use the <code>kubectl</code> command to talk to it, exactly as you would to a cloud cluster.',
    analogy: { icon: '🗂️', title: 'kubeconfig is a database connection list', text: 'In IntelliJ’s database panel you have connections: dev Postgres, staging, prod. Each has a URL and credentials, and one tab is “active”. A kubeconfig is that list for clusters, and the current context is the active tab. Running a query on the wrong tab is the classic mistake in both.' },
    steps: [
      { t: 'Install Docker and kubectl', d: 'kind and minikube can both run their nodes as Docker containers.', code: 'docker version\nkubectl version --client', lang: 'bash' },
      { t: 'Create a cluster (pick one tool)', d: 'kind is quick and great for CI; minikube has handy add-ons; Docker Desktop is a checkbox in its settings.', code: 'kind create cluster --name dev\n# or\nminikube start\n# or: Docker Desktop → Settings → Kubernetes → Enable', lang: 'bash' },
      { t: 'Check what kubectl is pointed at', d: 'Do this every time before running anything that changes things.', code: 'kubectl config current-context   # kind-dev\nkubectl get nodes', lang: 'bash' },
      { t: 'Switch between clusters', d: 'Contexts let one kubectl talk to many clusters.', code: 'kubectl config get-contexts\nkubectl config use-context docker-desktop', lang: 'bash' },
      { t: 'Clean up', d: 'Local clusters are disposable; delete and recreate freely.', code: 'kind delete cluster --name dev\n# minikube delete', lang: 'bash' }
    ],
    terms: [
      ['cluster', 'A control plane (API server, scheduler, controllers, etcd) plus nodes that run your containers.'],
      ['node', 'A machine that runs pods. In kind, each node is a Docker container.'],
      ['kubectl', 'The command-line client. It only ever talks to the API server.'],
      ['kubeconfig', 'YAML file (default <code>~/.kube/config</code>) listing clusters, users and contexts.'],
      ['context', 'A named combination of cluster + user + optional default namespace.'],
      ['current-context', 'The context kubectl uses when you don’t pass <code>--context</code>.']
    ]
  },
  visual: {
    title: 'How kubectl picks a cluster',
    caption: '<b>Create a cluster</b> shows what kind writes into your kubeconfig. <b>Switch contexts</b> shows how the current context silently redirects every command, including to production.'
  },
  gotchas: [
    { trap: 'Running a destructive command while the current context is a real cluster.', code: 'kubectl config current-context    # check first!\nkubectl --context kind-dev delete -f k8s/', lang: 'bash', why: '<code>use-context</code> edits the kubeconfig file, so it affects every terminal, script and IDE plugin that reads it.', fix: 'Show the context in your prompt, pass <code>--context</code> in scripts, or keep production credentials in a separate kubeconfig file selected with <code>KUBECONFIG</code> only when needed.' },
    { trap: 'kind/minikube can’t find the image you just built.', code: 'kubectl get pods\n# orders-…   0/1   ErrImagePull\nkind load docker-image orders:1.0 --name dev\n# minikube: minikube image load orders:1.0', lang: 'bash', why: 'The cluster’s nodes have their own image store. Your laptop’s Docker images are not automatically inside them.', fix: 'Load the image into the cluster (above), or push it to a registry. With a local-only image, also set <code>imagePullPolicy: IfNotPresent</code> and avoid the <code>latest</code> tag, which defaults to <code>Always</code>.' },
    { trap: 'Expecting a <code>LoadBalancer</code> Service to get an external IP locally.', why: 'On cloud clusters a cloud controller creates a real load balancer. On kind there is none, so <code>EXTERNAL-IP</code> stays <code>&lt;pending&gt;</code>.', fix: 'Use <code>kubectl port-forward</code> locally. minikube offers <code>minikube tunnel</code>; kind users can install a load-balancer add-on such as cloud-provider-kind or MetalLB.' },
    { trap: 'Assuming a one-node local cluster behaves like production.', why: 'Local clusters usually have one node, a simple storage provisioner and no real load balancer. Scheduling spread, node failures and cloud integrations look different.', fix: 'Use local clusters for learning and fast feedback. kind supports multi-node configs if you want to see scheduling across nodes.' },
    { trap: 'Merged kubeconfig files clobbering each other.', why: '<code>KUBECONFIG</code> can list several files (colon-separated on Linux/macOS). kubectl merges them; the first file to set a given value wins, and <code>use-context</code> writes back into one of them.', fix: 'Know which files are in play: <code>kubectl config view --minify</code> shows only what the current context resolves to.' }
  ],
  scenarios: [
    { title: 'A “local” cleanup deleted staging', symptom: 'A developer ran <code>kubectl delete namespace demo</code> to reset their laptop setup. Staging’s demo namespace vanished.', diagnose: 'Shell history shows <code>kubectl config use-context staging</code> earlier in another terminal; kubeconfig is shared by all terminals.', cause: 'The current context lives in the kubeconfig file, not in the terminal.', fix: 'Pass <code>--context</code> in scripts, show context in the prompt, and give everyday users read-only access to shared clusters (RBAC).', fixCode: '# one-off kubeconfig per shell, so switching is local to it\nexport KUBECONFIG=~/.kube/kind-dev.yaml\nkind get kubeconfig --name dev > ~/.kube/kind-dev.yaml', lang: 'bash' },
    { title: 'Pods stuck in ErrImagePull on kind', symptom: '<code>kubectl apply</code> succeeds, pods never start, <code>describe</code> shows “pull access denied for orders”.', diagnose: '<code>kubectl describe pod</code> → Events: <code>Failed to pull image "orders:latest"</code>.', cause: 'The image exists only in the laptop’s Docker. With tag <code>latest</code>, Kubernetes defaults to <code>imagePullPolicy: Always</code> and tries Docker Hub.', fix: 'Use a versioned tag, load it into kind, and re-apply.', fixCode: 'docker build -t orders:1.0 .\nkind load docker-image orders:1.0 --name dev\nkubectl set image deploy/orders orders=orders:1.0', lang: 'bash' }
  ],
  puzzles: [
    { kind: 'concept', q: 'Where does kubectl look for its configuration by default?', options: ['/etc/kubernetes/admin.conf', '~/.kube/config (unless $KUBECONFIG is set)', 'The current directory’s kubeconfig.yaml', 'It asks the cloud provider'], answer: 1, explain: 'Default is <code>~/.kube/config</code>; the <code>KUBECONFIG</code> variable or <code>--kubeconfig</code> flag override it.' },
    { kind: 'concept', q: 'What does a context contain?', options: ['A cluster, a user and optionally a default namespace', 'Only an API URL', 'A list of running pods', 'A Helm chart'], answer: 0, explain: 'A context is a named triple. Switching context can change cluster, identity and namespace at once.' },
    { kind: 'concept', q: 'You run <code>kubectl config use-context prod</code> in terminal A. What does terminal B’s next kubectl command target?', options: ['Still the old context; contexts are per terminal', 'prod, because use-context edits the shared kubeconfig file', 'Neither; it errors', 'Whichever cluster is closest'], answer: 1, explain: 'The current context is stored in the file. Every process reading that file now uses prod.' },
    { kind: 'concept', q: 'In kind, what is a “node”?', options: ['A VM created with VirtualBox', 'A Docker container running kubelet and a container runtime', 'A Java process', 'A namespace'], answer: 1, explain: 'kind = “Kubernetes IN Docker”: each node is a container on your machine.' },
    { kind: 'concept', q: 'You built <code>orders:1.0</code> locally and a pod on kind fails with ErrImagePull. Simplest fix?', options: ['Restart Docker', '<code>kind load docker-image orders:1.0 --name dev</code>', 'Delete the namespace', 'Use a LoadBalancer Service'], answer: 1, explain: 'The kind node has its own image store; loading copies the image into it.' },
    { kind: 'concept', q: 'Your laptop has kubectl 1.31. Which cluster version is officially within the supported skew?', options: ['1.26', '1.28', '1.30', 'Any version'], answer: 2, explain: 'kubectl supports one minor version older or newer than the API server: 1.30–1.32 here.' }
  ],
  interview: [
    { q: 'What options exist for a local Kubernetes cluster?', a: '<ul><li><b>kind</b>: nodes as Docker containers, fast, multi-node, popular in CI.</li><li><b>minikube</b>: VM or container driver, add-ons (ingress, dashboard), <code>minikube tunnel</code>.</li><li><b>Docker Desktop</b>: built-in single-node cluster.</li><li>Others: k3d (k3s in Docker), Rancher Desktop.</li></ul>', lvl: 'core' },
    { q: 'What is in a kubeconfig file?', a: '<p><code>clusters</code> (server URL + CA certificate), <code>users</code> (client cert, token or an exec plugin for cloud login), <code>contexts</code> (cluster + user + namespace) and <code>current-context</code>.</p>', fu: 'How do cloud clusters avoid long-lived tokens in kubeconfig? (exec credential plugins such as the AWS/Azure/GCP CLIs.)', lvl: 'core' },
    { q: 'How do you avoid running commands against the wrong cluster?', a: '<ul><li>Check <code>kubectl config current-context</code>; show it in the shell prompt.</li><li>Use <code>--context</code> explicitly in scripts.</li><li>Separate kubeconfig files for production.</li><li>Least-privilege RBAC so mistakes can’t delete much.</li></ul>', lvl: 'core' },
    { q: 'How do you set a default namespace for your context?', a: '<p><code>kubectl config set-context --current --namespace=orders</code>. Commands without <code>-n</code> then use <code>orders</code>.</p>', lvl: 'core' },
    { q: 'How does a local cluster get your locally built image?', a: '<p>Either push to a registry the cluster can reach, or load it directly: <code>kind load docker-image</code>, <code>minikube image load</code>. Docker Desktop’s cluster shares the Docker image store.</p>', lvl: 'core' },
    { q: 'What is the kubectl version-skew policy?', a: '<p>kubectl is supported within one minor version (older or newer) of the kube-apiserver.</p>', lvl: 'core' },
    { q: 'Why might something work on kind but not in a cloud cluster (or vice versa)?', a: '<p>Differences in load balancers, storage classes, node count, CNI and NetworkPolicy support, cloud IAM and image registry access. Local clusters hide many of these.</p>', lvl: 'deep' },
    { q: 'How would you use kind in CI?', a: '<p>Create a cluster in the job, <code>kind load</code> the image built in that job, <code>kubectl apply</code> the manifests, wait with <code>kubectl rollout status</code>, run smoke tests, then delete the cluster.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Multi-node kind cluster', lang: 'yaml', code: '# kind-config.yaml  →  kind create cluster --name dev --config kind-config.yaml\nkind: Cluster\napiVersion: kind.x-k8s.io/v1alpha4\nnodes:\n  - role: control-plane\n    extraPortMappings:        # reach NodePort 30080 at localhost:8080\n      - containerPort: 30080\n        hostPort: 8080\n  - role: worker\n  - role: worker', note: 'Pin a Kubernetes version with <code>image: kindest/node:&lt;version&gt;</code> per node, using a tag from the kind release notes.' },
    { title: 'kubeconfig, annotated', lang: 'yaml', code: 'apiVersion: v1\nkind: Config\nclusters:\n  - name: kind-dev\n    cluster:\n      server: https://127.0.0.1:52134\n      certificate-authority-data: LS0t…\nusers:\n  - name: kind-dev\n    user:\n      client-certificate-data: LS0t…\n      client-key-data: LS0t…\ncontexts:\n  - name: kind-dev\n    context:\n      cluster: kind-dev\n      user: kind-dev\n      namespace: orders     # optional default namespace\ncurrent-context: kind-dev' },
    { title: 'Context commands', lang: 'bash', code: 'kubectl config get-contexts\nkubectl config current-context\nkubectl config use-context kind-dev\nkubectl config set-context --current --namespace=orders\nkubectl config view --minify          # only the active context\nkubectl --context docker-desktop get nodes\n\nkind get clusters\nkind delete cluster --name dev' }
  ]
});

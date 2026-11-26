IA.register({
  track: 'kubernetes',
  slug: 'k8s-yaml-manifests',
  title: 'Reading YAML manifests',
  tagline: 'Every Kubernetes object has the same four-part shape: <code>apiVersion</code>, <code>kind</code>, <code>metadata</code>, <code>spec</code>. Learn that, plus how <b>labels and selectors</b> glue objects together, and any manifest becomes readable.',
  tldr: {
    problem: 'A wall of nested YAML looks intimidating, and a single indentation or label typo can break things <i>silently</i>.',
    model: '<b>apiVersion + kind</b> pick the schema. <b>metadata</b> is identity (name, namespace, labels). <b>spec</b> is what you want. <b>status</b> is what the cluster observed, written by controllers. Objects find each other through <b>label selectors</b>, not by name.',
    hook: '“How does a Service know which pods to send traffic to?” Its <code>selector</code> matches pod <b>labels</b>, evaluated continuously. No list of pods is stored in the Service spec.',
    facts: [
      { v: 'apps/v1', l: 'apiVersion of Deployment, ReplicaSet, StatefulSet, DaemonSet; core types like Pod, Service, ConfigMap use just <code>v1</code>' },
      { v: 'immutable', l: 'a Deployment’s <code>spec.selector</code> can’t be changed after creation in <code>apps/v1</code>' },
      { v: '---', l: 'separates multiple YAML documents (objects) in one file' }
    ]
  },
  intro: {
    what: 'A <b>manifest</b> is a YAML file describing one or more Kubernetes objects. You don’t tell Kubernetes the steps to run your app; you write down what should exist and hand it over with <code>kubectl apply</code>. Reading these files is the core everyday skill.',
    analogy: { icon: '🏷️', title: 'Labels are hashtags', text: 'You don’t tell Instagram which photos belong to #spring. You tag photos, and a search for #spring finds them, including ones posted tomorrow. Pods carry labels like <code>app: orders</code>; Services and Deployments “search” with selectors.' },
    steps: [
      { t: 'YAML in 30 seconds', d: 'Indentation (spaces, never tabs) means nesting. <code>key: value</code> is a map entry; <code>- item</code> is a list entry.', code: 'metadata:\n  name: orders        # nested under metadata\n  labels:\n    app: orders\nports:\n  - containerPort: 8080   # a list with one map in it', lang: 'yaml' },
      { t: 'The four top-level fields', d: 'Same in every object.', code: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: orders\nspec:\n  replicas: 2\n  # …', lang: 'yaml' },
      { t: 'Labels on pods, selectors on owners', d: 'The Deployment’s selector must match its pod template labels.', code: 'spec:\n  selector:\n    matchLabels: { app: orders }\n  template:\n    metadata:\n      labels: { app: orders }', lang: 'yaml' },
      { t: 'Several objects in one file', d: 'Separate them with <code>---</code>.', code: 'kubectl apply -f app.yaml   # Deployment + Service inside', lang: 'bash' },
      { t: 'Ask the cluster for help', d: 'Field docs come from the server’s own schema.', code: 'kubectl explain deployment.spec.selector', lang: 'bash' }
    ],
    terms: [
      ['manifest', 'A YAML (or JSON) file describing objects you want.'],
      ['apiVersion', 'API group and version, e.g. <code>apps/v1</code>, <code>v1</code>, <code>networking.k8s.io/v1</code>.'],
      ['kind', 'The object type: Deployment, Service, ConfigMap…'],
      ['metadata', 'Name, namespace, labels, annotations, plus server-set fields like uid.'],
      ['spec / status', 'Desired state you write / observed state the cluster writes.'],
      ['label & selector', 'Key/value tags on objects, and queries over them (<code>app=orders,tier=api</code>).']
    ]
  },
  visual: {
    title: 'Read a manifest like the API server does',
    caption: '<b>Anatomy</b> walks the four top-level fields plus status. <b>Labels & selectors</b> shows how the Deployment and Service find pods, and what one typo does. <b>Multi-doc files</b> shows <code>---</code>.'
  },
  gotchas: [
    { trap: 'Selector and pod-template labels don’t match.', code: 'spec:\n  selector:\n    matchLabels: { app: orders }\n  template:\n    metadata:\n      labels: { app: order }   # typo', lang: 'yaml', why: 'For a Deployment, the API server rejects it: “selector does not match template labels”. That one is loud.', fix: 'Copy labels, don’t retype them. Keep a small fixed set such as <code>app.kubernetes.io/name</code>.' },
    { trap: 'A Service selector that matches nothing.', why: 'Nothing validates a Service selector against pods. It is accepted, has zero endpoints, and calls time out or are refused.', fix: 'Check <code>kubectl get endpointslices -l kubernetes.io/service-name=orders</code> (or <code>kubectl describe svc</code> → Endpoints). Empty means a label mismatch or no Ready pods.' },
    { trap: 'Indentation mistakes that are still valid YAML.', code: 'containers:\n  - name: orders\n    image: orders:1.0\n  env:                 # wrong level: sibling of the list, not of the container\n    - name: X\n      value: "1"', lang: 'yaml', why: 'The file parses, but <code>env</code> lands in the wrong place. Unknown fields used to be silently dropped. With server-side field validation (GA in K8s 1.27) and kubectl’s default <code>--validate=strict</code>, they are rejected, but a misplaced field that is valid at its new level still passes.', fix: 'Never pass <code>--validate=false</code>. Use an editor with the Kubernetes JSON schema, and run <code>kubectl apply --dry-run=server</code>.' },
    { trap: 'YAML type surprises: <code>yes</code>, <code>on</code>, <code>08</code>, <code>1.10</code>.', code: 'env:\n  - name: FEATURE_ON\n    value: "true"      # must be a string\n  - name: VERSION\n    value: "1.10"      # unquoted 1.10 becomes the number 1.1', lang: 'yaml', why: 'Env var values must be strings. Unquoted <code>true</code> or <code>8080</code> are parsed as boolean/number and rejected, and some parsers treat <code>yes</code>/<code>on</code> as booleans.', fix: 'Quote anything that should be a string, especially in <code>env</code> and ConfigMap <code>data</code>.' },
    { trap: 'Copying <code>status</code>, <code>uid</code> or <code>resourceVersion</code> from <code>kubectl get -o yaml</code> into Git.', why: 'Those fields are server-owned. <code>resourceVersion</code> in particular makes later applies fail with conflicts.', fix: 'Commit only what you author: apiVersion, kind, metadata (name, namespace, labels, annotations) and spec.' },
    { trap: 'Trying to change a Deployment’s selector later.', why: '<code>spec.selector</code> is immutable in <code>apps/v1</code>.', fix: 'Choose stable selector labels on day one. Put changing things (version, team) in extra labels that are not in the selector.' }
  ],
  scenarios: [
    { title: 'Service returns “connection refused” right after a relabel', symptom: 'A refactor renamed labels to <code>app.kubernetes.io/name: orders</code>. Pods are Running and Ready, but calls to <code>http://orders</code> fail.', diagnose: '<code>kubectl describe svc orders</code> shows <code>Endpoints: &lt;none&gt;</code>. <code>kubectl get pods --show-labels</code> shows only the new label.', cause: 'The Service selector still said <code>app: orders</code>. No validation links Services to pods.', fix: 'Update the Service selector in the same change, and add an endpoint check to the deploy pipeline.', fixCode: 'kind: Service\nspec:\n  selector:\n    app.kubernetes.io/name: orders', lang: 'yaml' },
    { title: 'Env var silently ignored', symptom: '<code>SPRING_PROFILES_ACTIVE</code> was “set” in YAML but the app runs the default profile.', diagnose: '<code>kubectl get deploy orders -o yaml</code> shows no env under the container. An old deploy script ran <code>kubectl apply --validate=false</code>.', cause: '<code>env:</code> was indented at the pod spec level instead of inside the container, and validation that would have rejected the unknown field was switched off.', fix: 'Fix indentation; keep strict validation on in CI so unknown fields fail the build.', fixCode: 'kubectl apply --dry-run=server --validate=strict -f k8s/', lang: 'bash' }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which field do you <b>not</b> write in your own manifest?', options: ['metadata.labels', 'spec.replicas', 'status.readyReplicas', 'apiVersion'], answer: 2, explain: '<code>status</code> is written by controllers. You only author desired state.' },
    { kind: 'concept', q: 'What is the apiVersion for a Deployment?', options: ['v1', 'apps/v1', 'extensions/v1beta1', 'deployments/v1'], answer: 1, explain: 'Deployments live in the <code>apps</code> group, version <code>v1</code>. <code>extensions/v1beta1</code> was removed in K8s 1.16.' },
    { kind: 'concept', q: 'A Service selects <code>app: orders</code>. Which pods get traffic?', options: ['Pods created by the Deployment named orders', 'Any Ready pod in the Service’s namespace with label app=orders', 'All pods in the namespace', 'Pods listed in the Service spec'], answer: 1, explain: 'Selection is purely by labels in the same namespace, and only Ready pods become serving endpoints.' },
    { kind: 'concept', q: 'How do you put a Deployment and a Service in one file?', options: ['List them under <code>items:</code> only', 'Separate the documents with a <code>---</code> line', 'You can’t', 'Use two <code>kind:</code> keys'], answer: 1, explain: '<code>---</code> starts a new YAML document. (A <code>kind: List</code> with <code>items</code> also works, but <code>---</code> is the norm.)' },
    { kind: 'concept', q: 'Why is <code>value: 8080</code> under <code>env</code> rejected?', options: ['8080 is reserved', 'Env values must be strings; unquoted 8080 is a number', 'Ports can’t be env vars', 'It isn’t rejected'], answer: 1, explain: 'Quote it: <code>value: "8080"</code>.' },
    { kind: 'concept', q: 'Which pair must match inside a Deployment?', options: ['metadata.name and container name', 'spec.selector.matchLabels and spec.template.metadata.labels', 'Service name and Deployment name', 'namespace and label'], answer: 1, explain: 'The selector must select the pods the template creates, or the API rejects the Deployment.' }
  ],
  interview: [
    { q: 'What are the top-level fields of a Kubernetes object?', a: '<p><code>apiVersion</code>, <code>kind</code>, <code>metadata</code>, <code>spec</code> (and <code>status</code>, set by the system). ConfigMaps and Secrets use <code>data</code> instead of <code>spec</code>.</p>', lvl: 'core' },
    { q: 'Labels vs annotations?', a: '<p>Labels are short, queryable key/values used by selectors. Annotations hold non-identifying metadata (build info, tool config) and can’t be selected on.</p>', lvl: 'core' },
    { q: 'How do Deployments and Services find pods?', a: '<p>Both use label selectors. The Deployment (via its ReplicaSet) also sets owner references on the pods it creates. The Service only matches labels, and its EndpointSlices list matching pods, marking Ready ones as serving. See <a href="desired-state.html">desired state</a>.</p>', lvl: 'core' },
    { q: 'What does <code>matchExpressions</code> add?', a: '<p>Set-based selectors: <code>In</code>, <code>NotIn</code>, <code>Exists</code>, <code>DoesNotExist</code>. Services only support simple equality maps.</p>', lvl: 'deep' },
    { q: 'What recommended labels does Kubernetes suggest?', a: '<p><code>app.kubernetes.io/name</code>, <code>/instance</code>, <code>/version</code>, <code>/component</code>, <code>/part-of</code>, <code>/managed-by</code>. Keep <code>version</code> out of selectors.</p>', lvl: 'core' },
    { q: 'How do you validate manifests before applying?', a: '<ul><li><code>kubectl apply --dry-run=server</code> (runs admission and validation).</li><li><code>kubectl diff</code>.</li><li>Schema validation in CI (e.g. kubeconform) and editor schemas.</li></ul>', lvl: 'core' },
    { q: 'Why might the live object differ from your file?', a: '<p>Defaults are filled in (strategy, terminationGracePeriodSeconds, imagePullPolicy), admission webhooks mutate it, and other actors (HPA, operators) own some fields.</p>', lvl: 'deep' },
    { q: 'Where does a manifest’s namespace come from?', a: '<p><code>metadata.namespace</code> if set, else <code>-n</code>, else the context default, else <code>default</code>. Setting it in the file conflicts with a different <code>-n</code> and errors.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'app.yaml, annotated', lang: 'yaml', code: 'apiVersion: apps/v1            # group/version → which schema\nkind: Deployment                # type\nmetadata:                       # identity\n  name: orders\n  namespace: orders\n  labels:\n    app.kubernetes.io/name: orders\nspec:                           # desired state\n  replicas: 2\n  selector:                     # which pods I own (immutable)\n    matchLabels:\n      app.kubernetes.io/name: orders\n  template:                     # pod blueprint\n    metadata:\n      labels:\n        app.kubernetes.io/name: orders   # must match selector\n        app.kubernetes.io/version: "1.0"  # extra label, not in selector\n    spec:\n      containers:\n        - name: orders\n          image: ghcr.io/acme/orders:1.0\n          ports:\n            - containerPort: 8080\n---\napiVersion: v1                  # core group\nkind: Service\nmetadata:\n  name: orders\n  namespace: orders\nspec:\n  selector:\n    app.kubernetes.io/name: orders\n  ports:\n    - port: 80\n      targetPort: 8080' },
    { title: 'Explore the schema', lang: 'bash', code: 'kubectl explain deployment.spec\nkubectl explain deployment.spec.template.spec.containers --recursive | head -40\nkubectl get deploy orders -o yaml     # live object incl. defaults + status\nkubectl get pods --show-labels\nkubectl get pods -l \'app.kubernetes.io/name=orders\'' }
  ]
});

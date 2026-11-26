/* Kubernetes basics drill: a timed drill of 30 beginner / first-interview concept questions across the 6 Kubernetes Basics topics, from Docker images to ConfigMaps and Secrets. Misses link back to the topic pages. */
IA.widget('tricky-kubernetes-basics', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  /*Q-START*/
  const Q = [
    // ---------- Docker basics ----------
    { t: 'Docker basics', s: 'docker-basics', q: 'What is the difference between an image and a container?', o: ['They are two names for the same thing', 'An image is a frozen, layered filesystem plus a start command; a container is a running process made from it', 'A container is stored in a registry; an image only exists while running', 'An image is a VM; a container is a process inside it'], a: 1, x: 'Like a class and an object: one image can start many containers. Registries store images, not containers.' },
    { t: 'Docker basics', s: 'docker-basics', q: 'You run this and open <code>localhost:8080</code>. The connection is refused. Why?', code: 'docker run my-app:1.0   # Spring Boot listens on 8080 inside', lang: 'bash', o: ['The image is not built for your CPU', 'No port was published; you need <code>-p 8080:8080</code>', 'Containers cannot use port 8080', 'You must add <code>EXPOSE</code> and it will work without -p'], a: 1, x: 'Container ports are private by default. <code>-p host:container</code> publishes them. <code>EXPOSE</code> is documentation only.' },
    { t: 'Docker basics', s: 'docker-basics', q: 'Why copy <code>pom.xml</code> and download dependencies before copying <code>src/</code> in a Dockerfile?', o: ['Docker requires that order', 'Layer caching: a code change then does not invalidate the dependency layer, so rebuilds are fast', 'It makes the image smaller', 'It hides the source code from the image'], a: 1, x: 'Each instruction is a cached layer. A changed layer invalidates every layer after it, so put what changes least first.' },
    { t: 'Docker basics', s: 'docker-basics', q: 'Why is <code>:latest</code> a risky tag to deploy?', o: ['It is always the oldest image', 'It is just a default tag name, not “newest”; it moves, so you cannot tell or reproduce which build is running', 'Registries reject it', 'It disables layer caching'], a: 1, x: 'Use an immutable tag such as a version or Git SHA (or a digest) so every deploy and rollback is exact.' },
    { t: 'Docker basics', s: 'docker-basics', q: 'What happens to files written inside a container when you remove it with <code>docker rm</code>?', o: ['They are saved back into the image', 'They are lost, unless they were written to a volume or bind mount', 'They move to the registry', 'They stay in <code>/tmp</code> on the host'], a: 1, x: 'The writable container layer is deleted with the container. Persistent data goes in a volume.' },
    // ---------- Local cluster ----------
    { t: 'Local cluster', s: 'k8s-local-cluster', q: 'What does a kubeconfig <b>context</b> combine?', o: ['An image and a tag', 'A cluster, a user (credentials) and a default namespace', 'A Deployment and a Service', 'A node and a pod'], a: 1, x: 'kubectl uses the <b>current context</b> for every command unless you pass <code>--context</code> or <code>-n</code>.' },
    { t: 'Local cluster', s: 'k8s-local-cluster', q: 'Which tool runs Kubernetes nodes as Docker containers on your laptop?', o: ['kind', 'Helm', 'kubeadm on bare metal only', 'kubectl'], a: 0, x: 'kind = “Kubernetes in Docker”. minikube can use a VM or a container driver; Docker Desktop has a built-in single-node option.' },
    { t: 'Local cluster', s: 'k8s-local-cluster', q: 'You built <code>my-app:dev</code> locally, applied a Deployment to kind, and the pod shows <code>ErrImagePull</code>. Most likely fix?', o: ['Restart Docker', 'Load the image into the cluster (<code>kind load docker-image my-app:dev</code>) or push it to a registry', 'Delete the namespace', 'Use <code>kubectl run</code> instead'], a: 1, x: 'The kind nodes have their own image store; they cannot see your host’s local images until you load them.' },
    { t: 'Local cluster', s: 'k8s-local-cluster', q: 'Before running <code>kubectl delete</code>, what is the safest first check?', o: ['<code>kubectl version</code>', '<code>kubectl config current-context</code>, so you know which cluster you are about to change', '<code>docker ps</code>', 'Nothing; delete is undoable'], a: 1, x: 'A wrong current context is a classic way to delete things in a shared or production cluster.' },
    { t: 'Local cluster', s: 'k8s-local-cluster', q: 'Where does kubectl read its cluster connection settings from by default?', o: ['<code>/etc/hosts</code>', '<code>~/.kube/config</code> (or the files listed in <code>KUBECONFIG</code>)', 'The Docker daemon', 'A file in the current directory'], a: 1, x: 'Local cluster tools add their cluster, user and context to that file.' },
    // ---------- kubectl ----------
    { t: 'kubectl', s: 'kubectl-basics', q: 'A pod is stuck in <code>Pending</code>. Which command shows you why?', o: ['<code>kubectl logs</code>', '<code>kubectl describe pod &lt;name&gt;</code>, and read the Events at the bottom', '<code>kubectl exec</code>', '<code>kubectl apply</code>'], a: 1, x: 'A Pending pod has not started, so there are no logs. Events show scheduling problems such as insufficient CPU.' },
    { t: 'kubectl', s: 'kubectl-basics', q: 'Your app container crashed and restarted. How do you see the logs of the crashed run?', o: ['<code>kubectl logs pod</code>', '<code>kubectl logs pod --previous</code>', '<code>kubectl describe node</code>', 'They are gone forever'], a: 1, x: '<code>--previous</code> (<code>-p</code>) shows the last terminated container’s logs; plain <code>logs</code> shows the current one.' },
    { t: 'kubectl', s: 'kubectl-basics', q: 'What is the main difference between <code>kubectl create -f</code> and <code>kubectl apply -f</code>?', o: ['create is faster', 'create fails if the object exists; apply creates or updates it to match the file, so you can rerun it', 'apply only works on Deployments', 'There is none'], a: 1, x: 'apply is declarative and idempotent, which is why it is the everyday command and fits Git-based workflows.' },
    { t: 'kubectl', s: 'kubectl-basics', q: '<code>kubectl get pods</code> shows nothing, but your teammate says the app is deployed in <code>shop</code>. Why?', o: ['The cluster is down', 'kubectl looks in the current namespace (often <code>default</code>); use <code>-n shop</code> or <code>-A</code>', 'Pods are hidden by default', 'You need <code>get pod</code> singular'], a: 1, x: 'Most objects are namespaced. <code>-A</code> lists all namespaces.' },
    { t: 'kubectl', s: 'kubectl-basics', q: 'What does <code>kubectl get deploy web -o yaml</code> show that the file in Git does not?', o: ['Nothing; it is identical', 'The live object, including defaults the API filled in and the <code>status</code> written by controllers', 'Only the labels', 'The container logs'], a: 1, x: 'It is the stored object: your spec plus defaults, managed fields and observed status.' },
    // ---------- YAML manifests ----------
    { t: 'YAML manifests', s: 'k8s-yaml-manifests', q: 'Which four top-level fields does almost every manifest have?', o: ['name, image, ports, env', '<code>apiVersion</code>, <code>kind</code>, <code>metadata</code>, <code>spec</code>', 'version, type, labels, status', 'from, run, copy, cmd'], a: 1, x: '<code>status</code> also exists on live objects, but controllers write it; you do not.' },
    { t: 'YAML manifests', s: 'k8s-yaml-manifests', q: 'How does a Service find the pods it sends traffic to?', o: ['By the Deployment name', 'By a label selector matching the pods’ labels', 'By pod IP addresses listed in the manifest', 'By namespace alone'], a: 1, x: 'Objects find each other through labels and selectors, not names. A typo in a label means zero endpoints.' },
    { t: 'YAML manifests', s: 'k8s-yaml-manifests', q: 'What separates two objects in one YAML file?', o: ['A blank line', 'A line with <code>---</code>', 'A comma', 'You cannot put two objects in one file'], a: 1, x: 'Multi-document YAML: each document between <code>---</code> lines is one object.' },
    { t: 'YAML manifests', s: 'k8s-yaml-manifests', q: 'This Deployment is rejected. Why?', code: 'spec:\n  selector:\n    matchLabels: { app: web }\n  template:\n    metadata:\n      labels: { app: api }', lang: 'yaml', o: ['The selector must use <code>matchExpressions</code>', 'The selector does not match the pod template’s labels', 'Labels cannot be written inline', 'A replicas field is required'], a: 1, x: 'A Deployment’s selector must match its own template labels, or the API server rejects it.' },
    { t: 'YAML manifests', s: 'k8s-yaml-manifests', q: 'Who writes the <code>status</code> section of an object?', o: ['You, in the manifest', 'Kubernetes controllers and the kubelet, reporting what they observe', 'kubectl, on every apply', 'Docker'], a: 1, x: '<code>spec</code> is desired state (yours); <code>status</code> is observed state (the cluster’s).' },
    // ---------- Deployment & Service ----------
    { t: 'Deployment & Service', s: 'first-deployment-service', q: 'You delete one pod of a Deployment with 3 replicas. What happens?', o: ['The Deployment now has 2 replicas', 'Its ReplicaSet notices only 2 pods and creates a new one', 'The whole Deployment is deleted', 'Nothing until you reapply'], a: 1, x: 'Controllers keep actual state matching desired state. Pods are cattle: replaceable, with new names and IPs.' },
    { t: 'Deployment & Service', s: 'first-deployment-service', q: 'Why talk to pods through a Service instead of pod IPs?', o: ['Pod IPs are encrypted', 'Pod IPs change whenever pods are replaced; a Service gives a stable name and IP and balances across matching pods', 'Services are faster than pods', 'Pods have no IP'], a: 1, x: 'Inside the cluster, other apps call e.g. <code>http://web:8080</code> or <code>web.shop.svc.cluster.local</code>.' },
    { t: 'Deployment & Service', s: 'first-deployment-service', q: 'What does <code>kubectl port-forward svc/web 8080:80</code> do?', o: ['Makes the Service public on the internet', 'Tunnels localhost:8080 on your machine to port 80 of the Service, through the API server, while the command runs', 'Changes the Service port permanently', 'Opens a NodePort'], a: 1, x: 'A developer tool for quick access, not a way to expose production traffic.' },
    { t: 'Deployment & Service', s: 'first-deployment-service', q: 'What is the default Service type, and who can reach it?', o: ['LoadBalancer; the internet', '<code>ClusterIP</code>; only clients inside the cluster', 'NodePort; anyone on the node network', 'ExternalName; nobody'], a: 1, x: 'Use NodePort, LoadBalancer or an Ingress/Gateway to accept traffic from outside.' },
    { t: 'Deployment & Service', s: 'first-deployment-service', q: 'How do you scale the Deployment <code>web</code> to 5 pods, the way that survives the next apply from Git?', o: ['<code>kubectl scale deploy web --replicas=5</code> only', 'Change <code>replicas: 5</code> in the manifest and apply it', 'Create two more pods by hand', 'Restart the node'], a: 1, x: '<code>kubectl scale</code> works immediately, but the next apply of a file that says 3 sets it back. (An HPA owns replicas when you use one.)' },
    // ---------- ConfigMaps & Secrets ----------
    { t: 'ConfigMaps & Secrets', s: 'configmaps-secrets-basics', q: 'Is a value in a Kubernetes Secret encrypted?', o: ['Yes, always with AES', 'No: it is only base64-encoded; protect it with RBAC and encryption at rest in etcd', 'Yes, with the pod’s key', 'Only in the default namespace'], a: 1, x: 'Anyone who can read the Secret can decode it with <code>base64 -d</code>. Encryption at rest is a cluster setting.' },
    { t: 'ConfigMaps & Secrets', s: 'configmaps-secrets-basics', q: 'You edit a ConfigMap used via <code>envFrom</code>. The running app still sees the old value. Why?', o: ['ConfigMaps are cached for 24 hours', 'Env vars are copied in when the container starts; restart the pods (e.g. <code>kubectl rollout restart</code>)', 'You must also edit the Secret', 'The edit failed silently'], a: 1, x: 'Mounted ConfigMap files are refreshed by the kubelet after a delay; env vars never change in a running process.' },
    { t: 'ConfigMaps & Secrets', s: 'configmaps-secrets-basics', q: 'What should go in a ConfigMap rather than a Secret?', o: ['A database password', 'Non-sensitive settings such as a feature flag or log level', 'A TLS private key', 'An API token'], a: 1, x: 'Both are key/value objects; Secrets are for credentials and get tighter handling.' },
    { t: 'ConfigMaps & Secrets', s: 'configmaps-secrets-basics', q: 'Why keep config out of the image?', o: ['Images cannot contain text files', 'So the same image can run in dev, test and prod with different settings, and secrets are not baked into a registry', 'It makes builds slower', 'Kubernetes requires it'], a: 1, x: 'Build once, configure per environment. Anything baked into an image is readable by anyone who can pull it.' },
    { t: 'ConfigMaps & Secrets', s: 'configmaps-secrets-basics', q: 'A pod references a ConfigMap that does not exist. What do you usually see?', o: ['The pod runs with empty values', 'The container does not start (<code>CreateContainerConfigError</code>); describe shows the missing ConfigMap', 'The ConfigMap is created automatically', 'The node crashes'], a: 1, x: 'Unless the reference is marked <code>optional: true</code>, the kubelet cannot build the container config.' }
  ];
  /*Q-END*/
  const TOPICS = ['All', ...[...new Set(Q.map((q) => q.t))]];
  const slugOf = {}; Q.forEach((q) => { slugOf[q.t] = q.s; });
  if (!document.getElementById('w-tv-style')) {
    document.head.append(el('style', { id: 'w-tv-style', text: `
.w-tv-bar { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; margin: 8px 0; }
.w-tv-bar div { height: 100%; background: var(--accent); }
.w-tv-bar div.low { background: var(--err); }
.w-tv-opts { display: grid; gap: 6px; margin-top: 10px; }
.w-tv-opts button { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 9px; padding: 9px 12px; font-size: 14px; cursor: pointer; overflow-wrap: anywhere; }
.w-tv-opts button:hover:not(:disabled) { border-color: var(--accent); }
.w-tv-opts button.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 15%, transparent); }
.w-tv-opts button.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 15%, transparent); }
.w-tv-opts button:disabled { cursor: default; }
.w-tv-q { font-size: 16px; margin: 6px 0 8px; }
.w-tv-rev { border-top: 1px solid var(--border); padding: 10px 0; }
.w-tv-rev:first-child { border-top: 0; }
` }));
  }
  let topic = 'All'; let count = 10; let secs = 60; let gen = 0; let deck = []; let i = 0; let score = 0; let misses = []; let left = 0; let answered = false; let started = false; let tick = null;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segT = seg(TOPICS.map((t) => [t, t]), () => topic, (v) => { topic = v; reset(); }, 'Topic');
  const segN = seg([[10, '10 questions'], [20, '20'], [30, 'all 30']], () => count, (v) => { count = v; reset(); }, 'Number of questions');
  const segS = seg([[90, 'Slow · 90 s'], [60, 'Normal · 60 s'], [30, 'Fast · 30 s']], () => secs, (v) => { secs = v; reset(); }, 'Time per question');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Start' }); const bStep = el('button', { class: 'btn', text: 'Skip ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const card = el('div', { class: 'card', style: { padding: '14px', marginTop: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segT), el('div', { class: 'w-controls' }, segN, el('span', { class: 'tiny', text: 'time per question' }), segS),
    el('div', { class: 'w-controls' }, bPlay, bStep, bReset), stats, card, narr);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function shuffle(a) { const r = a.slice(); for (let j = r.length - 1; j > 0; j--) { const m = Math.floor(Math.random() * (j + 1)); [r[j], r[m]] = [r[m], r[j]]; } return r; }
  function renderStats() { stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `question <b>${Math.min(i + 1, deck.length)}</b>/${deck.length}` }), el('span', { class: 'w-stat', html: `score <b>${score}</b>` }), el('span', { class: 'w-stat', html: `missed <b>${misses.length}</b>` }), el('span', { class: 'w-stat', html: `time <b>${started && !answered ? left + ' s' : '–'}</b>` })); }
  function stopTimer() { if (tick) { clearInterval(tick); tick = null; } }
  function show() {
    const q = deck[i]; answered = false; left = secs; card.innerHTML = '';
    const bar = el('div'); const barWrap = el('div', { class: 'w-tv-bar' }, bar);
    const opts = el('div', { class: 'w-tv-opts' });
    card.append(el('div', { class: 'w-controls', style: { marginBottom: '0' } }, el('span', { class: 'pill accent', text: q.t }), el('span', { class: 'tiny', text: `#${i + 1}` })), barWrap, el('div', { class: 'w-tv-q', html: q.q }));
    if (q.code) card.append(ctx.codeBox(q.code, q.lang || 'yaml'));
    q.o.forEach((o, j) => { const b = el('button', { html: `<b>${'ABCD'[j]}.</b> ${o}` }); b.addEventListener('click', () => answer(j)); opts.append(b); });
    card.append(opts);
    const paint = () => { bar.style.width = (left / secs) * 100 + '%'; bar.className = left <= 10 ? 'low' : ''; if (!reduced) bar.style.transition = 'width 1s linear'; };
    paint(); renderStats(); say('Pick an answer before the bar runs out. Skip counts as a miss.');
    stopTimer(); const g = gen;
    tick = setInterval(() => { if (g !== gen || answered) { stopTimer(); return; } left--; paint(); renderStats(); if (left <= 0) answer(-1); }, 1000);
    card.opts = opts;
  }
  function answer(j) {
    if (answered || !started) return; answered = true; stopTimer();
    const q = deck[i]; const ok = j === q.a;
    if (ok) score++; else misses.push({ q, j });
    [...card.opts.children].forEach((b, m) => { b.disabled = true; if (m === q.a) b.classList.add('ok'); else if (m === j) b.classList.add('bad'); });
    card.append(el('div', { class: 'pz-exp', html: (j === -1 ? '<b>Time’s up.</b> ' : j === -2 ? '<b>Skipped.</b> ' : ok ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.x }));
    bStep.textContent = i + 1 < deck.length ? 'Next ›' : 'Finish ›'; renderStats();
    say(ok ? 'Correct. Press Next.' : 'Read the explanation, then press Next.');
  }
  function next() {
    if (!started) return;
    if (!answered) { answer(-2); return; }
    i++; bStep.textContent = 'Skip ›';
    if (i >= deck.length) return finish();
    show();
  }
  function finish() {
    started = false; stopTimer(); bStep.disabled = true; bPlay.textContent = '▶ Again'; card.innerHTML = '';
    const by = {}; deck.forEach((q) => { by[q.t] = by[q.t] || [0, 0]; by[q.t][1]++; }); deck.forEach((q) => { if (!misses.some((m) => m.q === q)) by[q.t][0]++; });
    card.append(el('h3', { text: `Score: ${score} / ${deck.length}`, style: { margin: '0 0 8px' } }),
      el('div', { class: 'w-stats' }, Object.entries(by).map(([t, [a, n]]) => el('span', { class: 'w-stat', html: `<a href="${slugOf[t]}.html">${t}</a> <b>${a}/${n}</b>` }))));
    if (misses.length) {
      card.append(el('h4', { text: 'Review your misses', style: { margin: '14px 0 4px' } }));
      misses.forEach(({ q, j }) => { const r = el('div', { class: 'w-tv-rev' }, el('div', { html: `<span class="pill">${q.t}</span> ${q.q}` }));
        if (q.code) r.append(ctx.codeBox(q.code, q.lang || 'yaml'));
        r.append(el('div', { class: 'tiny', html: `You: ${j < 0 ? (j === -1 ? 'time ran out' : 'skipped') : q.o[j]} · Correct: <b>${q.o[q.a]}</b>` }), el('div', { class: 'pz-exp', html: q.x + ` <a href="${q.s}.html">Review the topic →</a>` }));
        card.append(r); });
    } else card.append(el('p', { text: 'No misses. Try “all 30” on Fast.' }));
    renderStats(); say(`Done: ${score}/${deck.length}. ` + (misses.length ? 'Your misses are listed above with explanations.' : ''));
  }
  function reset() {
    gen++; stopTimer(); started = false; answered = false; i = 0; score = 0; misses = [];
    const pool = Q.filter((q) => topic === 'All' || q.t === topic); deck = shuffle(pool).slice(0, count);
    bPlay.textContent = '▶ Start'; bStep.textContent = 'Skip ›'; bStep.disabled = true; card.innerHTML = '';
    card.append(el('p', { html: `<b>${deck.length}</b> question${deck.length === 1 ? '' : 's'} (${topic === 'All' ? 'all topics' : topic}), <b>${secs} s</b> each. No running code: answer in your head, like in a first interview.`, style: { margin: 0 } }));
    renderStats(); say('Choose a topic, how many questions and the time limit, then press Start.');
  }
  bPlay.addEventListener('click', () => { reset(); started = true; bStep.disabled = false; bPlay.textContent = '↻ Restart'; show(); });
  bStep.addEventListener('click', next);
  bReset.addEventListener('click', reset);
  reset();
});

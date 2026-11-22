/* Helm, Kustomize & GitOps: values merging and rendering, overlays on a base, and a GitOps reconcile loop that detects and heals drift. */
IA.widget('helm-kustomize-gitops', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8hg-style')) {
    document.head.append(el('style', { id: 'w-k8hg-style', text: `
.k8hg svg text { font-family: var(--sans); }
.k8hg .bx { fill: var(--surface); stroke: var(--border); stroke-width: 1.4; transition: all .3s; }
.k8hg .bx.on { stroke: var(--accent); stroke-width: 2.8; fill: var(--accent-soft); }
.k8hg .bx.bad { stroke: var(--err); stroke-width: 2.8; fill: color-mix(in srgb, var(--err) 12%, var(--surface)); }
.k8hg .bx.good { stroke: var(--ok); stroke-width: 2.8; fill: color-mix(in srgb, var(--ok) 12%, var(--surface)); }
.k8hg .bx.dim { opacity: .45; }
.k8hg .bt { font-size: 12px; font-weight: 700; fill: var(--text); }
.k8hg .bs { font-size: 10px; fill: var(--text-2); font-family: var(--mono); }
.k8hg .ed { stroke: var(--border); stroke-width: 1.6; fill: none; }
.k8hg .ed.on { stroke: var(--accent); stroke-width: 2.8; stroke-dasharray: 7 6; }
.k8hg .ed.on.anim { animation: k8hgflow .9s linear infinite; }
.k8hg .ed.bad { stroke: var(--err); stroke-width: 2.8; stroke-dasharray: 7 6; }
.k8hg .ed.bad.anim { animation: k8hgflow .9s linear infinite; }
.k8hg .el { font-size: 10px; fill: var(--text-3); font-family: var(--mono); }
.k8hg .pn { fill: var(--surface-2); stroke: var(--border); }
.k8hg .pl { font-size: 11px; fill: var(--text); font-family: var(--mono); }
.k8hg .pl.k { fill: var(--accent); } .k8hg .pl.e { fill: var(--err); } .k8hg .pl.o { fill: var(--ok); } .k8hg .pl.m { fill: var(--text-3); }
.k8hg .pill { font-size: 12px; font-weight: 800; font-family: var(--mono); }
@keyframes k8hgflow { to { stroke-dashoffset: -26; } }
` }));
  }
  const MODES = {
    helm: { l: 'Helm: values → render → release',
      boxes: {
        v0: [10, 8, 185, 50, 'chart values.yaml', ['replicaCount: 2', 'image.tag: "1.0"']],
        v1: [10, 68, 185, 50, '-f values-prod.yaml', ['replicaCount: 4', 'resources.limits.memory: 2Gi']],
        v2: [10, 128, 185, 50, '--set image.tag=7.2', ['highest precedence']],
        tp: [10, 188, 185, 50, 'templates/*.yaml', ['{{ .Values.replicaCount }}', '{{ include "labels" . }}']],
        mv: [235, 68, 175, 50, 'merged .Values', ['replicaCount: 4', 'image.tag: "7.2"']],
        rd: [235, 188, 175, 50, 'render', ['Go templates + Sprig', '.Values .Release .Chart']],
        mf: [445, 188, 140, 50, 'manifests', ['plain YAML', '(helm template)']],
        api: [615, 188, 135, 50, 'API server', ['3-way merge patch', 'of each object']],
        rel: [615, 68, 135, 50, 'release record', ['Secret sh.helm.', 'release.v1.orders.v7']]
      },
      edges: [['v0', 'mv'], ['v1', 'mv'], ['v2', 'mv'], ['mv', 'rd'], ['tp', 'rd'], ['rd', 'mf'], ['mf', 'api'], ['api', 'rel']],
      steps: [
        { on: ['v0'], say: 'A <b>chart</b> ships default values. They are the lowest layer.', p: [['k', '# charts/orders/values.yaml'], ['', 'replicaCount: 2'], ['', 'image: { repository: registry.example.com/orders, tag: "1.0" }'], ['', 'resources: { requests: { cpu: 250m, memory: 1Gi }, limits: { memory: 1Gi } }']] },
        { on: ['v0', 'v1'], e: [1], say: 'Each <code>-f</code> file is merged over the previous ones, <b>later wins</b>. Maps merge key by key; <b>lists are replaced as a whole</b>, so overriding one env var in a list means repeating the whole list.', p: [['k', '# values-prod.yaml'], ['', 'replicaCount: 4'], ['', 'resources: { limits: { memory: 2Gi } }    # requests.cpu etc. kept from defaults']] },
        { on: ['v2'], e: [2], say: '<code>--set</code> beats every file. Careful with types: <code>--set image.tag=1.10</code> is parsed as the number 1.1. Use <code>--set-string</code> or quote tags in a values file.', p: [['k', '$ helm upgrade --install orders ./charts/orders -n shop \\'], ['k', '    -f values-prod.yaml --set image.tag=7.2']] },
        { on: ['mv'], e: [0, 1, 2], say: 'The result is one merged <code>.Values</code> tree. <code>helm get values orders</code> shows what you supplied; add <code>--all</code> to include the chart defaults.', p: [['', 'replicaCount: 4            ← values-prod.yaml'], ['', 'image.tag: "7.2"           ← --set'], ['', 'resources.limits.memory: 2Gi   requests.cpu: 250m ← defaults']] },
        { on: ['mv', 'tp', 'rd'], e: [3, 4], say: 'Templates are Go templates with Sprig functions. Helm knows nothing about YAML while rendering: it produces text, so indentation bugs (<code>toYaml | nindent 12</code>) are a classic failure.', p: [['k', 'spec:'], ['k', '  replicas: {{ .Values.replicaCount }}'], ['k', '  template:'], ['k', '    spec:'], ['k', '      containers:'], ['k', '      - image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"']] },
        { on: ['rd', 'mf'], e: [5], say: '<code>helm template</code> stops here: plain manifests, nothing touches the cluster. Argo CD and Flux’s helm-controller render charts like this and then apply them, so render locally in CI to review the real diff.', p: [['', 'spec:'], ['', '  replicas: 4'], ['', '  ...'], ['', '      - image: "registry.example.com/orders:7.2"']] },
        { on: ['mf', 'api'], e: [6], say: '<code>helm upgrade</code> applies each object with a <b>three-way merge</b>: the previous release’s manifest, the new one and the live object. A field someone changed by hand and the chart doesn’t mention survives; one the chart sets is overwritten.' },
        { on: ['api', 'rel'], e: [7], say: 'Helm 3 stores every revision as a <b>Secret</b> in the release namespace (no Tiller). <code>helm history</code> lists them; <code>helm rollback orders 6</code> re-applies revision 6’s manifest as a new revision 8. Hooks (e.g. a pre-upgrade migration Job) run around it.', tone: 'ok', done: true, p: [['k', '$ helm history orders -n shop'], ['', 'REVISION  STATUS      CHART         APP VERSION'], ['', '6         superseded  orders-3.1.0  7.1'], ['o', '7         deployed    orders-3.2.0  7.2']] }
      ] },
    kust: { l: 'Kustomize: base + overlays',
      boxes: {
        base: [10, 88, 190, 64, 'base/', ['deployment.yaml service.yaml', 'kustomization.yaml']],
        stg: [240, 20, 190, 56, 'overlays/staging', ['replicas: 2', 'configMapGenerator: LOG=debug']],
        prd: [240, 160, 190, 56, 'overlays/prod', ['replicas: 6 · images: 7.2', 'patches: memory 2Gi']],
        bld: [470, 88, 120, 64, 'kustomize build', ['kubectl apply -k', '(no templates)']],
        out: [612, 88, 138, 64, 'final manifests', ['ConfigMap app-config-', 'k2f7h9c4mb (hash)']]
      },
      edges: [['base', 'stg'], ['base', 'prd'], ['stg', 'bld'], ['prd', 'bld'], ['bld', 'out']],
      steps: [
        { on: ['base'], say: 'Kustomize starts from a <b>base</b>: ordinary, valid YAML you could apply as is. No placeholders, no template language.', p: [['k', '# base/kustomization.yaml'], ['', 'resources: [deployment.yaml, service.yaml]'], ['', 'labels: [{ pairs: { app: orders }, includeSelectors: true }]']] },
        { on: ['base', 'prd'], e: [1], say: 'An <b>overlay</b> references the base and declares changes: replica counts, image tags, and patches (strategic-merge or JSON 6902) for anything else.', p: [['k', '# overlays/prod/kustomization.yaml'], ['', 'resources: [../../base]'], ['', 'replicas: [{ name: orders, count: 6 }]'], ['', 'images: [{ name: registry.example.com/orders, newTag: "7.2" }]'], ['', 'patches: [{ path: memory.yaml }]']] },
        { on: ['base', 'stg'], e: [0], say: 'A <b>configMapGenerator</b> builds a ConfigMap from files or literals and appends a hash of its content to the name, rewriting every reference. Change a value → new name → the Pod template changes → a rolling restart, automatically.', p: [['k', 'configMapGenerator:'], ['', '- name: app-config'], ['', '  literals: [LOG_LEVEL=debug]']] },
        { on: ['prd', 'bld'], e: [3], say: '<code>kustomize build overlays/prod</code> (or <code>kubectl apply -k</code>, which embeds Kustomize) merges base and overlay into final YAML. Strategic merge patches understand Kubernetes lists: containers are matched by <code>name</code>, not replaced.' },
        { on: ['bld', 'out'], e: [4], say: 'The output is plain manifests, ready to apply or to commit to a “rendered” branch. Common pattern: Helm for third-party software (with its values), Kustomize for your own services, or Kustomize on top of a rendered chart for last-mile patches.', tone: 'ok', done: true, p: [['', 'kind: Deployment  metadata.name: orders  spec.replicas: 6'], ['', 'image: registry.example.com/orders:7.2   memory limit: 2Gi'], ['o', 'envFrom.configMapRef.name: app-config-k2f7h9c4mb']] }
      ] },
    gitops: { l: 'GitOps: reconcile & drift',
      boxes: {
        git: [10, 26, 175, 56, 'Git: envs/prod', ['commit c3f9 · tag 7.3']],
        ctl: [235, 26, 195, 56, 'Argo CD / Flux', ['poll (~3 min) or webhook']],
        ren: [480, 26, 140, 56, 'render', ['helm / kustomize']],
        dif: [480, 150, 140, 56, 'diff', ['desired vs live']],
        liv: [235, 150, 195, 56, 'live cluster', ['Deployment orders']],
        hum: [10, 150, 175, 56, 'on-call engineer', ['kubectl edit / scale']]
      },
      edges: [['git', 'ctl'], ['ctl', 'ren'], ['ren', 'dif'], ['liv', 'dif', 'watch', -12], ['dif', 'liv', 'sync (apply)', 12], ['hum', 'liv']],
      steps: [
        { on: ['git'], st: 'Synced', t: ['7.3', '7.2', '4', '4', '–', '–'], say: 'Desired state lives in <b>Git</b>. A pull request bumps the image tag to 7.3 and is merged. That merge is the deployment: reviewed, versioned, revertible.', p: [] },
        { on: ['git', 'ctl'], e: [0], st: 'Synced', t: ['7.3', '7.2', '4', '4', '–', '–'], say: 'The <b>controller</b> in the cluster notices the new commit: it polls the repo (Argo CD’s default is about every 3 minutes) or gets a webhook. It pulls; nothing pushes into the cluster from CI, so CI needs no cluster credentials.' },
        { on: ['ctl', 'ren'], e: [1], st: 'Synced', t: ['7.3', '7.2', '4', '4', '–', '–'], say: 'It <b>renders</b> the source (Helm chart + values, a Kustomize overlay, or plain YAML) into desired manifests.' },
        { on: ['ren', 'dif', 'liv'], e: [2, 3], st: 'OutOfSync', t: ['7.3', '7.2', '4', '4', '–', '–'], say: 'It <b>diffs</b> desired against live, ignoring defaulted fields. The image differs: the app is <b>OutOfSync</b>.' },
        { on: ['dif', 'liv'], e: [4], st: 'Synced', t: ['7.3', '7.3', '4', '4', '–', '–'], say: 'With automated sync it <b>applies</b> the change (server-side apply or kubectl-style apply). The Deployment rolls out; the app is <b>Synced</b> and, once all Pods are ready, <b>Healthy</b>.', tone: 'ok' },
        { on: ['hum', 'liv'], e: [5], bad: ['liv'], st: 'Synced', t: ['7.3', '7.3', '4', '10', '–', 'DEBUG=true'], say: 'Incident at night: on-call runs <code>kubectl scale --replicas=10</code> and <code>kubectl set env … DEBUG=true</code> to investigate. The live state now <b>drifts</b> from Git.', tone: 'warn' },
        { on: ['liv', 'dif'], e: [3], bad: ['dif'], st: 'OutOfSync', t: ['7.3', '7.3', '4', '10', '–', 'DEBUG=true'], say: 'The controller watches live objects too. The next comparison shows <b>OutOfSync</b>: replicas 10 ≠ 4, env DEBUG not in Git.', tone: 'warn' },
        { on: ['dif', 'liv'], e: [4], st: 'Synced', t: ['7.3', '7.3', '4', '4', '–', '–'], say: 'With <b>self-heal</b> on, it re-applies Git and reverts both changes, maybe in the middle of the investigation. Without it, the app stays OutOfSync and alerts. Either way the lesson is the same: in GitOps, the fix is a commit.', tone: 'ok' },
        { on: ['git', 'liv'], st: 'Synced', t: ['7.3', '7.3', '(none)', '4–12 (HPA)', '–', '–'], say: 'Fields owned by another controller cause permanent drift: an HPA changes <code>spec.replicas</code> all day. Remove <code>replicas</code> from the manifest (and from the Helm chart when autoscaling is on), or tell the tool to ignore it (<code>ignoreDifferences</code> in Argo CD).', tone: 'ok', done: true }
      ] }
  };
  let mode = 'helm'; let k = 0; let gen = 0; let running = false; let speed = 3200;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const W = 760; const H = 340;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Helm, Kustomize and GitOps pipelines' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('k8hg');
  root.append(el('div', { class: 'w-controls' }, seg(Object.entries(MODES).map(([v, m]) => [v, m.l]), mode, (v) => { mode = v; reset(); }, 'Mode')),
    el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg([[4400, 'Slow'], [3200, 'Normal'], [1600, 'Fast']], speed, (v) => { speed = v; }, 'Speed')), narr);
  const say = (h, tone) => { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function edgePath(A, B, dy) {
    const [ax, ay, aw, ah] = A; const [bx, by, bw, bh] = B; const o = dy || 0;
    if (bx >= ax + aw) { const x1 = ax + aw; const y1 = ay + ah / 2 + o; const x2 = bx; const y2 = by + bh / 2 + o; return [`M${x1} ${y1} C ${x1 + 30} ${y1}, ${x2 - 30} ${y2}, ${x2} ${y2}`, (x1 + x2) / 2, (y1 + y2) / 2]; }
    if (bx + bw <= ax) { const x1 = ax; const y1 = ay + ah / 2 + o; const x2 = bx + bw; const y2 = by + bh / 2 + o; return [`M${x1} ${y1} C ${x1 - 30} ${y1}, ${x2 + 30} ${y2}, ${x2} ${y2}`, (x1 + x2) / 2, (y1 + y2) / 2]; }
    const down = by > ay; const x1 = ax + aw / 2 + (o ? 30 * o : 0); const y1 = down ? ay + ah : ay; const x2 = bx + bw / 2 + (o ? 30 * o : 0); const y2 = down ? by : by + bh;
    return [`M${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`, (x1 + x2) / 2, (y1 + y2) / 2];
  }
  function draw(s) {
    const M = MODES[mode]; stage.innerHTML = '';
    M.edges.forEach(([a, b, lab, dy], i) => {
      const on = (s.e || []).includes(i); const bad = on && s.bad && s.bad.includes(b);
      const [d, mx, my] = edgePath(M.boxes[a], M.boxes[b], dy);
      stage.append(svg('path', { class: 'ed' + (on ? (bad ? ' bad' : ' on') + (reduced ? '' : ' anim') : ''), d }));
      if (lab) stage.append(svg('text', { class: 'el', x: mx, y: my + (dy < 0 ? -6 : 14), 'text-anchor': 'middle', text: lab }));
    });
    Object.entries(M.boxes).forEach(([id, [x, y, w, h, t, sub]]) => {
      const cls = s.bad && s.bad.includes(id) ? 'bad' : s.on.includes(id) ? (s.done ? 'good' : 'on') : 'dim';
      stage.append(svg('rect', { class: 'bx ' + cls, x, y, width: w, height: h, rx: 9 }), svg('text', { class: 'bt', x: x + 10, y: y + 18, text: t }));
      sub.forEach((ln, j) => stage.append(svg('text', { class: 'bs', x: x + 10, y: y + 33 + j * 12, text: ln })));
    });
    if (mode === 'gitops') {
      const sync = s.st === 'Synced';
      stage.append(svg('rect', { class: 'pn', x: 640, y: 26, width: 110, height: 56, rx: 9 }),
        svg('text', { class: 'bs', x: 695, y: 46, 'text-anchor': 'middle', text: 'app status' }),
        svg('text', { class: 'pill', x: 695, y: 68, 'text-anchor': 'middle', fill: sync ? 'var(--ok)' : 'var(--err)', text: s.st }));
      const y0 = 230; const rows = [['field', 'Git (desired)', 'live'], ['image tag', s.t[0], s.t[1]], ['replicas', s.t[2], s.t[3]], ['env DEBUG', s.t[4], s.t[5]]];
      stage.append(svg('rect', { class: 'pn', x: 10, y: y0, width: 740, height: 100, rx: 9 }));
      rows.forEach((r, i) => {
        const diff = i > 0 && r[1] !== r[2] && !(r[1] === '(none)');
        [[24, r[0]], [240, r[1]], [480, r[2]]].forEach(([x, v], j) => stage.append(svg('text', { class: 'pl' + (i === 0 ? ' m' : j === 2 && diff ? ' e' : ''), x, y: y0 + 22 + i * 22, text: v })));
        if (diff) stage.append(svg('text', { class: 'pl e', x: 736, y: y0 + 22 + i * 22, 'text-anchor': 'end', text: 'drift' }));
      });
      return;
    }
    const P = s.p || []; const y0 = 252;
    stage.append(svg('rect', { class: 'pn', x: 10, y: y0, width: 740, height: 82, rx: 9 }));
    P.slice(0, 6).forEach(([c, t], i) => stage.append(svg('text', { class: 'pl' + (c ? ' ' + c : ''), x: 22, y: y0 + 18 + i * 13, text: t })));
    if (!P.length) stage.append(svg('text', { class: 'pl m', x: 22, y: y0 + 22, text: '…' }));
  }
  let lastP = [];
  const steps = () => MODES[mode].steps;
  function show(s) { if (s.p) lastP = s.p; draw(Object.assign({}, s, { p: s.p || lastP })); say(s.say, s.tone); }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; lastP = []; bStep.disabled = false; show(steps()[k++]); }
  function step() { if (k >= steps().length) return false; show(steps()[k++]); if (k >= steps().length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps().length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    if (reduced) { while (g === gen && step()); } else while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

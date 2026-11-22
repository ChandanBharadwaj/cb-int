/* Operators & CRDs: a custom resource through API validation and admission into etcd, then the operator's watch → queue → reconcile loop, owner references, drift repair and finalizer-guarded deletion. */
IA.widget('operators-crds', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8op-style')) {
    document.head.append(el('style', { id: 'w-k8op-style', text: `
.k8op svg text { font-family: var(--sans); }
.k8op .bx { fill: var(--surface); stroke: var(--border); stroke-width: 1.4; transition: all .3s; }
.k8op .bx.on { stroke: var(--accent); stroke-width: 2.8; fill: var(--accent-soft); }
.k8op .bx.bad { stroke: var(--err); stroke-width: 2.8; fill: color-mix(in srgb, var(--err) 12%, var(--surface)); }
.k8op .bx.good { stroke: var(--ok); stroke-width: 2.8; fill: color-mix(in srgb, var(--ok) 12%, var(--surface)); }
.k8op .bx.gone { stroke-dasharray: 5 4; opacity: .35; }
.k8op .bx.dim { opacity: .45; }
.k8op .bt { font-size: 12px; font-weight: 700; fill: var(--text); }
.k8op .bs { font-size: 10px; fill: var(--text-2); font-family: var(--mono); }
.k8op .zone { fill: none; stroke: var(--text-3); stroke-dasharray: 4 5; }
.k8op .zl { font-size: 10px; fill: var(--text-3); font-family: var(--mono); }
.k8op .ed { stroke: var(--border); stroke-width: 1.5; fill: none; }
.k8op .ed.on { stroke: var(--accent); stroke-width: 2.8; stroke-dasharray: 7 6; }
.k8op .ed.on.anim { animation: k8opflow .9s linear infinite; }
.k8op .ed.bad { stroke: var(--err); stroke-width: 2.8; stroke-dasharray: 7 6; }
.k8op .el { font-size: 9.5px; fill: var(--text-3); font-family: var(--mono); }
.k8op .pn { fill: var(--surface-2); stroke: var(--border); }
.k8op .pl { font-size: 11px; fill: var(--text); font-family: var(--mono); }
.k8op .pl.k { fill: var(--accent); } .k8op .pl.e { fill: var(--err); } .k8op .pl.o { fill: var(--ok); } .k8op .pl.m { fill: var(--text-3); }
@keyframes k8opflow { to { stroke-dashoffset: -26; } }
` }));
  }
  const BOX = {
    usr: [10, 26, 135, 50, 'kubectl / Git', ['PostgresCluster']],
    api: [180, 26, 200, 50, 'API server', ['schema · CEL · webhooks']],
    etcd: [180, 112, 200, 46, 'etcd', ['the CR object']],
    inf: [420, 26, 150, 50, 'informer', ['watch + local cache']],
    q: [600, 26, 150, 50, 'work queue', ['key: shop/main-db']],
    rec: [420, 112, 330, 46, 'Reconcile(ctx, req)', ['observe → compare → act → write status']],
    ext: [180, 192, 200, 46, 'backup bucket', ['outside the cluster']],
    sts: [420, 192, 104, 46, 'StatefulSet', ['ownerRef → CR']],
    svc: [533, 192, 104, 46, 'Service', ['ownerRef → CR']],
    sec: [646, 192, 104, 46, 'Secret', ['ownerRef → CR']]
  };
  const EDGES = { a: ['usr', 'api'], b: ['api', 'etcd'], c: ['etcd', 'inf', 'watch'], d: ['inf', 'q', 'enqueue key'], e: ['q', 'rec'], f: ['rec', 'ext'], g: ['rec', 'sts'], h: ['rec', 'svc'], i: ['rec', 'sec'], j: ['rec', 'etcd', 'status'] };
  const CR = (o) => [['k', 'apiVersion: db.example.com/v1  kind: PostgresCluster  name: main-db'], ['', `metadata.generation: ${o.gen || 1}   finalizers: ${o.fin || '[]'}`], [o.del ? 'e' : 'm', `metadata.deletionTimestamp: ${o.del || '(none)'}`], ['', `spec.replicas: ${o.rep || 3}   spec.backup.bucket: s3://backups/main-db`], [o.ready ? 'o' : '', `status.observedGeneration: ${o.obs || '(none)'}   conditions: ${o.cond || '(none)'}`]];
  const SC = {
    create: { l: 'Create', steps: [
      { on: ['usr', 'api'], e: ['a'], gone: ['sts', 'svc', 'sec', 'ext'], p: CR({ obs: '', cond: '' }), say: 'You apply a <code>PostgresCluster</code>. The CRD taught the API server this type: it validates the object against the CRD’s <b>OpenAPI schema</b> and any <b>CEL rules</b> (<code>x-kubernetes-validations</code>), applies schema defaults, then runs mutating and validating <b>admission webhooks</b> if the operator registered any.' },
      { on: ['api', 'etcd'], e: ['b'], gone: ['sts', 'svc', 'sec', 'ext'], p: CR({}), say: 'Stored in etcd, <code>generation: 1</code>. Nothing else happens yet. A CRD alone is just data: without a controller, a custom resource is a typed config file.' },
      { on: ['etcd', 'inf'], e: ['c'], gone: ['sts', 'svc', 'sec', 'ext'], p: CR({}), say: 'The operator’s <b>informer</b> holds a watch on PostgresClusters (and on the object kinds it owns). It receives an ADDED event and updates its local cache.' },
      { on: ['inf', 'q'], e: ['d'], gone: ['sts', 'svc', 'sec', 'ext'], p: CR({}), say: 'The event handler puts only a <b>key</b> (<code>shop/main-db</code>) on a rate-limited work queue. Many events for the same object collapse into one key: the operator will act on the latest state, not on each event.' },
      { on: ['q', 'rec', 'etcd'], e: ['e', 'j'], gone: ['sts', 'svc', 'sec', 'ext'], p: CR({ fin: '[db.example.com/cleanup]' }), say: 'A worker calls <b>Reconcile</b>. It reads the CR from the cache. First action: add a <b>finalizer</b>, before creating anything outside the cluster, so that deletion will wait for cleanup.' },
      { on: ['rec', 'ext'], e: ['f'], gone: ['sts', 'svc', 'sec'], p: CR({ fin: '[db.example.com/cleanup]' }), say: 'It creates the external backup bucket. Garbage collection can’t clean that up later, because it is not a Kubernetes object; this is exactly what the finalizer is for.' },
      { on: ['rec', 'sts', 'svc', 'sec'], e: ['g', 'h', 'i'], p: CR({ fin: '[db.example.com/cleanup]' }), say: 'It creates the StatefulSet, Service and credentials Secret, each with an <b>ownerReference</b> (<code>controller: true</code>) pointing at the CR. Writes are idempotent (create-or-update, or server-side apply), because Reconcile may run many times for the same state.' },
      { on: ['rec', 'etcd'], e: ['j'], p: CR({ fin: '[db.example.com/cleanup]', obs: '1', cond: 'Ready=False (Progressing)' }), say: 'It writes <b>status</b> through the <code>/status</code> subresource: <code>observedGeneration: 1</code> and a <code>Progressing</code> condition, then returns. When the StatefulSet’s Pods become ready, that owned-object event triggers another reconcile.' },
      { on: ['sts', 'inf', 'rec', 'etcd'], e: ['c', 'j'], p: CR({ fin: '[db.example.com/cleanup]', obs: '1', cond: 'Ready=True', ready: true }), say: 'Second pass: everything matches the spec, so the only write is <code>Ready=True</code>. Users and tools (<code>kubectl wait --for=condition=Ready</code>, Argo CD health checks) read the status, not the operator’s logs.', tone: 'ok', done: true }
    ] },
    drift: { l: 'Drift & spec change', steps: [
      { on: ['svc'], bad: ['svc'], p: CR({ fin: '[db.example.com/cleanup]', obs: '1', cond: 'Ready=True', ready: true }), say: 'Someone deletes the operator’s Service by mistake.' },
      { on: ['svc', 'inf', 'q'], e: ['d'], gone: ['svc'], p: CR({ fin: '[db.example.com/cleanup]', obs: '1', cond: 'Ready=True', ready: true }), say: 'The informer watching Services sees the DELETED event. The handler follows the ownerReference to the owner and enqueues <code>shop/main-db</code>.' },
      { on: ['q', 'rec', 'svc'], e: ['e', 'h'], p: CR({ fin: '[db.example.com/cleanup]', obs: '1', cond: 'Ready=True', ready: true }), say: 'Reconcile is <b>level-triggered</b>: it doesn’t ask “what event happened?”, it compares desired with actual. The Service is missing, so it creates it again. The same code path handles a missed event, an operator restart and a human mistake.' },
      { on: ['usr', 'api', 'etcd'], e: ['a', 'b'], p: CR({ fin: '[db.example.com/cleanup]', gen: 2, rep: 5, obs: '1', cond: 'Ready=True' }), say: 'Now a user changes <code>spec.replicas</code> from 3 to 5. Spec changes bump <code>metadata.generation</code> to 2; status updates never do, because status is a subresource.' },
      { on: ['etcd', 'inf', 'q', 'rec', 'sts'], e: ['c', 'd', 'e', 'g'], p: CR({ fin: '[db.example.com/cleanup]', gen: 2, rep: 5, obs: '1', cond: 'Ready=True' }), say: 'Reconcile patches the StatefulSet to 5 replicas. A real database operator would add replicas one at a time and wait for replication; that domain knowledge is the reason operators exist.' },
      { on: ['rec', 'etcd'], e: ['j'], p: CR({ fin: '[db.example.com/cleanup]', gen: 2, rep: 5, obs: '2', cond: 'Ready=True', ready: true }), say: '<code>observedGeneration: 2</code> tells clients the status describes the current spec. A status with an older observedGeneration is stale, whatever its conditions say.', tone: 'ok', done: true }
    ] },
    del: { l: 'Delete with finalizer', steps: [
      { on: ['usr', 'api', 'etcd'], e: ['a', 'b'], p: CR({ fin: '[db.example.com/cleanup]', del: '2026-11-22T09:14:03Z', obs: '1', cond: 'Ready=True' }), say: '<code>kubectl delete postgrescluster main-db</code>. Because <code>finalizers</code> is not empty, the API server does <b>not</b> remove the object. It sets <code>deletionTimestamp</code> and the object becomes read-only, except for removing finalizers.' },
      { on: ['etcd', 'inf', 'q', 'rec'], e: ['c', 'd', 'e'], p: CR({ fin: '[db.example.com/cleanup]', del: '2026-11-22T09:14:03Z', obs: '1', cond: 'Ready=True' }), say: 'That update triggers a reconcile. The operator sees <code>deletionTimestamp != nil</code> and runs its cleanup branch instead of the normal one.' },
      { on: ['rec', 'ext'], e: ['f'], p: CR({ fin: '[db.example.com/cleanup]', del: '2026-11-22T09:14:03Z', obs: '1', cond: 'Terminating' }), say: 'Cleanup of things outside the cluster: take a final backup, delete or archive the bucket, deregister DNS. If it fails, return an error and the queue retries with back-off; the finalizer keeps the object alive.' },
      { on: ['rec', 'etcd'], e: ['j'], gone: ['ext'], p: CR({ fin: '[]', del: '2026-11-22T09:14:03Z', obs: '1', cond: 'Terminating' }), say: 'Done: the operator removes <b>its own</b> finalizer with a patch. With the list empty and a deletionTimestamp set, the API server deletes the object.' },
      { on: ['sts', 'svc', 'sec'], gone: ['ext', 'sts', 'svc', 'sec'], p: [['m', '(PostgresCluster main-db no longer exists)'], ['', 'garbage collector: StatefulSet, Service, Secret have ownerReferences'], ['', '→ owner is gone → delete dependents (background cascading deletion)']], say: 'The <b>garbage collector</b> finds objects whose owner no longer exists and deletes them. Owner references handle in-cluster children; finalizers handle everything else.', tone: 'ok', done: true }
    ] },
    stuck: { l: 'Stuck finalizer', steps: [
      { on: ['rec'], bad: ['rec', 'inf', 'q'], p: CR({ fin: '[db.example.com/cleanup]', obs: '1', cond: 'Ready=True' }), say: 'The team uninstalls the operator (its Deployment is deleted) but leaves the CRs in place.' },
      { on: ['usr', 'api', 'etcd'], e: ['a', 'b'], bad: ['rec', 'inf', 'q'], p: CR({ fin: '[db.example.com/cleanup]', del: '2026-11-22T10:02:41Z', obs: '1', cond: 'Ready=True' }), say: 'Later someone runs <code>kubectl delete ns shop</code>. The namespace controller deletes everything inside; the CR gets a deletionTimestamp…' },
      { on: ['etcd'], bad: ['rec', 'inf', 'q', 'etcd'], p: CR({ fin: '[db.example.com/cleanup]', del: '2026-11-22T10:02:41Z', obs: '1', cond: 'Ready=True' }).concat([['e', 'namespace shop: Terminating · NamespaceFinalizersRemaining: db.example.com/cleanup in 1 resource']]), say: '…but nobody will ever remove the finalizer. The CR stays forever, and the namespace stays <b>Terminating</b> with a condition naming the finalizer. A CRD can’t be deleted cleanly either while its CRs remain.', tone: 'err' },
      { on: ['rec', 'etcd'], e: ['j'], p: [['k', '# best: reinstall the operator so it can clean up, then delete again'], ['k', '# last resort, knowing the bucket will leak:'], ['', 'kubectl patch postgrescluster main-db -n shop --type=merge -p \'{"metadata":{"finalizers":null}}\''], ['m', '# then delete the external resources by hand']], say: 'Fix in order of preference: reinstall the operator and let it finish; or remove the finalizer by hand and clean up the external resources yourself. Uninstall runbooks should delete CRs <i>before</i> removing the operator.', tone: 'ok', done: true }
    ] }
  };
  let mode = 'create'; let k = 0; let gen = 0; let running = false; let speed = 3200;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const W = 760; const H = 342;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Custom resource, API server, etcd and operator reconcile loop' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('k8op');
  root.append(el('div', { class: 'w-controls' }, seg(Object.entries(SC).map(([v, s]) => [v, s.l]), mode, (v) => { mode = v; reset(); }, 'Scenario')),
    el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg([[4400, 'Slow'], [3200, 'Normal'], [1600, 'Fast']], speed, (v) => { speed = v; }, 'Speed')), narr);
  const say = (h, tone) => { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function edgePath(A, B) {
    const [ax, ay, aw, ah] = A; const [bx, by, bw, bh] = B;
    if (bx >= ax + aw) { const x1 = ax + aw; const y1 = ay + ah / 2; const x2 = bx; const y2 = by + bh / 2; return [`M${x1} ${y1} C ${x1 + 25} ${y1}, ${x2 - 25} ${y2}, ${x2} ${y2}`, (x1 + x2) / 2, Math.min(y1, y2) - 4]; }
    if (bx + bw <= ax) { const x1 = ax; const y1 = ay + ah / 2; const x2 = bx + bw; const y2 = by + bh / 2; return [`M${x1} ${y1} C ${x1 - 25} ${y1}, ${x2 + 25} ${y2}, ${x2} ${y2}`, (x1 + x2) / 2, Math.max(y1, y2) + 12]; }
    const down = by > ay; const cx1 = Math.max(ax, bx) + Math.min(ax + aw, bx + bw); const x = cx1 / 2;
    const y1 = down ? ay + ah : ay; const y2 = down ? by : by + bh;
    return [`M${x} ${y1} L${x} ${y2}`, x + 6, (y1 + y2) / 2 + 3];
  }
  function draw(s) {
    stage.innerHTML = '';
    stage.append(svg('rect', { class: 'zone', x: 405, y: 6, width: 352, height: 160, rx: 10 }), svg('text', { class: 'zl', x: 412, y: 18, text: 'operator Pod (controller-runtime / Java Operator SDK)' }));
    Object.entries(EDGES).forEach(([id, [a, b, lab]]) => {
      const on = (s.e || []).includes(id); const bad = on && s.bad && s.bad.includes(b);
      const [d, lx, ly] = edgePath(BOX[a], BOX[b]);
      stage.append(svg('path', { class: 'ed' + (on ? (bad ? ' bad' : ' on') + (reduced ? '' : ' anim') : ''), d }));
      if (lab && on) stage.append(svg('text', { class: 'el', x: lx, y: ly, 'text-anchor': id === 'j' ? 'middle' : 'start', text: lab }));
    });
    Object.entries(BOX).forEach(([id, [x, y, w, h, t, sub]]) => {
      let cls = 'dim';
      if (s.gone && s.gone.includes(id)) cls = 'gone';
      else if (s.bad && s.bad.includes(id)) cls = 'bad';
      else if (s.on.includes(id)) cls = s.done ? 'good' : 'on';
      stage.append(svg('rect', { class: 'bx ' + cls, x, y, width: w, height: h, rx: 9 }), svg('text', { class: 'bt', x: x + 9, y: y + 18, text: t }));
      sub.forEach((ln, j) => stage.append(svg('text', { class: 'bs', x: x + 9, y: y + 33 + j * 12, text: ln })));
    });
    const y0 = 252; const P = s.p || [];
    stage.append(svg('rect', { class: 'pn', x: 10, y: y0, width: 740, height: 86, rx: 9 }));
    P.slice(0, 6).forEach(([c, t], i) => stage.append(svg('text', { class: 'pl' + (c ? ' ' + c : ''), x: 22, y: y0 + 17 + i * 13.5, text: t })));
  }
  const steps = () => SC[mode].steps;
  function show(s) { draw(s); say(s.say, s.tone); }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; bStep.disabled = false; show(steps()[k++]); }
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

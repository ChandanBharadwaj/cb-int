/* Desired state: a ReplicaSet reconcile loop (observe → diff → act) reacting to pod deletion, scaling, relabelling, adoption, a git apply, and owner deletion with background/foreground/orphan propagation. */
IA.widget('desired-state', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8ds-style')) {
    document.head.append(el('style', { id: 'w-k8ds-style', text: `
.k8ds svg text { font-family: var(--sans); }
.k8ds .pn rect.f { fill: var(--surface-2); stroke: var(--border); }
.k8ds .h { fill: var(--text); font-weight: 700; font-size: 13px; }
.k8ds .m { fill: var(--text-2); font-size: 11.5px; font-family: var(--mono); }
.k8ds .m.hl { fill: var(--accent); font-weight: 700; }
.k8ds .m.del { fill: var(--err); }
.k8ds .ring { fill: none; stroke: var(--border); stroke-width: 10; }
.k8ds .ring.on { stroke: color-mix(in srgb, var(--accent) 30%, var(--surface-2)); }
.k8ds .stg { font-size: 11.5px; font-weight: 700; fill: var(--text-3); }
.k8ds .stg.on { fill: var(--accent); }
.k8ds .dot { fill: var(--accent); }
.k8ds .diff { font-size: 20px; font-weight: 800; fill: var(--text); font-family: var(--mono); }
.k8ds .pod rect { fill: var(--surface); stroke: var(--ok); stroke-width: 1.6; transition: opacity .5s; }
.k8ds .pod.new rect { stroke: var(--accent); fill: var(--accent-soft); stroke-width: 2.2; }
.k8ds .pod.del rect { stroke: var(--err); stroke-dasharray: 4 3; }
.k8ds .pod.del { opacity: .45; }
.k8ds .pod.orphan rect { stroke: var(--warn); stroke-dasharray: 5 3; }
.k8ds .pod text { font-size: 10.5px; fill: var(--text); font-family: var(--mono); }
.k8ds .pod text.o { fill: var(--text-3); }
.k8ds .pod.orphan text.o { fill: var(--warn); }
.k8ds .cmd { font-family: var(--mono); font-size: 12px; fill: var(--k-compute); }
` }));
  }
  let pol = 'background'; let gen = 0; let running = false; let speed = 2600; let k = 0; let steps = []; let W;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segD = seg([['background', 'Background'], ['foreground', 'Foreground'], ['orphan', 'Orphan']], () => pol, (v) => { pol = v; reset(); }, 'Deletion propagation');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1300, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const stage = svg('svg', { viewBox: '0 0 760 360', role: 'img', 'aria-label': 'Desired spec on the left, reconcile loop in the middle, actual pods on the right' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('k8ds');
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'kubectl delete rs propagation' }), segD), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);

  // static parts
  const specG = svg('g', { class: 'pn' }); const podsG = svg('g'); const cmdT = svg('text', { class: 'cmd', x: 16, y: 344, text: '' });
  const CX = 318, CY = 160, R = 74;
  const ring = svg('circle', { class: 'ring', cx: CX, cy: CY, r: R });
  const stg = ['observe', 'diff', 'act'].map((t, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 3; return svg('text', { class: 'stg', x: CX + Math.cos(a) * (R + 20) - 20, y: CY + Math.sin(a) * (R + 20) + 4, text: t }); });
  const diffT = svg('text', { class: 'diff', x: CX, y: CY + 2, 'text-anchor': 'middle', text: '0' });
  const diffS = svg('text', { class: 'm', x: CX, y: CY + 22, 'text-anchor': 'middle', text: 'in sync' });
  const dot = svg('circle', { class: 'dot', r: 7, cx: CX, cy: CY - R });
  stage.append(svg('rect', { x: 452, y: 14, width: 296, height: 312, rx: 12, fill: 'var(--surface-2)', stroke: 'var(--border)' }), svg('text', { class: 'h', x: 466, y: 36, text: 'Actual: pods in namespace shop' }),
    specG, ring, ...stg, diffT, diffS, dot, podsG, cmdT);

  const mkPod = (n, o) => ({ n, lab: 'app=web', owner: 'rs/web-7c9', st: o || '' });
  function fresh() { return { rep: 3, rsAlive: true, rsDeleting: false, src: 'git: replicas: 3', pods: ['a', 'b', 'c'].map((x) => mkPod('web-7c9-' + x)), hl: '', diff: 0, diffNote: 'in sync', cmd: '' }; }
  const matching = () => W.pods.filter((p) => p.lab === 'app=web' && p.st !== 'del' && p.st !== 'gone');
  function draw() {
    specG.innerHTML = '';
    specG.append(svg('rect', { class: 'f', x: 12, y: 14, width: 200, height: 312, rx: 12 }), svg('text', { class: 'h', x: 26, y: 36, text: 'Desired: ReplicaSet' }));
    const lines = W.rsAlive ? [['name: web-7c9', ''], [`replicas: ${W.rep}`, W.hl === 'rep' ? 'hl' : ''], ['selector:', ''], ['  app=web', W.hl === 'sel' ? 'hl' : ''], ['owner: deploy/web', ''], ['', ''], [W.src, W.hl === 'src' ? 'hl' : '']]
      : [['(deleted)', 'del'], ['', ''], ['garbage collector', ''], ['follows ownerRefs', '']];
    if (W.rsDeleting) lines.push(['deletionTimestamp: set', 'del'], ['finalizers:', 'del'], [' foregroundDeletion', 'del']);
    lines.forEach(([t, c], i) => specG.append(svg('text', { class: 'm ' + c, x: 26, y: 62 + i * 20, text: t })));
    podsG.innerHTML = '';
    W.pods.filter((p) => p.st !== 'gone').forEach((p, i) => { const x = 466 + (i % 2) * 140, y = 50 + Math.floor(i / 2) * 66;
      const g = svg('g', { class: 'pod ' + p.st }); g.append(svg('rect', { x, y, width: 130, height: 56, rx: 8 }), svg('text', { x: x + 8, y: y + 17, text: p.n }), svg('text', { x: x + 8, y: y + 32, text: p.lab }), svg('text', { class: 'o', x: x + 8, y: y + 47, text: p.owner ? 'owner: ' + p.owner : 'owner: none' }));
      podsG.append(g); });
    diffT.textContent = W.diff > 0 ? '+' + W.diff : String(W.diff); diffS.textContent = W.diffNote; cmdT.textContent = W.cmd ? '$ ' + W.cmd : '';
    stats.innerHTML = ''; const st = (h) => stats.append(el('span', { class: 'w-stat', html: h }));
    st(`desired <b>${W.rsAlive ? W.rep : '—'}</b>`); st(`matching app=web <b>${matching().length}</b>`); st(`pods running <b>${W.pods.filter((p) => p.st !== 'gone' && p.st !== 'del').length}</b>`);
    st(`unowned <b>${W.pods.filter((p) => !p.owner && p.st !== 'gone').length}</b>`);
  }
  function hiStage(i) { stg.forEach((s, j) => s.setAttribute('class', 'stg' + (j === i ? ' on' : ''))); ring.setAttribute('class', 'ring' + (i >= 0 ? ' on' : '')); }
  async function spin() {
    const g = gen; if (reduced) { hiStage(2); return; }
    const dur = Math.max(900, speed * 0.55); const t0 = performance.now();
    await new Promise((res) => { const f = (t) => { if (g !== gen) return res(); const u = Math.min(1, (t - t0) / dur); const a = -Math.PI / 2 + u * 2 * Math.PI;
      dot.setAttribute('cx', CX + Math.cos(a) * R); dot.setAttribute('cy', CY + Math.sin(a) * R); hiStage(Math.min(2, Math.floor(u * 3))); if (u < 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  }
  let seq = 0; const nn = () => 'web-7c9-' + ['q', 'r', 's', 't', 'u', 'v', 'w'][seq++ % 7];
  // each step: world change (change), then reconcile (rec) after the loop spins
  function plan() {
    const L = [];
    L.push({ cmd: '', change: () => {}, rec: () => { W.diff = 0; W.diffNote = 'in sync'; },
      t: 'Steady state. On each sync the controller <b>observes</b> 3 pods matching <code>app=web</code>, <b>diffs</b> against <code>replicas: 3</code> and finds nothing to <b>act</b> on. Reconcile with no difference is a no-op.' });
    L.push({ cmd: 'kubectl delete pod web-7c9-b   # or a node dies', change: () => { W.pods[1].st = 'del'; }, rec: () => { W.pods[1].st = 'gone'; W.diff = 1; W.diffNote = '3 desired − 2 seen'; W.pods.push(mkPod(nn(), 'new')); },
      t: 'A pod is deleted. The watch says “pods changed”; the controller doesn’t care what happened, only that it now <b>sees 2</b>. Diff +1, so it <b>creates</b> one pod from its template, with an <code>ownerReference</code> to itself.' });
    L.push({ cmd: 'kubectl scale rs web-7c9 --replicas=5', hl: 'rep', change: () => { W.rep = 5; W.src = 'git: replicas: 3  ≠ live'; W.pods.forEach((p) => { if (p.st === 'new') p.st = ''; }); }, rec: () => { W.diff = 2; W.diffNote = '5 desired − 3 seen'; W.pods.push(mkPod(nn(), 'new'), mkPod(nn(), 'new')); },
      t: 'An <b>imperative</b> change to the spec: replicas 5. Same loop, new target: diff +2, two pods created. Note the spec now disagrees with git; that is <b>drift</b>.' });
    L.push({ cmd: 'kubectl label pod web-7c9-a app=debug --overwrite', change: () => { W.pods.forEach((p) => { if (p.st === 'new') p.st = ''; }); W.pods[0].lab = 'app=debug'; }, rec: () => { W.pods[0].owner = ''; W.pods[0].st = 'orphan'; W.diff = 1; W.diffNote = '5 desired − 4 match'; W.pods.push(mkPod(nn(), 'new')); },
      t: 'Someone relabels a pod to debug it. It no longer matches the selector, so the controller <b>releases</b> it (removes its ownerReference) and creates a replacement. The orange pod keeps running, out of the Service, owned by nobody.' });
    L.push({ cmd: 'kubectl run web-manual --image=web:5 -l app=web', change: () => { W.pods.forEach((p) => { if (p.st === 'new') p.st = ''; }); W.pods.push({ n: 'web-manual', lab: 'app=web', owner: '', st: 'new' }); },
      rec: () => { const m = W.pods.find((p) => p.n === 'web-manual'); m.owner = 'rs/web-7c9'; m.st = 'del'; W.diff = -1; W.diffNote = '5 desired − 6 match'; },
      t: 'A bare pod with <code>app=web</code> and no owner appears. The controller <b>adopts</b> it (sets itself as owner), then sees 6 for 5 and deletes one, preferring the newest, not-yet-ready pod: here the one just created.' });
    L.push({ cmd: 'kubectl apply -f web.yaml   # from git, replicas: 3', hl: 'src', change: () => { const m = W.pods.find((p) => p.n === 'web-manual'); m.st = 'gone'; W.rep = 3; W.src = 'git: replicas: 3'; },
      rec: () => { const live = W.pods.filter((p) => p.lab === 'app=web' && p.st !== 'gone'); live.slice(-2).forEach((p) => { p.st = 'del'; }); W.diff = -2; W.diffNote = '3 desired − 5 match'; },
      t: 'CI re-applies the manifest from git. <b>Declarative</b> wins: the spec goes back to 3 and the controller scales down by 2. Your 02:00 <code>kubectl scale</code> is gone: change git, not the cluster.' });
    const delTxt = { background: '<b>Background</b> (kubectl’s default): the ReplicaSet is removed at once; the garbage collector then deletes every pod whose ownerReference points at it. The relabelled orphan survives: it had no owner.',
      foreground: '<b>Foreground</b>: the ReplicaSet stays visible with a <code>deletionTimestamp</code> and the <code>foregroundDeletion</code> finalizer while the garbage collector deletes its pods first. Only then does the owner go.',
      orphan: '<b>Orphan</b>: the ReplicaSet is deleted, but its pods only lose their ownerReference and keep running. A new ReplicaSet with the same selector would adopt them; a Service with <code>app=web</code> still sends them traffic.' };
    L.push({ cmd: `kubectl delete rs web-7c9 --cascade=${pol}`, change: () => { W.pods = W.pods.filter((p) => p.st !== 'del' && p.st !== 'gone'); if (pol === 'foreground') W.rsDeleting = true; else W.rsAlive = false; },
      rec: () => { W.diff = 0; W.diffNote = 'no controller';
        W.pods.forEach((p) => { if (p.owner === 'rs/web-7c9') { if (pol === 'orphan') { p.owner = ''; p.st = 'orphan'; } else p.st = 'del'; } }); },
      t: delTxt[pol] });
    if (pol === 'foreground') L.push({ cmd: '', change: () => { W.pods.forEach((p) => { if (p.st === 'del') p.st = 'gone'; }); }, rec: () => { W.rsAlive = false; W.rsDeleting = false; W.diffNote = 'owner gone'; }, t: 'All dependents are gone, so the garbage collector removes the finalizer and the ReplicaSet disappears. The relabelled pod is still there: always check for unowned leftovers.' });
    else L.push({ cmd: '', change: () => { W.pods.forEach((p) => { if (p.st === 'del') p.st = 'gone'; }); }, rec: () => {}, t: pol === 'orphan' ? 'Count the leftovers: every pod is now unowned. Nothing will ever delete or replace them. That is exactly what you want during a careful migration, and a leak otherwise.' : 'Done. The one survivor is the relabelled pod: no owner, so no garbage collection. Find such pods with a query for empty <code>ownerReferences</code>.' });
    return L;
  }
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; seq = 0; W = fresh(); steps = plan(); hiStage(-1); dot.setAttribute('cx', CX); dot.setAttribute('cy', CY - R); draw(); bStep.disabled = false;
    say('Press Play or Step. Each step first changes the world (the command at the bottom), then runs one reconcile pass. Choose the deletion policy above for the final step.'); }
  async function step() {
    if (k >= steps.length) return false; const s = steps[k++]; const g = gen;
    W.hl = s.hl || ''; W.cmd = s.cmd; s.change(); W.diffNote = 'observing…'; draw(); say(`<b>${k}/${steps.length}</b> · ` + s.t);
    await spin(); if (g !== gen) return false; s.rec(); draw(); hiStage(-1);
    if (k >= steps.length) bStep.disabled = true; return true;
  }
  let busy = false;
  bStep.addEventListener('click', async () => { running = false; bPlay.textContent = '▶ Play'; if (busy) return; busy = true; await step(); busy = false; });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    if (reduced) { while (await step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && await step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

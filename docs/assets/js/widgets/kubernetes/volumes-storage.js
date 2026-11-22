/* Volumes: dynamic provisioning with Immediate vs WaitForFirstConsumer across two zones, attach/mount, then reclaim (Delete vs Retain). */
IA.widget('volumes-storage', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8s-vol-style')) {
    document.head.append(el('style', { id: 'w-k8s-vol-style', text: `
.w-vol .bx { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: all .3s; }
.w-vol .bx.hot { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-soft); }
.w-vol .bx.ok { stroke: var(--ok); stroke-width: 2.5; }
.w-vol .bx.err { stroke: var(--err); stroke-width: 2.5; }
.w-vol .bx.warn { stroke: var(--warn); stroke-width: 2.5; }
.w-vol .bx.ghost { stroke-dasharray: 5 4; opacity: .45; }
.w-vol .zone { fill: none; stroke: var(--border); stroke-dasharray: 6 4; stroke-width: 1.5; }
.w-vol .zl { font: 600 11px var(--mono); fill: var(--text-3); }
.w-vol .ttl { font: 600 12.5px var(--sans); fill: var(--text); }
.w-vol .sub { font: 500 10.5px var(--mono); fill: var(--text-3); }
.w-vol .st { font: 700 11px var(--mono); }
.w-vol .disk { fill: var(--surface-2); stroke: var(--accent-2); stroke-width: 2; }
.w-vol .link { stroke: var(--accent-2); stroke-width: 2.5; fill: none; }
.w-vol .wire { stroke: var(--border); stroke-width: 1.5; fill: none; stroke-dasharray: 4 4; }
` }));
  }
  let mode = 'WFFC'; let reclaim = 'Delete'; let gen = 0; let running = false; let k = 0; let steps = []; let speed = 2600;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segMode = seg([['Immediate', 'volumeBindingMode: Immediate'], ['WFFC', 'volumeBindingMode: WaitForFirstConsumer']], mode, (v) => { mode = v; reset(); }, 'Binding mode');
  const segRec = seg([['Delete', 'reclaimPolicy: Delete'], ['Retain', 'reclaimPolicy: Retain']], reclaim, (v) => { reclaim = v; reset(); }, 'Reclaim policy');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1300, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const W = 760; const H = 330;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'PVC, StorageClass and pod on the left, control-plane components in the middle, two zones with nodes and disks on the right' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-vol');
  root.append(el('div', { class: 'w-controls' }, segMode, segRec), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h, tone) => { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };

  const B = { pvc: { x: 16, y: 16, w: 180, h: 66 }, sc: { x: 16, y: 104, w: 180, h: 66 }, pod: { x: 16, y: 192, w: 180, h: 66 },
    csi: { x: 216, y: 16, w: 160, h: 66 }, pv: { x: 216, y: 104, w: 160, h: 66 }, sch: { x: 216, y: 192, w: 160, h: 66 },
    za: { x: 396, y: 10, w: 170, h: 308 }, zb: { x: 580, y: 10, w: 170, h: 308 },
    diskA: { x: 416, y: 50, w: 130, h: 58 }, diskB: { x: 600, y: 50, w: 130, h: 58 },
    nodeA: { x: 416, y: 190, w: 130, h: 110 }, nodeB: { x: 600, y: 190, w: 130, h: 110 } };
  let layer;
  const rect = (b, cls) => svg('rect', { class: 'bx ' + (cls || ''), x: b.x, y: b.y, width: b.w, height: b.h, rx: 10 });
  const txt = (x, y, t, cls, fill) => svg('text', { x, y, class: cls || 'ttl', fill, text: t });
  const ctr = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  const tone = (s) => (s === 'Bound' || s === 'Running' || s === 'Attached' ? 'var(--ok)' : s === 'Pending' || s === 'Released' ? 'var(--warn)' : s === 'Deleted' || s.startsWith('Pending:') ? 'var(--err)' : 'var(--text-2)');
  function draw(st) {
    stage.innerHTML = '';
    stage.append(svg('rect', { class: 'zone', x: B.za.x, y: B.za.y, width: B.za.w, height: B.za.h, rx: 12 }), txt(B.za.x + 10, B.za.y + 18, 'zone a', 'zl'),
      svg('rect', { class: 'zone', x: B.zb.x, y: B.zb.y, width: B.zb.w, height: B.zb.h, rx: 12 }), txt(B.zb.x + 10, B.zb.y + 18, 'zone b (pod needs it)', 'zl'));
    const box = (key, title, sub, status, cls) => { const b = B[key]; stage.append(rect(b, cls || ''), txt(b.x + 10, b.y + 20, title), txt(b.x + 10, b.y + 38, sub, 'sub'));
      if (status) stage.append(txt(b.x + 10, b.y + 56, status, 'st', tone(status))); };
    box('pvc', 'PVC data (ns shop)', '20Gi · RWO · gp3', st.pvc, st.pvcC);
    box('sc', 'StorageClass gp3', `${mode === 'WFFC' ? 'WaitForFirstConsumer' : 'Immediate'} · ${reclaim}`, null, st.scC);
    box('pod', 'Pod report-0', 'nodeSelector zone=b', st.pod, st.podC);
    box('csi', 'CSI controller', 'provisioner + attacher', st.csiN, st.csiC);
    box('pv', st.pvName || 'PV (none yet)', st.pvSub || '', st.pvS, st.pvC || (st.pvName ? '' : 'ghost'));
    box('sch', 'kube-scheduler', 'VolumeBinding plugin', st.schN, st.schC);
    stage.append(rect(B.nodeA, st.nodeAC), txt(B.nodeA.x + 10, B.nodeA.y + 20, 'node-a1'), txt(B.nodeA.x + 10, B.nodeA.y + 38, 'zone a · full', 'sub'));
    stage.append(rect(B.nodeB, st.nodeBC), txt(B.nodeB.x + 10, B.nodeB.y + 20, 'node-b1'), txt(B.nodeB.x + 10, B.nodeB.y + 38, 'zone b · free', 'sub'));
    if (st.podOn) stage.append(svg('rect', { class: 'bx ok', x: B.nodeB.x + 12, y: B.nodeB.y + 50, width: 106, height: 46, rx: 8 }), txt(B.nodeB.x + 22, B.nodeB.y + 70, 'report-0'), txt(B.nodeB.x + 22, B.nodeB.y + 86, st.mount || '/data', 'sub'));
    const disk = (key, label, ghost) => { const b = B[key]; stage.append(svg('rect', { class: ghost ? 'bx ghost' : 'disk', x: b.x, y: b.y, width: b.w, height: b.h, rx: 14 }), txt(b.x + 12, b.y + 24, label), txt(b.x + 12, b.y + 42, ghost ? 'deleted' : 'vol-0a91… 20Gi', 'sub')); };
    if (st.disk === 'a') disk('diskA', 'EBS disk');
    if (st.disk === 'b') disk('diskB', 'EBS disk');
    if (st.disk === 'b-gone') disk('diskB', 'EBS disk', true);
    if (st.attach) stage.append(svg('path', { class: 'link', d: `M${B.diskB.x + 65} ${B.diskB.y + B.diskB.h} L${B.nodeB.x + 65} ${B.nodeB.y}` }), txt(B.diskB.x + 72, 160, 'VolumeAttachment', 'sub'));
    layer = svg('g'); stage.append(layer);
  }
  function fly(a, b, color) {
    return new Promise((res) => {
      const c = color || 'var(--accent)';
      const dot = svg('circle', { r: 6, fill: c, class: 'packet', style: `color:${c}` }); layer.append(dot);
      if (reduced) { dot.setAttribute('cx', b.x); dot.setAttribute('cy', b.y); res(); return; }
      const dur = Math.min(1200, speed * 0.4); const t0 = performance.now();
      const tick = (t) => { const r = Math.min(1, (t - t0) / dur); dot.setAttribute('cx', a.x + (b.x - a.x) * r); dot.setAttribute('cy', a.y + (b.y - a.y) * r); if (r < 1) requestAnimationFrame(tick); else res(); };
      requestAnimationFrame(tick);
    });
  }
  function plan() {
    const S = []; let st = { pvc: 'Pending', pod: 'Pending' };
    const nx = (o) => (st = Object.assign({}, st, { pvcC: '', scC: '', podC: '', csiC: '', pvC: '', schC: '', nodeAC: '', nodeBC: '' }, o));
    S.push({ st: nx({ pvcC: 'hot', podC: 'hot' }), say: '<code>kubectl apply</code> creates the PVC and the pod. The pod can only run in <b>zone b</b> (zone a’s node is full, and the pod has a zone node selector).' });
    if (mode === 'Immediate') {
      S.push({ st: nx({ scC: 'hot', csiC: 'hot', csiN: 'CreateVolume' }), fly: [ctr(B.sc), ctr(B.csi)], say: '<b>Immediate</b>: the external-provisioner reacts to the PVC right away. It has no idea where the pod will run, so it picks a zone by itself. Here it picks zone a.' });
      S.push({ st: nx({ csiC: 'hot', disk: 'a', pvName: 'PV pvc-3f2a…', pvSub: 'nodeAffinity: zone=a', pvS: 'Bound', pvC: 'hot', pvc: 'Bound' }), fly: [ctr(B.csi), ctr(B.diskA)], say: 'A 20 GiB disk now exists in <b>zone a</b>. The PV records that with <code>nodeAffinity: topology.ebs.csi.aws.com/zone=a</code>, and it binds to the PVC.' });
      S.push({ st: nx({ schC: 'err', schN: 'no node fits', disk: 'a', pod: 'Pending: affinity', podC: 'err', nodeBC: 'err', nodeAC: 'err' }), fly: [ctr(B.sch), ctr(B.nodeB)], color: 'var(--err)', say: 'The scheduler needs a node that satisfies <i>both</i> the pod (zone b) and its volume (zone a). None exists: <code>0/2 nodes are available: 1 node(s) had volume node affinity conflict</code>. The pod is stuck <b>Pending</b>.', tone: 'err' });
      S.push({ st: nx({ disk: 'a', schN: 'retrying' }), say: 'Disks can’t move between zones. The fix is to delete the PVC (and its new, empty disk) and use <code>WaitForFirstConsumer</code>, so provisioning waits for the scheduler. Switch the mode above and Play again.', tone: 'warn', done: true });
      return S;
    }
    S.push({ st: nx({ pvcC: 'warn', scC: 'hot' }), say: '<b>WaitForFirstConsumer</b>: the PVC stays <code>Pending</code> with the event <i>waiting for first consumer to be created before binding</i>. That is expected, not an error.' });
    S.push({ st: nx({ schC: 'hot', schN: 'picks node-b1', nodeBC: 'hot' }), fly: [ctr(B.sch), ctr(B.nodeB)], say: 'The scheduler evaluates the pod with the unbound PVC in mind. node-a1 is full, so it picks <b>node-b1</b> and writes <code>volume.kubernetes.io/selected-node: node-b1</code> on the PVC.' });
    S.push({ st: nx({ csiC: 'hot', csiN: 'CreateVolume zone=b', disk: 'b' }), fly: [ctr(B.csi), ctr(B.diskB)], say: 'Now the provisioner calls <code>CreateVolume</code> with the selected node’s topology, so the disk is created in <b>zone b</b>.' });
    S.push({ st: nx({ disk: 'b', pvName: 'PV pvc-3f2a…', pvSub: `zone=b · ${reclaim}`, pvS: 'Bound', pvC: 'ok', pvc: 'Bound', pvcC: 'ok', schN: 'binds pod' }), say: `The PV appears (reclaim policy <code>${reclaim}</code>, copied from the class) and binds 1:1 to the PVC. The pod is bound to node-b1.` });
    S.push({ st: nx({ disk: 'b', attach: true, pvName: 'PV pvc-3f2a…', pvSub: `zone=b · ${reclaim}`, pvS: 'Attached', pvc: 'Bound', csiC: 'hot', csiN: 'ControllerPublish', nodeBC: 'hot' }), fly: [ctr(B.diskB), ctr(B.nodeB)], color: 'var(--accent-2)', say: '<b>Attach</b>: the attach/detach controller creates a <code>VolumeAttachment</code>, and the CSI attacher asks the cloud to attach the disk to node-b1. RWO block disks attach to one node at a time; a second node would get <i>Multi-Attach error</i>.' });
    S.push({ st: nx({ disk: 'b', attach: true, pvName: 'PV pvc-3f2a…', pvSub: `zone=b · ${reclaim}`, pvS: 'Attached', pvc: 'Bound', pod: 'Running', podC: 'ok', podOn: true, nodeBC: 'ok', mount: 'mounted at /data' }), say: '<b>Mount</b>: the kubelet calls the CSI node plugin: <code>NodeStageVolume</code> (format on first use, mount to a global path), then <code>NodePublishVolume</code> (bind-mount into the pod). The pod is Running and writes its data.', tone: 'ok' });
    S.push({ st: nx({ disk: 'b', pvName: 'PV pvc-3f2a…', pvSub: `zone=b · ${reclaim}`, pvS: 'Bound', pvc: 'Deleted', pvcC: 'err', pod: 'Deleted', podC: 'err', podOn: false, attach: false, csiN: 'detached' }), say: 'Now <code>kubectl delete pod report-0 pvc data</code> (or <code>helm uninstall</code>, or deleting the namespace). The pod stops, the volume is unmounted and detached. The <code>pvc-protection</code> finalizer held the PVC until no pod used it.', tone: 'warn' });
    if (reclaim === 'Delete') S.push({ st: nx({ disk: 'b-gone', pvName: 'PV pvc-3f2a…', pvSub: 'zone=b · Delete', pvS: 'Deleted', pvC: 'err', pvc: 'Deleted', pod: 'Deleted' }), fly: [ctr(B.csi), ctr(B.diskB)], color: 'var(--err)', say: '<b>Delete</b>: the PV and the <b>cloud disk</b> are deleted. The data is gone unless you had a snapshot or backup. This is the default for dynamically provisioned volumes.', tone: 'err', done: true });
    else S.push({ st: nx({ disk: 'b', pvName: 'PV pvc-3f2a…', pvSub: 'zone=b · Retain', pvS: 'Released', pvC: 'warn', pvc: 'Deleted', pod: 'Deleted' }), say: '<b>Retain</b>: the PV becomes <code>Released</code>, and the disk and data survive. It still has a <code>claimRef</code> to the old PVC, so a new claim won’t bind to it automatically. Remove the claimRef and bind with <code>volumeName</code> to recover it.', tone: 'ok', done: true });
    return S;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = plan(); bStep.disabled = false;
    draw({ pvc: '', pod: '' });
    stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `binding <b>${mode === 'WFFC' ? 'WaitForFirstConsumer' : 'Immediate'}</b>` }), el('span', { class: 'w-stat', html: `reclaim <b>${reclaim}</b>` }), el('span', { class: 'w-stat', html: 'access <b>ReadWriteOnce</b>' }));
    say('Press Play to create a PVC and a pod that needs it.');
  }
  async function step() {
    if (k >= steps.length) return false;
    const s = steps[k++]; const g = gen;
    draw(s.st); say(s.say, s.tone);
    if (s.fly) await fly(s.fly[0], s.fly[1], s.color);
    if (g !== gen) return false;
    if (k >= steps.length) bStep.disabled = true;
    return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    if (reduced) { while (g === gen && k < steps.length) await step(); }
    else while (running && g === gen && await step()) { if (k < steps.length) await sleep(speed * 0.6); }
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

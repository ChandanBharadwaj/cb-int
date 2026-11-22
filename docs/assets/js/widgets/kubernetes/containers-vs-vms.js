/* Containers vs VMs: VM stack vs container stack, then namespaces, cgroups, image layers, copy-on-write, shared layers and why one node is not enough. */
IA.widget('containers-vs-vms', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8cv-style')) {
    document.head.append(el('style', { id: 'w-k8cv-style', text: `
.k8cv svg text { font-family: var(--sans); }
.k8cv .bx rect { fill: var(--surface-2); stroke: var(--border); stroke-width: 1.2; transition: fill .4s, stroke .4s; }
.k8cv .bx text { fill: var(--text); font-size: 12px; }
.k8cv .bx text.s { fill: var(--text-3); font-size: 10.5px; font-family: var(--mono); }
.k8cv .bx.kern rect { stroke: var(--k-compute); }
.k8cv .bx.hot rect { stroke: var(--accent); stroke-width: 2; fill: var(--accent-soft); }
.k8cv .bx.err rect { stroke: var(--err); stroke-width: 2; fill: color-mix(in srgb, var(--err) 12%, transparent); }
.k8cv .bx.ok rect { stroke: var(--ok); stroke-width: 2; }
.k8cv .fd { transition: opacity .5s; }
.k8cv .off { opacity: 0; }
.k8cv .dim { opacity: .3; }
.k8cv .ttl { fill: var(--text); font-weight: 700; font-size: 14px; }
.k8cv .ns { fill: none; stroke: var(--k-edge); stroke-dasharray: 5 3; stroke-width: 1.6; }
.k8cv .cg { fill: none; stroke: var(--warn); stroke-width: 1.6; }
.k8cv .tg { font-size: 10px; fill: var(--k-edge); font-family: var(--mono); }
.k8cv .tc { font-size: 10px; fill: var(--warn); font-family: var(--mono); }
.k8cv .ly rect { fill: color-mix(in srgb, var(--k-store) 14%, var(--surface)); stroke: var(--k-store); }
.k8cv .ly.rw rect { fill: var(--surface); stroke: var(--accent); stroke-dasharray: 4 3; }
.k8cv .ly text { font-size: 11.5px; fill: var(--text); }
.k8cv .ly text.s { fill: var(--text-3); font-family: var(--mono); font-size: 10.5px; }
.k8cv .note { font-size: 11.5px; fill: var(--text-2); }
.k8cv .file { fill: var(--accent); }
` }));
  }
  let gen = 0; let running = false; let speed = 2600; let k = 0;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1300, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const W = 760, H = 600;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Virtual machine stack on the left, container stack on the right, image layers below' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('k8cv');
  root.append(el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);

  const box = (x, y, w, h, t, s, cls) => { const g = svg('g', { class: 'bx ' + (cls || '') });
    const tall = h > 60;
    g.append(svg('rect', { x, y, width: w, height: h, rx: 7 }), svg('text', { x: x + 8, y: tall ? y + 20 : y + (s ? h / 2 - 2 : h / 2 + 4), text: t }));
    if (s) g.append(svg('text', { class: 's', x: x + 8, y: tall ? y + 35 : y + h / 2 + 12, text: s }));
    return g; };
  const N = {};
  // ---- left: VMs ----
  stage.append(svg('text', { class: 'ttl', x: 20, y: 24, text: 'Virtual machines' }), svg('text', { class: 'ttl', x: 400, y: 24, text: 'Containers' }));
  N.hwL = box(20, 384, 340, 32, 'Hardware: CPU · RAM · NIC · disk'); N.hyp = box(20, 344, 340, 32, 'Hypervisor (KVM, ESXi, Hyper-V)', null, '');
  N.vm = [0, 1].map((i) => { const x = 20 + i * 175; const g = svg('g', { class: 'fd' });
    const frame = svg('rect', { x, y: 112, width: 165, height: 224, rx: 9, fill: 'none', stroke: 'var(--k-external)', 'stroke-dasharray': '2 3' });
    const lab = svg('text', { class: 'note', x: x + 8, y: 128, text: `VM ${i + 1}: virtual hardware` });
    const kern = box(x + 6, 290, 153, 38, 'Guest kernel', 'boots in seconds', 'kern');
    const libs = box(x + 6, 240, 153, 42, 'Guest OS + libs', 'GBs of disk');
    const app = box(x + 6, 140, 153, 92, i ? 'Postgres' : 'java -jar app.jar', i ? 'own kernel, own RAM' : 'reserved RAM: 4 GB');
    g.append(frame, lab, kern, libs, app); stage.append(g); return { g, kern, app }; });
  stage.append(N.hwL, N.hyp);
  // ---- right: containers ----
  N.hwR = box(400, 384, 340, 32, 'Hardware: CPU · RAM · NIC · disk');
  N.kern = box(400, 344, 340, 32, 'One Linux kernel (the node’s)', null, 'kern');
  N.rt = box(400, 304, 340, 32, 'kubelet → containerd → runc (OCI)');
  N.ct = [0, 1].map((i) => { const x = 406 + i * 170; const g = svg('g', { class: 'fd' });
    const app = box(x, 170, 158, 120, i ? 'java (pod B)' : 'java (pod A)', i ? 'PID 1 · host 4388' : 'PID 1 · host 4211');
    const ns = svg('rect', { class: 'ns fd off', x: x - 4, y: 150, width: 166, height: 146, rx: 9 });
    const nsT = svg('text', { class: 'tg fd off', x: x, y: 162, text: 'pid net mnt uts ipc' });
    const cg = svg('rect', { class: 'cg fd off', x: x - 2, y: 252, width: 162, height: 36, rx: 6 });
    const cgT = svg('text', { class: 'tc fd off', x: x + 4, y: 266, text: 'cpu.max 50000 100000' });
    const cgT2 = svg('text', { class: 'tc fd off', x: x + 4, y: 281, text: 'memory.max 512Mi' });
    const fs = svg('text', { class: 'tg fd off', x: x + 8, y: 228, text: '/ = overlay(image)' });
    const ip = svg('text', { class: 'tg fd off', x: x + 8, y: 242, text: i ? 'eth0 10.1.0.8' : 'eth0 10.1.0.7' });
    g.append(app, ns, nsT, fs, ip, cg, cgT, cgT2); stage.append(g); return { g, app, ns, nsT, cg, cgT, cgT2, fs, ip }; });
  N.proc = svg('text', { class: 'note fd off', x: 406, y: 120, text: 'On the host: just processes 4211 and 4388 in ps' });
  N.k8s = svg('g', { class: 'fd off' }, svg('rect', { x: 400, y: 36, width: 340, height: 54, rx: 9, fill: 'var(--accent-soft)', stroke: 'var(--accent)' }),
    svg('text', { x: 410, y: 58, 'font-size': 12.5, 'font-weight': 700, fill: 'var(--text)', text: 'Kubernetes: “pod A should exist” → reschedule' }),
    svg('text', { x: 410, y: 78, 'font-size': 11.5, fill: 'var(--text-2)', text: 'controllers notice the lost node, scheduler picks node-2' }));
  N.cve = svg('g', { class: 'fd off' }, svg('rect', { x: 400, y: 36, width: 340, height: 54, rx: 9, fill: 'color-mix(in srgb, var(--err) 10%, transparent)', stroke: 'var(--err)' }),
    svg('text', { x: 410, y: 58, 'font-size': 12.5, 'font-weight': 700, fill: 'var(--text)', text: 'Kernel bug = shared blast radius' }),
    svg('text', { x: 410, y: 78, 'font-size': 11.5, fill: 'var(--text-2)', text: 'every container calls the same kernel' }));
  stage.append(N.hwR, N.kern, N.rt, N.proc, N.k8s, N.cve);
  // ---- bottom: image layers ----
  stage.append(svg('line', { x1: 20, y1: 432, x2: 740, y2: 432, stroke: 'var(--border)' }), svg('text', { class: 'ttl', x: 20, y: 456, text: 'Image layers (overlayfs)' }));
  const LY = [['writable layer (pod A)', 'upperdir · deleted with the container', 'rw'], ['application/  (your classes)', 'sha256:9c1e… · 0.3 MB', ''], ['dependencies/  (Spring jars)', 'sha256:51ab… · 48 MB', ''], ['eclipse-temurin:21-jre', 'sha256:a7f0… · JRE + Ubuntu libs', '']];
  N.ly = LY.map(([t, s, c], i) => { const y = 468 + i * 31; const g = svg('g', { class: 'ly fd off ' + c });
    g.append(svg('rect', { x: 400, y, width: 340, height: 27, rx: 5 }), svg('text', { x: 410, y: y + 17, text: t }), svg('text', { class: 's', x: 600, y: y + 17, text: s.split(' · ')[1] || '' }));
    stage.append(g); return g; });
  N.rwB = svg('g', { class: 'ly rw fd off' }, svg('rect', { x: 400, y: 440, width: 340, height: 24, rx: 5 }), svg('text', { x: 410, y: 456, text: 'writable layer (pod B), same read-only layers below' }));
  N.file = svg('g', { class: 'fd off' }, svg('rect', { class: 'file', x: 690, y: 474, width: 40, height: 15, rx: 3 }), svg('text', { x: 694, y: 485, 'font-size': 9.5, fill: 'var(--surface)', text: 'app.log' }));
  N.lnote = [svg('text', { class: 'note', x: 20, y: 484, text: 'lowerdir = read-only layers, shared by digest' }), svg('text', { class: 'note', x: 20, y: 504, text: 'upperdir = this container’s writes (copy-up)' }),
    svg('text', { class: 'note', x: 20, y: 524, text: 'merged view = the container’s /' }), svg('text', { class: 'note', x: 20, y: 554, text: 'VMs: each disk image is a full OS copy' })];
  N.lnote.forEach((n) => { n.classList.add('fd', 'off'); stage.append(n); });
  stage.append(N.rwB, N.file);

  const S = (on, n) => n.classList.toggle('off', !on);
  const cls = (n, c) => { const base = n.getAttribute('class').split(' ').filter((x) => !['hot', 'err', 'ok'].includes(x)); n.setAttribute('class', base.concat(c ? [c] : []).join(' ')); };
  const steps = [
    { t: 'Both stacks start on the <b>same hardware</b>. The difference is what sits between your app and the CPU.', s: { hw: 1 } },
    { t: 'A <b>hypervisor</b> carves the machine into virtual hardware. Each VM boots its <b>own kernel</b> and OS, and reserves its RAM up front. Strong isolation, but every VM costs a full OS.', s: { hw: 1, vm: 1 } },
    { t: 'On the right there is <b>one kernel</b>. The kubelet asks containerd, which asks <b>runc</b>, to start <code>java</code>. To the node it is just process 4211 in <code>ps</code>. No boot, so it starts in milliseconds.', s: { hw: 1, vm: 1, ct: 1 } },
    { t: '<b>Namespaces</b> give each process a private view: its own PID numbering (it is PID 1), its own <code>eth0</code> and IP (net), its own mount table and hostname. Pod A cannot see pod B’s processes, even though both are on one kernel.', s: { hw: 1, vm: 1, ct: 1, ns: 1 } },
    { t: '<b>cgroups</b> give each a budget the kernel enforces: <code>cpu.max 50000 100000</code> = 50 ms of CPU per 100 ms period (0.5 CPU), <code>memory.max</code> 512Mi. Exceed memory and the kernel’s OOM killer ends the process (OOMKilled, exit 137).', s: { hw: 1, vm: 1, ct: 1, ns: 1, cg: 1 } },
    { t: 'The root filesystem comes from the <b>image</b>: read-only layers stacked by <b>overlayfs</b>, plus one thin <b>writable layer</b>. Layers are addressed by sha256 digest. Order them from least to most volatile so a code change ships 0.3 MB, not 50.', s: { hw: 1, vm: 1, ct: 1, ns: 1, cg: 1, ly: 1 } },
    { t: 'The app writes <code>app.log</code>. It lands in the writable layer (modifying a lower file first <b>copies it up</b>). When this container is replaced, even by a restart in the same pod, that layer is discarded. Use a volume for anything you want to keep.', s: { hw: 1, vm: 1, ct: 1, ns: 1, cg: 1, ly: 1, file: 1 } },
    { t: 'Pod B uses the same image. It gets its <b>own writable layer</b> but shares every read-only layer, stored <b>once</b> on the node. Compare VMs, where each disk image holds a full OS.', s: { hw: 1, vm: 1, ct: 1, ns: 1, cg: 1, ly: 1, file: 1, rwB: 1 } },
    { t: 'The price of sharing: a <b>kernel bug</b> is a bug in every container’s sandbox at once. Harden with non-root users, dropped capabilities and seccomp; use gVisor or Kata (VM per pod) for untrusted code.', s: { hw: 1, vm: 1, ct: 1, ns: 1, cg: 1, ly: 1, rwB: 1, cve: 1 } },
    { t: 'The node dies. A container runtime alone does nothing: it ran <i>on</i> that node. Something must remember that pod A <b>should</b> exist, pick another node and start it there, and re-point traffic. That is <b>orchestration</b>: Kubernetes’ controllers and scheduler.', s: { hw: 1, vm: 1, ct: 1, ns: 1, cg: 1, ly: 1, rwB: 1, dead: 1, k8s: 1 } }
  ];
  function render(s) {
    N.vm.forEach((v) => S(!!s.vm, v.g)); S(!!s.vm, N.hyp); cls(N.hyp, s.vm && !s.ct ? 'hot' : '');
    N.vm.forEach((v) => cls(v.kern, s.vm && !s.ct ? 'hot' : ''));
    N.ct.forEach((c, i) => { S(!!s.ct, c.g); [c.ns, c.nsT, c.fs, c.ip].forEach((n) => S(!!s.ns, n)); [c.cg, c.cgT, c.cgT2].forEach((n) => S(!!s.cg, n));
      cls(c.app, s.dead ? 'err' : (s.ns && !s.ly && !s.cg) || (s.cg && !s.ly) ? 'hot' : ''); c.g.classList.toggle('dim', !!s.dead); });
    [N.kern, N.rt].forEach((n) => { n.classList.add('fd'); S(!!s.ct, n); });
    cls(N.kern, s.cve ? 'err' : s.ct && !s.ns ? 'hot' : ''); cls(N.rt, s.ct && !s.ns ? 'hot' : '');
    cls(N.hwR, s.dead ? 'err' : ''); cls(N.hwL, '');
    S(s.ct && !s.ns, N.proc); S(!!s.k8s, N.k8s); S(!!s.cve, N.cve);
    N.ly.forEach((n) => S(!!s.ly, n)); N.lnote.slice(0, 3).forEach((n) => S(!!s.ly, n)); S(!!s.rwB, N.lnote[3]);
    S(!!s.file, N.file); S(!!s.rwB, N.rwB);
    stats.innerHTML = '';
    const st = (h) => stats.append(el('span', { class: 'w-stat', html: h }));
    st(`kernels running <b>${(s.vm ? 2 : 0) + (s.ct ? 1 : 0)}</b>`); st(`container start <b>${s.ct ? '~ms (no boot)' : '—'}</b>`);
    st(`read-only layer copies on node <b>${s.ly ? 3 : 0}</b>${s.rwB ? ' (shared by 2 pods)' : ''}`);
  }
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; bStep.disabled = false; render({ hw: 1 }); say('Press Play or Step. Each step adds one layer of the story, from bare hardware to “why do we need Kubernetes?”.'); }
  function step() { if (k >= steps.length) return false; const s = steps[k++]; render(s.s); say(`<b>${k}/${steps.length}</b> · ` + s.t); if (k >= steps.length) bStep.disabled = true; return true; }
  if (reduced) stage.querySelectorAll('.fd').forEach((n) => { n.style.transition = 'none'; });
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    if (reduced) { while (step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

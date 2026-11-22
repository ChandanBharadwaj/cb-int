/* Scheduling (main): the filter → score → bind cycle for one pod across five nodes, with toggles for request, toleration, node affinity and anti-affinity. */
IA.widget('scheduling', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8s-sch-style')) {
    document.head.append(el('style', { id: 'w-k8s-sch-style', text: `
.w-sch .bx { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: all .3s; }
.w-sch .bx.hot { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-soft); }
.w-sch .bx.ok { stroke: var(--ok); stroke-width: 3; }
.w-sch .bx.out { opacity: .4; stroke-dasharray: 5 4; }
.w-sch .ttl { font: 600 12.5px var(--sans); fill: var(--text); }
.w-sch .sub { font: 500 10px var(--mono); fill: var(--text-3); }
.w-sch .why { font: 700 10px var(--mono); fill: var(--err); }
.w-sch .cpu { fill: var(--accent-2); opacity: .75; } .w-sch .cpun { fill: var(--accent); }
.w-sch .cpubg { fill: var(--surface-2); stroke: var(--border); }
.w-sch .sc { fill: var(--accent); transition: width .5s; } .w-sch .scw { fill: var(--ok); }
.w-sch .web { fill: var(--warn); }
.w-sch .plug { display: flex; flex-wrap: wrap; gap: 5px; margin: 8px 0 0; }
.w-sch .plug span { font: 600 11.5px var(--mono); padding: 3px 8px; border-radius: 7px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-3); }
.w-sch .plug span.cur { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
.w-sch .plug span.done { color: var(--text-2); }
.w-sch .evt { font-family: var(--mono); font-size: 12px; color: var(--err); overflow-wrap: anywhere; }
` }));
  }
  // allocatable 4 CPU each; req = CPU already requested by pods on the node
  const NODES = [
    { n: 'n1', zone: 'a', req: 0.5, disk: 'ssd', web: true, img: false },
    { n: 'n2', zone: 'a', req: 3.2, disk: 'hdd', web: false, img: false },
    { n: 'n3', zone: 'b', req: 1.0, disk: 'ssd', web: false, img: false, taint: 'gpu=true:NoSchedule' },
    { n: 'n4', zone: 'c', req: 2.0, disk: 'hdd', web: true, img: true },
    { n: 'n5', zone: 'b', req: 0, disk: 'ssd', web: false, img: false, cordon: true }];
  let cpu = 0.5; let tol = false; let ssd = false; let anti = false;
  let gen = 0; let running = false; let k = 0; let steps = []; let speed = 2400;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const ctl = el('div', { class: 'w-controls' },
    seg([[0.5, 'requests.cpu 500m'], [1.5, 'requests.cpu 1500m']], cpu, (v) => { cpu = v; reset(); }, 'CPU request'),
    seg([[false, 'no toleration'], [true, 'tolerates gpu']], tol, (v) => { tol = v; reset(); }, 'Toleration'));
  const ctl2 = el('div', { class: 'w-controls' },
    seg([[false, 'no node affinity'], [true, 'required disktype=ssd']], ssd, (v) => { ssd = v; reset(); }, 'Node affinity'),
    seg([[false, 'no anti-affinity'], [true, 'required anti-affinity app=web / hostname']], anti, (v) => { anti = v; reset(); }, 'Pod anti-affinity'));
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1200, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const W = 760; const H = 300;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Five nodes with CPU bars; filters strike out nodes and scores rank the rest' });
  const plugs = el('div', { class: 'plug' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const evt = el('div', { class: 'w-log evt', style: { display: 'none' } });
  root.classList.add('w-sch');
  root.append(ctl, ctl2, el('div', { class: 'w-stage' }, stage), plugs,
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, evt);
  const say = (h, tone) => { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };

  const FILTERS = [
    { id: 'NodeUnschedulable', test: (n) => (n.cordon ? 'cordoned' : null), msg: 'node(s) were unschedulable' },
    { id: 'TaintToleration', test: (n) => (n.taint && !tol ? `taint ${n.taint.split(':')[0]}` : null), msg: 'node(s) had untolerated taint {gpu: true}' },
    { id: 'NodeAffinity', test: (n) => (ssd && n.disk !== 'ssd' ? `disktype=${n.disk}` : null), msg: 'node(s) didn’t match Pod’s node affinity/selector' },
    { id: 'NodeResourcesFit', test: (n) => (n.req + cpu > 4 ? `cpu ${n.req}+${cpu} > 4` : null), msg: 'Insufficient cpu' },
    { id: 'InterPodAffinity', test: (n) => (anti && n.web ? 'app=web already here' : null), msg: 'node(s) didn’t match pod anti-affinity rules' }];
  const SCORES = ['NodeResourcesFit', 'ImageLocality'];
  const X = (i) => 14 + i * 150; const NW = 138;
  function draw(st) {
    stage.innerHTML = '';
    stage.append(svg('text', { class: 'ttl', x: 14, y: 22, text: `pending pod web-7d9 · requests cpu ${cpu * 1000}m${tol ? ' · tolerates gpu' : ''}${ssd ? ' · needs ssd' : ''}${anti ? ' · anti app=web' : ''}` }));
    NODES.forEach((n, i) => {
      const x = X(i); const y = 40; const out = st.out[n.n];
      const cls = st.win === n.n ? 'ok' : out ? 'out' : st.cur === n.n ? 'hot' : '';
      stage.append(svg('rect', { class: 'bx ' + cls, x, y, width: NW, height: 160, rx: 10 }),
        svg('text', { class: 'ttl', x: x + 10, y: y + 20, text: `${n.n} · zone ${n.zone}` }),
        svg('text', { class: 'sub', x: x + 10, y: y + 37, text: `disktype=${n.disk}` }),
        svg('text', { class: 'sub', x: x + 10, y: y + 52, text: n.taint ? 'taint gpu:NoSchedule' : n.cordon ? 'SchedulingDisabled' : 'no taints' }),
        svg('text', { class: 'sub', x: x + 10, y: y + 67, text: [n.web ? 'web pod' : '', n.img ? 'img cached' : ''].filter(Boolean).join(' · ') || '—' }));
      // CPU bar: requested + this pod
      const bx = x + 10; const bw = NW - 20; const by = y + 80;
      stage.append(svg('rect', { class: 'cpubg', x: bx, y: by, width: bw, height: 14, rx: 4 }), svg('rect', { class: 'cpu', x: bx, y: by, width: bw * Math.min(1, n.req / 4), height: 14, rx: 4 }),
        svg('rect', { class: 'cpun', x: bx + bw * Math.min(1, n.req / 4), y: by, width: Math.max(0, bw * Math.min(cpu, 4 - Math.min(4, n.req)) / 4), height: 14, opacity: 0.45 }),
        svg('text', { class: 'sub', x: bx, y: by + 28, text: `cpu requested ${n.req} / 4` }));
      if (out) stage.append(svg('text', { class: 'why', x: x + 10, y: y + 128, text: '✗ ' + out.plugin }), svg('text', { class: 'why', x: x + 10, y: y + 142, text: out.why }));
      if (st.score && st.score[n.n] != null) {
        const s = st.score[n.n]; const w = (NW - 20) * Math.min(1, s / 160);
        stage.append(svg('rect', { class: st.win === n.n ? 'scw' : 'sc', x: x + 10, y: y + 122, width: reduced ? w : w, height: 12, rx: 4 }),
          svg('text', { class: 'sub', x: x + 10, y: y + 150, text: st.parts[n.n] }));
      }
    });
    if (st.win) { const i = NODES.findIndex((n) => n.n === st.win); stage.append(svg('text', { class: 'ttl', x: X(i) + NW / 2, y: 228, 'text-anchor': 'middle', fill: 'var(--ok)', text: '▲ bind' }), svg('text', { class: 'sub', x: X(i) + NW / 2, y: 244, 'text-anchor': 'middle', text: 'spec.nodeName = ' + st.win })); }
    if (st.pending) stage.append(svg('text', { class: 'ttl', x: 380, y: 236, 'text-anchor': 'middle', fill: 'var(--err)', text: 'no feasible node → PostFilter (preemption) → Pending' }));
  }
  function renderPlugs(cur, done) {
    plugs.innerHTML = '';
    [...FILTERS.map((f) => f.id), '→ score', ...SCORES, '→ bind'].forEach((p) => plugs.append(el('span', { class: p === cur ? 'cur' : done.includes(p) ? 'done' : '', text: p })));
  }
  function plan() {
    const S = []; const out = {}; const done = [];
    S.push({ st: { out: {} }, plug: null, done: [], say: 'The pod has no <code>nodeName</code>, so it sits in the scheduling queue. The scheduler takes it and runs every <b>filter plugin</b> against every node. A node is dropped at its first failing filter.' });
    FILTERS.forEach((f) => {
      const hit = NODES.filter((n) => !out[n.n] && f.test(n));
      hit.forEach((n) => { out[n.n] = { plugin: f.id, why: f.test(n), msg: f.msg }; });
      done.push(f.id);
      const left = NODES.filter((n) => !out[n.n]).map((n) => n.n);
      S.push({ st: { out: Object.assign({}, out) }, plug: f.id, done: done.slice(0, -1), say: `<b>${f.id}</b>: ${hit.length ? hit.map((n) => `${n.n} (${out[n.n].why})`).join(', ') + ' filtered out' : 'every remaining node passes'}. Feasible: <b>${left.join(', ') || 'none'}</b>.${f.id === 'NodeResourcesFit' ? ' This check uses <i>requests</i>, never actual usage.' : ''}${f.id === 'TaintToleration' && !tol ? ' (A toleration would only <i>allow</i> n3, not attract the pod to it.)' : ''}` });
    });
    const feas = NODES.filter((n) => !out[n.n]);
    if (!feas.length) {
      const counts = {}; Object.values(out).forEach((o) => { counts[o.msg] = (counts[o.msg] || 0) + 1; });
      const msg = `0/${NODES.length} nodes are available: ` + Object.entries(counts).map(([m, c]) => `${c} ${m}`).join(', ') + '.';
      S.push({ st: { out: Object.assign({}, out), pending: true }, plug: '→ bind', done: done.slice(), evt: msg, say: 'No node survived. <b>PostFilter</b> tries preemption (are there lower-priority pods whose eviction would help?). Not here, so the pod stays <b>Pending</b> with this event. The Cluster Autoscaler reads the same verdict to decide whether a new node would help.', tone: 'err', done2: true });
      return S;
    }
    const score = {}; const parts = {};
    feas.forEach((n) => { const la = Math.round(((4 - n.req - cpu) / 4) * 100); const il = n.img ? 60 : 0; score[n.n] = la + il; parts[n.n] = `fit ${la} + img ${il} = ${la + il}`; });
    S.push({ st: { out: Object.assign({}, out), score, parts }, plug: 'NodeResourcesFit', done: done.concat(['→ score']), say: `<b>Score</b>. NodeResourcesFit (LeastAllocated) rates the free share left after placing the pod: emptier is better. ImageLocality rewards nodes that already have the image (n4). Numbers are illustrative; each plugin gives 0–100, then weights are applied.` });
    const best = feas.slice().sort((a, b) => score[b.n] - score[a.n])[0];
    S.push({ st: { out: Object.assign({}, out), score, parts, win: best.n }, plug: '→ bind', done: done.concat(['→ score', ...SCORES]), say: `Highest total: <b>${best.n}</b> (${score[best.n]}). The scheduler reserves the resources in its cache and <b>binds</b> asynchronously (a Binding sets <code>spec.nodeName</code>). The kubelet on ${best.n} sees the pod and starts it.${best.n === 'n4' ? ' Note how image locality beat the emptier n1: placement is a trade-off, not just “least loaded”.' : ''}`, tone: 'ok' });
    return S;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = plan(); bStep.disabled = false;
    draw({ out: {} }); renderPlugs(null, []); evt.style.display = 'none';
    say('Set the pod’s scheduling constraints, then press Play.');
  }
  async function step() {
    if (k >= steps.length) return false;
    const s = steps[k++]; const g = gen;
    draw(s.st); renderPlugs(s.plug, s.done); say(s.say, s.tone);
    if (s.evt) { evt.style.display = ''; evt.textContent = 'Warning  FailedScheduling  default-scheduler  ' + s.evt; }
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
    else while (running && g === gen && await step()) { if (k < steps.length) await sleep(speed); }
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

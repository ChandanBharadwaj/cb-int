/* Disruptions & PDBs (main): kubectl drain node-1 against different PDBs; evictions get 201 or 429; replacements must become Ready. */
IA.widget('disruptions-pdb', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8s-pdb-style')) {
    document.head.append(el('style', { id: 'w-k8s-pdb-style', text: `
.w-pdb .nd { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: all .3s; }
.w-pdb .nd.cordon { stroke: var(--warn); stroke-width: 2.5; stroke-dasharray: 6 4; }
.w-pdb .ttl { font: 600 13px var(--sans); fill: var(--text); }
.w-pdb .sub { font: 500 10.5px var(--mono); fill: var(--text-3); }
.w-pdb .pd { stroke-width: 2; transition: all .35s; }
.w-pdb .pd.Ready { fill: var(--accent-soft); stroke: var(--ok); }
.w-pdb .pd.Starting { fill: var(--surface-2); stroke: var(--accent-2); stroke-dasharray: 4 3; }
.w-pdb .pd.Terminating { fill: var(--surface-2); stroke: var(--warn); }
.w-pdb .pd.hot { stroke-width: 3.5; }
.w-pdb .pl { font: 600 11.5px var(--mono); fill: var(--text); }
.w-pdb .ps { font: 500 10px var(--mono); }
.w-pdb .budget { font: 700 13px var(--mono); }
.w-pdb .w-log .ok { color: var(--ok); } .w-pdb .w-log .bad { color: var(--err); } .w-pdb .w-log .mu { color: var(--text-3); }
` }));
  }
  const PDBS = { none: { l: 'no PDB' }, min2: { l: 'minAvailable: 2', desired: 2 }, max1: { l: 'maxUnavailable: 1', desired: 2 }, min3: { l: 'minAvailable: 3', desired: 3 } };
  let pdb = 'min2'; let gen = 0; let running = false; let k = 0; let steps = []; let speed = 2300;
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3400, 'Slow'], [2300, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const W = 760; const H = 230;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Three nodes with orders pods; node-1 is being drained' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const log = el('div', { class: 'w-log', 'aria-label': 'kubectl drain output' });
  root.classList.add('w-pdb');
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'PDB for app=orders (3 replicas)' }), seg(Object.entries(PDBS).map(([k2, v]) => [k2, v.l]), pdb, (v) => { pdb = v; reset(); }, 'PDB')),
    el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, log);
  const say = (h, tone) => { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };

  // ---------- simulation → snapshots ----------
  function simulate() {
    const P = PDBS[pdb]; const S = []; let clock = 0; let nextId = 0; const names = ['d', 'e', 'f'];
    let pods = [{ n: 'orders-a', node: 'node-1', st: 'Ready' }, { n: 'orders-b', node: 'node-1', st: 'Ready' }, { n: 'orders-c', node: 'node-2', st: 'Ready' }];
    let cordon = false; const lines = [];
    const healthy = () => pods.filter((p) => p.st === 'Ready').length;
    const allowed = () => (P.desired == null ? Infinity : Math.max(0, healthy() - P.desired));
    const snap = (say, tone, hot, extra) => S.push(Object.assign({ pods: pods.map((p) => Object.assign({}, p)), cordon, clock, say, tone, hot, lines: lines.slice(), healthy: healthy(), allowed: allowed() }, extra || {}));
    const tickPods = () => {
      pods = pods.filter((p) => p.st !== 'Terminating' || p.left-- > 0);
      pods.forEach((p) => { if (p.st === 'Starting' && --p.readyIn <= 0) p.st = 'Ready'; });
    };
    snap('Three <code>orders</code> replicas: two on node-1, one on node-2. node-3 has free capacity. Press Play to run <code>kubectl drain node-1</code>.');
    cordon = true; lines.push(['mu', 'node/node-1 cordoned']);
    snap('<b>Cordon</b>: node-1 is marked unschedulable, so replacement pods can’t land back on it. Running pods are untouched so far.');
    const queue = ['orders-a', 'orders-b']; let blockedTries = 0;
    while (queue.length && S.length < 30) {
      const name = queue[0];
      lines.push(['mu', `evicting pod shop/${name}`]);
      if (allowed() > 0) {
        const pod = pods.find((p) => p.n === name); pod.st = 'Terminating'; pod.left = 1;
        const rep = { n: 'orders-' + names[nextId], node: nextId % 2 === 0 ? 'node-3' : 'node-2', st: 'Starting', readyIn: 2 }; nextId++;
        pods.push(rep); queue.shift(); blockedTries = 0;
        lines.push(['ok', `→ 201 Created (eviction accepted)`]);
        snap(`Eviction of <b>${name}</b> accepted${P.desired == null ? ' (no PDB: nothing to check)' : ` (healthy ${healthy() + 1} − desired ${P.desired} = ${healthy() + 1 - P.desired} allowed)`}. It starts graceful termination. The ReplicaSet notices a missing replica and creates <b>${rep.n}</b>, which the scheduler puts on ${rep.node}. A JVM needs a while to become Ready.`, '', name, { reqOk: true });
      } else {
        blockedTries++;
        lines.push(['bad', `error when evicting pods/"${name}" -n "shop" (will retry after 5s): Cannot evict pod as it would violate the pod's disruption budget.`]);
        const starting = pods.some((p) => p.st === 'Starting');
        snap(`<b>429</b> for ${name}: healthy ${healthy()} − desired ${P.desired} = <b>0</b> disruptions allowed. ${starting ? 'The drain waits 5 s and retries while the replacement starts.' : pdb === 'min3' ? 'Nothing will ever change that: with <code>minAvailable: 3</code> and 3 replicas the budget is permanently 0.' : ''}`, 'err', name);
        if (!starting && blockedTries >= 2) {
          lines.push(['bad', 'error: timed out waiting for the condition (with --timeout) … or retries forever']);
          snap('The drain is <b>stuck</b>. Node upgrades stall here. Fixes: <code>maxUnavailable: 1</code>, more replicas, or a PDB that matches reality, not <code>--disable-eviction</code>, which deletes pods and ignores the budget.', 'err', null, { done: true });
          return S;
        }
      }
      clock += 5; tickPods();
      if (!queue.length) break;
    }
    // let the rest settle
    let guard = 0;
    while (pods.some((p) => p.st !== 'Ready') && guard++ < 5) {
      clock += 5; tickPods();
      snap(pods.some((p) => p.st !== 'Ready') ? 'Waiting for the evicted pods to finish terminating and the replacements to become Ready.' : 'All replacements are Ready.', '', null);
    }
    lines.push(['ok', 'node/node-1 drained']);
    const minReady = Math.min(...S.map((s) => s.healthy));
    snap(`<b>node/node-1 drained</b>. Lowest number of Ready replicas during the drain: <b>${minReady}</b>${P.desired == null ? '. Without a PDB, both pods on node-1 were evicted at once, so capacity dropped to one pod until the replacements started. Fine for a batch job, painful for a busy API.' : `, never below the budget’s ${P.desired}. The price is a slower drain: each eviction waits for a replacement to be Ready.`}`, P.desired == null ? 'warn' : 'ok', null, { done: true });
    return S;
  }
  // ---------- drawing ----------
  const NX = { 'node-1': 16, 'node-2': 266, 'node-3': 516 }; const NW = 228;
  function draw(s) {
    stage.innerHTML = '';
    Object.entries(NX).forEach(([n, x]) => {
      const cord = n === 'node-1' && s.cordon;
      stage.append(svg('rect', { class: 'nd' + (cord ? ' cordon' : ''), x, y: 12, width: NW, height: 150, rx: 12 }),
        svg('text', { class: 'ttl', x: x + 12, y: 34, text: n }), svg('text', { class: 'sub', x: x + NW - 12, y: 34, 'text-anchor': 'end', text: cord ? 'SchedulingDisabled' : 'Ready' }));
      s.pods.filter((p) => p.node === n).forEach((p, i) => {
        const px = x + 12 + (i % 2) * 108; const py = 48 + Math.floor(i / 2) * 54;
        stage.append(svg('rect', { class: `pd ${p.st}${s.hot === p.n ? ' hot' : ''}`, x: px, y: py, width: 100, height: 46, rx: 8 }),
          svg('text', { class: 'pl', x: px + 8, y: py + 19, text: p.n }),
          svg('text', { class: 'ps', x: px + 8, y: py + 36, fill: p.st === 'Ready' ? 'var(--ok)' : p.st === 'Terminating' ? 'var(--warn)' : 'var(--accent-2)', text: p.st }));
      });
    });
    const P = PDBS[pdb];
    stage.append(svg('text', { class: 'budget', x: 16, y: 190, fill: 'var(--text)', text: `PDB ${P.l}` }),
      svg('text', { class: 'budget', x: 260, y: 190, fill: 'var(--text-2)', text: `currentHealthy ${s.healthy}` }),
      svg('text', { class: 'budget', x: 450, y: 190, fill: 'var(--text-2)', text: `desiredHealthy ${P.desired == null ? '–' : P.desired}` }),
      svg('text', { class: 'budget', x: 16, y: 216, fill: s.allowed === 0 ? 'var(--err)' : 'var(--ok)', text: `disruptionsAllowed ${s.allowed === Infinity ? '∞ (no budget)' : s.allowed}` }),
      svg('text', { class: 'sub', x: 744, y: 216, 'text-anchor': 'end', text: `t = ${s.clock} s` }));
  }
  function renderLog(lines) { log.innerHTML = ''; lines.forEach(([c, t]) => log.append(el('div', { class: c, text: t }))); log.scrollTop = log.scrollHeight; }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; steps = simulate(); k = 0; bStep.disabled = false; show(steps[k++]); }
  function show(s) { draw(s); say(s.say, s.tone); renderLog(s.lines); }
  function step() { if (k >= steps.length) return false; show(steps[k++]); if (k >= steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    if (reduced) { while (g === gen && step()); }
    else while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

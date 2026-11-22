/* Java on Kubernetes (extra): what a CPU limit does to the JVM: availableProcessors, GC ergonomics and thread pools, then CFS quota throttling of a burst within 100 ms periods. */
IA.widget('jvm-on-k8s-cpu', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8cpu-style')) {
    document.head.append(el('style', { id: 'w-k8cpu-style', text: `
.k8cpu svg text { font-family: var(--sans); }
.k8cpu .pn { fill: var(--surface-2); stroke: var(--border); transition: opacity .3s; }
.k8cpu .pn.on { stroke: var(--accent); stroke-width: 2; }
.k8cpu .ph { font-size: 11px; font-weight: 800; fill: var(--text-3); letter-spacing: .04em; }
.k8cpu .pl { font-size: 11.5px; fill: var(--text); font-family: var(--mono); }
.k8cpu .pl.k { fill: var(--accent); font-weight: 700; } .k8cpu .pl.w { fill: var(--warn); font-weight: 700; } .k8cpu .pl.m { fill: var(--text-3); }
.k8cpu .hid { opacity: .18; }
.k8cpu .run { fill: var(--ok); }
.k8cpu .thr { fill: var(--err); opacity: .55; }
.k8cpu .pd { stroke: var(--border); stroke-dasharray: 3 3; }
.k8cpu .ax { font-size: 9.5px; fill: var(--text-3); font-family: var(--mono); }
.k8cpu .rl { font-size: 11px; fill: var(--text); font-weight: 700; }
.k8cpu .done { stroke: var(--text); stroke-width: 2; }
` }));
  }
  const NODE = 16; const WORK = 320; const BURST = 8; // ms of CPU time, runnable threads
  let lim = 1; let apc = 0; let p = 0; let gen = 0; let running = false; let speed = 2800;
  const LIMS = [[0, 'no limit'], [0.5, '500m'], [1, '1'], [2, '2'], [4, '4']];
  const APCS = [[0, 'auto'], [2, '-XX:ActiveProcessorCount=2']];
  function calc() {
    const n = apc || (lim ? Math.ceil(lim) : NODE);
    const par = n <= 8 ? n : 8 + Math.floor(((n - 8) * 5) / 8);
    const conc = Math.max(1, Math.floor((par + 2) / 4));
    const gc = n >= 2 ? 'G1' : 'Serial';
    const req = lim ? Math.min(lim, 1) : 1;
    const shares = Math.round(req * 1024); const weight = 1 + Math.floor(((shares - 2) * 9999) / 262142);
    // CFS: BURST threads need WORK ms CPU; quota per 100 ms period = lim*100 ms
    const segs = []; let left = WORK; let t = 0; const rate = Math.min(BURST, NODE);
    if (!lim) { segs.push(['run', 0, WORK / rate]); t = WORK / rate; } else {
      const q = lim * 100;
      while (left > 0.001 && t < 1000) {
        const use = Math.min(q, left); const runMs = use / rate; segs.push(['run', t, t + runMs]); left -= use;
        if (left > 0.001) { segs.push(['thr', t + runMs, t + 100]); t += 100; } else t += runMs;
      }
    }
    return { n, par, conc, gc, req, weight, segs, wall: t, throttled: segs.filter((s) => s[0] === 'thr').reduce((a, s) => a + s[2] - s[1], 0) };
  }
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const W = 760; const H = 312;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'cgroup CPU settings, JVM ergonomics and a CFS throttling timeline' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('k8cpu');
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: `limits.cpu (node has ${NODE} cores)` }), seg(LIMS, lim, (v) => { lim = v; reset(); }, 'CPU limit')),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'JVM flag' }), seg(APCS, apc, (v) => { apc = v; reset(); }, 'ActiveProcessorCount')),
    el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg([[3800, 'Slow'], [2800, 'Normal'], [1400, 'Fast']], speed, (v) => { speed = v; }, 'Speed')), narr);
  const say = (h, tone) => { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function draw() {
    const c = calc(); stage.innerHTML = '';
    const panel = (x, y, w, h, title, lines, idx) => {
      const g = svg('g', { class: idx > p ? 'hid' : '' });
      g.append(svg('rect', { class: 'pn' + (idx === p ? ' on' : ''), x, y, width: w, height: h, rx: 9 }), svg('text', { class: 'ph', x: x + 12, y: y + 18, text: title }));
      lines.forEach(([cls, t], i) => g.append(svg('text', { class: 'pl' + (cls ? ' ' + cls : ''), x: x + 12, y: y + 38 + i * 16, text: t })));
      stage.append(g);
    };
    panel(10, 8, 360, 110, 'CGROUP V2 (WHAT THE KERNEL ENFORCES)', [
      ['', `cpu.max    ${lim ? (lim * 100000) + ' 100000' : 'max 100000'}`],
      ['m', lim ? `quota ${lim * 100} ms of CPU per 100 ms period` : 'no quota: may use idle cores freely'],
      ['', `cpu.weight ${c.weight}   (requests.cpu ${c.req === 0.5 ? '500m' : c.req})`],
      ['m', 'weight only matters when the node is busy']], 0);
    panel(390, 8, 360, 110, 'JVM ERGONOMICS (JDK 17/21)', [
      [apc ? 'w' : 'k', `availableProcessors() = ${c.n}${apc ? '  (forced)' : lim ? `  = ceil(${lim})` : `  = node cores`}`],
      [c.gc === 'Serial' ? 'w' : '', `default GC: ${c.gc}${c.gc === 'Serial' ? '  (< 2 CPUs)' : ''}`],
      ['', `ParallelGCThreads ${c.par} · ConcGCThreads ${c.gc === 'G1' ? c.conc : '–'}`],
      ['', `ForkJoinPool.commonPool parallelism ${Math.max(1, c.n - 1)}`]], 1);
    // timeline
    const g = svg('g', { class: p < 2 ? 'hid' : '' }); stage.append(g);
    const X0 = 120; const X1 = 745; const TMAX = 700; const X = (ms) => X0 + (Math.min(ms, TMAX) / TMAX) * (X1 - X0);
    g.append(svg('rect', { class: 'pn' + (p === 2 ? ' on' : ''), x: 10, y: 132, width: 740, height: 172, rx: 9 }),
      svg('text', { class: 'ph', x: 22, y: 150, text: `CFS: A BURST OF ${BURST} RUNNABLE THREADS NEEDING ${WORK} MS OF CPU IN TOTAL` }));
    for (let t = 0; t <= TMAX; t += 100) g.append(svg('line', { class: 'pd', x1: X(t), y1: 160, x2: X(t), y2: 270 }), svg('text', { class: 'ax', x: X(t), y: 284, 'text-anchor': 'middle', text: t + ' ms' }));
    g.append(svg('text', { class: 'rl', x: 22, y: 196, text: 'this limit' }), svg('text', { class: 'ax', x: 22, y: 210, text: lim ? `${lim} CPU` : 'none' }),
      svg('text', { class: 'rl', x: 22, y: 246, text: 'no limit' }), svg('text', { class: 'ax', x: 22, y: 260, text: 'reference' }));
    const vis = p >= 2;
    c.segs.forEach(([k, a, b]) => g.append(svg('rect', { class: k, x: X(a), y: 178, width: Math.max(1.5, X(b) - X(a)), height: 30, rx: 2 })));
    g.append(svg('rect', { class: 'run', x: X(0), y: 228, width: X(WORK / BURST) - X(0), height: 30, rx: 2 }));
    if (vis) {
      g.append(svg('line', { class: 'done', x1: X(c.wall), y1: 172, x2: X(c.wall), y2: 214 }), svg('text', { class: 'pl k', x: Math.min(X(c.wall) + 6, 650), y: 172, text: `done at ${Math.round(c.wall * 10) / 10} ms` }));
      g.append(svg('text', { class: 'pl m', x: X(WORK / BURST) + 6, y: 248, text: `${WORK / BURST} ms` }));
    }
    return c;
  }
  const NOTES = [
    (c) => `The kubelet turns <code>limits.cpu</code> into a CFS <b>quota</b> (<code>cpu.max</code>) and <code>requests.cpu</code> into a <b>weight</b>. ${lim ? `A limit of ${lim} CPU means ${lim * 100} ms of CPU time per 100 ms, across all threads together.` : 'Without a limit there is no quota; the request still guarantees a share under contention.'}`,
    (c) => `The JVM sizes itself from <code>availableProcessors()</code>: ${c.n}. ${apc ? 'You forced it with <code>-XX:ActiveProcessorCount</code>, which overrides the container detection.' : lim ? 'Container-aware JVMs round the quota up.' : 'With no limit a modern JDK sees all node cores (JDK 19+ and later updates of older releases ignore CPU shares by default).'} From it come the GC choice, GC thread counts and the common ForkJoinPool. ${c.gc === 'Serial' ? '<b>Fewer than 2 CPUs means SerialGC</b>: single-threaded, stop-the-world pauses that grow with the heap.' : ''}`,
    (c) => `A burst: ${BURST} request threads become runnable at once. ${lim ? `They burn the ${lim * 100} ms quota in ${Math.round((lim * 100 / BURST) * 10) / 10} ms of wall time, then the whole container is <b>throttled</b> until the next period.` : 'With no quota they finish as fast as the cores allow.'}`,
    (c) => lim && c.throttled > 0 ? `Work that takes ${WORK / BURST} ms unthrottled finished after <b>${Math.round(c.wall)} ms</b>, ${Math.round(c.throttled)} ms of it throttled. This is the p99 latency spike that average CPU graphs hide: usage looks like ${Math.round((WORK / Math.max(c.wall, 1)) * 10) / 10} cores on average. Watch <code>container_cpu_cfs_throttled_periods_total</code>; consider no CPU limit (requests only) for latency-sensitive JVMs, or a limit well above the request.` : `No throttling: ${lim ? `the quota (${lim * 100} ms per period) covers the burst` : 'nothing caps the burst'}. ${lim ? '' : 'The trade-off: without a limit the JVM sizes GC and pools for 16 cores. Set <code>-XX:ActiveProcessorCount</code> to match what the Pod really gets.'}`
  ];
  function show() { const c = draw(); say(NOTES[p](c), p === 3 ? (lim && c.throttled > 0 ? 'warn' : 'ok') : ''); }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; p = 0; bStep.disabled = false; show(); }
  function step() { if (p >= 3) return false; p++; show(); if (p >= 3) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (p >= 3) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    if (reduced) { while (g === gen && step()); } else while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

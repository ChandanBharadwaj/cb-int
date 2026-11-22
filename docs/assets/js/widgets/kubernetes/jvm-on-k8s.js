/* Java on Kubernetes (main): the JVM's memory stack (heap + GC structures + metaspace + code cache + thread stacks + direct buffers + other native) inside a container memory limit, from boot to peak load. */
IA.widget('jvm-on-k8s', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8jvm-style')) {
    document.head.append(el('style', { id: 'w-k8jvm-style', text: `
.k8jvm svg text { font-family: var(--sans); }
.k8jvm .frame { fill: var(--surface-2); stroke: var(--border); }
.k8jvm .seg { transition: y .6s ease, height .6s ease; stroke: var(--surface); stroke-width: 1; }
.k8jvm .lim { stroke: var(--err); stroke-width: 2.5; stroke-dasharray: 8 5; }
.k8jvm .liml { font-size: 12px; font-weight: 800; fill: var(--err); font-family: var(--mono); }
.k8jvm .xmx { stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 3 4; }
.k8jvm .xmxl { font-size: 10.5px; fill: var(--accent); font-family: var(--mono); }
.k8jvm .lg { font-size: 12px; fill: var(--text); }
.k8jvm .lv { font-size: 12px; fill: var(--text); font-family: var(--mono); font-weight: 700; }
.k8jvm .ln { font-size: 10px; fill: var(--text-3); font-family: var(--mono); }
.k8jvm .ph { font-size: 11px; font-family: var(--mono); fill: var(--text-3); }
.k8jvm .ph.on { fill: var(--accent); font-weight: 800; }
.k8jvm .sum { font-size: 12px; font-family: var(--mono); fill: var(--text-2); }
.k8jvm .sum.b { fill: var(--text); font-weight: 700; }
.k8jvm .verdict { font-size: 13px; font-weight: 800; }
.k8jvm .ax { font-size: 9.5px; fill: var(--text-3); font-family: var(--mono); }
` }));
  }
  const LIMITS = [[768, '768Mi'], [1024, '1Gi'], [2048, '2Gi'], [4096, '4Gi']];
  const HEAPS = [['25', 'default (25%)'], ['50', 'MaxRAMPercentage=50'], ['75', 'MaxRAMPercentage=75'], ['xmx', '-Xmx = limit']];
  const THREADS = [[50, '50 threads'], [200, '200 (Tomcat default)'], [400, '400']];
  const LIVE = 380; // MiB of live data this service needs at peak
  const PHASES = ['Boot', 'Warm-up', 'Traffic', 'Peak'];
  const SEGS = [
    ['heap', 'Java heap (committed)', 'var(--accent)', 'objects; G1 grows it towards MaxHeapSize under load'],
    ['gc', 'GC structures', 'var(--k-queue)', 'G1 remembered sets, card table, marking bitmaps'],
    ['meta', 'Metaspace', 'var(--accent-2)', 'class metadata: Spring, Hibernate, proxies'],
    ['code', 'Code cache', 'var(--k-compute)', 'JIT-compiled code (up to 240 MiB reserved)'],
    ['thr', 'Thread stacks', 'var(--k-edge)', '≈0.5 MiB touched each (-Xss 1 MiB reserved)'],
    ['direct', 'Direct buffers', 'var(--k-store)', 'NIO / Netty; default max = MaxHeapSize'],
    ['other', 'Other native', 'var(--k-external)', 'malloc arenas, JIT compiler, symbols, libs']
  ];
  let L = 1024; let H = '75'; let T = 200; let phase = 0; let gen = 0; let running = false; let speed = 2600;
  const heapMax = () => (H === 'xmx' ? L : Math.round(L * Number(H) / 100));
  function model(p) {
    const hm = heapMax(); const thr = T + 30;
    const heap = [Math.min(hm, 140), Math.min(hm, 300), Math.min(hm, Math.max(LIVE * 1.25, hm * 0.7)), hm][p];
    const v = {
      heap, gc: Math.round(heap * 0.06),
      meta: [95, 118, 124, 125][p], code: [18, 42, 56, 60][p],
      thr: Math.round([34, 40, thr, thr][p] * 0.5), direct: [16, 24, 40, 48][p], other: [40, 50, 56, 60][p]
    };
    v.total = SEGS.reduce((a, [k]) => a + v[k], 0);
    return v;
  }
  function verdict() {
    const hm = heapMax(); const v = model(3);
    if (hm < LIVE) return { tone: 'warn', t: 'java.lang.OutOfMemoryError: Java heap space', d: `The heap (${hm} MiB) is smaller than the ${LIVE} MiB of live data this service holds at peak. The container is nowhere near its limit; the <b>JVM</b> fails inside, logs a stack trace and limps on, unless <code>-XX:+ExitOnOutOfMemoryError</code> makes it exit so Kubernetes restarts it. The default 25% wastes most of the limit.` };
    if (v.total > L) return { tone: 'err', t: 'OOMKilled · exit 137', d: `Heap ${hm} MiB + non-heap ${v.total - v.heap} MiB = <b>${v.total} MiB</b> > limit ${L} MiB. The kernel’s cgroup OOM killer sends SIGKILL: no shutdown hooks, no heap dump, no log line. ${H === 'xmx' ? 'Setting -Xmx to the limit guarantees this: everything outside the heap has no room.' : 'Non-heap memory is roughly fixed, so a high percentage only works with a bigger limit.'}` };
    const head = L - v.total;
    if (head < L * 0.06) return { tone: 'warn', t: `Survives, barely: ${head} MiB headroom`, d: `Total ${v.total} MiB of ${L} MiB. A burst of threads, a larger direct buffer or a glibc arena spike pushes it over. Lower the percentage by 5–10 points or raise the limit.` };
    if (hm < LIVE * 1.4) return { tone: 'warn', t: `Fits, but the GC works hard (${head} MiB headroom)`, d: `MaxHeapSize ${hm} MiB is under 1.4× the ${LIVE} MiB live set, so collections run often and pauses grow under load. Give the heap more room or the container more memory.` };
    return { tone: 'ok', t: `Healthy: ${head} MiB headroom`, d: `Heap ${hm} MiB comfortably above the ${LIVE} MiB live set, and total ${v.total} MiB stays under the ${L} MiB limit. Set requests.memory = limits.memory for a JVM: it doesn’t give memory back quickly, so the request should match its real footprint.` };
  }
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: String(v) === String(cur) ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const W = 760; const HH = 330;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${HH}`, role: 'img', 'aria-label': 'Stacked bar of JVM memory areas against the container memory limit' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('k8jvm');
  root.append(
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'limits.memory' }), seg(LIMITS, L, (v) => { L = v; reset(); }, 'Memory limit')),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'heap' }), seg(HEAPS, H, (v) => { H = v; reset(); }, 'Heap setting')),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'threads' }), seg(THREADS, T, (v) => { T = v; reset(); }, 'Thread count')),
    el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg([[3600, 'Slow'], [2600, 'Normal'], [1300, 'Fast']], speed, (v) => { speed = v; }, 'Speed')),
    narr, stats);
  const say = (h, tone) => { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const BX = 60; const BWD = 170; const BOT = 304; const TOP = 34;
  function draw(p, final) {
    stage.innerHTML = '';
    const v = model(p); const hm = heapMax();
    const scaleMax = Math.max(L * 1.25, model(3).total * 1.05);
    const Y = (m) => BOT - (m / scaleMax) * (BOT - TOP);
    PHASES.forEach((t, i) => stage.append(svg('text', { class: 'ph' + (i === p ? ' on' : ''), x: BX + i * 52, y: 16, text: (i ? '› ' : '') + t })));
    stage.append(svg('rect', { class: 'frame', x: BX, y: TOP, width: BWD, height: BOT - TOP, rx: 6 }));
    [0, 0.25, 0.5, 0.75, 1, 1.25].forEach((f) => { const m = L * f; if (m > scaleMax) return; stage.append(svg('text', { class: 'ax', x: BX - 6, y: Y(m) + 3, 'text-anchor': 'end', text: Math.round(m) })); });
    let acc = 0;
    SEGS.forEach(([k, , col]) => {
      const h = (v[k] / scaleMax) * (BOT - TOP);
      stage.append(svg('rect', { class: 'seg', x: BX + 2, y: Y(acc + v[k]), width: BWD - 4, height: Math.max(0, h), fill: col, opacity: k === 'heap' ? 0.85 : 0.9 }));
      acc += v[k];
    });
    stage.append(svg('line', { class: 'xmx', x1: BX, y1: Y(hm), x2: BX + BWD, y2: Y(hm) }), svg('text', { class: 'xmxl', x: BX + BWD - 4, y: Y(hm) - 4, 'text-anchor': 'end', text: 'MaxHeapSize ' + hm }));
    stage.append(svg('line', { class: 'lim', x1: BX - 30, y1: Y(L), x2: BX + BWD + 30, y2: Y(L) }), svg('text', { class: 'liml', x: BX + BWD + 34, y: Y(L) + 4, text: 'limit ' + L + ' MiB' }));
    if (acc > L) stage.append(svg('rect', { x: BX + 2, y: Y(acc), width: BWD - 4, height: Y(L) - Y(acc), fill: 'none', stroke: 'var(--err)', 'stroke-width': 3 }));
    // legend
    const LX = 352;
    stage.append(svg('text', { class: 'ln', x: LX, y: 40, text: 'AREA' }), svg('text', { class: 'ln', x: LX + 160, y: 40, text: 'MiB' }), svg('text', { class: 'ln', x: LX + 205, y: 40, text: 'WHAT' }));
    [...SEGS].reverse().forEach(([k, name, col, note], i) => {
      const y = 58 + i * 26;
      stage.append(svg('rect', { x: LX, y: y - 10, width: 12, height: 12, rx: 3, fill: col }), svg('text', { class: 'lg', x: LX + 18, y, text: name }),
        svg('text', { class: 'lv', x: LX + 186, y, 'text-anchor': 'end', text: String(v[k]) }), svg('text', { class: 'ln', x: LX + 205, y: y + 0.5, text: note.length > 34 ? note.slice(0, 33) + '…' : note }));
    });
    const y2 = 58 + SEGS.length * 26 + 6;
    stage.append(svg('text', { class: 'sum', x: LX, y: y2, text: `heap ${v.heap} + non-heap ${v.total - v.heap}` }),
      svg('text', { class: 'sum b', x: LX, y: y2 + 18, text: `= ${v.total} MiB of ${L} MiB limit` }),
      svg('text', { class: 'sum', x: LX, y: y2 + 36, text: H === 'xmx' ? `-Xmx${L}m (fixed)` : `MaxRAMPercentage=${H} → MaxHeapSize ${hm} MiB` }));
    if (final) { const vd = verdict(); stage.append(svg('text', { class: 'verdict', x: LX, y: y2 + 60, fill: vd.tone === 'ok' ? 'var(--ok)' : vd.tone === 'err' ? 'var(--err)' : 'var(--warn)', text: vd.t })); }
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `phase <b>${PHASES[p]}</b>` }), el('span', { class: 'w-stat', html: `live data needed <b>${LIVE} MiB</b>` }), el('span', { class: 'w-stat', html: `used <b>${Math.round((v.total / L) * 100)}%</b> of limit` }));
  }
  const NOTE = [
    () => `<b>Boot.</b> Since JDK 10 (and 8u191) the JVM reads the cgroup memory limit and treats it as the machine’s RAM. ${H === 'xmx' ? `You set <code>-Xmx${L}m</code>, so the heap may grow to the full limit.` : `<code>MaxRAMPercentage=${H}</code> → a maximum heap of ${heapMax()} MiB${H === '25' ? ' (25% is the default when you set nothing)' : ''}.`} Class loading fills metaspace first.`,
    () => 'Warm-up: the JIT compiles hot methods into the <b>code cache</b>, Spring finishes creating proxies (metaspace), connection pools open. None of this is heap.',
    () => `Traffic: ${T} request threads plus about 30 JVM, GC and pool threads. Each thread has its own stack outside the heap. Direct buffers grow with I/O. The heap grows as the GC decides it needs more room.`,
    () => 'Peak: under sustained allocation, G1 expands the committed heap up to MaxHeapSize and rarely shrinks it quickly. This is the footprint the limit must hold.'
  ];
  function show(p) {
    phase = p; const final = p === 3; draw(p, final);
    if (final) { const vd = verdict(); say(NOTE[3]() + ' ' + vd.d, vd.tone); } else say(NOTE[p]());
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; bStep.disabled = false; show(0); }
  function step() { if (phase >= 3) return false; show(phase + 1); if (phase >= 3) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (phase >= 3) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    if (reduced) { while (g === gen && step()); } else while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

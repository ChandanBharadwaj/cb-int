/* Node vs Java: the same 12 requests through four concurrency models (Node event loop, Tomcat platform threads,
   Java 21 virtual threads, WebFlux event loops). A small discrete-event model: CPU slices on threads, I/O waits off-thread
   (or holding the thread, for platform threads). */
IA.widget('node-vs-java', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-nj-style')) {
    document.head.append(el('style', { id: 'w-nj-style', text: `
.w-nj .rl { fill: var(--text-2); font-size: 12px; font-weight: 600; }
.w-nj .rq { fill: var(--text-3); font-size: 11px; font-family: var(--mono); }
.w-nj .track { fill: var(--surface-2); stroke: var(--border); }
.w-nj .cpu { fill: var(--accent); } .w-nj .cpu.heavy { fill: var(--err); }
.w-nj .wait { fill: var(--accent-soft); stroke: var(--accent); stroke-width: .8; }
.w-nj .queue { fill: color-mix(in srgb, var(--warn) 40%, var(--surface)); }
.w-nj .rbar { fill: var(--ok); } .w-nj .rbar.slow { fill: var(--err); }
.w-nj .now { stroke: var(--text); stroke-width: 1.5; stroke-dasharray: 4 3; }
.w-nj .tick { fill: var(--text-3); font-size: 11px; } .w-nj .sep { stroke: var(--border); }
` }));
  }
  const MODELS = {
    node: { label: 'Node event loop', threads: 1, kind: 'loop', pinned: true, names: ['event loop (the only JS thread)'] },
    tomcat: { label: 'Tomcat platform threads', threads: 4, kind: 'block', names: ['worker 1', 'worker 2', 'worker 3', 'worker 4'] },
    virtual: { label: 'Java 21 virtual threads', threads: 4, kind: 'loop', pinned: false, names: ['carrier 1', 'carrier 2', 'carrier 3', 'carrier 4'] },
    webflux: { label: 'WebFlux (Netty loops)', threads: 4, kind: 'loop', pinned: true, names: ['event loop 1', 'event loop 2', 'event loop 3', 'event loop 4'] }
  };
  const N = 12; const GAP = 4; const IO = 40; const C = 1; const HEAVY = 120; const HEAVY_I = 2;
  let model = 'node'; let work = 'io'; let gen = 0; let running = false; let cursor = 0; let sim = null;
  const reqs = () => Array.from({ length: N }, (_, i) => ({ a: i * GAP, c1: work === 'cpu' && i === HEAVY_I ? HEAVY : C, io: IO, c2: C }));
  function simulate() {
    const M = MODELS[model]; const R = reqs(); const segs = []; const done = Array(N).fill(0); const startAt = Array(N).fill(0);
    if (M.kind === 'block') {
      const free = Array(M.threads).fill(0);
      R.forEach((r, i) => {
        let th = 0; free.forEach((f, j) => { if (f < free[th]) th = j; });
        const s = Math.max(r.a, free[th]); startAt[i] = s;
        segs.push({ th, a: s, b: s + r.c1, k: 'cpu', r: i }, { th, a: s + r.c1, b: s + r.c1 + r.io, k: 'wait', r: i }, { th, a: s + r.c1 + r.io, b: s + r.c1 + r.io + r.c2, k: 'cpu', r: i });
        free[th] = s + r.c1 + r.io + r.c2; done[i] = free[th];
      });
    } else {
      const free = Array(M.threads).fill(0);
      let pend = R.map((r, i) => ({ r: i, ph: 1, ready: r.a, cpu: r.c1, th: M.pinned ? i % M.threads : -1 }));
      while (pend.length) {
        let best = null; let bs = Infinity; let bth = 0;
        pend.forEach((t) => {
          let th = t.th; if (th < 0) { th = 0; free.forEach((f, j) => { if (f < free[th]) th = j; }); }
          const s = Math.max(t.ready, free[th]);
          if (s < bs || (s === bs && (t.ready < best.ready || (t.ready === best.ready && t.r < best.r)))) { best = t; bs = s; bth = th; }
        });
        pend = pend.filter((t) => t !== best);
        segs.push({ th: bth, a: bs, b: bs + best.cpu, k: 'cpu', r: best.r });
        free[bth] = bs + best.cpu;
        if (best.ph === 1) { startAt[best.r] = bs; pend.push({ r: best.r, ph: 2, ready: bs + best.cpu + R[best.r].io, cpu: R[best.r].c2, th: M.pinned ? best.th : -1 }); }
        else done[best.r] = bs + best.cpu;
      }
    }
    const lat = R.map((r, i) => done[i] - r.a);
    const ideal = C + IO + C;
    return { R, segs, done, startAt, lat, end: Math.max(...done), ideal };
  }
  const seg = (opts, get, set, label) => { const e = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...e.children].forEach((x) => x.classList.toggle('on', x === b)); }); e.append(b); }); return e; };
  const segM = seg(Object.entries(MODELS).map(([key, v]) => [key, v.label]), () => model, (v) => { model = v; reset(); }, 'Concurrency model');
  const segW = seg([['io', 'all I/O-bound'], ['cpu', 'one CPU-heavy request']], () => work, (v) => { work = v; reset(); }, 'Workload');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const W = 600; const X0 = 30; const X1 = W - 16; const TR = 34; const RQ = 13;
  const stage = svg('svg', { role: 'img', 'aria-label': 'Thread rows with CPU and wait blocks, then one row per request from arrival to response' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-nj');
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-controls' }, segW), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const TMAX = () => Math.max(220, Math.ceil((sim.end + 10) / 20) * 20);
  function draw() {
    const M = MODELS[model]; const tmax = TMAX(); const X = (t) => X0 + (t / tmax) * (X1 - X0);
    const top = 24; const reqTop = top + M.threads * TR + 22; const H = reqTop + N * RQ + 24;
    stage.setAttribute('viewBox', `0 0 ${W} ${H}`); stage.innerHTML = '';
    M.names.forEach((n, i) => { const y = top + i * TR; stage.append(svg('text', { class: 'rl', x: X0, y: y - 5, text: n }), svg('rect', { class: 'track', x: X0, y, width: X1 - X0, height: 14, rx: 3 })); });
    sim.segs.forEach((s) => { if (s.a >= cursor) return; const b = Math.min(s.b, cursor); const y = top + s.th * TR;
      stage.append(svg('rect', { class: s.k === 'cpu' ? 'cpu' + (work === 'cpu' && s.r === HEAVY_I && s.b - s.a > C ? ' heavy' : '') : 'wait', x: X(s.a), y: y + 1, width: Math.max(1.5, X(b) - X(s.a)), height: 12, rx: 2 })); });
    stage.append(svg('line', { class: 'sep', x1: X0, x2: X1, y1: reqTop - 14, y2: reqTop - 14 }), svg('text', { class: 'rl', x: X0, y: reqTop - 2, text: 'requests: queued (yellow) → in progress → response' }));
    sim.R.forEach((r, i) => { const y = reqTop + 4 + i * RQ; if (r.a >= cursor) return;
      stage.append(svg('text', { class: 'rq', x: 2, y: y + 9, text: 'r' + (i + 1) }));
      const qEnd = Math.min(sim.startAt[i], cursor); if (qEnd > r.a) stage.append(svg('rect', { class: 'queue', x: X(r.a), y, width: Math.max(1, X(qEnd) - X(r.a)), height: 9, rx: 2 }));
      if (cursor > sim.startAt[i]) { const b = Math.min(sim.done[i], cursor); stage.append(svg('rect', { class: 'rbar' + (sim.lat[i] > sim.ideal * 1.5 ? ' slow' : ''), x: X(sim.startAt[i]), y, width: Math.max(1, X(b) - X(sim.startAt[i])), height: 9, rx: 2 })); }
    });
    [0, tmax / 2, tmax].forEach((t, i) => stage.append(svg('text', { class: 'tick', x: X(t), y: H - 6, 'text-anchor': i === 0 ? 'start' : i === 2 ? 'end' : 'middle', text: t + ' ms' })));
    if (cursor > 0 && cursor < tmax) stage.append(svg('line', { class: 'now', x1: X(cursor), x2: X(cursor), y1: top - 4, y2: H - 18 }));
    const fin = sim.done.filter((d) => d <= cursor).length;
    const sorted = sim.lat.slice().sort((a, b) => a - b);
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `t <b>${Math.min(cursor, tmax).toFixed(0)} ms</b>` }), el('span', { class: 'w-stat', html: `done <b>${fin}</b>/${N}` }),
      el('span', { class: 'w-stat', html: `median latency <b>${sorted[Math.floor(N / 2)].toFixed(0)} ms</b>` }), el('span', { class: 'w-stat', html: `worst <b>${sorted[N - 1].toFixed(0)} ms</b>` }), el('span', { class: 'w-stat', html: `ideal <b>${sim.ideal} ms</b>` }));
  }
  function story() {
    const M = MODELS[model]; const worst = Math.max(...sim.lat).toFixed(0); const heavyOthers = sim.lat.filter((l, i) => i !== HEAVY_I && l > sim.ideal * 1.5).length;
    const T = {
      node: { io: `One thread, ${N} requests, each 1 ms CPU + ${IO} ms database wait + 1 ms CPU. While a request waits, the thread runs other requests’ CPU slices. All ${N} are in flight at once; worst latency <b>${worst} ms</b> against an ideal of ${sim.ideal} ms.`,
        cpu: `Request 3 needs <b>${HEAVY} ms of CPU</b>. The only thread is busy, so the requests that arrive meanwhile can’t even start, and those whose I/O finishes can’t send their response: <b>${heavyOthers}</b> other requests are slowed, worst <b>${worst} ms</b>. Move CPU work to <code>worker_threads</code>.` },
      tomcat: { io: `Each request holds a platform thread for its whole life, including the ${IO} ms it spends <b>waiting</b> (pale). With 4 threads (think: 200 threads vs 600 concurrent requests), later requests <b>queue</b> (yellow) for a free thread: worst <b>${worst} ms</b>. Threads are cheap to write code for but expensive to hold idle.`,
        cpu: `The heavy request occupies one worker for longer, and the other three keep serving. Queueing comes from the pool size, not from the CPU work: worst <b>${worst} ms</b>.` },
      virtual: { io: `Same blocking code as Tomcat, but a virtual thread <b>unmounts</b> from its carrier while it waits, so no request queues for a thread. Like Node, all ${N} are in flight at once; worst <b>${worst} ms</b>.`,
        cpu: `The heavy request pins <b>one</b> carrier while it computes; the scheduler runs everything else on the other three carriers. <b>${heavyOthers}</b> other requests are slowed; worst <b>${worst} ms</b>. Real cores doing real parallel work: the JVM’s advantage for CPU-bound code.` },
      webflux: { io: `Netty assigns each connection to one of a few event loops (about one per core). Non-blocking I/O, like Node, with ${M.threads} loops: worst <b>${worst} ms</b>.`,
        cpu: `Requests are pinned to their connection’s loop. The heavy request blocks <b>loop 3</b>, so the requests sharing that loop are stuck behind it while the other loops are fine: <b>${heavyOthers}</b> slowed. Same rule as Node: never block the loop (use <code>publishOn</code> for CPU work, never blocking JDBC).` }
    };
    return T[model][work];
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; sim = simulate(); cursor = 0; bStep.disabled = false; draw(); say(`${MODELS[model].label}: ${N} requests arrive ${GAP} ms apart. Press Play to run the clock.`); }
  function advance(dt) { const tmax = TMAX(); cursor = Math.min(tmax, cursor + dt); draw(); if (cursor >= tmax) { say(story()); bStep.disabled = true; return false; } return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; advance(TMAX() / 8); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (reduced) { advance(Infinity); return; }
    if (cursor >= TMAX()) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && advance(TMAX() / 90)) await sleep(60);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

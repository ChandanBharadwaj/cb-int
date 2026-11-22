/* Requests & limits: CFS bandwidth control simulated in 0.5 ms steps. Threads share a per-100 ms quota; once it is spent, every runnable thread is throttled until the next period. */
IA.widget('resources-qos', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-k8rq-style')) {
    document.head.append(el('style', { id: 'w-k8rq-style', text: `
.k8rq svg text { font-family: var(--sans); }
.k8rq .ln { fill: var(--text-2); font-size: 11px; font-family: var(--mono); }
.k8rq .track { fill: var(--surface-2); stroke: var(--border); }
.k8rq .run { fill: var(--accent); }
.k8rq .thr { fill: url(#k8rq-hatch); }
.k8rq .hatch { stroke: var(--err); stroke-width: 2.2; }
.k8rq .hbg { fill: color-mix(in srgb, var(--err) 14%, var(--surface)); }
.k8rq .pline { stroke: var(--text-3); stroke-dasharray: 3 3; }
.k8rq .qbar { fill: var(--k-compute); opacity: .8; }
.k8rq .qfull { fill: var(--err); opacity: .75; }
.k8rq .qt { fill: var(--text-2); font-size: 10.5px; font-family: var(--mono); }
.k8rq .done { fill: var(--ok); }
.k8rq .dt { fill: var(--ok); font-size: 10.5px; font-weight: 700; }
.k8rq .ax { fill: var(--text-3); font-size: 10px; font-family: var(--mono); }
.k8rq .cur { stroke: var(--text); stroke-width: 1.5; }
.k8rq .shade { fill: var(--bg); opacity: .55; }
` }));
  }
  const WL = {
    single: { label: '1 thread · 80 ms request', names: ['request'], jobs: [[0, 0, 80, 'request']],
      intro: 'One request handled on one thread, needing <b>80 ms</b> of CPU. Unthrottled it takes 80 ms.' },
    burst: { label: '4 threads × 30 ms', names: ['worker-1', 'worker-2', 'worker-3', 'worker-4'], jobs: [[0, 0, 30, 'request'], [1, 0, 30, 'request'], [2, 0, 30, 'request'], [3, 0, 30, 'request']],
      intro: 'A request fans out to 4 threads (a parallel stream, a scatter-gather), 30 ms of CPU each: 120 ms of CPU in 30 ms of wall time if nothing throttles it.' },
    gc: { label: 'request + parallel GC', names: ['http-nio-1', 'GC-1', 'GC-2', 'GC-3', 'GC-4'], jobs: [[0, 0, 30, 'request'], [1, 4, 25, 'gc'], [2, 4, 25, 'gc'], [3, 4, 25, 'gc'], [4, 4, 25, 'gc']],
      intro: 'A 30 ms request is running when a young-gen collection starts 4 ms in, on 4 parallel GC threads (25 ms each). GC threads and request threads spend one shared quota.' },
    pool: { label: 'steady: 8 threads × 15 ms per 100 ms', names: ['exec-1', 'exec-2', 'exec-3', 'exec-4', 'exec-5', 'exec-6', 'exec-7', 'exec-8'], jobs: [0, 100, 200, 300, 400].flatMap((t) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [i, t, 15, 'batch' + t])),
      intro: 'A busy thread pool: every 100 ms, 8 threads each get 15 ms of work. That is <b>1.2 CPUs</b> of demand on average, the kind of load a dashboard shows as “1.2 cores”.' }
  };
  const P = 100, H = 500, DT = 0.5, CORES = 8;
  let lim = 1; let wl = 'burst'; let gen = 0; let running = false; let speed = 2400; let k = 0; let now = 0; let SIM; let BASE;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segL = seg([[0.5, 'limit 500m'], [1, 'limit 1'], [2, 'limit 2'], [0, 'no limit']], () => lim, (v) => { lim = v; reset(); }, 'CPU limit');
  const segW = seg(Object.keys(WL).map((x) => [x, WL[x].label]), () => wl, (v) => { wl = v; reset(); }, 'Workload');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Next 100 ms ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1200, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const stage = svg('svg', { viewBox: '0 0 760 300', role: 'img', 'aria-label': 'Per-thread timeline over five 100 ms CFS periods, with quota usage bars' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('k8rq');
  root.append(el('div', { class: 'w-controls' }, segL), el('div', { class: 'w-controls' }, segW), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);

  function simulate(limit) {
    const W = WL[wl]; const n = W.names.length; const steps = Math.round(H / DT);
    const state = W.names.map(() => new Uint8Array(steps)); // 0 idle, 1 run, 2 throttled
    const jobs = W.jobs.map(([th, at, work, tag]) => ({ th, at, rem: work, tag, done: null }));
    const per = []; let quota = 0;
    for (let s = 0; s < steps; s++) {
      const t = s * DT;
      if (s % (P / DT) === 0) { quota = limit ? limit * P : Infinity; per.push({ used: 0, exAt: null, thr: 0, peak: 0 }); }
      const pd = per[per.length - 1];
      const cur = []; for (let i = 0; i < n; i++) { const j = jobs.find((x) => x.th === i && x.at <= t && x.rem > 1e-9); if (j) cur.push(j); }
      const r = cur.slice(0, CORES); pd.peak = Math.max(pd.peak, r.length);
      if (!r.length) continue;
      if (quota <= 1e-9) { r.forEach((j) => { state[j.th][s] = 2; }); pd.thr += DT; continue; }
      const need = r.length * DT; const f = need <= quota ? 1 : quota / need;
      r.forEach((j) => { const run = Math.min(j.rem, DT * f); j.rem -= run; state[j.th][s] = 1; if (j.rem <= 1e-9 && j.done == null) j.done = t + run / f; });
      const used = r.reduce((a) => a + DT * f, 0); quota -= used; pd.used += used; if (quota <= 1e-9 && pd.exAt == null) pd.exAt = (s % (P / DT)) * DT + DT * f;
    }
    const fin = (tag) => { const js = jobs.filter((j) => j.tag === tag); return js.every((j) => j.done != null) ? Math.max(...js.map((j) => j.done)) : null; };
    return { state, per, jobs, fin };
  }
  const X0 = 96, XW = 650; const x = (t) => X0 + t / H * XW;
  function draw() {
    const W = WL[wl]; const n = W.names.length; const LY = (i) => 64 + i * 24; const bottom = LY(n) + 4;
    stage.setAttribute('viewBox', `0 0 760 ${bottom + 34}`); stage.innerHTML = '';
    const defs = svg('defs'); const pat = svg('pattern', { id: 'k8rq-hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    pat.append(svg('rect', { class: 'hbg', width: 6, height: 6 }), svg('line', { class: 'hatch', x1: 0, y1: 0, x2: 0, y2: 6 })); defs.append(pat); stage.append(defs);
    // quota bars
    stage.append(svg('text', { class: 'ln', x: 6, y: 30, text: 'quota used' }));
    SIM.per.forEach((pd, i) => { const a = x(i * P) + 3, w = x(P) - x(0) - 6; const q = lim ? lim * P : null;
      stage.append(svg('rect', { class: 'track', x: a, y: 14, width: w, height: 22, rx: 4 }));
      if (now > i * P) { const frac = q ? Math.min(1, pd.used / q) : Math.min(1, pd.used / (CORES * P));
        stage.append(svg('rect', { class: q && pd.exAt != null ? 'qfull' : 'qbar', x: a, y: 14, width: w * frac, height: 22, rx: 4 }),
          svg('text', { class: 'qt', x: a + 4, y: 48, text: q ? `${Math.round(pd.used)}/${q} ms` + (pd.exAt != null ? ` · gone at ${Math.round(pd.exAt)} ms` : '') : `${Math.round(pd.used)} ms, no quota` })); } });
    W.names.forEach((nm, i) => { const y = LY(i); stage.append(svg('text', { class: 'ln', x: 6, y: y + 13, text: nm }), svg('rect', { class: 'track', x: X0, y, width: XW, height: 18, rx: 3 }));
      const row = SIM.state[i]; let s0 = 0;
      for (let s = 1; s <= row.length; s++) { if (s === row.length || row[s] !== row[s0]) { const v = row[s0]; const a = s0 * DT, b = Math.min(s * DT, now);
        if (v && b > a) stage.append(svg('rect', { class: v === 1 ? 'run' : 'thr', x: x(a), y: y + 2, width: Math.max(0.8, x(b) - x(a)), height: 14 })); s0 = s; } } });
    for (let i = 1; i < 5; i++) stage.append(svg('line', { class: 'pline', x1: x(i * P), x2: x(i * P), y1: 10, y2: bottom }));
    for (let t = 0; t <= H; t += 100) stage.append(svg('text', { class: 'ax', x: x(t) - 10, y: bottom + 14, text: t + 'ms' }));
    SIM.jobs.filter((j) => j.done != null && j.done <= now && j.tag === 'request').forEach((j) => { stage.append(svg('circle', { class: 'done', cx: x(j.done), cy: LY(j.th) + 9, r: 4 })); });
    const rq = SIM.fin('request'); if (rq != null && rq <= now) stage.append(svg('text', { class: 'dt', x: Math.min(x(rq) + 6, 690), y: bottom + 28, text: `request done at ${Math.round(rq)} ms` }));
    stage.append(svg('line', { class: 'cur', x1: x(now), x2: x(now), y1: 8, y2: bottom }));
    if (now < H) stage.append(svg('rect', { class: 'shade', x: x(now), y: 54, width: x(H) - x(now), height: bottom - 54 }));
    const pers = SIM.per.filter((_, i) => now > i * P); const thrP = pers.filter((p) => p.exAt != null && p.thr > 0).length;
    stats.innerHTML = ''; const st = (h) => stats.append(el('span', { class: 'w-stat', html: h }));
    st(`nr_periods <b>${pers.length}</b>`); st(`nr_throttled <b>${thrP}</b>`); st(`throttled (wall) <b>${Math.round(pers.reduce((a, p) => a + p.thr, 0))} ms</b>`);
    const used = pers.reduce((a, p) => a + p.used, 0); st(`avg CPU <b>${pers.length ? (used / (pers.length * P)).toFixed(2) : '0.00'}</b> cores`);
  }
  function periodText(i) {
    const pd = SIM.per[i]; const q = lim ? lim * P : null; const W = WL[wl];
    let s = `<b>Period ${i + 1}</b> (${i * P}–${(i + 1) * P} ms): `;
    if (!pd.peak) s += 'nothing to run.';
    else if (!q) s += `${pd.peak} runnable thread${pd.peak > 1 ? 's' : ''}, used ${Math.round(pd.used)} ms of CPU. No limit, so no quota and no throttling; the node has ${CORES} cores.`;
    else if (pd.exAt != null && pd.thr > 0) s += `${pd.peak} runnable thread${pd.peak > 1 ? 's burn' : ' burns'} the ${q} ms quota by <b>${Math.round(pd.exAt)} ms</b> into the period. Every thread with work is <b>throttled</b> for the remaining ${Math.round(P - pd.exAt)} ms, even though ${CORES - pd.peak} cores sit idle.`;
    else s += `used ${Math.round(pd.used)} of ${q} ms quota. No throttling.`;
    if (i === 4 || (W.jobs.every((j) => j[1] <= i * P) && SIM.jobs.every((j) => j.done != null && j.done <= (i + 1) * P))) {
      const rq = SIM.fin('request'); const b = BASE.fin('request');
      if (rq != null) s += ` The request finished at <b>${Math.round(rq)} ms</b>; without throttling, ${Math.round(b)} ms.`;
      if (wl === 'pool') { const late = SIM.jobs.filter((j) => j.done == null || j.done - j.at > P).length; s += late ? ` <b>${late}</b> work items took longer than a period: demand (1.2 CPU) exceeds the limit, so a backlog builds every period.` : ' Every batch finished within its period.'; }
    }
    return s;
  }
  async function animTo(t) {
    const g = gen; const from = now; if (reduced || t <= from) { now = t; draw(); return; }
    const dur = speed * 0.6; const t0 = performance.now();
    await new Promise((res) => { const f = (ts) => { if (g !== gen) return res(); const u = Math.min(1, (ts - t0) / dur); now = from + (t - from) * u; draw(); if (u < 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  }
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; now = 0; SIM = simulate(lim); BASE = simulate(0); draw(); bStep.disabled = false;
    say(WL[wl].intro + (lim ? ` Limit ${lim} CPU → <code>cpu.max ${lim * 100000} 100000</code>: <b>${lim * P} ms</b> of CPU per 100 ms period, shared by all threads.` : ' No CPU limit: <code>cpu.max max 100000</code>.') + ' Press Play or Step.'); }
  async function step() { if (k >= 5) return false; const i = k++; const g = gen; say(periodText(i)); await animTo((i + 1) * P); if (g !== gen) return false; if (k >= 5) bStep.disabled = true; return true; }
  let busy = false;
  bStep.addEventListener('click', async () => { running = false; bPlay.textContent = '▶ Play'; if (busy) return; busy = true; await step(); busy = false; });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= 5) reset();
    if (reduced) { while (await step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && await step()) await sleep(speed * 0.6);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

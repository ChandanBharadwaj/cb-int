/* Blocking the event loop: a main-thread timeline in 10 ms slots. Small requests arrive every 30 ms;
   a 250 ms CPU job arrives at 60 ms and runs (a) in one block, (b) chunked with setImmediate, (c) on a Worker.
   Shows each request's wait and an event-loop delay chart. */
IA.widget('blocking-event-loop', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-bel-style')) {
    document.head.append(el('style', { id: 'w-bel-style', text: `
.w-bel .lane { fill: var(--surface-2); stroke: var(--border); stroke-width: 1; }
.w-bel .s-req { fill: var(--accent-2); }
.w-bel .s-heavy { fill: var(--err); }
.w-bel .s-chunk { fill: var(--warn); }
.w-bel .s-msg { fill: var(--ok); }
.w-bel .t1 { fill: var(--text); font-size: 13px; font-weight: 700; }
.w-bel .t2 { fill: var(--text-3); font-size: 11px; }
.w-bel .arr { fill: var(--accent-2); }
.w-bel .arr.late { fill: var(--err); }
.w-bel .head { stroke: var(--accent); stroke-width: 2; }
.w-bel .lag { fill: none; stroke: var(--err); stroke-width: 2.5; stroke-linejoin: round; }
.w-bel .lagf { fill: color-mix(in srgb, var(--err) 14%, transparent); stroke: none; }
.w-bel .thr { stroke: var(--warn); stroke-width: 1.5; stroke-dasharray: 5 4; }
.w-bel .ax { stroke: var(--border); stroke-width: 1; }
.w-bel-key { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--text-2); margin: 6px 0 0; }
.w-bel-key i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -2px; margin-right: 5px; }
` }));
  }
  const SLOT = 10; const N = 50; const REQ_EVERY = 30; const HEAVY_AT = 60; const HEAVY = 25;
  const MODES = {
    sync: { label: 'One sync block', note: '<code>handler() { const r = crunch(data); … }</code>: 250 ms of CPU in one callback.' },
    chunk: { label: 'Chunked + setImmediate', note: '<code>for (…) { crunchSlice(); await setImmediate(); }</code>: 10 ms slices, yielding to the loop between them.' },
    worker: { label: 'Worker thread', note: '<code>await pool.run(data)</code>: the job runs on a Worker; the main thread only handles the result message.' }
  };

  function simulate(mode) {
    const slots = Array(N).fill(null); const wslots = Array(N).fill(null);
    const reqs = []; for (let a = 0; a < N * SLOT; a += REQ_EVERY) reqs.push({ id: reqs.length + 1, at: a, done: null, start: null });
    const q = []; let cur = null; const lag = []; let heavyDone = null; let wRem = 0; let wStart = null;
    for (let i = 0; i < N; i++) {
      const t = i * SLOT;
      reqs.filter((r) => r.at >= t && r.at < t + SLOT).forEach((r) => q.push({ kind: 'req', r, rem: 1, at: r.at }));
      if (t === HEAVY_AT) {
        if (mode === 'worker') { wRem = HEAVY; wStart = i; } else q.push({ kind: 'heavy', rem: HEAVY, at: t });
      }
      if (mode === 'worker' && wRem > 0 && i > wStart) { wslots[i] = 'heavy'; wRem--; if (wRem === 0) q.push({ kind: 'msg', rem: 1, at: t + SLOT }); }
      if (!cur && q.length) cur = q.shift();
      if (cur) {
        if (cur.kind === 'req' && cur.r.start == null) cur.r.start = t;
        slots[i] = cur.kind === 'heavy' ? (mode === 'chunk' ? 'chunk' : 'heavy') : cur.kind;
        cur.rem--;
        if (cur.rem === 0) {
          if (cur.kind === 'req') cur.r.done = t + SLOT;
          if (cur.kind === 'heavy' || cur.kind === 'msg') heavyDone = t + SLOT;
          cur = null;
        } else if (mode === 'chunk' && cur.kind === 'heavy') { cur.at = t + SLOT; q.push(cur); cur = null; }   // yield: requests queued meanwhile go first
      }
      // event-loop delay: how long the oldest waiting callback has been waiting at the end of this slot
      const waiting = q.filter((x) => x.at <= t + SLOT);
      lag.push(waiting.length ? Math.max(...waiting.map((x) => t + SLOT - x.at)) : 0);
    }
    return { slots, wslots, reqs, lag, heavyDone };
  }

  let mode = 'sync'; let R = null; let k = 0; let gen = 0; let playing = false; let speed = 650;
  const FR = 2;  // slots per frame
  const seg = (opts, cur, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); set(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 600 300', role: 'img', 'aria-label': 'Main thread timeline, request waits and event-loop delay chart' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  const key = el('div', { class: 'w-bel-key' }, ...[['var(--accent-2)', 'request handler (10 ms)'], ['var(--err)', 'CPU job, one block'], ['var(--warn)', 'CPU job slice'], ['var(--ok)', 'Worker result message']].map(([c, t]) => el('span', null, el('i', { style: { background: c } }), t)));
  root.classList.add('w-bel');
  root.append(el('div', { class: 'w-controls' }, seg(Object.entries(MODES).map(([v, m]) => [v, m.label]), mode, (v) => { mode = v; reset(); }, 'How the CPU job runs')),
    el('div', { class: 'w-stage' }, stage), key, narr,
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg([[1100, 'Slow'], [650, 'Normal'], [300, 'Fast']], speed, (v) => { speed = v; }, 'Speed')), stats);

  const X0 = 70; const W = 520; const sx = (ms) => X0 + (ms / (N * SLOT)) * W;
  function render(upTo) {
    const tNow = upTo * SLOT;
    stage.innerHTML = '';
    // arrivals
    stage.append(svg('text', { class: 't2', x: 4, y: 30, text: 'arrivals' }));
    R.reqs.forEach((r) => { if (r.at >= tNow) return; const wait = (r.start == null || r.start >= tNow) ? tNow - r.at : r.start - r.at;
      stage.append(svg('path', { class: 'arr' + (wait > 50 ? ' late' : ''), d: `M${sx(r.at)},20 l5,10 l-10,0 z` })); });
    if (HEAVY_AT < tNow) stage.append(svg('text', { class: 't1', x: sx(HEAVY_AT) - 4, y: 16, fill: 'var(--err)', text: '↓ CPU job' }));
    // lanes
    const lane = (y, label, arr) => {
      stage.append(svg('text', { class: 't1', x: 4, y: y + 20, text: label }));
      stage.append(svg('rect', { class: 'lane', x: X0, y, width: W, height: 30, rx: 4 }));
      for (let i = 0; i < Math.min(upTo, N); i++) if (arr[i]) stage.append(svg('rect', { class: 's-' + arr[i], x: sx(i * SLOT) + 0.5, y: y + 2, width: W / N - 1, height: 26, rx: 2 }));
    };
    lane(38, 'main', R.slots);
    if (mode === 'worker') lane(74, 'worker', R.wslots);
    else stage.append(svg('text', { class: 't2', x: X0, y: 94, text: 'no other thread runs JavaScript here' }));
    // per-request waits
    stage.append(svg('text', { class: 't2', x: 4, y: 128, text: 'wait/req' }));
    R.reqs.forEach((r) => { if (r.at >= tNow) return; const end = r.start == null || r.start >= tNow ? tNow : r.start; const w = end - r.at;
      stage.append(svg('rect', { x: sx(r.at), y: 118 - Math.min(w, 260) / 12, width: Math.max(3, W / N * 0.8), height: Math.max(1, Math.min(w, 260) / 12), rx: 1, fill: w > 50 ? 'var(--err)' : 'var(--accent-2)' })); });
    // lag chart
    const cy0 = 284; const cyH = 130; const maxLag = 300; const ly = (v) => cy0 - (Math.min(v, maxLag) / maxLag) * cyH;
    stage.append(svg('line', { class: 'ax', x1: X0, x2: X0 + W, y1: cy0, y2: cy0 }), svg('line', { class: 'ax', x1: X0, x2: X0, y1: cy0 - cyH, y2: cy0 }));
    stage.append(svg('text', { class: 't1', x: 4, y: cy0 - cyH + 12, text: 'loop' }), svg('text', { class: 't1', x: 4, y: cy0 - cyH + 27, text: 'delay' }));
    [0, 100, 200, 300].forEach((v) => stage.append(svg('text', { class: 't2', x: X0 - 4, y: ly(v) + 4, 'text-anchor': 'end', text: v + '' })));
    stage.append(svg('line', { class: 'thr', x1: X0, x2: X0 + W, y1: ly(100), y2: ly(100) }), svg('text', { class: 't2', x: X0 + W, y: ly(100) - 4, 'text-anchor': 'end', text: '100 ms: a p99 SLO' }));
    const pts = []; for (let i = 0; i < Math.min(upTo, N); i++) pts.push([sx((i + 1) * SLOT), ly(R.lag[i])]);
    if (pts.length) {
      const d = `M${sx(0)},${ly(0)} ` + pts.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      stage.append(svg('path', { class: 'lagf', d: d + ` L${pts[pts.length - 1][0]},${cy0} L${sx(0)},${cy0} Z` }), svg('path', { class: 'lag', d }));
    }
    stage.append(svg('line', { class: 'head', x1: sx(Math.min(tNow, N * SLOT)), x2: sx(Math.min(tNow, N * SLOT)), y1: 18, y2: cy0 }));
    stage.append(svg('text', { class: 't2', x: X0 + W, y: 298, 'text-anchor': 'end', text: `t = ${tNow} ms` }));
    // caption + stats
    const seen = R.reqs.filter((r) => r.done != null && r.done <= tNow);
    const worst = seen.reduce((m, r) => Math.max(m, r.done - r.at), 0);
    const maxL = Math.max(0, ...R.lag.slice(0, upTo));
    let cap;
    if (upTo === 0) cap = MODES[mode].note + ' Press Play or Step.';
    else if (tNow <= HEAVY_AT) cap = 'Requests arrive every 30 ms and each takes 10 ms. The thread is idle between them, so every request runs as soon as it arrives. Delay ≈ 0.';
    else if (upTo >= N) {
      cap = mode === 'sync' ? `Done. Requests that arrived during the job waited up to <b>${worst - 10} ms</b>. The job finished at ${R.heavyDone} ms. Everyone paid for one caller’s work.`
        : mode === 'chunk' ? `Done. The worst request took <b>${worst} ms</b>. The job itself finished later (${R.heavyDone} ms) because it shares the thread, but nobody waited behind it for long.`
          : `Done. The worst request took <b>${worst} ms</b>; the job’s result arrived at ${R.heavyDone} ms. Real parallelism: the job used a second core.`;
    } else if (mode === 'sync') cap = R.slots[upTo - 1] === 'heavy' ? 'The CPU job is running. Requests keep arriving (red arrows), but their callbacks can’t start until this one returns. Delay climbs in a straight line.' : 'The job returned. Now the queued requests run back to back, and each one’s latency includes the whole wait.';
    else if (mode === 'chunk') cap = 'Each 10 ms slice ends with <code>await setImmediate()</code>. The loop goes round, the poll phase picks up waiting requests, and they run between slices. Delay stays around one slice.';
    else cap = 'The job runs on the Worker’s own thread with its own event loop. The main thread stays free for requests; delay stays near 0.';
    narr.firstChild.innerHTML = cap;
    stats.innerHTML = '';
    [['time', tNow + ' ms'], ['requests done', `${seen.length}`], ['worst request latency', worst ? worst + ' ms' : '—'], ['max loop delay', maxL + ' ms'], ['CPU job done', R.heavyDone && R.heavyDone <= tNow ? R.heavyDone + ' ms' : '—']]
      .forEach(([a, b]) => stats.append(el('span', { class: 'w-stat', html: `${a} <b>${b}</b>` })));
  }
  function reset() { gen++; playing = false; bPlay.textContent = '▶ Play'; R = simulate(mode); k = 0; bStep.disabled = false; render(0); }
  function step() { if (k >= N) { bStep.disabled = true; return false; } k = Math.min(N, k + FR); render(k); if (k >= N) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { playing = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (playing) { playing = false; bPlay.textContent = '▶ Play'; return; }
    if (reduced) { k = N; render(N); bStep.disabled = true; return; }
    if (k >= N) reset();
    playing = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (playing && g === gen && step()) await sleep(speed);
    if (g === gen) { playing = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

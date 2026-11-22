/* WebFlux: four Netty event loops simulated tick by tick (50 ms). Non-blocking I/O vs a 200 ms JDBC call on the loop vs offloading to boundedElastic. */
IA.widget('webflux-reactive', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const LOOPS = 4; const RATE = 2; const IO = 4; const CAP = 4; const TICKS = 20; const HB_T = 4; const HB_L = 2;
  const MODES = { nb: 'Non-blocking (WebClient / R2DBC)', block: 'JDBC on the event loop', off: 'JDBC offloaded to boundedElastic' };
  function simulate(mode) {
    const loops = Array.from({ length: LOOPS }, () => ({ q: [], busy: null, ran: [] }));
    let io = []; let elastic = []; let id = 0; let done = 0; let hb = null; const F = [];
    const snap = (t, cap, tone) => F.push({ t, cap, tone, done, hb: hb && Object.assign({}, hb),
      loops: loops.map((l) => ({ q: l.q.map((r) => r.id), busy: l.busy && { id: l.busy.id, rem: l.busy.rem }, ran: l.ran.slice() })),
      io: io.map((r) => r.id), el: elastic.map((r) => r.id) });
    snap(0, mode === 'nb' ? 'Requests arrive at 40/s (2 per 50 ms tick), spread over 4 event loops. Each needs a short CPU slice, waits 200 ms for the database, then a slice to write the response.'
      : mode === 'block' ? 'Same traffic, but the handler calls <code>JdbcTemplate</code> inside <code>map</code>. The 200 ms wait now happens <b>on</b> the event-loop thread.'
        : 'Same blocking JDBC call, wrapped in <code>Mono.fromCallable(…).subscribeOn(Schedulers.boundedElastic())</code>.', null);
    for (let t = 1; t <= TICKS; t++) {
      for (let a = 0; a < RATE; a++) { id++; const r = { id: String(id), loop: id % LOOPS, ph: 'q1', t0: t }; loops[r.loop].q.push(r); }
      if (t === HB_T) { hb = { id: '♥', loop: HB_L, ph: 'q1', t0: t, hb: true }; loops[HB_L].q.push(hb); }
      const back = [];
      // I/O completions and elastic work happen off the loops
      io.forEach((r) => { r.rem--; if (!r.rem) { r.ph = 'q2'; back.push(r); } }); io = io.filter((r) => r.rem);
      elastic.forEach((r) => { r.rem--; if (!r.rem) { r.ph = 'q2'; back.push(r); } }); elastic = elastic.filter((r) => r.rem);
      loops.forEach((L, li) => {
        L.ran = [];
        if (L.busy) { L.busy.rem--; L.ran.push(L.busy.id); if (L.busy.rem) return; const b = L.busy; L.busy = null; b.ph = 'q2'; L.q.unshift(b); return; }
        let cap = CAP;
        while (cap > 0 && L.q.length) {
          const r = L.q.shift(); cap--; L.ran.push(r.id);
          if (r.hb || r.ph === 'q2') { done++; if (r.hb) { hb.t1 = t; } continue; }
          if (mode === 'block') { r.rem = IO; L.busy = r; break; }
          r.rem = IO; if (mode === 'nb') io.push(r); else elastic.push(r);
        }
        void li;
      });
      back.forEach((r) => loops[r.loop].q.push(r));
      const maxQ = Math.max(...loops.map((l) => l.q.length));
      let cap; let tone = null;
      if (hb && hb.t1 === t) { cap = `♥ health check answered after <b>${(t - hb.t0 + 1) * 50} ms</b>.`; tone = mode === 'block' ? 'warn' : 'ok'; }
      else if (t === HB_T) cap = `♥ <code>/actuator/health</code> arrives on <code>reactor-http-nio-${HB_L + 1}</code>.`;
      else if (mode === 'block') { const b = loops.find((l) => l.busy); cap = b ? `${(t * 50)} ms: ${loops.filter((l) => l.busy).length} of 4 loops are parked inside JDBC. Longest queue: <b>${maxQ}</b> requests, growing every tick.` : `${t * 50} ms: loops finish responses, then block again.`; tone = maxQ > 4 ? 'err' : 'warn'; }
      else if (mode === 'nb') cap = `${t * 50} ms: ${io.length} requests are waiting on the database with <b>no thread</b> assigned. The loops stay idle most of the tick.`;
      else cap = `${t * 50} ms: ${elastic.length} JDBC calls run on <code>boundedElastic</code> threads (cap 10 × cores). Loops only do the short slices.`;
      snap(t, cap, tone);
    }
    const q = loops.reduce((s, l) => s + l.q.length + (l.busy ? 1 : 0), 0);
    const hbTxt = hb && hb.t1 ? `${(hb.t1 - hb.t0 + 1) * 50} ms` : 'still waiting';
    snap(TICKS, mode === 'nb' ? `After 1 s: ${done} responses, nothing queued, ♥ took ${hbTxt}. Four threads were plenty, because waiting costs no thread.`
      : mode === 'block' ? `After 1 s: only ${done} responses and <b>${q}</b> requests stuck in queues. ♥ ${hbTxt}. Capacity is 4 loops ÷ 200 ms ≈ 20 req/s for <i>every</i> endpoint.`
        : `After 1 s: ${done} responses, loops free, ♥ ${hbTxt}. The cost moved to ~8 busy elastic threads (and 8 JDBC connections), which is thread-per-request again for this endpoint.`, mode === 'block' ? 'err' : 'ok');
    return F;
  }
  let mode = 'block'; let F = simulate(mode); let k = 0; let gen = 0; let running = false; let speed = 1400;
  const mkSeg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segM = mkSeg(Object.keys(MODES).map((m) => [m, MODES[m]]), mode, (v) => { mode = v; F = simulate(v); reset(); }, 'Mode');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = mkSeg([[2400, 'Slow'], [1400, 'Normal'], [700, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const W = 680; const H = 340;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Four event-loop lanes with request queues, an I/O wait area and the boundedElastic pool' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 12, fill: 'var(--text)', text: t }, o || {}));
  const tok = (x, y, id, o) => { const g = svg('g'); const hb = id === '♥';
    g.append(svg('circle', { cx: x, cy: y, r: 10, fill: hb ? 'var(--err)' : (o && o.fill) || 'var(--surface-2)', stroke: (o && o.stroke) || 'var(--border)', 'stroke-width': 1.2 }));
    g.append(T(x, y + 4, id, { 'font-size': hb ? 11 : 9.5, 'text-anchor': 'middle', fill: hb ? '#fff' : 'var(--text)', 'font-family': 'var(--mono)' })); return g; };
  function draw(f) {
    stage.innerHTML = '';
    stage.append(T(12, 18, `t = ${f.t * 50} ms`, { 'font-family': 'var(--mono)', 'font-weight': 700 }), T(130, 18, 'running this tick', { fill: 'var(--text-3)', 'font-size': 11 }), T(300, 18, 'queued on this loop →', { fill: 'var(--text-3)', 'font-size': 11 }));
    f.loops.forEach((L, i) => {
      const y = 30 + i * 52;
      const blocked = !!L.busy;
      stage.append(svg('rect', { x: 10, y, width: W - 20, height: 42, rx: 8, fill: blocked ? 'color-mix(in srgb, var(--err) 10%, var(--surface))' : 'var(--surface)', stroke: blocked ? 'var(--err)' : 'var(--border)', 'stroke-width': blocked ? 1.6 : 1 }));
      stage.append(T(20, y + 18, `reactor-http-nio-${i + 1}`, { 'font-family': 'var(--mono)', 'font-size': 11 }), T(20, y + 33, blocked ? `blocked in JDBC (${L.busy.rem * 50} ms left)` : L.ran.length ? `${L.ran.length} short slices` : 'idle', { 'font-size': 10.5, fill: blocked ? 'var(--err)' : 'var(--text-3)' }));
      if (blocked) {
        stage.append(tok(150, y + 21, L.busy.id, { stroke: 'var(--err)', fill: 'var(--accent-soft)' }));
        stage.append(svg('rect', { x: 166, y: y + 16, width: 120, height: 10, rx: 4, fill: 'var(--surface-2)', stroke: 'var(--border)' }), svg('rect', { x: 166, y: y + 16, width: 120 * (1 - L.busy.rem / IO), height: 10, rx: 4, fill: 'var(--err)' }));
      } else L.ran.slice(0, 4).forEach((id, j) => stage.append(tok(150 + j * 24, y + 21, id, { stroke: 'var(--accent)', fill: 'var(--accent-soft)' })));
      const shown = L.q.slice(0, 13);
      shown.forEach((id, j) => stage.append(tok(312 + j * 25, y + 21, id)));
      if (L.q.length > shown.length) stage.append(T(W - 18, y + 25, `+${L.q.length - shown.length}`, { 'text-anchor': 'end', fill: 'var(--err)', 'font-weight': 700 }));
    });
    const by = 248;
    const lbl = mode === 'off' ? 'boundedElastic threads (blocking JDBC runs here)' : 'awaiting I/O: no thread held (socket registered with the selector)';
    stage.append(svg('rect', { x: 10, y: by, width: W - 20, height: 80, rx: 10, fill: 'var(--surface-2)', stroke: 'var(--border)', 'stroke-dasharray': mode === 'off' ? '' : '5 4' }));
    stage.append(T(20, by + 18, mode === 'block' ? 'awaiting I/O: empty, because the loops themselves are doing the waiting' : lbl, { 'font-size': 11.5, fill: 'var(--text-2)' }));
    const pen = mode === 'off' ? f.el : f.io;
    pen.slice(0, 24).forEach((id, j) => stage.append(tok(32 + j * 26, by + 48, id, { stroke: mode === 'off' ? 'var(--warn)' : 'var(--accent-2)' })));
    stats.innerHTML = '';
    const q = f.loops.reduce((s, l) => s + l.q.length, 0);
    stats.append(el('span', { class: 'w-stat', html: `responses <b>${f.done}</b>` }), el('span', { class: 'w-stat', html: `queued on loops <b>${q}</b>` }),
      el('span', { class: 'w-stat', html: `threads blocked <b>${mode === 'off' ? f.el.length + ' elastic' : f.loops.filter((l) => l.busy).length + ' event loops'}</b>` }),
      el('span', { class: 'w-stat', html: `♥ latency <b>${f.hb ? (f.hb.t1 ? (f.hb.t1 - f.hb.t0 + 1) * 50 + ' ms' : 'waiting…') : '–'}</b>` }));
  }
  function show() {
    const f = F[k]; draw(f);
    narr.className = 'caption' + (f.tone ? ' ' + f.tone : '');
    narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k + 1}/${F.length}` }), el('div', { class: 't', html: f.cap }));
    bStep.disabled = k >= F.length - 1;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = 0; show(); }
  bStep.addEventListener('click', () => { gen++; stop(); if (k < F.length - 1) { k++; show(); } });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { gen++; stop(); return; }
    if (k >= F.length - 1) k = 0;
    if (reduced) { k = F.length - 1; show(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen; show();
    while (running && g === gen && k < F.length - 1) { await sleep(speed); if (g !== gen) return; k++; show(); }
    if (g === gen) stop();
  });
  reset();
});

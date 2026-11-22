/* HTTP clients: an outbound connection pool when the downstream slows from 100 ms to 3 s. Library defaults vs tuned pool + timeouts. Tick = 100 ms. */
IA.widget('http-clients', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const RATE = 4; const TICKS = 30; const SLOW_AT = 6; const FAST = 1; const SLOW = 30; const TOMCAT = 200;
  const CFG = {
    def: { l: 'Defaults: 5 per route, no response timeout', slots: 5, acq: null, resp: null, note: 'Apache HttpClient 5 defaults: 5 connections per route, no response timeout, and a connection-request timeout measured in minutes.' },
    tuned: { l: 'Tuned: 20 per route, acquire 500 ms, response 1 s', slots: 20, acq: 5, resp: 10, note: 'A pool sized for peak, a short acquire timeout, and a response timeout below the caller’s SLA.' }
  };
  function simulate(c) {
    const C = CFG[c]; const slots = Array.from({ length: C.slots }, () => null); let wait = []; let id = 0;
    let ok = 0; let rto = 0; let ato = 0; const F = []; const lat = [];
    const snap = (t, cap, tone) => F.push({ t, cap, tone, slots: slots.map((s) => s && { id: s.id, age: t - s.ts, slow: s.slow }), wait: wait.length, ok, rto, ato, threads: Math.min(TOMCAT, slots.filter(Boolean).length + wait.length), over: Math.max(0, slots.filter(Boolean).length + wait.length - TOMCAT), p: lat.length ? lat.slice().sort((a, b) => a - b)[Math.floor(lat.length * 0.95)] : 0 });
    snap(0, C.note + ' Press Play.', null);
    for (let t = 1; t <= TICKS; t++) {
      const latency = t >= SLOW_AT ? SLOW : FAST;
      for (let a = 0; a < RATE; a++) wait.push({ id: ++id, t0: t });
      // in-flight
      slots.forEach((s, i) => { if (!s) return;
        if (t - s.ts >= s.need) { ok++; lat.push(t - s.t0); slots[i] = null; }
        else if (C.resp && t - s.ts >= C.resp) { rto++; lat.push(t - s.t0); slots[i] = null; } });
      // acquire timeouts
      if (C.acq) { const keep = []; wait.forEach((w) => { if (t - w.t0 >= C.acq) { ato++; lat.push(t - w.t0); } else keep.push(w); }); wait = keep; }
      // lease free slots FIFO
      slots.forEach((s, i) => { if (!s && wait.length) { const w = wait.shift(); slots[i] = { id: w.id, t0: w.t0, ts: t, need: latency, slow: latency === SLOW }; } });
      const busy = slots.filter(Boolean).length; const th = busy + wait.length;
      let cap; let tone = null;
      if (t < SLOW_AT) cap = `${t * 100} ms: latency 100 ms. ${busy} of ${C.slots} connections in use, nobody waiting.`;
      else if (t === SLOW_AT) { cap = '600 ms: the payment API’s latency jumps to <b>3 s</b>. New requests now hold their connection 30× longer.'; tone = 'warn'; }
      else if (c === 'def') { cap = `${t * 100} ms: all ${C.slots} connections stuck in slow calls. <b>${wait.length}</b> request threads are parked in <code>lease()</code> waiting for <i>your</i> pool${th >= TOMCAT ? '; Tomcat’s 200 threads are gone, so even endpoints that don’t call payments queue' : ''}.`; tone = th > 100 ? 'err' : 'warn'; }
      else { cap = `${t * 100} ms: pool full; callers give up after 500 ms (acquire timeout) and in-flight calls after 1 s (response timeout). Threads held stay bounded at <b>${th}</b>, and errors are fast and visible.`; tone = 'warn'; }
      snap(t, cap, tone);
    }
    const L = F[F.length - 1];
    snap(TICKS, c === 'def' ? `After 3 s: ${L.ok} successes, ${L.threads} threads tied up, growing by 4 every 100 ms: at this rate all 200 Tomcat threads are gone in another ~${((TOMCAT - L.threads) / RATE / 10).toFixed(1)} s, and then every endpoint queues. CPU is idle, nothing has failed, so nothing alerts.`
      : `After 3 s: ${L.ok} successes, ${L.ato} acquire timeouts and ${L.rto} response timeouts, all as fast errors. Threads stay available for other endpoints. Next step: a circuit breaker so you stop calling a sick host at all.`, c === 'def' ? 'err' : 'ok');
    return F;
  }
  let cfg = 'def'; let F = simulate(cfg); let k = 0; let gen = 0; let running = false; let speed = 1200;
  const mkSeg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segC = mkSeg(Object.keys(CFG).map((x) => [x, CFG[x].l]), cfg, (v) => { cfg = v; F = simulate(v); reset(); }, 'Client config');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = mkSeg([[2000, 'Slow'], [1200, 'Normal'], [600, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const W = 680; const H = 300;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Caller threads, the outbound connection pool and the downstream API' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segC), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 12, fill: 'var(--text)', text: t }, o || {}));
  function draw(f) {
    stage.innerHTML = '';
    const slow = f.t >= SLOW_AT;
    // Tomcat threads bar
    stage.append(T(12, 20, `Tomcat request threads: ${f.threads} / ${TOMCAT} busy${f.over ? `  (+${f.over} queued in accept backlog)` : ''}`, { 'font-weight': 700, 'font-size': 12.5, fill: f.threads >= TOMCAT ? 'var(--err)' : 'var(--text)' }));
    stage.append(svg('rect', { x: 12, y: 28, width: W - 24, height: 12, rx: 6, fill: 'var(--surface-2)', stroke: 'var(--border)' }));
    stage.append(svg('rect', { x: 12, y: 28, width: (W - 24) * f.threads / TOMCAT, height: 12, rx: 6, fill: f.threads > 150 ? 'var(--err)' : f.threads > 60 ? 'var(--warn)' : 'var(--accent)' }));
    // waiting callers
    stage.append(svg('rect', { x: 12, y: 58, width: 220, height: 220, rx: 10, fill: 'var(--surface)', stroke: f.wait ? 'var(--warn)' : 'var(--border)' }));
    stage.append(T(22, 78, 'waiting for a connection', { 'font-size': 11.5, 'font-weight': 700 }), T(22, 93, 'threads parked in pool.lease()', { 'font-size': 10.5, fill: 'var(--text-3)' }));
    const shown = Math.min(f.wait, 120);
    for (let i = 0; i < shown; i++) stage.append(svg('circle', { cx: 28 + (i % 12) * 17, cy: 110 + Math.floor(i / 12) * 16, r: 5.5, fill: 'var(--warn)', opacity: 0.85 }));
    if (f.wait > shown) stage.append(T(222, 270, `+${f.wait - shown}`, { 'text-anchor': 'end', fill: 'var(--err)', 'font-weight': 700 }));
    // pool
    const C = CFG[cfg]; const cols = 5; const sw = 40; const sh = 30;
    stage.append(svg('rect', { x: 248, y: 58, width: 236, height: 220, rx: 10, fill: 'var(--surface-2)', stroke: 'var(--border)' }));
    stage.append(T(258, 78, `connection pool (route: payments) ${C.slots} max`, { 'font-size': 11.5, 'font-weight': 700 }));
    f.slots.forEach((s, i) => {
      const x = 262 + (i % cols) * (sw + 4); const y = 92 + Math.floor(i / cols) * (sh + 6);
      stage.append(svg('rect', { x, y, width: sw, height: sh, rx: 5, fill: s ? (s.slow ? 'color-mix(in srgb, var(--err) 22%, var(--surface))' : 'var(--accent-soft)') : 'var(--surface)', stroke: s ? (s.slow ? 'var(--err)' : 'var(--accent)') : 'var(--border)' }));
      if (s) stage.append(T(x + sw / 2, y + 19, `${s.age * 100}ms`, { 'text-anchor': 'middle', 'font-size': 9.5, 'font-family': 'var(--mono)' }));
    });
    if (C.resp) stage.append(T(258, 268, `response timeout ${C.resp * 100} ms · acquire timeout ${C.acq * 100} ms`, { 'font-size': 10.5, fill: 'var(--text-2)' }));
    else stage.append(T(258, 268, 'no response timeout · acquire timeout: minutes', { 'font-size': 10.5, fill: 'var(--err)' }));
    // downstream
    stage.append(svg('rect', { x: 500, y: 58, width: 168, height: 220, rx: 10, fill: 'var(--surface)', stroke: slow ? 'var(--err)' : 'var(--ok)', 'stroke-width': 1.5 }));
    stage.append(T(584, 84, 'payments API', { 'text-anchor': 'middle', 'font-weight': 700 }), T(584, 104, slow ? 'p50 latency 3 s' : 'p50 latency 100 ms', { 'text-anchor': 'middle', 'font-family': 'var(--mono)', fill: slow ? 'var(--err)' : 'var(--ok)' }));
    stage.append(T(584, 150, slow ? '🐢' : '⚡', { 'text-anchor': 'middle', 'font-size': 34 }));
    stage.append(svg('line', { x1: 232, y1: 168, x2: 248, y2: 168, stroke: 'var(--border)', 'stroke-width': 2 }), svg('line', { x1: 484, y1: 168, x2: 500, y2: 168, stroke: 'var(--border)', 'stroke-width': 2 }));
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `t <b>${f.t * 100} ms</b>` }), el('span', { class: 'w-stat', html: `succeeded <b>${f.ok}</b>` }),
      el('span', { class: 'w-stat', html: `response timeouts <b>${f.rto}</b>` }), el('span', { class: 'w-stat', html: `acquire timeouts <b>${f.ato}</b>` }), el('span', { class: 'w-stat', html: `waiting <b>${f.wait}</b>` }));
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

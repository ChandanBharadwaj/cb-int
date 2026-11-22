/* HikariCP: ten pooled connections, a wait queue and Hikari's log, tick by tick (100 ms). Healthy vs long transactions vs a leak. */
IA.widget('hikari-pooling', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const POOL = 10; const RATE = 3; const TICKS = 40; const TIMEOUT = 20; const LEAK_T = 20;
  const MODES = {
    ok: { l: 'Healthy: 100 ms transactions', hold: () => 1, leak: () => false },
    long: { l: 'HTTP call inside @Transactional (800 ms)', hold: () => 8, leak: () => false },
    leak: { l: 'Leak: export path never closes', hold: () => 1, leak: (id) => id % 4 === 0 }
  };
  function simulate(m) {
    const M = MODES[m]; const slots = Array.from({ length: POOL }, () => null); let wait = []; let id = 0; let ok = 0; let to = 0; const log = []; const F = [];
    const snap = (t, cap, tone) => F.push({ t, cap, tone, slots: slots.map((s) => s && { id: s.id, age: t - s.ts, leak: s.leak, flagged: s.flagged }), wait: wait.map((w) => t - w.t0), ok, to, log: log.slice(-4) });
    snap(0, `${M.l}. Press Play.`, null);
    for (let t = 1; t <= TICKS; t++) {
      // returns
      slots.forEach((s, i) => { if (s && !s.leak && t - s.ts >= s.hold) { ok++; slots[i] = null; } });
      // leak detection
      slots.forEach((s) => { if (s && s.leak && !s.flagged && t - s.ts >= LEAK_T) { s.flagged = true; log.push(['warn', `WARN ProxyLeakTask : Connection leak detection triggered … on thread http-nio-8080-exec-${s.id % 200}, stack trace follows`]); log.push(['dim', '    at com.acme.report.CsvExporter.export(CsvExporter.java:88)']); } });
      // arrivals
      for (let a = 0; a < RATE; a++) { id++; wait.push({ id, t0: t }); }
      // timeouts
      const keep = []; let newTo = 0;
      wait.forEach((w) => { if (t - w.t0 >= TIMEOUT) { to++; newTo++; } else keep.push(w); }); wait = keep;
      // borrow
      slots.forEach((s, i) => { if (!s && wait.length) { const w = wait.shift(); slots[i] = { id: w.id, ts: t, hold: M.hold(w.id), leak: M.leak(w.id) }; } });
      const active = slots.filter(Boolean).length;
      if (newTo) log.push(['err', `SQLTransientConnectionException: HikariPool-1 - Connection is not available, request timed out after 2000ms (total=${POOL}, active=${active}, idle=${POOL - active}, waiting=${wait.length})`]);
      const leaked = slots.filter((s) => s && s.leak).length;
      let cap; let tone = null;
      if (m === 'ok') cap = `${t * 100} ms: about ${RATE} connections busy at any moment (30 req/s × 0.1 s). The other ${POOL - active} sit idle. Nobody waits.`;
      else if (m === 'long') { cap = wait.length ? `${t * 100} ms: demand = 30 req/s × 0.8 s = <b>24</b> connections, pool = 10. <b>${wait.length}</b> threads queue in <code>getConnection()</code>${newTo ? `, and <b>${newTo}</b> just timed out` : ''}. Postgres itself is idle: the connections are “idle in transaction” while the HTTP call runs.` : `${t * 100} ms: each request now holds its connection for 800 ms. The pool fills up.`; tone = newTo ? 'err' : wait.length ? 'warn' : null; }
      else { cap = `${t * 100} ms: ${leaked} connection${leaked === 1 ? '' : 's'} leaked so far${leaked >= POOL ? ': the pool is <b>empty for good</b>; every borrow now waits and times out' : '. The pool shrinks quietly; requests still succeed'}.${slots.some((s) => s && s.flagged) && log.length && log[log.length - 1][0] !== 'err' ? ' Leak detection has logged the borrower’s stack trace.' : ''}`; tone = newTo ? 'err' : leaked > 5 ? 'warn' : null; }
      snap(t, cap, tone);
    }
    const L = F[F.length - 1];
    snap(TICKS, m === 'ok' ? `After 4 s: ${L.ok} transactions, zero waits. Little’s law: 30 req/s × 0.1 s = 3 connections needed, 10 available.`
      : m === 'long' ? `After 4 s: ${L.ok} succeeded and ${L.to} timed out. A bigger pool would only move the problem to Postgres and the payment API. Take the HTTP call out of the transaction: hold time back to 100 ms → 3 connections needed.`
        : `After 4 s: ${L.ok} succeeded and ${L.to} timed out, all caused by one missing <code>close()</code>. Restarting “fixes” it until the leaks add up again. The leak-detection stack trace points at the line to fix.`, m === 'ok' ? 'ok' : 'err');
    return F;
  }
  let mode = 'long'; let F = simulate(mode); let k = 0; let gen = 0; let running = false; let speed = 900;
  const mkSeg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segM = mkSeg(Object.keys(MODES).map((x) => [x, MODES[x].l]), mode, (v) => { mode = v; F = simulate(v); reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = mkSeg([[1600, 'Slow'], [900, 'Normal'], [400, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const W = 700; const H = 250;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Ten pool slots with holders and hold times, and a queue of waiting threads with their wait times' });
  const logBox = el('pre', { style: { margin: '8px 0 0', padding: '10px 12px', fontSize: '11.5px', lineHeight: '1.5', minHeight: '76px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), logBox,
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 12, fill: 'var(--text)', text: t }, o || {}));
  function draw(f) {
    stage.innerHTML = '';
    stage.append(T(10, 18, `HikariPool-1 · maximumPoolSize ${POOL} · t = ${f.t * 100} ms`, { 'font-weight': 700, 'font-size': 12.5 }));
    f.slots.forEach((s, i) => {
      const x = 10 + (i % 5) * 70; const y = 30 + Math.floor(i / 5) * 62;
      const stroke = !s ? 'var(--border)' : s.leak ? 'var(--err)' : s.age >= 5 ? 'var(--warn)' : 'var(--accent)';
      stage.append(svg('rect', { x, y, width: 62, height: 54, rx: 8, fill: !s ? 'var(--surface)' : s.leak ? 'color-mix(in srgb, var(--err) 14%, var(--surface))' : 'var(--accent-soft)', stroke, 'stroke-width': s ? 1.8 : 1 }));
      stage.append(T(x + 31, y + 16, `conn ${i + 1}`, { 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-3)' }));
      if (s) {
        stage.append(T(x + 31, y + 33, `req ${s.id}`, { 'text-anchor': 'middle', 'font-size': 11, 'font-family': 'var(--mono)' }), T(x + 31, y + 47, s.leak ? (s.flagged ? 'LEAK ⚑' : 'never returned') : `${s.age * 100} ms`, { 'text-anchor': 'middle', 'font-size': 10, fill: s.leak ? 'var(--err)' : 'var(--text-2)', 'font-weight': s.leak ? 700 : 400 }));
      } else stage.append(T(x + 31, y + 36, 'idle', { 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-3)' }));
    });
    // wait queue
    const qx = 372; const qw = W - qx - 10;
    stage.append(svg('rect', { x: qx, y: 30, width: qw, height: 116, rx: 10, fill: 'var(--surface)', stroke: f.wait.length ? 'var(--warn)' : 'var(--border)' }));
    stage.append(T(qx + 10, 48, `waiting in getConnection(): ${f.wait.length}`, { 'font-size': 11.5, 'font-weight': 700 }));
    f.wait.slice(0, 60).forEach((w, i) => {
      const x = qx + 18 + (i % 15) * 20; const y = 66 + Math.floor(i / 15) * 20; const frac = Math.min(1, w / TIMEOUT);
      stage.append(svg('circle', { cx: x, cy: y, r: 7, fill: 'var(--surface-2)', stroke: frac > 0.75 ? 'var(--err)' : 'var(--warn)', 'stroke-width': 1.5 }));
      stage.append(svg('path', { d: `M${x} ${y} L${x} ${y - 7} A7 7 0 ${frac > 0.5 ? 1 : 0} 1 ${x + 7 * Math.sin(frac * 2 * Math.PI)} ${y - 7 * Math.cos(frac * 2 * Math.PI)} Z`, fill: frac > 0.75 ? 'var(--err)' : 'var(--warn)', opacity: frac >= 1 ? 0 : 0.8 }));
    });
    if (f.wait.length > 60) stage.append(T(W - 20, 140, `+${f.wait.length - 60}`, { 'text-anchor': 'end', fill: 'var(--err)', 'font-weight': 700 }));
    stage.append(T(qx + 10, 160, 'pie = time waited of the 2 s connectionTimeout', { 'font-size': 10, fill: 'var(--text-3)' }));
    // Postgres view
    const active = f.slots.filter(Boolean).length;
    stage.append(svg('rect', { x: 10, y: 168, width: W - 20, height: 70, rx: 10, fill: 'var(--surface-2)', stroke: 'var(--border)' }));
    stage.append(T(20, 188, 'Postgres: pg_stat_activity for this pool', { 'font-size': 11.5, 'font-weight': 700 }));
    const states = mode === 'long' ? `${active} × idle in transaction (ClientRead) while the app waits on HTTP` : mode === 'leak' ? `${f.slots.filter((s) => s && s.leak).length} × idle (leaked, state_change growing) · ${f.slots.filter((s) => s && !s.leak).length} × active` : `${active} × active (short) · ${POOL - active} × idle`;
    stage.append(T(20, 208, states, { 'font-size': 11, 'font-family': 'var(--mono)' }), T(20, 226, `server CPU: low. The bottleneck is how long connections are held, not Postgres.`, { 'font-size': 10.5, fill: 'var(--text-3)' }));
    logBox.innerHTML = '';
    if (!f.log.length) logBox.append(el('span', { text: '(Hikari log is quiet)', style: { color: 'var(--text-3)' } }));
    f.log.forEach(([lv, line]) => logBox.append(el('div', { text: line, style: { color: lv === 'err' ? 'var(--err)' : lv === 'warn' ? 'var(--warn)' : 'var(--text-3)', fontFamily: 'var(--mono)' } })));
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `hikaricp.connections.active <b>${active}</b>` }), el('span', { class: 'w-stat', html: `.idle <b>${POOL - active}</b>` }),
      el('span', { class: 'w-stat', html: `.pending <b>${f.wait.length}</b>` }), el('span', { class: 'w-stat', html: `.timeout <b>${f.to}</b>` }), el('span', { class: 'w-stat', html: `completed <b>${f.ok}</b>` }));
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

/* Read replicas and lag: write to the primary, read from a lagging replica, and three ways to get read-your-writes. */
IA.widget('postgres-in-production-replica', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let mode = 'naive'; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['naive', 'all reads → replica'], ['sticky', 'read primary after a write'], ['lsn', 'wait for the write’s LSN']], () => mode, (v) => { mode = v; reset(); }, 'Routing');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const st = svg('svg', { viewBox: '0 0 520 210', role: 'img', 'aria-label': 'App, primary and replica with WAL streaming between them' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, st), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  let S;
  const box = (x, y, w, title, line, hot, bad) => [svg('rect', { x, y, width: w, height: 62, rx: 10, fill: hot ? 'var(--accent-soft)' : 'var(--surface-2)', stroke: bad ? 'var(--err)' : hot ? 'var(--accent)' : 'var(--border)', 'stroke-width': hot || bad ? 2.5 : 1.2 }),
    svg('text', { x: x + w / 2, y: y + 24, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, fill: 'var(--text)', text: title }),
    svg('text', { x: x + w / 2, y: y + 46, 'text-anchor': 'middle', 'font-size': 13, fill: bad ? 'var(--err)' : 'var(--text-2)', text: line })];
  function draw() {
    st.innerHTML = '';
    st.append(...box(10, 74, 120, 'app', S.app, S.hot === 'app', S.bad));
    st.append(...box(250, 10, 150, 'primary', `LSN ${S.p} · status=${S.pv}`, S.hot === 'p'));
    st.append(...box(250, 138, 150, 'replica', `LSN ${S.r} · status=${S.rv}`, S.hot === 'r', S.bad));
    st.append(svg('line', { x1: 325, y1: 72, x2: 325, y2: 136, stroke: 'var(--warn)', 'stroke-width': 3, 'stroke-dasharray': '6 5' }),
      svg('text', { x: 336, y: 110, 'font-size': 13, fill: 'var(--warn)', text: S.p > S.r ? `WAL streaming… lag ${S.lag}` : 'caught up' }));
    if (S.arrow) { const [x2, y2] = S.arrow === 'p' ? [250, 40] : [250, 168]; st.append(svg('line', { x1: 130, y1: 105, x2, y2, stroke: 'var(--accent)', 'stroke-width': 2.5 })); }
  }
  function plan() {
    const s = [
      { run: () => { S.hot = 'p'; S.arrow = 'p'; S.app = 'POST /orders/7/pay'; S.p = 101; S.pv = 'paid'; S.lag = '300 ms'; }, t: 'The user pays. The write goes to the primary: <code>UPDATE orders SET status = \'paid\'</code>, committed at LSN 101. Async replication ships the WAL a moment later.' }
    ];
    if (mode === 'naive') {
      s.push({ run: () => { S.hot = 'r'; S.arrow = 'r'; S.app = 'GET /orders/7'; S.bad = true; }, t: 'The browser immediately reloads the order. The read-only route goes to the replica, which has replayed only up to LSN 100: <b>status = new</b>. “I paid, but it says unpaid!”, and the user pays twice.' });
      s.push({ run: () => { S.r = 101; S.rv = 'paid'; S.bad = false; S.hot = 'r'; S.arrow = null; S.app = 'refresh → paid'; }, t: '300 ms later the replica catches up. Replication lag is usually milliseconds, but spikes to seconds or minutes under heavy writes, vacuum, long replica queries, or network issues. Measure it: <code>SELECT now() - pg_last_xact_replay_timestamp()</code> on the replica, or <code>replay_lag</code> in <code>pg_stat_replication</code> on the primary.' });
    } else if (mode === 'sticky') {
      s.push({ run: () => { S.hot = 'p'; S.arrow = 'p'; S.app = 'GET /orders/7 (sticky)'; }, t: 'The app remembers “this user wrote within the last N seconds” (a cookie or session flag) and routes their reads to the <b>primary</b> for that window. The user sees <b>paid</b>.' });
      s.push({ run: () => { S.r = 101; S.rv = 'paid'; S.arrow = null; S.hot = null; S.app = 'later reads → replica'; }, t: 'After the window, reads go back to the replica. Simple and common. It only protects the user who wrote: other users may still briefly see the old status, which is usually fine.' });
    } else {
      s.push({ run: () => { S.hot = 'app'; S.app = 'remember LSN 101'; }, t: 'After the commit, the app reads <code>pg_current_wal_lsn()</code> (101) and keeps it with the user’s session or returns it as a token.' });
      s.push({ run: () => { S.hot = 'r'; S.arrow = 'r'; S.app = 'wait: replay ≥ 101?'; }, t: 'Before reading from the replica it checks <code>pg_last_wal_replay_lsn() &gt;= \'0/101\'</code>. Not yet: it waits briefly (or falls back to the primary after a timeout).' });
      s.push({ run: () => { S.r = 101; S.rv = 'paid'; S.app = 'GET → paid'; }, t: 'The replica reaches LSN 101 and the read returns <b>paid</b>. Exact read-your-writes, with replicas still taking the load. More moving parts, so most teams start with the sticky window.' });
    }
    return s;
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; S = { p: 100, r: 100, pv: 'new', rv: 'new', app: 'idle', hot: null, arrow: null, bad: false, lag: '0' }; steps = plan(); bStep.disabled = false; draw(); say('An app with one primary and one async streaming replica. Pick a routing strategy and press Play.'); }
  function step() { if (k >= steps.length) return false; const x = steps[k++]; x.run(); draw(); say(x.t); if (k >= steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => { if (running) { running = false; bPlay.textContent = '▶ Play'; return; } if (k >= steps.length) reset(); running = true; bPlay.textContent = '⏸ Pause'; const g = gen; while (running && g === gen && step()) await sleep(reduced ? 700 : speed); if (g === gen) { running = false; bPlay.textContent = '▶ Play'; } });
  reset();
});

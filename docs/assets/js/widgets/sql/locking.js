/* Locking: THE lock queue incident. A long SELECT holds ACCESS SHARE, ALTER TABLE waits for ACCESS EXCLUSIVE, and every later query queues behind the ALTER. */
IA.widget('locking', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-lock-style')) {
    document.head.append(el('style', { id: 'w-lock-style', text: `
.w-lock-board { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); gap: 10px; }
@media (max-width: 620px) { .w-lock-board { grid-template-columns: 1fr; } }
.w-lock-box { border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; background: var(--surface-2); min-width: 0; }
.w-lock-box h5 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-3); }
.w-lock-chip { display: flex; gap: 8px; align-items: baseline; border: 1px solid var(--border); border-radius: 8px; padding: 5px 8px; margin: 4px 0; background: var(--surface); font-size: 12.5px; animation: capin .35s ease both; min-width: 0; }
.w-lock-chip b { font-family: var(--mono); flex: none; }
.w-lock-chip code { overflow-wrap: anywhere; }
.w-lock-chip .m { margin-left: auto; font-family: var(--mono); font-size: 11px; color: var(--text-3); flex: none; }
.w-lock-chip.g { border-color: var(--ok); }
.w-lock-chip.w { border-color: var(--warn); border-style: dashed; }
.w-lock-chip.x { border-color: var(--err); opacity: .6; text-decoration: line-through; }
.w-lock-chip.done { opacity: .45; }
.w-lock-pool { display: flex; gap: 3px; flex-wrap: wrap; margin-top: 6px; }
.w-lock-pool span { width: 16px; height: 16px; border-radius: 4px; background: var(--surface); border: 1px solid var(--border); }
.w-lock-pool span.busy { background: var(--warn); border-color: var(--warn); }
.w-lock-pool span.full { background: var(--err); border-color: var(--err); }
` }));
  }
  const MODES = { AS: 'ACCESS SHARE', RE: 'ROW EXCLUSIVE', SUE: 'SHARE UPDATE EXCL', AE: 'ACCESS EXCLUSIVE' };
  const CONF = { AS: ['AE'], RE: ['AE'], SUE: ['SUE', 'AE'], AE: ['AS', 'RE', 'SUE', 'AE'] }; // subset of the full matrix used here
  let ddl = 'alter'; let lt = 'none';
  let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segD = seg([['alter', 'ALTER TABLE … ADD COLUMN'], ['cic', 'CREATE INDEX CONCURRENTLY']], () => ddl, (v) => { ddl = v; reset(); }, 'Migration statement');
  const segT = seg([['none', 'lock_timeout = 0 (default)'], ['2s', "SET lock_timeout = '2s'"]], () => lt, (v) => { lt = v; reset(); }, 'lock_timeout');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const granted = el('div'); const queue = el('div'); const pool = el('div', { class: 'w-lock-pool' }); const clock = el('div', { class: 'tiny' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segD), el('div', { class: 'w-controls' }, segT),
    el('div', { class: 'w-lock-board' },
      el('div', { class: 'w-lock-box' }, el('h5', { text: 'lock on table orders: granted' }), granted, el('h5', { text: 'Hikari pool (20 connections)', style: { marginTop: '10px' } }), pool, clock),
      el('div', { class: 'w-lock-box' }, el('h5', { text: 'wait queue (FIFO)' }), queue)),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  let G; let Q; let busy; let t; let errs; let gone;
  const chip = (r, cls) => el('div', { class: 'w-lock-chip ' + cls }, el('b', { text: r.who }), el('code', { text: r.sql }), el('span', { class: 'm', text: MODES[r.mode] }));
  function render() {
    const more = (n) => el('div', { class: 'tiny', text: `+ ${n} more` });
    granted.innerHTML = ''; G.slice(0, 6).forEach((r) => granted.append(chip(r, 'g'))); if (G.length > 6) granted.append(more(G.length - 6));
    if (!G.length) granted.append(el('div', { class: 'tiny', text: '(none)' }));
    queue.innerHTML = ''; Q.slice(0, 6).forEach((r) => queue.append(chip(r, 'w'))); if (Q.length > 6) queue.append(more(Q.length - 6)); gone.forEach((r) => queue.append(chip(r, 'x')));
    if (!Q.length && !gone.length) queue.append(el('div', { class: 'tiny', text: '(empty)' }));
    pool.innerHTML = ''; for (let i = 0; i < 20; i++) pool.append(el('span', { class: i < busy ? (busy >= 20 ? 'busy full' : 'busy') : '' }));
    clock.textContent = 't = ' + t;
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `waiting <b>${Q.length}</b>` }), el('span', { class: 'w-stat', html: `connections busy <b>${busy}/20</b>` }), el('span', { class: 'w-stat', html: `app errors <b>${errs}</b>` }));
  }
  // can r be granted now? It must not conflict with any granted lock NOR with anyone queued ahead of it.
  const conflicts = (a, b) => CONF[a].includes(b) || CONF[b].includes(a);
  const canGrant = (r, ahead) => !G.some((g) => conflicts(r.mode, g.mode)) && !ahead.some((q) => conflicts(r.mode, q.mode));
  function arrive(r) { const ok = canGrant(r, Q); if (ok) G.push(r); else Q.push(r); busy++; return ok; }
  function drain() { const out = []; let i = 0; while (i < Q.length) { const r = Q[i]; if (canGrant(r, Q.slice(0, i))) { Q.splice(i, 1); G.push(r); out.push(r.who); } else i++; } return out; }
  function plan() {
    const isAlter = ddl === 'alter';
    const mig = { who: 'S2', sql: isAlter ? 'ALTER TABLE orders ADD COLUMN note text' : 'CREATE INDEX CONCURRENTLY … ON orders(created_at)', mode: isAlter ? 'AE' : 'SUE' };
    const st = [];
    st.push({ run: () => { t = '09:00:00'; arrive({ who: 'S1', sql: 'SELECT … FROM orders JOIN … (report, 10 min)', mode: 'AS' }); },
      t: 'S1 starts a 10-minute analytics query. Any SELECT takes <b>ACCESS SHARE</b> on the table, which conflicts only with ACCESS EXCLUSIVE. Nobody notices.' });
    st.push({ run: () => { t = '09:01:00'; mig.ok = arrive(mig); },
      t: () => mig.ok ? `The deploy runs the migration. <code>CREATE INDEX CONCURRENTLY</code> takes <b>SHARE UPDATE EXCLUSIVE</b>, which doesn’t conflict with ACCESS SHARE or ROW EXCLUSIVE. It is granted (it will still wait for S1 to finish before it completes, but it blocks nobody).`
        : `The deploy runs <code>ALTER TABLE … ADD COLUMN</code>. The change itself would take milliseconds, but it needs <b>ACCESS EXCLUSIVE</b>, which conflicts with S1’s ACCESS SHARE. S2 <b>waits</b>.` + (lt === 'none' ? ' With lock_timeout = 0 it waits forever.' : '') });
    ['S3', 'S4', 'S5'].forEach((who, i) => {
      const r = i === 1 ? { who, sql: "INSERT INTO orders … (checkout)", mode: 'RE' } : { who, sql: 'SELECT * FROM orders WHERE id = $1', mode: 'AS' };
      st.push({ run: () => { t = `09:01:0${i + 1}`; r.ok = arrive(r); if (!r.ok && !isAlter) { /* never happens */ } },
        t: () => r.ok ? `${who} (${MODES[r.mode]}) is compatible with everything granted and queued, so it runs right away.`
          : i === 0 ? `S3 is a 1 ms primary-key lookup. ACCESS SHARE is compatible with S1, <b>but not with S2 waiting ahead of it</b>. Postgres grants locks fairly, in queue order, so S3 queues behind the ALTER. This is the surprise.`
          : `${who} queues too. Every request on <code>orders</code> now lines up behind a statement that hasn’t even started.` });
    });
    if (!isAlter) {
      st.push({ run: () => { t = '09:11:00'; G = G.filter((g) => g.who !== 'S1'); busy--; }, t: 'S1 finishes. CIC moves on through its phases (it waits for older transactions at each one). The application never stalled. Use CONCURRENTLY for indexes on busy tables.' });
      return st;
    }
    if (lt === '2s') {
      st.push({ run: () => { t = '09:01:02'; Q = Q.filter((q) => q !== mig); gone = [mig]; busy--; drain(); },
        t: '2 s later S2 hits <code>lock_timeout</code>: <code>ERROR: canceling statement due to lock timeout</code>. It leaves the queue, and S3, S4 and S5 are granted at once. The outage lasted 2 seconds, and the migration tool can simply retry later.' });
      st.push({ run: () => { t = '09:01:03'; G = G.filter((g) => g.who === 'S1'); busy = 1; }, t: 'S3–S5 finish in milliseconds. Pattern: <code>SET lock_timeout = \'2s\'</code> + retry with back-off for every DDL on a busy table.' });
      return st;
    }
    st.push({ run: () => { t = '09:01:30'; for (let i = 0; i < 15; i++) Q.push({ who: 'S' + (6 + i), sql: i % 3 ? 'SELECT … FROM orders' : 'UPDATE orders SET …', mode: i % 3 ? 'AS' : 'RE' }); busy = 20; },
      t: 'Within 30 s every request thread is stuck waiting on <code>orders</code>. Hikari’s 20 connections are all busy, so even requests that never touch <code>orders</code> can’t get a connection.' });
    st.push({ run: () => { t = '09:02:00'; errs = 312; }, t: '<code>Connection is not available, request timed out after 30000ms</code>. Health checks fail, pods restart, and the incident channel lights up, all for an ADD COLUMN that needs a millisecond. In <code>pg_stat_activity</code> every session shows <code>wait_event_type = Lock</code>; <code>pg_blocking_pids()</code> leads you to S1.' });
    st.push({ run: () => { t = '09:11:00'; G = []; busy--; drain(); }, t: 'S1 finally finishes (or someone runs <code>pg_cancel_backend</code> on it). S2 gets ACCESS EXCLUSIVE, adds the column in a millisecond…' });
    st.push({ run: () => { t = '09:11:00'; G = G.filter((g) => g !== mig); busy--; drain(); }, t: '…and commits. The whole queue is granted at once: S3 and S5 share ACCESS SHARE with the ROW EXCLUSIVE writers. Fix for next time: lock_timeout + retries, and kill long queries before DDL.' });
    st.push({ run: () => { G = []; Q = []; busy = 0; }, t: 'Queue empty. Total outage: 10 minutes, caused by a 1 ms statement waiting behind a 10-minute one.' });
    return st;
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; G = []; Q = []; gone = []; busy = 0; t = '09:00:00'; errs = 0; steps = plan(); bStep.disabled = false; render();
    say('A busy <code>orders</code> table. Pick the migration and the lock_timeout, then press Play.'); }
  function step() { if (k >= steps.length) return false; const s = steps[k++]; s.run(); render(); say(typeof s.t === 'function' ? s.t() : s.t); if (k >= steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => { if (running) { running = false; bPlay.textContent = '▶ Play'; return; } if (k >= steps.length) reset(); running = true; bPlay.textContent = '⏸ Pause'; const g = gen; while (running && g === gen && step()) await sleep(reduced ? 700 : speed); if (g === gen) { running = false; bPlay.textContent = '▶ Play'; } });
  reset();
});

/* Deadlocks: T1 locks A then wants B, T2 the reverse. A wait-for cycle forms; after deadlock_timeout the detector kills one. */
IA.widget('deadlocks-optimistic', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let mode = 'dead'; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['dead', 'opposite order → deadlock'], ['retry', 'deadlock + app retries'], ['order', 'consistent order (by id)']], () => mode, (v) => { mode = v; reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const st = svg('svg', { viewBox: '0 0 560 300', role: 'img', 'aria-label': 'Wait-for graph: two transactions, two rows, arrows for held and awaited locks' });
  const sql = el('div', { class: 'tscroll', style: { marginTop: '8px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, st), sql, el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const T = { T1: { x: 90, y: 150 }, T2: { x: 470, y: 150 } }; const R = { A: { x: 280, y: 60 }, B: { x: 280, y: 240 } };
  let S; // { hold: {A:'T1'}, wait: {T1:'B'}, tx: {T1:'running'}, log: [], clock }
  const defs = svg('defs', null, ['ok', 'warn', 'err'].map((c) => svg('marker', { id: 'w-dl-' + c, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: `var(--${c})` }))));
  function edge(a, b, color, dashed) { const dx = b.x - a.x; const dy = b.y - a.y; const L = Math.hypot(dx, dy); const ux = dx / L; const uy = dy / L;
    const p = svg('line', { x1: a.x + ux * 48, y1: a.y + uy * 34, x2: b.x - ux * 52, y2: b.y - uy * 30, stroke: `var(--${color})`, 'stroke-width': 3, 'stroke-dasharray': dashed ? '7 5' : '', 'marker-end': `url(#w-dl-${color})` });
    if (!reduced) { p.style.opacity = '0'; p.style.transition = 'opacity .5s'; requestAnimationFrame(() => { p.style.opacity = '1'; }); } return p; }
  function draw() {
    st.innerHTML = ''; st.append(defs);
    const cyc = S.wait.T1 && S.wait.T2 && S.hold[S.wait.T1] === 'T2' && S.hold[S.wait.T2] === 'T1';
    Object.entries(S.hold).forEach(([r, t]) => { if (t) st.append(edge(R[r], T[t], 'ok', false)); });
    Object.entries(S.wait).forEach(([t, r]) => { if (r) st.append(edge(T[t], R[r], cyc ? 'err' : 'warn', true)); });
    Object.entries(T).forEach(([n, p]) => { const s = S.tx[n];
      st.append(svg('circle', { cx: p.x, cy: p.y, r: 46, fill: s === 'ABORTED' ? 'var(--surface)' : 'var(--surface-2)', stroke: s === 'ABORTED' ? 'var(--err)' : s === 'COMMIT' ? 'var(--ok)' : 'var(--accent)', 'stroke-width': 3 }),
        svg('text', { x: p.x, y: p.y - 4, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 700, fill: 'var(--text)', text: n }),
        svg('text', { x: p.x, y: p.y + 17, 'text-anchor': 'middle', 'font-size': 14, fill: s === 'ABORTED' ? 'var(--err)' : 'var(--text-2)', text: s })); });
    Object.entries(R).forEach(([n, p]) => { st.append(svg('rect', { x: p.x - 50, y: p.y - 24, width: 100, height: 48, rx: 9, fill: S.hold[n] ? 'var(--accent-soft)' : 'var(--surface)', stroke: 'var(--border)', 'stroke-width': 1.5 }),
      svg('text', { x: p.x, y: p.y - 3, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 700, fill: 'var(--text)', text: 'row ' + n }),
      svg('text', { x: p.x, y: p.y + 14, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--text-3)', text: n === 'A' ? 'accounts id=1' : 'accounts id=2' })); });
    if (cyc) st.append(svg('text', { x: 280, y: 155, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, fill: 'var(--err)', text: 'CYCLE' }));
    st.append(svg('text', { x: 10, y: 292, 'font-size': 14, fill: 'var(--text-3)', text: 't = ' + S.clock + ' · solid = holds · dashed = waits for' }));
    const tb = el('tbody'); S.log.forEach(([t1, t2]) => tb.append(el('tr', null, el('td', { html: t1 || '' }), el('td', { html: t2 || '' }))));
    sql.innerHTML = ''; sql.append(el('table', { class: 't rg', style: { minWidth: '480px', fontFamily: 'var(--mono)', fontSize: '12.5px' } }, el('thead', null, el('tr', null, el('th', { text: 'T1: transfer 1 → 2' }), el('th', { text: 'T2: transfer 2 → 1' }))), tb));
    stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: 'deadlock_timeout <b>1s</b>' }), el('span', { class: 'w-stat', html: `deadlocks <b>${S.dl}</b>` }), el('span', { class: 'w-stat', html: `transfers committed <b>${S.ok}</b>/2` }));
  }
  const U = (id, d) => `UPDATE accounts SET bal = bal ${d} WHERE id = ${id};`;
  function plan() {
    const s = [];
    if (mode === 'order') {
      s.push({ run: () => { S.hold.A = 'T1'; S.log.push([U(1, '- 100'), '']); S.clock = '0.0 s'; }, t: 'Both transfers touch accounts 1 and 2. The rule: <b>always lock the lower id first</b>. T1 (1 → 2) locks row A (id 1).' });
      s.push({ run: () => { S.wait.T2 = 'A'; S.log.push(['', U(1, '+ 100') + ' <span style="color:var(--warn)">⏳</span>']); S.clock = '0.1 s'; }, t: 'T2 (2 → 1) also starts with id 1, not with “its” account 2. Row A is taken, so T2 waits, <b>holding nothing</b>. A waiter that holds nothing can’t close a cycle.' });
      s.push({ run: () => { S.hold.B = 'T1'; S.log.push([U(2, '+ 100'), '']); S.clock = '0.2 s'; }, t: 'T1 locks row B. No one holds it, no one waits for it.' });
      s.push({ run: () => { S.hold = { A: null, B: null }; S.tx.T1 = 'COMMIT'; S.ok++; S.log.push(['COMMIT;', '']); S.clock = '0.3 s'; }, t: 'T1 commits and releases both locks.' });
      s.push({ run: () => { S.wait.T2 = null; S.hold.A = 'T2'; S.hold.B = 'T2'; S.log.push(['', '… ' + U(2, '- 100')]); S.clock = '0.3 s'; }, t: 'T2 wakes up, gets A, then B. Some waiting, but no deadlock possible. In code: sort ids, or <code>SELECT … WHERE id IN (1,2) ORDER BY id FOR UPDATE</code> first.' });
      s.push({ run: () => { S.hold = { A: null, B: null }; S.tx.T2 = 'COMMIT'; S.ok++; S.log.push(['', 'COMMIT;']); }, t: 'Both transfers committed. Zero errors.' });
      return s;
    }
    s.push({ run: () => { S.hold.A = 'T1'; S.log.push([U(1, '- 100'), '']); S.clock = '0.0 s'; }, t: 'T1 transfers 100 from account 1 to 2. It debits 1 first: row lock on <b>A</b>.' });
    s.push({ run: () => { S.hold.B = 'T2'; S.log.push(['', U(2, '- 100')]); S.clock = '0.0 s'; }, t: 'At the same moment, T2 transfers from 2 to 1. It debits 2 first: row lock on <b>B</b>.' });
    s.push({ run: () => { S.wait.T1 = 'B'; S.log.push([U(2, '+ 100') + ' <span style="color:var(--warn)">⏳</span>', '']); S.clock = '0.0 s'; }, t: 'T1 now wants B, which T2 holds. T1 waits (on T2’s transaction id) and starts its <code>deadlock_timeout</code> timer (1 s).' });
    s.push({ run: () => { S.wait.T2 = 'A'; S.log.push(['', U(1, '+ 100') + ' <span style="color:var(--err)">⏳</span>']); S.clock = '0.4 s'; }, t: 'T2 wants A, which T1 holds. Now T1 waits for T2 and T2 waits for T1: a <b>cycle</b>. Neither can ever proceed. Postgres doesn’t check immediately; checking is expensive, and most waits end on their own.' });
    s.push({ run: () => { S.tx.T1 = 'ABORTED'; S.wait.T1 = null; S.hold.A = null; S.dl++; S.log.push(['<span style="color:var(--err)">ERROR: deadlock detected</span>', '']); S.clock = '1.0 s'; },
      t: 'At 1.0 s T1’s timer fires. It runs the deadlock detector, which walks the wait-for graph, finds the cycle, and <b>aborts the transaction that ran the check</b>: T1. <code>ERROR: deadlock detected</code>, SQLSTATE <code>40P01</code>. Its locks are released.' });
    s.push({ run: () => { S.wait.T2 = null; S.hold.A = 'T2'; S.log.push(['', '… UPDATE 1']); S.clock = '1.0 s'; }, t: 'T2’s wait on A ends and its UPDATE completes. The server log has both queries and both PIDs (“Process 123 waits for ShareLock on transaction 456; blocked by process 789”).' });
    s.push({ run: () => { S.hold = { A: null, B: null }; S.tx.T2 = 'COMMIT'; S.ok++; S.log.push(['', 'COMMIT;']); S.clock = '1.1 s'; }, t: 'T2 commits.' + (mode === 'dead' ? ' T1’s transfer is <b>lost</b> unless the application retries. Every app that can deadlock needs a retry for 40P01 (and 40001).' : '') });
    if (mode === 'retry') {
      s.push({ run: () => { S.tx.T1 = 'retry #1'; S.hold.A = 'T1'; S.log.push(['ROLLBACK; -- back-off 50 ms, retry', ''], [U(1, '- 100'), '']); S.clock = '1.2 s'; }, t: 'The app catches 40P01, rolls back, waits a short random back-off and <b>re-runs the whole transaction</b> (not just the failed statement).' });
      s.push({ run: () => { S.hold.B = 'T1'; S.log.push([U(2, '+ 100'), '']); }, t: 'This time T2 is gone, so T1 gets both rows.' });
      s.push({ run: () => { S.hold = { A: null, B: null }; S.tx.T1 = 'COMMIT'; S.ok++; S.log.push(['COMMIT;', '']); }, t: 'Both transfers committed, one retry. Retries hide occasional deadlocks; a consistent lock order removes them.' });
    }
    return s;
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; S = { hold: { A: null, B: null }, wait: { T1: null, T2: null }, tx: { T1: 'BEGIN', T2: 'BEGIN' }, log: [], clock: '0.0 s', dl: 0, ok: 0 }; steps = plan(); bStep.disabled = false; draw();
    say('Two money transfers in opposite directions. Pick a scenario and press Play.'); }
  function step() { if (k >= steps.length) return false; const x = steps[k++]; x.run(); draw(); say(x.t); if (k >= steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => { if (running) { running = false; bPlay.textContent = '▶ Play'; return; } if (k >= steps.length) reset(); running = true; bPlay.textContent = '⏸ Pause'; const g = gen; while (running && g === gen && step()) await sleep(reduced ? 700 : speed); if (g === gen) { running = false; bPlay.textContent = '▶ Play'; } });
  reset();
});

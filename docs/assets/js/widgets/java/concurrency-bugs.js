/* Concurrency bugs: a lost update interleaving, the CAS retry that fixes it, a deadlock wait-for cycle with its thread dump, a livelock, and AtomicLong vs LongAdder contention. */
IA.widget('concurrency-bugs', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let mode = 'lost'; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['lost', 'lost update (count++)'], ['cas', 'CAS retry (AtomicInteger)'], ['deadlock', 'deadlock + thread dump'], ['livelock', 'livelock'], ['adder', 'AtomicLong vs LongAdder']], () => mode, (v) => { mode = v; reset(); }, 'Bug');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const W = 760, H = 330;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Interleaving of two threads over shared state, or a wait-for graph of threads and locks' });
  const codeHost = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const dumpHost = el('div', { class: 'codebox', style: { marginTop: '10px', display: 'none' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), codeHost, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats, dumpHost);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const code = (src) => { codeHost.innerHTML = ''; codeHost.append(el('pre', { html: IA.highlight(src, 'java') })); };
  const R = (x, y, w, h, o = {}) => svg('rect', { x, y, width: w, height: h, rx: o.rx == null ? 7 : o.rx, fill: o.fill || 'var(--surface)', stroke: o.stroke || 'var(--border)', 'stroke-width': o.sw || 1, 'stroke-dasharray': o.dash || null });
  const T = (x, y, s, o = {}) => svg('text', { x, y, 'font-size': o.fs || 12, 'font-weight': o.fw || null, 'text-anchor': o.a || 'start', 'font-family': o.mono ? 'var(--mono)' : null, fill: o.fill || 'var(--text)', text: s });
  function arrow(x1, y1, x2, y2, col, w, dash, bend) {
    const mx = (x1 + x2) / 2 + (bend || 0) * (y2 - y1) / 200, my = (y1 + y2) / 2 - (bend || 0) * (x2 - x1) / 200;
    const g = svg('g'); g.append(svg('path', { d: `M${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`, fill: 'none', stroke: col, 'stroke-width': w || 2, 'stroke-dasharray': dash || null }));
    const a = Math.atan2(y2 - my, x2 - mx), s = 9;
    g.append(svg('polygon', { points: `${x2},${y2} ${x2 - s * Math.cos(a - 0.45)},${y2 - s * Math.sin(a - 0.45)} ${x2 - s * Math.cos(a + 0.45)},${y2 - s * Math.sin(a + 0.45)}`, fill: col }));
    return g;
  }
  const C = { ok: 'var(--ok)', err: 'var(--err)', warn: 'var(--warn)', acc: 'var(--accent)', dim: 'var(--text-3)' };

  let S;
  /* ---------- timeline (lost, cas, livelock) ---------- */
  function renderTimeline() {
    const [lh, mh, rh] = S.heads;
    stage.append(T(160, 24, lh, { a: 'middle', fw: 700, fs: 13 }), T(380, 24, mh, { a: 'middle', fw: 700, fs: 13 }), T(600, 24, rh, { a: 'middle', fw: 700, fs: 13 }));
    stage.append(R(320, 34, 120, 270, { fill: 'var(--surface-2)' }));
    S.rows.forEach((r, i) => {
      const y = 42 + i * 32; const last = i === S.rows.length - 1;
      if (r.l) { stage.append(R(20, y, 280, 26, { fill: last ? 'var(--accent-soft)' : 'var(--surface)', stroke: r.lc || 'var(--border)', sw: r.lc ? 1.8 : 1 })); stage.append(T(30, y + 17, r.l, { mono: true, fs: 11.5, fill: r.lc === C.err ? C.err : 'var(--text)' })); }
      if (r.r) { stage.append(R(460, y, 280, 26, { fill: last ? 'var(--accent-soft)' : 'var(--surface)', stroke: r.rc || 'var(--border)', sw: r.rc ? 1.8 : 1 })); stage.append(T(470, y + 17, r.r, { mono: true, fs: 11.5, fill: r.rc === C.err ? C.err : 'var(--text)' })); }
      if (r.m != null) stage.append(T(380, y + 17, r.m, { a: 'middle', mono: true, fs: 13, fw: 700, fill: r.mc || 'var(--text)' }));
      if (r.l && r.ml) stage.append(arrow(300, y + 13, 334, y + 13, r.lc || C.dim, 1.5));
      if (r.r && r.mr) stage.append(arrow(460, y + 13, 426, y + 13, r.rc || C.dim, 1.5));
    });
  }
  /* ---------- wait-for graph ---------- */
  const GN = { A: [210, 80], B: [550, 80], T1: [210, 240], T2: [550, 240] };
  function renderGraph() {
    stage.append(T(16, 22, 'wait-for graph', { fw: 700, fs: 13 }));
    const cyc = S.cycle;
    S.ge.forEach(([a, b, kind]) => {
      const [x1, y1] = GN[a], [x2, y2] = GN[b];
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
      const off = (n) => (n === 'A' || n === 'B' ? 34 : 40);
      const sx = x1 + dx / L * off(a), sy = y1 + dy / L * off(a), ex = x2 - dx / L * off(b), ey = y2 - dy / L * off(b);
      const col = cyc ? C.err : kind === 'holds' ? C.ok : C.warn;
      stage.append(arrow(sx, sy, ex, ey, col, cyc ? 3 : 2, kind === 'waits' ? '6 4' : null, kind === 'waits' ? 30 : 0));
      const mx = (sx + ex) / 2, my = (sy + ey) / 2;
      stage.append(T(mx + (kind === 'holds' ? -10 : 10), my - 6, kind === 'holds' ? 'held by' : 'waits for', { a: kind === 'holds' ? 'end' : 'start', fs: 11, fw: 700, fill: col }));
    });
    Object.entries(GN).forEach(([n, [x, y]]) => {
      const isLock = n === 'A' || n === 'B';
      const hot = S.hotN === n;
      if (isLock) {
        stage.append(R(x - 70, y - 24, 140, 48, { rx: 8, fill: hot ? 'var(--accent-soft)' : 'var(--surface-2)', stroke: hot ? C.acc : 'var(--border)', sw: hot ? 2 : 1 }));
        stage.append(T(x, y - 4, `Account ${n === 'A' ? '#1' : '#2'}`, { a: 'middle', fs: 12.5, fw: 700 }));
        stage.append(T(x, y + 13, `monitor <0x…${n === 'A' ? 'c10' : 'c48'}>`, { a: 'middle', fs: 10.5, mono: true, fill: C.dim }));
      } else {
        const st = S.tstate[n];
        stage.append(svg('circle', { cx: x, cy: y, r: 40, fill: hot ? 'var(--accent-soft)' : 'var(--surface)', stroke: st === 'BLOCKED' ? C.err : C.acc, 'stroke-width': 2 }));
        stage.append(T(x, y - 4, n === 'T1' ? 'transfer-7' : 'transfer-3', { a: 'middle', fs: 11.5, fw: 700, mono: true }));
        stage.append(T(x, y + 13, st, { a: 'middle', fs: 10.5, fw: 700, fill: st === 'BLOCKED' ? C.err : C.acc }));
      }
    });
    if (S.cycle) stage.append(T(380, 165, 'cycle → deadlock', { a: 'middle', fs: 15, fw: 700, fill: C.err }));
    if (S.sub) stage.append(T(380, H - 12, S.sub, { a: 'middle', fs: 12, fill: 'var(--text-2)' }));
  }
  /* ---------- adder ---------- */
  function renderAdder() {
    stage.append(T(16, 22, S.adder ? 'LongAdder: base + striped cells' : 'AtomicLong: one value, one cache line', { fw: 700, fs: 13 }));
    const n = S.thr.length;
    S.thr.forEach((t, i) => {
      const x = 70 + i * 120, y = 70;
      stage.append(svg('circle', { cx: x, cy: y, r: 24, fill: 'var(--surface)', stroke: t.res === 'fail' ? C.err : t.res === 'ok' ? C.ok : 'var(--border)', 'stroke-width': 2 }));
      stage.append(T(x, y + 4, 'T' + (i + 1), { a: 'middle', fs: 12, fw: 700, mono: true }));
      if (t.res) stage.append(T(x, y - 32, t.res === 'ok' ? 'CAS ✓' : 'CAS ✗ retry', { a: 'middle', fs: 10.5, fw: 700, fill: t.res === 'ok' ? C.ok : C.err }));
      if (t.cell != null && t.res) {
        const cx = S.adder ? S.cellX(t.cell) + 50 : 380;
        stage.append(arrow(x, y + 24, cx, 196, t.res === 'ok' ? C.ok : C.err, 1.6, t.res === 'fail' ? '4 3' : null));
      }
    });
    if (!S.adder) {
      stage.append(R(300, 200, 160, 56, { fill: 'var(--surface-2)', stroke: S.hotCell ? C.err : 'var(--border)', sw: 2 }));
      stage.append(T(380, 222, 'value', { a: 'middle', fs: 11, fill: C.dim }));
      stage.append(T(380, 244, String(S.value), { a: 'middle', fs: 16, fw: 700, mono: true }));
    } else {
      S.cells.forEach((v, j) => {
        const x = S.cellX(j);
        stage.append(R(x, 200, 100, 56, { fill: 'var(--surface-2)', stroke: S.hotCells.includes(j) ? C.ok : 'var(--border)', sw: S.hotCells.includes(j) ? 2 : 1 }));
        stage.append(T(x + 50, 222, j === 0 ? 'base' : `cell[${j - 1}]`, { a: 'middle', fs: 11, fill: C.dim }));
        stage.append(T(x + 50, 244, String(v), { a: 'middle', fs: 16, fw: 700, mono: true }));
      });
      if (S.sum != null) stage.append(T(380, 290, `sum() = ${S.cells.join(' + ')} = ${S.sum}`, { a: 'middle', fs: 13, fw: 700, mono: true, fill: C.ok }));
    }
    if (S.sub) stage.append(T(380, H - 10, S.sub, { a: 'middle', fs: 12, fill: 'var(--text-2)' }));
    void n;
  }
  function render() {
    stage.innerHTML = '';
    if (mode === 'deadlock') renderGraph(); else if (mode === 'adder') renderAdder(); else renderTimeline();
    if (S.banner) stage.append(T(W - 16, 22, S.banner, { a: 'end', fs: 12.5, fw: 700, fill: S.bannerC || 'var(--text)' }));
    dumpHost.style.display = mode === 'deadlock' && S.dump ? '' : 'none';
    if (mode === 'deadlock') { dumpHost.innerHTML = ''; dumpHost.append(el('pre', { text: S.dump || '' })); }
    statLine();
  }
  function statLine() {
    stats.innerHTML = ''; const add = (h) => stats.append(el('span', { class: 'w-stat', html: h }));
    if (mode === 'lost' || mode === 'cas') { add(`increments completed <b>${S.tries}</b>`); add(`count <b>${S.count}</b>`); add(`lost <b>${Math.max(0, S.tries - (S.count - 5))}</b>`); if (mode === 'cas') add(`CAS failures <b>${S.fails}</b>`); }
    else if (mode === 'livelock') { add(`attempts <b>${S.attempts}</b>`); add(`work done <b>${S.work}</b>`); }
    else if (mode === 'deadlock') { add(`threads BLOCKED <b>${Object.values(S.tstate).filter((x) => x === 'BLOCKED').length}</b>`); add(`cycle <b>${S.cycle ? 'yes' : 'no'}</b>`); }
    else { add(`increments <b>${S.total}</b>`); add(`CAS failures <b>${S.fails}</b>`); }
  }
  const row = (r) => S.rows.push(r);
  const P = (st, run, t) => st.push({ run, t });

  function plan() {
    const st = [];
    if (mode === 'lost') {
      code('private int count = 5;            // shared, no lock\nvoid hit() { count++; }            // really: tmp = count; tmp = tmp + 1; count = tmp;');
      S.heads = ['Thread 1', 'count (memory)', 'Thread 2'];
      P(st, () => { row({ m: '5' }); }, 'Two request threads call <code>hit()</code> at the same moment. <code>count</code> is 5.');
      P(st, () => { row({ l: 'tmp = count      // 5', ml: true, m: '5' }); }, 'T1 <b>loads</b> 5 into a register.');
      P(st, () => { row({ r: 'tmp = count      // 5', mr: true, m: '5' }); }, 'Before T1 writes back, T2 also loads <b>5</b>. Both now hold the same stale value.');
      P(st, () => { row({ l: 'tmp = tmp + 1    // 6', m: '5' }); }, 'T1 adds one: 6.');
      P(st, () => { row({ r: 'tmp = tmp + 1    // 6', m: '5' }); }, 'T2 adds one: 6.');
      P(st, () => { row({ l: 'count = tmp      // store 6', ml: true, lc: C.acc, m: '6', mc: C.acc }); S.count = 6; S.tries = 1; }, 'T1 stores 6.');
      P(st, () => { row({ r: 'count = tmp      // store 6', mr: true, rc: C.err, m: '6', mc: C.err }); S.count = 6; S.tries = 2; S.banner = 'two increments, +1'; S.bannerC = C.err; }, 'T2 stores 6 too, <b>overwriting</b> T1’s update. Two increments, one counted: a <b>lost update</b>. <code>volatile</code> wouldn’t help: each load and store would be visible, but the three steps would still interleave.');
      P(st, () => { row({ m: '6' }); }, 'Fixes: make the read-modify-write atomic. <code>AtomicInteger.incrementAndGet()</code> (see the CAS scenario), <code>LongAdder</code> for hot counters, or <code>synchronized</code>. In a database: <code>UPDATE … SET n = n + 1</code> in one statement.');
    } else if (mode === 'cas') {
      code('private final AtomicInteger count = new AtomicInteger(5);\nint hit() {\n    for (;;) {                                     // what incrementAndGet does\n        int cur = count.get();\n        if (count.compareAndSet(cur, cur + 1)) return cur + 1;   // only if still cur\n    }\n}');
      S.heads = ['Thread 1', 'count (AtomicInteger)', 'Thread 2'];
      P(st, () => { row({ m: '5' }); }, 'Same race, but with an <code>AtomicInteger</code>.');
      P(st, () => { row({ l: 'cur = get()           // 5', ml: true, m: '5' }); }, 'T1 reads 5.');
      P(st, () => { row({ r: 'cur = get()           // 5', mr: true, m: '5' }); }, 'T2 also reads 5.');
      P(st, () => { row({ l: 'CAS(5 → 6)   ✓', ml: true, lc: C.ok, m: '6', mc: C.ok }); S.count = 6; S.tries = 1; }, 'T1’s compare-and-set: “if count is still 5, make it 6”. It is, so the CPU swaps it atomically (<code>lock cmpxchg</code> on x86).');
      P(st, () => { row({ r: 'CAS(5 → 6)   ✗  (now 6)', mr: true, rc: C.err, m: '6' }); S.fails = 1; }, 'T2’s CAS fails: the value is no longer 5. Nothing is overwritten. T2 knows it lost the race.');
      P(st, () => { row({ r: 'cur = get()           // 6', mr: true, m: '6' }); }, 'T2 <b>retries</b> with the fresh value.');
      P(st, () => { row({ r: 'CAS(6 → 7)   ✓', mr: true, rc: C.ok, m: '7', mc: C.ok }); S.count = 7; S.tries = 2; S.banner = 'two increments, +2'; S.bannerC = C.ok; }, 'Success: 7. Lock-free: no thread ever blocks, and some thread always makes progress. The price under heavy contention is retries and cache-line ping-pong, which is what <code>LongAdder</code> avoids.');
    } else if (mode === 'livelock') {
      code('while (true) {\n    if (a.tryLock()) {\n        try { if (b.tryLock()) { try { work(); return; } finally { b.unlock(); } } }\n        finally { a.unlock(); }\n    }\n    Thread.sleep(10);       // T2 runs the same loop with b first, then a\n}');
      S.heads = ['Thread 1 (a then b)', 'locks', 'Thread 2 (b then a)'];
      const round = (tt) => {
        P(st, () => { row({ l: `t=${tt}  a.tryLock() ✓`, r: `t=${tt}  b.tryLock() ✓`, m: 'a:T1 b:T2', lc: C.acc, rc: C.acc }); S.attempts += 2; }, `t = ${tt} ms: T1 gets <b>a</b>, T2 gets <b>b</b>.`);
        P(st, () => { row({ l: '      b.tryLock() ✗', r: '      a.tryLock() ✗', m: 'a:T1 b:T2', lc: C.err, rc: C.err }); }, 'Each tries the other lock and fails. No one blocks, which was the point of <code>tryLock</code>…');
        P(st, () => { row({ l: '      unlock a; sleep 10', r: '      unlock b; sleep 10', m: 'free' }); }, '…so both politely release and sleep exactly 10 ms.');
      };
      round(0); round(10);
      P(st, () => { S.banner = 'busy, polite, and no progress'; S.bannerC = C.err; row({ m: '…' }); }, 'And again at t = 20, 30, 40… Identical timing means identical collisions: a <b>livelock</b>. Unlike a deadlock, the threads are RUNNABLE and burn CPU, so a thread dump won’t flag it; you notice it from zero throughput.');
      P(st, () => { S.rows = []; S.banner = 'fix: jittered back-off'; S.bannerC = C.ok; row({ l: 't=20  a.tryLock() ✓', r: 't=20  b.tryLock() ✓', m: 'a:T1 b:T2' }); row({ l: '      b ✗ → sleep 3 ms', r: '      a ✗ → sleep 17 ms', m: 'free', lc: C.warn, rc: C.warn }); }, 'Fix 1: <b>random</b> back-off. Now the two threads sleep for different times…');
      P(st, () => { row({ l: 't=23  a ✓  b ✓  work()', m: 'a:T1 b:T1', lc: C.ok }); S.work = 1; }, '…T1 wakes first, gets both locks and does its work.');
      P(st, () => { row({ r: 't=37  b ✓  a ✓  work()', m: 'a:T2 b:T2', rc: C.ok }); S.work = 2; }, 'T2 succeeds afterwards. Fix 2 is even simpler: make both threads take <b>a</b> before <b>b</b>, and the collision can’t happen at all.');
    } else if (mode === 'deadlock') {
      code('void transfer(Account from, Account to, long amt) {\n    synchronized (from) {\n        synchronized (to) { from.debit(amt); to.credit(amt); }\n    }\n}\n// transfer-7: transfer(#1, #2, 50)      transfer-3: transfer(#2, #1, 20)');
      P(st, () => { S.tstate.T1 = 'RUNNABLE'; S.tstate.T2 = 'RUNNABLE'; S.hotN = null; }, 'Two transfers between the same pair of accounts, in opposite directions, start at the same time.');
      P(st, () => { S.ge.push(['A', 'T1', 'holds']); S.hotN = 'A'; }, 'transfer-7 enters <code>synchronized (#1)</code>: it now <b>holds</b> account #1’s monitor.');
      P(st, () => { S.ge.push(['B', 'T2', 'holds']); S.hotN = 'B'; }, 'At the same moment transfer-3 enters <code>synchronized (#2)</code> and holds #2.');
      P(st, () => { S.ge.push(['T1', 'B', 'waits']); S.tstate.T1 = 'BLOCKED'; S.hotN = 'T1'; }, 'transfer-7 now needs #2, which transfer-3 holds: it is <b>BLOCKED</b>, waiting for #2.');
      P(st, () => { S.ge.push(['T2', 'A', 'waits']); S.tstate.T2 = 'BLOCKED'; S.hotN = 'T2'; S.cycle = true; S.banner = 'nobody can ever proceed'; S.bannerC = C.err; }, 'transfer-3 needs #1, held by transfer-7. The wait-for graph now has a <b>cycle</b>: T1 → #2 → T2 → #1 → T1. Neither thread will ever wake up; <code>synchronized</code> has no timeout.');
      P(st, () => { S.dump = `"transfer-7" #41 prio=5 os_prio=0 tid=0x… nid=0x… waiting for monitor entry\n   java.lang.Thread.State: BLOCKED (on object monitor)\n\tat com.acme.Transfers.transfer(Transfers.java:12)\n\t- waiting to lock <0x000000071a2b3c48> (a com.acme.Account)\n\t- locked <0x000000071a2b3c10> (a com.acme.Account)\n\n"transfer-3" #37 prio=5 os_prio=0 tid=0x… nid=0x… waiting for monitor entry\n   java.lang.Thread.State: BLOCKED (on object monitor)\n\tat com.acme.Transfers.transfer(Transfers.java:12)\n\t- waiting to lock <0x000000071a2b3c10> (a com.acme.Account)\n\t- locked <0x000000071a2b3c48> (a com.acme.Account)`; S.sub = 'jcmd <pid> Thread.print: match “locked” and “waiting to lock” addresses'; }, 'A thread dump (below) shows the evidence: each thread is BLOCKED, <b>locked</b> one address and is <b>waiting to lock</b> the other. Matching the addresses rebuilds the graph above.');
      P(st, () => { S.dump += `\n\nFound one Java-level deadlock:\n=============================\n"transfer-7":\n  waiting to lock monitor 0x00007f3a…, (object 0x000000071a2b3c48, a com.acme.Account),\n  which is held by "transfer-3"\n"transfer-3":\n  waiting to lock monitor 0x00007f3a…, (object 0x000000071a2b3c10, a com.acme.Account),\n  which is held by "transfer-7"\n\nFound 1 deadlock.`; S.sub = 'HotSpot finds the cycle for you (monitors and ReentrantLocks)'; }, 'You rarely have to match addresses yourself: at the end of the dump HotSpot prints <b>“Found one Java-level deadlock”</b> with the cycle. Fix: always lock the lower account id first, so a cycle can’t form. Or use <code>tryLock(timeout)</code>, or lock the rows in the database in id order.');
    } else {
      code('AtomicLong hits = new AtomicLong();  hits.incrementAndGet();   // 6 threads at once\nLongAdder  hits = new LongAdder();   hits.increment();         // same 6 threads');
      S.cellX = (j) => 120 + j * 108;
      P(st, () => { S.thr.forEach((t) => { t.res = null; t.cell = 0; }); S.sub = 'six threads increment at the same instant'; }, 'Six request threads count hits at the same moment.');
      P(st, () => { S.thr.forEach((t, i) => { t.res = i === 2 ? 'ok' : 'fail'; t.cell = 0; }); S.value += 1; S.total += 1; S.fails += 5; S.hotCell = true; S.sub = 'one cache line: every CAS needs exclusive ownership of it'; }, '<b>AtomicLong</b>: all six CAS the same field. One wins; <b>five fail</b> and must re-read and retry, and the cache line bounces between cores each time.');
      P(st, () => { S.thr.forEach((t, i) => { t.res = i === 0 ? 'ok' : i === 2 ? null : 'fail'; }); S.value += 1; S.total += 1; S.fails += 4; S.sub = 'retry storm: N threads → about N²/2 CAS attempts for N increments'; }, 'Round two: one more wins, four fail again. Six increments cost about 21 CAS attempts. With 64 busy cores this is where your CPU goes.');
      P(st, () => { S.adder = true; S.cells = [0, 0, 0, 0, 0]; S.hotCells = []; S.thr.forEach((t) => { t.res = null; t.cell = null; }); S.fails = 0; S.total = 0; S.sub = 'LongAdder: starts with just a base value; cells are created on contention'; }, 'Now <b>LongAdder</b>. It starts with a <code>base</code> field and grows an array of cells (each padded to its own cache line) only once CASes on base start failing.');
      P(st, () => { const map = [1, 2, 3, 4, 1, 3]; S.thr.forEach((t, i) => { t.res = 'ok'; t.cell = map[i]; }); [1, 2, 3, 4, 1, 3].forEach((c) => { S.cells[c]++; }); S.hotCells = [1, 2, 3, 4]; S.total = 6; S.sub = 'each thread’s probe hash picks a cell; most CASes now succeed'; }, 'Each thread hashes to a cell by its per-thread probe and CASes <i>that</i> cell. Different cells sit in different cache lines, so most updates don’t collide. A thread that does collide re-hashes to another cell.');
      P(st, () => { S.sum = S.cells.reduce((x, y) => x + y, 0); S.hotCells = [0, 1, 2, 3, 4]; S.banner = 'cheap writes, slower reads'; S.bannerC = C.ok; S.sub = null; }, '<code>sum()</code> adds base and all cells. It takes no lock, so if increments are still running it may miss some in flight: fine for metrics, wrong for an id generator. Use AtomicLong when you need each exact value.');
    }
    return st;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    S = { rows: [], heads: ['', '', ''], tries: 0, count: 5, fails: 0, attempts: 0, work: 0, ge: [], tstate: { T1: 'RUNNABLE', T2: 'RUNNABLE' }, cycle: false, dump: '', hotN: null, sub: null, banner: null,
      thr: Array.from({ length: 6 }, () => ({ res: null, cell: null })), adder: false, value: 0, total: 0, cells: [], hotCells: [], hotCell: false, sum: null };
    if (mode === 'lost' || mode === 'cas') S.count = 5;
    steps = plan(); render(); bStep.disabled = false;
    say({ lost: 'Two threads run <code>count++</code> on a plain field. Press Play or Step.', cas: 'The same race with <code>AtomicInteger</code>.', deadlock: 'Two transfers lock the same two accounts in opposite orders.', livelock: 'Two threads try to avoid deadlock with tryLock and a fixed back-off.', adder: 'Six threads hammer one counter.' }[mode]);
  }
  function step() {
    if (k >= steps.length) return false; const s = steps[k++]; s.run(); render(); say(typeof s.t === 'function' ? s.t() : s.t);
    if (k >= steps.length) bStep.disabled = true; return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 700 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

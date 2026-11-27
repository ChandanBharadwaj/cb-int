/* Threads & executors: ThreadPoolExecutor core → queue → max → reject, the fixed-pool trap, shutdown vs shutdownNow, and the Thread.State machine. */
IA.widget('threads-executors', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let mode = 'flow'; let policy = 'abort'; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['flow', 'bounded pool'], ['fixed', 'fixed pool trap'], ['shutdown', 'shutdown()'], ['now', 'shutdownNow()'], ['life', 'thread lifecycle']], () => mode, (v) => { mode = v; reset(); }, 'Scenario');
  const segP = seg([['abort', 'AbortPolicy'], ['caller', 'CallerRunsPolicy'], ['discard', 'DiscardPolicy'], ['oldest', 'DiscardOldestPolicy']], () => policy, (v) => { policy = v; reset(); }, 'Rejection policy');
  const polRow = el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'rejection policy' }), segP);
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const W = 760, H = 330;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Caller thread on the left, the work queue in the middle, worker threads on the right' });
  const codeHost = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), polRow, codeHost, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const code = (src) => { codeHost.innerHTML = ''; codeHost.append(el('pre', { html: IA.highlight(src, 'java') })); };
  const R = (x, y, w, h, o = {}) => svg('rect', { x, y, width: w, height: h, rx: o.rx == null ? 6 : o.rx, fill: o.fill || 'var(--surface)', stroke: o.stroke || 'var(--border)', 'stroke-width': o.sw || 1, 'stroke-dasharray': o.dash || null });
  const T = (x, y, s, o = {}) => svg('text', { x, y, 'font-size': o.fs || 12, 'font-weight': o.fw || null, 'text-anchor': o.a || 'start', 'font-family': o.mono ? 'var(--mono)' : null, fill: o.fill || 'var(--text)', 'text-decoration': o.strike ? 'line-through' : null, text: s });
  function chip(x, y, id, o = {}) {
    const g = svg('g');
    g.append(R(x, y, o.w || 44, 24, { rx: 5, fill: o.fill || 'var(--surface-2)', stroke: o.stroke || 'var(--border)', sw: o.sw || 1, dash: o.dash }));
    g.append(T(x + (o.w || 44) / 2, y + 16, id, { a: 'middle', mono: true, fs: 12, fill: o.tf || 'var(--text)', strike: o.strike }));
    return g;
  }

  let S;
  /* ---------- pool rendering ---------- */
  function renderPool() {
    stage.innerHTML = '';
    const stCol = { RUNNING: 'var(--ok)', SHUTDOWN: 'var(--warn)', STOP: 'var(--err)', TERMINATED: 'var(--text-3)' }[S.state];
    stage.append(T(W - 20, 20, 'runState: ' + S.state, { a: 'end', fw: 700, fs: 13, fill: stCol }));
    // caller
    stage.append(T(20, 20, 'caller thread (main)', { fw: 700, fs: 13 }));
    stage.append(R(20, 32, 140, 284, { fill: 'var(--surface-2)' }));
    stage.append(T(30, 52, 'tasks to submit', { fs: 11, fill: 'var(--text-3)' }));
    S.incoming.forEach((id, i) => stage.append(chip(30 + (i % 2) * 60, 62 + Math.floor(i / 2) * 32, id, { fill: 'var(--surface)' })));
    if (S.callerRun) {
      stage.append(R(28, 234, 124, 74, { fill: 'var(--accent-soft)', stroke: 'var(--warn)', sw: 2 }));
      stage.append(T(90, 254, 'caller is running', { a: 'middle', fs: 11, fill: 'var(--warn)', fw: 700 }));
      stage.append(chip(68, 266, S.callerRun, { stroke: 'var(--warn)', sw: 2, fill: 'var(--surface)' }));
    }
    // queue
    const cap = S.cap; const capL = cap === Infinity ? '∞ (Integer.MAX_VALUE)' : String(cap);
    stage.append(T(190, 20, `workQueue  ${S.queue.length} / ${capL}`, { fw: 700, fs: 13 }));
    stage.append(R(190, 32, 260, 50, { fill: 'var(--surface-2)' }));
    const slots = cap === Infinity ? Math.max(S.queue.length, 1) : cap;
    const sw = cap === Infinity ? 38 : 54;
    for (let i = 0; i < slots; i++) {
      const x = 198 + i * (sw + 4);
      if (x + sw > 446) { stage.append(T(440, 62, '…', { a: 'end' })); break; }
      const id = S.queue[i];
      if (id) stage.append(chip(x, 45, id, { w: sw, fill: S.hot === id ? 'var(--accent-soft)' : 'var(--surface)', stroke: S.hot === id ? 'var(--accent)' : 'var(--border)', sw: S.hot === id ? 2 : 1 }));
      else stage.append(R(x, 45, sw, 24, { rx: 5, fill: 'none', dash: '3 3' }));
    }
    stage.append(T(196, 98, cap === Infinity ? 'offer() always succeeds' : 'offer() fails when full', { fs: 11, fill: 'var(--text-3)' }));
    // rejected / returned
    const binT = mode === 'now' ? 'returned by shutdownNow()' : 'rejected / dropped';
    stage.append(T(190, 128, binT, { fw: 700, fs: 13, fill: S.rejected.length ? 'var(--err)' : 'var(--text)' }));
    stage.append(R(190, 138, 260, 70, { fill: 'none', dash: '4 3', stroke: S.rejected.length ? 'var(--err)' : 'var(--border)' }));
    S.rejected.forEach((r, i) => {
      const x = 198 + (i % 4) * 62; const y = 148 + Math.floor(i / 4) * 28;
      stage.append(chip(x, y, r.id, { fill: 'var(--surface)', stroke: r.k === 'returned' ? 'var(--warn)' : 'var(--err)', tf: r.k === 'returned' ? 'var(--text)' : 'var(--text-3)', strike: r.k !== 'returned' }));
    });
    // completed
    stage.append(T(190, 236, 'completed', { fw: 700, fs: 13 }));
    stage.append(R(190, 246, 260, 70, { fill: 'none', dash: '4 3' }));
    S.done.forEach((id, i) => stage.append(chip(198 + (i % 5) * 50, 256 + Math.floor(i / 5) * 28, id, { w: 42, fill: 'var(--surface)', stroke: 'var(--ok)' })));
    // workers
    const live = S.workers.filter((w) => !w.dead).length;
    stage.append(T(480, 46, `workers  poolSize ${live} · core ${S.core} · max ${S.max}`, { fw: 700, fs: 13 }));
    for (let i = 0; i < S.max; i++) {
      const y = 58 + i * 52; const w = S.workers[i];
      const isCore = i < S.core;
      stage.append(R(480, y, 260, 44, { fill: w && !w.dead ? 'var(--surface)' : 'none', dash: w && !w.dead ? null : '4 3', stroke: w && S.hotW === i ? 'var(--accent)' : 'var(--border)', sw: w && S.hotW === i ? 2 : 1 }));
      stage.append(T(490, y + 18, w ? w.name : `(slot ${i + 1})`, { fs: 12, fw: 600, mono: true, fill: w && !w.dead ? 'var(--text)' : 'var(--text-3)' }));
      stage.append(T(490, y + 34, isCore ? 'within core' : 'above core', { fs: 10.5, fill: 'var(--text-3)' }));
      if (w && !w.dead) {
        if (w.task) stage.append(chip(670, y + 10, w.task, { fill: 'var(--accent-soft)', stroke: 'var(--accent)', sw: 1.5 }));
        else stage.append(T(692, y + 27, w.note || 'idle: take()', { a: 'middle', fs: 11, fill: 'var(--text-3)' }));
        if (w.flag) stage.append(T(664, y + 27, w.flag, { a: 'end', fs: 11, fill: 'var(--warn)', fw: 700 }));
      } else if (w && w.dead) stage.append(T(730, y + 27, w.note || 'exited', { a: 'end', fs: 11, fill: 'var(--text-3)' }));
    }
  }
  function statLine() {
    stats.innerHTML = '';
    const add = (h) => stats.append(el('span', { class: 'w-stat', html: h }));
    if (mode === 'life') { add(`state <b>${S.cur}</b>`); add(`visited <b>${S.seen.size}</b> / 6`); return; }
    add(`poolSize <b>${S.workers.filter((w) => !w.dead).length}</b>`);
    add(`active <b>${S.workers.filter((w) => !w.dead && w.task).length}</b>`);
    add(`queued <b>${S.queue.length}</b>`);
    add(`completed <b>${S.done.length}</b>`);
    add(`${mode === 'now' ? 'returned' : 'rejected'} <b>${S.rejected.length}</b>`);
  }
  /* ---------- execute() semantics ---------- */
  function addWorker(id) { const n = S.workers.length + 1; S.workers.push({ name: 'pool-1-thread-' + n, task: id }); S.hotW = S.workers.length - 1; return n; }
  function reject(id, why) {
    if (policy === 'abort' || mode !== 'flow') { S.rejected.push({ id, k: 'abort' }); return `${why}: <b>AbortPolicy</b> throws <code>RejectedExecutionException</code> to the caller. ${id} is lost unless the caller catches it (return 503, retry later, …).`; }
    if (policy === 'caller') { S.callerRun = id; return `${why}: <b>CallerRunsPolicy</b> runs ${id} <b>on the caller thread</b>, right away. While main is busy with it, it can’t submit more. That slows the sender down.`; }
    if (policy === 'discard') { S.rejected.push({ id, k: 'discard' }); return `${why}: <b>DiscardPolicy</b> drops ${id} without a word. No exception, no log line, no metric. Only fine for optional work.`; }
    const old = S.queue.shift(); S.rejected.push({ id: old, k: 'oldest' }); S.queue.push(id); S.hot = id;
    return `${why}: <b>DiscardOldestPolicy</b> drops ${old}, the task that waited longest, and retries. ${id} is queued in its place. Someone’s oldest request just vanished.`;
  }
  function exec(id) {
    S.incoming = S.incoming.filter((x) => x !== id); S.hot = id; S.hotW = null;
    if (S.state !== 'RUNNING') return reject(id, 'The pool is shut down');
    const live = S.workers.filter((w) => !w.dead).length;
    if (live < S.core) { const n = addWorker(id); return `<code>execute(${id})</code>: poolSize ${live} &lt; core ${S.core}, so a <b>new thread</b> pool-1-thread-${n} starts with ${id} as its first task. (It would do this even if another worker were idle.)`; }
    if (S.queue.length < S.cap) { S.queue.push(id); return `<code>execute(${id})</code>: core is full, so ${id} is <b>offered to the queue</b> (${S.queue.length}/${S.cap === Infinity ? '∞' : S.cap}). No new thread.`; }
    if (live < S.max) { const n = addWorker(id); return `<code>execute(${id})</code>: the queue <b>refused</b> and poolSize ${live} &lt; max ${S.max}, so an <b>extra thread</b> (pool-1-thread-${n}) starts and runs ${id} directly. Note: ${id} jumps ahead of the tasks waiting in the queue.`; }
    return reject(id, `<code>execute(${id})</code>: queue full and poolSize = max ${S.max}`);
  }
  function finish(i, extra) {
    const w = S.workers[i]; S.hotW = i; S.hot = null;
    const t = w.task; S.done.push(t); w.flag = null;
    if (S.queue.length && S.state !== 'STOP') { w.task = S.queue.shift(); S.hot = w.task; return `${w.name} finishes ${t} and loops back to <code>getTask()</code>: it takes <b>${w.task}</b> from the head of the queue.` + (extra || ''); }
    w.task = null;
    if (S.state === 'SHUTDOWN' || S.state === 'STOP') { w.dead = true; w.note = 'exited'; return `${w.name} finishes ${t}. The queue is empty and the pool is shutting down. <code>getTask()</code> returns null, and the thread <b>exits</b>.` + (extra || ''); }
    const above = S.workers.filter((x) => !x.dead).length > S.core;
    w.note = above ? 'idle: poll(30 s)' : 'idle: take()';
    return `${w.name} finishes ${t}. The queue is empty, so it waits: ` + (above ? '<code>poll(keepAliveTime)</code> because the pool is above core size.' : '<code>take()</code>, blocking until work arrives.') + (extra || '');
  }
  /* ---------- lifecycle ---------- */
  const NODES = { NEW: [90, 160], RUNNABLE: [320, 160], TERMINATED: [320, 285], BLOCKED: [600, 50], WAITING: [600, 160], TIMED_WAITING: [600, 275] };
  const EDGES = [['NEW', 'RUNNABLE', 0], ['RUNNABLE', 'BLOCKED', -16], ['BLOCKED', 'RUNNABLE', -16], ['RUNNABLE', 'WAITING', -14], ['WAITING', 'RUNNABLE', -14], ['WAITING', 'BLOCKED', 0], ['RUNNABLE', 'TIMED_WAITING', -16], ['TIMED_WAITING', 'RUNNABLE', -16], ['RUNNABLE', 'TERMINATED', 0]];
  function edgePts(a, b, off) {
    const [x1, y1] = NODES[a]; const [x2, y2] = NODES[b];
    const dx = x2 - x1, dy = y2 - y1; const L = Math.hypot(dx, dy) || 1;
    const clip = (cx, cy, sx, sy) => { const hw = 72, hh = 20; const t = Math.min(hw / Math.abs(sx || 1e-6), hh / Math.abs(sy || 1e-6)); return [cx + sx * t, cy + sy * t]; };
    const px = -dy / L * off, py = dx / L * off;
    const [ax, ay] = clip(x1, y1, dx / L, dy / L); const [bx, by] = clip(x2, y2, -dx / L, -dy / L);
    return { ax: ax + px, ay: ay + py, bx: bx + px, by: by + py, mx: (ax + bx) / 2 + px * 1.6, my: (ay + by) / 2 + py * 1.6 };
  }
  function renderLife() {
    stage.innerHTML = '';
    EDGES.forEach(([a, b, off]) => {
      const p = edgePts(a, b, off); const on = S.edge && S.edge[0] === a && S.edge[1] === b;
      const col = on ? 'var(--accent)' : 'var(--border)';
      stage.append(svg('path', { d: `M${p.ax} ${p.ay} Q ${p.mx} ${p.my} ${p.bx} ${p.by}`, fill: 'none', stroke: col, 'stroke-width': on ? 2.5 : 1.4 }));
      const ang = Math.atan2(p.by - p.my, p.bx - p.mx); const s = on ? 9 : 7;
      stage.append(svg('polygon', { points: `${p.bx},${p.by} ${p.bx - s * Math.cos(ang - 0.45)},${p.by - s * Math.sin(ang - 0.45)} ${p.bx - s * Math.cos(ang + 0.45)},${p.by - s * Math.sin(ang + 0.45)}`, fill: col }));
      if (on && S.label) {
        const lx = p.mx, ly = p.my; const tw = S.label.length * 6.4 + 12;
        stage.append(R(lx - tw / 2, ly - 12, tw, 20, { rx: 5, fill: 'var(--surface)', stroke: 'var(--accent)' }));
        stage.append(T(lx, ly + 2, S.label, { a: 'middle', fs: 11, mono: true, fill: 'var(--accent)' }));
      }
    });
    Object.entries(NODES).forEach(([n, [x, y]]) => {
      const cur = S.cur === n; const seen = S.seen.has(n);
      stage.append(R(x - 72, y - 20, 144, 40, { rx: 9, fill: cur ? 'var(--accent-soft)' : 'var(--surface)', stroke: cur ? 'var(--accent)' : seen ? 'var(--text-3)' : 'var(--border)', sw: cur ? 2.5 : 1 }));
      stage.append(T(x, y + 5, n, { a: 'middle', fs: 13, fw: 700, mono: true, fill: cur ? 'var(--accent)' : seen ? 'var(--text)' : 'var(--text-3)' }));
    });
    stage.append(T(20, 24, 'Thread.State of thread “t”', { fw: 700, fs: 13 }));
  }

  /* ---------- plans ---------- */
  function plan() {
    const st = [];
    if (mode === 'life') {
      code('Object lock = new Object();\nThread t = new Thread(() -> {\n    synchronized (lock) {           // main holds lock for a moment → BLOCKED\n        lock.wait();                // → WAITING (monitor released)\n    }\n    Thread.sleep(100);              // → TIMED_WAITING\n});                                  // (checked exceptions omitted)');
      const go = (a, b, label, t) => st.push({ run: () => { S.edge = [a, b]; S.label = label; S.cur = b; S.seen.add(b); }, t });
      st.push({ run: () => { S.cur = 'NEW'; S.seen.add('NEW'); S.edge = null; }, t: '<code>new Thread(r)</code>: a Java object in state <b>NEW</b>. No OS thread exists yet.' });
      go('NEW', 'RUNNABLE', 'start()', '<code>t.start()</code> creates the OS thread: <b>RUNNABLE</b>. That covers “running on a CPU”, “ready for a CPU” and even “stuck in a native socket read”. The JVM can’t tell them apart.');
      go('RUNNABLE', 'BLOCKED', 'synchronized (held)', '<code>t</code> reaches <code>synchronized (lock)</code> while main holds it: <b>BLOCKED</b>. Only waiting for a <code>synchronized</code> lock (a <b>monitor</b>) gives BLOCKED.');
      go('BLOCKED', 'RUNNABLE', 'monitor acquired', 'Main leaves its synchronized block. <code>t</code> gets the monitor and is RUNNABLE again.');
      go('RUNNABLE', 'WAITING', 'wait() / join() / park()', '<code>lock.wait()</code> gives up the monitor and sleeps: <b>WAITING</b> (no timeout). <code>join()</code>, <code>LockSupport.park()</code>, <code>ReentrantLock.lock()</code>, latches and blocking queues land here too. <i>Not</i> in BLOCKED.');
      go('WAITING', 'BLOCKED', 'notify() → re-acquire', 'Main calls <code>lock.notify()</code> inside its own synchronized block. <code>t</code> wakes, but must get the monitor back. Main still holds it: <b>BLOCKED</b>.');
      go('BLOCKED', 'RUNNABLE', 'monitor acquired', 'Main exits the block. <code>t</code> gets the monitor back and returns from <code>wait()</code>. Always re-check the condition in a loop: threads can wake for no reason.');
      go('RUNNABLE', 'TIMED_WAITING', 'sleep(100)', '<code>Thread.sleep(100)</code>: <b>TIMED_WAITING</b>. Also <code>wait(ms)</code>, <code>join(ms)</code>, <code>parkNanos</code>, <code>poll(timeout)</code>.');
      go('TIMED_WAITING', 'RUNNABLE', 'timeout / interrupt', 'The timeout expires (or someone calls <code>t.interrupt()</code>, which makes <code>sleep</code> throw <code>InterruptedException</code>). Back to RUNNABLE.');
      go('RUNNABLE', 'TERMINATED', 'run() returns / throws', '<code>run()</code> returns: <b>TERMINATED</b>. It can never start again. A second <code>start()</code> throws <code>IllegalThreadStateException</code>. Pools keep threads alive by looping on the queue instead.');
      return st;
    }
    if (mode === 'flow' || mode === 'fixed') {
      const fixed = mode === 'fixed';
      const polName = { abort: 'AbortPolicy', caller: 'CallerRunsPolicy', discard: 'DiscardPolicy', oldest: 'DiscardOldestPolicy' }[policy];
      code(fixed
        ? 'ExecutorService ex = Executors.newFixedThreadPool(2);\n// = new ThreadPoolExecutor(2, 2, 0L, MILLISECONDS, new LinkedBlockingQueue<>())\nfor (Runnable t : List.of(T1, T2, …, T8)) ex.execute(t);   // each task runs for a while'
        : `ThreadPoolExecutor ex = new ThreadPoolExecutor(\n    2, 4, 30, SECONDS,                 // core 2, max 4, keepAlive 30 s\n    new ArrayBlockingQueue<>(2),       // bounded queue\n    new ThreadPoolExecutor.${polName}());\nfor (Runnable t : List.of(T1, T2, …, T8)) ex.execute(t);   // each task runs for a while`);
      ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'].forEach((id) => {
        st.push({ run: () => { S.msg = exec(id); }, t: () => S.msg });
        if (!fixed && policy === 'caller') st.push({ when: () => S.callerRun === id, run: () => { S.done.push(S.callerRun); S.callerRun = null; S.hot = null; }, t: `Main finished ${id} itself. Only now can it submit the next task. The workers kept going meanwhile; the slowdown moved to the producer, which is the point.` });
      });
      if (fixed) {
        st.push({ run: () => { S.hot = null; }, t: '8 tasks, 2 threads, <b>6 queued</b>. <code>LinkedBlockingQueue</code> with no capacity holds up to <code>Integer.MAX_VALUE</code> tasks. <code>offer()</code> never fails, so <b>nothing is ever rejected</b>. Overload becomes memory use and waiting, not an error.' });
        st.push({ run: () => { S.max = 4; }, t: 'Even <code>new ThreadPoolExecutor(2, <b>4</b>, …, new LinkedBlockingQueue&lt;&gt;())</code> looks exactly like this. The “grow to max” step only runs when the queue refuses. So slots 3 and 4 stay empty forever. Give the queue a limit, or set core = max.' });
        return st;
      }
      // drain: finish busy workers round-robin
      for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) {
        st.push({ when: () => S.workers[i] && !S.workers[i].dead && S.workers[i].task, run: () => { S.msg = finish(i); }, t: () => S.msg });
      }
      st.push({ when: () => S.workers.filter((w) => !w.dead).length > S.core, run: () => {
        let n = S.workers.filter((w) => !w.dead).length; S.hotW = null;
        for (let i = S.workers.length - 1; i >= 0 && n > S.core; i--) if (!S.workers[i].dead) { S.workers[i].dead = true; S.workers[i].note = 'timed out (keepAlive)'; n--; }
        S.workers.forEach((w) => { if (!w.dead) w.note = 'idle: take()'; });
      }, t: '30 s pass with no work. The threads above core get <code>null</code> from <code>poll(keepAliveTime)</code> and <b>exit</b>. The pool shrinks back to 2 core threads. They wait in <code>take()</code> forever (unless <code>allowCoreThreadTimeOut(true)</code>). Threads have no “core” label: whichever time out first leave.' });
      st.push({ run: () => { S.hotW = null; }, t: () => `Summary with ${polName}: ${S.done.length} completed, ${S.rejected.length} ${policy === 'caller' ? 'dropped' : 'rejected or dropped'}. The order was always <b>core → queue → extra threads → policy</b>.` + (policy === 'caller' ? ' Nothing was lost, but the caller did some of the work.' : '') });
      return st;
    }
    // shutdown / shutdownNow
    const now = mode === 'now';
    code(now
      ? 'List<Runnable> neverRan = ex.shutdownNow();   // STOP: drain the queue, interrupt workers\nboolean done = ex.awaitTermination(10, SECONDS);\n// T1: Thread.sleep(…) → InterruptedException → exits\n// T2: while (true) { crunch(); }   // never checks the interrupt flag'
      : 'ex.shutdown();                                  // SHUTDOWN: no new tasks, queued ones still run\nex.execute(T6);                                 // → RejectedExecutionException\nboolean done = ex.awaitTermination(10, SECONDS);');
    if (!now) {
      st.push({ run: () => { S.state = 'SHUTDOWN'; S.hotW = null; S.hot = null; }, t: '<code>shutdown()</code> sets the state to <b>SHUTDOWN</b> and returns at once. Running tasks aren’t interrupted. The 3 queued tasks will still run.' });
      st.push({ run: () => { S.msg = exec('T6'); }, t: () => S.msg + ' After shutdown, <i>every</i> policy treats new work as rejected (CallerRuns and DiscardOldest silently discard it).' });
      st.push({ run: () => { S.msg = finish(0); }, t: () => S.msg });
      st.push({ run: () => { S.msg = finish(1); }, t: () => S.msg });
      st.push({ run: () => { S.msg = finish(0); }, t: () => S.msg });
      st.push({ run: () => { S.msg = finish(1); }, t: () => S.msg });
      st.push({ run: () => { S.msg = finish(0); S.state = 'TERMINATED'; }, t: () => S.msg + ' The last worker is gone: runState <b>TERMINATED</b>, and <code>awaitTermination</code> returns <b>true</b>. All 5 tasks completed.' });
    } else {
      st.push({ run: () => { S.state = 'STOP'; S.queue.forEach((id) => S.rejected.push({ id, k: 'returned' })); S.queue = []; S.workers.forEach((w) => { w.flag = 'interrupt!'; }); S.hotW = null; }, t: '<code>shutdownNow()</code>: runState <b>STOP</b>. The queue is emptied. The 3 tasks that never started are <b>returned</b> as a <code>List&lt;Runnable&gt;</code> (log or save them!). Every worker gets <code>interrupt()</code>.' });
      st.push({ run: () => { const w = S.workers[0]; S.done.push(w.task); w.task = null; w.dead = true; w.note = 'exited'; w.flag = null; S.hotW = 0; }, t: 'T1 was in <code>Thread.sleep</code>, which throws <code>InterruptedException</code> when interrupted. The task cleans up and returns. The worker sees STOP and exits.' });
      st.push({ run: () => { S.hotW = 1; S.workers[1].flag = 'ignores it'; }, t: 'T2 is a CPU loop that never checks <code>Thread.interrupted()</code>. An interrupt is only a flag, so <b>T2 keeps running</b>. You can’t safely kill a thread (<code>Thread.stop</code> throws since Java 20).' });
      st.push({ run: () => { S.hotW = null; }, t: '<code>awaitTermination(10, SECONDS)</code> returns <b>false</b>. The pool is stuck in STOP until T2 ends. On Kubernetes, SIGKILL arrives at the end of the grace period. Make long tasks check the interrupt flag.' });
    }
    return st;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    polRow.style.display = mode === 'flow' ? '' : 'none';
    if (mode === 'life') S = { cur: 'NEW', seen: new Set(), edge: null, label: null };
    else if (mode === 'flow' || mode === 'fixed') S = { state: 'RUNNING', core: 2, max: mode === 'fixed' ? 2 : 4, cap: mode === 'fixed' ? Infinity : 2, incoming: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'], queue: [], workers: [], rejected: [], done: [], callerRun: null, hot: null, hotW: null };
    else S = { state: 'RUNNING', core: 2, max: 2, cap: 4, incoming: ['T6'], queue: ['T3', 'T4', 'T5'], workers: [{ name: 'pool-1-thread-1', task: 'T1' }, { name: 'pool-1-thread-2', task: 'T2' }], rejected: [], done: [], callerRun: null, hot: null, hotW: null };
    steps = plan(); render(); bStep.disabled = false;
    say({ flow: 'Eight long-running tasks arrive one by one. Watch where each one goes. Press Play or Step.', fixed: '<code>Executors.newFixedThreadPool(2)</code> gets the same eight tasks. Watch the queue.', shutdown: 'Two tasks running, three queued, one more about to be submitted. Then <code>shutdown()</code>.', now: 'Same pool, but this time <code>shutdownNow()</code>.', life: 'One thread, every state it can be in. Press Play or Step.' }[mode]);
  }
  function render() { if (mode === 'life') renderLife(); else renderPool(); statLine(); }
  function step() {
    while (k < steps.length && steps[k].when && !steps[k].when()) k++;
    if (k >= steps.length) { bStep.disabled = true; return false; }
    const s = steps[k++]; s.run(); render(); say(typeof s.t === 'function' ? s.t() : s.t);
    while (k < steps.length && steps[k].when && !steps[k].when()) k++;
    if (k >= steps.length) bStep.disabled = true;
    return true;
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

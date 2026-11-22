/* Locks & synchronized: threads moving between owner, entry set / AQS queue and wait sets, for monitors, Conditions, ReadWriteLock, StampedLock and fairness. */
IA.widget('locks-synchronized', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let mode = 'monitor'; let gen = 0; let running = false; let speed = 2600; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['monitor', 'synchronized + wait/notifyAll'], ['cond', 'ReentrantLock + Conditions'], ['rw', 'ReadWriteLock'], ['stamped', 'StampedLock optimistic'], ['fair', 'fair vs non-fair']], () => mode, (v) => { mode = v; reset(); }, 'Mechanism');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3800, 'Slow'], [2600, 'Normal'], [1200, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const W = 760, H = 350;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Zones for running threads, the entry queue, the lock owner and wait sets, with thread chips moving between them' });
  const zonesG = svg('g'); const chipsG = svg('g'); const topG = svg('g');
  stage.append(zonesG, chipsG, topG);
  const codeHost = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), codeHost, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const code = (src) => { codeHost.innerHTML = ''; codeHost.append(el('pre', { html: IA.highlight(src, 'java') })); };
  const R = (x, y, w, h, o = {}) => svg('rect', { x, y, width: w, height: h, rx: o.rx == null ? 8 : o.rx, fill: o.fill || 'var(--surface)', stroke: o.stroke || 'var(--border)', 'stroke-width': o.sw || 1, 'stroke-dasharray': o.dash || null });
  const T = (x, y, s, o = {}) => svg('text', { x, y, 'font-size': o.fs || 12, 'font-weight': o.fw || null, 'text-anchor': o.a || 'start', 'font-family': o.mono ? 'var(--mono)' : null, fill: o.fill || 'var(--text)', text: s });

  // zone geometry
  const Z = {
    out: { x: 16, y: 40, w: 128, h: 220 },
    entry: { x: 160, y: 40, w: 170, h: 220 },
    owner: { x: 346, y: 40, w: 200, h: 220 },
    w1: { x: 562, y: 40, w: 182, h: 104 },
    w2: { x: 562, y: 156, w: 182, h: 104 }
  };
  const CHW = 52, CHH = 26;
  function slot(zone, i, n) {
    const z = Z[zone];
    if (zone === 'owner') { const cols = Math.min(n, 3); const c = i % 3, r = Math.floor(i / 3); const totalW = cols * (CHW + 8) - 8; return [z.x + z.w / 2 - totalW / 2 + c * (CHW + 8), z.y + 96 + r * 36]; }
    if (zone === 'w1' || zone === 'w2') return [z.x + 12 + (i % 3) * (CHW + 6), z.y + 30 + Math.floor(i / 3) * 32];
    return [z.x + z.w / 2 - CHW / 2, z.y + 32 + i * 34];
  }
  let S; const chipEls = {};
  function ensureChip(name) {
    if (chipEls[name]) return chipEls[name];
    const g = svg('g', { style: reduced ? '' : 'transition: transform .7s ease' });
    const r = R(0, 0, CHW, CHH, { rx: 13 }); const t = T(CHW / 2, 17, name, { a: 'middle', mono: true, fs: 12, fw: 700 });
    g.append(r, t); chipsG.append(g); chipEls[name] = { g, r, t }; return chipEls[name];
  }
  const ZCOL = { out: ['var(--surface-2)', 'var(--border)', 'var(--text)'], entry: ['var(--surface)', 'var(--warn)', 'var(--text)'], owner: ['var(--accent-soft)', 'var(--accent)', 'var(--accent)'], w1: ['var(--surface)', 'var(--text-3)', 'var(--text-2)'], w2: ['var(--surface)', 'var(--text-3)', 'var(--text-2)'], done: ['var(--surface)', 'var(--ok)', 'var(--ok)'] };
  function render() {
    zonesG.innerHTML = ''; topG.innerHTML = '';
    const L = S.labels;
    Object.entries(Z).forEach(([id, z]) => {
      if (id === 'w2' && !L.w2) return;
      if (id === 'w1' && !L.w1) return;
      const h = id === 'w1' && !L.w2 ? 220 : z.h;
      const isOwner = id === 'owner';
      zonesG.append(R(z.x, z.y, z.w, h, { fill: isOwner ? 'var(--surface-2)' : 'none', dash: isOwner ? null : '5 4', stroke: isOwner && S.z.owner.length ? 'var(--accent)' : 'var(--border)', sw: isOwner && S.z.owner.length ? 2 : 1 }));
      const lab = L[id]; const lines = Array.isArray(lab) ? lab : [lab];
      lines.forEach((ln, i) => zonesG.append(T(z.x + 8, z.y + 16 + i * 14, ln, { fs: i ? 10.5 : 11.5, fw: i ? null : 700, fill: i ? 'var(--text-3)' : 'var(--text-2)' })));
    });
    // owner big label
    const oz = Z.owner;
    zonesG.append(T(oz.x + oz.w / 2, oz.y + 70, S.ownerTitle || '', { a: 'middle', fs: 12, fill: 'var(--text-3)' }));
    if (!S.z.owner.length) zonesG.append(T(oz.x + oz.w / 2, oz.y + 120, 'free', { a: 'middle', fs: 15, fw: 700, fill: 'var(--ok)' }));
    // done row
    zonesG.append(T(16, 286, 'state', { fs: 11, fw: 700, fill: 'var(--text-3)' }));
    zonesG.append(R(16, 292, W - 32, 46, { fill: 'var(--surface-2)' }));
    let x = 26;
    (S.info || []).forEach(([kname, v, hot]) => {
      const s = `${kname}: ${v}`; const w = s.length * 7.2 + 18;
      zonesG.append(R(x, 302, w, 26, { rx: 6, fill: hot ? 'var(--accent-soft)' : 'var(--surface)', stroke: hot ? 'var(--accent)' : 'var(--border)', sw: hot ? 2 : 1 }));
      zonesG.append(T(x + w / 2, 319, s, { a: 'middle', mono: true, fs: 12, fill: hot === 'bad' ? 'var(--err)' : 'var(--text)' }));
      x += w + 8;
    });
    // chips
    const seen = new Set();
    Object.entries(S.z).forEach(([zone, arr]) => arr.forEach((name, i) => {
      seen.add(name); const c = ensureChip(name);
      let px, py;
      if (zone === 'done') { px = Z.out.x + Z.out.w / 2 - CHW / 2; py = 232 - 0; const j = i; px = Z.out.x + 8 + (j % 2) * (CHW + 8); py = 226 - Math.floor(j / 2) * 30; }
      else [px, py] = slot(zone, i, arr.length);
      c.g.setAttribute('transform', `translate(${px},${py})`);
      const col = ZCOL[zone] || ZCOL.out; const hot = S.hot === name;
      c.r.setAttribute('fill', col[0]); c.r.setAttribute('stroke', hot ? 'var(--accent)' : col[1]); c.r.setAttribute('stroke-width', hot ? 2.5 : 1.5);
      c.t.setAttribute('fill', col[2]);
      c.g.style.opacity = '1';
      if (S.tags && S.tags[name]) { topG.append(T(px + CHW / 2, py - 4, S.tags[name], { a: 'middle', fs: 10, fw: 700, fill: S.tagC && S.tagC[name] || 'var(--accent)' })); }
    }));
    Object.keys(chipEls).forEach((n) => { if (!seen.has(n)) chipEls[n].g.style.opacity = '0'; });
    if (S.banner) topG.append(T(W - 16, 26, S.banner, { a: 'end', fs: 12.5, fw: 700, fill: S.bannerC || 'var(--text)' }));
  }
  function statLine() {
    stats.innerHTML = '';
    const add = (h) => stats.append(el('span', { class: 'w-stat', html: h }));
    add(`owner <b>${S.z.owner.join(', ') || '—'}</b>`);
    add(`${S.labels.entry[0] || 'queue'} <b>${S.z.entry.length}</b>`);
    if (S.labels.w1) add(`${(Array.isArray(S.labels.w1) ? S.labels.w1[0] : S.labels.w1)} <b>${S.z.w1.length}</b>`);
    if (S.labels.w2) add(`${(Array.isArray(S.labels.w2) ? S.labels.w2[0] : S.labels.w2)} <b>${S.z.w2.length}</b>`);
  }
  // moves
  const take = (n) => { Object.values(S.z).forEach((a) => { const i = a.indexOf(n); if (i >= 0) a.splice(i, 1); }); };
  const mv = (n, zone, front) => { take(n); if (front) S.z[zone].unshift(n); else S.z[zone].push(n); S.hot = n; };
  const info = (arr) => { S.info = arr; };
  const P = (st, run, t) => st.push({ run, t });

  function plan() {
    const st = [];
    if (mode === 'monitor') {
      code('synchronized Item take() throws InterruptedException {\n    while (!full) wait();          // release monitor, sit in the wait set\n    full = false; notifyAll(); return item;\n}\nsynchronized void put(Item i) throws InterruptedException {\n    while (full) wait();\n    item = i; full = true; notifyAll();\n}');
      P(st, () => { mv('C1', 'owner'); info([['full', 'false'], ['owner hold count', 1]]); }, 'C1 calls <code>take()</code>. The monitor is free, so C1 becomes the <b>owner</b> (a CAS on the object header when uncontended).');
      P(st, () => { mv('C2', 'entry'); }, 'C2 calls <code>take()</code> too. The monitor is owned, so C2 is <b>BLOCKED</b> in the entry set.');
      P(st, () => { mv('C1', 'w1'); S.tags = { C1: 'wait()' }; info([['full', 'false'], ['owner hold count', 0]]); }, 'C1 finds <code>full == false</code> and calls <code>wait()</code>: it <b>releases the monitor</b> and parks in the <b>wait set</b> (state WAITING).');
      P(st, () => { mv('C2', 'owner'); S.tags = {}; info([['full', 'false'], ['owner hold count', 1]]); }, 'The monitor is free, so C2 leaves the entry set and becomes the owner.');
      P(st, () => { mv('C2', 'w1'); S.tags = { C2: 'wait()' }; info([['full', 'false'], ['owner hold count', 0]]); }, 'C2 also finds the buffer empty and waits. Two consumers in the wait set, monitor free.');
      P(st, () => { mv('P', 'owner'); S.tags = {}; info([['full', 'true', true], ['owner hold count', 1]]); }, 'Producer P calls <code>put()</code>, owns the monitor, stores the item: <code>full = true</code>.');
      P(st, () => { mv('C1', 'entry'); mv('C2', 'entry'); S.hot = null; S.tags = { C1: 'woken', C2: 'woken' }; }, 'P calls <code>notifyAll()</code>. Both consumers move from the wait set to the <b>entry set</b>. They aren’t running yet: P still owns the monitor, and each must re-acquire it before <code>wait()</code> returns. (<code>notify()</code> would move just one, chosen arbitrarily.)');
      P(st, () => { mv('P', 'done'); mv('C2', 'owner'); S.tags = { C2: 'got it first' }; info([['full', 'true'], ['owner hold count', 1]]); }, 'P exits. Which waiter gets the monitor isn’t specified; here <b>C2</b> wins, even though C1 waited longer.');
      P(st, () => { mv('C2', 'done'); info([['full', 'false', true], ['owner hold count', 0]]); S.tags = {}; }, 'C2 re-checks <code>while (!full)</code>: true, so it takes the item (<code>full = false</code>), calls <code>notifyAll()</code> and returns.');
      P(st, () => { mv('C1', 'owner'); S.tags = { C1: 'checks again' }; info([['full', 'false', 'bad'], ['owner hold count', 1]]); }, 'C1 finally gets the monitor and returns from <code>wait()</code>. The item is <b>already gone</b>.');
      P(st, () => { mv('C1', 'w1'); S.tags = { C1: 'wait() again' }; info([['full', 'false'], ['owner hold count', 0]]); S.banner = 'while, not if'; S.bannerC = 'var(--ok)'; }, 'Because the check is a <code>while</code> loop, C1 sees the buffer is empty and waits again. With <code>if</code>, it would have “taken” an item that isn’t there.');
    } else if (mode === 'cond') {
      code('final Condition notFull = lock.newCondition(), notEmpty = lock.newCondition();\nvoid put(T x) throws InterruptedException {\n    lock.lock();\n    try { while (count == cap) notFull.await(); enqueue(x); notEmpty.signal(); }\n    finally { lock.unlock(); }\n}   // take() mirrors it: await notEmpty, signal notFull     (capacity 1)');
      P(st, () => { mv('P1', 'owner'); info([['count', '0/1'], ['AQS state', 1]]); }, 'P1 calls <code>lock()</code>: a CAS on the AQS <code>state</code> from 0 to 1. P1 owns the lock.');
      P(st, () => { info([['count', '1/1', true], ['AQS state', 1]]); S.tags = { P1: 'enqueue' }; }, 'P1 enqueues an item (count 1/1) and calls <code>notEmpty.signal()</code>: nobody is waiting on it.');
      P(st, () => { mv('P1', 'out'); S.tags = {}; info([['count', '1/1'], ['AQS state', 0]]); }, 'P1 unlocks in <code>finally</code> (state back to 0).');
      P(st, () => { mv('P2', 'owner'); info([['count', '1/1'], ['AQS state', 1]]); }, 'P2 locks and finds the buffer full…');
      P(st, () => { mv('P2', 'w1'); S.tags = { P2: 'await()' }; info([['count', '1/1'], ['AQS state', 0]]); }, '…so it calls <code>notFull.await()</code>: it fully releases the lock (saving its hold count) and parks in the <b>notFull</b> condition queue.');
      P(st, () => { mv('P1', 'owner'); S.tags = {}; info([['count', '1/1'], ['AQS state', 1]]); }, 'P1 comes back with another item, locks, finds it full…');
      P(st, () => { mv('P1', 'w1'); S.tags = { P1: 'await()' }; info([['count', '1/1'], ['AQS state', 0]]); }, '…and waits on <b>notFull</b> too, behind P2 (condition queues are FIFO).');
      P(st, () => { mv('C1', 'owner'); S.tags = {}; info([['count', '0/1', true], ['AQS state', 1]]); }, 'Consumer C1 locks and takes the item: count 0/1.');
      P(st, () => { mv('P2', 'entry'); S.tags = { P2: 'signalled' }; }, 'C1 calls <code>notFull.signal()</code>. The <b>first</b> waiter, P2, moves from the condition queue to the lock’s <b>AQS queue</b>. Only a producer is woken: consumers wait on a different queue, so no wake-up is wasted.');
      P(st, () => { mv('C1', 'done'); mv('P2', 'owner'); S.tags = { P2: 'await() returns' }; info([['count', '0/1'], ['AQS state', 1]]); }, 'C1 unlocks, which unparks the head of the AQS queue. P2 re-acquires (restoring its hold count) and returns from <code>await()</code>.');
      P(st, () => { info([['count', '1/1', true], ['AQS state', 1]]); S.tags = {}; S.banner = 'targeted wake-ups'; S.bannerC = 'var(--ok)'; }, 'P2 re-checks <code>while (count == cap)</code> (false), enqueues, signals <code>notEmpty</code>. P1 keeps waiting on notFull until the next take. This is how <code>ArrayBlockingQueue</code> works.');
    } else if (mode === 'rw') {
      code('ReentrantReadWriteLock rw = new ReentrantReadWriteLock();   // non-fair\nrw.readLock().lock();  try { read(); }  finally { rw.readLock().unlock(); }\nrw.writeLock().lock(); try { write(); } finally { rw.writeLock().unlock(); }\n// state: high 16 bits = read holds, low 16 bits = write holds');
      P(st, () => { mv('R1', 'owner'); info([['readers', 1], ['writer', 'none']]); S.ownerTitle = 'read holders (shared)'; }, 'R1 takes the <b>read</b> lock.');
      P(st, () => { mv('R2', 'owner'); info([['readers', 2], ['writer', 'none']]); }, 'R2 takes it too: read locks are <b>shared</b>, so both read at once.');
      P(st, () => { mv('W', 'entry'); S.tags = { W: 'writeLock()' }; }, 'W wants the <b>write</b> lock, which is exclusive: it waits until there are no readers.');
      P(st, () => { mv('R3', 'entry'); S.tags = { W: 'writeLock()', R3: 'readLock()' }; }, 'R3 asks for a read lock. Readers are in, so it could join them, but a non-fair RRW lock makes a new reader <b>queue</b> if the first waiter is a writer. Otherwise a steady stream of readers could starve W forever.');
      P(st, () => { mv('R1', 'done'); info([['readers', 1], ['writer', 'none']]); }, 'R1 releases.');
      P(st, () => { mv('R2', 'done'); info([['readers', 0], ['writer', 'none']]); S.hot = 'R2'; }, 'R2 releases: no readers left.');
      P(st, () => { mv('W', 'owner'); S.ownerTitle = 'write holder (exclusive)'; info([['readers', 0], ['writer', 'W', true]]); S.tags = { R3: 'readLock()' }; }, 'W gets the <b>exclusive</b> write lock.');
      P(st, () => { mv('W', 'done'); mv('R3', 'owner'); S.ownerTitle = 'read holders (shared)'; info([['readers', 1], ['writer', 'none']]); S.tags = {}; }, 'W releases; R3 gets its read lock.');
      P(st, () => { S.hot = 'R3'; S.tags = { R3: 'writeLock()?' }; S.banner = 'upgrade = self-deadlock'; S.bannerC = 'var(--err)'; info([['readers', 1], ['writer', 'waits for readers = itself', 'bad']]); }, 'If R3 now called <code>writeLock().lock()</code> while holding its read lock, it would wait for all readers to leave, <b>including itself</b>: deadlock. Release the read lock first and re-check, or downgrade the other way round (write → read is allowed).');
    } else if (mode === 'stamped') {
      code('long s = sl.tryOptimisticRead();     // no lock: just read the version\ndouble x = this.x, y = this.y;       // copy fields into locals\nif (!sl.validate(s)) {               // a write happened since s?\n    s = sl.readLock();\n    try { x = this.x; y = this.y; } finally { sl.unlockRead(s); }\n}');
      S.ownerTitle = 'lock holders';
      P(st, () => { mv('R', 'w1'); S.tags = { R: 'stamp v1' }; info([['version', 'v1'], ['x', 1], ['y', 1], ['R sees', '—']]); }, 'R calls <code>tryOptimisticRead()</code>: it gets a <b>stamp</b> (the current version) and takes <b>no lock</b> at all. Writers aren’t blocked by it.');
      P(st, () => { info([['version', 'v1'], ['x', 1], ['y', 1], ['R sees', 'x=1', true]]); }, 'R copies <code>x</code> into a local: 1.');
      P(st, () => { mv('W', 'owner'); info([['version', 'v1 → write-locked', true], ['x', 1], ['y', 1], ['R sees', 'x=1']]); S.tags = { R: 'stamp v1', W: 'writeLock()' }; }, 'W takes the write lock, which bumps the version. R doesn’t notice; it never checks during its reads.');
      P(st, () => { info([['version', 'write-locked'], ['x', 5, true], ['y', 5, true], ['R sees', 'x=1']]); }, 'W writes <code>x = 5, y = 5</code>.');
      P(st, () => { mv('W', 'done'); info([['version', 'v2', true], ['x', 5], ['y', 5], ['R sees', 'x=1']]); S.tags = { R: 'stamp v1' }; }, '<code>unlockWrite</code>: the version is now v2.');
      P(st, () => { info([['version', 'v2'], ['x', 5], ['y', 5], ['R sees', 'x=1, y=5', 'bad']]); }, 'R copies <code>y</code>: 5. Its locals are now <b>inconsistent</b> (x=1, y=5), a state that never existed. That is fine only because R hasn’t <i>used</i> them yet.');
      P(st, () => { mv('R', 'owner'); S.tags = { R: 'validate → false' }; info([['version', 'v2'], ['x', 5], ['y', 5], ['R sees', 're-reading…']]); }, '<code>validate(v1)</code> returns <b>false</b>: a write happened. R falls back to a real <code>readLock()</code>.');
      P(st, () => { info([['version', 'v2'], ['x', 5], ['y', 5], ['R sees', 'x=5, y=5', true]]); S.banner = 'validate before you use'; S.bannerC = 'var(--ok)'; }, 'Under the read lock R reads a consistent pair (5, 5). When writes are rare, the optimistic path almost always validates, and readers cost no shared writes at all. Not reentrant, no Conditions.');
      P(st, () => { mv('R', 'done'); S.tags = {}; }, 'R unlocks. Use this for tiny, read-hot critical sections; for anything bigger, a <code>ReentrantLock</code> or an immutable snapshot is easier to get right.');
    } else {
      code('new ReentrantLock()       // non-fair (default): a running thread may barge in\nnew ReentrantLock(true)   // fair: FIFO hand-off to the longest waiter\n// note: untimed tryLock() barges even on a fair lock');
      P(st, () => { mv('T1', 'owner'); mv('T2', 'entry'); S.tags = { T2: 'parked' }; info([['mode', 'non-fair'], ['handoffs', 0]]); S.ownerTitle = 'owner'; }, '<b>Non-fair</b>. T1 holds the lock; T2 is queued and <b>parked</b> (descheduled by the OS).');
      P(st, () => { take('T1'); S.z.out.unshift('T1'); S.hot = 'T1'; S.tags = { T2: 'unpark… waking' }; }, 'T1 unlocks and unparks T2. Waking a parked thread takes the OS several microseconds.');
      P(st, () => { mv('T3', 'owner'); S.tags = { T2: 'still waking', T3: 'CAS wins' }; info([['mode', 'non-fair'], ['barged', 'T3', true]]); }, 'Meanwhile T3, already running on a CPU, calls <code>lock()</code>, sees the lock free and wins the CAS: it <b>barges</b> past T2. Great for throughput (no handoff gap)…');
      P(st, () => { S.tags = { T2: 'CAS fails → re-park', T3: '' }; S.hot = 'T2'; }, '…but T2 wakes up, fails its CAS and parks again. Under heavy contention a waiter can lose this race many times in a row: <b>starvation</b>.');
      P(st, () => { take('T3'); take('T2'); take('T1'); S.z.owner = ['T1']; S.z.entry = ['T2']; S.z.out = ['T3']; S.z.done = []; S.hot = null; S.tags = { T2: 'parked' }; info([['mode', 'fair'], ['handoffs', 0]]); S.banner = 'now with new ReentrantLock(true)'; S.bannerC = 'var(--accent)'; }, 'Replay with a <b>fair</b> lock. Same situation: T1 owns it, T2 is parked in the queue.');
      P(st, () => { take('T1'); S.z.out.unshift('T1'); S.hot = 'T1'; S.tags = { T2: 'unpark… waking' }; }, 'T1 unlocks and unparks T2.');
      P(st, () => { mv('T3', 'entry'); S.tags = { T2: 'waking', T3: 'hasQueuedPredecessors' }; }, 'T3 calls <code>lock()</code>. A fair lock first checks <code>hasQueuedPredecessors()</code>: T2 is ahead, so T3 <b>queues</b> even though the lock is free right now.');
      P(st, () => { mv('T2', 'owner'); S.tags = { T3: 'parked' }; info([['mode', 'fair'], ['handoffs', 1]]); S.banner = 'FIFO, but slower'; S.bannerC = 'var(--warn)'; }, 'T2 gets the lock. No starvation, but the lock sat idle while T2 woke up, on every handoff. Under contention fair locks are typically much slower. <code>synchronized</code> makes no fairness promise at all.');
    }
    return st;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    Object.keys(chipEls).forEach((n) => { chipEls[n].g.remove(); delete chipEls[n]; });
    const L = {
      monitor: { out: ['running', 'outside the lock'], entry: ['entry set', 'BLOCKED'], owner: ['owner', ''], w1: ['wait set', 'WAITING, monitor released'] },
      cond: { out: ['running'], entry: ['AQS queue', 'WAITING (parking)'], owner: ['owner'], w1: ['notFull', 'producers await here'], w2: ['notEmpty', 'consumers await here'] },
      rw: { out: ['running'], entry: ['AQS queue', 'WAITING (parking)'], owner: ['lock holders'] },
      stamped: { out: ['running'], entry: ['AQS queue'], owner: ['lock holders'], w1: ['optimistic readers', 'no lock held!'] },
      fair: { out: ['running on a CPU'], entry: ['AQS queue', 'parked threads'], owner: ['owner'] }
    }[mode];
    const outs = { monitor: ['C1', 'C2', 'P'], cond: ['P1', 'P2', 'C1'], rw: ['R1', 'R2', 'W', 'R3'], stamped: ['R', 'W'], fair: ['T3'] }[mode];
    S = { z: { out: outs.slice(), entry: [], owner: [], w1: [], w2: [], done: [] }, labels: L, info: [], tags: {}, hot: null, banner: null, ownerTitle: mode === 'rw' ? 'read holders (shared)' : '' };
    if (mode === 'fair') S.z.out = ['T1', 'T2', 'T3'];
    if (mode === 'monitor') S.info = [['full', 'false'], ['owner hold count', 0]];
    if (mode === 'cond') S.info = [['count', '0/1'], ['AQS state', 0]];
    if (mode === 'rw') S.info = [['readers', 0], ['writer', 'none']];
    if (mode === 'stamped') S.info = [['version', 'v1'], ['x', 1], ['y', 1]];
    if (mode === 'fair') S.info = [['mode', 'non-fair']];
    steps = plan(); render(); statLine(); bStep.disabled = false;
    say({ monitor: 'Two consumers and a producer share one monitor. Press Play or Step.', cond: 'A capacity-1 buffer with a ReentrantLock and two Conditions.', rw: 'Two readers, a writer, and a reader who arrives late.', stamped: 'A reader takes an optimistic stamp while a writer sneaks in.', fair: 'The same handoff, non-fair and then fair.' }[mode]);
  }
  function step() {
    if (k >= steps.length) return false; const s = steps[k++]; s.run(); render(); statLine(); say(typeof s.t === 'function' ? s.t() : s.t);
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

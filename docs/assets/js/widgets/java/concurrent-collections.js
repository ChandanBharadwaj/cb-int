/* Concurrent collections: two-thread timelines for check-then-act vs computeIfAbsent, lost updates vs merge,
   CopyOnWrite snapshots, a bounded BlockingQueue, and a skip-list search. */
IA.widget('concurrent-collections', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let mode = 'race'; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['race', 'check-then-act vs computeIfAbsent'], ['count', 'get+put vs merge'], ['cow', 'CopyOnWriteArrayList'], ['bq', 'BlockingQueue'], ['skip', 'ConcurrentSkipListMap']], () => mode, (v) => { mode = v; reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const W = 760, H = 320;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Two thread timelines with the shared data structure in the middle' });
  const codeHost = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), codeHost, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const code = (src) => { codeHost.innerHTML = ''; codeHost.append(el('pre', { html: IA.highlight(src, 'java') })); };
  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 13, fill: 'var(--text)', text: t }, o || {}));
  const R = (x, y, w, h, o) => svg('rect', Object.assign({ x, y, width: w, height: h, rx: 6, fill: 'var(--surface)', stroke: 'var(--border)' }, o || {}));
  const COL = { ok: 'var(--ok)', err: 'var(--err)', wait: 'var(--warn)', '': 'var(--text)' };
  let S;

  function lanes() {
    const LX = [20, 0, 520]; const LW = 220;
    [[1, 'Thread T1'], [2, S.t2 || 'Thread T2']].forEach(([n, name]) => { const x = LX[n === 1 ? 0 : 2];
      stage.append(R(x, 10, LW, H - 20, { fill: 'var(--surface-2)' }), T(x + 10, 30, name, { 'font-weight': 700 }));
      if (S.busy && S.busy[n]) stage.append(T(x + LW - 10, 30, S.busy[n], { 'text-anchor': 'end', 'font-size': 11, fill: S.busy[n] === 'BLOCKED' || S.busy[n] === 'WAITING' ? 'var(--warn)' : 'var(--text-3)' })); });
    S.ev.forEach((e, i) => { const x = LX[e.lane === 1 ? 0 : 2] + 10; const y = 56 + i * 24;
      stage.append(T(x, y, e.text, { 'font-size': 11.5, 'font-family': 'var(--mono)', fill: COL[e.cls || ''], 'font-weight': i === S.ev.length - 1 ? 700 : 400 }));
      stage.append(svg('line', { x1: 250, y1: y - 4, x2: 510, y2: y - 4, stroke: 'var(--border)', 'stroke-dasharray': '2 4' })); });
  }
  function shared() {
    const X = 262, Wd = 236;
    stage.append(R(X, 10, Wd, H - 20, { stroke: 'var(--accent)' }), T(X + Wd / 2, 30, S.title, { 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 12 }));
    if (mode === 'race' || mode === 'count') {
      stage.append(R(X + 20, 60, Wd - 40, 70, { fill: S.lock ? 'var(--accent-soft)' : 'var(--surface)', stroke: S.lock ? 'var(--accent)' : 'var(--border)' }));
      stage.append(T(X + 30, 80, `bin[${mode === 'race' ? 'hash("fx")' : 'hash("/home")'} & (n−1)]`, { 'font-size': 11, fill: 'var(--text-3)' }));
      stage.append(T(X + Wd / 2, 110, S.cell, { 'text-anchor': 'middle', 'font-family': 'var(--mono)', 'font-size': 15, 'font-weight': 700 }));
      stage.append(T(X + Wd / 2, 152, S.lock ? `synchronized(head) held by ${S.lock}` : 'no lock held', { 'text-anchor': 'middle', 'font-size': 11, fill: S.lock ? 'var(--accent)' : 'var(--text-3)' }));
      if (S.side) stage.append(T(X + Wd / 2, 190, S.side, { 'text-anchor': 'middle', 'font-size': 12, fill: S.sideC || 'var(--text-2)' }));
      if (S.side2) stage.append(T(X + Wd / 2, 212, S.side2, { 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--text-2)' }));
    } else if (mode === 'cow') {
      S.arrays.forEach((arr, j) => { const y = 64 + j * 80;
        stage.append(T(X + 14, y - 6, `array #${j + 1}` + (S.cur === j ? '  ← volatile array' : ''), { 'font-size': 11, fill: S.cur === j ? 'var(--accent)' : 'var(--text-3)' }));
        arr.forEach((v, i) => { stage.append(R(X + 14 + i * 50, y, 44, 30, { fill: S.cur === j ? 'var(--accent-soft)' : 'var(--surface)', stroke: S.cur === j ? 'var(--accent)' : 'var(--border)' }), T(X + 36 + i * 50, y + 20, v, { 'text-anchor': 'middle', 'font-family': 'var(--mono)' })); });
        if (S.snap === j) stage.append(T(X + 14, y + 48, '▲ T1’s iterator snapshot', { 'font-size': 11, fill: 'var(--warn)' })); });
    } else if (mode === 'bq') {
      for (let i = 0; i < 2; i++) { const v = S.q[i];
        stage.append(R(X + 40 + i * 80, 80, 70, 44, { fill: v ? 'var(--accent-soft)' : 'var(--surface)', stroke: v ? 'var(--accent)' : 'var(--border)', 'stroke-dasharray': v ? null : '4 3' }));
        stage.append(T(X + 75 + i * 80, 108, v || '', { 'text-anchor': 'middle', 'font-family': 'var(--mono)', 'font-weight': 700 })); }
      stage.append(T(X + Wd / 2, 150, `count ${S.q.filter(Boolean).length} / capacity 2`, { 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--text-2)' }));
      stage.append(T(X + Wd / 2, 180, 'notFull: ' + (S.wNF ? 'T1 waiting' : '—'), { 'text-anchor': 'middle', 'font-size': 11.5, fill: S.wNF ? 'var(--warn)' : 'var(--text-3)' }));
      stage.append(T(X + Wd / 2, 200, 'notEmpty: ' + (S.wNE ? 'T2 waiting' : '—'), { 'text-anchor': 'middle', 'font-size': 11.5, fill: S.wNE ? 'var(--warn)' : 'var(--text-3)' }));
      stage.append(T(X + Wd / 2, 232, 'one ReentrantLock + 2 Conditions', { 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-3)' }));
    }
  }
  const SK = { 2: [10, 50], 1: [10, 30, 50, 70], 0: [10, 20, 30, 40, 50, 60, 70] };
  function skip() {
    const kx = (key) => 110 + (key / 10) * 82; const ly = (l) => 230 - l * 80;
    stage.append(T(20, 22, 'ConcurrentSkipListMap: index levels over a sorted linked list', { 'font-size': 12, fill: 'var(--text-3)' }));
    [2, 1, 0].forEach((l) => {
      stage.append(R(20, ly(l) - 16, 60, 32, { fill: 'var(--surface-2)' }), T(50, ly(l) + 5, l ? 'index ' + l : 'base', { 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-3)' }));
      const keys = SK[l]; let prev = 80;
      keys.forEach((key) => { const x = kx(key);
        stage.append(svg('line', { x1: prev, y1: ly(l), x2: x - 20, y2: ly(l), stroke: S.edges.has(l + ':' + key) ? 'var(--accent)' : 'var(--border)', 'stroke-width': S.edges.has(l + ':' + key) ? 2.5 : 1.4 }));
        const hot = S.at === l + ':' + key; const res = S.res.has(key) && l === 0;
        stage.append(R(x - 20, ly(l) - 16, 40, 32, { fill: res ? 'var(--accent-soft)' : hot ? 'var(--accent-soft)' : 'var(--surface)', stroke: res ? 'var(--ok)' : hot ? 'var(--accent)' : 'var(--border)', 'stroke-width': hot || res ? 2.5 : 1 }));
        stage.append(T(x, ly(l) + 5, String(key), { 'text-anchor': 'middle', 'font-family': 'var(--mono)', 'font-weight': 700 }));
        if (l > 0) stage.append(svg('line', { x1: x, y1: ly(l) + 16, x2: x, y2: ly(l - 1) - 16, stroke: S.down.has(l + ':' + key) ? 'var(--accent)' : 'var(--border)', 'stroke-width': S.down.has(l + ':' + key) ? 2.5 : 1, 'stroke-dasharray': '3 3' }));
        prev = x + 20; });
    });
    stage.append(T(W - 20, 22, 'floorKey(45)', { 'text-anchor': 'end', 'font-family': 'var(--mono)', fill: 'var(--accent)', 'font-weight': 700 }));
  }
  function render() {
    stage.innerHTML = '';
    if (mode === 'skip') skip(); else { lanes(); shared(); }
    stats.innerHTML = ''; (S.stats || []).forEach(([l, v]) => stats.append(el('span', { class: 'w-stat', html: `${l} <b>${v}</b>` })));
  }
  const ev = (lane, text, cls) => S.ev.push({ lane, text, cls });
  function plan() {
    const st = []; const P = (run, t) => st.push({ run, t });
    if (mode === 'race') {
      code('// ✗ two atomic calls are not one atomic action\nif (!cache.containsKey("fx")) cache.put("fx", loadRates());\n\n// ✓ one atomic call per key\ncache.computeIfAbsent("fx", k -> loadRates());');
      P(() => { ev(1, 'containsKey("fx") → false'); }, 'Broken version first. T1 checks: no entry.');
      P(() => { ev(2, 'containsKey("fx") → false'); }, 'T2 checks a moment later: still no entry. Each call is thread-safe on its own. The <b>gap between them</b> is not.');
      P(() => { ev(1, 'loadRates() … 200 ms'); ev(2, 'loadRates() … 200 ms', 'wait'); S.loads = 2; S.stats = [['loads', 2]]; }, 'Both threads now call the slow loader. Under a traffic spike this is a <b>cache stampede</b>: N threads make N identical calls to the rate service.');
      P(() => { ev(1, 'put("fx", r1)'); S.cell = '"fx" → r1'; }, 'T1 stores r1.');
      P(() => { ev(2, 'put("fx", r2)  overwrites!', 'err'); S.cell = '"fx" → r2'; S.side = 'T1 returned r1, the map holds r2'; S.sideC = 'var(--err)'; }, 'T2 overwrites with r2. Two callers now hold different objects for the same key. Anything that needs the same object (locks, caches of caches) breaks.');
      P(() => { S.ev = []; S.cell = '(empty)'; S.side = ''; S.stats = [['loads (fixed)', 0]]; }, 'Now the fix: <code>computeIfAbsent</code>. Same two threads, same timing.');
      P(() => { ev(1, 'computeIfAbsent: bin empty'); ev(1, ' CAS in ReservationNode', 'ok'); S.lock = 'T1'; S.cell = '"fx" → (computing…)'; S.busy = { 1: 'RUNNABLE' }; }, 'T1 finds the bin empty. It CASes a placeholder (<b>ReservationNode</b>) into the bin and locks it while the function runs.');
      P(() => { ev(2, 'computeIfAbsent("fx")', 'wait'); ev(2, ' synchronized(bin) → BLOCKED', 'wait'); S.busy = { 1: 'RUNNABLE', 2: 'BLOCKED' }; }, 'T2 lands in the same bin, sees the placeholder and waits on its lock. Keys in other bins are not affected. Reads never lock, and writes lock one bin.');
      P(() => { ev(1, 'loadRates() → r1; publish', 'ok'); S.cell = '"fx" → r1'; S.lock = 'T2'; S.busy = { 1: 'done', 2: 'RUNNABLE' }; S.stats = [['loads (fixed)', 1]]; }, 'T1’s function returns r1, which replaces the reservation, and the lock is released.');
      P(() => { ev(2, 'finds "fx" → returns r1', 'ok'); S.lock = null; S.side = 'one load, one value'; S.sideC = 'var(--ok)'; S.side2 = 'keep the function short: it holds the bin lock'; }, 'T2 gets the lock, finds the entry and returns <b>r1</b> without calling the loader. Keep the function short, and never touch the same map inside it. In Java 9+ that may throw <code>IllegalStateException("Recursive update")</code>.');
    } else if (mode === 'count') {
      code('// ✗ lost update\nhits.put(path, hits.get(path) + 1);\n\n// ✓ atomic read-modify-write\nhits.merge(path, 1, Integer::sum);\n// or: ConcurrentHashMap<String, LongAdder>  →  hits.computeIfAbsent(p, k -> new LongAdder()).increment();');
      P(() => { ev(1, 'get("/home") → 5'); }, 'Starting value 5. T1 reads it.');
      P(() => { ev(2, 'get("/home") → 5'); }, 'T2 reads before T1 writes: also 5.');
      P(() => { ev(1, 'put("/home", 6)'); S.cell = '"/home" → 6'; }, 'T1 writes 6.');
      P(() => { ev(2, 'put("/home", 6)  lost update', 'err'); S.cell = '"/home" → 6'; S.side = 'two hits, counter +1'; S.sideC = 'var(--err)'; S.stats = [['expected', 7], ['actual', 6]]; }, 'T2 also writes 6. Two increments, one recorded. ConcurrentHashMap kept itself intact. But your <b>read, change, write</b> was never one step.');
      P(() => { S.ev = []; S.cell = '"/home" → 5'; S.side = ''; S.stats = []; }, 'Fixed version with <code>merge</code>.');
      P(() => { ev(1, 'merge: lock bin, 5+1', 'ok'); S.lock = 'T1'; S.cell = '"/home" → 6'; S.busy = { 1: 'RUNNABLE' }; }, 'T1’s <code>merge</code> locks the bin’s first node, applies <code>Integer::sum</code> and writes 6.');
      P(() => { ev(2, 'merge → BLOCKED on bin', 'wait'); S.busy = { 1: 'RUNNABLE', 2: 'BLOCKED' }; }, 'T2’s merge waits for the same bin.');
      P(() => { ev(2, 'merge: 6+1 → 7', 'ok'); S.lock = 'T2'; S.cell = '"/home" → 7'; S.busy = { 1: 'done', 2: 'RUNNABLE' }; S.stats = [['expected', 7], ['actual', 7]]; }, 'T2 reads 6 and writes <b>7</b>. Correct.');
      P(() => { S.lock = null; S.side = 'size(): baseCount + Σ CounterCells'; S.sideC = 'var(--text-2)'; S.side2 = 'an estimate while writers run'; ev(1, 'size() / mappingCount()'); }, 'How does <code>size()</code> stay cheap? The map keeps a <code>baseCount</code> plus several <b>CounterCells</b> (the LongAdder idea). It adds them up when asked. While others write, the result is an estimate. <code>mappingCount()</code> returns a <code>long</code>.');
    } else if (mode === 'cow') {
      code('List<Listener> listeners = new CopyOnWriteArrayList<>(List.of(a, b, c));\n// T1: for (Listener l : listeners) l.onEvent(e);\n// T2: listeners.add(d);');
      P(() => { ev(1, 'iterator() → snapshot #1'); S.snap = 0; }, 'T1 starts looping. The iterator grabs the current array: a frozen copy (<b>snapshot</b>).');
      P(() => { ev(1, 'next() → a'); }, 'T1 reads a. No lock is involved in reading.');
      P(() => { ev(2, 'add(d): lock, copy 3 → 4', 'wait'); S.arrays.push(['a', 'b', 'c', 'd']); S.stats = [['copies', '1 × n']]; }, 'T2 calls <code>add(d)</code>. Under a lock, it <b>copies</b> the whole array into a new one with d at the end. Every write is O(n) and makes a new array.');
      P(() => { ev(2, 'setArray(#2)', 'ok'); S.cur = 1; }, 'T2 swaps in the new array with a volatile write. New readers see a, b, c, d.');
      P(() => { ev(1, 'next() → b, next() → c'); ev(1, 'hasNext() → false', 'ok'); }, 'T1 keeps walking <b>its</b> copy: b, c, done. It never sees d and never throws CME. <code>it.remove()</code> would throw UnsupportedOperationException.');
      P(() => { S.snap = null; S.arrays.shift(); S.cur = 0; }, 'Once T1 finishes, array #1 is garbage. Great for data you mostly read (listeners, routing tables, config). Terrible for lists you write often: 10k elements × 1k writes/s is 10M copies per second.');
    } else if (mode === 'bq') {
      S.t2 = 'Consumer T2';
      code('BlockingQueue<Job> q = new ArrayBlockingQueue<>(2);\n// T1 (producer): q.put(job)     blocks when full\n// T2 (consumer): q.take()        blocks when empty');
      P(() => { ev(2, 'take() → empty, wait', 'wait'); S.wNE = true; S.busy = { 2: 'WAITING' }; }, 'The consumer starts first. The queue is empty, so <code>take()</code> sleeps on the <b>notEmpty</b> condition. No spinning, no CPU.');
      P(() => { ev(1, 'put(J1)', 'ok'); S.q = ['J1', null]; }, 'Producer puts J1 and signals notEmpty.');
      P(() => { ev(2, 'take() → J1', 'ok'); S.q = [null, null]; S.wNE = false; S.busy = { 2: 'RUNNABLE' }; }, 'The consumer wakes and takes J1. Then it is busy for a while processing it.');
      P(() => { ev(1, 'put(J2)', 'ok'); ev(1, 'put(J3)', 'ok'); S.q = ['J2', 'J3']; }, 'The producer is faster: J2 and J3 fill the queue to its capacity of 2.');
      P(() => { ev(1, 'put(J4) → full, wait', 'wait'); S.wNF = true; S.busy = { 1: 'WAITING', 2: 'RUNNABLE' }; }, '<code>put(J4)</code> waits on <b>notFull</b>. This is <b>backpressure</b>: a slow consumer slows the producer down, so memory can’t grow forever.');
      P(() => { ev(2, 'take() → J2', 'ok'); S.q = ['J4', 'J3']; S.wNF = false; ev(1, 'put(J4) resumes', 'ok'); S.busy = { 1: 'RUNNABLE', 2: 'RUNNABLE' }; }, 'The consumer takes J2, signals notFull, and the producer’s put completes into the freed slot (it is a circular buffer).');
      P(() => { ev(1, 'offer(J5, 50ms) → false', 'err'); S.stats = [['rejected', 1]]; }, 'In request code, prefer <code>offer(e, timeout)</code>. It returns <b>false</b> when the queue stays full. Then you can drop work or return 503, instead of hanging the request thread.');
    } else {
      code('ConcurrentSkipListMap<Integer, Slot> m = …;   // keys 10..70\nm.floorKey(45);          // lock-free, O(log n) expected');
      const W2 = [['2:10', null, null, 'Start at the top level. 10 ≤ 45. The next key on this level is 50 &gt; 45, so go <b>down</b>.'], ['1:10', '2:10', null, 'Level 1, still at 10. Next is 30 ≤ 45: move right.'], ['1:30', null, '1:30', '30 ≤ 45. Next is 50 &gt; 45: go down.'], ['0:30', '1:30', null, 'Base level at 30. Next is 40 ≤ 45: move right.'], ['0:40', null, '0:40', '40 ≤ 45, next is 50 &gt; 45, and there is no level below. Answer: <b>40</b>.']];
      W2.forEach(([at, down, edge, t], i) => P(() => { S.at = at; if (down) S.down.add(down); if (edge) S.edges.add(edge); if (i === W2.length - 1) S.res.add(40); S.stats = [['nodes visited', i + 1]]; }, t));
      P(() => { S.at = null; }, 'Each node gets shortcut levels at random: about half go one level up, a quarter two levels, and so on. So searches take O(log n) on average. Inserts and deletes use CAS on <code>next</code> pointers, with no locks. It is the concurrent <b>sorted</b> map. Use it where many threads would share a TreeMap. <code>size()</code> is O(n).');
    }
    return st;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    S = { ev: [], busy: null, lock: null, cell: mode === 'count' ? '"/home" → 5' : '(empty)', side: '', side2: '', stats: [], title: { race: 'ConcurrentHashMap cache', count: 'ConcurrentHashMap hits', cow: 'CopyOnWriteArrayList', bq: 'ArrayBlockingQueue(2)', skip: '' }[mode],
      arrays: [['a', 'b', 'c']], cur: 0, snap: null, q: [null, null], wNF: false, wNE: false, at: null, edges: new Set(), down: new Set(), res: new Set() };
    steps = plan(); render(); bStep.disabled = false;
    say({ race: 'Two request threads want the same cached FX rates. Press Play: first the naive version, then <code>computeIfAbsent</code>.', count: 'Two threads count hits for the same path. Press Play: first get+put, then <code>merge</code>.', cow: 'A listener list is read on every event and changed rarely. Press Play to watch a write during an iteration.', bq: 'A producer and a consumer share a queue of capacity 2. Press Play.', skip: 'A skip list holding 10 … 70. Press Play to find the greatest key ≤ 45.' }[mode]);
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

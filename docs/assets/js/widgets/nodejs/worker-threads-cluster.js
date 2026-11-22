/* Worker threads & cluster: main thread and a Worker with separate heaps; postMessage by clone, transfer
   and SharedArrayBuffer (+ Atomics); and cluster: a primary dealing connections round-robin to worker processes. */
IA.widget('worker-threads-cluster', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-wtc-style')) {
    document.head.append(el('style', { id: 'w-wtc-style', text: `
.w-wtc .th { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; }
.w-wtc .th.busy { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-soft); }
.w-wtc .th.dead { stroke: var(--err); stroke-dasharray: 5 4; opacity: .6; }
.w-wtc .heap { fill: var(--surface-2); stroke: var(--border); stroke-width: 1; }
.w-wtc .blk { fill: var(--accent-2); }
.w-wtc .blk.copy { fill: color-mix(in srgb, var(--accent-2) 55%, var(--surface)); }
.w-wtc .blk.det { fill: none; stroke: var(--text-3); stroke-width: 1.5; stroke-dasharray: 4 3; }
.w-wtc .blk.small { fill: var(--ok); }
.w-wtc .sab { fill: color-mix(in srgb, var(--warn) 16%, var(--surface)); stroke: var(--warn); stroke-width: 2; }
.w-wtc .ref { stroke: var(--warn); stroke-width: 2; stroke-dasharray: 5 4; fill: none; }
.w-wtc .msg { fill: var(--accent); transition: transform .6s cubic-bezier(.5,0,.3,1); }
.w-wtc .pipe { stroke: var(--border); stroke-width: 6; stroke-linecap: round; }
.w-wtc .t1 { fill: var(--text); font-size: 14px; font-weight: 700; }
.w-wtc .t2 { fill: var(--text-3); font-size: 12px; }
.w-wtc .tb { fill: var(--accent); font-size: 12px; font-weight: 700; }
.w-wtc .tw { fill: var(--warn); font-size: 13px; font-weight: 700; }
.w-wtc .te { fill: var(--err); font-size: 13px; font-weight: 700; }
.w-wtc .big { fill: var(--text); font-family: var(--mono); font-size: 22px; font-weight: 700; }
.w-wtc .conn { stroke: var(--accent); stroke-width: 2.5; fill: none; marker-end: url(#w-wtc-ah); }
` }));
  }
  const B = (label, cls) => ({ label, cls: cls || '' });
  const MODES = {
    clone: { label: 'Clone', frames: [
      { main: [B('rows 8 MB')], w: [], cap: 'The main thread holds <code>rows</code>, an 8 MB array of objects, in <b>its</b> heap. The Worker has a separate heap and can’t see it.' },
      { main: [B('rows 8 MB')], w: [], mainBusy: 'serializing…', msg: { p: 0, l: 'bytes' }, cap: '<code>worker.postMessage(rows)</code> runs the structured-clone algorithm <b>on the main thread</b>. The bigger the graph, the longer the main loop is blocked.' },
      { main: [B('rows 8 MB')], w: [], msg: { p: 0.5, l: 'bytes' }, cap: 'The serialized bytes travel through the MessagePort to the Worker.' },
      { main: [B('rows 8 MB')], w: [], wBusy: 'deserializing…', msg: { p: 1, l: 'bytes' }, cap: 'The Worker rebuilds a brand-new object graph in its own heap.' },
      { main: [B('rows 8 MB')], w: [B('copy 8 MB', 'copy')], cap: 'Now there are <b>two copies</b> (16 MB). Changes on one side are invisible to the other. Class prototypes and functions did not survive the trip.' },
      { main: [B('rows 8 MB')], w: [B('copy 8 MB', 'copy')], wBusy: 'computing…', cap: 'The Worker does the CPU-heavy part on its own thread. The main event loop is free to serve requests.' },
      { main: [B('rows 8 MB'), B('result', 'small')], w: [B('copy 8 MB', 'copy')], msg: { p: 0, l: 'result', back: true }, cap: 'It posts back a small result, which is cheap to clone. Rule of thumb: send small messages or IDs, not big graphs.' }
    ] },
    transfer: { label: 'Transfer', frames: [
      { main: [B('ArrayBuffer 8 MB')], w: [], cap: 'The main thread has an 8 MB <code>ArrayBuffer</code>: raw image pixels.' },
      { main: [B('detached · 0 B', 'det')], w: [], msg: { p: 0, l: 'ownership' }, cap: '<code>worker.postMessage(buf, [buf])</code>: listing it in the <b>transfer list</b> hands the memory over. No copy. On the main side <code>buf.byteLength</code> is now 0: it is <b>detached</b>.' },
      { main: [B('detached · 0 B', 'det')], w: [], msg: { p: 0.5, l: 'ownership' }, cap: 'Only a handle moves, so the cost doesn’t depend on the size.' },
      { main: [B('detached · 0 B', 'det')], w: [B('ArrayBuffer 8 MB')], cap: 'The Worker owns the same bytes. Exactly one side can use them at a time. Works for <code>ArrayBuffer</code>, <code>MessagePort</code> and a few other types, not for plain objects.' },
      { main: [B('detached · 0 B', 'det')], w: [B('ArrayBuffer 8 MB')], wBusy: 'resizing…', cap: 'The Worker processes the pixels in place.' },
      { main: [B('ArrayBuffer 2 MB')], w: [B('detached · 0 B', 'det')], msg: { p: 0, l: 'ownership', back: true }, cap: 'It transfers the (smaller) output buffer back. Ping-pong ownership is the zero-copy pattern for binary data.' }
    ] },
    shared: { label: 'SharedArrayBuffer', frames: [
      { main: [], w: [], sab: 0, refs: ['main'], cap: '<code>const sab = new SharedArrayBuffer(4)</code>: memory outside either heap. The main thread views it as <code>new Int32Array(sab)</code>.' },
      { main: [], w: [], sab: 0, refs: ['main', 'w'], cap: '<code>new Worker(file, { workerData: sab })</code>: a SharedArrayBuffer is <b>not copied</b>. Both threads now see the same 4 bytes.' },
      { main: [], w: [], sab: 1, refs: ['main', 'w'], wBusy: 'Atomics.add', cap: 'The Worker does <code>Atomics.add(c, 0, 1)</code>. The main thread can read 1 immediately; no message was sent.' },
      { main: [], w: [], sab: 2, refs: ['main', 'w'], mainBusy: 'reads 2', wBusy: 'reads 2', warn: 'c[0]++ on both threads', cap: 'Now both threads run <code>c[0]++</code> at the same moment. That is <b>read, add, write</b>: both read 2…' },
      { main: [], w: [], sab: 3, refs: ['main', 'w'], err: 'lost update: 3, not 4', cap: '…and both write 3. One increment is lost. With shared memory you get Java-style data races.' },
      { main: [], w: [], sab: 5, refs: ['main', 'w'], mainBusy: 'Atomics.add', wBusy: 'Atomics.add', cap: 'With <code>Atomics.add</code> on both sides each read-modify-write is indivisible: 3 → 5, nothing lost. <code>Atomics.wait</code>/<code>notify</code> let a thread sleep until a value changes.' }
    ] },
    cluster: { label: 'cluster', cluster: true }
  };
  // cluster frames
  (function () {
    const F = []; const cnt = [0, 0, 0]; let alive = [true, true, true]; let names = ['worker 1', 'worker 2', 'worker 3']; let rr = 0; let c = 0;
    const snap = (cap, to, extra) => F.push(Object.assign({ cnt: cnt.slice(), alive: alive.slice(), names: names.slice(), to, cap }, extra || {}));
    snap('<code>cluster.isPrimary</code>: the primary process calls <code>cluster.fork()</code> three times. Each worker is a full Node process running the same script, with its own memory and event loop.', -1);
    snap('Each worker calls <code>server.listen(3000)</code>. The listening socket really belongs to the <b>primary</b>, which accepts connections (SCHED_RR, the default except on Windows).', -1);
    const deal = (n) => { for (let i = 0; i < n; i++) { while (!alive[rr % 3]) rr++; const w = rr % 3; rr++; c++; cnt[w]++; snap(`Connection ${c} → <b>${names[w]}</b>. The primary deals connections round-robin over IPC.`, w); } };
    deal(4);
    alive[1] = false; snap('<b>worker 2 crashes</b> (an uncaught exception). Only its in-flight requests fail; the other processes don’t notice. The primary gets an <code>\'exit\'</code> event.', 1, { crash: 1 });
    deal(2);
    alive[1] = true; names[1] = 'worker 4'; cnt[1] = 0; snap('<code>cluster.on(\'exit\', () => cluster.fork())</code> replaces it with worker 4, a fresh process with an empty heap.', 1, { fork: 1 });
    deal(3);
    snap('Every worker has its <b>own</b> memory: an in-memory session store or rate limiter now has three different views. Shared state belongs in Redis or the database.', -1, { note: true });
    MODES.cluster.frames = F;
  })();

  let mode = 'clone'; let k = 0; let gen = 0; let playing = false; let speed = 2200;
  const seg = (opts, cur, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); set(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 600 290', role: 'img', 'aria-label': 'Threads or processes and the data passed between them' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-wtc');
  root.append(el('div', { class: 'w-controls' }, seg(Object.entries(MODES).map(([v, m]) => [v, m.label]), mode, (v) => { mode = v; reset(); }, 'Mode')),
    el('div', { class: 'w-stage' }, stage), narr,
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg([[3400, 'Slow'], [2200, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed')), stats);

  function thread(x, title, busy, blocks) {
    const g = svg('g');
    g.append(svg('rect', { class: 'th' + (busy ? ' busy' : ''), x, y: 30, width: 200, height: 220, rx: 12 }));
    g.append(svg('text', { class: 't1', x: x + 100, y: 54, 'text-anchor': 'middle', text: title }));
    g.append(svg('text', { class: busy ? 'tb' : 't2', x: x + 100, y: 74, 'text-anchor': 'middle', text: busy || 'event loop idle' }));
    g.append(svg('rect', { class: 'heap', x: x + 14, y: 88, width: 172, height: 148, rx: 8 }));
    g.append(svg('text', { class: 't2', x: x + 22, y: 104, text: 'own V8 heap' }));
    blocks.forEach((b, i) => {
      const small = b.cls === 'small';
      g.append(svg('rect', { class: 'blk ' + b.cls, x: x + 24, y: 114 + i * 62, width: small ? 70 : 152, height: small ? 30 : 52, rx: 6 }));
      g.append(svg('text', { class: 't1', x: x + (small ? 59 : 100), y: 114 + i * 62 + (small ? 20 : 31), 'text-anchor': 'middle', 'font-size': 12, fill: b.cls === 'det' ? 'var(--text-3)' : '#fff', text: b.label }));
    });
    return g;
  }
  function renderThreads(f) {
    stage.append(thread(10, 'main thread', f.mainBusy, f.main), thread(390, 'Worker', f.wBusy, f.w));
    if (f.sab != null) {
      stage.append(svg('rect', { class: 'sab', x: 232, y: 178, width: 136, height: 72, rx: 10 }));
      stage.append(svg('text', { class: 't2', x: 300, y: 196, 'text-anchor': 'middle', text: 'SharedArrayBuffer' }));
      stage.append(svg('text', { class: 'big', x: 300, y: 232, 'text-anchor': 'middle', text: 'c[0] = ' + f.sab }));
      if (f.refs.includes('main')) stage.append(svg('path', { class: 'ref', d: 'M210,214 L232,214' }));
      if (f.refs.includes('w')) stage.append(svg('path', { class: 'ref', d: 'M390,214 L368,214' }));
      if (f.warn) stage.append(svg('text', { class: 'tw', x: 300, y: 160, 'text-anchor': 'middle', text: f.warn }));
      if (f.err) stage.append(svg('text', { class: 'te', x: 300, y: 160, 'text-anchor': 'middle', text: f.err }));
    } else {
      stage.append(svg('line', { class: 'pipe', x1: 214, x2: 386, y1: 140, y2: 140 }));
      stage.append(svg('text', { class: 't2', x: 300, y: 128, 'text-anchor': 'middle', text: 'MessagePort' }));
      if (f.msg) {
        const p = f.msg.back ? 1 - f.msg.p : f.msg.p; const x = 220 + p * 160;
        const m = svg('g', { style: `transform: translate(${x}px, 140px); transition: ${reduced ? 'none' : 'transform .6s'}` },
          svg('rect', { class: 'msg', x: -26, y: -13, width: 52, height: 26, rx: 13 }), svg('text', { x: 0, y: 4, 'text-anchor': 'middle', fill: '#fff', 'font-size': 10.5, 'font-weight': 700, text: f.msg.l }));
        stage.append(m);
      }
    }
  }
  function renderCluster(f) {
    stage.append(svg('defs', null, svg('marker', { id: 'w-wtc-ah', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--accent)' }))));
    stage.append(svg('text', { class: 't2', x: 300, y: 16, 'text-anchor': 'middle', text: 'clients → :3000' }));
    stage.append(svg('rect', { class: 'th' + (f.to >= 0 ? ' busy' : ''), x: 200, y: 26, width: 200, height: 70, rx: 12 }));
    stage.append(svg('text', { class: 't1', x: 300, y: 52, 'text-anchor': 'middle', text: 'primary process' }));
    stage.append(svg('text', { class: 't2', x: 300, y: 72, 'text-anchor': 'middle', text: 'owns the listening socket' }));
    stage.append(svg('text', { class: 't2', x: 300, y: 88, 'text-anchor': 'middle', text: 'forks, deals, restarts' }));
    [0, 1, 2].forEach((i) => {
      const x = 14 + i * 196; const cx = x + 90;
      stage.append(svg('path', { class: f.to === i && f.alive[i] && !f.crash ? 'conn' : 'ref', style: f.to === i ? '' : 'opacity:.35', d: `M300,96 L${cx},170` }));
      stage.append(svg('rect', { class: 'th' + (!f.alive[i] ? ' dead' : f.to === i ? ' busy' : ''), x, y: 172, width: 180, height: 96, rx: 12 }));
      stage.append(svg('text', { class: 't1', x: cx, y: 196, 'text-anchor': 'middle', text: f.names[i] + (f.fork === i ? ' (new)' : '') }));
      stage.append(svg('text', { class: f.alive[i] ? 't2' : 'te', x: cx, y: 216, 'text-anchor': 'middle', text: f.alive[i] ? 'own heap + event loop' : '✗ exited (code 1)' }));
      stage.append(svg('text', { class: 't2', x: cx, y: 236, 'text-anchor': 'middle', text: `connections: ${f.cnt[i]}` }));
      if (f.note) stage.append(svg('text', { class: 'tw', x: cx, y: 258, 'text-anchor': 'middle', text: `sessions map #${i + 1}` }));
    });
  }
  function render() {
    const fr = MODES[mode].frames; const f = fr[Math.max(0, k - 1)];
    stage.innerHTML = '';
    if (MODES[mode].cluster) renderCluster(f); else renderThreads(f);
    narr.firstChild.innerHTML = k === 0 ? 'Press Play or Step.' : f.cap;
    stats.innerHTML = '';
    const st = MODES[mode].cluster ? [['processes', 1 + f.alive.filter(Boolean).length], ['connections', f.cnt.reduce((a, b) => a + b, 0)]]
      : [['main heap', f.main.filter((b) => b.cls !== 'det').map((b) => b.label.split(' ').slice(-2).join(' ')).join(' + ') || '—'], ['worker heap', f.w.filter((b) => b.cls !== 'det').map((b) => b.label.split(' ').slice(-2).join(' ')).join(' + ') || '—']];
    st.concat([['step', `${k}/${fr.length}`]]).forEach(([a, b]) => stats.append(el('span', { class: 'w-stat', html: `${a} <b>${b}</b>` })));
  }
  function reset() { gen++; playing = false; bPlay.textContent = '▶ Play'; k = 1; bStep.disabled = false; render(); }
  function step() { const n = MODES[mode].frames.length; if (k >= n) { bStep.disabled = true; return false; } k++; render(); if (k >= n) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { playing = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (playing) { playing = false; bPlay.textContent = '▶ Play'; return; }
    const n = MODES[mode].frames.length;
    if (reduced) { k = n; render(); bStep.disabled = true; return; }
    if (k >= n) reset();
    playing = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (playing && g === gen && step()) await sleep(speed);
    if (g === gen) { playing = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

/* Threads vs processes: one submit(fn, big_df) through ThreadPoolExecutor (shared heap, references,
   one GIL) and through ProcessPoolExecutor (pickle → pipe → unpickle into a copy, one GIL per process). */
IA.widget('threading-multiprocessing', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-pytp-style')) {
    document.head.append(el('style', { id: 'w-pytp-style', text: `
.w-pytp .proc{fill:none;stroke:var(--border);stroke-width:2;stroke-dasharray:0}
.w-pytp .proc.hot{stroke:var(--accent)}
.w-pytp .heap{fill:var(--surface-2);stroke:var(--border)}
.w-pytp .chip{fill:var(--surface);stroke:var(--border);stroke-width:1.5;transition:all .3s}
.w-pytp .chip.hot{stroke:var(--accent);stroke-width:3;fill:var(--accent-soft)}
.w-pytp .chip.warn{stroke:var(--warn);stroke-width:3;fill:color-mix(in srgb,var(--warn) 14%,var(--surface))}
.w-pytp .chip.ok{stroke:var(--ok);stroke-width:3;fill:color-mix(in srgb,var(--ok) 14%,var(--surface))}
.w-pytp .chip.ghost{stroke-dasharray:4 3;opacity:.55}
.w-pytp .pkt{fill:var(--warn)}
.w-pytp .ref{fill:none;stroke:var(--accent);stroke-width:2;stroke-dasharray:5 4}
.w-pytp .pipe{fill:none;stroke:var(--text-3);stroke-width:2}
.w-pytp .pipe.hot{stroke:var(--warn);stroke-width:3}
.w-pytp .gil{fill:var(--warn)}
` }));
  }
  const MODES = {
    thread: { label: 'ThreadPoolExecutor', steps: [
      { q: ['fn, ref→big_df'], cap: '<code>ex.submit(fn, big_df)</code> wraps the call in a work item and a <code>Future</code>, and puts it on the pool’s internal queue. Nothing is copied: the item holds <b>references</b> to the function and to the 300 MB DataFrame.', hot: ['queue', 'main'], fut: 'pending' },
      { q: [], take: 0, cap: 'Idle worker threads are blocked on <code>queue.get()</code>. T1 wakes up with the item.', hot: ['t0'], fut: 'pending' },
      { take: 0, ref: ['big_df'], run: 0, cap: 'T1 runs <code>fn(big_df)</code>. It reads the DataFrame straight from the <b>shared heap</b>: zero-copy, zero serialisation. This is why threads are cheap for I/O work around big in-memory objects.', hot: ['t0', 'big_df'], fut: 'pending' },
      { take: 0, ref: ['cache'], run: 0, cacheHit: 'shared', cap: 'T1 does <code>cache[key] = value</code>. Every thread, including the main one, sees it <b>immediately</b>. That is convenient, and it is also a race if two threads do check-then-set: guard it with a <code>Lock</code>.', hot: ['t0', 'cache'], fut: 'pending' },
      { take: 0, fut: 'done', cap: 'The worker sets the result on the Future, and <code>f.result()</code> in the main thread returns the <b>same object</b> the worker built. Exceptions travel the same way, re-raised at <code>.result()</code>.', hot: ['fut', 'main'] },
      { all: true, fut: 'done', cap: 'With three tasks, the threads overlap perfectly while they wait on I/O. But there is <b>one GIL</b> (orange): for pure-Python CPU work they take turns on a single core. The default <code>max_workers</code> is <code>min(32, cpus + 4)</code>.', hot: ['t0', 't1', 't2'] }
    ] },
    process: { label: 'ProcessPoolExecutor', steps: [
      { pkt: 'call', bytes: 300e6, cap: '<code>ex.submit(fn, big_df)</code>: the arguments must cross into another process, so they are <b>pickled</b>. <code>fn</code> becomes just a name (<code>b"jobs.score"</code>); the DataFrame becomes ~300 MB of bytes on the call queue.', hot: ['main', 'queue'], fut: 'pending' },
      { pkt: 'pipe0', bytes: 300e6, cap: 'A feeder thread writes the bytes into a <b>pipe</b> to a worker process. For a large object this copy alone can cost more than the work itself.', hot: ['pipe0'], fut: 'pending' },
      { copy: true, bytes: 300e6, cap: 'Worker 1 unpickles: it <b>imports <code>jobs.score</code> by name</b> (lambdas can’t be found this way) and rebuilds <b>its own copy</b> of the DataFrame. The data now exists twice in RAM.', hot: ['w0', 'w0df'], fut: 'pending' },
      { copy: true, wcache: true, bytes: 300e6, cap: 'The worker sets <code>cache[key] = value</code>, but that is <b>its</b> cache. The parent’s cache is unchanged, and so are the other workers’. Processes share nothing unless you use queues, pipes, <code>shared_memory</code> or a Manager.', hot: ['w0cache', 'cache'], fut: 'pending' },
      { copy: true, wcache: true, pkt: 'back', bytes: 300e6 + 2e3, fut: 'done', cap: 'The return value is pickled too, sent back on the result queue and unpickled in the parent, where a management thread resolves the Future. You get an <b>equal</b> object, not the same one.', hot: ['fut', 'pipe0'] },
      { copy: true, wcache: true, all: true, bytes: 3 * 300e6 + 6e3, fut: 'done', cap: 'Each worker is a separate interpreter with <b>its own GIL</b>, so CPU-bound tasks really run in parallel. The price: pickling per task, a copy per worker, and process start-up (with <i>spawn</i>, each worker re-imports your <code>__main__</code>). Fix: send ids or paths, or load once per worker with <code>initializer=</code>.', hot: ['w0', 'w1', 'w2'] }
    ] }
  };
  let mode = 'thread', k = 0, gen = 0, running = false;
  const segM = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Executor' });
  Object.entries(MODES).forEach(([v, M]) => { const b = el('button', { text: M.label, class: v === mode ? 'on' : '' }); b.addEventListener('click', () => { mode = v; [...segM.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); segM.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 640 324', role: 'img', 'aria-label': 'Process and thread layout with heap objects, queues and pipes' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-pytp');
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr, stats);

  const T = (x, y, text, o) => svg('text', Object.assign({ x, y, 'font-size': 12, fill: 'var(--text)', text }, o || {}));
  const chip = (id, x, y, w, h, label, sub, cur, extra) => {
    const cls = 'chip' + ((cur && (cur.hot || []).includes(id)) ? ' hot' : '') + (extra ? ' ' + extra : '');
    return [svg('rect', { class: cls, x, y, width: w, height: h, rx: 7 }), T(x + 8, y + (sub ? 16 : h / 2 + 4), label, { class: 'mono', 'font-size': 12, 'font-weight': 700, 'font-family': 'var(--mono)' }), sub ? T(x + 8, y + 31, sub, { 'font-size': 10.5, fill: 'var(--text-3)' }) : null].filter(Boolean);
  };
  function drawThread(cur) {
    stage.append(svg('rect', { class: 'proc hot', x: 6, y: 6, width: 628, height: 312, rx: 12 }), T(18, 26, 'one process · one interpreter · one GIL (default build)', { 'font-weight': 700, 'font-size': 13 }));
    stage.append(svg('rect', { class: 'heap', x: 20, y: 40, width: 250, height: 160, rx: 10 }), T(32, 58, 'shared heap', { 'font-size': 11, fill: 'var(--text-3)' }));
    stage.append(...chip('big_df', 32, 68, 226, 38, 'big_df', 'DataFrame · 300 MB · one copy', cur));
    stage.append(...chip('cache', 32, 114, 226, 38, 'cache', cur && cur.cacheHit ? '{key: value}  ← visible to all threads' : '{ }', cur, cur && cur.cacheHit ? 'warn' : ''));
    stage.append(...chip('fn', 32, 160, 226, 30, 'fn  (function object)', null, cur));
    stage.append(...chip('main', 290, 40, 150, 38, 'main thread', 'submit() → Future', cur));
    stage.append(...chip('fut', 454, 40, 166, 38, 'Future', cur ? (cur.fut === 'done' ? 'result ready ✓' : 'pending…') : '—', cur, cur && cur.fut === 'done' ? 'ok' : ''));
    stage.append(svg('rect', { class: 'chip' + (cur && (cur.hot || []).includes('queue') ? ' hot' : ''), x: 290, y: 96, width: 330, height: 40, rx: 7 }), T(300, 112, 'work queue (queue.SimpleQueue)', { 'font-size': 11, fill: 'var(--text-3)' }));
    (cur && cur.q ? cur.q : []).forEach((it, i) => stage.append(svg('rect', { class: 'chip warn', x: 300 + i * 150, y: 116, width: 140, height: 16, rx: 4 }), T(306 + i * 150, 128, it, { 'font-size': 10.5, class: 'mono', 'font-family': 'var(--mono)' })));
    [0, 1, 2].forEach((i) => {
      const x = 290 + i * 112; const id = 't' + i;
      const busy = cur && (cur.all || cur.take === i);
      stage.append(...chip(id, x, 236, 104, 44, `T${i + 1}`, busy ? (cur.run === i || cur.all ? 'running fn' : 'got item') : 'waiting on get()', cur));
    });
    if (cur && cur.ref) cur.ref.forEach((r) => { const y = r === 'big_df' ? 87 : 133; stage.append(svg('path', { class: 'ref', d: `M290 258 C 270 258, 300 ${y}, 258 ${y}` })); });
    if (cur && (cur.run != null || cur.all)) { const i = cur.all ? 0 : cur.run; stage.append(svg('circle', { class: 'gil', cx: 290 + i * 112 + 92, cy: 236, r: 11 }), T(290 + i * 112 + 92, 240, 'GIL', { 'text-anchor': 'middle', 'font-size': 8, 'font-weight': 700, fill: '#fff' })); }
    if (cur && cur.all) stage.append(T(290, 298, 'one GIL: CPU work takes turns · I/O waits overlap', { 'font-size': 11.5, fill: 'var(--warn)', 'font-weight': 700 }));
  }
  function drawProcess(cur) {
    stage.append(svg('rect', { class: 'proc hot', x: 6, y: 6, width: 628, height: 150, rx: 12 }), T(18, 26, 'parent process · GIL #0', { 'font-weight': 700, 'font-size': 13 }));
    stage.append(svg('rect', { class: 'heap', x: 18, y: 36, width: 252, height: 112, rx: 10 }));
    stage.append(...chip('big_df', 28, 44, 232, 38, 'big_df', 'DataFrame · 300 MB', cur));
    stage.append(...chip('cache', 28, 92, 232, 38, 'cache', cur && cur.wcache ? '{ }  ← unchanged' : '{ }', cur));
    stage.append(...chip('main', 288, 36, 150, 38, 'main thread', 'submit() → Future', cur));
    stage.append(...chip('fut', 450, 36, 172, 38, 'Future', cur ? (cur.fut === 'done' ? 'result unpickled ✓' : 'pending…') : '—', cur, cur && cur.fut === 'done' ? 'ok' : ''));
    stage.append(svg('rect', { class: 'chip' + (cur && (cur.hot || []).includes('queue') ? ' hot' : ''), x: 288, y: 86, width: 334, height: 60, rx: 7 }), T(298, 102, 'call queue → pipe → worker · result queue ← pipe', { 'font-size': 11, fill: 'var(--text-3)' }));
    if (cur && cur.pkt === 'call') stage.append(svg('rect', { class: 'chip warn', x: 298, y: 110, width: 314, height: 28, rx: 5 }), T(306, 128, 'pickle: b"jobs.score" + 300 MB of bytes', { 'font-size': 11, 'font-family': 'var(--mono)' }));
    [0, 1, 2].forEach((i) => {
      const x = 6 + i * 212; const active = cur && (cur.all || (i === 0 && (cur.copy || cur.pkt === 'pipe0')));
      const pHot = cur && ((cur.pkt === 'pipe0' || cur.pkt === 'back') && i === 0 || (cur.all));
      stage.append(svg('path', { class: 'pipe' + (pHot ? ' hot' : ''), d: `M455 146 C 455 170, ${x + 102} 168, ${x + 102} 190` }));
      stage.append(svg('rect', { class: 'proc' + (active ? ' hot' : ''), x, y: 190, width: 204, height: 128, rx: 12 }), T(x + 12, 208, `worker ${i + 1} · GIL #${i + 1}`, { 'font-weight': 700, 'font-size': 12 }));
      const hasCopy = cur && (cur.all || (i === 0 && cur.copy));
      stage.append(...chip('w' + i + 'df', x + 10, 218, 184, 38, hasCopy ? 'big_df (copy)' : 'no data yet', hasCopy ? 'unpickled · another 300 MB' : '', cur, hasCopy ? '' : 'ghost'));
      const wc = cur && cur.wcache && (i === 0 || cur.all);
      stage.append(...chip('w' + i + 'cache', x + 10, 264, 184, 38, 'cache', wc ? '{key: value}  (its own)' : '{ }', cur, wc ? 'warn' : 'ghost'));
      if (cur && (cur.pkt === 'pipe0' || cur.pkt === 'back') && i === 0) {
        const t = cur.pkt === 'pipe0' ? 0.7 : 0.3;
        const px = 455 + (x + 102 - 455) * t, py = 146 + 44 * t;
        stage.append(svg('rect', { class: 'pkt', x: px - 16, y: py - 8, width: 32, height: 16, rx: 4 }), T(px, py + 4, cur.pkt === 'back' ? 'result' : 'bytes', { 'text-anchor': 'middle', 'font-size': 9, 'font-weight': 700, fill: '#fff' }));
      }
      if (cur && cur.all) stage.append(svg('circle', { class: 'gil', cx: x + 186, cy: 204, r: 10 }), T(x + 186, 208, 'GIL', { 'text-anchor': 'middle', 'font-size': 7.5, 'font-weight': 700, fill: '#fff' }));
    });
  }
  function render() {
    const M = MODES[mode]; const cur = k ? M.steps[k - 1] : null;
    stage.innerHTML = '';
    if (mode === 'thread') drawThread(cur); else drawProcess(cur);
    const copies = mode === 'thread' ? 1 : cur ? (cur.all ? 4 : cur.copy ? 2 : 1) : 1;
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `bytes pickled <b>${mode === 'thread' ? '0' : IA.fmt.bytes(cur ? cur.bytes : 0)}</b>` }),
      el('span', { class: 'w-stat', html: `copies of big_df in RAM <b>${copies}</b>` }),
      el('span', { class: 'w-stat', html: `GILs <b>${mode === 'thread' ? 1 : 4}</b>` }),
      el('span', { class: 'w-stat', html: `CPU-parallel Python <b>${mode === 'thread' ? 'no' : 'yes'}</b>` }));
    narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: `${k}/${M.steps.length}` }), el('div', { class: 't', html: cur ? cur.cap : 'Press <b>Play</b> or <b>Step</b> to follow one <code>submit(fn, big_df)</code> call.' }));
    bStep.disabled = k >= M.steps.length;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = 0; render(); }
  function step() { const n = MODES[mode].steps.length; if (k >= n) return false; k++; render(); return k < n; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    const n = MODES[mode].steps.length;
    if (k >= n) { k = 0; render(); }
    if (reduced) { k = n; render(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(3000); }
    if (g === gen) stop();
  });
  reset();
});

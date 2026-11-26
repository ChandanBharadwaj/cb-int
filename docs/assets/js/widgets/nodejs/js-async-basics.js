/* Async basics: call stack, Node APIs, microtask and task queues for setTimeout, promises, await and callbacks. */
IA.widget('js-async-basics', (root, ctx) => {
  /* ---- shared step-through player (code on the left, state picture on the right) ---- */
  const { el, svg, sleep, reduced } = ctx;
  function stepper(cfg) {
    const uid = 'nb' + Math.random().toString(36).slice(2, 8);
    if (!document.getElementById('w-nb-style')) {
      document.head.append(el('style', { id: 'w-nb-style', text: `
.w-nb-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; align-items: start; }
.w-nb-code pre { margin: 0; }
.w-nb-code .ln { display: block; padding: 0 6px; border-left: 3px solid transparent; border-radius: 3px; white-space: pre; }
.w-nb-code .ln.cur { background: var(--accent-soft); border-left-color: var(--accent); }
.w-nb-code .ln.done { opacity: .55; }
.w-nb .bx { fill: var(--surface); stroke: var(--border); }
.w-nb .bx.hot { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2; }
.w-nb .bx.ok { stroke: var(--ok); stroke-width: 2; }
.w-nb .bx.err { stroke: var(--err); stroke-width: 2; fill: color-mix(in srgb, var(--err) 10%, var(--surface)); }
.w-nb .bx.warn { stroke: var(--warn); stroke-width: 2; }
.w-nb .bx.dim { opacity: .45; }
.w-nb .bx.lane { fill: var(--surface-2); }
.w-nb .tt { fill: var(--text); font-size: 13px; font-family: var(--mono); }
.w-nb .tt.h { font-family: var(--sans); font-weight: 700; font-size: 13px; }
.w-nb .tt.m { fill: var(--text-3); font-size: 11px; font-family: var(--sans); }
.w-nb .tt.ok { fill: var(--ok); } .w-nb .tt.err { fill: var(--err); } .w-nb .tt.acc { fill: var(--accent); } .w-nb .tt.warn { fill: var(--warn); }
.w-nb .ar { stroke: var(--text-3); stroke-width: 1.6; fill: none; }
.w-nb .ar.hot { stroke: var(--accent); stroke-width: 2.2; }
.w-nb .fresh { animation: nbIn .45s ease both; }
@keyframes nbIn { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .w-nb .fresh { animation: none; } }
` }));
    }
    root.classList.add('w-nb');
    const modes = cfg.modes;
    let mi = 0; let k = 0; let gen = 0; let running = false; let speed = 2600;
    const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': cfg.modeLabel || 'Example' });
    modes.forEach((m, i) => { const b = el('button', { text: m.label, class: i === 0 ? 'on' : '' }); b.addEventListener('click', () => { mi = i; [...seg.children].forEach((x, j) => x.classList.toggle('on', j === i)); reset(); }); seg.append(b); });
    const pre = el('pre'); const codeHost = el('div', { class: 'codebox w-nb-code' }, el('div', { class: 'ch' }, el('span', { class: 'fname' })), pre);
    const W = cfg.W || 420, H = cfg.H || 300;
    const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': cfg.aria || 'Step-by-step picture of the program state' });
    const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('span', { class: 'n', text: '0' }), el('div', { class: 't', text: 'Press Play, or Step to go one line at a time.' }));
    const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
    const bStep = el('button', { class: 'btn', text: 'Step ›' });
    const bReset = el('button', { class: 'btn', text: '↺ Reset' });
    const segS = el('div', { class: 'seg', 'aria-label': 'Speed' });
    [['Slow', 3800], ['Normal', 2600], ['Fast', 1300]].forEach(([l, v]) => { const b = el('button', { text: l, class: v === speed ? 'on' : '' }); b.addEventListener('click', () => { speed = v; [...segS.children].forEach((x) => x.classList.toggle('on', x === b)); }); segS.append(b); });
    root.append(modes.length > 1 ? el('div', { class: 'w-controls' }, seg) : '',
      el('div', { class: 'w-nb-grid' }, codeHost, el('div', { class: 'w-stage' }, stage)),
      el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr);
    // drawing helpers handed to cfg.draw
    const defs = svg('defs', null, svg('marker', { id: uid + 'a', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--text-3)' })),
      svg('marker', { id: uid + 'h', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--accent)' })));
    const D = {
      box: (x, y, w, h, cls, fresh) => svg('rect', { x, y, width: w, height: h, rx: 7, class: 'bx ' + (cls || '') + (fresh ? ' fresh' : '') }),
      t: (x, y, s, cls, anchor, fresh) => svg('text', { x, y, class: 'tt ' + (cls || '') + (fresh ? ' fresh' : ''), 'text-anchor': anchor || 'start', text: String(s) }),
      ar: (x1, y1, x2, y2, hot, curve) => svg('path', { d: curve ? `M${x1},${y1} C${x1 + curve},${y1} ${x2 + curve},${y2} ${x2},${y2}` : `M${x1},${y1} L${x2},${y2}`, class: 'ar' + (hot ? ' hot' : ''), 'marker-end': `url(#${uid}${hot ? 'h' : 'a'})` }),
      W, H
    };
    let lineEls = [];
    function renderCode() {
      const m = modes[mi]; pre.innerHTML = '';
      codeHost.querySelector('.fname').textContent = m.file || 'example.js';
      lineEls = m.code.split('\n').map((ln) => { const s = el('span', { class: 'ln' }); s.innerHTML = IA.highlight(ln || ' ', m.lang || 'js'); pre.append(s); return s; });
    }
    function show(i) {
      const m = modes[mi]; const st = m.steps[i];
      lineEls.forEach((l, j) => { const cur = st && [].concat(st.line == null ? [] : st.line).includes(j + 1); l.classList.toggle('cur', cur); });
      stage.innerHTML = ''; stage.append(defs);
      const g = svg('g'); stage.append(g);
      cfg.draw(g, st || null, D, i, m);
      narr.className = 'caption' + (st && st.tone ? ' ' + st.tone : '');
      narr.firstChild.textContent = st ? `${i + 1}/${m.steps.length}` : '0';
      narr.lastChild.innerHTML = st ? st.cap : (m.intro || 'Press Play, or Step to go one line at a time.');
    }
    function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; renderCode(); if (reduced) { k = modes[mi].steps.length; show(k - 1); } else show(-1); }
    function step() { const n = modes[mi].steps.length; if (k >= n) return false; show(k); k++; return k < n; }
    async function play() {
      if (running) { gen++; running = false; bPlay.textContent = '▶ Play'; return; }
      if (k >= modes[mi].steps.length) reset();
      if (reduced) { k = modes[mi].steps.length; show(k - 1); return; }
      const g = ++gen; running = true; bPlay.textContent = '❚❚ Pause';
      while (g === gen && step()) { await sleep(speed); }
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    }
    bPlay.addEventListener('click', play);
    bStep.addEventListener('click', () => { gen++; running = false; bPlay.textContent = '▶ Play'; if (k >= modes[mi].steps.length) reset(); step(); });
    bReset.addEventListener('click', reset);
    reset();
  }
  const S = (o) => Object.assign({ stack: [], apis: [], micro: [], macro: [], out: [] }, o);
  const sA = [
    { line: 1, cap: 'The script itself runs on the <b>call stack</b>. <code>console.log(\'A\')</code> prints immediately.', ...S({ stack: ['script', "log('A')"], out: ['A'] }) },
    { line: 2, cap: '<code>setTimeout</code> doesn’t wait. It hands the callback and a timer to Node (libuv) and returns at once.', ...S({ stack: ['script', 'setTimeout(cb, 0)'], apis: ['timer 0 ms → cb'], out: ['A'] }) },
    { line: 3, cap: 'The script keeps going: <code>C</code> prints <b>before</b> B, even with a 0 ms delay.', ...S({ stack: ['script', "log('C')"], apis: ['timer 0 ms → cb'], out: ['A', 'C'] }) },
    { line: 2, cap: 'The timer expires, so its callback moves to the <b>task queue</b>. It still can’t run: the stack isn’t empty until the script finishes.', ...S({ stack: ['script'], macro: ['cb (timer)'], out: ['A', 'C'] }) },
    { line: 2, cap: 'The script ends and the stack is empty. The <b>event loop</b> takes the next task from the queue and runs it: <code>B</code>.', tone: 'ok', loop: true, ...S({ stack: ['cb', "log('B')"], out: ['A', 'C', 'B'] }) },
    { cap: 'Nothing left on the stack, in the queues or pending in Node, so the process exits. That’s why a server stays alive: an open listening socket counts as pending work.', tone: 'ok', ...S({ out: ['A', 'C', 'B'] }) }
  ];
  const sB = [
    { line: 1, cap: 'Synchronous code first: prints <code>1</code>.', ...S({ stack: ['script', "log('1')"], out: ['1'] }) },
    { line: 2, cap: 'A timer is registered with Node. Its callback will be a <b>task</b> (a macrotask).', ...S({ stack: ['script', 'setTimeout'], apis: ['timer 0 ms'], out: ['1'] }) },
    { line: 3, cap: 'The promise is already resolved, so its <code>.then</code> callback goes straight into the <b>microtask queue</b>.', ...S({ stack: ['script', '.then(cb)'], apis: ['timer 0 ms'], micro: ['then → promise'], out: ['1'] }) },
    { line: 4, cap: 'Prints <code>2</code>. Meanwhile the timer has expired and queued its task.', ...S({ stack: ['script', "log('2')"], micro: ['then → promise'], macro: ['timeout cb'], out: ['1', '2'] }) },
    { line: 3, cap: 'The script ends. <b>All microtasks run before the next task</b>, so <code>promise</code> prints before <code>timeout</code>.', tone: 'ok', loop: true, ...S({ stack: ['then cb'], macro: ['timeout cb'], out: ['1', '2', 'promise'] }) },
    { line: 2, cap: 'Now the event loop runs the timer task: <code>timeout</code>. Order: 1, 2, promise, timeout. Details in <a href="microtasks-macrotasks.html">Microtasks vs macrotasks</a>.', tone: 'ok', loop: true, ...S({ stack: ['timeout cb'], out: ['1', '2', 'promise', 'timeout'] }) }
  ];
  const sC = [
    { line: 6, cap: '<code>main()</code> is called. An async function runs <b>synchronously</b> until its first <code>await</code>.', ...S({ stack: ['script', 'main()'] }) },
    { line: 2, cap: 'Prints <code>start</code>.', ...S({ stack: ['script', 'main()', "log('start')"], out: ['start'] }) },
    { line: 3, cap: '<code>readFile</code> asks the OS (via libuv) to read the file and returns a pending <b>promise</b>. <code>await</code> pauses main and gives the thread back.', tone: 'warn', ...S({ stack: ['script', 'main() ⏸ await'], apis: ['read a.txt…'], out: ['start'] }) },
    { line: 7, cap: 'main has returned a promise to the caller, so the script continues. The thread is free while the disk works: this is <b>non-blocking I/O</b>.', tone: 'ok', ...S({ stack: ['script', "log('free…')"], apis: ['read a.txt…'], out: ['start', 'free to serve others'] }) },
    { line: 3, cap: 'The read finishes. Node resolves the promise, which queues the rest of <code>main</code> as a microtask.', ...S({ micro: ['resume main()'], out: ['start', 'free to serve others'] }) },
    { line: 4, cap: '<code>main</code> resumes after the await with the result, and prints. Code reads top to bottom, like blocking Java code, but no thread was held while waiting.', tone: 'ok', loop: true, ...S({ stack: ['main() resumed', 'log(…)'], out: ['start', 'free to serve others', 'got 1024'] }) }
  ];
  const sD = [
    { line: [1, 2, 3, 4], cap: 'The callback style: you pass a function that Node calls when the work is done. Convention: <b>error first</b>, then the result.', ...S({ stack: ['script', 'fs.readFile(…, cb)'], apis: ['read a.txt'] }) },
    { line: 5, cap: 'A second request arrives while the first read is in flight. It is handled at once: nothing is blocked.', ...S({ stack: ['script', 'fs.readFile(…, cb2)'], apis: ['read a.txt', 'read b.txt'] }) },
    { line: 5, cap: 'b.txt happens to finish first, so its callback is queued first. Completion order, not call order.', ...S({ apis: ['read a.txt'], macro: ['cb2 (b.txt)'] }) },
    { line: 5, cap: 'The loop runs cb2.', loop: true, ...S({ stack: ['cb2'], apis: ['read a.txt'], out: ['b done'] }) },
    { line: [2, 3], cap: 'Then a.txt completes and cb runs. One thread served both requests by never waiting. Nesting such callbacks gets messy fast (“callback hell”), which is why promises and async/await exist.', tone: 'ok', loop: true, ...S({ stack: ['cb'], out: ['b done', 'a done'] }) }
  ];
  stepper({
    W: 420, H: 300, aria: 'Call stack, Node APIs, microtask queue, task queue and console output',
    modes: [
      { label: 'setTimeout 0', code: "console.log('A');\nsetTimeout(() => console.log('B'), 0);\nconsole.log('C');", steps: sA },
      { label: 'promise vs timer', code: "console.log('1');\nsetTimeout(() => console.log('timeout'), 0);\nPromise.resolve().then(() => console.log('promise'));\nconsole.log('2');", steps: sB },
      { label: 'async / await', code: "async function main() {\n  console.log('start');\n  const data = await readFile('a.txt');\n  console.log('got', data.length);\n}\nmain();\nconsole.log('free to serve others');", steps: sC },
      { label: 'callbacks', code: "fs.readFile('a.txt', (err, data) => {\n  if (err) return console.error(err);\n  console.log('a done');\n});\nfs.readFile('b.txt', (err, d) => console.log('b done'));", steps: sD }
    ],
    draw(g, st, D) {
      const lane = (x, y, w, h, title) => g.append(D.box(x, y, w, h, 'lane'), D.t(x + 8, y + 17, title, 'h'));
      lane(6, 6, 130, 200, 'call stack'); lane(146, 6, 130, 96, 'Node / libuv'); lane(286, 6, 128, 200, 'console');
      lane(146, 110, 130, 96, 'microtasks'); lane(6, 214, 408, 80, 'task queue (timers, I/O callbacks)');
      if (!st) return;
      st.stack.forEach((f, i) => { const y = 176 - i * 34; g.append(D.box(14, y, 114, 28, i === st.stack.length - 1 ? 'hot' : '', i === st.stack.length - 1), D.t(71, y + 18, f.length > 15 ? f.slice(0, 14) + '…' : f, '', 'middle')); });
      st.apis.forEach((a, i) => g.append(D.box(154, 28 + i * 34, 114, 28, 'warn', true), D.t(211, 46 + i * 34, a.length > 15 ? a.slice(0, 14) + '…' : a, '', 'middle')));
      st.micro.forEach((a, i) => g.append(D.box(154, 132 + i * 34, 114, 28, 'ok', true), D.t(211, 150 + i * 34, a, '', 'middle')));
      st.macro.forEach((a, i) => g.append(D.box(14 + i * 130, 236, 120, 28, 'ok', true), D.t(74 + i * 130, 254, a, '', 'middle')));
      st.out.forEach((o, i) => g.append(D.t(296, 46 + i * 22, o.length > 16 ? o.slice(0, 15) + '…' : o, 'acc', 'start', i === st.out.length - 1)));
      g.append(D.t(410, 288, st.loop ? '⟳ event loop picked this up' : '', 'm', 'end'));
    }
  });
});

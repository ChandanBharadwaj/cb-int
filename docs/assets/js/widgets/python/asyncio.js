/* asyncio: the event loop's ready queue, timer heap and selector, with three tasks (main, A, B).
   Scenarios: normal concurrent I/O, a hidden blocking call that freezes the loop, and a deadline
   (asyncio.timeout) that cancels the slow task through the TaskGroup. */
IA.widget('asyncio', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-py-base')) {
    document.head.append(el('style', { id: 'w-py-base', text: `
.wpy-code{font-family:var(--mono);font-size:12.5px;line-height:1.55;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);padding:8px 0;overflow-x:auto}
.wpy-code>div{padding:0 12px;white-space:pre;border-left:3px solid transparent}
.wpy-code>div.on{background:var(--accent-soft);border-left-color:var(--accent)}
.wpy-out{font-family:var(--mono);font-size:12.5px;border:1px dashed var(--border);border-radius:10px;padding:8px 12px;min-height:2.4em;white-space:pre-wrap;color:var(--text);background:var(--surface)}
.wpy-lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin:8px 0 4px}
.wpy-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:12px;align-items:start}
@media (max-width:720px){.wpy-grid{grid-template-columns:1fr}}
` }));
  }
  if (!document.getElementById('w-pyaio-style')) {
    document.head.append(el('style', { id: 'w-pyaio-style', text: `
.w-pyaio .pn{fill:var(--surface-2);stroke:var(--border)}
.w-pyaio .pn.frozen{stroke:var(--err);stroke-width:3;fill:color-mix(in srgb,var(--err) 10%,var(--surface-2))}
.w-pyaio .pn.hot{stroke:var(--accent);stroke-width:2.5}
.w-pyaio .ch{fill:var(--surface);stroke:var(--border);stroke-width:1.5}
.w-pyaio .ch.q{stroke:var(--accent);fill:var(--accent-soft)}
.w-pyaio .ch.fd{stroke:var(--accent-2)}
.w-pyaio .ch.rd{stroke:var(--ok);stroke-width:2.5;fill:color-mix(in srgb,var(--ok) 14%,var(--surface))}
.w-pyaio .ch.tm{stroke:var(--warn);stroke-width:2}
.w-pyaio .ch.run{stroke:var(--accent);stroke-width:3;fill:var(--accent-soft)}
.w-pyaio .ch.wait{stroke-dasharray:5 3}
.w-pyaio .ch.done{stroke:var(--ok);stroke-width:2}
.w-pyaio .ch.cx{stroke:var(--err);stroke-width:2.5}
.w-pyaio .mono{font-family:var(--mono)}
` }));
  }
  const SC = {
    normal: { label: 'Concurrent I/O', code: ['async def fetch(name):', '    print(name, "send")', '    data = await sock_recv(name)   # A: 30 ms, B: 10 ms', '    print(name, "got", data)', '', 'async def main():', '    async with asyncio.TaskGroup() as tg:', '        tg.create_task(fetch("A"))', '        tg.create_task(fetch("B"))', '', 'asyncio.run(main())'], steps: [
      { t: 0, line: 10, ready: ['main · step'], tasks: { main: 'scheduled' }, cap: '<code>asyncio.run</code> creates the event loop, wraps <code>main()</code> in a <b>Task</b>, and puts its first step on the <b>ready queue</b>.' },
      { t: 0, line: 8, run: 'main', ready: ['A · step', 'B · step'], tasks: { main: 'running', A: 'scheduled', B: 'scheduled' }, cap: 'The loop pops <code>main</code>’s step and runs it. <code>create_task</code> doesn’t run anything: it appends each new task’s first step to the ready queue.' },
      { t: 0, line: 6, ready: ['A · step', 'B · step'], tasks: { main: 'awaiting TaskGroup', A: 'scheduled', B: 'scheduled' }, cap: 'At the end of the <code>async with</code> block, <code>main</code> awaits the TaskGroup’s “all done” future. It isn’t done, so the step ends and control returns to the loop.' },
      { t: 0, line: 2, run: 'A', out: ['A send'], sel: [['fd A', 'fd']], tasks: { main: 'awaiting TaskGroup', A: 'awaiting socket', B: 'scheduled' }, ready: ['B · step'], cap: 'A runs, prints, then awaits a socket read. The socket is registered with the <b>selector</b> (epoll on Linux), and A parks on a future. Step over.' },
      { t: 0, line: 2, run: 'B', out: ['A send', 'B send'], sel: [['fd A', 'fd'], ['fd B', 'fd']], tasks: { main: 'awaiting TaskGroup', A: 'awaiting socket', B: 'awaiting socket' }, ready: [], cap: 'B does the same. Both requests are now in flight <b>at the same time</b>, on one thread.' },
      { t: 0, select: 'select(timeout=None)', out: ['A send', 'B send'], sel: [['fd A', 'fd'], ['fd B', 'fd']], tasks: { main: 'awaiting TaskGroup', A: 'awaiting socket', B: 'awaiting socket' }, ready: [], cap: 'Nothing is ready and no timer is pending, so the loop calls <code>epoll_wait</code> with no timeout. The thread sleeps in the kernel using no CPU: this is where an idle async server spends its time.' },
      { t: 10, select: 'fd B readable', out: ['A send', 'B send'], sel: [['fd A', 'fd'], ['fd B', 'rd']], ready: ['B · wakeup'], tasks: { main: 'awaiting TaskGroup', A: 'awaiting socket', B: 'ready' }, cap: 'At 10 ms B’s reply arrives. The selector returns, and the loop queues the callback that completes B’s future, which in turn schedules B’s next step.' },
      { t: 10, line: 3, run: 'B', out: ['A send', 'B send', 'B got …'], sel: [['fd A', 'fd']], ready: ['TaskGroup · B done'], tasks: { main: 'awaiting TaskGroup', A: 'awaiting socket', B: 'done' }, cap: 'B resumes right after its <code>await</code>, prints and returns. Its done-callback notifies the TaskGroup: one task left.' },
      { t: 30, line: 3, run: 'A', out: ['A send', 'B send', 'B got …', 'A got …'], sel: [], ready: ['main · wakeup'], tasks: { main: 'ready', A: 'done', B: 'done' }, cap: 'At 30 ms A’s socket is readable, A finishes, and the TaskGroup’s future is resolved, which schedules <code>main</code> again.' },
      { t: 30, line: 10, run: 'main', out: ['A send', 'B send', 'B got …', 'A got …'], tasks: { main: 'done', A: 'done', B: 'done' }, ready: [], cap: '<code>main</code> leaves the TaskGroup and returns; <code>asyncio.run</code> closes the loop. Total <b>30 ms</b>, the slowest request, instead of 40 ms back-to-back.' }
    ] },
    blocking: { label: 'Blocking call', code: ['async def fetch(name):', '    print(name, "send")', '    data = await sock_recv(name)      # 30 ms', '    print(name, "got", data)', '', 'async def fetch_blocking(name):', '    print(name, "send")', '    data = requests.get(url)          # 150 ms, no await!', '    print(name, "got", data)', '', 'async def main():', '    async with asyncio.TaskGroup() as tg:', '        tg.create_task(fetch("A"))', '        tg.create_task(fetch_blocking("B"))'], steps: [
      { t: 0, line: 13, run: 'main', ready: ['A · step', 'B · step'], tasks: { main: 'running', A: 'scheduled', B: 'scheduled' }, cap: 'Same start: <code>main</code> schedules A and B, then awaits the TaskGroup.' },
      { t: 0, line: 2, run: 'A', out: ['A send'], sel: [['fd A', 'fd']], ready: ['B · step'], tasks: { main: 'awaiting TaskGroup', A: 'awaiting socket', B: 'scheduled' }, cap: 'A sends its request and parks its socket in the selector, as before.' },
      { t: 0, line: 7, run: 'B', frozen: true, out: ['A send', 'B send'], sel: [['fd A', 'fd']], ready: [], tasks: { main: 'awaiting TaskGroup', A: 'awaiting socket', B: 'running (blocked in recv)' }, cap: 'B calls <code>requests.get</code>. It is a normal blocking call with no <code>await</code>, so B’s step <b>cannot end</b>: the loop thread is stuck inside a socket read for 150 ms.' },
      { t: 30, line: 7, run: 'B', frozen: true, out: ['A send', 'B send'], sel: [['fd A', 'rd']], ready: [], tasks: { main: 'awaiting TaskGroup', A: 'awaiting socket', B: 'running (blocked in recv)' }, cap: 'At 30 ms A’s reply is sitting in the kernel buffer. Its socket is readable, but <b>nobody calls select</b>: the loop is frozen. In a server every other request, timer and health check waits too.' },
      { t: 150, line: 8, run: 'B', out: ['A send', 'B send', 'B got …', 'asyncio: Executing <Task B> took 0.150 seconds'], sel: [['fd A', 'rd']], ready: ['TaskGroup · B done'], tasks: { main: 'awaiting TaskGroup', A: 'awaiting socket', B: 'done' }, cap: 'At 150 ms B finally returns. With debug mode on, asyncio logs every step slower than 100 ms, naming the task: the quickest way to find a blocker.' },
      { t: 150, line: 3, run: 'A', out: ['A send', 'B send', 'B got …', 'asyncio: Executing <Task B> took 0.150 seconds', 'A got …   (120 ms late)'], sel: [], ready: ['main · wakeup'], tasks: { main: 'ready', A: 'done', B: 'done' }, cap: 'Only now does the loop reach <code>select</code>, which returns A’s socket immediately. A’s 30 ms request took 150 ms.' },
      { t: 150, line: 11, run: 'main', out: ['A send', 'B send', 'B got …', 'asyncio: Executing <Task B> took 0.150 seconds', 'A got …   (120 ms late)'], ready: [], tasks: { main: 'done', A: 'done', B: 'done' }, cap: 'Fix: an async client (<code>await client.get(url)</code> with httpx), or keep the sync library and run it off the loop with <code>await asyncio.to_thread(requests.get, url)</code>.' }
    ] },
    timeout: { label: 'Deadline + cancel', code: ['async def fetch(name):', '    print(name, "send")', '    data = await sock_recv(name)     # A: 30 ms, B: 10 ms', '    print(name, "got", data)', '', 'async def main():', '    async with asyncio.timeout(0.020):', '        async with asyncio.TaskGroup() as tg:', '            tg.create_task(fetch("A"))', '            tg.create_task(fetch("B"))'], steps: [
      { t: 0, line: 6, run: 'main', timers: ['t=20 ms · cancel main'], ready: ['A · step', 'B · step'], tasks: { main: 'running', A: 'scheduled', B: 'scheduled' }, cap: '<code>asyncio.timeout(0.020)</code> pushes a timer onto the loop’s <b>timer heap</b>: at 20 ms, cancel the current task (<code>main</code>). Then A and B are scheduled.' },
      { t: 0, line: 2, run: 'B', out: ['A send', 'B send'], timers: ['t=20 ms · cancel main'], sel: [['fd A', 'fd'], ['fd B', 'fd']], ready: [], tasks: { main: 'awaiting TaskGroup', A: 'awaiting socket', B: 'awaiting socket' }, cap: 'A and B send their requests and park in the selector, as before.' },
      { t: 0, select: 'select(timeout=20 ms)', out: ['A send', 'B send'], timers: ['t=20 ms · cancel main'], sel: [['fd A', 'fd'], ['fd B', 'fd']], ready: [], tasks: { main: 'awaiting TaskGroup', A: 'awaiting socket', B: 'awaiting socket' }, cap: 'This time the selector wait is bounded by the <b>earliest timer</b>: at most 20 ms.' },
      { t: 10, line: 3, run: 'B', out: ['A send', 'B send', 'B got …'], timers: ['t=20 ms · cancel main'], sel: [['fd A', 'fd']], ready: [], tasks: { main: 'awaiting TaskGroup', A: 'awaiting socket', B: 'done' }, cap: 'B’s reply arrives at 10 ms and B completes normally.' },
      { t: 20, run: 'timer', out: ['A send', 'B send', 'B got …'], timers: [], sel: [['fd A', 'fd']], ready: ['main · throw CancelledError'], tasks: { main: 'cancelling', A: 'awaiting socket', B: 'done' }, cap: 'At 20 ms the timer is due. The loop moves it to the ready queue and runs it: <code>main.cancel()</code>. Cancellation is a request: <code>CancelledError</code> will be raised inside <code>main</code> at its current <code>await</code>.' },
      { t: 20, line: 7, run: 'main', out: ['A send', 'B send', 'B got …'], sel: [['fd A', 'fd']], ready: ['A · throw CancelledError'], tasks: { main: 'awaiting TaskGroup', A: 'cancelling', B: 'done' }, cap: '<code>main</code> was waiting inside the TaskGroup’s exit, so the TaskGroup sees the error and <b>cancels its remaining children</b> (A), then keeps waiting until they finish.' },
      { t: 20, line: 2, run: 'A', out: ['A send', 'B send', 'B got …'], sel: [], ready: ['main · wakeup'], tasks: { main: 'ready', A: 'cancelled', B: 'done' }, cap: 'A’s <code>await sock_recv</code> raises <code>CancelledError</code>. Its <code>finally</code> blocks run, the socket is unregistered, and A ends cancelled. A coroutine that swallowed the error here would keep everyone waiting.' },
      { t: 20, line: 6, run: 'main', out: ['A send', 'B send', 'B got …', 'TimeoutError'], ready: [], tasks: { main: 'raised TimeoutError', A: 'cancelled', B: 'done' }, cap: 'The TaskGroup re-raises the cancellation; <code>asyncio.timeout</code> recognises it as its own and converts it into <code>TimeoutError</code> at the <code>async with</code> line. B’s result is kept; A never completed.' }
    ] }
  };
  let sc = 'normal', k = 0, gen = 0, running = false;
  const segS = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Scenario' });
  Object.entries(SC).forEach(([v, d]) => { const b = el('button', { text: d.label, class: v === sc ? 'on' : '' }); b.addEventListener('click', () => { sc = v; [...segS.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); segS.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeHost = el('div', { class: 'wpy-code' });
  const out = el('div', { class: 'wpy-out' });
  const stage = svg('svg', { viewBox: '0 0 640 330', role: 'img', 'aria-label': 'Event loop: running slot, ready queue, timer heap, selector and task states' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-pyaio');
  root.append(el('div', { class: 'w-controls' }, segS),
    el('div', { class: 'wpy-grid' },
      el('div', null, el('div', { class: 'wpy-lbl', text: 'code' }), codeHost, el('div', { class: 'wpy-lbl', text: 'stdout / logs' }), out),
      el('div', null, el('div', { class: 'wpy-lbl', text: 'event loop (one thread)' }), el('div', { class: 'w-stage' }, stage))),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  const T = (x, y, text, o) => svg('text', Object.assign({ x, y, 'font-size': 12, fill: 'var(--text)', text }, o || {}));
  const chips = (items, x0, y, cls, maxW) => { let x = x0; const out2 = []; items.forEach((it) => { const [label, c] = Array.isArray(it) ? it : [it, cls]; const w = Math.min(maxW || 220, 16 + label.length * 7); out2.push(svg('rect', { class: 'ch ' + c, x, y, width: w, height: 28, rx: 6 }), T(x + 8, y + 18, label, { class: 'mono', 'font-size': 11.5 })); x += w + 8; }); return out2; };
  function render() {
    const S = SC[sc]; const cur = k ? S.steps[k - 1] : null;
    codeHost.innerHTML = '';
    S.code.forEach((ln, i) => codeHost.append(el('div', { class: cur && cur.line === i ? 'on' : '', html: ln ? IA.highlight(ln, 'python') : '&nbsp;' })));
    out.textContent = cur && cur.out ? cur.out.join('\n') : ' ';
    stage.innerHTML = '';
    // running slot + clock
    const frozen = cur && cur.frozen;
    stage.append(svg('rect', { class: 'pn' + (frozen ? ' frozen' : cur && (cur.run || cur.select) ? ' hot' : ''), x: 8, y: 8, width: 470, height: 46, rx: 10 }),
      T(20, 27, frozen ? 'loop thread: BLOCKED' : 'loop thread is running', { 'font-size': 11, fill: frozen ? 'var(--err)' : 'var(--text-3)', 'font-weight': frozen ? 700 : 400 }),
      T(20, 45, cur ? (cur.run === 'timer' ? 'timer callback: main.cancel()' : cur.run ? `${cur.run}’s step` + (frozen ? '  (no await → loop frozen)' : '') : cur.select ? cur.select : 'idle') : '—', { class: 'mono', 'font-size': 13, 'font-weight': 700 }));
    stage.append(svg('rect', { class: 'pn', x: 490, y: 8, width: 142, height: 46, rx: 10 }), T(561, 27, 'loop.time()', { 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-3)' }), T(561, 46, `${cur ? cur.t : 0} ms`, { 'text-anchor': 'middle', class: 'mono', 'font-size': 16, 'font-weight': 700 }));
    // ready queue
    stage.append(svg('rect', { class: 'pn', x: 8, y: 66, width: 624, height: 58, rx: 10 }), T(20, 84, 'ready queue (deque, FIFO): run all of these, then poll again', { 'font-size': 11, fill: 'var(--text-3)' }));
    stage.append(...chips(cur && cur.ready ? cur.ready : [], 20, 90, 'q', 240));
    // timers + selector
    stage.append(svg('rect', { class: 'pn', x: 8, y: 136, width: 306, height: 76, rx: 10 }), T(20, 154, 'timer heap (call_at / sleep / timeout)', { 'font-size': 11, fill: 'var(--text-3)' }));
    stage.append(...chips(cur && cur.timers ? cur.timers : [], 20, 166, 'tm', 280));
    stage.append(svg('rect', { class: 'pn', x: 326, y: 136, width: 306, height: 76, rx: 10 }), T(338, 154, 'selector (epoll): sockets being watched', { 'font-size': 11, fill: 'var(--text-3)' }));
    stage.append(...chips(cur && cur.sel ? cur.sel.map(([l, c]) => [l + (c === 'rd' ? ' · readable' : ''), c]) : [], 338, 166, 'fd', 140));
    // tasks
    stage.append(svg('rect', { class: 'pn', x: 8, y: 224, width: 624, height: 98, rx: 10 }), T(20, 242, 'tasks', { 'font-size': 11, fill: 'var(--text-3)' }));
    ['main', 'A', 'B'].forEach((n, i) => {
      const st = cur && cur.tasks && cur.tasks[n]; const x = 20 + i * 204;
      const cls = !st ? 'ch wait' : st.startsWith('running') ? 'ch run' : st === 'done' ? 'ch done' : (st.startsWith('cancel') || st.startsWith('raised')) ? 'ch cx' : st.startsWith('await') ? 'ch wait' : 'ch q';
      stage.append(svg('rect', { class: cls, x, y: 252, width: 196, height: 58, rx: 8 }), T(x + 10, 274, `Task ${n}`, { 'font-weight': 700, 'font-size': 13 }), T(x + 10, 295, st || 'not created', { 'font-size': 11.5, fill: 'var(--text-2)' }));
    });
    narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: `${k}/${S.steps.length}` }), el('div', { class: 't', html: cur ? cur.cap : 'Press <b>Play</b> or <b>Step</b>. Each step is one thing the loop does.' }));
    bStep.disabled = k >= S.steps.length;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = 0; render(); }
  function step() { const n = SC[sc].steps.length; if (k >= n) return false; k++; render(); return k < n; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    const n = SC[sc].steps.length;
    if (k >= n) { k = 0; render(); }
    if (reduced) { k = n; render(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(2800); }
    if (g === gen) stop();
  });
  reset();
});

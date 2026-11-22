/* Microtasks vs macrotasks: call stack, nextTick queue, promise (microtask) queue and macrotask queue, one step at a time. */
IA.widget('microtasks-macrotasks', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-mm-style')) {
    document.head.append(el('style', { id: 'w-mm-style', text: `
.w-mm-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 12px; align-items: start; }
@media (max-width: 680px) { .w-mm-grid { grid-template-columns: 1fr; } }
.w-mm-box { border: 1px solid var(--border); border-radius: 10px; padding: 7px 9px; background: var(--surface-2); margin-bottom: 7px; min-width: 0; transition: border-color .3s, background .3s; }
.w-mm-box.on { border-color: var(--accent); background: var(--accent-soft); }
.w-mm-box .h { display: flex; justify-content: space-between; gap: 6px; font-size: 11.5px; color: var(--text-3); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 3px; }
.w-mm-box .h b { color: var(--accent); font-weight: 700; text-transform: none; letter-spacing: 0; }
.w-mm-items { display: flex; flex-wrap: wrap; gap: 4px; min-height: 26px; align-items: center; }
.w-mm-it { font-family: var(--mono); font-size: 12px; border: 1px solid var(--border); background: var(--surface); border-radius: 6px; padding: 2px 7px; overflow-wrap: anywhere; }
.w-mm-it.new { border-color: var(--accent-2); animation: capin .35s ease both; }
.w-mm-it.tk { border-left: 4px solid var(--warn); } .w-mm-it.mi { border-left: 4px solid var(--accent-2); } .w-mm-it.ma { border-left: 4px solid var(--text-3); }
.w-mm-stack .w-mm-it { display: block; margin-top: 3px; background: color-mix(in srgb, var(--ok) 14%, var(--surface)); border-color: var(--ok); }
.w-mm-run { font-size: 12px; color: var(--text-2); }
` }));
  }
  const SC = {
    classic: {
      label: 'The classic five',
      variants: [['cjs', 'CommonJS (.js / .cjs)'], ['esm', 'ES module (.mjs)']],
      make: () => ({
        code: `console.log('A');\nsetTimeout(() => console.log('B'), 0);\nPromise.resolve().then(() => console.log('C'));\nprocess.nextTick(() => console.log('D'));\nconsole.log('E');`,
        main: [
          ["console.log('A')", (a) => a.log('A'), 'Synchronous code runs first, top to bottom. <b>A</b> prints.'],
          ['setTimeout(…, 0)', (a) => a.timeout('B', (c) => c.log('B')), 'The timer callback becomes a <b>macrotask</b>. It can’t run before the stack and both micro-queues are empty.'],
          ['Promise.resolve().then(…)', (a) => a.then('C', (c) => c.log('C')), 'The promise is already resolved, so its reaction goes straight into the <b>microtask</b> queue.'],
          ['process.nextTick(…)', (a) => a.tick('D', (c) => c.log('D')), '<code>process.nextTick</code> has its own queue in Node.'],
          ["console.log('E')", (a) => a.log('E'), '<b>E</b> prints. The main script is done and the call stack is empty.']
        ],
        notes: { D: 'CommonJS: Node drains the <b>nextTick queue first</b>…', C: '…then the promise <b>microtasks</b>.', B: 'Only now does the event loop start and run the timer: one macrotask, then drain again.' },
        esmNotes: { C: 'ES module: the module body itself ran <i>inside</i> a microtask, so V8 finishes the microtask queue <b>first</b>: C prints before D.', D: 'Then Node gets control back and drains the nextTick queue.', B: 'Then the timer, as before.' }
      })
    },
    nest: {
      label: 'nextTick ⇄ promise nesting',
      make: () => ({
        code: `Promise.resolve().then(() => {\n  console.log('p1');\n  process.nextTick(() => console.log('tick inside p1'));\n}).then(() => console.log('p2'));\n\nprocess.nextTick(() => {\n  console.log('t1');\n  Promise.resolve().then(() => console.log('promise inside t1'));\n});`,
        main: [
          ['Promise.resolve().then(p1).then(p2)', (a) => a.then('p1', (c) => { c.log('p1'); c.tick('tick inside p1', (d) => d.log('tick inside p1')); c.then('p2', (d) => d.log('p2')); }), 'p1 is queued as a microtask. p2 waits: it is attached to the promise <i>returned</i> by the first <code>then</code>, which is still pending.'],
          ['process.nextTick(t1)', (a) => a.tick('t1', (c) => { c.log('t1'); c.then('promise inside t1', (d) => d.log('promise inside t1')); }), 't1 goes into the nextTick queue. The script ends.']
        ],
        notes: { t1: 'nextTick queue first: <b>t1</b>. It queues a promise reaction <i>behind</i> p1.', p1: 'nextTick queue is empty, so V8 drains microtasks. <b>p1</b> runs; it queues a nextTick, and finishing it resolves the first <code>then</code>’s promise, which queues <b>p2</b>.', 'promise inside t1': 'V8 keeps draining microtasks until the queue is <b>empty</b>. The new nextTick has to wait.', p2: 'p2 was queued after “promise inside t1”, so it runs next.', 'tick inside p1': 'Microtask queue empty. Node checks the nextTick queue again and finds <b>tick inside p1</b>.' }
      })
    },
    await: {
      label: 'async / await',
      make: () => ({
        code: `async function a() {\n  console.log('a1');\n  await null;\n  console.log('a2');\n}\nconsole.log('s');\na();\nPromise.resolve().then(() => console.log('p'));\nconsole.log('e');`,
        main: [
          ["console.log('s')", (a) => a.log('s'), '<b>s</b> prints.'],
          ['a()', (a) => { a.log('a1'); a.then('a() resumes after await', (c) => c.log('a2')); }, 'Calling an async function runs its body <b>synchronously</b> up to the first <code>await</code>: <b>a1</b> prints. <code>await null</code> suspends <code>a</code> and queues its continuation as a microtask.'],
          ['Promise.resolve().then(…)', (a) => a.then('p', (c) => c.log('p')), 'p is queued <i>behind</i> the continuation of <code>a</code>.'],
          ["console.log('e')", (a) => a.log('e'), '<b>e</b> prints. The stack is empty.']
        ],
        notes: { 'a() resumes after await': 'The first microtask resumes <code>a</code> after its await: <b>a2</b> prints.', p: 'Then <b>p</b>. An <code>await</code> costs one microtask turn here, not a macrotask.' }
      })
    },
    starve: {
      label: 'Starvation',
      variants: [['tick', 'recurse with nextTick'], ['imm', 'recurse with setImmediate']],
      make: (v) => {
        let n = 0; const sched = v === 'tick' ? 'tick' : 'immediate'; const call = v === 'tick' ? 'process.nextTick' : 'setImmediate';
        const spin = (a) => { n++; if (n < 5) a[sched]('spin #' + (n + 1), spin); };
        return {
          code: `let n = 0;\n// bytes are already waiting on this socket\nsocket.on('data', () => console.log('data, n =', n));\n\nfunction spin() {\n  n++;\n  if (n < 5) ${call}(spin);   // imagine n < 1e7\n}\n${call}(spin);`,
          main: [
            ["socket.on('data', …)", (a) => a.io('data handler', (c) => c.log('data, n = ' + n)), 'The socket already has bytes waiting. The <code>\'data\'</code> handler will run in the next <b>poll</b> phase.'],
            [`${call}(spin)`, (a) => a[sched]('spin #1', spin), v === 'tick' ? 'The first spin goes into the nextTick queue.' : 'The first spin goes into the check (setImmediate) queue.']
          ],
          notes: v === 'tick'
            ? { 'spin #5': 'Every spin queued another nextTick, and Node drains that queue <b>until it is empty</b> before returning to the loop. With <code>n &lt; 1e7</code> the socket would wait for all ten million. That is <b>starvation</b>.', 'data handler': 'Only now does poll run the data handler: it sees <b>n = 5</b>.' }
            : { 'data handler': 'Poll runs first in this lap: the data handler sees <b>n = 0</b>. I/O isn’t starved.', 'spin #1': 'Check phase: spin #1 runs and queues #2 for the <b>next</b> lap’s check phase. Each lap, poll gets a turn first.', 'spin #5': 'One spin per lap. Slower to finish, but fair to I/O and timers.' }
        };
      }
    },
    qm: {
      label: 'queueMicrotask',
      make: () => ({
        code: `queueMicrotask(() => console.log('micro'));\nprocess.nextTick(() => console.log('tick'));\nPromise.resolve().then(() => console.log('then'));\nconsole.log('sync');`,
        main: [
          ['queueMicrotask(…)', (a) => a.then('micro', (c) => c.log('micro')), '<code>queueMicrotask</code> puts a job straight into V8’s microtask queue, the same queue as promise reactions.'],
          ['process.nextTick(…)', (a) => a.tick('tick', (c) => c.log('tick')), 'nextTick: Node’s own queue.'],
          ['Promise.resolve().then(…)', (a) => a.then('then', (c) => c.log('then')), 'A promise reaction, queued behind <i>micro</i>.'],
          ["console.log('sync')", (a) => a.log('sync'), '<b>sync</b> prints first.']
        ],
        notes: { tick: 'nextTick queue first (CommonJS).', micro: 'Then the microtask queue in FIFO order: <b>micro</b>…', then: '…then <b>then</b>. queueMicrotask and promises share one queue; nextTick jumps ahead of both.' }
      })
    }
  };

  function simulate(sc, variant) {
    const P = sc.make(variant); const notes = variant === 'esm' ? Object.assign({}, P.notes, sc.make().esmNotes) : P.notes;
    const Q = { tick: [], micro: [], timers: [], poll: [], check: [] };
    const out = []; const frames = []; let stack = []; let fresh = new Set(); let pend = null; let pendPh = null;
    const view = () => ({ tick: Q.tick.map((x) => x.l), micro: Q.micro.map((x) => x.l), macro: [...mq('timers').map((x) => 'timer: ' + x.l), ...mq('poll').map((x) => 'I/O: ' + x.l), ...mq('check').map((x) => 'immediate: ' + x.l)] });
    const mq = (ph) => (pendPh === ph && pend ? pend : []).concat(Q[ph]);
    const snap = (t, kind) => { frames.push({ stack: stack.slice(), kind, ...view(), fresh: new Set(fresh), out: out.slice(), t }); fresh = new Set(); };
    const push = (q, l, fn) => { Q[q].push({ l, fn }); fresh.add(l); };
    const api = { log: (s) => out.push(s), timeout: (l, fn) => push('timers', l, fn), immediate: (l, fn) => push('check', l, fn), tick: (l, fn) => push('tick', l, fn), then: (l, fn) => push('micro', l, fn), io: (l, fn) => push('poll', l, fn) };
    const DEF = { tick: 'nextTick callback runs.', micro: 'Microtask runs.', timers: 'Timer macrotask runs.', poll: 'I/O callback runs.', check: 'Immediate runs.' };
    const exec = (item, kind) => { stack = [item.l]; item.fn(api); snap(notes[item.l] || DEF[kind], kind); stack = []; };
    const microAll = () => { while (Q.micro.length) exec(Q.micro.shift(), 'micro'); };
    const drain = () => { while (Q.tick.length || Q.micro.length) { while (Q.tick.length) exec(Q.tick.shift(), 'tick'); microAll(); } };
    P.main.forEach(([label, fn, note]) => { stack = ['main script', label]; fn(api); snap(note, 'main'); });
    stack = [];
    if (variant === 'esm') microAll();
    drain();
    for (let lap = 1; lap < 10; lap++) {
      for (const ph of ['timers', 'poll', 'check']) {
        pend = Q[ph]; pendPh = ph; Q[ph] = [];
        while (pend.length) { exec(pend.shift(), ph); drain(); }
        pend = null; pendPh = null;
      }
      if (!Q.timers.length && !Q.poll.length && !Q.check.length && !Q.tick.length && !Q.micro.length) break;
    }
    snap('All queues are empty. The process exits.', 'end');
    return { frames, code: P.code };
  }

  let sid = 'classic'; let variant = 'cjs'; let frames = []; let k = 0; let gen = 0; let running = false; let speed = 2200;
  const seg = (opts, cur, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); set(v); }); s.append(b); }); return s; };
  const segSc = seg(Object.entries(SC).map(([id, v]) => [id, v.label]), sid, (v) => { sid = v; reset(); }, 'Scenario');
  const varHost = el('div', { class: 'w-controls' });
  const segS = seg([[3400, 'Slow'], [2200, 'Normal'], [1000, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeHost = el('div', { class: 'codebox' });
  const outBox = el('div', { class: 'w-log', style: { maxHeight: '170px' } });
  const box = (title, prio) => { const items = el('div', { class: 'w-mm-items' }); const n = el('div', { class: 'w-mm-box' }, el('div', { class: 'h' }, el('span', { text: title }), el('b', { text: prio })), items); return { n, items }; };
  const bStack = box('call stack', 'running now'); bStack.n.classList.add('w-mm-stack');
  const bTick = box('process.nextTick queue', '1st after each callback');
  const bMicro = box('microtask queue (promises, queueMicrotask)', '2nd: until empty');
  const bMacro = box('macrotasks (timers, I/O, immediates)', 'one, then drain again');
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segSc), varHost,
    el('div', { class: 'w-mm-grid' }, el('div', null, codeHost, el('div', { class: 'tiny', style: { margin: '8px 0 0' }, text: 'stdout' }), outBox), el('div', null, bStack.n, bTick.n, bMicro.n, bMacro.n)),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);

  function fill(b, list, cls, fresh, on) {
    b.items.innerHTML = ''; b.n.classList.toggle('on', !!on);
    if (!list.length) { b.items.append(el('span', { class: 'tiny', text: 'empty' })); return; }
    list.forEach((l) => b.items.append(el('span', { class: 'w-mm-it ' + cls + (fresh && fresh.has(l.replace(/^(timer|I\/O|immediate): /, '')) && !reduced ? ' new' : ''), text: l })));
  }
  function render(f) {
    fill(bStack, f.stack, '', null, f.stack.length);
    fill(bTick, f.tick, 'tk', f.fresh, f.kind === 'tick');
    fill(bMicro, f.micro, 'mi', f.fresh, f.kind === 'micro');
    fill(bMacro, f.macro, 'ma', f.fresh, ['timers', 'poll', 'check'].includes(f.kind));
    outBox.innerHTML = ''; (f.out.length ? f.out : ['(nothing yet)']).forEach((l) => outBox.append(el('div', { text: l })));
    narr.firstChild.innerHTML = f.t;
    stats.innerHTML = '';
    const kindName = { main: 'main script', tick: 'nextTick', micro: 'microtask', timers: 'timer', poll: 'I/O callback', check: 'immediate', end: 'done' }[f.kind] || '—';
    stats.append(el('span', { class: 'w-stat', html: `running <b>${kindName}</b>` }), el('span', { class: 'w-stat', html: `printed <b>${f.out.join(' ') || '—'}</b>` }), el('span', { class: 'w-stat', html: `step <b>${k}/${frames.length}</b>` }));
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    const sc = SC[sid];
    varHost.innerHTML = '';
    if (sc.variants) { if (!sc.variants.some((v) => v[0] === variant)) variant = sc.variants[0][0]; varHost.append(seg(sc.variants, variant, (v) => { variant = v; reset(); }, 'Variant')); }
    const v = sc.variants ? variant : null;
    const r = simulate(sc, v); frames = r.frames;
    codeHost.innerHTML = ''; codeHost.append(el('pre', { html: IA.highlight(r.code, 'js') }));
    render({ stack: [], tick: [], micro: [], macro: [], out: [], kind: 'none', t: 'Press Play or Step. Each step runs one statement of the main script, or one queued callback. Watch the order the queues are emptied in.' });
    bStep.disabled = false;
  }
  function step() { if (k >= frames.length) return false; k++; render(frames[k - 1]); if (k >= frames.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= frames.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 700 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

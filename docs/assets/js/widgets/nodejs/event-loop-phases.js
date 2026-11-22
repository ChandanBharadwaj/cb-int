/* Event-loop phases: a small simulator of libuv's phases (timers → pending → idle/prepare → poll → check → close)
   with Node's nextTick + microtask drain after every callback (Node 11+). */
IA.widget('event-loop-phases', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-elp-style')) {
    document.head.append(el('style', { id: 'w-elp-style', text: `
.w-elp .ph { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: fill .3s, stroke .3s; }
.w-elp .ph.on { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2.5; }
.w-elp .ph.dim { opacity: .55; }
.w-elp .qx { fill: var(--surface-2); stroke: var(--border); stroke-width: 1.5; transition: fill .3s, stroke .3s; }
.w-elp .qx.on { fill: color-mix(in srgb, var(--accent-2) 18%, var(--surface)); stroke: var(--accent-2); stroke-width: 2.5; }
.w-elp .pl { fill: var(--text); font-size: 15px; font-weight: 700; }
.w-elp .ps { fill: var(--text-3); font-size: 12px; }
.w-elp .bd { fill: var(--accent); } .w-elp .bdt { fill: #fff; font-size: 12px; font-weight: 700; }
.w-elp .ring { fill: none; stroke: var(--border); stroke-width: 2; stroke-dasharray: 5 6; }
.w-elp .cur { fill: var(--accent); transition: transform .7s cubic-bezier(.5,0,.3,1); }
.w-elp-lanes { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; margin-top: 8px; }
.w-elp-lane { border: 1px solid var(--border); border-radius: 8px; padding: 5px 8px; background: var(--surface-2); min-height: 44px; min-width: 0; }
.w-elp-lane.on { border-color: var(--accent); background: var(--accent-soft); }
.w-elp-lane .h { font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: .04em; }
.w-elp-lane .it { display: inline-block; font-family: var(--mono); font-size: 11.5px; border: 1px solid var(--border); background: var(--surface); border-radius: 6px; padding: 1px 6px; margin: 2px 3px 0 0; overflow-wrap: anywhere; }
.w-elp-row { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 10px; align-items: start; }
@media (max-width: 640px) { .w-elp-row { grid-template-columns: 1fr; } }
` }));
  }
  // ---------- scenarios: code shown + a program for the simulator ----------
  const SC = {
    io: {
      label: 'Inside an I/O callback',
      code: `const fs = require('fs');\nfs.readFile(__filename, () => {\n  setTimeout(() => console.log('timeout'), 0);\n  setImmediate(() => console.log('immediate'));\n  process.nextTick(() => console.log('nextTick'));\n});`,
      main: (a) => a.io('readFile cb', (b) => { b.timeout('timeout', (c) => c.log('timeout')); b.immediate('immediate', (c) => c.log('immediate')); b.tick('nextTick', (c) => c.log('nextTick')); }),
      mainNote: 'The main script runs to the end. <code>fs.readFile</code> is now running on a pool thread. No timers or immediates exist yet.',
      notes: { 'readFile cb': 'Poll phase: the read finished, so its callback runs. It schedules a 0 ms timer, an immediate and a nextTick.', nextTick: 'The callback returned. Before the loop moves on, Node drains the <b>nextTick</b> queue.', immediate: 'Poll is done and an immediate is waiting, so <b>check</b> runs next. Check always comes right after poll.', timeout: 'Only on the next lap does the <b>timers</b> phase run the timeout. Inside an I/O callback, <code>setImmediate</code> always beats <code>setTimeout(0)</code>.' }
    },
    race: {
      label: 'Main module race',
      code: `// in the main module: the order is NOT deterministic\nsetTimeout(() => console.log('timeout'), 0);\nsetImmediate(() => console.log('immediate'));`,
      main: (a) => { a.timeout('timeout', (c) => c.log('timeout')); a.immediate('immediate', (c) => c.log('immediate')); },
      mainNote: 'Both are scheduled from the main script. <code>setTimeout(fn, 0)</code> is really 1 ms. Whether it is due when the loop starts depends on how long process start-up took after the call.',
      notes: { timeout: 'Timers phase: the 1 ms timer has expired, so it runs.', immediate: 'Check phase: the immediate runs.' },
      variants: [['due', 'timer due at loop start'], ['late', 'loop starts within 1 ms']]
    },
    nested: {
      label: 'Nested setImmediate',
      code: `setImmediate(() => {\n  console.log('A');\n  setImmediate(() => console.log('C'));\n});\nsetImmediate(() => console.log('B'));`,
      main: (a) => { a.immediate('A', (c) => { c.log('A'); c.immediate('C', (d) => d.log('C')); }); a.immediate('B', (c) => c.log('B')); },
      mainNote: 'Two immediates are queued for the check phase.',
      notes: { A: 'Check phase runs A. A queues C, but the check phase only runs the immediates that were queued <b>when it started</b>.', B: 'B was already queued, so it runs in the same check phase.', C: 'C runs in the <b>next</b> lap’s check phase. That’s why recursive <code>setImmediate</code> can’t starve I/O, unlike recursive <code>nextTick</code>.' }
    },
    between: {
      label: 'Microtasks between callbacks',
      code: `setImmediate(() => {\n  console.log('imm1');\n  process.nextTick(() => console.log('tick in imm1'));\n  Promise.resolve().then(() => console.log('promise in imm1'));\n});\nsetImmediate(() => console.log('imm2'));`,
      main: (a) => { a.immediate('imm1', (c) => { c.log('imm1'); c.tick('tick in imm1', (d) => d.log('tick in imm1')); c.then('promise in imm1', (d) => d.log('promise in imm1')); }); a.immediate('imm2', (c) => c.log('imm2')); },
      mainNote: 'Two immediates are queued for the check phase.',
      notes: { imm1: 'imm1 runs and queues a nextTick and a promise reaction.', 'tick in imm1': 'Since <b>Node 11</b>, both queues drain after <b>each</b> immediate or timer callback, not just between phases. nextTick first…', 'promise in imm1': '…then promise jobs. (Node ≤10 would have run imm2 before these two.)', imm2: 'Only now does the check phase continue with imm2. Browsers behave the same way.' }
    },
    timers: {
      label: 'Scheduling from a timer',
      code: `setTimeout(() => {\n  console.log('timeout');\n  setImmediate(() => console.log('immediate'));\n  setTimeout(() => console.log('timeout 2'), 0);\n}, 0);`,
      main: (a) => a.timeout('timeout', (c) => { c.log('timeout'); c.immediate('immediate', (d) => d.log('immediate')); c.timeout('timeout 2', (d) => d.log('timeout 2')); }),
      mainNote: 'One timer. Whether the loop sees it on the first lap doesn’t change the result here, because only one callback is waiting.',
      notes: { timeout: 'Timers phase: the outer timeout runs and schedules an immediate and a new 1 ms timer. The new timer is not due during this phase.', immediate: 'The loop goes on to poll (no wait, an immediate is pending) and <b>check</b>: the immediate runs.', 'timeout 2': 'Next lap: the timers phase runs timeout 2. This order is deterministic.' }
    },
    close: {
      label: 'close callbacks',
      code: `// inside a socket's connect callback (poll phase)\nsocket.on('close', () => console.log('close'));\nsetImmediate(() => console.log('immediate'));\nsocket.destroy();   // abrupt close → uv_close() on the handle`,
      main: (a) => a.io('connect cb', (b) => { b.immediate('immediate', (c) => c.log('immediate')); b.close("'close' event", (c) => c.log('close')); }),
      mainNote: 'A client socket is connecting. Its connect callback will run in the poll phase.',
      notes: { 'connect cb': 'Poll: the connect callback runs, sets an immediate and destroys the socket. libuv closes the handle; its close callback waits for the <b>close callbacks</b> phase.', immediate: 'Check comes first: the immediate runs.', "'close' event": 'Close callbacks phase: the handle close completes and Node emits <code>\'close\'</code>. (A graceful close emits it via <code>process.nextTick</code> instead.)' }
    }
  };
  const PHASES = [
    ['timers', 'timers', 'setTimeout / setInterval'],
    ['pending', 'pending callbacks', 'deferred system errors'],
    ['idle', 'idle, prepare', 'internal only'],
    ['poll', 'poll', 'I/O callbacks; waits here'],
    ['check', 'check', 'setImmediate'],
    ['close', 'close callbacks', "handle 'close' events"]
  ];
  const PH_NOTE = { timers: 'runs callbacks of expired timers.', poll: 'runs I/O completions. With nothing else to do, the loop <b>blocks here</b> until I/O arrives or the next timer is due.', check: 'runs <code>setImmediate</code> callbacks.', close: 'runs close callbacks of handles closed abruptly.', pending: 'runs I/O callbacks deferred from the last lap (for example some TCP errors).' };

  function simulate(sc, variant) {
    const Q = { timers: [], pending: [], poll: [], check: [], close: [], tick: [], micro: [] };
    const out = []; const frames = []; let phase = 'main'; let running = 'main script'; let lap = 0; let pend = null;
    const snap = (t) => frames.push({ phase, running, lap, Q: Object.fromEntries(Object.keys(Q).map((q) => [q, ((pend && q === phase) ? pend : []).concat(Q[q]).map((x) => x.l)])), out: out.slice(), t });
    const api = { log: (s) => out.push(s), timeout: (l, fn) => Q.timers.push({ l, fn }), immediate: (l, fn) => Q.check.push({ l, fn }), tick: (l, fn) => Q.tick.push({ l, fn }),
      then: (l, fn) => Q.micro.push({ l, fn }), io: (l, fn) => Q.poll.push({ l, fn }), close: (l, fn) => Q.close.push({ l, fn }) };
    const exec = (item, kind) => { running = item.l; item.fn(api);
      snap(sc.notes[item.l] || (kind === 'tick' ? 'nextTick queue drains.' : kind === 'micro' ? 'Promise jobs (microtasks) drain.' : `<code>${item.l}</code> runs.`)); };
    const drain = () => { while (Q.tick.length || Q.micro.length) { while (Q.tick.length) exec(Q.tick.shift(), 'tick'); while (Q.micro.length) exec(Q.micro.shift(), 'micro'); } };
    sc.main(api); snap(sc.mainNote); drain();
    for (lap = 1; lap < 8; lap++) {
      for (const [ph] of PHASES) {
        if (ph === 'idle') continue;
        if (ph === 'timers' && lap === 1 && variant === 'late' && Q.timers.length) {
          phase = 'timers'; running = '—'; snap('Timers phase, first lap: less than 1 ms has passed, so the timer is <b>not due yet</b>. The loop moves on.'); continue;
        }
        const batch = Q[ph]; Q[ph] = [];
        if (!batch.length) continue;
        phase = ph; running = '—'; pend = batch;
        snap(`Lap ${lap} → <b>${PHASES.find((p) => p[0] === ph)[1]}</b> phase ${PH_NOTE[ph] || ''}`);
        while (pend.length) { exec(pend.shift(), ph); drain(); }
        pend = null;
      }
      if (!Object.values(Q).some((v) => v.length)) break;
    }
    phase = 'exit'; running = '—'; snap('All queues are empty and no handles are open, so the event loop ends and the process exits.');
    return frames;
  }

  let sid = 'io'; let variant = 'due'; let frames = []; let k = 0; let gen = 0; let running = false; let speed = 2200;
  const seg = (opts, cur, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); set(v); }); s.append(b); }); return s; };
  const segSc = seg(Object.entries(SC).map(([k2, v]) => [k2, v.label]), sid, (v) => { sid = v; reset(); }, 'Scenario');
  const varHost = el('div', { class: 'w-controls' });
  const segS = seg([[3400, 'Slow'], [2200, 'Normal'], [1000, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const codeHost = el('div', { class: 'codebox' });
  const stage = svg('svg', { viewBox: '0 0 600 360', role: 'img', 'aria-label': 'The six event-loop phases in a ring, with the nextTick and microtask queues in the middle' });
  const lanes = el('div', { class: 'w-elp-lanes' });
  const outBox = el('div', { class: 'w-log', style: { marginTop: '0', maxHeight: '180px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-elp');
  root.append(el('div', { class: 'w-controls' }, segSc), varHost,
    el('div', { class: 'w-elp-row' }, el('div', { class: 'w-stage' }, stage), el('div', null, codeHost, el('div', { class: 'tiny', style: { margin: '8px 0 4px' }, text: 'stdout' }), outBox)),
    lanes, el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);

  // ---------- ring ----------
  const nodes = {}; const badges = {}; let cur; let qTick; let qMicro; let qTickN; let qMicroN;
  const pos = (i) => { const a = -Math.PI / 2 + i * Math.PI / 3; return [300 + 200 * Math.cos(a), 180 + 130 * Math.sin(a)]; };
  function drawRing() {
    stage.innerHTML = '';
    stage.append(svg('ellipse', { class: 'ring', cx: 300, cy: 180, rx: 200, ry: 130 }));
    PHASES.forEach(([id, name, sub], i) => {
      const [x, y] = pos(i);
      const r = svg('rect', { class: 'ph' + (id === 'idle' ? ' dim' : ''), x: x - 76, y: y - 23, width: 152, height: 46, rx: 10 }); nodes[id] = r;
      const b = svg('g', { style: 'display:none' }, svg('circle', { class: 'bd', cx: x + 70, cy: y - 20, r: 11 }), svg('text', { class: 'bdt', x: x + 70, y: y - 16, 'text-anchor': 'middle', text: '0' }));
      badges[id] = b;
      stage.append(r, svg('text', { class: 'pl', x, y: y - 2, 'text-anchor': 'middle', text: name }), svg('text', { class: 'ps', x, y: y + 15, 'text-anchor': 'middle', text: sub }), b);
    });
    const qb = (y, title) => { const r = svg('rect', { class: 'qx', x: 214, y, width: 172, height: 44, rx: 9 }); const n = svg('text', { class: 'ps', x: 300, y: y + 35, 'text-anchor': 'middle', text: 'empty' });
      stage.append(r, svg('text', { class: 'pl', x: 300, y: y + 19, 'text-anchor': 'middle', 'font-size': 13, text: title }), n); return [r, n]; };
    [qTick, qTickN] = qb(118, 'nextTick queue');
    [qMicro, qMicroN] = qb(170, 'microtask queue');
    stage.append(svg('text', { class: 'ps', x: 300, y: 236, 'text-anchor': 'middle', text: 'both drained after every callback' }));
    cur = svg('circle', { class: 'cur', r: 7, cx: 0, cy: 0 }); stage.append(cur);
  }
  function render(f) {
    Object.entries(nodes).forEach(([id, r]) => r.setAttribute('class', 'ph' + (id === 'idle' ? ' dim' : '') + (id === f.phase ? ' on' : '')));
    PHASES.forEach(([id]) => { const n = (f.Q[id] || []).length; badges[id].style.display = n ? '' : 'none'; badges[id].lastChild.textContent = String(n); });
    qTick.setAttribute('class', 'qx' + ((f.Q.tick.length || isKind(f, 'tick')) ? ' on' : ''));
    qMicro.setAttribute('class', 'qx' + ((f.Q.micro.length || isKind(f, 'micro')) ? ' on' : ''));
    qTickN.textContent = f.Q.tick.length ? f.Q.tick.join(', ') : 'empty';
    qMicroN.textContent = f.Q.micro.length ? f.Q.micro.join(', ') : 'empty';
    const idx = PHASES.findIndex((p) => p[0] === f.phase);
    const [x, y] = idx >= 0 ? pos(idx) : [300, 290];
    cur.style.transform = `translate(${x - 76}px, ${y}px)`; cur.style.transition = reduced ? 'none' : '';
    cur.style.display = idx >= 0 ? '' : 'none';
    lanes.innerHTML = '';
    [['timers', 'timers queue'], ['poll', 'poll (I/O done)'], ['check', 'check (immediates)'], ['close', 'close callbacks'], ['tick', 'nextTick queue'], ['micro', 'microtask queue']].forEach(([id, h]) => {
      lanes.append(el('div', { class: 'w-elp-lane' + (f.phase === id ? ' on' : '') }, el('div', { class: 'h', text: h }), ...(f.Q[id].length ? f.Q[id].map((l) => el('span', { class: 'it', text: l })) : [el('span', { class: 'tiny', text: '—' })])));
    });
    outBox.innerHTML = ''; (f.out.length ? f.out : ['(nothing yet)']).forEach((l) => outBox.append(el('div', { text: l })));
    narr.firstChild.innerHTML = f.t;
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `phase <b>${f.phase === 'main' ? 'main script' : f.phase}</b>` }), el('span', { class: 'w-stat', html: `running <b>${f.running}</b>` }), el('span', { class: 'w-stat', html: `lap <b>${f.lap || 0}</b>` }), el('span', { class: 'w-stat', html: `step <b>${k}/${frames.length}</b>` }));
  }
  const kinds = {};
  function isKind(f, kind) { return kinds[f.running] === kind; }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0;
    const sc = SC[sid];
    varHost.innerHTML = '';
    if (sc.variants) { if (!sc.variants.some((v) => v[0] === variant)) variant = sc.variants[0][0]; varHost.append(el('span', { class: 'tiny', text: 'what happened at start-up?' }), seg(sc.variants, variant, (v) => { variant = v; reset(); }, 'Timing variant')); }
    // learn which labels are nextTick / microtask callbacks (for highlighting)
    Object.keys(kinds).forEach((x) => delete kinds[x]);
    const probe = (fn) => { const a = { log() {}, timeout: (l, f) => probe(f), immediate: (l, f) => probe(f), io: (l, f) => probe(f), close: (l, f) => probe(f), tick: (l, f) => { kinds[l] = 'tick'; probe(f); }, then: (l, f) => { kinds[l] = 'micro'; probe(f); } }; fn(a); };
    probe(sc.main);
    frames = simulate(sc, variant);
    drawRing();
    codeHost.innerHTML = ''; codeHost.append(el('pre', { html: IA.highlight(sc.code, 'js') }));
    render({ phase: 'none', running: '—', lap: 0, Q: { timers: [], pending: [], poll: [], check: [], close: [], tick: [], micro: [] }, out: [], t: 'Pick a scenario and press Play or Step. The dot shows the current phase; the badges count waiting callbacks.' });
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

/* Testing Node: node:test mock timers. A virtual clock that moves only on tick(), a queue of fake timers,
   and the microtask trap where the timer is created after the tick. */
IA.widget('testing-node', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-tn-style')) {
    document.head.append(el('style', { id: 'w-tn-style', text: `
.w-tn-code { font-family: var(--mono); font-size: 12.5px; line-height: 1.75; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 0; overflow-x: auto; }
.w-tn-code div { white-space: pre; padding: 0 12px; border-left: 3px solid transparent; }
.w-tn-code div.cur { background: var(--accent-soft); border-left-color: var(--accent); }
.w-tn-code div.done { color: var(--text-3); }
.w-tn-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; margin-top: 8px; }
.w-tn-p { border: 1px solid var(--border); border-radius: 10px; padding: 7px 9px; background: var(--surface); min-height: 70px; min-width: 0; }
.w-tn-p .h { font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
.w-tn-it { font-family: var(--mono); font-size: 12px; border: 1px solid var(--border); background: var(--surface-2); border-radius: 6px; padding: 2px 6px; margin-top: 4px; overflow-wrap: anywhere; animation: capin .3s ease both; }
.w-tn-it.mt { border-color: var(--accent-2); }
.w-tn-it.ok { border-color: var(--ok); color: var(--ok); } .w-tn-it.bad { border-color: var(--err); color: var(--err); }
.w-tn .clk { fill: var(--surface-2); stroke: var(--border); } .w-tn .clkf { fill: var(--accent); }
.w-tn .tm { fill: var(--warn); } .w-tn .tm.gone { fill: var(--text-3); opacity: .5; }
.w-tn .tl { fill: var(--text-2); font-size: 12px; } .w-tn .tk { fill: var(--text-3); font-size: 11px; }
` }));
  }
  const T = (id, due, label) => ({ id, due, label });
  const SC = {
    debounce: { label: 'debounce', max: 600, code: [
      "t.mock.timers.enable({ apis: ['setTimeout'] });",
      'const save = t.mock.fn();',
      'const d = debounce(save, 300);',
      "d('a');",
      't.mock.timers.tick(200);',
      "d('b');                       // resets the window",
      't.mock.timers.tick(299);',
      'assert.equal(save.mock.callCount(), 0);',
      't.mock.timers.tick(1);',
      "assert.deepEqual(save.mock.calls[0].arguments, ['b']);"
    ], steps: [
      { l: 0, c: 0, q: [], x: '<code>enable()</code> swaps the global <code>setTimeout</code>/<code>clearTimeout</code> for fakes. The mock clock starts at 0 and only moves when the test says so.' },
      { l: 2, c: 0, q: [], x: 'A spy and the function under test. Nothing is scheduled yet.' },
      { l: 3, c: 0, q: [T(1, 300, "save('a')")], x: "<code>d('a')</code> calls the fake <code>setTimeout(fn, 300)</code>. The callback goes into the fake queue, due at <b>300</b>." },
      { l: 4, c: 200, q: [T(1, 300, "save('a')")], x: '<code>tick(200)</code>: the clock jumps to 200 instantly. Nothing is due yet.' },
      { l: 5, c: 200, q: [T(2, 500, "save('b')")], gone: [300], x: "<code>d('b')</code> clears the pending timer and schedules a new one: due at 200 + 300 = <b>500</b>." },
      { l: 6, c: 499, q: [T(2, 500, "save('b')")], x: '<code>tick(299)</code> → 499. Still 1 ms short.' },
      { l: 7, c: 499, q: [T(2, 500, "save('b')")], log: [['ok', '✓ callCount() === 0']], x: 'The assertion passes: no call yet. In real time this whole test has taken well under a millisecond.' },
      { l: 8, c: 500, q: [], fire: [500], log: [['', "save('b') called"]], x: '<code>tick(1)</code> reaches 500. The due callback runs <b>synchronously inside tick()</b>, before the next line.' },
      { l: 9, c: 500, q: [], log: [['ok', "✓ called once with 'b'"]], pass: true, x: 'Done: a 500 ms behaviour, tested exactly and instantly. Mocks on <code>t.mock</code> are restored when the test ends.' }
    ] },
    trap: { label: 'retry: the microtask trap', max: 2200, code: [
      "t.mock.timers.enable({ apis: ['setTimeout'] });",
      'const op = t.mock.fn(failOnceThenSucceed);',
      'const p = retry(op, { backoff: 1000 });',
      '//   inside retry: try { await op() } catch { await sleep(backoff) } …',
      't.mock.timers.tick(1000);',
      'await p;                      // ← hangs'
    ], steps: [
      { l: 0, c: 0, q: [], x: 'Fake <code>setTimeout</code> is on.' },
      { l: 2, c: 0, q: [], mt: ['retry: resume after await op() (rejected)'], x: '<code>retry()</code> calls <code>op()</code>, which rejects, and <b>suspends at the await</b>. Its continuation is a microtask; no timer exists yet.' },
      { l: 4, c: 1000, q: [], mt: ['retry: resume after await op() (rejected)'], x: '<code>tick(1000)</code> runs <b>synchronously, right now</b>. The queue is empty, so nothing fires. The clock is at 1000.' },
      { l: 5, c: 1000, q: [T(1, 2000, 'retry attempt 2')], mt: [], x: '<code>await p</code> yields, so microtasks finally run: <code>retry</code> resumes in its catch block and calls the fake <code>setTimeout(…, 1000)</code>, due at <b>2000</b>, on a clock nobody will advance again.' },
      { l: 5, c: 1000, q: [T(1, 2000, 'retry attempt 2')], log: [['bad', '✗ p never settles: test hangs']], fail: true, x: 'Fake timers have no real handle, so nothing ever fires. <code>node:test</code> has no per-test timeout by default (pass <code>{ timeout }</code>), so the file hangs until CI kills it; Jest would fail after its 5 s default. Fix: let the code reach the <code>setTimeout</code> before ticking. Switch to the next test.' }
    ] },
    fixed: { label: 'retry: fixed', max: 2200, code: [
      "t.mock.timers.enable({ apis: ['setTimeout'] });",
      'const op = t.mock.fn(failOnceThenSucceed);',
      'const p = retry(op, { backoff: 1000 });',
      'await flushMicrotasks();      // e.g. for (let i = 0; i < 5; i++) await Promise.resolve()',
      't.mock.timers.tick(1000);',
      'assert.equal(await p, \'ok\');',
      'assert.equal(op.mock.callCount(), 2);'
    ], steps: [
      { l: 0, c: 0, q: [], x: 'Same test, one extra line.' },
      { l: 2, c: 0, q: [], mt: ['retry: resume after await op() (rejected)'], x: '<code>retry()</code> suspends at <code>await op()</code>.' },
      { l: 3, c: 0, q: [T(1, 1000, 'retry attempt 2')], mt: [], x: 'Awaiting a few resolved promises lets the pending microtasks run. <code>retry</code> resumes and schedules the backoff timer, due at <b>1000</b>. (Jest/Vitest: <code>advanceTimersByTimeAsync</code> does this flushing for you.)' },
      { l: 4, c: 1000, q: [], fire: [1000], log: [['', 'op() call #2 → ok']], x: 'Now <code>tick(1000)</code> finds a due timer and fires it: the second attempt runs.' },
      { l: 6, c: 1000, q: [], log: [['ok', '✓ resolved "ok", 2 calls']], pass: true, x: 'Passes instantly. The rule: <b>tick only fires timers that already exist.</b> Ask “has the code reached the setTimeout yet?” before every tick.' }
    ] },
    interval: { label: 'setInterval + Date', max: 4000, code: [
      "t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 0 });",
      'const beats = [];',
      'setInterval(() => beats.push(Date.now()), 1000);',
      't.mock.timers.tick(3500);',
      'assert.deepEqual(beats, [1000, 2000, 3000]);',
      'assert.equal(Date.now(), 3500);'
    ], steps: [
      { l: 0, c: 0, q: [], x: 'Mock intervals <b>and</b> <code>Date</code> (Node 21.2+/20.11+), starting at epoch 0, so timestamps and timers agree.' },
      { l: 2, c: 0, q: [T(1, 1000, 'beat')], x: 'The interval is due at 1000.' },
      { l: 3, c: 3500, q: [T(1, 4000, 'beat')], fire: [1000, 2000, 3000], log: [['', 'beat @ Date.now() = 1000'], ['', 'beat @ Date.now() = 2000'], ['', 'beat @ Date.now() = 3000']], x: 'One <code>tick(3500)</code> fires the interval three times, in order, and <code>Date.now()</code> inside each callback reads the mock clock at that moment. The next beat is due at 4000.' },
      { l: 5, c: 3500, q: [T(1, 4000, 'beat')], log: [['ok', '✓ beats and Date.now() match']], pass: true, x: 'Both assertions pass. Mocking timers without <code>Date</code> is a common source of “timestamps don’t match durations” flakes.' }
    ] }
  };
  let sc = 'debounce'; let gen = 0; let running = false; let speed = 2400; let k = 0;
  const seg = (opts, get, set, label) => { const e = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...e.children].forEach((x) => x.classList.toggle('on', x === b)); }); e.append(b); }); return e; };
  const segSc = seg(Object.entries(SC).map(([key, v]) => [key, v.label]), () => sc, (v) => { sc = v; reset(); }, 'Test');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const codeEl = el('div', { class: 'w-tn-code' });
  const W = 600; const X0 = 16; const X1 = W - 16;
  const clock = svg('svg', { viewBox: `0 0 ${W} 74`, role: 'img', 'aria-label': 'Mock clock with scheduled timers' });
  const pQ = el('div', { class: 'w-tn-p' }); const pM = el('div', { class: 'w-tn-p' }); const pL = el('div', { class: 'w-tn-p' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-tn');
  root.append(el('div', { class: 'w-controls' }, segSc), codeEl, el('div', { class: 'w-stage', style: { marginTop: '8px' } }, clock), el('div', { class: 'w-tn-grid' }, pQ, pM, pL),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function render() {
    const S = SC[sc]; const s = S.steps[k - 1]; const c = s ? s.c : 0;
    codeEl.innerHTML = ''; S.code.forEach((ln, i) => codeEl.append(el('div', { class: s && i === s.l ? 'cur' : s && i < s.l ? 'done' : '', text: ln })));
    clock.innerHTML = ''; const X = (t) => X0 + (t / S.max) * (X1 - X0);
    clock.append(svg('text', { class: 'tl', x: X0, y: 14, text: `mock clock: ${c} ms` }), svg('rect', { class: 'clk', x: X0, y: 22, width: X1 - X0, height: 14, rx: 4 }), svg('rect', { class: 'clkf', x: X0, y: 22, width: Math.max(0, X(c) - X0), height: 14, rx: 4 }));
    [0, S.max / 2, S.max].forEach((t, i) => clock.append(svg('text', { class: 'tk', x: X(t), y: 66, 'text-anchor': i === 0 ? 'start' : i === 2 ? 'end' : 'middle', text: t + ' ms' })));
    const fired = []; const gone = []; S.steps.slice(0, k).forEach((x) => { (x.fire || []).forEach((t) => fired.push(t)); (x.gone || []).forEach((t) => gone.push(t)); });
    fired.concat(gone).forEach((t) => clock.append(svg('circle', { class: 'tm gone', cx: X(t), cy: 46, r: 5 })));
    (s ? s.q : []).forEach((q) => clock.append(svg('circle', { class: 'tm', cx: X(q.due), cy: 46, r: 6 })));
    pQ.innerHTML = ''; pQ.append(el('div', { class: 'h', text: 'fake timer queue' }));
    (s ? s.q : []).forEach((q) => pQ.append(el('div', { class: 'w-tn-it', text: `#${q.id} due ${q.due} ms → ${q.label}` })));
    if (!s || !s.q.length) pQ.append(el('div', { class: 'tiny', text: 'empty' }));
    pM.innerHTML = ''; pM.append(el('div', { class: 'h', text: 'pending microtasks' }));
    const mt = s && s.mt ? s.mt : []; mt.forEach((m) => pM.append(el('div', { class: 'w-tn-it mt', text: m })));
    if (!mt.length) pM.append(el('div', { class: 'tiny', text: 'none' }));
    pL.innerHTML = ''; pL.append(el('div', { class: 'h', text: 'log / assertions' }));
    const log = []; S.steps.slice(0, k).forEach((x) => (x.log || []).forEach((l) => log.push(l)));
    log.forEach(([cls, t]) => pL.append(el('div', { class: 'w-tn-it' + (cls ? ' ' + cls : ''), text: t })));
    stats.innerHTML = '';
    const status = s && s.pass ? 'passed' : s && s.fail ? 'stuck' : 'running';
    stats.append(el('span', { class: 'w-stat', html: `mock clock <b>${c} ms</b>` }), el('span', { class: 'w-stat', html: `real time <b>${s && s.fail ? '∞ (hangs)' : '< 1 ms'}</b>` }), el('span', { class: 'w-stat', html: `test <b>${status}</b>` }));
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; bStep.disabled = false; render(); say('Press Play or Step to run the test line by line.'); }
  function step() { const S = SC[sc]; if (k >= S.steps.length) return false; k++; render(); say(S.steps[k - 1].x); if (k >= S.steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (reduced) { while (step()); return; }
    if (k >= SC[sc].steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

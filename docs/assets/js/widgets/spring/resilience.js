/* Resilience4j circuit breaker: state machine, sliding window and a call timeline, simulated call by call (outage & recovery, failed half-open trial, slow calls). */
IA.widget('resilience', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-rs-style')) {
    document.head.append(el('style', { id: 'w-rs-style', text: `
.w-rs svg text { font-family: var(--mono); }
.w-rs .st { fill: var(--surface); stroke: var(--border); stroke-width: 1.8; transition: fill .3s, stroke .3s; }
.w-rs .st.on.CLOSED { stroke: var(--ok); stroke-width: 3; fill: color-mix(in srgb, var(--ok) 14%, var(--surface)); }
.w-rs .st.on.OPEN { stroke: var(--err); stroke-width: 3; fill: color-mix(in srgb, var(--err) 14%, var(--surface)); }
.w-rs .st.on.HALF_OPEN { stroke: var(--warn); stroke-width: 3; fill: color-mix(in srgb, var(--warn) 16%, var(--surface)); }
.w-rs .ar { stroke: var(--edge); stroke-width: 1.6; fill: none; }
.w-rs .ar.on { stroke: var(--accent); stroke-width: 2.6; }
` }));
  }
  const CFG = { size: 10, min: 5, thr: 50, wait: 10, half: 3, slowThr: 50 };
  const SC = {
    outage: { label: 'outage & recovery', intro: 'Inventory starts failing at t = 3 s and is healthy again by t = 18 s. The breaker starts CLOSED with an empty window.',
      calls: [[0, 'ok'], [1, 'ok'], [2, 'ok'], [3, 'err'], [4, 'ok'], [5, 'err'], [6, 'err'], [7, 'err'], [8, 'err'], [9, 'err'], [12, 'err'], [15, 'err'], [18, 'ok'], [19, 'ok'], [20, 'ok'], [21, 'ok']] },
    halfbad: { label: 'half-open fails', intro: 'Same outage, but the dependency is still broken when the breaker first tries again.',
      calls: [[0, 'ok'], [1, 'err'], [2, 'ok'], [3, 'err'], [4, 'err'], [6, 'err'], [10, 'err'], [17, 'err'], [18, 'ok'], [19, 'err'], [22, 'ok'], [28, 'ok'], [29, 'ok'], [30, 'ok'], [31, 'ok']] },
    slow: { label: 'slow calls', intro: 'Every call succeeds, but the dependency slows to 3 s per call. <code>slowCallDurationThreshold</code> = 2 s, <code>slowCallRateThreshold</code> = 50%.',
      calls: [[0, 'ok'], [1, 'ok'], [2, 'ok'], [3, 'slow'], [6, 'slow'], [9, 'slow'], [12, 'slow'], [13, 'slow'], [16, 'slow'], [24, 'ok'], [25, 'ok'], [26, 'ok'], [27, 'ok']] }
  };
  // Simulate: returns one frame per call.
  function simulate(calls) {
    let state = 'CLOSED'; let win = []; let openAt = 0; let trial = []; let shown = []; let shownHalf = false; const frames = []; const tl = [];
    const rate = (w, kind) => w.length ? Math.round(100 * w.filter((x) => x === kind).length / w.length) : 0;
    for (const [t, out] of calls) {
      const f = { t, out, from: state, notes: [] };
      if (state === 'OPEN' && t >= openAt + CFG.wait) { state = 'HALF_OPEN'; trial = []; f.notes.push('wait over → HALF_OPEN'); f.tr = 'oh'; }
      if (state === 'OPEN') { f.rec = 'rejected'; tl.push([t, 'rej']); f.notes.push('CallNotPermittedException → fallback'); }
      else if (state === 'HALF_OPEN') {
        trial.push(out === 'ok' ? 'ok' : out); tl.push([t, out]); f.rec = out;
        if (trial.length >= CFG.half) {
          const fr = rate(trial, 'err'); const sr = rate(trial, 'slow');
          if (fr >= CFG.thr || sr >= CFG.slowThr) { state = 'OPEN'; openAt = t; f.tr = 'ho'; shown = trial.slice(); shownHalf = true; f.notes.push(`trials: ${fr}% failed${sr ? `, ${sr}% slow` : ''} → OPEN again`); }
          else { state = 'CLOSED'; win = []; f.tr = 'hc'; f.notes.push(`trials: ${fr}% failed → CLOSED, window reset`); }
        }
      } else {
        win.push(out); if (win.length > CFG.size) win.shift(); tl.push([t, out]); f.rec = out;
        const fr = rate(win, 'err'); const sr = rate(win, 'slow');
        if (win.length >= CFG.min && (fr >= CFG.thr || sr >= CFG.slowThr)) { state = 'OPEN'; openAt = t; f.tr = 'co'; shown = win.slice(); shownHalf = false; f.notes.push(`${fr >= CFG.thr ? 'failure rate ' + fr : 'slow-call rate ' + sr}% ≥ 50% → OPEN until t=${t + CFG.wait}s`); }
      }
      f.state = state; f.half = state === 'HALF_OPEN' || f.tr === 'hc' || (state === 'OPEN' && shownHalf);
      f.win = state === 'OPEN' ? shown.slice() : f.half ? trial.slice() : win.slice();
      f.fr = rate(f.win, 'err'); f.sr = rate(f.win, 'slow'); f.tl = tl.slice(); f.openAt = openAt;
      frames.push(f);
    }
    return frames;
  }
  function explain(f) {
    const what = f.rec === 'rejected' ? `<b>rejected</b> in-process: <code>CallNotPermittedException</code>, the fallback answers from cache, inventory sees nothing` :
      f.out === 'ok' ? 'succeeds' : f.out === 'slow' ? '<b>succeeds, but takes 3 s</b> (> 2 s): recorded as a slow call' : '<b>fails</b> (I/O error)';
    let s = `t = ${f.t} s: the call ${what}.`;
    if (f.tr === 'oh') s = `t = ${f.t} s: the 10 s wait is over, so this call moves the breaker to <b>HALF_OPEN</b> and becomes trial call 1 of ${CFG.half}. It ${f.out === 'ok' ? 'succeeds' : f.out === 'slow' ? 'is slow' : 'fails'}.`;
    if (f.tr === 'co') s += f.sr >= CFG.slowThr && f.fr < CFG.thr ? ` The slow-call rate is ${f.sr}% with <b>zero errors</b>: the breaker <b>opens</b> anyway, protecting your threads.` : ` With ${f.win.length} calls recorded (≥ ${CFG.min}) the failure rate is ${f.fr}%, which is ≥ 50%: the breaker <b>opens</b> for ${CFG.wait} s.`;
    else if (f.tr === 'ho') s += ` The trial calls failed too often: back to <b>OPEN</b> for another ${CFG.wait} s.`;
    else if (f.tr === 'hc') s += ` All ${CFG.half} trial calls are in and the failure rate is below 50%: <b>CLOSED</b>, with a fresh window.`;
    else if (f.state === 'CLOSED' && f.win.length < CFG.min) s += ` Only ${f.win.length} call${f.win.length === 1 ? '' : 's'} in the window, fewer than <code>minimumNumberOfCalls</code> (${CFG.min}): the rate isn’t evaluated yet.`;
    else if (f.state === 'CLOSED') s += ` Window failure rate ${f.fr}%${f.sr ? `, slow ${f.sr}%` : ''}: below 50%, stays CLOSED.`;
    else if (f.state === 'HALF_OPEN') s += ` Trial ${f.win.length} of ${CFG.half}; more calls than that would be rejected until the trials finish.`;
    return s;
  }
  let sc = 'outage'; let frames = simulate(SC[sc].calls); let k = 0; let gen = 0; let running = false; let speed = 1700; let cur = null; const logs = [];
  const seg = (opts, c0, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === c0 ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segSc = seg(Object.keys(SC).map((x) => [x, SC[x].label]), sc, (v) => { sc = v; frames = simulate(SC[sc].calls); reset(); }, 'Scenario');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[2600, 'Slow'], [1700, 'Normal'], [900, 'Fast']], speed, (v) => { speed = v; }, 'Speed');
  const stage = svg('svg', { viewBox: '0 0 760 330', role: 'img', 'aria-label': 'Circuit breaker states, sliding window and call timeline' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const log = el('div', { class: 'w-log', 'aria-label': 'Transitions' });
  const legend = el('div', { class: 'legend', style: { marginTop: '6px' } });
  [['success', 'var(--ok)'], ['failure', 'var(--err)'], ['slow (> 2 s)', 'var(--warn)'], ['rejected (not permitted)', 'var(--text-3)']].forEach(([t, c]) => legend.append(el('span', {}, el('i', { style: { background: c } }), t)));
  root.classList.add('w-rs');
  root.append(el('div', { class: 'w-controls' }, segSc), el('div', { class: 'w-stage' }, stage), legend,
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, log);
  const COL = { ok: 'var(--ok)', err: 'var(--err)', slow: 'var(--warn)', rej: 'var(--text-3)' };
  function render() {
    const f = cur; const state = f ? f.state : 'CLOSED';
    stage.innerHTML = '';
    const P = { CLOSED: [120, 56], OPEN: [640, 56], HALF_OPEN: [380, 132] };
    stage.append(svg('defs', {}, svg('marker', { id: 'w-rs-ah', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: 'var(--text-3)' }))));
    const ar = (id, d, lx, ly, txt) => { stage.append(svg('path', { class: 'ar' + (f && f.tr === id ? ' on' : ''), d, 'marker-end': 'url(#w-rs-ah)' }), svg('text', { x: lx, y: ly, 'font-size': 10.5, fill: f && f.tr === id ? 'var(--accent)' : 'var(--text-3)', 'text-anchor': 'middle', text: txt })); };
    ar('co', 'M200 50 L560 50', 380, 42, 'failure or slow rate ≥ 50%');
    ar('oh', 'M600 82 L462 124', 590, 118, `after ${CFG.wait} s`);
    ar('ho', 'M630 90 L478 140', 640, 140, 'trials fail');
    ar('hc', 'M298 124 L160 82', 170, 118, 'trials succeed');
    Object.entries(P).forEach(([s, [x, y]]) => {
      stage.append(svg('rect', { class: 'st ' + s + (s === state ? ' on' : ''), x: x - 80, y: y - 24, width: 160, height: 48, rx: 24 }),
        svg('text', { x, y: y + 5, 'font-size': 14, 'font-weight': 700, 'text-anchor': 'middle', fill: s === state ? 'var(--text)' : 'var(--text-3)', text: s }));
    });
    stage.append(svg('text', { x: 120, y: 100, 'font-size': 10.5, fill: 'var(--text-3)', 'text-anchor': 'middle', text: 'calls flow' }),
      svg('text', { x: 640, y: 100, 'font-size': 10.5, fill: 'var(--text-3)', 'text-anchor': 'middle', text: 'calls rejected' }));
    if (f && f.state === 'OPEN') stage.append(svg('text', { x: 640, y: 18, 'font-size': 11, fill: 'var(--err)', 'text-anchor': 'middle', 'font-weight': 700, text: `open until t = ${f.openAt + CFG.wait} s` }));
    // window
    const half = f && f.half; const n = half ? CFG.half : CFG.size; const w = f ? f.win : [];
    stage.append(svg('text', { x: 20, y: 192, 'font-size': 11.5, 'font-weight': 700, fill: 'var(--text-2)', text: half ? `HALF_OPEN trial calls (${CFG.half})` : `sliding window (last ${CFG.size} calls, min ${CFG.min})` }));
    for (let j = 0; j < n; j++) { const v = w[j]; stage.append(svg('rect', { x: 20 + j * 40, y: 200, width: 34, height: 30, rx: 5, fill: v ? `color-mix(in srgb, ${COL[v]} 22%, var(--surface))` : 'var(--surface)', stroke: v ? COL[v] : 'var(--border)', 'stroke-width': 1.4 })); }
    const fr = f ? f.fr : 0; const sr = f ? f.sr : 0; const enough = half ? w.length >= CFG.half : w.length >= CFG.min;
    stage.append(svg('text', { x: 440, y: 212, 'font-size': 12, fill: fr >= 50 ? 'var(--err)' : 'var(--text)', text: `failure rate ${fr}%` }),
      svg('text', { x: 440, y: 230, 'font-size': 12, fill: sr >= 50 ? 'var(--warn)' : 'var(--text)', text: `slow-call rate ${sr}%` }),
      svg('text', { x: 620, y: 212, 'font-size': 11, fill: enough ? 'var(--text-2)' : 'var(--warn)', text: enough ? 'evaluated' : 'not evaluated' }),
      svg('text', { x: 620, y: 230, 'font-size': 11, fill: 'var(--text-3)', text: 'threshold 50%' }));
    // timeline
    const T = Math.max(...SC[sc].calls.map((c) => c[0])) + 2; const tx = (t) => 30 + (t / T) * 700;
    stage.append(svg('path', { d: `M30 300 L730 300`, stroke: 'var(--border)', 'stroke-width': 1.4 }));
    for (let t = 0; t <= T; t += 5) stage.append(svg('text', { x: tx(t), y: 318, 'font-size': 10, fill: 'var(--text-3)', 'text-anchor': 'middle', text: t + 's' }));
    (f ? f.tl : []).forEach(([t, o], j, a) => { const last = j === a.length - 1;
      stage.append(svg('rect', { x: tx(t) - 6, y: 262, width: 12, height: 32, rx: 3, fill: COL[o], opacity: o === 'rej' ? 0.45 : 0.9, stroke: last ? 'var(--text)' : 'none', 'stroke-width': 2 })); });
    stage.append(svg('text', { x: 30, y: 254, 'font-size': 11, fill: 'var(--text-3)', text: 'calls over time' }));
  }
  function say(h, tone) { narr.className = 'caption' + (tone ? ' ' + tone : ''); narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k}/${frames.length}` }), el('div', { class: 't', html: h })); }
  function paintLog() { log.innerHTML = ''; logs.forEach(([t, c]) => log.append(el('div', { text: t, style: { color: c } }))); log.scrollTop = log.scrollHeight; }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; cur = null; logs.length = 0; render(); paintLog(); say(SC[sc].intro); bStep.disabled = false; }
  function step() {
    if (k >= frames.length) return false; cur = frames[k++];
    logs.push([`t=${cur.t}s ${cur.rec === 'rejected' ? 'rejected' : cur.out}${cur.notes.length ? ' · ' + cur.notes.join(' · ') : ''}`, cur.rec === 'rejected' ? 'var(--text-3)' : cur.out === 'err' ? 'var(--err)' : cur.out === 'slow' ? 'var(--warn)' : 'var(--ok)']);
    render(); paintLog();
    say(explain(cur), cur.state === 'OPEN' ? 'err' : cur.state === 'HALF_OPEN' ? 'warn' : cur.tr === 'hc' ? 'ok' : '');
    if (k >= frames.length) bStep.disabled = true; return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= frames.length) reset();
    if (reduced) { while (step()); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

/* GIL: a per-thread timeline. One GIL token moves between threads: CPU-bound threads take turns
   every switch interval, I/O releases it, a CPU thread delays an I/O thread (convoy), and the
   free-threaded build runs everything in parallel. */
IA.widget('gil', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-pygil-style')) {
    document.head.append(el('style', { id: 'w-pygil-style', text: `
.w-pygil .lane{fill:var(--surface-2);stroke:var(--border)}
.w-pygil .run{fill:var(--accent)}
.w-pygil .wait{fill:url(#pygil-hatch)}
.w-pygil .io{fill:url(#pygil-io)}
.w-pygil .cur{stroke:var(--err);stroke-width:2}
.w-pygil .tok{fill:var(--warn);stroke:var(--surface);stroke-width:2;transition:cy .25s}
.w-pygil .tick{stroke:var(--border)}
.w-pygil .lg{font-size:12px;color:var(--text-2);display:inline-flex;gap:6px;align-items:center;margin-right:12px}
.w-pygil .sw{display:inline-block;width:18px;height:10px;border-radius:3px;border:1px solid var(--border)}
` }));
  }
  const MODES = {
    cpu: { label: 'CPU-bound × 3', ft: false, plan: { T1: [['cpu', 20]], T2: [['cpu', 20]], T3: [['cpu', 20]] },
      intro: 'Three threads each need 20 ms of pure-Python CPU. Default build: one GIL.' },
    io: { label: 'I/O-bound × 3', ft: false, plan: { T1: [['cpu', 3], ['io', 25], ['cpu', 3]], T2: [['cpu', 3], ['io', 25], ['cpu', 3]], T3: [['cpu', 3], ['io', 25], ['cpu', 3]] },
      intro: 'Three threads each do a little CPU, wait 25 ms on the network, then a little more CPU.' },
    mixed: { label: 'CPU + I/O (convoy)', ft: false, plan: { T1: [['cpu', 45]], T2: [['cpu', 1], ['io', 4], ['cpu', 1], ['io', 4], ['cpu', 1], ['io', 4], ['cpu', 1]] },
      intro: 'T1 is CPU-bound. T2 makes quick 4 ms network calls, each followed by 1 ms of Python.' },
    ft: { label: 'Free-threaded (3.13t+)', ft: true, plan: { T1: [['cpu', 20]], T2: [['cpu', 20]], T3: [['cpu', 20]] },
      intro: 'The same three CPU-bound threads on the free-threaded build, with 3 free cores. No GIL to wait for.' }
  };
  const INTERVAL = 5;
  let mode = 'cpu', sim = null, k = 0, gen = 0, running = false;

  function simulate(m) {
    const M = MODES[m]; const names = Object.keys(M.plan);
    const work = {}; names.forEach((n) => { work[n] = M.plan[n].map((o) => o.slice()); });
    const segs = {}; names.forEach((n) => { segs[n] = []; });
    const ev = []; const holderAt = [];
    const seg = (n, a, b, kind) => { if (b <= a) return; const L = segs[n]; const last = L[L.length - 1]; if (last && last.kind === kind && last.b === a) last.b = b; else L.push({ a, b, kind }); };
    if (M.ft) {
      names.forEach((n) => { let t = 0; work[n].forEach(([kind, ms]) => { seg(n, t, t + ms, kind === 'cpu' ? 'run' : 'io'); t += ms; }); });
      const wall = Math.max(...names.map((n) => segs[n][segs[n].length - 1].b));
      ev.push({ t: 0, text: 'All three threads start running bytecode <b>at the same time</b>, each on its own core. There is no GIL token to pass around.' });
      ev.push({ t: wall, text: `Done after <b>${wall} ms</b>: the wall time equals one thread’s work. Refcounts use biased (owner-thread) counting and built-in containers lock per object, which is what makes this safe.` });
      return { segs, ev, wall, names, ft: true };
    }
    let t = 0, holder = null; const ready = names.map((n) => ({ n, enter: 0, since: 0 })); const blocked = {};
    ev.push({ t: 0, text: M.intro + ` ${names.join(', ')} all want the GIL. ${names[0]} gets it first; the others wait.` });
    let guard = 0;
    while (guard++ < 500) {
      Object.keys(blocked).sort((x, y) => blocked[x] - blocked[y]).forEach((n) => {
        if (blocked[n] > t) return;
        const at = blocked[n]; delete blocked[n];
        if (!work[n].length) return;
        ready.push({ n, enter: at, since: at });
        if (holder) ev.push({ t: at, text: `${n}’s I/O finished, but ${holder} holds the GIL. ${n} must wait; after ${INTERVAL} ms it will set a drop request.` });
      });
      if (!holder) {
        if (ready.length) {
          const w = ready.shift(); holder = w.n; seg(w.n, w.enter, t, 'wait');
          ready.forEach((r) => { r.since = t; });      // a hand-off restarts every waiter's timer
        } else if (Object.keys(blocked).length) {
          ev.push({ t, text: 'Every thread is blocked in I/O: nobody holds the GIL and the CPU is idle. The waits overlap, which is why threads help here.' });
          t = Math.min(...Object.values(blocked)); continue;
        } else break;
      }
      const op = work[holder][0];
      let deadline = t + op[1], drop = false;
      const nextIo = Object.keys(blocked).length ? Math.min(...Object.values(blocked)) : Infinity;
      if (ready.length) { const req = Math.max(t, Math.min(...ready.map((r) => r.since)) + INTERVAL); if (req < deadline) { deadline = req; drop = true; } }
      else if (nextIo < deadline) { seg(holder, t, nextIo, 'run'); op[1] -= nextIo - t; t = nextIo; continue; }
      seg(holder, t, deadline, 'run'); op[1] -= deadline - t; t = deadline;
      if (op[1] <= 0) {
        work[holder].shift();
        const nx = work[holder][0];
        if (!nx) { ev.push({ t, text: `${holder} finished its work and exits, releasing the GIL` + (ready.length ? `; ${ready[0].n} takes it.` : '.') }); holder = null; continue; }
        if (nx[0] === 'io') {
          work[holder].shift(); blocked[holder] = t + nx[1]; seg(holder, t, t + nx[1], 'io');
          ev.push({ t, text: `${holder} calls a blocking socket read (${nx[1]} ms). The C code <b>releases the GIL</b> first` + (ready.length ? `, so ${ready[0].n} takes it immediately.` : '. Nobody else is waiting for it.') });
          holder = null;
        }
      } else if (drop) {
        const w = ready[0];
        ev.push({ t, text: `${w.n} has waited ${INTERVAL} ms (the switch interval) and sets a <b>drop request</b>. ${holder} sees it at its next eval-breaker check, releases the GIL, and ${w.n} takes it. ${holder} goes to the back of the queue.` });
        ready.push({ n: holder, enter: t, since: t }); holder = null;
      }
    }
    ev.sort((x, y) => x.t - y.t);
    const wall = Math.max(...names.map((n) => (segs[n].length ? segs[n][segs[n].length - 1].b : 0)));
    if (ev[ev.length - 1].t !== wall) ev.push({ t: wall, text: '' });
    names.forEach((n) => segs[n].forEach((s) => { if (s.kind === 'run') holderAt.push({ a: s.a, b: s.b, n }); }));
    return { segs, ev, wall, names, holderAt, ft: false };
  }
  function summary(S) {
    const cpu = S.names.reduce((acc, n) => acc + S.segs[n].filter((s) => s.kind === 'run').reduce((x, s) => x + s.b - s.a, 0), 0);
    const serial = S.names.reduce((acc, n) => acc + MODES[mode].plan[n].reduce((x, o) => x + o[1], 0), 0);
    return { cpu, serial };
  }

  const segM = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Workload' });
  Object.entries(MODES).forEach(([v, M]) => { const b = el('button', { text: M.label, class: v === mode ? 'on' : '' }); b.addEventListener('click', () => { mode = v; [...segM.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); segM.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 640 210', role: 'img', 'aria-label': 'Timeline lanes per thread showing running, waiting for the GIL and blocked in I/O' });
  const legend = el('div', { style: { margin: '6px 0' } },
    el('span', { class: 'lg' }, el('span', { class: 'sw', style: { background: 'var(--accent)' } }), 'runs bytecode (holds GIL)'),
    el('span', { class: 'lg' }, el('span', { class: 'sw', style: { background: 'repeating-linear-gradient(45deg,var(--warn) 0 3px,transparent 3px 6px)' } }), 'waiting for GIL'),
    el('span', { class: 'lg' }, el('span', { class: 'sw', style: { background: 'repeating-linear-gradient(90deg,var(--ok) 0 4px,transparent 4px 7px)' } }), 'blocked in I/O (GIL released)'));
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-pygil');
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-stage' }, stage), legend,
    el('div', { class: 'w-controls', style: { marginTop: '6px' } }, bPlay, bStep, bReset), narr, stats);

  const X0 = 60, XW = 560, LY = 34, LH = 44;
  function draw(tNow) {
    const S = sim; const sc = XW / Math.max(S.wall, 1);
    stage.innerHTML = '';
    stage.append(svg('defs', null,
      svg('pattern', { id: 'pygil-hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, svg('rect', { width: 3, height: 6, fill: 'var(--warn)', opacity: 0.7 })),
      svg('pattern', { id: 'pygil-io', width: 7, height: 7, patternUnits: 'userSpaceOnUse' }, svg('rect', { width: 4, height: 7, fill: 'var(--ok)', opacity: 0.75 }))));
    stage.append(svg('text', { x: X0, y: 18, 'font-size': 12, fill: 'var(--text-3)', text: S.ft ? 'free-threaded: no GIL' : 'default build: one GIL (orange token)' }));
    S.names.forEach((n, i) => {
      const y = LY + i * LH;
      stage.append(svg('text', { x: 10, y: y + 22, 'font-size': 13, 'font-weight': 700, fill: 'var(--text)', text: n }), svg('rect', { class: 'lane', x: X0, y, width: XW, height: 30, rx: 5 }));
      S.segs[n].forEach((s) => {
        if (s.a >= tNow) return;
        const b = Math.min(s.b, tNow);
        stage.append(svg('rect', { class: s.kind, x: X0 + s.a * sc, y: y + 3, width: Math.max(0, (b - s.a) * sc), height: 24, rx: 3 }));
      });
    });
    const yAxis = LY + S.names.length * LH;
    const stepMs = S.wall > 40 ? 10 : 5;
    for (let ms = 0; ms <= S.wall; ms += stepMs) stage.append(svg('line', { class: 'tick', x1: X0 + ms * sc, x2: X0 + ms * sc, y1: yAxis - 6, y2: yAxis }), svg('text', { x: X0 + ms * sc, y: yAxis + 12, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-3)', text: ms + ' ms' }));
    stage.append(svg('line', { class: 'cur', x1: X0 + tNow * sc, x2: X0 + tNow * sc, y1: LY - 6, y2: yAxis }));
    if (!S.ft) {
      const h = S.holderAt.find((s) => tNow >= s.a && tNow < s.b) || (tNow > 0 ? S.holderAt.find((s) => Math.abs(s.b - tNow) < 1e-9) : null);
      if (h) { const i = S.names.indexOf(h.n); stage.append(svg('circle', { class: 'tok', cx: X0 + tNow * sc, cy: LY + i * LH + 15, r: 11 }), svg('text', { x: X0 + tNow * sc, y: LY + i * LH + 19, 'text-anchor': 'middle', 'font-size': 8, 'font-weight': 700, fill: '#fff', text: 'GIL' })); }
    }
    stage.setAttribute('viewBox', `0 0 640 ${yAxis + 20}`);
    const sm = summary(S);
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `t <b>${Math.round(tNow)} ms</b>` }), el('span', { class: 'w-stat', html: `wall time <b>${S.wall} ms</b>` }), el('span', { class: 'w-stat', html: `CPU time <b>${sm.cpu} ms</b>` }), el('span', { class: 'w-stat', html: `if run one after another <b>${sm.serial} ms</b>` }));
  }
  let tNow = 0;
  function say(i) {
    const e = sim.ev[i]; narr.innerHTML = '';
    let txt = e ? e.text : '';
    if (e && i === sim.ev.length - 1) {
      const sm = summary(sim);
      txt = (txt ? txt + ' ' : '') + (mode === 'cpu' ? `Finished at <b>${sim.wall} ms</b>, exactly the sum of the CPU work. Three threads bought <b>no speed-up</b>: they only took turns.` : mode === 'io' ? `Finished at <b>${sim.wall} ms</b> instead of ${sm.serial} ms: the 25 ms waits overlapped because I/O releases the GIL.` : mode === 'mixed' ? 'Each of T2’s 1 ms steps had to wait for T1’s slice to end, so T2’s round trips took about twice as long as the network alone. That is the convoy effect.' : '');
    }
    narr.append(el('div', { class: 'n', text: `${i + 1}/${sim.ev.length}` }), el('div', { class: 't', html: txt }));
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); sim = simulate(mode); k = 0; tNow = 0; draw(0); narr.innerHTML = ''; narr.append(el('div', { class: 't', html: MODES[mode].intro + ' Press <b>Play</b> to run the clock, or <b>Step</b> to jump from event to event.' })); bStep.disabled = false; }
  function step() {
    if (k >= sim.ev.length) return false;
    tNow = sim.ev[k].t; draw(tNow); say(k); k++;
    bStep.disabled = k >= sim.ev.length; return k < sim.ev.length;
  }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= sim.ev.length) reset();
    if (reduced) { k = sim.ev.length - 1; step(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    // animate time continuously; announce each event as the clock passes it
    const msPerSim = 90;
    while (running && g === gen && k < sim.ev.length) {
      const target = sim.ev[k].t;
      while (running && g === gen && tNow < target) { tNow = Math.min(target, tNow + 0.5); draw(tNow); await sleep(msPerSim / 2); }
      if (!running || g !== gen) break;
      say(k); k++; bStep.disabled = k >= sim.ev.length;
      await sleep(1400);
    }
    if (g === gen) stop();
  });
  reset();
});

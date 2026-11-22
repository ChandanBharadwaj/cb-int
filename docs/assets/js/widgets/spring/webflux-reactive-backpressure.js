/* Backpressure: a fast producer (10/tick) and a slow consumer (2/tick) under four strategies. */
IA.widget('webflux-reactive-backpressure', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const PROD = 10; const CONS = 2; const TICKS = 12; const BOUND = 30;
  const MODES = {
    push: { l: 'Push, no demand (Flux.create + BUFFER)', code: 'Flux.create(sink -> loop(sink::next))   // ignores requestedFromDownstream()' },
    demand: { l: 'request(n) demand', code: 'Flux.generate(...)  // emits only when the subscriber has requested' },
    drop: { l: 'onBackpressureDrop()', code: 'hotSource.onBackpressureDrop(dropped -> metrics.increment())' },
    bounded: { l: `onBackpressureBuffer(${BOUND})`, code: `hotSource.onBackpressureBuffer(${BOUND})   // overflow → error` }
  };
  function simulate(m) {
    const F = []; let buf = 0; let consumed = 0; let dropped = 0; let emitted = 0; let err = false;
    F.push({ t: 0, buf, consumed, dropped, emitted, req: 0, cap: m === 'push' ? 'The source pushes as fast as it can and never asks how much the subscriber wants.' : m === 'demand' ? 'The subscriber calls <code>request(2)</code> each tick. The source may emit at most what was requested.' : m === 'drop' ? 'A hot source (ticks, sensor events) can’t be slowed down, so excess items are dropped.' : `A hot source with a bounded buffer of ${BOUND}. Fine for bursts, fatal for a sustained overload.` });
    for (let t = 1; t <= TICKS && !err; t++) {
      let req = CONS; let out = PROD;
      if (m === 'demand') out = Math.max(0, req - buf);
      emitted += out;
      if (m === 'drop') { const room = Math.max(0, req - buf); const keep = Math.min(out, room); dropped += out - keep; buf += keep; }
      else buf += out;
      let cap;
      if (m === 'bounded' && buf > BOUND) { err = true; cap = `Tick ${t}: ${buf} items &gt; bound ${BOUND}. The operator signals <b>onError</b> (overflow) and the Flux terminates. Clients see the stream cut off.`; }
      const c = Math.min(CONS, buf); buf -= c; consumed += c;
      if (!cap) cap = m === 'push' ? `Tick ${t}: +${out} in, −${c} out. <b>${buf}</b> items now sit in an unbounded queue on the heap.` : m === 'demand' ? `Tick ${t}: request(${req}) → ${out} emitted → ${c} consumed. Nothing piles up; upstream simply goes slower.` : m === 'drop' ? `Tick ${t}: ${PROD} produced, ${c} delivered, ${dropped} dropped so far.` : `Tick ${t}: buffer at ${buf} / ${BOUND}.`;
      F.push({ t, buf, consumed, dropped, emitted, req, cap, err, tone: err ? 'err' : (m === 'push' && buf > 40) ? 'err' : (m === 'bounded' && buf > BOUND * 0.6) ? 'warn' : null });
    }
    const L = F[F.length - 1];
    F.push(Object.assign({}, L, { cap: m === 'push' ? `After ${TICKS} ticks: ${L.buf} buffered and growing by 8 per tick. With a slow client this ends in an OutOfMemoryError.` : m === 'demand' ? 'Memory stays flat. In WebFlux this demand comes from the response writer, so a slow client slows the database read, not the heap.' : m === 'drop' ? `Memory stays flat, but ${L.dropped} items are gone. Right for metrics or UI ticks, wrong for orders.` : 'A bounded buffer turns an overload into a fast, visible failure instead of an OOM. Pair it with retries or a slower source.', tone: m === 'demand' || m === 'drop' ? 'ok' : 'err' }));
    return F;
  }
  let mode = 'push'; let F = simulate(mode); let k = 0; let gen = 0; let running = false;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Strategy' });
  Object.keys(MODES).forEach((m) => { const b = el('button', { text: MODES[m].l, class: m === mode ? 'on' : '' }); b.addEventListener('click', () => { mode = m; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); F = simulate(m); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const W = 660; const H = 210;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Producer, buffer and consumer with demand flowing upstream' });
  const codeLine = el('div', { class: 'tiny', style: { fontFamily: 'var(--mono)', margin: '0 0 8px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, seg), codeLine, el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr, stats);
  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 12, fill: 'var(--text)', text: t }, o || {}));
  function draw(f) {
    stage.innerHTML = '';
    const box = (x, label, sub, stroke) => { stage.append(svg('rect', { x, y: 40, width: 120, height: 70, rx: 10, fill: 'var(--surface)', stroke: stroke || 'var(--border)', 'stroke-width': 1.5 }), T(x + 60, 70, label, { 'text-anchor': 'middle', 'font-weight': 700 }), T(x + 60, 90, sub, { 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-2)' })); };
    box(10, 'Producer', `${PROD} items / tick`, 'var(--accent-2)');
    box(530, 'Subscriber', `handles ${CONS} / tick`, f.err ? 'var(--err)' : 'var(--accent)');
    // buffer grid: 8 cols × 6 rows = 48 cells
    const cols = 12; const rows = 5; const cw = 30; const x0 = 152; const y0 = 30;
    stage.append(T(x0, 22, `buffer: ${f.buf}${mode === 'bounded' ? ' / ' + BOUND : ''}`, { 'font-size': 11.5, fill: f.buf > 40 || f.err ? 'var(--err)' : 'var(--text-2)', 'font-family': 'var(--mono)' }));
    for (let i = 0; i < cols * rows; i++) {
      const x = x0 + (i % cols) * cw; const y = y0 + Math.floor(i / cols) * 18; const on = i < f.buf;
      const over = mode === 'bounded' && i >= BOUND;
      stage.append(svg('rect', { x, y, width: cw - 4, height: 14, rx: 3, fill: on ? (i >= 40 || over ? 'var(--err)' : 'var(--accent)') : 'var(--surface-2)', stroke: over && !on ? 'var(--err)' : 'var(--border)', 'stroke-width': 0.6, 'stroke-dasharray': over && !on ? '2 2' : '' }));
    }
    if (f.buf > cols * rows) stage.append(T(x0 + cols * cw - 6, 22, `+${f.buf - cols * rows} more on the heap`, { 'text-anchor': 'end', fill: 'var(--err)', 'font-weight': 700, 'font-size': 11 }));
    // arrows
    stage.append(svg('line', { x1: 130, y1: 140, x2: 530, y2: 140, stroke: 'var(--accent)', 'stroke-width': 2 }), T(330, 134, 'onNext(item) →', { 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--accent)' }));
    const demandOn = mode !== 'push';
    stage.append(svg('line', { x1: 530, y1: 168, x2: 130, y2: 168, stroke: demandOn ? 'var(--ok)' : 'var(--text-3)', 'stroke-width': 2, 'stroke-dasharray': '6 4', opacity: demandOn ? 1 : 0.5 }),
      T(330, 186, demandOn ? (mode === 'demand' ? `← request(${f.req || CONS}) honoured by the source` : '← request(n) reaches the operator; the hot source ignores it') : '← request(n) ignored', { 'text-anchor': 'middle', 'font-size': 11, fill: demandOn ? 'var(--ok)' : 'var(--text-3)' }));
    if (f.err) stage.append(T(590, 125, 'onError ✗', { 'text-anchor': 'middle', fill: 'var(--err)', 'font-weight': 700 }));
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `tick <b>${f.t}</b>` }), el('span', { class: 'w-stat', html: `emitted <b>${f.emitted}</b>` }), el('span', { class: 'w-stat', html: `consumed <b>${f.consumed}</b>` }), el('span', { class: 'w-stat', html: `dropped <b>${f.dropped}</b>` }));
  }
  function show() {
    const f = F[k]; draw(f); codeLine.textContent = MODES[mode].code;
    narr.className = 'caption' + (f.tone ? ' ' + f.tone : '');
    narr.innerHTML = ''; narr.append(el('span', { class: 'n', text: `${k + 1}/${F.length}` }), el('div', { class: 't', html: f.cap }));
    bStep.disabled = k >= F.length - 1;
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = 0; show(); }
  bStep.addEventListener('click', () => { gen++; stop(); if (k < F.length - 1) { k++; show(); } });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { gen++; stop(); return; }
    if (k >= F.length - 1) k = 0;
    if (reduced) { k = F.length - 1; show(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen; show();
    while (running && g === gen && k < F.length - 1) { await sleep(1300); if (g !== gen) return; k++; show(); }
    if (g === gen) stop();
  });
  reset();
});

/* Structured Streaming: micro-batches on an event-time axis, watermark, window state and output modes. */
IA.widget('structured-streaming', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const BATCHES = [[3, 4, 7], [12, 9, 14], [21, 2], [27, 3], [33]];
  const DELAY = 10, SIZE = 5, W = 760, H = 250, X0 = 30, PX = 19; // px per minute
  const MODES = { append: 'append', update: 'update', complete: 'complete' };
  let mode = 'append'; let k = 0; let running = false; let gen = 0;
  // precompute the run
  const runs = []; (function sim() {
    let wm = 0, maxSeen = 0; const state = new Map(); const done = new Map(); const events = [];
    runs.push({ events: [], state: new Map(), done: new Map(), wm: 0, out: [], dropped: [], changed: [] });
    BATCHES.forEach((b) => {
      const dropped = []; const changed = new Set();
      b.forEach((t) => { const w = Math.floor(t / SIZE) * SIZE;
        if (w + SIZE <= wm) { dropped.push(t); events.push({ t, d: true }); return; }
        events.push({ t, d: false }); state.set(w, (state.get(w) || 0) + 1); changed.add(w); });
      const out = [];
      [...state.keys()].sort((a, c) => a - c).forEach((w) => { if (w + SIZE <= wm) { out.push([w, state.get(w)]); done.set(w, state.get(w)); state.delete(w); } });
      maxSeen = Math.max(maxSeen, ...b);
      runs.push({ events: events.slice(), state: new Map(state), done: new Map(done), wmUsed: wm, wm: Math.max(wm, maxSeen - DELAY), out, dropped, changed: [...changed], batch: b });
      wm = Math.max(wm, maxSeen - DELAY);
    });
  })();
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Output mode' });
  Object.entries(MODES).forEach(([v, l]) => { const b = el('button', { text: l, class: v === mode ? 'on' : '' }); b.addEventListener('click', () => { mode = v; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); render(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Event-time axis with 5-minute windows, events and the watermark line' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const outHost = el('div', { class: 'tscroll' });
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'output mode' }), seg), el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr,
    el('h3', { class: 'sub-h', text: 'Written to the sink this batch', style: { fontSize: '14px', margin: '12px 0 6px' } }), outHost, stats);
  const fmt = (m) => `12:${String(m).padStart(2, '0')}`;
  function render() {
    const r = runs[k]; stage.innerHTML = '';
    const AY = 200;
    stage.append(svg('line', { x1: X0, x2: X0 + 36 * PX, y1: AY, y2: AY, stroke: 'var(--border)', 'stroke-width': 2 }));
    for (let m = 0; m <= 35; m += 5) stage.append(svg('text', { x: X0 + m * PX, y: AY + 18, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-3)', text: fmt(m) }));
    for (let w = 0; w < 35; w += SIZE) {
      const st = r.done.has(w) ? 'done' : r.state.has(w) ? 'open' : 'none';
      const fill = st === 'done' ? 'color-mix(in srgb, var(--ok) 25%, transparent)' : st === 'open' ? 'var(--accent-soft)' : 'none';
      stage.append(svg('rect', { x: X0 + w * PX + 1, y: 40, width: SIZE * PX - 2, height: 120, rx: 6, fill, stroke: st === 'none' ? 'var(--border)' : st === 'done' ? 'var(--ok)' : 'var(--accent)', 'stroke-dasharray': st === 'none' ? '3 3' : '' }));
      const c = r.done.get(w) ?? r.state.get(w);
      if (c != null) stage.append(svg('text', { x: X0 + (w + SIZE / 2) * PX, y: 58, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--text)', text: (st === 'done' ? 'final ' : 'count ') + c }));
    }
    const lastBatch = new Set(k ? BATCHES[k - 1] : []);
    const seen = {};
    r.events.forEach((e) => { seen[e.t] = (seen[e.t] || 0) + 1; const y = 175 - (seen[e.t] - 1) * 14;
      const dot = svg('circle', { cx: X0 + e.t * PX + PX / 2, cy: y, r: 6, fill: e.d ? 'var(--err)' : lastBatch.has(e.t) ? 'var(--warn)' : 'var(--text-3)' });
      if (!reduced && lastBatch.has(e.t)) { dot.style.transition = 'opacity .6s'; dot.style.opacity = '0'; requestAnimationFrame(() => { dot.style.opacity = '1'; }); }
      stage.append(dot); if (e.d) stage.append(svg('text', { x: X0 + e.t * PX + PX / 2 + 9, y: y + 4, 'font-size': 11, fill: 'var(--err)', text: 'dropped' })); });
    const wx = X0 + r.wm * PX;
    stage.append(svg('line', { x1: wx, x2: wx, y1: 22, y2: AY, stroke: 'var(--err)', 'stroke-width': 2, 'stroke-dasharray': '6 4' }),
      svg('text', { x: wx + 4, y: 32, 'font-size': 12, fill: 'var(--err)', text: `watermark ${fmt(r.wm)}` }));
    // output table
    let rows = [];
    if (k) {
      if (mode === 'append') rows = r.out;
      else if (mode === 'update') rows = r.changed.sort((a, b) => a - b).map((w) => [w, r.state.get(w) ?? r.done.get(w)]);
      else rows = [...new Set([...r.done.keys(), ...r.state.keys()])].sort((a, b) => a - b).map((w) => [w, r.state.get(w) ?? r.done.get(w)]);
    }
    outHost.innerHTML = '';
    const tb = el('tbody');
    rows.forEach(([w, c]) => tb.append(el('tr', { style: { animation: reduced ? 'none' : 'capin .35s ease both' } }, el('td', { text: `[${fmt(w)}, ${fmt(w + SIZE)})` }), el('td', { text: String(c) }))));
    if (!rows.length) tb.append(el('tr', null, el('td', { colspan: 2, class: 'null', text: k ? '(nothing this batch)' : '(not started)' })));
    outHost.append(el('table', { class: 't rg' }, el('thead', null, el('tr', null, el('th', { text: 'window' }), el('th', { text: 'count' }))), tb));
    let t;
    if (!k) t = 'Before the first batch. Windows are 5 minutes; the watermark delay is 10 minutes. Press Step to run batch 1.';
    else {
      t = `Batch ${k}: events at ${r.batch.map(fmt).join(', ')}. Filtering and emitting use the watermark from the previous batch (${fmt(r.wmUsed)}).`;
      if (r.dropped.length) t += ` Event ${r.dropped.map(fmt).join(', ')} is older than the watermark’s window: <b>dropped</b>.`;
      if (k === 3) t += ' Event 12:02 is late but its window is still open (window end 12:05 &gt; watermark 12:04), so it is <b>counted</b>.';
      if (r.out.length) t += ` Windows ${r.out.map(([w]) => fmt(w)).join(', ')} are final and their state is removed.`;
      t += ` New watermark: max event time − 10 min = ${fmt(r.wm)}.`;
      t += mode === 'append' ? ' Append writes only final windows.' : mode === 'update' ? ' Update writes every window changed in this batch.' : ' Complete rewrites the whole result.';
    }
    narr.firstChild.innerHTML = t;
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `batch <b>${k}</b>/${BATCHES.length}` }), el('span', { class: 'w-stat', html: `windows in state <b>${r.state.size}</b>` }), el('span', { class: 'w-stat', html: `dropped late rows <b>${r.events.filter((e) => e.d).length}</b>` }));
    bStep.disabled = k >= BATCHES.length;
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; render(); }
  function step() { if (k >= BATCHES.length) return false; k++; render(); return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= BATCHES.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 800 : 2800);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

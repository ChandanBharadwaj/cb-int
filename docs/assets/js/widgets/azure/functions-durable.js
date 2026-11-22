/* Durable Functions: an orchestrator schedules activities, unloads, and deterministically replays its history on every wake-up. */
IA.widget('functions-durable', (root, ctx) => {
  /* ---- shared Azure widget kit (identical in every azure widget file) ---- */
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-az-style')) {
    document.head.append(el('style', { id: 'w-az-style', text: `
.w-az .nb rect { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: fill .4s, stroke .4s; }
.w-az .nb { transition: opacity .45s; }
.w-az .nb text { fill: var(--text); font-size: 13px; font-family: var(--sans); }
.w-az .nb text.s { fill: var(--text-3); font-size: 10.5px; font-family: var(--mono); }
.w-az .nb.hot rect { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-soft); }
.w-az .nb.ok rect { stroke: var(--ok); stroke-width: 2.5; fill: color-mix(in srgb, var(--ok) 15%, var(--surface)); }
.w-az .nb.warn rect { stroke: var(--warn); stroke-width: 2.5; fill: color-mix(in srgb, var(--warn) 16%, var(--surface)); }
.w-az .nb.bad rect { stroke: var(--err); stroke-width: 2.5; fill: color-mix(in srgb, var(--err) 15%, var(--surface)); }
.w-az .nb.bad text.s, .w-az .nb.warn text.s, .w-az .nb.ok text.s, .w-az .nb.hot text.s { fill: var(--text-2); }
.w-az .nb.dim { opacity: .32; }
.w-az .nb.gone { opacity: .1; }
.w-az .eg { stroke: var(--border); stroke-width: 1.6; fill: none; transition: stroke .4s, opacity .4s; }
.w-az .eg.hot { stroke: var(--accent); stroke-width: 2.6; }
.w-az .eg.ok { stroke: var(--ok); stroke-width: 2.6; }
.w-az .eg.warn { stroke: var(--warn); stroke-width: 2.6; }
.w-az .eg.bad { stroke: var(--err); stroke-width: 2.6; stroke-dasharray: 6 4; }
.w-az .eg.dim { opacity: .25; }
.w-az .zn { fill: color-mix(in srgb, var(--surface-2) 70%, transparent); stroke: var(--border); stroke-dasharray: 6 5; transition: stroke .4s, fill .4s; }
.w-az .zn.bad { stroke: var(--err); fill: color-mix(in srgb, var(--err) 9%, transparent); }
.w-az .zn.hot { stroke: var(--accent); }
.w-az .lbl { fill: var(--text-2); font-size: 12px; font-family: var(--sans); }
.w-az .lbl.m { font-family: var(--mono); font-size: 11px; fill: var(--text-3); }
.w-az .pkt { fill: var(--accent); stroke: var(--surface); stroke-width: 2; }
.w-az .bar { transition: width .6s ease, x .6s ease; }
.w-az.rm * { transition: none !important; animation: none !important; }
` }));
  }
  root.classList.add('w-az'); if (reduced) root.classList.add('rm');
  const Z = {};
  const clearZ = () => { for (const k in Z) delete Z[k]; };
  const seg = (opts, cur, on, label) => {
    const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' });
      b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); });
    return s;
  };
  const node = (g, id, x, y, w, h, t, s) => {
    const n = svg('g', { class: 'nb' });
    n.append(svg('rect', { x, y, width: w, height: h, rx: 8 }));
    n.append(svg('text', { x: x + w / 2, y: s != null ? y + h / 2 - 3 : y + h / 2 + 4, 'text-anchor': 'middle', text: t }));
    let se = null;
    if (s != null) { se = svg('text', { class: 's', x: x + w / 2, y: y + h / 2 + 12, 'text-anchor': 'middle', text: s }); n.append(se); }
    g.append(n); Z[id] = { n, base: 'nb', sub: se, sub0: s || '', x, y, w, h }; return n;
  };
  const edge = (g, id, d) => { const p = svg('path', { class: 'eg', d }); g.append(p); Z[id] = { n: p, base: 'eg' }; return p; };
  const link = (g, id, a, b) => {
    const A = Z[a]; const B = Z[b];
    const x1 = A.x + A.w / 2; const y1 = A.y + A.h; const x2 = B.x + B.w / 2; const y2 = B.y; const my = (y1 + y2) / 2;
    return edge(g, id, `M${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`);
  };
  const hlink = (g, id, a, b) => {
    const A = Z[a]; const B = Z[b]; const y1 = A.y + A.h / 2; const y2 = B.y + B.h / 2;
    const [x1, x2] = A.x < B.x ? [A.x + A.w, B.x] : [A.x, B.x + B.w]; const mx = (x1 + x2) / 2;
    return edge(g, id, `M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`);
  };
  const mid = (id) => { const z = Z[id]; return [z.x + z.w / 2, z.y + z.h / 2]; };
  function paint(s) {
    for (const id in Z) { const z = Z[id]; const c = s && s.c && s.c[id];
      z.n.setAttribute('class', z.base + (c ? ' ' + c : ''));
      if (z.sub) z.sub.textContent = s && s.sub && s.sub[id] != null ? s.sub[id] : z.sub0; }
  }
  const cum = () => { let acc = {}; let sub = {};
    return { set(c, sb) { Object.assign(acc, c || {}); Object.assign(sub, sb || {}); return { c: { ...acc }, sub: { ...sub } }; }, clear() { acc = {}; sub = {}; } }; };
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const say = (n, h, cls) => { narr.className = 'caption' + (cls ? ' ' + cls : ''); narr.innerHTML = '';
    narr.append(el('div', { class: 'n', text: String(n) }), el('div', { class: 't', html: h })); };
  let gen = 0;
  const pkt = svg('circle', { r: 7, class: 'pkt', opacity: 0 });
  function fly(ids, ms) {
    const g = gen; const pts = ids.map((p) => (typeof p === 'string' ? mid(p) : p));
    return new Promise((res) => {
      if (reduced || pts.length < 2) return res();
      const L = []; let tot = 0;
      for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(d); tot += d; }
      const dur = ms || 900; const t0 = performance.now(); pkt.setAttribute('opacity', 1);
      const fr = (t) => {
        if (g !== gen) { pkt.setAttribute('opacity', 0); return res(); }
        let d = Math.min(1, (t - t0) / dur) * tot; let i = 0;
        while (i < L.length - 1 && d > L[i]) { d -= L[i]; i++; }
        const f = L[i] ? Math.min(1, d / L[i]) : 1; const [x1, y1] = pts[i]; const [x2, y2] = pts[i + 1];
        pkt.setAttribute('cx', x1 + (x2 - x1) * f); pkt.setAttribute('cy', y1 + (y2 - y1) * f);
        if (t - t0 < dur) requestAnimationFrame(fr); else { pkt.setAttribute('opacity', 0); res(); }
      };
      requestAnimationFrame(fr);
    });
  }
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const controls = el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset);
  let steps = []; let k = 0; let running = false; let busy = false;
  function makeStepper(plan, intro, onReset, pause) {
    const reset = () => {
      gen++; running = false; busy = false; bPlay.textContent = '▶ Play'; k = 0;
      if (onReset) onReset(); steps = plan(); paint(null); say(0, intro()); bStep.disabled = false;
    };
    const step = async () => {
      if (busy || k >= steps.length) return false;
      busy = true; const g = gen; const s = steps[k++];
      if (s.pre) paint(s.pre);
      if (s.fly) await fly(s.fly, s.ms);
      if (g !== gen) return false;
      paint(s); if (s.run) s.run(); say(k, s.t, s.cls); busy = false;
      if (k >= steps.length) bStep.disabled = true;
      return true;
    };
    bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
    bReset.addEventListener('click', reset);
    bPlay.addEventListener('click', async () => {
      if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
      if (k >= steps.length) reset();
      running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
      while (running && g === gen && await step()) { if (k >= steps.length) break; await sleep(reduced ? 700 : (pause || 2600)); }
      if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
    });
    return reset;
  }
  /* ---- end kit ---- */
  const stage = svg('svg', { viewBox: '0 0 640 336', role: 'img', 'aria-label': 'Durable Functions orchestrator replaying its history' });
  const stats = el('div', { class: 'w-stats' });
  const stat = (h) => { stats.innerHTML = ''; h.forEach((x) => stats.append(el('span', { class: 'w-stat', html: x }))); };
  const CODE = ['callActivity("Reserve").await()', 'callActivity("Charge").await()', 'createTimer(24h) or event "Shipped"', 'callActivity("Notify").await()', 'return "done"'];
  const HIST = ['ExecutionStarted', 'TaskScheduled Reserve', 'TaskCompleted Reserve', 'TaskScheduled Charge', 'TaskCompleted Charge', 'EventRaised Shipped', 'TaskScheduled Notify', 'TaskCompleted Notify'];
  function build() {
    stage.innerHTML = ''; clearZ();
    const g = svg('g'); const e = svg('g');
    stage.append(svg('text', { class: 'lbl', x: 10, y: 14, text: 'orchestrator (Java)' }), svg('text', { class: 'lbl', x: 330, y: 14, text: 'history (task hub)' }));
    CODE.forEach((c, i) => node(g, 'c' + i, 10, 24 + i * 52, 300, 42, c, 'not reached'));
    HIST.forEach((h, i) => node(g, 'h' + i, 330, 24 + i * 38, 160, 32, h));
    node(g, 'w', 508, 80, 124, 60, 'activity worker', 'idle');
    node(g, 'orc', 508, 210, 124, 60, 'orchestrator', 'unloaded');
    hlink(e, 'ew', 'h1', 'w');
    stage.append(e, g, pkt);
  }
  function plan() {
    const A = cum(); const S = [];
    const hidden = {}; HIST.forEach((_, i) => { hidden['h' + i] = 'gone'; });
    S.push({ ...A.set({ ...hidden, h0: 'ok', h1: 'ok', c0: 'hot', orc: 'hot', ew: 'dim' }, { c0: 'schedules Reserve, then yields', orc: 'running' }), run: () => stat(['replays <b>0</b>']), t: 'The client starts an instance, and <code>ExecutionStarted</code> is written. The orchestrator runs from the top, reaches <code>callActivity("Reserve")</code>, records <code>TaskScheduled</code>, and <b>yields</b>. Nothing blocks a thread while it waits.' });
    S.push({ fly: ['h1', 'w'], ...A.set({ w: 'hot', ew: 'hot', orc: '' }, { w: 'running Reserve', orc: 'unloaded' }), t: 'The orchestrator is <b>unloaded</b> from memory. An activity worker (any instance) picks the task from the queue and runs <code>Reserve</code>: real I/O lives here.' });
    S.push({ ...A.set({ h2: 'ok', w: 'ok' }, { w: 'idle' }), t: '<code>TaskCompleted Reserve</code> is appended to the history. This append-only log is the orchestration’s whole state.', cls: 'ok' });
    S.push({ ...A.set({ c0: 'ok', c1: 'hot', h3: 'ok', orc: 'hot' }, { c0: 'REPLAYED: result read from history', c1: 'schedules Charge, then yields', orc: 'replay #1' }), run: () => stat(['replays <b>1</b>']), t: '<b>Replay</b>: the orchestrator runs again <i>from the first line</i>. <code>Reserve</code> already has a result in the history, so the await returns instantly without calling the activity again. Then it schedules <code>Charge</code> and yields.', cls: 'warn' });
    S.push({ fly: ['h3', 'w'], ...A.set({ h4: 'ok', w: 'ok', orc: '' }, { orc: 'unloaded' }), t: '<code>Charge</code> runs and completes. Activities have at-least-once semantics, so make them <b>idempotent</b> (for example, pass an idempotency key to the payment API).', cls: 'ok' });
    S.push({ ...A.set({ c1: 'ok', c2: 'hot', orc: 'hot' }, { c1: 'REPLAYED', c2: 'waiting (durable timer / event)', orc: 'replay #2 → sleep' }), run: () => stat(['replays <b>2</b>', 'waiting costs ≈ nothing']), t: 'Replay #2 reaches a <b>durable timer or external event</b>: “wait up to 24 h for Shipped”. The instance can sleep for hours or days, with no compute held while it waits.', cls: 'warn' });
    S.push({ ...A.set({ h5: 'ok', c2: 'ok', c3: 'hot', h6: 'ok', h7: 'ok' }, { c2: 'REPLAYED', c3: 'Notify done', orc: 'replay #3' }), run: () => stat(['replays <b>3</b>']), t: 'The warehouse raises <code>Shipped</code>. A replay passes lines 1–3 from history and runs <code>Notify</code>.' });
    S.push({ ...A.set({ c3: 'ok', c4: 'ok', orc: 'ok' }, { c3: 'REPLAYED', c4: 'completed', orc: 'completed' }), run: () => stat(['ExecutionCompleted']), t: '<b>Done.</b> The rule that follows from replay: orchestrator code must be <b>deterministic</b>. No <code>Instant.now()</code>, <code>UUID.randomUUID()</code>, HTTP calls or random numbers in the orchestrator. Use <code>ctx.getCurrentInstant()</code> and activities instead.', cls: 'ok' });
    return S;
  }
  root.append(el('div', { class: 'w-stage' }, stage), stats, controls, narr);
  const reset = makeStepper(plan, () => 'Press Play: an order orchestration schedules activities, unloads, and replays its history each time it wakes up.', build);
  reset();
});

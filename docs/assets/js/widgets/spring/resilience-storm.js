/* Retry storm: retries at every layer multiply load on a failing dependency; fixed back-off makes waves, exponential + jitter spreads them; retrying only at one layer caps the multiplier. */
IA.widget('resilience-storm', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  let layers = 3; let attempts = 3; let backoff = 'fixed'; let where = 'all'; let tcur = 0; let gen = 0; let running = false;
  const USERS = 40; const FAIL = 0.05; let TMAX = 8; let BUCKET = 0.2;
  function rng(seed) { let x = seed; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; }
  function simulate() {
    const r = rng(7); const hits = [];
    const wait = (n) => backoff === 'fixed' ? 1 : r() * 0.25 * Math.pow(2, n);   // full jitter: U(0, base·2^n)
    const retries = (layer) => where === 'all' || layer === layers ? attempts : 1;
    function call(layer, t) {        // layer 1..layers; the last layer calls the DB. returns finish time
      let now = t; const n = retries(layer);
      for (let i = 0; i < n; i++) {
        if (layer === layers) { hits.push(now); now += FAIL; } else now = call(layer + 1, now);
        if (i < n - 1) now += wait(i);
      }
      return now + 0.01;
    }
    for (let u = 0; u < USERS; u++) call(1, r() * 0.2);
    TMAX = Math.max(4, Math.ceil(Math.max(...hits) + 0.5)); BUCKET = TMAX / 40;
    return hits;
  }
  const seg = (opts, cur, on, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); reset(); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 760 300', role: 'img', 'aria-label': 'Call chain with call counts per hop and a histogram of calls arriving at the failing database over time' });
  const stats = el('div', { class: 'w-stats' }); const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'layers' }), seg([[1, '1'], [2, '2'], [3, '3']], layers, (v) => { layers = v; }, 'Layers'),
      el('span', { class: 'tiny', text: 'attempts each' }), seg([[2, '2'], [3, '3'], [4, '4']], attempts, (v) => { attempts = v; }, 'Attempts')),
    el('div', { class: 'w-controls' }, seg([['fixed', 'fixed 1 s'], ['jitter', 'exponential + jitter']], backoff, (v) => { backoff = v; }, 'Back-off'),
      seg([['all', 'retry at every layer'], ['edge', 'retry only at the last layer']], where, (v) => { where = v; }, 'Where to retry')),
    el('div', { class: 'w-stage' }, stage), stats, el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr);
  let hits = simulate();
  function render() {
    stage.innerHTML = '';
    const names = ['gateway', 'bff', 'orders'].slice(0, layers); const nodes = ['user', ...names, 'database (down)'];
    const W = 700 / (nodes.length - 1);
    nodes.forEach((n, j) => { const x = 30 + j * W;
      stage.append(svg('rect', { x: x - 52, y: 18, width: 104, height: 40, rx: 8, fill: j === nodes.length - 1 ? 'color-mix(in srgb, var(--err) 12%, var(--surface))' : 'var(--surface)', stroke: j === nodes.length - 1 ? 'var(--err)' : 'var(--border)', 'stroke-width': 1.6 }),
        svg('text', { x, y: 43, 'font-size': 12, 'font-weight': 700, 'text-anchor': 'middle', fill: 'var(--text)', 'font-family': 'var(--mono)', text: n }));
    });
    // counts on edges: calls arriving at node j per user request
    let m = 1;
    for (let j = 1; j < nodes.length; j++) {
      if (j >= 2) { const callerLayer = j - 1; m *= where === 'all' || callerLayer === layers ? attempts : 1; }
      const x = 30 + (j - 0.5) * W;
      stage.append(svg('path', { d: `M${30 + (j - 1) * W + 52} 38 L${30 + j * W - 52} 38`, stroke: 'var(--edge)', 'stroke-width': 1.6 }),
        svg('text', { x, y: 78, 'font-size': 12, 'text-anchor': 'middle', 'font-weight': 700, 'font-family': 'var(--mono)', fill: j === nodes.length - 1 ? 'var(--err)' : 'var(--text-2)', text: '×' + m }));
    }
    // histogram
    const nb = Math.round(TMAX / BUCKET); const counts = new Array(nb).fill(0);
    hits.forEach((t) => { if (t <= tcur) { const b = Math.floor(t / BUCKET); if (b < nb) counts[b]++; } });
    const all = new Array(nb).fill(0); hits.forEach((t) => { const b = Math.floor(t / BUCKET); if (b < nb) all[b]++; });
    const max = Math.max(10, ...all); const bw = 700 / nb; const H = 160; const y0 = 280;
    stage.append(svg('text', { x: 30, y: 104, 'font-size': 11.5, 'font-family': 'var(--mono)', fill: 'var(--text-3)', text: `calls reaching the database per ${Math.round(BUCKET * 1000)} ms (${USERS} users, all requests fail)` }));
    counts.forEach((c, b) => { const h = (c / max) * H; stage.append(svg('rect', { x: 30 + b * bw + 1, y: y0 - h, width: bw - 2, height: h, rx: 2, fill: 'var(--err)', opacity: 0.75 })); });
    stage.append(svg('path', { d: `M30 ${y0} L730 ${y0}`, stroke: 'var(--border)', 'stroke-width': 1.4 }));
    const tick = TMAX <= 10 ? 1 : TMAX <= 30 ? 5 : 10; for (let t = 0; t <= TMAX; t += tick) stage.append(svg('text', { x: 30 + (t / TMAX) * 700, y: y0 + 16, 'font-size': 10, 'text-anchor': 'middle', fill: 'var(--text-3)', 'font-family': 'var(--mono)', text: t + 's' }));
    const cx = 30 + Math.min(tcur, TMAX) / TMAX * 700; stage.append(svg('path', { d: `M${cx} ${y0 - H - 6} L${cx} ${y0}`, stroke: 'var(--accent)', 'stroke-width': 1.6, 'stroke-dasharray': '4 3' }));
    const seen = hits.filter((t) => t <= tcur).length; const peak = Math.max(...counts);
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `DB calls per user request <b>×${m}</b>` }), el('span', { class: 'w-stat', html: `DB calls so far <b>${seen}</b> / ${hits.length}` }), el('span', { class: 'w-stat', html: `peak per ${Math.round(BUCKET * 1000)} ms <b>${peak}</b>` }), el('span', { class: 'w-stat', html: `t = <b>${Math.min(tcur, TMAX).toFixed(1)} s</b>` }));
  }
  function say() {
    const m = where === 'all' ? Math.pow(attempts, layers) : attempts;
    narr.className = 'caption' + (m >= 9 ? ' err' : '');
    narr.innerHTML = ''; narr.append(el('div', { class: 't', html: where === 'all'
      ? `${layers} layer${layers > 1 ? 's' : ''} × ${attempts} attempts = up to <b>${m}</b> database calls per user request. ${backoff === 'fixed' ? 'Fixed waits keep everyone in step: the bars come in <b>waves</b>, each one hitting a database that is trying to recover.' : 'Jitter spreads the attempts out, which lowers the peaks, but the <b>total</b> is the same: jitter doesn’t fix multiplication.'}`
      : `Only the layer next to the database retries; the others fail fast. At most <b>${m}</b> database calls per user request, whatever the depth. ${backoff === 'jitter' ? 'With jitter the remaining retries are also spread out.' : 'Add jitter to spread them out.'}` }));
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; tcur = 0; hits = simulate(); render(); say(); }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; tcur = Math.min(TMAX, tcur + TMAX / 10); render(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (tcur >= TMAX) tcur = 0;
    if (reduced) { tcur = TMAX; render(); return; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && tcur < TMAX) { tcur = Math.min(TMAX, tcur + TMAX / 90); render(); await sleep(70); }
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

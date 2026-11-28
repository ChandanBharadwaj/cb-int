/* Fan-out lab: a BFF composes one screen from five services. Latencies are sampled from a lognormal per service;
   sequential = sum, parallel = max, deadline = cut at D (optional parts dropped, a required part fails the screen). */
SD.widget('ms-edge-bff', function (root, ctx) {
  const { el, svg } = ctx;
  const SVC = [
    { name: 'Catalog', req: true, p50: 40 },
    { name: 'Pricing', req: true, p50: 45 },
    { name: 'Stock', req: true, p50: 35 },
    { name: 'Reviews', req: false, p50: 60 },
    { name: 'Recs', req: false, p50: 70 }
  ];
  const SIGMA = Math.log(250 / 40) / 2.326;            // p99 is about 6x p50
  const opt = { mode: 'par', slow: -1, deadline: 300 };
  let gen = 0, loopH = null, anim = null, last = null, agg = null;

  function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  // One request: returns per-call start/end, what was cut, the screen latency and the outcome.
  function simulate() {
    const D = opt.deadline, dl = opt.mode === 'dl';
    let t = 0, total = 0, failed = false; const missing = [];
    const calls = SVC.map((s, i) => {
      const d = s.p50 * (i === opt.slow ? 15 : 1) * Math.exp(SIGMA * gauss());
      const start = opt.mode === 'seq' ? t : 0, end = start + d; t = end;
      const cut = dl && end > D;
      if (cut) { if (s.req) failed = true; else missing.push(s.name); }
      total = Math.max(total, cut ? D : end);
      return { start, end: cut ? D : end, cut };
    });
    return { calls, total, outcome: failed ? 'failed' : missing.length ? 'partial' : 'full', missing };
  }

  function build(narrow) {
    const my = ++gen; anim = null;
    if (loopH) loopH.stop();
    root.innerHTML = '';
    const W = narrow ? 360 : 640, LW = narrow ? 84 : 110, RH = narrow ? 34 : 36, TOP = 30, F = narrow ? 13.5 : 14;
    const H = TOP + (SVC.length + 1) * RH + 8, X0 = LW + 6, X1 = W - 12;

    const seg = el('div', { class: 'w-seg', role: 'group', 'aria-label': 'Fan-out mode' });
    const segB = [['seq', 'Sequential'], ['par', 'Parallel'], ['dl', 'Parallel + deadline']].map(([v, l]) => {
      const b = el('button', { class: 'btn', text: l }); b._v = v;
      b.onclick = () => { opt.mode = v; sync(); agg = null; one(false); };
      seg.append(b); return b;
    });
    const slowSel = el('select', { 'aria-label': 'Slow service' });
    [['-1', 'none'], ['3', 'Reviews (optional)'], ['1', 'Pricing (required)']].forEach(([v, t]) => slowSel.append(el('option', { value: v, text: t })));
    slowSel.value = String(opt.slow);
    slowSel.addEventListener('change', () => { opt.slow = +slowSel.value; agg = null; one(false); });
    const dlIn = el('input', { type: 'range', min: 100, max: 800, step: 50, value: opt.deadline, 'aria-label': 'Deadline' });
    const dlOut = el('b', { text: opt.deadline + ' ms' });
    dlIn.addEventListener('input', () => { opt.deadline = +dlIn.value; dlOut.textContent = opt.deadline + ' ms'; agg = null; if (opt.mode === 'dl') one(false); });
    const dlLab = el('label', null, 'Deadline ', dlIn, ' ', dlOut);
    const sendB = el('button', { class: 'btn primary', text: '▶ Send 1 request' });
    const runB = el('button', { class: 'btn', text: 'Run 500' });
    sendB.onclick = () => one(true);
    runB.onclick = () => many();
    function sync() { segB.forEach((b) => b.classList.toggle('primary', b._v === opt.mode)); dlLab.style.opacity = opt.mode === 'dl' ? 1 : 0.45; }
    root.append(el('div', { class: 'w-controls' }, seg, el('label', null, 'Slow service ', slowSel), dlLab, sendB, runB));

    const stage = el('div', { class: 'w-stage' });
    const S = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Waterfall of downstream calls for one screen request', style: narrow ? '' : 'max-width:860px;display:block;margin:0 auto' });
    stage.append(S);
    stage.append(el('p', { class: 'muted', style: { margin: '6px 0 0', fontSize: '13px' }, html: '<b>Solid</b> bars are required parts, <b>pale</b> bars are optional. The dashed line is the deadline. The last row is what the client waits for.' }));
    const stats = el('div', { class: 'w-stats' });
    const log = el('div', { class: 'w-log', 'aria-live': 'polite' });
    root.append(stage, stats, log);

    const T = (x, y, t, a, fill, w) => svg('text', { x, y, text: t, 'text-anchor': a || 'start', fill: fill || 'var(--text)', style: 'font:' + (w || 600) + ' ' + F + 'px var(--sans)' });
    function draw(r, upTo) {
      S.innerHTML = '';
      const maxT = Math.max(400, Math.ceil(Math.max(r.total, opt.mode === 'dl' ? opt.deadline : 0) * 1.15 / 100) * 100);
      const x = (t) => X0 + (X1 - X0) * Math.min(t, maxT) / maxT;
      [0, maxT / 2, maxT].forEach((t, i) => {
        S.append(svg('line', { x1: x(t), y1: TOP - 6, x2: x(t), y2: H - 6, stroke: 'var(--border)', 'stroke-width': 1 }));
        S.append(T(x(t), 16, Math.round(t) + (i ? ' ms' : ''), i === 0 ? 'start' : i === 1 ? 'middle' : 'end', 'var(--text-3)', 500));
      });
      r.calls.forEach((c, i) => {
        const s = SVC[i], y = TOP + i * RH, e = Math.min(c.end, upTo), shown = upTo > c.start;
        S.append(T(4, y + RH / 2 + 5, s.name));
        if (!shown) return;
        const done = upTo >= c.end, col = done && c.cut ? (s.req ? 'var(--err)' : 'var(--warn)') : 'var(--accent)';
        S.append(svg('rect', { x: x(c.start), y: y + 6, width: Math.max(2, x(e) - x(c.start)), height: RH - 12, rx: 4, fill: col, opacity: s.req || (done && c.cut) ? 1 : 0.45 }));
        if (done) {
          const lab = c.cut ? (s.req ? 'timed out' : 'dropped') : Math.round(c.end - c.start) + ' ms';
          const right = x(e) + 6 + lab.length * F * 0.56 < X1;
          S.append(T(right ? x(e) + 6 : x(e) - 6, y + RH / 2 + 5, lab, right ? 'start' : 'end', right ? 'var(--text-2, var(--text))' : '#fff', 600));
        }
      });
      const y = TOP + SVC.length * RH, end = upTo >= r.total;
      const col = !end ? 'var(--text-3)' : r.outcome === 'full' ? 'var(--ok)' : r.outcome === 'partial' ? 'var(--warn)' : 'var(--err)';
      S.append(svg('line', { x1: 0, y1: y + 1, x2: W, y2: y + 1, stroke: 'var(--border)', 'stroke-width': 1 }));
      S.append(T(4, y + RH / 2 + 6, 'Screen', 'start', 'var(--text)', 700));
      S.append(svg('rect', { x: x(0), y: y + 8, width: Math.max(2, x(Math.min(upTo, r.total)) - x(0)), height: RH - 14, rx: 4, fill: col }));
      if (end) {
        const lab = Math.round(r.total) + ' ms', right = x(r.total) + 6 + lab.length * F * 0.56 < X1;
        S.append(T(right ? x(r.total) + 6 : x(r.total) - 6, y + RH / 2 + 6, lab, right ? 'start' : 'end', right ? 'var(--text)' : '#fff', 700));
      }
      if (opt.mode === 'dl') S.append(svg('line', { x1: x(opt.deadline), y1: TOP - 8, x2: x(opt.deadline), y2: H - 4, stroke: 'var(--err)', 'stroke-width': 2, 'stroke-dasharray': '5 4' }));
    }
    function paintStats() {
      stats.innerHTML = '';
      const add = (k, v) => stats.append(el('span', { class: 'w-stat', html: k + ': <b>' + v + '</b>' }));
      if (last) { add('this request', Math.round(last.total) + ' ms'); add('result', last.outcome === 'partial' ? 'partial (no ' + last.missing.join(', ') + ')' : last.outcome); }
      if (agg) { add('p50', agg.p50 + ' ms'); add('p99', agg.p99 + ' ms'); add('full', agg.full + '%'); add('partial', agg.partial + '%'); add('failed', agg.failed + '%'); }
    }
    function say(t) { if (my !== gen) return; log.prepend(el('div', { html: t })); while (log.children.length > 30) log.lastChild.remove(); }
    function explain(r) {
      const m = opt.mode === 'seq' ? 'Sequential: the screen waits for the <b>sum</b> of the calls.' : opt.mode === 'par' ? 'Parallel: the screen waits for the <b>slowest</b> call.' : 'Deadline ' + opt.deadline + ' ms: late calls are cut.';
      const o = r.outcome === 'full' ? '✅ full response' : r.outcome === 'partial' ? '⚠ <b>partial response</b>: ' + r.missing.join(', ') + ' dropped, screen still renders' : '❌ a <b>required</b> part missed the deadline: fast error instead of a long wait';
      say(m + ' ' + Math.round(r.total) + ' ms → ' + o + '.');
    }
    function one(animate) {
      last = simulate(); paintStats();
      if (!animate || ctx.reduced) { anim = null; draw(last, Infinity); if (animate) explain(last); return; }
      anim = { t: 0, dur: Math.min(2600, Math.max(900, last.total * 3)), r: last };
    }
    function many() {
      const N = 500, tot = [], c = { full: 0, partial: 0, failed: 0 };
      let r;
      for (let i = 0; i < N; i++) { r = simulate(); tot.push(r.total); c[r.outcome]++; }
      tot.sort((a, b) => a - b);
      const pc = (k) => Math.round(c[k] / N * 1000) / 10;
      agg = { p50: Math.round(tot[N / 2]), p99: Math.round(tot[Math.floor(N * 0.99)]), full: pc('full'), partial: pc('partial'), failed: pc('failed') };
      last = r; anim = null; draw(r, Infinity); paintStats();
      say('500 requests, <b>' + (opt.mode === 'seq' ? 'sequential' : opt.mode === 'par' ? 'parallel' : 'parallel + ' + opt.deadline + ' ms deadline') + '</b>' + (opt.slow >= 0 ? ', ' + SVC[opt.slow].name + ' slow' : '') + ': p50 <b>' + agg.p50 + ' ms</b>, p99 <b>' + agg.p99 + ' ms</b>, ' + agg.full + '% full, ' + agg.partial + '% partial, ' + agg.failed + '% failed.');
    }
    loopH = ctx.loop((dt) => {
      if (!anim) return;
      anim.t += dt;
      const p = Math.min(1, anim.t / anim.dur);
      draw(anim.r, p >= 1 ? Infinity : p * anim.r.total);
      if (p >= 1) { const r = anim.r; anim = null; explain(r); }
    });

    sync(); one(false);
    say('Send a request. Then make <b>Reviews</b> slow and compare <b>Parallel</b> with <b>Parallel + deadline</b>. Make <b>Pricing</b> slow to see a required part fail.');
  }
  build(ctx.narrow);
  ctx.onResize(build);
});

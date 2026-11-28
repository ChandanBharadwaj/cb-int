/* Release lanes: a discrete simulation of changes queueing for a delivery pipeline. Batches fail if they hold a bad change and are bisected. */
SD.widget('ms-monolith-vs-microservices', function (root, ctx) {
  const { el, svg } = ctx;
  const TICK_MIN = 5, DAY = 96;                             // 96 ticks of 5 minutes = one 8 h working day
  const SHAPES = {
    mono: { name: 'Monolith', lanes: 1, shared: true, run: 6, bad: 0.04, cap: 16, upkeep: 0, cross: 0, text: '<b>Monolith</b>: one pipeline of 30 min for everything. Whatever is waiting ships as one batch.' },
    mod: { name: 'Modular monolith', lanes: 1, shared: true, run: 2, bad: 0.03, cap: 16, upkeep: 0, cross: 0, isolate: true, text: '<b>Modular monolith</b>: still one deployable, but the build tests only the modules a change touches. A run takes 10 min and a failure names the culprit, so the rest of the batch is not bisected.' },
    micro: { name: 'Microservices', lanes: 6, shared: false, run: 2, bad: 0.03, cap: 16, upkeep: 0.45, cross: 0.2, text: '<b>Microservices</b>: six services, six pipelines. One change in five spans two services (orange) and must pass both. Upkeep of six services costs engineer time.' },
    dist: { name: 'Distributed monolith', lanes: 6, shared: true, run: 9, bad: 0.06, cap: 24, upkeep: 0.45, cross: 0, text: '<b>Distributed monolith</b>: six services that share data, so all six release together in one 45 min train, and a change breaks more often.' }
  };
  const opt = { shape: 'mono', eng: 60 };
  let sim, loopH, running = false, narrow = ctx.narrow, S, stats, log, legend, runBtn, acc = 0;

  function reset() {
    const c = SHAPES[opt.shape];
    sim = { cfg: c, tick: 0, day: 0, lead: [], fails: 0, runs: 0, made: 0, dayShipped: 0, dayMade: 0,
      lanes: Array.from({ length: c.lanes }, () => []),
      pipes: (c.shared ? [0] : Array.from({ length: c.lanes }, (_, i) => i)).map((i) => ({ lanes: c.shared ? Array.from({ length: c.lanes }, (_, k) => k) : [i], run: null, cap: c.cap, flash: '', flashT: 0 })) };
  }
  // One 5-minute step of the real mechanism: arrivals, batch start, batch finish, bisect on failure.
  function step() {
    const c = sim.cfg, rate = 0.6 * Math.max(0, opt.eng - c.upkeep) / DAY;      // 3 changes per engineer per week
    let n = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0);
    while (n-- > 0) {
      const ch = { t0: sim.tick, bad: Math.random() < c.bad, need: 1, cross: false };
      const a = Math.floor(Math.random() * c.lanes); sim.lanes[a].push(ch);
      if (c.cross && Math.random() < c.cross) { ch.cross = true; ch.need = 2; sim.lanes[(a + 1 + Math.floor(Math.random() * (c.lanes - 1))) % c.lanes].push(ch); }
      sim.made++; sim.dayMade++;
    }
    sim.pipes.forEach((p) => {
      if (p.flashT > 0) p.flashT--;
      if (p.run) {
        if (--p.run.left > 0) return;
        const items = p.run.items; p.run = null; sim.runs++;
        if (items.some((x) => x.c.bad)) {                   // the whole batch fails
          sim.fails++; p.flash = 'err'; p.flashT = 3;
          if (c.isolate) {                                  // module-scoped tests name the culprit: fix it, requeue it last
            const bad = items.filter((x) => x.c.bad), good = items.filter((x) => !x.c.bad);
            bad.forEach((x) => { x.c.bad = false; sim.lanes[x.lane].push(x.c); });
            good.reverse().forEach((x) => sim.lanes[x.lane].unshift(x.c));
          } else {
            if (items.length === 1) items[0].c.bad = false; // culprit found: fix it and try again
            p.cap = Math.max(1, Math.ceil(items.length / 2)); // bisect: next run takes half
            items.slice().reverse().forEach((x) => sim.lanes[x.lane].unshift(x.c));
          }
        } else {
          p.flash = 'ok'; p.flashT = 3; p.cap = Math.min(c.cap, p.cap * 2);
          items.forEach((x) => { if (--x.c.need === 0) { sim.lead.push((sim.tick - x.c.t0) * TICK_MIN); sim.dayShipped++; } });
        }
      }
      const items = [];
      while (items.length < p.cap) {                        // oldest waiting change first, across this pipeline's lanes
        let best = -1; p.lanes.forEach((l) => { const q = sim.lanes[l]; if (q.length && (best < 0 || q[0].t0 < sim.lanes[best][0].t0)) best = l; });
        if (best < 0) break; items.push({ c: sim.lanes[best].shift(), lane: best });
      }
      if (items.length) p.run = { items, left: c.run, total: c.run };
    });
    sim.tick++;
  }
  const waiting = () => { const set = new Set(); sim.lanes.forEach((q) => q.forEach((c) => set.add(c))); sim.pipes.forEach((p) => p.run && p.run.items.forEach((x) => set.add(x.c))); return set.size; };
  const quant = (q) => { if (!sim.lead.length) return '–'; const a = sim.lead.slice().sort((x, y) => x - y), v = a[Math.min(a.length - 1, Math.floor(a.length * q))]; return v >= 120 ? (v / 60).toFixed(1) + ' h' : v + ' min'; };
  function say(t) { log.prepend(el('div', { html: t })); while (log.children.length > 30) log.lastChild.remove(); }

  function draw() {
    const c = sim.cfg, L = c.lanes, W = narrow ? 360 : 640, f = narrow ? 14 : 15;
    const rowH = L === 1 ? 84 : 42, top = 26, H = top + L * rowH + 8;
    const labW = narrow ? 62 : 96, pipeW = narrow ? 104 : 170, px = W - pipeW - 4, qx = labW + 8, gap = narrow ? 13 : 14;
    const maxDots = Math.floor((px - qx - (narrow ? 34 : 44)) / gap) * (L === 1 ? 3 : 1);
    S.setAttribute('viewBox', '0 0 ' + W + ' ' + H); S.innerHTML = '';
    const T = (x, y, t, a, fill, w) => svg('text', { x, y, text: t, 'text-anchor': a || 'start', fill: fill || 'var(--text)', style: 'font:' + (w || 600) + ' ' + f + 'px var(--sans)' });
    S.append(T(4, 16, 'service', 'start', 'var(--text-3)', 500), T(qx, 16, 'waiting changes', 'start', 'var(--text-3)', 500), T(W - 6, 16, 'pipeline', 'end', 'var(--text-3)', 500));
    sim.lanes.forEach((q, i) => {
      const y = top + i * rowH, cy = y + rowH / 2;
      S.append(svg('rect', { x: 2, y: y + 3, width: px - 8, height: rowH - 6, rx: 8, fill: 'var(--surface-2)', stroke: 'var(--border)' }));
      S.append(T(10, cy + 5, L === 1 ? 'shop' : 'svc ' + (i + 1), 'start', 'var(--text)', 700));
      const perRow = Math.floor(maxDots / (L === 1 ? 3 : 1)) || 1;
      q.slice(0, maxDots).forEach((ch, k) => {
        const r = Math.floor(k / perRow), col = k % perRow;
        S.append(svg('circle', { cx: qx + 6 + col * gap, cy: L === 1 ? cy - 16 + r * 16 : cy, r: 5, fill: ch.cross ? 'var(--warn)' : 'var(--accent)' }));
      });
      if (q.length > maxDots) S.append(T(px - 14, cy + 5, '+' + (q.length - maxDots), 'end', 'var(--err)', 700));
    });
    sim.pipes.forEach((p, i) => {
      const y = top + (c.shared ? 0 : i * rowH) + 3, h = (c.shared ? L * rowH : rowH) - 6, cy = y + h / 2;
      const tone = p.flashT > 0 ? (p.flash === 'ok' ? 'var(--ok)' : 'var(--err)') : p.run ? 'var(--accent)' : 'var(--border)';
      S.append(svg('rect', { x: px, y, width: pipeW, height: h, rx: 8, fill: 'var(--surface)', stroke: tone, 'stroke-width': 2 }));
      if (p.run) S.append(svg('rect', { x: px + 2, y: y + h - 8, width: (pipeW - 4) * (1 - p.run.left / p.run.total), height: 6, rx: 3, fill: 'var(--accent)' }));
      const label = p.flashT > 0 ? (p.flash === 'ok' ? '✔ shipped' : '✖ failed') : p.run ? 'testing ×' + p.run.items.length : 'idle';
      S.append(T(px + pipeW / 2, cy + 3, label, 'middle', p.flashT > 0 ? tone : p.run ? 'var(--text)' : 'var(--text-3)', 700));
      if (c.shared && L > 1) S.append(T(px + pipeW / 2, cy + 24, 'all 6 together', 'middle', 'var(--text-3)', 500));
    });
    stats.innerHTML = '';
    [['day', sim.day + (sim.tick % DAY ? 1 : 0) || 1], ['shipped', sim.lead.length], ['waiting', waiting()], ['lead time p50 / p90', quant(0.5) + ' / ' + quant(0.9)], ['failed runs', sim.fails + ' of ' + sim.runs], ['upkeep', c.upkeep ? c.upkeep + ' FTE' : 'none']]
      .forEach(([k, v]) => stats.append(el('span', { class: 'w-stat', html: k + ': <b>' + v + '</b>' })));
  }
  function endDay() {
    running = false; runBtn.disabled = false; sim.day++;
    say('Day ' + sim.day + ' · <b>' + sim.cfg.name + '</b>, ' + opt.eng + ' engineers: ' + sim.dayMade + ' changes made, <b>' + sim.dayShipped + ' shipped</b>, ' + waiting() + ' left waiting. Lead time p50 ' + quant(0.5) + ', p90 ' + quant(0.9) + '.');
    sim.dayMade = 0; sim.dayShipped = 0;
  }
  function runDay() {
    if (running) return;
    if (ctx.reduced) { for (let i = 0; i < DAY; i++) step(); draw(); endDay(); draw(); return; }
    running = true; runBtn.disabled = true; acc = 0;
  }
  function restart(msg) { running = false; reset(); if (runBtn) runBtn.disabled = false; legend.innerHTML = sim.cfg.text; draw(); if (msg) say(msg); }

  function build() {
    if (loopH) loopH.stop();
    root.innerHTML = '';
    const seg = el('div', { class: 'w-seg', role: 'group', 'aria-label': 'Shape' });
    const btns = Object.keys(SHAPES).map((k) => { const b = el('button', { class: 'btn', text: SHAPES[k].name }); b.onclick = () => { opt.shape = k; sync(); restart('Switched to <b>' + SHAPES[k].name + '</b>. Press ▶ to run a day.'); }; b._k = k; seg.append(b); return b; });
    const sync = () => btns.forEach((b) => b.classList.toggle('primary', b._k === opt.shape));
    sync();
    const out = el('b', { text: String(opt.eng) });
    const range = el('input', { type: 'range', min: 5, max: 300, step: 5, value: opt.eng, 'aria-label': 'Engineers', style: { width: '130px' } });
    range.addEventListener('input', () => { opt.eng = +range.value; out.textContent = String(opt.eng); });
    range.addEventListener('change', () => restart(opt.eng + ' engineers make about ' + Math.round(opt.eng * 0.6) + ' changes a day.'));
    runBtn = el('button', { class: 'btn primary', text: '▶ Run a day' }); runBtn.onclick = runDay;
    const rst = el('button', { class: 'btn', text: 'Reset' }); rst.onclick = () => restart('Reset.');
    root.append(el('div', { class: 'w-controls' }, seg, el('label', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center' } }, 'Engineers ', range, out), runBtn, rst));
    const stage = el('div', { class: 'w-stage' });
    S = svg('svg', { role: 'img', 'aria-label': 'Changes waiting for delivery pipelines' });
    legend = el('p', { class: 'muted', style: { margin: '8px 0 0', fontSize: '13px' } });
    stage.append(S, legend);
    stats = el('div', { class: 'w-stats' });
    log = el('div', { class: 'w-log', 'aria-live': 'polite' });
    root.append(stage, stats, log);
    restart('Each dot is a change waiting to ship. A run that contains a bad change <b>fails as a whole</b>; the next run takes half as many to find it. Press ▶, then raise the engineers to 200 and compare the shapes.');
    loopH = ctx.loop((dt) => {
      if (!running) return;
      acc += dt;
      while (acc >= 60 && running) { acc -= 60; step(); if (sim.tick % DAY === 0) endDay(); }
      draw();
    });
  }
  build();
  ctx.onResize((n) => { narrow = n; build(); });
});

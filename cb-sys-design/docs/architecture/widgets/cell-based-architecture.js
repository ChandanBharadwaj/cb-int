/* Blast-radius lab: assign customers to workers with no isolation, plain cells/shards or shuffle sharding,
   poison one customer (kills every worker it uses) and count who is down. Compares with 1 / C(n, k). */
SD.widget('cell-based-architecture', function (root, ctx) {
  const { el, svg } = ctx;
  const opt = { mode: 'shuffle', n: 8, k: 2, seed: 7 };
  let poison = -1, dead = new Set(), trials = null;

  // small deterministic PRNG so every "router" would compute the same assignment
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function comb(n, k) { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); }
  // which workers does customer c use?
  function workersOf(c, o) {
    o = o || opt;
    if (o.mode === 'none') return Array.from({ length: o.n }, (_, i) => i);
    const r = rng(o.seed * 7919 + c * 104729 + 13);
    if (o.mode === 'cells') { const groups = Math.floor(o.n / o.k); const g = Math.floor(r() * groups); return Array.from({ length: o.k }, (_, i) => g * o.k + i); }
    const pool = Array.from({ length: o.n }, (_, i) => i);          // seeded partial Fisher-Yates
    for (let i = 0; i < o.k; i++) { const j = i + Math.floor(r() * (o.n - i)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    return pool.slice(0, o.k).sort((a, b) => a - b);
  }
  function statusOf(c, deadSet, o) {
    const ws = workersOf(c, o); const alive = ws.filter((w) => !deadSet.has(w)).length;
    return alive === 0 ? 'down' : alive < ws.length ? 'deg' : 'ok';
  }
  function expected() {
    if (opt.mode === 'none') return 1;
    if (opt.mode === 'cells') return 1 / Math.floor(opt.n / opt.k);
    return 1 / comb(opt.n, opt.k);
  }

  function seg(label, key, options, after) {
    const wrap = el('div', { class: 'w-seg', role: 'group', 'aria-label': label });
    const btns = options.map(([v, l]) => {
      const b = el('button', { class: 'btn', text: l });
      b.onclick = () => { opt[key] = v; after(); };
      b._v = v; wrap.append(b); return b;
    });
    wrap._sync = () => btns.forEach((b) => b.classList.toggle('primary', opt[key] === b._v));
    wrap._sync();
    const lab = el('label', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' } }, label + ' ', wrap);
    lab._sync = wrap._sync; return lab;
  }

  function build(narrow) {
    root.innerHTML = '';
    const C = narrow ? 60 : 120;                       // customers drawn
    const perRowW = narrow ? 8 : 16, perRowC = narrow ? 10 : 20;
    const W = narrow ? 360 : 700;
    const change = () => { poison = -1; dead = new Set(); trials = null; segs.forEach((s) => s._sync()); draw(); };
    const segs = [
      seg('Assignment', 'mode', [['none', 'No isolation'], ['cells', 'Cells / shards'], ['shuffle', 'Shuffle sharding']], () => change()),
      seg('Workers', 'n', [[8, '8'], [12, '12'], [16, '16']], () => change()),
      seg('Per customer', 'k', [[2, '2'], [3, '3'], [4, '4']], () => change())
    ];
    const bRand = el('button', { class: 'btn primary', text: '☠ Poison a random customer' });
    bRand.onclick = () => { poisonCustomer(Math.floor(Math.random() * C)); };
    const bTrials = el('button', { class: 'btn', text: '🎲 Run 500 trials' });
    bTrials.onclick = () => runTrials();
    const bReset = el('button', { class: 'btn', text: 'Reset' });
    bReset.onclick = () => { opt.seed++; change(); };
    root.append(el('div', { class: 'w-controls' }, ...segs, bRand, bTrials, bReset));

    const stage = el('div', { class: 'w-stage' });
    root.append(stage);
    const legend = el('p', { class: 'muted', style: { margin: '6px 0 0', fontSize: '13px' } });
    const stats = el('div', { class: 'w-stats' });
    const log = el('div', { class: 'w-log', 'aria-live': 'polite' });
    root.append(stats, log);
    const say = (t) => { log.prepend(el('div', { html: t })); while (log.children.length > 30) log.lastChild.remove(); };

    function poisonCustomer(c) {
      poison = c; dead = new Set(workersOf(c));
      draw();
      let down = 0, deg = 0;
      for (let i = 0; i < C; i++) { if (i === c) continue; const s = statusOf(i, dead); if (s === 'down') down++; else if (s === 'deg') deg++; }
      say(`☠ Customer <b>#${c + 1}</b> uses worker${dead.size > 1 ? 's' : ''} <b>${[...dead].map((w) => 'w' + (w + 1)).join(', ')}</b> and crashes ${dead.size > 1 ? 'them' : 'it'}. Other customers: <b>${down}</b> fully down, <b>${deg}</b> degraded, <b>${C - 1 - down - deg}</b> untouched.`);
    }
    function killWorker(w) {
      if (poison >= 0) { poison = -1; dead = new Set(); }
      if (dead.has(w)) dead.delete(w); else dead.add(w);
      draw();
      say(dead.size ? `🔌 Hardware failure: worker${dead.size > 1 ? 's' : ''} <b>${[...dead].sort((a, b) => a - b).map((x) => 'w' + (x + 1)).join(', ')}</b> down. No customer is to blame, so nothing follows the traffic.` : 'All workers back.');
    }
    // Monte Carlo: fresh assignment each trial, poison one of 1,000 customers, measure who is fully down
    function runTrials() {
      let sumDown = 0, sumDeg = 0; const T = 500, M = 1000;
      for (let t = 0; t < T; t++) {
        const o = { mode: opt.mode, n: opt.n, k: opt.k, seed: 1000 + t * 31 + opt.seed };
        const d = new Set(workersOf(0, o));
        let down = 0, deg = 0;
        for (let i = 1; i < M; i++) { const s = statusOf(i, d, o); if (s === 'down') down++; else if (s === 'deg') deg++; }
        sumDown += down / (M - 1); sumDeg += deg / (M - 1);
      }
      trials = { down: sumDown / T, deg: sumDeg / T };
      paintStats();
      say(`🎲 500 trials × 1,000 customers: on average <b>${(trials.down * 100).toFixed(2)}%</b> of other customers fully down, <b>${(trials.deg * 100).toFixed(1)}%</b> degraded. Formula says <b>${(expected() * 100).toFixed(2)}%</b> fully down.`);
    }
    function paintStats() {
      let down = 0, deg = 0;
      const any = dead.size > 0;
      for (let i = 0; i < C; i++) { if (i === poison) continue; const s = statusOf(i, dead); if (s === 'down') down++; else if (s === 'deg') deg++; }
      const others = C - (poison >= 0 ? 1 : 0);
      const combos = opt.mode === 'none' ? 1 : opt.mode === 'cells' ? Math.floor(opt.n / opt.k) : comb(opt.n, opt.k);
      stats.innerHTML = '';
      [['fully down', any ? down + ' (' + Math.round(down / others * 100) + '%)' : '—'],
        ['degraded', any ? deg + ' (' + Math.round(deg / others * 100) + '%)' : '—'],
        ['distinct shards', combos.toLocaleString('en-US')],
        ['formula: down per poison', (expected() * 100).toFixed(expected() < 0.1 ? 2 : 0) + '%'],
        ['measured (trials)', trials ? (trials.down * 100).toFixed(2) + '%' : 'run trials']
      ].forEach(([k, v]) => stats.append(el('span', { class: 'w-stat', html: `${k}: <b>${v}</b>` })));
    }

    function draw() {
      stage.innerHTML = '';
      const rowsW = Math.ceil(opt.n / perRowW), bw = (W - 16) / perRowW, bh = 40;
      const top = 26, wH = rowsW * (bh + 8);
      const cTop = top + wH + 34, gap = (W - 16) / perRowC, rowsC = Math.ceil(C / perRowC);
      const H = cTop + rowsC * gap + 6;
      const S = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Workers and customers; tap a customer to poison it' });
      const T = (x, y, t, f, w, fill, a) => svg('text', { x, y, text: t, 'text-anchor': a || 'start', fill: fill || 'var(--text)', style: `font:${w || 600} ${f}px var(--sans);pointer-events:none` });
      S.append(T(8, 16, 'Workers (tap one to fail it)', 14, 700, 'var(--text-3)'));
      const groups = opt.mode === 'cells' ? Math.floor(opt.n / opt.k) : 0;
      const pw = poison >= 0 ? new Set(workersOf(poison)) : new Set();
      const wPos = [];
      for (let i = 0; i < opt.n; i++) {
        const x = 8 + (i % perRowW) * bw, y = top + Math.floor(i / perRowW) * (bh + 8);
        wPos.push([x + bw / 2 - 2, y + bh]);
        const isDead = dead.has(i);
        const inGroup = groups && i < groups * opt.k;
        const r = svg('rect', { x: x + 2, y, width: bw - 6, height: bh, rx: 7, fill: isDead ? 'var(--err)' : 'var(--surface-2)', 'fill-opacity': isDead ? 0.22 : 1,
          stroke: isDead ? 'var(--err)' : inGroup && Math.floor(i / opt.k) % 2 === 0 ? 'var(--accent)' : 'var(--border)', 'stroke-width': 2, style: 'cursor:pointer' });
        r.addEventListener('click', () => killWorker(i));
        S.append(r, T(x + bw / 2 - 1, y + 25, (isDead ? '✖ ' : '') + 'w' + (i + 1), narrow ? 13 : 14, 700, isDead ? 'var(--err)' : 'var(--text)', 'middle'));
      }
      S.append(T(8, cTop - 12, 'Customers (tap one to poison it)', 14, 700, 'var(--text-3)'));
      const rad = Math.min(13, gap / 2 - 3);
      for (let c = 0; c < C; c++) {
        const cx = 8 + (c % perRowC) * gap + gap / 2 - 2, cy = cTop + Math.floor(c / perRowC) * gap + gap / 2 - 4;
        const st = dead.size ? statusOf(c, dead) : 'idle';
        const fill = c === poison ? 'var(--text)' : st === 'down' ? 'var(--err)' : st === 'deg' ? 'var(--warn)' : st === 'ok' ? 'var(--ok)' : 'var(--surface-2)';
        if (c === poison) pw.forEach((w) => S.append(svg('line', { x1: cx, y1: cy, x2: wPos[w][0], y2: wPos[w][1], stroke: 'var(--err)', 'stroke-width': 1.5, 'stroke-dasharray': '4 3', opacity: 0.7 })));
        const d = svg('circle', { cx, cy, r: rad, fill, stroke: st === 'idle' && c !== poison ? 'var(--border)' : 'none', 'stroke-width': 1.5, style: 'cursor:pointer' });
        d.addEventListener('click', () => poisonCustomer(c));
        S.append(d);
        if (c === poison) S.append(T(cx, cy + 5, '☠', 14, 700, 'var(--surface)', 'middle'));
      }
      stage.append(S);
      legend.innerHTML = '<b style="color:var(--ok)">●</b> untouched &nbsp; <b style="color:var(--warn)">●</b> degraded: lost some of its workers, retries succeed &nbsp; <b style="color:var(--err)">●</b> fully down: lost all its workers &nbsp; ☠ poison customer. '
        + (opt.mode === 'none' ? 'Every customer uses every worker.' : opt.mode === 'cells' ? `Workers form ${groups} fixed groups of ${opt.k}; a customer lives in one group.` : `Each customer gets its own ${opt.k} of ${opt.n} workers.`);
      stage.append(legend);
      paintStats();
    }
    draw();
    say('Start with <b>No isolation</b> and poison a customer: everyone goes down. Then try <b>Cells / shards</b> and <b>Shuffle sharding</b> with the same settings.');
  }
  build(ctx.narrow);
  ctx.onResize(build);
});

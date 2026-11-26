(function () {
  'use strict';
  /* Shared step-through scaffold (copied per widget file, no globals).
     spec: { label, modes?: [[value, label]], modeLabel?, mode?, frames(mode) -> [{ cap, code?, lang?, stats?, lanes?, draw? }] }
     A frame draws the whole scene for that step; step 0 is the start state. */
  const KC = ['var(--k-service)', 'var(--k-store)', 'var(--k-queue)', 'var(--k-cache)', 'var(--k-ml)', 'var(--k-edge)', 'var(--k-compute)'];
  function stepper(root, ctx, spec) {
    const { el, svg, sleep, reduced } = ctx;
    let mode = spec.mode || (spec.modes ? spec.modes[0][0] : null); let frames = []; let k = 0; let gen = 0; let running = false; let speed = 2600;
    const mkSeg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
      opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
    const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
    const bStep = el('button', { class: 'btn', text: 'Step ›' });
    const bBack = el('button', { class: 'btn', text: '‹ Back' });
    const bReset = el('button', { class: 'btn', text: '↺ Reset' });
    const segS = mkSeg([[4000, 'Slow'], [2600, 'Normal'], [1300, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
    const codeHost = el('div', { style: { marginBottom: '10px' } });
    const stage = svg('svg', { viewBox: '0 0 760 200', role: 'img', 'aria-label': spec.label });
    const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('span', { class: 'n', text: '0' }), el('div', { class: 't', text: '' }));
    const stats = el('div', { class: 'w-stats' });
    const extra = el('div');
    if (spec.modes) root.append(el('div', { class: 'w-controls' }, mkSeg(spec.modes, () => mode, (v) => { mode = v; reset(); }, spec.modeLabel || 'Mode')));
    root.append(codeHost, el('div', { class: 'w-stage' }, stage),
      el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bBack, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats, extra);
    const S = (o) => Object.entries(o).map(([a, b]) => a + ':' + b).join(';');
    const h = {
      svg, el, KC,
      rect(x, y, w, hh, o = {}) { return svg('rect', { x, y, width: w, height: hh, rx: o.rx == null ? 7 : o.rx, style: S({ fill: o.fill || 'var(--surface-2)', stroke: o.stroke || 'var(--border)', 'stroke-width': o.sw || 1.2, 'stroke-dasharray': o.dash || 'none', opacity: o.op == null ? 1 : o.op }) }); },
      text(x, y, t, o = {}) { return svg('text', { x, y, 'text-anchor': o.anchor || 'start', text: String(t), style: S({ fill: o.fill || 'var(--text)', 'font-size': (o.size || 13) + 'px', 'font-weight': o.weight || 400, 'font-family': o.mono ? 'var(--mono)' : 'var(--sans)', opacity: o.op == null ? 1 : o.op }) }); },
      line(x1, y1, x2, y2, o = {}) { return svg('line', { x1, y1, x2, y2, 'marker-end': o.arrow === false ? null : 'url(#' + mid + ')', style: S({ stroke: o.stroke || 'var(--text-3)', 'stroke-width': o.sw || 1.5, 'stroke-dasharray': o.dash || 'none', opacity: o.op == null ? 1 : o.op }) }); },
      chip(x, y, w, t, c, o = {}) {
        const col = c == null ? 'var(--text-3)' : KC[c % KC.length]; const g = svg('g');
        g.append(svg('rect', { x, y, width: w, height: 22, rx: 6, style: S({ fill: o.ghost ? 'none' : 'color-mix(in srgb, ' + col + ' 20%, var(--surface))', stroke: col, 'stroke-width': o.hot ? 2.4 : 1.2, 'stroke-dasharray': o.ghost ? '4 3' : 'none', opacity: o.dim ? 0.35 : 1 }) }),
          h.text(x + w / 2, y + 15, t, { anchor: 'middle', size: 12, mono: true, op: o.dim ? 0.45 : 1 }));
        return g;
      },
      /* lanes: [{ title, sub?, rows: [ 'txt' | { t, c, hot, dim, ghost } ], hot? }] */
      lanes(g, lanes, y0, o = {}) {
        const n = lanes.length; const gap = 14; const x0 = o.x0 || 10; const W = (o.W || 740) - x0 + 10; const lw = (W - gap * (n - 1)) / n;
        let maxH = 0;
        lanes.forEach((L, i) => {
          const x = x0 + i * (lw + gap); const rows = L.rows || []; const hh = 44 + Math.max(1, rows.length) * 26 + 6; maxH = Math.max(maxH, hh);
          g.append(h.rect(x, y0, lw, hh, { stroke: L.hot ? 'var(--accent)' : 'var(--border)', sw: L.hot ? 2 : 1.2, fill: L.hot ? 'var(--accent-soft)' : 'var(--surface-2)', dash: L.dash }));
          g.append(h.text(x + 8, y0 + 18, L.title, { size: 12.5, weight: 700 }));
          if (L.sub) g.append(h.text(x + 8, y0 + 33, L.sub, { size: 11, fill: 'var(--text-3)' }));
          rows.forEach((r, j) => { const R = typeof r === 'string' ? { t: r } : r; g.append(h.chip(x + 8, y0 + 42 + j * 26, lw - 16, R.t, R.c, R)); });
          if (!rows.length) g.append(h.text(x + lw / 2, y0 + 58, '(empty)', { anchor: 'middle', size: 11.5, fill: 'var(--text-3)' }));
        });
        return y0 + maxH;
      }
    };
    const mid = 'ar' + Math.random().toString(36).slice(2, 8);
    function render() {
      const f = frames[k]; stage.innerHTML = '';
      const defs = svg('defs', null, svg('marker', { id: mid, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', style: 'fill:var(--text-3)' })));
      const g = svg('g'); stage.append(defs, g);
      let H = 200;
      if (f.lanes) { let y = 8; if (f.phase) { g.append(h.text(10, 20, f.phase, { size: 13, weight: 700, fill: 'var(--accent)' })); y = 32; } H = h.lanes(g, f.lanes, y) + 10; if (f.foot) { g.append(h.text(10, H + 8, f.foot, { size: 12, fill: 'var(--text-2)' })); H += 20; } }
      if (f.draw) H = f.draw(g, h) || H;
      stage.setAttribute('viewBox', `0 0 760 ${Math.ceil(H)}`);
      if (!reduced) { g.style.animation = 'capin .35s ease both'; }
      narr.querySelector('.n').textContent = k + '/' + (frames.length - 1);
      narr.querySelector('.t').innerHTML = f.cap; narr.querySelector('.t').style.animation = reduced ? 'none' : '';
      codeHost.innerHTML = ''; const code = f.code != null ? f.code : spec.code && spec.code(mode);
      if (code) codeHost.append(ctx.codeBox ? ctx.codeBox(code, f.lang || 'python') : el('pre', { text: code }));
      stats.innerHTML = ''; (f.stats || []).forEach(([l, v]) => stats.append(el('span', { class: 'w-stat', html: `${l} <b>${v}</b>` })));
      extra.innerHTML = ''; if (f.html) extra.append(el('div', { html: f.html }));
      bStep.disabled = k >= frames.length - 1; bBack.disabled = k === 0;
    }
    function stop() { running = false; bPlay.textContent = '▶ Play'; }
    function reset() { gen++; stop(); frames = spec.frames(mode); k = 0; render(); }
    bStep.addEventListener('click', () => { stop(); if (k < frames.length - 1) { k++; render(); } });
    bBack.addEventListener('click', () => { stop(); if (k > 0) { k--; render(); } });
    bReset.addEventListener('click', reset);
    bPlay.addEventListener('click', async () => {
      if (running) { stop(); return; }
      if (reduced) { k = frames.length - 1; render(); return; }
      if (k >= frames.length - 1) { k = 0; render(); }
      running = true; bPlay.textContent = '⏸ Pause'; const my = gen;
      while (running && my === gen && k < frames.length - 1) { await sleep(speed); if (!running || my !== gen) break; k++; render(); }
      if (my === gen) stop();
    });
    reset();
  }
  /* Partitions & shuffle: repartition vs coalesce, how a sort-based shuffle writes and fetches blocks, and what skew looks like. */
  IA.widget('partitions-shuffle', (root, ctx) => {
    const r = (t, c, o) => Object.assign({ t, c }, o || {});
    const IN = [{ title: 'p0', sub: '4 rows', rows: [r('r1 k=a', 0), r('r2 k=b', 1), r('r3 k=a', 0), r('r4 k=c', 2)] }, { title: 'p1', sub: '1 row', rows: [r('r5 k=b', 1)] }, { title: 'p2', sub: '0 rows', rows: [] }, { title: 'p3', sub: '3 rows', rows: [r('r6 k=a', 0), r('r7 k=c', 2), r('r8 k=a', 0)] }];
    const F = {
      repart: () => [
        { cap: 'Four input partitions of very different sizes (as after a selective filter). One task per partition: p0 does 4× the work of p1, p2 does nothing.', phase: 'Input: 4 partitions, uneven', lanes: IN, stats: [['partitions', 4], ['largest', '4 rows']] },
        { cap: '<code>df.repartition(3)</code>: a <b>full shuffle</b> with round-robin placement. Every row is written to shuffle files and fetched again, but the output is balanced. Plan: <code>Exchange RoundRobinPartitioning(3)</code>.', phase: 'repartition(3): round-robin', lanes: [{ title: 'out 0', hot: true, rows: [r('r1 k=a', 0), r('r4 k=c', 2), r('r7 k=c', 2)] }, { title: 'out 1', hot: true, rows: [r('r2 k=b', 1), r('r5 k=b', 1), r('r8 k=a', 0)] }, { title: 'out 2', hot: true, rows: [r('r3 k=a', 0), r('r6 k=a', 0)] }], stats: [['rows shuffled', 8], ['largest', '3 rows']] },
        { cap: '<code>df.repartition(3, "k")</code>: hash partitioning by key. Rows with the same key land together (useful before a join or a <code>partitionBy</code> write), but a hot key makes one partition big. Plan: <code>Exchange hashpartitioning(k, 3)</code>.', phase: 'repartition(3, "k"): hash(k) % 3', lanes: [{ title: 'out 0', sub: 'k=a', hot: true, rows: [r('r1 k=a', 0), r('r3 k=a', 0), r('r6 k=a', 0), r('r8 k=a', 0)] }, { title: 'out 1', sub: 'k=b', rows: [r('r2 k=b', 1), r('r5 k=b', 1)] }, { title: 'out 2', sub: 'k=c', rows: [r('r4 k=c', 2), r('r7 k=c', 2)] }], stats: [['rows shuffled', 8], ['largest', '4 rows (key a)']] }
      ],
      coal: () => [
        { cap: 'Same four input partitions. Goal: fewer output files.', phase: 'Input: 4 partitions', lanes: IN, stats: [['partitions', 4]] },
        { cap: '<code>df.coalesce(2)</code>: <b>no shuffle</b>. Spark just lets one task process several parent partitions (preferring ones on the same executor). Cheap, but it can’t split a big partition, so the result may stay uneven.', phase: 'coalesce(2): merge neighbours, narrow', lanes: [{ title: 'task 0 = p0 + p1', hot: true, rows: [r('r1 k=a', 0), r('r2 k=b', 1), r('r3 k=a', 0), r('r4 k=c', 2), r('r5 k=b', 1)] }, { title: 'task 1 = p2 + p3', hot: true, rows: [r('r6 k=a', 0), r('r7 k=c', 2), r('r8 k=a', 0)] }], stats: [['rows shuffled', 0], ['largest', '5 rows']] },
        { cap: '<b>The trap:</b> <code>expensive_df.coalesce(1).write…</code>. coalesce is narrow, so it lives in the <b>same stage</b> as the work above it. The entire upstream computation now runs in a single task on one core.', phase: 'coalesce(1): the whole stage collapses to 1 task', lanes: [{ title: 'task 0 = p0+p1+p2+p3 (and all upstream work)', hot: true, rows: [r('r1 … r8: 8 rows', 3, { hot: true }), r('scan + parse + join probe + …', 4), r('1 core busy, the rest idle', 5, { dim: true })] }], stats: [['tasks', 1], ['parallelism', 'lost']] },
        { cap: '<code>repartition(1)</code> instead adds a shuffle: upstream work stays parallel (4 tasks) and only the final write runs in one task. More I/O, often much faster overall. For “fewer files” prefer a moderate number (<code>coalesce(16)</code>) or AQE.', phase: 'repartition(1): parallel upstream, 1 writer', lanes: [{ title: 'stage A: 4 tasks', rows: [r('p0 → shuffle', 0), r('p1 → shuffle', 1), r('p2 → shuffle', 6), r('p3 → shuffle', 2)] }, { title: 'stage B: 1 task', hot: true, rows: [r('fetch all, write 1 file', 3, { hot: true })] }], stats: [['upstream tasks', 4], ['writer tasks', 1]] }
      ],
      shuffle: () => [
        { cap: '<b>Inside a shuffle.</b> Three map tasks (the stage before the Exchange) each hold rows for keys a, b, c. The next stage will have 3 reduce partitions.', phase: 'Map side: 3 tasks', lanes: [{ title: 'map task M0', rows: [r('a', 0), r('b', 1), r('a', 0)] }, { title: 'map task M1', rows: [r('c', 2), r('a', 0), r('b', 1)] }, { title: 'map task M2', rows: [r('a', 0), r('a', 0), r('c', 2)] }] },
        { cap: '<b>Shuffle write</b> (sort-based shuffle): each map task groups its output by target partition and writes <b>one data file + one index file</b> to its executor’s local disk. Spill to disk happens here if the buffer is full. UI metric: <i>Shuffle Write</i>.', phase: 'Each map task writes 1 file, segmented by reducer', lanes: [{ title: 'M0 file', sub: '[R0 | R1 | R2]', rows: [r('→R0: a a', 0), r('→R1: b', 1), r('→R2: –', 6, { ghost: true })] }, { title: 'M1 file', sub: '[R0 | R1 | R2]', rows: [r('→R0: a', 0), r('→R1: b', 1), r('→R2: c', 2)] }, { title: 'M2 file', sub: '[R0 | R1 | R2]', rows: [r('→R0: a a', 0), r('→R1: –', 6, { ghost: true }), r('→R2: c', 2)] }], stats: [['map tasks', 3], ['files', '3 data + 3 index']] },
        { cap: '<b>Shuffle read</b>: each reduce task fetches its segment from <b>every</b> map output, over the network (or locally). That is M × R block fetches: 3 × 3 here, 2,000 × 2,000 = 4 million in a big job. UI metric: <i>Shuffle Read</i>.', phase: 'Reduce side: fetch your block from every map file', lanes: [{ title: 'R0 (key a)', hot: true, rows: [r('a a ← M0', 0), r('a ← M1', 0), r('a a ← M2', 0)] }, { title: 'R1 (key b)', rows: [r('b ← M0', 1), r('b ← M1', 1)] }, { title: 'R2 (key c)', rows: [r('c ← M1', 2), r('c ← M2', 2)] }], stats: [['block fetches', 9], ['rows in R0', 5]] },
        { cap: '<b>Skew</b>: R0 got 5 of 9 rows because key a is hot. Its task runs longest and the stage waits for it. In the UI: task duration max ≫ median. AQE (3.2+ default on) can split skewed partitions in sort-merge joins and coalesce tiny ones; for aggregations, salting or pre-aggregation helps.', phase: 'One straggler holds the stage', lanes: [{ title: 'R0: 5 rows', hot: true, rows: [r('████████████ 50 s', 5, { hot: true })] }, { title: 'R1: 2 rows', rows: [r('████ 12 s', 1)] }, { title: 'R2: 2 rows', rows: [r('████ 12 s', 2)] }], stats: [['stage time', '= slowest task'], ['median task', '12 s']] }
      ]
    };
    const CODE = {
      repart: 'df.rdd.getNumPartitions()     # 4\ndf.repartition(3)             # round-robin, full shuffle\ndf.repartition(3, "k")        # hash by key, full shuffle',
      coal: 'df.coalesce(2)                # narrow: merge, no shuffle\ndf.coalesce(1).write.csv(p)   # trap: whole stage in 1 task\ndf.repartition(1).write.csv(p)',
      shuffle: 'df.groupBy("k").count()       # Exchange hashpartitioning(k, 200)\nspark.conf.set("spark.sql.shuffle.partitions", 400)'
    };
    stepper(root, ctx, { label: 'Partitions being repartitioned, coalesced and shuffled between tasks', modes: [['repart', 'repartition'], ['coal', 'coalesce'], ['shuffle', 'inside a shuffle + skew']], modeLabel: 'Mechanism', frames: (m) => F[m](), code: (m) => CODE[m] });
  });
})();

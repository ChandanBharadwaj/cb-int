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
  /* Transformations & aggregations: groupBy/agg (partial → shuffle → final), a shuffle join vs broadcast, and a window function. */
  IA.widget('transformations-aggregations', (root, ctx) => {
    const K = { a: 0, b: 1, c: 2, eng: 0, ops: 1, hr: 2 };
    const r = (t, key, o) => Object.assign({ t, c: K[key] }, o || {});
    const two = (top, bot, tTop, tBot) => (g, h) => {
      g.append(h.text(10, 18, tTop, { size: 12.5, weight: 700, fill: 'var(--accent)' }));
      const y1 = h.lanes(g, top, 26);
      g.append(h.text(10, y1 + 24, tBot, { size: 12.5, weight: 700, fill: 'var(--accent)' }));
      return h.lanes(g, bot, y1 + 32) + 10;
    };
    const F = {
      group: () => [
        { cap: '<code>df.groupBy("city").agg(F.sum("amt"))</code>. The data is already split into 3 partitions, one task each. Rows for the same city are scattered.', phase: 'Input: 3 partitions (narrow so far)',
          lanes: [{ title: 'p0', rows: [r('a 5', 'a'), r('b 3', 'b'), r('a 2', 'a')] }, { title: 'p1', rows: [r('b 4', 'b'), r('c 7', 'c'), r('a 1', 'a')] }, { title: 'p2', rows: [r('c 2', 'c'), r('b 1', 'b'), r('c 6', 'c')] }], stats: [['rows', 9]] },
        { cap: '<b>Partial aggregation</b> (<code>HashAggregate(partial_sum)</code>). Each task sums its own rows first, like a MapReduce combiner. p0 turns <code>a 5, a 2</code> into <code>a 7</code>. Less data to ship.', phase: 'Stage 1: partial sums inside each task',
          lanes: [{ title: 'p0', hot: true, rows: [r('a 7', 'a', { hot: true }), r('b 3', 'b')] }, { title: 'p1', hot: true, rows: [r('b 4', 'b'), r('c 7', 'c'), r('a 1', 'a')] }, { title: 'p2', hot: true, rows: [r('c 8', 'c', { hot: true }), r('b 1', 'b')] }], stats: [['rows to shuffle', 7], ['was', 9]] },
        { cap: '<b>Shuffle</b> (<code>Exchange hashpartitioning(city)</code>). Every partial row goes to partition <code>hash(city) % N</code>, so all rows of one city meet in one task. This is the stage boundary, and the expensive part: disk + network.', phase: 'Exchange: rows move by hash(key)',
          lanes: [{ title: 'shuffle part 0', sub: 'city a', rows: [r('a 7  ← p0', 'a'), r('a 1  ← p1', 'a')] }, { title: 'shuffle part 1', sub: 'city b', rows: [r('b 3  ← p0', 'b'), r('b 4  ← p1', 'b'), r('b 1  ← p2', 'b')] }, { title: 'shuffle part 2', sub: 'city c', rows: [r('c 7  ← p1', 'c'), r('c 8  ← p2', 'c')] }],
          foot: 'Real jobs: spark.sql.shuffle.partitions = 200 by default; AQE (on by default since 3.2) coalesces small ones.' },
        { cap: '<b>Final aggregation</b> merges the partial sums. One row per group comes out: a = 8, b = 8, c = 15. Same answer as <code>SELECT city, sum(amt) … GROUP BY city</code> in Postgres, just computed in two phases across machines.', phase: 'Stage 2: final sums',
          lanes: [{ title: 'part 0', hot: true, rows: [r('a 8', 'a', { hot: true })] }, { title: 'part 1', hot: true, rows: [r('b 8', 'b', { hot: true })] }, { title: 'part 2', hot: true, rows: [r('c 15', 'c', { hot: true })] }], stats: [['groups', 3], ['stages', 2], ['shuffles', 1]] }
      ],
      join: () => [
        { cap: '<code>orders.join(customers, "cid")</code>. Both sides are spread over partitions with no relation to <code>cid</code>. A match can only be found if both rows end up in the same task.',
          draw: two([{ title: 'orders p0', rows: [r('o1 cid=a', 'a'), r('o2 cid=b', 'b')] }, { title: 'orders p1', rows: [r('o3 cid=a', 'a'), r('o4 cid=c', 'c')] }], [{ title: 'customers p0', rows: [r('b Ben', 'b'), r('a Asha', 'a')] }, { title: 'customers p1', rows: [r('c Chen', 'c')] }], 'Left side (big)', 'Right side') },
        { cap: '<b>Sort-merge join, step 1: shuffle both sides</b> by <code>hash(cid)</code>. Same key → same partition number, on both sides. Two Exchanges in the plan.',
          draw: two([{ title: 'part 0', hot: true, rows: [r('o1 cid=a', 'a'), r('o3 cid=a', 'a')] }, { title: 'part 1', hot: true, rows: [r('o2 cid=b', 'b'), r('o4 cid=c', 'c')] }], [{ title: 'part 0', hot: true, rows: [r('a Asha', 'a')] }, { title: 'part 1', hot: true, rows: [r('c Chen', 'c'), r('b Ben', 'b')] }], 'orders after Exchange', 'customers after Exchange'), stats: [['shuffled rows', 7]] },
        { cap: '<b>Step 2: sort</b> each partition by key, then <b>merge</b> the two sorted streams, like a merge join in Postgres. Output: o1·Asha, o3·Asha, o2·Ben, o4·Chen.',
          draw: two([{ title: 'part 0 (sorted)', rows: [r('o1 a ⋈ Asha', 'a', { hot: true }), r('o3 a ⋈ Asha', 'a', { hot: true })] }, { title: 'part 1 (sorted)', rows: [r('o2 b ⋈ Ben', 'b', { hot: true }), r('o4 c ⋈ Chen', 'c', { hot: true })] }], [{ title: 'part 0 (sorted)', rows: [r('a Asha', 'a')] }, { title: 'part 1 (sorted)', rows: [r('b Ben', 'b'), r('c Chen', 'c')] }], 'SortMergeJoin output', 'customers (sorted)'), stats: [['rows out', 4]] },
        { cap: '<b>Broadcast hash join</b> instead: if one side is small (≤ <code>spark.sql.autoBroadcastJoinThreshold</code>, 10 MB by default), Spark ships a full copy to every executor and builds a hash table. The big side <b>never shuffles</b>.',
          draw: two([{ title: 'orders p0 (stays put)', rows: [r('o1 a ⋈ Asha', 'a'), r('o2 b ⋈ Ben', 'b')] }, { title: 'orders p1 (stays put)', rows: [r('o3 a ⋈ Asha', 'a'), r('o4 c ⋈ Chen', 'c')] }], [{ title: 'hash table copy #1', hot: true, rows: [r('a Asha', 'a'), r('b Ben', 'b'), r('c Chen', 'c')] }, { title: 'hash table copy #2', hot: true, rows: [r('a Asha', 'a'), r('b Ben', 'b'), r('c Chen', 'c')] }], 'BroadcastHashJoin: no Exchange on the big side', 'customers broadcast to each executor'), stats: [['shuffled rows', 0], ['broadcast copies', 2]] }
      ],
      win: () => [
        { cap: '<code>Window.partitionBy("dept").orderBy(F.desc("sal"))</code> with <code>F.rank()</code>. Like a Postgres window function: every input row stays, and gets a new column.', phase: 'Input',
          lanes: [{ title: 'p0', rows: [r('eng 120', 'eng'), r('ops 70', 'ops'), r('eng 90', 'eng')] }, { title: 'p1', rows: [r('hr 60', 'hr'), r('eng 120', 'eng'), r('ops 80', 'ops')] }], stats: [['rows', 6]] },
        { cap: '<b>Shuffle by the window partition key</b> (dept). Note: no partial aggregation is possible. Every row is shipped. One huge dept means one huge task.', phase: 'Exchange hashpartitioning(dept)',
          lanes: [{ title: 'part 0', sub: 'eng', rows: [r('eng 120', 'eng'), r('eng 90', 'eng'), r('eng 120', 'eng')] }, { title: 'part 1', sub: 'ops, hr', rows: [r('ops 70', 'ops'), r('hr 60', 'hr'), r('ops 80', 'ops')] }], stats: [['shuffled rows', 6]] },
        { cap: '<b>Sort</b> within each partition by (dept, sal desc). The physical plan shows <code>Sort</code> then <code>Window</code>.', phase: 'Sort [dept, sal DESC]',
          lanes: [{ title: 'part 0', rows: [r('eng 120', 'eng'), r('eng 120', 'eng'), r('eng 90', 'eng')] }, { title: 'part 1', rows: [r('hr 60', 'hr'), r('ops 80', 'ops'), r('ops 70', 'ops')] }] },
        { cap: '<b>Window</b> walks the sorted rows. Ties share a rank and leave a gap (1, 1, 3); <code>dense_rank</code> would give 1, 1, 2 and <code>row_number</code> 1, 2, 3. Still 6 rows out: windows do not collapse rows the way <code>groupBy</code> does.', phase: 'Window: rank() computed',
          lanes: [{ title: 'part 0', hot: true, rows: [r('eng 120 → 1', 'eng', { hot: true }), r('eng 120 → 1', 'eng', { hot: true }), r('eng 90  → 3', 'eng', { hot: true })] }, { title: 'part 1', hot: true, rows: [r('hr 60  → 1', 'hr', { hot: true }), r('ops 80 → 1', 'ops', { hot: true }), r('ops 70 → 2', 'ops', { hot: true })] }], stats: [['rows out', 6], ['shuffles', 1]] }
      ]
    };
    const CODE = {
      group: 'from pyspark.sql import functions as F\ndf.groupBy("city").agg(F.sum("amt").alias("total"))',
      join: 'orders.join(customers, "cid")            # sort-merge (both shuffle)\norders.join(F.broadcast(customers), "cid") # broadcast hash join',
      win: 'from pyspark.sql import Window\nw = Window.partitionBy("dept").orderBy(F.desc("sal"))\nemp.withColumn("rk", F.rank().over(w))'
    };
    stepper(root, ctx, { label: 'Partitions of rows moving through a Spark aggregation, join or window', modes: [['group', 'groupBy + agg'], ['join', 'join'], ['win', 'window function']], modeLabel: 'Operation', frames: (m) => F[m](), code: (m) => CODE[m] });
  });
})();

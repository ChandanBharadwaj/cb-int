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
  /* Lazy evaluation & the DAG: transformations only grow a plan; an action creates a job, cut into stages at shuffles, each stage run as one task per partition. */
  IA.widget('lazy-eval-dag', (root, ctx) => {
    const OPS = [['Scan', 'parquet'], ['Filter', 'status=paid'], ['Project', 'amt_eur'], ['HashAgg', 'partial'], ['Exchange', 'hash(city)'], ['HashAgg', 'final'], ['Exchange', 'range(rev)'], ['Sort', 'rev desc'], ['Write', 'parquet']];
    const SHUF = [4, 6];
    const STAGES = [{ a: 0, b: 3, n: 4, name: 'Stage 0' }, { a: 5, b: 5, n: 3, name: 'Stage 1' }, { a: 7, b: 8, n: 3, name: 'Stage 2' }];
    const BW = 76, GAP = 7.5, X = (i) => 10 + i * (BW + GAP), Y = 70;
    const scene = (o) => (g, h) => {
      g.append(h.text(10, 20, o.jobs ? `Jobs submitted: ${o.jobs}` : 'Jobs submitted: 0  (nothing has run)', { size: 13, weight: 700, fill: o.jobs ? 'var(--accent)' : 'var(--text-3)' }));
      g.append(h.text(10, 40, o.planLabel || 'Logical plan (driver memory only)', { size: 11.5, fill: 'var(--text-3)' }));
      if (o.stages) STAGES.forEach((s, si) => {
        const x = X(s.a) - 4, w = X(s.b) + BW - X(s.a) + 8; const st = o.stageState ? o.stageState[si] : 'wait';
        g.append(h.rect(x, Y - 12, w, 150, { fill: 'none', stroke: st === 'run' ? 'var(--accent)' : st === 'done' ? 'var(--ok)' : st === 'skip' ? 'var(--text-3)' : 'var(--border)', sw: st === 'run' ? 2.2 : 1.4, dash: st === 'skip' ? '5 4' : 'none' }));
        g.append(h.text(x + 6, Y + 76, s.name + (st === 'skip' ? ' (skipped)' : ''), { size: 11.5, weight: 700, fill: st === 'done' ? 'var(--ok)' : 'var(--text-2)' }));
        for (let t = 0; t < s.n; t++) {
          const done = st === 'done' || (st === 'run' && t < (o.running || 0));
          g.append(h.rect(x + 6 + t * 22, Y + 88, 18, 18, { rx: 4, fill: done ? 'var(--ok)' : st === 'run' ? 'var(--accent-soft)' : 'var(--surface-2)', stroke: st === 'run' ? 'var(--accent)' : 'var(--border)' }));
        }
        g.append(h.text(x + 6, Y + 124, s.n + ' tasks', { size: 10.5, fill: 'var(--text-3)' }));
      });
      OPS.slice(0, o.ops).forEach(([t, s], i) => {
        const sh = SHUF.includes(i); const isNew = i === o.ops - 1 && o.newOp;
        g.append(h.rect(X(i), Y, BW, 46, { fill: sh ? 'color-mix(in srgb, var(--warn) 16%, var(--surface))' : isNew ? 'var(--accent-soft)' : 'var(--surface-2)', stroke: sh ? 'var(--warn)' : isNew ? 'var(--accent)' : 'var(--border)', sw: isNew ? 2 : 1.2 }));
        g.append(h.text(X(i) + BW / 2, Y + 19, t, { anchor: 'middle', size: 12, weight: 700 }));
        g.append(h.text(X(i) + BW / 2, Y + 35, s, { anchor: 'middle', size: 10, fill: 'var(--text-3)' }));
        if (i > 0) g.append(h.line(X(i) - GAP, Y + 23, X(i) - 1, Y + 23, { sw: 1.2 }));
      });
      if (o.stages) g.append(h.text(10, Y + 160, 'Exchange (orange) = shuffle = stage boundary. Narrow operators inside a stage are pipelined: one task runs them all on one partition.', { size: 11.5, fill: 'var(--text-2)' }));
      return Y + 172;
    };
    const L = ['df = spark.read.parquet("s3://lake/orders/")', '  .filter(F.col("status") == "paid")', '  .withColumn("amt_eur", F.col("amt") * 0.92)', '  .groupBy("city").agg(F.sum("amt_eur").alias("rev"))', '  .orderBy(F.desc("rev"))', 'df.write.parquet("s3://out/rev/")      # ACTION'];
    const code = (n) => L.slice(0, n).join('\n');
    const frames = () => [
      { cap: '<code>spark.read.parquet(…)</code> returns a DataFrame immediately. Spark reads the schema from file metadata, but no data. The plan has one node.', code: code(1), draw: scene({ ops: 1, newOp: true }) },
      { cap: '<code>filter</code> is a <b>transformation</b>: it returns a new DataFrame with a bigger plan. Still no job. DataFrames are immutable descriptions of work.', code: code(2), draw: scene({ ops: 2, newOp: true }) },
      { cap: '<code>withColumn</code> adds a Project node. You could write 50 of these; it costs nothing until an action. (Hundreds in a loop do make the plan, and analysis, slow: prefer one <code>select</code>.)', code: code(3), draw: scene({ ops: 3, newOp: true }) },
      { cap: '<code>groupBy().agg()</code> adds an aggregate. Physically it becomes partial agg → <b>Exchange</b> (shuffle) → final agg.', code: code(4), draw: scene({ ops: 6, newOp: true }) },
      { cap: '<code>orderBy</code> needs a global order: a range-partitioning Exchange, then a sort per partition. Still zero jobs.', code: code(5), draw: scene({ ops: 9, newOp: true }) },
      { cap: '<code>write</code> is an <b>action</b>. Catalyst optimizes the whole plan, then the <b>DAG scheduler</b> creates a <b>job</b> and cuts it into <b>stages</b> at each shuffle. (A global <code>orderBy</code> also runs a small sampling job first, to pick range boundaries.)', code: code(6), draw: scene({ ops: 9, jobs: 1, stages: true, planLabel: 'Physical plan → DAG of stages' }) },
      { cap: 'Stage 0 runs first: <b>one task per input partition</b> (4 here). Each task does Scan → Filter → Project → partial agg in one pass, then writes shuffle files to local disk.', code: code(6), draw: scene({ ops: 9, jobs: 1, stages: true, stageState: ['run', 'wait', 'wait'], running: 2, planLabel: 'Physical plan → DAG of stages' }) },
      { cap: 'Stage 1 starts only when <b>all</b> of Stage 0 has finished: its tasks fetch shuffle blocks from every Stage-0 output. Then Stage 2 sorts and writes. One slow task delays the whole next stage.', code: code(6), draw: scene({ ops: 9, jobs: 1, stages: true, stageState: ['done', 'done', 'run'], running: 1, planLabel: 'Physical plan → DAG of stages' }) },
      { cap: 'A second action (say <code>df.count()</code>) is a <b>new job</b> that starts again from the source files, unless you <code>cache()</code>. The Spark UI may show stages as <i>skipped</i> when it can reuse shuffle files that are still on disk.', code: code(6) + '\ndf.count()                             # ACTION #2: new job', draw: scene({ ops: 9, jobs: 2, stages: true, stageState: ['done', 'done', 'done'], planLabel: 'Job 1 done; Job 2 replays the lineage' }) }
    ];
    stepper(root, ctx, { label: 'A DataFrame plan growing with each transformation, then split into stages and tasks by an action', frames });
  });
})();

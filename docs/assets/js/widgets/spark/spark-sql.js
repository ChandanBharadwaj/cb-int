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
  /* Spark SQL: SQL text and DataFrame code converge on one Catalyst pipeline (parse → analyze with the catalog → optimize → physical plan → codegen). */
  IA.widget('spark-sql', (root, ctx) => {
    const B = {
      sql: { x: 10, y: 14, t: 'SQL string', s: 'spark.sql("…")' },
      df: { x: 10, y: 84, t: 'DataFrame API', s: 'df.filter(…).groupBy(…)' },
      un: { x: 205, y: 49, t: 'Unresolved plan', s: 'names not checked yet' },
      an: { x: 400, y: 49, t: 'Analyzed plan', s: 'resolved via catalog' },
      cat: { x: 400, y: 140, t: 'Catalog', s: 'tables, views, functions' },
      op: { x: 595, y: 49, t: 'Optimized plan', s: 'Catalyst rules' },
      ph: { x: 205, y: 230, t: 'Physical plan', s: 'strategies + cost' },
      cg: { x: 400, y: 230, t: 'Whole-stage codegen', s: 'Java bytecode' },
      rdd: { x: 595, y: 230, t: 'RDDs → tasks', s: 'runs on executors' }
    };
    const BW = 155, BH = 48;
    const E = [['sql', 'un'], ['df', 'un'], ['un', 'an'], ['cat', 'an'], ['an', 'op'], ['op', 'ph'], ['ph', 'cg'], ['cg', 'rdd']];
    const scene = (hot, done, viewNote) => (g, h) => {
      E.forEach(([a, b]) => { const A = B[a], C = B[b];
        let x1 = A.x + BW, y1 = A.y + BH / 2, x2 = C.x, y2 = C.y + BH / 2;
        if (a === 'cat') { x1 = A.x + BW / 2; y1 = A.y; x2 = C.x + BW / 2; y2 = C.y + BH; }
        if (a === 'op') { x1 = A.x + BW / 2; y1 = A.y + BH; x2 = C.x + BW / 2; y2 = C.y; }
        const lit = done.includes(a) && (done.includes(b) || hot.includes(b));
        g.append(h.line(x1, y1, x2, y2 - (a === 'op' ? 2 : 0), { stroke: lit ? 'var(--accent)' : 'var(--text-3)', op: lit ? 1 : 0.5, sw: lit ? 2 : 1.3 })); });
      Object.entries(B).forEach(([id, b]) => {
        const on = hot.includes(id), d = done.includes(id);
        g.append(h.rect(b.x, b.y, BW, BH, { fill: on ? 'var(--accent-soft)' : 'var(--surface-2)', stroke: on ? 'var(--accent)' : d ? 'var(--ok)' : 'var(--border)', sw: on ? 2.2 : 1.2, dash: id === 'cat' ? '5 3' : 'none' }));
        g.append(h.text(b.x + 10, b.y + 20, b.t, { size: 13, weight: 700 }));
        g.append(h.text(b.x + 10, b.y + 37, b.s, { size: 11, fill: 'var(--text-3)', mono: id === 'sql' || id === 'df' }));
      });
      g.append(h.text(10, 205, 'Catalyst optimizer (inside the driver JVM)', { size: 11.5, fill: 'var(--text-3)' }));
      if (viewNote) g.append(h.text(10, 165, viewNote, { size: 11.5, fill: 'var(--warn)', weight: 700 }));
      return 290;
    };
    const SQLQ = 'orders.createOrReplaceTempView("orders")\nspark.sql("""\n  SELECT city, sum(amt) AS revenue\n  FROM orders WHERE status = \'paid\'\n  GROUP BY city""")';
    const DFQ = 'orders.filter(F.col("status") == "paid") \\\n      .groupBy("city").agg(F.sum("amt").alias("revenue"))';
    const frames = (m) => {
      const src = m === 'sql' ? 'sql' : 'df';
      return [
        { cap: m === 'sql' ? 'A SQL query over a <b>temp view</b>. The view is just a name in the session catalog pointing at the DataFrame’s plan; nothing is copied.' : 'The same query written with the DataFrame API. Each method call adds a node to a logical plan.', code: m === 'sql' ? SQLQ : DFQ, draw: scene([src], [], m === 'sql' ? 'temp view "orders" → registered in catalog' : null) },
        { cap: m === 'sql' ? 'The <b>parser</b> (ANTLR grammar) turns the SQL text into an <b>unresolved logical plan</b>. A syntax error fails here, before any data is read.' : 'The DataFrame API skips the parser: it builds the unresolved logical plan directly. From here on, SQL and DataFrames are <b>the same thing</b>.', code: "'Aggregate ['city], ['city, 'sum('amt) AS revenue]\n+- 'Filter ('status = paid)\n   +- 'UnresolvedRelation [orders]", lang: 'text', draw: scene(['un'], [src]) },
        { cap: 'The <b>analyzer</b> resolves names against the <b>catalog</b>: which table is <code>orders</code>, what type is <code>amt</code>, which function is <code>sum</code>. A typo in a column name fails here with <code>[UNRESOLVED_COLUMN]</code>, still at plan time.', code: 'Aggregate [city#3], [city#3, sum(amt#2) AS revenue#9]\n+- Filter (status#4 = paid)\n   +- Relation [cid#1,amt#2,city#3,status#4,ts#5] parquet', lang: 'text', draw: scene(['an', 'cat'], [src, 'un']) },
        { cap: 'The <b>optimizer</b> applies rule batches: <b>predicate pushdown</b> (filter moved into the scan), <b>column pruning</b> (only 3 of 5 columns read), constant folding, and more. It rewrites the tree; the meaning stays the same.', code: 'Aggregate [city#3], [city#3, sum(amt#2) AS revenue#9]\n+- Project [amt#2, city#3]\n   +- Filter (isnotnull(status#4) AND (status#4 = paid))\n      +- Relation [amt#2,city#3,status#4] parquet', lang: 'text', draw: scene(['op'], [src, 'un', 'an', 'cat']) },
        { cap: '<b>Physical planning</b> picks operators: <code>HashAggregate</code> partial/final around an <code>Exchange</code>, a <code>FileScan</code> with <code>PushedFilters</code>. Join strategies are chosen here too. With AQE (default since 3.2) the plan can still change at runtime.', code: "AdaptiveSparkPlan isFinalPlan=false\n+- HashAggregate(keys=[city#3], functions=[sum(amt#2)])\n   +- Exchange hashpartitioning(city#3, 200)\n      +- HashAggregate(keys=[city#3], functions=[partial_sum(amt#2)])\n         +- Project [amt#2, city#3]\n            +- Filter (isnotnull(status#4) AND (status#4 = paid))\n               +- FileScan parquet [amt#2,city#3,status#4]\n                  PushedFilters: [IsNotNull(status), EqualTo(status,paid)]", lang: 'text', draw: scene(['ph'], [src, 'un', 'an', 'cat', 'op']) },
        { cap: '<b>Whole-stage code generation</b> fuses the operators between shuffles into one generated Java function per stage (the <code>*(1)</code> markers in <code>explain()</code>), compiled with Janino. Then Spark builds RDDs and runs tasks. Both front ends end up with identical bytecode.', code: 'df.explain("codegen")      # print generated code\ndf.explain("formatted")    # readable physical plan\nspark.sql("EXPLAIN EXTENDED SELECT …")', draw: scene(['cg', 'rdd'], [src, 'un', 'an', 'cat', 'op', 'ph']) }
      ];
    };
    stepper(root, ctx, { label: 'Catalyst pipeline from SQL or DataFrame code to executed tasks', modes: [['sql', 'Start from SQL'], ['df', 'Start from DataFrame API']], modeLabel: 'Front end', frames });
  });
})();

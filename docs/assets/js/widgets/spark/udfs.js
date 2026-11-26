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
  /* UDFs: built-in expression vs row-at-a-time Python UDF (pickle) vs pandas UDF (Arrow batches) inside one executor. */
  IA.widget('udfs', (root, ctx) => {
    const ROWS = ['alice', 'bob', 'chen', 'dina', 'eve', 'femi'];
    const scene = (o) => (g, h) => {
      g.append(h.rect(10, 10, 300, 250, { fill: 'var(--surface-2)', stroke: o.jvmHot ? 'var(--accent)' : 'var(--border)', sw: o.jvmHot ? 2 : 1.2 }));
      g.append(h.text(22, 32, 'Executor JVM (task thread)', { size: 13, weight: 700 }));
      g.append(h.text(22, 48, o.jvmSub || 'rows in Tungsten binary format', { size: 11, fill: 'var(--text-3)' }));
      ROWS.forEach((r, i) => g.append(h.chip(22, 60 + i * 30, 130, r, 1, { dim: o.dimIn && o.dimIn(i) })));
      (o.out || []).forEach((r, i) => g.append(h.chip(168, 60 + i * 30, 130, r, 0, { hot: true })));
      g.append(h.text(168, 248, o.out && o.out.length ? 'output column' : '', { size: 11, fill: 'var(--text-3)' }));
      const py = o.py !== false;
      g.append(h.rect(450, 10, 300, 250, { fill: py ? 'var(--surface-2)' : 'none', stroke: o.pyHot ? 'var(--accent)' : 'var(--border)', sw: o.pyHot ? 2 : 1.2, dash: py ? 'none' : '5 4', op: py ? 1 : 0.5 }));
      g.append(h.text(462, 32, 'Python worker process', { size: 13, weight: 700, op: py ? 1 : 0.5 }));
      g.append(h.text(462, 48, py ? (o.pySub || 'pyspark.worker, one per task slot') : 'not started: nothing to do', { size: 11, fill: 'var(--text-3)' }));
      (o.pyRows || []).forEach((r, i) => g.append(h.chip(462, 60 + i * 30, 276, r, 2, { hot: true })));
      if (o.wire) {
        g.append(h.line(312, 110, 446, 110, { stroke: 'var(--warn)', sw: 2 }));
        g.append(h.line(446, 170, 312, 170, { stroke: 'var(--ok)', sw: 2 }));
        g.append(h.text(380, 100, o.wire, { anchor: 'middle', size: 11.5, weight: 700, fill: 'var(--warn)' }));
        g.append(h.text(380, 190, o.back || '', { anchor: 'middle', size: 11.5, weight: 700, fill: 'var(--ok)' }));
        (o.flying || []).forEach((t, i) => g.append(h.chip(330, 120 + i * 0, 100, t, 3)));
      }
      if (o.inline) { g.append(h.rect(160, 205, 140, 26, { fill: 'var(--accent-soft)', stroke: 'var(--accent)' })); g.append(h.text(230, 222, o.inline, { anchor: 'middle', size: 11.5, mono: true })); }
      return 272;
    };
    const UP = ROWS.map((r) => r.toUpperCase());
    const F = {
      builtin: () => [
        { cap: '<code>df.withColumn("u", F.upper("name"))</code>. A <b>built-in</b> function is a Catalyst expression. The optimizer understands it.', draw: scene({ py: false }), stats: [['Python calls', 0]] },
        { cap: 'Whole-stage codegen compiles <code>upper(name)</code> straight into the task’s generated Java code. Rows never leave the JVM or the binary format.', draw: scene({ py: false, jvmHot: true, inline: 'UTF8String.toUpperCase', out: UP.slice(0, 3) }), stats: [['Python calls', 0], ['serialization', 'none']] },
        { cap: 'Done. No Python process, no copying, and the optimizer can still push filters past it or prune columns. <b>Reach for <code>pyspark.sql.functions</code> first.</b>', draw: scene({ py: false, out: UP }), stats: [['Python calls', 0], ['plan node', 'Project']] }
      ],
      py: () => [
        { cap: '<code>@F.udf("string") def up(s): return s.upper()</code>. To Catalyst this is a <b>black box</b>: it can’t see inside, can’t push filters through it, can’t codegen it.', draw: scene({ pySub: 'idle' }), stats: [['Python calls', 0]] },
        { cap: 'The task <b>serializes rows</b> (pickle, in small batches) and writes them over a local socket to a separate Python worker. In the plan: <code>BatchEvalPython</code>.', draw: scene({ jvmHot: true, wire: 'pickled rows →', flying: ['alice,bob…'], dimIn: (i) => i < 3 }), stats: [['serialization', 'pickle']] },
        { cap: 'Python <b>unpickles</b> and calls <code>up()</code> <b>once per row</b>: interpreter overhead per value, single-threaded per worker.', draw: scene({ pyHot: true, pyRows: ['up("alice") → "ALICE"', 'up("bob") → "BOB"', 'up("chen") → "CHEN"', 'up("dina") → "DINA"', 'up("eve") → "EVE"', 'up("femi") → "FEMI"'], wire: 'pickled rows →' }), stats: [['Python calls', 6], ['per row', 'yes']] },
        { cap: 'Results are pickled back and converted to JVM rows. The JVM and Python both hold buffers, and the Python worker’s memory is outside the JVM heap (counted against executor overhead / <code>spark.executor.pyspark.memory</code>).', draw: scene({ wire: 'pickled rows →', back: '← pickled results', out: UP }), stats: [['Python calls', 6], ['copies', '2 × serialize']] },
        { cap: 'Spark 3.5+ can run the same UDF with Arrow instead of pickle (<code>@F.udf(..., useArrow=True)</code> or <code>spark.sql.execution.pythonUDF.arrow.enabled</code>). It removes most serialization cost, but still calls Python once per row.', draw: scene({ out: UP, wire: 'Arrow batches →', back: '← Arrow' }), stats: [['Python calls', 6], ['serialization', 'Arrow (3.5+ opt-in)']] }
      ],
      pandas: () => [
        { cap: '<code>@F.pandas_udf("string") def up(s: pd.Series) -> pd.Series: return s.str.upper()</code>. Still opaque to Catalyst, but <b>vectorized</b>.', draw: scene({ pySub: 'idle' }), stats: [['Python calls', 0]] },
        { cap: 'The task converts a whole batch of the column to an <b>Arrow record batch</b> (columnar, up to <code>spark.sql.execution.arrow.maxRecordsPerBatch</code> = 10,000 rows by default). Plan node: <code>ArrowEvalPython</code>.', draw: scene({ jvmHot: true, wire: 'Arrow batch →', flying: ['[6 values]'] }), stats: [['serialization', 'Arrow']] },
        { cap: 'Python receives a <code>pd.Series</code> and calls <code>up()</code> <b>once per batch</b>. <code>s.str.upper()</code> loops in pandas/numpy code, not in the interpreter per value.', draw: scene({ pyHot: true, pyRows: ['up(Series[6]) → Series[6]'], wire: 'Arrow batch →' }), stats: [['Python calls', 1], ['per row', 'no']] },
        { cap: 'The result batch comes back as Arrow and is copied into JVM rows. Typically much faster than a row-at-a-time UDF, still slower than a built-in. Your function must handle a whole Series and return one of the same length.', draw: scene({ wire: 'Arrow batch →', back: '← Arrow batch', out: UP }), stats: [['Python calls', 1], ['copies', '2 × Arrow']] }
      ]
    };
    const CODE = {
      builtin: 'df.withColumn("u", F.upper("name"))',
      py: '@F.udf("string")\ndef up(s):\n    return s.upper() if s is not None else None\ndf.withColumn("u", up("name"))',
      pandas: 'import pandas as pd\n@F.pandas_udf("string")\ndef up(s: pd.Series) -> pd.Series:\n    return s.str.upper()\ndf.withColumn("u", up("name"))'
    };
    stepper(root, ctx, { label: 'An executor JVM and a Python worker exchanging rows for a UDF', modes: [['builtin', 'built-in function'], ['py', 'Python UDF'], ['pandas', 'pandas UDF']], modeLabel: 'Function kind', frames: (m) => F[m](), code: (m) => CODE[m] });
  });
})();

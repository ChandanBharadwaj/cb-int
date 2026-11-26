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
  /* Nulls, types & dates: three-valued logic, legacy vs ANSI casts (3.x vs 4.0 defaults), and one instant seen through different session time zones. */
  IA.widget('nulls-types-dates', (root, ctx) => {
    const table = (cols, xs, rows, n) => (g, h) => {
      cols.forEach((c, i) => g.append(h.text(xs[i], 20, c, { size: 11.5, weight: 700, fill: 'var(--text-3)' })));
      rows.forEach((r, j) => {
        const y = 32 + j * 30; const shown = j < n; const hot = j === n - 1;
        g.append(h.rect(4, y, 752, 26, { fill: hot ? 'var(--accent-soft)' : 'var(--surface-2)', stroke: hot ? 'var(--accent)' : 'var(--border)', op: shown ? 1 : 0.35 }));
        r.forEach((v, i) => {
          const isRes = i > 0; const txt = isRes && !shown ? '?' : v;
          const col = !isRes ? 'var(--text)' : /error|ERROR|_OVERFLOW|_INPUT|BY_ZERO/.test(v) ? 'var(--err)' : v === 'NULL' || /dropped|skip|no match/.test(v) ? 'var(--warn)' : 'var(--ok)';
          g.append(h.text(xs[i], y + 17, txt, { size: 12, mono: i < 3, fill: shown ? col : 'var(--text-3)', weight: isRes ? 700 : 400 }));
        });
      });
      return 40 + rows.length * 30;
    };
    const NULLR = [
      ['NULL = NULL', 'NULL', 'unknown, not true'],
      ['NULL <=> NULL   (eqNullSafe)', 'true', 'null-safe equality'],
      ['NULL AND false', 'false', 'false wins'],
      ['NULL OR true', 'true', 'true wins'],
      ['filter(col("c") != "x"), c NULL', 'row dropped', 'NULL is not true'],
      ['count("c") vs count("*")', 'skips NULL', 'count(*) counts rows'],
      ['sum("c") over only NULLs', 'NULL', 'not 0: use coalesce'],
      ['groupBy("c"): NULL keys', 'one NULL group', 'like Postgres'],
      ['join on c = c, both NULL', 'no match', 'use eqNullSafe']
    ];
    const NCAP = ['Spark follows SQL three-valued logic, exactly like Postgres. Step through each expression and predict before it is revealed.',
      '<code>NULL = NULL</code> is NULL (unknown). In Python, <code>None == None</code> is True, which is why PySpark surprises people.',
      '<code>&lt;=&gt;</code> (<code>col.eqNullSafe(other)</code>) is Postgres’ <code>IS NOT DISTINCT FROM</code>.',
      'AND: if one side is false, the result is false regardless of NULL.',
      'OR: if one side is true, the result is true.',
      'The classic trap. <code>!=</code> on a NULL gives NULL, and <code>filter</code> keeps only true. Rows with NULL disappear. Use <code>~col.eqNullSafe("x")</code> or add <code>| col.isNull()</code>.',
      'Aggregates ignore NULLs, except <code>count("*")</code>.',
      '<code>sum</code>, <code>avg</code>, <code>max</code> of nothing (or only NULLs) is NULL.',
      'Grouping treats NULLs as one group.',
      'Join keys use <code>=</code>, so NULL keys never match. Many NULL keys also all hash to the same shuffle partition: skew.'];
    const CASTR = [
      ["CAST('12a' AS INT)", 'NULL', '[CAST_INVALID_INPUT] error'],
      ["try_cast('12a' AS INT)", 'NULL', 'NULL'],
      ['2147483647 + 1   (int)', '-2147483648', '[ARITHMETIC_OVERFLOW] error'],
      ['1 / 0', 'NULL', '[DIVIDE_BY_ZERO] error'],
      ['1 / 2', '0.5', '0.5'],
      ['1 div 2', '0', '0'],
      ['CAST(3.99 AS INT)', '3', '3'],
      ["CAST('2024-02-30' AS DATE)", 'NULL', '[CAST_INVALID_INPUT] error']
    ];
    const CCAP = ['Same SQL, two defaults: Spark 3.x had <code>spark.sql.ansi.enabled=false</code>; Spark 4.0 turns it <b>on</b>. Step to compare.',
      'Legacy mode hides bad data as NULL. ANSI mode fails the query and tells you the value.',
      '<code>try_cast</code> (3.2+) gives NULL in both modes: use it when NULL is the intended answer.',
      'Integer overflow silently wrapped in legacy mode. Money columns should be <code>DECIMAL</code> or <code>LONG</code> anyway.',
      'Division by zero: NULL vs error. <code>try_divide</code> returns NULL in both.',
      'Unlike Postgres (<code>1/2 = 0</code>), Spark’s <code>/</code> always returns a fractional type (double, or decimal for decimals).',
      '<code>div</code> is integer division, like Postgres’ <code>/</code> on integers.',
      'Casting to INT truncates toward zero; it doesn’t round. Postgres rounds here (gives 4): a porting trap.',
      'Invalid dates: NULL in legacy mode, error in ANSI mode. Parse with <code>try_to_timestamp</code> / <code>to_date</code> and an explicit format.'];
    const TZ = [
      { tz: 'UTC', cap: 'Spark’s <code>TIMESTAMP</code> (= <code>TIMESTAMP_LTZ</code>) stores an <b>instant</b>: microseconds since 1970-01-01 UTC. Here: an order placed at 23:30 UTC on 30 March 2024.', show: '2024-03-30 23:30:00', date: '2024-03-30' },
      { tz: 'Europe/Berlin', cap: 'Change <code>spark.sql.session.timeZone</code> to Europe/Berlin. The stored value is the same, but <code>show()</code>, <code>cast to string</code>, <code>hour()</code> and <code>to_date()</code> now use Berlin time (CET, UTC+1 before the DST switch at 01:00 UTC on 31 March).', show: '2024-03-31 00:30:00', date: '2024-03-31' },
      { tz: 'Europe/Berlin', cap: 'Consequence: <code>groupBy(to_date("ts"))</code> puts this order on a <b>different day</b> depending on session time zone. Daily revenue reports disagree between two clusters with different defaults.', show: '2024-03-31 00:30:00', date: '2024-03-31', warn: true },
      { tz: 'America/New_York', cap: 'If you never set it, the session time zone defaults to the <b>driver JVM’s</b> zone (<code>user.timezone</code>). Laptop, CI and cluster can all differ. Set it explicitly, usually to UTC.', show: '2024-03-30 19:30:00', date: '2024-03-30' },
      { tz: 'any', cap: '<code>TIMESTAMP_NTZ</code> (Spark 3.4+) stores a <b>wall-clock</b> value with no zone, like Postgres <code>timestamp without time zone</code>. It displays the same in every session zone, and it is not an instant.', show: '2024-03-30 23:30:00 (NTZ)', date: '2024-03-30', ntz: true }
    ];
    const tzDraw = (f, i) => (g, h) => {
      g.append(h.text(10, 22, 'Stored value (same in every step)', { size: 11.5, weight: 700, fill: 'var(--text-3)' }));
      g.append(h.rect(10, 30, 740, 34, { fill: 'var(--surface-2)' }));
      g.append(h.text(22, 52, f.ntz ? 'LocalDateTime 2024-03-30T23:30:00 (no zone)' : '1711841400000000 µs since epoch  =  2024-03-30T23:30:00Z', { size: 12.5, mono: true }));
      const x0 = 30, x1 = 730; const y = 110;
      g.append(h.line(x0, y, x1, y, { arrow: true }));
      for (let k = 0; k <= 6; k++) { const x = x0 + k * (x1 - x0) / 6; g.append(h.line(x, y - 5, x, y + 5, { arrow: false })); g.append(h.text(x, y + 20, ['20:00', '21:00', '22:00', '23:00', '00:00', '01:00', '02:00'][k] + ' UTC', { anchor: 'middle', size: 10.5, fill: 'var(--text-3)' })); }
      const xe = x0 + 3.5 * (x1 - x0) / 6;
      g.append(svg('circle', { cx: xe, cy: y, r: 7, style: 'fill:var(--accent)' }));
      g.append(h.text(xe, y - 14, 'order placed', { anchor: 'middle', size: 11.5, weight: 700, fill: 'var(--accent)' }));
      const xm = x0 + 4 * (x1 - x0) / 6;
      g.append(h.line(xm, y - 30, xm, y + 30, { arrow: false, dash: '4 3', stroke: 'var(--warn)' }));
      g.append(h.text(xm + 4, y + 40, 'UTC midnight', { size: 10.5, fill: 'var(--warn)' }));
      g.append(h.text(10, 180, 'session time zone', { size: 11.5, fill: 'var(--text-3)' }));
      g.append(h.text(10, 200, f.tz, { size: 14, weight: 700, mono: true }));
      g.append(h.text(260, 180, 'show(ts)', { size: 11.5, fill: 'var(--text-3)' }));
      g.append(h.text(260, 200, f.show, { size: 14, weight: 700, mono: true }));
      g.append(h.text(560, 180, 'to_date(ts)', { size: 11.5, fill: 'var(--text-3)' }));
      g.append(h.text(560, 200, f.date, { size: 14, weight: 700, mono: true, fill: f.warn ? 'var(--err)' : 'var(--text)' }));
      g.append(h.text(10, 226, 'step ' + (i + 1) + ' of ' + TZ.length, { size: 10.5, fill: 'var(--text-3)' }));
      return 236;
    };
    const { svg } = ctx;
    const F = {
      nulls: () => NCAP.map((cap, n) => ({ cap, draw: table(['expression', 'result', 'why'], [12, 330, 500], NULLR, n) })),
      casts: () => CCAP.map((cap, n) => ({ cap, lang: 'sql', draw: table(['expression', 'Spark 3.x default (ANSI off)', 'Spark 4.0 default (ANSI on)'], [12, 270, 470], CASTR, n) })),
      tz: () => TZ.map((f, i) => ({ cap: f.cap, draw: tzDraw(f, i), code: f.ntz ? 'df.withColumn("local", F.col("ts_string").cast("timestamp_ntz"))' : `spark.conf.set("spark.sql.session.timeZone", "${f.tz}")\ndf.select("ts", F.to_date("ts")).show()` }))
    };
    stepper(root, ctx, { label: 'Null logic, cast behaviour and time-zone rendering in Spark', modes: [['nulls', 'NULL logic'], ['casts', 'casts: 3.x vs 4.0'], ['tz', 'time zones']], modeLabel: 'Topic', frames: (m) => F[m]() });
  });
})();

/* OLTP vs OLAP: the same 6×5 table laid out as row pages or column blocks; animate a point lookup vs an aggregate and count values read vs needed. */
IA.widget('oltp-vs-olap', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-ovo-style')) document.head.append(el('style', { id: 'w-ovo-style', html: `
.w-ovo-pages { display: grid; gap: 8px; }
.w-ovo-pages.row { grid-template-columns: 1fr; }
.w-ovo-pages.col { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.w-ovo-pg { border: 2px solid var(--border); border-radius: 10px; padding: 6px; background: var(--surface-2); transition: all .3s; min-width: 0; }
.w-ovo-pg.read { border-color: var(--accent); background: var(--accent-soft); }
.w-ovo-pg h6 { margin: 0 0 4px; font-size: 11px; font-family: var(--mono); color: var(--text-3); font-weight: 600; }
.w-ovo-cells { display: grid; gap: 3px; }
.w-ovo-c { font-family: var(--mono); font-size: 11.5px; padding: 3px 4px; border-radius: 5px; background: var(--surface); border: 1px solid var(--border); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: all .3s; }
.w-ovo-c.r { border-color: var(--warn); color: var(--text-3); }
.w-ovo-c.n { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 18%, var(--surface)); color: var(--text); font-weight: 700; }
.w-ovo-c.z { grid-column: 1 / -1; background: var(--surface); border-style: dashed; }
.w-ovo-out { font-family: var(--mono); font-size: 13px; margin-top: 8px; }
` }));
  const COLS = ['id', 'region', 'sku', 'qty', 'amount'];
  const D = [[1, 'EU', 'A-7', 2, 40], [2, 'EU', 'B-1', 1, 15], [3, 'US', 'A-7', 5, 100], [4, 'US', 'C-3', 1, 60], [5, 'APAC', 'B-1', 2, 30], [6, 'APAC', 'A-7', 3, 60]];
  let lay = 'row', q = 'agg', comp = false, gen = 0, k = 0, frames = [], running = false, speed = 2400;
  const Q = { point: { sql: 'SELECT * FROM sales WHERE id = 4;', need: [0, 1, 2, 3, 4], rows: [3] }, agg: { sql: 'SELECT sum(amount) FROM sales;', need: [4], rows: [0, 1, 2, 3, 4, 5] }, group: { sql: 'SELECT region, sum(amount) FROM sales GROUP BY region;', need: [1, 4], rows: [0, 1, 2, 3, 4, 5] } };
  const mkSeg = (label, items, cur, on) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const sql = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const pages = el('div', { class: 'w-ovo-pages' });
  const out = el('div', { class: 'w-ovo-out' });
  const stats = el('div', { class: 'w-stats' });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }), bStep = el('button', { class: 'btn', text: 'Step ›' }), bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const compSeg = mkSeg('Compression', [[false, 'Plain'], [true, 'Compressed']], comp, (v) => { comp = v; reset(); });
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'layout' }), mkSeg('Layout', [['row', 'Row store (OLTP)'], ['col', 'Column store (OLAP)']], lay, (v) => { lay = v; reset(); })),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'query' }), mkSeg('Query', [['point', 'Read one row'], ['agg', 'SUM(amount)'], ['group', 'GROUP BY region']], q, (v) => { q = v; reset(); }),
      el('span', { class: 'tiny', text: 'columns' }), compSeg),
    sql, el('div', { class: 'w-stage' }, pages, out), stats,
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), mkSeg('Speed', [[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], 2400, (v) => { speed = v; })), cap);

  let P = [], cell = {}, cnt = { pages: 0, read: 0, need: 0 };
  const rle = (vals) => { const o = []; vals.forEach((v) => { const l = o[o.length - 1]; if (l && l[0] === v) l[1]++; else o.push([v, 1]); }); return o.map(([v, n]) => (n > 1 ? `${v}×${n}` : String(v))); };
  function draw() {
    pages.className = 'w-ovo-pages ' + lay; pages.innerHTML = ''; P = []; cell = {};
    if (lay === 'row') {
      for (let p = 0; p < 3; p++) { const cells = el('div', { class: 'w-ovo-cells', style: { gridTemplateColumns: 'repeat(5, minmax(0,1fr))' } });
        [2 * p, 2 * p + 1].forEach((r) => COLS.forEach((c, ci) => { const n = el('div', { class: 'w-ovo-c', text: String(D[r][ci]), title: c }); cell[r + ':' + ci] = n; cells.append(n); }));
        const pg = el('div', { class: 'w-ovo-pg' }, el('h6', { text: `page ${p} · rows ${2 * p + 1}–${2 * p + 2} · all 5 columns` }), cells); P.push(pg); pages.append(pg); }
    } else {
      COLS.forEach((c, ci) => { const cells = el('div', { class: 'w-ovo-cells' }); const vals = D.map((r) => r[ci]);
        const packed = comp && (ci === 1 || ci === 4 || ci === 0);
        if (packed) { const t = ci === 0 ? ['1..6 (range)'] : rle(ci === 4 ? vals.slice().sort((a, b) => a - b) : vals);
          if (ci === 4) { cells.append(el('div', { class: 'w-ovo-c z', text: 'dict+delta' })); }
          t.forEach((x) => { const n = el('div', { class: 'w-ovo-c', text: x }); cells.append(n); }); D.forEach((_, r) => { cell[r + ':' + ci] = cells; }); }
        else vals.forEach((v, r) => { const n = el('div', { class: 'w-ovo-c', text: String(v) }); cell[r + ':' + ci] = n; cells.append(n); });
        const pg = el('div', { class: 'w-ovo-pg' }, el('h6', { text: c }), cells); pg._packed = packed; pg._n = packed ? cells.children.length : 6; P.push(pg); pages.append(pg); });
    }
  }
  function paintStats() { stats.innerHTML = ''; const eff = cnt.read ? Math.round(100 * cnt.need / cnt.read) : 0;
    stats.append(el('span', { class: 'w-stat', html: `blocks read <b>${cnt.pages}</b>` }), el('span', { class: 'w-stat', html: `values read <b>${cnt.read}</b>` }), el('span', { class: 'w-stat', html: `values needed <b>${cnt.need}</b>` }), el('span', { class: 'w-stat', html: `useful <b>${eff}%</b>` })); }
  const mark = (r, ci, need) => { const n = cell[r + ':' + ci]; if (!n) return; if (n.classList.contains('w-ovo-cells')) [...n.children].forEach((x) => x.classList.add(need ? 'n' : 'r')); else n.classList.add(need ? 'n' : 'r'); };
  function build() {
    draw(); cnt = { pages: 0, read: 0, need: 0 }; out.textContent = ''; paintStats();
    sql.innerHTML = ''; sql.append(el('pre', { html: IA.highlight(Q[q].sql, 'sql') }));
    const S = Q[q]; const F = [];
    const result = () => { if (q === 'point') return 'row: ' + D[3].join(' | '); if (q === 'agg') return 'sum = ' + D.reduce((a, r) => a + r[4], 0);
      const g = {}; D.forEach((r) => { g[r[1]] = (g[r[1]] || 0) + r[4]; }); return Object.entries(g).map(([a, b]) => `${a}: ${b}`).join(' · '); };
    if (lay === 'row') {
      const ps = q === 'point' ? [1] : [0, 1, 2];
      if (q === 'point') F.push(['A B-tree on <code>id</code> says row 4 lives on page 1 (Postgres stores a TID). One page to read.', () => {}]);
      ps.forEach((p) => F.push([q === 'point' ? 'Read page 1. The whole row is right there: all 5 values in one place. This is what row stores are built for.' : `Read page ${p}. To get ${S.need.length === 1 ? 'one amount' : 'region + amount'} per row we must load every column of both rows on the page.`,
        () => { P[p].classList.add('read'); cnt.pages++; [2 * p, 2 * p + 1].forEach((r) => COLS.forEach((_, ci) => { const need = S.rows.includes(r) && S.need.includes(ci); mark(r, ci, need); cnt.read++; if (need) cnt.need++; })); paintStats(); }]));
      F.push([q === 'point' ? `Done: 1 page, 10 values read, 5 used (the neighbour row came along). Result: ${result()}.` : `Done: every page read; only ${Math.round(100 * cnt.need / 30) || (S.need.length * 6 / 30 * 100).toFixed(0)}% of the values were useful. With 40 columns instead of 5, it would be ~${S.need.length === 1 ? '2.5' : '5'}%.`,
        () => { out.textContent = '→ ' + result(); }]);
    } else {
      const cis = S.need;
      if (q === 'point') F.push(['Row 4 is position 3 in every column. To rebuild the row we must touch <b>every</b> column block.', () => {}]);
      cis.forEach((ci) => F.push([q === 'point' ? `Read the <code>${COLS[ci]}</code> block and pick position 3.` : `Read only the <code>${COLS[ci]}</code> block${P[ci]._packed ? ` (compressed: ${P[ci]._n} entries instead of 6 values)` : ''}. The other columns are never touched.`,
        () => { P[ci].classList.add('read'); cnt.pages++; const n = P[ci]._packed ? P[ci]._n : 6; cnt.read += n; cnt.need += q === 'point' ? 1 : n;
          D.forEach((_, r) => mark(r, ci, q !== 'point' || r === 3)); paintStats(); }]));
      if (q !== 'point') F.push(['Vectorized execution: the engine sums the whole batch of values in one tight loop (SIMD-friendly), instead of calling the aggregate once per row.', () => {}]);
      F.push([q === 'point' ? `Done: 5 blocks for one row, and 25 of 30 values read were wasted. Column stores are bad at OLTP point reads and single-row updates. ${result()}.` : `Done: ${cnt.pages} block${cnt.pages > 1 ? 's' : ''} instead of all of them. With 40 columns, this query reads ${cis.length}/40 of the data${comp ? ', and compression shrinks it again' : ''}.`,
        () => { out.textContent = '→ ' + result(); }]);
    }
    return F;
  }
  const say = (t) => { cap.firstChild.innerHTML = t; };
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; bStep.disabled = false; frames = build();
    say(lay === 'row' ? 'Row store: each page holds complete rows. Press Play.' : 'Column store: each block holds one column. Try “Compressed” too. Press Play.'); }
  function step() { if (k >= frames.length) return false; const [t, f] = frames[k++]; f(); say(t); if (k >= frames.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= frames.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 600 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

/* Partitioning: animated routing of inserted rows (range / list / hash), default partition toggle, then a pruned query. */
IA.widget('partitioning', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-part-css')) document.head.append(el('style', { id: 'w-part-css', text: `
.w-part-p { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: opacity .3s; }
.w-part-p.hit { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-soft); }
.w-part-p.scan { stroke: var(--ok); stroke-width: 3; }
.w-part-g.pruned { opacity: .3; }
.w-part-chip rect { fill: var(--accent); } .w-part-chip text { fill: #fff; font-weight: 700; }
.w-part-chip.err rect { fill: var(--err); }
.w-part-router { fill: var(--surface-2); stroke: var(--accent); stroke-width: 2; }` }));
  // hash remainders below were taken from real PG (hash partitioning, MODULUS 4) on the playground table
  const M = {
    range: { key: 'created_at', parts: [['2025_01', '[2025-01-01, 02-01)'], ['2025_02', '[2025-02-01, 03-01)'], ['2025_03', '[2025-03-01, 04-01)'], ['2025_04', '[2025-04-01, 05-01)']],
      rows: [['2025-03-14', 2], ['2025-01-02', 0], ['2025-04-30', 3], ['2025-02-28', 1], ['2025-07-04', -1], ['2025-03-01', 2]],
      why: (v, p) => p < 0 ? `${v} is after every range bound.` : `${v} falls in [${['Jan 1', 'Feb 1', 'Mar 1', 'Apr 1'][p]}, ${['Feb 1', 'Mar 1', 'Apr 1', 'May 1'][p]}): lower bound inclusive, upper exclusive.`,
      q: "WHERE created_at >= '2025-03-01' AND created_at < '2025-04-01'", scan: [2], qWhy: 'The range fits entirely inside March, so 3 of 4 partitions (and the default) are pruned at plan time.' },
    list: { key: 'region', parts: [['EU', 'IN (DE, FR, NL)'], ['US', 'IN (US, CA)'], ['APAC', 'IN (JP, IN, AU)'], ['LATAM', 'IN (BR, MX)']],
      rows: [['DE', 0], ['US', 1], ['JP', 2], ['BR', 3], ['ZA', -1], ['NL', 0]],
      why: (v, p) => p < 0 ? `${v} is in no partition’s value list.` : `${v} is listed in partition ${['EU', 'US', 'APAC', 'LATAM'][p]}.`,
      q: "WHERE region = 'US'", scan: [1], qWhy: 'Equality on the list key: only the US partition can contain it.' },
    hash: { key: 'user_id', parts: [['p0', 'REMAINDER 0'], ['p1', 'REMAINDER 1'], ['p2', 'REMAINDER 2'], ['p3', 'REMAINDER 3']],
      rows: [['42', 2], ['7', 3], ['1001', 0], ['3', 1], ['18', 2], ['1', 0]],
      why: (v, p) => `hash(${v}) mod 4 = ${p}. Every value has a home, so hash partitioning never needs a default.`,
      q: 'WHERE user_id = 42', scan: [2], qWhy: 'Equality: Postgres hashes 42 and scans only p2. A range such as user_id &lt; 42 would scan all four: hash pruning works only for equality.' }
  };
  let meth = 'range'; let def = true; let speed = 2400; let gen = 0; let running = false; let k = 0;
  const mkSeg = (items, cur, on) => { const s = el('div', { class: 'seg' }); items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segM = mkSeg([['range', 'RANGE (created_at)'], ['list', 'LIST (region)'], ['hash', 'HASH (user_id)']], meth, (v) => { meth = v; reset(); });
  const segD = mkSeg([[true, 'with DEFAULT partition'], [false, 'no default']], def, (v) => { def = v; reset(); });
  const segS = mkSeg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const sqlBox = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const stage = svg('svg', { viewBox: '0 0 760 380', role: 'img', 'aria-label': 'Rows routed from the parent table to partitions', style: { width: '100%' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' })); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-controls' }, segD), sqlBox, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  let P = []; let fill = []; let errors = 0;
  const hasDef = () => def && meth !== 'hash';
  function layout() {
    const n = 4 + (hasDef() ? 1 : 0); const W = 136, gap = (760 - 20 - n * W) / (n - 1);
    return Array.from({ length: n }, (_, i) => ({ x: 10 + i * (W + gap), y: 190, w: W, h: 176 }));
  }
  function draw() {
    stage.innerHTML = ''; const m = M[meth]; const L = layout(); P = []; fill = L.map(() => 0);
    stage.append(svg('rect', { class: 'w-part-router', x: 250, y: 92, width: 260, height: 50, rx: 25 }),
      svg('text', { x: 380, y: 113, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, fill: 'var(--text)', text: 'events (parent, no storage)' }),
      svg('text', { x: 380, y: 131, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--text-2)', text: `PARTITION BY ${meth.toUpperCase()} (${m.key})` }),
      svg('text', { x: 380, y: 22, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--text-3)', text: 'INSERT INTO events …' }));
    L.forEach((b, i) => { const g = svg('g', { class: 'w-part-g' }); const isD = i === 4;
      const r = svg('rect', { class: 'w-part-p', x: b.x, y: b.y, width: b.w, height: b.h, rx: 8, 'stroke-dasharray': isD ? '6 4' : '' });
      g.append(svg('path', { d: `M380 142 L ${b.x + b.w / 2} ${b.y}`, stroke: 'var(--border)', 'stroke-width': 1.5, fill: 'none' }), r,
        svg('text', { x: b.x + 8, y: b.y + 18, 'font-size': 13, 'font-weight': 700, fill: 'var(--text)', text: isD ? 'events_default' : 'events_' + m.parts[i][0].toLowerCase() }),
        svg('text', { x: b.x + 8, y: b.y + 34, 'font-size': 10, fill: 'var(--text-3)', text: isD ? 'DEFAULT' : m.parts[i][1].length > 24 ? m.parts[i][1].slice(0, 23) + '…' : m.parts[i][1] }));
      stage.append(g); P.push({ g, r, b }); });
    if (meth === 'hash' && def) stage.append(svg('text', { x: 380, y: 176, 'text-anchor': 'middle', 'font-size': 11.5, fill: 'var(--warn)', text: 'hash-partitioned tables cannot have a DEFAULT partition' }));
  }
  function chip(label, x, y, err) { const g = svg('g', { class: 'w-part-chip' + (err ? ' err' : '') }); const w = Math.max(54, label.length * 8 + 16);
    g.append(svg('rect', { x: -w / 2, y: -13, width: w, height: 26, rx: 13 }), svg('text', { x: 0, y: 5, 'text-anchor': 'middle', 'font-size': 12.5, text: label })); g.setAttribute('transform', `translate(${x},${y})`); stage.append(g); return g; }
  async function move(g, pts, gg) {
    if (reduced) { const p = pts[pts.length - 1]; g.setAttribute('transform', `translate(${p[0]},${p[1]})`); return; }
    for (let s = 1; s < pts.length; s++) { const [x1, y1] = pts[s - 1], [x2, y2] = pts[s]; const dur = speed * 0.28; const t0 = performance.now();
      await new Promise((res) => { const f = (now) => { if (gg !== gen) return res(); const u = Math.min(1, (now - t0) / dur); const v = u * u * (3 - 2 * u);
        g.setAttribute('transform', `translate(${x1 + (x2 - x1) * v},${y1 + (y2 - y1) * v})`); if (u < 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); }); }
  }
  const total = () => M[meth].rows.length + 1;
  async function step() {
    const m = M[meth]; if (k >= total()) return false; const g0 = gen; const i = k++;
    P.forEach((p) => p.r.setAttribute('class', 'w-part-p'));
    if (i < m.rows.length) {
      const [v, p0] = m.rows[i]; const p = p0 < 0 && hasDef() ? 4 : p0; const err = p < 0;
      const c = chip(v, 380, 48, err);
      narr.firstChild.innerHTML = `Row ${m.key} = <b>${v}</b>: ${m.why(v, p0)}` + (err ? ' No default partition, so the INSERT fails: <code>ERROR: no partition of relation "events" found for row</code>.' : p === 4 ? ' It lands in the <b>default</b> partition. Later, creating that month’s partition will fail until these rows move.' : '');
      if (err) { await move(c, [[380, 48], [380, 117]], g0); errors++; if (!reduced) await sleep(300); if (g0 === gen) { c.remove(); stage.append(svg('text', { x: 520, y: 122, 'font-size': 12.5, 'font-weight': 700, fill: 'var(--err)', text: `✗ ${v}: no partition` })); } }
      else { const b = P[p].b; P[p].r.setAttribute('class', 'w-part-p hit'); const ty = b.y + 58 + fill[p] * 30; fill[p]++;
        await move(c, [[380, 48], [380, 117], [b.x + b.w / 2, b.y - 6], [b.x + b.w / 2, ty]], g0); }
      stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `routed <b>${fill.reduce((a, b) => a + b, 0)}</b>` }), el('span', { class: 'w-stat', html: `failed <b>${errors}</b>` }));
    } else {
      sqlBox.innerHTML = ''; sqlBox.append(el('pre', { html: IA.highlight(`EXPLAIN SELECT * FROM events\n${m.q};`, 'sql') }));
      P.forEach((p, j) => { const on = m.scan.includes(j); p.g.setAttribute('class', 'w-part-g' + (on ? '' : ' pruned')); if (on) p.r.setAttribute('class', 'w-part-p scan'); });
      narr.firstChild.innerHTML = `Query time. ${m.qWhy} Partitions scanned: <b>${m.scan.length}</b> of ${P.length}.`;
      bStep.disabled = true;
    }
    return g0 === gen;
  }
  function reset() {
    gen++; running = false; k = 0; errors = 0; bPlay.textContent = '▶ Play'; bStep.disabled = false; draw(); stats.innerHTML = '';
    const m = M[meth];
    sqlBox.innerHTML = ''; sqlBox.append(el('pre', { html: IA.highlight(`CREATE TABLE events (…) PARTITION BY ${meth.toUpperCase()} (${m.key});\nCREATE TABLE events_${m.parts[0][0].toLowerCase()} PARTITION OF events FOR VALUES ${meth === 'hash' ? 'WITH (MODULUS 4, REMAINDER 0)' : meth === 'list' ? "IN ('DE','FR','NL')" : "FROM ('2025-01-01') TO ('2025-02-01')"};\n…${hasDef() ? '\nCREATE TABLE events_default PARTITION OF events DEFAULT;' : ''}`, 'sql') }));
    narr.firstChild.innerHTML = 'Press Play: six rows are inserted into the parent, one by one, then a query runs.';
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= total()) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && await step()) await sleep(reduced ? 600 : speed * 0.6);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

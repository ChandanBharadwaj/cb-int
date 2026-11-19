/* EXPLAIN: animated plan tree executed bottom-up, rows flowing up as dots; per-loop vs total toggle; hottest node at the end. */
IA.widget('explain', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-explain-css')) document.head.append(el('style', { id: 'w-explain-css', text: `
.w-explain-n rect.bx { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; transition: fill .3s, stroke .3s; }
.w-explain-n.on rect.bx { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-soft); }
.w-explain-n.hot rect.bx { stroke: var(--err); stroke-width: 3; }
.w-explain-n.done rect.bx { stroke: var(--ok); }
.w-explain-edge { stroke: var(--border); stroke-width: 2; fill: none; }
.w-explain-dot { fill: var(--accent); }
.w-explain-bad { fill: var(--err); font-weight: 700; }` }));
  // node: [label, detail, estRows, actRows(per loop), loops, timePerLoop ms, parent, x, y, buffers]
  const PLANS = {
    hash: {
      name: 'Hash Join (good estimate)',
      sql: `SELECT c.name, o.amount\nFROM orders o JOIN customers c ON c.id = o.customer_id\nWHERE o.created_at >= '2025-01-20';`,
      nodes: [
        { l: 'Hash Join', d: 'Hash Cond: o.customer_id = c.id', cost: '143.79..1042.11', est: 22572, act: 22641, loops: 1, t: 39.9, p: null, x: 230, y: 14, buf: 'hit=417' },
        { l: 'Index Scan on orders o', d: 'Index Cond: created_at >= …', cost: '0.29..839.29', est: 22572, act: 22641, loops: 1, t: 14.1, p: 0, x: 20, y: 150, buf: 'hit=380' },
        { l: 'Hash', d: 'Buckets: 8192  Memory: 300kB', cost: '81.00..81.00', est: 5000, act: 5000, loops: 1, t: 4.6, p: 0, x: 440, y: 150, buf: 'hit=37' },
        { l: 'Seq Scan on customers c', d: '', cost: '0.00..81.00', est: 5000, act: 5000, loops: 1, t: 1.9, p: 2, x: 440, y: 286, buf: 'hit=37' }
      ],
      order: [
        [3, 'Hash Join first needs its <b>build side</b>. It pulls every row from Seq Scan on customers. Estimate 5,000, actual 5,000: perfect.'],
        [2, 'Hash consumes all 5,000 rows into an in-memory hash table (300 kB, fits in work_mem). It returns nothing until the build is finished, so its startup cost equals its total cost.'],
        [1, 'Now the <b>probe side</b>: the index scan on orders streams 22,641 rows up. Estimate 22,572. Within 1%, so the planner chose the right join method.'],
        [0, 'Each order row probes the hash table and the matches go to the client. Total 39.9 ms. The node’s <b>self time</b> is its total minus its children’s.']
      ]
    },
    nl: {
      name: 'Nested Loop (misestimate)',
      sql: `SELECT c.name, o.amount\nFROM orders o JOIN customers c ON c.id = o.customer_id\nWHERE o.status = 'pending' AND o.region = 'EU';  -- correlated`,
      nodes: [
        { l: 'Nested Loop', d: '', cost: '0.71..25.40', est: 3, act: 48000, loops: 1, t: 412, p: null, x: 230, y: 14, buf: 'hit=144k read=9.6k' },
        { l: 'Index Scan on orders o', d: 'Filter: region = EU', cost: '0.43..8.45', est: 3, act: 48000, loops: 1, t: 118, p: 0, x: 20, y: 150, buf: 'hit=2k read=9.6k' },
        { l: 'Index Scan using customers_pkey', d: 'Index Cond: id = o.customer_id', cost: '0.28..5.65', est: 1, act: 1, loops: 48000, t: 0.005, p: 0, x: 440, y: 150, buf: 'hit=144k' }
      ],
      order: [
        [1, 'The outer side runs first. The planner multiplied the two selectivities as if status and region were independent and expected <b>3 rows</b>. <span class="w-explain-bad">48,000</span> arrive. 16,000× off.'],
        [2, 'For <i>each</i> outer row the inner index scan runs once: <b>loops=48,000</b>. Per loop it looks harmless: 0.005 ms and 1 row. Turn on × loops: 240 ms and 144k buffer hits.'],
        [0, 'With 3 outer rows a nested loop would have been ideal. With 48,000 it does 48,000 random index probes. A hash join would have taken about 40 ms.']
      ]
    }
  };
  let pk = 'nl'; let mult = false; let gen = 0; let running = false; let speed = 2400; let k = 0;
  const seg = (items, cur, on) => { const s = el('div', { class: 'seg' }); items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segP = seg(Object.entries(PLANS).map(([k2, v]) => [k2, v.name]), pk, (v) => { pk = v; reset(); });
  const segM = seg([[false, 'per loop (as printed)'], [true, '× loops (real totals)']], mult, (v) => { mult = v; reset(); });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const sqlBox = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const stage = svg('svg', { viewBox: '0 0 760 400', role: 'img', 'aria-label': 'Plan tree with rows flowing from leaves to root', style: { width: '100%' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: '' }));
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segP), el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'numbers' }), segM), sqlBox,
    el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  const BW = 300, BH = 104; let G = [];
  const fmt = (n) => n >= 1000 ? n.toLocaleString('en-US') : String(n);
  const fmtT = (t) => (t < 0.1 ? t.toFixed(3) : t.toFixed(1)) + ' ms';
  function draw() {
    const P = PLANS[pk]; stage.innerHTML = ''; G = []; stage.setAttribute('viewBox', `0 0 760 ${Math.max(...P.nodes.map((n) => n.y)) + BH + 16}`);
    const edges = svg('g'); stage.append(edges);
    P.nodes.forEach((n) => { if (n.p != null) { const q = P.nodes[n.p]; edges.append(svg('path', { class: 'w-explain-edge', d: `M${n.x + BW / 2} ${n.y} C ${n.x + BW / 2} ${n.y - 30}, ${q.x + BW / 2} ${q.y + BH + 30}, ${q.x + BW / 2} ${q.y + BH}` })); } });
    P.nodes.forEach((n) => {
      const g = svg('g', { class: 'w-explain-n' });
      const ratio = Math.max(n.act / n.est, n.est / n.act);
      const rows = mult ? n.act * n.loops : n.act; const time = mult ? n.t * n.loops : n.t;
      const actTxt = svg('text', { x: n.x + 10, y: n.y + 72, 'font-size': 11.5, 'font-weight': 600, fill: 'var(--text)', text: '' });
      g.append(svg('rect', { class: 'bx', x: n.x, y: n.y, width: BW, height: BH, rx: 8 }),
        svg('text', { x: n.x + 10, y: n.y + 20, 'font-size': 14, 'font-weight': 700, fill: 'var(--text)', text: '-> ' + n.l }),
        svg('text', { x: n.x + 10, y: n.y + 38, 'font-size': 11.5, fill: 'var(--text-3)', text: n.d || ' ' }),
        svg('text', { x: n.x + 10, y: n.y + 55, 'font-size': 12, fill: 'var(--text-2)', text: `est: cost=${n.cost} rows=${fmt(n.est)}` }), actTxt,
        svg('text', { x: n.x + 10, y: n.y + 91, 'font-size': 11.5, fill: 'var(--text-3)', text: `Buffers: shared ${n.buf}` }));
      const badge = ratio >= 10 ? svg('text', { class: 'w-explain-bad', x: n.x + BW - 10, y: n.y + 20, 'text-anchor': 'end', 'font-size': 13, text: `×${fmt(Math.round(ratio))} off` }) : null;
      if (badge) { badge.style.opacity = 0; g.append(badge); }
      stage.append(g);
      G.push({ g, actTxt, badge, full: mult ? `Σ rows=${fmt(rows)}  Σ time=${fmtT(time)}  loops=${fmt(n.loops)}` : `act: ..${fmtT(n.t)} rows=${fmt(n.act)} loops=${fmt(n.loops)}` });
    });
  }
  async function flow(i, g) {
    const P = PLANS[pk]; const n = P.nodes[i]; if (reduced || n.p == null) return;
    const q = P.nodes[n.p]; const x1 = n.x + BW / 2, y1 = n.y, x2 = q.x + BW / 2, y2 = q.y + BH;
    const cnt = Math.min(8, Math.max(2, Math.round(Math.log10(n.act * n.loops + 1) * 2)));
    const dots = []; for (let j = 0; j < cnt; j++) { const c = svg('circle', { class: 'w-explain-dot', r: 5, cx: x1, cy: y1 }); stage.append(c); dots.push(c); }
    const dur = speed * 0.55; const t0 = performance.now();
    await new Promise((res) => { const f = (now) => { if (g !== gen) { dots.forEach((d) => d.remove()); return res(); }
      let all = true; dots.forEach((d, j) => { let u = (now - t0 - j * dur / cnt / 1.5) / (dur / 1.6); if (u < 1) all = false; u = Math.max(0, Math.min(1, u));
        const v = u * u * (3 - 2 * u); d.setAttribute('cx', x1 + (x2 - x1) * v); d.setAttribute('cy', y1 + (y2 - y1) * v); d.style.opacity = u >= 1 ? 0 : 1; });
      if (all) { dots.forEach((d) => d.remove()); res(); } else requestAnimationFrame(f); }; requestAnimationFrame(f); });
  }
  function hottest() { const P = PLANS[pk]; const self = P.nodes.map((n, i) => n.t * n.loops - P.nodes.filter((c) => c.p === i).reduce((s, c) => s + c.t * c.loops, 0)); let h = 0; self.forEach((s, i) => { if (s > self[h]) h = i; }); return { h, self }; }
  function renderStats() {
    const { self } = hottest(); stats.innerHTML = '';
    PLANS[pk].nodes.forEach((n, i) => { if (i < k || k >= PLANS[pk].order.length + 1) stats.append(el('span', { class: 'w-stat', html: `${n.l.split(' on ')[0].split(' using ')[0]} self <b>${fmtT(Math.max(0, self[i]))}</b>` })); });
  }
  async function step() {
    const P = PLANS[pk];
    if (k > P.order.length) return false;
    const g = gen;
    if (k === P.order.length) {
      const { h, self } = hottest(); G.forEach((x) => x.g.setAttribute('class', 'w-explain-n done')); G[h].g.setAttribute('class', 'w-explain-n hot');
      let bad = -1; P.nodes.forEach((n, j) => { if (Math.max(n.act / n.est, n.est / n.act) >= 10 && (bad < 0 || n.y > P.nodes[bad].y)) bad = j; });
      narr.firstChild.innerHTML = `Hottest node: <b>${P.nodes[h].l}</b>, self time ${fmtT(self[h])}.` + (bad >= 0 ? ` Root cause: the misestimate on <b>${P.nodes[bad].l}</b> (bottom-most red badge). Fix the estimate (ANALYZE, CREATE STATISTICS) and the join method fixes itself.` : ' No node is off by 10× or more. This plan is healthy; to make it faster, reduce the rows read.');
      k++; bStep.disabled = true; renderStats(); return true;
    }
    const [i, why] = P.order[k++];
    G.forEach((x, j) => x.g.setAttribute('class', 'w-explain-n' + (P.order.slice(0, k - 1).some((o) => o[0] === j) ? ' done' : '')));
    G[i].g.setAttribute('class', 'w-explain-n on'); G[i].actTxt.textContent = G[i].full; if (G[i].badge) G[i].badge.style.opacity = 1;
    narr.firstChild.innerHTML = why; renderStats();
    await flow(i, g); return g === gen;
  }
  function reset() {
    gen++; running = false; k = 0; bPlay.textContent = '▶ Play'; bStep.disabled = false; draw();
    sqlBox.innerHTML = ''; sqlBox.append(el('pre', { html: IA.highlight('EXPLAIN (ANALYZE, BUFFERS)\n' + PLANS[pk].sql, 'sql') }));
    narr.firstChild.innerHTML = 'Execution starts at the leaves. Press Play or Step. The actual numbers appear as each node runs.'; stats.innerHTML = '';
  }
  bStep.addEventListener('click', () => { if (running) { running = false; bPlay.textContent = '▶ Play'; } step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k > PLANS[pk].order.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && await step()) { await sleep(reduced ? 600 : speed * 0.45); }
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

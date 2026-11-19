/* Join algorithms: nested loop (index / no index), hash join (fits / spills into batches), merge join (sorted / needs sort). Snapshot stepper. */
IA.widget('join-algorithms', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-ja-css')) document.head.append(el('style', { id: 'w-ja-css', text: `
.w-ja-r { fill: var(--surface); stroke: var(--border); stroke-width: 1.3; }
.w-ja-r.hi { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2.4; }
.w-ja-r.ok { stroke: var(--ok); stroke-width: 2.4; }
.w-ja-r.miss { stroke: var(--err); stroke-dasharray: 4 3; stroke-width: 2; }
.w-ja-r.dim { opacity: .45; }
.w-ja-box { fill: var(--surface-2); stroke: var(--border); }
.w-ja-box.disk { stroke: var(--warn); stroke-dasharray: 5 3; }
.w-ja-chip { display: inline-block; padding: 2px 8px; margin: 2px; border-radius: 10px; background: var(--accent-soft); color: var(--text); font-size: 13px; animation: capin .35s ease both; }` }));
  const CUST = [{ k: 3, n: 'Chen' }, { k: 1, n: 'Asha' }, { k: 5, n: 'Eve' }, { k: 2, n: 'Ben' }, { k: 4, n: 'Dina' }];
  const ORD = [{ id: 101, k: 2 }, { id: 102, k: 5 }, { id: 103, k: 1 }, { id: 104, k: 2 }, { id: 105, k: 7 }, { id: 106, k: 3 }];
  const ALG = { nl: 'Nested Loop', hash: 'Hash Join', merge: 'Merge Join' };
  const OPT = { nl: [['idx', 'index on customers.id'], ['noidx', 'no index (scan inner)']], hash: [['fits', 'fits in work_mem'], ['spill', 'spills: 2 batches']], merge: [['sorted', 'inputs from indexes (sorted)'], ['sort', 'needs Sort first']] };
  let alg = 'hash'; let opt = 'fits'; let speed = 2400; let gen = 0; let running = false; let k = 0; let snaps = [];
  const mkSeg = (items, cur, on) => { const s = el('div', { class: 'seg' }); items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const optHost = el('div', { class: 'w-controls' });
  const segA = mkSeg(Object.entries(ALG), alg, (v) => { alg = v; opt = OPT[v][0][0]; buildOpt(); reset(); });
  function buildOpt() { optHost.innerHTML = ''; optHost.append(mkSeg(OPT[alg], opt, (v) => { opt = v; reset(); })); }
  const segS = mkSeg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const stage = svg('svg', { viewBox: '0 0 760 330', role: 'img', 'aria-label': 'Orders on the left, customers on the right, algorithm state in the middle', style: { width: '100%' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const res = el('div', { style: { minHeight: '30px' } }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segA), optHost, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr,
    el('div', { class: 'tiny', text: 'result rows (order → customer)', style: { marginTop: '8px' } }), res, stats);
  buildOpt();
  const name = (key) => (CUST.find((c) => c.k === key) || {}).n;
  // ---------- snapshot builders ----------
  function build() {
    const S = []; let st = { L: ORD.map((_, i) => i), R: CUST.map((_, i) => i), hiL: [], hiR: [], okR: [], missL: [], mid: null, res: [], c: {}, lab: ['orders (outer)', 'customers (inner)'] };
    const push = (why, patch) => { st = Object.assign({}, st, patch, { c: Object.assign({}, st.c, (patch && patch.c) || {}) }); S.push({ st, why }); };
    const res = []; const add = (o) => { const n = name(o.k); if (n) res.push(`${o.id} → ${n}`); return n; };
    if (alg === 'nl') {
      const sortedKeys = CUST.map((c) => c.k).sort((a, b) => a - b);
      let cmp = 0, probes = 0;
      push(opt === 'idx' ? 'Outer side: orders. For each order, probe the B-tree index on customers.id. One lookup costs about log₂(N) comparisons, not N.' : 'No usable index on the inner side: for each order, Postgres must scan <b>every</b> customer row. Cost grows as outer × inner.', { mid: { kind: 'index', keys: opt === 'idx' ? sortedKeys : null }, c: { 'index probes': 0, 'comparisons': 0 } });
      ORD.forEach((o, i) => {
        const j = CUST.findIndex((c) => c.k === o.k);
        if (opt === 'idx') { probes++; cmp += 3; } else cmp += CUST.length;
        const n = add(o);
        push(n ? `Order ${o.id}: customer_id ${o.k}. ${opt === 'idx' ? 'Index lookup finds' : `Compared with all ${CUST.length} customers, found`} <b>${n}</b>. Emit the pair.` : `Order ${o.id}: customer_id ${o.k}. ${opt === 'idx' ? 'The index has no key 7' : 'None of the 5 customers matches'}, so an inner join emits nothing.`,
          { hiL: [i], hiR: opt === 'idx' ? [] : CUST.map((_, x) => x), okR: j >= 0 ? [j] : [], missL: j >= 0 ? [] : [i], res: res.slice(), mid: { kind: 'index', keys: opt === 'idx' ? sortedKeys : null, hot: o.k }, c: { 'index probes': probes, 'comparisons': cmp } });
      });
      push(`Done. ${opt === 'idx' ? `6 index probes (~${cmp} key comparisons). With 6 million orders it would be 6 million random probes: that is when hash join wins.` : `${cmp} comparisons = 6 × 5. At 1 M × 1 M rows that is 10¹² comparisons. Never acceptable: add the index or let the planner hash.`}`, { hiL: [], hiR: [], okR: [], missL: [] });
    }
    if (alg === 'hash') {
      const spill = opt === 'spill'; const NB = 3; const buckets = [[], [], []]; const disk = { b: [], p: [] };
      const batch = (key) => (spill ? key % 2 : 0);
      st.lab = ['orders (probe side)', 'customers (build side)'];
      push(spill ? 'Build side: customers (the smaller input). This time work_mem holds only half of it, so Postgres uses <b>2 batches</b>: rows whose hash says “batch 1” go to a temp file.' : 'Phase 1, <b>build</b>: read the smaller input (customers) into an in-memory hash table. Bucket = hash(id) mod 3.', { mid: { kind: 'hash', buckets: buckets.map((b) => b.slice()), disk: { b: [], p: [] }, spill }, c: { 'hash inserts': 0, 'probes': 0, 'temp rows written': 0 } });
      let ins = 0, pr = 0, tw = 0;
      CUST.forEach((c, j) => {
        if (batch(c.k) === 0) { buckets[c.k % NB].push(c.k); ins++; } else { disk.b.push(c.k); tw++; }
        push(batch(c.k) === 0 ? `Insert <b>${c.n}</b> (id ${c.k}) into bucket ${c.k % NB}.` : `<b>${c.n}</b> (id ${c.k}) belongs to batch 1: written to a temp file, not to memory.`,
          { hiR: [j], hiL: [], mid: { kind: 'hash', buckets: buckets.map((b) => b.slice()), disk: { b: disk.b.slice(), p: disk.p.slice() }, spill, hot: batch(c.k) === 0 ? c.k % NB : 'b' }, c: { 'hash inserts': ins, 'temp rows written': tw } });
      });
      ORD.forEach((o, i) => {
        if (batch(o.k) === 1) { disk.p.push(o.id); tw++;
          push(`Order ${o.id} (customer_id ${o.k}) hashes to batch 1. Its partner, if any, is on disk too, so the order is written to a temp file to be joined later.`, { hiL: [i], hiR: [], okR: [], mid: { kind: 'hash', buckets: buckets.map((b) => b.slice()), disk: { b: disk.b.slice(), p: disk.p.slice() }, spill, hot: 'p' }, c: { 'temp rows written': tw } }); return; }
        pr++; const n = add(o); const j = CUST.findIndex((c) => c.k === o.k);
        push(`Phase 2, <b>probe</b>: order ${o.id} hashes customer_id ${o.k} to bucket ${o.k % NB}. ${n ? `Found <b>${n}</b>. Emit.` : 'The bucket has no key ' + o.k + '. No match.'}`, { hiL: [i], hiR: [], okR: j >= 0 ? [j] : [], missL: n ? [] : [i], res: res.slice(), mid: { kind: 'hash', buckets: buckets.map((b) => b.slice()), disk: { b: disk.b.slice(), p: disk.p.slice() }, spill, hot: o.k % NB }, c: { 'probes': pr } });
      });
      if (spill) {
        const b2 = [[], [], []]; disk.b.forEach((key) => b2[key % NB].push(key));
        push('Batch 0 is finished. Now Postgres frees the hash table, reads batch 1 of customers back from the temp file and builds a new table from it.', { hiL: [], okR: [], missL: [], mid: { kind: 'hash', buckets: b2.map((b) => b.slice()), disk: { b: [], p: disk.p.slice() }, spill, hot: 'mem' }, c: {} });
        disk.p.slice().forEach((id) => { const o = ORD.find((x) => x.id === id); const i = ORD.indexOf(o); pr++; const n = add(o); const j = CUST.findIndex((c) => c.k === o.k); disk.p.splice(disk.p.indexOf(id), 1);
          push(`Read order ${id} back from the temp file and probe: ${n ? `found <b>${n}</b>.` : 'no match.'} Every spilled row was written once and read once: extra I/O.`, { hiL: [i], okR: j >= 0 ? [j] : [], missL: n ? [] : [i], res: res.slice(), mid: { kind: 'hash', buckets: b2.map((b) => b.slice()), disk: { b: [], p: disk.p.slice() }, spill, hot: o.k % NB }, c: { 'probes': pr } }); });
      }
      push(spill ? `Done. Same 5 rows, but ${tw} rows went to disk and back. EXPLAIN shows <code>Batches: 2</code> and temp read/written. Raising work_mem would avoid it.` : 'Done. Each input was read exactly once: build O(M), probe O(N). EXPLAIN shows <code>Batches: 1</code>.', { hiL: [], hiR: [], okR: [], missL: [] });
    }
    if (alg === 'merge') {
      const Ls = ORD.map((_, i) => i).sort((a, b) => ORD[a].k - ORD[b].k); const Rs = CUST.map((_, i) => i).sort((a, b) => CUST[a].k - CUST[b].k);
      let cmp = 0;
      if (opt === 'sort') {
        push('Merge join needs both inputs <b>sorted by the join key</b>. Neither is, so the plan has a Sort node under each side. That costs O(N log N) and memory.', { mid: { kind: 'merge', note: 'Sort ↓ both inputs' }, c: { comparisons: 0, sorted: 'no' } });
        push('Both sides sorted by key. (With an index on each join column, this order would come for free.)', { L: Ls, R: Rs, mid: { kind: 'merge', note: 'sorted' }, c: { sorted: 'by Sort' } });
      } else push('Both inputs arrive <b>already sorted</b> by the join key from B-tree indexes (Index Scans), so no Sort node is needed.', { L: Ls, R: Rs, mid: { kind: 'merge', note: 'sorted by index' }, c: { comparisons: 0, sorted: 'by index' } });
      let a = 0, b = 0;
      while (a < Ls.length && b < Rs.length) {
        const o = ORD[Ls[a]], c = CUST[Rs[b]]; cmp++;
        if (o.k === c.k) { add(o); push(`Pointers: order ${o.id} (${o.k}) vs ${c.n} (${c.k}). <b>Equal</b>: emit, advance the order pointer.${a + 1 < Ls.length && ORD[Ls[a + 1]].k === o.k ? ' The next order has the same key, so the customer pointer stays (mark/restore).' : ''}`, { L: Ls, R: Rs, hiL: [Ls[a]], hiR: [Rs[b]], okR: [Rs[b]], missL: [], res: res.slice(), mid: { kind: 'merge', pa: a, pb: b }, c: { comparisons: cmp } }); a++; }
        else if (o.k < c.k) { push(`Order key ${o.k} &lt; customer key ${c.k}: no partner can follow. Advance the order pointer.`, { L: Ls, R: Rs, hiL: [Ls[a]], hiR: [Rs[b]], okR: [], missL: [Ls[a]], mid: { kind: 'merge', pa: a, pb: b }, c: { comparisons: cmp } }); a++; }
        else { push(`Customer key ${c.k} &lt; order key ${o.k}: advance the customer pointer.`, { L: Ls, R: Rs, hiL: [Ls[a]], hiR: [Rs[b]], okR: [], missL: [], mid: { kind: 'merge', pa: a, pb: b }, c: { comparisons: cmp } }); b++; }
      }
      push(`The customer side is exhausted, so the remaining order (key 7) cannot match. Done after ${cmp} comparisons: each input was walked once, like a zipper. The output is sorted by the key for free.`, { L: Ls, R: Rs, hiL: [], hiR: [], okR: [], missL: [Ls[Ls.length - 1]], mid: { kind: 'merge' } });
    }
    return S;
  }
  // ---------- render ----------
  const RH = 40, TOP = 52, LX = 16, RX = 556, TW = 188;
  function render(s) {
    const st = s.st; stage.innerHTML = '';
    const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 13, fill: 'var(--text)', text: t }, o || {}));
    stage.append(T(LX, 22, st.lab[0], { 'font-weight': 700 }), T(RX, 22, st.lab[1], { 'font-weight': 700 }), T(LX + 8, 42, 'id   customer_id', { 'font-size': 11, fill: 'var(--text-3)' }), T(RX + 8, 42, 'id   name', { 'font-size': 11, fill: 'var(--text-3)' }));
    st.L.forEach((i, r) => { const o = ORD[i]; const y = TOP + r * RH; const cls = 'w-ja-r' + (st.hiL.includes(i) ? ' hi' : '') + (st.missL.includes(i) ? ' miss' : '');
      stage.append(svg('rect', { class: cls, x: LX, y, width: TW, height: RH - 8, rx: 6 }), T(LX + 8, y + 21, String(o.id)), T(LX + 62, y + 21, String(o.k), { 'font-weight': 700, fill: o.k === 7 ? 'var(--err)' : 'var(--text)' }));
      if (st.mid && st.mid.kind === 'merge' && st.mid.pa === r) stage.append(T(LX + TW + 6, y + 22, '◀ a', { fill: 'var(--accent)', 'font-weight': 700 })); });
    st.R.forEach((j, r) => { const c = CUST[j]; const y = TOP + r * RH; const cls = 'w-ja-r' + (st.hiR.includes(j) ? ' hi' : '') + (st.okR.includes(j) ? ' ok' : '');
      stage.append(svg('rect', { class: cls, x: RX, y, width: TW, height: RH - 8, rx: 6 }), T(RX + 8, y + 21, String(c.k), { 'font-weight': 700 }), T(RX + 46, y + 21, c.n));
      if (st.mid && st.mid.kind === 'merge' && st.mid.pb === r) stage.append(T(RX - 30, y + 22, 'b ▶', { fill: 'var(--accent)', 'font-weight': 700 })); });
    const m = st.mid; const MX = 236, MW = 290;
    if (m && m.kind === 'index') {
      stage.append(T(MX, 22, m.keys ? 'B-tree index on customers.id' : 'no index: full scan of inner', { 'font-weight': 700, fill: 'var(--text-2)' }));
      if (m.keys) { stage.append(svg('rect', { class: 'w-ja-box', x: MX + 110, y: 46, width: 70, height: 30, rx: 5 }), T(MX + 128, 66, '≤3 | >3', { 'font-size': 11 }));
        m.keys.forEach((key, x) => { const bx = MX + 10 + x * 56; stage.append(svg('line', { x1: MX + 145, y1: 76, x2: bx + 22, y2: 120, stroke: 'var(--border)' }), svg('rect', { class: 'w-ja-r' + (m.hot === key ? ' hi' : ''), x: bx, y: 120, width: 44, height: 30, rx: 5 }), T(bx + 17, 140, String(key), { 'font-weight': 700 })); });
        if (m.hot != null) stage.append(T(MX + 10, 186, m.keys.includes(m.hot) ? `lookup ${m.hot}: root → leaf → heap row` : `lookup ${m.hot}: not in index`, { fill: m.keys.includes(m.hot) ? 'var(--accent)' : 'var(--err)' }));
      } else if (m.hot != null) stage.append(T(MX + 10, 120, `compare ${m.hot} with all 5 ids →`, { fill: 'var(--warn)' }));
    }
    if (m && m.kind === 'hash') {
      stage.append(T(MX, 22, `hash table (work_mem${m.spill ? ' = half' : ''})`, { 'font-weight': 700, fill: 'var(--text-2)' }));
      m.buckets.forEach((b, x) => { const y = 40 + x * 46; stage.append(svg('rect', { class: 'w-ja-r' + (m.hot === x ? ' hi' : ''), x: MX, y, width: MW, height: 38, rx: 6 }), T(MX + 8, y + 24, `bucket ${x}`, { fill: 'var(--text-3)', 'font-size': 12 }));
        b.forEach((key, z) => stage.append(svg('rect', { class: 'w-ja-r ok', x: MX + 76 + z * 48, y: y + 6, width: 40, height: 26, rx: 5 }), T(MX + 90 + z * 48, y + 24, String(key), { 'font-weight': 700 }))); });
      if (m.spill) { const y = 186; stage.append(svg('rect', { class: 'w-ja-box disk' + (m.hot === 'b' || m.hot === 'p' ? ' hi' : ''), x: MX, y, width: MW, height: 70, rx: 6 }), T(MX + 8, y + 18, 'temp files: batch 1 (on disk)', { 'font-size': 12, fill: 'var(--warn)', 'font-weight': 700 }),
        T(MX + 8, y + 40, 'customers: ' + (m.disk.b.join(', ') || '-'), { 'font-size': 12 }), T(MX + 8, y + 60, 'orders: ' + (m.disk.p.join(', ') || '-'), { 'font-size': 12 })); }
    }
    if (m && m.kind === 'merge') { stage.append(T(MX + 20, 22, 'merge: advance the smaller key', { 'font-weight': 700, fill: 'var(--text-2)' }));
      if (m.note) stage.append(T(MX + 60, 140, m.note, { fill: 'var(--accent)', 'font-size': 15, 'font-weight': 700 }));
      if (m.pa != null) { const y1 = TOP + m.pa * RH + 16, y2 = TOP + m.pb * RH + 16; const eq = ORD[st.L[m.pa]].k === CUST[st.R[m.pb]].k;
        stage.append(svg('path', { d: `M${LX + TW + 30} ${y1} C ${MX + 120} ${y1}, ${MX + 170} ${y2}, ${RX - 34} ${y2}`, stroke: eq ? 'var(--ok)' : 'var(--text-3)', 'stroke-width': 2.4, fill: 'none', 'stroke-dasharray': eq ? '' : '5 4' }), T(MX + 125, (y1 + y2) / 2 - 6, eq ? '=' : ORD[st.L[m.pa]].k < CUST[st.R[m.pb]].k ? '<' : '>', { 'font-size': 18, 'font-weight': 700, fill: eq ? 'var(--ok)' : 'var(--text-2)' })); } }
    res.innerHTML = ''; st.res.forEach((r) => res.append(el('span', { class: 'w-ja-chip', text: r })));
    stats.innerHTML = ''; Object.entries(st.c).forEach(([kk, v]) => stats.append(el('span', { class: 'w-stat', html: `${kk} <b>${v}</b>` })));
    narr.firstChild.innerHTML = s.why;
  }
  function step() { if (k >= snaps.length) return false; render(snaps[k++]); if (k >= snaps.length) bStep.disabled = true; return true; }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; bStep.disabled = false; snaps = build(); k = 0; step(); }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= snaps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 600 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

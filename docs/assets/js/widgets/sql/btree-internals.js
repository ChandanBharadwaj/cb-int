/* B-tree walk: root → internal → leaf, sideways along leaf links; composite (tenant, day) vs (day, tenant). */
IA.widget('btree-internals', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-bt-css')) document.head.append(el('style', { id: 'w-bt-css', text: `
.w-bt .nd{fill:var(--surface);stroke:var(--border)}
.w-bt .nd.hot{fill:var(--accent-soft);stroke:var(--accent);stroke-width:2.5}
.w-bt .nd.seen{stroke:var(--accent);stroke-width:1.5}
.w-bt .eg{stroke:var(--border);stroke-width:1.2}
.w-bt .eg.hot{stroke:var(--accent);stroke-width:2.5}
.w-bt .lk{stroke:var(--text-3);stroke-width:1.2;fill:none}
.w-bt .lk.hot{stroke:var(--accent);stroke-width:2.5}
.w-bt .k{font-size:12px;fill:var(--text)}
.w-bt .k.m{fill:var(--ok);font-weight:700}
.w-bt .k.x{fill:var(--text-3);text-decoration:line-through}` }));
  const W = 760, H = 340, LW = 76, LG = 7, LY = 236, IY = 128, RY = 30;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'A three-level B-tree: one root page, three internal pages and nine leaf pages linked left to right' });
  root.classList.add('w-bt');
  const days = [2, 5, 9, 12, 15, 18, 21, 25, 28];
  function tree(mode) {
    if (mode === 'point' || mode === 'range') {
      const keys = [5, 9, 12, 17, 21, 26, 30, 34, 38, 42, 47, 51, 55, 60, 63, 68, 72, 77, 81, 85, 88, 91, 94, 97, 99, 103, 108];
      const leaves = Array.from({ length: 9 }, (_, i) => keys.slice(i * 3, i * 3 + 3).map((k) => ({ k, s: String(k) })));
      return { leaves, rootKeys: ['42', '81'], inner: [['17', '30'], ['55', '68'], ['91', '99']], label: 'index on (id)' };
    }
    const ent = [];
    if (mode === 'comp') [1, 2, 3].forEach((t) => days.forEach((d) => ent.push({ t, d })));
    else days.forEach((d) => [1, 2, 3].forEach((t) => ent.push({ t, d })));
    const fmt = (e) => mode === 'comp' ? `(${e.t},${e.d})` : `(${e.d},${e.t})`;
    const leaves = Array.from({ length: 9 }, (_, i) => ent.slice(i * 3, i * 3 + 3).map((e) => Object.assign({ s: fmt(e) }, e)));
    const first = (i) => leaves[i][0].s;
    return { leaves, rootKeys: [first(3), first(6)], inner: [[first(1), first(2)], [first(4), first(5)], [first(7), first(8)]], label: mode === 'comp' ? 'index on (tenant, day)' : 'index on (day, tenant)' };
  }
  const SQL = { point: 'SELECT * FROM t WHERE id = 60;', range: 'SELECT * FROM t WHERE id BETWEEN 40 AND 70;', comp: 'SELECT * FROM t\nWHERE tenant = 2 AND day >= 15;   -- index (tenant, day)', wrong: 'SELECT * FROM t\nWHERE tenant = 2 AND day >= 15;   -- index (day, tenant)' };
  function build(st) {
    const m = st.m, tr = tree(m), S = [];
    let s = { tr, hot: null, seen: [], eg: [], lk: [], marks: {}, pages: 0, ex: 0, hit: 0 };
    const push = (say) => S.push({ say, tr, hot: s.hot, seen: s.seen.slice(), eg: s.eg.slice(), lk: s.lk.slice(), marks: Object.assign({}, s.marks), pages: s.pages, ex: s.ex, hit: s.hit });
    const visit = (node) => { s.hot = node; if (!s.seen.includes(node)) { s.seen.push(node); s.pages++; } };
    push(`${tr.label}: 1 root page, 3 internal pages, 9 leaf pages. Real pages hold hundreds of keys; 3 per page keeps it readable. Press Play.`);
    let li;
    const target = m === 'point' ? (e) => e.k === 60 : m === 'range' ? (e) => e.k >= 40 && e.k <= 70 : (e) => e.t === 2 && e.d >= 15;
    const startKey = m === 'point' ? 60 : m === 'range' ? 40 : null;
    if (m === 'point' || m === 'range') {
      const ii = startKey < 42 ? 0 : startKey < 81 ? 1 : 2;
      visit('r'); push(`Root: ${startKey} ${ii === 0 ? '&lt; 42 → first' : ii === 1 ? 'is between 42 and 81 → middle' : '≥ 81 → last'} downlink. (Binary search inside the page.)`);
      s.eg.push('r-' + ii); visit('i' + ii);
      const sep = tr.inner[ii].map(Number); const sub = startKey < sep[0] ? 0 : startKey < sep[1] ? 1 : 2; li = ii * 3 + sub;
      push(`Internal page: separators ${sep.join(', ')} → child ${sub + 1}.`);
      s.eg.push('i' + ii + '-' + li); visit('l' + li);
    } else {
      if (m === 'comp') {
        visit('r'); push('Root: we need tenant = 2 and day ≥ 15, i.e. the first key ≥ <b>(2,15)</b>. That is between (2,2) and (3,2) → middle downlink.');
        s.eg.push('r-1'); visit('i1'); push('Internal: (2,15) is ≥ (2,12) and &lt; (2,21) → child 2.');
        li = 4; s.eg.push('i1-4'); visit('l4');
      } else {
        visit('r'); push('Root: the index is sorted by <b>day first</b>. The only usable start is day ≥ 15 → first key ≥ (15, 2)… everything right of it is a candidate, for every tenant.');
        s.eg.push('r-1'); visit('i1'); push('Internal: (15,·) → child 2.');
        li = 4; s.eg.push('i1-4'); visit('l4');
      }
    }
    push(`Leaf page reached after ${s.pages} page reads. Now scan entries in order.`);
    let done = false;
    while (!done && li < 9) {
      const leaf = tr.leaves[li];
      leaf.forEach((e, j) => {
        if (done) return;
        if (m === 'point' && e.k < 60) return;
        if (m === 'range' && e.k < 40) { s.marks[li + ':' + j] = 'x'; s.ex++; return; }
        if (m === 'comp' && (e.t < 2 || (e.t === 2 && e.d < 15))) return;
        if (m === 'wrong' && e.d < 15) return;
        s.ex++;
        const ok = target(e);
        const past = m === 'point' ? e.k > 60 : m === 'range' ? e.k > 70 : m === 'comp' ? e.t > 2 : false;
        if (past) { s.marks[li + ':' + j] = 'x'; done = true; return; }
        s.marks[li + ':' + j] = ok ? 'm' : 'x'; if (ok) s.hit++;
        if (m === 'point' && ok) done = true;
      });
      const lf = tr.leaves[li];
      if (!done && m === 'comp' && li < 8 && tr.leaves[li + 1][0].t > 2) { done = true; push(`Leaf ${li + 1}: all matches. Its <b>high key</b> (${tr.leaves[li + 1][0].s}) is already past tenant 2, so the scan ends without reading the next page. Every entry read was a match.`); break; }
      push(done ? (m === 'point' ? 'Found 60. One more read follows the TID to the heap row (skipped if index-only and all-visible).' : m === 'range' ? 'Entry 72 &gt; 70: past the upper bound, stop. Leaf links let the scan cross from one subtree to the next without climbing back up.' : 'Next entry is tenant 3: past the range, stop. Every entry read was a match.')
        : (m === 'wrong' ? `Leaf ${li + 1}: ${lf.filter((e) => e.t === 2).length} of ${lf.length} entries are tenant 2. The others are read and <b>filtered</b>. Tenant can’t narrow the range because day comes first.` : `Leaf ${li + 1} scanned. More may match → follow the <b>right-sibling link</b>.`));
      if (!done && li < 8) { s.lk.push(li); li++; visit('l' + li); push(`Follow the link to leaf ${li + 1} (one page read, no trip back to the root).`); } else if (!done) { done = true; push('End of the index: rightmost leaf.'); }
    }
    s.hot = null;
    push(`<b>Pages read: ${s.pages}</b>, entries examined: ${s.ex}, matches: ${s.hit}. ` + (m === 'wrong' ? 'Same matches as (tenant, day), but it read every tenant’s entries from day 15 onward. In production that’s 1,000 tenants, not 3.' : m === 'comp' ? 'Equality on the leading column, then a range on the next: one contiguous slice of the index.' : m === 'range' ? 'Range cost = descent + number of matching leaf pages.' : 'A point lookup costs the tree height: 3–4 pages even at 100M rows.'));
    return S;
  }
  const T = (x, y, text, a) => svg('text', Object.assign({ x, y, text }, a || {}));
  const lx = (i) => 12 + i * (LW + LG);
  const ix = (i) => lx(i * 3 + 1) + LW / 2;
  function draw(s, st, stats) {
    stage.innerHTML = '';
    const tr = s.tr;
    stage.append(T(12, 18, tr.label, { 'font-size': 13, 'font-weight': 700, fill: 'var(--text)' }));
    const cls = (id) => 'nd ' + (s.hot === id ? 'hot' : s.seen.includes(id) ? 'seen' : '');
    // edges
    [0, 1, 2].forEach((i) => stage.append(svg('line', { class: 'eg ' + (s.eg.includes('r-' + i) ? 'hot' : ''), x1: W / 2, y1: RY + 40, x2: ix(i), y2: IY })));
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const l = i * 3 + j; stage.append(svg('line', { class: 'eg ' + (s.eg.includes('i' + i + '-' + l) ? 'hot' : ''), x1: ix(i), y1: IY + 40, x2: lx(l) + LW / 2, y2: LY })); }
    // root
    stage.append(svg('rect', { class: cls('r'), x: W / 2 - 90, y: RY, width: 180, height: 40, rx: 6 }), T(W / 2, RY + 25, 'root │ ' + tr.rootKeys.join(' │ '), { class: 'k', 'text-anchor': 'middle' }));
    tr.inner.forEach((ks, i) => stage.append(svg('rect', { class: cls('i' + i), x: ix(i) - 85, y: IY, width: 170, height: 40, rx: 6 }), T(ix(i), IY + 25, '· │ ' + ks.join(' │ '), { class: 'k', 'text-anchor': 'middle' })));
    tr.leaves.forEach((lf, i) => { const x = lx(i);
      stage.append(svg('rect', { class: cls('l' + i), x, y: LY, width: LW, height: 68, rx: 6 }));
      lf.forEach((e, j) => stage.append(T(x + LW / 2, LY + 18 + j * 19, e.s, { class: 'k ' + (s.marks[i + ':' + j] || ''), 'text-anchor': 'middle' })));
      if (i < 8) stage.append(svg('path', { class: 'lk ' + (s.lk.includes(i) ? 'hot' : ''), d: `M ${x + LW} ${LY + 34} L ${x + LW + LG} ${LY + 34}` })); });
    stage.append(T(12, LY + 92, 'leaf pages, linked left → right (and right → left) for range scans', { 'font-size': 11, fill: 'var(--text-3)' }));
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `pages read <b>${s.pages}</b>` }), el('span', { class: 'w-stat', html: `entries examined <b>${s.ex}</b>` }), el('span', { class: 'w-stat', html: `matches <b>${s.hit}</b>` }));
  }
  // ---- generic stepper ----
  const st = { m: 'point' }; let steps = [], k = 0, gen = 0, running = false, speed = 2400;
  const sqlBox = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const seg = (items, cur, on, lab) => { const s = el('div', { class: 'seg', 'aria-label': lab }); items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }), bStep = el('button', { class: 'btn', text: 'Step ›' }), bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.append(
    el('div', { class: 'w-controls' }, seg([['point', 'id = 60'], ['range', 'id 40–70'], ['comp', '(tenant, day): t=2, day≥15'], ['wrong', '(day, tenant): same query']], st.m, (v) => { st.m = v; reset(); }, 'Query')),
    sqlBox, el('div', { class: 'w-stage' }, stage),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed')),
    narr, stats);
  const show = () => { draw(steps[k], st, stats); narr.firstChild.innerHTML = steps[k].say; bStep.disabled = k >= steps.length - 1; };
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; steps = build(st); k = 0; sqlBox.innerHTML = ''; sqlBox.append(el('pre', { html: IA.highlight(SQL[st.m], 'sql') })); show(); }
  const step = () => { if (k >= steps.length - 1) return false; k++; show(); return true; };
  bStep.addEventListener('click', () => { gen++; running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { gen++; running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length - 1) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 700 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

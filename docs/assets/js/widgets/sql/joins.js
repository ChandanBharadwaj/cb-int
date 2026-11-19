/* Joins: animated nested-loop view of every join type, with an ON vs WHERE filter toggle. */
IA.widget('joins', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const C = [{ id: 1, name: 'Asha' }, { id: 2, name: 'Ben' }, { id: 3, name: 'Chen' }, { id: 4, name: 'Dina' }];
  const O = [{ id: 101, cid: 1, amt: 250, st: 'paid' }, { id: 102, cid: 1, amt: 80, st: 'refunded' }, { id: 103, cid: 2, amt: 40, st: 'paid' }, { id: 104, cid: null, amt: 99, st: 'paid' }];
  const TYPES = ['INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'SEMI', 'ANTI'];
  const SQL = {
    INNER: 'FROM customers c JOIN orders o ON o.customer_id = c.id',
    LEFT: 'FROM customers c LEFT JOIN orders o ON o.customer_id = c.id',
    RIGHT: 'FROM customers c RIGHT JOIN orders o ON o.customer_id = c.id',
    FULL: 'FROM customers c FULL JOIN orders o ON o.customer_id = c.id',
    CROSS: 'FROM customers c CROSS JOIN orders o',
    SEMI: 'FROM customers c WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id',
    ANTI: 'FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id'
  };
  let type = 'LEFT'; let filt = 'none'; let running = false; let gen = 0;

  const segT = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Join type' });
  TYPES.forEach((t) => { const b = el('button', { text: t, class: t === type ? 'on' : '' }); b.addEventListener('click', () => { type = t; paintSeg(segT, t); reset(); }); segT.append(b); });
  const segF = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Filter placement' });
  [['none', 'no filter'], ['on', "status='paid' in ON"], ['where', "status='paid' in WHERE"]].forEach(([v, l]) => { const b = el('button', { text: l, class: v === filt ? 'on' : '' }); b.addEventListener('click', () => { filt = v; paintSeg(segF, l); reset(); }); segF.append(b); });
  function paintSeg(seg, txt) { [...seg.children].forEach((b) => b.classList.toggle('on', b.textContent === txt)); }
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const sqlLine = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const W = 760, RH = 34, TOP = 56, LX = 20, RX = 470, TW = 270;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${TOP + RH * 4 + 20}`, role: 'img', 'aria-label': 'Customers table on the left, orders table on the right, lines showing matches' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: 'Press Play to start.' }));
  const resHost = el('div', { class: 'tscroll' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('jv');
  root.append(el('div', { class: 'w-controls' }, segT), el('div', { class: 'w-controls' }, segF), sqlLine,
    el('div', { class: 'w-stage' }, stage), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset), narr,
    el('h3', { class: 'sub-h', text: 'Result', style: { fontSize: '14px', margin: '12px 0 6px' } }), resHost, stats);

  const lRows = []; const rRows = []; const lines = svg('g');
  const cells = (x, y, vals, xs, fill) => vals.map((v, i) => svg('text', { x: x + xs[i], y, 'font-size': 13, fill: v === 'NULL' ? 'var(--err)' : (fill || 'var(--text)'), text: String(v) }));
  const LXS = [10, 50], RXS = [10, 62, 150, 205];
  function drawTables() {
    stage.innerHTML = ''; lRows.length = 0; rRows.length = 0;
    const head = (x, t, cols, xs) => [svg('text', { x: x + 4, y: 22, 'font-size': 14, 'font-weight': 700, fill: 'var(--text)', text: t }), ...cols.map((c, i) => svg('text', { x: x + xs[i], y: 46, 'font-size': 11, fill: 'var(--text-3)', text: c }))];
    stage.append(...head(LX, 'customers c', ['id', 'name'], LXS), ...head(RX, 'orders o', ['id', 'cust_id', 'amount', 'status'], RXS), lines);
    C.forEach((c, i) => { const g = svg('g'); const r = svg('rect', { class: 'row-box', x: LX, y: TOP + i * RH, width: TW, height: RH - 6, rx: 6 });
      g.append(r, ...cells(LX, TOP + i * RH + 19, [c.id, c.name], LXS)); stage.append(g); lRows.push(r); });
    O.forEach((o, j) => { const g = svg('g'); const r = svg('rect', { class: 'row-box', x: RX, y: TOP + j * RH, width: TW, height: RH - 6, rx: 6 });
      g.append(r, ...cells(RX, TOP + j * RH + 19, [o.id, o.cid == null ? 'NULL' : o.cid, o.amt, o.st], RXS)); stage.append(g); rRows.push(r); });
  }
  // build the step list for the current settings
  function plan() {
    const onMatch = (c, o) => (type === 'CROSS' ? true : o.cid === c.id) && (filt === 'on' && type !== 'CROSS' ? o.st === 'paid' : true);
    const steps = []; const matchedR = new Set();
    C.forEach((c, i) => {
      const m = []; O.forEach((o, j) => { if (onMatch(c, o)) { m.push(j); matchedR.add(j); } });
      let rows = [];
      if (type === 'SEMI') rows = m.length ? [[c, null, 'semi']] : [];
      else if (type === 'ANTI') rows = m.length ? [] : [[c, null, 'semi']];
      else if (type === 'RIGHT') rows = m.map((j) => [c, O[j]]);
      else { rows = m.map((j) => [c, O[j]]); if (!m.length && (type === 'LEFT' || type === 'FULL')) rows = [[c, null]]; }
      const why = type === 'CROSS' ? `${c.name} pairs with every order (no predicate).`
        : m.length ? `${c.name} (id ${c.id}) matches ${m.map((j) => O[j].id).join(', ')}.`
        : `${c.name} has no match.` + ((type === 'LEFT' || type === 'FULL') ? ' Kept and padded with NULLs.' : type === 'ANTI' ? ' No match, so the anti-join keeps it.' : ' Dropped.');
      steps.push({ l: i, m, rows, why: type === 'SEMI' && m.length > 1 ? why + ' A semi-join emits it only once.' : why });
    });
    if (type === 'RIGHT' || type === 'FULL') O.forEach((o, j) => { if (!matchedR.has(j)) steps.push({ r: j, rows: [[null, o]], why: `Order ${o.id} matched no customer${o.cid == null ? ' (NULL never equals anything)' : ''}. Kept and padded with NULLs on the left.` }); });
    if (filt === 'where' && type !== 'SEMI' && type !== 'ANTI') steps.push({ where: true, why: "WHERE status = 'paid' runs last. Padded rows have status NULL, so the predicate is unknown and the row is dropped." + ((type === 'LEFT' || type === 'FULL') ? ' Your outer join is now effectively an inner join.' : '') });
    return steps;
  }
  let steps = []; let k = 0; let result = [];
  const isSemi = () => type === 'SEMI' || type === 'ANTI';
  function renderResult(dropMask) {
    const cols = isSemi() ? ['c.id', 'c.name'] : ['c.id', 'c.name', 'o.id', 'o.amount', 'o.status'];
    const cell = (v) => v == null ? el('td', { class: 'null', text: 'NULL' }) : el('td', { text: String(v) });
    const tb = el('tbody');
    result.forEach(([c, o], i) => {
      const vals = isSemi() ? [c.id, c.name] : [c && c.id, c && c.name, o && o.id, o && o.amt, o && o.st];
      const tr = el('tr', { style: { animation: reduced ? 'none' : 'capin .35s ease both' } }, vals.map(cell));
      if (dropMask && dropMask[i]) { tr.style.textDecoration = 'line-through'; tr.style.opacity = '.4'; }
      tb.append(tr);
    });
    resHost.innerHTML = ''; resHost.append(el('table', { class: 't rg' }, el('thead', null, el('tr', null, cols.map((h) => el('th', { text: h })))), tb));
    const kept = dropMask ? result.filter((_, i) => !dropMask[i]).length : result.length;
    stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `rows <b>${kept}</b>` }), el('span', { class: 'w-stat', html: `pairs examined <b>${Math.min(k, C.length) * O.length}</b> / ${C.length * O.length}` }));
  }
  function clearHi() { lRows.concat(rRows).forEach((r) => r.setAttribute('class', 'row-box')); lines.innerHTML = ''; }
  function applyStep(s) {
    clearHi();
    if (s.l != null) {
      lRows[s.l].setAttribute('class', 'row-box hot' + (s.m.length ? '' : ' miss'));
      s.m.forEach((j) => { rRows[j].setAttribute('class', 'row-box hot');
        const y1 = TOP + s.l * RH + 14, y2 = TOP + j * RH + 14;
        const p = svg('path', { class: 'match', d: `M${LX + TW} ${y1} C ${LX + TW + 90} ${y1}, ${RX - 90} ${y2}, ${RX} ${y2}` });
        if (!reduced) { p.style.strokeDasharray = '400'; p.style.strokeDashoffset = '400'; p.style.transition = 'stroke-dashoffset .5s ease'; requestAnimationFrame(() => { p.style.strokeDashoffset = '0'; }); }
        lines.append(p); });
    }
    if (s.r != null) rRows[s.r].setAttribute('class', 'row-box hot miss');
    let mask = null;
    if (s.where) mask = result.map(([, o]) => !(o && o.st === 'paid'));
    else result.push(...s.rows);
    renderResult(mask);
    narr.firstChild.textContent = s.why;
    if (s.where) result = result.filter((_, i) => !mask[i]);
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; result = []; steps = plan(); drawTables(); renderResult();
    const tail = isSemi() ? (filt === 'on' ? " AND o.status = 'paid')" : ')') : (filt === 'on' && type !== 'CROSS' ? " AND o.status = 'paid'" : '') + (filt === 'where' ? "\nWHERE o.status = 'paid'" : '');
    sqlLine.innerHTML = ''; sqlLine.append(el('pre', { html: IA.highlight('SELECT ' + (isSemi() ? 'c.*' : 'c.*, o.*') + '\n' + SQL[type] + tail, 'sql') }));
    narr.firstChild.textContent = type === 'CROSS' ? 'CROSS JOIN: no predicate, so every pair survives. 4 × 4 = 16 rows.' : 'Press Play or Step to walk the outer loop one customer at a time.';
    bStep.disabled = false;
  }
  function step() { if (k >= steps.length) return false; applyStep(steps[k++]); if (k >= steps.length) { bStep.disabled = true; clearHi(); narr.firstChild.textContent += ` Done: ${result.length} rows.`; } return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 300 : 1400);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

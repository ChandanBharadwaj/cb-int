/* Recursive CTE: anchor → working table → join → new working table, until empty. Cycle + guard choices. */
IA.widget('recursive-ctes', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const E = [[1, 'Ada', null, 320, 46], [2, 'Bo', 1, 170, 130], [3, 'Cy', 1, 470, 130], [4, 'Di', 2, 90, 214], [5, 'Ed', 2, 250, 214], [6, 'Fa', 3, 470, 214], [7, 'Gu', 4, 90, 298]];
  const COL = ['var(--accent)', 'var(--ok)', 'var(--warn)', 'var(--err)', 'var(--text-2)'];
  const CAP = 6;
  let cyc = false; let guard = 'none'; let speed = 2400; let gen = 0; let running = false;
  const seg = (label, items, cur, on) => { const s = el('div', { class: 'seg', 'aria-label': label });
    items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segC = seg('Data', [[false, 'clean tree'], [true, 'bad data: Ada reports to Gu (cycle)']], cyc, (v) => { cyc = v; reset(); });
  const segG = seg('Guard', [['none', 'UNION ALL'], ['union_depth', 'UNION, rows carry depth'], ['union_id', 'UNION, rows = (id) only'], ['path', 'path array / CYCLE']], guard, (v) => { guard = v; reset(); });
  const segS = seg('Speed', [[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const sqlBox = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const st = svg('svg', { viewBox: '0 0 640 340', role: 'img', 'aria-label': 'Org chart; nodes light up as each iteration of the working table reaches them' });
  const wt = el('div', { class: 'tscroll' }); const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: '' })); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segC), el('div', { class: 'w-controls' }, segG), sqlBox, el('div', { class: 'w-stage' }, st), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, el('div', { class: 'tiny', text: 'working table (rows produced by the latest iteration)', style: { margin: '8px 0 4px' } }), wt, stats);
  const mgr = (id) => (id === 1 ? (cyc ? 7 : null) : E.find((e) => e[0] === id)[2]);
  const kids = (id) => E.filter((e) => mgr(e[0]) === id).map((e) => e[0]);
  const nm = (id) => E.find((e) => e[0] === id)[1];
  let it = 0; let working = []; let result = []; let visits = {}; let done = false; const nodeEls = {}; const badge = {};
  function drawTree() {
    st.innerHTML = '';
    E.forEach(([id, , m, x, y]) => { if (m) { const p = E.find((e) => e[0] === m); st.append(svg('line', { x1: p[3], y1: p[4] + 22, x2: x, y2: y - 22, stroke: 'var(--border)', 'stroke-width': 2 })); } });
    if (cyc) st.append(svg('path', { d: 'M 52 298 C 0 200, 120 30, 262 40', fill: 'none', stroke: 'var(--err)', 'stroke-width': 3, 'stroke-dasharray': '8 6' }), svg('text', { x: 6, y: 150, 'font-size': 16, fill: 'var(--err)', text: 'Ada.mgr = Gu' }));
    E.forEach(([id, n, , x, y]) => { const r = svg('rect', { x: x - 56, y: y - 22, width: 112, height: 44, rx: 12, fill: 'var(--surface-2)', stroke: 'var(--border)', 'stroke-width': 2 });
      const t = svg('text', { x, y: y + 7, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 700, fill: 'var(--text)', text: n });
      const b = svg('text', { x: x + 50, y: y - 26, 'text-anchor': 'end', 'font-size': 15, fill: 'var(--text-3)', text: '' });
      nodeEls[id] = { r, t }; badge[id] = b; st.append(r, t, b); });
  }
  const key = (r) => (guard === 'union_id' ? String(r.id) : r.id + ':' + r.depth);
  function paint() {
    E.forEach(([id]) => { const inW = working.find((w) => w.id === id); nodeEls[id].r.setAttribute('fill', inW ? COL[(it) % COL.length] : visits[id] ? 'var(--accent-soft)' : 'var(--surface-2)');
      nodeEls[id].t.setAttribute('fill', inW ? '#fff' : 'var(--text)'); badge[id].textContent = visits[id] ? (visits[id] > 1 ? `×${visits[id]}` : 'd' + result.find((r) => r.id === id).depth) : ''; badge[id].setAttribute('fill', visits[id] > 1 ? 'var(--err)' : 'var(--text-3)'); });
    wt.innerHTML = ''; const cols = guard === 'union_id' ? ['id', 'name'] : guard === 'path' ? ['id', 'name', 'depth', 'path'] : ['id', 'name', 'depth'];
    wt.append(el('table', { class: 't rg' }, el('thead', null, el('tr', null, cols.map((c) => el('th', { text: c })))), el('tbody', null, working.length ? working.map((w) => el('tr', null, cols.map((c) => el('td', { text: c === 'name' ? nm(w.id) : c === 'path' ? '{' + w.path.join(',') + '}' : String(w[c]) })))) : el('tr', null, el('td', { class: 'null', colspan: String(cols.length), text: '(empty → recursion stops)' })))));
    stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `iteration <b>${it}</b>` }), el('span', { class: 'w-stat', html: `result rows <b>${result.length}</b>` }));
  }
  function step() {
    if (done) return false;
    if (it === 0 && !working.length && !result.length) { working = [{ id: 1, depth: 0, path: [1] }]; result = working.slice(); visits = { 1: 1 }; paint();
      narr.firstChild.textContent = 'Anchor: the non-recursive part runs once. Its rows (Ada) go into the result AND become the working table.'; return true; }
    it++; const seen = new Set(result.map(key)); const next = []; const notes = [];
    working.forEach((w) => kids(w.id).forEach((c) => { const r = { id: c, depth: w.depth + 1, path: w.path.concat(c) };
      if (guard === 'path' && w.path.includes(c)) { notes.push(`${nm(c)} is already in the path {${w.path.join(',')}}: cycle detected, not followed`); return; }
      if (guard.startsWith('union')) { const kk = key(r); if (seen.has(kk)) { notes.push(`${nm(c)} duplicates a row already in the result: UNION discards it`); return; } seen.add(kk); }
      next.push(r); }));
    working = next; result = result.concat(next); next.forEach((r) => { visits[r.id] = (visits[r.id] || 0) + 1; }); paint();
    let why = next.length ? `Iteration ${it}: join employees to the working table (e.mgr = w.id). New rows: ${next.map((r) => nm(r.id)).join(', ')}. They replace the working table and are appended to the result.` : `Iteration ${it}: the join produced no rows. Working table is empty, so the recursion stops. Result: ${result.length} rows.`;
    if (notes.length) why += ' ' + notes.join('; ') + '.';
    if (!next.length) { done = true; bStep.disabled = true; }
    else if (it >= CAP) { done = true; bStep.disabled = true; why += ` …and it never ends: the cycle feeds Ada back in every 4 iterations${guard === 'union_depth' ? ' (UNION can’t help: depth makes every row unique)' : ''}. In production this runs until statement_timeout, or fills temp disk.`; }
    narr.firstChild.textContent = why; return true;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; it = 0; working = []; result = []; visits = {}; done = false; bStep.disabled = false; drawTree(); paint();
    const sel = guard === 'union_id' ? 'id' : 'id, depth'; const u = guard.startsWith('union') ? 'UNION' : 'UNION ALL';
    const sql = guard === 'path' ? `WITH RECURSIVE org AS (\n  SELECT id, 0 AS depth, ARRAY[id] AS path FROM emp WHERE id = 1\n  UNION ALL\n  SELECT e.id, o.depth + 1, o.path || e.id\n  FROM emp e JOIN org o ON e.mgr = o.id\n  WHERE e.id <> ALL (o.path)          -- or PG14+: CYCLE id SET is_cycle USING path\n)\nSELECT * FROM org;`
      : `WITH RECURSIVE org AS (\n  SELECT ${sel === 'id' ? 'id' : 'id, 0 AS depth'} FROM emp WHERE id = 1   -- anchor\n  ${u}\n  SELECT ${sel === 'id' ? 'e.id' : 'e.id, o.depth + 1'}                        -- recursive term\n  FROM emp e JOIN org o ON e.mgr = o.id\n)\nSELECT * FROM org;`;
    sqlBox.innerHTML = ''; sqlBox.append(el('pre', { html: IA.highlight(sql, 'sql') }));
    narr.firstChild.textContent = 'Press Play. The colored nodes are the current working table: the only rows the recursive term can see.';
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (done) reset(); running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 600 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

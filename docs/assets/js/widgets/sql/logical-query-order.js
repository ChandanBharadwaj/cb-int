/* Logical query order: rows flow through FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT. */
IA.widget('logical-query-order', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-lqo-css')) document.head.append(el('style', { id: 'w-lqo-css', text: `
.w-lqo-pipe{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0}
.w-lqo-chip{font-family:var(--mono);font-size:11.5px;padding:3px 7px;border-radius:999px;border:1px solid var(--border);color:var(--text-3);background:var(--surface)}
.w-lqo-chip.done{color:var(--text-2);border-color:var(--text-3)}
.w-lqo-chip.cur{color:var(--accent);border-color:var(--accent);background:var(--accent-soft);font-weight:700}
.w-lqo-chip.bad{color:var(--err);border-color:var(--err)}
.w-lqo-sql{font-family:var(--mono);font-size:12.5px;border:1px solid var(--border);border-radius:8px;padding:6px 0;background:var(--surface);margin-bottom:8px;overflow-x:auto}
.w-lqo-sql div{padding:1px 10px;white-space:pre;border-left:3px solid transparent;display:flex;gap:10px}
.w-lqo-sql div.cur{background:var(--accent-soft);border-left-color:var(--accent)}
.w-lqo-sql div.bad{background:color-mix(in srgb,var(--err) 15%,transparent);border-left-color:var(--err)}
.w-lqo-sql i{font-style:normal;color:var(--text-3);min-width:1.4em;text-align:right}
.w-lqo tr.drop td{text-decoration:line-through;opacity:.4}
.w-lqo tr.drop td:first-child{box-shadow:inset 3px 0 0 var(--err)}
.w-lqo th.newc{color:var(--accent)}` }));
  root.classList.add('w-lqo');
  const C = { 1: ['Asha', 'Pune'], 2: ['Ben', 'Austin'], 3: ['Chen', 'Pune'], 4: ['Dina', 'Oslo'], 5: ['Eve', 'Lima'] };
  const O = [[101, 1, 250, 'paid'], [102, 1, 80, 'refunded'], [103, 2, 40, 'paid'], [104, null, 99, 'paid'], [105, 3, 120, 'paid'], [106, 4, 30, 'paid'], [107, 2, 90, 'paid'], [108, 4, 20, 'refunded'], [109, 5, 60, 'paid']];
  let filt = 'having'; let lim = 'yes'; let gen = 0; let k = 0; let running = false; let speed = 2400; let steps = [];
  const seg = (opts, cur, on) => { const s = el('div', { class: 'seg' }); opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segF = seg([['having', 'HAVING SUM(o.amount) > 50'], ['where', 'WHERE … AND total > 50'], ['halias', 'HAVING total > 50']], filt, (v) => { filt = v; reset(); });
  const segL = seg([['yes', 'LIMIT 2'], ['no', 'no LIMIT']], lim, (v) => { lim = v; reset(); });
  const pipe = el('div', { class: 'w-lqo-pipe' });
  const sqlHost = el('div', { class: 'w-lqo-sql' });
  const tbl = el('div', { class: 'tscroll' });
  const stats = el('div', { class: 'w-stats' });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; });
  const num = el('span', { class: 'n', text: '0' });
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, num, el('div', { class: 't' }));
  const say = (h) => cap.replaceChild(el('div', { class: 't', html: h }), cap.lastChild);
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'filter on the total:' }), segF), el('div', { class: 'w-controls' }, segL),
    sqlHost, pipe, el('div', { class: 'w-controls' }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), cap, tbl, stats);

  const STAGES = ['FROM', 'JOIN', 'WHERE', 'GROUP BY', 'HAVING', 'SELECT', 'DISTINCT', 'ORDER BY', 'LIMIT'];
  const LINE = { FROM: 1, JOIN: 2, WHERE: 3, 'GROUP BY': 4, HAVING: 5, SELECT: 0, DISTINCT: 0, 'ORDER BY': 6, LIMIT: 7 };
  function sqlLines() {
    return ['SELECT DISTINCT c.city, SUM(o.amount) AS total', 'FROM orders o', 'JOIN customers c ON c.id = o.customer_id',
      "WHERE o.status = 'paid'" + (filt === 'where' ? ' AND total > 50' : ''), 'GROUP BY c.city',
      filt === 'halias' ? 'HAVING total > 50' : filt === 'having' ? 'HAVING SUM(o.amount) > 50' : '', 'ORDER BY total DESC', lim === 'yes' ? 'LIMIT 2' : ''];
  }
  let lineEls = []; let chipEls = [];
  function drawSql() {
    sqlHost.innerHTML = ''; lineEls = sqlLines().map((t, i) => { if (!t) return null; const d = el('div', null, el('i', { text: String(i + 1) }), el('span', { html: IA.highlight(t, 'sql') })); sqlHost.append(d); return d; });
    pipe.innerHTML = ''; chipEls = STAGES.map((s, i) => { const c = el('span', { class: 'w-lqo-chip', text: (i + 1) + ' ' + s }); pipe.append(c); return c; });
  }
  function grid(cols, rows, mask, newCols) {
    const cell = (v) => v == null ? el('td', { class: 'null', text: 'NULL' }) : el('td', { text: String(v) });
    tbl.innerHTML = '';
    tbl.append(el('table', { class: 't rg' }, el('thead', null, el('tr', null, cols.map((h) => el('th', { text: h, class: newCols && newCols.includes(h) ? 'newc' : '' })))),
      el('tbody', null, rows.map((r, i) => el('tr', { class: mask && mask[i] ? 'drop' : '', style: { animation: reduced ? 'none' : 'capin .35s ease both' } }, r.map(cell))))));
    const kept = mask ? rows.filter((_, i) => !mask[i]).length : rows.length;
    stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `rows <b>${kept}</b>` + (mask && kept !== rows.length ? ` (was ${rows.length})` : '') }));
  }
  function plan() {
    const s = [];
    const joinRows = O.map(([id, cid, amt, st]) => [id, cid, amt, st, cid ? C[cid][0] : null, cid ? C[cid][1] : null]);
    const JC = ['o.id', 'o.customer_id', 'o.amount', 'o.status', 'c.name', 'c.city'];
    s.push({ st: 'FROM', show: () => grid(JC.slice(0, 4), O), cap: '<b>FROM</b> runs first: it names the input. Here: all 9 rows of <code>orders</code>. No column alias from SELECT exists yet.' });
    const jm = joinRows.map((r) => r[1] == null);
    s.push({ st: 'JOIN', show: () => grid(JC, joinRows, jm, ['c.name', 'c.city']), cap: '<b>JOIN</b> pairs each order with its customer. Order 104 has <code>customer_id NULL</code>, which matches nothing, so the inner join drops it. Columns from <code>c</code> appear.' });
    const r1 = joinRows.filter((_, i) => !jm[i]);
    if (filt === 'where') {
      s.push({ st: 'WHERE', bad: true, show: () => grid(JC, r1), cap: '<b>ERROR: column "total" does not exist.</b> WHERE runs before SELECT, so the alias <code>total</code> hasn’t been defined. Also, an aggregate like SUM can’t be in WHERE at all: groups don’t exist yet. Use HAVING.' });
      return s;
    }
    const wm = r1.map((r) => r[3] !== 'paid');
    s.push({ st: 'WHERE', show: () => grid(JC, r1, wm), cap: '<b>WHERE</b> filters individual rows: the two refunded orders (102, 108) go. It sees only FROM/JOIN columns, row by row, before any grouping.' });
    const r2 = r1.filter((_, i) => !wm[i]);
    const groups = {}; r2.forEach((r) => { (groups[r[5]] = groups[r[5]] || []).push(r); });
    const G = Object.entries(groups).map(([city, rs]) => [city, rs.map((r) => r[0]).join(', '), rs.length, rs.reduce((a, r) => a + r[2], 0)]);
    const GC = ['c.city', 'orders in group', 'count(*)', 'SUM(o.amount)'];
    s.push({ st: 'GROUP BY', show: () => grid(GC, G, null, ['SUM(o.amount)']), cap: `<b>GROUP BY c.city</b> collapses ${r2.length} rows into ${G.length} groups. From here on, only grouped columns and aggregates are allowed: <code>o.id</code> no longer means a single value.` });
    if (filt === 'halias') {
      s.push({ st: 'HAVING', bad: true, show: () => grid(GC, G), cap: '<b>ERROR: column "total" does not exist.</b> HAVING also runs before SELECT. Postgres doesn’t let HAVING see output aliases. Repeat the expression: <code>HAVING SUM(o.amount) &gt; 50</code>.' });
      return s;
    }
    const hm = G.map((g) => !(g[3] > 50));
    s.push({ st: 'HAVING', show: () => grid(GC, G, hm), cap: '<b>HAVING</b> filters groups, after aggregation: Oslo’s total is 30, so its group is dropped. (Window functions would be computed right after this step.)' });
    const G2 = G.filter((_, i) => !hm[i]);
    const S1 = G2.map((g) => [g[0], g[3]]);
    s.push({ st: 'SELECT', show: () => grid(['city', 'total'], S1, null, ['total']), cap: '<b>SELECT</b> evaluates the output list. Only now is <code>SUM(o.amount)</code> named <code>total</code>. Every clause after this point can use the alias.' });
    s.push({ st: 'DISTINCT', show: () => grid(['city', 'total'], S1), cap: '<b>DISTINCT</b> removes duplicate output rows. Each city is already one group, so nothing changes here. DISTINCT compares the projected values, not the input rows.' });
    const S2 = S1.slice().sort((a, b) => b[1] - a[1]);
    s.push({ st: 'ORDER BY', show: () => grid(['city', 'total'], S2), cap: '<b>ORDER BY total DESC</b> works because SELECT has already run. The alias must stand alone: <code>ORDER BY total + 1</code> fails, since the alias isn’t visible inside an expression.' });
    if (lim === 'yes') {
      s.push({ st: 'LIMIT', show: () => grid(['city', 'total'], S2, S2.map((_, i) => i >= 2)), cap: '<b>LIMIT 2</b> keeps the first two rows of the sorted result. Without ORDER BY, “first two” would be arbitrary. The planner can use this to stop early (top-N sort).' });
    } else s.push({ st: 'LIMIT', show: () => grid(['city', 'total'], S2), cap: 'No LIMIT: all rows are returned. Logical order is a <i>meaning</i>, not an execution plan: the planner may push filters down or stop early, as long as the result is the same.' });
    return s;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = plan(); drawSql(); grid(['o.id', 'o.customer_id', 'o.amount', 'o.status'], []);
    num.textContent = '0/' + steps.length; bStep.disabled = false;
    say('You <i>write</i> SELECT first, but it runs sixth. Press Play to watch the rows flow through each clause in logical order.');
  }
  function step() {
    if (k >= steps.length) return false; const s = steps[k++];
    const si = STAGES.indexOf(s.st);
    chipEls.forEach((c, i) => { c.className = 'w-lqo-chip' + (i < si ? ' done' : i === si ? (s.bad ? ' bad' : ' cur') : ''); });
    lineEls.forEach((l, i) => { if (l) l.className = i === LINE[s.st] ? (s.bad ? 'bad' : 'cur') : ''; });
    s.show(); say(s.cap); num.textContent = k + '/' + steps.length; if (k >= steps.length) bStep.disabled = true; return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 600 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

/* CTE inlining vs materialization: does the outer predicate get pushed into the scan or stop at the fence? */
IA.widget('ctes', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  const MODES = {
    once: { l: 'PG16 default, used once', inline: true, sql: 'WITH o AS (SELECT * FROM orders)\nSELECT * FROM o WHERE customer_id = 42;', why: 'Non-recursive, no side effects, no volatile functions, referenced once → PG12+ inlines it like a subquery.' },
    twice: { l: 'default, used twice', inline: false, sql: 'WITH o AS (SELECT * FROM orders)\nSELECT * FROM o a JOIN o b USING (customer_id)\nWHERE a.customer_id = 42;', why: 'Referenced twice → the default is to compute it once and materialize it, so the predicate can’t reach the scan.' },
    mat: { l: 'AS MATERIALIZED', inline: false, sql: 'WITH o AS MATERIALIZED (SELECT * FROM orders)\nSELECT * FROM o WHERE customer_id = 42;', why: 'MATERIALIZED forces an optimization fence: the CTE runs as written, into a tuplestore.' },
    notmat: { l: 'AS NOT MATERIALIZED (used twice)', inline: true, sql: 'WITH o AS NOT MATERIALIZED (SELECT * FROM orders)\nSELECT * FROM o a JOIN o b USING (customer_id)\nWHERE a.customer_id = 42;', why: 'NOT MATERIALIZED inlines it into each reference. The predicate is pushed into both scans (and the scan runs twice).' },
    pg11: { l: 'PG11 and older', inline: false, sql: 'WITH o AS (SELECT * FROM orders)\nSELECT * FROM o WHERE customer_id = 42;', why: 'Before PG12 every CTE was an optimization fence, which people relied on as a hint.' },
    dml: { l: 'data-modifying / volatile', inline: false, sql: 'WITH o AS (SELECT *, random() r FROM orders)\nSELECT * FROM o WHERE customer_id = 42;', why: 'Volatile functions (random(), nextval) or INSERT/UPDATE/DELETE in the CTE → never inlined: it must run exactly once.' }
  };
  let mode = 'once'; let speed = 2400; let gen = 0; let running = false; let k = 0;
  const segM = el('div', { class: 'seg', 'aria-label': 'CTE variant' });
  Object.entries(MODES).forEach(([v, m]) => { const b = el('button', { text: m.l, class: v === mode ? 'on' : '' }); b.addEventListener('click', () => { mode = v; [...segM.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); segM.append(b); });
  const segS = el('div', { class: 'seg', 'aria-label': 'Speed' });
  [['Slow', 3600], ['Normal', 2400], ['Fast', 1100]].forEach(([l, v]) => { const b = el('button', { text: l, class: v === speed ? 'on' : '' }); b.addEventListener('click', () => { speed = v; [...segS.children].forEach((x) => x.classList.toggle('on', x === b)); }); segS.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const sqlBox = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const W = 640; const H = 330; const st = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Plan tree: outer query, CTE boundary and table scan; a predicate chip moves down' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: '' }));
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), sqlBox, el('div', { class: 'w-stage' }, st), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);
  let chip; let nodes = {};
  const box = (x, y, w, h, title, sub, dashed) => { const g = svg('g'); const r = svg('rect', { x, y, width: w, height: h, rx: 12, fill: 'var(--surface-2)', stroke: 'var(--border)', 'stroke-width': 2, 'stroke-dasharray': dashed ? '8 6' : '' });
    const t = svg('text', { x: x + 16, y: y + 30, 'font-size': 20, 'font-weight': 700, fill: 'var(--text)', text: title }); const s = svg('text', { x: x + 16, y: y + 56, 'font-size': 17, fill: 'var(--text-2)', text: sub });
    g.append(r, t, s); st.append(g); return { r, t, s }; };
  function draw() {
    st.innerHTML = ''; const M = MODES[mode];
    nodes.top = box(30, 14, 580, 70, 'Outer query', 'SELECT * FROM o …');
    nodes.mid = box(30, 128, 580, 70, 'CTE o', M.inline ? 'will be inlined?' : 'will be materialized?', true);
    nodes.bot = box(30, 242, 580, 70, 'Scan on orders', '1,000,000 rows, index on customer_id');
    st.append(svg('line', { x1: 320, y1: 84, x2: 320, y2: 128, stroke: 'var(--border)', 'stroke-width': 2 }), svg('line', { x1: 320, y1: 198, x2: 320, y2: 242, stroke: 'var(--border)', 'stroke-width': 2 }));
    chip = svg('g', { style: { transition: reduced ? 'none' : 'transform 1.1s ease, opacity 1.4s ease' } });
    chip.append(svg('rect', { x: 360, y: 30, width: 236, height: 38, rx: 19, fill: 'var(--accent)' }), svg('text', { x: 478, y: 55, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, fill: '#fff', text: 'customer_id = 42' }));
    st.append(chip);
  }
  const STEPS = [
    () => { const M = MODES[mode]; nodes.mid.s.textContent = M.inline ? 'inlined: becomes a plain subquery' : 'fence: computed on its own'; nodes.mid.r.setAttribute('stroke', M.inline ? 'var(--ok)' : 'var(--err)');
      if (M.inline) nodes.mid.r.setAttribute('stroke-dasharray', '2 8'); return 'Planner decides: ' + M.why; },
    () => { const M = MODES[mode]; chip.style.transform = M.inline ? 'translate(0px, 114px)' : 'translate(0px, 96px)';
      return M.inline ? 'The predicate slides through the dissolved boundary…' : 'The predicate slides down… and hits the fence. It has to wait above the CTE Scan.'; },
    () => { const M = MODES[mode];
      if (M.inline) { chip.style.transform = 'translate(0px, 228px)'; chip.style.opacity = '0'; nodes.bot.t.textContent = 'Index Scan on orders (customer_idx)'; nodes.bot.s.textContent = 'Index Cond: customer_id = 42 → 12 rows'; nodes.bot.r.setAttribute('stroke', 'var(--ok)');
        return 'Pushed down into the scan: Postgres uses the index and reads ~12 rows.' + (mode === 'notmat' ? ' This happens for each reference (two scans), but each is tiny.' : ''); }
      nodes.bot.t.textContent = 'Seq Scan on orders'; nodes.bot.s.textContent = 'all 1,000,000 rows → tuplestore (work_mem, then disk)'; nodes.bot.r.setAttribute('stroke', 'var(--err)');
      nodes.mid.t.textContent = 'CTE Scan on o'; return 'Without the predicate, the CTE body runs as written: read every row and materialize them.'; },
    () => { const M = MODES[mode];
      if (M.inline) { nodes.top.s.textContent = 'returns 12 rows'; return 'Done. Same result either way; the difference is only how much work it took.'; }
      nodes.top.s.textContent = 'Filter: customer_id = 42 (removed 999,988 rows)'; return 'Finally the filter runs on the CTE Scan output: 999,988 rows read and thrown away. Same 12 rows, ~1000× the work.'; }
  ];
  function step() {
    if (k >= STEPS.length) return false; narr.firstChild.textContent = STEPS[k++]();
    const M = MODES[mode]; stats.innerHTML = '';
    if (k >= 3) stats.append(el('span', { class: 'w-stat', html: `rows read <b>${M.inline ? (mode === 'notmat' ? '~24' : '~12') : '1,000,000'}</b>` }), el('span', { class: 'w-stat', html: `plan node <b>${M.inline ? 'Index Scan' : 'CTE Scan + Seq Scan'}</b>` }));
    if (k >= STEPS.length) bStep.disabled = true; return true;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; bStep.disabled = false; stats.innerHTML = ''; draw();
    sqlBox.innerHTML = ''; sqlBox.append(el('pre', { html: IA.highlight(MODES[mode].sql, 'sql') }));
    narr.firstChild.textContent = 'Press Play. Watch where the WHERE predicate ends up.';
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= STEPS.length) reset(); running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 600 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

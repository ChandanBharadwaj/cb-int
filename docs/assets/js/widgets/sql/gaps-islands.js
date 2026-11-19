/* Gaps & islands: the (date - row_number) trick, animated row by row, with a duplicates trap. */
IA.widget('gaps-islands', (root, ctx) => {
  const { el, svg, sleep, reduced } = ctx;
  if (!document.getElementById('w-gi-style')) document.head.append(el('style', { id: 'w-gi-style', text: `
.w-gi-t td, .w-gi-t th { text-align: center; padding: 5px 9px; white-space: nowrap; }
.w-gi-t tr.cur td { outline: 2px solid var(--accent); outline-offset: -2px; font-weight: 700; }
.w-gi-b { display: inline-block; min-width: 46px; padding: 1px 6px; border-radius: 6px; color: #fff; font-weight: 600; }
.w-gi-sum { margin-top: 10px; }` }));
  const PAL = ['var(--accent)', 'var(--ok)', 'var(--warn)', 'var(--err)', 'var(--text-2)'];
  let dup = false; let fn = 'row_number'; let speed = 2400; let gen = 0; let running = false; let k = 0;
  const seg = (label, items, cur, on) => { const s = el('div', { class: 'seg', 'aria-label': label });
    items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segD = seg('Data', [[false, 'clean: one row per day'], [true, 'duplicate login on Mar 2']], dup, (v) => { dup = v; reset(); });
  const segF = seg('Numbering', [['row_number', 'row_number()'], ['dense_rank', 'dense_rank()']], fn, (v) => { fn = v; reset(); });
  const segS = seg('Speed', [[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const sqlBox = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const W = 700; const cal = svg('svg', { viewBox: `0 0 ${W} 92`, role: 'img', 'aria-label': 'Calendar of March 1 to 10; login days colored by island' });
  const tbody = el('tbody');
  const table = el('table', { class: 't rg w-gi-t' }, el('thead', null, el('tr', null, ['day', fn, 'day − n', 'island'].map((h) => el('th', { text: h })))), tbody);
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: '' }));
  const sum = el('div', { class: 'w-gi-sum' });
  root.append(el('div', { class: 'w-controls' }, segD), el('div', { class: 'w-controls' }, segF), sqlBox, el('div', { class: 'w-stage' }, cal),
    el('div', { class: 'tscroll' }, table), el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, sum);
  let rows = []; let keys = [];
  function build() {
    const days = dup ? [1, 2, 2, 3, 5, 6, 9] : [1, 2, 3, 5, 6, 9];
    let dr = 0; rows = days.map((d, i) => { if (i === 0 || d !== days[i - 1]) dr++; const n = fn === 'row_number' ? i + 1 : dr; return { d, n, g: d - n }; });
    keys = [...new Set(rows.map((r) => r.g))];
  }
  const col = (g) => PAL[keys.indexOf(g) % PAL.length];
  const anchor = (g) => { const dt = new Date(Date.UTC(2024, 2, g)); return dt.toISOString().slice(5, 10); };
  function drawCal(upto) {
    cal.innerHTML = ''; const cw = 64;
    for (let d = 1; d <= 10; d++) {
      const x = 10 + (d - 1) * (cw + 4); const hits = rows.filter((r, i) => r.d === d && i < upto);
      const has = rows.some((r) => r.d === d);
      const fill = hits.length ? col(hits[hits.length - 1].g) : has ? 'var(--surface-2)' : 'none';
      cal.append(svg('rect', { x, y: 10, width: cw, height: 46, rx: 8, fill, stroke: 'var(--border)', 'stroke-dasharray': has ? '' : '4 3' }),
        svg('text', { x: x + cw / 2, y: 41, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 700, fill: hits.length ? '#fff' : has ? 'var(--text)' : 'var(--text-3)', text: String(d) }));
      if (rows.filter((r) => r.d === d).length > 1) cal.append(svg('text', { x: x + cw / 2, y: 78, 'text-anchor': 'middle', 'font-size': 16, fill: 'var(--warn)', text: '×2' }));
      else if (!has) cal.append(svg('text', { x: x + cw / 2, y: 78, 'text-anchor': 'middle', 'font-size': 16, fill: 'var(--text-3)', text: 'gap' }));
    }
  }
  function render(upto) {
    tbody.innerHTML = '';
    rows.forEach((r, i) => { const shown = i < upto;
      tbody.append(el('tr', { class: i === upto - 1 ? 'cur' : '' }, el('td', { text: 'Mar ' + r.d }), el('td', { text: shown ? String(r.n) : '·' }),
        el('td', { text: shown ? `${r.d} − ${r.n} = ${anchor(r.g)}` : '·' }),
        el('td', null, shown ? el('span', { class: 'w-gi-b', style: { background: col(r.g) }, text: anchor(r.g) }) : '·'))); });
    drawCal(upto);
  }
  function summary() {
    sum.innerHTML = '';
    const t = el('tbody'); keys.forEach((g) => { const rs = rows.filter((r) => r.g === g); const ds = [...new Set(rs.map((r) => r.d))];
      t.append(el('tr', null, el('td', null, el('span', { class: 'w-gi-b', style: { background: col(g) }, text: anchor(g) })), el('td', { text: 'Mar ' + rs[0].d }), el('td', { text: 'Mar ' + rs[rs.length - 1].d }), el('td', { text: String(ds.length) + (rs.length !== ds.length ? ` (${rs.length} rows)` : '') }))); });
    sum.append(el('div', { class: 'tiny', text: 'GROUP BY island → one row per streak' }), el('div', { class: 'tscroll' }, el('table', { class: 't rg w-gi-t' }, el('thead', null, el('tr', null, ['island key', 'start', 'end', 'days'].map((h) => el('th', { text: h })))), t)));
  }
  function step() {
    if (k > rows.length) return false;
    if (k === rows.length) { k++; summary(); bStep.disabled = true;
      const broken = dup && fn === 'row_number';
      narr.firstChild.textContent = broken ? 'Broken twice: the duplicate Mar 2 consumed a number, so the real streak Mar 1–3 split into two keys, and the first half now shares its key with Mar 5–6, merging unrelated days. Still 3 islands, so a count-only test passes. Switch to dense_rank(), or DISTINCT the days first.'
        : `Done: ${keys.length} islands. Consecutive days share a key because both the day and n go up by exactly 1. A gap moves the day ahead faster than n, so the key changes.`;
      return true; }
    const r = rows[k++]; render(k);
    const prev = rows[k - 2];
    let why = `Mar ${r.d}: ${fn} = ${r.n}, so the key is Mar ${r.d} − ${r.n} = ${anchor(r.g)}.`;
    if (prev) why += prev.g === r.g ? ' Same key as the previous row: same island.' : r.d === prev.d ? ' Same day as the previous row, but row_number still advanced, so the key slipped back a day.' : ` The day jumped by ${r.d - prev.d} but n by ${r.n - prev.n}: new key, new island.`;
    narr.firstChild.textContent = why; return true;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; bStep.disabled = false; build(); sum.innerHTML = '';
    table.tHead.rows[0].cells[1].textContent = fn + '()';
    sqlBox.innerHTML = ''; sqlBox.append(el('pre', { html: IA.highlight(`SELECT min(day), max(day), count(*)\nFROM (SELECT day,\n        day - ${fn}() OVER (ORDER BY day)::int AS grp\n      FROM logins WHERE user_id = 1) s\nGROUP BY grp ORDER BY 1;`, 'sql') }));
    render(0); narr.firstChild.textContent = 'Press Play. Each row gets a number n; subtract it from the date. Consecutive dates collapse onto the same “anchor” date.';
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k > rows.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g0 = gen;
    while (running && g0 === gen && step()) await sleep(reduced ? 600 : speed);
    if (g0 === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

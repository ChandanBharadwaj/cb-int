/* Window frames: a sliding frame over ordered rows. ROWS vs RANGE vs GROUPS, the default-frame trap, EXCLUDE. */
IA.widget('window-frames', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-wf-style')) {
    document.head.append(el('style', { id: 'w-wf-style', text: `
.w-wf-t td, .w-wf-t th { text-align: right; padding: 5px 9px; transition: background .3s; }
.w-wf-t tr.in td { background: var(--accent-soft); }
.w-wf-t tr.cur td { outline: 2px solid var(--accent); outline-offset: -2px; font-weight: 700; }
.w-wf-t tr.ex td { background: var(--surface-2); color: var(--text-3); text-decoration: line-through; }
.w-wf-t td.peer { color: var(--warn); }
.w-wf-t td.out { color: var(--text-3); }
.w-wf-t td.res { color: var(--accent); font-weight: 600; }
.w-wf-sql { margin-bottom: 10px; }` }));
  }
  // day is the ORDER BY key; days 2 and 5 have ties (peers)
  const R = [[1, 10], [2, 20], [2, 5], [3, 30], [5, 15], [5, 25], [6, 40]].map(([d, a]) => ({ d, a }));
  const FR = {
    def: { l: 'default (no frame)', s: ['UP'], e: ['CR'] },
    upcr: { l: 'UNBOUNDED PRECEDING → CURRENT ROW', s: ['UP'], e: ['CR'] },
    p1cr: { l: '1 PRECEDING → CURRENT ROW', s: ['P', 1], e: ['CR'] },
    p1f1: { l: '1 PRECEDING → 1 FOLLOWING', s: ['P', 1], e: ['F', 1] },
    all: { l: 'UNBOUNDED → UNBOUNDED FOLLOWING', s: ['UP'], e: ['UF'] }
  };
  let mode = 'ROWS'; let fr = 'def'; let excl = 'NO OTHERS'; let speed = 2400; let gen = 0; let running = false; let k = 0;
  const seg = (label, items, cur, on) => { const s = el('div', { class: 'seg', 'aria-label': label });
    items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segM = seg('Frame mode', [['ROWS', 'ROWS'], ['RANGE', 'RANGE'], ['GROUPS', 'GROUPS']], mode, (v) => { mode = v; reset(); });
  const segF = seg('Frame bounds', Object.entries(FR).map(([k2, v]) => [k2, v.l]), fr, (v) => { fr = v; reset(); });
  const segE = seg('Exclude', [['NO OTHERS', 'EXCLUDE NO OTHERS'], ['CURRENT ROW', 'CURRENT ROW'], ['GROUP', 'GROUP'], ['TIES', 'TIES']], excl, (v) => { excl = v; reset(); });
  const segS = seg('Speed', [[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const sqlBox = el('div', { class: 'codebox w-wf-sql' });
  const tbody = el('tbody');
  const table = el('table', { class: 't rg w-wf-t' }, el('thead', null, el('tr', null, ['day', 'amt', 'peer grp', 'sum(amt)', 'last_value(amt)', 'count'].map((h) => el('th', { text: h })))), tbody);
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: 'Press Play.' }));
  const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'mode' }), segM),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'frame' }), segF),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'exclude' }), segE), sqlBox,
    el('div', { class: 'w-stage tscroll' }, table),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);

  const grp = []; let g = -1; R.forEach((r, i) => { if (i === 0 || r.d !== R[i - 1].d) g++; grp.push(g); });
  const effMode = () => (fr === 'def' ? 'RANGE' : mode);
  function frame(i) {
    const F = FR[fr]; const m = effMode(); const n = R.length;
    const bound = (b, isStart) => {
      const [t, off] = b;
      if (t === 'UP') return isStart ? 0 : 0; if (t === 'UF') return n - 1;
      if (m === 'ROWS') { if (t === 'CR') return i; return t === 'P' ? i - off : i + off; }
      if (m === 'RANGE') {
        const v = t === 'CR' ? R[i].d : t === 'P' ? R[i].d - off : R[i].d + off;
        const idx = R.map((r, j) => j).filter((j) => (isStart ? R[j].d >= v : R[j].d <= v));
        return isStart ? (idx.length ? idx[0] : n) : (idx.length ? idx[idx.length - 1] : -1);
      }
      const gv = t === 'CR' ? grp[i] : t === 'P' ? grp[i] - off : grp[i] + off;
      const idx = R.map((r, j) => j).filter((j) => (isStart ? grp[j] >= gv : grp[j] <= gv));
      return isStart ? (idx.length ? idx[0] : n) : (idx.length ? idx[idx.length - 1] : -1);
    };
    const s = Math.max(0, bound(F.s, true)); const e = Math.min(n - 1, bound(F.e, false));
    const inF = []; const ex = [];
    for (let j = s; j <= e; j++) {
      const peer = grp[j] === grp[i];
      const drop = (excl === 'CURRENT ROW' && j === i) || (excl === 'GROUP' && peer) || (excl === 'TIES' && peer && j !== i);
      (drop ? ex : inF).push(j);
    }
    return { inF, ex };
  }
  const results = [];
  function render(cur) {
    tbody.innerHTML = '';
    const f = cur == null ? { inF: [], ex: [] } : frame(cur);
    R.forEach((r, j) => {
      const res = results[j];
      const cls = [f.inF.includes(j) ? 'in' : '', f.ex.includes(j) ? 'ex' : '', j === cur ? 'cur' : ''].join(' ');
      const peer = cur != null && grp[j] === grp[cur] && j !== cur;
      tbody.append(el('tr', { class: cls },
        el('td', { class: peer ? 'peer' : '', text: String(r.d) }), el('td', { text: String(r.a) }), el('td', { class: 'out', text: 'g' + grp[j] }),
        el('td', { class: res ? 'res' : 'out', text: res ? (res.sum == null ? 'NULL' : String(res.sum)) : '·' }),
        el('td', { class: res ? 'res' : 'out', text: res ? (res.last == null ? 'NULL' : String(res.last)) : '·' }),
        el('td', { class: res ? 'res' : 'out', text: res ? String(res.cnt) : '·' })));
    });
  }
  function sqlText() {
    const F = FR[fr];
    const b = (x) => ({ UP: 'UNBOUNDED PRECEDING', UF: 'UNBOUNDED FOLLOWING', CR: 'CURRENT ROW', P: x[1] + ' PRECEDING', F: x[1] + ' FOLLOWING' })[x[0]];
    const fc = fr === 'def' ? (excl === 'NO OTHERS' ? '' : ' RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW') : ` ${mode} BETWEEN ${b(F.s)} AND ${b(F.e)}`;
    const ec = excl === 'NO OTHERS' ? '' : `\n            EXCLUDE ${excl}`;
    return `SELECT day, amt,\n       sum(amt)        OVER w,\n       last_value(amt) OVER w\nFROM sales\nWINDOW w AS (ORDER BY day${fc}${ec});`;
  }
  function step() {
    if (k >= R.length) return false;
    const i = k++; const f = frame(i);
    const vals = f.inF.map((j) => R[j].a);
    results[i] = { sum: vals.length ? vals.reduce((a, b) => a + b, 0) : null, last: vals.length ? R[f.inF[f.inF.length - 1]].a : null, cnt: vals.length };
    render(i);
    const m = effMode(); const peers = R.filter((r, j) => grp[j] === grp[i]).length;
    let why = `Row ${i + 1} (day ${R[i].d}, amt ${R[i].a}): frame = ${f.inF.length ? 'rows ' + f.inF.map((j) => j + 1).join(',') : 'empty'} → sum ${results[i].sum == null ? 'NULL' : results[i].sum}, last_value ${results[i].last == null ? 'NULL' : results[i].last}.`;
    if (fr === 'def') why += ' Default with ORDER BY is RANGE … CURRENT ROW, so the frame ends at the LAST PEER, not this row.';
    if (m === 'RANGE' && FR[fr].s[0] === 'P') why += ` RANGE 1 PRECEDING means day ≥ ${R[i].d - 1} (a value distance, not a row count).`;
    if (m === 'GROUPS' && FR[fr].s[0] === 'P') why += ' GROUPS counts peer groups: one group back, whatever its size.';
    if (m !== 'ROWS' && peers > 1 && FR[fr].e[0] === 'CR') why += ` Day ${R[i].d} has ${peers} peers; all of them are inside.`;
    if (m === 'ROWS' && peers > 1) why += ' ROWS ignores peers: ties are split by an arbitrary order unless you add a tiebreaker.';
    if (f.ex.length) why += ` EXCLUDE removed row${f.ex.length > 1 ? 's' : ''} ${f.ex.map((j) => j + 1).join(',')}.`;
    narr.firstChild.textContent = why;
    stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `mode <b>${m}</b>` }), el('span', { class: 'w-stat', html: `frame size <b>${f.inF.length}</b>` }), el('span', { class: 'w-stat', html: `row <b>${k}</b> / ${R.length}` }));
    if (k >= R.length) { bStep.disabled = true; narr.firstChild.textContent += ' Done. Compare the last_value column to what you expected.'; }
    return true;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; results.length = 0; bStep.disabled = false;
    sqlBox.innerHTML = ''; sqlBox.append(el('pre', { html: IA.highlight(sqlText(), 'sql') }));
    render(null); stats.innerHTML = '';
    narr.firstChild.textContent = fr === 'def' ? 'Default frame: ORDER BY with no frame clause means RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW (mode buttons are ignored). Watch last_value.' : 'Press Play or Step. Shaded rows are the frame; the outlined row is the current row; orange days are its peers.';
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= R.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g0 = gen;
    while (running && g0 === gen && step()) await sleep(reduced ? 600 : speed);
    if (g0 === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

/* Latest row per key: DISTINCT ON / ROW_NUMBER / LATERAL / anti-join, with a tie-breaker toggle. */
IA.widget('latest-per-key', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-lpk-css')) document.head.append(el('style', { id: 'w-lpk-css', text: `
.w-lpk table.t td,.w-lpk table.t th{white-space:nowrap}
.w-lpk tr.cur td{background:var(--accent-soft)}
.w-lpk tr.keep td{background:var(--accent-soft);font-weight:700}
.w-lpk tr.keep td:first-child{box-shadow:inset 4px 0 0 var(--ok)}
.w-lpk tr.drop td{opacity:.4;text-decoration:line-through}
.w-lpk tr.tie td:first-child{box-shadow:inset 4px 0 0 var(--warn)}
.w-lpk .note{color:var(--text-2);font-size:12px}
.w-lpk .devs{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
.w-lpk .dev{border:1px solid var(--border);border-radius:8px;padding:6px 10px;background:var(--surface);font-size:13px}
.w-lpk .dev.cur{border-color:var(--accent);background:var(--accent-soft)}
.w-lpk .dev.none{border-color:var(--err);color:var(--err)}` }));
  const R = [
    { id: 1, d: 1, ts: '10:00', t: 20.1 }, { id: 2, d: 1, ts: '11:00', t: 20.5 }, { id: 3, d: 1, ts: '09:00', t: 19.8 },
    { id: 4, d: 2, ts: '10:00', t: 18.0 }, { id: 5, d: 2, ts: '12:00', t: 18.4 }, { id: 6, d: 2, ts: '12:00', t: 18.9 },
    { id: 7, d: 3, ts: '08:00', t: 25.0 }];
  const DEV = [1, 2, 3, 4];
  const byId = (id) => R.find((r) => r.id === id);
  const cmp = (tb) => (a, b) => a.d - b.d || b.ts.localeCompare(a.ts) || (tb ? b.id - a.id : 0);
  const SQL = {
    distinct: (tb) => `SELECT DISTINCT ON (device_id) *\nFROM readings\nORDER BY device_id, ts DESC${tb ? ', id DESC' : ''};`,
    rownum: (tb) => `SELECT * FROM (\n  SELECT r.*, row_number() OVER (\n    PARTITION BY device_id ORDER BY ts DESC${tb ? ', id DESC' : ''}) AS rn\n  FROM readings r) s\nWHERE rn = 1;`,
    lateral: (tb) => `SELECT d.id, r.*\nFROM devices d\nLEFT JOIN LATERAL (\n  SELECT * FROM readings r WHERE r.device_id = d.id\n  ORDER BY ts DESC${tb ? ', id DESC' : ''} LIMIT 1) r ON true;`,
    anti: (tb) => `SELECT r.* FROM readings r\nWHERE NOT EXISTS (\n  SELECT 1 FROM readings n WHERE n.device_id = r.device_id\n    AND ${tb ? '(n.ts, n.id) > (r.ts, r.id)' : 'n.ts > r.ts'});`
  };
  function build(st) {
    const tb = st.tb === 'yes'; const S = [];
    let order = R.map((r) => r.id), cls = {}, note = {}, devs = null, rowsRead = 0;
    const push = (say) => S.push({ say, order: order.slice(), cls: Object.assign({}, cls), note: Object.assign({}, note), devs: devs && devs.map((x) => Object.assign({}, x)), rowsRead });
    push('Seven readings in insertion order. Device 2 has <b>two readings at 12:00</b> (ids 5 and 6). Device 4 has none. Press Play.');
    if (st.m === 'distinct' || st.m === 'rownum') {
      order = R.slice().sort(cmp(tb)).map((r) => r.id); rowsRead = 7;
      if (!tb) { const i5 = order.indexOf(5), i6 = order.indexOf(6); if (i5 > i6) { order[i5] = 6; order[i6] = 5; } cls[5] = cls[6] = 'tie'; }
      push(`Sort by <code>device_id, ts DESC${tb ? ', id DESC' : ''}</code> (or read an index in that order). Every row is read.` + (tb ? '' : ' Ids 5 and 6 compare <b>equal</b>: their relative order is up to the sort, not you.'));
      let prev = null, n = 0;
      for (const id of order) { const r = byId(id);
        n = r.d === prev ? n + 1 : 1; const first = n === 1; prev = r.d;
        Object.keys(cls).forEach((k) => { if (cls[k] === 'cur') delete cls[k]; });
        cls[id] = first ? 'keep' : 'drop';
        if (st.m === 'rownum') note[id] = 'rn = ' + n; else note[id] = first ? 'first of device ' + r.d : 'same device → skip';
        if (r.d === 2 && !tb && first) note[id] += '  ⚠ arbitrary';
        push(st.m === 'rownum' ? `Row ${id}: device ${r.d}, ${r.ts} → <code>row_number</code> = ${n}. ${first ? 'Kept by <code>WHERE rn = 1</code>.' : 'Filtered out.'}` : `Row ${id}: ${first ? 'first row of device ' + r.d + ' in this order → <b>keep</b>.' : 'device ' + r.d + ' already emitted → skip (Unique node).'}` + (r.d === 2 && first && !tb ? ' Without a tie-breaker, this could just as well have been the other 12:00 row.' : ''));
      }
    } else if (st.m === 'lateral') {
      devs = DEV.map((d) => ({ d, c: '', got: '' }));
      push('Drive from the small <code>devices</code> table. For each device, run the subquery: one descent of the index <code>(device_id, ts DESC, id DESC)</code>, stop after 1 row.');
      for (const dv of devs) { devs.forEach((x) => { if (x.c === 'cur') x.c = ''; }); dv.c = 'cur';
        Object.keys(cls).forEach((k) => { if (cls[k] === 'cur') delete cls[k]; });
        const rows = R.filter((r) => r.d === dv.d).sort(cmp(tb));
        if (!rows.length) { dv.c = 'none'; dv.got = 'NULLs'; push(`Device ${dv.d}: the index has no entries → LIMIT 1 returns nothing. <code>LEFT JOIN … ON true</code> keeps the device with NULLs; <code>CROSS JOIN LATERAL</code> would drop it.`); continue; }
        const w = rows[0]; cls[w.id] = 'keep'; rowsRead += 1; dv.got = 'id ' + w.id; note[w.id] = 'LIMIT 1 for device ' + dv.d + (dv.d === 2 && !tb ? '  ⚠ arbitrary' : '');
        push(`Device ${dv.d}: seek to <code>device_id = ${dv.d}</code>, the first index entry is the newest: <b>id ${w.id}</b>. Other rows are never read.` + (dv.d === 2 && !tb ? ' Without <code>id DESC</code> either 12:00 row may come first.' : ''));
      }
    } else {
      push(`For each row, ask: is there a newer row for the same device? <code>${tb ? '(n.ts, n.id) &gt; (r.ts, r.id)' : 'n.ts &gt; r.ts'}</code>`);
      for (const r of R) { Object.keys(cls).forEach((k) => { if (cls[k] === 'cur') delete cls[k]; });
        const newer = R.filter((n) => n.d === r.d && (n.ts > r.ts || (tb && n.ts === r.ts && n.id > r.id)));
        rowsRead += 1;
        cls[r.id] = newer.length ? 'drop' : 'keep'; note[r.id] = newer.length ? 'newer: id ' + newer.map((n) => n.id).join(', ') : 'no newer row';
        push(`Row ${r.id} (device ${r.d}, ${r.ts}): ` + (newer.length ? `newer sibling exists (id ${newer.map((n) => n.id).join(', ')}) → drop.` : 'nothing newer → <b>keep</b>.') + (r.d === 2 && r.ts === '12:00' && !tb ? ' The other 12:00 row is not <i>strictly</i> newer, so <b>both</b> tied rows are kept.' : ''));
      }
    }
    Object.keys(cls).forEach((k) => { if (cls[k] === 'cur' || cls[k] === 'tie') delete cls[k]; });
    const kept = Object.values(cls).filter((v) => v === 'keep').length + (devs ? devs.filter((x) => x.c === 'none').length : 0);
    S.push(Object.assign({}, S[S.length - 1], { cls, say: `Done: <b>${kept} result rows</b>. ` + (tb ? 'With <code>id</code> as the tie-breaker the answer is deterministic: device 2 → id 6.' : (st.m === 'anti' ? 'The tie produced two rows for device 2.' : 'Device 2’s pick is arbitrary: it can change between runs or plans.')) + (st.m === 'lateral' ? ' LATERAL also reported device 4, which no sort-based method can see.' : '') }));
    return S;
  }
  const tableHost = el('div', { class: 'tscroll' }), devHost = el('div', { class: 'devs' });
  function draw(s, st, stats) {
    const tb = el('tbody');
    s.order.forEach((id) => { const r = byId(id);
      tb.append(el('tr', { class: s.cls[id] || '' }, el('td', { text: String(r.id) }), el('td', { text: String(r.d) }), el('td', { text: r.ts }), el('td', { text: r.t.toFixed(1) }), el('td', { class: 'note', text: s.note[id] || '' }))); });
    tableHost.innerHTML = ''; tableHost.append(el('table', { class: 't rg' }, el('thead', null, el('tr', null, ['id', 'device', 'ts', 'temp', ''].map((h) => el('th', { text: h })))), tb));
    devHost.innerHTML = '';
    if (s.devs) s.devs.forEach((x) => devHost.append(el('span', { class: 'dev ' + x.c, text: `device ${x.d}${x.got ? ' → ' + x.got : ''}` })));
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `rows read <b>${s.rowsRead}</b> / 7` }), el('span', { class: 'w-stat', html: `kept <b>${Object.values(s.cls).filter((v) => v === 'keep').length}</b>` }));
  }
  // ---- generic stepper ----
  const st = { m: 'distinct', tb: 'yes' }; let steps = [], k = 0, gen = 0, running = false, speed = 2400;
  const sqlBox = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const seg = (items, cur, on, lab) => { const s = el('div', { class: 'seg', 'aria-label': lab }); items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }), bStep = el('button', { class: 'btn', text: 'Step ›' }), bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-lpk');
  root.append(
    el('div', { class: 'w-controls' }, seg([['distinct', 'DISTINCT ON'], ['rownum', 'ROW_NUMBER'], ['lateral', 'LATERAL'], ['anti', 'Anti-join']], st.m, (v) => { st.m = v; reset(); }, 'Method')),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'tie-breaker id' }), seg([['yes', 'on'], ['no', 'off']], st.tb, (v) => { st.tb = v; reset(); }, 'Tie-breaker')),
    sqlBox, el('div', { class: 'w-stage' }, devHost, tableHost),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; }, 'Speed')),
    narr, stats);
  const show = () => { draw(steps[k], st, stats); narr.firstChild.innerHTML = steps[k].say; bStep.disabled = k >= steps.length - 1; };
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; steps = build(st); k = 0; sqlBox.innerHTML = ''; sqlBox.append(el('pre', { html: IA.highlight(SQL[st.m](st.tb === 'yes'), 'sql') })); show(); }
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

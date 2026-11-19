/* Top-N per group: modelled rows read / sorted for LATERAL+index, LATERAL no index, ROW_NUMBER, DISTINCT ON. */
IA.widget('lateral-top-n-compare', (root, ctx) => {
  const { el } = ctx;
  let G = 100000; let R = 100; let N = 3;
  const seg = (label, opts, cur, pick) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); pick(v); draw(); }); s.append(b); }); return s; };
  const host = el('div'); const verdict = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  root.append(
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'groups' }), seg('groups', [[1000, '1K'], [100000, '100K'], [5000000, '5M']], G, (v) => { G = v; })),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'rows / group' }), seg('rows per group', [[2, '2'], [100, '100'], [10000, '10K']], R, (v) => { R = v; })),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'N' }), seg('N', [[1, '1'], [3, '3'], [50, '50']], N, (v) => { N = v; })),
    host, verdict);
  const fmt = (x) => x >= 1e9 ? (x / 1e9).toFixed(1) + 'B' : x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : x >= 1e3 ? (x / 1e3).toFixed(1) + 'K' : String(Math.round(x));
  function draw() {
    const T = G * R; const keep = G * Math.min(N, R);
    const rows = [
      ['LATERAL + LIMIT, matching index', G * Math.min(N, R) + G * 3, 0, `${fmt(G)} index descents (~3 pages each) + ${fmt(keep)} entries`],
      ['ROW_NUMBER() … WHERE rn ≤ N', T, T, 'reads all rows; sorts them unless an index supplies the order'],
      ['DISTINCT ON (N = 1 only)', N === 1 ? T : NaN, N === 1 ? T : NaN, N === 1 ? 'reads all rows in group order, keeps the first' : 'cannot express N > 1'],
      ['LATERAL + LIMIT, no index', G * T, G * R, 'each loop scans the whole table, then sorts its group']
    ];
    const max = Math.log10(Math.max(...rows.map((r) => r[1]).filter((x) => !isNaN(x))) + 1);
    const tb = el('tbody');
    rows.forEach(([name, rd, so, note]) => {
      const w = isNaN(rd) ? 0 : Math.max(2, 100 * Math.log10(rd + 1) / max);
      tb.append(el('tr', null, el('td', { text: name }),
        el('td', null, isNaN(rd) ? el('span', { class: 'tiny', text: 'n/a' }) : el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
          el('div', { style: { height: '10px', width: w + '%', minWidth: '4px', background: rd > T * 2 ? 'var(--err)' : rd < T / 3 ? 'var(--ok)' : 'var(--warn)', borderRadius: '4px' } }),
          el('b', { text: fmt(rd), style: { fontFamily: 'var(--mono)', fontSize: '12px' } }))),
        el('td', { class: 'tiny', text: note })));
    });
    host.innerHTML = ''; host.append(el('div', { class: 'tscroll' }, el('table', { class: 't rg', style: { minWidth: '520px' } }, el('thead', null, el('tr', null, ['approach', 'rows read (log scale)', 'why'].map((h) => el('th', { text: h })))), tb)));
    const lat = rows[0][1];
    verdict.firstChild.textContent = lat < T / 3
      ? `LATERAL wins: it touches ${fmt(lat)} entries instead of ${fmt(T)}. Each group is large compared with N, so “seek and stop” pays off.`
      : `Close call or ROW_NUMBER wins: groups are tiny (${R} rows), so ${fmt(G)} random index descents cost about as much as one sequential pass over ${fmt(T)} rows. Measure with EXPLAIN (ANALYZE, BUFFERS).`;
  }
  draw();
});

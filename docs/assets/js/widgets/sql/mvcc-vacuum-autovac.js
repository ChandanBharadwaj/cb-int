/* Autovacuum trigger calculator: threshold + scale_factor × reltuples. */
IA.widget('mvcc-vacuum-autovac', (root, ctx) => {
  const { el } = ctx;
  const SIZES = [1e4, 1e5, 1e6, 1e7, 1e8, 1e9]; let n = 1e8; let sf = 0.2; let th = 50; let churn = 2e6;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); draw(); }); s.append(b); }); return s; };
  const fmt = (x) => x >= 1e9 ? (x / 1e9).toFixed(x % 1e9 ? 1 : 0) + 'B' : x >= 1e6 ? (x / 1e6).toFixed(x % 1e6 ? 1 : 0) + 'M' : x >= 1e3 ? (x / 1e3).toFixed(0) + 'k' : String(Math.round(x));
  const out = el('div'); const code = el('div');
  root.append(
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'rows (reltuples)' }), seg(SIZES.map((v) => [v, fmt(v)]), () => n, (v) => { n = v; }, 'Rows')),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'autovacuum_vacuum_scale_factor' }), seg([[0.2, '0.2 (default)'], [0.05, '0.05'], [0.01, '0.01'], [0, '0 (fixed threshold)']], () => sf, (v) => { sf = v; th = v === 0 ? 100000 : 50; }, 'Scale factor')),
    el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'updates+deletes per hour' }), seg([[2e4, '20k'], [2e5, '200k'], [2e6, '2M']], () => churn, (v) => { churn = v; }, 'Churn')),
    out, code);
  function draw() {
    const trig = th + sf * n; const hrs = trig / churn; const pct = Math.min(100, (trig / n) * 100);
    out.innerHTML = '';
    out.append(el('div', { class: 'w-stats' },
      el('span', { class: 'w-stat', html: `autovacuum starts after <b>${fmt(trig)}</b> dead tuples` }),
      el('span', { class: 'w-stat', html: `= <b>${pct < 0.01 ? '<0.01' : pct.toFixed(2)}%</b> of the table` }),
      el('span', { class: 'w-stat', html: `≈ every <b>${hrs < 1 ? Math.round(hrs * 60) + ' min' : hrs.toFixed(1) + ' h'}</b> at this churn` })),
      el('div', { style: { height: '14px', borderRadius: '7px', background: 'var(--surface-2)', border: '1px solid var(--border)', margin: '10px 0', overflow: 'hidden' } },
        el('div', { style: { width: Math.max(1, pct) + '%', height: '100%', background: pct > 10 ? 'var(--err)' : pct > 2 ? 'var(--warn)' : 'var(--ok)' } })),
      el('p', { class: 'tiny', html: sf === 0.2 && n >= 1e8 ? `With the default 0.2 a ${fmt(n)}-row table carries <b>${fmt(trig)}</b> dead tuples before anything happens, and then one huge, slow vacuum. Big hot tables need a per-table setting.` : 'Formula: <code>autovacuum_vacuum_threshold (50) + autovacuum_vacuum_scale_factor × reltuples</code>. ANALYZE uses 50 + 0.1 × reltuples. Insert-only tables (PG13+) use <code>autovacuum_vacuum_insert_threshold</code> 1000 + 0.2 × reltuples.' }));
    code.innerHTML = ''; code.append(ctx.codeBox(`ALTER TABLE orders SET (\n  autovacuum_vacuum_scale_factor = ${sf},\n  autovacuum_vacuum_threshold    = ${th}\n);`, 'sql'));
  }
  draw();
});

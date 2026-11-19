/* Cost intuition: toy cost model. Row counts + toggles -> bars for NL / NL+Memoize / Hash / Merge. */
IA.widget('join-algorithms-cost', (root, ctx) => {
  const { el } = ctx;
  if (!document.getElementById('w-jac-css')) document.head.append(el('style', { id: 'w-jac-css', text: `
.w-jac-row { display: grid; grid-template-columns: 150px 1fr 90px; gap: 8px; align-items: center; margin: 6px 0; font-size: 14px; }
.w-jac-bar { height: 18px; border-radius: 5px; background: var(--text-3); transition: width .35s ease; min-width: 2px; }
.w-jac-row.win .w-jac-bar { background: var(--ok); }
.w-jac-row.win { font-weight: 700; }
.w-jac-sl { display: grid; grid-template-columns: 170px 1fr 80px; gap: 8px; align-items: center; margin: 4px 0; font-size: 14px; }
.w-jac-sl input { width: 100%; }
@media (max-width: 520px) { .w-jac-row { grid-template-columns: 110px 1fr 64px; font-size: 12.5px; } .w-jac-sl { grid-template-columns: 1fr 70px; } .w-jac-sl label { grid-column: 1 / -1; } }` }));
  const st = { outer: 2, inner: 6, dist: 100, idx: true, sorted: false, wm: 4 };
  const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + ' M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + ' k' : String(Math.round(n));
  const slider = (lab, key, min, max, stp, show) => { const out = el('b', { text: '' }); const i = el('input', { type: 'range', min, max, step: stp, value: st[key], 'aria-label': lab }); i.addEventListener('input', () => { st[key] = +i.value; calc(); }); return { node: el('div', { class: 'w-jac-sl' }, el('label', { text: lab }), i, out), upd: () => { out.textContent = show(st[key]); } }; };
  const S = [slider('outer rows', 'outer', 0, 7, 0.1, (v) => fmt(10 ** v)), slider('inner rows', 'inner', 1, 8, 0.1, (v) => fmt(10 ** v)), slider('distinct outer keys %', 'dist', 1, 100, 1, (v) => v + '%'), slider('work_mem (MB)', 'wm', 1, 256, 1, (v) => v + ' MB')];
  const tg = (lab, key) => { const b = el('button', { class: 'btn' + (st[key] ? ' primary' : ''), text: lab }); b.addEventListener('click', () => { st[key] = !st[key]; b.className = 'btn' + (st[key] ? ' primary' : ''); calc(); }); return b; };
  const bars = el('div'); const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  root.append(...S.map((s) => s.node), el('div', { class: 'w-controls', style: { margin: '8px 0' } }, tg('index on inner join key', 'idx'), tg('both inputs already sorted (indexes)', 'sorted')), bars, cap,
    el('div', { class: 'tiny', text: 'Toy model in arbitrary units: random index probe ≈ 4 + log₂(inner), hash insert ≈ 1.5, probe ≈ 1, sort ≈ n·log₂(n)·0.05, spill doubles I/O. The real planner uses seq_page_cost, random_page_cost, cpu_* costs and statistics.' }));
  function calc() {
    S.forEach((s) => s.upd());
    const N = 10 ** st.outer, M = 10 ** st.inner, D = Math.max(1, N * st.dist / 100);
    const probe = 4 + Math.log2(M + 1);
    const nl = st.idx ? N * probe + N * 0.1 : N * M * 0.01 + N;
    const memo = st.idx ? N * 0.3 + Math.min(D, N) * probe : null;
    const buildMB = M * 60 / 1e6; const spill = buildMB > st.wm * 2;
    const hash = M * 1.5 + N * 1 + (spill ? (M + N) * 1.2 : 0);
    const sortc = (n) => n * Math.log2(n + 2) * 0.05;
    const merge = (st.sorted ? (N + M) * 1.2 : sortc(N) + sortc(M) + N + M);
    const rows = [['Nested Loop', nl, st.idx ? 'index probe per outer row' : 'full inner scan per outer row!'], ['NL + Memoize (PG14)', memo, memo == null ? 'needs a parameterized inner (index)' : `${fmt(Math.min(D, N))} misses, rest cached`], ['Hash Join', hash, spill ? `build ≈ ${fmt(buildMB)} MB > ${st.wm * 2} MB: batches on disk` : `build ≈ ${buildMB < 1 ? '<1' : fmt(buildMB)} MB fits`], ['Merge Join', merge, st.sorted ? 'inputs pre-sorted' : 'two Sorts first']];
    const valid = rows.filter((r) => r[1] != null); const max = Math.max(...valid.map((r) => Math.log10(r[1] + 10))); const win = valid.reduce((a, b) => (b[1] < a[1] ? b : a));
    bars.innerHTML = '';
    rows.forEach(([n, v, why]) => bars.append(el('div', { class: 'w-jac-row' + (n === win[0] ? ' win' : '') }, el('span', { text: n }), el('div', null, el('div', { class: 'w-jac-bar', style: { width: v == null ? '0' : (100 * Math.log10(v + 10) / max) + '%' } }), el('div', { class: 'tiny', text: why })), el('span', { text: v == null ? 'n/a' : fmt(v) }))));
    cap.firstChild.innerHTML = `Winner: <b>${win[0]}</b>. ` + (win[0] === 'Nested Loop' ? 'A small outer side and an index: each probe is cheap and there is nothing to build.' : win[0].startsWith('NL') ? 'Few distinct outer keys: Memoize answers repeated keys from its cache.' : win[0] === 'Hash Join' ? 'Two big unsorted inputs: read each once, no random I/O.' : 'Both inputs come sorted, so a single zipper pass is cheapest and the output stays ordered.') + ' Bars are on a log scale.';
  }
  calc();
});

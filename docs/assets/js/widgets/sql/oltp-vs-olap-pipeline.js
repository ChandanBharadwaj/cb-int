/* CDC vs batch ETL: simulate a day of changes and compare freshness, primary load, and what reaches the warehouse. */
IA.widget('oltp-vs-olap-pipeline', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-ovop-style')) document.head.append(el('style', { id: 'w-ovop-style', html: `
.w-ovop-tl { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 3px; margin: 8px 0; }
.w-ovop-h { font-size: 10.5px; text-align: center; color: var(--text-3); font-family: var(--mono); }
.w-ovop-b { height: 34px; border-radius: 5px; background: var(--surface-2); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 13px; transition: all .3s; }
.w-ovop-b.ev { background: var(--accent-soft); border-color: var(--accent); }
.w-ovop-b.land { background: color-mix(in srgb, var(--ok) 22%, var(--surface)); border-color: var(--ok); }
.w-ovop-b.miss { background: color-mix(in srgb, var(--err) 18%, var(--surface)); border-color: var(--err); }
.w-ovop-b.load { box-shadow: inset 0 -6px 0 var(--warn); }
.w-ovop-row { display: grid; grid-template-columns: 92px 1fr; gap: 6px; align-items: center; }
.w-ovop-row .lbl { font-size: 12px; color: var(--text-2); }
` }));
  const EV = [[1, 'insert #7', 'I'], [3, 'update #7 (qty 2)', 'U'], [5, 'update #7 (qty 3)', 'U'], [6, 'insert #8', 'I'], [8, 'delete #8', 'D'], [10, 'update #7 (shipped)', 'U']];
  let mode = 'cdc', gen = 0;
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Pipeline' });
  [['cdc', 'Log-based CDC'], ['batch', 'Nightly batch ETL']].forEach(([v, l]) => { const b = el('button', { text: l, class: v === mode ? 'on' : '' }); b.addEventListener('click', () => { mode = v; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); draw(); }); seg.append(b); });
  const tlH = el('div', { class: 'w-ovop-tl' }), tlP = el('div', { class: 'w-ovop-tl' }), tlW = el('div', { class: 'w-ovop-tl' });
  const play = el('button', { class: 'btn primary', text: '▶ Simulate a day' });
  const stats = el('div', { class: 'w-stats' });
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  root.append(el('div', { class: 'w-controls' }, seg, play), el('div', { class: 'w-stage' },
    el('div', { class: 'w-ovop-row' }, el('span', { class: 'lbl', text: 'hour (×2)' }), tlH), el('div', { class: 'w-ovop-row' }, el('span', { class: 'lbl', text: 'Postgres' }), tlP), el('div', { class: 'w-ovop-row' }, el('span', { class: 'lbl', text: 'warehouse' }), tlW)), stats, cap);
  let P = [], W = [];
  function draw() {
    gen++; tlH.innerHTML = tlP.innerHTML = tlW.innerHTML = ''; P = []; W = [];
    for (let i = 0; i < 12; i++) { tlH.append(el('div', { class: 'w-ovop-h', text: String(i * 2).padStart(2, '0') })); const p = el('div', { class: 'w-ovop-b' }); const w = el('div', { class: 'w-ovop-b' }); P.push(p); W.push(w); tlP.append(p); tlW.append(w); }
    stats.innerHTML = ''; cap.firstChild.textContent = mode === 'cdc' ? 'CDC reads committed changes from the WAL through a replication slot and streams them within seconds.' : 'Batch ETL runs once (here at 22:00), selecting rows with updated_at > last run.';
  }
  play.addEventListener('click', async () => {
    draw(); const g = gen; const w = (ms) => sleep(reduced ? 150 : ms);
    for (let i = 0; i < 12; i++) {
      const e = EV.find((x) => x[0] === i);
      if (e) { P[i].classList.add('ev'); P[i].textContent = e[2]; cap.firstChild.textContent = `${String(i * 2).padStart(2, '0')}:00 ${e[1]} committed in Postgres.`;
        if (mode === 'cdc') { await w(500); if (g !== gen) return; W[i].classList.add('land'); W[i].textContent = e[2]; cap.firstChild.textContent += ' CDC event lands in the warehouse seconds later.'; } }
      if (mode === 'batch' && i === 11) { P[i].classList.add('load'); W[i].classList.add('land'); W[i].textContent = '#7';
        cap.firstChild.textContent = '22:00 batch job scans the table (load on the primary) and copies the latest state of #7. #8 was inserted and deleted the same day, so it never appears, and its delete is invisible to updated_at.'; }
      await w(700); if (g !== gen) return;
    }
    stats.innerHTML = '';
    const S = mode === 'cdc' ? [['freshness', 'seconds'], ['events delivered', '6 / 6'], ['deletes seen', 'yes'], ['primary load', 'WAL decoding'], ['risk', 'slot retains WAL if consumer stops']]
      : [['freshness', 'up to 24 h'], ['events delivered', 'final state only'], ['deletes seen', 'no (unless soft delete)'], ['primary load', 'table scan at run time'], ['risk', 'late commits with older updated_at are missed']];
    S.forEach(([a, b]) => stats.append(el('span', { class: 'w-stat', html: `${a} <b>${b}</b>` })));
    cap.firstChild.textContent = mode === 'cdc' ? 'Every change arrived, in commit order, including the delete and the intermediate updates. Consumers must be idempotent (dedupe on PK + LSN).' : 'Simple and cheap, but stale, blind to deletes, and it loses the history of intermediate updates.';
  });
  draw();
});

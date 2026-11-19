/* Isolation matrix: Postgres anomaly table vs the SQL standard; click a cell to replay it in the timeline widget. */
IA.widget('isolation-levels-matrix', (root, ctx) => {
  const { el } = ctx;
  if (!document.getElementById('w-iso-m-css')) document.head.append(el('style', { id: 'w-iso-m-css', text: `
.w-iso-m td.cell { cursor: pointer; font-weight: 700; text-align: center; }
.w-iso-m td.cell:hover { outline: 2px solid var(--accent); outline-offset: -2px; }
.w-iso-m td.yes { color: var(--err); } .w-iso-m td.no { color: var(--ok); } .w-iso-m td.e40 { color: var(--warn); }
.w-iso-m td small { display: block; font-weight: 400; color: var(--text-3); font-size: 11px; }` }));
  const LV = [['RC', 'READ COMMITTED'], ['RR', 'REPEATABLE READ'], ['SER', 'SERIALIZABLE']];
  // [key, label, RC, RR, SER, standard note]
  const R = [
    ['dirty', 'Dirty read', 'no', 'no', 'no', 'standard: possible at READ UNCOMMITTED; PG never'],
    ['nrr', 'Non-repeatable read', 'yes', 'no', 'no', ''],
    ['phantom', 'Phantom', 'yes', 'no', 'no', 'standard allows it at RR; PG prevents it'],
    ['lost', 'Lost update', 'yes', 'e40', 'e40', 'read-modify-write in the app'],
    ['skew', 'Write skew', 'yes', 'yes', 'e40', 'only SSI catches it']
  ];
  const lab = { yes: ['happens', 'yes'], no: ['prevented', 'no'], e40: ['40001 → retry', 'e40'] };
  const tb = el('tbody');
  R.forEach(([k, l, ...rest]) => {
    const note = rest[3];
    tb.append(el('tr', null, el('td', null, l, note ? el('small', { text: note }) : null), ...LV.map(([lv], i) => { const v = rest[i];
      const td = el('td', { class: 'cell ' + lab[v][1], tabindex: 0, role: 'button', 'aria-label': `${l} at ${LV[i][1]}: ${lab[v][0]}`, text: lab[v][0] });
      const go = () => { if (IA.isoJump) IA.isoJump(k, lv); };
      td.addEventListener('click', go); td.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      return td; })));
  });
  root.classList.add('w-iso-m');
  root.append(el('div', { class: 'tscroll' }, el('table', { class: 't rg' }, el('thead', null, el('tr', null, el('th', { text: 'anomaly' }), ...LV.map(([, n]) => el('th', { text: n })))), tb)),
    el('div', { class: 'tiny', style: { marginTop: '8px' }, html: '“40001 → retry”: the anomaly is prevented by aborting one transaction with <code>could not serialize access</code>. Your code must retry it. Lost update at READ COMMITTED is prevented if you write <code>SET x = x - 1</code> or lock with <code>FOR UPDATE</code>.' }));
});

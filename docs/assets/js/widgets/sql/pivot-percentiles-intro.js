/* Beginner intro: pivot long rows (region, quarter, amt) into a wide table, one cell at a time. */
IA.widget('pivot-percentiles-intro', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  const L = [['EU', 'Q1', 10], ['EU', 'Q2', 15], ['US', 'Q1', 20], ['US', 'Q2', 5], ['EU', 'Q1', 3]];
  const long = L.map((r) => el('tr', null, r.map((v) => el('td', { text: String(v) }))));
  const cell = {};
  const wrows = ['EU', 'US'].map((rg) => el('tr', null, el('td', { class: 'key', text: rg }), ...['Q1', 'Q2'].map((q) => (cell[rg + q] = el('td', { text: '·' })))));
  root.append(el('div', { class: 'mini-tables' },
    el('div', { class: 'mt' }, el('h5', { text: 'long: one row per fact' }), el('table', null, el('thead', null, el('tr', null, ['region', 'quarter', 'amt'].map((h) => el('th', { text: h })))), el('tbody', null, long))),
    el('span', { class: 'mini-arrow', text: '→' }),
    el('div', { class: 'mt' }, el('h5', { text: 'wide: one column per quarter' }), el('table', null, el('thead', null, el('tr', null, ['region', 'Q1', 'Q2'].map((h) => el('th', { class: h === 'region' ? 'key' : '', text: h })))), el('tbody', null, wrows)))));
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: 'Press “Show me” to turn rows into columns.' }));
  const btn = el('button', { class: 'btn primary', text: '▶ Show me' });
  root.append(el('div', { class: 'w-controls', style: { marginTop: '12px', justifyContent: 'center' } }, btn), cap);
  let gen = 0;
  btn.addEventListener('click', async () => {
    const g = ++gen; Object.values(cell).forEach((c) => { c.textContent = '·'; c.parentNode.classList.remove('hl'); }); const acc = {};
    for (let i = 0; i < L.length; i++) {
      const [rg, q, a] = L[i]; long.forEach((t, j) => t.classList.toggle('hl', j === i)); acc[rg + q] = (acc[rg + q] || 0) + a; cell[rg + q].textContent = String(acc[rg + q]);
      cap.firstChild.textContent = `${rg}, ${q}, ${a} → goes into row ${rg}, column ${q}` + (acc[rg + q] !== a ? `, which already had a value, so SUM adds it: ${acc[rg + q]}.` : '.');
      await sleep(reduced ? 500 : 2200); if (g !== gen) return;
    }
    long.forEach((t) => t.classList.remove('hl'));
    cap.firstChild.textContent = 'Done. GROUP BY region makes the rows; one SUM(amt) FILTER (WHERE quarter = …) per quarter makes the columns.';
  });
});

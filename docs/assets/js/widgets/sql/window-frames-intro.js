/* Beginner intro: a running total built row by row; the frame grows down the list. */
IA.widget('window-frames-intro', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  const R = [['Mon', 10], ['Tue', 20], ['Wed', 5], ['Thu', 30]];
  const cells = R.map(([d, a]) => { const out = el('td', { text: '·' }); return { tr: el('tr', null, el('td', { text: d }), el('td', { text: String(a) }), out), out }; });
  const tbl = el('div', { class: 'mt' }, el('h5', { text: 'sum(amt) OVER (ORDER BY day)' }), el('table', null,
    el('thead', null, el('tr', null, el('th', { text: 'day' }), el('th', { text: 'amt' }), el('th', { class: 'key', text: 'running' }))), el('tbody', null, cells.map((c) => c.tr))));
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: 'Press “Show me” to slide the frame down the list.' }));
  const btn = el('button', { class: 'btn primary', text: '▶ Show me' });
  root.append(el('div', { class: 'mini-tables' }, tbl), el('div', { class: 'w-controls', style: { marginTop: '12px', justifyContent: 'center' } }, btn), cap);
  let gen = 0;
  btn.addEventListener('click', async () => {
    const g = ++gen; cells.forEach((c) => { c.out.textContent = '·'; c.tr.classList.remove('hl'); });
    let s = 0;
    for (let i = 0; i < R.length; i++) {
      cells.forEach((c, j) => c.tr.classList.toggle('hl', j <= i));
      s += R[i][1]; cells[i].out.textContent = String(s);
      cap.firstChild.textContent = `${R[i][0]}: the frame covers rows 1–${i + 1} (highlighted). Add them up: ${R.slice(0, i + 1).map((r) => r[1]).join(' + ')} = ${s}.`;
      await sleep(reduced ? 500 : 2400); if (g !== gen) return;
    }
    cells.forEach((c) => c.tr.classList.remove('hl'));
    cap.firstChild.textContent = 'Done. Every row was kept (unlike GROUP BY), and each got its own total over “all rows so far”. That slice is the frame.';
  });
});

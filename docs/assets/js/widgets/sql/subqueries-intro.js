/* Beginner intro: a query inside a query. First compute the average, then use it as a filter. */
IA.widget('subqueries-intro', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  const O = [[101, 250], [102, 80], [103, 40], [104, 60], [105, 99]];
  const trs = O.map((r) => el('tr', null, el('td', { text: String(r[0]) }), el('td', { text: String(r[1]) })));
  const avgCell = el('td', { class: 'key', text: '?' });
  root.append(el('div', { class: 'mini-tables' },
    el('div', { class: 'mt' }, el('h5', { text: 'orders' }), el('table', null, el('thead', null, el('tr', null, el('th', { text: 'id' }), el('th', { text: 'amount' }))), el('tbody', null, trs))),
    el('span', { class: 'mini-arrow', text: '→' }),
    el('div', { class: 'mt' }, el('h5', { text: 'inner: SELECT avg(amount)' }), el('table', null, el('tbody', null, el('tr', null, avgCell))))));
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: 'Goal: orders bigger than the average order.' }));
  const btn = el('button', { class: 'btn primary', text: '▶ Show me' });
  root.append(el('div', { class: 'w-controls', style: { marginTop: '12px', justifyContent: 'center' } }, btn), cap);
  let gen = 0;
  btn.addEventListener('click', async () => {
    const g = ++gen; avgCell.textContent = '?'; trs.forEach((t) => { t.classList.remove('hl'); t.style.opacity = '1'; });
    trs.forEach((t) => t.classList.add('hl')); cap.firstChild.textContent = 'Step 1: the inner query (in parentheses) reads all amounts…'; await sleep(reduced ? 500 : 2200); if (g !== gen) return;
    trs.forEach((t) => t.classList.remove('hl')); avgCell.textContent = '105.8'; cap.firstChild.textContent = '…and produces one value: 105.8. A subquery that returns one value can be used anywhere a value can.'; await sleep(reduced ? 500 : 2600); if (g !== gen) return;
    O.forEach((r, i) => { if (r[1] > 105.8) trs[i].classList.add('hl'); else trs[i].style.opacity = '.35'; });
    cap.firstChild.textContent = 'Step 2: the outer query keeps rows where amount > 105.8. Only order 101 survives. SELECT id FROM orders WHERE amount > (SELECT avg(amount) FROM orders);';
  });
});

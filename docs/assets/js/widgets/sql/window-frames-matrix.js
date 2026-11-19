/* Which window functions read the frame, and the frame you usually want. */
IA.widget('window-frames-matrix', (root, ctx) => {
  const { el } = ctx;
  const F = [
    ['sum / avg / count', true, 'Running: ROWS UNBOUNDED PRECEDING with a unique ORDER BY. Moving: RANGE \'6 days\' PRECEDING on a date.'],
    ['first_value', true, 'Works with the default frame (the frame always starts at the partition start).'],
    ['last_value', true, 'Needs ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING, or the result is just the current row / its last peer.'],
    ['nth_value(x, n)', true, 'Same as last_value: with the default frame, early rows return NULL because row n is not in the frame yet.'],
    ['LAG / LEAD', false, 'Ignore the frame. Offset counts rows in the partition. Third argument is the out-of-partition default.'],
    ['row_number / rank / dense_rank', false, 'Ignore the frame. rank and dense_rank depend on peers; row_number splits ties arbitrarily.'],
    ['ntile / percent_rank / cume_dist', false, 'Ignore the frame; use the whole partition.']
  ];
  const info = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: 'Click a row.' }));
  const tb = el('tbody');
  F.forEach(([n, uses, tip]) => { const tr = el('tr', { style: { cursor: 'pointer' } }, el('td', { html: `<code>${n}</code>` }), el('td', { html: uses ? '<b style="color:var(--warn)">yes</b>' : '<span style="color:var(--ok)">no</span>' }));
    tr.addEventListener('click', () => { [...tb.children].forEach((x) => x.style.background = ''); tr.style.background = 'var(--accent-soft)'; info.firstChild.textContent = tip; }); tb.append(tr); });
  root.append(el('div', { class: 'tscroll' }, el('table', { class: 't rg' }, el('thead', null, el('tr', null, el('th', { text: 'function' }), el('th', { text: 'uses frame?' }))), tb)), info);
});

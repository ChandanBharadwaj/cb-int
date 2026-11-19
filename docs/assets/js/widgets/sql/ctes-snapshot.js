/* Data-modifying CTEs: all parts of one statement see the same snapshot; only RETURNING passes rows between them. */
IA.widget('ctes-snapshot', (root, ctx) => {
  const { el, sleep, reduced, codeBox } = ctx;
  const S = [
    ['Before: orders has ids 1–4 (1 and 2 are old). archive is empty.', [1, 2, 3, 4], [], '', ''],
    ['All sub-statements start with ONE snapshot taken now. Everything below reads this picture of the data.', [1, 2, 3, 4], [], 'snapshot', ''],
    ['DELETE runs and RETURNs rows 1, 2 into the temporary “moved” result.', [3, 4], [], 'moved = {1, 2}', ''],
    ['INSERT … SELECT FROM moved writes them into archive. It reads “moved”, not orders.', [3, 4], [1, 2], 'moved = {1, 2}', ''],
    ['The main SELECT counts orders. It still sees 4 rows: same snapshot, the delete is invisible inside this statement.', [3, 4], [1, 2], 'moved = {1, 2}', 'count(*) FROM orders → 4'],
    ['Statement ends, changes become visible together. The next statement sees 2 orders and 2 archived. If any part fails, none of it happens.', [3, 4], [1, 2], '', 'next statement: count → 2']
  ];
  const sql = `WITH moved AS (\n  DELETE FROM orders WHERE created < now() - interval '1 year'\n  RETURNING *)\n, ins AS (INSERT INTO archive SELECT * FROM moved RETURNING id)\nSELECT (SELECT count(*) FROM orders) AS orders_seen,\n       (SELECT count(*) FROM ins)    AS archived;`;
  const tbl = (name, ids) => el('div', { class: 'mt' }, el('h5', { text: name }), el('table', null, el('thead', null, el('tr', null, el('th', { text: 'id' }))), el('tbody', null, ids.length ? ids.map((i) => el('tr', null, el('td', { text: String(i) }))) : el('tr', null, el('td', { class: 'null', text: '(empty)' })))));
  const stage = el('div'); const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: '' }));
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  root.append(codeBox(sql, 'sql'), stage, el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bReset), cap);
  const show = (i) => { const [t, o, a, mv, q] = S[i]; stage.innerHTML = ''; stage.append(el('div', { class: 'mini-tables' }, tbl('orders', o), tbl('archive', a), mv ? el('span', { class: 'pill accent', text: mv }) : null, q ? el('span', { class: 'pill', text: q }) : null)); cap.firstChild.textContent = t; };
  let gen = 0; const reset = () => { gen++; show(0); };
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => { const g = ++gen; for (let i = 0; i < S.length; i++) { show(i); await sleep(reduced ? 600 : 2600); if (g !== gen) return; } });
  reset();
});

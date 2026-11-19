/* Beginner intro: stitch customers + orders together one match at a time. */
IA.widget('joins-intro', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  const C = [[1, 'Asha'], [2, 'Ben'], [3, 'Chen']];
  const O = [[101, 1, 250], [102, 1, 80], [103, 2, 40]];
  const tbl = (title, head, rows, keyCol) => {
    const trs = rows.map((r) => el('tr', null, r.map((v, i) => el('td', { class: i === keyCol ? 'key' : '', text: String(v) }))));
    return { trs, node: el('div', { class: 'mt' }, el('h5', { text: title }), el('table', null, el('thead', null, el('tr', null, head.map((h, i) => el('th', { class: i === keyCol ? 'key' : '', text: h })))), el('tbody', null, trs))) };
  };
  const a = tbl('customers', ['id', 'name'], C, 0);
  const b = tbl('orders', ['id', 'customer_id', 'amount'], O, 1);
  const resBody = el('tbody');
  const res = el('div', { class: 'mt' }, el('h5', { text: 'result: name + amount' }), el('table', null, el('thead', null, el('tr', null, el('th', { text: 'name' }), el('th', { text: 'amount' }))), resBody));
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: 'Press “Show me” to watch rows being paired.' }));
  const btn = el('button', { class: 'btn primary', text: '▶ Show me' });
  root.append(el('div', { class: 'mini-tables' }, a.node, el('span', { class: 'mini-arrow', text: '+' }), b.node, el('span', { class: 'mini-arrow', text: '→' }), res), el('div', { class: 'w-controls', style: { marginTop: '12px', justifyContent: 'center' } }, btn), cap);
  let gen = 0;
  btn.addEventListener('click', async () => {
    const g = ++gen; resBody.innerHTML = '';
    const clear = () => [...a.trs, ...b.trs].forEach((t) => t.classList.remove('hl'));
    for (let i = 0; i < C.length; i++) {
      if (g !== gen) return;
      clear(); a.trs[i].classList.add('hl');
      const m = O.map((o, j) => [o, j]).filter(([o]) => o[1] === C[i][0]);
      cap.firstChild.textContent = `Take ${C[i][1]} (id ${C[i][0]}). Look for orders whose customer_id = ${C[i][0]}…`;
      await sleep(reduced ? 500 : 2200); if (g !== gen) return;
      if (!m.length) { cap.firstChild.textContent = `${C[i][1]} has no orders. An INNER JOIN leaves her out; a LEFT JOIN would keep her with amount = NULL.`; await sleep(reduced ? 500 : 3200); continue; }
      for (const [o, j] of m) {
        b.trs[j].classList.add('hl');
        resBody.append(el('tr', { class: 'hl' }, el('td', { text: C[i][1] }), el('td', { text: String(o[2]) })));
        cap.firstChild.textContent = `Match: order ${o[0]} belongs to ${C[i][1]}, so we write one result row.`;
        await sleep(reduced ? 500 : 2400); if (g !== gen) return;
      }
    }
    clear(); [...resBody.children].forEach((t) => t.classList.remove('hl'));
    cap.firstChild.textContent = 'Done: 3 result rows. Asha appears twice because she has two orders. One-to-many joins repeat the “one” side.';
  });
});

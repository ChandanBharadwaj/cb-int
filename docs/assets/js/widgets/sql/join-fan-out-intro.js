/* Beginner intro: one $100 receipt photocopied per item, then summed. */
IA.widget('join-fan-out-intro', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  const items = ['pen', 'ink', 'pad'];
  const resBody = el('tbody'); const sum = el('div', { class: 'w-stat', style: { fontSize: '14px', marginTop: '8px' }, html: 'SUM(o.total) = <b>?</b>' });
  const orderT = el('div', { class: 'mt' }, el('h5', { text: 'orders' }), el('table', null, el('thead', null, el('tr', null, el('th', { text: 'id' }), el('th', { text: 'total' }))), el('tbody', null, el('tr', null, el('td', { text: '1' }), el('td', { class: 'key', text: '100' })))));
  const itemTrs = items.map((s) => el('tr', null, el('td', { text: '1' }), el('td', { text: s })));
  const itemT = el('div', { class: 'mt' }, el('h5', { text: 'order_items' }), el('table', null, el('thead', null, el('tr', null, el('th', { text: 'order_id' }), el('th', { text: 'sku' }))), el('tbody', null, itemTrs)));
  const res = el('div', { class: 'mt' }, el('h5', { text: 'joined' }), el('table', null, el('thead', null, el('tr', null, el('th', { text: 'total' }), el('th', { text: 'sku' }))), resBody), sum);
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: 'Press “Show me”: one order, three items.' }));
  const btn = el('button', { class: 'btn primary', text: '▶ Show me' });
  root.append(el('div', { class: 'mini-tables' }, orderT, el('span', { class: 'mini-arrow', text: '⨝' }), itemT, el('span', { class: 'mini-arrow', text: '→' }), res), el('div', { class: 'w-controls', style: { marginTop: '12px', justifyContent: 'center' } }, btn), cap);
  let gen = 0;
  btn.addEventListener('click', async () => {
    const g = ++gen; resBody.innerHTML = ''; sum.innerHTML = 'SUM(o.total) = <b>?</b>';
    for (let i = 0; i < items.length; i++) {
      itemTrs.forEach((t, j) => t.classList.toggle('hl', i === j));
      resBody.append(el('tr', { class: 'hl' }, el('td', { class: 'key', text: '100' }), el('td', { text: items[i] })));
      cap.firstChild.textContent = `Item “${items[i]}” matches order 1, so we write a row, and the order total 100 is copied onto it.`;
      await sleep(reduced ? 500 : 2000); if (g !== gen) return;
    }
    itemTrs.forEach((t) => t.classList.remove('hl'));
    sum.innerHTML = 'SUM(o.total) = <b style="color:var(--err)">300</b> (real: 100)';
    cap.firstChild.textContent = 'Each row is fine on its own. But summing the copied total counts the same $100 three times. That is fan-out.';
  });
});

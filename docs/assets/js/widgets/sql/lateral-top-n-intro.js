/* Beginner intro: walk the mailboxes, take the top 2 letters from each stack. */
IA.widget('lateral-top-n-intro', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  const BOX = [['Asha', ['Mar 02', 'Feb 11', 'Jan 05']], ['Ben', ['Feb 28', 'Jan 20']], ['Chen', []]];
  const boxes = BOX.map(([n, ls]) => { const items = ls.map((d) => el('tr', null, el('td', { text: d })));
    const node = el('div', { class: 'mt' }, el('h5', { text: '📫 ' + n }), el('table', null, el('thead', null, el('tr', null, el('th', { text: 'newest on top' }))), el('tbody', null, items.length ? items : [el('tr', null, el('td', { class: 'null', text: '(empty)' }))])));
    return { node, items }; });
  const resBody = el('tbody');
  const res = el('div', { class: 'mt' }, el('h5', { text: 'result (LIMIT 2 each)' }), el('table', null, el('thead', null, el('tr', null, el('th', { text: 'name' }), el('th', { text: 'order' }))), resBody));
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: 'Press “Show me” to walk the street once.' }));
  const btn = el('button', { class: 'btn primary', text: '▶ Show me' });
  root.append(el('div', { class: 'mini-tables' }, ...boxes.map((b) => b.node), el('span', { class: 'mini-arrow', text: '→' }), res), el('div', { class: 'w-controls', style: { marginTop: '12px', justifyContent: 'center' } }, btn), cap);
  let gen = 0; const T = (ms) => sleep(reduced ? 500 : ms);
  btn.addEventListener('click', async () => {
    const g = ++gen; resBody.innerHTML = ''; boxes.forEach((b) => b.items.forEach((t) => { t.classList.remove('hl'); t.style.opacity = ''; }));
    for (let i = 0; i < BOX.length; i++) {
      const [n, ls] = BOX[i]; cap.firstChild.textContent = `Stop at ${n}’s mailbox. The inner query runs with customer = ${n}.`;
      await T(1800); if (g !== gen) return;
      if (!ls.length) { cap.firstChild.textContent = `${n}’s box is empty. CROSS JOIN LATERAL skips him; LEFT JOIN LATERAL … ON true would add a row with NULL.`; await T(3000); continue; }
      for (let j = 0; j < Math.min(2, ls.length); j++) {
        boxes[i].items[j].classList.add('hl'); resBody.append(el('tr', { class: 'hl' }, el('td', { text: n }), el('td', { text: ls[j] })));
        cap.firstChild.textContent = `Take letter ${j + 1}: ${ls[j]}.`; await T(1500); if (g !== gen) return;
      }
      boxes[i].items.slice(2).forEach((t) => { t.style.opacity = '.3'; });
      if (ls.length > 2) { cap.firstChild.textContent = 'Two taken, so stop. The older letter underneath is never touched.'; await T(2400); if (g !== gen) return; }
    }
    [...resBody.children].forEach((t) => t.classList.remove('hl'));
    cap.firstChild.textContent = 'Done: one small lookup per customer. Because each stack is already sorted (an index), we never sort anything.';
  });
});

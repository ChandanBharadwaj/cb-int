/* Beginner intro: two guest lists combined four ways. */
IA.widget('set-operations-intro', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  const YOU = ['Asha', 'Ben', 'Chen']; const FRIEND = ['Ben', 'Dina'];
  const OPS = [
    ['UNION ALL', 'Staple the lists together: Ben appears twice.', [...YOU, ...FRIEND]],
    ['UNION', 'Staple, then cross out repeats: every name once.', ['Asha', 'Ben', 'Chen', 'Dina']],
    ['INTERSECT', 'Only names on both lists.', ['Ben']],
    ['EXCEPT', 'Names on your list that are not on your friend’s.', ['Asha', 'Chen']]
  ];
  const t = (title, names) => { const trs = names.map((n) => el('tr', null, el('td', { text: n }))); return { trs, node: el('div', { class: 'mt' }, el('h5', { text: title }), el('table', null, el('tbody', null, trs))) }; };
  const a = t('your list', YOU); const b = t('friend’s list', FRIEND);
  const resBody = el('tbody'); const resH = el('h5', { text: 'result' });
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: 'Press “Show me” to combine the lists four ways.' }));
  const btn = el('button', { class: 'btn primary', text: '▶ Show me' });
  root.append(el('div', { class: 'mini-tables' }, a.node, el('span', { class: 'mini-arrow', text: '+' }), b.node, el('span', { class: 'mini-arrow', text: '→' }), el('div', { class: 'mt' }, resH, el('table', null, resBody))),
    el('div', { class: 'w-controls', style: { marginTop: '12px', justifyContent: 'center' } }, btn), cap);
  let gen = 0;
  btn.addEventListener('click', async () => {
    const g = ++gen;
    for (const [name, txt, out] of OPS) {
      resBody.innerHTML = ''; resH.textContent = name; cap.firstChild.textContent = `${name}: ${txt}`;
      [...a.trs, ...b.trs].forEach((tr) => tr.classList.toggle('hl', out.includes(tr.textContent)));
      for (const n of out) { resBody.append(el('tr', { class: 'hl' }, el('td', { text: n }))); await sleep(reduced ? 300 : 700); if (g !== gen) return; }
      await sleep(reduced ? 800 : 2600); if (g !== gen) return;
    }
    [...a.trs, ...b.trs].forEach((tr) => tr.classList.remove('hl'));
    cap.firstChild.textContent = 'Same idea in SQL: two queries with the same columns, glued by UNION [ALL], INTERSECT or EXCEPT.';
  });
});

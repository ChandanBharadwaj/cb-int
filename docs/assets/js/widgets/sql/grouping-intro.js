/* Beginner intro: coins dropped into jars by country, then counted. */
IA.widget('grouping-intro', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  const COINS = [['IN', 5], ['US', 1], ['IN', 2], ['US', 10], ['IN', 1]];
  const jars = { IN: el('div', { class: 'mt' }, el('h5', { text: 'jar IN' }), el('table', null, el('tbody'))), US: el('div', { class: 'mt' }, el('h5', { text: 'jar US' }), el('table', null, el('tbody'))) };
  const trs = COINS.map(([c, v]) => el('tr', null, el('td', { text: c }), el('td', { text: String(v) })));
  const bag = el('div', { class: 'mt' }, el('h5', { text: 'coins' }), el('table', null, el('thead', null, el('tr', null, el('th', { text: 'country' }), el('th', { text: 'value' }))), el('tbody', null, trs)));
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: 'Press “Show me” to GROUP BY country.' }));
  const btn = el('button', { class: 'btn primary', text: '▶ Show me' });
  root.append(el('div', { class: 'mini-tables' }, bag, el('span', { class: 'mini-arrow', text: '→' }), jars.IN, jars.US), el('div', { class: 'w-controls', style: { marginTop: '12px', justifyContent: 'center' } }, btn), cap);
  let gen = 0;
  btn.addEventListener('click', async () => {
    const g = ++gen; Object.values(jars).forEach((j) => { j.querySelector('tbody').innerHTML = ''; const f = j.querySelector('.tiny'); if (f) f.remove(); });
    for (let i = 0; i < COINS.length; i++) {
      trs.forEach((t, j) => t.classList.toggle('hl', i === j)); const [c, v] = COINS[i];
      jars[c].querySelector('tbody').append(el('tr', { class: 'hl' }, el('td', { text: String(v) })));
      cap.firstChild.textContent = `A ${c} coin worth ${v} goes into jar ${c}.`;
      await sleep(reduced ? 400 : 1500); if (g !== gen) return;
    }
    trs.forEach((t) => t.classList.remove('hl'));
    Object.entries(jars).forEach(([c, j]) => { const vs = COINS.filter((x) => x[0] === c).map((x) => x[1]); j.append(el('div', { class: 'tiny', text: `count ${vs.length} · sum ${vs.reduce((a, b) => a + b, 0)}` })); });
    cap.firstChild.textContent = 'Each jar collapses to one result row: SELECT country, count(*), sum(value) FROM coins GROUP BY country.';
  });
});

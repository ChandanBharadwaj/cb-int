/* Beginner intro: race results — GROUP BY collapses, a window keeps every runner and adds a place. */
IA.widget('window-ranking-intro', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  const R = [['Ana', 'U20', 31], ['Bo', 'U20', 29], ['Cy', 'U40', 35], ['Di', 'U20', 31], ['Ed', 'U40', 33]];
  const body = el('tbody');
  const head = el('tr', null, el('th', { text: 'runner' }), el('th', { text: 'group' }), el('th', { text: 'min' }), el('th', { text: 'place' }));
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: 'Press “Show me”: first GROUP BY, then a window function.' }));
  const btn = el('button', { class: 'btn primary', text: '▶ Show me' });
  root.append(el('div', { class: 'mini-tables' }, el('div', { class: 'mt' }, el('h5', { text: 'results' }), el('table', null, el('thead', null, head), body))), el('div', { class: 'w-controls', style: { marginTop: '12px', justifyContent: 'center' } }, btn), cap);
  const show = (rows) => { body.innerHTML = ''; rows.forEach((r) => body.append(el('tr', { class: r.hl ? 'hl' : '' }, r.v.map((v) => el('td', { text: String(v) }))))); };
  let gen = 0; const T = (ms) => sleep(reduced ? 500 : ms);
  show(R.map((r) => ({ v: [...r, ''] })));
  btn.addEventListener('click', async () => {
    const g = ++gen;
    show(R.map((r) => ({ v: [...r, ''] }))); cap.firstChild.textContent = '5 runners in 2 age groups.'; await T(1800); if (g !== gen) return;
    show([{ v: ['—', 'U20', 'best 29', ''], hl: true }, { v: ['—', 'U40', 'best 33', ''], hl: true }]);
    cap.firstChild.textContent = 'GROUP BY group: min(time) per group. 2 rows, and the runners are gone.'; await T(3000); if (g !== gen) return;
    const sorted = R.slice().sort((a, b) => a[1].localeCompare(b[1]) || a[2] - b[2]);
    const out = sorted.map((r) => ({ v: [...r, ''] })); show(out);
    cap.firstChild.textContent = 'Window instead: PARTITION BY group, ORDER BY time. Every runner stays.'; await T(2200); if (g !== gen) return;
    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i]; const rank = sorted.filter((x) => x[1] === r[1] && x[2] < r[2]).length + 1;
      out[i].v[3] = rank; out.forEach((o, j) => { o.hl = j === i; }); show(out);
      cap.firstChild.textContent = rank === 1 ? `${r[0]} is 1st in ${r[1]}: numbering restarts in each partition.` : sorted[i - 1][2] === r[2] ? `${r[0]} ties with ${sorted[i - 1][0]}, so RANK gives the same place.` : `${r[0]} is place ${rank} in ${r[1]}.`;
      await T(1900); if (g !== gen) return;
    }
    out.forEach((o) => { o.hl = false; }); show(out);
    cap.firstChild.textContent = '5 rows in, 5 rows out, each with its place: rank() OVER (PARTITION BY group ORDER BY time).';
  });
});

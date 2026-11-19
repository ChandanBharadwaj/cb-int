/* Beginner intro: "who reports to Ada?" answered level by level. */
IA.widget('recursive-ctes-intro', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  const L = [['Ada'], ['Bo', 'Cy'], ['Di', 'Ed', 'Fa'], ['Gu']];
  const rows = L.map((lv, i) => el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'center', margin: '6px 0', opacity: '.25', transition: 'opacity .4s' } }, lv.map((n) => el('span', { class: 'pill', text: n }))));
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: 'Question: who is in Ada’s team, at any depth?' }));
  const btn = el('button', { class: 'btn primary', text: '▶ Show me' });
  root.append(...rows, el('div', { class: 'w-controls', style: { marginTop: '12px', justifyContent: 'center' } }, btn), cap);
  const T = ['Start: Ada (the anchor query).', 'Round 1: who reports to Ada? Bo and Cy.', 'Round 2: who reports to Bo or Cy? Only last round’s people are asked. Di, Ed, Fa.', 'Round 3: who reports to Di, Ed or Fa? Gu.', 'Round 4: who reports to Gu? Nobody. No new rows, so we stop.'];
  let gen = 0;
  btn.addEventListener('click', async () => { const g = ++gen; rows.forEach((r) => { r.style.opacity = '.25'; });
    for (let i = 0; i < T.length; i++) { if (rows[i]) rows[i].style.opacity = '1'; cap.firstChild.textContent = T[i]; await sleep(reduced ? 600 : 2400); if (g !== gen) return; }
    cap.firstChild.textContent = 'That loop of “ask about last round’s new people, until nobody new appears” is exactly what WITH RECURSIVE does.'; });
});

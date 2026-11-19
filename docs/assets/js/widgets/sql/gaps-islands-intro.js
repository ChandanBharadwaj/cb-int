/* Beginner intro: spot the streaks on a calendar strip. */
IA.widget('gaps-islands-intro', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  const D = [1, 2, 3, 5, 6, 9];
  const cells = []; const strip = el('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' } });
  for (let d = 1; d <= 10; d++) { const c = el('div', { text: String(d), style: { width: '30px', height: '30px', lineHeight: '30px', textAlign: 'center', borderRadius: '6px', border: '1px solid var(--border)', background: D.includes(d) ? 'var(--surface-2)' : 'transparent', color: D.includes(d) ? 'var(--text)' : 'var(--text-3)', transition: 'background .4s' } }); cells.push(c); strip.append(c); }
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: 'Days a user logged in (March 1–10). Press “Show me”.' }));
  const btn = el('button', { class: 'btn primary', text: '▶ Show me' });
  root.append(strip, el('div', { class: 'w-controls', style: { marginTop: '12px', justifyContent: 'center' } }, btn), cap);
  const isl = [[[1, 2, 3], 'var(--accent)'], [[5, 6], 'var(--ok)'], [[9], 'var(--warn)']];
  let gen = 0;
  btn.addEventListener('click', async () => {
    const g = ++gen; cells.forEach((c, i) => { c.style.background = D.includes(i + 1) ? 'var(--surface-2)' : 'transparent'; c.style.color = D.includes(i + 1) ? 'var(--text)' : 'var(--text-3)'; });
    for (const [ds, colr] of isl) { ds.forEach((d) => { cells[d - 1].style.background = colr; cells[d - 1].style.color = '#fff'; });
      cap.firstChild.textContent = `Island: March ${ds[0]}${ds.length > 1 ? '–' + ds[ds.length - 1] : ''}, ${ds.length} day${ds.length > 1 ? 's' : ''} in a row.`;
      await sleep(reduced ? 500 : 2200); if (g !== gen) return; }
    cap.firstChild.textContent = 'Islands are runs of consecutive values; gaps are what’s missing between them (4, 7, 8, 10). Easy by eye; in SQL you need a trick, because rows don’t know about their neighbours.';
  });
});

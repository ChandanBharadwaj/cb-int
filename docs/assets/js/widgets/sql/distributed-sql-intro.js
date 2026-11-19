/* Beginner intro: a committee of three in different cities votes on each write; the write is confirmed at 2 votes. */
IA.widget('distributed-sql-intro', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-dsi-style')) document.head.append(el('style', { id: 'w-dsi-style', html: `
.w-dsi { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.w-dsi-m { width: 140px; border: 2px solid var(--border); border-radius: 12px; padding: 10px; text-align: center; background: var(--surface); transition: all .3s; }
.w-dsi-m .v { font-size: 22px; min-height: 30px; } .w-dsi-m small { color: var(--text-3); display: block; }
.w-dsi-m.yes { border-color: var(--ok); } .w-dsi-m.off { opacity: .35; border-style: dashed; }
.w-dsi-res { text-align: center; font-weight: 700; margin-top: 10px; min-height: 22px; }
` }));
  const M = [['🗽', 'New York (leader)'], ['🏰', 'London'], ['🕌', 'Mumbai']].map(([i, n]) => { const v = el('div', { class: 'v' }); const m = el('div', { class: 'w-dsi-m' }, el('div', { text: i, style: { fontSize: '26px' } }), el('small', { text: n }), v); m._v = v; return m; });
  const res = el('div', { class: 'w-dsi-res' });
  let down = false;
  const tog = el('button', { class: 'btn', text: 'Mumbai offline: no' });
  tog.addEventListener('click', () => { down = !down; tog.textContent = 'Mumbai offline: ' + (down ? 'yes' : 'no'); M[2].classList.toggle('off', down); });
  const btn = el('button', { class: 'btn primary', text: '▶ Show me' });
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: 'Press “Show me” to send one write to the committee. Try it again with Mumbai offline.' }));
  root.append(el('div', { class: 'w-dsi' }, M), res, el('div', { class: 'w-controls', style: { marginTop: '12px', justifyContent: 'center' } }, btn, tog), cap);
  let gen = 0;
  btn.addEventListener('click', async () => {
    const g = ++gen; M.forEach((m) => { m.classList.remove('yes'); m._v.textContent = ''; }); res.textContent = '';
    const w = (ms) => sleep(reduced ? 300 : ms);
    cap.firstChild.textContent = 'The leader in New York receives “set balance = 80” and votes yes for itself.'; M[0].classList.add('yes'); M[0]._v.textContent = '✓'; res.textContent = 'votes: 1 of 3';
    await w(2000); if (g !== gen) return;
    cap.firstChild.textContent = 'It sends the write to London (~75 ms round trip) and Mumbai (~190 ms).';
    await w(1800); if (g !== gen) return;
    M[1].classList.add('yes'); M[1]._v.textContent = '✓'; res.textContent = 'votes: 2 of 3: confirmed ✔';
    cap.firstChild.textContent = 'London answers first. 2 of 3 is a majority, so the write is confirmed after about 75 ms. Nobody waits for Mumbai.';
    await w(2400); if (g !== gen) return;
    if (down) cap.firstChild.textContent = 'Mumbai is offline and nothing broke: a majority was still reachable. If London were offline too, writes would stop (1 of 3 is not a majority).';
    else { M[2].classList.add('yes'); M[2]._v.textContent = '✓'; cap.firstChild.textContent = 'Mumbai catches up later. Its copy is complete again, but the user did not have to wait for it.'; }
  });
});

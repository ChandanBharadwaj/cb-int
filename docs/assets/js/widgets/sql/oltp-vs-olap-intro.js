/* Beginner intro: total the sales from a pile of receipts (rows) vs one ledger column. */
IA.widget('oltp-vs-olap-intro', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-ovoi-style')) document.head.append(el('style', { id: 'w-ovoi-style', html: `
.w-ovoi { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; } @media (max-width: 560px) { .w-ovoi { grid-template-columns: 1fr; } }
.w-ovoi-box { border: 1px solid var(--border); border-radius: 12px; padding: 10px; }
.w-ovoi-box h5 { margin: 0 0 6px; font-size: 13px; }
.w-ovoi-rc { display: flex; flex-wrap: wrap; gap: 5px; }
.w-ovoi-r { font-size: 11px; font-family: var(--mono); border: 1px solid var(--border); border-radius: 6px; padding: 4px 6px; line-height: 1.35; background: var(--surface); transition: all .25s; }
.w-ovoi-r.hl { border-color: var(--accent); background: var(--accent-soft); }
.w-ovoi-r b { color: var(--accent); }
.w-ovoi-cnt { font-size: 12.5px; margin-top: 6px; color: var(--text-2); }
` }));
  const R = [['Asha', 'Pune', 'shoe', 40], ['Ben', 'Austin', 'sock', 15], ['Chen', 'Oslo', 'coat', 100], ['Dina', 'Pune', 'hat', 60], ['Eve', 'Lima', 'shoe', 30]];
  const rc = R.map((r) => el('div', { class: 'w-ovoi-r', html: `${r[0]}<br>${r[1]}<br>${r[2]}<br><b>$${r[3]}</b>` }));
  const col = R.map((r) => el('div', { class: 'w-ovoi-r', html: `<b>$${r[3]}</b>` }));
  const c1 = el('div', { class: 'w-ovoi-cnt', text: 'values looked at: 0' }), c2 = el('div', { class: 'w-ovoi-cnt', text: 'values looked at: 0' });
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: 'Press “Show me” to total the sales both ways.' }));
  const btn = el('button', { class: 'btn primary', text: '▶ Show me' });
  root.append(el('div', { class: 'w-ovoi' }, el('div', { class: 'w-ovoi-box' }, el('h5', { text: '🧾 Receipts (row storage)' }), el('div', { class: 'w-ovoi-rc' }, rc), c1),
    el('div', { class: 'w-ovoi-box' }, el('h5', { text: '📒 Ledger “amount” column (columnar)' }), el('div', { class: 'w-ovoi-rc' }, col), c2)),
    el('div', { class: 'w-controls', style: { marginTop: '12px', justifyContent: 'center' } }, btn), cap);
  let gen = 0;
  btn.addEventListener('click', async () => {
    const g = ++gen; [...rc, ...col].forEach((x) => x.classList.remove('hl')); let a = 0, b = 0, sum = 0;
    cap.firstChild.textContent = 'Receipts: pick up each one, skip past name, city and item, read the amount.';
    for (let i = 0; i < R.length; i++) { rc[i].classList.add('hl'); a += 4; sum += R[i][3]; c1.textContent = `values looked at: ${a} · running total $${sum}`; await sleep(reduced ? 200 : 700); if (g !== gen) return; }
    cap.firstChild.textContent = 'Ledger column: run a finger down one column. Nothing else is touched.';
    await sleep(reduced ? 300 : 1400); if (g !== gen) return; sum = 0;
    for (let i = 0; i < R.length; i++) { col[i].classList.add('hl'); b += 1; sum += R[i][3]; c2.textContent = `values looked at: ${b} · running total $${sum}`; await sleep(reduced ? 200 : 450); if (g !== gen) return; }
    cap.firstChild.textContent = `Same answer ($${sum}), 4× less reading. With 40 columns per row the gap would be 40×. But to answer “what did Dina buy?”, the receipts win.`;
  });
});

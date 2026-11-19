/* Beginner intro: find "Ben" via a catalogue card in a heap library (1 jump) vs a sorted library (catalogue gives ID, then walk the sorted shelves). */
IA.widget('relational-compared-intro', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-rci-style')) document.head.append(el('style', { id: 'w-rci-style', html: `
.w-rci { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; } @media (max-width: 560px) { .w-rci { grid-template-columns: 1fr; } }
.w-rci-lib { border: 1px solid var(--border); border-radius: 12px; padding: 10px; }
.w-rci-lib h5 { margin: 0 0 6px; font-size: 13px; }
.w-rci-row { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 6px; }
.w-rci-b { font-family: var(--mono); font-size: 11.5px; border: 1px solid var(--border); border-radius: 6px; padding: 3px 6px; background: var(--surface); transition: all .3s; }
.w-rci-b.hl { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); font-weight: 700; }
.w-rci-n { font-size: 12px; color: var(--text-2); min-height: 18px; }
` }));
  const mk = (title, cat, shelf) => { const c = cat.map((t) => el('span', { class: 'w-rci-b', text: t })); const s = shelf.map((t) => el('span', { class: 'w-rci-b', text: t })); const n = el('div', { class: 'w-rci-n' });
    return { c, s, n, node: el('div', { class: 'w-rci-lib' }, el('h5', { text: title }), el('div', { class: 'tiny', text: 'catalogue (index on name)' }), el('div', { class: 'w-rci-row' }, c), el('div', { class: 'tiny', text: 'shelves' }), el('div', { class: 'w-rci-row' }, s), n) }; };
  const H = mk('Heap (Postgres)', ['Asha→slot 4', 'Ben→slot 2', 'Chen→slot 1'], ['1: Chen', '2: Ben', '3: Dina', '4: Asha']);
  const C = mk('Clustered (InnoDB)', ['Asha→id 1', 'Ben→id 2', 'Chen→id 3'], ['id 1 Asha', 'id 2 Ben', 'id 3 Chen', 'id 4 Dina']);
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't', text: 'Press “Show me” to find Ben in both libraries.' }));
  const btn = el('button', { class: 'btn primary', text: '▶ Show me' });
  root.append(el('div', { class: 'w-rci' }, H.node, C.node), el('div', { class: 'w-controls', style: { marginTop: '12px', justifyContent: 'center' } }, btn), cap);
  let gen = 0;
  btn.addEventListener('click', async () => {
    const g = ++gen; const all = [...H.c, ...H.s, ...C.c, ...C.s]; all.forEach((b) => b.classList.remove('hl')); H.n.textContent = C.n.textContent = '';
    const w = () => sleep(reduced ? 400 : 2200);
    const seq = [
      () => { H.c[1].classList.add('hl'); C.c[1].classList.add('hl'); cap.firstChild.textContent = 'Both look up “Ben” in the catalogue (an index on name).'; },
      () => { H.s[1].classList.add('hl'); H.n.textContent = '1 jump: the card says exactly where.'; cap.firstChild.textContent = 'Heap: the card holds a physical location (slot 2). Go straight there.'; },
      () => { C.n.textContent = 'card gives id 2, then search the sorted shelves…'; cap.firstChild.textContent = 'Clustered: the card holds the book’s ID, not a location. You still have to find id 2 on the sorted shelves.'; },
      () => { C.s[1].classList.add('hl'); C.n.textContent = '2 searches, but shelves are always in id order.'; cap.firstChild.textContent = 'Found. The extra search is the price; the reward is that ranges by id (1–3) sit next to each other.'; }
    ];
    for (const f of seq) { if (g !== gen) return; f(); await w(); }
  });
});

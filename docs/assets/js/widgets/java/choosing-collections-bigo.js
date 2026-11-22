/* Choosing collections: clickable big-O and memory table. */
IA.widget('choosing-collections-bigo', (root, ctx) => {
  const { el } = ctx;
  const OPS = [
    ['idx', 'get(i)', 'Positional read.'],
    ['end', 'add/remove at end', 'Append, or pop from the tail. * = amortised: an occasional grow copies the array.'],
    ['front', 'add/remove at front', 'Queue/stack at the head.'],
    ['find', 'contains / get(key)', 'Find by value or key.'],
    ['mid', 'insert mid (iterator)', 'Insert or remove at a position the iterator already reached. Getting there is O(n) for every list.'],
    ['minmax', 'min / max / ordered', 'Smallest or largest element, or walking in sorted order.'],
    ['mem', 'memory / element', 'Approximate overhead per element on 64-bit HotSpot with compressed oops, excluding the element object itself.']
  ];
  const ROWS = [
    ['ArrayList', { idx: '1', end: '1*', front: 'n', find: 'n', mid: 'n', minmax: 'n', mem: '≈4 B + slack' }],
    ['LinkedList', { idx: 'n', end: '1', front: '1', find: 'n', mid: '1', minmax: 'n', mem: '≈24 B node' }],
    ['ArrayDeque', { idx: '—', end: '1*', front: '1*', find: 'n', mid: 'n', minmax: 'n', mem: '≈4 B + slack' }],
    ['HashMap / HashSet', { idx: '—', end: '—', front: '—', find: '1', mid: '—', minmax: 'n', mem: '≈36 B (node + slot)' }],
    ['LinkedHashMap', { idx: '—', end: '—', front: '—', find: '1', mid: '—', minmax: 'n', mem: '≈44 B' }],
    ['TreeMap / TreeSet', { idx: '—', end: '—', front: '—', find: 'log n', mid: '—', minmax: 'log n', mem: '≈40 B entry' }],
    ['PriorityQueue', { idx: '—', end: 'log n', front: 'log n (poll)', find: 'n', mid: '—', minmax: '1 (peek)', mem: '≈4 B + slack' }],
    ['EnumMap / EnumSet', { idx: '—', end: '—', front: '—', find: '1', mid: '—', minmax: '1 (first)', mem: '4 B / 1 bit per constant' }]
  ];
  let sel = 'front';
  const segO = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Operation' });
  const note = el('div', { class: 'caption', 'aria-live': 'polite' });
  const host = el('div', { class: 'tscroll' });
  const tone = (v) => v === '—' ? 'var(--text-3)' : /^1/.test(v) ? 'var(--ok)' : /^log/.test(v) ? 'var(--accent)' : /^n/.test(v) ? 'var(--warn)' : 'var(--text-2)';
  function paint() {
    const tb = el('tbody');
    ROWS.forEach(([name, c]) => tb.append(el('tr', null, el('td', { text: name }), OPS.map(([id]) => {
      const v = c[id]; const on = id === sel;
      return el('td', { text: id === 'mem' || v === '—' ? v : v.replace(/^(1|n|log n)(\*?)(.*)$/, (m, c, st, rest) => `O(${c})${st}${rest}`), style: { color: tone(v), fontWeight: on ? '700' : '400', background: on ? 'var(--accent-soft)' : '' } });
    }))));
    host.innerHTML = '';
    host.append(el('table', { class: 't rg', style: { minWidth: '680px' } }, el('thead', null, el('tr', null, el('th', { text: 'collection' }), OPS.map(([id, l]) => el('th', { text: l, style: id === sel ? { color: 'var(--accent)' } : null })))), tb));
    const o = OPS.find((x) => x[0] === sel);
    note.innerHTML = ''; note.append(el('div', { class: 't', html: `<b>${o[1]}</b>: ${o[2]} Green = O(1), blue = O(log n), orange = O(n), grey = not offered.` }));
  }
  OPS.forEach(([id, l]) => { const b = el('button', { text: l, class: id === sel ? 'on' : '' }); b.addEventListener('click', () => { sel = id; [...segO.children].forEach((x) => x.classList.toggle('on', x === b)); paint(); }); segO.append(b); });
  root.append(el('div', { class: 'w-controls' }, segO), host, note);
  paint();
});

/* Exclusion constraint: try booking a room; overlapping half-open ranges on the same room are rejected. */
IA.widget('constraints-exclusion', (root, ctx) => {
  const { el, svg } = ctx;
  const BOOK = [{ room: 'A', s: 9, e: 10.5, who: 'standup' }, { room: 'A', s: 13, e: 14, who: 'review' }, { room: 'B', s: 10, e: 12, who: 'workshop' }];
  const TRY = [
    { room: 'A', s: 10.5, e: 11.5, l: 'A 10:30–11:30' },
    { room: 'A', s: 10, e: 11, l: 'A 10:00–11:00' },
    { room: 'B', s: 9, e: 10, l: 'B 09:00–10:00' },
    { room: 'B', s: 11.5, e: 13, l: 'B 11:30–13:00' },
    { room: 'A', s: 12, e: 15, l: 'A 12:00–15:00' }
  ];
  let pick = 0;
  const seg = el('div', { class: 'seg' });
  TRY.forEach((t, i) => { const b = el('button', { text: t.l, class: i === pick ? 'on' : '' }); b.addEventListener('click', () => { pick = i; [...seg.children].forEach((x, j) => x.classList.toggle('on', j === i)); paint(); }); seg.append(b); });
  const W = 760, H = 150, X0 = 70, X1 = 740, h0 = 8, h1 = 18;
  const sx = (h) => X0 + ((h - h0) / (h1 - h0)) * (X1 - X0);
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Timeline of room bookings with a proposed booking' });
  const out = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  const code = el('div', { class: 'codebox' });
  root.append(el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'try to INSERT:' }), seg), el('div', { class: 'w-stage' }, stage), out, code);
  const hh = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;
  function paint() {
    const t = TRY[pick];
    const clash = BOOK.find((b) => b.room === t.room && t.s < b.e && b.s < t.e);
    stage.innerHTML = '';
    for (let h = h0; h <= h1; h++) stage.append(svg('line', { x1: sx(h), x2: sx(h), y1: 20, y2: 130, stroke: 'var(--border)' }), svg('text', { x: sx(h), y: 145, 'font-size': 11, 'text-anchor': 'middle', fill: 'var(--text-3)', text: h }));
    ['A', 'B'].forEach((r, i) => {
      const y = 30 + i * 50; stage.append(svg('text', { x: 10, y: y + 22, 'font-size': 13, 'font-weight': 700, fill: 'var(--text)', text: 'room ' + r }));
      BOOK.filter((b) => b.room === r).forEach((b) => stage.append(svg('rect', { x: sx(b.s), y, width: sx(b.e) - sx(b.s), height: 30, rx: 5, fill: 'var(--surface-2)', stroke: b === clash ? 'var(--err)' : 'var(--text-3)', 'stroke-width': b === clash ? 2 : 1 }), svg('text', { x: sx(b.s) + 5, y: y + 19, 'font-size': 11, fill: 'var(--text-2)', text: b.who })));
      if (t.room === r) stage.append(svg('rect', { x: sx(t.s), y: y + 4, width: sx(t.e) - sx(t.s), height: 22, rx: 5, fill: clash ? 'color-mix(in srgb, var(--err) 30%, transparent)' : 'color-mix(in srgb, var(--ok) 35%, transparent)', stroke: clash ? 'var(--err)' : 'var(--ok)', 'stroke-dasharray': '5 3', 'stroke-width': 2 }));
    });
    const adj = BOOK.find((b) => b.room === t.room && (b.e === t.s || b.s === t.e));
    out.firstChild.innerHTML = clash
      ? `<b style="color:var(--err)">ERROR: conflicting key value violates exclusion constraint.</b> Same room (<code>room =</code>) and the ranges overlap (<code>during &amp;&amp;</code>) with “${clash.who}” ${hh(clash.s)}–${hh(clash.e)}.`
      : `<b style="color:var(--ok)">INSERT 0 1.</b> ${adj ? `It touches “${adj.who}” at ${hh(t.s === adj.e ? t.s : t.e)}, but ranges are half-open <code>[start, end)</code>, so touching isn’t overlapping.` : 'No booking in the same room overlaps.'} Two concurrent inserts can’t both win: the GiST index check serializes them.`;
    code.innerHTML = ''; code.append(el('pre', { html: IA.highlight(`CREATE EXTENSION btree_gist;   -- lets GiST handle "room WITH ="\nALTER TABLE bookings ADD EXCLUDE USING gist (room WITH =, during WITH &&);\n\nINSERT INTO bookings (room, during)\nVALUES ('${t.room}', '[2026-03-02 ${hh(t.s)}, 2026-03-02 ${hh(t.e)})');`, 'sql') }));
  }
  paint();
});

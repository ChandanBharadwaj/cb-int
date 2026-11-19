/* Cache-aside with Redis: read/update interactively, then replay the classic stale-cache race. */
IA.widget('polyglot-persistence-cache', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  let db = 100, cache = null, ttl = 0, inval = 'delete', gen = 0, hits = 0, miss = 0;
  const box = (t) => { const v = el('div', { style: { fontFamily: 'var(--mono)', fontSize: '20px', fontWeight: '700' } }); const n = el('div', { class: 'card', style: { padding: '10px', textAlign: 'center', minWidth: '0' } }, el('div', { class: 'kicker', text: t }), v); n._v = v; return n; };
  const C = box('Redis: price:42'), D = box('Postgres: product 42');
  const log = el('div', { class: 'w-log', 'aria-live': 'polite', style: { minHeight: '90px' } });
  const stats = el('div', { class: 'w-stats' });
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Invalidation' });
  [['delete', 'On write: delete key'], ['set', 'On write: set cache']].forEach(([v, l]) => { const b = el('button', { text: l, class: v === inval ? 'on' : '' }); b.addEventListener('click', () => { inval = v; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); }); seg.append(b); });
  const bR = el('button', { class: 'btn primary', text: 'Read' }), bU = el('button', { class: 'btn', text: 'Update price +10' }), bRace = el('button', { class: 'btn', text: '▶ Play the race' }), bX = el('button', { class: 'btn', text: '↺ Reset' });
  root.append(el('div', { class: 'w-controls' }, seg), el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } }, C, D),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bR, bU, bRace, bX), stats, log);
  const add = (t, c) => { log.prepend(el('div', { html: t, style: { color: c ? `var(--${c})` : null } })); while (log.children.length > 7) log.lastChild.remove(); };
  const paint = () => { C._v.textContent = cache == null ? '(empty)' : String(cache); D._v.textContent = String(db); C.style.borderColor = cache != null && cache !== db ? 'var(--err)' : ''; stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `hits <b>${hits}</b>` }), el('span', { class: 'w-stat', html: `misses <b>${miss}</b>` }), el('span', { class: 'w-stat', html: cache != null && cache !== db ? '<b style="color:var(--err)">STALE</b> until TTL' : 'consistent' })); };
  bR.addEventListener('click', () => { if (cache != null) { hits++; add(`GET price:42 → hit (${cache})`, cache === db ? 'ok' : 'err'); } else { miss++; cache = db; add(`GET price:42 → miss → SELECT from Postgres (${db}) → SET with TTL`, 'warn'); } paint(); });
  bU.addEventListener('click', () => { db += 10; if (inval === 'delete') { cache = null; add(`UPDATE Postgres → ${db}; then DEL price:42 (next read refills)`); } else { cache = db; add(`UPDATE Postgres → ${db}; then SET price:42 = ${db} (concurrent writers can set out of order)`, 'warn'); } paint(); });
  bX.addEventListener('click', () => { gen++; db = 100; cache = null; hits = miss = 0; log.innerHTML = ''; paint(); });
  bRace.addEventListener('click', async () => {
    const g = ++gen; db = 100; cache = null; log.innerHTML = ''; paint(); const w = () => sleep(reduced ? 300 : 1800);
    const S = [
      () => add('Reader A: GET price:42 → miss.', 'warn'),
      () => add('Reader A: SELECT price → <b>100</b>… (then A is paused: GC, slow network)'),
      () => { db = 110; add('Writer B: UPDATE price = 110, COMMIT.'); },
      () => { cache = null; add('Writer B: DEL price:42 (nothing there yet).'); },
      () => { cache = 100; add('Reader A resumes: SET price:42 = <b>100</b>. The cache now holds an old value.', 'err'); },
      () => add('Every reader gets 100 until the TTL expires. Mitigations: short TTLs, delete again after a delay (“delayed double delete”), versioned values (set only if newer), or invalidate from CDC events in commit order.', 'warn')
    ];
    for (const f of S) { if (g !== gen) return; f(); paint(); await w(); }
  });
  paint();
});

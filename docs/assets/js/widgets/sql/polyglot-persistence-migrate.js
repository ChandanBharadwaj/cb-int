/* Zero-downtime migration off a database: dual-write → backfill → shadow reads → cutover → decommission. */
IA.widget('polyglot-persistence-migrate', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-ppm-style')) document.head.append(el('style', { id: 'w-ppm-style', html: `
.w-ppm-g { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.w-ppm-db { border: 2px solid var(--border); border-radius: 12px; padding: 10px; transition: all .3s; min-width: 0; }
.w-ppm-db.prim { border-color: var(--accent); background: var(--accent-soft); }
.w-ppm-db.gone { opacity: .35; border-style: dashed; }
.w-ppm-bar { height: 10px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; margin-top: 6px; }
.w-ppm-bar i { display: block; height: 100%; background: var(--ok); width: 0; transition: width .6s; }
.w-ppm-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
.w-ppm-tags span { font-size: 11.5px; border: 1px solid var(--border); border-radius: 99px; padding: 1px 7px; }
.w-ppm-tags span.on { border-color: var(--accent); color: var(--accent); font-weight: 600; }
.w-ppm-ph { display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0 0; }
.w-ppm-ph span { font-size: 12px; padding: 2px 8px; border-radius: 99px; border: 1px solid var(--border); color: var(--text-3); }
.w-ppm-ph span.on { border-color: var(--accent); color: var(--accent); font-weight: 600; } .w-ppm-ph span.done { color: var(--ok); border-color: var(--ok); }
` }));
  let gen = 0, k = 0, running = false, speed = 2400, mismatch = 'fix';
  const mk = (name) => { const bar = el('i'); const tags = el('div', { class: 'w-ppm-tags' }, ['writes', 'reads', 'source of truth'].map((t) => el('span', { text: t })));
    const n = el('div', { class: 'w-ppm-db' }, el('b', { text: name }), el('div', { class: 'w-ppm-bar' }, bar), el('div', { class: 'tiny', text: 'data copied' }), tags); n._bar = bar; n._tags = tags; return n; };
  const O = mk('Old store (e.g. MongoDB)'), N = mk('New store (Postgres)');
  const PH = ['1 dual-write', '2 backfill', '3 shadow reads', '4 cutover', '5 decommission'];
  const ph = el('div', { class: 'w-ppm-ph' }, PH.map((p) => el('span', { text: p })));
  const stats = el('div', { class: 'w-stats' });
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Shadow-read result' });
  [['fix', 'Shadow reads find a bug'], ['clean', 'Shadow reads clean']].forEach(([v, l]) => { const b = el('button', { text: l, class: v === mismatch ? 'on' : '' }); b.addEventListener('click', () => { mismatch = v; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); seg.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }), bStep = el('button', { class: 'btn', text: 'Step ›' }), bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const sp = el('div', { class: 'seg', 'aria-label': 'Speed' });
  [['Slow', 3600], ['Normal', 2400], ['Fast', 1100]].forEach(([l, v]) => { const b = el('button', { text: l, class: v === speed ? 'on' : '' }); b.addEventListener('click', () => { speed = v; [...sp.children].forEach((x) => x.classList.toggle('on', x === b)); }); sp.append(b); });
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  root.append(el('div', { class: 'w-controls' }, seg), el('div', { class: 'w-stage' }, el('div', { class: 'w-ppm-g' }, O, N), ph), stats,
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), sp), cap);
  const tag = (db, arr) => [...db._tags.children].forEach((t, i) => t.classList.toggle('on', arr[i]));
  const st = (a) => { stats.innerHTML = ''; a.forEach(([x, y]) => stats.append(el('span', { class: 'w-stat', html: `${x} <b>${y}</b>` }))); };
  const phase = (i) => [...ph.children].forEach((p, j) => { p.classList.toggle('on', j === i); p.classList.toggle('done', j < i); });
  function frames() {
    const F = [
      ['Start: the old store serves all reads and writes and is the source of truth.', () => { O.classList.add('prim'); tag(O, [1, 1, 1]); tag(N, [0, 0, 0]); O._bar.style.width = '100%'; }],
      ['Phase 1, dual-write: every new write also goes to the new store (via CDC from the old store, or async from the app, with retries). The old store stays the source of truth; failures on the new side are logged, never shown to users.', () => { phase(0); tag(N, [1, 0, 0]); N._bar.style.width = '15%'; st([['new-store coverage', 'new writes only']]); }],
      ['Phase 2, backfill: copy historical rows in batches, idempotently (upsert by id, skip rows that are newer in the new store because dual-write already wrote them).', () => { phase(1); N._bar.style.width = '100%'; st([['backfill', '100%'], ['rows conflicting with dual-write', 'resolved by version']]); }],
      ['Phase 3, shadow reads: serve users from the old store, and also read the new store in the background and <b>compare</b>. Log every mismatch.', () => { phase(2); tag(N, [1, 1, 0]); st(mismatch === 'fix' ? [['compared', '1.2M reads'], ['mismatches', '0.4%']] : [['compared', '1.2M reads'], ['mismatches', '0']]); }]
    ];
    if (mismatch === 'fix') F.push(['Mismatches found: timezone handling differs and a nested array was flattened wrongly. Fix the mapping, re-backfill the affected rows, and keep shadowing until mismatches reach zero. This is why the phase exists.', () => { st([['compared', '3.5M reads'], ['mismatches', '0 after fix']]); }]);
    F.push(['Phase 4, cutover: flip reads (feature flag, per percentage of traffic), then make the new store the source of truth. Keep writing back to the old store for a while so rollback is a flag flip.', () => { phase(3); O.classList.remove('prim'); N.classList.add('prim'); tag(N, [1, 1, 1]); tag(O, [1, 0, 0]); st([['reads on new', '1% → 10% → 100%'], ['rollback', 'flag flip']]); }]);
    F.push(['Phase 5, decommission: stop the reverse writes, take a final snapshot of the old store, and remove it. Zero downtime, and at every step there was a way back.', () => { phase(4); [...ph.children].forEach((p) => p.classList.add('done')); tag(O, [0, 0, 0]); O.classList.add('gone'); st([['downtime', '0'], ['old store', 'archived']]); }]);
    return F;
  }
  let F = [];
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; bStep.disabled = false; F = frames(); [O, N].forEach((d) => { d.className = 'w-ppm-db'; d._bar.style.width = '0'; tag(d, [0, 0, 0]); }); phase(-1); stats.innerHTML = ''; cap.firstChild.textContent = 'Press Play to migrate without downtime.'; }
  function step() { if (k >= F.length) return false; const [t, f] = F[k++]; f(); cap.firstChild.innerHTML = t; if (k >= F.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= F.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 600 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

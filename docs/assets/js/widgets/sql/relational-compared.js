/* Relational engines compared: heap + TID (Postgres) vs clustered index (InnoDB), and MVCC version-in-heap vs undo log. */
IA.widget('relational-compared', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-rc-style')) document.head.append(el('style', { id: 'w-rc-style', html: `
.w-rc-lanes { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.w-rc-lane { border: 1px solid var(--border); border-radius: 12px; padding: 8px; background: var(--surface-2); min-width: 0; }
.w-rc-lane h5 { margin: 0 0 6px; font-size: 12.5px; font-family: var(--mono); }
.w-rc-lane .sub { font-size: 11px; color: var(--text-3); margin: -4px 0 6px; }
.w-rc-it { border: 1px solid var(--border); background: var(--surface); border-radius: 8px; padding: 5px 7px; font-family: var(--mono); font-size: 11.5px; margin-bottom: 5px; transition: all .3s; word-break: break-word; }
.w-rc-it.hot { border-color: var(--accent); background: var(--accent-soft); box-shadow: 0 0 0 2px var(--accent-soft); }
.w-rc-it.dead { opacity: .45; text-decoration: line-through; }
.w-rc-it.new { border-color: var(--ok); animation: capin .35s ease both; }
.w-rc-it.old { border-color: var(--warn); border-style: dashed; }
.w-rc-it.gone { display: none; }
.w-rc-hops { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.w-rc-hop { font-size: 12px; padding: 2px 8px; border-radius: 99px; border: 1px solid var(--border); color: var(--text-3); }
.w-rc-hop.on { border-color: var(--accent); color: var(--accent); font-weight: 600; }
` }));
  let eng = 'pg', mode = 'lookup', gen = 0, k = 0, frames = [], running = false, speed = 2400;
  const mkSeg = (label, items, cur, on) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const stage = el('div', { class: 'w-rc-lanes' });
  const hops = el('div', { class: 'w-rc-hops' });
  const sql = el('div', { class: 'codebox', style: { marginBottom: '10px' } });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }), bStep = el('button', { class: 'btn', text: 'Step ›' }), bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' }));
  root.append(el('div', { class: 'w-controls' }, mkSeg('Engine', [['pg', 'PostgreSQL (heap)'], ['inno', 'MySQL InnoDB (clustered)'], ['ora', 'Oracle (heap + undo)']], eng, (v) => { eng = v; reset(); })),
    el('div', { class: 'w-controls' }, mkSeg('Scenario', [['lookup', 'Secondary-index lookup'], ['mvcc', 'UPDATE + old snapshot (MVCC)']], mode, (v) => { mode = v; reset(); })),
    sql, el('div', { class: 'w-stage' }, stage, hops),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), mkSeg('Speed', [[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], 2400, (v) => { speed = v; })), cap);

  const lanes = {}; const items = {};
  function lane(id, title, sub, list) { const L = el('div', { class: 'w-rc-lane' }, el('h5', { text: title }), sub ? el('div', { class: 'sub', text: sub }) : null);
    list.forEach(([key, txt, cls]) => { const n = el('div', { class: 'w-rc-it ' + (cls || ''), text: txt }); items[key] = n; L.append(n); }); lanes[id] = L; stage.append(L); return L; }
  const hot = (...ks) => { Object.values(items).forEach((n) => n.classList.remove('hot')); ks.forEach((x) => items[x] && items[x].classList.add('hot')); };
  const add = (laneId, key, txt, cls) => { const n = el('div', { class: 'w-rc-it ' + (cls || 'new'), text: txt }); items[key] = n; lanes[laneId].append(n); return n; };
  let hopEls = [];
  const setHops = (arr) => { hops.innerHTML = ''; hopEls = arr.map((h) => el('span', { class: 'w-rc-hop', text: h })); hops.append(el('span', { class: 'tiny', text: 'path:' }), ...hopEls); };
  const hop = (i) => hopEls.forEach((h, j) => h.classList.toggle('on', j <= i));
  const code = (s) => { sql.innerHTML = ''; sql.append(el('pre', { html: IA.highlight(s, 'sql') })); };

  function build() {
    stage.innerHTML = ''; for (const x in items) delete items[x];
    const F = [];
    if (mode === 'lookup') {
      code("SELECT * FROM users WHERE email = 'ben@x.io';   -- users(id PK, email UNIQUE, name)");
      if (eng === 'inno') {
        lane('sec', 'idx_email (secondary)', 'leaf: email → PRIMARY KEY value', [['s1', 'asha@x.io → 17'], ['s2', 'ben@x.io → 42'], ['s3', 'chen@x.io → 8']]);
        lane('pk', 'PRIMARY (clustered)', 'the table IS this B-tree, ordered by id', [['p0', 'root: <30 | ≥30'], ['p1', 'leaf: 8 · 17 · 23'], ['p2', 'leaf: 42 {ben@x.io, Ben, …}']]);
        setHops(['idx_email descent', 'read PK = 42', 'PRIMARY descent', 'row in leaf']);
        F.push(['Descend the secondary index on email, like any B-tree.', () => { hot('s2'); hop(0); }]);
        F.push(['The leaf does not store a disk address. It stores the <b>primary key value</b> (42). In InnoDB, every secondary index entry carries the PK.', () => { hot('s2'); hop(1); }]);
        F.push(['So we descend a <b>second</b> B-tree: the clustered PRIMARY index, from its root…', () => { hot('p0'); hop(2); }]);
        F.push(['…to the leaf that holds the whole row. Two tree descents per lookup. A covering secondary index (all needed columns in the index) skips the second one.', () => { hot('p2'); hop(3); }]);
        F.push(['Consequence: a wide PK (e.g. a 36-char UUID string) bloats <i>every</i> secondary index, and random PKs cause page splits in the clustered tree. Prefer small, roughly increasing keys.', () => hot()]);
      } else {
        const ora = eng === 'ora';
        lane('sec', 'idx_email (B-tree)', ora ? 'leaf: email → ROWID' : 'leaf: email → TID (page, slot)', [['s1', ora ? 'asha@x.io → AAAB.3.1' : 'asha@x.io → (0,4)'], ['s2', ora ? 'ben@x.io → AAAB.7.2' : 'ben@x.io → (3,7)'], ['s3', ora ? 'chen@x.io → AAAB.1.5' : 'chen@x.io → (1,2)']]);
        lane('heap', ora ? 'heap table (default)' : 'heap (unordered pages)', 'rows live wherever there was free space', [['h0', 'page 0: …'], ['h1', 'page 1: …'], ['h3', ora ? 'block 7 row 2: {42, ben@x.io, Ben}' : 'page 3 slot 7: {42, ben@x.io, Ben}']]);
        setHops(['index descent', ora ? 'read ROWID' : 'read TID', 'jump to heap page', ora ? 'consistent read check' : 'visibility check']);
        F.push(['Descend the B-tree on email.', () => { hot('s2'); hop(0); }]);
        F.push([ora ? 'The leaf stores a <b>ROWID</b>: a physical address of the row.' : 'The leaf stores a <b>TID</b> <code>(3,7)</code>: page 3, line pointer 7. A physical address, not the PK.', () => { hot('s2'); hop(1); }]);
        F.push(['One jump to that heap page. No second tree descent, and the PK index is just another secondary index.', () => { hot('h3'); hop(2); }]);
        F.push([ora ? 'Oracle checks the block against your snapshot and, if needed, rebuilds the old version from undo.' : 'Postgres checks the tuple’s <code>xmin/xmax</code> against your snapshot. An <b>index-only scan</b> can skip the heap when the visibility map says the page is all-visible.', () => { hot('h3'); hop(3); }]);
        F.push([ora ? 'Oracle also offers index-organized tables (IOTs), which behave like InnoDB’s clustered layout.' : 'Trade-off: an UPDATE that creates a new tuple on another page must add entries to every index (unless it is a HOT update on the same page). <code>CLUSTER</code> reorders once; it is not maintained.', () => hot()]);
      }
    } else {
      code("-- session A (old snapshot)          -- session B\nBEGIN ISOLATION LEVEL REPEATABLE READ;\nSELECT balance FROM acct WHERE id=1;  UPDATE acct SET balance=80 WHERE id=1; COMMIT;\nSELECT balance FROM acct WHERE id=1;  -- still 100");
      if (eng === 'pg') {
        lane('heap', 'heap page', 'every version is a full tuple in the table', [['v1', 'id=1 bal=100  xmin=500 xmax=–']]);
        lane('idx', 'index on id', null, [['i1', '1 → (0,1)']]);
        lane('vac', 'VACUUM', 'removes versions no snapshot can see', [['vq', 'idle']]);
        setHops(['A snapshot', 'B writes new tuple', 'A reads old tuple', 'A ends', 'VACUUM']);
        F.push(['Session A takes a snapshot. The row has one version, created by transaction 500.', () => { hot('v1'); hop(0); }]);
        F.push(['B (xid 612) updates: Postgres does <b>not</b> overwrite. It writes a <b>new tuple</b> in the heap and stamps the old one with <code>xmax=612</code>. If the new tuple fits on the same page and no indexed column changed, it is a HOT update and the index is not touched.', () => { items.v1.textContent = 'id=1 bal=100  xmin=500 xmax=612'; items.v1.classList.add('old'); add('heap', 'v2', 'id=1 bal=80   xmin=612 xmax=–'); hot('v2'); hop(1); }]);
        F.push(['A reads again: 612 is not in A’s snapshot, so the old tuple (100) is visible to A and the new one is not. Readers never block writers.', () => { hot('v1'); hop(2); }]);
        F.push(['A commits. Now no snapshot needs the 100 version: it is a <b>dead tuple</b>, still taking space in the table.', () => { items.v1.classList.add('dead'); hot(); hop(3); }]);
        F.push(['(Auto)VACUUM later marks the space reusable and cleans index pointers. A long-running transaction holds back this cleanup, so the table <b>bloats</b>. Old versions live in the table itself.', () => { items.vq.textContent = 'removed 1 dead tuple'; items.v1.classList.add('gone'); hot('vq'); hop(4); }]);
      } else {
        const ora = eng === 'ora';
        lane('tbl', ora ? 'table block' : 'clustered index leaf', 'holds only the latest version', [['r', 'id=1 bal=100  trx=500']]);
        lane('undo', ora ? 'undo segment' : 'undo log', 'before-images, linked by roll pointer', [['uq', '(empty)']]);
        lane('purge', ora ? 'undo retention' : 'purge thread', 'drops undo no snapshot needs', [['pq', 'idle']]);
        setHops(['A snapshot', 'B updates in place', 'A rebuilds from undo', 'A ends', ora ? 'undo expires' : 'purge']);
        F.push(['Session A takes a snapshot (a read view). The row has one version.', () => { hot('r'); hop(0); }]);
        F.push([`B updates <b>in place</b>: the row now says 80. The old value is copied to the <b>${ora ? 'undo segment' : 'undo log'}</b>, and the row keeps a pointer to it.`, () => { items.uq.textContent = 'before-image: bal=100 (trx 500)'; items.uq.classList.add('new'); items.r.textContent = 'id=1 bal=80   trx=612 → undo'; hot('r', 'uq'); hop(1); }]);
        F.push(['A reads again: the current row is too new for A’s snapshot, so the engine follows the pointer and <b>rebuilds</b> the old version from undo. Old readers pay extra work; the table itself does not grow.', () => { hot('uq'); hop(2); }]);
        F.push(['A commits. The before-image is no longer needed by anyone.', () => { items.uq.classList.add('dead'); hot(); hop(3); }]);
        F.push([ora ? 'Undo is reused after the retention period. A query that needs undo that has already been overwritten fails with <code>ORA-01555: snapshot too old</code>.' : 'The purge thread removes old undo. A long transaction makes the undo history (“history list length”) grow and slows reads that must walk long version chains.', () => { items.pq.textContent = ora ? 'undo space reused' : 'purged 1 record'; items.uq.classList.add('gone'); hot('pq'); hop(4); }]);
      }
    }
    return F;
  }
  const say = (t) => { cap.firstChild.innerHTML = t; };
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; bStep.disabled = false; frames = build(); say('Press Play or Step. Switch the engine to compare the same operation.'); }
  function step() { if (k >= frames.length) return false; const [t, f] = frames[k++]; f(); say(t); if (k >= frames.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= frames.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 600 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

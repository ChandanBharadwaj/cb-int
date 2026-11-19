/* MVCC + VACUUM: row versions (xmin/xmax/ctid) across two UPDATEs, two snapshots, HOT, and what VACUUM may reclaim. */
IA.widget('mvcc-vacuum', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-mvcc-style')) {
    document.head.append(el('style', { id: 'w-mvcc-style', text: `
.w-mvcc-sess { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
.w-mvcc-s { border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; background: var(--surface-2); font-size: 13px; min-width: 0; }
.w-mvcc-s b { font-family: var(--mono); }
.w-mvcc-s.hot { border-color: var(--accent); background: var(--accent-soft); }
.w-mvcc-s .st { font-family: var(--mono); font-size: 12px; color: var(--text-2); overflow-wrap: anywhere; }
.w-mvcc-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2.4fr); gap: 10px; }
@media (max-width: 620px) { .w-mvcc-grid { grid-template-columns: 1fr; } }
.w-mvcc-idx { border: 1px dashed var(--border); border-radius: 10px; padding: 8px; font-family: var(--mono); font-size: 12px; }
.w-mvcc-idx div { padding: 3px 6px; border-radius: 6px; margin: 3px 0; background: var(--surface-2); }
.w-mvcc-idx div.new { outline: 2px solid var(--warn); }
.w-mvcc-idx div.gone { text-decoration: line-through; opacity: .45; }
.w-mvcc tr.dead td { color: var(--text-3); }
.w-mvcc tr.free td { color: var(--text-3); font-style: italic; }
.w-mvcc tr.flash td { background: var(--accent-soft); }
.w-mvcc td.yes { color: var(--ok); font-weight: 700; } .w-mvcc td.no { color: var(--text-3); }
.w-mvcc .xp { color: var(--warn); } .w-mvcc .xa { color: var(--err); text-decoration: line-through; }
` }));
  }
  let iso = 'RR'; let hot = 'hot'; let aEnd = 'idle'; let vac = 'plain';
  let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segIso = seg([['RC', 'A: READ COMMITTED'], ['RR', 'A: REPEATABLE READ']], () => iso, (v) => { iso = v; reset(); }, 'Isolation of session A');
  const segHot = seg([['hot', 'bal not indexed (HOT)'], ['nohot', 'index on bal (no HOT)']], () => hot, (v) => { hot = v; reset(); }, 'Index on bal');
  const segEnd = seg([['commit', 'A commits early'], ['idle', 'A stays idle in transaction']], () => aEnd, (v) => { aEnd = v; reset(); }, 'Session A lifetime');
  const segVac = seg([['plain', 'VACUUM'], ['full', 'VACUUM FULL']], () => vac, (v) => { vac = v; reset(); }, 'Vacuum kind');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const sessA = el('div', { class: 'w-mvcc-s' }); const sessB = el('div', { class: 'w-mvcc-s' });
  const idx = el('div', { class: 'w-mvcc-idx' });
  const heap = el('div', { class: 'tscroll' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  const stats = el('div', { class: 'w-stats' });
  root.classList.add('w-mvcc');
  root.append(el('div', { class: 'w-controls' }, segIso, segHot), el('div', { class: 'w-controls' }, segEnd, segVac),
    el('div', { class: 'w-mvcc-sess' }, sessA, sessB),
    el('div', { class: 'w-mvcc-grid' }, idx, heap),
    el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, stats);

  // ---- simulated state ----
  let V; let tx; let A; let B; let ix; let horizonNote; let fileNote; let flash;
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const committed = (x) => x === 100 || tx[x] === 'c';
  // snapshot: {xmin, xmax, xip:[]}. A committed xid is visible if < xmin, or < xmax and not in xip.
  const vis = (snap, x) => committed(x) && (x < snap.xmin || (x < snap.xmax && !snap.xip.includes(x)));
  const seen = (snap, v) => v.state === 'live' && vis(snap, v.xmin) && !(v.xmax && vis(snap, v.xmax));
  const nextXid = () => 101 + Object.keys(tx).length;
  const fresh = () => { const nx = nextXid(); const ip = Object.keys(tx).map(Number).filter((x) => tx[x] === 'p'); return { xmin: ip.length ? Math.min(...ip) : nx, xmax: nx, xip: ip }; };
  const snapTxt = (s) => s ? `snapshot {xmin ${s.xmin}, xmax ${s.xmax}${s.xip.length ? ', in-progress [' + s.xip.join(',') + ']' : ''}}` : 'no snapshot';
  const xTxt = (x) => !x ? '0' : tx[x] === 'p' ? `<span class="xp">${x} (running)</span>` : tx[x] === 'a' ? `<span class="xa">${x}</span>` : String(x);
  function render() {
    const sAt = (s, name, d) => { s.innerHTML = ''; s.classList.toggle('hot', !!d.hot); s.append(el('div', { html: `<b>${name}</b> · ${d.state}` }), el('div', { class: 'st', text: d.info || '' })); };
    sAt(sessA, 'Session A (reader)', A); sAt(sessB, 'Session B (writer)', B);
    idx.innerHTML = ''; idx.append(el('div', { class: 'tiny', style: { background: 'none' }, text: 'indexes → ctid' }));
    ix.forEach((e) => idx.append(el('div', { class: e.cls || '', text: `${e.name}: ${e.key} → ${e.to}` })));
    const now = fresh();
    const tb = el('tbody');
    V.forEach((v, i) => {
      const live = v.state === 'live';
      const tr = el('tr', { class: (live ? (seen(now, v) || (v.xmin && tx[v.xmin] === 'p') ? '' : 'dead') : 'free') + (flash === i ? ' flash' : '') });
      const aSees = A.snap && live ? seen(A.snap, v) : null;
      const cells = live ? [v.ctid, xTxt(v.xmin), xTxt(v.xmax), v.bal, v.note || ''] : [v.ctid, '', '', '', v.note || ''];
      cells.forEach((c, j) => tr.append(el('td', { html: String(c), style: j === 4 ? { fontSize: '12px', fontFamily: 'inherit' } : null })));
      tr.append(el('td', { class: aSees == null ? 'no' : aSees ? 'yes' : 'no', text: aSees == null ? '·' : aSees ? '✓' : '✗' }));
      tr.append(el('td', { class: live && seen(now, v) ? 'yes' : 'no', text: live ? (seen(now, v) ? '✓' : '✗') : '·' }));
      tb.append(tr);
    });
    heap.innerHTML = ''; heap.append(el('table', { class: 't rg', style: { minWidth: '520px' } },
      el('thead', null, el('tr', null, ['ctid', 'xmin', 'xmax', 'bal', 'line pointer / note', 'A sees', 'new txn sees'].map((h) => el('th', { text: h })))), tb));
    const deadN = V.filter((v) => v.state === 'live' && !seen(now, v) && !(tx[v.xmin] === 'p')).length;
    stats.innerHTML = '';
    stats.append(el('span', { class: 'w-stat', html: `next xid <b>${nextXid()}</b>` }), el('span', { class: 'w-stat', html: `dead versions <b>${deadN}</b>` }),
      el('span', { class: 'w-stat', html: `xmin horizon <b>${horizon()}</b>` + (horizonNote ? ' · ' + horizonNote : '') }), el('span', { class: 'w-stat', html: fileNote }));
  }
  function horizon() { let h = nextXid(); Object.keys(tx).forEach((x) => { if (tx[x] === 'p') h = Math.min(h, +x); }); if (A.snap && A.open) h = Math.min(h, A.snap.xmin); return h; }
  function update(xid, bal) {
    const root = V.find((v) => v.state === 'live' && !v.xmax && committed(v.xmin));
    root.xmax = xid; const ctid = `(0,${V.length + 1})`;
    V.push({ ctid, xmin: xid, xmax: 0, bal, state: 'live', note: hot === 'hot' ? 'heap-only tuple' : '' });
    if (hot === 'hot') root.note = (root.note ? root.note + ', ' : '') + 'HOT-updated → ' + ctid;
    else { ix.forEach((e) => { e.cls = ''; }); ix.push({ name: 'pkey', key: 'id=1', to: ctid, cls: 'new' }); ix.push({ name: 'idx_bal', key: String(bal), to: ctid, cls: 'new' }); }
    flash = V.length - 1; return ctid;
  }
  function vacuum() {
    const h = horizon(); let n = 0;
    V.forEach((v) => { if (v.state === 'live' && v.xmax && committed(v.xmax) && v.xmax < h) { v.state = 'free'; n++; } });
    if (!n) return 0;
    if (hot === 'hot') { const first = V[0]; const live = V.find((v) => v.state === 'live'); if (first.state === 'free') first.note = 'LP_REDIRECT → ' + live.ctid; V.forEach((v, i) => { if (i && v.state === 'free') v.note = 'LP_UNUSED (reusable)'; }); }
    else { V.forEach((v) => { if (v.state === 'free') v.note = 'LP_UNUSED (reusable)'; }); ix.forEach((e) => { const t = V.find((v) => v.ctid === e.to); if (t && t.state === 'free') e.cls = 'gone'; else e.cls = ''; }); }
    return n;
  }
  function vacuumFull() {
    const live = V.filter((v) => v.state === 'live' && !(v.xmax && committed(v.xmax)));
    V = live.map((v) => ({ ...v, ctid: '(0,1)', note: 'rewritten into a new file' }));
    ix = [{ name: 'pkey', key: 'id=1', to: '(0,1)', cls: 'new' }].concat(hot === 'hot' ? [] : [{ name: 'idx_bal', key: String(live[0].bal), to: '(0,1)', cls: 'new' }]);
    fileNote = 'file: <b>1 page</b> (rewritten)';
  }
  function plan() {
    const st = [];
    const aRead = (label) => () => { if (iso === 'RC' || !A.snap) A.snap = fresh(); const v = V.find((x) => seen(A.snap, x)); A.state = 'SELECT → bal ' + v.bal; A.info = snapTxt(A.snap); A.hot = true; B.hot = false; A.read = v.bal; flash = V.indexOf(v); if (iso === 'RC') A.keep = false; };
    st.push({ run: aRead(), t: () => `<b>A</b> runs <code>BEGIN ISOLATION LEVEL ${iso === 'RR' ? 'REPEATABLE READ' : 'READ COMMITTED'}; SELECT bal …</code>. It takes a snapshot: every xid &lt; ${A.snap.xmin} that committed is visible. It sees version (0,1) → <b>${A.read}</b>.` });
    st.push({ run: () => { tx[101] = 'p'; const c = update(101, 150); B.state = 'xid 101 · UPDATE bal = 150'; B.info = 'uncommitted'; B.hot = true; A.hot = false; B.c = c; },
      t: () => `<b>B</b> (xid 101) runs <code>UPDATE acct SET bal = 150</code>. Postgres does not overwrite: it sets <b>xmax = 101</b> on the old version and writes a new one at <b>${B.c}</b> with <b>xmin = 101</b>. ` + (hot === 'hot' ? 'No indexed column changed and the page has room, so this is a <b>HOT</b> update: no new index entries.' : 'bal is indexed, so HOT is impossible: <b>every index</b> gets a new entry (yellow).') });
    st.push({ run: aRead(), t: () => `<b>A</b> reads again. xid 101 is still running, so its new version is invisible and its xmax doesn’t count. A still sees <b>${A.read}</b>. Readers never wait for writers.` });
    st.push({ run: () => { tx[101] = 'c'; B.state = 'COMMIT (xid 101)'; B.info = 'committed'; B.hot = true; A.hot = false; flash = null; }, t: () => 'B commits. Only the commit log (pg_xact) changes: 101 is now “committed”. No tuple is rewritten.' });
    st.push({ run: aRead(), t: () => iso === 'RR' ? `<b>A</b> (REPEATABLE READ) reuses the snapshot taken at its first query, where 101 was not yet committed. A still sees <b>${A.read}</b>. Two snapshots, two different versions of the same row.` : `<b>A</b> (READ COMMITTED) takes a <b>new snapshot per statement</b>. Now 101 is committed, so A sees <b>${A.read}</b>.` });
    st.push({ run: () => { tx[102] = 'c'; const c = update(102, 175); B.state = 'xid 102 · UPDATE bal = 175; COMMIT'; B.info = 'committed'; B.hot = true; A.hot = false; B.c = c; }, t: () => `B updates again (xid 102) and commits. Version (0,2) gets xmax 102, and the newest version is ${B.c}. One logical row now occupies <b>3 tuples</b>.` });
    if (aEnd === 'commit') st.push({ run: () => { A.state = 'COMMIT'; A.info = 'finished'; A.snap = null; A.open = false; A.hot = true; B.hot = false; flash = null; }, t: () => 'A commits. Its snapshot is gone, so nothing old needs to stay visible.' });
    else st.push({ run: () => { A.state = 'idle in transaction'; A.open = iso === 'RR'; A.hot = true; B.hot = false; flash = null; horizonNote = iso === 'RR' ? 'held by A' : ''; },
      t: () => iso === 'RR' ? 'A goes <b>idle in transaction</b> (say, an app thread waiting on an HTTP call inside @Transactional). Its REPEATABLE READ snapshot is still alive, so the <b>xmin horizon</b> is pinned at 101.' : 'A goes idle in transaction. In READ COMMITTED a read-only transaction drops its snapshot between statements, so it does <b>not</b> pin the horizon here. (A RR transaction, a long statement, or any transaction that has an xid would.)' });
    const doVac = (aDone) => {
      if (vac === 'full') {
        if (!aDone) return { run: () => { B.state = 'VACUUM FULL waiting'; B.info = 'needs ACCESS EXCLUSIVE; A still holds ACCESS SHARE on acct'; B.hot = true; A.hot = false; }, t: () => '<b>VACUUM FULL</b> needs an <b>ACCESS EXCLUSIVE</b> lock. A’s open transaction still holds ACCESS SHARE on the table (from its SELECT), so VACUUM FULL waits, and every new query on acct now queues behind it. See <a href="locking.html">Locking</a>.', blocked: true };
        return { run: () => { vacuumFull(); B.state = 'VACUUM FULL done'; B.info = 'table rewritten'; B.hot = true; flash = 0; }, t: () => '<b>VACUUM FULL</b> copies the live versions into a brand-new file and drops the old one. The space goes back to the OS, the ctid changes to (0,1), and all indexes are rebuilt. The cost: an ACCESS EXCLUSIVE lock for the whole rewrite. On a big table use pg_repack or pg_squeeze instead.' };
      }
      return { run: () => { const n = vacuum(); B.state = 'VACUUM acct'; B.info = n ? `removed ${n} dead tuples` : 'removed 0'; B.hot = true; A.hot = false; B.n = n; flash = null; },
        t: () => !B.n && !V.some((v) => v.state === 'live' && v.xmax && committed(v.xmax)) ? '<b>VACUUM</b>: nothing left to remove; the first run already cleaned up.' : B.n ? `<b>VACUUM</b>: horizon is ${horizon()}. Versions whose xmax committed before the horizon are dead to everyone, so they are removed. ` + (hot === 'hot' ? 'The HOT chain is pruned: (0,1) becomes a <b>redirect</b> line pointer so the index entry still works.' : 'Their index entries are deleted too (struck through).') + ' The space is <b>reusable inside the file</b>, but the file does not shrink.' : `<b>VACUUM</b> finds 2 dead-looking versions but can remove <b>neither</b>: their xmax (101, 102) is not older than the horizon (101) that A’s snapshot pins. “${V.length - 1} dead row versions cannot be removed yet” in VACUUM VERBOSE is exactly this.` };
    };
    st.push(doVac(aEnd === 'commit'));
    if (aEnd === 'idle') {
      st.push({ run: () => { A.state = 'COMMIT (finally)'; A.info = 'snapshot released'; A.snap = null; A.open = false; horizonNote = ''; A.hot = true; B.hot = false; }, t: () => 'A finally commits (or <code>idle_in_transaction_session_timeout</code> kills it). The horizon jumps forward to the next xid.' });
      const again = doVac(true); st.push({ run: again.run, t: () => (vac === 'full' ? '' : 'The next (auto)vacuum run: ') + again.t() });
    }
    return st;
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; flash = null; horizonNote = ''; fileNote = 'file: <b>1 page</b>';
    tx = {}; V = [{ ctid: '(0,1)', xmin: 100, xmax: 0, bal: 100, state: 'live', note: '' }];
    ix = [{ name: 'pkey', key: 'id=1', to: '(0,1)' }].concat(hot === 'hot' ? [] : [{ name: 'idx_bal', key: '100', to: '(0,1)' }]);
    A = { state: 'not started', info: '', snap: null, open: true }; B = { state: 'idle', info: '' };
    steps = plan(); render(); bStep.disabled = false;
    say('One row <code>id=1, bal=100</code>, inserted by xid 100. Pick the options, then press Play. Columns on the right show which version each snapshot sees.');
  }
  function step() {
    if (k >= steps.length) return false; const s = steps[k++]; s.run(); render(); say(s.t());
    if (k >= steps.length) bStep.disabled = true; return true;
  }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 700 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

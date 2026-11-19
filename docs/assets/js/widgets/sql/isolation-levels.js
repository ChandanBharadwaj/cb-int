/* Isolation levels: T1 / T2 lanes, time flows down. Pick anomaly + level; see whether it happens, who waits, who gets 40001. */
IA.widget('isolation-levels', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-iso-css')) document.head.append(el('style', { id: 'w-iso-css', text: `
.w-iso-grid { display: grid; grid-template-columns: 1fr 34px 1fr; gap: 6px 0; align-items: stretch; }
.w-iso-h { font-weight: 700; font-size: 13px; padding: 6px 8px; border-radius: 8px; background: var(--surface-2); border: 1px solid var(--border); }
.w-iso-h code { font-size: 11.5px; }
.w-iso-t { position: relative; display: flex; justify-content: center; }
.w-iso-t::before { content: ''; position: absolute; top: 0; bottom: 0; width: 2px; background: var(--border); }
.w-iso-t span { position: relative; z-index: 1; background: var(--surface); color: var(--text-3); font-size: 11px; padding: 2px 0; margin-top: 8px; height: fit-content; }
.w-iso-c { min-height: 46px; border-radius: 8px; padding: 6px 8px; font-size: 12.5px; border: 1.5px solid transparent; }
.w-iso-c.on { border-color: var(--border); background: var(--surface); animation: ${reduced ? 'none' : 'capin .35s ease both'}; }
.w-iso-c.cur { border-color: var(--accent); background: var(--accent-soft); }
.w-iso-c pre { margin: 0; white-space: pre-wrap; word-break: break-word; font: 11.5px/1.4 ui-monospace, Menlo, Consolas, monospace; color: var(--text); }
.w-iso-r { margin-top: 4px; font-weight: 700; font-size: 12.5px; color: var(--text-2); }
.w-iso-r.ok { color: var(--ok); } .w-iso-r.bad { color: var(--err); } .w-iso-r.wait { color: var(--warn); }
.w-iso-c.err { border-color: var(--err); }
.w-iso-v { margin-top: 10px; padding: 10px 12px; border-radius: 10px; border: 2px solid var(--border); font-size: 14.5px; }
.w-iso-v.bad { border-color: var(--err); } .w-iso-v.good { border-color: var(--ok); } .w-iso-v.err { border-color: var(--warn); }
.w-iso-db { font: 12px ui-monospace, Menlo, Consolas, monospace; color: var(--text-2); margin-top: 8px; }` }));
  const LV = { RC: 'READ COMMITTED', RR: 'REPEATABLE READ', SER: 'SERIALIZABLE' };
  const E40 = 'ERROR 40001: could not serialize access';
  // each scenario: (L) => { steps: [{ t: 1|2, sql, r, c, why, db }], v: [cls, text] }
  const S = {
    dirty: { name: 'Dirty read', f: (L) => ({ steps: [
      { t: 1, sql: 'UPDATE accounts SET balance = 50\nWHERE id = 1;', r: 'UPDATE 1 (not committed)', c: '', why: 'T1 changes Asha’s balance from 100 to 50 but does not commit. It wrote a new row version that only T1 can see.', db: 'committed: balance = 100 · T1’s private version: 50' },
      { t: 2, sql: 'SELECT balance FROM accounts\nWHERE id = 1;', r: '→ 100', c: 'ok', why: `T2 reads the last <b>committed</b> version: 100. In Postgres no level ever shows uncommitted data, and the reader does not wait for T1 either (MVCC).`, db: 'committed: balance = 100' },
      { t: 1, sql: 'ROLLBACK;', r: 'rolled back', c: '', why: 'T1 rolls back. Had T2 seen 50, it would have acted on a value that never existed.', db: 'committed: balance = 100' },
      { t: 2, sql: 'COMMIT;', r: 'COMMIT', c: 'ok', why: '', db: 'committed: balance = 100' }],
      v: ['good', `No dirty read at ${LV[L]}. Postgres has no dirty reads at any level; even READ UNCOMMITTED behaves as READ COMMITTED.`] }) },
    nrr: { name: 'Non-repeatable read', f: (L) => ({ steps: [
      { t: 1, sql: 'SELECT balance FROM accounts\nWHERE id = 1;', r: '→ 100', c: '', why: L === 'RC' ? 'T1 reads 100. At READ COMMITTED this statement used its own snapshot.' : 'T1 reads 100. Its <b>transaction snapshot</b> is taken now, at the first query.', db: 'committed: balance = 100' },
      { t: 2, sql: 'UPDATE accounts SET balance = 50\nWHERE id = 1;', r: 'UPDATE 1', c: '', why: 'T2 updates the same row. Readers never block writers.', db: 'committed: balance = 100' },
      { t: 2, sql: 'COMMIT;', r: 'COMMIT', c: '', why: 'T2 commits. Balance 50 is now the latest committed version.', db: 'committed: balance = 50' },
      { t: 1, sql: 'SELECT balance FROM accounts\nWHERE id = 1;', r: L === 'RC' ? '→ 50  (changed!)' : '→ 100', c: L === 'RC' ? 'bad' : 'ok', why: L === 'RC' ? 'A new statement means a new snapshot, which includes T2’s commit. Same query, same transaction, different answer.' : 'T1 still reads from its original snapshot, which does not include T2. The value is stable for the whole transaction.', db: 'committed: balance = 50' },
      { t: 1, sql: 'COMMIT;', r: 'COMMIT', c: '', why: '', db: 'committed: balance = 50' }],
      v: L === 'RC' ? ['bad', 'Non-repeatable read: T1 saw 100, then 50. Fine for most OLTP code, wrong for a report that must add up.'] : ['good', `No anomaly: ${LV[L]} reads every query from one snapshot.`] }) },
    phantom: { name: 'Phantom', f: (L) => ({ steps: [
      { t: 1, sql: 'SELECT count(*) FROM doctors\nWHERE on_call;', r: '→ 2', c: '', why: 'T1 counts on-call doctors: Alice and Bob.', db: 'committed: alice ✓, bob ✓' },
      { t: 2, sql: "INSERT INTO doctors\nVALUES ('carol', true);", r: 'INSERT 1', c: '', why: 'T2 adds a new row that matches T1’s WHERE clause.', db: 'committed: alice ✓, bob ✓' },
      { t: 2, sql: 'COMMIT;', r: 'COMMIT', c: '', why: 'Carol is committed.', db: 'committed: alice ✓, bob ✓, carol ✓' },
      { t: 1, sql: 'SELECT count(*) FROM doctors\nWHERE on_call;', r: L === 'RC' ? '→ 3  (phantom row!)' : '→ 2', c: L === 'RC' ? 'bad' : 'ok', why: L === 'RC' ? 'The new statement sees Carol: a phantom row appeared.' : `T1’s snapshot predates Carol. The SQL standard <i>allows</i> phantoms at REPEATABLE READ; Postgres prevents them because RR is snapshot isolation.`, db: 'committed: alice ✓, bob ✓, carol ✓' },
      { t: 1, sql: 'COMMIT;', r: 'COMMIT', c: '', why: '', db: 'committed: alice ✓, bob ✓, carol ✓' }],
      v: L === 'RC' ? ['bad', 'Phantom: the same predicate returned a new row inside one transaction.'] : ['good', `No phantom at ${LV[L]} in Postgres (stricter than the SQL standard requires for RR).`] }) },
    lost: { name: 'Lost update', f: (L) => { const rc = L === 'RC'; return { steps: [
      { t: 1, sql: 'SELECT stock FROM items\nWHERE id = 1;', r: '→ 10', c: '', why: 'Two customers buy the last keyboards. The app reads the stock, subtracts 1 in Java, and writes the result back.', db: 'committed: stock = 10' },
      { t: 2, sql: 'SELECT stock FROM items\nWHERE id = 1;', r: '→ 10', c: '', why: 'T2 reads the same 10.', db: 'committed: stock = 10' },
      { t: 1, sql: 'UPDATE items SET stock = 9\nWHERE id = 1;', r: 'UPDATE 1 (row locked)', c: '', why: 'T1 writes 9 and now holds the row lock.', db: 'committed: stock = 10 · T1 wrote 9' },
      { t: 2, sql: 'UPDATE items SET stock = 9\nWHERE id = 1;', r: '⏳ waiting for T1’s row lock', c: 'wait', why: 'T2 wants the same row and must <b>wait</b>, at every level, until T1 commits or rolls back.', db: 'committed: stock = 10 · T1 wrote 9' },
      { t: 1, sql: 'COMMIT;', r: 'COMMIT', c: '', why: 'T1 commits: stock is 9. T2 wakes up.', db: 'committed: stock = 9' },
      { t: 2, sql: '(UPDATE resumes)', r: rc ? 'UPDATE 1  → overwrote 9 with 9' : E40, c: rc ? 'bad' : 'err', why: rc ? 'READ COMMITTED re-checks the WHERE on the newest row version (it still matches id = 1) and applies T2’s value: 9. T1’s decrement is lost.' : `The row changed after T2’s snapshot was taken. ${LV[L]} refuses to overwrite it: <code>could not serialize access due to concurrent update</code>.`, db: 'committed: stock = 9' },
      { t: 2, sql: rc ? 'COMMIT;' : 'ROLLBACK;  -- then retry', r: rc ? 'COMMIT' : 'retry reads 9, writes 8 ✓', c: rc ? 'bad' : 'ok', why: rc ? 'Two keyboards sold, stock decreased by one.' : 'The aborted transaction is retried from the start: it reads 9 and writes 8. Correct.', db: rc ? 'committed: stock = 9 (should be 8)' : 'committed: stock = 8' }],
      v: rc ? ['bad', 'Lost update. At READ COMMITTED, fix it with <code>SET stock = stock - 1</code>, <code>SELECT … FOR UPDATE</code>, or <code>@Version</code>.'] : ['err', `T2 got <b>40001</b> and was retried: no lost update at ${LV[L]}, but only because the application retries.`] }; } },
    skew: { name: 'Write skew (on-call doctors)', f: (L) => { const ser = L === 'SER'; return { steps: [
      { t: 1, sql: 'SELECT count(*) FROM doctors\nWHERE on_call;', r: '→ 2  (ok, I may leave)', c: '', why: 'Rule: at least one doctor on call. Alice (T1) checks: 2 on call, so she may go off call.', db: 'committed: alice ✓, bob ✓' },
      { t: 2, sql: 'SELECT count(*) FROM doctors\nWHERE on_call;', r: '→ 2  (ok, I may leave)', c: '', why: 'At the same moment Bob (T2) runs the same check, and also sees 2.', db: 'committed: alice ✓, bob ✓' },
      { t: 1, sql: "UPDATE doctors SET on_call = false\nWHERE name = 'alice';", r: 'UPDATE 1', c: '', why: 'Alice takes herself off call. She locks <i>her</i> row.', db: 'committed: alice ✓, bob ✓' },
      { t: 2, sql: "UPDATE doctors SET on_call = false\nWHERE name = 'bob';", r: 'UPDATE 1', c: '', why: 'Bob updates <i>his</i> row: a different row, so no lock conflict and no waiting at any level.' + (ser ? ' SSI notes the dependencies: each one wrote what the other one read.' : ''), db: 'committed: alice ✓, bob ✓' },
      { t: 1, sql: 'COMMIT;', r: 'COMMIT', c: '', why: 'Alice’s transaction commits first.', db: 'committed: alice ✗, bob ✓' },
      { t: 2, sql: 'COMMIT;', r: ser ? E40 : 'COMMIT', c: ser ? 'err' : 'bad', why: ser ? 'SSI found a dangerous structure (read/write dependencies in both directions with a committed partner). Bob’s commit fails: <code>could not serialize access due to read/write dependencies among transactions</code>.' : `Both commit. ${L === 'RR' ? 'Snapshot isolation only detects write-write conflicts on the <i>same</i> row, so REPEATABLE READ does not help.' : ''}`, db: ser ? 'committed: alice ✗, bob ✓' : 'committed: alice ✗, bob ✗  (nobody on call!)' },
      ...(ser ? [{ t: 2, sql: '-- retry the whole transaction\nSELECT count(*) …', r: '→ 1: refuse leave ✓', c: 'ok', why: 'On retry, Bob sees only one doctor on call, and the business rule rejects his request.', db: 'committed: alice ✗, bob ✓' }] : [])],
      v: ser ? ['err', 'SERIALIZABLE aborted T2 with <b>40001</b>; the retry saw the truth. Only SERIALIZABLE (or an explicit lock on a shared row) prevents write skew.'] : ['bad', `Write skew at ${LV[L]}: each transaction was correct alone; together they broke the rule.`] }; } }
  };
  let an = 'skew'; let lv = 'RR'; let speed = 2400; let gen = 0; let running = false; let k = 0; let cur = null;
  const mkSeg = (items, c0, on) => { const s = el('div', { class: 'seg' }); items.forEach(([v, l]) => { const b = el('button', { text: l, class: v === c0 ? 'on' : '', 'data-v': v }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segA = mkSeg(Object.entries(S).map(([k2, v]) => [k2, v.name]), an, (v) => { an = v; reset(); });
  const segL = mkSeg(Object.entries(LV), lv, (v) => { lv = v; reset(); });
  const segS = mkSeg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const grid = el('div', { class: 'w-iso-grid' }); const db = el('div', { class: 'w-iso-db' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }, el('div', { class: 't' })); const verdict = el('div');
  root.append(el('div', { class: 'w-controls' }, segA), el('div', { class: 'w-controls' }, el('span', { class: 'tiny', text: 'both transactions at' }), segL), el('div', { class: 'w-stage' }, grid, db),
    el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr, verdict);
  let cells = [];
  function draw() {
    cur = S[an].f(lv); grid.innerHTML = ''; cells = [];
    const hb = `BEGIN ISOLATION LEVEL ${LV[lv]};`;
    grid.append(el('div', { class: 'w-iso-h', html: `T1 <code>${hb}</code>` }), el('div'), el('div', { class: 'w-iso-h', html: `T2 <code>${hb}</code>` }));
    cur.steps.forEach((s, i) => {
      const mk = (t) => { const c = el('div', { class: 'w-iso-c' }); if (t === s.t) c.append(el('pre', { text: s.sql }), el('div', { class: 'w-iso-r ' + s.c, text: s.r })); return c; };
      const a = mk(1), b = mk(2); grid.append(a, el('div', { class: 'w-iso-t' }, el('span', { text: 't' + (i + 1) })), b); cells.push(s.t === 1 ? a : b);
      cells[i].style.visibility = 'hidden';
    });
    db.textContent = cur.steps[0].db.split(' · ')[0].startsWith('committed') ? 'committed: ' + (an === 'lost' ? 'stock = 10' : an === 'dirty' || an === 'nrr' ? 'balance = 100' : 'alice ✓, bob ✓') : '';
  }
  function step() {
    if (k >= cur.steps.length) return false;
    const s = cur.steps[k]; cells.forEach((c) => c.classList.remove('cur'));
    const c = cells[k]; c.style.visibility = 'visible'; c.classList.add('on', 'cur'); if (s.c === 'err') c.classList.add('err');
    narr.firstChild.innerHTML = s.why || (s.t === 1 ? 'T1 finishes.' : 'T2 finishes.'); db.textContent = s.db; k++;
    if (k >= cur.steps.length) { bStep.disabled = true; cells.forEach((x) => x.classList.remove('cur')); verdict.innerHTML = ''; verdict.append(el('div', { class: 'w-iso-v ' + cur.v[0], html: cur.v[1] })); }
    return true;
  }
  function reset() { gen++; running = false; k = 0; bPlay.textContent = '▶ Play'; bStep.disabled = false; verdict.innerHTML = ''; draw(); narr.firstChild.innerHTML = `${S[an].name} at ${LV[lv]}. Press Play or Step.`; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= cur.steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 600 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  // let the matrix widget drive this one
  IA.isoJump = (a, l) => { an = a; lv = l; [...segA.children].forEach((b) => b.classList.toggle('on', b.dataset.v === a)); [...segL.children].forEach((b) => b.classList.toggle('on', b.dataset.v === l)); reset(); root.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); };
  reset();
});

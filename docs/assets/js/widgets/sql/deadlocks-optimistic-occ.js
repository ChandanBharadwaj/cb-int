/* Two users edit the same product: no locking (lost update) vs optimistic (@Version) vs pessimistic (FOR UPDATE). */
IA.widget('deadlocks-optimistic-occ', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  let mode = 'opt'; let gen = 0; let running = false; let speed = 2400; let k = 0; let steps = [];
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg([['none', 'no locking'], ['opt', 'optimistic (@Version)'], ['pess', 'pessimistic (FOR UPDATE)']], () => mode, (v) => { mode = v; reset(); }, 'Strategy');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' }); const bStep = el('button', { class: 'btn', text: 'Step ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], () => speed, (v) => { speed = v; }, 'Speed');
  const row = el('div'); const log = el('div', { class: 'tscroll' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.append(el('div', { class: 'w-controls' }, segM), row, log, el('div', { class: 'w-controls', style: { marginTop: '8px' } }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), narr);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  let P; let L;
  function draw(flash) {
    row.innerHTML = '';
    row.append(el('div', { class: 'w-stats', style: { marginBottom: '8px' } },
      el('span', { class: 'w-stat', html: `product 7 · stock <b>${P.stock}</b>` }), mode === 'opt' ? el('span', { class: 'w-stat', html: `version <b>${P.v}</b>` }) : null,
      el('span', { class: 'w-stat', html: `row lock <b>${P.lock || 'none'}</b>` }), el('span', { class: 'w-stat', html: `expected stock <b>${P.expect}</b>` })));
    const tb = el('tbody'); L.forEach(([a, b], i) => tb.append(el('tr', { style: i === L.length - 1 && flash ? { background: 'var(--accent-soft)' } : null }, el('td', { html: a }), el('td', { html: b }))));
    log.innerHTML = ''; log.append(el('table', { class: 't rg', style: { minWidth: '520px', fontFamily: 'var(--mono)', fontSize: '12px' } }, el('thead', null, el('tr', null, el('th', { text: 'Alice: sells 3' }), el('th', { text: 'Bob: sells 2' }))), tb));
  }
  function plan() {
    const s = [];
    if (mode === 'pess') {
      s.push({ run: () => { P.lock = 'Alice'; L.push(['BEGIN; SELECT stock FROM product WHERE id = 7 FOR UPDATE; → 10', '']); }, t: 'Alice reads the product with <code>FOR UPDATE</code> (JPA <code>@Lock(PESSIMISTIC_WRITE)</code>). The row is now locked.' });
      s.push({ run: () => { L.push(['', 'BEGIN; SELECT … FOR UPDATE; <span style="color:var(--warn)">⏳ waits</span>']); }, t: 'Bob does the same and <b>waits</b>. Correct, but his request thread and DB connection are stuck for as long as Alice’s transaction lasts.' });
      s.push({ run: () => { P.stock = 7; P.lock = null; L.push(['UPDATE product SET stock = 7 …; COMMIT;', '']); }, t: 'Alice writes 10 − 3 = 7 and commits. The lock is released.' });
      s.push({ run: () => { P.lock = 'Bob'; L.push(['', '… → 7 (fresh value)']); }, t: 'Bob’s SELECT returns the <b>committed</b> value 7 (in READ COMMITTED the locked row is re-read after the wait).' });
      s.push({ run: () => { P.stock = 5; P.lock = null; L.push(['', 'UPDATE product SET stock = 5 …; COMMIT;']); }, t: 'Stock 5 = correct. Pessimistic fits short transactions with <b>high contention</b> (hot rows, counters, money). Never hold it across user think time.' });
      return s;
    }
    s.push({ run: () => { L.push([`SELECT stock${mode === 'opt' ? ', version' : ''} … → 10${mode === 'opt' ? ', v7' : ''}`, '']); }, t: 'Alice loads product 7: stock 10' + (mode === 'opt' ? ', version 7. No lock is taken.' : '.') });
    s.push({ run: () => { L.push(['', `SELECT stock${mode === 'opt' ? ', version' : ''} … → 10${mode === 'opt' ? ', v7' : ''}`]); }, t: 'Bob loads it too and sees the same values. Neither waits.' });
    s.push({ run: () => { P.stock = 7; if (mode === 'opt') P.v = 8; L.push([mode === 'opt' ? 'UPDATE product SET stock = 7, version = 8<br>WHERE id = 7 AND version = 7; → UPDATE 1' : 'UPDATE product SET stock = 7 WHERE id = 7;', '']); }, t: mode === 'opt' ? 'Alice saves. Hibernate adds <code>AND version = 7</code> and bumps the version. 1 row updated: success.' : 'Alice saves 10 − 3 = 7, computed in Java.' });
    if (mode === 'none') {
      s.push({ run: () => { P.stock = 8; L.push(['', 'UPDATE product SET stock = 8 WHERE id = 7;']); }, t: 'Bob saves 10 − 2 = 8, computed from his <b>stale</b> read. Alice’s sale is overwritten: the classic <b>lost update</b>. Stock says 8, but the truth is 5. No error anywhere.' });
      s.push({ run: () => {}, t: 'Fixes: do the math in SQL (<code>SET stock = stock - 2</code>, atomic for a single row), or use optimistic or pessimistic locking. See the other two modes.' });
      return s;
    }
    s.push({ run: () => { L.push(['', 'UPDATE … SET stock = 8, version = 8<br>WHERE id = 7 AND version = 7; → <span style="color:var(--err)">UPDATE 0</span>']); }, t: 'Bob saves with <code>AND version = 7</code>, but the version is now 8, so <b>0 rows</b> are updated. Hibernate turns that into <code>OptimisticLockException</code> (Spring: <code>ObjectOptimisticLockingFailureException</code>).' });
    s.push({ run: () => { L.push(['', 'retry: reload → 7, v8']); }, t: 'Bob’s service catches it and <b>retries the whole unit of work</b>: reload, re-apply the change, save. (For a human edit, show “someone changed this, please review” instead.)' });
    s.push({ run: () => { P.stock = 5; P.v = 9; L.push(['', 'UPDATE … SET stock = 5, version = 9 WHERE … AND version = 8; → UPDATE 1']); }, t: 'Stock 5 = correct, and no transaction ever waited on a lock. Optimistic fits <b>low contention</b> and long think times (forms, REST PUT with an ETag).' });
    return s;
  }
  function reset() { gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; P = { stock: 10, v: 7, lock: null, expect: 5 }; L = []; steps = plan(); bStep.disabled = false; draw(); say('Alice sells 3, Bob sells 2, at the same time. Stock starts at 10, so it should end at 5.'); }
  function step() { if (k >= steps.length) return false; const x = steps[k++]; x.run(); draw(true); say(x.t); if (k >= steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => { if (running) { running = false; bPlay.textContent = '▶ Play'; return; } if (k >= steps.length) reset(); running = true; bPlay.textContent = '⏸ Pause'; const g = gen; while (running && g === gen && step()) await sleep(reduced ? 700 : speed); if (g === gen) { running = false; bPlay.textContent = '▶ Play'; } });
  reset();
});

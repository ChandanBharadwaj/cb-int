/* Lock conflict matrices: table-level (8 modes) and row-level (4 modes). Pick held + requested → conflict? */
IA.widget('locking-matrix', (root, ctx) => {
  const { el } = ctx;
  const TABLE = {
    modes: ['ACCESS SHARE', 'ROW SHARE', 'ROW EXCLUSIVE', 'SHARE UPDATE EXCLUSIVE', 'SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE'],
    short: ['AS', 'RS', 'RE', 'SUE', 'S', 'SRE', 'E', 'AE'],
    conf: [[7], [6, 7], [4, 5, 6, 7], [3, 4, 5, 6, 7], [2, 3, 5, 6, 7], [2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 5, 6, 7]],
    who: ['SELECT', 'SELECT … FOR UPDATE / FOR SHARE', 'INSERT, UPDATE, DELETE, MERGE', 'VACUUM, ANALYZE, CREATE INDEX CONCURRENTLY, ALTER TABLE … VALIDATE CONSTRAINT', 'CREATE INDEX (non-concurrent)', 'CREATE TRIGGER, ALTER TABLE … ADD FOREIGN KEY', 'REFRESH MATERIALIZED VIEW CONCURRENTLY', 'DROP, TRUNCATE, VACUUM FULL, CLUSTER, most ALTER TABLE, LOCK TABLE']
  };
  const ROW = {
    modes: ['FOR KEY SHARE', 'FOR SHARE', 'FOR NO KEY UPDATE', 'FOR UPDATE'],
    short: ['KS', 'S', 'NKU', 'U'],
    conf: [[3], [2, 3], [1, 2, 3], [0, 1, 2, 3]],
    who: ['FK check when inserting/updating a child row (locks the parent row)', 'SELECT … FOR SHARE', 'UPDATE that doesn’t change a key column; SELECT … FOR NO KEY UPDATE', 'DELETE, UPDATE of a key column (one with a unique index), SELECT … FOR UPDATE']
  };
  let kind = 'table'; let held = 0; let req = 7;
  const segK = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Lock level' });
  [['table', 'Table locks'], ['row', 'Row locks']].forEach(([v, l]) => { const b = el('button', { text: l, class: v === kind ? 'on' : '' }); b.addEventListener('click', () => { kind = v; held = 0; req = v === 'table' ? 7 : 2; [...segK.children].forEach((x) => x.classList.toggle('on', x === b)); draw(); }); segK.append(b); });
  const pickH = el('div', { class: 'seg', 'aria-label': 'Held by session 1' }); const pickR = el('div', { class: 'seg', 'aria-label': 'Requested by session 2' });
  const verdict = el('div'); const grid = el('div', { class: 'tscroll', style: { marginTop: '10px' } });
  root.append(el('div', { class: 'w-controls' }, segK), el('div', { class: 'tiny', text: 'Session 1 holds:' }), pickH, el('div', { class: 'tiny', text: 'Session 2 requests:', style: { marginTop: '8px' } }), pickR, verdict, grid);
  function draw() {
    const M = kind === 'table' ? TABLE : ROW;
    const fill = (host, cur, set) => { host.innerHTML = ''; M.short.forEach((s, i) => { const b = el('button', { text: s, title: M.modes[i], class: i === cur ? 'on' : '' }); b.addEventListener('click', () => { set(i); draw(); }); host.append(b); }); };
    fill(pickH, held, (i) => { held = i; }); fill(pickR, req, (i) => { req = i; });
    const c = M.conf[held].includes(req);
    verdict.innerHTML = '';
    verdict.append(el('div', { class: 'caption', style: { borderColor: c ? 'var(--err)' : 'var(--ok)' } }, el('div', { class: 't', html:
      `<b style="color:${c ? 'var(--err)' : 'var(--ok)'}">${c ? '✗ CONFLICT: session 2 waits' : '✓ compatible: both run'}</b><br><b>${M.modes[held]}</b> (${M.who[held]})<br>vs <b>${M.modes[req]}</b> (${M.who[req]})` +
      (kind === 'row' && held === 0 && req === 2 ? '<br>This is why an INSERT into <code>orders</code> (FK check = KEY SHARE on the customer row) doesn’t block an UPDATE of the customer’s name.' : '') +
      (kind === 'table' && held === 0 && req === 7 ? '<br>And while it waits, every later request queues behind it. See the animation above.' : '') })));
    const th = (t) => el('th', { text: t, style: { padding: '6px', fontSize: '11px', textAlign: 'center' } });
    const tbl = el('table', { class: 't', style: { minWidth: kind === 'table' ? '420px' : '300px' } },
      el('thead', null, el('tr', null, th('held ↓ / req →'), M.short.map(th))),
      el('tbody', null, M.short.map((s, i) => el('tr', null, el('td', { text: s, title: M.modes[i], style: { padding: '6px' } }), M.short.map((_, j) => {
        const x = M.conf[i].includes(j); const on = i === held && j === req;
        const td = el('td', { text: x ? '✗' : '·', title: `${M.modes[i]} vs ${M.modes[j]}`, style: { textAlign: 'center', padding: '6px', cursor: 'pointer', color: x ? 'var(--err)' : 'var(--text-3)', background: on ? 'var(--accent-soft)' : '', outline: on ? '2px solid var(--accent)' : '' } });
        td.addEventListener('click', () => { held = i; req = j; draw(); }); return td; })))));
    grid.innerHTML = ''; grid.append(tbl);
  }
  draw();
});

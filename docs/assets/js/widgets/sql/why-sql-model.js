/* Why SQL: the relational model in one picture, plus the four SQL sub-languages. */
IA.widget('why-sql-model', (root, ctx) => {
  const { el, svg } = ctx;
  const W = 720, H = 300;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Two relations, customers and orders, with labels for tuple, attribute, primary key and foreign key' });
  const T = (x, y, t, o) => svg('text', Object.assign({ x, y, 'font-size': 13, fill: 'var(--text)', text: t }, o || {}));
  const table = (x, y, name, cols, rows, keyCol, fkCol) => {
    const cw = 78, rh = 26; const g = svg('g');
    g.append(T(x, y - 10, name, { 'font-weight': 700 }));
    cols.forEach((c, i) => { g.append(svg('rect', { x: x + i * cw, y, width: cw, height: rh, fill: 'var(--surface-2)', stroke: 'var(--border)' }), T(x + i * cw + 6, y + 17, c, { fill: i === keyCol ? 'var(--accent)' : i === fkCol ? 'var(--warn)' : 'var(--text-3)', 'font-size': 12, 'font-weight': i === keyCol || i === fkCol ? 700 : 400 })); });
    rows.forEach((r, j) => r.forEach((v, i) => g.append(svg('rect', { x: x + i * cw, y: y + rh * (j + 1), width: cw, height: rh, fill: j === 1 ? 'var(--accent-soft)' : 'var(--surface)', stroke: 'var(--border)' }), T(x + i * cw + 6, y + rh * (j + 1) + 17, v, { 'font-size': 12, 'font-family': 'var(--mono)' }))));
    return g;
  };
  s.append(table(20, 60, 'customers  (a relation)', ['id', 'name', 'city'], [['1', 'Asha', 'Pune'], ['2', 'Ben', 'Austin'], ['3', 'Chen', 'Pune']], 0, -1));
  s.append(table(400, 60, 'orders', ['id', 'cust_id', 'amount'], [['101', '1', '250'], ['102', '2', '40'], ['103', '1', '80']], 0, 1));
  const lab = (x, y, t, c) => T(x, y, t, { 'font-size': 12, fill: c || 'var(--text-2)' });
  s.append(
    lab(20, 222, '▲ highlighted row = a tuple (one fact)', 'var(--accent)'),
    lab(20, 242, '▲ column = an attribute with a type (domain)'),
    lab(20, 262, 'id = primary key: unique, not null', 'var(--accent)'),
    lab(400, 222, 'cust_id = foreign key → customers.id', 'var(--warn)'),
    lab(400, 242, 'rows have no order; duplicates are'),
    lab(400, 258, 'prevented by keys')
  );
  s.append(svg('path', { d: 'M 478 100 C 420 30, 120 20, 60 58', fill: 'none', stroke: 'var(--warn)', 'stroke-width': 2, 'stroke-dasharray': '5 4', 'marker-end': 'url(#wsqm-a)' }));
  s.prepend(svg('defs', null, svg('marker', { id: 'wsqm-a', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: 'var(--warn)' }))));
  s.append(lab(20, 292, 'Every query = operations on relations that return a relation (filter, project, join, group).', 'var(--text-3)'));
  const fam = [
    ['DDL', 'Data Definition', 'CREATE, ALTER, DROP, TRUNCATE', 'shape: tables, indexes, constraints'],
    ['DML', 'Data Manipulation', 'SELECT, INSERT, UPDATE, DELETE, MERGE', 'the rows themselves'],
    ['DCL', 'Data Control', 'GRANT, REVOKE', 'who may do what'],
    ['TCL', 'Transaction Control', 'BEGIN, COMMIT, ROLLBACK, SAVEPOINT', 'grouping changes atomically']
  ];
  const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '8px', marginTop: '12px' } },
    fam.map(([k, n, c, d]) => el('div', { class: 'card', style: { padding: '8px 10px' } }, el('div', { class: 'kicker', text: k + ' · ' + n }), el('div', { style: { fontFamily: 'var(--mono)', fontSize: '12px', margin: '4px 0' }, text: c }), el('div', { class: 'tiny', text: d }))));
  root.append(el('div', { class: 'w-stage' }, s), grid, el('div', { class: 'tiny', html: 'In Postgres, DDL is transactional too: <code>BEGIN; ALTER TABLE …; ROLLBACK;</code> undoes the change.', style: { marginTop: '6px' } }));
});

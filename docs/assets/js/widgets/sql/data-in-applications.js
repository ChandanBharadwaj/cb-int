/* Data in applications: one Order travels Java object -> JSON -> entity -> INSERT -> Postgres row(s). */
IA.widget('data-in-applications', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-dia-css')) document.head.append(el('style', { id: 'w-dia-css', text: `
.w-dia-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:10px 0}
.w-dia-p{border:1px solid var(--border);border-radius:10px;background:var(--surface);padding:8px 10px;min-width:0;opacity:.35;transition:opacity .4s}
.w-dia-p.on{opacity:1;border-color:var(--accent)}
.w-dia-p h5{margin:0 0 6px;font-size:12px;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em}
.w-dia-p pre{margin:0;font-family:var(--mono);font-size:12px;line-height:1.55;white-space:pre-wrap;word-break:break-word;color:var(--text)}
.w-dia-l{display:block;border-radius:4px;padding:0 3px;transition:background .3s}
.w-dia-l.hl{background:var(--accent-soft);color:var(--accent)}
.w-dia-l.hid{visibility:hidden}
.w-dia-wire{height:6px;border-radius:3px;background:var(--surface-2);position:relative;overflow:hidden;margin:4px 0 8px}
.w-dia-wire i{position:absolute;top:0;left:-20%;width:20%;height:100%;background:var(--accent);border-radius:3px}
.w-dia-wire.go i{animation:w-dia-mv 1.2s linear infinite}
@keyframes w-dia-mv{to{left:100%}}` }));

  let mode = 'cols'; let gen = 0; let k = 0; let running = false; let speed = 2400; let steps = [];
  const JAVA = [
    '@Entity @Table(name = "orders")',
    'class Order {',
    '  @Id Long id;            // 42',
    '  String customer;        // "Asha"',
    '  BigDecimal total;       // 19.99',
    '  @Enumerated(STRING) Status status; // PAID',
    '  Instant createdAt;      // 2026-03-01T09:30Z',
    '  @OneToMany List<Item> items; // 2 items',
    '}'
  ];
  const JSON_ = [
    '{',
    '  "id": 42,',
    '  "customer": "Asha",',
    '  "total": 19.99,',
    '  "status": "PAID",',
    '  "createdAt": "2026-03-01T09:30:00Z",',
    '  "items": [{"sku":"TEA","qty":2}, {"sku":"MUG","qty":1}]',
    '}'
  ];
  const SQLC = [
    'INSERT INTO orders',
    '  (id, customer, total, status, created_at)',
    "VALUES (42, 'Asha', 19.99, 'PAID',",
    "        '2026-03-01 09:30:00+00');",
    'INSERT INTO order_items (order_id, sku, qty)',
    "VALUES (42,'TEA',2), (42,'MUG',1);"
  ];
  const SQLJ = [
    'INSERT INTO orders (id, doc)',
    "VALUES (42, '{\"customer\":\"Asha\",",
    "  \"total\":19.99, \"status\":\"PAID\",",
    "  \"createdAt\":\"2026-03-01T09:30:00Z\",",
    "  \"items\":[...] }'::jsonb);"
  ];
  const DBC = [
    'orders',
    ' id │ customer │ total │ status │ created_at',
    ' 42 │ Asha     │ 19.99 │ PAID   │ 2026-03-01 09:30+00',
    '',
    'order_items',
    ' order_id │ sku │ qty',
    ' 42       │ TEA │ 2',
    ' 42       │ MUG │ 1'
  ];
  const DBJ = [
    'orders',
    ' id │ doc (jsonb)',
    ' 42 │ {"items": [...], "total": 19.99,',
    '    │  "status": "PAID", "customer": "Asha",',
    '    │  "createdAt": "2026-03-01T09:30:00Z"}'
  ];
  const panel = (title) => { const pre = el('pre'); const p = el('div', { class: 'w-dia-p' }, el('h5', { text: title }), pre); return { p, pre, lines: [] }; };
  const P = { java: panel('① Java object (in memory)'), json: panel('② JSON on the wire (HTTP body)'), sql: panel('③ SQL sent by Hibernate'), db: panel('④ Rows on disk in Postgres') };
  const wire = el('div', { class: 'w-dia-wire' }, el('i'));
  function fill(pn, arr) { pn.pre.innerHTML = ''; pn.lines = arr.map((t) => { const s = el('span', { class: 'w-dia-l hid', text: t || ' ' }); pn.pre.append(s); return s; }); }

  const seg = (opts, cur, on) => { const s = el('div', { class: 'seg' }); opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === cur ? 'on' : '' }); b.addEventListener('click', () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); on(v); }); s.append(b); }); return s; };
  const segM = seg([['cols', 'store as columns + child table'], ['jsonb', 'store as one JSONB column']], mode, (v) => { mode = v; reset(); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const segS = seg([[3600, 'Slow'], [2400, 'Normal'], [1100, 'Fast']], speed, (v) => { speed = v; });
  const num = el('span', { class: 'n', text: '0' });
  const cap = el('div', { class: 'caption', 'aria-live': 'polite' }, num, el('div', { class: 't' }));
  const say = (h) => { const t = el('div', { class: 't', html: h }); cap.replaceChild(t, cap.lastChild); };
  root.append(el('div', { class: 'w-controls' }, segM),
    el('div', { class: 'w-dia-grid' }, P.java.p, el('div', null, P.json.p, wire), P.sql.p, P.db.p),
    el('div', { class: 'w-controls' }, bPlay, bStep, bReset, el('span', { class: 'tiny', text: 'speed' }), segS), cap);

  function plan() {
    const C = mode === 'cols';
    const s = [
      { on: ['java'], show: { java: [0, 1, 2, 3, 4, 5, 6, 7, 8] }, hl: { java: [2, 3, 4, 5, 6, 7] }, cap: 'Your code holds an <b>Order object</b>: typed fields in JVM memory. <code>BigDecimal</code> for money, <code>Instant</code> for a moment in time, a <code>List</code> of items.' },
      { on: ['java', 'json'], wire: true, show: { json: [0, 1, 2, 3, 4, 5, 6, 7] }, hl: { json: [1, 2, 3, 4, 5, 6] }, cap: 'To send it over HTTP, <b>Jackson</b> serializes it to <b>JSON text</b>. Types are lost: <code>19.99</code> is just a number, and the time is just a string.' },
      { on: ['json'], hl: { json: [3, 5] }, cap: 'The receiving service parses the JSON back into an object. If it reads <code>total</code> as a <code>double</code>, money can get rounding errors. Use <code>BigDecimal</code> end to end.' },
      { on: ['java', 'sql'], show: { sql: (C ? SQLC : SQLJ).map((_, i) => i) }, hl: { sql: C ? [0, 1, 2, 3] : [0, 1, 2, 3, 4] }, cap: C ? 'On <code>save()</code>, <b>Hibernate</b> (the ORM) maps each field to a column: <code>createdAt</code> → <code>created_at</code>, <code>Instant</code> → <code>timestamptz</code>, enum → text.' : 'In JSONB mode the ORM writes the whole object into <b>one column</b> (e.g. via <code>@JdbcTypeCode(SqlTypes.JSON)</code> in Hibernate 6). One INSERT, no child table.' },
      C ? { on: ['sql'], hl: { sql: [4, 5] }, cap: 'The <code>List&lt;Item&gt;</code> can’t fit in one cell, so it becomes a <b>second table</b>. Each item row points back with <code>order_id</code>, a foreign key.' }
        : { on: ['sql'], hl: { sql: [4] }, cap: 'The items array stays nested inside the document. Easy to write, but Postgres can’t enforce a foreign key on a value inside JSON.' },
      { on: ['db'], show: { db: (C ? DBC : DBJ).map((_, i) => i) }, hl: { db: C ? [2, 6, 7] : [2, 3, 4] }, cap: C ? 'Stored as <b>rows</b> in two tables: 1 order + 2 items. Each column has a type, so Postgres rejects <code>total = \'abc\'</code> and can index <code>status</code>.' : 'Stored as <b>one row</b> with a binary JSON value. JSONB reorders keys and drops duplicate keys. Querying needs operators like <code>doc-&gt;&gt;\'status\'</code>.' },
      { on: ['java', 'json', 'sql', 'db'], hl: C ? { java: [4], json: [3], sql: [2], db: [2] } : { java: [4], json: [3], sql: [2], db: [2] }, cap: 'Same value, four forms: <code>BigDecimal 19.99</code> → JSON <code>19.99</code> → SQL literal → <code>numeric</code> on disk. Every hop is a place where types can be lost.' }
    ];
    return s;
  }
  function apply(s) {
    Object.entries(P).forEach(([key, pn]) => { pn.p.classList.toggle('on', s.on.includes(key)); pn.lines.forEach((l) => l.classList.remove('hl')); });
    Object.entries(s.show || {}).forEach(([key, idx]) => idx.forEach((i) => P[key].lines[i] && P[key].lines[i].classList.remove('hid')));
    Object.entries(s.hl || {}).forEach(([key, idx]) => idx.forEach((i) => P[key].lines[i] && P[key].lines[i].classList.add('hl')));
    wire.classList.toggle('go', !!s.wire && !reduced);
  }
  function reset() {
    gen++; running = false; bPlay.textContent = '▶ Play'; k = 0; steps = plan();
    fill(P.java, JAVA); fill(P.json, JSON_); fill(P.sql, mode === 'cols' ? SQLC : SQLJ); fill(P.db, mode === 'cols' ? DBC : DBJ);
    Object.values(P).forEach((pn) => pn.p.classList.remove('on')); wire.classList.remove('go');
    num.textContent = '0/' + steps.length; say('Press Play to follow one order from Java code to a Postgres row. Switch the storage mode to compare.'); bStep.disabled = false;
  }
  function step() { if (k >= steps.length) return false; const s = steps[k++]; apply(s); num.textContent = k + '/' + steps.length; say(s.cap); if (k >= steps.length) bStep.disabled = true; return true; }
  bStep.addEventListener('click', () => { running = false; bPlay.textContent = '▶ Play'; step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { running = false; bPlay.textContent = '▶ Play'; return; }
    if (k >= steps.length) reset();
    running = true; bPlay.textContent = '⏸ Pause'; const g = gen;
    while (running && g === gen && step()) await sleep(reduced ? 600 : speed);
    if (g === gen) { running = false; bPlay.textContent = '▶ Play'; }
  });
  reset();
});

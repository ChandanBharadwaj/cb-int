/* Types of data: comparison matrix. Click a column to highlight it. */
IA.widget('types-of-data-matrix', (root, ctx) => {
  const { el } = ctx;
  const H = ['', 'Structured', 'Semi-structured', 'Unstructured'];
  const R = [
    ['Examples', 'orders, payments, users, CSV exports', 'JSON API payloads, event logs, config, XML', 'PDFs, images, emails, chat text, audio'],
    ['Schema', '<b>on write</b>: declared up front, enforced on INSERT', '<b>on read</b>: keys travel with the data; you interpret when querying', 'none: meaning is extracted later (search, OCR, ML)'],
    ['Typical store', 'relational DB (Postgres, MySQL), warehouse', 'document DB, Postgres <code>jsonb</code>, data lake (Parquet/JSON)', 'object storage (S3/GCS), search engine'],
    ['Query style', 'SQL: joins, filters, aggregates', 'JSON paths: <code>doc-&gt;&gt;\'k\'</code>, <code>@&gt;</code>, <code>jsonb_path_query</code>', 'full-text search, vector similarity, metadata lookup'],
    ['In Postgres', 'columns + constraints + B-tree indexes', '<code>jsonb</code> + GIN index, or expression indexes', '<code>text</code> + <code>tsvector</code>; <code>bytea</code> for small files; otherwise a row with an S3 key'],
    ['Trade-off', 'safe and fast, but schema changes need migrations', 'flexible, but typos and type drift slip in', 'cheap to store, hard to query']
  ];
  let col = 0;
  const cells = [];
  const head = el('tr', null, H.map((h, i) => { const th = el('th', { text: h, style: { cursor: i ? 'pointer' : 'default' } }); if (i) th.addEventListener('click', () => { col = col === i ? 0 : i; paint(); }); return th; }));
  const body = el('tbody', null, R.map((r) => el('tr', null, r.map((v, i) => { const td = el(i ? 'td' : 'th', { html: v }); cells.push([i, td]); return td; }))));
  function paint() { cells.forEach(([i, td]) => { td.style.background = i && i === col ? 'var(--accent-soft)' : ''; }); }
  root.append(el('div', { class: 'tscroll' }, el('table', { class: 't rg' }, el('thead', null, head), body)), el('div', { class: 'tiny', text: 'Tip: click a column header to highlight it.', style: { marginTop: '6px' } }));
});

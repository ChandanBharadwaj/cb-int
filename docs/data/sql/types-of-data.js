IA.register({
  track: 'sql',
  slug: 'types-of-data',
  title: 'Structured vs semi vs unstructured',
  tagline: 'Data comes with <b>more or less shape</b>. A table row has a fixed shape, a JSON payload brings its own, and a PDF has none you can query. Postgres handles all three: <b>columns</b>, <b>jsonb</b>, and <b>text/bytea</b> or a pointer to object storage.',
  tldr: {
    problem: 'Teams pick storage by habit: everything in JSON blobs, or PDFs in <code>bytea</code>. The shape of the data should drive the choice.',
    model: '<b>Structured</b> = schema-on-write (the DB enforces the shape). <b>Semi-structured</b> = schema-on-read (keys travel with the data). <b>Unstructured</b> = no fields; you search or extract meaning.',
    hook: '“Can Postgres store JSON?” Yes, and indexes it. “Should it store 2 GB videos?” No: store a row with the S3 key.',
    facts: [
      { v: 'jsonb', l: 'binary JSON with GIN indexing and containment queries (<code>@&gt;</code>)' },
      { v: '1 GB', l: 'max size of a single field value (text, bytea, jsonb) in Postgres. Practical limits are far lower' },
      { v: 'tsvector', l: 'built-in full-text search for free text, no extra system needed for modest volumes' }
    ]
  },
  intro: {
    what: 'Some data fits neatly into a grid of rows and columns (<b>structured</b>). Some describes itself with labels but varies from record to record, like JSON (<b>semi-structured</b>). Some is just content, like a photo or an email body (<b>unstructured</b>).',
    analogy: { icon: '🗄️', title: 'A form, a sticky note, a photo', text: 'A filled-in tax form has fixed boxes (structured). A sticky note with “milk: 2, eggs: 12” has labels but no fixed layout (semi). A photo of the fridge has the information, but no boxes at all (unstructured).' },
    steps: [
      { t: 'Structured: columns', d: 'You declare the shape first. The DB rejects anything that doesn’t fit.', code: 'CREATE TABLE orders (id int, total numeric(10,2), status text);' },
      { t: 'Semi-structured: JSON', d: 'Each record carries its own keys. You decide how to read it later.', code: "SELECT doc->>'carrier' FROM shipments_raw;" },
      { t: 'Unstructured: files and free text', d: 'Keep big files outside the DB and store a row that describes them.', code: "INSERT INTO files (key, mime, bytes)\nVALUES ('s3://inv/42.pdf','application/pdf',184320);" },
      { t: 'Pick per field, not per app', d: 'One table can mix them: typed columns, a jsonb column for extras, and a link to a file.' }
    ],
    terms: [
      ['schema', 'The declared shape of data: column names and types.'],
      ['schema-on-write', 'Shape is checked when data is written (relational tables).'],
      ['schema-on-read', 'Shape is applied when data is read (JSON, data lakes).'],
      ['jsonb', 'Postgres type for JSON stored in binary, indexable form.'],
      ['bytea', 'Postgres type for raw bytes.'],
      ['object storage', 'A service like S3 that stores files by key.']
    ]
  },
  visual: {
    title: 'Sort the shop’s data',
    caption: 'Press Play to drop seven real samples into the three buckets. Switch the lens to see how Postgres would store each one.'
  },
  extras: [
    { id: 'types-of-data-matrix', title: 'Comparison matrix', label: 'Compare', caption: 'Examples, schema style, typical stores and query style side by side.' }
  ],
  playground: {
    setup: `
CREATE TABLE products (id int PRIMARY KEY, name text NOT NULL, price numeric(10,2) NOT NULL CHECK (price >= 0),
  attrs jsonb NOT NULL DEFAULT '{}', manual_key text);
CREATE TABLE reviews (id int PRIMARY KEY, product_id int REFERENCES products(id), body text NOT NULL);
INSERT INTO products VALUES
 (1,'Teapot',24.00,'{"color":"blue","capacity_ml":900}','s3://manuals/teapot.pdf'),
 (2,'Mug',8.50,'{"color":"white","dishwasher_safe":true}',NULL),
 (3,'Tea sampler',15.00,'{"teas":["sencha","assam","earl grey"]}',NULL);
INSERT INTO reviews VALUES (1,1,'Lovely teapot, pours without dripping'),(2,2,'Mug arrived chipped, please help'),
 (3,2,'Great mug, keeps tea hot'),(4,3,'The assam is strong and malty');`,
    presets: [
      { label: 'Structured', sql: `SELECT name, price FROM products WHERE price < 20 ORDER BY price;`, note: 'Typed columns: comparisons and sorting just work.' },
      { label: 'Semi: JSON keys', sql: `SELECT name, attrs->>'color' AS color, attrs ? 'dishwasher_safe' AS has_flag\nFROM products ORDER BY id;`, note: 'Missing keys simply return NULL. Nothing forces every product to have a color.' },
      { label: 'Semi: containment', sql: `SELECT name FROM products WHERE attrs @> '{"color":"white"}';\nSELECT name FROM products WHERE attrs->'teas' ? 'assam';` },
      { label: 'Unstructured: full-text', sql: `SELECT id, body FROM reviews\nWHERE to_tsvector('english', body) @@ to_tsquery('english', 'chip | broken');`, note: 'Stemming matches “chipped” from “chip”.' },
      { label: 'Schema-on-write', sql: `INSERT INTO products (id, name, price) VALUES (4, 'Kettle', -5);`, note: 'The CHECK constraint rejects it. A JSON blob would not.' },
      { label: 'File as metadata row', sql: `SELECT name, manual_key, manual_key IS NOT NULL AS has_manual FROM products ORDER BY id;`, note: 'The PDF lives in object storage; the row only stores where.' }
    ]
  },
  gotchas: [
    { trap: 'Big files in bytea', why: 'Every MB goes into the table’s TOAST storage, WAL, replicas and every backup. Reading a row can pull megabytes over the wire.', fix: 'Store files in object storage; keep key, size, checksum and MIME type in a row.' },
    { trap: 'JSONB for everything', why: 'No types, no NOT NULL, no foreign keys inside a document. Planner statistics on keys are weak, so row estimates are guesses.', fix: 'Columns for fields you filter, join, constrain or aggregate. JSONB for the genuinely variable rest.' },
    { trap: 'json vs jsonb confusion', code: `SELECT '{"a":1,"a":2}'::json, '{"a":1,"a":2}'::jsonb;`, why: '<code>json</code> keeps the exact text including duplicates; <code>jsonb</code> keeps only the last duplicate key and reorders keys.', fix: 'Use <code>jsonb</code> unless you must preserve the original text byte for byte.' },
    { trap: '“Schemaless” still has a schema', why: 'The code that reads the data assumes keys and types. When writers change, readers break at runtime instead of at INSERT time.', fix: 'Version your payloads, validate on write (JSON Schema in the app, or CHECK constraints such as <code>attrs ? \'color\'</code>).' },
    { trap: 'Full-text search with LIKE', code: `WHERE body LIKE '%chip%'`, why: 'A leading wildcard can’t use a B-tree index, it has no idea of words or relevance (<code>%cat%</code> also matches “category”), and it can’t rank results.', fix: 'Use <code>tsvector</code> with a GIN index, or <code>pg_trgm</code> for substring search.' }
  ],
  scenarios: [
    { title: 'Nightly backup grew from 40 GB to 600 GB',
      symptom: 'Backups and replica rebuilds now take hours. Storage costs spike.',
      diagnose: `SELECT relname, pg_size_pretty(pg_total_relation_size(oid))\nFROM pg_class WHERE relkind = 'r'\nORDER BY pg_total_relation_size(oid) DESC LIMIT 5;`,
      cause: 'A feature stored uploaded invoice PDFs in a <code>bytea</code> column.',
      fix: 'Move files to object storage, keep a metadata row, and backfill keys in batches.',
      fixCode: `ALTER TABLE invoices ADD COLUMN file_key text;\n-- app uploads blobs, sets file_key, then:\nALTER TABLE invoices DROP COLUMN pdf;   -- space returns after VACUUM FULL / pg_repack` },
    { title: 'Search for a product attribute takes 4 s',
      symptom: 'Filtering by <code>attrs-&gt;&gt;\'color\'</code> on 20 M products is a sequential scan.',
      diagnose: `EXPLAIN SELECT id FROM products WHERE attrs->>'color' = 'blue';`,
      cause: 'No index matches the expression; a GIN index on <code>attrs</code> doesn’t serve <code>-&gt;&gt;</code> equality.',
      fix: 'Either query with containment so the GIN index applies, or add an expression index.',
      fixCode: `CREATE INDEX ON products USING gin (attrs jsonb_path_ops);  -- for attrs @> '{"color":"blue"}'\nCREATE INDEX ON products ((attrs->>'color'));             -- for attrs->>'color' = 'blue'` }
  ],
  puzzles: [
    { kind: 'predict', q: 'How many rows?', code: `SELECT name FROM products WHERE attrs->>'color' IS NULL;`, options: ['0', '1', '2', '3'], answer: 1, explain: 'Only the Tea sampler has no <code>color</code> key, so <b>1</b>. A missing key returns NULL.' },
    { kind: 'predict', q: 'What does this return?', code: `SELECT '{"a":1,"a":2}'::jsonb ->> 'a' AS v;`, options: ['1', '2', 'error: duplicate key', '[1,2]'], answer: 1, explain: 'jsonb keeps the <b>last</b> value for a duplicate key: <b>2</b>.' },
    { kind: 'predict', q: 'How many reviews match?', code: `SELECT count(*) FROM reviews\nWHERE to_tsvector('english', body) @@ to_tsquery('english', 'mug');`, options: ['0', '1', '2', '3'], answer: 2, explain: 'Reviews 2 and 3 contain “mug”/“Mug”: <b>2</b>. Full-text search is case-insensitive after normalization.' },
    { kind: 'predict', q: 'What happens?', code: `INSERT INTO products (id, name, price, attrs) VALUES (5, 'Spoon', 2, '{"color": 7}');\nSELECT count(*) FROM products;`, options: ['error: color must be text', 'count = 4', 'count = 3', 'error: CHECK violation'], answer: 1, explain: 'Nothing constrains types inside the JSON. The row is accepted: <b>4</b>.' },
    { kind: 'concept', q: 'Schema-on-read means…', options: ['the DB validates data on INSERT', 'the reader decides how to interpret fields at query time', 'there is no way to query it', 'the schema is stored in a separate table'], answer: 1, explain: 'Data lands as-is; structure is applied when you read it.' }
  ],
  interview: [
    { q: 'Define structured, semi-structured and unstructured data with examples.', a: '<p>Structured: fixed columns and types (orders table). Semi-structured: self-describing records whose shape varies (JSON events, logs). Unstructured: content without fields (images, PDFs, free text).</p>', lvl: 'core' },
    { q: 'Schema-on-write vs schema-on-read: trade-offs?', a: '<p>On-write catches bad data early and lets the planner and indexes rely on types, but schema changes need migrations. On-read accepts anything quickly, but every reader must handle every variant, and errors surface late.</p>', lvl: 'core' },
    { q: 'When is Postgres jsonb a good choice?', a: '<p>Variable attributes (product specs), third-party payloads you want to keep whole, sparse optional fields. Keep keys you filter or join on as columns, or index them with an expression index.</p>', fu: 'GIN <code>jsonb_ops</code> vs <code>jsonb_path_ops</code>? (path_ops is smaller and faster for <code>@&gt;</code> but doesn’t support key-exists operators.)', lvl: 'core' },
    { q: 'Where would you store user-uploaded images?', a: '<p>In object storage, with a row holding the key, size, MIME type, checksum and owner. The DB stays small, backups stay fast, and a CDN can serve the files.</p>', lvl: 'core' },
    { q: 'How does Postgres store large values internally?', a: '<p>Values over roughly 2 KB are compressed and/or moved out of line into a TOAST table. A single field can be up to 1 GB. Big values still cost WAL, replication and backup bandwidth.</p>', lvl: 'deep' },
    { q: 'Can you enforce a schema on jsonb?', a: '<p>Partly: <code>CHECK (attrs ? \'color\')</code>, <code>CHECK (jsonb_typeof(attrs-&gt;\'price\') = \'number\')</code>, or generated columns that cast a key (a failed cast rejects the row). Full JSON Schema validation needs an extension or the application.</p>', lvl: 'deep' },
    { q: 'What is full-text search in Postgres?', a: '<p><code>to_tsvector</code> turns text into normalized lexemes; <code>to_tsquery</code> builds a query; <code>@@</code> matches; a GIN index makes it fast; <code>ts_rank</code> orders by relevance.</p>', lvl: 'core' },
    { q: 'Is a data lake “unstructured”?', a: '<p>Not necessarily. It usually holds structured (Parquet) and semi-structured (JSON) files with schema applied on read, plus some truly unstructured blobs.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Mixed entity: columns + jsonb + file key', lang: 'java', code: `@Entity
public class Product {
  @Id Long id;
  @Column(nullable = false) String name;            // structured
  @Column(nullable = false) BigDecimal price;        // structured
  @JdbcTypeCode(SqlTypes.JSON) Map<String, Object> attrs; // semi-structured (jsonb)
  String manualKey;                                  // unstructured file lives in S3
}` }
  ]
});

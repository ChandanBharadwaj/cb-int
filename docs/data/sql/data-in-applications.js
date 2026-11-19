IA.register({
  track: 'sql',
  slug: 'data-in-applications',
  title: 'How applications see data',
  tagline: 'One order lives three lives: an <b>object</b> in your Java code, <b>JSON</b> on the wire, and a <b>row</b> in Postgres. The ORM and the serializer translate between them, and every translation can lose something.',
  tldr: {
    problem: 'Beginners see “the data” as one thing. In a real app the same order exists as a Java object, a JSON document and table rows, each with different types and rules.',
    model: '<b>Object</b> (typed, in memory, short-lived) → <b>JSON</b> (text, untyped-ish, for transport) → <b>rows</b> (typed columns, durable, shared). An <b>ORM</b> like Hibernate maps an entity class to a table.',
    hook: '“Why did 19.99 become 19.989999?” Somewhere between the object and the row, a <code>double</code> got involved.',
    facts: [
      { v: '1 entity ↔ 1 table', l: 'the basic JPA mapping. A field maps to a column; a <code>List</code> usually maps to a second table' },
      { v: 'JSON has 1 number type', l: 'so money and big ids need care. JSON numbers carry no precision or type' },
      { v: 'jsonb', l: 'lets Postgres store a whole document in one column and still index and query inside it' }
    ]
  },
  intro: {
    what: 'An application keeps data in three places. While code runs, it is an <b>object</b> in memory. When it travels between services, it is <b>JSON</b> text. When it must survive a restart, it is a <b>row</b> in a database table. Libraries convert between them automatically.',
    analogy: { icon: '📦', title: 'A parcel on its journey', text: 'You pack an item (the object), write a shipping label anyone can read (JSON), and the warehouse files it on a labelled shelf (the table row). Same item, three forms, each suited to its job.' },
    steps: [
      { t: 'In memory: an object', d: 'Your Java class has typed fields. It disappears when the process stops.' },
      { t: 'On the wire: JSON', d: 'Jackson turns the object into text so another service or a browser can read it.' },
      { t: 'On disk: a row', d: 'The ORM writes an INSERT. Each field becomes a column with a SQL type.', code: "INSERT INTO orders (id, customer, total)\nVALUES (42, 'Asha', 19.99);" },
      { t: 'Back again', d: 'Reading reverses the trip: SELECT → row → entity object → JSON response.', code: 'SELECT id, customer, total FROM orders WHERE id = 42;' }
    ],
    terms: [
      ['object / entity', 'An instance of a class in memory. A JPA <i>entity</i> is a class mapped to a table.'],
      ['JSON', 'A text format for data: <code>{"id": 42}</code>. Used by REST APIs.'],
      ['serialize', 'Turn an object into bytes or text (and deserialize: back again).'],
      ['ORM', 'Object-Relational Mapper, e.g. Hibernate. Turns objects into SQL and rows into objects.'],
      ['row / column', 'One record in a table / one typed attribute of it.'],
      ['JSONB', 'A Postgres type that stores JSON in a parsed, binary, indexable form.']
    ]
  },
  visual: {
    title: 'Follow one Order through the stack',
    caption: 'Press Play to watch the same order become JSON, then SQL, then rows. Switch between storing it as <b>columns + a child table</b> or as <b>one JSONB document</b>.'
  },
  playground: {
    setup: `
CREATE TABLE orders (id bigint PRIMARY KEY, customer text NOT NULL, total numeric(10,2) NOT NULL,
  status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE order_items (order_id bigint REFERENCES orders(id), sku text, qty int CHECK (qty > 0));
CREATE TABLE order_docs (id bigint PRIMARY KEY, doc jsonb NOT NULL);
INSERT INTO orders VALUES (42,'Asha',19.99,'PAID','2026-03-01 09:30Z'),(43,'Ben',5.00,'NEW','2026-03-02 10:00Z');
INSERT INTO order_items VALUES (42,'TEA',2),(42,'MUG',1),(43,'TEA',1);
INSERT INTO order_docs VALUES
 (42,'{"customer":"Asha","total":19.99,"status":"PAID","items":[{"sku":"TEA","qty":2},{"sku":"MUG","qty":1}]}'),
 (43,'{"customer":"Ben","total":5.00,"status":"NEW","items":[{"sku":"TEA","qty":1}]}');`,
    presets: [
      { label: 'Columns', sql: `SELECT o.id, o.customer, o.total, i.sku, i.qty\nFROM orders o JOIN order_items i ON i.order_id = o.id\nORDER BY o.id, i.sku;`, note: 'The relational form: one row per item, the order repeated by the join.' },
      { label: 'JSONB document', sql: `SELECT id, doc->>'customer' AS customer, (doc->>'total')::numeric AS total,\n       jsonb_array_length(doc->'items') AS n_items\nFROM order_docs ORDER BY id;`, note: '<code>-&gt;&gt;</code> returns text, so you cast it yourself.' },
      { label: 'Row → JSON', sql: `-- what a REST endpoint could return, built by Postgres itself\nSELECT jsonb_build_object('id', o.id, 'customer', o.customer, 'total', o.total,\n  'items', (SELECT jsonb_agg(jsonb_build_object('sku', sku, 'qty', qty)) FROM order_items WHERE order_id = o.id)) AS body\nFROM orders o WHERE o.id = 42;` },
      { label: 'Types protect you', sql: `INSERT INTO orders (id, customer, total, status) VALUES (44, 'Chen', 'abc', 'NEW');`, note: 'Columns reject bad values: error, invalid input syntax for numeric.' },
      { label: 'JSONB accepts anything', sql: `INSERT INTO order_docs VALUES (44, '{"customer":"Chen","total":"abc"}');\nSELECT id, doc->>'total' AS total FROM order_docs ORDER BY id;`, note: 'No schema inside the document: “abc” goes in without complaint.' },
      { label: 'Query inside JSONB', sql: `SELECT id FROM order_docs WHERE doc @> '{"status":"PAID"}';\nSELECT id FROM order_docs WHERE doc->'items' @> '[{"sku":"MUG"}]';`, note: '<code>@&gt;</code> means “contains”. A GIN index on <code>doc</code> can serve it.' }
    ]
  },
  gotchas: [
    { trap: 'Money as double', code: `// Java\ndouble total = 0.1 + 0.2;   // 0.30000000000000004`, why: 'Binary floating point can’t represent most decimal fractions exactly. JSON parsers often default to double.', fix: 'Use <code>BigDecimal</code> in Java and <code>numeric</code> in Postgres. Configure Jackson with <code>USE_BIG_DECIMAL_FOR_FLOATS</code> where it matters.' },
    { trap: 'Field names drift between layers', why: '<code>createdAt</code> in Java and JSON, <code>created_at</code> in SQL. Hibernate’s naming strategy and Jackson’s naming strategy are configured separately.', fix: 'Pick a convention per layer and set it once (Spring Boot defaults to snake_case columns). Test the JSON contract.' },
    { trap: 'Timestamps without a time zone', why: '<code>LocalDateTime</code> has no zone. Saved into <code>timestamp</code> (without time zone), the meaning depends on the server’s settings.', fix: 'Use <code>Instant</code> or <code>OffsetDateTime</code> with <code>timestamptz</code>. See <a href="data-types-that-bite.html">Data types that bite</a>.' },
    { trap: 'JSONB as a way to skip schema design', code: `INSERT INTO order_docs VALUES (44, '{"total":"abc"}');  -- accepted`, why: 'Postgres checks only that it is valid JSON. Typos in keys and wrong value types go in silently.', fix: 'Use columns for fields you filter, join or constrain. Use JSONB for truly variable attributes, and add CHECK constraints for the keys you rely on.' },
    { trap: 'Lazy collections and N+1 queries', why: 'Serializing an entity with a lazy <code>@OneToMany</code> can fire one SELECT per order (or a LazyInitializationException outside a transaction).', fix: 'Return DTOs, not entities, from controllers. Load what you need with a fetch join or an entity graph.' }
  ],
  scenarios: [
    { title: 'Invoices off by one cent',
      symptom: 'A small number of invoice totals in the database differ from the amounts shown in the checkout UI by 0.01.',
      diagnose: `SELECT id, total FROM orders WHERE total <> round(total, 2);  -- or compare to the payment provider`,
      cause: 'A DTO declared <code>double total</code>. Values were summed as doubles and rounded on the way into a <code>numeric</code> column.',
      fix: 'Change the DTO and entity to <code>BigDecimal</code>, keep <code>numeric(12,2)</code>, and reject non-decimal JSON input.',
      fixCode: `ALTER TABLE orders ALTER COLUMN total TYPE numeric(12,2);` },
    { title: 'Report can’t filter by status: it lives in a JSON blob',
      symptom: 'A dashboard query on <code>order_docs</code> takes seconds and returns some orders twice under “Paid” and “paid”.',
      diagnose: `SELECT doc->>'status', count(*) FROM order_docs GROUP BY 1;`,
      cause: 'Status was stored only in JSONB with no constraint, so different services wrote different spellings, and there was no index.',
      fix: 'Promote hot fields to real columns (or a generated column), constrain them, and index them.',
      fixCode: `ALTER TABLE order_docs\n  ADD COLUMN status text GENERATED ALWAYS AS (upper(doc->>'status')) STORED;\nCREATE INDEX ON order_docs (status);` }
  ],
  puzzles: [
    { kind: 'predict', q: 'How many rows does this return?', code: `SELECT o.id, i.sku FROM orders o JOIN order_items i ON i.order_id = o.id;`, options: ['2', '3', '4', '6'], answer: 1, explain: 'One row per item: order 42 has 2 items and order 43 has 1, so <b>3</b>.' },
    { kind: 'predict', q: 'What does <code>-&gt;&gt;</code> return here?', code: `SELECT pg_typeof(doc->>'total') FROM order_docs WHERE id = 42;`, options: ['numeric', 'jsonb', 'text', 'double precision'], answer: 2, explain: '<code>-&gt;&gt;</code> always returns <b>text</b>. <code>-&gt;</code> returns jsonb. Cast to numeric yourself.' },
    { kind: 'predict', q: 'What happens?', code: `INSERT INTO order_docs VALUES (99, '{"total": "abc"}');\nSELECT count(*) FROM order_docs;`, options: ['Error: invalid numeric', 'count = 3', 'count = 2', 'Error: missing customer'], answer: 1, explain: 'JSONB only checks that the text is valid JSON. The insert succeeds, so <b>3</b> rows.' },
    { kind: 'predict', q: 'Which ids match?', code: `SELECT id FROM order_docs WHERE doc->'items' @> '[{"sku":"TEA"}]' ORDER BY id;`, options: ['42 only', '43 only', '42 and 43', 'none'], answer: 2, explain: 'Both orders have a TEA item. <code>@&gt;</code> on arrays checks that some element contains the given object.' },
    { kind: 'concept', q: 'In JPA, a <code>@OneToMany List&lt;Item&gt;</code> is usually stored as…', options: ['an array column in orders', 'a separate table with a foreign key to orders', 'a JSON string column', 'it isn’t stored'], answer: 1, explain: 'The default relational mapping is a child table (<code>order_items</code>) with <code>order_id</code> pointing to the parent.' }
  ],
  interview: [
    { q: 'What is an ORM and what problem does it solve?', a: '<p>It maps classes to tables and objects to rows, generating SQL for CRUD and tracking changes (Hibernate’s persistence context flushes dirty entities). It removes boilerplate JDBC code. It does not remove the need to understand the SQL it generates.</p>', fu: 'What is the “object-relational impedance mismatch”?', lvl: 'core' },
    { q: 'How does a Java type map to a Postgres type?', a: '<p>Typical: <code>Long</code>→<code>bigint</code>, <code>String</code>→<code>text/varchar</code>, <code>BigDecimal</code>→<code>numeric</code>, <code>Instant/OffsetDateTime</code>→<code>timestamptz</code>, <code>boolean</code>→<code>boolean</code>, <code>UUID</code>→<code>uuid</code>, enum→<code>text</code> with <code>@Enumerated(STRING)</code>.</p>', lvl: 'core' },
    { q: 'Why is <code>@Enumerated(ORDINAL)</code> dangerous?', a: '<p>It stores the enum position (0, 1, 2). Reordering or inserting a constant silently changes the meaning of every stored row. Use <code>STRING</code>, plus a CHECK constraint or a lookup table.</p>', lvl: 'core' },
    { q: 'When would you store an entity as JSONB instead of columns?', a: '<p>When attributes vary per row (product specs, provider payloads), are read as a whole, and aren’t joined or constrained. Keep identifiers, foreign keys and anything you filter or aggregate on as columns.</p>', fu: 'How do you index a JSONB field? (GIN on the column for containment, or a B-tree expression index on <code>(doc-&gt;&gt;\'key\')</code>.)', lvl: 'core' },
    { q: 'Should controllers return JPA entities as JSON?', a: '<p>Better not. It couples the API to the schema, can trigger lazy loading (N+1 or LazyInitializationException), and may leak fields. Map to DTOs or use Spring Data projections.</p>', lvl: 'core' },
    { q: 'What is lost when an object becomes JSON?', a: '<p>Types (one number type, no dates, no decimals), identity (two references to the same object become two copies), and precision for large integers in JavaScript clients (above 2<sup>53</sup>). Send big ids as strings.</p>', lvl: 'deep' },
    { q: 'JSON vs JSONB in Postgres in one sentence?', a: '<p><code>json</code> stores the exact text (keeps whitespace, key order and duplicates); <code>jsonb</code> stores a parsed binary form that is faster to query and indexable but normalizes key order and keeps only the last duplicate key.</p>', lvl: 'core' },
    { q: 'Where should validation live: Java or the database?', a: '<p>Both. Bean Validation gives friendly errors early; database constraints (NOT NULL, CHECK, FK, UNIQUE) are the last line of defence because other writers, scripts and races bypass the application.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Entity with columns and a child table', lang: 'java', code: `@Entity @Table(name = "orders")
public class Order {
  @Id private Long id;
  private String customer;
  @Column(precision = 10, scale = 2) private BigDecimal total;
  @Enumerated(EnumType.STRING) private Status status;
  private Instant createdAt;                       // -> created_at timestamptz
  @OneToMany(mappedBy = "order", cascade = CascadeType.ALL)
  private List<OrderItem> items = new ArrayList<>();
}` },
    { title: 'Same order as a JSONB column (Hibernate 6)', lang: 'java', code: `@Entity @Table(name = "order_docs")
public class OrderDoc {
  @Id private Long id;
  @JdbcTypeCode(SqlTypes.JSON)              // maps to jsonb on Postgres
  private OrderPayload doc;                 // a plain record, serialized by Jackson
}
public record OrderPayload(String customer, BigDecimal total, String status, List<Item> items) {}`, note: 'Hibernate 5 needs a library such as hypersistence-utils for this.' }
  ]
});

IA.register({
  track: 'sql',
  slug: 'schema-design',
  title: 'Schema design for Postgres',
  tagline: 'Normalize so every fact lives in <b>one place</b>, then denormalize where a measured read path needs it. On top of that: soft deletes that don’t break uniqueness, a tenancy model that scales, and primary keys that don’t wreck your indexes.',
  tldr: {
    problem: 'Schemas are the hardest thing to change later. Duplicated facts drift apart, soft-deleted users block re-signups, random UUID keys bloat indexes, and a tenancy model chosen for 10 customers collapses at 10,000.',
    model: '3NF = every non-key column depends on <b>the key, the whole key, and nothing but the key</b>. Constraints (PK, FK, UNIQUE, CHECK, NOT NULL) are the schema enforcing that model for you. Denormalization is a cache you must keep correct.',
    hook: '“User deleted their account, signed up again, got <i>duplicate key value violates unique constraint</i>.” A soft delete needs a <b>partial</b> unique index.',
    facts: [
      { v: '8 vs 16 B', l: 'bigint vs uuid key size. Every secondary index and FK column pays it again' },
      { v: 'PG18', l: 'built-in <code>uuidv7()</code>: time-ordered UUIDs that insert like a sequence' },
      { v: 'WHERE deleted_at IS NULL', l: 'the partial unique index that makes soft deletes work' }
    ]
  },
  intro: {
    what: 'Schema design is deciding <b>which tables exist, which columns they have, and which rules (constraints) protect them</b>. The main idea is <b>normalization</b>: store each fact once, and link tables by keys. Then you make practical choices: how to “delete” rows, how to keep customers’ data apart, and what kind of id to use.',
    analogy: { icon: '🗂️', title: 'A well-run filing cabinet', text: 'Each customer has one card with their address. Orders reference the customer number instead of copying the address onto every order slip. When the customer moves, you change one card, and every order is automatically correct.' },
    steps: [
      { t: 'One value per cell (1NF)', d: 'No lists in a column like “kettle, mug”. Use a child table with one row per item.' },
      { t: 'Facts depend on the key (2NF, 3NF)', d: 'A product’s name belongs in <code>products</code>, not in every order line. A customer’s city belongs in <code>customers</code>, not in every order.' },
      { t: 'Let the database enforce rules', d: 'Primary keys, foreign keys, NOT NULL, UNIQUE and CHECK constraints stop bad data at the door.', code: 'CREATE TABLE orders (\n  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  customer_id bigint NOT NULL REFERENCES customers(id),\n  status      text   NOT NULL CHECK (status IN (\'new\',\'paid\',\'shipped\')),\n  created_at  timestamptz NOT NULL DEFAULT now()\n);' },
      { t: 'Denormalize only with a reason', d: 'Copying a value (like an order total) speeds up reads, but now you must keep the copy in sync. Do it when a hot query needs it, not by default.' }
    ],
    terms: [
      ['normalization', 'Splitting tables so each fact is stored once.'],
      ['update anomaly', 'The same fact stored twice, updated in one place, and now contradicting itself.'],
      ['surrogate key', 'An artificial id (identity, UUID) instead of a real-world value like an email.'],
      ['soft delete', 'Marking a row deleted (<code>deleted_at</code>) instead of removing it.'],
      ['tenant', 'One customer organization in a SaaS product that shares the database with others.']
    ]
  },
  visual: {
    title: 'Normalize a spreadsheet, step by step',
    caption: 'Watch the columns move as each normal form removes a kind of duplication. The counters show how many rows you must touch when one customer moves, and how many joins an order page needs.'
  },
  extras: [
    { id: 'schema-design-tenancy', title: 'Multi-tenancy: shared + RLS vs schema vs database per tenant', label: 'Multi-tenancy', caption: 'Set your tenant count and isolation needs. The table highlights the usual best fit.' },
    { id: 'schema-design-ids', title: 'Primary keys: where do new rows land in the index?', label: 'IDs', caption: 'Sequential keys always append to the rightmost leaf. Random UUIDv4 keys touch pages all over the index.' }
  ],
  playground: {
    setup: `
CREATE ROLE app_user;
CREATE TABLE customers (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text NOT NULL, city text);
CREATE TABLE users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL,
  deleted_at timestamptz
);
CREATE UNIQUE INDEX users_email_live ON users (email) WHERE deleted_at IS NULL;
INSERT INTO users (email, deleted_at) VALUES ('asha@x.io', now() - interval '3 days'), ('ben@x.io', NULL);
CREATE TABLE invoices (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, tenant_id int NOT NULL, amount numeric NOT NULL);
INSERT INTO invoices (tenant_id, amount) VALUES (1, 100), (1, 250), (2, 999);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON invoices USING (tenant_id = current_setting('app.tenant_id')::int);
GRANT SELECT ON invoices TO app_user;
CREATE TYPE order_status AS ENUM ('new', 'paid', 'shipped');
CREATE TABLE order_status_lookup (code text PRIMARY KEY, label text NOT NULL, sort int NOT NULL);
INSERT INTO order_status_lookup VALUES ('new','New',1),('paid','Paid',2),('shipped','Shipped',3);`,
    presets: [
      { label: 'Soft delete + partial unique', sql: `-- asha@x.io was soft-deleted 3 days ago; she signs up again:\nINSERT INTO users (email) VALUES ('asha@x.io')\nON CONFLICT (email) WHERE deleted_at IS NULL DO NOTHING\nRETURNING id, email;\n-- ben@x.io is live; a duplicate is rejected (0 rows):\nINSERT INTO users (email) VALUES ('ben@x.io')\nON CONFLICT (email) WHERE deleted_at IS NULL DO NOTHING\nRETURNING id, email;\nSELECT * FROM users ORDER BY id;`, note: 'Uniqueness applies only to live rows. With a plain <code>UNIQUE (email)</code> the re-signup would fail. Note the <code>WHERE</code> in the ON CONFLICT target: it must match the partial index.' },
      { label: 'RLS per tenant', sql: `SET app.tenant_id = '1';\nSET ROLE app_user;\nSELECT * FROM invoices;            -- only tenant 1\nSELECT sum(amount) FROM invoices;  -- no WHERE needed\nRESET ROLE;\nSELECT count(*) AS as_owner FROM invoices;  -- superuser/owner bypasses RLS`, note: 'The table owner and superusers bypass RLS unless you use <code>FORCE ROW LEVEL SECURITY</code>. The app must connect as a non-owner role.' },
      { label: 'UUIDv7 vs v4', sql: `SELECT uuidv7() AS v7, uuid_extract_timestamp(uuidv7()) AS v7_time,\n       gen_random_uuid() AS v4, uuid_extract_version(gen_random_uuid()) AS v4_version;\nSELECT pg_column_size(1::bigint) AS bigint_bytes, pg_column_size(gen_random_uuid()) AS uuid_bytes;`, note: '<code>uuidv7()</code> is built in from PG18 (this playground runs PG18). <code>uuid_extract_timestamp</code> exists since PG17. On PG16/17 generate v7 in the app.' },
      { label: 'Enum vs lookup table', sql: `ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'cancelled' BEFORE 'shipped';\nSELECT 'paid'::order_status < 'shipped'::order_status AS sorts_by_declaration;\nSELECT code, label FROM order_status_lookup ORDER BY sort;\n-- then run this on its own (a new enum value can't be used in the transaction that added it):\n-- SELECT unnest(enum_range(NULL::order_status));`, note: 'Enums: 4 bytes, ordered by declaration, values can be added but not removed. A lookup table can hold labels and flags and be edited with plain DML, at the cost of an FK and maybe a join.' },
      { label: 'Audit columns trigger', sql: `CREATE TABLE IF NOT EXISTS notes (\n  id int PRIMARY KEY, body text,\n  created_at timestamptz NOT NULL DEFAULT now(),\n  updated_at timestamptz NOT NULL DEFAULT now());\nCREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$\nBEGIN NEW.updated_at := clock_timestamp(); RETURN NEW; END $$;\nCREATE OR REPLACE TRIGGER notes_touch BEFORE UPDATE ON notes\n  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();\nINSERT INTO notes (id, body) VALUES (1, 'v1') ON CONFLICT (id) DO NOTHING;\nUPDATE notes SET body = 'v2' WHERE id = 1;\nSELECT id, body, updated_at > created_at AS touched FROM notes;`, note: '<code>now()</code> is the transaction start time, so inside one transaction created_at and updated_at would be equal. The trigger uses <code>clock_timestamp()</code>.' }
    ]
  },
  gotchas: [
    { trap: 'Soft delete + plain UNIQUE', code: `CREATE TABLE users (email text UNIQUE, deleted_at timestamptz);\n-- re-signup after soft delete → duplicate key`, why: 'The deleted row still holds the email.', fix: 'Partial unique index: <code>CREATE UNIQUE INDEX ON users (email) WHERE deleted_at IS NULL</code>. Also a view or default scope (<code>@SQLRestriction("deleted_at is null")</code>) so queries don’t forget the filter.' },
    { trap: 'Soft deletes and foreign keys', why: 'An FK is satisfied by a soft-deleted parent, and ON DELETE CASCADE never fires. Child rows of “deleted” customers live on.', fix: 'Decide per relationship: cascade the soft delete in the service, or archive by moving rows to an <code>_archive</code> table and hard-deleting.' },
    { trap: 'Random UUIDv4 primary keys on big, insert-heavy tables', why: 'Each insert hits a random leaf page of the PK index (and of every index on another random value). Once the index is bigger than RAM, inserts turn into random reads, and more full-page writes go to WAL.', fix: 'Use bigint identity, UUIDv7 (PG18 <code>uuidv7()</code>, or generated in the app before that), or another time-ordered id.' },
    { trap: 'Missing tenant_id in indexes and unique constraints', why: 'With shared tables, <code>UNIQUE (invoice_no)</code> is global across tenants, and indexes without a tenant_id prefix scan other tenants’ rows.', fix: 'Lead with tenant_id: <code>UNIQUE (tenant_id, invoice_no)</code>, <code>INDEX (tenant_id, created_at)</code>. Composite FKs including tenant_id prevent cross-tenant references.' },
    { trap: 'Enum values can’t be removed', why: '<code>ALTER TYPE … ADD VALUE</code> works (PG12+ even inside a transaction, but the new value can’t be used until commit). Removing or renaming used values means recreating the type.', fix: 'Use enums for small, stable sets (status machines). Use a lookup table or a CHECK constraint for business-owned lists.' },
    { trap: 'Denormalized copies drift', why: 'A cached <code>orders.total</code> updated in one code path but not another is wrong forever, silently.', fix: 'Maintain it in one place (trigger, or the same transaction), or derive it (generated column, materialized view). Add a periodic reconciliation query.' },
    { trap: 'timestamp without time zone for audit columns', why: 'It stores wall-clock time with no zone, so servers or JVMs in different zones write inconsistent values.', fix: 'Use <code>timestamptz</code> for every point in time. See <a href="types-of-data.html">Types of data</a>.' }
  ],
  scenarios: [
    { title: 'Insert latency triples as the events table passes 300 GB',
      symptom: 'p99 for <code>INSERT INTO events</code> went from 2 ms to 20 ms over a few months. WAL volume per insert grew, and the PK index is larger than RAM.',
      diagnose: `SELECT relname, pg_size_pretty(pg_relation_size(indexrelid)) AS size, idx_scan\nFROM pg_stat_user_indexes WHERE relname = 'events';\nSELECT blks_read, blks_hit FROM pg_stat_database WHERE datname = current_database();`,
      cause: 'Primary key = <code>gen_random_uuid()</code>. Every insert needs a random leaf page of a 40 GB index, which is mostly not in cache: a random read per insert, half-full pages after splits, and full-page writes in WAL.',
      fix: 'New tables use a time-ordered key. For the existing one: add a bigint identity or UUIDv7 column, make it the clustered access path, and keep the v4 as a secondary unique key if clients use it.',
      fixCode: `CREATE TABLE events (\n  id uuid PRIMARY KEY DEFAULT uuidv7(),   -- PG18+\n  ...\n);` },
    { title: 'Tenant A saw tenant B’s invoices',
      symptom: 'A support ticket with a screenshot of another company’s invoice. One new endpoint built its query with a repository method that forgot the tenant filter.',
      diagnose: `SELECT relname, relrowsecurity, relforcerowsecurity\nFROM pg_class WHERE relname IN ('invoices','customers','orders');`,
      cause: 'Isolation depended on every query remembering <code>WHERE tenant_id = ?</code>. No RLS, and the app connected as the table owner.',
      fix: 'Enable RLS with a policy on every tenant table, connect as a non-owner role, and set the tenant per transaction. Watch out with pools: use <code>set_config(…, true)</code> (transaction-local) so it can’t leak to the next request.',
      fixCode: `ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;\nALTER TABLE invoices FORCE ROW LEVEL SECURITY;\nCREATE POLICY tenant_isolation ON invoices\n  USING (tenant_id = current_setting('app.tenant_id')::int);\n-- per transaction, from the app:\nSELECT set_config('app.tenant_id', '42', true);` },
    { title: 'Schema-per-tenant: the migration that ran on 2,812 of 3,000 schemas',
      symptom: 'A Flyway run failed partway. 188 tenants are on the old schema version, and the app crashes for them.',
      diagnose: `SELECT count(*) FROM pg_namespace WHERE nspname LIKE 'tenant_%';\nSELECT count(*) FROM pg_class;   -- millions of catalog rows`,
      cause: 'N schemas means N migrations, no atomicity across them, and a huge catalog (slow pg_dump, slow planning for catalog lookups).',
      fix: 'Short term: idempotent migrations, a version table per schema, and a re-runner. Long term: consolidate into shared tables with tenant_id + RLS.' }
  ],
  puzzles: [
    { kind: 'predict', q: 'asha@x.io is soft-deleted and ben@x.io is live. How many rows does the last query return?', code: `INSERT INTO users (email) VALUES ('asha@x.io'), ('ben@x.io')\nON CONFLICT (email) WHERE deleted_at IS NULL DO NOTHING;\nSELECT email FROM users WHERE deleted_at IS NULL ORDER BY email;`, options: ['1', '2', '3', 'Error: duplicate key'], answer: 1, explain: 'Asha’s new row is allowed (the partial index ignores the deleted one). Ben’s duplicate is skipped. Live rows: asha@x.io (new) and ben@x.io = <b>2</b>.' },
    { kind: 'predict', q: 'As app_user with tenant 1, what does this return?', code: `SET app.tenant_id = '1';\nSET ROLE app_user;\nSELECT count(*), sum(amount) FROM invoices;`, options: ['3, 1349', '2, 350', '1, 999', '0, NULL'], answer: 1, explain: 'The policy hides tenant 2’s row: <b>2 rows, 350</b>. Run it as the owner/superuser and you would see all 3.' },
    { kind: 'predict', q: 'Run as one batch (one transaction). What happens?', code: `ALTER TYPE order_status ADD VALUE 'cancelled' BEFORE 'shipped';\nSELECT 'cancelled'::order_status < 'shipped'::order_status AS lt;`, options: ['lt = true', 'lt = false', 'Error: enum types are closed', 'Error: the new value can’t be used in the same transaction'], answer: 3, explain: 'PG12+ allows <code>ADD VALUE</code> inside a transaction block, but the new value can’t be used until that transaction commits: <code>ERROR: unsafe use of new value "cancelled"</code>. Migration tools that wrap each file in a transaction hit this. After commit, the answer would be true (declaration order).' },
    { kind: 'concept', q: 'Table <code>order_lines(order_id, product_id, product_name, qty)</code> with key (order_id, product_id). Which normal form does product_name violate?', options: ['1NF', '2NF', '3NF', 'None'], answer: 1, explain: 'product_name depends on only <i>part</i> of the composite key (product_id): a partial dependency, so it violates <b>2NF</b>.' },
    { kind: 'concept', q: 'Insert-heavy table, 2 billion rows, ids must be generated by app servers without a round trip. Best key?', options: ['UUIDv4', 'UUIDv7 / Snowflake-style', 'serial (int4)', 'Natural key: email'], answer: 1, explain: 'App-generated and time-ordered: <b>UUIDv7</b> (16 B) or a Snowflake-style bigint (8 B). v4 is random (index locality), serial is DB-generated and int4 overflows at 2.1B.' },
    { kind: 'concept', q: 'Is storing <code>unit_price</code> on order_items (copied from products.price) a normalization violation?', options: ['Yes: duplicate of products.price', 'No: it is a different fact (the price at the time of sale)', 'Only in 3NF', 'Only if price is indexed'], answer: 1, explain: 'The product price changes over time; the price an order was sold at must not. It is a <b>different fact</b>, so it belongs on the order line.' }
  ],
  interview: [
    { q: 'Explain 1NF, 2NF and 3NF with one example.', a: '<p><b>1NF</b>: atomic values, no repeating groups (no “items” list column). <b>2NF</b>: no non-key column depends on part of a composite key (product_name on order_lines depends only on product_id). <b>3NF</b>: no non-key column depends on another non-key column (city depends on customer, not on order). BCNF tightens 3NF for overlapping candidate keys.</p>', lvl: 'core' },
    { q: 'When do you denormalize, and how do you keep it correct?', a: '<p>When a measured, hot read path pays for joins or aggregates on every request: counters, totals, “latest status”, search documents. Keep it correct with a single writer (same transaction), triggers, generated columns, or materialized views refreshed CONCURRENTLY. Then add reconciliation checks. For heavy analytics, a separate read model (CQRS, a warehouse) beats denormalizing OLTP.</p>', lvl: 'core' },
    { q: 'Soft deletes: pros, cons, and how to implement them properly.', a: '<p>Pros: undo, audit, and references keep working. Cons: every query must filter, uniqueness breaks, FK cascades don’t fire, tables bloat, and GDPR erasure still needs a hard delete. Implementation: <code>deleted_at timestamptz</code>, partial unique indexes, partial indexes for hot queries (<code>WHERE deleted_at IS NULL</code>), a default scope in the ORM, and a purge job. Often an archive table is cleaner.</p>', lvl: 'core' },
    { q: 'Compare multi-tenancy models in Postgres.', a: '<p>Shared tables + tenant_id (+ RLS): scales to many tenants, one migration, risk of leaks without RLS, noisy neighbours. Schema per tenant: namespace isolation, but catalog bloat and N migrations, so practical up to hundreds or low thousands. Database per tenant: strongest isolation and easy per-tenant restore, but N pools, N migrations, and expensive at scale. Hybrid: shared, with big tenants moved to their own partition or shard.</p>', fu: 'How do you pass the tenant to RLS through a connection pool? (set_config(\'app.tenant_id\', x, true) per transaction.)', lvl: 'deep' },
    { q: 'bigserial vs UUIDv4 vs UUIDv7 vs Snowflake?', a: '<p>bigint identity: 8 B, sequential, DB-generated, guessable. UUIDv4: 16 B, random, generated anywhere, bad index locality. UUIDv7: 16 B, time-ordered, generated anywhere, built in as <code>uuidv7()</code> from PG18; it leaks the creation time. Snowflake: 8 B, roughly time-ordered, app-generated, needs machine-id management. Prefer identity over <code>serial</code> (SQL standard, cleaner permissions).</p>', lvl: 'core' },
    { q: 'Postgres enum vs lookup table vs CHECK constraint?', a: '<p>Enum: compact, typed, ordered; adding values is easy, removing them is hard. Lookup table + FK: editable at runtime, can carry metadata, works across systems. CHECK on text: simple, and easy to change with <code>NOT VALID</code> + VALIDATE. Choose by who owns the list: the code (enum/CHECK) or the business (table).</p>', lvl: 'core' },
    { q: 'Which audit columns do you add, and how do you fill them?', a: '<p><code>created_at</code>/<code>updated_at timestamptz NOT NULL</code>, maybe <code>created_by</code>/<code>updated_by</code>. Fill updated_at with a trigger (<code>clock_timestamp()</code>) or JPA <code>@CreationTimestamp</code>/<code>@UpdateTimestamp</code> or Spring Data auditing. For full history, use a history table via triggers, temporal tables, or CDC (Debezium) instead of more columns.</p>', lvl: 'core' },
    { q: 'Natural keys vs surrogate keys?', a: '<p>Natural keys (email, ISBN) change and get reused, and wide keys get copied into every FK. Use a surrogate PK, and enforce the natural key with a UNIQUE constraint. Exceptions: small, stable code tables (ISO country codes) and join tables (composite PK of two FKs).</p>', lvl: 'core' },
    { q: 'How do you model a polymorphic association (comments on posts OR photos)?', a: '<p>Avoid <code>(commentable_type, commentable_id)</code>, because no FK is possible. Options: separate nullable FK columns plus <code>CHECK (num_nonnulls(post_id, photo_id) = 1)</code>, separate join tables, or a common supertype table that both reference.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'JPA: soft delete + auditing (Hibernate 6.3+)', lang: 'java', code: `@Entity
@SQLDelete(sql = "update users set deleted_at = now() where id = ?")
@SQLRestriction("deleted_at is null")              // Hibernate 6.3+, replaces @Where
@EntityListeners(AuditingEntityListener.class)
class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    String email;
    Instant deletedAt;
    @CreatedDate Instant createdAt;
    @LastModifiedDate Instant updatedAt;
}` , note: 'The partial unique index still has to be created in the migration. JPA can’t express it.' },
    { title: 'Tenant context per transaction for RLS', lang: 'java', code: `@Transactional
public List<Invoice> invoices() {
    jdbc.queryForObject("select set_config('app.tenant_id', ?, true)",
        String.class, TenantContext.current().toString());   // true = local to this tx
    return repo.findAll();                                   // RLS filters
}` , note: 'Transaction-local settings are safe with Hikari and with PgBouncer transaction mode. A plain <code>SET</code> would leak to the next borrower.' }
  ]
});

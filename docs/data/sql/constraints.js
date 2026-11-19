IA.register({
  track: 'sql',
  slug: 'constraints',
  title: 'Constraints',
  tagline: 'Constraints are rules the database enforces for <b>every</b> writer, every time, even under concurrency: PRIMARY KEY, UNIQUE, FOREIGN KEY, CHECK, NOT NULL and EXCLUDE. Your Java validation is a hint; constraints are the law.',
  tldr: {
    problem: 'Duplicate users from a double-click, orphaned order items, negative stock, double-booked rooms: all are race conditions or bypasses that application checks can’t stop.',
    model: 'Each constraint is checked when a row is written (or at statement end / COMMIT if deferred). UNIQUE, PK and EXCLUDE are backed by an index that also serializes concurrent inserts. FKs are system triggers that look up the other table.',
    hook: '“We check if the email exists before inserting. How did we get two?” Two requests checked at the same time. Only a UNIQUE index closes that race.',
    facts: [
      { v: 'no auto index', l: 'Postgres indexes the referenced key (PK/UNIQUE) but <b>not</b> the referencing FK column. Index it yourself' },
      { v: 'NOT VALID', l: 'adds a CHECK or FK without scanning old rows; <code>VALIDATE CONSTRAINT</code> later takes a weaker lock' },
      { v: 'EXCLUDE', l: 'generalizes UNIQUE to any operator: “no two bookings of the same room may overlap”' }
    ]
  },
  intro: {
    what: 'A <b>constraint</b> is a rule attached to a table. The database refuses any INSERT, UPDATE or DELETE that would break it, no matter which program sent it. Typical rules: each id is unique, every order points at a real customer, a price is never negative.',
    analogy: { icon: '🚧', title: 'Guard rails, not road signs', text: 'A road sign (validation in your app) asks drivers to behave. A guard rail (a constraint) physically stops the car, even a driver who never saw the sign: a script, a second service, or two requests at the same instant.' },
    steps: [
      { t: 'Identity: PRIMARY KEY and UNIQUE', d: 'No two rows with the same key.', code: 'CREATE TABLE users (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  email text NOT NULL UNIQUE\n);' },
      { t: 'Relationships: FOREIGN KEY', d: 'A child row must point at an existing parent. You choose what happens when the parent is deleted.', code: 'customer_id bigint NOT NULL REFERENCES customers(id) ON DELETE RESTRICT' },
      { t: 'Business rules: CHECK', d: 'Any boolean expression over the row.', code: 'price numeric(10,2) CHECK (price >= 0)' },
      { t: 'Try to break it', d: 'The database answers with an error and changes nothing.', code: "INSERT INTO users (email) VALUES ('a@x.io'), ('a@x.io');\n-- ERROR: duplicate key value violates unique constraint" }
    ],
    terms: [
      ['PRIMARY KEY', 'Unique + NOT NULL identifier of a row. One per table.'],
      ['UNIQUE', 'No duplicate values (NULLs excepted, unless NULLS NOT DISTINCT).'],
      ['FOREIGN KEY', 'Column(s) that must match a key in another table.'],
      ['CHECK', 'A condition each row must not violate.'],
      ['CASCADE', 'FK action: deleting a parent deletes its children.'],
      ['deferrable', 'A constraint checked at COMMIT instead of after each statement.']
    ]
  },
  visual: {
    title: 'What a DELETE does through foreign keys',
    caption: 'Choose the ON DELETE action for each foreign key, then press Play to delete one customer. CASCADE ripples down; RESTRICT and NO ACTION abort the whole statement.'
  },
  extras: [
    { id: 'constraints-exclusion', title: 'Exclusion constraint: no double booking', label: 'No overlap', caption: 'Pick a booking to insert. Same room + overlapping time range is rejected by the constraint, even under concurrency.' }
  ],
  playground: {
    setup: `
CREATE TABLE customers (id int PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL);
CREATE TABLE orders (id int PRIMARY KEY, customer_id int REFERENCES customers(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount > 0));
CREATE TABLE order_items (id int PRIMARY KEY, order_id int NOT NULL REFERENCES orders(id) ON DELETE CASCADE, sku text NOT NULL, qty int NOT NULL CHECK (qty > 0));
CREATE INDEX ON orders (customer_id); CREATE INDEX ON order_items (order_id);
INSERT INTO customers VALUES (1,'asha@x.io','Asha'),(2,'ben@x.io','Ben'),(3,'chen@x.io','Chen');
INSERT INTO orders VALUES (101,1,250),(102,1,80),(103,2,40),(104,3,99);
INSERT INTO order_items VALUES (1,101,'TEA',2),(2,101,'MUG',1),(3,102,'POT',1),(4,103,'TEA',1),(5,104,'CUP',4);
CREATE TABLE seats (id int PRIMARY KEY, pos int UNIQUE DEFERRABLE INITIALLY DEFERRED);
INSERT INTO seats VALUES (1,1),(2,2),(3,3);
-- browser build has no btree_gist, so room equality uses a one-element int range
CREATE TABLE bookings (id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY, room int NOT NULL, during tstzrange NOT NULL,
  EXCLUDE USING gist (int4range(room, room, '[]') WITH =, during WITH &&));
INSERT INTO bookings (room, during) VALUES (1,'[2026-03-02 09:00Z,2026-03-02 10:30Z)'),(2,'[2026-03-02 10:00Z,2026-03-02 12:00Z)');`,
    presets: [
      { label: 'CASCADE ripple', sql: `DELETE FROM customers WHERE id = 1;\nSELECT (SELECT count(*) FROM orders) AS orders_left, (SELECT count(*) FROM order_items) AS items_left;`, note: 'One DELETE removed 1 customer, 2 orders and 3 items.' },
      { label: 'CHECK + NOT VALID', sql: `-- legacy rows break the new rule\nALTER TABLE order_items DROP CONSTRAINT order_items_qty_check;\nUPDATE order_items SET qty = 0 WHERE id = 5;\nALTER TABLE order_items ADD CONSTRAINT qty_max CHECK (qty BETWEEN 1 AND 100) NOT VALID;   -- ok: old rows not checked\nINSERT INTO order_items VALUES (6, 103, 'MUG', 0);                                       -- rejected: new rows are`, note: 'NOT VALID enforces the rule for new writes immediately. Fix the old row, then run <code>ALTER TABLE order_items VALIDATE CONSTRAINT qty_max;</code>' },
      { label: 'Deferred UNIQUE swap', sql: `BEGIN;\nUPDATE seats SET pos = pos + 1;          -- 1→2 collides mid-statement if not deferrable\nUPDATE seats SET pos = 1 WHERE id = 3;   -- wrap the last one around\nCOMMIT;\nSELECT * FROM seats ORDER BY id;`, note: 'The unique check waits until COMMIT, so temporary duplicates are allowed inside the transaction.' },
      { label: 'Immediate UNIQUE', sql: `CREATE TABLE seats2 (id int PRIMARY KEY, pos int UNIQUE);\nINSERT INTO seats2 VALUES (1,1),(2,2),(3,3);\nUPDATE seats2 SET pos = 4 - pos;    -- reversing order: 1↔3`, note: 'Non-deferrable UNIQUE is checked row by row, so a swap can fail depending on the order rows are updated. Make it DEFERRABLE.' },
      { label: 'Exclusion: overlap', sql: `INSERT INTO bookings (room, during) VALUES (1, '[2026-03-02 10:30Z, 2026-03-02 11:00Z)');  -- touches: ok\nINSERT INTO bookings (room, during) VALUES (2, '[2026-03-02 11:30Z, 2026-03-02 13:00Z)');  -- overlaps: error`, note: 'Half-open ranges <code>[)</code> make back-to-back bookings legal.' },
      { label: 'Find unindexed FKs', sql: `SELECT c.conrelid::regclass AS tbl, a.attname AS fk_col,\n       EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1]) AS has_index\nFROM pg_constraint c\nJOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]\nWHERE c.contype = 'f' ORDER BY 1;`, note: 'Checks only the first FK column, which is enough for single-column FKs.' }
    ]
  },
  gotchas: [
    { trap: 'Foreign key columns are not indexed automatically', code: `DELETE FROM customers WHERE id = 1;   -- seq scan of orders for EVERY deleted customer`, why: 'Each parent delete/key update runs a lookup on the child table. Without an index that is a sequential scan, under a lock, per row.', fix: '<code>CREATE INDEX CONCURRENTLY ON orders (customer_id);</code> for every FK whose parent rows are deleted or updated.' },
    { trap: 'CASCADE deletes far more than you think', why: 'Chains of ON DELETE CASCADE can wipe whole subtrees (customer → orders → items → shipments → events) from one statement, with long locks and huge WAL.', fix: 'Use CASCADE for true ownership (order → order_items). Use RESTRICT for references to things with their own lifecycle; soft-delete parents that have history.' },
    { trap: 'Adding a constraint locks and scans the table', code: `ALTER TABLE orders ADD CONSTRAINT amount_pos CHECK (amount > 0);   -- full scan under ACCESS EXCLUSIVE`, why: 'Validating existing rows takes as long as a full scan, while writes (and for CHECK, reads) are blocked.', fix: 'Two steps: <code>ADD CONSTRAINT … NOT VALID</code> (instant), then <code>VALIDATE CONSTRAINT</code>, which takes only SHARE UPDATE EXCLUSIVE (plus ROW SHARE on the referenced table for an FK) and doesn’t block normal reads or writes. Set a <code>lock_timeout</code> on the first step.' },
    { trap: 'UNIQUE is checked per row, not per statement', code: `UPDATE seats SET pos = pos + 1;   -- may fail on a temporary duplicate`, why: 'Non-deferrable unique constraints are checked immediately as each row is updated, so the result depends on the physical update order.', fix: 'Declare <code>DEFERRABLE</code> (optionally <code>INITIALLY DEFERRED</code>), or use <code>SET CONSTRAINTS … DEFERRED</code> in the transaction. Deferrable unique constraints can’t be used as ON CONFLICT arbiters.' },
    { trap: 'CHECK can’t look at other rows or tables', code: `CHECK (amount <= (SELECT credit FROM customers ...))   -- not allowed`, why: 'CHECK expressions must be immutable conditions on the current row. Subqueries aren’t allowed, and hiding one in a function makes the constraint lie when the other table changes.', fix: 'Use a FK, an exclusion constraint, a trigger with proper locking, or SERIALIZABLE transactions.' },
    { trap: 'RESTRICT vs NO ACTION are almost the same', why: 'Both fail if children exist. NO ACTION (the default) checks at the end of the statement and can be deferred to COMMIT; RESTRICT checks immediately and can’t be deferred.', fix: 'Keep NO ACTION unless you specifically want no deferral. Know which one your ORM generates.' },
    { trap: 'Exclusion with “=” needs btree_gist', why: 'GiST has no built-in operator class for <code>int = int</code> or <code>text = text</code>.', fix: '<code>CREATE EXTENSION btree_gist;</code> then <code>EXCLUDE USING gist (room_id WITH =, during WITH &amp;&amp;)</code>.' }
  ],
  scenarios: [
    { title: 'Deleting one tenant took the site down for 6 minutes',
      symptom: 'A support script deleted one tenant; every request touching orders blocked, then timed out.',
      diagnose: `SELECT relname, seq_scan, idx_scan FROM pg_stat_user_tables WHERE relname IN ('orders','order_items');\n-- seq_scan jumps during the delete`,
      cause: 'ON DELETE CASCADE chain through tables whose FK columns had no indexes: each deleted parent triggered a full scan of the child, while holding row locks.',
      fix: 'Index all FK columns, delete in batches, and prefer soft deletes for tenants.',
      fixCode: `CREATE INDEX CONCURRENTLY ON orders (tenant_id);\nCREATE INDEX CONCURRENTLY ON order_items (order_id);` },
    { title: 'Migration blocked all writes during deploy',
      symptom: '<code>ALTER TABLE payments ADD CONSTRAINT … FOREIGN KEY</code> queued behind a long transaction, and every query queued behind it.',
      diagnose: `SELECT pid, wait_event_type, wait_event, left(query,60)\nFROM pg_stat_activity WHERE wait_event_type = 'Lock';`,
      cause: 'Adding a validated FK scans the table under a lock that blocks writes; waiting for that lock also blocks everyone behind it in the lock queue.',
      fix: 'Short lock_timeout + NOT VALID, then VALIDATE separately.',
      fixCode: `SET lock_timeout = '3s';\nALTER TABLE payments ADD CONSTRAINT payments_order_fk\n  FOREIGN KEY (order_id) REFERENCES orders(id) NOT VALID;\nALTER TABLE payments VALIDATE CONSTRAINT payments_order_fk;` },
    { title: 'Two guests booked the same room',
      symptom: 'Overlapping bookings exist though the service checks availability first.',
      diagnose: `SELECT a.id, b.id FROM bookings a JOIN bookings b\n  ON a.room = b.room AND a.id < b.id AND a.during && b.during;`,
      cause: 'Check-then-insert race: both transactions saw the room free under READ COMMITTED, then both inserted.',
      fix: 'An exclusion constraint makes the database reject the second insert atomically. Catch SQLSTATE 23P01 and show “just taken”.',
      fixCode: `CREATE EXTENSION IF NOT EXISTS btree_gist;\nALTER TABLE bookings ADD CONSTRAINT no_overlap\n  EXCLUDE USING gist (room WITH =, during WITH &&);` }
  ],
  puzzles: [
    { kind: 'predict', q: 'How many order_items are left?', code: `DELETE FROM customers WHERE id = 1;\nSELECT count(*) FROM order_items;`, options: ['5', '3', '2', 'error'], answer: 2, explain: 'Customer 1 → orders 101, 102 → items 1, 2, 3 cascade away. 5 − 3 = <b>2</b>.' },
    { kind: 'predict', q: 'What happens?', code: `INSERT INTO orders VALUES (105, 99, 10);`, options: ['inserted', 'FK violation', 'CHECK violation', 'NOT NULL violation'], answer: 1, explain: 'Customer 99 doesn’t exist.' },
    { kind: 'predict', q: 'What happens?', code: `INSERT INTO orders VALUES (105, NULL, 10);\nSELECT count(*) FROM orders;`, options: ['FK violation', '5', '4', 'NOT NULL violation'], answer: 1, explain: 'A NULL foreign key isn’t checked (MATCH SIMPLE). customer_id has no NOT NULL, so the row is accepted: <b>5</b>.' },
    { kind: 'predict', q: 'Does the CHECK accept a NULL qty?', code: `ALTER TABLE order_items ALTER COLUMN qty DROP NOT NULL;\nINSERT INTO order_items VALUES (6, 103, 'MUG', NULL);\nSELECT count(*) FROM order_items;`, options: ['CHECK violation', '6', '5', 'FK violation'], answer: 1, explain: '<code>NULL &gt; 0</code> is UNKNOWN, and CHECK only rejects FALSE. Accepted: <b>6</b>.' },
    { kind: 'predict', q: 'After this transaction, what is seat 3’s pos?', code: `BEGIN;\nUPDATE seats SET pos = pos + 1;\nUPDATE seats SET pos = 1 WHERE id = 3;\nCOMMIT;\nSELECT pos FROM seats WHERE id = 3;`, options: ['1', '3', '4', 'error: duplicate key'], answer: 0, explain: 'The constraint is INITIALLY DEFERRED, so the temporary duplicate is fine; at COMMIT positions are 2, 3, 1. Seat 3 → <b>1</b>.' },
    { kind: 'predict', q: 'How many rows does bookings hold after this?', code: `INSERT INTO bookings (room, during) VALUES (1, '[2026-03-02 10:30Z, 2026-03-02 11:00Z)');\nINSERT INTO bookings (room, during) VALUES (2, '[2026-03-02 08:00Z, 2026-03-02 10:00Z)');\nSELECT count(*) FROM bookings;`, options: ['2', '3', '4', 'error'], answer: 2, explain: 'Room 1 10:30 touches 09:00–10:30 but doesn’t overlap (half-open). Room 2 ends at 10:00 exactly where the workshop starts. Both accepted: <b>4</b>.' }
  ],
  interview: [
    { q: 'Why enforce uniqueness in the database rather than checking in the service?', a: '<p>Check-then-insert races: two transactions both see “no row” and both insert. A unique index makes the second insert wait for the first and then fail (or succeed if the first rolled back). It also protects against other writers. Use <code>INSERT … ON CONFLICT</code> for idempotent writes.</p>', lvl: 'core' },
    { q: 'Explain the FK ON DELETE options.', a: '<p>NO ACTION (default): error if children exist, checked at statement end, deferrable. RESTRICT: same but immediate, not deferrable. CASCADE: delete children. SET NULL / SET DEFAULT: rewrite the FK column. PG15+ lets SET NULL/SET DEFAULT target only some columns of a composite FK.</p>', lvl: 'core' },
    { q: 'How are foreign keys implemented in Postgres, and what does that cost?', a: '<p>As internal constraint triggers. Inserting a child runs a lookup on the parent’s unique index and takes a <code>FOR KEY SHARE</code> lock on the parent row. Deleting or updating a parent key looks up children: without an index on the FK column that is a seq scan per row.</p>', fu: 'Why FOR KEY SHARE and not FOR SHARE? (So non-key updates to the parent aren’t blocked.)', lvl: 'deep' },
    { q: 'How do you add a constraint to a 500 GB table without downtime?', a: '<p><code>SET lock_timeout</code>; <code>ADD CONSTRAINT … NOT VALID</code> (brief ACCESS EXCLUSIVE for CHECK, SHARE ROW EXCLUSIVE for FK, no scan); then <code>VALIDATE CONSTRAINT</code>, which scans with a lock that allows reads and writes. For UNIQUE: <code>CREATE UNIQUE INDEX CONCURRENTLY</code>, then <code>ADD CONSTRAINT … UNIQUE USING INDEX</code>.</p>', fu: 'And NOT NULL? (PG12+: if a validated <code>CHECK (col IS NOT NULL)</code> exists, SET NOT NULL skips the scan; PG18 adds NOT VALID for NOT NULL.)', lvl: 'deep' },
    { q: 'What is a deferrable constraint and when do you need one?', a: '<p>A constraint checked at COMMIT (if INITIALLY DEFERRED or after <code>SET CONSTRAINTS … DEFERRED</code>). Needed for swaps and reorders under UNIQUE, or for cyclic FKs where both rows are inserted in one transaction. Cost: deferrable unique indexes can’t be ON CONFLICT arbiters, and the planner can’t rely on them for some optimizations.</p>', lvl: 'deep' },
    { q: 'What is an exclusion constraint? Give a real example.', a: '<p>A generalization of UNIQUE: no two rows may satisfy all the given operator comparisons. Classic: <code>EXCLUDE USING gist (room_id WITH =, during WITH &amp;&amp;)</code> forbids overlapping bookings of a room. It is backed by a GiST (or SP-GiST) index and is race-safe.</p>', lvl: 'core' },
    { q: 'Can a CHECK constraint reference another table?', a: '<p>No subqueries. Wrapping one in a function is allowed syntactically but wrong: the constraint is only checked when this row changes, so it silently goes stale and pg_dump restores can fail. Use FKs, triggers with locking, or exclusion constraints.</p>', lvl: 'core' },
    { q: 'How should the application handle constraint violations?', a: '<p>Map SQLSTATE codes: 23505 unique_violation → 409 Conflict; 23503 foreign_key_violation → 422/409; 23514 check_violation → 422; 23P01 exclusion_violation → 409. Use the constraint name to produce a precise message. Don’t retry them blindly; they are not transient.</p>', lvl: 'core' },
    { q: 'Does a primary key have to be a surrogate id?', a: '<p>No. Natural keys (ISO codes, composite (order_id, line_no)) are fine when stable. Surrogate bigint/UUID keys are common for entities whose natural attributes can change; then add UNIQUE constraints on the natural key too.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Translate constraint violations in Spring', lang: 'java', code: `try {
  userRepo.saveAndFlush(user);             // flush so the INSERT runs here, not at commit
} catch (DataIntegrityViolationException e) {
  if (e.getMostSpecificCause() instanceof PSQLException p
      && "23505".equals(p.getSQLState())
      && "users_email_key".equals(p.getServerErrorMessage().getConstraint())) {
    throw new EmailTakenException(user.getEmail());
  }
  throw e;
}` , note: 'Bean Validation <code>@Email @NotNull</code> gives friendly early errors; the UNIQUE constraint is what actually prevents duplicates.' },
    { title: 'JPA cascade ≠ database cascade', lang: 'java', code: `@OneToMany(mappedBy = "order", cascade = CascadeType.REMOVE)   // Hibernate loads and deletes each child: N statements
List<OrderItem> items;

@OnDelete(action = OnDeleteAction.CASCADE)   // Hibernate: generate ON DELETE CASCADE in DDL, one statement in the DB
@ManyToOne(fetch = FetchType.LAZY) Order order;` }
  ]
});

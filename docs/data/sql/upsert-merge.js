IA.register({
  track: 'sql',
  slug: 'upsert-merge',
  title: 'Upsert: ON CONFLICT and MERGE',
  tagline: '<code>INSERT … ON CONFLICT</code> is an <b>atomic insert-or-update guarded by a unique index</b>. <code>MERGE</code> looks similar but decides from its snapshot, so under concurrency it can still throw duplicate-key errors.',
  tldr: {
    problem: '“Check if it exists, then insert or update” in application code is a race: two requests both see “not there” and both insert. One fails or, without a constraint, you get duplicates.',
    model: 'ON CONFLICT does a <b>speculative insert</b>: it probes the unique index, inserts, and if a concurrent inserter wins it <b>waits, then takes the conflict path</b> (update or skip). The unique index is the referee.',
    hook: '“Why does <code>ON CONFLICT DO NOTHING RETURNING id</code> sometimes return nothing?” Because nothing was inserted, so there is no row to return.',
    facts: [
      { v: '1 index', l: 'ON CONFLICT needs a unique index or constraint that matches the conflict target exactly (columns, and the WHERE of a partial index)' },
      { v: 'PG15', l: '<code>MERGE</code> arrived. PG17 added <code>RETURNING</code> with <code>merge_action()</code> and <code>WHEN NOT MATCHED BY SOURCE</code>' },
      { v: 'gaps', l: 'every attempted insert calls <code>nextval()</code> first, so conflicts burn sequence values' }
    ]
  },
  intro: {
    what: 'Often you want “save this row: add it if it is new, change it if it already exists”. That is called an <b>upsert</b> (update + insert). Postgres does it in <b>one statement</b> so two users clicking at the same time can’t create two copies.',
    analogy: { icon: '🎟️', title: 'A cloakroom with numbered hooks', text: 'Each coat goes on the hook with its ticket number. If the hook is empty you hang the coat (insert). If a coat is already there you swap it or leave it (update / do nothing). Two attendants can’t hang different coats on hook 7 at once: the hook itself is the rule. In Postgres the hook is the <b>unique index</b>.' },
    steps: [
      { t: 'The naive way races', d: 'SELECT, then INSERT if missing. Between those two statements another request can insert the same key.' },
      { t: 'Declare what “the same” means', d: 'A unique index (or PRIMARY KEY / UNIQUE constraint) defines a duplicate.', code: 'CREATE UNIQUE INDEX ON counters (key);' },
      { t: 'Upsert in one statement', d: '<code>EXCLUDED</code> is the row you tried to insert.', code: 'INSERT INTO counters (key, hits) VALUES (\'home\', 1)\nON CONFLICT (key)\nDO UPDATE SET hits = counters.hits + EXCLUDED.hits;' },
      { t: 'Or just skip duplicates', d: '<code>DO NOTHING</code> ignores the conflicting row. Good for idempotent event ingestion.', code: 'INSERT INTO events (id, payload) VALUES ($1, $2)\nON CONFLICT (id) DO NOTHING;' }
    ],
    terms: [
      ['upsert', 'Insert a row, or update it if a row with the same key already exists.'],
      ['unique index', 'An index that refuses two rows with the same key value. It is what defines a “conflict”.'],
      ['conflict target', 'The <code>(columns)</code> or <code>ON CONSTRAINT name</code> after ON CONFLICT: which uniqueness rule to arbitrate on.'],
      ['EXCLUDED', 'A pseudo-table holding the row that was proposed for insertion.'],
      ['MERGE', 'SQL-standard statement (PG15+) that joins a source to a target and runs WHEN MATCHED / NOT MATCHED actions.']
    ]
  },
  visual: {
    title: 'Two requests upsert the same key at the same instant',
    caption: 'Pick the statement and whether the key already exists, then press Play. Watch who waits on whom, what the second session ends up doing, and how many sequence values get burned.'
  },
  playground: {
    setup: `
CREATE TABLE counters (key text PRIMARY KEY, hits int NOT NULL DEFAULT 0);
CREATE TABLE users (id bigserial PRIMARY KEY, email text NOT NULL UNIQUE, name text);
CREATE TABLE inventory (sku text PRIMARY KEY, qty int NOT NULL, price numeric(10,2));
INSERT INTO counters VALUES ('home', 5);
INSERT INTO users (email, name) VALUES ('a@x.io', 'Asha'), ('b@x.io', 'Ben');
INSERT INTO inventory VALUES ('A1', 10, 9.99), ('B2', 0, 4.50);`,
    presets: [
      { label: 'DO UPDATE + EXCLUDED', sql: `INSERT INTO counters (key, hits) VALUES ('home', 1), ('about', 1)
ON CONFLICT (key) DO UPDATE SET hits = counters.hits + EXCLUDED.hits
RETURNING key, hits, (xmax = 0) AS inserted;`, note: '<code>xmax = 0</code> is a well-known (unofficial) trick: a freshly inserted row has no xmax, an updated one carries the locking xid. Use it for metrics, not business logic.' },
      { label: 'DO NOTHING + RETURNING', sql: `-- duplicate: returns 0 rows, not the existing id
INSERT INTO users (email, name) VALUES ('a@x.io', 'Dup')
ON CONFLICT (email) DO NOTHING RETURNING id;

-- get-or-create in one round trip
WITH ins AS (
  INSERT INTO users (email, name) VALUES ('a@x.io', 'Dup')
  ON CONFLICT (email) DO NOTHING RETURNING id
)
SELECT id FROM ins
UNION ALL
SELECT id FROM users WHERE email = 'a@x.io' AND NOT EXISTS (SELECT 1 FROM ins);`, note: 'The CTE version still has a tiny race (a concurrent delete between the two). Many teams use <code>DO UPDATE SET email = EXCLUDED.email</code> to always get a row back, at the cost of a dead tuple per call.' },
      { label: 'DO UPDATE … WHERE', sql: `-- skip no-op writes: no new tuple version, no WAL, no trigger
INSERT INTO users (email, name) VALUES ('a@x.io', 'Asha'), ('b@x.io', 'Benjamin')
ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
WHERE users.name IS DISTINCT FROM EXCLUDED.name
RETURNING email, name;`, note: 'Only Ben comes back. Asha’s row matched the conflict but failed the WHERE, so it was locked but not updated.' },
      { label: 'Sequence gaps', sql: `DELETE FROM users WHERE email = 'c@x.io';   -- re-runnable
INSERT INTO users (email) VALUES ('a@x.io') ON CONFLICT DO NOTHING;
INSERT INTO users (email) VALUES ('b@x.io') ON CONFLICT DO NOTHING;
INSERT INTO users (email) VALUES ('c@x.io') RETURNING id;   -- 5, not 3
SELECT id, email FROM users ORDER BY id;`, note: 'On a fresh DB: two skipped inserts still consumed ids 3 and 4. Gaps are normal and harmless; never rely on ids being dense.' },
      { label: 'MERGE … RETURNING (PG17)', sql: `MERGE INTO inventory i
USING (VALUES ('A1', 5), ('C3', 7)) AS s(sku, qty)
ON i.sku = s.sku
WHEN MATCHED THEN UPDATE SET qty = i.qty + s.qty
WHEN NOT MATCHED THEN INSERT (sku, qty, price) VALUES (s.sku, s.qty, 0)
RETURNING merge_action(), i.*;`, note: '<code>merge_action()</code> tells you INSERT / UPDATE / DELETE per row. MERGE can also DELETE, which ON CONFLICT cannot.' },
      { label: 'Error cases', sql: `-- same key twice in one statement
INSERT INTO counters (key, hits) VALUES ('x', 1), ('x', 2)
ON CONFLICT (key) DO UPDATE SET hits = EXCLUDED.hits;`, note: 'ERROR: ON CONFLICT DO UPDATE command cannot affect row a second time. De-duplicate the input first (DISTINCT ON). A conflict target with no matching unique index fails too: “there is no unique or exclusion constraint matching the ON CONFLICT specification”.' }
    ]
  },
  gotchas: [
    { trap: 'No matching unique index', code: `INSERT INTO users (email) VALUES ('a@x.io')\nON CONFLICT (lower(email)) DO NOTHING;   -- ERROR unless that exact unique index exists`, why: 'The conflict target is matched against existing unique indexes (inference). Expression, columns and partial-index predicate must all match.', fix: 'Create the index first: <code>CREATE UNIQUE INDEX ON users (lower(email))</code>. For partial indexes add the predicate: <code>ON CONFLICT (sku) WHERE active</code>.' },
    { trap: 'RETURNING with DO NOTHING returns no row', why: 'Skipped rows are not returned. ORMs that expect “one id back” get null or an exception.', fix: 'Use the CTE get-or-create, or <code>DO UPDATE SET col = EXCLUDED.col</code> (always returns the row, but writes a new tuple version).' },
    { trap: 'MERGE is not a race-free upsert', code: `MERGE INTO t USING src ON t.k = src.k\nWHEN NOT MATCHED THEN INSERT …   -- concurrent run → 23505`, why: 'MERGE decides MATCHED / NOT MATCHED from its snapshot. If another transaction inserts the same key meanwhile, the INSERT hits the unique index and raises an error. It does not switch to the MATCHED branch.', fix: 'For single-row “insert or update” under concurrency, use ON CONFLICT. Use MERGE for batch sync where you can retry, or serialize with an advisory lock.' },
    { trap: 'Same key twice in one batch', why: 'DO UPDATE refuses to update a row it inserted or updated in the same statement: “cannot affect row a second time”.', fix: 'De-duplicate the batch: <code>SELECT DISTINCT ON (key) … ORDER BY key, ts DESC</code> before inserting.' },
    { trap: 'No-op updates still cost', why: 'DO UPDATE writes a new tuple version even if values are identical: WAL, bloat, index updates (unless HOT), and triggers fire.', fix: 'Add <code>WHERE t.col IS DISTINCT FROM EXCLUDED.col</code>.' },
    { trap: 'Only one conflict target', why: 'ON CONFLICT arbitrates on one unique index. A violation of a <i>different</i> unique index (e.g. username while you targeted email) still raises an error.', fix: 'Design one natural key per upsert path. <code>ON CONFLICT DO NOTHING</code> without a target covers all unique indexes, but only for DO NOTHING.' },
    { trap: 'Deadlocks in multi-row upserts', why: 'Two batches upserting the same keys in different orders lock rows in different orders.', fix: 'Sort the batch by the conflict key before sending it.' }
  ],
  scenarios: [
    { title: 'Black Friday: 0.3% of add-to-cart calls fail with 23505',
      symptom: 'The cart service uses MERGE to “add or increment” a cart line. Under load, a small fraction of requests fail with <code>duplicate key value violates unique constraint "cart_lines_pkey"</code>.',
      diagnose: `SELECT query, calls FROM pg_stat_statements WHERE query ILIKE 'merge into cart_lines%';\n-- app logs: SQLState 23505 only on double-clicks / retries`,
      cause: 'Two requests for the same (cart, sku) both evaluate NOT MATCHED from their snapshots. The second INSERT waits on the first, then fails on the unique index. MERGE does not re-evaluate.',
      fix: 'Switch the single-row path to ON CONFLICT, which waits and then takes the update path.',
      fixCode: `INSERT INTO cart_lines (cart_id, sku, qty) VALUES ($1, $2, $3)\nON CONFLICT (cart_id, sku)\nDO UPDATE SET qty = cart_lines.qty + EXCLUDED.qty;` },
    { title: 'Order ids jumped from 1.2M to 9.8M in a week',
      symptom: 'Support tickets reference “order #9,8xx,xxx”. Finance asks whether 8M orders were lost.',
      diagnose: `SELECT last_value FROM orders_id_seq;\nSELECT count(*), max(id) FROM orders;   -- count far below max`,
      cause: 'An idempotent ingestion job re-sends every event with <code>ON CONFLICT DO NOTHING</code>. Each attempt evaluates the <code>DEFAULT nextval()</code> before the conflict check, so every duplicate burns an id.',
      fix: 'Accept gaps (they are normal), or filter known keys first, or use a natural/UUID key for the idempotency table. Check that <code>int4</code> ids won’t overflow: switch to bigint early.',
      fixCode: `INSERT INTO orders (ext_id, …)\nSELECT $1, … WHERE NOT EXISTS (SELECT 1 FROM orders WHERE ext_id = $1)\nON CONFLICT (ext_id) DO NOTHING;   -- cheap pre-check, ON CONFLICT still guards the race` },
    { title: 'Nightly sync bloats a 40 GB table to 110 GB',
      symptom: 'A product-catalog sync upserts all 30M rows every night. Disk grows; autovacuum runs constantly.',
      diagnose: `SELECT n_tup_upd, n_tup_hot_upd, n_dead_tup FROM pg_stat_user_tables WHERE relname = 'products';`,
      cause: '<code>DO UPDATE</code> without a WHERE rewrites every row, even unchanged ones. 30M dead tuples per night, mostly non-HOT because an indexed column is in the SET list.',
      fix: 'Only update changed rows.',
      fixCode: `ON CONFLICT (sku) DO UPDATE SET price = EXCLUDED.price, name = EXCLUDED.name\nWHERE (products.price, products.name) IS DISTINCT FROM (EXCLUDED.price, EXCLUDED.name);` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Email a@x.io already exists. How many rows come back?', code: `INSERT INTO users (email, name) VALUES ('a@x.io', 'X')\nON CONFLICT (email) DO NOTHING RETURNING id;`, options: ['0', '1 (id 1)', '1 (new id 3)', 'Error'], answer: 0, explain: 'DO NOTHING skipped the row, so RETURNING has nothing to return: <b>0 rows</b>.' },
    { kind: 'predict', q: 'counters has (home, 5). What does this return?', code: `INSERT INTO counters (key, hits) VALUES ('home', 1)\nON CONFLICT (key) DO UPDATE SET hits = EXCLUDED.hits + 1\nRETURNING hits;`, options: ['7', '6', '2', '1'], answer: 2, explain: '<code>EXCLUDED.hits</code> is the proposed value (1), not the stored one. 1 + 1 = <b>2</b>. To increment you need <code>counters.hits + EXCLUDED.hits</code>.' },
    { kind: 'predict', q: 'What happens?', code: `INSERT INTO counters (key, hits) VALUES ('x', 1), ('x', 2)\nON CONFLICT (key) DO UPDATE SET hits = EXCLUDED.hits\nRETURNING *;`, options: ['1 row, hits 2', '2 rows', '1 row, hits 1', 'Error'], answer: 3, explain: '“ON CONFLICT DO UPDATE command cannot affect row a second time”. The second ‘x’ would update the row the first just inserted.' },
    { kind: 'predict', q: 'users has ids 1, 2 (bigserial). What id does c@x.io get?', code: `INSERT INTO users (email) VALUES ('a@x.io') ON CONFLICT DO NOTHING;\nINSERT INTO users (email) VALUES ('c@x.io') RETURNING id;`, options: ['3', '4', '5', 'Error'], answer: 1, explain: 'The skipped insert still evaluated <code>nextval()</code> and burned id 3, so c@x.io gets <b>4</b>.' },
    { kind: 'predict', q: 'PG17. Which actions does RETURNING report, in order?', code: `MERGE INTO inventory i\nUSING (VALUES ('B2', 3), ('Z9', 1)) s(sku, qty) ON i.sku = s.sku\nWHEN MATCHED AND i.qty = 0 THEN DELETE\nWHEN MATCHED THEN UPDATE SET qty = i.qty + s.qty\nWHEN NOT MATCHED THEN INSERT (sku, qty) VALUES (s.sku, s.qty)\nRETURNING merge_action(), s.sku;`, options: ['UPDATE, INSERT', 'DELETE, INSERT', 'INSERT only', 'Error: DELETE not allowed'], answer: 1, explain: 'B2 has qty 0, so the first matching WHEN clause (DELETE) wins. Z9 is not matched: INSERT. WHEN clauses are tried in order; the first one that passes is used.' },
    { kind: 'concept', q: 'Two sessions run the same MERGE … WHEN NOT MATCHED THEN INSERT for a new key at the same time (READ COMMITTED). What does the second one get?', options: ['It updates the row instead', 'It silently skips', 'A unique-violation error', 'A serialization failure only in SERIALIZABLE'], answer: 2, explain: 'It waits for the first to commit, then its INSERT fails on the unique index (23505). ON CONFLICT would have taken the update path.' }
  ],
  interview: [
    { q: 'How does INSERT … ON CONFLICT stay correct under concurrency?', a: '<p>It uses <b>speculative insertion</b>: probe the unique index for a conflict; if none, insert the heap tuple and index entry marked with a speculative token. If a concurrent inserter is found in progress, wait for it. If a conflict appears, the speculative insert is “killed” and the statement takes the DO UPDATE / DO NOTHING path. The update locks the conflicting row first, so it always operates on the latest committed version, even in READ COMMITTED.</p>', fu: 'Can it still deadlock? (Yes, multi-row batches in different key orders.)', lvl: 'deep' },
    { q: 'What is EXCLUDED, and how do you reference the existing row?', a: '<p><code>EXCLUDED</code> is the proposed row (after BEFORE INSERT triggers). The existing row is referenced by the table name or alias: <code>SET hits = t.hits + EXCLUDED.hits</code>.</p>', lvl: 'core' },
    { q: 'Why is MERGE not a drop-in replacement for ON CONFLICT?', a: '<p>MERGE joins source to target using its snapshot and picks a branch per row. In READ COMMITTED, a concurrently inserted target row is invisible, so NOT MATCHED → INSERT → unique violation. For concurrent <i>updates</i> of matched rows it does re-check (EvalPlanQual) on the new version. Use MERGE for multi-action batch sync (insert, update, delete in one pass) where errors can be retried.</p>', fu: 'What changed in PG17? (RETURNING with merge_action(), WHEN NOT MATCHED BY SOURCE, MERGE on updatable views.)', lvl: 'deep' },
    { q: 'Why do upserts leave gaps in sequences?', a: '<p>Column defaults, including <code>nextval()</code>, are evaluated when the candidate row is built, before the conflict check. Sequences are non-transactional, so the value is never returned. Gaps also come from rollbacks and the sequence cache.</p>', lvl: 'core' },
    { q: 'You need “get or create” that returns the id. Options?', a: '<p>(1) CTE: INSERT … DO NOTHING RETURNING id, UNION ALL SELECT existing. (2) <code>DO UPDATE SET k = EXCLUDED.k RETURNING id</code>: always returns, but writes a dead tuple each call. (3) SELECT first, then upsert on a miss: fastest in read-heavy paths.</p>', lvl: 'core' },
    { q: 'How do you upsert against a partial unique index?', a: '<p>Repeat the predicate in the conflict target so inference matches it: <code>ON CONFLICT (sku) WHERE active DO UPDATE …</code>. <code>ON CONFLICT ON CONSTRAINT</code> only works for constraints, and a partial unique index can’t be a constraint.</p>', lvl: 'deep' },
    { q: 'Does ON CONFLICT DO UPDATE fire triggers?', a: '<p>BEFORE INSERT triggers always fire (they shape EXCLUDED). If the conflict path runs, BEFORE/AFTER UPDATE triggers fire for that row; otherwise AFTER INSERT fires. Statement-level INSERT and UPDATE triggers both fire.</p>', lvl: 'deep' },
    { q: 'How do you bulk upsert 1M rows efficiently?', a: '<p>COPY into an unlogged/temp staging table, de-duplicate (DISTINCT ON), then a single <code>INSERT … SELECT … ORDER BY key ON CONFLICT … WHERE IS DISTINCT FROM</code>, in chunks of 10–50k to limit lock time and WAL bursts.</p>', lvl: 'core' },
    { q: 'Does an upsert that takes the DO NOTHING path lock anything?', a: '<p>It waits for in-progress conflicting inserters, but takes no row lock on the existing row. DO UPDATE takes a row lock (like SELECT FOR UPDATE), even when its WHERE then skips the update.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Spring JDBC upsert', lang: 'java', code: `@Repository
class CounterRepo {
  private final JdbcTemplate jdbc;
  CounterRepo(JdbcTemplate jdbc) { this.jdbc = jdbc; }

  int increment(String key, int by) {
    return jdbc.queryForObject("""
        INSERT INTO counters (key, hits) VALUES (?, ?)
        ON CONFLICT (key) DO UPDATE SET hits = counters.hits + EXCLUDED.hits
        RETURNING hits""", Integer.class, key, by);
  }
}`, note: 'JPA <code>save()</code> does SELECT-then-INSERT/UPDATE (a race). Use a native query for real upserts.' },
    { title: 'JPA native upsert, batch-sorted', lang: 'java', code: `@Modifying
@Query(value = """
    INSERT INTO cart_lines (cart_id, sku, qty) VALUES (:cart, :sku, :qty)
    ON CONFLICT (cart_id, sku) DO UPDATE SET qty = cart_lines.qty + EXCLUDED.qty
    """, nativeQuery = true)
void addLine(@Param("cart") long cart, @Param("sku") String sku, @Param("qty") int qty);

// batches: sort by the conflict key to avoid deadlocks
lines.sort(Comparator.comparing(Line::cartId).thenComparing(Line::sku));`, note: 'With Hibernate <code>@GeneratedValue(SEQUENCE)</code> plus pooled optimizers, ids are allocated up front: gaps again, by design.' }
  ]
});

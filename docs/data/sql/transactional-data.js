IA.register({
  track: 'sql',
  slug: 'transactional-data',
  title: 'Transactional vs analytical vs event data',
  tagline: 'One checkout creates three kinds of data: <b>current state</b> that must be correct right now (OLTP), an <b>append-only record</b> of what happened (events), and <b>history</b> you scan and aggregate later (OLAP).',
  tldr: {
    problem: 'Running a month-end revenue report on the same Postgres that takes payments slows checkout. Updating events in place destroys the audit trail. The workloads want different shapes.',
    model: '<b>OLTP</b>: many tiny reads/writes by key, ACID, latest state. <b>Events</b>: immutable facts appended in order. <b>OLAP</b>: few huge read queries over history, columns and aggregates.',
    hook: '“Why not just query production for the dashboard?” Because a 40-second scan competes with 2 ms checkouts for the same CPU, I/O and cache.',
    facts: [
      { v: 'ms vs s', l: 'typical OLTP query time vs analytical query time' },
      { v: 'UPDATE vs INSERT-only', l: 'OLTP overwrites current state; an event log only appends' },
      { v: 'row vs column', l: 'OLTP stores rows together; analytical engines often store columns together to scan less' }
    ]
  },
  intro: {
    what: 'Data has different <b>jobs</b>. Some records answer “what is true right now?” (stock left, account balance). Some answer “what happened, in order?” (an event log). Some answer “what are the trends?” (sales per month for two years).',
    analogy: { icon: '🏪', title: 'A shop', text: 'The till shows today’s balance and updates on every sale (transactional). The receipt roll records every sale, never erased (events). The accountant’s yearly spreadsheet adds up all the receipts to spot trends (analytical).' },
    steps: [
      { t: 'Transactional: keep current state correct', d: 'Small writes inside a transaction. Either everything happens or nothing does.', code: "BEGIN;\nUPDATE stock SET qty = qty - 1 WHERE sku = 'TEAPOT';\nINSERT INTO orders VALUES (77, 'Asha', 24.00);\nCOMMIT;" },
      { t: 'Events: record what happened', d: 'Only INSERT. Never UPDATE or DELETE a past event.', code: "INSERT INTO events (type, payload)\nVALUES ('OrderPlaced', '{\"id\":77}');" },
      { t: 'Analytical: summarize history', d: 'Read lots of rows, return a few numbers.', code: "SELECT date_trunc('month', ts), sum(amount)\nFROM sales GROUP BY 1;" },
      { t: 'Often different systems', d: 'Postgres for OLTP, Kafka for events, a warehouse (BigQuery, Snowflake, ClickHouse) for analytics. Postgres can do all three at small scale.' }
    ],
    terms: [
      ['OLTP', 'Online Transaction Processing: the app’s day-to-day reads and writes.'],
      ['OLAP', 'Online Analytical Processing: reports and aggregates over history.'],
      ['ACID', 'Atomic, Consistent, Isolated, Durable: the guarantees of a transaction.'],
      ['event', 'An immutable record that something happened, with a timestamp.'],
      ['append-only', 'New data is added at the end; old entries are never changed.'],
      ['ETL / ELT', 'Copying data from OLTP and events into the analytical store.']
    ]
  },
  visual: {
    title: 'One checkout, three lanes',
    caption: 'Press Play to watch a checkout write OLTP rows, publish events and land in the warehouse. Switch to “payment fails” to see the rollback.'
  },
  playground: {
    setup: `
CREATE TABLE stock (sku text PRIMARY KEY, qty int NOT NULL CHECK (qty >= 0));
CREATE TABLE orders (id int PRIMARY KEY, customer text, amount numeric(10,2), ts timestamptz);
CREATE TABLE events (seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, type text NOT NULL,
  payload jsonb NOT NULL, ts timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION no_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'events are append-only'; END $$;
CREATE TRIGGER events_immutable BEFORE UPDATE OR DELETE ON events FOR EACH ROW EXECUTE FUNCTION no_change();
INSERT INTO stock VALUES ('TEAPOT', 1), ('MUG', 10);
INSERT INTO orders SELECT g, 'c' || (g % 7), (g % 50) + 5, '2026-01-01'::timestamptz + g * interval '7 hours' FROM generate_series(1, 500) g;
INSERT INTO events (type, payload) VALUES ('OrderPlaced','{"id":499}'),('OrderPlaced','{"id":500}');`,
    presets: [
      { label: 'OLTP checkout', sql: `BEGIN;\nUPDATE stock SET qty = qty - 1 WHERE sku = 'TEAPOT';\nINSERT INTO orders VALUES (501, 'Asha', 24.00, now());\nINSERT INTO events (type, payload) VALUES ('OrderPlaced', '{"id":501}');\nCOMMIT;\nSELECT * FROM stock ORDER BY sku;`, note: 'Three small writes, one atomic unit.' },
      { label: 'Rollback on failure', sql: `-- the block is one atomic unit: an error undoes all of it\nDO $$ BEGIN\n  UPDATE stock SET qty = qty - 1 WHERE sku = 'TEAPOT';   -- ok: 1 -> 0\n  INSERT INTO orders VALUES (502, 'Ben', 24.00, now());\n  UPDATE stock SET qty = qty - 1 WHERE sku = 'TEAPOT';   -- sold out: CHECK fails\nEXCEPTION WHEN check_violation THEN RAISE NOTICE 'rolled back';\nEND $$;\nSELECT (SELECT qty FROM stock WHERE sku = 'TEAPOT') AS teapot_qty,\n       (SELECT count(*) FROM orders WHERE id = 502) AS order_502;`, note: 'Stock is back to 1 and order 502 doesn’t exist: the first update and the insert were rolled back too.' },
      { label: 'Events are immutable', sql: `UPDATE events SET type = 'OrderCancelled' WHERE seq = 1;`, note: 'A trigger blocks updates. To cancel, append a new event instead.' },
      { label: 'Append, then replay', sql: `INSERT INTO events (type, payload) VALUES ('OrderCancelled', '{"id":500}');\nSELECT seq, type, payload FROM events ORDER BY seq;`, note: 'Current state = fold over all events in order.' },
      { label: 'OLAP aggregate', sql: `SELECT date_trunc('month', ts) AS month, count(*) AS orders, sum(amount) AS revenue\nFROM orders GROUP BY 1 ORDER BY 1;`, note: 'Reads every row, returns a handful.' },
      { label: 'Plans differ', sql: `EXPLAIN SELECT * FROM orders WHERE id = 42;\nEXPLAIN SELECT sum(amount) FROM orders;`, note: 'Index lookup vs full scan + aggregate.' }
    ]
  },
  gotchas: [
    { trap: 'Analytics on the primary', why: 'Long scans evict hot pages from shared_buffers and compete for I/O. Long-running queries also hold back VACUUM (old row versions can’t be removed while a snapshot needs them).', fix: 'Run reports on a read replica or a warehouse. Set <code>statement_timeout</code> for reporting roles.' },
    { trap: 'Publishing events outside the transaction', code: `orderRepo.save(order);\nkafka.send("OrderPlaced", order);   // what if COMMIT then fails?`, why: 'The DB write and the publish are two systems; one can succeed while the other fails (the dual-write problem).', fix: 'Use the transactional outbox: insert the event row in the same transaction, relay it afterwards (polling or CDC with Debezium).' },
    { trap: '“Fixing” an event in place', why: 'Consumers already processed the old version; replays now produce different results than history did.', fix: 'Append a correcting event (e.g. <code>OrderAmended</code>). Treat the log as immutable.' },
    { trap: 'Current-state tables lose history', why: '<code>UPDATE stock SET qty = 4</code> overwrites 5. Nobody can later ask “what was stock on Tuesday?”.', fix: 'Keep history where you need it: an events table, an audit table filled by trigger, or a temporal (valid_from/valid_to) design.' },
    { trap: 'Events are not exactly-once', why: 'Relays and consumers retry. The same event can arrive twice.', fix: 'Give every event an id and make consumers idempotent (<code>INSERT … ON CONFLICT DO NOTHING</code> on the event id).' }
  ],
  scenarios: [
    { title: 'Checkout p99 jumps to 3 s every Monday at 09:00',
      symptom: 'Latency spikes match the weekly finance report run.',
      diagnose: `SELECT pid, now() - query_start AS runtime, left(query, 60)\nFROM pg_stat_activity WHERE state = 'active' ORDER BY runtime DESC;`,
      cause: 'A 12-minute analytical query on the primary saturates I/O and evicts cached index pages that checkout depends on.',
      fix: 'Move reporting to a replica or the warehouse; cap the reporting role.',
      fixCode: `ALTER ROLE reporting SET statement_timeout = '30s';` },
    { title: 'Warehouse shows orders that customers never received',
      symptom: 'Analytics counts 0.3% more orders than the orders table.',
      diagnose: `-- events with no matching committed order\nSELECT e.payload->>'id' FROM events e\nLEFT JOIN orders o ON o.id = (e.payload->>'id')::int\nWHERE e.type = 'OrderPlaced' AND o.id IS NULL;`,
      cause: 'The service sent to Kafka before COMMIT; failed transactions still produced events.',
      fix: 'Transactional outbox: write the event in the same transaction, publish only committed rows.' }
  ],
  puzzles: [
    { kind: 'predict', q: 'After this script (seed has TEAPOT qty 1), what is TEAPOT’s qty?', code: `DO $$ BEGIN\n  UPDATE stock SET qty = qty - 1 WHERE sku = 'TEAPOT';\n  UPDATE stock SET qty = qty - 1 WHERE sku = 'TEAPOT';\nEXCEPTION WHEN check_violation THEN NULL; END $$;\nSELECT qty FROM stock WHERE sku = 'TEAPOT';`, options: ['-1', '0', '1', 'error'], answer: 2, explain: 'The exception rolls back <b>everything</b> in the block, including the first successful update: qty stays <b>1</b>.' },
    { kind: 'predict', q: 'What happens?', code: `DELETE FROM events WHERE seq = 2;`, options: ['1 row deleted', '0 rows deleted', 'error: events are append-only', 'error: FK violation'], answer: 2, explain: 'The BEFORE DELETE trigger raises an exception.' },
    { kind: 'predict', q: 'How many rows does the monthly report return? (500 orders, one every 7 hours from 1 Jan 2026)', code: `SELECT date_trunc('month', ts), count(*) FROM orders GROUP BY 1;`, options: ['3', '4', '5', '12'], answer: 2, explain: '500 × 7 h = 3500 h ≈ 146 days, so January to late May: <b>5</b> months.' },
    { kind: 'concept', q: 'Which is the classic OLTP query?', options: ['SUM(amount) per month over 3 years', 'SELECT * FROM orders WHERE id = 42', 'COUNT(DISTINCT customer) per region', 'Rebuild balances from all events'], answer: 1, explain: 'OLTP = point lookups and small writes by key.' },
    { kind: 'concept', q: 'Why use a transactional outbox?', options: ['to make Kafka faster', 'so an event is published if and only if the DB transaction commits', 'to avoid indexes', 'to compress events'], answer: 1, explain: 'It turns a dual write into a single DB write plus an asynchronous relay.' }
  ],
  interview: [
    { q: 'Compare OLTP and OLAP workloads.', a: '<p>OLTP: high concurrency, short transactions, point reads/writes by index, normalized schema, latest state. OLAP: few users, long read-only queries, full scans and aggregates, denormalized star schemas, history, often columnar storage.</p>', lvl: 'core' },
    { q: 'What does ACID mean, concretely, in Postgres?', a: '<p>Atomicity: a transaction commits or rolls back as a whole. Consistency: constraints hold after every commit. Isolation: MVCC snapshots (Read Committed by default). Durability: COMMIT returns after the WAL record is flushed (with <code>synchronous_commit = on</code>).</p>', lvl: 'core' },
    { q: 'What is event data and why is it append-only?', a: '<p>Facts about things that happened (OrderPlaced). Immutability gives an audit trail, lets consumers replay, and makes caching and replication simple. Corrections are new events.</p>', lvl: 'core' },
    { q: 'Explain the dual-write problem and the outbox pattern.', a: '<p>Writing to the DB and a broker separately can leave them inconsistent on partial failure. The outbox stores events in a table in the same transaction; a relay (poller or CDC via logical decoding) publishes committed rows and marks them sent. Consumers must be idempotent because delivery is at-least-once.</p>', lvl: 'deep' },
    { q: 'Why do columnar stores win for analytics?', a: '<p>A query reading 3 of 40 columns only reads those columns from disk, values of one column compress well, and vectorized execution processes batches. Row stores read whole rows.</p>', lvl: 'core' },
    { q: 'How can a long report on the primary hurt OLTP beyond CPU?', a: '<p>It holds an old snapshot, so VACUUM can’t remove dead tuples newer than it: tables and indexes bloat. On a hot-standby replica it can also be cancelled by recovery conflicts or, with <code>hot_standby_feedback</code>, cause bloat on the primary.</p>', lvl: 'deep' },
    { q: 'Event sourcing vs storing current state: trade-offs?', a: '<p>Event sourcing gives full history and replay, but reads need projections (materialized current state), schema evolution of events is hard, and queries over current state need a separate model. Many systems store state and also emit events.</p>', lvl: 'deep' },
    { q: 'Can Postgres handle analytics?', a: '<p>Moderate volumes, yes: parallel query, BRIN indexes for time-ordered data, partitioning, materialized views. At large scale teams add a columnar warehouse or an extension such as Citus columnar.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Transactional outbox in Spring', lang: 'java', code: `@Transactional
public void checkout(Cart cart) {
  Order o = orders.save(Order.from(cart));             // OLTP write
  stock.decrement(cart.sku(), 1);                      // same transaction
  outbox.save(new OutboxEvent("OrderPlaced", o.getId(), json(o)));  // event row, same TX
}   // commit: all three, or none

@Scheduled(fixedDelay = 500)
void relay() { outbox.findUnsent(100).forEach(e -> { kafka.send(e.topic(), e.payload()); e.markSent(); }); }`, note: 'Delivery is at-least-once: consumers dedupe on the event id.' }
  ]
});

IA.register({
  track: 'sql',
  slug: 'polyglot-persistence',
  title: 'Polyglot persistence: the cost of a second store',
  tagline: 'Adding Redis, Elasticsearch or a warehouse is easy. Keeping it <b>in sync</b> is the real work. Dual writes drift; a <b>transactional outbox</b> or <b>CDC</b> plus <b>idempotent consumers</b> converge. And leaving a store needs its own playbook.',
  tldr: {
    problem: 'Every extra store creates a consistency problem: two systems, no shared transaction. Teams discover it as “search shows the old price” or “the cache never updates” months later.',
    model: 'One store is the <b>source of truth</b>. Others are derived. Changes flow from the truth through a durable log (an outbox table, or the WAL via CDC) with at-least-once delivery, and consumers apply them <b>idempotently</b> (dedupe by event id, or upsert only if newer).',
    hook: '“Why not just write to Postgres and then Kafka?” Because a crash between the two loses the event forever, and nothing will ever notice.',
    facts: [
      { v: '0', l: 'atomic transactions span Postgres and Kafka/Redis/Elasticsearch: dual writes always have a failure window' },
      { v: '≥ 1', l: 'delivery is what outbox and CDC guarantee; consumers must handle duplicates' },
      { v: '5', l: 'phases of a zero-downtime migration: dual-write, backfill, shadow reads, cutover, decommission' }
    ]
  },
  intro: {
    what: '<b>Polyglot persistence</b> means using more than one kind of database in one system: Postgres for orders, Redis as a cache, Elasticsearch for search, a warehouse for reports. Each is good at its job, but the same fact (say, a product’s price) now lives in several places, and you must keep those copies agreeing.',
    analogy: { icon: '📇', title: 'One address book, several copies', text: 'You keep your master address book at home and copies in your car and at work. If you update the home copy and forget to tell the others, a friend’s old address lingers. The safe method: write every change in a change log at home, and have each copy replay the log, skipping changes it already has.' },
    steps: [
      { t: 'Ask if you need it', d: 'A second store must earn its place with a measured need (search relevance, sub-ms cache, analytics isolation). Each one adds sync, backup, on-call and cost.' },
      { t: 'Pick one source of truth', d: 'Usually Postgres. The other stores are copies that can be rebuilt from it.' },
      { t: 'Publish changes durably', d: 'Write the change and an “event” row in the same transaction (outbox), or read the database log (CDC).', code: "BEGIN;\nINSERT INTO orders VALUES (42, 'Ben', 80);\nINSERT INTO outbox (aggregate_id, event_type, payload)\n  VALUES (42, 'OrderPlaced', '{\"id\":42}');\nCOMMIT;" },
      { t: 'Apply changes safely', d: 'Consumers may see an event twice. They record which events they processed, or only apply a change if it is newer.' }
    ],
    widget: 'polyglot-persistence-intro',
    terms: [
      ['dual write', 'Writing the same change to two systems one after the other from the application, with no shared transaction.'],
      ['transactional outbox', 'A table written in the same transaction as the business change; a relay publishes its rows later.'],
      ['CDC', 'Change data capture: streaming committed changes from the database log (Debezium, logical decoding).'],
      ['idempotent', 'Applying the same message twice has the same effect as applying it once.'],
      ['cache-aside', 'The app reads the cache first; on a miss it reads the database and fills the cache.']
    ]
  },
  visual: {
    title: 'Keeping two stores in sync',
    caption: 'Choose a pattern and a failure, then press Play. <b>Dual write</b> drifts after a crash. <b>Outbox</b> and <b>CDC</b> converge, as long as the consumer is idempotent.'
  },
  extras: [
    { id: 'polyglot-persistence-cache', title: 'Cache-aside with Redis', label: 'Cache-aside', caption: 'Read and update to see hits, misses and invalidation. Then play the classic race that leaves a stale value in the cache.' },
    { id: 'polyglot-persistence-migrate', title: 'Migrating off a database with zero downtime', label: 'Migration', caption: 'Dual-write → backfill → shadow reads → cutover → decommission. At every step, there is a way back.' }
  ],
  playground: {
    setup: `
CREATE TABLE orders (id bigint PRIMARY KEY, customer text NOT NULL, total numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'placed');
CREATE TABLE outbox (id bigserial PRIMARY KEY, aggregate_id bigint NOT NULL, event_type text NOT NULL,
  payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz);
CREATE INDEX outbox_unsent ON outbox (id) WHERE sent_at IS NULL;
CREATE TABLE processed_events (event_id bigint PRIMARY KEY, processed_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE search_doc (order_id bigint PRIMARY KEY, body text, version bigint NOT NULL);
BEGIN;
INSERT INTO orders VALUES (41, 'Asha', 120.00);
INSERT INTO outbox (aggregate_id, event_type, payload) VALUES (41, 'OrderPlaced', '{"id":41,"total":120}');
COMMIT;`,
    presets: [
      { label: 'Outbox write', sql: `BEGIN;\nINSERT INTO orders VALUES (42, 'Ben', 80.00);\nINSERT INTO outbox (aggregate_id, event_type, payload)\n  VALUES (42, 'OrderPlaced', jsonb_build_object('id', 42, 'total', 80));\nCOMMIT;\nSELECT o.id, x.id AS event_id, x.event_type, x.sent_at\nFROM orders o JOIN outbox x ON x.aggregate_id = o.id ORDER BY o.id;`, note: 'The order and its event commit together. There is no state where one exists without the other.' },
      { label: 'Rollback = no event', sql: `BEGIN;\nINSERT INTO orders VALUES (43, 'Chen', 50.00);\nINSERT INTO outbox (aggregate_id, event_type, payload) VALUES (43, 'OrderPlaced', '{"id":43}');\nROLLBACK;\nSELECT (SELECT count(*) FROM orders) AS orders, (SELECT count(*) FROM outbox) AS events;`, note: 'No phantom event for an order that never existed. A dual write to Kafka could not give you this.' },
      { label: 'Relay: claim a batch', sql: `-- one relay worker claims unsent events; others skip locked rows\nWITH batch AS (\n  SELECT id FROM outbox WHERE sent_at IS NULL\n  ORDER BY id LIMIT 10\n  FOR UPDATE SKIP LOCKED)\nUPDATE outbox o SET sent_at = now()\nFROM batch WHERE o.id = batch.id\nRETURNING o.id, o.event_type, o.payload;`, note: 'In real code: publish first, then mark sent. A crash in between republishes the event, so delivery is at-least-once.' },
      { label: 'Idempotent consumer', sql: `-- the same event id arrives twice\nINSERT INTO processed_events (event_id) VALUES (1) ON CONFLICT DO NOTHING RETURNING event_id;\nINSERT INTO processed_events (event_id) VALUES (1) ON CONFLICT DO NOTHING RETURNING event_id;\nSELECT count(*) FROM processed_events;`, note: 'The second insert returns no row, which tells the consumer “already processed, skip”. Do it in the same transaction as the side effect.' },
      { label: 'Upsert if newer', sql: `-- version 5 arrives, then a late, older version 3\nINSERT INTO search_doc VALUES (41, 'Asha 120', 5)\nON CONFLICT (order_id) DO UPDATE SET body = EXCLUDED.body, version = EXCLUDED.version\nWHERE search_doc.version < EXCLUDED.version;\nINSERT INTO search_doc VALUES (41, 'Asha 100 (old)', 3)\nON CONFLICT (order_id) DO UPDATE SET body = EXCLUDED.body, version = EXCLUDED.version\nWHERE search_doc.version < EXCLUDED.version;\nSELECT * FROM search_doc;`, note: 'Out-of-order and duplicate events are harmless: the older version is ignored. CDC consumers often use the source LSN as the version.' },
      { label: 'CDC prerequisite', sql: `SHOW wal_level;`, note: 'Logical decoding (Debezium, logical replication) needs <code>wal_level = logical</code>. The default is <code>replica</code>; changing it needs a restart.' }
    ]
  },
  gotchas: [
    { trap: 'Dual writes from the application', code: `orderRepo.save(order);          // commits\nkafka.send("orders", event);    // crash here = event lost forever`, why: 'There is no transaction across Postgres and Kafka (or Redis, or Elasticsearch). Any crash, timeout or deploy between the two writes leaves the stores disagreeing, with nothing to repair it.', fix: 'Transactional outbox, or CDC from the database log. Add reconciliation jobs for anything critical.' },
    { trap: 'Publishing from inside the DB transaction', why: 'Sending to Kafka before COMMIT means consumers may act on an order that is then rolled back; holding the transaction open while waiting for Kafka lengthens locks.', fix: 'Only write the outbox row in the transaction. Publish after commit from a relay (or <code>afterCommit</code> hook for best-effort, non-critical events).' },
    { trap: 'Consumers that are not idempotent', why: 'Outbox relays and CDC connectors redeliver after crashes. A non-idempotent consumer double-charges, double-emails, or double-counts.', fix: 'Dedupe by event id in a <code>processed_events</code> table inside the consumer’s transaction, or upsert with a version check.' },
    { trap: 'Cache invalidation by “update cache on write”', why: 'Two concurrent writers can set the cache in the opposite order to their DB commits, leaving the older value cached.', fix: 'Delete the key on write (cache-aside), use short TTLs, versioned values, or invalidate from CDC events in commit order.' },
    { trap: 'Outbox table never cleaned', why: 'An outbox that only grows becomes a big, bloated hot table; the relay’s query slows down.', fix: 'Partial index on unsent rows, delete or partition-and-drop sent rows, keep a short retention for debugging.' },
    { trap: 'Big-bang migration to a new store', why: 'A weekend cutover with no comparison phase discovers mapping bugs in production, with no way back.', fix: 'Dual-write, backfill, shadow reads with diffing, gradual read cutover behind a flag, reverse sync for rollback.' }
  ],
  scenarios: [
    { title: 'Search shows deleted products for days',
      symptom: 'Products removed by merchants still appear in search results; clicking them gives a 404.',
      cause: 'The service deleted the row in Postgres and then called Elasticsearch. During an ES rolling restart those calls failed and were only logged.',
      fix: 'Feed the index via Debezium CDC (deletes arrive as tombstone events) or an outbox, with idempotent upserts/deletes by id. Add a nightly diff of ids between Postgres and the index.' },
    { title: 'Customers charged twice after a deploy',
      symptom: 'About 40 customers received two payment captures during a deploy window.',
      diagnose: `SELECT aggregate_id, count(*)\nFROM outbox WHERE event_type = 'CapturePayment'\nGROUP BY 1 HAVING count(*) > 1;   -- one event each: the duplicate was a redelivery`,
      cause: 'The outbox relay published, was killed before marking rows as sent, and republished on restart. The payment consumer was not idempotent.',
      fix: 'Record processed event ids in the consumer transaction and pass an idempotency key (the event id) to the payment provider.',
      fixCode: `INSERT INTO processed_events (event_id) VALUES ($1)\nON CONFLICT DO NOTHING RETURNING event_id;  -- no row returned → skip` },
    { title: 'Stale prices in the cache after a flash-sale update',
      symptom: 'Some product pages showed the old price for 10 minutes after a price change.',
      cause: 'Classic cache-aside race: a reader missed, read the old price, paused; the writer updated the DB and deleted the key; the reader then set the old price with a 10-minute TTL.',
      fix: 'Shorter TTL for prices, invalidate from CDC events in commit order, or store a version with the value and only set if newer.' }
  ],
  puzzles: [
    { kind: 'predict', q: 'After the rollback, how many outbox events exist (the seed already has order 41 and its event)?', code: `BEGIN;\nINSERT INTO orders VALUES (43, 'Chen', 50.00);\nINSERT INTO outbox (aggregate_id, event_type, payload) VALUES (43, 'OrderPlaced', '{"id":43}');\nROLLBACK;\nSELECT count(*) FROM outbox;`, options: ['0', '1', '2', 'Error'], answer: 1, explain: 'The rolled-back event disappears with its order. Only the seed event for order 41 remains: <b>1</b>.' },
    { kind: 'predict', q: 'Event 1 is delivered twice. How many rows are in processed_events afterwards?', code: `INSERT INTO processed_events (event_id) VALUES (1) ON CONFLICT DO NOTHING;\nINSERT INTO processed_events (event_id) VALUES (1) ON CONFLICT DO NOTHING;\nSELECT count(*) FROM processed_events;`, options: ['0', '1', '2', 'Error on the second insert'], answer: 1, explain: 'The primary key plus <code>ON CONFLICT DO NOTHING</code> makes the second delivery a no-op: <b>1</b> row.' },
    { kind: 'predict', q: 'Version 5 arrives, then a late version 3 of the same document. What does search_doc hold?', code: `INSERT INTO search_doc VALUES (41, 'v5', 5)\nON CONFLICT (order_id) DO UPDATE SET body = EXCLUDED.body, version = EXCLUDED.version\nWHERE search_doc.version < EXCLUDED.version;\nINSERT INTO search_doc VALUES (41, 'v3', 3)\nON CONFLICT (order_id) DO UPDATE SET body = EXCLUDED.body, version = EXCLUDED.version\nWHERE search_doc.version < EXCLUDED.version;\nSELECT body FROM search_doc;`, options: ['v3', 'v5', 'both rows', 'nothing'], answer: 1, explain: 'The conditional upsert ignores the older version: <b>v5</b> stays.' },
    { kind: 'concept', q: 'Why does the transactional outbox avoid the dual-write problem?', options: ['Kafka joins the Postgres transaction', 'The event is written in the same local transaction as the change; publishing happens later from a durable record', 'It uses two-phase commit', 'It disables retries'], answer: 1, explain: 'Atomicity comes from one database transaction. Publishing is retried from the outbox until it succeeds (at-least-once).' },
    { kind: 'concept', q: 'Outbox vs CDC on the business tables: a main reason to prefer the outbox?', options: ['It is faster', 'You publish explicit domain events with a stable contract, instead of exposing table structure', 'It needs no database', 'CDC cannot see deletes'], answer: 1, explain: 'CDC on raw tables couples consumers to your schema. Many teams combine both: CDC (Debezium outbox event router) reading the outbox table.' },
    { kind: 'concept', q: 'In a zero-downtime migration, what is the purpose of shadow reads?', options: ['To warm the cache', 'To compare results from the new store with the old one on real traffic before users depend on it', 'To double read capacity', 'To delete old data'], answer: 1, explain: 'Shadow reads find mapping and semantic bugs safely: users still get the old store’s answer while mismatches are logged and fixed.' }
  ],
  interview: [
    { q: 'What is the dual-write problem and how do you solve it?', a: '<p>Writing to two systems (DB and broker/cache/index) without a shared transaction: any failure between the writes leaves them inconsistent, and reordering the writes only changes which inconsistency you get. Solutions: <b>transactional outbox</b> (event row in the same DB transaction, relayed later), or <b>CDC</b> from the database log. Both deliver at-least-once, so consumers must be idempotent. 2PC/XA across heterogeneous systems is rarely available or worth it.</p>', lvl: 'core' },
    { q: 'How do you implement the outbox relay?', a: '<p>Either polling (<code>SELECT … WHERE sent_at IS NULL ORDER BY id LIMIT n FOR UPDATE SKIP LOCKED</code>, publish, mark sent) or CDC on the outbox table (Debezium’s outbox event router), which avoids polling and preserves commit order. Handle ordering per aggregate (partition Kafka by aggregate id), cleanup of sent rows, and monitoring of the oldest unsent event.</p>', fu: 'How do you keep per-aggregate ordering with multiple relay workers? (Partition work by aggregate id, or use a single CDC stream.)', lvl: 'deep' },
    { q: 'What makes a consumer idempotent?', a: '<ul><li>Dedupe table keyed by event id, inserted in the same transaction as the effect.</li><li>Natural idempotency: upserts, “set status = shipped”, conditional updates with versions.</li><li>Idempotency keys passed to external APIs (payments).</li></ul><p>“Exactly once” end to end is at-least-once delivery + idempotent processing.</p>', lvl: 'core' },
    { q: 'Explain cache-aside and its consistency risks.', a: '<p>Read: cache → on miss, DB → set cache with TTL. Write: update DB, then delete the key. Risks: the read-miss/write race leaves stale data until TTL; deleting before the DB commit lets a reader re-cache the old value; thundering herd on popular keys after expiry (use request coalescing or early refresh). TTL bounds staleness; CDC-driven invalidation tightens it.</p>', lvl: 'core' },
    { q: 'When should you add a second store, and what does it cost?', a: '<p>When a measured requirement can’t be met in the primary: relevance search at scale, sub-ms hot reads, analytics isolation, deep graph traversals, huge vector sets. Costs: sync pipeline and its failure modes, eventual consistency visible to users, another backup/restore/upgrade/on-call path, security and access control duplicated, and team expertise.</p>', lvl: 'core' },
    { q: 'Describe a zero-downtime migration from MongoDB to Postgres.', a: '<p>1) Dual-write: new writes also go to Postgres (CDC from Mongo change streams, or async from the app), old store stays the truth. 2) Backfill history idempotently, resolving conflicts by version. 3) Shadow reads: read both, serve Mongo, diff and fix until mismatches are ~0. 4) Cutover reads gradually behind a flag, then make Postgres the source of truth, with reverse sync to Mongo for rollback. 5) Decommission after a soak period.</p>', lvl: 'deep' },
    { q: 'How do you detect that two stores have drifted?', a: '<p>Reconciliation jobs: compare counts and checksums per partition (per day, per tenant), diff ids, sample-compare full records. Track CDC/outbox lag (oldest unsent event, slot lag). Alert on growing mismatch, and have a tool to re-sync a range.</p>', lvl: 'deep' },
    { q: 'Outbox or CDC: which do you choose?', a: '<p>Outbox: explicit, versioned domain events; works with any broker; costs an extra insert per transaction and a relay. CDC on business tables: zero app changes, captures every write including manual fixes, but exposes the schema and needs logical decoding (slots, wal_level=logical). A common best-of-both: write an outbox table and stream it with Debezium.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Outbox in Spring: one transaction, two inserts', lang: 'java', code: `@Transactional
public Order placeOrder(PlaceOrder cmd) {
  Order order = orders.save(Order.from(cmd));
  outbox.save(new OutboxEvent(
      order.getId(), "OrderPlaced",
      json.writeValueAsString(new OrderPlaced(order.getId(), order.getTotal()))));
  return order;   // both rows commit together, or neither does
}

// Relay (could also be Debezium reading the outbox table)
@Scheduled(fixedDelay = 500)
@Transactional
public void relay() {
  List<OutboxEvent> batch = outbox.claimBatch(100);   // FOR UPDATE SKIP LOCKED
  for (OutboxEvent e : batch) {
    kafka.send("orders", String.valueOf(e.getAggregateId()), e.getPayload()).get(); // wait for ack
    e.markSent();
  }
}`, note: 'A crash after <code>send</code> and before commit republishes the batch: consumers must be idempotent.' },
    { title: 'Idempotent consumer', lang: 'java', code: `@KafkaListener(topics = "orders")
@Transactional
public void on(ConsumerRecord<String, String> rec) {
  long eventId = Long.parseLong(new String(rec.headers().lastHeader("event_id").value()));
  int inserted = jdbc.update(
      "INSERT INTO processed_events(event_id) VALUES (?) ON CONFLICT DO NOTHING", eventId);
  if (inserted == 0) return;          // duplicate delivery: already applied
  searchDocs.upsert(parse(rec.value()));
}` }
  ]
});

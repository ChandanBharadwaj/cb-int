IA.register({
  track: 'sql',
  slug: 'distributed-sql',
  title: 'Distributed SQL: when one primary isn’t enough',
  tagline: 'CockroachDB, Spanner and YugabyteDB replicate every range with <b>consensus</b>, so writes survive a region loss, and every commit pays a <b>round trip to a majority</b>. Aurora and Citus solve different problems. Most teams need read replicas and partitioning first.',
  tldr: {
    problem: '“We need to scale” leads teams to distributed SQL, and they get 50–200 ms commits, new failure modes and a bigger bill, for a write rate one Postgres node could handle.',
    model: 'Data is split into ranges/tablets. Each has a Raft (or Paxos) group of usually 3–5 replicas and a leader. A write commits when a <b>majority</b> has it in their log. Latency = client→leader + leader→nearest majority. CAP: during a partition the minority side stops accepting writes (CP). PACELC: even without a partition you trade latency for consistency.',
    hook: '“Aurora is distributed, so it scales writes, right?” No. Aurora distributes <b>storage</b> (6 copies over 3 AZs); there is still one writer instance.',
    facts: [
      { v: '2/3', l: 'replicas must persist a write before it commits; with replicas in 3 regions, the commit waits for the leader’s nearest other region' },
      { v: '1', l: 'writer instance in an Aurora cluster (storage is shared and replicated; compute writes are not sharded)' },
      { v: '6', l: 'copies of Aurora data across 3 AZs; a write needs 4 of 6 to ack' }
    ]
  },
  intro: {
    what: 'A normal database runs on one main server (the <b>primary</b>) that handles all writes. <b>Distributed SQL</b> databases spread the data over many servers, often in several regions, and keep several copies of each piece. They still speak SQL and support transactions, so the app sees “one database”, but every write must be agreed by several machines before it is confirmed.',
    analogy: { icon: '🗳️', title: 'A committee that must vote', text: 'One manager (a single primary) can approve requests instantly, but if the manager is off sick, nothing gets approved. A committee of three in different cities keeps working if one is unreachable, but every approval needs at least two votes, and the phone calls between cities take time.' },
    steps: [
      { t: 'Split the data', d: 'Tables are cut into ranges (by key). Different ranges can live on different servers, so writes are spread out.' },
      { t: 'Copy each range', d: 'Each range has 3 (or 5) copies. One copy is the <b>leader</b> that orders the writes.' },
      { t: 'Vote on each write', d: 'The leader sends the write to the others and waits until a <b>majority</b> (2 of 3) has stored it. Then it is committed. This is the Raft consensus protocol.' },
      { t: 'Pay for distance', d: 'If the copies are in different regions, each vote crosses an ocean. That is why multi-region writes are slower, and why you place data near its users.' }
    ],
    widget: 'distributed-sql-intro',
    terms: [
      ['replica', 'A copy of the data on another server.'],
      ['consensus (Raft / Paxos)', 'A protocol that makes replicas agree on the order of writes, as long as a majority is reachable.'],
      ['leader / leaseholder', 'The replica that orders writes for a range (and, in CockroachDB, serves consistent reads).'],
      ['partition (network)', 'Servers that are running but cannot reach each other.'],
      ['shard', 'One piece of a table that has been split across servers.']
    ]
  },
  visual: {
    title: 'A Raft write across regions',
    caption: 'Choose where the client is, where the range’s leader is, and how replicas are placed. Press Play to watch the write travel, the majority vote, and the latency add up. RTTs are illustrative round-trip times between regions.'
  },
  extras: [
    { id: 'distributed-sql-pacelc', title: 'CAP and PACELC, visually', label: 'CAP / PACELC', caption: 'Cut the link between regions and choose how the system behaves. Then remove the partition and see the everyday trade-off: latency vs consistency.' },
    { id: 'distributed-sql-matrix', title: 'Which “distributed” is it?', label: 'Products', caption: 'Five products that are often grouped together but solve different problems, plus the baseline you should compare against. Filter or sort.' }
  ],
  playground: {
    setup: `
-- Citus-style idea in plain Postgres: hash "shards" by tenant, range partitions by time
CREATE TABLE orders (tenant_id int NOT NULL, id bigint NOT NULL, created_at date NOT NULL, amount numeric,
  PRIMARY KEY (tenant_id, id)) PARTITION BY HASH (tenant_id);
CREATE TABLE orders_s0 PARTITION OF orders FOR VALUES WITH (MODULUS 3, REMAINDER 0);
CREATE TABLE orders_s1 PARTITION OF orders FOR VALUES WITH (MODULUS 3, REMAINDER 1);
CREATE TABLE orders_s2 PARTITION OF orders FOR VALUES WITH (MODULUS 3, REMAINDER 2);
INSERT INTO orders SELECT 1 + g % 6, g, date '2026-01-01' + (g % 90), (g * 7) % 500 FROM generate_series(1, 600) g;
CREATE TABLE events (id bigint, at timestamptz NOT NULL, kind text) PARTITION BY RANGE (at);
CREATE TABLE events_2026_01 PARTITION OF events FOR VALUES FROM ('2026-01-01 00:00+00') TO ('2026-02-01 00:00+00');
CREATE TABLE events_2026_02 PARTITION OF events FOR VALUES FROM ('2026-02-01 00:00+00') TO ('2026-03-01 00:00+00');
CREATE TABLE events_2026_03 PARTITION OF events FOR VALUES FROM ('2026-03-01 00:00+00') TO ('2026-04-01 00:00+00');
INSERT INTO events SELECT g, timestamptz '2026-01-01 00:00+00' + g * interval '2 hours', 'click' FROM generate_series(0, 1000) g;
ANALYZE;`,
    presets: [
      { label: 'Where tenants live', sql: `SELECT tableoid::regclass AS shard, count(*), array_agg(DISTINCT tenant_id) AS tenants\nFROM orders GROUP BY 1 ORDER BY 1;`, note: 'Hash placement is uneven with few keys: one “shard” holds 3 tenants and 300 rows. Citus does the same thing across servers, using many more shards.' },
      { label: 'Single-shard query', sql: `EXPLAIN (COSTS OFF)\nSELECT sum(amount) FROM orders WHERE tenant_id = 4;`, note: 'The distribution key is in the WHERE clause, so only one partition is scanned. In Citus this query is routed to one worker.' },
      { label: 'Fan-out query', sql: `EXPLAIN (COSTS OFF)\nSELECT sum(amount) FROM orders WHERE created_at >= '2026-03-01';`, note: 'No tenant filter: every partition is scanned. In a sharded cluster this becomes a scatter-gather across all nodes.' },
      { label: 'Time partitions', sql: `EXPLAIN (COSTS OFF)\nSELECT count(*) FROM events\nWHERE at >= '2026-02-10 00:00+00' AND at < '2026-02-20 00:00+00';`, note: 'Range partitioning on time: only February is scanned. Partitioning on one node often removes the “we need to shard” pressure.' },
      { label: 'Archive a month', sql: `ALTER TABLE events DETACH PARTITION events_2026_01;\nSELECT count(*) FROM events;`, note: 'Retention without a huge DELETE: detach (or drop) a whole partition. No dead tuples, no vacuum storm.' }
    ]
  },
  gotchas: [
    { trap: 'Expecting single-region latency from a multi-region cluster', why: 'With replicas in three regions, every write waits for the leader plus at least one other region. Reads from the leaseholder are fast only for clients near it.', fix: 'Use locality features: CockroachDB <code>REGIONAL BY ROW</code> / <code>GLOBAL</code> tables, Spanner leader placement, Yugabyte tablespaces. Keep a user’s data in the user’s region.' },
    { trap: 'Calling Aurora “horizontally scalable writes”', why: 'Aurora (standard) has one writer instance; its innovation is a log-structured storage layer replicated 6 ways across 3 AZs. Reads scale with up to 15 replicas.', fix: 'For write scale-out on AWS Postgres, consider sharding (Citus, or Aurora Limitless Database) or distributed SQL. Aurora Global Database adds cross-region read replicas, not multi-region writes.' },
    { trap: 'Picking a bad distribution key in Citus', why: 'If the most common queries do not filter on the distribution column, every query fans out to all workers, and joins between differently distributed tables shuffle data.', fix: 'Distribute by tenant or entity id that most queries use; co-locate related tables on the same key; use reference tables for small shared tables.' },
    { trap: 'Assuming PG-compatible means Postgres', why: 'CockroachDB and YugabyteDB speak the Postgres wire protocol but differ in isolation defaults, supported extensions, sequences, DDL behaviour and performance shape.', fix: 'Run your ORM and migration tool against the target early. Prefer UUIDs or hash-sharded keys over sequential keys that create a hot range.' },
    { trap: 'Sequential primary keys on a range-partitioned store', why: 'Monotonic keys send every insert to the last range, so one leader takes all writes: a hotspot.', fix: 'Use random UUIDs or hash-sharded indexes in CockroachDB/Yugabyte; in Spanner avoid monotonically increasing key prefixes.' },
    { trap: 'Retry storms under serializable isolation', why: 'CockroachDB defaults to SERIALIZABLE, and contended transactions are aborted with retryable errors (SQLSTATE 40001). Apps that don’t retry surface failures to users.', fix: 'Wrap transactions in a retry loop with backoff; keep transactions short; reduce contention on hot rows.' }
  ],
  scenarios: [
    { title: 'Checkout p99 jumped from 15 ms to 220 ms after “going multi-region”',
      symptom: 'Every write in Europe and Asia became slow after the cluster was spread over us-east, eu-west and ap-south.',
      cause: 'All tables kept the default placement, so the range leaders stayed in us-east. EU and Asia clients paid a cross-ocean RTT to reach the leader, and then the leader waited for a second region to vote.',
      fix: 'Make user-owned tables <code>REGIONAL BY ROW</code> (leader in the user’s home region), and reference data <code>GLOBAL</code>. Accept that cross-region transactions remain slow.',
      fixCode: `ALTER DATABASE shop SET PRIMARY REGION "us-east1";\nALTER DATABASE shop ADD REGION "europe-west1";\nALTER TABLE carts SET LOCALITY REGIONAL BY ROW;` },
    { title: 'A region outage: writes kept working in two regions, failed in one',
      symptom: 'During a network partition, users routed to ap-south saw errors on every write; us-east and eu-west continued.',
      cause: 'This is CP behaviour working as designed: ap-south was the minority side and could not reach a Raft majority, so it refused writes rather than diverge.',
      fix: 'Nothing to fix in the database. Make clients fail over to a healthy region, and decide per table whether the business prefers availability (a different store) or consistency.' },
    { title: 'Team migrated to distributed SQL for 2,000 writes/s',
      symptom: 'Costs tripled, latency doubled, and the team spends sprints on retry handling and hot ranges.',
      cause: 'The forcing requirement was never measured. 2,000 writes/s fits on one tuned Postgres primary; read pressure needed replicas, and the biggest table needed partitioning.',
      fix: 'Write the requirement down with numbers. Move back to Postgres + read replicas + partitioning, or keep distributed SQL only for the data that truly needs multi-region writes.' }
  ],
  puzzles: [
    { kind: 'predict', q: 'With the seed data, which partition holds tenant 3?', code: `SELECT DISTINCT tableoid::regclass\nFROM orders WHERE tenant_id = 3;`, options: ['orders_s0', 'orders_s1', 'orders_s2', 'all three'], answer: 1, explain: 'Hash partitioning places all rows of one key in one partition: tenant 3 is in <b>orders_s1</b> (alone, as the “where tenants live” preset shows).' },
    { kind: 'predict', q: 'How many events remain visible after detaching January?', code: `ALTER TABLE events DETACH PARTITION events_2026_01;\nSELECT count(*) FROM events;`, options: ['1001', '629', '372', '0'], answer: 1, explain: '1001 events total, 372 of them in January. The detached table still exists but is no longer part of <code>events</code>: <b>629</b>.' },
    { kind: 'concept', q: 'Replicas in us-east (leader), eu-west and ap-south. RTT leader→eu = 75 ms, leader→ap = 190 ms. Client is next to the leader. Roughly how long until commit?', options: ['~1 ms', '~75 ms', '~190 ms', '~265 ms'], answer: 1, explain: 'Majority of 3 = leader + one follower. The leader waits only for the fastest follower (eu-west): <b>~75 ms</b> plus local work.' },
    { kind: 'concept', q: 'Under CAP, what does a CP system do on the minority side of a partition?', options: ['Accepts writes and merges them later', 'Refuses writes (and consistent reads) until it can reach a majority', 'Switches to eventual consistency automatically', 'Shuts down the majority side'], answer: 1, explain: 'It chooses consistency: no majority, no commit. AP systems keep accepting writes on both sides and reconcile later (e.g. last-writer-wins).' },
    { kind: 'concept', q: 'Aurora PostgreSQL vs CockroachDB: which statement is right?', options: ['Both shard writes across nodes', 'Aurora has one writer with shared replicated storage; CockroachDB spreads ranges with Raft leaders on many nodes', 'Aurora uses Raft across regions', 'CockroachDB has a single writer'], answer: 1, explain: 'Aurora distributes storage, not write compute. CockroachDB distributes data and leadership across nodes.' },
    { kind: 'concept', q: 'Which requirement truly needs distributed SQL rather than Postgres + replicas + partitioning?', options: ['Reads from three continents with low latency', 'A 3 TB table', 'Strongly consistent writes accepted in several regions, surviving a region loss without data loss', '5,000 writes/s'], answer: 2, explain: 'Global reads → regional replicas. Big tables → partitioning. 5k writes/s → one node. Only multi-region, strongly consistent, partition-tolerant writes force consensus replication.' }
  ],
  interview: [
    { q: 'Explain how a write commits in CockroachDB or YugabyteDB.', a: '<p>The key’s range (tablet) has a Raft group, typically 3 replicas. The gateway node routes the write to the range’s leader (leaseholder). The leader appends it to its log and replicates to followers; when a majority has persisted it, the entry is committed and applied, and the client gets an ack. Multi-range transactions add a transaction record and intents, resolved at commit (a form of two-phase commit on top of Raft).</p>', fu: 'Why 3 or 5 replicas and not 4? (4 tolerates the same single failure as 3 but needs 3 votes.)', lvl: 'core' },
    { q: 'What is PACELC and why is it more useful than CAP?', a: '<p>CAP only describes behaviour during a Partition: choose Availability or Consistency. PACELC adds: <b>E</b>lse (no partition), choose <b>L</b>atency or <b>C</b>onsistency. Distributed SQL is PC/EC: it waits for quorums even on a sunny day. Dynamo-style stores are typically PA/EL: fast local writes, reconcile later. It describes the everyday cost, not only the rare outage.</p>', lvl: 'core' },
    { q: 'How does Spanner provide external consistency?', a: '<p>Spanner uses Paxos per split and TrueTime, a clock API with bounded uncertainty (GPS and atomic clocks). A transaction gets a commit timestamp and waits out the uncertainty (“commit wait”) before releasing its result, so timestamp order matches real-time order across the globe. CockroachDB uses hybrid logical clocks with a max-offset bound and read restarts instead.</p>', lvl: 'deep' },
    { q: 'Aurora: what is distributed and what is not?', a: '<p>Storage is a distributed, log-structured service: 10 GB segments, 6 copies across 3 AZs, write quorum 4/6, read quorum 3/6. The writer ships only redo log records to storage. Compute is one writer plus up to 15 readers sharing the storage volume, so failover is fast and replica lag is low. Writes do not scale out; Global Database adds cross-region readers with typically sub-second lag.</p>', lvl: 'deep' },
    { q: 'When would you choose Citus?', a: '<p>Multi-tenant SaaS or real-time analytics where almost every query filters on one key (tenant_id, device_id) and you want to stay on Postgres (extensions, tooling). Distributed tables are sharded by that key, co-located tables join locally, reference tables are copied to every node. Weak spot: queries and transactions that span many shards.</p>', lvl: 'core' },
    { q: 'You are asked to “make the database global”. What do you ask first?', a: '<ul><li>Is it global <b>reads</b> or global <b>writes</b>?</li><li>What RPO/RTO for a region loss?</li><li>Which data must be strongly consistent across regions, and which can be regional or eventual?</li><li>Data residency (GDPR) constraints?</li><li>Latency budget per operation?</li></ul><p>Most answers lead to regional replicas + a home region per user, not consensus writes everywhere.</p>', lvl: 'core' },
    { q: 'How do you reduce latency in a multi-region distributed SQL deployment?', a: '<p>Place leaders near the writers (regional-by-row, partitioned leader preferences), use global tables for read-mostly reference data, use follower reads / bounded-staleness reads where slightly stale data is fine, keep transactions within one region, and batch writes.</p>', lvl: 'deep' },
    { q: 'What changes for an application moving from Postgres to CockroachDB?', a: '<p>SERIALIZABLE by default with client-side retries (40001), different primary key strategy (avoid sequences; use UUID or hash-sharded), some Postgres features and extensions missing, different EXPLAIN output, schema changes are online but asynchronous, and latency depends on data placement.</p>', lvl: 'deep' },
    { q: 'Read replicas + partitioning: how far do they get you?', a: '<p>Very far. Replicas scale reads and isolate analytics; partitioning keeps big tables manageable (pruning, cheap retention, smaller indexes); vertical scaling handles a lot of writes. What they don’t give you: more than one writer, or zero-RPO writes surviving a region loss with automatic failover in another region.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Retry loop for serializable conflicts (Spring)', lang: 'java', code: `@Retryable(
  retryFor = { TransientDataAccessException.class },   // SQLSTATE 40001 maps to a transient exception
  maxAttempts = 5,
  backoff = @Backoff(delay = 20, multiplier = 2, random = true))
@Transactional
public void transfer(UUID from, UUID to, BigDecimal amt) {
  accounts.debit(from, amt);
  accounts.credit(to, amt);
}
// The retry must wrap the WHOLE transaction: put @Retryable on an outer bean
// method (or order the advisors) so each attempt starts a fresh transaction.`, note: 'Needed for CockroachDB (SERIALIZABLE by default), and equally for Postgres when you use SERIALIZABLE.' }
  ]
});

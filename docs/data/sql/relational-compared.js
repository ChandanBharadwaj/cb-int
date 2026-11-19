IA.register({
  track: 'sql',
  slug: 'relational-compared',
  title: 'Postgres vs MySQL vs Oracle vs SQL Server',
  tagline: 'All four speak SQL and pass ACID tests. They differ in <b>where rows live</b> (heap vs clustered index), <b>where old versions live</b> (heap vs undo), and in licensing, replication and ecosystem. Those differences decide the incidents you will have.',
  tldr: {
    problem: 'Choosing between the big relational engines on “features” misses what actually bites in production: bloat vs undo growth, PK design, replication topology and the licence bill.',
    model: 'Postgres: unordered <b>heap</b> + indexes pointing at physical TIDs, old versions kept <b>in the table</b> and cleaned by VACUUM. InnoDB: the table <b>is</b> a B-tree on the PK, secondary indexes point at the PK, old versions in an <b>undo log</b>. Oracle: heap by default, undo-based MVCC. SQL Server: clustered index by default, optional row versioning.',
    hook: '“Why is a UUID primary key worse in MySQL than in Postgres?” Because InnoDB stores rows in PK order and copies the PK into every secondary index.',
    facts: [
      { v: '2', l: 'B-tree descents for an InnoDB secondary-index lookup (secondary, then the clustered PK), unless the index covers the query' },
      { v: 'RC', l: 'is the default isolation in Postgres, Oracle and SQL Server; InnoDB defaults to REPEATABLE READ' },
      { v: '$0', l: 'licence for Postgres (PostgreSQL Licence) and MySQL Community (GPLv2). Oracle and SQL Server are licensed per core or per user, with paid options' }
    ]
  },
  intro: {
    what: 'A <b>relational database</b> stores data in tables and answers SQL. The four most widely used ones are <b>PostgreSQL</b>, <b>MySQL</b> (with its InnoDB storage engine), <b>Oracle Database</b> and <b>Microsoft SQL Server</b>. For everyday SQL they look almost the same. Under the hood they store rows and old row versions differently, and they are licensed and run very differently.',
    analogy: { icon: '📚', title: 'Two ways to shelve books', text: 'A <b>heap</b> is a library that puts each new book wherever there is space and keeps a card catalogue with “shelf 3, slot 7”. A <b>clustered index</b> is a library that keeps books sorted by ID on the shelves; the catalogue for titles says “ID 42”, and you then walk the sorted shelves to find 42.' },
    steps: [
      { t: 'Same SQL on the surface', d: 'Tables, joins, transactions and indexes work in all four. Dialects differ in details (upsert syntax, identity columns, date functions).', code: "-- Postgres\nINSERT INTO t VALUES (1,'a') ON CONFLICT (id) DO UPDATE SET v = EXCLUDED.v;\n-- MySQL\nINSERT INTO t VALUES (1,'a') ON DUPLICATE KEY UPDATE v = VALUES(v);" },
      { t: 'Where rows live', d: 'Postgres and Oracle (by default) put rows in an unordered <b>heap</b>. InnoDB and SQL Server (by default) keep the table sorted by its primary key: a <b>clustered index</b>.' },
      { t: 'Where old versions live', d: 'All four let readers see a consistent snapshot while others write (MVCC). Postgres keeps old versions <b>in the table</b>; InnoDB and Oracle keep them in an <b>undo log</b>.' },
      { t: 'Cost and ecosystem', d: 'Postgres is free and very extensible. MySQL Community is free (Oracle sells an Enterprise edition). Oracle and SQL Server are commercial, with strong tooling and paid options.' }
    ],
    widget: 'relational-compared-intro',
    terms: [
      ['heap', 'Table storage with no order. Rows go wherever there is free space; indexes point at their physical location.'],
      ['clustered index', 'The table itself is a B-tree sorted by a key (usually the PK). The leaf pages hold the full rows.'],
      ['MVCC', 'Multi-version concurrency control: readers see a snapshot of old versions instead of waiting for writers.'],
      ['undo log', 'A separate area that stores “before images” of changed rows, so old snapshots can be rebuilt.'],
      ['VACUUM', 'Postgres’s cleanup of dead row versions left in the table after UPDATE and DELETE.']
    ]
  },
  visual: {
    title: 'Same query, different engines',
    caption: 'Pick an engine and a scenario. <b>Secondary-index lookup</b> shows heap + TID vs clustered PK. <b>UPDATE + old snapshot</b> shows where the old version goes and who cleans it up.'
  },
  extras: [
    { id: 'relational-compared-matrix', title: 'Comparison matrix', label: 'Matrix', caption: 'Filter by area or search. Well-established facts only; check current editions and pricing before a real decision.' }
  ],
  playground: {
    setup: `
CREATE TABLE acct (id int PRIMARY KEY, owner text, balance int) WITH (fillfactor = 100);
INSERT INTO acct VALUES (3,'Chen',100),(1,'Asha',100),(5,'Eve',100),(2,'Ben',100),(4,'Dina',100);`,
    presets: [
      { label: 'Heap order', sql: `-- rows sit in insertion order, not PK order\nSELECT ctid, id, owner FROM acct;`, note: '<code>ctid</code> is the physical (page, slot). Postgres is a heap: without ORDER BY, you get whatever order the scan finds.' },
      { label: 'UPDATE = new tuple', sql: `SELECT ctid, xmin, id, balance FROM acct WHERE id = 1;\nUPDATE acct SET balance = 80 WHERE id = 1;\nSELECT ctid, xmin, id, balance FROM acct WHERE id = 1;`, note: 'The ctid changes: the UPDATE wrote a new version, and the old one is now dead (until VACUUM). InnoDB would update the row in place and copy the old value to undo.' },
      { label: 'Every update adds a version', sql: `UPDATE acct SET balance = balance - 1 WHERE id = 2;\nUPDATE acct SET balance = balance - 1 WHERE id = 2;\nUPDATE acct SET balance = balance - 1 WHERE id = 2;\nSELECT ctid, id, balance FROM acct ORDER BY id;`, note: 'Three updates of one row, three new tuples: slot numbers keep growing. A hot row updated thousands of times per second is why VACUUM tuning matters.' },
      { label: 'Index-only scan', sql: `SET enable_seqscan = off;\nEXPLAIN SELECT id FROM acct WHERE id = 3;`, note: 'Postgres can answer from the index alone when the visibility map marks the page all-visible. InnoDB gets the same effect when a secondary index covers all needed columns.' },
      { label: 'CLUSTER (one-time)', sql: `CLUSTER acct USING acct_pkey;\nSELECT ctid, id FROM acct;`, note: '<code>CLUSTER</code> rewrites the table in PK order once. It is not maintained: new rows go into free space again. This is not the same as a clustered index.' },
      { label: 'Default isolation', sql: `SHOW default_transaction_isolation;`, note: 'Postgres, Oracle and SQL Server default to READ COMMITTED. MySQL InnoDB defaults to REPEATABLE READ.' }
    ]
  },
  gotchas: [
    { trap: 'Random UUID primary keys in InnoDB', why: 'Rows are stored in PK order, so random keys insert all over the clustered tree, causing page splits and poor cache use. The PK is also copied into every secondary index, so a 16-byte (or 36-char string) key makes them all larger.', fix: 'Use a BIGINT auto-increment or a time-ordered UUID (UUIDv7) stored as BINARY(16). In Postgres the cost is lower (heap + TID), but random keys still scatter the PK B-tree.' },
    { trap: 'Long transactions: bloat in Postgres, undo growth in InnoDB/Oracle', why: 'Any engine must keep old versions while an old snapshot might need them. Postgres keeps them in the table (dead tuples VACUUM cannot remove); InnoDB grows the undo history; Oracle may fail queries with ORA-01555.', fix: 'Alert on transaction age everywhere (<code>pg_stat_activity.xact_start</code>, InnoDB history list length). Set <code>idle_in_transaction_session_timeout</code> in Postgres.' },
    { trap: 'Assuming REPEATABLE READ means the same thing everywhere', why: 'InnoDB RR uses a snapshot for plain reads but <b>locking reads</b> (and UPDATE) see the latest committed row, and it takes gap locks. Postgres RR is snapshot isolation and raises serialization errors on conflicting updates.', fix: 'Test your concurrency patterns on the target engine. Do not port isolation assumptions.' },
    { trap: 'SQL Server readers blocking writers', why: 'Under the default READ COMMITTED (box product), readers take shared locks, so reports can block updates. Row versioning is opt-in.', fix: 'Enable <code>READ_COMMITTED_SNAPSHOT</code> (RCSI). Versions then go to the version store (tempdb, or the database with Accelerated Database Recovery).' },
    { trap: 'Licence costs that scale with cores', why: 'Oracle and SQL Server Enterprise are licensed per core (or processor), and features like partitioning, RAC or advanced compression can be separately priced options. Scaling up hardware raises the bill.', fix: 'Model licence cost per environment (prod, DR, staging) before choosing. Check which options are actually needed.' },
    { trap: 'Expecting MySQL-style multi-primary out of the box in Postgres', why: 'Core Postgres has physical streaming replication (one writable primary) and logical replication (PG10+). It has no built-in multi-master conflict resolution.', fix: 'Use one primary + standbys (Patroni or a managed service). If you truly need multi-region writes, look at distributed SQL.' }
  ],
  scenarios: [
    { title: 'InnoDB insert throughput halves after switching to UUID keys',
      symptom: 'After moving PKs from BIGINT to <code>CHAR(36)</code> UUIDs, insert latency doubles and the buffer pool hit rate drops. Secondary indexes grew 3×.',
      cause: 'Random PKs split clustered-index pages all over the tree, and the 36-byte PK is stored in every secondary index entry.',
      fix: 'Switch to a time-ordered key (UUIDv7 or a sequence) stored as <code>BINARY(16)</code> or BIGINT. Keep a random public ID in a separate unique column if you need unguessable IDs.' },
    { title: 'Postgres table grows to 10× its live size',
      symptom: 'A 2 GB queue table is 20 GB on disk. Seq scans slow down; autovacuum runs constantly but never catches up.',
      diagnose: `SELECT pid, xact_start, state, left(query, 60)\nFROM pg_stat_activity\nWHERE xact_start < now() - interval '10 minutes';`,
      cause: 'A reporting session held a transaction open for hours. VACUUM cannot remove dead tuples that its snapshot might still need, so every update added permanent bloat.',
      fix: 'Kill the long transaction, set <code>idle_in_transaction_session_timeout</code>, move reporting to a replica (with <code>hot_standby_feedback</code> understood). Reclaim space with pg_repack.',
      fixCode: `ALTER SYSTEM SET idle_in_transaction_session_timeout = '5min';\nSELECT pg_reload_conf();` },
    { title: 'Oracle nightly report fails with ORA-01555',
      symptom: 'A 3-hour report fails near the end with “snapshot too old” on busy nights.',
      cause: 'The report needs before-images from undo to rebuild old rows, but the undo was overwritten by heavy daytime writes.',
      fix: 'Increase undo retention and size (or guarantee retention), make the report faster, or run it on a standby / reporting copy.' }
  ],
  puzzles: [
    { kind: 'predict', q: 'With the seed data, what is the ctid of Asha’s row (id 1) after this UPDATE?', code: `UPDATE acct SET balance = 80 WHERE id = 1;\nSELECT ctid FROM acct WHERE id = 1;`, options: ['(0,2)', '(0,6)', '(0,1)', '(1,1)'], answer: 1, explain: 'Five rows fill slots 1–5 of page 0 (Asha was inserted second, at (0,2)). The update writes a new tuple in the next free slot on the same page: <b>(0,6)</b>.' },
    { kind: 'predict', q: 'Without ORDER BY, which id comes first?', code: `SELECT id FROM acct LIMIT 1;`, options: ['1 (lowest PK)', '3 (first inserted)', '5 (highest PK)', 'Random each time'], answer: 1, explain: 'Postgres stores rows in a heap. A seq scan reads page 0 slot 1 first, which is the first inserted row: <b>3</b>. (In InnoDB, a full scan follows the clustered PK order.) Never rely on either: use ORDER BY.' },
    { kind: 'concept', q: 'In InnoDB, a secondary index on <code>email</code> stores which pointer in its leaves?', options: ['A physical page/slot address', 'The primary key value', 'A hash of the row', 'Nothing; it holds the full row'], answer: 1, explain: 'InnoDB secondary indexes store the PK value, so a lookup descends the secondary index and then the clustered PK index. Rows can move during page splits without updating secondary indexes.' },
    { kind: 'concept', q: 'Where does Postgres keep the old version of a row after an UPDATE?', options: ['In an undo log', 'In the table heap, as a dead tuple', 'In WAL only', 'In tempdb'], answer: 1, explain: 'Postgres writes a new tuple and keeps the old one in the heap until VACUUM removes it. That is why bloat and VACUUM tuning are Postgres-specific skills.' },
    { kind: 'concept', q: 'A company needs one database for a regulated bank core with existing Oracle DBAs and RAC licences. Migrating to Postgres saves licence fees. Strongest reason to stay for now?', options: ['Postgres is slower', 'The team’s operational expertise and existing HA design (RAC, Data Guard) are proven; migration risk outweighs savings in the short term', 'Postgres has no transactions', 'Oracle is the only one with SQL'], answer: 1, explain: 'Team skill and migration risk are real requirements. A good answer gives a plan: move new, lower-risk services to Postgres first and build expertise.' },
    { kind: 'concept', q: 'Which change most reduces InnoDB secondary-index size?', options: ['Adding more secondary indexes', 'Changing the PK from CHAR(36) UUID to BIGINT', 'Using REPEATABLE READ', 'Increasing the buffer pool'], answer: 1, explain: 'Every secondary index entry contains the PK. Shrinking the PK from 36 bytes to 8 bytes shrinks every secondary index.' }
  ],
  interview: [
    { q: 'Explain heap tables vs clustered indexes, and what it means for PK design.', a: '<p>Heap (Postgres, Oracle default): rows anywhere, every index points at a physical TID/ROWID, and the PK index is just another index. Clustered (InnoDB always, SQL Server by default): the table is the PK B-tree, and secondary indexes store the PK. So in InnoDB the PK should be <b>small and increasing</b>; range scans on the PK are very cheap. In Postgres, updates that move a row must update every index (unless HOT), but PK choice affects fewer things.</p>', fu: 'How does SQL Server handle a table without a clustered index? (It is a heap; nonclustered indexes then use a RID.)', lvl: 'core' },
    { q: 'Compare MVCC in Postgres and InnoDB. Which operational problems does each create?', a: '<p>Postgres: UPDATE writes a new tuple; old ones stay in the heap until VACUUM. Problems: table and index bloat, autovacuum tuning, transaction ID wraparound (freezing). InnoDB / Oracle: update in place, before-image to undo. Problems: undo history growth with long transactions, slower reads walking version chains, ORA-01555 in Oracle. Both are hurt by long-running transactions.</p>', lvl: 'deep' },
    { q: 'What are HOT updates and why do they matter?', a: '<p>Heap-Only Tuple: if no indexed column changes and the new version fits on the same page, Postgres links it from the old one and does not add index entries. That cuts index write amplification and bloat. Lowering <code>fillfactor</code> leaves room on pages and makes HOT more likely for frequently updated tables.</p>', lvl: 'deep' },
    { q: 'Compare the replication options.', a: '<ul><li><b>Postgres</b>: physical streaming (async or sync) for HA and read replicas; logical replication (PG10+) for selective tables, upgrades and CDC. Failover via Patroni or managed services.</li><li><b>MySQL</b>: binlog replication (async / semi-sync), GTIDs; Group Replication / InnoDB Cluster for automated failover.</li><li><b>Oracle</b>: Data Guard (physical standby, Active Data Guard for reads is a paid option), GoldenGate (logical), RAC (shared-disk cluster, not geo replication).</li><li><b>SQL Server</b>: Always On Availability Groups, log shipping, transactional replication.</li></ul>', lvl: 'core' },
    { q: 'When would you pick each of the four?', a: '<ul><li><b>Postgres</b>: the default for new systems: free, extensible (PostGIS, pgvector, Timescale, Citus), strong SQL, every cloud offers it.</li><li><b>MySQL</b>: existing MySQL estate or expertise, simple high-volume OLTP, mature tooling (Vitess for sharding).</li><li><b>Oracle</b>: existing enterprise estate, RAC/Data Guard requirements, vendor apps certified only on Oracle, a team of Oracle DBAs.</li><li><b>SQL Server</b>: Microsoft/.NET shops, tight integration with Windows/AD, SSIS/SSRS, Azure.</li></ul>', lvl: 'core' },
    { q: 'Why is the Postgres extension ecosystem an architectural advantage?', a: '<p>Extensions add types, index methods and functions inside the same transactional engine: PostGIS (geospatial), pgvector (vectors), pg_trgm (fuzzy text), TimescaleDB (time series), Citus (sharding), pg_partman, pg_stat_statements. You can often avoid a second store and its sync problems. Check which extensions your managed provider supports.</p>', lvl: 'core' },
    { q: 'How does licensing affect architecture?', a: '<p>Per-core licences push teams to consolidate onto few big servers and to avoid extra replicas (each standby may need licences, depending on use). Free engines make it cheap to add read replicas, test environments and per-service databases. Include DR, staging and paid options in the cost model.</p>', lvl: 'deep' },
    { q: 'What is the InnoDB “double lookup”, and how do you avoid it?', a: '<p>A secondary-index lookup returns a PK, which then requires a descent of the clustered index. Avoid it with a <b>covering index</b>: InnoDB secondary indexes already include the PK columns, so an index on <code>(email)</code> covers <code>SELECT id FROM users WHERE email=?</code>. Add the other needed columns to the index for wider queries.</p>', lvl: 'deep' },
    { q: 'You are migrating from MySQL to Postgres. What breaks?', a: '<p>Default isolation (RR → RC), case sensitivity and collation of string comparisons, <code>ON DUPLICATE KEY</code> → <code>ON CONFLICT</code>, AUTO_INCREMENT → identity/sequences, implicit type conversions MySQL allows, zero dates, GROUP BY behaviour, and operational habits (VACUUM, connection pooling with PgBouncer since Postgres uses a process per connection).</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'PK strategy that works on both engines', lang: 'java', code: `@Entity
@Table(name = "orders")
public class Order {
  // Sequence-based BIGINT: compact and increasing -> good for InnoDB's clustered index,
  // and lets Hibernate batch inserts in Postgres (IDENTITY disables JDBC insert batching).
  @Id
  @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "order_seq")
  @SequenceGenerator(name = "order_seq", sequenceName = "order_seq", allocationSize = 50)
  private Long id;

  // Public, unguessable id kept separate from the clustered key
  @Column(name = "public_id", nullable = false, unique = true, updatable = false)
  private UUID publicId = UUID.randomUUID();
}`, note: 'MySQL has no sequences: there Hibernate uses IDENTITY (AUTO_INCREMENT), which is still small and increasing.' }
  ]
});

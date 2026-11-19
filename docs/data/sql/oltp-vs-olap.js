IA.register({
  track: 'sql',
  slug: 'oltp-vs-olap',
  title: 'OLTP vs OLAP: rows vs columns',
  tagline: 'An OLTP engine stores <b>rows</b> together, so fetching one order is one page read. An OLAP engine stores <b>columns</b> together, so <code>SUM(amount)</code> over a billion rows reads only the amount column, compressed, processed in vectors. Same SQL, opposite physical layouts.',
  tldr: {
    problem: 'Dashboards that aggregate billions of rows run on the OLTP Postgres, read every column of every row, evict the hot working set, and slow checkout.',
    model: '<b>Row store</b>: a page holds whole rows: great for point reads and updates, wasteful for scanning one column. <b>Column store</b>: a block holds one column’s values: reads only needed columns, compresses well (similar values together), and runs vectorized. Move data from OLTP to OLAP via CDC or batch ETL.',
    hook: '“Why is our 40-column fact table so slow in Postgres when the query only touches 3 columns?” Because a heap page holds whole rows: you read all 40 to use 3.',
    facts: [
      { v: '1/N', l: 'of the bytes a column store reads for a query that touches 1 of N columns (before compression)' },
      { v: '~24 B', l: 'Postgres tuple header per row: even a one-column heap table is far bigger than a packed column' },
      { v: 'CDC', l: 'streams changes from the WAL (logical decoding / Debezium) with seconds of lag; batch ETL gives hours' }
    ]
  },
  intro: {
    what: 'Databases serve two very different jobs. <b>OLTP</b> (transactions) handles many small requests: “show order 42”, “add this item to the cart”. <b>OLAP</b> (analytics) handles few huge questions: “revenue per region per month for 3 years”. The best way to lay data out on disk is different for each, so analytics usually moves to a separate <b>columnar</b> database.',
    analogy: { icon: '🧾', title: 'Receipts vs a ledger column', text: 'A pile of receipts (rows) is perfect when a customer asks about <i>their</i> purchase: grab one receipt. To total all sales, you must pick up every receipt and read just one number from each. A ledger with an “amount” column (columnar) lets you run a finger down one column, and repeated values are easy to abbreviate.' },
    steps: [
      { t: 'Row storage (OLTP)', d: 'Each row’s values sit together on a page. Read or update one row = touch one page.' },
      { t: 'Column storage (OLAP)', d: 'All values of one column sit together. Summing one column = read only that column.' },
      { t: 'Compression and vectors', d: 'A column has similar values (many “EU”s), so it compresses well. Engines process thousands of values per CPU instruction batch (vectorized execution).', code: "SELECT region, sum(amount)\nFROM sales\nWHERE created_at >= '2026-01-01'\nGROUP BY region;" },
      { t: 'Keep them separate', d: 'Postgres stays the system of record. Changes are copied to the warehouse by <b>CDC</b> (streaming) or <b>batch ETL</b> (nightly).' }
    ],
    widget: 'oltp-vs-olap-intro',
    terms: [
      ['OLTP', 'Many small, concurrent read/write transactions on a few rows each.'],
      ['OLAP', 'Analytical queries that scan and aggregate many rows, usually few columns.'],
      ['columnar storage', 'Storing each column’s values together, instead of each row’s.'],
      ['vectorized execution', 'Processing a batch of values (e.g. 1,024) per operator call, using CPU caches and SIMD well.'],
      ['CDC', 'Change data capture: reading inserts, updates and deletes from the database log and streaming them elsewhere.']
    ]
  },
  visual: {
    title: 'Read one row vs aggregate one column',
    caption: 'Choose a layout and a query, then press Play. Highlighted blocks are read from disk; the counters show how many values were read vs how many were actually needed.'
  },
  extras: [
    { id: 'oltp-vs-olap-pipeline', title: 'Getting data out of Postgres: CDC vs batch ETL', label: 'CDC vs ETL', caption: 'Simulate a day of changes. Compare freshness, load on the primary, and what happens to deletes and intermediate updates.' },
    { id: 'oltp-vs-olap-matrix', title: 'Where the OLAP engines sit', label: 'Engines', caption: 'Positioning, not a ranking. Filter by deployment model or sort by any column.' }
  ],
  playground: {
    setup: `
CREATE TABLE sales (id bigint PRIMARY KEY, created_at timestamptz NOT NULL, region text,
  customer_note text, sku text, qty int, amount numeric(10,2));
INSERT INTO sales
SELECT g, timestamptz '2026-01-01 00:00+00' + g * interval '1 minute', (ARRAY['EU','US','APAC'])[1 + g % 3],
       repeat('note ', 20), 'SKU-' || (g % 500), 1 + g % 5, (g % 1000) / 10.0
FROM generate_series(1, 50000) g;
-- a poor man's "column": the amount values alone
CREATE TABLE sales_amount_col AS SELECT amount FROM sales;
ANALYZE;`,
    presets: [
      { label: 'Row width', sql: `SELECT avg(pg_column_size(s.*))::int AS bytes_per_row,\n       avg(pg_column_size(amount))::int AS bytes_of_amount\nFROM sales s;`, note: 'Each row is ~164 bytes, but SUM(amount) needs ~7 of them. A row store reads all 164.' },
      { label: 'Aggregate: pages read', sql: `EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)\nSELECT sum(amount) FROM sales;`, note: '<code>shared hit=1064</code>: every page of the table is read to sum one column.' },
      { label: 'Simulated column', sql: `EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)\nSELECT sum(amount) FROM sales_amount_col;`, note: 'Only 256 pages, about 4× fewer. Still not truly columnar: each value carries a ~24-byte tuple header. A real column store packs and compresses values, often 10× smaller again.' },
      { label: 'Table sizes', sql: `SELECT relname, relpages, pg_size_pretty(pg_relation_size(oid)) AS size\nFROM pg_class WHERE relname IN ('sales', 'sales_amount_col')\nORDER BY relpages DESC;` },
      { label: 'BRIN for time', sql: `CREATE INDEX sales_brin ON sales USING brin (created_at);\nSELECT pg_size_pretty(pg_relation_size('sales_brin')) AS brin_size,\n       pg_size_pretty(pg_relation_size('sales_pkey')) AS btree_pk_size;`, note: 'For append-only, time-ordered data a BRIN index is tiny (a few pages) and prunes block ranges for time filters. A good “stay on Postgres longer” tool.' },
      { label: 'Rollup (mat. view)', sql: `CREATE MATERIALIZED VIEW daily AS\nSELECT date_trunc('day', created_at) AS day, region, sum(amount) AS revenue, count(*) AS n\nFROM sales GROUP BY 1, 2;\nSELECT * FROM daily ORDER BY day, region LIMIT 6;`, note: 'Pre-aggregation: dashboards read 105 rows instead of 50,000. Refresh with <code>REFRESH MATERIALIZED VIEW CONCURRENTLY</code> (needs a unique index).' }
    ]
  },
  gotchas: [
    { trap: 'Running BI on the OLTP primary', why: 'Large scans fill shared buffers with cold pages, use CPU and I/O, and long queries hold back VACUUM (old snapshots).', fix: 'First step: a read replica for reports (watch <code>hot_standby_feedback</code> and replication conflicts). Next: CDC into a columnar store.' },
    { trap: 'SELECT * on a columnar warehouse', why: 'Column stores bill and run by columns read (BigQuery charges by bytes scanned). <code>SELECT *</code> reads every column, removing the main advantage.', fix: 'Select only needed columns; use partitioning / clustering keys so filters skip data.' },
    { trap: 'Single-row updates and deletes in OLAP engines', why: 'Columnar data is stored in large immutable parts/micro-partitions. Updating one row rewrites or marks a whole block; ClickHouse mutations are asynchronous and heavy.', fix: 'Model as append-only (events, versions), use engines built for upserts (e.g. ClickHouse ReplacingMergeTree, with care), or batch merges.' },
    { trap: 'Batch ETL with “updated_at > last_run”', why: 'Misses hard deletes, misses rows whose <code>updated_at</code> wasn’t set, and races with transactions that commit late with an older timestamp.', fix: 'Prefer log-based CDC (logical decoding, Debezium), which sees every committed insert, update and delete in commit order.' },
    { trap: 'Forgetting the replication slot', why: 'A logical replication slot keeps WAL until the consumer confirms it. If the CDC connector is down for days, WAL fills the disk of the primary.', fix: 'Monitor <code>pg_replication_slots</code> retained WAL; set <code>max_slot_wal_keep_size</code> (PG13+); alert and drop abandoned slots.' },
    { trap: 'Believing HTAP removes the need to separate workloads', why: 'Systems that do both still share CPU, memory and I/O. Analytics bursts can still hurt OLTP latency, and freshness/consistency of the analytic copy has caveats.', fix: 'Check isolation mechanisms (separate replicas or resource groups) and measure OLTP p99 under analytic load before relying on it.' }
  ],
  scenarios: [
    { title: 'Monday 9 a.m.: checkout latency triples when dashboards refresh',
      symptom: 'p99 for checkout goes from 40 ms to 150 ms every time the BI tool refreshes 30 dashboards.',
      diagnose: `SELECT pid, now() - query_start AS runtime, left(query, 80)\nFROM pg_stat_activity\nWHERE state = 'active' AND backend_type = 'client backend'\nORDER BY runtime DESC LIMIT 10;`,
      cause: 'Dashboards run full-table aggregates on the primary, competing for I/O and evicting the hot OLTP working set from shared buffers.',
      fix: 'Route BI to a replica now; stream changes to a columnar warehouse (Debezium → Kafka → ClickHouse/BigQuery) and repoint dashboards.' },
    { title: 'Primary disk full on Sunday night',
      symptom: 'The OLTP database stopped accepting writes; <code>pg_wal</code> is 400 GB.',
      diagnose: `SELECT slot_name, active,\n  pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained\nFROM pg_replication_slots;`,
      cause: 'The Debezium connector had been failing since Friday. Its logical slot kept every WAL segment since then.',
      fix: 'Restore the connector or drop the slot (then re-snapshot). Set <code>max_slot_wal_keep_size</code> and alert on retained WAL.',
      fixCode: `ALTER SYSTEM SET max_slot_wal_keep_size = '50GB';\nSELECT pg_reload_conf();` },
    { title: 'Warehouse revenue is higher than the ledger',
      symptom: 'Finance totals in the warehouse exceed Postgres by 0.3%.',
      cause: 'The nightly ETL copied rows where <code>updated_at</code> changed, but cancelled orders were hard-deleted in Postgres, and deletes never reached the warehouse.',
      fix: 'Switch to CDC (deletes arrive as events), or use soft deletes; add a daily reconciliation of counts and sums per day.' }
  ],
  puzzles: [
    { kind: 'predict', q: 'How many 8 KB pages does Postgres read for <code>SUM(amount)</code> over the seed <code>sales</code> table?', code: `SELECT relpages FROM pg_class WHERE relname = 'sales';`, options: ['~256 (just the amount data)', '1064 (the whole table)', '1', '50000'], answer: 1, explain: 'A seq scan reads every heap page: <b>1064</b>. The row store cannot read only the amount column.' },
    { kind: 'predict', q: 'How many rows does the daily-per-region rollup contain? (50,000 minutes ≈ 34.7 days, 3 regions)', code: `SELECT count(*) FROM (\n  SELECT date_trunc('day', created_at), region\n  FROM sales GROUP BY 1, 2) t;`, options: ['35', '102', '105', '50000'], answer: 2, explain: '35 distinct days (the last one partial) × 3 regions = <b>105</b> rows. Dashboards on the rollup read 105 rows instead of 50,000.' },
    { kind: 'concept', q: 'Why do columns compress better than rows?', options: ['Columns are always numbers', 'Values in one column share type and often repeat or are sorted, so dictionary, run-length and delta encodings work well', 'Column stores use a better zip library', 'They don’t; rows compress better'], answer: 1, explain: 'Homogeneous, repetitive data compresses well: “EU, EU, EU, US…” becomes a dictionary + run lengths; timestamps become small deltas.' },
    { kind: 'concept', q: 'Which query is a column store <b>worst</b> at, relative to a row store?', options: ['SELECT region, sum(amount) … GROUP BY region', 'SELECT * FROM orders WHERE id = 42, plus updating it', 'SELECT count(*) WHERE created_at > …', 'SELECT avg(price) FROM products'], answer: 1, explain: 'Fetching one full row means reading a block from every column file and reassembling it, and updating it rewrites immutable column blocks.' },
    { kind: 'concept', q: 'Your team uses a nightly ETL with <code>WHERE updated_at > :last_run</code>. What can it miss?', options: ['Nothing if updated_at is indexed', 'Hard deletes, and rows from transactions that committed after the run but carry an earlier timestamp', 'Inserts', 'Only rows with NULL amount'], answer: 1, explain: 'Timestamps are set when the row is written, not at commit. Log-based CDC reads committed changes in commit order, including deletes.' },
    { kind: 'concept', q: 'A 200 GB analytics dataset, 3 analysts, ad-hoc queries on laptops and in notebooks. Simplest good option?', options: ['A 20-node Redshift cluster', 'DuckDB over Parquet exports (or a small managed warehouse)', 'Run it on the OLTP primary', 'Cassandra'], answer: 1, explain: 'DuckDB is an in-process columnar engine: no servers, fast on a single machine for hundreds of GB. Scale up to a managed warehouse when concurrency and data size grow.' }
  ],
  interview: [
    { q: 'Explain why columnar storage is faster for analytics.', a: '<ul><li><b>I/O</b>: read only referenced columns.</li><li><b>Compression</b>: similar values compress 5–10× or more, so less I/O and more data fits in memory.</li><li><b>Skipping</b>: per-block min/max (zone maps) skip blocks that can’t match.</li><li><b>Vectorized execution</b>: operators process batches of values in tight loops (SIMD, cache-friendly), instead of one row at a time.</li></ul>', lvl: 'core' },
    { q: 'Position ClickHouse, Snowflake, BigQuery, Redshift and DuckDB.', a: '<ul><li><b>ClickHouse</b>: open-source columnar engine (self-hosted or cloud), very fast scans and real-time ingest; MergeTree family; updates are mutations.</li><li><b>Snowflake</b>: managed warehouse, storage separated from compute (virtual warehouses), multi-cloud.</li><li><b>BigQuery</b>: serverless on Google Cloud, pay per bytes scanned or reserved slots.</li><li><b>Redshift</b>: AWS warehouse (provisioned or serverless), Postgres-derived SQL dialect.</li><li><b>DuckDB</b>: embedded, in-process columnar engine; great for local analysis and Parquet.</li></ul>', lvl: 'core' },
    { q: 'CDC vs batch ETL: trade-offs?', a: '<p>CDC (logical decoding / Debezium): seconds of lag, captures deletes and every change, low load on the primary (reads WAL), but needs a running pipeline, slot monitoring, schema-change handling. Batch ETL: simple and cheap, hours of lag, scans tables (load), misses deletes unless soft-deleted, and only sees the latest state between runs. Many teams use CDC into a lake/warehouse and batch transforms (ELT) inside it.</p>', lvl: 'core' },
    { q: 'How does Postgres logical replication/decoding work for CDC?', a: '<p>With <code>wal_level = logical</code>, a <b>replication slot</b> with an output plugin (pgoutput, used by Debezium) decodes committed changes from WAL in commit order. Publications choose tables. The slot retains WAL until the consumer confirms an LSN. <code>REPLICA IDENTITY</code> decides what old-row data is in UPDATE/DELETE events (default: the PK).</p>', fu: 'What happens to the slot on failover? (Before PG17, logical slots did not move to the standby; PG17 adds slot synchronization for failover.)', lvl: 'deep' },
    { q: 'What is HTAP, and what are the caveats?', a: '<p>Hybrid transactional/analytical processing: one system serves both, often with a row store plus a columnar replica or index (e.g. TiDB with TiFlash, SingleStore, AlloyDB’s columnar engine). Caveats: resource contention, freshness of the analytic copy, cost, and lock-in. It reduces pipelines, but you must still isolate workloads and measure OLTP latency under analytic load.</p>', lvl: 'deep' },
    { q: 'How far can you push analytics inside Postgres?', a: '<p>Partitioning by time, BRIN indexes, materialized views / rollup tables, parallel query, read replicas for isolation, and extensions (TimescaleDB compression and continuous aggregates; columnar extensions exist). It works well into hundreds of GB and simple dashboards. It struggles with ad-hoc scans over billions of rows and many concurrent heavy queries.</p>', lvl: 'core' },
    { q: 'Why does a columnar engine dislike single-row updates?', a: '<p>Data is stored in large, compressed, immutable segments sorted by a key. Changing one row means rewriting the segment or recording a delete mask plus a new version, then merging later. Engines optimize for bulk append and batch merges.</p>', lvl: 'deep' },
    { q: 'Design the path from Postgres to a dashboard with < 1 minute freshness.', a: '<p>Postgres (logical decoding, publication on the needed tables) → Debezium → Kafka (topics per table, keyed by PK) → sink to ClickHouse (or a warehouse with streaming ingest), using upsert/dedup semantics on PK + LSN. Add schema registry, slot lag alerts, a dead-letter queue, and a daily reconciliation job.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Debezium Postgres connector (Kafka Connect)', lang: 'json', code: `{
  "name": "orders-cdc",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "plugin.name": "pgoutput",
    "database.hostname": "pg-primary",
    "database.dbname": "shop",
    "database.user": "cdc_user",
    "database.password": "\${file:/secrets/pg.properties:password}",
    "topic.prefix": "shop",
    "slot.name": "orders_cdc",
    "publication.name": "orders_pub",
    "table.include.list": "public.orders,public.order_items",
    "snapshot.mode": "initial"
  }
}`, note: 'Create the publication yourself (<code>CREATE PUBLICATION orders_pub FOR TABLE orders, order_items</code>) and alert on the slot’s retained WAL.' },
    { title: 'Keep reports off the primary (Spring)', lang: 'java', code: `// Route read-only report queries to a replica DataSource
public class RoutingDataSource extends AbstractRoutingDataSource {
  @Override protected Object determineCurrentLookupKey() {
    return TransactionSynchronizationManager.isCurrentTransactionReadOnly() ? "replica" : "primary";
  }
}

@Transactional(readOnly = true)   // goes to the replica
public List<RegionRevenue> revenueByRegion(LocalDate from) { ... }`, note: 'Wrap the routing DataSource in <code>LazyConnectionDataSourceProxy</code> so the read-only flag is known before the connection is fetched.' }
  ]
});

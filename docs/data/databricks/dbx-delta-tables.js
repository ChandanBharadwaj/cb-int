IA.register({
  track: 'databricks',
  slug: 'dbx-delta-tables',
  title: 'Delta tables on Databricks',
  tagline: 'Every table you create on Databricks is a <b>Delta table</b> by default: Parquet files plus a transaction log. On top of open-source Delta, Databricks adds Unity Catalog managed tables, <b>liquid clustering</b>, deletion vectors and <b>predictive optimization</b>. MERGE, time travel and VACUUM are the daily tools.',
  tldr: {
    problem: 'Small-file explosions, over-partitioned tables, MERGEs that rewrite the whole table, and “time travel” that suddenly fails after a VACUUM.',
    model: 'Each write is a <b>commit</b> that adds and removes files in <code>_delta_log</code>. Nothing is edited in place. Old files stay until <b>VACUUM</b> removes them after the retention period, and that retention is your time-travel window.',
    hook: '“Partition or liquid clustering?” For new tables Databricks recommends liquid clustering: no folder explosion, and the keys can change later without a rewrite.',
    facts: [
      { v: '7 days', l: 'default VACUUM retention (<code>delta.deletedFileRetentionDuration</code>); VACUUM refuses shorter values unless a safety check is disabled' },
      { v: '30 days', l: 'default <code>delta.logRetentionDuration</code>: how long commit history is kept' },
      { v: 'DBR 13.3+', l: 'liquid clustering generally available (DBR 15.2+ recommended); <code>CLUSTER BY AUTO</code> needs predictive optimization' }
    ]
  },
  intro: {
    what: 'A Delta table is a folder of Parquet files plus a <code>_delta_log/</code> folder. Each change (insert, update, delete, merge, optimize) writes a new numbered JSON commit saying which files were added and which removed. Readers replay the log to know which files make up the current version. If you know the Spark track’s <a href="../spark/delta-lake-lakehouse.html">Delta Lake page</a>, this page adds what is specific to Databricks.',
    analogy: { icon: '📒', title: 'A ledger plus a storeroom', text: 'Files in the storeroom never change. The ledger says “from version 5 on, box 12 is out and box 19 is in”. To see last Tuesday you read the ledger up to Tuesday, as long as nobody threw old boxes away (VACUUM).' },
    steps: [
      { t: 'Create', d: 'Managed by default in Unity Catalog; no LOCATION needed.', code: 'CREATE TABLE main.sales.orders (\n  order_id BIGINT, customer_id BIGINT, amount DECIMAL(10,2), order_ts TIMESTAMP\n) CLUSTER BY (customer_id);', lang: 'sql' },
      { t: 'Upsert with MERGE', d: 'Insert new keys, update existing ones, in one atomic commit.', code: 'MERGE INTO main.sales.orders t\nUSING updates s ON t.order_id = s.order_id\nWHEN MATCHED THEN UPDATE SET *\nWHEN NOT MATCHED THEN INSERT *;', lang: 'sql' },
      { t: 'Look back', d: 'Every commit is a version.', code: 'DESCRIBE HISTORY main.sales.orders;\nSELECT * FROM main.sales.orders VERSION AS OF 12;', lang: 'sql' },
      { t: 'Keep it fast', d: 'OPTIMIZE compacts files and clusters data; VACUUM removes unreferenced old files.', code: 'OPTIMIZE main.sales.orders;\nVACUUM main.sales.orders;   -- default 7-day retention', lang: 'sql' }
    ],
    terms: [
      ['commit / version', 'One atomic change, recorded as <code>_delta_log/000…N.json</code>; checkpoints summarise the log periodically.'],
      ['time travel', '<code>VERSION AS OF</code> / <code>TIMESTAMP AS OF</code> reads an older snapshot.'],
      ['OPTIMIZE', 'Rewrites small files into bigger ones (and clusters data for liquid/Z-order tables).'],
      ['liquid clustering', '<code>CLUSTER BY</code>: data layout by keys without Hive partitions; keys changeable.'],
      ['deletion vectors', 'Mark deleted rows in a side file instead of rewriting the Parquet file right away.'],
      ['predictive optimization', 'Databricks runs OPTIMIZE/VACUUM/ANALYZE for UC managed tables automatically.']
    ]
  },
  visual: {
    title: 'The log, version by version',
    caption: 'Step through <b>MERGE → time travel → VACUUM</b> to see why old versions disappear, then <b>Partitioning vs liquid</b> to see the layout choice.'
  },
  gotchas: [
    { trap: 'MERGE with duplicate source keys fails', code: 'MERGE INTO t USING s ON t.id = s.id WHEN MATCHED THEN UPDATE SET *\n-- DELTA_MULTIPLE_SOURCE_ROW_MATCHING_TARGET_ROW_IN_MERGE', lang: 'sql', why: 'Two source rows match one target row, so the result would be ambiguous. Delta rejects it.', fix: 'Deduplicate the source first, keeping the latest row per key.', },
    { trap: 'MERGE rewrites far too much', why: 'Without a selective condition, MERGE has to scan the whole target to find matches and rewrites every touched file.', fix: 'Add a pruning predicate on the clustering/partition key to the ON clause (e.g. <code>AND t.order_date >= current_date() - 3</code>) and enable deletion vectors (default on new tables in recent runtimes).' },
    { trap: 'VACUUM with a short retention breaks readers', code: "SET spark.databricks.delta.retentionDurationCheck.enabled = false;\nVACUUM t RETAIN 0 HOURS;   -- running queries and streams may now fail", lang: 'sql', why: 'Long-running queries and streaming readers may still need the files you just deleted, and all time travel is gone.', fix: 'Keep at least the default 7 days. Shorten only with a reason and with no concurrent readers.' },
    { trap: 'Over-partitioning', why: 'Partitioning by a high-cardinality column (user_id, timestamp) creates thousands of folders of tiny files. Listing and planning get slow.', fix: 'Use liquid clustering. If you partition at all, use low-cardinality columns and aim for partitions of roughly 1 GB or more.' },
    { trap: 'Mixing liquid clustering with partitions or ZORDER', why: 'Liquid clustering is not compatible with Hive-style partitioning or ZORDER on the same table.', fix: 'Pick one. Migrate with CTAS / <code>CREATE OR REPLACE TABLE … CLUSTER BY</code>, or <code>ALTER TABLE … CLUSTER BY</code> on unpartitioned tables.' },
    { trap: 'Expecting OPTIMIZE to fix a table you write to every minute', why: 'Frequent small appends keep creating small files between OPTIMIZE runs.', fix: 'Enable auto compaction / optimized writes, or rely on predictive optimization for managed tables; batch upstream where you can.' }
  ],
  scenarios: [
    { title: 'Audit asks for last month’s numbers; time travel fails',
      symptom: '<code>SELECT … TIMESTAMP AS OF \'2025-05-31\'</code> fails: files referenced by that version no longer exist.',
      diagnose: `DESCRIBE HISTORY main.finance.ledger;          -- versions still listed, VACUUM ops present
SHOW TBLPROPERTIES main.finance.ledger;         -- deletedFileRetentionDuration = interval 7 days`,
      cause: 'Time travel needs both the log entries and the data files. VACUUM removed files older than 7 days. Time travel is not a backup.',
      fix: 'For audit snapshots, write explicit copies (deep clone or snapshot table) at period end, or raise retention for that table knowingly (more storage).',
      fixCode: `CREATE TABLE main.finance.ledger_2025_05 DEEP CLONE main.finance.ledger;
-- or keep 90 days of history on this table only
ALTER TABLE main.finance.ledger SET TBLPROPERTIES (
  'delta.deletedFileRetentionDuration' = 'interval 90 days',
  'delta.logRetentionDuration' = 'interval 90 days');`, lang: 'sql' },
    { title: 'Daily MERGE grew from 5 to 90 minutes',
      symptom: 'An upsert of 200k changed rows into a 2 billion-row table gets slower every week.',
      diagnose: `-- Spark UI / query profile: full scan of target, files rewritten ≈ all files
DESCRIBE DETAIL main.sales.orders;   -- numFiles 480,000, no clustering`,
      cause: 'Unclustered target, ON clause on order_id only, small files from frequent appends: every MERGE scans and rewrites a large share of files.',
      fix: 'Cluster by the key used to find matches, add a date bound to ON if changes are recent, and compact.',
      fixCode: `ALTER TABLE main.sales.orders CLUSTER BY (order_date, order_id);
OPTIMIZE main.sales.orders;   -- clusters existing data incrementally

MERGE INTO main.sales.orders t
USING updates s
ON t.order_id = s.order_id AND t.order_date >= current_date() - INTERVAL 7 DAYS
WHEN MATCHED THEN UPDATE SET *
WHEN NOT MATCHED THEN INSERT *;`, lang: 'sql' }
  ],
  puzzles: [
    { kind: 'concept', q: 'A MERGE updates 3 rows that live in one 1 GB file. Without deletion vectors, what is written?', options: ['3 rows patched inside the file', 'A new ~1 GB file with the 3 rows changed; old file marked removed', 'Only a log entry', 'The whole table is rewritten'], answer: 1, explain: 'Parquet files are immutable. Delta rewrites the touched file and commits add/remove. Deletion vectors avoid the rewrite by recording deleted rows separately (updates then write only the new rows).' },
    { kind: 'concept', q: 'Default VACUUM retention, and what it protects?', options: ['24 hours; nothing', '7 days; concurrent readers and time travel within that window', '30 days; the log', 'Forever'], answer: 1, explain: 'VACUUM keeps removed files younger than 7 days by default. The 30-day setting is log retention, a separate property.' },
    { kind: 'concept', q: 'Dropping a <b>managed</b> UC table…', options: ['Keeps files forever', 'Deletes the data (recoverable with UNDROP for a limited time)', 'Converts it to external', 'Fails if it has history'], answer: 1, explain: 'Managed tables own their data. External tables keep data on DROP.' },
    { kind: 'concept', q: 'Queries filter by <code>customer_id</code> (10M distinct values). Best layout for a new table?', options: ['PARTITIONED BY (customer_id)', 'CLUSTER BY (customer_id)', 'No layout, just OPTIMIZE', 'ZORDER BY and PARTITIONED BY customer_id'], answer: 1, explain: 'Partitioning by a 10M-cardinality column means 10M folders. Liquid clustering co-locates rows in right-sized files and enables file skipping.' },
    { kind: 'concept', q: 'Source has two rows with <code>id = 7</code>; target has one. <code>MERGE … WHEN MATCHED THEN UPDATE</code>:', options: ['Applies both, last wins', 'Applies the first', 'Fails with a multiple-source-rows error', 'Inserts a duplicate'], answer: 2, explain: 'Delta refuses ambiguous matches. Dedupe the source, e.g. with <code>ROW_NUMBER() OVER (PARTITION BY id ORDER BY ts DESC) = 1</code>.' },
    { kind: 'concept', q: 'Which statement restores a table to version 12 as a new commit?', options: ['SELECT * FROM t VERSION AS OF 12', 'RESTORE TABLE t TO VERSION AS OF 12', 'VACUUM t TO 12', 'ROLLBACK t 12'], answer: 1, explain: '<code>RESTORE</code> writes a new version whose content equals v12, so history stays linear and the restore itself can be undone.' }
  ],
  interview: [
    { q: 'How does Delta give ACID on object storage?', a: '<p>Writers stage new Parquet files, then atomically create the next log entry (<code>N.json</code>) with put-if-absent semantics. Readers use the latest committed version. Conflicts are detected optimistically: if two writers touched overlapping data, one retries or fails.</p>', lvl: 'core' },
    { q: 'Managed vs external Delta tables on Databricks?', a: '<p>Managed: UC picks the location and owns lifecycle; DROP deletes data; predictive optimization applies. External: you own the path (under an external location); DROP keeps data. Default choice is managed.</p>', lvl: 'core' },
    { q: 'What does MERGE support beyond basic upsert?', a: '<p>Multiple WHEN clauses with conditions, <code>WHEN MATCHED … DELETE</code>, <code>WHEN NOT MATCHED BY SOURCE</code> (delete or update target rows absent from the source), schema evolution with <code>WITH SCHEMA EVOLUTION</code> (newer runtimes), and <code>UPDATE SET *</code>/<code>INSERT *</code>.</p>', lvl: 'deep' },
    { q: 'Time travel: how far back can you go?', a: '<p>As far as both the log (logRetentionDuration, default 30 days) and the data files (deletedFileRetentionDuration, VACUUM, default 7 days) allow. In practice the shorter one wins. It is not a backup strategy.</p>', lvl: 'core' },
    { q: 'Liquid clustering vs partitioning vs Z-order?', a: '<ul><li><b>Partitioning:</b> folders per value; good only for low-cardinality, stable filter columns; fixed.</li><li><b>Z-order:</b> multi-column clustering during OPTIMIZE, rewrites a lot, used with partitions.</li><li><b>Liquid:</b> incremental clustering, no folders, keys changeable with ALTER, <code>CLUSTER BY AUTO</code> lets Databricks pick keys. Recommended for new tables.</li></ul>', lvl: 'deep' },
    { q: 'What are deletion vectors?', a: '<p>Bitmaps stored next to a data file marking deleted rows. DELETE/UPDATE/MERGE can then avoid rewriting the file; readers skip marked rows; OPTIMIZE or purge later rewrites files physically. Enabled by default for new tables on recent runtimes.</p>', lvl: 'deep' },
    { q: 'What does predictive optimization do?', a: '<p>For UC managed tables, Databricks decides when to run OPTIMIZE, VACUUM and statistics collection, using serverless compute billed to you. It removes the need for most maintenance jobs.</p>', lvl: 'core' },
    { q: 'How would you handle GDPR deletes on a Delta table?', a: '<p>DELETE the rows (with deletion vectors this is cheap), then make sure the data is physically gone: purge deletion vectors / OPTIMIZE, and VACUUM after retention. Remember history: old versions still contain the data until VACUUM.</p>', lvl: 'deep' },
    { q: 'What is Change Data Feed?', a: '<p>A table property (<code>delta.enableChangeDataFeed = true</code>) that records row-level inserts, updates (pre/post image) and deletes per version, readable with <code>table_changes()</code> or <code>readChangeFeed</code>. Used to propagate changes downstream incrementally.</p>', lvl: 'deep' },
    { q: 'What is a shallow vs deep clone?', a: '<p>Deep clone copies data files and metadata: an independent copy. Shallow clone copies only metadata and points at the source files: cheap for tests, but depends on source files not being vacuumed.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Dedupe then MERGE (PySpark)', lang: 'python', code: `from delta.tables import DeltaTable
from pyspark.sql import functions as F, Window

w = Window.partitionBy("order_id").orderBy(F.col("updated_at").desc())
src = (spark.read.table("main.bronze.orders_changes")
         .withColumn("rn", F.row_number().over(w)).where("rn = 1").drop("rn"))

(DeltaTable.forName(spark, "main.silver.orders").alias("t")
   .merge(src.alias("s"), "t.order_id = s.order_id")
   .whenMatchedUpdateAll(condition="s.updated_at > t.updated_at")
   .whenNotMatchedInsertAll()
   .execute())` },
    { title: 'Maintenance and inspection', lang: 'sql', code: `DESCRIBE DETAIL main.silver.orders;          -- numFiles, sizeInBytes, clusteringColumns
DESCRIBE HISTORY main.silver.orders LIMIT 5;  -- operation, operationMetrics
ALTER TABLE main.silver.orders CLUSTER BY AUTO;   -- needs predictive optimization
SELECT * FROM table_changes('main.silver.orders', 41);  -- needs CDF enabled` }
  ]
});

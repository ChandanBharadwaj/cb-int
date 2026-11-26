IA.register({
  track: 'spark',
  slug: 'delta-lake-lakehouse',
  title: 'Delta Lake & the lakehouse',
  tagline: 'A Delta table is Parquet files plus a <b>transaction log</b>. The log lists which files make up each version, so you get ACID commits, time travel, MERGE and schema enforcement on cheap object storage. Think “Postgres’s WAL and MVCC, but for a folder of files”.',
  tldr: {
    problem: 'Plain Parquet folders have no transactions: a failed job leaves half-written files, readers see partial results, two writers corrupt each other, and updating one row means rewriting everything by hand.',
    model: 'Every commit writes new data files, then atomically adds <code>_delta_log/000…N.json</code> listing <b>add</b> and <b>remove</b> actions. A reader replays the log (from the latest checkpoint) to get the set of live files for a version. Old files stay until <b>VACUUM</b>, which is what makes time travel possible.',
    hook: '“Two jobs MERGE into the same table at once. What happens?” Optimistic concurrency: both write files, the first commit wins, the second checks for conflicts and either retries or fails with a <code>ConcurrentModificationException</code> subtype.',
    facts: [
      { v: '7 days', l: 'default VACUUM retention (<code>delta.deletedFileRetentionDuration</code>). Shorter needs disabling a safety check' },
      { v: '30 days', l: 'default log retention (<code>delta.logRetentionDuration</code>): how far back the log keeps history entries' },
      { v: '10', l: 'commits between Parquet checkpoints of the log by default (<code>delta.checkpointInterval</code>)' }
    ]
  },
  intro: {
    what: 'A <b>data lake</b> is files (usually Parquet) in cloud storage: cheap and scalable, but with no transactions. A <b>data warehouse</b> has transactions and SQL but is costlier and closed. A <b>lakehouse</b> puts a table format on top of the lake files to get warehouse features. <b>Delta Lake</b> is one such format (Apache Iceberg and Apache Hudi are others). Its key idea is a log of commits next to the data files.',
    analogy: { icon: '📒', title: 'A ledger next to a filing cabinet', text: 'The cabinet holds documents (Parquet files) that are never edited. The ledger (transaction log) has numbered pages: “v3: add file 7, remove file 2”. To know what the table looked like on any day, read the ledger up to that page. Throwing away old documents (VACUUM) is what stops you going further back.' },
    steps: [
      { t: 'Write a Delta table', d: 'Same API as Parquet, different format.', code: 'df.write.format("delta").saveAsTable("sales")' },
      { t: 'Look at the folder', d: 'Parquet files plus <code>_delta_log/</code> with one JSON file per commit.', code: 'sales/\n  part-0000-….parquet\n  _delta_log/00000000000000000000.json' },
      { t: 'Update rows with MERGE', d: 'Upserts like Postgres <code>INSERT … ON CONFLICT</code>. Delta rewrites only the files containing matched rows (or writes deletion vectors).', code: 'MERGE INTO sales t USING updates s ON t.id = s.id\nWHEN MATCHED THEN UPDATE SET *\nWHEN NOT MATCHED THEN INSERT *' },
      { t: 'Travel back in time', d: 'Read an old version for audits, debugging or rollback.', code: 'SELECT * FROM sales VERSION AS OF 3' },
      { t: 'Keep it healthy', d: 'Compact small files, then clean up old ones.', code: 'OPTIMIZE sales;\nVACUUM sales;   -- removes unreferenced files older than 7 days' }
    ],
    terms: [
      ['transaction log', '<code>_delta_log/</code>: ordered JSON commits plus periodic Parquet checkpoints.'],
      ['add / remove action', 'Log entries saying a data file joined or left the table in this version.'],
      ['time travel', 'Querying an older version or timestamp of a table.'],
      ['optimistic concurrency', 'Writers don’t lock; they check for conflicting commits when they try to commit.'],
      ['OPTIMIZE / Z-order / liquid clustering', 'Compaction and data layout so queries skip more files.'],
      ['deletion vectors', 'Marks deleted rows in a side file instead of rewriting the Parquet file.']
    ]
  },
  visual: {
    title: 'The transaction log, commit by commit',
    caption: 'Press <b>Play</b> or <b>Step</b> through write, append, MERGE, OPTIMIZE and VACUUM. The left shows files in storage, the right the log. Pick a version under “time travel” to see which files a reader of that version uses, and what VACUUM takes away.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Simulation: replaying the Delta log', code: `# SIMULATION in plain Python: how a reader computes the live files of a version.
log = [
    {"v": 0, "op": "WRITE",    "add": ["f1", "f2"], "remove": []},
    {"v": 1, "op": "APPEND",   "add": ["f3"],       "remove": []},
    {"v": 2, "op": "MERGE",    "add": ["f4"],       "remove": ["f2"]},
    {"v": 3, "op": "OPTIMIZE", "add": ["f5"],       "remove": ["f1", "f3", "f4"]},
]

def snapshot(version):
    live = set()
    for c in log:
        if c["v"] > version: break
        live |= set(c["add"]); live -= set(c["remove"])
    return sorted(live)

for v in range(4):
    print(f"v{v}:", snapshot(v))

# VACUUM deletes files that are not live in the latest version (and older than retention)
all_files = {f for c in log for f in c["add"]}
print("VACUUM could delete:", sorted(all_files - set(snapshot(3))))
print("after that, time travel to v0..v2 fails: their files are gone")` }
    ]
  },
  gotchas: [
    { trap: 'VACUUM with a short retention breaks readers and time travel', code: `SET spark.databricks.delta.retentionDurationCheck.enabled = false;\nVACUUM sales RETAIN 0 HOURS;`, why: 'VACUUM deletes files no longer referenced by the current version. A long-running query or stream still reading an older snapshot then fails with missing files, and time travel to older versions stops working.', fix: 'Keep the 7-day default unless you have a reason; never go below your longest query or stream lag. Use <code>VACUUM … DRY RUN</code> first.' },
    { trap: 'MERGE with duplicate source keys', code: `MERGE INTO t USING updates s ON t.id = s.id   -- updates has id 42 twice\nWHEN MATCHED THEN UPDATE SET *`, why: 'If several source rows match the same target row, the update is ambiguous, and Delta fails the MERGE (“multiple source rows matched…”).', fix: 'Deduplicate the source first, e.g. keep the latest per key with a window function.' },
    { trap: 'Many small files from streaming or frequent appends', why: 'Each micro-batch adds files. After a day you have tens of thousands of small files: slow listing, slow planning, slow reads.', fix: 'Run <code>OPTIMIZE</code> regularly, enable optimized writes / auto compaction where your platform supports it, or use liquid clustering.' },
    { trap: 'Schema drift silently rejected or silently merged', why: 'By default Delta enforces the table schema: a write with an extra column fails. With <code>mergeSchema=true</code> new columns are added automatically, which can let typos into the table.', fix: 'Keep enforcement on for curated tables. Allow <code>mergeSchema</code> only in bronze/raw layers, or evolve schemas explicitly with <code>ALTER TABLE ADD COLUMN</code>.' },
    { trap: 'Over-partitioning', code: `df.write.partitionBy("customer_id").format("delta")...   # 2 M partitions`, why: 'High-cardinality partition columns create millions of directories with tiny files. Partitioning only helps when partitions are large (commonly ≥ 1 GB) and the column is filtered on.', fix: 'Partition by a low-cardinality column such as a date, or not at all; use Z-ordering or liquid clustering for high-cardinality filter columns.' },
    { trap: 'Concurrent writers to the same partition', why: 'Optimistic concurrency means two jobs that both rewrite files in the same partition conflict: one fails with <code>ConcurrentAppendException</code> or <code>ConcurrentDeleteReadException</code>.', fix: 'Make the conflicting operations touch disjoint data (explicit partition predicates in the MERGE condition), serialise them, or retry with backoff.' }
  ],
  scenarios: [
    { title: 'A bad deploy overwrote yesterday’s data',
      symptom: 'A job ran with a wrong filter and <code>mode("overwrite")</code>. The <code>orders</code> table now has 3% of its rows.',
      diagnose: `DESCRIBE HISTORY orders;   -- version 812 = WRITE mode Overwrite, 10:42`,
      cause: 'An overwrite is just a commit that removes all old files and adds new ones. The old files are still there until VACUUM.',
      fix: 'Restore the version before the bad commit, then fix the job.',
      fixCode: `RESTORE TABLE orders TO VERSION AS OF 811;
-- or compare first:
SELECT count(*) FROM orders VERSION AS OF 811;` },
    { title: 'Nightly MERGE takes 3 hours for 50,000 changed rows',
      symptom: 'An upsert of a small change set into a 4 TB table rewrites hundreds of GB.',
      diagnose: `DESCRIBE HISTORY dim_customer;   -- operationMetrics: numTargetFilesRemoved = 9,800`,
      cause: 'The MERGE condition only had <code>t.id = s.id</code>; changed ids were spread over every file, so nearly every file contained a match and was rewritten. No data skipping was possible.',
      fix: 'Cluster the table by the merge key so matches concentrate in few files, add a partition/time predicate if the changes are recent, and enable deletion vectors (readable since Delta 2.3; DELETE, UPDATE and MERGE gained DV writes across 2.4–3.1, so check your version) so matched rows are marked instead of rewriting files.',
      fixCode: `ALTER TABLE dim_customer CLUSTER BY (id);          -- liquid clustering (Delta 3.1+)
ALTER TABLE dim_customer SET TBLPROPERTIES ('delta.enableDeletionVectors' = true);
OPTIMIZE dim_customer;` },
    { title: 'Streaming reader fails with FileNotFoundException',
      symptom: 'A downstream stream that reads a Delta table was paused for two weeks; on restart it fails reading files that “don’t exist”.',
      cause: 'A weekly <code>VACUUM</code> (7-day retention) removed files the stream’s checkpoint still pointed to.',
      fix: 'Increase retention to cover the longest pause you support, or restart the stream from a new checkpoint and backfill.',
      fixCode: `ALTER TABLE events SET TBLPROPERTIES (
  'delta.deletedFileRetentionDuration' = 'interval 30 days',
  'delta.logRetentionDuration' = 'interval 60 days');` }
  ],
  puzzles: [
    { kind: 'concept', q: 'What makes a Delta commit atomic on object storage?', options: ['A lock in a database', 'Writing the next numbered log file is done with “put if absent”: only one writer can create <code>000…N.json</code>', 'Parquet files are written atomically', 'Spark’s driver holds a mutex'], answer: 1, explain: 'Data files are written first (invisible until referenced). The commit is creating the next log entry, which must be mutually exclusive. On S3 that historically needed a coordination service (e.g. a DynamoDB-based LogStore); newer S3 conditional writes help.' },
    { kind: 'concept', q: 'You run <code>DELETE FROM t WHERE id = 7</code> on a table without deletion vectors. What changes in storage?', options: ['The row is removed in place from its Parquet file', 'The file containing id 7 is rewritten without it; the log removes the old file and adds the new one', 'Nothing until VACUUM', 'A tombstone row is appended'], answer: 1, explain: 'Parquet is immutable. Delta rewrites the affected file(s) (copy-on-write). With deletion vectors enabled, it instead writes a small bitmap marking the deleted row.' },
    { kind: 'concept', q: 'Default settings. After VACUUM, how far back can you time travel?', options: ['30 days', 'About 7 days (the file retention), even though log entries exist for 30', 'Forever', 'Only the current version'], answer: 1, explain: 'Time travel needs both the log entries <b>and</b> the data files. VACUUM removes unreferenced files older than 7 days, so older versions can no longer be read.' },
    { kind: 'concept', q: 'Two jobs append to the same Delta table at the same time (blind appends, no reads). Outcome?', options: ['One fails with ConcurrentAppendException', 'Both succeed: blind appends don’t conflict', 'The table is corrupted', 'They are serialised by a lock'], answer: 1, explain: 'Pure appends don’t read data, so the second writer finds no logical conflict, retries the commit as the next version, and succeeds. Conflicts arise when an operation read files that another commit changed.' },
    { kind: 'concept', q: 'Which statement about Z-ordering vs liquid clustering is right?', options: ['They are identical', 'Z-order is applied by <code>OPTIMIZE … ZORDER BY</code> and must be redone; liquid clustering (<code>CLUSTER BY</code>, Delta 3.1+) is a table property applied incrementally and can change keys without rewriting', 'Liquid clustering requires partitioning', 'Z-ordering works only on strings'], answer: 1, explain: 'Liquid clustering replaces partitioning + Z-order for many tables. You can’t combine it with partitioning on the same table.' },
    { kind: 'concept', q: 'A reader needs version 25 of a table with checkpoints every 10 commits. What does it read?', options: ['All 26 JSON commits', 'The checkpoint at version 20, then JSON commits 21–25', 'Only commit 25', 'Every Parquet footer'], answer: 1, explain: 'The checkpoint (Parquet) summarises the state at v20. The reader then applies 21–25. <code>_last_checkpoint</code> points to the latest one.' }
  ],
  interview: [
    { q: 'What is the Delta transaction log and how does a read work?', a: '<p><code>_delta_log/</code> holds ordered JSON commits (add/remove file actions, metadata, protocol, commit info) and Parquet checkpoints. A reader finds the latest checkpoint, replays later commits, and gets the list of live files with their stats, then reads those Parquet files with data skipping by min/max stats.</p>', lvl: 'core' },
    { q: 'How does Delta handle concurrent writes?', a: '<p>Optimistic concurrency control. A writer records the version it read, writes data files, then tries to commit version N+1. If someone else committed first, it checks whether those commits touched what it read (files, partitions, metadata). No overlap: commit as the next version. Overlap: fail with a specific conflict exception.</p>', lvl: 'core' },
    { q: 'Compare Delta with Postgres MVCC.', a: '<p>Similar idea: never overwrite in place, keep versions, readers see a consistent snapshot, a cleanup process removes old versions (VACUUM in both!). Differences: Delta’s unit is a file, not a row; the log is the single source of truth; there is no lock manager, conflicts are detected at commit; isolation is serializable for writes and snapshot for reads by default.</p>', lvl: 'core' },
    { q: 'When do you use MERGE, and what makes it slow?', a: '<p>Upserts, SCD Type 1/2, CDC apply, dedup on ingest. Slow when matches touch many files (every touched file is rewritten without deletion vectors), when the source has no filter to prune the target, or when the source is large and shuffled. Fix with clustering on the key, partition predicates in the ON clause, deletion vectors, and deduped sources.</p>', lvl: 'deep' },
    { q: 'What do OPTIMIZE and VACUUM do?', a: '<p><code>OPTIMIZE</code> compacts small files into larger ones (a commit that removes many and adds few; data unchanged) and can Z-order. <code>VACUUM</code> physically deletes files not referenced by the current table version and older than the retention. OPTIMIZE first, then VACUUM after retention to reclaim space.</p>', lvl: 'core' },
    { q: 'What is the medallion architecture?', a: '<p>Bronze: raw ingested data, append-only, schema-on-read. Silver: cleaned, deduplicated, conformed. Gold: business aggregates for BI. Each layer is a set of Delta tables, often fed by streaming or incremental batch jobs.</p>', lvl: 'core' },
    { q: 'Delta vs Iceberg vs Hudi?', a: '<p>All add a metadata layer over Parquet for ACID and time travel. Delta: a log of JSON/Parquet commits, strongest in the Databricks/Spark ecosystem. Iceberg: a tree of metadata/manifest files with hidden partitioning and wide engine support. Hudi: built for upserts and incremental pulls. Delta 3.x <b>UniForm</b> can expose Iceberg metadata for the same files.</p>', lvl: 'deep' },
    { q: 'What is Change Data Feed?', a: '<p>With <code>delta.enableChangeDataFeed = true</code>, Delta records row-level changes (insert, update_preimage, update_postimage, delete) per version. Downstream jobs read only what changed with <code>readChangeFeed</code>, instead of diffing snapshots.</p>', lvl: 'deep' },
    { q: 'How does schema enforcement and evolution work?', a: '<p>Writes must match the table schema (names, types; extra columns rejected). Evolution is explicit: <code>mergeSchema</code> on write, <code>ALTER TABLE</code>, or automatic schema evolution in MERGE when enabled. Column mapping (rename/drop columns) needs a table protocol upgrade.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Upsert CDC into a Delta table (PySpark)', lang: 'python', code: `from delta.tables import DeltaTable
from pyspark.sql import Window, functions as F

latest = (changes
          .withColumn("rn", F.row_number().over(Window.partitionBy("id").orderBy(F.desc("updated_at"))))
          .filter("rn = 1").drop("rn"))                  # one source row per key

(DeltaTable.forName(spark, "silver.customers").alias("t")
   .merge(latest.alias("s"), "t.id = s.id")
   .whenMatchedDelete(condition="s.op = 'D'")
   .whenMatchedUpdateAll(condition="s.updated_at > t.updated_at")
   .whenNotMatchedInsertAll(condition="s.op != 'D'")
   .execute())` },
    { title: 'History, time travel, maintenance (SQL)', lang: 'sql', code: `DESCRIBE HISTORY silver.customers;
SELECT * FROM silver.customers TIMESTAMP AS OF '2026-11-01';
RESTORE TABLE silver.customers TO VERSION AS OF 120;

OPTIMIZE silver.customers ZORDER BY (country);
VACUUM silver.customers DRY RUN;
VACUUM silver.customers;               -- default 7-day retention` },
    { title: 'From a Spring Boot app', lang: 'java', code: `// Typical split: the Spring service writes to Postgres / Kafka;
// a Spark job lands it into Delta. To read Delta from the JVM without Spark,
// use the Delta Kernel library (io.delta:delta-kernel-api, Delta 3.x).
// For SQL access, query through a SQL warehouse / Trino via JDBC:
try (var c = DriverManager.getConnection(jdbcUrl, props);
     var ps = c.prepareStatement("SELECT id, status FROM silver.orders VERSION AS OF ? WHERE id = ?")) {
  ps.setLong(1, 812); ps.setLong(2, orderId);
  ...
}`, note: '<code>VERSION AS OF</code> works on engines that support Delta time travel (Spark SQL, Databricks SQL); check your engine.' }
  ]
});

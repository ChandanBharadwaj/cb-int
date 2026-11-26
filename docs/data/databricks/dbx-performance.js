IA.register({
  track: 'databricks',
  slug: 'dbx-performance',
  title: 'Performance & Photon',
  tagline: 'Databricks performance is mostly about <b>reading less</b> (data skipping, clustering, right-sized files) and then <b>processing faster</b> (Photon, caching, AQE). Fix layout before buying compute: a bigger cluster reading every file is still reading every file.',
  tldr: {
    problem: 'Queries and jobs get slower as tables grow. Teams add nodes, which helps a little and costs a lot, while the real cause is a layout that forces full scans or millions of tiny files.',
    model: 'Every Delta file has <b>min/max stats</b> in the log. A filter on a column whose values are <b>clustered</b> lets the engine skip most files. <b>Photon</b> (a native C++ vectorized engine) then runs supported operators faster, and the <b>disk cache</b> keeps hot files on local SSD. Spark’s AQE still handles shuffles and skew.',
    hook: '“Partition by customer_id?” No: high cardinality means millions of tiny files. Use <b>liquid clustering</b> on the columns you filter by, and don’t partition tables under about 1 TB.',
    facts: [
      { v: '32', l: 'columns get data-skipping stats by default (<code>delta.dataSkippingNumIndexedCols</code>)' },
      { v: '~1 TB', l: 'Databricks’ rule of thumb: below this, don’t partition; use clustering instead' },
      { v: 'C++', l: 'Photon is a native vectorized engine; unsupported operators (e.g. Python UDFs) fall back to the JVM engine' }
    ]
  },
  intro: {
    what: 'A Databricks query reads Parquet files from object storage, processes them on a cluster, and writes results. Speed depends on <b>how many bytes it must read</b> and <b>how fast each core processes them</b>. Delta tables keep statistics per file, so a well-organised table lets the engine skip most files. <b>Photon</b> is Databricks’ own engine that replaces parts of Spark’s execution with faster native code. Background on Spark itself: <a href="../spark/partitions-shuffle.html">partitions & shuffle</a>, <a href="../spark/memory-tuning-aqe.html">memory & AQE</a>, <a href="../spark/caching-persistence.html">caching</a>.',
    analogy: { icon: '📚', title: 'A library with labelled shelves', text: 'If books are shelved in random order, finding everything from 1997 means checking every shelf, however fast you walk (Photon is walking faster). If each shelf has a label “1995–1998”, you go straight to two shelves (data skipping on clustered data). A thousand shelves with one book each (tiny files) is slow even with labels.' },
    steps: [
      { t: 'Measure first', d: 'Open the query profile or Spark UI: bytes read, files pruned, spill, skew, time per stage.' },
      { t: 'Read less', d: 'Filter on clustered columns, select only needed columns, avoid functions around filter columns.', code: 'ALTER TABLE main.silver.orders CLUSTER BY (order_date, store_id);' },
      { t: 'Keep files healthy', d: '<code>OPTIMIZE</code> compacts small files; predictive optimization can run it for you on UC managed tables.' },
      { t: 'Process faster', d: 'Photon on, built-in functions instead of Python UDFs, broadcast small dimension tables.' },
      { t: 'Then size compute', d: 'Only after layout and code are fixed: more or bigger workers, memory-optimized nodes for spill.' }
    ],
    terms: [
      ['data skipping', 'Using per-file min/max stats to avoid reading files that can’t match a filter.'],
      ['liquid clustering', '<code>CLUSTER BY</code> on a Delta table: incremental, changeable clustering that replaces partitioning and Z-ORDER for most tables.'],
      ['Z-ORDER', 'Older multi-column clustering applied with <code>OPTIMIZE … ZORDER BY</code>; not combinable with liquid clustering.'],
      ['Photon', 'Databricks’ native vectorized query engine, used automatically for supported operators.'],
      ['disk cache', 'Copies of remote Parquet files on workers’ local SSDs (formerly “Delta cache”). Not the same as <code>df.cache()</code>.'],
      ['small-file problem', 'Too many tiny files: listing, opening and scheduling overhead dominates.']
    ]
  },
  visual: {
    title: 'Data skipping under three layouts',
    caption: 'Pick a layout, then Play or Step. The same query (<code>WHERE order_date = 7</code>) checks each file’s min/max first. Watch how many files it can skip with no layout, with liquid clustering, and with over-partitioning into tiny files.'
  },
  gotchas: [
    { trap: 'Partitioning on a high-cardinality column', code: `CREATE TABLE events PARTITIONED BY (user_id) …   -- millions of folders`, why: 'Each value gets its own directory and files. You end up with millions of tiny files; listing and scheduling dominate and writes get slower.', fix: 'Use liquid clustering (<code>CLUSTER BY (user_id)</code>). Partition only very large tables, on low-cardinality columns such as date, with at least ~1 GB per partition.' },
    { trap: 'A function around the filter column', code: `WHERE date(event_ts) = '2025-03-03'      -- may not skip\nWHERE event_ts >= '2025-03-03' AND event_ts < '2025-03-04'   -- skips`, why: 'Stats are on the raw column. Some expressions can be mapped back to ranges, many can’t, and you lose skipping.', fix: 'Write range predicates on the raw column, or add a generated date column and cluster on it.' },
    { trap: 'Python UDFs in a hot path', why: 'Row-at-a-time Python UDFs serialize data to a Python worker and cannot run in Photon, so that stage runs much slower.', fix: 'Use built-in functions or SQL expressions. If you need Python, prefer pandas (vectorized/Arrow) UDFs. See <a href="../spark/udfs.html">UDFs in the Spark track</a>.' },
    { trap: 'Filter columns beyond the first 32', why: 'By default only the first 32 columns get min/max stats. A filter on column 40 can’t skip files.', fix: 'Reorder columns, or set <code>delta.dataSkippingStatsColumns</code> (newer runtimes) or <code>delta.dataSkippingNumIndexedCols</code>. Clustering keys always get stats.' },
    { trap: 'Confusing <code>df.cache()</code> with the disk cache', why: '<code>cache()</code> stores a DataFrame in executor memory for this cluster session and uses memory you may need. The disk cache is automatic on supported instance types and caches remote files on local SSD.', fix: 'Rarely call <code>cache()</code> on Databricks, only for a DataFrame reused several times in one job, and <code>unpersist()</code> it after.' },
    { trap: 'OPTIMIZE never runs (or runs on everything nightly)', why: 'Streaming and frequent small writes create many small files. Running OPTIMIZE on every table every night wastes compute on tables that didn’t change.', fix: 'Enable predictive optimization for UC managed tables (it decides when to OPTIMIZE/VACUUM), or schedule OPTIMIZE for the hot tables only.' }
  ],
  scenarios: [
    { title: 'Query got 10× slower after “improving” partitioning',
      symptom: 'A 300 GB events table was repartitioned by <code>device_id</code> “for faster lookups”. Every query and the ingest job got slower.',
      diagnose: `DESCRIBE DETAIL main.silver.events;   -- numFiles: 4.1 million, sizeInBytes / numFiles ≈ 75 KB`,
      cause: 'High-cardinality partitioning created millions of tiny files. Query planning and file opening dominate.',
      fix: 'Rewrite without partitioning and with liquid clustering on the lookup column, then OPTIMIZE.',
      fixCode: `CREATE OR REPLACE TABLE main.silver.events_v2\nCLUSTER BY (device_id, event_date)\nAS SELECT * FROM main.silver.events;\n\nOPTIMIZE main.silver.events_v2;` },
    { title: 'Photon enabled, job not faster',
      symptom: 'The team turned on Photon for a nightly job and saw almost no change in run time.',
      diagnose: 'Spark UI / query profile: most stage time is in <code>BatchEvalPython</code> (a Python UDF) and the operators around it are not Photon.',
      cause: 'A row-wise Python UDF parses a string column. It can’t run in Photon and dominates the job.',
      fix: 'Replace the UDF with built-ins (<code>from_json</code>, <code>regexp_extract</code>, <code>to_timestamp</code>) and check the plan again.',
      fixCode: `# before\nparse = F.udf(lambda s: json.loads(s)["sku"], "string")\ndf = df.withColumn("sku", parse("payload"))\n\n# after: native, Photon-friendly\ndf = df.withColumn("sku", F.get_json_object("payload", "$.sku"))` },
    { title: 'One task runs 40 minutes, the other 199 finish in 30 seconds',
      symptom: 'A join stage is stuck on its last task. Executors are mostly idle.',
      diagnose: 'Spark UI stage summary: max shuffle read per task 18 GB, median 90 MB. Key <code>customer_id = -1</code> (unknown customers) has 30% of rows.',
      cause: 'Data skew on a sentinel key.',
      fix: 'AQE skew-join handling is on by default in recent runtimes; make sure it is not disabled. Filter or salt the sentinel key, or process it separately. See <a href="../spark/join-strategies.html">join strategies</a>.',
      fixCode: `known   = facts.where("customer_id <> -1").join(customers, "customer_id")\nunknown = facts.where("customer_id = -1").withColumn("customer_name", F.lit("unknown"))\nresult  = known.unionByName(unknown, allowMissingColumns=True)` }
  ],
  puzzles: [
    { kind: 'concept', q: 'A 50 GB table is queried by <code>order_date</code> and <code>store_id</code>. Best layout today?', options: ['PARTITIONED BY (store_id)', 'PARTITIONED BY (order_date, store_id)', 'CLUSTER BY (order_date, store_id)', 'No stats, rely on Photon'], answer: 2, explain: 'At 50 GB partitioning creates too many small partitions. Liquid clustering on the filter columns gives tight min/max ranges without directory explosion.' },
    { kind: 'concept', q: 'Why might adding nodes barely speed up a query that reads every file?', options: ['Spark ignores extra nodes', 'The bottleneck is bytes read and per-file overhead; more nodes add cost but don’t reduce what must be read', 'Photon limits clusters to 8 nodes', 'Delta locks the table'], answer: 1, explain: 'Scaling helps parallelism up to a point. Reading 100% of a table is still the dominant cost; skipping reduces the work itself.' },
    { kind: 'concept', q: 'Which part of this pipeline is most likely NOT running in Photon?', options: ['A filter on a date column', 'A hash join on integer keys', 'A row-wise Python UDF', 'A sum aggregation'], answer: 2, explain: 'Python UDFs run in Python worker processes. Filters, joins and aggregations on standard types are core Photon operators.' },
    { kind: 'concept', q: 'You set <code>CLUSTER BY (order_date)</code> on an existing table. When is existing data reorganised?', options: ['Immediately, in the ALTER', 'When OPTIMIZE runs (manually or via predictive optimization); new writes cluster incrementally', 'Never', 'Only after VACUUM'], answer: 1, explain: 'Liquid clustering is incremental: OPTIMIZE clusters data that needs it. That is also why changing keys later is cheap.' },
    { kind: 'concept', q: 'Where is the disk cache stored?', options: ['In the Delta log', 'On the workers’ local SSDs', 'In driver memory', 'In a UC volume'], answer: 1, explain: 'The disk cache keeps copies of remote Parquet data on local SSDs of workers (on supported instance types) and is lost when the cluster stops.' },
    { kind: 'concept', q: 'A filter column is the 45th column of a wide table and queries never skip files. First thing to check?', options: ['Photon version', 'Whether that column has data-skipping stats (default: first 32 columns)', 'Driver memory', 'The Kafka offsets'], answer: 1, explain: 'Stats are collected for the first 32 columns by default; configure stats columns or cluster on it.' },
    { kind: 'concept', q: 'Can a table use both liquid clustering and <code>ZORDER BY</code>?', options: ['Yes, ZORDER runs inside clustering', 'No: liquid clustering replaces ZORDER (and partitioning) for that table', 'Only with Photon', 'Only on external tables'], answer: 1, explain: 'Liquid clustering is not compatible with partitioning or Z-ordering on the same table.' }
  ],
  interview: [
    { q: 'What is Photon and when does it help?', a: '<p>A native C++ vectorized engine that executes Spark SQL/DataFrame plans for supported operators (scans, filters, joins, aggregations, many expressions). It helps most on CPU-heavy SQL: joins, aggregations, wide scans. It doesn’t help code outside Spark’s engine (Python UDFs, driver-side pandas). It is on by default in SQL warehouses and selectable on clusters, typically at a different DBU rate.</p>', lvl: 'core' },
    { q: 'Partitioning vs Z-ORDER vs liquid clustering?', a: '<ul><li><b>Partitioning</b>: physical folders per value; great for very large tables filtered by a low-cardinality column (date); terrible for high cardinality.</li><li><b>Z-ORDER</b>: rewrite files sorted on a multi-column space-filling curve during OPTIMIZE; not incremental.</li><li><b>Liquid clustering</b>: <code>CLUSTER BY</code>, incremental, keys can change, recommended for new tables (as of 2025), with <code>CLUSTER BY AUTO</code> available to let Databricks pick keys.</li></ul>', lvl: 'core' },
    { q: 'How does data skipping work in Delta?', a: '<p>On write, Delta records per-file statistics (row count, min, max, null count) for indexed columns in the transaction log. At query time, predicates are compared against those ranges, and files that can’t match are pruned before reading. It only works well if values are clustered, so each file covers a narrow range.</p>', lvl: 'core' },
    { q: 'What is the small-file problem and how do you fix it?', a: '<p>Too many small files (KBs to a few MB) make listing, metadata and task scheduling dominate. Causes: frequent streaming writes, over-partitioning, many small appends. Fixes: OPTIMIZE (bin-packing), auto compaction and optimized writes, predictive optimization, fewer partitions, and larger trigger intervals for streams.</p>', lvl: 'core' },
    { q: 'Disk cache vs Spark cache?', a: '<p>Disk cache: automatic, caches remote file data on local SSD, safe because it checks file versions, survives across queries on the cluster. Spark cache (<code>cache()</code>/<code>persist()</code>): caches a computed DataFrame in executor memory/disk, manual, can go stale relative to the table and takes memory from execution.</p>', lvl: 'deep' },
    { q: 'How do you diagnose a slow Databricks job?', a: '<ol><li>Spark UI: which stage dominates? Look for skew (max ≫ median), spill, and too many/too few tasks.</li><li>SQL tab / query profile: files read vs pruned, Photon coverage.</li><li>Table health: <code>DESCRIBE DETAIL</code> (numFiles, size), clustering.</li><li>Only then cluster sizing.</li></ol>', lvl: 'core' },
    { q: 'What do AQE and dynamic file pruning do?', a: '<p>AQE re-plans at stage boundaries with real sizes: coalesces shuffle partitions, switches to broadcast joins, splits skewed partitions. Dynamic file pruning uses the filtered result of a dimension table in a join to skip files in the large fact table at runtime. Both are on by default in recent runtimes.</p>', lvl: 'deep' },
    { q: 'What are deletion vectors and why do they matter for performance?', a: '<p>Instead of rewriting a whole Parquet file to delete or update a few rows, Delta writes a small vector marking rows as deleted. DELETE, UPDATE and MERGE get much faster; readers apply the vectors; OPTIMIZE or REORG eventually rewrites files. Enabled by default for new tables on recent runtimes; older external readers may not support them.</p>', fu: 'Downside? Readers do slightly more work until files are rewritten, and some older clients can’t read the table.', lvl: 'deep' },
    { q: 'What is predictive optimization?', a: '<p>A Unity Catalog feature for managed tables where Databricks decides when to run OPTIMIZE, VACUUM and statistics collection based on usage, and bills it as serverless compute. It removes most hand-written maintenance jobs.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Inspect and fix a table’s layout', lang: 'sql', code: `DESCRIBE DETAIL main.silver.orders;           -- numFiles, sizeInBytes, clusteringColumns\n\nALTER TABLE main.silver.orders CLUSTER BY (order_date, store_id);\nOPTIMIZE main.silver.orders;                   -- clusters data incrementally\n\n-- or let Databricks pick keys (recent runtimes)\nALTER TABLE main.silver.orders CLUSTER BY AUTO;\n\n-- stats on the columns you filter by\nALTER TABLE main.silver.orders\n  SET TBLPROPERTIES ('delta.dataSkippingStatsColumns' = 'order_date,store_id,customer_id');` },
    { title: 'Skipping-friendly predicates', lang: 'sql', code: `-- skips files (range on the raw column)\nSELECT sum(amount) FROM main.silver.orders\nWHERE order_ts >= '2025-03-01' AND order_ts < '2025-04-01';\n\n-- may scan everything (function on the column)\nSELECT sum(amount) FROM main.silver.orders\nWHERE date_format(order_ts, 'yyyy-MM') = '2025-03';` },
    { title: 'Native functions instead of a UDF', lang: 'python', code: `from pyspark.sql import functions as F\n\nclean = (spark.read.table("main.bronze.events")\n  .select(\n    F.get_json_object("payload", "$.sku").alias("sku"),\n    F.to_timestamp(F.get_json_object("payload", "$.ts")).alias("event_ts"),\n    F.regexp_extract("ua", r"Chrome/(\\d+)", 1).alias("chrome_major"))\n  .where(F.col("event_ts") >= "2025-03-01"))\n\nclean.explain(mode="formatted")   # look for Photon operators on Databricks` }
  ]
});

IA.register({
  track: 'databricks',
  slug: 'dbx-auto-loader',
  title: 'Auto Loader & ingestion',
  tagline: '<b>Auto Loader</b> (<code>format("cloudFiles")</code>) is a Structured Streaming source that finds new files in cloud storage, loads each one <b>exactly once</b>, and copes with schema changes. <b>COPY INTO</b> is its simpler SQL cousin for smaller, batch-style loads.',
  tldr: {
    problem: 'Hand-written “list the folder, diff against a control table, load new files” jobs that miss files, load some twice, and crash when a producer adds a column.',
    model: 'Auto Loader = streaming source + <b>file log in the checkpoint</b> (which files are done) + <b>schema in schemaLocation</b> (what columns exist). New columns stop the stream once, on purpose; the restart picks up the new schema.',
    hook: '“Why did my Auto Loader stream fail when a new column appeared?” Default <code>addNewColumns</code> mode: it updates the stored schema and fails so a restart can use it. Run it as a job with retries.',
    facts: [
      { v: '50 GB / 1000 files', l: 'default sample for schema inference (whichever limit is hit first)' },
      { v: 'strings', l: 'inferred type of every JSON/CSV column unless <code>cloudFiles.inferColumnTypes = true</code>' },
      { v: '_rescued_data', l: 'column that captures values that don’t match the schema (wrong type, unknown field, case mismatch)' }
    ]
  },
  intro: {
    what: 'Files keep arriving in a cloud folder or volume: JSON from an app, CSV exports, Parquet drops. You want each file loaded into a Delta table once, as soon as practical. Auto Loader is a streaming reader that remembers which files it already processed (in its checkpoint) and what the schema is (in a schema location). Run it continuously or as an incremental batch with <code>trigger(availableNow=True)</code>.',
    analogy: { icon: '📬', title: 'A mailroom with a logbook', text: 'Letters (files) drop into a box. The clerk logs each letter’s ID before filing it, so nothing is filed twice even if the clerk is replaced. When a letter has a new form field, the clerk stops, updates the form template, and starts again.' },
    steps: [
      { t: 'Point it at a folder', d: 'Format and a schema location are the minimum.', code: 'df = (spark.readStream.format("cloudFiles")\n        .option("cloudFiles.format", "json")\n        .option("cloudFiles.schemaLocation", "/Volumes/main/meta/schemas/events")\n        .load("/Volumes/main/raw/events/"))' },
      { t: 'Write to bronze with a checkpoint', d: 'The checkpoint is what makes it exactly-once.', code: '(df.writeStream\n   .option("checkpointLocation", "/Volumes/main/meta/chk/events")\n   .trigger(availableNow=True)          # process backlog, then stop\n   .toTable("main.bronze.events"))' },
      { t: 'Decide how to treat new columns', d: '<code>cloudFiles.schemaEvolutionMode</code>: <code>addNewColumns</code> (default), <code>rescue</code>, <code>failOnNewColumns</code>, <code>none</code>.' },
      { t: 'Or: COPY INTO for simple SQL loads', d: 'Idempotent batch load from a path; re-running skips files already loaded.', code: "COPY INTO main.bronze.events\nFROM '/Volumes/main/raw/events/'\nFILEFORMAT = JSON\nCOPY_OPTIONS ('mergeSchema' = 'true');", lang: 'sql' }
    ],
    terms: [
      ['cloudFiles', 'The Auto Loader source name in <code>spark.readStream.format(…)</code>.'],
      ['schemaLocation', 'Folder where Auto Loader stores the inferred schema and its evolutions.'],
      ['checkpointLocation', 'Folder where the stream stores progress, including the RocksDB file log.'],
      ['directory listing mode', 'Default discovery: lists the input path incrementally.'],
      ['file notification / file events', 'Discovery through cloud events (queues or UC-managed file events) instead of listing; scales to huge folders.'],
      ['schema hints', '<code>cloudFiles.schemaHints</code>: pin types for some columns, infer the rest.']
    ]
  },
  visual: {
    title: 'Discover, record, evolve',
    caption: 'Step through a first load, a re-run that skips seen files, and a file with an unexpected column.'
  },
  gotchas: [
    { trap: 'Every column came in as STRING', why: 'For JSON and CSV, Auto Loader infers strings by default so type changes cannot break the stream.', fix: 'Keep strings in bronze and cast in silver, or set <code>cloudFiles.inferColumnTypes</code> to true and add <code>cloudFiles.schemaHints</code> for critical columns.', code: '.option("cloudFiles.inferColumnTypes", "true")\n.option("cloudFiles.schemaHints", "amount DECIMAL(10,2), event_ts TIMESTAMP")' },
    { trap: 'Stream “fails” on a new column', why: 'This is the designed behaviour of <code>addNewColumns</code>: schema updated, stream stops with an <code>UnknownFieldException</code>.', fix: 'Run as a job with retries (or in a declarative pipeline, which restarts automatically). Choose <code>rescue</code> if you never want the stream to stop.' },
    { trap: 'Sharing or deleting the checkpoint', why: 'The checkpoint holds the file log. Delete it and every file is loaded again; share it between two streams and both break.', fix: 'One checkpoint per stream, in a governed volume. To reprocess, write to a new table with a new checkpoint deliberately.' },
    { trap: 'Overwriting files in place', why: 'By default a file path is processed once. If a producer rewrites <code>orders.json</code> with new content, the change may be ignored.', fix: 'Make producers write new, unique file names. <code>cloudFiles.allowOverwrites</code> exists but can cause duplicates; use with care.' },
    { trap: 'Millions of files with directory listing', why: 'Listing huge, flat folders gets slow and costly.', fix: 'Use file notification mode or managed file events on an external location (check availability in your workspace), and partition the landing path by date.' },
    { trap: 'Using COPY INTO for huge, continuous feeds', why: 'COPY INTO is batch and tracks loaded files in the table’s metadata; it suits thousands of files, not continuous millions.', fix: 'Auto Loader for continuous or very large ingestion; COPY INTO for simple, occasional SQL loads.' }
  ],
  scenarios: [
    { title: 'Revenue column silently NULL for a week',
      symptom: 'Bronze has rows, but <code>amount</code> is NULL for all events since a producer deploy.',
      diagnose: `SELECT _rescued_data, count(*) FROM main.bronze.events
WHERE _ingest_ts > '2025-06-10' GROUP BY 1 LIMIT 5;
-- {"Amount":"12.50"}   <- producer changed the field name's case`,
      cause: 'The producer renamed <code>amount</code> to <code>Amount</code>. Auto Loader put the mismatched value into <code>_rescued_data</code>; nobody monitored it.',
      fix: 'Alert on non-null <code>_rescued_data</code> rates, fix the producer contract, and backfill silver from bronze using the rescued values.',
      fixCode: `SELECT coalesce(amount, CAST(_rescued_data:Amount AS DECIMAL(10,2))) AS amount, *
FROM main.bronze.events WHERE _ingest_ts > '2025-06-10';`, lang: 'sql' },
    { title: 'Everything loaded twice after a “cleanup”',
      symptom: 'Bronze row count doubled overnight.',
      diagnose: '-- job history: someone deleted /Volumes/main/meta/chk/events to "reset a stuck stream"',
      cause: 'Without the checkpoint, Auto Loader had no record of processed files and re-ingested the whole folder into the same table.',
      fix: 'Restore from table history, protect checkpoint volumes with grants, and document the proper reset (new checkpoint + new or truncated target).',
      fixCode: `RESTORE TABLE main.bronze.events TO TIMESTAMP AS OF '2025-06-14T23:00:00';
REVOKE WRITE VOLUME ON VOLUME main.meta.chk FROM \`data-engineers\`;`, lang: 'sql' }
  ],
  puzzles: [
    { kind: 'concept', q: 'What makes Auto Loader exactly-once per file?', options: ['The Delta log of the target', 'The file log stored in the stream’s checkpoint, plus Delta’s idempotent sink commits', 'Cloud storage versioning', 'The schemaLocation'], answer: 1, explain: 'The checkpoint records discovered/processed files (RocksDB) and offsets; the Delta sink commits each micro-batch idempotently. schemaLocation only stores schemas.' },
    { kind: 'concept', q: 'JSON files, default options. Type of column <code>price</code> with values like 12.5?', options: ['DOUBLE', 'DECIMAL', 'STRING', 'Depends on the first file'], answer: 2, explain: 'Without <code>inferColumnTypes</code>, JSON and CSV columns are inferred as strings. Parquet/Avro keep their encoded types.' },
    { kind: 'concept', q: 'Mode <code>rescue</code>, a file with a new column <code>coupon</code> arrives. What happens?', options: ['Stream fails', 'Schema evolves and coupon becomes a column', 'Schema stays; coupon’s value lands in _rescued_data; stream keeps running', 'File skipped'], answer: 2, explain: '<code>rescue</code> never evolves the schema and never fails for new columns; unknown data goes to <code>_rescued_data</code>.' },
    { kind: 'concept', q: 'You need to load a few hundred CSV files once a day from SQL, safely re-runnable. Simplest tool?', options: ['Auto Loader with continuous trigger', 'COPY INTO', 'spark.read + append', 'A DBFS mount'], answer: 1, explain: 'COPY INTO is idempotent (skips loaded files) and pure SQL. Plain append would reload everything on re-run.' },
    { kind: 'concept', q: 'What does <code>trigger(availableNow=True)</code> do with Auto Loader?', options: ['Runs forever', 'Processes all files available now, in possibly several batches, then stops', 'Processes one file', 'Disables the checkpoint'], answer: 1, explain: 'It turns a stream into an incremental batch job: same exactly-once bookkeeping, no always-on cluster.' },
    { kind: 'concept', q: 'Default schema evolution mode when no schema is provided?', options: ['none', 'rescue', 'addNewColumns', 'failOnNewColumns'], answer: 2, explain: '<code>addNewColumns</code> is the default when Auto Loader infers the schema. If you pass an explicit schema, the default is <code>none</code> (as of 2025 docs; check your runtime).' }
  ],
  interview: [
    { q: 'Auto Loader vs plain <code>spark.readStream.format("json")</code>?', a: '<p>The plain file source lists the whole directory each micro-batch and keeps a simpler log; it gets slow with many files and has no schema evolution help. Auto Loader discovers files incrementally (listing or notifications), stores state in RocksDB for scale, infers and evolves schemas, and rescues bad data.</p>', lvl: 'core' },
    { q: 'Directory listing vs file notification mode?', a: '<p><b>Listing</b> (default) needs no extra cloud setup and is incremental for lexically ordered paths. <b>Notification</b> subscribes to storage events through a queue (SQS, Event Grid + queue, Pub/Sub), which scales to very large folders but needs permissions to create those resources. Newer: <b>managed file events</b> on UC external locations (check your workspace).</p>', lvl: 'deep' },
    { q: 'Explain the schema evolution modes.', a: '<ul><li><code>addNewColumns</code>: add columns, stop stream, restart with new schema.</li><li><code>rescue</code>: never change schema; extra data goes to <code>_rescued_data</code>.</li><li><code>failOnNewColumns</code>: fail until you change the schema yourself.</li><li><code>none</code>: ignore new columns (unless rescued data column is set).</li></ul>', lvl: 'core' },
    { q: 'What lands in <code>_rescued_data</code>?', a: '<p>A JSON string of fields that could not be parsed into the schema: wrong types, fields not in the schema (in rescue mode), case mismatches. It keeps the source file path too. Monitor it; non-null rates are a contract-break alarm.</p>', lvl: 'core' },
    { q: 'Auto Loader vs COPY INTO?', a: '<p>Both are idempotent per file. COPY INTO is a SQL batch command, good for thousands of files and ad-hoc loads. Auto Loader is a streaming source with scalable file tracking, schema evolution and continuous or scheduled incremental runs; recommended for most ingestion. Declarative pipelines use Auto Loader under the hood for file sources.</p>', lvl: 'core' },
    { q: 'How do you backfill old files with Auto Loader?', a: '<p><code>cloudFiles.includeExistingFiles</code> (default true) loads what is already there on first start. For a re-load, start a new stream with a new checkpoint. For files older than a cut-off, combine with <code>modifiedAfter</code>/path filters.</p>', lvl: 'deep' },
    { q: 'How do you keep file provenance?', a: '<p>Select the hidden <code>_metadata</code> column: <code>_metadata.file_path</code>, <code>file_name</code>, <code>file_modification_time</code>. Store it in bronze for debugging and replays.</p>', lvl: 'core' },
    { q: 'Ingesting from databases or SaaS?', a: '<p>Files are Auto Loader’s job. For databases and SaaS apps, Lakeflow Connect offers managed connectors (as of 2025, check your workspace), or use Kafka/CDC tools that land files or topics, then stream them.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Production bronze ingest', lang: 'python', code: `from pyspark.sql import functions as F

src = "/Volumes/main/raw/orders/"
meta = "/Volumes/main/meta"

(spark.readStream.format("cloudFiles")
   .option("cloudFiles.format", "json")
   .option("cloudFiles.schemaLocation", f"{meta}/schemas/orders")
   .option("cloudFiles.inferColumnTypes", "true")
   .option("cloudFiles.schemaHints", "order_id BIGINT, amount DECIMAL(10,2)")
   .option("cloudFiles.schemaEvolutionMode", "addNewColumns")
   .load(src)
   .select("*", F.col("_metadata.file_path").alias("_file"),
           F.current_timestamp().alias("_ingest_ts"))
 .writeStream
   .option("checkpointLocation", f"{meta}/chk/bronze_orders")
   .option("mergeSchema", "true")              # let the Delta sink add new columns
   .trigger(availableNow=True)
   .toTable("main.bronze.orders"))` , note: 'Schedule it as a job task with retries so the planned stop on a new column restarts automatically.' },
    { title: 'Same thing in SQL (streaming table)', lang: 'sql', code: `CREATE OR REFRESH STREAMING TABLE main.bronze.orders AS
SELECT *, _metadata.file_path AS _file, current_timestamp() AS _ingest_ts
FROM STREAM read_files('/Volumes/main/raw/orders/', format => 'json');`, note: '<code>read_files</code> with <code>STREAM</code> uses Auto Loader. Works in Databricks SQL and declarative pipelines.' }
  ]
});

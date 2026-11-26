IA.register({
  track: 'spark',
  slug: 'reading-writing',
  title: 'Reading & writing data',
  tagline: '<code>spark.read.format(...).schema(...).load(path)</code> in, <code>df.write.mode(...).partitionBy(...).save(path)</code> out. The output is a <b>directory of part-files</b>, and the save mode decides what happens to what was there.',
  tldr: {
    problem: 'Most data-loss and “why is it slow” incidents in batch jobs come from I/O defaults: CSV schemas guessed wrong, <code>overwrite</code> wiping every partition, reruns appending duplicates, or 200,000 tiny files from <code>partitionBy</code>.',
    model: 'Reader: format + options + schema → a lazy DataFrame split into ~128 MB input partitions. Writer: one task writes one file per output partition value into <code>col=value/</code> directories, then commits with <code>_SUCCESS</code>. Columnar formats (Parquet, ORC) give column pruning and filter pushdown; CSV/JSON don’t.',
    hook: '“How do you rerun one day of a partitioned job without destroying the others?” <code>partitionOverwriteMode=dynamic</code> with <code>mode("overwrite")</code>, or a table format with <code>replaceWhere</code>/<code>MERGE</code> (Delta, Iceberg).',
    facts: [
      { v: 'errorifexists', l: 'the default save mode; the others are append, overwrite and ignore' },
      { v: 'parquet', l: 'the default data source (<code>spark.sql.sources.default</code>); Snappy is its default compression' },
      { v: '128 MB', l: 'default <code>spark.sql.files.maxPartitionBytes</code>: target size of one input partition for splittable files' }
    ]
  },
  intro: {
    what: 'Spark reads data from files (CSV, JSON, Parquet…) or databases into a DataFrame, and writes DataFrames back out. Because many tasks write at once, the output is a <b>folder</b> with many files inside, not a single file. You choose the file format, tell Spark the columns and types (the <b>schema</b>), and say what to do if the output folder already exists (the <b>save mode</b>).',
    analogy: { icon: '🗄️', title: 'A filing cabinet', text: '<code>partitionBy("country")</code> is like giving each country its own drawer. When someone wants only India, they open one drawer instead of searching the whole cabinet. But a drawer per customer id would mean millions of near-empty drawers.' },
    steps: [
      { t: 'Read with a schema', d: 'Tell Spark the column types instead of letting it guess.', code: 'orders = (spark.read\n    .option("header", True)\n    .schema("id BIGINT, country STRING, amount DECIMAL(10,2), ts TIMESTAMP")\n    .csv("s3://raw/orders/2026-11-25/"))' },
      { t: 'JSON and Parquet', d: 'JSON is one object per line by default. Parquet stores its schema inside the file, so you rarely give one.', code: 'events = spark.read.json("s3://raw/events/")            # JSON Lines\nnested = spark.read.option("multiLine", True).json("s3://raw/one-big-array.json")\nlake   = spark.read.parquet("s3://lake/orders/")' },
      { t: 'Write Parquet', d: 'The output path becomes a directory of <code>part-*.parquet</code> files plus a <code>_SUCCESS</code> marker.', code: 'orders.write.mode("overwrite").parquet("s3://lake/orders/")' },
      { t: 'Partition the output', d: '<code>partitionBy</code> creates one sub-folder per value. Readers that filter on it skip the rest.', code: 'orders.write.mode("overwrite").partitionBy("country").parquet("s3://lake/orders/")\nspark.read.parquet("s3://lake/orders/").filter("country = \'IN\'")   # reads only country=IN/' },
      { t: 'Databases (JDBC)', d: 'Read from or write to Postgres through JDBC. Add the driver jar.', code: 'pg = (spark.read.format("jdbc")\n      .option("url", "jdbc:postgresql://db:5432/shop")\n      .option("dbtable", "public.customers")\n      .option("user", "etl").option("password", pw)\n      .load())' }
    ],
    terms: [
      ['Parquet', 'A columnar, compressed file format with an embedded schema. The default choice for analytics.'],
      ['CSV / JSON', 'Row-based text formats. Easy to read by humans, slow and type-less for Spark.'],
      ['schema inference', 'Spark scanning the data to guess types. Costs an extra pass and can guess wrong.'],
      ['save mode', 'What to do when output exists: errorifexists (default), append, overwrite, ignore.'],
      ['partitionBy', 'Writer option that lays files out in <code>col=value/</code> folders.'],
      ['partition pruning', 'Skipping whole folders whose partition value can’t match the filter.']
    ]
  },
  visual: {
    title: 'Read, write, partitionBy and save modes',
    caption: 'Three scenes: how a schema is obtained when reading CSV, what the output directory looks like with <code>partitionBy</code>, and what each save mode does to existing data. Use Step to go one stage at a time.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Sim: partitionBy file count', code: `# SIMULATION in plain Python (not Spark): files written by partitionBy.
import random
random.seed(7)
countries = ["DE", "FR", "IN", "US", "BR"]
rows = [random.choice(countries) for _ in range(10_000)]

def files_written(rows, tasks, pre_repartition=False):
    if pre_repartition:   # like df.repartition("country"): each value lands in one task
        parts = {c: [c] for c in set(rows)}
        return sum(len(set(p)) for p in parts.values())
    chunks = [rows[i::tasks] for i in range(tasks)]          # round-robin rows to tasks
    return sum(len(set(chunk)) for chunk in chunks)          # one file per (task, value)

print("200 tasks, no repartition :", files_written(rows, 200), "files")
print("8 tasks,   no repartition :", files_written(rows, 8), "files")
print("repartition('country')    :", files_written(rows, 200, True), "files")`, note: 'Simulation of the counting rule only: files ≈ Σ over tasks of distinct partition values in that task.' },
      { label: 'Sim: save modes', code: `# SIMULATION: what each save mode does to an existing partitioned table.
existing = {"country=DE": ["old"], "country=FR": ["old"]}
new_data = {"country=FR": ["new"], "country=IN": ["new"]}

def write(mode, dynamic=False):
    t = {k: list(v) for k, v in existing.items()}
    if mode == "errorifexists":
        return "AnalysisException: path already exists" if t else new_data
    if mode == "ignore":
        return t
    if mode == "append":
        for k, v in new_data.items(): t.setdefault(k, []).extend(v)
        return t
    if mode == "overwrite":
        if not dynamic: return dict(new_data)            # static: whole table replaced
        t.update(new_data); return t                     # dynamic: only touched partitions
for m in ("errorifexists", "append", "overwrite", "ignore"):
    print(f"{m:14}", write(m))
print(f"{'overwrite+dyn':14}", write("overwrite", dynamic=True))`, note: 'Simulation. In real Spark, dynamic mode is <code>spark.sql.sources.partitionOverwriteMode=dynamic</code> (or the per-write option <code>partitionOverwriteMode</code>).' }
    ]
  },
  gotchas: [
    { trap: '<code>overwrite</code> deletes partitions you didn’t mean to touch', code: `# rerun for one day, table partitioned by date
day_df.write.mode("overwrite").partitionBy("date").parquet(path)   # ALL other dates deleted`, why: 'The default <code>partitionOverwriteMode</code> is <code>static</code>: overwrite replaces the whole target path.', fix: 'Set dynamic mode for that write, or write to the exact partition path, or use a table format with <code>replaceWhere</code>.', lang: 'python' },
    { trap: '<code>inferSchema</code> in production', why: 'It scans the data (an extra job), and guesses depend on the data: IDs with leading zeros become ints, a column that was empty today becomes string, and the schema can change from day to day.', fix: 'Pass an explicit schema (DDL string or <code>StructType</code>). Use <code>mode("FAILFAST")</code> or a <code>_corrupt_record</code> column to catch bad rows.' },
    { trap: 'High-cardinality <code>partitionBy</code>', code: `df.write.partitionBy("user_id").parquet(path)   # millions of folders`, why: 'Each distinct value is a folder, and each task writes one file per value it holds. Listing and opening millions of small files is far slower than reading a few big ones.', fix: 'Partition by low-cardinality columns you filter on (date, region). Aim for files of roughly 128 MB–1 GB. Repartition by the partition columns before writing.' },
    { trap: '<code>append</code> reruns create duplicates', why: 'If a job fails after writing some files, or is retried by the scheduler, append adds the same rows again. Plain files have no primary key.', fix: 'Make writes idempotent: dynamic partition overwrite of the run’s partition, or a Delta/Iceberg <code>MERGE</code> on a key.' },
    { trap: 'Expecting one output file', code: `df.write.csv("out/report.csv")   # creates a DIRECTORY named report.csv`, why: 'Each task writes its own part-file.', fix: 'Accept the directory (most tools read it), or <code>coalesce(1)</code> for genuinely small outputs only; it forces one task to write everything.' },
    { trap: 'JSON default is JSON Lines', code: `spark.read.json("export.json")    # file is one big [ {...}, {...} ] array
# → a single _corrupt_record column`, why: 'Spark expects one JSON object per line so files can be split.', fix: 'Use <code>option("multiLine", True)</code> for pretty-printed or array JSON (the file can’t be split then).' },
    { trap: 'JDBC read with one connection', why: 'Without partitioning options, a JDBC read is one query in one task, so a 200M-row Postgres table is pulled through a single connection.', fix: 'Set <code>partitionColumn</code>, <code>lowerBound</code>, <code>upperBound</code>, <code>numPartitions</code> (bounds only split the range; they don’t filter), or push a filtered <code>query</code>. Mind the load on the source database.' }
  ],
  scenarios: [
    { title: 'Backfill for one day wiped the year', symptom: 'After an on-call engineer reran the 2026-11-20 load, the orders table contains only that date. Dashboards for every other day are empty.', diagnose: 'aws s3 ls s3://lake/orders/ | head\n  PRE date=2026-11-20/          # nothing else\njob: df.write.mode("overwrite").partitionBy("date").parquet(path)\nspark.sql.sources.partitionOverwriteMode = static (default)', cause: 'Static overwrite replaced the entire table path with the one-day DataFrame.', fix: 'Restore from versioned storage/backup, then make reruns dynamic and idempotent. Longer term, move to Delta/Iceberg for atomic overwrites and time travel.', fixCode: `(day_df.write
   .mode("overwrite")
   .option("partitionOverwriteMode", "dynamic")   # only date=2026-11-20 replaced
   .partitionBy("date")
   .parquet("s3://lake/orders/"))` },
    { title: 'Leading zeros vanished from postcodes', symptom: 'Shipping labels for French postcodes like 01000 print as 1000; joins to the postcode reference table drop rows.', diagnose: 'df.printSchema()\n |-- postcode: integer (nullable = true)\nreader: .option("inferSchema", True)', cause: 'Schema inference saw only digits and chose integer.', fix: 'Declare the schema; postcodes, phone numbers and IDs are strings.', fixCode: `schema = "order_id BIGINT, postcode STRING, city STRING, amount DECIMAL(10,2)"
df = spark.read.option("header", True).schema(schema).csv(path)` },
    { title: 'Reads slow down every week', symptom: 'A daily job reading a partitioned Parquet table goes from 4 to 40 minutes over a few months. Most time is before the first task starts.', diagnose: 'aws s3 ls --recursive s3://lake/clicks/ | wc -l     # 2.3M files\naverage file size: 600 KB\nwriter: partitionBy("date", "customer_id") with 400 shuffle partitions', cause: 'Partitioning by a high-cardinality column, times hundreds of tasks per write, produced millions of tiny files. Listing and opening them dominates.', fix: 'Partition by date only, repartition by the partition column before writing, compact existing data (or use Delta <code>OPTIMIZE</code>).', fixCode: `(clicks.repartition("date")
        .write.mode("overwrite")
        .option("partitionOverwriteMode", "dynamic")
        .option("maxRecordsPerFile", 5_000_000)
        .partitionBy("date")
        .parquet("s3://lake/clicks/"))` }
  ],
  puzzles: [
    { kind: 'concept', q: 'What is the default save mode of <code>df.write.parquet(path)</code> when the path already exists?', options: ['append', 'overwrite', 'errorifexists: the write fails', 'ignore'], answer: 2, explain: 'The default is <code>errorifexists</code> (alias <code>error</code>), which raises an AnalysisException rather than touching existing data.' },
    { kind: 'concept', q: 'A table is partitioned by <code>date</code> with 365 days. You write one day with <code>mode("overwrite")</code> and default settings. How many dates remain?', options: ['365', '1', '366', '0'], answer: 1, explain: 'Static overwrite replaces the whole path. Only the day you wrote remains. Dynamic mode would keep all 365.' },
    { kind: 'concept', q: 'Why does <code>inferSchema=True</code> on CSV start a job before any action?', options: ['It doesn’t', 'Spark must read the data to guess the column types', 'It writes a schema file', 'It validates the header only'], answer: 1, explain: 'Type inference needs to look at values, so Spark runs a job over the data (optionally a sample via <code>samplingRatio</code>).' },
    { kind: 'concept', q: 'A DataFrame with 100 partitions, each containing rows for all 10 countries, is written with <code>partitionBy("country")</code>. Roughly how many data files?', options: ['10', '100', '1,000', '1'], answer: 2, explain: 'Each task writes one file per partition value it holds: 100 tasks × 10 values = about 1,000 files. <code>repartition("country")</code> first would give about 10.' },
    { kind: 'concept', q: 'Which format lets Spark read only the columns a query uses?', options: ['CSV', 'JSON Lines', 'Parquet', 'Plain text'], answer: 2, explain: 'Parquet is columnar: Spark reads only the needed column chunks and can skip row groups using min/max statistics.' },
    { kind: 'concept', q: 'You read <code>s3://lake/orders/</code> partitioned by <code>country</code> and filter <code>country = \'IN\'</code>. What does Spark list and read?', options: ['All files, then filters', 'Only the country=IN/ directory (partition pruning)', 'A random sample', 'Only _SUCCESS'], answer: 1, explain: 'Partition columns live in the path, so the filter is applied at file-listing time.' },
    { kind: 'concept', q: 'A CSV row has <code>"abc"</code> in an INT column. With default read options, what do you get?', options: ['The job fails', 'The row is kept with that field (or the row) set to null: PERMISSIVE mode', 'The row is silently dropped', 'The string "abc"'], answer: 1, explain: 'Default mode is PERMISSIVE: malformed values become null, and with a <code>columnNameOfCorruptRecord</code> column in the schema you can capture the raw line. DROPMALFORMED drops; FAILFAST throws.' },
    { kind: 'concept', q: 'What does <code>df.write.csv("out/report.csv")</code> produce?', options: ['One file named report.csv', 'A directory named report.csv containing part files and _SUCCESS', 'An error: wrong extension', 'A zip file'], answer: 1, explain: 'Spark writes one part-file per task into the target directory and marks completion with <code>_SUCCESS</code>.' }
  ],
  interview: [
    { q: 'Why prefer Parquet over CSV for analytics?', a: '<ul><li>Columnar: read only needed columns.</li><li>Compressed and encoded per column (Snappy by default in Spark).</li><li>Schema and types embedded; no inference.</li><li>Row-group statistics enable predicate pushdown.</li><li>Splittable regardless of compression codec.</li></ul>', lvl: 'core' },
    { q: 'Explain the four save modes.', a: '<p><code>errorifexists</code> (default): fail if target exists. <code>append</code>: add files. <code>overwrite</code>: replace (whole path in static mode, touched partitions only in dynamic mode). <code>ignore</code>: do nothing if target exists.</p>', lvl: 'core' },
    { q: 'What is static vs dynamic partition overwrite?', a: '<p>With <code>spark.sql.sources.partitionOverwriteMode=static</code> (default), an overwrite deletes all partitions under the path (or those matching a static spec in SQL <code>INSERT OVERWRITE … PARTITION</code>). With <code>dynamic</code>, Spark only replaces partitions that appear in the data being written. It can be set per write with <code>.option("partitionOverwriteMode", "dynamic")</code>.</p>', lvl: 'deep' },
    { q: 'How do you choose partition columns?', a: '<p>Columns you filter on most, with low cardinality, giving reasonably large files per partition: usually date (maybe plus region). Avoid IDs and timestamps. Too many partitions means tiny files and slow listing; too few means less pruning.</p>', fu: 'partitionBy vs bucketBy? partitionBy = folder layout for pruning; bucketBy (tables only, <code>saveAsTable</code>) = hash files by key to avoid shuffles in joins/aggregations.', lvl: 'core' },
    { q: 'How do you avoid the small-files problem when writing?', a: '<p>Repartition (or coalesce) before writing so each task holds few partition values; <code>repartition("date")</code> before <code>partitionBy("date")</code>. Cap file size with <code>maxRecordsPerFile</code>. Let AQE coalesce small shuffle partitions. Compact periodically, or use Delta <code>OPTIMIZE</code> / Iceberg rewrite actions.</p>', lvl: 'deep' },
    { q: 'What options matter when reading CSV?', a: '<p><code>header</code>, <code>schema</code> (or <code>inferSchema</code>), <code>sep</code>, <code>quote</code>/<code>escape</code>, <code>multiLine</code> for embedded newlines, <code>nullValue</code>, <code>dateFormat</code>/<code>timestampFormat</code>, <code>mode</code> (PERMISSIVE/DROPMALFORMED/FAILFAST), <code>columnNameOfCorruptRecord</code>, <code>encoding</code>.</p>', lvl: 'core' },
    { q: 'How do you read a large Postgres table into Spark efficiently?', a: '<p>Use JDBC with <code>partitionColumn</code> (numeric, date or timestamp), <code>lowerBound</code>/<code>upperBound</code> and <code>numPartitions</code> so Spark opens parallel range queries; <code>fetchsize</code> to avoid row-at-a-time fetching. Read from a replica, limit parallelism to what the DB can take, or export to Parquet (e.g. via CDC) for repeated use.</p>', lvl: 'deep' },
    { q: 'Is a Spark file write atomic?', a: '<p>Not for plain files on object storage. The commit protocol writes task output to temporary locations and moves it on job commit, then writes <code>_SUCCESS</code>, but readers can observe partial results during commit or after a crash, and overwrite deletes before writing. Table formats (Delta, Iceberg, Hudi) add atomic commits via a transaction log.</p>', lvl: 'deep' },
    { q: 'What happens to the partition column when you use partitionBy?', a: '<p>It is removed from the data files and encoded in the directory name (<code>country=DE</code>). On read, Spark discovers it from paths and adds it back as a column, inferring its type (<code>spark.sql.sources.partitionColumnTypeInference.enabled</code>), so <code>"007"</code> may come back as 7 unless you supply a schema.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Raw CSV → partitioned Parquet (idempotent daily job)', lang: 'python', code: `import sys
from pyspark.sql import SparkSession, functions as F

run_date = sys.argv[1]                       # e.g. 2026-11-25
spark = SparkSession.builder.appName("orders-bronze").getOrCreate()

schema = """order_id BIGINT, customer_id BIGINT, postcode STRING,
            amount DECIMAL(12,2), currency STRING, created_at TIMESTAMP,
            _corrupt_record STRING"""

raw = (spark.read
       .option("header", True)
       .option("mode", "PERMISSIVE")
       .option("columnNameOfCorruptRecord", "_corrupt_record")
       .schema(schema)
       .csv(f"s3://raw/orders/{run_date}/"))

raw.cache()                                   # read twice below
bad = raw.filter(F.col("_corrupt_record").isNotNull())
good = (raw.filter(F.col("_corrupt_record").isNull()).drop("_corrupt_record")
           .withColumn("date", F.to_date("created_at")))

bad.write.mode("overwrite").json(f"s3://quarantine/orders/{run_date}/")
(good.repartition("date")
     .write.mode("overwrite")
     .option("partitionOverwriteMode", "dynamic")
     .partitionBy("date")
     .parquet("s3://lake/orders/"))`, note: 'Rerunning the same date replaces only that date. Spark disallows querying only the corrupt-record column of an uncached CSV, which is one reason for the <code>cache()</code>.' },
    { title: 'Parallel JDBC read from Postgres', lang: 'python', code: `orders = (spark.read.format("jdbc")
    .option("url", "jdbc:postgresql://replica:5432/shop")
    .option("dbtable", "public.orders")
    .option("user", "etl").option("password", pw)
    .option("partitionColumn", "id")
    .option("lowerBound", 1).option("upperBound", 200_000_000)
    .option("numPartitions", 16)          # 16 concurrent range queries
    .option("fetchsize", 10_000)
    .load())
# needs the driver jar: --packages org.postgresql:postgresql:42.7.4` },
    { title: 'Java writer API', lang: 'java', code: `orders.repartition(col("date"))
      .write()
      .mode(SaveMode.Overwrite)
      .option("partitionOverwriteMode", "dynamic")
      .partitionBy("date")
      .parquet("s3://lake/orders/");`, note: '<code>SaveMode</code> enum: <code>ErrorIfExists</code>, <code>Append</code>, <code>Overwrite</code>, <code>Ignore</code>.' }
  ]
});

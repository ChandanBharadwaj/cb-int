IA.register({
  track: 'spark',
  slug: 'partitions-shuffle',
  title: 'Partitions & shuffle',
  tagline: 'A partition is the <b>unit of parallelism</b>: one task, one core. A shuffle is the <b>expensive step</b> where every task writes rows for every other task to disk and they fetch them over the network. Most Spark tuning is about these two.',
  tldr: {
    problem: 'Jobs that are slow for no obvious reason: 199 tasks finish in seconds and one runs for an hour, 50,000 tiny files land in S3, a <code>coalesce(1)</code> makes an hour-long job single-threaded, or executors drown in shuffle spill.',
    model: '<b>Input partitions</b> come from file splits (~128 MB each). <b>Shuffle partitions</b> come from <code>spark.sql.shuffle.partitions</code> (200), adjusted by AQE. <code>repartition</code> = full shuffle, balanced. <code>coalesce</code> = merge without shuffle, cheap but can’t rebalance and stays in the upstream stage.',
    hook: '“repartition vs coalesce?” Coalesce only reduces, without a shuffle, inside the same stage. Repartition shuffles, can increase or decrease and balances.',
    facts: [
      { v: '128 MB', l: 'default <code>spark.sql.files.maxPartitionBytes</code>: the maximum bytes packed into one input partition when reading files' },
      { v: '200', l: 'default <code>spark.sql.shuffle.partitions</code>, used for joins and aggregations unless AQE coalesces' },
      { v: '2–3', l: 'tasks per CPU core in the cluster: the Spark tuning guide’s recommended level of parallelism' }
    ]
  },
  intro: {
    what: 'Spark splits every DataFrame into <b>partitions</b>. Each partition is processed by one <b>task</b> on one executor core, so the number of partitions sets how much work can happen at once. When an operation needs rows with the same key together (groupBy, join, window, distinct, orderBy), Spark does a <b>shuffle</b>: every task sorts its output by destination partition, writes it to local disk, and the next stage’s tasks download their piece from every one of those files.',
    analogy: { icon: '📦', title: 'A parcel sorting hub', text: 'Trucks (map tasks) arrive with mixed parcels. Each truck sorts parcels into bins by destination city and leaves them at the hub (shuffle write). Then one van per city (reduce task) visits every truck’s bins to collect its parcels (shuffle read). If one city gets half of all parcels, its van is still loading when everyone else has gone home: that is skew.' },
    steps: [
      { t: 'See how many partitions you have', d: 'For files, Spark packs splits up to 128 MB per partition.', code: 'df = spark.read.parquet("s3://lake/events/")\ndf.rdd.getNumPartitions()   # e.g. 812 for ~100 GB' },
      { t: 'Shuffles create new partitions', d: 'After a groupBy or join, the count comes from <code>spark.sql.shuffle.partitions</code> (or AQE).', code: 'agg = df.groupBy("user_id").count()\nspark.conf.get("spark.sql.shuffle.partitions")   # \'200\'' },
      { t: 'Change it on purpose', d: '<code>repartition</code> shuffles to exactly N (optionally by key). <code>coalesce</code> merges down to N without a shuffle.', code: 'df.repartition(64, "user_id")\ndf.coalesce(16)' },
      { t: 'Watch it in the Spark UI', d: 'Stages tab: Shuffle Read/Write sizes, Spill, and task duration min/median/max. A max far above the median means skew.' }
    ],
    terms: [
      ['partition', 'A slice of the data processed by one task.'],
      ['shuffle', 'Redistribution of rows across partitions by a key or round-robin; writes to local disk and moves data over the network.'],
      ['Exchange', 'The physical-plan node for a shuffle.'],
      ['skew', 'Uneven partition sizes, usually caused by a few very frequent keys.'],
      ['spill', 'Writing in-memory data to disk because it doesn’t fit in execution memory.'],
      ['AQE', 'Adaptive Query Execution (default on since 3.2): changes partition counts and join strategies at runtime from real shuffle sizes.']
    ]
  },
  visual: {
    title: 'Move the rows yourself',
    caption: 'Pick a mechanism and press Play or Step. Colours are keys. Compare how many rows each option shuffles and how big the largest partition ends up; the last mode opens a shuffle up to show files, block fetches and a skewed reducer.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Simulation: skew from a hot key', code: `# SIMULATION: hash partitioning 1,000,000 keys where one key is hot
import random
from collections import Counter
random.seed(7)
N = 8                                   # shuffle partitions
keys = ["hot"] * 300_000 + [f"user{random.randrange(50_000)}" for _ in range(700_000)]
part = Counter(hash(k) % N for k in keys)   # Spark: pmod(murmur3(k), N)
sizes = [part[i] for i in range(N)]
print("rows per partition:", sizes)
print("max / median:", round(max(sizes) / sorted(sizes)[N // 2], 1))

# salting: spread the hot key over S sub-keys, aggregate twice
S = 8
salted = Counter(hash((k, random.randrange(S)) if k == "hot" else k) % N for k in keys)
print("salted:", [salted[i] for i in range(N)])`, note: 'Python randomises string hashes per process, so the exact numbers change between runs; the shape does not.' },
      { label: 'Simulation: files from partitionBy', code: `# SIMULATION: files written by df.write.partitionBy("day")
tasks, days = 200, 30
# without repartition: every task may hold rows for every day
print("worst case files:", tasks * days)
# after df.repartition("day"): all rows of a day in one task
print("after repartition('day'):", days, "files (one task per day, beware big days)")
# middle ground: repartition(N, "day", salt) or maxRecordsPerFile
print("with 4 salts per day:", days * 4)` }
    ]
  },
  gotchas: [
    { trap: 'coalesce(1) makes the whole stage single-threaded', code: `heavy = raw.join(dim, "k").withColumn(...)   # no shuffle after the join probe\nheavy.coalesce(1).write.csv(out)             # all of it in 1 task`, why: 'coalesce is narrow, so it doesn’t add a stage boundary. The upstream narrow work (scan, parse, broadcast-join probe, projections) collapses into the same single task.', fix: '<code>repartition(1)</code> keeps upstream parallel and only the writer is single. Better: don’t require one file; write N files, or use <code>coalesce</code> with a moderate N.' },
    { trap: '200 shuffle partitions for every job', why: 'For 2 GB of shuffle data, 200 partitions are fine. For 5 TB they are 25 GB each and spill heavily; for 50 MB, 200 tiny tasks are pure overhead and produce 200 tiny files.', fix: 'Keep AQE on (default 3.2+) so it coalesces to about <code>spark.sql.adaptive.advisoryPartitionSizeInBytes</code> (64 MB default). For huge shuffles raise <code>spark.sql.shuffle.partitions</code> (or the AQE initial number) so each partition stays in the ~100–200 MB range, a common rule of thumb.' },
    { trap: 'partitionBy on write creates a file explosion', code: `df.write.partitionBy("day", "country").parquet(out)   # tasks × days × countries files`, why: 'Each task writes one file for every partition value it holds. 400 tasks × 30 days × 50 countries can mean hundreds of thousands of small files, which kills later reads and the object store listing.', fix: 'Repartition by the partition columns first: <code>df.repartition("day", "country").write.partitionBy(...)</code>. Cap file size with <code>maxRecordsPerFile</code>. Table formats (Delta, Iceberg) add compaction.' },
    { trap: 'Hot keys make one straggler task', why: 'Hash partitioning sends every row of a key to one task. A <code>NULL</code> key, a default value like <code>"unknown"</code>, or one huge customer can hold a large share of the rows.', fix: 'Find it: <code>groupBy(k).count().orderBy(desc("count"))</code>. Then filter/handle it separately, broadcast the small join side, let AQE split skewed join partitions, or salt the key and aggregate in two steps.' },
    { trap: 'repartition before a join that already shuffles', code: `a.repartition(400, "k").join(b, "k")   # usually reused, sometimes a wasted shuffle`, why: 'If the requested partitioning matches what the join needs, Spark reuses it. If the count or key differs from the join’s requirement, you pay for two shuffles.', fix: 'Don’t repartition “just in case”. Check <code>explain()</code> for the number of <code>Exchange</code> nodes. For repeated joins on the same key, consider bucketed tables.' },
    { trap: 'Losing executors loses shuffle files', why: 'Shuffle files live on executor local disks. If dynamic allocation removes an executor, or a spot node disappears, the next stage gets <code>FetchFailedException</code> and Spark reruns the parent stage.', fix: 'Use an external shuffle service (YARN/standalone), or on Kubernetes enable <code>spark.dynamicAllocation.shuffleTracking.enabled</code> and graceful decommissioning (3.1+), or a remote shuffle service.' }
  ],
  scenarios: [
    { title: 'Job “stuck at 199/200” every night',
      symptom: 'The aggregation stage finishes 199 tasks in 3 minutes; the last task runs 70 minutes and sometimes fails with <code>ExecutorLostFailure</code> (OOM).',
      diagnose: `# Spark UI → Stage → Summary metrics: Shuffle Read max 41 GB, median 180 MB\nevents.groupBy("device_id").count().orderBy(F.desc("count")).show(3)\n# device_id = "00000000"   2,104,882,113   <- default id from a broken SDK`,
      cause: 'A default device id from a buggy client version accounts for a quarter of all events. All of them hash to one shuffle partition.',
      fix: 'Treat the sentinel separately and salt any remaining hot keys with a two-step aggregation.',
      fixCode: `SALT = 32\nsalted = (events.withColumn("s", (F.rand() * SALT).cast("int"))\n    .groupBy("device_id", "s").agg(F.count("*").alias("c")))   # step 1: spread\nresult = salted.groupBy("device_id").agg(F.sum("c").alias("events"))  # step 2: merge` },
    { title: 'S3 listing takes longer than the query',
      symptom: 'Downstream jobs spend 15 minutes before the first task. The table has 1.4 million Parquet files averaging 300 KB.',
      diagnose: `# writer job:\ndf.write.partitionBy("day", "hour").parquet(out)    # 800 tasks, each writing to ~24 hours`,
      cause: 'Every writer task produced a file per (day, hour) it held, so files = tasks × partition values, each tiny.',
      fix: 'Shuffle by the partition columns before writing, and compact existing data.',
      fixCode: `(df.repartition("day", "hour")\n   .write.option("maxRecordsPerFile", 5_000_000)\n   .partitionBy("day", "hour").mode("overwrite").parquet(out))` },
    { title: 'Spill: 1.2 TB on disk for a 300 GB job',
      symptom: 'A join + aggregation takes 2 hours. The stage shows <i>Spill (Disk)</i> of 1.2 TB and GC time at 30% of task time.',
      diagnose: `spark.conf.get("spark.sql.shuffle.partitions")   # '200'\n# Shuffle Read total 300 GB → ~1.5 GB per task; executors 4 cores × 8 GB`,
      cause: 'With 200 partitions each task had to sort/aggregate ~1.5 GB with about 1–2 GB of execution memory per core, so it spilled repeatedly.',
      fix: 'More, smaller partitions; let AQE coalesce afterwards.',
      fixCode: `spark.conf.set("spark.sql.shuffle.partitions", 2000)        # ~150 MB per partition\nspark.conf.set("spark.sql.adaptive.enabled", "true")        # default since 3.2\nspark.conf.set("spark.sql.adaptive.coalescePartitions.enabled", "true")` }
  ],
  puzzles: [
    { kind: 'concept', q: 'You read 10 GB of splittable Parquet with default settings. Roughly how many input partitions?', options: ['1', '~80', '200', '10,000'], answer: 1, explain: 'About 10 GB / 128 MB ≈ 80 (exact numbers depend on file sizes, <code>openCostInBytes</code> and default parallelism). The 200 setting only applies after a shuffle.' },
    { kind: 'concept', q: 'Which statement about <code>coalesce(n)</code> is true?', options: ['It can increase the number of partitions', 'It always balances partition sizes', 'It avoids a shuffle by merging existing partitions', 'It is an action'], answer: 2, explain: 'coalesce merges partitions without a shuffle, so it can only reduce (on DataFrames, asking for more is a no-op) and can leave them uneven. <code>repartition</code> shuffles and balances.' },
    { kind: 'concept', q: 'A stage has 2,000 map tasks feeding 1,000 reduce partitions. How many shuffle blocks (map output segments) can reducers fetch?', options: ['3,000', '1,000', '2,000', 'Up to 2,000,000'], answer: 3, explain: 'Each reducer fetches its segment from each map output: M × R = 2,000 × 1,000. Spark batches fetches and skips empty blocks, but the metadata and request count still grow with M × R.' },
    { kind: 'concept', q: 'The Spark UI for a stage shows task duration median 8 s, max 46 min. Most likely cause?', options: ['Too few executors', 'Data skew in one partition', 'Too much broadcast', 'Driver GC'], answer: 1, explain: 'A huge max/median ratio within one stage is the signature of skew: one partition holds far more data. Check Shuffle Read size per task too.' },
    { kind: 'concept', q: 'Why is <code>repartition(1).write</code> often faster than <code>coalesce(1).write</code> after heavy processing?', options: ['repartition compresses better', 'coalesce(1) pulls the upstream narrow work into a single task; repartition(1) keeps it parallel behind a shuffle', 'coalesce always spills', 'They are identical'], answer: 1, explain: 'coalesce has no stage boundary, so the whole stage runs with one task. repartition adds a shuffle: the expensive part runs on all cores and only the final write is single-threaded.' },
    { kind: 'concept', q: 'With AQE enabled and default settings, what happens after a shuffle that produced 200 partitions totalling 300 MB?', options: ['200 tasks run', 'AQE coalesces them into a few partitions near the 64 MB advisory size', 'AQE raises them to 2,000', 'The job fails'], answer: 1, explain: 'AQE’s partition coalescing merges small contiguous shuffle partitions toward <code>advisoryPartitionSizeInBytes</code> (64 MB), so ~5 tasks instead of 200 (it also respects a minimum based on parallelism).' },
    { kind: 'concept', q: 'Where are shuffle files stored by default?', options: ['In the driver’s memory', 'On executors’ local disks (spark.local.dir)', 'In HDFS/S3', 'In the metastore'], answer: 1, explain: 'Map tasks write shuffle data and index files to local disk on their executor. That is why losing an executor can force recomputation, and why an external or remote shuffle service exists.' }
  ],
  interview: [
    { q: 'What determines the number of partitions in Spark?', a: '<ul><li><b>File reads</b>: split size up to <code>spark.sql.files.maxPartitionBytes</code> (128 MB), plus <code>openCostInBytes</code> packing of small files.</li><li><b>After shuffles</b>: <code>spark.sql.shuffle.partitions</code> (200), then AQE coalescing.</li><li><b>Explicit</b>: <code>repartition</code>, <code>coalesce</code>, <code>repartitionByRange</code>.</li><li><b>RDDs</b>: <code>spark.default.parallelism</code> and the source.</li></ul>', lvl: 'core' },
    { q: 'repartition vs coalesce?', a: '<p><code>repartition(n[, cols])</code>: full shuffle; increase or decrease; round-robin or hash by columns; balanced (unless keys are skewed). <code>coalesce(n)</code>: narrow, no shuffle, only decreases, merges existing partitions, can be uneven, and runs inside the upstream stage, so <code>coalesce(1)</code> serializes the upstream work. <code>repartitionByRange</code> samples to build range boundaries, useful before sorted writes.</p>', lvl: 'core' },
    { q: 'Describe what happens during a shuffle.', a: '<p><b>Write</b>: each map task partitions its output by target reducer (hash or range), sorts/buffers in memory, spills if needed, and writes one data file + index file per task to local disk (sort-based shuffle). <b>Read</b>: each reduce task fetches its block from every map output (local or remote via the block manager / shuffle service), possibly merging and sorting. Costs: serialization, disk I/O, network, memory for buffers, and M × R block metadata.</p>', fu: 'What is a FetchFailedException and how does Spark recover? (A map output is unreachable; Spark resubmits the parent stage tasks that produced it.)', lvl: 'deep' },
    { q: 'What makes a good partition size?', a: '<p>A common target is ~100–200 MB per partition for shuffle stages, and enough partitions for 2–3 tasks per core so that stragglers don’t idle the cluster. Too large: spill, GC, OOM, long retries. Too small: scheduling overhead (each task has ms-level overhead), many small files. AQE helps on the small side; on the large side you must give it a high enough initial number.</p>', lvl: 'core' },
    { q: 'How does AQE change partitioning at runtime?', a: '<p>After each shuffle stage, AQE reads actual map output sizes and (1) <b>coalesces</b> small adjacent shuffle partitions toward <code>advisoryPartitionSizeInBytes</code>, (2) <b>splits skewed partitions</b> in sort-merge joins (a partition is skewed if larger than <code>skewedPartitionFactor</code> × median and above <code>skewedPartitionThresholdInBytes</code>), and (3) can switch a sort-merge join to a broadcast join. Default on since Spark 3.2. See <a href="memory-tuning-aqe.html">Memory, tuning &amp; AQE</a>.</p>', lvl: 'deep' },
    { q: 'How do you avoid a shuffle entirely?', a: '<ul><li>Broadcast the small side of a join.</li><li>Filter and project early so less data reaches the Exchange.</li><li>Reuse existing partitioning (same keys and count).</li><li>Bucketed tables (<code>bucketBy</code> + <code>saveAsTable</code>) joined on the bucket key with the same bucket count.</li><li>Pre-aggregate upstream (store daily aggregates instead of raw events).</li></ul>', lvl: 'deep' },
    { q: 'What is salting and when do you use it?', a: '<p>Append a random number 0..S-1 to a hot key so its rows spread over S partitions. For aggregations: aggregate by (key, salt), then by key. For joins: salt the big side randomly and replicate the small side’s matching rows S times (explode). Use it when AQE skew handling doesn’t apply (aggregations, windows) or isn’t enough. Cost: extra rows and an extra aggregation step.</p>', lvl: 'deep' },
    { q: 'Disk partitioning (partitionBy on write) vs in-memory partitioning?', a: '<p><code>write.partitionBy("day")</code> creates directories <code>day=2024-01-01/</code> so readers can <b>prune</b> whole directories by filter. In-memory partitions are about parallelism of the current job. They interact: the number of files is tasks × directory values per task, so repartition by the directory columns before writing. Don’t <code>partitionBy</code> a high-cardinality column like <code>user_id</code>.</p>', lvl: 'core' },
    { q: 'How do you read shuffle problems in the Spark UI?', a: '<p>Stages tab: Shuffle Read/Write totals, Spill (Memory/Disk), and the summary metrics table (min / 25% / median / 75% / max of duration and shuffle read size). Spill means too-big partitions or too little memory; large max vs median means skew; many tasks of a few ms means too many partitions. SQL tab: rows and sizes per Exchange, and AQE’s final plan.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Writing a partitioned table without small files', lang: 'python', code: `from pyspark.sql import functions as F

events = spark.read.parquet("s3://lake/raw/events/")
out = (events
    .withColumn("day", F.to_date("ts"))
    .repartition("day")                               # all rows of a day in one task
    .sortWithinPartitions("user_id"))                 # better compression and min/max stats

(out.write.mode("overwrite")
    .option("maxRecordsPerFile", 5_000_000)            # split big days
    .partitionBy("day")
    .parquet("s3://lake/clean/events/"))` , note: 'If one day is far bigger than the rest, use <code>repartition("day", salt)</code> with a small salt range instead.' },
    { title: 'Two-step salted aggregation', lang: 'python', code: `SALT = 16
step1 = (events
    .withColumn("salt", (F.rand(seed=42) * SALT).cast("int"))
    .groupBy("merchant_id", "salt")
    .agg(F.sum("amt").alias("amt"), F.count("*").alias("n")))
totals = step1.groupBy("merchant_id").agg(F.sum("amt").alias("amt"), F.sum("n").alias("n"))
# only works for re-aggregatable functions (sum, count, min, max), not exact distinct counts` },
    { title: 'Java: checking and setting partitioning', lang: 'java', code: `Dataset<Row> df = spark.read().parquet("s3://lake/events/");
int n = df.rdd().getNumPartitions();
spark.conf().set("spark.sql.shuffle.partitions", "800");
Dataset<Row> byUser = df.repartition(800, col("user_id"));
byUser.explain();   // look for: Exchange hashpartitioning(user_id#3, 800)` },
    { title: 'Config cheat sheet', lang: 'yaml', code: `spark.sql.files.maxPartitionBytes: 128m        # input split size
spark.sql.shuffle.partitions: 200              # shuffle partitions (initial)
spark.sql.adaptive.enabled: true               # AQE, default since 3.2
spark.sql.adaptive.coalescePartitions.enabled: true
spark.sql.adaptive.advisoryPartitionSizeInBytes: 64m
spark.sql.adaptive.skewJoin.enabled: true
spark.dynamicAllocation.shuffleTracking.enabled: true   # K8s without external shuffle service` }
  ]
});

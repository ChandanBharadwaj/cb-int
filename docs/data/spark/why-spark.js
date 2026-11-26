IA.register({
  track: 'spark',
  slug: 'why-spark',
  title: 'Why Spark?',
  tagline: 'Spark is a <b>distributed query and compute engine</b>: you describe a transformation once, and it runs in parallel over data split across many machines, keeping intermediate results in memory instead of on disk.',
  tldr: {
    problem: 'Your data outgrew one machine: a nightly job over 2 TB of events takes 9 hours in a single Java process, or simply runs out of memory. Splitting it by hand across servers means writing your own scheduler, retries and shuffles.',
    model: 'Think “Postgres query planner + <code>ExecutorService</code>, but across a cluster”. You write DataFrame code or SQL; Spark plans it, splits the data into <b>partitions</b>, runs one task per partition on many cores, and recomputes lost pieces if a machine dies.',
    hook: '“Why is Spark faster than Hadoop MapReduce?” It keeps data in memory between steps and optimises the whole pipeline as one DAG, instead of writing to HDFS after every map/reduce job.',
    facts: [
      { v: '2009', l: 'Spark started at UC Berkeley’s AMPLab; it became a top-level Apache project in 2014' },
      { v: 'May 2025', l: 'Apache Spark 4.0 released (Java 17+, Scala 2.13, ANSI SQL mode on by default). 3.5 is the long-lived 3.x line' },
      { v: '4 APIs', l: 'Python, Scala, Java and R (SparkR is deprecated in 4.0), plus SQL. They share one engine' }
    ]
  },
  intro: {
    what: 'Imagine a table too big for one computer. Spark cuts it into many chunks called <b>partitions</b>, sends the work to many computers at once, and puts the answer back together. You write ordinary-looking code (in Python here, using <b>PySpark</b>); Spark decides how to split it up and run it.',
    analogy: { icon: '🧑‍🍳', title: 'A restaurant kitchen', text: 'One cook (your laptop) can make dinner for 4. For 4,000 guests you need a head chef who writes the plan (the <b>driver</b>) and many line cooks who each do a share (the <b>executors</b>). If one cook goes home sick, the head chef hands their share to someone else.' },
    steps: [
      { t: 'Too big for one machine', d: 'When data is many times bigger than RAM, or one CPU would take hours, you need many machines working in parallel.' },
      { t: 'Split into partitions', d: 'Spark splits the data (files, tables) into partitions, often ~128 MB each. Each partition is processed by one task on one core.' },
      { t: 'Describe, don’t loop', d: 'You describe <i>what</i> you want, much like SQL. Spark builds a plan and only runs it when you ask for a result.', code: 'df = spark.read.parquet("s3://events/")\n(df.filter(df.country == "DE")\n   .groupBy("day").count()\n   .show())' },
      { t: 'Memory, not disk', d: 'Unlike classic Hadoop MapReduce, intermediate results stay in memory where possible, which makes multi-step and iterative jobs much faster.' },
      { t: 'Use it when it pays', d: 'For data that fits on one machine, pandas, Polars, DuckDB or plain Postgres are simpler. Spark shines at hundreds of GB and beyond.' }
    ],
    terms: [
      ['cluster', 'A group of machines working together as one system.'],
      ['partition', 'One chunk of the data. The unit of parallelism: one task processes one partition.'],
      ['PySpark', 'The Python API for Spark. Your Python code drives a Spark engine that runs on the JVM.'],
      ['MapReduce', 'The older Hadoop model: a map step, a shuffle, a reduce step, with results written to disk (HDFS) after each job.'],
      ['HDFS / S3', 'Distributed storage where big data usually lives. Spark reads from it; it is not a database.']
    ]
  },
  visual: {
    title: 'Disk round-trips vs in-memory pipelines',
    caption: 'Pick a scene and press Play (or Step). Compare how MapReduce writes to HDFS between jobs, how Spark reads once and reuses cached data, and why a laptop runs out of road.'
  },
  gotchas: [
    { trap: 'Using Spark for small data', why: 'Spark has real fixed costs: JVM start-up, task scheduling (milliseconds per task) and a shuffle on every <code>groupBy</code>. On a 200 MB CSV a pandas or DuckDB script often finishes before a Spark session has started.', fix: 'Rule of thumb: if it fits comfortably in one machine’s RAM, start single-node. Reach for Spark when data or compute outgrows one box, or when the platform (e.g. Databricks) is already Spark.' },
    { trap: '“Spark is in-memory, so it never touches disk”', why: 'Shuffles write files to executor local disk, and partitions that don’t fit in memory <b>spill</b> to disk. Caching is opt-in (<code>cache()</code>).', fix: 'Say “Spark avoids writing intermediate results to distributed storage between steps”. Watch the Spill and Shuffle columns in the Spark UI.' },
    { trap: 'Treating Spark as a database', why: 'Spark has no server holding your data, no indexes in the Postgres sense, and no row-level transactions on plain files. It reads files, computes, writes files.', fix: 'For OLTP stay on Postgres. For ACID tables on a data lake use a table format such as Delta Lake or Apache Iceberg on top of Spark.' },
    { trap: 'Writing Java-style loops over rows', code: `for row in df.collect():          # pulls ALL rows to the driver
    total += row["amount"]
# instead:
df.agg(F.sum("amount")).show()`, why: '<code>collect()</code> copies the whole dataset into one Python process, which defeats the point of a cluster and often crashes the driver.', fix: 'Express the work as DataFrame operations or SQL so it runs on executors. Bring only small results back.' },
    { trap: 'Assuming Spark 3 and 4 behave the same', why: 'Spark 4.0 turns on ANSI SQL mode by default (<code>spark.sql.ansi.enabled=true</code>): invalid casts and integer overflow now raise errors instead of returning NULL or wrapping. It also needs Java 17+.', fix: 'Pin the Spark version in your project, read the migration guide when upgrading, and test jobs with real data before switching.' }
  ],
  scenarios: [
    { title: 'The nightly batch that no longer fits the night', symptom: 'A Spring Batch job that aggregates daily clickstream (now ~1.5 TB/day) runs 10+ hours and overlaps with business hours. Adding RAM to the one server stopped helping.', diagnose: 'jstat / GC logs: full GCs every few minutes\nCPU: 8 of 64 cores busy (single-threaded reader + DB writes)\nPostgres: long-running INSERT … SELECT holding locks', cause: 'A single-node design: one JVM reading files sequentially, then loading everything into Postgres for the GROUP BY. Work does not scale beyond one machine.', fix: 'Move the heavy aggregation to Spark reading the raw files in parallel, write compact Parquet aggregates, and load only the small result into Postgres.', fixCode: `daily = (spark.read.parquet("s3://clicks/date=2026-11-25/")
          .groupBy("customer_id", "page")
          .agg(F.count("*").alias("views")))
(daily.write.mode("overwrite")
      .jdbc(url, "daily_page_views", properties=props))  # small result only` },
    { title: 'A 6-node cluster that is slower than a laptop', symptom: 'A team ports a 300 MB CSV report from pandas to Spark. It now takes 3 minutes instead of 20 seconds and costs money per run.', diagnose: 'Spark UI: 1 job, 400 tasks, each ~50 ms of work and ~200 ms of scheduling\nCluster start-up: ~2 min', cause: 'Fixed overheads (cluster start, JVM, scheduling, shuffle with the default 200 shuffle partitions) dominate tiny data.', fix: 'Keep small jobs single-node (pandas/Polars/DuckDB). If it must be Spark, use a small or shared cluster and lower <code>spark.sql.shuffle.partitions</code> (or rely on AQE coalescing, on by default since 3.2).', fixCode: `spark.conf.set("spark.sql.shuffle.partitions", "8")  # tiny data` }
  ],
  puzzles: [
    { kind: 'concept', q: 'What is the main reason Spark beats Hadoop MapReduce on iterative algorithms such as k-means?', options: ['Spark uses a faster disk format', 'Spark keeps intermediate data in memory and plans multi-step pipelines as one DAG, instead of writing to HDFS after every job', 'Spark does not need a shuffle', 'Spark runs only on GPUs'], answer: 1, explain: 'Each MapReduce job reads from and writes to HDFS. An iterative algorithm chains many jobs, so it pays a full disk round-trip per iteration. Spark can cache the dataset in executor memory and reuse it.' },
    { kind: 'concept', q: 'Your dataset is a 2 GB CSV and the report runs once a day. What is usually the most sensible tool?', options: ['A 20-node Spark cluster', 'A single-node tool such as pandas, Polars or DuckDB (or Spark in local mode)', 'Hadoop MapReduce', 'It cannot be done without a cluster'], answer: 1, explain: '2 GB fits in RAM on an ordinary machine. A cluster adds start-up and scheduling overhead with no benefit. Spark pays off when data or compute exceeds one machine.' },
    { kind: 'concept', q: 'What is a partition in Spark?', options: ['A Postgres table partition', 'A chunk of a dataset that one task processes; the unit of parallelism', 'A separate Spark cluster', 'A disk volume'], answer: 1, explain: 'Spark splits every dataset into partitions. Each stage runs one task per partition, and tasks run in parallel on executor cores.' },
    { kind: 'concept', q: 'A machine in the cluster dies halfway through a job. What does Spark do?', options: ['The whole job fails and must be restarted by hand', 'It recomputes only the lost partitions from the recorded lineage (plan) and retries the failed tasks', 'It restores from a database backup', 'Nothing; results are silently missing'], answer: 1, explain: 'Spark records how each partition was derived. Lost tasks are retried (by default up to 4 attempts, <code>spark.task.maxFailures</code>), and lost data is recomputed from lineage.' },
    { kind: 'concept', q: 'Which statement about Spark and disk is correct?', options: ['Spark never writes to disk', 'Shuffles write to executor local disk, and data that does not fit in memory spills to disk', 'Spark only runs on SSDs', 'Spark stores all data in the driver'], answer: 1, explain: '“In-memory” means intermediate results don’t go back to distributed storage between steps. Shuffle files and spills still use local disk.' },
    { kind: 'concept', q: 'Which change is a default in Spark 4.0 but not in 3.5?', options: ['DataFrame API introduced', 'ANSI SQL mode enabled by default, so bad casts and overflows raise errors', 'Python support added', 'Adaptive Query Execution introduced'], answer: 1, explain: 'Spark 4.0 sets <code>spark.sql.ansi.enabled=true</code> by default. DataFrames date from 1.3/2.0, Python support from the start, and AQE has been on by default since 3.2.' }
  ],
  interview: [
    { q: 'What is Apache Spark, in one minute?', a: '<p>A distributed engine for large-scale data processing. You write transformations in SQL, Python, Scala or Java; Spark builds an optimised plan (a DAG), splits data into partitions and runs tasks in parallel on executors across a cluster, recovering from failures by recomputing from lineage.</p>', lvl: 'core' },
    { q: 'How does Spark differ from Hadoop MapReduce?', a: '<ul><li>MapReduce: fixed map → shuffle → reduce per job, output to HDFS each time.</li><li>Spark: arbitrary DAGs of operators, pipelined within stages, optional in-memory caching, a query optimiser (Catalyst) for DataFrames/SQL.</li><li>Spark can still run on YARN and read HDFS; it replaced the MapReduce <i>engine</i>, not Hadoop storage.</li></ul>', lvl: 'core' },
    { q: 'When would you <i>not</i> use Spark?', a: '<p>Small or medium data that fits on one machine; low-latency OLTP (use Postgres); per-request APIs needing millisecond responses; simple ETL a database can do with SQL. Spark’s overheads (cluster, scheduling, shuffles) only pay off at scale.</p>', fu: 'What would you use instead for 5 GB? pandas/Polars/DuckDB, or SQL in Postgres.', lvl: 'core' },
    { q: 'What does “Spark is lazy” mean and why does it help?', a: '<p>Transformations only build a plan; nothing runs until an action (<code>count</code>, <code>show</code>, <code>write</code>). Seeing the whole plan lets Spark optimise it: push filters into the file scan, prune columns, and fuse steps into one pass.</p>', lvl: 'core' },
    { q: 'What makes Spark fault tolerant?', a: '<p>Each dataset records its <b>lineage</b>: the transformations that produced it from source data. If an executor is lost, Spark re-runs only the tasks for the missing partitions. Shuffle files on a lost node trigger recomputation of the map stage that produced them.</p>', lvl: 'deep' },
    { q: 'Name the main Spark components (libraries).', a: '<ul><li><b>Spark SQL / DataFrames</b>: the main API today.</li><li><b>Structured Streaming</b>: streams as unbounded tables.</li><li><b>MLlib</b>: distributed ML.</li><li><b>GraphX</b>: graphs (Scala-only, little active development).</li><li>Core RDD API underneath.</li></ul>', lvl: 'core' },
    { q: 'Why is Python so popular with Spark if Spark runs on the JVM?', a: '<p>DataFrame and SQL operations run entirely in the JVM; Python only builds the plan. So PySpark DataFrame code is usually about as fast as Scala. The cost appears with Python UDFs and RDD lambdas, which ship rows to Python worker processes. Arrow-based pandas UDFs reduce that cost.</p>', lvl: 'deep' },
    { q: 'What changed in Spark 4.0 that a team upgrading from 3.5 must check?', a: '<ul><li>Java 17+ and Scala 2.13 only.</li><li>ANSI mode on by default: overflow, bad casts and division by zero raise errors.</li><li>Spark Connect matured (and a lightweight <code>pyspark-client</code> package).</li><li>New features such as the VARIANT type and SQL pipe syntax.</li></ul>', fu: 'How do you de-risk it? Run the jobs on 4.0 against production-like data with ANSI on, compare outputs.', lvl: 'deep' },
    { q: 'How is Spark like / unlike the Postgres executor you know?', a: '<p>Like Postgres: a declarative query is parsed, optimised (rule and cost based), and executed as a tree of operators (scan, filter, hash aggregate, sort-merge join). Unlike Postgres: operators run as tasks across many machines, data moves between them in shuffles, and storage is external files rather than a buffer-managed heap.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Same aggregation: Postgres vs PySpark', lang: 'python', code: `# Postgres:  SELECT country, count(*) FROM orders WHERE amount > 100 GROUP BY country;
from pyspark.sql import SparkSession, functions as F

spark = SparkSession.builder.appName("orders-by-country").getOrCreate()
orders = spark.read.parquet("s3://lake/orders/")

(orders.filter(F.col("amount") > 100)
       .groupBy("country")
       .agg(F.count("*").alias("n"))
       .orderBy(F.desc("n"))
       .show())`, note: 'Or literally the same SQL: <code>orders.createOrReplaceTempView("orders"); spark.sql("SELECT …").show()</code>.' },
    { title: 'Same thing in Java (Spark 4, Java 17+)', lang: 'java', code: `import static org.apache.spark.sql.functions.*;
import org.apache.spark.sql.*;

SparkSession spark = SparkSession.builder().appName("orders-by-country").getOrCreate();
Dataset<Row> orders = spark.read().parquet("s3://lake/orders/");

orders.filter(col("amount").gt(100))
      .groupBy("country")
      .agg(count("*").alias("n"))
      .orderBy(desc("n"))
      .show();`, note: 'Java and Python build the same logical plan, so the executed job is identical.' }
  ]
});

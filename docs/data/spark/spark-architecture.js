IA.register({
  track: 'spark',
  slug: 'spark-architecture',
  title: 'Spark architecture',
  tagline: 'Every Spark application is <b>one driver</b> that plans the work and <b>many executors</b> that do it, with a <b>cluster manager</b> handing out the machines. <code>SparkSession</code> is your handle on the driver.',
  tldr: {
    problem: 'Jobs that crash with “driver OutOfMemory”, executors that sit idle, or code that works locally and fails on the cluster all come from not knowing <i>where</i> each line of your program runs.',
    model: 'The <b>driver</b> runs your <code>main</code>/script, builds the plan and schedules <b>tasks</b>. <b>Executors</b> are JVM processes on worker nodes; each core runs one task on one partition at a time. The <b>cluster manager</b> (YARN, Kubernetes, Standalone) only allocates resources.',
    hook: '“Where does <code>df.collect()</code> put the data?” In the driver’s memory. That’s why it OOMs on big DataFrames, while <code>df.write</code> streams from the executors straight to storage.',
    facts: [
      { v: '1 task', l: 'per partition per stage. An executor runs as many tasks at once as it has cores (<code>spark.executor.cores</code> / <code>spark.task.cpus</code>)' },
      { v: '4040', l: 'default port of the driver’s Spark UI (it tries 4041, 4042… if taken)' },
      { v: '3.4+', l: 'Spark Connect: a thin client talks to a remote driver over gRPC (default port 15002)' }
    ]
  },
  intro: {
    what: 'A Spark program has a boss and workers. The boss, called the <b>driver</b>, reads your code and turns it into small pieces of work called <b>tasks</b>. The workers, called <b>executors</b>, run those tasks on their slice of the data. A <b>cluster manager</b> is the service that finds machines to run executors on.',
    analogy: { icon: '🏗️', title: 'A building site', text: 'The site manager (driver) has the blueprint and decides who does what. The staffing agency (cluster manager) supplies crews. Each crew (executor) has a few workers (cores), and each worker lays one section of bricks (a task on a partition) at a time.' },
    steps: [
      { t: 'You start the driver', d: 'Running your script, a notebook, or <code>spark-submit</code> starts the driver process.' },
      { t: 'SparkSession', d: 'The entry point for DataFrames and SQL since Spark 2.0. <code>getOrCreate()</code> returns the existing session if there is one.', code: 'from pyspark.sql import SparkSession\nspark = SparkSession.builder.appName("demo").getOrCreate()' },
      { t: 'Executors are launched', d: 'The driver asks the cluster manager for executors. Each one is a JVM with some memory and some cores.' },
      { t: 'An action creates a job', d: 'When you call <code>show()</code>, <code>count()</code> or <code>write</code>, the driver splits the job into stages (at shuffles) and tasks (one per partition).' },
      { t: 'Tasks run in parallel', d: 'Executors read their partitions directly from storage, compute, and send only small results back to the driver.' }
    ],
    terms: [
      ['driver', 'The process that runs your program, holds the SparkSession, plans jobs and schedules tasks.'],
      ['executor', 'A worker process (JVM) that runs tasks and can cache data. Lives for the whole application by default.'],
      ['cluster manager', 'Allocates machines/containers: YARN, Kubernetes or Spark Standalone (Mesos was removed in 4.0).'],
      ['job / stage / task', 'Job = one action. Stage = steps that run without a shuffle. Task = one stage on one partition.'],
      ['SparkContext', 'The older, lower-level entry point (RDDs). <code>spark.sparkContext</code> gives it to you, except over Spark Connect.'],
      ['deploy mode', '<code>client</code>: driver runs where you submit. <code>cluster</code>: driver runs inside the cluster.']
    ]
  },
  visual: {
    title: 'Follow one job through the cluster',
    caption: 'Press Play to watch a <code>groupBy().count().show()</code> travel from driver to executors and back. Switch to “Spark Connect” to see the 3.4+ client/server split.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Sim: tasks vs cores', code: `# SIMULATION in plain Python (not Spark): how many "waves" of tasks run
# when a stage has N partitions and the cluster has C task slots.
import math

def waves(partitions, executors, cores_per_executor, secs_per_task=10):
    slots = executors * cores_per_executor
    w = math.ceil(partitions / slots)
    return slots, w, w * secs_per_task

for parts in (6, 12, 13, 200):
    slots, w, t = waves(parts, executors=3, cores_per_executor=4)
    print(f"{parts:>3} partitions on {slots} slots -> {w} wave(s), ~{t}s")`, note: 'Simulation only. 13 partitions on 12 slots needs a second wave for one task: the stage takes twice as long. Aim for partitions ≈ a few × total cores.' },
      { label: 'Sim: collect() on the driver', code: `# SIMULATION: rows that come back to the driver for different actions.
partitions = [list(range(i * 1_000_000, (i + 1) * 1_000_000)) for i in range(4)]

def show(n=20):            # takes only what it needs, partition by partition
    out = []
    for p in partitions:
        out += p[: n - len(out)]
        if len(out) >= n: break
    return out

def collect():             # everything goes to the driver
    return [x for p in partitions for x in p]

def count():               # executors send back one number each
    return sum(len(p) for p in partitions)

print("show  ->", len(show()), "rows to driver")
print("count ->", 4, "numbers to driver, total", count())
print("collect ->", len(collect()), "rows to driver (driver OOM risk)")` }
    ]
  },
  gotchas: [
    { trap: '<code>collect()</code> / <code>toPandas()</code> on big data', code: `pdf = big_df.toPandas()   # every row → driver memory`, why: 'Both copy the whole DataFrame into the driver process. Driver memory (<code>spark.driver.memory</code>, often 1–4 GB) is far smaller than the cluster’s total. Spark also caps it with <code>spark.driver.maxResultSize</code> (1g by default).', fix: 'Aggregate or <code>limit()</code> first, or write results to storage. Use <code>take(n)</code>/<code>show()</code> to look at data.' },
    { trap: 'Code at top level runs on the driver, code in UDFs runs on executors', code: `conn = psycopg.connect(DSN)           # driver
@F.udf("string")
def lookup(x):
    return conn.execute(...)            # executor: conn can't be pickled / isn't there`, why: 'Functions passed to Spark are serialised and shipped to executors. Driver-side objects such as DB connections, files or locks don’t travel.', fix: 'Create per-partition resources inside <code>mapPartitions</code> / <code>foreachPartition</code>, or better, read the lookup table as a DataFrame and join.' },
    { trap: 'More executors than partitions', why: 'If a stage has 8 partitions, at most 8 tasks run, no matter if you have 200 cores. The rest idle.', fix: 'Check task counts in the Spark UI. Repartition input that arrives as a few huge (e.g. gzipped) files; size shuffles with <code>spark.sql.shuffle.partitions</code> or AQE.' },
    { trap: 'Creating several SparkSessions/SparkContexts', why: 'Only one active <code>SparkContext</code> per JVM. <code>SparkSession.builder…getOrCreate()</code> returns the existing session, and some builder configs (e.g. <code>spark.executor.memory</code>) are ignored if a context already exists.', fix: 'Create the session once at start-up. Set resource configs via <code>spark-submit --conf</code> or before the first <code>getOrCreate()</code>.' },
    { trap: 'Client deploy mode from a laptop to a remote cluster', why: 'In client mode the driver runs on your laptop; executors must connect back to it. Firewalls, VPN drops and laptop sleep kill the job, and results travel over your Wi-Fi.', fix: 'Use <code>--deploy-mode cluster</code> for production jobs, or Spark Connect for interactive remote work.' },
    { trap: 'Spark Connect has no SparkContext / RDDs', code: `spark = SparkSession.builder.remote("sc://host").getOrCreate()
spark.sparkContext   # error over Connect`, why: 'Connect sends DataFrame plans only. RDD APIs, <code>sparkContext</code> and JVM access via <code>_jvm</code> are not available.', fix: 'Stay with DataFrame/SQL APIs, which also makes code portable to Databricks serverless and shared clusters built on Connect.' }
  ],
  scenarios: [
    { title: 'Driver OOM in the report job', symptom: 'A daily job dies with <code>java.lang.OutOfMemoryError: Java heap space</code> on the driver, or “Total size of serialized results … is bigger than spark.driver.maxResultSize”, after the dataset grew.', diagnose: 'grep -n "collect\\|toPandas" job.py\n#   rows = enriched.collect()        # 40M rows\nSpark UI → Jobs: last stage completes, then the driver dies', cause: 'The job collected an entire DataFrame to build a CSV in Python on the driver.', fix: 'Let the executors write the output in parallel; coalesce only if a single file is truly required and the data is small.', fixCode: `(enriched.coalesce(1)          # only if result is small
         .write.mode("overwrite")
         .option("header", True)
         .csv("s3://reports/2026-11-25/"))` },
    { title: '64 cores, 4 busy', symptom: 'A cluster of 8 executors × 8 cores runs a stage for 40 minutes; CPU graphs show most executors idle.', diagnose: 'Spark UI → Stages: stage 0 has 4 tasks\nInput: 4 × 12 GB .csv.gz files', cause: 'Gzip is not splittable, so each file becomes exactly one partition: 4 tasks, 4 busy cores.', fix: 'Repartition right after the read (costs one shuffle but parallelises everything after), and convert raw data to Parquet once so future reads split well.', fixCode: `raw = spark.read.option("header", True).csv("s3://raw/*.csv.gz")
df = raw.repartition(256)   # spread over all 64 cores
df.write.mode("overwrite").parquet("s3://bronze/events/")` },
    { title: 'Notebook job dies when the laptop sleeps', symptom: 'A long backfill launched from a local Jupyter notebook against a YARN cluster fails overnight with executors reporting lost connection to the driver.', cause: 'Client deploy mode: the driver lived in the notebook kernel on the laptop. When the laptop slept, the driver disappeared and the application was killed.', fix: 'Package the code and submit it in cluster mode (or run it as a scheduled job on the platform).', fixCode: `spark-submit --master yarn --deploy-mode cluster \\
  --num-executors 20 --executor-cores 4 --executor-memory 8g \\
  backfill.py --from 2026-01-01 --to 2026-11-01`, lang: 'bash' }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which component decides how a DataFrame query is split into stages and tasks?', options: ['The cluster manager', 'The driver (DAG scheduler + task scheduler)', 'Each executor independently', 'HDFS'], answer: 1, explain: 'The driver turns an action into a job, cuts it into stages at shuffle boundaries and schedules tasks. The cluster manager only provides executors.' },
    { kind: 'concept', q: 'A stage reads 10 partitions. You have 5 executors with 4 cores each. How many tasks can run at the same time for this stage?', options: ['5', '10', '20', '40'], answer: 1, explain: 'There are 20 slots, but only 10 tasks exist (one per partition). Ten slots stay idle.' },
    { kind: 'concept', q: 'Where does <code>df.count()</code> do most of its work?', options: ['On the driver, after pulling all rows', 'On executors: each counts its partitions and sends one number back to the driver', 'In the cluster manager', 'In the Python process only'], answer: 1, explain: 'Executors compute partial counts; the driver only adds them up. Compare <code>collect()</code>, which ships every row.' },
    { kind: 'concept', q: 'What does <code>SparkSession.builder.getOrCreate()</code> do if a session already exists in the process?', options: ['Throws an error', 'Returns the existing session (some configs set on the builder may not take effect)', 'Starts a second SparkContext', 'Restarts the cluster'], answer: 1, explain: 'It returns the active/default session. Static configs such as executor memory only apply when the underlying SparkContext is first created.' },
    { kind: 'concept', q: 'In <code>--deploy-mode cluster</code> on YARN, where does the driver run?', options: ['On the machine where you typed spark-submit', 'Inside the cluster (in the YARN ApplicationMaster container)', 'On every executor', 'On the HDFS NameNode'], answer: 1, explain: 'Cluster mode runs the driver in the cluster, so the job survives your terminal closing. Client mode keeps it on the submitting machine.' },
    { kind: 'concept', q: 'Which is NOT available to a PySpark client using Spark Connect?', options: ['DataFrame API', 'spark.sql()', 'RDD API via spark.sparkContext', 'Reading Parquet'], answer: 2, explain: 'Spark Connect only transmits DataFrame/SQL plans. SparkContext and RDDs need a local JVM driver.' },
    { kind: 'concept', q: 'An executor JVM crashes mid-stage. What happens to its running tasks?', options: ['The application always fails', 'The driver reschedules those tasks on other executors; lost shuffle output may cause earlier map tasks to rerun', 'They are skipped', 'The cluster manager runs them itself'], answer: 1, explain: 'Tasks are retried elsewhere (up to <code>spark.task.maxFailures</code>, default 4). If the lost executor held shuffle files, the parent stage’s affected tasks are recomputed.' }
  ],
  interview: [
    { q: 'Describe the roles of driver, executors and cluster manager.', a: '<ul><li><b>Driver</b>: runs <code>main</code>, holds SparkSession, builds and optimises the plan, schedules tasks, tracks results.</li><li><b>Executors</b>: JVMs on worker nodes that run tasks, keep cached data and shuffle files.</li><li><b>Cluster manager</b>: YARN, Kubernetes or Standalone; allocates containers/pods. It does not understand your job.</li></ul>', lvl: 'core' },
    { q: 'What is the difference between a job, a stage and a task?', a: '<p>A <b>job</b> is triggered by one action. It is split into <b>stages</b> at shuffle boundaries (wide dependencies). Each stage runs one <b>task per partition</b>. Narrow operations inside a stage are pipelined in the same task.</p>', fu: 'How many jobs does one <code>show()</code> create? Usually one, but schema inference, sorting (range sampling) or AQE can add extra jobs.', lvl: 'core' },
    { q: 'SparkSession vs SparkContext?', a: '<p><code>SparkContext</code> (1.x) is the low-level connection to the cluster and RDD entry point. <code>SparkSession</code> (2.0+) unifies SQLContext/HiveContext and is the entry point for DataFrames and SQL; it wraps a SparkContext (<code>spark.sparkContext</code>). There is one SparkContext per JVM, but you can have several sessions (<code>newSession()</code>) sharing it with separate SQL configs and temp views.</p>', lvl: 'core' },
    { q: 'Client vs cluster deploy mode: when do you use each?', a: '<p><b>Client</b>: driver on the submitting machine; good for interactive shells and notebooks close to the cluster. <b>Cluster</b>: driver inside the cluster; use for production jobs so they don’t depend on the submitter’s machine or network.</p>', lvl: 'core' },
    { q: 'How do you size executors?', a: '<p>Common starting point: 4–5 cores per executor (more cores means more threads fighting over one heap and shared I/O), memory sized per core for your workload, plus overhead (<code>spark.executor.memoryOverhead</code>, default max(384 MB, 10%)). Leave room on each node for the OS and node daemons. Then tune from the Spark UI: spill, GC time, task skew.</p>', fu: 'What is dynamic allocation? Spark adds/removes executors based on the task backlog (<code>spark.dynamicAllocation.enabled</code>); it needs shuffle data to survive executor removal (external shuffle service or shuffle tracking).', lvl: 'deep' },
    { q: 'What runs in Python and what runs in the JVM in PySpark?', a: '<p>Your script and the DataFrame API calls run in Python on the driver, talking to the driver JVM via Py4J. DataFrame execution happens entirely in executor JVMs. Only Python UDFs, pandas UDFs and RDD lambdas start Python worker processes on executors, with rows serialised between JVM and Python (Arrow for pandas UDFs).</p>', lvl: 'deep' },
    { q: 'What is Spark Connect and why does it matter?', a: '<p>Since 3.4, a client/server protocol: the client builds unresolved logical plans and sends them over gRPC to a long-running server that hosts the driver. Benefits: thin clients (no JVM), language clients beyond Python/Scala, isolation (a client crash doesn’t kill the driver), easier upgrades. Limits: no RDDs or SparkContext.</p>', lvl: 'deep' },
    { q: 'What is the Spark UI and what do you look at first?', a: '<p>A web UI served by the driver (port 4040; History Server for finished apps). First look: Jobs → slowest stage; Stages → task duration distribution (skew), shuffle read/write, spill, GC time; SQL tab → the physical plan; Executors → failed tasks and memory.</p>', lvl: 'core' },
    { q: 'Can executors talk to each other directly?', a: '<p>Yes, for shuffles and broadcast blocks: executors fetch shuffle blocks from each other’s block managers. Control flow (task assignment, status) always goes through the driver.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Production spark-submit', lang: 'bash', code: `spark-submit \\
  --master k8s://https://api.my-cluster:6443 \\
  --deploy-mode cluster \\
  --name orders-daily \\
  --conf spark.executor.instances=10 \\
  --conf spark.executor.cores=4 \\
  --conf spark.executor.memory=8g \\
  --conf spark.driver.memory=4g \\
  --conf spark.kubernetes.container.image=registry.example.com/spark-py:4.0.1 \\
  local:///opt/app/orders_daily.py --date 2026-11-25`, note: 'Resource settings belong on submit, not inside the script after the session exists.' },
    { title: 'Session + where code runs (PySpark)', lang: 'python', code: `from pyspark.sql import SparkSession, functions as F

spark = (SparkSession.builder
         .appName("orders-daily")
         .config("spark.sql.shuffle.partitions", "400")   # runtime SQL conf: OK here
         .getOrCreate())

orders = spark.read.parquet("s3://lake/orders/")           # driver: builds plan
daily = orders.groupBy("country").agg(F.sum("amount"))     # driver: builds plan
daily.write.mode("overwrite").parquet("s3://out/daily/")   # executors: do the work
print(spark.sparkContext.uiWebUrl)                         # driver UI address` },
    { title: 'Java: SparkSession in a Spring Boot batch app', lang: 'java', code: `@Configuration
class SparkConfig {
  @Bean(destroyMethod = "stop")
  SparkSession spark() {
    return SparkSession.builder()
        .appName("orders-daily")
        .master(System.getProperty("spark.master", "local[*]"))  // spark-submit sets it in prod
        .getOrCreate();
  }
}`, note: 'Spark 4 needs Java 17+. Beware dependency clashes (Jackson, Guava, Netty) between Boot and Spark jars; many teams keep Spark jobs in a separate module.' }
  ]
});

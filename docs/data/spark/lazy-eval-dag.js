IA.register({
  track: 'spark',
  slug: 'lazy-eval-dag',
  title: 'Lazy evaluation & the DAG',
  tagline: 'Transformations only <b>describe</b> work. An <b>action</b> turns the description into a <b>job</b>, the job into <b>stages</b> split at shuffles, and each stage into one <b>task per partition</b>. Reading a Spark UI is reading this tree.',
  tldr: {
    problem: 'A Java developer expects <code>df.filter(...)</code> to filter something. It doesn’t. Then a single <code>count()</code> takes 20 minutes, errors appear on a line far from the bug, and the same data gets read three times.',
    model: 'A DataFrame is an immutable <b>plan</b> (like a Java <code>Stream</code> before its terminal operation). Actions trigger <b>Catalyst</b> optimization and the <b>DAG scheduler</b>: <b>job</b> per action → <b>stages</b> cut at shuffle boundaries → <b>tasks</b>, one per partition, run on executor cores.',
    hook: '“How many jobs, stages and tasks does this code create?” Count actions for jobs, shuffles + 1 for stages, partitions for tasks.',
    facts: [
      { v: '1 job', l: 'per action, roughly (<code>count</code>, <code>collect</code>, <code>write</code>…); some operations add extra small jobs, such as sampling for <code>orderBy</code>' },
      { v: 'shuffles + 1', l: 'stages in a linear job: every Exchange in the physical plan ends one stage and starts the next' },
      { v: '1 task', l: 'per partition per stage: a stage over 200 shuffle partitions runs 200 tasks' }
    ]
  },
  intro: {
    what: 'When you call <code>filter</code>, <code>select</code> or <code>groupBy</code>, Spark does no work. It records what you asked for in a <b>plan</b>. Only when you ask for an answer (an <b>action</b>, such as <code>show</code>, <code>count</code>, <code>collect</code> or <code>write</code>) does Spark optimize the whole plan and run it on the cluster. Being lazy lets Spark see the whole pipeline before running it, so it can skip columns you never use and push filters down to the files.',
    analogy: { icon: '🧾', title: 'A shopping list, not a shopping trip', text: 'Each transformation adds a line to a shopping list. Nobody leaves the house. The action is “go shopping now”: you look at the whole list, plan a route through the shop (optimizer), and send several people to different aisles at once (tasks). If you lose a bag, the list tells you exactly what to buy again (lineage).' },
    steps: [
      { t: 'Transformations return new DataFrames', d: 'Nothing runs. Same idea as building a Java <code>Stream</code> pipeline.', code: 'paid = orders.filter(F.col("status") == "paid")   # instant\nbig = paid.filter(F.col("amt") > 100)              # instant' },
      { t: 'An action runs a job', d: 'Look at the Spark UI (port 4040 locally) to see it.', code: 'big.count()          # job runs now\nbig.show(5)          # another job' },
      { t: 'Look at the plan', d: '<code>explain()</code> prints what will run, without running it.', code: 'big.explain()                # physical plan\nbig.explain("formatted")     # easier to read' },
      { t: 'Reuse explicitly', d: 'Without caching, each action recomputes from the source. See <a href="caching-persistence.html">Caching &amp; persistence</a>.', code: 'big.cache()\nbig.count(); big.show()      # second action reads the cache' }
    ],
    terms: [
      ['transformation', 'Returns a new DataFrame: <code>filter</code>, <code>select</code>, <code>join</code>, <code>groupBy().agg</code>. Lazy.'],
      ['action', 'Returns a result or writes data: <code>count</code>, <code>collect</code>, <code>show</code>, <code>take</code>, <code>write</code>, <code>foreach</code>.'],
      ['job', 'All work triggered by one action.'],
      ['stage', 'A set of tasks that can run without a shuffle in between.'],
      ['task', 'One unit of work: one stage applied to one partition, run on one executor core.'],
      ['DAG', 'Directed acyclic graph: the stages and their dependencies.']
    ]
  },
  visual: {
    title: 'From code to stages and tasks',
    caption: 'Press Play or Step. Watch the plan grow while the job counter stays at 0. The action at step 5 creates the job; orange Exchange boxes become stage boundaries, and the small squares are tasks.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Simulation: lazy plan vs action', code: `# SIMULATION: a tiny lazy "DataFrame" in plain Python.
# Transformations append to a plan; only an action executes it.
class LazyDF:
    def __init__(self, source, plan=()):
        self.source, self.plan = source, plan
    def filter(self, f):     return LazyDF(self.source, self.plan + (("filter", f),))
    def map(self, f):        return LazyDF(self.source, self.plan + (("map", f),))
    def count(self):         return sum(1 for _ in self._run())       # action
    def collect(self):       return list(self._run())                  # action
    def _run(self):
        print("  >> job started, reading source")
        for row in self.source():
            for op, f in self.plan:
                if op == "filter" and not f(row): break
                if op == "map": row = f(row)
            else:
                yield row

def source():
    yield from range(10)

df = LazyDF(source).filter(lambda x: x % 2 == 0).map(lambda x: x * 10)
print("plan:", [op for op, _ in df.plan], "(nothing ran yet)")
print("count:", df.count())
print("collect:", df.collect())     # source read again: no cache`, note: 'Rows flow through all narrow steps in one pass, as in a Spark stage. Spark adds an optimizer, partitions, shuffles and a scheduler.' }
    ]
  },
  gotchas: [
    { trap: 'The error shows up at the action, not the bug', code: `df2 = df.withColumn("n", F.col("raw").cast("int"))   # bug here (4.0: bad values)\n...\ndf9.write.parquet(out)                               # CAST_INVALID_INPUT raised here`, why: 'Name and type errors fail early (analysis is eager in classic PySpark), but data errors only happen while tasks run, at the first action.', fix: 'Read the full error and the plan node it names. While debugging, call an action on intermediate steps (<code>df2.limit(10).collect()</code>) to bisect.' },
    { trap: 'Each action recomputes everything', code: `clean = expensive_pipeline(raw)\nclean.count()          # job 1: reads + processes\nclean.write.parquet()  # job 2: reads + processes again`, why: 'A DataFrame is a plan, not data. Every action runs the plan from the source.', fix: 'Write once and read the result, or <code>cache()</code>/<code>persist()</code> when the result is reused and fits. Drop debugging <code>count()</code> calls in production code.' },
    { trap: 'withColumn in a loop blows up the plan', code: `for c in cols:                       # 300 columns\n    df = df.withColumn(c, F.trim(c))   # 300 nested Projects`, why: 'Each call creates a new plan node and re-runs analysis on an ever deeper tree. Driver time grows fast; very deep plans can even cause <code>StackOverflowError</code>.', fix: 'Build all expressions and use one <code>select</code>, or <code>withColumns({...})</code> (Spark 3.3+).' },
    { trap: 'collect() pulls everything to the driver', why: '<code>collect()</code> and <code>toPandas()</code> bring every row into the driver’s memory. On a large DataFrame the driver dies with OOM, or hits <code>spark.driver.maxResultSize</code> (default 1g).', fix: 'Aggregate or <code>limit</code> first, use <code>take(n)</code>/<code>show()</code>, or write results to storage.' },
    { trap: 'Long lineage in iterative jobs', why: 'Loops that keep transforming the same DataFrame (graph algorithms, iterative ML, incremental unions) grow the lineage. Planning slows down, and recovery after a lost executor can recompute the whole history.', fix: 'Cut lineage every N iterations with <code>df.checkpoint()</code> (needs <code>spark.sparkContext.setCheckpointDir</code>) or <code>localCheckpoint()</code>. <code>cache()</code> keeps the lineage.' }
  ],
  scenarios: [
    { title: 'Job reads 4 TB from S3 three times',
      symptom: 'A nightly job takes 3× longer than expected. S3 request metrics show the same input prefix scanned three times per run.',
      diagnose: `# Spark UI → Jobs: 3 jobs, each with a FileScan over the full input\nlog.info(f"rows: {clean.count()}")     # job 1 (debug log)\nclean.write.parquet(out_a)             # job 2\nclean.groupBy("k").count().write...    # job 3`,
      cause: 'Three actions on an uncached DataFrame, each replaying the full lineage from S3.',
      fix: 'Remove the debug count, and materialise the shared result once.',
      fixCode: `clean.write.mode("overwrite").parquet(out_a)\nclean_m = spark.read.parquet(out_a)         # cheap re-read, columnar\nclean_m.groupBy("k").count().write.parquet(out_b)` },
    { title: 'Driver spends 25 minutes before the first task',
      symptom: 'The Spark UI shows no running jobs for 25 minutes after start. The driver is at 100% CPU; executors are idle.',
      diagnose: `# driver thread dump: stuck in org.apache.spark.sql.catalyst.analysis.Analyzer\n# code:\nfor c in df.columns:       # ~800 columns\n    df = df.withColumn(c, F.when(F.col(c) == "", None).otherwise(F.col(c)))`,
      cause: '800 chained <code>withColumn</code> calls created an 800-level deep plan, re-analysed after every call.',
      fix: 'One <code>select</code> with all expressions.',
      fixCode: `df = df.select([F.when(F.col(c) == "", None).otherwise(F.col(c)).alias(c)\n                for c in df.columns])` }
  ],
  puzzles: [
    { kind: 'concept', q: 'How many Spark jobs does this run?', code: `df = spark.read.parquet("p")\na = df.filter("x > 0")\nb = a.select("x", "y")\nc = b.withColumn("z", F.col("x") * 2)`, lang: 'python', options: ['0', '1', '3', '4'], answer: 0, explain: 'No action, so <b>0</b> jobs for the transformations. (Reading Parquet may read file footers for the schema, and with many files Spark can run a small listing/schema job, but nothing processes rows.)' },
    { kind: 'concept', q: 'A job reads a table, filters it, does one <code>groupBy().agg()</code> and writes. With AQE off, how many stages?', options: ['1', '2', '3', '4'], answer: 1, explain: 'One shuffle (the Exchange for the groupBy) → <b>2</b> stages: scan + filter + partial agg, then final agg + write.' },
    { kind: 'concept', q: 'Stage 2 reads a shuffle with <code>spark.sql.shuffle.partitions = 200</code>, AQE disabled. How many tasks does it have?', options: ['1', 'One per executor', '200', 'One per input file'], answer: 2, explain: 'One task per partition: 200. With AQE on (default since 3.2), small shuffle partitions may be coalesced into fewer tasks.' },
    { kind: 'concept', q: 'In classic PySpark, when does <code>df.select("no_such_col")</code> fail?', options: ['Immediately, with an AnalysisException', 'At the next action', 'Never: the column is NULL', 'When the executor reads the file'], answer: 0, explain: 'Analysis (name resolution) happens eagerly when the DataFrame is created. Execution is lazy; analysis isn’t. With Spark Connect the client may only find out when the plan is first sent to the server.' },
    { kind: 'concept', q: 'Which is an action?', options: ['<code>df.repartition(10)</code>', '<code>df.cache()</code>', '<code>df.take(5)</code>', '<code>df.join(other, "k")</code>'], answer: 2, explain: '<code>take</code> returns rows to the driver, so it triggers a job. <code>cache()</code> is lazy: it only marks the DataFrame; the cache fills on the next action.' },
    { kind: 'concept', q: 'Why does Spark pipeline <code>filter → select → withColumn</code> into one stage?', options: ['They are cached', 'They are narrow: each output partition depends on one input partition', 'They run on the driver', 'AQE merges them'], answer: 1, explain: 'Narrow transformations need no data from other partitions, so one task applies them all in a single pass (and whole-stage codegen fuses them into one function).' },
    { kind: 'concept', q: 'An executor dies halfway through Stage 1. What does Spark do?', options: ['Fails the job', 'Restarts the whole application', 'Recomputes the lost tasks (and any lost shuffle outputs they need) from lineage', 'Skips the lost partitions'], answer: 2, explain: 'Lineage says how each partition was built. Spark reruns the lost tasks; if shuffle files from the dead executor are gone, it reruns the parent stage tasks that produced them. Task retries are limited by <code>spark.task.maxFailures</code> (default 4).' }
  ],
  interview: [
    { q: 'What is lazy evaluation in Spark and why does it matter?', a: '<p>Transformations build a logical plan; nothing executes until an action. Benefits: Catalyst sees the whole pipeline (pushdown, pruning, join reordering, combining filters), Spark can pipeline narrow operations in one pass, and lineage provides fault tolerance. Costs: errors surface late, and each action replays the plan unless results are cached or written.</p>', lvl: 'core' },
    { q: 'Define job, stage and task.', a: '<ul><li><b>Job</b>: the work for one action.</li><li><b>Stage</b>: a set of tasks with no shuffle between them; stages are separated by wide dependencies (Exchanges).</li><li><b>Task</b>: one stage on one partition; the unit that runs on one core. Shuffle-map stages write shuffle files; the final (result) stage returns results or writes output.</li></ul>', lvl: 'core' },
    { q: 'What do the DAG scheduler and task scheduler do?', a: '<p>The <b>DAG scheduler</b> (driver) turns a job’s RDD graph into stages at shuffle boundaries, tracks which stage outputs exist, and submits stages whose parents are complete. The <b>task scheduler</b> launches each stage’s tasks on executors, with locality preferences, retries and speculation. Stages without dependency on each other can run in parallel.</p>', lvl: 'deep' },
    { q: 'Walk through Catalyst’s phases.', a: '<p>Analysis (resolve names with the catalog) → logical optimization (rule-based: predicate pushdown, column pruning, constant folding, simplifications; optional CBO for join order) → physical planning (choose operators, join strategies) → code generation (whole-stage codegen). AQE (3.0+, default on since 3.2) re-optimizes at runtime using real shuffle statistics. See <a href="spark-sql.html">Spark SQL</a>.</p>', lvl: 'deep' },
    { q: 'How do you read explain() output?', a: '<p>Bottom-up. <code>FileScan</code> with <code>PushedFilters</code>, <code>PartitionFilters</code> and the column list; <code>Exchange</code> = shuffle; <code>BroadcastExchange</code>; join nodes (<code>SortMergeJoin</code>, <code>BroadcastHashJoin</code>); <code>*(n)</code> prefixes mark whole-stage codegen. <code>AdaptiveSparkPlan isFinalPlan=false</code> means AQE will decide at runtime; see the SQL tab of the UI for the final plan.</p>', lvl: 'core' },
    { q: 'cache() vs checkpoint()?', a: '<p><code>cache()</code>/<code>persist()</code> store computed partitions in memory/disk but keep the lineage, so lost blocks can be recomputed. <code>checkpoint()</code> writes to reliable storage (checkpoint dir) and <b>truncates</b> lineage; it is eager by default and runs an extra job. <code>localCheckpoint()</code> truncates lineage using executor storage: faster, but not fault tolerant.</p>', lvl: 'deep' },
    { q: 'Why can show() be fast while count() is slow on the same DataFrame?', a: '<p><code>show(20)</code> is a limit: Spark scans a few partitions first and only scans more if it needs more rows (scaled by <code>spark.sql.limit.scaleUpFactor</code>). <code>count()</code> must process every partition. If the plan has a shuffle (groupBy, sort) before the limit, show is slow too.</p>', lvl: 'deep' },
    { q: 'How is this like Java Streams, and where does the analogy break?', a: '<p>Like Streams: intermediate operations are lazy and fused; a terminal operation runs the pipeline; you can’t reuse a consumed Stream, and in Spark each action re-runs the plan. Breaks: Spark optimizes the plan declaratively (reorders, pushes filters into files), splits it across machines with shuffles, and recovers from failures via lineage.</p>', lvl: 'core' },
    { q: 'What is a “skipped stage” in the Spark UI?', a: '<p>A stage whose output (shuffle files) already exists from an earlier job, so the scheduler doesn’t rerun it. It happens when a later job depends on the same shuffle, for example several actions on the same RDD lineage. It is not a failure.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Inspect before you run', lang: 'python', code: `from pyspark.sql import functions as F

rev = (spark.read.parquet("s3://lake/orders/")
         .filter(F.col("status") == "paid")
         .groupBy("city").agg(F.sum("amt").alias("rev"))
         .orderBy(F.desc("rev")))

rev.explain("formatted")   # no job yet: check PushedFilters, Exchanges
spark.sparkContext.setJobDescription("daily revenue by city")   # shows in the UI
rev.write.mode("overwrite").parquet("s3://out/rev/")            # the only action` , note: '<code>setJobDescription</code> (and <code>setJobGroup</code>) make it easy to find your job in a busy Spark UI.' },
    { title: 'Java: the same laziness', lang: 'java', code: `Dataset<Row> rev = spark.read().parquet("s3://lake/orders/")
    .filter(col("status").equalTo("paid"))
    .groupBy("city").agg(sum("amt").as("rev"));   // nothing runs

rev.explain("formatted");                          // plan only
long n = rev.count();                              // job 1
rev.write().mode("overwrite").parquet("s3://out/rev/");   // job 2, recomputes` },
    { title: 'Cutting lineage in a loop', lang: 'python', code: `spark.sparkContext.setCheckpointDir("s3://tmp/ckpt/")
ranks = initial
for i in range(30):
    ranks = step(ranks)            # join + agg each iteration
    if i % 5 == 4:
        ranks = ranks.checkpoint() # eager: writes, then truncates lineage` }
  ]
});

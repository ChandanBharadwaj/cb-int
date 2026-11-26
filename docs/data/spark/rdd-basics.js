IA.register({
  track: 'spark',
  slug: 'rdd-basics',
  title: 'RDD basics',
  tagline: 'An <b>RDD</b> is an immutable, partitioned collection plus the <b>recipe</b> (lineage) to rebuild it. <b>Transformations</b> extend the recipe lazily; <b>actions</b> finally cook it.',
  tldr: {
    problem: 'Newcomers write <code>rdd.map(...)</code>, see it return instantly, and think it ran. Or they call <code>count()</code> three times and wonder why the job reads the files three times.',
    model: 'Transformation = “add a step to the plan, return a new RDD” (<code>map</code>, <code>filter</code>, <code>flatMap</code>, <code>reduceByKey</code>). Action = “run the plan and give me a value” (<code>collect</code>, <code>count</code>, <code>take</code>, <code>saveAsTextFile</code>). Narrow steps pipeline; wide steps shuffle.',
    hook: '“Why prefer <code>reduceByKey</code> over <code>groupByKey</code>?” <code>reduceByKey</code> pre-combines values on each partition before the shuffle, so far less data crosses the network.',
    facts: [
      { v: 'Lazy', l: 'transformations return immediately; only an action submits a job' },
      { v: 'Narrow / wide', l: 'narrow (<code>map</code>, <code>filter</code>) = one parent partition; wide (<code>groupByKey</code>, <code>reduceByKey</code>, <code>join</code>) = shuffle + new stage' },
      { v: 'No Connect', l: 'the RDD API is not available through Spark Connect (3.4+); DataFrames are the recommended API' }
    ]
  },
  intro: {
    what: 'An <b>RDD</b> (Resilient Distributed Dataset) is Spark’s original building block: a big list of items, split into partitions that live on different machines. You never change an RDD; you create new ones from it. Spark remembers how each RDD was made, so it can rebuild lost pieces. Today you will mostly use DataFrames, which are built on top of this, but the ideas (laziness, partitions, shuffles) are the same.',
    analogy: { icon: '📜', title: 'A recipe, not a meal', text: 'Writing “chop onions, then fry them” on a card doesn’t make dinner. Transformations add lines to the recipe card. An action (“serve it”) is when someone actually cooks. If the plate drops, you can cook it again from the card: that’s lineage.' },
    steps: [
      { t: 'Create an RDD', d: 'From a Python list (for experiments) or from files.', code: 'sc = spark.sparkContext\nnums = sc.parallelize([1, 2, 3, 4, 5, 6], 3)   # 3 partitions\nlines = sc.textFile("logs/*.txt")' },
      { t: 'Transform (lazy)', d: 'Each transformation returns a new RDD instantly. Nothing has been computed.', code: 'squares = nums.map(lambda x: x * x)\nevens = squares.filter(lambda x: x % 2 == 0)' },
      { t: 'Act', d: 'An action runs the whole chain and returns a result to the driver.', code: 'evens.collect()   # [4, 16, 36]\nevens.count()     # 3  (runs the chain AGAIN)' },
      { t: 'Key-value pairs', d: 'RDDs of 2-tuples get extra operations such as <code>reduceByKey</code> and <code>join</code>, which shuffle data by key.', code: 'words = lines.flatMap(str.split)\ncounts = words.map(lambda w: (w, 1)).reduceByKey(lambda a, b: a + b)' },
      { t: 'Prefer DataFrames', d: 'RDD lambdas are opaque to the optimiser and, in Python, run in separate Python workers. Use RDDs only when you need low-level control.' }
    ],
    terms: [
      ['RDD', 'Resilient Distributed Dataset: immutable, partitioned, rebuildable from lineage.'],
      ['transformation', 'Lazily defines a new RDD from an existing one: map, filter, flatMap, reduceByKey, join…'],
      ['action', 'Triggers execution and returns a value or writes output: collect, count, take, reduce, foreach, saveAsTextFile.'],
      ['lineage', 'The chain of transformations that produced an RDD. Used to recompute lost partitions.'],
      ['shuffle', 'Redistributing data across partitions by key. Network + disk; creates a stage boundary.'],
      ['lambda', 'A Python anonymous function, like a Java lambda: <code>lambda x: x * 2</code> ≈ <code>x -&gt; x * 2</code>.']
    ]
  },
  visual: {
    title: 'Watch a word count build lineage, then run',
    caption: 'Press Step to add one transformation at a time (only the plan grows), then watch the action launch stage 1, the shuffle, and stage 2. The last step shows a lost partition being recomputed.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Sim: lazy pipeline', code: `# SIMULATION in plain Python (not Spark): a tiny lazy "RDD".
class MiniRDD:
    def __init__(self, parts, steps=()):
        self.parts, self.steps = parts, steps
    def map(self, f):    return MiniRDD(self.parts, self.steps + (("map", f),))
    def filter(self, f): return MiniRDD(self.parts, self.steps + (("filter", f),))
    def collect(self):                       # ACTION: run the recorded steps
        print("  >> job starts:", [s[0] for s in self.steps])
        out = []
        for p in self.parts:                 # one "task" per partition
            for x in p:
                keep = True
                for kind, f in self.steps:   # steps pipelined per element
                    if kind == "map": x = f(x)
                    elif not f(x): keep = False; break
                if keep: out.append(x)
        return out

def noisy_square(x):
    print("    computing", x)
    return x * x

rdd = MiniRDD([[1, 2, 3], [4, 5, 6]])
sq = rdd.map(noisy_square)
ev = sq.filter(lambda x: x % 2 == 0)
print("transformations defined, nothing computed yet")
print(ev.collect())
print(ev.collect())   # runs AGAIN: no cache`, note: 'Simulation of the idea, not Spark. Notice “computing” prints only after <code>collect()</code>, and twice in total because nothing was cached.' },
      { label: 'Sim: reduceByKey vs groupByKey', code: `# SIMULATION: how many records cross the "network" in a shuffle.
from collections import Counter, defaultdict
partitions = [["a", "b", "a", "a"], ["b", "a", "c", "a"], ["a", "a", "b", "c"]]

# groupByKey: every (word, 1) pair is shuffled
group_shuffled = sum(len(p) for p in partitions)

# reduceByKey: combine inside each partition first (map-side combine)
local = [Counter(p) for p in partitions]
reduce_shuffled = sum(len(c) for c in local)

final = defaultdict(int)
for c in local:
    for k, v in c.items():
        final[k] += v
print("groupByKey records shuffled :", group_shuffled)
print("reduceByKey records shuffled:", reduce_shuffled)
print("result:", dict(sorted(final.items())))`, note: 'Simulation. With skewed, repetitive keys the saving grows huge: one record per key per partition instead of one per row.' }
    ]
  },
  gotchas: [
    { trap: 'Thinking a transformation ran', code: `rdd2 = rdd.map(parse)      # returns instantly
# a parse bug only shows up here, much later:
rdd2.count()`, why: 'Transformations are lazy. Errors inside your lambda surface only when an action runs, often in a stack trace pointing at the action line.', fix: 'Test functions on a small sample (<code>rdd.take(5)</code>) and unit-test them as plain Python functions.' },
    { trap: 'Recomputing the lineage for every action', code: `clean = raw.map(parse).filter(valid)
clean.count()     # reads + parses everything
clean.take(10)    # reads + parses again (at least partly)`, why: 'Each action runs its own job from the source. RDDs are not stored unless you persist them.', fix: '<code>clean.cache()</code> (or <code>persist(StorageLevel…)</code>) when you reuse an RDD in several actions, and <code>unpersist()</code> when done.' },
    { trap: '<code>groupByKey</code> for aggregation', code: `pairs.groupByKey().mapValues(sum)     # ships every value
pairs.reduceByKey(lambda a, b: a + b)  # combines first`, why: '<code>groupByKey</code> sends all values for a key across the network and builds the full list in one executor, which can OOM on hot keys.', fix: 'Use <code>reduceByKey</code>, <code>aggregateByKey</code> or <code>combineByKey</code>, or a DataFrame <code>groupBy().agg()</code>.' },
    { trap: 'Mutating a driver variable inside a lambda', code: `total = 0
def add(x):
    global total
    total += x
rdd.foreach(add)
print(total)   # 0 on a cluster`, why: 'The function is serialised and run on executors, each with its own copy of <code>total</code>. The driver’s variable never changes (in local mode the result is also not something to rely on).', fix: 'Use an action that returns a value (<code>rdd.sum()</code>, <code>reduce</code>), or an accumulator for counters/metrics.' },
    { trap: '<code>collect()</code> to “just look”', why: 'It returns every element to the driver.', fix: 'Use <code>take(n)</code>, <code>first()</code> or <code>takeSample</code>.' },
    { trap: 'Using RDDs where a DataFrame would do', why: 'Python lambdas force data out of the JVM into Python workers (serialisation per row), and Catalyst cannot optimise opaque functions. RDDs are also unavailable on Spark Connect / many serverless platforms.', fix: 'Default to DataFrames and built-in functions. Drop to <code>df.rdd</code> only for things the DataFrame API can’t express.' }
  ],
  scenarios: [
    { title: 'The job that read S3 four times', symptom: 'An RDD pipeline that parses 500 GB of logs takes 4× longer than expected; S3 request costs spike.', diagnose: 'Spark UI → Jobs: 4 jobs, each starting with a stage "textFile at …"\ncode: parsed.count(); parsed.filter(...).count(); parsed.take(20); parsed.saveAsTextFile(...)', cause: 'Four actions on an unpersisted RDD: each re-ran the read and parse from the source.', fix: 'Persist the parsed RDD once (memory and disk), run the actions, then unpersist. Even better, port to DataFrames and write once.', fixCode: `from pyspark import StorageLevel
parsed = sc.textFile("s3://logs/2026/11/*").map(parse).persist(StorageLevel.MEMORY_AND_DISK)
n = parsed.count()
errors = parsed.filter(lambda r: r.level == "ERROR").count()
parsed.saveAsTextFile("s3://out/parsed/")
parsed.unpersist()` },
    { title: 'Executor OOM on a hot key', symptom: 'A sessionisation job fails with executor <code>OutOfMemoryError</code> in a stage after a shuffle; one task runs 30 minutes while others take seconds.', diagnose: 'Spark UI → Stage: max task duration 31 min, median 4 s\nShuffle read: one task 18 GB, others ~50 MB\nkey "anonymous" has 40% of all events', cause: '<code>groupByKey</code> collected all values of the skewed key into one in-memory iterable on one executor.', fix: 'Aggregate with <code>reduceByKey</code>/<code>aggregateByKey</code> so values are combined per partition, filter or salt the hot key, or switch to DataFrames where AQE can split skewed partitions in joins.', fixCode: `# before
sessions = events.map(lambda e: (e.user, e)).groupByKey().mapValues(build)
# after: aggregate incrementally
stats = (events.map(lambda e: (e.user, (1, e.ts, e.ts)))
               .reduceByKey(lambda a, b: (a[0]+b[0], min(a[1], b[1]), max(a[2], b[2]))))` }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which of these is an <b>action</b>?', options: ['map', 'filter', 'reduceByKey', 'count'], answer: 3, explain: '<code>count</code> returns a number to the driver, so it must run a job. The others return a new RDD lazily (<code>reduceByKey</code> is a transformation despite the name).' },
    { kind: 'concept', q: 'You run <code>rdd2 = rdd.map(f)</code> where <code>f</code> raises an exception for some rows. When do you see the error?', options: ['Immediately on the map line', 'When an action that needs those rows runs', 'Never; Spark skips bad rows', 'At SparkSession creation'], answer: 1, explain: 'Laziness: <code>map</code> only records the step. The exception is raised inside a task when an action evaluates the bad element (and the task is retried before the job fails).' },
    { kind: 'concept', q: 'Which transformation creates a <b>wide</b> dependency (a shuffle)?', options: ['map', 'filter', 'flatMap', 'reduceByKey'], answer: 3, explain: 'All values of a key must meet in one partition, so data is redistributed. map, filter and flatMap each depend on just one parent partition.' },
    { kind: 'concept', q: 'Why is <code>reduceByKey</code> usually faster than <code>groupByKey().mapValues(sum)</code>?', options: ['It uses a GPU', 'It combines values within each partition before the shuffle, so less data moves', 'It skips the shuffle completely', 'It sorts the data first'], answer: 1, explain: 'Map-side combining sends at most one record per key per partition across the network, instead of one per original row.' },
    { kind: 'concept', q: 'An RDD is used by three actions and is not cached. How many times is its lineage computed?', options: ['Once', 'Up to three times (once per action)', 'Never', 'It depends on the number of executors'], answer: 1, explain: 'Each action launches its own job from the source. (Spark may reuse shuffle files from an earlier job, which skips some stages, but the narrow steps are recomputed.) Cache it if you reuse it.' },
    { kind: 'concept', q: '<code>sc.parallelize(range(10), 4)</code>: what does the 4 control?', options: ['Number of executors', 'Number of partitions, and so tasks per stage', 'Number of retries', 'Replication factor'], answer: 1, explain: 'It sets <code>numSlices</code>: the data is cut into 4 partitions, so stages on this RDD run 4 tasks.' },
    { kind: 'concept', q: 'How does an RDD survive the loss of an executor holding some of its partitions?', options: ['Spark keeps 3 replicas of every partition', 'Spark recomputes the lost partitions from lineage', 'It doesn’t; the job fails', 'The driver keeps a full copy'], answer: 1, explain: '“Resilient” comes from lineage: Spark knows how each partition was derived and re-runs just those tasks. Replication happens only if you pick a <code>_2</code> storage level.' }
  ],
  interview: [
    { q: 'What is an RDD?', a: '<p>A Resilient Distributed Dataset: an immutable, partitioned collection of records, with its lineage (parent RDDs and the function to compute each partition), optional partitioner and preferred locations. It is Spark’s low-level abstraction; DataFrames compile down to RDD-like execution.</p>', lvl: 'core' },
    { q: 'Transformations vs actions?', a: '<p>Transformations (<code>map</code>, <code>filter</code>, <code>flatMap</code>, <code>join</code>, <code>reduceByKey</code>) return a new RDD lazily. Actions (<code>collect</code>, <code>count</code>, <code>take</code>, <code>reduce</code>, <code>foreach</code>, <code>save*</code>) trigger a job and return a value or write output.</p>', lvl: 'core' },
    { q: 'Why is Spark lazy?', a: '<p>Seeing the whole chain lets Spark pipeline narrow operations into one pass per partition, avoid materialising intermediates, and (for DataFrames) optimise the plan. It also means nothing is computed that no action needs.</p>', lvl: 'core' },
    { q: 'Narrow vs wide dependencies, and why they matter.', a: '<p>Narrow: each child partition depends on a bounded set of parent partitions (often one), so steps can be pipelined in one task and recovery is cheap. Wide: a child partition depends on many parents (shuffle). Wide dependencies split stages, cost network and disk I/O, and make recovery more expensive.</p>', lvl: 'core' },
    { q: 'groupByKey vs reduceByKey vs aggregateByKey?', a: '<ul><li><code>groupByKey</code>: shuffles all values, builds an iterable per key. Memory-hungry on hot keys.</li><li><code>reduceByKey</code>: associative combine function, map-side combine.</li><li><code>aggregateByKey</code>: like reduceByKey but with a zero value and separate within/between-partition functions, so the result type can differ from the value type.</li></ul>', lvl: 'deep' },
    { q: 'When would you still use RDDs today?', a: '<p>Rarely: processing truly unstructured records with custom logic, fine control of partitioning (<code>partitionBy</code> with a custom partitioner), or legacy code. Most needs are covered by DataFrames plus built-in functions or pandas UDFs, which are faster in Python and work on Spark Connect.</p>', lvl: 'core' },
    { q: 'What are accumulators and broadcast variables?', a: '<p><b>Accumulators</b>: write-only (from tasks) shared counters that the driver can read; updates in transformations may be applied more than once if tasks are retried, so only actions give exactly-once updates. <b>Broadcast variables</b>: read-only values shipped once per executor (not per task), e.g. a lookup dict.</p>', lvl: 'deep' },
    { q: 'How do Python RDD operations actually execute?', a: '<p>Executors (JVM) start Python worker processes. Partitions are serialised (pickled) to Python, your lambda runs, results are pickled back. This per-row serialisation is why Python RDD code is much slower than DataFrame code, which stays in the JVM.</p>', lvl: 'deep' },
    { q: 'What does <code>mapPartitions</code> give you over <code>map</code>?', a: '<p>Your function receives an iterator over a whole partition, so you can do expensive set-up once per partition (open an HTTP client, load a model) rather than once per element. Return an iterator to stay streaming.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Word count (PySpark RDD)', lang: 'python', code: `from pyspark.sql import SparkSession
spark = SparkSession.builder.master("local[*]").appName("wc").getOrCreate()
sc = spark.sparkContext

counts = (sc.textFile("README.md")
            .flatMap(lambda line: line.lower().split())
            .map(lambda w: (w, 1))
            .reduceByKey(lambda a, b: a + b))

for word, n in counts.takeOrdered(5, key=lambda kv: -kv[1]):
    print(word, n)` },
    { title: 'Word count (Java RDD API)', lang: 'java', code: `JavaSparkContext jsc = new JavaSparkContext(spark.sparkContext());
JavaPairRDD<String, Integer> counts = jsc.textFile("README.md")
    .flatMap(l -> Arrays.asList(l.toLowerCase().split("\\\\s+")).iterator())
    .mapToPair(w -> new Tuple2<>(w, 1))
    .reduceByKey(Integer::sum);
counts.take(5).forEach(System.out::println);`, note: 'Java lambdas run inside the executor JVM directly, so there is no Python serialisation cost.' },
    { title: 'Same thing with DataFrames (preferred)', lang: 'python', code: `from pyspark.sql import functions as F
(spark.read.text("README.md")
      .select(F.explode(F.split(F.lower("value"), r"\\s+")).alias("word"))
      .where(F.col("word") != "")
      .groupBy("word").count()
      .orderBy(F.desc("count"))
      .show(5))` },
    { title: 'Per-partition set-up with mapPartitions', lang: 'python', code: `def enrich(rows):
    client = make_http_client()          # once per partition, on the executor
    for r in rows:
        yield (r, client.lookup(r))
    client.close()

enriched = ids_rdd.mapPartitions(enrich)` }
  ]
});

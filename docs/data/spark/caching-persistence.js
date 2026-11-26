IA.register({
  track: 'spark',
  slug: 'caching-persistence',
  title: 'Caching & persistence',
  tagline: 'A DataFrame is a <b>recipe</b>, not a result. Every action re-runs the whole recipe from the source files, unless you <b>cache</b> it. Caching is a trade: memory and disk now, for skipping recomputation later. Done blindly, it makes jobs slower.',
  tldr: {
    problem: 'Java developers expect <code>var df = …</code> to hold data, like a <code>List</code>. In Spark it holds a plan. Use the same DataFrame in three actions and Spark reads and transforms the source three times.',
    model: '<code>cache()</code>/<code>persist()</code> marks the plan; the <b>first action</b> fills the cache, partition by partition, on the executors. Later plans that contain the same sub-plan read the cached blocks. <code>unpersist()</code> frees them.',
    hook: '“I called <code>df.cache()</code> but the job didn’t get faster.” Cache is lazy, the result was used only once, or the cached data didn’t fit and kept being evicted.',
    facts: [
      { v: 'MEMORY_AND_DISK', l: 'default level for <code>DataFrame.cache()</code> (PySpark 3.0+ reports it as <code>MEMORY_AND_DISK_DESER</code>). <code>RDD.cache()</code> is <code>MEMORY_ONLY</code>' },
      { v: 'lazy', l: '<code>cache()</code> does nothing until an action runs. SQL <code>CACHE TABLE</code> is eager unless you write <code>CACHE LAZY TABLE</code>' },
      { v: 'LRU', l: 'cached blocks are evicted least-recently-used when executors need storage memory; evicted <code>MEMORY_ONLY</code> blocks are recomputed from lineage' }
    ]
  },
  intro: {
    what: 'Spark builds a <b>plan</b> for each DataFrame and only runs it when you ask for a result (an <b>action</b> like <code>count()</code>, <code>show()</code> or <code>write</code>). If two actions use the same DataFrame, Spark runs its plan twice. <b>Caching</b> tells Spark: the first time you compute this, keep the result on the executors so later actions can reuse it.',
    analogy: { icon: '🍲', title: 'A recipe vs a pot of soup', text: 'A DataFrame is a recipe card. Each time someone wants soup (an action), the kitchen cooks from scratch. Caching says: cook one big pot and keep it in the fridge (memory), or the freezer (disk) if the fridge is full. Great if many people want soup today. A waste of fridge space if only one does.' },
    steps: [
      { t: 'Build the expensive DataFrame', d: 'Read, filter, join. Nothing runs yet.', code: 'clean = raw.filter("valid").join(dim, "k")' },
      { t: 'Mark it for caching', d: 'Lazy: this only records the wish.', code: 'clean.cache()   # same as clean.persist()' },
      { t: 'The first action fills it', d: 'Use an action that touches every partition, so the whole thing is cached.', code: 'clean.count()' },
      { t: 'Reuse it', d: 'These read cached blocks instead of the source.', code: 'clean.groupBy("country").count().show()\nclean.write.parquet("out/")' },
      { t: 'Free it', d: 'When you are done, release the memory.', code: 'clean.unpersist()' }
    ],
    terms: [
      ['action', 'An operation that returns a result or writes data, and so triggers a job: count, collect, show, write.'],
      ['lineage', 'The chain of transformations that produce a DataFrame. Spark can recompute lost data from it.'],
      ['storage level', 'Where and how cached blocks live: memory, disk, serialized or not, replicated or not.'],
      ['block', 'One cached partition, stored by the executor’s BlockManager.'],
      ['checkpoint', 'Writes data to reliable storage and cuts the lineage, unlike cache.']
    ]
  },
  visual: {
    title: 'Recompute vs cache',
    caption: 'Choose <b>No cache</b>, <b>cache()</b> or <b>cache + evict</b>, then Play. Three actions use the same DataFrame. Watch how many times the scan → filter → join pipeline runs, and what happens when memory runs out.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Simulation: lazy plans recompute', code: `# SIMULATION in plain Python: a "DataFrame" that is only a recipe.
runs = {"scan": 0}

class LazyFrame:
    def __init__(self, fn): self.fn, self._cache, self._want = fn, None, False
    def cache(self): self._want = True; return self      # lazy: no work here
    def collect(self):
        if self._cache is not None: return self._cache
        data = self.fn()
        if self._want: self._cache = data                 # filled by the first action
        return data

def expensive():
    runs["scan"] += 1
    return [x * 2 for x in range(5)]

df = LazyFrame(expensive)
df.collect(); df.collect(); print("no cache, scans:", runs["scan"])
runs["scan"] = 0
df2 = LazyFrame(expensive).cache()
print("after cache(), scans:", runs["scan"])
df2.collect(); df2.collect(); df2.collect(); print("cached, scans:", runs["scan"])` }
    ]
  },
  gotchas: [
    { trap: 'Expecting cache() to do work', code: `df.cache()          # nothing happens
df.show()           # caches only the partitions show() needed (often 1)`, why: '<code>cache()</code> is lazy. <code>show()</code>/<code>take()</code>/<code>first()</code> compute only enough partitions for their rows, so most of the cache is still empty.', fix: 'Materialise with an action that reads every partition, usually <code>df.count()</code>, or use SQL <code>CACHE TABLE t</code> (eager).' },
    { trap: 'Caching something used once', why: 'Writing blocks to memory (and disk) costs time and evicts other data. If the DataFrame feeds one action, you pay that cost for nothing.', fix: 'Cache only when a DataFrame feeds two or more actions, or an iterative loop (ML, graph algorithms), and recomputing it is expensive.' },
    { trap: 'Forgetting to unpersist in long-lived apps', why: 'Notebooks and streaming <code>foreachBatch</code> loops cache new DataFrames repeatedly. Old blocks are only evicted under pressure, crowding out execution memory and causing spills.', fix: '<code>df.unpersist()</code> when done; <code>spark.catalog.clearCache()</code> in notebooks. Check the <b>Storage</b> tab in the Spark UI.' },
    { trap: 'Caching the raw input instead of the reduced data', code: `raw = spark.read.parquet("events/")   # 2 TB
raw.cache()                             # will mostly spill to disk`, why: 'Parquet is compressed and column-pruned on read. A cache of the full rows can be many times larger and lose column pruning and predicate pushdown.', fix: 'Select the columns and filter rows first, then cache the small result.' },
    { trap: 'Stale cache after the source changes', why: 'The cache is keyed by the logical plan, not by file contents. If another job overwrites the files, your cached DataFrame keeps returning old data (and an uncached re-read may fail with FileNotFound until you refresh).', fix: '<code>spark.catalog.refreshTable("t")</code> or <code>REFRESH TABLE</code>, or unpersist and re-read. Delta tables track versions, which avoids most of this.' },
    { trap: 'Using cache to cut lineage', why: 'Cache keeps the lineage. If an executor dies, lost blocks are recomputed from the start. Iterative jobs with 100s of steps can grow plans so large that the driver spends minutes planning.', fix: 'Use <code>df.checkpoint()</code> (reliable, needs <code>setCheckpointDir</code>) or <code>localCheckpoint()</code> (faster, not fault tolerant) to truncate the plan.' }
  ],
  scenarios: [
    { title: 'Daily report re-reads 800 GB four times',
      symptom: 'A job reads <code>events</code>, cleans them, then writes four different aggregates. The Spark UI shows four jobs, each starting with the same 800 GB scan.',
      diagnose: `# SQL tab: every job has a FileScan parquet events with the same filters`,
      cause: 'No caching. Each <code>write</code> is an action, and each re-runs the full lineage.',
      fix: 'Cache the cleaned, column-pruned DataFrame and materialise it once. Unpersist at the end.',
      fixCode: `clean = (spark.read.parquet("events/")
         .select("user_id", "country", "ts", "amount")
         .filter("amount > 0")
         .persist(StorageLevel.MEMORY_AND_DISK))
clean.count()
for name, agg in reports.items():
    agg(clean).write.mode("overwrite").parquet(f"out/{name}")
clean.unpersist()` },
    { title: 'Executors keep spilling after “adding cache everywhere”',
      symptom: 'Shuffle-heavy stages got slower and show large <i>Spill (disk)</i> after a refactor added <code>.cache()</code> after every transformation.',
      cause: 'Unified memory is shared. Storage (cache) can borrow execution memory and is only evicted down to <code>spark.memory.storageFraction</code>. With many large caches, sorts and hash aggregations get less memory and spill.',
      fix: 'Remove caches that are used once. Keep one or two at the points of real reuse, and unpersist them as soon as possible.',
      fixCode: `# Storage tab shows what is cached and how much is on disk
print(df.storageLevel, df.is_cached)
spark.catalog.clearCache()   # drop all leftovers in a notebook / long-lived session
` }
  ],
  puzzles: [
    { kind: 'concept', q: 'How many times is <code>events/</code> read?', code: `df = spark.read.parquet("events/").filter("x > 0")\ndf.cache()\nprint(df.count())\nprint(df.count())`, options: ['0', '1', '2', '3'], answer: 1, explain: '<b>1</b>: the first count fills the cache while it scans, the second reads cached blocks. (If blocks were evicted under memory pressure, the missing partitions would be recomputed, but MEMORY_AND_DISK spills to disk first.)' },
    { kind: 'concept', q: 'Which storage level does <code>rdd.cache()</code> use?', options: ['MEMORY_ONLY', 'MEMORY_AND_DISK', 'DISK_ONLY', 'MEMORY_ONLY_SER'], answer: 0, explain: 'For RDDs, <code>cache()</code> = <code>persist(MEMORY_ONLY)</code>. For DataFrames/Datasets the default is MEMORY_AND_DISK (stored in a compressed columnar format).' },
    { kind: 'concept', q: 'After <code>df.cache()</code>, which call fills the cache for <i>all</i> partitions?', options: ['<code>df.show()</code>', '<code>df.take(1)</code>', '<code>df.count()</code>', '<code>df.explain()</code>'], answer: 2, explain: '<code>count()</code> must touch every partition. show/take stop once they have enough rows. explain() runs nothing.' },
    { kind: 'concept', q: 'What does <code>MEMORY_AND_DISK_2</code> add over <code>MEMORY_AND_DISK</code>?', options: ['Twice the memory fraction', 'Each block is replicated on two executors', 'Two levels of compression', 'Blocks are written to HDFS'], answer: 1, explain: 'The <code>_2</code> suffix replicates each partition on two nodes, so losing one executor doesn’t force recomputation. It doubles the storage cost.' },
    { kind: 'concept', q: 'You need to cut a 300-step lineage in an iterative job and survive executor loss. Best tool?', options: ['<code>cache()</code>', '<code>persist(DISK_ONLY)</code>', '<code>checkpoint()</code> with a checkpoint dir on reliable storage', '<code>localCheckpoint()</code>'], answer: 2, explain: 'Only <code>checkpoint()</code> both truncates lineage and stores data on reliable storage. <code>localCheckpoint()</code> truncates but keeps data on executors, so losing one loses data with no lineage to recompute.' },
    { kind: 'concept', q: 'You cached <code>df</code>, then run <code>df.filter("y = 1").count()</code>. Does it use the cache?', options: ['No, it is a different DataFrame', 'Yes: the cache manager matches the cached sub-plan inside the new plan', 'Only if you cache the filtered one too', 'Only in SQL'], answer: 1, explain: 'Spark’s CacheManager replaces any sub-plan that matches a cached plan with an <code>InMemoryRelation</code>. Look for <code>InMemoryTableScan</code> in <code>explain()</code>.' }
  ],
  interview: [
    { q: 'cache() vs persist()?', a: '<p><code>cache()</code> is <code>persist()</code> with the default level. <code>persist(level)</code> lets you choose: MEMORY_ONLY, MEMORY_AND_DISK, DISK_ONLY, OFF_HEAP, and <code>_2</code> replicated variants. Defaults differ: RDD MEMORY_ONLY, DataFrame MEMORY_AND_DISK.</p>', lvl: 'core' },
    { q: 'When should you cache?', a: '<ul><li>A DataFrame used by 2+ actions, and expensive to recompute.</li><li>Iterative algorithms that scan the same data repeatedly.</li><li>Interactive exploration of a filtered subset.</li></ul><p>Not when used once, not when larger than cluster memory without a plan, and not as a lineage cutter.</p>', lvl: 'core' },
    { q: 'How are cached DataFrames stored?', a: '<p>In a compressed <b>columnar</b> in-memory format (Spark SQL’s in-memory columnar cache), built per partition as cached batches. That’s why cached DataFrames are usually much smaller than cached RDDs of Java objects, and why column pruning still helps on reads from the cache.</p>', lvl: 'deep' },
    { q: 'What happens when the cache doesn’t fit?', a: '<p>Blocks are evicted LRU when storage needs room (storage can be evicted down to <code>spark.memory.storageFraction</code> of unified memory by execution). With MEMORY_ONLY, evicted or never-stored partitions are recomputed on access. With MEMORY_AND_DISK they are written to local disk and read back.</p>', lvl: 'deep' },
    { q: 'cache vs checkpoint?', a: '<p>Cache keeps lineage and stores on executors; it is fast but lost blocks are recomputed. <code>checkpoint()</code> writes to reliable storage (HDFS/S3/ADLS) and replaces the plan with a scan of those files: slower to create, but lineage is cut and it survives executor loss. Eager by default in the DataFrame API.</p>', lvl: 'core' },
    { q: 'How do you check what’s cached?', a: '<p>The Spark UI <b>Storage</b> tab: each cached RDD/DataFrame, fraction cached, size in memory and on disk. In code: <code>df.storageLevel</code>, <code>df.is_cached</code>, <code>spark.catalog.isCached("t")</code>. In plans, <code>InMemoryTableScan</code>.</p>', lvl: 'core' },
    { q: 'Is caching a DataFrame like a Redis cache in a Spring app?', a: '<p>Only loosely. It is scoped to one SparkSession/application, lives in executor memory, has no TTL, and is invalidated only explicitly or when you change the plan. It is closer to memoising an expensive intermediate result inside one batch job.</p>', lvl: 'core' },
    { q: 'Does caching interact with AQE or broadcast?', a: '<p>Yes. A cached relation has accurate size statistics once materialised, so it can become a broadcast candidate. Also, a cached DataFrame’s partitioning is fixed at cache time: later repartitions are still needed if the next step wants a different distribution.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Cache, use, release', lang: 'python', code: `from pyspark import StorageLevel

features = (spark.table("events")
            .select("user_id", "ts", "amount")
            .filter("ts >= current_date() - INTERVAL 30 DAYS")
            .persist(StorageLevel.MEMORY_AND_DISK))
features.count()                 # materialise every partition

daily = features.groupBy(F.to_date("ts").alias("d")).sum("amount")
top = features.groupBy("user_id").sum("amount").orderBy(F.desc("sum(amount)")).limit(100)
daily.write.mode("overwrite").saveAsTable("rpt_daily")
top.write.mode("overwrite").saveAsTable("rpt_top_users")

features.unpersist()` },
    { title: 'SQL caching and lineage cut', lang: 'python', code: `spark.sql("CACHE TABLE recent AS SELECT * FROM events WHERE ts > now() - INTERVAL 1 DAY")  # eager
spark.sql("CACHE LAZY TABLE dims")      # filled on first use
spark.sql("UNCACHE TABLE recent")

spark.sparkContext.setCheckpointDir("abfss://tmp@acct.dfs.core.windows.net/ckpt")
df = df.checkpoint()                    # eager by default; plan now starts from the checkpoint files` }
  ]
});

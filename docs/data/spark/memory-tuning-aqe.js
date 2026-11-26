IA.register({
  track: 'spark',
  slug: 'memory-tuning-aqe',
  title: 'Memory, tuning & AQE',
  tagline: 'An executor is a JVM with a <b>split budget</b>: a slice for your code, a shared pool for shuffles and cache, and memory <i>outside</i> the heap that the container also counts. Know the split, read the spill metrics, and let <b>AQE</b> fix partition sizes at runtime before you touch twenty config knobs.',
  tldr: {
    problem: 'Spark failures look like JVM failures (<code>OutOfMemoryError</code>, long GC) or like container kills (“exceeding memory limits”, exit code 137). The fix differs: one is the heap, the other is overhead outside the heap.',
    model: 'Container = <b>heap</b> (<code>spark.executor.memory</code>) + <b>overhead</b> (off-heap, Python workers, netty buffers). Inside the heap: 300 MB reserved, then <b>unified memory</b> = 60% of the rest, shared by execution (shuffles, joins, sorts) and storage (cache). When execution runs out, it <b>spills</b> to disk.',
    hook: '“Why does my job spill 400 GB when executors have 32 GB each?” Usually too few shuffle partitions for the data size. AQE coalescing can’t <i>raise</i> the count, so set the initial number high and let AQE shrink it.',
    facts: [
      { v: '0.6 / 0.5', l: '<code>spark.memory.fraction</code> (share of heap − 300 MB for unified memory) and <code>spark.memory.storageFraction</code> (storage’s protected half)' },
      { v: 'max(384 MB, 10%)', l: 'default <code>spark.executor.memoryOverhead</code> on YARN and Kubernetes' },
      { v: '64 MB', l: '<code>spark.sql.adaptive.advisoryPartitionSizeInBytes</code>: AQE’s target size when coalescing shuffle partitions' }
    ]
  },
  intro: {
    what: 'Each <b>executor</b> is a Java process (JVM) that runs tasks on its cores. Its memory is split into areas with different jobs. Your data passes through <b>execution memory</b> during shuffles, joins and sorts; cached DataFrames live in <b>storage memory</b>. When a task needs more execution memory than it can get, Spark writes part of the data to local disk (<b>spill</b>) and reads it back later: slower, but it doesn’t crash. <b>AQE</b> (Adaptive Query Execution) re-plans the query between stages using real data sizes.',
    analogy: { icon: '🏗️', title: 'A shared workbench', text: 'An executor is a workshop. The bench (unified memory) is shared between work in progress (execution) and finished parts kept for later (storage). Work can push stored parts off the bench, but only down to a reserved shelf. When the bench is still too small, parts go to the floor (disk spill). The building also needs corridors and power that aren’t bench space (overhead).' },
    steps: [
      { t: 'Size the executor', d: 'Typical: 4–5 cores and enough heap for 4–5 concurrent tasks. Very large heaps mean long GC pauses.', code: '--executor-cores 5 --executor-memory 20g' },
      { t: 'Know what you get', d: 'Unified memory ≈ (20 GB − 300 MB) × 0.6 ≈ 11.8 GB shared by 5 tasks. The container asks for 20 GB + 2 GB overhead.' },
      { t: 'Read the stage metrics', d: 'In the Spark UI stage page: <i>Spill (memory)</i>, <i>Spill (disk)</i>, GC time, shuffle read size per task (min / median / max).' },
      { t: 'Let AQE tune partitions', d: 'On by default since Spark 3.2: coalesces small partitions, switches joins to broadcast, splits skew.', code: 'spark.sql.adaptive.enabled=true' },
      { t: 'Then adjust a few knobs', d: '<code>spark.sql.shuffle.partitions</code>, executor memory/cores, overhead. Change one at a time and measure.' }
    ],
    terms: [
      ['heap', 'Memory the JVM manages and garbage-collects: <code>spark.executor.memory</code>.'],
      ['memory overhead', 'Container memory outside the heap: JVM internals, netty buffers, Python workers (unless set separately).'],
      ['execution memory', 'Used by shuffles, joins, sorts and aggregations while a task runs.'],
      ['storage memory', 'Holds cached data and broadcast variables.'],
      ['spill', 'Writing in-progress data to local disk because execution memory is full.'],
      ['AQE', 'Re-optimises a running query at stage boundaries, using real shuffle statistics.']
    ]
  },
  visual: {
    title: 'Inside an executor’s memory',
    caption: 'Drag <b>executor memory</b> to see the split, then press <b>Play</b> or <b>Step</b> to watch execution borrow from storage, evict cached blocks, and finally spill. The numbers use Spark’s default fractions.'
  },
  extras: [
    { id: 'memory-tuning-aqe-aqe', title: 'AQE coalescing shuffle partitions', label: 'AQE', caption: 'Press <b>Step</b>. 200 shuffle partitions of uneven size are merged into fewer tasks of about 64 MB each, after the map stage has measured them.' }
  ],
  playground: {
    kind: 'python',
    presets: [
      { label: 'Calculator: executor memory split', code: `# CALCULATOR (plain Python): Spark's unified memory model, default fractions.
def executor_memory(heap_gb, cores, fraction=0.6, storage_fraction=0.5, overhead_factor=0.10):
    reserved = 0.3                                  # 300 MB, fixed
    usable = heap_gb - reserved
    unified = usable * fraction
    user = usable * (1 - fraction)
    overhead = max(0.384, heap_gb * overhead_factor)
    print(f"heap {heap_gb} GB  -> container request ~{heap_gb + overhead:.1f} GB (overhead {overhead:.2f})")
    print(f"  unified {unified:.2f} GB (storage protected {unified*storage_fraction:.2f})")
    print(f"  user memory {user:.2f} GB, reserved 0.3 GB")
    print(f"  per task (all {cores} cores busy): up to ~{unified/cores:.2f} GB execution")

executor_memory(8, 4)
executor_memory(20, 5)` },
      { label: 'Calculator: how many shuffle partitions?', code: `# Rule of thumb: aim for ~100-200 MB of shuffle data per partition,
# and at least 2-3x the total core count.
def shuffle_partitions(shuffle_gb, total_cores, target_mb=128):
    by_size = int(shuffle_gb * 1024 / target_mb)
    return max(by_size, total_cores * 3)

for gb in (5, 200, 2000):
    print(gb, "GB shuffle ->", shuffle_partitions(gb, total_cores=100), "partitions")`, note: 'A rule of thumb, not a Spark formula. With AQE on, set a generous initial number and let coalescing shrink it.' }
    ]
  },
  gotchas: [
    { trap: 'Raising the heap when the container is killed', why: '“Container killed … exceeding memory limits” (YARN) or OOMKilled / exit 137 (Kubernetes) means total process memory went over heap + overhead. More heap makes the container bigger but often leaves overhead too small. PySpark workers, Arrow buffers and native libraries live outside the heap.', fix: 'Raise <code>spark.executor.memoryOverhead</code> (or set <code>spark.executor.pyspark.memory</code> for Python workers). Raise the heap only for Java <code>OutOfMemoryError</code>.' },
    { trap: 'Huge executors', code: `--executor-memory 120g --executor-cores 30`, why: 'One JVM with a huge heap has long GC pauses, and 30 concurrent tasks share it unpredictably. HDFS/S3 client throughput per JVM can also bottleneck.', fix: 'Prefer several medium executors (commonly 4–5 cores, 16–32 GB). Measure GC time in the Executors tab; aim for well under 10% of task time.' },
    { trap: 'Leaving shuffle partitions at 200 for a 2 TB shuffle', why: '2 TB / 200 = 10 GB per task. That spills heavily or fails. AQE coalescing only <i>merges</i> partitions; it never splits a normal one into more.', fix: 'Set <code>spark.sql.shuffle.partitions</code> high enough for ~100–200 MB per partition (or set <code>spark.sql.adaptive.coalescePartitions.initialPartitionNum</code>) and let AQE coalesce down.' },
    { trap: 'collect() and toPandas() on big results', code: `rows = df.collect()   # driver OOM`, why: 'They bring every row to the driver JVM (and then Python). The driver has a single heap and <code>spark.driver.maxResultSize</code> (1g default) guards it.', fix: 'Write results to storage, or <code>limit()</code> first. For pandas, enable Arrow (<code>spark.sql.execution.arrow.pyspark.enabled</code>) and only convert small data.' },
    { trap: 'Turning AQE off “for predictability”', why: 'You lose partition coalescing, runtime broadcast conversion and skew-join splitting. Most jobs get slower and more fragile on uneven data.', fix: 'Keep it on (default since 3.2). If a specific feature misbehaves, disable that one, e.g. <code>spark.sql.adaptive.skewJoin.enabled</code>.' },
    { trap: 'Tuning before looking', why: 'Copy-pasted configs (<code>spark.memory.fraction=0.8</code>, huge <code>maxPartitionBytes</code>) can make things worse. Most slowness is data layout: skew, too many small files, a missing filter, a Python UDF.', fix: 'Open the Spark UI first: the slowest stage, its task-time distribution, spill and GC. Then change one knob.' }
  ],
  scenarios: [
    { title: 'Executors killed with exit code 137 on Kubernetes',
      symptom: 'A PySpark job with pandas UDFs loses executors with <code>OOMKilled</code>. No Java OutOfMemoryError in the logs. Someone raised <code>spark.executor.memory</code> from 8g to 16g; it still fails.',
      diagnose: `kubectl describe pod spark-exec-12   # Last State: Terminated, Reason: OOMKilled
# Python workers' RSS is outside the JVM heap`,
      cause: 'Pandas UDFs run in Python worker processes and Arrow batches are allocated off-heap. That memory counts against the pod limit but not the heap. Overhead was the default 10% (1.6 GB for 16 GB).',
      fix: 'Give Python its own budget and raise overhead; reduce Arrow batch size if batches are huge.',
      fixCode: `spark.executor.memory=8g
spark.executor.memoryOverhead=3g
spark.executor.pyspark.memory=2g
spark.sql.execution.arrow.maxRecordsPerBatch=5000` },
    { title: 'Stage spills 600 GB to disk and takes 2 hours',
      symptom: 'A groupBy over a 1.5 TB shuffle. Stage page: 200 tasks, median shuffle read 7.5 GB, huge Spill (disk).',
      cause: 'Default 200 shuffle partitions. AQE was on, but coalescing can only merge partitions, not split them.',
      fix: 'Raise the initial partition count so each is ~128 MB; AQE then merges the small ones.',
      fixCode: `spark.conf.set("spark.sql.adaptive.coalescePartitions.initialPartitionNum", 12000)
spark.conf.set("spark.sql.adaptive.advisoryPartitionSizeInBytes", "128m")` },
    { title: 'Driver OOM in a “small” job',
      symptom: 'Job fails at the end with <code>OutOfMemoryError</code> on the driver, or “Total size of serialized results … is bigger than spark.driver.maxResultSize”.',
      cause: 'A <code>toPandas()</code> on a 30 M-row DataFrame for a chart, plus a large broadcast.',
      fix: 'Aggregate in Spark first and bring back only the result; write large outputs to storage.',
      fixCode: `pdf = (df.groupBy("day").agg(F.sum("amount").alias("amount"))
        .orderBy("day").toPandas())      # 365 rows, not 30 M` }
  ],
  puzzles: [
    { kind: 'concept', q: 'Executor heap 10 GB, default fractions. Roughly how much is unified (execution + storage) memory?', options: ['10 GB', '6 GB', '5.8 GB', '3 GB'], answer: 2, explain: '(10 GB − 300 MB) × 0.6 ≈ <b>5.8 GB</b>. The rest (≈ 3.9 GB) is user memory for your objects and Spark metadata.' },
    { kind: 'concept', q: 'Execution needs memory and storage holds cached blocks. What happens?', options: ['The task fails', 'Execution evicts cached blocks, but not below the storage-protected region (storageFraction)', 'Storage evicts execution memory', 'Spark adds more heap'], answer: 1, explain: 'Unified memory: execution can borrow free storage memory and evict cached blocks down to <code>storageFraction</code> × unified. Storage can borrow free execution memory but never evicts it.' },
    { kind: 'concept', q: 'YARN kills a container for “exceeding physical memory limits”. First knob to raise?', options: ['spark.executor.memory', 'spark.executor.memoryOverhead', 'spark.memory.fraction', 'spark.sql.shuffle.partitions'], answer: 1, explain: 'The container limit is heap + overhead. Off-heap use (netty, Python workers, native code) exceeded overhead. Raise <code>memoryOverhead</code>.' },
    { kind: 'concept', q: 'AQE coalescing: shuffle has 200 partitions totalling 1 GB. Advisory size 64 MB. About how many reduce tasks run?', options: ['200', '~16', '1', '64'], answer: 1, explain: '1 GB / 64 MB ≈ <b>16</b>. AQE merges adjacent small partitions up to the advisory size (also respecting a minimum partition count/size setting).' },
    { kind: 'concept', q: 'Which is <b>not</b> something AQE does?', options: ['Coalesce small shuffle partitions', 'Convert sort-merge to broadcast join at runtime', 'Split skewed join partitions', 'Choose the number of executors'], answer: 3, explain: 'Executor count is the cluster manager’s and dynamic allocation’s job (<code>spark.dynamicAllocation.enabled</code>). AQE re-plans the query only.' },
    { kind: 'concept', q: 'Stage metrics: Spill (memory) 80 GB, Spill (disk) 12 GB. What do the two numbers mean?', options: ['80 GB was lost', 'Deserialized size of the spilled data in memory vs its serialized, compressed size on disk', 'Memory vs disk capacity', 'Two different spills'], answer: 1, explain: 'Same data, two measures: in-memory (deserialized) size when spilled, and bytes written to disk. Any non-zero spill means execution memory was short.' },
    { kind: 'concept', q: 'You see 30% of task time in GC on every executor. Most likely helpful change?', options: ['Bigger executors with more cores', 'Fewer cores per executor or more memory per task, and avoid caching huge deserialized objects', 'More shuffle partitions only', 'Disable AQE'], answer: 1, explain: 'High GC means the heap is crowded relative to work. Reduce concurrent tasks per heap, use serialized/columnar caching, avoid UDFs that create many objects. G1GC is the JVM default since Java 9.' }
  ],
  interview: [
    { q: 'Explain Spark’s unified memory model.', a: '<p>Heap minus 300 MB reserved; of the rest, <code>spark.memory.fraction</code> (0.6) is unified memory, the remainder user memory. Unified memory is shared by execution and storage with a soft boundary: <code>storageFraction</code> (0.5) of it is protected for storage. Execution can evict storage above that line; storage can use free execution memory but can’t evict it.</p>', lvl: 'core' },
    { q: 'Java OOM vs container killed: how do you tell and what do you change?', a: '<p>Java <code>OutOfMemoryError: Java heap space</code> in the executor log: heap problem (data per task too big, skew, huge collect). Container killed by YARN/K8s with no Java OOM: off-heap use over <code>memoryOverhead</code>. Fix the first with more partitions or heap; the second with overhead or <code>spark.executor.pyspark.memory</code>.</p>', lvl: 'core' },
    { q: 'What is spill, and is it bad?', a: '<p>When a sort, aggregation or join buffer can’t get more execution memory, Spark writes sorted runs to local disk and merges them later. It prevents failures but adds disk I/O. A little is fine; spill much larger than the input usually means partitions are too big or skewed.</p>', lvl: 'core' },
    { q: 'What does AQE do, and since when?', a: '<p>Introduced in 3.0, on by default since 3.2. At each stage boundary it uses real shuffle statistics to: coalesce partitions toward <code>advisoryPartitionSizeInBytes</code>; convert sort-merge joins to broadcast (or shuffle hash) joins; split skewed partitions in joins; and in later versions optimise away empty relations. Final plan visible in the SQL tab.</p>', lvl: 'core' },
    { q: 'How do you size executors?', a: '<p>Start from cores: 4–5 per executor is a common balance between parallelism and per-JVM overhead. Memory per core around 4–8 GB for typical ETL. Leave room on the node for overhead and the OS. Then look at GC time, spill and task skew and adjust. Avoid one giant executor per node.</p>', lvl: 'deep' },
    { q: 'Which configs do you touch first?', a: '<ol><li><code>spark.sql.shuffle.partitions</code> (or AQE initial partition num)</li><li><code>spark.executor.memory</code> / <code>cores</code> / <code>memoryOverhead</code></li><li><code>spark.sql.autoBroadcastJoinThreshold</code></li><li><code>spark.sql.files.maxPartitionBytes</code> (128 MB default; input split size)</li></ol><p>Most other knobs rarely matter compared with data layout.</p>', lvl: 'core' },
    { q: 'What is off-heap memory in Spark?', a: '<p><code>spark.memory.offHeap.enabled</code> with <code>spark.memory.offHeap.size</code> lets Tungsten allocate execution/storage memory outside the GC heap, reducing GC pressure. It must be accounted for in the container size. Separate from <code>memoryOverhead</code>.</p>', lvl: 'deep' },
    { q: 'Why can more partitions make a job slower?', a: '<p>Each task has scheduling overhead (tens of ms), and tiny partitions produce many small shuffle blocks and output files. Thousands of 1 MB tasks waste time. AQE coalescing addresses the shuffle side; for output files use <code>coalesce</code>/<code>repartition</code> before writing or Delta’s optimize.</p>', lvl: 'deep' },
    { q: 'How does dynamic allocation relate to tuning?', a: '<p>With <code>spark.dynamicAllocation.enabled</code>, Spark adds executors when tasks queue and removes idle ones. It needs shuffle data to outlive executors: an external shuffle service (YARN) or shuffle tracking (<code>spark.dynamicAllocation.shuffleTracking.enabled</code>, used on Kubernetes). It changes how many executors run, not their size.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'A sane starting config', lang: 'bash', code: `spark-submit \\
  --conf spark.executor.cores=5 \\
  --conf spark.executor.memory=20g \\
  --conf spark.executor.memoryOverhead=3g \\
  --conf spark.sql.adaptive.enabled=true \\
  --conf spark.sql.adaptive.coalescePartitions.initialPartitionNum=2000 \\
  --conf spark.sql.adaptive.advisoryPartitionSizeInBytes=128m \\
  --conf spark.dynamicAllocation.enabled=true \\
  --conf spark.dynamicAllocation.shuffleTracking.enabled=true \\
  job.py`, note: 'Starting values to measure from, not universal truths.' },
    { title: 'Reading the numbers from code', lang: 'python', code: `print(spark.conf.get("spark.sql.adaptive.enabled"))
print(spark.conf.get("spark.sql.shuffle.partitions"))

df = big.groupBy("k").agg(F.sum("v"))
df.explain(mode="formatted")     # AdaptiveSparkPlan isFinalPlan=false before running
df.write.mode("overwrite").parquet("out/")
# then: Spark UI > SQL > this query > final plan shows AQEShuffleRead (coalesced)` }
  ]
});

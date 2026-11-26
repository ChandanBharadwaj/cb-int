IA.register({
  track: 'spark',
  slug: 'join-strategies',
  title: 'Join strategies',
  tagline: 'Spark can join two DataFrames in a few physically different ways. A <b>broadcast</b> join ships the small side to every executor and moves nothing else. A <b>sort-merge</b> join shuffles both sides by key. Picking the wrong one, or one hot key, turns a minute into an hour.',
  tldr: {
    problem: 'In Postgres the planner picks hash, merge or nested loop and all rows sit on one machine. In Spark the rows sit on hundreds of executors, so a join first has to bring matching keys <i>to the same place</i>. That data movement (the shuffle) is the cost.',
    model: 'Two questions decide the plan: <b>is one side small enough to copy everywhere?</b> (broadcast hash join) and <b>is it an equi-join?</b> (if not, nested loop). Otherwise both sides are shuffled into <code>spark.sql.shuffle.partitions</code> buckets by key, sorted, and merged.',
    hook: '“One task runs for 40 minutes while 199 finish in 20 seconds.” That is a skewed key in a sort-merge join. Fix: AQE skew join, or salt the key.',
    facts: [
      { v: '10 MB', l: 'default <code>spark.sql.autoBroadcastJoinThreshold</code>: below this estimated size a side is broadcast. <code>-1</code> disables it' },
      { v: '200', l: 'default <code>spark.sql.shuffle.partitions</code>: the number of buckets a sort-merge join shuffles into (AQE may coalesce them)' },
      { v: '3.2+', l: 'AQE on by default. It can switch a sort-merge join to broadcast at runtime and split skewed partitions' }
    ]
  },
  intro: {
    what: 'Your data is split into <b>partitions</b> spread over many machines (<b>executors</b>). To join <code>orders</code> with <code>customers</code> on <code>customer_id</code>, every order must meet its customer row on the same machine. Spark has two main ways to arrange that: <b>copy the small table to every machine</b> (broadcast), or <b>re-shuffle both tables</b> so that equal keys land in the same partition (sort-merge).',
    analogy: { icon: '📮', title: 'Sorting mail by postcode', text: 'Ten offices each hold a random pile of letters and a random pile of addresses. To pair them, either photocopy the short address book for every office (broadcast), or have every office send each letter and address to the office responsible for its postcode (shuffle), then sort and pair locally.' },
    steps: [
      { t: 'Write the join', d: 'Same as SQL. The API call says <i>what</i>; Spark picks <i>how</i>.', code: 'orders.join(customers, "customer_id", "left")' },
      { t: 'Spark estimates sizes', d: 'Catalyst estimates each side from file sizes and statistics. If one side is under 10 MB it plans a <b>broadcast hash join</b>.' },
      { t: 'Otherwise: shuffle + sort + merge', d: 'Both sides are hashed by key into 200 shuffle partitions, written to disk, read by the next stage, sorted and merged. This is the default for big equi-joins.' },
      { t: 'Check the plan', d: 'Look for <code>BroadcastHashJoin</code> or <code>SortMergeJoin</code> and the <code>Exchange</code> (shuffle) nodes.', code: 'orders.join(customers, "customer_id").explain(mode="formatted")' },
      { t: 'Watch for skew', d: 'If one key holds a large share of the rows, its partition becomes a straggler task. AQE or salting splits it.' }
    ],
    terms: [
      ['partition', 'A chunk of a DataFrame that one task processes on one executor core.'],
      ['shuffle / Exchange', 'Redistributing rows across the cluster by key. Written to local disk and read over the network.'],
      ['broadcast', 'Sending a full copy of a small table to every executor.'],
      ['equi-join', 'A join whose condition is key equality (<code>a.k = b.k</code>). Hash and merge joins need one.'],
      ['skew', 'Uneven data: a few keys hold most rows, so a few tasks do most of the work.'],
      ['AQE', 'Adaptive Query Execution: re-plans between stages using real shuffle sizes.']
    ]
  },
  visual: {
    title: 'Broadcast vs sort-merge vs skew',
    caption: 'Pick a strategy and press <b>Play</b> or <b>Step</b>. Boxes are executors; coloured dots are rows by key. Broadcast copies the small table and moves nothing else. Sort-merge moves every row to the partition that owns its key. “Skewed” shows a hot key piling onto one task, and “AQE split” shows it being cut into pieces.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Simulation: hash partitioning + skew', code: `# SIMULATION in plain Python (no Spark): how rows land in shuffle partitions.
from collections import Counter
import random
random.seed(7)
N_PART = 8
# 90% of orders belong to one "guest" customer: a hot key
keys = ["guest"] * 9000 + [f"c{random.randint(1, 500)}" for _ in range(1000)]
part = Counter(hash(k) % N_PART for k in keys)
print("rows per partition:", sorted(part.values(), reverse=True))
print("biggest / median:", max(part.values()) / sorted(part.values())[N_PART // 2])`, note: 'Python’s string hash is randomised per process, so which partition is hot changes between runs; the shape does not. Spark uses Murmur3 on the key.' },
      { label: 'Simulation: salting the hot key', code: `# SIMULATION: add a random salt 0..S-1 to the big side, replicate the small side S times.
from collections import Counter
import random
random.seed(7)
N_PART, S = 8, 8
keys = ["guest"] * 9000 + [f"c{random.randint(1, 500)}" for _ in range(1000)]
salted = [(k, random.randrange(S)) for k in keys]
part = Counter(hash(f"{k}#{s}") % N_PART for k, s in salted)
print("rows per partition:", sorted(part.values(), reverse=True))
print("small side grows from 501 rows to", 501 * S, "rows (each key x salts)")` }
    ]
  },
  gotchas: [
    { trap: 'Broadcasting something that is not small', code: `big.join(F.broadcast(dim), "k")   # "dim" is actually 3 GB`, why: 'The broadcast side is collected <b>to the driver</b>, built into a hash table and sent to every executor. A big one causes driver OOM, <code>spark.sql.broadcastTimeout</code> (300 s) failures, or executor memory pressure. Spark refuses tables over 8 GB.', fix: 'Broadcast only true dimensions (tens to a few hundred MB at most). Let AQE decide at runtime for the rest.' },
    { trap: 'Estimated size ≠ real size', why: 'The 10 MB check uses <i>estimates</i>. A filter on a big table may make it tiny, but without statistics Spark can’t know, so it plans sort-merge. Compressed Parquet also expands a lot in memory.', fix: 'Keep AQE on (it uses real shuffle sizes after a stage), run <code>ANALYZE TABLE … COMPUTE STATISTICS</code> for catalog tables, or add a <code>broadcast()</code> hint when you know.' },
    { trap: 'You can’t broadcast the preserved side of an outer join', code: `small.join(big, "k", "left")   # small is the LEFT (preserved) side`, why: 'A broadcast hash join streams the big side and looks up the broadcast table. For a LEFT join, unmatched left rows must be emitted; if the left side is broadcast, no single task knows they were unmatched everywhere. So Spark only broadcasts the right side of LEFT, the left side of RIGHT, and neither side of FULL OUTER (with an equi-key).', fix: 'Rewrite as <code>big.join(small, "k", "right")</code> if semantics allow, or accept the sort-merge join.' },
    { trap: 'One hot key: a 40-minute straggler', why: 'All rows with the same key hash to the same shuffle partition. NULL keys, “unknown”, a test account or a top seller can hold millions of rows. Sort-merge joins also spill when one partition doesn’t fit in memory.', fix: 'Keep <code>spark.sql.adaptive.skewJoin.enabled</code> on (default true). If it’s not enough (or it’s not a join), salt the key, or handle the hot key separately and <code>union</code>.' },
    { trap: 'Non-equi joins fall back to nested loops', code: `events.join(ranges, (events.ts >= ranges.start) & (events.ts < ranges.end))`, why: 'Without an equality key Spark can’t hash or sort-merge, so it uses <b>BroadcastNestedLoopJoin</b> or a Cartesian product: every row against every row.', fix: 'Add an equality key (e.g. a date bucket: <code>F.to_date("ts") == ranges.day</code>) plus the range condition, so it becomes a hash or sort-merge join with a filter.' },
    { trap: 'Null keys and joining on expressions with different types', why: '<code>NULL = NULL</code> is not true in Spark SQL either, so null-keyed rows never match (but they still get shuffled to one partition, which can be skewed). Joining a string column to a bigint inserts casts and can silently miss rows.', fix: 'Filter null keys before the join when you don’t need them; use <code>eqNullSafe</code> (<code>&lt;=&gt;</code>) when null should match null; cast both sides explicitly.' }
  ],
  scenarios: [
    { title: 'Nightly job: 199 tasks done, 1 task still running after 45 minutes',
      symptom: 'The join stage of an orders × customers job sits at 199/200 tasks. The Spark UI shows one task with 30 GB shuffle read; the median is 150 MB.',
      diagnose: `orders.groupBy("customer_id").count().orderBy(F.desc("count")).show(5)
# customer_id = NULL   48,000,000   <- guest checkouts`,
      cause: 'Guest orders have a NULL <code>customer_id</code>. They can never match, but they still hash to one partition. AQE was disabled in the job config years ago “for stability”.',
      fix: 'Split off the null keys (they can’t match anyway) and re-enable AQE so its skew handling covers other hot keys.',
      fixCode: `spark.conf.set("spark.sql.adaptive.enabled", "true")
known = orders.filter(F.col("customer_id").isNotNull())
guests = orders.filter(F.col("customer_id").isNull())
result = known.join(customers, "customer_id", "left") \\
              .unionByName(guests, allowMissingColumns=True)` },
    { title: 'Driver OOM after “just adding a broadcast hint”',
      symptom: 'A job that ran fine started failing with <code>java.lang.OutOfMemoryError</code> on the driver, or <code>Could not execute broadcast in 300 secs</code>.',
      diagnose: `# the "dimension" grew: 40 MB last year, 2.6 GB of Parquet now
spark.table("dim_product").explain(mode="cost")   # look at sizeInBytes`,
      cause: 'A hard-coded <code>F.broadcast(dim_product)</code> forced a broadcast hash join. The table grew, and broadcasting needs it collected on the driver and held on every executor.',
      fix: 'Remove the hint and let size estimates plus AQE choose. If the table is still needed on every node, pre-filter it to the columns and rows the job needs before broadcasting.',
      fixCode: `dim = spark.table("dim_product").select("product_id", "category") \\
          .filter("active = true")
facts.join(dim, "product_id")   # no forced hint; AQE converts at runtime if small` },
    { title: 'Join on a range turned a 10-minute job into a 6-hour one',
      symptom: 'Assigning each click to a session window via <code>clicks.ts BETWEEN s.start AND s.end</code> shows <code>BroadcastNestedLoopJoin</code> in the plan.',
      cause: 'No equality condition, so every click is compared with every session.',
      fix: 'Add an equi-key the range can’t cross (user id, or a time bucket), and keep the range as an extra condition.',
      fixCode: `clicks.join(sessions,
    (clicks.user_id == sessions.user_id) &
    clicks.ts.between(sessions.start, sessions.end))` }
  ],
  puzzles: [
    { kind: 'concept', q: 'With default settings, <code>facts</code> is 2 TB and <code>dim_country</code> is a 40 KB Parquet table. What join does Spark 3.5 plan for <code>facts.join(dim_country, "country_code")</code>?', options: ['Sort-merge join', 'Broadcast hash join', 'Shuffle hash join', 'Broadcast nested loop join'], answer: 1, explain: '40 KB is far below the 10 MB <code>autoBroadcastJoinThreshold</code>, and the condition is an equi-join, so <b>BroadcastHashJoin</b>. The 2 TB side is not shuffled at all.' },
    { kind: 'concept', q: 'Which side can Spark broadcast in <code>small.join(big, "k", "left")</code>?', options: ['small', 'big', 'Either', 'Neither: it must be a sort-merge or shuffle hash join'], answer: 3, explain: 'The broadcast side must be the non-preserved one. In a LEFT join the left side (small) is preserved, so it can’t be broadcast, and big is too big. Swap to <code>big.join(small, "k", "right")</code> to allow it.' },
    { kind: 'concept', q: 'A sort-merge join normally needs an <code>Exchange</code> under each side, but the plan shows none on one side. Most likely reason?', options: ['Spark skipped the shuffle by mistake', 'That side is already hash-partitioned on the join key (e.g. from an earlier groupBy on the same key, or bucketing)', 'AQE removed the sort', 'Broadcast was used instead'], answer: 1, explain: 'If a child’s output partitioning already satisfies the join’s required distribution (same key, same number of partitions), Spark reuses it. Bucketed tables or a previous aggregation on the key avoid an exchange.' },
    { kind: 'concept', q: 'AQE’s skew join (Spark 3.x defaults) treats a shuffle partition as skewed when it is…', options: ['larger than 64 MB', 'larger than 5 × the median partition size <b>and</b> larger than 256 MB', 'more than 10% of all rows', 'larger than the broadcast threshold'], answer: 1, explain: 'Both thresholds: <code>spark.sql.adaptive.skewJoin.skewedPartitionFactor</code> (5) and <code>skewedPartitionThresholdInBytes</code> (256 MB). Skewed partitions are split, and the matching partition of the other side is replicated.' },
    { kind: 'concept', q: 'You salt the big side’s key with a random number 0–9. What must you do to the other side?', options: ['Nothing', 'Also add a random salt 0–9', 'Explode it into 10 copies, one per salt value', 'Broadcast it'], answer: 2, explain: 'A salted row <code>(k, 7)</code> must still find its match, so every row on the other side must exist for every salt: <code>explode(array(0..9))</code>. Random salt on both sides would only match ~1/10 of pairs.' },
    { kind: 'concept', q: 'Which hint asks for a shuffle hash join (Spark 3.0+)?', options: ['<code>/*+ BROADCAST(t) */</code>', '<code>/*+ MERGE(t) */</code>', '<code>/*+ SHUFFLE_HASH(t) */</code>', '<code>/*+ SHUFFLE_REPLICATE_NL(t) */</code>'], answer: 2, explain: 'Spark 3.0 added <code>MERGE</code>, <code>SHUFFLE_HASH</code> and <code>SHUFFLE_REPLICATE_NL</code> next to <code>BROADCAST</code>. Shuffle hash join shuffles both sides but builds a hash table per partition instead of sorting.' },
    { kind: 'concept', q: 'Join condition: <code>a.ts &lt; b.ts</code> only. Neither side is small. What do you get?', options: ['Sort-merge join on ts', 'Cartesian product with a filter (very slow)', 'Broadcast hash join', 'An AnalysisException'], answer: 1, explain: 'No equality key means no hash or merge join. With nothing small enough for BroadcastNestedLoopJoin, Spark uses <b>CartesianProduct</b> plus the condition. Since Spark 3.0 cross joins are allowed by default (<code>spark.sql.crossJoin.enabled=true</code>).' }
  ],
  interview: [
    { q: 'Name Spark’s join strategies and when each is chosen.', a: '<ul><li><b>Broadcast hash join</b>: one side under the threshold (or hinted); equi-join. No shuffle of the big side.</li><li><b>Sort-merge join</b>: default for large equi-joins. Shuffle both, sort, merge.</li><li><b>Shuffle hash join</b>: shuffle both, hash the smaller per partition; used when hinted, when sort-merge is not preferred, or by AQE when partitions are small.</li><li><b>Broadcast nested loop</b>: non-equi joins with a small side.</li><li><b>Cartesian</b>: non-equi, both big.</li></ul>', lvl: 'core' },
    { q: 'Why is sort-merge the default rather than shuffle hash?', a: '<p>Sort-merge degrades gracefully: sorting spills to disk, so a partition that doesn’t fit in memory still completes. A hash table per partition must fit in memory or the task fails or spills badly. <code>spark.sql.join.preferSortMergeJoin</code> is true by default.</p>', lvl: 'deep' },
    { q: 'What does AQE do for joins?', a: '<p>After the shuffle map stage finishes, AQE knows real partition sizes. It can (1) <b>convert</b> a sort-merge join into a broadcast hash join if one side turned out small, (2) <b>coalesce</b> small shuffle partitions, (3) <b>split skewed</b> partitions. On by default since Spark 3.2.</p>', fu: 'Does a runtime switch to broadcast save the shuffle? (Only partly: the map-side shuffle files are already written. It saves the sort, and Spark can read the shuffle output locally.)', lvl: 'core' },
    { q: 'How do you handle a skewed join key?', a: '<ol><li>Check whether the hot key is junk (NULL, “unknown”) and filter it.</li><li>Rely on AQE skew join.</li><li>Isolate the hot keys: broadcast-join them separately, sort-merge the rest, union.</li><li>Salt: add a random suffix on the big side, explode the small side over all suffixes.</li></ol>', lvl: 'core' },
    { q: 'Where does the broadcast table live, and why does that matter?', a: '<p>It is collected to the <b>driver</b>, built into a hashed relation, then sent to every executor as a broadcast variable and kept in executor memory. So a too-large broadcast hurts the driver (OOM, timeouts) and every executor’s memory at once.</p>', lvl: 'deep' },
    { q: 'How do bucketing or storage-partitioned joins help?', a: '<p>If both tables are bucketed by the join key into compatible bucket counts, Spark knows equal keys already share a bucket and skips the Exchange. Storage-partitioned joins (Spark 3.3+, with V2 sources such as Iceberg) do the same using the table’s partitioning. Good for tables joined repeatedly on the same key.</p>', lvl: 'deep' },
    { q: 'How do you read a join in <code>explain()</code>?', a: '<p>Look for the join node (<code>BroadcastHashJoin</code>, <code>SortMergeJoin</code>, …), the <code>Exchange hashpartitioning(k, 200)</code> nodes below it, and <code>BroadcastExchange</code>. With AQE, the initial plan says <code>AdaptiveSparkPlan isFinalPlan=false</code>; the final plan appears in the SQL tab of the Spark UI after the run.</p>', lvl: 'core' },
    { q: 'Compare a Spark join with a Postgres hash join.', a: '<p>Algorithmically the same idea: build a hash table on the smaller input, probe with the larger. The difference is distribution. Postgres has all rows local. Spark must first co-locate keys (shuffle) or replicate the build side (broadcast). The network and disk cost of that step usually dominates, so Spark tuning is mostly about avoiding or shrinking shuffles.</p>', lvl: 'core' },
    { q: 'A LEFT join result has fewer rows than the left table. Possible?', a: '<p>No, not by the join itself: a LEFT join keeps every left row. If you see fewer, a later filter on a right-side column (like SQL’s ON vs WHERE trap), or a <code>dropDuplicates</code>, removed them. More rows than the left side means fan-out from duplicate keys on the right.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Hints, thresholds and checking the plan', lang: 'python', code: `from pyspark.sql import functions as F

spark.conf.set("spark.sql.autoBroadcastJoinThreshold", 50 * 1024 * 1024)  # 50 MB
spark.conf.set("spark.sql.adaptive.enabled", "true")                     # default since 3.2

# explicit hint (DataFrame API)
out = facts.join(F.broadcast(dim_country), "country_code")

# SQL hints (Spark 3.0+): BROADCAST, MERGE, SHUFFLE_HASH, SHUFFLE_REPLICATE_NL
spark.sql("""
  SELECT /*+ SHUFFLE_HASH(c) */ o.*, c.segment
  FROM orders o JOIN customers c ON o.customer_id = c.customer_id
""").explain(mode="formatted")`, note: 'With AQE the printed plan is the <i>initial</i> one. Check the SQL tab in the Spark UI for the final plan.' },
    { title: 'Salting a skewed join', lang: 'python', code: `SALTS = 16
big_s = big.withColumn("salt", (F.rand() * SALTS).cast("int"))
small_s = small.withColumn("salt", F.explode(F.sequence(F.lit(0), F.lit(SALTS - 1))))

joined = big_s.join(small_s, ["key", "salt"]).drop("salt")`, note: 'The small side grows 16×. Salt only the hot keys if the small side isn’t that small.' },
    { title: 'The same join in Java', lang: 'java', code: `import static org.apache.spark.sql.functions.*;

Dataset<Row> out = facts.join(broadcast(dimCountry),
    facts.col("country_code").equalTo(dimCountry.col("code")), "left");
out.explain("formatted");` }
  ]
});

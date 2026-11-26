IA.register({
  track: 'spark',
  slug: 'transformations-aggregations',
  title: 'Transformations & aggregations',
  tagline: '<code>groupBy</code>, joins and window functions look just like SQL. The difference is <b>where the rows live</b>: they are spread over many machines, so every “bring matching rows together” step is a <b>shuffle</b>.',
  tldr: {
    problem: 'You know <code>GROUP BY</code>, <code>JOIN</code> and <code>OVER (PARTITION BY …)</code> from Postgres. In Spark the same words run on data split across executors, and the cost and the traps come from moving rows between them.',
    model: '<b>Narrow</b> transformations (<code>select</code>, <code>filter</code>, <code>withColumn</code>) work row by row inside a partition. <b>Wide</b> ones (<code>groupBy</code>, most joins, windows, <code>distinct</code>, <code>orderBy</code>) need rows with the same key in one task, so they shuffle.',
    hook: '“Why is my groupBy cheap but my window function on the same key slow?” groupBy can pre-aggregate before the shuffle. A window has to ship every row.',
    facts: [
      { v: '200', l: 'default <code>spark.sql.shuffle.partitions</code>: the number of partitions after a shuffle, before AQE coalesces them' },
      { v: '10 MB', l: 'default <code>spark.sql.autoBroadcastJoinThreshold</code>: below it, Spark may broadcast the smaller join side instead of shuffling both' },
      { v: '2 phases', l: 'a groupBy with sum/count runs as a partial aggregate per task, then a final aggregate after the shuffle' }
    ]
  },
  intro: {
    what: 'A Spark <b>DataFrame</b> is a table, like a Postgres result set, but cut into <b>partitions</b> that live on different machines (executors). A <b>transformation</b> describes a new DataFrame from an old one: filter rows, add a column, group, join. Spark doesn’t run it immediately. It runs when you ask for a result (an <b>action</b>, such as <code>show()</code>, <code>count()</code> or <code>write</code>).',
    analogy: { icon: '🗳️', title: 'Counting votes in many polling stations', text: 'Each station counts its own ballots per candidate first (partial aggregation). Then each station sends one small tally per candidate to the central office for that candidate (the shuffle). The central office adds the tallies (final aggregation). Nobody ships every single ballot, unless you ask for something like “rank every ballot”, which is what a window function does.' },
    steps: [
      { t: 'Narrow: row by row', d: 'Filtering and adding columns need no other rows. Each partition is processed on its own.', code: 'from pyspark.sql import functions as F\npaid = orders.filter(F.col("status") == "paid") \\\n             .withColumn("amt_eur", F.col("amt") * 0.92)' },
      { t: 'Group and aggregate', d: 'Same idea as <code>GROUP BY</code>. <code>agg</code> takes one or more aggregate expressions.', code: 'paid.groupBy("city").agg(\n    F.count("*").alias("n"),\n    F.sum("amt").alias("revenue"))' },
      { t: 'Join two DataFrames', d: 'Pass the key column name (or a condition) and the join type.', code: 'orders.join(customers, on="cid", how="left")' },
      { t: 'Window functions', d: 'Compute per-group values without collapsing rows: rank, running totals, previous row.', code: 'from pyspark.sql import Window\nw = Window.partitionBy("cid").orderBy("ts")\norders.withColumn("prev_amt", F.lag("amt").over(w))' },
      { t: 'Nothing ran yet', d: 'All of the above only built a plan. <code>.show()</code>, <code>.count()</code> or <code>.write…</code> starts the job. See <a href="lazy-eval-dag.html">Lazy evaluation &amp; the DAG</a>.' }
    ],
    terms: [
      ['partition', 'One chunk of a DataFrame’s rows, processed by one task on one executor core.'],
      ['narrow transformation', 'Each output partition depends on one input partition: <code>filter</code>, <code>select</code>, <code>withColumn</code>.'],
      ['wide transformation', 'An output partition needs rows from many input partitions, so Spark shuffles: <code>groupBy</code>, <code>join</code>, window, <code>distinct</code>.'],
      ['shuffle (Exchange)', 'Redistributing rows across the cluster by a key. It writes files to local disk and sends them over the network.'],
      ['F', 'The usual import alias: <code>from pyspark.sql import functions as F</code>.']
    ]
  },
  visual: {
    title: 'Watch rows meet their key',
    caption: 'Pick an operation and press Play (or Step / Back). Colours are keys. Watch where partial aggregation shrinks the data, where the shuffle moves it, and how a broadcast join avoids moving the big side.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Simulation: partial + final agg', code: `# SIMULATION in plain Python: how Spark runs groupBy("city").agg(sum("amt"))
from collections import defaultdict

partitions = [[("a", 5), ("b", 3), ("a", 2)],
              [("b", 4), ("c", 7), ("a", 1)],
              [("c", 2), ("b", 1), ("c", 6)]]
N = 3  # shuffle partitions (spark.sql.shuffle.partitions)

# stage 1: partial aggregation inside each task
partials = []
for p in partitions:
    acc = defaultdict(int)
    for k, v in p:
        acc[k] += v
    partials.append(dict(acc))
print("partials:", partials)

# shuffle: route each partial row by hash(key) % N  (Spark uses Murmur3, not Python hash)
buckets = [defaultdict(list) for _ in range(N)]
shipped = 0
for acc in partials:
    for k, v in acc.items():
        buckets[sum(map(ord, k)) % N][k].append(v)
        shipped += 1
print("rows shuffled:", shipped, "instead of", sum(map(len, partitions)))

# stage 2: final aggregation
for i, b in enumerate(buckets):
    print("shuffle part", i, {k: sum(vs) for k, vs in b.items()})`, note: 'A model of the idea, not Spark. Spark hashes with Murmur3 and keeps aggregation buffers in Tungsten binary format.' },
      { label: 'Simulation: rank vs dense_rank', code: `# SIMULATION: rank / dense_rank / row_number over (partition by dept order by sal desc)
rows = [("eng", 120), ("ops", 70), ("eng", 90), ("hr", 60), ("eng", 120), ("ops", 80)]
from itertools import groupby
rows.sort(key=lambda r: (r[0], -r[1]))           # the Sort before the Window
for dept, grp in groupby(rows, key=lambda r: r[0]):
    grp = list(grp)
    rank = dense = 0; prev = None
    for i, (_, sal) in enumerate(grp, 1):
        if sal != prev:
            rank, dense, prev = i, dense + 1, sal
        print(dept, sal, "row_number", i, "rank", rank, "dense_rank", dense)` }
    ]
  },
  gotchas: [
    { trap: 'Joining on an expression leaves two key columns', code: `j = orders.join(customers, orders.cid == customers.cid)\nj.select("cid")   # AnalysisException: [AMBIGUOUS_REFERENCE]\n\nj = orders.join(customers, "cid")   # one cid column`, why: 'With a condition, both <code>cid</code> columns survive, just like <code>SELECT *</code> on a Postgres join. With a column name (or list of names) Spark keeps one, like <code>USING</code>.', fix: 'Join on names when the keys share a name. Otherwise alias the DataFrames (<code>orders.alias("o")</code>) and select <code>F.col("o.cid")</code>, or drop one side.' },
    { trap: 'count("*") vs count(col) after a left join', code: `j.groupBy("cid").agg(F.count("*"), F.count("order_id"))`, why: 'Same as SQL: <code>count("*")</code> counts rows, including the NULL-padded one. <code>count(col)</code> skips nulls.', fix: 'Count a column from the right side when you mean “number of matches”.' },
    { trap: 'A window without partitionBy runs in one task', code: `w = Window.orderBy("ts")           # no partitionBy\ndf.withColumn("rn", F.row_number().over(w))\n# WARN WindowExec: No Partition Defined for Window operation!\n#      Moving all data to a single partition`, why: 'A global order needs every row in one place. On a big table that is one task, one core, likely spilling or running out of memory.', fix: 'Partition the window by a real key. For a global id use <code>monotonically_increasing_id()</code> (unique, not consecutive), or <code>zipWithIndex</code> on the RDD if you truly need 0..n-1.' },
    { trap: 'collect_list / first are not ordered', code: `df.groupBy("cid").agg(F.collect_list("item"))   # order not guaranteed\ndf.groupBy("cid").agg(F.first("status"))         # arbitrary row`, why: 'After a shuffle, the order in which rows arrive depends on which tasks finished first. Results can change between runs.', fix: 'Sort inside the aggregate: <code>F.array_sort(F.collect_list(F.struct("ts","item")))</code>, or use <code>F.max_by("status","ts")</code> (Spark 3.3+), or a window with <code>row_number()</code>.' },
    { trap: 'dropDuplicates keeps a random row', why: '<code>dropDuplicates(["cid"])</code> keeps one row per key, but which one isn’t defined. It is not “the latest”.', fix: 'Use <code>row_number()</code> over a window ordered by your tie-breaker and keep <code>rn == 1</code>.' },
    { trap: 'Skewed keys: one task runs for an hour', why: 'A shuffle sends all rows of a key to one task. If 30% of orders have <code>cid = NULL</code> or one giant customer, that task holds 30% of the data while 199 others sit idle.', fix: 'Filter or handle null keys separately, broadcast the small side, use AQE skew-join handling (<code>spark.sql.adaptive.skewJoin.enabled</code>, on by default), or salt the key. See <a href="join-strategies.html">Join strategies</a>.' }
  ],
  scenarios: [
    { title: 'Daily dedup job keeps the wrong address',
      symptom: 'Customers complain that parcels go to an old address. The “latest address per customer” table sometimes holds an older row, and the result changes between reruns.',
      diagnose: `addr.dropDuplicates(["cid"])   # in the job\n# rerun twice and compare\na1.exceptAll(a2).count()       # > 0: non-deterministic`,
      cause: '<code>dropDuplicates</code> keeps whichever row of a key arrives first after the shuffle. That depends on task timing, not on <code>updated_at</code>.',
      fix: 'Rank rows explicitly and keep the first.',
      fixCode: `w = Window.partitionBy("cid").orderBy(F.desc("updated_at"), F.desc("id"))\nlatest = (addr.withColumn("rn", F.row_number().over(w))\n              .filter("rn = 1").drop("rn"))` },
    { title: 'Revenue report doubled after adding a join',
      symptom: 'Revenue per region jumped 2.3× the day someone joined <code>orders</code> to a <code>promotions</code> table to add a promo code column.',
      diagnose: `promotions.groupBy("order_id").count().filter("count > 1").show()`,
      cause: 'Fan-out: some orders have several promotions, so each order row is repeated per promotion and <code>sum(amt)</code> counts it several times. Exactly the same bug as in SQL.',
      fix: 'Aggregate the child to one row per key before joining, and add a data test that the total before and after the join matches.',
      fixCode: `promo1 = promotions.groupBy("order_id").agg(F.concat_ws(",", F.collect_set("code")).alias("codes"))\norders.join(promo1, "order_id", "left").groupBy("region").agg(F.sum("amt"))` },
    { title: 'Window job stuck at 199/200 tasks',
      symptom: 'A sessionisation job (window over <code>user_id</code> ordered by time) finishes 199 tasks in two minutes. The last one runs for 50 minutes and then fails with an executor OOM.',
      diagnose: `events.groupBy("user_id").count().orderBy(F.desc("count")).show(5)\n# user_id = null     812,331,004\n# user_id = 'u_17'       41,220`,
      cause: 'Anonymous events have <code>user_id = NULL</code>. All of them land in one window partition, and a window cannot pre-aggregate, so one task gets hundreds of millions of rows.',
      fix: 'Process null keys separately (or drop them, if sessions don’t make sense for them), then union the results.',
      fixCode: `known = events.filter(F.col("user_id").isNotNull())\nsessions = sessionise(known)   # window over user_id\nanon = events.filter(F.col("user_id").isNull()).withColumn("session_id", F.lit(None))` }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which of these causes a shuffle?', options: ['<code>df.filter(F.col("x") > 0)</code>', '<code>df.withColumn("y", F.col("x") * 2)</code>', '<code>df.groupBy("k").count()</code>', '<code>df.select("x", "k")</code>'], answer: 2, explain: 'Only <code>groupBy</code> is wide: rows of the same key must meet in one task. The others are narrow and run inside each partition.' },
    { kind: 'concept', q: '<code>df.groupBy("city").agg(F.sum("amt"))</code> on 9 rows in 3 partitions, where partition p0 holds <code>(a,5), (b,3), (a,2)</code>. How many rows does p0 send into the shuffle?', options: ['3', '2', '1', '0'], answer: 1, explain: 'Partial aggregation runs before the shuffle: p0 sends <code>(a,7)</code> and <code>(b,3)</code>, so <b>2</b> rows. That is why sum/count aggregations shuffle far less than the raw data.' },
    { kind: 'concept', q: 'You join <code>orders</code> and <code>customers</code> with <code>orders.join(customers, "cid")</code>. How many <code>cid</code> columns does the result have?', options: ['0', '1', '2', 'It depends on the join type'], answer: 1, explain: 'Joining on a column name (or a list of names) keeps <b>one</b> key column, like SQL <code>USING</code>. Joining on <code>orders.cid == customers.cid</code> keeps both.' },
    { kind: 'concept', q: 'A window spec has <code>partitionBy("dept").orderBy("sal")</code> and you compute <code>F.sum("sal").over(w)</code>. What does each row get?', options: ['The dept total', 'A running total up to and including the current sal (ties included)', 'The current row’s sal', 'An error: sum needs a frame'], answer: 1, explain: 'With <code>orderBy</code>, the default frame is <code>RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW</code>, the same as Postgres. Rows with an equal <code>sal</code> are peers, so they share the same running total. Without <code>orderBy</code> the frame is the whole partition.' },
    { kind: 'concept', q: 'Salaries in eng are 120, 120, 90 (descending). What are <code>rank()</code> values?', options: ['1, 2, 3', '1, 1, 2', '1, 1, 3', '0, 0, 2'], answer: 2, explain: '<code>rank</code> gives ties the same rank and leaves a gap: 1, 1, 3. <code>dense_rank</code> gives 1, 1, 2 and <code>row_number</code> 1, 2, 3 (tie order arbitrary).' },
    { kind: 'concept', q: 'customers is 5 MB, orders is 2 TB, default settings. Which join strategy will Spark most likely pick for <code>orders.join(customers, "cid")</code>?', options: ['Sort-merge join, shuffling both sides', 'Broadcast hash join, customers broadcast', 'Cartesian product', 'Broadcast nested loop join'], answer: 1, explain: 'customers is under the 10 MB <code>autoBroadcastJoinThreshold</code> (based on Spark’s size estimate), so Spark broadcasts it and the 2 TB side never shuffles. Note the estimate can be off, for example after a filter on a file without statistics.' },
    { kind: 'concept', q: 'Which join type returns customers that have <b>no</b> orders, with only customer columns?', options: ['<code>how="left"</code>', '<code>how="left_anti"</code>', '<code>how="left_semi"</code>', '<code>how="outer"</code>'], answer: 1, explain: '<code>left_anti</code> is <code>NOT EXISTS</code>; <code>left_semi</code> is <code>EXISTS</code>. Both return only left columns and never multiply rows.' }
  ],
  interview: [
    { q: 'What is the difference between a narrow and a wide transformation?', a: '<p>Narrow: each output partition depends on one input partition (<code>filter</code>, <code>select</code>, <code>withColumn</code>, <code>union</code>). Spark pipelines them in one stage, with no data movement. Wide: an output partition needs data from many input partitions (<code>groupBy</code>, <code>join</code> unless broadcast, window, <code>distinct</code>, <code>orderBy</code>, <code>repartition</code>). That is a shuffle, and it ends a stage.</p>', fu: 'Is coalesce narrow or wide? (Narrow: it merges partitions without a shuffle.)', lvl: 'core' },
    { q: 'How does Spark execute <code>groupBy(k).agg(sum(v))</code> physically?', a: '<p>Usually as <code>HashAggregate(partial)</code> → <code>Exchange hashpartitioning(k, 200)</code> → <code>HashAggregate(final)</code>. Each task combines its own rows first, so only one row per key per task is shuffled. If the aggregate buffers don’t fit (for example a high-cardinality key), Spark falls back to sort-based aggregation and can spill.</p>', fu: 'Which aggregates can’t be partially aggregated cheaply? (collect_list/collect_set ship everything; exact count distinct needs a second aggregation level.)', lvl: 'deep' },
    { q: 'groupBy vs window function: when do you use which?', a: '<p><code>groupBy</code> collapses to one row per group. A window keeps every row and adds a value computed over its group: rank, running total, <code>lag</code>/<code>lead</code>, share of total. Windows shuffle <i>all</i> rows (no partial aggregation) and sort them, so for “just the totals” prefer groupBy and join back if needed.</p>', lvl: 'core' },
    { q: 'How do you get the latest row per key in Spark?', a: '<p><code>row_number()</code> over <code>Window.partitionBy(key).orderBy(desc(ts), desc(tiebreak))</code>, then keep <code>rn = 1</code>. Alternatives: <code>max_by(struct, ts)</code> (3.3+) inside a groupBy, or <code>max(struct(ts, *cols))</code>, which compares structs field by field. Never rely on <code>dropDuplicates</code> or <code>first</code> for this.</p>', lvl: 'core' },
    { q: 'What join types does the DataFrame API support, and how do they map to SQL?', a: '<ul><li><code>inner</code>, <code>left</code>, <code>right</code>, <code>full</code> (alias <code>outer</code>): as in SQL.</li><li><code>left_semi</code> = <code>EXISTS</code>, <code>left_anti</code> = <code>NOT EXISTS</code>: left columns only, no duplication.</li><li><code>cross</code>: Cartesian product, also <code>crossJoin()</code>.</li></ul><p>Null keys never match with <code>==</code>; use <code>eqNullSafe</code> (SQL <code>&lt;=&gt;</code>) if they should.</p>', lvl: 'core' },
    { q: 'What are rollup, cube and grouping sets?', a: '<p>Multi-level aggregation in one pass, as in Postgres. <code>rollup("country","city")</code> gives (country, city), (country) and the grand total; <code>cube</code> gives every combination. Subtotal rows have nulls in the rolled-up columns; use <code>F.grouping("city")</code> to tell them apart from real null cities. Spark SQL also supports <code>GROUPING SETS</code>.</p>', lvl: 'deep' },
    { q: 'How does pivot work, and what is the performance trap?', a: '<p><code>df.groupBy("cid").pivot("month").sum("amt")</code> turns month values into columns. Without an explicit value list Spark first runs a job to find the distinct values. Pass the values (<code>pivot("month", ["01","02",…])</code>) to skip that job and keep the schema stable.</p>', lvl: 'deep' },
    { q: 'countDistinct vs approx_count_distinct?', a: '<p><code>countDistinct</code> is exact but needs every distinct value shuffled (it is planned as two aggregation levels). <code>approx_count_distinct(col, rsd)</code> uses HyperLogLog++ with a default relative standard deviation of 5%, a small fixed-size sketch per group. For dashboards over billions of rows the approximation is usually the right call.</p>', lvl: 'deep' },
    { q: 'Why might the same aggregation give slightly different floating-point results between runs?', a: '<p>Floating-point addition isn’t associative, and the order in which partial sums are merged depends on task scheduling and partitioning. Use <code>DecimalType</code> for money, or round at the end.</p>', lvl: 'deep' },
    { q: 'How would you write the same aggregation in Postgres, PySpark and Java?', a: '<p>SQL: <code>SELECT city, sum(amt) FROM orders GROUP BY city</code>. PySpark: <code>orders.groupBy("city").agg(F.sum("amt"))</code>. Java: <code>orders.groupBy(col("city")).agg(sum("amt"))</code> with static imports from <code>org.apache.spark.sql.functions</code>. All three produce the same Catalyst plan; the language only builds it. See <a href="spark-sql.html">Spark SQL</a>.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Daily KPIs per city', lang: 'python', code: `from pyspark.sql import functions as F, Window

orders = spark.read.parquet("s3://lake/orders/")          # cid, city, amt, status, ts
paid = orders.filter(F.col("status") == "paid")

kpis = (paid.groupBy("city", F.to_date("ts").alias("day"))
            .agg(F.count("*").alias("orders"),
                 F.sum("amt").alias("revenue"),
                 F.approx_count_distinct("cid").alias("buyers")))

# share of the city's monthly revenue: window over the aggregated (small) result
w = Window.partitionBy("city", F.date_trunc("month", "day"))
kpis = kpis.withColumn("share", F.col("revenue") / F.sum("revenue").over(w))
kpis.write.mode("overwrite").partitionBy("day").parquet("s3://lake/kpis/")`, note: 'Windows over an aggregated result are cheap: the shuffle moves thousands of rows, not billions.' },
    { title: 'Same thing in Java (Spark Dataset API)', lang: 'java', code: `import static org.apache.spark.sql.functions.*;
import org.apache.spark.sql.*;
import org.apache.spark.sql.expressions.Window;
import org.apache.spark.sql.expressions.WindowSpec;

Dataset<Row> paid = spark.read().parquet("s3://lake/orders/")
    .filter(col("status").equalTo("paid"));

Dataset<Row> perCity = paid.groupBy(col("city"))
    .agg(count(lit(1)).as("orders"), sum("amt").as("revenue"));

WindowSpec w = Window.partitionBy("cid").orderBy(col("ts").desc());
Dataset<Row> latest = paid.withColumn("rn", row_number().over(w))
    .filter(col("rn").equalTo(1)).drop("rn");`, note: 'Java uses <code>equalTo</code> instead of <code>==</code>; the plan is identical to the PySpark version.' },
    { title: 'Postgres equivalent', lang: 'sql', code: `-- latest order per customer
SELECT * FROM (
  SELECT o.*, row_number() OVER (PARTITION BY cid ORDER BY ts DESC) AS rn
  FROM orders o WHERE status = 'paid'
) t WHERE rn = 1;
-- Postgres also has DISTINCT ON (cid) ... ORDER BY cid, ts DESC; Spark does not.` }
  ]
});

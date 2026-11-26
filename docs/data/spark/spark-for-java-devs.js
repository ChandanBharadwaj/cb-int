IA.register({
  track: 'spark',
  slug: 'spark-for-java-devs',
  title: 'Spark for Java developers',
  tagline: 'Spark is a <b>JVM</b> system. PySpark is a thin Python layer that drives the JVM through <b>Py4J</b> (or, with Spark Connect, over gRPC). Your Java instincts about heaps, GC, serialization and classpaths apply, but the unit of work is a distributed plan, not an object graph.',
  tldr: {
    problem: 'A Java/Spring developer reaches for familiar habits: loops over collections, singletons, big heaps, <code>synchronized</code>. In Spark those either don’t run where you think (driver vs executor), aren’t serializable, or kill performance.',
    model: 'Your <code>main</code> (or Python script) runs on the <b>driver</b> and only builds a plan. Catalyst compiles it to JVM bytecode that runs in <b>executor JVMs</b>. DataFrame code in Python, Java or Scala ends up as the same plan and the same speed, <i>until</i> you add a Python UDF, which ships rows to Python worker processes.',
    hook: '“Is PySpark slower than Scala Spark?” For DataFrame/SQL operations, no: same plan, same JVM execution. For Python UDFs and RDD lambdas, yes, because rows cross into Python processes.',
    facts: [
      { v: 'Java 17', l: 'minimum for Spark 4.0 (17 and 21 supported). Spark 3.5 runs on Java 8, 11 and 17' },
      { v: 'Scala 2.13', l: 'Spark 4.0 is built for Scala 2.13 only; Spark 3.5 ships builds for 2.12 and 2.13' },
      { v: '3.4+', l: 'Spark Connect: a thin client talks to a remote Spark server over gRPC, no local JVM needed for the client' }
    ]
  },
  intro: {
    what: 'Spark is written in Scala and runs on the JVM. You can use it from <b>Scala</b>, <b>Java</b>, <b>Python</b> (PySpark), R or SQL. In PySpark, the Python process starts (or connects to) a JVM and calls into it via a bridge called <b>Py4J</b>. Most PySpark calls just build a plan inside that JVM; the heavy work happens in executor JVMs. Only Python UDFs and RDD functions run actual Python code on the executors.',
    analogy: { icon: '🎛️', title: 'A remote control for a JVM', text: 'PySpark is a remote control. Pressing “filter” or “join” sends a command to the JVM, which does the work at JVM speed. A Python UDF is like asking the JVM to hand every item back to you so you can process it by hand, then pass it back. That round trip is the cost.' },
    steps: [
      { t: 'Same job, three languages', d: 'The DataFrame API is nearly identical across languages.', code: '# Python\ndf.filter(F.col("amount") > 100).groupBy("country").count()\n// Java\ndf.filter(col("amount").gt(100)).groupBy("country").count();' },
      { t: 'Driver vs executor', d: 'Code in your script runs on the driver. Functions you pass to Spark (UDFs, <code>map</code>) are serialized and run on executors.' },
      { t: 'Prefer built-ins', d: 'Built-in functions (<code>pyspark.sql.functions</code>) run in the JVM. Python UDFs run in separate Python workers.' },
      { t: 'If you must write Python logic, vectorise', d: 'pandas UDFs send Arrow column batches, much cheaper than row-at-a-time pickling.' },
      { t: 'Tune like a JVM, think like a cluster', d: 'Executors are JVMs: heap, GC and overhead matter. But the big wins come from less shuffle and fewer bytes read.' }
    ],
    terms: [
      ['Py4J', 'The bridge that lets the Python driver call objects inside the driver JVM.'],
      ['Spark Connect', 'Client-server protocol (3.4+): the client sends unresolved plans over gRPC to a Spark server.'],
      ['Dataset&lt;T&gt;', 'Typed API in Scala/Java using Encoders. <code>DataFrame</code> = <code>Dataset&lt;Row&gt;</code>.'],
      ['Encoder', 'Maps a JVM type (bean, case class) to Spark’s internal binary row format.'],
      ['Arrow', 'A columnar memory format used to move data between the JVM and Python efficiently.'],
      ['closure', 'A function plus the variables it captures; Spark serializes it to send to executors.']
    ]
  },
  visual: {
    title: 'Where your code actually runs',
    caption: 'Pick a path and press <b>Play</b> or <b>Step</b>. Built-in functions stay inside executor JVMs. A Python UDF ships rows to a Python worker and back. A pandas UDF ships Arrow batches. Spark Connect replaces the local Py4J bridge with gRPC.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Simulation: row-at-a-time vs batch serialization', code: `# SIMULATION in plain Python: why row-wise Python UDFs cost more than batched ones.
# We only measure serialization overhead, the part Spark adds when crossing JVM <-> Python.
import pickle, time
rows = [(i, f"user{i}", i * 0.5) for i in range(200_000)]

t = time.perf_counter()
for r in rows:                     # one round trip per row
    pickle.loads(pickle.dumps(r))
row_s = time.perf_counter() - t

t = time.perf_counter()
for i in range(0, len(rows), 10_000):   # batches of 10k rows, like Arrow batches
    pickle.loads(pickle.dumps(rows[i:i + 10_000]))
batch_s = time.perf_counter() - t
print(f"row-at-a-time: {row_s:.3f}s   batched: {batch_s:.3f}s   ratio ~{row_s / batch_s:.1f}x")`, note: 'Real PySpark batches Python UDF rows too (pickled in chunks), and Arrow is columnar and avoids per-object pickling. The point is the shape of the cost, not the exact ratio.' }
    ]
  },
  gotchas: [
    { trap: 'Task not serializable', code: `// Java: the lambda captures "this", a Spring bean with a DataSource
ds.map((MapFunction<Row, String>) r -> service.enrich(r), Encoders.STRING());`, why: 'Functions passed to Spark are serialized to executors with everything they capture. A Spring bean, a connection pool or a logger instance is usually not <code>Serializable</code>, or would be meaningless on another machine.', fix: 'Capture only plain values. Create clients on the executor, once per partition (<code>mapPartitions</code>), or keep them in a lazily initialised static holder.' },
    { trap: 'Python UDFs for things built-ins do', code: `@F.udf("string")\ndef up(s): return s.upper() if s else None\ndf.withColumn("u", up("name"))`, why: 'Each row is serialized out of the JVM to a Python worker and back, and Catalyst can’t optimise inside the UDF (no pushdown, no codegen).', fix: 'Use <code>F.upper("name")</code>. For real Python logic use a pandas UDF (Arrow), or in Spark 3.5+ an Arrow-optimised Python UDF (<code>useArrow=True</code>).' },
    { trap: 'Driver-side loops over data', code: `for row in df.collect():            # 50 M rows to the driver\n    jdbc.update(row)`, why: 'Looks like Java collection code, but it pulls everything into one process and processes it serially.', fix: 'Express it as a DataFrame transformation, or write with <code>foreachPartition</code> / a bulk JDBC writer so executors do the work in parallel.' },
    { trap: 'Statics and singletons behave per JVM', why: 'A static counter updated in a UDF is per executor JVM (and per Python worker in PySpark). The driver never sees it; values reset when executors restart.', fix: 'Use accumulators for simple metrics (with care: updated in transformations they can double count on retries), or return values as data.' },
    { trap: 'Dependency conflicts on the classpath', why: 'Spark ships its own Jackson, Guava, Netty, Hadoop clients. A fat JAR with different versions can cause <code>NoSuchMethodError</code> at runtime.', fix: 'Mark Spark dependencies as <code>provided</code>, shade conflicting libraries in your JAR, and match your Scala version to the Spark build (2.13 for Spark 4.0).' },
    { trap: 'Huge heaps and old GC habits', why: 'A 100 GB executor heap with many cores gives long GC pauses. Many objects (RDDs of Java beans) cost much more memory than Spark’s binary rows.', fix: 'Use DataFrames/Datasets (Tungsten binary format), medium executors, G1GC (default), and look at GC time in the Executors tab before tuning flags.' }
  ],
  scenarios: [
    { title: 'Enrichment job 20× slower after moving from Scala to PySpark',
      symptom: 'A team ported a Scala job to PySpark. Same cluster, but one stage went from 6 to 120 minutes. The stage shows <code>BatchEvalPython</code> in its plan.',
      diagnose: `df.explain()   # ... BatchEvalPython [normalize_phone(phone)] ...`,
      cause: 'The Scala version used a Scala function compiled into the JVM plan; the port used a row-wise Python UDF, so 2 billion rows were pickled to Python workers and back.',
      fix: 'Replace it with built-ins (<code>regexp_replace</code>), or a pandas UDF if logic must stay in Python.',
      fixCode: `df = df.withColumn("phone", F.regexp_replace("phone", r"[^0-9+]", ""))
# or, vectorised:
@F.pandas_udf("string")
def normalize(s: pd.Series) -> pd.Series:
    return s.str.replace(r"[^0-9+]", "", regex=True)` },
    { title: 'Spring Boot service embedding a SparkSession',
      symptom: 'A REST service creates <code>SparkSession.builder().master("local[*]")</code> inside the app. Memory use spikes, GC pauses hit API latency, and two requests at once fight over the session.',
      cause: 'Spark is designed as a batch/stream engine, not a per-request library. Local mode runs the whole engine inside the web app’s JVM.',
      fix: 'Keep Spark jobs separate (submitted to a cluster or a scheduled job). The service triggers jobs or reads results from Delta/Postgres. For interactive queries from the app, use Spark Connect or a SQL warehouse via JDBC.',
      fixCode: `// Spark Connect client from the JVM (3.4+), no local engine:
SparkSession spark = SparkSession.builder().remote("sc://spark-connect:15002").getOrCreate();` }
  ],
  puzzles: [
    { kind: 'concept', q: '<code>df.groupBy("k").agg(F.sum("v"))</code> in PySpark vs the same in Scala. Performance?', options: ['PySpark is ~10× slower', 'Essentially the same: both build the same Catalyst plan executed in executor JVMs', 'PySpark is faster because of NumPy', 'Scala is faster because it is compiled'], answer: 1, explain: 'DataFrame operations are planned and run in the JVM regardless of the API language. Python only adds a small driver-side cost for building the plan.' },
    { kind: 'concept', q: 'Where does a row-wise Python UDF execute?', options: ['In the driver’s Python process', 'In the executor JVM via Jython', 'In Python worker processes next to each executor, fed rows by the JVM', 'On the cluster manager'], answer: 2, explain: 'The executor JVM launches/reuses Python workers and streams batches of pickled rows (or Arrow batches for pandas/Arrow UDFs) over a local socket.' },
    { kind: 'concept', q: 'Java code: <code>ds.map(r -> helper.f(r), …)</code> fails with <i>Task not serializable</i>. The likely cause?', options: ['The Dataset is too big', '<code>helper</code> (or the enclosing <code>this</code>) is captured by the lambda and isn’t Serializable', 'Lambdas aren’t supported in Java', 'Missing Encoder'], answer: 1, explain: 'Spark serializes the closure. Capturing a non-serializable field (often through an implicit <code>this</code>) fails. Copy the needed value into a local final variable, or make the helper static/serializable.' },
    { kind: 'concept', q: 'Which minimum Java version does Spark 4.0 require?', options: ['8', '11', '17', '21'], answer: 2, explain: 'Spark 4.0 dropped Java 8 and 11; it supports Java 17 and 21. Spark 3.5 supports 8, 11 and 17.' },
    { kind: 'concept', q: 'In Java, what is a <code>DataFrame</code>?', options: ['A separate class from Dataset', '<code>Dataset&lt;Row&gt;</code>', 'An RDD of Rows', 'A Java Stream'], answer: 1, explain: 'Java has no type alias, so you write <code>Dataset&lt;Row&gt;</code>. Typed Datasets use <code>Encoders.bean(MyBean.class)</code>.' },
    { kind: 'concept', q: 'What does Spark Connect change for a PySpark client?', options: ['Executors run Python natively', 'The client no longer needs a local driver JVM; it sends plans over gRPC to a remote Spark server', 'UDFs become free', 'It replaces Catalyst'], answer: 1, explain: 'With Spark Connect (3.4+), the driver runs server-side. Spark 4.0 also ships a lightweight <code>pyspark-client</code> package. Some RDD/SparkContext APIs aren’t available over Connect.' }
  ],
  interview: [
    { q: 'How does PySpark talk to the JVM?', a: '<p>Classic mode: the Python driver launches a JVM (via <code>spark-submit</code>) and uses <b>Py4J</b> sockets to call driver-side JVM objects. DataFrame calls build JVM plan objects. On executors, the JVM starts Python worker processes only when Python code (UDFs, RDD lambdas) must run, exchanging data via pickle or Arrow. Spark Connect replaces Py4J with gRPC to a remote driver.</p>', lvl: 'core' },
    { q: 'When does the API language matter for performance?', a: '<p>Not for DataFrame/SQL operators: same plan. It matters for user functions: Python UDFs and RDD transformations in Python cost serialization and run in a separate process. Scala/Java UDFs run in the JVM but are still opaque to Catalyst (no pushdown).</p>', lvl: 'core' },
    { q: 'Dataset vs DataFrame in Java/Scala?', a: '<p><code>Dataset&lt;T&gt;</code> gives compile-time types and lambdas on objects, at the cost of (de)serializing to <code>T</code> for typed operations like <code>map</code>, which Catalyst can’t see into. <code>Dataset&lt;Row&gt;</code> with column expressions is usually faster. Python only has DataFrames.</p>', lvl: 'deep' },
    { q: 'What JVM tuning habits carry over, and which don’t?', a: '<p>Carry over: watch GC time, avoid huge heaps, understand off-heap memory, read thread dumps (Executors tab) for stuck tasks. Don’t: micro-tune JIT flags, rely on object pooling or in-heap caches, or size for one big JVM. Spark’s own memory manager and the data layout matter more than GC flags.</p>', lvl: 'core' },
    { q: 'How do you call an external service from Spark without overloading it?', a: '<p>Use <code>mapPartitions</code>/<code>foreachPartition</code>: one client per partition, batch requests, limit concurrency with the number of partitions (<code>repartition(n)</code>). Handle retries idempotently, because tasks can be retried and speculatively executed.</p>', lvl: 'deep' },
    { q: 'What are pandas UDFs and Arrow-optimised UDFs?', a: '<p>pandas UDFs (<code>@pandas_udf</code>) receive whole Arrow batches as pandas Series/DataFrames, so the per-row overhead vanishes and you can use vectorised NumPy/pandas code. Spark 3.5 added Arrow-optimised regular Python UDFs (<code>useArrow=True</code> or <code>spark.sql.execution.pythonUDF.arrow.enabled</code>). Built-ins remain fastest.</p>', lvl: 'core' },
    { q: 'How do you package a Java Spark job?', a: '<p>A JAR with your code and non-Spark dependencies; Spark itself as <code>provided</code>. Shade conflicting libraries. Submit with <code>spark-submit --class com.acme.Job app.jar</code>, or as a Databricks job/EMR step/Kubernetes SparkApplication. Match the Scala binary version of any Scala libraries.</p>', lvl: 'core' },
    { q: 'Can you use Spring inside a Spark job?', a: '<p>On the driver, yes (configuration, wiring). On executors, beans aren’t shared: each executor JVM would need its own context, and closures must not capture beans. Most teams keep executor code plain and static, and use Spring only in the driver or not at all.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Java: the same pipeline as PySpark', lang: 'java', code: `import static org.apache.spark.sql.functions.*;
import org.apache.spark.sql.*;

public class DailyRevenue {
  public static void main(String[] args) {
    SparkSession spark = SparkSession.builder().appName("daily-revenue").getOrCreate();
    Dataset<Row> orders = spark.read().format("delta").table("silver.orders");
    Dataset<Row> out = orders
        .filter(col("status").equalTo("paid"))
        .groupBy(to_date(col("ts")).alias("day"), col("country"))
        .agg(sum("amount").alias("revenue"));
    out.write().mode(SaveMode.Overwrite).saveAsTable("gold.daily_revenue");
    spark.stop();
  }
}`, note: 'Build with Spark as <code>provided</code>; Java 17+ for Spark 4.0.' },
    { title: 'Python: built-in, pandas UDF, per-partition client', lang: 'python', code: `import pandas as pd
from pyspark.sql import functions as F

df = df.withColumn("email", F.lower(F.trim("email")))          # built-ins: JVM speed

@F.pandas_udf("double")
def score(amount: pd.Series, age: pd.Series) -> pd.Series:      # Arrow batches
    return (amount.clip(upper=1000) / 1000) * (age.fillna(0) / 100)

df = df.withColumn("score", score("amount", "age"))

def push(rows):                                                  # one client per partition
    client = make_http_client()
    for batch in chunked(rows, 500):
        client.post_bulk([r.asDict() for r in batch])

df.repartition(16).foreachPartition(push)                        # 16 = max concurrency` }
  ]
});

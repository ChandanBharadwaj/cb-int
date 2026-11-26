IA.register({
  track: 'spark',
  slug: 'udfs',
  title: 'UDFs: Python, pandas and built-ins',
  tagline: 'A Python UDF makes the JVM <b>ship your data to a Python process and back</b>, and hides your logic from the optimizer. pandas UDFs make the trip cheaper. Built-in functions avoid it entirely.',
  tldr: {
    problem: 'You need custom logic in a column. Writing a plain Python function and wrapping it in <code>@udf</code> works on a laptop and then makes the production job 5–50× slower.',
    model: 'Spark executors are JVMs. A Python UDF runs in a <b>separate Python worker</b>: rows are serialized (pickle, or Arrow), sent over a socket, processed, and sent back. A pandas UDF moves <b>Arrow batches</b> and calls your function once per batch. Built-ins run inside generated JVM code.',
    hook: '“How do you speed up a slow PySpark job?” First question: is there a Python UDF? Replace it with built-ins, or at least a pandas UDF.',
    facts: [
      { v: '1 call / row', l: 'for a classic Python UDF; a pandas UDF gets one call per Arrow batch' },
      { v: '10,000', l: 'default <code>spark.sql.execution.arrow.maxRecordsPerBatch</code>: rows per Arrow batch sent to a pandas UDF' },
      { v: '3.5', l: 'Spark version that added Arrow-optimized Python UDFs (<code>useArrow=True</code>), opt-in by default' }
    ]
  },
  intro: {
    what: 'A <b>UDF</b> (user-defined function) lets you run your own code on each value of a column. Spark already has hundreds of <b>built-in functions</b> in <code>pyspark.sql.functions</code> (string, date, math, arrays, JSON, regex). Built-ins run in the JVM and the optimizer understands them. Your Python code can’t run in the JVM, so Spark starts Python worker processes next to each executor and streams data to them.',
    analogy: { icon: '🌐', title: 'Calling a translator for every sentence', text: 'Your team speaks Java. One task needs Python. A Python UDF is phoning a translator for <i>every sentence</i>: dial, read it out, wait, write the answer down. A pandas UDF sends the translator a whole chapter by email and gets the chapter back. A built-in function is a team member who already speaks the language: no call at all.' },
    steps: [
      { t: 'Try a built-in first', d: 'Most “I need a UDF” cases are covered: <code>regexp_extract</code>, <code>when</code>, <code>transform</code> for arrays, <code>from_json</code>, <code>date_trunc</code>…', code: 'df.withColumn("domain", F.regexp_extract("email", r"@(.+)$", 1))' },
      { t: 'A plain Python UDF', d: 'Declare the return type. Handle <code>None</code>.', code: '@F.udf(returnType="int")\ndef score(s):\n    return None if s is None else len(set(s))\ndf.withColumn("score", score("text"))' },
      { t: 'A pandas UDF (vectorized)', d: 'Needs <code>pyarrow</code>. Your function gets a <code>pd.Series</code> and returns one of the same length.', code: 'import pandas as pd\n@F.pandas_udf("double")\ndef to_eur(amt: pd.Series) -> pd.Series:\n    return amt * 0.92' },
      { t: 'Use it in SQL', d: 'Register under a name.', code: 'spark.udf.register("score", score)\nspark.sql("SELECT score(text) FROM docs")' }
    ],
    terms: [
      ['UDF', 'User-defined function applied per value (or per batch) of a column.'],
      ['Python worker', 'A separate <code>python</code> process started by the executor to run your code.'],
      ['Arrow', 'Apache Arrow: a columnar in-memory format both JVM and pandas understand, so batches move with little conversion.'],
      ['pandas UDF', 'A vectorized UDF (<code>@pandas_udf</code>) that receives and returns pandas objects.'],
      ['opaque', 'The optimizer can’t see inside a UDF: no pushdown through it, no constant folding, no codegen.']
    ]
  },
  visual: {
    title: 'Inside one executor',
    caption: 'Pick the kind of function and press Play. Watch what crosses the gap between the JVM and the Python worker, and count the Python calls in the stats.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Simulation: per-row vs per-batch', code: `# SIMULATION: cost of crossing a process boundary per row vs per batch.
# Spark pickles rows to a Python worker (classic UDF) or sends Arrow batches (pandas UDF).
import pickle, time

rows = [f"user{i}@example.com" for i in range(100_000)]

def per_row():
    out = []
    for r in rows:                       # serialize, call, serialize back: per row
        v = pickle.loads(pickle.dumps(r))
        out.append(pickle.loads(pickle.dumps(v.upper())))
    return out

def per_batch(n=10_000):
    out = []
    for i in range(0, len(rows), n):     # one round trip per batch
        batch = pickle.loads(pickle.dumps(rows[i:i + n]))
        out.extend(pickle.loads(pickle.dumps([v.upper() for v in batch])))
    return out

for f in (per_row, per_batch):
    t = time.perf_counter(); f(); print(f.__name__, round(time.perf_counter() - t, 3), "s")`, note: 'Only the serialization pattern is modelled. Real pandas UDFs also vectorize the work itself with numpy.' },
      { label: 'Simulation: wrong return type → NULL', code: `# SIMULATION of a classic gotcha: a UDF declared "int" that returns a float.
# Spark does not cast the Python value; a non-matching type becomes NULL (non-Arrow UDF).
def spark_like_udf(f, declared):
    def run(v):
        r = f(v)
        return r if isinstance(r, declared) else None
    return run

half = spark_like_udf(lambda x: x / 2, int)   # / returns float
print([half(x) for x in [2, 4, 5]])             # [None, None, None]
half_ok = spark_like_udf(lambda x: x // 2, int)
print([half_ok(x) for x in [2, 4, 5]])` }
    ]
  },
  gotchas: [
    { trap: 'Declared type doesn’t match → silent NULLs', code: `@F.udf("int")\ndef half(x): return x / 2      # returns float\ndf.select(half("n")).show()   # all NULL, no error`, why: 'For classic (pickle) Python UDFs Spark doesn’t coerce the returned Python object to the declared type; a mismatch becomes NULL. The default return type, if you omit it, is <code>StringType</code>.', fix: 'Always declare the type and return exactly that Python type (<code>int</code>, <code>float</code>, <code>str</code>, <code>datetime</code>). Test UDFs on small data with assertions on null counts.' },
    { trap: 'The UDF gets NULL even though you filtered', code: `df.filter(F.col("s").isNotNull() & (my_udf("s") > 0))   # my_udf may still see None`, why: 'Spark does not guarantee the evaluation order of sub-expressions, and does not short-circuit <code>AND</code> for you. The optimizer may reorder or combine predicates.', fix: 'Make every UDF null-safe inside, or use <code>F.when(F.col("s").isNotNull(), my_udf("s"))</code>.' },
    { trap: 'Loading a model per row', code: `@F.udf("double")\ndef predict(x):\n    model = joblib.load("/dbfs/model.pkl")   # every row!\n    return float(model.predict([[x]])[0])`, why: 'The function body runs for every value.', fix: 'Use an iterator pandas UDF: load once per task, then process batches.', },
    { trap: 'A UDF blocks filter pushdown', why: '<code>filter(my_udf("country") == "DE")</code> can’t be pushed into the Parquet scan, so Spark reads every row group. Catalyst can’t reason about what the UDF does.', fix: 'Express filters with built-ins (<code>F.upper("country") == "DE"</code>) so they appear in <code>PushedFilters</code>. Apply UDFs after the filters.' },
    { trap: 'Non-deterministic UDF called twice', why: 'Spark assumes UDFs are deterministic and may evaluate one more than once (for example when an expression is duplicated by the optimizer) or re-run it on task retry. A random or time-based UDF then gives inconsistent values.', fix: 'Mark it: <code>my_udf.asNondeterministic()</code>, and prefer built-ins such as <code>F.rand(seed)</code> or <code>F.uuid()</code>.' },
    { trap: 'Python worker memory kills the executor', why: 'Python workers live outside the JVM heap. pandas UDFs hold whole batches (and <code>applyInPandas</code> a whole group) in pandas memory. The container exceeds its limit and YARN or Kubernetes kills it.', fix: 'Leave room in <code>spark.executor.memoryOverhead</code> or set <code>spark.executor.pyspark.memory</code>; lower <code>maxRecordsPerBatch</code>; avoid giant groups in <code>applyInPandas</code>.' }
  ],
  scenarios: [
    { title: 'Enrichment job went from 8 minutes to 3 hours',
      symptom: 'After a “small cleanup” PR, the daily enrichment job takes 3 hours. CPU on executors is high, but the Spark UI shows modest shuffle and I/O.',
      diagnose: `enriched.explain()\n# +- BatchEvalPython [normalize_phone(phone#12)]   <- new\n# Spark UI → SQL tab: most time in the BatchEvalPython node`,
      cause: 'A regex-based phone normalizer was rewritten as a Python UDF for readability. 1.2 billion rows now cross the JVM↔Python boundary one by one.',
      fix: 'Rewrite with built-ins. If logic is truly impossible in built-ins, use a pandas UDF.',
      fixCode: `digits = F.regexp_replace("phone", r"[^0-9+]", "")\nenriched = df.withColumn("phone_e164",\n    F.when(digits.startswith("00"), F.concat(F.lit("+"), digits.substr(3, 20)))\n     .otherwise(digits))` },
    { title: 'ML scoring job OOM-killed on Kubernetes',
      symptom: 'Pods are terminated with <code>OOMKilled</code>, but the JVM heap graphs look fine and there is no Java <code>OutOfMemoryError</code>.',
      diagnose: `kubectl describe pod spark-exec-7   # Reason: OOMKilled\n# executor memory 8g, memoryOverhead default (10% → ~820m)\n# pandas UDF loads a 1.5 GB model per Python worker`,
      cause: 'Each Python worker loaded the model, and there are several workers per executor (one per task slot). That memory is outside the heap and exceeded the pod’s overhead allowance.',
      fix: 'Load once per worker via an iterator UDF, reduce concurrent Python tasks per executor, and size the overhead.',
      fixCode: `from typing import Iterator\n@F.pandas_udf("double")\ndef score(batches: Iterator[pd.Series]) -> Iterator[pd.Series]:\n    model = load_model()           # once per task, not per row\n    for s in batches:\n        yield pd.Series(model.predict(s.to_frame()))\n\n# spark.executor.memoryOverhead=3g  (or spark.executor.pyspark.memory)` }
  ],
  puzzles: [
    { kind: 'concept', q: 'For <code>df.withColumn("u", my_udf("name"))</code> where <code>my_udf</code> is a classic <code>@F.udf</code>, how many times is the Python function called for 1 million rows?', options: ['Once', 'Once per partition', 'Once per row: 1,000,000', 'Once per Arrow batch: ~100'], answer: 2, explain: 'Classic UDFs are row-at-a-time. Rows are sent in pickled batches, but your function is invoked once per value. A pandas UDF would be called once per batch (~100 with 10,000 rows per batch).' },
    { kind: 'concept', q: 'Where does a Python UDF actually run?', options: ['On the driver', 'Inside the executor JVM via Jython', 'In a separate Python worker process on the executor host', 'In the cluster manager'], answer: 2, explain: 'Executors start <code>pyspark.worker</code> processes and stream data over a local socket. Nothing runs on the driver except planning.' },
    { kind: 'concept', q: '<code>@F.udf("int") def f(x): return x * 1.5</code>. What is <code>f</code> applied to 2?', options: ['3', '3.0', 'NULL', 'TypeError raised'], answer: 2, explain: 'The function returns a Python float, but the declared type is int. For a classic UDF, Spark returns NULL for the mismatch instead of casting or failing.' },
    { kind: 'concept', q: 'Which plan node indicates a classic Python UDF in <code>explain()</code>?', options: ['ArrowEvalPython', 'BatchEvalPython', 'HashAggregate', 'WholeStageCodegen'], answer: 1, explain: '<code>BatchEvalPython</code> for classic (pickled) UDFs; <code>ArrowEvalPython</code> for pandas UDFs and Arrow-optimized UDFs.' },
    { kind: 'concept', q: 'You need to load a 500 MB model once per task and score batches. Which API fits best?', options: ['A classic @udf that loads the model', 'A Series → Series pandas UDF', 'An Iterator[pd.Series] → Iterator[pd.Series] pandas UDF', 'collect() and score on the driver'], answer: 2, explain: 'The iterator variant runs setup once, then loops over batches. A Series → Series pandas UDF would run its body (including the load) for every batch.' },
    { kind: 'concept', q: 'Which change is most likely to give the biggest speed-up for a UDF that lowercases and trims emails?', options: ['Increase executor memory', 'Switch to a pandas UDF', 'Replace it with <code>F.lower(F.trim("email"))</code>', 'Repartition to 1,000 partitions'], answer: 2, explain: 'Built-ins stay in the JVM, are code-generated and keep the optimizer informed. pandas UDFs help, but built-ins avoid the Python trip altogether.' }
  ],
  interview: [
    { q: 'Why are Python UDFs slow?', a: '<p>Executors are JVMs. For each batch of rows Spark converts from its internal binary format, pickles the values, sends them to a Python worker, runs the interpreter once per value, pickles results back and converts them again. Plus the UDF is opaque: no predicate pushdown through it, no codegen, no constant folding.</p>', lvl: 'core' },
    { q: 'What is a pandas UDF and why is it faster?', a: '<p>A vectorized UDF: Spark sends columns as <b>Arrow</b> record batches, which pandas can read with little copying, and calls your function once per batch with a <code>pd.Series</code>. Work inside it is typically numpy-vectorized. Requires <code>pyarrow</code>. Types are declared with Python type hints (Spark 3.0+ style).</p>', lvl: 'core' },
    { q: 'Name the pandas UDF / pandas function variants.', a: '<ul><li><code>Series → Series</code>: column transform.</li><li><code>Iterator[Series] → Iterator[Series]</code>: expensive setup once per task.</li><li><code>Series → scalar</code>: grouped aggregate, usable in <code>groupBy().agg</code> and windows.</li><li><code>groupBy().applyInPandas(f, schema)</code>: whole group as a DataFrame (group must fit in memory).</li><li><code>mapInPandas</code> / <code>mapInArrow</code> (3.3+): iterator of batches over the whole DataFrame.</li></ul>', lvl: 'deep' },
    { q: 'What changed for Python UDFs in Spark 3.5 and 4.0?', a: '<p>3.5 added <b>Arrow-optimized Python UDFs</b> (<code>useArrow=True</code> or <code>spark.sql.execution.pythonUDF.arrow.enabled</code>), which keep row-at-a-time semantics but use Arrow for transfer, and <b>Python UDTFs</b> (table functions returning many rows). 4.0 added the Python Data Source API and further PySpark/Spark Connect work. Check the release notes for the exact defaults in your version.</p>', lvl: 'deep' },
    { q: 'When is a UDF still the right choice?', a: '<p>When the logic needs a library Spark doesn’t have (ML model inference, a parser, a geo library, tokenization) or is truly impossible to express with built-ins and higher-order functions (<code>transform</code>, <code>filter</code>, <code>aggregate</code>). Then: pandas UDF, iterator style for heavy setup, apply after filters, and keep it null-safe.</p>', lvl: 'core' },
    { q: 'Is a Scala/Java UDF better than a Python UDF?', a: '<p>Yes for speed: it runs in the executor JVM, so there is no serialization to Python. It is still opaque to the optimizer. From PySpark you can register one with <code>spark.udf.registerJavaFunction("name", "com.acme.MyUdf", IntegerType())</code>. A Java <code>UDF1&lt;String,Integer&gt;</code> is a natural fit for a Java team.</p>', lvl: 'deep' },
    { q: 'Why must UDFs be deterministic and null-safe?', a: '<p>Spark assumes determinism: it may evaluate an expression more than once and re-runs tasks on failure or speculation. Evaluation order of sub-expressions isn’t guaranteed, so a preceding <code>isNotNull</code> filter doesn’t protect the UDF. Use <code>asNondeterministic()</code> when needed and handle <code>None</code>.</p>', lvl: 'deep' },
    { q: 'How do you find out a UDF is the bottleneck?', a: '<p><code>explain()</code> shows <code>BatchEvalPython</code>/<code>ArrowEvalPython</code>; the SQL tab of the Spark UI shows time per node; executor CPU is high with python processes busy. A quick test: replace the UDF with a constant and compare run time.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Built-ins replacing typical UDFs', lang: 'python', code: `from pyspark.sql import functions as F

df = (df
  .withColumn("email", F.lower(F.trim("email")))
  .withColumn("domain", F.split("email", "@").getItem(1))
  .withColumn("tier", F.when(F.col("spend") > 1000, "gold")
                       .when(F.col("spend") > 100, "silver").otherwise("bronze"))
  # higher-order functions on arrays: no UDF needed
  .withColumn("tags", F.transform("tags", lambda t: F.lower(t)))
  .withColumn("big_items", F.filter("items", lambda i: i["qty"] > 10))
  .withColumn("payload", F.from_json("raw", "struct<id:long,kind:string>")))` , note: 'The lambdas in <code>F.transform</code> build Catalyst expressions; they do not run Python per element.' },
    { title: 'Grouped pandas: per-customer model', lang: 'python', code: `import pandas as pd

def fit_trend(pdf: pd.DataFrame) -> pd.DataFrame:
    pdf = pdf.sort_values("day")
    slope = pdf["amt"].diff().mean()
    return pd.DataFrame({"cid": [pdf["cid"].iloc[0]], "slope": [slope]})

trends = daily.groupBy("cid").applyInPandas(fit_trend, schema="cid long, slope double")
# each group must fit in one Python worker's memory` },
    { title: 'Java UDF callable from PySpark', lang: 'java', code: `package com.acme.udf;

import org.apache.spark.sql.api.java.UDF1;

public class NormalizeSku implements UDF1<String, String> {
  @Override public String call(String s) {
    if (s == null) return null;
    return s.trim().toUpperCase().replace(" ", "-");
  }
}
// PySpark (jar on the classpath):
//   spark.udf.registerJavaFunction("normalize_sku", "com.acme.udf.NormalizeSku", "string")
//   df.selectExpr("normalize_sku(sku)")`, note: 'Runs inside the executor JVM: no Python worker, no pickling.' }
  ]
});

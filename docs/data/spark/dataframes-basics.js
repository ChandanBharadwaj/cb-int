IA.register({
  track: 'spark',
  slug: 'dataframes-basics',
  title: 'DataFrame basics',
  tagline: 'A DataFrame is a <b>distributed table with a schema</b>. Every method returns a <b>new</b> DataFrame describing a query; <code>show()</code>, <code>count()</code> or <code>write</code> runs it.',
  tldr: {
    problem: 'Coming from Java and SQL, PySpark looks familiar but bites: <code>and</code> instead of <code>&amp;</code> throws, <code>withColumn</code> in a loop makes plans explode, and <code>df.count()</code> as a “quick check” rereads the whole lake.',
    model: 'A DataFrame is like a SQL view, not a Java <code>List</code>: an immutable, lazily evaluated query plan with a schema. Columns are expressions (<code>F.col("amount") * 2</code>), not values. The Catalyst optimiser rewrites the whole chain before running it.',
    hook: '“What’s the difference between a DataFrame and a Dataset?” In Scala/Java, <code>DataFrame = Dataset&lt;Row&gt;</code>; a typed <code>Dataset&lt;Order&gt;</code> adds compile-time types. Python only has DataFrames.',
    facts: [
      { v: '20 rows', l: '<code>show()</code> prints 20 rows by default and truncates cells to 20 characters' },
      { v: 'case-insensitive', l: 'column names resolve case-insensitively by default (<code>spark.sql.caseSensitive=false</code>)' },
      { v: '3.3+', l: '<code>withColumns({...})</code> adds many columns in one projection (<code>withColumnsRenamed</code> in 3.4+)' }
    ]
  },
  intro: {
    what: 'A <b>DataFrame</b> is a table: rows and named, typed columns, like a Postgres table or a pandas DataFrame. The difference is that a Spark DataFrame is split across many machines and isn’t computed until you ask for a result. You build it up step by step: pick columns, filter rows, add new columns.',
    analogy: { icon: '🗺️', title: 'Directions, not the trip', text: 'Each method adds a line to a set of driving directions (“turn left, then right”). Nobody moves until you say “go” (an action). Because the navigator sees all the directions first, it can find shortcuts: that’s the optimiser.' },
    steps: [
      { t: 'Create one', d: 'From Python data (for tests) or by reading files or tables.', code: 'df = spark.createDataFrame(\n    [(1, "DE", 120.0), (2, "FR", 80.0)],\n    schema="id INT, country STRING, amount DOUBLE")\norders = spark.read.parquet("s3://lake/orders/")' },
      { t: 'Look at the schema', d: 'Column names and types. Cheap: no data is read for Parquet or an explicit schema.', code: 'df.printSchema()\ndf.columns      # [\'id\', \'country\', \'amount\']\ndf.dtypes' },
      { t: 'Select and filter', d: 'Like <code>SELECT</code> and <code>WHERE</code>. Use <code>F.col</code> for expressions.', code: 'from pyspark.sql import functions as F\nbig = df.select("id", "amount").filter(F.col("amount") > 100)' },
      { t: 'Add columns', d: '<code>withColumn(name, expression)</code> returns a new DataFrame with the column added or replaced.', code: 'df2 = df.withColumn("amount_eur", F.col("amount") * 0.92)' },
      { t: 'Run it', d: 'Actions execute the plan: <code>show()</code>, <code>count()</code>, <code>collect()</code>, <code>write…</code>', code: 'df2.show()' }
    ],
    terms: [
      ['DataFrame', 'An immutable, distributed table with a schema; a lazily evaluated query.'],
      ['schema', 'The list of columns with names, types and nullability. A <code>StructType</code> of <code>StructField</code>s.'],
      ['Column', 'An expression such as <code>F.col("a") + 1</code>. Evaluated per row, inside the JVM.'],
      ['Row', 'One record. <code>collect()</code> returns a Python list of <code>Row</code> objects.'],
      ['Catalyst', 'Spark SQL’s optimiser: rewrites the plan (push filters down, prune columns) before execution.'],
      ['F', 'The usual alias: <code>from pyspark.sql import functions as F</code>. Hundreds of built-in functions.']
    ]
  },
  visual: {
    title: 'Build a DataFrame pipeline',
    caption: 'Step through read → select → filter → withColumn. Each box is a new immutable DataFrame with its schema. Watch Catalyst optimise the plan before <code>show()</code> finally runs it.'
  },
  gotchas: [
    { trap: 'Python <code>and</code>/<code>or</code>/<code>not</code> on columns', code: `df.filter(F.col("a") > 1 and F.col("b") < 5)       # ValueError
df.filter((F.col("a") > 1) & (F.col("b") < 5))     # ✓
df.filter(~F.col("deleted"))                        # NOT`, why: 'Python can’t overload <code>and</code>; it tries to turn a Column into a bool. <code>&amp;</code> and <code>|</code> bind tighter than <code>&gt;</code>, so parentheses are required.', fix: 'Use <code>&amp;</code>, <code>|</code>, <code>~</code> with parentheses, or a SQL string: <code>df.filter("a &gt; 1 AND b &lt; 5")</code>.' },
    { trap: 'Forgetting DataFrames are immutable', code: `df.withColumn("vat", F.col("amount") * 0.19)   # result thrown away
df.show()                                       # no vat column`, why: 'Every method returns a new DataFrame. Nothing modifies <code>df</code> in place.', fix: 'Reassign: <code>df = df.withColumn(...)</code>, or chain calls.' },
    { trap: '<code>withColumn</code> in a loop', code: `for c in cols:                       # 300 columns
    df = df.withColumn(c, F.trim(c))   # 300 nested projections`, why: 'Each call adds a projection to the plan. Hundreds of them make analysis slow and can cause <code>StackOverflowError</code> on huge plans.', fix: 'Build all expressions and apply them once: <code>df.select([F.trim(c).alias(c) for c in cols])</code>, or <code>df.withColumns({...})</code> (3.3+).' },
    { trap: 'Comparing to <code>None</code> with <code>==</code>', code: `df.filter(F.col("email") == None)   # always 0 rows
df.filter(F.col("email").isNull())  # ✓`, why: 'This becomes SQL <code>email = NULL</code>, which is NULL (unknown) for every row, exactly as in Postgres.', fix: 'Use <code>isNull()</code> / <code>isNotNull()</code>, or <code>eqNullSafe</code> for null-safe equality.' },
    { trap: '<code>count()</code> or <code>show()</code> as a “quick check” everywhere', why: 'Each is an action that runs the whole plan from the source. Sprinkling them through a pipeline multiplies work.', fix: 'Debug on a sample (<code>df.limit(1000)</code>), use <code>explain()</code> to inspect plans, and remove debug actions from production code.' },
    { trap: 'Ambiguous columns after a join', code: `a.join(b, a.id == b.id).select("id")   # AMBIGUOUS_REFERENCE
a.join(b, "id").select("id")            # ✓ one id column`, why: 'An expression join keeps both <code>id</code> columns.', fix: 'Join on column names (<code>on="id"</code> or a list) when keys share a name, or alias the DataFrames: <code>a.alias("a")</code> and <code>F.col("a.id")</code>.' },
    { trap: '<code>show()</code> hides long values', why: 'Cells are truncated to 20 characters, so a JSON blob or a trailing-space bug looks fine.', fix: '<code>df.show(n=5, truncate=False)</code> or <code>vertical=True</code> for wide rows.' }
  ],
  scenarios: [
    { title: 'Planning takes longer than running', symptom: 'A cleaning job over a 400-column table takes 15 minutes before the first task starts; sometimes the driver dies with <code>StackOverflowError</code>.', diagnose: 'Spark UI: no jobs for 15 min after start\ndriver thread dump: deep recursion in Catalyst analyzer rules\ncode: for c in df.columns: df = df.withColumn(c, ...)', cause: 'Hundreds of chained <code>withColumn</code> calls produced a very deep logical plan that the analyzer re-processes on every step.', fix: 'Replace the loop with one <code>select</code> of all transformed columns.', fixCode: `exprs = [F.trim(F.col(c)).alias(c) if t == "string" else F.col(c)
         for c, t in df.dtypes]
df = df.select(*exprs)` },
    { title: 'Report silently dropped all unknown regions', symptom: 'After a refactor, the “orders without region” dashboard shows 0 every day, though the source has thousands of such rows.', diagnose: 'df.filter(F.col("region") == None).count()        # 0\ndf.filter(F.col("region").isNull()).count()        # 18,412', cause: 'Equality with <code>None</code> compiles to <code>region = NULL</code>, which is never true.', fix: 'Use <code>isNull()</code>, and add a data test that asserts known counts on a fixture.', fixCode: `missing = df.filter(F.col("region").isNull())` },
    { title: 'A Java-style per-row loop', symptom: 'A notebook converting 50M rows with <code>for row in df.collect()</code> runs for an hour, then the driver OOMs.', cause: 'All rows were pulled into the driver and processed one at a time in Python.', fix: 'Express the logic with built-in column functions so it runs in parallel on executors.', fixCode: `# was: for row in df.collect(): out.append(row.price * row.qty if row.qty else 0)
df = df.withColumn("total",
        F.when(F.col("qty").isNotNull(), F.col("price") * F.col("qty")).otherwise(F.lit(0)))` }
  ],
  puzzles: [
    { kind: 'concept', q: 'After <code>df.withColumn("x", F.lit(1))</code> (result not assigned), what is in <code>df</code>?', options: ['The new column x', 'The original columns only; withColumn returned a new DataFrame that was discarded', 'An error', 'x only'], answer: 1, explain: 'DataFrames are immutable. You must reassign or chain.' },
    { kind: 'bug', q: 'What happens?', code: `df.filter(F.col("age") > 18 and F.col("country") == "DE")`, options: ['Works like SQL AND', 'Raises ValueError: cannot convert column into bool', 'Returns rows where age > 18 only', 'Returns all rows'], answer: 1, explain: 'Python’s <code>and</code> calls <code>bool()</code> on the Column, which PySpark forbids. Use <code>(…) &amp; (…)</code>.' },
    { kind: 'concept', q: 'How many rows does <code>df.show()</code> print by default?', options: ['10', '20', '100', 'All rows'], answer: 1, explain: 'Default <code>n=20</code>, and cell values are truncated to 20 characters unless <code>truncate=False</code>.' },
    { kind: 'bug', q: 'A table has 1,000 rows where <code>email</code> is NULL. What does this return?', code: `df.filter(F.col("email") == None).count()`, options: ['1000', '0', 'All rows', 'Error'], answer: 1, explain: 'It becomes <code>email = NULL</code>, which is NULL for every row, so no row passes the filter. Use <code>isNull()</code>.' },
    { kind: 'concept', q: 'Which call does NOT trigger a Spark job?', options: ['df.count()', 'df.show()', 'df.select("a").filter("a > 1")', 'df.write.parquet(path)'], answer: 2, explain: '<code>select</code> and <code>filter</code> are transformations; they only extend the plan.' },
    { kind: 'concept', q: 'You read Parquet and immediately call <code>df.printSchema()</code>. What does Spark read?', options: ['All the data', 'Only file metadata (footers / schema), not the rows', 'Nothing at all, ever', 'A 1% sample'], answer: 1, explain: 'Parquet stores its schema in the file footer, so Spark only needs metadata. CSV with <code>inferSchema=True</code> would need to scan data.' },
    { kind: 'concept', q: 'In Scala/Java, what is a DataFrame?', options: ['A separate class unrelated to Dataset', '<code>Dataset&lt;Row&gt;</code>', 'An RDD of arrays', 'A Hive table'], answer: 1, explain: 'Since 2.0, DataFrame is an alias for <code>Dataset[Row]</code> in Scala (<code>Dataset&lt;Row&gt;</code> in Java). Typed Datasets use encoders for your classes.' },
    { kind: 'concept', q: 'What is the most efficient way to apply <code>trim</code> to 200 string columns?', options: ['A loop of withColumn', 'One select with a list comprehension of expressions (or withColumns)', 'collect() and trim in Python', 'A Python UDF'], answer: 1, explain: 'One projection keeps the plan small and all work in the JVM. Loops of withColumn bloat the plan; UDFs and collect move data into Python.' }
  ],
  interview: [
    { q: 'What is a Spark DataFrame?', a: '<p>An immutable, distributed collection of rows with a named, typed schema. It represents a logical query plan that is evaluated lazily and optimised by Catalyst, then executed by the Tungsten engine (code generation, off-heap binary rows).</p>', lvl: 'core' },
    { q: 'DataFrame vs RDD?', a: '<ul><li>DataFrame: schema-aware, optimised (predicate pushdown, column pruning, join selection), compact binary format, fast in Python because work stays in the JVM.</li><li>RDD: arbitrary objects and functions, no optimiser, Python lambdas run in Python workers.</li></ul><p>Prefer DataFrames; drop to RDDs only for what the API can’t express.</p>', lvl: 'core' },
    { q: 'DataFrame vs Dataset (Scala/Java)?', a: '<p><code>DataFrame = Dataset[Row]</code>: untyped rows, columns checked at analysis time. <code>Dataset[T]</code> uses an encoder for your class, giving compile-time types and lambdas over objects. Typed lambdas (<code>ds.filter(o -&gt; o.amount &gt; 100)</code>) are opaque to Catalyst, so column expressions are still faster.</p>', lvl: 'deep' },
    { q: 'select vs withColumn vs selectExpr?', a: '<p><code>select</code>: project a list of columns/expressions (replaces the column set). <code>withColumn</code>: add/replace one column, keep the rest. <code>selectExpr</code>: like select but with SQL strings: <code>df.selectExpr("id", "amount * 2 AS double_amt")</code>.</p>', lvl: 'core' },
    { q: 'How do you define a schema in PySpark?', a: '<p>Either a DDL string, <code>"id INT, name STRING, ts TIMESTAMP"</code>, or a <code>StructType([StructField("id", IntegerType(), False), …])</code>. Prefer explicit schemas for CSV/JSON in production: faster (no inference pass) and stable.</p>', lvl: 'core' },
    { q: 'What does <code>explain()</code> show?', a: '<p>The physical plan by default; <code>explain("extended")</code> adds parsed, analysed and optimised logical plans; <code>explain("formatted")</code> is the easiest to read. Look for <code>PushedFilters</code> in the scan, which columns are read, <code>Exchange</code> (shuffles) and join types.</p>', lvl: 'core' },
    { q: 'How is null handling different from Python?', a: '<p>Spark uses SQL three-valued logic: comparisons with NULL yield NULL, and <code>filter</code> drops rows where the condition is NULL. Use <code>isNull</code>, <code>coalesce</code>, <code>eqNullSafe</code> (<code>&lt;=&gt;</code> in SQL), and <code>na.fill</code>/<code>na.drop</code>.</p>', lvl: 'core' },
    { q: 'Why can a long chain of transformations be slow to plan?', a: '<p>Each transformation wraps the previous plan; the analyzer and optimiser walk the whole tree, repeatedly. Hundreds of <code>withColumn</code>s or very deep iterative plans (e.g. loops that union/join each iteration) blow up planning time. Fixes: single select, <code>withColumns</code>, or truncate lineage with <code>checkpoint()</code> / <code>localCheckpoint()</code>.</p>', lvl: 'deep' },
    { q: 'How do you get data from Spark into pandas safely?', a: '<p><code>df.toPandas()</code> collects to the driver, so filter/aggregate first. Enable Arrow (<code>spark.sql.execution.arrow.pyspark.enabled=true</code>) to make the conversion much faster. Spark 4 also supports <code>df.toArrow()</code>. For large data, write Parquet and read it with pandas/Polars instead.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'A first pipeline (PySpark)', lang: 'python', code: `from pyspark.sql import SparkSession, functions as F

spark = SparkSession.builder.appName("first-df").getOrCreate()

orders = spark.createDataFrame(
    [(1, "DE", 120.0, "2026-11-01"), (2, "FR", 80.0, "2026-11-02"), (3, "DE", None, "2026-11-02")],
    schema="id INT, country STRING, amount DOUBLE, day STRING")

result = (orders
    .withColumn("day", F.to_date("day"))
    .filter(F.col("amount").isNotNull() & (F.col("country") == "DE"))
    .withColumns({                                   # 3.3+
        "amount_eur": F.round(F.col("amount") * 0.92, 2),
        "is_big": F.col("amount") > 100})
    .select("id", "day", "amount_eur", "is_big"))

result.printSchema()
result.show(truncate=False)` },
    { title: 'Same pipeline (Java)', lang: 'java', code: `import static org.apache.spark.sql.functions.*;

Dataset<Row> result = orders
    .withColumn("day", to_date(col("day")))
    .filter(col("amount").isNotNull().and(col("country").equalTo("DE")))
    .withColumn("amount_eur", round(col("amount").multiply(0.92), 2))
    .select("id", "day", "amount_eur");
result.show(false);`, note: 'Java uses methods (<code>.and</code>, <code>.equalTo</code>, <code>.gt</code>) where Python overloads operators (<code>&amp;</code>, <code>==</code>, <code>&gt;</code>).' },
    { title: 'Typed Dataset (Java) vs Column expressions', lang: 'java', code: `public class OrderBean { private Integer id; private String country; private Double amount; /* getters + setters */ }

Dataset<Order> ds = orders.as(Encoders.bean(OrderBean.class));
ds.filter((FilterFunction<OrderBean>) o -> o.getAmount() > 100);   // opaque lambda: no pushdown
orders.filter(col("amount").gt(100));                               // optimisable`, note: '<code>Encoders.bean</code> needs a JavaBean (getters/setters). Prefer column expressions in hot paths.' }
  ]
});

IA.register({
  track: 'spark',
  slug: 'spark-sql',
  title: 'Spark SQL',
  tagline: 'SQL strings and DataFrame code are <b>two front ends to one engine</b>. Both become a Catalyst plan, get the same optimizations and run as the same bytecode. Pick whichever reads better.',
  tldr: {
    problem: 'Coming from Postgres you want to just write SQL. You need to know how a DataFrame becomes a table name (temp views), where tables really live (the catalog), and whether SQL is slower or faster than the API.',
    model: '<code>createOrReplaceTempView("t")</code> puts a <b>name for a plan</b> into the session catalog. <code>spark.sql(...)</code> parses SQL into the same logical plan the DataFrame API builds. From there: analyze → optimize → physical plan → codegen.',
    hook: '“Is spark.sql faster than the DataFrame API?” Neither. Compare <code>explain()</code>: same plan, same speed. Python UDFs are what change performance, not the syntax.',
    facts: [
      { v: '1 plan', l: 'SQL and DataFrame code go through the same Catalyst analyzer and optimizer; <code>explain()</code> shows identical physical plans' },
      { v: 'session', l: 'scope of a temp view; a global temp view lives in the <code>global_temp</code> database for the whole application' },
      { v: '4.0', l: 'Spark version where ANSI SQL mode (<code>spark.sql.ansi.enabled</code>) became the default' }
    ]
  },
  intro: {
    what: 'Spark SQL is the part of Spark that understands tables and SQL. You can register any DataFrame under a name and query it with ordinary SQL, or query real tables stored in a <b>catalog</b> (a metastore listing databases, tables and their file locations). The result of <code>spark.sql(...)</code> is again a DataFrame, so you can mix both styles freely.',
    analogy: { icon: '🗣️', title: 'Two languages, one translator', text: 'You can give directions in English or in Spanish. The driver translates both into the same route on the map before setting off. The language you spoke doesn’t change how fast the car drives. SQL and the DataFrame API are the two languages; Catalyst is the translator; the route is the physical plan.' },
    steps: [
      { t: 'Name a DataFrame', d: 'A temp view is visible only in this SparkSession and disappears when it ends.', code: 'orders = spark.read.parquet("data/orders/")\norders.createOrReplaceTempView("orders")' },
      { t: 'Query it with SQL', d: 'The result is a DataFrame, still lazy.', code: 'top = spark.sql("""\n  SELECT city, sum(amt) AS revenue\n  FROM orders WHERE status = \'paid\'\n  GROUP BY city ORDER BY revenue DESC LIMIT 10""")\ntop.show()' },
      { t: 'Mix with the API', d: 'Continue in Python, or embed SQL snippets in DataFrame code.', code: 'top.filter("revenue > 1000")\norders.selectExpr("cid", "amt * 0.92 AS amt_eur")\norders.withColumn("d", F.expr("date_trunc(\'day\', ts)"))' },
      { t: 'Look at the catalog', d: 'Databases, tables, views and functions this session can see.', code: 'spark.catalog.listTables()\nspark.sql("SHOW TABLES").show()' }
    ],
    terms: [
      ['temp view', 'A session-scoped name for a DataFrame’s plan. No data is stored.'],
      ['catalog / metastore', 'Where table names, schemas and file locations are recorded: in-memory, Hive Metastore, Unity Catalog, AWS Glue…'],
      ['managed table', 'Spark owns both metadata and files; <code>DROP TABLE</code> deletes the data.'],
      ['external table', 'Metadata only, pointing at files elsewhere; <code>DROP TABLE</code> leaves the files.'],
      ['Catalyst', 'Spark SQL’s optimizer: a tree of plan nodes rewritten by rules.']
    ]
  },
  visual: {
    title: 'From query text to tasks',
    caption: 'Start from SQL or from the DataFrame API, then Play or Step. The only difference is the first box: both join the same pipeline at the unresolved logical plan. The code panel shows the plan at each stage, as <code>explain(True)</code> prints it.'
  },
  gotchas: [
    { trap: 'Building SQL with f-strings', code: `spark.sql(f"SELECT * FROM users WHERE name = '{name}'")   # injection, quoting bugs\n\n# Spark 3.4+: named parameter markers\nspark.sql("SELECT * FROM users WHERE name = :name", args={"name": name})`, why: 'Exactly the same problem as string-concatenated JDBC SQL. A name with a quote breaks the query; a crafted one changes it.', fix: 'Use parameter markers (<code>args=</code>, Spark 3.4+), or the DataFrame API with <code>F.col("name") == name</code>, which never parses user input.' },
    { trap: 'A temp view is not a snapshot', code: `df.createOrReplaceTempView("v")\n# source files change …\nspark.sql("SELECT count(*) FROM v")   # re-reads the source`, why: 'The view stores a plan. Each query re-runs it from the source, like a Postgres (non-materialized) view.', fix: 'If you need a stable or reused result, <code>cache()</code> it, write it to a table, or use <code>CACHE TABLE v</code> (eager by default; <code>CACHE LAZY TABLE</code> is lazy).' },
    { trap: 'Temp view missing in another session or job', why: '<code>createOrReplaceTempView</code> is per SparkSession. A new session (<code>spark.newSession()</code>, another notebook, a Spark Connect client) cannot see it.', fix: 'For the same application use <code>createOrReplaceGlobalTempView</code> and query <code>global_temp.v</code>. Across jobs, write a real table to the catalog.' },
    { trap: 'DROP TABLE deleted the data', code: `df.write.saveAsTable("sales")            # managed: files in the warehouse dir\nspark.sql("DROP TABLE sales")            # files gone too\n\ndf.write.option("path", "s3://lake/sales").saveAsTable("sales")  # external`, why: 'Without a path, <code>saveAsTable</code> creates a <b>managed</b> table. Spark owns the files.', fix: 'Use external tables (explicit <code>path</code> / <code>LOCATION</code>) for data that must outlive its metadata.' },
    { trap: 'Spark 4.0: queries that “worked” now throw', code: `SELECT CAST('abc' AS INT);     -- 3.x: NULL   4.0 (ANSI): [CAST_INVALID_INPUT] error\nSELECT 2147483647 + 1;         -- 3.x: wraps  4.0: [ARITHMETIC_OVERFLOW]`, why: 'ANSI mode is the default in Spark 4.0. Invalid casts, overflow and division by zero raise errors instead of returning NULL or wrapping.', fix: 'Use <code>try_cast</code>, <code>try_divide</code>, <code>try_add</code> where NULL is the intended result. Set <code>spark.sql.ansi.enabled=false</code> only as a temporary migration step. See <a href="nulls-types-dates.html">Nulls, types &amp; dates</a>.' }
  ],
  scenarios: [
    { title: 'Nightly job deleted two years of history',
      symptom: 'After a refactor the nightly “rebuild staging table” step ran <code>DROP TABLE IF EXISTS events_raw</code>, and the underlying S3 prefix was empty afterwards.',
      diagnose: `spark.sql("DESCRIBE TABLE EXTENDED events_raw").filter("col_name = 'Type'").show()\n# Type  MANAGED`,
      cause: 'The table had been recreated with <code>saveAsTable</code> without a path, which made it managed in the warehouse location. Dropping a managed table deletes its files.',
      fix: 'Recreate it as an external table, restore from backup or versioned bucket, and guard destructive DDL in jobs.',
      fixCode: `spark.sql("""\nCREATE TABLE events_raw (id BIGINT, ts TIMESTAMP, payload STRING)\nUSING parquet LOCATION 's3://lake/events_raw/'""")` },
    { title: 'Report query broke on a customer named O’Brien',
      symptom: 'A self-service report failed with <code>[PARSE_SYNTAX_ERROR]</code> for one customer and returned other customers’ rows for a tester who typed <code>x\' OR \'1\'=\'1</code>.',
      diagnose: `spark.sql(f"SELECT * FROM orders WHERE customer = '{c}'")   # in the service`,
      cause: 'User input was concatenated into SQL text.',
      fix: 'Use parameter markers (Spark 3.4+) or the DataFrame API.',
      fixCode: `spark.sql("SELECT * FROM orders WHERE customer = :c", args={"c": c})\n# or\norders.filter(F.col("customer") == c)` }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which statement about <code>spark.sql("SELECT …")</code> vs the equivalent DataFrame code is true?', options: ['SQL is faster because it skips Python', 'The DataFrame API is faster because it skips parsing', 'They compile to the same optimized plan and run the same', 'SQL always runs on a single node'], answer: 2, explain: 'Both build a logical plan that Catalyst analyzes and optimizes. Parsing costs microseconds on the driver. Check with <code>explain()</code>.' },
    { kind: 'concept', q: 'A notebook registers <code>df.createOrReplaceTempView("v")</code>. A second SparkSession in the same application runs <code>SELECT * FROM v</code>. What happens?', options: ['It works', 'It fails: table or view not found', 'It returns an empty result', 'It works only if v was cached'], answer: 1, explain: 'Temp views are session-scoped. Use a global temp view (<code>global_temp.v</code>) to share within the application.' },
    { kind: 'concept', q: 'A column name typo (<code>SELECT amout FROM orders</code>) fails when?', options: ['When the first task reads data', 'During analysis, when spark.sql() is called, before any job', 'Only when an action runs', 'Never: the column is NULL'], answer: 1, explain: 'The analyzer resolves names eagerly when the DataFrame is created, so you get <code>[UNRESOLVED_COLUMN]</code> immediately, even though execution is lazy. (With Spark Connect, analysis can be deferred until the plan is sent to the server.)' },
    { kind: 'concept', q: 'You run <code>DROP TABLE t</code> on a table created with <code>df.write.saveAsTable("t")</code> (no path). What happens to the files?', options: ['Kept', 'Deleted', 'Moved to trash', 'Converted to an external table'], answer: 1, explain: 'No path means a managed table, so Spark deletes its files with the table.' },
    { kind: 'concept', q: 'On Spark 4.0 with default settings, what does <code>SELECT CAST(\'12a\' AS INT)</code> return?', options: ['12', 'NULL', 'An error ([CAST_INVALID_INPUT])', '0'], answer: 2, explain: 'ANSI mode is on by default in 4.0, so an invalid cast raises. In 3.x defaults it returned NULL. <code>try_cast</code> gives NULL in both.' },
    { kind: 'concept', q: 'Which optimization moves <code>WHERE status = \'paid\'</code> into the Parquet scan?', options: ['Column pruning', 'Predicate pushdown', 'Whole-stage codegen', 'Broadcast join'], answer: 1, explain: 'Predicate pushdown. In the physical plan it shows as <code>PushedFilters</code> on the <code>FileScan</code>; Parquet can then skip row groups using min/max statistics.' }
  ],
  interview: [
    { q: 'Walk through what happens when you call spark.sql(query).', a: '<ol><li>Parse (ANTLR) → unresolved logical plan.</li><li>Analyze: resolve tables, columns and functions against the catalog → analyzed plan (errors here are immediate).</li><li>Optimize: rule batches such as predicate pushdown, column pruning, constant folding, join reordering (with CBO) → optimized logical plan.</li><li>Physical planning: choose operators and join strategies; with AQE, re-optimize at stage boundaries.</li><li>Whole-stage codegen and execution as RDD tasks, when an action runs.</li></ol>', lvl: 'core' },
    { q: 'Temp view vs global temp view vs table?', a: '<p><b>Temp view</b>: a name for a plan, this SparkSession only. <b>Global temp view</b>: same, but shared by all sessions of the application, under <code>global_temp</code>. <b>Table</b>: registered in the catalog/metastore with data in files; survives the application and is visible to other jobs and engines.</p>', lvl: 'core' },
    { q: 'Managed vs external tables?', a: '<p>Managed: Spark controls the location (warehouse dir) and deletes files on <code>DROP</code>. External: you give <code>LOCATION</code>/<code>path</code>; <code>DROP</code> removes only metadata. Use external for shared lake data; managed is fine for scratch tables or when a platform (like Unity Catalog) manages lifecycle.</p>', lvl: 'core' },
    { q: 'When would you choose SQL over the DataFrame API, and vice versa?', a: '<p>SQL: analysts, long declarative queries, porting Postgres logic, readable CTEs. DataFrame API: composition in code (functions returning DataFrames), loops over columns, unit tests, IDE help, no string building. Performance is the same. Many teams use the API for pipelines and SQL for ad-hoc work.</p>', lvl: 'core' },
    { q: 'What is the catalog in Spark 3.x/4.x?', a: '<p>The <code>spark.catalog</code> API plus pluggable catalogs (DataSource V2 <code>CatalogPlugin</code>). The default session catalog is in-memory or Hive Metastore (<code>enableHiveSupport()</code>). Others plug in via <code>spark.sql.catalog.&lt;name&gt;</code>: Iceberg, Delta/Unity Catalog, Glue. That enables three-part names like <code>prod.sales.orders</code>.</p>', lvl: 'deep' },
    { q: 'How do you read a query plan in Spark?', a: '<p><code>df.explain()</code> shows the physical plan; <code>explain(True)</code> or <code>"extended"</code> shows parsed, analyzed, optimized and physical; <code>"formatted"</code> is easier to read; <code>"cost"</code> shows statistics. Read bottom-up: <code>FileScan</code> (check <code>PushedFilters</code> and columns), <code>Exchange</code> = shuffle, <code>BroadcastExchange</code>, join operators, <code>*(n)</code> = codegen stage. With AQE, the final plan is visible in the Spark UI after execution.</p>', fu: 'Why might explain() say isFinalPlan=false? (AQE decides the final plan at runtime.)', lvl: 'deep' },
    { q: 'How do you parameterise Spark SQL safely?', a: '<p>Spark 3.4+ supports parameter markers: <code>spark.sql("… WHERE id = :id", args={"id": 5})</code> (named), and Spark 3.5+ also accepts positional <code>?</code> markers with a list. Before that, use the DataFrame API for user-provided values. Never use f-strings with untrusted input.</p>', lvl: 'deep' },
    { q: 'What differs between Spark SQL and Postgres SQL that bites people?', a: '<ul><li>No indexes, constraints are not enforced; no transactions unless the table format (Delta/Iceberg) provides them.</li><li><code>UPDATE</code>/<code>DELETE</code>/<code>MERGE</code> only on table formats that support them.</li><li>Before 4.0 the defaults were non-ANSI (invalid casts → NULL).</li><li>Different functions: <code>DISTINCT ON</code> doesn’t exist; <code>date_format</code> uses Java-style patterns.</li><li><code>ORDER BY</code> in a subquery or view isn’t guaranteed to survive.</li></ul>', lvl: 'deep' },
    { q: 'How do you expose Spark tables to JDBC tools?', a: '<p>Through the Spark Thrift Server (HiveServer2 protocol), a Databricks SQL warehouse, or Spark Connect (3.4+) for programmatic clients. For a Spring Boot service, querying the lake via such an endpoint or via Trino is more common than embedding Spark.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'SQL and API in one pipeline', lang: 'python', code: `from pyspark.sql import functions as F, Window

spark.read.parquet("s3://lake/orders/").createOrReplaceTempView("orders")
spark.read.parquet("s3://lake/customers/").createOrReplaceTempView("customers")

monthly = spark.sql("""
  WITH paid AS (SELECT * FROM orders WHERE status = 'paid')
  SELECT c.country, date_trunc('month', p.ts) AS month, sum(p.amt) AS revenue
  FROM paid p JOIN customers c USING (cid)
  GROUP BY c.country, date_trunc('month', p.ts)
""")

# continue in Python: easier to test and compose
growth = monthly.withColumn("mom", F.col("revenue") / F.lag("revenue").over(
    Window.partitionBy("country").orderBy("month")) - 1)
growth.explain("formatted")` },
    { title: 'Java: same engine from the JVM', lang: 'java', code: `SparkSession spark = SparkSession.builder().appName("report").getOrCreate();
spark.read().parquet("s3://lake/orders/").createOrReplaceTempView("orders");

Dataset<Row> top = spark.sql(
    "SELECT city, sum(amt) AS revenue FROM orders WHERE status = :s GROUP BY city",
    Map.of("s", "paid"));          // named parameters, Spark 3.4+
top.explain("formatted");`, note: 'Java and Scala call Catalyst directly; PySpark calls the same JVM objects through Py4J (or Spark Connect).' },
    { title: 'Tables with explicit locations', lang: 'sql', code: `CREATE TABLE IF NOT EXISTS sales.orders (
  order_id BIGINT, cid BIGINT, amt DECIMAL(12,2), ts TIMESTAMP, day DATE)
USING parquet
PARTITIONED BY (day)
LOCATION 's3://lake/sales/orders/';     -- external: DROP keeps the files

DESCRIBE TABLE EXTENDED sales.orders;   -- Type: EXTERNAL, Location, Provider` }
  ]
});

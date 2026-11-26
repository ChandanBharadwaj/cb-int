IA.register({
  track: 'spark',
  slug: 'nulls-types-dates',
  title: 'Nulls, types & dates',
  tagline: 'Spark follows SQL <b>three-valued logic</b>, has its own type system, and stores timestamps as <b>instants rendered in a session time zone</b>. Most silent data bugs in Spark jobs live in these three places.',
  tldr: {
    problem: 'Rows vanish from filters, counts don’t add up, a cast quietly returns NULL (or, since 4.0, fails the job), and the daily report puts midnight orders on the wrong day.',
    model: 'NULL means unknown: comparisons with it are NULL and filters keep only <b>true</b>. Casts follow <b>ANSI</b> rules by default in Spark 4.0 (errors), legacy rules in 3.x (NULL). <code>TIMESTAMP</code> is an instant; <code>spark.sql.session.timeZone</code> decides how it is shown, parsed and truncated to dates.',
    hook: '“Why did <code>filter(col != \'x\')</code> drop my NULL rows?” Because <code>NULL != \'x\'</code> is NULL, not true.',
    facts: [
      { v: 'NULL ≠ NULL', l: '<code>NULL = NULL</code> is NULL; use <code>eqNullSafe</code> / <code>&lt;=&gt;</code> when NULL should equal NULL' },
      { v: '4.0', l: 'ANSI mode is the default from Spark 4.0: invalid casts, overflow and divide-by-zero raise errors instead of returning NULL' },
      { v: '3.4', l: 'Spark version that added <code>TIMESTAMP_NTZ</code>, a timestamp without time zone' }
    ]
  },
  intro: {
    what: 'Every DataFrame column has a <b>type</b> (int, long, decimal, string, date, timestamp, arrays, structs…) and may contain <b>null</b>, meaning “no value / unknown”. Spark’s rules are SQL rules, close to Postgres, not Python rules. Dates and times have an extra twist: a timestamp is a point in time, and you see it through a <b>session time zone</b>.',
    analogy: { icon: '🕰️', title: 'One moment, many wall clocks', text: 'A rocket launch happens at one instant. A clock in London, one in Berlin and one in New York show different times, and at midnight even different dates. Spark stores the instant; the session time zone is which wall clock you read it from. NULL is the launch time nobody wrote down: you can’t say whether it was before or after lunch.' },
    steps: [
      { t: 'Check for null the right way', d: '<code>== None</code> builds a comparison that is always NULL.', code: 'df.filter(F.col("email").isNull())\ndf.filter(F.col("email").isNotNull())' },
      { t: 'Replace nulls', d: '<code>coalesce</code> returns the first non-null value, like Postgres.', code: 'df.withColumn("city", F.coalesce("city", F.lit("unknown")))\ndf.fillna({"qty": 0})' },
      { t: 'Cast with intent', d: 'Use <code>try_cast</code> when bad input should become NULL.', code: 'df.withColumn("n", F.col("raw").cast("int"))        # 4.0: error on bad input\ndf.withColumn("n", F.expr("try_cast(raw AS INT)"))   # NULL on bad input' },
      { t: 'Pin the time zone', d: 'Otherwise it is whatever the driver JVM uses.', code: 'spark.conf.set("spark.sql.session.timeZone", "UTC")\ndf.withColumn("ts", F.to_timestamp("s", "yyyy-MM-dd HH:mm:ss"))' }
    ],
    terms: [
      ['null', 'Missing or unknown value. Not 0, not empty string, not NaN.'],
      ['three-valued logic', 'Boolean expressions can be true, false or NULL (unknown).'],
      ['ANSI mode', '<code>spark.sql.ansi.enabled</code>: SQL-standard errors for bad casts and arithmetic. Default true in 4.0.'],
      ['TIMESTAMP (LTZ)', 'An instant (µs since epoch, UTC), shown in the session time zone. Like Postgres <code>timestamptz</code>.'],
      ['TIMESTAMP_NTZ', 'A wall-clock date-time with no zone (3.4+). Like Postgres <code>timestamp</code>.']
    ]
  },
  visual: {
    title: 'Predict, then reveal',
    caption: 'Pick a topic and Step through. In the tables, guess each result before it appears. In the time-zone view, watch the same stored value land on a different <code>to_date()</code> when the session zone changes.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Simulation: three-valued logic', code: `# SIMULATION of SQL three-valued logic in plain Python (None = NULL)
def eq(a, b):      return None if a is None or b is None else a == b
def ne(a, b):      r = eq(a, b); return None if r is None else not r
def AND(a, b):
    if a is False or b is False: return False
    return None if a is None or b is None else True
def OR(a, b):
    if a is True or b is True: return True
    return None if a is None or b is None else False

rows = ["x", "y", None]
print("NULL = NULL      ->", eq(None, None))
print("NULL AND False   ->", AND(None, False))
print("NULL OR True     ->", OR(None, True))
# filter keeps only rows where the predicate is True
print("filter(c != 'x') ->", [c for c in rows if ne(c, "x") is True])   # None is dropped
print("null-safe        ->", [c for c in rows if not (c == "x")])       # what <=> gives` },
      { label: 'Simulation: session time zone', code: `# SIMULATION: one instant, different session time zones (Python zoneinfo)
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

instant = datetime(2024, 3, 30, 23, 30, tzinfo=timezone.utc)   # what TIMESTAMP stores
for tz in ["UTC", "Europe/Berlin", "America/New_York", "Asia/Kolkata"]:
    local = instant.astimezone(ZoneInfo(tz))
    print(f"{tz:18} show={local:%Y-%m-%d %H:%M}  to_date={local.date()}")`, note: 'Spark does the same conversion with java.time and <code>spark.sql.session.timeZone</code>. If zoneinfo data is missing in your Python build, the preset will fail.' }
    ]
  },
  gotchas: [
    { trap: '!= silently drops NULL rows', code: `df.filter(F.col("status") != "cancelled")        # NULL status rows vanish\ndf.filter(~F.col("status").eqNullSafe("cancelled"))  # keeps NULLs`, why: '<code>NULL != \'cancelled\'</code> is NULL, and <code>filter</code> keeps only true. Same as SQL <code>WHERE</code>.', fix: 'Use <code>eqNullSafe</code>, add <code>| F.col("status").isNull()</code>, or coalesce first. Same rule applies to <code>isin</code> and <code>NOT IN</code>.' },
    { trap: 'col == None never matches', code: `df.filter(F.col("email") == None)   # always NULL → 0 rows\ndf.filter(F.col("email").isNull())  # correct`, why: 'PySpark overloads <code>==</code> to build a SQL <code>=</code> expression, so it follows SQL rules, not Python’s.', fix: 'Use <code>isNull()</code> / <code>isNotNull()</code>. Linters often flag <code>== None</code>; here the lint is right for a different reason.' },
    { trap: 'NaN is not NULL', code: `df.filter(F.col("x").isNull())   # misses NaN\ndf.filter(F.isnan("x"))          # finds NaN`, why: 'For float/double, NaN is a value. Spark treats <code>NaN = NaN</code> as true and orders NaN above every other number, so it shows up as the <code>max</code>.', fix: 'Clean both: <code>F.when(F.isnan("x") | F.col("x").isNull(), None).otherwise(F.col("x"))</code>, or <code>na.fill</code>, which handles NaN in numeric columns.' },
    { trap: 'Spark 4.0 turned silent NULLs into failures', code: `F.col("amount_str").cast("decimal(12,2)")   # 3.x: NULL on '12,50'; 4.0: CAST_INVALID_INPUT`, why: 'ANSI mode is on by default in 4.0. A job that “worked” on 3.5 by hiding bad data now fails on the first bad value.', fix: 'Decide per column: <code>try_cast</code> / <code>try_to_timestamp</code> plus a quarantine of rows that became NULL, or fix the source. Don’t just turn ANSI off globally.' },
    { trap: 'Daily totals depend on the cluster', why: '<code>to_date(ts)</code>, <code>date_trunc</code>, <code>hour()</code> and parsing strings without an offset all use <code>spark.sql.session.timeZone</code>, which defaults to the driver JVM’s zone.', fix: 'Set the session time zone explicitly (usually UTC) in job config, and convert to a business zone deliberately: <code>F.from_utc_timestamp("ts", "Europe/Berlin")</code> before <code>to_date</code>.' },
    { trap: 'Date patterns: mm is minutes, MM is months', code: `F.to_date("d", "yyyy-mm-dd")   # wrong: minutes\nF.to_date("d", "yyyy-MM-dd")   # right`, why: 'Spark 3.0+ uses <code>java.time</code>-style patterns (<code>DateTimeFormatter</code>), not Postgres <code>to_char</code> patterns and not Python <code>strftime</code>.', fix: 'Use <code>yyyy-MM-dd HH:mm:ss</code>. Ambiguous or unsupported patterns raise <code>SparkUpgradeException</code> under the default <code>spark.sql.legacy.timeParserPolicy=EXCEPTION</code>; fix the pattern rather than switching to LEGACY.' },
    { trap: 'inferSchema guesses wrong', why: 'CSV <code>inferSchema</code> reads the data an extra time and picks types from what it sees: zip codes become ints (losing leading zeros), IDs overflow to double, a column with one bad value becomes string.', fix: 'Pass an explicit schema (DDL string or <code>StructType</code>) for production reads. See <a href="reading-writing.html">Reading &amp; writing data</a>.' }
  ],
  scenarios: [
    { title: 'Churn model lost 11% of customers overnight',
      symptom: 'The “active customers” input to a churn model dropped from 2.1M to 1.87M rows after a source system started sending <code>segment = NULL</code> for new sign-ups.',
      diagnose: `df.filter(F.col("segment").isNull()).count()   # 230k\n# job code\nactive = df.filter(F.col("segment") != "test")`,
      cause: '<code>NULL != \'test\'</code> is NULL, so every customer with a NULL segment was filtered out.',
      fix: 'Use null-safe comparison and add a row-count check on each pipeline stage.',
      fixCode: `active = df.filter(~F.col("segment").eqNullSafe("test"))\nassert active.count() >= 0.98 * df.count(), "unexpected drop"` },
    { title: 'Finance and BI disagree on yesterday’s revenue',
      symptom: 'The finance export (job on cluster A) and the BI dashboard (cluster B) differ by about 4% for each day, always on orders placed just before or after midnight.',
      diagnose: `spark.conf.get("spark.sql.session.timeZone")\n# cluster A: Etc/UTC     cluster B: Europe/Amsterdam`,
      cause: '<code>groupBy(to_date("ts"))</code> uses the session time zone. The two clusters had different JVM defaults, so late-evening orders fell on different days.',
      fix: 'Pin UTC in all jobs, and compute the business date explicitly in the business time zone.',
      fixCode: `spark.conf.set("spark.sql.session.timeZone", "UTC")\ndaily = orders.groupBy(\n    F.to_date(F.from_utc_timestamp("ts", "Europe/Amsterdam")).alias("biz_day")\n).agg(F.sum("amt"))` },
    { title: 'Upgrade to Spark 4.0 fails the ingest job',
      symptom: 'After moving from 3.5 to 4.0 the CSV ingest fails with <code>[CAST_INVALID_INPUT] The value \'n/a\' of the type "STRING" cannot be cast to "INT"</code>.',
      diagnose: `raw.filter(F.expr("try_cast(qty AS INT)").isNull() & F.col("qty").isNotNull()).show()`,
      cause: 'The job had been turning <code>\'n/a\'</code> into NULL for years without anyone knowing. ANSI mode, the 4.0 default, made it an error.',
      fix: 'Handle the bad values on purpose and route them to a quarantine table.',
      fixCode: `parsed = raw.withColumn("qty_i", F.expr("try_cast(qty AS INT)"))\nbad = parsed.filter(F.col("qty_i").isNull() & F.col("qty").isNotNull())\nbad.write.mode("append").saveAsTable("quarantine.orders_qty")` }
  ],
  puzzles: [
    { kind: 'concept', q: 'A column <code>c</code> has values <code>\'x\', \'y\', NULL</code>. How many rows does <code>df.filter(F.col("c") != "x")</code> return?', options: ['0', '1', '2', '3'], answer: 1, explain: 'Only <code>\'y\'</code>. <code>NULL != \'x\'</code> is NULL, and filter keeps only true.' },
    { kind: 'concept', q: 'What does <code>F.lit(None) == F.lit(None)</code> evaluate to in Spark?', options: ['true', 'false', 'NULL', 'An error'], answer: 2, explain: 'SQL equality with NULL is NULL. <code>eqNullSafe</code> (<code>&lt;=&gt;</code>) returns true.' },
    { kind: 'concept', q: 'On Spark 4.0 defaults, what does <code>SELECT 7 / 0</code> do?', options: ['Returns NULL', 'Returns Infinity', 'Raises [DIVIDE_BY_ZERO]', 'Returns 0'], answer: 2, explain: 'ANSI mode (default in 4.0) raises. In 3.x defaults it returned NULL. <code>try_divide(7, 0)</code> returns NULL in both.' },
    { kind: 'concept', q: 'In Spark SQL, what is <code>SELECT 7 / 2</code>?', options: ['3', '3.5', '4', 'Error'], answer: 1, explain: 'Spark’s <code>/</code> returns a fractional result (3.5), unlike Postgres integer division (3). Use <code>7 div 2</code> for 3.' },
    { kind: 'concept', q: '<code>ts</code> is a TIMESTAMP holding <code>2024-03-30T23:30:00Z</code>. With <code>spark.sql.session.timeZone = Europe/Berlin</code>, what is <code>to_date(ts)</code>?', options: ['2024-03-30', '2024-03-31', 'NULL', 'Depends on the executor’s time zone'], answer: 1, explain: 'Berlin was UTC+1 at that moment, so the local time is 00:30 on 31 March. The session time zone, not the executor’s OS zone, controls it.' },
    { kind: 'concept', q: 'Which is true about NaN in a double column?', options: ['NaN is treated as NULL', 'isNull() returns true for NaN', 'NaN = NaN is true and NaN sorts above all other numbers', 'Aggregates skip NaN'], answer: 2, explain: 'Spark gives NaN special but non-null semantics: equal to itself, larger than any number. <code>max</code> returns NaN if one is present. Use <code>isnan</code>.' },
    { kind: 'concept', q: '<code>count("*")</code>, <code>count("c")</code> and <code>sum("c")</code> on three rows where <code>c</code> is all NULL?', options: ['3, 0, 0', '3, 0, NULL', '0, 0, NULL', '3, 3, NULL'], answer: 1, explain: '<code>count(*)</code> counts rows, <code>count(c)</code> skips NULLs, and <code>sum</code> of no non-null values is NULL. Same as Postgres.' }
  ],
  interview: [
    { q: 'Explain NULL semantics in Spark filters and joins.', a: '<p>Three-valued logic: comparisons with NULL yield NULL; <code>filter</code>/<code>WHERE</code> keep only true; <code>AND</code>/<code>OR</code> follow SQL truth tables. Join keys compare with <code>=</code>, so NULLs never match; use <code>eqNullSafe</code> if needed. <code>NOT IN</code> with a NULL in the list returns no rows. Aggregates skip NULLs except <code>count(*)</code>. Group-by puts NULLs in one group.</p>', lvl: 'core' },
    { q: 'What changed with ANSI mode in Spark 4.0?', a: '<p><code>spark.sql.ansi.enabled</code> defaults to true. Invalid casts, integer overflow, divide by zero, invalid array index and similar raise errors with error classes (<code>[CAST_INVALID_INPUT]</code>, <code>[ARITHMETIC_OVERFLOW]</code>, <code>[DIVIDE_BY_ZERO]</code>). Type coercion is stricter too. <code>try_*</code> functions (<code>try_cast</code>, <code>try_divide</code>, <code>try_add</code>, <code>try_to_timestamp</code>…) give NULL when you want the old behaviour per expression.</p>', fu: 'How would you migrate a large 3.5 codebase? (Run the test suite with ANSI on in 3.5 first; replace intended silent casts with try_*; quarantine bad rows.)', lvl: 'deep' },
    { q: 'TIMESTAMP vs TIMESTAMP_NTZ?', a: '<p><code>TIMESTAMP</code> (alias <code>TIMESTAMP_LTZ</code>) is an instant stored as µs since epoch UTC; display, parsing of offset-less strings and date extraction use the session time zone. Postgres equivalent: <code>timestamptz</code>. <code>TIMESTAMP_NTZ</code> (3.4+) is a local date-time with no zone, unaffected by the session zone; like Postgres <code>timestamp</code>. Use LTZ for events, NTZ for things like “store opens at 09:00”. <code>spark.sql.timestampType</code> controls which one the plain <code>TIMESTAMP</code> keyword means.</p>', lvl: 'deep' },
    { q: 'How do you avoid time-zone bugs in Spark jobs?', a: '<ul><li>Set <code>spark.sql.session.timeZone=UTC</code> in every job (and consider <code>-Duser.timezone=UTC</code> for driver and executors).</li><li>Store events as UTC instants; ingest strings with an explicit offset or zone.</li><li>Derive business dates explicitly with <code>from_utc_timestamp</code>.</li><li>Be careful when bringing data to Python: <code>collect()</code> returns naive <code>datetime</code> objects converted to the Python process’s local zone, and <code>toPandas()</code> uses the session zone.</li></ul>', lvl: 'deep' },
    { q: 'Which numeric type do you use for money, and what can go wrong?', a: '<p><code>DecimalType(p, s)</code>, max precision 38. Doubles lose cents and sum non-deterministically across partitions. Decimal arithmetic widens precision; when it would exceed 38, Spark reduces scale (<code>spark.sql.decimalOperations.allowPrecisionLoss</code>, default true) or overflows to NULL/error depending on ANSI mode. Keep scales sensible, e.g. <code>decimal(18,2)</code> for amounts.</p>', lvl: 'deep' },
    { q: 'How do Spark types map to Java and Python types?', a: '<p>Int → <code>int</code>/<code>Integer</code>; Long → <code>long</code>; Decimal → <code>BigDecimal</code>/<code>decimal.Decimal</code>; String → <code>String</code>/<code>str</code>; Date → <code>java.sql.Date</code> or <code>LocalDate</code> (with <code>spark.sql.datetime.java8API.enabled</code>)/<code>datetime.date</code>; Timestamp → <code>Timestamp</code> or <code>Instant</code>/<code>datetime</code>; Array → <code>Seq</code>/<code>list</code>; Map → <code>Map</code>/<code>dict</code>; Struct → <code>Row</code>. Nullable primitives map to boxed types in Java.</p>', lvl: 'core' },
    { q: 'How do you deal with NULLs in a join key that is heavily NULL?', a: '<p>They will never match with <code>=</code>, but all of them still get shuffled to one partition (same hash), causing skew. Filter them out before the join and union them back (for an outer join), or replace them with a salted dummy value if they must flow through.</p>', lvl: 'deep' },
    { q: 'What is the difference between na.drop, na.fill and coalesce?', a: '<p><code>df.na.drop(how="any"|"all", subset=[…])</code> removes rows with nulls (and NaN). <code>df.na.fill(value, subset)</code> / <code>fillna</code> replaces nulls (and NaN in numeric columns) per column type. <code>F.coalesce(a, b, …)</code> is an expression returning the first non-null, usable anywhere, including joins and aggregates.</p>', lvl: 'core' },
    { q: 'Does nullable=false in a schema enforce anything?', a: '<p>Not as a constraint. It is a hint to the optimizer. When reading files, Spark generally treats columns as nullable anyway, and a NOT NULL claim that is false can produce wrong results. Enforce with checks (<code>filter(isNull).count() == 0</code>) or with table-format constraints such as Delta <code>CHECK</code>/<code>NOT NULL</code>.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Typed ingest with quarantine', lang: 'python', code: `from pyspark.sql import functions as F

spark.conf.set("spark.sql.session.timeZone", "UTC")
schema = "order_id STRING, qty STRING, amt STRING, ts STRING"
raw = spark.read.option("header", True).schema(schema).csv("s3://in/orders/")

typed = raw.select(
    "order_id",
    F.expr("try_cast(qty AS INT)").alias("qty_i"),
    F.expr("try_cast(amt AS DECIMAL(12,2))").alias("amt_d"),
    F.expr("try_to_timestamp(ts, 'yyyy-MM-dd HH:mm:ssXXX')").alias("ts_t"),   # needs an offset
    "qty", "amt", "ts")                                                       # keep raw for audit

bad = typed.filter((F.col("qty_i").isNull() & F.col("qty").isNotNull())
                 | (F.col("ts_t").isNull() & F.col("ts").isNotNull()))
bad.write.mode("append").saveAsTable("quarantine.orders")
good = typed.subtract(bad).select("order_id", "qty_i", "amt_d", "ts_t")` , note: '<code>try_to_timestamp</code> is available in Spark 3.5+. Raw columns are kept so bad rows can be audited.' },
    { title: 'Postgres vs Spark cheat sheet', lang: 'sql', code: `-- Postgres                         -- Spark SQL
a IS NOT DISTINCT FROM b              a <=> b
7 / 2            -- 3                 7 / 2        -- 3.5    (7 div 2 = 3)
CAST(3.99 AS int) -- 4 (rounds)       CAST(3.99 AS INT) -- 3 (truncates)
timestamptz                           TIMESTAMP (LTZ)
timestamp                             TIMESTAMP_NTZ (3.4+)
SET TIME ZONE 'UTC'                   SET TIME ZONE 'UTC'  -- = spark.sql.session.timeZone
to_char(ts, 'YYYY-MM-DD')             date_format(ts, 'yyyy-MM-dd')` },
    { title: 'Java: reading timestamps as Instant', lang: 'java', code: `SparkSession spark = SparkSession.builder()
    .config("spark.sql.session.timeZone", "UTC")
    .config("spark.sql.datetime.java8API.enabled", "true")   // Instant / LocalDate instead of java.sql types
    .getOrCreate();

Row r = spark.sql("SELECT TIMESTAMP '2024-03-30 23:30:00' AS ts").first();
java.time.Instant ts = r.getAs("ts");   // 2024-03-30T23:30:00Z` }
  ]
});

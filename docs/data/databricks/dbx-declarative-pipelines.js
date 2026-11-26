IA.register({
  track: 'databricks',
  slug: 'dbx-declarative-pipelines',
  title: 'Lakeflow Declarative Pipelines (DLT)',
  tagline: 'Instead of writing jobs that say <i>how</i> to update tables, you declare <i>what</i> each table is: a query. <b>Lakeflow Declarative Pipelines</b> (formerly <b>Delta Live Tables</b>, DLT) builds the dependency graph, runs it incrementally, enforces <b>expectations</b>, and handles CDC with <b>AUTO CDC</b> (formerly APPLY CHANGES).',
  tldr: {
    problem: 'Hand-built pipelines: checkpoint paths everywhere, task ordering maintained by hand, MERGE logic for CDC re-written per table, data-quality checks bolted on.',
    model: 'Two dataset types. <b>Streaming table</b>: each input row processed once (append/incremental). <b>Materialized view</b>: always equals its query, refreshed incrementally when possible. Plus <b>flows</b> (how data enters a table) and <b>expectations</b> (row rules).',
    hook: '“Streaming table or materialized view?” Append-only, unbounded input → streaming table. Aggregates, joins over changing data, or anything that must reflect updates and deletes upstream → materialized view.',
    facts: [
      { v: '2025', l: 'DLT renamed Lakeflow Declarative Pipelines; the core was contributed to Apache Spark as Spark Declarative Pipelines (names as of 2025; check your workspace)' },
      { v: '3 actions', l: 'expectation violation: warn (keep row), drop row, fail update' },
      { v: 'SCD 1 / 2', l: '<code>STORED AS SCD TYPE 1</code> or <code>2</code> in AUTO CDC; type 2 adds <code>__START_AT</code>/<code>__END_AT</code>' }
    ]
  },
  intro: {
    what: 'A <b>pipeline</b> is a set of source files (Python or SQL) that define tables. You never call <code>write</code> or schedule tasks between them. The engine parses all definitions, works out which table reads which, and updates them in the right order. It manages checkpoints, retries, compute and a detailed <b>event log</b>. You run it on a schedule (triggered) or continuously.',
    analogy: { icon: '📐', title: 'A spreadsheet of formulas', text: 'In a spreadsheet you write <code>=SUM(B2:B9)</code>, not “when B changes, recompute C”. The sheet works out the order. A declarative pipeline is that, for tables: each table is a formula over other tables.' },
    steps: [
      { t: 'Declare a bronze streaming table', d: 'SQL version, using Auto Loader via <code>read_files</code>.', code: "CREATE OR REFRESH STREAMING TABLE bronze_orders AS\nSELECT * FROM STREAM read_files('/Volumes/main/raw/orders/', format => 'json');", lang: 'sql' },
      { t: 'Add quality rules', d: 'Expectations are constraints with an action.', code: 'CREATE OR REFRESH STREAMING TABLE silver_orders (\n  CONSTRAINT valid_id EXPECT (order_id IS NOT NULL) ON VIOLATION FAIL UPDATE,\n  CONSTRAINT valid_amount EXPECT (amount >= 0) ON VIOLATION DROP ROW\n) AS SELECT * FROM STREAM(bronze_orders);', lang: 'sql' },
      { t: 'Aggregate with a materialized view', d: 'Always consistent with its query.', code: 'CREATE OR REFRESH MATERIALIZED VIEW gold_daily AS\nSELECT date(order_ts) d, sum(amount) revenue FROM silver_orders GROUP BY 1;', lang: 'sql' },
      { t: 'Run it', d: 'Create the pipeline in the UI or an Asset Bundle, pick target catalog/schema, run in development mode while iterating.' }
    ],
    terms: [
      ['streaming table', 'Delta table fed by one or more streaming flows; processes new input only.'],
      ['materialized view', 'Precomputed query result kept up to date by pipeline updates.'],
      ['flow', 'A query that writes into a target; several append flows can feed one streaming table.'],
      ['expectation', 'A row-level quality rule with action warn / drop / fail; metrics go to the event log.'],
      ['AUTO CDC', 'Declarative CDC apply (formerly APPLY CHANGES): KEYS, SEQUENCE BY, deletes, SCD 1/2.'],
      ['full refresh', 'Clear and recompute a table from scratch, including resetting streaming state.']
    ]
  },
  visual: {
    title: 'The graph and the CDC engine',
    caption: '<b>Pipeline graph</b>: watch an update flow through bronze, silver (with expectations) and a materialized view. <b>AUTO CDC</b>: see out-of-order change events resolved by <code>SEQUENCE BY</code>.'
  },
  gotchas: [
    { trap: 'Writing imperative code inside a dataset function', code: '@dp.table\ndef silver():\n    df = spark.read.table("bronze")\n    df.write.saveAsTable("other")   # side effect: don’t\n    return df', why: 'Dataset functions may be evaluated several times during planning. Side effects (writes, <code>collect()</code>, API calls) run unpredictably.', fix: 'Return a DataFrame and nothing else. Do side effects in a separate job task or a sink/flow designed for it.' },
    { trap: 'Streaming table over a source that updates or deletes', why: 'A streaming read expects append-only input. If upstream rows are updated or deleted, the stream fails, or (with skip options) silently ignores changes.', fix: 'Use a materialized view, read the source’s change data feed, or use AUTO CDC when the source is a change feed.' },
    { trap: 'Full refresh on a table whose source no longer has the history', why: 'Full refresh truncates and recomputes. If the landing files or Kafka retention expired, the data is gone.', fix: 'Protect such tables with the table property <code>pipelines.reset.allowed = false</code>; keep bronze as the durable source.', code: "CREATE OR REFRESH STREAMING TABLE bronze_events\nTBLPROPERTIES ('pipelines.reset.allowed' = 'false')\nAS SELECT * FROM STREAM read_kafka(...);", lang: 'sql' },
    { trap: 'AUTO CDC without a reliable sequence column', why: '<code>SEQUENCE BY</code> decides which change wins. Ingest time or a non-monotonic column gives wrong “latest” values when events arrive out of order.', fix: 'Use the source’s commit LSN/SCN or an event version; use a struct of columns to break ties.' },
    { trap: 'Confusing old and new APIs', why: '<code>import dlt</code>, <code>@dlt.table</code>, <code>dlt.apply_changes</code>, <code>LIVE.</code> prefixes and <code>APPLY CHANGES INTO</code> are the older forms. Newer docs use <code>from pyspark import pipelines as dp</code>, <code>@dp.materialized_view</code>, <code>dp.create_auto_cdc_flow</code> and <code>AUTO CDC INTO</code>.', fix: 'Both forms work in current pipelines (as of 2025, check your workspace). Pick one per codebase and mention the mapping in interviews.' },
    { trap: 'Expecting every feature on every edition', why: 'Classic pipelines have product editions (Core, Pro, Advanced): CDC needs Pro or above and expectations need Advanced. Serverless pipelines include all features.', fix: 'Check the pipeline’s edition setting if a CDC or expectation definition is rejected.' }
  ],
  scenarios: [
    { title: 'Customer dimension shows old addresses',
      symptom: 'After a backfill of the CDC feed, about 2% of customers show an address they changed months ago.',
      diagnose: `SELECT id, count(*) FROM cdc_customers GROUP BY id HAVING count(*) > 1;
-- the backfill replayed old events with a later ingest_ts than newer ones`,
      cause: 'The AUTO CDC flow used <code>SEQUENCE BY ingest_ts</code>. Replayed old events got new ingest times and “won”.',
      fix: 'Sequence by the source commit position, then full-refresh the target from the complete feed.',
      fixCode: `CREATE OR REFRESH STREAMING TABLE customers;

CREATE FLOW customers_cdc AS AUTO CDC INTO customers
FROM STREAM(cdc_customers)
KEYS (id)
APPLY AS DELETE WHEN op = 'D'
SEQUENCE BY source_lsn
COLUMNS * EXCEPT (op, source_lsn, ingest_ts)
STORED AS SCD TYPE 1;`, lang: 'sql' },
    { title: 'Pipeline update fails every night at the silver step',
      symptom: 'Updates fail with an expectation violation; dashboards go stale.',
      diagnose: `SELECT timestamp, details:flow_progress.data_quality.expectations
FROM event_log(TABLE(main.sales.silver_orders))
WHERE event_type = 'flow_progress' ORDER BY timestamp DESC LIMIT 5;`,
      cause: 'A new upstream system sends test orders with <code>order_id = NULL</code>. The rule was <code>ON VIOLATION FAIL UPDATE</code>, so one bad row stops everything.',
      fix: 'Keep FAIL for true invariants, but route known-bad rows to a quarantine table and DROP them from silver. Alert on the drop rate.',
      fixCode: `CREATE OR REFRESH STREAMING TABLE quarantine_orders AS
SELECT * FROM STREAM(bronze_orders) WHERE order_id IS NULL;

CREATE OR REFRESH STREAMING TABLE silver_orders (
  CONSTRAINT valid_id EXPECT (order_id IS NOT NULL) ON VIOLATION DROP ROW
) AS SELECT * FROM STREAM(bronze_orders);`, lang: 'sql' }
  ],
  puzzles: [
    { kind: 'concept', q: 'Input: an append-only stream of click events. Output: raw clicks, cleaned. Which dataset type?', options: ['Materialized view', 'Streaming table', 'Temporary view', 'External table'], answer: 1, explain: 'Append-only, unbounded input processed once per row is the streaming-table case.' },
    { kind: 'concept', q: 'Output: revenue per day over silver orders, where orders can be corrected later. Which type?', options: ['Streaming table', 'Materialized view', 'Append flow', 'COPY INTO'], answer: 1, explain: 'An aggregate that must reflect upstream updates is a materialized view. A streaming table would only see new rows, and aggregations over streams need watermarks.' },
    { kind: 'concept', q: '<code>CONSTRAINT c EXPECT (amount &gt;= 0)</code> with no ON VIOLATION clause. A row has amount = -5. Result?', options: ['Row dropped', 'Update fails', 'Row kept, violation counted in metrics', 'Amount set to 0'], answer: 2, explain: 'The default action is warn: the row is written and the violation is recorded in the event log.' },
    { kind: 'concept', q: 'AUTO CDC with <code>SEQUENCE BY seq</code>, SCD type 1. Events for key 7 arrive as seq 1, 3, 2. Final value?', options: ['seq 2’s value', 'seq 3’s value', 'seq 1’s value', 'Error: out of order'], answer: 1, explain: 'The highest sequence wins regardless of arrival order. Late seq 2 does not overwrite seq 3.' },
    { kind: 'concept', q: 'What was <code>AUTO CDC INTO</code> called before 2025?', options: ['MERGE INTO', 'APPLY CHANGES INTO', 'COPY INTO', 'CHANGE DATA FEED'], answer: 1, explain: '<code>APPLY CHANGES INTO</code> / <code>dlt.apply_changes()</code>. The new names are <code>AUTO CDC INTO</code> / <code>create_auto_cdc_flow()</code>; the old syntax still works (check your workspace).' },
    { kind: 'concept', q: 'You run a full refresh on a streaming table. What happens?', options: ['Only new data is processed', 'The table is truncated, streaming state reset, and all available source data reprocessed', 'Nothing; streaming tables ignore it', 'Only the schema is refreshed'], answer: 1, explain: 'Full refresh recomputes from scratch. Source data that no longer exists cannot come back, which is why <code>pipelines.reset.allowed = false</code> exists.' }
  ],
  interview: [
    { q: 'What is a declarative pipeline and what does it manage for you?', a: '<p>You define datasets as queries; the engine infers the DAG, orders updates, manages streaming checkpoints, retries, autoscaling (or serverless), schema evolution, data-quality metrics and the event log. You manage business logic only.</p>', lvl: 'core' },
    { q: 'Streaming table vs materialized view?', a: '<p><b>Streaming table:</b> each input row is processed once; low latency; good for ingestion and append-style transforms; state lives in checkpoints. <b>Materialized view:</b> result always equals the query over current inputs; supports updates/deletes upstream, joins and aggregates; refreshed incrementally when the engine can, else fully.</p>', lvl: 'core' },
    { q: 'How do expectations work?', a: '<p>SQL <code>CONSTRAINT name EXPECT (cond) [ON VIOLATION DROP ROW | FAIL UPDATE]</code>, or Python <code>@dp.expect</code>, <code>@dp.expect_or_drop</code>, <code>@dp.expect_or_fail</code> and <code>expect_all*</code> variants. Pass/fail counts are written to the event log per update.</p>', lvl: 'core' },
    { q: 'Explain AUTO CDC.', a: '<p>Applies a change feed to a target: <code>KEYS</code> identify rows, <code>SEQUENCE BY</code> orders changes (out-of-order safe), <code>APPLY AS DELETE WHEN</code> / <code>APPLY AS TRUNCATE WHEN</code> handle deletes, <code>COLUMNS</code> selects fields, <code>STORED AS SCD TYPE 1</code> or <code>2</code> (with <code>TRACK HISTORY ON</code> for type 2). It replaces hand-written MERGE logic. Formerly APPLY CHANGES.</p>', fu: 'Can it take a snapshot instead of a change feed? Yes: <code>create_auto_cdc_from_snapshot_flow</code> (formerly <code>apply_changes_from_snapshot</code>) diffs successive snapshots (Python).', lvl: 'deep' },
    { q: 'Development vs production mode; triggered vs continuous?', a: '<p>Development mode reuses the cluster and does not retry, for fast iteration. Production mode restarts on failures and retries. Triggered runs process available data and stop (schedule them as a job); continuous keeps running for low latency.</p>', lvl: 'core' },
    { q: 'How do you monitor a pipeline?', a: '<p>The pipeline UI graph, and the event log: query with <code>event_log(TABLE(...))</code> or publish it to a table. It holds flow progress, row counts, expectation metrics, lineage and errors. Alert on failures and drop rates.</p>', lvl: 'core' },
    { q: 'What changed with the 2025 renames?', a: '<p>Delta Live Tables became Lakeflow Declarative Pipelines (part of Lakeflow, with Lakeflow Connect for ingestion and Lakeflow Jobs for orchestration). The Python API moved toward <code>pyspark.pipelines</code> (<code>dp</code>), APPLY CHANGES became AUTO CDC, and the core engine was donated to Apache Spark as Spark Declarative Pipelines. Older syntax still runs. Naming continues to evolve; check your workspace.</p>', lvl: 'deep' },
    { q: 'When would you not use a declarative pipeline?', a: '<p>Complex imperative logic with external side effects, fine control over Spark configs or checkpoint layout, or workloads that need features not supported inside pipelines. Then use jobs with plain Structured Streaming / batch code (see the Spark track’s <a href="../spark/structured-streaming.html">streaming page</a>).</p>', lvl: 'deep' },
    { q: 'How can two sources feed one table?', a: '<p>Create the streaming table once, then several append flows into it (<code>CREATE FLOW … AS INSERT INTO target BY NAME SELECT …</code> or <code>@dp.append_flow(target=…)</code>). You can add a flow later without a full refresh.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Python pipeline (new dp API)', lang: 'python', code: `from pyspark import pipelines as dp
from pyspark.sql import functions as F

@dp.table(comment="Raw orders from the landing volume")
def bronze_orders():
    return (spark.readStream.format("cloudFiles")
              .option("cloudFiles.format", "json")
              .load("/Volumes/main/raw/orders/"))

@dp.table
@dp.expect_or_fail("valid_id", "order_id IS NOT NULL")
@dp.expect_or_drop("valid_amount", "amount >= 0")
def silver_orders():
    return (spark.readStream.table("bronze_orders")
              .withColumn("amount", F.col("amount").cast("decimal(10,2)")))

@dp.materialized_view
def gold_daily():
    return (spark.read.table("silver_orders")
              .groupBy(F.to_date("order_ts").alias("d"))
              .agg(F.sum("amount").alias("revenue")))`, note: 'Older code: <code>import dlt</code> with <code>@dlt.table</code> and <code>@dlt.expect_or_drop</code>; same semantics. No schema location needed: the pipeline manages it.' },
    { title: 'AUTO CDC, SCD type 2 (Python)', lang: 'python', code: `from pyspark import pipelines as dp
from pyspark.sql.functions import col, expr

dp.create_streaming_table("dim_customer")

dp.create_auto_cdc_flow(                       # formerly dlt.apply_changes(...)
    target="dim_customer",
    source="cdc_customers",
    keys=["id"],
    sequence_by=col("source_lsn"),
    apply_as_deletes=expr("op = 'D'"),
    except_column_list=["op", "source_lsn"],
    stored_as_scd_type=2)                      # adds __START_AT / __END_AT` },
    { title: 'Pipeline in an Asset Bundle', lang: 'yaml', code: `resources:
  pipelines:
    orders:
      name: orders-pipeline
      catalog: main
      schema: sales
      serverless: true
      libraries:
        - file: { path: ../src/orders_pipeline.py }
      development: false` }
  ]
});

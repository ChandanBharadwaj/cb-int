IA.register({
  track: 'databricks',
  slug: 'dbx-medallion',
  title: 'Medallion architecture',
  tagline: '<b>Bronze</b> keeps what arrived, <b>silver</b> makes it correct, <b>gold</b> makes it useful. The pattern is simple; the interview depth is in <b>idempotent loads</b> (re-runs never double data) and <b>SCD type 2</b> history.',
  tldr: {
    problem: 'Pipelines that transform straight from source to dashboard: a bad parse loses data forever, a retried job doubles revenue, and nobody can rebuild last month.',
    model: 'Layers are a <b>contract about quality</b>, not about storage. Bronze: raw + metadata, append-only, replayable. Silver: typed, deduped, keyed (MERGE). Gold: aggregated for a consumer. Every step must be safe to re-run.',
    hook: '“Your job failed halfway and was retried. Did you double count?” Not if silver MERGEs on a business key and gold is rebuilt or MERGEd per affected partition.',
    facts: [
      { v: '3 layers', l: 'a naming convention Databricks popularised; some teams add a landing or platinum layer' },
      { v: 'MERGE', l: 'the idempotent write for keyed data; blind <code>append</code> is not idempotent' },
      { v: 'valid_from / valid_to', l: 'the usual SCD2 columns (<code>__START_AT</code>/<code>__END_AT</code> when AUTO CDC builds it)' }
    ]
  },
  intro: {
    what: 'The <b>medallion architecture</b> organises lakehouse tables into layers. Data lands in <b>bronze</b> almost unchanged. Jobs clean it into <b>silver</b>: one row per real-world thing, correct types, no duplicates. Then <b>gold</b> tables shape it for a use: daily revenue, a customer dimension, ML features. Each layer is ordinary Delta tables, usually in separate schemas or catalogs.',
    analogy: { icon: '⛏️', title: 'Ore → metal → jewellery', text: 'Bronze is ore straight from the mine: you keep it so you can smelt again with a better process. Silver is refined metal of known purity. Gold is the finished piece made for one customer.' },
    steps: [
      { t: 'Bronze: land raw', d: 'Append with ingest metadata. Keep the original payload when you can.', code: 'raw = (spark.readStream.format("cloudFiles")\n        .option("cloudFiles.format", "json")\n        .option("cloudFiles.schemaLocation", "/Volumes/main/meta/schemas/orders")\n        .load("/Volumes/main/raw/orders/")\n        .select("*", "_metadata.file_path", F.current_timestamp().alias("_ingest_ts")))' },
      { t: 'Silver: clean and key', d: 'Cast, validate, dedupe, then MERGE on the business key.' },
      { t: 'Gold: shape for use', d: 'Aggregates and dimensions; often materialized views.', code: 'CREATE OR REPLACE MATERIALIZED VIEW main.gold.daily_revenue AS\nSELECT order_date, sum(amount) revenue FROM main.silver.orders GROUP BY order_date;', lang: 'sql' },
      { t: 'Keep history where it matters', d: 'Slowly changing dimensions (SCD2) store each version of a customer row with validity dates.' }
    ],
    terms: [
      ['idempotent', 'Running the same load twice leaves the same result as running it once.'],
      ['business key', 'The real-world identifier (order_id), as opposed to a surrogate key.'],
      ['SCD type 1', 'Overwrite in place: keep only the latest value.'],
      ['SCD type 2', 'Close the old row, insert a new row: keep full history.'],
      ['quarantine', 'A side table for rows that failed validation, so they are not silently lost.']
    ]
  },
  visual: {
    title: 'Layers and history',
    caption: 'Run <b>Bronze → Silver → Gold</b>, including a job retry, then switch to <b>SCD type 2</b> to see a customer move city.'
  },
  gotchas: [
    { trap: 'Blind append into silver', code: 'clean_df.write.mode("append").saveAsTable("main.silver.orders")   # retry = duplicates', why: 'A retried batch or an overlapping file re-inserts the same orders.', fix: 'MERGE on the business key, or use streaming with a checkpoint plus <code>dropDuplicatesWithinWatermark</code>/MERGE in <code>foreachBatch</code>.' },
    { trap: 'Cleaning in bronze', why: 'If bronze already drops “bad” rows or casts types, a parsing bug destroys data you can never replay.', fix: 'Bronze stores raw values (strings or a raw JSON column) plus <code>_rescued_data</code>. Clean in silver; quarantine failures.' },
    { trap: 'Gold built with <code>INSERT</code> for each run', why: 'Each run appends today’s aggregates again, so totals grow with every re-run.', fix: 'Rebuild gold (materialized view or <code>CREATE OR REPLACE</code>), or <code>INSERT REPLACE WHERE order_date = …</code> / MERGE for the affected dates only.' },
    { trap: 'Non-deterministic dedupe', why: '<code>dropDuplicates(["order_id"])</code> keeps an arbitrary row per key; two runs can keep different versions.', fix: 'Pick explicitly: <code>row_number()</code> ordered by a change timestamp or sequence number.' },
    { trap: 'SCD2 MERGE that only updates', why: 'A single <code>WHEN MATCHED THEN UPDATE</code> closes the old row but cannot also insert the new version for the same key in the same MERGE.', fix: 'Use the staged-union trick (rows with a NULL merge key force an insert), or let <code>AUTO CDC … STORED AS SCD TYPE 2</code> handle it.' },
    { trap: 'Too many layers and copies', why: 'Teams create bronze_1, silver_raw, silver_clean, gold_v2… Each hop costs compute and latency.', fix: 'Layers are a quality contract. Use views for light reshaping; materialise only where it pays off.' }
  ],
  scenarios: [
    { title: 'Revenue doubled for June 3rd only',
      symptom: 'Gold daily revenue for one day is exactly twice the expected value.',
      diagnose: `SELECT order_id, count(*) c FROM main.silver.orders
WHERE order_date = '2025-06-03' GROUP BY order_id HAVING c > 1;   -- thousands
-- job run history: run failed at the silver write, auto-retried`,
      cause: 'Silver used <code>mode("append")</code>. The first attempt committed before a later task failed; the retry appended the same batch again.',
      fix: 'Switch silver to MERGE on <code>order_id</code>, clean up the duplicates once, rebuild gold for the day.',
      fixCode: `MERGE INTO main.silver.orders t
USING (SELECT * EXCEPT (rn) FROM (
         SELECT *, row_number() OVER (PARTITION BY order_id ORDER BY updated_at DESC) rn
         FROM batch_view) WHERE rn = 1) s
ON t.order_id = s.order_id
WHEN MATCHED AND s.updated_at > t.updated_at THEN UPDATE SET *
WHEN NOT MATCHED THEN INSERT *;`, lang: 'sql' },
    { title: 'A parser bug, three weeks later',
      symptom: 'Discount codes were parsed wrong since a source change three weeks ago. Finance wants corrected history.',
      cause: 'Luckily bronze kept the raw JSON. Silver had applied the wrong parsing.',
      diagnose: `SELECT count(*) FROM main.bronze.orders
WHERE _ingest_ts >= '2025-05-12' AND raw:discount IS NOT NULL;   -- raw payload still there`,
      fix: 'Fix the parsing, then replay bronze into silver for the affected window (MERGE is idempotent, so overlap is fine) and refresh gold.',
      fixCode: `fixed = (spark.read.table("main.bronze.orders")
           .where("_ingest_ts >= '2025-05-12'")
           .transform(parse_orders_v2))           # corrected logic
upsert_silver(fixed)                              # the same MERGE used daily
spark.sql("REFRESH MATERIALIZED VIEW main.gold.daily_revenue")`, lang: 'python' }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which write into silver is idempotent for keyed order data?', options: ['mode("append")', 'MERGE on order_id with a deterministic dedupe of the batch', 'INSERT INTO … SELECT', 'mode("overwrite") of only today’s batch into the whole table'], answer: 1, explain: 'MERGE on the business key gives the same result on re-run. Overwriting the whole table with one batch loses all other days.' },
    { kind: 'concept', q: 'Where should malformed records go?', options: ['Dropped in bronze', 'Kept raw in bronze; failed validation in silver goes to a quarantine table', 'Gold, flagged', 'Nowhere, fail the pipeline every time'], answer: 1, explain: 'Bronze is your replay source. Silver validates and routes failures to quarantine so they can be inspected and reprocessed.' },
    { kind: 'concept', q: 'SCD2 dimension: customer 7 changes city. How many rows exist for customer 7 afterwards (assuming one previous version)?', options: ['1', '2', '3', 'Depends on the city'], answer: 1, explain: 'The old row is closed (valid_to set, is_current false) and a new current row is inserted: 2 rows.' },
    { kind: 'concept', q: 'Why does the SCD2 staged-union MERGE add a copy of each changed row with <code>merge_key = NULL</code>?', options: ['To delete it', 'Because NULL never matches, so that copy falls into WHEN NOT MATCHED and is inserted as the new version', 'To speed up the join', 'To bypass schema enforcement'], answer: 1, explain: 'One MERGE can either update or insert a given source row. Emitting the change twice (once keyed to close the old row, once with a NULL key to insert the new one) does both in one atomic commit.' },
    { kind: 'concept', q: 'A gold table is computed with <code>INSERT INTO gold SELECT date, sum(x) … WHERE date = :d</code>. The job is re-run for the same date. Result?', options: ['Unchanged', 'Two rows for the date: doubled totals', 'An error', 'Latest value wins'], answer: 1, explain: 'INSERT appends. Use <code>INSERT INTO … REPLACE WHERE date = :d</code>, MERGE, or a materialized view.' },
    { kind: 'concept', q: 'Silver dedupes with <code>dropDuplicates(["order_id"])</code> on a batch containing two versions of an order. Which is kept?', options: ['The latest', 'The earliest', 'Not guaranteed', 'Both'], answer: 2, explain: 'Batch <code>dropDuplicates</code> keeps an arbitrary row per key. Order explicitly with a window function.' }
  ],
  interview: [
    { q: 'Describe the medallion architecture and why it exists.', a: '<p>Bronze: raw, append-only, with lineage metadata, so you can replay. Silver: validated, typed, deduplicated, conformed, keyed entities. Gold: consumption-ready aggregates and models. It separates concerns, lets you fix logic and rebuild downstream, and gives clear quality contracts per layer.</p>', lvl: 'core' },
    { q: 'How do you make a pipeline idempotent?', a: '<ul><li>Keyed MERGE instead of append, with deterministic dedupe.</li><li>Streaming checkpoints so each file/offset is processed once.</li><li>Replace by partition/predicate (<code>REPLACE WHERE</code>) for aggregates.</li><li>Writes keyed by run/batch id when using <code>foreachBatch</code> (Delta supports <code>txnAppId</code>/<code>txnVersion</code> for idempotent batch writes).</li></ul>', lvl: 'deep' },
    { q: 'Implement SCD type 2 on Delta.', a: '<p>MERGE with a staged source: union (a) changed rows keyed by the business key (to close the current row: set end date, is_current = false) with (b) the same rows with a NULL merge key (to fall into NOT MATCHED and insert the new current row). Include new keys once. Alternatively use <code>AUTO CDC … STORED AS SCD TYPE 2</code> in a declarative pipeline.</p>', lvl: 'deep' },
    { q: 'Streaming or batch between layers?', a: '<p>Bronze→silver is often streaming (Auto Loader, Kafka), possibly with <code>trigger(availableNow=True)</code> to run as incremental batch. Silver→gold is often batch or materialized views because aggregates need recomputation. See the Spark track’s <a href="../spark/structured-streaming.html">Structured Streaming</a>.</p>', lvl: 'core' },
    { q: 'How do you handle late or out-of-order updates in silver?', a: '<p>Carry a change timestamp or sequence and only apply updates that are newer: <code>WHEN MATCHED AND s.seq &gt; t.seq THEN UPDATE</code>. AUTO CDC does this with <code>SEQUENCE BY</code>.</p>', lvl: 'deep' },
    { q: 'Where do data-quality checks go?', a: '<p>Mainly at bronze→silver: schema, nulls in keys, ranges, referential checks. Gold gets reconciliation checks (totals vs source). In declarative pipelines, expectations express them.</p>', lvl: 'core' },
    { q: 'How do you organise layers in Unity Catalog?', a: '<p>Common options: schemas per layer in a domain catalog (<code>sales.bronze</code>, <code>sales.silver</code>, <code>sales.gold</code>), or catalogs per layer. Combine with catalogs per environment. Grant consumers access only to gold.</p>', lvl: 'core' },
    { q: 'Is medallion always right?', a: '<p>No. It is a convention. Small or simple sources may go straight to a cleaned table plus views. The non-negotiables are: keep raw data replayable, make writes idempotent, and know who consumes what.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'SCD2 with one MERGE (staged union)', lang: 'sql', code: `MERGE INTO main.gold.dim_customer t
USING (
  -- 1) changed or new rows, keyed: closes the current version
  SELECT s.customer_id AS merge_key, s.* FROM updates s
  UNION ALL
  -- 2) changed rows again with NULL key: forces insert of the new version
  SELECT NULL AS merge_key, s.* FROM updates s
  JOIN main.gold.dim_customer t
    ON s.customer_id = t.customer_id AND t.is_current AND s.city <> t.city
) s
ON t.customer_id = s.merge_key AND t.is_current
WHEN MATCHED AND t.city <> s.city THEN
  UPDATE SET is_current = false, valid_to = s.changed_at
WHEN NOT MATCHED THEN
  INSERT (customer_id, city, valid_from, valid_to, is_current)
  VALUES (s.customer_id, s.city, s.changed_at, NULL, true);`, note: 'Brand-new customers match nothing via part 1 and are inserted once. Unchanged rows match but fail the <code>city &lt;&gt;</code> condition, so nothing happens.' },
    { title: 'Idempotent streaming upsert with foreachBatch', lang: 'python', code: `from delta.tables import DeltaTable
from pyspark.sql import functions as F, Window

w = Window.partitionBy("order_id").orderBy(F.col("updated_at").desc())

def upsert(batch_df, batch_id):
    latest = batch_df.withColumn("rn", F.row_number().over(w)).where("rn = 1").drop("rn")
    (DeltaTable.forName(spark, "main.silver.orders").alias("t")
        .merge(latest.alias("s"), "t.order_id = s.order_id")
        .whenMatchedUpdateAll("s.updated_at > t.updated_at")
        .whenNotMatchedInsertAll().execute())

(spark.readStream.table("main.bronze.orders_parsed")
   .writeStream.foreachBatch(upsert)
   .option("checkpointLocation", "/Volumes/main/meta/chk/silver_orders")
   .trigger(availableNow=True)
   .start())`, note: 'Inside <code>foreachBatch</code> the batch is a normal DataFrame, so window functions work. A batch replayed after a failure re-MERGEs the same rows, which is harmless.' }
  ]
});

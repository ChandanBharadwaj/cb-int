IA.register({
  track: 'spark',
  slug: 'structured-streaming',
  title: 'Structured Streaming',
  tagline: 'Structured Streaming treats a stream as a <b>table that keeps growing</b>. You write a normal DataFrame query; Spark runs it again and again on each new slice of data (a <b>micro-batch</b>), keeps running state, and records progress in a <b>checkpoint</b> so a restart picks up exactly where it stopped.',
  tldr: {
    problem: 'Streaming jobs never finish, so every unbounded thing becomes a production problem: state that grows forever, late events, restarts that duplicate or lose data, and output that changes after it was written.',
    model: 'Each trigger: read new offsets → run the query incrementally against stored <b>state</b> → write results with an <b>output mode</b> → commit offsets to the checkpoint. A <b>watermark</b> (max event time seen − allowed delay) says when a window is final and its state can be dropped.',
    hook: '“Our windowed counts never appear in append mode.” Without a watermark Spark can’t know a window is complete, so append mode refuses the query (or with a watermark, waits until it passes the window end).',
    facts: [
      { v: 'micro-batch', l: 'the default engine. Continuous processing (<code>trigger(continuous=…)</code>) is still marked experimental' },
      { v: 'availableNow', l: '<code>trigger(availableNow=True)</code> (Spark 3.3+) processes everything available in several batches, then stops. Replaces <code>once=True</code>' },
      { v: '3', l: 'output modes: <code>append</code> (default), <code>update</code>, <code>complete</code>' }
    ]
  },
  intro: {
    what: 'A <b>stream</b> is data that keeps arriving: Kafka messages, files landing in a folder, change events. Structured Streaming lets you query it with the same DataFrame API as batch data. Behind the scenes Spark runs a small batch job every few seconds over the new rows, updates any running totals (<b>state</b>), writes the result to a <b>sink</b>, and saves its progress to a <b>checkpoint</b> folder.',
    analogy: { icon: '📬', title: 'A post office counting letters per hour', text: 'Every few minutes a clerk empties the mailbox (micro-batch), adds the letters to tallies by postmark hour (state), and writes down the last letter number processed (checkpoint). Letters can arrive late. The clerk decides: “I’ll keep each hour’s tally open until I’ve seen postmarks 10 minutes past it” (watermark), then publishes and forgets it.' },
    steps: [
      { t: 'Read a stream', d: 'Same reader, <code>readStream</code> instead of <code>read</code>.', code: 'events = spark.readStream.format("kafka").option("subscribe", "clicks").load()' },
      { t: 'Transform as usual', d: 'Parse, filter, group by a time window. Add a watermark for event-time state.', code: 'counts = (parsed.withWatermark("ts", "10 minutes")\n  .groupBy(F.window("ts", "5 minutes"), "page").count())' },
      { t: 'Write a stream', d: 'Pick a sink, an output mode, a trigger and a checkpoint location.', code: 'q = (counts.writeStream.outputMode("append")\n  .option("checkpointLocation", "/chk/clicks")\n  .trigger(processingTime="30 seconds")\n  .toTable("click_counts"))' },
      { t: 'It keeps running', d: 'Each trigger processes new data. <code>q.lastProgress</code> shows rows/sec, batch duration and state size.' },
      { t: 'Restart safely', d: 'Restart with the <b>same checkpoint</b>: Spark resumes from the last committed offsets and restores state.' }
    ],
    terms: [
      ['micro-batch', 'One small batch job over the data that arrived since the last trigger.'],
      ['trigger', 'When the next micro-batch starts: as soon as possible, every N seconds, or availableNow.'],
      ['state', 'Data kept between batches: running aggregates, dedup keys, join buffers.'],
      ['event time vs processing time', 'When the event happened (a field in the data) vs when Spark saw it.'],
      ['watermark', 'max(event time seen) − delay. Older data may be dropped; state for windows before it is cleaned up.'],
      ['checkpoint', 'A folder with offsets, commits and state snapshots, used for exactly-once recovery.']
    ]
  },
  visual: {
    title: 'Micro-batches, watermark and output modes',
    caption: 'Pick an output mode and press <b>Play</b> or <b>Step</b>. Each step is one micro-batch of click events with event times. The watermark is 10 minutes behind the latest event time seen. Watch when 5-minute windows are emitted, updated or dropped, and what happens to the late event.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Simulation: watermark + append mode', code: `# SIMULATION in plain Python of Spark's event-time window logic (no Spark).
# 5-minute tumbling windows, watermark delay 10 minutes, append mode.
batches = [
    [3, 4, 7],          # event times in minutes
    [12, 9, 14],
    [2, 21],            # 2 is late
    [27, 31],
]
DELAY, SIZE = 10, 5
state, watermark, max_seen = {}, 0, 0
for n, batch in enumerate(batches, 1):
    for t in batch:
        w = t // SIZE * SIZE
        if w + SIZE <= watermark:
            print(f"batch {n}: event t={t} is behind watermark {watermark}: dropped")
            continue
        state[w] = state.get(w, 0) + 1
    max_seen = max([max_seen] + batch)
    # emit windows whose end <= watermark, using the watermark from the PREVIOUS batch
    out = {w: c for w, c in state.items() if w + SIZE <= watermark}
    for w in out: del state[w]
    print(f"batch {n}: emitted {out}  state={state}  watermark={watermark}")
    watermark = max(watermark, max_seen - DELAY)   # applied to the next batch`, note: 'Spark computes the new watermark at the end of a batch and uses it in the next one, so results appear one batch later than you might expect.' }
    ]
  },
  gotchas: [
    { trap: 'No watermark: state grows forever', code: `events.groupBy(F.window("ts", "5 minutes")).count()   # no withWatermark`, why: 'Spark must keep every window open in case a late event arrives. State size (in <code>stateOperators</code> of the progress) grows until the job slows or dies.', fix: 'Add <code>withWatermark("ts", "…")</code> on the event-time column used by the window, sized to your real lateness.' },
    { trap: 'Changing the checkpoint path or the query shape', why: 'The checkpoint stores offsets and state keyed to the query’s operators. A new path re-reads from <code>startingOffsets</code> (duplicates or gaps). Changing grouping keys or aggregations can make old state incompatible and fail on restart.', fix: 'One checkpoint per query, on durable storage, never shared. For incompatible changes, start a new checkpoint deliberately and backfill. Spark 3.5+/4.0 has a state data source to inspect state.' },
    { trap: 'Expecting append mode to emit windowed counts at once', why: 'Append emits a row only when it is final. For a windowed aggregation that is when the watermark passes the window’s end, which is at least “window + delay” later.', fix: 'Use <code>update</code> mode for low latency (sinks must handle upserts), or accept the delay. <code>complete</code> rewrites the whole result every batch: only for small results.' },
    { trap: 'Non-idempotent sinks in foreachBatch', code: `def write(df, batch_id):\n    df.write.jdbc(url, "counts", mode="append")   # replayed batch = duplicates`, why: 'After a failure, the last batch may run again with the same <code>batch_id</code>. Exactly-once needs a replayable source <b>and</b> an idempotent or transactional sink.', fix: 'Upsert (MERGE) keyed on the result key, or record <code>batch_id</code> and skip repeats. Delta sinks handle this for you.' },
    { trap: 'Stream-stream joins without watermarks', why: 'Both sides must buffer rows in state to wait for matches. Without watermarks and a time-range condition, that buffer never shrinks, and outer joins can’t emit their unmatched rows.', fix: 'Watermark both inputs and add an event-time range to the join condition, e.g. <code>click.ts BETWEEN imp.ts AND imp.ts + INTERVAL 1 HOUR</code>.' },
    { trap: 'Default state store on huge state', why: 'The default HDFS-backed state store keeps state in executor JVM memory, causing GC pressure with millions of keys.', fix: 'Use RocksDB: <code>spark.sql.streaming.stateStore.providerClass=org.apache.spark.sql.execution.streaming.state.RocksDBStateStoreProvider</code> (Spark 3.2+).' }
  ],
  scenarios: [
    { title: 'Streaming job slows down every day until it falls over',
      symptom: 'Batch duration grows from 5 s to 3 minutes over a week; executors show high GC. <code>q.lastProgress["stateOperators"][0]["numRowsTotal"]</code> keeps rising.',
      diagnose: `print(q.lastProgress["stateOperators"])   # numRowsTotal, memoryUsedBytes
print(q.lastProgress["eventTime"])        # watermark field missing`,
      cause: 'A <code>dropDuplicates("event_id")</code> without a watermark: every event id ever seen is kept in state.',
      fix: 'Bound the state with a watermark. Spark 3.5+ has <code>dropDuplicatesWithinWatermark</code>, which only remembers ids within the watermark delay.',
      fixCode: `deduped = (events.withWatermark("ts", "1 hour")
                 .dropDuplicatesWithinWatermark(["event_id"]))   # Spark 3.5+` },
    { title: 'Duplicate rows in Postgres after a redeploy',
      symptom: 'After a rolling redeploy, a dashboard shows doubled counts for one minute.',
      cause: '<code>foreachBatch</code> appended to a JDBC table. The job died after the write but before the offset commit, so the batch ran again with the same <code>batch_id</code>.',
      fix: 'Make the write idempotent: upsert on the window key so a replay overwrites the same rows.',
      fixCode: `def upsert(df, batch_id):
    df.write.jdbc(url, "staging_counts", mode="overwrite", properties=props)
    # then in Postgres, in one transaction:
    # INSERT INTO counts SELECT * FROM staging_counts
    # ON CONFLICT (window_start, page) DO UPDATE SET n = EXCLUDED.n;
q = counts.writeStream.foreachBatch(upsert).outputMode("update") \\
          .option("checkpointLocation", "/chk/counts").start()` },
    { title: 'Kafka backlog after an outage takes forever to clear',
      symptom: 'After a 6-hour outage, the first micro-batch tries to read 900 M records and runs out of memory.',
      cause: 'No rate limit: the first batch takes everything from the committed offset to the latest.',
      fix: 'Cap each batch so it stays within memory and catch up over many batches.',
      fixCode: `spark.readStream.format("kafka") \\
  .option("subscribe", "clicks") \\
  .option("maxOffsetsPerTrigger", 5_000_000) \\
  .load()` }
  ],
  puzzles: [
    { kind: 'concept', q: 'Windowed count, <code>withWatermark("ts", "10 minutes")</code>, 5-minute windows, <b>append</b> mode. When is the window 12:00–12:05 written?', options: ['In the batch where its first event arrives', 'Every batch, with the running count', 'Once the watermark passes 12:05, i.e. after an event with ts ≥ 12:15 has been seen (and typically one batch later)', 'Never in append mode'], answer: 2, explain: 'Append emits final rows only. The window is final when watermark = max event time − 10 min ≥ 12:05. The watermark is updated at the end of a batch and applied in the next, so output often appears one batch later.' },
    { kind: 'concept', q: 'Which output mode is <b>not</b> allowed for a streaming aggregation <i>without</i> a watermark?', options: ['complete', 'update', 'append', 'All are allowed'], answer: 2, explain: 'Without a watermark Spark can never declare an aggregate final, so append mode fails at start with an AnalysisException. update and complete work (with unbounded state).' },
    { kind: 'concept', q: 'Watermark is 12:20. An event with ts 12:04 arrives for a 5-minute window. What happens?', options: ['It updates the 12:00 window', 'It is dropped (the window’s state is gone)', 'It goes to a dead-letter table automatically', 'The query fails'], answer: 1, explain: 'Data older than the watermark for a stateful operator is dropped (and counted in <code>numRowsDroppedByWatermark</code>). Spark guarantees not to drop data newer than the watermark; older data may be dropped.' },
    { kind: 'concept', q: 'What does <code>trigger(availableNow=True)</code> do?', options: ['Runs continuously with 1 ms latency', 'Processes all data available at start, possibly in several micro-batches respecting rate limits, then stops', 'Runs exactly one micro-batch with everything', 'Reprocesses from the beginning'], answer: 1, explain: 'Spark 3.3+. Unlike the deprecated <code>once=True</code> (one huge batch), it honours options like <code>maxOffsetsPerTrigger</code>. Good for scheduled “incremental batch” jobs.' },
    { kind: 'concept', q: 'What gives end-to-end exactly-once in Structured Streaming?', options: ['Kafka idempotent producer alone', 'Checkpointed offsets + replayable source + idempotent/transactional sink', 'Using complete mode', 'Continuous trigger'], answer: 1, explain: 'Spark records offsets before and commits after each batch, so a failed batch is replayed with the same data. The sink must tolerate the replay (Delta, file sink, or your idempotent upsert).' },
    { kind: 'concept', q: 'You need, per user, a custom session that ends after 30 minutes of inactivity with arbitrary state. Which API?', options: ['groupBy + window', '<code>session_window</code> (3.2+) for simple sessions, or <code>applyInPandasWithState</code> / <code>transformWithState</code> (4.0) for custom logic', 'foreachBatch only', 'A UDF'], answer: 1, explain: '<code>session_window</code> covers gap-based sessions. For custom state machines PySpark offers <code>applyInPandasWithState</code> (3.4+), and Spark 4.0 adds <code>transformWithState</code> with timers and TTL.' }
  ],
  interview: [
    { q: 'How does Structured Streaming work under the hood?', a: '<p>The query is planned once as an incremental plan. Each trigger, the driver asks sources for the latest offsets, writes them to the checkpoint’s <code>offsets/</code> log, runs a batch over that range using state from the state store, writes to the sink, then writes <code>commits/</code>. On restart it compares the two logs to know which batch to redo.</p>', lvl: 'core' },
    { q: 'Explain the three output modes.', a: '<ul><li><b>append</b>: only new, final rows. Works for stateless queries, or aggregations with a watermark.</li><li><b>update</b>: rows that changed in this batch.</li><li><b>complete</b>: the whole result table every batch; only for aggregations, only when small.</li></ul>', lvl: 'core' },
    { q: 'What is a watermark exactly?', a: '<p><code>watermark = max(event time seen so far) − delay</code>, computed at the end of each batch (with multiple inputs, the minimum across them by default). It bounds state: windows ending before it are finalised and removed. Events older than it can be dropped.</p>', fu: 'What is <code>spark.sql.streaming.multipleWatermarkPolicy</code>? (min by default, or max.)', lvl: 'core' },
    { q: 'What’s in a checkpoint?', a: '<p><code>offsets/</code> (planned range per batch), <code>commits/</code> (completed batches), <code>state/</code> (state store snapshots and deltas per operator and partition), <code>metadata</code> (query id), and source-specific folders. It must be on durable storage and is tied to that query.</p>', lvl: 'deep' },
    { q: 'Micro-batch vs continuous processing?', a: '<p>Micro-batch: latency ~ hundreds of ms to seconds, exactly-once, all operators. Continuous (2.3+, still experimental): ~1 ms latency, at-least-once, only map-like operations and a few sources/sinks. Most production jobs use micro-batch.</p>', lvl: 'core' },
    { q: 'How do you write a stream to a database?', a: '<p><code>foreachBatch</code>: you receive each micro-batch as a normal DataFrame plus <code>batch_id</code>, and can use any batch writer (JDBC, Delta MERGE). Make it idempotent. <code>foreach</code> gives row-level callbacks with open/process/close for custom sinks.</p>', lvl: 'core' },
    { q: 'How do you handle state at scale?', a: '<p>Bound it with watermarks or state TTL (<code>transformWithState</code> in 4.0), use the RocksDB state store, partition state by keys well, and watch <code>stateOperators</code> metrics. Changelog checkpointing for RocksDB (3.4+) reduces checkpoint cost.</p>', lvl: 'deep' },
    { q: 'Compare with Kafka Streams or Flink.', a: '<p>Kafka Streams: a library inside your JVM app, per-record processing, Kafka-only. Flink: true per-record streaming with rich event-time state and timers. Spark: micro-batch by default with a unified batch/stream API, strong for lakehouse ETL. Latency below ~100 ms usually points to Flink or Kafka Streams.</p>', lvl: 'deep' },
    { q: 'Can you change a streaming query and keep its checkpoint?', a: '<p>Some changes are safe: adding filters, changing a stateless projection, sink options. Unsafe: changing grouping keys, aggregations, the number of shuffle partitions for stateful queries (fixed by the checkpoint), or source identity. When in doubt, start a new checkpoint and plan a backfill.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Kafka → windowed counts → Delta', lang: 'python', code: `from pyspark.sql import functions as F, types as T

schema = T.StructType([T.StructField("page", T.StringType()), T.StructField("ts", T.TimestampType())])
clicks = (spark.readStream.format("kafka")
          .option("kafka.bootstrap.servers", "broker:9092")
          .option("subscribe", "clicks")
          .option("maxOffsetsPerTrigger", 1_000_000)
          .load()
          .select(F.from_json(F.col("value").cast("string"), schema).alias("e")).select("e.*"))

counts = (clicks.withWatermark("ts", "10 minutes")
          .groupBy(F.window("ts", "5 minutes"), "page").count())

q = (counts.writeStream.format("delta").outputMode("append")
     .option("checkpointLocation", "abfss://chk@acct.dfs.core.windows.net/click_counts")
     .trigger(processingTime="1 minute")
     .toTable("analytics.click_counts"))` },
    { title: 'Monitoring a running query', lang: 'python', code: `p = q.lastProgress
print(p["batchId"], p["numInputRows"], p["inputRowsPerSecond"], p["processedRowsPerSecond"])
print(p["eventTime"].get("watermark"))
for op in p["stateOperators"]:
    print(op["operatorName"], op["numRowsTotal"], op["memoryUsedBytes"], op.get("numRowsDroppedByWatermark"))`, note: 'If <code>processedRowsPerSecond</code> stays below <code>inputRowsPerSecond</code>, the query is falling behind.' }
  ]
});

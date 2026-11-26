/* Tricky Spark: a timed drill of 40 concept questions across all Spark topics, scored per topic, with a review of misses linking back to topic pages. */
IA.widget('tricky-spark', (root, ctx) => {
  const { el, reduced } = ctx;
  const TOPIC = {
    'why-spark': 'Why Spark', 'spark-architecture': 'Architecture', 'rdd-basics': 'RDDs', 'dataframes-basics': 'DataFrames',
    'pyspark-setup': 'Setup', 'reading-writing': 'Reading & writing', 'transformations-aggregations': 'Transformations', 'spark-sql': 'Spark SQL',
    udfs: 'UDFs', 'nulls-types-dates': 'Nulls & types', 'lazy-eval-dag': 'Lazy eval & DAG', 'partitions-shuffle': 'Partitions & shuffle',
    'join-strategies': 'Joins', 'caching-persistence': 'Caching', 'memory-tuning-aqe': 'Memory & AQE', 'structured-streaming': 'Streaming',
    'delta-lake-lakehouse': 'Delta Lake', 'spark-for-java-devs': 'Java devs'
  };
  /*Q-START*/
  const Q = [
    // why-spark
    { s: 'why-spark', q: 'Main reason Spark is usually faster than classic Hadoop MapReduce for multi-step jobs?', o: ['It is written in C++', 'It keeps intermediate data in memory and plans whole DAGs, instead of writing to HDFS between every map/reduce step', 'It doesn’t need a cluster', 'It uses GPUs by default'], a: 1, x: 'MapReduce persists each step’s output to HDFS. Spark pipelines narrow steps inside a stage and only writes shuffle files at stage boundaries (plus caching when asked).' },
    { s: 'why-spark', q: 'Your data is 2 GB and fits on a laptop. Best default?', o: ['A 50-node Spark cluster', 'Single-machine tools (pandas, Polars, DuckDB, Postgres); Spark’s distribution overhead may not pay off', 'Spark Streaming', 'MapReduce'], a: 1, x: 'Spark shines when data or compute exceeds one machine. For small data, startup, scheduling and shuffle overheads dominate.' },
    // spark-architecture
    { s: 'spark-architecture', q: 'Where does <code>df.collect()</code> put the rows?', o: ['On each executor', 'In the driver process’s memory', 'In HDFS', 'In the cluster manager'], a: 1, x: 'collect() returns every row to the driver. Large results cause driver OOM; <code>spark.driver.maxResultSize</code> (1g) guards it.' },
    { s: 'spark-architecture', q: 'Which component decides which tasks run on which executors?', o: ['The cluster manager (YARN/K8s)', 'The driver’s DAG and task schedulers', 'Each executor itself', 'The Hive metastore'], a: 1, x: 'The cluster manager allocates executors (containers/pods); the driver’s schedulers split jobs into stages and tasks and assign them to executor cores.' },
    { s: 'spark-architecture', q: 'One executor with 4 cores runs how many tasks at once by default?', o: ['1', '4', '8', 'Unlimited'], a: 1, x: 'One task per core (<code>spark.task.cpus</code> = 1), so 4 concurrent tasks sharing the executor’s heap.' },
    // rdd-basics
    { s: 'rdd-basics', q: 'How many jobs does this trigger?', code: `rdd = sc.parallelize(range(10)).map(lambda x: x * 2).filter(lambda x: x > 5)`, o: ['0', '1', '2', '3'], a: 0, x: 'Only transformations: <b>0 jobs</b>. map and filter are lazy; nothing runs until an action such as count or collect.' },
    { s: 'rdd-basics', q: 'Which is an <b>action</b>?', o: ['map', 'reduceByKey', 'take', 'union'], a: 2, x: '<code>take(n)</code> returns data to the driver, so it runs a job. reduceByKey is a (wide) transformation.' },
    // dataframes-basics
    { s: 'dataframes-basics', q: '<code>df.withColumn("x", F.lit(1))</code>, then <code>df.show()</code>. Does the output have column x?', o: ['Yes', 'No: DataFrames are immutable; withColumn returns a new DataFrame you didn’t keep', 'Only after cache()', 'Error'], a: 1, x: 'Like Java’s <code>String.replace</code>, it returns a new object. Write <code>df = df.withColumn(…)</code>.' },
    { s: 'dataframes-basics', q: 'Reading CSV with <code>inferSchema=True</code> costs what?', o: ['Nothing', 'An extra pass over the data to infer types', 'It reads only the header', 'It disables partitioning'], a: 1, x: 'Spark scans the data to guess types. In production, pass an explicit schema: faster and no surprises.' },
    // pyspark-setup
    { s: 'pyspark-setup', q: '<code>pip install pyspark</code> on a clean machine, then <code>SparkSession.builder.getOrCreate()</code> fails with “Java gateway process exited”. Most likely?', o: ['Python too new', 'No compatible Java (JDK) installed / JAVA_HOME not set', 'Missing Hadoop cluster', 'Firewall'], a: 1, x: 'PySpark launches a local JVM. Spark 3.5 needs Java 8/11/17; Spark 4.0 needs Java 17 or 21.' },
    { s: 'pyspark-setup', q: 'In local mode, what does <code>master("local[*]")</code> mean?', o: ['Connect to every cluster', 'Run driver and executor in one JVM, with as many worker threads as logical cores', 'One thread', 'Use YARN'], a: 1, x: '<code>local[N]</code> uses N threads; <code>[*]</code> uses all cores. Great for tests and notebooks.' },
    // reading-writing
    { s: 'reading-writing', q: '<code>df.write.mode("overwrite").partitionBy("day").parquet(p)</code> with default settings. What is replaced?', o: ['Only the day partitions present in df', 'The whole output path', 'Nothing; it appends', 'Only the _SUCCESS file'], a: 1, x: 'Default <code>spark.sql.sources.partitionOverwriteMode=static</code> deletes everything under the path. Set it to <code>dynamic</code> to replace only partitions present in df.' },
    { s: 'reading-writing', q: 'A job writes 2,000 files of 50 KB each. Simplest fix?', o: ['More executors', '<code>coalesce(n)</code> / <code>repartition(n)</code> before the write (or <code>maxRecordsPerFile</code>, or Delta OPTIMIZE)', 'Use CSV', 'Increase shuffle partitions'], a: 1, x: 'One file per task per partition value. Fewer, larger output partitions mean fewer files.' },
    // transformations-aggregations
    { s: 'transformations-aggregations', q: 'Window <code>row_number().over(Window.partitionBy("user").orderBy("ts"))</code> on 1 billion rows with one user holding 30%. Risk?', o: ['None', 'One huge window partition handled by one task: skew and spill', 'Wrong results', 'It becomes a broadcast'], a: 1, x: 'Window functions shuffle by the partition key and sort within it. A hot key means one giant task.' },
    { s: 'transformations-aggregations', q: 'A window with no <code>partitionBy</code>:', code: `df.withColumn("rk", F.row_number().over(Window.orderBy("amount")))`, o: ['Runs in parallel', 'Moves all data to a single partition (Spark warns about it)', 'Fails', 'Is broadcast'], a: 1, x: 'Without partitioning, a global order needs all rows in one task: “No Partition Defined for Window operation! Moving all data to a single partition”.' },
    // spark-sql
    { s: 'spark-sql', q: 'SQL vs DataFrame API for the same query: speed?', o: ['SQL is faster', 'DataFrame is faster', 'Same: both produce a logical plan optimised by Catalyst', 'Depends on the language'], a: 2, x: 'Both go through the same analyser, optimiser and physical planner.' },
    { s: 'spark-sql', q: '<code>df.createOrReplaceTempView("t")</code>: who can query <code>t</code>?', o: ['Every Spark application', 'Only this SparkSession', 'All sessions of this application', 'The Hive metastore'], a: 1, x: 'Temp views are session-scoped. <code>createGlobalTempView</code> is application-wide under <code>global_temp</code>. Tables in the catalog persist.' },
    // udfs
    { s: 'udfs', q: 'Why is a Python UDF slower than <code>F.upper</code>?', o: ['Python strings are slower', 'Rows are serialized to Python worker processes and back, and Catalyst can’t optimise inside the UDF', 'UDFs run on the driver', 'UDFs disable parallelism'], a: 1, x: 'Built-ins run as generated JVM code. UDFs are opaque black boxes with serialization overhead.' },
    { s: 'udfs', q: 'A classic (pickled) Python UDF returns a Python <code>int</code> but is declared <code>returnType="double"</code>. Result?', o: ['The int is converted to double', 'NULL for every row, silently', 'Error at definition', 'Error at every row'], a: 1, x: 'Classic Python UDFs return NULL when the returned Python type doesn’t match the declared type (int is not float). Return <code>float(x)</code>. Arrow-optimised UDFs (3.5+) coerce differently, so test the path you use.' },
    // nulls-types-dates
    { s: 'nulls-types-dates', q: '<code>df.filter(F.col("status") != "paid")</code> on rows with status NULL. Are NULL rows kept?', o: ['Yes', 'No: NULL != "paid" is NULL, and filter keeps only true', 'Only in ANSI mode', 'Error'], a: 1, x: 'Three-valued logic, as in Postgres. Use <code>~F.col("status").eqNullSafe("paid")</code> or add <code>| F.col("status").isNull()</code>.' },
    { s: 'nulls-types-dates', q: 'Spark 4.0 with default settings: <code>SELECT CAST(\'abc\' AS INT)</code>?', o: ['NULL', 'Runtime error (ANSI mode is on by default in 4.0)', '0', 'abc'], a: 1, x: 'Spark 4.0 enables <code>spark.sql.ansi.enabled</code> by default, so invalid casts fail. In Spark 3.5 (ANSI off) it returns NULL. <code>try_cast</code> gives NULL in both.' },
    { s: 'nulls-types-dates', q: 'A <code>TimestampType</code> value is displayed using…', o: ['UTC always', 'The session time zone, <code>spark.sql.session.timeZone</code>', 'The executor OS time zone', 'The file’s time zone'], a: 1, x: 'TIMESTAMP (with local time zone semantics) is stored as UTC micros and rendered in the session time zone. Spark 3.4+ also has <code>TIMESTAMP_NTZ</code>.' },
    // lazy-eval-dag
    { s: 'lazy-eval-dag', q: 'What splits a job into stages?', o: ['Every transformation', 'Shuffle boundaries (wide dependencies)', 'Each action', 'Each file'], a: 1, x: 'Narrow transformations are pipelined in one stage. Wide ones (groupBy, join without broadcast, repartition) need a shuffle, starting a new stage.' },
    { s: 'lazy-eval-dag', q: 'You filter after a join in code. Where does Spark apply the filter?', code: `a.join(b, "k").filter(F.col("a_col") > 5)`, o: ['After the join', 'Before the join, on <code>a</code> (predicate pushdown by Catalyst), and possibly in the file scan', 'Only on b', 'Not at all'], a: 1, x: 'Catalyst pushes predicates through joins to the side they refer to, and into Parquet scans (PushedFilters in explain).' },
    { s: 'lazy-eval-dag', q: 'How many jobs does <code>df.count()</code> followed by <code>df.count()</code> run (no cache)?', o: ['1', '2 (each action is its own job; the data is recomputed)', '0', 'It depends on AQE'], a: 1, x: 'Each action submits at least one job. Without cache, the second recomputes from source.' },
    // partitions-shuffle
    { s: 'partitions-shuffle', q: '<code>repartition(10)</code> vs <code>coalesce(10)</code> on a 1,000-partition DataFrame?', o: ['Identical', 'repartition does a full shuffle and balances; coalesce merges partitions without a shuffle (may be uneven, and can reduce upstream parallelism)', 'coalesce shuffles', 'repartition can only increase'], a: 1, x: 'coalesce is cheap but can collapse the whole preceding stage to 10 tasks. repartition costs a shuffle but keeps upstream parallelism.' },
    { s: 'partitions-shuffle', q: 'Default number of partitions after a <code>groupBy</code> (AQE off)?', o: ['Same as input', '200 (<code>spark.sql.shuffle.partitions</code>)', 'Number of cores', '1'], a: 1, x: 'Shuffles use spark.sql.shuffle.partitions = 200. With AQE on, small ones are coalesced.' },
    // join-strategies
    { s: 'join-strategies', q: 'Default <code>autoBroadcastJoinThreshold</code>?', o: ['1 MB', '10 MB', '100 MB', '1 GB'], a: 1, x: '10 MB (of estimated size). <code>-1</code> disables automatic broadcast.' },
    { s: 'join-strategies', q: 'In a FULL OUTER equi-join, which side can be broadcast?', o: ['Left', 'Right', 'Either', 'Neither'], a: 3, x: 'A broadcast hash join can’t produce the unmatched rows of the broadcast side; FULL OUTER preserves both sides, so Spark uses sort-merge (or shuffle hash).' },
    { s: 'join-strategies', q: 'You salt the big side with a random 0–15. The small side must…', o: ['be salted randomly too', 'be exploded to 16 copies, one per salt', 'be broadcast', 'be filtered'], a: 1, x: 'Every big row (k, s) needs a match (k, s), so each small row is replicated for every salt value.' },
    // caching-persistence
    { s: 'caching-persistence', q: 'Default storage level of <code>rdd.cache()</code> vs <code>df.cache()</code>?', o: ['Both MEMORY_ONLY', 'RDD: MEMORY_ONLY; DataFrame: MEMORY_AND_DISK', 'Both MEMORY_AND_DISK', 'RDD: DISK_ONLY'], a: 1, x: 'Different defaults. DataFrame caches also use a compressed columnar format.' },
    { s: 'caching-persistence', q: '<code>df.cache(); df.show()</code>. What is cached?', o: ['All partitions', 'Only the partitions show() needed to compute 20 rows (often one)', 'Nothing', 'Only the schema'], a: 1, x: 'Cache is lazy and filled by whatever the action computes. Use <code>count()</code> to materialise everything.' },
    // memory-tuning-aqe
    { s: 'memory-tuning-aqe', q: 'Executor killed by YARN for exceeding physical memory; no Java OOM. Fix?', o: ['Raise spark.executor.memory', 'Raise spark.executor.memoryOverhead (or pyspark.memory)', 'Lower shuffle partitions', 'Disable AQE'], a: 1, x: 'The container limit is heap + overhead. Off-heap usage (Python workers, netty, native) exceeded overhead.' },
    { s: 'memory-tuning-aqe', q: 'Can AQE increase the number of shuffle partitions of a normal (non-skewed) aggregation?', o: ['Yes, it splits big partitions', 'No: coalescing only merges; set a higher initial number', 'Only with dynamic allocation', 'Only for joins'], a: 1, x: 'AQE splits partitions only for skew joins (and skewed rebalances). Otherwise it merges toward the advisory size.' },
    // structured-streaming
    { s: 'structured-streaming', q: 'Streaming aggregation with no watermark. Which output mode fails to start?', o: ['complete', 'update', 'append', 'none'], a: 2, x: 'Append needs to know when a result is final, which needs a watermark.' },
    { s: 'structured-streaming', q: 'After a crash mid-batch, the last batch reruns with the same batch_id. Which sink design avoids duplicates?', o: ['Plain JDBC append', 'Idempotent upsert keyed on the result key, or a transactional sink like Delta', 'Complete mode', 'More partitions'], a: 1, x: 'Exactly-once = replayable source + checkpoint + idempotent/transactional sink.' },
    // delta-lake-lakehouse
    { s: 'delta-lake-lakehouse', q: 'What makes data written by a failed Delta job invisible to readers?', o: ['Spark deletes it', 'The files are never referenced by a committed log entry', 'Parquet checksums', 'A lock'], a: 1, x: 'Readers only see files listed by committed <code>_delta_log</code> entries. Orphaned files are cleaned later by VACUUM.' },
    { s: 'delta-lake-lakehouse', q: 'MERGE fails with “multiple source rows matched and attempted to modify the same target row”. Fix?', o: ['Retry', 'Deduplicate the source so each key appears once', 'Run OPTIMIZE', 'Turn off schema enforcement'], a: 1, x: 'The update would be ambiguous. Keep one row per key (e.g. latest by timestamp) before MERGE.' },
    // spark-for-java-devs
    { s: 'spark-for-java-devs', q: 'A Java lambda passed to <code>ds.map</code> captures a Spring bean. Typical error?', o: ['ClassCastException', 'Task not serializable', 'OutOfMemoryError', 'No error'], a: 1, x: 'Closures are serialized to executors. Beans, pools and clients usually aren’t Serializable. Create them per partition on the executor.' },
    { s: 'spark-for-java-devs', q: 'Is <code>df.groupBy("k").count()</code> slower in PySpark than in Java?', o: ['Yes, ~10×', 'No: same Catalyst plan executed in executor JVMs', 'Yes, because of the GIL', 'Only with Spark Connect'], a: 1, x: 'DataFrame operations never run Python on the data path. Only Python UDFs and RDD lambdas do.' }
  ];
  /*Q-END*/
  const label = (q) => TOPIC[q.s] || q.s;
  const TOPICS = ['All', ...Object.keys(TOPIC).filter((s) => Q.some((q) => q.s === s))];
  if (!document.getElementById('w-tsp-style')) {
    document.head.append(el('style', { id: 'w-tsp-style', text: `
.w-tsp-bar { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; margin: 8px 0; }
.w-tsp-bar div { height: 100%; background: var(--accent); }
.w-tsp-bar div.low { background: var(--err); }
.w-tsp-opts { display: grid; gap: 6px; margin-top: 10px; }
.w-tsp-opts button { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 9px; padding: 9px 12px; font-size: 14px; cursor: pointer; overflow-wrap: anywhere; }
.w-tsp-opts button:hover:not(:disabled) { border-color: var(--accent); }
.w-tsp-opts button.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 15%, transparent); }
.w-tsp-opts button.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 15%, transparent); }
.w-tsp-opts button:disabled { cursor: default; }
.w-tsp-q { font-size: 16px; margin: 6px 0 8px; }
.w-tsp-rev { border-top: 1px solid var(--border); padding: 10px 0; }
.w-tsp-rev:first-child { border-top: 0; }
` }));
  }
  let topic = 'All'; let count = 10; let secs = 60; let gen = 0; let deck = []; let i = 0; let score = 0; let misses = []; let left = 0; let answered = false; let started = false; let tick = null;
  const seg = (opts, get, set, lab) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': lab });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segT = seg(TOPICS.map((t) => [t, t === 'All' ? 'All' : TOPIC[t]]), () => topic, (v) => { topic = v; reset(); }, 'Topic');
  const segN = seg([[10, '10 questions'], [20, '20'], [40, 'all 40']], () => count, (v) => { count = v; reset(); }, 'Number of questions');
  const segS = seg([[90, 'Slow · 90 s'], [60, 'Normal · 60 s'], [30, 'Fast · 30 s']], () => secs, (v) => { secs = v; reset(); }, 'Time per question');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Start' }); const bStep = el('button', { class: 'btn', text: 'Skip ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const card = el('div', { class: 'card', style: { padding: '14px', marginTop: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segT), el('div', { class: 'w-controls' }, segN, el('span', { class: 'tiny', text: 'time per question' }), segS),
    el('div', { class: 'w-controls' }, bPlay, bStep, bReset), stats, card, narr);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const link = (q) => `<a href="${q.s}.html">${ctx.esc(label(q))}</a>`;
  function shuffle(a) { const r = a.slice(); for (let j = r.length - 1; j > 0; j--) { const m = Math.floor(Math.random() * (j + 1)); [r[j], r[m]] = [r[m], r[j]]; } return r; }
  function renderStats() { stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `question <b>${Math.min(i + 1, deck.length)}</b>/${deck.length}` }), el('span', { class: 'w-stat', html: `score <b>${score}</b>` }), el('span', { class: 'w-stat', html: `missed <b>${misses.length}</b>` }), el('span', { class: 'w-stat', html: `time <b>${started && !answered ? left + ' s' : '–'}</b>` })); }
  function stopTimer() { if (tick) { clearInterval(tick); tick = null; } }
  function show() {
    const q = deck[i]; answered = false; left = secs; card.innerHTML = '';
    const bar = el('div'); const barWrap = el('div', { class: 'w-tsp-bar' }, bar);
    const opts = el('div', { class: 'w-tsp-opts' });
    card.append(el('div', { class: 'w-controls', style: { marginBottom: '0' } }, el('span', { class: 'pill accent', text: label(q) }), el('span', { class: 'tiny', text: `#${i + 1}` })), barWrap, el('div', { class: 'w-tsp-q', html: q.q }));
    if (q.code) card.append(ctx.codeBox(q.code, 'python'));
    q.o.forEach((o, j) => { const b = el('button', { html: `<b>${'ABCD'[j]}.</b> ${o}` }); b.addEventListener('click', () => answer(j)); opts.append(b); });
    card.append(opts);
    const paint = () => { bar.style.width = (left / secs) * 100 + '%'; bar.className = left <= 10 ? 'low' : ''; if (!reduced) bar.style.transition = 'width 1s linear'; };
    paint(); renderStats(); say('Pick an answer before the bar runs out. Skip counts as a miss.');
    stopTimer(); const g = gen;
    tick = setInterval(() => { if (g !== gen || answered) { stopTimer(); return; } left--; paint(); renderStats(); if (left <= 0) answer(-1); }, 1000);
    card.opts = opts;
  }
  function answer(j) {
    if (answered || !started) return; answered = true; stopTimer();
    const q = deck[i]; const ok = j === q.a;
    if (ok) score++; else misses.push({ q, j });
    [...card.opts.children].forEach((b, m) => { b.disabled = true; if (m === q.a) b.classList.add('ok'); else if (m === j) b.classList.add('bad'); });
    card.append(el('div', { class: 'pz-exp', html: (j === -1 ? '<b>Time’s up.</b> ' : j === -2 ? '<b>Skipped.</b> ' : ok ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.x + ` <span class="tiny">More: ${link(q)}</span>` }));
    bStep.textContent = i + 1 < deck.length ? 'Next ›' : 'Finish ›'; renderStats();
    say(ok ? 'Correct. Press Next.' : 'Read the explanation, then press Next.');
  }
  function next() {
    if (!started) return;
    if (!answered) { answer(-2); return; }
    i++; bStep.textContent = 'Skip ›';
    if (i >= deck.length) return finish();
    show();
  }
  function finish() {
    started = false; stopTimer(); bStep.disabled = true; bPlay.textContent = '▶ Again'; card.innerHTML = '';
    const by = {}; deck.forEach((q) => { by[q.s] = by[q.s] || [0, 0]; by[q.s][1]++; }); deck.forEach((q) => { if (!misses.some((m) => m.q === q)) by[q.s][0]++; });
    card.append(el('h3', { text: `Score: ${score} / ${deck.length}`, style: { margin: '0 0 8px' } }),
      el('div', { class: 'w-stats' }, Object.entries(by).map(([s, [a, n]]) => el('span', { class: 'w-stat', html: `<a href="${s}.html">${ctx.esc(TOPIC[s] || s)}</a> <b>${a}/${n}</b>` }))));
    if (misses.length) {
      card.append(el('h4', { text: 'Review your misses', style: { margin: '14px 0 4px' } }));
      misses.forEach(({ q, j }) => { const r = el('div', { class: 'w-tsp-rev' }, el('div', { html: `<span class="pill">${ctx.esc(label(q))}</span> ${q.q}` }));
        if (q.code) r.append(ctx.codeBox(q.code, 'python'));
        r.append(el('div', { class: 'tiny', html: `You: ${j < 0 ? (j === -1 ? 'time ran out' : 'skipped') : q.o[j]} · Correct: <b>${q.o[q.a]}</b>` }), el('div', { class: 'pz-exp', html: q.x + ` Revisit: ${link(q)}.` }));
        card.append(r); });
    } else card.append(el('p', { text: 'No misses. Try “all 40” on Fast.' }));
    renderStats(); say(`Done: ${score}/${deck.length}. ` + (misses.length ? 'Your misses are listed above, each linking to its topic page.' : ''));
  }
  function reset() {
    gen++; stopTimer(); started = false; answered = false; i = 0; score = 0; misses = [];
    const pool = Q.filter((q) => topic === 'All' || q.s === topic);
    deck = shuffle(pool).slice(0, count).map((q) => { const idx = shuffle(q.o.map((_, n) => n)); return Object.assign({}, q, { o: idx.map((n) => q.o[n]), a: idx.indexOf(q.a) }); });
    bPlay.textContent = '▶ Start'; bStep.textContent = 'Skip ›'; bStep.disabled = true; card.innerHTML = '';
    card.append(el('p', { html: `<b>${deck.length}</b> question${deck.length === 1 ? '' : 's'} (${topic === 'All' ? 'all topics' : ctx.esc(TOPIC[topic])}), <b>${secs} s</b> each. Nothing runs: reason it out, like in an interview.`, style: { margin: 0 } }));
    renderStats(); say('Choose a topic, how many questions and the time limit, then press Start.');
  }
  bPlay.addEventListener('click', () => { reset(); started = true; bStep.disabled = false; bPlay.textContent = '↻ Restart'; show(); });
  bStep.addEventListener('click', next);
  bReset.addEventListener('click', reset);
  reset();
});

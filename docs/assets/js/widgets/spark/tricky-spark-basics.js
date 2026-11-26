/* Spark Basics drill: 30 timed beginner concept questions across the 5 Basics topics, scored per topic, with misses linking back to topic pages. */
IA.widget('tricky-spark-basics', (root, ctx) => {
  const { el, reduced } = ctx;
  /*Q-START*/
  const Q = [
    // ---------- Why Spark ----------
    { t: 'Why Spark', s: 'why-spark', q: 'What is the main reason Spark is faster than classic Hadoop MapReduce for multi-step jobs?', o: ['It is written in C++', 'It keeps intermediate data in memory where possible and plans the whole pipeline as one DAG, instead of writing to HDFS after every job', 'It never shuffles data', 'It uses GPUs by default'], a: 1, x: 'MapReduce writes results to disk after each map/reduce job. Spark chains the steps, keeps data in memory where it can, and optimises the whole plan. It still spills and shuffles to disk when needed.' },
    { t: 'Why Spark', s: 'why-spark', q: 'Your data is a 200 MB CSV that fits easily on a laptop. Best tool?', o: ['A 20-node Spark cluster', 'pandas, Polars or DuckDB on one machine: Spark’s startup and coordination overhead is not worth it', 'Spark Streaming', 'MapReduce'], a: 1, x: 'Spark shines when data or compute does not fit on one machine. For small data, a single-machine tool is simpler and usually faster.' },
    { t: 'Why Spark', s: 'why-spark', q: '“Spark is in-memory, so it never touches disk.” True?', o: ['True', 'False: shuffles write files to local disk, and data that does not fit in memory spills to disk', 'True for DataFrames, false for RDDs', 'True unless you call cache()'], a: 1, x: 'Memory is used where possible, not exclusively. Shuffle files and spills are normal, and reading and writing data obviously uses storage.' },
    { t: 'Why Spark', s: 'why-spark', q: 'Is Spark a database?', o: ['Yes, it stores tables', 'No: it is a compute engine that reads and writes data in external storage (files, object stores, tables)', 'Yes, but only with Delta Lake', 'Yes, it replaces Postgres'], a: 1, x: 'Spark processes data; storage lives elsewhere (S3, ADLS, HDFS, Delta/Parquet files). It is not built for low-latency point lookups or transactions like an OLTP database.' },
    { t: 'Why Spark', s: 'why-spark', q: 'How should you process each row of a big DataFrame?', o: ['A Python for-loop over df.collect()', 'Express the work as DataFrame operations (select, filter, groupBy…) so Spark runs it in parallel on the executors', 'One Spark job per row', 'Convert to a Python list first'], a: 1, x: 'Row-by-row loops on the driver throw away the parallelism. Describe <i>what</i> you want with column expressions and let Spark distribute it.' },
    { t: 'Why Spark', s: 'why-spark', q: 'Which languages can you write Spark applications in?', o: ['Only Scala', 'Only Python', 'Scala, Java, Python and SQL (and R via SparkR/sparklyr)', 'Only SQL'], a: 2, x: 'Spark runs on the JVM and is written in Scala, with first-class APIs for Java and Python (PySpark) and SQL. DataFrame code in any of them goes through the same optimiser.' },
    // ---------- Spark architecture ----------
    { t: 'Architecture', s: 'spark-architecture', q: 'Which process plans the job and schedules tasks?', o: ['An executor', 'The driver', 'The cluster manager', 'HDFS NameNode'], a: 1, x: 'The driver runs your <code>main</code> program and the SparkSession, builds the plan, splits it into stages and tasks, and sends tasks to executors.' },
    { t: 'Architecture', s: 'spark-architecture', q: 'What do executors do?', o: ['Plan queries', 'Run tasks on partitions of the data and hold cached data', 'Allocate machines', 'Store the job history only'], a: 1, x: 'Executors are worker JVM processes. Each runs tasks (one per partition per stage) in parallel cores and can keep cached partitions.' },
    { t: 'Architecture', s: 'spark-architecture', q: 'What is the cluster manager’s job?', o: ['Optimising SQL', 'Giving the application resources (machines/containers for the driver and executors), e.g. YARN, Kubernetes or Spark standalone', 'Running the Python code', 'Storing Parquet files'], a: 1, x: 'The cluster manager hands out resources. It does not understand your query; the driver does.' },
    { t: 'Architecture', s: 'spark-architecture', q: 'You call <code>df.collect()</code> on a 500 GB DataFrame. What is the likely result?', o: ['It returns quickly', 'Every row is sent to the driver, which runs out of memory', 'The executors write it to disk', 'Spark samples 1,000 rows'], a: 1, x: '<code>collect()</code> (and <code>toPandas()</code>) bring all data to the single driver process. Use <code>show()</code>, <code>take(n)</code>, <code>limit</code>, or write the result out.' },
    { t: 'Architecture', s: 'spark-architecture', q: 'What is <code>SparkSession</code>?', o: ['A database connection pool', 'The entry point for DataFrame and SQL work; one per application, obtained with SparkSession.builder.getOrCreate()', 'A worker process', 'A per-query object you create for each read'], a: 1, x: '<code>SparkSession</code> (Spark 2.0+) wraps the older SparkContext and SQLContext. <code>getOrCreate()</code> returns the existing session if there is one.' },
    { t: 'Architecture', s: 'spark-architecture', q: 'Where does a Python <code>print()</code> inside a UDF run?', o: ['On the driver, so it shows in your notebook', 'On the executors, so it goes to the executor logs, not your notebook', 'Nowhere: UDFs cannot print', 'In the cluster manager'], a: 1, x: 'Code at the top level of your script runs on the driver. Functions you pass to Spark (UDFs, lambdas in map) are shipped to and run on the executors.' },
    // ---------- RDD basics ----------
    { t: 'RDDs', s: 'rdd-basics', q: 'What does RDD stand for?', o: ['Relational Data Definition', 'Resilient Distributed Dataset', 'Remote Disk Driver', 'Replicated Data Directory'], a: 1, x: 'An RDD is an immutable, partitioned collection that can be rebuilt from its lineage if a partition is lost (that is the “resilient”).' },
    { t: 'RDDs', s: 'rdd-basics', q: 'Which one is an <b>action</b>?', o: ['map', 'filter', 'count', 'flatMap'], a: 2, x: 'Transformations (<code>map</code>, <code>filter</code>, <code>flatMap</code>) describe a new RDD. Actions (<code>count</code>, <code>collect</code>, <code>take</code>, <code>saveAsTextFile</code>) return a result or write output, and start a job.' },
    { t: 'RDDs', s: 'rdd-basics', q: 'You run <code>rdd2 = rdd.map(f)</code> where <code>f</code> raises an error on every row. When do you see the error?', o: ['Immediately on that line', 'Only when an action (e.g. count or collect) runs', 'Never', 'When the SparkSession stops'], a: 1, x: 'Transformations are lazy: they only record lineage. Nothing runs, and nothing fails, until an action triggers a job.' },
    { t: 'RDDs', s: 'rdd-basics', q: 'You call <code>rdd.count()</code> and then <code>rdd.collect()</code> on an uncached RDD built from a file plus several maps. How often is the file read?', o: ['Once', 'Twice: each action recomputes the lineage from the source unless you cache or persist', 'Zero times', 'Once per partition in total'], a: 1, x: 'Without <code>cache()</code>/<code>persist()</code>, every action replays the lineage. Cache only data you reuse.' },
    { t: 'RDDs', s: 'rdd-basics', q: 'Driver code: <code>total = 0; rdd.foreach(lambda x: add(x))</code> where <code>add</code> does <code>global total; total += x</code>. What is <code>total</code> on the driver afterwards?', o: ['The sum of the RDD', '0 (in cluster mode): each executor updates its own copy of the variable', 'An error', 'The count of rows'], a: 1, x: 'Closures are serialised and sent to executors; changes there never come back. Use an action like <code>sum()</code>/<code>reduce</code> or an accumulator.' },
    { t: 'RDDs', s: 'rdd-basics', q: 'For new code, what should you usually use instead of RDDs?', o: ['Nothing; RDDs are the modern API', 'DataFrames / Spark SQL, which go through the Catalyst optimiser', 'MapReduce', 'Python lists'], a: 1, x: 'DataFrames let Spark optimise the plan and use efficient columnar execution. RDDs are still the foundation, and useful for low-level control, but are rarely the first choice.' },
    // ---------- DataFrame basics ----------
    { t: 'DataFrames', s: 'dataframes-basics', q: 'Correct way to filter rows where age &gt; 18 AND country is "SE" in PySpark?', o: ['df.filter(col("age") > 18 and col("country") == "SE")', 'df.filter((col("age") > 18) & (col("country") == "SE"))', 'df.filter(col("age") > 18 & col("country") == "SE")', 'df.where("age > 18" and "country = SE")'], a: 1, x: 'Column conditions use <code>&amp;</code>, <code>|</code>, <code>~</code>, and each side needs parentheses because <code>&amp;</code> binds tighter than <code>&gt;</code>. Python <code>and</code> raises an error on Column objects.' },
    { t: 'DataFrames', s: 'dataframes-basics', q: 'After <code>df.withColumn("x2", col("x") * 2)</code> (result not assigned), what does <code>df.columns</code> show?', o: ['Includes x2', 'The original columns only: DataFrames are immutable; withColumn returns a new DataFrame', 'An error', 'Only x2'], a: 1, x: 'Every transformation returns a new DataFrame. Assign it: <code>df = df.withColumn(…)</code>.' },
    { t: 'DataFrames', s: 'dataframes-basics', q: 'How do you keep only rows where <code>email</code> is null?', o: ['df.filter(col("email") == None)', 'df.filter(col("email").isNull())', 'df.filter(col("email") is None)', 'df.dropna()'], a: 1, x: 'In SQL semantics, comparing with null gives null (not true), so <code>== None</code> matches nothing. Use <code>isNull()</code> / <code>isNotNull()</code>.' },
    { t: 'DataFrames', s: 'dataframes-basics', q: 'What does <code>df.printSchema()</code> show?', o: ['The first 20 rows', 'Column names, data types and whether each is nullable', 'The physical plan', 'The number of partitions'], a: 1, x: 'A DataFrame always has a schema. <code>show()</code> displays rows (20 by default); <code>explain()</code> shows the plan.' },
    { t: 'DataFrames', s: 'dataframes-basics', q: 'You read a large CSV with <code>inferSchema=True</code>. What is the cost?', o: ['None', 'Spark makes an extra pass over the data to guess the types; in production, pass an explicit schema', 'Columns become strings', 'It only reads the header'], a: 1, x: 'Inference reads the data to guess types, and can guess wrong. An explicit <code>StructType</code> or DDL string is faster and safer. Without inference (or a schema), CSV columns are all strings.' },
    { t: 'DataFrames', s: 'dataframes-basics', q: 'Which statement is true about <code>df.select("name")</code> on its own?', o: ['It prints the names', 'It returns a new DataFrame and runs nothing until an action like show() or count()', 'It loads the column into driver memory', 'It writes a file'], a: 1, x: 'Like RDD transformations, DataFrame transformations are lazy. <code>show()</code>, <code>count()</code>, <code>collect()</code> and writes are actions.' },
    // ---------- Setting up PySpark ----------
    { t: 'Setup', s: 'pyspark-setup', q: 'After <code>pip install pyspark</code> on a laptop, what else must be installed to run it locally?', o: ['Hadoop', 'A compatible Java runtime (JDK), since Spark runs on the JVM', 'Scala', 'Nothing at all'], a: 1, x: 'PySpark starts a JVM behind the scenes. Without a suitable Java (or with <code>JAVA_HOME</code> wrong) you get “Java gateway process exited before sending its port number”.' },
    { t: 'Setup', s: 'pyspark-setup', q: 'Which Java versions does Spark 4.x support?', o: ['Java 8 and 11', 'Java 17 and 21', 'Any Java', 'Java 11 only'], a: 1, x: 'Spark 4 dropped Java 8 and 11 and requires Java 17 or 21. Spark 3.5 supported Java 8, 11 and 17.' },
    { t: 'Setup', s: 'pyspark-setup', q: 'What does <code>.master("local[*]")</code> mean?', o: ['Connect to a cluster called local', 'Run Spark in one local process, using as many worker threads as there are CPU cores', 'Run with one thread', 'Use every machine on the network'], a: 1, x: 'Local mode puts driver and executor in one JVM on your machine. <code>local[2]</code> would use two threads. Great for learning and tests.' },
    { t: 'Setup', s: 'pyspark-setup', q: 'On Databricks, how do you get a SparkSession in a notebook?', o: ['Build a new one with your own master URL', 'Use the spark object the platform already created', 'Start a JVM by hand', 'Install pyspark with pip first'], a: 1, x: 'Databricks notebooks come with <code>spark</code> preconfigured for the cluster. Creating your own with a different master breaks things; <code>getOrCreate()</code> just returns the existing one.' },
    { t: 'Setup', s: 'pyspark-setup', q: 'Your notebook says <code>ModuleNotFoundError: pyspark</code> even though you installed it in a venv. Most likely cause?', o: ['pyspark is broken', 'The notebook kernel runs a different Python than the venv you installed into', 'Java is missing', 'You need Hadoop'], a: 1, x: 'Check <code>sys.executable</code> in the notebook and install into that interpreter (or register the venv as a kernel).' },
    { t: 'Setup', s: 'pyspark-setup', q: 'Why pin the pyspark version (e.g. <code>pyspark==3.5.*</code>) in a project?', o: ['It makes pip faster', 'The client must match the cluster’s Spark version; an unpinned install can jump a major version with breaking changes', 'Older versions are free', 'Spark refuses unpinned installs'], a: 1, x: 'Major versions change defaults and remove APIs (Spark 4 changed ANSI mode defaults and Java requirements). Match the version your cluster runs.' }
  ];
  /*Q-END*/
  /*Q-END*/
  const TOPICS = ['All', ...[...new Set(Q.map((q) => q.t))]];
  const slugOf = {}; Q.forEach((q) => { slugOf[q.t] = q.s; });
  if (!document.getElementById('w-tsb-style')) {
    document.head.append(el('style', { id: 'w-tsb-style', text: `
.w-tsb-bar { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; margin: 8px 0; }
.w-tsb-bar div { height: 100%; background: var(--accent); }
.w-tsb-bar div.low { background: var(--err); }
.w-tsb-opts { display: grid; gap: 6px; margin-top: 10px; }
.w-tsb-opts button { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 9px; padding: 9px 12px; font-size: 14px; cursor: pointer; overflow-wrap: anywhere; white-space: pre-line; }
.w-tsb-opts button:hover:not(:disabled) { border-color: var(--accent); }
.w-tsb-opts button.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 15%, transparent); }
.w-tsb-opts button.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 15%, transparent); }
.w-tsb-opts button:disabled { cursor: default; }
.w-tsb-q { font-size: 16px; margin: 6px 0 8px; }
.w-tsb-rev { border-top: 1px solid var(--border); padding: 10px 0; }
.w-tsb-rev:first-child { border-top: 0; }
` }));
  }
  let topic = 'All'; let count = 10; let secs = 60; let gen = 0; let deck = []; let i = 0; let score = 0; let misses = []; let left = 0; let answered = false; let started = false; let tick = null;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segT = seg(TOPICS.map((t) => [t, t]), () => topic, (v) => { topic = v; reset(); }, 'Topic');
  const segN = seg([[10, '10 questions'], [20, '20'], [30, 'all 30']], () => count, (v) => { count = v; reset(); }, 'Number of questions');
  const segS = seg([[90, 'Slow · 90 s'], [60, 'Normal · 60 s'], [30, 'Fast · 30 s']], () => secs, (v) => { secs = v; reset(); }, 'Time per question');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Start' }); const bStep = el('button', { class: 'btn', text: 'Skip ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const card = el('div', { class: 'card', style: { padding: '14px', marginTop: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segT), el('div', { class: 'w-controls' }, segN, el('span', { class: 'tiny', text: 'time per question' }), segS),
    el('div', { class: 'w-controls' }, bPlay, bStep, bReset), stats, card, narr);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function shuffle(a) { const r = a.slice(); for (let j = r.length - 1; j > 0; j--) { const m = Math.floor(Math.random() * (j + 1)); [r[j], r[m]] = [r[m], r[j]]; } return r; }
  function renderStats() { stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `question <b>${Math.min(i + 1, deck.length)}</b>/${deck.length}` }), el('span', { class: 'w-stat', html: `score <b>${score}</b>` }), el('span', { class: 'w-stat', html: `missed <b>${misses.length}</b>` }), el('span', { class: 'w-stat', html: `time <b>${started && !answered ? left + ' s' : '–'}</b>` })); }
  function stopTimer() { if (tick) { clearInterval(tick); tick = null; } }
  function show() {
    const q = deck[i]; answered = false; left = secs; card.innerHTML = '';
    const bar = el('div'); const barWrap = el('div', { class: 'w-tsb-bar' }, bar);
    const opts = el('div', { class: 'w-tsb-opts' });
    card.append(el('div', { class: 'w-controls', style: { marginBottom: '0' } }, el('span', { class: 'pill accent', text: q.t }), q.run ? el('span', { class: 'pill', text: '' }) : null, el('span', { class: 'tiny', text: `#${i + 1}` })), barWrap, el('div', { class: 'w-tsb-q', html: q.q }));
    if (q.code) card.append(ctx.codeBox(q.code, 'python'));
    q.o.forEach((o, j) => { const b = el('button', { html: `<b>${'ABCD'[j]}.</b> ${ctx.esc(o)}` }); b.addEventListener('click', () => answer(j)); opts.append(b); });
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
    card.append(el('div', { class: 'pz-exp', html: (j === -1 ? '<b>Time’s up.</b> ' : j === -2 ? '<b>Skipped.</b> ' : ok ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.x + (q.run ? `<div class="tiny" style="margin-top:6px">Exact output (): <code>${ctx.esc(q.expect).replace(/\n/g, ' ⏎ ')}</code></div>` : '') + `<div class="tiny" style="margin-top:6px">Topic: <a href="${q.s}.html">${ctx.esc(q.t)}</a></div>` }));
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
    const by = {}; deck.forEach((q) => { by[q.t] = by[q.t] || [0, 0]; by[q.t][1]++; }); deck.forEach((q) => { if (!misses.some((m) => m.q === q)) by[q.t][0]++; });
    card.append(el('h3', { text: `Score: ${score} / ${deck.length}`, style: { margin: '0 0 8px' } }),
      el('div', { class: 'w-stats' }, Object.entries(by).map(([t, [a, n]]) => el('span', { class: 'w-stat', html: `<a href="${slugOf[t]}.html">${t}</a> <b>${a}/${n}</b>` }))));
    if (misses.length) {
      card.append(el('h4', { text: 'Review your misses', style: { margin: '14px 0 4px' } }));
      misses.forEach(({ q, j }) => { const r = el('div', { class: 'w-tsb-rev' }, el('div', { html: `<span class="pill">${q.t}</span> ${q.q}` }));
        if (q.code) r.append(ctx.codeBox(q.code, 'python'));
        r.append(el('div', { class: 'tiny', html: `You: ${j < 0 ? (j === -1 ? 'time ran out' : 'skipped') : ctx.esc(q.o[j])} · Correct: <b>${ctx.esc(q.o[q.a])}</b>` }), el('div', { class: 'pz-exp', html: q.x + ` <a href="${q.s}.html">Review the topic →</a>` }));
        card.append(r); });
    } else card.append(el('p', { text: 'No misses. Try “all 30” on Fast.' }));
    renderStats(); say(`Done: ${score}/${deck.length}. ` + (misses.length ? 'Your misses are listed above with explanations.' : ''));
  }
  function reset() {
    gen++; stopTimer(); started = false; answered = false; i = 0; score = 0; misses = [];
    const pool = Q.filter((q) => topic === 'All' || q.t === topic); deck = shuffle(pool).slice(0, count);
    bPlay.textContent = '▶ Start'; bStep.textContent = 'Skip ›'; bStep.disabled = true; card.innerHTML = '';
    card.append(el('p', { html: `<b>${deck.length}</b> question${deck.length === 1 ? '' : 's'} (${topic === 'All' ? 'all topics' : topic}), <b>${secs} s</b> each. No running code: predict the result in your head, like in an interview.`, style: { margin: 0 } }));
    renderStats(); say('Choose a topic, how many questions and the time limit, then press Start.');
  }
  bPlay.addEventListener('click', () => { reset(); started = true; bStep.disabled = false; bPlay.textContent = '↻ Restart'; show(); });
  bStep.addEventListener('click', next);
  bReset.addEventListener('click', reset);
  reset();
});

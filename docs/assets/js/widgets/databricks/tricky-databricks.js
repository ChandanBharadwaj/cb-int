/* Tricky Databricks: a timed drill of 40 concept questions across all 15 Databricks topics, scored per topic, with a review of misses linking back to topic pages. */
IA.widget('tricky-databricks', (root, ctx) => {
  const { el, reduced } = ctx;
  const TOPIC = {
    'dbx-what-is-databricks': 'What it is', 'dbx-workspace-compute': 'Compute', 'dbx-notebooks-git': 'Notebooks & Git',
    'dbx-unity-catalog': 'Unity Catalog', 'dbx-delta-tables': 'Delta tables', 'dbx-medallion': 'Medallion',
    'dbx-auto-loader': 'Auto Loader', 'dbx-declarative-pipelines': 'Declarative pipelines', 'dbx-jobs-workflows': 'Jobs',
    'dbx-streaming': 'Streaming', 'dbx-sql-warehouses': 'SQL warehouses', 'dbx-performance': 'Performance',
    'dbx-mlflow': 'MLflow', 'dbx-asset-bundles': 'Bundles & CI/CD', 'dbx-cost-governance': 'Cost & governance'
  };
  /*Q-START*/
  const Q = [
    // what is databricks
    { s: 'dbx-what-is-databricks', q: 'In the lakehouse model, where does the table data physically live?', o: ['Inside a proprietary Databricks database server', 'As open-format files (Delta/Parquet) in cloud object storage', 'In the driver’s local disk', 'In the control plane'], a: 1, x: 'Data sits in object storage (S3, ADLS, GCS) as Parquet files plus a Delta transaction log. Compute is separate and can be turned off without losing data.' },
    { s: 'dbx-what-is-databricks', q: 'Which part of a classic (non-serverless) Databricks deployment runs the cluster VMs?', o: ['The control plane, in Databricks’ account', 'The compute plane, in your cloud account', 'Always a shared multi-tenant pool', 'Your laptop'], a: 1, x: 'Classic compute runs in your cloud subscription (the compute plane). The control plane (web app, job scheduler, notebooks) is hosted by Databricks. Serverless compute runs in a Databricks-managed compute plane instead.' },
    // workspace & compute
    { s: 'dbx-workspace-compute', q: 'A nightly job is configured to run on an existing all-purpose cluster. The most common objection in review?', o: ['All-purpose clusters can’t run Python', 'It shares a long-lived interactive cluster and is typically billed at a higher rate than job compute', 'Jobs can only run on SQL warehouses', 'It disables retries'], a: 1, x: 'Job compute is created for the run and terminated after it, isolating the job. All-purpose compute is meant for interactive work and typically has a higher DBU rate. Check your price list for exact rates.' },
    { s: 'dbx-workspace-compute', q: 'What does the Databricks Runtime version on a cluster determine?', o: ['Only the Python version', 'The bundled Spark version, Delta features, libraries and language versions', 'The cloud region', 'The workspace URL'], a: 1, x: 'A runtime (e.g. an LTS release) pins Spark, Delta, Scala, Python and preinstalled libraries. Upgrading it can change behaviour, so pin LTS for production jobs.' },
    { s: 'dbx-workspace-compute', q: 'Unity Catalog access mode “dedicated” (formerly single user) vs “standard” (formerly shared). Which is true?', o: ['Standard lets several users share a cluster with isolation between them', 'Dedicated is the only mode that can read UC tables', 'Standard runs only SQL', 'They are identical'], a: 0, x: 'Standard (shared) mode isolates users on one cluster, with some language and API limits. Dedicated assigns the cluster to one user or group. Both can use Unity Catalog. Names changed in 2025, so check your workspace.' },
    // notebooks & git
    { s: 'dbx-notebooks-git', q: 'What does <code>%run ./utils</code> do in a notebook?', o: ['Starts utils as a separate job', 'Runs the utils notebook inline, so its functions and variables land in the caller’s scope', 'Imports utils as a Python module with its own namespace', 'Deploys utils to production'], a: 1, x: '<code>%run</code> executes the other notebook in the same context. <code>dbutils.notebook.run()</code>, in contrast, starts it as a separate ephemeral run and only returns a string.' },
    { s: 'dbx-notebooks-git', q: 'You need a secret in a notebook. Best option?', o: ['Paste it in a cell and clear the output', '<code>dbutils.secrets.get(scope, key)</code>', 'Put it in a widget default', 'Store it in a Git folder'], a: 1, x: 'Secret scopes keep the value out of code, and notebook output redacts it. Never commit secrets to Git folders.' },
    // unity catalog
    { s: 'dbx-unity-catalog', q: 'A user has <code>SELECT</code> on <code>main.sales.orders</code> but the query fails with a permission error. What is most likely missing?', o: ['MODIFY on the table', '<code>USE CATALOG</code> on main and <code>USE SCHEMA</code> on sales', 'CREATE TABLE on the schema', 'Workspace admin'], a: 1, x: 'Unity Catalog needs USE CATALOG and USE SCHEMA on the parents as well as SELECT on the table. That is the most common “I granted it, why can’t they read it?” issue.' },
    { s: 'dbx-unity-catalog', q: 'The three-level name in Unity Catalog is…', o: ['workspace.database.table', 'catalog.schema.table', 'metastore.catalog.table', 'account.schema.table'], a: 1, x: '<code>catalog.schema.object</code>. The metastore sits above catalogs (typically one per region) and is not part of the name.' },
    { s: 'dbx-unity-catalog', q: 'Where do you put raw non-tabular files (PDFs, CSV drops) under Unity Catalog governance?', o: ['DBFS root', 'A volume: <code>/Volumes/catalog/schema/volume/…</code>', 'The driver’s /tmp', 'A Git folder'], a: 1, x: 'Volumes govern files with the same grants model as tables. DBFS root and mounts are legacy patterns.' },
    // delta tables
    { s: 'dbx-delta-tables', q: 'You <code>DROP TABLE</code> a <b>managed</b> UC table. What happens to its data files?', o: ['Nothing, they stay forever', 'They are deleted by Unity Catalog (after a retention window, you may UNDROP within it)', 'They move to an external location', 'They are archived to Glacier'], a: 1, x: 'Managed tables: UC owns the files and removes them (UNDROP can recover within a limited window). External tables: DROP removes only metadata.' },
    { s: 'dbx-delta-tables', q: 'Time travel to a version from 30 days ago fails after a <code>VACUUM</code> with default settings. Why?', o: ['Time travel only works for 1 hour', 'VACUUM removed data files older than the retention threshold (7 days by default)', 'The table was not partitioned', 'Photon disables time travel'], a: 1, x: 'VACUUM deletes unreferenced files older than <code>delta.deletedFileRetentionDuration</code> (default 7 days). The log entry may remain, but the files are gone.' },
    { s: 'dbx-delta-tables', q: 'MERGE fails with “multiple source rows matched the same target row”. Fix?', o: ['Add OPTIMIZE first', 'Deduplicate the source on the merge key before MERGE', 'Use INSERT OVERWRITE', 'Disable deletion vectors'], a: 1, x: 'MERGE requires at most one source row per target row. Dedup with <code>row_number()</code> over the key, ordered by an event timestamp.' },
    // medallion
    { s: 'dbx-medallion', q: 'Which layer should keep data closest to how the source sent it?', o: ['Gold', 'Silver', 'Bronze', 'None: always clean on ingest'], a: 2, x: 'Bronze is raw and append-only, so you can replay silver/gold when logic changes. Silver is cleaned and conformed. Gold is business-level aggregates.' },
    { s: 'dbx-medallion', q: 'A daily silver load uses <code>INSERT INTO</code> and a failed run was retried. Result?', o: ['Nothing, Delta dedups automatically', 'Duplicate rows for that day', 'The retry fails', 'Delta rolls back the first run'], a: 1, x: 'Plain appends are not idempotent. Use MERGE on a key, or replace the day’s slice with <code>REPLACE WHERE</code>, so a rerun yields the same result.' },
    { s: 'dbx-medallion', q: 'SCD type 2 for a customer dimension means…', o: ['Overwrite the row on change', 'Keep history: close the old row (end date / is_current = false) and insert a new current row', 'Store changes in a separate log table only', 'Delete and recreate the table nightly'], a: 1, x: 'Type 1 overwrites. Type 2 keeps every version with validity columns, so facts can join to the version valid at that time.' },
    // auto loader
    { s: 'dbx-auto-loader', q: 'What keeps Auto Loader from re-ingesting files it already processed?', o: ['File names stored in a Delta table you manage', 'The stream checkpoint, which tracks discovered files', 'The files are deleted after reading', 'It cannot; you must dedup'], a: 1, x: 'Auto Loader (<code>cloudFiles</code>) records ingested files in the checkpoint (a RocksDB-backed state). Delete the checkpoint and it starts over.' },
    { s: 'dbx-auto-loader', q: 'With schema evolution mode <code>addNewColumns</code> (the default when no schema is given), a new column appears. What happens?', o: ['The column is silently dropped', 'The stream fails once with an error, updates the schema, and succeeds after a restart', 'The whole table is rewritten', 'Values go to _rescued_data forever'], a: 1, x: 'By design the stream stops with an <code>UnknownFieldException</code>, records the new schema, and picks it up on restart. Jobs with retries handle this automatically.' },
    // declarative pipelines
    { s: 'dbx-declarative-pipelines', q: 'In Lakeflow Declarative Pipelines (formerly DLT), an expectation with <code>ON VIOLATION DROP ROW</code> does what?', o: ['Fails the update', 'Drops failing rows and records the count in the event log', 'Moves rows to quarantine automatically', 'Only logs a warning and keeps the row'], a: 1, x: 'Three actions: warn (default, keep row), DROP ROW, FAIL UPDATE. Metrics land in the pipeline event log. Quarantine tables are a pattern you build yourself.' },
    { s: 'dbx-declarative-pipelines', q: 'Streaming table vs materialized view: which one processes only new input incrementally, append style?', o: ['Materialized view', 'Streaming table', 'Both always recompute fully', 'Neither'], a: 1, x: 'A streaming table reads each input record once. A materialized view returns the result of its query, refreshed incrementally when possible or fully otherwise.' },
    // jobs
    { s: 'dbx-jobs-workflows', q: 'Task C depends on A and B with <code>run_if: ALL_SUCCESS</code>. A fails, B succeeds. C is…', o: ['Run', 'Not run: marked “Upstream failed”', 'Retried', 'Run after A is retried by C'], a: 1, x: 'With ALL_SUCCESS, C runs only if every dependency succeeded. Use <code>ALL_DONE</code> for cleanup tasks that must always run, or <code>AT_LEAST_ONE_SUCCESS</code> / <code>NONE_FAILED</code> for other patterns.' },
    { s: 'dbx-jobs-workflows', q: 'A 6-task job failed at task 5. What does “Repair run” do?', o: ['Reruns all 6 tasks', 'Reruns only the failed task(s) and their downstream tasks, in the same run', 'Creates a new job', 'Rolls back writes of tasks 1–4'], a: 1, x: 'Repair reruns the unsuccessful tasks and their dependents. Successful tasks are kept. It does not undo writes, so tasks still need to be idempotent.' },
    { s: 'dbx-jobs-workflows', q: 'How does task A hand a small value (a row count) to task B in the same job run?', o: ['Global Python variable', '<code>dbutils.jobs.taskValues.set()</code> in A, read in B as <code>{{tasks.A.values.key}}</code> or <code>taskValues.get()</code>', 'Write to driver /tmp', 'It is impossible'], a: 1, x: 'Task values are small JSON-serializable values. Each task may run on a different cluster, so memory and local disk are not shared.' },
    // streaming
    { s: 'dbx-streaming', q: 'A streaming job runs as a scheduled job every hour, processes what’s new, and stops. Best trigger?', o: ['processingTime="1 hour"', '<code>availableNow=True</code>', 'continuous', 'No trigger'], a: 1, x: '<code>availableNow</code> processes everything available (in several batches, respecting rate limits) and then stops. <code>once</code> is the older single-batch version and is deprecated.' },
    { s: 'dbx-streaming', q: 'You change the Kafka <code>startingOffsets</code> option on a running query and restart it with the same checkpoint. Effect?', o: ['It restarts from the new offsets', 'Nothing: offsets come from the checkpoint; startingOffsets applies only to a new query', 'The query fails', 'It reprocesses everything'], a: 1, x: 'The checkpoint wins. To really reset, use a new checkpoint location (and think about duplicates downstream).' },
    { s: 'dbx-streaming', q: 'Why is <code>foreachBatch</code> + MERGE a common sink pattern, and what must you guard against?', o: ['It is faster than append; guard against nothing', 'It allows upserts per micro-batch; a batch can be replayed after failure, so writes must be idempotent', 'It disables checkpoints', 'It only works with Kafka'], a: 1, x: 'foreachBatch is at-least-once. Make the MERGE idempotent, or use Delta’s <code>txnAppId</code>/<code>txnVersion</code> writer options with the batch id.' },
    // sql warehouses
    { s: 'dbx-sql-warehouses', q: 'Many BI users see queued queries; each query is fast once it starts. First knob to turn?', o: ['Bigger warehouse size (T-shirt)', 'Raise max clusters (scale out)', 'Turn off the result cache', 'Add partitions'], a: 1, x: 'Queueing with fast individual queries is a concurrency problem: add clusters. Slow single queries (spill, big scans) are a size problem: scale up.' },
    { s: 'dbx-sql-warehouses', q: 'Which warehouse type starts in seconds and is managed in the Databricks account?', o: ['Classic', 'Pro', 'Serverless', 'All three equally'], a: 2, x: 'Serverless SQL warehouses run in Databricks’ serverless compute plane with fast startup. Classic and Pro run in your cloud account. Availability depends on region and cloud.' },
    { s: 'dbx-sql-warehouses', q: 'A dashboard query returns instantly the second time, even on a stopped-and-restarted warehouse. Most likely reason?', o: ['Photon', 'The query result cache', 'Z-ordering', 'Liquid clustering'], a: 1, x: 'Databricks SQL caches query results; identical queries on unchanged data can be served from cache. Changes to the underlying table invalidate it.' },
    // performance
    { s: 'dbx-performance', q: 'Photon accelerates a job, except one stage that uses a Python UDF. Why?', o: ['Photon does not support Python UDFs, so that part runs outside Photon', 'Photon only runs SQL', 'UDFs are always faster', 'Photon caches UDFs'], a: 0, x: 'Photon is a native vectorized engine. Unsupported operators fall back to the regular Spark engine. Prefer built-in functions; the query profile shows which operators ran in Photon.' },
    { s: 'dbx-performance', q: 'Delta collects min/max stats for data skipping on how many columns by default?', o: ['All columns', 'The first 32 columns', 'Only partition columns', 'None until ANALYZE'], a: 1, x: '<code>delta.dataSkippingNumIndexedCols</code> defaults to 32 (newer runtimes also support <code>delta.dataSkippingStatsColumns</code>). Put filter columns early or configure them explicitly.' },
    { s: 'dbx-performance', q: 'A 200 GB table is partitioned by <code>customer_id</code> (2M values). Main problem?', o: ['Too few files', 'Millions of tiny files and directories: slow listing and poor scans', 'Photon refuses to read it', 'No problem'], a: 1, x: 'High-cardinality partitioning explodes the file count. Databricks guidance is to avoid partitioning small tables (under about 1 TB) and use liquid clustering instead.' },
    // mlflow
    { s: 'dbx-mlflow', q: 'In the Unity Catalog model registry, how do you mark the production version?', o: ['Transition stage to “Production”', 'Set an alias such as <code>@champion</code> on the version', 'Rename the model', 'Delete older versions'], a: 1, x: 'Stages belong to the legacy workspace registry. In UC, aliases point at versions, and you load <code>models:/cat.schema.model@champion</code>.' },
    { s: 'dbx-mlflow', q: 'Registering a model to Unity Catalog fails: “model signature missing”. Fix?', o: ['Use a larger cluster', 'Log the model with a signature (or <code>input_example</code> so it can be inferred)', 'Register to the workspace registry instead', 'Remove the conda env'], a: 1, x: 'UC requires models to have a signature (input/output schema). Pass <code>signature=infer_signature(X, y_pred)</code> or an <code>input_example</code>.' },
    { s: 'dbx-mlflow', q: 'Params vs metrics in an MLflow run:', o: ['Both can be logged many times per step', 'Params are fixed inputs logged once; metrics are numeric values that can be logged over steps', 'Metrics are strings', 'Params are only for deep learning'], a: 1, x: 'Params (hyperparameters) are logged once per run and are immutable. Metrics (loss, accuracy) can have a history per step.' },
    // bundles
    { s: 'dbx-asset-bundles', q: 'Deploying a bundle to a target with <code>mode: development</code> typically…', o: ['Runs as a service principal and enables schedules', 'Prefixes resource names with <code>[dev username]</code> and pauses schedules and triggers', 'Deletes production jobs', 'Skips validation'], a: 1, x: 'Development mode isolates each developer’s copy and pauses schedules. <code>mode: production</code> adds checks, for example around run_as and Git branch.' },
    { s: 'dbx-asset-bundles', q: 'CI deploys a bundle to prod. Who should the jobs run as?', o: ['The engineer who merged the PR', 'A service principal, via <code>run_as</code>, authenticated with OAuth (M2M or workload identity federation)', 'The workspace admin user', 'Anonymous'], a: 1, x: 'Jobs owned by a person break when they leave and run with too much access. A service principal gives a stable, least-privilege identity.' },
    { s: 'dbx-asset-bundles', q: 'You removed a job from <code>databricks.yml</code> and redeployed. What happens to the job in the workspace?', o: ['It keeps running unmanaged', 'The bundle deletes it, because the deployment state tracks resources it created', 'Deploy fails', 'It is paused'], a: 1, x: 'Bundles keep deployment state per target; resources removed from config are destroyed on the next deploy. Review <code>bundle deploy</code> output (and plan) before deploying to prod.' },
    // cost & governance
    { s: 'dbx-cost-governance', q: 'Where do you query DBU consumption per job or per tag across the account?', o: ['Spark UI', '<code>system.billing.usage</code> (joined to <code>system.billing.list_prices</code>)', 'Driver logs', 'The cloud VM bill only'], a: 1, x: 'Billing system tables hold usage records with SKU, quantity, usage metadata (job id, warehouse id) and custom tags. Join list prices for list-price estimates; your contract may differ.' },
    { s: 'dbx-cost-governance', q: 'How do you stop users from creating 100-node all-purpose clusters with no auto-termination?', o: ['Ask nicely in Slack', 'A compute (cluster) policy that limits node types, max workers and enforces auto-termination, and grant only that policy', 'Disable the workspace', 'Use a larger driver'], a: 1, x: 'Policies fix or bound cluster attributes and can force tags. Combine with removing unrestricted cluster creation for most users.' }
  ];
  /*Q-END*/
  const label = (q) => TOPIC[q.s] || q.s;
  const TOPICS = ['All', ...Object.keys(TOPIC).filter((s) => Q.some((q) => q.s === s))];
  if (!document.getElementById('w-tdbx-style')) {
    document.head.append(el('style', { id: 'w-tdbx-style', text: `
.w-tdbx-bar { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; margin: 8px 0; }
.w-tdbx-bar div { height: 100%; background: var(--accent); }
.w-tdbx-bar div.low { background: var(--err); }
.w-tdbx-opts { display: grid; gap: 6px; margin-top: 10px; }
.w-tdbx-opts button { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 9px; padding: 9px 12px; font-size: 14px; cursor: pointer; overflow-wrap: anywhere; }
.w-tdbx-opts button:hover:not(:disabled) { border-color: var(--accent); }
.w-tdbx-opts button.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 15%, transparent); }
.w-tdbx-opts button.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 15%, transparent); }
.w-tdbx-opts button:disabled { cursor: default; }
.w-tdbx-q { font-size: 16px; margin: 6px 0 8px; }
.w-tdbx-rev { border-top: 1px solid var(--border); padding: 10px 0; }
.w-tdbx-rev:first-child { border-top: 0; }
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
    const bar = el('div'); const barWrap = el('div', { class: 'w-tdbx-bar' }, bar);
    const opts = el('div', { class: 'w-tdbx-opts' });
    card.append(el('div', { class: 'w-controls', style: { marginBottom: '0' } }, el('span', { class: 'pill accent', text: label(q) }), el('span', { class: 'tiny', text: `#${i + 1}` })), barWrap, el('div', { class: 'w-tdbx-q', html: q.q }));
    if (q.code) card.append(ctx.codeBox(q.code, q.l || 'python'));
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
      misses.forEach(({ q, j }) => { const r = el('div', { class: 'w-tdbx-rev' }, el('div', { html: `<span class="pill">${ctx.esc(label(q))}</span> ${q.q}` }));
        if (q.code) r.append(ctx.codeBox(q.code, q.l || 'python'));
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

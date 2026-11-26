/* Databricks basics drill: a timed drill of 30 beginner / first-interview concept questions across the 5 Databricks Basics topics, from the lakehouse idea to Delta tables. Misses link back to the topic pages. */
IA.widget('tricky-databricks-basics', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  /*Q-START*/
  const Q = [
    // ---------- What Databricks is ----------
    { t: 'What Databricks is', s: 'dbx-what-is-databricks', q: 'What is a “lakehouse” in one sentence?', o: ['A data warehouse with its own proprietary storage', 'Open table files (Delta) on cheap object storage, plus a catalog and engines that all read the same tables', 'A Hadoop cluster', 'A BI dashboard tool'], a: 1, x: 'Warehouse features (ACID, SQL, governance) on data-lake storage, without copying data between systems.' },
    { t: 'What Databricks is', s: 'dbx-what-is-databricks', q: 'Where does your table data physically live on Databricks?', o: ['Inside the Databricks control plane only', 'As open files in cloud object storage (S3, ADLS, GCS) in your cloud account', 'On the driver’s local disk', 'In a Postgres database'], a: 1, x: 'Compute and storage are separate. Clusters can come and go; the files stay.' },
    { t: 'What Databricks is', s: 'dbx-what-is-databricks', q: 'Which three pieces form the core of Databricks?', o: ['Kafka, Hive, Oozie', 'Spark (compute), Delta Lake (tables), Unity Catalog (governance)', 'Docker, Kubernetes, Helm', 'Python, R, Scala'], a: 1, x: 'Plus tooling around them: notebooks, jobs, SQL warehouses, ML features.' },
    { t: 'What Databricks is', s: 'dbx-what-is-databricks', q: 'Which clouds does Databricks run on?', o: ['Only AWS', 'AWS, Azure and Google Cloud', 'Only Azure', 'Only on-premises'], a: 1, x: 'The workspace experience is mostly the same; storage and networking details differ per cloud.' },
    { t: 'What Databricks is', s: 'dbx-what-is-databricks', q: 'A common short answer to “Databricks vs Snowflake”?', o: ['They are the same product', 'Databricks grew from Spark and open files for engineering and ML; Snowflake grew as a managed SQL warehouse. Both now overlap a lot', 'Snowflake cannot run SQL', 'Databricks cannot run SQL'], a: 1, x: 'Give the origins, then say the overlap is large and the choice often depends on workload and team skills.' },
    { t: 'What Databricks is', s: 'dbx-what-is-databricks', q: 'Why does it matter that Delta is an <b>open</b> format?', o: ['It makes storage free', 'Other engines and tools can read the same files without exporting them, so you are not locked into one vendor’s storage', 'It means anyone on the internet can read your tables', 'It disables permissions'], a: 1, x: 'Open format is about portability, not public access. Unity Catalog still controls who can read what.' },
    // ---------- Workspace & compute ----------
    { t: 'Workspace & compute', s: 'dbx-workspace-compute', q: 'A nightly production job runs on a shared all-purpose cluster. What is the usual advice?', o: ['Perfect, keep it', 'Use job compute (or serverless jobs): created for the run, isolated, cheaper per DBU, terminated after', 'Use a SQL warehouse for PySpark', 'Run it on your laptop'], a: 1, x: 'All-purpose is for humans working interactively; jobs should not compete with them or depend on someone’s cluster.' },
    { t: 'Workspace & compute', s: 'dbx-workspace-compute', q: 'Why set auto-termination on all-purpose clusters?', o: ['It speeds up queries', 'An idle cluster still bills; auto-termination stops it after N idle minutes', 'It is required for Python', 'It deletes your notebooks'], a: 1, x: 'Forgotten interactive clusters are the most common way to burn DBUs.' },
    { t: 'Workspace & compute', s: 'dbx-workspace-compute', q: 'Analysts want to run SQL dashboards from a BI tool. Which compute?', o: ['An all-purpose cluster per analyst', 'A SQL warehouse', 'Job compute', 'The driver node only'], a: 1, x: 'SQL warehouses are built for SQL/BI concurrency and connect to BI tools via JDBC/ODBC.' },
    { t: 'Workspace & compute', s: 'dbx-workspace-compute', q: 'Why pin an LTS Databricks Runtime version for production jobs?', o: ['LTS is free', 'Stable, long-supported versions of Spark and libraries so the job does not change behaviour by surprise', 'Only LTS supports SQL', 'It disables Photon'], a: 1, x: 'Upgrade on purpose and test, instead of drifting to whatever is newest.' },
    { t: 'Workspace & compute', s: 'dbx-workspace-compute', q: 'In a cluster, where does your notebook’s plain Python code (not Spark operations) run?', o: ['On every worker in parallel', 'On the driver', 'In the SQL warehouse', 'In the browser'], a: 1, x: 'The driver runs your code and plans Spark jobs; workers run the tasks. A Python loop over rows does not scale out.' },
    { t: 'Workspace & compute', s: 'dbx-workspace-compute', q: 'What is the main trade-off of serverless compute?', o: ['It cannot run Python', 'Fast start and no VMs to manage, but less control over the cluster setup (e.g. instance types, some configs)', 'It needs a VPN', 'It only runs on weekends'], a: 1, x: 'Databricks manages the machines; you trade configuration knobs for convenience and quick start-up.' },
    // ---------- Notebooks & Git ----------
    { t: 'Notebooks & Git', s: 'dbx-notebooks-git', q: 'What does <code>%sql</code> at the top of a cell do in a Python notebook?', o: ['Imports a SQL library', 'Runs that cell as SQL on the same cluster', 'Converts the notebook to SQL', 'Comments out the cell'], a: 1, x: 'Magic commands switch the cell language (<code>%python</code>, <code>%sql</code>, <code>%md</code>, <code>%sh</code>…).' },
    { t: 'Notebooks & Git', s: 'dbx-notebooks-git', q: '<code>%run ./helpers</code> vs <code>dbutils.notebook.run("./helpers", 60)</code>: the key difference?', o: ['None', '<code>%run</code> inlines the notebook so its functions/variables appear in yours; <code>dbutils.notebook.run</code> runs it as a separate job and returns only a string', '<code>%run</code> is asynchronous', '<code>dbutils.notebook.run</code> shares variables'], a: 1, x: 'Use %run to share helper code; notebook.run to call a notebook like a function with parameters and an exit value.' },
    { t: 'Notebooks & Git', s: 'dbx-notebooks-git', q: 'How should a notebook read a database password?', o: ['Hard-code it in a cell', '<code>dbutils.secrets.get(scope, key)</code> from a secret scope', 'Store it in a widget default', 'Print it once and copy it'], a: 1, x: 'Secret values are redacted in notebook output, and the password never lands in Git.' },
    { t: 'Notebooks & Git', s: 'dbx-notebooks-git', q: 'What are Git folders (formerly “Repos”) for?', o: ['Storing table data', 'Syncing notebooks and files with a remote Git repo: branches, commits, pull/push', 'Running SQL warehouses', 'Backing up clusters'], a: 1, x: 'Version control and code review for notebook code.' },
    { t: 'Notebooks & Git', s: 'dbx-notebooks-git', q: 'A production job runs a notebook from a colleague’s personal workspace folder. What is the risk?', o: ['None', 'Anyone editing that copy changes production; there is no review or version. Run jobs from a Git ref or a deployed bundle', 'It runs slower', 'Personal folders cannot run jobs'], a: 1, x: 'Production should run reviewed code from a known branch, tag or bundle deployment.' },
    { t: 'Notebooks & Git', s: 'dbx-notebooks-git', q: 'Which <code>dbutils</code> module lists and copies files?', o: ['<code>dbutils.widgets</code>', '<code>dbutils.fs</code>', '<code>dbutils.secrets</code>', '<code>dbutils.jobs</code>'], a: 1, x: '<code>dbutils.fs.ls</code>, <code>cp</code>, <code>rm</code>… Widgets are for parameters; secrets for credentials.' },
    // ---------- Unity Catalog ----------
    { t: 'Unity Catalog', s: 'dbx-unity-catalog', q: 'How do you name a table in Unity Catalog?', o: ['<code>schema.table</code> only', 'Three levels: <code>catalog.schema.table</code>', 'Just the table name', '<code>workspace/table</code>'], a: 1, x: 'Metastore → catalog → schema → object. The three-level name works across workspaces attached to the same metastore.' },
    { t: 'Unity Catalog', s: 'dbx-unity-catalog', q: 'A user has <code>SELECT</code> on <code>main.sales.orders</code> but still gets permission denied. What is likely missing?', o: ['A cluster restart', '<code>USE CATALOG</code> on <code>main</code> and <code>USE SCHEMA</code> on <code>main.sales</code>', '<code>MODIFY</code> on the table', 'Admin rights'], a: 1, x: 'To read a table you need USE CATALOG + USE SCHEMA + SELECT.' },
    { t: 'Unity Catalog', s: 'dbx-unity-catalog', q: 'What does this grant do?', code: 'GRANT SELECT ON SCHEMA main.sales TO `analysts`;', lang: 'sql', o: ['Nothing; SELECT only applies to tables', 'Lets analysts read every current and future table in that schema (they still need USE privileges)', 'Makes analysts owners of the schema', 'Grants write access'], a: 1, x: 'Privileges inherit downward from catalog to schema to object.' },
    { t: 'Unity Catalog', s: 'dbx-unity-catalog', q: 'What is a UC <b>volume</b> for?', o: ['Speeding up queries', 'Governing non-tabular files (CSV, images, JARs) with the same permissions as tables', 'Storing cluster logs only', 'Setting audio levels in notebooks'], a: 1, x: 'Paths look like <code>/Volumes/catalog/schema/volume/…</code>.' },
    { t: 'Unity Catalog', s: 'dbx-unity-catalog', q: 'What do you get from Unity Catalog without extra setup?', o: ['Free compute', 'Lineage (which tables and columns feed which) and audit logs of who accessed what', 'Automatic backups to another cloud', 'A BI tool'], a: 1, x: 'Useful when asked “who reads this table?” or “what breaks if I drop this column?”.' },
    { t: 'Unity Catalog', s: 'dbx-unity-catalog', q: 'Best practice: grant privileges to…', o: ['Individual users', 'Groups (e.g. <code>analysts</code>), and add users to the groups', 'Everyone via <code>account users</code>', 'The cluster'], a: 1, x: 'Groups make onboarding, offboarding and audits manageable.' },
    // ---------- Delta tables ----------
    { t: 'Delta tables', s: 'dbx-delta-tables', q: 'What is a Delta table made of?', o: ['A single CSV file', 'Parquet data files plus a transaction log (<code>_delta_log</code>)', 'A Postgres table', 'JSON documents only'], a: 1, x: 'Every write is a commit in the log that adds and removes files. Nothing is edited in place.' },
    { t: 'Delta tables', s: 'dbx-delta-tables', q: 'You <code>DROP</code> a <b>managed</b> table, then an <b>external</b> table. What happens to the data files?', o: ['Both keep their files', 'Managed: UC deletes the data (after a short recovery window); external: the files stay at their location', 'Both delete the files immediately', 'External deletes; managed keeps'], a: 1, x: 'Managed = UC owns the lifecycle of the files. External = you own the files; UC only drops the metadata.' },
    { t: 'Delta tables', s: 'dbx-delta-tables', q: 'What does this query return?', code: 'SELECT * FROM main.sales.orders VERSION AS OF 5;', lang: 'sql', o: ['The 5 newest rows', 'The table as it was at commit version 5 (time travel)', 'An error; versions are not queryable', 'Five copies of the table'], a: 1, x: 'Time travel reads older versions, as long as their files have not been removed by VACUUM.' },
    { t: 'Delta tables', s: 'dbx-delta-tables', q: 'Why can VACUUM break time travel?', o: ['It rewrites the log', 'It deletes old data files no longer referenced by recent versions after the retention period, so older versions cannot be read', 'It drops the table', 'It does not affect time travel'], a: 1, x: 'Retention is your time-travel window. Default is 7 days; shortening it shortens how far back you can go.' },
    { t: 'Delta tables', s: 'dbx-delta-tables', q: 'Which statement upserts a batch of changes into a Delta table in one atomic commit?', o: ['<code>INSERT OVERWRITE</code>', '<code>MERGE INTO … WHEN MATCHED THEN UPDATE WHEN NOT MATCHED THEN INSERT</code>', '<code>COPY</code> then <code>DELETE</code>', '<code>UPSERT TABLE</code>'], a: 1, x: 'MERGE matches on a key. Make sure source keys are unique, or MERGE fails when several source rows match one target row.' },
    { t: 'Delta tables', s: 'dbx-delta-tables', q: 'What problem do OPTIMIZE and liquid clustering address?', o: ['Wrong permissions', 'Many small files and poor data layout, which make reads slow', 'Missing passwords', 'Lost notebooks'], a: 1, x: 'OPTIMIZE compacts files; liquid clustering (<code>CLUSTER BY</code>) keeps related rows together so queries skip files. Predictive optimization can run these for UC managed tables.' }
  ];
  /*Q-END*/
  const TOPICS = ['All', ...[...new Set(Q.map((q) => q.t))]];
  const slugOf = {}; Q.forEach((q) => { slugOf[q.t] = q.s; });
  if (!document.getElementById('w-tv-style')) {
    document.head.append(el('style', { id: 'w-tv-style', text: `
.w-tv-bar { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; margin: 8px 0; }
.w-tv-bar div { height: 100%; background: var(--accent); }
.w-tv-bar div.low { background: var(--err); }
.w-tv-opts { display: grid; gap: 6px; margin-top: 10px; }
.w-tv-opts button { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 9px; padding: 9px 12px; font-size: 14px; cursor: pointer; overflow-wrap: anywhere; }
.w-tv-opts button:hover:not(:disabled) { border-color: var(--accent); }
.w-tv-opts button.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 15%, transparent); }
.w-tv-opts button.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 15%, transparent); }
.w-tv-opts button:disabled { cursor: default; }
.w-tv-q { font-size: 16px; margin: 6px 0 8px; }
.w-tv-rev { border-top: 1px solid var(--border); padding: 10px 0; }
.w-tv-rev:first-child { border-top: 0; }
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
    const bar = el('div'); const barWrap = el('div', { class: 'w-tv-bar' }, bar);
    const opts = el('div', { class: 'w-tv-opts' });
    card.append(el('div', { class: 'w-controls', style: { marginBottom: '0' } }, el('span', { class: 'pill accent', text: q.t }), el('span', { class: 'tiny', text: `#${i + 1}` })), barWrap, el('div', { class: 'w-tv-q', html: q.q }));
    if (q.code) card.append(ctx.codeBox(q.code, q.lang || 'python'));
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
    card.append(el('div', { class: 'pz-exp', html: (j === -1 ? '<b>Time’s up.</b> ' : j === -2 ? '<b>Skipped.</b> ' : ok ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.x }));
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
      misses.forEach(({ q, j }) => { const r = el('div', { class: 'w-tv-rev' }, el('div', { html: `<span class="pill">${q.t}</span> ${q.q}` }));
        if (q.code) r.append(ctx.codeBox(q.code, q.lang || 'python'));
        r.append(el('div', { class: 'tiny', html: `You: ${j < 0 ? (j === -1 ? 'time ran out' : 'skipped') : q.o[j]} · Correct: <b>${q.o[q.a]}</b>` }), el('div', { class: 'pz-exp', html: q.x + ` <a href="${q.s}.html">Review the topic →</a>` }));
        card.append(r); });
    } else card.append(el('p', { text: 'No misses. Try “all 30” on Fast.' }));
    renderStats(); say(`Done: ${score}/${deck.length}. ` + (misses.length ? 'Your misses are listed above with explanations.' : ''));
  }
  function reset() {
    gen++; stopTimer(); started = false; answered = false; i = 0; score = 0; misses = [];
    const pool = Q.filter((q) => topic === 'All' || q.t === topic); deck = shuffle(pool).slice(0, count);
    bPlay.textContent = '▶ Start'; bStep.textContent = 'Skip ›'; bStep.disabled = true; card.innerHTML = '';
    card.append(el('p', { html: `<b>${deck.length}</b> question${deck.length === 1 ? '' : 's'} (${topic === 'All' ? 'all topics' : topic}), <b>${secs} s</b> each. No running code: answer in your head, like in a first interview.`, style: { margin: 0 } }));
    renderStats(); say('Choose a topic, how many questions and the time limit, then press Start.');
  }
  bPlay.addEventListener('click', () => { reset(); started = true; bStep.disabled = false; bPlay.textContent = '↻ Restart'; show(); });
  bStep.addEventListener('click', next);
  bReset.addEventListener('click', reset);
  reset();
});

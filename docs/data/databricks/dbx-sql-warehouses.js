IA.register({
  track: 'databricks',
  slug: 'dbx-sql-warehouses',
  title: 'Databricks SQL & warehouses',
  tagline: 'A <b>SQL warehouse</b> is compute made for SQL and BI: you pick a size and a min/max number of clusters, and Databricks runs Photon, caching and queueing for you. Most tuning comes down to one question: <b>is it queueing (scale out) or is one query slow (scale up, or fix the data)?</b>',
  lang: 'sql',
  tldr: {
    problem: 'BI users complain that “Databricks is slow”. Teams react by picking the biggest warehouse and leaving it on all day, which costs a lot and often doesn’t fix the real issue.',
    model: 'Warehouse = <b>size</b> (T-shirt: 2X-Small … 4X-Large, compute per cluster) × <b>clusters</b> (min…max, for concurrency) + <b>auto-stop</b>. Types: <b>serverless</b> (Databricks-managed, fast start), <b>pro</b> and <b>classic</b> (in your cloud account). Queries go through caches first, then the Photon engine.',
    hook: '“Dashboards queue at 9 a.m., queries are fast once they start.” That’s concurrency: raise max clusters. “One query takes 10 minutes and spills.” That’s size or data layout.',
    facts: [
      { v: '3 types', l: 'serverless, pro and classic (as of 2025). Serverless availability depends on cloud and region' },
      { v: 'size vs count', l: 'T-shirt size scales each cluster up; min/max clusters scale the warehouse out for concurrency' },
      { v: 'Photon', l: 'is on by default for SQL warehouses' }
    ]
  },
  intro: {
    what: '<b>Databricks SQL</b> is the part of Databricks for analysts: a SQL editor, dashboards, alerts and a connection point for BI tools (Power BI, Tableau, JDBC/ODBC). Queries run on a <b>SQL warehouse</b>, a pool of compute you size once and share. It reads the same Delta tables in Unity Catalog that your Spark jobs write. For a Postgres developer: think of a warehouse as a database server you can resize and switch off, with the data living separately in object storage.',
    analogy: { icon: '🏪', title: 'Checkout lanes in a supermarket', text: 'Long queues of shoppers with small baskets? Open more lanes (more clusters). One customer with three overflowing trolleys? A faster cashier helps (a bigger size), but better still is not buying the whole shop (filter the data). At closing time, turn the lights off (auto-stop).' },
    steps: [
      { t: 'Create a warehouse', d: 'Choose type (serverless where available), size, min/max clusters and auto-stop minutes.' },
      { t: 'Grant access', d: 'Users need <code>CAN USE</code> on the warehouse and Unity Catalog grants on the tables. Two different permission systems.' },
      { t: 'Query', d: 'SQL editor, notebooks attached to the warehouse, dashboards, or JDBC/ODBC from BI tools.', code: 'SELECT region, sum(amount) FROM main.gold.sales WHERE order_date >= current_date() - 30 GROUP BY region;' },
      { t: 'Read the query profile', d: 'It shows time per operator, bytes read, files pruned, spill and whether Photon ran each step.' },
      { t: 'Tune', d: 'Queueing → more clusters. Spill or huge scans → bigger size, better layout (<a href="dbx-performance.html">Performance</a>) or a smaller query.' }
    ],
    terms: [
      ['SQL warehouse', 'Compute for SQL workloads (formerly “SQL endpoint”).'],
      ['T-shirt size', 'Per-cluster compute: 2X-Small up to 4X-Large.'],
      ['scaling (min/max clusters)', 'How many clusters run in parallel to serve concurrent queries.'],
      ['auto-stop', 'Minutes of idleness before the warehouse stops.'],
      ['query profile', 'Visual plan with per-operator metrics for a finished query.'],
      ['AI/BI dashboard', 'Databricks’ current dashboards (formerly Lakeview), plus Genie for natural-language questions, as of 2025.']
    ]
  },
  visual: {
    title: 'Queueing, scale-out, cache, scale-up, auto-stop',
    caption: 'Press Play or Step through a day on a BI warehouse: cold start, a Monday-morning queue, scale-out with more clusters, result-cache hits, a single heavy query that needs a bigger size, and auto-stop in the evening. Slot counts are illustrative.'
  },
  gotchas: [
    { trap: 'Buying the biggest size to fix queueing', why: 'Size makes each query faster on one cluster; it does not add parallel capacity as directly as clusters do. A 4X-Large single cluster still queues when hundreds of small dashboard tiles fire at once.', fix: 'Look at the warehouse monitoring: queued queries with short run times → raise max clusters. Long run times with spill → size up or fix the query.' },
    { trap: 'Auto-stop set to “never” or hours', why: 'An idle running warehouse still bills DBUs. Classic and pro warehouses start slowly, so people disable auto-stop to avoid the wait.', fix: 'Use serverless where available (fast start) with a short auto-stop (minutes). For classic/pro, choose a stop time that matches usage gaps.' },
    { trap: 'Granting the warehouse but not the data (or the reverse)', why: 'Warehouse permission (<code>CAN USE</code>) and Unity Catalog privileges (<code>USE CATALOG</code>, <code>USE SCHEMA</code>, <code>SELECT</code>) are separate.', fix: 'Grant both to a group, never to individuals. See <a href="dbx-unity-catalog.html">Unity Catalog</a>.' },
    { trap: 'BI tool sends SELECT * with no filter', code: `SELECT * FROM main.gold.events;   -- 2 billion rows to a dashboard tile`, why: 'The warehouse scans and ships huge results. Result fetch, not compute, becomes the bottleneck.', fix: 'Pre-aggregate into gold tables or materialized views, push filters (date) into the query, and limit rows in tiles.' },
    { trap: 'Assuming the result cache always helps', why: 'Queries with non-deterministic functions (<code>current_timestamp()</code>, <code>rand()</code>) or on tables that change every minute don’t get cache hits.', fix: 'Use date literals or parameters instead of <code>now()</code> in dashboard queries when you can, and refresh source tables on a sensible schedule.' },
    { trap: 'One warehouse for everyone', why: 'An ad-hoc analyst’s huge join and the CEO’s dashboard compete for the same clusters; costs can’t be split by team.', fix: 'Separate warehouses per workload (BI, ad-hoc, ETL in SQL) with tags for cost attribution.' }
  ],
  scenarios: [
    { title: '9 a.m. dashboard timeouts',
      symptom: 'Every Monday between 9:00 and 9:30 dashboards time out. The rest of the week they load in a few seconds.',
      diagnose: `-- query history system table (check availability in your workspace)\nSELECT date_trunc('minute', start_time) AS m,\n       count(*) AS queries,\n       avg(waiting_at_capacity_duration_ms) AS avg_queue_ms,\n       avg(execution_duration_ms) AS avg_exec_ms\nFROM system.query.history\nWHERE compute.warehouse_id = 'abc123'\n  AND start_time >= current_date() - 7\nGROUP BY 1 ORDER BY 1;`,
      cause: 'Execution time is low but queue time is high: the warehouse has <code>max clusters = 1</code>.',
      fix: 'Raise max clusters (scale out). Serverless also starts extra clusters quickly. Consider an earlier scheduled refresh to warm the result cache.',
      fixCode: `# warehouse settings (API / bundle)\nmin_num_clusters: 1\nmax_num_clusters: 4\nauto_stop_mins: 10\nenable_serverless_compute: true`, lang: 'yaml' },
    { title: 'A single report takes 12 minutes',
      symptom: 'One finance report is slow at any time of day, even when it is the only query running.',
      diagnose: 'Query profile: 95% of time in a scan reading 3 TB, “files pruned: 0”, then a join that spills.',
      cause: 'The filter is on <code>to_date(event_ts)</code> while the table is clustered on <code>event_ts</code>; wrapping the column defeats data skipping, so every file is read.',
      fix: 'Filter on the raw column with a range, and make sure the table is clustered on it. Only then consider a bigger size.',
      fixCode: `-- before: WHERE to_date(event_ts) = '2025-03-03'\nWHERE event_ts >= '2025-03-03' AND event_ts < '2025-03-04'` },
    { title: 'The warehouse that never sleeps',
      symptom: 'The BI warehouse bills 24 hours a day although nobody works at night.',
      diagnose: `SELECT hour(start_time) h, count(*) FROM system.query.history\nWHERE compute.warehouse_id = 'abc123' AND start_time >= current_date() - 1\nGROUP BY 1 ORDER BY 1;   -- a query every 5 minutes, all night`,
      cause: 'A monitoring tool polls a dashboard query every 5 minutes, which is shorter than auto-stop, so the warehouse never stops.',
      fix: 'Move the poller to a schedule that matches need, or point it at a small separate warehouse; keep auto-stop short.' }
  ],
  puzzles: [
    { kind: 'concept', q: 'Queries are queued for 40 s on average but execute in 2 s. Best change?', options: ['Increase T-shirt size', 'Increase max clusters', 'Disable Photon', 'Partition the tables'], answer: 1, explain: 'High queue time with short execution means not enough parallel capacity. More clusters drain the queue. Bigger size mostly shortens execution.' },
    { kind: 'concept', q: 'A single query spills to disk and runs for 10 minutes on an otherwise idle warehouse. Which is NOT likely to help?', options: ['A bigger size', 'Better data skipping on the filter column', 'More clusters', 'Pre-aggregating into a gold table'], answer: 2, explain: 'One query runs on one cluster. Extra clusters serve other queries in parallel; they don’t speed up this one.' },
    { kind: 'concept', q: 'Which warehouse type runs its compute in a Databricks-managed account and typically starts in seconds?', options: ['Classic', 'Pro', 'Serverless', 'All-purpose cluster'], answer: 2, explain: 'Serverless warehouses use Databricks’ serverless compute plane. Classic and pro run in your cloud account and take minutes to start.' },
    { kind: 'concept', q: 'A user can open the SQL editor and select the warehouse, but <code>SELECT * FROM main.gold.sales</code> fails with a permission error. Why?', options: ['The warehouse is too small', 'They lack Unity Catalog privileges (USE CATALOG / USE SCHEMA / SELECT)', 'Photon is off', 'The result cache is stale'], answer: 1, explain: 'Using a warehouse and reading data are separate permissions.' },
    { kind: 'concept', q: 'Which dashboard query is least likely to be served from the result cache on the next refresh?', options: ['<code>SELECT count(*) FROM t WHERE d = \'2025-03-01\'</code>', '<code>SELECT count(*) FROM t WHERE ts > current_timestamp() - INTERVAL 1 HOUR</code>', 'The same query run twice in a minute on an unchanged table', 'A query with a literal region filter'], answer: 1, explain: 'Non-deterministic functions such as <code>current_timestamp()</code> make each execution different, so the cached result can’t be reused.' },
    { kind: 'concept', q: 'Where do you see whether each operator of a query ran in Photon, and how many files were pruned?', options: ['Spark driver logs', 'The query profile', 'The cluster event log', 'The Delta transaction log'], answer: 1, explain: 'The query profile shows the plan with per-operator time, rows, bytes, spill and Photon usage, plus scan statistics like files read vs pruned.' }
  ],
  interview: [
    { q: 'What is a SQL warehouse and how is it different from a cluster?', a: '<p>A warehouse is managed compute for SQL: you pick size, scaling and auto-stop; Databricks chooses the runtime, enables Photon, manages caches and queues, and exposes JDBC/ODBC. A cluster (all-purpose or job) runs any Spark code (Python, Scala, SQL) and you configure it yourself.</p>', lvl: 'core' },
    { q: 'Serverless vs pro vs classic warehouses?', a: '<ul><li><b>Serverless</b>: compute in Databricks’ account, fast startup and scaling, newest features (e.g. intelligent workload management, predictive I/O).</li><li><b>Pro</b>: in your account, most features, slower start.</li><li><b>Classic</b>: in your account, fewer performance features.</li></ul><p>As of 2025; features differ by type and change often, so check the docs for your cloud.</p>', lvl: 'core' },
    { q: 'How do you size a warehouse?', a: '<p>Start small. Size up when single queries spill or scans are huge after layout is fixed. Raise max clusters when queue time dominates. Use the monitoring tab and <code>system.query.history</code> (queue vs execution time) rather than guessing.</p>', fu: 'Why start small? DBU rate scales with size, so an oversized warehouse burns money even when it is mostly idle-ish.', lvl: 'core' },
    { q: 'Which caches matter for Databricks SQL?', a: '<ul><li><b>Query result cache</b>: identical query on unchanged data returns the stored result.</li><li><b>Disk cache</b> (local SSD): data files already read are cached on the workers.</li><li>Metadata caching of Delta logs and file stats.</li></ul><p>Caches disappear when the warehouse stops (except a shared remote result cache on serverless, as of recent releases; check docs).</p>', lvl: 'deep' },
    { q: 'How would you make a slow dashboard fast?', a: '<ol><li>Profile the slowest tile.</li><li>Fix the scan: filters on clustering columns, no functions wrapped around filter columns.</li><li>Pre-aggregate into a gold table or a materialized view.</li><li>Then compute: scale out for concurrency, up for heavy queries.</li></ol>', lvl: 'core' },
    { q: 'How do you connect a Java or Spring app to Databricks SQL?', a: '<p>Use the Databricks JDBC driver with the warehouse’s HTTP path and OAuth (a service principal) or a token. Treat it as an analytical store: batch reads, not OLTP. Pool connections, but expect queries in seconds, not milliseconds. For high-QPS lookups, serve from an operational database instead (Databricks also offers a managed Postgres-style option, Lakebase, as of 2025).</p>', lvl: 'deep' },
    { q: 'What are materialized views in Databricks SQL?', a: '<p>Tables whose content is a query result, refreshed on a schedule or on demand, incrementally when possible. They are built on the same engine as Lakeflow Declarative Pipelines. Good for dashboard aggregates.</p>', lvl: 'deep' },
    { q: 'How do you attribute warehouse cost to teams?', a: '<p>Separate warehouses per team or workload with custom tags, then group <code>system.billing.usage</code> by <code>usage_metadata.warehouse_id</code> or tag. Per-query attribution can be approximated from query history duration. See <a href="dbx-cost-governance.html">Cost & governance</a>.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Find the slowest queries this week', lang: 'sql', code: `SELECT statement_id, executed_by,\n       total_duration_ms / 1000 AS secs,\n       read_bytes / 1e9 AS gb_read,\n       substr(statement_text, 1, 120) AS sql\nFROM system.query.history\nWHERE start_time >= current_date() - 7\n  AND compute.warehouse_id = 'abc123'\nORDER BY total_duration_ms DESC\nLIMIT 20;`, note: '<code>system.query.history</code> must be enabled; column names can change, so check <code>DESCRIBE</code> first.' },
    { title: 'A dashboard-friendly gold table', lang: 'sql', code: `CREATE OR REPLACE MATERIALIZED VIEW main.gold.daily_sales AS\nSELECT order_date, region, sum(amount) AS revenue, count(*) AS orders\nFROM main.silver.orders\nGROUP BY order_date, region;\n\n-- dashboards query this, not silver.orders\nSELECT * FROM main.gold.daily_sales\nWHERE order_date >= date_sub(current_date(), 30);` },
    { title: 'Warehouse as code (bundle / API fields)', lang: 'yaml', code: `# shape of the warehouse fields in the API; check your CLI/bundle version for support\nname: bi_wh\ncluster_size: Small\nmin_num_clusters: 1\nmax_num_clusters: 4\nauto_stop_mins: 10\nenable_serverless_compute: true\ntags:\n  custom_tags:\n    - key: team\n      value: finance-bi` },
    { title: 'Query from Python (databricks-sql-connector)', lang: 'python', code: `from databricks import sql\nimport os\n\nwith sql.connect(server_hostname=os.environ["DATABRICKS_HOST"],\n                 http_path=os.environ["WAREHOUSE_HTTP_PATH"],\n                 access_token=os.environ["DATABRICKS_TOKEN"]) as conn:\n    with conn.cursor() as cur:\n        cur.execute("SELECT region, sum(revenue) FROM main.gold.daily_sales GROUP BY region")\n        for row in cur.fetchall():\n            print(row)`, note: 'Prefer OAuth for service principals in production; a token is shown for brevity.' }
  ]
});

IA.register({
  track: 'databricks',
  slug: 'dbx-what-is-databricks',
  title: 'What Databricks is',
  tagline: 'Databricks is a <b>managed platform around Spark and Delta Lake</b>, with one catalog that governs every table. Your data stays as open files in your own cloud storage; Databricks brings the compute, the governance and the tooling.',
  tldr: {
    problem: 'Classic stacks copy data twice: a data lake for cheap raw files and ML, then a warehouse for BI. Two copies, two permission models, and pipelines that drift.',
    model: '<b>Lakehouse</b> = open table format (Delta) on object storage + a catalog (Unity Catalog) + many engines (Spark, Photon SQL, serverless) that all read the <i>same</i> tables.',
    hook: '“How is Databricks different from Snowflake?” Storage ownership and openness: Databricks tables are Delta/Parquet files in <i>your</i> bucket. Snowflake’s native tables live in Snowflake-managed storage (both vendors now also support Iceberg, so the gap is narrowing).',
    facts: [
      { v: '2013', l: 'Databricks was founded by the original creators of Apache Spark at UC Berkeley' },
      { v: 'AWS · Azure · GCP', l: 'the three clouds it runs on; on Azure it is a first-party service, “Azure Databricks”' },
      { v: '3 levels', l: 'Unity Catalog names: <code>catalog.schema.table</code>, one more level than Postgres’ <code>schema.table</code> inside a database' }
    ]
  },
  intro: {
    what: 'Imagine Postgres, but with storage and compute pulled apart. Tables are files in cloud storage (S3, ADLS, GCS). Compute is a fleet of machines you rent by the minute to run Spark or SQL on those files. <b>Databricks</b> is the company and platform that runs those machines for you, keeps a catalog of the tables, and gives you notebooks, a job scheduler, SQL dashboards and ML tools in one web workspace.',
    analogy: { icon: '🏭', title: 'A rented factory next to your warehouse', text: 'Your goods (data) sit in your own warehouse (cloud bucket). Databricks runs a factory next door: machines spin up when there is work, a front office (control plane) schedules jobs, and a security desk (Unity Catalog) checks every badge. You can walk away with your goods; they are in standard boxes (Parquet + Delta).' },
    steps: [
      { t: 'Storage: your bucket', d: 'Data is Parquet files plus a Delta transaction log. You can read them with open-source Spark too. See the Spark track’s <a href="../spark/delta-lake-lakehouse.html">Delta Lake page</a>.' },
      { t: 'Compute: clusters or serverless', d: 'A cluster is a Spark driver plus executors on cloud VMs. Serverless means Databricks manages the machines. See <a href="dbx-workspace-compute.html">Workspace &amp; compute</a>.' },
      { t: 'Governance: Unity Catalog', d: 'One place for table names, permissions, lineage and audit across workspaces. See <a href="dbx-unity-catalog.html">Unity Catalog</a>.' },
      { t: 'Workloads on top', d: 'ETL pipelines, SQL/BI, streaming, ML (MLflow) and AI. All of them use the same tables.', code: '-- the same table, from any engine\nSELECT order_date, sum(amount)\nFROM main.sales.orders\nGROUP BY order_date;', lang: 'sql' }
    ],
    terms: [
      ['lakehouse', 'Warehouse features (ACID tables, SQL, governance) on top of open files in a data lake.'],
      ['Delta Lake', 'Open-source table format: Parquet files + a <code>_delta_log</code> of JSON commits.'],
      ['DBU', 'Databricks Unit: the billing unit for compute, charged per second of use. Rates depend on cloud, tier and compute type.'],
      ['control plane', 'Databricks-run services: web UI, scheduler, notebooks, catalog metadata.'],
      ['compute plane', 'Where your data is processed: VMs in your cloud account (classic) or Databricks’ account (serverless).'],
      ['DBR', 'Databricks Runtime: Spark plus Databricks’ libraries and optimizations, versioned (e.g. 15.4 LTS).']
    ]
  },
  visual: {
    title: 'Two views of the platform',
    caption: 'Pick <b>Lakehouse stack</b> to build the layers from storage up, or <b>Control vs compute plane</b> to see where your data actually flows. Press Play or Step.'
  },
  gotchas: [
    { trap: '“Databricks is just hosted Spark”', why: 'Spark is one engine. The value interviewers probe is the rest: Delta, Unity Catalog, Photon (a C++ vectorized engine), serverless, Lakeflow pipelines and jobs, MLflow.', fix: 'Describe it as a data and AI platform built on the lakehouse: open storage, one governance layer, many engines.' },
    { trap: 'Assuming the data lives in Databricks', why: 'With classic setups, managed and external tables are both files in cloud storage that your organisation owns (managed tables sit in a storage location configured for the metastore, catalog or schema). Deleting a workspace does not delete your bucket.', fix: 'Know where your managed storage location is, and who owns the bucket’s IAM. Never delete storage to “clean up” a workspace.' },
    { trap: 'Treating the control plane as the data path', why: 'Bulk data is processed in the compute plane and read from storage directly. The control plane schedules and stores metadata (notebook source, job definitions, query results may be cached there depending on settings).', fix: 'For network or compliance reviews, separate control-plane traffic (UI/API) from compute-to-storage traffic (private endpoints, VPC/VNet injection).' },
    { trap: 'Quoting prices from memory', why: 'DBU rates differ by cloud, region, pricing tier, compute type (jobs vs all-purpose vs SQL vs serverless) and commitments, and they change.', fix: 'Say “jobs compute is billed at a lower DBU rate than all-purpose compute” and check the pricing page and <code>system.billing.usage</code> for real numbers.' },
    { trap: 'Mixing up old and new product names', why: 'Many products were renamed: Delta Live Tables → Lakeflow Declarative Pipelines; Workflows → Lakeflow Jobs; Repos → Git folders; “shared” / “single user” access modes → Standard / Dedicated. Docs and interviewers use both.', fix: 'Use the new name and mention the old one once: “Lakeflow Declarative Pipelines, formerly DLT”. Names as of 2025; check your workspace.' }
  ],
  scenarios: [
    { title: 'Same KPI, two numbers: lake vs warehouse',
      symptom: 'Finance’s warehouse dashboard and the data-science notebook disagree on monthly revenue by 3%.',
      diagnose: '-- two copies of "orders":\n-- warehouse.orders  (nightly ETL from the lake, last run failed Tuesday)\n-- s3://lake/orders  (updated hourly)',
      cause: 'Two copies of the truth with separate pipelines. One copy missed a load and nobody noticed; permissions also differed, so analysts could not see the newer copy.',
      fix: 'Consolidate on one governed Delta table in Unity Catalog that both BI (SQL warehouse) and notebooks read. Retire the copy job.',
      fixCode: '-- one table, two engines, one grant\nGRANT SELECT ON TABLE main.finance.orders TO `finance-analysts`;\n-- BI: SQL warehouse  |  DS: notebook on a cluster\nSELECT date_trunc(\'month\', order_ts) m, sum(amount) FROM main.finance.orders GROUP BY m;', lang: 'sql' },
    { title: 'Security review blocks the project: “data leaves our cloud”',
      symptom: 'A bank’s security team refuses Databricks because “Databricks processes our data in its own account”.',
      cause: 'Confusion between control plane, classic compute plane and serverless compute plane.',
      diagnose: '-- questions to answer:\n-- where do VMs run?   classic = our account; serverless = Databricks account, same region\n-- where is data stored? our bucket\n-- what does control plane hold? notebook source, job config, metadata',
      fix: 'Draw the planes. Use classic compute with customer-managed VPC/VNet and private connectivity where policy requires it; evaluate serverless separately against its network security features (as of 2025, check your workspace and region).' }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which statement best describes a lakehouse?', options: ['A data warehouse that can export to Parquet', 'ACID tables and governance built directly on open files in object storage', 'A Hadoop cluster with Hive', 'A data lake with a copy of every table in a warehouse'], answer: 1, explain: 'The lakehouse avoids the copy: a table format (Delta) gives transactions on open files, and a catalog governs them. Options C and D are the older patterns it replaces.' },
    { kind: 'concept', q: 'On classic (non-serverless) compute, where do the cluster VMs run?', options: ['In the Databricks control plane', 'In your own cloud account', 'On the user’s laptop', 'Inside the SQL warehouse'], answer: 1, explain: 'Classic compute runs in <b>your</b> cloud account; the control plane only launches and manages it. Serverless compute runs in a Databricks-managed account in the same region.' },
    { kind: 'concept', q: 'Your company deletes its Databricks workspace. What happens to external Delta tables’ data files in S3?', options: ['Deleted immediately', 'Deleted after 30 days', 'Untouched: they are files in your bucket', 'Moved to Databricks storage'], answer: 2, explain: 'External tables point at paths you own. Databricks never owned those files. (Managed tables are also in storage you configure, but dropping a managed table deletes its data.)' },
    { kind: 'concept', q: 'Which pair is a correct “old name → current name” mapping (as of 2025)?', options: ['Unity Catalog → Hive Metastore', 'Delta Live Tables → Lakeflow Declarative Pipelines', 'Photon → Tungsten', 'Git folders → Repos'], answer: 1, explain: 'DLT was renamed Lakeflow Declarative Pipelines in 2025. Repos became Git folders (option D is reversed). Hive metastore is the legacy catalog that Unity Catalog replaces.' },
    { kind: 'concept', q: 'What is Photon?', options: ['A Python notebook kernel', 'A vectorized query engine written in C++ that runs Spark SQL/DataFrame work', 'Databricks’ streaming connector for Kafka', 'A GPU cluster type'], answer: 1, explain: 'Photon is a native vectorized engine compatible with Spark APIs. It speeds up SQL and DataFrame operations; UDFs and RDD code do not benefit.' },
    { kind: 'concept', q: 'Biggest architectural difference to highlight vs Snowflake in an interview?', options: ['Databricks has no SQL', 'Snowflake cannot scale', 'Default storage model: Databricks keeps Delta files in your object storage; Snowflake native tables use Snowflake-managed storage', 'Databricks only runs on Azure'], answer: 2, explain: 'Both scale and both do SQL. Storage ownership and openness are the classic contrast, and both now support Apache Iceberg, which narrows it.' }
  ],
  interview: [
    { q: 'Explain Databricks to a Postgres developer in one minute.', a: '<p>Postgres couples storage and compute in one server. Databricks splits them: tables are Delta files in cloud storage, and compute is Spark (or Photon SQL) clusters that start on demand and scale out. Unity Catalog plays the role of the system catalog plus GRANTs, but across many workspaces. You get notebooks, jobs, SQL dashboards and ML on top.</p>', lvl: 'core' },
    { q: 'What problem does the lakehouse solve?', a: '<p>The two-tier lake + warehouse stack: data copied twice, stale copies, two security models, and ML teams working on different data than BI. The lakehouse adds ACID tables (Delta), schema enforcement and governance directly on the lake, so one copy serves all workloads.</p>', fu: 'What did data lakes lack before table formats? Atomic commits, consistent reads during writes, schema enforcement, efficient updates/deletes.', lvl: 'core' },
    { q: 'Control plane vs compute plane?', a: '<p>The <b>control plane</b> is Databricks-run: web app, REST API, job scheduler, notebook storage, cluster manager. The <b>compute plane</b> processes data: classic compute in your cloud account, or serverless compute in a Databricks-managed account in the same region. Data is read directly from your storage by the compute plane.</p>', lvl: 'core' },
    { q: 'How is Databricks billed?', a: '<p>In <b>DBUs</b> per second of compute, at a rate that depends on compute type (jobs, all-purpose, SQL, serverless), tier and cloud. With classic compute you also pay your cloud provider for VMs and storage; serverless DBU rates include the infrastructure. Use the <code>system.billing.usage</code> table to attribute cost.</p>', fu: 'How do you cut cost? Job clusters or serverless for production, auto-termination, cluster policies, right-sized instances, Photon where it pays off.', lvl: 'core' },
    { q: 'Databricks vs Snowflake?', a: '<ul><li><b>Storage:</b> Delta files in your bucket vs Snowflake-managed storage for native tables (both support Iceberg now).</li><li><b>Engines:</b> Spark (Python/Scala/SQL) plus SQL warehouses vs a SQL-first engine with Snowpark for code.</li><li><b>Heritage:</b> data engineering and ML first vs warehouse/BI first. Feature sets have converged a lot.</li></ul>', lvl: 'core' },
    { q: 'What does Databricks add on top of open-source Spark and Delta?', a: '<p>Managed clusters and serverless; the Databricks Runtime with Photon; Unity Catalog; Auto Loader; Lakeflow Declarative Pipelines and Jobs; predictive optimization; SQL warehouses and dashboards; MLflow-managed tracking and model serving; notebooks with Git folders; system tables for audit and billing.</p>', lvl: 'deep' },
    { q: 'What is Unity Catalog’s role in the architecture?', a: '<p>It is the governance layer: one metastore per region with a three-level namespace, central GRANTs, row filters and column masks, lineage and audit logs, and governed access to files through volumes and external locations. It replaced the per-workspace Hive metastore.</p>', lvl: 'core' },
    { q: 'Is Delta Lake proprietary?', a: '<p>No. Delta Lake is open source (Linux Foundation project). Some features ship on Databricks first. UniForm can expose Delta tables to Iceberg readers. Unity Catalog also has an open-source version, but the managed product has more features.</p>', lvl: 'deep' },
    { q: 'When would you not choose Databricks?', a: '<p>Small data that fits one Postgres instance; pure OLTP workloads (Databricks is analytical, though it now offers a managed Postgres product called Lakebase, as of 2025); teams with no Spark/Python skills who only need BI on modest data; or strict requirements it does not meet in your region.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'First notebook: read, transform, save', lang: 'python', code: `# spark is pre-created in every Databricks notebook
df = spark.read.table("samples.nyctaxi.trips")       # built-in sample data (if enabled)
daily = (df.groupBy(df.tpep_pickup_datetime.cast("date").alias("day"))
           .count())
display(daily)                                          # Databricks-only rich table/chart
daily.write.mode("overwrite").saveAsTable("main.sandbox.daily_trips")`, note: 'Same PySpark you learned in the Spark track. <code>display()</code> and the pre-made <code>spark</code> session are notebook conveniences.' },
    { title: 'Cost attribution from system tables', lang: 'sql', code: `-- DBUs per SKU over the last 30 days (needs access to the system catalog)
SELECT sku_name, sum(usage_quantity) AS dbus
FROM system.billing.usage
WHERE usage_date >= current_date() - INTERVAL 30 DAYS
GROUP BY sku_name
ORDER BY dbus DESC;`, note: 'System tables are governed by Unity Catalog; an admin must grant access.' }
  ]
});

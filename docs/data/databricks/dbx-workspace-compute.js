IA.register({
  track: 'databricks',
  slug: 'dbx-workspace-compute',
  title: 'Workspace & compute',
  tagline: 'A <b>workspace</b> is where people and code live. <b>Compute</b> is what runs it: all-purpose clusters for humans, job compute for production, serverless when you would rather not manage VMs, and SQL warehouses for BI. Picking the wrong one is the most common way to burn DBUs.',
  tldr: {
    problem: 'Teams run nightly ETL on a big always-on interactive cluster, pay all-purpose rates around the clock, and fight over library versions.',
    model: '<b>Humans → all-purpose (with auto-termination). Schedules → job compute or serverless. SQL/BI → SQL warehouses.</b> Pin a Databricks Runtime (LTS) version per workload.',
    hook: '“Why is my job cheaper on a job cluster than on the cluster I tested on?” Jobs compute has a lower DBU rate, and it is torn down when the run ends.',
    facts: [
      { v: '2 rates', l: 'all-purpose and jobs compute are different SKUs; jobs compute is cheaper per DBU (check your pricing page for numbers)' },
      { v: 'LTS', l: 'Long Term Support runtimes (e.g. 14.3 LTS, 15.4 LTS, 16.4 LTS) get fixes for longer; pin production to one' },
      { v: '1 driver', l: 'every classic Spark cluster has exactly one driver plus 0..N workers (0 = single node)' }
    ]
  },
  intro: {
    what: 'A <b>workspace</b> is a Databricks web environment for a team: a file tree of notebooks and code, jobs, dashboards, and compute settings. <b>Compute</b> is a set of machines running Spark. You create a <b>cluster</b> (a driver plus workers), choose a <b>Databricks Runtime</b> version (Spark + libraries), attach a notebook, and run cells. Or you let Databricks pick machines for you with <b>serverless</b>.',
    analogy: { icon: '🚕', title: 'Own car, taxi, or bus', text: 'An all-purpose cluster is your own car: always there, but you pay even when it is parked (until auto-termination). A job cluster is a taxi booked per trip. Serverless is a ride-share that shows up in seconds. A SQL warehouse is the bus line for many BI riders.' },
    steps: [
      { t: 'Workspace tree', d: '<code>/Workspace/Users/you@corp.com</code> for personal work, shared folders for teams, and Git folders for versioned code.' },
      { t: 'Create a cluster', d: 'Pick a runtime (prefer LTS), node types, min/max workers for autoscaling, access mode, and an auto-termination time.' },
      { t: 'Attach and run', d: 'Attach a notebook; <code>spark</code> is ready. The driver runs your Python; executors run Spark tasks.', code: 'spark.version          # e.g. 3.5.x on DBR 15.4 LTS\nspark.conf.get("spark.databricks.clusterUsageTags.sparkVersion")' },
      { t: 'Schedule for production', d: 'A job runs a notebook or wheel on a new job cluster or on serverless, so nothing idles.' }
    ],
    terms: [
      ['all-purpose compute', 'Interactive cluster you create and share; billed at the all-purpose rate while running.'],
      ['job compute', 'Cluster created for a job run and terminated after it.'],
      ['serverless compute', 'Databricks-managed compute for notebooks, jobs and pipelines; no VM configuration.'],
      ['SQL warehouse', 'Compute for SQL queries and dashboards (classic, pro or serverless types).'],
      ['access mode', 'Standard (formerly “shared”: multi-user, isolated) or Dedicated (formerly “single user”).'],
      ['cluster policy', 'Admin rules limiting what users can configure (max size, required tags, allowed runtimes).']
    ]
  },
  visual: {
    title: 'Compute lifecycles',
    caption: 'Compare an <b>all-purpose</b> cluster with a <b>job</b> cluster, then switch to <b>Serverless</b>. Press Play or Step.'
  },
  gotchas: [
    { trap: 'Running production jobs on an all-purpose cluster', why: 'You pay the higher all-purpose rate, the cluster is shared with humans (noisy neighbours, library changes, restarts), and it may idle all day.', fix: 'Use job compute (a new cluster per job, or one shared within the job’s tasks) or serverless jobs.' },
    { trap: 'Auto-termination off', why: 'An interactive cluster left running over a weekend bills every minute. This is a classic surprise invoice.', fix: 'Enforce auto-termination (e.g. 30–60 min) with a cluster policy. Tag clusters for cost attribution.', code: '{\n  "autotermination_minutes": { "type": "range", "maxValue": 60, "defaultValue": 30 },\n  "custom_tags.team": { "type": "fixed", "value": "data-eng" }\n}', lang: 'json' },
    { trap: 'Unpinned or non-LTS runtime in production', why: 'A new runtime brings a new Spark version with changed defaults. Jobs that pick “latest” can break on their own.', fix: 'Pin an LTS runtime in the job definition and upgrade deliberately after testing.' },
    { trap: 'Libraries installed by hand on a shared cluster', why: 'Someone upgrades pandas for their notebook and your job breaks. Cluster libraries are global to the cluster.', fix: 'Use notebook-scoped <code>%pip install</code> for experiments, and declare dependencies per job task (or a serverless environment) for production.' },
    { trap: 'Expecting serverless to support everything classic does', why: 'Serverless restricts some things: no init scripts, limited Spark configs, no RDD APIs, and Standard-mode style isolation (as of 2025; the list shrinks over time).', fix: 'Check the serverless limitations page before migrating; keep classic job compute for workloads that need custom images or JVM libraries.' },
    { trap: 'Huge driver work with tiny drivers', why: '<code>collect()</code>, <code>toPandas()</code> and plain Python loops run on the driver. Adding workers does not help.', fix: 'Keep work in Spark, or size the driver for the data you really bring back. See the Spark track’s <a href="../spark/spark-architecture.html">architecture page</a>.' }
  ],
  scenarios: [
    { title: 'Monthly bill doubled; nothing new shipped',
      symptom: 'DBU spend for the analytics workspace doubled month over month.',
      diagnose: `SELECT usage_metadata.cluster_id, sku_name, sum(usage_quantity) dbus
FROM system.billing.usage
WHERE usage_date >= date_trunc('month', current_date())
GROUP BY ALL ORDER BY dbus DESC LIMIT 10;`,
      cause: 'A large all-purpose cluster had auto-termination disabled while someone debugged, and three scheduled jobs had been pointed at it “temporarily”.',
      fix: 'Move the jobs to job compute, add a cluster policy enforcing auto-termination and tags, and alert on spend per tag.',
      fixCode: `# job task snippet (Asset Bundle YAML)
job_clusters:
  - job_cluster_key: etl
    new_cluster:
      spark_version: 15.4.x-scala2.12
      node_type_id: i3.xlarge
      autoscale: { min_workers: 2, max_workers: 8 }`, lang: 'yaml' },
    { title: 'Job fails after a weekend; code unchanged',
      symptom: 'A Monday run fails with a changed behaviour in date parsing.',
      diagnose: '-- job JSON shows: "spark_version": "latest"  (or a custom selector)\n-- run history: runtime changed between Friday and Monday runs',
      cause: 'The job was not pinned to a specific runtime and picked up a newer Spark version with different defaults.',
      fix: 'Pin <code>spark_version</code> to an LTS runtime, test upgrades in a staging job first, and read the runtime release notes.', lang: 'sql' }
  ],
  puzzles: [
    { kind: 'concept', q: 'A nightly ETL runs 40 minutes. Which compute is usually the cheapest sensible choice?', options: ['A shared all-purpose cluster left running', 'A job cluster (or serverless job)', 'A SQL warehouse', 'A single-node cluster with auto-termination off'], answer: 1, explain: 'Job compute is billed at the jobs rate and exists only for the run. Serverless removes start-up time and VM management. All-purpose costs more per DBU and idles.' },
    { kind: 'concept', q: 'Which runs on the driver only?', options: ['df.groupBy("k").count()', 'A plain Python for-loop over a list', 'spark.read.parquet(...).filter(...)', 'df.write.saveAsTable(...)'], answer: 1, explain: 'Plain Python runs in the driver’s REPL. The DataFrame operations are planned on the driver but executed as tasks on executors.' },
    { kind: 'concept', q: 'What does auto-termination do to a cluster?', options: ['Deletes its configuration', 'Stops its VMs after N idle minutes; config kept, can restart', 'Scales it down to one worker', 'Moves it to serverless'], answer: 1, explain: 'Terminated clusters keep their configuration (they are eventually removed from the list if unused for a long time unless pinned). Restarting re-provisions VMs.' },
    { kind: 'concept', q: 'Which access mode name is current for a multi-user, isolated cluster (as of 2025)?', options: ['High concurrency', 'Standard (formerly shared)', 'Dedicated (formerly single user)', 'No isolation shared'], answer: 1, explain: '“High concurrency” is the legacy name. Standard is the multi-user mode with user isolation for Unity Catalog. Dedicated is assigned to one user or group.' },
    { kind: 'concept', q: 'Why pin an LTS runtime for production?', options: ['LTS is faster', 'LTS is the only one with Photon', 'Predictable Spark version and a longer support window', 'Non-LTS runtimes cannot run jobs'], answer: 2, explain: 'LTS runtimes are supported for longer and give a stable Spark/library baseline. Photon and jobs work on non-LTS too.' }
  ],
  interview: [
    { q: 'All-purpose vs job compute?', a: '<p>All-purpose is created by users, shared, interactive and billed at a higher rate while running. Job compute is created by the scheduler for a run (or shared by tasks in one job) and terminated after it, at a lower rate. Production = job compute or serverless.</p>', lvl: 'core' },
    { q: 'What is serverless compute and its trade-offs?', a: '<p>Databricks runs the machines in its own account in your region and allocates capacity in seconds. No instance types, no runtime pinning (you choose an environment version), automatic scaling. Trade-offs: fewer knobs (no init scripts, limited Spark confs, no RDDs), different network setup, and you trust Databricks’ autoscaling with cost.</p>', lvl: 'core' },
    { q: 'What is a Databricks Runtime?', a: '<p>A versioned bundle: Apache Spark plus Delta, Photon, Databricks connectors and a set of Python/Java libraries. ML runtimes add ML libraries. Each runtime fixes a Spark version, so upgrading the runtime upgrades Spark.</p>', lvl: 'core' },
    { q: 'How does cluster autoscaling work and when does it hurt?', a: '<p>You give min and max workers; Databricks adds workers when tasks queue and removes idle ones. It hurts for streaming (classic autoscaling is not tuned for steady streams; pipelines have their own enhanced autoscaling) and for jobs with big cached data, where losing workers loses cache and shuffle files.</p>', lvl: 'deep' },
    { q: 'What are cluster policies for?', a: '<p>Governance and cost control: limit node types and sizes, force auto-termination and tags, fix runtime versions, and hide options from users. Users without unrestricted create permission must pick a policy.</p>', lvl: 'core' },
    { q: 'Standard vs Dedicated access mode?', a: '<p><b>Standard</b> (formerly shared) lets many users share a cluster with isolation enforced, which is required for features like fine-grained access on shared compute; some low-level APIs are restricted. <b>Dedicated</b> (formerly single user) is for one user or group and allows things like RDD APIs and ML runtimes. Names as of 2025; check your workspace.</p>', lvl: 'deep' },
    { q: 'What are instance pools?', a: '<p>A set of idle, ready VMs that clusters can draw from to start faster. You pay the cloud for idle pool instances, but not DBUs. Serverless has largely replaced pools for fast start.</p>', lvl: 'deep' },
    { q: 'When would you pick a single-node cluster?', a: '<p>Small data, pandas/scikit-learn work, or development. The driver runs Spark locally with no workers. It is cheap but cannot scale out.</p>', lvl: 'core' },
    { q: 'Where do you look when a cluster won’t start?', a: '<p>The cluster event log (cloud capacity errors, quota, bad init script, network/VPC issues), then driver logs. Common causes: instance type unavailable in the zone, account quota, or a failing init script.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Job with job compute (Asset Bundle)', lang: 'yaml', code: `resources:
  jobs:
    nightly_etl:
      name: nightly-etl
      job_clusters:
        - job_cluster_key: etl
          new_cluster:
            spark_version: 15.4.x-scala2.12   # pinned LTS
            node_type_id: Standard_D4ds_v5    # Azure example
            autoscale: { min_workers: 2, max_workers: 6 }
      tasks:
        - task_key: bronze
          job_cluster_key: etl
          notebook_task: { notebook_path: ../src/bronze.py }`, note: 'Databricks Asset Bundles keep job config in Git. Deploy with <code>databricks bundle deploy</code>.' },
    { title: 'Inspect the cluster from a notebook', lang: 'python', code: `print(spark.version)
print(sc.defaultParallelism)          # total cores across executors (classic compute)
print(spark.conf.get("spark.sql.shuffle.partitions"))`, note: 'On serverless, <code>sc</code> (SparkContext) is not available; use only DataFrame/SQL APIs.' }
  ]
});

IA.register({
  track: 'databricks',
  slug: 'dbx-cost-governance',
  title: 'Cost & governance',
  tagline: 'Databricks bills compute in <b>DBUs</b> (plus your cloud bill for VMs and storage on classic compute). Cost control is mostly governance: <b>policies</b> that stop expensive mistakes, <b>tags</b> that say who spent what, and <b>system tables</b> that let you query it all with SQL.',
  tldr: {
    problem: 'The monthly bill surprises everyone and nobody can say which team or job caused it. Clusters run all night, jobs use interactive compute, and anyone can create a 100-node cluster.',
    model: 'Cost = <b>DBUs</b> (rate depends on compute type, tier, size, Photon, cloud) × price, plus cloud infrastructure for classic compute. Govern it with <b>compute policies</b> (limits, auto-termination, required tags), <b>budget policies</b> for serverless, <b>tags</b> on everything, and monitor with <b>system tables</b> (<code>system.billing.usage</code>, <code>system.billing.list_prices</code>) and budgets/alerts.',
    hook: '“How would you cut a Databricks bill by 30% in a month?” Query <code>system.billing.usage</code> by SKU and tag, then go after idle all-purpose clusters, jobs on interactive compute, always-on warehouses and full-table rewrites.',
    facts: [
      { v: 'DBU', l: 'Databricks Unit: normalized processing capability per hour; rates differ by SKU (jobs, all-purpose, SQL, serverless…). Check your price list' },
      { v: 'system.billing.usage', l: 'is the account-wide usage table: SKU, quantity in DBUs, usage metadata (job, warehouse, cluster) and custom tags' },
      { v: 'two bills', l: 'on classic compute you pay Databricks (DBUs) and your cloud provider (VMs, disks, network, storage); serverless DBUs include the compute' }
    ]
  },
  intro: {
    what: 'Every time compute runs on Databricks it consumes <b>DBUs</b>. How many per hour depends on the type of compute (job, all-purpose, SQL warehouse, serverless), its size and options like Photon. On classic compute your cloud provider also bills for the VMs. Governance means deciding <b>who can create what</b> (policies, permissions), <b>labelling it</b> (tags) and <b>watching it</b> (system tables, budgets). The same tools also control data access with Unity Catalog grants and audit logs.',
    analogy: { icon: '💡', title: 'An office electricity bill', text: 'The bill (DBUs) comes from the meter. You can’t fix it by staring at the total. Put sub-meters on each floor (tags), add motion sensors that turn lights off (auto-termination), forbid space heaters (policies), and read the meter weekly (system tables).' },
    steps: [
      { t: 'See where it goes', d: 'Query usage by SKU, workspace, job and tag for the last 30 days.', code: 'SELECT sku_name, sum(usage_quantity) AS dbus\nFROM system.billing.usage\nWHERE usage_date >= current_date() - 30\nGROUP BY 1 ORDER BY 2 DESC;', lang: 'sql' },
      { t: 'Stop the leaks', d: 'Auto-termination on all-purpose clusters, short auto-stop on warehouses, jobs on job or serverless compute.' },
      { t: 'Set guard rails', d: 'Compute policies: allowed node types, max workers, forced auto-termination, required tags. Grant users only policies, not unrestricted creation.' },
      { t: 'Attribute', d: 'Tag clusters, jobs, warehouses and pipelines with team / cost center; serverless uses budget policies for tags.' },
      { t: 'Alert', d: 'Budgets with email alerts; dashboards on system tables; review top-10 jobs by spend monthly.' }
    ],
    terms: [
      ['DBU', 'Databricks Unit, the billing unit for compute.'],
      ['SKU', 'Product line billed at its own rate, e.g. jobs compute, all-purpose, SQL serverless.'],
      ['compute policy', 'Rules for cluster configs (formerly “cluster policy”): fixed values, ranges, allowlists, required tags.'],
      ['custom tags', 'Key/value labels on compute that appear in billing system tables (and on cloud resources for classic compute).'],
      ['system tables', 'Databricks-hosted tables in the <code>system</code> catalog: billing, audit, compute, jobs, query history, lineage.'],
      ['budget policy', 'Tags and controls applied to serverless usage, which has no cluster to tag.']
    ]
  },
  visual: {
    title: 'A day of compute, before and after governance',
    caption: 'Play or Step through one day: forgotten interactive clusters, a job on always-on compute and a sleepless warehouse, then the same workloads after compute policies, job compute, auto-stop and tags, ending with usage grouped by team. Numbers are illustrative node-hours, not prices.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Simulation: idle cost of auto-termination', code: `# SIMULATION (illustrative): node-hours an all-purpose cluster burns per workday\n# for different auto-termination settings. No real DBU rates or prices.\nsessions = [(9.0, 10.5), (11.0, 12.0), (14.0, 15.25), (16.5, 17.0)]   # active work (hours)\nnodes = 8\n\ndef node_hours(auto_term_min):\n    total, t = 0.0, 0.0\n    for i, (start, end) in enumerate(sessions):\n        nxt = sessions[i + 1][0] if i + 1 < len(sessions) else None\n        idle_after = (nxt - end) if nxt else 24 - end\n        keep = min(idle_after, auto_term_min / 60) if auto_term_min else idle_after\n        total += (end - start) + keep\n    return total * nodes\n\nfor m in [None, 120, 60, 30, 10]:\n    label = "never" if m is None else f"{m} min"\n    print(f"auto-termination {label:>8}: {node_hours(m):6.1f} node-hours")`, note: 'Pure Python, runs in the browser. Change the sessions or node count. Convert node-hours to DBUs and money only with your own price list.' }
    ]
  },
  gotchas: [
    { trap: 'Jobs on all-purpose clusters', why: 'All-purpose compute is typically billed at a higher DBU rate than jobs compute, and a cluster kept on “for fast starts” bills while idle.', fix: 'Run scheduled work on job compute (shared per job via <code>job_cluster_key</code>) or serverless jobs. See <a href="dbx-jobs-workflows.html">Jobs & workflows</a>.' },
    { trap: 'No auto-termination', why: 'Interactive clusters run until someone stops them. Overnight and weekend idle time adds up quickly.', fix: 'Enforce <code>autotermination_minutes</code> in a compute policy (fixed or a max), and remove unrestricted cluster creation for most users.' },
    { trap: 'Tags that don’t reach billing', why: 'Untagged usage can’t be attributed. Serverless usage has no cluster, so cluster tags don’t apply.', fix: 'Require tags via policies for clusters, set tags on jobs and warehouses, and use budget policies for serverless notebooks, jobs and pipelines.' },
    { trap: 'Using list prices as “the cost”', code: `SELECT u.usage_quantity * p.pricing.default AS list_cost ...`, why: '<code>system.billing.list_prices</code> holds list prices. Discounts and commitments in your contract can differ, and classic compute also has a separate cloud bill.', fix: 'Call it “list-price estimate” in dashboards. Reconcile with invoices and the cloud bill for real numbers.' },
    { trap: 'Policies that only exist on paper', why: 'If users can still create clusters without a policy (unrestricted cluster creation entitlement), they will.', fix: 'Remove unrestricted creation, grant <code>CAN_USE</code> on a few policies per persona (data engineer, analyst, ML), and audit with <code>system.compute.clusters</code>.' },
    { trap: 'Governance = only cost', why: 'Governance also covers who can read what. Over-broad grants and shared personal tokens are both a cost and a security problem.', fix: 'Unity Catalog grants to groups, row filters and column masks for sensitive data, service principals for automation, and audit logs in <code>system.access.audit</code>.' }
  ],
  scenarios: [
    { title: 'Bill up 40% month over month, nobody knows why',
      symptom: 'Finance flags a big increase. Teams each say “not us”.',
      diagnose: `SELECT usage_date, sku_name,\n       custom_tags['team'] AS team,\n       usage_metadata.job_id, usage_metadata.cluster_id,\n       sum(usage_quantity) AS dbus\nFROM system.billing.usage\nWHERE usage_date >= current_date() - 60\nGROUP BY ALL\nORDER BY dbus DESC\nLIMIT 50;`,
      cause: 'One untagged all-purpose cluster running continuously since a hackathon, plus a new job on an all-purpose cluster.',
      fix: 'Terminate and delete the cluster, move the job to job compute, enforce auto-termination and required tags with a policy, add a budget alert.',
      fixCode: `{\n  "autotermination_minutes": { "type": "range", "maxValue": 60, "defaultValue": 30 },\n  "num_workers":            { "type": "range", "maxValue": 8 },\n  "node_type_id":           { "type": "allowlist", "values": ["i3.xlarge", "i3.2xlarge"] },\n  "custom_tags.team":       { "type": "unlimited", "isOptional": false }\n}`, lang: 'json' },
    { title: 'A dev workspace costs more than prod',
      symptom: 'The dev workspace’s DBUs exceed production’s.',
      diagnose: `SELECT workspace_id, sku_name, sum(usage_quantity) dbus\nFROM system.billing.usage\nWHERE usage_date >= current_date() - 30\nGROUP BY 1, 2 ORDER BY 3 DESC;`,
      cause: 'Every developer has a large personal all-purpose cluster and a dev copy of every streaming job running continuously.',
      fix: 'Small personal-compute policy (single node, short auto-termination), dev copies of jobs paused (bundle development mode), streams with <code>availableNow</code> in dev.',
      fixCode: `-- personal compute: single node, max 30 min idle (policy definition, JSON)\n-- "spark_conf.spark.databricks.cluster.profile": { "type": "fixed", "value": "singleNode" }\n-- "autotermination_minutes": { "type": "fixed", "value": 30 }`, lang: 'sql' },
    { title: 'Audit asks: who read the salary table?',
      symptom: 'Compliance needs a list of everyone who queried <code>hr.people.salaries</code> last quarter.',
      diagnose: `SELECT event_time, user_identity.email, action_name, request_params\nFROM system.access.audit\nWHERE event_date >= current_date() - 90\n  AND service_name = 'unityCatalog'\n  AND request_params['full_name_arg'] = 'hr.people.salaries'\nORDER BY event_time;`,
      cause: 'Not an incident yet, but grants were broad (<code>account users</code> had SELECT).',
      fix: 'Revoke the broad grant, grant to an HR group, and add a column mask so only HR sees salary values.',
      fixCode: `REVOKE SELECT ON TABLE hr.people.salaries FROM \`account users\`;\nGRANT SELECT ON TABLE hr.people.salaries TO \`hr-analysts\`;\n\nCREATE FUNCTION hr.people.mask_salary(s DECIMAL(10,2))\nRETURN CASE WHEN is_account_group_member('hr-analysts') THEN s ELSE NULL END;\nALTER TABLE hr.people.salaries ALTER COLUMN salary SET MASK hr.people.mask_salary;`, lang: 'sql' }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which table answers “DBUs per job last month”?', options: ['<code>system.access.audit</code>', '<code>system.billing.usage</code> grouped by <code>usage_metadata.job_id</code>', '<code>information_schema.tables</code>', 'The Spark UI'], answer: 1, explain: 'Usage records carry metadata such as job id, cluster id, warehouse id and custom tags.' },
    { kind: 'concept', q: 'On classic (non-serverless) compute, which bills do you get?', options: ['Only Databricks DBUs', 'Databricks DBUs and the cloud provider’s VM/storage/network charges', 'Only the cloud bill', 'A flat monthly fee'], answer: 1, explain: 'Classic compute runs VMs in your cloud account. Serverless DBU pricing includes the compute it runs on.' },
    { kind: 'concept', q: 'What is the most direct way to stop users from creating clusters without auto-termination?', options: ['A wiki page', 'A compute policy that fixes or bounds <code>autotermination_minutes</code>, plus removing unrestricted cluster creation', 'Smaller node types', 'A nightly job that deletes clusters'], answer: 1, explain: 'Policies enforce config at creation time. Without removing unrestricted creation, users can bypass them.' },
    { kind: 'concept', q: 'Serverless notebook and job usage can’t carry cluster tags. How do you attribute it?', options: ['You can’t', 'Budget policies (serverless usage policies) that apply tags', 'Rename the notebooks', 'Use a SQL warehouse instead'], answer: 1, explain: 'Budget policies attach tags to serverless usage so it shows up attributed in billing tables. Naming may vary; check the current docs.' },
    { kind: 'concept', q: 'Which change usually saves the most for a nightly batch job currently on an always-on all-purpose cluster?', options: ['Enable Photon', 'Move it to job compute (or serverless jobs) so compute exists only during the run', 'Add more workers', 'Use a bigger driver'], answer: 1, explain: 'Removing 20+ idle hours a day dwarfs most tuning. Then tune the job itself.' },
    { kind: 'concept', q: '<code>usage_quantity × list_prices.pricing.default</code> gives you…', options: ['Your exact invoice', 'A list-price estimate of Databricks charges, before discounts and excluding cloud costs', 'Cloud VM cost', 'Storage cost'], answer: 1, explain: 'Useful for relative comparisons and trends. Your contract and the cloud bill determine the real total.' }
  ],
  interview: [
    { q: 'What is a DBU?', a: '<p>A Databricks Unit: a normalized unit of processing per hour. A given compute resource consumes DBUs at a rate that depends on instance size, compute type (jobs, all-purpose, SQL, serverless, model serving…), tier and features like Photon. Databricks multiplies DBUs by the SKU’s price. Don’t quote rates from memory; they vary by cloud, region, tier and contract.</p>', lvl: 'core' },
    { q: 'What are the biggest cost levers on Databricks?', a: '<ol><li>Right compute type: jobs on job/serverless compute, not all-purpose.</li><li>Idle time: auto-termination and auto-stop.</li><li>Right size: autoscaling with sensible max; spot/preemptible workers for fault-tolerant jobs (classic).</li><li>Less work: incremental processing (Auto Loader, streaming tables, MERGE) instead of full rewrites; good layout.</li><li>Visibility: tags + system tables + budgets.</li></ol>', lvl: 'core' },
    { q: 'What can a compute policy enforce?', a: '<p>Fixed values (runtime, single-node profile), ranges (workers, auto-termination), allowlists/blocklists (node types), defaults, required custom tags, and limits like max DBUs per hour or maximum clusters per user. Policy families provide templates (personal compute, shared compute, job compute). Users get <code>CAN_USE</code> on specific policies.</p>', lvl: 'core' },
    { q: 'Which system tables do you use, and for what?', a: '<ul><li><code>system.billing.usage</code>, <code>system.billing.list_prices</code>: spend.</li><li><code>system.compute.clusters</code>, node timeline tables: cluster configs and utilisation.</li><li><code>system.lakeflow.jobs</code> and job run tables: job history and duration.</li><li><code>system.query.history</code>: SQL warehouse queries.</li><li><code>system.access.audit</code>: who did what; lineage tables for data flow.</li></ul><p>Some must be enabled per schema by an admin; availability changes over time.</p>', lvl: 'deep' },
    { q: 'How do you do chargeback per team?', a: '<p>Require a <code>team</code>/<code>cost_center</code> tag via policies (clusters), job and warehouse settings, and budget policies (serverless). Build a dashboard on <code>system.billing.usage</code> grouped by tag and SKU, priced with list prices or your negotiated rates, and reconcile monthly. Untagged usage gets its own line so it shrinks over time.</p>', lvl: 'deep' },
    { q: 'How does Unity Catalog fit into governance?', a: '<p>UC is the access layer: grants on catalogs/schemas/tables/volumes/models/functions to groups, row filters and column masks, lineage, and audit. Combined with workspace-level controls (who can create compute, which policies) and service principals for automation, it gives least privilege and traceability. See <a href="dbx-unity-catalog.html">Unity Catalog</a>.</p>', lvl: 'core' },
    { q: 'Spot instances on Databricks: when and how?', a: '<p>For classic job clusters with fault-tolerant workloads: keep the driver on-demand and some workers on-demand (<code>first_on_demand</code>), the rest spot with fallback to on-demand. Spark retries lost tasks, but long stages may rerun. Not for latency-sensitive streaming or interactive work where interruptions hurt.</p>', fu: 'What about serverless? You don’t choose instances there; Databricks manages capacity.', lvl: 'deep' },
    { q: 'How do you set an alert before the bill surprises you?', a: '<p>Account-level budgets with email alerts per workspace or tag, plus a SQL alert on a system-table query (e.g. daily DBUs per team above a threshold). Review the top jobs and warehouses by spend weekly.</p>', lvl: 'core' },
    { q: 'Serverless: cheaper or more expensive?', a: '<p>It depends. Serverless DBU rates are typically higher per DBU but include the compute, and you stop paying for startup time and idle clusters. Bursty or short workloads often get cheaper; long, steady, well-utilised clusters may not. Measure with system tables on a representative workload.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Spend by team and SKU (list-price estimate)', lang: 'sql', code: `SELECT u.usage_date,\n       coalesce(u.custom_tags['team'], '(untagged)') AS team,\n       u.sku_name,\n       sum(u.usage_quantity)                           AS dbus,\n       sum(u.usage_quantity * p.pricing.default)       AS list_cost_estimate\nFROM system.billing.usage u\nJOIN system.billing.list_prices p\n  ON u.sku_name = p.sku_name\n AND u.usage_start_time >= p.price_start_time\n AND (p.price_end_time IS NULL OR u.usage_start_time < p.price_end_time)\nWHERE u.usage_date >= current_date() - 30\nGROUP BY ALL\nORDER BY list_cost_estimate DESC;`, note: 'List prices only; your contract may differ. Check column names with <code>DESCRIBE system.billing.usage</code>.' },
    { title: 'Top 10 jobs by DBUs', lang: 'sql', code: `SELECT usage_metadata.job_id AS job_id,\n       sum(usage_quantity) AS dbus\nFROM system.billing.usage\nWHERE usage_date >= current_date() - 30\n  AND usage_metadata.job_id IS NOT NULL\nGROUP BY 1\nORDER BY dbus DESC\nLIMIT 10;` },
    { title: 'Compute policy (job compute)', lang: 'json', code: `{\n  "cluster_type":            { "type": "fixed", "value": "job" },\n  "spark_version":           { "type": "unlimited", "defaultValue": "auto:latest-lts" },\n  "node_type_id":            { "type": "allowlist", "values": ["i3.xlarge", "i3.2xlarge"] },\n  "autoscale.max_workers":   { "type": "range", "maxValue": 10 },\n  "custom_tags.team":        { "type": "unlimited", "isOptional": false },\n  "custom_tags.cost_center": { "type": "unlimited", "isOptional": false }\n}`, note: 'Node types are AWS examples; use your cloud’s. Policy attribute names: see the compute policy reference.' },
    { title: 'Tags on a job in a bundle', lang: 'yaml', code: `resources:\n  jobs:\n    nightly_orders:\n      name: nightly_orders\n      tags:\n        team: data-eng\n        cost_center: "4711"\n      job_clusters:\n        - job_cluster_key: etl\n          new_cluster:\n            policy_id: \${var.job_policy_id}\n            custom_tags: { team: data-eng }` }
  ]
});

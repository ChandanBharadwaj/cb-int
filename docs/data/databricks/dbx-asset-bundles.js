IA.register({
  track: 'databricks',
  slug: 'dbx-asset-bundles',
  title: 'Asset Bundles & CI/CD',
  tagline: 'A <b>bundle</b> is infrastructure-as-code for Databricks: jobs, pipelines and other resources as YAML next to your code in Git, deployed with one CLI command to <b>dev, staging and prod targets</b>. For a Spring developer: <code>databricks.yml</code> is your <code>application.yml</code> + Helm chart, and <code>bundle deploy</code> is your pipeline’s deploy step.',
  lang: 'yaml',
  tldr: {
    problem: 'Jobs built by clicking in the UI drift between environments, can’t be reviewed, are owned by whoever created them, and break when that person leaves.',
    model: '<code>databricks.yml</code> declares the bundle, <b>variables</b>, <b>resources</b> (jobs, pipelines, schemas, model serving, dashboards…) and <b>targets</b>. <code>bundle deploy -t &lt;target&gt;</code> uploads files and creates/updates/deletes resources to match, tracked in per-target <b>deployment state</b>. CI deploys prod as a <b>service principal</b>.',
    hook: '“How do you promote a job from dev to prod?” You don’t copy it: you merge to main, and CI runs <code>databricks bundle deploy -t prod</code> as a service principal. Same YAML, different target variables.',
    facts: [
      { v: 'databricks.yml', l: 'is the bundle root file; <code>include:</code> pulls in more YAML files (e.g. <code>resources/*.yml</code>)' },
      { v: 'mode: development', l: 'prefixes resource names with <code>[dev &lt;user&gt;]</code> and pauses schedules and triggers' },
      { v: 'new CLI', l: 'bundles need the newer Go-based <code>databricks</code> CLI (v0.2xx), not the legacy Python <code>databricks-cli</code>' }
    ]
  },
  intro: {
    what: 'In a real team you want Databricks jobs to be <b>reviewed, versioned and deployed automatically</b>, like any other code. <b>Databricks Asset Bundles</b> (often “DABs”) do this. You write YAML that describes jobs and pipelines, keep it in Git with the Python/SQL code, and the CLI deploys everything to a workspace. Naming note: as of late 2025 Databricks has been renaming parts of this product, and newer docs may use a different name (for example “Declarative Automation Bundles”); the <code>databricks bundle</code> commands are the same idea. Check your workspace and CLI docs.',
    analogy: { icon: '📦', title: 'A moving box with a packing list', text: 'You pack the code and a list of “what goes where” (the YAML). The movers (the CLI) unpack it into the dev flat or the prod flat. The packing list on file (deployment state) tells them what they unpacked last time, so they replace or remove old furniture instead of adding a second sofa.' },
    steps: [
      { t: 'Start from a template', d: 'Creates a project with <code>databricks.yml</code>, <code>resources/</code> and <code>src/</code>.', code: 'databricks bundle init default-python', lang: 'bash' },
      { t: 'Describe resources', d: 'Jobs and pipelines in YAML, referencing notebooks and Python files by relative path.' },
      { t: 'Define targets', d: '<code>dev</code> (development mode, your user), <code>prod</code> (production mode, service principal), each with its own workspace host and variables like the catalog name.' },
      { t: 'Deploy and run', d: 'Validate, deploy, run. Iterate in dev.', code: 'databricks bundle validate -t dev\ndatabricks bundle deploy -t dev\ndatabricks bundle run -t dev nightly_orders', lang: 'bash' },
      { t: 'Automate', d: 'On merge to main, CI deploys to staging/prod with OAuth as a service principal.' }
    ],
    terms: [
      ['bundle', 'A project folder with <code>databricks.yml</code>, deployable as a unit.'],
      ['target', 'A named deployment destination (dev, staging, prod) with its own settings.'],
      ['resource', 'Something the bundle manages in the workspace: job, pipeline, model serving endpoint, schema, volume, dashboard…'],
      ['variable', '<code>${var.name}</code> substitution, set per target or via <code>--var</code>/env.'],
      ['deployment state', 'Per-target record of which workspace objects the bundle created, so later deploys update or delete them.'],
      ['service principal', 'A non-human identity for CI and for jobs’ <code>run_as</code>.']
    ]
  },
  visual: {
    title: 'One bundle, two targets',
    caption: 'Play or Step: validate and deploy to <b>dev</b> (prefixed, paused), run it, then CI deploys to <b>prod</b> as a service principal. See how deployment state makes later deploys update in place, and how removing a YAML file deletes the resource on the next deploy.'
  },
  gotchas: [
    { trap: 'Prod jobs owned and run by a person', why: 'If jobs run as the engineer who deployed them, they break when that account is disabled, and they run with that person’s broad permissions.', fix: 'In the prod target set <code>run_as: { service_principal_name: … }</code> and deploy from CI authenticated as a service principal.' },
    { trap: 'Deleting YAML deletes the job', why: 'Deployment state tracks what the bundle created. A resource removed from config is destroyed on the next deploy, including its run history.', fix: 'Review the deploy output in CI. Protect prod with approvals. To stop managing something without deleting it, use the CLI’s unbind/unmanage option (check your CLI version) before removing it.' },
    { trap: 'Hardcoded catalog and paths', code: `notebook_task:\n  base_parameters:\n    catalog: prod_main     # dev runs write to prod!`, why: 'Dev deployments then read and write production tables.', fix: 'Use variables: <code>catalog: ${var.catalog}</code>, set per target. Give dev identities no write access to prod catalogs as a second guard.' },
    { trap: 'Two people deploying the same target from laptops', why: 'They overwrite each other’s changes, and state can end up pointing at whatever was deployed last.', fix: 'Shared targets (staging, prod) deploy only from CI. Developers use <code>mode: development</code>, which isolates per user.' },
    { trap: 'Using the legacy CLI or a personal token in CI', why: 'Bundles need the newer CLI. Long-lived personal tokens leak and tie CI to a person.', fix: 'Install a pinned version of the new CLI in CI and use OAuth M2M with a service principal secret, or workload identity federation (OIDC from GitHub/Azure DevOps) where available, so no secret is stored at all.' },
    { trap: 'Mixing UI edits with bundle-managed jobs', why: 'A hotfix in the UI is overwritten on the next deploy without warning.', fix: 'Treat bundle-managed resources as read-only in the UI (the UI shows a banner). Fix in Git and redeploy.' }
  ],
  scenarios: [
    { title: 'Dev deployment overwrote production tables',
      symptom: 'Gold tables in prod show test data after a developer ran their dev copy of the job.',
      diagnose: `grep -rn "prod_main" resources/     # catalog hardcoded in task parameters`,
      cause: 'The job YAML hardcoded the prod catalog. Development mode isolates job names, not the data the job writes.',
      fix: 'Parameterise the catalog per target and remove dev principals’ write access to prod catalogs.',
      fixCode: `variables:\n  catalog:\n    description: target catalog\ntargets:\n  dev:\n    mode: development\n    variables: { catalog: dev_main }\n  prod:\n    mode: production\n    variables: { catalog: prod_main }\n# in the job:\n#   base_parameters: { catalog: \${var.catalog} }` },
    { title: 'All jobs failed the day an engineer left',
      symptom: 'Every nightly job fails with authentication/permission errors after an offboarding.',
      diagnose: 'Job settings show “Run as: alex@company.com”, the deployer, for all prod jobs.',
      cause: 'Prod was deployed from a laptop without <code>run_as</code>, so jobs ran as the deploying user.',
      fix: 'Deploy prod only from CI as a service principal and set <code>run_as</code> explicitly; production mode warns about this.',
      fixCode: `targets:\n  prod:\n    mode: production\n    workspace:\n      host: https://<prod-workspace-host>\n      root_path: /Workspace/Shared/.bundle/\${bundle.name}/\${bundle.target}\n    run_as:\n      service_principal_name: 1d2c3b4a-0000-1111-2222-333344445555   # SP application id\n    permissions:\n      - group_name: data-eng\n        level: CAN_MANAGE` },
    { title: 'A pipeline vanished after a refactor',
      symptom: 'After a PR that “reorganised resources”, the prod ingestion pipeline is gone, with its history.',
      diagnose: 'The PR moved <code>orders.pipeline.yml</code> to a folder not matched by <code>include:</code>. CI log: “Deleting pipeline orders”.',
      cause: 'The bundle no longer saw the resource in config, but it was in state, so deploy deleted it.',
      fix: 'Fix the include glob. Add a CI step that fails when the deploy would delete resources in prod unless a label/approval is present. Recreate the pipeline (data in tables remains, but managed tables may be affected; check before re-running).',
      fixCode: `include:\n  - resources/**/*.yml` }
  ],
  puzzles: [
    { kind: 'concept', q: 'What does <code>mode: development</code> do to a job on deploy?', options: ['Runs it immediately', 'Prefixes its name with <code>[dev user]</code> and pauses its schedule and triggers', 'Runs it as a service principal', 'Disables retries'], answer: 1, explain: 'Development mode isolates each developer’s copy and stops dev copies from firing on schedule.' },
    { kind: 'concept', q: 'You remove a job’s YAML file and run <code>bundle deploy -t prod</code>. Result?', options: ['Nothing changes in the workspace', 'The job is deleted, because it is in deployment state but not in config', 'Deploy fails', 'The job is paused'], answer: 1, explain: 'Bundles reconcile the workspace to the config, like Terraform. Removed resources are destroyed.' },
    { kind: 'concept', q: 'Best identity for CI deploying to prod?', options: ['A personal access token of the team lead', 'A service principal using OAuth (M2M secret or workload identity federation)', 'The workspace admin password', 'Anonymous access'], answer: 1, explain: 'Service principals are stable, least-privilege identities. Federation avoids storing a secret in CI at all.' },
    { kind: 'concept', q: 'How do you make the same job write to <code>dev_main</code> in dev and <code>prod_main</code> in prod?', options: ['Two copies of the YAML', 'A bundle variable set per target, referenced as <code>${var.catalog}</code>', 'An if-statement in the notebook on the hostname', 'Different Git branches'], answer: 1, explain: 'Targets override variables. Code reads the catalog from a job parameter.' },
    { kind: 'concept', q: 'Which command checks the configuration without deploying?', options: ['<code>databricks bundle run</code>', '<code>databricks bundle validate</code>', '<code>databricks bundle destroy</code>', '<code>databricks jobs list</code>'], answer: 1, explain: '<code>validate</code> loads and resolves the config (includes, variables, targets) and reports errors and warnings.' },
    { kind: 'concept', q: 'A teammate hotfixes a bundle-managed job’s cluster size in the UI. What happens on the next CI deploy?', options: ['The UI change is kept', 'The deploy overwrites it with the YAML value', 'The deploy fails with a conflict', 'Both values are merged'], answer: 1, explain: 'Config is the source of truth. Make the change in Git.' }
  ],
  interview: [
    { q: 'What is a Databricks Asset Bundle?', a: '<p>A way to define Databricks resources (jobs, pipelines, model serving endpoints, schemas, volumes, dashboards, …) and their code as files in a repo, and deploy them with the Databricks CLI to one or more targets. It is built on a Terraform-like provider, but you write Databricks-specific YAML (or, in newer versions, Python definitions).</p>', lvl: 'core' },
    { q: 'Walk through a CI/CD pipeline for Databricks.', a: '<ol><li>PR: lint, unit tests (pure Python with pytest; Spark logic with local Spark or Databricks Connect), <code>bundle validate</code>.</li><li>Optional: deploy to a per-PR or shared staging target and run an integration job on small data.</li><li>Merge: CI deploys to prod as a service principal (<code>bundle deploy -t prod</code>), possibly gated by an approval.</li><li>Jobs then run on schedule as the service principal.</li></ol>', lvl: 'core' },
    { q: 'Development vs production mode?', a: '<ul><li><b>development</b>: resource names prefixed with <code>[dev user]</code>, schedules/triggers paused, pipelines in development mode, deploy under your user folder; allows concurrent dev copies.</li><li><b>production</b>: no prefixes; validates that <code>run_as</code>/permissions are set appropriately and can check the Git branch; schedules live.</li></ul>', lvl: 'core' },
    { q: 'How do bundles handle environments?', a: '<p>With <b>targets</b>: each has a workspace host, root path, mode, variable values, and can override any resource field (e.g. bigger clusters in prod, different schedules). Variables can also come from <code>--var</code>, environment variables or lookups (e.g. a cluster policy id by name).</p>', lvl: 'core' },
    { q: 'How should CI authenticate?', a: '<p>As a service principal. Preferred: workload identity federation (the CI’s OIDC token is exchanged for a Databricks token, no stored secret). Otherwise OAuth M2M with a client secret stored in the CI secret store. Avoid personal access tokens.</p>', fu: 'What permissions does the SP need? Workspace access, ability to create/manage the bundle’s resources, and UC privileges for the jobs it runs as.', lvl: 'deep' },
    { q: 'How do you test Databricks code before deploying?', a: '<p>Keep transformation logic in plain Python functions that take and return DataFrames, test them with pytest on small DataFrames (local Spark or Databricks Connect against a dev cluster/serverless). Integration-test the job in a staging target on sample data. Notebooks should be thin wrappers.</p>', lvl: 'deep' },
    { q: 'What happens to existing UI-created jobs when you adopt bundles?', a: '<p>Nothing automatically. You can generate YAML from an existing job (<code>databricks bundle generate job --existing-job-id …</code>) and bind it to the existing resource so the bundle takes ownership instead of creating a duplicate (<code>bundle deployment bind</code>). Check your CLI version for these subcommands.</p>', lvl: 'deep' },
    { q: 'Bundles vs Terraform?', a: '<p>Terraform (the Databricks provider) is better for workspace and account infrastructure: workspaces, networking, metastores, catalogs, groups. Bundles target the data team’s project artifacts (jobs, pipelines, code) with a developer workflow (dev mode, run, templates). Many teams use both.</p>', lvl: 'deep' },
    { q: 'Where is deployment state stored and why does it matter?', a: '<p>Per target in the workspace under the bundle’s root path (with a local cache in <code>.databricks/</code>, which shouldn’t be committed). It maps resource keys to ids. Lose or fork it and the next deploy can create duplicates; share one target from two places and they fight.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'databricks.yml', lang: 'yaml', code: `bundle:\n  name: orders\n\ninclude:\n  - resources/*.yml\n\nvariables:\n  catalog:\n    description: Unity Catalog catalog to write to\n\ntargets:\n  dev:\n    mode: development\n    default: true\n    workspace:\n      host: https://<dev-workspace-host>\n    variables:\n      catalog: dev_main\n\n  prod:\n    mode: production\n    workspace:\n      host: https://<prod-workspace-host>\n      root_path: /Workspace/Shared/.bundle/\${bundle.name}/\${bundle.target}\n    variables:\n      catalog: prod_main\n    run_as:\n      service_principal_name: <sp-application-id>` },
    { title: 'resources/nightly_orders.job.yml', lang: 'yaml', code: `resources:\n  jobs:\n    nightly_orders:\n      name: nightly_orders\n      schedule:\n        quartz_cron_expression: "0 30 2 * * ?"\n        timezone_id: UTC\n      tags:\n        team: data-eng\n        cost_center: "4711"\n      tasks:\n        - task_key: build\n          environment_key: default\n          spark_python_task:\n            python_file: ../src/build_orders.py\n            parameters: ["--catalog", "\${var.catalog}"]\n      environments:\n        - environment_key: default\n          spec:\n            client: "2"\n            dependencies: ["-r ../requirements.txt"]`, note: 'This uses serverless jobs compute via <code>environments</code>; use <code>job_clusters</code> instead for classic compute. Field support depends on CLI and workspace version.' },
    { title: 'GitHub Actions deploy', lang: 'yaml', code: `name: deploy-prod\non:\n  push:\n    branches: [main]\npermissions:\n  id-token: write        # for workload identity federation (OIDC)\n  contents: read\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    environment: prod     # approval gate\n    env:\n      DATABRICKS_HOST: \${{ vars.DATABRICKS_HOST }}\n      DATABRICKS_CLIENT_ID: \${{ vars.DATABRICKS_SP_CLIENT_ID }}\n      DATABRICKS_AUTH_TYPE: github-oidc\n    steps:\n      - uses: actions/checkout@v4\n      - uses: databricks/setup-cli@main   # pin a released version in real use\n      - run: databricks bundle validate -t prod\n      - run: databricks bundle deploy -t prod`, note: 'Federation needs a federation policy on the service principal. Otherwise use <code>DATABRICKS_CLIENT_SECRET</code> from CI secrets (OAuth M2M).' },
    { title: 'Everyday commands', lang: 'bash', code: `databricks bundle init default-python      # new project from a template\ndatabricks bundle validate -t dev\ndatabricks bundle deploy -t dev\ndatabricks bundle run -t dev nightly_orders\ndatabricks bundle summary -t prod          # what is deployed where\ndatabricks bundle destroy -t dev           # remove your dev copy` }
  ]
});

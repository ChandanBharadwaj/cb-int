IA.register({
  track: 'databricks',
  slug: 'dbx-notebooks-git',
  title: 'Notebooks & Git folders',
  tagline: 'Notebooks are where most Databricks work starts: cells in Python or SQL, <b>magic commands</b>, and the <code>dbutils</code> toolbox. <b>Git folders</b> (formerly “Repos”) put them under version control so production runs code from a branch, not from someone’s scratchpad.',
  tldr: {
    problem: 'Production jobs pointing at a personal notebook that someone edits at 4 pm on a Friday. Secrets pasted into cells. Helper code copy-pasted across 30 notebooks.',
    model: 'A notebook is a <b>source file</b> (<code>.py</code> with cell markers, or <code>.ipynb</code>) running on the <b>driver</b>. <code>%run</code> inlines, <code>dbutils.notebook.run</code> calls. <b>Git folders</b> sync with a remote; jobs run from a Git ref or a deployed bundle.',
    hook: '“What is the difference between <code>%run</code> and <code>dbutils.notebook.run()</code>?” Same scope vs a separate child run with parameters and a string return value.',
    facts: [
      { v: '%sql %md %sh %pip %run', l: 'common magic commands; a magic must be on a cell’s first line' },
      { v: '[REDACTED]', l: 'what notebooks print when you display a value fetched with <code>dbutils.secrets.get</code>' },
      { v: '# COMMAND ----------', l: 'the cell separator in a notebook exported as Python source' }
    ]
  },
  intro: {
    what: 'A <b>notebook</b> is a document of cells. Each cell holds code (Python by default here, or SQL, Scala, R) or Markdown. Running a cell sends it to the cluster’s driver, which keeps state between cells, like a REPL. <code>dbutils</code> is a helper object for files, secrets, widgets (parameters) and calling other notebooks. A <b>Git folder</b> is a workspace folder linked to a Git repository so you can branch, commit, push and pull.',
    analogy: { icon: '📓', title: 'A lab notebook with a REPL inside', text: 'Like jshell or a Jupyter notebook, but every cell can also use a Spark cluster. Git folders are the difference between a lab notebook on your desk and a reviewed, versioned lab protocol.' },
    steps: [
      { t: 'Cells and languages', d: 'Python is the default language; switch per cell with a magic.', code: '%sql\nSELECT current_catalog(), current_schema();', lang: 'sql' },
      { t: 'Parameters with widgets', d: 'Widgets make a notebook callable with arguments from jobs.', code: 'dbutils.widgets.text("run_date", "2025-01-01")\nrun_date = dbutils.widgets.get("run_date")' },
      { t: 'Secrets, never literals', d: 'Secret scopes store credentials; values are redacted in output.', code: 'pwd = dbutils.secrets.get(scope="kafka", key="sasl-password")' },
      { t: 'Version it', d: 'Create a Git folder from your repo URL, branch, commit and open PRs in your Git provider.' }
    ],
    terms: [
      ['magic command', 'A <code>%</code> prefix on a cell’s first line: <code>%sql</code>, <code>%md</code>, <code>%sh</code>, <code>%pip</code>, <code>%run</code>, <code>%fs</code>.'],
      ['dbutils', 'Notebook utilities: <code>fs</code>, <code>secrets</code>, <code>widgets</code>, <code>notebook</code>, <code>jobs.taskValues</code>.'],
      ['Git folder', 'Workspace folder synced with a remote Git repo. Formerly called “Repos”.'],
      ['workspace files', 'Non-notebook files (<code>.py</code> modules, YAML) stored in the workspace and importable from notebooks.'],
      ['secret scope', 'Named container of secrets; backed by Databricks or by Azure Key Vault.']
    ]
  },
  visual: {
    title: 'From cell to driver, from branch to job',
    caption: 'Choose <b>Git folder flow</b> to follow code from a branch to a production job, or <b>Magic commands</b> to see where each cell type runs. Press Play or Step.'
  },
  gotchas: [
    { trap: '<code>%pip install</code> mid-notebook wipes your state', why: '<code>%pip</code> restarts the Python process so the new library loads. Variables from earlier cells are gone.', fix: 'Put all <code>%pip install</code> cells at the top. For production, declare libraries on the job task or the serverless environment.' },
    { trap: 'Writing to local disk with <code>%sh</code> or plain Python', code: '%sh\ncurl -o /tmp/data.csv https://example.com/data.csv   # driver-local only', lang: 'bash', why: '<code>%sh</code> runs on the driver only. <code>/tmp</code> is not visible to executors and disappears when the cluster stops.', fix: 'Write to a Unity Catalog volume: <code>/Volumes/main/raw/landing/data.csv</code>, then read it with Spark.' },
    { trap: 'Assuming <code>%run</code> takes parameters like a function', why: '<code>%run ./child $x="1"</code> passes widget values, but the child runs inline in your scope and its variables leak into yours. It cannot be used in a loop with dynamic paths.', fix: 'Prefer importing Python modules from workspace files (<code>from utils.clean import dedupe</code>). Use <code>dbutils.notebook.run(path, timeout, args)</code> when you need an isolated call with a return value.' },
    { trap: 'Printing secrets “just to check”', why: 'Output shows <code>[REDACTED]</code>, but redaction is best effort: transforming the value (e.g. spacing out characters) can leak it.', fix: 'Never print secrets. Restrict scope ACLs; audit with system tables.' },
    { trap: 'Production job pointing at a user’s notebook', why: 'Anyone with edit rights can change prod by editing a notebook; there is no review and no history beyond notebook revisions.', fix: 'Point jobs at a Git provider source (repo + branch/tag) or deploy with Asset Bundles from CI.' },
    { trap: 'Notebook outputs committed to Git', why: '<code>.ipynb</code> files can carry outputs (data samples, possibly PII) into your repo.', fix: 'Use source format (<code>.py</code>) or configure output stripping before commit; check your workspace’s Git settings for notebook output handling.' }
  ],
  scenarios: [
    { title: 'Hot-fix in prod notebook overwritten',
      symptom: 'A bug fixed on Tuesday reappears on Thursday. Nobody admits changing anything.',
      diagnose: '-- job definition: notebook_path = /Users/sam@corp.com/etl/orders\n-- notebook revision history: Sam restored an older revision on Wednesday',
      cause: 'The job ran a personal notebook. Two people edited it outside Git; one restored an old revision.',
      fix: 'Move the code into a repo, run the job from <code>git_source</code> on a protected branch, and require PR review.',
      fixCode: `"git_source": {
  "git_url": "https://github.com/acme/etl",
  "git_provider": "gitHub",
  "git_branch": "main"
},
"tasks": [{ "task_key": "orders",
  "notebook_task": { "notebook_path": "jobs/orders", "source": "GIT" } }]`, lang: 'json' },
    { title: 'Child notebooks run in a loop, then parent times out',
      symptom: 'A parent notebook calls 50 child notebooks one by one with <code>dbutils.notebook.run</code>; the job takes hours and fails without clear errors.',
      cause: 'Each call is a separate ephemeral run, serialised; one failure raises an exception in the parent. Orchestration logic lives in notebook code instead of the scheduler.',
      fix: 'Model the children as job tasks (or a for-each task) with dependencies and retries, and let the jobs service parallelise them.',
      fixCode: `# if you must call from code, run a few in parallel and collect results
from concurrent.futures import ThreadPoolExecutor
paths = [f"./ingest_{t}" for t in ["orders", "users", "items"]]
with ThreadPoolExecutor(3) as ex:
    out = list(ex.map(lambda p: dbutils.notebook.run(p, 1800, {"date": "2025-06-01"}), paths))` }
  ],
  puzzles: [
    { kind: 'concept', q: 'Cell 1 sets <code>x = 5</code>. Cell 2 runs <code>%pip install requests</code>. Cell 3 prints <code>x</code>. What happens?', options: ['Prints 5', 'NameError: x is not defined', 'Prints None', 'Cell 2 fails'], answer: 1, explain: '<code>%pip</code> restarts the Python process, so state from earlier cells is lost. Put installs first.' },
    { kind: 'concept', q: 'Notebook A runs <code>%run ./B</code>. B defines <code>def clean(df): …</code>. Can A call <code>clean</code> afterwards?', options: ['Yes, %run inlines B into A’s scope', 'No, B runs as a separate job', 'Only if B returns it', 'Only with dbutils.notebook.exit'], answer: 0, explain: '<code>%run</code> executes B in the same context, so its definitions appear in A. <code>dbutils.notebook.run</code> would not share scope.' },
    { kind: 'concept', q: 'What does <code>dbutils.notebook.run("./child", 600, {"d": "x"})</code> return?', options: ['A DataFrame', 'The child’s variables', 'The string passed to dbutils.notebook.exit() in the child', 'Nothing'], answer: 2, explain: 'It starts an ephemeral run and returns the string the child passes to <code>dbutils.notebook.exit(value)</code>. Pass larger results through a table or a temp view on the same cluster.' },
    { kind: 'concept', q: 'A <code>%sh</code> cell downloads a file to <code>/tmp/x.csv</code>. <code>spark.read.csv("file:/tmp/x.csv")</code> on a 4-worker cluster then…', options: ['Works fine', 'May fail or read nothing, because executors don’t have the file', 'Reads it 4 times', 'Uploads it to a volume automatically'], answer: 1, explain: 'The file exists on the driver’s disk only. Executors look at their own local disks. Use a volume path instead.' },
    { kind: 'concept', q: 'What were Git folders called before?', options: ['Workspaces', 'Repos', 'Libraries', 'Bundles'], answer: 1, explain: 'Databricks Repos was renamed Git folders (2024). The API is still called the Repos API.' },
    { kind: 'concept', q: 'Best place for shared helper functions used by many notebooks?', options: ['Copy into each notebook', 'A %run utility notebook', 'Python modules (workspace files) in the repo, imported normally', 'A cluster init script'], answer: 2, explain: 'Modules in a Git folder can be imported and unit tested with pytest. <code>%run</code> works but is harder to test and leaks scope.' }
  ],
  interview: [
    { q: '<code>%run</code> vs <code>dbutils.notebook.run</code>?', a: '<ul><li><code>%run</code>: inline, same scope, static path, no return value. Good for shared setup.</li><li><code>dbutils.notebook.run</code>: separate ephemeral run, parameters as widgets, timeout, returns a string via <code>dbutils.notebook.exit</code>, can be wrapped in try/except or run in threads.</li></ul>', lvl: 'core' },
    { q: 'How do you pass parameters to a notebook from a job?', a: '<p>Define widgets (<code>dbutils.widgets.text</code>) and read them with <code>dbutils.widgets.get</code>. Job task parameters (or job-level parameters) fill them. Values arrive as strings.</p>', fu: 'How do tasks pass values to later tasks? <code>dbutils.jobs.taskValues.set</code> / <code>get</code>.', lvl: 'core' },
    { q: 'How are secrets handled?', a: '<p>Secret scopes (Databricks-backed or Azure Key Vault-backed) with ACLs. Read with <code>dbutils.secrets.get</code>; notebook output redacts the value. Prefer Unity Catalog service credentials or connections where they exist, so no raw keys are needed.</p>', lvl: 'core' },
    { q: 'What does a Git folder support and not support?', a: '<p>Clone, branch, pull, commit, push, merge and some conflict resolution from the UI; sparse checkout for big repos. Reviews and PRs happen in your Git provider. Each user should use their own Git folder; jobs should use the remote repo directly or a deployed bundle.</p>', lvl: 'core' },
    { q: 'How would you unit test notebook code?', a: '<p>Move logic into Python modules (functions that take and return DataFrames), keep notebooks thin, and test modules with pytest, either locally with Databricks Connect / a local SparkSession or in CI against a cluster.</p>', lvl: 'deep' },
    { q: 'What file format is a notebook in Git?', a: '<p>By default a source file: a <code>.py</code> starting with <code># Databricks notebook source</code> and cells split by <code># COMMAND ----------</code>, with magics as <code># MAGIC</code> comments. <code>.ipynb</code> is also supported.</p>', lvl: 'deep' },
    { q: 'What is <code>display()</code>?', a: '<p>A notebook function that renders a DataFrame as an interactive table or chart. It collects a limited number of rows to the driver for display. It is not available in plain Python jobs outside notebooks.</p>', lvl: 'core' },
    { q: 'What is Databricks Connect?', a: '<p>A client library that lets your IDE run DataFrame code against a remote Databricks cluster or serverless compute (Spark Connect based, DBR 13+). Good for local development and debugging with your normal tools.</p>', lvl: 'deep' },
    { q: 'How do CI/CD and notebooks fit together?', a: '<p>Code in Git, PR review, CI runs tests, then <code>databricks bundle deploy -t prod</code> deploys jobs, pipelines and code to the prod workspace under a service principal. Humans don’t edit prod.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'A notebook as a Python source file', lang: 'python', code: `# Databricks notebook source
# MAGIC %md
# MAGIC # Orders bronze load

# COMMAND ----------

dbutils.widgets.text("run_date", "")
run_date = dbutils.widgets.get("run_date")

# COMMAND ----------

from etl.clean import dedupe_orders          # module in the same Git folder
df = spark.read.table("main.bronze.orders").where(f"ingest_date = '{run_date}'")
dedupe_orders(df).write.mode("append").saveAsTable("main.silver.orders_stage")` },
    { title: 'Files and volumes with dbutils', lang: 'python', code: `dbutils.fs.ls("/Volumes/main/raw/landing/")          # list governed files
dbutils.fs.cp("/Volumes/main/raw/landing/a.csv", "/Volumes/main/raw/archive/a.csv")
dbutils.fs.help()                                        # everything fs can do`, note: 'Prefer volume paths over legacy DBFS mounts; mounts are not governed by Unity Catalog.' },
    { title: 'Databricks CLI with Git folders', lang: 'bash', code: `databricks repos create https://github.com/acme/etl gitHub --path /Workspace/Users/me@acme.com/etl
databricks repos update /Workspace/Users/me@acme.com/etl --branch main` }
  ]
});

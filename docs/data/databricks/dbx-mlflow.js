IA.register({
  track: 'databricks',
  slug: 'dbx-mlflow',
  title: 'MLflow & ML on Databricks',
  tagline: 'MLflow is the bookkeeping layer for machine learning: every training <b>run</b> logs its params, metrics and model; good models are <b>registered in Unity Catalog</b> as versions with <b>aliases</b>; and <b>Model Serving</b> turns a version into a REST endpoint. Think of it as Git + Maven + a deploy target, but for models.',
  tldr: {
    problem: 'Without tracking, nobody knows which notebook, data and parameters produced the model in production, and “rollback” means retraining from memory.',
    model: '<b>Experiment</b> (folder) → <b>runs</b> (params, metrics, artifacts, logged model) → <b>registered model</b> <code>catalog.schema.model</code> in UC → <b>versions</b> → <b>aliases</b> (<code>@champion</code>) → consumers load <code>models:/cat.schema.model@champion</code> in batch jobs or a <b>serving endpoint</b>.',
    hook: '“How do you promote a model in Unity Catalog?” Move an alias. Stages (Staging/Production) are the legacy workspace registry; UC uses aliases and tags.',
    facts: [
      { v: 'open source', l: 'MLflow is an open-source project started by Databricks; Databricks hosts a managed tracking server and registry' },
      { v: 'signature', l: 'is required to register a model in Unity Catalog (input/output schema)' },
      { v: 'MLflow 3', l: '(2025) added first-class LoggedModels and GenAI tracing/evaluation; APIs differ a little from 2.x, so check your version' }
    ]
  },
  intro: {
    what: 'Training a model is a loop: change a parameter, train, measure, repeat. <b>MLflow</b> records each attempt (a <b>run</b>) so you can compare them and reproduce the winner. When a model is good enough you <b>register</b> it: it gets a name and a version number in <b>Unity Catalog</b>, with permissions and lineage like a table. Applications then use it in batch (a scoring job) or online (a <b>serving endpoint</b>, an HTTPS API).',
    analogy: { icon: '🧪', title: 'A lab notebook and a release shelf', text: 'Every experiment gets a page: ingredients (params), results (metrics), and a sample in a jar (the model artifact). The best sample goes on a numbered release shelf (registry versions), and a sticky note “use this one” (the alias) can be moved from jar to jar without relabelling anything.' },
    steps: [
      { t: 'Track runs', d: 'Wrap training in a run, or turn on autolog for sklearn, XGBoost, PyTorch, Spark ML…', code: 'mlflow.autolog()\nwith mlflow.start_run():\n    model.fit(X_train, y_train)' },
      { t: 'Compare', d: 'Experiment UI or <code>mlflow.search_runs(order_by=["metrics.val_auc DESC"])</code>.' },
      { t: 'Register in UC', d: 'Set the registry to Unity Catalog and register the best run’s model with a signature.', code: 'mlflow.set_registry_uri("databricks-uc")' },
      { t: 'Point an alias', d: '<code>@champion</code> for production, <code>@challenger</code> for the candidate.' },
      { t: 'Serve', d: 'Batch: load by alias in a job. Online: a Model Serving endpoint with autoscaling and traffic splitting.' }
    ],
    terms: [
      ['experiment', 'A named group of runs, usually one per modelling problem.'],
      ['run', 'One training execution: params, metrics (with history), tags, artifacts.'],
      ['artifact', 'Any file logged with a run: model files, plots, data samples.'],
      ['signature', 'The model’s input and output schema, stored with the model.'],
      ['alias', 'A movable name (<code>@champion</code>) pointing at one model version.'],
      ['serving endpoint', 'A managed REST endpoint that serves one or more model versions.']
    ]
  },
  visual: {
    title: 'From runs to a served champion',
    caption: 'Play or Step through a model’s life: runs in an experiment, registering version 1 in Unity Catalog, the <code>@champion</code> alias, a serving endpoint, a challenger version, a 90/10 canary and promotion by moving the alias.'
  },
  gotchas: [
    { trap: 'Registering to the workspace registry by accident', code: `mlflow.register_model(uri, "churn")   # no catalog.schema: legacy workspace registry`, why: 'Depending on workspace defaults and MLflow version, the registry URI may still point at the legacy workspace registry. Those models are not governed by UC and use stages.', fix: 'Call <code>mlflow.set_registry_uri("databricks-uc")</code> and use three-level names: <code>main.ml.churn</code>.' },
    { trap: 'Missing signature', why: 'UC rejects models without a signature. Without one, serving can’t validate inputs either.', fix: 'Log with <code>signature=infer_signature(X_sample, model.predict(X_sample))</code> or pass <code>input_example</code>.' },
    { trap: 'Loading a hardcoded version in jobs', code: `mlflow.pyfunc.load_model("models:/main.ml.churn/7")`, why: 'Every promotion needs a code change and a redeploy; rollback is slow.', fix: 'Load by alias: <code>models:/main.ml.churn@champion</code>. Promotion and rollback become one API call.' },
    { trap: 'Training/serving skew from duplicated feature code', why: 'Features computed one way in training (a notebook) and another way in the serving app drift apart silently.', fix: 'Compute features once in UC feature tables (Feature Engineering in Unity Catalog) and log the model with them, so serving looks features up the same way.' },
    { trap: 'Logging huge artifacts every step', why: 'Logging full datasets or checkpoints on each epoch fills storage and slows runs; the tracking UI becomes unusable.', fix: 'Log metrics per step, artifacts once (best checkpoint, small samples). Use UC volumes or tables for datasets and log their names/versions.' },
    { trap: 'Forgetting permissions on the model', why: 'A UC model is a securable: a serving endpoint or job identity needs <code>EXECUTE</code> on the model plus <code>USE CATALOG</code>/<code>USE SCHEMA</code>.', fix: 'Grant to the service principal that runs scoring jobs and endpoints, not to people.' }
  ],
  scenarios: [
    { title: '“Which model is in production?” Nobody knows',
      symptom: 'Churn predictions drift. The team can’t tell which training data or code produced the model that the scoring job uses.',
      diagnose: 'The scoring job loads a pickle file from a cloud path written by a notebook six months ago. No run, no version, no lineage.',
      cause: 'Models were saved as files outside MLflow.',
      fix: 'Retrain inside a tracked run, register in UC, load by alias in the job. Lineage then shows run → version → training tables.',
      fixCode: `import mlflow\nmlflow.set_registry_uri("databricks-uc")\nwith mlflow.start_run() as run:\n    model.fit(X_train, y_train)\n    mlflow.sklearn.log_model(model, "model",\n        signature=mlflow.models.infer_signature(X_train, model.predict(X_train)),\n        registered_model_name="main.ml.churn")` },
    { title: 'Bad model promoted, 30-minute outage of recommendations',
      symptom: 'After promotion, the serving endpoint returns errors for 20% of requests: a new categorical value was missing in the new model’s encoder.',
      diagnose: 'Inference table shows errors only for requests routed to the new version; it was sent 100% of traffic at once.',
      cause: 'No canary; promotion was a direct full switch.',
      fix: 'Serve champion and challenger together with a small traffic share for the challenger, watch errors and metrics, then move the alias. Roll back by moving the alias back.',
      fixCode: `from mlflow import MlflowClient\nc = MlflowClient(registry_uri="databricks-uc")\nc.set_registered_model_alias("main.ml.churn", "champion", 6)   # rollback to v6` },
    { title: 'Scoring job fails after a permissions cleanup',
      symptom: 'The nightly batch scoring job fails with a permission error when loading the model.',
      diagnose: 'The job runs as a service principal. A cleanup removed broad grants on the <code>ml</code> schema.',
      cause: 'The principal lost <code>EXECUTE</code> on the model (and/or USE SCHEMA).',
      fix: 'Grant explicitly to the job’s principal and manage grants as code.',
      fixCode: `GRANT USE CATALOG ON CATALOG main TO \`sp-scoring\`;\nGRANT USE SCHEMA ON SCHEMA main.ml TO \`sp-scoring\`;\n-- plus EXECUTE on the model main.ml.churn: grant it in Catalog Explorer or with\n-- the GRANT syntax for models documented for your workspace (models are UC securables)`, lang: 'sql' }
  ],
  puzzles: [
    { kind: 'concept', q: 'You want batch scoring to always use the current production model without code changes. Which URI?', options: ['<code>models:/main.ml.churn@champion</code>', '<code>models:/main.ml.churn/3</code>', '<code>runs:/&lt;run_id&gt;/model</code>', '<code>models:/churn/Production</code>'], answer: 0, explain: 'An alias URI resolves at load time. Version and run URIs are fixed; <code>/Production</code> is the legacy stage syntax, not used by UC.' },
    { kind: 'concept', q: 'Params vs metrics:', options: ['Both can be logged per step', 'Metrics must be strings', 'Params are logged once per run (immutable); metrics are numbers that can be logged many times with a step', 'Params are only for deep learning'], answer: 2, explain: 'Logging the same param twice with a different value raises an error; metrics keep a history.' },
    { kind: 'concept', q: 'Registering a model to UC fails because of a missing signature. Fix?', options: ['Use a bigger cluster', 'Register to the workspace registry', 'Remove requirements.txt', 'Log the model with a signature or an input example'], answer: 3, explain: 'UC requires the input/output schema. <code>infer_signature</code> or <code>input_example</code> provide it.' },
    { kind: 'concept', q: 'How do you roll back a bad promotion fastest?', options: ['Retrain the old model', 'Point the <code>@champion</code> alias back at the previous version', 'Delete the new version', 'Redeploy the workspace'], answer: 1, explain: 'Aliases are pointers. Consumers that load by alias pick up the old version again; serving endpoints should be updated to that version too.' },
    { kind: 'concept', q: 'What does <code>mlflow.autolog()</code> do?', options: ['Deploys models automatically', 'Turns on the UC registry', 'Logs params, metrics and the model for supported libraries without explicit log calls', 'Schedules training'], answer: 2, explain: 'Autologging hooks into frameworks like scikit-learn, XGBoost, LightGBM, PyTorch Lightning and Spark ML.' },
    { kind: 'concept', q: 'A serving endpoint serves v4 (90%) and v5 (10%). What is this pattern, and what should you watch?', options: ['A canary / A-B split; compare error rate, latency and business metrics per version', 'Blue/green; nothing', 'Shadow mode; only latency', 'Ensemble; accuracy only'], answer: 0, explain: 'Traffic splitting across served entities lets you test a challenger on real traffic. Inference tables log requests per version for comparison.' }
  ],
  interview: [
    { q: 'What are the main MLflow components?', a: '<ul><li><b>Tracking</b>: experiments, runs, params, metrics, artifacts.</li><li><b>Models</b>: a standard format with “flavors” (sklearn, pytorch, pyfunc) and a signature.</li><li><b>Model Registry</b>: versions, aliases, tags; in Databricks, Unity Catalog.</li><li>Plus evaluation and, for GenAI, tracing (MLflow 3, 2025).</li></ul>', lvl: 'core' },
    { q: 'Workspace model registry vs Unity Catalog registry?', a: '<p>Workspace registry: per workspace, stages (None/Staging/Production/Archived), its own ACLs. UC registry: <code>catalog.schema.model</code>, shared across workspaces attached to the metastore, governed with UC grants, lineage to tables and runs, aliases and tags instead of stages. UC is the recommended default as of 2024–2025.</p>', lvl: 'core' },
    { q: 'How do you deploy a model for real-time inference on Databricks?', a: '<p>Create a Model Serving endpoint for a UC model version. It provisions serverless compute that autoscales (optionally to zero), exposes a REST API with OAuth/token auth, supports traffic splits across versions, and can log requests to an inference table for monitoring.</p>', fu: 'Cold starts? Scale-to-zero saves money but adds latency on the first request; keep a minimum for latency-sensitive APIs.', lvl: 'core' },
    { q: 'Batch inference at scale?', a: '<p>Load the model as a Spark UDF: <code>mlflow.pyfunc.spark_udf(spark, "models:/main.ml.churn@champion")</code> and apply it to a DataFrame in a scheduled job. Or use SQL <code>ai_query()</code> against a serving endpoint for smaller volumes.</p>', lvl: 'deep' },
    { q: 'How do you make a training run reproducible?', a: '<ul><li>Log code version (Git commit; Databricks records the notebook revision).</li><li>Log data version: table name + Delta version or timestamp.</li><li>Log params, seed, library versions (the logged model captures its environment).</li><li>Run on a pinned runtime (ML runtime LTS).</li></ul>', lvl: 'deep' },
    { q: 'What is a model signature and why does it matter?', a: '<p>The schema of inputs and outputs (column names and types, or tensor shapes). Serving and <code>spark_udf</code> use it to validate and convert inputs. UC requires it, which prevents “works in the notebook, crashes in serving” type errors.</p>', lvl: 'core' },
    { q: 'How would you design champion/challenger promotion?', a: '<ol><li>Train and register a new version; tag with evaluation results.</li><li>Alias <code>@challenger</code>; offline evaluation against a holdout.</li><li>Canary traffic split on the endpoint; compare live metrics.</li><li>Move <code>@champion</code>; keep the previous version for rollback.</li><li>Automate as a job with approval for the final step.</li></ol>', lvl: 'deep' },
    { q: 'Where do features live, and why not just compute them in the notebook?', a: '<p>In feature tables in Unity Catalog (Feature Engineering client). Models logged with feature lookups record which features they need, so batch scoring and serving look up the same values; online stores serve them at low latency. It removes training/serving skew and gives lineage.</p>', lvl: 'deep' },
    { q: 'How does MLflow relate to GenAI and agents?', a: '<p>MLflow 3 (2025) adds tracing of LLM and agent calls, evaluation with LLM judges, and prompt versioning; Databricks wraps this in its agent tooling. The core ideas are the same: runs and traces are recorded, versions are registered, endpoints serve them. Check current docs; this area changes quickly.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Train, log and register in UC', lang: 'python', code: `import mlflow\nfrom mlflow.models import infer_signature\nfrom sklearn.ensemble import RandomForestClassifier\nfrom sklearn.metrics import roc_auc_score\n\nmlflow.set_registry_uri("databricks-uc")\nmlflow.set_experiment("/Shared/churn")\n\npdf = spark.read.table("main.ml.churn_features").toPandas()\nX, y = pdf.drop(columns=["churned"]), pdf["churned"]\n\nwith mlflow.start_run() as run:\n    model = RandomForestClassifier(max_depth=8, n_estimators=200, random_state=7).fit(X, y)\n    mlflow.log_params({"max_depth": 8, "n_estimators": 200})\n    mlflow.log_metric("train_auc", roc_auc_score(y, model.predict_proba(X)[:, 1]))\n    mlflow.sklearn.log_model(\n        model, "model",\n        signature=infer_signature(X.head(100), model.predict(X.head(100))),\n        registered_model_name="main.ml.churn")`, note: 'Use a proper train/validation split in real work; this is the minimal shape.' },
    { title: 'Aliases: promote and roll back', lang: 'python', code: `from mlflow import MlflowClient\nc = MlflowClient(registry_uri="databricks-uc")\n\nlatest = max(int(v.version) for v in c.search_model_versions("name='main.ml.churn'"))\nc.set_registered_model_alias("main.ml.churn", "challenger", latest)\n\n# after evaluation / canary\nc.set_registered_model_alias("main.ml.churn", "champion", latest)\nprint(c.get_model_version_by_alias("main.ml.churn", "champion").version)` },
    { title: 'Batch scoring job by alias', lang: 'python', code: `import mlflow\nmlflow.set_registry_uri("databricks-uc")\n\npredict = mlflow.pyfunc.spark_udf(spark, "models:/main.ml.churn@champion", result_type="double")\nfeatures = spark.read.table("main.ml.churn_features_today")\n\n(features.withColumn("churn_score", predict(*[c for c in features.columns if c != "customer_id"]))\n   .select("customer_id", "churn_score")\n   .write.mode("overwrite").saveAsTable("main.gold.churn_scores"))` },
    { title: 'Call a serving endpoint', lang: 'bash', code: `curl -s -X POST "$DATABRICKS_HOST/serving-endpoints/churn-api/invocations" \\\n  -H "Authorization: Bearer $DATABRICKS_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{"dataframe_records": [{"tenure_months": 14, "plan": "pro", "tickets_90d": 3}]}'` }
  ]
});

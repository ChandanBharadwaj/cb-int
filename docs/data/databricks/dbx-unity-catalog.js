IA.register({
  track: 'databricks',
  slug: 'dbx-unity-catalog',
  title: 'Unity Catalog',
  tagline: 'Unity Catalog is Databricks’ <b>one catalog and one permission system</b> for tables, views, volumes, functions and models across every workspace in a region. If Postgres has <code>GRANT</code> per database, UC has <code>GRANT</code> per <code>catalog.schema.object</code>, plus lineage and audit for free.',
  tldr: {
    problem: 'Per-workspace Hive metastores: the same table defined three times, permissions copied by hand, mount points that bypass all security, and no idea who reads what.',
    model: '<b>Metastore → catalog → schema → object.</b> Privileges inherit downward. To read a table you need <code>USE CATALOG</code> + <code>USE SCHEMA</code> + <code>SELECT</code>. Files are governed through <b>volumes</b> and <b>external locations</b>.',
    hook: '“I granted SELECT on the table, why is the user still denied?” Missing <code>USE CATALOG</code> or <code>USE SCHEMA</code> on the parents.',
    facts: [
      { v: '1 per region', l: 'metastore per cloud region per account; attach many workspaces to it' },
      { v: 'catalog.schema.table', l: 'the three-level name; the legacy metastore appears as the <code>hive_metastore</code> catalog' },
      { v: '/Volumes/c/s/v/', l: 'path format for files in a volume, usable from Spark, Python and the shell' }
    ]
  },
  intro: {
    what: 'A <b>catalog</b> service answers “what tables exist, where are their files, and who may touch them?”. Unity Catalog does that for all of Databricks. Its top container is the <b>metastore</b> (one per region). Inside it are <b>catalogs</b> (often one per environment or domain: <code>dev</code>, <code>prod</code>, <code>finance</code>), then <b>schemas</b> (like Postgres schemas), then tables, views, volumes, functions and ML models.',
    analogy: { icon: '🏢', title: 'Office building badges', text: 'To reach a desk (table), your badge must open the building (metastore attached to your workspace), the floor (USE CATALOG), and the room (USE SCHEMA). Then you need permission for that desk (SELECT). A key to the desk alone does not get you through the doors.' },
    steps: [
      { t: 'Name everything with three parts', d: '<code>main.sales.orders</code>. Set defaults with <code>USE CATALOG main; USE SCHEMA sales;</code>.', code: 'SELECT * FROM main.sales.orders LIMIT 10;', lang: 'sql' },
      { t: 'Grant to groups, not users', d: 'Groups come from your identity provider (SCIM).', code: 'GRANT USE CATALOG ON CATALOG main TO `analysts`;\nGRANT USE SCHEMA, SELECT ON SCHEMA main.sales TO `analysts`;', lang: 'sql' },
      { t: 'Govern files with volumes', d: 'CSV, images, PDFs and other files live in volumes, with the same grants.', code: 'CREATE VOLUME main.sales.raw;\n-- path: /Volumes/main/sales/raw/', lang: 'sql' },
      { t: 'Look at lineage', d: 'Catalog Explorer shows which jobs and notebooks read and wrote each table, down to columns.' }
    ],
    terms: [
      ['metastore', 'Top-level UC container for one region; workspaces are attached to it.'],
      ['securable', 'Anything you can grant on: catalog, schema, table, view, volume, function, model, external location, storage credential, connection.'],
      ['managed table', 'UC manages the files’ location and lifecycle; <code>DROP</code> deletes the data.'],
      ['external table', 'Data at a path you specify under an external location; <code>DROP</code> removes metadata only.'],
      ['storage credential', 'A cloud identity (IAM role, managed identity) UC uses to reach storage.'],
      ['owner', 'The principal that owns a securable; owners can grant on it.']
    ]
  },
  visual: {
    title: 'Walk the privilege check',
    caption: 'Ana runs <code>SELECT * FROM main.sales.orders</code>. Step to see each check in the hierarchy, a failure, the fix, and where volumes fit.'
  },
  gotchas: [
    { trap: 'SELECT granted, still “permission denied”', code: 'GRANT SELECT ON TABLE main.sales.orders TO `ana@corp.com`;\n-- ana: PERMISSION_DENIED: User does not have USE SCHEMA on Schema main.sales', lang: 'sql', why: 'Access needs <code>USE CATALOG</code> on the catalog and <code>USE SCHEMA</code> on the schema in addition to <code>SELECT</code>.', fix: 'Grant the parent “usage” privileges to the group once. Grant to groups, not individuals.' },
    { trap: 'DROP TABLE on a managed table deletes the data', why: 'For managed tables UC owns the files. Dropping removes them (after a short recovery window during which <code>UNDROP TABLE</code> can restore it; check the current window in docs).', fix: 'Use external tables when another system owns the data lifecycle, restrict <code>MANAGE</code>/ownership, and keep prod schemas owned by a service principal.' },
    { trap: 'Still using DBFS mounts', why: 'Mounts give every user of the workspace the mount’s credentials and bypass UC grants and audit.', fix: 'Replace mounts with external locations + volumes or external tables. Path access then requires <code>READ FILES</code>/<code>READ VOLUME</code>.' },
    { trap: 'Old clusters can’t see UC tables', why: 'UC needs a supported access mode (Standard or Dedicated) and a recent runtime. “No isolation shared” clusters and old runtimes see only <code>hive_metastore</code>.', fix: 'Use DBR 13.3 LTS or newer with Standard/Dedicated access mode, or serverless.' },
    { trap: 'Owner is a person who just left', why: 'Objects owned by a user become hard to manage when that user is removed; pipelines may lose rights.', fix: 'Transfer ownership to a group or service principal: <code>ALTER SCHEMA main.sales OWNER TO `data-platform`</code>.' },
    { trap: 'Fine-grained security with views only', why: 'Dynamic views work, but people can bypass them if they also have SELECT on the base table.', fix: 'Use row filters and column masks on the table itself (UC feature), or grant only the view.', code: `CREATE FUNCTION main.sec.only_my_region(region STRING)
RETURN is_account_group_member('admins')
    OR (is_account_group_member('eu-sales') AND region = 'EU');
ALTER TABLE main.sales.orders SET ROW FILTER main.sec.only_my_region ON (region);`, lang: 'sql' }
  ],
  scenarios: [
    { title: 'New analyst team sees no tables at all',
      symptom: 'Catalog Explorer shows the <code>main</code> catalog empty for the new team; queries fail with PERMISSION_DENIED.',
      diagnose: `SHOW GRANTS ON CATALOG main;
SHOW GRANTS ON SCHEMA main.sales;
SHOW GRANTS \`new-analysts\` ON TABLE main.sales.orders;`,
      cause: 'SELECT was granted on individual tables, but the group lacked USE CATALOG and USE SCHEMA. Objects without any usable privilege are hidden from browsing.',
      fix: 'Grant usage on parents and SELECT at schema level so new tables inherit it.',
      fixCode: `GRANT USE CATALOG ON CATALOG main TO \`new-analysts\`;
GRANT USE SCHEMA, SELECT ON SCHEMA main.sales TO \`new-analysts\`;`, lang: 'sql' },
    { title: 'Someone dropped prod.sales.orders',
      symptom: 'Dashboards fail: TABLE_OR_VIEW_NOT_FOUND. Audit shows a <code>deleteTable</code> by an engineer running a “cleanup” script against the wrong catalog.',
      diagnose: `SELECT event_time, user_identity.email, action_name, request_params
FROM system.access.audit
WHERE action_name = 'deleteTable' AND event_date = current_date();`,
      cause: 'The engineer had MANAGE/ownership on prod and the script used a variable catalog name defaulting to <code>prod</code>.',
      fix: 'Restore with UNDROP inside the retention window, then remove human write/ownership rights in prod and run changes through a service principal in CI.',
      fixCode: `SHOW TABLES DROPPED IN prod.sales;
UNDROP TABLE prod.sales.orders;`, lang: 'sql' }
  ],
  puzzles: [
    { kind: 'concept', q: 'Minimum privileges for a group to query <code>main.sales.orders</code>?', options: ['SELECT on the table', 'USE CATALOG main + USE SCHEMA main.sales + SELECT', 'ALL PRIVILEGES on main', 'READ FILES on the external location'], answer: 1, explain: 'Usage on both parents plus SELECT. SELECT can be granted on the table, schema or catalog and inherits downward.' },
    { kind: 'concept', q: 'SELECT is granted on <b>schema</b> <code>main.sales</code>. A new table is created there tomorrow. Can the group read it?', options: ['No, grants are snapshotted', 'Yes, privileges inherit to current and future children', 'Only after REFRESH', 'Only if the owner re-grants'], answer: 1, explain: 'UC privileges are inherited: a grant on a schema applies to all objects in it, including future ones (they still need USE CATALOG and USE SCHEMA).' },
    { kind: 'concept', q: '<code>DROP TABLE main.raw.events</code>, an <b>external</b> table at <code>s3://lake/events/</code>. What happens to the files?', options: ['Deleted', 'Moved to trash', 'Unchanged; only metadata is removed', 'Converted to managed'], answer: 2, explain: 'External tables do not own their data. Dropping removes the UC entry only. For managed tables the data is deleted.' },
    { kind: 'concept', q: 'Where should a 2 GB folder of PDFs used by a RAG pipeline live under UC governance?', options: ['A DBFS mount', 'A Delta table column', 'A volume', 'The driver’s /tmp'], answer: 2, explain: 'Volumes are for non-tabular files and use the same grants and audit. Mounts bypass UC; /tmp is ephemeral and driver-only.' },
    { kind: 'concept', q: 'How many Unity Catalog metastores should an account normally have per region?', options: ['One per workspace', 'One per region', 'One per catalog', 'Exactly one globally'], answer: 1, explain: 'One per region; all workspaces in that region attach to it. Isolation between teams/environments uses catalogs (and workspace-catalog binding).' },
    { kind: 'concept', q: 'Where do you query table-level lineage programmatically?', options: ['information_schema.lineage', 'system.access.table_lineage', 'DESCRIBE HISTORY', '_delta_log'], answer: 1, explain: 'Lineage is exposed as system tables (<code>system.access.table_lineage</code>, <code>column_lineage</code>). <code>DESCRIBE HISTORY</code> shows a table’s own commits, not cross-table lineage.' }
  ],
  interview: [
    { q: 'Explain the Unity Catalog object model.', a: '<p>Account → metastore (per region) → catalog → schema → tables, views, materialized views, volumes, functions, models. Alongside: storage credentials and external locations for cloud paths, connections for federation. Names are <code>catalog.schema.object</code>.</p>', lvl: 'core' },
    { q: 'How do privileges inherit?', a: '<p>Downward. A grant on a catalog applies to all schemas and objects inside, current and future. Access to an object also requires <code>USE CATALOG</code> and <code>USE SCHEMA</code> on its parents. Owners and <code>MANAGE</code> holders can grant.</p>', lvl: 'core' },
    { q: 'Managed vs external tables in UC?', a: '<p><b>Managed:</b> UC chooses the location (metastore, catalog or schema managed storage), handles lifecycle, deletes data on DROP, and enables features like predictive optimization. <b>External:</b> you give a path under an external location; DROP leaves data. Databricks recommends managed tables by default.</p>', lvl: 'core' },
    { q: 'What are external locations and storage credentials?', a: '<p>A storage credential wraps a cloud identity (AWS IAM role, Azure managed identity, GCP service account). An external location pairs a credential with a path prefix. Grants on the location (<code>READ FILES</code>, <code>CREATE EXTERNAL TABLE</code>) control who can use it.</p>', lvl: 'deep' },
    { q: 'How do you do row- and column-level security?', a: '<p>Row filters and column masks: SQL UDFs attached to a table (<code>ALTER TABLE … SET ROW FILTER</code>, <code>ALTER COLUMN … SET MASK</code>), using functions like <code>is_account_group_member()</code>. Or dynamic views. ABAC policies with tags are newer (check your workspace).</p>', lvl: 'deep' },
    { q: 'What do you get for lineage and audit?', a: '<p>Automatic table and column lineage for queries run on UC-enabled compute, visible in Catalog Explorer and in system tables. Audit logs in <code>system.access.audit</code>. No instrumentation code needed.</p>', lvl: 'core' },
    { q: 'How would you migrate from Hive metastore to UC?', a: '<p>Inventory tables (UCX tool helps), create catalogs/schemas, set up external locations, then <code>SYNC</code> or upgrade external tables in place and deep-clone/CTAS managed ones, replace mounts with volumes, update code to three-level names, and move jobs to UC-capable compute.</p>', lvl: 'deep' },
    { q: 'How do you isolate dev and prod?', a: '<p>Separate catalogs (<code>dev</code>, <code>prod</code>), often with separate managed storage; bind the prod catalog only to the prod workspace (workspace-catalog binding); prod objects owned by a service principal; humans read-only in prod.</p>', lvl: 'deep' },
    { q: 'What is Delta Sharing’s relation to UC?', a: '<p>Delta Sharing is an open protocol for sharing tables with other organisations or platforms without copying. In Databricks, shares, recipients and providers are UC securables.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Environment setup', lang: 'sql', code: `CREATE CATALOG IF NOT EXISTS prod MANAGED LOCATION 's3://acme-prod-uc/';
CREATE SCHEMA IF NOT EXISTS prod.sales COMMENT 'Sales domain, owned by data-platform';
ALTER SCHEMA prod.sales OWNER TO \`data-platform\`;

GRANT USE CATALOG ON CATALOG prod TO \`analysts\`;
GRANT USE SCHEMA, SELECT ON SCHEMA prod.sales TO \`analysts\`;
GRANT MODIFY ON SCHEMA prod.sales TO \`etl-sp\`;   -- service principal for jobs` },
    { title: 'Volumes from Python', lang: 'python', code: `base = "/Volumes/prod/sales/raw"
dbutils.fs.ls(base)
df = spark.read.format("json").load(f"{base}/orders/2025-06-01/")
with open(f"{base}/notes/readme.txt") as fh:      # plain Python file I/O works on volumes
    print(fh.read()[:200])` },
    { title: 'Who touched this table?', lang: 'sql', code: `SELECT source_table_full_name, entity_type, created_by, event_time
FROM system.access.table_lineage
WHERE target_table_full_name = 'prod.sales.orders'
ORDER BY event_time DESC LIMIT 20;` }
  ]
});

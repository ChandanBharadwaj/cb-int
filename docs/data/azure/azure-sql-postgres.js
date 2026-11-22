IA.register({
  track: 'azure',
  slug: 'azure-sql-postgres',
  title: 'Azure SQL & Postgres Flexible Server',
  tagline: 'Managed relational databases are still Postgres and SQL Server underneath: you choose a <b>compute tier</b>, an <b>HA mode</b> (a synchronous standby in another zone), <b>read replicas</b> (asynchronous) and a <b>backup retention</b> window. The platform runs failover and backups. Your app still has to survive a reconnect, and your connection count still has to fit.',
  lang: 'bash',
  tldr: {
    problem: 'Teams assume “managed” means “never drops a connection”, put read replicas behind code that needs read-your-writes, scale out pods until Postgres runs out of connections, and only discover during an incident that a point-in-time restore creates a <i>new</i> server.',
    model: '<b>HA standby</b> = synchronous WAL replication to a hidden copy in another zone, promoted automatically, same hostname, RPO 0. <b>Read replica</b> = asynchronous copy you can query, possibly behind. <b>Backups</b> = snapshots + WAL in backup storage, so you can restore to any second in the retention window, as a new server. <b>PgBouncer</b> = many client connections multiplexed onto few server connections.',
    hook: '“HA is on, so why did we get errors during failover?” Because the old primary’s TCP connections die. Failover takes on the order of a minute or two, and the pool must evict dead connections and retry. HA protects data, not open sessions.',
    facts: [
      { v: '60–120 s', l: 'typical Postgres Flexible Server HA failover time per Microsoft Learn at the time of writing; the hostname doesn’t change' },
      { v: '7 → 35 days', l: 'default and maximum automated backup retention for Postgres Flexible Server; restores always create a new server' },
      { v: ':6432', l: 'the port of the built-in PgBouncer on Postgres Flexible Server (not available on the Burstable tier)' }
    ]
  },
  intro: {
    what: 'Azure runs Postgres and SQL Server for you. <b>Azure Database for PostgreSQL flexible server</b> is real community Postgres (you pick the major version) on a VM Azure manages. <b>Azure SQL Database</b> is SQL Server’s engine as a service, with its own tiers. In both, Azure handles patching, backups and failover. You still own the schema, the queries, the connection pool and how your app behaves when the database moves.',
    analogy: { icon: '🎭', title: 'An actor with an understudy and a stand-in', text: 'The <b>understudy</b> (HA standby) learns every line as it is spoken and steps on stage if the lead collapses. The show pauses briefly, but no lines are lost. The <b>stand-ins</b> (read replicas) rehearse from a recording a few seconds behind, so they can answer fans’ questions but might not know the last line. The <b>recording</b> (backups and WAL) lets you replay the show up to any second, on a new stage.' },
    steps: [
      { t: 'Pick a tier and size', d: 'Burstable for dev, General Purpose or Memory Optimized for production. HA and built-in PgBouncer aren’t available on Burstable.', code: 'az postgres flexible-server create -g rg-orders-prod -n pg-orders-prod \\\n  --version 16 --tier GeneralPurpose --sku-name Standard_D4ds_v5 \\\n  --high-availability ZoneRedundant --zone 1 --standby-zone 2 \\\n  --backup-retention 14 --geo-redundant-backup Enabled' },
      { t: 'Turn on Entra auth and connect without a password', d: 'The app’s managed identity becomes a Postgres role. See <a href="entra-managed-identity.html">Entra ID &amp; managed identities</a>.', lang: 'sql', code: "-- as the Entra admin, in the postgres database\nSELECT * FROM pgaadauth_create_principal('id-orders', false, false);" },
      { t: 'Put a pool in front of the connections', d: 'Hikari in the app, plus PgBouncer on the server when many instances connect.' },
      { t: 'Know your recovery buttons', d: 'Failover is automatic. Read replicas are promoted by you. A point-in-time restore builds a new server that you then point the app at.' }
    ],
    terms: [
      ['compute tier', 'Burstable (B-series), General Purpose (D-series) or Memory Optimized (E-series) for Postgres Flexible Server.'],
      ['HA standby', 'A hidden, synchronously replicated copy in another zone (or the same zone). It is promoted automatically and isn’t readable.'],
      ['read replica', 'An asynchronously replicated, read-only server you can query. You promote it manually; it can be in another region.'],
      ['PITR', 'Point-in-time restore: rebuild the database at any moment inside the backup retention window, as a new server.'],
      ['PgBouncer', 'A lightweight connection pooler. In transaction mode a server connection is lent to a client only for one transaction.'],
      ['RPO / RTO', 'Recovery point objective (how much data you can lose) and recovery time objective (how long you can be down).']
    ]
  },
  visual: {
    title: 'Failover, replicas, pooling and restore',
    caption: 'Pick a mechanism and press Play. <b>HA failover</b>: a commit is replicated synchronously, then zone 1 fails. <b>Read replica</b>: asynchronous lag and the read-your-writes trap. <b>PgBouncer</b>: 80 client connections squeezed onto a few server connections. <b>PITR</b>: undo a bad DELETE by restoring to a new server.'
  },
  gotchas: [
    { trap: 'Treating HA as “no errors during failover”', why: 'Failover promotes the standby and updates DNS. Every existing TCP connection to the old primary breaks, and new connections fail until the standby is up. Hikari hands out dead connections unless it validates them, and in-flight transactions roll back.', fix: 'Keep Hikari’s defaults for validation, set a <code>maxLifetime</code> well below any idle timeout, cache DNS briefly (the JVM’s default TTL can be long when a security manager is installed), and retry idempotent operations with backoff. Test it with a forced failover.', code: `az postgres flexible-server restart -g rg-orders-prod -n pg-orders-prod --failover Forced` },
    { trap: 'Reading your own write from a replica', why: 'Read replicas replicate <b>asynchronously</b>. After a user saves a form, a read on the replica can return the old row for as long as the lag lasts, which under heavy write load or a long-running query on the replica can be seconds or more.', fix: 'Route reads that must see the latest data (post-write redirects, checkout) to the primary. Use replicas for reports, search pages and analytics. Monitor <code>now() - pg_last_xact_replay_timestamp()</code> on the replica.' },
    { trap: 'Scaling out pods until Postgres refuses connections', code: `FATAL: remaining connection slots are reserved for roles with the SUPERUSER attribute
-- 30 pods × Hikari maximumPoolSize 20 = 600 connections > max_connections`, why: '<code>max_connections</code> is tied to the SKU’s memory, and each Postgres connection is a process. Autoscaling multiplies every pod’s pool.', fix: 'Size pools small (often 5–10 per pod is plenty), enable the <b>built-in PgBouncer</b> (port 6432, transaction mode), and budget connections: pods × pool ≤ what PgBouncer or the server can take.' },
    { trap: 'Server-side prepared statements through transaction pooling', why: 'PgJDBC switches to named server-side prepared statements after <code>prepareThreshold</code> (5) executions. In transaction mode the next transaction may run on a different server connection, which doesn’t have that statement, so you get errors such as <code>prepared statement "S_1" does not exist</code>. PgBouncer 1.21+ can track protocol-level prepared statements when <code>max_prepared_statements</code> is set.', fix: 'Check your PgBouncer version and settings. If prepared-statement support isn’t on, add <code>prepareThreshold=0</code> to the JDBC URL. Also avoid session state through PgBouncer: <code>SET</code>, advisory locks, <code>LISTEN</code>, temp tables.', code: `jdbc:postgresql://pg-orders-prod.postgres.database.azure.com:6432/orders?sslmode=require&prepareThreshold=0` },
    { trap: 'Expecting PITR to rewind the existing server', why: 'A point-in-time restore always creates a <b>new server</b> from backups and WAL. Your app, firewall rules, private endpoints, Entra admins and parameter settings don’t move with it automatically.', fix: 'Practise the runbook: restore to a new server, then either copy the lost rows back or switch the app’s connection string. Keep the network and identity setup in IaC so the new server can be wired quickly.' },
    { trap: 'Geo-redundant backup can’t be added later', why: 'On Postgres Flexible Server the geo-redundant backup option is chosen when the server is created. Without it, a regional disaster leaves you with nothing to geo-restore from.', fix: 'Decide at creation for production. If you missed it, migrate to a new server created with it, or add a cross-region read replica as your DR path.' },
    { trap: 'Burstable in production', why: 'B-series VMs run on CPU credits. When the credits run out, CPU is throttled to a baseline and latency jumps. Burstable also excludes HA and the built-in PgBouncer.', fix: 'Use General Purpose or Memory Optimized for production, and watch the CPU credits metric on any Burstable server you keep.' }
  ],
  scenarios: [
    { title: 'Two minutes of 500s during “zero-downtime” maintenance',
      symptom: 'During a planned maintenance window the orders API returns <code>SQLTransientConnectionException</code> and <code>PSQLException: An I/O error occurred</code> for about 90 seconds, then recovers.',
      diagnose: `# Activity log / server logs show an HA failover at the same minute
az monitor activity-log list --resource-id $PG_ID --offset 1h \\
  --query "[].{op:operationName.localizedValue, time:eventTimestamp}" -o table`,
      cause: 'Maintenance triggered a planned failover. Existing connections broke and requests failed instead of retrying. HA worked as designed; the app wasn’t built to reconnect.',
      fix: 'Add retry with backoff for idempotent operations (Spring Retry or Resilience4j), keep Hikari validating connections, schedule a <b>custom maintenance window</b> off-peak, and rehearse with a forced failover in staging.',
      fixCode: `az postgres flexible-server update -g rg-orders-prod -n pg-orders-prod \\
  --maintenance-window "Sun:2:0"` },
    { title: 'Users “lose” their edits for a few seconds',
      symptom: 'After saving a profile, the redirect page sometimes shows the old values. A refresh a few seconds later shows the new ones.',
      diagnose: `-- on the replica
SELECT now() - pg_last_xact_replay_timestamp() AS replay_lag;   -- 00:00:04.2 under load`,
      cause: 'A routing data source sent every <code>@Transactional(readOnly = true)</code> method to the read replica, including the page right after the write.',
      fix: 'Send read-after-write paths to the primary (make them read-write transactions, or route by a “recently wrote” flag in the session). Keep replicas for list, search and reporting endpoints.' },
    { title: 'A migration ran DELETE without WHERE at 09:15',
      symptom: 'The <code>order_items</code> table is empty in production. The deploy was 20 minutes ago.',
      diagnose: `az postgres flexible-server show -g rg-orders-prod -n pg-orders-prod \\
  --query "{retention:backup.backupRetentionDays, earliest:backup.earliestRestoreDate}"`,
      cause: 'A Flyway script had a broken WHERE clause. Replicas and the HA standby replicated the delete faithfully, so they can’t help.',
      fix: 'Restore to a new server at 09:14, then copy the missing rows back over a <code>postgres_fdw</code> link or a dump of the one table. Add a review rule for destructive migrations.',
      fixCode: `az postgres flexible-server restore -g rg-orders-prod --name pg-orders-restore-0914 \\
  --source-server pg-orders-prod --restore-time "2026-11-20T09:14:00Z"
pg_dump -h pg-orders-restore-0914.postgres.database.azure.com -U ops -d orders -t order_items --data-only \\
  | psql -h pg-orders-prod.postgres.database.azure.com -U ops -d orders` }
  ],
  puzzles: [
    { kind: 'scenario', q: 'Postgres Flexible Server with zone-redundant HA. Zone 1 (the primary’s zone) fails. What does the application see?', options: ['Nothing: connections move transparently', 'Errors for roughly a minute or two, then new connections work against the same hostname', 'It must switch to the standby’s hostname', 'Data loss of the last few seconds'], answer: 1, explain: 'The standby is promoted and DNS behind the same hostname is updated. Existing connections break. Replication was synchronous, so committed data is safe (RPO 0), but the app must reconnect and retry.' },
    { kind: 'scenario', q: 'You want to offload reporting queries from the primary. What do you use?', options: ['The HA standby', 'A read replica', 'A point-in-time restore every night', 'PgBouncer in session mode'], answer: 1, explain: 'The HA standby isn’t readable on Postgres Flexible Server. A <b>read replica</b> is a separate, queryable server, at the cost of asynchronous lag.' },
    { kind: 'predict', q: '25 pods, Hikari <code>maximumPoolSize=20</code>, connecting directly on port 5432. How many server connections could the app open at peak?', options: ['20', '25', '500', 'Limited to 100 by Hikari'], answer: 2, explain: '25 × 20 = <b>500</b>. Each pool is independent. Compare that with the server’s <code>max_connections</code>; this is why you add PgBouncer or shrink pools.' },
    { kind: 'scenario', q: 'Through the built-in PgBouncer in transaction mode, a service starts failing with <code>prepared statement "S_3" does not exist</code> after the fifth call of a query. The likeliest fix?', options: ['Increase max_connections', 'Set prepareThreshold=0 in the JDBC URL (or enable prepared-statement support in PgBouncer if your version has it)', 'Switch to port 5432 and keep the pool size', 'Disable SSL'], answer: 1, explain: 'PgJDBC moves to named server-side statements after 5 executions. In transaction pooling those statements don’t follow you to the next server connection. <code>prepareThreshold=0</code> keeps statements unnamed.' },
    { kind: 'scenario', q: 'A bad deploy corrupted data 30 minutes ago. Which recovery fits Flexible Server?', options: ['Fail over to the HA standby', 'Promote a read replica', 'Point-in-time restore to just before the deploy, onto a new server, then copy data back or switch over', 'Restart the server'], answer: 2, explain: 'The standby and the replicas received the same bad writes. Only backups plus WAL let you go back in time, and PITR always creates a new server.' },
    { kind: 'scenario', q: 'In Azure SQL Database, which tier gives you a built-in readable secondary for read scale-out at no extra replica cost?', options: ['General Purpose', 'Business Critical', 'Basic (DTU)', 'Serverless General Purpose'], answer: 1, explain: 'Business Critical runs an Always On availability group with several local replicas, one of which serves read-only connections (<code>ApplicationIntent=ReadOnly</code>). Hyperscale also offers replicas, as separate configuration.' },
    { kind: 'scenario', q: 'A Spring app uses <code>AbstractRoutingDataSource</code> keyed on <code>TransactionSynchronizationManager.isCurrentTransactionReadOnly()</code>, but every query still goes to the primary. Why?', options: ['Replicas reject JDBC', 'The connection is fetched when the transaction begins, before the read-only flag is set; wrap the router in LazyConnectionDataSourceProxy', 'readOnly is ignored by JPA', 'Hikari doesn’t support routing'], answer: 1, explain: 'The transaction manager grabs a connection at <code>begin</code>. <code>LazyConnectionDataSourceProxy</code> delays getting the real connection until the first statement, when the read-only flag is known.' }
  ],
  interview: [
    { q: 'Compare HA standby and read replicas on Postgres Flexible Server.', a: '<p><b>HA standby</b>: synchronous, not readable, same or another zone, promoted automatically with the same hostname; RPO 0 for zone failures. <b>Read replica</b>: asynchronous, readable, same or another region, promoted manually; it has lag, so RPO &gt; 0. HA is for availability, replicas are for read scale and cross-region DR. Neither protects you from a bad DELETE.</p>', lvl: 'core' },
    { q: 'How do you choose between Azure SQL Database and Postgres Flexible Server for a new Spring service?', a: '<p>Mostly by engine. If the team and its tooling are Postgres (extensions such as <code>pgvector</code> or PostGIS, Flyway scripts, local Testcontainers), use Flexible Server. If the estate is SQL Server, or you need Hyperscale’s storage growth or Business Critical’s readable secondary, use Azure SQL. Both support Entra auth and private endpoints. Avoid choosing on price alone, because migrations between engines are expensive.</p>', lvl: 'core' },
    { q: 'Explain Azure SQL Database’s purchasing models and tiers.', a: '<p>Two purchasing models: <b>DTU</b> (bundled compute, storage and IO in fixed sizes) and <b>vCore</b> (choose compute and storage separately; required for Hyperscale and serverless). vCore tiers: <b>General Purpose</b> (remote storage), <b>Business Critical</b> (local SSD, an Always On group with readable replicas) and <b>Hyperscale</b> (distributed page servers, fast scale-out and large databases). <b>Serverless</b> compute auto-scales and can auto-pause in General Purpose.</p>', lvl: 'deep' },
    { q: 'What happens to a Spring Boot app during an HA failover, and how do you make it resilient?', a: '<ul><li>Open connections break and in-flight transactions roll back.</li><li>New connections fail until the standby is promoted and DNS points to it.</li><li>Hikari validates connections on checkout and evicts broken ones.</li><li>Add bounded retry with backoff for idempotent operations, and keep the HTTP timeout above the expected failover time or fail fast with a clear 503.</li><li>Rehearse with <code>--failover Forced</code>.</li></ul>', lvl: 'core' },
    { q: 'When do you need PgBouncer, and what breaks in transaction mode?', a: '<p>When the number of client connections (pods × pool size, plus jobs and functions) gets near <code>max_connections</code>, or when many short-lived clients connect. In transaction mode a server connection is yours only for one transaction, so session state breaks: <code>SET</code> without <code>LOCAL</code>, session advisory locks, <code>LISTEN/NOTIFY</code>, temp tables, and older-style server-side prepared statements.</p>', fu: 'Why keep Hikari if you have PgBouncer? (Hikari avoids TCP/TLS setup per request and bounds concurrency per pod; PgBouncer bounds the total on the server.)', lvl: 'deep' },
    { q: 'How do backups and PITR work on Flexible Server?', a: '<p>Automatic snapshots of the data files plus continuous WAL archiving to backup storage. Retention is 7 days by default, configurable up to 35. Backup storage is zone-redundant where the region supports it, or geo-redundant if you chose that at creation. A restore creates a <b>new</b> server at the requested time by restoring the nearest snapshot and replaying WAL. A geo-restore restores in the paired region from geo backups.</p>', lvl: 'core' },
    { q: 'How would you design DR for an orders database with RPO of minutes and RTO under an hour?', a: '<p>Zone-redundant HA in the primary region for zone failures. A <b>cross-region read replica</b> for region failures: the RPO is the replication lag, and the RTO is the time to promote plus re-pointing the app (virtual endpoints or a DNS/Front Door switch). Geo-redundant backups as a last resort with a larger RPO. Keep the replica’s network, Entra admin and firewall setup in IaC, and run a DR drill each quarter.</p>', lvl: 'deep' },
    { q: 'How do you route read-only traffic to a replica in Spring?', a: '<p>Create two DataSources and an <code>AbstractRoutingDataSource</code> that chooses on <code>TransactionSynchronizationManager.isCurrentTransactionReadOnly()</code>. Wrap it in a <code>LazyConnectionDataSourceProxy</code> so the decision happens at the first statement. Annotate reporting services with <code>@Transactional(readOnly = true)</code>. Keep read-after-write paths on the primary.</p>', lvl: 'deep' },
    { q: 'What changes when Postgres uses Entra authentication instead of passwords?', a: '<p>The “password” is an Entra access token for the <code>https://ossrdbms-aad.database.windows.net</code> audience, so there is nothing to rotate. The token is checked only when a connection opens, so pooled connections outlive it. Set Hikari’s <code>maxLifetime</code> so new connections pick up fresh tokens, and use the Spring Cloud Azure JDBC plugin to fetch them. Postgres roles for identities are created with <code>pgaadauth_create_principal</code>.</p>', lvl: 'core' },
    { q: 'Which server parameters do you look at first on a struggling Flexible Server?', a: '<p><code>max_connections</code> and actual connection counts, <code>shared_buffers</code> and <code>work_mem</code> against the SKU’s memory, autovacuum settings for hot tables, and <code>pg_stat_statements</code> (enable it through <code>azure.extensions</code> and <code>shared_preload_libraries</code>) for the top queries. Query Store and the Intelligent Performance views help too. Most fixes are still indexes and queries, not SKU changes.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Spring Boot: passwordless Postgres + Hikari for failover', lang: 'yaml', code: `# deps: spring-cloud-azure-starter-jdbc-postgresql, org.postgresql:postgresql
spring:
  datasource:
    # 6432 = built-in PgBouncer (transaction mode); 5432 = direct
    url: jdbc:postgresql://pg-orders-prod.postgres.database.azure.com:6432/orders?sslmode=require&prepareThreshold=0
    username: id-orders
    azure:
      passwordless-enabled: true      # token for ossrdbms-aad as the password
    hikari:
      maximum-pool-size: 8            # per pod; pods × 8 must fit the budget
      max-lifetime: 1800000           # 30 min: recycle so new tokens are used
      connection-timeout: 5000        # fail fast during failover, then retry
  cloud:
    azure:
      credential:
        managed-identity-enabled: true
        client-id: \${AZURE_CLIENT_ID}`, note: '<code>prepareThreshold=0</code> is the safe default through transaction pooling unless you have confirmed prepared-statement support in your PgBouncer.' },
    { title: 'Java: read-replica routing', lang: 'java', code: `public class ReadWriteRouter extends AbstractRoutingDataSource {
  @Override protected Object determineCurrentLookupKey() {
    return TransactionSynchronizationManager.isCurrentTransactionReadOnly() ? "replica" : "primary";
  }
}

@Bean @Primary
DataSource dataSource(DataSource primaryDs, DataSource replicaDs) {
  var router = new ReadWriteRouter();
  router.setTargetDataSources(Map.of("primary", primaryDs, "replica", replicaDs));
  router.setDefaultTargetDataSource(primaryDs);
  router.afterPropertiesSet();
  return new LazyConnectionDataSourceProxy(router);   // decide at first statement, not at begin
}

@Transactional(readOnly = true)      // → replica: OK for reports
public List<OrderSummary> monthlyReport(YearMonth m) { ... }` },
    { title: 'CLI: replicas, PgBouncer, failover and restore', lang: 'bash', code: `# built-in PgBouncer (General Purpose / Memory Optimized only)
az postgres flexible-server parameter set -g rg-orders-prod -s pg-orders-prod \\
  --name pgbouncer.enabled --value true

# read replica in another region for DR / reporting
az postgres flexible-server replica create -g rg-orders-prod \\
  --replica-name pg-orders-ro-ne --source-server pg-orders-prod --location northeurope

# rehearse HA
az postgres flexible-server restart -g rg-orders-prod -n pg-orders-prod --failover Planned

# point-in-time restore → NEW server
az postgres flexible-server restore -g rg-orders-prod --name pg-orders-pitr \\
  --source-server pg-orders-prod --restore-time "2026-11-20T09:14:00Z"` },
    { title: 'SQL: watch replication and connections', lang: 'sql', code: `-- on the primary
SELECT application_name, state, sync_state,
       pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS bytes_behind
FROM pg_stat_replication;

-- on a read replica
SELECT now() - pg_last_xact_replay_timestamp() AS replay_lag;

-- who is using the connection slots?
SELECT usename, application_name, state, count(*)
FROM pg_stat_activity GROUP BY 1,2,3 ORDER BY 4 DESC;` }
  ]
});

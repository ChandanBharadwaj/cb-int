IA.register({
  track: 'spring',
  slug: 'hikari-pooling',
  title: 'HikariCP & connection pools',
  tagline: 'Every Postgres connection is a <b>backend process</b>, so the app keeps a small, fixed pool and lends connections out. Throughput is <b>pool size ÷ hold time</b>. When hold times grow (slow queries, lock waits, HTTP calls inside transactions, leaks), threads queue in <code>getConnection()</code> and fail after <code>connectionTimeout</code>.',
  tldr: {
    problem: '“Connection is not available, request timed out after 30000ms” while Postgres is nearly idle; pools sized at 100 per pod that overrun <code>max_connections</code>; leaks that slowly starve the pool until a restart “fixes” it.',
    model: 'Borrow → use → return. Concurrent demand = request rate × hold time (Little’s law). If demand exceeds the pool, callers wait in a queue; past <code>connectionTimeout</code> they fail. The pool protects Postgres from too many backends; it can’t make slow work faster.',
    hook: '“Should we raise the pool size?” Usually not. Find out why connections are held so long (<code>hikaricp.connections.usage</code>, <code>pg_stat_activity</code>) before giving Postgres more concurrent work.',
    facts: [
      { v: '10', l: 'Hikari’s default <code>maximumPoolSize</code>; <code>minimumIdle</code> defaults to the same value (a fixed-size pool)' },
      { v: '30 s', l: 'default <code>connectionTimeout</code>: how long <code>getConnection()</code> waits before throwing <code>SQLTransientConnectionException</code>' },
      { v: '100', l: 'Postgres’s default <code>max_connections</code>, shared by every pod, job, migration tool and psql session, minus reserved superuser slots' }
    ]
  },
  intro: {
    what: 'Opening a database connection is slow: a TCP handshake, TLS, authentication, and Postgres starting a new process. So applications open a few connections once and <b>reuse</b> them. HikariCP, Spring Boot’s default pool, keeps these connections, lends one to your code for each transaction or query, and takes it back afterwards. If all are busy, your code waits.',
    analogy: { icon: '🚲', title: 'A bike-share dock', text: 'The dock has 10 bikes. Short rides keep bikes moving and nobody waits. If riders keep bikes for hours (long transactions) or never bring them back (leaks), the dock empties, and people queue until they give up (the timeout). Adding bikes helps only if the roads (Postgres) can take more riders.' },
    steps: [
      { t: 'The pool opens connections at startup', d: 'By default 10, kept open. Each one is a Postgres backend you can see in <code>pg_stat_activity</code>.' },
      { t: 'Code borrows one per unit of work', d: 'A <code>@Transactional</code> method, a repository call or a <code>JdbcTemplate</code> query borrows a connection and returns it when it finishes.' },
      { t: 'When all are busy, callers wait', d: 'The next thread waits up to <code>connectionTimeout</code> (30 s) for a connection to come back, then fails.', code: 'SQLTransientConnectionException: HikariPool-1 -\n  Connection is not available, request timed out after 30000ms' },
      { t: 'Configure it in application.yml', d: 'Pool size, timeouts and leak detection live under <code>spring.datasource.hikari</code>.', code: 'spring:\n  datasource:\n    hikari:\n      maximum-pool-size: 10\n      connection-timeout: 3000', lang: 'yaml' }
    ],
    terms: [
      ['connection pool', 'A set of open database connections shared by the application’s threads.'],
      ['borrow / return', 'Taking a connection for a unit of work and handing it back (closing it returns it).'],
      ['hold time', 'How long a connection stays borrowed. The number that matters most.'],
      ['connectionTimeout', 'Maximum time a thread waits to borrow a connection.'],
      ['leak', 'A borrowed connection that is never returned, usually a missing <code>close()</code>.'],
      ['max_connections', 'The Postgres server limit on concurrent connections (backends).']
    ]
  },
  visual: {
    title: 'Pool checkout and the wait queue',
    caption: 'Ten connections, 30 requests per second, 100 ms per tick. Pick a scenario and press Play. Slots show who holds each connection and for how long; the queue shows threads waiting in <code>getConnection()</code>. For the demo <code>connectionTimeout</code> is 2 s (default 30 s) and <code>leakDetectionThreshold</code> is 2 s.'
  },
  gotchas: [
    { trap: 'Raising maximum-pool-size to fix timeouts',
      why: 'If connections are held long because Postgres is slow or rows are locked, more connections add more concurrent work to the same bottleneck: more lock waiters, more context switching, more memory per backend. Latency often gets worse.',
      fix: 'Measure hold time first (<code>hikaricp.connections.usage</code>) and look at what those backends are doing (<code>pg_stat_activity</code>, <code>wait_event</code>, <code>pg_blocking_pids</code>). Fix the slow statement, the lock, or the transaction scope.' },
    { trap: 'Pool size × replicas > max_connections',
      code: `# 12 pods × maximum-pool-size 20 = 240 connections\n# Postgres max_connections = 100\nFATAL: sorry, too many clients already\nFATAL: remaining connection slots are reserved for … superuser …`,
      why: 'Every replica opens its own pool, and so do batch jobs, Flyway, admin tools and autoscaled pods during a rollout (old and new running together).',
      fix: 'Budget connections: (pods at max surge) × pool + jobs + headroom ≤ <code>max_connections</code> − reserved. Use smaller pools per pod, or PgBouncer in transaction mode in front of Postgres.' },
    { trap: 'Leaking a connection from a raw DataSource',
      code: `Connection c = dataSource.getConnection();      // borrowed
PreparedStatement ps = c.prepareStatement(SQL);
… if (rows.isEmpty()) return List.of();          // early return: never closed → leaked`,
      why: 'Outside Spring’s transaction management, nothing returns the connection for you. Each call path that skips <code>close()</code> permanently removes one connection from the pool.',
      fix: 'Use try-with-resources, or better, <code>JdbcTemplate</code>/<code>JdbcClient</code>. Turn on <code>leak-detection-threshold</code> (for example 2× your slowest legitimate transaction) to get a stack trace of the borrower.' },
    { trap: 'maxLifetime longer than the network allows',
      why: 'Firewalls, NAT gateways and managed proxies drop idle or old TCP connections. If the pool keeps a connection longer, the next borrower gets a dead socket: <code>An I/O error occurred while sending to the backend</code> or <code>Connection reset</code>.',
      fix: 'Set <code>max-lifetime</code> a few seconds to minutes below any infrastructure limit, and <code>keepalive-time</code> below the idle timeout (for example 60 s), so Hikari pings idle connections.' },
    { trap: 'A huge connectionTimeout hides the problem',
      why: 'With 30 s (or more), requests wait silently behind a stuck pool, Tomcat’s threads fill up, and the service looks hung rather than failing. Upstream callers time out first and retry, which adds load.',
      fix: 'Use a connection timeout below your request SLA (often 1–5 s), so exhaustion fails fast and visibly. Alert on <code>hikaricp.connections.pending</code> &gt; 0 and on <code>hikaricp.connections.timeout</code>.' },
    { trap: 'Virtual threads don’t remove the pool limit',
      why: 'With <code>spring.threads.virtual.enabled=true</code>, thousands of requests can run at once, but they still share 10 connections. The pool becomes the throttle, with a long wait queue.',
      fix: 'Size the pool for what Postgres can do, not for the thread count. Keep transactions short, and add a concurrency limit (bulkhead) in front of database-heavy endpoints if needed.' }
  ],
  scenarios: [
    { title: 'Black Friday: 30 s timeouts with Postgres at 15% CPU',
      symptom: 'Checkout requests failed with <code>Connection is not available, request timed out after 30000ms</code>. Database CPU was low; Hikari showed active=10, idle=0, pending=180.',
      diagnose: `SELECT pid, state, wait_event_type, wait_event, now() - xact_start AS xact_age, left(query, 50)
FROM pg_stat_activity WHERE datname = 'shop' AND backend_type = 'client backend'
ORDER BY xact_age DESC;
--  state               | wait_event | xact_age | query
--  idle in transaction | ClientRead | 00:00:04 | SELECT … FROM cart WHERE id = $1
--  (× 10)`,
      diagnoseLang: 'sql',
      cause: 'All 10 connections were <code>idle in transaction</code>: <code>@Transactional checkout()</code> called the payment provider (p99 4 s) between its SELECT and its UPDATE. Hold time went from 20 ms to 4 s, so the pool’s capacity fell from about 500 to 2.5 checkouts per second.',
      fix: 'Move the remote call out of the transaction (reserve → call → confirm in two short transactions), shorten <code>connectionTimeout</code> so the failure is fast, and set <code>idle_in_transaction_session_timeout</code> in Postgres.',
      fixCode: `public Receipt checkout(CartId id) {
  Order o = tx.execute(s -> orders.reserve(id));        // short tx #1
  Payment p = payments.charge(o);                       // no connection held
  return tx.execute(s -> orders.confirm(o.id(), p));    // short tx #2
}

-- Postgres safety net
ALTER ROLE app SET idle_in_transaction_session_timeout = '15s';` },
    { title: 'Pool slowly starves over 6 hours; a restart fixes it every time',
      symptom: 'After each deploy, active connections creep from 2 to 10 over a few hours, then every request times out. Restarting the pod resets it.',
      diagnose: `# spring.datasource.hikari.leak-detection-threshold: 20000
WARN  ProxyLeakTask : Connection leak detection triggered for org.postgresql.jdbc.PgConnection@6b1a8c on thread http-nio-8080-exec-14, stack trace follows
java.lang.Exception: Apparent connection leak detected
    at com.zaxxer.hikari.HikariDataSource.getConnection(HikariDataSource.java:…)
    at com.acme.report.CsvExporter.export(CsvExporter.java:88)`,
      diagnoseLang: 'text',
      cause: 'A CSV export used <code>dataSource.getConnection()</code> directly and returned early on empty results without closing it. Each such call leaked a connection for good.',
      fix: 'Replace the manual JDBC with <code>JdbcTemplate</code> (or try-with-resources), keep leak detection on in production at a threshold above your slowest legitimate transaction, and alert on its log line.',
      fixCode: `public void export(Writer out, Instant since) {
  jdbc.query("SELECT id, total FROM orders WHERE created_at >= ?",
      rs -> { out.write(rs.getLong(1) + "," + rs.getBigDecimal(2) + "\\n"); },
      Timestamp.from(since));          // JdbcTemplate always closes
}` },
    { title: 'Rollout fails: new pods can’t connect',
      symptom: 'During a rolling deploy with <code>maxSurge: 100%</code>, new pods crash-loop with <code>FATAL: sorry, too many clients already</code>.',
      diagnose: `SELECT count(*), usename, application_name FROM pg_stat_activity GROUP BY 2, 3;
--  count | usename | application_name
--     80 | app     | PostgreSQL JDBC Driver      ← 8 old pods × 10
--     12 | etl     | …
SHOW max_connections;   -- 100`,
      diagnoseLang: 'sql',
      cause: '8 old pods × 10 connections plus jobs left room for only one new pod. During surge, 16 pods wanted 160 connections.',
      fix: 'Budget for the surge: smaller pools (most services need far fewer than 10 per pod), PgBouncer in transaction mode, or a lower surge. Set <code>ApplicationName</code> in the JDBC URL so <code>pg_stat_activity</code> shows who holds what.',
      fixCode: `spring:\n  datasource:\n    url: jdbc:postgresql://db:5432/shop?ApplicationName=checkout\n    hikari:\n      maximum-pool-size: 5\n      minimum-idle: 5`,
      fixLang: 'yaml' }
  ],
  puzzles: [
    { kind: 'predict', q: 'Pool of 10. Each request holds a connection for 50 ms. What is the maximum sustained throughput of database work, ignoring everything else?', options: ['10 req/s', '50 req/s', '200 req/s', '500 req/s'], answer: 2, explain: 'Each connection serves 1 / 0.05 = 20 requests per second; 10 connections → <b>200 req/s</b>. If hold time grows to 500 ms (an HTTP call inside the transaction), the same pool drops to 20 req/s.' },
    { kind: 'predict', q: 'Pool of 10, <code>connectionTimeout</code> 30 s. 50 requests arrive at once; each holds its connection for 12 s. How many fail with a timeout?', options: ['0', '10', '20', '40'], answer: 2, explain: 'Requests run in waves of 10: 1–10 at 0 s, 11–20 at 12 s, 21–30 at 24 s. Requests 31–50 would only get a connection at 36 s, but they give up at 30 s: <b>20</b> fail. Note that the first 30 succeed only because they waited up to 24 s, far beyond most request SLAs.' },
    { kind: 'concept', q: 'Twelve pods with <code>maximum-pool-size: 10</code> each, Postgres <code>max_connections = 100</code>. What happens when all pods start?', options: ['Hikari shares connections between pods', 'Some pools can’t fill: new connections fail with “too many clients already”', 'Postgres queues the extra connections', 'Pods use 100 / 12 connections each automatically'], answer: 1, explain: 'Pools are per JVM, and Postgres refuses connections past <code>max_connections</code> (minus reserved slots) immediately. Hikari keeps retrying in the background; requests on short pools wait and time out.' },
    { kind: 'concept', q: 'What does <code>leakDetectionThreshold = 60000</code> actually do?', options: ['Closes connections held longer than 60 s', 'Logs a warning with the borrower’s stack trace when a connection has been out longer than 60 s', 'Kills the Postgres backend after 60 s', 'Rolls back transactions older than 60 s'], answer: 1, explain: 'It only reports. Hikari schedules a task at borrow time; if the connection hasn’t been returned by then, it logs “Apparent connection leak detected” with the stack trace of <code>getConnection()</code>. If the connection comes back later, it logs that it was returned (“unleaked”).' },
    { kind: 'predict', q: 'Hikari logs this. What does it tell you?', code: `HikariPool-1 - Connection is not available, request timed out after 30000ms\n  (total=10, active=10, idle=0, waiting=46)`, options: ['Postgres is down', 'All 10 connections are borrowed, and 46 more threads are queued for one', 'The pool is still starting', 'The network to Postgres is broken'], answer: 1, explain: 'Total = active, idle = 0: the pool is fully lent out and 46 threads are queued. Postgres may be perfectly healthy. Now find out what the 10 borrowers are doing (thread dump, <code>pg_stat_activity</code>).' },
    { kind: 'concept', q: 'Which is the best first step when <code>hikaricp.connections.pending</code> is high?', options: ['Double maximum-pool-size', 'Look at hikaricp.connections.usage (hold time) and at what the active backends are doing in Postgres', 'Increase connectionTimeout to 120 s', 'Restart the pods'], answer: 1, explain: 'Pending means demand (rate × hold time) exceeds the pool. Usually hold time grew: a slow query, a lock wait, a remote call inside a transaction, or a leak. Fix that; resize only with evidence that Postgres has spare capacity.' }
  ],
  interview: [
    { q: 'How do you size a connection pool?', a: '<p>Start from what Postgres can do in parallel, not from thread count. The HikariCP wiki’s starting point (from the PostgreSQL community) is <code>connections ≈ cores × 2 + effective spindles</code> for the database server. Then use Little’s law for the app: needed connections ≈ peak query rate × average hold time, plus headroom. Divide the database’s budget across all pods. Small pools with short transactions beat big pools with long ones.</p>', fu: 'Why can a smaller pool be faster? (Fewer concurrent backends contend for CPU, locks and I/O; requests queue in the app instead, cheaply.)', lvl: 'core' },
    { q: 'Explain Hikari’s main timeouts.', a: '<ul><li><code>connectionTimeout</code> (30 s): max wait to borrow.</li><li><code>idleTimeout</code> (10 min): retire idle connections above <code>minimumIdle</code>; irrelevant for a fixed-size pool.</li><li><code>maxLifetime</code> (30 min): retire connections after this age; keep it below any infrastructure limit.</li><li><code>keepaliveTime</code>: ping idle connections so middleboxes don’t drop them.</li><li><code>validationTimeout</code> (5 s): max time for an aliveness check.</li><li><code>leakDetectionThreshold</code> (off): warn when a borrow exceeds it.</li></ul>', lvl: 'core' },
    { q: 'What can exhaust a pool even though queries are fast?', a: '<p>Hold time, not query time: remote calls inside <code>@Transactional</code>, OSIV holding the connection through rendering, <code>REQUIRES_NEW</code> needing a second connection per thread, row-lock waits inside Postgres, leaks from manual JDBC, streaming large results slowly to a client while the cursor is open, and threads blocked on a <code>synchronized</code> section while holding a connection.</p>', lvl: 'deep' },
    { q: 'How do you find a connection leak?', a: '<p>Enable <code>leak-detection-threshold</code> and read the stack trace of the borrower. Correlate with <code>hikaricp.connections.active</code> creeping up without load. In Postgres, leaked connections usually show as <code>idle</code> (or <code>idle in transaction</code>) with an old <code>state_change</code>; <code>application_name</code> and <code>client_addr</code> identify the pod.</p>', lvl: 'core' },
    { q: 'When would you put PgBouncer in front of Postgres?', a: '<p>When the total number of app connections (many pods, many services, serverless bursts) is larger than Postgres should run as backends. In transaction mode, a server connection is assigned only for the duration of a transaction, so thousands of client connections share a few dozen backends. Caveats: session state doesn’t survive between transactions (<code>SET</code>, advisory locks, <code>LISTEN</code>, temp tables), and prepared statements need PgBouncer 1.21+ protocol-level support or <code>prepareThreshold=0</code> in pgjdbc.</p>', lvl: 'deep' },
    { q: 'Which Hikari metrics would you alert on?', a: '<p><code>hikaricp.connections.pending</code> (threads waiting) above 0 for more than a minute; <code>hikaricp.connections.timeout</code> (failed borrows) increasing; <code>hikaricp.connections.acquire</code> p99 (time to borrow); <code>hikaricp.connections.usage</code> p99 (hold time); and active ≈ max for long periods. Pair them with Postgres-side <code>numbackends</code> and <code>idle in transaction</code> counts.</p>', lvl: 'core' },
    { q: 'Why does Hikari recommend a fixed-size pool?', a: '<p>Creating connections under load is slow (TLS, authentication, a new Postgres process) and happens exactly when you need capacity. A fixed pool (<code>minimumIdle = maximumPoolSize</code>, the default) keeps capacity warm and makes the load on Postgres predictable.</p>', lvl: 'core' },
    { q: 'What happens to a borrowed connection if the transaction is rolled back, or the thread dies?', a: '<p>With Spring’s transaction management, the connection is returned in a <code>finally</code> path after commit or rollback. Hikari also resets state it tracks (auto-commit, isolation, read-only, catalog) and rolls back an open transaction if a connection comes back dirty. If code borrows manually and never closes, nothing returns it; that is a leak until the JVM exits.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'application.yml', lang: 'yaml', code: `spring:
  datasource:
    url: jdbc:postgresql://db:5432/shop?ApplicationName=checkout&tcpKeepAlive=true
    username: app
    hikari:
      pool-name: checkout-pool
      maximum-pool-size: 10        # budget: pods × this ≤ max_connections − others
      minimum-idle: 10             # fixed size (the default)
      connection-timeout: 3000     # fail fast; default 30000
      max-lifetime: 1500000        # 25 min, below infrastructure limits
      keepalive-time: 60000        # ping idle connections
      leak-detection-threshold: 20000
      data-source-properties:
        socketTimeout: 60          # pgjdbc: seconds; a guard against dead sockets
management:
  endpoints.web.exposure.include: health,metrics,prometheus` },
    { title: 'Postgres side', lang: 'sql', code: `-- who holds connections, and what are they doing?
SELECT application_name, state, wait_event_type, count(*),
       max(now() - state_change) AS longest_in_state
FROM pg_stat_activity
WHERE backend_type = 'client backend'
GROUP BY 1, 2, 3 ORDER BY 4 DESC;

-- who blocks whom
SELECT pid, pg_blocking_pids(pid) AS blocked_by, left(query, 60)
FROM pg_stat_activity WHERE cardinality(pg_blocking_pids(pid)) > 0;

-- guards for the app role
ALTER ROLE app SET idle_in_transaction_session_timeout = '15s';
ALTER ROLE app SET statement_timeout = '10s';
SHOW max_connections;` },
    { title: 'Leak-proof JDBC', lang: 'java', code: `// ✗ leaks on early return or exception
Connection c = ds.getConnection();
PreparedStatement ps = c.prepareStatement(SQL);

// ✓ try-with-resources returns the connection to the pool
try (Connection c = ds.getConnection();
     PreparedStatement ps = c.prepareStatement(SQL)) {
  ps.setLong(1, id);
  try (ResultSet rs = ps.executeQuery()) { … }
}

// ✓✓ let Spring manage it (and join the current transaction)
List<Long> ids = jdbcClient.sql("SELECT id FROM orders WHERE status = ?")
    .param(status.name()).query(Long.class).list();` },
    { title: 'Watching the pool', lang: 'bash', code: `curl -s localhost:8080/actuator/metrics/hikaricp.connections.active  | jq '.measurements[0].value'
curl -s localhost:8080/actuator/metrics/hikaricp.connections.pending | jq '.measurements[0].value'
curl -s localhost:8080/actuator/metrics/hikaricp.connections.usage   | jq '.measurements'   # hold time
curl -s localhost:8080/actuator/metrics/hikaricp.connections.timeout | jq '.measurements'   # failed borrows

# Prometheus: alert when threads wait for connections
# max_over_time(hikaricp_connections_pending{pool="checkout-pool"}[5m]) > 0` }
  ]
});

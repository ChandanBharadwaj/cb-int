IA.register({
  track: 'spring',
  slug: 'transactions-propagation',
  title: '@Transactional deep dive',
  tagline: '<code>@Transactional</code> is a <b>proxy</b> that runs <code>BEGIN</code> before your method and <code>COMMIT</code> or <code>ROLLBACK</code> after it, on a connection bound to the current thread. Propagation decides whether a call <b>joins</b>, <b>suspends</b> or <b>savepoints</b> that transaction; rollback rules decide which exceptions undo it. Everything else follows from what Postgres actually receives.',
  tldr: {
    problem: '“Transaction silently rolled back because it has been marked as rollback-only”, audit rows that vanish with the rollback they were meant to record, checked exceptions that commit half the work, and connections “idle in transaction” while an HTTP call runs.',
    model: 'Caller → proxy → <code>TransactionInterceptor</code> → <code>PlatformTransactionManager.getTransaction()</code> (join, suspend, or create) → your method → commit or roll back based on the exception. A transaction is one physical connection: <code>REQUIRED</code> reuses it, <code>REQUIRES_NEW</code> takes a <b>second</b> one, <code>NESTED</code> adds a <code>SAVEPOINT</code>.',
    hook: '“Why didn’t my REQUIRES_NEW work?” Because <code>this.audit()</code> never goes through the proxy. And when it does work, it needs a second pooled connection while the first one is still held.',
    facts: [
      { v: 'RuntimeException', l: 'and <code>Error</code> roll back by default; <b>checked exceptions commit</b> unless you set <code>rollbackFor</code>' },
      { v: '2 connections', l: 'held at once by a thread inside <code>REQUIRES_NEW</code>: the suspended outer one and the new inner one' },
      { v: 'READ COMMITTED', l: 'Postgres’s default isolation. <code>READ UNCOMMITTED</code> behaves the same; <code>REPEATABLE READ</code> is snapshot isolation and can fail with <code>40001</code>' }
    ]
  },
  intro: {
    what: 'A <b>transaction</b> groups several database changes so they all happen or none do: debit one account, credit another. In Spring you put <code>@Transactional</code> on a method. Spring then starts a transaction before the method, commits it if the method returns normally, and rolls it back if it throws (by default, an unchecked exception).',
    analogy: { icon: '🛒', title: 'A shopping basket', text: 'Putting items in a basket isn’t buying them; checkout (commit) is. Drop the basket (rollback) and nothing was bought. Propagation answers: when a helper adds items, do they use <i>your</i> basket (REQUIRED), grab their own and pay separately (REQUIRES_NEW), or put a divider in yours so they can take just their items out again (NESTED)?' },
    steps: [
      { t: 'Annotate a public service method', d: 'Spring wraps the bean in a proxy. Calls from <i>other</i> beans go through it.', code: '@Service\nclass TransferService {\n  @Transactional\n  public void transfer(long from, long to, BigDecimal amount) { … }\n}' },
      { t: 'The proxy opens the transaction', d: 'It takes a connection from the pool, turns off auto-commit, and binds the connection to the current thread. Every repository call on this thread uses it.' },
      { t: 'Your method runs', d: 'INSERTs and UPDATEs go to Postgres inside the open transaction; other sessions don’t see them yet.' },
      { t: 'Commit or roll back', d: 'Return normally → <code>COMMIT</code>. Throw a <code>RuntimeException</code> → <code>ROLLBACK</code>. Then the connection goes back to the pool.' }
    ],
    terms: [
      ['proxy', 'A generated wrapper object that intercepts calls to your bean and adds behaviour.'],
      ['propagation', 'What to do if a transaction already exists when the method is called.'],
      ['isolation', 'How much one transaction sees of others’ concurrent changes.'],
      ['rollback-only', 'A flag on a transaction meaning it can no longer commit.'],
      ['savepoint', 'A marker inside a transaction that you can roll back to without losing earlier work.']
    ]
  },
  visual: {
    title: 'Watch the proxy, the connections and what Postgres receives',
    caption: 'Pick a scenario and press Play or Step. Left: the call stack, with proxies shown as gates. Middle: transactions and their state. Right: the statements each pooled connection sends to Postgres. Look for the second connection, the savepoint, and the commit that turns into a rollback.'
  },
  gotchas: [
    { trap: 'Self-invocation bypasses the proxy',
      code: `@Service class OrderService {\n  @Transactional public void place(Order o) {\n    repo.save(o);\n    this.audit(o);          // plain Java call: no proxy, no REQUIRES_NEW\n  }\n  @Transactional(propagation = REQUIRES_NEW) public void audit(Order o) { … }\n}`,
      why: 'The annotation only works when the call goes through the Spring proxy. <code>this</code> is the raw target object, so the inner annotation is ignored and the audit joins (and dies with) the outer transaction.',
      fix: 'Move the method to another bean, inject the bean into itself lazily (<code>@Lazy</code> self-reference), or use <code>TransactionTemplate</code> with the propagation you need. See <a href="aop-proxies.html">AOP &amp; proxies</a>.' },
    { trap: 'Checked exceptions commit',
      code: `@Transactional\npublic void importFile(Path p) throws IOException {\n  repo.save(header);\n  parseLines(p);         // throws IOException halfway → header is COMMITTED\n}`,
      why: 'The default rule (inherited from EJB) rolls back on <code>RuntimeException</code> and <code>Error</code> only. A checked exception means “business outcome”, so the transaction commits.',
      fix: '<code>@Transactional(rollbackFor = Exception.class)</code>, or wrap checked exceptions in unchecked ones. Framework 6.2 adds a global switch: <code>@EnableTransactionManagement(rollbackOn = RollbackOn.ALL_EXCEPTIONS)</code>.' },
    { trap: 'Catching the inner exception doesn’t save the outer transaction',
      code: `@Transactional public void placeAll(List<Order> os) {\n  for (Order o : os) {\n    try { orderService.place(o); }   // REQUIRED: joins, throws, marks rollback-only\n    catch (RuntimeException e) { log.warn("skip", e); }\n  }\n}   // commit → UnexpectedRollbackException`,
      why: 'Joining participants share one physical transaction. When the inner proxy sees the exception, it marks the shared transaction rollback-only. The outer commit then rolls back and throws <code>UnexpectedRollbackException</code>.',
      fix: 'Use <code>REQUIRES_NEW</code> or <code>NESTED</code> for the per-item unit of work, or validate before calling so the inner method doesn’t throw. Setting <code>noRollbackFor</code> on the inner method is another option.' },
    { trap: 'REQUIRES_NEW can deadlock your own pool',
      why: 'The outer transaction keeps its connection while suspended. With a pool of 10 and 10 concurrent requests in the outer method, every thread holds one connection and waits for a second: nothing can proceed until Hikari’s <code>connectionTimeout</code> (30 s) fails them all.',
      fix: 'Avoid <code>REQUIRES_NEW</code> on hot paths, size the pool for threads × connections per thread, or hand the independent write to another thread (an <code>@Async</code> event listener), so no thread ever holds one connection while waiting for a second. Note that an <code>AFTER_COMMIT</code> listener on the same thread still holds the outer connection. See <a href="hikari-pooling.html">HikariCP</a>.' },
    { trap: 'readOnly = true silently drops your changes',
      code: `@Transactional(readOnly = true)\npublic Order rename(long id, String name) {\n  Order o = repo.findById(id).orElseThrow();\n  o.setName(name);       // no UPDATE: Hibernate flush mode MANUAL, entities read-only\n  return o;\n}`,
      why: 'With Hibernate, Spring sets the session to <code>FlushMode.MANUAL</code> and loads entities read-only, so dirty checking never produces an UPDATE. With pgjdbc the transaction also starts as <code>BEGIN READ ONLY</code>, so an explicit write fails with SQLSTATE <code>25006</code>.',
      fix: 'Use <code>readOnly</code> only for queries, where it saves dirty-checking snapshots and lets you route to a replica. Put a writing method in a non-read-only transaction.' },
    { trap: 'Remote calls inside a transaction',
      code: `@Transactional\npublic void checkout(Cart c) {\n  orders.save(c.toOrder());\n  payments.charge(c);        // 3 s HTTP call: the connection sits "idle in transaction"\n  orders.markPaid(c.id());\n}`,
      why: 'The connection is taken at transaction start and held until commit. Row locks from the first statement are held too. In <code>pg_stat_activity</code> you see <code>idle in transaction</code>, and the pool drains under load.',
      fix: 'Keep transactions short: do the remote call before or after, and use an outbox or a state machine (PENDING → PAID) for consistency. Set <code>idle_in_transaction_session_timeout</code> in Postgres as a safety net.' },
    { trap: 'Private and final methods aren’t intercepted',
      why: 'CGLIB proxies subclass your bean and override methods, so they can’t intercept <code>private</code> or <code>final</code> methods. Since Framework 6.0, <code>protected</code> and package-private methods are intercepted with class-based proxies; before that only <code>public</code> ones were.',
      fix: 'Put <code>@Transactional</code> on public methods of beans that are called from other beans. Kotlin classes need the <code>allopen</code>/<code>spring</code> plugin.' }
  ],
  scenarios: [
    { title: 'Nightly import fails with UnexpectedRollbackException after processing every row',
      symptom: 'A batch processes 40,000 rows, logs a handful of “skipped invalid row” warnings, and at the very end throws <code>UnexpectedRollbackException: Transaction silently rolled back because it has been marked as rollback-only</code>. Nothing is saved.',
      diagnose: `-- Postgres log (log_statement = 'all'), one connection
BEGIN
INSERT INTO import_rows …   (× 40,000)
ROLLBACK                    -- not COMMIT`,
      diagnoseLang: 'sql',
      cause: 'The per-row service method was <code>@Transactional</code> (REQUIRED), so it joined the batch transaction. A validation <code>RuntimeException</code> in row 1,203 marked the whole transaction rollback-only, even though the caller caught it.',
      fix: 'Validate rows without throwing, or give each chunk its own transaction (REQUIRES_NEW from a separate bean, or a <code>TransactionTemplate</code> per chunk of 500). Then a bad row only loses its chunk.',
      fixCode: `TransactionTemplate tx = new TransactionTemplate(txManager);
tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
for (List<Row> chunk : Lists.partition(rows, 500)) {
  try { tx.executeWithoutResult(s -> chunk.forEach(importer::save)); }
  catch (DataIntegrityViolationException e) { report.failed(chunk, e); }   // only this chunk rolls back
}` },
    { title: 'API p99 at 30 s; Hikari says “Connection is not available” at only 40 req/s',
      symptom: 'Under moderate load, requests to <code>POST /orders</code> hang and then fail with <code>SQLTransientConnectionException: … request timed out after 30000ms</code>. CPU and Postgres load are low.',
      diagnose: `SELECT state, count(*), max(now() - xact_start) AS oldest
FROM pg_stat_activity WHERE datname = 'shop' GROUP BY state;
--        state        | count |  oldest
-- idle in transaction |    10 | 00:00:29.8`,
      diagnoseLang: 'sql',
      cause: 'Every <code>place()</code> held its connection and called <code>AuditService.record()</code> with <code>REQUIRES_NEW</code>, which needed a second connection. With 10 concurrent requests and a pool of 10, each thread held one connection and waited for another: a pool deadlock that ended only at the 30 s timeout.',
      fix: 'If the audit must roll back with the order, write it in the same transaction. If it must survive a rollback, write it on a thread that holds no connection yet (an <code>@Async</code> listener). A synchronous <code>AFTER_COMMIT</code> listener isn’t enough: it runs before the outer connection is released. And size the pool for the maximum connections one thread can hold.',
      fixCode: `@Transactional
public void place(Order o) {
  repo.save(o);
  events.publishEvent(new OrderPlaced(o.id()));        // request thread holds one connection only
}

@Async                                                  // another thread: holds nothing while it waits
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMPLETION)
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void on(OrderPlaced e) { audit.save(AuditRow.of(e)); }` },
    { title: 'Lost updates on stock counts despite @Transactional',
      symptom: 'Two concurrent purchases of the last item both succeed; stock shows 0, but two orders exist. Each method was <code>@Transactional</code>.',
      diagnose: `-- what both transactions sent (READ COMMITTED)
BEGIN;
SELECT stock FROM products WHERE id = 7;        -- both read 1
UPDATE products SET stock = 0 WHERE id = 7;     -- second waits for the first, then overwrites
COMMIT;`,
      diagnoseLang: 'sql',
      cause: 'A transaction gives atomicity, not protection against read-modify-write races. Under READ COMMITTED, both read <code>stock = 1</code> before either wrote, and the application computed the new value from a stale read.',
      fix: 'Let Postgres do the check atomically, lock the row, or use optimistic locking. Raising isolation to <code>REPEATABLE READ</code> also works in Postgres (the second UPDATE fails with <code>40001</code>), but then you must retry.',
      fixCode: `-- atomic conditional update: 1 row = success, 0 rows = sold out
UPDATE products SET stock = stock - 1 WHERE id = :id AND stock > 0;

// or JPA optimistic locking
@Version private long version;   // UPDATE … WHERE id = ? AND version = ? → OptimisticLockException` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does the caller of <code>placeAll</code> see?', code: `@Service class BatchService {\n  @Autowired OrderService orders;          // another bean: calls go through its proxy\n  @Transactional public void placeAll(List<Order> list) {\n    for (Order o : list) {\n      try { orders.place(o); }             // @Transactional (REQUIRED); throws for one order\n      catch (IllegalArgumentException e) { /* skip it */ }\n    }\n  }\n}`, options: ['The valid orders are committed', 'UnexpectedRollbackException, and nothing is committed', 'Only the invalid order is rolled back', 'IllegalArgumentException'], answer: 1, explain: '<code>place()</code> joined the outer transaction. When its proxy saw the <code>RuntimeException</code>, it marked the shared transaction rollback-only. The outer proxy tries to commit, Spring rolls back and throws <code>UnexpectedRollbackException</code>.' },
    { kind: 'predict', q: 'What is committed?', code: `@Transactional\npublic void importFile(Path p) throws IOException {\n  batchRepo.save(new Batch(p));           // INSERT batch\n  throw new IOException("disk gone");\n}`, options: ['Nothing: any exception rolls back', 'The batch row: checked exceptions commit by default', 'It depends on the isolation level', 'Nothing: IOException is an Error'], answer: 1, explain: 'Default rollback rules cover <code>RuntimeException</code> and <code>Error</code>. <code>IOException</code> is checked, so the transaction commits before the exception propagates. Use <code>rollbackFor = Exception.class</code>.' },
    { kind: 'predict', q: 'The outer method fails after the audit call. Is the audit row in Postgres?', code: `@Service class OrderService {\n  @Transactional public void place(Order o) {\n    repo.save(o);\n    this.audit(o);                          // self-invocation\n    throw new IllegalStateException("stock");\n  }\n  @Transactional(propagation = Propagation.REQUIRES_NEW)\n  public void audit(Order o) { auditRepo.save(new Audit(o)); }\n}`, options: ['Yes: REQUIRES_NEW committed it separately', 'No: the call bypassed the proxy, so it was part of the rolled-back transaction', 'Yes, but only with CGLIB proxies', 'Startup error'], answer: 1, explain: '<code>this.audit()</code> calls the target directly, so <code>REQUIRES_NEW</code> is never applied. The audit INSERT ran on the outer connection and was rolled back with it.' },
    { kind: 'predict', q: 'Pool size 10. Twelve requests enter <code>place()</code> at the same moment. What happens?', code: `@Transactional public void place(Order o) {          // holds connection #1\n  repo.save(o);\n  auditService.record(o);                             // REQUIRES_NEW → needs connection #2\n}`, options: ['All 12 complete, just slower', '10 threads each hold one connection and wait for a second; after 30 s they fail with connection timeouts', 'Postgres raises a deadlock error (40P01)', 'Spring reuses connection #1 for REQUIRES_NEW'], answer: 1, explain: 'Each thread holds its suspended outer connection while asking for a new one. All 10 are taken, so nobody gets a second, and nobody releases the first. Postgres sees no lock conflict at all; this is a deadlock inside your connection pool, broken only by Hikari’s <code>connectionTimeout</code>.' },
    { kind: 'predict', q: 'Hibernate + pgjdbc. What does Postgres receive?', code: `@Transactional(readOnly = true)\npublic void rename(long id) {\n  Product p = repo.findById(id).orElseThrow();\n  p.setName("New name");\n}`, options: ['BEGIN READ ONLY; SELECT …; COMMIT', 'BEGIN; SELECT …; UPDATE …; COMMIT', 'BEGIN READ ONLY; SELECT …; UPDATE … → ERROR 25006', 'SELECT … only, in autocommit'], answer: 0, explain: 'Spring marks the JDBC connection read-only (pgjdbc sends <code>BEGIN READ ONLY</code>) and sets Hibernate’s flush mode to MANUAL with read-only entities. The change is never flushed, so no UPDATE is sent and no error is raised. The rename is silently lost.' },
    { kind: 'predict', q: '<code>DataSourceTransactionManager</code> (JDBC). The inner call throws and the outer catches it. What is committed?', code: `@Transactional public void outer() {\n  jdbc.update("INSERT INTO a VALUES (1)");\n  try { inner.run(); } catch (RuntimeException e) { }\n  jdbc.update("INSERT INTO a VALUES (3)");\n}\n// inner.run(): @Transactional(propagation = NESTED)\n//   jdbc.update("INSERT INTO a VALUES (2)"); throw new RuntimeException();`, options: ['1, 2, 3', '1 and 3', 'Nothing (UnexpectedRollbackException)', 'Only 1'], answer: 1, explain: '<code>NESTED</code> sets <code>SAVEPOINT SAVEPOINT_1</code> before the inner work. The exception triggers <code>ROLLBACK TO SAVEPOINT</code>, which undoes only row 2, without marking the outer transaction rollback-only. The outer commits 1 and 3.' },
    { kind: 'concept', q: 'Postgres, <code>@Transactional(isolation = REPEATABLE_READ)</code>. Two transactions read the same row, then both update it. What happens to the second UPDATE?', options: ['It overwrites the first (lost update)', 'It blocks until the first commits, then fails with SQLSTATE 40001 “could not serialize access due to concurrent update”', 'It succeeds and merges both changes', 'It deadlocks (40P01)'], answer: 1, explain: 'Postgres REPEATABLE READ is snapshot isolation. The second updater waits for the first; when the first commits, the row changed after the second’s snapshot, so Postgres aborts it with <code>40001</code>. The application must retry the whole transaction.' }
  ],
  interview: [
    { q: 'How does @Transactional actually work?', a: '<p>At startup a bean post-processor wraps beans that have <code>@Transactional</code> methods in a proxy (JDK dynamic proxy or CGLIB subclass; Boot defaults to CGLIB). A call through the proxy hits <code>TransactionInterceptor</code>, which reads the attributes (propagation, isolation, timeout, readOnly, rollback rules) and asks the <code>PlatformTransactionManager</code> for a transaction. The manager binds a connection (or <code>EntityManager</code>) to the thread via <code>TransactionSynchronizationManager</code>, so repositories and <code>JdbcTemplate</code> find it. After the method, the interceptor commits, or rolls back when the exception matches the rollback rules.</p>', lvl: 'core' },
    { q: 'Explain the propagation levels you actually use.', a: '<ul><li><b>REQUIRED</b> (default): join the existing transaction, or start one.</li><li><b>REQUIRES_NEW</b>: suspend the current one and start an independent physical transaction on another connection.</li><li><b>NESTED</b>: a savepoint inside the current transaction (JDBC savepoints; <code>JpaTransactionManager</code> allows it by default in 6.x (<code>nestedTransactionAllowed</code> becomes <code>false</code> by default in 7.0), but it only rolls back the JDBC side, not the persistence context).</li><li><b>MANDATORY</b>: fail if there is none, useful for methods that must be called inside a unit of work.</li><li><b>SUPPORTS</b>, <b>NOT_SUPPORTED</b>, <b>NEVER</b>: rarer.</li></ul>', lvl: 'core' },
    { q: 'What is UnexpectedRollbackException and how do you avoid it?', a: '<p>An inner participant (REQUIRED, joined) threw an exception that matched its rollback rules, so the shared transaction was marked rollback-only. The outer code caught the exception and tried to commit; Spring rolls back and throws <code>UnexpectedRollbackException</code> so the caller knows the commit didn’t happen. Avoid it by not swallowing exceptions from joined participants, using REQUIRES_NEW/NESTED for independent units, or <code>noRollbackFor</code> on the inner method when the exception really is harmless.</p>', lvl: 'deep' },
    { q: 'Which isolation levels does Postgres really offer, and what do they mean for a Spring app?', a: '<p>READ COMMITTED (default): each statement sees a fresh snapshot, so non-repeatable reads and lost updates in read-modify-write code are possible. REPEATABLE READ: one snapshot per transaction (snapshot isolation); concurrent updates to the same row fail with <code>40001</code>. SERIALIZABLE: SSI, which detects dangerous read/write dependencies and also fails with <code>40001</code>. READ UNCOMMITTED behaves as READ COMMITTED. With anything above READ COMMITTED, wrap the transaction in a retry (for example Spring Retry on <code>CannotAcquireLockException</code>/<code>ConcurrencyFailureException</code>), and retry outside the transactional proxy.</p>', lvl: 'deep' },
    { q: 'What does readOnly = true do?', a: '<p>It is a hint passed down the stack. Spring calls <code>Connection.setReadOnly(true)</code>; pgjdbc then starts the transaction with <code>BEGIN READ ONLY</code>, so writes fail with <code>25006</code>. With Hibernate, Spring sets <code>FlushMode.MANUAL</code> and loads entities read-only, saving dirty-checking snapshots. <code>AbstractRoutingDataSource</code> can use <code>TransactionSynchronizationManager.isCurrentTransactionReadOnly()</code> to route to a replica (wrap it in <code>LazyConnectionDataSourceProxy</code> so the decision happens after the transaction starts).</p>', lvl: 'core' },
    { q: 'When is the database connection acquired, and why does it matter?', a: '<p>With <code>DataSourceTransactionManager</code>, at transaction begin. With JPA/Hibernate, also at begin by default, because Hibernate must switch auto-commit off. So a <code>@Transactional</code> method that first calls a slow API holds a connection the whole time. Setting <code>spring.datasource.hikari.auto-commit=false</code> plus <code>hibernate.connection.provider_disables_autocommit=true</code> lets Hibernate delay acquisition until the first statement. Better still, keep remote calls out of transactions.</p>', lvl: 'deep' },
    { q: 'Where should the transaction boundary be?', a: '<p>At the service method that represents one business use case, not in controllers and not per repository call (Spring Data repository methods are transactional by themselves, so several calls without a service transaction are several separate transactions). Keep it short: no HTTP calls, no waiting for user input, no large file processing inside. For “write and then notify”, use an outbox table in the same transaction, or <code>@TransactionalEventListener(AFTER_COMMIT)</code>.</p>', lvl: 'core' },
    { q: 'What does the timeout attribute do?', a: '<p><code>@Transactional(timeout = 5)</code> sets a deadline. Spring applies the remaining time as a query timeout to each JDBC statement (pgjdbc cancels the query on the server) and checks it before each statement. It doesn’t interrupt Java code, so a 10 s HTTP call inside the method isn’t stopped; the next statement fails instead. Use Postgres’s <code>statement_timeout</code> and <code>idle_in_transaction_session_timeout</code> as server-side guards.</p>', lvl: 'deep' },
    { q: 'How do you test that something rolled back?', a: '<p>Don’t use a <code>@Transactional</code> test for it, because the test transaction would hide the commit behaviour. Call the service from a non-transactional test, assert the exception, then query with <code>JdbcTemplate</code> to check the table. To test <code>UnexpectedRollbackException</code> or REQUIRES_NEW, you need real commits. See <a href="boot-testing.html">Testing in Boot</a>.</p>', lvl: 'core' },
    { q: 'Programmatic vs declarative transactions?', a: '<p>Declarative (<code>@Transactional</code>) is fine for most service methods. Use <code>TransactionTemplate</code> when the boundary is smaller than a method (a loop of chunks), when you need different propagation inside the same class without self-invocation tricks, or when you want explicit control over what happens on failure.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Propagation in practice', lang: 'java', code: `@Service
class TransferService {
  private final AccountRepository accounts;
  private final AuditService audit;            // separate bean → its proxy applies

  @Transactional(rollbackFor = Exception.class, timeout = 5)
  public void transfer(long from, long to, BigDecimal amount) {
    Account a = accounts.findByIdForUpdate(from);   // SELECT … FOR UPDATE
    Account b = accounts.findByIdForUpdate(to);
    a.debit(amount); b.credit(amount);              // dirty checking → UPDATEs at commit
    audit.attempted(from, to, amount);              // REQUIRES_NEW: survives a rollback
  }
}

@Service
class AuditService {
  @Transactional(propagation = Propagation.REQUIRES_NEW)   // second connection!
  public void attempted(long from, long to, BigDecimal amount) { … }
}

interface AccountRepository extends JpaRepository<Account, Long> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select a from Account a where a.id = :id")
  Account findByIdForUpdate(long id);
}` },
    { title: 'What Postgres receives', lang: 'sql', code: `-- REQUIRED (one connection, pid 4711)
BEGIN;
SELECT … FROM account WHERE id = 1 FOR UPDATE;
UPDATE account SET balance = … WHERE id = 1;
COMMIT;

-- REQUIRES_NEW inside it (second connection, pid 4712), while 4711 is "idle in transaction"
BEGIN;
INSERT INTO audit …;
COMMIT;

-- NESTED (same connection)
SAVEPOINT SAVEPOINT_1;
INSERT INTO a VALUES (2);
ROLLBACK TO SAVEPOINT SAVEPOINT_1;

-- readOnly = true with pgjdbc
BEGIN READ ONLY;

-- find long transactions holding connections
SELECT pid, state, now() - xact_start AS xact_age, left(query, 60)
FROM pg_stat_activity
WHERE state LIKE 'idle in transaction%' ORDER BY xact_age DESC;` },
    { title: 'Retry around serialization failures', lang: 'java', code: `@Service
class StockFacade {
  private final StockService stock;            // the @Transactional bean

  @Retryable(retryFor = ConcurrencyFailureException.class,   // 40001 / 40P01 map here
             maxAttempts = 3, backoff = @Backoff(delay = 50, multiplier = 2))
  public void reserve(long productId, int qty) {
    stock.reserve(productId, qty);             // each attempt = a fresh transaction
  }
}

@Service
class StockService {
  @Transactional(isolation = Isolation.REPEATABLE_READ)
  public void reserve(long productId, int qty) { … }
}`, note: 'The retry must wrap the transactional proxy, not sit inside it: retrying inside an aborted transaction only gets <code>25P02 current transaction is aborted</code>.' },
    { title: 'Transaction settings', lang: 'yaml', code: `spring:
  datasource:
    hikari:
      auto-commit: false                 # pair with the Hibernate flag below
  jpa:
    open-in-view: false
    properties:
      hibernate.connection.provider_disables_autocommit: true   # acquire the connection lazily
logging:
  level:
    org.springframework.orm.jpa.JpaTransactionManager: DEBUG   # "Creating new transaction…", "Participating in existing…"
    org.springframework.transaction.interceptor: TRACE        # which method got which attributes` }
  ]
});

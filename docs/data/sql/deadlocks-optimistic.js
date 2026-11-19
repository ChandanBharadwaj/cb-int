IA.register({
  track: 'sql',
  slug: 'deadlocks-optimistic',
  title: 'Deadlocks, optimistic & pessimistic locking',
  tagline: 'A deadlock is a <b>cycle in the wait-for graph</b>. Postgres finds it after <code>deadlock_timeout</code> and kills one transaction. You prevent it with a consistent lock order, survive it with retries, and often avoid row locks entirely with a <b>version column</b>.',
  tldr: {
    problem: 'Sporadic <code>ERROR: deadlock detected</code> under load, lost updates that nobody notices, and pessimistic locks that hold connections while users think.',
    model: 'T1 holds A and waits for B; T2 holds B and waits for A. After <code>deadlock_timeout</code> (1 s) the waiting backend checks the graph, finds the cycle and aborts itself with SQLSTATE <code>40P01</code>. The other one proceeds.',
    hook: '“Two transfers in opposite directions deadlock 30 times a day.” Lock accounts in id order and the cycle is impossible.',
    facts: [
      { v: '1 s', l: 'default deadlock timeout: how long a backend waits before it runs the (expensive) cycle check' },
      { v: '40P01 / 40001', l: 'SQLSTATEs for deadlock and serialization failure. Both mean “retry the whole transaction”' },
      { v: 'UPDATE 0', l: 'what a version-checked UPDATE returns when someone else saved first. JPA throws on it' }
    ]
  },
  intro: {
    what: 'A <b>deadlock</b> happens when two transactions each hold something the other needs, so both wait forever. Postgres notices and cancels one of them. Separately, there are two ways to stop two users from overwriting each other: <b>pessimistic</b> locking (lock the row while you work on it) and <b>optimistic</b> locking (don’t lock; check at save time that nobody changed it).',
    analogy: { icon: '🚗', title: 'Two cars on a narrow bridge', text: 'Each car has driven half-way and needs the other to back up. Nobody moves until someone (Postgres) tells one car to reverse. The fix is a rule: always let the car from the north go first. Optimistic locking is like editing a shared doc offline and getting “this file changed since you opened it” when you save.' },
    steps: [
      { t: 'Locks are taken one statement at a time', d: 'A transaction collects row locks as it goes, and holds them until COMMIT.' },
      { t: 'Opposite order = possible cycle', d: 'T1 updates row 1 then row 2; T2 updates row 2 then row 1. If they interleave, each waits for the other.', code: "-- T1: UPDATE accounts ... WHERE id = 1;  then id = 2\n-- T2: UPDATE accounts ... WHERE id = 2;  then id = 1" },
      { t: 'Postgres breaks the cycle', d: 'After one second of waiting it looks for cycles and aborts one transaction with “deadlock detected”. Your code should retry it.' },
      { t: 'Optimistic: a version column', d: 'Add <code>version int</code>. Every update says “only if the version is still what I read” and increments it. 0 rows updated means someone else won.', code: 'UPDATE product SET stock = 7, version = version + 1\nWHERE id = 7 AND version = 7;' }
    ],
    terms: [
      ['deadlock', 'Two or more transactions waiting for each other in a cycle.'],
      ['deadlock_timeout', 'How long to wait before checking for a cycle (default 1 s).'],
      ['pessimistic lock', 'Lock the row first (SELECT … FOR UPDATE), then change it.'],
      ['optimistic lock', 'Don’t lock; detect a conflicting change at write time with a version check.'],
      ['lost update', 'Two read-modify-write cycles overlap and one silently overwrites the other.']
    ]
  },
  visual: {
    title: 'Watch a deadlock form and get broken',
    caption: 'Solid arrows: a transaction holds a row lock. Dashed arrows: it waits for one. Compare opposite lock order, the same with an application retry, and a consistent lock order.'
  },
  extras: [
    { id: 'deadlocks-optimistic-occ', title: 'Lost update vs optimistic vs pessimistic', label: 'Optimistic vs pessimistic', caption: 'Two clerks sell the same product at the same time. Only two of the three strategies end with the correct stock.' }
  ],
  playground: {
    setup: `
CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, bal numeric NOT NULL CHECK (bal >= 0));
CREATE TABLE product (id int PRIMARY KEY, name text NOT NULL, stock int NOT NULL, version int NOT NULL DEFAULT 0);
INSERT INTO accounts VALUES (1,'asha',500),(2,'ben',300),(3,'chen',100);
INSERT INTO product VALUES (7,'kettle',10,7);`,
    presets: [
      { label: 'Optimistic save', sql: `-- Alice read version 7; she saves:\nUPDATE product SET stock = 7, version = version + 1\nWHERE id = 7 AND version = 7\nRETURNING *;\n-- Bob also read version 7; he saves:\nUPDATE product SET stock = 8, version = version + 1\nWHERE id = 7 AND version = 7\nRETURNING *;`, note: 'The second UPDATE returns 0 rows. That count is the whole mechanism: JPA checks it and throws OptimisticLockException.' },
      { label: 'Atomic update (no lock dance)', sql: `UPDATE product SET stock = stock - 3 WHERE id = 7 AND stock >= 3 RETURNING stock;\nUPDATE product SET stock = stock - 2 WHERE id = 7 AND stock >= 2 RETURNING stock;`, note: 'For a single row, computing in SQL avoids lost updates without any explicit locking: the second UPDATE waits on the row and then re-reads it.' },
      { label: 'Lock in a consistent order', sql: `BEGIN;\n-- transfer 2 → 1: lock BOTH rows first, lowest id first\nSELECT id, bal FROM accounts WHERE id IN (2, 1) ORDER BY id FOR UPDATE;\nUPDATE accounts SET bal = bal - 50 WHERE id = 2;\nUPDATE accounts SET bal = bal + 50 WHERE id = 1;\nSELECT id, bal FROM accounts ORDER BY id;\nCOMMIT;`, note: 'With <code>ORDER BY id FOR UPDATE</code> every transfer takes its locks in the same order, so no cycle can form.' },
      { label: 'What I’m waiting on', sql: `BEGIN;\nUPDATE accounts SET bal = bal + 1 WHERE id = 1;\nSELECT locktype, transactionid, mode, granted\nFROM pg_locks WHERE pid = pg_backend_pid() AND locktype IN ('transactionid','virtualxid');\nROLLBACK;`, note: 'Each writer holds an ExclusiveLock on its own transaction id. A blocked writer waits for a <b>ShareLock on that transactionid</b>, which is exactly what deadlock reports print.' },
      { label: 'Timeouts', sql: `SELECT name, setting, unit FROM pg_settings\nWHERE name IN ('deadlock_timeout','lock_timeout','log_lock_waits')\nORDER BY name;`, note: '<code>log_lock_waits = on</code> logs any wait longer than deadlock_timeout. It is cheap and very useful.' }
    ]
  },
  gotchas: [
    { trap: 'Retrying only the failed statement', why: 'After 40P01 the whole transaction is aborted; every later statement fails with “current transaction is aborted”. And your earlier reads may be stale.', fix: 'Retry the <b>entire</b> transaction from the start, with a small random back-off and a retry cap.' },
    { trap: 'Lowering deadlock_timeout to “detect faster”', why: 'The check runs for every wait that lasts longer than the timeout, and it takes a lock-manager-wide lock. A low value turns ordinary short waits into CPU spikes.', fix: 'Keep it around 1 s. Fix the lock order instead. Raise it if you have many legitimate longer waits.' },
    { trap: 'Hidden lock order: batch UPDATE without ORDER BY', code: `UPDATE stock SET qty = qty - 1\nWHERE sku = ANY($1);  -- row order depends on the plan`, why: 'Two batches with overlapping SKUs lock rows in whatever order the scan returns them, so they can deadlock.', fix: 'Lock first in a defined order: <code>SELECT … WHERE sku = ANY($1) ORDER BY sku FOR UPDATE</code>, then update.' },
    { trap: 'Deadlocks through foreign keys and unique indexes', why: 'Inserting children takes KEY SHARE on parents, and two inserts of the same unique key wait for each other. Cycles can involve rows you never named.', fix: 'Read the server log: it prints every process, its query, and the lock it waited for.' },
    { trap: '@Version without retry = errors for users', why: 'Optimistic locking only <i>detects</i> conflicts. Under real contention (a hot counter) most writes fail.', fix: 'Retry automatically for machine updates. For hot rows use an atomic SQL update or a pessimistic lock.' },
    { trap: 'PESSIMISTIC_WRITE across user think time', why: 'Holding FOR UPDATE while a person edits a form holds a connection and blocks every other writer (and FK inserts) for minutes.', fix: 'Pessimistic locks only inside short, server-side transactions. Use @Version / ETags across HTTP requests.' }
  ],
  scenarios: [
    { title: '“deadlock detected” 40 times an hour after launching P2P transfers',
      symptom: 'Transfers between two users intermittently fail with 500s. Only transfers in both directions at the same time are affected.',
      diagnose: `-- postgresql.log\n-- ERROR: deadlock detected\n-- DETAIL: Process 4711 waits for ShareLock on transaction 9001; blocked by process 4712.\n--         Process 4712 waits for ShareLock on transaction 9000; blocked by process 4711.\nSELECT deadlocks FROM pg_stat_database WHERE datname = current_database();`,
      cause: 'The service debited the sender, then credited the receiver. A→B and B→A in parallel lock the same two rows in opposite orders.',
      fix: 'Lock both rows in id order first, then apply both changes. Keep a retry on 40P01 as a safety net.',
      fixCode: `SELECT id FROM accounts WHERE id IN (:from, :to) ORDER BY id FOR UPDATE;\nUPDATE accounts SET bal = bal - :amt WHERE id = :from;\nUPDATE accounts SET bal = bal + :amt WHERE id = :to;` },
    { title: 'Inventory drifts: warehouse counts never match the DB',
      symptom: 'Stock levels are slowly too high. No errors in the logs.',
      diagnose: `-- code review: read-modify-write in Java\nProduct p = repo.findById(id);  p.setStock(p.getStock() - qty);  repo.save(p);`,
      cause: 'Concurrent orders read the same stock and each wrote back its own result: lost updates. No version column, no lock.',
      fix: 'Add <code>@Version</code> and a retry, or replace it with an atomic SQL decrement that also enforces the floor.',
      fixCode: `UPDATE product SET stock = stock - :qty\nWHERE id = :id AND stock >= :qty;   -- 0 rows → out of stock` },
    { title: 'Optimistic lock storm on a “views” counter',
      symptom: 'After adding @Version to <code>Article</code>, 70% of view-count increments fail with ObjectOptimistic<wbr>LockingFailureException at peak.',
      diagnose: `SELECT calls, mean_exec_time, query FROM pg_stat_statements\nWHERE query LIKE 'update article%' ORDER BY calls DESC;`,
      cause: 'A hot row with many writers per second is the worst case for optimistic locking: nearly every writer loses the race, retries and loses again.',
      fix: 'Move the counter out of the versioned entity and increment atomically, or buffer increments and flush in batches.',
      fixCode: `@Modifying @Query("update Article a set a.views = a.views + 1 where a.id = :id")\nint incrementViews(@Param("id") long id);` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Alice already saved with version 7. Bob runs this. How many rows come back?', code: `UPDATE product SET stock = 7, version = version + 1 WHERE id = 7 AND version = 7;\nUPDATE product SET stock = 8, version = version + 1 WHERE id = 7 AND version = 7 RETURNING *;`, options: ['0', '1', '2', 'Error: deadlock'], answer: 0, explain: 'The first statement moved the version to 8, so Bob’s <code>AND version = 7</code> matches nothing: <b>0 rows</b>. That count is what JPA turns into OptimisticLockException.' },
    { kind: 'predict', q: 'Final stock?', code: `UPDATE product SET stock = stock - 3 WHERE id = 7 AND stock >= 3;\nUPDATE product SET stock = stock - 9 WHERE id = 7 AND stock >= 9;\nSELECT stock FROM product WHERE id = 7;`, options: ['-2', '1', '7', '10'], answer: 2, explain: '10 − 3 = 7. The second UPDATE needs stock ≥ 9 and matches 0 rows, so the stock stays <b>7</b>. The guard is your oversell protection.' },
    { kind: 'concept', q: 'T1 locks A and waits for B. T2 locks B and then requests A. deadlock_timeout is 1 s. Who normally gets the error?', options: ['Always the younger transaction', 'Always the one that did less work', 'The waiting backend whose timer fires and finds the cycle', 'Both are rolled back'], answer: 2, explain: 'There is no “victim selection” by age or cost. The backend that runs the check (its <code>deadlock_timeout</code> expired while the cycle exists) aborts <b>itself</b>.' },
    { kind: 'concept', q: 'Which change makes a two-row transfer deadlock-free?', options: ['SERIALIZABLE isolation', 'Lower deadlock_timeout', 'Lock both rows in ascending id order first', 'Add a version column'], answer: 2, explain: 'A global lock order makes a cycle impossible. SERIALIZABLE adds a different failure (40001), and a version column doesn’t stop the row locks taken by the UPDATEs.' },
    { kind: 'concept', q: 'Best fit for an admin form that users keep open for 5 minutes?', options: ['PESSIMISTIC_WRITE during the edit', 'Optimistic @Version + “changed by someone else” message', 'SERIALIZABLE transaction around the form', 'Advisory lock per user'], answer: 1, explain: 'Long think time + low contention = <b>optimistic</b>. A pessimistic lock would hold a connection and block writers for minutes.' },
    { kind: 'concept', q: 'Your retry handler catches a deadlock. What should it re-run?', options: ['Only the failed statement', 'The whole transaction, after a short random back-off', 'Nothing: Postgres already retried', 'The failed statement with NOWAIT'], answer: 1, explain: 'The transaction is aborted, and its earlier reads may be stale. Re-run <b>the whole unit of work</b>, with jitter so the two don’t collide again.' }
  ],
  interview: [
    { q: 'How does Postgres detect deadlocks?', a: '<p>Lazily. A backend that has waited for <code>deadlock_timeout</code> builds the wait-for graph from the lock manager and looks for a cycle that includes itself. If it finds one (and can’t fix it by reordering wait queues for soft edges), it aborts its own transaction with 40P01. Checking only after a timeout keeps the common case, short waits, cheap.</p>', fu: 'Can a deadlock involve advisory locks? (Yes, they are heavyweight locks in the same graph.)', lvl: 'deep' },
    { q: 'How do you prevent deadlocks in application code?', a: '<p>Acquire locks in a consistent global order (sort ids, lock parents before children). Lock everything up front with one <code>SELECT … ORDER BY id FOR UPDATE</code>. Keep transactions short. Avoid unordered bulk updates. And always retry 40P01, because some cycles (FKs, unique checks) are hard to rule out.</p>', lvl: 'core' },
    { q: 'Optimistic vs pessimistic locking: when do you use each?', a: '<p><b>Optimistic</b> (version column): low contention, long think time, stateless HTTP (ETags, If-Match). There are no DB locks, so conflicts become retries or user messages. <b>Pessimistic</b> (FOR UPDATE): high contention on a few rows, short server-side transactions, or when a retry is expensive or has side effects. Atomic SQL updates beat both for simple counters.</p>', lvl: 'core' },
    { q: 'How does JPA @Version work, exactly?', a: '<p>Hibernate adds <code>AND version = ?</code> to UPDATE/DELETE and sets <code>version = version + 1</code>. If the JDBC update count is 0, it throws <code>Optimistic<wbr>LockException</code> (Stale<wbr>ObjectState<wbr>Exception), which Spring translates to <code>ObjectOptimistic<wbr>LockingFailureException</code>. Timestamp versions exist but integers are safer.</p>', fu: 'What does LockModeType.<wbr>OPTIMISTIC_<wbr>FORCE_<wbr>INCREMENT do? (Bumps the version even if the entity didn’t change: for aggregate roots.)', lvl: 'core' },
    { q: 'Do you get lost updates in READ COMMITTED with a plain UPDATE … SET x = x + 1?', a: '<p>No. A single-row UPDATE that computes from the current value waits for the row lock, then re-evaluates on the newest committed version. Lost updates come from read-in-the-app, write-back patterns, where the value was computed from a stale read.</p>', lvl: 'core' },
    { q: 'What SQL does a JPA PESSIMISTIC_WRITE lock run in Postgres, and how do you add a timeout?', a: '<p><code>SELECT … FOR UPDATE</code>. The hint <code>jakarta.persistence.lock.timeout</code> = 0 gives NOWAIT, -2 gives SKIP LOCKED. Other values are applied by setting <code>lock_timeout</code> locally. Exceptions: PessimisticLockException / LockTimeoutException, CannotAcquireLockException in Spring.</p>', lvl: 'deep' },
    { q: 'Design a retry policy for transactional work.', a: '<p>Retry on 40P01, 40001 and optimistic failures. Never retry on constraint violations. Re-run the whole transaction with exponential back-off plus jitter, capped at 3–5 attempts. Make the work idempotent: no emails or HTTP calls inside the transaction; use an outbox. The retry must wrap <i>outside</i> <code>@Transactional</code>, otherwise you retry inside an aborted transaction.</p>', lvl: 'deep' },
    { q: 'Can a single UPDATE statement deadlock with another single UPDATE?', a: '<p>Yes. Two multi-row UPDATEs whose scans lock overlapping rows in different orders (different plans, or rows in different physical orders) can form a cycle. Pre-lock in a sorted order or keep batches disjoint.</p>', lvl: 'deep' },
    { q: 'How do you monitor deadlocks in production?', a: '<p><code>pg_stat_database.deadlocks</code> as a counter metric, the server log (full details of every process involved), <code>log_lock_waits = on</code> for near misses, and application metrics for retries by SQLSTATE.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Spring Retry outside the transaction', lang: 'java', code: `@Service
class TransferFacade {
    private final TransferService tx;

    @Retryable(retryFor = { CannotAcquireLockException.class,          // 40P01, lock timeouts
                            PessimisticLockingFailureException.class,
                            ObjectOptimisticLockingFailureException.class },
               maxAttempts = 4,
               backoff = @Backoff(delay = 30, multiplier = 2, random = true))
    public void transfer(long from, long to, BigDecimal amt) {
        tx.transfer(from, to, amt);   // @Transactional lives on TransferService
    }
}`, note: 'The proxy order matters: @Retryable must wrap @Transactional, so each attempt is a fresh transaction.' },
    { title: 'Ordered pessimistic locking in JPA', lang: 'java', code: `@Lock(LockModeType.PESSIMISTIC_WRITE)
@QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "2000"))
@Query("select a from Account a where a.id in :ids order by a.id")
List<Account> lockInOrder(@Param("ids") Collection<Long> ids);

@Transactional
public void transfer(long from, long to, BigDecimal amt) {
    var byId = lockInOrder(List.of(from, to)).stream()
        .collect(toMap(Account::getId, a -> a));
    byId.get(from).debit(amt);
    byId.get(to).credit(amt);
}` },
    { title: 'Optimistic entity', lang: 'java', code: `@Entity
class Product {
    @Id Long id;
    int stock;
    @Version int version;     // Hibernate: ... WHERE id = ? AND version = ?
}` }
  ]
});

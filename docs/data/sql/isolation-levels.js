IA.register({
  track: 'sql',
  slug: 'isolation-levels',
  title: 'Isolation levels',
  tagline: 'Two transactions run at the same time. What may each one see of the other? Postgres answers with <b>snapshots</b> (MVCC): READ COMMITTED takes a new snapshot per statement, REPEATABLE READ keeps one for the whole transaction, and SERIALIZABLE adds conflict tracking that <b>aborts</b> one transaction rather than let an anomaly through.',
  tldr: {
    problem: 'Two requests run the same “check, then write” code at the same moment. Both checks pass, both writes succeed, and the invariant is broken: stock goes negative, nobody is on call, money is counted twice.',
    model: 'Each statement (RC) or transaction (RR, SERIALIZABLE) reads a <b>snapshot</b>: the set of transactions committed when it was taken. Writers lock rows. SERIALIZABLE (SSI) additionally tracks read/write dependencies and fails one transaction with <code>40001</code> when they could form a cycle.',
    hook: 'Postgres’ REPEATABLE READ prevents phantoms, which the SQL standard allows. But it still allows <b>write skew</b>, which only SERIALIZABLE prevents.',
    facts: [
      { v: 'READ COMMITTED', l: 'the default. <code>READ UNCOMMITTED</code> is accepted but behaves exactly like READ COMMITTED: no dirty reads, ever' },
      { v: '40001', l: '<code>serialization_failure</code>. Expected at RR and SERIALIZABLE: the application must <b>retry the whole transaction</b>' },
      { v: 'SSI', l: 'Serializable Snapshot Isolation (PG 9.1+): no extra blocking for reads; conflicts are detected and one transaction is aborted' }
    ]
  },
  intro: {
    what: 'A <b>transaction</b> groups statements so they succeed or fail together. When many transactions run at once, they can interfere: one may read data another is changing. The <b>isolation level</b> decides how much each transaction is shielded from the others. Stronger isolation means fewer surprises, but some transactions get an error and must be retried.',
    analogy: { icon: '📸', title: 'Working from a photo of the whiteboard', text: 'READ COMMITTED: before each question you glance at the whiteboard again, so the answers can change between questions. REPEATABLE READ: you photograph the board when you start and answer everything from the photo. SERIALIZABLE: like the photo, plus a referee who cancels your work if your decisions would have been different had you seen the others’ changes.' },
    steps: [
      { t: 'Start a transaction with a level', d: 'If you don’t specify one, you get READ COMMITTED.', code: 'BEGIN ISOLATION LEVEL REPEATABLE READ;\n-- … statements …\nCOMMIT;' },
      { t: 'Know the anomalies', d: '<b>Non-repeatable read</b>: the same row read twice gives different values. <b>Phantom</b>: the same query returns new rows. <b>Lost update</b>: two writers, one overwrites the other. <b>Write skew</b>: two transactions each check a rule, then change different rows, and together break it.' },
      { t: 'Stronger levels can fail', d: 'At REPEATABLE READ and SERIALIZABLE, Postgres may stop a transaction with <code>ERROR: could not serialize access …</code> (SQLSTATE 40001). That is not a bug: run the whole transaction again.' },
      { t: 'Or lock explicitly', d: 'At READ COMMITTED you can prevent many problems with atomic updates or row locks.', code: 'UPDATE items SET stock = stock - 1\nWHERE id = 1 AND stock > 0;     -- atomic, no lost update' }
    ],
    terms: [
      ['snapshot', 'The set of transactions whose changes a statement or transaction can see.'],
      ['MVCC', 'Multi-Version Concurrency Control: an UPDATE writes a new row version, so readers never block writers.'],
      ['row lock', 'Taken by UPDATE, DELETE and SELECT … FOR UPDATE. A second writer to the same row waits.'],
      ['serialization failure', 'Error 40001: the transaction was aborted to keep the result equivalent to some serial order. Retry it.'],
      ['write skew', 'Two transactions read overlapping data, then write different rows; each is fine alone, together they break a rule.']
    ]
  },
  visual: {
    title: 'Two transactions, side by side',
    caption: 'Pick an anomaly and an isolation level, then press Play. Time flows downward; T1 is on the left, T2 on the right. Red marks the anomaly, orange a wait for a row lock, and a red error box a serialization failure (40001).'
  },
  extras: [
    { id: 'isolation-levels-matrix', title: 'Which anomalies can happen where?', label: 'Matrix', caption: 'The Postgres answer, which differs from the SQL standard table in two cells. Click a cell to jump the timeline above to that combination.' }
  ],
  playground: {
    setup: `
CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance numeric(10,2) NOT NULL CHECK (balance >= 0));
CREATE TABLE items (id int PRIMARY KEY, name text NOT NULL, stock int NOT NULL);
CREATE TABLE doctors (name text PRIMARY KEY, on_call boolean NOT NULL);
INSERT INTO accounts VALUES (1, 'Asha', 100), (2, 'Ben', 100);
INSERT INTO items VALUES (1, 'keyboard', 10);
INSERT INTO doctors VALUES ('alice', true), ('bob', true);`,
    presets: [
      { label: 'Levels', sql: `SHOW default_transaction_isolation;\nBEGIN ISOLATION LEVEL READ UNCOMMITTED;\nSHOW transaction_isolation;   -- accepted, but behaves as READ COMMITTED\nCOMMIT;`, note: 'The playground is one session, so it can’t show two transactions racing. The animation above does that; here you can inspect the mechanics.' },
      { label: 'Row versions', sql: `SELECT xmin, xmax, * FROM accounts;\nUPDATE accounts SET balance = balance - 10 WHERE id = 1;\nSELECT xmin, xmax, * FROM accounts;`, note: 'The UPDATE wrote a <b>new version</b> of Asha’s row with a new <code>xmin</code> (the creating transaction id). Snapshots decide which version each reader sees.' },
      { label: 'Snapshot', sql: `BEGIN ISOLATION LEVEL REPEATABLE READ;\nSELECT * FROM accounts;                 -- the snapshot is taken here, not at BEGIN\nSELECT pg_current_snapshot() AS snapshot, pg_current_xact_id() AS my_xid;\nCOMMIT;`, note: 'A snapshot <code>xmin:xmax:xip_list</code>: transactions below xmin are visible if committed; those in the in-progress list are invisible.' },
      { label: 'Atomic update', sql: `-- read-modify-write in the app can lose updates; this cannot\nUPDATE items SET stock = stock - 1\nWHERE id = 1 AND stock > 0\nRETURNING stock;`, note: 'The row lock plus re-check of <code>stock &gt; 0</code> on the latest version makes this safe at READ COMMITTED.' },
      { label: 'FOR UPDATE', sql: `BEGIN;\nSELECT * FROM items WHERE id = 1 FOR UPDATE;\nSELECT locktype, mode, granted FROM pg_locks WHERE relation = 'items'::regclass;\nCOMMIT;`, note: 'Only a table-level <code>RowShareLock</code> appears. The row lock itself is stored in the row’s header (xmax), not in pg_locks, so millions of row locks cost no shared memory.' },
      { label: 'SSI locks', sql: `BEGIN ISOLATION LEVEL SERIALIZABLE;\nSELECT count(*) FROM doctors WHERE on_call;        -- seq scan\nSELECT * FROM doctors WHERE name = 'alice';        -- index lookup\nSELECT locktype, relation::regclass, page, tuple, mode\nFROM pg_locks WHERE mode = 'SIReadLock';\nCOMMIT;`, note: 'SERIALIZABLE records what you <i>read</i> as SIReadLocks. The seq scan locked the whole <code>doctors</code> relation (coarse: more false conflicts). The index lookup added only a page lock on <code>doctors_pkey</code>; its tuple lock is already covered by the relation lock. Delete the count(*) line to see a tuple lock.' }
    ]
  },
  gotchas: [
    { trap: 'Read-modify-write in Java', code: `int stock = jdbc.queryForObject("SELECT stock FROM items WHERE id = 1", Integer.class);\njdbc.update("UPDATE items SET stock = ? WHERE id = 1", stock - 1);  // lost update at RC`, why: 'Two requests read 10 and both write 9. At READ COMMITTED the second UPDATE waits for the first, then simply overwrites it.', fix: 'Use <code>SET stock = stock - 1</code>, or <code>SELECT … FOR UPDATE</code>, or optimistic locking (<code>@Version</code>), or REPEATABLE READ with retries.' },
    { trap: 'Assuming REPEATABLE READ is serializable', why: 'Postgres’ RR is snapshot isolation. It prevents non-repeatable reads, phantoms and lost updates, but <b>write skew</b> still happens: both transactions read the same rows, then update different ones.', fix: 'Use SERIALIZABLE for invariants that span rows, or materialize the conflict: lock a common row (<code>SELECT … FOR UPDATE</code> on the shift) or add a constraint.' },
    { trap: 'No retry loop', why: 'At RR and SERIALIZABLE, 40001 is a normal outcome under concurrency. Without a retry, users see 500 errors at exactly the busiest moments.', fix: 'Retry the <b>whole</b> transaction (from BEGIN) a few times with jitter. Retry only 40001 and 40P01 (deadlock), never arbitrary errors.' },
    { trap: 'Retrying inside the transaction', why: 'After 40001 the transaction is aborted; every further statement fails with “current transaction is aborted”. Catching the exception inside a <code>@Transactional</code> method and retrying the statement cannot work.', fix: 'Put the retry <b>outside</b> the transaction boundary: the retry interceptor must wrap the transactional proxy.' },
    { trap: 'The RR snapshot starts at the first query, not at BEGIN', code: `BEGIN ISOLATION LEVEL REPEATABLE READ;\n-- (other transactions commit here: visible!)\nSELECT …;  -- snapshot taken now`, why: 'Work done between BEGIN and the first statement is still visible.', fix: 'For an exact snapshot point, run a statement right away, or export and import a snapshot (<code>pg_export_snapshot()</code>).' },
    { trap: 'SERIALIZABLE on a replica, or mixed levels', why: 'SSI only protects transactions that all run at SERIALIZABLE. A READ COMMITTED writer can still create an anomaly that the serializable transactions don’t see. Hot standbys don’t support SERIALIZABLE at all: there the strongest level is REPEATABLE READ.', fix: 'Run every transaction that touches the invariant at SERIALIZABLE. For reports on replicas, use REPEATABLE READ.' },
    { trap: 'Long serializable transactions', why: 'SSI keeps predicate locks and conflict information until overlapping transactions finish. One long transaction increases false-positive aborts for everyone and can exhaust <code>max_pred_locks_per_transaction</code>.', fix: 'Keep serializable transactions short. Mark read-only ones <code>READ ONLY</code>; long reports can use <code>SERIALIZABLE READ ONLY DEFERRABLE</code>, which waits for a safe snapshot and then never fails.' }
  ],
  scenarios: [
    { title: 'On-call schedule: nobody on call on Saturday night',
      symptom: 'The rule is “at least one doctor on call per shift”. Two doctors requested leave at the same moment; both requests were approved, and the shift was empty.',
      diagnose: `-- each request ran:\nSELECT count(*) FROM shifts WHERE shift_id = 42 AND on_call;   -- 2, so I may leave\nUPDATE shifts SET on_call = false WHERE shift_id = 42 AND doctor = :me;`,
      cause: 'Classic <b>write skew</b>. Both transactions saw 2 doctors. They updated <i>different</i> rows, so no row lock conflicted. This happens at READ COMMITTED <i>and</i> REPEATABLE READ.',
      fix: 'Run the request at SERIALIZABLE and retry on 40001. Alternatively, lock the shift row first so the two requests serialize.',
      fixCode: `BEGIN;\nSELECT 1 FROM shift_slots WHERE id = 42 FOR UPDATE;   -- one shared row to lock\nSELECT count(*) FROM shifts WHERE shift_id = 42 AND on_call;\nUPDATE shifts SET on_call = false WHERE shift_id = 42 AND doctor = :me;\nCOMMIT;` },
    { title: 'Flash sale oversold 340 units',
      symptom: 'Stock was 1,000; orders show 1,340 sold. The code checked stock before writing.',
      diagnose: `-- Hibernate: load entity, check, set, flush\nitem = em.find(Item.class, id);\nif (item.getStock() > 0) item.setStock(item.getStock() - 1);\n-- UPDATE items SET stock = ? WHERE id = ?   (value computed in Java)`,
      cause: 'Lost updates at READ COMMITTED. Concurrent requests read the same stock and each wrote “stock − 1” computed from that same stale value.',
      fix: 'Make the decrement atomic and conditional; check the affected row count. Or add <code>@Version</code> for optimistic locking with retries.',
      fixCode: `@Modifying\n@Query("update Item i set i.stock = i.stock - 1 where i.id = :id and i.stock > 0")\nint decrement(@Param("id") long id);   // 0 rows = sold out` },
    { title: 'Moving to SERIALIZABLE: error rate jumps to 4%',
      symptom: 'After switching the payment service to SERIALIZABLE to fix a write-skew bug, 4% of requests fail with <code>could not serialize access due to read/write dependencies among transactions</code>.',
      diagnose: `-- count SQLSTATE 40001 in the application logs / metrics (log_line_prefix with %e shows it in the server log)\nEXPLAIN SELECT … ;   -- Seq Scan → relation-level SIReadLock`,
      cause: 'There was no retry, and the transactions’ queries used sequential scans. A seq scan takes a predicate lock on the whole table, so almost any concurrent write looked like a conflict.',
      fix: 'Add a retry loop around the transaction (3 to 5 attempts with jitter). Add indexes so reads take fine-grained tuple/page locks. Keep transactions short. The failure rate dropped to 0.05%, all retried successfully.' }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does SHOW print, and how does this transaction actually behave?', code: `BEGIN ISOLATION LEVEL READ UNCOMMITTED;\nSHOW transaction_isolation;`, options: ['read uncommitted, and it can see uncommitted rows', 'read uncommitted, but it behaves exactly like READ COMMITTED', 'read committed', 'ERROR: unsupported isolation level'], answer: 1, explain: 'Postgres accepts the name and reports it, but the implementation is READ COMMITTED. MVCC never lets a statement see uncommitted rows of other transactions.' },
    { kind: 'concept', q: 'At REPEATABLE READ, T1 counts 2 on-call doctors, T2 inserts a third one and commits, then T1 counts again. What does T1 see?', options: ['3 (a phantom)', '2', 'T1 gets 40001', 'T1 waits for T2'], answer: 1, explain: 'T1 reads from the snapshot taken at its first query, so new rows are invisible: <b>2</b>. The SQL standard allows phantoms at RR; Postgres does not.' },
    { kind: 'concept', q: 'At REPEATABLE READ, both transactions read stock = 10. T1 updates it to 9 and commits. Then T2 runs <code>UPDATE items SET stock = 9 WHERE id = 1</code>. What happens to T2?', options: ['It overwrites with 9 (lost update)', 'It sees 9 and writes 8', 'ERROR: could not serialize access due to concurrent update', 'It waits forever'], answer: 2, explain: 'T2 tries to update a row version that was changed by a transaction that committed after T2’s snapshot. At RR that is a <b>40001</b> error. At READ COMMITTED it would overwrite (lost update).' },
    { kind: 'concept', q: 'Write skew with the on-call doctors: at which levels can both transactions commit and leave nobody on call?', options: ['READ COMMITTED only', 'READ COMMITTED and REPEATABLE READ', 'All three levels', 'None: row locks prevent it'], answer: 1, explain: 'The two transactions update <i>different</i> rows, so no row lock conflicts, and snapshot isolation (RR) does not detect it. Only <b>SERIALIZABLE</b> aborts one of them.' },
    { kind: 'predict', q: 'Inside a transaction, after <code>SELECT … FOR UPDATE</code> on one row of items, which lock rows on <code>items</code> appear in pg_locks?', code: `BEGIN;\nSELECT * FROM items WHERE id = 1 FOR UPDATE;\nSELECT locktype, mode, granted FROM pg_locks WHERE relation = 'items'::regclass;`, options: ['A tuple lock with mode ExclusiveLock', 'Only a relation-level RowShareLock', 'A relation-level AccessExclusiveLock', 'No rows'], answer: 1, explain: 'Row locks are recorded in the tuple header (xmax plus infomask bits), not in the shared lock table. pg_locks shows only <b>RowShareLock</b> on the table. A tuple lock appears briefly only while another session is <i>waiting</i> for the row.' },
    { kind: 'predict', q: 'At SERIALIZABLE, what SIReadLock does a sequential-scan count(*) on doctors take?', code: `BEGIN ISOLATION LEVEL SERIALIZABLE;\nSELECT count(*) FROM doctors WHERE on_call;\nSELECT locktype, relation::regclass, mode FROM pg_locks WHERE mode = 'SIReadLock';`, options: ['None: reads take no locks', 'One tuple lock per row read', 'One relation-level lock on doctors', 'A page lock per page'], answer: 2, explain: 'A sequential scan reads the whole table, so SSI records a <b>relation-level</b> predicate lock. Any concurrent write to the table is then a potential conflict. Index scans lock only the tuples and index pages they touch.' }
  ],
  interview: [
    { q: 'Which anomalies does each isolation level prevent in Postgres?', a: '<ul><li><b>READ COMMITTED</b>: no dirty reads. Non-repeatable reads, phantoms, lost updates (read-modify-write) and write skew are possible.</li><li><b>REPEATABLE READ</b> (snapshot isolation): also no non-repeatable reads, no phantoms, and concurrent updates of the same row fail with 40001 (no lost updates). Write skew is possible.</li><li><b>SERIALIZABLE</b> (SSI): no anomalies; one transaction fails with 40001 instead.</li></ul>', fu: 'How does this differ from the SQL standard table? (The standard allows phantoms at RR; PG prevents them. PG has no real READ UNCOMMITTED.)', lvl: 'core' },
    { q: 'How does READ COMMITTED handle an UPDATE that finds its row locked by another transaction?', a: '<p>It waits. When the other transaction commits, Postgres re-reads the <b>latest</b> version of the row and re-evaluates the WHERE clause on it (EvalPlanQual). If it still matches, the update is applied to that version. That is why <code>SET stock = stock - 1 WHERE stock &gt; 0</code> is safe, while writing a value computed in the application is not.</p>', fu: 'What surprising result can that re-check give? (Rows that newly match the WHERE are not found; only the originally found rows are re-checked.)', lvl: 'deep' },
    { q: 'Explain snapshot isolation and write skew with an example.', a: '<p>Each transaction sees a consistent snapshot and fails only on write-write conflicts on the same row. Write skew: Alice and Bob are both on call; each transaction checks “count ≥ 2”, then takes itself off call. They write different rows, so there is no write-write conflict, and both commit. The invariant spans rows, so snapshot isolation can’t see the problem.</p>', lvl: 'core' },
    { q: 'How does SSI work in Postgres?', a: '<p>SERIALIZABLE runs on snapshot isolation and additionally records reads as <b>SIReadLocks</b> (predicate locks on tuples, pages or relations). When a write touches something another concurrent transaction read, it records a read-write antidependency. If a transaction ends up with both an incoming and an outgoing rw-dependency (a “dangerous structure”), and the conditions for a cycle are met, one transaction is aborted with 40001. Reads never block. It can produce false positives, so retries are required.</p>', fu: 'Why does a sequential scan increase false positives? (It locks the whole relation.)', lvl: 'deep' },
    { q: 'How do you implement retries for serialization failures in Spring?', a: '<p>The retry must wrap the transaction, so a new transaction starts on each attempt. Use Spring Retry’s <code>@Retryable</code> (or Spring Framework 7’s built-in <code>@Retryable</code>) on a method that calls the <code>@Transactional</code> method, or order the advice so retry is outermost. Retry on <code>ConcurrencyFailureException</code>-type exceptions, to which Spring translates SQLSTATE 40001 and 40P01. Use 3 to 5 attempts with backoff and jitter, and make side effects (emails, Kafka sends) happen after commit.</p>', lvl: 'core' },
    { q: 'Optimistic locking (@Version) vs SERIALIZABLE vs SELECT FOR UPDATE: when to use which?', a: '<ul><li><b>@Version</b>: one entity, conflicts rare, long think time between read and write (HTTP round trips).</li><li><b>FOR UPDATE</b>: short critical sections where you know exactly which row(s) to lock; serializes access and can deadlock if lock order differs.</li><li><b>SERIALIZABLE</b>: invariants across many rows or ranges where you can’t easily name the rows to lock; costs retries.</li></ul>', lvl: 'core' },
    { q: 'What is SERIALIZABLE READ ONLY DEFERRABLE?', a: '<p>A read-only serializable transaction that waits until it can obtain a “safe” snapshot, one that cannot participate in a serialization anomaly. After that it runs without SSI overhead and can never fail with 40001. Good for long reports and pg_dump (<code>--serializable-deferrable</code>).</p>', lvl: 'deep' },
    { q: 'Why can’t a hot standby run SERIALIZABLE?', a: '<p>SSI needs to see the read sets of all concurrent transactions, and the primary doesn’t know what queries on a standby read. So standbys support up to REPEATABLE READ. A query asking for SERIALIZABLE on a standby gets an error.</p>', lvl: 'deep' },
    { q: 'Does REPEATABLE READ make a long report consistent? What does it cost?', a: '<p>Yes: every query in the transaction sees the same snapshot, so totals across tables add up. The cost is that the snapshot holds back the xmin horizon: vacuum cannot remove dead rows newer than it, causing bloat during a long report. Run it on a replica, or keep it reasonably short.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Retry a SERIALIZABLE transaction (Spring Retry)', lang: 'java', code: `@Service
public class LeaveService {
  private final LeaveTx tx;   // separate bean, so retry wraps the transactional proxy

  @Retryable(retryFor = ConcurrencyFailureException.class,    // 40001 / 40P01 after translation
             maxAttempts = 5, backoff = @Backoff(delay = 20, multiplier = 2, random = true))
  public void requestLeave(long shiftId, String doctor) { tx.requestLeave(shiftId, doctor); }
}

@Service
class LeaveTx {
  @Transactional(isolation = Isolation.SERIALIZABLE)
  public void requestLeave(long shiftId, String doctor) {
    int onCall = repo.countOnCall(shiftId);
    if (onCall < 2) throw new BusinessException("last doctor on call");
    repo.goOffCall(shiftId, doctor);
  }
}`, note: 'Each attempt is a fresh transaction. Don’t send emails or events inside it; publish them after commit (e.g. <code>@TransactionalEventListener</code>).' },
    { title: 'Plain JDBC retry loop', lang: 'java', code: `for (int attempt = 1; ; attempt++) {
  try (Connection c = ds.getConnection()) {
    c.setAutoCommit(false);
    c.setTransactionIsolation(Connection.TRANSACTION_SERIALIZABLE);
    doWork(c);
    c.commit();
    return;
  } catch (SQLException e) {
    boolean retryable = "40001".equals(e.getSQLState()) || "40P01".equals(e.getSQLState());
    if (!retryable || attempt == 5) throw e;
    Thread.sleep(ThreadLocalRandom.current().nextLong(10, 20L << attempt));   // jittered backoff
  }
}`, note: 'Closing the connection without commit returns it to Hikari; the pool rolls back the aborted transaction. The error can also come from <code>commit()</code> itself.' }
  ]
});

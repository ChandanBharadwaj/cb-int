IA.register({
  track: 'java',
  slug: 'concurrency-bugs',
  title: 'Concurrency bugs',
  tagline: 'Almost every concurrency bug is one of four shapes: a <b>race</b> (two threads interleave a read-modify-write), a <b>deadlock</b> (a cycle of threads each holding what the next one wants), a <b>livelock</b> (everyone politely retries forever), or <b>contention</b> (correct, but every thread queues on one hot spot). A thread dump tells you which one you have, in minutes.',
  tldr: {
    problem: 'These bugs don’t reproduce on a laptop. Counters drift, stock goes negative, a service freezes once a week, CPU sits at 100% in CAS loops. Logs show nothing, because nothing threw.',
    model: '<b>Race</b>: <code>x++</code> is read, add, write; another thread can slip in between. <b>Deadlock</b>: T1 holds A and waits for B, T2 holds B and waits for A: a cycle in the wait-for graph. <b>Fix the shape</b>: make the operation atomic (CAS, a lock, one SQL statement), acquire locks in one global order, add jitter to retries, and stripe hot counters (<code>LongAdder</code>).',
    hook: '“The service is frozen. What do you do first?” Take three thread dumps a few seconds apart (<code>jcmd &lt;pid&gt; Thread.print</code>). HotSpot prints “Found one Java-level deadlock” for you if it is one; otherwise look for many threads waiting on the same lock or resource.',
    facts: [
      { v: '3 steps', l: 'in <code>count++</code>: load, add, store. Two threads that both load 41 both store 42, and one increment is lost' },
      { v: 'Java 8', l: 'added <code>LongAdder</code>/<code>LongAccumulator</code>: per-thread-ish cells summed on read, far faster than one <code>AtomicLong</code> under heavy write contention' },
      { v: 'automatic', l: 'deadlock detection in thread dumps: <code>jstack</code>/<code>jcmd Thread.print</code> report cycles of monitors and ownable synchronizers (ReentrantLock); <code>ThreadMXBean.findDeadlockedThreads()</code> does the same in code' }
    ]
  },
  intro: {
    what: 'When several threads share data, the order in which their steps interleave changes from run to run. A <b>race condition</b> is a bug that depends on that order. Some races lose data (two deposits, one recorded). Others freeze the program: if two threads each lock one thing and then wait for the other’s, neither can ever continue, a <b>deadlock</b>. These bugs are rare per operation, so they appear only at production volume, which is why you learn to recognise their shapes and read the evidence (thread dumps).',
    analogy: { icon: '🚗', title: 'A four-way stop', text: 'A race is two drivers who both see the junction empty and both pull out. A deadlock is four cars that each wait for the car on their right: perfectly polite, and nobody ever moves. A livelock is two people in a corridor who both step aside to the same side, again and again. Contention is a single toll booth: nothing is broken, but everyone queues.' },
    steps: [
      { t: 'Find the shared mutable state', d: 'Fields of singletons (Spring beans!), static fields, caches, and rows in a database touched by several pods.' },
      { t: 'Make compound actions atomic', d: 'A check followed by an act, or a read followed by a write, must happen as one unit.', code: '// ✗ check-then-act\nif (!cache.containsKey(k)) cache.put(k, load(k));\n// ✓ one atomic operation\ncache.computeIfAbsent(k, this::load);' },
      { t: 'Never wait in a circle', d: 'If code takes two locks, always take them in the same order everywhere. Prefer timeouts to waiting forever.' },
      { t: 'When it happens, take a thread dump', d: 'It shows what every thread is doing and which lock it waits for.', code: 'jcmd <pid> Thread.print -l > dump-1.txt   # repeat 2–3 times, 5 s apart', lang: 'bash' }
    ],
    terms: [
      ['race condition', 'Correctness depends on the timing or interleaving of threads.'],
      ['lost update', 'Two read-modify-write sequences overlap, and one write overwrites the other.'],
      ['deadlock', 'A cycle of threads, each holding a resource the next one is waiting for. No one can proceed.'],
      ['livelock', 'Threads keep changing state in response to each other (retry, back off, retry) without making progress.'],
      ['CAS', 'Compare-and-set: “write new only if the value is still old”, done atomically by the CPU. The base of <code>Atomic*</code>.'],
      ['thread dump', 'A snapshot of every thread’s stack, state and held or awaited locks.']
    ]
  },
  visual: {
    title: 'Watch a lost update, a CAS retry, a deadlock cycle and a striped counter',
    caption: 'Pick a bug and press Play or Step. <b>lost update</b> interleaves two <code>count++</code>; <b>CAS</b> shows <code>AtomicInteger</code> retrying instead. <b>deadlock</b> builds the wait-for cycle and prints the thread dump HotSpot would show. <b>livelock</b> has two polite threads that never progress. <b>LongAdder</b> spreads contention over cells.'
  },
  gotchas: [
    { trap: 'Check-then-act on a thread-safe collection', code: `if (!sessions.containsKey(id)) {      // ConcurrentHashMap
    sessions.put(id, create(id));      // two threads can both get here
}`, why: 'Each call is thread-safe; the <i>sequence</i> isn’t. Between <code>containsKey</code> and <code>put</code>, another thread can do the same check.', fix: 'Use the atomic compound methods: <code>putIfAbsent</code>, <code>computeIfAbsent</code>, <code>compute</code>, <code>merge</code>. Keep the mapping function short and side-effect free.' },
    { trap: 'Lost updates in the database, not just in memory', code: `Product p = repo.findById(id).orElseThrow();   // stock = 5, read by two pods
p.setStock(p.getStock() - 1);                   // both compute 4
repo.save(p);                                   // both write 4: one sale lost`, why: 'The read-modify-write spans two statements and two transactions’ snapshots. Java locks can’t help across pods, and READ COMMITTED doesn’t prevent it.', fix: 'Do it in one statement (<code>UPDATE product SET stock = stock - 1 WHERE id = ? AND stock &gt; 0</code>), use optimistic locking (<code>@Version</code>), or <code>SELECT … FOR UPDATE</code>.' },
    { trap: 'Locks acquired in different orders', why: 'Code path 1 locks account A then B; path 2 (the reverse transfer) locks B then A. Under load, both hold their first lock and wait forever for the second.', fix: 'Impose a global order (lower id first), or use <code>tryLock(timeout)</code> and back off. Never call foreign code (listeners, callbacks) while holding a lock: you don’t know what it locks.' },
    { trap: 'Retrying in lockstep turns a deadlock into a livelock', code: `while (true) {
    if (a.tryLock()) {
        if (b.tryLock()) { try { work(); return; } finally { b.unlock(); a.unlock(); } }
        a.unlock();
    }
    Thread.sleep(10);              // same delay on both threads → same collision every time
}`, why: 'Two threads that collide, back off by the same fixed amount and retry will collide again. CPU is busy, no work is done.', fix: 'Randomised (jittered) back-off, a bounded number of attempts, or simply consistent lock ordering so the collision can’t happen.' },
    { trap: 'Spring singletons with mutable fields', code: `@Service
class ReportService {
    private final List<Row> rows = new ArrayList<>();   // shared by every request thread
    Report build(Query q) { rows.clear(); rows.addAll(load(q)); return render(rows); }
}`, why: 'A <code>@Service</code> is one instance shared by all request threads. Request A’s rows get cleared by request B halfway through rendering.', fix: 'Keep request state in local variables or method parameters. Singleton fields should be immutable dependencies or explicitly thread-safe.' },
    { trap: 'A single hot <code>AtomicLong</code>', why: 'Every increment is a CAS on one cache line. With dozens of cores hammering it, most CASes fail and retry, and the line bounces between cores. Correct, but slow, and it shows up as CPU in <code>getAndAdd</code>.', fix: '<code>LongAdder</code> for counters and sums that are written often and read rarely. Its <code>sum()</code> isn’t an atomic snapshot, which is fine for metrics.' }
  ],
  scenarios: [
    { title: 'Payments freeze roughly once a week',
      symptom: 'A few times a week the transfer endpoint stops responding. Other endpoints work. CPU is low. A restart fixes it.',
      diagnose: `jcmd <pid> Thread.print | sed -n '/Found one Java-level deadlock/,$p'
# Found one Java-level deadlock:
# =============================
# "transfer-7":
#   waiting to lock monitor 0x00007f3a..., (object 0x000000071a2b3c48, a com.acme.Account),
#   which is held by "transfer-3"
# "transfer-3":
#   waiting to lock monitor 0x00007f3a..., (object 0x000000071a2b3c10, a com.acme.Account),
#   which is held by "transfer-7"`,
      cause: '<code>synchronized (from) { synchronized (to) { … } }</code>. A transfer A→B and a simultaneous B→A lock the accounts in opposite orders. Rare, because it needs two opposite transfers between the same pair within microseconds.',
      fix: 'Lock in a consistent order (by account id). Since the balances live in Postgres, the robust fix is to lock the rows in id order inside one transaction and drop the JVM locks entirely, so it also works across pods.',
      fixCode: `@Transactional
public void transfer(long fromId, long toId, BigDecimal amt) {
    List<Account> both = repo.lockByIdsOrdered(List.of(fromId, toId));
    // @Query("select a from Account a where a.id in :ids order by a.id")
    // @Lock(LockModeType.PESSIMISTIC_WRITE)   → SELECT … ORDER BY id FOR UPDATE
    Account from = both.get(0).getId() == fromId ? both.get(0) : both.get(1);
    Account to   = from == both.get(0) ? both.get(1) : both.get(0);
    from.debit(amt);
    to.credit(amt);
}` },
    { title: 'Flash sale oversold 37 units of a 100-unit product',
      symptom: 'During a flash sale, 137 orders were confirmed for a product with 100 units. The code checks stock before decrementing.',
      diagnose: `-- audit: many orders read the same stock value
SELECT stock_seen, count(*) FROM order_audit WHERE sku = 'X1' GROUP BY 1 HAVING count(*) > 1;
--  stock_seen | count
--          12 |     3
--           7 |     2`,
      cause: 'A lost update across four pods: each request read <code>stock</code>, checked it in Java, and saved <code>stock - 1</code>. Concurrent requests read the same value and overwrote each other’s decrement.',
      fix: 'Make the check and the decrement one atomic statement and look at the affected row count. Alternatively add <code>@Version</code> and retry on <code>OptimisticLockException</code>.',
      fixCode: `@Modifying
@Query("update Product p set p.stock = p.stock - :n where p.id = :id and p.stock >= :n")
int reserve(@Param("id") long id, @Param("n") int n);

if (products.reserve(id, qty) == 0) throw new OutOfStockException(id);` },
    { title: 'CPU at 70% in a metrics counter',
      symptom: 'After adding a per-request counter on a 64-core box, CPU usage rose noticeably and throughput dropped. A profiler shows time in <code>AtomicLong.incrementAndGet</code>.',
      diagnose: `# async-profiler, CPU mode
#  31.2%  java.util.concurrent.atomic.AtomicLong.incrementAndGet
#         (lock cmpxchg on one cache line, contended by every request thread)`,
      cause: 'Hundreds of threads incrementing one <code>AtomicLong</code>. Each CAS needs exclusive ownership of the same cache line, so cores queue up for it.',
      fix: 'Switch to <code>LongAdder</code>, which spreads increments over cells (cache-line padded), or use a Micrometer counter, which does that for you.',
      fixCode: `private final LongAdder requests = new LongAdder();

void onRequest() { requests.increment(); }       // mostly uncontended per cell
long total()     { return requests.sum(); }       // adds the cells; not an atomic snapshot` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Two threads, 10,000 increments each, joined. Output?', code: `import java.util.concurrent.atomic.*;

public class Main {
    public static void main(String[] a) throws Exception {
        AtomicInteger n = new AtomicInteger();
        Runnable r = () -> { for (int i = 0; i < 10_000; i++) n.incrementAndGet(); };
        Thread t1 = new Thread(r), t2 = new Thread(r);
        t1.start(); t2.start();
        t1.join(); t2.join();
        System.out.println(n.get());
    }
}`, options: ['20000', 'Somewhere between 10000 and 20000', '10000', 'It varies from run to run'], answer: 0, run: true, expect: '20000', explain: '<code>incrementAndGet</code> is an atomic CAS loop, and <code>join()</code> makes both threads’ results visible to main. Always <b>20000</b>. With a plain or volatile <code>int</code> and <code>n++</code>, the result could be lower and would vary per run.' },
    { kind: 'predict', q: 'Atomic return values. What does this print?', code: `import java.util.concurrent.atomic.*;

public class Main {
    public static void main(String[] args) {
        AtomicInteger a = new AtomicInteger();
        int x = a.getAndIncrement();
        int y = a.incrementAndGet();
        boolean swapped = a.compareAndSet(5, 10);
        int z = a.updateAndGet(v -> v * 3);
        System.out.println(x + " " + y + " " + swapped + " " + z);
    }
}`, options: ['1 2 false 6', '0 2 false 6', '0 2 true 30', '0 1 false 3'], answer: 1, run: true, expect: '0 2 false 6', explain: '<code>getAndIncrement</code> returns the old value (<b>0</b>), <code>incrementAndGet</code> the new one (<b>2</b>). <code>compareAndSet(5, 10)</code> fails because the value is 2: <b>false</b>, and nothing changes. <code>updateAndGet</code> applies the function atomically: 2 × 3 = <b>6</b>. Keep <code>updateAndGet</code> functions side-effect free: under contention they may run more than once.' },
    { kind: 'predict', q: 'Two threads lock the same two monitors in opposite orders, forced to collide. What does the detector report?', code: `import java.lang.management.*;
import java.util.*;
import java.util.concurrent.*;

public class Main {
    public static void main(String[] args) throws Exception {
        Object a = new Object(), b = new Object();
        CountDownLatch bothLocked = new CountDownLatch(2);
        Thread t1 = new Thread(() -> lockBoth(a, b, bothLocked), "t1");
        Thread t2 = new Thread(() -> lockBoth(b, a, bothLocked), "t2");
        t1.setDaemon(true); t2.setDaemon(true);
        t1.start(); t2.start();

        ThreadMXBean mx = ManagementFactory.getThreadMXBean();
        long[] ids = null;
        for (int i = 0; i < 500 && ids == null; i++) { Thread.sleep(10); ids = mx.findDeadlockedThreads(); }
        List<String> out = new ArrayList<>();
        for (ThreadInfo ti : mx.getThreadInfo(ids)) out.add(ti.getThreadName() + " waits for " + ti.getLockOwnerName());
        Collections.sort(out);
        System.out.println(out);
    }

    static void lockBoth(Object first, Object second, CountDownLatch latch) {
        synchronized (first) {
            latch.countDown();
            try { latch.await(); } catch (InterruptedException e) { return; }
            synchronized (second) { System.out.println("unreachable"); }
        }
    }
}`, options: ['[]', '[t1 waits for t2, t2 waits for t1]', 'unreachable, then []', 'The program hangs forever'], answer: 1, run: true, expect: '[t1 waits for t2, t2 waits for t1]', explain: 'The latch guarantees both threads hold their first lock before either asks for the second, so the cycle always forms. <code>findDeadlockedThreads()</code> finds cycles of monitors and ownable synchronizers and reports both threads. The threads are daemons, so the JVM still exits after main. This is the same analysis <code>jstack</code> prints as “Found one Java-level deadlock”.' },
    { kind: 'predict', q: 'LongAdder across threads. Output?', code: `import java.util.concurrent.atomic.*;

public class Main {
    public static void main(String[] args) throws Exception {
        LongAdder hits = new LongAdder();
        Thread[] ts = new Thread[4];
        for (int i = 0; i < ts.length; i++) {
            ts[i] = new Thread(() -> { for (int j = 0; j < 1000; j++) hits.increment(); });
            ts[i].start();
        }
        for (Thread t : ts) t.join();
        System.out.println(hits.sum() + " " + hits.sumThenReset() + " " + hits.sum());
    }
}`, options: ['4000 4000 0', '4000 0 0', '1000 1000 0', 'Varies: LongAdder is approximate'], answer: 0, run: true, expect: '4000 4000 0', explain: 'LongAdder is exact once writers have stopped (here, after <code>join</code>): <b>4000</b>. <code>sumThenReset()</code> returns the sum and zeroes the cells, so the last <code>sum()</code> is <b>0</b>. It is only “approximate” while increments are still running, because <code>sum()</code> reads the cells one by one.' },
    { kind: 'concept', q: 'A thread dump shows 180 threads <code>BLOCKED (on object monitor)</code>, all “waiting to lock &lt;0x…a8&gt;”, and one thread RUNNABLE in <code>socketRead0</code> that has “locked &lt;0x…a8&gt;”. What is this?', options: ['A deadlock', 'Lock contention: one thread does slow I/O while holding a lock everyone needs', 'A livelock', 'A JVM bug'], answer: 1, explain: 'There is no cycle: the owner isn’t waiting for any of the blocked threads, it is waiting for the network. That is <b>contention</b> caused by I/O inside a critical section. Fix: move the I/O out of the lock, narrow the lock, or add a timeout to the call.' },
    { kind: 'concept', q: 'Two threads both use <code>tryLock()</code>, release on failure, sleep exactly 10 ms and retry. They collide every time. What is this called, and what fixes it?', options: ['Deadlock; restart the JVM', 'Livelock; randomise the back-off or impose a lock order', 'Starvation; use a fair lock', 'A race; add volatile'], answer: 1, explain: 'Both threads stay active and keep reacting to each other without progress: a <b>livelock</b>. Random jitter breaks the symmetry; a consistent lock order removes the collision entirely.' },
    { kind: 'concept', q: '<code>Map&lt;String, Integer&gt; counts = new ConcurrentHashMap&lt;&gt;()</code>. Which update is safe under concurrency?', options: ['counts.put(k, counts.get(k) + 1)', 'counts.put(k, counts.getOrDefault(k, 0) + 1)', 'counts.merge(k, 1, Integer::sum)', 'synchronized (k) { counts.put(k, counts.get(k) + 1); }'], answer: 2, explain: '<code>merge</code> performs the read-modify-write atomically for that key. The first two are lost-update races (and the first throws NPE on a new key). Synchronizing on the key string doesn’t help: different threads may hold different <code>String</code> objects that are equal but not the same lock.' },
    { kind: 'concept', q: 'Which of the four conditions for deadlock does “always lock accounts in ascending id order” remove?', options: ['Mutual exclusion', 'Hold and wait', 'No preemption', 'Circular wait'], answer: 3, explain: 'The Coffman conditions: mutual exclusion, hold and wait, no preemption, circular wait. A global lock order makes a cycle impossible: a thread can only wait for a lock “higher” than the ones it holds. <code>tryLock</code> with timeout attacks <i>no preemption</i> / <i>hold and wait</i> instead.' }
  ],
  interview: [
    { q: 'What is a race condition? Give a Java example beyond <code>count++</code>.', a: '<p>Correctness depends on how threads interleave. Examples: check-then-act (<code>if (!map.containsKey(k)) map.put(k, v)</code>), lazy initialisation without synchronisation, iterating a <code>HashMap</code> while another thread writes, read-modify-write of a JPA entity across two pods, publishing an object through a plain field. The cure is the same: make the compound action atomic, or confine the state to one thread.</p>', lvl: 'core' },
    { q: 'How do you diagnose a hung Java service?', a: '<ol><li>Take 3 thread dumps ~5 s apart: <code>jcmd &lt;pid&gt; Thread.print -l</code> (or <code>jstack -l</code>, <code>kill -3</code>).</li><li>Look for “Found one Java-level deadlock”.</li><li>Otherwise group threads by state and top frame: many BLOCKED on one monitor → contention; many WAITING in a pool’s <code>getConnection</code> → pool exhaustion; RUNNABLE in socket reads → slow downstream.</li><li>Compare dumps: threads that don’t move are stuck.</li></ol><p>For virtual threads use <code>jcmd &lt;pid&gt; Thread.dump_to_file -format=json</code>.</p>', lvl: 'core' },
    { q: 'What are the conditions for deadlock and how do you prevent it?', a: '<p>Coffman: mutual exclusion, hold-and-wait, no preemption, circular wait. Practical prevention: a <b>global lock order</b> (removes circular wait); <code>tryLock(timeout)</code> with back-off (gives up instead of waiting forever); acquiring everything at once; and never calling unknown code while holding a lock. In databases, lock rows in a consistent order and let the DB’s deadlock detector abort a victim.</p>', lvl: 'core' },
    { q: 'Deadlock vs livelock vs starvation?', a: '<ul><li><b>Deadlock</b>: threads block forever in a cycle; CPU idle.</li><li><b>Livelock</b>: threads keep running and reacting (retrying, backing off) but make no progress; CPU busy.</li><li><b>Starvation</b>: the system progresses, but some thread never gets the resource (e.g. barging on a non-fair lock, or a low-priority writer behind constant readers).</li></ul>', lvl: 'core' },
    { q: 'How does <code>AtomicInteger.incrementAndGet</code> work?', a: '<p>A loop around compare-and-set: read the current value, compute value + 1, and CAS it in only if the field still holds the value read. If another thread changed it, retry. On x86 it compiles to a single <code>lock xadd</code>; CAS itself is <code>lock cmpxchg</code>. It is lock-free (some thread always progresses) but not wait-free, and under heavy contention retries and cache-line traffic dominate.</p>', fu: 'What is the ABA problem? (A value changes A→B→A between read and CAS, so CAS succeeds wrongly. <code>AtomicStampedReference</code> adds a version.)', lvl: 'deep' },
    { q: 'When do you use LongAdder instead of AtomicLong?', a: '<p>For counters and sums that are updated by many threads and read rarely: request counts, bytes processed, metrics. LongAdder keeps a base value plus an array of padded cells; a thread that fails a CAS on one cell moves to another, so contention spreads out. <code>sum()</code> adds them up without locking, so it isn’t an atomic snapshot under concurrent writes. Use AtomicLong when you need the exact value with each update (ids, sequence numbers) or CAS semantics.</p>', lvl: 'core' },
    { q: 'What does a thread dump entry tell you?', a: '<p>The thread’s name, whether it is a daemon, its state (<code>java.lang.Thread.State</code>), the stack, and lock information: <code>- locked &lt;0x…&gt;</code> (monitors held), <code>- waiting to lock &lt;0x…&gt;</code> (BLOCKED on a monitor), <code>- parking to wait for &lt;0x…&gt; (a ReentrantLock$NonfairSync)</code> (j.u.c. lock or condition), and with <code>-l</code>, “Locked ownable synchronizers”. Matching addresses connect waiters to owners.</p>', lvl: 'core' },
    { q: 'How do you find a deadlock programmatically?', a: '<p><code>ManagementFactory.getThreadMXBean().findDeadlockedThreads()</code> returns the ids of threads in cycles involving monitors or ownable synchronizers (<code>findMonitorDeadlockedThreads</code> covers monitors only). <code>getThreadInfo(ids, true, true)</code> gives stacks and lock owners. You can expose it as a Spring Boot Actuator health indicator or a periodic check that logs a dump when a cycle appears.</p>', lvl: 'deep' },
    { q: 'Is <code>ConcurrentHashMap</code> enough to make a cache thread-safe?', a: '<p>Each operation is atomic, but sequences aren’t. Use <code>computeIfAbsent</code> for “load once”, <code>merge</code> or <code>compute</code> for updates. Watch out: the mapping function runs while a bin is locked, so it must be short and must not update the same map (it can deadlock, or throw <code>IllegalStateException: Recursive update</code>). Values must be immutable or thread-safe themselves. For real caches with eviction, use Caffeine.</p>', lvl: 'deep' },
    { q: 'How do race conditions show up with Spring and JPA?', a: '<p>In memory: mutable fields on singleton beans shared by request threads. In the database: read-modify-write across transactions (two requests load an entity, both modify, both save, the last commit wins). Fixes: atomic UPDATE statements, <code>@Version</code> optimistic locking with retry, <code>PESSIMISTIC_WRITE</code> (<code>FOR UPDATE</code>), unique constraints for “insert if absent”, and idempotency keys for retried requests.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Capture and read thread dumps', lang: 'bash', code: `# three dumps, five seconds apart (with ownable synchronizers)
for i in 1 2 3; do jcmd "$PID" Thread.print -l > "dump-$i.txt"; sleep 5; done

# in Kubernetes
kubectl exec "$POD" -- jcmd 1 Thread.print -l > dump.txt

# quick triage: threads per state, and the hottest top frames
grep -h 'java.lang.Thread.State' dump-*.txt | sort | uniq -c | sort -rn
grep -h -A1 'java.lang.Thread.State: BLOCKED' dump-1.txt | grep 'at ' | sort | uniq -c | sort -rn | head

# virtual threads (Java 21): plain jstack doesn't list unmounted ones
jcmd "$PID" Thread.dump_to_file -format=json /tmp/threads.json`, note: 'If <code>jcmd</code> can’t attach (different user, container without a JDK), <code>kill -3 &lt;pid&gt;</code> prints the dump to the JVM’s stdout.' },
    { title: 'A deadlock health indicator (Spring Boot Actuator)', lang: 'java', code: `@Component
class DeadlockHealthIndicator implements HealthIndicator {
    private final ThreadMXBean mx = ManagementFactory.getThreadMXBean();

    @Override
    public Health health() {
        long[] ids = mx.findDeadlockedThreads();           // monitors + ReentrantLocks
        if (ids == null) return Health.up().build();
        List<String> cycle = Arrays.stream(mx.getThreadInfo(ids, true, true))
                .map(ti -> ti.getThreadName() + " waits for " + ti.getLockName()
                           + " held by " + ti.getLockOwnerName())
                .toList();
        return Health.down().withDetail("deadlocked", cycle).build();
    }
}`, note: 'Keep it out of the liveness probe unless you want Kubernetes to restart deadlocked pods automatically. That is sometimes the right call, but take a dump first.' },
    { title: 'Atomic updates without locks', lang: 'java', code: `// counters and sums: striped, cheap under contention
private final LongAdder bytesIn = new LongAdder();
bytesIn.add(frame.length);

// max seen so far
private final LongAccumulator maxLatency = new LongAccumulator(Long::max, 0);
maxLatency.accumulate(elapsedMicros);

// immutable state swapped atomically (function may be retried: keep it pure)
private final AtomicReference<Limits> limits = new AtomicReference<>(Limits.DEFAULT);
limits.updateAndGet(l -> l.withMaxRps(l.maxRps() + 100));

// per-key atomic updates
private final ConcurrentHashMap<String, LongAdder> perTenant = new ConcurrentHashMap<>();
perTenant.computeIfAbsent(tenant, t -> new LongAdder()).increment();` }
  ]
});

IA.register({
  track: 'java',
  slug: 'concurrency-bugs',
  title: 'Concurrency bugs',
  tagline: 'Almost every concurrency bug has one of four shapes. A <b>race</b>: two threads mix up the steps of read, change, write. A <b>deadlock</b>: a loop of threads, each holding what the next one wants. A <b>livelock</b>: everyone politely retries forever. <b>Contention</b>: correct, but every thread queues at one hot spot. A thread dump tells you which one you have, in minutes.',
  tldr: {
    problem: 'These bugs don’t reproduce on a laptop. Counters drift, stock goes negative, a service freezes once a week, CPU sits at 100% in CAS loops. Logs show nothing, because nothing threw.',
    model: '<b>Race</b>: <code>x++</code> is read, add, write. Another thread can slip in between. <b>Deadlock</b>: T1 holds A and waits for B. T2 holds B and waits for A. That is a loop. <b>Fix the shape</b>: make the step happen all at once (CAS, a lock, one SQL statement). Take locks in one fixed order. Add random delays to retries. Split hot counters (<code>LongAdder</code>).',
    hook: '“The service is frozen. What do you do first?” Take three thread dumps a few seconds apart (<code>jcmd &lt;pid&gt; Thread.print</code>). If it is a deadlock, the JVM prints “Found one Java-level deadlock” for you. Otherwise, look for many threads waiting on the same lock or resource.',
    facts: [
      { v: '3 steps', l: 'in <code>count++</code>: load, add, store. Two threads that both load 41 both store 42, and one increment is lost' },
      { v: 'Java 8', l: 'added <code>LongAdder</code>/<code>LongAccumulator</code>. Threads write to separate cells, added up on read. Far faster than one <code>AtomicLong</code> when many threads write' },
      { v: 'automatic', l: 'deadlock detection in thread dumps. <code>jstack</code>/<code>jcmd Thread.print</code> report lock loops, for <code>synchronized</code> and ReentrantLock. <code>ThreadMXBean.findDeadlockedThreads()</code> does the same in code' }
    ]
  },
  intro: {
    what: 'When threads share data, the order of their steps changes from run to run. A bug that depends on that order is a <b>race condition</b>. Some races lose data: two deposits, one recorded. Others freeze the program. Two threads each lock one thing, then wait for the other’s. Neither can continue: a <b>deadlock</b>. These bugs are rare per call, so they show up only at production volume. So you learn their shapes and how to read thread dumps.',
    analogy: { icon: '🚗', title: 'A four-way stop', text: 'A race is two drivers who both see the junction empty and both pull out. A deadlock is four cars, each waiting for the car on its right. Perfectly polite, and nobody moves. A livelock is two people in a corridor who step aside the same way, again and again. Contention is a single toll booth. Nothing is broken, but everyone queues.' },
    steps: [
      { t: 'Find the shared mutable state', d: 'Fields of singletons (Spring beans!), static fields, caches, and database rows that several pods touch.' },
      { t: 'Make compound actions atomic', d: 'A check and the action after it, or a read and the write after it, must happen as one unit.', code: '// ✗ check-then-act\nif (!cache.containsKey(k)) cache.put(k, load(k));\n// ✓ one atomic operation\ncache.computeIfAbsent(k, this::load);' },
      { t: 'Never wait in a circle', d: 'If code takes two locks, take them in the same order everywhere. Prefer timeouts to waiting forever.' },
      { t: 'When it happens, take a thread dump', d: 'It shows what every thread is doing and which lock it waits for.', code: 'jcmd <pid> Thread.print -l > dump-1.txt   # repeat 2–3 times, 5 s apart', lang: 'bash' }
    ],
    terms: [
      ['race condition', 'The result depends on the timing or order of threads’ steps.'],
      ['lost update', 'Two read-change-write sequences overlap, and one write wipes out the other.'],
      ['deadlock', 'A loop of threads, each holding what the next one waits for. Nobody can move.'],
      ['livelock', 'Threads keep reacting to each other (retry, back off, retry) but get nowhere.'],
      ['CAS', 'Compare-and-set: “write the new value only if the old one is still there”. The CPU does it in one step. <code>Atomic*</code> classes build on it.'],
      ['thread dump', 'A snapshot of every thread’s stack, state and held or awaited locks.']
    ]
  },
  visual: {
    title: 'Watch a lost update, a CAS retry, a deadlock cycle and a striped counter',
    caption: 'Pick a bug and press Play or Step. <b>lost update</b> mixes the steps of two <code>count++</code>. <b>CAS</b> shows <code>AtomicInteger</code> retrying instead. <b>deadlock</b> builds the waiting loop and shows the thread dump you would see. <b>livelock</b> has two polite threads that never progress. <b>LongAdder</b> spreads the load over cells.'
  },
  gotchas: [
    { trap: 'Check-then-act on a thread-safe collection', code: `if (!sessions.containsKey(id)) {      // ConcurrentHashMap
    sessions.put(id, create(id));      // two threads can both get here
}`, why: 'Each call is thread-safe. The <i>sequence</i> isn’t. Between <code>containsKey</code> and <code>put</code>, another thread can make the same check.', fix: 'Use the methods that do the whole job in one step: <code>putIfAbsent</code>, <code>computeIfAbsent</code>, <code>compute</code>, <code>merge</code>. Keep the function you pass short, with no side effects.' },
    { trap: 'Lost updates in the database, not just in memory', code: `Product p = repo.findById(id).orElseThrow();   // stock = 5, read by two pods
p.setStock(p.getStock() - 1);                   // both compute 4
repo.save(p);                                   // both write 4: one sale lost`, why: 'The read and the write are two statements, in two transactions. Java locks can’t help across pods. READ COMMITTED doesn’t stop it either.', fix: 'Do it in one statement (<code>UPDATE product SET stock = stock - 1 WHERE id = ? AND stock &gt; 0</code>). Or use a version column (<code>@Version</code>). Or <code>SELECT … FOR UPDATE</code>.' },
    { trap: 'Locks acquired in different orders', why: 'Path 1 locks account A, then B. Path 2 (the reverse transfer) locks B, then A. Under load, each holds its first lock and waits forever for the second.', fix: 'Use one fixed order (lower id first). Or use <code>tryLock(timeout)</code> and back off. Never call outside code (listeners, callbacks) while holding a lock. You don’t know what it locks.' },
    { trap: 'Retrying in lockstep turns a deadlock into a livelock', code: `while (true) {
    if (a.tryLock()) {
        if (b.tryLock()) { try { work(); return; } finally { b.unlock(); a.unlock(); } }
        a.unlock();
    }
    Thread.sleep(10);              // same delay on both threads → same collision every time
}`, why: 'Two threads collide, wait the same fixed time, and retry. They collide again. CPU is busy, but no work gets done.', fix: 'Wait a random time before retrying. Limit the attempts. Or use a fixed lock order, so the collision can’t happen.' },
    { trap: 'Spring singletons with mutable fields', code: `@Service
class ReportService {
    private final List<Row> rows = new ArrayList<>();   // shared by every request thread
    Report build(Query q) { rows.clear(); rows.addAll(load(q)); return render(rows); }
}`, why: 'A <code>@Service</code> is one object shared by all request threads. Request B clears request A’s rows halfway through rendering.', fix: 'Keep request data in local variables or parameters. Singleton fields should never change, or be thread-safe by design.' },
    { trap: 'A single hot <code>AtomicLong</code>', why: 'Every increment is a CAS on one spot in memory. With dozens of cores hitting it, most CASes fail and retry. The memory bounces between cores. Correct, but slow. It shows up as CPU time in <code>getAndAdd</code>.', fix: 'Use <code>LongAdder</code> for counters written often and read rarely. Its <code>sum()</code> isn’t an exact snapshot. That is fine for metrics.' }
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
      cause: '<code>synchronized (from) { synchronized (to) { … } }</code>. Transfers A→B and B→A at the same time lock the accounts in opposite orders. It is rare: it needs two opposite transfers between the same pair within microseconds.',
      fix: 'Lock in a consistent order (by account id). The balances live in Postgres. So the solid fix is to lock the rows in id order in one transaction and drop the JVM locks. That also works across pods.',
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
      cause: 'A lost update across four pods. Each request read <code>stock</code>, checked it in Java, and saved <code>stock - 1</code>. Requests at the same moment read the same value and overwrote each other.',
      fix: 'Make the check and the decrement one statement, and look at the count of changed rows. Or add <code>@Version</code> and retry on <code>OptimisticLockException</code>.',
      fixCode: `@Modifying
@Query("update Product p set p.stock = p.stock - :n where p.id = :id and p.stock >= :n")
int reserve(@Param("id") long id, @Param("n") int n);

if (products.reserve(id, qty) == 0) throw new OutOfStockException(id);` },
    { title: 'CPU at 70% in a metrics counter',
      symptom: 'After adding a per-request counter on a 64-core machine, CPU use rose and throughput dropped. A profiler shows time in <code>AtomicLong.incrementAndGet</code>.',
      diagnose: `# async-profiler, CPU mode
#  31.2%  java.util.concurrent.atomic.AtomicLong.incrementAndGet
#         (lock cmpxchg on one cache line, contended by every request thread)`,
      cause: 'Hundreds of threads add to one <code>AtomicLong</code>. Each CAS needs sole access to the same spot in memory, so cores queue for it.',
      fix: 'Switch to <code>LongAdder</code>, which spreads increments over separate cells. Or use a Micrometer counter, which does that for you.',
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
}`, options: ['20000', 'Somewhere between 10000 and 20000', '10000', 'It varies from run to run'], answer: 0, run: true, expect: '20000', explain: '<code>incrementAndGet</code> is a CAS loop, so each add happens in one step. <code>join()</code> makes both threads’ work visible to main. Always <b>20000</b>. With a plain or volatile <code>int</code> and <code>n++</code>, the result could be lower, and change per run.' },
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
}`, options: ['1 2 false 6', '0 2 false 6', '0 2 true 30', '0 1 false 3'], answer: 1, run: true, expect: '0 2 false 6', explain: '<code>getAndIncrement</code> returns the old value (<b>0</b>), <code>incrementAndGet</code> the new one (<b>2</b>). <code>compareAndSet(5, 10)</code> fails because the value is 2: <b>false</b>, and nothing changes. <code>updateAndGet</code> applies the function in one step: 2 × 3 = <b>6</b>. Keep those functions free of side effects. Under load they may run more than once.' },
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
}`, options: ['[]', '[t1 waits for t2, t2 waits for t1]', 'unreachable, then []', 'The program hangs forever'], answer: 1, run: true, expect: '[t1 waits for t2, t2 waits for t1]', explain: 'The latch makes both threads hold their first lock before either asks for the second. So the loop always forms. <code>findDeadlockedThreads()</code> finds such loops and reports both threads. They are daemon threads, so the JVM still exits after main. This is the same analysis <code>jstack</code> prints as “Found one Java-level deadlock”.' },
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
}`, options: ['4000 4000 0', '4000 0 0', '1000 1000 0', 'Varies: LongAdder is approximate'], answer: 0, run: true, expect: '4000 4000 0', explain: 'LongAdder is exact once writers stop (here, after <code>join</code>): <b>4000</b>. <code>sumThenReset()</code> returns the sum and zeroes the cells, so the last <code>sum()</code> is <b>0</b>. It is only “approximate” while adds are still running, because <code>sum()</code> reads the cells one by one.' },
    { kind: 'concept', q: 'A thread dump shows 180 threads <code>BLOCKED (on object monitor)</code>, all “waiting to lock &lt;0x…a8&gt;”, and one thread RUNNABLE in <code>socketRead0</code> that has “locked &lt;0x…a8&gt;”. What is this?', options: ['A deadlock', 'Lock contention: one thread does slow I/O while holding a lock everyone needs', 'A livelock', 'A JVM bug'], answer: 1, explain: 'There is no loop. The owner isn’t waiting for the blocked threads. It waits for the network. That is <b>contention</b>, caused by I/O while holding a lock. Fix: move the I/O out of the lock, narrow the lock, or add a timeout to the call.' },
    { kind: 'concept', q: 'Two threads both use <code>tryLock()</code>, release on failure, sleep exactly 10 ms and retry. They collide every time. What is this called, and what fixes it?', options: ['Deadlock; restart the JVM', 'Livelock; randomise the back-off or impose a lock order', 'Starvation; use a fair lock', 'A race; add volatile'], answer: 1, explain: 'Both threads stay busy, reacting to each other, but get nowhere: a <b>livelock</b>. A random delay breaks the tie. A fixed lock order removes the collision entirely.' },
    { kind: 'concept', q: '<code>Map&lt;String, Integer&gt; counts = new ConcurrentHashMap&lt;&gt;()</code>. Which update is safe under concurrency?', options: ['counts.put(k, counts.get(k) + 1)', 'counts.put(k, counts.getOrDefault(k, 0) + 1)', 'counts.merge(k, 1, Integer::sum)', 'synchronized (k) { counts.put(k, counts.get(k) + 1); }'], answer: 2, explain: '<code>merge</code> does the read, change and write in one step for that key. The first two lose updates (and the first throws NPE on a new key). Locking on the key string doesn’t help. Two threads may hold equal <code>String</code>s that are different objects, so different locks.' },
    { kind: 'concept', q: 'Which of the four conditions for deadlock does “always lock accounts in ascending id order” remove?', options: ['Mutual exclusion', 'Hold and wait', 'No preemption', 'Circular wait'], answer: 3, explain: 'The four (Coffman) conditions: one owner at a time, hold and wait, no taking locks away, circular wait. A fixed lock order makes a loop impossible. A thread can only wait for a lock “higher” than those it holds. <code>tryLock</code> with timeout attacks <i>no taking away</i> / <i>hold and wait</i> instead.' }
  ],
  interview: [
    { q: 'What is a race condition? Give a Java example beyond <code>count++</code>.', a: '<p>The result depends on the order of threads’ steps. Examples: check-then-act (<code>if (!map.containsKey(k)) map.put(k, v)</code>). Lazy setup without locking. Looping over a <code>HashMap</code> while another thread writes. Read-change-write of a JPA entity across two pods. Sharing an object through a plain field. The cure is the same: make the multi-step action one step, or keep the data on one thread.</p>', lvl: 'core' },
    { q: 'How do you diagnose a hung Java service?', a: '<ol><li>Take 3 thread dumps ~5 s apart: <code>jcmd &lt;pid&gt; Thread.print -l</code> (or <code>jstack -l</code>, <code>kill -3</code>).</li><li>Look for “Found one Java-level deadlock”.</li><li>Otherwise group threads by state and top frame. Many BLOCKED on one monitor → contention. Many WAITING in a pool’s <code>getConnection</code> → pool used up. RUNNABLE in socket reads → slow downstream.</li><li>Compare dumps: threads that don’t move are stuck.</li></ol><p>For virtual threads, use <code>jcmd &lt;pid&gt; Thread.dump_to_file -format=json</code>.</p>', lvl: 'core' },
    { q: 'What are the conditions for deadlock and how do you prevent it?', a: '<p>Four conditions: one owner at a time, hold and wait, no taking locks away, circular wait. To prevent it: a <b>fixed lock order</b> (no loop can form). <code>tryLock(timeout)</code> with back-off (give up instead of waiting forever). Take everything at once. Never call unknown code while holding a lock. In databases, lock rows in a fixed order, and let the DB abort one side of a deadlock.</p>', lvl: 'core' },
    { q: 'Deadlock vs livelock vs starvation?', a: '<ul><li><b>Deadlock</b>: threads wait forever in a loop. CPU idle.</li><li><b>Livelock</b>: threads keep running and reacting (retry, back off) but get nowhere. CPU busy.</li><li><b>Starvation</b>: work gets done, but one thread never gets its turn. Example: newcomers jumping ahead on a non-fair lock, or a writer stuck behind endless readers.</li></ul>', lvl: 'core' },
    { q: 'How does <code>AtomicInteger.incrementAndGet</code> work?', a: '<p>A loop around compare-and-set (CAS). Read the value, compute value + 1. Write it only if the field still holds the value you read. If another thread changed it, retry. On x86 it becomes one <code>lock xadd</code>. CAS itself is <code>lock cmpxchg</code>. Some thread always makes progress (<i>lock-free</i>), but a given thread may retry many times. Under heavy load, retries dominate.</p>', fu: 'What is the ABA problem? (The value goes A→B→A between your read and your CAS. So the CAS wrongly succeeds. <code>AtomicStampedReference</code> adds a version.)', lvl: 'deep' },
    { q: 'When do you use LongAdder instead of AtomicLong?', a: '<p>For counters that many threads update and few read: request counts, bytes processed, metrics. LongAdder keeps a base value plus an array of cells. A thread that fails a CAS on one cell moves to another, so the load spreads out. <code>sum()</code> adds them up without locking. So during writes it isn’t an exact snapshot. Use AtomicLong when you need the exact value on each update (ids, sequence numbers), or CAS.</p>', lvl: 'core' },
    { q: 'What does a thread dump entry tell you?', a: '<p>The thread’s name, whether it is a daemon, its state (<code>java.lang.Thread.State</code>), the stack, and its locks: <code>- locked &lt;0x…&gt;</code> (monitors held), <code>- waiting to lock &lt;0x…&gt;</code> (BLOCKED on a monitor), <code>- parking to wait for &lt;0x…&gt; (a ReentrantLock$NonfairSync)</code> (j.u.c. lock or condition), and with <code>-l</code>, “Locked ownable synchronizers”. Matching addresses link waiters to owners.</p>', lvl: 'core' },
    { q: 'How do you find a deadlock programmatically?', a: '<p><code>ManagementFactory.getThreadMXBean().findDeadlockedThreads()</code> returns the ids of threads stuck in lock loops, for both kinds of lock (<code>findMonitorDeadlockedThreads</code> covers only <code>synchronized</code>). <code>getThreadInfo(ids, true, true)</code> gives stacks and lock owners. You can expose it as a Spring Boot Actuator health check. Or run a timed check that logs a dump when a loop appears.</p>', lvl: 'deep' },
    { q: 'Is <code>ConcurrentHashMap</code> enough to make a cache thread-safe?', a: '<p>Each call is safe, but a sequence of calls isn’t. Use <code>computeIfAbsent</code> for “load once”. Use <code>merge</code> or <code>compute</code> for updates. Careful: the function runs while a bin is locked. Keep it short, and don’t update the same map inside it. It can deadlock or throw <code>IllegalStateException: Recursive update</code>. Values must never change, or be thread-safe. For real caches with eviction, use Caffeine.</p>', lvl: 'deep' },
    { q: 'How do race conditions show up with Spring and JPA?', a: '<p>In memory: changeable fields on singleton beans that request threads share. In the database: read-change-write across transactions. Two requests load an entity, both change it, both save. The last commit wins. Fixes: one-statement UPDATEs, <code>@Version</code> with retry, <code>PESSIMISTIC_WRITE</code> (<code>FOR UPDATE</code>), unique constraints for “insert if absent”, and request ids so retries run once.</p>', lvl: 'core' }
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

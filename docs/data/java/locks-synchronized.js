IA.register({
  track: 'java',
  slug: 'locks-synchronized',
  title: 'Locks & synchronized',
  tagline: 'Every Java object has a built-in lock (a <b>monitor</b>). It has one owner, a line of threads waiting to get in (the <i>entry set</i>), and a room for threads that called <code>wait()</code> (the <i>wait set</i>). <code>ReentrantLock</code>, <code>ReadWriteLock</code> and <code>StampedLock</code> are the same idea built on a queue (AQS). They add timeouts, interruption, several conditions and shared modes.',
  tldr: {
    problem: 'Lock bugs show up as hangs, lost wake-ups, slowdowns when many threads compete, or threads that never get a turn. Many come from small mistakes: <code>if</code> instead of <code>while</code> around <code>wait()</code>, a forgotten <code>unlock()</code>, a lock upgrade that deadlocks, or a JVM lock expected to work across pods.',
    model: '<code>synchronized</code> means: enter the monitor, run, exit. While another thread owns it, you are BLOCKED. <code>wait()</code> gives the monitor back and sleeps in the wait set. <code>notify</code> moves a waiter back to the entry set, where it must win the lock again. <code>Lock</code> does the same with a first-come queue, plus one queue per <code>Condition</code>.',
    hook: '“Why must <code>wait()</code> be in a <code>while</code> loop?” A woken thread must compete for the monitor again. By the time it gets in, another thread may have taken the item. Threads can also wake for no reason (<i>spurious wake-ups</i>).',
    facts: [
      { v: 'Java 5', l: '<code>java.util.concurrent.locks</code> (JSR-166): ReentrantLock, Condition, ReentrantReadWriteLock, all built on AbstractQueuedSynchronizer. <code>StampedLock</code> came in Java 8' },
      { v: 'non-fair', l: 'is the default for <code>ReentrantLock</code>. <code>synchronized</code> promises no fairness. Fair mode hands the lock over first-come, first-served, but is much slower' },
      { v: 'JDK 24', l: 'stopped <code>synchronized</code> from pinning virtual threads to their carrier. On Java 21, use <code>ReentrantLock</code> around blocking calls on virtual threads' }
    ]
  },
  intro: {
    what: 'When two threads change the same data at once, the result can be garbage. A <b>lock</b> lets only one thread at a time run a piece of code. The others wait their turn. Every Java object has a built-in lock (<code>synchronized</code>). For more control there are explicit locks (<code>ReentrantLock</code> and friends). They add timeouts, giving up, several waiting rooms, and many readers at once.',
    analogy: { icon: '🚻', title: 'A single-occupancy bathroom with a waiting room', text: 'One person holds the key (the owner). Others queue at the door (the entry set). Someone inside finds there is no soap. They hand the key back and sit in a side room (the wait set). They stay there until someone shouts “soap refilled!” (notify). That doesn’t get them in. They join the queue at the door again. Once inside, they should check the soap again: someone else may have used it up.' },
    steps: [
      { t: 'Protect shared state with one lock', d: 'Every read and write of the shared fields goes through the same lock.', code: 'private final Object lock = new Object();\nprivate int balance;\n\nvoid deposit(int x) { synchronized (lock) { balance += x; } }\nint balance()       { synchronized (lock) { return balance; } }' },
      { t: 'Keep the critical section short', d: 'While you hold a lock: no I/O, no remote calls, no calls into unknown code. Everyone else waits for you.' },
      { t: 'Wait for a condition properly', d: 'Hold the lock, check the condition in a <code>while</code> loop, and call <code>wait()</code> (or <code>condition.await()</code>) inside the loop.' },
      { t: 'Use explicit locks when you need their features', d: '<code>tryLock(timeout)</code>, <code>lockInterruptibly()</code>, several <code>Condition</code>s, read/write modes. Always unlock in <code>finally</code>.', code: 'lock.lock();\ntry { … } finally { lock.unlock(); }' }
    ],
    terms: [
      ['monitor', 'The lock built into every object, plus its wait set. Used by <code>synchronized</code>, <code>wait</code>, <code>notify</code>.'],
      ['reentrant', 'The owner can take the same lock again without blocking itself. A hold count tracks how many times.'],
      ['entry set / wait set', 'Threads waiting to get the monitor (BLOCKED), vs threads that called <code>wait()</code> and gave it up (WAITING).'],
      ['Condition', 'A named wait queue tied to a <code>Lock</code>: <code>await()</code>, <code>signal()</code>, <code>signalAll()</code>.'],
      ['fairness', 'Does the thread that waited longest get the lock next? Or may a newcomer jump ahead (“barge”)?'],
      ['AQS', '<code>AbstractQueuedSynchronizer</code>: an int state plus a first-come queue of sleeping threads. Most j.u.c locks are built on it.']
    ]
  },
  visual: {
    title: 'Watch threads move between owner, entry queue and wait sets',
    caption: 'Pick a mechanism and press Play or Step. Threads move between zones. <b>owner</b> holds the lock. The <b>entry set / queue</b> waits to get it. The <b>wait sets / conditions</b> gave the lock back and wait for a signal. The bottom strip shows the guarded data and the lock’s own counters.'
  },
  gotchas: [
    { trap: '<code>if</code> instead of <code>while</code> around <code>wait()</code>', code: `synchronized (this) {
    if (queue.isEmpty()) wait();   // ✗ woken, but another consumer got the item first
    return queue.remove();         // NoSuchElementException
}`, why: 'A woken thread goes back to the entry set and competes for the monitor. Another thread may get in first and change the state. Threads may also wake for no reason.', fix: 'Always <code>while (!condition) wait();</code>. The same rule applies to <code>Condition.await()</code>.' },
    { trap: '<code>notify()</code> can wake the wrong thread', why: 'Producers and consumers wait on the same monitor. <code>notify()</code> wakes one random waiter. If it wakes a producer when a consumer was needed, the producer waits again. The signal is lost, and everyone sleeps forever.', fix: 'Use <code>notifyAll()</code> with one monitor. Or use a <code>ReentrantLock</code> with two <code>Condition</code>s (<code>notFull</code>, <code>notEmpty</code>), and <code>signal()</code> the right one. Or use a <code>BlockingQueue</code>.' },
    { trap: 'Forgetting <code>unlock()</code> on the exception path', code: `lock.lock();
updateLedger();        // throws → lock is held forever
lock.unlock();`, why: 'Unlike <code>synchronized</code>, an explicit lock isn’t released when an exception exits the block. Not even when the owner thread dies. Every later <code>lock()</code> waits forever.', fix: '<code>lock.lock(); try { … } finally { lock.unlock(); }</code>. Put <code>lock()</code> <b>before</b> the <code>try</code>, so a failed lock doesn’t call <code>unlock()</code>.' },
    { trap: 'Trying to upgrade a read lock to a write lock', code: `rw.readLock().lock();
if (cacheMiss) {
    rw.writeLock().lock();   // waits for all readers, including itself: deadlock
}`, why: '<code>ReentrantReadWriteLock</code> gives the write lock only when there are no readers. The thread is itself a reader, so it waits for itself forever. (Going write → read is allowed.)', fix: 'Release the read lock, take the write lock, then <b>check again</b>. Or use <code>StampedLock.tryConvertToWriteLock</code>. For caches, use <code>ConcurrentHashMap.computeIfAbsent</code>.' },
    { trap: 'Synchronizing on the wrong object', code: `private Integer count = 0;
synchronized (count) { count++; }   // count++ makes a new Integer: a new lock every time

synchronized ("LOCK") { … }         // interned literal: shared with any other class using it`, why: 'Locks belong to objects, not variables. Reassign the field and later threads use a different lock. String literals and small boxed numbers are shared across the whole JVM. Locking on <code>this</code> lets outside code take your lock.', fix: 'Lock on a <code>private final Object lock = new Object()</code>. JDK 16+ can warn when you lock on types like Integer (<code>-XX:DiagnoseSyncOnValueBasedClasses=2</code>).' },
    { trap: 'StampedLock is not reentrant', why: 'Calling <code>writeLock()</code> while the same thread already holds it (or a read stamp) blocks forever. It has no <code>Condition</code>s. Stamps aren’t tied to an owner thread.', fix: 'Use it only for small, self-contained locked code. The classic case: reading a point’s coordinates optimistically. If the code calls other methods, use <code>ReentrantLock</code>.' },
    { trap: 'Expecting a JVM lock to protect work across pods', why: '<code>synchronized</code> and <code>ReentrantLock</code> only exclude threads in <b>one JVM</b>. With three replicas, a “locked” scheduled job runs three times.', fix: 'Use the database (<code>SELECT … FOR UPDATE SKIP LOCKED</code>, Postgres advisory locks). Or ShedLock for <code>@Scheduled</code>. Or a lease in Redis or ZooKeeper, with fencing tokens.' }
  ],
  scenarios: [
    { title: 'All checkout threads hang after one payment timeout',
      symptom: 'After a single payment-provider timeout, every checkout request hangs. CPU is idle. Only a restart helps.',
      diagnose: `jcmd <pid> Thread.print -l
# "http-nio-8080-exec-12" WAITING (parking)
#   - parking to wait for <0x...> (a java.util.concurrent.locks.ReentrantLock$NonfairSync)
#   at LedgerService.post(LedgerService.java:41)
# ...  (same for 199 other threads)
# Locked ownable synchronizers:   (searched across all threads)
#   - <0x...> held by "http-nio-8080-exec-3", which is now idle in the pool`,
      cause: '<code>lock.lock(); post(); lock.unlock();</code> with no try/finally. The timeout exception skipped the unlock. The owner went back to the pool still holding the lock. Nobody can ever get it.',
      fix: 'Unlock in <code>finally</code>. Use <code>tryLock(timeout)</code> where code may wait, so a stuck lock becomes an error, not a hang. The <code>-l</code> flag on thread dumps lists who holds explicit locks.',
      fixCode: `if (!lock.tryLock(2, TimeUnit.SECONDS)) throw new LedgerBusyException();
try {
    post(entry);
} finally {
    lock.unlock();
}` },
    { title: 'A read-mostly cache got slower after “optimising” it with a ReadWriteLock',
      symptom: 'A product cache moved from <code>synchronized</code> to <code>ReentrantReadWriteLock</code>, “because 99.9% of calls are reads”. Slowest-request latency (p99) doubled at 64 cores.',
      diagnose: `// async-profiler, CPU mode: hot frames in
//   ReentrantReadWriteLock$Sync.tryAcquireShared
//   ReentrantReadWriteLock$Sync.tryReleaseShared
// every read does two CAS operations on the same state word`,
      cause: 'A read lock still writes to shared memory. Each lock and unlock updates the lock’s state, and all cores fight over that one spot. When the read takes nanoseconds, the lock costs more than the work.',
      fix: 'For a cache, use <code>ConcurrentHashMap</code> (reads take no lock) or Caffeine. For a small group of values, share frozen copies through a volatile field. Or use <code>StampedLock</code> optimistic reads.',
      fixCode: `private final ConcurrentHashMap<String, Product> cache = new ConcurrentHashMap<>();

Product get(String sku) {
    return cache.computeIfAbsent(sku, repo::load);   // reads are plain volatile loads
}` },
    { title: 'The nightly invoice job ran three times',
      symptom: 'Customers received three identical invoices. The job’s method is <code>synchronized</code> and also guarded by a static <code>ReentrantLock</code>.',
      diagnose: `kubectl get pods -l app=billing
# billing-7d9c-abc   Running
# billing-7d9c-def   Running
# billing-7d9c-ghi   Running
# each pod's log: "invoice run started 02:00:00"`,
      cause: 'JVM locks are per process. Three replicas each have their own lock, so each ran the job.',
      fix: 'Coordinate through shared state. Use ShedLock on <code>@Scheduled</code> or a Postgres advisory lock. Or claim work rows with <code>FOR UPDATE SKIP LOCKED</code>, so the job is safe to run anywhere.',
      fixCode: `@Scheduled(cron = "0 0 2 * * *")
@SchedulerLock(name = "invoiceRun", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
public void invoiceRun() { … }   // ShedLock: one pod wins a row in the shedlock table` }
  ],
  puzzles: [
    { kind: 'predict', q: 'One thread, one ReentrantLock. What does this print?', code: `import java.util.concurrent.locks.*;

public class Main {
    public static void main(String[] a) {
        ReentrantLock lock = new ReentrantLock();
        lock.lock();
        lock.lock();
        System.out.println(lock.getHoldCount());
        lock.unlock();
        System.out.println(lock.isLocked() + " " + lock.getHoldCount());
        lock.unlock();
        System.out.println(lock.isLocked());
    }
}`, options: ['2, true 1, false', '1, false 0, false', 'It deadlocks on the second lock()', '2, false 1, false'], answer: 0, run: true, expect: '2\ntrue 1\nfalse', explain: '<i>Reentrant</i> means the owner can lock again: the hold count goes to <b>2</b>. One <code>unlock()</code> only lowers it, so the lock is still held (<b>true 1</b>). It is freed when the count hits zero. <code>synchronized</code> is reentrant in the same way.' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] a) throws InterruptedException {
        Object o = new Object();
        try {
            o.wait(10);
        } catch (IllegalMonitorStateException e) {
            System.out.println("IMSE");
        }
        synchronized (o) {
            o.wait(10);
            System.out.println("waited");
        }
    }
}`, options: ['waited', 'IMSE, then waited', 'IMSE only', 'It hangs forever'], answer: 1, run: true, expect: 'IMSE\nwaited', explain: '<code>wait</code>, <code>notify</code> and <code>notifyAll</code> need the caller to <b>own the monitor</b>. Otherwise they throw <code>IllegalMonitorStateException</code>. Inside <code>synchronized (o)</code>, <code>wait(10)</code> gives up the monitor, waits about 10 ms, takes it back and returns.' },
    { kind: 'predict', q: 'Main holds the lock. Another thread tries to take and release it. Output?', code: `import java.util.concurrent.locks.*;

public class Main {
    public static void main(String[] a) throws Exception {
        ReentrantLock lock = new ReentrantLock();
        lock.lock();
        Thread t = new Thread(() -> {
            System.out.println("tryLock: " + lock.tryLock());
            try {
                lock.unlock();
            } catch (IllegalMonitorStateException e) {
                System.out.println("not owner");
            }
        });
        t.start();
        t.join();
        System.out.println("held by main: " + lock.isHeldByCurrentThread());
    }
}`, options: ['tryLock: true, held by main: false', 'tryLock: false, not owner, held by main: true', 'tryLock: false, held by main: false', 'The thread blocks forever in tryLock'], answer: 1, run: true, expect: 'tryLock: false\nnot owner\nheld by main: true', explain: '<code>tryLock()</code> never waits. It returns <b>false</b> at once because main owns the lock. Only the owner may unlock a ReentrantLock. Anyone else gets <code>IllegalMonitorStateException</code>. (A <code>Semaphore</code> has no owner, so any thread may release it.)' },
    { kind: 'predict', q: 'Upgrade and downgrade with ReentrantReadWriteLock. Output?', code: `import java.util.concurrent.locks.*;

public class Main {
    public static void main(String[] a) {
        ReentrantReadWriteLock rw = new ReentrantReadWriteLock();
        rw.readLock().lock();
        System.out.println(rw.writeLock().tryLock());
        rw.readLock().unlock();

        rw.writeLock().lock();
        rw.readLock().lock();
        rw.writeLock().unlock();
        System.out.println(rw.getReadLockCount() + " " + rw.isWriteLocked());
    }
}`, options: ['true, then 1 false', 'false, then 1 false', 'false, then 0 true', 'It deadlocks at tryLock'], answer: 1, run: true, expect: 'false\n1 false', explain: 'A thread holding the read lock can’t get the write lock. <code>tryLock()</code> returns <b>false</b> (a plain <code>lock()</code> would deadlock). The other way works. Holding the write lock, you may take the read lock, then release the write lock. That is a <b>downgrade</b>: one reader, no writer.' },
    { kind: 'concept', q: 'A bounded buffer uses one monitor, <code>while</code> loops and <code>notify()</code> (not notifyAll). Two producers and two consumers. What can go wrong?', options: ['Nothing; while loops make it safe', 'A notify can wake a thread of the wrong kind; the signal is lost and all four may end up waiting', 'notify throws if more than one thread waits', 'Items are delivered twice'], answer: 1, explain: 'Producers and consumers share one wait set. A consumer’s <code>notify()</code> may wake another consumer. It sees the buffer still empty and waits again. Nobody wakes the producers. Use <code>notifyAll()</code>, or two Conditions with targeted <code>signal()</code>.' },
    { kind: 'concept', q: 'A <b>fair</b> <code>ReentrantLock</code> has threads queued. A newly arriving thread calls <code>tryLock()</code> (no timeout) just as the lock is released. What happens?', options: ['It queues behind the others because the lock is fair', 'It may acquire the lock immediately, barging ahead', 'It throws IllegalStateException', 'It waits up to the default timeout'], answer: 1, explain: 'Plain <code>tryLock()</code> <b>ignores</b> the fairness setting. It succeeds if the lock is free at that instant, even with waiters. <code>tryLock(0, SECONDS)</code> does respect fairness.' },
    { kind: 'concept', q: 'Which statement about <code>synchronized</code> vs <code>ReentrantLock</code> is true on Java 21?', options: ['synchronized is always slower', 'Only ReentrantLock can wait with a timeout, be interrupted while waiting, or have several condition queues', 'synchronized locks are fair', 'ReentrantLock is released automatically on exceptions'], answer: 1, explain: 'Both are reentrant and give the same memory effects. Speed is similar in most cases. ReentrantLock adds <code>tryLock(timeout)</code>, <code>lockInterruptibly()</code>, several <code>Condition</code>s, fairness and status checks. But you must release it in <code>finally</code>. On Java 21, it also doesn’t pin virtual threads. <code>synchronized</code> does.' },
    { kind: 'bug', q: 'Why does this “lock” protect nothing?', code: `class Stats {
    private Long total = 0L;
    void add(long x) {
        synchronized (total) { total += x; }
    }
}`, options: ['Long is immutable, so synchronized is ignored', 'total += x creates a new Long, so threads lock different objects', 'synchronized on a field needs volatile', 'It is fine'], answer: 1, explain: '<code>total += x</code> makes a new <code>Long</code> and puts it in the field. Later threads lock the new object while others still hold the old one. So two threads can be inside at once. Values from -128 to 127 are even cached and shared JVM-wide. Lock on a dedicated <code>final</code> object, or use <code>LongAdder</code>.' }
  ],
  interview: [
    { q: 'What happens when a thread enters a <code>synchronized</code> block?', a: '<p>It tries to take the object’s monitor. If it is free, the thread becomes the owner, with a hold count. If another thread owns it, the thread is <b>BLOCKED</b> in the entry set. On exit, normal or by exception, the monitor is released. With no competition, HotSpot uses a cheap “thin” lock (one CAS). Under competition or <code>wait</code>, it switches to a full <code>ObjectMonitor</code>. Writes made inside are visible to the next owner (see <a href="java-memory-model.html">JMM</a>).</p>', fu: 'What happened to biased locking? (Turned off by default and deprecated in JDK 15, then removed.)', lvl: 'core' },
    { q: 'Explain <code>wait</code>, <code>notify</code> and <code>notifyAll</code>.', a: '<p>All need you to own the monitor. <code>wait()</code> gives it up and puts the thread in the wait set (WAITING), in one step. <code>notify()</code> moves one random waiter to the entry set. <code>notifyAll()</code> moves all of them. A woken thread must win the monitor back before <code>wait()</code> returns. So it re-checks its condition in a <code>while</code> loop. Threads may also wake for no reason. Calling these without the monitor throws <code>IllegalMonitorStateException</code>.</p>', lvl: 'core' },
    { q: 'When would you choose ReentrantLock over synchronized?', a: '<ul><li>You need <code>tryLock()</code> or <code>tryLock(timeout)</code> to avoid deadlocks or fail fast.</li><li>You need <code>lockInterruptibly()</code> so cancel works.</li><li>You need several wait queues (<code>Condition</code>s).</li><li>You need fairness, or status checks (<code>getQueueLength</code>, <code>isLocked</code>).</li><li>Java 21–23 with virtual threads: blocking inside <code>synchronized</code> pins the carrier. A ReentrantLock doesn’t.</li></ul><p>Otherwise <code>synchronized</code> is simpler and can’t leak.</p>', lvl: 'core' },
    { q: 'How do Conditions differ from wait/notify?', a: '<p>A <code>Condition</code> is a wait queue tied to a <code>Lock</code>. One lock can have many. <code>await()</code> gives up the lock and sleeps. <code>signal()</code> moves the oldest waiter to the lock’s queue. With separate <code>notFull</code> and <code>notEmpty</code> conditions, a producer wakes only consumers. No crowd of needless wake-ups, and no lost signals. There are also <code>awaitNanos</code>, <code>awaitUntil</code> and <code>awaitUninterruptibly</code>.</p>', lvl: 'core' },
    { q: 'How does AbstractQueuedSynchronizer work?', a: '<p>An <code>int state</code> changed by CAS, plus a first-come queue of waiting threads. They sleep with <code>LockSupport.park</code>. Each subclass decides what the state means. ReentrantLock: the hold count. Semaphore: permits. CountDownLatch: the count. ReentrantReadWriteLock: 16 bits of reads and 16 bits of writes. On release, the next thread wakes and retries the CAS. That is why lock waiters show as <b>WAITING (parking)</b> in thread dumps.</p>', lvl: 'deep' },
    { q: 'Fair vs non-fair locks: what is the trade-off?', a: '<p>Non-fair (the default) lets a running thread grab a just-freed lock, even if others are queued (“barging”). That skips a thread switch on each handoff, so it is much faster. But a waiter may starve. Fair locks hand off strictly in queue order. Nobody starves, but each release must wake a sleeping thread, so it is much slower under load. Use fairness only when you have seen starvation.</p>', lvl: 'deep' },
    { q: 'ReadWriteLock vs StampedLock?', a: '<p><code>ReentrantReadWriteLock</code>: many readers or one writer. Reentrant. Conditions on the write lock. You can go write → read, not read → write. Every read lock and unlock still updates a shared word. <code>StampedLock</code> (Java 8) adds <b>optimistic reads</b>. <code>tryOptimisticRead()</code> returns a stamp without locking. Copy the fields into locals. <code>validate(stamp)</code> tells you if a writer got in. If so, retry with a real read lock. It is not reentrant and has no Conditions. Take care: values read this way may not match until validated.</p>', lvl: 'deep' },
    { q: 'What is lock striping?', a: '<p>Splitting one lock into N locks, each guarding part of the data (picked by hash). Then unrelated updates don’t compete. Java 7’s ConcurrentHashMap used 16 segments. Java 8+ locks single bins. <code>LongAdder</code> spreads a counter across cells. The cost: whole-structure operations (size, iteration) must combine the parts.</p>', lvl: 'deep' },
    { q: 'How do you avoid deadlocks when you need two locks?', a: '<p>Take them in one <b>fixed order</b> (say, by account id). Then a loop can’t form. Or use <code>tryLock(timeout)</code> on both, then back off and retry with a random delay. While holding a lock, don’t call unknown code that might take other locks. To detect it: thread dumps print “Found one Java-level deadlock”. See <a href="concurrency-bugs.html">Concurrency bugs</a>.</p>', lvl: 'core' },
    { q: 'Does <code>synchronized</code> work with virtual threads?', a: '<p>Correctly, yes. But on Java 21–23, a virtual thread that blocks (I/O, <code>sleep</code>, <code>wait</code>) inside <code>synchronized</code> gets stuck to its OS thread (<b>pinned</b>). With few OS threads, this slows everything or even deadlocks. JDK 24 fixed monitors so virtual threads can step off while holding or waiting for one. On 21, use <code>ReentrantLock</code> around blocking calls, and find pinning with JFR’s <code>jdk.VirtualThreadPinned</code> event. See <a href="virtual-threads.html">Virtual threads</a>.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Bounded buffer with two Conditions', lang: 'java', code: `final class BoundedBuffer<T> {
    private final Object[] items;
    private int putIdx, takeIdx, count;
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notFull = lock.newCondition();
    private final Condition notEmpty = lock.newCondition();

    BoundedBuffer(int capacity) { items = new Object[capacity]; }

    void put(T x) throws InterruptedException {
        lock.lockInterruptibly();                   // cancellable while waiting for the lock
        try {
            while (count == items.length) notFull.await();   // releases lock while waiting
            items[putIdx] = x; putIdx = (putIdx + 1) % items.length; count++;
            notEmpty.signal();                      // wake one consumer, never a producer
        } finally { lock.unlock(); }
    }

    @SuppressWarnings("unchecked")
    T take() throws InterruptedException {
        lock.lockInterruptibly();
        try {
            while (count == 0) notEmpty.await();
            T x = (T) items[takeIdx]; items[takeIdx] = null;
            takeIdx = (takeIdx + 1) % items.length; count--;
            notFull.signal();
            return x;
        } finally { lock.unlock(); }
    }
}`, note: 'This is essentially <code>ArrayBlockingQueue</code>. In real code, use the JDK class.' },
    { title: 'Two locks without deadlock', lang: 'java', code: `// transfer between accounts: always lock the lower id first
void transfer(Account a, Account b, BigDecimal amt) {
    Account first = a.id() < b.id() ? a : b;
    Account second = first == a ? b : a;
    first.lock().lock();
    try {
        second.lock().lock();
        try {
            a.debit(amt);
            b.credit(amt);
        } finally { second.lock().unlock(); }
    } finally { first.lock().unlock(); }
}

// or fail fast instead of waiting forever
boolean tryTransfer(Account a, Account b, BigDecimal amt) throws InterruptedException {
    if (!a.lock().tryLock(50, TimeUnit.MILLISECONDS)) return false;
    try {
        if (!b.lock().tryLock(50, TimeUnit.MILLISECONDS)) return false;
        try { a.debit(amt); b.credit(amt); return true; }
        finally { b.lock().unlock(); }
    } finally { a.lock().unlock(); }
}`, note: 'In a service backed by Postgres, the row locks (<code>SELECT … FOR UPDATE</code> in id order) are usually the real lock. They work across pods.' },
    { title: 'StampedLock optimistic read', lang: 'java', code: `final class Position {
    private double lat, lon;
    private final StampedLock sl = new StampedLock();

    void move(double dLat, double dLon) {
        long s = sl.writeLock();
        try { lat += dLat; lon += dLon; }
        finally { sl.unlockWrite(s); }
    }

    double distanceTo(double tLat, double tLon) {
        long s = sl.tryOptimisticRead();      // no lock, just a version stamp
        double la = lat, lo = lon;            // copy into locals
        if (!sl.validate(s)) {                // a writer got in: fall back to a real read lock
            s = sl.readLock();
            try { la = lat; lo = lon; }
            finally { sl.unlockRead(s); }
        }
        return haversine(la, lo, tLat, tLon); // use only the validated copies
    }
}`, note: 'Not reentrant, no Conditions. Never use optimistically read values (follow pointers, index arrays) before <code>validate</code> succeeds.' }
  ]
});

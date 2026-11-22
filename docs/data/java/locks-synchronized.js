IA.register({
  track: 'java',
  slug: 'locks-synchronized',
  title: 'Locks & synchronized',
  tagline: 'Every Java object can act as a <b>monitor</b>: one owner, an <i>entry set</i> of threads waiting to get in, and a <i>wait set</i> of threads that called <code>wait()</code>. <code>ReentrantLock</code>, <code>ReadWriteLock</code> and <code>StampedLock</code> are the same idea built on a queue (AQS), with timeouts, interruption, several conditions and shared modes.',
  tldr: {
    problem: 'Lock bugs show up as hangs, lost wake-ups, throughput collapse under contention, or threads that never get a turn. Many come from using the wrong tool: <code>if</code> instead of <code>while</code> around <code>wait()</code>, a forgotten <code>unlock()</code>, a lock upgrade that deadlocks, or a JVM lock expected to work across pods.',
    model: '<code>synchronized</code> = enter the monitor (BLOCKED while another thread owns it), run, exit. <code>wait()</code> releases the monitor and parks in the wait set; <code>notify</code> moves a waiter back to the entry set, where it must re-acquire. <code>Lock</code> does the same with an explicit FIFO queue of parked threads and one queue per <code>Condition</code>.',
    hook: '“Why must <code>wait()</code> be in a <code>while</code> loop?” Because a woken thread re-competes for the monitor, and by the time it gets it another thread may have consumed the item. Spurious wake-ups are allowed too.',
    facts: [
      { v: 'Java 5', l: '<code>java.util.concurrent.locks</code> (JSR-166): ReentrantLock, Condition, ReentrantReadWriteLock, all built on AbstractQueuedSynchronizer. <code>StampedLock</code> came in Java 8' },
      { v: 'non-fair', l: 'is the default for <code>ReentrantLock</code>, and <code>synchronized</code> makes no fairness promise. Fair mode hands the lock over in FIFO order at a large throughput cost' },
      { v: 'JDK 24', l: '(JEP 491) stopped <code>synchronized</code> from pinning virtual threads to their carrier. On Java 21, prefer <code>ReentrantLock</code> around blocking calls on virtual threads' }
    ]
  },
  intro: {
    what: 'When two threads change the same data at once, the result can be garbage. A <b>lock</b> makes a piece of code <b>mutually exclusive</b>: only one thread at a time may be inside it; the others wait their turn. Java gives you a built-in lock on every object (<code>synchronized</code>) and a toolkit of explicit locks (<code>ReentrantLock</code> and friends) for when you need more control: timeouts, giving up, several waiting rooms, or letting many readers in at once.',
    analogy: { icon: '🚻', title: 'A single-occupancy bathroom with a waiting room', text: 'One person holds the key (the owner). Others queue at the door (the entry set). Someone inside who realises there is no soap hands the key back and goes to sit in a side room (the wait set) until someone shouts “soap refilled!” (notify). Hearing that doesn’t get them in: they join the queue at the door again, and when they finally get in, they should check the soap again, because someone else may have used it up.' },
    steps: [
      { t: 'Protect shared state with one lock', d: 'Every read and write of the shared fields goes through the same lock.', code: 'private final Object lock = new Object();\nprivate int balance;\n\nvoid deposit(int x) { synchronized (lock) { balance += x; } }\nint balance()       { synchronized (lock) { return balance; } }' },
      { t: 'Keep the critical section short', d: 'No I/O, no remote calls, no callbacks to unknown code while holding a lock. Everyone else waits for you.' },
      { t: 'Wait for a condition properly', d: 'Hold the lock, check the condition in a <code>while</code> loop, and call <code>wait()</code> (or <code>condition.await()</code>) inside the loop.' },
      { t: 'Use explicit locks when you need their features', d: '<code>tryLock(timeout)</code>, <code>lockInterruptibly()</code>, several <code>Condition</code>s, read/write modes. Always unlock in <code>finally</code>.', code: 'lock.lock();\ntry { … } finally { lock.unlock(); }' }
    ],
    terms: [
      ['monitor', 'The lock built into every object, plus its wait set. Used by <code>synchronized</code>, <code>wait</code>, <code>notify</code>.'],
      ['reentrant', 'The owner can acquire the same lock again without deadlocking itself; a hold count tracks how many times.'],
      ['entry set / wait set', 'Threads waiting to acquire the monitor (BLOCKED) vs threads that called <code>wait()</code> and released it (WAITING).'],
      ['Condition', 'A named wait queue tied to a <code>Lock</code>: <code>await()</code>, <code>signal()</code>, <code>signalAll()</code>.'],
      ['fairness', 'Whether the longest-waiting thread is guaranteed to get the lock next, or a newly arriving thread may “barge” ahead.'],
      ['AQS', '<code>AbstractQueuedSynchronizer</code>: an int state plus a FIFO queue of parked threads; the base of most j.u.c locks.']
    ]
  },
  visual: {
    title: 'Watch threads move between owner, entry queue and wait sets',
    caption: 'Pick a mechanism and press Play or Step. Thread chips move between zones: <b>owner</b> (holds the lock), the <b>entry set / queue</b> (waiting to acquire) and the <b>wait sets / conditions</b> (released the lock and waiting for a signal). The strip at the bottom shows the protected state and the lock’s own bookkeeping.'
  },
  gotchas: [
    { trap: '<code>if</code> instead of <code>while</code> around <code>wait()</code>', code: `synchronized (this) {
    if (queue.isEmpty()) wait();   // ✗ woken, but another consumer got the item first
    return queue.remove();         // NoSuchElementException
}`, why: 'A woken thread goes back to the entry set and competes for the monitor. Another thread may get in first and change the state. The JLS also allows spurious wake-ups.', fix: 'Always <code>while (!condition) wait();</code>. The same rule applies to <code>Condition.await()</code>.' },
    { trap: '<code>notify()</code> can wake the wrong thread', why: 'With producers and consumers waiting on the same monitor, <code>notify()</code> wakes one arbitrary waiter. If it wakes a producer when a consumer was needed, that producer re-waits and the signal is lost: everyone sleeps forever.', fix: 'Use <code>notifyAll()</code> with a single monitor, or a <code>ReentrantLock</code> with two <code>Condition</code>s (<code>notFull</code>, <code>notEmpty</code>) and <code>signal()</code> the right one. Or just use a <code>BlockingQueue</code>.' },
    { trap: 'Forgetting <code>unlock()</code> on the exception path', code: `lock.lock();
updateLedger();        // throws → lock is held forever
lock.unlock();`, why: 'Unlike <code>synchronized</code>, an explicit lock isn’t released when the block exits abnormally, or even when the owner thread dies. Every later <code>lock()</code> parks forever.', fix: '<code>lock.lock(); try { … } finally { lock.unlock(); }</code>, with <code>lock()</code> <b>before</b> the <code>try</code> so a failed acquire doesn’t call <code>unlock()</code>.' },
    { trap: 'Trying to upgrade a read lock to a write lock', code: `rw.readLock().lock();
if (cacheMiss) {
    rw.writeLock().lock();   // waits for all readers, including itself: deadlock
}`, why: '<code>ReentrantReadWriteLock</code> grants the write lock only when there are no readers. The thread is one of the readers, so it waits for itself forever. (Downgrading, write → read, is allowed.)', fix: 'Release the read lock, take the write lock, then <b>re-check</b> the condition. Or use <code>StampedLock.tryConvertToWriteLock</code>, or <code>ConcurrentHashMap.computeIfAbsent</code> for caches.' },
    { trap: 'Synchronizing on the wrong object', code: `private Integer count = 0;
synchronized (count) { count++; }   // count++ makes a new Integer: a new lock every time

synchronized ("LOCK") { … }         // interned literal: shared with any other class using it`, why: 'Locks belong to objects, not variables. Reassigning the field changes which monitor later threads use, and literals and small boxed values are shared JVM-wide. Locking on <code>this</code> lets outside code take your lock.', fix: 'Lock on a <code>private final Object lock = new Object()</code>. JDK 16+ can warn about locking on value-based classes (<code>-XX:DiagnoseSyncOnValueBasedClasses=2</code>).' },
    { trap: 'StampedLock is not reentrant', why: 'Calling <code>writeLock()</code> while the same thread already holds it (or a read stamp) blocks forever. It also has no <code>Condition</code>s, and stamps aren’t tied to an owner thread.', fix: 'Use it only for small, self-contained critical sections (classic: a point’s coordinates with an optimistic read). For anything that calls other methods, use <code>ReentrantLock</code>.' },
    { trap: 'Expecting a JVM lock to protect work across pods', why: '<code>synchronized</code> and <code>ReentrantLock</code> only exclude threads in <b>one JVM</b>. With three replicas, a “locked” scheduled job runs three times.', fix: 'Use the database (<code>SELECT … FOR UPDATE SKIP LOCKED</code>, Postgres advisory locks), ShedLock for <code>@Scheduled</code>, or a lease in Redis or ZooKeeper with fencing tokens.' }
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
      cause: '<code>lock.lock(); post(); lock.unlock();</code> without try/finally. The timeout exception skipped the unlock. The owner thread returned to the pool still holding the lock, and nobody can ever acquire it.',
      fix: 'Unlock in <code>finally</code>. Add <code>tryLock(timeout)</code> on paths that can wait, so a stuck lock becomes an error instead of a hang. The <code>-l</code> flag on thread dumps prints ownable synchronizers, which finds the owner.',
      fixCode: `if (!lock.tryLock(2, TimeUnit.SECONDS)) throw new LedgerBusyException();
try {
    post(entry);
} finally {
    lock.unlock();
}` },
    { title: 'A read-mostly cache got slower after “optimising” it with a ReadWriteLock',
      symptom: 'A product-lookup cache moved from <code>synchronized</code> to <code>ReentrantReadWriteLock</code> “because 99.9% of calls are reads”. p99 latency doubled at 64 cores.',
      diagnose: `// async-profiler, CPU mode: hot frames in
//   ReentrantReadWriteLock$Sync.tryAcquireShared
//   ReentrantReadWriteLock$Sync.tryReleaseShared
// every read does two CAS operations on the same state word`,
      cause: 'A read lock is still a write to shared memory: each acquire and release CASes the lock’s state, and all cores fight over that one cache line. For reads that take nanoseconds, the lock costs more than the work.',
      fix: 'For a cache, use <code>ConcurrentHashMap</code> (lock-free reads) or Caffeine. For a small composite value, publish immutable snapshots through a volatile field, or use <code>StampedLock</code> optimistic reads.',
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
      fix: 'Coordinate through shared state: ShedLock on <code>@Scheduled</code>, a Postgres advisory lock, or claiming work rows with <code>FOR UPDATE SKIP LOCKED</code> so the job is safe to run anywhere.',
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
}`, options: ['2, true 1, false', '1, false 0, false', 'It deadlocks on the second lock()', '2, false 1, false'], answer: 0, run: true, expect: '2\ntrue 1\nfalse', explain: 'Reentrant means the owner can acquire again: the hold count goes to <b>2</b>. One <code>unlock()</code> only decrements it, so the lock is still held (<b>true 1</b>). It is released when the count reaches zero. <code>synchronized</code> is reentrant in the same way.' },
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
}`, options: ['waited', 'IMSE, then waited', 'IMSE only', 'It hangs forever'], answer: 1, run: true, expect: 'IMSE\nwaited', explain: '<code>wait</code>, <code>notify</code> and <code>notifyAll</code> require the caller to <b>own the monitor</b>; otherwise they throw <code>IllegalMonitorStateException</code>. Inside <code>synchronized (o)</code>, <code>wait(10)</code> releases the monitor, times out after about 10 ms, re-acquires it and returns.' },
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
}`, options: ['tryLock: true, held by main: false', 'tryLock: false, not owner, held by main: true', 'tryLock: false, held by main: false', 'The thread blocks forever in tryLock'], answer: 1, run: true, expect: 'tryLock: false\nnot owner\nheld by main: true', explain: '<code>tryLock()</code> never waits: it returns <b>false</b> immediately because main owns the lock. A ReentrantLock has an owner, and only the owner may unlock it; anyone else gets <code>IllegalMonitorStateException</code>. (A <code>Semaphore</code> has no owner, so any thread may release it.)' },
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
}`, options: ['true, then 1 false', 'false, then 1 false', 'false, then 0 true', 'It deadlocks at tryLock'], answer: 1, run: true, expect: 'false\n1 false', explain: 'A thread holding the read lock can’t get the write lock: <code>tryLock()</code> returns <b>false</b> (a plain <code>lock()</code> would deadlock). The other direction is allowed: holding the write lock you may take the read lock, then release the write lock. That is a <b>downgrade</b>, leaving one read hold and no writer.' },
    { kind: 'concept', q: 'A bounded buffer uses one monitor, <code>while</code> loops and <code>notify()</code> (not notifyAll). Two producers and two consumers. What can go wrong?', options: ['Nothing; while loops make it safe', 'A notify can wake a thread of the wrong kind; the signal is lost and all four may end up waiting', 'notify throws if more than one thread waits', 'Items are delivered twice'], answer: 1, explain: 'Producers and consumers share one wait set. A consumer’s <code>notify()</code> might wake another consumer, which sees the buffer still empty and waits again. Nobody wakes the producers. Use <code>notifyAll()</code>, or two Conditions with targeted <code>signal()</code>.' },
    { kind: 'concept', q: 'A <b>fair</b> <code>ReentrantLock</code> has threads queued. A newly arriving thread calls <code>tryLock()</code> (no timeout) just as the lock is released. What happens?', options: ['It queues behind the others because the lock is fair', 'It may acquire the lock immediately, barging ahead', 'It throws IllegalStateException', 'It waits up to the default timeout'], answer: 1, explain: 'The javadoc: untimed <code>tryLock()</code> does <b>not</b> honour the fairness setting. It succeeds if the lock is free at that instant, even with waiters. <code>tryLock(0, SECONDS)</code> does honour fairness.' },
    { kind: 'concept', q: 'Which statement about <code>synchronized</code> vs <code>ReentrantLock</code> is true on Java 21?', options: ['synchronized is always slower', 'Only ReentrantLock can wait with a timeout, be interrupted while waiting, or have several condition queues', 'synchronized locks are fair', 'ReentrantLock is released automatically on exceptions'], answer: 1, explain: 'Both are reentrant and give the same memory effects. Performance is similar in most cases. ReentrantLock adds <code>tryLock(timeout)</code>, <code>lockInterruptibly()</code>, multiple <code>Condition</code>s, fairness and introspection, but you must release it in <code>finally</code>. On Java 21, it also doesn’t pin virtual threads, unlike <code>synchronized</code>.' },
    { kind: 'bug', q: 'Why does this “lock” protect nothing?', code: `class Stats {
    private Long total = 0L;
    void add(long x) {
        synchronized (total) { total += x; }
    }
}`, options: ['Long is immutable, so synchronized is ignored', 'total += x creates a new Long, so threads lock different objects', 'synchronized on a field needs volatile', 'It is fine'], answer: 1, explain: '<code>total += x</code> boxes a new <code>Long</code> and reassigns the field. Threads arriving later lock the new object while others still hold the old one, so two threads can be inside at once. Values from -128 to 127 are even cached and shared JVM-wide. Lock on a dedicated <code>final</code> object, or use <code>LongAdder</code>.' }
  ],
  interview: [
    { q: 'What happens when a thread enters a <code>synchronized</code> block?', a: '<p>It tries to acquire the object’s monitor. If free, it becomes the owner (reentrantly, with a count). If another thread owns it, the thread is <b>BLOCKED</b> in the entry set. On exit, normal or exceptional, the monitor is released. HotSpot uses a cheap CAS-based “thin” lock when uncontended and inflates to a full <code>ObjectMonitor</code> under contention or <code>wait</code>. Exiting also has release semantics, and entering has acquire semantics, so writes inside are visible to the next owner (see <a href="java-memory-model.html">JMM</a>).</p>', fu: 'What happened to biased locking? (Disabled by default and deprecated in JDK 15, JEP 374, then removed.)', lvl: 'core' },
    { q: 'Explain <code>wait</code>, <code>notify</code> and <code>notifyAll</code>.', a: '<p>All require owning the monitor. <code>wait()</code> atomically releases it and puts the thread in the wait set (WAITING). <code>notify()</code> moves one arbitrary waiter to the entry set; <code>notifyAll()</code> moves all of them. A woken thread must re-acquire the monitor before <code>wait()</code> returns, so it re-checks its condition in a <code>while</code> loop. Spurious wake-ups are permitted. Calling them without the monitor throws <code>IllegalMonitorStateException</code>.</p>', lvl: 'core' },
    { q: 'When would you choose ReentrantLock over synchronized?', a: '<ul><li>You need <code>tryLock()</code> or <code>tryLock(timeout)</code> to avoid deadlocks or fail fast.</li><li>You need <code>lockInterruptibly()</code> so cancellation works.</li><li>You need several wait queues (<code>Condition</code>s).</li><li>You need fairness, or diagnostics (<code>getQueueLength</code>, <code>isLocked</code>).</li><li>On Java 21–23 with virtual threads: blocking while holding a <code>synchronized</code> monitor pins the carrier; a ReentrantLock doesn’t.</li></ul><p>Otherwise <code>synchronized</code> is simpler and can’t leak.</p>', lvl: 'core' },
    { q: 'How do Conditions differ from wait/notify?', a: '<p>A <code>Condition</code> is a wait queue tied to a <code>Lock</code>; a lock can have many. <code>await()</code> releases the lock and parks; <code>signal()</code> moves the first waiter (FIFO) from the condition queue to the lock’s acquisition queue. With separate <code>notFull</code> and <code>notEmpty</code> conditions, a producer wakes only consumers, avoiding <code>notifyAll</code> thundering herds and lost-signal bugs. There are also <code>awaitNanos</code>, <code>awaitUntil</code> and <code>awaitUninterruptibly</code>.</p>', lvl: 'core' },
    { q: 'How does AbstractQueuedSynchronizer work?', a: '<p>An <code>int state</code> changed by CAS, plus a FIFO queue of nodes for waiting threads, which block with <code>LockSupport.park</code>. Subclasses define what acquire and release mean: ReentrantLock uses state as the hold count; Semaphore as permits; CountDownLatch as the count; ReentrantReadWriteLock splits it into 16 bits of read count and 16 bits of write count. Release unparks the successor, which retries the CAS. That is why lock waiters show as <b>WAITING (parking)</b> in thread dumps.</p>', lvl: 'deep' },
    { q: 'Fair vs non-fair locks: what is the trade-off?', a: '<p>Non-fair (the default) lets a running thread grab a just-released lock even if others are queued (“barging”). That avoids a context switch on every handoff and gives much higher throughput, at the risk of starving a waiter. Fair locks hand off strictly in queue order: no starvation, but each release must wake a parked thread, so throughput drops a lot under contention. Use fairness only when starvation is an observed problem.</p>', lvl: 'deep' },
    { q: 'ReadWriteLock vs StampedLock?', a: '<p><code>ReentrantReadWriteLock</code>: many readers or one writer; reentrant; supports Conditions on the write lock; downgrade but no upgrade. Every read acquire and release still CASes a shared word. <code>StampedLock</code> (Java 8) adds <b>optimistic reads</b>: <code>tryOptimisticRead()</code> returns a stamp without locking; read the fields into locals; <code>validate(stamp)</code> tells you whether a writer intervened, and if so you retry with a real read lock. It is not reentrant, has no Conditions, and needs care: values read optimistically may be inconsistent until validated.</p>', lvl: 'deep' },
    { q: 'What is lock striping?', a: '<p>Splitting one lock into N locks, each guarding a subset of the data (by hash), so unrelated updates don’t contend. Java 7’s ConcurrentHashMap used 16 segments; Java 8+ locks individual bins. <code>LongAdder</code> stripes a counter across cells. The cost: operations that need the whole structure (size, iteration) must combine stripes.</p>', lvl: 'deep' },
    { q: 'How do you avoid deadlocks when you need two locks?', a: '<p>Acquire them in a <b>global order</b> (e.g. by account id), so a cycle can’t form. Or use <code>tryLock(timeout)</code> on both and back off and retry, with jitter to avoid livelock. Keep critical sections free of calls to foreign code that might take other locks. Detection: thread dumps report “Found one Java-level deadlock” for monitors and ownable synchronizers. See <a href="concurrency-bugs.html">Concurrency bugs</a>.</p>', lvl: 'core' },
    { q: 'Does <code>synchronized</code> work with virtual threads?', a: '<p>Correctly, yes. But on Java 21–23, a virtual thread that blocks (I/O, <code>sleep</code>, <code>wait</code>) inside a <code>synchronized</code> block is <b>pinned</b>: it can’t unmount, so it holds its carrier thread. With few carriers this throttles throughput or even deadlocks. JDK 24 (JEP 491) reworked monitors so virtual threads can unmount while holding or waiting for one. On 21, use <code>ReentrantLock</code> around blocking calls, and find pinning with JFR’s <code>jdk.VirtualThreadPinned</code> event. See <a href="virtual-threads.html">Virtual threads</a>.</p>', lvl: 'deep' }
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
}`, note: 'In a service backed by Postgres, the database row locks (<code>SELECT … FOR UPDATE</code> in id order) are usually the real lock, and they work across pods.' },
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
}`, note: 'Not reentrant, no Conditions. Never act on optimistically read values (follow pointers, index arrays) before <code>validate</code> succeeds.' }
  ]
});

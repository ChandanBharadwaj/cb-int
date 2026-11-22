IA.register({
  track: 'java',
  slug: 'concurrent-collections',
  title: 'Concurrent collections',
  tagline: 'Thread-safe collections make <b>each call</b> atomic, not your sequence of calls. Know which atomic compound operations exist (<code>computeIfAbsent</code>, <code>merge</code>, <code>offer</code> with a timeout) and what each structure trades away: CopyOnWrite gives up cheap writes, BlockingQueues give you backpressure, skip lists give you sorted order without locks.',
  tldr: {
    problem: 'Code that uses ConcurrentHashMap can still lose updates, stampede a backend, or deadlock a bin. An unbounded queue can take the heap down. None of it shows up in a single-threaded unit test.',
    model: '<b>ConcurrentHashMap</b>: lock-free reads, CAS into empty bins, <code>synchronized</code> on the first node of a non-empty bin, cooperative resizing. <b>CopyOnWrite</b>: copy the array on every write, so readers iterate immutable snapshots. <b>BlockingQueue</b>: a lock plus two conditions (notFull, notEmpty). <b>ConcurrentSkipList</b>: a CAS-linked sorted list with random index levels.',
    hook: '“Is <code>if (!map.containsKey(k)) map.put(k, v)</code> safe on a ConcurrentHashMap?” No. Each call is atomic; the check-then-act gap isn’t. Use <code>putIfAbsent</code> or <code>computeIfAbsent</code>.',
    facts: [
      { v: 'no nulls', l: 'ConcurrentHashMap rejects null keys and values, because <code>get(k) == null</code> must mean “absent” when there is no lock to make a follow-up <code>containsKey</code> meaningful' },
      { v: 'Java 8', l: 'replaced Java 7’s 16 lock Segments with per-bin locking, CAS and treeified bins; <code>size()</code> now sums a LongAdder-style counter' },
      { v: '2³¹ − 1', l: 'the default capacity of <code>LinkedBlockingQueue</code>, which is what <code>Executors.newFixedThreadPool</code> uses. Effectively unbounded' }
    ]
  },
  intro: {
    what: 'When several threads use the same collection at once, ordinary collections like HashMap and ArrayList can lose data or corrupt themselves. The <code>java.util.concurrent</code> package has collections designed for this. They protect their own internals, but you still have to use operations that do the <b>whole job in one call</b>.',
    analogy: { icon: '🏦', title: 'A bank with many tellers', text: 'Each teller (thread) can safely read your balance and safely write a new one: those are single atomic calls. But if two tellers each read “€100”, each add €10, and each write “€110”, one deposit is lost. The bank needs a single “deposit €10” operation. That is what <code>merge</code> and <code>compute</code> are.' },
    steps: [
      { t: 'Choose the structure by access pattern', d: 'Key lookup → ConcurrentHashMap. Read-mostly list → CopyOnWriteArrayList. Producer/consumer → a BlockingQueue. Sorted keys → ConcurrentSkipListMap.' },
      { t: 'Use the compound operations', d: 'They read and write in one atomic step for that key.', code: 'counts.merge(word, 1, Integer::sum);\ncache.computeIfAbsent(id, this::load);\nmap.putIfAbsent(k, v);' },
      { t: 'Bound your queues', d: 'A queue between a fast producer and a slow consumer grows until memory runs out, unless it has a capacity.' },
      { t: 'Accept weakly consistent views', d: 'Iterators and <code>size()</code> reflect some moment during the call. They never throw ConcurrentModificationException, and they may or may not show concurrent changes.' }
    ],
    terms: [
      ['atomic', 'Happens as one indivisible step: no other thread sees it half done.'],
      ['check-then-act', 'Reading state, then acting on it in a separate call. Racy unless locked together.'],
      ['CAS', 'Compare-and-swap: a CPU instruction that writes only if the value is still what you expected.'],
      ['backpressure', 'Slowing a producer down when the consumer can’t keep up, e.g. by blocking on a full queue.'],
      ['weakly consistent', 'An iterator that tolerates concurrent changes and may or may not reflect them.']
    ]
  },
  visual: {
    title: 'Two threads, one collection',
    caption: 'Pick a scenario and press Play. Thread T1 is on the left, T2 on the right, and the shared structure in the middle. Each scenario shows a broken pattern first where there is one, then the atomic fix.'
  },
  gotchas: [
    { trap: 'Check-then-act on a concurrent map', code: `if (!cache.containsKey(id)) cache.put(id, load(id));   // two loads, last one wins
Integer n = hits.get(p); hits.put(p, n == null ? 1 : n + 1);  // lost updates`, why: 'Each call is atomic; the sequence isn’t. Another thread can act between your read and your write.', fix: '<code>computeIfAbsent</code>, <code>merge</code>, <code>compute</code>, <code>putIfAbsent</code>, <code>replace(k, old, new)</code>. For hot counters, <code>ConcurrentHashMap&lt;K, LongAdder&gt;</code>.' },
    { trap: 'Slow or re-entrant work inside compute*', code: `cache.computeIfAbsent(id, k -> http.get("/rates/" + k));   // holds the bin lock
cache.computeIfAbsent(a, k -> cache.computeIfAbsent(b, …));  // same map inside: don’t`, why: 'The mapping function runs while the bin is locked. Other threads that hash to that bin (not just that key) wait. Touching the same map from inside can deadlock, or throw <code>IllegalStateException: Recursive update</code> (Java 9+).', fix: 'Keep functions short and side-effect free. For slow loads, store a <code>CompletableFuture</code> and complete it outside the lock, or use Caffeine’s <code>LoadingCache</code>.' },
    { trap: '<code>putIfAbsent(k, expensive())</code> still computes the value', why: 'The argument is evaluated before the call, every time, even when the key already exists.', fix: 'Use <code>computeIfAbsent(k, key -&gt; expensive())</code>, which only runs the function when the key is missing.' },
    { trap: 'Unbounded queues behind executors', code: `ExecutorService pool = Executors.newFixedThreadPool(8);   // LinkedBlockingQueue(Integer.MAX_VALUE)`, why: 'If tasks arrive faster than 8 threads finish them, the queue just grows: latency climbs for minutes, then the heap fills with pending tasks.', fix: 'Build a <code>ThreadPoolExecutor</code> with an <code>ArrayBlockingQueue(capacity)</code> and a rejection policy (<code>CallerRunsPolicy</code> for backpressure, or reject and return 503).' },
    { trap: 'CopyOnWriteArrayList for write-heavy data', why: 'Every <code>add</code>/<code>set</code>/<code>remove</code> copies the whole array under a lock. A 10k-element list with 1k writes/s copies 10M references per second and churns the young generation.', fix: 'Use it for read-mostly data (listeners, config, routing). For append-heavy logs use <code>ConcurrentLinkedQueue</code> or a <code>BlockingQueue</code>.' },
    { trap: 'Iterating a synchronizedList without holding its lock', code: `List<Job> jobs = Collections.synchronizedList(new ArrayList<>());
for (Job j : jobs) …          // CME or worse if another thread adds
synchronized (jobs) { for (Job j : jobs) … }   // required by the javadoc`, why: 'Only individual methods are synchronized. The iterator isn’t.', fix: 'Hold the list’s monitor while iterating, or switch to a concurrent collection whose iterators are snapshot or weakly consistent.' },
    { trap: 'Trusting <code>size()</code> or <code>isEmpty()</code> for decisions', why: 'On ConcurrentHashMap they are estimates while writers run. On <code>ConcurrentLinkedQueue</code> and <code>ConcurrentSkipListMap</code>, <code>size()</code> is O(n) and can be stale by the time it returns.', fix: 'Act atomically instead (<code>poll()</code> and check for null, <code>offer</code> with a result). Use <code>mappingCount()</code> on large maps to get a <code>long</code>.' }
  ],
  scenarios: [
    { title: 'Hundreds of threads BLOCKED in ConcurrentHashMap.computeIfAbsent',
      symptom: 'After a downstream FX service slowed to 2 s responses, the whole API stopped responding. Thread dumps show most Tomcat workers BLOCKED.',
      diagnose: `"http-nio-8080-exec-112" BLOCKED (on object monitor)
   at java.util.concurrent.ConcurrentHashMap.computeIfAbsent(…)
   - waiting to lock <0x…> (a java.util.concurrent.ConcurrentHashMap$ReservationNode)
   at com.acme.fx.RateCache.get(RateCache.java:41)`,
      cause: '<code>computeIfAbsent(ccy, this::fetchRemote)</code> ran a 2-second HTTP call while holding the bin lock. Every request for that currency, and for any other key in the same bin, queued behind it.',
      fix: 'Cache a future instead of the value, so the lock is held only for the insert. Add a timeout to the remote call. Better: use Caffeine with <code>refreshAfterWrite</code>.',
      fixCode: `private final ConcurrentHashMap<String, CompletableFuture<Rate>> cache = new ConcurrentHashMap<>();

CompletableFuture<Rate> rate(String ccy) {
    CompletableFuture<Rate> f = cache.computeIfAbsent(ccy, k ->
        CompletableFuture.supplyAsync(() -> client.fetch(k), ioPool)   // returns at once
            .orTimeout(500, TimeUnit.MILLISECONDS));
    f.whenComplete((r, e) -> { if (e != null) cache.remove(ccy, f); });  // outside the lock; don't cache failures
    return f;
}` },
    { title: 'Heap fills up overnight in a report worker',
      symptom: 'Old gen grows steadily overnight; the pod is OOM-killed around 4 a.m. A heap dump shows millions of <code>FutureTask</code> objects reachable from a <code>LinkedBlockingQueue</code>.',
      diagnose: `jcmd <pid> GC.class_histogram | head
#  1:  4,812,330  …  java.util.concurrent.FutureTask
#  2:  4,812,330  …  java.util.concurrent.LinkedBlockingQueue$Node`,
      cause: 'A Kafka listener submitted each record to <code>Executors.newFixedThreadPool(4)</code>. Its queue is unbounded, so when the database slowed, tasks piled up in memory instead of slowing consumption.',
      fix: 'Use a bounded queue with <code>CallerRunsPolicy</code>: when the queue is full, the listener thread runs the task itself, which naturally pauses consumption.',
      fixCode: `ThreadPoolExecutor pool = new ThreadPoolExecutor(
    4, 4, 0, TimeUnit.SECONDS,
    new ArrayBlockingQueue<>(500),                 // bounded
    new ThreadPoolExecutor.CallerRunsPolicy());    // backpressure` },
    { title: 'GC every few hundred milliseconds from an “audit buffer”',
      symptom: 'Young GC frequency jumped 20× after an audit feature shipped. Allocation profiling points at <code>Arrays.copyOf</code> inside <code>CopyOnWriteArrayList.add</code>.',
      cause: 'Audit events were appended to a <code>CopyOnWriteArrayList</code> drained every 10 s. Each append copied the growing array, so allocation was quadratic in the batch size.',
      fix: 'Use a queue designed for many writers and one drainer.',
      fixCode: `private final ConcurrentLinkedQueue<AuditEvent> buffer = new ConcurrentLinkedQueue<>();
void record(AuditEvent e) { buffer.offer(e); }          // O(1), lock-free
@Scheduled(fixedDelay = 10_000) void flush() {
    List<AuditEvent> batch = new ArrayList<>();
    for (AuditEvent e; (e = buffer.poll()) != null; ) batch.add(e);
    if (!batch.isEmpty()) repo.saveAll(batch);
}` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;
import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        Map<String, Integer> m = new ConcurrentHashMap<>();
        try { m.put("a", null); } catch (NullPointerException e) { System.out.print("NPE "); }
        System.out.println(m.getOrDefault("a", 0));
    }
}`, options: ['null', 'NPE 0', 'NPE null', '0'], answer: 1, run: true, expect: 'NPE 0', explain: 'ConcurrentHashMap rejects null keys and values with NPE, so nothing is stored and <code>getOrDefault</code> returns 0. Without nulls, a <code>get</code> returning null always means “absent”, which is why atomic methods like <code>computeIfAbsent</code> can be defined cleanly.' },
    { kind: 'predict', q: 'Single thread. What does this print?', code: `import java.util.*;
import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        List<Integer> l = new CopyOnWriteArrayList<>(List.of(1, 2, 3));
        for (Integer x : l) if (x == 1) l.add(4);
        System.out.println(l);
    }
}`, options: ['ConcurrentModificationException', '[1, 2, 3, 4]', '[1, 2, 3, 4, 4, 4, 4]', 'An infinite loop'], answer: 1, run: true, expect: '[1, 2, 3, 4]', explain: 'The iterator walks a snapshot of the array taken when the loop started (1, 2, 3). The add makes a new array, which the loop never sees, so 4 is added exactly once: <b>[1, 2, 3, 4]</b>. With an ArrayList this would throw CME.' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        ConcurrentHashMap<String, String> m = new ConcurrentHashMap<>();
        String v = m.computeIfAbsent("k", key -> null);
        System.out.println(v + " " + m.containsKey("k") + " " + m.size());
    }
}`, options: ['null true 1', 'NPE', 'null false 0', '"" false 0'], answer: 2, run: true, expect: 'null false 0', explain: 'If the mapping function returns null, <code>computeIfAbsent</code> records <b>no mapping</b> and returns null. No NPE: the null never enters the map. Handy for “load if it exists”, but it also means a failed lookup is retried on every call.' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;
import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        ConcurrentHashMap<String, Integer> m = new ConcurrentHashMap<>(Map.of("a", 1));
        m.merge("a", 5, (oldV, newV) -> null);
        m.merge("b", 5, (oldV, newV) -> null);
        System.out.println(m);
    }
}`, options: ['{a=1, b=5}', '{b=5}', '{}', '{a=null, b=null}'], answer: 1, run: true, expect: '{b=5}', explain: 'For "a" the key exists, so the remapping function runs and returns null, which <b>removes</b> the entry. For "b" the key is absent, so <code>merge</code> just stores 5 and never calls the function. Result: <b>{b=5}</b>.' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        BlockingQueue<Integer> q = new ArrayBlockingQueue<>(1);
        System.out.print(q.offer(1) + " " + q.offer(2) + " ");
        try { q.add(3); } catch (IllegalStateException e) { System.out.print("ISE "); }
        System.out.println(q.poll() + " " + q.poll());
    }
}`, options: ['true true ISE 1 2', 'true false ISE 1 null', 'true false 1 3', 'It blocks forever'], answer: 1, run: true, expect: 'true false ISE 1 null', explain: 'The queue holds one element. <code>offer</code> returns false when full, <code>add</code> throws <code>IllegalStateException("Queue full")</code>, and <code>put</code> would block. <code>poll</code> returns null when empty, and <code>take</code> would block. Four method families: throw, special value, block, time out.' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        SynchronousQueue<Integer> q = new SynchronousQueue<>();
        System.out.println(q.offer(1) + " " + q.size() + " " + q.peek());
    }
}`, options: ['true 1 1', 'true 0 null', 'false 0 null', 'It blocks forever'], answer: 2, run: true, expect: 'false 0 null', explain: 'A SynchronousQueue has <b>no capacity</b>: an <code>offer</code> succeeds only if a consumer is already waiting in <code>take</code>/<code>poll</code>. None is, so it returns false. <code>size()</code> is always 0 and <code>peek()</code> always null. <code>Executors.newCachedThreadPool</code> uses it, so every task either finds an idle thread or gets a new one.' },
    { kind: 'concept', q: 'Which operation is <b>O(n)</b> on a <code>ConcurrentSkipListMap</code>?', options: ['get', 'floorKey', 'size', 'pollFirstEntry'], answer: 2, explain: 'Lookups and navigation are O(log n) expected. <code>size()</code> has to traverse the base list because there is no shared counter (keeping one would add contention), and the result may be stale by the time it returns. Same for <code>ConcurrentLinkedQueue.size()</code>.' },
    { kind: 'concept', q: 'How does ConcurrentHashMap (Java 8+) handle a put into an <b>empty</b> bin?', options: ['Locks a Segment', 'CAS of the new node into the table slot, with no lock', 'synchronized on the whole map', 'Copies the table'], answer: 1, explain: 'An empty bin is filled with a single <b>CAS</b>. A non-empty bin is locked with <code>synchronized</code> on its first node. Reads use volatile reads and never lock. During a resize, threads that touch a moved bin (marked with a ForwardingNode) help transfer bins.' }
  ],
  interview: [
    { q: 'How does ConcurrentHashMap achieve thread safety without a global lock?', a: '<ul><li><b>Reads</b>: volatile reads of the table slot and node fields; no locking.</li><li><b>Writes to an empty bin</b>: CAS the node in.</li><li><b>Writes to a non-empty bin</b>: <code>synchronized</code> on the bin’s first node, so contention is per bin.</li><li><b>Resize</b>: incremental and cooperative; moved bins hold a ForwardingNode, and writers that hit one help transfer.</li><li><b>Counting</b>: <code>baseCount</code> plus striped CounterCells.</li></ul>', fu: 'What did Java 7 do? (16 Segments by default, each a ReentrantLock over its own sub-table: concurrency limited by the segment count.)', lvl: 'deep' },
    { q: 'Why doesn’t ConcurrentHashMap allow nulls?', a: '<p>Ambiguity. In a HashMap, <code>get(k) == null</code> can be disambiguated with <code>containsKey(k)</code>, because nothing changes in between. In a concurrent map, another thread could act between the two calls. Banning nulls makes “null means absent” always true, which the atomic methods rely on.</p>', lvl: 'core' },
    { q: 'putIfAbsent vs computeIfAbsent?', a: '<p>Both are atomic. <code>putIfAbsent(k, v)</code> takes an already-computed value (evaluated even if unused) and returns the previous value or null. <code>computeIfAbsent(k, fn)</code> runs <code>fn</code> only if the key is missing, under the bin lock, and returns the current (existing or new) value. A null result means no mapping is stored.</p>', lvl: 'core' },
    { q: 'Are ConcurrentHashMap iterators fail-fast?', a: '<p>No, they are <b>weakly consistent</b>. They never throw ConcurrentModificationException, they reflect the map at some point at or after the iterator’s creation, and they may or may not show later changes. The same goes for <code>size()</code> and bulk operations like <code>forEach</code>, <code>reduce</code> and <code>search</code> (which also take a parallelism threshold).</p>', lvl: 'core' },
    { q: 'When is CopyOnWriteArrayList the right choice?', a: '<p>When reads and iterations vastly outnumber writes, and the list is small to medium: listener lists, plugin registries, routing tables. Reads are lock-free; iterators are snapshots that never throw CME and don’t support <code>remove</code>. Every write copies the whole array under a lock, so write cost is O(n) in time and allocation.</p>', lvl: 'core' },
    { q: 'Compare ArrayBlockingQueue, LinkedBlockingQueue, SynchronousQueue and PriorityBlockingQueue.', a: '<ul><li><b>ArrayBlockingQueue</b>: bounded circular array, one lock for both ends; predictable memory.</li><li><b>LinkedBlockingQueue</b>: optionally bounded (default <code>Integer.MAX_VALUE</code>), separate put and take locks, so better throughput under contention, but a node per element.</li><li><b>SynchronousQueue</b>: zero capacity; a direct handoff.</li><li><b>PriorityBlockingQueue</b>: unbounded heap; <code>put</code> never blocks.</li><li>Also: <code>DelayQueue</code> (elements available after a delay), <code>LinkedTransferQueue</code>.</li></ul>', lvl: 'deep' },
    { q: 'Explain the four method families of BlockingQueue.', a: '<p>Throw: <code>add</code>/<code>remove</code>/<code>element</code>. Special value: <code>offer</code>/<code>poll</code>/<code>peek</code> (false or null). Block: <code>put</code>/<code>take</code>. Time out: <code>offer(e, t, unit)</code>/<code>poll(t, unit)</code>. In request-handling code prefer the timed versions so a stuck consumer can’t hang your threads forever.</p>', lvl: 'core' },
    { q: 'What is ConcurrentSkipListMap, and when would you use it?', a: '<p>A concurrent <code>NavigableMap</code>: a sorted linked list where nodes are randomly promoted to index levels, so searches skip ahead in O(log n) expected time. Updates use CAS, with no locks. Use it when several threads need sorted order or range queries: order books, time-ordered schedulers, leaderboards. <code>size()</code> is O(n).</p>', lvl: 'deep' },
    { q: 'How would you count events per key at high throughput?', a: '<p><code>ConcurrentHashMap&lt;String, LongAdder&gt;</code>: <code>map.computeIfAbsent(k, x -&gt; new LongAdder()).increment()</code>. The map lock is taken only on first insert, and LongAdder stripes increments across cells to avoid CAS contention on one hot key. Read with <code>sum()</code>, which is a moment-in-time estimate under load. For moderate rates <code>merge(k, 1L, Long::sum)</code> is simpler.</p>', lvl: 'deep' },
    { q: 'Collections.synchronizedMap vs ConcurrentHashMap?', a: '<p><code>synchronizedMap</code> wraps every call in one mutex: correct, but every reader and writer serialises, and you must lock the map yourself while iterating. ConcurrentHashMap scales reads without locks and writes per bin, and adds atomic compound operations. Choose synchronizedMap only to wrap a special map (e.g. a LinkedHashMap LRU) where contention is low.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Bounded executor (Spring Boot)', lang: 'java', code: `@Configuration
class ExecutorConfig {
    @Bean
    ThreadPoolTaskExecutor reportExecutor() {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(8);
        ex.setMaxPoolSize(8);
        ex.setQueueCapacity(500);      // default is Integer.MAX_VALUE: always set it
        ex.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        ex.setThreadNamePrefix("report-");
        ex.setWaitForTasksToCompleteOnShutdown(true);
        return ex;
    }
}`, note: 'With a bounded queue, the pool grows from core to max only <i>after</i> the queue is full. Core = max avoids that surprise.' },
    { title: 'High-rate counters', lang: 'java', code: `private final ConcurrentHashMap<String, LongAdder> hits = new ConcurrentHashMap<>();

void hit(String route) {
    hits.computeIfAbsent(route, r -> new LongAdder()).increment();
}

Map<String, Long> snapshotAndReset() {
    Map<String, Long> out = new TreeMap<>();
    hits.forEach((route, n) -> out.put(route, n.sumThenReset()));
    return out;     // an estimate under concurrent writes, which is fine for metrics
}`, note: 'In real services use Micrometer counters; they do this for you.' },
    { title: 'Producer/consumer with shutdown', lang: 'java', code: `record Job(String id) {}
static final Job POISON = new Job("__stop__");

BlockingQueue<Job> q = new ArrayBlockingQueue<>(1_000);

// producer
if (!q.offer(job, 100, TimeUnit.MILLISECONDS)) metrics.rejected();

// consumer thread
void run() throws InterruptedException {
    while (true) {
        Job j = q.take();
        if (j == POISON) return;        // identity check on purpose
        handle(j);
    }
}
// shutdown: q.put(POISON) once per consumer`, note: 'Restore the interrupt flag (<code>Thread.currentThread().interrupt()</code>) if you catch InterruptedException without rethrowing.' }
  ]
});

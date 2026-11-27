IA.register({
  track: 'java',
  slug: 'concurrent-collections',
  title: 'Concurrent collections',
  tagline: 'Thread-safe collections make <b>each call</b> safe, not your sequence of calls. Learn the methods that do a whole job in one step (<code>computeIfAbsent</code>, <code>merge</code>, <code>offer</code> with a timeout). And learn each structure’s trade-off. CopyOnWrite makes writes costly. BlockingQueues slow down producers when full. Skip lists keep sorted order without locks.',
  tldr: {
    problem: 'Code with ConcurrentHashMap can still lose updates, flood a backend, or deadlock a bin. A queue with no limit can fill the heap. None of it shows up in a single-threaded unit test.',
    model: '<b>ConcurrentHashMap</b>: reads take no lock. A write to an empty slot (<i>bin</i>) uses one CAS. A write to a full bin locks its first node. Threads help each other resize. <b>CopyOnWrite</b>: every write copies the array, so readers loop over a frozen snapshot. <b>BlockingQueue</b>: a lock plus two conditions (notFull, notEmpty). <b>ConcurrentSkipList</b>: a sorted linked list with random shortcut levels.',
    hook: '“Is <code>if (!map.containsKey(k)) map.put(k, v)</code> safe on a ConcurrentHashMap?” No. Each call is safe, but another thread can act in the gap between them. Use <code>putIfAbsent</code> or <code>computeIfAbsent</code>.',
    facts: [
      { v: 'no nulls', l: 'ConcurrentHashMap rejects null keys and values, because <code>get(k) == null</code> must mean “absent” when there is no lock to make a follow-up <code>containsKey</code> meaningful' },
      { v: 'Java 8', l: 'replaced Java 7’s 16 locked Segments with one lock per bin, CAS, and trees in long bins. <code>size()</code> now adds up a LongAdder-style counter' },
      { v: '2³¹ − 1', l: 'the default size of <code>LinkedBlockingQueue</code>, which <code>Executors.newFixedThreadPool</code> uses. In practice, no limit' }
    ]
  },
  intro: {
    what: 'When several threads share one collection, a plain HashMap or ArrayList can lose data or break. The <code>java.util.concurrent</code> package has collections built for this. They protect their own insides. But you still need methods that do the <b>whole job in one call</b>.',
    analogy: { icon: '🏦', title: 'A bank with many tellers', text: 'Each teller (thread) can safely read your balance and safely write a new one. Those are single, safe calls. But say two tellers each read “€100”, add €10, and write “€110”. One deposit is lost. The bank needs one “deposit €10” operation. That is what <code>merge</code> and <code>compute</code> are.' },
    steps: [
      { t: 'Choose the structure by access pattern', d: 'Key lookup → ConcurrentHashMap. Read-mostly list → CopyOnWriteArrayList. Producer/consumer → a BlockingQueue. Sorted keys → ConcurrentSkipListMap.' },
      { t: 'Use the compound operations', d: 'They read and write in one atomic step for that key.', code: 'counts.merge(word, 1, Integer::sum);\ncache.computeIfAbsent(id, this::load);\nmap.putIfAbsent(k, v);' },
      { t: 'Bound your queues', d: 'A queue between a fast producer and a slow consumer grows until memory runs out. Unless it has a size limit.' },
      { t: 'Accept weakly consistent views', d: 'Iterators and <code>size()</code> show some moment during the call. They never throw ConcurrentModificationException. They may or may not show changes made meanwhile.' }
    ],
    terms: [
      ['atomic', 'Happens as one indivisible step: no other thread sees it half done.'],
      ['check-then-act', 'Reading state, then acting on it in a separate call. Unsafe unless both run under one lock.'],
      ['CAS', 'Compare-and-swap: a CPU instruction that writes only if the value is still what you expected.'],
      ['backpressure', 'Slowing a producer when the consumer can’t keep up, for example by blocking on a full queue.'],
      ['weakly consistent', 'An iterator that copes with changes made meanwhile. It may or may not show them.']
    ]
  },
  visual: {
    title: 'Two threads, one collection',
    caption: 'Pick a scenario and press Play. Thread T1 is on the left, T2 on the right, and the shared structure in the middle. Most scenarios show the broken pattern first, then the one-step fix.'
  },
  gotchas: [
    { trap: 'Check-then-act on a concurrent map', code: `if (!cache.containsKey(id)) cache.put(id, load(id));   // two loads, last one wins
Integer n = hits.get(p); hits.put(p, n == null ? 1 : n + 1);  // lost updates`, why: 'Each call is safe. The sequence isn’t. Another thread can act between your read and your write.', fix: '<code>computeIfAbsent</code>, <code>merge</code>, <code>compute</code>, <code>putIfAbsent</code>, <code>replace(k, old, new)</code>. For hot counters, <code>ConcurrentHashMap&lt;K, LongAdder&gt;</code>.' },
    { trap: 'Slow or re-entrant work inside compute*', code: `cache.computeIfAbsent(id, k -> http.get("/rates/" + k));   // holds the bin lock
cache.computeIfAbsent(a, k -> cache.computeIfAbsent(b, …));  // same map inside: don’t`, why: 'The function runs while the bin is locked. Other threads that land in that bin wait, not only those with that key. Touching the same map from inside can deadlock or throw <code>IllegalStateException: Recursive update</code> (Java 9+).', fix: 'Keep functions short, with no side effects. For slow loads, store a <code>CompletableFuture</code> and finish it outside the lock. Or use Caffeine’s <code>LoadingCache</code>.' },
    { trap: '<code>putIfAbsent(k, expensive())</code> still computes the value', why: 'The argument is evaluated before the call, every time, even when the key already exists.', fix: 'Use <code>computeIfAbsent(k, key -&gt; expensive())</code>, which only runs the function when the key is missing.' },
    { trap: 'Unbounded queues behind executors', code: `ExecutorService pool = Executors.newFixedThreadPool(8);   // LinkedBlockingQueue(Integer.MAX_VALUE)`, why: 'If tasks arrive faster than 8 threads finish them, the queue keeps growing. Wait times climb for minutes. Then the heap fills with waiting tasks.', fix: 'Build a <code>ThreadPoolExecutor</code> with an <code>ArrayBlockingQueue(capacity)</code> and a rejection policy. Use <code>CallerRunsPolicy</code> to slow the sender, or reject and return 503.' },
    { trap: 'CopyOnWriteArrayList for write-heavy data', why: 'Every <code>add</code>/<code>set</code>/<code>remove</code> copies the whole array under a lock. A 10k-element list with 1k writes/s copies 10M references a second. That creates lots of garbage.', fix: 'Use it for data you mostly read (listeners, config, routing). For logs you keep adding to, use <code>ConcurrentLinkedQueue</code> or a <code>BlockingQueue</code>.' },
    { trap: 'Iterating a synchronizedList without holding its lock', code: `List<Job> jobs = Collections.synchronizedList(new ArrayList<>());
for (Job j : jobs) …          // CME or worse if another thread adds
synchronized (jobs) { for (Job j : jobs) … }   // required by the javadoc`, why: 'Only individual methods are synchronized. The iterator isn’t.', fix: 'Hold the list’s lock while looping. Or switch to a concurrent collection whose iterators cope with changes.' },
    { trap: 'Trusting <code>size()</code> or <code>isEmpty()</code> for decisions', why: 'On ConcurrentHashMap they are estimates while others write. On <code>ConcurrentLinkedQueue</code>, <code>size()</code> is O(n). On any of them, the answer can be out of date when it returns.', fix: 'Act in one step instead: <code>poll()</code> and check for null, or <code>offer</code> and check the result. On large maps, use <code>mappingCount()</code> to get a <code>long</code>.' }
  ],
  scenarios: [
    { title: 'Hundreds of threads BLOCKED in ConcurrentHashMap.computeIfAbsent',
      symptom: 'A currency (FX) service slowed to 2 s per response. Then the whole API stopped responding. Thread dumps show most Tomcat workers BLOCKED.',
      diagnose: `"http-nio-8080-exec-112" BLOCKED (on object monitor)
   at java.util.concurrent.ConcurrentHashMap.computeIfAbsent(…)
   - waiting to lock <0x…> (a java.util.concurrent.ConcurrentHashMap$ReservationNode)
   at com.acme.fx.RateCache.get(RateCache.java:41)`,
      cause: '<code>computeIfAbsent(ccy, this::fetchRemote)</code> ran a 2-second HTTP call while holding the bin lock. Every request for that currency queued behind it. So did any other key in the same bin.',
      fix: 'Cache a future, not the value, so the lock is held only for the insert. Add a timeout to the remote call. Better still: Caffeine with <code>refreshAfterWrite</code>.',
      fixCode: `private final ConcurrentHashMap<String, CompletableFuture<Rate>> cache = new ConcurrentHashMap<>();

CompletableFuture<Rate> rate(String ccy) {
    CompletableFuture<Rate> f = cache.computeIfAbsent(ccy, k ->
        CompletableFuture.supplyAsync(() -> client.fetch(k), ioPool)   // returns at once
            .orTimeout(500, TimeUnit.MILLISECONDS));
    f.whenComplete((r, e) -> { if (e != null) cache.remove(ccy, f); });  // outside the lock; don't cache failures
    return f;
}` },
    { title: 'Heap fills up overnight in a report worker',
      symptom: 'Long-lived heap memory grows all night. The pod is killed for lack of memory around 4 a.m. A heap dump shows millions of <code>FutureTask</code> objects held by a <code>LinkedBlockingQueue</code>.',
      diagnose: `jcmd <pid> GC.class_histogram | head
#  1:  4,812,330  …  java.util.concurrent.FutureTask
#  2:  4,812,330  …  java.util.concurrent.LinkedBlockingQueue$Node`,
      cause: 'A Kafka listener sent each record to <code>Executors.newFixedThreadPool(4)</code>. Its queue has no limit. When the database slowed, tasks piled up in memory instead of slowing the listener.',
      fix: 'Use a queue with a limit and <code>CallerRunsPolicy</code>. When the queue is full, the listener thread runs the task itself. That pauses reading new records.',
      fixCode: `ThreadPoolExecutor pool = new ThreadPoolExecutor(
    4, 4, 0, TimeUnit.SECONDS,
    new ArrayBlockingQueue<>(500),                 // bounded
    new ThreadPoolExecutor.CallerRunsPolicy());    // backpressure` },
    { title: 'GC every few hundred milliseconds from an “audit buffer”',
      symptom: 'After an audit feature shipped, garbage collection ran 20× more often. Profiling points at <code>Arrays.copyOf</code> inside <code>CopyOnWriteArrayList.add</code>.',
      cause: 'Audit events went into a <code>CopyOnWriteArrayList</code> emptied every 10 s. Each add copied the growing array. So memory use grew with the square of the batch size.',
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
}`, options: ['null', 'NPE 0', 'NPE null', '0'], answer: 1, run: true, expect: 'NPE 0', explain: 'ConcurrentHashMap rejects null keys and values with NPE. Nothing is stored, and <code>getOrDefault</code> returns 0. With no nulls, a <code>get</code> that returns null always means “absent”. That keeps methods like <code>computeIfAbsent</code> simple.' },
    { kind: 'predict', q: 'Single thread. What does this print?', code: `import java.util.*;
import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        List<Integer> l = new CopyOnWriteArrayList<>(List.of(1, 2, 3));
        for (Integer x : l) if (x == 1) l.add(4);
        System.out.println(l);
    }
}`, options: ['ConcurrentModificationException', '[1, 2, 3, 4]', '[1, 2, 3, 4, 4, 4, 4]', 'An infinite loop'], answer: 1, run: true, expect: '[1, 2, 3, 4]', explain: 'The iterator walks a copy of the array from when the loop started (1, 2, 3). The add makes a new array, which the loop never sees. So 4 is added exactly once: <b>[1, 2, 3, 4]</b>. With an ArrayList this would throw CME.' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        ConcurrentHashMap<String, String> m = new ConcurrentHashMap<>();
        String v = m.computeIfAbsent("k", key -> null);
        System.out.println(v + " " + m.containsKey("k") + " " + m.size());
    }
}`, options: ['null true 1', 'NPE', 'null false 0', '"" false 0'], answer: 2, run: true, expect: 'null false 0', explain: 'If the function returns null, <code>computeIfAbsent</code> stores <b>nothing</b> and returns null. No NPE: the null never enters the map. Handy for “load if it exists”. But a failed lookup is retried on every call.' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;
import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        ConcurrentHashMap<String, Integer> m = new ConcurrentHashMap<>(Map.of("a", 1));
        m.merge("a", 5, (oldV, newV) -> null);
        m.merge("b", 5, (oldV, newV) -> null);
        System.out.println(m);
    }
}`, options: ['{a=1, b=5}', '{b=5}', '{}', '{a=null, b=null}'], answer: 1, run: true, expect: '{b=5}', explain: 'For "a" the key exists, so the function runs and returns null. That <b>removes</b> the entry. For "b" the key is missing, so <code>merge</code> stores 5 and never calls the function. Result: <b>{b=5}</b>.' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        BlockingQueue<Integer> q = new ArrayBlockingQueue<>(1);
        System.out.print(q.offer(1) + " " + q.offer(2) + " ");
        try { q.add(3); } catch (IllegalStateException e) { System.out.print("ISE "); }
        System.out.println(q.poll() + " " + q.poll());
    }
}`, options: ['true true ISE 1 2', 'true false ISE 1 null', 'true false 1 3', 'It blocks forever'], answer: 1, run: true, expect: 'true false ISE 1 null', explain: 'The queue holds one element. When full, <code>offer</code> returns false, <code>add</code> throws <code>IllegalStateException("Queue full")</code>, and <code>put</code> would wait. When empty, <code>poll</code> returns null and <code>take</code> would wait. Four method families: throw, special value, wait, time out.' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        SynchronousQueue<Integer> q = new SynchronousQueue<>();
        System.out.println(q.offer(1) + " " + q.size() + " " + q.peek());
    }
}`, options: ['true 1 1', 'true 0 null', 'false 0 null', 'It blocks forever'], answer: 2, run: true, expect: 'false 0 null', explain: 'A SynchronousQueue holds <b>nothing</b>. An <code>offer</code> succeeds only if a consumer is already waiting in <code>take</code>/<code>poll</code>. None is, so it returns false. <code>size()</code> is always 0 and <code>peek()</code> always null. <code>Executors.newCachedThreadPool</code> uses it, so every task either finds an idle thread or gets a new one.' },
    { kind: 'concept', q: 'Which operation is <b>O(n)</b> on a <code>ConcurrentLinkedQueue</code>?', options: ['offer', 'poll', 'size', 'peek'], answer: 2, explain: 'offer, poll and peek work at the ends of the linked list in O(1). <code>size()</code> walks the whole list, because there is no shared counter (one would slow writers). The result may be out of date when it returns. The docs warn it is “NOT a constant-time operation”. (<code>ConcurrentSkipListMap</code> used to traverse too, but modern JDKs such as 21 keep a LongAdder count, so its <code>size()</code> is cheap, though still only an estimate under concurrent writes.)' },
    { kind: 'concept', q: 'How does ConcurrentHashMap (Java 8+) handle a put into an <b>empty</b> bin?', options: ['Locks a Segment', 'CAS of the new node into the table slot, with no lock', 'synchronized on the whole map', 'Copies the table'], answer: 1, explain: 'An empty bin is filled with one <b>CAS</b>. A full bin is locked with <code>synchronized</code> on its first node. Reads never lock. During a resize, moved bins are marked with a ForwardingNode. Threads that hit one help move bins.' }
  ],
  interview: [
    { q: 'How does ConcurrentHashMap achieve thread safety without a global lock?', a: '<ul><li><b>Reads</b>: volatile reads, no locking.</li><li><b>Writes to an empty bin</b>: CAS the node in.</li><li><b>Writes to a full bin</b>: <code>synchronized</code> on the bin’s first node. So threads only compete per bin.</li><li><b>Resize</b>: step by step, shared. Moved bins hold a ForwardingNode, and writers that hit one help move bins.</li><li><b>Counting</b>: <code>baseCount</code> plus several CounterCells.</li></ul>', fu: 'What did Java 7 do? (16 Segments by default, each a ReentrantLock over its own sub-table. At most 16 writers at once.)', lvl: 'deep' },
    { q: 'Why doesn’t ConcurrentHashMap allow nulls?', a: '<p>To avoid doubt. In a HashMap, if <code>get(k)</code> returns null, you can ask <code>containsKey(k)</code>. Nothing changes in between. In a concurrent map, another thread could act between the two calls. Banning nulls makes “null means absent” always true. The one-step methods rely on that.</p>', lvl: 'core' },
    { q: 'putIfAbsent vs computeIfAbsent?', a: '<p>Both run in one step. <code>putIfAbsent(k, v)</code> takes a ready value, built even if unused. It returns the old value or null. <code>computeIfAbsent(k, fn)</code> runs <code>fn</code> only if the key is missing, under the bin lock. It returns the current value, old or new. If <code>fn</code> returns null, nothing is stored.</p>', lvl: 'core' },
    { q: 'Are ConcurrentHashMap iterators fail-fast?', a: '<p>No, they are <b>weakly consistent</b>. They never throw ConcurrentModificationException. They show the map at some moment after the iterator was made. They may or may not show later changes. The same goes for <code>size()</code> and bulk operations like <code>forEach</code>, <code>reduce</code> and <code>search</code> (which also take a parallelism threshold).</p>', lvl: 'core' },
    { q: 'When is CopyOnWriteArrayList the right choice?', a: '<p>When reads and loops far outnumber writes, and the list is small to medium. Think listener lists, plugin registries, routing tables. Reads take no lock. Iterators are frozen copies: they never throw CME and don’t support <code>remove</code>. Every write copies the whole array under a lock. So each write costs O(n) in time and memory.</p>', lvl: 'core' },
    { q: 'Compare ArrayBlockingQueue, LinkedBlockingQueue, SynchronousQueue and PriorityBlockingQueue.', a: '<ul><li><b>ArrayBlockingQueue</b>: a ring-shaped array with a fixed size. One lock for both ends. Memory use is predictable.</li><li><b>LinkedBlockingQueue</b>: limit optional (default <code>Integer.MAX_VALUE</code>). Separate put and take locks, so faster under load. But one node per element.</li><li><b>SynchronousQueue</b>: holds nothing. A direct hand-off.</li><li><b>PriorityBlockingQueue</b>: a heap with no limit. <code>put</code> never waits.</li><li>Also: <code>DelayQueue</code> (elements available after a delay), <code>LinkedTransferQueue</code>.</li></ul>', lvl: 'deep' },
    { q: 'Explain the four method families of BlockingQueue.', a: '<p>Throw: <code>add</code>/<code>remove</code>/<code>element</code>. Special value: <code>offer</code>/<code>poll</code>/<code>peek</code> (false or null). Block: <code>put</code>/<code>take</code>. Time out: <code>offer(e, t, unit)</code>/<code>poll(t, unit)</code>. In request code, prefer the timed versions. Then a stuck consumer can’t hang your threads forever.</p>', lvl: 'core' },
    { q: 'What is ConcurrentSkipListMap, and when would you use it?', a: '<p>A thread-safe <code>NavigableMap</code>. It is a sorted linked list where random nodes get shortcut levels. So searches skip ahead, O(log n) on average. Updates use CAS, with no locks. Use it when many threads need sorted order or ranges: order books, time-based schedulers, leaderboards. On current JDKs <code>size()</code> reads a LongAdder count. Cheap, but only an estimate while others write.</p>', lvl: 'deep' },
    { q: 'How would you count events per key at high throughput?', a: '<p><code>ConcurrentHashMap&lt;String, LongAdder&gt;</code>: <code>map.computeIfAbsent(k, x -&gt; new LongAdder()).increment()</code>. The map lock is taken only on the first insert. LongAdder spreads increments across cells, so threads don’t fight over one busy key. Read with <code>sum()</code>, an estimate under load. At normal rates, <code>merge(k, 1L, Long::sum)</code> is simpler.</p>', lvl: 'deep' },
    { q: 'Collections.synchronizedMap vs ConcurrentHashMap?', a: '<p><code>synchronizedMap</code> wraps every call in one lock. Correct, but readers and writers go one at a time. And you must lock the map yourself while looping over it. ConcurrentHashMap scales reads without locks and writes per bin, and adds atomic compound operations. Choose synchronizedMap only to wrap a special map (e.g. a LinkedHashMap LRU) where contention is low.</p>', lvl: 'core' }
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
}`, note: 'With a size-limited queue, the pool grows from core to max only <i>after</i> the queue is full. Core = max avoids that surprise.' },
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
// shutdown: q.put(POISON) once per consumer`, note: 'If you catch InterruptedException and don’t rethrow, set the flag again (<code>Thread.currentThread().interrupt()</code>).' }
  ]
});

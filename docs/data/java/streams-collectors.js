IA.register({
  track: 'java',
  slug: 'streams-collectors',
  title: 'Streams & collectors',
  tagline: 'A stream is a <b>lazy pipeline</b>. Nothing runs until the last step asks for elements. Then they travel <b>one at a time</b> through every stage. Some stages must wait for all elements. Collectors have sharp edges: duplicate keys, nulls, unordered maps. And <code>parallel()</code> borrows a thread pool the whole JVM shares.',
  tldr: {
    problem: 'Logging in <code>peek</code> never shows up. <code>toMap</code> throws on data that “can’t have duplicates”. A report’s order changes between runs. A parallel stream making HTTP calls freezes other async work in the service.',
    model: 'Middle steps (<code>filter</code>, <code>map</code>, <code>sorted</code>…) only <b>describe</b> work. The last step (<code>collect</code>, <code>findFirst</code>, <code>forEach</code>…) pulls each element through the chain. Some last steps stop early. <code>sorted</code> and <code>distinct</code> must remember what they saw. Parallel streams split the work across <code>ForkJoinPool.commonPool()</code>.',
    hook: '“Is <code>stream.parallel()</code> a free speed-up?” No. It helps only for CPU-heavy work on large data that splits easily, with no shared state. It runs on a pool the whole JVM shares, so blocking there hurts everyone.',
    facts: [
      { v: 'Java 8', l: 'introduced streams. Java 9 added <code>takeWhile</code>, <code>dropWhile</code>, <code>ofNullable</code> and <code>iterate</code> with a predicate; Java 16 added <code>Stream.toList()</code>' },
      { v: 'cores − 1', l: 'is the common pool’s default parallelism (<code>availableProcessors() - 1</code>). The thread that calls the terminal operation also helps with the work' },
      { v: 'once', l: 'per stream: a second terminal operation throws <code>IllegalStateException: stream has already been operated upon or closed</code>' }
    ]
  },
  intro: {
    what: 'A <b>stream</b> lets you say what to do with data, not how to loop. “Keep paid orders, take their totals, add them up.” You start from a source: a collection, an array, a file. You chain middle steps (<b>intermediate</b> operations), each returning a new stream. You finish with one last step (a <b>terminal</b> operation) that gives a result. A <b>collector</b> is the recipe <code>collect</code> uses to build a List, Set, Map or summary.',
    analogy: { icon: '🏭', title: 'An assembly line that starts when an order comes in', text: 'Setting up the stations (filter, paint, pack) produces nothing. When a customer orders “the first red car”, items roll through all stations one by one, and the line stops as soon as one red car is packed. A station that must see every item before passing any on, like “sort by weight”, holds up the whole line.' },
    steps: [
      { t: 'Source → intermediate ops → terminal op', d: 'Only the terminal op makes anything happen.', code: 'BigDecimal paid = orders.stream()          // source\n    .filter(Order::isPaid)                 // intermediate\n    .map(Order::total)                     // intermediate\n    .reduce(BigDecimal.ZERO, BigDecimal::add);   // terminal' },
      { t: 'Collect into structures', d: '<code>toList()</code>, <code>Collectors.toSet()</code>, <code>groupingBy</code> (a Map of lists), <code>toMap</code> (one value per key), <code>joining</code> (a String).', code: 'Map<Status, List<Order>> byStatus = orders.stream()\n    .collect(Collectors.groupingBy(Order::status));' },
      { t: 'Use primitive streams for numbers', d: '<code>mapToInt</code>, <code>mapToLong</code> and <code>IntStream.range</code> skip wrapping numbers in objects (<i>boxing</i>) and give you <code>sum()</code>, <code>average()</code> and <code>summaryStatistics()</code>.' },
      { t: 'Keep lambdas side-effect free', d: 'Don’t add to outside lists or counters from inside the pipeline. Let the collector build the result.' }
    ],
    terms: [
      ['intermediate operation', 'A middle step. Returns a new stream and does no work yet: <code>filter</code>, <code>map</code>, <code>flatMap</code>, <code>sorted</code>, <code>distinct</code>, <code>limit</code>…'],
      ['terminal operation', 'The last step. Gives a result and uses up the stream: <code>collect</code>, <code>reduce</code>, <code>forEach</code>, <code>count</code>, <code>findFirst</code>…'],
      ['short-circuiting', 'Can stop before reading everything: <code>findFirst</code>, <code>anyMatch</code>, <code>limit</code>, <code>takeWhile</code>.'],
      ['stateful operation', 'Must remember earlier elements: <code>sorted</code>, <code>distinct</code>, and <code>limit</code>/<code>skip</code> in ordered parallel streams.'],
      ['collector', 'A recipe for building a result: create a container, add to it, merge two, finish.'],
      ['common pool', '<code>ForkJoinPool.commonPool()</code>: one thread pool for the whole JVM. Parallel streams use it, and so does <code>CompletableFuture.*Async</code> by default.']
    ]
  },
  visual: {
    title: 'One element at a time, through every stage',
    caption: 'Each row is an element and each column a stage. Press <b>Play</b>. <b>Lazy + short-circuit</b> shows elements travelling across a row and the pipeline stopping early. <b>sorted() is a barrier</b> shows buffering. <b>toMap duplicate key</b> shows a collector failing, and <b>No terminal op</b> shows that nothing runs at all.'
  },
  gotchas: [
    { trap: '<code>toMap</code> throws on duplicate keys and null values', code: `Map<String, User> byEmail = users.stream()
    .collect(Collectors.toMap(User::email, u -> u));   // IllegalStateException: Duplicate key …
// and NullPointerException if any value is null`, why: 'Without a merge function, a duplicate key is an error, not an overwrite. Since Java 9 the message names the key and both values. A null value also throws.', fix: 'Choose what a duplicate means. <code>toMap(k, v, (a, b) -&gt; a)</code> keeps the first. Use <code>groupingBy</code> when duplicates are real. Filter or replace nulls before collecting.' },
    { trap: '<code>groupingBy</code> gives you an unordered HashMap', code: `var byMonth = invoices.stream().collect(groupingBy(Invoice::month));   // iteration order not defined`, why: 'The default map is a <code>HashMap</code>. Reports, JSON and CSV built from it can change order between runs or JDK versions. A null classifier result throws <code>NullPointerException: element cannot be mapped to a null key</code>.', fix: 'Pass a map factory: <code>groupingBy(Invoice::month, TreeMap::new, toList())</code> or <code>LinkedHashMap::new</code>. Replace null keys with a placeholder first.' },
    { trap: 'Blocking work in a parallel stream', code: `ids.parallelStream()
   .map(id -> restClient.get().uri("/users/{id}", id).retrieve().body(User.class))   // blocks a common-pool thread
   .toList();`, why: 'Every parallel stream and default <code>supplyAsync</code> call shares the common pool. It has about one thread per core. Blocking I/O there starves other work. And so few threads are too few for I/O anyway.', fix: 'For many parallel I/O calls, use your own executor. On Java 21, <code>Executors.newVirtualThreadPerTaskExecutor()</code> fits well. Keep parallel streams for CPU-heavy work on large in-memory data.' },
    { trap: 'Side effects from stream lambdas', code: `List<String> out = new ArrayList<>();
names.parallelStream().filter(…).forEach(out::add);   // races: lost elements, ArrayIndexOutOfBounds`, why: 'ArrayList isn’t thread-safe. Code that relies on side effects breaks once someone adds <code>.parallel()</code>. In parallel, <code>forEach</code> also ignores the original order.', fix: 'Return the result from a collector: <code>.filter(…).toList()</code>. Use <code>forEachOrdered</code> only when you really need ordered side effects.' },
    { trap: '<code>peek</code> and <code>map</code> may not run at all', code: `long n = List.of(1, 2, 3).stream().peek(log::info).count();   // Java 9+: prints nothing`, why: 'Since Java 9, <code>count()</code> may skip the pipeline when it already knows the size. A pipeline with no last step never runs.', fix: 'Use <code>peek</code> for debugging only. Never put required work (saving, sending, auditing) in <code>peek</code> or <code>map</code>. Use <code>forEach</code> at the end, or a plain loop.' },
    { trap: 'Unbounded stateful ops on infinite streams', code: `Stream.iterate(1, i -> i + 1).sorted().limit(10).toList();     // never finishes
Stream.iterate(1, i -> i + 1).distinct().limit(10).toList();   // fine: distinct can emit as it goes`, why: '<code>sorted</code> must see every element before emitting the first one. <code>distinct</code> can pass new elements through immediately, but its memory grows with every distinct element it sees.', fix: 'Put <code>limit</code> or <code>takeWhile</code> before <code>sorted</code>, or sort a bounded collection.' },
    { trap: 'Streams over I/O resources must be closed', code: `Files.lines(path).filter(…).count();                 // leaks a file handle
repo.streamAllByStatus(OPEN).forEach(this::export);  // Spring Data: needs a transaction and closing`, why: 'Streams over files, folders or database cursors hold resources until <code>close()</code>. Streams over collections don’t need closing, so people forget.', fix: 'Use try-with-resources: <code>try (Stream&lt;String&gt; lines = Files.lines(path)) { … }</code>. Spring Data JPA methods returning <code>Stream&lt;T&gt;</code> also need an open (read-only) transaction.' }
  ],
  scenarios: [
    { title: 'Checkout latency spiked whenever the recommendations job ran',
      symptom: 'Every few minutes, slow-request latency (p99) on unrelated endpoints jumped from 80 ms to 9 s. Thread dumps showed every <code>ForkJoinPool.commonPool-worker</code> thread blocked in socket reads.',
      diagnose: `// RecommendationJob
products.parallelStream()
        .map(p -> pricingClient.price(p.id()))    // blocking HTTP, 200–800 ms each
        .toList();

// CheckoutService (unrelated): uses the same common pool by default
CompletableFuture.supplyAsync(() -> tax.compute(cart));`,
      cause: 'The parallel stream filled the common pool (cores − 1 threads) with blocking HTTP calls. <code>supplyAsync</code> without an executor queues on that same pool, so checkout’s tax computation waited behind them.',
      fix: 'Never block in the common pool. Give parallel I/O its own executor (virtual threads on Java 21). Pass your own executors to <code>CompletableFuture</code> in services.',
      fixCode: `List<Future<Price>> fs;
try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {   // Java 21
  fs = products.stream()
      .map(p -> exec.submit(() -> pricingClient.price(p.id())))
      .toList();
}                                                 // close() waits for every task
prices = fs.stream().map(Future::resultNow).toList();   // Java 19+
CompletableFuture.supplyAsync(() -> tax.compute(cart), cpuExecutor);   // explicit pool` },
    { title: 'Login sync crashed after a customer created a second account',
      symptom: 'The nightly identity sync failed with <code>IllegalStateException: Duplicate key ana@example.com (attempted merging values User[id=17…] and User[id=902…])</code>.',
      diagnose: `Map<String, User> byEmail = users.stream()
    .collect(Collectors.toMap(u -> u.email().toLowerCase(Locale.ROOT), u -> u));`,
      cause: 'Email was unique only case-sensitively in the database. After normalising to lower case, two accounts collided. Two-argument <code>toMap</code> treats any collision as fatal.',
      fix: 'Decide what a collision means. Here: keep the most recently active account and report the rest. Enforce the rule in the database with a unique index on <code>lower(email)</code>.',
      fixCode: `Map<String, User> byEmail = users.stream().collect(Collectors.toMap(
    u -> u.email().toLowerCase(Locale.ROOT),
    u -> u,
    (a, b) -> a.lastLogin().isAfter(b.lastLogin()) ? a : b));

-- and in Postgres
CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));` },
    { title: 'Monthly statement columns came out in random order',
      symptom: 'Finance reported that columns in the CSV export switched places between runs. Snapshot tests were flaky for the same reason.',
      diagnose: `Map<YearMonth, BigDecimal> totals = invoices.stream()
    .collect(groupingBy(Invoice::month,
             reducing(BigDecimal.ZERO, Invoice::amount, BigDecimal::add)));
totals.forEach((month, sum) -> header.add(month.toString()));   // HashMap order`,
      cause: '<code>groupingBy</code> defaults to a HashMap, whose iteration order is unspecified. It depends on hash codes, capacity and insertion history.',
      fix: 'Choose the map type that carries the order you need.',
      fixCode: `Map<YearMonth, BigDecimal> totals = invoices.stream()
    .collect(groupingBy(Invoice::month, TreeMap::new,
             reducing(BigDecimal.ZERO, Invoice::amount, BigDecimal::add)));` }
  ],
  puzzles: [
    { kind: 'predict', q: 'In what order do the lines print?', code: `import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        var r = Stream.of("a", "bb", "ccc", "dd")
            .filter(s -> { System.out.println("filter " + s); return s.length() > 1; })
            .map(s -> { System.out.println("map " + s); return s.toUpperCase(); })
            .findFirst();
        System.out.println(r.get());
    }
}`, options: ['filter a / filter bb / filter ccc / filter dd / map bb / map ccc / map dd / BB', 'filter a / filter bb / map bb / BB', 'BB / filter a / filter bb / map bb', 'filter a / map a / filter bb / map bb / BB'], answer: 1, explain: 'Elements go through the whole pipeline one at a time. <code>findFirst</code> stops at the first result. "a" is filtered out, "bb" is filtered and mapped, and "ccc" and "dd" are never touched. Prints <b>filter a, filter bb, map bb, BB</b>.', run: true, expect: 'filter a\nfilter bb\nmap bb\nBB' },
    { kind: 'predict', q: 'What does this print on Java 21?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        long n = List.of(1, 2, 3).stream()
            .peek(x -> System.out.println("peek " + x))
            .count();
        System.out.println(n);
    }
}`, options: ['peek 1 / peek 2 / peek 3 / 3', '3', 'peek 1 / 1', 'Nothing: peek without forEach is invalid'], answer: 1, explain: 'Since Java 9, <code>count()</code> may read the size straight from the source and skip the pipeline. <code>peek</code> can’t change the size. The <code>count()</code> Javadoc uses nearly this example. Prints only <b>3</b>.', run: true, expect: '3' },
    { kind: 'predict', q: 'A stateful barrier. What does this print?', code: `import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        int first = Stream.of(3, 1, 2)
            .peek(x -> System.out.println("peek " + x))
            .sorted()
            .map(x -> { System.out.println("map " + x); return x * 10; })
            .findFirst().get();
        System.out.println(first);
    }
}`, options: ['peek 3 / map 3 / 30', 'peek 3 / peek 1 / peek 2 / map 1 / map 2 / map 3 / 10', 'peek 3 / peek 1 / peek 2 / map 1 / 10', 'peek 1 / map 1 / 10'], answer: 2, explain: '<code>sorted</code> must collect every element before it can pass on the smallest. So all three are peeked first. After sorting, early stopping works again: only 1 is mapped before <code>findFirst</code> stops. Prints <b>peek 3, peek 1, peek 2, map 1, 10</b>.', run: true, expect: 'peek 3\npeek 1\npeek 2\nmap 1\n10' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        try {
            Map<Character, String> m = Stream.of("apple", "avocado", "banana")
                .collect(Collectors.toMap(s -> s.charAt(0), s -> s));
            System.out.println(m);
        } catch (IllegalStateException e) {
            System.out.println(e.getMessage());
        }
    }
}`, options: ['{a=avocado, b=banana}', '{a=apple, b=banana}', 'Duplicate key a (attempted merging values apple and avocado)', 'Duplicate key avocado'], answer: 2, explain: 'Two-argument <code>toMap</code> has no merge function, so the second <code>\'a\'</code> key throws. Since Java 9 the message names the key and both values. Prints <b>Duplicate key a (attempted merging values apple and avocado)</b>.', run: true, expect: 'Duplicate key a (attempted merging values apple and avocado)' },
    { kind: 'predict', q: 'groupingBy with a map factory and a downstream collector. What does this print?', code: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        var m = Stream.of("apple", "avocado", "banana", "cherry", "blueberry")
            .collect(Collectors.groupingBy(s -> s.charAt(0), TreeMap::new, Collectors.counting()));
        System.out.println(m);
    }
}`, options: ['{a=2, b=2, c=1}', '{a=[apple, avocado], b=[banana, blueberry], c=[cherry]}', '{c=1, b=2, a=2}', '{a=2, b=1, c=1, b=1}'], answer: 0, explain: '<code>counting()</code> turns each group into a <code>Long</code>, and <code>TreeMap::new</code> sorts the keys. Prints <b>{a=2, b=2, c=1}</b>.', run: true, expect: '{a=2, b=2, c=1}' },
    { kind: 'predict', q: 'Reusing a stream. What does this print?', code: `import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Stream<Integer> s = Stream.of(1, 2, 3);
        System.out.println(s.mapToInt(x -> x).sum());
        try {
            System.out.println(s.count());
        } catch (IllegalStateException e) {
            System.out.println("ISE");
        }
    }
}`, options: ['6 / 3', '6 / ISE', '6 / 0', 'ISE / ISE'], answer: 1, explain: '<code>mapToInt</code> adds a stage to <code>s</code> and uses it up. Any further use of <code>s</code> throws <code>IllegalStateException</code>. Prints <b>6</b> then <b>ISE</b>.', run: true, expect: '6\nISE' },
    { kind: 'predict', q: 'takeWhile vs filter (Java 9+). What does this print?', code: `import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        System.out.println(Stream.of(1, 2, 5, 1, 2).takeWhile(x -> x < 3).toList());
        System.out.println(Stream.of(1, 2, 5, 1, 2).filter(x -> x < 3).toList());
    }
}`, options: ['[1, 2, 1, 2] / [1, 2, 1, 2]', '[1, 2] / [1, 2, 1, 2]', '[1, 2] / [1, 2]', '[5] / [1, 2, 1, 2]'], answer: 1, explain: '<code>takeWhile</code> stops at the first element that fails the test (5). <code>filter</code> checks every element. Prints <b>[1, 2]</b> then <b>[1, 2, 1, 2]</b>.', run: true, expect: '[1, 2]\n[1, 2, 1, 2]' },
    { kind: 'concept', q: 'What does <code>IntStream.rangeClosed(1, 4).parallel().reduce(10, Integer::sum)</code> return?', options: ['Always 20', 'Always 10', 'It depends on how the stream is split, e.g. 50 with four chunks', 'It throws: reduce can’t be used in parallel'], answer: 2, explain: 'The start value is added once per chunk. So it must be a neutral value (0 for sum). With four chunks the result is 10×4 + 1 + 2 + 3 + 4 = 50. The split depends on the pool. Run in sequence, it would be 20. reduce needs a neutral start value and a function where grouping doesn’t matter.' }
  ],
  interview: [
    { q: 'Explain laziness and short-circuiting in streams.', a: '<p>Middle steps build a pipeline and do no work. The last step pulls elements from the source. Each element goes through all stages before the next is read. Some operations (<code>findFirst</code>, <code>anyMatch</code>, <code>limit</code>, <code>takeWhile</code>) stop early. That makes infinite sources usable.</p>', lvl: 'core' },
    { q: 'Stateless vs stateful intermediate operations: why does it matter?', a: '<p>Stateless ops (<code>filter</code>, <code>map</code>, <code>flatMap</code>, <code>peek</code>) look at one element at a time. Stateful ops (<code>sorted</code>, <code>distinct</code>, and <code>limit</code>/<code>skip</code> on ordered parallel streams) must remember elements. <code>sorted</code> holds everything back. It uses O(n) memory and never finishes on an infinite stream. In parallel, stateful ops may need extra passes or buffering.</p>', lvl: 'core' },
    { q: 'Walk me through groupingBy, partitioningBy and toMap.', a: '<ul><li><code>groupingBy(classifier[, mapFactory][, downstream])</code>: a Map from key to the downstream result (a List by default, otherwise <code>counting()</code>, <code>mapping()</code>, <code>summingLong()</code>, <code>maxBy()</code>, <code>toSet()</code>…). The default map is a HashMap.</li><li><code>partitioningBy(predicate[, downstream])</code>: always a two-entry map, <code>true</code> and <code>false</code>, even if one side is empty.</li><li><code>toMap(key, value[, merge][, mapFactory])</code>: one value per key. Without <code>merge</code> a duplicate throws, and null values throw.</li></ul>', lvl: 'core' },
    { q: 'When do parallel streams actually help?', a: '<p>Only when all of these hold. Each element needs real CPU work. The data is large. The source splits cheaply (arrays, <code>ArrayList</code>, <code>IntStream.range</code>; not <code>LinkedList</code>, <code>Stream.iterate</code> or I/O-backed streams). Nothing shared is changed. Combining results is cheap. Measure with JMH. In a web server, every request shares the common pool, so parallel streams compete.</p>', fu: 'Can you run a parallel stream in your own pool? Running the last step inside your own <code>ForkJoinPool</code> works in practice, but nothing promises it. Prefer explicit executors.', lvl: 'deep' },
    { q: 'reduce vs collect?', a: '<p><code>reduce</code> combines values into new values (sum, max, <code>BigDecimal::add</code>). The start value must be neutral, and grouping must not matter. <code>collect</code> fills a container instead. Each thread fills its own (ArrayList, StringBuilder, HashMap), then they are merged. Building a list with <code>reduce</code> copies at every step. Use <code>collect</code> for that.</p>', lvl: 'deep' },
    { q: 'What is encounter order? How do findAny, forEach and unordered() relate to it?', a: '<p>Lists and arrays have an order. <code>findFirst</code>, <code>limit</code>, <code>toList</code> and <code>forEachOrdered</code> keep it, even in parallel, which costs coordination. <code>findAny</code>, <code>forEach</code> and <code>unordered()</code> drop the order to make parallel runs cheaper. A HashSet has no order to start with.</p>', lvl: 'deep' },
    { q: 'Are streams slower than loops?', a: '<p>For small, simple loops, streams can be a bit slower. They create extra objects and calls. With primitive streams and a good JIT the gap is often small. The real costs are boxing (<code>Stream&lt;Integer&gt;</code> instead of <code>IntStream</code>) and extra work, like sorting before filtering. Pick streams for readability. Use loops in hot spots you have measured.</p>', lvl: 'core' },
    { q: 'What changed about count() in Java 9, and why should you care?', a: '<p><code>count()</code> may skip the pipeline when it already knows the size: the source knows it, and no stage filters or flat-maps. So <code>peek</code> or <code>map</code> side effects may never run. Keep stream lambdas free of side effects. The library may skip them.</p>', lvl: 'deep' },
    { q: 'How do you stream large database results in Spring Data JPA?', a: '<p>Return <code>Stream&lt;T&gt;</code> from a repository method. Call it inside <code>@Transactional(readOnly = true)</code>. Read it in try-with-resources. Set a JDBC fetch size (<code>@QueryHints(@QueryHint(name = HINT_FETCH_SIZE, value = "500"))</code>) . The driver then streams rows instead of loading them all. On Postgres the fetch size works only with autocommit off, which a transaction gives you. Clear processed entities so the session cache doesn’t grow forever.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Reporting with collectors', lang: 'java', code: `record Line(String region, YearMonth month, BigDecimal amount, boolean refunded) {}

// region → month → net total, both levels sorted
Map<String, Map<YearMonth, BigDecimal>> report = lines.stream()
    .filter(l -> !l.refunded())
    .collect(groupingBy(Line::region, TreeMap::new,
             groupingBy(Line::month, TreeMap::new,
                        reducing(BigDecimal.ZERO, Line::amount, BigDecimal::add))));

// paid vs refunded, both keys always present
Map<Boolean, Long> split = lines.stream().collect(partitioningBy(Line::refunded, counting()));

// id → line, explicit duplicate policy, insertion order kept
Map<String, Line> latest = lines.stream().collect(toMap(
    l -> l.region() + ":" + l.month(), l -> l, (a, b) -> b, LinkedHashMap::new));` },
    { title: 'Streaming rows from JPA', lang: 'java', code: `public interface OrderRepository extends JpaRepository<Order, Long> {
    @QueryHints(@QueryHint(name = org.hibernate.jpa.HibernateHints.HINT_FETCH_SIZE, value = "500"))
    @Query("select o from Order o where o.createdAt >= :since order by o.id")
    Stream<Order> streamSince(@Param("since") Instant since);
}

@Transactional(readOnly = true)          // the cursor needs an open transaction
public void export(Instant since, Writer out) throws IOException {
    try (Stream<Order> orders = repo.streamSince(since)) {
        Iterator<Order> it = orders.iterator();
        int n = 0;
        while (it.hasNext()) {
            Order o = it.next();
            out.write(csv(o));
            if (++n % 500 == 0) em.clear();   // keep the persistence context small
        }
    }
}`, note: 'A plain loop over the iterator keeps the checked <code>IOException</code> from <code>Writer</code> easy to handle.' },
    { title: 'CPU work in parallel, I/O elsewhere', lang: 'java', code: `// CPU-bound, large in-memory array: a good fit for a parallel stream
double[] scores = IntStream.range(0, candidates.length).parallel()
    .mapToDouble(i -> model.score(candidates[i]))   // pure function, no shared state
    .toArray();

// I/O-bound fan-out: never the common pool. Java 21 virtual threads instead.
List<Quote> quotes;
try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
    quotes = suppliers.stream()
        .map(s -> exec.submit(() -> s.quote(request)))   // one virtual thread per call
        .toList()                                        // submit all before waiting
        .stream()
        .map(f -> { try { return f.get(); } catch (Exception e) { throw new IllegalStateException(e); } })
        .toList();
}` }
  ]
});

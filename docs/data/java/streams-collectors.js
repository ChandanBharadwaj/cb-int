IA.register({
  track: 'java',
  slug: 'streams-collectors',
  title: 'Streams & collectors',
  tagline: 'A stream is a <b>lazy pipeline</b>. Nothing runs until a terminal operation pulls elements, which then travel <b>one at a time</b> through every stage. Stateful stages are barriers, collectors have sharp edges (duplicate keys, nulls, unordered maps), and <code>parallel()</code> borrows a pool shared by the whole JVM.',
  tldr: {
    problem: 'Logging in <code>peek</code> never appears, <code>toMap</code> throws on data that “can’t have duplicates”, report ordering changes between runs, and a parallel stream doing HTTP calls freezes unrelated async work across the service.',
    model: 'Intermediate ops (<code>filter</code>, <code>map</code>, <code>sorted</code>…) only <b>describe</b> work. A terminal op (<code>collect</code>, <code>findFirst</code>, <code>forEach</code>…) pulls each element through the whole chain. Short-circuit ops stop early. Stateful ops (<code>sorted</code>, <code>distinct</code>) must buffer first. Parallel streams split the source across <code>ForkJoinPool.commonPool()</code>.',
    hook: '“Is <code>stream.parallel()</code> a free speed-up?” No. It helps only for CPU-bound work on large, easily split sources with no shared state, and it runs on the JVM-wide common pool, so blocking in it hurts everyone else.',
    facts: [
      { v: 'Java 8', l: 'introduced streams. Java 9 added <code>takeWhile</code>, <code>dropWhile</code>, <code>ofNullable</code> and <code>iterate</code> with a predicate; Java 16 added <code>Stream.toList()</code>' },
      { v: 'cores − 1', l: 'is the common pool’s default parallelism (<code>availableProcessors() - 1</code>). The thread that calls the terminal operation also helps with the work' },
      { v: 'once', l: 'per stream: a second terminal operation throws <code>IllegalStateException: stream has already been operated upon or closed</code>' }
    ]
  },
  intro: {
    what: 'A <b>stream</b> lets you describe a data-processing pipeline declaratively, “keep paid orders, take their totals, add them up”, instead of writing the loop yourself. You start from a source (a collection, an array, a file), chain <b>intermediate</b> operations that each return a new stream, and finish with one <b>terminal</b> operation that produces a result. A <b>collector</b> is the recipe a terminal <code>collect</code> uses to build a List, Set, Map or summary.',
    analogy: { icon: '🏭', title: 'An assembly line that starts when an order comes in', text: 'Setting up the stations (filter, paint, pack) produces nothing. When a customer orders “the first red car”, items roll through all stations one by one, and the line stops as soon as one red car is packed. A station that must see every item before passing any on, like “sort by weight”, holds up the whole line.' },
    steps: [
      { t: 'Source → intermediate ops → terminal op', d: 'Only the terminal op makes anything happen.', code: 'BigDecimal paid = orders.stream()          // source\n    .filter(Order::isPaid)                 // intermediate\n    .map(Order::total)                     // intermediate\n    .reduce(BigDecimal.ZERO, BigDecimal::add);   // terminal' },
      { t: 'Collect into structures', d: '<code>toList()</code>, <code>Collectors.toSet()</code>, <code>groupingBy</code> (a Map of lists), <code>toMap</code> (one value per key), <code>joining</code> (a String).', code: 'Map<Status, List<Order>> byStatus = orders.stream()\n    .collect(Collectors.groupingBy(Order::status));' },
      { t: 'Use primitive streams for numbers', d: '<code>mapToInt</code>, <code>mapToLong</code> and <code>IntStream.range</code> avoid boxing and give you <code>sum()</code>, <code>average()</code> and <code>summaryStatistics()</code>.' },
      { t: 'Keep lambdas side-effect free', d: 'Don’t add to outside lists or counters from inside the pipeline. Let the collector build the result.' }
    ],
    terms: [
      ['intermediate operation', 'Returns a new stream and is lazy: <code>filter</code>, <code>map</code>, <code>flatMap</code>, <code>sorted</code>, <code>distinct</code>, <code>limit</code>…'],
      ['terminal operation', 'Produces a result or side effect and consumes the stream: <code>collect</code>, <code>reduce</code>, <code>forEach</code>, <code>count</code>, <code>findFirst</code>…'],
      ['short-circuiting', 'Can finish without reading the whole source: <code>findFirst</code>, <code>anyMatch</code>, <code>limit</code>, <code>takeWhile</code>.'],
      ['stateful operation', 'Needs to remember previous elements: <code>sorted</code>, <code>distinct</code>, and <code>limit</code>/<code>skip</code> in ordered parallel streams.'],
      ['collector', 'A recipe for mutable reduction: supplier, accumulator, combiner, finisher.'],
      ['common pool', '<code>ForkJoinPool.commonPool()</code>: the JVM-wide pool used by parallel streams and, by default, by <code>CompletableFuture.*Async</code>.']
    ]
  },
  visual: {
    title: 'One element at a time, through every stage',
    caption: 'Each row is an element and each column a stage. Press <b>Play</b>. <b>Lazy + short-circuit</b> shows elements travelling across a row and the pipeline stopping early. <b>sorted() is a barrier</b> shows buffering. <b>toMap duplicate key</b> shows a collector failing, and <b>No terminal op</b> shows that nothing runs at all.'
  },
  gotchas: [
    { trap: '<code>toMap</code> throws on duplicate keys and null values', code: `Map<String, User> byEmail = users.stream()
    .collect(Collectors.toMap(User::email, u -> u));   // IllegalStateException: Duplicate key …
// and NullPointerException if any value is null`, why: 'Without a merge function, a duplicate key is an error, not an overwrite. Since Java 9 the message names the key and both values. Values are inserted via a null-hostile path, so a null value throws.', fix: 'Decide the policy explicitly: <code>toMap(k, v, (a, b) -&gt; a)</code> to keep the first, or <code>groupingBy</code> when duplicates are real. Filter or replace nulls before collecting.' },
    { trap: '<code>groupingBy</code> gives you an unordered HashMap', code: `var byMonth = invoices.stream().collect(groupingBy(Invoice::month));   // iteration order not defined`, why: 'The default map factory is <code>HashMap::new</code>. Reports, JSON responses and CSV columns built from it can change order between runs or JDK versions. A null classifier result throws <code>NullPointerException: element cannot be mapped to a null key</code>.', fix: 'Pass a map factory: <code>groupingBy(Invoice::month, TreeMap::new, toList())</code> or <code>LinkedHashMap::new</code>. Map null keys to a sentinel first.' },
    { trap: 'Blocking work in a parallel stream', code: `ids.parallelStream()
   .map(id -> restClient.get().uri("/users/{id}", id).retrieve().body(User.class))   // blocks a common-pool thread
   .toList();`, why: 'All parallel streams and default <code>CompletableFuture.supplyAsync</code> calls in the JVM share the common pool, with about one thread per core. Blocking I/O in it starves unrelated work, and the parallelism is far too low for I/O-bound work anyway.', fix: 'For I/O fan-out use an explicit executor. On Java 21, <code>Executors.newVirtualThreadPerTaskExecutor()</code> is the natural fit. Keep parallel streams for CPU-bound work on large in-memory data.' },
    { trap: 'Side effects from stream lambdas', code: `List<String> out = new ArrayList<>();
names.parallelStream().filter(…).forEach(out::add);   // races: lost elements, ArrayIndexOutOfBounds`, why: 'ArrayList isn’t thread-safe, and even sequential code that depends on side effects breaks when someone adds <code>.parallel()</code>. <code>forEach</code> also doesn’t respect encounter order in parallel.', fix: 'Return the result from a collector: <code>.filter(…).toList()</code>. Use <code>forEachOrdered</code> only when you really need ordered side effects.' },
    { trap: '<code>peek</code> and <code>map</code> may not run at all', code: `long n = List.of(1, 2, 3).stream().peek(log::info).count();   // Java 9+: prints nothing`, why: 'Since Java 9, <code>count()</code> may skip the pipeline entirely when the size is known from the source and no stage can change it. Pipelines without a terminal operation never run.', fix: 'Use <code>peek</code> for debugging only. Never put required work (saving, sending, auditing) in <code>peek</code> or <code>map</code>; use a terminal <code>forEach</code> or a plain loop.' },
    { trap: 'Unbounded stateful ops on infinite streams', code: `Stream.iterate(1, i -> i + 1).sorted().limit(10).toList();     // never finishes
Stream.iterate(1, i -> i + 1).distinct().limit(10).toList();   // fine: distinct can emit as it goes`, why: '<code>sorted</code> must see every element before emitting the first one. <code>distinct</code> can pass new elements through immediately, but its memory grows with every distinct element it sees.', fix: 'Put <code>limit</code> or <code>takeWhile</code> before <code>sorted</code>, or sort a bounded collection.' },
    { trap: 'Streams over I/O resources must be closed', code: `Files.lines(path).filter(…).count();                 // leaks a file handle
repo.streamAllByStatus(OPEN).forEach(this::export);  // Spring Data: needs a transaction and closing`, why: 'Streams backed by files, directories or database cursors hold resources until <code>close()</code>. Unlike iterators, streams over collections don’t need closing, so people forget.', fix: 'Use try-with-resources: <code>try (Stream&lt;String&gt; lines = Files.lines(path)) { … }</code>. Spring Data JPA <code>Stream&lt;T&gt;</code> query methods also need an open (read-only) transaction.' }
  ],
  scenarios: [
    { title: 'Checkout latency spiked whenever the recommendations job ran',
      symptom: 'p99 latency of unrelated endpoints jumped from 80 ms to 9 s every few minutes. Thread dumps showed every <code>ForkJoinPool.commonPool-worker</code> thread blocked in socket reads.',
      diagnose: `// RecommendationJob
products.parallelStream()
        .map(p -> pricingClient.price(p.id()))    // blocking HTTP, 200–800 ms each
        .toList();

// CheckoutService (unrelated): uses the same common pool by default
CompletableFuture.supplyAsync(() -> tax.compute(cart));`,
      cause: 'The parallel stream filled the common pool (cores − 1 threads) with blocking HTTP calls. <code>supplyAsync</code> without an executor queues on that same pool, so checkout’s tax computation waited behind them.',
      fix: 'Never block in the common pool. Give I/O fan-out its own executor (virtual threads on Java 21), and pass explicit executors to <code>CompletableFuture</code> in services.',
      fixCode: `try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {   // Java 21
  List<Future<Price>> fs = products.stream()
      .map(p -> exec.submit(() -> pricingClient.price(p.id())))
      .toList();
  prices = fs.stream().map(Main::join).toList();
}
CompletableFuture.supplyAsync(() -> tax.compute(cart), cpuExecutor);   // explicit pool` },
    { title: 'Login sync crashed after a customer created a second account',
      symptom: 'The nightly identity sync failed with <code>IllegalStateException: Duplicate key ana@example.com (attempted merging values User[id=17…] and User[id=902…])</code>.',
      diagnose: `Map<String, User> byEmail = users.stream()
    .collect(Collectors.toMap(u -> u.email().toLowerCase(Locale.ROOT), u -> u));`,
      cause: 'Email was unique only case-sensitively in the database. After normalising to lower case, two accounts collided. Two-argument <code>toMap</code> treats any collision as fatal.',
      fix: 'Decide what a collision means (here: keep the most recently active account, and report the rest), and enforce the invariant in the database with a unique index on <code>lower(email)</code>.',
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
}`, options: ['filter a / filter bb / filter ccc / filter dd / map bb / map ccc / map dd / BB', 'filter a / filter bb / map bb / BB', 'BB / filter a / filter bb / map bb', 'filter a / map a / filter bb / map bb / BB'], answer: 1, explain: 'Elements travel through the whole pipeline one at a time, and <code>findFirst</code> stops at the first result. "a" is filtered out, "bb" is filtered and mapped, and "ccc" and "dd" are never touched. Prints <b>filter a, filter bb, map bb, BB</b>.', run: true, expect: 'filter a\nfilter bb\nmap bb\nBB' },
    { kind: 'predict', q: 'What does this print on Java 21?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        long n = List.of(1, 2, 3).stream()
            .peek(x -> System.out.println("peek " + x))
            .count();
        System.out.println(n);
    }
}`, options: ['peek 1 / peek 2 / peek 3 / 3', '3', 'peek 1 / 1', 'Nothing: peek without forEach is invalid'], answer: 1, explain: 'Since Java 9, <code>count()</code> may compute the result straight from a SIZED source without running the pipeline, and <code>peek</code> can’t change the size. The <code>count()</code> Javadoc uses almost this exact example. Prints only <b>3</b>.', run: true, expect: '3' },
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
}`, options: ['peek 3 / map 3 / 30', 'peek 3 / peek 1 / peek 2 / map 1 / map 2 / map 3 / 10', 'peek 3 / peek 1 / peek 2 / map 1 / 10', 'peek 1 / map 1 / 10'], answer: 2, explain: '<code>sorted</code> must buffer every element before it can emit the smallest, so all three are peeked first. After sorting, short-circuiting resumes: only 1 is mapped before <code>findFirst</code> stops. Prints <b>peek 3, peek 1, peek 2, map 1, 10</b>.', run: true, expect: 'peek 3\npeek 1\npeek 2\nmap 1\n10' },
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
}`, options: ['6 / 3', '6 / ISE', '6 / 0', 'ISE / ISE'], answer: 1, explain: '<code>mapToInt</code> links a new stage to <code>s</code> and consumes it. Any further use of <code>s</code> throws <code>IllegalStateException</code>. Prints <b>6</b> then <b>ISE</b>.', run: true, expect: '6\nISE' },
    { kind: 'predict', q: 'takeWhile vs filter (Java 9+). What does this print?', code: `import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        System.out.println(Stream.of(1, 2, 5, 1, 2).takeWhile(x -> x < 3).toList());
        System.out.println(Stream.of(1, 2, 5, 1, 2).filter(x -> x < 3).toList());
    }
}`, options: ['[1, 2, 1, 2] / [1, 2, 1, 2]', '[1, 2] / [1, 2, 1, 2]', '[1, 2] / [1, 2]', '[5] / [1, 2, 1, 2]'], answer: 1, explain: '<code>takeWhile</code> stops at the first element that fails the predicate (5) and is short-circuiting. <code>filter</code> checks every element. Prints <b>[1, 2]</b> then <b>[1, 2, 1, 2]</b>.', run: true, expect: '[1, 2]\n[1, 2, 1, 2]' },
    { kind: 'concept', q: 'What does <code>IntStream.rangeClosed(1, 4).parallel().reduce(10, Integer::sum)</code> return?', options: ['Always 20', 'Always 10', 'It depends on how the stream is split, e.g. 50 with four chunks', 'It throws: reduce can’t be used in parallel'], answer: 2, explain: 'The identity is applied once per chunk, so it must really be an identity (0 for sum). With four leaf chunks the result is 10×4 + 1 + 2 + 3 + 4 = 50, and the split depends on the pool. Sequentially it would be 20. reduce needs an identity value and an associative function.' }
  ],
  interview: [
    { q: 'Explain laziness and short-circuiting in streams.', a: '<p>Intermediate operations build a pipeline and do no work. When a terminal operation starts, it pulls elements from the source, and each element goes through all stages before the next one is read (fused, vertical processing). Short-circuiting operations (<code>findFirst</code>, <code>anyMatch</code>, <code>limit</code>, <code>takeWhile</code>) stop the pull early, which makes infinite sources usable.</p>', lvl: 'core' },
    { q: 'Stateless vs stateful intermediate operations: why does it matter?', a: '<p>Stateless ops (<code>filter</code>, <code>map</code>, <code>flatMap</code>, <code>peek</code>) look at one element at a time. Stateful ops (<code>sorted</code>, <code>distinct</code>, and <code>limit</code>/<code>skip</code> on ordered parallel streams) need to remember elements. <code>sorted</code> is a full barrier: it buffers everything, uses O(n) memory and never finishes on an infinite stream. In parallel, stateful ops may need several passes or extra buffering.</p>', lvl: 'core' },
    { q: 'Walk me through groupingBy, partitioningBy and toMap.', a: '<ul><li><code>groupingBy(classifier[, mapFactory][, downstream])</code>: a Map from key to the downstream result (a List by default, otherwise <code>counting()</code>, <code>mapping()</code>, <code>summingLong()</code>, <code>maxBy()</code>, <code>toSet()</code>…). The default map is a HashMap.</li><li><code>partitioningBy(predicate[, downstream])</code>: always a two-entry map, <code>true</code> and <code>false</code>, even if one side is empty.</li><li><code>toMap(key, value[, merge][, mapFactory])</code>: one value per key. Without <code>merge</code> a duplicate throws, and null values throw.</li></ul>', lvl: 'core' },
    { q: 'When do parallel streams actually help?', a: '<p>When all of these hold: the work per element is CPU-bound and not tiny, the data set is large, the source splits cheaply (arrays, <code>ArrayList</code>, <code>IntStream.range</code>; not <code>LinkedList</code>, <code>Stream.iterate</code> or I/O-backed streams), there is no shared mutable state, and the combining step is cheap. Measure with JMH. In a web server, the common pool is shared by every request, so parallel streams compete with each other.</p>', fu: 'Can you run a parallel stream in your own pool? Submitting the terminal operation from inside a custom <code>ForkJoinPool</code> works in practice, but it is an implementation detail. Prefer explicit executors.', lvl: 'deep' },
    { q: 'reduce vs collect?', a: '<p><code>reduce</code> is an <i>immutable</i> reduction: it combines values into new values (sum, max, <code>BigDecimal::add</code>). The identity must be a real identity and the operation must be associative. <code>collect</code> is a <i>mutable</i> reduction: each thread accumulates into its own container (ArrayList, StringBuilder, HashMap) and the combiner merges them. Using <code>reduce</code> to build a list copies on every step; use <code>collect</code> for that.</p>', lvl: 'deep' },
    { q: 'What is encounter order? How do findAny, forEach and unordered() relate to it?', a: '<p>Sources like List and arrays have an encounter order, and operations such as <code>findFirst</code>, <code>limit</code>, <code>toList</code> and <code>forEachOrdered</code> respect it, even in parallel, which costs coordination. <code>findAny</code>, <code>forEach</code> and <code>unordered()</code> give up the order so that parallel execution can be cheaper. HashSet sources have no defined order to begin with.</p>', lvl: 'deep' },
    { q: 'Are streams slower than loops?', a: '<p>For simple loops over small collections, streams can be slightly slower: extra objects, lambda dispatch, and less predictable inlining. With primitive streams and good JIT inlining the difference is often small. The biggest real-world costs are boxing (<code>Stream&lt;Integer&gt;</code> instead of <code>IntStream</code>) and accidentally doing more work, for example sorting before filtering. Choose streams for readability, and use loops in measured hot spots.</p>', lvl: 'core' },
    { q: 'What changed about count() in Java 9, and why should you care?', a: '<p><code>count()</code> may skip running the pipeline when it can compute the size directly: the source is SIZED and no stage filters or flat-maps. So <code>peek</code> or <code>map</code> lambdas with side effects may never run. It is a reminder that stream lambdas should be side-effect free, and that the library is free to optimise them away.</p>', lvl: 'deep' },
    { q: 'How do you stream large database results in Spring Data JPA?', a: '<p>Declare a repository method returning <code>Stream&lt;T&gt;</code>, call it inside <code>@Transactional(readOnly = true)</code>, consume it in try-with-resources, and set a JDBC fetch size (<code>@QueryHints(@QueryHint(name = HINT_FETCH_SIZE, value = "500"))</code>) so the driver streams instead of loading every row. For Postgres the fetch size only takes effect with autocommit off, which a transaction provides. Detach or clear processed entities so the persistence context doesn’t grow without bound.</p>', lvl: 'deep' }
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

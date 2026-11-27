IA.register({
  track: 'java',
  slug: 'lambdas-functional',
  title: 'Lambdas & functional interfaces',
  tagline: 'A lambda is an object that implements a one-method interface. The compiler moves its body into a private method. At runtime, an <b>invokedynamic</b> instruction builds the object. A lambda holds a <b>copy of each value</b> it uses. That copy explains most lambda surprises.',
  tldr: {
    problem: 'A listener never unregisters. A counter loses updates in parallel code. An NPE fires where a method reference is <i>created</i>. A call picks <code>Callable</code> instead of <code>Runnable</code>. A Comparator overflows.',
    model: 'A lambda is an instance of a <b>functional interface</b>. Its body becomes a private method. The expression becomes <code>invokedynamic</code>, set up once by <code>LambdaMetafactory</code>. Local variables it uses are <b>copied</b> in, so they must never change. <code>this</code> means the outer object. <code>obj::method</code> looks up <code>obj</code> <b>right away</b>.',
    hook: '“Why must captured variables be effectively final?” The lambda stores a <i>copy</i> of the value. If the variable changed later, the copy and the variable would disagree. With threads, that is a data race.',
    facts: [
      { v: 'Java 8', l: 'introduced lambdas, method references and <code>java.util.function</code>. Lambdas use <code>invokedynamic</code>, which arrived in Java 7 (JSR 292)' },
      { v: 'Java 15', l: 'made lambda classes <b>hidden classes</b> (JEP 371): not discoverable by name, and unloadable independently of other classes' },
      { v: '1 method', l: 'abstract method makes an interface functional. Default methods, static methods and public <code>Object</code> methods such as <code>equals</code> don’t count' }
    ]
  },
  intro: {
    what: 'A <b>lambda</b> is a short piece of behaviour you pass around like a value: <code>x -&gt; x * 2</code>. Java needs a type for it. So a lambda always implements an interface with one abstract method (a <b>functional interface</b>). <code>Runnable</code>, <code>Comparator</code> and <code>Function</code> are examples. <code>String::length</code> is shorter still: a lambda that calls one existing method (a <b>method reference</b>).',
    analogy: { icon: '📝', title: 'Instructions on an index card', text: 'You don’t write a whole handbook (a new class) to say “sort by date”. You hand over an index card with one instruction. The card can mention values from your desk. But it holds a <i>photocopy</i> made when you wrote it. So you may not change those values afterwards.' },
    steps: [
      { t: 'Functional interface = one job', d: 'Any interface with one abstract method can be the target of a lambda.', code: '@FunctionalInterface\ninterface PriceRule {\n  BigDecimal apply(BigDecimal price);\n}\nPriceRule tenOff = p -> p.multiply(new BigDecimal("0.90"));' },
      { t: 'Use the built-ins first', d: '<code>Supplier&lt;T&gt;</code> (no input), <code>Consumer&lt;T&gt;</code> (no output), <code>Function&lt;T,R&gt;</code>, <code>Predicate&lt;T&gt;</code> (boolean), <code>UnaryOperator&lt;T&gt;</code>, <code>BinaryOperator&lt;T&gt;</code>, plus <code>Int…</code>/<code>Long…</code> versions that avoid boxing.' },
      { t: 'Method references', d: '<code>Integer::parseInt</code> (static), <code>String::length</code> (any instance), <code>order::total</code> (a specific instance), <code>ArrayList::new</code> (constructor).' },
      { t: 'Captured variables must not change', d: 'A lambda can read local variables only if they are <b>effectively final</b>: never reassigned after initialisation.', code: 'int limit = 10;\nPredicate<Order> big = o -> o.items() > limit;   // ok\n// limit = 20;  would make the lambda above a compile error' }
    ],
    terms: [
      ['functional interface', 'An interface with exactly one abstract method. <code>@FunctionalInterface</code> makes the compiler check it.'],
      ['lambda expression', '<code>(params) -&gt; body</code>: an instance of a functional interface.'],
      ['capture', 'Using an outside variable inside the lambda. Its value is copied into the lambda object.'],
      ['effectively final', 'A local variable that is never reassigned, even without the <code>final</code> keyword.'],
      ['method reference', '<code>Type::method</code> or <code>expr::method</code>: a lambda that calls one existing method.'],
      ['invokedynamic', 'A bytecode instruction that picks its target at runtime, on first use. Lambdas, string joining with <code>+</code> and pattern switches use it.']
    ]
  },
  visual: {
    title: 'What actually happens when a lambda runs',
    caption: 'Press <b>Play</b>. <b>invokedynamic, once</b> shows the call site being linked on first use and then reused. <b>Capturing a local</b> shows the value being copied into the lambda object. <b>Bound method ref & null</b> shows a method reference failing at creation time, not at call time.'
  },
  gotchas: [
    { trap: 'You can’t unregister a method reference', code: `bus.register(this::onEvent);
// later
bus.unregister(this::onEvent);   // a NEW object: not equal, nothing removed`, why: 'Each time <code>this::onEvent</code> runs, you get a new object. Lambdas don’t override <code>equals</code>. So the listener stays registered and keeps <code>this</code> alive. After re-registering, events are handled twice.', fix: 'Store the reference once in a field (<code>private final Consumer&lt;Event&gt; handler = this::onEvent;</code>) and use that same object for both calls, or have <code>register</code> return a subscription handle that you close.' },
    { trap: 'Mutating captured state through an array or holder', code: `int[] total = {0};
orders.parallelStream().forEach(o -> total[0] += o.qty());   // lost updates`, why: 'Only the array <i>reference</i> must stay fixed. Its contents can change. From several threads, the updates race and some are lost.', fix: 'Express it as a reduction: <code>orders.stream().mapToInt(Order::qty).sum()</code>. If you really need shared accumulation, use a <code>LongAdder</code>.' },
    { trap: 'A bound method reference evaluates its receiver early', code: `Supplier<String> s = config.current()::name;   // current() runs NOW, once
// later config changes, but s still holds the old object`, why: 'For <code>expr::method</code>, <code>expr</code> is evaluated when the reference is created, and null throws an NPE immediately. A lambda <code>() -&gt; config.current().name()</code> evaluates on every call.', fix: 'Use a lambda when the receiver must be looked up at call time. Use the bound reference when you deliberately want to capture the current object.' },
    { trap: '<code>this</code> in a lambda is the enclosing object', code: `class Cache {
  void warm() {
    scheduler.scheduleAtFixedRate(() -> refresh(), 0, 1, MINUTES);   // captures this
  }
}`, why: 'A lambda has no <code>this</code> of its own, unlike an anonymous class. Calling an instance method captures the outer object. A long-lived scheduler then keeps that whole object alive.', fix: 'Cancel what you schedule (keep the <code>ScheduledFuture</code>), and make lambdas held by long-lived objects capture only the data they need.' },
    { trap: 'Boxing through generic functional interfaces', code: `Function<Integer, Integer> sq = x -> x * x;   // unbox, multiply, box: per call
IntUnaryOperator sqFast = x -> x * x;          // primitive in, primitive out`, why: 'Generics can’t hold primitives, so <code>Function&lt;Integer, Integer&gt;</code> wraps every value in an object. In hot code that means extra garbage.', fix: 'Use the primitive specialisations (<code>IntFunction</code>, <code>ToLongFunction</code>, <code>IntPredicate</code>, <code>IntStream</code>…) for numeric work.' },
    { trap: 'Lambdas pick an unexpected overload', code: `executor.submit(() -> { throw new IOException(); });   // picks Callable: compiles
executor.submit(() -> doWork());                        // Callable if doWork() returns a value`, why: 'A lambda that returns a value (or always throws) fits <code>Callable</code>. The compiler prefers that over the void version. The exception then hides inside the returned Future.', fix: 'Be explicit when it matters: cast <code>(Runnable) () -&gt; …</code>, or give overloads different names (Spring’s <code>execute</code> vs <code>submit</code>).' },
    { trap: 'Subtraction Comparators overflow', code: `list.sort((a, b) -> a.priority() - b.priority());    // wrong for large or negative ints`, why: '<code>Integer.MIN_VALUE - 1</code> overflows to a large positive number. The order becomes inconsistent, and TimSort may throw “Comparison method violates its general contract!”.', fix: '<code>Comparator.comparingInt(Task::priority)</code> or <code>Integer.compare(a, b)</code>.' }
  ],
  scenarios: [
    { title: 'Every websocket message was handled twice, then three times…',
      symptom: 'After each client reconnect, chat messages were processed one extra time. Heap usage crept up and old session objects showed up in heap dumps.',
      diagnose: `void onConnect()    { hub.addListener(this::deliver); }
void onDisconnect() { hub.removeListener(this::deliver); }   // removes nothing

// heap dump: hub.listeners → 37 × Session$$Lambda → Session (each holding buffers)`,
      cause: 'Each <code>this::deliver</code> made a new lambda object. <code>removeListener</code> found no equal one. So every connect added a listener that was never removed. Each one kept its old Session alive.',
      fix: 'Create the listener once and reuse that same instance, or use an API that returns a handle.',
      fixCode: `private final Consumer<Message> listener = this::deliver;   // one instance

void onConnect()    { hub.addListener(listener); }
void onDisconnect() { hub.removeListener(listener); }

// or: AutoCloseable sub = hub.subscribe(this::deliver); … sub.close();` },
    { title: 'Nightly totals were 2–5% lower than the database',
      symptom: 'A reconciliation report summed order quantities in Java and disagreed with <code>SELECT sum(qty)</code>, by a different amount each night.',
      diagnose: `long[] total = {0};
orders.parallelStream()
      .filter(Order::isPaid)
      .forEach(o -> total[0] += o.qty());   // race: += is read, add, write`,
      cause: 'The lambda captured the array reference (effectively final), and many common-pool threads updated <code>total[0]</code> at the same time. Concurrent read-add-write sequences overwrote each other.',
      fix: 'Don’t mutate shared state from stream lambdas. Use a reduction, which is correct in parallel by construction.',
      fixCode: `long total = orders.parallelStream()
    .filter(Order::isPaid)
    .mapToLong(Order::qty)
    .sum();` },
    { title: '“Comparison method violates its general contract!” in the job scheduler',
      symptom: 'Sorting the job queue failed intermittently with <code>IllegalArgumentException</code> from <code>TimSort</code>, but only when an urgent job (priority <code>Integer.MIN_VALUE</code>) was queued.',
      diagnose: `queue.sort((a, b) -> a.priority() - b.priority());`,
      cause: 'Subtraction overflowed for extreme values, so the comparator wasn’t transitive. TimSort detects some of these inconsistencies and throws.',
      fix: 'Use comparator factories, which compare without arithmetic.',
      fixCode: `queue.sort(Comparator.comparingInt(Job::priority)
                     .thenComparing(Job::createdAt));` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Capturing an enhanced-for variable. What does this print?', code: `import java.util.*;
import java.util.function.*;

public class Main {
    public static void main(String[] args) {
        List<Supplier<Integer>> fs = new ArrayList<>();
        for (int i : new int[] {1, 2, 3}) {
            fs.add(() -> i * 10);
        }
        System.out.println(fs.stream().map(f -> String.valueOf(f.get())).toList());
    }
}`, options: ['[30, 30, 30]', '[10, 20, 30]', 'Compile error: i is not effectively final', '[0, 10, 20]'], answer: 1, explain: 'In an enhanced <code>for</code>, the loop variable is a fresh, effectively final variable in each iteration, so each lambda captures its own value. (A classic <code>for (int i = 0; …; i++)</code> would not compile, because <code>i</code> is reassigned.) Prints <b>[10, 20, 30]</b>.', run: true, expect: '[10, 20, 30]' },
    { kind: 'predict', q: '<code>this</code> in a lambda vs an anonymous class. What does this print?', code: `public class Main {
    String name = "outer";

    void run() {
        Runnable lam = () -> System.out.println(this.name);
        Runnable anon = new Runnable() {
            String name = "anon";
            public void run() { System.out.println(this.name); }
        };
        lam.run();
        anon.run();
    }

    public static void main(String[] args) {
        new Main().run();
    }
}`, options: ['outer / anon', 'outer / outer', 'anon / anon', 'Compile error: this is not allowed in a lambda'], answer: 0, explain: 'A lambda doesn’t introduce a new scope for <code>this</code>, so it refers to the enclosing <code>Main</code>. An anonymous class is a real class, and <code>this</code> is the anonymous instance. Prints <b>outer</b> then <b>anon</b>.', run: true, expect: 'outer\nanon' },
    { kind: 'predict', q: 'When does the NPE happen?', code: `import java.util.function.*;

public class Main {
    public static void main(String[] args) {
        String s = null;
        Supplier<Integer> a = () -> s.length();
        System.out.println("lambda ok");
        try {
            Supplier<Integer> b = s::length;
            System.out.println("ref ok");
        } catch (NullPointerException e) {
            System.out.println("NPE at creation");
        }
    }
}`, options: ['lambda ok / ref ok', 'lambda ok / NPE at creation', 'NPE at creation', 'Compile error: s might be null'], answer: 1, explain: 'The lambda only captures the null value; it would throw later, when <code>get()</code> is called. For a bound method reference, JLS §15.13.3 says the receiver is evaluated when the reference is created, and a null receiver throws then. Prints <b>lambda ok</b> then <b>NPE at creation</b>.', run: true, expect: 'lambda ok\nNPE at creation' },
    { kind: 'predict', q: 'Two identical method references. What does this print on OpenJDK 21?', code: `public class Main {
    void hello() {}

    public static void main(String[] args) {
        Main m = new Main();
        Runnable r1 = m::hello;
        Runnable r2 = m::hello;
        System.out.println(r1 == r2);
        System.out.println(r1.equals(r2));
    }
}`, options: ['true / true', 'false / true', 'false / false', 'true / false'], answer: 2, explain: 'A bound method reference captures <code>m</code>, so each evaluation creates a new instance, and lambda classes inherit identity <code>equals</code>. Prints <b>false</b>, <b>false</b>. The JLS deliberately leaves lambda identity unspecified, so don’t rely on it in either direction. This is the root of the “can’t unregister a listener” bug.', run: true, expect: 'false\nfalse' },
    { kind: 'predict', q: 'Overload resolution with lambdas. What does this print?', code: `import java.util.concurrent.*;

public class Main {
    static void run(Runnable r) { System.out.println("Runnable"); }
    static void run(Callable<?> c) { System.out.println("Callable"); }

    public static void main(String[] args) {
        run(() -> {});
        run(() -> 42);
        run(() -> { throw new Exception(); });
    }
}`, options: ['Runnable / Callable / Runnable', 'Runnable / Callable / Callable', 'Runnable / Runnable / Callable', 'Compile error: ambiguous call'], answer: 1, explain: '<code>() -&gt; {}</code> can only be void, so Runnable. <code>() -&gt; 42</code> must return a value, so Callable. A block that always throws fits both shapes, and the most-specific rule prefers the non-void function type, so Callable. That is why it compiles even though <code>Runnable.run</code> can’t throw a checked exception. Prints <b>Runnable, Callable, Callable</b>.', run: true, expect: 'Runnable\nCallable\nCallable' },
    { kind: 'predict', q: 'andThen vs compose. What does this print?', code: `import java.util.function.*;

public class Main {
    public static void main(String[] args) {
        Function<Integer, Integer> plus1 = x -> x + 1;
        Function<Integer, Integer> times2 = x -> x * 2;
        System.out.println(plus1.andThen(times2).apply(5) + " " + plus1.compose(times2).apply(5));
    }
}`, options: ['12 11', '11 12', '12 12', '11 11'], answer: 0, explain: '<code>f.andThen(g)</code> is g(f(x)) = (5 + 1) × 2 = 12. <code>f.compose(g)</code> is f(g(x)) = 5 × 2 + 1 = 11. Prints <b>12 11</b>.', run: true, expect: '12 11' },
    { kind: 'predict', q: 'A subtraction comparator. What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Comparator<Integer> bad = (a, b) -> a - b;
        Comparator<Integer> good = Integer::compare;
        int x = Integer.MIN_VALUE, y = 1;
        System.out.println(bad.compare(x, y) > 0);
        System.out.println(good.compare(x, y) > 0);
    }
}`, options: ['false / false', 'true / false', 'true / true', 'ArithmeticException'], answer: 1, explain: '<code>MIN_VALUE - 1</code> silently wraps around to <code>MAX_VALUE</code>, a positive number, so the bad comparator claims MIN_VALUE is greater than 1. Int arithmetic never throws on overflow. Prints <b>true</b> then <b>false</b>.', run: true, expect: 'true\nfalse' },
    { kind: 'concept', q: 'Does this compile?', code: `int n = 0;
Runnable r = () -> System.out.println(n);
n++;`, options: ['Yes, and r prints 0', 'Yes, and r prints 1', 'No: n must be final or effectively final', 'No: lambdas can’t use local variables'], answer: 2, explain: 'Effectively final is a property of the variable over its whole scope. The later <code>n++</code> means n is not effectively final, so the capture is rejected, even though the increment comes after the lambda: “local variables referenced from a lambda expression must be final or effectively final”.' }
  ],
  interview: [
    { q: 'What is a functional interface?', a: '<p>An interface with exactly one abstract method, which is the lambda’s target. Default and static methods don’t count, and neither do abstract methods that match public <code>Object</code> methods. <code>Comparator</code> declares <code>equals</code> and is still functional. <code>@FunctionalInterface</code> is optional; it makes the compiler check the rule and documents intent.</p>', lvl: 'core' },
    { q: 'How are lambdas implemented? How is that different from an anonymous class?', a: '<p>javac puts the body in a private synthetic method (<code>lambda$main$0</code>) and emits an <code>invokedynamic</code> whose bootstrap is <code>LambdaMetafactory</code>. On first execution the bootstrap spins a hidden class implementing the interface and links the call site permanently. Non-capturing lambdas typically become a single shared instance; capturing ones allocate an instance holding the captured values.</p><p>An anonymous class is a real <code>Outer$1.class</code> file, always captures the enclosing instance in an inner context, and has its own <code>this</code>.</p>', fu: 'Why indy rather than inner classes? It keeps the translation strategy private to the JVM, so it can change between releases, and it avoids one class file per lambda.', lvl: 'deep' },
    { q: 'Why must captured locals be effectively final?', a: '<p>Locals live on the stack frame, which may be gone by the time the lambda runs on another thread. So the lambda stores a <b>copy</b> of the value. Allowing later writes would make the copy stale and invite data races. Fields aren’t copied: the lambda captures <code>this</code> and reads the field when it runs, so fields can change, with the usual thread-safety concerns.</p>', lvl: 'core' },
    { q: 'What are the four kinds of method reference?', a: '<ul><li><b>Static</b>: <code>Integer::parseInt</code> → <code>s -&gt; Integer.parseInt(s)</code>.</li><li><b>Bound instance</b>: <code>order::total</code>. The receiver is evaluated once, when the reference is created.</li><li><b>Unbound instance</b>: <code>String::length</code> → <code>s -&gt; s.length()</code>. The receiver is the first argument.</li><li><b>Constructor</b>: <code>ArrayList::new</code>, and <code>int[]::new</code> for arrays.</li></ul>', lvl: 'core' },
    { q: 'Name the core built-in functional interfaces and when you would use each.', a: '<ul><li><code>Supplier&lt;T&gt;</code>: lazy values and factories (<code>orElseGet</code>, <code>computeIfAbsent</code>-style).</li><li><code>Consumer&lt;T&gt;</code> / <code>BiConsumer</code>: side effects (<code>forEach</code>).</li><li><code>Function&lt;T,R&gt;</code> / <code>BiFunction</code>: transformations (<code>map</code>).</li><li><code>Predicate&lt;T&gt;</code>: filters, with <code>and</code>, <code>or</code>, <code>negate</code> and <code>Predicate.not</code> (Java 11).</li><li><code>UnaryOperator</code> / <code>BinaryOperator</code>: same input and output type (<code>replaceAll</code>, <code>reduce</code>).</li><li>Primitive variants (<code>IntPredicate</code>, <code>ToLongFunction</code>, <code>LongSupplier</code>…) avoid boxing.</li></ul>', lvl: 'core' },
    { q: 'How do you handle checked exceptions in lambdas?', a: '<p>The standard interfaces don’t declare any. You can wrap the exception in an unchecked one (<code>UncheckedIOException</code>), define your own functional interface with <code>throws</code> (like Spring’s <code>TransactionCallback</code> or a <code>ThrowingFunction</code>), or keep the throwing code out of the lambda. Never swallow the exception inside the lambda.</p>', lvl: 'core' },
    { q: 'Are lambdas slow?', a: '<p>Usually not. Linking is a one-time cost per call site. Non-capturing lambdas don’t allocate per evaluation, and capturing ones allocate a small object that escape analysis often removes after inlining. The real costs tend to be <b>boxing</b> through generic interfaces and <b>megamorphic</b> call sites: a shared method like <code>Stream.map</code> called with many different lambdas can stop the JIT from inlining them. Measure with JMH before rewriting.</p>', lvl: 'deep' },
    { q: 'How does overload resolution treat lambdas?', a: '<p>A lambda has no type of its own; it gets one from the target. When several overloads accept functional interfaces, javac checks each lambda for shape compatibility (number of parameters, void vs value), and then picks the most specific. For an explicitly typed lambda, a non-void return is preferred over void, which is why <code>submit(() -&gt; { throw new Exception(); })</code> resolves to <code>Callable</code>. Implicitly typed lambdas with overloaded generic targets often produce “ambiguous” errors; casts or distinct method names fix them.</p>', lvl: 'deep' },
    { q: 'How can lambdas cause memory leaks?', a: '<p>A lambda keeps everything it captured reachable, including <code>this</code> whenever it uses an instance member. If a long-lived registry holds it (static listeners, schedulers, caches, ThreadLocals), the enclosing object can’t be collected. Combined with method references creating new instances, it is easy to register handlers that can’t be removed. Keep handler references in fields, or use subscription handles.</p>', lvl: 'deep' },
    { q: 'Can a lambda be serialised?', a: '<p>Only if its target type is <code>Serializable</code>, for example via an intersection cast <code>(Runnable &amp; Serializable) () -&gt; …</code>. The serialised form refers to the capturing class and the synthetic method name, so it is fragile across recompilation. It is also a security risk, so avoid it for persistence or messaging.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Spring callbacks are lambdas', lang: 'java', code: `// TransactionTemplate: programmatic transaction, the lambda is a TransactionCallback<T>
Order placed = tx.execute(status -> {
    Order o = orders.save(Order.from(cmd));
    outbox.save(OutboxEvent.placed(o));
    return o;
});

// JdbcClient row mapping (Spring 6.1)
List<Customer> list = jdbc.sql("select id, name, tier from customer where tier = ?")
    .param(tier.name())
    .query((rs, rowNum) -> new Customer(rs.getLong("id"), rs.getString("name"), Tier.valueOf(rs.getString("tier"))))
    .list();` },
    { title: 'Retry helper with a throwing supplier', lang: 'java', code: `@FunctionalInterface
public interface ThrowingSupplier<T, E extends Exception> {
    T get() throws E;
}

public static <T, E extends Exception> T retry(int attempts, Duration backoff,
                                               ThrowingSupplier<T, E> call) throws E, InterruptedException {
    for (int i = 1; ; i++) {
        try {
            return call.get();
        } catch (Exception e) {
            if (i >= attempts || !isTransient(e)) throw e;     // precise rethrow (Java 7) keeps E
            Thread.sleep(backoff.multipliedBy(i).toMillis());
        }
    }
}

Invoice inv = retry(3, Duration.ofMillis(200), () -> billing.fetch(id));   // checked IOException flows out` , note: 'Because <code>e</code> is effectively final and the try block can only throw <code>E</code> or unchecked exceptions, javac allows <code>throw e</code> under a <code>throws E</code> clause (precise rethrow).' },
    { title: 'Strategies as data', lang: 'java', code: `public enum Discount {
    NONE(p -> p),
    STAFF(p -> p.multiply(new BigDecimal("0.70"))),
    BLACK_FRIDAY(p -> p.subtract(new BigDecimal("10")).max(BigDecimal.ZERO));

    private final UnaryOperator<BigDecimal> rule;
    Discount(UnaryOperator<BigDecimal> rule) { this.rule = rule; }
    public BigDecimal apply(BigDecimal price) { return rule.apply(price); }
}

// composable predicates
Predicate<Order> risky = Order::isInternational;
risky = risky.and(o -> o.total().compareTo(LIMIT) > 0).or(Predicate.not(Order::hasVerifiedEmail));` }
  ]
});

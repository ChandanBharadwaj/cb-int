IA.register({
  track: 'java',
  slug: 'immutability-records',
  title: 'Immutability & records',
  tagline: '<code>final</code> freezes the pointer to an object (the <b>reference</b>), not the object. An object is immutable only if nobody can still change what is inside. Records make the outside easy. Copying what you are given makes the inside safe.',
  tldr: {
    problem: '“Immutable” DTOs and config objects change under you. A caller kept the list it passed in. Or an “unmodifiable” wrapper is only a window onto a list someone still writes to.',
    model: 'Count the arrows. An object is immutable only if every field is final <i>and</i> everything it points to is immutable, or is a private copy that never leaks. Copy on the way in. Hand out unmodifiable data on the way out.',
    hook: '“Is a record immutable?” Shallowly. <code>record Order(List&lt;String&gt; items)</code> keeps the caller’s ArrayList unless the compact constructor does <code>items = List.copyOf(items)</code>.',
    facts: [
      { v: 'Java 16', l: 'records became standard, after previews in Java 14 and 15. Sealed types followed in Java 17' },
      { v: 'view ≠ copy', l: '<code>Collections.unmodifiableList</code> shows later changes to its backing list. <code>List.of</code> (Java 9) and <code>List.copyOf</code> (Java 10) are snapshots' },
      { v: 'JLS §17.5', l: 'every thread sees an object’s final fields without locking, if <code>this</code> didn’t leak during construction' }
    ]
  },
  intro: {
    what: 'An <b>immutable</b> object can’t change after it is created. Every “change” makes a new object, the way <code>String.toUpperCase()</code> returns a new String. Such objects are easy to reason about. You can share them between threads, use them as map keys and cache them. A <b>record</b> (Java 16+) is a short way to declare a class that carries a fixed set of values.',
    analogy: { icon: '🧾', title: 'A printed receipt vs a shared spreadsheet', text: 'A printed receipt never changes after it leaves the till. A shared spreadsheet looks the same on screen, but anyone with edit access can change it while you read. <code>final</code> gives you a link that can’t be redirected. Immutability means you got a printout.' },
    steps: [
      { t: 'final stops reassignment', d: '<code>final List&lt;String&gt; xs = new ArrayList&lt;&gt;();</code> means <code>xs = …</code> won’t compile. <code>xs.add("a")</code> still works.' },
      { t: 'A record declares the state once', d: 'The compiler generates private final fields, a constructor, accessors, equals, hashCode and toString.', code: 'record Point(int x, int y) {}\nvar p = new Point(1, 2);\np.x();          // 1\np;              // Point[x=1, y=2]' },
      { t: 'Validate and copy in a compact constructor', d: 'The compact form has no parameter list. You can check or replace the parameters. The fields are set for you at the end.', code: 'record Order(String id, List<String> items) {\n  Order {\n    Objects.requireNonNull(id);\n    items = List.copyOf(items);\n  }\n}' },
      { t: 'Change by making a new value', d: 'Instead of a setter, add a “wither” that returns a modified copy: <code>order.withId("B-2")</code>.' }
    ],
    terms: [
      ['immutable', 'State can’t change after construction, through any reference.'],
      ['shallow vs deep', 'Shallow: the fields can’t be reassigned. Deep: nothing reachable from the object can change either.'],
      ['defensive copy', 'Copying changeable input on the way in (and output on the way out). Callers then can’t keep a writable handle.'],
      ['canonical constructor', 'The record constructor whose parameters match the fields exactly. The <b>compact</b> form leaves out the parameter list.'],
      ['unmodifiable view', 'A wrapper that blocks writes through itself, but still shows writes made to the list underneath.']
    ]
  },
  visual: {
    title: 'Who can still change this list?',
    caption: 'Press <b>Play</b> and count the arrows that point into each list. <b>final ≠ immutable</b> shows a record sharing its caller’s list. <b>Defensive copy</b> breaks the link in the compact constructor. <b>View vs copy</b> compares <code>unmodifiableList</code> with <code>List.copyOf</code>.'
  },
  gotchas: [
    { trap: '<code>final</code> on a mutable object', code: `private final Map<String, Price> prices = new HashMap<>();   // still writable
public static final String[] CODES = {"EU", "US"};          // CODES[0] = "XX" compiles`, why: '<code>final</code> applies to the variable. Anyone who can reach the map or array can still change it. A <code>public static final</code> array is a classic security bug.', fix: 'Expose <code>Map.copyOf(prices)</code> or an unmodifiable view. Replace public arrays with <code>List.of(…)</code>.' },
    { trap: 'Record components that are mutable', code: `record Order(List<String> items) {}
var list = new ArrayList<>(List.of("pen"));
var o = new Order(list);
list.add("ink");          // o.items() is now [pen, ink]
o.items().clear();        // and now []`, why: 'The generated constructor stores the reference it is given, and the generated accessor returns the same reference.', fix: 'Copy in the compact constructor: <code>items = List.copyOf(items);</code>. For arrays, <code>clone()</code> in the constructor <i>and</i> in your own accessor.' },
    { trap: 'An unmodifiable view is not a snapshot', code: `List<String> view = Collections.unmodifiableList(internal);
internal.add("x");        // every holder of view sees "x"`, why: 'The wrapper passes every read to the list underneath. It is not thread-safe either. If another thread writes that list, readers of the view race with it.', fix: 'Return <code>List.copyOf(internal)</code> when callers need a stable value. Keep views for cheap read-only access to data you control.' },
    { trap: '<code>List.of</code> / <code>Set.of</code> / <code>Map.of</code> are strict', code: `List.of("a", null);                   // NullPointerException
List.of("a").contains(null);          // NullPointerException, too
Set.of(email, billingEmail);          // IllegalArgumentException if they are equal
Map.of("k", 1, "k", 2);               // IllegalArgumentException: duplicate key`, why: 'The Java 9+ immutable collections reject null elements, and even null lookups. <code>Set.of</code> and <code>Map.of</code> also reject duplicates instead of merging them.', fix: 'Use them for constants and validated data. For user data that may contain duplicates, build a <code>LinkedHashSet</code> first and then <code>Set.copyOf</code> it.' },
    { trap: '<code>Stream.toList()</code> vs <code>Collectors.toList()</code>', code: `var a = stream.collect(Collectors.toList());  // ArrayList in practice, mutable
var b = stream.toList();                        // Java 16+: unmodifiable
b.add(x);                                       // UnsupportedOperationException`, why: 'They look the same but aren’t. <code>Collectors.toList</code> promises nothing about changes (it is an ArrayList today). <code>Stream.toList()</code> promises an unmodifiable list, and allows nulls.', fix: 'Use <code>toList()</code> by default. Use <code>Collectors.toCollection(ArrayList::new)</code> when you need to change the result.' },
    { trap: 'Letting <code>this</code> escape from the constructor', code: `final class Listener {
  private final Config cfg;
  Listener(Bus bus, Config cfg) {
    bus.register(this);   // another thread can call us now
    this.cfg = cfg;       // …and may still see cfg == null
  }
}`, why: 'Other threads are only sure to see final fields once the constructor has finished. Share <code>this</code> earlier, and they may see default values.', fix: 'Finish building first, then register. Use a static factory that calls the constructor, then <code>bus.register(listener)</code>.' }
  ],
  scenarios: [
    { title: 'Cached quote changed after it was sent to the customer',
      symptom: 'A customer was billed for an extra line item that wasn’t on the quote they accepted. The quote record in the cache now contained the extra line.',
      diagnose: `record Quote(String id, List<Line> lines) {}       // looks immutable
Quote q = new Quote(id, lines);                    // lines: ArrayList from the builder
quoteCache.put(id, q);
// later, the upsell step reuses the builder's list:
lines.add(upsell);                                 // the cached Quote changes too`,
      cause: 'The record kept the builder’s list. The upsell step changed that list after the quote was cached. So a “frozen” value changed.',
      fix: 'Copy changeable fields in the compact constructor. Make <code>Line</code> a record too, so nothing inside can change.',
      fixCode: `record Quote(String id, List<Line> lines) {
  Quote {
    Objects.requireNonNull(id, "id");
    lines = List.copyOf(lines);        // snapshot; also rejects null lines
  }
}
record Line(String sku, int qty, BigDecimal price) {}` },
    { title: 'Checkout failed for customers with one email address',
      symptom: 'Checkout failed with a 500, only for customers whose billing email equals their account email: <code>IllegalArgumentException: duplicate element</code>.',
      diagnose: `Set<String> recipients = Set.of(account.email(), billing.email());   // throws if equal`,
      cause: '<code>Set.of</code> rejects duplicate arguments instead of de-duplicating them. Tests always used two different addresses.',
      fix: 'Use <code>Set.of</code> only for literal constants. For runtime data, collect into a set, then make it unmodifiable.',
      fixCode: `Set<String> recipients = Stream.of(account.email(), billing.email())
    .filter(Objects::nonNull)
    .collect(Collectors.toUnmodifiableSet());   // de-duplicates; Java 10+` },
    { title: 'ConcurrentModificationException in a “read-only” price list',
      symptom: 'Pricing requests sometimes failed with <code>ConcurrentModificationException</code> while a scheduled refresh job ran.',
      diagnose: `private final Map<String, Price> prices = new HashMap<>();
public Map<String, Price> all() { return Collections.unmodifiableMap(prices); }
@Scheduled(fixedDelay = 60_000) void refresh() { prices.clear(); prices.putAll(load()); }`,
      cause: 'Readers iterated an unmodifiable <i>view</i> of the map that the refresh job was mutating. The view blocks writes through itself but doesn’t isolate readers from the writer.',
      fix: 'Build a new immutable map, then swap the reference in one step. Readers always see a complete, fixed snapshot.',
      fixCode: `private volatile Map<String, Price> prices = Map.of();
public Map<String, Price> all() { return prices; }              // immutable snapshot
@Scheduled(fixedDelay = 60_000) void refresh() { prices = Map.copyOf(load()); }` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Does this compile, and what does it print?', code: `import java.util.*;

public class Main {
    static final List<String> NAMES = new ArrayList<>();

    public static void main(String[] args) {
        NAMES.add("a");
        NAMES.add("b");
        System.out.println(NAMES);
    }
}`, options: ['Compile error: NAMES is final', '[a, b]', 'UnsupportedOperationException', '[]'], answer: 1, explain: '<code>final</code> stops <code>NAMES = …</code>, not calls that change the list. Prints <b>[a, b]</b>.', run: true, expect: '[a, b]' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<String> base = new ArrayList<>(List.of("a"));
        List<String> view = Collections.unmodifiableList(base);
        List<String> copy = List.copyOf(base);
        base.add("b");
        System.out.println(view.size() + " " + copy.size());
    }
}`, options: ['1 1', '2 1', '2 2', 'UnsupportedOperationException'], answer: 1, explain: 'The view reads from <code>base</code>, so it sees 2 elements. <code>List.copyOf</code> took a snapshot of 1 element. Prints <b>2 1</b>.', run: true, expect: '2 1' },
    { kind: 'predict', q: 'A compact constructor. What does this print?', code: `public class Main {
    record Range(int lo, int hi) {
        Range {
            if (lo > hi) {
                int t = lo;
                lo = hi;
                hi = t;
            }
        }
    }

    public static void main(String[] args) {
        System.out.println(new Range(5, 1));
    }
}`, options: ['Range[lo=5, hi=1]', 'Range[lo=1, hi=5]', 'Compile error: cannot assign to lo', 'Range@1b6d3586'], answer: 1, explain: 'In a compact constructor the names mean the <b>parameters</b>, which you may reassign. The fields are set from them at the end. The generated toString prints <b>Range[lo=1, hi=5]</b>. Assigning <code>this.lo</code> directly inside a compact constructor would not compile.', run: true, expect: 'Range[lo=1, hi=5]' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;

public class Main {
    record Cart(List<String> items) {}

    public static void main(String[] args) {
        var src = new ArrayList<>(List.of("pen"));
        var cart = new Cart(src);
        src.add("ink");
        cart.items().add("cap");
        System.out.println(cart.items().size() + " " + src.size());
    }
}`, options: ['1 2', '3 3', '2 3', 'UnsupportedOperationException'], answer: 1, explain: 'With no compact constructor, the record keeps the caller’s list, and the accessor returns it. <code>src</code>, the field and <code>cart.items()</code> are all one list. Prints <b>3 3</b>.', run: true, expect: '3 3' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<String> a = new ArrayList<>(List.of("x"));
        List<String> b = List.of("x");
        System.out.println(a.contains(null));
        try {
            System.out.println(b.contains(null));
        } catch (NullPointerException e) {
            System.out.println("NPE");
        }
    }
}`, options: ['false / false', 'false / NPE', 'NPE / NPE', 'false / true'], answer: 1, explain: '<code>ArrayList</code> allows null and answers false. The Java 9+ immutable lists treat a null <i>lookup</i> as an error and throw. The <code>Collection.contains</code> docs allow that. Prints <b>false</b> then <b>NPE</b>.', run: true, expect: 'false\nNPE' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        String a = "x", b = "x";
        try {
            System.out.println(Set.of(a, b).size());
        } catch (IllegalArgumentException e) {
            System.out.println("IAE");
        }
        System.out.println(new HashSet<>(List.of(a, b)).size());
    }
}`, options: ['1 / 1', 'IAE / 1', '2 / 1', 'IAE / 2'], answer: 1, explain: '<code>Set.of</code> throws <code>IllegalArgumentException</code> on duplicate elements. A HashSet built from a List drops duplicates quietly. Prints <b>IAE</b> then <b>1</b>.', run: true, expect: 'IAE\n1' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        List<Integer> a = Stream.of(1, 2).collect(Collectors.toList());
        a.add(3);
        List<Integer> b = Stream.of(1, 2).toList();
        try {
            b.add(3);
        } catch (UnsupportedOperationException e) {
            System.out.println("UOE");
        }
        System.out.println(a + " " + b);
    }
}`, options: ['[1, 2, 3] [1, 2, 3]', 'UOE / [1, 2, 3] [1, 2]', 'UOE / [1, 2] [1, 2]', 'Compile error: toList() is not a Stream method'], answer: 1, explain: '<code>Collectors.toList()</code> returns an ArrayList today. It can be changed, but that isn’t promised. <code>Stream.toList()</code> (Java 16+) is unmodifiable. Prints <b>UOE</b> then <b>[1, 2, 3] [1, 2]</b>.', run: true, expect: 'UOE\n[1, 2, 3] [1, 2]' },
    { kind: 'concept', q: 'Which line does <b>not</b> compile inside <code>record Point(int x, int y) { … }</code>?', options: ['<code>static int created = 0;</code>', '<code>int manhattan() { return Math.abs(x) + Math.abs(y); }</code>', '<code>private int cachedHash;</code>', '<code>Point { if (x &lt; 0) throw new IllegalArgumentException(); }</code>'], answer: 2, explain: 'Records can’t add instance fields beyond those in the header. All state lives there. Static fields, instance methods and a compact constructor are allowed. A record can’t <code>extends</code> anything (it already extends <code>java.lang.Record</code>). It can <code>implements</code> interfaces.' }
  ],
  interview: [
    { q: 'What is the difference between final and immutable?', a: '<p><code>final</code> is about a <b>variable</b>: it can be assigned only once. Immutability is about an <b>object</b>: what you can see of it can’t change. A <code>final List</code> field can point at a mutable ArrayList, and a non-final field can point at an immutable String.</p>', lvl: 'core' },
    { q: 'How do you write a truly immutable class?', a: '<ol><li>Make the class <code>final</code>, or use a record, so subclasses can’t add mutable state.</li><li>Make all fields <code>private final</code>.</li><li>Don’t provide mutators. Return new instances (“withers”).</li><li>Copy changeable inputs in the constructor. Copy or wrap them in accessors.</li><li>Don’t let <code>this</code> escape during construction.</li></ol>', fu: 'Why copy before validating? Another thread could change the input between your check and your copy. Copy first, then validate the copy.', lvl: 'core' },
    { q: 'What does the compiler generate for a record? What can’t a record do?', a: '<p>Generated: private final fields, a constructor taking every field, accessors named like the components (<code>x()</code>, not <code>getX()</code>), and equals, hashCode and toString. A record is always <code>final</code> and extends <code>java.lang.Record</code>.</p><p>It can’t extend another class, declare extra instance fields, or have non-final state. It can implement interfaces, have static members and methods, declare nested types, and override any generated member.</p>', lvl: 'core' },
    { q: 'Canonical vs compact constructor?', a: '<p>The canonical constructor has the full parameter list and must set every field. The compact form (<code>Point { … }</code>) has no parameter list. You check or clean up the <i>parameters</i>. The compiler sets the fields at the end. You can’t assign <code>this.x</code> in a compact constructor. Other constructors must call the canonical one with <code>this(…)</code>.</p>', lvl: 'core' },
    { q: 'List.of vs List.copyOf vs Collections.unmodifiableList vs Stream.toList?', a: '<ul><li><code>List.of(…)</code> (Java 9): an unmodifiable list of the arguments; nulls are rejected.</li><li><code>List.copyOf(c)</code> (Java 10): an unmodifiable snapshot; nulls are rejected; it may return <code>c</code> itself if c is already one of these lists.</li><li><code>Collections.unmodifiableList(l)</code>: a read-only <b>view</b> that shows changes to l; nulls are allowed.</li><li><code>stream.toList()</code> (Java 16): unmodifiable, and null elements are allowed.</li></ul>', lvl: 'core' },
    { q: 'Why does immutability make concurrency easier?', a: '<p>No writes means no data races. Java also promises this: a thread that sees a finished object sees its final fields correctly. That holds even if the object was shared unsafely. Changeable objects need safe sharing (volatile, locks, concurrent collections) <i>and</i> locked access afterwards.</p>', lvl: 'deep' },
    { q: 'Records with Jackson, Spring and JPA: what works?', a: '<ul><li>Jackson 2.12+ deserialises records through the canonical constructor.</li><li>Spring Boot 3 binds <code>@ConfigurationProperties</code> records through their constructor, with no <code>@ConstructorBinding</code> needed when there is one constructor.</li><li>Spring Data and JPQL constructor expressions (<code>select new …Dto(…)</code>) work well with records as read-only projections.</li><li>Records can’t be JPA <b>entities</b>: they are final, with no empty constructor and no changeable state. Hibernate 6.2+ supports records as <code>@Embeddable</code>s.</li></ul>', lvl: 'deep' },
    { q: 'How does record serialization differ from normal Java serialization?', a: '<p>A record is saved as its field values. It is rebuilt by calling the <b>canonical constructor</b>, so your checks run. Normal classes are rebuilt without a constructor. A crafted byte stream can then skip your checks.</p>', lvl: 'deep' },
    { q: 'Isn’t copying everything slow?', a: '<p>Usually not. Short-lived objects are cheap with modern GCs. <code>List.copyOf</code> of an already unmodifiable list returns it without copying. For big collections that change often, use collections that share structure (Vavr, PCollections). Or keep the changeable structure private behind a narrow API. Measure before optimising.</p>', lvl: 'deep' },
    { q: 'How do you “modify” an immutable record?', a: '<p>Write withers that return a new instance: <code>Order withStatus(Status s) { return new Order(id, items, s); }</code>. That goes through the canonical constructor again, so checks still run. Java 21 has no built-in <code>with</code> expression. “Derived record creation” is a later, separate proposal.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Value object with invariants', lang: 'java', code: `public record Order(String id, List<Line> lines, Status status) {
    public Order {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(status, "status");
        lines = List.copyOf(lines);               // copy first, then validate the copy
        if (lines.isEmpty()) throw new IllegalArgumentException("order needs a line");
    }

    public Order withStatus(Status next) {        // "setter" = new value, invariants re-checked
        return new Order(id, lines, next);
    }

    public BigDecimal total() {
        return lines.stream().map(Line::subtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}

public record Line(String sku, int qty, BigDecimal unitPrice) {
    public Line { if (qty <= 0) throw new IllegalArgumentException("qty"); }
    BigDecimal subtotal() { return unitPrice.multiply(BigDecimal.valueOf(qty)); }
}` },
    { title: 'Immutable config in Spring Boot 3', lang: 'java', code: `@ConfigurationProperties(prefix = "payments")
public record PaymentProps(
        @DefaultValue("5s") Duration timeout,
        @DefaultValue("3") int maxRetries,
        List<String> allowedCurrencies) {

    public PaymentProps {
        allowedCurrencies = allowedCurrencies == null ? List.of() : List.copyOf(allowedCurrencies);
    }
}

@SpringBootApplication
@ConfigurationPropertiesScan          // registers PaymentProps; bound via its constructor
public class App { }`, note: 'With constructor binding, the properties object is never half-filled. No stray setter can change it at runtime.' },
    { title: 'Record projections from JPA', lang: 'java', code: `public record OrderSummary(Long id, String customer, BigDecimal total) {}

public interface OrderRepository extends JpaRepository<OrderEntity, Long> {

    @Query("""
        select new com.acme.orders.OrderSummary(o.id, c.name, o.total)
        from OrderEntity o join o.customer c
        where o.status = :status""")
    List<OrderSummary> summaries(@Param("status") Status status);
}
// read-only, detached, no dirty checking, no lazy-loading surprises` }
  ]
});

IA.register({
  track: 'java',
  slug: 'immutability-records',
  title: 'Immutability & records',
  tagline: '<code>final</code> freezes a <b>reference</b>, not the object behind it. An immutable type means that nobody, anywhere, still holds a writable path into its state. Records make the shell easy, and defensive copies make the rest true.',
  tldr: {
    problem: '“Immutable” DTOs and config objects change underneath you because a caller kept a reference to the list it passed in, or because an “unmodifiable” wrapper is only a view of a list someone else is still writing to.',
    model: 'Count the arrows. An object is immutable only if every reachable field is final <i>and</i> every object it points to is immutable, or is a private copy that never escapes. Copy on the way in; return unmodifiable data on the way out.',
    hook: '“Is a record immutable?” Shallowly. <code>record Order(List&lt;String&gt; items)</code> keeps the caller’s ArrayList unless the compact constructor does <code>items = List.copyOf(items)</code>.',
    facts: [
      { v: 'Java 16', l: 'records became a standard feature (JEP 395), after previews in Java 14 and 15. Sealed types followed in Java 17' },
      { v: 'view ≠ copy', l: '<code>Collections.unmodifiableList</code> shows later changes to its backing list. <code>List.of</code> (Java 9) and <code>List.copyOf</code> (Java 10) are snapshots' },
      { v: 'JLS §17.5', l: 'final fields of a properly constructed object are visible to every thread without synchronisation, provided <code>this</code> doesn’t escape during construction' }
    ]
  },
  intro: {
    what: 'An <b>immutable</b> object can’t change after it is created. Every “change” produces a new object instead, the way <code>String.toUpperCase()</code> returns a new String. Immutable objects are easy to reason about: they can be shared between threads, used as map keys and cached without copying. A <b>record</b> (Java 16+) is a short way to declare a class whose job is to carry a fixed set of values.',
    analogy: { icon: '🧾', title: 'A printed receipt vs a shared spreadsheet', text: 'A printed receipt never changes after it leaves the till. A link to a shared spreadsheet looks the same on your screen, but anyone with edit access can change it while you read. <code>final</code> gives you a link that can’t be redirected. Immutability means you were handed a printout.' },
    steps: [
      { t: 'final stops reassignment', d: '<code>final List&lt;String&gt; xs = new ArrayList&lt;&gt;();</code> means <code>xs = …</code> won’t compile. <code>xs.add("a")</code> still works.' },
      { t: 'A record declares the state once', d: 'The compiler generates private final fields, a constructor, accessors, equals, hashCode and toString.', code: 'record Point(int x, int y) {}\nvar p = new Point(1, 2);\np.x();          // 1\np;              // Point[x=1, y=2]' },
      { t: 'Validate and copy in a compact constructor', d: 'The compact form has no parameter list. You can check or replace the parameters, and the fields are assigned automatically at the end.', code: 'record Order(String id, List<String> items) {\n  Order {\n    Objects.requireNonNull(id);\n    items = List.copyOf(items);\n  }\n}' },
      { t: 'Change by making a new value', d: 'Instead of a setter, add a “wither” that returns a modified copy: <code>order.withId("B-2")</code>.' }
    ],
    terms: [
      ['immutable', 'State can’t change after construction, through any reference.'],
      ['shallow vs deep', 'Shallow: the fields can’t be reassigned. Deep: nothing reachable from the object can change either.'],
      ['defensive copy', 'Copying mutable input on the way in (and output on the way out) so callers can’t keep a writable alias.'],
      ['canonical constructor', 'The record constructor whose parameters match the components exactly. The <b>compact</b> form omits the parameter list.'],
      ['unmodifiable view', 'A wrapper that rejects writes through itself but shows writes made to the collection it wraps.']
    ]
  },
  visual: {
    title: 'Who can still change this list?',
    caption: 'Press <b>Play</b> and count the arrows that point into each list. <b>final ≠ immutable</b> shows a record sharing its caller’s list. <b>Defensive copy</b> breaks the link in the compact constructor. <b>View vs copy</b> compares <code>unmodifiableList</code> with <code>List.copyOf</code>.'
  },
  gotchas: [
    { trap: '<code>final</code> on a mutable object', code: `private final Map<String, Price> prices = new HashMap<>();   // still writable
public static final String[] CODES = {"EU", "US"};          // CODES[0] = "XX" compiles`, why: '<code>final</code> applies to the variable. The map and the array can still be changed by anyone who can reach them. A <code>public static final</code> array is a classic security bug.', fix: 'Expose <code>Map.copyOf(prices)</code> or an unmodifiable view. Replace public arrays with <code>List.of(…)</code>.' },
    { trap: 'Record components that are mutable', code: `record Order(List<String> items) {}
var list = new ArrayList<>(List.of("pen"));
var o = new Order(list);
list.add("ink");          // o.items() is now [pen, ink]
o.items().clear();        // and now []`, why: 'The generated constructor stores the reference it is given, and the generated accessor returns the same reference.', fix: 'Copy in the compact constructor: <code>items = List.copyOf(items);</code>. For arrays, <code>clone()</code> in the constructor <i>and</i> in an explicit accessor.' },
    { trap: 'An unmodifiable view is not a snapshot', code: `List<String> view = Collections.unmodifiableList(internal);
internal.add("x");        // every holder of view sees "x"`, why: 'The wrapper delegates every read to the backing list. It is also not thread-safe: if another thread writes to the backing list, readers of the view race with that writer.', fix: 'Return <code>List.copyOf(internal)</code> when callers need a stable value. Keep views for cheap read-only access to state you own and control.' },
    { trap: '<code>List.of</code> / <code>Set.of</code> / <code>Map.of</code> are strict', code: `List.of("a", null);                   // NullPointerException
List.of("a").contains(null);          // NullPointerException, too
Set.of(email, billingEmail);          // IllegalArgumentException if they are equal
Map.of("k", 1, "k", 2);               // IllegalArgumentException: duplicate key`, why: 'The Java 9+ immutable collections reject null elements, and even reject null queries. The <code>Set.of</code> and <code>Map.of</code> factories also reject duplicates instead of silently collapsing them.', fix: 'Use them for constants and validated data. For user data that may contain duplicates, build a <code>LinkedHashSet</code> first and then <code>Set.copyOf</code> it.' },
    { trap: '<code>Stream.toList()</code> vs <code>Collectors.toList()</code>', code: `var a = stream.collect(Collectors.toList());  // ArrayList in practice, mutable
var b = stream.toList();                        // Java 16+: unmodifiable
b.add(x);                                       // UnsupportedOperationException`, why: 'They look interchangeable but aren’t. <code>Collectors.toList</code> makes no promise about mutability (it is an ArrayList today). <code>Stream.toList()</code> promises an unmodifiable list, and it allows null elements.', fix: 'Use <code>toList()</code> by default. Use <code>Collectors.toCollection(ArrayList::new)</code> when you really need to mutate the result.' },
    { trap: 'Letting <code>this</code> escape from the constructor', code: `final class Listener {
  private final Config cfg;
  Listener(Bus bus, Config cfg) {
    bus.register(this);   // another thread can call us now
    this.cfg = cfg;       // …and may still see cfg == null
  }
}`, why: 'The final-field visibility guarantee (JLS §17.5) only holds once the constructor has finished. Publishing <code>this</code> earlier lets other threads see default values.', fix: 'Finish construction first, then register: use a static factory that calls the constructor and then <code>bus.register(listener)</code>.' }
  ],
  scenarios: [
    { title: 'Cached quote changed after it was sent to the customer',
      symptom: 'A customer was billed for an extra line item that wasn’t on the quote they accepted. The quote record in the cache now contained the extra line.',
      diagnose: `record Quote(String id, List<Line> lines) {}       // looks immutable
Quote q = new Quote(id, lines);                    // lines: ArrayList from the builder
quoteCache.put(id, q);
// later, the upsell step reuses the builder's list:
lines.add(upsell);                                 // the cached Quote changes too`,
      cause: 'The record stored the builder’s mutable list. The upsell step mutated that list after the quote was cached, so a supposedly frozen value changed.',
      fix: 'Copy mutable components in the compact constructor and make <code>Line</code> a record too, so the whole object graph is immutable.',
      fixCode: `record Quote(String id, List<Line> lines) {
  Quote {
    Objects.requireNonNull(id, "id");
    lines = List.copyOf(lines);        // snapshot; also rejects null lines
  }
}
record Line(String sku, int qty, BigDecimal price) {}` },
    { title: 'Checkout failed for customers with one email address',
      symptom: 'A 500 error on checkout, only for customers whose billing email equals their account email: <code>IllegalArgumentException: duplicate element</code>.',
      diagnose: `Set<String> recipients = Set.of(account.email(), billing.email());   // throws if equal`,
      cause: '<code>Set.of</code> rejects duplicate arguments instead of de-duplicating them. Tests always used two different addresses.',
      fix: 'Use <code>Set.of</code> only for literal constants. For runtime data, collect into a set and then make it unmodifiable.',
      fixCode: `Set<String> recipients = Stream.of(account.email(), billing.email())
    .filter(Objects::nonNull)
    .collect(Collectors.toUnmodifiableSet());   // de-duplicates; Java 10+` },
    { title: 'ConcurrentModificationException in a “read-only” price list',
      symptom: 'Pricing requests intermittently failed with <code>ConcurrentModificationException</code> while a scheduled refresh job ran.',
      diagnose: `private final Map<String, Price> prices = new HashMap<>();
public Map<String, Price> all() { return Collections.unmodifiableMap(prices); }
@Scheduled(fixedDelay = 60_000) void refresh() { prices.clear(); prices.putAll(load()); }`,
      cause: 'Readers iterated an unmodifiable <i>view</i> of the map that the refresh job was mutating. The view blocks writes through itself but doesn’t isolate readers from the writer.',
      fix: 'Build a new immutable map and swap the reference atomically. Readers then always see a complete, unchanging snapshot.',
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
}`, options: ['Compile error: NAMES is final', '[a, b]', 'UnsupportedOperationException', '[]'], answer: 1, explain: '<code>final</code> prevents <code>NAMES = …</code>, not calls that mutate the list. Prints <b>[a, b]</b>.', run: true, expect: '[a, b]' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<String> base = new ArrayList<>(List.of("a"));
        List<String> view = Collections.unmodifiableList(base);
        List<String> copy = List.copyOf(base);
        base.add("b");
        System.out.println(view.size() + " " + copy.size());
    }
}`, options: ['1 1', '2 1', '2 2', 'UnsupportedOperationException'], answer: 1, explain: 'The view reads through to <code>base</code>, so it sees 2 elements. <code>List.copyOf</code> took a snapshot of 1 element. Prints <b>2 1</b>.', run: true, expect: '2 1' },
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
}`, options: ['Range[lo=5, hi=1]', 'Range[lo=1, hi=5]', 'Compile error: cannot assign to lo', 'Range@1b6d3586'], answer: 1, explain: 'In a compact constructor the component names refer to the <b>parameters</b>, which may be reassigned. The fields are assigned from the parameters at the end. The generated toString prints <b>Range[lo=1, hi=5]</b>. Assigning <code>this.lo</code> directly inside a compact constructor would not compile.', run: true, expect: 'Range[lo=1, hi=5]' },
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
}`, options: ['1 2', '3 3', '2 3', 'UnsupportedOperationException'], answer: 1, explain: 'With no compact constructor, the record stores the caller’s list and the accessor returns it. <code>src</code>, the field and <code>cart.items()</code> are all one list. Prints <b>3 3</b>.', run: true, expect: '3 3' },
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
}`, options: ['false / false', 'false / NPE', 'NPE / NPE', 'false / true'], answer: 1, explain: '<code>ArrayList</code> allows null and simply answers false. The Java 9+ immutable lists treat a null <i>query</i> as an error and throw, which the <code>Collection.contains</code> Javadoc permits for collections that don’t allow nulls. Prints <b>false</b> then <b>NPE</b>.', run: true, expect: 'false\nNPE' },
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
}`, options: ['1 / 1', 'IAE / 1', '2 / 1', 'IAE / 2'], answer: 1, explain: '<code>Set.of</code> throws <code>IllegalArgumentException</code> on duplicate elements. A HashSet built from a List silently de-duplicates. Prints <b>IAE</b> then <b>1</b>.', run: true, expect: 'IAE\n1' },
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
}`, options: ['[1, 2, 3] [1, 2, 3]', 'UOE / [1, 2, 3] [1, 2]', 'UOE / [1, 2] [1, 2]', 'Compile error: toList() is not a Stream method'], answer: 1, explain: '<code>Collectors.toList()</code> returns an ArrayList in current JDKs, which is mutable but not guaranteed to be. <code>Stream.toList()</code> (Java 16+) is unmodifiable. Prints <b>UOE</b> then <b>[1, 2, 3] [1, 2]</b>.', run: true, expect: 'UOE\n[1, 2, 3] [1, 2]' },
    { kind: 'concept', q: 'Which line does <b>not</b> compile inside <code>record Point(int x, int y) { … }</code>?', options: ['<code>static int created = 0;</code>', '<code>int manhattan() { return Math.abs(x) + Math.abs(y); }</code>', '<code>private int cachedHash;</code>', '<code>Point { if (x &lt; 0) throw new IllegalArgumentException(); }</code>'], answer: 2, explain: 'Records can’t declare instance fields beyond their components, because all state must be in the header. Static fields, instance methods and a compact constructor are allowed. A record also can’t <code>extends</code> anything (it implicitly extends <code>java.lang.Record</code>), but it can <code>implements</code> interfaces.' }
  ],
  interview: [
    { q: 'What is the difference between final and immutable?', a: '<p><code>final</code> is about a <b>variable</b>: it can be assigned only once. Immutability is about an <b>object</b>: its observable state can’t change. A <code>final List</code> field can point at a mutable ArrayList, and a non-final field can point at an immutable String.</p>', lvl: 'core' },
    { q: 'How do you write a truly immutable class?', a: '<ol><li>Make the class <code>final</code>, or use a record, so subclasses can’t add mutable state.</li><li>Make all fields <code>private final</code>.</li><li>Don’t provide mutators. Return new instances (“withers”).</li><li>Defensively copy mutable inputs in the constructor, and copy or wrap them in accessors.</li><li>Don’t let <code>this</code> escape during construction.</li></ol>', fu: 'Why copy before validating? A caller on another thread could change the input between your check and your copy. Copy first, then validate the copy.', lvl: 'core' },
    { q: 'What does the compiler generate for a record? What can’t a record do?', a: '<p>Generated: private final fields, a canonical constructor, accessors named like the components (<code>x()</code>, not <code>getX()</code>), and equals, hashCode and toString. A record is implicitly <code>final</code> and extends <code>java.lang.Record</code>.</p><p>It can’t extend another class, declare extra instance fields, or have non-final state. It can implement interfaces, have static members and methods, declare nested types, and override any generated member.</p>', lvl: 'core' },
    { q: 'Canonical vs compact constructor?', a: '<p>The canonical constructor has the full parameter list and must assign every field. The compact form (<code>Point { … }</code>) has no parameter list. You validate or normalise the <i>parameters</i>, and the compiler assigns the fields at the end. You can’t assign <code>this.x</code> in a compact constructor. Other constructors must delegate to the canonical one with <code>this(…)</code>.</p>', lvl: 'core' },
    { q: 'List.of vs List.copyOf vs Collections.unmodifiableList vs Stream.toList?', a: '<ul><li><code>List.of(…)</code> (Java 9): an unmodifiable list of the arguments; nulls are rejected.</li><li><code>List.copyOf(c)</code> (Java 10): an unmodifiable snapshot; nulls are rejected; it may return <code>c</code> itself if c is already one of these lists.</li><li><code>Collections.unmodifiableList(l)</code>: a read-only <b>view</b> that shows changes to l; nulls are allowed.</li><li><code>stream.toList()</code> (Java 16): unmodifiable, and null elements are allowed.</li></ul>', lvl: 'core' },
    { q: 'Why does immutability make concurrency easier?', a: '<p>No writes means no data races. JLS §17.5 also guarantees that a thread seeing a reference to a properly constructed object sees the correct values of its final fields, even if the reference was published through a data race. Mutable objects need safe publication (volatile, locks, concurrent collections) <i>and</i> synchronised access afterwards.</p>', lvl: 'deep' },
    { q: 'Records with Jackson, Spring and JPA: what works?', a: '<ul><li>Jackson 2.12+ deserialises records through the canonical constructor.</li><li>Spring Boot 3 binds <code>@ConfigurationProperties</code> records through their constructor, with no <code>@ConstructorBinding</code> needed when there is one constructor.</li><li>Spring Data and JPQL constructor expressions (<code>select new …Dto(…)</code>) work well with records as read-only projections.</li><li>Records can’t be JPA <b>entities</b>: they are final and have no no-arg constructor or mutable state. Hibernate 6.2+ supports records as <code>@Embeddable</code>s.</li></ul>', lvl: 'deep' },
    { q: 'How does record serialization differ from normal Java serialization?', a: '<p>A record is serialised as its component values and is deserialised by calling the <b>canonical constructor</b>, so the compact constructor’s validation runs. Normal classes are rebuilt without calling a constructor, which lets a crafted byte stream bypass invariants.</p>', lvl: 'deep' },
    { q: 'Isn’t copying everything slow?', a: '<p>Usually not. Allocation of short-lived objects is cheap with modern GCs, and <code>List.copyOf</code> of an already unmodifiable list returns it without copying. For big collections that change often, use structural sharing (persistent collections such as Vavr or PCollections) or keep the mutable structure private and expose a narrow API. Measure before optimising.</p>', lvl: 'deep' },
    { q: 'How do you “modify” an immutable record?', a: '<p>Write withers that return a new instance: <code>Order withStatus(Status s) { return new Order(id, items, s); }</code>. That goes through the canonical constructor again, so validation still runs. There is no built-in <code>with</code> expression in Java 21. “Derived record creation” is a separate, later JEP.</p>', lvl: 'core' }
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
public class App { }`, note: 'Constructor binding means the properties object is never half-populated and can’t be changed at runtime by an accidental setter.' },
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

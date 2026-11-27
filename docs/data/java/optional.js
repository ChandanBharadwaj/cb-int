IA.register({
  track: 'java',
  slug: 'optional',
  title: 'Optional',
  tagline: '<code>Optional&lt;T&gt;</code> is a box that holds a value or nothing. Use it as a <b>return type</b> that says “there may be no result”. Callers then can’t forget to check. Chain <code>map</code> and <code>flatMap</code>, finish with <code>orElse…</code>. Keep it out of fields and parameters.',
  tldr: {
    problem: 'A method that “never returns null” returns null, and you get an NPE. A bare <code>get()</code> throws <code>NoSuchElementException</code>. An <code>orElse</code> fallback writes to the database when nobody needed it. A DTO with an Optional field won’t serialise.',
    model: '<code>map</code> changes the value if there is one. A null result makes the Optional empty. <code>flatMap</code> is for functions that already return an Optional. <code>filter</code> may empty it. Once empty, every later step is skipped. Leave with <code>orElse</code> (an eager value), <code>orElseGet</code> (a lazy supplier) or <code>orElseThrow</code>.',
    hook: '“What is the difference between <code>orElse</code> and <code>orElseGet</code>?” <code>orElse(compute())</code> always runs <code>compute()</code>. Java works out arguments before it makes the call. <code>orElseGet(() -&gt; compute())</code> runs it only when the Optional is empty.',
    facts: [
      { v: 'Java 8', l: 'introduced Optional. Java 9 added <code>or</code>, <code>ifPresentOrElse</code> and <code>stream</code>; Java 10 the no-argument <code>orElseThrow()</code>; Java 11 <code>isEmpty()</code>' },
      { v: 'return types', l: 'are the intended use. The Javadoc says Optional is “primarily intended for use as a method return type where there is a clear need to represent ‘no result’”' },
      { v: 'not Serializable', l: 'Optional is a value-based class and doesn’t implement <code>Serializable</code>, one more reason not to use it for fields' }
    ]
  },
  intro: {
    what: 'In Java, “no value” has usually meant <code>null</code>. Forget to check it and you get a <code>NullPointerException</code>. <code>Optional&lt;T&gt;</code> is a small wrapper that holds a T or is empty. A method that returns <code>Optional&lt;User&gt;</code> tells you “there might be no user”. The compiler makes you unwrap it on purpose.',
    analogy: { icon: '📦', title: 'A delivery box that might be empty', text: 'Instead of handing you a package or nothing, the courier always hands you a box. You can say “if there is something in it, open it and do this” (<code>map</code>), or “if it is empty, use my spare one instead” (<code>orElse</code>). What you shouldn’t do is rip it open without looking (<code>get()</code>), or store empty boxes in your filing cabinet (fields).' },
    steps: [
      { t: 'Create one', d: '<code>Optional.of(x)</code> when x is never null, <code>Optional.ofNullable(x)</code> when it might be, and <code>Optional.empty()</code> for nothing.' },
      { t: 'Return it from finders', d: 'This is the intended use.', code: 'Optional<Customer> findByEmail(String email);   // Spring Data supports this directly' },
      { t: 'Transform without unwrapping', d: '<code>map</code> and <code>filter</code> work on the value if there is one, and do nothing if there isn’t.', code: 'String city = repo.findByEmail(email)\n    .map(Customer::address)\n    .map(Address::city)\n    .orElse("unknown");' },
      { t: 'Unwrap on purpose', d: '<code>orElse(default)</code>, <code>orElseGet(() -&gt; compute())</code>, <code>orElseThrow(() -&gt; new NotFound(id))</code>, or <code>ifPresentOrElse(…)</code>.' },
      { t: 'Don’t use it everywhere', d: 'Not for fields, method parameters or collections. A missing list is just an empty list.' }
    ],
    terms: [
      ['present / empty', 'An Optional either holds a non-null value or holds nothing. It never holds null.'],
      ['map', 'Applies a function to the value, if present, and wraps the result (empty if the result is null).'],
      ['flatMap', 'Like map, for functions that already return an Optional. It doesn’t double-wrap.'],
      ['orElse / orElseGet', 'A default value (always computed) vs a function that makes one (run only when empty).'],
      ['orElseThrow', 'Returns the value or throws: <code>NoSuchElementException</code> (no-arg, Java 10) or the exception you supply.'],
      ['value-based class', 'A class you shouldn’t compare with <code>==</code> or use as a lock. Optional is one.']
    ]
  },
  visual: {
    title: 'Follow the box through the chain',
    caption: 'Press <b>Play</b>. <b>Value present</b> and <b>Empty short-circuits</b> show the same chain with and without an address. <b>orElse vs orElseGet</b> counts the database calls that ran for nothing. <b>map vs flatMap</b> shows the nested <code>Optional&lt;Optional&lt;…&gt;&gt;</code> trap.'
  },
  gotchas: [
    { trap: '<code>orElse</code> evaluates its argument every time', code: `Settings s = repo.findByUser(id)
    .orElse(repo.save(Settings.defaults(id)));   // INSERT on every call, even when found`, why: '<code>orElse</code> is an ordinary method. Java computes its argument before calling it. So any side effect or slow work in the argument always runs.', fix: 'Use <code>orElseGet(() -&gt; repo.save(Settings.defaults(id)))</code> for anything that is not a constant or an existing variable.' },
    { trap: 'Calling <code>get()</code> without checking', code: `User u = repo.findById(id).get();   // NoSuchElementException: No value present`, why: '<code>get()</code> on an empty Optional throws. The message doesn’t say <i>what</i> was missing. It is a null crash with extra steps.', fix: 'Use <code>orElseThrow(() -&gt; new UserNotFound(id))</code>, which maps cleanly to a 404. The no-arg <code>orElseThrow()</code> (Java 10) at least makes the intent explicit.' },
    { trap: '<code>isPresent()</code> + <code>get()</code> pairs', code: `if (opt.isPresent()) {
  send(opt.get());
} else {
  log.warn("nothing to send");
}`, why: 'This is a null check in disguise. A refactor can drop the check and keep the <code>get()</code>.', fix: '<code>opt.ifPresentOrElse(this::send, () -&gt; log.warn("nothing to send"));</code> (Java 9), or <code>map</code>/<code>orElse</code> for values.' },
    { trap: 'Optional fields, parameters and collections', code: `class Customer { Optional<String> nickname; }   // not Serializable; awkward for JPA and Jackson
void notify(Optional<Channel> channel)           // callers can still pass null
Optional<List<Order>> orders()                    // two ways to say "none"`, why: 'Optional isn’t a general “maybe” type. As a field, it adds an object per instance and breaks serialization. As a parameter, every caller must wrap, and can still pass null. Collections can already be empty.', fix: 'Store a nullable field and expose <code>Optional&lt;String&gt; nickname() { return Optional.ofNullable(nickname); }</code>. Overload methods instead of taking Optional parameters. Return empty collections.' },
    { trap: '<code>Optional.of(null)</code> and returning null', code: `Optional.of(user.middleName());     // NPE if it is null
Optional<User> find(long id) { return null; }   // defeats the whole point`, why: '<code>of</code> needs a non-null value. If an Optional-returning method returns null, callers get an NPE from the very thing meant to prevent one.', fix: 'Use <code>ofNullable</code> for values that may be null. Never return null from an Optional-returning method; return <code>Optional.empty()</code>.' },
    { trap: 'Boxing and nested Optionals', code: `Optional<Integer> n = …;                       // boxed int inside a box
Optional<Optional<User>> mgr = u.map(User::manager);   // used map where flatMap was needed`, why: 'Optional of a wrapper costs two objects. <code>map</code> with a function that returns Optional double-wraps.', fix: 'Use <code>OptionalInt</code>, <code>OptionalLong</code> and <code>OptionalDouble</code> for primitives (that is what <code>IntStream.max()</code> returns). Use <code>flatMap</code> when the function returns an Optional.' }
  ],
  scenarios: [
    { title: 'The settings table grew by a million rows in a day',
      symptom: 'The <code>user_settings</code> table grew by roughly one row per request, and a unique constraint started throwing <code>DataIntegrityViolationException</code> on hot users.',
      diagnose: `public Settings settingsFor(long userId) {
  return repo.findByUserId(userId)
             .orElse(repo.save(Settings.defaults(userId)));   // save() runs every time
}`,
      cause: 'Java computes the <code>orElse</code> argument before the call. So <code>save</code> ran on every request, even when the settings already existed.',
      fix: 'Make the fallback lazy, and protect the “create if missing” path against races with the unique constraint.',
      fixCode: `public Settings settingsFor(long userId) {
  return repo.findByUserId(userId)
             .orElseGet(() -> createDefaults(userId));   // runs only when empty
}

private Settings createDefaults(long userId) {
  try {
    return repo.saveAndFlush(Settings.defaults(userId));   // repository methods are transactional
  } catch (DataIntegrityViolationException raced) {     // another request created it first
    return repo.findByUserId(userId).orElseThrow();
  }
}` },
    { title: '500 errors instead of 404 for deleted products',
      symptom: 'After soft-deletes were introduced, requests for removed products returned HTTP 500 with <code>NoSuchElementException: No value present</code> and no hint of which product was missing.',
      diagnose: `@GetMapping("/products/{id}")
ProductDto get(@PathVariable long id) {
  return ProductDto.from(repo.findActiveById(id).get());   // empty for deleted rows
}`,
      cause: 'The code assumed the Optional was always present. <code>get()</code> threw a generic exception that the error handler mapped to 500.',
      fix: 'Turn absence into a domain exception that carries context and maps to 404.',
      fixCode: `@GetMapping("/products/{id}")
ProductDto get(@PathVariable long id) {
  return repo.findActiveById(id)
             .map(ProductDto::from)
             .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "product " + id));
}` },
    { title: 'Order events stopped publishing after a “small” DTO change',
      symptom: 'The Kafka producer failed for every message after a release that added an optional coupon to the event: <code>InvalidDefinitionException: Java 8 optional type `java.util.Optional&lt;java.lang.String&gt;` not supported by default</code>.',
      diagnose: `record OrderPlaced(long id, BigDecimal total, Optional<String> coupon) {}

// the producer used a hand-built mapper, not Spring Boot's auto-configured one
private final ObjectMapper mapper = new ObjectMapper();`,
      cause: 'Jackson needs the <code>jdk8</code> module to handle Optional. Spring Boot’s mapper registers it. The hand-built one didn’t. Recent Jackson 2.x versions then fail outright.',
      fix: 'Keep Optional out of DTOs and events: use a nullable field (omitted from the JSON when null). Inject the Boot-configured <code>ObjectMapper</code> rather than creating your own.',
      fixCode: `@JsonInclude(JsonInclude.Include.NON_NULL)
record OrderPlaced(long id, BigDecimal total, String coupon) {
  Optional<String> couponCode() { return Optional.ofNullable(coupon); }   // Optional at the API edge only
}

OrderPublisher(KafkaTemplate<String, String> kafka, ObjectMapper mapper) { … }   // Boot's mapper` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;

public class Main {
    static String load() {
        System.out.println("load");
        return "db";
    }

    public static void main(String[] args) {
        String a = Optional.of("x").orElse(load());
        String b = Optional.of("x").orElseGet(Main::load);
        System.out.println(a + b);
    }
}`, options: ['xx', 'load / xx', 'load / load / xx', 'load / xdb'], answer: 1, explain: '<code>orElse(load())</code> evaluates <code>load()</code> before the call, even though the value is present. <code>orElseGet</code> only calls the supplier when empty. Both return "x". Prints <b>load</b> then <b>xx</b>.', run: true, expect: 'load\nxx' },
    { kind: 'predict', q: 'map with a function that returns null. What does this print?', code: `import java.util.*;

public class Main {
    record User(String nick) {}

    public static void main(String[] args) {
        Optional<String> n = Optional.of(new User(null)).map(User::nick);
        System.out.println(n.isPresent() + " " + n.orElse("anon"));
    }
}`, options: ['true null', 'false anon', 'NullPointerException', 'true anon'], answer: 1, explain: '<code>map</code> wraps its result with <code>ofNullable</code>, so a null result becomes <code>Optional.empty()</code>. That is what makes chains like <code>map(User::address).map(Address::city)</code> null-safe. Prints <b>false anon</b>.', run: true, expect: 'false anon' },
    { kind: 'predict', q: 'of vs ofNullable. What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        String s = null;
        System.out.println(Optional.ofNullable(s).isEmpty());
        try {
            Optional.of(s);
            System.out.println("ok");
        } catch (NullPointerException e) {
            System.out.println("NPE");
        }
    }
}`, options: ['true / ok', 'true / NPE', 'false / NPE', 'Compile error: isEmpty does not exist'], answer: 1, explain: '<code>ofNullable(null)</code> is empty, and <code>isEmpty()</code> exists since Java 11. <code>Optional.of(null)</code> throws immediately. Prints <b>true</b> then <b>NPE</b>.', run: true, expect: 'true\nNPE' },
    { kind: 'predict', q: 'filter, or, map. What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Optional<String> primary = Optional.of("  ");
        String r = primary.filter(s -> !s.isBlank())
            .or(() -> Optional.of("backup"))
            .map(String::toUpperCase)
            .orElse("none");
        System.out.println(r);
    }
}`, options: ['"  " in upper case (two spaces)', 'BACKUP', 'none', 'backup'], answer: 1, explain: 'A blank string fails the filter, so the Optional becomes empty. <code>or</code> (Java 9) supplies another <i>Optional</i> lazily, which is then mapped to upper case. Prints <b>BACKUP</b>.', run: true, expect: 'BACKUP' },
    { kind: 'predict', q: 'Optional::stream and ifPresentOrElse (Java 9). What does this print?', code: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        List<Optional<String>> list = List.of(Optional.of("a"), Optional.empty(), Optional.of("b"));
        System.out.println(list.stream().flatMap(Optional::stream).collect(Collectors.joining(",")));
        Optional.empty().ifPresentOrElse(v -> System.out.println("has " + v), () -> System.out.println("none"));
    }
}`, options: ['a,,b / none', 'a,b / none', 'a,b / has null', 'Optional[a],Optional[b] / none'], answer: 1, explain: '<code>Optional.stream()</code> gives a stream of zero or one element, so <code>flatMap(Optional::stream)</code> drops the empties. <code>ifPresentOrElse</code> runs the second action when empty. Prints <b>a,b</b> then <b>none</b>.', run: true, expect: 'a,b\nnone' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        try {
            Optional.empty().orElseThrow();
        } catch (NoSuchElementException e) {
            System.out.println(e.getMessage());
        }
    }
}`, options: ['null', 'No value present', 'Optional.empty', 'Compile error: orElseThrow needs a supplier'], answer: 1, explain: 'The no-argument <code>orElseThrow()</code> (Java 10) behaves like <code>get()</code> but with a name that says what happens. The message is the same unhelpful one: <b>No value present</b>. Prefer the overload that takes an exception supplier with context.', run: true, expect: 'No value present' },
    { kind: 'concept', q: '<code>User.manager()</code> returns <code>Optional&lt;User&gt;</code>. What is the type of <code>repo.findById(7).map(User::manager)</code>?', options: ['<code>Optional&lt;User&gt;</code>', '<code>Optional&lt;Optional&lt;User&gt;&gt;</code>', '<code>User</code>', 'It doesn’t compile'], answer: 1, explain: '<code>map</code> always wraps the function’s result, and the result is already an Optional. Use <code>flatMap(User::manager)</code> to get a flat <code>Optional&lt;User&gt;</code>.' },
    { kind: 'concept', q: 'Where is Optional the recommended choice?', options: ['As the type of a JPA entity field', 'As a method parameter for optional arguments', 'As the return type of a finder that may find nothing', 'As the element type of a List'], answer: 2, explain: 'Optional was designed as a <b>return type</b> for “maybe no result”. For fields use nullable values (exposed through an Optional-returning getter if you like). For parameters use overloads. Collections should just be empty.' }
  ],
  interview: [
    { q: 'What is Optional for, and what is it not for?', a: '<p>It is for method <b>return types</b> where “no result” is a normal outcome and returning null would be error-prone, such as <code>findById</code>, <code>findFirst</code> or <code>max</code>. It isn’t a general replacement for null: avoid it in fields, parameters, collections and DTOs. Its Javadoc says a variable of type Optional should never itself be null.</p>', lvl: 'core' },
    { q: 'orElse vs orElseGet vs orElseThrow?', a: '<ul><li><code>orElse(v)</code>: v is evaluated <b>always</b>. Use it for constants and values you already have.</li><li><code>orElseGet(supplier)</code>: the supplier runs only when empty. Use it for computed or side-effecting defaults.</li><li><code>orElseThrow(supplier)</code>: throws your exception when empty. The no-arg form (Java 10) throws <code>NoSuchElementException</code>.</li></ul>', lvl: 'core' },
    { q: 'Why not use Optional as a field or parameter type?', a: '<ul><li>Fields: Optional isn’t Serializable, adds a wrapper object per instance, and JPA can’t map it. Jackson needs an extra module.</li><li>Parameters: every caller has to wrap, and a caller can still pass <code>null</code> for the Optional itself. Overloads or a nullable parameter with clear docs are simpler.</li><li>Collections: an empty collection already means “none”, and <code>Optional&lt;List&gt;</code> gives two different ways to say it.</li></ul>', lvl: 'core' },
    { q: 'map vs flatMap on Optional?', a: '<p><code>map(f)</code> for <code>f: T → R</code>: wraps the result (null becomes empty). <code>flatMap(f)</code> for <code>f: T → Optional&lt;R&gt;</code>: returns f’s Optional as is, avoiding <code>Optional&lt;Optional&lt;R&gt;&gt;</code>. The same pair appears on Stream (<code>map</code>/<code>flatMap</code>) and on CompletableFuture (<code>thenApply</code>/<code>thenCompose</code>).</p>', lvl: 'core' },
    { q: 'What did Java 9–11 add to Optional?', a: '<ul><li>Java 9: <code>or(Supplier&lt;Optional&gt;)</code> for a lazy alternative Optional, <code>ifPresentOrElse</code>, and <code>stream()</code> (0 or 1 elements, handy with <code>flatMap</code>).</li><li>Java 10: <code>orElseThrow()</code> with no arguments, the preferred spelling of <code>get()</code>.</li><li>Java 11: <code>isEmpty()</code>.</li></ul>', lvl: 'core' },
    { q: 'Is Optional slower than null checks?', a: '<p>It may create a wrapper object per call. <code>Optional.empty()</code> is one shared object, though. The JIT often removes short-lived Optionals too. In normal service code the cost is tiny next to I/O. In tight loops or huge collections, prefer primitives, <code>OptionalInt</code>, or plain null checks behind a clear API.</p>', lvl: 'deep' },
    { q: 'How does Optional work with Spring and Jackson?', a: '<ul><li>Spring Data repositories can return <code>Optional&lt;T&gt;</code> from finders, and <code>findById</code> does by default.</li><li>Spring MVC accepts <code>Optional</code> for <code>@RequestParam</code>, <code>@RequestHeader</code> and similar, as an alternative to <code>required = false</code>.</li><li>Jackson needs <code>jackson-datatype-jdk8</code> for Optional. Spring Boot registers it automatically, but a hand-built <code>new ObjectMapper()</code> doesn’t.</li></ul>', lvl: 'deep' },
    { q: 'Why shouldn’t you compare Optionals with == or synchronise on them?', a: '<p>Optional is a <b>value-based</b> class: equal instances are interchangeable, and which object you hold doesn’t matter. <code>==</code> on equal Optionals may be true or false. Use <code>equals</code>, which compares contents. Future JDK versions may turn such classes into value objects without identity, where synchronising on them would fail.</p>', lvl: 'deep' },
    { q: 'How would you refactor <code>if (opt.isPresent()) return opt.get().getName(); else return "n/a";</code>?', a: '<p><code>return opt.map(User::getName).orElse("n/a");</code>. Each <code>isPresent</code>/<code>get</code> pair is a chance to forget the check. Transform with <code>map</code>/<code>filter</code>/<code>flatMap</code> and unwrap exactly once, at the end.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Finders and 404s', lang: 'java', code: `public interface CustomerRepository extends JpaRepository<Customer, Long> {
    Optional<Customer> findByEmailIgnoreCase(String email);       // derived query, may be absent
}

@Service
class CustomerService {
    Customer byEmail(String email) {
        return repo.findByEmailIgnoreCase(email)
                   .orElseThrow(() -> new CustomerNotFound(email));   // context in the exception
    }

    String displayName(long id) {
        return repo.findById(id)
                   .flatMap(c -> c.nickname()                      // nickname() returns Optional<String>
                                  .filter(n -> !n.isBlank())
                                  .or(() -> Optional.ofNullable(c.fullName())))   // Java 9 lazy alternative
                   .orElse("Customer #" + id);
    }
}

@ResponseStatus(HttpStatus.NOT_FOUND)
class CustomerNotFound extends RuntimeException {
    CustomerNotFound(String email) { super("no customer with email " + email); }
}` },
    { title: 'Nullable field, Optional getter', lang: 'java', code: `@Entity
public class Customer {
    @Id @GeneratedValue private Long id;
    private String fullName;
    private String nickname;                 // nullable column, plain field

    public String fullName() { return fullName; }

    public Optional<String> nickname() {    // Optional only at the API surface
        return Optional.ofNullable(nickname);
    }
}

// Overloads instead of Optional parameters
public void notify(Customer c) { notify(c, defaultChannel(c)); }
public void notify(Customer c, Channel channel) { … }` },
    { title: 'Optional inside streams', lang: 'java', code: `// Keep only customers that have a verified phone, without null checks
List<String> phones = customers.stream()
    .map(Customer::verifiedPhone)          // Stream<Optional<String>>
    .flatMap(Optional::stream)             // Java 9: drop the empties
    .toList();

// Primitive optionals from primitive streams
OptionalDouble avg = orders.stream().mapToLong(Order::cents).average();
String label = avg.isPresent() ? "%.2f".formatted(avg.getAsDouble() / 100) : "no orders";` }
  ]
});

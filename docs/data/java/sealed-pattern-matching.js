IA.register({
  track: 'java',
  slug: 'sealed-pattern-matching',
  title: 'Sealed types & pattern matching',
  tagline: 'A <b>sealed</b> type lists every subtype it allows. A <b>pattern switch</b> checks a value’s type and unpacks its fields in one step. Together, the compiler can prove you handled every case. A new variant then breaks the build, not production.',
  tldr: {
    problem: 'You add a new subtype. Old <code>if (x instanceof …)</code> chains and <code>default -&gt;</code> branches send it down the wrong path. A refund for a new payment type throws “unsupported” in production.',
    model: '<code>sealed … permits A, B, C</code> fixes the list of subtypes. <code>switch</code> tries cases <b>top to bottom</b>. Each checks the type, unpacks the record, then tests the <code>when</code> condition. The first full match wins. With no <code>default</code>, the compiler checks that every listed type is covered (<b>exhaustiveness</b>).',
    hook: '“Why shouldn’t you add <code>default</code> to a switch over a sealed interface?” It turns off the coverage check. The next new subtype goes to <code>default</code> instead of failing the build.',
    facts: [
      { v: 'Java 17', l: 'made sealed classes and interfaces standard. Pattern matching for <code>instanceof</code> came in Java 16' },
      { v: 'Java 21', l: 'made pattern matching for switch and record patterns standard, including <code>when</code> guards and <code>case null</code>' },
      { v: 'MatchException', l: 'is thrown (Java 21) when an exhaustive pattern switch meets a subtype that didn’t exist when it was compiled, for example after a library upgrade without recompiling' }
    ]
  },
  intro: {
    what: 'Sometimes a value is one of a fixed set of kinds. A payment is a card, a bank transfer or a voucher, nothing else. A <b>sealed interface</b> writes that rule into code. <b>Pattern matching</b> asks “which kind is this?” and pulls out its fields in one safe step. The compiler tells you if you forget a kind.',
    analogy: { icon: '🗂️', title: 'A form with fixed checkboxes', text: 'A paper form says “Payment type: ☐ Card ☐ Transfer ☐ Voucher”. The list is printed, so the clerk’s instructions can cover every box. Add “☐ Crypto”, and any instruction sheet without crypto is clearly incomplete. That is sealing plus a complete switch.' },
    steps: [
      { t: 'Close the hierarchy', d: 'Only the listed types may implement the interface. Records are implicitly <code>final</code>, which makes them a good fit.', code: 'sealed interface Payment permits Card, Transfer, Voucher {}\nrecord Card(String last4) implements Payment {}\nrecord Transfer(String iban) implements Payment {}\nrecord Voucher(String code, int cents) implements Payment {}' },
      { t: 'Test and bind in one step', d: 'A type pattern checks the type and gives you a variable that is already cast.', code: 'if (p instanceof Card c) {\n  log.info("card ending {}", c.last4());\n}' },
      { t: 'Switch over the shape', d: 'Each <code>case</code> is a pattern. Arrow cases don’t fall through.', code: 'String label = switch (p) {\n  case Card c -> "card " + c.last4();\n  case Transfer t -> "bank transfer";\n  case Voucher(var code, var cents) -> code + " (" + cents + "¢)";\n};' },
      { t: 'Refine with guards', d: '<code>case Voucher v when v.cents() == 0 -&gt; …</code>: the pattern must match <i>and</i> the condition must be true.' },
      { t: 'Let the compiler check coverage', d: 'No <code>default</code>. When someone adds a fourth payment type, every switch that misses it stops compiling.' }
    ],
    terms: [
      ['sealed / permits', 'A class or interface that names the only subtypes allowed to extend or implement it.'],
      ['non-sealed', 'A listed subtype that lets anyone extend it again.'],
      ['type pattern', '<code>Circle c</code>: matches if the value is a Circle and binds it to <code>c</code>.'],
      ['record pattern', '<code>Rect(var w, var h)</code>: matches a record and binds its components. Patterns can be nested.'],
      ['guard', 'A <code>when</code> condition attached to a case label.'],
      ['exhaustive', 'Some case handles every possible value. Switch expressions and pattern switches must be exhaustive.']
    ]
  },
  visual: {
    title: 'A pattern switch, one case at a time',
    caption: 'Choose an input and press <b>Play</b>: each case tests its type, deconstructs the record, then checks its guard. The first full match wins. Then click <b>+ add Triangle to permits</b> to see the exhaustiveness check fail.'
  },
  gotchas: [
    { trap: '<code>default</code> in a switch over a sealed type', code: `return switch (payment) {
  case Card c -> refundCard(c);
  case Transfer t -> refundTransfer(t);
  default -> throw new IllegalStateException("unsupported");   // Voucher, and every future type
};`, why: 'A <code>default</code> covers everything, so the compiler has nothing to check. A new subtype compiles and then fails at runtime.', fix: 'List every permitted type and leave out <code>default</code>. If you need a catch-all for a non-sealed branch, put it on that specific type.' },
    { trap: 'Dominated case labels', code: `switch (o) {
  case CharSequence cs -> …;
  case String s -> …;          // error: this case label is dominated by a preceding case label
}`, why: 'An earlier case already matches every String. So this case can never run, and the compiler rejects it.', fix: 'Put specific types first and general ones after. A guarded case doesn’t dominate the same unguarded type, so <code>case Circle c when …</code> goes before <code>case Circle c</code>.' },
    { trap: 'A null selector throws', code: `switch (event) {          // event == null
  case Created c -> …;
  default -> …;            // default does NOT match null
}                          // NullPointerException`, why: 'A switch throws NPE on null unless it has a <code>case null</code> label (Java 21). <code>default</code> alone doesn’t match null.', fix: 'Add <code>case null -&gt; …</code> (or <code>case null, default -&gt; …</code>) when null is a valid input. Otherwise validate at the boundary so null never gets there.' },
    { trap: 'Separate compilation breaks exhaustiveness', code: `// events-lib 2.0 adds: record Archived(...) implements OrderEvent
// your service was compiled against 1.x and not rebuilt
switch (event) { case Created c -> …; case Shipped s -> …; }   // MatchException at runtime`, why: 'Exhaustiveness is checked at <b>compile time</b>. At runtime the compiled switch has no case for the new class, so it throws <code>MatchException</code>.', fix: 'Rebuild consumers when a sealed hierarchy in a shared library changes, and treat adding a permitted subtype as a breaking change. At deserialisation boundaries, map unknown types to an explicit <code>Unknown</code> variant.' },
    { trap: 'Permitted subtypes must declare their own openness', code: `sealed interface Vehicle permits Car, Truck {}
final class Car implements Vehicle {}
class Truck implements Vehicle {}     // error: must be final, sealed or non-sealed`, why: 'Every listed subclass must say whether others may extend it. Without modules, they must also share a package. With modules, they must share a module.', fix: 'Use records (implicitly final), <code>final</code>, <code>sealed … permits</code> or <code>non-sealed</code>. If all the subtypes are in the same file, you can leave out <code>permits</code> and the compiler infers it.' },
    { trap: 'Selector types Java 21 can’t switch on', code: `long id = …;
switch (id) { case 1L -> … }    // error in Java 21: long selector not allowed
switch (flag) { … }              // boolean selector: also not allowed`, why: 'Java 21 allows <code>char</code>, <code>byte</code>, <code>short</code>, <code>int</code>, their wrappers, <code>String</code>, enums and reference types (with patterns). Primitive type patterns are a later preview feature, not part of 21.', fix: 'Use <code>if</code>/<code>else</code>, or convert to an enum or an int range first.' }
  ],
  scenarios: [
    { title: 'Voucher refunds failed with “unsupported payment”',
      symptom: 'After vouchers launched, refunds for voucher orders failed with <code>IllegalStateException: unsupported payment</code>. Checkout worked fine.',
      diagnose: `// RefundService.java (written before vouchers existed)
return switch (payment) {
  case Card c     -> gateway.refund(c, amount);
  case Transfer t -> bank.reverse(t, amount);
  default         -> throw new IllegalStateException("unsupported payment");
};`,
      cause: 'Payment was sealed, but <code>default</code> covered everything. Adding <code>Voucher</code> compiled fine and then hit <code>default</code> at runtime.',
      fix: 'Remove <code>default</code> from switches over sealed types, so the compiler lists every place a new variant must be handled. A one-off search for <code>default -&gt;</code> over sealed selectors is worth doing.',
      fixCode: `return switch (payment) {
  case Card c                   -> gateway.refund(c, amount);
  case Transfer t               -> bank.reverse(t, amount);
  case Voucher v                -> vouchers.reissue(v.code(), amount);
};   // adding a 4th Payment type is now a compile error here` },
    { title: '<code>MatchException</code> after a shared library upgrade',
      symptom: 'The order consumer started failing with <code>java.lang.MatchException</code> right after the platform team bumped <code>events-lib</code> on the classpath. Nothing in the consumer’s code had changed.',
      diagnose: `java.lang.MatchException
    at com.acme.consumer.OrderHandler.handle(OrderHandler.java:41)
// events-lib 2.3 added: record OrderArchived(long id) implements OrderEvent`,
      cause: 'The consumer jar was compiled against the old hierarchy. Its exhaustive switch had no branch for <code>OrderArchived</code>, and Java 21 throws <code>MatchException</code> when an exhaustive pattern switch finds no matching case at runtime.',
      fix: 'Rebuild and redeploy consumers whenever the sealed hierarchy changes, and enforce it with dependency pinning and contract tests. For events from outside your deploy unit, deserialise unknown types into an explicit variant that you handle on purpose.',
      fixCode: `sealed interface OrderEvent permits Created, Shipped, Archived, Unknown {}
record Unknown(String type, JsonNode raw) implements OrderEvent {}

switch (event) {
  case Created c  -> onCreated(c);
  case Shipped s  -> onShipped(s);
  case Archived a -> onArchived(a);
  case Unknown u  -> log.warn("skipping unknown event type {}", u.type());
}` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    sealed interface Shape permits Circle, Rect {}
    record Circle(double r) implements Shape {}
    record Rect(double w, double h) implements Shape {}

    static String f(Shape s) {
        return switch (s) {
            case Circle c when c.r() > 10 -> "big circle";
            case Circle c -> "circle";
            case Rect(double w, double h) when w == h -> "square " + w;
            case Rect r -> "rect";
        };
    }

    public static void main(String[] args) {
        System.out.println(f(new Circle(11)) + ", " + f(new Circle(1)) + ", " + f(new Rect(2, 2)) + ", " + f(new Rect(2, 3)));
    }
}`, options: ['big circle, circle, square 2.0, rect', 'big circle, big circle, square 2, rect', 'circle, circle, rect, rect', 'Compile error: switch is not exhaustive'], answer: 0, explain: 'Cases are tried in order, and a false guard moves on to the next case. <code>w</code> is a <code>double</code>, so it prints as <code>2.0</code>. The switch is exhaustive: unguarded <code>Circle c</code> and <code>Rect r</code> cover both permitted types. Prints <b>big circle, circle, square 2.0, rect</b>.', run: true, expect: 'big circle, circle, square 2.0, rect' },
    { kind: 'predict', q: 'A pattern switch with default, given null. What does this print?', code: `public class Main {
    static String f(Object o) {
        return switch (o) {
            case String s -> "string";
            default -> "other";
        };
    }

    public static void main(String[] args) {
        try {
            System.out.println(f(null));
        } catch (NullPointerException e) {
            System.out.println("NPE");
        }
    }
}`, options: ['other', 'string', 'NPE', 'null'], answer: 2, explain: '<code>default</code> doesn’t match null. Unless a <code>case null</code> label is present, a switch on null throws <code>NullPointerException</code>, as switches always have. Prints <b>NPE</b>.', run: true, expect: 'NPE' },
    { kind: 'predict', q: 'Flow scoping. What does this print?', code: `public class Main {
    static int len(Object o) {
        if (!(o instanceof String s)) {
            return -1;
        }
        return s.length();
    }

    public static void main(String[] args) {
        System.out.println(len("abc") + " " + len(42));
    }
}`, options: ['3 -1', 'Compile error: s is not in scope', '-1 -1', '3 2'], answer: 0, explain: 'A pattern variable is in scope wherever the compiler can prove the match succeeded. After <code>if (!(o instanceof String s)) return;</code>, the rest of the method can only run if it matched. Prints <b>3 -1</b>.', run: true, expect: '3 -1' },
    { kind: 'predict', q: 'Nested record patterns. What does this print?', code: `public class Main {
    record Point(int x, int y) {}
    record Line(Point from, Point to) {}

    public static void main(String[] args) {
        Object o = new Line(new Point(0, 0), new Point(3, 4));
        if (o instanceof Line(Point(var x1, var y1), Point(int x2, int y2))) {
            System.out.println(Math.hypot(x2 - x1, y2 - y1));
        }
    }
}`, options: ['5', '5.0', '7.0', 'Compile error: cannot mix var and int'], answer: 1, explain: 'Record patterns nest (Java 21), and <code>var</code> and explicit types can be mixed per component. <code>Math.hypot(3, 4)</code> returns the double 5.0. Prints <b>5.0</b>.', run: true, expect: '5.0' },
    { kind: 'predict', q: 'Old switch vs arrow switch. What does this print?', code: `public class Main {
    public static void main(String[] args) {
        int n = 1;
        switch (n) {
            case 1: System.out.println("one");
            case 2: System.out.println("two");
            default: System.out.println("many");
        }
        System.out.println("--");
        switch (n) {
            case 1 -> System.out.println("one");
            case 2 -> System.out.println("two");
            default -> System.out.println("many");
        }
    }
}`, options: ['one / -- / one', 'one / two / many / -- / one', 'one / two / many / -- / one / two / many', 'Compile error: mixing case styles'], answer: 1, explain: 'Colon-style cases <b>fall through</b> without <code>break</code>. Arrow cases (Java 14+) run exactly one branch. Each switch uses one style, so it compiles. Prints <b>one, two, many, --, one</b>.', run: true, expect: 'one\ntwo\nmany\n--\none' },
    { kind: 'concept', q: 'What happens?', code: `static String kind(Object o) {
    return switch (o) {
        case CharSequence cs -> "chars";
        case String s -> "string";
        default -> "other";
    };
}`, options: ['“string” for Strings, because the more specific case wins', '“chars” for Strings, and the String case is never used', 'Compile error: the String case is dominated', 'Runtime MatchException'], answer: 2, explain: 'Every String is a CharSequence, so the second label can never match. javac reports “this case label is dominated by a preceding case label”. Order cases from specific to general.' },
    { kind: 'concept', q: 'Given <code>sealed interface Vehicle permits Car, Truck {}</code> in the same package, which declaration of Truck compiles?', options: ['<code>class Truck implements Vehicle {}</code>', '<code>abstract class Truck implements Vehicle {}</code>', '<code>non-sealed class Truck implements Vehicle {}</code>', '<code>class Truck extends Object implements Vehicle {}</code>'], answer: 2, explain: 'A permitted subclass must be <code>final</code>, <code>sealed</code> or <code>non-sealed</code>. <code>abstract</code> alone doesn’t count. Records and enums are implicitly final, so they satisfy the rule automatically.' },
    { kind: 'concept', q: 'A library adds a new permitted subtype, and your code (an exhaustive switch with no default) is <b>not</b> recompiled. What happens when the new type reaches your switch at runtime?', options: ['The switch returns null', 'The first case runs', 'A MatchException is thrown', 'The class fails to load with VerifyError'], answer: 2, explain: 'The compiled switch includes a synthetic default that throws <code>MatchException</code> (Java 21). Exhaustiveness is a compile-time guarantee, so it only protects code that was compiled against the current hierarchy.' }
  ],
  interview: [
    { q: 'What are sealed classes and why would you use them?', a: '<p>A sealed class or interface restricts which classes may extend or implement it (<code>permits</code>). It models a closed set of variants, what functional languages call an algebraic data type: <code>Result = Ok | Err</code>, or <code>Payment = Card | Transfer | Voucher</code>. The pay-off is that javac knows the full list, so a switch can be checked for exhaustiveness and needs no <code>default</code>.</p>', lvl: 'core' },
    { q: 'What rules apply to permitted subclasses?', a: '<ul><li>Each must directly extend or implement the sealed type.</li><li>Each must be <code>final</code>, <code>sealed</code> or <code>non-sealed</code>.</li><li>They must be in the same module, or in the same package when in the unnamed module.</li><li><code>permits</code> can be omitted if all subtypes are in the same source file.</li></ul>', lvl: 'core' },
    { q: 'Sealed interface vs enum: when do you pick each?', a: '<p>An <b>enum</b> is a fixed set of <i>instances</i>: singletons with the same fields. A <b>sealed</b> hierarchy is a fixed set of <i>types</i>, and each variant can carry different data (<code>Card(last4)</code> vs <code>Transfer(iban)</code>), with many instances of each. Both give exhaustive switches. Pick an enum when the variants carry no per-instance data.</p>', lvl: 'core' },
    { q: 'What did Java 21 add to switch?', a: '<ul><li><b>Type patterns</b> in case labels: <code>case Circle c</code>.</li><li><b>Record patterns</b>, nested and with <code>var</code>: <code>case Line(Point(var x, var y), var to)</code>.</li><li><b>Guards</b>: <code>case Circle c when c.r() &gt; 10</code>.</li><li><code>case null</code>, and <code>case null, default</code>.</li><li><b>Exhaustiveness</b> checking for pattern switches over sealed types, with <code>MatchException</code> at runtime for anything unexpected.</li></ul><p>Arrow labels and switch expressions with <code>yield</code> came earlier, in Java 14.</p>', lvl: 'core' },
    { q: 'What are the dominance rules?', a: '<p>A case label is dominated if an earlier label matches every value it would match. That is a compile error, because the later case is dead code. Unguarded <code>case CharSequence cs</code> dominates <code>case String s</code>. A guarded label doesn’t dominate, so <code>case String s when s.isEmpty()</code> may come before <code>case String s</code>. Constant labels must also come before a type pattern of the same type.</p>', lvl: 'deep' },
    { q: 'How is a pattern switch compiled?', a: '<p>javac emits an <code>invokedynamic</code> to <code>java.lang.runtime.SwitchBootstraps.typeSwitch</code> with the case types as static arguments. The call returns the index of the first matching label, starting from a restart index, and javac generates a <code>tableswitch</code> on that index. When a guard fails, the code calls the bootstrap again with the next index. Enum and String constants get similar bootstraps.</p>', lvl: 'deep' },
    { q: 'Does pattern matching replace the Visitor pattern?', a: '<p>For closed hierarchies, mostly yes. A sealed interface plus exhaustive switches lets you add new <i>operations</i> without touching the types, which is what Visitor was for, with much less ceremony. The trade-off is the expression problem: adding a new <i>type</i> means updating every switch, and the compiler tells you which. Open hierarchies with polymorphic methods make the opposite trade.</p>', lvl: 'deep' },
    { q: 'Explain flow scoping of pattern variables.', a: '<p>A pattern variable is in scope only where the match is certain. In <code>if (o instanceof String s &amp;&amp; s.length() &gt; 3)</code>, <code>s</code> is usable on the right of <code>&amp;&amp;</code>. With <code>||</code> it isn’t. After <code>if (!(o instanceof String s)) return;</code>, <code>s</code> is in scope for the rest of the block. In switches, a binding is scoped to its own case.</p>', lvl: 'core' },
    { q: 'How do you get an exhaustive switch on data from outside the JVM, like JSON events?', a: '<p>Deserialise into the sealed hierarchy at the boundary (for example Jackson’s <code>@JsonTypeInfo</code> + <code>@JsonSubTypes</code> on the sealed interface) and include an explicit <code>Unknown</code> variant for type ids you don’t recognise. Inside the service, switches stay exhaustive and default-free, and unknown inputs are handled deliberately instead of by a generic default.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Domain events, handled exhaustively', lang: 'java', code: `public sealed interface OrderEvent permits OrderPlaced, OrderPaid, OrderCancelled {
    long orderId();
}
public record OrderPlaced(long orderId, List<Line> lines) implements OrderEvent {}
public record OrderPaid(long orderId, Money amount) implements OrderEvent {}
public record OrderCancelled(long orderId, String reason) implements OrderEvent {}

@Component
class OrderProjection {
    @Transactional
    @KafkaListener(topics = "orders")
    void on(OrderEvent e) {
        switch (e) {
            case OrderPlaced(var id, var lines)              -> views.create(id, lines);
            case OrderPaid(var id, var amt) when amt.isZero() -> views.markFree(id);
            case OrderPaid p                                 -> views.markPaid(p.orderId(), p.amount());
            case OrderCancelled c                            -> views.cancel(c.orderId(), c.reason());
        }   // no default: a 4th event type won't compile until it is handled here
    }
}` },
    { title: 'A Result type for service calls', lang: 'java', code: `public sealed interface Result<T> {
    record Ok<T>(T value) implements Result<T> {}
    record NotFound<T>(String what) implements Result<T> {}
    record Invalid<T>(List<String> errors) implements Result<T> {}
}

@GetMapping("/customers/{id}")
ResponseEntity<?> get(@PathVariable long id) {
    return switch (service.find(id)) {
        case Result.Ok<Customer>(var c)          -> ResponseEntity.ok(CustomerDto.from(c));
        case Result.NotFound<Customer> nf        -> ResponseEntity.notFound().build();
        case Result.Invalid<Customer>(var errs)  -> ResponseEntity.badRequest().body(errs);
    };
}`, note: 'Nested records in an interface are implicitly static, and since they are in the same file, <code>permits</code> could be omitted.' },
    { title: 'Polymorphic JSON into a sealed type', lang: 'java', code: `@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type", defaultImpl = Unknown.class)
@JsonSubTypes({
    @JsonSubTypes.Type(value = Card.class, name = "card"),
    @JsonSubTypes.Type(value = Transfer.class, name = "transfer"),
    @JsonSubTypes.Type(value = Voucher.class, name = "voucher")
})
public sealed interface PaymentDto permits Card, Transfer, Voucher, Unknown {}

public record Card(String last4) implements PaymentDto {}
public record Transfer(String iban) implements PaymentDto {}
public record Voucher(String code, int cents) implements PaymentDto {}
@JsonIgnoreProperties(ignoreUnknown = true)
public record Unknown() implements PaymentDto {}       // unrecognised "type" lands here` }
  ]
});

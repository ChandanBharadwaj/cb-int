IA.register({
  track: 'java',
  slug: 'java-inheritance-interfaces',
  title: 'Inheritance & interfaces',
  tagline: '<code>extends</code> lets a class reuse a parent’s behaviour and replace parts of it (<b>override</b>). <code>implements</code> lets it promise to provide an <b>interface’s</b> methods. A parent-type variable can hold any child type. At run time, the JVM runs the <b>real object’s</b> method. That is polymorphism.',
  tldr: {
    problem: 'Common mix-ups: overloading vs overriding. Forgetting the parent constructor runs first. Expecting fields to act like methods. Not knowing when to pick an abstract class over an interface.',
    model: 'One class can <code>extend</code> one class but <code>implement</code> many interfaces. The <b>declared</b> type decides what you may call, at compile time. The <b>actual</b> object decides which override runs, at run time (“dynamic dispatch”).',
    hook: '“Abstract class or interface?” Use an interface for a skill many unrelated types share (<code>Comparable</code>, <code>Runnable</code>). Use an abstract class when subclasses share state and code. Since Java 8, interfaces can have <code>default</code> method bodies, but still no instance fields.',
    facts: [
      { v: '1 + n', l: 'a class extends exactly one class (<code>Object</code> if you write none) and may implement any number of interfaces' },
      { v: '@Override', l: 'is optional but makes the compiler check that you really override something; a typo then fails to compile' },
      { v: 'Java 8 / 9', l: 'interfaces gained <code>default</code> and <code>static</code> methods in Java 8, and <code>private</code> methods in Java 9' }
    ]
  },
  intro: {
    what: '<b>Inheritance</b> means one class builds on another: <code>class Dog extends Animal</code> gets all of Animal’s fields and methods, and can <b>override</b> some. An <b>interface</b> is a list of methods a class promises to provide, without saying how. A class <code>implements</code> it. Both let you write code against a general type (<code>Animal</code>, <code>List</code>) and have it work with any specific type. That is <b>polymorphism</b>.',
    analogy: { icon: '🔌', title: 'Plugs and appliances', text: 'An interface is the wall socket shape: anything with the right plug works, whether it’s a lamp or a kettle. Inheritance is a product line: the “Deluxe Kettle” is built from the basic kettle design and changes a few parts. You plug in without caring which model it is. Each appliance does its own thing.' },
    steps: [
      { t: 'Extend a class', d: 'The child inherits fields and methods. Call the parent constructor with <code>super(...)</code>.', code: 'class Animal {\n    final String name;\n    Animal(String name) { this.name = name; }\n    String speak() { return "..."; }\n}\nclass Dog extends Animal {\n    Dog(String name) { super(name); }\n}' },
      { t: 'Override a method', d: 'Same signature in the child. <code>@Override</code> asks the compiler to check.', code: 'class Dog extends Animal {\n    Dog(String n) { super(n); }\n    @Override String speak() { return "Woof"; }\n}' },
      { t: 'Use the parent type', d: 'The variable type is Animal; the object is a Dog. Dog’s method runs.', code: 'Animal a = new Dog("Rex");\na.speak();   // "Woof"' },
      { t: 'Make it abstract', d: 'An abstract class can’t be instantiated and may leave methods for subclasses to fill in.', code: 'abstract class Shape {\n    abstract double area();\n}' },
      { t: 'Define an interface', d: 'A contract. A class can implement several.', code: 'interface Payable { long amountCents(); }\nrecord Invoice(long amountCents) implements Payable {}' }
    ],
    terms: [
      ['superclass / subclass', 'Parent and child in an <code>extends</code> relationship.'],
      ['super', '<code>super(...)</code> calls the parent constructor; <code>super.m()</code> calls the parent’s version of a method.'],
      ['override', 'A subclass method with the same signature that replaces the inherited one at run time.'],
      ['abstract', 'A class that can’t be created directly, or a method with no body.'],
      ['interface', 'A named contract of methods. Can have <code>default</code> and <code>static</code> methods, no instance fields.'],
      ['polymorphism', 'One variable type, many object types, each running its own override.']
    ]
  },
  visual: {
    title: 'super, dynamic dispatch, abstract classes and default methods',
    caption: 'Pick a scenario and press <b>Play</b> or <b>Step</b>. <b>extends &amp; super</b> shows the parent constructor running first and <code>super.speak()</code>. <b>Polymorphism</b> runs one line of code against three object types. <b>Abstract class</b> shows a template method. <b>Interfaces &amp; default</b> shows a record implementing two interfaces.'
  },
  gotchas: [
    { trap: 'Overloading when you meant to override', code: `class Point {
    int x, y;
    public boolean equals(Point other) {   // overload, not override!
        return x == other.x && y == other.y;
    }
}
Set<Point> s = new HashSet<>();   // uses equals(Object): your method is ignored`, why: '<code>Object.equals</code> takes an <code>Object</code>. A method taking <code>Point</code> has a different signature. It is an overload, and collections never call it.', fix: 'Always write <code>@Override</code>; here it would not compile. Use <code>equals(Object o)</code> and see <a href="equals-hashcode.html">equals &amp; hashCode</a>.' },
    { trap: 'Expecting fields to be polymorphic', code: `class P { String name = "P"; }
class Q extends P { String name = "Q"; }   // hides, doesn't override
P p = new Q();
p.name;   // "P"`, why: 'Only instance methods are picked at run time. Fields and static methods follow the <b>declared</b> type. A same-named field in a subclass only hides the parent’s.', fix: 'Keep fields private and expose them through methods. Never redeclare a parent’s field.' },
    { trap: 'Calling an overridable method from a constructor', code: `class Base {
    Base() { init(); }
    void init() { }
}
class Sub extends Base {
    private final List<String> items = new ArrayList<>();
    @Override void init() { items.add("x"); }   // NPE: items is still null
}`, why: 'The parent constructor runs <i>before</i> the subclass’s field initialisers. The override runs on a half-built object.', fix: 'Don’t call overridable methods from constructors. Make them <code>private</code> or <code>final</code>, or use a static factory that calls <code>init()</code> after construction.' },
    { trap: 'Forgetting the parent has no no-arg constructor', code: `class Animal { Animal(String name) { } }
class Dog extends Animal {
    Dog() { }   // compile error: constructor Animal cannot be applied to given types
}`, why: 'Every constructor starts with <code>super(...)</code>. If you don’t write one, the compiler inserts <code>super()</code>, which doesn’t exist here.', fix: 'Call the right parent constructor explicitly: <code>Dog() { super("dog"); }</code>.' },
    { trap: 'Narrowing visibility or forgetting <code>public</code> when implementing an interface', code: `interface Greeter { String greet(); }
class Hi implements Greeter {
    String greet() { return "hi"; }   // compile error: attempting to assign weaker access privileges
}`, why: 'Interface methods are implicitly <code>public</code>. An override may not be less visible than the method it overrides.', fix: 'Declare it <code>public String greet()</code>.' },
    { trap: 'Deep inheritance for code reuse', code: `class BaseService { … }
class AuditedService extends BaseService { … }
class CachedAuditedService extends AuditedService { … }
class OrderService extends CachedAuditedService { … }`, why: 'Each level couples tightly to the internals of the one above (“fragile base class”). Changing the top can break every child.', fix: 'Prefer <b>composition</b>: give <code>OrderService</code> an <code>AuditLog</code> and a <code>Cache</code> as fields. Use inheritance for real “is-a” relationships.' }
  ],
  scenarios: [
    { title: 'Duplicate orders in a HashSet', symptom: 'De-duplicating orders with a <code>HashSet&lt;OrderKey&gt;</code> lets duplicates through; unit tests calling <code>a.equals(b)</code> directly pass.', diagnose: 'The test passes because it calls the overload with type <code>OrderKey</code>. <code>HashSet</code> calls <code>equals(Object)</code> and <code>hashCode()</code>. Neither was overridden.', cause: '<code>public boolean equals(OrderKey other)</code> overloaded rather than overrode <code>Object.equals</code>, and <code>hashCode</code> was missing.', fix: 'Turn the key into a record (generated <code>equals</code>/<code>hashCode</code>), or override both properly with <code>@Override</code>.', fixCode: `public record OrderKey(String customerId, String sku) {}` },
    { title: 'NullPointerException only in one subclass', symptom: 'A new <code>PdfExporter</code> throws NPE as soon as it is constructed. Other exporters are fine.', diagnose: 'The stack trace shows <code>AbstractExporter.&lt;init&gt;</code> calling <code>configure()</code>. <code>PdfExporter</code> overrides it, and it reads a field that <code>PdfExporter</code> sets.', cause: 'The parent constructor called an overridable method before the subclass fields were initialised.', fix: 'Move the hook out of the constructor.', fixCode: `public abstract class AbstractExporter {
    protected AbstractExporter() { }                 // no overridable calls here
    public final void export(Report r) {
        configure();                                  // object is fully built now
        write(r);
    }
    protected abstract void configure();
    protected abstract void write(Report r);
}` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Parent type, child object. What does this print?', code: `public class Main {
    static class Animal { String speak() { return "..."; } }
    static class Dog extends Animal {
        @Override String speak() { return "Woof"; }
    }

    public static void main(String[] args) {
        Animal a = new Dog();
        System.out.println(a.speak());
    }
}`, options: ['...', 'Woof', 'Compile error: Animal has no Dog methods', 'ClassCastException'], answer: 1, explain: 'The declared type <code>Animal</code> only decides that <code>speak()</code> may be called. At run time the JVM looks at the actual object, a <code>Dog</code>, and runs its override.', run: true, expect: 'Woof' },
    { kind: 'predict', q: 'Three levels of constructors. What does this print?', code: `public class Main {
    static class A { A() { System.out.print("A"); } }
    static class B extends A { B() { System.out.print("B"); } }
    static class C extends B { C() { System.out.print("C"); } }

    public static void main(String[] args) {
        new C();
        System.out.println();
    }
}`, options: ['CBA', 'ABC', 'C', 'AC'], answer: 1, explain: 'Each constructor implicitly starts with <code>super()</code>, so construction goes up the chain first and the bodies run top-down: A, then B, then C.', run: true, expect: 'ABC' },
    { kind: 'predict', q: 'A field and a method with the same name in parent and child. What does this print?', code: `public class Main {
    static class P {
        String name = "P";
        String get() { return name; }
    }
    static class Q extends P {
        String name = "Q";
        @Override String get() { return name; }
    }

    public static void main(String[] args) {
        P p = new Q();
        System.out.println(p.name + " " + p.get());
    }
}`, options: ['Q Q', 'P P', 'P Q', 'Q P'], answer: 2, explain: 'Field access uses the declared type (<code>P</code>), so <code>p.name</code> is "P". The method is overridden and dispatched on the real object (<code>Q</code>), whose <code>name</code> is "Q". Fields hide; methods override.', run: true, expect: 'P Q' },
    { kind: 'predict', q: 'Overloading meets overriding. What does this print?', code: `public class Main {
    static class Animal { String speak() { return "..."; } }
    static class Dog extends Animal {
        @Override String speak() { return "Woof"; }
    }
    static String who(Animal a) { return "animal"; }
    static String who(Dog d)    { return "dog"; }

    public static void main(String[] args) {
        Animal a = new Dog();
        System.out.println(who(a) + " " + a.speak());
    }
}`, options: ['dog Woof', 'animal Woof', 'animal ...', 'dog ...'], answer: 1, explain: 'The overload <code>who(...)</code> is picked at compile time from the declared type <code>Animal</code>. The override <code>speak()</code> is picked at run time from the object, a Dog.', run: true, expect: 'animal Woof' },
    { kind: 'predict', q: 'Calling an interface’s default from an override. What does this print?', code: `public class Main {
    interface Greeter {
        default String greet() { return "Hello"; }
    }
    static class Polite implements Greeter {
        @Override public String greet() { return Greeter.super.greet() + ", please"; }
    }

    public static void main(String[] args) {
        Greeter g = new Polite();
        System.out.println(g.greet());
    }
}`, options: ['Hello', 'Hello, please', ', please', 'Compile error: super in interface'], answer: 1, explain: '<code>Greeter.super.greet()</code> calls that interface’s default version. It also settles a clash when two interfaces give the same default.', run: true, expect: 'Hello, please' },
    { kind: 'predict', q: 'An override called from the parent constructor. What does this print?', code: `public class Main {
    static class Base {
        Base() { System.out.print(describe() + " "); }
        String describe() { return "base"; }
    }
    static class Sub extends Base {
        String label = "sub";
        @Override String describe() { return label; }
    }

    public static void main(String[] args) {
        new Sub();
        System.out.println("done");
    }
}`, options: ['base done', 'sub done', 'null done', 'NullPointerException'], answer: 2, explain: 'Java picks <code>Sub.describe()</code> even inside <code>Base</code>’s constructor. But <code>label</code> isn’t set yet: field initialisers run after <code>super()</code> returns. It returns <code>null</code>, which prints as “null”.', run: true, expect: 'null done' },
    { kind: 'predict', q: 'Static methods with the same signature. What does this print?', code: `public class Main {
    static class A { static String id() { return "A"; } }
    static class B extends A { static String id() { return "B"; } }

    public static void main(String[] args) {
        A x = new B();
        System.out.println(x.id() + " " + B.id());
    }
}`, options: ['B B', 'A B', 'A A', 'Compile error'], answer: 1, explain: 'Static methods are not overridden, only <b>hidden</b>. <code>x.id()</code> follows the declared type <code>A</code>, at compile time. (Calling a static through an object is legal but misleading.)', run: true, expect: 'A B' },
    { kind: 'concept', q: 'Interfaces vs abstract classes: which statement is true?', options: ['An interface can have instance fields', 'A class can implement several interfaces but extend only one class', 'An interface can have a constructor', 'Abstract classes cannot have concrete methods'], answer: 1, explain: 'Multiple inheritance of <b>type</b> is the key difference. Interfaces have no instance fields (only <code>static final</code> constants) and no constructors. Abstract classes can have fields, constructors and full methods.' }
  ],
  interview: [
    { q: 'Overloading vs overriding?', a: '<ul><li><b>Overloading</b>: same name, different parameters. Resolved at <b>compile time</b> from declared types.</li><li><b>Overriding</b>: same signature in a subclass. Resolved at <b>run time</b> from the object’s class.</li></ul><p>An override may return a subtype. It may not reduce visibility or throw broader checked exceptions.</p>', lvl: 'core' },
    { q: 'Abstract class vs interface: when do you use each?', a: '<ul><li><b>Interface</b>: a contract, often shared by unrelated classes. A class can implement many. No instance state.</li><li><b>Abstract class</b>: a half-built class for close relatives that share fields, constructors or helpers. A class can extend only one.</li></ul><p>Start with interfaces. Use an abstract class when you need shared state or a template method.</p>', lvl: 'core' },
    { q: 'What is polymorphism?', a: '<p>Code written for a general type works with any subtype. Each object brings its own behaviour. With <code>List&lt;String&gt; l = new ArrayList&lt;&gt;();</code>, <code>l.add(...)</code> runs ArrayList’s code. Swap in <code>LinkedList</code>, and the caller doesn’t change.</p>', lvl: 'core' },
    { q: 'What does <code>super</code> do?', a: '<p><code>super(args)</code>, first in a constructor, calls the parent constructor. If you leave it out, Java adds <code>super()</code>. <code>super.method()</code> calls the parent’s implementation from inside an override. <code>Iface.super.method()</code> calls a specific interface’s default method.</p>', lvl: 'core' },
    { q: 'Why were default methods added to interfaces?', a: '<p>Java 8 had to add methods like <code>Collection.stream()</code> to old interfaces. It couldn’t break every class that implemented them. A default method gives those classes a body for free. If a class gets the same default from two interfaces, it must override it. It can delegate with <code>A.super.m()</code>.</p>', fu: 'Class vs interface conflict? A method from a superclass always wins over an interface default (“class wins”).', lvl: 'core' },
    { q: 'Can you override a static, private or final method?', a: '<ul><li><code>static</code>: no, a same-signature static in a subclass <b>hides</b> it.</li><li><code>private</code>: no, it isn’t inherited; a same-named method in the subclass is unrelated.</li><li><code>final</code>: no, that is what <code>final</code> forbids. A <code>final</code> class can’t be extended at all (e.g. <code>String</code>).</li></ul>', lvl: 'core' },
    { q: 'What is the “is-a” vs “has-a” rule, and why prefer composition?', a: '<p>Use <code>extends</code> only when the child truly <i>is a</i> parent and works anywhere the parent does. Otherwise, keep the other object as a field (<i>has a</i>). That avoids fragile parent classes and lets you swap parts. Classic counter-example: <code>Stack extends Vector</code> exposes methods that break stack behaviour.</p>', lvl: 'core' },
    { q: 'How do you check and cast a type safely?', a: '<p>Since Java 16, pattern matching for <code>instanceof</code> checks and binds in one step: <code>if (shape instanceof Circle c) { c.radius(); }</code>. A plain cast to the wrong type throws <code>ClassCastException</code>. If you find many <code>instanceof</code> branches, consider an overridden method, or sealed types with a <code>switch</code>: see <a href="sealed-pattern-matching.html">Sealed types &amp; pattern matching</a>.</p>', lvl: 'core' },
    { q: 'How does the JVM find the method to run for a virtual call?', a: '<p>The compiler emits <code>invokevirtual</code> (or <code>invokeinterface</code>) with the method’s signature. At run time the JVM looks it up from the object’s actual class, usually through a per-class method table. If only one version is loaded, the JIT often inlines it for free.</p>', lvl: 'deep' },
    { q: 'What do <code>equals</code>, <code>hashCode</code> and <code>toString</code> do if you don’t override them?', a: '<p>They come from <code>Object</code>: <code>equals</code> is identity (<code>==</code>), <code>hashCode</code> is identity-based, and <code>toString</code> prints <code>ClassName@hexHash</code>. Override <code>equals</code> and <code>hashCode</code> together for value semantics, or use a record.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Strategy via an interface', lang: 'java', code: `// Java 21
public interface PricingRule {
    long apply(long cents);

    static PricingRule none() { return c -> c; }               // static factory
    default PricingRule then(PricingRule next) {               // default combinator
        return c -> next.apply(apply(c));
    }
}

public record PercentOff(int pct) implements PricingRule {
    public long apply(long cents) { return cents * (100 - pct) / 100; }
}
public record FlatOff(long off) implements PricingRule {
    public long apply(long cents) { return Math.max(0, cents - off); }
}

PricingRule rule = new PercentOff(10).then(new FlatOff(500));
long price = rule.apply(10_000);   // 10000 → 9000 → 8500`, note: 'Callers depend on <code>PricingRule</code>, never on concrete classes. New rules need no changes elsewhere.' },
    { title: 'Template method in an abstract class', lang: 'java', code: `public abstract class ImportJob {
    public final ImportResult run(Path file) {          // final: the algorithm is fixed
        List<String> lines = read(file);
        int ok = 0;
        for (String line : lines) {
            if (validate(line)) { save(line); ok++; }
        }
        return new ImportResult(lines.size(), ok);
    }
    protected List<String> read(Path file) {
        try { return Files.readAllLines(file); }
        catch (IOException e) { throw new UncheckedIOException(e); }
    }
    protected abstract boolean validate(String line);   // subclasses fill in
    protected abstract void save(String line);
}
public record ImportResult(int total, int imported) {}`, note: 'Subclasses customise steps; the parent controls the order.' }
  ]
});

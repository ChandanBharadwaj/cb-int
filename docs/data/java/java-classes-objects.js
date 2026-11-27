IA.register({
  track: 'java',
  slug: 'java-classes-objects',
  title: 'Classes & objects',
  tagline: 'A <b>class</b> lists data (fields) and behaviour (methods). <code>new</code> builds an <b>object</b>, runs its setup code (the <b>constructor</b>), and gives you a <b>reference</b> to it. <code>this</code> means “the current object”. <code>static</code> means “shared by the class”. Access modifiers and packages decide who sees what.',
  tldr: {
    problem: 'Common mistakes: forgetting <code>this.</code> in a constructor, so fields stay <code>null</code>. Losing the default constructor by adding your own. Sharing state by accident through <code>static</code>. Making every field <code>public</code>.',
    model: 'Class = blueprint. Object = one thing built from it, with its own copy of every non-static field. A variable holds a <b>reference</b> (an arrow), never the object itself. <code>static</code> fields exist once, on the class.',
    hook: '“What are the four access levels?” <code>private</code> (class), package-private (no keyword: same package), <code>protected</code> (package + subclasses), <code>public</code> (everyone).',
    facts: [
      { v: 'default ctor', l: 'is generated only if you write no constructor at all. Add any constructor and the no-arg one disappears' },
      { v: '0 / false / null', l: 'are the default values of fields. Local variables have no default and must be assigned before use' },
      { v: 'java.lang', l: 'is imported automatically. <code>import</code> only enables short names; it does not load or include code' }
    ]
  },
  intro: {
    what: 'Everything you write in Java lives in a <b>class</b>. A class describes a kind of thing: what it knows (<b>fields</b>) and what it can do (<b>methods</b>). Each time you write <code>new Account(...)</code> you get a separate <b>object</b> with its own field values. A <b>constructor</b> is the special method that sets up a new object. <b>Access modifiers</b> like <code>private</code> hide the inside. <b>Packages</b> group related classes, like folders.',
    analogy: { icon: '🏠', title: 'A house plan and houses', text: 'The class is the architect’s plan. Each object is one house built from it, with its own paint colour (fields). The constructor is the build crew that sets everything up on day one. A variable is the street address on a card: copying the card doesn’t copy the house. <code>static</code> things belong to the plan itself, like the architect’s name.' },
    steps: [
      { t: 'Declare fields', d: 'Each field has a type and usually <code>private</code>.', code: 'public class Account {\n    private final String owner;\n    private long balance;\n}' },
      { t: 'Write a constructor', d: 'Same name as the class, no return type. <code>this.x</code> is the field; plain <code>x</code> is the parameter.', code: 'public Account(String owner, long balance) {\n    this.owner = owner;\n    this.balance = balance;\n}' },
      { t: 'Create objects', d: '<code>new</code> allocates and runs the constructor. The variable stores a reference.', code: 'Account a = new Account("Asha", 100);\nAccount b = new Account("Ben", 0);' },
      { t: 'Add behaviour', d: 'Methods read and change the object’s own fields.', code: 'public void deposit(long amt) {\n    if (amt <= 0) throw new IllegalArgumentException("amt");\n    balance += amt;          // this.balance\n}' },
      { t: 'Put it in a package', d: 'First line of the file. The folder path must match.', code: 'package com.shop.billing;   // file: com/shop/billing/Account.java\nimport java.util.List;' }
    ],
    terms: [
      ['class / object', 'The blueprint, and one instance made from it with <code>new</code>.'],
      ['field', 'A variable declared in the class body. One copy per object (or one per class if <code>static</code>).'],
      ['constructor', 'Initialises a new object. Same name as the class, no return type.'],
      ['this', 'A reference to the current object. Also <code>this(...)</code> to call another constructor.'],
      ['static', 'Belongs to the class itself, shared by all objects.'],
      ['package', 'A namespace for classes, e.g. <code>java.util</code>. Matches the folder structure.']
    ]
  },
  visual: {
    title: 'Objects, references, static and visibility',
    caption: 'Pick a scenario and press <b>Play</b> or <b>Step</b>. <b>new &amp; constructor</b> shows default field values, <code>this</code> and a reference being copied. <b>static members</b> shows one shared counter. <b>Access modifiers</b> shows what each kind of class can see. <b>Packages &amp; imports</b> shows what an import really does.'
  },
  gotchas: [
    { trap: 'Forgetting <code>this.</code> when the parameter has the field’s name', code: `public class User {
    private String name;
    public User(String name) {
        name = name;          // assigns the parameter to itself
    }
}
new User("Ann").getName();    // null`, why: 'Inside the constructor, <code>name</code> means the closest one: the parameter. The field is never touched and stays <code>null</code>.', fix: 'Write <code>this.name = name;</code>. Make the field <code>final</code>. Then the compiler reports “variable name might not have been initialized” if you forget.' },
    { trap: 'Adding a constructor removes the default one', code: `public class Point {
    int x, y;
    public Point(int x, int y) { this.x = x; this.y = y; }
}
new Point();   // compile error: constructor Point in class Point cannot be applied`, why: 'The compiler supplies a no-arg constructor only when the class declares none. Frameworks such as JPA and Jackson often need one.', fix: 'Declare <code>public Point() {}</code> explicitly if you need both.' },
    { trap: 'A <code>static</code> field used as per-object state', code: `public class Cart {
    private static List<String> items = new ArrayList<>();   // BUG
    public void add(String s) { items.add(s); }
}`, why: '<code>static</code> means one list for every cart (and, in a web app, every user and every thread).', fix: 'Remove <code>static</code>: <code>private final List&lt;String&gt; items = new ArrayList&lt;&gt;();</code>. Reserve static for constants and stateless helpers.' },
    { trap: 'Public mutable fields', code: `public class Order {
    public List<Line> lines;   // anyone can replace or modify it
    public int total;          // can drift out of sync with lines
}`, why: 'Callers can put the object into an invalid state, and you can never add validation later without breaking them.', fix: 'Make fields <code>private</code> (and <code>final</code> where possible), expose behaviour (<code>addLine</code>) and keep the invariant inside the class. For plain data, a <a href="immutability-records.html">record</a> does this for you.' },
    { trap: 'Expecting a wildcard import to include subpackages', code: `import java.util.*;
Function<String, Integer> f = String::length;   // compile error: cannot find symbol`, why: '<code>java.util.function</code> is a different package. Packages are not nested in the language; the dots are just part of the name.', fix: '<code>import java.util.function.Function;</code>. Most teams prefer explicit single-class imports anyway.' },
    { trap: 'Reading a local variable before assigning it', code: `int count;
System.out.println(count);   // compile error: variable count might not have been initialized`, why: 'Fields get default values; local variables do not.', fix: 'Initialise locals where you declare them.' }
  ],
  scenarios: [
    { title: 'Users see each other’s shopping cart', symptom: 'After a deploy, customers report items they never added appearing in their cart. It only happens under load.', diagnose: 'A heap dump shows a single <code>ArrayList</code> holding thousands of items. The field is declared <code>static</code> in <code>CartService</code>.', cause: 'Someone made the field <code>static</code> to “keep it between requests”. Now one list was shared by every request and every thread. And <code>ArrayList</code> isn’t thread-safe.', fix: 'Keep per-user state per user (session or database), never in a static field. Spring beans are single shared objects by default too. Changeable fields in a <code>@Service</code> have the same problem.', fixCode: `@Service
public class CartService {
    private final CartRepository repo;            // stateless service
    public CartService(CartRepository repo) { this.repo = repo; }

    public void add(UUID userId, String sku) {
        Cart cart = repo.findByUser(userId);      // state lives per user
        cart.add(sku);
        repo.save(cart);
    }
}` },
    { title: 'Jackson fails to read a request body', symptom: 'A POST endpoint returns 400 with “Cannot construct instance of <code>CreateOrder</code> (no Creators, like default constructor, exist)”.', diagnose: 'The DTO class recently gained a constructor with arguments for convenience in tests.', cause: 'Adding that constructor removed the implicit no-arg constructor that Jackson used to create the object before setting fields.', fix: 'Add an explicit no-arg constructor, or better, turn the DTO into a record, which Jackson (2.12+) can bind through its canonical constructor.', fixCode: `public record CreateOrder(String sku, int qty) {}` }
  ],
  puzzles: [
    { kind: 'predict', q: 'A constructor without <code>this.</code>. What does this print?', code: `public class Main {
    static class Person {
        String name;
        Person(String name) { name = name; }
    }

    public static void main(String[] args) {
        System.out.println(new Person("Ann").name);
    }
}`, options: ['Ann', 'null', 'Compile error', '"" (empty)'], answer: 1, explain: '<code>name = name</code> assigns the parameter to itself. The field stays <code>null</code>. It compiles fine, so it is a classic bug.', run: true, expect: 'null' },
    { kind: 'predict', q: 'Fields you never assigned. What does this print?', code: `public class Main {
    static class Box {
        int n;
        boolean b;
        String s;
        double d;
    }

    public static void main(String[] args) {
        Box box = new Box();
        System.out.println(box.n + " " + box.b + " " + box.s + " " + box.d);
    }
}`, options: ['0 false null 0.0', 'Compile error: not initialized', '0 false  0', 'null null null null'], answer: 0, explain: 'Fields get defaults: <code>0</code> for numbers (<code>0.0</code> for double), <code>false</code> for boolean and <code>null</code> for references. Only <i>local</i> variables must be assigned before use.', run: true, expect: '0 false null 0.0' },
    { kind: 'predict', q: 'Two variables, one object. What does this print?', code: `public class Main {
    static class Person {
        String name;
        Person(String name) { this.name = name; }
    }

    public static void main(String[] args) {
        Person a = new Person("A");
        Person b = a;
        b.name = "B";
        b = new Person("C");
        System.out.println(a.name + " " + b.name);
    }
}`, options: ['A C', 'B C', 'C C', 'B B'], answer: 1, explain: '<code>b = a</code> copies the reference, so <code>b.name = "B"</code> changes the one shared object. Then <code>b</code> is pointed at a new object; <code>a</code> still points to the first one.', run: true, expect: 'B C' },
    { kind: 'predict', q: 'A static counter in a constructor. What does this print?', code: `public class Main {
    static class Ticket {
        static int next = 1;
        final int id;
        Ticket() { id = next++; }
    }

    public static void main(String[] args) {
        Ticket t1 = new Ticket();
        Ticket t2 = new Ticket();
        Ticket t3 = new Ticket();
        System.out.println(t1.id + " " + t3.id + " " + Ticket.next);
    }
}`, options: ['1 3 3', '1 3 4', '1 1 1', '0 2 3'], answer: 1, explain: '<code>next++</code> returns the old value, then adds one. Each object keeps its own <code>id</code> (1, 2, 3). The shared <code>next</code> ends at 4.', run: true, expect: '1 3 4' },
    { kind: 'predict', q: 'Constructor chaining with <code>this(...)</code>. What does this print?', code: `public class Main {
    static class C {
        C() {
            this(1);
            System.out.print("A");
        }
        C(int x) {
            System.out.print("B" + x);
        }
    }

    public static void main(String[] args) {
        new C();
        System.out.println();
    }
}`, options: ['AB1', 'B1A', 'A', 'B1'], answer: 1, explain: '<code>this(1)</code> must be the first statement, and it runs the other constructor to completion before the rest of <code>C()</code> continues.', run: true, expect: 'B1A' },
    { kind: 'predict', q: 'Field initialiser, initialiser block, constructor. What does this print?', code: `public class Main {
    static class D {
        int x = 1;
        { x = x * 10; System.out.print("init" + x + " "); }
        D() { x++; System.out.print("ctor" + x); }
    }

    public static void main(String[] args) {
        new D();
        System.out.println();
    }
}`, options: ['ctor2 init20', 'init10 ctor11', 'init0 ctor1', 'init10 ctor2'], answer: 1, explain: 'Field initialisers and <code>{ }</code> blocks run in source order. They run after the parent constructor and before the constructor body. So x becomes 1, then 10, then 11.', run: true, expect: 'init10 ctor11' },
    { kind: 'concept', q: 'In <code>class Account { private long balance; boolean richerThan(Account other) { return balance &gt; other.balance; } }</code>, does <code>other.balance</code> compile?', options: ['Yes: private means private to the class, not to the object', 'No: you can only read your own private fields', 'Only if <code>other</code> is <code>this</code>', 'Only with a getter'], answer: 0, explain: 'Java checks access per <b>class</b>, not per object. Code inside <code>Account</code> can read the private fields of any <code>Account</code>. That’s how <code>equals</code> compares fields directly.' }
  ],
  interview: [
    { q: 'What is the difference between a class and an object?', a: '<p>A class defines a type: fields, constructors and methods. An object is one instance of it, made with <code>new</code>, with its own field values. Many objects, one class.</p>', lvl: 'core' },
    { q: 'What does <code>this</code> mean, and where can you use it?', a: '<ul><li><code>this.field</code>: the current object’s field, needed when a parameter has the same name.</li><li><code>this(...)</code>: call another constructor of the same class (first statement only).</li><li>Passing <code>this</code>: hand the current object to another method.</li></ul><p>There is no <code>this</code> in a static method.</p>', lvl: 'core' },
    { q: 'When does Java give you a default constructor?', a: '<p>Only if the class declares no constructor at all. Java then adds a no-arg one that calls <code>super()</code>. Once you write any constructor, you must write the no-arg one yourself.</p>', lvl: 'core' },
    { q: 'Explain the four access levels.', a: '<ul><li><code>private</code>: only inside the same top-level class.</li><li>package-private (no keyword): any class in the same package.</li><li><code>protected</code>: same package, plus subclasses in other packages.</li><li><code>public</code>: everywhere (subject to modules, if used).</li></ul><p>A top-level class can only be <code>public</code> or package-private. A file has at most one public top-level class, named like the file.</p>', lvl: 'core' },
    { q: 'What is the difference between static and instance fields?', a: '<p>An instance field has one copy per object. A static field has one copy per class, shared by all objects. You reach it as <code>ClassName.field</code>, with no object. Changeable static fields are global state: shared across threads and hard to test. Typical static fields are constants: <code>static final int MAX = 10;</code>.</p>', fu: 'When is a static field set up? When the class is first used, e.g. on the first <code>new</code> or static method call.', lvl: 'core' },
    { q: 'What is encapsulation and why make fields private?', a: '<p>Encapsulation means hiding the inside and exposing only safe operations. With private fields, the class can enforce rules (balance never negative). It can change its inside later. And it can add checks or logging in one place.</p>', lvl: 'core' },
    { q: 'What does <code>import</code> actually do? And <code>import static</code>?', a: '<p><code>import</code> is only a compile-time shortcut. It lets you write <code>List</code> instead of <code>java.util.List</code>. Nothing is loaded or copied. Classes load when first used. <code>import static</code> does the same for static members, e.g. <code>import static java.lang.Math.max;</code>. <code>java.lang</code> and the current package are always visible.</p>', lvl: 'core' },
    { q: 'In what order is a new object initialised?', a: '<ol><li>Memory is allocated and every field set to its default (0/false/null).</li><li>The constructor is called; it first runs <code>this(...)</code> or <code>super(...)</code> (implicit <code>super()</code> if neither is written).</li><li>After the superclass constructor returns, field initialisers and instance initialiser blocks run in source order.</li><li>The rest of the constructor body runs.</li></ol>', fu: 'Why is calling an overridable method from a constructor risky? The subclass override runs before the subclass’s fields are initialised.', lvl: 'deep' },
    { q: 'Should you use a class or a record?', a: '<p>Use a <code>record</code> (Java 16+) for plain immutable data carriers: it generates the constructor, accessors, <code>equals</code>, <code>hashCode</code> and <code>toString</code>. Use a regular class when the object has mutable state, behaviour that protects invariants over time, or needs to extend another class. See <a href="immutability-records.html">Immutability &amp; records</a>.</p>', lvl: 'core' },
    { q: 'What is the difference between a static nested class and an inner class?', a: '<p>A <b>static nested</b> class is a class named inside another. It needs no outer object. An <b>inner</b> (non-static) class holds a hidden reference to an outer object and can read its fields. Prefer static nested. The hidden reference can keep the outer object alive too long.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'A well-encapsulated class', lang: 'java', code: `// Java 21
package com.shop.billing;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public final class Invoice {
    private final String number;
    private final List<Line> lines = new ArrayList<>();

    public Invoice(String number) {
        this.number = Objects.requireNonNull(number, "number");
    }

    public void addLine(String sku, int qty, long unitCents) {
        if (qty <= 0) throw new IllegalArgumentException("qty must be positive");
        lines.add(new Line(sku, qty, unitCents));
    }

    public long totalCents() {
        long t = 0;
        for (Line l : lines) t += l.qty() * l.unitCents();
        return t;
    }

    public List<Line> lines() { return List.copyOf(lines); }   // read-only copy

    public record Line(String sku, int qty, long unitCents) {}
}`, note: 'Private final fields, validation in the constructor and methods, and no way for callers to break the invariant.' },
    { title: 'Static factory and constants', lang: 'java', code: `public final class Temperature {
    public static final double ABSOLUTE_ZERO_C = -273.15;   // constant

    private final double celsius;

    private Temperature(double celsius) { this.celsius = celsius; }   // hidden

    public static Temperature ofCelsius(double c) {
        if (c < ABSOLUTE_ZERO_C) throw new IllegalArgumentException("below absolute zero");
        return new Temperature(c);
    }
    public static Temperature ofFahrenheit(double f) {
        return ofCelsius((f - 32) * 5 / 9);
    }
    public double celsius() { return celsius; }
}`, note: 'A private constructor plus named static factories reads better than overloaded constructors with the same parameter types.' }
  ]
});

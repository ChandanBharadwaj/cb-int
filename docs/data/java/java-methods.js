IA.register({
  track: 'java',
  slug: 'java-methods',
  title: 'Methods',
  tagline: 'A method is named, reusable code. It takes typed inputs (<b>parameters</b>) and gives back a typed result. Java copies every argument into the method. It picks among same-named methods at <b>compile time</b>. <code>static</code> methods belong to the class; instance methods run on an object.',
  tldr: {
    problem: 'You expect a method to change your variable, and it doesn’t. The “wrong” same-named method runs. Or you call a helper from <code>main</code> and get “non-static method cannot be referenced from a static context”.',
    model: 'Each call gets a fresh <b>stack frame</b>. Parameters are new local variables holding <b>copies</b> of the arguments. For objects, that is a copy of the reference. The compiler picks the overload from the declared types. <code>static</code> means “no object needed”.',
    hook: '“Is Java pass-by-reference?” No. Always pass-by-value. For objects, the copy is of the reference. The method can change the object, but never the caller’s variable.',
    facts: [
      { v: 'signature', l: 'is the method name plus parameter types. The return type is <b>not</b> part of it, so you can’t overload on return type alone' },
      { v: '3 phases', l: 'of overload resolution (JLS 15.12.2): first without boxing or varargs, then with boxing, then with varargs' },
      { v: 'T...', l: 'varargs must be the last parameter; inside the method it is an ordinary array (empty if no arguments were passed)' }
    ]
  },
  intro: {
    what: 'A <b>method</b> packages a few lines of code behind a name so you can call it again and again. You declare what it needs (<b>parameters</b>, each with a type) and what it gives back (the <b>return type</b>, or <code>void</code> for nothing). Methods always live inside a class. You call a <code>static</code> method on the class (<code>Math.max(3, 7)</code>). You call an instance method on an object (<code>name.length()</code>).',
    analogy: { icon: '🧾', title: 'A recipe card', text: 'The card’s title is the method name. The ingredient list is the parameter list. You hand over ingredients (arguments). The cook works on copies in their own kitchen (the stack frame). The finished dish is the return value. Two cards can share a title if they need different ingredients: that is overloading.' },
    steps: [
      { t: 'Declare it', d: 'Modifiers, return type, name, then parameters in brackets.', code: 'static int add(int a, int b) {\n    return a + b;\n}' },
      { t: 'Call it', d: 'Pass arguments in the same order and of compatible types. Use the result or ignore it.', code: 'int total = add(2, 3);   // 5\nadd(1, 1);               // result discarded: legal' },
      { t: 'Return (or not)', d: '<code>void</code> methods return nothing. Any other method must return a value on every path.', code: 'static void greet(String name) {\n    System.out.println("Hi " + name);\n}' },
      { t: 'Overload', d: 'Same name, different parameter types or count. The compiler picks the best match.', code: 'static double add(double a, double b) { return a + b; }\nadd(2, 3);       // int version\nadd(2.5, 1);     // double version' },
      { t: 'Static vs instance', d: '<code>main</code> is static. To call an instance method you need an object first.', code: 'class Greeter {\n    String hello(String n) { return "Hi " + n; }  // instance\n}\nnew Greeter().hello("Ann");' }
    ],
    terms: [
      ['parameter / argument', 'The parameter is the variable in the declaration (<code>int a</code>); the argument is the value you pass (<code>2</code>).'],
      ['return type', 'The type of the value handed back, or <code>void</code>.'],
      ['signature', 'Name + parameter types. Two methods in one class can’t share a signature.'],
      ['overloading', 'Several methods with the same name but different parameter lists, chosen at compile time.'],
      ['static', 'Belongs to the class, not to any object. No <code>this</code>.'],
      ['varargs', '<code>int... nums</code>: accepts zero or more values, received as an array.']
    ]
  },
  visual: {
    title: 'Frames, overloads, static and varargs',
    caption: 'Pick a scenario and press <b>Play</b> or <b>Step</b>. <b>Call &amp; return</b> shows a new stack frame per call. <b>Overloading</b> shows how the compiler picks among <code>f(int)</code>, <code>f(long)</code>, <code>f(Object)</code> and <code>f(int...)</code>. <b>static vs instance</b> shows one shared field versus one per object. <b>Varargs</b> shows the hidden array.'
  },
  gotchas: [
    { trap: 'Expecting a method to change the caller’s variable', code: `static void reset(int n) { n = 0; }
static void reset(int[] a) { a = new int[]{0}; }   // reassigns the local copy only

int x = 5; reset(x);          // x is still 5
int[] arr = {5}; reset(arr);  // arr[0] is still 5`, why: 'Parameters are copies. Reassigning a parameter changes only the copy. Changing an object <i>through</i> the reference (<code>a[0] = 0</code>) is visible to the caller.', fix: 'Return the new value (<code>x = reset(x)</code>), or mutate the object’s contents on purpose. Background: <a href="references-pass-by-value.html">References &amp; pass-by-value</a>.' },
    { trap: 'Calling an instance method from static <code>main</code>', code: `public class Main {
    int twice(int n) { return n * 2; }
    public static void main(String[] args) {
        System.out.println(twice(4));   // compile error
    }
}`, why: '<code>main</code> is static, so there is no <code>this</code> object to call <code>twice</code> on. Error: “non-static method twice(int) cannot be referenced from a static context”.', fix: 'Make the helper <code>static</code>, or create an object: <code>new Main().twice(4)</code>.' },
    { trap: 'Overloading on return type', code: `int    parse(String s) { … }
double parse(String s) { … }   // compile error: already defined`, why: 'The return type is not part of the signature. At a call like <code>parse("1");</code> the compiler couldn’t tell which you meant.', fix: 'Use different names: <code>parseInt</code>, <code>parseDouble</code>.' },
    { trap: '<code>remove(int)</code> vs <code>remove(Object)</code> on a <code>List&lt;Integer&gt;</code>', code: `List<Integer> ids = new ArrayList<>(List.of(10, 20, 30));
ids.remove(1);                  // removes index 1 → [10, 30]
ids.remove(Integer.valueOf(10)); // removes the value 10 → [30]`, why: 'Overload resolution prefers an exact primitive match (phase 1) over boxing (phase 2), so <code>remove(1)</code> means “index 1”.', fix: 'Box explicitly when you mean the value: <code>remove(Integer.valueOf(x))</code>.' },
    { trap: 'Ambiguous overloads with <code>null</code>', code: `static void log(String s)  { }
static void log(Integer i) { }
log(null);   // compile error: reference to log is ambiguous`, why: '<code>null</code> fits both, and neither <code>String</code> nor <code>Integer</code> is more specific than the other.', fix: 'Cast: <code>log((String) null)</code>, or avoid overloads that differ only by unrelated reference types.' },
    { trap: 'Missing return on some path', code: `static String grade(int score) {
    if (score >= 50) return "pass";
    else if (score < 50) return "fail";
}   // compile error: missing return statement`, why: 'The compiler doesn’t reason about whether your conditions cover every case. It only sees that the method can reach the end without returning.', fix: 'End with a plain <code>else</code>, or a final <code>return</code>/<code>throw</code>.' }
  ],
  scenarios: [
    { title: 'Discount never applied', symptom: 'A checkout service logs “applied 10% discount” but the charged amount is unchanged.', diagnose: 'Step through in the debugger: inside <code>applyDiscount</code> the value changes, but after the call the caller’s <code>price</code> is the same.', cause: 'The method reassigned its <code>BigDecimal</code> parameter. <code>BigDecimal</code> can’t change, and the parameter is a copy of the reference. So the caller never saw the new object.', fix: 'Return the result and assign it at the call site.', fixCode: `// before
static void applyDiscount(BigDecimal price) {
    price = price.multiply(new BigDecimal("0.90"));   // lost
}
// after
static BigDecimal applyDiscount(BigDecimal price) {
    return price.multiply(new BigDecimal("0.90"));
}
total = applyDiscount(total);` },
    { title: 'Wrong item removed from a cart', symptom: 'Removing product id <code>2</code> from a cart sometimes deletes a different product, or throws <code>IndexOutOfBoundsException</code>.', diagnose: 'The cart is a <code>List&lt;Integer&gt;</code> of product ids, and the code calls <code>cart.remove(productId)</code> with an <code>int</code>.', cause: 'With an <code>int</code> argument the compiler picks <code>remove(int index)</code>, not <code>remove(Object)</code>. It removes by position.', fix: 'Box the argument, or better, use a <code>Set&lt;Integer&gt;</code> or a typed id.', fixCode: `cart.remove(Integer.valueOf(productId));   // by value
// or
Set<Integer> cart = new LinkedHashSet<>();
cart.remove(productId);                    // Set has only remove(Object)` }
  ],
  puzzles: [
    { kind: 'predict', q: 'A primitive and an array go into methods. What does this print?', code: `public class Main {
    static void bump(int n) { n++; }
    static void bumpArr(int[] a) { a[0]++; }

    public static void main(String[] args) {
        int x = 1;
        int[] arr = {1};
        bump(x);
        bumpArr(arr);
        System.out.println(x + " " + arr[0]);
    }
}`, options: ['1 1', '1 2', '2 2', '2 1'], answer: 1, explain: '<code>bump</code> increments its own copy of <code>x</code>. <code>bumpArr</code> gets a copy of the <i>reference</i>. It still points to the same array, so <code>a[0]++</code> changes the caller’s array.', run: true, expect: '1 2' },
    { kind: 'predict', q: 'Widening or boxing? What does this print?', code: `public class Main {
    static String f(long a)    { return "long"; }
    static String f(Integer a) { return "Integer"; }

    public static void main(String[] args) {
        System.out.println(f(5));
    }
}`, options: ['long', 'Integer', 'Compile error: ambiguous', 'int'], answer: 0, explain: 'The compiler first tries matches without boxing. Widening (int → long) is allowed there. <code>f(long)</code> matches, so boxing to <code>Integer</code> is never tried. This kept old code working when boxing arrived in Java 5.', run: true, expect: 'long' },
    { kind: 'predict', q: 'Passing <code>null</code>. What does this print?', code: `public class Main {
    static String f(Object o) { return "Object"; }
    static String f(String s) { return "String"; }

    public static void main(String[] args) {
        System.out.println(f(null));
    }
}`, options: ['Object', 'String', 'Compile error: ambiguous', 'NullPointerException'], answer: 1, explain: '<code>null</code> fits both. <code>String</code> is a subtype of <code>Object</code>, so <code>f(String)</code> is <b>more specific</b> and wins. With two unrelated types (say <code>String</code> and <code>Integer</code>) it would be ambiguous.', run: true, expect: 'String' },
    { kind: 'predict', q: 'Varargs lengths. What does this print?', code: `public class Main {
    static int count(int... a) { return a.length; }

    public static void main(String[] args) {
        System.out.println(count() + " " + count(1, 2) + " " + count(new int[]{7, 8, 9}));
    }
}`, options: ['0 2 3', '1 2 3', '0 2 1', 'Compile error'], answer: 0, explain: 'No arguments gives an empty array (length 0, not <code>null</code>). <code>count(1, 2)</code> becomes <code>count(new int[]{1, 2})</code>. An existing <code>int[]</code> is passed through as the array itself.', run: true, expect: '0 2 3' },
    { kind: 'predict', q: 'Static versus instance fields. What does this print?', code: `public class Main {
    static class Counter {
        static int total;
        int mine;
        void inc() { total++; mine++; }
    }

    public static void main(String[] args) {
        Counter a = new Counter();
        Counter b = new Counter();
        a.inc(); a.inc(); b.inc();
        System.out.println(a.mine + " " + b.mine + " " + Counter.total);
    }
}`, options: ['2 1 3', '3 3 3', '2 1 2', '1 1 3'], answer: 0, explain: 'Each object has its own <code>mine</code>; there is one <code>total</code> for the whole class. Three calls to <code>inc()</code> add 3 to <code>total</code>.', run: true, expect: '2 1 3' },
    { kind: 'predict', q: 'String vs StringBuilder as parameters. What does this print?', code: `public class Main {
    static void a(String s)        { s += "!"; }
    static void b(StringBuilder sb) { sb.append("!"); }

    public static void main(String[] args) {
        String s = "hi";
        StringBuilder sb = new StringBuilder("hi");
        a(s);
        b(sb);
        System.out.println(s + " " + sb);
    }
}`, options: ['hi hi', 'hi! hi!', 'hi hi!', 'hi! hi'], answer: 2, explain: '<code>s += "!"</code> builds a <b>new</b> String and points the local copy at it; the caller’s <code>s</code> is untouched (Strings are immutable). <code>sb.append</code> changes the one shared StringBuilder object.', run: true, expect: 'hi hi!' },
    { kind: 'concept', q: 'Which pair can live in the same class?', options: ['<code>int size()</code> and <code>long size()</code>', '<code>void put(int a, String b)</code> and <code>void put(String a, int b)</code>', '<code>void run(int x)</code> and <code>void run(int y)</code>', '<code>static void go()</code> and <code>void go()</code>'], answer: 1, explain: 'Overloads must differ in parameter types (order counts). Return type, parameter names and <code>static</code> don’t count. So the other three are “already defined” errors.' }
  ],
  interview: [
    { q: 'Is Java pass-by-value or pass-by-reference?', a: '<p>Always <b>pass-by-value</b>. The method gets a copy of each argument. For a primitive, that is the number. For an object, it is a copy of the <b>reference</b>. So the method can change the object, but reassigning the parameter never touches the caller’s variable.</p>', fu: 'How would you write a <code>swap(a, b)</code> for two Integers? You can’t, not for the caller’s variables. Return a pair, or swap elements inside an array or holder object.', lvl: 'core' },
    { q: 'What is method overloading, and how is it different from overriding?', a: '<ul><li><b>Overloading</b>: same name, different parameter lists, usually in one class. Chosen by the compiler from the <i>declared</i> argument types.</li><li><b>Overriding</b>: a subclass redefines an inherited method with the same signature. Chosen at run time from the object’s <i>actual</i> class.</li></ul><p>See <a href="java-inheritance-interfaces.html">Inheritance &amp; interfaces</a>.</p>', lvl: 'core' },
    { q: 'Can you overload by return type alone?', a: '<p>No. A signature is the name plus parameter types. Two methods that differ only in return type won’t compile. A call that ignores the result couldn’t pick one.</p>', lvl: 'core' },
    { q: 'What is the difference between a static and an instance method?', a: '<p>A <b>static</b> method belongs to the class. You call <code>ClassName.m()</code>. It has no <code>this</code>, so it can’t read instance fields directly. An <b>instance</b> method runs on one object and can read its fields. Use static for helpers (<code>Math.max</code>) and factories (<code>List.of</code>). Use instance methods when behaviour depends on an object’s state.</p>', fu: 'Can a static method be overridden? No. A subclass static method with the same signature <i>hides</i> it. The declared type decides which one runs.', lvl: 'core' },
    { q: 'Why is <code>main</code> declared <code>public static void main(String[] args)</code>?', a: '<ul><li><code>public</code>: the launcher must be able to call it.</li><li><code>static</code>: it runs before any object exists.</li><li><code>void</code>: the exit code is set with <code>System.exit</code>, not a return value.</li><li><code>String[] args</code>: command-line arguments.</li></ul><p>(Java 21 has a preview feature for shorter, instance <code>main</code> methods; it needs <code>--enable-preview</code>.)</p>', lvl: 'core' },
    { q: 'What are varargs and what are their rules?', a: '<p><code>void log(String fmt, Object... args)</code> takes zero or more extra arguments, which arrive as an array. Only one varargs parameter is allowed, and it must be last. No arguments gives an empty array. When picking overloads, varargs is the <b>last</b> resort.</p>', fu: 'Why does <code>List.of</code> have overloads for 0 to 10 elements plus a varargs one? To avoid allocating an array for the common small cases.', lvl: 'core' },
    { q: 'How does the compiler pick an overload?', a: '<p>In three phases. It stops at the first phase that finds a match:</p><ol><li>Exact match or widening (int → long → double, subclass → superclass). No boxing, no varargs.</li><li>Allow boxing/unboxing.</li><li>Allow varargs.</li></ol><p>Within a phase, the <b>most specific</b> method wins. If none is more specific, the call is ambiguous.</p>', lvl: 'deep' },
    { q: 'What happens to local variables and parameters when a method returns?', a: '<p>They live in the method’s stack frame, which is thrown away on return. Objects they pointed to stay on the heap until nothing points to them. Recursion that never returns fills the stack and ends in <code>StackOverflowError</code>.</p>', lvl: 'core' },
    { q: 'Should methods take many parameters?', a: '<p>Keep parameter lists short (often three or fewer). Long lists of same-typed parameters (<code>String, String, String</code>) are easy to pass in the wrong order. Group them into a <code>record</code> or use a builder.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Small, pure helpers', lang: 'java', code: `// Java 21
public final class Money {
    private Money() {}                          // no instances: static helpers only

    public static long toCents(String amount) {
        return new java.math.BigDecimal(amount)
                .movePointRight(2)
                .longValueExact();
    }

    public static String format(long cents) {   // cents >= 0
        return String.format("%d.%02d", cents / 100, Math.abs(cents % 100));
    }
}

long c = Money.toCents("12.50");   // 1250
String s = Money.format(c);        // "12.50"`, note: 'Static, side-effect-free methods are easy to test: input in, result out.' },
    { title: 'Overloads that delegate', lang: 'java', code: `public class Notifier {
    public void send(String to, String body) {
        send(to, body, Priority.NORMAL);         // one real implementation
    }
    public void send(String to, String body, Priority p) {
        // ... validate, build message, enqueue
    }
    public void sendAll(String body, String... recipients) {
        for (String r : recipients) send(r, body);
    }
}
enum Priority { NORMAL, HIGH }`, note: 'Shorter overloads fill in defaults and delegate to one full version. Java has no default parameter values.' }
  ]
});

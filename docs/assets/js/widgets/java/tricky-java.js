/* Tricky Java: a timed drill of predict-the-output and concept questions across the whole Java track, scored per topic, with a review of misses that links back to each topic page. */
IA.widget('tricky-java', (root, ctx) => {
  const { el, reduced } = ctx;
  /*Q-START*/
  const Q = [
    // ---------- M0 · Language core ----------
    { t: 'References & pass-by-value', s: 'references-pass-by-value', m: 'Language core', q: 'What does this print?', run: true, expect: 'hi!', code: `public class Main {
    static void change(StringBuilder sb) {
        sb.append("!");
        sb = new StringBuilder("new");
        sb.append("?");
    }

    public static void main(String[] a) {
        StringBuilder sb = new StringBuilder("hi");
        change(sb);
        System.out.println(sb);
    }
}`, o: ['hi', 'hi!', 'new?', 'hi!new?'], a: 1, x: 'Java passes the <b>reference by value</b>. <code>append</code> mutates the shared object (“hi!”); reassigning the parameter only changes the method’s local copy of the reference, so <code>new?</code> is never seen by the caller.' },
    { t: 'References & pass-by-value', s: 'references-pass-by-value', m: 'Language core', q: 'Boxed comparisons. Output?', run: true, expect: 'true false true', code: `public class Main {
    public static void main(String[] args) {
        Integer a = 127, b = 127, c = 128, d = 128;
        System.out.println((a == b) + " " + (c == d) + " " + c.equals(d));
    }
}`, o: ['true true true', 'true false true', 'false false true', 'true false false'], a: 1, x: 'Autoboxing uses <code>Integer.valueOf</code>, which caches −128…127, so the two 127s are the <b>same object</b>. 128 creates two objects, so <code>==</code> (identity) is false. Always compare boxed values with <code>equals</code>.' },
    { t: 'equals & hashCode', s: 'equals-hashcode', m: 'Language core', q: '<code>P</code> overrides <code>equals</code> but not <code>hashCode</code>. Output?', run: true, expect: 'false true', code: `import java.util.*;

public class Main {
    static class P {
        final int x;
        P(int x) { this.x = x; }
        @Override public boolean equals(Object o) { return o instanceof P p && p.x == x; }
    }
    record Q(int x) {}

    public static void main(String[] a) {
        Set<P> ps = new HashSet<>(List.of(new P(1)));
        Set<Q> qs = new HashSet<>(List.of(new Q(1)));
        System.out.println(ps.contains(new P(1)) + " " + qs.contains(new Q(1)));
    }
}`, o: ['true true', 'false true', 'false false', 'true false'], a: 1, x: 'Without <code>hashCode</code>, <code>P</code> uses identity hashes, so the lookup goes to a different bucket (or fails the stored-hash check) and <code>equals</code> is never consulted: <b>false</b>. Records generate <code>equals</code> and <code>hashCode</code> from their components: <b>true</b>.' },
    { t: 'equals & hashCode', s: 'equals-hashcode', m: 'Language core', q: 'A comparator that disagrees with equals. Output?', run: true, expect: '1 2', code: `import java.util.*;

public class Main {
    public static void main(String[] a) {
        Set<String> tree = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        tree.add("a");
        tree.add("A");
        Set<String> hash = new HashSet<>(List.of("a", "A"));
        System.out.println(tree.size() + " " + hash.size());
    }
}`, o: ['2 2', '1 2', '1 1', '2 1'], a: 1, x: 'A <code>TreeSet</code> uses <code>compare</code>, never <code>equals</code>: “a” and “A” compare as 0, so the second add is a duplicate (<b>1</b>). <code>HashSet</code> uses <code>hashCode</code>/<code>equals</code> (<b>2</b>). This is why “consistent with equals” matters for sorted collections.' },
    { t: 'Immutability & records', s: 'immutability-records', m: 'Language core', q: 'View vs copy. Output?', run: true, expect: '2 1\nUOE', code: `import java.util.*;

public class Main {
    public static void main(String[] a) {
        List<String> src = new ArrayList<>(List.of("a"));
        List<String> view = Collections.unmodifiableList(src);
        List<String> copy = List.copyOf(src);
        src.add("b");
        System.out.println(view.size() + " " + copy.size());
        try {
            copy.add("c");
        } catch (UnsupportedOperationException e) {
            System.out.println("UOE");
        }
    }
}`, o: ['1 1, then UOE', '2 1, then UOE', '2 2, then UOE', '2 1, then [a, c]'], a: 1, x: '<code>unmodifiableList</code> is a read-only <b>view</b>: changes to the source show through (2). <code>List.copyOf</code> (Java 10) makes an independent immutable copy (1). Both throw <code>UnsupportedOperationException</code> on mutation.' },
    { t: 'Generics & type erasure', s: 'generics-erasure', m: 'Language core', q: 'What does this print?', run: true, expect: 'true java.util.ArrayList', code: `import java.util.*;

public class Main {
    public static void main(String[] a) {
        List<String> s = new ArrayList<>();
        List<Integer> i = new ArrayList<>();
        System.out.println((s.getClass() == i.getClass()) + " " + s.getClass().getName());
    }
}`, o: ['false java.util.ArrayList<String>', 'true java.util.ArrayList', 'false java.util.ArrayList', 'It does not compile'], a: 1, x: 'Type arguments are <b>erased</b>: at run time both are plain <code>ArrayList</code>, with one <code>Class</code> object. That is why you can’t write <code>new T()</code>, <code>instanceof List&lt;String&gt;</code> or overload on <code>List&lt;String&gt;</code> vs <code>List&lt;Integer&gt;</code>.' },
    { t: 'Generics & type erasure', s: 'generics-erasure', m: 'Language core', q: 'Heap pollution through a raw type. Output?', run: true, expect: 'oops CCE', code: `import java.util.*;

public class Main {
    @SuppressWarnings({"rawtypes", "unchecked"})
    public static void main(String[] a) {
        List<Integer> ints = new ArrayList<>();
        List raw = ints;
        raw.add("oops");
        Object o = ints.get(0);
        System.out.print(o + " ");
        try {
            Integer i = ints.get(0);
        } catch (ClassCastException e) {
            System.out.println("CCE");
        }
    }
}`, o: ['ClassCastException at raw.add', 'oops CCE', 'oops oops', 'It does not compile'], a: 1, x: 'The raw add succeeds: the list stores Objects. Reading into <code>Object</code> needs no cast. Assigning to <code>Integer</code> makes javac insert a <code>checkcast</code>, which fails <b>far from the bug</b>. That is heap pollution; unchecked warnings are the only early signal.' },
    { t: 'Exceptions done right', s: 'exceptions', m: 'Language core', q: '<code>return</code> and <code>finally</code>. Output?', run: true, expect: '1 1', code: `public class Main {
    @SuppressWarnings("finally")
    static int f() {
        try {
            throw new RuntimeException("x");
        } finally {
            return 1;
        }
    }

    static int g() {
        int x = 1;
        try {
            return x;
        } finally {
            x = 2;
        }
    }

    public static void main(String[] a) {
        System.out.println(f() + " " + g());
    }
}`, o: ['RuntimeException: x', '1 2', '1 1', '2 1'], a: 2, x: '<code>f</code>: a <code>return</code> in <code>finally</code> <b>discards</b> the exception, a reason never to return from finally. <code>g</code>: the return value is evaluated (1) before <code>finally</code> runs; changing the local afterwards doesn’t affect it.' },
    { t: 'Exceptions done right', s: 'exceptions', m: 'Language core', q: 'Two resources whose <code>close()</code> throws. Output?', run: true, expect: 'body 2 close b', code: `public class Main {
    static class R implements AutoCloseable {
        final String n;
        R(String n) { this.n = n; }
        @Override public void close() { throw new IllegalStateException("close " + n); }
    }

    public static void main(String[] args) {
        try (R a = new R("a"); R b = new R("b")) {
            throw new RuntimeException("body");
        } catch (Exception e) {
            System.out.println(e.getMessage() + " " + e.getSuppressed().length + " "
                    + e.getSuppressed()[0].getMessage());
        }
    }
}`, o: ['close a 1 body', 'body 2 close a', 'body 2 close b', 'close b 2 body'], a: 2, x: 'The body’s exception is the primary one. Resources close in <b>reverse order</b> (b, then a), and their exceptions are attached as <b>suppressed</b>, so nothing is lost. A hand-written finally would have replaced “body” with the close failure.' },
    { t: 'Strings & interning', s: 'strings-interning', m: 'Language core', q: 'Which strings are the same object?', run: true, expect: 'true false false true', code: `public class Main {
    public static void main(String[] args) {
        String a = "hello";
        String b = "hel" + "lo";
        String c = new String("hello");
        String part = "hel";
        String d = part + "lo";
        System.out.println((a == b) + " " + (a == c) + " " + (a == d) + " " + (a == d.intern()));
    }
}`, o: ['true false false true', 'true false true true', 'false false false true', 'true true false true'], a: 0, x: '<code>"hel" + "lo"</code> is a compile-time constant, folded into the same pooled literal. <code>new String</code> always makes a new object. <code>part</code> isn’t <code>final</code>, so <code>part + "lo"</code> is built at run time: a new object. <code>intern()</code> returns the pooled instance.' },
    { t: 'Strings & interning', s: 'strings-interning', m: 'Language core', q: 'One emoji. Output?', run: true, expect: '2 1', code: `public class Main {
    public static void main(String[] args) {
        String s = "\\uD83D\\uDE00";   // U+1F600, grinning face
        System.out.println(s.length() + " " + s.codePointCount(0, s.length()));
    }
}`, o: ['1 1', '2 1', '4 1', '2 2'], a: 1, x: '<code>length()</code> counts UTF-16 <b>code units</b>. Characters outside the Basic Multilingual Plane take a surrogate pair (2 units) but are one <b>code point</b>. Truncating with <code>substring</code> can split the pair and produce garbage.' },
    { t: 'Sealed types & pattern matching', s: 'sealed-pattern-matching', m: 'Language core', q: 'An expression evaluator with record patterns. Output?', run: true, expect: '14 0', code: `public class Main {
    sealed interface Expr {}
    record Num(int v) implements Expr {}
    record Add(Expr l, Expr r) implements Expr {}
    record Mul(Expr l, Expr r) implements Expr {}

    static int eval(Expr e) {
        return switch (e) {
            case Num n -> n.v();
            case Add(var l, var r) -> eval(l) + eval(r);
            case Mul(Num(var x), var r) when x == 0 -> 0;
            case Mul(var l, var r) -> eval(l) * eval(r);
        };
    }

    public static void main(String[] a) {
        System.out.println(eval(new Add(new Num(2), new Mul(new Num(3), new Num(4)))) + " "
                + eval(new Mul(new Num(0), new Num(9))));
    }
}`, o: ['14 0', '20 0', '14 9', 'It does not compile: missing default'], a: 0, x: '2 + 3 × 4 = <b>14</b>; the guarded nested pattern short-circuits <code>0 × 9</code> to <b>0</b>. No <code>default</code> is needed: <code>Expr</code> is sealed and Num, Add and an unguarded Mul cover every case, so the compiler proves the switch exhaustive (Java 21).' },
    { t: 'Lambdas & functional interfaces', s: 'lambdas-functional', m: 'Language core', q: 'Bound method references. Output?', run: true, expect: 'A xy', code: `import java.util.function.*;

public class Main {
    public static void main(String[] a) {
        String prefix = "a";
        Supplier<String> s1 = prefix::toUpperCase;
        StringBuilder sb = new StringBuilder("x");
        Supplier<String> s2 = sb::toString;
        sb.append("y");
        System.out.println(s1.get() + " " + s2.get());
    }
}`, o: ['A x', 'A xy', 'a xy', 'It does not compile: sb is not effectively final'], a: 1, x: 'A bound method reference captures the <b>receiver object</b> when it is created. The <code>StringBuilder</code> is the same object that is later mutated, so <code>toString</code> sees “xy”. <code>sb</code> is effectively final (never reassigned); mutation is allowed.' },
    { t: 'Streams & collectors', s: 'streams-collectors', m: 'Language core', q: 'Laziness and short-circuiting. Output?', run: true, expect: 'f1 f2 m2 -> 20', code: `import java.util.stream.*;

public class Main {
    public static void main(String[] a) {
        Stream.of(1, 2, 3, 4)
              .filter(x -> { System.out.print("f" + x + " "); return x % 2 == 0; })
              .map(x -> { System.out.print("m" + x + " "); return x * 10; })
              .findFirst()
              .ifPresent(x -> System.out.println("-> " + x));
    }
}`, o: ['f1 f2 f3 f4 m2 m4 -> 20', 'f1 f2 m2 -> 20', 'f1 m1 f2 m2 -> 20', 'f2 m2 -> 20'], a: 1, x: 'Streams process <b>one element at a time</b> through the whole pipeline, and nothing runs until the terminal operation. <code>findFirst</code> stops as soon as element 2 has passed <code>filter</code> and <code>map</code>; 3 and 4 are never touched.' },
    { t: 'Streams & collectors', s: 'streams-collectors', m: 'Language core', q: '<code>toMap</code> with a duplicate key. Output?', run: true, expect: 'ISE', code: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] a) {
        try {
            Map<Character, Integer> m = Stream.of("ab", "ac")
                    .collect(Collectors.toMap(s -> s.charAt(0), String::length));
            System.out.println(m);
        } catch (IllegalStateException e) {
            System.out.println("ISE");
        }
    }
}`, o: ['{a=2}', '{a=2, a=2}', 'ISE', 'null'], a: 2, x: 'Two-argument <code>toMap</code> throws <code>IllegalStateException</code> (“Duplicate key a …”) on a collision. Pass a merge function, <code>toMap(k, v, (x, y) -&gt; x)</code>, or use <code>groupingBy</code> when duplicates are expected.' },
    { t: 'Optional', s: 'optional', m: 'Language core', q: '<code>orElse</code> vs <code>orElseGet</code>. Output?', run: true, expect: 'computed\nv\nv', code: `import java.util.*;

public class Main {
    static String expensive() {
        System.out.println("computed");
        return "default";
    }

    public static void main(String[] a) {
        Optional<String> o = Optional.of("v");
        System.out.println(o.orElse(expensive()));
        System.out.println(o.orElseGet(Main::expensive));
    }
}`, o: ['v, v', 'computed, v, v', 'computed, v, computed, v', 'computed, default, v'], a: 1, x: '<code>orElse(x)</code> takes a <b>value</b>, so its argument is evaluated before the call, even when the Optional is present. <code>orElseGet</code> takes a <code>Supplier</code> and calls it only when empty. Use it for anything with a cost or a side effect.' },
    // ---------- M1 · Collections ----------
    { t: 'HashMap internals', s: 'hashmap-internals', m: 'Collections', q: 'Return values of map updates. Output?', run: true, expect: 'null 1 2 12 {a=12}', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Map<String, Integer> m = new HashMap<>();
        Integer r1 = m.put("a", 1);
        Integer r2 = m.put("a", 2);
        Integer r3 = m.putIfAbsent("a", 3);
        Integer r4 = m.merge("a", 10, Integer::sum);
        System.out.println(r1 + " " + r2 + " " + r3 + " " + r4 + " " + m);
    }
}`, o: ['null 1 2 12 {a=12}', 'null 1 null 12 {a=12}', '1 2 3 13 {a=13}', 'null 1 2 10 {a=10}'], a: 0, x: '<code>put</code> returns the <b>previous</b> value (null, then 1). <code>putIfAbsent</code> finds a value, leaves it, and returns it (2). <code>merge</code> returns the <b>new</b> value: 2 + 10 = 12. Mixed conventions are a common source of bugs.' },
    { t: 'Choosing collections', s: 'choosing-collections', m: 'Collections', q: 'ArrayDeque as stack and queue. Output?', run: true, expect: '[2, 1, 3]\n2 3', code: `import java.util.*;

public class Main {
    public static void main(String[] a) {
        Deque<Integer> d = new ArrayDeque<>();
        d.push(1);
        d.push(2);
        d.offer(3);
        System.out.println(d);
        System.out.println(d.pop() + " " + d.pollLast());
    }
}`, o: ['[1, 2, 3], then 1 3', '[2, 1, 3], then 2 3', '[3, 2, 1], then 3 1', '[2, 1, 3], then 3 2'], a: 1, x: '<code>push</code> = <code>addFirst</code>, <code>offer</code> = <code>addLast</code>, <code>pop</code> = <code>removeFirst</code>. So the deque is [2, 1, 3]; pop gives 2 and pollLast gives 3. <code>ArrayDeque</code> is the recommended stack and queue (not <code>Stack</code>, not <code>LinkedList</code>).' },
    { t: 'Choosing collections', s: 'choosing-collections', m: 'Collections', q: '<code>remove</code> on a <code>List&lt;Integer&gt;</code>. Output?', run: true, expect: '[30]', code: `import java.util.*;

public class Main {
    public static void main(String[] a) {
        List<Integer> l = new ArrayList<>(List.of(10, 20, 30));
        l.remove(1);
        l.remove(Integer.valueOf(10));
        System.out.println(l);
    }
}`, o: ['[20, 30]', '[30]', '[10, 30]', 'IndexOutOfBoundsException'], a: 1, x: '<code>remove(1)</code> picks the <code>remove(int index)</code> overload: it removes 20 at index 1. <code>remove(Integer.valueOf(10))</code> picks <code>remove(Object)</code>: it removes the value 10. Overload resolution prefers the primitive match without boxing.' },
    { t: 'Concurrent collections', s: 'concurrent-collections', m: 'Collections', q: 'Null keys. Output?', run: true, expect: '1 NPE', code: `import java.util.*;
import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        Map<String, Integer> h = new HashMap<>();
        h.put(null, 1);
        System.out.print(h.get(null) + " ");
        try {
            new ConcurrentHashMap<String, Integer>().put(null, 1);
        } catch (NullPointerException e) {
            System.out.println("NPE");
        }
    }
}`, o: ['1 NPE', 'NPE NPE', '1 1', 'null NPE'], a: 0, x: '<code>HashMap</code> allows one null key. <code>ConcurrentHashMap</code> forbids null keys and values: with concurrent updates, <code>get(k) == null</code> would be ambiguous (“absent” or “mapped to null?”) and couldn’t be re-checked atomically.' },
    { t: 'Concurrent collections', s: 'concurrent-collections', m: 'Collections', q: 'Adding while iterating a <code>CopyOnWriteArrayList</code>. Output?', run: true, expect: '[1, 2, 3, 4]', code: `import java.util.*;
import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        List<Integer> l = new CopyOnWriteArrayList<>(List.of(1, 2, 3));
        for (Integer x : l) if (x == 1) l.add(4);
        System.out.println(l);
    }
}`, o: ['ConcurrentModificationException', '[1, 2, 3, 4]', 'An infinite loop', '[1, 2, 3]'], a: 1, x: 'The iterator works on the array <b>snapshot</b> taken when it was created: it never sees 4 and never throws CME. Each write copies the whole array, which is why COW lists suit read-mostly data such as listener lists.' },
    // ---------- M2 · JVM internals ----------
    { t: 'Class loading', s: 'class-loading', m: 'JVM internals', q: 'When does <code>A</code> get initialised?', run: true, expect: '1 init 2', code: `public class Main {
    static class A {
        static { System.out.print("init "); }
        static final int K = 1;
        static int v = 2;
    }

    public static void main(String[] a) {
        System.out.print(A.K + " ");
        System.out.println(A.v);
    }
}`, o: ['init 1 2', '1 init 2', '1 2', 'init 1 init 2'], a: 1, x: '<code>K</code> is a compile-time constant (<code>static final</code> primitive with a constant initializer), so javac inlines the value and reading it doesn’t touch <code>A</code>. Reading the non-constant <code>v</code> triggers class initialisation first. Changing a constant therefore requires recompiling its users.' },
    { t: 'Class loading', s: 'class-loading', m: 'JVM internals', q: '<code>Class.forName("com.acme.X")</code> vs <code>loader.loadClass("com.acme.X")</code>: which runs X’s static initializer?', o: ['Both', 'Only Class.forName (by default)', 'Only loadClass', 'Neither until new X()'], a: 1, x: 'One-argument <code>Class.forName</code> loads, links <b>and initialises</b> the class (that is how old JDBC drivers registered themselves). <code>ClassLoader.loadClass</code> only loads it; initialisation happens on first active use.' },
    { t: 'JVM memory areas', s: 'jvm-memory-areas', m: 'JVM internals', q: '<code>java.lang.OutOfMemoryError: Metaspace</code> most likely means:', o: ['The heap is full of large arrays', 'Class metadata keeps growing, typically a class-loader leak (redeploys, dynamic proxies, scripting)', 'Too many threads', 'Direct buffers are not released'], a: 1, x: 'Metaspace (native memory, since Java 8) holds class metadata. It can only be freed when the <b>class loader</b> is unreachable. Common culprits: redeploys in an app server, generated classes per request, a ThreadLocal or static field pinning an old loader.' },
    { t: 'JVM memory areas', s: 'jvm-memory-areas', m: 'JVM internals', q: 'Why might raising <code>-Xmx</code> from 31 GB to 33 GB give you <i>less</i> usable heap for your objects?', o: ['It doesn’t; more is always more', 'Above ~32 GB the JVM can’t use compressed oops, so every reference grows from 4 to 8 bytes', 'The GC switches to Serial', 'Metaspace is taken out of the heap'], a: 1, x: 'Compressed ordinary object pointers store references as 32-bit offsets scaled by the 8-byte alignment, which covers about 32 GB. Beyond that, references are 64-bit, and reference-heavy heaps can lose much of the gain.' },
    { t: 'Garbage collection', s: 'garbage-collection', m: 'JVM internals', q: 'Java 21, no GC flags, in a container limited to 1 CPU and 1 GB. Which collector is used?', o: ['G1', 'ZGC', 'Serial', 'Parallel'], a: 2, x: 'G1 is the default only on a “server-class machine”: at least 2 CPUs and about 1792 MB of memory. Below that, ergonomics choose <b>Serial</b>. Small pods often run Serial without anyone noticing; set the GC explicitly if it matters.' },
    { t: 'Garbage collection', s: 'garbage-collection', m: 'JVM internals', q: 'Objects A and B reference each other, and nothing else references either. What happens?', o: ['They leak forever: their reference counts never reach zero', 'They are collectable: tracing GC only keeps what is reachable from GC roots', 'Only one of them is collected', 'They are collected only by a full GC'], a: 1, x: 'HotSpot’s collectors <b>trace</b> from roots (thread stacks, statics, JNI handles…); unreachable cycles are garbage like anything else. Reference counting, which can’t free cycles, isn’t used for Java objects.' },
    { t: 'JIT compilation', s: 'jit-compilation', m: 'JVM internals', q: 'A hand-written benchmark loops 10⁹ times computing <code>Math.sqrt(i)</code> but never uses the result. It reports 0.3 ns per call. Most likely:', o: ['The CPU has a sqrt cache', 'C2 removed the unused computation (dead-code elimination), so you measured an empty loop', 'Math.sqrt is a constant', 'The timer is broken'], a: 1, x: 'After warm-up, C2 sees the result is unused and removes the work. JMH’s <code>Blackhole</code> (or returning the value) prevents this, along with forking, warm-up and constant-folding traps.' },
    { t: 'Memory leaks & OOM', s: 'leaks-oom', m: 'JVM internals', q: 'A request filter stores the user in a <code>ThreadLocal</code> and never calls <code>remove()</code>. On Tomcat’s thread pool, what happens?', o: ['Nothing; the value is freed when the request ends', 'The value stays attached to the pooled thread: a later request on that thread can see the previous user, and the object is retained', 'Tomcat clears ThreadLocals automatically', 'It throws IllegalStateException'], a: 1, x: 'Pool threads live forever, and so do their ThreadLocal values. That is both a <b>leak</b> and a <b>data-exposure bug</b>. Always <code>remove()</code> in a <code>finally</code>.' },
    { t: 'Memory leaks & OOM', s: 'leaks-oom', m: 'JVM internals', q: '<code>OutOfMemoryError: unable to create native thread</code>. What do you check first?', o: ['Increase -Xmx', 'The number of threads (a thread leak or an unbounded pool) and OS limits such as ulimit -u, cgroup pids.max, and memory for thread stacks', 'Metaspace size', 'The GC algorithm'], a: 1, x: 'Despite the name, it isn’t about heap. The OS refused a new thread. Typical causes: <code>newCachedThreadPool</code> under load, threads never shut down, or pids limits in the container. A thread dump shows who created them.' },
    // ---------- M3 · Concurrency ----------
    { t: 'Threads & executors', s: 'threads-executors', m: 'Concurrency', q: 'Core 1, max 2, a <code>SynchronousQueue</code>, three blocking tasks. Output?', run: true, expect: '2 1', code: `import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        CountDownLatch gate = new CountDownLatch(1);
        ThreadPoolExecutor ex = new ThreadPoolExecutor(1, 2, 1, TimeUnit.SECONDS, new SynchronousQueue<>());
        int rejected = 0;
        for (int i = 0; i < 3; i++) {
            try {
                ex.execute(() -> { try { gate.await(); } catch (InterruptedException e) { } });
            } catch (RejectedExecutionException e) {
                rejected++;
            }
        }
        System.out.println(ex.getPoolSize() + " " + rejected);
        gate.countDown();
        ex.shutdown();
    }
}`, o: ['1 2', '2 1', '3 0', '1 0'], a: 1, x: 'Task 1 starts the core thread. A <code>SynchronousQueue</code> has no capacity: <code>offer</code> succeeds only if a thread is waiting to take, and the only worker is busy, so task 2 starts a second thread (up to max). Task 3: offer fails and the pool is at max, so it is <b>rejected</b>. That is how <code>newCachedThreadPool</code> works, with max = ∞.' },
    { t: 'Threads & executors', s: 'threads-executors', m: 'Concurrency', q: '<code>new ThreadPoolExecutor(4, 64, 60, SECONDS, new LinkedBlockingQueue&lt;&gt;())</code> under a burst of 10,000 slow tasks. Peak thread count?', o: ['64', '4', '10,000', 'availableProcessors()'], a: 1, x: 'Threads above core are created only when the queue <b>refuses</b> a task. An unbounded <code>LinkedBlockingQueue</code> never does, so the pool stays at 4 and the backlog grows. Bound the queue if you want max to mean something.' },
    { t: 'Java Memory Model', s: 'java-memory-model', m: 'Concurrency', q: 'A worker loops <code>while (!stop) { count++; }</code> on a plain <code>boolean stop</code>. Another thread sets <code>stop = true</code>. Guaranteed outcome?', o: ['The worker stops within one iteration', 'Nothing is guaranteed: the JIT may hoist the read and the loop can run forever', 'An exception is thrown', 'The worker stops after the next GC'], a: 1, x: 'Without a happens-before edge (volatile, a lock, an atomic), the JIT may read <code>stop</code> once. This really happens after C2 compiles the loop. Make the flag <code>volatile</code>.' },
    { t: 'Java Memory Model', s: 'java-memory-model', m: 'Concurrency', q: 'An object with only <code>final</code> fields is published through a plain (non-volatile) field. A reader sees the reference as non-null. What is guaranteed?', o: ['Nothing', 'The final fields have their constructed values (if <code>this</code> didn’t escape during construction)', 'Only that the reference is non-null', 'The reader sees the newest reference'], a: 1, x: 'JLS §17.5 final-field semantics: readers that see the reference see the frozen final fields, even through a data race. They may still see a <i>stale</i> reference. Immutable objects are thread-safe; their publication may still need volatile for freshness.' },
    { t: 'Locks & synchronized', s: 'locks-synchronized', m: 'Concurrency', q: 'Reentrant monitors. Output?', run: true, expect: 'false true false', code: `public class Main {
    public static void main(String[] a) {
        Object lock = new Object();
        System.out.print(Thread.holdsLock(lock) + " ");
        synchronized (lock) {
            synchronized (lock) {
                System.out.print(Thread.holdsLock(lock) + " ");
            }
        }
        System.out.println(Thread.holdsLock(lock));
    }
}`, o: ['false true false', 'false true true', 'It deadlocks on the inner synchronized', 'true true false'], a: 0, x: 'Monitors are <b>reentrant</b>: the owner can enter again (the JVM keeps a recursion count). The monitor is released only when the outermost block exits, so afterwards <code>holdsLock</code> is false.' },
    { t: 'Locks & synchronized', s: 'locks-synchronized', m: 'Concurrency', q: 'Why is <code>if (queue.isEmpty()) wait();</code> wrong even with a single consumer and <code>notifyAll</code>?', o: ['wait() must be called outside synchronized', 'Spurious wake-ups are allowed, and the condition may change before the woken thread re-acquires the monitor; always re-check in a while loop', 'notifyAll only wakes one thread', 'It is correct with one consumer'], a: 1, x: '<code>wait()</code> may return without a notify (spurious wake-up), and after notify the thread still competes for the monitor. Only a <code>while (!condition) wait();</code> loop is correct.' },
    { t: 'CompletableFuture', s: 'completablefuture', m: 'Concurrency', q: 'Follow the chain. Output?', run: true, expect: '-2', code: `import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        CompletableFuture<Integer> f = CompletableFuture.supplyAsync(() -> 1)
                .thenApply(x -> x + 1)
                .thenCompose(x -> CompletableFuture.supplyAsync(() -> x * 10))
                .thenApply(x -> { if (x > 10) throw new IllegalArgumentException("too big"); return x; })
                .exceptionally(ex -> -1)
                .thenApply(x -> x * 2);
        System.out.println(f.join());
    }
}`, o: ['40', '-2', '-1', 'CompletionException: too big'], a: 1, x: '1 → 2 → 20 (the compose flattens the inner future) → the check throws → <code>exceptionally</code> replaces the failure with −1 → the next <code>thenApply</code> runs normally: <b>−2</b>. After recovery, the chain is back on the success path.' },
    { t: 'CompletableFuture', s: 'completablefuture', m: 'Concurrency', q: '<code>allOf</code> with one failed input. Output?', run: true, expect: 'boom\n1', code: `import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) {
        CompletableFuture<Integer> ok = CompletableFuture.completedFuture(1);
        CompletableFuture<Integer> bad = CompletableFuture.failedFuture(new IllegalStateException("boom"));
        try {
            CompletableFuture.allOf(ok, bad).join();
        } catch (CompletionException e) {
            System.out.println(e.getCause().getMessage());
        }
        System.out.println(ok.join());
    }
}`, o: ['1', 'boom, then 1', 'null, then 1', 'boom, then boom'], a: 1, x: '<code>allOf</code> completes exceptionally if any input does; <code>join()</code> throws a <code>CompletionException</code> whose cause is the original failure. The successful input is unaffected and can still be read.' },
    { t: 'Virtual threads (Java 21)', s: 'virtual-threads', m: 'Concurrency', q: 'What does this print on Java 21?', run: true, expect: 'in vt: true\nmain: false', code: `public class Main {
    public static void main(String[] a) throws Exception {
        Thread t = Thread.startVirtualThread(() ->
                System.out.println("in vt: " + Thread.currentThread().isVirtual()));
        t.join();
        System.out.println("main: " + Thread.currentThread().isVirtual());
    }
}`, o: ['in vt: true, main: true', 'in vt: true, main: false', 'main: false, in vt: true', 'in vt: false, main: false'], a: 1, x: '<code>Thread.startVirtualThread</code> (Java 21) runs the task on a new virtual thread; <code>join()</code> waits for it, which fixes the output order. The main thread is a platform thread. <code>currentThread()</code> returns the virtual thread, never its carrier.' },
    { t: 'Virtual threads (Java 21)', s: 'virtual-threads', m: 'Concurrency', q: 'Java 21, 8 carriers. Eight virtual threads each block on a 2 s HTTP call <b>inside</b> a <code>synchronized</code> block. Effect on other virtual threads?', o: ['None: they run on other carriers', 'All 8 carriers are pinned for 2 s, so no other virtual thread can run', 'The scheduler adds carriers to compensate', 'The HTTP calls fail with IllegalStateException'], a: 1, x: 'Blocking while holding a monitor pins the virtual thread to its carrier on Java 21–23, and the scheduler doesn’t compensate for pinning. Use <code>ReentrantLock</code> around blocking calls, or JDK 24+ (JEP 491).' },
    { t: 'Concurrency bugs', s: 'concurrency-bugs', m: 'Concurrency', q: 'Two threads, <code>merge</code> on a ConcurrentHashMap, joined. Output?', run: true, expect: '2000', code: `import java.util.*;
import java.util.concurrent.*;

public class Main {
    public static void main(String[] a) throws Exception {
        Map<String, Integer> m = new ConcurrentHashMap<>();
        Runnable r = () -> { for (int i = 0; i < 1000; i++) m.merge("k", 1, Integer::sum); };
        Thread t1 = new Thread(r), t2 = new Thread(r);
        t1.start(); t2.start();
        t1.join(); t2.join();
        System.out.println(m.get("k"));
    }
}`, o: ['2000', 'Between 1000 and 2000', '1000', 'Varies per run'], a: 0, x: '<code>merge</code> is an <b>atomic</b> read-modify-write per key on ConcurrentHashMap, so no increment is lost: always 2000. <code>m.put(k, m.get(k) + 1)</code> would race and lose updates.' },
    { t: 'Concurrency bugs', s: 'concurrency-bugs', m: 'Concurrency', q: 'A thread dump: “transfer-7 BLOCKED, waiting to lock &lt;…c48&gt;, locked &lt;…c10&gt;” and “transfer-3 BLOCKED, waiting to lock &lt;…c10&gt;, locked &lt;…c48&gt;”. Best fix?', o: ['Increase the thread pool', 'Acquire the two locks in a consistent global order (e.g. by account id)', 'Make the fields volatile', 'Use a fair lock'], a: 1, x: 'A two-thread <b>deadlock</b> cycle (HotSpot also prints “Found one Java-level deadlock”). Lock ordering removes circular wait; <code>tryLock(timeout)</code> is the alternative. More threads or fairness change nothing.' },
    // ---------- M4 · Modern Java & production ----------
    { t: 'Java 8 → 21 tour', s: 'java-versions', m: 'Modern Java & production', q: 'Text blocks (Java 15). Output?', run: true, expect: '6 2', code: `public class Main {
    public static void main(String[] a) {
        String tb = """
            a
              b
            """;
        System.out.println(tb.length() + " " + tb.lines().count());
    }
}`, o: ['6 2', '30 3', '5 2', '6 3'], a: 0, x: 'Incidental indentation is stripped, using the least-indented line, <b>including the closing delimiter</b>. The content is <code>"a\\n  b\\n"</code>: 6 characters, 2 lines. Moving the closing <code>"""</code> left would keep more indentation.' },
    { t: 'Java 8 → 21 tour', s: 'java-versions', m: 'Modern Java & production', q: 'A Java 8 app on Java 11 fails with <code>NoClassDefFoundError: javax/xml/bind/JAXBException</code>. Why?', o: ['JAXB moved to jakarta.* in Java 11', 'JEP 320 removed the Java EE modules (JAXB, JAX-WS, …) from the JDK in Java 11', 'Modules hide javax.* from the class path', 'JAXB requires --enable-preview'], a: 1, x: 'They were bundled through Java 8, deprecated for removal in 9 and <b>removed in 11</b>. Add them as normal dependencies. The <code>javax → jakarta</code> package rename is a separate Jakarta EE 9 change (Spring Boot 3).' },
    { t: 'Profiling & JFR', s: 'profiling-jfr', m: 'Modern Java & production', q: 'p99 latency doubled, CPU is flat, and the CPU flame graph looks unchanged. Which profile next?', o: ['A longer CPU profile', 'A wall-clock profile of request threads (or JFR park / monitor / socket events)', 'A heap dump', 'An allocation profile'], a: 1, x: 'CPU sampling only sees threads on a CPU. Latency hides in waiting (locks, pools, I/O), which wall-clock sampling and JFR’s blocking events capture.' },
    { t: 'Profiling & JFR', s: 'profiling-jfr', m: 'Modern Java & production', q: 'An old profiler shows 90% in a method that only calls a tight numeric loop in another (inlined) method. async-profiler shows the inner method at 78%. Why do they differ?', o: ['async-profiler is inaccurate', 'Safepoint bias: the old profiler could only sample at safepoints, which the counted loop lacks, so time was charged to the caller', 'The JIT was disabled in one run', 'GC pauses were counted'], a: 1, x: 'Safepoint-based samplers wait until a thread reaches a safepoint poll before recording its stack. async-profiler and JFR sample asynchronously; add <code>-XX:+DebugNonSafepoints</code> for precise inlined frames.' },
    { t: 'I/O & NIO', s: 'io-nio', m: 'Modern Java & production', q: 'Reading an int from bytes. Output?', run: true, expect: '256 0', code: `import java.nio.*;

public class Main {
    public static void main(String[] a) {
        ByteBuffer b = ByteBuffer.wrap(new byte[] {0, 0, 1, 0});
        System.out.println(b.getInt() + " " + b.remaining());
    }
}`, o: ['65536 0', '256 0', '1 0', '256 4'], a: 1, x: 'ByteBuffers are <b>big-endian</b> by default: 0x00000100 = 256. The relative <code>getInt()</code> advances position by 4, so nothing remains. With <code>order(LITTLE_ENDIAN)</code> the same bytes read as 65536.' },
    { t: 'I/O & NIO', s: 'io-nio', m: 'Modern Java & production', q: 'A Selector loop handles each key in <code>selectedKeys()</code> but never removes it. Symptom?', o: ['None', 'Handled keys stay selected, so the loop re-processes stale channels (often a busy loop of zero-byte reads)', 'select() throws ClosedSelectorException', 'Connections are dropped'], a: 1, x: '<code>select()</code> adds keys to the selected set but never removes them. Call <code>iterator.remove()</code> per key, or use Java 11’s <code>select(Consumer)</code>.' }
  ];
  /*Q-END*/
  const MODS = ['All', 'Language core', 'Collections', 'JVM internals', 'Concurrency', 'Modern Java & production'];
  if (!document.getElementById('w-tj-style')) {
    document.head.append(el('style', { id: 'w-tj-style', text: `
.w-tj-bar { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; margin: 8px 0; }
.w-tj-bar div { height: 100%; background: var(--accent); }
.w-tj-bar div.low { background: var(--err); }
.w-tj-opts { display: grid; gap: 6px; margin-top: 10px; }
.w-tj-opts button { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 9px; padding: 9px 12px; font-size: 14px; cursor: pointer; overflow-wrap: anywhere; }
.w-tj-opts button:hover:not(:disabled) { border-color: var(--accent); }
.w-tj-opts button.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 15%, transparent); }
.w-tj-opts button.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 15%, transparent); }
.w-tj-opts button:disabled { cursor: default; }
.w-tj-q { font-size: 16px; margin: 6px 0 8px; }
.w-tj-rev { border-top: 1px solid var(--border); padding: 10px 0; }
.w-tj-rev:first-child { border-top: 0; }
.w-tj-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 6px; margin-top: 6px; }
.w-tj-grid a, .w-tj-grid span { font-size: 12.5px; border: 1px solid var(--border); border-radius: 8px; padding: 5px 9px; background: var(--surface-2); color: var(--text-2); text-decoration: none; display: flex; justify-content: space-between; gap: 8px; }
.w-tj-grid a:hover { border-color: var(--accent); color: var(--accent); }
.w-tj-grid b { font-family: var(--mono); color: var(--text); }
.w-tj-grid .low b { color: var(--err); }
` }));
  }
  let mod = 'All'; let count = 10; let secs = 60; let gen = 0; let deck = []; let i = 0; let score = 0; let misses = []; let left = 0; let answered = false; let started = false; let tick = null;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segT = seg(MODS.map((t) => [t, t === 'All' ? `All (${Q.length})` : `${t} (${Q.filter((q) => q.m === t).length})`]), () => mod, (v) => { mod = v; reset(); }, 'Module');
  const segN = seg([[10, '10 questions'], [25, '25'], [Q.length, `all ${Q.length}`]], () => count, (v) => { count = v; reset(); }, 'Number of questions');
  const segS = seg([[90, 'Slow · 90 s'], [60, 'Normal · 60 s'], [30, 'Fast · 30 s']], () => secs, (v) => { secs = v; reset(); }, 'Time per question');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Start' }); const bStep = el('button', { class: 'btn', text: 'Skip ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const card = el('div', { class: 'card', style: { padding: '14px', marginTop: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segT), el('div', { class: 'w-controls' }, segN, el('span', { class: 'tiny', text: 'time per question' }), segS),
    el('div', { class: 'w-controls' }, bPlay, bStep, bReset), stats, card, narr);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const esc = ctx.esc;
  function shuffle(a) { const r = a.slice(); for (let j = r.length - 1; j > 0; j--) { const m = Math.floor(Math.random() * (j + 1)); [r[j], r[m]] = [r[m], r[j]]; } return r; }
  function renderStats() { stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `question <b>${Math.min(i + 1, deck.length)}</b>/${deck.length}` }), el('span', { class: 'w-stat', html: `score <b>${score}</b>` }), el('span', { class: 'w-stat', html: `missed <b>${misses.length}</b>` }), el('span', { class: 'w-stat', html: `time <b>${started && !answered ? left + ' s' : '–'}</b>` })); }
  function stopTimer() { if (tick) { clearInterval(tick); tick = null; } }
  const topicLink = (q) => `<a href="${q.s}.html">${esc(q.t)}</a>`;
  function show() {
    const q = deck[i]; answered = false; left = secs; card.innerHTML = '';
    const bar = el('div'); const barWrap = el('div', { class: 'w-tj-bar' }, bar);
    const opts = el('div', { class: 'w-tj-opts' });
    card.append(el('div', { class: 'w-controls', style: { marginBottom: '0' } }, el('span', { class: 'pill accent', text: q.t }), el('span', { class: 'pill', text: q.m }), q.run ? el('span', { class: 'pill', text: 'runs on JDK 21' }) : null, el('span', { class: 'tiny', text: `#${i + 1}` })), barWrap, el('div', { class: 'w-tj-q', html: q.q }));
    if (q.code) card.append(ctx.codeBox(q.code, 'java'));
    q.o.forEach((o, j) => { const b = el('button', { html: `<b>${'ABCD'[j]}.</b> ${esc(o)}` }); b.addEventListener('click', () => answer(j)); opts.append(b); });
    card.append(opts);
    const paint = () => { bar.style.width = (left / secs) * 100 + '%'; bar.className = left <= 10 ? 'low' : ''; if (!reduced) bar.style.transition = 'width 1s linear'; };
    paint(); renderStats(); say('Pick an answer before the bar runs out. Skip counts as a miss.');
    stopTimer(); const g = gen;
    tick = setInterval(() => { if (g !== gen || answered) { stopTimer(); return; } left--; paint(); renderStats(); if (left <= 0) answer(-1); }, 1000);
    card.opts = opts;
  }
  function answer(j) {
    if (answered || !started) return; answered = true; stopTimer();
    const q = deck[i]; const ok = j === q.a;
    if (ok) score++; else misses.push({ q, j });
    [...card.opts.children].forEach((b, m) => { b.disabled = true; if (m === q.a) b.classList.add('ok'); else if (m === j) b.classList.add('bad'); });
    card.append(el('div', { class: 'pz-exp', html: (j === -1 ? '<b>Time’s up.</b> ' : j === -2 ? '<b>Skipped.</b> ' : ok ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.x + (q.run ? `<div class="tiny" style="margin-top:6px">Exact output on JDK 21: <code>${esc(q.expect).replace(/\n/g, ' ⏎ ')}</code></div>` : '') + `<div class="tiny" style="margin-top:6px">Topic: ${topicLink(q)}</div>` }));
    bStep.textContent = i + 1 < deck.length ? 'Next ›' : 'Finish ›'; renderStats();
    say(ok ? 'Correct. Press Next.' : 'Read the explanation, then press Next.');
  }
  function next() {
    if (!started) return;
    if (!answered) { answer(-2); return; }
    i++; bStep.textContent = 'Skip ›';
    if (i >= deck.length) return finish();
    show();
  }
  function finish() {
    started = false; stopTimer(); bStep.disabled = true; bPlay.textContent = '▶ Again'; card.innerHTML = '';
    const by = {}; deck.forEach((q) => { by[q.s] = by[q.s] || { q, ok: 0, n: 0 }; by[q.s].n++; if (!misses.some((m) => m.q === q)) by[q.s].ok++; });
    const pct = deck.length ? Math.round(score / deck.length * 100) : 0;
    card.append(el('h3', { text: `Score: ${score} / ${deck.length} (${pct}%)`, style: { margin: '0 0 8px' } }));
    const mods = {}; deck.forEach((q) => { mods[q.m] = mods[q.m] || [0, 0]; mods[q.m][1]++; if (!misses.some((m) => m.q === q)) mods[q.m][0]++; });
    card.append(el('div', { class: 'w-stats' }, Object.entries(mods).map(([t, [a, n]]) => el('span', { class: 'w-stat', html: `${esc(t)} <b>${a}/${n}</b>` }))));
    card.append(el('h4', { text: 'Per topic', style: { margin: '14px 0 2px' } }));
    card.append(el('div', { class: 'w-tj-grid' }, Object.values(by).sort((x, y) => (x.ok / x.n) - (y.ok / y.n)).map(({ q, ok, n }) => el('a', { href: `${q.s}.html`, class: ok < n ? 'low' : '', html: `<span style="border:0;padding:0;background:none">${esc(q.t)}</span><b>${ok}/${n}</b>` }))));
    if (misses.length) {
      card.append(el('h4', { text: 'Review your misses', style: { margin: '14px 0 4px' } }));
      misses.forEach(({ q, j }) => { const r = el('div', { class: 'w-tj-rev' }, el('div', { html: `<span class="pill">${esc(q.t)}</span> ${q.q}` }));
        if (q.code) r.append(ctx.codeBox(q.code, 'java'));
        r.append(el('div', { class: 'tiny', html: `You: ${j < 0 ? (j === -1 ? 'time ran out' : 'skipped') : esc(q.o[j])} · Correct: <b>${esc(q.o[q.a])}</b>` }), el('div', { class: 'pz-exp', html: q.x + `<div class="tiny" style="margin-top:6px">Revisit: ${topicLink(q)}</div>` }));
        card.append(r); });
    } else card.append(el('p', { text: `No misses. Try all ${Q.length} on Fast.` }));
    renderStats(); say(`Done: ${score}/${deck.length}. ` + (misses.length ? 'Weakest topics are listed first; your misses are below with links back to each topic.' : ''));
  }
  function reset() {
    gen++; stopTimer(); started = false; answered = false; i = 0; score = 0; misses = [];
    const pool = Q.filter((q) => mod === 'All' || q.m === mod); deck = shuffle(pool).slice(0, count);
    bPlay.textContent = '▶ Start'; bStep.textContent = 'Skip ›'; bStep.disabled = true; card.innerHTML = '';
    const nRun = deck.filter((q) => q.run).length;
    card.append(el('p', { html: `<b>${deck.length}</b> question${deck.length === 1 ? '' : 's'} (${mod === 'All' ? 'whole Java track' : esc(mod)}), <b>${secs} s</b> each; ${nRun} are complete programs whose output is fixed on JDK 21. Predict in your head, as in an interview.`, style: { margin: 0 } }));
    renderStats(); say('Choose a module, how many questions and the time limit, then press Start.');
  }
  bPlay.addEventListener('click', () => { reset(); started = true; bStep.disabled = false; bPlay.textContent = '↻ Restart'; show(); });
  bStep.addEventListener('click', next);
  bReset.addEventListener('click', reset);
  reset();
});

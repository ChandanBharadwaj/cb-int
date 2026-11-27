IA.register({
  track: 'java',
  slug: 'generics-erasure',
  title: 'Generics & type erasure',
  tagline: 'Java generics exist only at <b>compile time</b>. At runtime the JVM sees plain <code>Object</code>. The compiler checks your types, then deletes them, adds casts and writes helper methods. Almost every generics surprise follows from that, from a stray <code>ClassCastException</code> to “name clash”.',
  tldr: {
    problem: 'A <code>ClassCastException</code> appears in code that does no casting. A JSON client returns a list of <code>LinkedHashMap</code> where you asked for orders. An API won’t accept a <code>List&lt;Integer&gt;</code> where a <code>List&lt;Number&gt;</code> is expected. All three come from erased types and strict type matching.',
    model: 'The compiler checks the types. Then it replaces them with their bound, usually Object (<b>erasure</b>). It <b>adds casts</b> where generic values are used. It adds <b>bridge methods</b> so overriding still works. Skip the checks (raw types, unchecked casts) and the error shows up later, at one of those casts.',
    hook: '“What is PECS?” <b>Producer extends, consumer super.</b> Read from <code>? extends T</code>, write into <code>? super T</code>. That is why <code>Collections.copy</code> is declared as <code>(List&lt;? super T&gt; dest, List&lt;? extends T&gt; src)</code>.',
    facts: [
      { v: 'Java 5', l: 'introduced generics (2004). Erasure let new generic code work with old non-generic libraries' },
      { v: '1 class', l: '<code>ArrayList&lt;String&gt;</code> and <code>ArrayList&lt;Integer&gt;</code> share one <code>Class</code> object. Generic <i>signatures</i> stay in the class file and are readable by reflection' },
      { v: '@SafeVarargs', l: '(Java 7; on private methods since Java 9) promises a generic varargs method doesn’t misuse its array. It silences the warning' }
    ]
  },
  intro: {
    what: '<b>Generics</b> let one class or method work with many types, still checked by the compiler. <code>List&lt;String&gt;</code> accepts only Strings, and <code>get</code> returns a String with no cast. The compiler checks the type arguments, then removes them (<b>type erasure</b>). At runtime every list is a list of objects.',
    analogy: { icon: '🏷️', title: 'Labels on moving boxes', text: 'The packer (the compiler) checks that only kitchen items go into the “Kitchen” box. The truck (the JVM) can’t read labels; it carries boxes. Someone sneaks a shoe in by a side door (a raw type). Nobody notices until the unpacker reaches for a plate and pulls out the shoe.' },
    steps: [
      { t: 'Type parameters', d: 'A generic class declares a placeholder that callers fill in.', code: 'class Box<T> {\n  private T value;\n  T get() { return value; }\n  void set(T v) { value = v; }\n}\nBox<String> b = new Box<>();   // T = String' },
      { t: 'The compiler checks, then erases', d: 'After checking, <code>T</code> becomes <code>Object</code> (or its bound) in the bytecode, and a cast is inserted at <code>String s = b.get()</code>.' },
      { t: 'Generic types are invariant', d: 'A <code>List&lt;Integer&gt;</code> is <b>not</b> a <code>List&lt;Number&gt;</code>. If it were, you could add a Double to a list of Integers.' },
      { t: 'Wildcards add flexibility', d: '<code>List&lt;? extends Number&gt;</code> accepts a list of any Number subtype for reading. <code>List&lt;? super Integer&gt;</code> accepts a list that can receive Integers.' },
      { t: 'Don’t switch the checks off', d: 'Raw types (<code>List</code> without <code>&lt;…&gt;</code>) and <code>@SuppressWarnings("unchecked")</code> disable the compiler’s protection.' }
    ],
    terms: [
      ['type parameter / argument', '<code>T</code> in <code>class Box&lt;T&gt;</code> / <code>String</code> in <code>Box&lt;String&gt;</code>.'],
      ['erasure', 'Replacing type parameters with their bounds in the bytecode, and adding casts.'],
      ['raw type', 'A generic type used without type arguments, like <code>List</code>. It exists for old pre-Java-5 code.'],
      ['wildcard', '<code>?</code>, <code>? extends T</code> (upper bound) or <code>? super T</code> (lower bound).'],
      ['heap pollution', 'A variable says <code>List&lt;String&gt;</code>, but the object holds something else.'],
      ['bridge method', 'A hidden method the compiler adds so a generic override still overrides after erasure.']
    ]
  },
  visual: {
    title: 'What javac checks vs what the JVM runs',
    caption: 'Pick a scenario and press <b>Play</b>. The left column is the source as the compiler checks it; the right is the erased program the JVM executes. Watch where the casts and bridge methods appear, and where a polluted list finally blows up.'
  },
  gotchas: [
    { trap: 'Raw types silently disable checking', code: `List<String> names = loadNames();
List raw = names;           // warning: raw type
raw.add(42);                // warning: unchecked — but compiles and runs
String first = names.get(0);   // ClassCastException, far from the bug`, why: 'A raw type turns off generic checks for all its methods. Even unrelated ones lose their types: <code>rawList.stream()</code> returns a raw <code>Stream</code>.', fix: 'Never use raw types except in class literals (<code>List.class</code>) and <code>instanceof</code>. Use <code>List&lt;?&gt;</code> for “a list of unknown type”. Compile with <code>-Xlint:all -Werror</code>.' },
    { trap: 'Unchecked casts that never check', code: `@SuppressWarnings("unchecked")
<T> T attr(String key) { return (T) attrs.get(key); }   // no runtime check here

Long id = attr("id");      // CCE here if the value is an Integer`, why: 'A cast to <code>T</code> becomes a cast to Object, so it can’t fail inside the method. The real check is the cast added at the caller, wherever that is.', fix: 'Pass a <code>Class&lt;T&gt;</code> and use <code>type.cast(value)</code>, which checks at runtime. Or return <code>Object</code> and make callers check with <code>instanceof</code> patterns.' },
    { trap: '<code>List&lt;Integer&gt;</code> is not a <code>List&lt;Number&gt;</code>', code: `double sum(List<Number> xs) { … }
sum(List.of(1, 2, 3));        // compile error: List<Integer> is not List<Number>

double sum(List<? extends Number> xs) { … }   // accepts List<Integer>, List<Double>…`, why: 'Generics are <b>invariant</b>. If <code>List&lt;Integer&gt;</code> were a <code>List&lt;Number&gt;</code>, the method could add a Double to it.', fix: 'Use wildcards in <b>parameters</b> by PECS. Don’t use wildcards in return types; they push the complexity onto every caller.' },
    { trap: 'Arrays are covariant and checked at runtime', code: `Object[] objs = new String[1];
objs[0] = 42;                  // ArrayStoreException at runtime
List<Object> l = new ArrayList<String>();   // compile error: generics catch it`, why: 'Arrays know their element type at runtime and check every store. Generics are erased, so the compiler must catch the mistake. That is why <code>new T[]</code> and <code>new List&lt;String&gt;[10]</code> are illegal.', fix: 'Prefer <code>List&lt;T&gt;</code> to <code>T[]</code> in generic code. If you must have an array, take a <code>Class&lt;T&gt;</code> or an <code>IntFunction&lt;T[]&gt;</code> (like <code>toArray(String[]::new)</code>).' },
    { trap: 'Overloads that differ only in type arguments', code: `void save(List<Order> orders) { }
void save(List<Refund> refunds) { }    // error: name clash, both erase to save(List)`, why: 'After erasure both methods have the same signature, and a class file can’t hold two methods with the same name and descriptor.', fix: 'Give them different names (<code>saveOrders</code>, <code>saveRefunds</code>) or wrap the argument types.' },
    { trap: 'Generic varargs pollute the heap', code: `@SafeVarargs                                // a lie in this case
static <T> T[] toArray(T... xs) { return xs; }    // returns an Object[] when T is generic
static <T> T[] pair(T a, T b) { return toArray(a, b); }
String[] s = pair("a", "b");                       // ClassCastException: Object[] → String[]`, why: 'Varargs builds an array of the erased type. Returning or writing into it breaks type safety. <code>@SafeVarargs</code> is a promise: only read from the array.', fix: 'Annotate only methods that just read the varargs array (like <code>List.of</code> and <code>Arrays.asList</code>). Never return or store it.' },
    { trap: 'Losing the type when deserialising', code: `List<Order> orders = mapper.readValue(json, List.class);   // List<LinkedHashMap>
orders.get(0).total();                                      // ClassCastException`, why: '<code>List.class</code> carries no element type, because there is no <code>List&lt;Order&gt;.class</code>. Jackson falls back to maps.', fix: 'Capture the full type with a super-type token: <code>new TypeReference&lt;List&lt;Order&gt;&gt;() {}</code> (Jackson) or <code>ParameterizedTypeReference</code> (Spring).' }
  ],
  scenarios: [
    { title: 'Order sync crashed with “LinkedHashMap cannot be cast to Order”',
      symptom: 'A nightly job threw <code>ClassCastException: class java.util.LinkedHashMap cannot be cast to class com.acme.Order</code> from inside a for-loop. The client call above it “returned a List&lt;Order&gt;”.',
      diagnose: `List<Order> orders = restTemplate.getForObject(url, List.class);   // unchecked
for (Order o : orders) {        // CCE: the inserted cast fails here
  sync(o);
}`,
      cause: '<code>List.class</code> can’t say what the elements are. So the JSON array became a list of maps. That list went into a <code>List&lt;Order&gt;</code> variable. The cast added in the loop was the first place to notice.',
      fix: 'Pass the full generic type with a super-type token. The anonymous subclass records <code>List&lt;Order&gt;</code> in its class file, where reflection can read it.',
      fixCode: `// Spring Boot 3.2+ RestClient
List<Order> orders = restClient.get().uri(url).retrieve()
    .body(new ParameterizedTypeReference<List<Order>>() {});

// Jackson directly
List<Order> orders = mapper.readValue(json, new TypeReference<List<Order>>() {});` },
    { title: 'Payment id lookup failed for new merchants only',
      symptom: '<code>ClassCastException: Integer cannot be cast to Long</code> in the payment service, only for merchants onboarded after a schema change. Old merchants worked.',
      diagnose: `Map<String, Object> meta = mapper.readValue(json, new TypeReference<>() {});

@SuppressWarnings("unchecked")
static <T> T get(Map<String, Object> m, String k) { return (T) m.get(k); }   // never fails here

Long merchantId = get(meta, "merchantId");   // fails: Jackson made it an Integer`,
      cause: 'Jackson maps JSON numbers that fit in an int to <code>Integer</code>, and larger ones to <code>Long</code>. New merchant ids were small. The generic helper’s cast was erased to Object and checked nothing; the inserted <code>Long</code> cast at the caller failed.',
      fix: 'Convert explicitly instead of casting, or bind the JSON to a typed record so Jackson does the conversion.',
      fixCode: `long merchantId = ((Number) meta.get("merchantId")).longValue();

// better: a typed DTO
record Meta(long merchantId, String region) {}
Meta meta = mapper.readValue(json, Meta.class);` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<String> a = new ArrayList<>();
        List<Integer> b = new ArrayList<>();
        System.out.println(a.getClass() == b.getClass());
        System.out.println(a.getClass().getName());
    }
}`, options: ['false / java.util.ArrayList&lt;String&gt;', 'true / java.util.ArrayList', 'Compile error: incomparable types', 'false / java.util.ArrayList'], answer: 1, explain: 'Erasure leaves one runtime class. Comparing <code>Class&lt;? extends List&gt;</code> objects compiles fine. Prints <b>true</b> and <b>java.util.ArrayList</b>.', run: true, expect: 'true\njava.util.ArrayList' },
    { kind: 'predict', q: 'Heap pollution: what does this print?', code: `import java.util.*;

public class Main {
    @SuppressWarnings({"rawtypes", "unchecked"})
    public static void main(String[] args) {
        List<String> names = new ArrayList<>();
        List raw = names;
        raw.add(42);
        System.out.println("size " + names.size());
        try {
            String s = names.get(0);
            System.out.println(s);
        } catch (ClassCastException e) {
            System.out.println("CCE");
        }
    }
}`, options: ['ClassCastException at raw.add(42)', 'size 1 / CCE', 'size 1 / 42', 'size 0 / CCE'], answer: 1, explain: 'The raw <code>add</code> stores an Integer without any check. <code>size()</code> doesn’t care. The cast javac inserted for <code>String s = names.get(0)</code> fails. Prints <b>size 1</b> then <b>CCE</b>.', run: true, expect: 'size 1\nCCE' },
    { kind: 'predict', q: 'Where does the cast fail?', code: `public class Main {
    @SuppressWarnings("unchecked")
    static <T> T cast(Object o) {
        System.out.println("cast ok");
        return (T) o;
    }

    public static void main(String[] args) {
        try {
            String s = cast(42);
            System.out.println(s.length());
        } catch (ClassCastException e) {
            System.out.println("CCE at call site");
        }
    }
}`, options: ['CCE inside cast(), so “cast ok” is never printed', 'cast ok / CCE at call site', 'cast ok / 2', 'Compile error: cannot infer T'], answer: 1, explain: '<code>(T) o</code> erases to a cast to Object, which can’t fail. T is inferred as String from the assignment, so javac inserts <code>checkcast String</code> at the call site, and that is what throws. Prints <b>cast ok</b> then <b>CCE at call site</b>.', run: true, expect: 'cast ok\nCCE at call site' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        Object[] objs = new String[2];
        objs[0] = "ok";
        try {
            objs[1] = 42;
        } catch (ArrayStoreException e) {
            System.out.println("ASE");
        }
        System.out.println(objs[0]);
    }
}`, options: ['Compile error', 'ASE / ok', 'ok', 'ClassCastException'], answer: 1, explain: 'Arrays are covariant, so <code>String[]</code> is an <code>Object[]</code> and the assignment compiles. But arrays are reified: every store is checked at runtime and throws <code>ArrayStoreException</code>. Prints <b>ASE</b> then <b>ok</b>. Generics chose the opposite trade-off: invariant types and compile-time checks.', run: true, expect: 'ASE\nok' },
    { kind: 'predict', q: 'How many methods does Name declare, and how many are bridges?', code: `import java.lang.reflect.*;
import java.util.*;

public class Main {
    static class Name implements Comparable<Name> {
        public int compareTo(Name o) { return 0; }
    }

    public static void main(String[] args) {
        Method[] ms = Name.class.getDeclaredMethods();
        long bridges = Arrays.stream(ms).filter(Method::isBridge).count();
        System.out.println(ms.length + " " + bridges);
    }
}`, options: ['1 0', '2 1', '2 0', '1 1'], answer: 1, explain: 'Your <code>compareTo(Name)</code> plus a synthetic bridge <code>compareTo(Object)</code> that casts and delegates, so that the erased interface method is really overridden. Prints <b>2 1</b>.', run: true, expect: '2 1' },
    { kind: 'concept', q: 'Does this class compile?', code: `import java.util.*;

class Repo {
    void save(List<String> names) { }
    void save(List<Integer> ids) { }
}`, options: ['Yes, overload resolution uses the type argument', 'No: name clash, both methods have the same erasure', 'Yes, but calls are ambiguous at runtime', 'Only with <code>@SafeVarargs</code>'], answer: 1, explain: 'Both erase to <code>save(List)</code>. A class can’t have two methods with the same erased signature, so javac reports “name clash: … have the same erasure”.' },
    { kind: 'concept', q: 'Given <code>static double sum(List&lt;? extends Number&gt; xs)</code>, which call does <b>not</b> compile?', options: ['<code>sum(List.of(1, 2))</code>', '<code>sum(new ArrayList&lt;Double&gt;())</code>', '<code>sum(new ArrayList&lt;Object&gt;())</code>', '<code>sum(List.&lt;Number&gt;of(1, 2.5))</code>'], answer: 2, explain: '<code>? extends Number</code> accepts lists of Number or any subtype. Object is a supertype of Number, so a <code>List&lt;Object&gt;</code> is rejected. It could contain Strings, and <code>sum</code> reads Numbers from it.' },
    { kind: 'concept', q: 'Inside <code>void m(List&lt;? extends Number&gt; xs)</code>, which line does <b>not</b> compile?', options: ['<code>Number n = xs.get(0);</code>', '<code>xs.add(null);</code>', '<code>xs.add(1);</code>', '<code>Object o = xs.get(0);</code>'], answer: 2, explain: 'The caller might have passed a <code>List&lt;Double&gt;</code>, so the compiler won’t let you add an Integer, or anything except <code>null</code>. Reading as Number (or Object) is always safe. That is the “producer extends” half of PECS.' }
  ],
  interview: [
    { q: 'What is type erasure, and why did Java choose it?', a: '<p>The compiler checks generic types, then removes them: type parameters become their leftmost bound (Object if unbounded), casts are inserted where generic values are used, and bridge methods are generated. It was chosen for <b>migration compatibility</b>: generic code in Java 5 had to work with existing non-generic class files, and old code had to be able to use the newly generified collections.</p>', fu: 'What survives erasure? Generic <i>signatures</i> of classes, fields and methods (the <code>Signature</code> attribute), readable via <code>getGenericType</code> and <code>getGenericSuperclass</code>. Type arguments of local variables and object instances don’t survive.', lvl: 'core' },
    { q: 'What does a type parameter erase to?', a: '<p>Its leftmost bound. <code>&lt;T&gt;</code> becomes Object, and <code>&lt;T extends Comparable&lt;T&gt;&gt;</code> becomes Comparable. That is why <code>Collections.max</code> is declared as <code>&lt;T extends Object &amp; Comparable&lt;? super T&gt;&gt;</code>: the leading <code>Object</code> keeps the erased return type Object, so the method stayed binary-compatible with the pre-generics version.</p>', lvl: 'deep' },
    { q: 'What is a bridge method, and when is one generated?', a: '<p>A synthetic method that makes overriding survive erasure. If <code>Name implements Comparable&lt;Name&gt;</code>, your <code>compareTo(Name)</code> doesn’t match the erased interface method <code>compareTo(Object)</code>, so javac emits <code>compareTo(Object o) { return compareTo((Name) o); }</code>. Bridges are also generated for covariant return types. They show up in <code>javap -p</code>, in reflection (<code>isBridge()</code>), and as the source of a ClassCastException when you call them through a raw type.</p>', lvl: 'deep' },
    { q: 'Explain PECS with a real JDK signature.', a: '<p><code>Collections.copy(List&lt;? super T&gt; dest, List&lt;? extends T&gt; src)</code>: <code>src</code> produces Ts (extends), and <code>dest</code> consumes Ts (super). Others are <code>List.sort(Comparator&lt;? super E&gt;)</code>, because a comparator of Objects can sort Strings, and <code>addAll(Collection&lt;? extends E&gt;)</code>. If a parameter both produces and consumes, use plain <code>T</code>.</p>', lvl: 'core' },
    { q: 'Why is <code>List&lt;String&gt;</code> not a subtype of <code>List&lt;Object&gt;</code> when <code>String[]</code> is a subtype of <code>Object[]</code>?', a: '<p>If the list were a subtype, you could add an Integer to a list of Strings through the <code>List&lt;Object&gt;</code> reference, and erased generics could never detect it. Arrays are covariant, but they carry their element type at runtime and check each store (<code>ArrayStoreException</code>). Generics give up covariance to get compile-time safety, and wildcards restore controlled variance.</p>', lvl: 'core' },
    { q: 'What is heap pollution? How does it happen, and how do you prevent it?', a: '<p>A variable of a parameterised type refers to an object that isn’t of that type, such as a <code>List&lt;String&gt;</code> that contains an Integer. Sources: raw types, unchecked casts, generic varargs arrays and unchecked reflection. The failure appears later, at an inserted cast. Prevention: no raw types, no suppressed warnings without proof, <code>@SafeVarargs</code> only on methods that just read the array, and <code>Collections.checkedList</code> to find the guilty write while debugging.</p>', lvl: 'deep' },
    { q: 'Raw type vs <code>List&lt;?&gt;</code> vs <code>List&lt;Object&gt;</code>?', a: '<ul><li><code>List</code> (raw): no checking at all, and you can add anything. Legacy only.</li><li><code>List&lt;?&gt;</code>: a list of some unknown type. It is type-safe: you can read Objects but add only null. Any <code>List&lt;X&gt;</code> is assignable to it.</li><li><code>List&lt;Object&gt;</code>: a list that can hold anything. A <code>List&lt;String&gt;</code> is <b>not</b> assignable to it.</li></ul>', lvl: 'core' },
    { q: 'If types are erased, how do Jackson and Spring know it is a <code>List&lt;Order&gt;</code>?', a: '<p>Through a <b>super-type token</b>: <code>new TypeReference&lt;List&lt;Order&gt;&gt;() {}</code> creates an anonymous subclass, and its generic superclass, <code>TypeReference&lt;List&lt;Order&gt;&gt;</code>, is recorded in the class file. <code>getClass().getGenericSuperclass()</code> returns a <code>ParameterizedType</code> with the full argument. Spring’s <code>ResolvableType</code> also reads generic signatures of fields, method parameters and bean classes, which is how it injects a <code>Repository&lt;Order&gt;</code> by generic type.</p>', lvl: 'deep' },
    { q: 'How do you create a generic array, or a new T?', a: '<p>You can’t write <code>new T()</code> or <code>new T[n]</code>, because T is unknown at runtime. Options: take a <code>Supplier&lt;T&gt;</code> or <code>Class&lt;T&gt;</code> (<code>type.getDeclaredConstructor().newInstance()</code>, <code>Array.newInstance(type, n)</code>), take an <code>IntFunction&lt;T[]&gt;</code> like <code>Collection.toArray(String[]::new)</code> (Java 11), or use <code>List&lt;T&gt;</code> instead. <code>(T[]) new Object[n]</code> works only while the array never escapes as a T[]. That is what ArrayList does internally.</p>', lvl: 'deep' },
    { q: 'What is wildcard capture, and why do you sometimes need a helper method?', a: '<p>Each <code>?</code> stands for one specific unknown type. You can’t <code>set</code> into a <code>List&lt;?&gt;</code> even with an element you just read from it, because the compiler can’t prove the two unknowns are the same. A private generic helper <code>&lt;T&gt; void swapHelper(List&lt;T&gt; l, int i, int j)</code> called from <code>swap(List&lt;?&gt; l, …)</code> lets the compiler “capture” the wildcard as a named T.</p>', lvl: 'deep' },
    { q: 'What does <code>&lt;T extends Comparable&lt;? super T&gt;&gt;</code> mean?', a: '<p>T must be comparable to itself <i>or to one of its supertypes</i>. Without <code>? super</code>, a <code>java.sql.Timestamp</code>, which is a <code>Comparable&lt;Date&gt;</code> through its superclass, could not be used. The same recursive pattern appears in <code>Enum&lt;E extends Enum&lt;E&gt;&gt;</code> and in self-typed builders.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Keeping generic types for HTTP and JSON', lang: 'java', code: `// Spring Boot 3.2+ RestClient
List<Order> orders = restClient.get()
    .uri("/orders?since={d}", since)
    .retrieve()
    .body(new ParameterizedTypeReference<List<Order>>() {});

// Jackson
Map<String, List<Order>> byCustomer =
    mapper.readValue(json, new TypeReference<Map<String, List<Order>>>() {});

// Reusable: build the type programmatically
JavaType t = mapper.getTypeFactory().constructCollectionType(List.class, Order.class);
List<Order> again = mapper.readValue(json, t);`, note: 'The empty <code>{}</code> matters: it creates an anonymous subclass whose superclass signature records the full generic type.' },
    { title: 'Type-safe heterogeneous container', lang: 'java', code: `public final class Attributes {
    private final Map<Class<?>, Object> values = new HashMap<>();

    public <T> void put(Class<T> type, T value) {
        values.put(Objects.requireNonNull(type), type.cast(value));   // checked on the way in
    }

    public <T> Optional<T> get(Class<T> type) {
        return Optional.ofNullable(type.cast(values.get(type)));      // checked on the way out
    }
}

attrs.put(TenantId.class, new TenantId("acme"));
TenantId t = attrs.get(TenantId.class).orElseThrow();   // no unchecked casts anywhere`, note: '<code>Class.cast</code> is a real runtime check, unlike <code>(T) obj</code>.' },
    { title: 'PECS in API design', lang: 'java', code: `public interface EventBus {
    // a handler that accepts any supertype of E can receive E
    <E extends Event> void subscribe(Class<E> type, Consumer<? super E> handler);
}

public static <T extends Comparable<? super T>> T max(Collection<? extends T> items) {
    Iterator<? extends T> it = items.iterator();
    T best = it.next();
    while (it.hasNext()) {
        T next = it.next();
        if (next.compareTo(best) > 0) best = next;
    }
    return best;            // return a concrete T, never a wildcard type
}

bus.subscribe(OrderPlaced.class, (Event e) -> audit.log(e));   // Consumer<Event> accepted` }
  ]
});

IA.register({
  track: 'java',
  slug: 'equals-hashcode',
  title: 'equals & hashCode contract',
  tagline: 'A HashMap finds a key in two moves: <b>hashCode</b> picks the bucket, then <b>equals</b> picks the entry. Break the link between the two, or change a key after inserting it, and entries become invisible but are never removed.',
  tldr: {
    problem: 'Lookups return <code>null</code> for keys that are “obviously” there, Sets hold duplicates, caches grow forever, and a TreeSet silently drops records. The code compiles and usually passes the tests.',
    model: '<code>hashCode</code> is a fast, lossy fingerprint that routes to a bucket. <code>equals</code> is the real identity check inside the bucket. Rule: <b>equal ⇒ same hash</b>, and neither may change while the object is a key.',
    hook: '“What happens if you override equals but not hashCode?” Two equal keys get different identity hashes, so they land in different buckets and <code>equals</code> is never even called.',
    facts: [
      { v: 'equal ⇒ equal hash', l: 'the one-way rule in <code>Object.hashCode</code>’s contract. Unequal objects may collide, and HashMap must still work correctly when they do' },
      { v: '2112', l: 'is both <code>"Aa".hashCode()</code> and <code>"BB".hashCode()</code>. String collisions are easy to make on purpose' },
      { v: '8 / 64', l: 'a HashMap bin becomes a red-black tree at 8 nodes once the table has at least 64 buckets (Java 8+), so heavy collisions degrade to O(log n), not O(n)' }
    ]
  },
  intro: {
    what: 'Every Java object has two methods that decide whether it is “the same” as another one: <code>equals</code> (the real comparison) and <code>hashCode</code> (an int fingerprint). Hash-based collections such as <code>HashMap</code> and <code>HashSet</code> use the fingerprint to jump straight to a small group of candidates, then use <code>equals</code> to find the exact match. If the two methods disagree, those collections stop working.',
    analogy: { icon: '📚', title: 'A library shelf by first letter', text: 'A librarian files books on shelves by the first letter of the title (the hash) and then scans that shelf for the exact title (equals). If you file a book under “T” and someone looks under “H”, it is lost. The same happens if you rename the book after shelving it: it sits under the old letter, and nobody looking for it will check there.' },
    steps: [
      { t: 'Default behaviour is identity', d: '<code>Object.equals</code> is <code>==</code>, and <code>Object.hashCode</code> is an identity hash. Two <code>new Point(1, 1)</code> objects are not equal unless you override.' },
      { t: 'Override both, from the same fields', d: 'Whatever fields <code>equals</code> compares, <code>hashCode</code> should mix those fields and no others.', code: '@Override public boolean equals(Object o) {\n  return o instanceof Point p && x == p.x && y == p.y;\n}\n@Override public int hashCode() { return Objects.hash(x, y); }' },
      { t: 'Or let a record do it', d: 'A <code>record Point(int x, int y) {}</code> (Java 16+) generates matching <code>equals</code>, <code>hashCode</code> and <code>toString</code> from its components.' },
      { t: 'Never mutate a key', d: 'Changing a field used by <code>hashCode</code> while the object is in a HashMap or HashSet leaves it in the wrong bucket. Lookups fail and <code>remove</code> fails.' }
    ],
    terms: [
      ['hash code', 'An <code>int</code> summarising an object. Equal objects must have equal hash codes.'],
      ['bucket', 'A slot in the hash table array. Index = spread hash &amp; (capacity − 1).'],
      ['collision', 'Two different keys in the same bucket. Normal and expected; <code>equals</code> sorts them out.'],
      ['identity hash', 'The default <code>hashCode</code> from <code>Object</code>, one per object, also available as <code>System.identityHashCode</code>.'],
      ['consistent with equals', 'A <code>compareTo</code> that returns 0 exactly when <code>equals</code> is true. Sorted collections depend on it.']
    ]
  },
  visual: {
    title: 'Inside a HashMap lookup',
    caption: 'Pick a scenario and press <b>Play</b>. The bar at the top shows how the hash is computed, the arrow shows which bucket is searched, and green or red marks the result of <code>equals</code>. Try <b>Mutable key</b> to see an entry become unreachable.'
  },
  gotchas: [
    { trap: 'Overriding equals without hashCode', code: `class Sku {
  final String code;
  @Override public boolean equals(Object o) { return o instanceof Sku s && s.code.equals(code); }
  // hashCode not overridden
}
set.add(new Sku("A1")); set.contains(new Sku("A1"));   // false`, why: 'Equal objects keep their different identity hashes, so they go to different buckets. The contract is broken, and every hash-based collection misbehaves.', fix: 'Always override both, from the same fields. Use a record when the class is a plain value. IDEs and Error Prone (<code>EqualsHashCode</code>) flag the missing method.' },
    { trap: 'Mutating a field that hashCode uses', code: `Set<Order> pending = new HashSet<>();
pending.add(order);
order.setStatus(SHIPPED);      // status is part of equals/hashCode
pending.remove(order);         // false: wrong bucket now
pending.contains(order);       // false, yet size() is still 1`, why: 'HashMap stores each entry’s hash and leaves the entry in its bucket. After the mutation the key hashes somewhere else, so it can’t be found and can’t be removed.', fix: 'Use immutable keys (records, Strings, ids). If the object must be mutable, base equals and hashCode only on fields that never change, such as a natural key.' },
    { trap: '<code>equals(MyType)</code> overloads instead of overriding', code: `public boolean equals(Point p) { … }   // overload: HashSet never calls it`, why: 'Collections call <code>equals(Object)</code>. An overload with a narrower parameter type is a different method, so <code>Object.equals</code> (identity) is still used.', fix: 'Always declare <code>equals(Object o)</code> with <code>@Override</code>. The compiler then rejects a wrong signature.' },
    { trap: 'compareTo inconsistent with equals', code: `new BigDecimal("2.0").equals(new BigDecimal("2.00"));    // false (scale differs)
new BigDecimal("2.0").compareTo(new BigDecimal("2.00")); // 0
// HashSet keeps both; TreeSet keeps one`, why: 'TreeMap and TreeSet use only <code>compareTo</code> (or the Comparator) to decide sameness. If it returns 0 for objects that are not <code>equals</code>, sorted and hashed collections disagree about how many elements there are.', fix: 'Make comparators total over the identity: <code>comparing(Person::lastName).thenComparing(Person::id)</code>. For money, normalise scale with <code>setScale</code> or <code>stripTrailingZeros</code> before using values as keys.' },
    { trap: 'JPA entities with id-based hashCode', code: `@Entity class LineItem {
  @Id @GeneratedValue Long id;
  public int hashCode() { return Objects.hashCode(id); }   // changes at persist
}
order.getItems().add(item);   // id null → bucket of hash 0
em.persist(item);             // id = 42 → hash changes; item is now lost in the Set`, why: 'A generated id is null until the entity is flushed. A hash that depends on it changes during the entity’s life, which is the mutable-key bug again.', fix: 'Use a stable business key, or compare ids in equals (two transient entities are never equal) and return a constant such as <code>LineItem.class.hashCode()</code> from hashCode. The constant is slower, but it is correct.' },
    { trap: 'Records with array or mutable components', code: `record Tag(String name, byte[] digest) {}
new Tag("x", new byte[]{1}).equals(new Tag("x", new byte[]{1}));   // false`, why: 'A record compares reference components with <code>Objects.equals</code>, and arrays don’t override equals, so they compare by identity. A <code>List</code> component compares by contents but can be mutated after construction.', fix: 'Override <code>equals</code>/<code>hashCode</code> with <code>Arrays.equals</code>/<code>Arrays.hashCode</code>, or store an immutable copy (<code>List.copyOf</code>) in the compact constructor.' },
    { trap: '<code>instanceof</code> vs <code>getClass()</code> with subclasses', why: 'If <code>Point.equals</code> uses <code>instanceof</code> and <code>ColorPoint extends Point</code> adds colour to its own equals, then <code>p.equals(cp)</code> is true but <code>cp.equals(p)</code> is false. That breaks symmetry, and Sets behave differently depending on insertion order.', fix: 'Make value classes <code>final</code> (records are), or use <code>getClass() != o.getClass()</code> when subclasses can add state. Composition is usually better than extending a value class.' }
  ],
  scenarios: [
    { title: 'Pricing cache grew until the pod was OOM-killed',
      symptom: 'Heap usage climbed for hours after each deploy. The cache hit rate was near 0%, yet the cache’s <code>size()</code> grew with every request.',
      diagnose: `// heap dump: HashMap with 2.1M entries, keys of type PriceQuery
class PriceQuery {
  String sku; String region; Set<String> flags;      // mutable, shared with the request
  // equals/hashCode generated from all three fields
}
cache.computeIfAbsent(query, this::load);
query.flags.add("seen");                            // later, in a filter`,
      cause: 'The key object was mutated after insertion. Its hash moved, so later lookups missed. Each request inserted a new entry, and the old entries could no longer be reached or evicted by key.',
      fix: 'Make the key an immutable record that holds copies of its collections. Bound the cache (Caffeine <code>maximumSize</code>) so a key bug degrades the hit rate instead of crashing the pod.',
      fixCode: `record PriceQuery(String sku, String region, Set<String> flags) {
  PriceQuery { flags = Set.copyOf(flags); }   // immutable snapshot
}
Cache<PriceQuery, Price> cache = Caffeine.newBuilder()
    .maximumSize(50_000).expireAfterWrite(Duration.ofMinutes(10)).build();` },
    { title: 'Line items vanished from an order after save',
      symptom: 'A new order with three items saved correctly, but <code>order.getItems().remove(item)</code> silently did nothing, and duplicates appeared after a merge.',
      diagnose: `@OneToMany(mappedBy = "order", cascade = ALL)
Set<LineItem> items = new HashSet<>();

// LineItem.hashCode() = Objects.hash(id) → id was null when added, 101 after flush`,
      cause: 'The entity’s hash depended on a generated id that changes at persist time. Items were put into the HashSet under the hash of a null id and then looked up under the hash of the real id.',
      fix: 'Give entities an equality that never changes during their life: a natural key, or an id-based equals with a constant hashCode.',
      fixCode: `@Override public boolean equals(Object o) {
  if (this == o) return true;
  if (!(o instanceof LineItem other)) return false;
  return id != null && id.equals(other.id);   // transient entities are never equal
}
@Override public int hashCode() { return LineItem.class.hashCode(); }  // stable for the entity’s life` },
    { title: 'Quarterly report was missing 312 employees',
      symptom: 'An export sorted employees with a <code>TreeSet</code> and dropped people who share a surname with someone already in the set.',
      diagnose: `Set<Employee> sorted = new TreeSet<>(Comparator.comparing(Employee::lastName));
sorted.addAll(employees);   // "Smith, Jane" and "Smith, John" compare as 0`,
      cause: 'TreeSet treats <code>compare(a, b) == 0</code> as a duplicate. The comparator was not consistent with equals, so every repeated surname after the first was thrown away.',
      fix: 'Add tie-breakers until the comparator only returns 0 for truly equal objects, or sort a List instead of using a Set.',
      fixCode: `Comparator<Employee> order = Comparator.comparing(Employee::lastName)
    .thenComparing(Employee::firstName)
    .thenComparingLong(Employee::id);          // total order
List<Employee> sorted = employees.stream().sorted(order).toList();` }
  ],
  puzzles: [
    { kind: 'predict', q: 'equals is overridden, hashCode is not. What does this print?', code: `import java.util.*;

public class Main {
    static class Key {
        final String name;
        Key(String name) { this.name = name; }
        @Override public boolean equals(Object o) {
            return o instanceof Key k && k.name.equals(name);
        }
    }

    public static void main(String[] args) {
        Set<Key> set = new HashSet<>();
        set.add(new Key("a"));
        set.add(new Key("a"));
        System.out.println(set.size() + " " + new Key("a").equals(new Key("a")));
    }
}`, options: ['1 true', '2 true', '2 false', '1 false'], answer: 1, explain: 'The two keys are equal, but each has its own identity hash, so HashSet puts them in different buckets and never compares them with <code>equals</code>. Prints <b>2 true</b>. (In theory two identity hashes could collide; in practice they don’t.)', run: true, expect: '2 true' },
    { kind: 'predict', q: 'A list used as a map key, then mutated. What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<Integer> key = new ArrayList<>(List.of(1, 2));
        Map<List<Integer>, String> map = new HashMap<>();
        map.put(key, "v");
        key.add(3);
        System.out.println(map.get(key) + " " + map.get(List.of(1, 2)) + " " + map.size());
    }
}`, options: ['v v 1', 'v null 1', 'null null 1', 'null v 1'], answer: 2, explain: '<code>List.hashCode</code> depends on the elements. After <code>add(3)</code> the key hashes to a different value, so <code>get(key)</code> misses. <code>List.of(1, 2)</code> has the old hash and finds the entry, but <code>equals</code> compares [1, 2] with the mutated [1, 2, 3] and fails. The entry is still there. Prints <b>null null 1</b>.', run: true, expect: 'null null 1' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        System.out.println("Aa".hashCode() == "BB".hashCode());
        System.out.println("Aa".equals("BB"));
    }
}`, options: ['true / true', 'true / false', 'false / false', 'It depends on the JVM'], answer: 1, explain: '<code>String.hashCode</code> is specified exactly: 65·31 + 97 = 2112 and 66·31 + 66 = 2112. Different strings, same hash: a collision. Prints <b>true</b> then <b>false</b>. The contract allows this; it only forbids equal objects having different hashes.', run: true, expect: 'true\nfalse' },
    { kind: 'predict', q: 'BigDecimal in a HashSet and a TreeSet. What does this print?', code: `import java.math.BigDecimal;
import java.util.*;

public class Main {
    public static void main(String[] args) {
        var a = new BigDecimal("2.0");
        var b = new BigDecimal("2.00");
        Set<BigDecimal> hash = new HashSet<>(List.of(a, b));
        Set<BigDecimal> tree = new TreeSet<>(List.of(a, b));
        System.out.println(hash.size() + " " + tree.size() + " " + a.equals(b) + " " + a.compareTo(b));
    }
}`, options: ['1 1 true 0', '2 2 false 0', '2 1 false 0', '1 2 false 1'], answer: 2, explain: '<code>BigDecimal.equals</code> compares value <i>and scale</i>, so 2.0 and 2.00 are not equal and HashSet keeps both. <code>compareTo</code> compares numeric value only and returns 0, so TreeSet treats them as duplicates. Prints <b>2 1 false 0</b>. The Javadoc calls this out as an inconsistency with equals.', run: true, expect: '2 1 false 0' },
    { kind: 'bug', q: 'An equals “override”. What does this print?', code: `import java.util.*;

public class Main {
    static class P {
        final int x;
        P(int x) { this.x = x; }
        public boolean equals(P o) { return o != null && o.x == x; }
        @Override public int hashCode() { return x; }
    }

    public static void main(String[] args) {
        P a = new P(1), b = new P(1);
        Object ob = b;
        System.out.println(a.equals(b) + " " + a.equals(ob) + " " + new HashSet<>(List.of(a, b)).size());
    }
}`, options: ['true true 1', 'true false 2', 'true false 1', 'false false 2'], answer: 1, explain: '<code>equals(P)</code> is an <b>overload</b>. <code>a.equals(b)</code> picks it at compile time because the argument’s static type is P, so true. <code>a.equals(ob)</code> has a static type of Object, so it calls <code>Object.equals</code> (identity), giving false. HashSet also calls <code>equals(Object)</code>, so both stay. Prints <b>true false 2</b>. Adding <code>@Override</code> would have turned this into a compile error.', run: true, expect: 'true false 2' },
    { kind: 'predict', q: 'A record with an array component. What does this print?', code: `public class Main {
    record Tag(String name, int[] codes) {}

    public static void main(String[] args) {
        var t1 = new Tag("x", new int[] {1});
        var t2 = new Tag("x", new int[] {1});
        System.out.println(t1.equals(t2) + " " + t1.name().equals(t2.name()));
    }
}`, options: ['true true', 'false true', 'false false', 'Compile error: records cannot have array components'], answer: 1, explain: 'Generated record equality uses <code>Objects.equals</code> for reference components. Arrays inherit identity equals, so two distinct arrays with the same contents are not equal. Prints <b>false true</b>.', run: true, expect: 'false true' },
    { kind: 'concept', q: 'Which of these is <b>not</b> required by the equals/hashCode contract?', options: ['If <code>a.equals(b)</code>, then <code>a.hashCode() == b.hashCode()</code>', 'If <code>!a.equals(b)</code>, then their hash codes differ', '<code>hashCode</code> returns the same value on repeated calls while the fields used by equals don’t change', '<code>a.equals(null)</code> returns false'], answer: 1, explain: 'Unequal objects are allowed to collide. Distinct hashes only make hash tables faster. The other three statements are part of the contract in the <code>Object</code> Javadoc. Note that hashCode doesn’t have to be the same across JVM runs; identity hashes and <code>Enum.hashCode</code> usually differ between runs.' }
  ],
  interview: [
    { q: 'State the equals and hashCode contract.', a: '<p><b>equals</b> must be reflexive, symmetric, transitive and consistent, and <code>x.equals(null)</code> must be false. <b>hashCode</b> must return the same value during one execution while the fields used by equals are unchanged, and equal objects must return equal hash codes. Unequal objects may collide.</p>', fu: 'Must hashCode be stable across JVM restarts? No. Don’t persist identity hashes or <code>Enum.hashCode</code>.', lvl: 'core' },
    { q: 'What exactly goes wrong if you override equals but not hashCode?', a: '<p>Equal objects keep different identity hashes. HashMap routes them to different buckets and, even in the same bucket, compares the stored hash before calling equals. So <code>contains</code> returns false, <code>put</code> creates duplicates and <code>remove</code> does nothing.</p>', lvl: 'core' },
    { q: 'Walk through <code>HashMap.get</code>.', a: '<ol><li><code>h = key.hashCode()</code>, then spread it: <code>h ^ (h &gt;&gt;&gt; 16)</code>, so high bits affect small tables.</li><li>Index = <code>h &amp; (n − 1)</code>, where n is a power of two.</li><li>For each node in the bin: check <code>node.hash == h</code>, then <code>node.key == key || key.equals(node.key)</code>.</li><li>A treeified bin (8+ nodes, table ≥ 64) is searched as a red-black tree ordered by hash, then by <code>compareTo</code> if the keys are Comparable.</li></ol>', fu: 'Why does a Comparable key help with heavy collisions? Inside a tree bin, it lets the lookup go left or right instead of searching both subtrees.', lvl: 'deep' },
    { q: 'Why are mutable keys dangerous? What would you do instead?', a: '<p>The entry is filed under the hash it had at insertion time. Mutating a field that hashCode uses makes the key unfindable: get, contains and remove all miss, yet the entry still occupies memory. Use immutable keys (records, Strings, ids, <code>List.copyOf</code>) or base equality on fields that never change.</p>', lvl: 'core' },
    { q: 'What do records generate, and what are the edge cases?', a: '<ul><li><code>equals</code>: same record class, and each component equal. Reference components use <code>Objects.equals</code>. Primitive components use the wrapper’s <code>compare</code>, so a <code>double</code> NaN equals NaN while <code>0.0</code> and <code>-0.0</code> differ.</li><li><code>hashCode</code>: derived from all components. The formula is unspecified.</li><li><code>toString</code>: <code>Name[a=1, b=2]</code>.</li></ul><p>Edge cases: array components compare by identity, and mutable components such as a List can change after construction. You can override any of these methods explicitly.</p>', lvl: 'deep' },
    { q: 'instanceof or getClass() in equals?', a: '<p><code>instanceof</code> lets a subclass instance equal a superclass instance. That is fine if subclasses add no state that matters to equality, and it plays well with proxies (Hibernate). <code>getClass()</code> keeps symmetry when subclasses add state, but it breaks the Liskov substitution principle and fails with proxy subclasses. The best option is usually to make value classes final, or use records, so the question doesn’t arise.</p>', lvl: 'deep' },
    { q: 'What does “compareTo consistent with equals” mean? Why does it matter?', a: '<p><code>compareTo</code> returns 0 if and only if <code>equals</code> returns true. Sorted collections use only the comparison, so an inconsistent one makes TreeSet and TreeMap drop or merge elements that a HashSet keeps. <code>BigDecimal</code> is the famous inconsistent JDK class (2.0 vs 2.00).</p>', lvl: 'core' },
    { q: 'How should JPA entities implement equals and hashCode?', a: '<p>Equality must stay stable across the transient → managed → detached life of the entity, and should work with Hibernate proxies. Common options:</p><ul><li>A natural or business key that never changes: equals and hashCode both use it.</li><li>An id-based equals (<code>id != null &amp;&amp; id.equals(other.id)</code>) with a constant hashCode.</li></ul><p>Avoid generated-id hashCodes and avoid including lazy associations, which can trigger extra queries or <code>LazyInitializationException</code>.</p>', lvl: 'deep' },
    { q: 'How would you write a good hashCode by hand?', a: '<p>Combine the same fields equals uses: <code>31 * h + field.hashCode()</code>, or <code>Objects.hash(a, b, c)</code>. <code>Objects.hash</code> allocates a varargs array and boxes primitives, which matters only in hot paths. Use <code>Long.hashCode</code>, <code>Double.hashCode</code> and <code>Arrays.hashCode</code> for those types. Cache the result only if the object is immutable, as String does.</p>', fu: 'Why 31? It is an odd prime, so multiplying by it loses no information, and the JIT can compute <code>31 * h</code> as <code>(h &lt;&lt; 5) − h</code>.', lvl: 'core' },
    { q: 'Can an attacker exploit hash collisions?', a: '<p>Yes. Hash flooding sends many keys with the same hash, for example request parameters built from “Aa” and “BB” blocks, to turn O(1) lookups into O(n) and burn CPU. Java 8’s tree bins cap the damage at O(log n) for Comparable keys such as String. Servers also limit the number of parameters and headers per request.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'A value class, two ways', lang: 'java', code: `// Java 16+: the whole contract for free
public record Money(BigDecimal amount, Currency currency) {
    public Money {
        amount = amount.stripTrailingZeros();   // 2.0 and 2.00 become one value
        Objects.requireNonNull(currency);
    }
}

// Pre-records, or when you need control
public final class Sku {
    private final String code;
    public Sku(String code) { this.code = code.toUpperCase(Locale.ROOT); }

    @Override public boolean equals(Object o) {
        return this == o || (o instanceof Sku s && code.equals(s.code));
    }
    @Override public int hashCode() { return code.hashCode(); }
}`, note: 'Normalise in the constructor so that equal-meaning values are also <code>equals</code>.' },
    { title: 'JPA entity equality', lang: 'java', code: `@Entity
public class LineItem {
    @Id @GeneratedValue private Long id;
    @ManyToOne(fetch = LAZY) private Order order;   // never part of equals

    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof LineItem other)) return false;   // instanceof works with Hibernate proxies
        return id != null && id.equals(other.getId());      // getter, so a proxy initialises
    }

    @Override public int hashCode() {
        return LineItem.class.hashCode();                   // constant: safe across persist, same for proxies
    }
}` },
    { title: 'Comparators that agree with equals', lang: 'java', code: `public static final Comparator<Employee> BY_NAME =
    Comparator.comparing(Employee::lastName, String.CASE_INSENSITIVE_ORDER)
              .thenComparing(Employee::firstName, String.CASE_INSENSITIVE_ORDER)
              .thenComparingLong(Employee::id);      // final tie-breaker = identity

// a TreeMap keyed by this comparator never merges two different employees
NavigableMap<Employee, Salary> payroll = new TreeMap<>(BY_NAME);` }
  ]
});

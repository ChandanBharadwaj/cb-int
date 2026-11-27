IA.register({
  track: 'java',
  slug: 'equals-hashcode',
  title: 'equals & hashCode contract',
  tagline: 'A HashMap finds a key in two moves: <b>hashCode</b> picks the bucket, then <b>equals</b> picks the entry. If the two disagree, or a key changes after you insert it, entries become invisible. They are never removed.',
  tldr: {
    problem: 'Lookups return <code>null</code> for keys that are “obviously” there. Sets hold duplicates. Caches grow forever. A TreeSet drops records. The code compiles and usually passes the tests.',
    model: '<code>hashCode</code> is a quick, rough fingerprint that picks a bucket. <code>equals</code> is the real check inside that bucket. Rule: <b>equal ⇒ same hash</b>. Neither may change while the object is a key.',
    hook: '“What happens if you override equals but not hashCode?” Two equal keys keep different default hashes. They land in different buckets, so <code>equals</code> is never called.',
    facts: [
      { v: 'equal ⇒ equal hash', l: 'the one-way rule in <code>Object.hashCode</code>’s contract. Unequal objects may collide, and HashMap must still work correctly when they do' },
      { v: '2112', l: 'is both <code>"Aa".hashCode()</code> and <code>"BB".hashCode()</code>. String collisions are easy to make on purpose' },
      { v: '8 / 64', l: 'a HashMap bucket turns into a tree at 8 entries, once there are 64+ buckets (Java 8+). Heavy collisions then cost O(log n), not O(n)' }
    ]
  },
  intro: {
    what: 'Every Java object has two methods that decide if it is “the same” as another. <code>equals</code> does the real comparison. <code>hashCode</code> gives an int fingerprint. <code>HashMap</code> and <code>HashSet</code> use the fingerprint to jump to a few candidates. Then <code>equals</code> finds the exact match. If the two methods disagree, those collections break.',
    analogy: { icon: '📚', title: 'A library shelf by first letter', text: 'A librarian shelves books by the title’s first letter (the hash). Then she scans that shelf for the exact title (equals). File a book under “T” while someone looks under “H”, and it is lost. Rename a book after shelving it, and it sits under the old letter. Nobody looks there.' },
    steps: [
      { t: 'Default behaviour is identity', d: '<code>Object.equals</code> is <code>==</code>. <code>Object.hashCode</code> is different for each object (an <i>identity hash</i>). Two <code>new Point(1, 1)</code> objects are not equal unless you override.' },
      { t: 'Override both, from the same fields', d: 'Whatever fields <code>equals</code> compares, <code>hashCode</code> should mix those fields and no others.', code: '@Override public boolean equals(Object o) {\n  return o instanceof Point p && x == p.x && y == p.y;\n}\n@Override public int hashCode() { return Objects.hash(x, y); }' },
      { t: 'Or let a record do it', d: 'A <code>record Point(int x, int y) {}</code> (Java 16+) generates matching <code>equals</code>, <code>hashCode</code> and <code>toString</code> from its components.' },
      { t: 'Never mutate a key', d: 'Change a <code>hashCode</code> field while the object sits in a HashMap or HashSet, and it is in the wrong bucket. Lookups and <code>remove</code> both fail.' }
    ],
    terms: [
      ['hash code', 'An <code>int</code> summarising an object. Equal objects must have equal hash codes.'],
      ['bucket', 'One slot in the map’s internal array. Index = mixed hash &amp; (capacity − 1).'],
      ['collision', 'Two different keys in the same bucket. This is normal; <code>equals</code> tells them apart.'],
      ['identity hash', 'The default <code>hashCode</code> from <code>Object</code>, one per object. <code>System.identityHashCode</code> returns it too.'],
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
set.add(new Sku("A1")); set.contains(new Sku("A1"));   // false`, why: 'Equal objects keep different default hashes, so they go to different buckets. The contract is broken, and every hash-based collection misbehaves.', fix: 'Always override both, from the same fields. Use a record when the class is a plain value. IDEs and Error Prone (<code>EqualsHashCode</code>) flag the missing method.' },
    { trap: 'Mutating a field that hashCode uses', code: `Set<Order> pending = new HashSet<>();
pending.add(order);
order.setStatus(SHIPPED);      // status is part of equals/hashCode
pending.remove(order);         // false: wrong bucket now
pending.contains(order);       // false, yet size() is still 1`, why: 'HashMap remembers each entry’s hash and leaves it in its bucket. After the change the key hashes elsewhere. It can’t be found or removed.', fix: 'Use immutable keys (records, Strings, ids). If the object must change, base equals and hashCode only on fields that never change, such as a natural key.' },
    { trap: '<code>equals(MyType)</code> overloads instead of overriding', code: `public boolean equals(Point p) { … }   // overload: HashSet never calls it`, why: 'Collections call <code>equals(Object)</code>. <code>equals(Point)</code> is a different method. So the default <code>Object.equals</code> (same object?) still runs.', fix: 'Always declare <code>equals(Object o)</code> with <code>@Override</code>. The compiler then rejects a wrong signature.' },
    { trap: 'compareTo inconsistent with equals', code: `new BigDecimal("2.0").equals(new BigDecimal("2.00"));    // false (scale differs)
new BigDecimal("2.0").compareTo(new BigDecimal("2.00")); // 0
// HashSet keeps both; TreeSet keeps one`, why: 'TreeMap and TreeSet use only <code>compareTo</code> (or the Comparator) to decide sameness. If it returns 0 for objects that aren’t <code>equals</code>, sorted and hashed collections disagree on the count.', fix: 'Add tie-breakers until only truly equal objects compare as 0: <code>comparing(Person::lastName).thenComparing(Person::id)</code>. For money, fix the decimal places with <code>setScale</code> or <code>stripTrailingZeros</code> before using values as keys.' },
    { trap: 'JPA entities with id-based hashCode', code: `@Entity class LineItem {
  @Id @GeneratedValue Long id;
  public int hashCode() { return Objects.hashCode(id); }   // changes at persist
}
order.getItems().add(item);   // id null → bucket of hash 0
em.persist(item);             // id = 42 → hash changes; item is now lost in the Set`, why: 'A generated id is null until the entity is saved. A hash based on it changes during the entity’s life. That is the changing-key bug again.', fix: 'Use a business key that never changes. Or compare ids in equals (two unsaved entities are never equal) and return a constant such as <code>LineItem.class.hashCode()</code> from hashCode. The constant is slower, but it is correct.' },
    { trap: 'Records with array or mutable components', code: `record Tag(String name, byte[] digest) {}
new Tag("x", new byte[]{1}).equals(new Tag("x", new byte[]{1}));   // false`, why: 'A record compares fields with <code>Objects.equals</code>. Arrays don’t override equals, so they compare as “same object?”. A <code>List</code> field compares contents, but someone can change it later.', fix: 'Override <code>equals</code>/<code>hashCode</code> with <code>Arrays.equals</code>/<code>Arrays.hashCode</code>, or store an immutable copy (<code>List.copyOf</code>) in the compact constructor.' },
    { trap: '<code>instanceof</code> vs <code>getClass()</code> with subclasses', why: 'If <code>Point.equals</code> uses <code>instanceof</code> and <code>ColorPoint extends Point</code> adds colour to its own equals, then <code>p.equals(cp)</code> is true but <code>cp.equals(p)</code> is false. That breaks symmetry, and Sets behave differently depending on insertion order.', fix: 'Make value classes <code>final</code> (records are), or use <code>getClass() != o.getClass()</code> when subclasses can add state. Wrapping a value class usually beats extending it.' }
  ],
  scenarios: [
    { title: 'Pricing cache grew until the pod was OOM-killed',
      symptom: 'Memory use climbed for hours after each deploy. The cache hit rate was near 0%, yet the cache’s <code>size()</code> grew with every request.',
      diagnose: `// heap dump: HashMap with 2.1M entries, keys of type PriceQuery
class PriceQuery {
  String sku; String region; Set<String> flags;      // mutable, shared with the request
  // equals/hashCode generated from all three fields
}
cache.computeIfAbsent(query, this::load);
query.flags.add("seen");                            // later, in a filter`,
      cause: 'The key changed after insertion. Its hash moved, so later lookups missed. Each request added a new entry. Old entries could no longer be found or removed by key.',
      fix: 'Make the key an immutable record that holds copies of its collections. Limit the cache size (Caffeine <code>maximumSize</code>). Then a key bug lowers the hit rate instead of crashing the pod.',
      fixCode: `record PriceQuery(String sku, String region, Set<String> flags) {
  PriceQuery { flags = Set.copyOf(flags); }   // immutable snapshot
}
Cache<PriceQuery, Price> cache = Caffeine.newBuilder()
    .maximumSize(50_000).expireAfterWrite(Duration.ofMinutes(10)).build();` },
    { title: 'Line items vanished from an order after save',
      symptom: 'A new order with three items saved correctly, but <code>order.getItems().remove(item)</code> did nothing, and duplicates appeared after a merge.',
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
      fix: 'Add tie-breakers until the comparator returns 0 only for truly equal objects. Or sort a List instead of using a Set.',
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
}`, options: ['1 true', '2 true', '2 false', '1 false'], answer: 1, explain: 'The two keys are equal, but each has its own default hash. So HashSet puts them in different buckets and never calls <code>equals</code>. Prints <b>2 true</b>. (In theory two identity hashes could collide; in practice they don’t.)', run: true, expect: '2 true' },
    { kind: 'predict', q: 'A list used as a map key, then mutated. What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<Integer> key = new ArrayList<>(List.of(1, 2));
        Map<List<Integer>, String> map = new HashMap<>();
        map.put(key, "v");
        key.add(3);
        System.out.println(map.get(key) + " " + map.get(List.of(1, 2)) + " " + map.size());
    }
}`, options: ['v v 1', 'v null 1', 'null null 1', 'null v 1'], answer: 2, explain: '<code>List.hashCode</code> depends on the elements. After <code>add(3)</code> the key has a new hash, so <code>get(key)</code> misses. <code>List.of(1, 2)</code> has the old hash and finds the entry. But <code>equals</code> compares [1, 2] with the changed [1, 2, 3] and fails. The entry is still there. Prints <b>null null 1</b>.', run: true, expect: 'null null 1' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        System.out.println("Aa".hashCode() == "BB".hashCode());
        System.out.println("Aa".equals("BB"));
    }
}`, options: ['true / true', 'true / false', 'false / false', 'It depends on the JVM'], answer: 1, explain: '<code>String.hashCode</code> is specified exactly: 65·31 + 97 = 2112 and 66·31 + 66 = 2112. Different strings, same hash: a collision. Prints <b>true</b> then <b>false</b>. The contract allows this. It only forbids equal objects with different hashes.', run: true, expect: 'true\nfalse' },
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
}`, options: ['1 1 true 0', '2 2 false 0', '2 1 false 0', '1 2 false 1'], answer: 2, explain: '<code>BigDecimal.equals</code> compares the value <i>and the decimal places</i>. So 2.0 and 2.00 differ, and HashSet keeps both. <code>compareTo</code> compares only the value and returns 0. So TreeSet sees duplicates. Prints <b>2 1 false 0</b>. The Javadoc calls this out as an inconsistency with equals.', run: true, expect: '2 1 false 0' },
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
}`, options: ['true true 1', 'true false 2', 'true false 1', 'false false 2'], answer: 1, explain: '<code>equals(P)</code> is a separate method (an <b>overload</b>). <code>a.equals(b)</code> picks it at compile time, since b is declared as P: true. <code>ob</code> is declared as Object, so <code>a.equals(ob)</code> calls <code>Object.equals</code> (same object?): false. HashSet also calls <code>equals(Object)</code>, so both stay. Prints <b>true false 2</b>. Adding <code>@Override</code> would have turned this into a compile error.', run: true, expect: 'true false 2' },
    { kind: 'predict', q: 'A record with an array component. What does this print?', code: `public class Main {
    record Tag(String name, int[] codes) {}

    public static void main(String[] args) {
        var t1 = new Tag("x", new int[] {1});
        var t2 = new Tag("x", new int[] {1});
        System.out.println(t1.equals(t2) + " " + t1.name().equals(t2.name()));
    }
}`, options: ['true true', 'false true', 'false false', 'Compile error: records cannot have array components'], answer: 1, explain: 'A record’s equals uses <code>Objects.equals</code> for object fields. Arrays keep the default “same object?” equals. So two arrays with the same contents are not equal. Prints <b>false true</b>.', run: true, expect: 'false true' },
    { kind: 'concept', q: 'Which of these is <b>not</b> required by the equals/hashCode contract?', options: ['If <code>a.equals(b)</code>, then <code>a.hashCode() == b.hashCode()</code>', 'If <code>!a.equals(b)</code>, then their hash codes differ', '<code>hashCode</code> returns the same value on repeated calls while the fields used by equals don’t change', '<code>a.equals(null)</code> returns false'], answer: 1, explain: 'Unequal objects may share a hash. Different hashes only make hash tables faster. The other three statements are part of the <code>Object</code> contract. hashCode needn’t match across JVM runs. Default hashes and <code>Enum.hashCode</code> usually differ between runs.' }
  ],
  interview: [
    { q: 'State the equals and hashCode contract.', a: '<p><b>equals</b>: x equals x. If x equals y, y equals x. If x equals y and y equals z, x equals z. Answers don’t change without a reason. <code>x.equals(null)</code> is false. <b>hashCode</b>: the same value during one run while the equals fields don’t change. Equal objects give equal hashes. Unequal objects may share one.</p>', fu: 'Must hashCode be stable across JVM restarts? No. Don’t store default hashes or <code>Enum.hashCode</code>.', lvl: 'core' },
    { q: 'What exactly goes wrong if you override equals but not hashCode?', a: '<p>Equal objects keep different default hashes. HashMap sends them to different buckets. Even in one bucket, it compares the stored hash before calling equals. So <code>contains</code> returns false, <code>put</code> creates duplicates and <code>remove</code> does nothing.</p>', lvl: 'core' },
    { q: 'Walk through <code>HashMap.get</code>.', a: '<ol><li><code>h = key.hashCode()</code>, then mix it: <code>h ^ (h &gt;&gt;&gt; 16)</code>, so high bits matter in small tables.</li><li>Index = <code>h &amp; (n − 1)</code>, where n is a power of two.</li><li>For each node in the bucket: check <code>node.hash == h</code>, then <code>node.key == key || key.equals(node.key)</code>.</li><li>A bucket turned into a tree (8+ nodes, 64+ buckets) is searched by hash, then by <code>compareTo</code> if keys are Comparable.</li></ol>', fu: 'Why does a Comparable key help with heavy collisions? In a tree bucket, the lookup can go left or right instead of searching both sides.', lvl: 'deep' },
    { q: 'Why are mutable keys dangerous? What would you do instead?', a: '<p>The entry is filed under the hash it had when inserted. Change a field that hashCode uses, and the key can’t be found. get, contains and remove all miss, yet the entry still uses memory. Use immutable keys (records, Strings, ids, <code>List.copyOf</code>) or base equality on fields that never change.</p>', lvl: 'core' },
    { q: 'What do records generate, and what are the edge cases?', a: '<ul><li><code>equals</code>: same record class, and each field equal. Object fields use <code>Objects.equals</code>. Primitive fields use the wrapper’s <code>compare</code>, so a <code>double</code> NaN equals NaN while <code>0.0</code> and <code>-0.0</code> differ.</li><li><code>hashCode</code>: built from all fields. The formula isn’t specified.</li><li><code>toString</code>: <code>Name[a=1, b=2]</code>.</li></ul><p>Edge cases: array fields compare as “same object?”. A List field can change after construction. You can override any of these methods.</p>', lvl: 'deep' },
    { q: 'instanceof or getClass() in equals?', a: '<p><code>instanceof</code> lets a subclass instance equal a superclass instance. That is fine if subclasses add no state that matters to equality. It also works with Hibernate proxies. <code>getClass()</code> keeps a.equals(b) == b.equals(a) when subclasses add state. But a subclass can then no longer stand in for its parent, and proxies fail. Best: make value classes final, or use records, and avoid the question.</p>', lvl: 'deep' },
    { q: 'What does “compareTo consistent with equals” mean? Why does it matter?', a: '<p><code>compareTo</code> returns 0 if and only if <code>equals</code> returns true. Sorted collections use only the comparison. If it disagrees, TreeSet and TreeMap drop or merge elements a HashSet keeps. <code>BigDecimal</code> is the famous inconsistent JDK class (2.0 vs 2.00).</p>', lvl: 'core' },
    { q: 'How should JPA entities implement equals and hashCode?', a: '<p>Equality must stay the same through the entity’s whole life: new, saved, detached. It should also work with Hibernate proxies. Common options:</p><ul><li>A natural or business key that never changes: equals and hashCode both use it.</li><li>An id-based equals (<code>id != null &amp;&amp; id.equals(other.id)</code>) with a constant hashCode.</li></ul><p>Avoid hashCodes based on generated ids. Leave out lazy relations, which can trigger extra queries or <code>LazyInitializationException</code>.</p>', lvl: 'deep' },
    { q: 'How would you write a good hashCode by hand?', a: '<p>Combine the same fields equals uses: <code>31 * h + field.hashCode()</code>, or <code>Objects.hash(a, b, c)</code>. <code>Objects.hash</code> creates an array and wraps primitives in objects. That matters only in hot code. Use <code>Long.hashCode</code>, <code>Double.hashCode</code> and <code>Arrays.hashCode</code> for those types. Cache the result only if the object can’t change, as String does.</p>', fu: 'Why 31? It is an odd prime, so multiplying by it loses no information, and the JIT can compute <code>31 * h</code> as <code>(h &lt;&lt; 5) − h</code>.', lvl: 'core' },
    { q: 'Can an attacker exploit hash collisions?', a: '<p>Yes. An attacker sends many keys with the same hash (<i>hash flooding</i>), such as request parameters built from “Aa” and “BB”. O(1) lookups become O(n) and burn CPU. Java 8’s tree buckets limit this to O(log n) for Comparable keys such as String. Servers also limit the number of parameters and headers per request.</p>', lvl: 'deep' }
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
}`, note: 'Clean up values in the constructor, so values that mean the same are also <code>equals</code>.' },
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

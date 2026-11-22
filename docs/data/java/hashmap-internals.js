IA.register({
  track: 'java',
  slug: 'hashmap-internals',
  title: 'HashMap internals',
  tagline: 'A <code>HashMap</code> is an <b>array of buckets</b>. The hash picks the bucket, <code>equals</code> picks the entry, and a resize moves half the entries. Once you see that array, iteration order, mutable-key bugs, treeification and <code>ConcurrentModificationException</code> all stop being surprises.',
  tldr: {
    problem: 'HashMap bugs rarely crash. They return <code>null</code> for a key you just put, change iteration order after a deploy, burn CPU on one overloaded bucket, or throw <code>ConcurrentModificationException</code> on a single thread.',
    model: '<code>index = (n − 1) &amp; (h ^ (h &gt;&gt;&gt; 16))</code> picks one of <i>n</i> buckets (n is a power of two). Colliding entries form a list in that bucket, or a red-black tree once the list is long. When <code>size &gt; 0.75 × n</code> the table doubles, and each entry either stays at <i>i</i> or moves to <i>i + oldN</i>.',
    hook: '“What happens if you mutate a key after putting it?” The entry stays in the bucket of its <i>old</i> hash, so <code>get</code> looks in the wrong bucket and returns <code>null</code>, yet <code>size()</code> still counts it.',
    facts: [
      { v: '16 × 0.75', l: 'default capacity and load factor. The 13th entry triggers the first resize; the table itself is allocated lazily on the first <code>put</code>' },
      { v: '8 / 64 / 6', l: 'a bin becomes a red-black tree at 8 nodes, but only if the table has ≥ 64 buckets (else it resizes). It turns back into a list at ≤ 6' },
      { v: 'Java 8', l: 'added treeified bins (JEP 180) and tail insertion. Java 7 inserted at the head, and a concurrent resize could create a cycle that spun a thread forever' }
    ]
  },
  intro: {
    what: 'A <b>map</b> stores <i>key → value</i> pairs, like “user id → user”. <code>HashMap</code> finds a key fast without scanning everything. It turns the key into a number (its <b>hash code</b>), uses that number to choose one slot in an internal array, and stores the pair there. To find it again, it computes the same number and looks in the same slot.',
    analogy: { icon: '📮', title: 'Pigeonholes in a mail room', text: 'A mail room has 16 pigeonholes. The clerk files each letter by a quick rule on the surname (say, the last digit of a code), so finding a letter means checking one hole, not the whole room. Two surnames can share a hole, so the clerk still reads each name in it. When the holes get too full, the clerk builds a wall twice as big and re-sorts. If you rename a letter after filing it, the clerk looks in the wrong hole and says “no such letter”.' },
    steps: [
      { t: 'The key becomes a number', d: 'Every object has <code>hashCode()</code>. For an <code>Integer</code> it is the value itself; for a <code>String</code> it is computed from the characters.', code: '"cat".hashCode()   // 98262\nInteger.valueOf(42).hashCode()   // 42' },
      { t: 'The number picks a bucket', d: 'HashMap mixes the high bits into the low bits, then keeps only as many low bits as it needs: with 16 buckets, the last 4 bits.', code: 'int h = key.hashCode();\nint index = (h ^ (h >>> 16)) & (16 - 1);' },
      { t: 'Collisions are normal', d: 'Two keys can land in the same bucket. HashMap keeps a small list there and uses <code>equals()</code> to find the right one. That is why <code>equals</code> and <code>hashCode</code> must agree.' },
      { t: 'It grows by doubling', d: 'When the map is 75% full it doubles the array and redistributes entries, which keeps buckets short and lookups O(1) on average.' }
    ],
    terms: [
      ['bucket / bin', 'One slot of the internal array. It holds zero, one or several entries.'],
      ['collision', 'Two different keys landing in the same bucket. Normal, and handled with a list or tree.'],
      ['load factor', 'How full the map may get (size ÷ buckets) before it doubles. Default 0.75.'],
      ['capacity', 'Number of buckets. Always a power of two in HashMap.'],
      ['treeify', 'Turning a long bucket list into a red-black tree, so a bad bucket costs O(log n) instead of O(n).'],
      ['fail-fast iterator', 'An iterator that throws <code>ConcurrentModificationException</code> if the map was changed behind its back.']
    ]
  },
  visual: {
    title: 'Watch keys land, collide, resize and treeify',
    caption: 'Pick a scenario and press Play (or Step). <b>put & resize</b> shows the index maths and the lo/hi split. <b>collisions → tree</b> uses a constant <code>hashCode()</code>. The two iteration scenarios show why <code>map.remove</code> inside a for-each throws and <code>iterator.remove()</code> doesn’t.'
  },
  gotchas: [
    { trap: 'Mutating a key after it is in the map', code: `List<Integer> key = new ArrayList<>(List.of(1, 2));
map.put(key, "v");
key.add(3);
map.get(key);          // null: wrong bucket
map.containsKey(key);  // false, yet map.size() == 1`, why: 'The node stores the hash computed at <code>put</code> time and sits in that bucket. A new hash sends <code>get</code> to a different bucket; even in the same bucket, the stored-hash check fails.', fix: 'Use immutable keys: <code>String</code>, boxed primitives, <code>record</code>s of immutable fields, <code>List.copyOf</code>. Never key on JPA entities whose hash depends on a generated id.' },
    { trap: 'Overriding equals but not hashCode', code: `class Sku { String code;
  @Override public boolean equals(Object o) { … }   // no hashCode()
}
set.add(new Sku("A1")); set.add(new Sku("A1"));   // size 2`, why: 'The default <code>hashCode</code> is identity-based, so equal objects usually land in different buckets and <code>equals</code> is never even called.', fix: 'Always override both, or use a <code>record</code>. See <a href="equals-hashcode.html">equals & hashCode</a>.' },
    { trap: 'Relying on HashMap iteration order', why: 'Order depends on hash values and capacity, so it changes after a resize, with a different initial capacity, or when a JDK changes a <code>hashCode</code>. <code>Map.of</code>/<code>Set.of</code> go further: their order is <b>randomised per JVM run</b> (a salt chosen at startup).', fix: 'If order matters, say so in the type: <code>LinkedHashMap</code> (insertion or access order) or <code>TreeMap</code> (sorted). In tests, compare maps with <code>equals</code>, not their <code>toString()</code>.' },
    { trap: '<code>new HashMap&lt;&gt;(n)</code> is a capacity, not an expected size', code: `new HashMap<>(1000)        // 1024 buckets, threshold 768 → resizes at entry 769
HashMap.newHashMap(1000)   // Java 19+: sized so 1000 entries fit without resizing`, why: 'The argument is rounded up to a power of two, then multiplied by 0.75 to get the resize threshold.', fix: 'On Java 19+ use <code>HashMap.newHashMap(expected)</code> (also <code>LinkedHashMap.newLinkedHashMap</code>, <code>HashSet.newHashSet</code>). Before that, pass <code>(int) (expected / 0.75f) + 1</code>.' },
    { trap: 'Removing inside a for-each loop', code: `for (String k : map.keySet())
    if (k.startsWith("tmp")) map.remove(k);   // CME, sometimes`, why: 'The for-each uses a fail-fast iterator. <code>map.remove</code> bumps <code>modCount</code>; the next <code>next()</code> sees the mismatch and throws. If the removed key happened to be the last one, the loop simply ends, which hides the bug in tests.', fix: '<code>map.keySet().removeIf(k -&gt; k.startsWith("tmp"))</code>, <code>map.entrySet().removeIf(…)</code>, or an explicit <code>Iterator</code> with <code>it.remove()</code>.' },
    { trap: 'Sharing a HashMap between threads', why: 'HashMap does no synchronisation. Concurrent puts lose entries, <code>size</code> drifts, and a concurrent resize can corrupt bins. On Java 7 that corruption could form a cycle, so a <code>get</code> spun at 100% CPU forever. Java 8+ avoids the cycle but is still unsafe.', fix: 'Use <a href="concurrent-collections.html">ConcurrentHashMap</a>, or publish an immutable map (<code>Map.copyOf</code>) and replace it wholesale.' },
    { trap: 'A weak hashCode makes one bucket do all the work', why: 'If many keys share a hash (a constant, or a <code>hashCode</code> built only from a low-cardinality field), they pile into one bin. Treeification caps the damage at O(log n), but only when the keys are <code>Comparable</code>; otherwise lookups among equal hashes can still scan the whole tree.', fix: 'Hash all the fields that <code>equals</code> uses (<code>Objects.hash</code>, or a record). If keys come from untrusted input, keep them <code>Comparable</code> (String is).' }
  ],
  scenarios: [
    { title: 'All request threads stuck at 100% CPU inside HashMap.get',
      symptom: 'An older service on Java 7 slowly loses throughput until every worker is busy. CPU is pinned; there are no errors in the logs.',
      diagnose: `jstack <pid> | grep -A6 '"http-nio'
# "http-nio-8080-exec-17" RUNNABLE
#    at java.util.HashMap.get(HashMap.java:…)
#    at com.acme.pricing.RateCache.lookup(…)`,
      cause: 'A <code>static HashMap</code> used as a cache was written by several threads. Two threads resized it at once; Java 7’s head-insertion transfer reversed a chain and linked it into a cycle. Any <code>get</code> that hits that bucket loops forever.',
      fix: 'Switch to <code>ConcurrentHashMap</code> (or Caffeine for an actual cache). Upgrading the JDK removes the infinite loop but not the lost updates, so the type change is the real fix.',
      fixCode: `private static final Map<String, Rate> RATES = new ConcurrentHashMap<>();

Rate lookup(String key) {
    return RATES.computeIfAbsent(key, this::loadRate);   // atomic per key
}` },
    { title: 'Snapshot tests fail after a “no-op” refactor',
      symptom: 'JSON snapshot tests and one partner integration break after a change that only replaced <code>new HashMap&lt;&gt;()</code> with <code>Map.of(…)</code> for constants. Locally the tests pass on some runs and fail on others.',
      diagnose: `// same JVM: stable; across JVM runs: different
System.out.println(Map.of("a", 1, "b", 2, "c", 3));
// run 1: {c=3, b=2, a=1}   run 2: {a=1, c=3, b=2}   (example)`,
      cause: 'The immutable <code>Map.of</code> collections randomise iteration order per JVM run on purpose, to flush out code that depends on it. The serializer emitted fields in map order, and the partner parsed by position.',
      fix: 'Make order explicit wherever it is part of a contract: a <code>LinkedHashMap</code>, a <code>TreeMap</code>, or Jackson’s <code>ORDER_MAP_ENTRIES_BY_KEYS</code>. Compare JSON semantically in tests.',
      fixCode: `@Bean
Jackson2ObjectMapperBuilderCustomizer sortedMaps() {
    return b -> b.featuresToEnable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
}` },
    { title: 'A nightly reconciliation job became quadratic',
      symptom: 'A batch that dedupes ~200k order entities in a <code>HashSet</code> used to take seconds and now takes over an hour. A profiler shows most time in <code>HashMap.putVal</code> and <code>TreeNode.find</code>.',
      diagnose: `// entity equals/hashCode recently "fixed" for JPA:
@Override public int hashCode() { return getClass().hashCode(); }   // constant!`,
      cause: 'A constant <code>hashCode</code> is a common JPA recommendation that is safe for small collections. Here it put all 200k entities in one bin. The entities aren’t <code>Comparable</code>, so even the treeified bin degrades to scanning, and each insert costs O(n).',
      fix: 'Dedupe by a natural or business key instead of the entity: collect into a <code>Map&lt;String, Order&gt;</code> keyed by an immutable order number.',
      fixCode: `Map<String, Order> byNumber = orders.stream()
    .collect(Collectors.toMap(Order::getOrderNumber, o -> o, (a, b) -> a));` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print on JDK 21?', code: `import java.util.*;

public class Main {
    public static void main(String[] a) {
        Map<Integer, String> m = new HashMap<>();
        m.put(17, "a"); m.put(1, "b"); m.put(33, "c"); m.put(2, "d");
        System.out.println(m.keySet());
    }
}`, options: ['[1, 2, 17, 33]', '[17, 1, 33, 2]', '[33, 1, 17, 2]', 'Order is random on each run'], answer: 1, run: true, expect: '[17, 1, 33, 2]', explain: 'With 16 buckets, 17, 1 and 33 all have the same low 4 bits (0001), so they share <b>bucket 1</b> in insertion order (Java 8+ appends at the tail). 2 is in bucket 2. Iteration goes bucket by bucket: <b>[17, 1, 33, 2]</b>. Java 7 inserted at the head and would print [33, 1, 17, 2]. It is deterministic, but it is not a promise.' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] a) {
        Map<Integer, Integer> m = new HashMap<>();
        m.put(17, 0); m.put(2, 0);
        String before = m.keySet().toString();
        for (int i = 100; i < 111; i++) m.put(i, 0);   // 13 entries in total
        System.out.println(before + " " + m.keySet().iterator().next());
    }
}`, options: ['[17, 2] 17', '[17, 2] 2', '[2, 17] 2', '[17, 2] 100'], answer: 1, run: true, expect: '[17, 2] 2', explain: 'At 16 buckets, 17 goes to bucket 1 and 2 to bucket 2: <code>[17, 2]</code>. The 13th entry exceeds the threshold of 12, so the table doubles to 32. Now 17 sits in bucket 17, while 2 stays in bucket 2 and 100–110 land in buckets 4–14. The first key is now <b>2</b>. A resize reordered keys you never touched.' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] a) {
        List<Integer> key = new ArrayList<>(List.of(1, 2));
        Map<List<Integer>, String> m = new HashMap<>();
        m.put(key, "v");
        key.add(3);
        System.out.println(m.get(key) + " " + m.get(List.of(1, 2)) + " " + m.size());
    }
}`, options: ['v v 1', 'v null 1', 'null v 1', 'null null 1'], answer: 3, run: true, expect: 'null null 1', explain: '<code>get(key)</code> hashes [1, 2, 3], which picks another bucket, so <code>null</code>. <code>get(List.of(1, 2))</code> finds the right bucket and the stored hash matches, but <code>equals</code> compares against the <i>mutated</i> key [1, 2, 3], so also <code>null</code>. The entry is still there: size 1. It is now unreachable by lookup.' },
    { kind: 'predict', q: 'Single thread. What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] a) {
        Map<Integer, String> m = new HashMap<>();
        for (int i = 0; i < 4; i++) m.put(i, "v" + i);
        try {
            for (Integer k : m.keySet()) if (k == 3) m.remove(k);
            System.out.println("ok " + m.size());
        } catch (ConcurrentModificationException e) {
            System.out.println("CME");
        }
    }
}`, options: ['CME', 'ok 3', 'ok 4', 'It depends on timing'], answer: 1, run: true, expect: 'ok 3', explain: 'Keys iterate as 0, 1, 2, 3. When <code>next()</code> returns 3, the iterator’s <code>next</code> pointer is already <code>null</code>. After the remove, <code>hasNext()</code> just checks that pointer and returns false, so the modCount check in <code>next()</code> never runs: <b>ok 3</b>. Change the condition to <code>k == 1</code> and it throws CME. Fail-fast is best-effort.' },
    { kind: 'concept', q: 'A HashMap has the default capacity (16). Nine keys with the same <code>hashCode()</code> go in. What happens on the 9th put?', options: ['The bin becomes a red-black tree', 'The table resizes to 32; the bin stays a list', 'An exception: too many collisions', 'Nothing special; the list just gets longer'], answer: 1, explain: 'Reaching 8+ nodes calls <code>treeifyBin</code>, but it first checks <code>MIN_TREEIFY_CAPACITY</code> (64). With fewer buckets it <b>resizes</b> instead, on the theory that the table is just too small. Keys with identical hashes stay together, so the 10th put resizes again (32 → 64) and only the 11th treeifies the bin.' },
    { kind: 'concept', q: 'You will store exactly 1,000 entries. How many resizes does <code>new HashMap&lt;&gt;(1000)</code> do?', options: ['0', '1', '6', '7'], answer: 1, explain: 'The capacity rounds up to 1024 and the threshold is 1024 × 0.75 = 768, so entry 769 doubles the table to 2048: <b>one</b> resize. A default map (16) would double 7 times on the way to 2048 (16 → 32 → … → 2048). <code>HashMap.newHashMap(1000)</code> (Java 19+) does the 0.75 division for you.' },
    { kind: 'concept', q: 'Why does HashMap compute <code>h ^ (h &gt;&gt;&gt; 16)</code> before masking?', options: ['To make hashes non-negative', 'So high bits influence the bucket, because the mask keeps only low bits', 'To randomise iteration order', 'For cryptographic strength against HashDoS'], answer: 1, explain: 'With n buckets, <code>(n − 1) &amp; h</code> keeps only the low log₂n bits. Hash codes that differ only in high bits (common with floats, or ids shifted left) would all collide. XOR-ing the top half into the bottom half is a cheap fix. It isn’t a defence against attacks; treeification is the mitigation for that.' }
  ],
  interview: [
    { q: 'Walk me through <code>put(k, v)</code> in a Java 8+ HashMap.', a: '<ol><li>If the table is null, allocate it (16 buckets by default).</li><li><code>hash = h ^ (h &gt;&gt;&gt; 16)</code>, <code>i = (n − 1) &amp; hash</code>.</li><li>Empty bucket: store a new node. Otherwise walk the bin: if a node has the same hash and <code>equals</code> the key, replace its value and return the old one.</li><li>No match: append at the tail (or insert into the tree). If the list reaches 8, treeify (or resize when n &lt; 64).</li><li><code>modCount++</code>; if <code>++size &gt; threshold</code>, resize.</li></ol>', fu: 'What does <code>put</code> return? (The previous value, or null; so null is ambiguous if null values are allowed.)', lvl: 'core' },
    { q: 'Why is the capacity always a power of two?', a: '<p>So the bucket index is a bit mask (<code>hash &amp; (n − 1)</code>) instead of a modulo, and so a resize can split each bin with one bit test: <code>hash &amp; oldCap</code> is 0 → same index, 1 → index + oldCap. The cost is that only low bits pick the bucket, which is why the hash is spread first.</p>', lvl: 'core' },
    { q: 'What happens during a resize?', a: '<p>A new array twice as long is allocated. Each bin is split into a “lo” list (stays at <i>i</i>) and a “hi” list (moves to <i>i + oldCap</i>), preserving relative order. Tree bins are split the same way and untreeified if a half drops to 6 or fewer nodes. It is O(n) and done by the thread that triggered it, which is why pre-sizing matters on hot paths.</p>', lvl: 'deep' },
    { q: 'When is a bucket treeified, and why does the 64 threshold exist?', a: '<p>When a bin reaches 8 nodes (TREEIFY_THRESHOLD) and the table has at least 64 buckets. Below 64, a long bin is more likely to mean “table too small” than “bad hash”, so HashMap resizes. Trees use about twice the memory of list nodes and are rare in practice. With a good hash, the chance of a bin reaching 8 is tiny at load factor 0.75.</p>', fu: 'How does a tree order keys that aren’t Comparable? (By hash, then a tie-break on class name and identityHashCode. Lookups among equal hashes may have to search both subtrees.)', lvl: 'deep' },
    { q: 'HashMap vs Hashtable vs ConcurrentHashMap vs Collections.synchronizedMap?', a: '<ul><li><b>HashMap</b>: not thread-safe; allows one null key and null values.</li><li><b>Hashtable</b>: legacy; every method synchronized; no nulls.</li><li><b>synchronizedMap</b>: one lock around a HashMap; you must lock manually while iterating.</li><li><b>ConcurrentHashMap</b>: lock-free reads, per-bin locking on writes, atomic <code>compute*</code>/<code>merge</code>, weakly consistent iterators, no nulls.</li></ul>', lvl: 'core' },
    { q: 'Why does ConcurrentModificationException happen on a single thread?', a: '<p>“Concurrent” means “during iteration”, not “from another thread”. HashMap counts structural changes in <code>modCount</code>. The iterator snapshots it and checks on each <code>next()</code>. Any change not made through that iterator causes the mismatch. It is best-effort and isn’t a thread-safety mechanism.</p>', fu: 'Does <code>put</code> of an existing key cause CME? (No. Replacing a value is not a structural change, so modCount doesn’t move.)', lvl: 'core' },
    { q: 'Is HashMap iteration order stable?', a: '<p>Within one JVM, for the same insertion history and capacity, it is deterministic: bucket order, then chain order. But it isn’t specified. It changes with capacity, resizes, and hash function changes between JDK versions. <code>Map.of</code> randomises it per JVM run. <code>LinkedHashMap</code> guarantees insertion (or access) order; <code>TreeMap</code> guarantees sorted order. Java 21 added <code>SequencedMap</code> to name that guarantee in the type.</p>', lvl: 'core' },
    { q: 'What is the time complexity of get and put?', a: '<p>Average O(1), assuming a decent hash and the 0.75 load factor. A single bin costs O(1) as a list of a few nodes, or O(log n) as a tree when keys are Comparable. Resize is O(n) but amortised O(1) per insert. A degenerate hash with non-Comparable keys can still give O(n) per lookup.</p>', lvl: 'core' },
    { q: 'What changed in HashMap between Java 7 and Java 8?', a: '<ul><li>Treeified bins for long collision chains (JEP 180), mainly as a HashDoS mitigation.</li><li>Tail insertion and an order-preserving lo/hi split on resize, which removed the infinite-loop failure mode under (still illegal) concurrent use.</li><li>A simpler hash spread (one XOR with the high half).</li><li>New default methods: <code>compute</code>, <code>merge</code>, <code>getOrDefault</code>, <code>putIfAbsent</code>, <code>forEach</code>, <code>replaceAll</code>.</li></ul>', lvl: 'deep' },
    { q: 'How much memory does a HashMap entry cost?', a: '<p>On a 64-bit HotSpot with compressed oops (the default below ~32 GB of heap), a <code>HashMap.Node</code> is 32 bytes: a 12-byte header plus hash, key, value and next. Add the 4-byte array slot, plus the key and value objects (a boxed <code>Integer</code> is 16 bytes). A <code>TreeNode</code> is roughly twice the size of a node. For millions of primitive keys, consider a primitive map (Eclipse Collections, fastutil).</p>', fu: 'How would you measure it? (JOL’s GraphLayout, or a heap histogram: <code>jcmd &lt;pid&gt; GC.class_histogram</code>.)', lvl: 'deep' }
  ],
  code: [
    { title: 'Pre-size, count, group', lang: 'java', code: `// Java 19+: sized for 'expected' entries, no resizes
Map<String, Order> byId = HashMap.newHashMap(orders.size());
for (Order o : orders) byId.put(o.id(), o);

// counting without get/put races or null checks
Map<String, Integer> hits = new HashMap<>();
for (String path : paths) hits.merge(path, 1, Integer::sum);

// multimap
Map<String, List<Order>> byCustomer = new HashMap<>();
for (Order o : orders)
    byCustomer.computeIfAbsent(o.customerId(), k -> new ArrayList<>()).add(o);`, note: 'Don’t modify the same map from inside the <code>computeIfAbsent</code> function. Since Java 9, HashMap throws <code>ConcurrentModificationException</code> when it detects that.' },
    { title: 'Bounded LRU with LinkedHashMap', lang: 'java', code: `final class Lru<K, V> extends LinkedHashMap<K, V> {
    private final int max;
    Lru(int max) {
        super(16, 0.75f, true);          // accessOrder = true: get() moves an entry to the end
        this.max = max;
    }
    @Override protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > max;             // evict the least recently used
    }
}
// not thread-safe: wrap with Collections.synchronizedMap, or use Caffeine in services`, note: 'In an access-ordered LinkedHashMap, <code>get</code> is a structural change: iterating while calling <code>get</code> throws CME.' },
    { title: 'Safe keys and safe removal', lang: 'java', code: `// immutable value-based key: equals/hashCode generated from all components
record CacheKey(String tenant, String sku, Locale locale) {}

Map<CacheKey, Price> prices = new ConcurrentHashMap<>();

// bulk removal without CME
sessions.values().removeIf(s -> s.expiresAt().isBefore(Instant.now()));
sessions.entrySet().removeIf(e -> e.getKey().startsWith("tmp:"));`, note: 'Records are only as immutable as their components. A <code>record Key(List&lt;String&gt; parts)</code> needs <code>List.copyOf</code> in a compact constructor.' }
  ]
});

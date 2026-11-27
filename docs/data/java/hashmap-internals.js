IA.register({
  track: 'java',
  slug: 'hashmap-internals',
  title: 'HashMap internals',
  tagline: 'A <code>HashMap</code> is an <b>array of slots</b> (<i>buckets</i>). The hash picks the bucket. <code>equals</code> picks the entry. A resize moves half the entries. Once you see that array, the odd behaviours make sense: iteration order, changed keys, trees in buckets, and <code>ConcurrentModificationException</code>.',
  tldr: {
    problem: 'HashMap bugs rarely crash. They return <code>null</code> for a key you just put. They change the loop order after a deploy. They burn CPU on one overfull bucket. Or they throw <code>ConcurrentModificationException</code> on a single thread.',
    model: '<code>index = (n − 1) &amp; (h ^ (h &gt;&gt;&gt; 16))</code> picks one of <i>n</i> buckets. n is a power of two. Entries in the same bucket form a list. A long list becomes a red-black tree. When <code>size &gt; 0.75 × n</code>, the table doubles. Each entry either stays at <i>i</i> or moves to <i>i + oldN</i>.',
    hook: '“What happens if you mutate a key after putting it?” The entry stays in the bucket of its <i>old</i> hash. <code>get</code> looks in the wrong bucket and returns <code>null</code>. Yet <code>size()</code> still counts it.',
    facts: [
      { v: '16 × 0.75', l: 'default capacity and load factor. The 13th entry triggers the first resize. The array itself is created on the first <code>put</code>' },
      { v: '8 / 64 / 6', l: 'a bucket becomes a red-black tree at 8 entries, but only if the table has ≥ 64 buckets. Otherwise it resizes. It turns back into a list at ≤ 6' },
      { v: 'Java 8', l: 'added trees in long buckets and adding at the end. Java 7 added at the front, and two threads resizing could create a loop that spun a thread forever' }
    ]
  },
  intro: {
    what: 'A <b>map</b> stores <i>key → value</i> pairs, like “user id → user”. <code>HashMap</code> finds a key fast, without scanning everything. It turns the key into a number (its <b>hash code</b>). That number picks one slot in an internal array, and the pair goes there. To find it again, it computes the same number and looks in the same slot.',
    analogy: { icon: '📮', title: 'Pigeonholes in a mail room', text: 'A mail room has 16 pigeonholes. The clerk files each letter by a quick rule on the surname, say the last digit of a code. So finding a letter means checking one hole, not the whole room. Two surnames can share a hole, so the clerk still reads each name in it. When the holes get too full, the clerk builds a wall twice as big and re-sorts. Rename a letter after filing it, and the clerk looks in the wrong hole: “no such letter”.' },
    steps: [
      { t: 'The key becomes a number', d: 'Every object has <code>hashCode()</code>. For an <code>Integer</code> it is the value itself. For a <code>String</code> it is computed from the characters.', code: '"cat".hashCode()   // 98262\nInteger.valueOf(42).hashCode()   // 42' },
      { t: 'The number picks a bucket', d: 'HashMap mixes the high bits into the low bits. Then it keeps only the low bits it needs: with 16 buckets, the last 4.', code: 'int h = key.hashCode();\nint index = (h ^ (h >>> 16)) & (16 - 1);' },
      { t: 'Collisions are normal', d: 'Two keys can land in the same bucket. HashMap keeps a small list there and uses <code>equals()</code> to find the right one. That is why <code>equals</code> and <code>hashCode</code> must agree.' },
      { t: 'It grows by doubling', d: 'When the map is 75% full, it doubles the array and spreads the entries out again. That keeps buckets short and lookups O(1) on average.' }
    ],
    terms: [
      ['bucket / bin', 'One slot of the internal array. It holds zero, one or several entries.'],
      ['collision', 'Two different keys in the same bucket. Normal, and handled with a list or tree.'],
      ['load factor', 'How full the map may get (size ÷ buckets) before it doubles. Default 0.75.'],
      ['capacity', 'Number of buckets. Always a power of two in HashMap.'],
      ['treeify', 'Turning a long bucket list into a red-black tree (<i>treeify</i>). Then a bad bucket costs O(log n), not O(n).'],
      ['fail-fast iterator', 'An iterator that throws <code>ConcurrentModificationException</code> if the map changed behind its back.']
    ]
  },
  visual: {
    title: 'Watch keys land, collide, resize and treeify',
    caption: 'Pick a scenario and press Play (or Step). <b>put & resize</b> shows the index maths and the lo/hi split. <b>collisions → tree</b> uses a <code>hashCode()</code> that never changes. The two loop scenarios show why <code>map.remove</code> inside a for-each throws, and <code>iterator.remove()</code> doesn’t.'
  },
  gotchas: [
    { trap: 'Mutating a key after it is in the map', code: `List<Integer> key = new ArrayList<>(List.of(1, 2));
map.put(key, "v");
key.add(3);
map.get(key);          // null: wrong bucket
map.containsKey(key);  // false, yet map.size() == 1`, why: 'The entry keeps the hash from <code>put</code> time and sits in that bucket. A new hash sends <code>get</code> to a different bucket. Even in the same bucket, the saved-hash check fails.', fix: 'Use keys that can’t change: <code>String</code>, boxed primitives, <code>record</code>s of fixed fields, <code>List.copyOf</code>. Never use JPA entities as keys if their hash uses a generated id.' },
    { trap: 'Overriding equals but not hashCode', code: `class Sku { String code;
  @Override public boolean equals(Object o) { … }   // no hashCode()
}
set.add(new Sku("A1")); set.add(new Sku("A1"));   // size 2`, why: 'The default <code>hashCode</code> is tied to the object, not its fields. So equal objects usually land in different buckets, and <code>equals</code> is never even called.', fix: 'Always override both, or use a <code>record</code>. See <a href="equals-hashcode.html">equals & hashCode</a>.' },
    { trap: 'Relying on HashMap iteration order', why: 'Order depends on hash values and capacity. It changes after a resize, with a different starting size, or when a JDK changes a <code>hashCode</code>. <code>Map.of</code>/<code>Set.of</code> go further: their order is <b>random per JVM run</b>.', fix: 'If order matters, say so in the type: <code>LinkedHashMap</code> (insertion or access order) or <code>TreeMap</code> (sorted). In tests, compare maps with <code>equals</code>, not <code>toString()</code>.' },
    { trap: '<code>new HashMap&lt;&gt;(n)</code> is a capacity, not an expected size', code: `new HashMap<>(1000)        // 1024 buckets, threshold 768 → resizes at entry 769
HashMap.newHashMap(1000)   // Java 19+: sized so 1000 entries fit without resizing`, why: 'The number is rounded up to a power of two. Times 0.75 gives the resize point.', fix: 'On Java 19+, use <code>HashMap.newHashMap(expected)</code> (also <code>LinkedHashMap.newLinkedHashMap</code>, <code>HashSet.newHashSet</code>). Before that, pass <code>(int) (expected / 0.75f) + 1</code>.' },
    { trap: 'Removing inside a for-each loop', code: `for (String k : map.keySet())
    if (k.startsWith("tmp")) map.remove(k);   // CME, sometimes`, why: 'The for-each uses an iterator that checks for changes (<i>fail-fast</i>). <code>map.remove</code> bumps <code>modCount</code>. The next <code>next()</code> sees the mismatch and throws. If you removed the last key, the loop just ends. That hides the bug in tests.', fix: '<code>map.keySet().removeIf(k -&gt; k.startsWith("tmp"))</code>, <code>map.entrySet().removeIf(…)</code>, or an explicit <code>Iterator</code> with <code>it.remove()</code>.' },
    { trap: 'Sharing a HashMap between threads', why: 'HashMap has no locking. Puts from many threads lose entries, and <code>size</code> drifts. Two resizes at once can break buckets. On Java 7 that could form a loop, so a <code>get</code> spun at 100% CPU forever. Java 8+ avoids the loop but is still unsafe.', fix: 'Use <a href="concurrent-collections.html">ConcurrentHashMap</a>. Or share a map that can’t change (<code>Map.copyOf</code>) and swap in a whole new one.' },
    { trap: 'A weak hashCode makes one bucket do all the work', why: 'Many keys may share a hash: a constant, or a <code>hashCode</code> built from a field with few values. Then they pile into one bucket. Turning it into a tree limits the damage to O(log n). But only if the keys are <code>Comparable</code>. Otherwise lookups may still scan the whole tree.', fix: 'Hash every field that <code>equals</code> uses (<code>Objects.hash</code>, or a record). If keys come from untrusted input, make them <code>Comparable</code> (String is).' }
  ],
  scenarios: [
    { title: 'All request threads stuck at 100% CPU inside HashMap.get',
      symptom: 'An older service on Java 7 slowly gets slower until every worker is busy. CPU is at 100%. There are no errors in the logs.',
      diagnose: `jstack <pid> | grep -A6 '"http-nio'
# "http-nio-8080-exec-17" RUNNABLE
#    at java.util.HashMap.get(HashMap.java:…)
#    at com.acme.pricing.RateCache.lookup(…)`,
      cause: 'Several threads wrote to a <code>static HashMap</code> used as a cache. Two threads resized it at once. Java 7’s resize reversed a chain and linked it into a loop. Any <code>get</code> on that bucket loops forever.',
      fix: 'Switch to <code>ConcurrentHashMap</code> (or Caffeine for a real cache). A newer JDK removes the endless loop, but not the lost updates. So changing the type is the real fix.',
      fixCode: `private static final Map<String, Rate> RATES = new ConcurrentHashMap<>();

Rate lookup(String key) {
    return RATES.computeIfAbsent(key, this::loadRate);   // atomic per key
}` },
    { title: 'Snapshot tests fail after a “no-op” refactor',
      symptom: 'A change only replaced <code>new HashMap&lt;&gt;()</code> with <code>Map.of(…)</code> for constants. Then JSON snapshot tests and one partner integration broke. Locally, the tests pass on some runs and fail on others.',
      diagnose: `// same JVM: stable; across JVM runs: different
System.out.println(Map.of("a", 1, "b", 2, "c", 3));
// run 1: {c=3, b=2, a=1}   run 2: {a=1, c=3, b=2}   (example)`,
      cause: '<code>Map.of</code> collections shuffle their order per JVM run on purpose. That flushes out code that depends on order. The serializer wrote fields in map order, and the partner read them by position.',
      fix: 'Where order is part of a contract, make it explicit: a <code>LinkedHashMap</code>, a <code>TreeMap</code>, or Jackson’s <code>ORDER_MAP_ENTRIES_BY_KEYS</code>. In tests, compare JSON by meaning, not as text.',
      fixCode: `@Bean
Jackson2ObjectMapperBuilderCustomizer sortedMaps() {
    return b -> b.featuresToEnable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
}` },
    { title: 'A nightly reconciliation job became quadratic',
      symptom: 'A batch removes duplicates from ~200k order entities with a <code>HashSet</code>. It used to take seconds. Now it takes over an hour. A profiler shows most time in <code>HashMap.putVal</code> and <code>TreeNode.find</code>.',
      diagnose: `// entity equals/hashCode recently "fixed" for JPA:
@Override public int hashCode() { return getClass().hashCode(); }   // constant!`,
      cause: 'A constant <code>hashCode</code> is common JPA advice. It is fine for small collections. Here it put all 200k entities in one bucket. They aren’t <code>Comparable</code>, so even the tree falls back to scanning. Each insert costs O(n).',
      fix: 'Remove duplicates by a business key, not the entity. Collect into a <code>Map&lt;String, Order&gt;</code> keyed by the order number, which never changes.',
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
}`, options: ['[1, 2, 17, 33]', '[17, 1, 33, 2]', '[33, 1, 17, 2]', 'Order is random on each run'], answer: 1, run: true, expect: '[17, 1, 33, 2]', explain: 'With 16 buckets, 17, 1 and 33 have the same low 4 bits (0001). So they share <b>bucket 1</b>, in insertion order (Java 8+ adds at the end). 2 is in bucket 2. Iteration goes bucket by bucket: <b>[17, 1, 33, 2]</b>. Java 7 inserted at the head and would print [33, 1, 17, 2]. It is deterministic, but it is not a promise.' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] a) {
        Map<Integer, Integer> m = new HashMap<>();
        m.put(17, 0); m.put(2, 0);
        String before = m.keySet().toString();
        for (int i = 100; i < 111; i++) m.put(i, 0);   // 13 entries in total
        System.out.println(before + " " + m.keySet().iterator().next());
    }
}`, options: ['[17, 2] 17', '[17, 2] 2', '[2, 17] 2', '[17, 2] 100'], answer: 1, run: true, expect: '[17, 2] 2', explain: 'At 16 buckets, 17 goes to bucket 1 and 2 to bucket 2: <code>[17, 2]</code>. The 13th entry passes the limit of 12, so the table doubles to 32. Now 17 sits in bucket 17. 2 stays in bucket 2, and 100–110 land in buckets 4–14. The first key is now <b>2</b>. A resize reordered keys you never touched.' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] a) {
        List<Integer> key = new ArrayList<>(List.of(1, 2));
        Map<List<Integer>, String> m = new HashMap<>();
        m.put(key, "v");
        key.add(3);
        System.out.println(m.get(key) + " " + m.get(List.of(1, 2)) + " " + m.size());
    }
}`, options: ['v v 1', 'v null 1', 'null v 1', 'null null 1'], answer: 3, run: true, expect: 'null null 1', explain: '<code>get(key)</code> hashes [1, 2, 3], which picks another bucket: <code>null</code>. <code>get(List.of(1, 2))</code> finds the right bucket, and the saved hash matches. But <code>equals</code> compares against the <i>changed</i> key [1, 2, 3]: also <code>null</code>. The entry is still there: size 1. No lookup can reach it now.' },
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
}`, options: ['CME', 'ok 3', 'ok 4', 'It depends on timing'], answer: 1, run: true, expect: 'ok 3', explain: 'Keys come out as 0, 1, 2, 3. When <code>next()</code> returns 3, the iterator’s <code>next</code> pointer is already <code>null</code>. After the remove, <code>hasNext()</code> checks only that pointer and returns false. So the modCount check in <code>next()</code> never runs: <b>ok 3</b>. Change the condition to <code>k == 1</code> and it throws CME. The check is best-effort.' },
    { kind: 'concept', q: 'A HashMap has the default capacity (16). Nine keys with the same <code>hashCode()</code> go in. What happens on the 9th put?', options: ['The bin becomes a red-black tree', 'The table resizes to 32; the bin stays a list', 'An exception: too many collisions', 'Nothing special; the list just gets longer'], answer: 1, explain: 'At 8+ entries, <code>treeifyBin</code> runs. But it first checks <code>MIN_TREEIFY_CAPACITY</code> (64). With fewer buckets, it <b>resizes</b> instead, guessing the table is just too small. Keys with identical hashes stay together, so the 10th put resizes again (32 → 64) and only the 11th treeifies the bin.' },
    { kind: 'concept', q: 'You will store exactly 1,000 entries. How many resizes does <code>new HashMap&lt;&gt;(1000)</code> do?', options: ['0', '1', '6', '7'], answer: 1, explain: 'The capacity rounds up to 1024. The resize point is 1024 × 0.75 = 768. So entry 769 doubles the table to 2048: <b>one</b> resize. A default map (16) would double 7 times to reach 2048 (16 → 32 → … → 2048). <code>HashMap.newHashMap(1000)</code> (Java 19+) does the 0.75 division for you.' },
    { kind: 'concept', q: 'Why does HashMap compute <code>h ^ (h &gt;&gt;&gt; 16)</code> before masking?', options: ['To make hashes non-negative', 'So high bits influence the bucket, because the mask keeps only low bits', 'To randomise iteration order', 'For cryptographic strength against HashDoS'], answer: 1, explain: 'With n buckets, <code>(n − 1) &amp; h</code> keeps only the low log₂n bits. Hash codes that differ only in high bits would all collide. That is common with floats, or ids shifted left. Mixing the top half into the bottom half is a cheap fix. It doesn’t stop attacks; the trees do that.' }
  ],
  interview: [
    { q: 'Walk me through <code>put(k, v)</code> in a Java 8+ HashMap.', a: '<ol><li>If the table is null, allocate it (16 buckets by default).</li><li><code>hash = h ^ (h &gt;&gt;&gt; 16)</code>, <code>i = (n − 1) &amp; hash</code>.</li><li>Empty bucket: store a new entry. Otherwise walk the bucket. If an entry has the same hash and <code>equals</code> the key, replace its value and return the old one.</li><li>No match: add at the end (or into the tree). If the list reaches 8, make it a tree (or resize when n &lt; 64).</li><li><code>modCount++</code>. If <code>++size &gt; threshold</code>, resize.</li></ol>', fu: 'What does <code>put</code> return? (The old value, or null. So null is unclear when null values are allowed.)', lvl: 'core' },
    { q: 'Why is the capacity always a power of two?', a: '<p>Then the bucket index is a cheap bit mask (<code>hash &amp; (n − 1)</code>), not a division. A resize can split each bucket with one bit test: <code>hash &amp; oldCap</code> is 0 → same index, 1 → index + oldCap. The cost: only low bits pick the bucket. That is why the hash is mixed first.</p>', lvl: 'core' },
    { q: 'What happens during a resize?', a: '<p>It makes a new array twice as long. Each bucket splits into a “lo” list (stays at <i>i</i>) and a “hi” list (moves to <i>i + oldCap</i>). Order is kept. Tree buckets split the same way, and turn back into lists at 6 or fewer entries. It is O(n), done by the thread that triggered it. So sizing the map up front matters on hot paths.</p>', lvl: 'deep' },
    { q: 'When is a bucket treeified, and why does the 64 threshold exist?', a: '<p>When a bucket reaches 8 entries (TREEIFY_THRESHOLD) and the table has at least 64 buckets. Below 64, a long bucket more likely means “table too small” than “bad hash”. So HashMap resizes. Trees use about twice the memory of list nodes and are rare in practice. With a good hash, the chance of a bin reaching 8 is tiny at load factor 0.75.</p>', fu: 'How does a tree order keys that aren’t Comparable? (By hash, then by class name and identityHashCode to break ties. Lookups among equal hashes may search both sides.)', lvl: 'deep' },
    { q: 'HashMap vs Hashtable vs ConcurrentHashMap vs Collections.synchronizedMap?', a: '<ul><li><b>HashMap</b>: not thread-safe. Allows one null key and null values.</li><li><b>Hashtable</b>: old. Every method takes a lock. No nulls.</li><li><b>synchronizedMap</b>: one lock around a HashMap. You must lock it yourself while looping.</li><li><b>ConcurrentHashMap</b>: reads take no lock, writes lock one bucket. One-step <code>compute*</code>/<code>merge</code>. Iterators cope with changes. No nulls.</li></ul>', lvl: 'core' },
    { q: 'Why does ConcurrentModificationException happen on a single thread?', a: '<p>“Concurrent” means “during the loop”, not “from another thread”. HashMap counts changes in <code>modCount</code>. The iterator saves that number and checks it on each <code>next()</code>. Any change not made through the iterator causes a mismatch. It is best-effort, not a thread-safety tool.</p>', fu: 'Does <code>put</code> of an existing key cause CME? (No. Replacing a value doesn’t add or remove entries, so modCount stays.)', lvl: 'core' },
    { q: 'Is HashMap iteration order stable?', a: '<p>In one JVM, with the same inserts and capacity, it repeats: bucket order, then list order. But Java doesn’t promise it. It changes with capacity, resizes, and hash changes between JDK versions. <code>Map.of</code> shuffles it per JVM run. <code>LinkedHashMap</code> promises insertion (or access) order. <code>TreeMap</code> promises sorted order. Java 21 added <code>SequencedMap</code> to name that promise in the type.</p>', lvl: 'core' },
    { q: 'What is the time complexity of get and put?', a: '<p>O(1) on average, with a decent hash and the 0.75 load factor. One bucket costs O(1) as a short list, or O(log n) as a tree when keys are Comparable. A resize is O(n), but O(1) per insert on average. A very bad hash with non-Comparable keys can still cost O(n) per lookup.</p>', lvl: 'core' },
    { q: 'What changed in HashMap between Java 7 and Java 8?', a: '<ul><li>Trees for long bucket lists, mainly to blunt hash-flooding attacks.</li><li>Adding at the end, and an order-keeping lo/hi split on resize. That removed the endless loop under use from many threads (which is still wrong).</li><li>A simpler hash spread (one XOR with the high half).</li><li>New default methods: <code>compute</code>, <code>merge</code>, <code>getOrDefault</code>, <code>putIfAbsent</code>, <code>forEach</code>, <code>replaceAll</code>.</li></ul>', lvl: 'deep' },
    { q: 'How much memory does a HashMap entry cost?', a: '<p>On 64-bit HotSpot with compressed pointers (the default below ~32 GB of heap), a <code>HashMap.Node</code> is 32 bytes. That is a 12-byte header plus hash, key, value and next. Add the 4-byte array slot, plus the key and value objects (a boxed <code>Integer</code> is 16 bytes). A <code>TreeNode</code> is about twice that size. For millions of primitive keys, consider a primitive map (Eclipse Collections, fastutil).</p>', fu: 'How would you measure it? (JOL’s GraphLayout, or a heap histogram: <code>jcmd &lt;pid&gt; GC.class_histogram</code>.)', lvl: 'deep' }
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
    byCustomer.computeIfAbsent(o.customerId(), k -> new ArrayList<>()).add(o);`, note: 'Don’t change the same map from inside the <code>computeIfAbsent</code> function. Since Java 9, HashMap throws <code>ConcurrentModificationException</code> when it sees that.' },
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
// not thread-safe: wrap with Collections.synchronizedMap, or use Caffeine in services`, note: 'In an access-ordered LinkedHashMap, <code>get</code> moves the entry. So calling <code>get</code> while looping throws CME.' },
    { title: 'Safe keys and safe removal', lang: 'java', code: `// immutable value-based key: equals/hashCode generated from all components
record CacheKey(String tenant, String sku, Locale locale) {}

Map<CacheKey, Price> prices = new ConcurrentHashMap<>();

// bulk removal without CME
sessions.values().removeIf(s -> s.expiresAt().isBefore(Instant.now()));
sessions.entrySet().removeIf(e -> e.getKey().startsWith("tmp:"));`, note: 'A record is only as fixed as its fields. A <code>record Key(List&lt;String&gt; parts)</code> needs <code>List.copyOf</code> in a compact constructor.' }
  ]
});

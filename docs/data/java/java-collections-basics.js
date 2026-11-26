IA.register({
  track: 'java',
  slug: 'java-collections-basics',
  title: 'Collections basics',
  tagline: 'Three interfaces cover most everyday code: <b>List</b> (ordered, indexed, duplicates allowed), <b>Set</b> (no duplicates) and <b>Map</b> (key → value). Declare the interface, pick an implementation (<code>ArrayList</code>, <code>HashSet</code>, <code>HashMap</code>), and know which collections are <b>unmodifiable</b> (<code>List.of</code>) before you call <code>add</code>.',
  tldr: {
    problem: 'Beginners call <code>add</code> on <code>List.of(...)</code> and get <code>UnsupportedOperationException</code>, remove from a list inside a for-each loop, call <code>remove(1)</code> on a <code>List&lt;Integer&gt;</code> expecting the value 1, and assume a <code>HashMap</code> keeps insertion order.',
    model: '<code>List</code> = numbered shelf. <code>Set</code> = bag that refuses duplicates (by <code>equals</code>). <code>Map</code> = dictionary of unique keys. <code>ArrayList</code> is a growable array; <code>HashSet</code>/<code>HashMap</code> find items by <code>hashCode</code> then <code>equals</code> in about O(1).',
    hook: '“How do you iterate a map?” <code>for (var e : map.entrySet())</code> gives key and value together. “How do you remove while iterating?” <code>removeIf</code> or <code>Iterator.remove()</code>, never <code>list.remove</code> inside a for-each.',
    facts: [
      { v: 'Java 9', l: 'added <code>List.of</code>, <code>Set.of</code> and <code>Map.of</code>: unmodifiable, and they reject <code>null</code> elements, keys and values' },
      { v: 'null', l: 'is what <code>map.get(k)</code> returns for a missing key; use <code>getOrDefault</code> or <code>containsKey</code> when <code>null</code> could be a value' },
      { v: 'no order', l: 'is promised by <code>HashMap</code>/<code>HashSet</code>. <code>LinkedHashMap</code> keeps insertion order; <code>TreeMap</code> keeps keys sorted' }
    ]
  },
  intro: {
    what: 'A <b>collection</b> is an object that holds other objects. Instead of a fixed-size array you use a <code>List</code> that grows, a <code>Set</code> that keeps only unique items, or a <code>Map</code> that looks values up by key. They live in <code>java.util</code>. You usually declare the variable with the interface (<code>List</code>) and create a specific class (<code>ArrayList</code>), so you can swap the implementation later. Collections hold objects only, so <code>int</code> values are stored as <code>Integer</code> (autoboxing).',
    analogy: { icon: '🗂️', title: 'Shelf, bag and address book', text: 'A <b>List</b> is a numbered shelf: items stay in the order you put them, and you can fetch “slot 3”. A <b>Set</b> is a bag of name badges where a second identical badge is just ignored. A <b>Map</b> is an address book: look up a name (key) to get an address (value); writing the same name again overwrites the old address.' },
    steps: [
      { t: 'Make a list', d: 'Interface on the left, implementation on the right. <code>&lt;&gt;</code> infers the type.', code: 'List<String> names = new ArrayList<>();\nnames.add("Ann");\nnames.add("Bo");\nnames.get(0);      // "Ann"\nnames.size();      // 2' },
      { t: 'Use a set for uniqueness', d: '<code>add</code> returns <code>false</code> if the item was already there.', code: 'Set<String> tags = new HashSet<>();\ntags.add("java");\ntags.add("java");   // false, still 1 element\ntags.contains("java");' },
      { t: 'Use a map for lookups', d: '<code>put</code> adds or replaces; <code>get</code> returns <code>null</code> if absent.', code: 'Map<String, Integer> age = new HashMap<>();\nage.put("Ann", 31);\nage.get("Ann");               // 31\nage.getOrDefault("Zed", 0);   // 0' },
      { t: 'Loop over them', d: 'The enhanced for loop works on any collection. For maps, loop over entries.', code: 'for (String n : names) System.out.println(n);\nfor (Map.Entry<String, Integer> e : age.entrySet())\n    System.out.println(e.getKey() + "=" + e.getValue());' },
      { t: 'Know what’s read-only', d: '<code>List.of</code> can’t change. Copy it into an <code>ArrayList</code> if you need to.', code: 'List<String> fixed = List.of("a", "b");\n// fixed.add("c");   → UnsupportedOperationException\nList<String> mine = new ArrayList<>(fixed);' }
    ],
    terms: [
      ['List', 'Ordered, index-based, allows duplicates. Main class: <code>ArrayList</code>.'],
      ['Set', 'No duplicates (by <code>equals</code>). Main class: <code>HashSet</code>.'],
      ['Map', 'Unique keys to values. Main class: <code>HashMap</code>. Not a <code>Collection</code> itself.'],
      ['generics', '<code>List&lt;String&gt;</code>: the type in angle brackets says what the collection holds.'],
      ['autoboxing', 'Automatic conversion between <code>int</code> and <code>Integer</code> when you put numbers in a collection.'],
      ['unmodifiable', 'A collection whose methods like <code>add</code> throw <code>UnsupportedOperationException</code>.']
    ]
  },
  visual: {
    title: 'ArrayList, HashMap, HashSet, iteration and List.of',
    caption: 'Pick a scenario and press <b>Play</b> or <b>Step</b>. Watch an <code>ArrayList</code> shift elements on insert and remove, a <code>HashMap</code> replace a value for an existing key, a <code>HashSet</code> refuse a duplicate, a for-each loop fail when you remove inside it, and <code>List.of</code> refuse changes.'
  },
  gotchas: [
    { trap: 'Modifying <code>List.of(...)</code>', code: `List<String> roles = List.of("user");
roles.add("admin");   // java.lang.UnsupportedOperationException`, why: '<code>List.of</code>, <code>Set.of</code>, <code>Map.of</code>, <code>List.copyOf</code> and <code>stream().toList()</code> (Java 16+) all return unmodifiable collections. The <code>List</code> type still has <code>add</code>, so it fails only at run time.', fix: 'Use <code>new ArrayList&lt;&gt;(List.of(...))</code> when you need to change it. More in <a href="immutability-records.html">Immutability &amp; records</a>.' },
    { trap: 'Removing inside a for-each loop', code: `for (String s : list) {
    if (s.isBlank()) list.remove(s);   // ConcurrentModificationException (usually)
}`, why: 'The loop uses an iterator that detects structural changes it didn’t make and fails fast. Sometimes it doesn’t throw but silently skips an element, which is worse.', fix: '<code>list.removeIf(String::isBlank);</code> or use an explicit <code>Iterator</code> and call <code>it.remove()</code>.' },
    { trap: '<code>remove(1)</code> on a <code>List&lt;Integer&gt;</code>', code: `List<Integer> ids = new ArrayList<>(List.of(5, 1, 7));
ids.remove(1);   // removes index 1 (the value 1) → [5, 7]... by luck
ids.remove(0);   // removes 5, not a value 0`, why: '<code>remove(int index)</code> is an exact match for an <code>int</code> argument, so it wins over <code>remove(Object)</code>.', fix: '<code>ids.remove(Integer.valueOf(x))</code> to remove by value.' },
    { trap: 'Unboxing a missing map value', code: `Map<String, Integer> stock = new HashMap<>();
int n = stock.get("kiwi");   // NullPointerException`, why: '<code>get</code> returns <code>null</code> for a missing key, and unboxing <code>null</code> into <code>int</code> throws.', fix: '<code>stock.getOrDefault("kiwi", 0)</code>, or count with <code>stock.merge(k, 1, Integer::sum)</code>.' },
    { trap: 'Relying on <code>HashMap</code> or <code>HashSet</code> order', code: `Map<String, Integer> m = new HashMap<>();
m.put("b", 1); m.put("a", 2); m.put("c", 3);
System.out.println(m);   // order is not specified and can change between JDKs or sizes`, why: 'Hash collections place entries by hash code, not by insertion time.', fix: '<code>LinkedHashMap</code>/<code>LinkedHashSet</code> for insertion order, <code>TreeMap</code>/<code>TreeSet</code> for sorted order.' },
    { trap: 'Using your own class as a key without <code>equals</code>/<code>hashCode</code>', code: `class Sku { String code; Sku(String c) { code = c; } }
Set<Sku> s = new HashSet<>();
s.add(new Sku("A1")); s.add(new Sku("A1"));
s.size();   // 2`, why: 'Without overrides, two objects are equal only if they are the same object.', fix: 'Use a <code>record Sku(String code)</code>, or override both methods. See <a href="equals-hashcode.html">equals &amp; hashCode</a>.' }
  ],
  scenarios: [
    { title: 'Endpoint starts returning 500 after a refactor', symptom: 'After replacing <code>Arrays.asList(...)</code>/<code>new ArrayList</code> with <code>List.of(...)</code> “for readability”, an endpoint fails with <code>UnsupportedOperationException</code> deep inside a helper.', diagnose: 'The stack trace points to <code>ImmutableCollections.uoe</code> from an <code>add</code> in a method that enriches the list before returning it.', cause: 'A helper received the list and mutated it. The old list was mutable; <code>List.of</code> is not. The signature said only <code>List&lt;String&gt;</code>.', fix: 'Don’t mutate collections you were given. Build and return a new one, or copy defensively at the boundary.', fixCode: `// before: mutates its argument
static List<String> withDefaults(List<String> roles) {
    roles.add("user");
    return roles;
}
// after: leaves the input alone
static List<String> withDefaults(List<String> roles) {
    List<String> out = new ArrayList<>(roles);
    out.add("user");
    return List.copyOf(out);
}` },
    { title: 'Nightly cleanup skips records', symptom: 'A job that removes expired sessions from an in-memory list sometimes leaves one expired session behind; no exception is logged.', diagnose: 'The loop calls <code>sessions.remove(s)</code> inside <code>for (Session s : sessions)</code>. When the removed element is the second-to-last, the loop simply ends.', cause: 'After the removal the iterator’s cursor equals the new size, so <code>hasNext()</code> returns false and the last element is never checked. In other positions the same code throws <code>ConcurrentModificationException</code>.', fix: 'Use <code>removeIf</code>, which is correct and clear.', fixCode: `Instant now = Instant.now();
sessions.removeIf(s -> s.expiresAt().isBefore(now));` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Index or value? What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<Integer> list = new ArrayList<>(List.of(10, 20, 30));
        list.remove(1);
        list.remove(Integer.valueOf(10));
        System.out.println(list);
    }
}`, options: ['[30]', '[20, 30]', '[10, 30]', 'IndexOutOfBoundsException'], answer: 0, explain: '<code>remove(1)</code> takes an <code>int</code>, so it removes <b>index</b> 1 (the 20). <code>remove(Integer.valueOf(10))</code> removes the <b>value</b> 10. Left: <code>[30]</code>.', run: true, expect: '[30]' },
    { kind: 'predict', q: 'What does <code>put</code> return? What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Map<String, Integer> m = new HashMap<>();
        System.out.println(m.put("a", 1) + " " + m.put("a", 2) + " " + m.get("a") + " " + m.size());
    }
}`, options: ['null 1 2 1', '1 2 2 2', 'null null 2 1', 'true false 2 1'], answer: 0, explain: '<code>put</code> returns the <b>previous</b> value for the key, or <code>null</code> if there was none. The second put replaces 1 with 2, so the map still has one entry.', run: true, expect: 'null 1 2 1' },
    { kind: 'predict', q: 'Adding the same element twice. What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Set<String> s = new HashSet<>();
        System.out.println(s.add("x") + " " + s.add("x") + " " + s.size());
    }
}`, options: ['true true 2', 'true false 1', 'true true 1', 'false false 0'], answer: 1, explain: '<code>Set.add</code> returns <code>true</code> if the set changed. The duplicate is ignored and returns <code>false</code>.', run: true, expect: 'true false 1' },
    { kind: 'predict', q: '<code>Arrays.asList</code>: set and add. What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<String> v = Arrays.asList("a", "b");
        v.set(0, "z");
        try {
            v.add("c");
        } catch (UnsupportedOperationException e) {
            System.out.print("UOE ");
        }
        System.out.println(v);
    }
}`, options: ['[z, b, c]', 'UOE [a, b]', 'UOE [z, b]', 'UOE'], answer: 2, explain: '<code>Arrays.asList</code> is a fixed-size view over an array: replacing elements with <code>set</code> works, changing the size does not. <code>List.of</code> is stricter: even <code>set</code> throws.', run: true, expect: 'UOE [z, b]' },
    { kind: 'predict', q: 'Removing inside a for-each loop. What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<Integer> nums = new ArrayList<>(List.of(1, 2, 3, 4));
        for (Integer n : nums) {
            if (n == 3) nums.remove(n);
        }
        System.out.println(nums);
    }
}`, options: ['ConcurrentModificationException', '[1, 2, 4]', '[1, 2, 3, 4]', '[1, 2]'], answer: 1, explain: 'Surprise: no exception. After removing 3 (the second-to-last element) the list has size 3 and the iterator’s cursor is also 3, so <code>hasNext()</code> returns false and the loop ends without calling <code>next()</code>, where the check lives. Element 4 is never visited. Remove any other element and you get <code>ConcurrentModificationException</code>. Use <code>removeIf</code>.', run: true, expect: '[1, 2, 4]' },
    { kind: 'predict', q: 'Counting words with <code>merge</code> into a <code>TreeMap</code>. What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Map<String, Integer> counts = new TreeMap<>();
        for (String w : "b a b c b a".split(" ")) {
            counts.merge(w, 1, Integer::sum);
        }
        System.out.println(counts);
    }
}`, options: ['{b=3, a=2, c=1}', '{a=2, b=3, c=1}', '{a=1, b=1, c=1}', 'Order is unpredictable'], answer: 1, explain: '<code>merge</code> puts 1 for a new key, otherwise combines old and new with <code>Integer::sum</code>. A <code>TreeMap</code> keeps keys sorted, so the order is a, b, c.', run: true, expect: '{a=2, b=3, c=1}' },
    { kind: 'predict', q: 'Reading a missing key into an <code>int</code>. What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Map<String, Integer> stock = new HashMap<>(Map.of("apple", 3));
        System.out.print(stock.getOrDefault("kiwi", 0) + " ");
        try {
            int n = stock.get("kiwi");
            System.out.println(n);
        } catch (NullPointerException e) {
            System.out.println("NPE");
        }
    }
}`, options: ['0 0', '0 NPE', '0 null', 'Compile error'], answer: 1, explain: '<code>get</code> returns <code>null</code> for a missing key. Assigning it to an <code>int</code> auto-unboxes, which throws <code>NullPointerException</code>.', run: true, expect: '0 NPE' },
    { kind: 'concept', q: 'You need fast “have I seen this id?” checks and don’t care about order. Which is best?', options: ['<code>ArrayList&lt;Long&gt;</code> with <code>contains</code>', '<code>HashSet&lt;Long&gt;</code>', '<code>TreeMap&lt;Long, Boolean&gt;</code>', '<code>LinkedList&lt;Long&gt;</code>'], answer: 1, explain: '<code>HashSet.contains</code> is about O(1). A list scans every element (O(n)). A <code>TreeSet</code>/<code>TreeMap</code> is O(log n) and only worth it if you need sorted order. More in <a href="choosing-collections.html">Choosing collections</a>.' }
  ],
  interview: [
    { q: 'What is the difference between List, Set and Map?', a: '<ul><li><b>List</b>: ordered by index, allows duplicates (<code>ArrayList</code>, <code>LinkedList</code>).</li><li><b>Set</b>: no duplicates as defined by <code>equals</code> (<code>HashSet</code>, <code>LinkedHashSet</code>, <code>TreeSet</code>).</li><li><b>Map</b>: unique keys mapped to values (<code>HashMap</code>, <code>LinkedHashMap</code>, <code>TreeMap</code>). <code>Map</code> does not extend <code>Collection</code>.</li></ul>', lvl: 'core' },
    { q: 'Why declare <code>List&lt;String&gt; x = new ArrayList&lt;&gt;()</code> instead of <code>ArrayList&lt;String&gt; x</code>?', a: '<p>Programming to the interface keeps callers independent of the implementation. You can switch to another <code>List</code> without changing code that uses it, and method signatures that accept <code>List</code> work with any list, including unmodifiable ones.</p>', lvl: 'core' },
    { q: 'How does an <code>ArrayList</code> work?', a: '<p>It wraps an <code>Object[]</code>. <code>get(i)</code> is O(1). <code>add</code> at the end is amortised O(1): when the array is full it allocates a larger one (about 1.5× in OpenJDK) and copies. Inserting or removing in the middle shifts elements, O(n). It is the default list choice.</p>', fu: 'When is <code>LinkedList</code> better? Rarely in practice; <code>ArrayDeque</code> is usually the better queue.', lvl: 'core' },
    { q: 'How does a <code>HashMap</code> find a key?', a: '<p>It computes <code>key.hashCode()</code>, spreads the bits and picks a bucket, then compares keys in that bucket with <code>equals</code>. That is why key classes must override both consistently, and why a key must not change while it is in the map. Details in <a href="hashmap-internals.html">HashMap internals</a>.</p>', lvl: 'core' },
    { q: '<code>List.of</code> vs <code>Arrays.asList</code> vs <code>Collections.unmodifiableList</code>?', a: '<ul><li><code>List.of</code> (Java 9+): unmodifiable, no <code>null</code>s, independent of any array.</li><li><code>Arrays.asList</code>: fixed-size view over an array; <code>set</code> works and writes through to the array; <code>add</code>/<code>remove</code> throw; allows <code>null</code>.</li><li><code>Collections.unmodifiableList(list)</code>: a read-only <b>view</b>; changes to the underlying list still show through.</li></ul>', fu: 'Want a true snapshot? <code>List.copyOf(list)</code>.', lvl: 'core' },
    { q: 'How do you safely remove elements while iterating?', a: '<p>Use <code>collection.removeIf(predicate)</code>, or an explicit <code>Iterator</code> with <code>it.remove()</code>. Calling <code>list.remove</code> inside a for-each usually throws <code>ConcurrentModificationException</code> (the iterator is fail-fast on a best-effort basis), and can silently skip elements.</p>', lvl: 'core' },
    { q: 'What are the ways to iterate a Map?', a: '<ul><li><code>for (var e : map.entrySet())</code>: key and value, one lookup. Best default.</li><li><code>map.keySet()</code> or <code>map.values()</code> when you need only one side.</li><li><code>map.forEach((k, v) -&gt; …)</code> (Java 8+).</li></ul><p>Looping over <code>keySet()</code> and calling <code>get(k)</code> each time works but does a second lookup per entry.</p>', lvl: 'core' },
    { q: 'Can collections hold primitives? What does that cost?', a: '<p>No; generics need reference types, so <code>int</code> becomes <code>Integer</code> via autoboxing. Each boxed value is an object (except cached small values from <code>Integer.valueOf</code>, by default -128 to 127), and unboxing a <code>null</code> throws NPE. For big numeric data use arrays or primitive streams.</p>', fu: 'Why is <code>==</code> on two <code>Integer</code>s dangerous? It compares references; it happens to work for cached small values and fails for larger ones.', lvl: 'core' },
    { q: 'Are <code>ArrayList</code> and <code>HashMap</code> thread-safe?', a: '<p>No. Concurrent writes can lose updates or corrupt internal state. Use <code>ConcurrentHashMap</code>, <code>CopyOnWriteArrayList</code> or external locking. See <a href="concurrent-collections.html">Concurrent collections</a>.</p>', lvl: 'core' },
    { q: 'Which Map should you pick for ordered output?', a: '<p><code>LinkedHashMap</code> for insertion order (also handy as an LRU cache with access order), <code>TreeMap</code> for keys sorted by natural order or a <code>Comparator</code> (O(log n) operations). <code>HashMap</code> promises no order at all.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Group and count', lang: 'java', code: `// Java 21
record Order(String customer, String sku, int qty) {}

static Map<String, Integer> unitsPerSku(List<Order> orders) {
    Map<String, Integer> units = new TreeMap<>();          // sorted report
    for (Order o : orders) {
        units.merge(o.sku(), o.qty(), Integer::sum);
    }
    return units;
}

static Map<String, List<Order>> byCustomer(List<Order> orders) {
    Map<String, List<Order>> out = new LinkedHashMap<>();  // first-seen order
    for (Order o : orders) {
        out.computeIfAbsent(o.customer(), k -> new ArrayList<>()).add(o);
    }
    return out;
}`, note: '<code>merge</code> and <code>computeIfAbsent</code> replace the old “get, check null, put” dance. The stream version is in <a href="streams-collectors.html">Streams &amp; collectors</a>.' },
    { title: 'Defensive copies at the boundary', lang: 'java', code: `public final class Team {
    private final String name;
    private final List<String> members;

    public Team(String name, List<String> members) {
        this.name = name;
        this.members = List.copyOf(members);   // snapshot; rejects nulls
    }

    public List<String> members() { return members; }   // already unmodifiable

    public Team withMember(String m) {
        List<String> next = new ArrayList<>(members);
        next.add(m);
        return new Team(name, next);
    }
}`, note: 'Callers can’t change the team behind your back, and you can’t change the caller’s list either.' }
  ]
});

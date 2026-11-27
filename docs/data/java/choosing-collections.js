IA.register({
  track: 'java',
  slug: 'choosing-collections',
  title: 'Choosing collections',
  tagline: 'Pick a collection by the <b>operations you will run most</b>, not by habit. ArrayList for lists. ArrayDeque for stacks and queues. HashMap for lookup. TreeMap for “nearest key” or ranges. EnumMap/EnumSet for enum keys. LinkedList almost never.',
  tldr: {
    problem: 'The wrong collection still works, so nobody notices. Until a loop becomes O(n²) (<code>get(i)</code> on a LinkedList). Or a queue makes a node per element. Or a “sorted” report depends on HashMap order.',
    model: 'Each collection is built on one structure, and the structure decides what is cheap. <b>Array</b>: ArrayList, ArrayDeque, PriorityQueue. <b>Linked nodes</b>: LinkedList. <b>Hash table</b>: HashMap/Set. <b>Red-black tree</b>: TreeMap/Set. <b>Array or bits indexed by enum position</b>: EnumMap/Set.',
    hook: '“When would you use LinkedList over ArrayList?” Almost never. Arrays sit together in memory, so they are faster and smaller. LinkedList’s O(1) insert needs an O(n) walk first. Use ArrayDeque for queue work.',
    facts: [
      { v: '1.5×', l: 'how much ArrayList grows: the new size is <code>old + old/2</code>. An empty <code>new ArrayList&lt;&gt;()</code> makes its 10-slot array on the first add' },
      { v: '24 B', l: 'per LinkedList node (header + item + next + prev, compressed pointers), on top of the element. ArrayList pays ~4 B per slot' },
      { v: '64', l: 'enum constants fit an EnumSet in one <code>long</code> (RegularEnumSet). More use a <code>long[]</code> (JumboEnumSet)' }
    ]
  },
  intro: {
    what: 'Java gives you many ready-made containers: lists, sets, maps, queues. Each is built differently inside, so each is fast at different things. To choose, ask what you will do most. <b>Read by position</b>? <b>Look up by key</b>? <b>Add and remove at the ends</b>? <b>Keep things sorted</b>?',
    analogy: { icon: '🧰', title: 'Containers in a kitchen', text: 'A spice rack (array) lets you grab jar #7 at once. But a new jar at the front means sliding all the others along. A chain of paper clips (linked list) is easy to splice. But finding clip #500 means counting from one end. Labelled drawers (hash map) find “cumin” at once, in no particular order. An alphabetised shelf (tree map) also tells you what comes just before and after “cumin”.' },
    steps: [
      { t: 'Program to the interface', d: 'Declare <code>List</code>, <code>Map</code>, <code>Deque</code>. Choose the actual class in one place.', code: 'List<Order> orders = new ArrayList<>();\nDeque<Task> work = new ArrayDeque<>();\nMap<String, User> byId = new HashMap<>();' },
      { t: 'Ask what you do most', d: 'Index access → ArrayList. Ends only → ArrayDeque. Key lookup → HashMap. Sorted, or “first key after X” → TreeMap. Priority → PriorityQueue.' },
      { t: 'Ask about order', d: 'HashMap: no order. LinkedHashMap: insertion order. TreeMap: sorted. EnumMap: enum declaration order.' },
      { t: 'Prefer immutable results', d: 'Return <code>List.of</code>, <code>List.copyOf</code> or <code>stream.toList()</code> from methods, so callers can’t change your data.' }
    ],
    terms: [
      ['O(1), O(log n), O(n)', 'How the cost grows with the number of elements: constant, logarithmic (double the size → +1 step), linear.'],
      ['amortised', 'Usually cheap, sometimes costly (a grow), cheap on average.'],
      ['Deque', 'A double-ended queue: add and remove at both ends. Also the modern stack.'],
      ['NavigableMap', 'A sorted map with “nearest key” methods: floor, ceiling, headMap, tailMap…'],
      ['view', 'A collection that looks into another one (subMap, keySet, subList). Changes show through both ways.']
    ]
  },
  visual: {
    title: 'What one call really costs inside each structure',
    caption: 'Pick an operation and press Play. Highlighted cells show the memory that is touched. The stats line keeps score. Then use the table below to compare everything at once.'
  },
  extras: [
    { id: 'choosing-collections-bigo', title: 'Big-O and memory at a glance', label: 'Big-O table', caption: 'Click an operation to highlight its column. Memory figures are rough, for 64-bit HotSpot with compressed pointers.' }
  ],
  gotchas: [
    { trap: '<code>list.get(i)</code> in a loop over a LinkedList', code: `for (int i = 0; i < list.size(); i++)
    process(list.get(i));          // O(n²) on LinkedList`, why: 'Each <code>get(i)</code> walks from the nearer end. Ten thousand elements means about 25 million hops, most of them slow memory reads.', fix: 'Loop with for-each or an <code>Iterator</code>. Better, use ArrayList. Code that takes any <code>List</code> can check <code>instanceof RandomAccess</code>.' },
    { trap: '<code>remove(int)</code> vs <code>remove(Object)</code> on a List&lt;Integer&gt;', code: `List<Integer> ids = new ArrayList<>(List.of(5, 7, 9));
ids.remove(1);                   // removes index 1 (the 7)
ids.remove(Integer.valueOf(9));  // removes the value 9`, why: 'For an <code>int</code> argument, Java picks <code>remove(int)</code>, because it needs no boxing.', fix: 'Pass <code>Integer.valueOf(x)</code>. Or use <code>removeIf(v -&gt; v == x)</code> to make the intent clear.' },
    { trap: '<code>Arrays.asList</code> is fixed-size, and <code>List.of</code> is immutable and null-hostile', code: `List<String> a = Arrays.asList("x", "y");
a.set(0, "z");        // OK: writes through to the array
a.add("w");           // UnsupportedOperationException
List.of("x").contains(null);   // NullPointerException`, why: '<code>Arrays.asList</code> is a view over the array. <code>List.of</code> lists reject nulls when created, and even in <code>contains(null)</code>.', fix: 'Copy when it must grow: <code>new ArrayList&lt;&gt;(Arrays.asList(…))</code>. Don’t ask fixed collections about null.' },
    { trap: 'A TreeSet comparator that disagrees with equals', code: `Set<String> tags = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
tags.add("Java"); tags.add("JAVA");   // size 1: "JAVA" was a duplicate`, why: 'TreeMap and TreeSet treat <code>compare(a, b) == 0</code> as “equal”. They never call <code>equals</code>. A comparator that checks only some fields drops different elements without warning.', fix: 'Make the comparator agree with equals, or add a tie-breaker: <code>comparing(User::name).thenComparing(User::id)</code>.' },
    { trap: 'Using Stack or Vector', why: 'Both are old classes from Java 1.0. Every method takes a lock. <code>Stack</code> extends <code>Vector</code>, so callers can insert into the middle of your “stack”.', fix: 'Use <code>Deque&lt;T&gt; stack = new ArrayDeque&lt;&gt;()</code> with <code>push</code>/<code>pop</code>/<code>peek</code>. Note that ArrayDeque rejects nulls.' },
    { trap: 'PriorityQueue iteration isn’t sorted', code: `PriorityQueue<Integer> pq = new PriorityQueue<>();
pq.add(3); pq.add(1); pq.add(2);
System.out.println(pq);   // [1, 3, 2]: heap order, not sorted order`, why: 'A binary heap only promises that the head is the smallest. <code>toString</code>, for-each and streams walk the array in heap order.', fix: 'Empty it with <code>poll()</code> to get sorted order. Or use a <code>TreeSet</code>/<code>TreeMap</code> if you need sorted loops.' },
    { trap: '<code>subList</code> and <code>subMap</code> are views', why: 'Adding to or removing from the parent list breaks a <code>subList</code> (CME on next use). Keeping a small <code>subList</code> of a huge list keeps the whole array in memory.', fix: 'Copy it if it must outlive the parent: <code>List.copyOf(list.subList(0, 10))</code>. Use views on purpose, for example <code>list.subList(a, b).clear()</code> to delete a range.' }
  ],
  scenarios: [
    { title: 'Export job CPU-bound after “switching to LinkedList for faster inserts”',
      symptom: 'An export of 200k rows went from 2 s to several minutes. A flame graph shows almost all time in <code>LinkedList.node(int)</code>.',
      diagnose: `// a profiler / JFR "hot methods" view:
// java.util.LinkedList.node(int)          91%
//   java.util.LinkedList.get(int)
//     com.acme.export.CsvWriter.writeRows`,
      cause: 'Someone changed the list type to speed up one insert at the front. The code still looped by index. So each <code>get(i)</code> became an O(n) walk, and the loop became O(n²).',
      fix: 'Go back to ArrayList and build in order (or add at the end and reverse once). Loop with for-each, so any <code>List</code> stays O(n).',
      fixCode: `List<Row> rows = new ArrayList<>(expected);
rows.addAll(fetchRows());
rows.add(0, header);          // one O(n) shift: fine
for (Row r : rows) writer.write(r);` },
    { title: 'Duplicate customers silently dropped from a sorted report',
      symptom: 'A report of customers sorted by name shows 9,870 rows, but the database has 10,000. No exceptions.',
      diagnose: `Set<Customer> sorted = new TreeSet<>(Comparator.comparing(Customer::name));
// two different customers named "Li Wei" → compare(...) == 0 → second add is ignored`,
      cause: 'The comparator looks only at names. TreeSet treats <code>compare == 0</code> as “same element”. So customers who share a name merge into one.',
      fix: 'Add a unique tie-breaker, or sort a List instead of using a Set.',
      fixCode: `Comparator<Customer> byName = Comparator.comparing(Customer::name)
    .thenComparing(Customer::id);              // consistent with equals
List<Customer> report = customers.stream().sorted(byName).toList();` },
    { title: 'Scheduler picks the wrong “next run”',
      symptom: 'A home-grown job scheduler keeps a <code>HashMap&lt;Instant, Job&gt;</code> and scans it each tick to find the next job. With 50k jobs, ticks take 30 ms and jobs fire late.',
      cause: 'Finding “the earliest key after now” in a hash map means scanning it all. The data has a natural order. The structure doesn’t.',
      fix: 'Use a <code>TreeMap</code> (or <code>ConcurrentSkipListMap</code> if threads share it): <code>ceilingEntry(now)</code> and <code>headMap(now, true)</code> are O(log n).',
      fixCode: `NavigableMap<Instant, List<Job>> due = new TreeMap<>();
NavigableMap<Instant, List<Job>> ready = due.headMap(Instant.now(), true);
ready.values().forEach(jobs -> jobs.forEach(this::run));
ready.clear();                                // removes them from 'due' too` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] a) {
        List<Integer> l = new ArrayList<>(List.of(1, 2, 3));
        l.remove(1);
        l.remove(Integer.valueOf(1));
        System.out.println(l);
    }
}`, options: ['[3]', '[2, 3]', '[1, 3]', '[]'], answer: 0, run: true, expect: '[3]', explain: '<code>remove(1)</code> picks <code>remove(int index)</code> and removes the element at index 1 (the 2): [1, 3]. <code>remove(Integer.valueOf(1))</code> removes the <i>value</i> 1: <b>[3]</b>.' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] a) {
        List<String> l = Arrays.asList("a", "b");
        l.set(0, "z");
        try { l.add("c"); } catch (UnsupportedOperationException e) { System.out.print("UOE "); }
        System.out.println(l);
    }
}`, options: ['[z, b, c]', 'UOE [a, b]', 'UOE [z, b]', 'UOE on set, then [a, b]'], answer: 2, run: true, expect: 'UOE [z, b]', explain: '<code>Arrays.asList</code> returns a fixed-size view over the array. <code>set</code> is allowed: it writes the array. <code>add</code> would change the size, so it throws. Result: <b>UOE [z, b]</b>.' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] a) {
        TreeMap<Integer, String> t = new TreeMap<>(Map.of(10, "a", 20, "b", 30, "c"));
        System.out.println(t.floorKey(25) + " " + t.ceilingKey(25) + " "
            + t.headMap(20) + " " + t.tailMap(20, false));
    }
}`, options: ['20 30 {10=a} {30=c}', '20 30 {10=a, 20=b} {20=b, 30=c}', '10 30 {10=a} {30=c}', '20 30 {10=a} {20=b, 30=c}'], answer: 0, run: true, expect: '20 30 {10=a} {30=c}', explain: 'floor = largest ≤ 25 → 20. ceiling = smallest ≥ 25 → 30. <code>headMap(20)</code> leaves out 20 by default. <code>tailMap(20, false)</code> leaves it out on request. <b>20 30 {10=a} {30=c}</b>. The one-argument <code>tailMap(k)</code> would include k.' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] a) {
        Set<String> s = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        s.add("Java"); s.add("JAVA"); s.add("kotlin");
        System.out.println(s.size() + " " + s.contains("java") + " " + s);
    }
}`, options: ['3 false [JAVA, Java, kotlin]', '2 true [Java, kotlin]', '2 true [JAVA, kotlin]', '3 true [Java, JAVA, kotlin]'], answer: 1, run: true, expect: '2 true [Java, kotlin]', explain: 'The comparator says "Java" and "JAVA" are equal. So the second add is ignored, and the <b>first</b> spelling stays. <code>contains("java")</code> also uses the comparator, so it is true. <b>2 true [Java, kotlin]</b>.' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] a) {
        Deque<Integer> d = new ArrayDeque<>();
        d.push(1); d.push(2); d.offer(3); d.addFirst(4);
        System.out.println(d + " " + d.pop() + " " + d.pollLast());
    }
}`, options: ['[1, 2, 3, 4] 1 4', '[4, 2, 1, 3] 4 3', '[4, 2, 1, 3] 3 4', '[2, 1, 3, 4] 2 4'], answer: 1, run: true, expect: '[4, 2, 1, 3] 4 3', explain: '<code>push</code> = <code>addFirst</code>, <code>offer</code> = <code>addLast</code>. Building up: [1] → [2, 1] → [2, 1, 3] → [4, 2, 1, 3]. The string is built left to right. So <code>toString</code> runs before <code>pop()</code> (4, from the front) and <code>pollLast()</code> (3). <b>[4, 2, 1, 3] 4 3</b>.' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;

public class Main {
    enum Day { MON, TUE, WED }

    public static void main(String[] a) {
        Map<Day, Integer> m = new EnumMap<>(Day.class);
        m.put(Day.WED, 3);
        m.put(Day.MON, 1);
        System.out.println(m + " " + EnumSet.complementOf(EnumSet.of(Day.TUE)));
    }
}`, options: ['{WED=3, MON=1} [MON, WED]', '{MON=1, WED=3} [MON, WED]', '{MON=1, WED=3} [WED, MON]', 'Order varies between runs'], answer: 1, run: true, expect: '{MON=1, WED=3} [MON, WED]', explain: 'EnumMap and EnumSet always loop in <b>declaration order</b>, whatever the insertion order. <code>complementOf</code> flips the bits: everything except TUE.' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] a) {
        List<String> mutable = new ArrayList<>(List.of("x"));
        List<String> immutable = List.of("x");
        System.out.print(mutable.contains(null) + " ");
        try {
            System.out.println(immutable.contains(null));
        } catch (NullPointerException e) {
            System.out.println("NPE");
        }
    }
}`, options: ['false false', 'false NPE', 'NPE NPE', 'true NPE'], answer: 1, run: true, expect: 'false NPE', explain: 'ArrayList allows nulls and answers false. <code>List.of</code> lists reject nulls everywhere. Even <code>contains(null)</code> and <code>indexOf(null)</code> throw <b>NPE</b>. This bites when code calls <code>contains(maybeNull)</code> on a list it got from <code>List.of</code>.' },
    { kind: 'concept', q: 'You need a FIFO work queue on one thread, at 1M items per second. Which is the best default?', options: ['LinkedList', 'ArrayDeque', 'ArrayList with remove(0)', 'PriorityQueue'], answer: 1, explain: '<b>ArrayDeque</b>: O(1) at both ends, in a ring-shaped array. No extra object per element, and the memory sits together. LinkedList makes a node per element (more garbage). <code>ArrayList.remove(0)</code> shifts everything (O(n)). PriorityQueue orders by priority, not arrival. Across threads, use a <a href="concurrent-collections.html">BlockingQueue</a>.' }
  ],
  interview: [
    { q: 'ArrayList vs LinkedList: when would you choose each?', a: '<p>ArrayList for nearly everything. Index access is O(1), appends are O(1) on average, memory is compact, and loops are fast. LinkedList only wins for inserts or removes in the middle <i>through an iterator you already hold</i>. Even then, ArrayList’s block copy is often faster at normal sizes. For queue or stack work, ArrayDeque beats both.</p>', fu: 'Why is looping over ArrayList faster, when both are O(n)? (Its references sit side by side, so the CPU loads them ahead. LinkedList chases pointers to nodes spread across the heap.)', lvl: 'core' },
    { q: 'How does ArrayList grow?', a: '<p>When full, it makes a new array of <code>old + (old &gt;&gt; 1)</code>, that is 1.5×, and copies with <code>Arrays.copyOf</code>. A no-arg ArrayList starts with a shared empty array. It makes 10 slots on the first add. It never shrinks unless you call <code>trimToSize()</code>. Pass a starting size when you know it.</p>', lvl: 'core' },
    { q: 'Why is ArrayDeque preferred over Stack and LinkedList?', a: '<p>It is a growable, ring-shaped array. push/pop/offer/poll are O(1) at both ends, with no extra objects, and memory stays together. <code>Stack</code> locks every call and extends <code>Vector</code>, which allows access by index. LinkedList makes a 24 B node per element. One catch: ArrayDeque rejects nulls, because <code>null</code> means “empty” from <code>poll</code>/<code>peek</code>.</p>', lvl: 'core' },
    { q: 'What does NavigableMap give you over SortedMap?', a: '<p>Nearest-key lookups (<code>floorKey</code>, <code>ceilingKey</code>, <code>lowerKey</code>, <code>higherKey</code>). Range views where you choose to include the ends (<code>subMap(a, true, b, false)</code>, <code>headMap(k, inclusive)</code>). Plus <code>descendingMap()</code> and <code>pollFirstEntry</code>/<code>pollLastEntry</code>. TreeMap and ConcurrentSkipListMap have it. All are O(log n).</p>', lvl: 'core' },
    { q: 'Why use EnumMap and EnumSet?', a: '<p>They use each enum constant’s position (its <i>ordinal</i>) as an index. EnumMap is a plain array of values. EnumSet is a set of bits (one <code>long</code> for ≤ 64 constants). No hashing, no extra objects, and loops follow declaration order. They beat HashMap/HashSet for enum keys, and safely replace int bit flags.</p>', lvl: 'core' },
    { q: 'Give the big-O of contains for List, HashSet and TreeSet.', a: '<ul><li><b>ArrayList / LinkedList</b>: O(n), a scan with <code>equals</code>.</li><li><b>HashSet</b>: O(1) on average (hash → bucket → equals).</li><li><b>TreeSet</b>: O(log n) with <code>compareTo</code>/comparator.</li></ul><p>Calling <code>contains</code> in a loop over another collection? Turn the searched side into a HashSet first. O(n·m) becomes O(n + m).</p>', lvl: 'core' },
    { q: 'What is the difference between Collections.unmodifiableList, List.copyOf and List.of?', a: '<p><code>unmodifiableList</code> is a read-only <b>view</b>. Changes to the list behind it still show through. <code>List.copyOf</code> and <code>List.of</code> make lists that can never change (copyOf returns its argument if it already is one). They reject nulls. <code>stream.toList()</code> (Java 16+) can’t be changed either, but allows nulls.</p>', lvl: 'deep' },
    { q: 'What is SequencedCollection (Java 21)?', a: '<p>Java 21 added interfaces for collections with a defined order: <code>SequencedCollection</code>, <code>SequencedSet</code>, <code>SequencedMap</code>. They provide <code>getFirst</code>, <code>getLast</code>, <code>addFirst</code>, <code>addLast</code>, <code>removeFirst</code>, <code>removeLast</code> and a <code>reversed()</code> view. List, Deque, LinkedHashSet, SortedSet, LinkedHashMap and SortedMap all fit. So <code>list.getLast()</code> replaces <code>list.get(list.size() - 1)</code>.</p>', fu: 'What happens to unmodifiable lists? (addFirst etc. throw UnsupportedOperationException.)', lvl: 'deep' },
    { q: 'When would you pick PriorityQueue, and what are its costs?', a: '<p>For “always take the smallest (or largest) next”: schedulers, top-k, Dijkstra. It is a binary heap in an array. <code>offer</code>/<code>poll</code> are O(log n), <code>peek</code> O(1). But <code>remove(Object)</code> and <code>contains</code> are O(n), and loops aren’t sorted. For the top k of a big stream, keep a heap of size k with the comparator reversed.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Defaults that are rarely wrong', lang: 'java', code: `List<Order> orders = new ArrayList<>(expectedSize);           // index access, append
Deque<Node> stack = new ArrayDeque<>();                      // push / pop / peek
Queue<Task> fifo = new ArrayDeque<>();                       // offer / poll
Map<String, User> byId = HashMap.newHashMap(expectedSize);   // Java 19+
Map<String, Integer> ordered = new LinkedHashMap<>();        // insertion order
NavigableMap<Instant, Slot> calendar = new TreeMap<>();      // ranges, floor/ceiling
Set<Permission> perms = EnumSet.of(Permission.READ, Permission.WRITE);
Map<Status, Long> counts = new EnumMap<>(Status.class);`, note: 'Return copies that can’t change from public methods (<code>List.copyOf</code>, <code>stream.toList()</code>). Then callers can’t change your state.' },
    { title: 'Top-k with a bounded heap', lang: 'java', code: `static List<Product> topK(Iterable<Product> all, int k) {
    // min-heap of size k: the head is the weakest of the current top k
    PriorityQueue<Product> heap = new PriorityQueue<>(k, Comparator.comparingLong(Product::sales));
    for (Product p : all) {
        heap.offer(p);
        if (heap.size() > k) heap.poll();       // drop the weakest
    }
    List<Product> out = new ArrayList<>(heap);
    out.sort(Comparator.comparingLong(Product::sales).reversed());
    return out;                                  // O(n log k) time, O(k) memory
}` },
    { title: 'EnumMap in a Spring service', lang: 'java', code: `@Service
class OrderStats {
    private final OrderRepository repo;
    OrderStats(OrderRepository repo) { this.repo = repo; }

    Map<OrderStatus, Long> countsByStatus() {
        Map<OrderStatus, Long> out = new EnumMap<>(OrderStatus.class);
        for (OrderStatus s : OrderStatus.values()) out.put(s, 0L);   // stable, complete keys
        repo.countGroupedByStatus().forEach(r -> out.put(r.status(), r.count()));
        return out;     // JSON serialises in enum declaration order
    }
}` }
  ]
});

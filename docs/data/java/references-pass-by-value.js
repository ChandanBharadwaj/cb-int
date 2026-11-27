IA.register({
  track: 'java',
  slug: 'references-pass-by-value',
  title: 'References & pass-by-value',
  tagline: 'A Java variable never holds an object. It holds a plain value (a <b>primitive</b>) or an address of an object (a <b>reference</b>). Every method call copies that value. Picture arrows from variables to objects, and most <code>==</code> and shared-object bugs make sense.',
  tldr: {
    problem: 'Code you expect to update the caller’s object doesn’t. Code you expect to work on a private copy changes shared state. Both bugs come from not knowing what a variable holds.',
    model: 'Each call has its own local variables. They hold primitives directly and objects as arrows (<b>references</b>). A call copies each argument into the new call. Follow the arrow, and you change the shared object. Reassign the parameter, and you only move your own arrow.',
    hook: '“Is Java pass-by-reference for objects?” No. It copies the reference (<b>pass-by-value</b>). Proof: you can’t write a <code>swap(a, b)</code> that changes the caller’s variables.',
    facts: [
      { v: 'by value', l: 'is the only mode. Each parameter starts as a copy of the argument. For objects, that copy is a reference' },
      { v: '−128…127', l: 'the range <code>Integer.valueOf</code> must cache. So <code>==</code> on boxed 127 is true, and on 128 usually false' },
      { v: '8', l: 'primitive types: <code>boolean byte short char int long float double</code>. Everything else, arrays included, is a reference type' }
    ]
  },
  intro: {
    what: 'Each method call gets a small private workspace for its local variables (a <b>stack frame</b>). Objects live in a shared area (the <b>heap</b>). That includes anything made with <code>new</code>, plus arrays and strings. An object variable doesn’t contain the object. It holds an address that points to it (a <b>reference</b>).',
    analogy: { icon: '🏠', title: 'A sticky note with an address', text: 'Your variable is a sticky note with a house address. Calling a method photocopies the note and hands over the copy. The other person can drive there and repaint the door. You will see the new paint. If they write a new address on <i>their</i> copy, your note still has the old one.' },
    steps: [
      { t: 'Primitives are copied as values', d: '<code>int n = 5; f(n);</code> gives <code>f</code> its own 5. Changing it inside <code>f</code> never affects the caller.' },
      { t: 'Objects are reached through references', d: '<code>Point p = new Point(1, 1);</code> creates the Point and stores an arrow to it in <code>p</code>.', code: 'Point p = new Point(1, 1);\nPoint q = p;      // copies the arrow, not the Point\nq.x = 9;\nSystem.out.println(p.x);  // 9' },
      { t: 'A call copies the arrow', d: 'Inside the method, the parameter points at the same object. If you change the object, the caller sees it.' },
      { t: 'Reassigning only moves your copy', d: '<code>param = new Point(…)</code> moves only the method’s own arrow. The caller still points at the original.' },
      { t: '== compares arrows, equals compares contents', d: 'For objects, <code>a == b</code> asks “same object?”. <code>a.equals(b)</code> asks “same value?” (if the class defines it).' }
    ],
    terms: [
      ['stack frame', 'The per-call storage for parameters and locals. It disappears when the method returns.'],
      ['heap', 'Shared memory where objects live until the garbage collector frees them.'],
      ['reference', 'An address of an object, or <code>null</code>. Every non-primitive variable holds one.'],
      ['alias', 'Two variables that refer to the same object. A change made through one is seen through the other.'],
      ['identity vs equality', '<code>==</code> on references tests identity (same object). <code>equals</code> tests logical equality.'],
      ['autoboxing', 'Automatic conversion between <code>int</code> and <code>Integer</code> (and the other primitive/wrapper pairs).']
    ]
  },
  visual: {
    title: 'Stack slots, heap boxes, and the arrows between them',
    caption: 'Pick a scenario and press <b>Play</b> or <b>Step</b>. Orange arrows just changed. Orange values were just written. A dashed box has no arrows left, so the garbage collector will free it.'
  },
  gotchas: [
    { trap: 'Comparing boxed numbers with ==', code: `Long a = order.getCustomerId();   // Long, not long
Long b = user.getId();
if (a == b) { … }   // true for ids up to 127 in tests, false in production`, why: '<code>==</code> on two <code>Long</code> objects asks “same object?”. <code>Long.valueOf</code> caches −128…127. Small test ids share objects, so the bug hides in tests.', fix: 'Use <code>a.equals(b)</code>, <code>Objects.equals(a, b)</code> (null-safe), or unbox to <code>long</code> on purpose. Static analysis (IntelliJ, Error Prone’s <code>ReferenceEquality</code>) flags this.' },
    { trap: 'A getter that hands out your internal list', code: `class Team {
  private final List<String> members = new ArrayList<>();
  public List<String> getMembers() { return members; }  // alias leaks
}
team.getMembers().clear();   // wipes the team`, why: 'The caller gets a reference to the same list. <code>final</code> stops you re-pointing the field. It doesn’t stop anyone changing the list.', fix: 'Return <code>List.copyOf(members)</code> (Java 10+) or <code>Collections.unmodifiableList(members)</code>. See <a href="immutability-records.html">Immutability & records</a>.' },
    { trap: 'Filling an array or list with one shared object', code: `List<Integer>[] buckets = new List[3];
Arrays.fill(buckets, new ArrayList<>());   // ONE list, three slots
buckets[0].add(42);                        // all three “contain” 42`, why: '<code>new ArrayList&lt;&gt;()</code> runs once. <code>fill</code> copies that one reference into every slot. <code>Collections.nCopies(n, obj)</code> does the same.', fix: 'Create one object per slot: <code>for (int i = 0; i &lt; n; i++) buckets[i] = new ArrayList&lt;&gt;();</code> or <code>Stream.generate(ArrayList::new).limit(n).toList()</code>.' },
    { trap: '<code>Arrays.asList</code> and <code>subList</code> are views, not copies', code: `String[] arr = {"a", "b"};
List<String> l = Arrays.asList(arr);
arr[0] = "z";          // l.get(0) is now "z"
List<String> head = big.subList(0, 10);
big.add("x");          // head is now invalid: ConcurrentModificationException on use`, why: 'Both lists read and write the original storage. Change one, and the other changes too. Adding to or removing from the parent breaks a <code>subList</code>.', fix: 'Wrap in <code>new ArrayList&lt;&gt;(…)</code> or use <code>List.copyOf(…)</code> when you need an independent list.' },
    { trap: 'Expecting a parameter reassignment to reach the caller', code: `void load(Config cfg) {
  cfg = repository.find();   // caller still holds the old (often null) cfg
}`, why: 'The parameter is a copy of the caller’s reference. Re-pointing it changes nothing outside.', fix: 'Return the new value. For several results, return a <code>record</code> (Java 16+) instead of “out parameters”.' },
    { trap: 'Unboxing a null reference', code: `Map<String, Integer> counts = new HashMap<>();
int n = counts.get("missing");   // NullPointerException`, why: 'An <code>Integer</code> is a reference, so it can be <code>null</code>. Assigning it to an <code>int</code> calls <code>intValue()</code> on it.', fix: 'Use <code>getOrDefault(key, 0)</code>, <code>merge</code>, or keep it as <code>Integer</code> and check. Since Java 14, the NPE message names the null expression.' }
  ],
  scenarios: [
    { title: 'Every new signup became an ADMIN',
      symptom: 'After a release, all users created in the last hour had the <code>ADMIN</code> role. No code path grants ADMIN to new users.',
      diagnose: `// RoleDefaults.java
private static final List<String> DEFAULT_ROLES = new ArrayList<>(List.of("USER"));
public static List<String> defaults() { return DEFAULT_ROLES; }

// AdminInviteService.java (new in this release)
List<String> roles = RoleDefaults.defaults();
roles.add("ADMIN");               // mutates the shared static list
user.setRoles(roles);`,
      cause: '<code>defaults()</code> handed out one shared, changeable list. The invite flow added ADMIN to it. Every later caller got <code>[USER, ADMIN]</code>. Earlier users were safe only if their roles were copied on save.',
      fix: 'Make shared constants immutable so a caller that tries to change one fails fast. Make callers copy before they modify.',
      fixCode: `private static final List<String> DEFAULT_ROLES = List.of("USER");   // immutable
public static List<String> defaults() { return DEFAULT_ROLES; }

List<String> roles = new ArrayList<>(RoleDefaults.defaults());       // private copy
roles.add("ADMIN");` },
    { title: 'Order matching worked in staging, failed for real customers',
      symptom: 'A reconciliation job matched only some payments to orders. In staging, with small seed ids, it matched all of them.',
      diagnose: `payments.stream()
    .filter(p -> p.getOrderId() == order.getId())   // both are Long
    .findFirst();`,
      cause: 'Both getters return <code>Long</code>, and <code>==</code> asks “same object?”. Values from −128 to 127 come from a shared cache, so staging ids matched. Production ids are in the millions. Each one is a separate object, so the check is false.',
      fix: 'Compare values, not objects. Prefer primitive <code>long</code> for ids in domain code, and turn on an inspection that flags reference equality on boxed types.',
      fixCode: `.filter(p -> Objects.equals(p.getOrderId(), order.getId()))
// or, with primitive ids in the domain model:
.filter(p -> p.orderId() == order.id())   // long == long` },
    { title: 'A “read-only” mapper changed rows in the database',
      symptom: 'Customer names in the database were suddenly upper-cased. The only recent change was an export endpoint that “just reads”.',
      diagnose: `@Transactional
public ExportDto export(long id) {
  Customer c = repo.findById(id).orElseThrow();   // managed entity
  normalize(c);                                    // c.setName(c.getName().toUpperCase())
  return ExportDto.from(c);
}   // commit → Hibernate dirty-checks c → UPDATE customer SET name = …`,
      cause: '<code>normalize</code> got a reference to the live JPA entity, not a copy. On commit, Hibernate compares the entity to its loaded snapshot. It sees the change and writes it.',
      fix: 'Map to a DTO first and change the DTO. Or mark the method <code>@Transactional(readOnly = true)</code>. With Spring and Hibernate, changed entities are then not written. Best: don’t change entities you don’t own.',
      fixCode: `@Transactional(readOnly = true)
public ExportDto export(long id) {
  Customer c = repo.findById(id).orElseThrow();
  return ExportDto.from(c).withName(c.getName().toUpperCase());   // transform the copy
}` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    static void swap(Integer a, Integer b) {
        Integer t = a;
        a = b;
        b = t;
    }

    public static void main(String[] args) {
        Integer x = 1, y = 2;
        swap(x, y);
        System.out.println(x + " " + y);
    }
}`, options: ['2 1', '1 2', '1 1', 'Compile error: cannot assign to a parameter'], answer: 1, explain: '<code>swap</code> gets copies of the two references and swaps its own copies. <code>x</code> and <code>y</code> in main never move, so it prints <b>1 2</b>. Parameters are normal local variables. You can reassign them unless they are <code>final</code>.', run: true, expect: '1 2' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    static void change(StringBuilder sb) {
        sb.append("B");
        sb = new StringBuilder("X");
        sb.append("C");
    }

    public static void main(String[] args) {
        StringBuilder sb = new StringBuilder("A");
        change(sb);
        System.out.println(sb);
    }
}`, options: ['A', 'AB', 'XC', 'ABXC'], answer: 1, explain: 'The first <code>append</code> follows the shared arrow and changes the caller’s builder to “AB”. The reassignment moves only the local copy. “XC” goes into an object nobody else sees. Prints <b>AB</b>.', run: true, expect: 'AB' },
    { kind: 'predict', q: 'What does this print on a default JVM?', code: `public class Main {
    public static void main(String[] args) {
        Integer a = 127, b = 127;
        Integer c = 128, d = 128;
        System.out.println((a == b) + " " + (c == d) + " " + c.equals(d));
    }
}`, options: ['true true true', 'true false true', 'false false true', 'true false false'], answer: 1, explain: 'Turning an <code>int</code> into an <code>Integer</code> (<i>autoboxing</i>) calls <code>Integer.valueOf</code>. It returns cached objects for −128…127. 127 is cached, so <code>a == b</code> is true. 128 is not, so <code>c</code> and <code>d</code> are different objects. <code>equals</code> compares values. Prints <b>true false true</b>. (<code>-XX:AutoBoxCacheMax</code> can widen the cache, so never rely on it.)', run: true, expect: 'true false true' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    static void f(int[] a, int n) {
        a[0] = 99;
        n = 99;
        a = new int[] {7};
    }

    public static void main(String[] args) {
        int[] arr = {1, 2};
        int n = 1;
        f(arr, n);
        System.out.println(arr[0] + " " + n + " " + arr.length);
    }
}`, options: ['1 1 2', '99 99 2', '99 1 2', '7 1 1'], answer: 2, explain: 'Arrays are objects, so <code>a[0] = 99</code> writes through the shared reference. <code>n</code> is a primitive copy. <code>a = new int[]{7}</code> only re-points the local. Prints <b>99 1 2</b>.', run: true, expect: '99 1 2' },
    { kind: 'bug', q: 'A grid builder. What does it print?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<List<Integer>> rows = new ArrayList<>();
        List<Integer> row = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            row.add(i);
            rows.add(row);
        }
        System.out.println(rows);
    }
}`, options: ['[[0], [1], [2]]', '[[0], [0, 1], [0, 1, 2]]', '[[0, 1, 2], [0, 1, 2], [0, 1, 2]]', '[[0, 1, 2]]'], answer: 2, explain: 'There is only one <code>row</code> object. <code>rows</code> holds three arrows to it. <code>println</code> runs after the loop, when that list holds 0, 1, 2. Prints <b>[[0, 1, 2], [0, 1, 2], [0, 1, 2]]</b>. Create the inner list inside the loop.', run: true, expect: '[[0, 1, 2], [0, 1, 2], [0, 1, 2]]' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        String[] arr = {"a", "b", "c"};
        List<String> list = Arrays.asList(arr);
        list.set(0, "z");
        arr[2] = "y";
        System.out.println(list + " " + Arrays.toString(arr));
    }
}`, options: ['[z, b, c] [a, b, y]', '[z, b, y] [z, b, y]', '[a, b, c] [a, b, c]', 'UnsupportedOperationException'], answer: 1, explain: '<code>Arrays.asList</code> returns a fixed-size list <b>backed by the array</b>. <code>set</code> writes to the array and array writes show in the list. Only size-changing calls such as <code>add</code> throw <code>UnsupportedOperationException</code>. Prints <b>[z, b, y] [z, b, y]</b>.', run: true, expect: '[z, b, y] [z, b, y]' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Map<String, Integer> m = new HashMap<>();
        Integer boxed = m.get("x");
        System.out.println(boxed == null);
        try {
            int n = m.get("x");
            System.out.println(n);
        } catch (NullPointerException e) {
            System.out.println("NPE");
        }
    }
}`, options: ['true, then 0', 'true, then NPE', 'false, then 0', 'Compile error: Integer cannot be assigned to int'], answer: 1, explain: '<code>get</code> returns <code>null</code>. Assigning it to an <code>int</code> calls <code>intValue()</code> on null, which throws. Prints <b>true</b> then <b>NPE</b>.', run: true, expect: 'true\nNPE' },
    { kind: 'concept', q: 'Which statement about Java argument passing is correct?', options: ['Primitives are passed by value, objects by reference', 'Everything is passed by value; for objects the value is a reference', 'Everything is passed by reference, but Strings are copied', 'It depends on whether the parameter is <code>final</code>'], answer: 1, explain: 'There is one rule: the argument’s value is copied into the parameter. A reference is a value. True pass-by-reference would let the method change the caller’s variable, like C++ <code>T&amp;</code> or C# <code>ref</code>. Java can’t.' }
  ],
  interview: [
    { q: 'Is Java pass-by-value or pass-by-reference?', a: '<p>Always pass-by-value. For objects, the value is a <b>reference</b>. The method can change the object it points to. It can’t make the caller’s variable point elsewhere. Quickest proof: you can’t write a working <code>swap(a, b)</code>.</p>', fu: 'How would you return two values from a method? (A record, Java 16+.)', lvl: 'core' },
    { q: 'What lives on the stack and what lives on the heap?', a: '<p>Each thread has a stack of frames holding parameters and locals: primitive values and references. Objects and arrays live on the heap, shared by all threads.</p><p>That is the mental model. In practice, the JIT compiler may skip the heap for an object that never leaves its method. Your code can’t tell the difference.</p>', lvl: 'core' },
    { q: 'When is <code>==</code> correct on references?', a: '<ul><li>Enums: each constant is a singleton, and <code>==</code> is also null-safe.</li><li>Deliberate identity checks: <code>this == o</code> as the fast path in <code>equals</code>, or <code>IdentityHashMap</code>.</li><li>Comparing to <code>null</code>.</li></ul><p>For values such as String, boxed numbers, BigDecimal and dates, use <code>equals</code>. Note that <code>BigDecimal.equals</code> also compares scale: <code>2.0</code> is not equal to <code>2.00</code>. Use <code>compareTo</code> for numeric equality.</p>', lvl: 'core' },
    { q: 'Why does <code>Integer a = 127, b = 127; a == b</code> give true but 128 gives false?', a: '<p>Autoboxing calls <code>Integer.valueOf</code>. It must return the same object for −128 to 127. Outside that range it usually makes a new object. <code>-XX:AutoBoxCacheMax</code> can raise the limit, so code that depends on either result is broken.</p>', fu: 'Which other wrappers cache? The JLS rule also covers Boolean, Byte, Short and Character up to <code>\\u007f</code>. <code>Long.valueOf</code> caches −128…127 per its Javadoc. Float and Double don’t cache.', lvl: 'core' },
    { q: 'What is aliasing and how does it cause bugs?', a: '<p>Two references to one changeable object (an <i>alias</i>). A change through one name shows up through the other, often far away in the code. Typical sources: returning internal collections, storing a caller’s list without copying, <code>Arrays.fill</code> with one object, <code>Arrays.asList</code> and <code>subList</code> views, and caching a mutable object then mutating it.</p><p>Defences: immutable types, defensive copies at boundaries, and unmodifiable views.</p>', lvl: 'core' },
    { q: 'Does <code>final</code> on a parameter or field make the object immutable?', a: '<p>No. <code>final</code> fixes the <b>reference</b>: the variable can’t be reassigned. The object it points to can still be mutated. A <code>final List</code> can still be cleared. Immutability is a property of the class. See <a href="immutability-records.html">Immutability & records</a>.</p>', lvl: 'core' },
    { q: 'Strings are objects. Why do String parameters “behave like” primitives?', a: '<p>Because String is immutable. A callee can’t change the shared object, and anything that looks like a change (<code>s = s + "x"</code>) creates a new String and re-points only the local reference. The passing rules are the same as for any object.</p>', lvl: 'core' },
    { q: 'A method mutates an argument and the caller is surprised. How do you design APIs to avoid this?', a: '<ul><li>Prefer immutable parameter types: records, <code>List.of</code>, <code>java.time</code>.</li><li>Copy at the boundary: in a constructor <code>this.items = List.copyOf(items)</code>.</li><li>Name mutators clearly (<code>sortInPlace</code>) and return new values from everything else.</li><li>Document ownership in public APIs: who may modify what, and when.</li></ul>', lvl: 'deep' },
    { q: 'What exactly is a reference at runtime? Can you do pointer arithmetic?', a: '<p>The spec only says it points to an object, or is <code>null</code>. In HotSpot it is a memory address, or a 32-bit <b>compressed oop</b> on heaps up to about 32 GB. The GC may <b>move</b> objects and update every reference. So Java has no pointer arithmetic. <code>System.identityHashCode</code> is stored in the object header, not taken from the address.</p>', lvl: 'deep' },
    { q: 'How do aliasing and threads interact?', a: '<p>Two threads using one changeable object is a data race unless access is synchronised. Giving another thread a reference shares the object. It does not hand over a snapshot. Prefer passing immutable snapshots (<code>List.copyOf</code>) or using thread-safe structures, and make sure the object is safely published. See the Java Memory Model topic.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Defensive boundaries', lang: 'java', code: `public final class Team {
    private final List<String> members;

    public Team(List<String> members) {
        this.members = List.copyOf(members);   // copy in: the caller keeps no alias (Java 10+)
    }

    public List<String> members() {
        return members;                        // already unmodifiable, safe to share
    }

    public Team withMember(String m) {         // "change" = return a new value
        var next = new ArrayList<>(members);
        next.add(m);
        return new Team(next);
    }
}`, note: '<code>List.copyOf</code> rejects null elements and returns the same instance if the argument is already an unmodifiable list made by <code>List.of</code> or <code>copyOf</code>.' },
    { title: 'Comparing ids safely', lang: 'java', code: `// JPA entity: wrapper id because it is null before persist
@Entity
class Payment {
    @Id @GeneratedValue Long id;
    Long orderId;
}

// value comparison, null-safe
boolean matches(Payment p, Order o) {
    return Objects.equals(p.orderId, o.getId());
}

// or keep domain types primitive where null is impossible
record OrderRef(long id) {}
boolean same(OrderRef a, OrderRef b) { return a.id() == b.id(); }   // long == long` },
    { title: 'Return a record, not out-params', lang: 'java', code: `// Instead of: void parse(String raw, Header out, List<Line> outLines)
record Parsed(Header header, List<Line> lines) {
    Parsed { lines = List.copyOf(lines); }          // compact constructor (Java 16+)
}

Parsed parse(String raw) {
    Header h = readHeader(raw);
    List<Line> lines = readLines(raw);
    return new Parsed(h, lines);
}

var p = parse(input);
log.info("{} lines for {}", p.lines().size(), p.header().id());` }
  ]
});

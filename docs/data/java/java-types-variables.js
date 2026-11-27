IA.register({
  track: 'java',
  slug: 'java-types-variables',
  title: 'Variables & primitive types',
  tagline: 'Every Java variable has a <b>type</b> that never changes. Eight basic types hold plain values (<b>primitives</b> like <code>int</code>, <code>double</code>, <code>boolean</code>). Everything else points to an object. Learn the sizes, <code>var</code>, wrappers, and how casts and overflow change numbers without warning.',
  tldr: {
    problem: 'Java numbers have fixed sizes. Go past the edge and they <b>wrap around</b> with no error. Cast to a smaller type and bits are dropped. Mix primitives with wrapper objects, and <code>==</code> or <code>null</code> can bite you.',
    model: 'A variable is a box with a type. A primitive box holds the value. A reference box holds an arrow to an object. Small → big happens on its own (<b>widening</b>). Big → small needs a cast like <code>(int)</code> (<b>narrowing</b>) and may lose data.',
    hook: '“What is <code>Integer.MAX_VALUE + 1</code>?” <code>-2147483648</code>. Integer math wraps around. Use <code>Math.addExact</code> or <code>long</code> when it matters.',
    facts: [
      { v: '8', l: 'primitive types: <code>byte</code>, <code>short</code>, <code>int</code>, <code>long</code>, <code>float</code>, <code>double</code>, <code>char</code>, <code>boolean</code>' },
      { v: '2³¹−1', l: '<code>Integer.MAX_VALUE</code> = 2,147,483,647. A <code>long</code> goes to about 9.2 × 10¹⁸' },
      { v: '−128..127', l: 'the <code>Integer</code> values that are always cached. That is why small boxed values can look equal with <code>==</code>' }
    ]
  },
  intro: {
    what: 'A <b>variable</b> is a named box that holds a value. When you create it, you say what <b>type</b> of value it holds. It can never hold anything else: <code>int count = 0;</code>. Use <code>int</code> for whole numbers (<code>long</code> for big ones), <code>double</code> for decimals, <code>boolean</code> for yes/no, <code>char</code> for one character, and <code>String</code> for text.',
    analogy: { icon: '📦', title: 'Shaped boxes', text: 'Picture a shelf of boxes, each cut to a shape. An <code>int</code> box fits whole numbers up to about 2 billion. A <code>long</code> box is bigger. Pour a big box into a small one, and what doesn’t fit spills out. No warning. A <code>String</code> box is different: it holds a ticket that points to an object stored elsewhere.' },
    steps: [
      { t: 'Declare and assign', d: 'Type, name, value. The name uses camelCase.', code: 'int count = 0;\ndouble price = 19.99;\nboolean done = false;\nchar initial = \'J\';\nString name = "Ada";' },
      { t: 'Change the value, not the type', d: 'Assign again with <code>=</code>. Add <code>final</code> to forbid reassignment.', code: 'count = count + 1;\nfinal int MAX = 10;\n// MAX = 11;   // compile error' },
      { t: 'Let the compiler infer with var', d: 'Java 10+: for local variables, <code>var</code> takes the type from the right-hand side.', code: 'var total = 0L;          // long\nvar names = new ArrayList<String>();' },
      { t: 'Convert between types', d: 'Small to big is automatic; big to small needs a cast.', code: 'long big = count;        // widening\nint small = (int) 3.99;  // 3: fraction dropped' },
      { t: 'Use wrappers when you need an object', d: 'Each primitive has a matching class (a <i>wrapper</i>): <code>Integer</code>, <code>Long</code>, <code>Double</code>, and so on. Java converts between them for you (autoboxing).', code: 'List<Integer> scores = new ArrayList<>();\nscores.add(42);          // int -> Integer\nint first = scores.get(0); // Integer -> int' }
    ],
    terms: [
      ['primitive', 'One of the 8 built-in value types. Holds the value directly; cannot be <code>null</code>.'],
      ['reference type', 'Any class, interface or array type (<code>String</code>, <code>Integer</code>, <code>int[]</code>). The variable holds a reference to an object, or <code>null</code>.'],
      ['wrapper', 'The class version of a primitive, such as <code>Integer</code> for <code>int</code>.'],
      ['autoboxing / unboxing', 'Automatic conversion between a primitive and its wrapper.'],
      ['cast', '<code>(type) value</code>: an explicit conversion, required when data might be lost.'],
      ['overflow', 'A result too big for the type. Integer types wrap around silently.']
    ]
  },
  visual: {
    title: 'Typed boxes: values, casts and overflow',
    caption: 'Choose <b>Primitives</b>, <b>Casting</b>, <b>Overflow</b> or <b>Wrappers</b>, then <b>Play</b> or <b>Step</b> through the code. Each box shows a variable’s type, size and value. Red boxes are the surprises interviewers ask about.'
  },
  gotchas: [
    { trap: 'Integer overflow is silent', code: `int seconds = 365 * 24 * 60 * 60 * 1000;   // meant milliseconds
System.out.println(seconds);                // 1471228928 (wrong)
long ms = 365L * 24 * 60 * 60 * 1000;       // 31536000000 (right)`, why: 'All the numbers are <code>int</code>, so the multiply happens in 32 bits. It wraps <b>before</b> anything is stored. Putting the result in a <code>long</code> afterwards is too late.', fix: 'Make the first operand <code>long</code> (<code>365L</code>), or use <code>Math.multiplyExact</code> to throw on overflow. For durations use <code>java.time.Duration</code>.' },
    { trap: 'Comparing wrappers with <code>==</code>', code: `Integer a = 127, b = 127;
System.out.println(a == b);       // true  (cached)
Integer c = 128, d = 128;
System.out.println(c == d);       // false (different objects)
System.out.println(c.equals(d));  // true`, why: '<code>==</code> on objects asks “same object?”. Autoboxing calls <code>Integer.valueOf</code>, which caches −128..127. So small values happen to share objects.', fix: 'Use <code>equals</code> (or <code>Objects.equals</code> if either may be null) for wrappers. Prefer primitives when null is not a valid value.' },
    { trap: 'Unboxing <code>null</code>', code: `Map<String, Integer> stock = new HashMap<>();
int n = stock.get("apples");   // NullPointerException`, why: '<code>get</code> returns <code>null</code> for a missing key. Assigning that to an <code>int</code> unboxes it, and unboxing null throws.', fix: 'Use <code>stock.getOrDefault("apples", 0)</code>, or keep it as <code>Integer</code> and check for null.' },
    { trap: 'Integer division hidden in a double', code: `double avg = 7 / 2;           // 3.0, not 3.5
double ok  = 7 / 2.0;         // 3.5
double ok2 = (double) 7 / 2;  // 3.5`, why: 'The right side is computed first, with the operand types. <code>int / int</code> is integer division; the result 3 is widened to 3.0 only afterwards.', fix: 'Make at least one operand a <code>double</code> before dividing.' },
    { trap: '<code>double</code> for money', code: `System.out.println(0.1 + 0.2);   // 0.30000000000000004
BigDecimal total = new BigDecimal("0.10").add(new BigDecimal("0.20"));
System.out.println(total);       // 0.30`, why: '<code>double</code> is binary floating point (IEEE 754). Most decimal fractions cannot be stored exactly.', fix: 'Use <code>BigDecimal</code> built from <b>strings</b>, or store integer cents in a <code>long</code>.' },
    { trap: '<code>var</code> infers the narrowest literal type', code: `var count = 0;        // int, not long
count = 5_000_000_000L;   // compile error: possible lossy conversion
var price = 10;       // int, so price / 4 is integer division`, why: '<code>var</code> uses the type of the initialiser exactly. <code>0</code> is an <code>int</code> literal.', fix: 'Write the literal you mean (<code>0L</code>, <code>10.0</code>) or declare the type explicitly. <code>var</code> works only for local variables with an initialiser.' },
    { trap: 'Casts that change the number', code: `byte b = (byte) 200;       // -56
int i  = (int) 3_000_000_000L;   // -1294967296
int j  = (int) -3.99;      // -3 (toward zero)`, why: 'Narrowing integer casts keep only the low bits. <code>double</code> → <code>int</code> casts truncate toward zero.', fix: 'Check ranges first, or use <code>Math.toIntExact(long)</code>, which throws on overflow. Use <code>Math.round</code>/<code>floor</code>/<code>ceil</code> when you mean rounding.' }
  ],
  scenarios: [
    { title: 'Negative order totals after a sale', symptom: 'During a big promotion, a few reports show <b>negative</b> revenue for top products.', diagnose: '// the aggregation code\nint totalCents = 0;\nfor (Order o : orders) totalCents += o.amountCents();\n// one product: 2_400_000_000 cents in a day', cause: 'The running total was an <code>int</code>. Past 2,147,483,647 cents (about $21 million) it wrapped to a negative number. No exception was thrown.', fix: 'Use <code>long</code> for sums of money in cents (or <code>BigDecimal</code>), and <code>Math.addExact</code> where a silent wrap would be worse than a failure.', fixCode: `long totalCents = 0;
for (Order o : orders) {
    totalCents = Math.addExact(totalCents, o.amountCents());
}` },
    { title: 'NullPointerException on a line with no method call', symptom: 'Logs show <code>NullPointerException</code> at <code>int qty = item.getQuantity();</code>, but <code>item</code> is definitely not null.', diagnose: 'Java 14+ “helpful NPE” message:\nCannot invoke "java.lang.Integer.intValue()" because the return value of "Item.getQuantity()" is null', cause: '<code>getQuantity()</code> returns <code>Integer</code>, from a database column that can be null. Assigning it to <code>int</code> calls <code>intValue()</code> on null.', fix: 'Decide what missing means. Either make the column <code>NOT NULL</code> and the field primitive, or handle null explicitly.', fixCode: `Integer q = item.getQuantity();
int qty = (q != null) ? q : 0;
// or: int qty = Objects.requireNonNullElse(item.getQuantity(), 0);` },
    { title: 'Cache TTL far shorter than configured', symptom: 'Entries meant to live 30 days expire after a few hours.', diagnose: 'long ttlMs = 30 * 24 * 60 * 60 * 1000;\nSystem.out.println(ttlMs);   // -1702967296', cause: 'The product was computed in <code>int</code> and overflowed before it became a <code>long</code>. The cache library then got a wrapped, often negative, value.', fix: 'Use <code>java.time.Duration</code> instead of hand-multiplied numbers, or make the first factor a <code>long</code>.', fixCode: `Duration ttl = Duration.ofDays(30);
long ttlMs = ttl.toMillis();   // 2592000000` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        int max = Integer.MAX_VALUE;
        System.out.println(max + 1);
        System.out.println(max + 1L);
    }
}`, options: ['2147483648 twice', '-2147483648 then 2147483648', 'ArithmeticException', '-2147483648 twice'], answer: 1, run: true, expect: '-2147483648\n2147483648', explain: '<code>int + int</code> wraps around to <code>Integer.MIN_VALUE</code>. With <code>1L</code>, the int is widened to <code>long</code> first and the sum fits.' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        System.out.println((int) 3.99 + " " + (int) -3.99 + " "
            + Math.round(2.5) + " " + Math.round(-2.5));
    }
}`, options: ['4 -4 3 -3', '3 -3 3 -2', '3 -4 2 -2', '3 -3 3 -3'], answer: 1, run: true, expect: '3 -3 3 -2', explain: 'A cast truncates toward zero. <code>Math.round</code> is “add 0.5 and floor”, so 2.5 → 3 and −2.5 → −2.' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        Integer a = 127, b = 127;
        Integer c = 128, d = 128;
        System.out.println((a == b) + " " + (c == d) + " " + c.equals(d));
    }
}`, options: ['true true true', 'true false true', 'false false true', 'true false false'], answer: 1, run: true, expect: 'true false true', explain: 'Autoboxing uses <code>Integer.valueOf</code>, which returns cached objects for −128..127. 128 gets two different objects. So <code>==</code> (same object?) is false, and <code>equals</code> (same value?) is true.' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        char c = 'A';
        System.out.println(c + 1);
        System.out.println((char) (c + 1));
        c++;
        System.out.println(c);
    }
}`, options: ['B, B, B', '66, B, B', 'A1, B, B', '66, 66, B'], answer: 1, run: true, expect: '66\nB\nB', explain: '<code>char + int</code> is promoted to <code>int</code>, so it prints 66. Casting back gives <code>\'B\'</code>. <code>c++</code> keeps the type <code>char</code> (it has a hidden cast).' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        long a = 24 * 60 * 60 * 1000 * 1000;
        long b = 24L * 60 * 60 * 1000 * 1000;
        System.out.println(a);
        System.out.println(b);
    }
}`, options: ['86400000000 twice', '500654080 then 86400000000', 'Compile error: integer number too large', '-500654080 then 86400000000'], answer: 1, run: true, expect: '500654080\n86400000000', explain: 'The first product is done in <code>int</code> and wraps: 86,400,000,000 mod 2³² = 500,654,080. Only then does it become a <code>long</code>. Starting with <code>24L</code> makes every step 64-bit.' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        byte b = (byte) 200;
        double d = 0.1 + 0.2;
        System.out.println(b);
        System.out.println(d == 0.3);
    }
}`, options: ['200 and true', '-56 and false', '-56 and true', 'Compile error: 200 is out of range for byte'], answer: 1, run: true, expect: '-56\nfalse', explain: 'A <code>byte</code> holds −128..127. The cast keeps the low 8 bits, so 200 − 256 = −56. <code>0.1 + 0.2</code> is 0.30000000000000004 in binary, not 0.3. The cast is what lets the first line compile.' },
    { kind: 'concept', q: 'Which line does <b>not</b> compile?', code: `var a = 10;
var b = "hi";
var c;
var d = new java.util.ArrayList<String>();`, options: ['var a = 10;', 'var b = "hi";', 'var c;', 'var d = new java.util.ArrayList<String>();'], answer: 2, explain: '<code>var</code> needs an initialiser to infer the type from. It is also not allowed for fields, method parameters or <code>null</code> alone (<code>var x = null;</code>).' },
    { kind: 'concept', q: '<code>Integer count = null; int n = count;</code> What happens?', options: ['n is 0', 'Compile error', 'NullPointerException at run time', 'n is null'], answer: 2, explain: 'It compiles because unboxing is automatic. At run time Java calls <code>count.intValue()</code> on null and throws a <code>NullPointerException</code>.' }
  ],
  interview: [
    { q: 'List the primitive types and their sizes.', a: '<ul><li><code>byte</code> 8 bits, <code>short</code> 16, <code>int</code> 32, <code>long</code> 64: signed whole numbers.</li><li><code>float</code> 32, <code>double</code> 64: IEEE 754 floating point.</li><li><code>char</code> 16 bits: an unsigned UTF-16 code unit.</li><li><code>boolean</code>: <code>true</code>/<code>false</code> (its in-memory size is JVM-dependent).</li></ul><p>Sizes are fixed by the language spec on every platform, unlike C.</p>', lvl: 'core' },
    { q: 'What is the difference between a primitive and a reference type?', a: '<p>A primitive variable holds the value and can’t be <code>null</code>. A reference variable holds an arrow to an object, or <code>null</code>. Assigning a primitive copies the value. Assigning a reference copies the <i>arrow</i>, so both point at the same object.</p>', lvl: 'core' },
    { q: 'What are autoboxing and unboxing? Any pitfalls?', a: '<p>The compiler converts automatically between primitives and wrappers (<code>int</code> ↔ <code>Integer</code>), e.g. when adding to a <code>List&lt;Integer&gt;</code>.</p><ul><li>Unboxing <code>null</code> throws <code>NullPointerException</code>.</li><li><code>==</code> between wrappers compares references; it only “works” for cached values −128..127.</li><li>Boxing in hot loops creates garbage and is slower than primitives.</li></ul>', fu: 'Why is <code>Long sum = 0L; for (…) sum += i;</code> slow? (Each <code>+=</code> unboxes, adds and boxes a new <code>Long</code>.)', lvl: 'core' },
    { q: 'What happens on integer overflow in Java?', a: '<p>Integer math wraps around: <code>Integer.MAX_VALUE + 1 == Integer.MIN_VALUE</code>. No exception. Use <code>long</code>, <code>Math.addExact</code>/<code>multiplyExact</code>/<code>toIntExact</code> (which throw <code>ArithmeticException</code>), or <code>BigInteger</code>. Floating-point overflow gives <code>Infinity</code> instead.</p>', lvl: 'core' },
    { q: 'Explain widening and narrowing conversions.', a: '<p><b>Widening</b> (e.g. <code>int</code> → <code>long</code>) is automatic, because the bigger type can hold the value. (<code>long</code> → <code>double</code> can still lose precision.) <b>Narrowing</b> (e.g. <code>double</code> → <code>int</code>) needs a cast. Integers keep the low bits. Decimals are cut toward zero.</p>', lvl: 'core' },
    { q: 'What does <code>var</code> do, and when would you avoid it?', a: '<p>Since Java 10, <code>var</code> lets the compiler pick a local variable’s type from its starting value. The type still can’t change. It is only for locals (including <code>for</code> loops and try-with-resources), not fields or parameters.</p><p>Avoid it when the type isn’t obvious from the right side (<code>var x = service.load();</code>) or when the literal type matters (<code>var n = 0</code> is <code>int</code>).</p>', lvl: 'core' },
    { q: 'Why is <code>0.1 + 0.2 != 0.3</code>, and what do you use for money?', a: '<p><code>double</code> stores binary fractions, and 0.1 has no finite binary representation, so tiny rounding errors appear. For money use <code>BigDecimal</code> created from strings (<code>new BigDecimal("0.10")</code>) with an explicit <code>RoundingMode</code>, or integer minor units (cents) in a <code>long</code>.</p>', lvl: 'core' },
    { q: 'What are the default values of variables?', a: '<p><b>Fields</b> and array elements get defaults: <code>0</code>, <code>0.0</code>, <code>false</code>, <code>\'\\u0000\'</code> for char, and <code>null</code> for references. <b>Local variables</b> get no default. The compiler won’t let you read one before you assign it.</p>', lvl: 'core' },
    { q: 'Why does <code>short s = 1; s = s + 1;</code> fail but <code>s += 1;</code> compile?', a: '<p>Math on <code>byte</code>, <code>short</code> and <code>char</code> turns them into <code>int</code>. So <code>s + 1</code> is an <code>int</code>, and you need a cast to store it in a <code>short</code>. <code>s += 1</code> means <code>s = (short)(s + 1)</code>: it has a hidden cast.</p>', lvl: 'deep' },
    { q: 'What is <code>char</code> in Java, and why can one “character” need two?', a: '<p><code>char</code> is a 16-bit UTF-16 code unit. Characters outside the Basic Multilingual Plane (many emoji, some CJK) need two <code>char</code>s, a surrogate pair. So <code>"😀".length()</code> is 2. Use code-point APIs (<code>codePointAt</code>, <code>codePoints()</code>) when you need real characters.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Safe arithmetic', lang: 'java', code: `long totalCents = 0;
for (long c : lineItemCents) {
    totalCents = Math.addExact(totalCents, c);   // throws on overflow
}
int forApi = Math.toIntExact(totalCents);         // throws if > int range

BigDecimal price = new BigDecimal("19.99");
BigDecimal withTax = price.multiply(new BigDecimal("1.23"))
                          .setScale(2, RoundingMode.HALF_UP);`, note: 'Prefer <code>long</code> cents or <code>BigDecimal</code> for money. The <code>*Exact</code> methods turn silent bugs into visible exceptions.' },
    { title: 'Parsing text into numbers', lang: 'java', code: `int port = Integer.parseInt("8080");         // primitive
Integer boxed = Integer.valueOf("8080");    // wrapper (may be cached)
long big = Long.parseLong("3000000000");
double rate = Double.parseDouble("0.25");
boolean on = Boolean.parseBoolean("TRUE");  // true; anything else -> false

try {
    Integer.parseInt("80a");
} catch (NumberFormatException e) {
    System.out.println("bad number: " + e.getMessage());
}`, note: 'Config values, request parameters and CSV columns all arrive as text. <code>parseX</code> returns a primitive; <code>valueOf</code> returns a wrapper.' },
    { title: 'Entity fields: primitive or wrapper?', lang: 'java', code: `@Entity
class Product {
    @Id Long id;            // wrapper: null means "not saved yet"
    int stock;              // primitive: column is NOT NULL, default 0
    Integer discountPct;    // wrapper: column is nullable
    BigDecimal price;       // never double for money
}`, note: 'Use a wrapper when <code>null</code> is a meaningful state (nullable column, unsaved ID); otherwise a primitive avoids unboxing NPEs.' }
  ]
});

IA.register({
  track: 'java',
  slug: 'java-arrays-strings-basics',
  title: 'Arrays & strings basics',
  tagline: 'An <b>array</b> is a fixed-size row of slots you reach by index, starting at 0. A <b>String</b> is an immutable object holding text: every “change” returns a new String. Learn creating and indexing arrays, the String methods you use daily, <code>StringBuilder</code> for building text, and text blocks (Java 15+) for multi-line strings.',
  tldr: {
    problem: 'Arrays don’t grow and throw on a bad index. Strings never change in place, so <code>s.trim();</code> on its own does nothing, <code>==</code> compares objects not text, and <code>+=</code> in a loop quietly gets slow.',
    model: '<b>Array</b>: <code>length</code> slots, indexes <code>0 … length-1</code>, filled with defaults (0, false, null). <b>String</b>: immutable; methods return new Strings; compare with <code>equals</code>. <b>StringBuilder</b>: one mutable buffer you <code>append</code> to, then <code>toString()</code>.',
    hook: '“Why are Strings immutable?” They can be shared safely (the string pool, map keys, threads), their hash code can be cached, and security-sensitive values like file paths can’t change after being checked.',
    facts: [
      { v: '0', l: 'the first index of every Java array and String. <code>arr[arr.length]</code> throws <code>ArrayIndexOutOfBoundsException</code>' },
      { v: 'Java 15', l: 'text blocks (<code>"""</code>) became a standard feature (JEP 378)' },
      { v: 'fixed', l: 'an array’s length is set when it is created and can never change; use <code>ArrayList</code> when you need to grow' }
    ]
  },
  intro: {
    what: 'An <b>array</b> stores several values of the same type in numbered slots: <code>int[] scores = new int[3];</code> gives you <code>scores[0]</code>, <code>scores[1]</code> and <code>scores[2]</code>. A <b>String</b> holds text such as <code>"Hello"</code>. Strings come with many methods (<code>length()</code>, <code>toUpperCase()</code>, <code>substring()</code>…), and none of them change the original: they hand back a new String.',
    analogy: { icon: '🏨', title: 'Hotel corridor and printed signs', text: 'An array is a hotel corridor with a fixed number of rooms, numbered from 0. You can walk straight to room 3, but you can’t add a room. A String is a printed sign: to “change” it you print a new sign. A <code>StringBuilder</code> is a whiteboard: you keep writing on it, then print the final sign once.' },
    steps: [
      { t: 'Create an array', d: 'Either give a size (slots get default values) or list the values.', code: 'int[] counts = new int[4];        // {0, 0, 0, 0}\nString[] days = {"Mon", "Tue", "Wed"};' },
      { t: 'Read, write, loop', d: 'Use <code>[index]</code> and the <code>length</code> field. Print with <code>Arrays.toString</code>.', code: 'days[0] = "Monday";\nfor (int i = 0; i < days.length; i++) System.out.println(days[i]);\nSystem.out.println(Arrays.toString(counts));' },
      { t: 'Use String methods', d: 'Each returns a value; keep it.', code: 'String s = " Ada Lovelace ";\nString name = s.trim();              // "Ada Lovelace"\nint space = name.indexOf(\' \');       // 3\nString first = name.substring(0, space); // "Ada"\nboolean same = first.equals("Ada");   // true' },
      { t: 'Build text with StringBuilder', d: 'When you join many pieces, append to one buffer.', code: 'StringBuilder sb = new StringBuilder();\nfor (String d : days) sb.append(d).append(\';\');\nString result = sb.toString();' },
      { t: 'Write multi-line text with a text block', d: 'Java 15+: three quotes, a newline, then your text.', code: 'String sql = """\n    SELECT id, name\n    FROM users\n    WHERE active\n    """;' }
    ],
    terms: [
      ['index', 'The position of an element, from 0 to <code>length - 1</code>.'],
      ['<code>length</code> vs <code>length()</code>', 'Arrays have a <code>length</code> field; Strings have a <code>length()</code> method; lists have <code>size()</code>.'],
      ['immutable', 'Cannot be changed after creation. All String objects are immutable.'],
      ['<code>StringBuilder</code>', 'A mutable sequence of characters for building text efficiently.'],
      ['text block', 'A multi-line string literal between <code>"""</code> delimiters, with common indentation removed.'],
      ['<code>equals</code>', 'Compares contents. <code>==</code> compares whether two references point to the same object.']
    ]
  },
  visual: {
    title: 'Slots, immutable Strings and a growing buffer',
    caption: 'Choose <b>Arrays</b>, <b>String methods</b>, <b>StringBuilder</b> or <b>Text blocks</b>, then <b>Play</b> or <b>Step</b>. Watch array slots fill by index, String methods hand back new objects, and one StringBuilder buffer being reused.'
  },
  gotchas: [
    { trap: 'Ignoring the result of a String method', code: `String email = "  Ada@Example.com ";
email.trim();
email.toLowerCase();               // both results thrown away
email = email.trim().toLowerCase(); // keep the result`, why: 'Strings are immutable. Methods return a new String; the original never changes.', fix: 'Assign the result (often back to the same variable). IDEs warn about “result of method call ignored”.' },
    { trap: 'Comparing Strings with <code>==</code>', code: `String a = "hi";
String b = new String("hi");
System.out.println(a == b);       // false: different objects
System.out.println(a.equals(b));  // true: same text`, why: '<code>==</code> checks whether two references point to the same object. Literals are shared through the string pool, so <code>==</code> can appear to work in tests and then fail for strings read from input.', fix: 'Always use <code>equals</code> (or <code>equalsIgnoreCase</code>). Write <code>"admin".equals(role)</code> to be null-safe.' },
    { trap: 'Printing an array directly', code: `int[] nums = {1, 2, 3};
System.out.println(nums);                   // [I@1b6d3586 (type + hash)
System.out.println(Arrays.toString(nums));  // [1, 2, 3]`, why: 'Arrays don’t override <code>toString</code>, so you get the type code <code>[I</code> (int array) and an identity hash.', fix: 'Use <code>Arrays.toString</code>, or <code>Arrays.deepToString</code> for nested arrays. Likewise compare contents with <code>Arrays.equals</code>, not <code>==</code> or <code>.equals</code>.' },
    { trap: 'Index out of bounds', code: `String[] parts = "a,b".split(",");
String third = parts[2];   // ArrayIndexOutOfBoundsException
"abc".charAt(3);           // StringIndexOutOfBoundsException`, why: 'Valid indexes are <code>0</code> to <code>length - 1</code>. Java checks every access at run time.', fix: 'Check <code>length</code> before reading, and loop with <code>i &lt; arr.length</code>.' },
    { trap: '<code>split</code> drops trailing empty strings', code: `"a,b,,".split(",").length       // 2, not 4
"a,b,,".split(",", -1).length   // 4: keep empties
"1.2.3".split(".").length       // 0! split takes a regex`, why: '<code>split(regex)</code> removes trailing empty strings, and its argument is a <b>regular expression</b>, where <code>.</code> matches any character.', fix: 'Pass a limit of <code>-1</code> to keep empty fields (CSV!). Escape regex characters: <code>split("\\\\.")</code>, or use <code>Pattern.quote(".")</code>.' },
    { trap: '<code>+=</code> on a String inside a big loop', code: `String out = "";
for (String line : lines) out += line + "\\n";   // copies everything each pass

StringBuilder sb = new StringBuilder();
for (String line : lines) sb.append(line).append('\\n');`, why: 'Each <code>+=</code> creates a new String and copies all previous characters, so the work grows with the square of the number of lines.', fix: 'Use <code>StringBuilder</code>, <code>String.join</code> or <code>Collectors.joining</code>. (A single <code>a + b + c</code> expression is fine: the compiler optimises it.)' }
  ],
  scenarios: [
    { title: 'Login works in tests, fails for real users', symptom: 'An admin check <code>if (role == "ADMIN")</code> passes in unit tests, but real admins loaded from the database are refused.', diagnose: 'String fromDb = resultSet.getString("role");\nSystem.out.println(fromDb + " " + (fromDb == "ADMIN") + " " + fromDb.equals("ADMIN"));\n// ADMIN false true', cause: 'In the test both sides were string <b>literals</b>, which share one pooled object, so <code>==</code> was true. The value from the database is a different object with the same text.', fix: 'Compare text with <code>equals</code>, literal first. Better still, map roles to an <code>enum</code> at the edge of the system.', fixCode: `if ("ADMIN".equals(role)) { ... }

enum Role { ADMIN, USER }
Role r = Role.valueOf(fromDb);   // then: if (r == Role.ADMIN) is correct for enums` },
    { title: 'CSV export takes minutes for 50,000 rows', symptom: 'A report endpoint times out. CPU is at 100% and the profiler shows most time in array copying.', diagnose: 'String body = "";\nfor (Row r : rows) {\n    body += r.id() + "," + r.name() + "\\n";\n}', cause: 'String concatenation in a loop builds a new, ever longer String on every row, copying all previous text each time: roughly quadratic work.', fix: 'Append to a single <code>StringBuilder</code> (ideally sized up front), or stream rows straight to the response writer.', fixCode: `StringBuilder sb = new StringBuilder(rows.size() * 32);
for (Row r : rows) {
    sb.append(r.id()).append(',').append(r.name()).append('\\n');
}
String body = sb.toString();` },
    { title: 'Imported addresses lose their last columns', symptom: 'Some imported customers have no postcode, and a few rows crash with <code>ArrayIndexOutOfBoundsException: Index 4 out of bounds for length 3</code>.', diagnose: 'String line = "12,Main St,Springfield,,";\nString[] f = line.split(",");\nSystem.out.println(f.length);   // 3', cause: '<code>split</code> drops trailing empty fields, so a row with empty last columns returns a shorter array than the header suggests.', fix: 'Use <code>split(",", -1)</code> to keep every field, and check the length. For real CSV (quotes, embedded commas) use a CSV library.', fixCode: `String[] f = line.split(",", -1);   // length 5
if (f.length != 5) throw new IllegalArgumentException("bad row: " + line);` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        String s = "hello";
        s.toUpperCase();
        System.out.println(s);
        s = s.toUpperCase();
        System.out.println(s);
    }
}`, options: ['HELLO, HELLO', 'hello, HELLO', 'hello, hello', 'HELLO, hello'], answer: 1, run: true, expect: 'hello\nHELLO', explain: 'Strings are immutable. The first call builds "HELLO" and throws it away. Only after assigning the result does <code>s</code> point at the upper-case String.' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        String a = "hi";
        String b = new String("hi");
        System.out.println((a == b) + " " + a.equals(b) + " " + (a == b.intern()));
    }
}`, options: ['true true true', 'false true true', 'false true false', 'false false true'], answer: 1, run: true, expect: 'false true true', explain: '<code>new String</code> always creates a separate object, so <code>==</code> is false. <code>equals</code> compares text. <code>intern()</code> returns the pooled copy, which is the same object as the literal <code>"hi"</code>.' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        int[] nums = new int[3];
        String[] names = new String[2];
        boolean[] flags = new boolean[1];
        System.out.println(nums[1] + " " + names[0] + " " + flags[0]);
    }
}`, options: ['0 null false', 'Compile error: not initialised', 'null null null', '0 "" false'], answer: 0, run: true, expect: '0 null false', explain: 'Array elements always start with default values: 0 for numbers, <code>null</code> for references, <code>false</code> for booleans. (Local <i>variables</i> have no default; array <i>elements</i> do.)' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        String s = "abcdef";
        System.out.println(s.substring(1, 4) + " " + s.indexOf('d') + " " + s.length() + " " + s.charAt(0));
    }
}`, options: ['bcde 3 6 a', 'bcd 3 6 a', 'bcd 4 6 a', 'abcd 3 5 b'], answer: 1, run: true, expect: 'bcd 3 6 a', explain: '<code>substring(1, 4)</code> takes indexes 1, 2, 3 (end excluded): "bcd". <code>indexOf</code> and <code>charAt</code> are 0-based, so <code>d</code> is at 3 and <code>charAt(0)</code> is <code>a</code>.' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        StringBuilder sb = new StringBuilder("ab");
        sb.append("cd").reverse();
        System.out.println(sb);
        sb.insert(0, 'x').setLength(3);
        System.out.println(sb);
    }
}`, options: ['abcd, xab', 'dcba, xdc', 'dcba, xdcba', 'dcba, dcb'], answer: 1, run: true, expect: 'dcba\nxdc', explain: 'A StringBuilder changes in place and its methods return the same builder, so calls chain. "abcd" reversed is "dcba". Inserting x at 0 gives "xdcba", and <code>setLength(3)</code> cuts it to "xdc".' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        System.out.println("a,b,,".split(",").length + " " + ",a".split(",").length);
        System.out.println('a' + 'b' + "c");
    }
}`, options: ['4 2, then abc', '2 2, then 195c', '2 1, then abc', '4 1, then 195c'], answer: 1, run: true, expect: '2 2\n195c', explain: '<code>split</code> removes <b>trailing</b> empty strings (so 2), but keeps a leading one (<code>["", "a"]</code>, also 2). <code>\'a\' + \'b\'</code> is <code>char + char</code>, which is int addition: 97 + 98 = 195; only then is <code>"c"</code> appended.' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        String t = """
            Hi
              there
            """;
        System.out.println(t.length() + " " + t.lines().count());
    }
}`, options: ['11 2', '35 2', '10 2', '11 3'], answer: 0, run: true, expect: '11 2', explain: 'The common indentation (12 spaces, set by the content and the closing <code>"""</code>) is stripped. The text is <code>"Hi\\n  there\\n"</code>: 2 + 1 + 7 + 1 = 11 characters, and <code>lines()</code> sees 2 lines.' },
    { kind: 'concept', q: 'You need a list of user IDs that grows as you read a file. What should you use?', options: ['int[] with a large size like 1,000,000', 'An ArrayList<Integer> (or a resizable buffer)', 'A String with IDs joined by commas', 'A new array for each ID'], answer: 1, explain: 'Arrays have a fixed length. <code>ArrayList</code> grows automatically (internally it copies to a bigger array when full). Use plain arrays when the size is known up front or for performance-critical primitive data.' }
  ],
  interview: [
    { q: 'How do you create and initialise an array in Java?', a: '<ul><li><code>int[] a = new int[5];</code>: five slots with default values.</li><li><code>int[] b = {1, 2, 3};</code>: an initialiser, only in a declaration.</li><li><code>new int[] {1, 2, 3}</code>: an anonymous array, usable anywhere (e.g. as an argument).</li><li><code>int[][] grid = new int[3][4];</code>: an array of arrays.</li></ul><p>Fill with <code>Arrays.fill(a, -1)</code>.</p>', lvl: 'core' },
    { q: 'Why are Strings immutable in Java?', a: '<ul><li><b>Sharing:</b> literals live in the string pool and can be reused safely.</li><li><b>Hashing:</b> the hash code can be cached, making Strings fast <code>HashMap</code> keys whose hash can’t change after insertion.</li><li><b>Thread safety:</b> immutable objects can be shared between threads without locking.</li><li><b>Security:</b> a path or URL can’t be changed after it has been validated.</li></ul>', lvl: 'core' },
    { q: 'What is the difference between <code>==</code> and <code>equals</code> for Strings?', a: '<p><code>==</code> checks whether two references point to the same object. <code>equals</code> compares the characters. Literals are interned (pooled), so two identical literals are <code>==</code>, but strings built at run time, read from input or created with <code>new</code> usually are not.</p>', lvl: 'core' },
    { q: 'String vs StringBuilder vs StringBuffer?', a: '<ul><li><b>String</b>: immutable.</li><li><b>StringBuilder</b>: mutable, not synchronised; the default choice for building text in one thread.</li><li><b>StringBuffer</b>: mutable and synchronised (older, Java 1.0). Rarely needed today.</li></ul>', fu: 'Does <code>"a" + b + "c"</code> create a StringBuilder? (Before Java 9, javac generated one; since Java 9 it uses <code>invokedynamic</code> with <code>StringConcatFactory</code>. Either way, a single expression is fine; loops are the problem.)', lvl: 'core' },
    { q: 'Name some commonly used String methods.', a: '<p><code>length</code>, <code>charAt</code>, <code>substring</code>, <code>indexOf</code>/<code>lastIndexOf</code>, <code>contains</code>, <code>startsWith</code>/<code>endsWith</code>, <code>equals</code>/<code>equalsIgnoreCase</code>, <code>toUpperCase</code>/<code>toLowerCase</code>, <code>trim</code>/<code>strip</code>, <code>replace</code>, <code>split</code>, <code>join</code>, <code>isEmpty</code>/<code>isBlank</code>, <code>repeat</code>, <code>formatted</code>. <code>strip</code>, <code>isBlank</code>, <code>repeat</code> and <code>lines</code> are Java 11+; <code>formatted</code> is Java 15+.</p>', lvl: 'core' },
    { q: 'What are text blocks, and how is indentation handled?', a: '<p>Java 15+ multi-line literals between <code>"""</code> delimiters. The opening <code>"""</code> must end its line. The compiler removes the <b>incidental</b> indentation: the smallest leading whitespace across the content lines and the closing delimiter. Line endings are normalised to <code>\\n</code>. A closing <code>"""</code> on its own line adds a trailing newline; a <code>\\</code> at the end of a line joins it with the next.</p>', lvl: 'core' },
    { q: 'How do you compare, sort or copy arrays?', a: '<ul><li>Compare: <code>Arrays.equals(a, b)</code> (<code>a.equals(b)</code> is reference equality).</li><li>Sort: <code>Arrays.sort(a)</code>.</li><li>Copy: <code>Arrays.copyOf(a, newLength)</code>, <code>a.clone()</code>, or <code>System.arraycopy</code>.</li><li>Print: <code>Arrays.toString(a)</code>.</li></ul>', lvl: 'core' },
    { q: 'What happens with <code>arr[-1]</code> or <code>arr[arr.length]</code>?', a: '<p>Both throw <code>ArrayIndexOutOfBoundsException</code> at run time. The JVM checks bounds on every access, which prevents memory corruption. The JIT can often remove the check inside loops when it can prove the index is safe.</p>', lvl: 'core' },
    { q: 'Are arrays objects in Java?', a: '<p>Yes. Arrays live on the heap, have a <code>length</code> field, can be <code>null</code>, and inherit from <code>Object</code>. A variable of type <code>int[]</code> holds a reference, so assigning it to another variable shares the same array.</p>', fu: 'What is array covariance? (<code>String[]</code> is a subtype of <code>Object[]</code>; storing an Integer into it compiles but throws <code>ArrayStoreException</code>.)', lvl: 'deep' },
    { q: 'Why can <code>"😀".length()</code> be 2?', a: '<p><code>length()</code> counts UTF-16 <code>char</code> units, not characters. Code points above U+FFFF are stored as a surrogate pair of two chars. Use <code>s.codePointCount(0, s.length())</code> or <code>s.codePoints()</code> to count real characters. Internally, since Java 9 (compact strings), Latin-1-only strings use one byte per char, but the API still reports UTF-16 lengths.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Everyday array helpers', lang: 'java', code: `import java.util.Arrays;

int[] prices = {30, 10, 20};
Arrays.sort(prices);                          // [10, 20, 30]
int idx = Arrays.binarySearch(prices, 20);    // 1 (array must be sorted)
int[] bigger = Arrays.copyOf(prices, 5);      // [10, 20, 30, 0, 0]
int total = Arrays.stream(prices).sum();      // 60
System.out.println(Arrays.toString(bigger));`, note: '<code>java.util.Arrays</code> has the sort, search, copy, fill and print helpers you would otherwise write by hand.' },
    { title: 'Cleaning user input', lang: 'java', code: `static String normaliseEmail(String raw) {
    if (raw == null || raw.isBlank()) {
        throw new IllegalArgumentException("email required");
    }
    String email = raw.strip().toLowerCase(java.util.Locale.ROOT);
    int at = email.indexOf('@');
    if (at <= 0 || at != email.lastIndexOf('@') || at == email.length() - 1) {
        throw new IllegalArgumentException("invalid email: " + raw);
    }
    return email;
}`, note: 'Pass <code>Locale.ROOT</code> to case conversions on identifiers: under some locales (Turkish) <code>"I".toLowerCase()</code> is not <code>"i"</code>.' },
    { title: 'SQL in a text block', lang: 'java', code: `String sql = """
    SELECT id, email
    FROM users
    WHERE status = ?
      AND created_at > ?
    ORDER BY created_at DESC
    """;
List<User> users = jdbcTemplate.query(sql, userMapper, "ACTIVE", since);`, note: 'Text blocks keep SQL readable. Keep values as <code>?</code> parameters; never build SQL by concatenating user input (SQL injection).' }
  ]
});

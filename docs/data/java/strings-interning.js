IA.register({
  track: 'java',
  slug: 'strings-interning',
  title: 'Strings, interning & text',
  tagline: 'A String is an object that never changes. Inside, it holds a <code>byte[]</code> and a flag for the encoding. Literals are shared; strings built at runtime are not. <code>length()</code> counts 16-bit units, not characters. Know these three facts and most String bugs make sense.',
  tldr: {
    problem: '<code>==</code> on Strings passes tests and fails in production. A <code>+=</code> loop takes minutes. An enum lookup breaks on a Turkish server. Names with emoji turn into “?” after cutting.',
    model: '<b>Identity:</b> literals and compile-time constants share one pooled object. Anything built at runtime is a new object. <b>Storage:</b> Latin-1 text uses 1 byte per char, other text 2 (Java 9+). <b>Text:</b> a <code>char</code> is one 16-bit unit. One visible character can be 1, 2 or many chars.',
    hook: '“How many objects does <code>new String("hi")</code> create?” One new String on the heap, plus the pooled literal <code>"hi"</code> if no one has used that literal yet. Answer “one or two” and explain why.',
    facts: [
      { v: 'Java 9', l: 'brought compact strings (Latin-1 text stored in 1 byte per char) and faster <code>invokedynamic</code> string joining' },
      { v: 'Java 15', l: 'made text blocks (<code>"""…"""</code>) standard, after previews in 13 and 14' },
      { v: 'Java 18', l: 'made UTF-8 the default charset. Before that, <code>new String(bytes)</code> used the OS encoding' }
    ]
  },
  intro: {
    what: 'A <code>String</code> is text that never changes once created. <code>toUpperCase()</code> or <code>replace()</code> return a <b>new</b> String. Since Strings can’t change, Java can share them. Identical literals in your code all point to one copy in a shared table (the <b>string pool</b>). Strings built at runtime, from input, joining or files, are new objects.',
    analogy: { icon: '🖨️', title: 'Printed signs vs handwritten notes', text: 'The company prints one official “EXIT” sign, and every office uses it (the pool). Write “EXIT” on a sticky note and the words match, but it is a different paper. “Is this the same sheet?” (<code>==</code>) depends on where the sign came from. “Do the words match?” (<code>equals</code>) always works.' },
    steps: [
      { t: 'Compare with equals', d: '<code>==</code> asks if two variables point to the same object. For text, you almost always want <code>a.equals(b)</code> or <code>Objects.equals(a, b)</code>.' },
      { t: 'Literals are pooled', d: '<code>"hi" == "hi"</code> is true because both literals are the same pooled object. <code>new String("hi") == "hi"</code> is false.' },
      { t: 'Build big strings with StringBuilder', d: 'Each <code>+=</code> creates a whole new String. In a loop, append to a <code>StringBuilder</code> instead.', code: 'var sb = new StringBuilder();\nfor (var line : lines) sb.append(line).append(\'\\n\');\nString report = sb.toString();' },
      { t: 'Text blocks for multi-line text', d: 'Java 15+. Indentation that all lines share is removed for you.', code: 'String sql = """\n    SELECT id, name\n    FROM customer\n    WHERE id = ?\n    """;' },
      { t: 'Text is Unicode', d: 'An emoji such as 👍 is two <code>char</code>s. Always name the charset and locale: <code>StandardCharsets.UTF_8</code>, <code>Locale.ROOT</code>.' }
    ],
    terms: [
      ['string pool', 'One table of shared Strings for the whole JVM. Literals go in automatically; <code>intern()</code> adds others.'],
      ['interning', 'Swapping a String for the pooled one with the same text.'],
      ['compact strings', 'Java 9+ storage: a <code>byte[]</code> plus a coder, LATIN1 (1 byte per char) or UTF16 (2 bytes per char).'],
      ['code unit / code point', 'A <code>char</code> (16 bits) vs a Unicode character number (up to U+10FFFF). Numbers above U+FFFF need two chars.'],
      ['surrogate pair', 'The two chars that together make one character above U+FFFF, such as most emoji.'],
      ['text block', 'A <code>"""</code>-delimited multi-line literal (Java 15+).']
    ]
  },
  visual: {
    title: 'Pooled or not, and what is inside',
    caption: 'Pick a scenario and press <b>Play</b>. Arrows into the dashed region point at <b>pooled</b> Strings. <b>Constant folding</b> shows how one <code>final</code> keyword changes <code>==</code>. <b>Compact strings</b> opens the byte array. <b>+= in a loop</b> shows the garbage it leaves behind.'
  },
  gotchas: [
    { trap: 'Comparing Strings with ==', code: `if (status == "ACTIVE") { … }            // true for literals, false for request.getParameter("status")`, why: 'Literals are the same pooled object, so tests with literals pass. Strings from HTTP, JSON, JDBC or joining are new objects.', fix: 'Use <code>"ACTIVE".equals(status)</code> (null-safe, literal first) or <code>Objects.equals</code>. Better, turn it into an enum once, where it enters.' },
    { trap: 'Case conversion without a locale', code: `"title".toUpperCase();            // "TİTLE" with default locale tr_TR
Status.valueOf(input.toUpperCase());   // IllegalArgumentException on Turkish servers`, why: '<code>toUpperCase()</code> and <code>toLowerCase()</code> use the JVM’s default locale. In Turkish and Azeri, i/I map to dotted İ and dotless ı.', fix: 'For identifiers, keys and protocols use <code>toUpperCase(Locale.ROOT)</code>. Use the user’s locale only for text shown to humans. <code>equalsIgnoreCase</code> doesn’t depend on locale.' },
    { trap: '<code>+=</code> in a loop', code: `String csv = "";
for (Row r : rows) csv += r.toCsv() + "\\n";   // O(n²) copying`, why: 'Each pass makes a new String and copies everything so far. Java 9 made one <code>+</code> expression faster, but the copying between passes stays.', fix: 'Use <code>StringBuilder</code>, <code>String.join</code>, <code>Collectors.joining</code>, or write straight to a <code>Writer</code>.' },
    { trap: 'Cutting through a surrogate pair', code: `String shortName = name.substring(0, 20);   // may split an emoji in half
shortName.getBytes(UTF_8);                  // lone surrogate encoded as '?'`, why: '<code>substring</code> counts chars. Index 20 can land between the two halves of an emoji. The broken half becomes “?” when encoded.', fix: 'Cut by whole characters: <code>name.substring(0, name.offsetByCodePoints(0, n))</code>. First check the string has at least n characters. For what users see as characters, use <code>BreakIterator</code>.' },
    { trap: 'Equal-looking text that isn’t equal', code: `"é".equals("e\\u0301");     // false: precomposed vs e + combining accent
"ﬁ".equals("fi");           // false: ligature`, why: 'Unicode has several encodings for the same visible text. Input from macOS file names, copy-paste or different keyboards can differ.', fix: 'Bring text to one standard form where it enters: <code>Normalizer.normalize(s, Normalizer.Form.NFC)</code>. Do it before storing or comparing. Use NFKC for identifiers where look-alikes must match.' },
    { trap: '<code>split</code> takes a regex and drops trailing empties', code: `"a.b.c".split(".");          // [] (every char matches ".")
"a,b,,".split(",");          // [a, b]: trailing empty strings removed
"a,b,,".split(",", -1);      // [a, b, , ]`, why: 'The argument is a regular expression, and the one-argument form removes trailing empty strings.', fix: 'Escape metacharacters (<code>"\\\\."</code> or <code>Pattern.quote(".")</code>). Use a limit of <code>-1</code> to keep empty fields when parsing CSV-like data, or better, use a real CSV parser.' },
    { trap: 'Converting bytes without a charset', code: `new String(bytes);            // Java ≤ 17: platform charset (e.g. windows-1252, or ASCII in a bare container)
Files.readString(path);       // always UTF-8, on any version`, why: 'Before Java 18 the default charset came from the OS. The same code decoded differently on a laptop and in a container. Java 18 made UTF-8 the default for most APIs.', fix: 'Always pass <code>StandardCharsets.UTF_8</code> (or the real encoding). On Java 18+, <code>-Dfile.encoding=COMPAT</code> brings back the old behaviour during a migration.' }
  ],
  scenarios: [
    { title: 'Account deactivation failed only on the Istanbul cluster',
      symptom: '<code>IllegalArgumentException: No enum constant Status.İNACTİVE</code>. Same build, same data; only servers in one region failed.',
      diagnose: `Status s = Status.valueOf(request.status().toUpperCase());   // "inactive" → "İNACTİVE"
$ java -XshowSettings:properties -version 2>&1 | grep user.language
    user.language = tr`,
      cause: 'Those hosts had a Turkish default locale. <code>toUpperCase()</code> maps “i” to “İ” (U+0130), so the enum name didn’t match.',
      fix: 'Use <code>Locale.ROOT</code> for machine strings, or a case-insensitive lookup. Fix <code>-Duser.language</code> / <code>LANG</code> in the container image, so every server behaves the same.',
      fixCode: `Status s = Status.valueOf(request.status().toUpperCase(Locale.ROOT));
// or
Status s = Arrays.stream(Status.values())
    .filter(v -> v.name().equalsIgnoreCase(request.status()))
    .findFirst().orElseThrow(() -> new BadRequest("status"));` },
    { title: 'Customer names showed “?” in the mobile app',
      symptom: 'Display names ending in an emoji sometimes appeared as <code>Anna ?</code>. The database held the “?” character. The original input was fine.',
      diagnose: `String display = name.length() > 20 ? name.substring(0, 20) : name;   // code units, not characters`,
      cause: 'Sometimes char 20 was the first half of an emoji. <code>substring</code> kept only that half. UTF-8 encoding turned it into “?”.',
      fix: 'Cut by whole characters (or by what users see as one character). Add test data with emoji and accents.',
      fixCode: `static String truncate(String s, int maxCodePoints) {
  if (s.codePointCount(0, s.length()) <= maxCodePoints) return s;
  return s.substring(0, s.offsetByCodePoints(0, maxCodePoints));
}` },
    { title: 'Export job went from 4 seconds to 40 minutes',
      symptom: 'A nightly CSV export got far slower as the customer table grew from 20k to 400k rows. CPU sat at 100%. The GC log showed constant collections.',
      diagnose: `String out = "";
for (Customer c : customers) {
  out += c.id() + "," + c.name() + "\\n";    // copies the whole output every row
}`,
      cause: 'Quadratic copying: growing the table 20× made the work about 400× bigger, and every iteration left the previous multi-megabyte String as garbage.',
      fix: 'Write rows straight to the output, or use a StringBuilder sized up front.',
      fixCode: `try (var w = Files.newBufferedWriter(path, StandardCharsets.UTF_8)) {
  for (Customer c : customers) {
    w.append(Long.toString(c.id())).append(',').append(csvEscape(c.name())).append('\\n');
  }
}` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        String a = "hello";
        String b = "hel" + "lo";
        String p = "hel";
        String c = p + "lo";
        System.out.println((a == b) + " " + (a == c) + " " + (a == c.intern()));
    }
}`, options: ['true true true', 'true false true', 'false false true', 'true false false'], answer: 1, explain: '<code>"hel" + "lo"</code> is joined at compile time into the pooled literal. <code>p + "lo"</code> runs at runtime and makes a new String. <code>intern()</code> returns the pooled copy. Prints <b>true false true</b>.', run: true, expect: 'true false true' },
    { kind: 'predict', q: 'One small change: <code>h</code> is final. What does this print?', code: `public class Main {
    public static void main(String[] args) {
        final String h = "hel";
        String a = h + "lo";
        System.out.println(a == "hello");
    }
}`, options: ['true', 'false', 'Compile error', 'It depends on the JIT'], answer: 0, explain: 'A <code>final</code> local set to a constant is itself a constant. So <code>h + "lo"</code> is known at compile time. The compiler turns it into <code>"hello"</code>, which is pooled. Prints <b>true</b>.', run: true, expect: 'true' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        String s = "a\\uD83D\\uDC4D";   // "a👍"
        System.out.println(s.length() + " " + s.codePoints().count());
    }
}`, options: ['2 2', '3 2', '3 3', '2 1'], answer: 1, explain: '👍 (U+1F44D) is above U+FFFF, so it needs two chars. <code>length()</code> counts chars (3). <code>codePoints()</code> counts real characters (2). Prints <b>3 2</b>.', run: true, expect: '3 2' },
    { kind: 'predict', q: 'split surprises. What does this print?', code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        System.out.println("a.b.c".split(".").length);
        System.out.println("a,b,,".split(",").length);
        System.out.println(Arrays.toString("a.b".split("\\\\.")));
    }
}`, options: ['3 / 4 / [a, b]', '0 / 2 / [a, b]', '0 / 4 / [a.b]', '5 / 2 / [a, b]'], answer: 1, explain: '<code>"."</code> is a regex for any character, so every position splits. All pieces are empty, and trailing empties are removed: 0. <code>"a,b,,"</code> loses its two trailing empties: 2. The escaped dot splits properly. Prints <b>0</b>, <b>2</b>, <b>[a, b]</b>.', run: true, expect: '0\n2\n[a, b]' },
    { kind: 'predict', q: 'StringBuilder equality. What does this print?', code: `public class Main {
    public static void main(String[] args) {
        StringBuilder a = new StringBuilder("x");
        StringBuilder b = new StringBuilder("x");
        System.out.println(a.equals(b) + " " + a.toString().equals(b.toString()) + " " + (a.compareTo(b) == 0));
    }
}`, options: ['true true true', 'false true true', 'false true false', 'Compile error: StringBuilder is not Comparable'], answer: 1, explain: '<code>StringBuilder</code> doesn’t override <code>equals</code>, so it asks “same object?”: false. Comparing the Strings works. Since Java 11, StringBuilder implements <code>Comparable&lt;StringBuilder&gt;</code>, comparing contents. Prints <b>false true true</b>.', run: true, expect: 'false true true' },
    { kind: 'predict', q: 'A text block. What does this print?', code: `public class Main {
    public static void main(String[] args) {
        String t = """
            a
              b
            """;
        System.out.println(t.length());
        System.out.print(t.replace(' ', '.'));
    }
}`, options: ['6 / a / ..b', '8 / a / ..b', '30 / ……a / ……b', '5 / a / ..b'], answer: 0, explain: 'The closing <code>"""</code> sits at the same indentation as <code>a</code>, so 12 spaces of “incidental” indentation are removed from every line. The content is <code>"a\\n  b\\n"</code>: 6 chars, and the trailing newline comes from the line break before the closing delimiter. Prints <b>6</b>, <b>a</b>, <b>..b</b>.', run: true, expect: '6\na\n..b' },
    { kind: 'predict', q: 'Locale-sensitive case mapping. What does this print?', code: `import java.util.Locale;

public class Main {
    public static void main(String[] args) {
        String s = "title";
        System.out.println(s.toUpperCase(Locale.ROOT).equals("TITLE"));
        System.out.println(s.toUpperCase(Locale.forLanguageTag("tr")).equals("TITLE"));
    }
}`, options: ['true / true', 'true / false', 'false / false', 'false / true'], answer: 1, explain: 'In Turkish, lowercase <code>i</code> upper-cases to <code>İ</code> (U+0130, I with a dot above), giving “TİTLE”. Prints <b>true</b> then <b>false</b>. Use <code>Locale.ROOT</code> for anything that isn’t shown to a human.', run: true, expect: 'true\nfalse' },
    { kind: 'concept', q: 'Where do interned String objects live in Java 8 and later?', options: ['In PermGen', 'In Metaspace', 'In the ordinary Java heap, so the GC can reclaim unused ones', 'In the code cache'], answer: 2, explain: 'Java 7 moved pooled Strings from PermGen into the main heap. Java 8 removed PermGen entirely. The pool’s lookup table lives in native memory, sized with <code>-XX:StringTableSize</code>. The Strings themselves are normal heap objects.' }
  ],
  interview: [
    { q: 'Why are Strings immutable in Java?', a: '<ul><li><b>Safety</b>: Strings are used for class names, file paths, URLs and security checks. A caller can’t change one after it has been validated.</li><li><b>Sharing</b>: the pool and substring sharing are only safe with immutable values.</li><li><b>Hash caching</b>: <code>hashCode</code> is computed once and cached, which makes Strings ideal HashMap keys.</li><li><b>Thread safety</b>: they can be shared freely with no synchronisation.</li></ul>', lvl: 'core' },
    { q: 'What is the string pool? When would you call intern()?', a: '<p>One table of shared Strings for the whole JVM. Literals and compile-time constants go in automatically. <code>intern()</code> adds or finds any other String. Calling it yourself is rarely worth it: every call costs a table lookup. To remove many duplicate runtime Strings, prefer the GC’s deduplication (<code>-XX:+UseStringDeduplication</code>, G1 since 8u20, other collectors since Java 18) or your own size-limited <code>ConcurrentHashMap</code> cache.</p>', lvl: 'core' },
    { q: 'How many objects does <code>String s = new String("hi");</code> create?', a: '<p>At least one: the new String on the heap. If the literal <code>"hi"</code> hasn’t been used before, the pooled String is created too. So the answer is “one or two”. In current JDKs the new String shares the literal’s <code>byte[]</code> instead of copying it. There is almost never a reason to write <code>new String(String)</code>.</p>', lvl: 'core' },
    { q: 'What are compact strings?', a: '<p>Since Java 9, a String stores its characters in a <code>byte[]</code> with a <code>coder</code> flag: LATIN1 (1 byte per char) when every char is ≤ U+00FF, otherwise UTF16 (2 bytes per char). It usually saves memory when most text is Latin-1. One character outside Latin-1 makes the whole String UTF16. Turn it off with <code>-XX:-CompactStrings</code>.</p>', lvl: 'deep' },
    { q: 'How is <code>a + b + c</code> compiled? Is StringBuilder still needed?', a: '<p>Up to Java 8, the compiler wrote a chain of <code>StringBuilder</code> appends. Since Java 9 it emits one <code>invokedynamic</code> to <code>StringConcatFactory.makeConcatWithConstants</code>. The JVM picks a fast strategy that sizes the result exactly. A single expression doesn’t need a manual StringBuilder. A <b>loop</b> with <code>+=</code> still does, because each pass is a separate join.</p>', lvl: 'deep' },
    { q: 'StringBuilder vs StringBuffer?', a: '<p>They have the same API. <code>StringBuffer</code> (Java 1.0) locks on every method. <code>StringBuilder</code> (Java 5) doesn’t. Builders almost always stay in one thread, so use StringBuilder. Locking each append wouldn’t make a multi-step build safe anyway.</p>', lvl: 'core' },
    { q: 'What are the rules for text blocks?', a: '<ul><li>The opening <code>"""</code> must be followed by a line break.</li><li>The smallest indent across content lines <i>and</i> the closing quotes is removed.</li><li>Trailing spaces on each line are stripped. Use <code>\\s</code> to keep one.</li><li><code>\\</code> at the end of a line joins it with the next line (no newline).</li><li>Line endings are normalised to <code>\\n</code>.</li><li>A text block is a normal String literal: it is interned, and <code>formatted(…)</code> (Java 15) fills placeholders.</li></ul>', lvl: 'core' },
    { q: 'What Unicode pitfalls do you watch for in a backend?', a: '<ul><li><code>length()</code>, <code>charAt</code> and <code>substring</code> count 16-bit chars. Use <code>codePoints()</code> and <code>offsetByCodePoints</code> for real characters, and <code>BreakIterator</code> for what users see.</li><li>One accent can be stored two ways. Convert to NFC before storing or comparing.</li><li>Case mapping depends on locale (Turkish i), and some mappings change length (“ß”.toUpperCase() is “SS”).</li><li>Charsets: always explicit. Database columns must be able to store 4-byte UTF-8 (MySQL needs <code>utf8mb4</code>).</li></ul>', lvl: 'deep' },
    { q: 'What changed with JEP 400 in Java 18?', a: '<p>UTF-8 became the default charset for standard APIs (<code>FileReader</code>, <code>new String(bytes)</code>, <code>getBytes()</code>, and so on) on all platforms. Before, it came from the OS. The same code could decode bytes differently on Windows or in a minimal container. <code>System.out</code> still uses the console encoding (<code>stdout.encoding</code>). <code>-Dfile.encoding=COMPAT</code> brings back the old behaviour during a migration.</p>', lvl: 'deep' },
    { q: 'Does String cache its hash code? Any edge cases?', a: '<p>Yes. It is computed on the first <code>hashCode()</code> call and stored in a field. Since JDK 13 a <code>hashIsZero</code> flag stops Strings with a real hash of 0 being recomputed each time. Two threads may compute it at once. That is harmless: both get the same value.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Normalise text at the boundary', lang: 'java', code: `public final class Text {
    private Text() {}

    /** Canonical form for usernames, slugs, lookup keys. */
    public static String key(String raw) {
        String s = Normalizer.normalize(raw.strip(), Normalizer.Form.NFKC);   // strip() is Unicode-aware (Java 11)
        return s.toLowerCase(Locale.ROOT);
    }

    /** Truncate without splitting a surrogate pair. */
    public static String truncate(String s, int maxCodePoints) {
        if (s.codePointCount(0, s.length()) <= maxCodePoints) return s;
        return s.substring(0, s.offsetByCodePoints(0, maxCodePoints)) + "…";
    }
}

// on the way in, e.g. in a record's compact constructor
public record Username(String value) {
    public Username { value = Text.key(value); }
}` },
    { title: 'Concatenation that scales', lang: 'java', code: `// logging: placeholders, no string built unless the level is enabled
log.debug("order {} moved to {}", order.id(), order.status());

// joining collections
String ids = orders.stream().map(o -> Long.toString(o.id())).collect(Collectors.joining(",", "[", "]"));

// building a large payload: pre-size, append, no +=
var sb = new StringBuilder(rows.size() * 64);
for (Row r : rows) {
    sb.append(r.id()).append(',').append(r.name()).append('\\n');
}` },
    { title: 'Text blocks for SQL', lang: 'java', code: `private static final String FIND_OVERDUE = """
    SELECT i.id, i.customer_id, i.due_date, i.amount
    FROM invoice i
    WHERE i.status = 'OPEN'
      AND i.due_date < :today
    ORDER BY i.due_date
    """;

List<Invoice> overdue(LocalDate today) {
    return jdbc.sql(FIND_OVERDUE)                     // Spring 6.1 JdbcClient
               .param("today", today)
               .query(Invoice.class)
               .list();
}
// never build SQL from user input with formatted() or + : bind parameters instead`, note: 'A text block is an ordinary constant String, pooled like any literal. String templates were only a preview in Java 21 and 22 and were later withdrawn, so don’t rely on them.' }
  ]
});

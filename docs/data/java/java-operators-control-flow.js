IA.register({
  track: 'java',
  slug: 'java-operators-control-flow',
  title: 'Operators & control flow',
  tagline: 'Operators compute values. Control flow decides which lines run, and how often. Learn integer division and <code>%</code>, <code>&&</code>, <code>++</code> before vs after, <code>if/else</code>, the modern <b>switch expression</b>, and the four loops.',
  tldr: {
    problem: 'Most bugs here give no error. <code>7 / 2</code> is 3. An old-style <code>switch</code> runs into the next case. <code>i++</code> returns the old value. <code>&</code> runs both sides when you meant <code>&&</code>.',
    model: 'An expression uses <b>the types of its values</b>: <code>int / int</code> gives an <code>int</code>. Conditions must be real <code>boolean</code>s. Branches pick one path. Loops repeat while a condition holds. <code>while</code> and <code>for</code> check it first; <code>do</code> checks it after.',
    hook: '“Arrow <code>switch</code> vs colon <code>switch</code>?” The arrow form (Java 14+) never runs into the next case. It can return a value, and then must cover every case.',
    facts: [
      { v: 'Java 14', l: 'switch expressions became standard (JEP 361); pattern matching for switch followed in Java 21 (JEP 441)' },
      { v: 'toward 0', l: 'integer <code>/</code> truncates toward zero: <code>-7 / 2 == -3</code>, and <code>-7 % 2 == -1</code>' },
      { v: '&&  ||', l: 'are short-circuit: the right side is skipped when the left side already decides the result' }
    ]
  },
  intro: {
    what: '<b>Operators</b> are the symbols that compute: <code>+ - * / %</code> for arithmetic, <code>== != &lt; &gt; &lt;= &gt;=</code> for comparisons, <code>&& || !</code> for logic. <b>Control flow</b> chooses what runs. <code>if</code>/<code>else</code> and <code>switch</code> pick a branch. <code>for</code>, <code>while</code> and <code>do</code> repeat code. Without them, a program runs top to bottom once.',
    analogy: { icon: '🚦', title: 'Road signs for the computer', text: 'Your program is a car driving down the page. An <code>if</code> is a fork in the road: one way or the other, never both. A <code>switch</code> is a roundabout with numbered exits. A loop is a lap around the block, repeated until the sign says “stop”.' },
    steps: [
      { t: 'Do arithmetic', d: 'With two ints, <code>/</code> drops the fraction and <code>%</code> gives the remainder.', code: 'int boxes = 17 / 5;     // 3\nint left  = 17 % 5;     // 2\ndouble avg = 17 / 5.0;  // 3.4' },
      { t: 'Compare and combine', d: 'Comparisons give a <code>boolean</code>. Combine with <code>&&</code> (and), <code>||</code> (or), <code>!</code> (not).', code: 'boolean adult = age >= 18;\nboolean canRent = adult && hasLicence;' },
      { t: 'Branch with if/else', d: 'Conditions go in parentheses and must be boolean. Always use braces.', code: 'if (temp > 30) {\n    System.out.println("hot");\n} else {\n    System.out.println("fine");\n}' },
      { t: 'Pick a value with switch', d: 'Java 14+ switch expressions return a value and need no <code>break</code>.', code: 'String name = switch (day) {\n    case 1 -> "Mon";\n    case 2 -> "Tue";\n    default -> "?";\n};' },
      { t: 'Repeat with a loop', d: '<code>for</code> when you count, <code>while</code> when you wait for a condition, enhanced <code>for</code> to visit every element.', code: 'for (int i = 1; i <= 3; i++) System.out.println(i);\nfor (String s : names) System.out.println(s);' }
    ],
    terms: [
      ['expression', 'Code that produces a value: <code>a + 1</code>, <code>x > 3</code>, a switch expression.'],
      ['integer division', '<code>int / int</code>: the result is truncated toward zero.'],
      ['short-circuit', '<code>&&</code>/<code>||</code> stop as soon as the answer is known.'],
      ['fall-through', 'In a colon-style switch, execution continues into the next case unless you <code>break</code>.'],
      ['enhanced for', '<code>for (T x : collection)</code>: loops over every element of an array or <code>Iterable</code>.'],
      ['<code>break</code> / <code>continue</code>', 'Leave the loop now / skip to the next pass.']
    ]
  },
  visual: {
    title: 'Trace the program line by line',
    caption: 'Pick <b>Division</b>, <b>if / else</b>, <b>switch</b> or <b>Loops</b>, then <b>Play</b> or <b>Step</b>. The highlighted line runs next. Boxes show variables and each condition’s value. Skipped branches go dashed.'
  },
  gotchas: [
    { trap: 'Integer division before widening', code: `int done = 3, total = 4;
double pct = done / total * 100;          // 0.0
double ok  = (double) done / total * 100; // 75.0`, why: '<code>3 / 4</code> is computed in <code>int</code> first and gives 0. Converting 0 to double afterwards doesn’t bring the fraction back.', fix: 'Cast an operand <b>before</b> dividing, or use a double literal (<code>100.0 * done / total</code>).' },
    { trap: 'Fall-through in a colon switch', code: `switch (status) {
    case "NEW":     sendWelcome();
    case "ACTIVE":  bill();          // runs for NEW too!
        break;
}`, why: 'With <code>case X:</code> labels, execution starts at the match and continues until a <code>break</code> or the end.', fix: 'Use the arrow form <code>case "NEW" -> sendWelcome();</code>, which never falls through. If you use colons, end every case with <code>break</code>.' },
    { trap: '<code>=</code> vs <code>==</code>, and <code>==</code> on Strings', code: `if (x = 5) { }              // compile error: int is not boolean
if (name == "admin") { }    // compiles, compares references
if ("admin".equals(name)) { }   // compares text, null-safe`, why: 'Java rejects non-boolean conditions, which saves you from the C-style <code>=</code> bug. But <code>==</code> on objects checks “same object”, not “same text”.', fix: 'Use <code>equals</code> for Strings and other objects. Put the literal first to avoid a NullPointerException when the variable is null.' },
    { trap: '<code>&</code> instead of <code>&&</code>', code: `if (user != null & user.isActive()) { }   // NPE when user is null
if (user != null && user.isActive()) { }  // safe`, why: 'On booleans, <code>&</code> and <code>|</code> are non-short-circuit: both sides always run.', fix: 'Use <code>&&</code>/<code>||</code> for conditions. Keep <code>&</code>/<code>|</code> for bit operations.' },
    { trap: '<code>x += 2.7</code> silently truncates', code: `int x = 10;
x += 2.7;       // compiles: x is 12
// x = x + 2.7; // compile error: possible lossy conversion`, why: 'Compound assignment includes a hidden cast: <code>x += y</code> means <code>x = (int)(x + y)</code>.', fix: 'Watch the target type. Use a <code>double</code> variable if you need the fraction.' },
    { trap: 'Missing braces', code: `if (debug)
    log("a");
    log("b");      // always runs: indentation lies`, why: 'Without braces, an <code>if</code> or loop controls only the next single statement.', fix: 'Always use braces. Formatters and linters (Checkstyle <code>NeedBraces</code>) enforce it.' },
    { trap: 'Off-by-one loop bounds', code: `int[] a = new int[3];
for (int i = 0; i <= a.length; i++) a[i] = i;   // ArrayIndexOutOfBounds at i = 3
for (int i = 0; i < a.length; i++) a[i] = i;    // correct`, why: 'Valid indexes are 0 to <code>length - 1</code>. <code>&lt;=</code> runs one pass too many.', fix: 'Use <code>i &lt; length</code>, or the enhanced for loop when you don’t need the index.' }
  ],
  scenarios: [
    { title: 'Welcome emails sent to every paying customer', symptom: 'After a release, existing customers receive “Welcome!” emails on every billing run.', diagnose: 'switch (account.status()) {\n    case TRIAL:\n        sendWelcome(account);\n    case PAID:\n        charge(account);\n        break;\n}\n// someone reordered the cases: PAID used to come first', cause: 'A colon-style switch with a missing <code>break</code>. After reordering, <code>TRIAL</code> ran on into <code>PAID</code> (<i>fall-through</i>). A later edit let PAID accounts reach <code>sendWelcome</code> too. Fall-through made case order matter.', fix: 'Rewrite with arrows. Each case stands alone, so order no longer matters. With an enum and a switch expression, the compiler also flags a missing case.', fixCode: `switch (account.status()) {
    case TRIAL -> sendWelcome(account);
    case PAID  -> charge(account);
    case CLOSED -> { }
}` },
    { title: 'Progress bar stuck at 0% until the end', symptom: 'An import job’s progress API returns 0 for the whole run, then jumps to 100.', diagnose: 'int processed = 4_200, total = 10_000;\nint pct = processed / total * 100;   // 0', cause: 'Integer division: <code>4200 / 10000</code> is 0, so the result is 0 until <code>processed == total</code>.', fix: 'Multiply first (watch for overflow with big numbers) or compute in floating point.', fixCode: `int pct = (int) (processed * 100L / total);     // 42
// or
double pct2 = 100.0 * processed / total;        // 42.0` },
    { title: 'Batch job never finishes', symptom: 'A cleanup job runs forever at 100% CPU on one core.', diagnose: 'Thread dump shows the job stuck in:\nint page = 0;\nwhile (page < pages) {\n    if (skip(page)) continue;   // page++ never reached\n    process(page);\n    page++;\n}', cause: '<code>continue</code> jumps back to the condition. It skips the <code>page++</code> at the end. The first skipped page loops forever.', fix: 'Put the update where it can’t be skipped: use a <code>for</code> loop, whose update part runs even after <code>continue</code>.', fixCode: `for (int page = 0; page < pages; page++) {
    if (skip(page)) continue;   // page++ still happens
    process(page);
}` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        System.out.println(7 / 2 + " " + 7 % 3 + " " + -7 / 2 + " " + -7 % 3 + " " + 7 / 2.0);
    }
}`, options: ['3 1 -4 2 3.5', '3 1 -3 -1 3.5', '3.5 1 -3.5 -1 3.5', '3 1 -3 2 3.5'], answer: 1, run: true, expect: '3 1 -3 -1 3.5', explain: 'Integer division cuts toward zero (−3.5 → −3). The remainder takes the sign of the left side: −7 = −2 × 3 + (−1). One <code>double</code> makes it decimal division.' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        int day = 2;
        switch (day) {
            case 1: System.out.println("one");
            case 2: System.out.println("two");
            case 3: System.out.println("three");
                break;
            default: System.out.println("other");
        }
    }
}`, options: ['two', 'two, three', 'two, three, other', 'one, two, three'], answer: 1, run: true, expect: 'two\nthree', explain: 'It jumps to <code>case 2</code>, then <b>falls through</b> into <code>case 3</code> until <code>break</code>. <code>default</code> never runs.' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        int i = 5;
        int a = i++;
        int b = ++i;
        System.out.println(a + " " + b + " " + i);
    }
}`, options: ['6 7 7', '5 7 7', '5 6 6', '6 6 7'], answer: 1, run: true, expect: '5 7 7', explain: '<code>i++</code> returns the <b>old</b> value (5) and then increments i to 6. <code>++i</code> increments first (to 7) and returns the new value.' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        int n = 10;
        do {
            System.out.println(n);
            n++;
        } while (n < 5);
        System.out.println("end " + n);
    }
}`, options: ['end 10', '10, then end 11', 'Nothing: the loop is skipped', 'An infinite loop'], answer: 1, run: true, expect: '10\nend 11', explain: 'A <code>do/while</code> runs its body once before checking the condition. 11 &lt; 5 is false, so it stops after one pass.' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        for (int i = 0; i < 10; i++) {
            if (i % 2 == 0) continue;
            if (i > 7) break;
            System.out.println(i);
        }
    }
}`, options: ['1 3 5 7 9 (one per line)', '1 3 5 7 (one per line)', '0 2 4 6 (one per line)', '1 3 5 (one per line)'], answer: 1, run: true, expect: '1\n3\n5\n7', explain: '<code>continue</code> skips the even numbers. At i = 9, <code>9 > 7</code> triggers <code>break</code>, which leaves the loop before printing.' },
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    public static void main(String[] args) {
        int x = 0;
        if (x != 0 && 10 / x > 1) {
            System.out.println("big");
        } else {
            System.out.println("safe");
        }
        int y = 10;
        y += 2.7;
        System.out.println(y);
    }
}`, options: ['ArithmeticException: / by zero', 'safe, then 12', 'safe, then 12.7', 'Compile error on y += 2.7'], answer: 1, run: true, expect: 'safe\n12', explain: '<code>&&</code> stops early: <code>x != 0</code> is false, so <code>10 / x</code> never runs. <code>y += 2.7</code> compiles because <code>+=</code> casts back to <code>int</code>: 12.7 → 12.' },
    { kind: 'predict', q: 'What does this print?', code: `import java.util.Arrays;

public class Main {
    public static void main(String[] args) {
        int[] arr = {1, 2, 3};
        for (int v : arr) {
            v = v * 2;
        }
        System.out.println(Arrays.toString(arr));
        String size = switch (arr.length) {
            case 0 -> "empty";
            case 1, 2, 3 -> "small";
            default -> "big";
        };
        System.out.println(size);
    }
}`, options: ['[2, 4, 6] and small', '[1, 2, 3] and small', '[1, 2, 3] and big', 'Compile error: cannot assign to loop variable'], answer: 1, run: true, expect: '[1, 2, 3]\nsmall', explain: 'In a for-each loop, <code>v</code> is a copy of each element. Changing it leaves the array alone. The switch expression matches <code>case 1, 2, 3</code> for length 3.' },
    { kind: 'concept', q: 'Which loop always runs its body at least once?', options: ['for', 'while', 'do / while', 'enhanced for'], answer: 2, explain: '<code>do { … } while (cond);</code> checks the condition after the body. The others check before the first pass.' }
  ],
  interview: [
    { q: 'What does <code>5 / 2</code> evaluate to in Java, and why?', a: '<p><code>2</code>. Both are <code>int</code>, so Java does integer division and cuts toward zero. To get 2.5, make an operand a <code>double</code>: <code>5 / 2.0</code> or <code>(double) 5 / 2</code>.</p>', lvl: 'core' },
    { q: 'What is the difference between <code>i++</code> and <code>++i</code>?', a: '<p>Both add one to <code>i</code>. Inside an expression, <code>i++</code> gives the old value and <code>++i</code> gives the new one. On its own line (<code>i++;</code>) there is no difference.</p>', fu: 'What does <code>i = i++;</code> leave in i? (Unchanged: the old value is assigned back.)', lvl: 'core' },
    { q: 'What is short-circuit evaluation?', a: '<p><code>a && b</code> skips <code>b</code> when <code>a</code> is false. <code>a || b</code> skips <code>b</code> when <code>a</code> is true. That lets you guard: <code>s != null && s.isEmpty()</code>. <code>&</code> and <code>|</code> always run both sides.</p>', lvl: 'core' },
    { q: 'Compare the old switch statement with switch expressions.', a: '<ul><li><b>Colon form</b> (<code>case 1:</code>): a statement, falls through without <code>break</code>.</li><li><b>Arrow form</b> (<code>case 1 -></code>, Java 14+): no fall-through, several labels per case (<code>case 6, 7 -></code>), and can be used as an <b>expression</b> that returns a value.</li><li>A switch <i>expression</i> must be exhaustive (cover every value, or have <code>default</code>). Use <code>yield</code> to return a value from a block arm.</li></ul>', lvl: 'core' },
    { q: 'What types can you switch on?', a: '<p>Classically <code>byte</code>, <code>short</code>, <code>char</code>, <code>int</code> and their wrappers, <code>String</code> and enums. Java 21 adds pattern matching, so you can switch on any object type with cases like <code>case Circle c -></code>. You still can’t switch on <code>long</code>, <code>float</code>, <code>double</code> or <code>boolean</code> in Java 21.</p>', lvl: 'core' },
    { q: 'When would you choose <code>for</code>, <code>while</code>, <code>do/while</code> or enhanced <code>for</code>?', a: '<ul><li><b>for</b>: a known count or you need the index.</li><li><b>while</b>: repeat until a condition changes (reading input, polling).</li><li><b>do/while</b>: the body must run at least once (show a menu, then ask again).</li><li><b>enhanced for</b>: read every element of an array or collection; clearest and no index bugs.</li></ul>', lvl: 'core' },
    { q: 'What do <code>break</code> and <code>continue</code> do? What is a labelled break?', a: '<p><code>break</code> exits the innermost loop or switch; <code>continue</code> skips to the next iteration. A label lets you exit an outer loop from an inner one:</p><pre><code>outer:\nfor (int[] row : grid)\n    for (int v : row)\n        if (v == target) break outer;</code></pre>', lvl: 'core' },
    { q: 'Why can’t you write <code>if (count)</code> in Java?', a: '<p>Java conditions must be <code>boolean</code>. Ints, nulls and empty strings never count as true or false. Write <code>if (count != 0)</code>. This also turns the classic <code>if (x = 5)</code> typo into a compile error.</p>', lvl: 'core' },
    { q: 'Why is <code>a.equals(b)</code> used instead of <code>a == b</code> for Strings?', a: '<p><code>==</code> asks “same object?”. <code>equals</code> compares content. Two equal strings built at run time are usually different objects, so <code>==</code> is false. Literals are shared, so <code>==</code> seems to work in small tests.</p>', lvl: 'core' },
    { q: 'Can modifying a collection inside an enhanced for loop cause problems?', a: '<p>Yes. Adding to or removing from an <code>ArrayList</code> inside for-each usually throws <code>ConcurrentModificationException</code>. The hidden iterator notices the change. Use <code>Iterator.remove()</code>, <code>removeIf</code>, or collect changes and apply them afterwards.</p>', lvl: 'deep' },
    { q: 'How do you avoid overflow when computing a midpoint in binary search?', a: '<p><code>(lo + hi) / 2</code> can overflow when both are large ints. Use <code>lo + (hi - lo) / 2</code> or <code>(lo + hi) >>> 1</code> (unsigned shift). This bug sat in the JDK’s own <code>Arrays.binarySearch</code> until Java 6.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Switch expressions with enums', lang: 'java', code: `enum Plan { FREE, PRO, ENTERPRISE }

static int seatLimit(Plan p) {
    return switch (p) {           // no default needed: all enum constants covered
        case FREE -> 1;
        case PRO -> 10;
        case ENTERPRISE -> {
            int base = 100;
            yield base * 2;       // yield returns a value from a block
        }
    };
}`, note: 'Add a new constant to <code>Plan</code> and this method stops compiling until you handle it: exhaustiveness turns a runtime bug into a compile error.' },
    { title: 'Guard clauses instead of deep nesting', lang: 'java', code: `ResponseEntity<?> transfer(Account from, Account to, long cents) {
    if (cents <= 0) return badRequest("amount must be positive");
    if (from.equals(to)) return badRequest("same account");
    if (from.balanceCents() < cents) return badRequest("insufficient funds");

    ledger.move(from, to, cents);          // the happy path, unindented
    return ResponseEntity.ok().build();
}`, note: 'Early <code>return</code>s keep each condition flat and readable, a common code-review request.' },
    { title: 'Loop with a retry limit', lang: 'java', code: `int attempt = 0;
while (true) {
    try {
        return client.fetch();
    } catch (IOException e) {
        if (++attempt >= 3) throw e;          // give up after 3 tries
        Thread.sleep(200L * attempt);         // 200 ms, 400 ms backoff
    }
}`, note: '<code>++attempt</code> increments first, so the check sees the new count. In Spring apps, prefer Spring Retry or Resilience4j for this.' }
  ]
});

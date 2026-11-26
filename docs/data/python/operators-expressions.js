IA.register({
  track: 'python',
  slug: 'operators-expressions',
  title: 'Operators & expressions',
  tagline: 'Most operators look like Java’s, but a few behave differently: <code>/</code> always gives a float, <code>//</code> and <code>%</code> round toward <b>minus infinity</b>, <code>**</code> is power, comparisons <b>chain</b>, and <code>and</code>/<code>or</code> return an <b>operand</b>, not a bool. Add <b>truthiness</b> and you can read any Python condition.',
  tldr: {
    problem: 'Java muscle memory gives wrong answers silently: <code>7 / 2</code> is <code>3.5</code>, not 3; <code>-7 // 2</code> is −4, not −3; <code>-7 % 3</code> is 2, not −1; and <code>x or "default"</code> returns a string, not <code>true</code>.',
    model: 'Arithmetic: <code>/</code> true division, <code>//</code> floor division, <code>%</code> the matching remainder, <code>**</code> power. Logic: <code>and</code>/<code>or</code>/<code>not</code> as words, short-circuiting, using each object’s <b>truthiness</b>. Comparisons: <code>a &lt; b &lt; c</code> means <code>a &lt; b and b &lt; c</code>.',
    hook: '“What is <code>-7 // 2</code>?” −4. Python floors; Java truncates toward zero. The identity <code>a == (a // b) * b + a % b</code> holds in both, which is why their <code>%</code> results differ too.',
    facts: [
      { v: '−4', l: '<code>-7 // 2</code> in Python. In Java <code>-7 / 2</code> is −3; <code>Math.floorDiv(-7, 2)</code> matches Python' },
      { v: '512', l: '<code>2 ** 3 ** 2</code>: <code>**</code> is right-associative, so it is <code>2 ** 9</code>' },
      { v: 'no ++', l: 'Python has no <code>++</code>/<code>--</code> and no <code>?:</code>. Use <code>x += 1</code> and <code>a if cond else b</code>' }
    ]
  },
  intro: {
    what: 'An <b>expression</b> is anything that produces a value: <code>2 + 3</code>, <code>price * qty</code>, <code>age &gt;= 18</code>. <b>Operators</b> are the symbols that combine values. Python has the arithmetic ones you know, two kinds of division, a power operator, comparisons, and the logic words <code>and</code>, <code>or</code> and <code>not</code>. Any value can be used as a condition: empty and zero count as false.',
    analogy: { icon: '🧮', title: 'A calculator that also reads intent', text: 'Python’s calculator has two division keys: <b>/</b> gives the exact answer with decimals, <b>//</b> gives “how many whole times, rounding down”. Its logic keys are lazy: <code>or</code> hands back the first thing that looks like “something”, which makes it a natural way to say “use this, or else that”.' },
    steps: [
      { t: 'Arithmetic', d: '<code>+ - * /</code> as usual, plus <code>//</code> (floor division), <code>%</code> (remainder) and <code>**</code> (power).', code: 'print(7 / 2, 7 // 2, 7 % 2, 2 ** 10)\n# 3.5 3 1 1024' },
      { t: 'Comparisons, chained', d: '<code>== != &lt; &lt;= &gt; &gt;=</code> return bools and can chain.', code: 'age = 30\nprint(18 <= age < 65)   # True' },
      { t: 'Logic is spelled out', d: '<code>and</code>, <code>or</code>, <code>not</code> instead of <code>&amp;&amp;</code>, <code>||</code>, <code>!</code>. They short-circuit.', code: 'if user is not None and user.active:\n    ...' },
      { t: 'Truthiness', d: 'Any object works as a condition. <code>0</code>, <code>0.0</code>, <code>""</code>, empty containers and <code>None</code> are falsy.', code: 'items = []\nif not items:\n    print("empty")' },
      { t: 'Augmented assignment and the conditional expression', d: 'No <code>++</code>. No <code>cond ? a : b</code>; Python writes the condition in the middle.', code: 'count += 1\nlabel = "adult" if age >= 18 else "minor"' }
    ],
    terms: [
      ['expression', 'Code that evaluates to a value.'],
      ['operator precedence', 'Which operator binds first: <code>**</code>, then unary <code>-</code>, then <code>* / // %</code>, then <code>+ -</code>, then comparisons, <code>not</code>, <code>and</code>, <code>or</code>.'],
      ['floor division <code>//</code>', 'Divide and round down toward −∞.'],
      ['short-circuit', '<code>and</code>/<code>or</code> stop evaluating as soon as the result is known.'],
      ['truthy / falsy', 'Whether a value counts as True or False in a condition (<code>bool(x)</code>).'],
      ['chained comparison', '<code>a &lt; b &lt; c</code>, evaluated as <code>a &lt; b and b &lt; c</code> with <code>b</code> computed once.']
    ]
  },
  visual: {
    title: 'Watch an expression reduce',
    caption: 'Pick a scenario and press <b>Play</b> or <b>Step</b>. Each box is one rewrite of the expression; the highlighted box is the current value. <b>/ vs // vs %</b> shows why Python and Java disagree on negative numbers, and <b>and / or</b> shows short-circuiting returning an operand.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Division family', code: `for a, b in [(7, 2), (-7, 2), (7, -2), (6, 3)]:
    print(f"{a:>3} / {b:>2} = {a / b:<5} {a} // {b} = {a // b:>2}   {a} % {b} = {a % b:>2}")

a, b = -7, 2
print("identity holds:", a == (a // b) * b + a % b)
print("divmod:", divmod(-7, 2))`, note: 'Java: <code>-7 / 2 == -3</code> and <code>-7 % 2 == -1</code>. Python: −4 and 1.' },
      { label: 'Power & precedence', code: `print(2 ** 10, 2 ** 0.5, 2 ** -1)
print(2 ** 3 ** 2)        # right-associative: 2 ** 9
print(-2 ** 2)            # -(2 ** 2) = -4
print((-2) ** 2)          # 4
print(2 + 3 * 4 ** 2)     # 50
print(pow(2, 10, 1000))   # modular power: 24`, note: '<code>**</code> binds tighter than unary minus on its left.' },
      { label: 'Chaining', code: `x = 5
print(1 < x < 10)
print(1 < x > 3)            # legal but confusing
print(1 == 1.0 == True)     # all equal
a = b = c = 7
print(a == b == c)

def noisy(v):
    print("  evaluated", v)
    return v

print(0 < noisy(5) < 10)    # middle evaluated once`, note: 'Chaining evaluates each middle operand only once.' },
      { label: 'and / or return operands', code: `print(0 or "default")
print("" or None or [] or "last")
print(5 and 7)
print(0 and 1 / 0)          # short-circuits: no ZeroDivisionError

name = ""
display = name or "anonymous"
print(display)

count = 0
print(count or 10)          # trap: 0 is a valid count!
print(10 if count is None else count)`, note: '<code>x or default</code> treats every falsy value (0, "", []) as missing.' },
      { label: 'Truthiness table', code: `values = [0, 1, -1, 0.0, 1e-9, "", " ", "0", None, [], [0], {}, (), set(), range(0)]
for v in values:
    print(f"{v!r:>10} -> {'truthy' if v else 'falsy'}")`, note: 'Zero, empty and <code>None</code> are falsy; everything else is truthy.' },
      { label: 'Assignment ops & ternary', code: `n = 10
n += 5; n -= 3; n *= 2; n //= 5; n **= 2
print(n)

age = 17
print("adult" if age >= 18 else "minor")

# Walrus (3.8+): assign inside an expression
data = [3, 1, 4, 1, 5, 9]
if (size := len(data)) > 5:
    print("big list of", size)`, note: 'No <code>n++</code>. The walrus <code>:=</code> binds a name in the middle of an expression.' },
      { label: 'is vs ==, in', code: `a = [1, 2]
b = [1, 2]
print(a == b, a is b)
print(None is None)
print(3 in [1, 2, 3], "ell" in "hello", "x" not in "hello")
print(not 1 == 2)           # not (1 == 2) -> True`, note: '<code>==</code> compares values (Java’s <code>.equals</code>); <code>is</code> compares identity (Java’s <code>==</code> on references).' }
    ]
  },
  gotchas: [
    { trap: '<code>/</code> is not integer division', code: `items, per_page = 7, 2
pages = items / per_page       # 3.5, a float
pages = -(-items // per_page)  # 4: ceiling division
import math
pages = math.ceil(items / per_page)  # 4`, why: 'Since Python 3, <code>/</code> always returns a float. Using it as an index or a range bound raises <code>TypeError</code>.', fix: 'Use <code>//</code> for whole-number division and <code>math.ceil</code> or the <code>-(-a // b)</code> idiom for ceiling.' },
    { trap: 'Negative <code>//</code> and <code>%</code> differ from Java', code: `print(-7 // 2, -7 % 2)   # -4 1   (Java: -3 -1)
print(int(-7 / 2))       # -3, truncation like Java
import math
print(math.fmod(-7, 2))  # -1.0, C/Java-style remainder`, why: 'Python floors toward −∞ so that <code>%</code> has the sign of the divisor. Handy for wrap-around (<code>i % n</code> is always in <code>0..n-1</code> for positive n), surprising when porting Java code.', fix: 'When porting, decide which semantics you need. <code>math.fmod</code> or <code>int(a / b)</code> give Java-style results for floats and small ints.' },
    { trap: '<code>x or default</code> swallows valid falsy values', code: `def set_timeout(seconds=None):
    seconds = seconds or 30      # set_timeout(0) gives 30!
    seconds = 30 if seconds is None else seconds   # correct`, why: '<code>or</code> tests truthiness, and <code>0</code>, <code>""</code>, <code>[]</code> are falsy even when they are legitimate values.', fix: 'Use <code>or</code> only when every falsy value really means “missing”. Otherwise test <code>is None</code>.' },
    { trap: '<code>-2 ** 2</code> is −4', code: `print(-2 ** 2)    # -4
print((-2) ** 2)  # 4`, why: '<code>**</code> binds tighter than unary minus on its left, so it is <code>-(2 ** 2)</code>. Same rule as in maths notation.', fix: 'Parenthesise negative bases.' },
    { trap: '<code>&amp;</code> and <code>|</code> are not <code>and</code> / <code>or</code>', code: `x = 5
print(x < 10 & x > 1)     # parsed as x < (10 & x) > 1 -> 5 < 0 > 1 -> False
print(x < 10 and x > 1)   # True
print(1 < x < 10)         # True, idiomatic`, why: '<code>&amp;</code> and <code>|</code> are bitwise operators with <b>higher</b> precedence than comparisons, and they don’t short-circuit. Writing them like Java’s <code>&amp;&amp;</code> gives a different parse.', fix: 'Use the words <code>and</code>/<code>or</code>/<code>not</code> for logic. (pandas masks are the exception: there you do need <code>&amp;</code> with parentheses.)' },
    { trap: '<code>round()</code> rounds half to even', code: `print(round(0.5), round(1.5), round(2.5))   # 0 2 2
print(round(2.675, 2))                       # 2.67 (binary float)`, why: 'Python 3 uses banker’s rounding to reduce bias, and floats like 2.675 are stored slightly below the decimal value. Java’s <code>Math.round</code> rounds half up.', fix: 'For business rounding, use <code>Decimal.quantize(..., rounding=ROUND_HALF_UP)</code>.' }
  ],
  scenarios: [
    { title: 'Pagination shows an empty last page', symptom: 'An API reports <code>total_pages: 4</code> for 6 items with 2 per page, and page 4 is empty. In another endpoint, <code>range(pages)</code> crashes with <code>TypeError: \'float\' object cannot be interpreted as an integer</code>.', diagnose: 'The code ported from Java computed <code>pages = total / per_page + 1</code>.', cause: 'In Java, int division plus 1 was a (buggy) ceiling. In Python <code>6 / 2 + 1</code> is the float 4.0: still off by one, and now a float.', fix: 'Use ceiling division on ints.', fixCode: `def total_pages(total: int, per_page: int) -> int:
    return -(-total // per_page)   # ceil without floats

assert total_pages(6, 2) == 3
assert total_pages(7, 2) == 4
assert total_pages(0, 2) == 0` },
    { title: 'Retries disabled by configuration “0 means no delay”', symptom: 'Ops set <code>RETRY_DELAY=0</code> for a fast-failing test environment, but each retry still waits 5 seconds.', diagnose: 'The client code reads <code>delay = config.get("retry_delay") or 5</code>.', cause: '<code>0</code> is falsy, so <code>or</code> replaced it with the default.', fix: 'Treat only “not set” as missing.', fixCode: `raw = config.get("retry_delay")
delay = 5 if raw is None else float(raw)` },
    { title: 'Hash-sharding sends data to a shard that doesn’t exist', symptom: 'A Java service and a Python worker disagree on which shard owns some keys. Errors mention shard −2.', diagnose: 'Both compute <code>hash % num_shards</code> on a signed 32-bit hash. The Java side sometimes gets negative results; Python never does.', cause: 'Java’s <code>%</code> keeps the sign of the dividend, Python’s keeps the sign of the divisor. For negative hashes they differ, and the Java side produced negative shard numbers.', fix: 'Define the mapping explicitly in both languages: <code>Math.floorMod</code> in Java matches Python’s <code>%</code>.', fixCode: `# Python: always 0..n-1 for n > 0
shard = h % num_shards
# Java equivalent: int shard = Math.floorMod(h, numShards);` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `print(7 // 2, -7 // 2, 7 % 3, -7 % 3)`, options: ['3 -3 1 -1', '3 -4 1 2', '3 -4 1 -1', '3.5 -3.5 1 2'], answer: 1, run: true, expect: '3 -4 1 2', explain: '<code>//</code> floors: −3.5 → −4. <code>%</code> follows from <code>a == (a // b) * b + a % b</code>: −7 − 3 × (−3) = 2. Java would print −3 and −1 for the negative cases.' },
    { kind: 'predict', q: 'What does this print?', code: `print(2 ** 3 ** 2, -2 ** 2)`, options: ['64 4', '512 4', '512 -4', '64 -4'], answer: 2, run: true, expect: '512 -4', explain: '<code>**</code> is right-associative: <code>2 ** (3 ** 2)</code> = 2⁹ = 512. And it binds tighter than unary minus on its left: <code>-(2 ** 2)</code> = −4.' },
    { kind: 'predict', q: 'What does this print?', code: `print(1 < 2 < 3, 3 > 2 > 1 > 0, 1 < 3 > 2)`, options: ['True True True', 'True False True', 'False False False', 'SyntaxError'], answer: 0, run: true, expect: 'True True True', explain: 'Each chain expands into <code>and</code>-ed pairs: <code>1&lt;3 and 3&gt;2</code> is True. In Java, <code>1 &lt; 2 &lt; 3</code> would not compile because it compares a boolean with an int.' },
    { kind: 'predict', q: 'What does this print?', code: `print(0 or "default", 5 and 7, None or 0)`, options: ['True 7 False', 'default True 0', 'default 7 0', 'default 5 None'], answer: 2, run: true, expect: 'default 7 0', explain: '<code>or</code> returns the first truthy operand, or the last one if none is truthy (so <code>None or 0</code> is <code>0</code>). <code>and</code> returns the first falsy operand, or the last one if all are truthy (so <code>7</code>).' },
    { kind: 'predict', q: 'What does this print?', code: `print(10 / 5, type(10 / 5).__name__, 10 // 5)`, options: ['2 int 2', '2.0 float 2', '2.0 float 2.0', '2 float 2'], answer: 1, run: true, expect: '2.0 float 2', explain: '<code>/</code> always returns a float, even when the division is exact. <code>//</code> between two ints returns an int.' },
    { kind: 'predict', q: 'What does this print?', code: `x = 5
print(not x == 5, not x == 6)`, options: ['False True', 'True False', 'False False', 'TypeError'], answer: 0, run: true, expect: 'False True', explain: '<code>not</code> has lower precedence than <code>==</code>, so <code>not x == 5</code> is <code>not (x == 5)</code>, not <code>(not x) == 5</code>.' },
    { kind: 'predict', q: 'What does this print?', code: `print(round(2.5), round(3.5), round(-0.5))`, options: ['3 4 -1', '2 4 0', '3 4 0', '2 3 -1'], answer: 1, run: true, expect: '2 4 0', explain: '<code>round()</code> with no digits argument returns an int and rounds halves to the <b>even</b> neighbour: 2.5 → 2, 3.5 → 4, −0.5 → 0.' },
    { kind: 'predict', q: 'What does this print?', code: `def f():
    print("f called")
    return True

print(False and f())
print(True or f())`, options: ['f called<br>False<br>f called<br>True', 'False<br>True', 'f called<br>False<br>True', 'False<br>f called<br>True'], answer: 1, run: true, expect: 'False\nTrue', explain: 'Short-circuiting: <code>False and …</code> is already False and <code>True or …</code> is already True, so <code>f()</code> is never called.' }
  ],
  interview: [
    { q: 'What is the difference between <code>/</code> and <code>//</code>?', a: '<p><code>/</code> is true division and always returns a float (<code>6 / 3 == 2.0</code>). <code>//</code> is floor division: it rounds toward negative infinity and returns an int for int operands (<code>-7 // 2 == -4</code>). Python 2’s <code>/</code> was integer division for ints; Python 3 changed it (PEP 238).</p>', lvl: 'core' },
    { q: 'Why is <code>-7 % 3</code> equal to 2 in Python but −1 in Java?', a: '<p>Both languages keep <code>a == (a / b) * b + a % b</code>, but Python’s integer division floors while Java’s truncates. So Python’s remainder takes the sign of the divisor, and Java’s the sign of the dividend. Java’s <code>Math.floorMod</code> matches Python.</p>', fu: 'Why is Python’s choice handy for array wrap-around?', lvl: 'core' },
    { q: 'What do <code>and</code> and <code>or</code> return?', a: '<p>One of their operands, not necessarily a bool. <code>a or b</code> returns <code>a</code> if <code>a</code> is truthy, else <code>b</code>. <code>a and b</code> returns <code>a</code> if <code>a</code> is falsy, else <code>b</code>. Both short-circuit, so the right side may never run. <code>not</code> always returns a bool.</p>', lvl: 'core' },
    { q: 'What values are falsy, and how can a class control truthiness?', a: '<p><code>None</code>, <code>False</code>, zeros of numeric types, and empty sequences/collections. A class can define <code>__bool__</code>; if it doesn’t, Python tries <code>__len__</code>; with neither, instances are truthy.</p>', lvl: 'core' },
    { q: 'How do chained comparisons work?', a: '<p><code>a op1 b op2 c</code> means <code>a op1 b and b op2 c</code>, with <code>b</code> evaluated once and short-circuiting after the first False. So <code>0 &lt;= i &lt; n</code> is idiomatic range checking.</p>', fu: 'What does <code>1 &lt; 3 &gt; 2</code> evaluate to? (True.)', lvl: 'core' },
    { q: 'Python has no <code>++</code> or ternary <code>?:</code>. What do you use?', a: '<p><code>x += 1</code> for increment; it is a statement, not an expression. The conditional expression is <code>a if cond else b</code>. (<code>++x</code> is legal but just applies unary plus twice and does nothing.)</p>', lvl: 'core' },
    { q: 'What is the difference between <code>==</code> and <code>is</code>?', a: '<p><code>==</code> compares values by calling <code>__eq__</code>, like Java’s <code>.equals()</code>. <code>is</code> compares identity, like Java’s <code>==</code> on references. Use <code>is</code> only for singletons such as <code>None</code>.</p>', lvl: 'core' },
    { q: 'What is the precedence order of Python’s main operators?', a: '<p>From tightest: <code>**</code>; unary <code>+x -x ~x</code>; <code>* / // %</code>; <code>+ -</code>; shifts; <code>&amp;</code>; <code>^</code>; <code>|</code>; comparisons (including <code>in</code>, <code>is</code>); <code>not</code>; <code>and</code>; <code>or</code>; the conditional expression; <code>:=</code> last. Note that bitwise operators bind tighter than comparisons, unlike what Java’s <code>&amp;&amp;</code> habits suggest.</p>', lvl: 'deep' },
    { q: 'What does the walrus operator <code>:=</code> do?', a: '<p>Introduced in 3.8 (PEP 572), it assigns a name inside an expression and returns the value: <code>while (line := f.readline()):</code>. Useful to avoid computing something twice; overusing it hurts readability.</p>', lvl: 'deep' },
    { q: 'How does <code>round()</code> behave, and why might it surprise you?', a: '<p>It rounds half to even (<code>round(2.5) == 2</code>), and works on the binary float value, so <code>round(2.675, 2)</code> gives <code>2.67</code>. For decimal business rules use <code>Decimal</code> with an explicit rounding mode.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Java vs Python: arithmetic', lang: 'java', code: `int a = -7, b = 2;
System.out.println(a / b);                 // -3  (truncates)
System.out.println(a % b);                 // -1
System.out.println(Math.floorDiv(a, b));   // -4  (Python's //)
System.out.println(Math.floorMod(a, b));   // 1   (Python's %)
System.out.println(Math.pow(2, 10));       // 1024.0 (double)
boolean ok = a < 0 && b > 0;
String label = a < 0 ? "neg" : "non-neg";
a++;`, note: 'The Python tab shows the same lines.' },
    { title: 'The same in Python', lang: 'python', code: `import math

a, b = -7, 2
print(int(a / b))     # -3  (Java-style truncation)
print(math.fmod(a, b))  # -1.0 (Java-style remainder)
print(a // b)         # -4
print(a % b)          # 1
print(2 ** 10)        # 1024 (exact int)
ok = a < 0 and b > 0
label = "neg" if a < 0 else "non-neg"
a += 1`, note: 'Python’s defaults are the floor versions; reach for <code>math.fmod</code> or <code>int(a / b)</code> only when you need Java semantics.' },
    { title: 'Idiomatic conditions', lang: 'python', code: `def describe(order: dict) -> str:
    items = order.get("items") or []          # None or [] -> []
    if not items:                             # truthiness: empty list
        return "empty order"
    total = sum(i["qty"] * i["price"] for i in items)
    tier = "large" if total >= 1000 else "small"
    if 0 < total < 50:                        # chained comparison
        tier = "tiny"
    discount = order.get("discount")
    if discount is not None:                  # 0 is a valid discount
        total -= discount
    return f"{len(items)} items, {tier}, total {total}"`, note: 'Use truthiness for “empty or not”, <code>is None</code> for “missing or not”.' }
  ]
});

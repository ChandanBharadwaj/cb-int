IA.register({
  track: 'python',
  slug: 'variables-types',
  title: 'Variables & basic types',
  tagline: 'A Python variable has <b>no declared type</b>: it is a name bound to an object, and the <b>object</b> carries the type. Five types cover most beginner code: <code>int</code>, <code>float</code>, <code>bool</code>, <code>str</code> and <code>None</code>. Learn how they differ from Java’s, and how to convert between them.',
  tldr: {
    problem: 'Coming from Java you expect <code>int x = 5;</code>, overflow at 2³¹, a <code>char</code> type and automatic <code>"n=" + 5</code>. In Python, ints never overflow, there is no <code>char</code>, and <code>"n=" + 5</code> is a <code>TypeError</code>.',
    model: '<b>Dynamic</b> typing: names have no type, objects do, and <code>type(obj)</code> tells you which. <b>Strong</b> typing: Python won’t silently convert a str to an int. Conversions are explicit calls like <code>int("42")</code>, and each builds a new object.',
    hook: '“Is Python weakly typed?” No. It is dynamically <i>and</i> strongly typed. <code>"3" + 4</code> fails; JavaScript would give <code>"34"</code>.',
    facts: [
      { v: 'unbounded', l: 'size of a Python int: arbitrary precision, like Java’s <code>BigInteger</code>. <code>2 ** 100</code> is exact' },
      { v: '64-bit', l: 'a float is an IEEE 754 double, the same as Java’s <code>double</code>. So <code>0.1 + 0.2 == 0.3</code> is False in both' },
      { v: 'bool ⊂ int', l: '<code>bool</code> is a subclass of <code>int</code>: <code>True == 1</code>, <code>False == 0</code>, and <code>True + True == 2</code>' }
    ]
  },
  intro: {
    what: 'A <b>variable</b> is a name you give to a value so you can use it later. In Python you create one just by assigning: <code>age = 30</code>. You never write the type. Every value has a <b>type</b> that decides what you can do with it: whole numbers (<code>int</code>), decimal numbers (<code>float</code>), True/False (<code>bool</code>), text (<code>str</code>) and “nothing” (<code>None</code>).',
    analogy: { icon: '🏷️', title: 'Labels on jars', text: 'In Java a variable is a shaped container: an <code>int</code> slot only accepts ints. In Python the values are jars, each stamped with what is inside (its type). A variable is a removable label. You can peel the label <code>x</code> off the jar of 42 and stick it on a jar of text. The jar’s stamp never changes; the label just moves.' },
    steps: [
      { t: 'Assign to create', d: 'The first assignment creates the name. No <code>var</code>, no type.', code: 'age = 30\nname = "Ada"\nprice = 9.99\nactive = True\nmanager = None' },
      { t: 'Ask an object its type', d: '<code>type()</code> returns the type; <code>isinstance(x, int)</code> is the usual check.', code: 'print(type(age))        # <class \'int\'>\nprint(isinstance(price, float))  # True' },
      { t: 'Rebind freely', d: 'The same name can point at a different type later. Legal, but usually a sign to pick a better name.', code: 'x = 42\nx = "forty-two"' },
      { t: 'Convert explicitly', d: '<code>int()</code>, <code>float()</code>, <code>str()</code>, <code>bool()</code> build new objects from old ones.', code: 'n = int("42")      # 42\ns = str(3.5)       # \'3.5\'\nf = float("1e3")   # 1000.0' },
      { t: 'Optional: add type hints', d: 'Hints document intent and let tools like mypy check you. Python itself does not enforce them at run time.', code: 'count: int = 0\nname: str | None = None   # 3.10+ syntax' }
    ],
    terms: [
      ['variable / name', 'A label bound to an object. Created by assignment.'],
      ['type', 'What kind of object a value is (<code>int</code>, <code>str</code>…). Fixed for the object’s life.'],
      ['dynamic typing', 'Types are checked at run time, on objects, not declared on variables.'],
      ['strong typing', 'Operations between incompatible types raise errors instead of converting silently.'],
      ['<code>None</code>', 'The single “no value” object, of type <code>NoneType</code>. Python’s <code>null</code>.'],
      ['casting / conversion', 'Calling a type, like <code>int(x)</code>, to build a new object of that type from <code>x</code>.']
    ]
  },
  visual: {
    title: 'Names move, objects keep their type',
    caption: 'Pick a scenario and press <b>Play</b> or <b>Step</b>. Each row is a name pointing at an object with its type badge and value. An orange outline marks an object that was just created. In <b>Dynamic typing</b>, watch the same name <code>x</code> point at four different types.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'The five basics', code: `age = 30
price = 9.99
active = True
name = "Ada"
manager = None

for value in (age, price, active, name, manager):
    print(repr(value), "->", type(value).__name__)`, note: '<code>repr()</code> shows the developer view (strings with quotes).' },
      { label: 'Dynamic, not weak', code: `x = 42
print(type(x))
x = "now a string"
print(type(x))

try:
    print("total: " + 5)
except TypeError as e:
    print("TypeError:", e)

print("total: " + str(5))
print(f"total: {5}")`, note: 'Java’s <code>"total: " + 5</code> auto-converts. Python refuses; convert with <code>str()</code> or use an f-string.' },
      { label: 'Casting', code: `print(int("42"), int(3.99), int(-3.99), int(True))
print(float("3.5"), float(7), float("inf"))
print(str(42), str(3.0), str(None))
print(int("ff", 16), int("0b101", 0), int("1_000_000"))

for bad in ["4.2", "abc", ""]:
    try:
        int(bad)
    except ValueError as e:
        print("ValueError:", e)`, note: '<code>int(float)</code> truncates toward zero. <code>int(str)</code> needs a whole-number string.' },
      { label: 'Truthiness of bool()', code: `for v in [0, 1, -1, 0.0, "", "0", "False", " ", None, [], [0]]:
    print(f"{v!r:>8} -> {bool(v)}")`, note: 'Zero, empty and <code>None</code> are False. Everything else, including the string <code>"False"</code>, is True.' },
      { label: 'Big ints, float limits', code: `import sys
print(2 ** 64)
print(2 ** 100)
print(sys.maxsize)            # largest list index, not an int limit
print(0.1 + 0.2)
print(0.1 + 0.2 == 0.3)
import math
print(math.isclose(0.1 + 0.2, 0.3))
print(1e308 * 10)             # float overflow -> inf`, note: 'ints are exact and unbounded. floats are doubles with rounding and a range.' },
      { label: 'bool is an int', code: `print(True + True, True * 10, False - 1)
print(isinstance(True, int), type(True).__name__)
print(sum([True, False, True, True]))   # count the Trues
print(True == 1, hash(True) == hash(1))`, note: 'Handy for counting, surprising as a dict key: <code>{1: "a", True: "b"}</code> has one key.' },
      { label: 'None checks', code: `def find(users, name):
    for u in users:
        if u == name:
            return u
    # falls off the end: returns None

result = find(["ann", "bob"], "zed")
print(result, type(result).__name__)
print(result is None)        # the idiomatic check
print(find(["ann"], "ann") is not None)`, note: 'A function without <code>return</code> returns <code>None</code>. Compare with <code>is None</code>.' }
    ]
  },
  gotchas: [
    { trap: '<code>"Total: " + 5</code> is a TypeError', code: `count = 5
print("Total: " + count)    # TypeError: can only concatenate str (not "int") to str
print("Total: " + str(count))
print(f"Total: {count}")    # best`, why: 'Python is strongly typed: <code>str + int</code> is not defined. Java’s string concatenation converts automatically; Python does not.', fix: 'Use an f-string, or convert with <code>str()</code>.' },
    { trap: '<code>bool("False")</code> is True', code: `flag = bool("False")   # True!
flag = bool("0")       # True!
flag = os.environ.get("DEBUG", "").lower() in ("1", "true", "yes")`, why: '<code>bool(str)</code> only checks whether the string is empty. It does not parse words.', fix: 'Parse explicitly: compare the lowercased string against a set of accepted values.' },
    { trap: 'Float equality', code: `print(0.1 + 0.2 == 0.3)          # False
import math
print(math.isclose(0.1 + 0.2, 0.3))   # True
from decimal import Decimal
print(Decimal("0.1") + Decimal("0.2") == Decimal("0.3"))  # True`, why: 'floats are binary IEEE 754 doubles. 0.1 has no exact binary representation, exactly as in Java.', fix: 'Compare with <code>math.isclose</code>. For money, use <code>Decimal</code> (constructed from strings) or integer cents, as you would use <code>BigDecimal</code> in Java.' },
    { trap: '<code>int(3.99)</code> truncates; it does not round', code: `print(int(3.99), int(-3.99))   # 3 -3
print(round(3.99), round(2.5))  # 4 2  (round half to even)`, why: '<code>int()</code> on a float drops the fraction toward zero, like a Java <code>(int)</code> cast. <code>round()</code> uses banker’s rounding.', fix: 'Choose deliberately: <code>int</code> (truncate), <code>math.floor</code>/<code>math.ceil</code>, or <code>round</code>.' },
    { trap: 'Shadowing built-in names', code: `list = [1, 2, 3]     # shadows the built-in list type
str = "hello"        # shadows str
str(5)               # TypeError: 'str' object is not callable`, why: 'Built-ins like <code>list</code>, <code>str</code>, <code>id</code>, <code>type</code>, <code>input</code> are ordinary names. Assigning to one hides the built-in in that scope.', fix: 'Pick other names (<code>items</code>, <code>text</code>, <code>user_id</code>). Linters such as Ruff flag this (rule A001).' },
    { trap: '<code>True</code> and <code>1</code> are the same dict key', code: `d = {1: "one", True: "yes"}
print(d)   # {1: 'yes'}`, why: '<code>True == 1</code> and their hashes match, so they collide as keys. The first key object is kept, the value is overwritten.', fix: 'Don’t mix bools and ints as keys of the same dict.' }
  ],
  scenarios: [
    { title: 'Feature flag stuck on in production', symptom: 'Setting <code>ENABLE_BETA=false</code> in the deployment still shows the beta UI.', diagnose: 'Logging <code>repr(os.environ["ENABLE_BETA"])</code> shows <code>\'false\'</code>. The code does <code>if bool(os.environ.get("ENABLE_BETA")):</code>.', cause: 'Environment variables are always strings. Any non-empty string, including <code>"false"</code>, is truthy.', fix: 'Parse the string explicitly, or let a settings library (pydantic-settings) parse it into a real bool.', fixCode: `import os

def env_flag(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}

ENABLE_BETA = env_flag("ENABLE_BETA")` },
    { title: 'Invoice totals off by a cent', symptom: 'A few invoices out of thousands differ by 0.01 from the accounting system.', diagnose: 'Summing line items with <code>float</code> and then <code>round(total, 2)</code>. Reproducing one: <code>round(2.675, 2)</code> gives <code>2.67</code>.', cause: '2.675 is stored as 2.67499999… in binary floating point, and <code>round</code> also rounds half to even. Floats are the wrong type for money, as in Java.', fix: 'Use <code>Decimal</code> built from strings with an explicit rounding mode, or store integer cents.', fixCode: `from decimal import Decimal, ROUND_HALF_UP

items = ["19.99", "5.01", "0.675"]
total = sum(Decimal(x) for x in items)
print(total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))` },
    { title: 'CSV import crashes on row 40,312', symptom: 'A nightly import fails with <code>ValueError: invalid literal for int() with base 10: \'\'</code>.', diagnose: 'The failing row has an empty <code>quantity</code> column. Every value from <code>csv</code> is a str.', cause: '<code>int("")</code> raises. The code assumed every row was filled in.', fix: 'Validate and convert at the edge: treat empty as <code>None</code> (or a default), and report bad rows instead of crashing the batch.', fixCode: `def to_int(raw: str) -> int | None:
    raw = raw.strip()
    if not raw:
        return None
    return int(raw)

qty = to_int(row["quantity"])` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `x = 5
x = "five"
print(type(x).__name__)`, options: ['int', 'str', 'TypeError', 'int then str'], answer: 1, run: true, expect: 'str', explain: 'Names have no fixed type. The second assignment rebinds <code>x</code> to a str object, and <code>type()</code> reports the type of the object it currently points at.' },
    { kind: 'predict', q: 'What does this print?', code: `print(int("42") + 1, int(3.99), int(-3.99))`, options: ['43 4 -4', '43 3 -3', '43 3 -4', '421 3 -3'], answer: 1, run: true, expect: '43 3 -3', explain: '<code>int("42")</code> parses text. <code>int()</code> on a float truncates toward zero, so 3.99 → 3 and −3.99 → −3 (not −4).' },
    { kind: 'predict', q: 'What does this print?', code: `print(bool(""), bool("False"), bool(0), bool([0]))`, options: ['False False False False', 'False True False True', 'False False False True', 'True True False True'], answer: 1, run: true, expect: 'False True False True', explain: 'Empty string and 0 are falsy. <code>"False"</code> is a non-empty string, so it is truthy. <code>[0]</code> is a non-empty list, so it is truthy, whatever it contains.' },
    { kind: 'predict', q: 'What does this print?', code: `print(0.1 + 0.2 == 0.3, round(0.1 + 0.2, 2) == 0.3)`, options: ['True True', 'False False', 'False True', 'True False'], answer: 2, run: true, expect: 'False True', explain: '<code>0.1 + 0.2</code> is 0.30000000000000004 in binary floating point. Rounding to 2 places gives the float nearest 0.3, which is the same float as the literal <code>0.3</code>.' },
    { kind: 'predict', q: 'What does this print?', code: `print(type(7 / 2).__name__, 7 // 2, type(True + 1).__name__, True + 1)`, options: ['int 3 bool 2', 'float 3 int 2', 'float 3.5 int 2', 'float 3 bool True'], answer: 1, run: true, expect: 'float 3 int 2', explain: '<code>/</code> always returns a float. <code>//</code> on ints returns an int. <code>bool</code> is a subclass of <code>int</code>, and <code>True + 1</code> uses int addition, giving the int 2.' },
    { kind: 'predict', q: 'What does this print?', code: `print(2 ** 64)`, options: ['0', '-9223372036854775808', '1.8446744073709552e+19', '18446744073709551616'], answer: 3, run: true, expect: '18446744073709551616', explain: 'Python ints have arbitrary precision. There is no overflow to wrap around, and <code>**</code> on two ints stays an exact int.' },
    { kind: 'predict', q: 'What does this print?', code: `print(int("1A", 16), int("1_000"), float("1e3"))`, options: ['26 1000 1000.0', '1A 1000 1e3', 'ValueError', '26 1_000 1000'], answer: 0, run: true, expect: '26 1000 1000.0', explain: 'The second argument of <code>int()</code> is the base: hex 1A is 26. Since Python 3.6 underscores are allowed as digit separators, also in <code>int()</code> strings. <code>float("1e3")</code> parses scientific notation.' },
    { kind: 'predict', q: 'What does this print?', code: `x = None
print(x is None, type(x).__name__, bool(x))`, options: ['True None False', 'True NoneType False', 'False NoneType False', 'True NoneType None'], answer: 1, run: true, expect: 'True NoneType False', explain: '<code>None</code> is the only instance of <code>NoneType</code>, it is falsy, and <code>is None</code> is the idiomatic test.' }
  ],
  interview: [
    { q: 'Is Python statically or dynamically typed? Strongly or weakly?', a: '<p><b>Dynamically</b> typed: names carry no type; objects do, and type errors appear at run time. <b>Strongly</b> typed: incompatible operations raise <code>TypeError</code> instead of converting silently (<code>"3" + 4</code> fails). Type hints add optional static checking via external tools.</p>', lvl: 'core' },
    { q: 'What are Python’s basic built-in scalar types, and how do they map to Java?', a: '<ul><li><code>int</code>: arbitrary precision, like <code>BigInteger</code> (no <code>byte/short/long</code> split).</li><li><code>float</code>: IEEE 754 double, like <code>double</code>.</li><li><code>bool</code>: <code>True</code>/<code>False</code>, a subclass of <code>int</code>.</li><li><code>str</code>: immutable Unicode text; no <code>char</code> type, a character is a length-1 str.</li><li><code>None</code>: the null object.</li></ul><p>There are no primitives: all of these are objects.</p>', fu: 'Is there a <code>complex</code> type? (Yes, <code>3+4j</code>.)', lvl: 'core' },
    { q: 'Can a Python int overflow?', a: '<p>No. ints grow as needed, limited only by memory. Arithmetic on very large ints gets slower. Since 3.11 (and security releases of earlier versions), converting an int with more than 4300 digits to or from a decimal string raises <code>ValueError</code> by default, to limit denial-of-service; <code>sys.set_int_max_str_digits</code> changes the limit.</p>', lvl: 'deep' },
    { q: 'How do you check a value’s type, and which way is preferred?', a: '<p><code>type(x)</code> returns the exact class. <code>isinstance(x, int)</code> also accepts subclasses and a tuple of types, so it is usually preferred. Even more Pythonic is often not checking at all and relying on duck typing.</p>', fu: 'Why is <code>isinstance(True, int)</code> True?', lvl: 'core' },
    { q: 'How do you convert between types? What happens with invalid input?', a: '<p>Call the type: <code>int("42")</code>, <code>float("3.5")</code>, <code>str(42)</code>, <code>bool(x)</code>. Each returns a new object. Invalid text raises <code>ValueError</code> (<code>int("4.2")</code>, <code>int("abc")</code>); a wrong kind of argument raises <code>TypeError</code> (<code>int(None)</code>).</p>', lvl: 'core' },
    { q: 'What is <code>None</code> and how do you test for it?', a: '<p>The single instance of <code>NoneType</code>, used for “no value”. Functions without a <code>return</code> return it. Test with <code>x is None</code> / <code>x is not None</code>: it is a singleton, and <code>==</code> can be overridden by a class.</p>', lvl: 'core' },
    { q: 'Which values are falsy in Python?', a: '<p><code>None</code>, <code>False</code>, numeric zero (<code>0</code>, <code>0.0</code>, <code>0j</code>), and empty containers or strings (<code>""</code>, <code>[]</code>, <code>{}</code>, <code>set()</code>, <code>()</code>, <code>range(0)</code>). Everything else is truthy by default; a class can define <code>__bool__</code> or <code>__len__</code> to change that.</p>', lvl: 'core' },
    { q: 'Do type hints make Python statically typed?', a: '<p>No. The interpreter stores annotations but does not enforce them: <code>x: int = "hi"</code> runs fine. Tools like mypy or pyright check them before run time, and libraries like Pydantic can validate data against them at run time.</p>', lvl: 'core' },
    { q: 'Why is <code>0.1 + 0.2 != 0.3</code>, and what do you use for money?', a: '<p>floats are binary doubles; 0.1 and 0.2 cannot be represented exactly, so the sum is 0.30000000000000004. Same in Java. Use <code>math.isclose</code> for comparisons, and <code>decimal.Decimal</code> (from strings) or integer minor units for money.</p>', lvl: 'core' },
    { q: 'What does assignment actually do in Python?', a: '<p>It evaluates the right-hand side to an object and binds the name to it. It never copies the object. Two names can refer to the same object; for immutable types like int and str that is harmless. See <a href="data-model.html">Everything is an object</a> for mutable aliasing.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Declarations: Java vs Python', lang: 'java', code: `// Java: the variable has a type
int age = 30;
double price = 9.99;
boolean active = true;
String name = "Ada";
String manager = null;
long big = Long.MAX_VALUE + 1;          // wraps to Long.MIN_VALUE
int n = Integer.parseInt("42");
String s = "n=" + n;                    // auto-conversion`, note: 'Compare with the Python tab: same data, no declarations.' },
    { title: 'The same in Python', lang: 'python', code: `age = 30
price = 9.99
active = True             # capitalised
name = "Ada"
manager = None
big = 2 ** 63             # exact: 9223372036854775808, no wrap
n = int("42")
s = "n=" + str(n)         # explicit
s = f"n={n}"              # idiomatic

# Optional hints, checked by mypy/pyright, not at run time
count: int = 0
nickname: str | None = None`, note: 'Python 3.10+ allows <code>str | None</code> in hints; earlier code uses <code>Optional[str]</code>.' },
    { title: 'Parsing input safely', lang: 'python', code: `def parse_age(raw: str) -> int:
    """Parse a user-entered age, rejecting junk."""
    try:
        age = int(raw.strip())
    except ValueError:
        raise ValueError(f"not a whole number: {raw!r}") from None
    if not 0 <= age <= 150:
        raise ValueError(f"out of range: {age}")
    return age

print(parse_age(" 42 "))`, note: 'Like <code>Integer.parseInt</code> in a try/catch. <code>int()</code> already ignores surrounding whitespace; <code>strip()</code> just makes the intent clear.' }
  ]
});

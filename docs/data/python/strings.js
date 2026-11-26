IA.register({
  track: 'python',
  slug: 'strings',
  title: 'Strings',
  tagline: 'A Python <code>str</code> is an <b>immutable sequence of Unicode characters</b>, like Java’s <code>String</code> but with superpowers: <b>slicing</b> with <code>[start:stop:step]</code>, negative indexes, <b>f-strings</b> for formatting, and <code>split</code>/<code>join</code> for turning text into lists and back.',
  tldr: {
    problem: 'Java habits make string code verbose and sometimes slow: <code>charAt</code> loops, <code>substring</code> arithmetic, <code>+</code> in loops, <code>String.format</code>. Python has shorter tools, but also traps: <code>s[0] = "x"</code> fails, and <code>split()</code> with and without an argument behave differently.',
    model: 'Every character has an index from the front (0…) and from the back (−1…). A slice <code>s[a:b]</code> takes <code>a</code> up to but not including <code>b</code>, clipping out-of-range bounds. Methods never change the string; they return a new one. f-strings evaluate expressions inside <code>{}</code>.',
    hook: '“Reverse a string in Python.” <code>s[::-1]</code>. Follow-up: “why does <code>s.upper()</code> on its own line do nothing?” Because strings are immutable; the result is thrown away.',
    facts: [
      { v: 'no char', l: 'Python has no character type. <code>s[0]</code> is a str of length 1' },
      { v: 'code points', l: '<code>len()</code> counts Unicode code points, not bytes or UTF-16 units: <code>len("é")</code> is 1 for the precomposed character, while Java’s <code>"😀".length()</code> is 2 and Python’s is 1' },
      { v: '3.12', l: 'f-strings were formalised in the grammar (PEP 701): you can now reuse the same quote type inside <code>{}</code>, as in <code>f"{d["key"]}"</code>' }
    ]
  },
  intro: {
    what: 'A <b>string</b> is text: a sequence of characters inside quotes. Single <code>\'hi\'</code> and double <code>"hi"</code> quotes mean the same thing; triple quotes <code>"""…"""</code> span several lines. You can pick out characters by position, cut out pieces (<b>slicing</b>), glue strings together, and fill values into a template with an <b>f-string</b>. A string can never be changed in place; every operation gives you a new string.',
    analogy: { icon: '📏', title: 'A ruler under the letters', text: 'Picture the word on a strip of paper with a ruler under it. The ruler marks the <i>gaps</i> between letters: 0 before the first letter, 1 after it, and so on. <code>s[1:4]</code> means “cut at mark 1 and at mark 4”. A second ruler runs backwards from the end with −1, −2… The strip is laminated: you can read and copy it, but not write on it.' },
    steps: [
      { t: 'Make strings', d: 'Single or double quotes, same type. Triple quotes for multi-line text. Prefix <code>r</code> for raw (no backslash escapes).', code: 'a = "hello"\nb = \'it\\\'s\'\nc = """line 1\nline 2"""\npath = r"C:\\new\\dir"' },
      { t: 'Index and slice', d: '<code>s[i]</code> for one character, <code>s[a:b]</code> for a piece, <code>s[a:b:step]</code> to skip or reverse.', code: 's = "Python"\nprint(s[0], s[-1], s[1:4], s[::-1])\n# P n yth nohtyP' },
      { t: 'Format with f-strings', d: 'Put an <code>f</code> before the quote and expressions inside <code>{}</code>. A <code>:</code> adds a format spec.', code: 'name, price = "tea", 3.5\nprint(f"{name}: ${price:.2f}")\n# tea: $3.50' },
      { t: 'Use methods', d: 'Each returns a new value: <code>upper</code>, <code>lower</code>, <code>strip</code>, <code>replace</code>, <code>startswith</code>, <code>find</code>…', code: 'print("  Hi  ".strip().upper())   # HI' },
      { t: 'Split and join', d: '<code>split</code> breaks a string into a list; <code>sep.join(list)</code> glues a list into a string.', code: 'parts = "a,b,c".split(",")   # [\'a\', \'b\', \'c\']\nprint("-".join(parts))      # a-b-c' }
    ],
    terms: [
      ['index', 'Position of a character: 0 is the first, −1 the last.'],
      ['slice', '<code>s[start:stop:step]</code>: a new string from start up to (not including) stop.'],
      ['immutable', 'Cannot be changed after creation. Methods return new strings.'],
      ['f-string', 'A string literal prefixed with <code>f</code> whose <code>{expr}</code> parts are evaluated and formatted (3.6+).'],
      ['escape sequence', 'A backslash code inside a literal: <code>\\n</code> newline, <code>\\t</code> tab, <code>\\\\</code> backslash.'],
      ['Unicode code point', 'The number Unicode assigns to a character. A Python str is a sequence of these.']
    ]
  },
  visual: {
    title: 'Indexes, slices and new strings',
    caption: 'Pick a scenario and press <b>Play</b> or <b>Step</b>. The ruler shows each character with its positive index above and negative index below; highlighted boxes are the ones the current expression selects. In <b>Immutability</b>, watch a method create a new object while the original stays the same.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Indexing & slicing', code: `s = "Python"
print(s[0], s[5], s[-1], s[-2])
print(s[1:4], s[:2], s[2:], s[:])
print(s[::2], s[1::2], s[::-1])
print(repr(s[10:]), s[-100:2])   # slices clip, never raise

try:
    s[10]
except IndexError as e:
    print("IndexError:", e)`, note: 'Indexing out of range raises; slicing out of range just gives a shorter (or empty) string.' },
      { label: 'f-strings', code: `name, qty, price = "widget", 3, 4.5
print(f"{qty} x {name} = {qty * price}")
print(f"{price:.2f} | {qty:03d} | {name:>10}| {name:<10}| {name:^10}|")
print(f"{1234567.891:,.2f}  {0.256:.1%}  {255:x}  {255:b}")
print(f"{name!r}  {name.upper()}  {qty=}  {price * 2 = }")

d = {"key": "value"}
print(f"{d["key"]}")            # same quotes inside: 3.12+ only
print(f"{{literal braces}}")`, note: '<code>{x=}</code> (3.8+) prints the expression and its value: great for debugging.' },
      { label: 'Common methods', code: `s = "  Hello, World  "
print(repr(s.strip()), repr(s.lstrip()), repr(s.rstrip()))
t = s.strip()
print(t.lower(), t.upper(), t.title(), t.swapcase())
print(t.replace("World", "Python"), t.count("l"))
print(t.find("World"), t.find("xyz"))      # -1 when missing
print(t.startswith("Hell"), t.endswith("!"))
print("42".isdigit(), "abc".isalpha(), "  ".isspace())
print("report.csv".removesuffix(".csv"), "v1.2".removeprefix("v"))  # 3.9+`, note: '<code>find</code> returns −1; <code>index</code> raises <code>ValueError</code>.' },
      { label: 'Immutability', code: `s = "cat"
s.upper()                 # result thrown away
print(s)
s = s.upper()             # rebind to the new string
print(s)

try:
    s[0] = "B"
except TypeError as e:
    print("TypeError:", e)

s = "B" + s[1:]
print(s)`, note: 'Same as Java’s <code>String</code>: <code>s.toUpperCase();</code> alone does nothing either.' },
      { label: 'split & join', code: `print("a,b,,c".split(","))        # keeps empty field
print("  a  b   c ".split())       # whitespace runs, no empties
print("a b c".split(" ", 1))       # maxsplit
print("k=v=w".partition("="))      # split once into 3 parts
print("line1\\nline2\\r\\nline3".splitlines())

words = ["fast", "safe", "simple"]
print(", ".join(words))
print("".join(reversed("stressed")))
nums = [1, 2, 3]
print(",".join(str(n) for n in nums))   # join needs strings`, note: '<code>join</code> is called on the separator and only accepts strings.' },
      { label: 'Build strings fast', code: `import time

n = 200_000
t0 = time.perf_counter()
parts = []
for i in range(n):
    parts.append(str(i))
joined = "".join(parts)
t1 = time.perf_counter()
print(f"join: {len(joined)} chars in {t1 - t0:.3f}s")

print("-" * 20)
print("ab" * 3, "abc" in "xxabcxx", sorted("banana"))`, note: 'Collect pieces in a list and <code>join</code> once, like a Java <code>StringBuilder</code>.' },
      { label: 'Unicode & bytes', code: `s = "naïve café 😀"
print(len(s), s.upper())
b = s.encode("utf-8")
print(type(b).__name__, len(b))       # more bytes than characters
print(b.decode("utf-8") == s)
print(ord("A"), chr(97), ord("😀"))
print("straße".upper(), "STRASSE".casefold() == "straße".casefold())`, note: '<code>str</code> is text; <code>bytes</code> is raw data. Encode/decode at the edges (files, network).' }
    ]
  },
  gotchas: [
    { trap: 'Calling a method and ignoring the result', code: `name = "  ada  "
name.strip()          # does nothing useful
name.title()
print(name)           # '  ada  '
name = name.strip().title()   # 'Ada'`, why: 'Strings are immutable. Every method returns a new string, and the original is unchanged.', fix: 'Assign the result. Linters can’t always catch this, so read string code for missing assignments.' },
    { trap: '<code>split(" ")</code> vs <code>split()</code>', code: `print("a  b".split(" "))   # ['a', '', 'b']
print("a  b".split())      # ['a', 'b']
print("".split(","))       # ['']
print("".split())          # []`, why: 'With an explicit separator, every occurrence splits and empty fields are kept. With no argument, runs of whitespace count as one separator and leading/trailing whitespace is ignored.', fix: 'Use <code>split()</code> for “words”, <code>split(",")</code> for structured fields, and the <code>csv</code> module for real CSV (quotes, embedded commas).' },
    { trap: '<code>+=</code> in a loop to build big strings', code: `out = ""
for row in rows:
    out += format_row(row) + "\\n"     # may copy the whole string each time

out = "\\n".join(format_row(r) for r in rows)   # linear`, why: 'Each concatenation can create a new string and copy the old contents. CPython sometimes optimises <code>s += t</code> in place, but that is an implementation detail and not guaranteed.', fix: 'Collect pieces in a list and <code>"".join(...)</code> once, or write to an <code>io.StringIO</code>.' },
    { trap: '<code>"".join(list_of_ints)</code> raises TypeError', code: `ids = [1, 2, 3]
",".join(ids)                      # TypeError: sequence item 0: expected str instance, int found
",".join(map(str, ids))            # '1,2,3'`, why: '<code>join</code> does not convert. Strong typing again.', fix: 'Convert first: <code>map(str, …)</code> or a generator expression.' },
    { trap: 'Backslashes in Windows paths and regexes', code: `path = "C:\\new\\table.txt"     # \\n is a newline, \\t a tab!
path = r"C:\\new\\table.txt"    # raw string: backslashes kept
import re
re.findall(r"\\d+", "a1b22")    # always use raw strings for regex`, why: 'In a normal literal, <code>\\n</code>, <code>\\t</code> and friends are escape sequences. Unknown escapes such as <code>"\\d"</code> produce a <code>SyntaxWarning</code> since Python 3.12.', fix: 'Use raw strings (<code>r"…"</code>) for regexes and Windows paths, or better, <code>pathlib.Path</code> with forward slashes.' },
    { trap: '<code>is</code> on strings works… until it doesn’t', code: `a = "hello"
b = "".join(["hel", "lo"])
print(a == b, a is b)     # True False`, why: 'Some strings are interned (shared) by CPython, so <code>is</code> sometimes appears to work. That is an implementation detail.', fix: 'Always compare strings with <code>==</code>. Java’s rule (“use <code>.equals</code>, not <code>==</code>”) maps to “use <code>==</code>, not <code>is</code>” in Python.' }
  ],
  scenarios: [
    { title: 'Log parser silently drops fields', symptom: 'After a log format change from single to double spaces between columns, a parser reports the wrong status codes for every line.', diagnose: 'The code is <code>parts = line.split(" ")</code> and reads <code>parts[3]</code>. Printing <code>parts</code> shows empty strings between columns.', cause: '<code>split(" ")</code> splits on every single space and keeps empty fields, so indexes shift when spacing changes.', fix: 'Split on runs of whitespace, and better, parse with a regex or a structured log format.', fixCode: `parts = line.split()              # whitespace runs, no empty fields
ip, _, _, status, *rest = parts

# or, robust:
import re
LINE = re.compile(r"(?P<ip>\\S+)\\s+\\S+\\s+\\S+\\s+(?P<status>\\d{3})")
m = LINE.match(line)` },
    { title: 'Report generation takes minutes', symptom: 'Building a 50 MB CSV export string takes far longer than expected on PyPy and in some code paths on CPython, and memory spikes.', diagnose: 'Profiling shows most time in a loop doing <code>out = out + row_text</code>.', cause: 'String concatenation in a loop can copy the growing string each time (quadratic). CPython’s in-place optimisation for <code>s += t</code> only applies in specific cases, and other implementations don’t do it.', fix: 'Build a list and join once, or stream rows directly to the file.', fixCode: `import csv

with open("export.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["id", "name", "total"])
    for r in rows:
        w.writerow([r.id, r.name, f"{r.total:.2f}"])` },
    { title: 'Customer names truncated mid-character', symptom: 'A notification service truncates names to fit a 20-byte SMS field. Some messages show garbage characters or fail to send.', diagnose: 'The code slices <code>name.encode("utf-8")[:20]</code> and decodes it again, raising <code>UnicodeDecodeError</code> for names like “Zoë Ångström-Øverli”.', cause: 'Slicing <b>bytes</b> can cut a multi-byte UTF-8 character in half. Slicing a <b>str</b> works on whole code points.', fix: 'Truncate on the str, or decode with <code>errors="ignore"</code> after byte-truncation if the limit is truly in bytes.', fixCode: `def truncate_utf8(text: str, max_bytes: int) -> str:
    return text.encode("utf-8")[:max_bytes].decode("utf-8", errors="ignore")

print(truncate_utf8("Zoë Ångström-Øverli", 20))` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `s = "Python"
print(s[1:4], s[-2:], s[::-1])`, options: ['yth on nohtyP', 'ytho on nohtyP', 'yth ho nohtyP', 'Pyt on nohtyP'], answer: 0, run: true, expect: 'yth on nohtyP', explain: '<code>[1:4]</code> takes indexes 1, 2, 3 (stop excluded). <code>[-2:]</code> takes the last two characters. A step of −1 walks backwards over the whole string.' },
    { kind: 'predict', q: 'What does this print?', code: `s = "hello"
try:
    s[0] = "H"
except TypeError:
    print("immutable")
s.capitalize()
print(s)`, options: ['immutable<br>Hello', 'immutable<br>hello', 'Hello<br>Hello', 'hello'], answer: 1, run: true, expect: 'immutable\nhello', explain: 'Item assignment raises <code>TypeError</code>. <code>s.capitalize()</code> returns a new string, but nobody keeps it, so <code>s</code> is still <code>"hello"</code>.' },
    { kind: 'predict', q: 'What does this print?', code: `print("a,b,,c".split(","), "a b  c".split())`, options: ["['a', 'b', 'c'] ['a', 'b', 'c']", "['a', 'b', '', 'c'] ['a', 'b', '', 'c']", "['a', 'b', '', 'c'] ['a', 'b', 'c']", "['a,b,,c'] ['a', 'b', 'c']"], answer: 2, run: true, expect: "['a', 'b', '', 'c'] ['a', 'b', 'c']", explain: 'With an explicit separator, two adjacent commas produce an empty field. With no argument, <code>split()</code> treats any run of whitespace as one separator.' },
    { kind: 'predict', q: 'What does this print?', code: `print("-".join(["x", "y", "z"]), "-".join("abc"))`, options: ['x-y-z abc', 'x-y-z a-b-c', '-x-y-z- -a-b-c-', 'TypeError'], answer: 1, run: true, expect: 'x-y-z a-b-c', explain: '<code>join</code> accepts any iterable of strings. A string is an iterable of one-character strings, so <code>"-".join("abc")</code> puts the separator between its characters.' },
    { kind: 'predict', q: 'What does this print?', code: `n = 3.14159
name = "pi"
print(f"{name}={n:.2f}|{name!r}|{n=}")`, options: ["pi=3.14|'pi'|n=3.14159", "pi=3.14|pi|3.14159", "pi=3.14159|'pi'|n=3.14", "{name}={n:.2f}|{name!r}|{n=}"], answer: 0, run: true, expect: "pi=3.14|'pi'|n=3.14159", explain: '<code>:.2f</code> formats to two decimals. <code>!r</code> uses <code>repr()</code>, which adds quotes. <code>{n=}</code> (3.8+) prints the expression text, <code>=</code>, and the repr of the value.' },
    { kind: 'predict', q: 'What does this print?', code: `print("abc" * 2, "b" in "abc", len("héllo"))`, options: ['abcabc True 5', 'abcabc True 6', 'TypeError', 'abc2 True 5'], answer: 0, run: true, expect: 'abcabc True 5', explain: '<code>*</code> repeats a string. <code>in</code> tests for a substring. <code>len</code> counts code points, and <code>é</code> in source code is a single code point here, so the length is 5 (its UTF-8 encoding would be 6 bytes).' },
    { kind: 'predict', q: 'What does this print?', code: `print(repr("Hello"[10:]), "Hello"[1:100], "Hello"[-3:-1])`, options: ["IndexError", "'' ello ll", "'' ello llo", "None ello ll"], answer: 1, run: true, expect: "'' ello ll", explain: 'Slices clip their bounds to the string, so out-of-range slices never raise: <code>[10:]</code> is empty and <code>[1:100]</code> runs to the end. <code>[-3:-1]</code> takes indexes 2 and 3: <code>"ll"</code>.' },
    { kind: 'predict', q: 'What does this print?', code: `s = "  Hi  "
t = s.strip()
print(repr(s), repr(t), t.lower() == "hi", s.find("x"))`, options: ["'  Hi  ' 'Hi' True -1", "'Hi' 'Hi' True -1", "'  Hi  ' 'Hi' False None", "'  Hi  ' 'Hi' True ValueError"], answer: 0, run: true, expect: "'  Hi  ' 'Hi' True -1", explain: '<code>strip</code> returns a new string and leaves <code>s</code> unchanged. <code>find</code> returns −1 when the substring is missing; <code>index</code> would raise <code>ValueError</code>.' }
  ],
  interview: [
    { q: 'Are Python strings mutable? What does that mean in practice?', a: '<p>No. A str cannot change after creation: <code>s[0] = "x"</code> raises <code>TypeError</code>, and methods like <code>upper()</code> return new strings. In practice: always assign method results, build big strings with <code>join</code>, and strings are safe to use as dict keys.</p>', lvl: 'core' },
    { q: 'Explain slicing: <code>s[start:stop:step]</code>.', a: '<p>It returns a new string from <code>start</code> up to but not including <code>stop</code>, taking every <code>step</code>-th character. Omitted parts default to the beginning, the end and 1. Negative indexes count from the end, and a negative step walks backwards (<code>s[::-1]</code> reverses). Out-of-range bounds are clipped, so slicing never raises <code>IndexError</code>, unlike indexing.</p>', fu: 'What is <code>s[:n] + s[n:]</code> for any n? (Always <code>s</code>.)', lvl: 'core' },
    { q: 'How do you reverse a string? Check for a palindrome?', a: '<p><code>s[::-1]</code>, or <code>"".join(reversed(s))</code>. A palindrome check: <code>t = s.casefold(); return t == t[::-1]</code>, optionally filtering non-alphanumerics first.</p>', lvl: 'core' },
    { q: 'What are f-strings and how do they compare with other formatting?', a: '<p>Literals prefixed with <code>f</code> (3.6+) whose <code>{expr}</code> parts are evaluated at run time and formatted with an optional spec: <code>f"{price:.2f}"</code>, <code>f"{name!r}"</code>, <code>f"{x=}"</code> (3.8+). They are usually the clearest and fastest choice. Older styles are <code>"%s" % x</code> and <code>"{}".format(x)</code>. Since 3.12 (PEP 701) f-strings can nest the same quote type and contain backslashes and comments in expressions.</p>', fu: 'Why shouldn’t you build SQL with f-strings? (Injection: use query parameters.)', lvl: 'core' },
    { q: 'What is the difference between <code>split()</code> and <code>split(" ")</code>?', a: '<p><code>split()</code> splits on runs of any whitespace and drops leading/trailing whitespace, so it never returns empty strings for normal input. <code>split(" ")</code> splits at every single space and keeps empty fields. <code>"".split()</code> is <code>[]</code> but <code>"".split(",")</code> is <code>[\'\']</code>.</p>', lvl: 'core' },
    { q: 'Why is <code>join</code> a method of the separator?', a: '<p>Because it works on any iterable of strings (list, tuple, generator, another string), so it belongs to str rather than to each container type. Java made the same choice with the static <code>String.join(sep, items)</code>. It also lets join compute the final size and build the result in one pass.</p>', lvl: 'core' },
    { q: 'How do you build a large string efficiently?', a: '<p>Collect pieces in a list and call <code>"".join(pieces)</code> once, or write to <code>io.StringIO</code> or straight to a file. Repeated <code>+=</code> may copy the string each time; CPython sometimes optimises it, but you should not rely on that.</p>', lvl: 'core' },
    { q: 'What is the difference between <code>str</code> and <code>bytes</code>?', a: '<p><code>str</code> is a sequence of Unicode code points (text). <code>bytes</code> is a sequence of integers 0–255 (raw data). Convert with <code>s.encode("utf-8")</code> and <code>b.decode("utf-8")</code>. Python 3 never mixes them implicitly: <code>"a" + b"b"</code> is a <code>TypeError</code>. Decode at input, encode at output.</p>', lvl: 'deep' },
    { q: 'What does <code>len()</code> return for a string with emoji or accents?', a: '<p>The number of code points. <code>len("😀")</code> is 1 in Python but <code>"😀".length()</code> is 2 in Java (UTF-16 units). A user-visible character can still be several code points: an <code>e</code> plus a combining accent is 2, and flag emoji are 2. Normalise with <code>unicodedata.normalize</code> when it matters.</p>', lvl: 'deep' },
    { q: 'Name some string methods you use all the time.', a: '<ul><li>Cleaning: <code>strip</code>, <code>lower</code>/<code>upper</code>/<code>casefold</code>, <code>replace</code>.</li><li>Testing: <code>startswith</code>/<code>endswith</code> (accept tuples), <code>in</code>, <code>isdigit</code>.</li><li>Searching: <code>find</code> (−1) vs <code>index</code> (raises), <code>count</code>.</li><li>Splitting: <code>split</code>, <code>rsplit</code>, <code>partition</code>, <code>splitlines</code>; joining: <code>join</code>.</li><li>3.9+: <code>removeprefix</code>/<code>removesuffix</code> (safer than <code>strip</code> with a character set).</li></ul>', lvl: 'core' }
  ],
  code: [
    { title: 'Java String vs Python str', lang: 'java', code: `String s = "Python";
char c = s.charAt(0);                       // 'P' (a char)
String sub = s.substring(1, 4);             // "yth"
String last = s.substring(s.length() - 1);  // "n"
String rev = new StringBuilder(s).reverse().toString();
String msg = String.format("%s has %d chars", s, s.length());
String[] parts = "a,b,c".split(",");
String joined = String.join("-", parts);
boolean same = s.equals("Python");`, note: 'Each line has a one-line Python equivalent in the next tab.' },
    { title: 'The same in Python', lang: 'python', code: `s = "Python"
c = s[0]                        # 'P' (a str of length 1)
sub = s[1:4]                    # 'yth'
last = s[-1]                    # 'n'
rev = s[::-1]                   # 'nohtyP'
msg = f"{s} has {len(s)} chars"
parts = "a,b,c".split(",")      # a list, not an array
joined = "-".join(parts)
same = s == "Python"            # == compares values for str`, note: 'Java’s <code>split</code> takes a regex; Python’s takes a plain string. Use <code>re.split</code> for patterns.' },
    { title: 'Cleaning user input', lang: 'python', code: `def normalize_email(raw: str) -> str:
    email = raw.strip().lower()
    if email.count("@") != 1:
        raise ValueError(f"invalid email: {raw!r}")
    local, _, domain = email.partition("@")
    local = local.split("+", 1)[0]      # drop "+tag"
    return f"{local}@{domain}"

def slugify(title: str) -> str:
    words = "".join(ch if ch.isalnum() else " " for ch in title.lower()).split()
    return "-".join(words)

print(normalize_email("  Ada+news@Example.COM "))   # ada@example.com
print(slugify("Hello, World! Python 3.12"))         # hello-world-python-3-12`, note: 'Strip, normalise case, split and join cover most real text clean-up.' }
  ]
});

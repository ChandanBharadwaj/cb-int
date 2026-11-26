IA.register({
  track: 'python',
  slug: 'comprehensions',
  title: 'Comprehensions',
  tagline: 'A comprehension is a <b>for-loop that builds a collection, written as one expression</b>: <code>[x * x for x in nums if x &gt; 0]</code>. Lists, dicts and sets all have one, and round brackets give a lazy generator. For a Java developer it is <code>stream().filter().map().collect()</code> with less ceremony.',
  tldr: {
    problem: 'Python code is full of “make an empty list, loop, maybe append”. Comprehensions say that in one line, but they are easy to over-nest, easy to misread when <code>if</code> appears in two different places, and the dict version silently keeps the last duplicate key.',
    model: 'Read it left to right as: <b>what to produce</b> → <b>for each item</b> → <b>keep only if</b>. <code>[expr for x in src if cond]</code> is exactly <code>out = []; for x in src: if cond: out.append(expr)</code>. Several <code>for</code>s nest in the order you’d write the loops.',
    hook: '“Where does the <code>if</code> go?” At the <b>end</b> it is a filter (fewer items). At the <b>front</b>, as <code>a if c else b</code>, it chooses a value (same number of items).',
    facts: [
      { v: '4 kinds', l: 'list <code>[…]</code>, dict <code>{k: v …}</code>, set <code>{…}</code>, and the generator expression <code>(…)</code>, which is lazy' },
      { v: '3.0+', l: 'the loop variable of a comprehension does <b>not</b> leak into the surrounding scope (it did for list comprehensions in Python 2)' },
      { v: '3.12', l: 'inlined list, dict and set comprehensions (PEP 709): no hidden function call per comprehension, so they got faster, with the same visible scoping' }
    ]
  },
  intro: {
    what: 'Very often you take one collection and make another from it: square every number, keep only active users, build a lookup table from a list. In Java you’d write a loop or a stream. In Python you write a <b>comprehension</b>: the loop goes <i>inside</i> square brackets (or curly braces), and the result is the new collection.',
    analogy: { icon: '🏭', title: 'A conveyor belt with a gate and a stamp', text: 'Items roll off a belt one by one (<code>for x in nums</code>). A gate lets only some through (<code>if x % 2 == 0</code>). A stamp changes each one that passes (<code>x * x</code>). A box at the end collects the results (<code>[ ]</code>). Brackets pick the box: a list keeps everything in order, a set drops duplicates, a dict files each item under a key.' },
    steps: [
      { t: 'The loop you already know', d: 'Build a list of squares the long way.', code: 'squares = []\nfor x in range(5):\n    squares.append(x * x)\n# [0, 1, 4, 9, 16]' },
      { t: 'The same thing as a comprehension', d: 'Move the <code>for</code> inside brackets; the thing to append goes first.', code: 'squares = [x * x for x in range(5)]' },
      { t: 'Add a filter', d: 'An <code>if</code> at the end keeps only some items. Java: <code>.filter(...)</code>.', code: 'evens = [x for x in range(10) if x % 2 == 0]\n# [0, 2, 4, 6, 8]' },
      { t: 'Change the brackets, change the result', d: 'Curly braces with <code>key: value</code> make a dict; without a colon, a set.', code: 'names = ["ann", "bob", "ann"]\n{n: len(n) for n in names}   # {\'ann\': 3, \'bob\': 3}\n{n.upper() for n in names}   # {\'ANN\', \'BOB\'}' },
      { t: 'Know when to stop', d: 'If it doesn’t fit on one or two readable lines, or it needs side effects (printing, saving), write a normal <code>for</code> loop.' }
    ],
    terms: [
      ['list comprehension', '<code>[expr for x in iterable if cond]</code>: builds a new list.'],
      ['dict comprehension', '<code>{k: v for x in iterable}</code>: builds a dict. A repeated key keeps the last value.'],
      ['set comprehension', '<code>{expr for x in iterable}</code>: builds a set, so duplicates disappear.'],
      ['generator expression', '<code>(expr for x in iterable)</code>: produces values lazily, one at a time. It can be used only once.'],
      ['iterable', 'Anything a <code>for</code> loop can walk: lists, strings, dicts (their keys), files (their lines), <code>range</code>.'],
      ['conditional expression', '<code>a if cond else b</code>: Python’s version of Java’s <code>cond ? a : b</code>.']
    ]
  },
  visual: {
    title: 'Step through a comprehension',
    caption: 'Pick a kind and press <b>Play</b> or <b>Step</b>. The list and nested examples run the equivalent <code>for</code> loop line by line; the right side shows the source, the filter result and the collection being built. Try <b>dict</b> to see a duplicate key overwrite, and <b>generator</b> to see that no list is ever built.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Loop vs comprehension', code: `nums = [3, 4, 7, 8, 10]

# the long way
evens_sq = []
for x in nums:
    if x % 2 == 0:
        evens_sq.append(x * x)
print("loop:         ", evens_sq)

# the same thing in one expression
print("comprehension:", [x * x for x in nums if x % 2 == 0])`, note: 'Both print <code>[16, 64, 100]</code>.' },
      { label: 'Filter vs if/else', code: `temps = [-3, 12, -1, 25]

# if at the END = filter: fewer items
print([t for t in temps if t > 0])

# if/else at the FRONT = choose a value: same number of items
print([t if t > 0 else 0 for t in temps])

# this is a SyntaxError (else needs the front position):
# [t for t in temps if t > 0 else 0]`, note: '<code>[12, 25]</code> versus <code>[0, 12, 0, 25]</code>.' },
      { label: 'dict & set', code: `users = [
    {"id": 7, "name": "Asha", "team": "core"},
    {"id": 9, "name": "Ben", "team": "web"},
    {"id": 12, "name": "Chen", "team": "core"},
]
by_id = {u["id"]: u["name"] for u in users}      # lookup table
teams = {u["team"] for u in users}               # unique values
print(by_id)
print(sorted(teams))

# swap keys and values
print({name: uid for uid, name in by_id.items()})

# duplicate keys: the LAST one wins, silently
print({len(w): w for w in ["a", "bb", "cc", "d"]})`, note: 'Java’s <code>Collectors.toMap</code> would throw on the duplicate key; Python just overwrites.' },
      { label: 'Nested', code: `grid = [[1, 2, 3], [4, 5, 6]]

# flatten: the for-clauses read in the same order as nested loops
print([n for row in grid for n in row])

# build a 2-D structure: a comprehension INSIDE a comprehension
print([[n * 10 for n in row] for row in grid])

# transpose
print([[row[i] for row in grid] for i in range(3)])

# pairs with a condition
print([(a, b) for a in range(3) for b in range(3) if a < b])`, note: 'One <code>for…for</code> = flatten. A comprehension inside another = keep the shape.' },
      { label: 'Generator (lazy)', code: `import sys

nums = range(1_000_000)
as_list = [x * x for x in nums]
as_gen = (x * x for x in nums)
print("list bytes:", sys.getsizeof(as_list))
print("gen bytes: ", sys.getsizeof(as_gen))

# functions that consume an iterable accept a bare generator
print(sum(x * x for x in range(10)))
print(any(x > 5 for x in [1, 9, 2]))   # stops at the first True

# a generator can be consumed only once
g = (c.upper() for c in "abc")
print(list(g), list(g))`, note: 'The list holds a million references; the generator is a couple of hundred bytes whatever the size. Exact byte counts vary by Python version.' },
      { label: 'Walrus & strings', code: `import re

lines = ["id=7", "junk", "id=42", "id=x"]

# := (3.8+) lets you compute once, then filter on the result
ids = [int(m.group(1)) for ln in lines if (m := re.fullmatch(r"id=(\\d+)", ln))]
print(ids)

# strings are iterable too
word = "Mississippi"
print({c: word.count(c) for c in sorted(set(word))})
print("".join(c for c in word if c not in "aeiou"))`, note: 'For real counting use <code>collections.Counter(word)</code>.' }
    ]
  },
  gotchas: [
    { trap: 'Putting else in the filter position', code: `[x for x in xs if x > 0 else 0]     # SyntaxError
[x if x > 0 else 0 for x in xs]     # OK: choose a value
[x for x in xs if x > 0]            # OK: filter`, why: 'The trailing <code>if</code> is a filter and has no <code>else</code>. <code>a if c else b</code> is an ordinary expression, so it belongs where the produced value goes: the front.', fix: 'Ask yourself: do I want <i>fewer</i> items (trailing if) or a <i>different value</i> per item (front if/else)?' },
    { trap: 'A comprehension used only for its side effect', code: `[print(u) for u in users]     # builds a useless list of Nones
[db.save(u) for u in users]   # hides an important action in an expression`, why: 'A comprehension exists to build a value. Using it for side effects allocates a throwaway list and buries the action where reviewers don’t expect it.', fix: 'Write a normal <code>for</code> loop. Loops are not “un-Pythonic”.' },
    { trap: 'Dict comprehension silently drops duplicates', code: `emails = {u.email: u for u in users}  # two users share an email?
len(emails) < len(users)              # one was overwritten, no error`, why: 'Assigning an existing key replaces the value. There is no merge function and no exception, unlike Java’s <code>Collectors.toMap</code>.', fix: 'If duplicates are possible, group explicitly: <code>defaultdict(list)</code> plus a loop, or check <code>len(result) == len(source)</code>.' },
    { trap: 'Reusing an exhausted generator', code: `squares = (x * x for x in nums)
total = sum(squares)
biggest = max(squares)   # ValueError: max() iterable argument is empty`, why: 'A generator expression yields each value once and is then empty. It is like a Java <code>Stream</code>: you can’t reuse it.', fix: 'Use a list comprehension if you need the values twice, or recreate the generator.' },
    { trap: 'Unreadable nesting', code: `[c for r in m if r for c in r if c and c.ok if c.v > 0]`, why: 'Each extra <code>for</code> or <code>if</code> adds a level you must unwind in your head. Order is outer-to-inner, which many people read backwards.', fix: 'Rule of thumb: at most two <code>for</code>s and one simple condition. Otherwise use loops, or a small named helper function.' },
    { trap: 'Class variables are invisible inside a comprehension in a class body', code: `class Config:
    BASE = 10
    vals = [BASE * i for i in range(3)]   # NameError: name 'BASE' is not defined`, why: 'The comprehension body has its own scope, and class bodies are not enclosing scopes for nested code. Only the outermost iterable (<code>range(3)</code>) is evaluated in the class scope. This is still true in 3.12 after inlining.', fix: 'Compute the value outside the class, or write a loop in the class body.' }
  ],
  scenarios: [
    { title: 'Report job runs out of memory on a 2 GB file',
      symptom: 'A nightly script that sums order amounts from a large CSV export is OOM-killed. It worked fine on last year’s smaller file.',
      diagnose: `rows = [line.split(",") for line in open(path)]   # whole file in RAM
total = sum(float(r[3]) for r in rows)`,
      cause: 'The list comprehension materialises every line as a list of strings before summing. Memory grows with the file size.',
      fix: 'Use a generator expression (or a plain loop) so only one line is in memory at a time, and close the file with <code>with</code>.',
      fixCode: `with open(path, encoding="utf-8") as f:
    total = sum(float(line.split(",")[3]) for line in f)` },
    { title: 'User lookup returns the wrong account',
      symptom: 'After a data import, some users log in and see someone else’s profile. No errors are logged.',
      diagnose: `by_email = {u["email"].lower(): u for u in users}
print(len(users), len(by_email))   # 10432 10417`,
      cause: 'Fifteen emails differed only by case. The dict comprehension kept the last user for each lower-cased key and silently dropped the others.',
      fix: 'Detect collisions where the index is built, and fail loudly.',
      fixCode: `from collections import defaultdict

groups = defaultdict(list)
for u in users:
    groups[u["email"].lower()].append(u)
dupes = {k: v for k, v in groups.items() if len(v) > 1}
if dupes:
    raise ValueError(f"duplicate emails: {sorted(dupes)[:5]}")
by_email = {k: v[0] for k, v in groups.items()}` }
  ],
  puzzles: [
    { kind: 'output', q: 'What does this print?', code: `print([x * x for x in range(6) if x % 2 == 0])`, options: ['[0, 4, 16]', '[4, 16]', '[0, 1, 4, 9, 16, 25]', '[1, 9, 25]'], answer: 0, run: true, expect: '[0, 4, 16]', explain: '<code>range(6)</code> is 0..5. The filter keeps 0, 2, 4 (0 is even), and the front expression squares them.' },
    { kind: 'output', q: 'Duplicate keys in a dict comprehension. What is printed?', code: `words = ["a", "bb", "cc", "d"]
print({len(w): w for w in words})`, options: ["{1: 'd', 2: 'cc'}", "{1: 'a', 2: 'bb'}", "{1: 'a', 2: 'bb', 2: 'cc', 1: 'd'}", 'KeyError'], answer: 0, run: true, expect: "{1: 'd', 2: 'cc'}", explain: 'Each assignment to an existing key overwrites the value, so the last word of each length wins. The key keeps its original position (1 first, then 2).' },
    { kind: 'output', q: 'In what order do the two for-clauses run?', code: `print([(i, j) for i in range(2) for j in range(i + 1)])`, options: ['[(0, 0), (1, 0), (1, 1)]', '[(0, 0), (0, 1), (1, 1)]', '[(0, 0), (1, 1)]', 'NameError: i'], answer: 0, run: true, expect: '[(0, 0), (1, 0), (1, 1)]', explain: 'The first <code>for</code> is the outer loop. The inner one can use <code>i</code>: for i=0, j is 0; for i=1, j is 0 then 1.' },
    { kind: 'output', q: 'Does the loop variable leak out?', code: `x = 10
squares = [x * x for x in range(3)]
print(x, squares)`, options: ['10 [0, 1, 4]', '2 [0, 1, 4]', '10 [100, 100, 100]', 'NameError'], answer: 0, run: true, expect: '10 [0, 1, 4]', explain: 'In Python 3 the comprehension’s <code>x</code> is local to the comprehension. The outer <code>x</code> stays 10. (A plain <code>for x in …</code> loop <i>would</i> overwrite it.)' },
    { kind: 'output', q: 'A generator expression used twice:', code: `g = (n for n in [1, 2, 3])
print(sum(g), sum(g))`, options: ['6 0', '6 6', '6 None', 'TypeError'], answer: 0, run: true, expect: '6 0', explain: 'The first <code>sum</code> consumes every value. The second gets an already-exhausted generator and sums nothing, which is 0.' },
    { kind: 'output', q: 'Filter or value choice?', code: `print([x if x > 0 else 0 for x in [-1, 2, -3, 4]])`, options: ['[0, 2, 0, 4]', '[2, 4]', '[-1, 0, -3, 0]', 'SyntaxError'], answer: 0, run: true, expect: '[0, 2, 0, 4]', explain: 'The if/else is at the front, so it picks a value for <i>every</i> item. Nothing is filtered out.' },
    { kind: 'output', q: 'Set comprehension. What is printed?', code: `print(sorted({c.lower() for c in "AaBbA"}))`, options: ["['a', 'b']", "['A', 'B', 'a', 'b']", "['a', 'a', 'b', 'b', 'a']", "{'a', 'b'}"], answer: 0, run: true, expect: "['a', 'b']", explain: 'Lower-casing gives a, a, b, b, a; the set keeps one of each; <code>sorted</code> turns it into an ordered list.' },
    { kind: 'output', q: 'Lambdas built in a comprehension:', code: `fs = [lambda: i for i in range(3)]
print([f() for f in fs])`, options: ['[2, 2, 2]', '[0, 1, 2]', '[0, 0, 0]', 'NameError'], answer: 0, run: true, expect: '[2, 2, 2]', explain: 'Each lambda looks up <code>i</code> when it is <i>called</i>, not when it is created. By then the loop has finished and <code>i</code> is 2. Fix: <code>lambda i=i: i</code>. See <a href="scoping-closures.html">Scoping &amp; closures</a>.' }
  ],
  interview: [
    { q: 'What is a list comprehension and what does it replace?', a: '<p>An expression that builds a list from an iterable: <code>[expr for x in it if cond]</code>. It replaces the “empty list, loop, append” pattern and corresponds to <code>stream().filter(cond).map(expr).toList()</code> in Java. It is usually a bit faster than the explicit loop because the append is done without a method lookup each time.</p>', lvl: 'core' },
    { q: 'What’s the difference between <code>[x for x in xs if c]</code> and <code>[a if c else b for x in xs]</code>?', a: '<p>The trailing <code>if</code> is a <b>filter</b>: the result can be shorter. The front <code>a if c else b</code> is a <b>conditional expression</b> evaluated for every item: the result has the same length. A trailing <code>if … else</code> is a syntax error.</p>', lvl: 'core' },
    { q: 'List vs generator expression: when do you use which?', a: '<ul><li><b>List</b> <code>[…]</code>: you need the values more than once, need <code>len()</code> or indexing, or the data is small.</li><li><b>Generator</b> <code>(…)</code>: you consume it once, especially into <code>sum</code>, <code>any</code>, <code>all</code>, <code>max</code>, <code>"".join</code>, or the data is large or infinite. Memory is constant and <code>any</code>/<code>all</code> can stop early.</li></ul>', fu: 'Why can you write <code>sum(x for x in xs)</code> without extra brackets? A generator expression that is the only argument of a call may drop its own parentheses.', lvl: 'core' },
    { q: 'How do dict and set comprehensions differ in syntax? What is <code>{}</code>?', a: '<p>Both use braces. A colon makes it a dict (<code>{k: v for …}</code>), no colon makes a set (<code>{v for …}</code>). An empty <code>{}</code> is an empty <b>dict</b>; an empty set is <code>set()</code>.</p>', lvl: 'core' },
    { q: 'In <code>[f(a, b) for a in A for b in B]</code>, which loop is outer?', a: '<p><code>for a in A</code> is the outer loop, exactly as if you wrote the two <code>for</code> statements top to bottom. The produced expression is the only part that moves (to the front).</p>', lvl: 'core' },
    { q: 'Does the comprehension variable leak into the enclosing scope?', a: '<p>Not in Python 3: list, dict and set comprehensions and generator expressions have their own scope for the loop variable. A plain <code>for</code> loop variable does stay defined after the loop, which surprises Java developers in the other direction.</p>', lvl: 'core' },
    { q: 'When should you <i>not</i> use a comprehension?', a: '<ul><li>When it is executed for side effects (logging, saving, printing).</li><li>When it needs more than about two <code>for</code>s or several conditions.</li><li>When you need <code>try/except</code> per item or a <code>break</code>.</li><li>When the result is huge and used once: use a generator instead.</li></ul>', lvl: 'core' },
    { q: 'What does PEP 709 (Python 3.12) change about comprehensions?', a: '<p>Before 3.12, each list, dict or set comprehension compiled to a hidden nested function that was created and called every time. 3.12 <b>inlines</b> them into the enclosing function, which removes that call overhead. The visible behaviour (the loop variable doesn’t leak) is kept; a few details such as tracebacks and <code>locals()</code> inside a comprehension changed. Generator expressions are not inlined.</p>', lvl: 'deep' },
    { q: 'Why does <code>[BASE * i for i in range(3)]</code> fail inside a class body when <code>BASE</code> is a class attribute?', a: '<p>Names in a class body don’t form an enclosing scope for nested scopes such as functions or comprehension bodies. Only the outermost iterable is evaluated in the class scope. So <code>range(BASE)</code> would work, but <code>BASE * i</code> in the body raises <code>NameError</code>.</p>', lvl: 'deep' },
    { q: 'How do you group items (like <code>Collectors.groupingBy</code>)? Can a comprehension do it?', a: '<p>Not cleanly, because a comprehension can’t append to an existing dict entry. Use a loop with <code>collections.defaultdict(list)</code>, or <code>itertools.groupby</code> on sorted data. A comprehension like <code>{k: [x for x in xs if key(x) == k] for k in keys}</code> works but is O(n × k).</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Stream vs comprehension', lang: 'java', code: `// Java 21
List<Integer> squares = nums.stream()
    .filter(x -> x % 2 == 0)
    .map(x -> x * x)
    .toList();

Map<Long, String> byId = users.stream()
    .collect(Collectors.toMap(User::id, User::name));   // throws on duplicate key

Set<String> teams = users.stream().map(User::team).collect(Collectors.toSet());

List<Integer> flat = grid.stream().flatMap(List::stream).toList();

int total = nums.stream().mapToInt(x -> x * x).sum();`, note: 'The same five operations in Python are in the next tab.' },
    { title: 'Python equivalents', lang: 'python', code: `squares = [x * x for x in nums if x % 2 == 0]

by_id = {u.id: u.name for u in users}      # last duplicate wins, no error

teams = {u.team for u in users}

flat = [n for row in grid for n in row]

total = sum(x * x for x in nums)           # generator: no list built`, note: 'A comprehension is eager, like a terminal <code>collect</code>. A generator expression is lazy, like an un-terminated Stream.' },
    { title: 'Agent tooling: build a tool registry', lang: 'python', code: `from typing import Callable

def search(q: str) -> str: ...
def fetch(url: str) -> str: ...
def _internal() -> None: ...

funcs: list[Callable] = [search, fetch, _internal]

# name -> function, skipping private helpers
registry = {f.__name__: f for f in funcs if not f.__name__.startswith("_")}

# JSON-ish descriptions to send to the model
tools = [{"name": name, "description": (f.__doc__ or "").strip()}
         for name, f in registry.items()]`, note: 'Typical shape: a filter plus a dict comprehension for lookup, and a list comprehension to serialise.' }
  ]
});

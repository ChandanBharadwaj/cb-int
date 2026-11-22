IA.register({
  track: 'python',
  slug: 'data-model',
  title: 'Everything is an object',
  tagline: 'A Python variable is a <b>name bound to an object</b>, not a box that holds a value. Assignment never copies. See names as labels on heap objects and aliasing bugs, <code>is</code> vs <code>==</code> and “why did that list change by itself?” all make sense.',
  tldr: {
    problem: 'Java splits the world into primitives (copied) and references (shared). Python has no primitives: <i>every</i> value is an object and <i>every</i> assignment copies a reference. The bugs show up as data that changes “by itself”.',
    model: 'Every object has an <b>identity</b> (fixed for its lifetime), a <b>type</b> (fixed) and a <b>value</b> (changeable only if the type is mutable). Names live in namespaces and point at objects. <code>=</code> binds a name; it never copies the object.',
    hook: '“Why is <code>a is b</code> True for 256 but False for 257?” CPython caches the small ints −5…256. That is an implementation detail: compare values with <code>==</code>, and keep <code>is</code> for <code>None</code> and sentinels.',
    facts: [
      { v: '−5 … 256', l: 'the ints CPython pre-allocates and reuses. Other implementations may differ; the language doesn’t promise it' },
      { v: '3', l: 'things every object has: identity, type and value. Only the value can change, and only for mutable types' },
      { v: '1 None', l: '<code>None</code> is a singleton, so PEP 8 says test it with <code>is</code> / <code>is not</code>, never <code>==</code>' }
    ]
  },
  intro: {
    what: 'In Python every value is an <b>object</b> in memory: numbers, strings, lists, functions, classes, even modules. A variable is just a <b>name</b> that points at an object. Two names can point at the same object, and changing that object through one name is visible through the other.',
    analogy: { icon: '🏷️', title: 'Luggage tags, not lockers', text: 'A Java <code>int</code> is a locker: <code>int b = a</code> puts a copy in a new locker. A Python name is a luggage tag tied to a suitcase. <code>b = a</code> ties a second tag to the <i>same</i> suitcase. Packing a shirt into it (mutation) shows whichever tag you follow. Re-tying one tag to another suitcase (rebinding) changes nothing for the other tag.' },
    steps: [
      { t: 'Assignment binds a name', d: 'The right-hand side is evaluated to an object, then the name is pointed at it.', code: 'a = [1, 2]      # create a list, bind "a" to it' },
      { t: 'Assignment never copies', d: 'A second name for the same object is an <b>alias</b>.', code: 'b = a\nb.append(3)\nprint(a)        # [1, 2, 3]' },
      { t: 'Mutable vs immutable', d: 'list, dict, set and most class instances can change in place. int, float, str, tuple, frozenset and bytes cannot: “changing” one builds a new object.' },
      { t: 'Same value vs same object', d: '<code>==</code> asks “equal value?” and calls <code>__eq__</code>. <code>is</code> asks “the very same object?”.', code: '[1, 2] == [1, 2]   # True\n[1, 2] is [1, 2]   # False' },
      { t: 'Copies are explicit', d: '<code>list(x)</code>, <code>x[:]</code>, <code>x.copy()</code> and <code>copy.copy</code> copy one level. <code>copy.deepcopy</code> copies all the way down.' }
    ],
    terms: [
      ['object', 'A value in memory with an identity, a type and a value.'],
      ['identity / id()', 'What makes an object “itself”. In CPython <code>id()</code> is the memory address. It never changes while the object lives.'],
      ['name / binding', 'An entry in a namespace (a module, a function’s locals) that points at an object.'],
      ['alias', 'A second name bound to the same object.'],
      ['mutable', 'An object whose value can change in place: list, dict, set, most class instances.'],
      ['singleton', 'A type with exactly one instance, such as <code>None</code>, <code>True</code>, <code>False</code>.']
    ]
  },
  visual: {
    title: 'Names point, objects live',
    caption: 'Pick a scenario, then press <b>Play</b> or <b>Step</b>. Names are on the left, objects on the right with an identity label, type and value. An orange outline means that object was just created or mutated. Watch which lines <b>mutate</b> an object and which <b>rebind</b> a name.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Aliasing', code: `a = [1, 2]
b = a
b.append(3)
print("a:", a, "| b is a:", b is a)

b += [4]          # list.__iadd__ mutates in place
print("a:", a)

b = b + [5]       # + builds a NEW list, then rebinds b
print("a:", a, "| b:", b, "| b is a:", b is a)`, note: '<code>+=</code> and <code>= … +</code> look the same but do different things for a list.' },
      { label: 'is vs ==', code: `a = [1, 2]
b = [1, 2]
print("a == b:", a == b, "| a is b:", a is b)

class AlwaysEqual:
    def __eq__(self, other):
        return True

x = AlwaysEqual()
print("x == None:", x == None)   # fooled by __eq__
print("x is None:", x is None)   # identity can't be fooled`, note: 'Why PEP 8 says <code>is None</code>: <code>==</code> runs user code; <code>is</code> doesn’t.' },
      { label: 'Small-int cache', code: `import sys

a, b = int("256"), int("256")
c, d = int("257"), int("257")
print("256 is 256:", a is b)   # True on CPython (cached -5..256)
print("257 is 257:", c is d)   # False on CPython (two objects)
print("257 == 257:", c == d)

s1 = "".join(["hel", "lo"])    # built at run time
s2 = "hello"                   # literal: interned by the compiler
print(s1 == s2, s1 is s2, sys.intern(s1) is s2)`, note: 'Caching and interning are CPython optimisations. Code that depends on them is a bug.' },
      { label: 'Shared rows', code: `grid = [[0] * 3] * 2
grid[0][0] = 9
print(grid)
print("rows are one object:", grid[0] is grid[1])

fixed = [[0] * 3 for _ in range(2)]
fixed[0][0] = 9
print(fixed)
print("rows are one object:", fixed[0] is fixed[1])`, note: '<code>* 2</code> repeats references; the comprehension evaluates <code>[0] * 3</code> twice.' },
      { label: 'copy vs deepcopy', code: `import copy

orig = {"tags": ["a"], "n": 1}
shallow = copy.copy(orig)
deep = copy.deepcopy(orig)

shallow["tags"].append("b")   # inner list is shared with orig
shallow["n"] = 2              # rebinding a key only affects shallow

print("orig:   ", orig)
print("shallow:", shallow)
print("deep:   ", deep)` },
      { label: 'Tuple holding a list', code: `t = (1, [2, 3])
t[1].append(4)            # the list inside can change
print(t)

try:
    t[1] += [5]           # mutates the list, THEN fails to assign t[1]
except TypeError as e:
    print("TypeError:", e)
print(t)                  # ...and the mutation stuck`, note: 'A tuple is immutable in its <i>references</i>, not in the objects they point to.' }
    ]
  },
  gotchas: [
    { trap: '<code>[[0] * n] * m</code> builds m references to one row', code: `board = [[None] * 3] * 3
board[0][0] = "X"
print(board)   # X in every row`, why: 'Sequence repetition copies references. All the outer slots point at the same inner list.', fix: 'Use a comprehension: <code>[[None] * 3 for _ in range(3)]</code>. The inner expression runs once per row.' },
    { trap: 'Using <code>is</code> to compare numbers or strings', code: `if status_code is 200:   # SyntaxWarning (3.8+)
    ...
if name is "admin":       # works in a REPL, fails on real input`, why: '<code>is</code> tests identity. Small-int caching and string interning make it <i>sometimes</i> look right in tests, then fail on values read from a socket or a file. CPython 3.8+ emits <code>SyntaxWarning: "is" with a literal</code>.', fix: 'Use <code>==</code> for values. Keep <code>is</code> for <code>None</code>, <code>True</code>/<code>False</code> checks that must be exact, and your own sentinel objects.' },
    { trap: 'A function mutates the caller’s list', code: `def normalise(tags):
    tags.sort()            # mutates the caller's list!
    return [t.lower() for t in tags]`, why: 'Python passes object references (“call by sharing”). The parameter is a new name for the caller’s object. Mutating it is visible to the caller; rebinding it is not.', fix: 'Don’t mutate arguments unless that is the documented point. Use <code>sorted(tags)</code>, or copy at the boundary.' },
    { trap: 'Shallow copies share nested objects', code: `defaults = {"headers": {"Accept": "json"}}
cfg = defaults.copy()          # or dict(defaults), {**defaults}
cfg["headers"]["X-Tenant"] = "t1"
print(defaults)                # polluted`, why: '<code>dict.copy()</code>, <code>list(x)</code>, <code>x[:]</code>, <code>{**d}</code> and <code>copy.copy</code> copy one level. Inner dicts and lists are shared.', fix: 'Use <code>copy.deepcopy</code> for nested mutable data, or build nested structures fresh. Better still, make shared defaults immutable (tuples, <code>types.MappingProxyType</code>, frozen dataclasses).' },
    { trap: '<code>+=</code> means different things for different types', code: `a = b = [1]
a += [2]      # list: mutates, b sees it
x = y = (1,)
x += (2,)     # tuple: new object, y unchanged`, why: '<code>+=</code> calls <code>__iadd__</code> if the type has one (list, set, bytearray). Otherwise it falls back to <code>__add__</code> and rebinds.', fix: 'Know which types are mutable. When aliases exist, write <code>a = a + b</code> if you want a new object.' },
    { trap: 'Treating <code>id()</code> as a permanent key', code: `seen = {id(obj) for obj in make_temp_objects()}
# objects are freed; their ids can be reused by new objects`, why: 'An id is unique only among objects alive at the same time. In CPython it is an address, and freed memory gets reused.', fix: 'Keep the object alive alongside its id, or use a <code>weakref.WeakKeyDictionary</code> / <code>WeakSet</code> if you need identity-keyed bookkeeping.' }
  ],
  scenarios: [
    { title: 'Granting admin to one user made everyone an admin',
      symptom: 'After a refactor, adding a role to one user showed that role on every user in the same request.',
      diagnose: `roles = dict.fromkeys(user_ids, [])     # the culprit
roles[42].append("admin")
print(roles[7])                         # ['admin']
print(roles[42] is roles[7])            # True`,
      cause: '<code>dict.fromkeys(keys, value)</code> stores the <i>same</i> value object under every key. All users shared one list.',
      fix: 'Build a new list per key with a comprehension, or use <code>defaultdict(list)</code>. Add a test that mutates one entry and checks another.',
      fixCode: `roles = {uid: [] for uid in user_ids}
# or
from collections import defaultdict
roles = defaultdict(list)` },
    { title: 'A cached lookup slowly filled with other people’s data',
      symptom: 'An endpoint returned feature flags that grew over the day. A restart “fixed” it for a few hours.',
      diagnose: `@functools.lru_cache(maxsize=1024)
def flags_for(plan: str) -> list[str]:
    return load_flags(plan)

f = flags_for("pro")
f.append("beta-export")    # a caller "customising" its copy`,
      cause: 'The cache returns the <b>same list object</b> to every caller. One caller mutated it, so every later hit saw the change. Nothing was copied anywhere.',
      fix: 'Return immutable values from caches (tuple, frozenset, frozen dataclass), or copy on the way out. Treat cached objects as shared read-only state.',
      fixCode: `@functools.lru_cache(maxsize=1024)
def flags_for(plan: str) -> frozenset[str]:
    return frozenset(load_flags(plan))` },
    { title: 'Tenant A’s settings appeared in tenant B’s requests',
      symptom: 'Intermittently, a request served for one tenant used another tenant’s timeout and headers. Only under load.',
      diagnose: `DEFAULTS = {"timeout": 5, "headers": {}}

def settings_for(tenant):
    s = DEFAULTS              # alias, not a copy
    s["headers"]["X-Tenant"] = tenant.id
    return s`,
      cause: 'Every request mutated the one module-level dict. Under concurrency, requests saw each other’s writes. A later “fix” with <code>DEFAULTS.copy()</code> still shared the nested <code>headers</code> dict.',
      fix: 'Build per-request settings fresh, and make the shared default read-only so the next mutation fails loudly.',
      fixCode: `from types import MappingProxyType
DEFAULTS = MappingProxyType({"timeout": 5})

def settings_for(tenant):
    return {**DEFAULTS, "headers": {"X-Tenant": tenant.id}}` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `a = [1, 2, 3]
b = a
a = a + [4]
print(b)`, options: ['[1, 2, 3]', '[1, 2, 3, 4]', '[4]', 'TypeError'], answer: 0, run: true, expect: '[1, 2, 3]', explain: '<code>a + [4]</code> builds a new list and <code>a</code> is rebound to it. <code>b</code> still points at the original, unchanged list.' },
    { kind: 'predict', q: 'One character changed. Now what?', code: `a = [1, 2, 3]
b = a
a += [4]
print(b)`, options: ['[1, 2, 3]', '[1, 2, 3, 4]', '[1, 2, 3, [4]]', 'TypeError'], answer: 1, run: true, expect: '[1, 2, 3, 4]', explain: 'For a list, <code>+=</code> calls <code>list.__iadd__</code>, which extends the list <b>in place</b> and returns the same object. <code>b</code> is an alias, so it sees the change.' },
    { kind: 'predict', q: 'What does this print?', code: `grid = [[0] * 2] * 3
grid[1][0] = 5
print(grid)`, options: ['[[0, 0], [5, 0], [0, 0]]', '[[5, 0], [5, 0], [5, 0]]', '[[5, 5], [5, 5], [5, 5]]', 'IndexError'], answer: 1, run: true, expect: '[[5, 0], [5, 0], [5, 0]]', explain: '<code>* 3</code> repeats the <i>reference</i> to one inner list. All three rows are the same object, so writing through <code>grid[1]</code> shows up in every row. Only column 0 changed.' },
    { kind: 'predict', q: 'What does this print?', code: `t = ([1],)
try:
    t[0] += [2]
except TypeError:
    print("error")
print(t)`, options: ['error<br>([1],)', 'error<br>([1, 2],)', '([1, 2],)', 'error'], answer: 1, run: true, expect: 'error\n([1, 2],)', explain: '<code>t[0] += [2]</code> runs in two steps: <code>t[0].__iadd__([2])</code> extends the list in place (this succeeds), then <code>t[0] = result</code> tries to assign into the tuple and raises <code>TypeError</code>. The mutation has already happened.' },
    { kind: 'predict', q: 'On CPython 3.12, what does this print?', code: `a = int("100")
b = int("100")
c = int("1000")
d = int("1000")
print(a is b, c is d, c == d)`, options: ['True True True', 'True False True', 'False False True', 'False False False'], answer: 1, run: true, expect: 'True False True', explain: 'CPython keeps one cached object for each int from −5 to 256, so both 100s are the same object. 1000 is outside the cache, and <code>int()</code> parses at run time, so it allocates two separate objects. This is a <b>CPython implementation detail</b>; the language only promises <code>==</code>.' },
    { kind: 'predict', q: 'What does this print?', code: `def add(item, bag):
    bag.append(item)
    bag = ["new"]
    bag.append(item)
    return bag

mine = []
out = add(1, mine)
print(mine, out)`, options: ['[] [\'new\', 1]', '[1] [\'new\', 1]', '[\'new\', 1] [\'new\', 1]', '[1, 1] [\'new\', 1]'], answer: 1, run: true, expect: "[1] ['new', 1]", explain: 'Call by sharing: <code>bag</code> starts as another name for <code>mine</code>, so the first <code>append</code> mutates the caller’s list. Then <code>bag = ["new"]</code> only rebinds the local name. The caller never sees the new list.' },
    { kind: 'predict', q: 'What does this print?', code: `d = dict.fromkeys(["a", "b"], [])
d["a"].append(1)
print(d)`, options: ["{'a': [1], 'b': []}", "{'a': [1], 'b': [1]}", "{'a': 1, 'b': []}", 'TypeError'], answer: 1, run: true, expect: "{'a': [1], 'b': [1]}", explain: '<code>fromkeys</code> evaluates the default once and stores that one list under every key. Use <code>{k: [] for k in keys}</code> instead.' }
  ],
  interview: [
    { q: 'What does “everything is an object” actually mean in Python?', a: '<p>Every value, including ints, functions, classes and modules, is a heap object with an <b>identity</b>, a <b>type</b> and a <b>value</b>. There are no primitives. A variable is a name in a namespace that refers to an object. You can pass functions around, attach attributes to them and inspect a class at run time, because they are ordinary objects.</p>', fu: 'Is a class an object? (Yes: an instance of its metaclass, usually <code>type</code>.)', lvl: 'core' },
    { q: 'Is Python pass-by-value or pass-by-reference?', a: '<p>Neither label fits. It is “call by sharing” (also called pass by object reference): the function’s parameter becomes a new name bound to the caller’s object. Mutating that object is visible to the caller. Rebinding the parameter is not. This is the same as Java’s behaviour for object references; Python just has no primitives.</p>', lvl: 'core' },
    { q: 'When should you use <code>is</code> instead of <code>==</code>?', a: '<p><code>is</code> compares identity; <code>==</code> calls <code>__eq__</code>. Use <code>is</code> for singletons and sentinels: <code>x is None</code>, <code>x is NotImplemented</code>, <code>value is _MISSING</code>. Use <code>==</code> for everything else. <code>is</code> can’t be overridden and is faster, but it gives meaningless answers for numbers and strings.</p>', lvl: 'core' },
    { q: 'Why can <code>a is b</code> be True for 256 and False for 257?', a: '<p>CPython pre-allocates the ints −5 to 256 and returns the cached object whenever one of those values is created. Larger ints created at run time are new objects. To add to the confusion, equal constants inside one compiled code object can share a single constant, so <code>x = 257; y = 257</code> in one function may still be identical. None of this is guaranteed by the language.</p>', fu: 'Java’s equivalent? <code>Integer.valueOf</code> caches −128…127, so <code>==</code> on boxed Integers has the same trap.', lvl: 'core' },
    { q: 'What is string interning, and when would you call <code>sys.intern</code>?', a: '<p>Interning keeps one shared copy of equal strings. CPython interns identifiers and many identifier-like string constants at compile time. <code>sys.intern(s)</code> does it explicitly. It saves memory when you hold millions of repeated strings (for example, keys parsed from a large file), and dict lookups get faster because the identity check succeeds before the character comparison. Never rely on it for correctness.</p>', lvl: 'deep' },
    { q: 'How do mutability and hashability relate?', a: '<p>A dict key or set member must have a hash that never changes while it is stored. Built-in mutable containers (list, dict, set) therefore set <code>__hash__ = None</code>. Immutable built-ins are hashable if their contents are: <code>(1, 2)</code> is hashable, <code>(1, [2])</code> raises <code>TypeError</code> when hashed. User classes are hashable by identity by default, until you define <code>__eq__</code> without <code>__hash__</code>.</p>', lvl: 'core' },
    { q: 'Shallow vs deep copy?', a: '<p>A shallow copy (<code>copy.copy</code>, <code>list(x)</code>, <code>x[:]</code>, <code>dict.copy()</code>) creates a new outer container whose slots point at the <i>same</i> inner objects. <code>copy.deepcopy</code> recursively copies, with a memo dict so shared references and cycles are copied once. Classes can customise both with <code>__copy__</code> / <code>__deepcopy__</code>. deepcopy can be slow and can’t copy things like locks or open sockets.</p>', lvl: 'core' },
    { q: 'What is <code>id()</code> and what does it guarantee?', a: '<p>An integer that is unique and constant for an object <i>during its lifetime</i>. In CPython it is the memory address. Two objects whose lifetimes don’t overlap can have the same id, so <code>id([]) == id([])</code> may well be True: the first list is freed before the second is allocated.</p>', lvl: 'deep' },
    { q: 'Why does <code>t[0] += [1]</code> on a tuple both fail and succeed?', a: '<p>Augmented assignment on a subscript is “get, in-place operate, set”. The list’s <code>__iadd__</code> mutates it and returns it, then <code>STORE_SUBSCR</code> on the tuple raises <code>TypeError</code>. The exception is raised, but the list was already changed. It is a classic demonstration that a tuple’s immutability is about its references, not about the objects they reference.</p>', lvl: 'deep' },
    { q: 'Where do names actually live?', a: '<p>Module and class namespaces are dicts (<code>module.__dict__</code>, <code>globals()</code>). Function locals are stored in a fixed array of “fast locals” in the frame, which is why the compiler decides at compile time whether a name is local. <code>locals()</code> inside a function builds a dict view of them. In 3.13, PEP 667 defined this precisely: <code>locals()</code> in a function returns an independent snapshot, and <code>frame.f_locals</code> is a write-through proxy.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Defensive boundaries', lang: 'python', code: `from types import MappingProxyType

class Catalog:
    def __init__(self, items: list[str]) -> None:
        self._items = list(items)               # copy in: caller can't mutate us later
        self._meta = {"source": "db"}

    @property
    def items(self) -> tuple[str, ...]:
        return tuple(self._items)               # copy out, immutable

    @property
    def meta(self):
        return MappingProxyType(self._meta)     # read-only live view, no copy`, note: 'Copy mutable data when it crosses a boundary you don’t control, in either direction. Immutable return types make that free.' },
    { title: 'Sentinels with is', lang: 'python', code: `_MISSING = object()          # a unique object nothing else can equal

def get_setting(key: str, default=_MISSING):
    try:
        return _store[key]
    except KeyError:
        if default is _MISSING:          # None is a valid default, so test identity
            raise
        return default`, note: 'A private <code>object()</code> is the standard way to tell “not passed” apart from “passed None”.' },
    { title: 'Java comparison', lang: 'java', code: `// Same aliasing rules as Python for objects:
List<Integer> a = new ArrayList<>(List.of(1, 2));
List<Integer> b = a;          // alias
b.add(3);                     // a sees it

// Same identity trap, different cache range (-128..127):
Integer x = 127, y = 127;
System.out.println(x == y);   // true  (Integer cache)
Integer p = 128, q = 128;
System.out.println(p == q);   // false (two objects)
System.out.println(p.equals(q)); // true: Python's ==`, note: 'Python’s <code>is</code> ≈ Java’s <code>==</code> on references. Python’s <code>==</code> ≈ Java’s <code>.equals()</code>.' }
  ]
});

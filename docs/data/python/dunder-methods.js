IA.register({
  track: 'python',
  slug: 'dunder-methods',
  title: 'Dunder methods & protocols',
  tagline: 'Python syntax is a thin layer over <b>special methods</b>. <code>a + b</code>, <code>x in c</code>, <code>len(x)</code>, <code>if x:</code>, <code>d[k]</code> and <code>print(x)</code> each call a <code>__dunder__</code> on the object’s <i>type</i>. Implement the right ones and your class works with every built-in, the way <code>equals</code>/<code>hashCode</code>/<code>Comparable</code> work in Java, but for operators too.',
  tldr: {
    problem: 'A class with a broken <code>__eq__</code>/<code>__hash__</code> pair silently loses dict entries. One that raises instead of returning <code>NotImplemented</code> breaks <code>sum()</code> and mixed arithmetic. Both bugs are easy to write and hard to spot.',
    model: 'Python looks special methods up on <code>type(obj)</code> and follows fixed fallback chains: <code>__add__</code> → the other operand’s <code>__radd__</code> → <code>TypeError</code>. <code>__contains__</code> → <code>__iter__</code> → <code>__getitem__(0, 1, …)</code>. <code>__bool__</code> → <code>__len__</code> → True. <code>__str__</code> → <code>__repr__</code>.',
    hook: '“Why is my class unhashable?” You defined <code>__eq__</code> but not <code>__hash__</code>, so Python set <code>__hash__ = None</code>. Equal objects must hash equal, and Python won’t guess for you.',
    facts: [
      { v: 'NotImplemented', l: 'the singleton a binary dunder returns to say “try the other operand”. It is not <code>NotImplementedError</code>' },
      { v: 'a == b ⇒ hash', l: 'equal objects must have equal hashes. Defining <code>__eq__</code> alone sets <code>__hash__</code> to <code>None</code>' },
      { v: 'type(x)', l: 'where implicit special-method lookup happens. Assigning <code>obj.__len__</code> on an instance has no effect on <code>len(obj)</code>' }
    ]
  },
  intro: {
    what: 'Methods named with double underscores, such as <code>__init__</code>, <code>__repr__</code> or <code>__add__</code>, are called <b>special methods</b> or <b>dunders</b>. You rarely call them yourself. Python calls them for you when you use an operator or a built-in function. Together, a group of them forms a <b>protocol</b>: implement <code>__len__</code> and <code>__getitem__</code>, and your object behaves like a sequence.',
    analogy: { icon: '🔌', title: 'Standard sockets', text: 'Built-ins are appliances; dunders are the sockets on your class. <code>len()</code> plugs into <code>__len__</code>, <code>+</code> into <code>__add__</code>, <code>for</code> into <code>__iter__</code>. Nobody checks what brand your object is (no <code>implements</code>): if the socket fits, it works. That is <b>duck typing</b>.' },
    steps: [
      { t: 'Syntax becomes a method call', d: 'Each operator maps to a method looked up on the type.', code: 'a + b      # type(a).__add__(a, b)\nlen(x)     # type(x).__len__(x)\nx[k]       # type(x).__getitem__(x, k)\nx in c     # type(c).__contains__(c, x)' },
      { t: 'repr for developers, str for users', d: '<code>__repr__</code> is what you see in the REPL, logs and containers. If you only write one, write <code>__repr__</code>.' },
      { t: 'eq and hash go together', d: 'Objects used as dict keys or in sets need a <code>__hash__</code> consistent with <code>__eq__</code>, computed from fields that never change.' },
      { t: 'Return NotImplemented, don’t raise', d: 'If <code>__add__</code> doesn’t understand the other operand, returning <code>NotImplemented</code> lets Python try <code>other.__radd__</code>.' },
      { t: 'Protocols, not inheritance', d: 'Implement the methods and built-ins work. <code>collections.abc</code> gives you mixins and <code>isinstance</code> checks if you want them.' }
    ],
    terms: [
      ['dunder', '“Double underscore”: a special method such as <code>__len__</code>.'],
      ['protocol', 'A set of methods that gives an object a capability: iteration, containers, context managers.'],
      ['NotImplemented', 'A singleton returned by binary operators meaning “not my job, try the other side”.'],
      ['reflected method', '<code>__radd__</code>, <code>__rmul__</code>…: the right-hand operand’s version, tried second.'],
      ['hashable', 'Has a <code>__hash__</code> that never changes and agrees with <code>__eq__</code>. Required for dict keys and set members.'],
      ['__slots__', 'A class-level declaration of fixed attribute names. Removes the per-instance <code>__dict__</code>.']
    ]
  },
  visual: {
    title: 'What the interpreter actually calls',
    caption: 'Pick an expression and press <b>Play</b> or <b>Step</b>. The trace shows each special method Python tries, in order. Amber means “declined, try the next one” (<code>NotImplemented</code> or not found), green means it answered, red means Python gave up and raised.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Value object', code: `from functools import total_ordering

@total_ordering
class Version:
    __slots__ = ("major", "minor")
    def __init__(self, major: int, minor: int):
        self.major, self.minor = major, minor
    def __repr__(self):
        return f"Version({self.major}, {self.minor})"
    def __eq__(self, other):
        if not isinstance(other, Version):
            return NotImplemented
        return (self.major, self.minor) == (other.major, other.minor)
    def __hash__(self):
        return hash((self.major, self.minor))
    def __lt__(self, other):
        if not isinstance(other, Version):
            return NotImplemented
        return (self.major, self.minor) < (other.major, other.minor)

vs = [Version(3, 12), Version(3, 9), Version(3, 13)]
print(sorted(vs))
print(Version(3, 12) in {Version(3, 12)}, Version(3, 9) >= Version(3, 9))
print(Version(3, 12) == "3.12")   # NotImplemented on both sides -> False`, note: '<code>total_ordering</code> derives <code>&lt;=</code>, <code>&gt;</code>, <code>&gt;=</code> from <code>__eq__</code> and <code>__lt__</code>.' },
      { label: '+ and NotImplemented', code: `class Money:
    def __init__(self, cents): self.cents = cents
    def __repr__(self): return f"Money({self.cents})"
    def __add__(self, other):
        if isinstance(other, Money):
            return Money(self.cents + other.cents)
        return NotImplemented
    def __radd__(self, other):
        if other == 0:              # makes sum() work
            return self
        return NotImplemented

print(Money(5) + Money(7))
print(sum([Money(5), Money(7), Money(1)]))
try:
    Money(5) + 3
except TypeError as e:
    print("TypeError:", e)`, note: 'Delete <code>__radd__</code> and watch <code>sum()</code> fail on <code>0 + Money(5)</code>.' },
      { label: 'Container protocol', code: `class Page:
    def __init__(self, rows): self._rows = list(rows)
    def __len__(self): return len(self._rows)
    def __getitem__(self, i):
        if isinstance(i, slice):
            return Page(self._rows[i])
        return self._rows[i]
    def __contains__(self, x):
        print("  (__contains__ called)")
        return x in self._rows
    def __repr__(self): return f"Page({self._rows})"

p = Page(["a", "b", "c", "d"])
print(len(p), p[0], p[-1], p[1:3])
print("c" in p)
print(list(p))              # no __iter__: falls back to __getitem__(0, 1, ...)
print(bool(Page([])))       # no __bool__: falls back to __len__` },
      { label: 'Lookup is on the type', code: `class C:
    def __len__(self):
        return 1

c = C()
c.__len__ = lambda: 99       # instance attribute
print(len(c))                # 1: len() looks at type(c)
print(c.__len__())           # 99: normal attribute lookup

C.__len__ = lambda self: 42  # patch the class
print(len(c))` },
      { label: '__slots__', code: `import sys

class WithDict:
    def __init__(self, x, y): self.x, self.y = x, y

class WithSlots:
    __slots__ = ("x", "y")
    def __init__(self, x, y): self.x, self.y = x, y

a, b = WithDict(1, 2), WithSlots(1, 2)
print("dict instance + its __dict__:", sys.getsizeof(a) + sys.getsizeof(a.__dict__), "bytes")
print("slots instance:              ", sys.getsizeof(b), "bytes")
print(hasattr(b, "__dict__"))
try:
    b.z = 3
except AttributeError as e:
    print("AttributeError:", e)

class Child(WithSlots):      # forgot __slots__ here
    pass
print("child has __dict__ again:", hasattr(Child(1, 2), "__dict__"))`, note: 'Exact byte counts vary by version and platform; the direction doesn’t.' },
      { label: 'repr vs str', code: `class Token:
    def __init__(self, user, secret):
        self.user, self.secret = user, secret
    def __repr__(self):
        return f"Token(user={self.user!r}, secret='***')"
    def __str__(self):
        return f"token for {self.user}"

t = Token("asha", "s3cr3t")
print(t)            # __str__
print([t])          # containers use __repr__
print(f"{t!r}")
print("%s | %r" % (t, t))` }
    ]
  },
  gotchas: [
    { trap: '<code>__eq__</code> without <code>__hash__</code> makes the class unhashable', code: `class User:
    def __init__(self, id): self.id = id
    def __eq__(self, o): return isinstance(o, User) and self.id == o.id

{User(1)}   # TypeError: unhashable type: 'User'`, why: 'The default hash is identity-based, which would break <code>a == b ⇒ hash(a) == hash(b)</code>. So defining <code>__eq__</code> sets <code>__hash__ = None</code>.', fix: 'Add <code>def __hash__(self): return hash(self.id)</code>, based only on fields that never change. Or use <code>@dataclass(frozen=True)</code>, which generates both.' },
    { trap: 'Hashing mutable fields loses dict entries', code: `class Job:
    def __init__(self, status): self.status = status
    def __eq__(self, o): return self.status == o.status
    def __hash__(self): return hash(self.status)

pending = {job}
job.status = "done"
job in pending      # False: it's stored under the old hash`, why: 'A dict/set files a key under its hash at insert time. Change the hash afterwards and lookups probe the wrong slot. The entry is still there but unreachable.', fix: 'Hash only immutable identity (an id). Make value objects immutable: frozen dataclasses, NamedTuple.' },
    { trap: 'Raising (or returning False) instead of <code>NotImplemented</code>', code: `def __add__(self, other):
    if not isinstance(other, Money):
        raise TypeError("Money only")   # blocks other.__radd__
def __eq__(self, other):
    return self.cents == other.cents    # AttributeError for non-Money`, why: 'Python only tries the other operand’s reflected method if you return <code>NotImplemented</code>. Raising, or crashing on an attribute, prevents interoperability and turns <code>money == None</code> into an exception.', fix: 'Check the type and <code>return NotImplemented</code>. Python then raises the proper <code>TypeError</code> (for operators) or falls back to identity (for <code>==</code>).' },
    { trap: 'Patching a dunder on an instance does nothing', code: `obj.__len__ = lambda: 0      # len(obj) ignores this
mock.__iter__ = ...           # same with unittest.mock.Mock`, why: 'Implicit special-method lookup goes to <code>type(obj)</code> and skips the instance dict. It is faster, and keeps metaclass behaviour sane.', fix: 'Patch the class, subclass, or use <code>unittest.mock.MagicMock</code>, which configures dunders on a per-mock subclass.' },
    { trap: 'An empty container is falsy', code: `def export(rows=None):
    if not rows:            # [] and None both land here
        rows = load_all()   # caller passed [] meaning "export nothing"`, why: 'Truthiness falls back to <code>__len__</code>. An empty but valid value looks the same as a missing one.', fix: 'Say what you mean: <code>if rows is None:</code>.' },
    { trap: '<code>__slots__</code> surprises', code: `class Base:
    __slots__ = ("x",)
class Child(Base):        # no __slots__ -> has __dict__ again
    pass

class Bad:
    __slots__ = ("x",)
    x = 0                 # ValueError: 'x' in __slots__ conflicts with class variable`, why: 'Slots must be declared at every level of the hierarchy to keep instances dict-free. Instances also lose <code>__weakref__</code> unless you list it, and class-level defaults clash with slot names.', fix: 'Declare <code>__slots__</code> on each class (use <code>()</code> if a subclass adds nothing), add <code>"__weakref__"</code> if needed, and set defaults in <code>__init__</code>. <code>@dataclass(slots=True)</code> (3.10+) handles this for you.' },
    { trap: 'An expensive or leaky <code>__repr__</code>', why: 'Loggers, debuggers, error trackers and test failure messages all call <code>repr</code>. A repr that triggers a lazy DB load, or includes a password field, turns every log line into a query or a leak.', fix: 'Keep repr cheap and side-effect free. Mask secrets, and use <code>field(repr=False)</code> in dataclasses.' }
  ],
  scenarios: [
    { title: 'Jobs were processed twice after a status change',
      symptom: 'A worker kept a <code>set</code> of in-flight jobs. After a release, some jobs ran twice, and the set grew without bound.',
      diagnose: `job = Job(id=7, status="queued")
in_flight.add(job)
job.status = "running"
print(job in in_flight)         # False
print(len(in_flight))           # still holds it`,
      cause: 'A refactor made <code>Job</code> a non-frozen dataclass with <code>eq=True, unsafe_hash=True</code>, so the hash included <code>status</code>. Mutating status moved the object’s hash away from the slot it was stored in. Membership tests failed and <code>discard</code> never found it.',
      fix: 'Identity-like objects should hash (and compare) by their stable id only. Keep a <code>set</code> of ids, or define <code>__eq__</code>/<code>__hash__</code> on <code>id</code>.',
      fixCode: `@dataclass(eq=False)
class Job:
    id: int
    status: str
    def __eq__(self, o): return isinstance(o, Job) and self.id == o.id
    def __hash__(self): return hash(self.id)` },
    { title: 'API keys showed up in the error tracker',
      symptom: 'Security found partner API keys in exception reports and debug logs.',
      diagnose: `@dataclass
class PartnerClient:
    base_url: str
    api_key: str

log.debug("calling %r", client)
# PartnerClient(base_url='https://...', api_key='pk_live_...')`,
      cause: 'The dataclass-generated <code>__repr__</code> includes every field. Error trackers capture local variables and call repr on them.',
      fix: 'Exclude secrets from repr, and wrap them in a type whose repr is masked (Pydantic’s <code>SecretStr</code> does this).',
      fixCode: `from dataclasses import dataclass, field

@dataclass
class PartnerClient:
    base_url: str
    api_key: str = field(repr=False)` },
    { title: 'Invoice totals crashed with “int + Money”',
      symptom: 'A new <code>Money</code> type replaced Decimal amounts. Totals pages failed with <code>TypeError: unsupported operand type(s) for +: \'int\' and \'Money\'</code>.',
      diagnose: `total = sum(line.amount for line in invoice.lines)
# sum() starts at 0: 0 + Money(...) -> int.__add__ -> NotImplemented
# -> Money.__radd__? not defined -> TypeError`,
      cause: '<code>sum()</code> starts from the int <code>0</code>. Money only had <code>__add__</code>, so the very first addition had no handler.',
      fix: 'Implement <code>__radd__</code> that accepts 0, or pass an explicit start value.',
      fixCode: `def __radd__(self, other):
    return self if other == 0 else NotImplemented

# or, at call sites:
total = sum((l.amount for l in lines), start=Money(0))` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `class P:
    def __init__(self, x):
        self.x = x
    def __eq__(self, other):
        return self.x == other.x

try:
    s = {P(1)}
    print("hashable")
except TypeError:
    print("unhashable")`, options: ['hashable', 'unhashable', 'AttributeError', 'Nothing'], answer: 1, run: true, expect: 'unhashable', explain: 'Defining <code>__eq__</code> without <code>__hash__</code> sets <code>P.__hash__ = None</code>. Putting an instance in a set needs a hash, so Python raises <code>TypeError: unhashable type: \'P\'</code>.' },
    { kind: 'predict', q: 'What does this print?', code: `class A:
    def __eq__(self, other):
        print("A.__eq__")
        return NotImplemented

class B:
    def __eq__(self, other):
        print("B.__eq__")
        return NotImplemented

print(A() == B())`, options: ['A.__eq__<br>False', 'A.__eq__<br>B.__eq__<br>False', 'A.__eq__<br>B.__eq__<br>TypeError', 'NotImplemented'], answer: 1, run: true, expect: 'A.__eq__\nB.__eq__\nFalse', explain: 'Python tries <code>A.__eq__(a, b)</code>, then the reflected <code>B.__eq__(b, a)</code>. When both return <code>NotImplemented</code>, <code>==</code> falls back to identity (<code>a is b</code>), which is False. Unlike <code>+</code>, <code>==</code> never raises TypeError for this.' },
    { kind: 'predict', q: 'What does this print?', code: `class V:
    def __init__(self, n):
        self.n = n
    def __add__(self, other):
        return V(self.n + other.n)
    def __repr__(self):
        return f"V({self.n})"

try:
    print(sum([V(1), V(2)]))
except Exception as e:
    print(type(e).__name__)`, options: ['V(3)', 'TypeError', 'AttributeError', '3'], answer: 1, run: true, expect: 'TypeError', explain: '<code>sum</code> starts at <code>0</code>, so the first step is <code>0 + V(1)</code>. <code>int.__add__</code> returns NotImplemented, and <code>V</code> has no <code>__radd__</code>, so Python raises <code>TypeError</code>. <code>V.__add__</code> is never called.' },
    { kind: 'predict', q: 'What does this print?', code: `class Box:
    def __len__(self):
        return 0
    def __bool__(self):
        return True

b = Box()
print(bool(b), len(b), "yes" if b else "no")`, options: ['False 0 no', 'True 0 yes', 'True 0 no', 'False 0 yes'], answer: 1, run: true, expect: 'True 0 yes', explain: '<code>__bool__</code> wins when it exists. <code>__len__</code> is only the fallback for truthiness.' },
    { kind: 'predict', q: 'No <code>__iter__</code>, no <code>__contains__</code>. What does this print?', code: `class Squares:
    def __getitem__(self, i):
        if i >= 4:
            raise IndexError
        return i * i

print(list(Squares()), 9 in Squares())`, options: ['TypeError', '[0, 1, 4, 9] True', '[0, 1, 4, 9] False', '[1, 4, 9, 16] True'], answer: 1, run: true, expect: '[0, 1, 4, 9] True', explain: 'The legacy sequence protocol: <code>iter()</code> calls <code>__getitem__</code> with 0, 1, 2… until <code>IndexError</code>. <code>in</code> uses the same fallback and finds 9 at index 3.' },
    { kind: 'predict', q: 'What does this print?', code: `class T:
    def __str__(self):
        return "str"
    def __repr__(self):
        return "repr"

t = T()
print(t, [t], f"{t}", f"{t!r}")`, options: ['str [str] str repr', 'str [repr] str repr', 'repr [repr] repr repr', 'str [repr] repr repr'], answer: 1, run: true, expect: 'str [repr] str repr', explain: '<code>print</code> and plain f-strings use <code>str</code>. A list’s own <code>str</code> shows its items with <code>repr</code>. <code>!r</code> forces repr.' },
    { kind: 'predict', q: 'What does this print?', code: `class P:
    __slots__ = ("x",)

p = P()
p.x = 1
try:
    p.y = 2
except AttributeError:
    print("AttributeError")
print(hasattr(p, "__dict__"))`, options: ['AttributeError<br>False', 'AttributeError<br>True', 'False', 'Nothing; y is stored'], answer: 0, run: true, expect: 'AttributeError\nFalse', explain: 'With <code>__slots__</code> there is no instance <code>__dict__</code>, so only the declared names can be set. (3.13 makes the message more explicit: “…and no __dict__ for setting new attributes”.)' },
    { kind: 'predict', q: 'What does this print?', code: `class C:
    pass

c = C()
c.__len__ = lambda: 5
try:
    print(len(c))
except TypeError:
    print("TypeError")
print(c.__len__())`, options: ['5<br>5', 'TypeError<br>5', 'TypeError<br>TypeError', '0<br>5'], answer: 1, run: true, expect: 'TypeError\n5', explain: '<code>len()</code> looks up <code>__len__</code> on <code>type(c)</code>, which has none, so it raises TypeError. Calling <code>c.__len__()</code> explicitly is ordinary attribute access and finds the instance attribute.' }
  ],
  interview: [
    { q: 'What’s the difference between <code>__repr__</code> and <code>__str__</code>?', a: '<p><code>__repr__</code> is the developer view: unambiguous, ideally <code>eval</code>-able, used by the REPL, containers, <code>%r</code>, <code>!r</code> and debuggers. <code>__str__</code> is the user view, used by <code>print</code> and <code>str()</code>. The default <code>object.__str__</code> calls <code>__repr__</code>, so define repr first.</p>', lvl: 'core' },
    { q: 'What is the <code>__eq__</code>/<code>__hash__</code> contract?', a: '<p>If <code>a == b</code> then <code>hash(a) == hash(b)</code>, and an object’s hash must not change while it is in a hashed collection. Unequal objects may collide. Defining <code>__eq__</code> without <code>__hash__</code> makes instances unhashable. Hash from a tuple of the same immutable fields <code>__eq__</code> compares: <code>hash((self.a, self.b))</code>.</p>', fu: 'What is the Java analogue? (The equals/hashCode contract, but Java doesn’t stop you from breaking it.)', lvl: 'core' },
    { q: 'Explain how <code>a + b</code> is resolved.', a: '<ol><li>If <code>type(b)</code> is a proper subclass of <code>type(a)</code> and overrides <code>__radd__</code>, try <code>b.__radd__(a)</code> first.</li><li>Otherwise try <code>a.__add__(b)</code>.</li><li>If that is missing or returns <code>NotImplemented</code>, try <code>b.__radd__(a)</code>.</li><li>If both decline: <code>TypeError</code>.</li></ol><p><code>a += b</code> first tries <code>__iadd__</code>, then falls back to this.</p>', lvl: 'deep' },
    { q: '<code>NotImplemented</code> vs <code>NotImplementedError</code>?', a: '<p><code>NotImplemented</code> is a singleton value returned from binary special methods to let the other operand try. <code>NotImplementedError</code> is an exception, raised by abstract methods that subclasses must override. Mixing them up is a common bug: <code>raise NotImplemented</code> is a TypeError, and returning <code>NotImplementedError</code> from <code>__eq__</code> is truthy nonsense.</p>', lvl: 'core' },
    { q: 'Which methods make a class behave like a read-only sequence?', a: '<p><code>__len__</code> and <code>__getitem__</code> (handling ints and slices, raising <code>IndexError</code>). Iteration and <code>in</code> then work via the fallback protocol. Inheriting from <code>collections.abc.Sequence</code> adds <code>__contains__</code>, <code>__iter__</code>, <code>__reversed__</code>, <code>index</code> and <code>count</code> as mixins, and makes <code>isinstance(x, Sequence)</code> true.</p>', lvl: 'core' },
    { q: 'Why are special methods looked up on the type and not the instance?', a: '<p>Speed and consistency. The interpreter can use C-level slots on the type (<code>tp_as_number</code>, <code>sq_length</code>…) without a dict lookup on each instance. It also avoids paradoxes: <code>hash(int)</code> must call <code>type.__hash__</code>, not <code>int.__hash__</code> meant for int instances.</p>', lvl: 'deep' },
    { q: 'What does <code>__slots__</code> buy you, and what does it cost?', a: '<p>Smaller instances (no per-instance dict), slightly faster attribute access, and typos become <code>AttributeError</code>. Costs: no dynamic attributes, no <code>__weakref__</code> unless listed, it must be repeated in subclasses, it conflicts with class-level defaults, and multiple inheritance with non-empty slots in several bases fails. Worth it for millions of small objects. <code>@dataclass(slots=True)</code> makes it easy.</p>', lvl: 'core' },
    { q: 'How does truthiness work for custom objects?', a: '<p><code>bool(x)</code> calls <code>__bool__</code>, which must return a bool. If it is missing, Python uses <code>__len__() != 0</code>. With neither, the object is always truthy. That is why empty containers are falsy, and why <code>if x:</code> is wrong when you mean <code>if x is not None:</code>.</p>', lvl: 'core' },
    { q: 'How would you make an object callable, or usable with <code>with</code>, or awaitable?', a: '<p>Callable: <code>__call__</code>. Context manager: <code>__enter__</code>/<code>__exit__</code> (async: <code>__aenter__</code>/<code>__aexit__</code>). Awaitable: <code>__await__</code> returning an iterator. Iterator: <code>__iter__</code> + <code>__next__</code>. Each is a protocol: no base class needed.</p>', lvl: 'core' },
    { q: 'When should <code>__eq__</code> compare against other types?', a: '<p>Usually never: check <code>isinstance</code> and return <code>NotImplemented</code> otherwise. Then <code>Money(5) == 5</code> is False (identity fallback) rather than True or an exception. Pandas and NumPy deliberately break this rule by returning arrays from <code>==</code>, which is why <code>if df == x:</code> raises “truth value is ambiguous”.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'A production value object', lang: 'python', code: `from __future__ import annotations
from decimal import Decimal
from functools import total_ordering

@total_ordering
class Money:
    __slots__ = ("amount", "currency")

    def __init__(self, amount: Decimal | int | str, currency: str = "EUR") -> None:
        self.amount = Decimal(amount)
        self.currency = currency

    def __repr__(self) -> str:
        return f"Money({str(self.amount)!r}, {self.currency!r})"

    def __format__(self, spec: str) -> str:            # f"{m:.2f}"
        return f"{self.amount:{spec or ''}} {self.currency}"

    def _same(self, other: object) -> bool:
        return isinstance(other, Money) and other.currency == self.currency

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Money):
            return NotImplemented
        return (self.amount, self.currency) == (other.amount, other.currency)

    def __hash__(self) -> int:
        return hash((self.amount, self.currency))

    def __lt__(self, other: Money) -> bool:
        if not self._same(other):
            return NotImplemented
        return self.amount < other.amount

    def __add__(self, other: Money) -> Money:
        if not self._same(other):
            return NotImplemented
        return Money(self.amount + other.amount, self.currency)

    def __radd__(self, other: object) -> Money:
        return self if other == 0 else NotImplemented   # sum() support`, note: 'In real code, prefer <code>@dataclass(frozen=True, slots=True, order=True)</code> and add only the arithmetic. It generates the eq/hash/repr boilerplate.' },
    { title: 'Sequence via collections.abc', lang: 'python', code: `from collections.abc import Sequence

class ResultPage(Sequence):
    """Read-only page of rows. abc gives __contains__, __iter__, index, count."""
    def __init__(self, rows: list[dict], total: int) -> None:
        self._rows = rows
        self.total = total

    def __len__(self) -> int:
        return len(self._rows)

    def __getitem__(self, i):
        return self._rows[i]          # list handles int and slice

page = ResultPage([{"id": 1}, {"id": 2}], total=40)
assert isinstance(page, Sequence) and len(page) == 2`, note: 'Abstract base classes give you free methods and a real <code>isinstance</code> check; <code>typing.Protocol</code> gives static checking without inheritance (see <a href="typing.html">Type hints</a>).' },
    { title: 'Java comparison', lang: 'java', code: `// Python dunder          ->  Java
// __repr__ / __str__     ->  toString()
// __eq__ / __hash__      ->  equals() / hashCode()
// __lt__ (+ total_ordering) -> Comparable<T>.compareTo()
// __iter__               ->  Iterable<T>.iterator()
// __len__, __getitem__   ->  List<T>.size(), get(i)
// __enter__ / __exit__   ->  AutoCloseable + try-with-resources
// __add__, __mul__ ...   ->  no operator overloading: money.plus(other)

public record Money(BigDecimal amount, String currency) {
    public Money plus(Money o) {
        if (!currency.equals(o.currency)) throw new IllegalArgumentException();
        return new Money(amount.add(o.amount), currency);
    }
}   // record generates equals/hashCode/toString, like a frozen dataclass` }
  ]
});

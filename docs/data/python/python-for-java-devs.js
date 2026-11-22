IA.register({
  track: 'python',
  slug: 'python-for-java-devs',
  title: 'Python for Java developers',
  tagline: 'You already know objects, collections, exceptions, threads and build tools. Python has all of them, with different defaults: <b>names instead of typed variables</b>, <b>protocols instead of declared interfaces</b>, <b>no checked exceptions</b>, <b>one environment per project instead of a classpath</b>, and a <b>GIL</b> instead of free-running threads. This page maps each Java habit to its Python equivalent, and flags the ones that hurt.',
  tldr: {
    problem: 'Experienced Java developers write Python that works but fights the language: getter/setter classes, one class per file with deep package trees, factories and DI containers, <code>for (int i…)</code> loops, threads for CPU work, and type hints treated as if the runtime enforced them.',
    model: 'A Python variable is a <b>name bound to an object</b>; types live on objects, not names. Behaviour is checked when it is used (duck typing), which <code>typing.Protocol</code> lets a type checker verify statically. Modules are the unit of organisation, functions are first-class values, and composition with plain functions replaces most patterns that need a framework in Java.',
    hook: '“What is the Python equivalent of an interface?” Usually nothing, then a <code>Protocol</code> when you want the type checker to verify it, and an <code>ABC</code> when you want shared implementation or runtime enforcement.',
    facts: [
      { v: 'PEP 544', l: '<code>typing.Protocol</code> (3.8+): structural subtyping. A class matches if it has the right methods; no <code>implements</code> needed' },
      { v: '0', l: 'checked exceptions. Nothing forces callers to catch or declare what a function raises' },
      { v: '1 thread', l: 'runs Python bytecode at a time per process on the default (GIL) CPython build. The 3.13+ free-threaded build (PEP 703) is optional and experimental in 3.13' }
    ]
  },
  intro: {
    what: 'Python and Java solve the same problems, but Python leaves more to convention and less to the compiler. There is no compile step that checks types (type hints are checked by separate tools such as mypy or pyright), no need to put code in classes, and no access modifiers. The trade-off is less ceremony and faster iteration, in exchange for discipline from tests, type checkers and linters.',
    analogy: { icon: '🗣️', title: 'Learning a second language you half know', text: 'Spanish and Italian share most words, so you can be understood on day one. But word-for-word translation sounds odd, and a few “false friends” mean something else entirely. Python for a Java developer is the same: most concepts carry over, the idioms differ, and some look-alikes (<code>==</code>, class attributes, threads) behave differently.' },
    steps: [
      { t: 'Names, not typed variables', d: 'A variable is a label stuck on an object. Rebinding moves the label; mutation changes the object everyone shares.', code: 'a = [1, 2]\nb = a          # same list, two names\nb.append(3)\nprint(a)       # [1, 2, 3]' },
      { t: 'Functions first, classes when you need state', d: 'A module of functions is fine. Use a class when data and behaviour belong together.', code: 'def total(prices: list[float], tax: float = 0.2) -> float:\n    return sum(prices) * (1 + tax)' },
      { t: 'Data classes instead of POJOs', d: 'One decorator writes <code>__init__</code>, <code>__repr__</code> and <code>__eq__</code>.', code: 'from dataclasses import dataclass\n\n@dataclass(frozen=True, slots=True)\nclass Money:\n    amount: int\n    currency: str' },
      { t: 'Protocols instead of interfaces', d: 'Describe the methods you need; any class with them fits.', code: 'from typing import Protocol\n\nclass Notifier(Protocol):\n    def send(self, to: str, text: str) -> None: ...' },
      { t: 'Tools replace the compiler', d: 'Run a type checker and a linter in CI: <code>mypy</code> or <code>pyright</code>, and <code>ruff</code>.' }
    ],
    terms: [
      ['duck typing', '“If it walks like a duck…”: code uses whatever methods an object has, without checking its declared type.'],
      ['Protocol', 'A <code>typing</code> class listing methods and attributes; matched structurally by type checkers.'],
      ['ABC', 'Abstract base class (<code>abc.ABC</code>): nominal, can hold shared code, and refuses to instantiate subclasses missing abstract methods.'],
      ['dunder method', 'A “double underscore” hook such as <code>__eq__</code> or <code>__len__</code> that operators and builtins call.'],
      ['module', 'A <code>.py</code> file. It is the main unit of code organisation, and it is a singleton object once imported.'],
      ['GIL', 'Global Interpreter Lock: in standard CPython only one thread runs Python bytecode at a time.']
    ]
  },
  visual: {
    title: 'Java → Python idiom map',
    caption: 'Pick a category, then press <b>Play</b> to walk through it, or <b>Step</b> one pair at a time. Java is on the left, the idiomatic Python on the right, and the note says what actually changes.'
  },
  extras: [
    { id: 'python-for-java-devs-habits', title: 'Java habits that hurt in Python', label: 'Habits', caption: 'Click a habit to see why it hurts and what to do instead. Each one shows up in real code reviews of Python written by Java teams.' }
  ],
  playground: {
    kind: 'python',
    presets: [
      { label: 'Idioms tour', code: `orders = [("asha", 250), ("ben", 40), ("asha", 80), ("chen", 0)]

# for (int i = 0; ...)  ->  enumerate
for i, (name, amount) in enumerate(orders, start=1):
    print(i, name, amount)

# stream().filter().map().collect()  ->  comprehension
paid = [amount for _, amount in orders if amount > 0]
print("paid:", paid, "total:", sum(paid))

# Collectors.groupingBy(..., summingInt)  ->  dict + get
totals: dict[str, int] = {}
for name, amount in orders:
    totals[name] = totals.get(name, 0) + amount
print("totals:", totals)

# sort by a key, descending; Comparator.comparing(...).reversed()
print(sorted(totals.items(), key=lambda kv: kv[1], reverse=True))

# unpacking, swapping, any/all, zip
first, *rest = paid
a, b = 1, 2; a, b = b, a
print(first, rest, a, b, any(x > 200 for x in paid), all(x > 0 for x in paid))
print(dict(zip(["id", "name"], [7, "asha"])) | {"vip": True})   # merge (3.9+)` },
      { label: 'Duck typing & Protocol', code: `from abc import ABC, abstractmethod
from typing import Protocol, runtime_checkable

@runtime_checkable
class Notifier(Protocol):
    def send(self, to: str, text: str) -> None: ...

class EmailNotifier:                      # no "implements": it just has send()
    def send(self, to, text): print(f"email to {to}: {text}")

class SlackNotifier:
    def send(self, to, text): print(f"slack #{to}: {text}")

def alert(n: Notifier, msg: str) -> None:   # a type checker verifies the structure
    n.send("ops", msg)

for n in (EmailNotifier(), SlackNotifier()):
    alert(n, "disk 91% full")
print("isinstance check:", isinstance(EmailNotifier(), Notifier))

class Repository(ABC):                    # nominal: you must inherit, and implement
    @abstractmethod
    def get(self, id: int): ...
    def get_or_fail(self, id):            # ABCs can carry shared code
        obj = self.get(id)
        if obj is None:
            raise LookupError(id)
        return obj

class HalfDone(Repository):
    pass

try:
    HalfDone()
except TypeError as e:
    print("ABC:", e)` },
      { label: 'Numbers & equality', code: `print(2 ** 100)                        # ints never overflow
print(7 // 2, -7 // 2, -7 % 3)         # floor division: 3 -4 2  (Java: 3 -3 -1)
print(int(-7 / 2), round(2.5), round(3.5))   # truncation; banker's rounding: 2, 4
print(0.1 + 0.2 == 0.3, abs(0.1 + 0.2 - 0.3) < 1e-9)

from decimal import Decimal
print(Decimal("0.1") + Decimal("0.2") == Decimal("0.3"))   # use Decimal for money

a = [1, 2]; b = [1, 2]
print(a == b, a is b)                  # == compares values (Java's equals); is = identity
print(None is None, [] == False, bool([]))   # use "is None", and truthiness for empties` },
      { label: 'Mutable traps', code: `def add(item, bucket=[]):           # default evaluated ONCE, at def time
    bucket.append(item)
    return bucket
print(add(1), add(2))               # [1, 2] [1, 2]

def add_ok(item, bucket=None):
    bucket = [] if bucket is None else bucket
    bucket.append(item)
    return bucket
print(add_ok(1), add_ok(2))

class Cart:
    items = []                      # class attribute: shared by ALL instances
    def add(self, x): self.items.append(x)
a, b = Cart(), Cart()
a.add("apple")
print("b sees:", b.items)

grid = [[0] * 3] * 2                # two references to the same inner list
grid[0][0] = 9
print(grid)` },
      { label: 'POJO → dataclass', code: `from dataclasses import dataclass, field, replace

@dataclass(frozen=True, slots=True, order=True)
class Money:
    amount: int                     # cents
    currency: str = "EUR"

@dataclass
class Order:
    id: int
    lines: list[str] = field(default_factory=list)   # never a shared []
    total: Money = Money(0)

m = Money(1999)
print(m, m == Money(1999), hash(m) == hash(Money(1999)))
print(sorted([Money(5), Money(1), Money(3)]))
print(replace(m, amount=2500))      # "withers" for immutable objects
try:
    m.amount = 1                    # frozen
except Exception as e:
    print(type(e).__name__, e)
o = Order(1); o.lines.append("sku-1")
print(o, Order(2).lines)` },
      { label: 'No overloading', code: `from functools import singledispatch

# Java: three overloads. Python: one function with defaults and keywords
def connect(host: str, port: int = 5432, *, timeout: float = 5.0, ssl: bool = True) -> str:
    return f"{host}:{port} timeout={timeout} ssl={ssl}"

print(connect("db"))
print(connect("db", 6543, ssl=False))     # keyword-only args are self-documenting

# dispatch on the type of the first argument, when you really need it
@singledispatch
def to_json(value) -> str:
    raise TypeError(f"unsupported: {type(value).__name__}")

@to_json.register
def _(value: int) -> str: return str(value)

@to_json.register
def _(value: list) -> str: return "[" + ", ".join(to_json(v) for v in value) + "]"

print(to_json([1, 2, [3]]))

class Temperature:
    def __init__(self, celsius: float): self.celsius = celsius
    @classmethod
    def from_fahrenheit(cls, f: float) -> "Temperature":     # named alternate constructor
        return cls((f - 32) * 5 / 9)

print(round(Temperature.from_fahrenheit(212).celsius, 1))` }
    ]
  },
  gotchas: [
    { trap: 'Getters, setters and private fields', code: `class Account:
    def __init__(self): self.__balance = 0
    def get_balance(self): return self.__balance
    def set_balance(self, v): self.__balance = v`, why: 'Python has no access control. <code>__name</code> only triggers name mangling (<code>_Account__balance</code>), which is meant for avoiding clashes in subclasses. Accessor pairs add noise and protect nothing.', fix: 'Use plain attributes (<code>self.balance</code>), a leading underscore for “internal”, and <code>@property</code> later if you need logic, without changing callers. For value objects use <code>@dataclass(frozen=True)</code>.' },
    { trap: 'Mutable class attributes as “field declarations”', code: `class Cart:
    items = []            # looks like a Java field; it is ONE list for every Cart
    def add(self, x): self.items.append(x)`, why: 'Statements in a class body run once and create <b>class</b> attributes, shared by all instances. Mutating one is like writing to a <code>static</code> field.', fix: 'Assign instance state in <code>__init__</code>, or use <code>@dataclass</code> with <code>field(default_factory=list)</code>.' },
    { trap: 'Mutable default arguments', code: `def add_tag(tag, tags=[]):    # evaluated once, when the def runs
    tags.append(tag)
    return tags`, why: 'Default values are evaluated once, at function definition time, and the same object is reused on every call. State leaks between calls (and between requests).', fix: 'Use <code>None</code> and create inside: <code>tags = [] if tags is None else tags</code>. Ruff rule <code>B006</code> flags it. See <a href="scoping-closures.html">Scope, closures & defaults</a>.' },
    { trap: 'Threads for CPU-bound work', code: `with ThreadPoolExecutor(8) as ex:        # 8 threads, ~1 core of speed
    list(ex.map(score_document, docs))    # pure-Python CPU work`, why: 'On the default CPython build the GIL lets only one thread run bytecode at a time. Threads help with I/O, and with C code that releases the GIL, but not with pure-Python computation.', fix: 'Use <code>ProcessPoolExecutor</code> for CPU-bound Python, vectorise with NumPy, or use asyncio for many concurrent I/O waits. See <a href="gil.html">The GIL</a> and <a href="concurrency-choice.html">Choosing a concurrency model</a>.' },
    { trap: 'Treating type hints as runtime checks', code: `def charge(amount: int) -> None: ...
charge("100")         # runs fine: hints are not enforced`, why: 'Annotations are metadata. The interpreter does not check them; only external type checkers (mypy, pyright) do, and only on code you run them on.', fix: 'Run a type checker in CI. Validate untrusted input at the boundary with Pydantic (or explicit checks), which <i>does</i> enforce types at runtime. See <a href="typing.html">Type hints</a>.' },
    { trap: 'One class per file, deep packages, factories everywhere', code: `com/acme/orders/service/impl/OrderServiceImpl.py
com/acme/orders/factory/OrderServiceFactory.py
# from ..factory.OrderServiceFactory import OrderServiceFactory`, why: 'Python modules are cheap and can hold several related classes and functions. Mirroring Java’s layout makes imports long, invites circular imports, and buries simple code under indirection that Python doesn’t need.', fix: 'Organise by feature in a shallow package (<code>orders/models.py</code>, <code>orders/service.py</code>, <code>orders/api.py</code>). Pass dependencies as constructor or function parameters; a function is already a factory.' },
    { trap: '<code>==</code> and <code>is</code> swapped', code: `if status is "paid": ...      # identity of strings: works by accident, sometimes
if user == None: ...          # works, but can call a custom __eq__`, why: 'In Python, <code>==</code> compares values (it is Java’s <code>equals</code>) and <code>is</code> compares identity (Java’s <code>==</code>). <code>is</code> with a literal emits a <code>SyntaxWarning</code> since 3.8.', fix: 'Use <code>==</code> for values and <code>is</code> only for singletons: <code>is None</code>, <code>is True</code> in rare cases, sentinels.' }
  ],
  scenarios: [
    { title: 'Customer A saw customer B’s items in their basket',
      symptom: 'Shortly after a Java team’s first Python service went live, users occasionally saw other people’s items in their basket preview. Restarting the service “fixed” it for a while.',
      diagnose: `class BasketService:
    pending_items = []                         # meant as an instance field

    def preview(self, user_id, items):
        self.pending_items.extend(items)       # mutates the CLASS attribute
        return render(self.pending_items)`,
      cause: 'A mutable class attribute written like a Java field declaration. Every <code>BasketService</code> instance, in every request handled by the worker, shared one list.',
      fix: 'Keep per-request state local, or in instance attributes created in <code>__init__</code>. Add a test that previews for two users in sequence.',
      fixCode: `@dataclass
class Basket:
    user_id: int
    items: list[Item] = field(default_factory=list)

def preview(user_id: int, items: list[Item]) -> str:
    return render(Basket(user_id, list(items)).items)` },
    { title: '8 threads, 12% faster: the embedding job that wouldn’t scale',
      symptom: 'A batch job chunking and scoring documents in pure Python was moved from a loop to a <code>ThreadPoolExecutor(8)</code>. On an 8-core VM, CPU stayed near one core and throughput barely changed.',
      diagnose: `py-spy dump --pid $(pgrep -f score_docs)
# 8 worker threads: at any moment one is "active", the rest idle
# py-spy dump --native shows the idle ones waiting in take_gil (the GIL)`,
      lang: 'bash',
      cause: 'The work was CPU-bound Python code. The GIL serialises bytecode execution, so threads only interleave on one core. The Java instinct (a thread pool sized to the cores) doesn’t transfer.',
      fix: 'Use processes for CPU-bound Python (and send work in sizeable chunks to amortise pickling), or move the hot loop into NumPy or a compiled library that releases the GIL.',
      fixCode: `from concurrent.futures import ProcessPoolExecutor

def score_batch(paths: list[str]) -> list[float]:
    return [score_document(load(p)) for p in paths]

with ProcessPoolExecutor() as ex:                     # one process per core by default
    batches = [paths[i:i + 200] for i in range(0, len(paths), 200)]
    scores = [s for batch in ex.map(score_batch, batches) for s in batch]` },
    { title: '<code>ImportError: cannot import name \'OrderService\' (most likely due to a circular import)</code>',
      symptom: 'After splitting a module into one class per file, the app failed at startup with an ImportError mentioning a partially initialised module.',
      diagnose: `# orders/service.py
from orders.repository import OrderRepository
class OrderService: ...

# orders/repository.py
from orders.service import OrderService     # only needed for a type hint
class OrderRepository: ...`,
      cause: 'Python executes a module top to bottom on first import. <code>service</code> starts, imports <code>repository</code>, which imports <code>service</code> again and finds it half-initialised, without <code>OrderService</code> defined yet. Java resolves classes lazily, so the same structure is harmless there.',
      fix: 'Remove the cycle: move shared types into a lower-level module, depend on a Protocol, or import only for type checking.',
      fixCode: `# orders/repository.py
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:                       # seen by mypy/pyright, never executed
    from orders.service import OrderService

class OrderRepository:
    def attach(self, svc: OrderService) -> None: ...` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print? (Java would print <code>3 -3 -1 -3</code>.)', code: `print(7 // 2, -7 // 2, -7 % 3, int(-7 / 2))`, options: ['3 -3 -1 -3', '3 -4 2 -3', '3 -4 -1 -4', '3.5 -3.5 -1 -3'], answer: 1, run: true, expect: '3 -4 2 -3', explain: '<code>//</code> is <b>floor</b> division (rounds towards −∞), and <code>%</code> takes the sign of the divisor, so <code>a == (a // b) * b + a % b</code> holds. <code>/</code> is always true division in Python 3; <code>int()</code> truncates towards zero like Java’s integer division.' },
    { kind: 'predict', q: 'What does this print?', code: `a = [1, 2]
b = [1, 2]
print(a == b, a is b, a == tuple(b))`, options: ['True True True', 'True False False', 'False False False', 'True False True'], answer: 1, run: true, expect: 'True False False', explain: '<code>==</code> compares contents (Java’s <code>equals</code>); <code>is</code> compares identity (Java’s <code>==</code>). A list never equals a tuple, even with the same items: <code>==</code> on builtin containers also requires a compatible type.' },
    { kind: 'bug', q: 'What does this print?', code: `def add(x, acc=[]):
    acc.append(x)
    return acc

print(add(1), add(2))`, options: ['[1] [2]', '[1] [1, 2]', '[1, 2] [1, 2]', 'TypeError'], answer: 2, run: true, expect: '[1, 2] [1, 2]', explain: 'The default list is created once, when <code>def</code> runs. Both calls append to the same list, and both return it. <code>print</code> evaluates both arguments before printing, so it shows the final state twice.' },
    { kind: 'bug', q: 'What does this print?', code: `class Cart:
    items = []
    def add(self, x):
        self.items.append(x)

a, b = Cart(), Cart()
a.add("apple")
print(b.items)`, options: ['[]', "['apple']", 'AttributeError', 'None'], answer: 1, run: true, expect: "['apple']", explain: '<code>items</code> is a class attribute, shared like a Java <code>static</code> field. <code>self.items</code> finds it through the class, and <code>append</code> mutates the shared list. (Assigning <code>self.items = …</code> would create an instance attribute instead.)' },
    { kind: 'predict', q: 'What does this print?', code: `print(2 ** 63, 2 ** 63 - 1 + 1 == 2 ** 63, type(2 ** 100).__name__)`, options: ['-9223372036854775808 True long', '9223372036854775808 True int', 'OverflowError', '9.223372036854776e+18 True float'], answer: 1, run: true, expect: '9223372036854775808 True int', explain: 'Python <code>int</code> has arbitrary precision: no overflow and no separate <code>long</code> or <code>BigInteger</code>. Large values cost more memory and time, but they never wrap around like Java’s <code>long</code>.' },
    { kind: 'predict', q: 'What does this print?', code: `from typing import Protocol, runtime_checkable

@runtime_checkable
class Closer(Protocol):
    def close(self) -> None: ...

class File:
    def close(self):
        print("closed")

class Door:
    def close(self, force):
        pass

print(isinstance(File(), Closer), isinstance(Door(), Closer), isinstance(42, Closer))`, options: ['True False False', 'True True False', 'False False False', 'TypeError'], answer: 1, run: true, expect: 'True True False', explain: 'Neither class declares that it implements <code>Closer</code>; matching is structural. <code>@runtime_checkable</code> lets <code>isinstance</code> check that the members <b>exist</b>, not their signatures, so <code>Door</code> passes too. A static type checker would reject <code>Door</code>. Prefer static checking; use runtime checks sparingly.' },
    { kind: 'predict', q: 'What does this print?', code: `class Account:
    def __init__(self):
        self.__balance = 100

a = Account()
print(hasattr(a, "__balance"), a._Account__balance)`, options: ['True 100', 'False 100', 'False AttributeError', 'True AttributeError'], answer: 1, run: true, expect: 'False 100', explain: 'There is no <code>private</code>. A double-underscore name inside a class body is <b>mangled</b> to <code>_Account__balance</code> to avoid clashes with subclasses, and it is still reachable. The convention for “internal” is a single underscore.' },
    { kind: 'concept', q: 'A Java developer replaces a sequential loop of pure-Python scoring with <code>ThreadPoolExecutor(max_workers=8)</code> on the default CPython 3.12 build. What happens to throughput?', options: ['About 8× faster', 'Roughly the same, maybe slightly slower', 'It deadlocks', 'About 2×, because of hyper-threading'], answer: 1, explain: 'The GIL lets one thread execute Python bytecode at a time, so CPU-bound threads take turns on one core, with some switching overhead. Use processes, NumPy (which releases the GIL inside array operations), or the free-threaded build when your dependencies support it.' }
  ],
  interview: [
    { q: 'How is a Python variable different from a Java variable?', a: '<p>A Java local has a declared type and holds either a primitive value or a reference. A Python name has no type; it is bound to an object, and the object carries the type. Assignment never copies: <code>b = a</code> binds a second name to the same object. Argument passing is the same (“pass by object reference”, like Java references), but there are no primitives: ints and strings are immutable objects, so they <i>behave</i> like values. See <a href="data-model.html">Everything is an object</a>.</p>', lvl: 'core' },
    { q: 'Duck typing vs interfaces: how do you design abstractions in Python?', a: '<p>Start with no abstraction: functions that accept whatever has the methods they use. When a boundary deserves a name (a repository, a notifier, an LLM client), define a <code>typing.Protocol</code> listing the methods. Implementations don’t inherit from it; mypy or pyright check that they fit. Use an <code>ABC</code> when you want shared implementation, or runtime enforcement that subclasses implement abstract methods. This keeps ports-and-adapters designs light: an in-memory fake for tests needs no inheritance.</p>', fu: 'When would you add <code>@runtime_checkable</code>? (Rarely: it only checks that members exist, and isinstance checks against Protocols are relatively slow.)', lvl: 'core' },
    { q: 'Python has no checked exceptions. How do you keep error handling disciplined?', a: '<p>A small domain exception hierarchy, translation at boundaries (<code>raise DomainError(...) from e</code>), handling in a few deliberate places (request handler, worker loop, CLI main) that log with tracebacks and map to responses, docstrings that list important exceptions, and tests for failure paths. Linters catch broad or empty <code>except</code> blocks. See <a href="errors-logging.html">Exceptions & logging</a>.</p>', lvl: 'core' },
    { q: 'How do Python threads compare with JVM threads?', a: '<p>Both are real OS threads. On the default CPython build, the GIL allows only one to execute Python bytecode at a time; blocking I/O and many C extensions release it. So threads give concurrency for I/O but not parallelism for Python computation. For CPU-bound Python: processes (<code>multiprocessing</code>, <code>ProcessPoolExecutor</code>), with pickling costs. For large numbers of concurrent I/O waits: <code>asyncio</code>, roughly analogous to virtual threads, but with explicit <code>await</code> points. 3.13 adds an optional free-threaded build without the GIL (PEP 703). <code>x += 1</code> on shared state is not atomic in either language.</p>', lvl: 'core' },
    { q: 'Map Maven concepts onto the Python toolchain.', a: '<p><code>pom.xml</code> → <code>pyproject.toml</code>; Maven Central → PyPI; jar → wheel; the classpath → a virtual environment’s <code>site-packages</code>; <code>dependencyManagement</code>/BOM → a lockfile (<code>uv.lock</code>); <code>mvn test</code> → <code>uv run pytest</code>; Surefire/JaCoCo → pytest + coverage; Checkstyle/SpotBugs → ruff + mypy. The big difference: only one version of a package can exist per environment, and the resolver must satisfy every constraint. See <a href="packaging.html">Packaging & environments</a>.</p>', lvl: 'core' },
    { q: 'What replaces Spring’s dependency injection?', a: '<p>Mostly plain language features: pass collaborators as constructor or function parameters, build the object graph explicitly in one composition root (the app factory, the <code>main</code>), and use modules as singletons for truly global things like settings. Frameworks add DI where it matters: FastAPI’s <code>Depends</code> resolves per-request dependencies and supports test overrides; pytest fixtures do the same for tests. Libraries such as dependency-injector exist, but most Python teams don’t need a container.</p>', lvl: 'core' },
    { q: 'What is the Python equivalent of a POJO or a Java record?', a: '<p><code>@dataclass</code> generates <code>__init__</code>, <code>__repr__</code> and <code>__eq__</code>; <code>frozen=True</code> makes it immutable and hashable (like a record); <code>slots=True</code> (3.10+) saves memory and blocks accidental new attributes; <code>order=True</code> adds comparisons. <code>typing.NamedTuple</code> gives an immutable tuple with names. At trust boundaries (JSON, HTTP, config) use Pydantic models, which validate at runtime. See <a href="dataclasses-pydantic.html">Dataclasses & Pydantic</a>.</p>', lvl: 'core' },
    { q: 'How do you overload methods in Python?', a: '<p>You don’t, in the Java sense: a later <code>def</code> with the same name replaces the earlier one. Use default and keyword-only arguments, <code>@classmethod</code> alternate constructors (<code>Temperature.from_fahrenheit</code>), <code>functools.singledispatch</code> or <code>singledispatchmethod</code> for type-based dispatch, and <code>typing.overload</code> only to describe several signatures to the type checker.</p>', lvl: 'core' },
    { q: 'What would you flag first when reviewing Python written by a Java team?', a: '<ul><li>Mutable class attributes and mutable default arguments.</li><li>Getters and setters, and <code>__private</code> names: use attributes and <code>@property</code>.</li><li>Index-based loops instead of iteration, <code>enumerate</code>, <code>zip</code> and comprehensions.</li><li>Threads for CPU work.</li><li>Broad <code>except Exception</code> that swallows errors, or <code>log.error(str(e))</code> without a traceback.</li><li>Deep package trees, one class per file, and circular imports.</li><li>No type checker or linter in CI; hints treated as runtime checks.</li><li><code>==</code> vs <code>is</code> misuse.</li></ul>', lvl: 'core' },
    { q: 'Where does Python’s dynamism genuinely help, and where does Java’s rigour win?', a: '<p>Python wins for glue code, data work, notebooks, AI agents and quick services: no ceremony, a REPL, first-class functions, and a huge ecosystem in ML and data. Java wins for large codebases with many teams, where compile-time types and refactoring tools catch more, and for CPU-heavy multithreaded services. Modern Python narrows the gap with type hints plus mypy or pyright in strict mode, Pydantic at the boundaries, and ruff. Many organisations run both: Java for core transactional services, Python for ML and agents, talking over HTTP or queues.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Java-style vs Pythonic', lang: 'python', code: `# Java-flavoured Python
class OrderServiceImpl(AbstractOrderService):
    def __init__(self, repositoryFactory):
        self.__repository = repositoryFactory.createRepository()

    def getTotalForCustomer(self, customerId):
        total = 0
        orders = self.__repository.findAll()
        for i in range(len(orders)):
            if orders[i].getCustomerId() == customerId:
                total = total + orders[i].getAmount()
        return total

# Pythonic
from dataclasses import dataclass
from typing import Protocol

@dataclass(frozen=True, slots=True)
class Order:
    customer_id: int
    amount_cents: int

class OrderRepository(Protocol):
    def all(self) -> list[Order]: ...

class OrderService:
    def __init__(self, repo: OrderRepository) -> None:
        self.repo = repo

    def total_for(self, customer_id: int) -> int:
        return sum(o.amount_cents for o in self.repo.all() if o.customer_id == customer_id)` },
    { title: 'Ports & adapters with Protocols', lang: 'python', code: `from typing import Protocol

class LlmClient(Protocol):
    async def complete(self, prompt: str, *, max_tokens: int = 512) -> str: ...

class AnthropicLlm:                                    # adapter: wraps the real SDK
    def __init__(self, sdk_client, model: str) -> None:
        self._c, self._model = sdk_client, model
    async def complete(self, prompt: str, *, max_tokens: int = 512) -> str:
        msg = await self._c.messages.create(model=self._model, max_tokens=max_tokens,
                                            messages=[{"role": "user", "content": prompt}])
        return msg.content[0].text

class FakeLlm:                                         # test double: no inheritance needed
    def __init__(self, reply: str) -> None:
        self.reply, self.prompts = reply, []
    async def complete(self, prompt: str, *, max_tokens: int = 512) -> str:
        self.prompts.append(prompt)
        return self.reply

async def summarize(ticket: str, llm: LlmClient) -> str:
    return await llm.complete(f"Summarise in one line:\\n{ticket}", max_tokens=60)

# test:
#   fake = FakeLlm("printer on fire")
#   assert await summarize("...", fake) == "printer on fire"`, note: 'Both classes satisfy <code>LlmClient</code> structurally. mypy/pyright verify it; the runtime never needs to know.' },
    { title: 'The same thing in Java', lang: 'java', code: `public interface LlmClient {                        // nominal: implementers must declare it
    CompletableFuture<String> complete(String prompt, int maxTokens);
}

public record Order(long customerId, long amountCents) {}

@Service
public class OrderService {
    private final OrderRepository repo;              // injected by the container
    public OrderService(OrderRepository repo) { this.repo = repo; }

    public long totalFor(long customerId) {
        return repo.findAll().stream()
            .filter(o -> o.customerId() == customerId)
            .mapToLong(Order::amountCents)
            .sum();
    }
}
// Python keeps the shape (constructor injection, small interface, immutable record)
// but drops the container, the "implements" and the getter calls.`, note: 'Constructor injection is idiomatic in both languages. In Python you just wire it yourself in the composition root.' }
  ]
});

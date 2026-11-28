IA.register({
  track: 'python',
  slug: 'typing',
  title: 'Type hints',
  tagline: 'Python type hints are <b>checked by tools, not by the interpreter</b>. mypy or pyright read them before the code runs; CPython just stores them. That split explains everything: why <code>add("x", "y")</code> runs fine, why Protocols are structural, and why data from outside still needs runtime validation. 3.12 added the cleanest syntax yet: <code>def first[T](xs: list[T]) -> T</code> and <code>type Alias = …</code>.',
  tldr: {
    problem: 'A Java developer reads <code>def f(x: int)</code> and assumes the call is checked. It isn’t. Without a type checker in CI, hints are documentation that can drift. With one, they catch <code>None</code> bugs and wrong arguments before deploy, but only for code the checker can see.',
    model: 'Two readers, one file. <b>Static</b>: mypy/pyright infer and check types across the program, then the information is thrown away. <b>Runtime</b>: CPython stores annotations in <code>__annotations__</code> and never checks them; libraries such as Pydantic, FastAPI and dataclasses read them deliberately. Generics behave like Java’s erasure: <code>list[int]</code> is just <code>list</code> at run time.',
    hook: '“Is <code>Optional[str]</code> an optional argument?” No: it means <code>str | None</code>, i.e. nullable. Whether a parameter is optional depends on it having a default.',
    facts: [
      { v: '3.12', l: 'PEP 695: <code>def f[T]()</code>, <code>class Box[T]</code> and the <code>type</code> statement. No more module-level <code>TypeVar("T")</code>' },
      { v: '3.13', l: 'added type-parameter defaults (PEP 696), <code>typing.TypeIs</code> (PEP 742) and <code>ReadOnly</code> for TypedDict items (PEP 705). 3.15 adds closed TypedDicts with <code>extra_items</code> (PEP 728) and <code>TypeForm</code> (PEP 747)' },
      { v: '0', l: 'runtime checks CPython performs on annotations. <code>isinstance(x, list[int])</code> even raises TypeError' }
    ]
  },
  intro: {
    what: 'A <b>type hint</b> is a note in your code saying what kind of value a variable, parameter or return should be: <code>name: str</code>, <code>def total(prices: list[float]) -> float</code>. Python itself ignores these notes when running. A separate tool, a <b>type checker</b> such as mypy or pyright (the engine in VS Code’s Pylance), reads them and warns you about mistakes before you run anything.',
    analogy: { icon: '📐', title: 'Building plans vs the building inspector', text: 'Type hints are labels on an architect’s plans: “this beam carries 2 tons”. The construction crew (CPython) builds whatever you hand it and never reads the labels. The inspector (the type checker) reviews the plans before construction and flags beams that can’t carry the load. Skip the inspection and the labels are just decoration.' },
    steps: [
      { t: 'Annotate signatures', d: 'Parameters and return values first; that is where hints pay off most.', code: 'def greet(name: str, times: int = 1) -> str:\n    return ("hi " + name + " ") * times' },
      { t: 'Containers say what they hold', d: 'Use built-in generics (3.9+) and <code>|</code> unions (3.10+).', code: 'scores: dict[str, list[int]] = {}\nmaybe: str | None = None' },
      { t: 'Run a checker', d: 'mypy or pyright reports problems without running the code.', code: '$ mypy app/\napp/users.py:12: error: Item "None" of "str | None"\n  has no attribute "lower"  [union-attr]', lang: 'bash' },
      { t: 'Python doesn’t enforce them', d: 'Wrong types still run until an operation fails. Validate external data at run time (Pydantic).' },
      { t: 'Describe shapes, not ancestry', d: '<code>Protocol</code> says “anything with a <code>close()</code> method”, without inheritance. <code>TypedDict</code> types the keys of a dict.' }
    ],
    terms: [
      ['type hint / annotation', 'The <code>: T</code> and <code>-> T</code> parts. Stored at run time, enforced by nothing.'],
      ['type checker', 'mypy, pyright, Pyre… Static analysis that reads hints and infers the rest.'],
      ['generic', 'A type with a parameter: <code>list[int]</code>, <code>def first[T](xs: list[T]) -> T</code>.'],
      ['Protocol', 'A structural interface: any class with the right members matches, no inheritance needed.'],
      ['TypedDict', 'A type for dicts with a fixed set of string keys, each with its own value type.'],
      ['narrowing', 'The checker refining a union inside an <code>if</code>: after <code>if x is None: return</code>, x is no longer None.']
    ]
  },
  visual: {
    title: 'Two readers, one file',
    caption: 'Pick a scenario and press <b>Play</b> or <b>Step</b>. The left lane is what a type checker reports by reading the file. The right lane is what CPython does when it runs each line. Red in the left lane is caught in CI; red only in the right lane is caught in production.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Annotations are data', code: `import inspect
from typing import get_type_hints

def charge(amount: float, currency: "str" = "EUR") -> bool:
    return True

print(charge.__annotations__)
print(get_type_hints(charge))            # resolves string annotations
print(inspect.signature(charge))
print(charge("lots", 3))                 # runs! nothing checks the hints` },
      { label: '3.12 generics', code: `def first[T](xs: list[T]) -> T:
    return xs[0]

class Box[T]:
    def __init__(self, item: T) -> None:
        self.item = item
    def map[U](self, f: "Callable[[T], U]") -> "Box[U]":
        return Box(f(self.item))

def biggest[N: (int, float)](a: N, b: N) -> N:   # constrained TypeVar
    return max(a, b)

type Pair[T] = tuple[T, T]                        # lazy type alias

print(first([3, 1]), first.__type_params__)
print(Box(2).map(str).item, Box.__type_params__)
print(type(Pair).__name__, Pair.__value__, Pair[int])
print(biggest(2, 5))`, note: 'The quoted annotations avoid importing <code>Callable</code>; at run time they are never evaluated.' },
      { label: 'Protocols', code: `from typing import Protocol, runtime_checkable

@runtime_checkable
class SupportsClose(Protocol):
    def close(self) -> None: ...

class Upload:                        # no inheritance
    def close(self) -> None:
        print("upload closed")

class Weird:
    close = 42                       # not even callable

def shutdown(resources: list[SupportsClose]) -> None:
    for r in resources:
        r.close()

shutdown([Upload()])
print(isinstance(Upload(), SupportsClose))
print(isinstance(Weird(), SupportsClose))   # True! only checks the name exists
print(isinstance(42, SupportsClose))` },
      { label: 'TypedDict', code: `from typing import TypedDict, NotRequired

class User(TypedDict):
    id: int
    name: str
    email: NotRequired[str]

u: User = {"id": 1, "name": "Asha"}
bad: User = {"id": "oops", "name": 2}     # a checker rejects this; Python doesn't care
print(type(u).__name__, u, bad)
print(User.__required_keys__, User.__optional_keys__)
try:
    isinstance(u, User)
except TypeError as e:
    print("TypeError:", e)` },
      { label: 'Why Pydantic exists', code: `from typing import get_type_hints

def validate(cls, data: dict):
    """A toy runtime checker for flat classes. Pydantic does this properly."""
    errors = []
    for name, typ in get_type_hints(cls).items():
        if name not in data:
            errors.append(f"{name}: missing")
        elif not isinstance(data[name], typ):
            errors.append(f"{name}: expected {typ.__name__}, got {type(data[name]).__name__}")
    return errors or "ok"

class Order:
    id: int
    qty: int
    sku: str

print(validate(Order, {"id": 1, "qty": 2, "sku": "A1"}))
print(validate(Order, {"id": 1, "qty": "2"}))
print("'2' * 3 =", "2" * 3, "<- what unvalidated JSON does to arithmetic")` },
      { label: 'Narrowing & Literal', code: `from typing import Literal, assert_never

Status = Literal["new", "paid", "refunded"]

def label(s: Status) -> str:
    match s:
        case "new":
            return "🆕"
        case "paid":
            return "✅"
        case "refunded":
            return "↩️"
        case _:
            assert_never(s)      # checker errors if a Literal value is unhandled

def norm(x: int | str | None) -> str:
    if x is None:
        return "none"
    if isinstance(x, int):
        return f"#{x}"
    return x.upper()             # checker knows x: str here

print(label("paid"), norm(None), norm(7), norm("ok"))` }
    ]
  },
  gotchas: [
    { trap: 'Assuming hints are checked at run time', code: `def transfer(amount: Decimal) -> None: ...
transfer(json_body["amount"])      # a str or float slips through`, why: 'CPython never checks annotations. Static checkers only see values they can trace; JSON, env vars, DB rows and <code>Any</code>-typed libraries are invisible to them.', fix: 'Validate at the boundary (Pydantic models, <code>TypeAdapter</code>), then pass well-typed objects inward. Run mypy or pyright in CI so the inside stays consistent.' },
    { trap: '<code>list[int]</code> is not a <code>list[float]</code>', code: `def mean(xs: list[float]) -> float: ...
ids: list[int] = [1, 2]
mean(ids)        # error: list is invariant`, why: 'A function taking <code>list[float]</code> could append a float to your list of ints. Mutable containers are <b>invariant</b>, like Java’s <code>List&lt;Integer&gt;</code> vs <code>List&lt;Number&gt;</code>.', fix: 'Accept the most general read-only type: <code>Sequence[float]</code>, <code>Iterable[float]</code>, <code>Mapping[str, float]</code>. They are covariant. Return concrete types.' },
    { trap: '<code>Any</code> switches checking off, silently', code: `import untyped_sdk                 # no stubs -> Any
resp = untyped_sdk.get_user(1)    # resp: Any
resp.emial.lower()                 # typo, no error`, why: '<code>Any</code> is compatible with everything in both directions, and spreads through every expression it touches.', fix: 'Turn on <code>strict</code> (mypy) or <code>"typeCheckingMode": "strict"</code> (pyright), install stub packages (<code>types-requests</code>…), and wrap untyped libraries in a small typed adapter.' },
    { trap: 'mypy skips unannotated functions by default', code: `def handler(event):              # no annotations
    return event["user"].lower()  # never checked`, why: 'mypy’s default <code>check_untyped_defs = false</code> treats bodies of unannotated functions as unchecked. pyright checks them, but infers parameters as unknown.', fix: 'Enable <code>check_untyped_defs</code> (included in <code>--strict</code>), or <code>disallow_untyped_defs</code> to require annotations everywhere.' },
    { trap: '<code>from __future__ import annotations</code> breaks runtime users', code: `from __future__ import annotations
@dataclass
class Cfg:
    url: "HttpUrl"     # all annotations become strings`, why: 'PEP 563 makes every annotation a string. Static checkers don’t care, but tools that read annotations at run time must resolve the names, which fails for names imported only under <code>if TYPE_CHECKING:</code> or defined in a local scope.', fix: 'Fine for most code. For Pydantic/FastAPI models keep runtime-needed names importable at module level. Since 3.14 annotations are lazily evaluated by default (PEP 649/749), which removes most of the reason for the future import. The future import still works there and still gives strings.' },
    { trap: '<code>Optional</code> means nullable, not optional', code: `def find(name: Optional[str]): ...   # still a required argument
def find(name: str | None = None): ...  # nullable AND optional`, why: '<code>Optional[X]</code> is exactly <code>X | None</code>. Whether a caller may omit the argument depends only on having a default.', fix: 'Prefer the <code>X | None</code> spelling (3.10+), and give a default when the argument is truly optional.' },
    { trap: '<code>isinstance</code> doesn’t work with most typing constructs', code: `isinstance(x, list[int])     # TypeError
isinstance(x, User)          # TypeError for a TypedDict
isinstance(x, MyProto)       # TypeError unless @runtime_checkable`, why: 'Generic parameters are erased at run time, and TypedDicts are plain dicts. There is nothing for <code>isinstance</code> to check.', fix: 'Check the runtime class (<code>isinstance(x, list)</code>) and validate contents explicitly, or use a validation library. Use <code>TypeIs</code> (3.13) or <code>TypeGuard</code> functions to teach the checker about your custom checks.' }
  ],
  scenarios: [
    { title: '<code>AttributeError: \'NoneType\' object has no attribute \'lower\'</code> in the signup flow',
      symptom: 'A small share of signups failed with a 500. The code had full type hints and mypy passed.',
      diagnose: `class User(Base):
    email: Mapped[str] = mapped_column(nullable=True)   # the lie

def normalise(u: User) -> str:
    return u.email.lower()          # mypy: fine, email is str

# DB: SELECT count(*) FROM users WHERE email IS NULL;  -> 312 (SSO users)`,
      cause: 'The annotation said <code>str</code> but the column was nullable: users created through SSO had no email. The checker trusted the annotation, so the <code>None</code> path was never flagged.',
      fix: 'Make the type tell the truth (<code>Mapped[str | None]</code>; SQLAlchemy 2.x then infers <code>nullable=True</code>), and let the checker force every caller to handle <code>None</code>.',
      fixCode: `class User(Base):
    email: Mapped[str | None]

def normalise(u: User) -> str | None:
    return u.email.lower() if u.email is not None else None` },
    { title: 'An order for 2 packs was billed as 2,222 units',
      symptom: 'A partner integration produced absurd line totals for a few orders. The code was fully typed with a TypedDict.',
      diagnose: `class OrderIn(TypedDict):
    sku: str
    qty: int

order = cast(OrderIn, json.loads(body))   # trusts the payload
units = order["qty"] * PACK_SIZE          # partner sent "2": "2" * 4 == "2222"
charge(int(units) * unit_price)           # billed for 2,222 units`,
      cause: '<code>cast</code> and TypedDict only inform the checker. The partner sent <code>"qty": "2"</code>, string repetition happily “worked”, and the later <code>int()</code> turned <code>"2222"</code> into a real number.',
      fix: 'Validate external data at the boundary, at run time. Pydantic v2’s <code>TypeAdapter</code> validates against the very same TypedDict.',
      fixCode: `from pydantic import TypeAdapter

ORDER = TypeAdapter(OrderIn)
order = ORDER.validate_json(body)      # "2" -> 2 in lax mode; "two" -> ValidationError
# strict: ORDER.validate_json(body, strict=True) rejects "2" outright` },
    { title: 'mypy was green for a year, but half the codebase was never checked',
      symptom: 'A refactor renamed a dict key. Tests and mypy passed. Production broke in a dozen handlers.',
      diagnose: `$ mypy --check-untyped-defs app/ | tail -1
Found 214 errors in 61 files (checked 180 source files)`,
      cause: 'The handlers had no annotations, and mypy (by default) doesn’t check the bodies of unannotated functions. The “green” CI covered only the typed core.',
      fix: 'Turn on strictness gradually: enable <code>check_untyped_defs</code> globally, then <code>strict</code> per package as each is cleaned up. Track the error count as a ratchet in CI.',
      fixCode: `# pyproject.toml
[tool.mypy]
python_version = "3.12"
check_untyped_defs = true
warn_return_any = true

[[tool.mypy.overrides]]
module = ["app.billing.*"]
strict = true`, fixLang: 'text' }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `def double(x: int) -> int:
    return x * 2

print(double("ab"))`, options: ['TypeError', 'abab', '0', 'ab2'], answer: 1, run: true, expect: 'abab', explain: 'CPython ignores annotations when calling. <code>"ab" * 2</code> is string repetition. A type checker would flag the call; the interpreter doesn’t.' },
    { kind: 'predict', q: 'On 3.12, what does this print?', code: `def f(a: int, b: "str" = "x") -> None:
    pass

print(f.__annotations__)`, options: ["{'a': &lt;class 'int'&gt;, 'b': &lt;class 'str'&gt;, 'return': None}", "{'a': &lt;class 'int'&gt;, 'b': 'str', 'return': None}", "{'a': 'int', 'b': 'str', 'return': 'None'}", "{'a': &lt;class 'int'&gt;, 'b': 'str'}"], answer: 1, run: true, expect: "{'a': <class 'int'>, 'b': 'str', 'return': None}", explain: 'Up to 3.13, annotations are evaluated when the <code>def</code> runs and stored as-is. (Since 3.14 they are evaluated on first access, PEP 649/749; the output here is the same.) A string annotation stays a string (resolve it with <code>typing.get_type_hints</code>). <code>-> None</code> stores <code>None</code> itself. With <code>from __future__ import annotations</code> every value would be a string.' },
    { kind: 'predict', q: 'What does this print? (3.12+)', code: `def first[T](xs: list[T]) -> T:
    return xs[0]

print(first.__type_params__, type(first.__type_params__[0]).__name__)`, options: ['(T,) TypeVar', '(~T,) TypeVar', "('T',) str", '() NoneType'], answer: 0, run: true, expect: '(T,) TypeVar', explain: 'PEP 695 syntax creates a real <code>TypeVar</code> object, scoped to the function, and records it in <code>__type_params__</code>. Its variance is <i>inferred</i> by type checkers, so its repr is a bare <code>T</code>. The <code>~T</code> / <code>+T</code> / <code>-T</code> prefixes appear only on old-style <code>TypeVar(\'T\')</code> objects with declared (in-, co-, contra-) variance.' },
    { kind: 'predict', q: 'Does the self-reference work? What does this print? (3.12+)', code: `type Tree = dict[str, Tree] | None

print(type(Tree).__name__, Tree.__name__)`, options: ['NameError', 'TypeAliasType Tree', 'UnionType Tree', 'type Tree'], answer: 1, run: true, expect: 'TypeAliasType Tree', explain: 'The <code>type</code> statement creates a <code>typing.TypeAliasType</code> whose value is evaluated <b>lazily</b> (on first access of <code>__value__</code>), so recursive and forward references need no quotes.' },
    { kind: 'predict', q: 'What does this print?', code: `try:
    print(isinstance([1], list[int]))
except TypeError:
    print("TypeError")`, options: ['True', 'False', 'TypeError', 'None'], answer: 2, run: true, expect: 'TypeError', explain: 'Type arguments are erased at run time, so CPython refuses to pretend it can check them: “isinstance() argument 2 cannot be a parameterized generic”. Check <code>isinstance(x, list)</code> and validate items yourself.' },
    { kind: 'predict', q: 'What does this print?', code: `from typing import Protocol, runtime_checkable

@runtime_checkable
class Closer(Protocol):
    def close(self) -> None: ...

class Door:
    close = 42

print(isinstance(Door(), Closer))`, options: ['True', 'False', 'TypeError', 'AttributeError'], answer: 0, run: true, expect: 'True', explain: 'A runtime-checkable protocol only checks that each member <b>exists</b>. It doesn’t check that <code>close</code> is callable, let alone its signature. A static checker would reject <code>Door</code> as a <code>Closer</code>.' },
    { kind: 'predict', q: 'What does this print?', code: `from typing import TypedDict

class Point(TypedDict):
    x: int
    y: int

p = Point(x=1, y="two")
print(type(p).__name__, p)`, options: ["Point {'x': 1, 'y': 'two'}", "dict {'x': 1, 'y': 'two'}", 'TypeError', "Point(x=1, y='two')"], answer: 1, run: true, expect: "dict {'x': 1, 'y': 'two'}", explain: 'Calling a TypedDict class just builds a plain <code>dict</code>. No validation happens, so the string sneaks in. Only a static checker (or Pydantic) would complain.' },
    { kind: 'pick', q: 'With mypy defaults, which call is a type error?', code: `def mean(xs: list[float]) -> float: ...
def total(xs: Sequence[float]) -> float: ...
ints: list[int] = [1, 2, 3]`, options: ['<code>mean([1.0, 2.0])</code>', '<code>mean(ints)</code>', '<code>total(ints)</code>', '<code>total((1, 2.5))</code>'], answer: 1, explain: '<code>list</code> is <b>invariant</b>: <code>mean</code> could append a float to your <code>list[int]</code>, so <code>list[int]</code> is not a <code>list[float]</code>. <code>Sequence</code> is read-only and covariant, so <code>total(ints)</code> is fine. (<code>int</code> is accepted where <code>float</code> is expected, by a special rule in the typing spec.)' }
  ],
  interview: [
    { q: 'Does Python enforce type hints?', a: '<p>No. CPython evaluates and stores annotations (in <code>__annotations__</code>) and otherwise ignores them. Enforcement comes from static checkers (mypy, pyright) in your editor and CI, or from libraries that read annotations at run time on purpose (Pydantic, FastAPI, dataclasses use them for fields, attrs, typeguard/beartype for checks).</p>', lvl: 'core' },
    { q: 'What changed with the 3.12 type-parameter syntax?', a: '<p>PEP 695 lets you declare type parameters inline: <code>def first[T](xs: list[T]) -> T</code>, <code>class Box[T]:</code>, with bounds <code>[T: Hashable]</code>, constraints <code>[T: (int, str)]</code>, <code>*Ts</code> and <code>**P</code>. Variance is inferred instead of declared. The <code>type X = …</code> statement creates a lazily evaluated <code>TypeAliasType</code>. 3.13 adds defaults: <code>class Box[T = int]</code>.</p>', fu: 'Why is lazy evaluation useful for aliases? (Recursive and forward references without quotes.)', lvl: 'core' },
    { q: 'Protocol vs ABC?', a: '<p>An <b>ABC</b> is nominal: a class must inherit from it (or be registered), and you get runtime <code>isinstance</code> and mixin methods. A <b>Protocol</b> is structural: any class with matching members satisfies it, checked statically; <code>@runtime_checkable</code> adds a shallow <code>isinstance</code>. Use Protocols to type “anything that has <code>.read()</code>” and third-party classes; use ABCs when you want enforcement of abstract methods at instantiation or shared implementation.</p>', lvl: 'core' },
    { q: 'When do you use TypedDict vs dataclass vs Pydantic model?', a: '<p><b>TypedDict</b>: the data <i>is</i> a dict and should stay one (JSON blobs, <code>**kwargs</code>, legacy APIs); zero runtime cost, zero validation. <b>dataclass</b>: your own internal objects with attributes and methods; no validation. <b>Pydantic</b>: data crossing a trust boundary that needs parsing and validation. A common pattern is Pydantic at the edges, dataclasses inside.</p>', lvl: 'core' },
    { q: 'Explain variance with an example.', a: '<p>If <code>Cat</code> is a subtype of <code>Animal</code>: a <b>covariant</b> container of Cats is a container of Animals (<code>Sequence[Cat]</code> → <code>Sequence[Animal]</code>; read-only is safe). <b>Invariant</b>: <code>list[Cat]</code> is not a <code>list[Animal]</code>, because you could append a Dog. <b>Contravariant</b>: a <code>Callable[[Animal], None]</code> can be used where <code>Callable[[Cat], None]</code> is expected. Same idea as Java’s <code>? extends</code> / <code>? super</code>, expressed per type rather than per use-site.</p>', lvl: 'deep' },
    { q: 'What is type narrowing, and what are TypeGuard and TypeIs?', a: '<p>Checkers refine a variable’s type after checks such as <code>is None</code>, <code>isinstance</code>, comparisons with literals, <code>match</code> patterns and truthiness. To narrow with your own function, return <code>TypeGuard[X]</code> (3.10; narrows only the true branch) or <code>TypeIs[X]</code> (3.13; narrows both branches, and the narrowed type must be consistent with the input). <code>assert_never</code> enforces exhaustiveness.</p>', lvl: 'deep' },
    { q: 'mypy vs pyright: what differs in practice?', a: '<p>Both implement the typing spec. pyright is faster and powers Pylance in VS Code; it checks unannotated function bodies by default and has more aggressive inference. mypy has a plugin system (used by Django, SQLAlchemy 1.x, Pydantic’s plugin) and, by default, doesn’t check bodies of unannotated functions. They occasionally disagree on inference corner cases, so pick one as the CI gate.</p>', lvl: 'core' },
    { q: 'What do <code>from __future__ import annotations</code> and <code>TYPE_CHECKING</code> do?', a: '<p>The future import (PEP 563) stores every annotation as a string, which avoids evaluating forward references and speeds imports. <code>if TYPE_CHECKING:</code> imports modules only for the checker, which breaks import cycles. Together they let you annotate with types you never import at run time. The catch: code that reads annotations at run time can’t resolve those names. Lazy annotations (PEP 649/749) are the replacement, and they are the default since 3.14: annotations are evaluated only when something reads them, and <code>annotationlib.get_annotations(obj, format=Format.FORWARDREF)</code> tolerates names that don’t exist at run time.</p>', lvl: 'deep' },
    { q: 'How are Python generics like Java generics?', a: '<p>Both are erased: <code>list[int]</code> and <code>List&lt;Integer&gt;</code> are just <code>list</code>/<code>List</code> at run time. Differences: Python’s checker is optional and external; variance is declared on the type (or inferred, 3.12+) rather than with wildcards at each use; Protocols give structural interfaces Java lacks; and Python generic aliases can be subscripted at run time (<code>list[int]</code> is a real <code>types.GenericAlias</code> object) for libraries to inspect.</p>', lvl: 'core' },
    { q: 'How do you type a function that returns the same type it receives, including subclasses?', a: '<p>A type variable: <code>def clone[T](x: T) -> T</code>. For methods returning their own class, use <code>typing.Self</code> (3.11): <code>def with_name(self, n: str) -> Self</code>, so subclasses get the subclass type back. For overloaded behaviour by argument type, use <code>@overload</code>.</p>', lvl: 'core' },
    { q: 'How would you introduce typing to a large untyped codebase?', a: '<ol><li>Add a checker to CI with a lenient config and a baseline.</li><li>Annotate boundaries first: public functions, models, API handlers.</li><li>Install stubs for dependencies.</li><li>Ratchet: enable <code>check_untyped_defs</code>, then <code>strict</code> per package via overrides.</li><li>Use <code>reveal_type()</code> while learning, and ban new <code>Any</code> with <code>disallow_any_explicit</code> where it matters.</li></ol>', lvl: 'core' }
  ],
  code: [
    { title: 'Generic repository Protocol (3.12)', lang: 'python', code: `from collections.abc import Iterable
from dataclasses import dataclass
from typing import Protocol

class HasId(Protocol):
    @property
    def id(self) -> int: ...

class Repository[T: HasId](Protocol):
    def get(self, id: int) -> T | None: ...
    def add(self, item: T) -> None: ...
    def list(self, ids: Iterable[int]) -> list[T]: ...

@dataclass(frozen=True, slots=True)
class Customer:
    id: int
    name: str

class InMemoryRepo[T: HasId]:              # satisfies Repository[T] structurally
    def __init__(self) -> None:
        self._items: dict[int, T] = {}
    def get(self, id: int) -> T | None:
        return self._items.get(id)
    def add(self, item: T) -> None:
        self._items[item.id] = item
    def list(self, ids: Iterable[int]) -> list[T]:
        return [self._items[i] for i in ids if i in self._items]

def rename(repo: Repository[Customer], id: int, name: str) -> None:
    if (c := repo.get(id)) is None:        # narrowing: c is Customer below
        raise KeyError(id)
    repo.add(Customer(c.id, name))

rename(InMemoryRepo[Customer](), 1, "Asha")   # type-checks; no inheritance needed`, note: 'The test double needs no base class. Any class with the right methods (a SQLAlchemy repo, an HTTP client) is a <code>Repository[Customer]</code>.' },
    { title: 'Checker configuration', lang: 'text', code: `# pyproject.toml

[tool.mypy]
python_version = "3.12"
strict = true                 # implies check_untyped_defs, disallow_untyped_defs, ...
warn_unreachable = true
plugins = ["pydantic.mypy"]

[[tool.mypy.overrides]]
module = ["legacy.*"]
strict = false
check_untyped_defs = true

[tool.pyright]
pythonVersion = "3.12"
typeCheckingMode = "strict"
exclude = ["legacy"]`, note: 'Pick one checker as the CI gate. Running both is fine for editors, but their verdicts can differ.' },
    { title: 'Java comparison', lang: 'java', code: `// Nominal interface: Upload must say "implements"
interface Closeable { void close(); }
final class Upload implements Closeable { public void close() {} }

// Generic method, erased at run time (like Python)
static <T> T first(List<T> xs) { return xs.get(0); }

// Use-site variance with wildcards
double mean(List<? extends Number> xs) { ... }   // Python: Sequence[float]

// Python equivalents:
// class Closeable(Protocol): def close(self) -> None: ...   (structural, no implements)
// def first[T](xs: list[T]) -> T: ...
// Key difference: javac REFUSES to compile a type error; CPython runs it anyway.` }
  ]
});

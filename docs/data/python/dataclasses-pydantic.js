IA.register({
  track: 'python',
  slug: 'dataclasses-pydantic',
  title: 'Dataclasses & Pydantic',
  tagline: '<code>@dataclass</code> <b>writes boilerplate</b> (<code>__init__</code>, <code>__repr__</code>, <code>__eq__</code>, optionally hashing, ordering, immutability and slots) and checks nothing. <b>Pydantic v2</b> parses and validates untrusted data against your type hints, in Rust, and tells you every field that is wrong. Use Pydantic at the edges, dataclasses inside.',
  tldr: {
    problem: 'Teams either hand-write <code>__init__</code>/<code>__eq__</code> everywhere, or reach for Pydantic for every internal object and pay for validation on hot paths. Others trust a dataclass to “check types” and let bad JSON straight into the domain.',
    model: 'A dataclass is a <b>code generator</b> run once at class creation, driven by the class annotations. Pydantic compiles a <b>validator</b> from the annotations, then on every <code>model_validate</code> it coerces (lax mode) or checks (strict mode), runs your validators, collects all errors and builds the instance.',
    hook: '“Does <code>@dataclass</code> check types?” No. <code>Point(x="oops")</code> works. Only Pydantic (or attrs validators, or your own <code>__post_init__</code>) validates at run time.',
    facts: [
      { v: '3.10', l: 'added <code>slots=True</code>, <code>kw_only=True</code> and <code>KW_ONLY</code> to dataclasses. 3.13 added <code>copy.replace()</code> support' },
      { v: 'v2', l: 'Pydantic 2 (2023) moved validation into <code>pydantic-core</code>, written in Rust, and renamed the API: <code>model_validate</code>, <code>model_dump</code>, <code>field_validator</code>, <code>ConfigDict</code>' },
      { v: 'eq ⇒ no hash', l: 'a plain <code>@dataclass</code> (eq=True, frozen=False) sets <code>__hash__ = None</code>. <code>frozen=True</code> makes it hashable' }
    ]
  },
  intro: {
    what: 'Most classes in an application just hold data: an order, a config, an API payload. Writing <code>__init__</code>, a readable <code>__repr__</code> and <code>__eq__</code> by hand for each is tedious and error-prone. A <b>dataclass</b> generates them from a list of annotated fields. <b>Pydantic</b> goes further: it checks and converts incoming data (from JSON, environment variables, forms) to match those field types, and raises a clear error when it can’t.',
    analogy: { icon: '📋', title: 'A form template vs a form checker', text: 'A dataclass is a printed form template: it has the right boxes in the right order, so filling one in is quick. But nobody stops you writing “banana” in the date box. Pydantic is the clerk at the counter who reads every box, fixes what is obviously fixable (“42” → 42), and hands back a list of everything wrong before accepting the form.' },
    steps: [
      { t: 'Declare fields with annotations', d: 'The decorator reads them and writes the methods.', code: 'from dataclasses import dataclass\n\n@dataclass\nclass Point:\n    x: float\n    y: float = 0.0\n\nPoint(1.5)          # Point(x=1.5, y=0.0)\nPoint(1, 2) == Point(1, 2)   # True' },
      { t: 'Mutable defaults need a factory', d: '<code>field(default_factory=list)</code> gives each instance its own list.', code: 'from dataclasses import field\n\n@dataclass\nclass Cart:\n    items: list[str] = field(default_factory=list)' },
      { t: 'frozen and slots', d: '<code>frozen=True</code> forbids assignment (and enables hashing). <code>slots=True</code> makes instances smaller.' },
      { t: 'Pydantic validates', d: 'Same declaration style, but data is checked and converted.', code: 'from pydantic import BaseModel\n\nclass Point(BaseModel):\n    x: float\n    y: float = 0.0\n\nPoint.model_validate({"x": "1.5"})   # Point(x=1.5, y=0.0)\nPoint.model_validate({"x": "abc"})   # ValidationError' },
      { t: 'Choose by trust', d: 'Data from outside your process (HTTP, queues, files, env) → Pydantic. Objects your own code creates → dataclass.' }
    ],
    terms: [
      ['dataclass', 'A class decorated with <code>@dataclass</code>, which generates methods from its annotated fields.'],
      ['field()', 'Per-field options: <code>default_factory</code>, <code>repr</code>, <code>compare</code>, <code>kw_only</code>, <code>init</code>.'],
      ['frozen', 'Instances can’t be modified after <code>__init__</code>. Required (with eq) for automatic hashing.'],
      ['BaseModel', 'Pydantic’s base class. Subclasses validate on construction.'],
      ['lax vs strict', 'Lax (default) coerces compatible input (<code>"42"</code> → 42); strict accepts only the exact type.'],
      ['ValidationError', 'Pydantic’s exception listing every failing field, its location, error type and input.']
    ]
  },
  visual: {
    title: 'Generated code, validated data',
    caption: 'Two modes. <b>What @dataclass generates</b> reveals the methods the decorator writes for one class, option by option. <b>Pydantic v2 validation</b> pushes an untrusted payload through a model, field by field: amber steps changed the value, red ones failed. Press <b>Play</b> or <b>Step</b>.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Basics', code: `from dataclasses import dataclass, field, fields, asdict, astuple

@dataclass
class Order:
    id: int
    customer: str
    lines: list[str] = field(default_factory=list)
    note: str = field(default="", repr=False)

a = Order(1, "asha", ["sku-1"])
b = Order(1, "asha", ["sku-1"])
print(a)
print(a == b, a is b)
print([f.name for f in fields(Order)])
print(asdict(a))
print(astuple(a))
print("hashable?", Order.__hash__ is not None)` },
      { label: 'Defaults & __post_init__', code: `from dataclasses import dataclass, field, InitVar

try:
    @dataclass
    class Bad:
        tags: list[str] = []
except ValueError as e:
    print("ValueError:", e)

@dataclass
class Account:
    owner: str
    balance_cents: int = 0
    history: list[int] = field(default_factory=list)
    opening_bonus: InitVar[int] = 0          # init-only, not stored

    def __post_init__(self, opening_bonus: int) -> None:
        if not self.owner:
            raise ValueError("owner required")
        self.balance_cents += opening_bonus

x, y = Account("a"), Account("b", opening_bonus=500)
x.history.append(1)
print(x, y, sep="\\n")` , note: 'Each instance gets its own <code>history</code> list. <code>InitVar</code> fields go to <code>__post_init__</code> only.' },
      { label: 'frozen & slots', code: `import sys
from dataclasses import dataclass, replace, FrozenInstanceError

@dataclass(frozen=True, slots=True)
class Money:
    amount: int
    currency: str = "EUR"

m = Money(5)
try:
    m.amount = 6
except FrozenInstanceError as e:
    print("FrozenInstanceError:", e)

print(replace(m, amount=6), m)            # modified copy; original untouched
print({m: "price"}[Money(5)])            # frozen + eq -> hashable, usable as a key
print("has __dict__:", hasattr(m, "__dict__"), "| slots:", Money.__slots__)

@dataclass
class Loose:
    amount: int
    currency: str = "EUR"
print("plain instance + dict bytes:", sys.getsizeof(Loose(5)) + sys.getsizeof(Loose(5).__dict__))
print("slotted instance bytes:     ", sys.getsizeof(m))` },
      { label: 'order & kw_only', code: `from dataclasses import dataclass, KW_ONLY

@dataclass(order=True)
class Version:
    major: int
    minor: int
    patch: int = 0

print(sorted([Version(3, 12, 1), Version(3, 9), Version(3, 12)]))
print(Version(3, 13) > Version(3, 12, 9))

@dataclass
class Base:
    id: int
    created_by: str = "system"

@dataclass
class Invoice(Base):
    _: KW_ONLY               # everything after this is keyword-only (3.10+)
    total: int               # no default, allowed because it is keyword-only

print(Invoice(1, total=99))` },
      { label: 'No validation', code: `from dataclasses import dataclass
import json

@dataclass
class Payment:
    amount: int
    capture: bool

raw = json.loads('{"amount": "100", "capture": "false"}')
p = Payment(**raw)                  # dataclasses never check types
print(p)
print("amount * 2 =", p.amount * 2) # '100100'
print("capture is truthy:", bool(p.capture))   # 'false' is a non-empty string

def parse_bool(s: str) -> bool:
    if s.lower() in {"true", "1", "yes"}: return True
    if s.lower() in {"false", "0", "no"}: return False
    raise ValueError(s)
print(Payment(int(raw["amount"]), parse_bool(raw["capture"])))`, note: 'This hand-written parsing is exactly what Pydantic does for you, for every field and nested type.' },
      { label: 'dataclass vs NamedTuple vs TypedDict', code: `from dataclasses import dataclass
from typing import NamedTuple, TypedDict

@dataclass(frozen=True, slots=True)
class PD:
    x: int
    y: int

class PN(NamedTuple):
    x: int
    y: int

class PT(TypedDict):
    x: int
    y: int

d, n, t = PD(1, 2), PN(1, 2), PT(x=1, y=2)
print(d, n, t)
print("tuple-like:", isinstance(n, tuple), n[0], tuple(n))
print("NamedTuple == plain tuple:", n == (1, 2), "| dataclass == tuple:", d == (1, 2))
print("TypedDict is just:", type(t).__name__)` }
    ]
  },
  gotchas: [
    { trap: 'Mutable defaults, and the ones the check misses', code: `@dataclass
class Cart:
    items: list = []          # ValueError at class creation: good

class Registry: ...           # ordinary class: hashable by identity
@dataclass
class Service:
    registry: Registry = Registry()   # accepted, and shared by every instance`, why: 'The dataclass check rejects unhashable defaults (list, dict, set, and since 3.11 any object with <code>__hash__ = None</code>). An ordinary mutable object is hashable by identity, so it slips through and becomes shared state.', fix: 'Use <code>field(default_factory=...)</code> for any mutable default: <code>field(default_factory=Registry)</code>.' },
    { trap: '<code>frozen=True</code> is shallow', code: `@dataclass(frozen=True)
class Order:
    lines: list[str]

o = Order(["a"])
o.lines.append("b")        # allowed: the list itself is mutable`, why: 'Frozen only blocks rebinding the instance’s attributes. The objects they point to keep their own mutability, and a frozen dataclass holding a list is not hashable.', fix: 'Use immutable field types (<code>tuple[str, ...]</code>, <code>frozenset</code>, nested frozen dataclasses) for value objects.' },
    { trap: 'A plain dataclass is unhashable', code: `@dataclass
class Tag:
    name: str

{Tag("x")}     # TypeError: unhashable type: 'Tag'`, why: '<code>eq=True</code> (the default) generates <code>__eq__</code>; without <code>frozen</code>, the hash would be based on mutable fields, so the decorator sets <code>__hash__ = None</code>.', fix: 'Use <code>frozen=True</code> for value objects. Avoid <code>unsafe_hash=True</code> unless the fields really never change after insertion into a set or dict.' },
    { trap: 'Expecting a dataclass to validate', code: `@dataclass
class Port:
    number: int

Port("8080")      # fine, number is a str`, why: 'Annotations only drive code generation. No type check or coercion happens at run time.', fix: 'Validate in <code>__post_init__</code> for simple invariants, or use Pydantic (<code>pydantic.dataclasses.dataclass</code> also exists) when parsing outside data.' },
    { trap: 'Field order with inheritance', code: `@dataclass
class Base:
    id: int
    created_by: str = "system"

@dataclass
class Invoice(Base):
    total: int       # TypeError: non-default argument 'total' follows default argument`, why: 'Inherited fields come first in <code>__init__</code>, so a required child field would follow a defaulted base field.', fix: 'Make fields keyword-only: <code>@dataclass(kw_only=True)</code>, <code>field(kw_only=True)</code>, or a <code>_: KW_ONLY</code> marker (all 3.10+).' },
    { trap: 'Pydantic v1 code on v2', code: `user.dict()                  # deprecated: model_dump()
User.parse_obj(data)         # deprecated: model_validate()
class Config: orm_mode = True   # v2: model_config = ConfigDict(from_attributes=True)
@validator("email")          # v2: @field_validator("email")`, why: 'v2 renamed most of the API. The v1 names mostly still work with deprecation warnings, but some config keys were renamed outright, so <code>orm_mode</code> no longer does what it used to.', fix: 'Run <code>bump-pydantic</code>, turn deprecation warnings into errors in tests, and grep for <code>class Config</code>.' },
    { trap: 'Lax coercion surprises', code: `class Flags(BaseModel):
    beta: bool
    limit: int

Flags.model_validate({"beta": "yes", "limit": "10"})   # beta=True, limit=10`, why: 'Lax mode accepts common string forms of numbers and booleans, which is great for query strings and env vars, and surprising for a JSON API where <code>"10"</code> means a client bug.', fix: 'Use strict where it matters: <code>model_config = ConfigDict(strict=True)</code>, <code>Field(strict=True)</code>, or <code>StrictInt</code>/<code>StrictBool</code>.' }
  ],
  scenarios: [
    { title: 'After the Pydantic v2 upgrade, every user endpoint returned 500',
      symptom: 'Right after bumping Pydantic from 1.10 to 2.x, endpoints serialising ORM objects failed with <code>ValidationError: Input should be a valid dictionary or instance of UserOut</code>.',
      diagnose: `class UserOut(BaseModel):
    id: int
    email: str
    class Config:
        orm_mode = True          # v1 key

UserOut.from_orm(db_user)        # deprecated alias, and orm_mode isn't honoured`,
      cause: 'v2 renamed <code>orm_mode</code> to <code>from_attributes</code>. The old setting was ignored, so the model refused to read attributes from a SQLAlchemy object.',
      fix: 'Migrate config to <code>ConfigDict</code>, replace <code>from_orm</code> with <code>model_validate</code>, and run the test suite with <code>-W error::DeprecationWarning</code> to catch the rest.',
      fixCode: `from pydantic import BaseModel, ConfigDict

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str

UserOut.model_validate(db_user)` },
    { title: 'A feature flag set to "false" switched the feature on',
      symptom: 'Ops set <code>EXPORT_V2=false</code> to disable a feature during an incident. The feature stayed enabled.',
      diagnose: `@dataclass
class Settings:
    export_v2: bool

settings = Settings(export_v2=os.environ.get("EXPORT_V2", ""))
print(bool(settings.export_v2))      # True: "false" is a non-empty string`,
      cause: 'The dataclass accepted the raw string. Any non-empty string is truthy, so <code>"false"</code> enabled the feature. Nothing validated the type.',
      fix: 'Parse settings with a validating model. <code>pydantic-settings</code> reads env vars and parses <code>"false"</code>, <code>"0"</code>, <code>"no"</code> and <code>"off"</code> as False.',
      fixCode: `from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    export_v2: bool = False

settings = Settings()       # EXPORT_V2=false -> False; EXPORT_V2=maybe -> ValidationError` },
    { title: 'A batch scoring job spent 60% of its CPU in validation',
      symptom: 'Profiling a nightly job (py-spy) showed most time inside <code>pydantic_core</code>, creating models for internal intermediate results.',
      diagnose: `for row in rows:                        # 20M rows from our own DB
    feat = Features(**row)              # BaseModel: full validation each time
    score = model.predict(feat.vector())
    out.append(Result(id=row["id"], score=score))   # validated again`,
      cause: 'Every internal object was a Pydantic model, so data the program itself produced was re-validated millions of times. v2 is much faster than v1, but validation still isn’t free.',
      fix: 'Validate once at the edge, then use plain dataclasses (with <code>slots=True</code>) for internal data. For data you already trust, <code>model_construct()</code> skips validation entirely.',
      fixCode: `@dataclass(slots=True)
class Result:
    id: int
    score: float

results = [Result(r["id"], model.predict(vectorise(r))) for r in rows]
# API boundary only:
payload = ResultsOut.model_validate({"results": results}, from_attributes=True)` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `from dataclasses import dataclass

try:
    @dataclass
    class Cart:
        items: list = []
    print("defined")
except ValueError:
    print("ValueError")`, options: ['defined', 'ValueError', 'TypeError', 'Nothing'], answer: 1, run: true, expect: 'ValueError', explain: 'The decorator refuses unhashable defaults such as <code>[]</code> at class-creation time (“mutable default … is not allowed: use default_factory”), which prevents the classic shared-default bug.' },
    { kind: 'predict', q: 'What does this print?', code: `from dataclasses import dataclass

@dataclass
class P:
    x: int

print(P(1) == P(1), P.__hash__ is None)`, options: ['True False', 'True True', 'False True', 'False False'], answer: 1, run: true, expect: 'True True', explain: 'The generated <code>__eq__</code> compares fields, so the two are equal. Because <code>eq=True</code> and <code>frozen=False</code>, the decorator sets <code>__hash__ = None</code>: instances can’t go in sets or be dict keys.' },
    { kind: 'predict', q: 'What does this print?', code: `from dataclasses import dataclass, field

@dataclass(frozen=True)
class Order:
    id: int
    lines: list[str] = field(default_factory=list)

o = Order(1)
o.lines.append("x")
print(o)
try:
    o.id = 2
except AttributeError as e:
    print(type(e).__name__)`, options: ["Order(id=1, lines=[])<br>FrozenInstanceError", "Order(id=1, lines=['x'])<br>FrozenInstanceError", "AttributeError on append", "Order(id=1, lines=['x'])<br>AttributeError"], answer: 1, run: true, expect: "Order(id=1, lines=['x'])\nFrozenInstanceError", explain: 'Frozen is shallow: mutating the list is allowed. Rebinding a field raises <code>FrozenInstanceError</code>, a subclass of <code>AttributeError</code>, which is why the <code>except</code> catches it.' },
    { kind: 'predict', q: 'What does this print?', code: `from dataclasses import dataclass

try:
    @dataclass
    class A:
        x: int = 0
        y: int
    print("ok")
except TypeError:
    print("TypeError")`, options: ['ok', 'TypeError', 'ValueError', 'SyntaxError'], answer: 1, run: true, expect: 'TypeError', explain: 'The generated <code>__init__(self, x=0, y)</code> would be invalid Python: a parameter without a default can’t follow one with a default. Reorder, or make fields keyword-only (<code>kw_only=True</code>, 3.10+).' },
    { kind: 'predict', q: 'What does this print?', code: `from dataclasses import dataclass

@dataclass(order=True)
class V:
    major: int
    minor: int

print(sorted([V(1, 10), V(1, 2), V(0, 99)]))`, options: ['[V(major=0, minor=99), V(major=1, minor=2), V(major=1, minor=10)]', '[V(major=0, minor=99), V(major=1, minor=10), V(major=1, minor=2)]', '[V(major=1, minor=2), V(major=1, minor=10), V(major=0, minor=99)]', 'TypeError'], answer: 0, run: true, expect: '[V(major=0, minor=99), V(major=1, minor=2), V(major=1, minor=10)]', explain: '<code>order=True</code> compares instances as tuples of their fields in declaration order: <code>(0, 99) &lt; (1, 2) &lt; (1, 10)</code>. Integers compare numerically, so 2 comes before 10.' },
    { kind: 'predict', q: 'What does this print?', code: `from dataclasses import dataclass, fields
from typing import ClassVar

@dataclass
class C:
    a: int
    b = 2
    c: ClassVar[int] = 3

print([f.name for f in fields(C)], C(1))`, options: ["['a', 'b', 'c'] C(a=1, b=2, c=3)", "['a', 'c'] C(a=1, c=3)", "['a'] C(a=1)", "['a', 'b'] C(a=1, b=2)"], answer: 2, run: true, expect: "['a'] C(a=1)", explain: 'Only annotated names become fields. <code>b</code> has no annotation, so it is an ordinary class attribute. <code>ClassVar</code> is explicitly excluded.' },
    { kind: 'predict', q: 'What does this print?', code: `from dataclasses import dataclass, replace

@dataclass(frozen=True)
class Temp:
    celsius: float
    def __post_init__(self):
        if self.celsius < -273.15:
            raise ValueError("below absolute zero")

t = Temp(20)
t2 = replace(t, celsius=25)
print(t, t2)
try:
    replace(t, celsius=-300)
except ValueError as e:
    print(e)`, options: ['Temp(celsius=20) Temp(celsius=25)<br>below absolute zero', 'Temp(celsius=25) Temp(celsius=25)<br>below absolute zero', 'Temp(celsius=20) Temp(celsius=25)<br>Temp(celsius=-300)', 'FrozenInstanceError'], answer: 0, run: true, expect: 'Temp(celsius=20) Temp(celsius=25)\nbelow absolute zero', explain: '<code>replace</code> builds a <b>new</b> instance through <code>__init__</code>, so <code>__post_init__</code> validation runs again, and the original is untouched. The annotation says float, but nothing converts the int 20, so it prints as <code>20</code>.' },
    { kind: 'pick', q: 'Pydantic v2, default (lax) mode. Which input to <code>class M(BaseModel): n: int</code> raises a ValidationError?', options: ['<code>{"n": "5"}</code>', '<code>{"n": 5.0}</code>', '<code>{"n": 5.5}</code>', '<code>{"n": 5}</code>'], answer: 2, explain: 'Lax mode converts a numeric string <code>"5"</code> and a float with no fractional part (<code>5.0</code>) to int. <code>5.5</code> would lose data, so v2 rejects it: “Input should be a valid integer, got a number with a fractional part”. (Pydantic v1 silently truncated it to 5.)' }
  ],
  interview: [
    { q: 'What does <code>@dataclass</code> generate, and what does it not do?', a: '<p>From the annotated fields it generates <code>__init__</code>, <code>__repr__</code> and <code>__eq__</code> by default; <code>__lt__</code> etc. with <code>order=True</code>; <code>__hash__</code> with <code>frozen=True</code> (or <code>unsafe_hash=True</code>); <code>__setattr__</code>/<code>__delattr__</code> guards with frozen; <code>__slots__</code> with <code>slots=True</code>; <code>__match_args__</code> for pattern matching. It does <b>not</b> validate or convert types.</p>', lvl: 'core' },
    { q: 'How are dataclass hashing rules decided?', a: '<ul><li><code>eq=False</code>: inherit <code>__hash__</code> (identity).</li><li><code>eq=True, frozen=False</code> (default): <code>__hash__ = None</code>, unhashable.</li><li><code>eq=True, frozen=True</code>: hash generated from the compared fields.</li><li><code>unsafe_hash=True</code>: generate it anyway; only safe if the fields don’t change while hashed.</li></ul>', lvl: 'deep' },
    { q: 'Why does <code>items: list = []</code> raise, and what is <code>default_factory</code>?', a: '<p>Class-level defaults are shared, so a mutable default would be shared by every instance (the same bug as mutable function defaults). The decorator rejects unhashable defaults outright. <code>field(default_factory=list)</code> stores a callable that <code>__init__</code> calls once per instance.</p>', lvl: 'core' },
    { q: 'What changed in Pydantic v2, and why does it matter?', a: '<p>Validation moved to <code>pydantic-core</code> (Rust), which is typically several times to tens of times faster than v1. The API was renamed: <code>model_validate</code>/<code>model_validate_json</code>, <code>model_dump</code>/<code>model_dump_json</code>, <code>field_validator</code>/<code>model_validator</code>, <code>model_config = ConfigDict(...)</code>, <code>from_attributes</code> instead of <code>orm_mode</code>. Behaviour changed too: stricter int parsing (no truncating 5.5), no implicit coercion of int to str, and <code>TypeAdapter</code> validates any type, not just models.</p>', lvl: 'core' },
    { q: 'Explain the order of Pydantic validators.', a: '<p>Per field: <code>mode="before"</code> validators run on raw input, then core type validation (lax or strict), then <code>mode="after"</code> validators (the default) on the typed value. <code>mode="wrap"</code> validators surround the core step and decide whether to call it. Fields validate in definition order. Then <code>model_validator(mode="after")</code> runs on the whole instance, for cross-field rules. All field errors are collected into one <code>ValidationError</code>.</p>', lvl: 'deep' },
    { q: 'Lax vs strict mode?', a: '<p>Lax (the default) accepts common conversions: <code>"42"</code> → 42, <code>"true"</code>/<code>"yes"</code> → True, ISO strings → datetime. Strict requires the exact type (with sensible JSON exceptions: a JSON string is still accepted for a datetime field). Enable strict per model (<code>ConfigDict(strict=True)</code>), per field (<code>Field(strict=True)</code>) or per call (<code>model_validate(data, strict=True)</code>).</p>', lvl: 'core' },
    { q: 'When would you use a dataclass, a Pydantic model, attrs, NamedTuple or TypedDict?', a: '<p><b>Pydantic</b>: any trust boundary (HTTP bodies, queue messages, config, LLM tool outputs). <b>dataclass</b>: internal domain objects, zero dependencies. <b>attrs</b>: dataclass-like with validators and converters, and more options. <b>NamedTuple</b>: immutable records that must also be tuples (unpacking, legacy APIs). <b>TypedDict</b>: the data must stay a dict (JSON, kwargs). A common architecture: Pydantic at the edge, map into frozen dataclasses for the core.</p>', lvl: 'core' },
    { q: 'What does <code>slots=True</code> change, and what can break?', a: '<p>The decorator creates a <b>new class</b> with <code>__slots__</code> for the fields: smaller instances, faster attribute access, no accidental attributes. Trade-offs: no <code>__dict__</code> (so no ad-hoc attributes, and <code>cached_property</code> doesn’t work), weakrefs need <code>weakref_slot=True</code> (3.11), and methods using zero-argument <code>super()</code> can break because they reference the original class.</p>', lvl: 'deep' },
    { q: 'How do you serialise a dataclass or model to JSON?', a: '<p>Dataclass: <code>json.dumps(dataclasses.asdict(obj), default=str)</code>, which recursively copies to dicts and lists; you handle datetimes, Decimals and UUIDs yourself. Pydantic: <code>model_dump_json()</code>, which knows how to serialise those types, supports aliases (<code>by_alias=True</code>), exclusions and custom <code>@field_serializer</code>s, and is done in Rust.</p>', lvl: 'core' },
    { q: 'How do dataclasses compare to Java records?', a: '<p>A <code>@dataclass(frozen=True)</code> is close to a Java <code>record</code>: generated constructor, accessors (plain attributes), <code>equals</code>/<code>hashCode</code>/<code>toString</code>, immutability (shallow in both). Records validate in a compact constructor; dataclasses use <code>__post_init__</code>. Pydantic is closer to records + Jackson + Bean Validation (<code>@NotNull</code>, <code>@Min</code>) in one step.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Pydantic v2 API model', lang: 'python', code: `from datetime import datetime
from decimal import Decimal
from typing import Annotated, Self

from pydantic import (BaseModel, ConfigDict, Field, SecretStr,
                      field_validator, model_validator)

Sku = Annotated[str, Field(pattern=r"^[A-Z]{3}-\\d{4}$")]

class LineIn(BaseModel):
    sku: Sku
    qty: int = Field(gt=0, le=1000)
    unit_price: Decimal = Field(gt=0, decimal_places=2)

class OrderIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, frozen=True)

    customer_email: str
    lines: list[LineIn] = Field(min_length=1)
    coupon: str | None = None
    deliver_after: datetime | None = None
    payment_token: SecretStr                      # repr/str show '**********'

    @field_validator("customer_email")
    @classmethod
    def lower_email(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("not an email address")
        return v.lower()

    @model_validator(mode="after")
    def coupon_needs_two_lines(self) -> Self:
        if self.coupon and len(self.lines) < 2:
            raise ValueError("coupon requires at least two lines")
        return self

order = OrderIn.model_validate_json(request_body)       # raises ValidationError (422 in FastAPI)
order.model_dump(mode="json", exclude={"payment_token"})`, note: '<code>extra="forbid"</code> rejects unknown keys (typos, mass-assignment attempts). Use the <code>email-validator</code> extra and <code>EmailStr</code> for real email validation.' },
    { title: 'Edge model → domain dataclass', lang: 'python', code: `from dataclasses import dataclass
from decimal import Decimal

@dataclass(frozen=True, slots=True)
class Line:
    sku: str
    qty: int
    unit_price: Decimal

    @property
    def total(self) -> Decimal:
        return self.unit_price * self.qty

@dataclass(frozen=True, slots=True)
class Order:
    customer: str
    lines: tuple[Line, ...]          # tuple, not list: deep immutability

    @property
    def total(self) -> Decimal:
        return sum((l.total for l in self.lines), start=Decimal(0))

def to_domain(o: "OrderIn") -> Order:
    """Validated input in, trusted domain object out. No Pydantic past this point."""
    return Order(
        customer=o.customer_email,
        lines=tuple(Line(l.sku, l.qty, l.unit_price) for l in o.lines),
    )`, note: 'The domain layer stays dependency-free, cheap to construct and easy to test; validation happened once, at the edge.' },
    { title: 'Java comparison', lang: 'java', code: `// frozen dataclass  ~  record
public record Line(String sku, int qty, BigDecimal unitPrice) {
    public Line {                                   // compact constructor ~ __post_init__
        if (qty <= 0) throw new IllegalArgumentException("qty");
    }
}

// Pydantic model  ~  record + Jackson + Bean Validation
public record LineIn(
    @NotBlank @Pattern(regexp = "^[A-Z]{3}-\\\\d{4}$") String sku,
    @Min(1) @Max(1000) int qty,
    @DecimalMin("0.01") BigDecimal unitPrice) {}

// @PostMapping("/orders") ResponseEntity<?> create(@Valid @RequestBody OrderIn in)
// FastAPI: async def create(order: OrderIn): ...   -> 422 with every field error`, note: 'Jackson by default also coerces <code>"5"</code> into an <code>int</code>, much like Pydantic’s lax mode.' }
  ]
});

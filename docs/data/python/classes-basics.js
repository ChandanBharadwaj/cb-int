IA.register({
  track: 'python',
  slug: 'classes-basics',
  title: 'Classes & OOP basics',
  tagline: 'A Python class is a Java class with <b>the ceremony removed</b>: no field declarations, no <code>new</code>, no access modifiers, no overloading. You write <code>__init__(self, …)</code> as the constructor, name <code>self</code> explicitly, and call the parent constructor yourself with <code>super().__init__()</code>.',
  tldr: {
    problem: 'Java developers write Python classes that look right but behave differently: a list in the class body shared by every object, a missing <code>self</code>, a parent <code>__init__</code> that never ran, or <code>==</code> that compares identity.',
    model: 'An object is a <b>dictionary of attributes</b> plus a pointer to its class. <code>obj.name</code> looks in the object first, then its class, then the parent classes in <b>MRO</b> order. <code>obj.method(x)</code> is sugar for <code>Class.method(obj, x)</code>: that first argument is <code>self</code>.',
    hook: '“Where are the fields declared?” They aren’t. <code>self.x = …</code> inside <code>__init__</code> creates them. Anything assigned directly in the class body is shared, like a Java <code>static</code>.',
    facts: [
      { v: 'self', l: 'is just the conventional name of the first parameter. Python passes the instance there automatically when you call through an object' },
      { v: '_name', l: 'one leading underscore means “internal” by convention only; <code>__name</code> triggers name mangling to <code>_Class__name</code>. Nothing is truly private' },
      { v: 'object', l: 'is the implicit base of every class. <code>class A:</code> and <code>class A(object):</code> are the same in Python 3' }
    ]
  },
  intro: {
    what: 'A <b>class</b> is a blueprint; an <b>object</b> (instance) is one thing made from it. You already know this from Java. What changes in Python is the syntax and a few rules: the constructor is called <code>__init__</code>, every method takes the object as an explicit first parameter called <code>self</code>, and attributes appear when you assign them rather than being declared up front.',
    analogy: { icon: '📋', title: 'A form template and filled-in forms', text: 'The class is the blank template printed with shared text at the top (class attributes, like the company name). Each object is one filled-in copy with its own answers (instance attributes). When you look for a value you check the filled-in copy first; if the box is empty, you read the template.' },
    steps: [
      { t: 'Define a class', d: 'No field list, no <code>public</code>. <code>__init__</code> fills in the new object.', code: 'class Account:\n    def __init__(self, owner, balance=0):\n        self.owner = owner\n        self.balance = balance' },
      { t: 'Create objects', d: 'Call the class like a function. There is no <code>new</code>.', code: 'a = Account("Asha")\nb = Account("Ben", 100)\nprint(a.owner, b.balance)   # Asha 100' },
      { t: 'Add methods', d: 'A method is a function in the class. Its first parameter receives the object.', code: '    def deposit(self, amount):\n        self.balance += amount\n\na.deposit(50)   # same as Account.deposit(a, 50)' },
      { t: 'Inherit', d: 'Put the parent in brackets. Call the parent’s <code>__init__</code> yourself.', code: 'class Savings(Account):\n    def __init__(self, owner, rate):\n        super().__init__(owner)\n        self.rate = rate' },
      { t: 'Make it printable', d: 'Define <code>__repr__</code> (like <code>toString()</code>) so logs and the REPL show something useful.', code: '    def __repr__(self):\n        return f"Account({self.owner!r}, {self.balance})"' }
    ],
    terms: [
      ['class / instance', 'The blueprint, and one object made from it.'],
      ['__init__', 'The initialiser, Python’s constructor. It sets up attributes on the new object and returns <code>None</code>.'],
      ['self', 'The object the method was called on. Java’s <code>this</code>, but written explicitly as the first parameter.'],
      ['attribute', 'A named value on an object or class: data (<code>a.balance</code>) or a method (<code>a.deposit</code>).'],
      ['class attribute', 'Assigned in the class body; shared by all instances unless an instance sets its own.'],
      ['MRO', 'Method resolution order: the list of classes Python searches for an attribute, e.g. <code>(Savings, Account, object)</code>.']
    ]
  },
  visual: {
    title: 'Objects, self and attribute lookup',
    caption: 'Pick a scenario and press <b>Play</b> or <b>Step</b>. The right side shows the instance’s own dictionary above its class (and parent class). A dashed box means “looked here, not found”. Watch <code>self</code> being passed in, <code>super()</code> moving one step up the chain, and two objects sharing one class-level list.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'First class', code: `class Account:
    bank = "Atlas"                       # class attribute: shared

    def __init__(self, owner, balance=0):
        self.owner = owner               # instance attributes
        self.balance = balance

    def deposit(self, amount):
        if amount <= 0:
            raise ValueError("amount must be positive")
        self.balance += amount
        return self.balance

    def __repr__(self):
        return f"Account({self.owner!r}, balance={self.balance})"

a = Account("Asha")
b = Account("Ben", 100)
a.deposit(50)
print(a, b)
print(a.bank, b.bank)
print(a.__dict__)                        # the instance's own attributes
print(Account.deposit(b, 1))             # what b.deposit(1) really does`, note: 'The last line shows that <code>self</code> is just the first argument.' },
      { label: 'Inheritance & super()', code: `class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        return f"{self.name} makes a sound"

class Dog(Animal):
    def __init__(self, name, breed):
        super().__init__(name)           # call the parent explicitly
        self.breed = breed

    def speak(self):                     # override
        return super().speak() + " (woof)"

d = Dog("Rex", "lab")
print(d.speak())
print(isinstance(d, Animal), issubclass(Dog, Animal))
print([c.__name__ for c in Dog.__mro__])

class Cat(Animal):
    def __init__(self, name):
        self.lives = 9                   # forgot super().__init__!
try:
    print(Cat("Tom").speak())
except AttributeError as e:
    print("AttributeError:", e)`, note: 'Python never calls the parent <code>__init__</code> for you.' },
      { label: 'Class vs instance attrs', code: `class Cart:
    items = []                           # BUG: one list for all carts
    def add(self, x):
        self.items.append(x)

a, b = Cart(), Cart()
a.add("apple")
print("b sees:", b.items)

class FixedCart:
    def __init__(self):
        self.items = []                  # one list per object
    def add(self, x):
        self.items.append(x)

a, b = FixedCart(), FixedCart()
a.add("apple")
print("b sees:", b.items)

# assignment through an instance creates a new instance attribute (shadowing)
class C:
    n = 0
x, y = C(), C()
x.n = 5
print(x.n, y.n, C.n)`, note: 'Mutating a class attribute through <code>self</code> affects everyone; assigning to <code>self.n</code> only shadows it.' },
      { label: 'Equality & printing', code: `class Point:
    def __init__(self, x, y):
        self.x, self.y = x, y

p, q = Point(1, 2), Point(1, 2)
print(p == q)                 # False: default == is identity (like Java without equals)
print(p)                      # <__main__.Point object at 0x...>

class Point2:
    def __init__(self, x, y):
        self.x, self.y = x, y
    def __eq__(self, other):
        if not isinstance(other, Point2):
            return NotImplemented
        return (self.x, self.y) == (other.x, other.y)
    def __hash__(self):
        return hash((self.x, self.y))
    def __repr__(self):
        return f"Point2({self.x}, {self.y})"

print(Point2(1, 2) == Point2(1, 2), {Point2(1, 2), Point2(1, 2)})

from dataclasses import dataclass
@dataclass(frozen=True)
class Point3:                  # like a Java record
    x: int
    y: int
print(Point3(1, 2) == Point3(1, 2), Point3(1, 2))`, note: '<code>@dataclass</code> writes <code>__init__</code>, <code>__repr__</code> and <code>__eq__</code> for you. See <a href="dataclasses-pydantic.html">Dataclasses &amp; Pydantic</a>.' },
      { label: 'Properties & privacy', code: `class Temperature:
    def __init__(self, celsius):
        self.celsius = celsius           # goes through the setter below

    @property
    def celsius(self):                   # read like a field, runs code
        return self._celsius

    @celsius.setter
    def celsius(self, value):
        if value < -273.15:
            raise ValueError("below absolute zero")
        self._celsius = value

    @property
    def fahrenheit(self):
        return self._celsius * 9 / 5 + 32

t = Temperature(20)
print(t.celsius, t.fahrenheit)
t.celsius = 30
print(t.fahrenheit)
try:
    t.celsius = -300
except ValueError as e:
    print("rejected:", e)
print(t._celsius)                        # "private" by convention only`, note: 'No getters and setters up front: start with a plain attribute and switch to <code>@property</code> later without changing callers.' },
      { label: 'Class & static methods', code: `class User:
    count = 0

    def __init__(self, name):
        self.name = name
        User.count += 1                  # update the shared counter on the class

    @classmethod
    def from_email(cls, email):          # alternative constructor
        return cls(email.split("@")[0])

    @staticmethod
    def is_valid(name):                  # no self, no cls: a plain function
        return name.isalnum()

u = User.from_email("asha@example.com")
print(u.name, User.count, User.is_valid("asha!"))`, note: 'Python has no constructor overloading; <code>@classmethod</code> factories fill that role.' }
    ]
  },
  gotchas: [
    { trap: 'Forgetting self', code: `class Greeter:
    def hello():                 # no self
        return "hi"

Greeter().hello()
# TypeError: Greeter.hello() takes 0 positional arguments but 1 was given`, why: 'Calling through an instance always passes the instance as the first argument. With no parameter to receive it, the call fails. Inside methods, a bare <code>balance</code> (without <code>self.</code>) is a local variable, not the attribute.', fix: 'Every instance method starts with <code>self</code>, and every attribute access inside it uses <code>self.</code>.' },
    { trap: 'Mutable class attribute shared by all instances', code: `class Cart:
    items = []        # Java habit: "field initialiser"
`, why: 'The class body runs once. <code>items</code> is one list stored on the class, and every instance that appends to <code>self.items</code> mutates it.', fix: 'Create per-object state in <code>__init__</code>: <code>self.items = []</code>. With dataclasses use <code>field(default_factory=list)</code>.' },
    { trap: 'Parent __init__ never runs', code: `class Base:
    def __init__(self):
        self.ready = True
class Child(Base):
    def __init__(self):
        self.name = "c"       # no super().__init__()
Child().ready                 # AttributeError`, why: 'Java inserts an implicit <code>super()</code> call into every constructor. Python doesn’t: defining <code>__init__</code> in the child replaces the parent’s entirely.', fix: 'Call <code>super().__init__(…)</code>, usually first. If the child doesn’t need its own <code>__init__</code>, don’t define one and the parent’s is inherited.' },
    { trap: 'Expecting method overloading', code: `class Shape:
    def area(self): ...
    def area(self, scale): ...   # replaces the first one
Shape().area()                   # TypeError: missing 'scale'`, why: 'A class body is a namespace: the second <code>def</code> rebinds the name <code>area</code>. There is no overloading by parameter list.', fix: 'Use default arguments (<code>def area(self, scale=1)</code>), keyword arguments, or <code>@classmethod</code> factories for alternative constructors.' },
    { trap: '== compares identity until you define __eq__', code: `Point(1, 2) == Point(1, 2)    # False
{Point(1, 2), Point(1, 2)}    # two elements`, why: 'The default <code>__eq__</code> inherited from <code>object</code> compares identity, like Java’s <code>Object.equals</code>. Defining <code>__eq__</code> without <code>__hash__</code> makes instances unhashable (Python sets <code>__hash__</code> to <code>None</code>).', fix: 'For value objects use <code>@dataclass</code> (add <code>frozen=True</code> to make them hashable), or define both <code>__eq__</code> and <code>__hash__</code>.' },
    { trap: 'Writing Java-style getters and setters', code: `def get_name(self): return self._name
def set_name(self, v): self._name = v`, why: 'It works but is noise. Python can turn a plain attribute into a computed one later with <code>@property</code>, without changing the callers, so there is no reason to pre-emptively wrap.', fix: 'Expose plain attributes. Add <code>@property</code> only when you need validation or computation.' }
  ],
  scenarios: [
    { title: 'Requests start sharing each other’s headers',
      symptom: 'In a small HTTP client wrapper, a header set for one tenant’s requests shows up on another tenant’s requests. It only happens after the process has served a few calls.',
      diagnose: `class ApiClient:
    headers = {"Accept": "application/json"}   # class attribute
    def with_tenant(self, t):
        self.headers["X-Tenant"] = t           # mutates the shared dict
        return self`,
      cause: 'The dict lives on the class, so every <code>ApiClient()</code> mutates the same object. Java developers read it as a per-instance field initialiser.',
      fix: 'Create mutable state in <code>__init__</code>, copying any defaults.',
      fixCode: `class ApiClient:
    DEFAULT_HEADERS = {"Accept": "application/json"}   # treat as read-only

    def __init__(self):
        self.headers = dict(self.DEFAULT_HEADERS)       # per-instance copy

    def with_tenant(self, t):
        self.headers["X-Tenant"] = t
        return self` },
    { title: 'AttributeError deep inside a subclass',
      symptom: 'After a refactor added a <code>__init__</code> to <code>RetryingClient(BaseClient)</code>, calls fail with <code>AttributeError: \'RetryingClient\' object has no attribute \'session\'</code>.',
      diagnose: `class RetryingClient(BaseClient):
    def __init__(self, retries=3):
        self.retries = retries      # BaseClient.__init__ (which sets self.session) never runs`,
      cause: 'Adding <code>__init__</code> to the subclass replaced the inherited one. Unlike Java, nothing calls the parent constructor automatically.',
      fix: 'Accept and forward the parent’s arguments, and call <code>super().__init__</code>.',
      fixCode: `class RetryingClient(BaseClient):
    def __init__(self, *args, retries=3, **kwargs):
        super().__init__(*args, **kwargs)
        self.retries = retries` }
  ],
  puzzles: [
    { kind: 'output', q: 'Two carts, one class. What does this print?', code: `class Cart:
    items = []
    def add(self, x):
        self.items.append(x)

a = Cart()
b = Cart()
a.add(1)
print(b.items)`, options: ['[1]', '[]', 'AttributeError', 'None'], answer: 0, run: true, expect: '[1]', explain: '<code>items</code> is a class attribute: one list shared by all instances. <code>a.add</code> mutates it, and <code>b.items</code> finds the same list on the class.' },
    { kind: 'output', q: 'Shadowing a class attribute:', code: `class C:
    n = 0

a = C()
b = C()
a.n = 5
C.n = 1
print(a.n, b.n)`, options: ['5 1', '5 0', '1 1', '5 5'], answer: 0, run: true, expect: '5 1', explain: '<code>a.n = 5</code> creates an attribute on <code>a</code> itself, which hides the class one. <code>b</code> has none, so it reads <code>C.n</code>, which is now 1.' },
    { kind: 'output', q: 'super() chain. What is printed?', code: `class A:
    def hi(self):
        return "A"

class B(A):
    def hi(self):
        return "B" + super().hi()

class C(B):
    def hi(self):
        return "C" + super().hi()

print(C().hi())`, options: ['CBA', 'C', 'ABC', 'CA'], answer: 0, run: true, expect: 'CBA', explain: 'Each <code>super().hi()</code> calls the next class in the MRO (C → B → A), and each level prepends its letter to the result.' },
    { kind: 'output', q: 'The child defines its own __init__:', code: `class Base:
    def __init__(self):
        self.ready = True

class Child(Base):
    def __init__(self):
        self.name = "c"

print(hasattr(Child(), "ready"))`, options: ['False', 'True', 'AttributeError', 'TypeError'], answer: 0, run: true, expect: 'False', explain: '<code>Child.__init__</code> replaces <code>Base.__init__</code> and never calls it, so <code>ready</code> is never set. Python does not insert an implicit <code>super()</code> call like Java.' },
    { kind: 'output', q: 'Default equality and identity:', code: `class P:
    def __init__(self, x):
        self.x = x

a = P(1)
b = P(1)
print(a == b, a is a, a.x == b.x)`, options: ['False True True', 'True True True', 'True False True', 'False False True'], answer: 0, run: true, expect: 'False True True', explain: 'Without <code>__eq__</code>, <code>==</code> falls back to identity: two different objects are not equal. Comparing the attributes compares ints, which are equal.' },
    { kind: 'output', q: '__repr__ inside a list:', code: `class P:
    def __init__(self, x):
        self.x = x
    def __repr__(self):
        return f"P({self.x})"

print([P(1), P(2)])`, options: ['[P(1), P(2)]', '[<__main__.P object>, <__main__.P object>]', "['P(1)', 'P(2)']", 'P(1) P(2)'], answer: 0, run: true, expect: '[P(1), P(2)]', explain: 'Printing a list shows the <code>repr</code> of each element. <code>__repr__</code> is the one to define first; <code>str()</code> falls back to it when there is no <code>__str__</code>.' },
    { kind: 'output', q: 'Diamond inheritance. What is the MRO?', code: `class A: pass
class B(A): pass
class C(A): pass
class D(B, C): pass

print([k.__name__ for k in D.__mro__])`, options: ["['D', 'B', 'C', 'A', 'object']", "['D', 'B', 'A', 'C', 'object']", "['D', 'C', 'B', 'A', 'object']", 'TypeError: diamond'], answer: 0, run: true, expect: "['D', 'B', 'C', 'A', 'object']", explain: 'Python’s C3 linearisation keeps the left-to-right order of the bases and puts a shared parent (A) after all of its children. That is why <code>super()</code> in B goes to C, not to A.' },
    { kind: 'concept', q: 'What happens when you call this?', code: `class Greeter:
    def hello():
        return "hi"

Greeter().hello()`, options: ['TypeError: hello() takes 0 positional arguments but 1 was given', 'Returns "hi"', 'NameError: self', 'SyntaxError at the def'], answer: 0, explain: 'The class definition is legal. Calling through an instance passes the instance as the first argument, and <code>hello</code> has no parameter to receive it.' }
  ],
  interview: [
    { q: 'What are <code>self</code> and <code>__init__</code>?', a: '<p><code>__init__</code> is the initialiser that runs right after a new object is created; it sets attributes and returns <code>None</code>. <code>self</code> is the conventional name of a method’s first parameter, which receives the instance. <code>obj.m(x)</code> is translated to <code>type(obj).m(obj, x)</code>. It is Java’s <code>this</code>, made explicit.</p>', fu: 'What creates the object then? <code>__new__</code>, a static-like method on the class. You override it only for immutables or special cases.', lvl: 'core' },
    { q: 'Class attribute vs instance attribute?', a: '<p>A class attribute is assigned in the class body and stored once on the class; every instance can read it. An instance attribute is set on <code>self</code> (usually in <code>__init__</code>) and stored in that object’s <code>__dict__</code>. Lookup checks the instance first, so assigning <code>obj.x = …</code> shadows a class attribute for that object only. Mutable class attributes are shared state.</p>', lvl: 'core' },
    { q: 'How does inheritance work, and how is <code>super()</code> different from Java’s?', a: '<ul><li><code>class Dog(Animal):</code> means <i>extends</i>. All methods can be overridden.</li><li>Defining <code>__init__</code> in the child replaces the parent’s; call <code>super().__init__(…)</code> yourself.</li><li><code>super()</code> means “the next class in the <b>MRO</b> of this object”, not strictly “my parent”. With multiple inheritance that can be a sibling class.</li></ul>', lvl: 'core' },
    { q: 'Does Python have private members, interfaces and method overloading?', a: '<ul><li><b>Private:</b> no enforcement. <code>_x</code> means internal by convention; <code>__x</code> is name-mangled to <code>_Class__x</code> to avoid clashes in subclasses.</li><li><b>Interfaces:</b> duck typing is the default. For explicit contracts use <code>abc.ABC</code> with <code>@abstractmethod</code>, or <code>typing.Protocol</code> for static checking.</li><li><b>Overloading:</b> no; a second <code>def</code> with the same name replaces the first. Use default and keyword arguments, or <code>@classmethod</code> factories.</li></ul>', lvl: 'core' },
    { q: '<code>@staticmethod</code> vs <code>@classmethod</code> vs a normal method?', a: '<p>A normal method receives the instance (<code>self</code>). A classmethod receives the class (<code>cls</code>), so it works in subclasses: ideal for alternative constructors like <code>from_json</code>. A staticmethod receives nothing; it is a plain function namespaced in the class. Often a module-level function is simpler than a staticmethod.</p>', lvl: 'core' },
    { q: 'What does <code>==</code> do on your own class by default? What about <code>__hash__</code>?', a: '<p>By default <code>==</code> is identity (the same as <code>is</code>). Define <code>__eq__</code> for value equality. If you define <code>__eq__</code> but not <code>__hash__</code>, Python sets <code>__hash__ = None</code> and the objects can’t go in sets or be dict keys, which prevents the classic Java bug of equals without hashCode.</p>', lvl: 'core' },
    { q: '<code>__str__</code> vs <code>__repr__</code>?', a: '<p><code>__repr__</code> is the developer view, used by the REPL, debuggers, and when the object is inside a container; ideally it looks like the constructor call. <code>__str__</code> is the user-facing text for <code>print</code> and f-strings, and falls back to <code>__repr__</code>. Define <code>__repr__</code> first.</p>', lvl: 'core' },
    { q: 'Why use <code>@property</code> instead of getters and setters?', a: '<p>Start with a public attribute. If you later need validation or a computed value, turn it into a <code>@property</code>: callers still write <code>obj.x</code> and <code>obj.x = 5</code>. This is why Python code doesn’t need defensive getters and setters.</p>', lvl: 'core' },
    { q: 'How does attribute lookup actually work for <code>obj.name</code>?', a: '<p>Simplified: Python looks for <code>name</code> on the type’s MRO first, to see whether it is a <b>data descriptor</b> (like a property), which wins. Otherwise it checks <code>obj.__dict__</code>. Then it uses what it found on the class; functions found there are <b>bound</b> to <code>obj</code> to make a method. If nothing is found, <code>__getattr__</code> is called if defined, else <code>AttributeError</code>.</p>', fu: 'Why are methods not stored per instance? They live once on the class; binding happens on each attribute access.', lvl: 'deep' },
    { q: 'What is the MRO and how is it computed?', a: '<p>The method resolution order is the linear list of classes searched for attributes, in <code>Cls.__mro__</code>. Python uses <b>C3 linearisation</b>: children come before parents, and the left-to-right order of bases is kept. In a diamond <code>D(B, C)</code> with <code>B(A)</code> and <code>C(A)</code> the MRO is D, B, C, A, object. Inconsistent hierarchies raise <code>TypeError</code> at class creation.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Java class', lang: 'java', code: `// Java 21
public class Account {
    private static final String BANK = "Atlas";
    private final String owner;
    private long balance;

    public Account(String owner) { this(owner, 0); }
    public Account(String owner, long balance) {
        this.owner = owner;
        this.balance = balance;
    }
    public long deposit(long amt) { balance += amt; return balance; }
    public String getOwner() { return owner; }
    @Override public String toString() { return "Account(" + owner + ", " + balance + ")"; }
}

public class Savings extends Account {
    private final double rate;
    public Savings(String owner, double rate) { super(owner); this.rate = rate; }
}`, note: 'Two constructors for the optional balance, a getter, and an explicit field list.' },
    { title: 'Python class', lang: 'python', code: `class Account:
    BANK = "Atlas"                          # class attribute (constant by convention)

    def __init__(self, owner: str, balance: int = 0) -> None:
        self.owner = owner                  # plain attribute: no getter needed
        self.balance = balance

    def deposit(self, amt: int) -> int:
        self.balance += amt
        return self.balance

    def __repr__(self) -> str:
        return f"Account({self.owner!r}, {self.balance})"


class Savings(Account):
    def __init__(self, owner: str, rate: float) -> None:
        super().__init__(owner)             # explicit, never implicit
        self.rate = rate`, note: 'One <code>__init__</code> with a default replaces both constructors. Type hints are optional and not enforced at run time.' },
    { title: 'Agent code: a tool base class', lang: 'python', code: `from abc import ABC, abstractmethod


class Tool(ABC):
    name: str = "tool"                      # subclasses override

    def __init__(self, timeout_s: float = 10.0) -> None:
        self.timeout_s = timeout_s
        self.calls = 0                       # per-instance counter

    @abstractmethod
    def run(self, query: str) -> str: ...

    def __call__(self, query: str) -> str:   # tool("...") works like a function
        self.calls += 1
        return self.run(query)


class WebSearch(Tool):
    name = "web_search"

    def run(self, query: str) -> str:
        return f"results for {query!r}"


search = WebSearch(timeout_s=5)
print(search.name, search("python mro"), search.calls)
# Tool() would raise TypeError: can't instantiate abstract class`, note: '<code>abc.ABC</code> is the nearest thing to a Java abstract class; instantiating it with an unimplemented abstract method fails.' }
  ]
});

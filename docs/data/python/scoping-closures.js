IA.register({
  track: 'python',
  slug: 'scoping-closures',
  title: 'Scope, closures & defaults',
  tagline: 'Python decides a name’s scope <b>at compile time</b>, from where it is assigned, and looks it up <b>at run time</b>, walking Local → Enclosing → Global → Built-in. Closures capture <i>variables</i>, not values. Default arguments are evaluated <i>once</i>. Those three facts explain the classic traps.',
  tldr: {
    problem: 'Three of the most common Python interview traps (and production bugs) are scope bugs: <code>UnboundLocalError</code> on a counter, lambdas in a loop that all return the last value, and a default <code>[]</code> that remembers previous calls.',
    model: 'Any assignment in a function makes that name <b>local for the whole function</b>, unless declared <code>global</code> / <code>nonlocal</code>. Names a nested function uses from outside live in shared <b>cells</b>, read when the function runs. Defaults are stored on the function object at <code>def</code> time.',
    hook: '“Why does <code>[lambda: i for i in range(3)]</code> give 2, 2, 2?” All three lambdas read the same variable <code>i</code> at call time, and by then it is 2. Bind the value with <code>lambda i=i: i</code>.',
    facts: [
      { v: 'LEGB', l: 'lookup order: Local, Enclosing function, Global (module), Built-in. Class bodies are <b>not</b> an enclosing scope for their methods' },
      { v: '1×', l: 'how often a default argument expression is evaluated: once, when <code>def</code> runs. It lives in <code>func.__defaults__</code>' },
      { v: '3.11+', l: 'the clearer error text: “cannot access local variable ’x’ where it is not associated with a value”. <code>UnboundLocalError</code> subclasses <code>NameError</code>' }
    ]
  },
  intro: {
    what: 'A <b>scope</b> is the region of code where a name is visible. Python has four layers: the function you are in (local), any functions wrapped around it (enclosing), the module (global), and the built-ins (<code>print</code>, <code>len</code>). A <b>closure</b> is a function that remembers names from an enclosing function even after that function has returned.',
    analogy: { icon: '🪆', title: 'Nested rooms with one-way glass', text: 'Each function call is a room built inside the room where the function was <i>written</i>. From inside you can see out through the glass into every outer room, but outer rooms can’t see in. To find a name you check your room first, then each outer room in turn. To <i>change</i> something in an outer room you must say so (<code>nonlocal</code> / <code>global</code>), or you just put a new thing with the same name in your own room.' },
    steps: [
      { t: 'Lookup walks outward', d: 'Reading a name checks Local, then Enclosing, then Global, then Built-in. The first hit wins.' },
      { t: 'Assignment makes a name local', d: 'If a function assigns to a name anywhere, that name is local everywhere in the function, even on lines before the assignment.', code: 'count = 0\ndef bump():\n    count += 1   # UnboundLocalError' },
      { t: 'nonlocal / global opt out', d: '<code>nonlocal n</code> means “the n in the enclosing function”. <code>global n</code> means “the module-level n”.', code: 'def make_counter():\n    n = 0\n    def inc():\n        nonlocal n\n        n += 1\n        return n\n    return inc' },
      { t: 'Closures read late', d: 'A nested function reads captured variables when it <i>runs</i>, not when it is created.' },
      { t: 'Defaults evaluate early', d: 'A default value is computed once at <code>def</code> time and reused by every call. Use <code>None</code> as the default for anything mutable.' }
    ],
    terms: [
      ['scope', 'Where a name is visible. Decided by where code is written (lexical scoping).'],
      ['LEGB', 'Local → Enclosing → Global → Built-in, the order names are looked up.'],
      ['closure', 'A function plus the variables it captured from enclosing functions. See <code>f.__closure__</code>.'],
      ['cell', 'The small box that holds a captured variable, shared by the outer function and every closure using it.'],
      ['free variable', 'A name a function uses but neither assigns nor receives as a parameter: <code>f.__code__.co_freevars</code>.'],
      ['default argument', 'A parameter value used when the caller omits it, stored in <code>f.__defaults__</code>.']
    ]
  },
  visual: {
    title: 'Walk the scopes',
    caption: 'Pick a scenario and press <b>Play</b> or <b>Step</b>. Boxes are scopes, outermost first. On a lookup the dashed boxes are the scopes searched, green is where the name was found, and red means the lookup failed. Teal arrows show a reference into another scope (a closure cell or a stored default).'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'LEGB', code: `x = "global"

def outer():
    x = "enclosing"
    def inner():
        print("inner sees:", x)      # enclosing wins over global
        print("len is built-in:", len)
    inner()

outer()
print("module sees:", x)

def shadow():
    len = 3                          # shadows the built-in, only in here
    return len
print(shadow(), len("abc"))` },
      { label: 'UnboundLocalError', code: `count = 0

def bump_broken():
    count += 1          # assignment makes count local

def bump_global():
    global count
    count += 1

try:
    bump_broken()
except UnboundLocalError as e:
    print(type(e).__name__, "->", e)
    print("is a NameError:", isinstance(e, NameError))

bump_global(); bump_global()
print("count:", count)`, note: 'The compiler decides “local” for the whole function body, before any line runs.' },
      { label: 'Inside a closure', code: `def make_counter():
    n = 0
    def inc():
        nonlocal n
        n += 1
        return n
    return inc

c1, c2 = make_counter(), make_counter()
print(c1(), c1(), c1(), "|", c2())

print("free vars:", c1.__code__.co_freevars)
print("cell value:", c1.__closure__[0].cell_contents)
print("separate cells:", c1.__closure__[0] is not c2.__closure__[0])` },
      { label: 'Late binding', code: `from functools import partial

late = [lambda: i for i in range(3)]
print("late:     ", [f() for f in late])

default = [lambda i=i: i for i in range(3)]
print("default:  ", [f() for f in default])

def show(i):
    return i
bound = [partial(show, i) for i in range(3)]
print("partial:  ", [f() for f in bound])

def make(i):
    return lambda: i       # a new scope (and cell) per call
factory = [make(i) for i in range(3)]
print("factory:  ", [f() for f in factory])` },
      { label: 'Mutable default', code: `def add_bad(x, acc=[]):
    acc.append(x)
    return acc

print(add_bad(1), add_bad(2), add_bad(3, []), add_bad(4))
print("stored default:", add_bad.__defaults__)

def add_good(x, acc: list | None = None):
    if acc is None:
        acc = []
    acc.append(x)
    return acc

print(add_good(1), add_good(2))`, note: '<code>add_bad(1)</code>, <code>add_bad(2)</code> and <code>add_bad(4)</code> all return the same list object, so all three print the final contents.' },
      { label: 'Class scope', code: `class Config:
    retries = 3
    def get(self):
        try:
            return retries          # class body is NOT an enclosing scope
        except NameError:
            return "NameError; use self.retries -> " + str(self.retries)

print(Config().get())

try:
    class Grid:
        size = 3
        cells = [size * i for i in range(3)]
    print(Grid.cells)
except NameError as e:
    print("comprehension in class body:", e)`, note: 'Class-level names are visible in the class body itself, but not inside methods or (most of) a comprehension.' }
    ]
  },
  gotchas: [
    { trap: 'Assigning to an outer name makes it local', code: `total = 0
def add(n):
    total = total + n    # UnboundLocalError`, why: 'Scope is decided at compile time. Any assignment (including <code>+=</code>, <code>for x in</code>, <code>import x</code>, <code>def x</code>, <code>except … as x</code>) makes the name local for the entire function.', fix: 'Return the new value instead of mutating module state. If you really need to rebind, declare <code>global total</code> or <code>nonlocal total</code>.' },
    { trap: 'Closures in a loop all see the last value', code: `handlers = {}
for event in ("created", "deleted"):
    handlers[event] = lambda payload: log(event, payload)
# both log "deleted"`, why: 'The lambda captures the <i>variable</i> <code>event</code>, which is read when the lambda runs. By then the loop has finished.', fix: 'Bind the value now: <code>lambda payload, event=event: …</code>, <code>functools.partial(log, event)</code>, or a small factory function that creates a new scope per iteration.' },
    { trap: 'Mutable default arguments are shared', code: `def send(msg, headers={}):
    headers.setdefault("User-Agent", "svc/1.0")
    ...`, why: 'The default <code>{}</code> is created once, at <code>def</code> time, and stored in <code>send.__defaults__</code>. Every call that omits <code>headers</code> mutates that one dict.', fix: 'Default to <code>None</code> and create a fresh object inside: <code>headers = {} if headers is None else headers</code>. Linters flag this: Ruff <code>B006</code>, Pylint <code>W0102</code>.' },
    { trap: 'Methods can’t see class-level names unqualified', code: `class Client:
    TIMEOUT = 5
    def call(self):
        return http_get(url, timeout=TIMEOUT)   # NameError`, why: 'A class body runs once to build the class namespace. It is not an enclosing scope for functions defined in it, and comprehensions in a class body can’t see class names either (except in the first iterable).', fix: 'Use <code>self.TIMEOUT</code> or <code>type(self).TIMEOUT</code> (or <code>Client.TIMEOUT</code>).' },
    { trap: '<code>except … as e</code> deletes <code>e</code>', code: `err = None
try:
    risky()
except ValueError as err:
    pass
print(err)   # NameError if the except ran`, why: 'To break a reference cycle through the traceback, Python runs <code>del err</code> at the end of the except block, even if the name existed before.', fix: 'Copy it to another name inside the block if you need it later: <code>except ValueError as e: last_error = e</code>.' },
    { trap: 'Closures keep big objects alive', code: `def make_handler():
    model = load_huge_model()        # 2 GB
    def handle(x):
        return x * 2                 # doesn't use model...
    return handle                    # ...so it is freed. Fine.

def make_handler2():
    df = load_dataframe()
    return lambda: df.shape          # keeps the whole df alive`, why: 'Any variable a nested function references is kept in a cell for as long as the closure lives, often for the life of the process if the closure is registered as a callback.', fix: 'Capture only what you need (<code>shape = df.shape</code>, then use <code>shape</code>), or use a class with explicit fields so the retained state is visible.' }
  ],
  scenarios: [
    { title: 'Every queue consumer processed messages as if they came from the last queue',
      symptom: 'After moving consumer setup into a loop, all messages were tagged with the queue name <code>"refunds"</code>, even orders and payments.',
      diagnose: `for name in ("orders", "payments", "refunds"):
    broker.subscribe(name, lambda msg: handle(name, msg))

# quick check in a REPL:
cbs = [lambda: name for name in ("a", "b")]
print([f() for f in cbs])      # ['b', 'b']`,
      cause: 'Late binding. Each callback reads the loop variable <code>name</code> when a message arrives, long after the loop finished with <code>"refunds"</code>.',
      fix: 'Bind the value at registration time with <code>functools.partial</code>. It also makes the bound argument visible in debuggers and logs.',
      fixCode: `from functools import partial

for name in ("orders", "payments", "refunds"):
    broker.subscribe(name, partial(handle, name))` },
    { title: 'An internal API client started sending another caller’s auth token',
      symptom: 'Audit logs showed calls from a batch job authenticated as a user who had made one interactive request hours earlier.',
      diagnose: `def call_api(path, headers={}):
    if "Authorization" not in headers:
        headers["Authorization"] = current_token()
    return http.get(BASE + path, headers=headers)

print(call_api.__defaults__)   # ({'Authorization': 'Bearer eyJ...'},)`,
      cause: 'A mutable default. The first caller without headers stored its token in the one shared default dict, and every later call without headers reused it. The bug was invisible in unit tests, which always passed headers.',
      fix: 'Default to <code>None</code> and build headers per call. Turn on Ruff <code>B006</code>/<code>B008</code> in CI so the pattern can’t come back.',
      fixCode: `def call_api(path: str, headers: dict[str, str] | None = None):
    headers = {**(headers or {})}
    headers.setdefault("Authorization", current_token())
    return http.get(BASE + path, headers=headers)` },
    { title: 'The retry helper crashed only when a retry actually happened',
      symptom: 'Tests passed and the happy path worked. During a downstream outage, every request failed with <code>UnboundLocalError</code> instead of retrying.',
      diagnose: `def with_retry(fn, max_attempts=3):
    attempts = 0
    def run(*args):
        try:
            return fn(*args)
        except TimeoutError:
            attempts += 1            # makes attempts local to run()
            if attempts < max_attempts:
                return run(*args)
            raise
    return run`,
      cause: 'The <code>+=</code> makes <code>attempts</code> local to <code>run</code>, but only the error path executes it. Tests never raised <code>TimeoutError</code>, so the bug sat on the path that mattered most. (There is a second bug: the counter would be shared across all calls.)',
      fix: 'Keep the counter local to each call with a loop. If a closure must update captured state, declare <code>nonlocal</code>. Test the failure path explicitly.',
      fixCode: `def with_retry(fn, max_attempts=3):
    def run(*args):
        for attempt in range(1, max_attempts + 1):
            try:
                return fn(*args)
            except TimeoutError:
                if attempt == max_attempts:
                    raise
    return run` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `x = 10

def f():
    print(x)
    x = 20

try:
    f()
except UnboundLocalError:
    print("unbound")`, options: ['10', '20', 'unbound', '10 then 20'], answer: 2, run: true, expect: 'unbound', explain: 'The assignment <code>x = 20</code> makes <code>x</code> local to <code>f</code> for the whole body, including the <code>print</code> on the line before. That local has no value yet, so reading it raises <code>UnboundLocalError</code>. Python never “falls back” to the global.' },
    { kind: 'predict', q: 'What does this print?', code: `def make():
    return [lambda: i * 10 for i in range(3)]

print([f() for f in make()])`, options: ['[0, 10, 20]', '[20, 20, 20]', '[0, 0, 0]', 'NameError'], answer: 1, run: true, expect: '[20, 20, 20]', explain: 'All three lambdas close over the same variable <code>i</code> and read it when called. By then the comprehension has finished with <code>i = 2</code>. (3.12 inlines comprehensions, PEP 709, but keeps this behaviour.)' },
    { kind: 'predict', q: 'What does this print?', code: `def log(msg, seen=[]):
    seen.append(msg)
    return len(seen)

print(log("a"), log("b"), log("c", []), log("d"))`, options: ['1 1 1 1', '1 2 1 3', '1 2 3 4', '1 2 1 2'], answer: 1, run: true, expect: '1 2 1 3', explain: 'The default list is shared: "a" → 1, "b" → 2. The third call passes its own list → 1, which doesn’t touch the default. "d" goes back to the shared default, which already holds a and b → 3.' },
    { kind: 'predict', q: 'What does this print?', code: `def outer():
    n = 0
    def inc():
        nonlocal n
        n += 1
    inc()
    inc()
    return n

print(outer())`, options: ['0', '1', '2', 'UnboundLocalError'], answer: 2, run: true, expect: '2', explain: '<code>nonlocal n</code> makes <code>inc</code> rebind the <code>n</code> cell it shares with <code>outer</code>. Two calls, so <code>outer</code> sees 2.' },
    { kind: 'predict', q: 'There is no global <code>retries</code>. What does this print?', code: `class Config:
    retries = 3
    def get(self):
        return retries

try:
    print(Config().get())
except NameError:
    print("NameError")
print(Config().retries)`, options: ['3<br>3', 'NameError<br>3', 'NameError<br>NameError', '3<br>NameError'], answer: 1, run: true, expect: 'NameError\n3', explain: 'A class body is not an enclosing scope for its methods. Inside <code>get</code>, LEGB checks local, then global, then built-ins, and finds no <code>retries</code>. Attribute access through the instance (<code>self.retries</code>) does find the class attribute.' },
    { kind: 'predict', q: 'What does this print?', code: `e = "outer"
try:
    1 / 0
except ZeroDivisionError as e:
    pass

try:
    print(e)
except NameError:
    print("e was deleted")`, options: ['outer', 'division by zero', 'e was deleted', 'ZeroDivisionError'], answer: 2, run: true, expect: 'e was deleted', explain: '<code>except … as e</code> rebinds <code>e</code> (overwriting "outer"), and at the end of the block Python runs <code>del e</code> to avoid a reference cycle through the traceback. The name is gone afterwards.' },
    { kind: 'predict', q: 'What does this print?', code: `i = "start"
squares = [i * i for i in range(4)]
for j in range(4):
    pass
print(i, j)`, options: ['start 3', '3 3', 'start 4', 'NameError'], answer: 0, run: true, expect: 'start 3', explain: 'A comprehension’s loop variable is isolated (since Python 3), so the outer <code>i</code> is untouched. A <code>for</code> statement’s variable is an ordinary assignment in the current scope and keeps its last value, 3.' },
    { kind: 'pick', q: 'You need three callbacks that return 0, 1 and 2. Which one does <b>not</b> work?', options: ['<code>[lambda i=i: i for i in range(3)]</code>', '<code>[functools.partial(lambda i: i, i) for i in range(3)]</code>', '<code>[(lambda: i) for i in range(3)]</code>', '<code>[(lambda j: lambda: j)(i) for i in range(3)]</code>'], answer: 2, explain: 'Parentheses don’t change anything: the third still captures the shared variable and returns 2, 2, 2. A default argument, <code>partial</code> and an immediately called factory all bind the <i>value</i> at creation time.' }
  ],
  interview: [
    { q: 'Explain LEGB.', a: '<p>When a name is <b>read</b>, Python looks in the Local scope (the current function), then each Enclosing function scope from the inside out, then Global (the module), then Built-in. The first hit wins. Which scope a name belongs to is decided at compile time: any assignment in a function makes the name local unless it is declared <code>global</code> or <code>nonlocal</code>.</p>', fu: 'Where do class bodies fit? (Nowhere in LEGB for their methods.)', lvl: 'core' },
    { q: 'What is a closure, and how is it implemented in CPython?', a: '<p>A function that references variables from an enclosing function. The compiler stores such variables in <b>cell</b> objects instead of plain local slots. The inner function object keeps a tuple of those cells in <code>__closure__</code>, and its code lists the names in <code>co_freevars</code>. The cells outlive the outer call, which is how the closure “remembers”.</p>', lvl: 'core' },
    { q: 'Why does <code>[lambda: i for i in range(3)]</code> return 2, 2, 2? Give three fixes.', a: '<p>Closures capture variables, not values. All the lambdas share one <code>i</code> and read it when called. Fixes: a default argument (<code>lambda i=i: i</code>), <code>functools.partial</code>, or a factory function that creates a new scope per value. <code>partial</code> is the most readable in production code.</p>', lvl: 'core' },
    { q: 'What happens with <code>def f(x=[])</code>, and why did Python choose that design?', a: '<p>Default expressions are evaluated once, when <code>def</code> executes, and stored in <code>f.__defaults__</code> (keyword-only ones in <code>__kwdefaults__</code>). Mutating the default therefore persists across calls. The design is simple and fast: no per-call evaluation, and it allows deliberate tricks such as memo caches. The idiom is <code>None</code> as the default, plus a fresh object inside the body.</p>', lvl: 'core' },
    { q: '<code>global</code> vs <code>nonlocal</code>?', a: '<p><code>global x</code> binds <code>x</code> to the module namespace, and creates it there on assignment if needed. <code>nonlocal x</code> binds to the nearest enclosing <i>function</i> scope that already has <code>x</code>; it is a <code>SyntaxError</code> if there isn’t one, and it never reaches module level. Both are needed only to <i>rebind</i>. Mutating an object (<code>items.append</code>) needs neither.</p>', lvl: 'core' },
    { q: 'Why is <code>UnboundLocalError</code> raised instead of reading the global?', a: '<p>Because locality is a compile-time decision. The compiler emits fast-local opcodes (<code>LOAD_FAST</code>) for local names, which index a slot in the frame. There is no dynamic fallback chain for them. That makes local access fast, and the behaviour predictable, at the cost of this surprise.</p>', lvl: 'deep' },
    { q: 'Do comprehensions have their own scope? What changed in 3.12?', a: '<p>Yes. Since Python 3 the loop variable doesn’t leak. Before 3.12 each comprehension compiled to a hidden nested function. PEP 709 (3.12) <b>inlines</b> list, dict and set comprehensions into the enclosing code for speed, while keeping the visible semantics: the variable is still isolated, and closures inside still bind late. Generator expressions are not inlined.</p>', lvl: 'deep' },
    { q: 'Why can’t a method see a class attribute without <code>self.</code>?', a: '<p>The class body runs once, as a temporary namespace used to build the class. Functions defined in it don’t get it as an enclosing scope, because by the time a method runs, the class attributes live on the class object and can be changed or overridden by subclasses. Access goes through attribute lookup instead: <code>self.x</code> or <code>type(self).x</code>.</p>', lvl: 'deep' },
    { q: 'How do Java lambdas differ from Python closures here?', a: '<p>Java lambdas and anonymous classes may only capture <b>effectively final</b> locals, and they capture the value. A Java loop-variable lambda therefore can’t have the late-binding bug, and you can’t mutate a captured counter (people use <code>AtomicInteger</code> or a one-element array). Python lets you capture and, with <code>nonlocal</code>, rebind. More power, more ways to get it wrong.</p>', lvl: 'core' },
    { q: 'When would you use a closure instead of a class?', a: '<p>When there is one behaviour and a little private state: a counter, a configured callback, a decorator’s wrapper. Once you have several operations on the state, need to inspect it, pickle it, or test it in isolation, a class (or a dataclass) is clearer. Closures also can’t be pickled for <code>multiprocessing</code>.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Configured callbacks', lang: 'python', code: `from functools import partial
import logging

log = logging.getLogger(__name__)

def on_message(queue: str, msg: bytes) -> None:
    log.info("got %d bytes from %s", len(msg), queue)

def register(broker, queues: list[str]) -> None:
    for q in queues:
        # partial binds q NOW; a bare lambda would read q later
        broker.subscribe(q, partial(on_message, q))`, note: '<code>partial</code> objects show their bound arguments in <code>repr</code>, which helps when debugging callback registries.' },
    { title: 'Closure vs class', lang: 'python', code: `import time

def rate_limiter(per_sec: float):
    last = 0.0
    def allow() -> bool:
        nonlocal last
        now = time.monotonic()
        if now - last >= 1 / per_sec:
            last = now
            return True
        return False
    return allow

# The same thing as a class: inspectable, testable, picklable
class RateLimiter:
    def __init__(self, per_sec: float) -> None:
        self.interval = 1 / per_sec
        self.last = 0.0
    def allow(self) -> bool:
        now = time.monotonic()
        if now - self.last >= self.interval:
            self.last = now
            return True
        return False` },
    { title: 'Java comparison', lang: 'java', code: `List<Supplier<Integer>> fns = new ArrayList<>();
for (int i = 0; i < 3; i++) {
    // fns.add(() -> i);          // compile error: i is not effectively final
    int v = i;                    // copy per iteration
    fns.add(() -> v);             // captures the VALUE: 0, 1, 2
}

int[] count = {0};                // workaround to "mutate a captured local"
Runnable inc = () -> count[0]++;  // Python: nonlocal count`, note: 'Java forbids the late-binding bug at compile time. Python allows it, so it is on you (and your linter) to catch.' }
  ]
});

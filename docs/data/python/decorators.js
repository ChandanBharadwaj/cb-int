IA.register({
  track: 'python',
  slug: 'decorators',
  title: 'Decorators',
  tagline: '<code>@deco</code> above a <code>def</code> is just <code>f = deco(f)</code>, run <b>once, at definition time</b>. Because functions are objects, a decorator can wrap, replace, register or annotate them. Get three details right (<code>functools.wraps</code>, the factory layer for arguments, and bottom-up order) and you can read any framework’s magic.',
  tldr: {
    problem: 'Decorators are everywhere in Python services (<code>@app.get</code>, <code>@pytest.fixture</code>, <code>@cache</code>, <code>@retry</code>), and a small mistake in one silently changes every function it touches: lost names in logs, skipped auth, unawaited coroutines.',
    model: 'A decorator is a callable that takes a function and returns a replacement, usually a closure (<code>wrapper</code>) that calls the original. <code>@a @b def f</code> means <code>f = a(b(f))</code>: the nearest decorator is applied first, and the outermost runs first at call time. <code>@d(arg)</code> calls <code>d(arg)</code> first to <i>get</i> the decorator.',
    hook: '“Why does every endpoint in my metrics show up as <code>wrapper</code>?” Your decorator didn’t use <code>@functools.wraps(func)</code>, so the wrapper kept its own <code>__name__</code>, <code>__doc__</code> and signature.',
    facts: [
      { v: 'f = d(f)', l: 'what <code>@d</code> means (PEP 318). Since 3.9 (PEP 614) any expression is allowed after <code>@</code>' },
      { v: 'bottom-up', l: 'the order decorators are <b>applied</b>. Their expressions are <b>evaluated</b> top-down first, and the outermost wrapper runs first on each call' },
      { v: '__wrapped__', l: 'the attribute <code>functools.wraps</code> sets to the original function. <code>inspect.signature</code> and <code>inspect.unwrap</code> follow it' }
    ]
  },
  intro: {
    what: 'In Python, functions are ordinary objects: you can store them in variables, pass them to other functions and return them. A <b>decorator</b> uses that. It is a function that receives your function and gives back a new one, usually one that does something extra (log, time, retry, check permissions) before and after calling yours. The <code>@</code> line is shorthand for doing that swap.',
    analogy: { icon: '🎁', title: 'Gift wrapping', text: 'Your function is the gift. Each decorator wraps it in another layer of paper: the innermost layer goes on first. Whoever receives it (the caller) has to open the outer layer first to reach the gift, and the paper is all they see from outside. <code>functools.wraps</code> is the label that says what’s inside, copied onto the outermost paper.' },
    steps: [
      { t: 'Functions are values', d: 'You can pass a function around without calling it.', code: 'def shout(s):\n    return s.upper()\n\nf = shout          # no parentheses: the function itself\nprint(f("hi"))     # HI' },
      { t: 'A wrapper adds behaviour', d: 'A function that takes a function and returns a new one that calls it.', code: 'def logged(func):\n    def wrapper(*args, **kwargs):\n        print("calling", func.__name__)\n        return func(*args, **kwargs)\n    return wrapper' },
      { t: '@ is the shortcut', d: 'These two are the same.', code: '@logged\ndef greet(name): ...\n\n# same as:\ndef greet(name): ...\ngreet = logged(greet)' },
      { t: 'Keep the label: functools.wraps', d: 'Copy the original’s name, docstring and signature onto the wrapper.', code: 'import functools\n\ndef logged(func):\n    @functools.wraps(func)\n    def wrapper(*args, **kwargs):\n        return func(*args, **kwargs)\n    return wrapper' },
      { t: 'Arguments need one more layer', d: '<code>@retry(times=3)</code> first calls <code>retry(times=3)</code>, which must <i>return</i> the decorator.' }
    ],
    terms: [
      ['first-class function', 'A function that can be stored, passed and returned like any other value.'],
      ['decorator', 'A callable that takes a function (or class) and returns a replacement.'],
      ['wrapper', 'The inner function a decorator returns. It calls the original.'],
      ['decorator factory', 'A function that takes configuration and returns a decorator: <code>retry(times=3)</code>.'],
      ['functools.wraps', 'Copies <code>__name__</code>, <code>__doc__</code>, <code>__module__</code>, <code>__qualname__</code> and more, and sets <code>__wrapped__</code>.'],
      ['class decorator', 'A decorator applied to a class: <code>@dataclass</code> is the famous one.']
    ]
  },
  visual: {
    title: 'Wrap at import, unwrap on every call',
    caption: 'Press <b>Play</b> or <b>Step</b>. Steps 1–6 happen once, when the module is imported: watch the layers appear and the name get bound last. Steps 7–13 are one call travelling in and back out. Flip <b>wraps</b> at any time to see what callers, logs and tools see.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Functions are objects', code: `def greet(name):
    """Say hello."""
    return f"hello {name}"

f = greet                       # bind another name
print(f("asha"), f is greet)
print(greet.__name__, greet.__doc__, type(greet).__name__)

greet.owner = "team-a"          # functions can carry attributes
print(greet.owner)

def apply_twice(fn, x):
    return fn(fn(x))
print(apply_twice(lambda s: s + "!", "hi"))` },
      { label: 'Timing + wraps', code: `import functools, time, inspect

def timed(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        t0 = time.perf_counter()
        try:
            return func(*args, **kwargs)
        finally:
            ms = (time.perf_counter() - t0) * 1000
            print(f"{func.__qualname__} took {ms:.1f} ms")
    return wrapper

@timed
def slow_sum(n: int) -> int:
    """Sum 0..n-1."""
    return sum(range(n))

print(slow_sum(1_000_000))
print(slow_sum.__name__, "|", slow_sum.__doc__, "|", inspect.signature(slow_sum))
print("original:", slow_sum.__wrapped__)`, note: 'Comment out <code>@functools.wraps(func)</code> and run again.' },
      { label: 'Parameterized retry', code: `import functools

def retry(times=3, on=(Exception,)):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(1, times + 1):
                try:
                    return func(*args, **kwargs)
                except on as e:
                    print(f"  attempt {attempt} failed: {e!r}")
                    if attempt == times:
                        raise
        return wrapper
    return decorator

calls = {"n": 0}

@retry(times=3, on=(TimeoutError,))
def flaky():
    calls["n"] += 1
    if calls["n"] < 3:
        raise TimeoutError("upstream slow")
    return "ok"

print(flaky(), "after", calls["n"], "calls")` },
      { label: 'Order of decorators', code: `def tag(name):
    print(f"evaluate tag({name!r})")
    def deco(fn):
        print(f"apply {name} to {fn.__name__}")
        def wrapper():
            print(f"enter {name}")
            return f"<{name}>{fn()}</{name}>"
        return wrapper
    return deco

@tag("b")
@tag("i")
def hi():
    return "hi"

print("--- call ---")
print(hi())`, note: 'Evaluated top-down, applied bottom-up, entered top-down.' },
      { label: 'Class decorators & registries', code: `HANDLERS = {}

def handles(event):
    def deco(fn):
        HANDLERS[event] = fn       # registration happens at import time
        return fn                  # return the function unchanged
    return deco

@handles("user.created")
def on_created(payload): return f"welcome {payload['name']}"

print(HANDLERS["user.created"]({"name": "Ben"}))

def frozen_repr(cls):
    def __repr__(self):
        fields = ", ".join(f"{k}={v!r}" for k, v in vars(self).items())
        return f"{cls.__name__}({fields})"
    cls.__repr__ = __repr__
    return cls

@frozen_repr
class Point:
    def __init__(self, x, y): self.x, self.y = x, y

print(Point(1, 2))` },
      { label: 'Built-in decorators', code: `from functools import cache, cached_property, lru_cache

@lru_cache(maxsize=128)
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)

print(fib(80), fib.cache_info())

class Report:
    def __init__(self, rows): self.rows = rows
    @cached_property                # computed once per instance, stored in __dict__
    def total(self):
        print("  computing total")
        return sum(self.rows)
    @staticmethod
    def kind(): return "report"
    @classmethod
    def empty(cls): return cls([])

r = Report([1, 2, 3])
print(r.total, r.total, Report.kind(), Report.empty().rows)` }
    ]
  },
  gotchas: [
    { trap: 'Forgetting <code>functools.wraps</code>', code: `def traced(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper
# every traced function now has __name__ == "wrapper"`, why: 'The wrapper is a different function with its own metadata. Logs, metrics, tracebacks, <code>help()</code>, pytest and frameworks that inspect signatures (FastAPI, Typer, Click) see the wrapper’s <code>(*args, **kwargs)</code>.', fix: 'Always decorate the wrapper with <code>@functools.wraps(func)</code>. It copies the metadata and sets <code>__wrapped__</code>, which <code>inspect.signature</code> follows.' },
    { trap: 'The wrapper drops the return value', code: `def audit(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        log.info("call %s", func.__name__)
        func(*args, **kwargs)       # forgot "return"
    return wrapper`, why: 'Every decorated function now returns <code>None</code>. Nothing fails at decoration time; callers break later.', fix: '<code>return func(*args, **kwargs)</code>. Use <code>try/finally</code> if you need code after the call that must run even on exceptions.' },
    { trap: '<code>@retry</code> vs <code>@retry()</code>', code: `def retry(times=3):
    def deco(func): ...
    return deco

@retry          # retry(func): times=func, returns deco
def ping(): ...
ping()          # TypeError: deco() missing 1 required positional argument`, why: 'A decorator factory must be <i>called</i> to get the decorator. Without parentheses, your function is passed as the first config argument.', fix: 'Always write <code>@retry()</code>, or support both forms by checking <code>if callable(times)</code>, or by using keyword-only config: <code>def retry(func=None, *, times=3)</code>.' },
    { trap: 'Side effects at import time', code: `@app.get("/report")
@requires_db(connect("postgres://..."))    # connects when the module is imported
def report(): ...`, why: 'Decorator expressions and factory calls run when the <code>def</code> executes, i.e. at import. Importing the module in a test, a CLI or a migration script then opens connections, reads env vars or registers routes.', fix: 'Keep decorator factories cheap and pure. Resolve resources lazily, at first call or through dependency injection.' },
    { trap: 'A sync wrapper around an <code>async def</code>', code: `@timed                     # sync wrapper
async def fetch(url): ...

await fetch(u)   # timed measured creating the coroutine (~0 ms), not awaiting it`, why: 'Calling an async function only creates a coroutine object. A sync wrapper returns it immediately, so “after” code runs before the real work, and exceptions escape the wrapper’s <code>try</code>.', fix: 'Write an <code>async def wrapper</code> that awaits <code>func</code>, and pick it when <code>inspect.iscoroutinefunction(func)</code> is true.' },
    { trap: '<code>@lru_cache</code> on a method leaks instances', code: `class PriceService:
    @functools.lru_cache(maxsize=None)
    def price(self, sku): ...`, why: 'The cache is shared by the class and keys on <code>(self, sku)</code>, so it holds a strong reference to every instance it ever saw. They are never freed. Ruff rule <code>B019</code> flags this.', fix: 'Use <code>functools.cached_property</code> for per-instance values, cache a module-level function of the real key, or create a per-instance cache in <code>__init__</code>.' },
    { trap: 'Decorator order changes behaviour', code: `@login_required      # wraps the function...
@app.route("/admin") # ...but route already registered the undecorated one
def admin(): ...`, why: 'Decorators apply bottom-up. A registering decorator (routes, CLI commands, event handlers) registers whatever it receives. Anything above it wraps a copy nobody calls.', fix: 'Put registering decorators outermost (top). Read the stack as “top = what callers get”.' }
  ],
  scenarios: [
    { title: 'The admin page was reachable without logging in',
      symptom: 'A penetration test found <code>/admin/export</code> served data to anonymous users, although the view had <code>@login_required</code>.',
      diagnose: `@login_required
@app.route("/admin/export")
def export(): ...

print(app.view_functions["export"] is export.__wrapped__)   # True: the raw view`,
      cause: 'Decorators apply bottom-up. <code>@app.route</code> registered the <b>undecorated</b> function in the URL map, then <code>login_required</code> wrapped it, and the wrapped version was only bound to the module name, which nothing routes to. Flask’s own docs warn the route decorator must be outermost.',
      fix: 'Swap the order so the route decorator is on top, and add a test that requests every admin URL anonymously and expects 302/401.',
      fixCode: `@app.route("/admin/export")
@login_required
def export(): ...` },
    { title: 'Latency metrics showed every async endpoint at 0.02 ms',
      symptom: 'After a migration to async handlers, the p99 latency dashboard dropped to almost zero, while users reported slower pages.',
      diagnose: `def timed(func):
    @functools.wraps(func)
    def wrapper(*a, **kw):
        t0 = time.perf_counter()
        try:
            return func(*a, **kw)          # returns a coroutine, instantly
        finally:
            METRIC.observe(time.perf_counter() - t0)
    return wrapper`,
      cause: 'The wrapper timed the creation of the coroutine object, not its execution. The framework awaited the returned coroutine after the timer had already stopped.',
      fix: 'Make the decorator async-aware.',
      fixCode: `def timed(func):
    if inspect.iscoroutinefunction(func):
        @functools.wraps(func)
        async def awrapper(*a, **kw):
            t0 = time.perf_counter()
            try:
                return await func(*a, **kw)
            finally:
                METRIC.observe(time.perf_counter() - t0)
        return awrapper
    ...  # sync version as before` },
    { title: 'Worker memory grew by ~1 GB a day',
      symptom: 'A long-running worker’s memory grew steadily. Heap snapshots showed millions of <code>RequestContext</code> objects that should have been freed.',
      diagnose: `class RequestContext:
    @functools.lru_cache(maxsize=None)
    def tenant_settings(self):
        return load_settings(self.tenant_id)

# tracemalloc / objgraph: RequestContext referenced from the lru_cache dict`,
      cause: '<code>lru_cache</code> on a method stores <code>self</code> in its keys, in one cache shared by the class, with no size limit. Every request context ever created stayed alive.',
      fix: 'Cache on the real key, at module level and bounded, or use <code>cached_property</code> so the value dies with the instance.',
      fixCode: `@functools.lru_cache(maxsize=1024)
def tenant_settings(tenant_id: str) -> Settings:
    return load_settings(tenant_id)

class RequestContext:
    @functools.cached_property
    def settings(self) -> Settings:
        return tenant_settings(self.tenant_id)` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `def tag(name):
    def deco(fn):
        print("applying", name)
        def wrapper():
            return f"<{name}>{fn()}</{name}>"
        return wrapper
    return deco

@tag("b")
@tag("i")
def hi():
    return "hi"

print(hi())`, options: ['applying b<br>applying i<br>&lt;b&gt;&lt;i&gt;hi&lt;/i&gt;&lt;/b&gt;', 'applying i<br>applying b<br>&lt;b&gt;&lt;i&gt;hi&lt;/i&gt;&lt;/b&gt;', 'applying i<br>applying b<br>&lt;i&gt;&lt;b&gt;hi&lt;/b&gt;&lt;/i&gt;', '&lt;b&gt;&lt;i&gt;hi&lt;/i&gt;&lt;/b&gt;'], answer: 1, run: true, expect: 'applying i\napplying b\n<b><i>hi</i></b>', explain: 'Both factories are called top-down, but the decorators are <b>applied bottom-up</b>: <code>hi = tag("b")(tag("i")(hi))</code>. So “i” is applied first. At call time the outer <code>b</code> wrapper runs first and puts its tags outside.' },
    { kind: 'predict', q: 'What does this print?', code: `registry = []

def register(fn):
    registry.append(fn.__name__)
    return fn

@register
def a():
    pass

print(registry)

@register
def b():
    pass

print(registry)`, options: ["[]<br>[]", "['a']<br>['a', 'b']", "['a', 'b']<br>['a', 'b']", "[]<br>['b']"], answer: 1, run: true, expect: "['a']\n['a', 'b']", explain: 'A decorator runs when the <code>def</code> statement executes (import time for module code), not when the function is called. Neither function is ever called here.' },
    { kind: 'predict', q: 'What does this print?', code: `def deco(fn):
    def wrapper(*args, **kwargs):
        return fn(*args, **kwargs)
    return wrapper

@deco
def add(a, b):
    return a + b

print(add.__name__, add(2, 3))`, options: ['add 5', 'wrapper 5', 'deco 5', 'fn 5'], answer: 1, run: true, expect: 'wrapper 5', explain: 'The name <code>add</code> is now bound to <code>wrapper</code>, and without <code>functools.wraps</code> it keeps its own metadata.' },
    { kind: 'bug', q: 'What does this print?', code: `def log(fn):
    def wrapper(*args):
        print("calling", fn.__name__)
        fn(*args)
    return wrapper

@log
def double(x):
    return x * 2

print(double(4))`, options: ['calling double<br>8', 'calling double<br>None', '8', 'calling wrapper<br>None'], answer: 1, run: true, expect: 'calling double\nNone', explain: 'The wrapper calls <code>fn</code> but doesn’t <code>return</code> its result, so every decorated call returns <code>None</code>. <code>fn.__name__</code> is the original’s name, because it reads the wrapped function.' },
    { kind: 'predict', q: 'What does this print?', code: `import functools

def count_calls(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        wrapper.calls += 1
        return fn(*args, **kwargs)
    wrapper.calls = 0
    return wrapper

@count_calls
def f():
    pass

f(); f(); f()
print(f.calls, f.__name__)`, options: ['0 f', '3 wrapper', '3 f', 'AttributeError'], answer: 2, run: true, expect: '3 f', explain: 'Functions are objects and can hold attributes, so <code>wrapper.calls</code> is per-decorated-function state. <code>wraps</code> copied <code>__name__</code>, so it reports <code>f</code>.' },
    { kind: 'predict', q: 'What does this print?', code: `from functools import lru_cache

@lru_cache
def total(xs):
    return sum(xs)

print(total((1, 2, 3)))
try:
    total([1, 2, 3])
except TypeError:
    print("unhashable")`, options: ['6<br>6', '6<br>unhashable', 'unhashable<br>unhashable', '6'], answer: 1, run: true, expect: '6\nunhashable', explain: '<code>lru_cache</code> builds a dict key from the arguments, so every argument must be hashable. A tuple works; a list raises <code>TypeError</code> before the function body runs. (Bare <code>@lru_cache</code> without parentheses is allowed since 3.8.)' },
    { kind: 'predict', q: 'What does this print?', code: `def add_repr(cls):
    cls.__repr__ = lambda self: f"{cls.__name__}({vars(self)})"
    return cls

@add_repr
class P:
    def __init__(self):
        self.x = 1

print(P())`, options: ["P({'x': 1})", '&lt;__main__.P object at 0x…&gt;', 'P(x=1)', 'TypeError'], answer: 0, run: true, expect: "P({'x': 1})", explain: 'A class decorator receives the class object and can modify (or replace) it. Here it adds a <code>__repr__</code>; <code>vars(self)</code> is the instance <code>__dict__</code>. <code>@dataclass</code> works the same way, at much larger scale.' },
    { kind: 'bug', q: 'Someone forgot the parentheses. What does this print?', code: `def retry(times=3):
    def deco(fn):
        def wrapper(*a):
            return fn(*a)
        return wrapper
    return deco

@retry
def ping():
    return "pong"

print(ping.__name__)`, options: ['ping', 'wrapper', 'deco', 'retry'], answer: 2, run: true, expect: 'deco', explain: '<code>@retry</code> means <code>ping = retry(ping)</code>: the function becomes the <code>times</code> argument, and the factory returns <code>deco</code>. Calling <code>ping()</code> would now fail with a TypeError about a missing <code>fn</code> argument.' }
  ],
  interview: [
    { q: 'What exactly does <code>@decorator</code> do?', a: '<p>When the <code>def</code> (or <code>class</code>) statement runs, Python evaluates the decorator expression, builds the function object, calls the decorator with it, and binds the name to whatever it returns. <code>@d def f</code> is <code>f = d(f)</code>, except that the name is never bound to the undecorated function. Since 3.9 the decorator can be any expression (PEP 614).</p>', lvl: 'core' },
    { q: 'Write a decorator that takes arguments.', a: '<p>Three levels: the factory takes config and returns the decorator; the decorator takes the function and returns the wrapper; the wrapper takes the call’s arguments.</p><pre>def retry(times=3):\n    def decorator(func):\n        @functools.wraps(func)\n        def wrapper(*args, **kwargs):\n            for i in range(times):\n                try:\n                    return func(*args, **kwargs)\n                except Exception:\n                    if i == times - 1:\n                        raise\n        return wrapper\n    return decorator</pre>', fu: 'How would you support both <code>@retry</code> and <code>@retry(times=5)</code>?', lvl: 'core' },
    { q: 'What does <code>functools.wraps</code> copy, and why does it matter?', a: '<p>By default <code>__module__</code>, <code>__name__</code>, <code>__qualname__</code>, <code>__doc__</code>, <code>__annotations__</code> (and <code>__type_params__</code> since 3.12), merges <code>__dict__</code>, and sets <code>__wrapped__</code>. That keeps logs, tracebacks and docs honest, and lets <code>inspect.signature</code> report the real parameters. FastAPI, Click and pytest rely on the signature, so a decorator without <code>wraps</code> can break dependency injection or fixtures.</p>', lvl: 'core' },
    { q: 'In what order do stacked decorators run?', a: '<p>Three different orders. Decorator <b>expressions</b> are evaluated top to bottom. They are <b>applied</b> bottom to top (nearest first). At <b>call</b> time the outermost (top) wrapper runs first. So <code>@a @b def f</code> gives <code>a(b(f))</code>, and a call enters a’s wrapper, then b’s, then f.</p>', lvl: 'core' },
    { q: 'How do you type-hint a decorator so the decorated function keeps its signature?', a: '<p>Use <code>ParamSpec</code>. With the 3.12 syntax: <code>def logged[**P, R](func: Callable[P, R]) -> Callable[P, R]</code>, and annotate the wrapper as <code>def wrapper(*args: P.args, **kwargs: P.kwargs) -> R</code>. To add a parameter, use <code>Concatenate</code>. Before 3.12, declare <code>P = ParamSpec("P")</code> and <code>R = TypeVar("R")</code>.</p>', lvl: 'deep' },
    { q: 'How does a decorator on a method get <code>self</code>?', a: '<p>The wrapper is a plain function stored in the class, so it is still a descriptor: attribute access binds it, and <code>self</code> arrives as the first positional argument in <code>*args</code>. If your decorator returns a non-function callable (an instance of a class with <code>__call__</code>), it loses that binding unless you implement <code>__get__</code>.</p>', lvl: 'deep' },
    { q: 'What are class decorators used for? How do they compare with metaclasses?', a: '<p>They receive the finished class and can add methods, register it, or validate it: <code>@dataclass</code>, <code>@functools.total_ordering</code>, <code>@enum.unique</code>, plugin registries. They are simpler and more explicit than metaclasses, and don’t propagate to subclasses. Use <code>__init_subclass__</code> when you do want subclasses handled automatically; metaclasses are rarely needed.</p>', lvl: 'core' },
    { q: 'How do you decorate async functions correctly?', a: '<p>Return an <code>async def</code> wrapper that <code>await</code>s the original. Detect with <code>inspect.iscoroutinefunction(func)</code> and choose a sync or async wrapper. A sync wrapper returns the coroutine unawaited, so timing, try/except and “after” logic run at the wrong time.</p>', lvl: 'core' },
    { q: 'How do Python decorators relate to Spring annotations like <code>@Transactional</code>?', a: '<p>Spring annotations are passive metadata; a framework creates a <b>proxy</b> at startup that applies the behaviour. Calls through the proxy get it; self-invocation (<code>this.method()</code>) bypasses it. A Python decorator <i>replaces the function object itself</i>, so every call, including from the same class, goes through the wrapper. The flip side: there is no container deciding when, so order and import time matter.</p>', lvl: 'core' },
    { q: 'How would you test a decorated function without its decorator?', a: '<p>If the decorator used <code>functools.wraps</code>, the original is at <code>func.__wrapped__</code> (and <code>inspect.unwrap</code> follows the whole chain). Otherwise, design decorators to be configurable (a no-op mode), or test the undecorated function by keeping it importable under another name.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Typed retry (3.12 syntax)', lang: 'python', code: `import functools
import inspect
import logging
import time
from collections.abc import Callable

log = logging.getLogger(__name__)

def retry[**P, R](
    times: int = 3,
    on: tuple[type[BaseException], ...] = (TimeoutError, ConnectionError),
    backoff: float = 0.2,
) -> Callable[[Callable[P, R]], Callable[P, R]]:
    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        if inspect.iscoroutinefunction(func):
            raise TypeError("use aretry for async functions")

        @functools.wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            for attempt in range(1, times + 1):
                try:
                    return func(*args, **kwargs)
                except on as exc:
                    if attempt == times:
                        raise
                    log.warning("%s failed (%r), retry %d/%d",
                                func.__qualname__, exc, attempt, times)
                    time.sleep(backoff * 2 ** (attempt - 1))
            raise AssertionError("unreachable")
        return wrapper
    return decorator

@retry(times=4, on=(TimeoutError,))
def fetch_rates(currency: str) -> dict[str, float]: ...`, note: '<code>[**P, R]</code> is the PEP 695 type-parameter syntax (3.12+). Type checkers now know <code>fetch_rates</code> still takes <code>(currency: str)</code>. In production, prefer a maintained library such as <code>tenacity</code>.' },
    { title: 'Plugin registry', lang: 'python', code: `from collections.abc import Callable
from typing import Any

Handler = Callable[[dict[str, Any]], None]
_HANDLERS: dict[str, Handler] = {}

def on_event(name: str) -> Callable[[Handler], Handler]:
    def register(fn: Handler) -> Handler:
        if name in _HANDLERS:
            raise ValueError(f"duplicate handler for {name}")
        _HANDLERS[name] = fn
        return fn                       # unchanged: easy to unit test
    return register

@on_event("invoice.paid")
def send_receipt(event: dict[str, Any]) -> None: ...

def dispatch(event: dict[str, Any]) -> None:
    _HANDLERS[event["type"]](event)`, note: 'Registration happens when the module is imported, so the dispatcher must import every handler module (an explicit list, or <code>importlib</code> over a package).' },
    { title: 'Java comparison', lang: 'java', code: `// Spring: the annotation is metadata; a proxy applies the behaviour.
@Service
class RateService {
    @Retryable(retryFor = TimeoutException.class, maxAttempts = 4)
    public Rates fetch(String ccy) { ... }

    public Rates fetchTwice(String ccy) {
        return this.fetch(ccy);   // self-invocation: bypasses the proxy, NO retry
    }
}
// Python: @retry replaces the function object itself, so
// self.fetch(...) inside the class is retried too.`, note: 'The mental shift: Python decorators are plain function calls at definition time, not instructions to a container.' }
  ]
});

/* Tricky Python: a timed drill of predict-the-output and concept questions across the whole Python track.
   Programs marked run: true are complete scripts; `expect` is their exact stdout under python3 (3.12). */
IA.widget('tricky-python', (root, ctx) => {
  const { el, reduced } = ctx;
  /*Q-START*/
  const Q = [
    // ---------- M0 · Language core ----------
    { m: 'Core', t: 'Everything is an object', s: 'data-model', q: 'What does this print?', code: `a = [1, 2, 3]
b = a
a += [4]
c = a
c = c + [5]
print(b, c)`, o: ['[1, 2, 3] [1, 2, 3, 4, 5]', '[1, 2, 3, 4] [1, 2, 3, 4, 5]', '[1, 2, 3, 4, 5] [1, 2, 3, 4, 5]', '[1, 2, 3, 4] [1, 2, 3, 4]'], a: 1, run: true, expect: '[1, 2, 3, 4] [1, 2, 3, 4, 5]', x: 'For lists, <code>+=</code> mutates in place (<code>__iadd__</code>, like <code>extend</code>), so <code>b</code>, which names the same list, sees the 4. <code>c + [5]</code> builds a <b>new</b> list and rebinds only <code>c</code>.' },
    { m: 'Core', t: 'Everything is an object', s: 'data-model', q: 'What does this print?', code: `t = ([1],)
try:
    t[0] += [2]
except TypeError:
    print("TypeError", t)`, o: ['TypeError ([1],)', 'TypeError ([1, 2],)', '([1, 2],)', 'Nothing: it works'], a: 1, run: true, expect: 'TypeError ([1, 2],)', x: '<code>t[0] += [2]</code> is “get item, <code>__iadd__</code>, set item”. The list is extended in place first, then storing back into the tuple raises. The error happens <i>after</i> the mutation.' },
    { m: 'Core', t: 'Everything is an object', s: 'data-model', q: 'What does this print?', code: `print(0.1 + 0.2 == 0.3, round(2.5), round(0.5), round(1.5))`, o: ['True 3 1 2', 'False 2 0 2', 'False 3 1 2', 'False 2 1 2'], a: 1, run: true, expect: 'False 2 0 2', x: 'Binary floats can’t represent 0.1 exactly. <code>round()</code> uses round-half-to-even (“banker’s rounding”): 2.5 → 2, 0.5 → 0, 1.5 → 2. Use <code>decimal.Decimal</code> with an explicit rounding mode for money.' },
    { m: 'Core', t: 'Scope, closures & defaults', s: 'scoping-closures', q: 'What does this print?', code: `fs = [lambda: i for i in range(3)]
print([f() for f in fs])`, o: ['[0, 1, 2]', '[2, 2, 2]', '[3, 3, 3]', 'NameError'], a: 1, run: true, expect: '[2, 2, 2]', x: 'Closures capture <b>variables</b>, not values, and look them up when called. All three lambdas see the comprehension’s single <code>i</code>, which ended at 2. Fix: <code>lambda i=i: i</code>.' },
    { m: 'Core', t: 'Scope, closures & defaults', s: 'scoping-closures', q: 'What does this print?', code: `count = 0

def inc():
    try:
        count += 1
    except UnboundLocalError:
        print("UnboundLocalError")

inc()
print(count)`, o: ['1', 'UnboundLocalError\n0', 'UnboundLocalError\n1', 'NameError'], a: 1, run: true, expect: 'UnboundLocalError\n0', x: 'Any assignment to a name in a function makes it local for the <b>whole</b> function (decided at compile time). <code>count += 1</code> reads the local before it has a value. Use <code>global count</code>, or better, return the new value.' },
    { m: 'Core', t: 'Dunder methods & protocols', s: 'dunder-methods', q: 'What does this print?', code: `class P:
    def __init__(self, x):
        self.x = x
    def __eq__(self, other):
        return self.x == other.x

try:
    {P(1)}
except TypeError:
    print("unhashable")
print(P(1) == P(1))`, o: ['True', 'unhashable\nTrue', 'unhashable\nFalse', '{P}\nTrue'], a: 1, run: true, expect: 'unhashable\nTrue', x: 'Defining <code>__eq__</code> without <code>__hash__</code> sets <code>__hash__ = None</code>, because the default identity hash would break the rule “equal objects have equal hashes”. Define <code>__hash__</code> over the same fields, or use <code>@dataclass(frozen=True)</code>.' },
    { m: 'Core', t: 'Dunder methods & protocols', s: 'dunder-methods', q: 'What does this print?', code: `class Box:
    def __len__(self):
        return 0

print(bool(Box()), "yes" if Box() else "no")`, o: ['True yes', 'False no', 'True no', 'TypeError'], a: 1, run: true, expect: 'False no', x: 'Truthiness calls <code>__bool__</code>, and if it is missing, <code>__len__</code>: length 0 is false. This is why <code>if items:</code> works for empty containers, and why a container object can be unexpectedly falsy.' },
    { m: 'Core', t: 'Iterators & generators', s: 'iterators-generators', q: 'What does this print?', code: `nums = (x * x for x in range(4))
print(sum(nums), sum(nums))`, o: ['14 14', '14 0', '30 0', 'TypeError'], a: 1, run: true, expect: '14 0', x: 'A generator is a one-shot iterator. The first <code>sum</code> consumes it (0+1+4+9 = 14); the second finds it exhausted. Use a list, or a function that returns a fresh generator, if you need two passes.' },
    { m: 'Core', t: 'Iterators & generators', s: 'iterators-generators', q: 'In what order do the lines print?', code: `def gen():
    print("start")
    yield 1
    print("end")

g = gen()
print("created")
print(next(g))`, o: ['start\ncreated\n1', 'created\nstart\n1', 'created\nstart\n1\nend', 'start\n1\ncreated'], a: 1, run: true, expect: 'created\nstart\n1', x: 'Calling a generator function runs <b>none</b> of its body; it just creates the generator. <code>next()</code> runs it to the first <code>yield</code>. “end” would only print on the next <code>next()</code>, which then raises <code>StopIteration</code>.' },
    { m: 'Core', t: 'Iterators & generators', s: 'iterators-generators', q: 'What does this print?', code: `it = iter([1, 2, 3, 4, 5])
print(list(zip(it, it)))`, o: ['[(1, 1), (2, 2), (3, 3), (4, 4), (5, 5)]', '[(1, 2), (3, 4)]', '[(1, 2), (3, 4), (5, None)]', '[(1, 2), (3, 4), (5,)]'], a: 1, run: true, expect: '[(1, 2), (3, 4)]', x: 'Both arguments are the <b>same</b> iterator, so <code>zip</code> pulls alternately: (1, 2), (3, 4), then 5 with nothing to pair, and it stops. A known idiom for chunking; 3.12 adds <code>itertools.batched</code> for it.' },
    { m: 'Core', t: 'Decorators', s: 'decorators', q: 'What does this print?', code: `def deco(name):
    def wrap(fn):
        print("decorating with", name)
        return fn
    return wrap

@deco("outer")
@deco("inner")
def f():
    pass

print("defined")`, o: ['decorating with outer\ndecorating with inner\ndefined', 'decorating with inner\ndecorating with outer\ndefined', 'defined', 'defined\ndecorating with inner\ndecorating with outer'], a: 1, run: true, expect: 'decorating with inner\ndecorating with outer\ndefined', x: 'Decorators run when the <code>def</code> executes, not when <code>f</code> is called, and they are <b>applied bottom-up</b>: <code>f = deco("outer")(deco("inner")(f))</code>.' },
    { m: 'Core', t: 'Decorators', s: 'decorators', q: 'What does this print?', code: `import functools

def twice(fn):
    @functools.wraps(fn)
    def w(*a):
        return fn(fn(*a))
    return w

@twice
def inc(x):
    return x + 1

print(inc(1), inc.__name__, inc.__wrapped__(1))`, o: ['2 inc 2', '3 w 2', '3 inc 2', '3 inc 3'], a: 2, run: true, expect: '3 inc 2', x: 'The wrapper applies <code>inc</code> twice: 1 → 2 → 3. <code>functools.wraps</code> copies the name and sets <code>__wrapped__</code> to the original, undecorated function, handy for testing it alone.' },
    { m: 'Core', t: 'Context managers', s: 'context-managers', q: 'What does this print?', code: `class Quiet:
    def __enter__(self):
        return self
    def __exit__(self, et, ev, tb):
        return True

with Quiet():
    raise ValueError("x")
    print("unreachable")
print("after")`, o: ['ValueError: x', 'unreachable\nafter', 'after', 'Nothing'], a: 2, run: true, expect: 'after', x: 'A truthy return from <code>__exit__</code> <b>suppresses</b> the exception. The rest of the block is skipped and execution continues after the <code>with</code>. Accidentally returning True (or a truthy value) silently swallows errors.' },
    { m: 'Core', t: 'Context managers', s: 'context-managers', q: 'What does this print?', code: `from contextlib import contextmanager

@contextmanager
def resource():
    print("open")
    yield
    print("close")

try:
    with resource():
        raise RuntimeError
except RuntimeError:
    print("caught")`, o: ['open\nclose\ncaught', 'open\ncaught', 'open\ncaught\nclose', 'caught'], a: 1, run: true, expect: 'open\ncaught', x: 'The exception is thrown into the generator <b>at the <code>yield</code></b>. Without <code>try/finally</code> around the yield, the cleanup line never runs. Always write <code>try: yield … finally: cleanup</code>.' },
    { m: 'Core', t: 'Type hints', s: 'typing', q: 'What does this print?', code: `def double(x: int) -> int:
    return x * 2

print(double("ab"), double.__annotations__["x"].__name__)`, o: ['TypeError', 'abab int', '4 int', 'abab str'], a: 1, run: true, expect: 'abab int', x: 'Annotations are stored as metadata (<code>__annotations__</code>) and never enforced by the interpreter. Only static checkers (mypy, pyright) or runtime validators (Pydantic) act on them.' },
    { m: 'Core', t: 'Type hints', s: 'typing', q: 'What does this print?', code: `try:
    print(isinstance([1], list[int]))
except TypeError:
    print("TypeError")
print(isinstance([1], list))`, o: ['True\nTrue', 'TypeError\nTrue', 'False\nTrue', 'TypeError\nTypeError'], a: 1, run: true, expect: 'TypeError\nTrue', x: 'Parameterized generics such as <code>list[int]</code> exist for type checkers; <code>isinstance</code> refuses them (“cannot be a parameterized generic”), because checking every element isn’t what <code>isinstance</code> does. Check the origin type, or validate with Pydantic.' },
    { m: 'Core', t: 'Dataclasses & Pydantic', s: 'dataclasses-pydantic', q: 'What does this print?', code: `from dataclasses import dataclass

try:
    @dataclass
    class C:
        tags: list = []
except ValueError:
    print("ValueError")`, o: ['Nothing', 'ValueError', 'TypeError', 'C(tags=[])'], a: 1, run: true, expect: 'ValueError', x: '<code>@dataclass</code> refuses unhashable mutable defaults (list, dict, set) at class creation: “mutable default … is not allowed: use default_factory”. Write <code>tags: list = field(default_factory=list)</code>.' },
    { m: 'Core', t: 'Dataclasses & Pydantic', s: 'dataclasses-pydantic', q: 'What does this print?', code: `from dataclasses import dataclass

@dataclass(frozen=True)
class P:
    x: int
    y: int = 0

print(P(1) == P(1, 0), len({P(1), P(1, 0)}), P(1))`, o: ['False 2 P(x=1)', 'True 1 P(x=1, y=0)', 'True 2 P(x=1, y=0)', 'TypeError: unhashable'], a: 1, run: true, expect: 'True 1 P(x=1, y=0)', x: '<code>eq=True</code> (the default) compares fields as a tuple; <code>frozen=True</code> together with eq generates <code>__hash__</code>, so instances work in sets. The generated <code>__repr__</code> lists every field.' },
    { m: 'Core', t: 'Dataclasses & Pydantic', s: 'dataclasses-pydantic', q: 'Pydantic v2, <code>class Order(BaseModel): qty: int</code>. What happens?', code: `Order(qty="3").qty
Order.model_validate({"qty": "3"}, strict=True)`, o: ['"3" (a str), then ValidationError', '3 (an int), then ValidationError', '3, then 3', 'ValidationError, then ValidationError'], a: 1, x: 'Default (lax) mode coerces a numeric string to <code>int</code>. Strict mode, per call, per field or per model, accepts only real ints. Choose strict at boundaries where silent coercion would hide client bugs.' },
    // ---------- M1 · Internals ----------
    { m: 'Internals', t: 'Memory & garbage collection', s: 'memory-gc', q: 'What does this print (CPython)?', code: `import weakref

class Node:
    pass

n = Node()
r = weakref.ref(n)
print(r() is n)
del n
print(r())`, o: ['True\n<__main__.Node object …>', 'True\nNone', 'False\nNone', 'TypeError'], a: 1, run: true, expect: 'True\nNone', x: 'A weak reference doesn’t keep its target alive. When the last strong reference goes, CPython’s reference counting frees the object immediately, and the weakref then returns <code>None</code>. (Other implementations may free it later.)' },
    { m: 'Internals', t: 'Memory & garbage collection', s: 'memory-gc', q: '<code>a = Node(); a.me = a; del a</code>. When is the object freed in CPython?', o: ['Immediately, by reference counting', 'Never: it leaks forever', 'Later, when the cyclic garbage collector runs', 'At interpreter exit only'], a: 2, x: 'The self-reference keeps its refcount at 1, so reference counting alone can’t free it. The generational cyclic GC finds unreachable cycles and frees them, after enough allocations trigger a collection, or on <code>gc.collect()</code>.' },
    { m: 'Internals', t: 'The GIL & free-threading', s: 'gil', q: 'Four threads each run <code>counter += 1</code> 100,000 times on a shared global, without a lock, on CPython 3.12. Final value?', o: ['Always exactly 400,000: the GIL makes += atomic', 'Not guaranteed: updates can be lost, so use a Lock', 'Always 100,000', 'A RuntimeError is raised'], a: 1, x: '<code>counter += 1</code> compiles to several bytecodes (load, add, store), and a thread switch can happen between them. The GIL protects the interpreter’s internals, not your read-modify-write. Lost updates may be rare in a given version, but correctness needs a <code>threading.Lock</code>.' },
    { m: 'Internals', t: 'The GIL & free-threading', s: 'gil', q: 'How do you run Python 3.13 without the GIL?', o: ['python -X nogil', 'Use the separately built free-threaded interpreter (often python3.13t)', 'Call sys.setgil(False)', 'It is the default in 3.13'], a: 1, x: 'PEP 703’s free-threaded build is a different build of CPython (experimental in 3.13, officially supported since 3.14, still not the default). The standard build always has a GIL. On the free-threaded build the GIL can be re-enabled with <code>PYTHON_GIL=1</code> or <code>-X gil=1</code>, and C extensions that aren’t marked as safe re-enable it automatically.' },
    { m: 'Internals', t: 'Dict & set internals', s: 'dict-internals', q: 'What does this print?', code: `print({1: "a", 1.0: "b", True: "c"})`, o: ["{1: 'a', 1.0: 'b', True: 'c'}", "{1: 'c'}", "{True: 'c'}", "{1: 'a'}"], a: 1, run: true, expect: "{1: 'c'}", x: '<code>1 == 1.0 == True</code> and their hashes are equal, so they are the <b>same key</b>. The first key object inserted is kept; each later assignment only replaces the value.' },
    { m: 'Internals', t: 'Dict & set internals', s: 'dict-internals', q: 'What does this print?', code: `d = {"a": 1, "b": 2}
try:
    for k in d:
        d[k + "!"] = 0
except RuntimeError:
    print("RuntimeError")
print(len(d))`, o: ['4', 'RuntimeError\n3', 'RuntimeError\n2', 'An infinite loop'], a: 1, run: true, expect: 'RuntimeError\n3', x: 'Adding a key while iterating changes the dict’s size, and the iterator detects it on its next step: “dictionary changed size during iteration”. One key (<code>a!</code>) had already been added. Iterate over <code>list(d)</code> to modify safely.' },
    { m: 'Internals', t: 'Import system', s: 'imports', q: 'What does this print?', code: `import pathlib, sys, tempfile

d = tempfile.mkdtemp()
pathlib.Path(d, "cfg.py").write_text("print('loading cfg')\\nvalue = 1\\n")
sys.path.insert(0, d)

import cfg
import cfg
cfg.value += 1
import cfg as again
print(again.value, "cfg" in sys.modules)`, o: ['loading cfg\nloading cfg\nloading cfg\n1 True', 'loading cfg\n2 True', 'loading cfg\n1 True', '2 False'], a: 1, run: true, expect: 'loading cfg\n2 True', x: 'A module executes <b>once</b> per process; later imports return the cached object from <code>sys.modules</code>. That is why modules work as singletons, and why mutating module state is visible to every importer.' },
    { m: 'Internals', t: 'Import system', s: 'imports', q: '<code>a.py</code> is <code>print("a runs"); import b; X = 1</code>, and <code>b.py</code> is <code>from a import X</code>. You run <code>python a.py</code>. How many times is “a runs” printed?', o: ['Once', 'Twice', 'Zero: ImportError first', 'An infinite import loop'], a: 1, x: 'The script runs as <code>__main__</code>, not as <code>a</code>. When <code>b</code> imports <code>a</code>, Python finds no module named <code>a</code> in <code>sys.modules</code> and executes <code>a.py</code> again under that name. Two copies of every global exist. Keep entry-point scripts thin and run packages with <code>python -m</code>.' },
    // ---------- M2 · Concurrency ----------
    { m: 'Concurrency', t: 'Threads vs processes', s: 'threading-multiprocessing', q: 'What does this print?', code: `import threading

local = threading.local()
local.x = "main"

def worker():
    print(getattr(local, "x", "unset"))

t = threading.Thread(target=worker)
t.start()
t.join()
print(local.x)`, o: ['main\nmain', 'unset\nmain', 'unset\nunset', 'AttributeError'], a: 1, run: true, expect: 'unset\nmain', x: 'Attributes on a <code>threading.local</code> are per thread: the worker sees its own empty namespace. In asyncio code use <code>contextvars</code> instead, because many tasks share one thread.' },
    { m: 'Concurrency', t: 'Threads vs processes', s: 'threading-multiprocessing', q: '<code>ProcessPoolExecutor().map(lambda x: x * 2, range(10))</code>: what happens when you consume the results?', o: ['[0, 2, 4, …] computed in parallel', 'A pickling error: the lambda can’t be sent to worker processes', 'It silently falls back to threads', 'A deadlock'], a: 1, x: 'Work is sent to other processes by pickling, and functions are pickled <b>by reference</b> (module + qualified name). A lambda or nested function has no importable name. Use a module-level <code>def</code>.' },
    { m: 'Concurrency', t: 'asyncio event loop', s: 'asyncio', q: 'What does this print on stdout?', code: `import asyncio

async def work():
    print("working")

async def main():
    work()               # forgot await
    print("done")

asyncio.run(main())`, o: ['working\ndone', 'done', 'done\nworking', 'Nothing: SyntaxError'], a: 1, run: true, expect: 'done', x: 'Calling an <code>async def</code> only creates a coroutine object; nothing runs until it is awaited or scheduled. Python prints “RuntimeWarning: coroutine \'work\' was never awaited” on stderr when the object is garbage-collected.' },
    { m: 'Concurrency', t: 'asyncio event loop', s: 'asyncio', q: 'In what order do the lines print?', code: `import asyncio

async def job(n):
    print("start", n)
    await asyncio.sleep(0)
    print("end", n)

async def main():
    t = asyncio.create_task(job(1))
    print("created")
    await job(2)
    await t

asyncio.run(main())`, o: ['start 1\ncreated\nstart 2\nend 1\nend 2', 'created\nstart 2\nstart 1\nend 2\nend 1', 'created\nstart 2\nend 2\nstart 1\nend 1', 'created\nstart 1\nstart 2\nend 1\nend 2'], a: 1, run: true, expect: 'created\nstart 2\nstart 1\nend 2\nend 1', x: '<code>create_task</code> schedules job 1 but doesn’t run it. <code>await job(2)</code> runs job 2 directly (no new task) until its <code>sleep(0)</code> yields; then the loop runs the ready task, job 1, until it yields; then they finish in the same FIFO order.' },
    { m: 'Concurrency', t: 'Choosing a concurrency model', s: 'concurrency-choice', q: 'An agent service makes thousands of concurrent LLM and HTTP calls that each wait 1–20 s, with little CPU work. Best default model?', o: ['One thread per request', 'asyncio with async clients', 'multiprocessing with one process per call', 'Busy-polling in a loop'], a: 1, x: 'Mostly waiting, high concurrency: asyncio handles thousands of in-flight waits on one thread with tiny per-task cost. Threads would need thousands of OS threads; processes would be far heavier still.' },
    { m: 'Concurrency', t: 'Choosing a concurrency model', s: 'concurrency-choice', q: 'Inside a FastAPI service you must resize large images in pure Python (CPU-bound, ~2 s each). Where should that work run?', o: ['Directly in an async def endpoint', 'In a def endpoint, so it uses the threadpool', 'In a process pool or a separate job worker', 'In asyncio.gather with many tasks'], a: 2, x: 'CPU-bound Python holds the GIL, so the event loop and the threadpool both serialise it, and in <code>async def</code> it also blocks every request. Processes run it in parallel; a job queue also keeps request latency independent of the work.' },
    // ---------- M3 · Practice ----------
    { m: 'Practice', t: 'Packaging & environments', s: 'packaging', q: 'What does this print?', code: `print(sorted(["1.10", "1.9", "1.2"]))`, o: ["['1.2', '1.9', '1.10']", "['1.10', '1.2', '1.9']", "['1.9', '1.2', '1.10']", "['1.10', '1.9', '1.2']"], a: 1, run: true, expect: "['1.10', '1.2', '1.9']", x: 'Strings sort character by character, and <code>"1" &lt; "2" &lt; "9"</code>, so 1.10 comes first. Compare versions with <code>packaging.version.Version</code>, and Python versions with <code>sys.version_info</code> tuples.' },
    { m: 'Practice', t: 'Packaging & environments', s: 'packaging', q: 'Which version satisfies <code>httpx~=0.27.0</code>?', o: ['0.28.0', '0.27.2', '0.26.9', '1.0.0'], a: 1, x: '<code>~=0.27.0</code> means <code>&gt;=0.27.0, ==0.27.*</code>: patch releases only. <code>~=0.27</code> would allow any <code>0.x</code> from 0.27 up, including 0.28, which for a 0.x library may break APIs.' },
    { m: 'Practice', t: 'Testing with pytest', s: 'pytest', q: 'What does this print?', code: `import json
from json import dumps
from unittest.mock import patch

def save(obj):
    return dumps(obj)

with patch("json.dumps", return_value="MOCK"):
    print(save({"a": 1}), json.dumps({}))`, o: ['MOCK MOCK', '{"a": 1} MOCK', '{"a": 1} {}', 'MOCK {}'], a: 1, run: true, expect: '{"a": 1} MOCK', x: '<code>patch</code> replaces the attribute <code>dumps</code> on the <code>json</code> module. <code>save</code> uses the name <code>dumps</code> bound in <i>this</i> module by <code>from json import dumps</code>, which still points at the original. Patch where the name is looked up.' },
    { m: 'Practice', t: 'Testing with pytest', s: 'pytest', q: 'A test has <code>@pytest.mark.parametrize("a", [1, 2, 3])</code> and <code>@pytest.mark.parametrize("b", ["x", "y"])</code>, and uses a function-scoped fixture. How many times is the fixture set up?', o: ['1', '2', '5', '6'], a: 3, x: 'Stacked parametrize marks multiply: 3 × 2 = 6 test items, and a function-scoped fixture is created for each item.' },
    { m: 'Practice', t: 'Profiling & performance', s: 'performance', q: 'What does this print?', code: `calls = 0

def default():
    global calls
    calls += 1
    return 0

d = {"x": 1}
for _ in range(5):
    d.get("x", default())
print(calls)`, o: ['0', '1', '5', 'TypeError'], a: 2, run: true, expect: '5', x: 'Arguments are evaluated before the call, so <code>default()</code> runs every time even though the key exists. With an expensive default (a DB call, a big object) this is real waste. Use <code>d["x"] if "x" in d else default()</code>, or <code>defaultdict</code>.' },
    { m: 'Practice', t: 'Profiling & performance', s: 'performance', q: 'In cProfile output, <code>render()</code> has <code>tottime 0.01</code> and <code>cumtime 4.20</code>. What does that tell you?', o: ['render itself is slow', 'Almost all the time is in functions render calls', 'render was called 420 times', 'The profiler overhead is 4.19 s'], a: 1, x: '<code>tottime</code> excludes callees; <code>cumtime</code> includes them. A big gap means the cost is below: sort by <code>tottime</code> (or open the call tree) to find the callee doing the work.' },
    { m: 'Practice', t: 'FastAPI services', s: 'fastapi', q: '<code>@app.get("/users/{user_id}")</code> with <code>user_id: int</code> is declared before <code>@app.get("/users/me")</code>. What does <code>GET /users/me</code> return?', o: ['The /users/me handler’s response', '404', '422: user_id is not a valid integer', '307 redirect'], a: 2, x: 'Routes are matched in declaration order by path pattern, so <code>/users/{user_id}</code> wins, and validating <code>"me"</code> as an int fails with 422. Declare fixed paths first.' },
    { m: 'Practice', t: 'FastAPI services', s: 'fastapi', q: 'One worker; a plain <code>def</code> endpoint does <code>time.sleep(1)</code>; 100 requests arrive together. Roughly when does the last one finish (default settings)?', o: ['~1 s', '~3 s', '~40 s', '~100 s'], a: 1, x: 'Sync endpoints run in AnyIO’s threadpool, capped at 40 concurrent threads by default: 40 + 40 + 20 ≈ 3 s. As <code>async def</code> with <code>time.sleep</code> it would be ~100 s (the loop is blocked); with <code>await asyncio.sleep(1)</code>, ~1 s.' },
    { m: 'Practice', t: 'Exceptions & logging', s: 'errors-logging', q: 'What does this print?', code: `try:
    raise ExceptionGroup("g", [ValueError("a"), TypeError("b"), ValueError("c")])
except* ValueError as eg:
    print(len(eg.exceptions), eg.message)
except* TypeError:
    print("type")`, o: ['1 a\n1 c\ntype', '2 g\ntype', '2 g', '3 g'], a: 1, run: true, expect: '2 g\ntype', x: 'Each <code>except*</code> clause runs once with a subgroup of every matching exception, keeping the original message. Unlike <code>except</code>, more than one clause can run for the same raise.' },
    { m: 'Practice', t: 'Exceptions & logging', s: 'errors-logging', q: 'What does this print?', code: `import logging, sys

fmt = logging.Formatter("%(name)s: %(message)s")
for name in ("", "app"):
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(fmt)
    logging.getLogger(name).addHandler(h)

logging.getLogger("app.db").warning("slow query")`, o: ['app.db: slow query', 'app.db: slow query\napp.db: slow query', 'root: slow query', 'Nothing: no level was set'], a: 1, run: true, expect: 'app.db: slow query\napp.db: slow query', x: 'The record propagates from <code>app.db</code> to the handlers of <code>app</code> <b>and</b> of root, so it is emitted twice. Put handlers in one place (usually root), or set <code>propagate = False</code> on the subtree.' },
    { m: 'Practice', t: 'Exceptions & logging', s: 'errors-logging', q: 'What does this print?', code: `try:
    try:
        int("x")
    except ValueError:
        raise KeyError("k")
except KeyError as e:
    print(type(e.__context__).__name__, e.__cause__)`, o: ['NoneType None', 'ValueError None', 'ValueError ValueError', 'KeyError None'], a: 1, run: true, expect: 'ValueError None', x: 'Raising inside an <code>except</code> block links the exceptions implicitly through <code>__context__</code> (“During handling of the above exception…”). <code>__cause__</code> is only set by <code>raise … from …</code>.' },
    { m: 'Practice', t: 'Python for Java developers', s: 'python-for-java-devs', q: 'What does this print?', code: `print(-7 // 2, -7 % 2, 7 // -2)`, o: ['-3 -1 -3', '-4 1 -4', '-3 1 -3', '-4 -1 -4'], a: 1, run: true, expect: '-4 1 -4', x: '<code>//</code> floors (towards −∞) and <code>%</code> follows the divisor’s sign, so <code>a == (a // b) * b + a % b</code>. Java truncates towards zero: <code>-7 / 2 == -3</code> and <code>-7 % 2 == -1</code>.' },
    { m: 'Practice', t: 'Python for Java developers', s: 'python-for-java-devs', q: 'What does this print?', code: `class Config:
    tags = []
    level = 1

a, b = Config(), Config()
a.tags.append("x")
a.level = 2
print(b.tags, b.level, Config.level)`, o: ["[] 1 1", "['x'] 1 1", "['x'] 2 2", "[] 2 1"], a: 1, run: true, expect: "['x'] 1 1", x: 'Both are class attributes. <code>a.tags.append</code> <b>mutates</b> the shared list; <code>a.level = 2</code> <b>assigns</b>, which creates an instance attribute on <code>a</code> only and leaves the class attribute alone.' }
  ];
  /*Q-END*/
  const MODS = ['All', 'Core', 'Internals', 'Concurrency', 'Practice'];
  if (!document.getElementById('w-tpy-style')) {
    document.head.append(el('style', { id: 'w-tpy-style', text: `
.w-tpy-bar { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; margin: 8px 0; }
.w-tpy-bar div { height: 100%; background: var(--accent); }
.w-tpy-bar div.low { background: var(--err); }
.w-tpy-opts { display: grid; gap: 6px; margin-top: 10px; }
.w-tpy-opts button { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 9px; padding: 9px 12px; font-size: 14px; cursor: pointer; overflow-wrap: anywhere; white-space: pre-line; font-family: var(--mono); display: flex; gap: 10px; }
.w-tpy-opts button b { font-family: var(--sans); }
.w-tpy-opts button:hover:not(:disabled) { border-color: var(--accent); }
.w-tpy-opts button.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 15%, transparent); }
.w-tpy-opts button.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 15%, transparent); }
.w-tpy-opts button:disabled { cursor: default; }
.w-tpy-q { font-size: 16px; margin: 6px 0 8px; }
.w-tpy-rev { border-top: 1px solid var(--border); padding: 10px 0; }
.w-tpy-rev:first-child { border-top: 0; }
.w-tpy-rev .ans { white-space: pre-line; font-family: var(--mono); }
.w-tpy-tbl { border-collapse: collapse; width: 100%; font-size: 13px; margin-top: 6px; }
.w-tpy-tbl td, .w-tpy-tbl th { padding: 4px 8px; border-bottom: 1px solid var(--border); text-align: left; }
.w-tpy-tbl td.n { font-family: var(--mono); text-align: right; white-space: nowrap; }
.w-tpy-tbl tr.weak td { color: var(--err); }
.w-tpy-meter { display: inline-block; width: 70px; height: 6px; border-radius: 3px; background: var(--surface-2); border: 1px solid var(--border); vertical-align: middle; overflow: hidden; }
.w-tpy-meter i { display: block; height: 100%; background: var(--ok); }
` }));
  }
  let mod = 'All'; let count = 10; let secs = 60; let gen = 0; let deck = []; let i = 0; let score = 0; let misses = []; let left = 0; let answered = false; let started = false; let tick = null;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segM = seg(MODS.map((t) => [t, t === 'All' ? `All topics (${Q.length})` : `${t} (${Q.filter((q) => q.m === t).length})`]), () => mod, (v) => { mod = v; reset(); }, 'Module');
  const segN = seg([[10, '10 questions'], [25, '25'], [999, `all ${Q.length}`]], () => count, (v) => { count = v; reset(); }, 'Number of questions');
  const segS = seg([[90, 'Slow · 90 s'], [60, 'Normal · 60 s'], [30, 'Fast · 30 s']], () => secs, (v) => { secs = v; reset(); }, 'Time per question');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Start' }); const bStep = el('button', { class: 'btn', text: 'Skip ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const card = el('div', { class: 'card', style: { padding: '14px', marginTop: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segM), el('div', { class: 'w-controls' }, segN, el('span', { class: 'tiny', text: 'time per question' }), segS),
    el('div', { class: 'w-controls' }, bPlay, bStep, bReset), stats, card, narr);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const link = (q) => `<a href="${q.s}.html">${ctx.esc(q.t)}</a>`;
  function shuffle(a) { const r = a.slice(); for (let j = r.length - 1; j > 0; j--) { const m = Math.floor(Math.random() * (j + 1)); [r[j], r[m]] = [r[m], r[j]]; } return r; }
  function renderStats() { stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `question <b>${Math.min(i + 1, deck.length)}</b>/${deck.length}` }), el('span', { class: 'w-stat', html: `score <b>${score}</b>` }), el('span', { class: 'w-stat', html: `missed <b>${misses.length}</b>` }), el('span', { class: 'w-stat', html: `time <b>${started && !answered ? left + ' s' : '–'}</b>` })); }
  function stopTimer() { if (tick) { clearInterval(tick); tick = null; } }
  function show() {
    const q = deck[i]; answered = false; left = secs; card.innerHTML = '';
    const bar = el('div'); const barWrap = el('div', { class: 'w-tpy-bar' }, bar);
    const opts = el('div', { class: 'w-tpy-opts' });
    card.append(el('div', { class: 'w-controls', style: { marginBottom: '0' } }, el('span', { class: 'pill accent', text: q.t }), el('span', { class: 'pill', text: q.m }), q.run ? el('span', { class: 'pill new', text: 'runnable', title: 'a complete program; the answer is its exact output' }) : el('span', { class: 'pill', text: 'concept' }), el('span', { class: 'tiny', text: `#${i + 1}` })), barWrap, el('div', { class: 'w-tpy-q', html: q.q }));
    if (q.code) card.append(ctx.codeBox(q.code, 'python'));
    q.o.forEach((o, j) => { const b = el('button', null, el('b', { text: 'ABCD'[j] + '.' }), el('span', { text: o })); b.addEventListener('click', () => answer(j)); opts.append(b); });
    card.append(opts);
    const paint = () => { bar.style.width = (left / secs) * 100 + '%'; bar.className = left <= 10 ? 'low' : ''; if (!reduced) bar.style.transition = 'width 1s linear'; };
    paint(); renderStats(); say('Predict the output in your head, then pick. Each printed line is shown on its own line. Skip counts as a miss.');
    stopTimer(); const g = gen;
    tick = setInterval(() => { if (g !== gen || answered) { stopTimer(); return; } left--; paint(); renderStats(); if (left <= 0) answer(-1); }, 1000);
    card.opts = opts;
  }
  function answer(j) {
    if (answered || !started) return; answered = true; stopTimer();
    const q = deck[i]; const ok = j === q.a;
    if (ok) score++; else misses.push({ q, j });
    [...card.opts.children].forEach((b, m) => { b.disabled = true; if (m === q.a) b.classList.add('ok'); else if (m === j) b.classList.add('bad'); });
    card.append(el('div', { class: 'pz-exp', html: (j === -1 ? '<b>Time’s up.</b> ' : j === -2 ? '<b>Skipped.</b> ' : ok ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.x + ` <span class="tiny">More: ${link(q)}</span>` }));
    bStep.textContent = i + 1 < deck.length ? 'Next ›' : 'Finish ›'; renderStats();
    say(ok ? 'Correct. Press Next.' : 'Read the explanation, then press Next.');
  }
  function next() {
    if (!started) return;
    if (!answered) { answer(-2); return; }
    i++; bStep.textContent = 'Skip ›';
    if (i >= deck.length) return finish();
    show();
  }
  function finish() {
    started = false; stopTimer(); bStep.disabled = true; bPlay.textContent = '▶ Again'; card.innerHTML = '';
    const by = new Map();
    deck.forEach((q) => { const r = by.get(q.s) || { q, ok: 0, n: 0 }; r.n++; if (!misses.some((m) => m.q === q)) r.ok++; by.set(q.s, r); });
    const pct = deck.length ? Math.round((score / deck.length) * 100) : 0;
    card.append(el('h3', { text: `Score: ${score} / ${deck.length} (${pct}%)`, style: { margin: '0 0 8px' } }));
    const rows = [...by.values()].sort((a, b) => a.ok / a.n - b.ok / b.n || b.n - a.n);
    card.append(el('div', { class: 'tiny', text: 'By topic (weakest first). Click a topic to study it.' }),
      el('table', { class: 'w-tpy-tbl' }, el('tbody', null, rows.map((r) => el('tr', { class: r.ok < r.n ? 'weak' : '' },
        el('td', { html: link(r.q) }), el('td', { class: 'n', text: `${r.ok}/${r.n}` }),
        el('td', null, el('span', { class: 'w-tpy-meter' }, el('i', { style: { width: `${(r.ok / r.n) * 100}%` } }))))))));
    if (misses.length) {
      card.append(el('h4', { text: 'Review your misses', style: { margin: '14px 0 4px' } }));
      misses.forEach(({ q, j }) => { const r = el('div', { class: 'w-tpy-rev' }, el('div', { html: `<span class="pill">${ctx.esc(q.t)}</span> ${q.q}` }));
        if (q.code) r.append(ctx.codeBox(q.code, 'python'));
        r.append(el('div', { class: 'tiny', html: `You: ${j < 0 ? (j === -1 ? 'time ran out' : 'skipped') : '<span class="ans">' + ctx.esc(q.o[j]) + '</span>'} · Correct: <b class="ans">${ctx.esc(q.o[q.a])}</b>` }),
          el('div', { class: 'pz-exp', html: q.x }), el('div', { class: 'tiny', html: `Study: ${link(q)}` }));
        card.append(r); });
    } else card.append(el('p', { text: `No misses. Try all ${Q.length} on Fast.` }));
    renderStats(); say(`Done: ${score}/${deck.length}. ` + (misses.length ? 'Your weakest topics are listed first, and every miss links back to its topic page.' : ''));
  }
  function reset() {
    gen++; stopTimer(); started = false; answered = false; i = 0; score = 0; misses = [];
    const pool = Q.filter((q) => mod === 'All' || q.m === mod); deck = shuffle(pool).slice(0, count);
    bPlay.textContent = '▶ Start'; bStep.textContent = 'Skip ›'; bStep.disabled = true; card.innerHTML = '';
    const topics = new Set(pool.map((q) => q.s)).size;
    card.append(el('p', { html: `<b>${deck.length}</b> question${deck.length === 1 ? '' : 's'} from ${mod === 'All' ? 'all modules' : 'the ' + mod + ' module'} (${topics} topics), <b>${secs} s</b> each. No running code: predict it in your head, like in an interview.`, style: { margin: 0 } }));
    renderStats(); say('Choose a module, how many questions and the time limit, then press Start.');
  }
  bPlay.addEventListener('click', () => { reset(); started = true; bStep.disabled = false; bPlay.textContent = '↻ Restart'; show(); });
  bStep.addEventListener('click', next);
  bReset.addEventListener('click', reset);
  reset();
});

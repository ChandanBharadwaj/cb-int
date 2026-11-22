IA.register({
  track: 'python',
  slug: 'context-managers',
  title: 'Context managers',
  tagline: '<code>with</code> is <b>try/finally you can name and reuse</b>. Python calls <code>__enter__</code> before the block and <code>__exit__</code> after it, however the block ends, and passes in any exception so the manager can clean up, roll back, or (rarely) suppress it. It is Java’s try-with-resources, plus the power to see and swallow the exception.',
  tldr: {
    problem: 'Leaked connections, half-committed transactions and “too many open files” come from cleanup code that an exception skipped. The fix is <code>with</code>, but a hand-written manager can just as easily swallow errors or skip its own cleanup.',
    model: '<code>with m as x:</code> evaluates <code>m</code>, binds <code>x = m.__enter__()</code>, runs the body, then calls <code>m.__exit__(type, value, traceback)</code>: three <code>None</code>s if the body succeeded. If <code>__exit__</code> returns a truthy value, the exception is suppressed. <code>@contextmanager</code> builds one from a generator: code before <code>yield</code> is enter, code after is exit.',
    hook: '“Why didn’t my cleanup run?” In a <code>@contextmanager</code> generator, an exception from the body is <b>thrown in at the <code>yield</code></b>. Without <code>try/finally</code> around the <code>yield</code>, the code after it never runs.',
    facts: [
      { v: '3 args', l: '<code>__exit__(exc_type, exc, tb)</code>. All three are <code>None</code> when the block exits normally' },
      { v: 'LIFO', l: 'the order nested managers (and <code>ExitStack</code>) exit: last entered, first exited' },
      { v: '3.10', l: 'officially added parenthesised multi-line <code>with (A() as a, B() as b):</code>. 3.11 added <code>contextlib.chdir</code>' }
    ]
  },
  intro: {
    what: 'Some things must always be undone: a file must be closed, a lock released, a transaction committed or rolled back. A <b>context manager</b> packages the “set up” and the “undo” together, and the <code>with</code> statement guarantees the undo runs when the block ends, even if an error happens in the middle.',
    analogy: { icon: '🚪', title: 'A hotel room key card', text: 'Checking in (<code>__enter__</code>) gives you a key card (<code>as x</code>). Whatever happens during your stay (you leave early, something breaks), checkout (<code>__exit__</code>) always happens and the room is cleaned. The front desk is told if something broke, and decides whether to report it upstairs (propagate) or quietly handle it (suppress).' },
    steps: [
      { t: 'The everyday form', d: 'The file is closed when the block ends, error or not.', code: 'with open("data.csv") as f:\n    for line in f:\n        process(line)\n# f is closed here' },
      { t: 'What it replaces', d: 'The same guarantee with <code>try/finally</code>.', code: 'f = open("data.csv")\ntry:\n    for line in f:\n        process(line)\nfinally:\n    f.close()' },
      { t: 'Write one as a class', d: 'Two methods: <code>__enter__</code> and <code>__exit__</code>.', code: 'class Timer:\n    def __enter__(self):\n        self.t0 = time.perf_counter()\n        return self\n    def __exit__(self, exc_type, exc, tb):\n        self.elapsed = time.perf_counter() - self.t0\n        return False      # don\'t swallow errors' },
      { t: 'Or as a generator', d: '<code>contextlib.contextmanager</code>: setup, <code>yield</code>, cleanup in <code>finally</code>.', code: 'from contextlib import contextmanager\n\n@contextmanager\ndef timer():\n    t0 = time.perf_counter()\n    try:\n        yield\n    finally:\n        print(time.perf_counter() - t0)' },
      { t: 'Many at once', d: 'Comma-separate them, or use <code>ExitStack</code> when the number is only known at run time.' }
    ],
    terms: [
      ['context manager', 'An object with <code>__enter__</code> and <code>__exit__</code>.'],
      ['__enter__', 'Runs before the block. Its return value is bound by <code>as</code>.'],
      ['__exit__', 'Runs after the block with the exception info (or three Nones). Truthy return = suppress.'],
      ['contextlib', 'Standard-library helpers: <code>contextmanager</code>, <code>suppress</code>, <code>ExitStack</code>, <code>closing</code>, <code>nullcontext</code>.'],
      ['ExitStack', 'A context manager that holds any number of others and exits them in reverse order.'],
      ['async with', 'The asyncio version: <code>__aenter__</code>/<code>__aexit__</code>, <code>@asynccontextmanager</code>, <code>AsyncExitStack</code>.']
    ]
  },
  visual: {
    title: 'What with actually calls',
    caption: 'Pick a scenario and press <b>Play</b> or <b>Step</b>. The middle column is the stack of open resources; the right column logs each call Python makes. Watch where the exception goes and what <code>__exit__</code> returns.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Class-based', code: `class Resource:
    def __init__(self, name): self.name = name
    def __enter__(self):
        print(f"open {self.name}")
        return self
    def __exit__(self, exc_type, exc, tb):
        print(f"close {self.name}: exc_type={exc_type and exc_type.__name__}, exc={exc!r}")
        return False            # propagate

with Resource("a") as r:
    print("using", r.name)

try:
    with Resource("b"), Resource("c"):
        raise ValueError("boom")
except ValueError as e:
    print("caller saw:", e)` },
      { label: 'Transaction', code: `from contextlib import contextmanager

class FakeConn:
    def begin(self): print("BEGIN")
    def commit(self): print("COMMIT")
    def rollback(self): print("ROLLBACK")

@contextmanager
def transaction(conn):
    conn.begin()
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    else:
        conn.commit()

conn = FakeConn()
with transaction(conn):
    print("  update 1")

try:
    with transaction(conn):
        print("  update 2")
        raise RuntimeError("constraint violated")
except RuntimeError as e:
    print("error:", e)` },
      { label: 'Suppress & chain', code: `from contextlib import suppress

with suppress(KeyError):
    {}["missing"]
    print("not reached")
print("KeyError was suppressed")

class Swallow:
    def __enter__(self): return self
    def __exit__(self, *exc):
        return "oops"          # any truthy value suppresses!

with Swallow():
    1 / 0
print("ZeroDivisionError vanished")

class Raising:
    def __enter__(self): return self
    def __exit__(self, *exc):
        raise OSError("cleanup failed")

try:
    with Raising():
        raise ValueError("original")
except OSError as e:
    print("got:", repr(e), "| context:", repr(e.__context__))` },
      { label: 'ExitStack', code: `import os, tempfile
from contextlib import ExitStack

with tempfile.TemporaryDirectory() as d:
    names = []
    for n in ("a", "b"):
        p = os.path.join(d, n + ".txt")
        with open(p, "w") as f:
            f.write(n * 3)
        names.append(p)
    names.append(os.path.join(d, "missing.txt"))

    files = []
    try:
        with ExitStack() as stack:
            for p in names:
                files.append(stack.enter_context(open(p)))
                print("opened", os.path.basename(p))
    except FileNotFoundError as e:
        print("failed:", os.path.basename(e.filename))
    print("all closed:", all(f.closed for f in files))

with ExitStack() as stack:
    for i in range(3):
        stack.callback(print, "callback", i)   # LIFO
    print("work")` },
      { label: 'contextlib toolbox', code: `import contextlib, io, decimal

buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    print("captured!")
print("buffer has:", buf.getvalue().strip())

def maybe_lock(lock=None):
    return lock if lock is not None else contextlib.nullcontext()
with maybe_lock():
    print("works with or without a real lock")

with decimal.localcontext() as ctx:       # thread-local decimal settings
    ctx.prec = 4
    print(decimal.Decimal(1) / decimal.Decimal(7))
print(decimal.Decimal(1) / decimal.Decimal(7))

class Legacy:
    def close(self): print("Legacy.close() called")
with contextlib.closing(Legacy()):
    pass` },
      { label: 'Enter can fail', code: `class Pair:
    """Acquires two resources in __enter__ safely."""
    def __enter__(self):
        from contextlib import ExitStack
        with ExitStack() as stack:
            self.a = stack.enter_context(Noisy("a"))
            self.b = stack.enter_context(Noisy("b", fail=True))
            self._stack = stack.pop_all()   # success: keep them open
        return self
    def __exit__(self, *exc):
        return self._stack.__exit__(*exc)

class Noisy:
    def __init__(self, n, fail=False): self.n, self.fail = n, fail
    def __enter__(self):
        if self.fail:
            raise ConnectionError(f"{self.n} failed")
        print("acquired", self.n); return self
    def __exit__(self, *exc):
        print("released", self.n)

try:
    with Pair():
        print("never runs")
except ConnectionError as e:
    print("error:", e)`, note: 'If <code>__enter__</code> raises, <code>__exit__</code> is <b>not</b> called. The <code>ExitStack</code> + <code>pop_all()</code> idiom releases whatever was acquired before the failure.' }
    ]
  },
  gotchas: [
    { trap: '<code>yield</code> outside <code>try/finally</code> in <code>@contextmanager</code>', code: `@contextmanager
def locked(lock):
    lock.acquire()
    yield              # body raises -> thrown in here
    lock.release()     # never runs: lock held forever`, why: 'On an exception, <code>__exit__</code> calls <code>gen.throw(exc)</code>, which raises at the <code>yield</code>. Anything after it is skipped unless it is in a <code>finally</code> (or <code>except</code>).', fix: 'Always <code>try: yield … finally: cleanup()</code>. Use <code>except</code>/<code>else</code> when the cleanup differs by outcome (rollback vs commit).' },
    { trap: '<code>__exit__</code> accidentally suppresses errors', code: `def __exit__(self, exc_type, exc, tb):
    return self.conn.close()    # close() returns True on success...`, why: 'Any truthy return value means “handled”. The exception disappears, and the code after the <code>with</code> runs as if all was well.', fix: 'Return <code>None</code> or <code>False</code> explicitly (end with a bare <code>return</code> or nothing). Suppress only on purpose, for specific exception types, and preferably with <code>contextlib.suppress</code>.' },
    { trap: 'If <code>__enter__</code> raises, <code>__exit__</code> never runs', code: `def __enter__(self):
    self.a = connect_a()
    self.b = connect_b()     # raises -> self.a leaks
    return self`, why: 'The block was never entered, so there is nothing to exit. Partial acquisitions inside <code>__enter__</code> leak.', fix: 'Acquire inside an <code>ExitStack</code> in <code>__enter__</code> and call <code>pop_all()</code> once everything succeeded (see the “Enter can fail” preset).' },
    { trap: 'Lazy results escaping the block', code: `with open(path) as f:
    lines = (l.strip() for l in f)
return lines          # consumed later: ValueError: I/O operation on closed file`, why: 'The block ends (and closes the file) before anyone iterates. Same with DB cursors and HTTP streams.', fix: 'Consume inside the block (<code>list(...)</code>), or move the <code>with</code> into a generator so it lives as long as the iteration. See <a href="iterators-generators.html">Iterators & generators</a>.' },
    { trap: 'Reusing a <code>@contextmanager</code> object', code: `tx = transaction(conn)
with tx: ...
with tx: ...       # fails: the generator is already finished`, why: 'A generator-based manager wraps one generator, which can only run once.', fix: 'Call the factory each time: <code>with transaction(conn):</code>. If you need a reusable or re-entrant manager, write a class (like <code>threading.RLock</code>).' },
    { trap: 'Using <code>with</code> on an async resource (or vice versa)', code: `async with httpx.AsyncClient() as c: ...   # right
with httpx.AsyncClient() as c: ...         # TypeError`, why: 'Async managers implement <code>__aenter__</code>/<code>__aexit__</code>, which only <code>async with</code> calls, so the cleanup can itself await I/O.', fix: 'Match the statement to the protocol. For async generators use <code>@contextlib.asynccontextmanager</code>; for dynamic sets use <code>AsyncExitStack</code>.' }
  ],
  scenarios: [
    { title: '“QueuePool limit of size 5 overflow 10 reached” after a bad deploy',
      symptom: 'Every request started timing out after about 30 s. SQLAlchemy raised <code>TimeoutError: QueuePool limit of size 5 overflow 10 reached</code>. A restart helped for a few minutes.',
      diagnose: `def get_report(id):
    conn = engine.connect()
    rows = conn.execute(q, {"id": id}).all()   # raises for some ids
    conn.close()                               # skipped on error
    return rows

# pg_stat_activity: connections stuck "idle in transaction"`,
      cause: 'A new validation error made <code>execute</code> raise for some inputs. Each failure skipped <code>close()</code>, so the connection was never returned to the pool. After 15 failures the pool was empty.',
      fix: 'Acquire pooled resources only in <code>with</code> blocks. With SQLAlchemy 2.x, <code>engine.begin()</code> also commits or rolls back for you.',
      fixCode: `def get_report(id):
    with engine.connect() as conn:
        return conn.execute(q, {"id": id}).all()

# writes:
with Session(engine) as session, session.begin():
    session.add(obj)       # commit on success, rollback on exception` },
    { title: 'The API returned 200 OK but nothing was saved',
      symptom: 'Users reported lost edits. Logs showed successful responses and no errors, but the rows were never written.',
      diagnose: `class UnitOfWork:
    def __exit__(self, exc_type, exc, tb):
        if exc_type:
            self.session.rollback()
            return True            # "we handled it"
        self.session.commit()`,
      cause: 'The manager rolled back <b>and suppressed</b> every exception, including integrity errors and timeouts. The handler carried on and returned success.',
      fix: 'Roll back and let the exception propagate. Add a test asserting that an exception inside the block reaches the caller.',
      fixCode: `def __exit__(self, exc_type, exc, tb):
    if exc_type is None:
        self.session.commit()
    else:
        self.session.rollback()
    return None                    # never suppress` },
    { title: '“OSError: [Errno 24] Too many open files” in a long-running worker',
      symptom: 'A worker that merged report fragments crashed after a few days with EMFILE. <code>ls /proc/&lt;pid&gt;/fd | wc -l</code> was at the 1024 soft limit.',
      diagnose: `handles = [open(p) for p in fragment_paths]   # some opens fail midway
merged = merge(handles)
for h in handles:
    h.close()                                  # skipped on any error above`,
      cause: 'When one <code>open</code> or the merge failed, the files already opened were never closed. They stayed referenced from a retry queue, so even garbage collection didn’t close them.',
      fix: 'Use <code>ExitStack</code> for a dynamic number of resources: everything opened so far is closed, in reverse order, on any exit.',
      fixCode: `from contextlib import ExitStack

with ExitStack() as stack:
    handles = [stack.enter_context(open(p)) for p in fragment_paths]
    merged = merge(handles)` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `class CM:
    def __init__(self, name):
        self.name = name
    def __enter__(self):
        print("enter", self.name)
        return self
    def __exit__(self, *exc):
        print("exit", self.name)

with CM("a"), CM("b"):
    print("body")`, options: ['enter a<br>enter b<br>body<br>exit a<br>exit b', 'enter a<br>enter b<br>body<br>exit b<br>exit a', 'enter b<br>enter a<br>body<br>exit a<br>exit b', 'enter a<br>exit a<br>enter b<br>body<br>exit b'], answer: 1, run: true, expect: 'enter a\nenter b\nbody\nexit b\nexit a', explain: 'Multiple managers in one <code>with</code> behave like nested blocks: entered left to right, exited in reverse (LIFO).' },
    { kind: 'predict', q: 'What does this print?', code: `class Quiet:
    def __enter__(self):
        return self
    def __exit__(self, typ, exc, tb):
        print("exit sees", typ.__name__)
        return True

with Quiet():
    raise ValueError("x")
    print("unreached")
print("after")`, options: ['exit sees ValueError<br>after', 'exit sees ValueError<br>unreached<br>after', 'exit sees ValueError, then a traceback', 'after'], answer: 0, run: true, expect: 'exit sees ValueError\nafter', explain: '<code>__exit__</code> receives the exception and returns True, which suppresses it. Execution resumes <b>after</b> the <code>with</code> block, not after the line that raised.' },
    { kind: 'predict', q: 'What does this print?', code: `class Box:
    def __enter__(self):
        return 42
    def __exit__(self, *a):
        return False

with Box() as v:
    print(v)`, options: ['42', '&lt;__main__.Box object at 0x…&gt;', 'None', 'False'], answer: 0, run: true, expect: '42', explain: '<code>as</code> binds the return value of <code>__enter__</code>, not the manager. Many managers return <code>self</code>, but <code>open()</code> returns the file, a lock returns a bool, and a transaction helper might return a session.' },
    { kind: 'bug', q: 'What does this print?', code: `from contextlib import contextmanager

@contextmanager
def opened(name):
    print("open", name)
    yield name
    print("close", name)

try:
    with opened("f"):
        raise RuntimeError
except RuntimeError:
    print("caught")`, options: ['open f<br>close f<br>caught', 'open f<br>caught', 'open f<br>caught<br>close f', 'caught'], answer: 1, run: true, expect: 'open f\ncaught', explain: 'The exception is thrown into the generator at <code>yield</code>, which isn’t inside <code>try/finally</code>, so it propagates straight out and “close f” is skipped. That is a resource leak.' },
    { kind: 'predict', q: 'What does this print?', code: `from contextlib import contextmanager

@contextmanager
def tag():
    try:
        yield
    finally:
        print("cleanup")

def f():
    with tag():
        return "value"

print(f())`, options: ['value', 'cleanup<br>value', 'value<br>cleanup', 'cleanup'], answer: 1, run: true, expect: 'cleanup\nvalue', explain: '<code>return</code> inside a <code>with</code> still runs <code>__exit__</code>, before the function actually returns. So “cleanup” prints first, then the caller prints the returned value.' },
    { kind: 'predict', q: 'What does this print?', code: `from contextlib import ExitStack

with ExitStack() as stack:
    for i in range(3):
        stack.callback(print, "close", i)
    print("work")`, options: ['close 0<br>close 1<br>close 2<br>work', 'work<br>close 0<br>close 1<br>close 2', 'work<br>close 2<br>close 1<br>close 0', 'work'], answer: 2, run: true, expect: 'work\nclose 2\nclose 1\nclose 0', explain: 'Callbacks run when the stack exits, in <b>reverse</b> registration order, the same as nested <code>with</code> blocks.' },
    { kind: 'predict', q: 'What does this print?', code: `class Bad:
    def __enter__(self):
        return self
    def __exit__(self, *a):
        raise KeyError("from exit")

try:
    with Bad():
        raise ValueError("from body")
except Exception as e:
    print(type(e).__name__, type(e.__context__).__name__)`, options: ['ValueError NoneType', 'KeyError ValueError', 'ValueError KeyError', 'KeyError NoneType'], answer: 1, run: true, expect: 'KeyError ValueError', explain: 'An exception raised in <code>__exit__</code> <b>replaces</b> the one in flight. The original is kept as <code>__context__</code> (“During handling of the above exception, another exception occurred”). Java would add it as a suppressed exception instead.' },
    { kind: 'predict', q: 'What does this print?', code: `from contextlib import suppress

with suppress(FileNotFoundError):
    open("/definitely/missing/file.txt")
    print("opened")
print("done")`, options: ['opened<br>done', 'done', 'FileNotFoundError traceback', 'opened'], answer: 1, run: true, expect: 'done', explain: '<code>suppress</code> is a manager whose <code>__exit__</code> returns True for the listed types. The rest of the block is skipped, then execution continues after it.' }
  ],
  interview: [
    { q: 'Walk through exactly what <code>with A() as x: body</code> does.', a: '<ol><li>Evaluate <code>A()</code> to get the manager <code>m</code>; look up <code>type(m).__enter__</code> and <code>__exit__</code>.</li><li><code>x = m.__enter__()</code>.</li><li>Run the body.</li><li>On any exit, call <code>m.__exit__(t, v, tb)</code>, with <code>None</code>s on success.</li><li>If the body raised and <code>__exit__</code> returned a truthy value, the exception is suppressed; otherwise it re-raises.</li></ol>', lvl: 'core' },
    { q: 'How does <code>@contextmanager</code> work?', a: '<p>It wraps a generator function in a <code>_GeneratorContextManager</code>. <code>__enter__</code> calls <code>next(gen)</code> and returns the yielded value. <code>__exit__</code> calls <code>next(gen)</code> again on success (the generator must then finish), or <code>gen.throw(exc)</code> on error. If the generator handles the thrown exception and finishes, it is suppressed; if it re-raises, it propagates. The generator must yield exactly once.</p>', lvl: 'deep' },
    { q: 'When should <code>__exit__</code> return True?', a: '<p>Almost never. Only for managers whose purpose is suppression (<code>contextlib.suppress</code>, a test helper expecting an error). Cleanup managers should return <code>None</code>/<code>False</code>, so the caller sees failures.</p>', lvl: 'core' },
    { q: 'What happens if <code>__exit__</code> itself raises?', a: '<p>The new exception replaces the one in flight; the original is attached as <code>__context__</code> and shown in the traceback (“During handling of the above exception…”). Java’s try-with-resources does the reverse: the body’s exception wins and the close() failure is added via <code>addSuppressed</code>.</p>', lvl: 'deep' },
    { q: 'What is <code>ExitStack</code> for?', a: '<p>Managing a number of context managers known only at run time, or optional ones: <code>enter_context()</code> for managers, <code>callback()</code> for plain cleanup functions, <code>push()</code> for exit callbacks. It exits everything in LIFO order and handles exceptions between them correctly. <code>pop_all()</code> transfers ownership, which is the clean way to acquire several resources in <code>__enter__</code>.</p>', lvl: 'core' },
    { q: 'Context manager vs <code>try/finally</code> vs <code>__del__</code>?', a: '<p><code>try/finally</code> is the primitive. A context manager names and reuses it, and gets the exception details. <code>__del__</code> (finalizers) runs when the object is collected, which is not deterministic outside CPython’s reference counting, may never run at shutdown, and can’t propagate errors. Never rely on it for releasing connections or locks.</p>', lvl: 'core' },
    { q: 'Give examples of context managers in the standard library beyond files.', a: '<p><code>threading.Lock</code>/<code>RLock</code>/<code>Semaphore</code>, <code>decimal.localcontext()</code>, <code>tempfile.TemporaryDirectory()</code>, <code>unittest.mock.patch</code>, <code>socket.socket</code>, <code>sqlite3.Connection</code> (transaction, not close!), <code>concurrent.futures.ThreadPoolExecutor</code> (waits for tasks), <code>contextlib.redirect_stdout</code>, <code>contextlib.chdir</code> (3.11), <code>warnings.catch_warnings</code>, <code>asyncio.timeout</code> (3.11, async).</p>', fu: 'What does <code>with sqlite3.connect(p) as conn:</code> do on exit? (Commits or rolls back the transaction. It does not close the connection.)', lvl: 'deep' },
    { q: 'How do you write an async context manager?', a: '<p>Implement <code>async def __aenter__</code>/<code>__aexit__</code>, or decorate an async generator with <code>@contextlib.asynccontextmanager</code>, and use it with <code>async with</code>. The cleanup can then await I/O (closing a connection pool, releasing a remote lock). <code>AsyncExitStack</code> is the dynamic version.</p>', lvl: 'core' },
    { q: 'Is a context manager re-entrant or reusable?', a: '<p>Depends on the implementation. <b>Single-use</b>: <code>@contextmanager</code> objects, files (closed after one block). <b>Reusable</b>: <code>threading.Lock</code> (but not re-entrant: nesting deadlocks). <b>Re-entrant</b>: <code>RLock</code>, <code>contextlib.suppress</code>, <code>redirect_stdout</code>. Document which your own manager is.</p>', lvl: 'deep' },
    { q: 'How does <code>with</code> compare to Java’s try-with-resources?', a: '<p>Same shape: resources acquired in order, released in reverse, guaranteed on exceptions. Differences: Java needs <code>AutoCloseable.close()</code> and can’t see the exception or suppress it; Python’s <code>__exit__</code> gets the exception and can act on it (rollback vs commit) or swallow it. Python’s <code>as</code> binds <code>__enter__()</code>’s result, not the resource object itself.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Unit of work', lang: 'python', code: `from collections.abc import Iterator
from contextlib import contextmanager
import logging

from sqlalchemy.orm import Session, sessionmaker

log = logging.getLogger(__name__)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

@contextmanager
def unit_of_work() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        log.exception("transaction rolled back")
        raise                     # never swallow
    finally:
        session.close()           # always return the connection to the pool

with unit_of_work() as s:
    s.add(Order(customer_id=42, total=99))`, note: 'SQLAlchemy 2.x also offers <code>with Session(engine) as s, s.begin():</code>, which does the same. Write your own only when you need extra behaviour (outbox events, metrics).' },
    { title: 'Timing + metrics manager', lang: 'python', code: `import time
from types import TracebackType

class timed:
    """with timed("db.query", tags={"table": "orders"}): ..."""
    def __init__(self, name: str, tags: dict[str, str] | None = None) -> None:
        self.name, self.tags = name, tags or {}

    def __enter__(self) -> "timed":
        self._t0 = time.perf_counter()
        return self

    def __exit__(self, exc_type: type[BaseException] | None,
                 exc: BaseException | None, tb: TracebackType | None) -> None:
        self.elapsed = time.perf_counter() - self._t0
        status = "error" if exc_type else "ok"
        metrics.histogram(self.name, self.elapsed, tags={**self.tags, "status": status})
        # returns None: exceptions propagate`, note: 'Typing <code>__exit__</code> as returning <code>None</code> (not <code>bool</code>) also tells type checkers the manager never suppresses, so they don’t treat code after the block as maybe-unreachable.' },
    { title: 'Java comparison', lang: 'java', code: `try (Connection c = ds.getConnection();
     PreparedStatement ps = c.prepareStatement(sql)) {
    ps.executeUpdate();
}   // ps.close(), then c.close() (reverse order)
catch (SQLException e) {
    for (Throwable s : e.getSuppressed()) log.warn("close failed", s);
}

// Python equivalent:
// with pool.connection() as c, c.cursor() as cur:
//     cur.execute(sql)
// Differences: __exit__ sees the exception and can commit/rollback or suppress it;
// an exception from __exit__ REPLACES the body's (kept as __context__).` }
  ]
});

IA.register({
  track: 'python',
  slug: 'threading-multiprocessing',
  title: 'Threads vs processes',
  tagline: 'Threads share one heap and (in the default build) one GIL: cheap hand-offs, real concurrency for I/O, no CPU parallelism. Processes each get their own interpreter: real CPU parallelism, but every argument and result is <b>pickled</b> across a pipe and every worker has its <b>own copy</b> of the data. <code>concurrent.futures</code> gives both the same API.',
  tldr: {
    problem: 'Picking the wrong executor costs you either the speed-up (threads on CPU work) or correctness and memory (processes that can’t pickle a lambda, mutate a copy, deadlock after <code>fork</code>, or ship a 500 MB DataFrame with every task).',
    model: '<b>Threads:</b> one process, shared objects, hand-off by reference; protect compound updates with locks or use queues. <b>Processes:</b> separate address spaces; tasks are pickled (functions by <i>qualified name</i>, data by value), sent through a pipe, unpickled in the worker, and the result travels back the same way. The <b>start method</b> (fork, spawn, forkserver) decides how a worker begins: as a copy of the parent, or by re-importing your main module.',
    hook: '“I passed a dict to a <code>multiprocessing</code> worker and updated it, why is the parent’s dict unchanged?” The worker received an unpickled copy. Processes share nothing unless you ask for it explicitly (queues, pipes, <code>shared_memory</code>, a Manager).',
    facts: [
      { v: 'min(32, cpus + 4)', l: 'default <code>max_workers</code> of <code>ThreadPoolExecutor</code> (3.8+). <code>ProcessPoolExecutor</code> defaults to the number of CPUs' },
      { v: 'fork → forkserver', l: 'the default start method on Linux changed in 3.14. macOS has defaulted to spawn since 3.8, and Windows only has spawn' },
      { v: 'by name', l: 'how pickle sends functions: <code>module.qualname</code>. Lambdas and nested functions have no importable name, so they can’t be sent to a process' }
    ]
  },
  intro: {
    what: 'There are two ways to do several things at once in Python without asyncio. <b>Threads</b> run inside one program and share all its data; they are light and perfect for waiting on networks and disks, but (in the normal build) only one runs Python code at a time. <b>Processes</b> are separate programs, each with its own memory and its own interpreter; they can use every CPU core, but they have to send data to each other by copying it.',
    analogy: { icon: '🍳', title: 'One kitchen vs several kitchens', text: 'Threads are cooks sharing one kitchen: they can all reach the same fridge (memory) instantly, but they must not grab the same pan at once (locks), and there is a single stove burner for Python work (the GIL). Processes are separate kitchens: each has its own stove and its own copy of the ingredients, so they cook truly in parallel, but anything they share has to be packed, carried over and unpacked (pickling).' },
    steps: [
      { t: 'Same API for both', d: '<code>concurrent.futures</code> lets you switch by changing one class name.', code: 'from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor\n\nwith ThreadPoolExecutor() as ex:          # or ProcessPoolExecutor()\n    results = list(ex.map(fetch, urls))' },
      { t: 'Threads share data', d: 'A worker thread sees and can change the same objects as the main thread. Changes are visible immediately, which is also how races happen.' },
      { t: 'Processes copy data', d: 'Arguments are converted to bytes with <code>pickle</code>, sent to the worker, and rebuilt there. The worker changes its own copy.' },
      { t: 'Guard the entry point', d: 'With the <i>spawn</i> start method (macOS, Windows), each worker re-imports your main file. Top-level code must be inside the guard.', code: 'if __name__ == "__main__":\n    with ProcessPoolExecutor() as ex:\n        print(list(ex.map(square, range(10))))' },
      { t: 'Pick by bottleneck', d: 'Waiting (HTTP, DB, files) → threads (or asyncio). Pure-Python computation → processes. See <a href="concurrency-choice.html">Choosing a concurrency model</a>.' }
    ],
    terms: [
      ['thread', 'An independent flow of execution inside a process, sharing its memory.'],
      ['process', 'A running program with its own memory space and, in Python, its own interpreter and GIL.'],
      ['pickle', 'Python’s object serialisation format, used to send objects between processes.'],
      ['start method', 'How a worker process is created: <code>fork</code> (copy the parent), <code>spawn</code> (fresh interpreter), <code>forkserver</code> (fork from a clean helper process).'],
      ['Future', 'A placeholder for a result that isn’t ready yet: <code>.result()</code>, <code>.exception()</code>, <code>.done()</code>.'],
      ['race condition', 'A bug that depends on the timing of threads touching shared data.']
    ]
  },
  visual: {
    title: 'One task, two executors',
    caption: 'Switch between <b>ThreadPoolExecutor</b> and <b>ProcessPoolExecutor</b> and press <b>Play</b> or <b>Step</b>. Follow one <code>submit(fn, big_df)</code>: by reference into a shared heap, or pickled into bytes, piped to another interpreter and rebuilt as a copy. Watch where the worker’s write to <code>cache</code> ends up.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'What can be pickled?', code: `import functools, os, pickle, threading

def make_local():
    def local(x):
        return x
    return local

candidates = {
    "module-level function": os.path.join,
    "partial of it": functools.partial(os.path.join, "/data"),
    "lambda": lambda x: x,
    "nested function": make_local(),
    "generator": (x for x in range(3)),
    "threading.Lock": threading.Lock(),
    "dict of data": {"rows": [1, 2, 3]},
}
for name, obj in candidates.items():
    try:
        blob = pickle.dumps(obj)
        print(f"ok    {name:22} {len(blob):4} bytes")
    except Exception as e:
        print(f"FAIL  {name:22} {type(e).__name__}: {str(e)[:55]}")

print(pickle.dumps(os.path.join))   # just a reference: module + name, no code`, note: 'Functions travel <i>by name</i>; the worker imports the same name. In a real script your own top-level functions pickle like <code>os.path.join</code>. (This playground runs code in an anonymous namespace, so functions defined here can’t be found by name.)' },
      { label: 'A process gets a copy', code: `import pickle

state = {"seen": [], "config": {"retries": 3}}

def worker_side(blob):
    data = pickle.loads(blob)        # what a worker process receives
    data["seen"].append("worker")    # mutates its own copy
    return pickle.dumps(data)        # results travel back as bytes too

blob = pickle.dumps(state)
returned = pickle.loads(worker_side(blob))

print("parent's state:", state)
print("returned copy :", returned)
print("same object?  ", returned is state)`, note: 'Exactly what <code>ProcessPoolExecutor</code> does to each argument and return value, minus the pipe.' },
      { label: 'Future mechanics', code: `from concurrent.futures import Future, as_completed

f = Future()
f.add_done_callback(lambda fut: print("callback sees:", fut.result()))
print("done?", f.done())
f.set_result(42)                 # an executor's worker does this
print("done?", f.done(), "result:", f.result())

g = Future()
g.set_exception(ValueError("bad row 17"))
print("exception stored, nothing raised yet:", repr(g.exception()))
try:
    g.result()                   # re-raised only here
except ValueError as e:
    print("raised at .result():", e)

futs = [Future() for _ in range(3)]
for i in (2, 0, 1):              # finish in a different order
    futs[i].set_result(i)
print("as_completed:", [x.result() for x in as_completed(futs)])` },
      { label: 'Pickle cost per task', code: `import pickle, time

rows = [{"id": i, "text": "lorem ipsum " * 20, "score": i / 7} for i in range(50_000)]

t0 = time.perf_counter()
blob = pickle.dumps(rows, protocol=pickle.HIGHEST_PROTOCOL)
t1 = time.perf_counter()
pickle.loads(blob)
t2 = time.perf_counter()

print(f"payload: {len(blob)/1e6:.1f} MB")
print(f"dumps {1000*(t1-t0):.0f} ms, loads {1000*(t2-t1):.0f} ms")
print("x 1000 tasks if you pass it to every submit() call!")
print("cheaper: send a path or an id, or load it once per worker with initializer=")` },
      { label: 'Lock vs RLock', code: `import threading

lock = threading.Lock()
rlock = threading.RLock()

with lock:
    # a second acquire from the same thread would block forever; test without blocking
    print("Lock re-acquire:", lock.acquire(blocking=False))

with rlock:
    print("RLock re-acquire:", rlock.acquire(blocking=False))
    rlock.release()

cond = threading.Condition()
print("Condition wraps an RLock by default:", type(cond._lock).__name__)

ev = threading.Event()
print("event set?", ev.is_set()); ev.set(); print("event set?", ev.is_set())`, note: 'This playground can’t start real threads (WebAssembly), but the synchronisation objects themselves work.' }
    ]
  },
  gotchas: [
    { trap: 'Sending lambdas or nested functions to a process pool', code: `with ProcessPoolExecutor() as ex:
    ex.map(lambda p: parse(p, strict=True), paths)
# PicklingError / AttributeError: Can't pickle <function <lambda> ...>`, why: 'Pickle stores functions as <code>module.qualname</code>, and the worker imports that name. A lambda or a function defined inside another function has no importable name.', fix: 'Use a module-level function, plus <code>functools.partial(parse, strict=True)</code> for fixed arguments (partials of top-level functions pickle fine).' },
    { trap: 'No <code>__main__</code> guard with spawn', code: `# main.py, run on macOS or Windows
pool = ProcessPoolExecutor()          # at module level
results = list(pool.map(work, items))`, why: 'Spawned workers start a fresh interpreter and import your main module (as <code>__mp_main__</code>) to find <code>work</code>. Unguarded top-level code runs again in every child, and multiprocessing refuses to start new processes during that bootstrap with a <code>RuntimeError</code>.', fix: 'Put everything that starts work under <code>if __name__ == "__main__":</code> and keep module top level to definitions.' },
    { trap: 'Forking a process that already has threads', why: '<code>fork()</code> copies only the calling thread. Locks held by other threads at that instant (logging handlers, connection pools, OpenSSL, the allocator) are copied in the locked state and are never released in the child, so it can hang forever. Since 3.12, <code>os.fork()</code> in a multi-threaded process emits a <code>DeprecationWarning</code>.', fix: 'Use <code>multiprocessing.get_context("spawn")</code> or <code>"forkserver"</code> (the Linux default from 3.14) and pass it as <code>mp_context=</code> to <code>ProcessPoolExecutor</code>.' },
    { trap: 'Exceptions disappearing inside futures', code: `for p in paths:
    ex.submit(process, p)      # futures discarded: failures are silent`, why: 'A future stores the exception; nothing is raised until someone calls <code>.result()</code>. With <code>map</code>, the exception is raised when iteration reaches that item, and stops the iteration there.', fix: 'Keep the futures and check each one (<code>as_completed</code> + <code>.result()</code>), log failures with context, and fail the job if any failed.' },
    { trap: 'Shipping a big object with every task', code: `ex.map(score, [(big_df, row_id) for row_id in ids])   # big_df pickled per task`, why: 'Each argument is pickled separately for every task. With a large object, serialisation and copying dominate and memory spikes in every worker.', fix: 'Load it once per worker with <code>initializer=</code>/<code>initargs=</code> into a module global, pass ids or file paths, or use <code>multiprocessing.shared_memory</code> for big numeric arrays. Use <code>chunksize</code> with <code>map</code> for many small tasks.' },
    { trap: 'Assuming GIL-protected thread code is race-free', code: `if user_id not in sessions:          # check
    sessions[user_id] = open_session()  # act: two threads can both get here`, why: 'Single built-in operations are atomic under the GIL, but a sequence of them isn’t. On the free-threaded build the window is wider.', fix: 'Use a <code>Lock</code> around check-then-act, <code>dict.setdefault</code> for the simple case, or a <code>queue.Queue</code> so only one thread owns the state.' },
    { trap: 'Daemon threads and abrupt exit', why: 'At interpreter exit, daemon threads are stopped wherever they are: files may be half-written and buffers unflushed. Non-daemon threads instead keep the process alive, which is why a forgotten background thread makes a script “hang” at the end.', fix: 'Give background threads a stop <code>Event</code> and <code>join()</code> them on shutdown; use daemon threads only for work that is safe to lose.' }
  ],
  scenarios: [
    { title: 'ProcessPoolExecutor made scoring 3× slower than a loop',
      symptom: 'A batch job scores 200k rows against a 300 MB feature table. With <code>ProcessPoolExecutor(8)</code> it takes 3× longer than the single-process loop, and memory peaks at 10 GB.',
      diagnose: `$ py-spy top --pid <parent>
  58%  _pickle.Pickler.dump   (concurrent/futures/process.py)
# the parent spends most of its time serialising arguments`,
      diagnoseLang: 'bash',
      cause: 'Each task was <code>(features_df, row)</code>, so the 300 MB table was pickled, piped and unpickled once per task, and copies piled up in the workers.',
      fix: 'Load the table once per worker with an initializer and send only row ids, in chunks.',
      fixCode: `_features = None

def _init(path: str) -> None:
    global _features
    _features = load_features(path)          # once per worker process

def score(row_id: int) -> float:
    return model_score(_features, row_id)

if __name__ == "__main__":
    with ProcessPoolExecutor(8, initializer=_init, initargs=("features.parquet",)) as ex:
        scores = list(ex.map(score, row_ids, chunksize=500))` },
    { title: 'Workers hang forever right after start-up (Linux only)',
      symptom: 'A service that starts a metrics-exporter thread at import time later creates a <code>multiprocessing.Pool</code>. Occasionally a worker hangs before doing any work; <code>py-spy dump</code> shows it stuck acquiring a lock in <code>logging</code>.',
      diagnose: `$ py-spy dump --pid <stuck-child>
Thread 0x7F.. (idle): "MainThread"
    acquire (threading.py)
    handle (logging/__init__.py)          # lock copied in the "held" state
$ python -W error::DeprecationWarning app.py   # 3.12+: fork with threads warns`,
      diagnoseLang: 'bash',
      cause: 'On Linux before 3.14 the default start method was <code>fork</code>. The fork happened while the exporter thread held the logging handler’s lock; the child inherited the locked lock but not the thread that would release it.',
      fix: 'Create pools from an explicit spawn or forkserver context, and start background threads only after workers exist (or in the workers).',
      fixCode: `import multiprocessing as mp
from concurrent.futures import ProcessPoolExecutor

ctx = mp.get_context("forkserver")   # or "spawn"
with ProcessPoolExecutor(max_workers=4, mp_context=ctx) as ex:
    ...` },
    { title: 'Nightly import “succeeded” with 30% of files missing',
      symptom: 'The job exits 0 and logs “done”, but a third of the documents never reach the search index.',
      diagnose: `futures = [ex.submit(index_file, p) for p in paths]
# ... nothing ever calls f.result() ...
print(sum(f.exception() is not None for f in futures))   # 6214`,
      cause: 'Exceptions raised in workers (timeouts, bad encodings) were stored in futures that nobody read, so the job had no idea anything failed.',
      fix: 'Consume every future, record failures with the input that caused them, and exit non-zero when any failed.',
      fixCode: `failed = []
with ThreadPoolExecutor(16) as ex:
    futs = {ex.submit(index_file, p): p for p in paths}
    for f in as_completed(futs):
        try:
            f.result()
        except Exception:
            log.exception("indexing failed: %s", futs[f])
            failed.append(futs[f])
if failed:
    raise SystemExit(f"{len(failed)} files failed")` },
    { title: 'OOM-killed after adding workers to an embedding pipeline',
      symptom: 'Raising <code>ProcessPoolExecutor</code> from 4 to 16 workers on a 32 GB node gets the pod OOM-killed within minutes.',
      diagnose: `$ ps -o pid,rss,cmd --ppid <parent>   # each worker ~2.5 GB RSS: one model per process`,
      diagnoseLang: 'bash',
      cause: 'Every worker process loads its own copy of the embedding model. Memory scales linearly with workers, and the library’s inference already used several cores per call through native threads.',
      fix: 'Because the heavy work runs in native code that releases the GIL, use one process with a thread pool sharing a single model, or a few processes. Use <code>max_tasks_per_child</code> (3.11+) if workers leak memory over time.',
      fixCode: `model = load_model()                       # one copy in memory
with ThreadPoolExecutor(max_workers=8) as ex:   # inference releases the GIL
    vectors = list(ex.map(model.encode, batches))` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Tasks finish in reverse order. What does this print?', code: `from concurrent.futures import ThreadPoolExecutor
import time

def work(n):
    time.sleep(0.05 * (3 - n))   # n=0 is the slowest
    return n * 10

with ThreadPoolExecutor(max_workers=3) as ex:
    print(list(ex.map(work, [0, 1, 2])))`, options: ['[20, 10, 0]', '[0, 10, 20]', 'It depends on timing', '[0, 1, 2]'], answer: 1, run: true, expect: '[0, 10, 20]', explain: '<code>Executor.map</code> always yields results in <b>input order</b>, waiting for slower items if needed. Use <code>as_completed</code> when you want completion order.' },
    { kind: 'predict', q: 'What does this print?', code: `import multiprocessing as mp

data = [1, 2, 3]

def child():
    data.append(4)
    print("child", data)

if __name__ == "__main__":
    p = mp.Process(target=child)
    p.start()
    p.join()
    print("parent", data)`, options: ['child [1, 2, 3, 4]<br>parent [1, 2, 3, 4]', 'child [1, 2, 3, 4]<br>parent [1, 2, 3]', 'parent [1, 2, 3]<br>child [1, 2, 3, 4]', 'PicklingError'], answer: 1, run: true, expect: 'child [1, 2, 3, 4]\nparent [1, 2, 3]', explain: 'The child has its own memory: a copy of the parent’s with fork, or a fresh import of the module with spawn/forkserver. Its <code>append</code> changes only its own list. The parent prints after <code>join()</code>, so the order is fixed.' },
    { kind: 'predict', q: 'What does this print to stdout?', code: `from concurrent.futures import ThreadPoolExecutor

def boom():
    raise ValueError("bad input")

with ThreadPoolExecutor() as ex:
    f = ex.submit(boom)
print("no crash")
print(type(f.exception()).__name__)
try:
    f.result()
except ValueError as e:
    print("raised:", e)`, options: ['ValueError traceback, nothing else', 'no crash<br>ValueError<br>raised: bad input', 'no crash<br>None', 'raised: bad input<br>no crash<br>ValueError'], answer: 1, run: true, expect: 'no crash\nValueError\nraised: bad input', explain: 'The exception is captured in the future. Leaving the <code>with</code> block waits for the task but does not raise. <code>.exception()</code> returns it, and <code>.result()</code> re-raises it in the caller.' },
    { kind: 'predict', q: 'Which objects survive pickling?', code: `import pickle

def square(x):
    return x * x

for name, obj in [("top-level", square), ("lambda", lambda x: x * x)]:
    try:
        pickle.dumps(obj)
        print(name, "ok")
    except (pickle.PicklingError, AttributeError):
        print(name, "fails")`, options: ['top-level ok<br>lambda ok', 'top-level ok<br>lambda fails', 'top-level fails<br>lambda fails', 'top-level fails<br>lambda ok'], answer: 1, run: true, expect: 'top-level ok\nlambda fails', explain: 'Pickle saves a function as a reference (<code>__main__.square</code>). The lambda’s name is <code>&lt;lambda&gt;</code>, which can’t be looked up as an attribute of its module, so pickling fails. That is why <code>ProcessPoolExecutor</code> rejects lambdas.' },
    { kind: 'predict', q: 'A producer and one consumer thread use a queue with a sentinel. What does this print?', code: `import queue
import threading

q = queue.Queue()
out = []

def consumer():
    while (item := q.get()) is not None:
        out.append(item * 2)

t = threading.Thread(target=consumer)
t.start()
for i in range(3):
    q.put(i)
q.put(None)
t.join()
print(out)`, options: ['[0, 2, 4]', '[]', 'The order varies', 'It never terminates'], answer: 0, run: true, expect: '[0, 2, 4]', explain: '<code>queue.Queue</code> is FIFO and thread-safe; <code>get()</code> blocks until an item arrives. With one consumer the order is the put order, and the <code>None</code> sentinel ends the loop so <code>join()</code> returns.' },
    { kind: 'concept', q: 'On macOS, a script without an <code>if __name__ == "__main__":</code> guard creates a <code>ProcessPoolExecutor</code> at module level. What happens?', options: ['It works; macOS uses fork', 'Each worker re-imports the main module, the top-level pool code runs again in the child, and multiprocessing raises a RuntimeError about the bootstrapping phase', 'Workers silently share the parent’s memory', 'Only the first task fails'], answer: 1, explain: 'macOS defaults to <b>spawn</b> (3.8+): each child starts a fresh interpreter and imports your main module to find the target function. Without the guard, that import tries to start processes again, which multiprocessing detects and refuses.' },
    { kind: 'concept', q: 'Why can <code>fork()</code> in a process that runs other threads deadlock the child?', options: ['fork() copies all threads, which then fight over the GIL', 'The child gets only the forking thread, but inherits every lock in whatever state it was, including locks held by threads that no longer exist in the child', 'fork() releases all locks', 'The GIL is not copied'], answer: 1, explain: 'A lock held by, say, a logging or connection-pool thread at fork time stays locked forever in the child. 3.12 warns about forking multi-threaded processes; 3.14 moved Linux’s default start method to forkserver.' },
    { kind: 'concept', q: 'You submit tasks that take 3 s, 1 s and 2 s (in that order) to a 3-thread pool and iterate <code>as_completed(futures)</code>. In what order do you typically get them?', options: ['3 s, 1 s, 2 s (submission order)', '1 s, 2 s, 3 s (completion order)', 'Random', '2 s, 1 s, 3 s'], answer: 1, explain: '<code>as_completed</code> yields futures as they finish. It is the tool for “handle results as soon as possible”; <code>map</code> is for “results in input order”.' }
  ],
  interview: [
    { q: 'When do you use threads, and when processes, in Python?', a: '<p>Threads for I/O-bound work (network calls, database queries, file I/O) and for C libraries that release the GIL: cheap to start, share memory, no serialisation. Processes for pure-Python CPU-bound work: each has its own GIL, so they scale across cores, at the cost of start-up time, memory per worker and pickling every argument and result. For thousands of concurrent connections, asyncio usually beats both.</p>', lvl: 'core' },
    { q: 'What are the multiprocessing start methods?', a: '<ul><li><b>fork</b>: the child is a copy-on-write clone of the parent (fast, inherits everything, unsafe with threads). Default on Linux up to 3.13.</li><li><b>spawn</b>: a fresh interpreter that imports your main module and receives the target by pickle. Safe, slower, requires picklable targets and a <code>__main__</code> guard. Default on macOS (3.8+) and Windows.</li><li><b>forkserver</b>: a clean single-threaded server process forks workers on request. Default on Linux from 3.14.</li></ul>', fu: 'How do you pick one per pool? (<code>mp_context=multiprocessing.get_context("spawn")</code>.)', lvl: 'core' },
    { q: 'What does <code>ProcessPoolExecutor.submit</code> do under the hood?', a: '<p>It wraps the call in a work item and a Future. A feeder thread in the parent pickles <code>(fn, args, kwargs)</code> and writes it to a call queue (a pipe). A worker process reads it, unpickles it, imports <code>fn</code> by name, runs it, pickles the result or the exception, and sends it back on a result queue, where a management thread sets the Future’s result. If a worker dies abruptly the pool becomes <code>BrokenProcessPool</code>.</p>', lvl: 'deep' },
    { q: 'How do processes share state?', a: '<ul><li>Message passing: <code>multiprocessing.Queue</code>/<code>Pipe</code> (pickled objects).</li><li>Shared memory: <code>Value</code>/<code>Array</code> for primitives, <code>multiprocessing.shared_memory</code> (3.8+) for raw buffers, typically wrapped as NumPy arrays.</li><li>A <code>Manager</code>: a server process holding real objects, accessed through proxies (convenient, slow).</li><li>External stores: Redis, a database, files.</li></ul><p>Prefer passing messages and returning results over sharing mutable state.</p>', lvl: 'core' },
    { q: 'How do you keep shared state safe between threads?', a: '<p>Avoid sharing: give each piece of state one owner thread and communicate with <code>queue.Queue</code>. If you must share, protect every compound operation with a <code>Lock</code> (or <code>RLock</code> if a thread re-enters), use <code>Condition</code> or <code>Event</code> for signalling, and keep critical sections small. Immutable objects can be shared freely. The rules are the same as in Java; there is just no <code>java.util.concurrent</code>-sized toolbox, so queues and locks do most of the work.</p>', lvl: 'core' },
    { q: '<code>map</code> vs <code>submit</code> + <code>as_completed</code>?', a: '<p><code>map(fn, iterable, chunksize=…)</code> returns results lazily in input order, and raises the first exception when iteration reaches it. For process pools, <code>chunksize</code> batches items to cut per-task overhead. <code>submit</code> returns individual Futures: use <code>as_completed</code> to process results as they finish, attach context to failures, or cancel the rest. Note that <code>map</code> submits all items up front (it is not backpressured).</p>', lvl: 'core' },
    { q: 'What happens when you leave a <code>with ThreadPoolExecutor()</code> block?', a: '<p><code>__exit__</code> calls <code>shutdown(wait=True)</code>: no new tasks are accepted and the block waits for all submitted tasks to finish. It does not raise their exceptions. 3.9 added <code>cancel_futures=True</code> to drop queued tasks that haven’t started. Running threads can’t be killed; design long tasks to check a stop flag.</p>', lvl: 'core' },
    { q: 'Why can’t you pickle a lambda, and how do you send configuration to a worker?', a: '<p>Pickle serialises functions by reference (<code>module</code> + <code>qualname</code>); the worker imports that name. Lambdas and nested functions aren’t reachable by name. Send configuration as arguments of a top-level function, as a <code>functools.partial</code>, or through the pool’s <code>initializer</code>/<code>initargs</code> to set up per-worker globals once.</p>', fu: 'What else can’t be pickled? (Locks, open sockets and files, DB connections, generators: anything tied to process-local resources.)', lvl: 'core' },
    { q: 'What is copy-on-write and why does Python defeat it?', a: '<p>After <code>fork</code>, parent and child share physical pages until one writes. CPython writes to objects merely by referencing them (refcount updates) and during GC scans, so pages holding Python objects get copied over time and each worker’s memory grows toward the parent’s. <code>gc.freeze()</code> before forking and immortal objects (3.12) reduce this; data in NumPy buffers or <code>mmap</code> stays shared. See <a href="memory-gc.html">Memory &amp; garbage collection</a>.</p>', lvl: 'deep' },
    { q: 'How does the free-threaded build change this choice?', a: '<p>On a free-threaded interpreter (experimental in 3.13, officially supported since 3.14), threads can run Python bytecode in parallel, so CPU-bound work can scale with a thread pool and no pickling. The trade-offs: dependencies must support it, single-threaded code runs somewhat slower, and races in your code become much more likely. Processes remain the safe default for CPU parallelism today. See <a href="gil.html">The GIL &amp; free-threading</a>.</p>', lvl: 'deep' },
    { q: 'Compare with Java’s ExecutorService.', a: '<p><code>ThreadPoolExecutor</code> ≈ <code>Executors.newFixedThreadPool</code> and <code>Future.result()</code> ≈ <code>Future.get()</code> (exceptions wrapped in Java, re-raised directly in Python). The big difference: Java threads run in parallel, so one JVM with a thread pool covers both I/O and CPU work. In CPython, CPU parallelism needs separate processes, which is closer to running several JVMs and passing serialised messages between them.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Production-ready process pool', lang: 'python', code: `import logging
import multiprocessing as mp
from concurrent.futures import ProcessPoolExecutor, as_completed

log = logging.getLogger(__name__)
_model = None

def _init_worker(model_path: str) -> None:
    global _model
    _model = load_model(model_path)          # once per process, not per task

def classify(doc_id: str) -> tuple[str, str]:
    text = fetch_text(doc_id)                # send ids, not big objects
    return doc_id, _model.predict(text)

def run(doc_ids: list[str], model_path: str) -> dict[str, str]:
    ctx = mp.get_context("spawn")            # safe even if the parent has threads
    results, failed = {}, []
    with ProcessPoolExecutor(max_workers=4, mp_context=ctx,
                             initializer=_init_worker, initargs=(model_path,),
                             max_tasks_per_child=500) as ex:   # 3.11+: recycle leaky workers
        futs = {ex.submit(classify, d): d for d in doc_ids}
        for f in as_completed(futs):
            try:
                doc_id, label = f.result()
                results[doc_id] = label
            except Exception:
                log.exception("failed on %s", futs[f]); failed.append(futs[f])
    if failed:
        raise RuntimeError(f"{len(failed)} documents failed")
    return results

if __name__ == "__main__":
    print(run(load_ids(), "model.bin"))` },
    { title: 'Threads + queue: bounded fan-out to an API', lang: 'python', code: `import queue
import threading

import httpx

def fetch_all(urls: list[str], workers: int = 8) -> dict[str, int]:
    jobs: queue.Queue[str | None] = queue.Queue(maxsize=100)   # backpressure
    results: dict[str, int] = {}
    lock = threading.Lock()

    def worker() -> None:
        with httpx.Client(timeout=10) as client:              # one client per thread
            while (url := jobs.get()) is not None:
                try:
                    status = client.get(url).status_code
                except httpx.HTTPError:
                    status = -1
                with lock:                                    # results is shared
                    results[url] = status

    threads = [threading.Thread(target=worker, name=f"fetch-{i}") for i in range(workers)]
    for t in threads: t.start()
    for u in urls: jobs.put(u)
    for _ in threads: jobs.put(None)                          # one sentinel per worker
    for t in threads: t.join()
    return results`, note: 'In new code, <code>ThreadPoolExecutor</code> or <a href="asyncio.html">asyncio</a> is usually simpler; the explicit queue shows the pattern underneath.' },
    { title: 'Java comparison: ExecutorService', lang: 'java', code: `ExecutorService pool = Executors.newFixedThreadPool(8);
List<Future<Integer>> futures = urls.stream()
    .map(u -> pool.submit(() -> fetchStatus(u)))     // lambdas are fine: same JVM
    .toList();
for (Future<Integer> f : futures) {
    try { use(f.get()); }                            // ExecutionException wraps the cause
    catch (ExecutionException e) { log.error("failed", e.getCause()); }
}
pool.shutdown();

// Python ThreadPoolExecutor ≈ this, for I/O.
// Python ProcessPoolExecutor ≈ N separate JVMs + serialised messages: no shared heap,
// no lambdas, arguments copied.`, note: 'In Java one pool type serves I/O and CPU work. In CPython you choose by bottleneck.' }
  ]
});

IA.register({
  track: 'python',
  slug: 'performance',
  title: 'Profiling & performance',
  tagline: 'CPython runs your code one bytecode at a time, and every <code>+</code> on two ints is a dynamic dispatch on boxed objects. So the rules differ from the JVM: <b>measure first</b> (cProfile for call counts, py-spy for production), then move the hot loop <b>out of Python</b>: into a better algorithm, a builtin, NumPy, or compiled code.',
  tldr: {
    problem: 'Slow Python is usually not “Python being slow”. It is a quadratic loop, an N+1 query, a Python loop over a million NumPy elements, or a regex that backtracks. Guessing wastes days; a profile usually shows it in minutes.',
    model: 'Two kinds of profiler. <b>Deterministic</b> (cProfile) hooks every call and return: exact call counts, but overhead per call. <b>Sampling</b> (py-spy, pyinstrument) reads the stack every few milliseconds: low overhead, statistical, safe in production. Read results as a call tree or flame graph: <b>wide</b> = expensive, a wide <b>top edge</b> = time spent in that function itself.',
    hook: '“<code>cumtime</code> or <code>tottime</code>?” <code>tottime</code> is time inside the function itself; <code>cumtime</code> includes everything it called. Sort by <code>cumtime</code> to find the slow path, then by <code>tottime</code> to find the line of work to fix.',
    facts: [
      { v: 'py-spy', l: 'samples a running process from outside (<code>py-spy dump/top/record --pid</code>) without restarting it or changing code. It needs ptrace rights (<code>SYS_PTRACE</code> in containers)' },
      { v: '1.25×', l: 'average speed-up of CPython 3.11 over 3.10 on the pyperformance suite (the “Faster CPython” work: adaptive specializing interpreter)' },
      { v: '-X perf', l: '3.12+: lets Linux <code>perf</code> see Python function names, so one flame graph can show Python and C frames together' }
    ]
  },
  intro: {
    what: 'Making code faster has two parts: finding <i>where</i> the time goes (<b>profiling</b>) and then changing that part. A profiler runs your program and reports which functions used the time. In Python the fix is usually one of three things: a better algorithm or data structure, doing the work in bulk with a library written in C (such as NumPy), or not doing the work at all (caching, batching).',
    analogy: { icon: '🚗', title: 'A traffic survey before building roads', text: 'You don’t widen every road in town. You count cars first, find the one junction where everyone queues, and fix that. A profiler is the traffic survey. A flame graph is the map, with the busiest roads drawn widest.' },
    steps: [
      { t: 'Reproduce and time it', d: 'Get a repeatable case and a baseline number.', code: 'import time\nt0 = time.perf_counter()\nrun_report()\nprint(f"{time.perf_counter() - t0:.2f}s")' },
      { t: 'Profile it', d: 'cProfile ships with Python and counts every call.', code: 'python -m cProfile -s cumtime report.py | head -20', lang: 'bash' },
      { t: 'In production, sample instead', d: 'py-spy attaches to a running process and draws a flame graph.', code: 'py-spy record -o profile.svg --pid 4121 --duration 30', lang: 'bash' },
      { t: 'Fix the widest thing', d: 'Most often: a set instead of a list, a batch query instead of N queries, or a NumPy operation instead of a loop.' },
      { t: 'Measure again', d: 'Keep the change only if the number moved, and add a benchmark or test so it stays fixed.' }
    ],
    terms: [
      ['profiler', 'A tool that reports where a program spends its time.'],
      ['deterministic profiler', 'Records every function call and return (cProfile). Exact counts, with overhead on each call.'],
      ['sampling profiler', 'Looks at the call stack many times a second (py-spy). Low overhead and statistical.'],
      ['flame graph', 'Stacks drawn as bars: width = share of samples, vertical = call depth. Merged and sorted, not ordered by time.'],
      ['vectorization', 'Doing one operation on a whole array at once, so the loop runs in compiled code instead of Python bytecode.'],
      ['C extension', 'A module compiled from C, C++, Cython or Rust that Python imports like any other. NumPy, orjson and pydantic-core are examples.']
    ]
  },
  visual: {
    title: 'From samples to a flame graph to a fix',
    caption: 'A request handler with an N+1 query and string building in a loop. Press <b>Play</b> or <b>Step</b>: the sampler takes stack snapshots over time, they are merged into a flame graph, and the cProfile table tells you <i>why</i> the wide bar is wide. Then flip to <b>after the fix</b>. The numbers are an illustrative example, not a benchmark.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'cProfile + pstats', code: `import cProfile, pstats, io

def db_query(uid):            # pretend each call is a round trip
    return sum(i * i for i in range(2000))

def load_users(ids):
    return [db_query(i) for i in ids]          # N+1: one query per id

def render(rows):
    out = ""
    for r in rows:
        out += f"<tr><td>{r}</td></tr>"
    return out

def handle_request():
    rows = load_users(range(300))
    return render(rows)

pr = cProfile.Profile()
pr.enable()
handle_request()
pr.disable()

s = io.StringIO()
pstats.Stats(pr, stream=s).sort_stats("cumulative").print_stats(8)
print(s.getvalue())`, note: '<code>ncalls</code> shows the N+1 (300 calls of <code>db_query</code>); <code>tottime</code> shows that the generator expression inside it is where the time actually goes.' },
      { label: 'list vs set membership', code: `import timeit

ids = list(range(20_000))
as_set = set(ids)
lookups = list(range(19_000, 20_000))

t_list = timeit.timeit(lambda: [x in ids for x in lookups], number=5)
t_set = timeit.timeit(lambda: [x in as_set for x in lookups], number=5)
print(f"list: {t_list:.3f}s   set: {t_set:.4f}s   ratio ~{t_list / t_set:.0f}x")
# x in list = linear scan (O(n)); x in set = one hash lookup (O(1) average)` },
      { label: 'Building strings', code: `import timeit

parts = [str(i) for i in range(50_000)]

def concat():
    s = ""
    for p in parts:
        s = s + p + ","      # a new string each time
    return s

def join():
    return ",".join(parts) + ","

print("same result:", concat() == join())
print("concat:", round(timeit.timeit(concat, number=3), 3), "s")
print("join  :", round(timeit.timeit(join, number=3), 4), "s")`, note: 'CPython can sometimes extend a string in place for <code>s += x</code> when nothing else references it, but you can’t rely on that. <code>str.join</code> sizes the result once.' },
      { label: 'Why local names are faster', code: `import dis, math, timeit

def global_lookup(n):
    total = 0.0
    for i in range(n):
        total += math.sqrt(i)          # LOAD_GLOBAL math, LOAD_ATTR sqrt, every iteration
    return total

def local_lookup(n, sqrt=math.sqrt):
    total = 0.0
    for i in range(n):
        total += sqrt(i)               # LOAD_FAST: an array index
    return total

def builtin_version(n):
    return sum(map(math.sqrt, range(n)))   # the loop runs in C

for f in (global_lookup, local_lookup, builtin_version):
    print(f"{f.__name__:16}", round(timeit.timeit(lambda: f(200_000), number=3), 3), "s")

print()
dis.dis(global_lookup)`, note: 'Micro-optimisations like this matter only inside genuinely hot loops. Moving the loop into C (<code>sum(map(...))</code>, NumPy) usually helps more.' },
      { label: 'Memory: list vs generator', code: `import tracemalloc

def as_list(n):
    return sum([i * 2 for i in range(n)])      # builds the whole list first

def as_gen(n):
    return sum(i * 2 for i in range(n))        # one item at a time

for f in (as_list, as_gen):
    tracemalloc.start()
    f(1_000_000)
    _, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    print(f"{f.__name__:8} peak {peak / 1e6:6.2f} MB")`, note: 'Use <code>tracemalloc</code> snapshots (or memray / py-spy for native code) to find memory hot spots the same way as CPU ones.' },
      { label: 'Cache repeated work', code: `from functools import lru_cache
import timeit

def price_slow(sku: str) -> float:
    return sum(ord(c) for c in sku * 2000) / 1000     # pretend this is expensive

@lru_cache(maxsize=1024)
def price_cached(sku: str) -> float:
    return price_slow(sku)

orders = ["A1", "B2", "A1", "C3", "A1", "B2"] * 200

print("slow  :", round(timeit.timeit(lambda: [price_slow(s) for s in orders], number=1), 3), "s")
print("cached:", round(timeit.timeit(lambda: [price_cached(s) for s in orders], number=1), 3), "s")
print(price_cached.cache_info())`, note: 'Only cache pure functions with hashable arguments, and bound the cache: <code>maxsize=None</code> on a key space you don’t control is a memory leak.' }
    ]
  },
  gotchas: [
    { trap: 'Trusting cProfile’s absolute numbers', why: 'cProfile adds work to every call and return. Code that makes millions of tiny calls looks much slower under the profiler than without it, and the ranking can shift towards call-heavy functions.', fix: 'Use cProfile for <b>structure</b> (call counts, who calls whom). For realistic proportions use a sampling profiler (py-spy, pyinstrument), and confirm a fix with a plain timer or <code>timeit</code>, never with the profiler on.' },
    { trap: 'py-spy shows nothing slow, but requests take seconds', code: `py-spy record --pid 4121 -o cpu.svg          # idle threads excluded: only CPU work
py-spy record --pid 4121 -o wall.svg --idle   # include threads blocked on I/O and locks`, lang: 'bash', why: 'By default py-spy leaves out idle threads. Time spent waiting on a socket, a lock or a slow database never appears, so an I/O-bound service looks “fast”. In asyncio apps the waiting shows up as the event loop sitting in <code>select</code>.', fix: 'Use <code>--idle</code> to see wall-clock time, and for I/O latency use tracing (OpenTelemetry spans around DB and HTTP calls) rather than a CPU profiler.' },
    { trap: '<code>np.vectorize</code> is not vectorization', code: `f = np.vectorize(lambda x: x * 2 if x > 0 else 0)
f(arr)                          # a Python-level loop with extra overhead
np.where(arr > 0, arr * 2, 0)   # real vectorization: loops run in C`, why: 'NumPy’s own docs say <code>vectorize</code> is “provided primarily for convenience, not for performance”: it calls your Python function once per element.', fix: 'Express the logic with array operations: arithmetic, comparisons, <code>np.where</code>, <code>np.select</code>, boolean masks, ufuncs and their <code>.reduce</code>/<code>.accumulate</code>. If it really can’t be expressed that way, use Numba or Cython.' },
    { trap: 'Indexing NumPy arrays one element at a time', code: `total = 0
for i in range(len(arr)):
    total += arr[i]       # each arr[i] creates a NumPy scalar object
# often slower than the same loop over a plain list`, why: 'A NumPy array stores raw machine numbers. Each Python-level access must box one into a new object, so mixing Python loops with arrays gets the worst of both.', fix: 'Do whole-array operations (<code>arr.sum()</code>), or convert once with <code>arr.tolist()</code> if you really must loop in Python.' },
    { trap: 'Quadratic “append in a loop”', code: `for chunk in chunks:
    df = pd.concat([df, chunk])     # copies everything so far, every time
    arr = np.append(arr, chunk)     # same: a new array each time`, why: 'DataFrames and NumPy arrays are fixed-size blocks; growing one copies it. N appends cost O(N²) copying. (A Python <code>list.append</code> is amortised O(1).)', fix: 'Collect pieces in a list and combine once: <code>pd.concat(pieces)</code>, <code>np.concatenate(pieces)</code>, or preallocate with <code>np.empty(n)</code> and fill it.' },
    { trap: 'Membership tests against a list', code: `seen = []
for row in rows:              # 200k rows
    if row.id not in seen:    # linear scan each time: ~2e10 comparisons
        seen.append(row.id)`, why: '<code>x in list</code> compares against every element. Inside a loop over the same data that is O(n²), invisible on test data and fatal on production data.', fix: 'Use a <code>set</code> (or a <code>dict</code> for lookups): hashing makes membership O(1) on average. For order-preserving de-duplication: <code>list(dict.fromkeys(ids))</code>.' },
    { trap: 'Expecting threads to speed up CPU-bound Python', why: 'On the default (GIL) build of CPython, only one thread runs Python bytecode at a time, so 8 threads computing in pure Python are no faster than 1. See <a href="gil.html">The GIL</a>.', fix: 'For CPU work: <code>ProcessPoolExecutor</code>, or NumPy and C extensions that release the GIL while they run, or the free-threaded build (3.13t experimental, 3.14t+ supported) once your dependencies support it. Threads are fine for I/O.' }
  ],
  scenarios: [
    { title: 'One worker pinned at 100% CPU, requests time out',
      symptom: 'After a release that added input validation, one gunicorn worker at a time went to 100% CPU and stopped answering. Restarts helped for a while.',
      diagnose: `$ py-spy dump --pid 31877
Thread 31877 (active): "MainThread"
    match (re/__init__.py)              <- stuck here for minutes
    validate_label (orders/validation.py:41)
    create_order (orders/api.py:88)
    ...
# the pattern on line 41:
LABEL = re.compile(r"^(\\w+\\s?)*$")`,
      cause: 'Catastrophic backtracking. On a long label that <i>almost</i> matches (words followed by one invalid character), the nested quantifier makes the regex engine try an exponential number of ways to split the words before it fails.',
      fix: 'Rewrite the pattern without nested quantifiers. Since 3.11, <code>re</code> also supports possessive quantifiers and atomic groups, which stop backtracking into a group. Cap input length before matching, and add the bad input as a test case.',
      fixCode: `LABEL = re.compile(r"^\\w+(?:\\s\\w+)*$")     # no ambiguity: one way to match
# or, 3.11+: an atomic group never gives back what it matched
LABEL = re.compile(r"^(?>\\w+\\s?)*$")
if len(label) > 200:
    raise ValueError("label too long")` },
    { title: 'Nightly reconciliation went from 20 minutes to 6 hours',
      symptom: 'A job that matches bank transactions to invoices slowed down sharply over a few months, while the data only doubled.',
      diagnose: `python -m cProfile -s tottime reconcile.py 2>&1 | head -12
#    ncalls  tottime  cumtime  filename:lineno(function)
#         1  20711.4  21340.2  reconcile.py:58(match_all)
#   ...
# line 61:  if txn.ref in invoice_refs:     # invoice_refs is a list`,
      lang: 'bash',
      cause: 'Each transaction was checked against a <b>list</b> of invoice references. That is O(transactions × invoices); when both doubled, the work grew about four times, and it kept growing quadratically. The time is in <code>tottime</code> of <code>match_all</code> itself, because <code>in</code> on a list runs inside the caller’s frame, not as a separate Python call.',
      fix: 'Build a dict keyed by reference once (O(n)), then look up each transaction in O(1).',
      fixCode: `invoices_by_ref = {inv.ref: inv for inv in invoices}
for txn in transactions:
    inv = invoices_by_ref.get(txn.ref)
    if inv is not None:
        match(txn, inv)` },
    { title: 'Feature pipeline: row-wise pandas takes most of an hour',
      symptom: 'A feature-engineering step for an ML model was the slowest part of training. py-spy showed almost all samples under <code>DataFrame.apply</code> and a Python lambda.',
      diagnose: `df["risk"] = df.apply(
    lambda r: r.amount / r.limit if r.limit > 0 and r.country != "XX" else 0.0,
    axis=1)                       # one Python call (and one Series object) per row`,
      cause: '<code>apply(axis=1)</code> is a Python loop. It builds a Series object for every row, then calls the lambda. On millions of rows the overhead dwarfs the arithmetic.',
      fix: 'Express the rule over whole columns. The comparison, division and selection all run as compiled loops over contiguous arrays.',
      fixCode: `ok = (df["limit"] > 0) & (df["country"] != "XX")
df["risk"] = np.where(ok, df["amount"] / df["limit"].where(ok, 1), 0.0)
# typically orders of magnitude faster; check with %timeit on a sample` }
  ],
  puzzles: [
    { kind: 'predict', q: 'How many times does <code>score</code> run in each version?', code: `calls = 0

def score(x):
    global calls
    calls += 1
    return x * 2

data = range(10)
a = [score(x) for x in data if score(x) > 10]
print(calls, a)

calls = 0
b = [y for x in data if (y := score(x)) > 10]
print(calls, b)`, options: ['10 [12, 14, 16, 18]<br>10 [12, 14, 16, 18]', '14 [12, 14, 16, 18]<br>10 [12, 14, 16, 18]', '20 [12, 14, 16, 18]<br>10 [12, 14, 16, 18]', '14 [12, 14, 16, 18]<br>14 [12, 14, 16, 18]'], answer: 1, run: true, expect: '14 [12, 14, 16, 18]\n10 [12, 14, 16, 18]', explain: 'The filter calls <code>score</code> for all 10 items, and the expression calls it again for the 4 that pass (x = 6..9): 14 calls. The walrus operator (3.8+) keeps the value from the filter, so each item is scored once. With an expensive function or a DB call, that is a real saving.' },
    { kind: 'predict', q: 'How many <code>__eq__</code> calls does each membership test make?', code: `class K:
    eq = 0
    def __init__(self, v):
        self.v = v
    def __eq__(self, other):
        K.eq += 1
        return self.v == other.v
    def __hash__(self):
        return hash(self.v)

items = [K(i) for i in range(100)]
target = K(99)

_ = target in items
print(K.eq)

as_set = set(items)
K.eq = 0
_ = target in as_set
print(K.eq)`, options: ['100<br>1', '99<br>0', '100<br>100', '1<br>1'], answer: 0, run: true, expect: '100\n1', explain: 'A list is scanned in order: identity is checked first, then <code>==</code>, for each of the 100 elements until a match (the last one). A set hashes the target, jumps to its slot, and calls <code>__eq__</code> only on entries whose stored hash is equal: 1 call. That is O(n) vs O(1).' },
    { kind: 'predict', q: 'What does this print?', code: `from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)

fib(30)
print(fib.cache_info())`, options: ['CacheInfo(hits=28, misses=31, maxsize=None, currsize=31)', 'CacheInfo(hits=0, misses=31, maxsize=None, currsize=31)', 'CacheInfo(hits=29, misses=30, maxsize=None, currsize=30)', 'CacheInfo(hits=1346268, misses=31, maxsize=None, currsize=31)'], answer: 0, run: true, expect: 'CacheInfo(hits=28, misses=31, maxsize=None, currsize=31)', explain: 'Each of fib(0)…fib(30) is computed once: 31 misses. The left call <code>fib(n-1)</code> is evaluated first and fills the cache, so for n = 3…30 the right call <code>fib(n-2)</code> is a hit: 28 hits. Without the cache this takes about 2.7 million calls; with it, 59.' },
    { kind: 'bug', q: 'How many times does <code>expensive()</code> run?', code: `calls = 0

def expensive():
    global calls
    calls += 1
    return []

d = {"a": [1]}
for _ in range(3):
    d.setdefault("a", expensive())
print(calls, d)`, options: ['0 {\'a\': [1]}', '1 {\'a\': [1]}', '3 {\'a\': [1]}', '3 {\'a\': []}'], answer: 2, run: true, expect: "3 {'a': [1]}", explain: 'Arguments are evaluated <b>before</b> the call, so the default is built every time even though the key exists and the default is thrown away. Use <code>if key not in d: d[key] = expensive()</code>, or <code>collections.defaultdict</code>, which calls the factory only on a miss.' },
    { kind: 'concept', q: 'Which function would you optimise first?', code: `   ncalls  tottime  cumtime  function
        1    0.002    9.810  handle_request
        1    0.010    6.020  load_users
      400    5.900    5.950  db_query
        1    3.700    3.770  render
      400    0.050    0.050  build_user`, lang: 'text', options: ['handle_request: the highest cumtime', 'db_query: almost all of load_users, and 400 calls suggest an N+1', 'build_user: called 400 times', 'render: it has the highest tottime per call'], answer: 1, explain: '<code>handle_request</code>’s cumtime only says everything is under it. <code>db_query</code> has about 60% of the total in <code>tottime</code>, and 400 calls for one request points to batching (one query with <code>WHERE id = ANY(…)</code>). <code>render</code> is next: 3.7 s of its own time in a single call suggests a slow loop inside it.' },
    { kind: 'concept', q: 'What does this NumPy code produce?', code: `import numpy as np
a = np.arange(6).reshape(2, 3)        # [[0, 1, 2], [3, 4, 5]]
b = np.array([10, 20, 30])
print((a + b).tolist(), a.sum(axis=0).tolist())`, options: ['[[10, 21, 32], [13, 24, 35]] [3, 5, 7]', 'ValueError: shapes (2,3) and (3,) not aligned', '[[10, 20, 30], [10, 20, 30]] [3, 12]', '[[10, 21, 32], [13, 24, 35]] [3, 12]'], answer: 0, explain: 'Broadcasting lines shapes up from the right: (2, 3) + (3,) treats <code>b</code> as a row added to each row of <code>a</code>. <code>axis=0</code> collapses the rows, giving one sum per column: [0+3, 1+4, 2+5]. Both loops run in C, with no Python bytecode per element.' },
    { kind: 'concept', q: 'You move a hot loop into a Cython function and call it from 8 threads. When can the threads run it in parallel on the default (GIL) build?', options: ['Always: compiled code ignores the GIL', 'Only if the function releases the GIL (<code>with nogil:</code>) and touches no Python objects in that block', 'Never: use processes', 'Only on Python 3.13'], answer: 1, explain: 'Compiled code still holds the GIL unless it explicitly releases it. Cython’s <code>with nogil:</code>, or <code>Py_BEGIN_ALLOW_THREADS</code> in C, lets other threads run while it crunches typed C data. NumPy releases the GIL inside many array operations, which is why threads can help with NumPy-heavy work.' },
    { kind: 'concept', q: 'A flame graph from py-spy shows a wide bar for <code>json.dumps</code> under <code>send_response</code>. What does the <b>width</b> mean?', options: ['How long one call took', 'The share of samples in which that frame was on the stack, summed over all calls', 'How many times it was called', 'Its position in time: it ran first'], answer: 1, explain: 'A flame graph merges identical stacks and sorts them, usually alphabetically, so the x-axis is <b>not time</b>. Width = how often the frame was on the stack when a sample was taken, i.e. its share of total time, including its children. One slow call and many fast ones look the same; cProfile’s <code>ncalls</code> tells them apart.' }
  ],
  interview: [
    { q: 'How do you approach “this Python service is slow”?', a: '<ol><li>Define slow: latency (p50/p99), throughput, or CPU cost, and get a reproducible case.</li><li>Decide between CPU-bound and I/O-bound: CPU usage, plus tracing spans for DB and HTTP calls.</li><li>CPU-bound: py-spy on the live process, or cProfile on a reproduction. I/O-bound: look for N+1 queries, missing indexes, sequential awaits that could be concurrent, and blocking calls in async code.</li><li>Fix the widest thing, measure again, and add a regression benchmark.</li></ol>', lvl: 'core' },
    { q: 'cProfile vs py-spy vs line_profiler vs memray: when would you use each?', a: '<ul><li><b>cProfile</b> (stdlib, deterministic): exact call counts and the call graph, in dev or CI. Has per-call overhead.</li><li><b>py-spy</b> (sampling, out-of-process, written in Rust): production-safe, attaches by PID, <code>dump</code> for “what is it doing right now?”, <code>record</code> for flame graphs, <code>--native</code> for C frames.</li><li><b>pyinstrument</b>: a sampling call tree, aware of async code.</li><li><b>line_profiler</b>: per-line timings for one function you already suspect.</li><li><b>memray / tracemalloc</b>: allocations and memory peaks; memray also tracks native allocations.</li></ul>', lvl: 'core' },
    { q: 'Why is a Python loop slow compared with Java’s?', a: '<p>CPython interprets bytecode. Each <code>a + b</code> looks up the types of boxed objects, dispatches to their implementation, allocates a new int object for the result (except cached small ints) and adjusts reference counts. HotSpot JIT-compiles the hot loop to machine code with unboxed primitives. Since 3.11 CPython specializes bytecodes for the types it sees, which helps a lot, and 3.13 added an experimental JIT (still experimental and off by default in 3.14 and 3.15, where it got faster), but a tight numeric loop is still far slower than Java or C. So you move the loop into C: builtins, NumPy, or compiled extensions.</p>', lvl: 'core' },
    { q: 'What does NumPy vectorization actually buy you?', a: '<p>An <code>ndarray</code> is one contiguous block of same-typed machine values. A ufunc such as <code>a * b + c</code> runs a compiled loop over it: no per-element object, no dispatch, and SIMD where possible. Broadcasting applies an operation across shapes without copying data. The costs: temporaries for each sub-expression (use <code>out=</code> or numexpr for very large arrays), and anything that falls back to <code>dtype=object</code> is back to Python speed.</p>', lvl: 'core' },
    { q: 'What are your options for compiled code, and how do you pick?', a: '<ul><li><b>Cython</b>: Python-like syntax with C types; great for hot numeric loops and for wrapping C libraries.</li><li><b>Numba</b>: a JIT for NumPy-style functions with <code>@njit</code>; little code change, numeric code only.</li><li><b>Rust + PyO3/maturin</b>: memory-safe, strong for parsers and serializers (pydantic-core, orjson and polars are built this way).</li><li><b>pybind11 / nanobind</b>: binding existing C++.</li><li><b>ctypes / cffi</b>: call an existing shared library without writing an extension.</li><li><b>mypyc</b>: compiles type-annotated Python modules (mypy itself uses it).</li></ul><p>First, check whether an existing library already does it.</p>', lvl: 'deep' },
    { q: 'Name common slow patterns you look for in code review.', a: '<ul><li><code>in</code> on a list inside a loop (use a set or dict).</li><li>Queries or HTTP calls inside a loop (batch them, or use <code>asyncio.gather</code>).</li><li>Growing DataFrames or arrays in a loop; <code>DataFrame.iterrows</code> / <code>apply(axis=1)</code>.</li><li>String building with <code>+</code> in a loop (use <code>join</code>, or write to <code>io.StringIO</code>).</li><li>Repeated expensive work (parse, compile, load a model) per request instead of once at startup.</li><li><code>copy.deepcopy</code> of large structures; JSON (de)serialising big payloads with the stdlib where orjson would do.</li><li>Formatting log messages that are never emitted: f-strings in <code>log.debug</code>.</li></ul>', lvl: 'core' },
    { q: 'What changed for performance in Python 3.11 to 3.15?', a: '<p><b>3.11</b>: the specializing adaptive interpreter (PEP 659), cheaper frames, and “zero-cost” exception handling, where a <code>try</code> costs almost nothing unless something is raised: about 25% faster on average. <b>3.12</b>: comprehensions inlined (PEP 709), per-interpreter GIL in the C API (PEP 684), <code>sys.monitoring</code> (PEP 669) for cheaper profilers and coverage, and <code>-X perf</code>. <b>3.13</b>: an experimental copy-and-patch JIT (PEP 744, a build option, off by default) and the experimental free-threaded build (PEP 703). <b>3.14</b>: the free-threaded build is officially supported (PEP 779), the official Windows and macOS binaries include the experimental JIT (off unless you enable it), and a new tail-call interpreter is an opt-in build option. The incremental cycle collector shipped in 3.14.0 was reverted in 3.14.5. <b>3.15</b>: the JIT got a new tracing front end and better optimisations (the docs report about 7–8% over the standard interpreter on x86-64 Linux, geometric mean); explicit <code>lazy import</code> (PEP 810) cuts start-up time; and the new <code>profiling</code> package adds a sampling profiler that attaches to a running process (PEP 799).</p>', lvl: 'deep' },
    { q: 'How do you benchmark a change without fooling yourself?', a: '<p>Use <code>timeit</code> (or pyperf for serious work), which repeats runs, disables GC during timing and reports the best or median. Warm up caches and imports first. Use realistic data sizes, since O(n²) code looks fine on 100 rows. Run on a quiet machine, compare distributions rather than single runs, and confirm on production-like hardware. Remove the profiler before timing.</p>', lvl: 'core' },
    { q: 'How would you profile a production container safely?', a: '<p>Run <code>py-spy dump --pid N</code> to see each thread’s stack once, or <code>py-spy record --duration 30 --pid N -o out.svg</code>. The container needs the <code>SYS_PTRACE</code> capability (or run py-spy from a privileged debug container sharing the PID namespace, for example <code>kubectl debug --target</code>). Overhead is small because py-spy reads memory from outside the process. For continuous profiling, use an agent such as Pyroscope or Datadog, which do the same sampling.</p>', lvl: 'deep' },
    { q: 'When is Python fast enough, and when would you not use it?', a: '<p>For I/O-bound services (APIs, agents calling LLMs, ETL glue) the interpreter is rarely the bottleneck: the network is. Numeric work is fast through NumPy, PyTorch or polars. Python is a poor fit for tight per-element CPU logic that can’t be vectorized and needs low, predictable latency, such as a high-frequency matching engine. There, a JVM, Go or Rust service (or a Rust extension) is the better tool.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Profiling commands', lang: 'bash', code: `# deterministic, dev/CI
python -m cProfile -o out.prof -m orders_svc.jobs.reconcile
python -c "import pstats; pstats.Stats('out.prof').sort_stats('cumtime').print_stats(25)"
uvx snakeviz out.prof                       # browse the call tree

# sampling, production (needs ptrace: SYS_PTRACE capability)
py-spy top    --pid 4121                    # live "top" per function
py-spy dump   --pid 4121 --locals           # every thread's stack, right now
py-spy record --pid 4121 --duration 30 -o cpu.svg
py-spy record --pid 4121 --idle -o wall.svg      # include waiting threads
py-spy record --native -o native.svg -- python train.py   # include C/C++ frames

# Linux perf with Python frame names (3.12+)
python -X perf train.py &  perf record -F 999 -g -p $! ;  perf report

# memory
python -m memray run -o mem.bin train.py && python -m memray flamegraph mem.bin` },
    { title: 'Vectorize with NumPy', lang: 'python', code: `import numpy as np

# Loop version: ~1 Python-level iteration per row
def zscores_loop(values: list[float]) -> list[float]:
    mean = sum(values) / len(values)
    var = sum((v - mean) ** 2 for v in values) / len(values)
    sd = var ** 0.5
    return [(v - mean) / sd for v in values]

# Vectorized: the loops run in compiled code over a contiguous float64 block
def zscores(values: np.ndarray) -> np.ndarray:
    return (values - values.mean()) / values.std()

# Conditional logic without a Python loop
def risk(amount: np.ndarray, limit: np.ndarray, blocked: np.ndarray) -> np.ndarray:
    ok = (limit > 0) & ~blocked
    return np.where(ok, amount / np.where(ok, limit, 1), 0.0)

# Pairwise distances by broadcasting: (n, 1, d) - (1, m, d) -> (n, m, d)
def nearest(queries: np.ndarray, points: np.ndarray) -> np.ndarray:
    d2 = ((queries[:, None, :] - points[None, :, :]) ** 2).sum(axis=-1)
    return d2.argmin(axis=1)          # watch memory: n*m*d temporaries`, note: 'For embeddings at scale, use a matrix product (<code>q @ p.T</code>) or a vector index (FAISS, pgvector) rather than full broadcasting.' },
    { title: 'Cython hot loop', lang: 'python', code: `# fastdist.pyx  (Cython syntax; build with cythonize or a pyproject backend)
# cython: boundscheck=False, wraparound=False
from libc.math cimport sqrt

def total_distance(double[:, ::1] pts) -> double:
    cdef Py_ssize_t i, n = pts.shape[0]
    cdef double dx, dy, total = 0.0
    with nogil:                       # no Python objects inside: other threads may run
        for i in range(1, n):
            dx = pts[i, 0] - pts[i - 1, 0]
            dy = pts[i, 1] - pts[i - 1, 1]
            total += sqrt(dx * dx + dy * dy)
    return total

# usage from Python:
#   import numpy as np, fastdist
#   fastdist.total_distance(np.ascontiguousarray(track, dtype=np.float64))`, note: 'Typed memoryviews (<code>double[:, ::1]</code>) give C-speed indexing into NumPy buffers. Try a NumPy expression or Numba <code>@njit</code> first; reach for Cython when you need C types, <code>nogil</code> or a C library.' },
    { title: 'Java comparison', lang: 'java', code: `// JVM                                     // CPython
// JIT compiles hot loops to machine code    // interpreter + specialization (3.11+); JIT experimental (3.13–3.15)
// primitives (int, double) unboxed           // every int/float is a heap object
// async-profiler / JFR flame graphs          // py-spy record / -X perf with Linux perf
// JMH microbenchmarks                        // timeit / pyperf
// threads scale CPU work across cores        // GIL build: processes, NumPy or C extensions that release the GIL
// JNI / Panama for native code               // C extensions, Cython, PyO3, ctypes/cffi

// The habit to unlearn: in Java, a simple loop is usually the fast path.
// In Python, the fast path is to make one call into compiled code that
// does the whole loop: sum(), sorted(), set ops, NumPy, SQL.`, note: 'An AI-agent service is usually I/O-bound (model and tool calls). Profile before porting anything to another language.' }
  ]
});

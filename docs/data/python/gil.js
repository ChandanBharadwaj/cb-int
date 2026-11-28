IA.register({
  track: 'python',
  slug: 'gil',
  title: 'The GIL & free-threading',
  tagline: 'In the default CPython build, one lock, the <b>Global Interpreter Lock</b>, lets only one thread run Python bytecode at a time. Threads still help for I/O, because blocking calls release the lock, but pure-Python CPU work doesn’t get faster. A separate <b>free-threaded</b> build (PEP 703) removes it: experimental in 3.13, officially supported since 3.14, still not the default in 3.15.',
  tldr: {
    problem: 'A Java developer adds a thread pool to a CPU-heavy Python job and it gets slower. Another team assumes “the GIL makes it thread-safe” and loses counter updates in production. Both are misreadings of what the GIL does.',
    model: 'A thread must hold the GIL to execute bytecode. It <b>releases</b> it around blocking I/O, <code>time.sleep</code> and inside C code that opts out (NumPy, hashlib, zlib…). A thread that waits longer than the <b>switch interval</b> (5 ms) asks the holder to drop it. So: I/O-bound threads overlap; CPU-bound pure-Python threads take turns on one core.',
    hook: '“Is <code>counter += 1</code> thread-safe because of the GIL?” No. It is several bytecodes (load, add, store), and a switch between the load and the store loses an update. The GIL protects the <i>interpreter’s</i> invariants, not yours.',
    facts: [
      { v: '5 ms', l: 'default <code>sys.getswitchinterval()</code>: how long a waiting thread waits before asking the running thread to drop the GIL (the “new GIL”, 3.2+)' },
      { v: '1', l: 'thread executing Python bytecode at any instant, per interpreter, in the default build, however many cores you have' },
      { v: '3.13t → 3.15t', l: 'the free-threaded build (PEP 703): experimental in 3.13, officially supported since 3.14 (PEP 779), optional in 3.15. <code>sys._is_gil_enabled()</code> (3.13+) tells you whether the GIL is actually off at run time' }
    ]
  },
  intro: {
    what: 'A <b>thread</b> is a separate line of execution inside one program; several threads share the same memory. In most languages, threads on a multi-core machine can run truly at the same time. Standard CPython adds one rule: to run Python code, a thread must hold a single lock, the <b>GIL</b>. So only one thread runs Python at a time. Threads still pay off when they spend most of their time <i>waiting</i> (for the network, the disk, a database), because a waiting thread hands the lock to someone else.',
    analogy: { icon: '🎤', title: 'One microphone at a meeting', text: 'Everybody in the room can think in parallel, but only the person holding the microphone can speak. When a speaker has to go and fetch a document (I/O), they put the microphone down and someone else talks. If two people both just want to talk (CPU work), they take turns, and the meeting takes as long as all their talking added together. The free-threaded build hands out a microphone to everyone.' },
    steps: [
      { t: 'Threads share memory', d: 'Every thread sees the same objects. That is convenient, and it is also why races happen.', code: 'import threading\nresults = []\ndef work(i): results.append(i * i)\nts = [threading.Thread(target=work, args=(i,)) for i in range(4)]\nfor t in ts: t.start()\nfor t in ts: t.join()' },
      { t: 'Only one runs Python at a time', d: 'The GIL is held while bytecode executes. Two CPU-heavy threads interleave on one core, roughly every 5 ms.' },
      { t: 'Waiting releases the lock', d: '<code>socket.recv</code>, <code>file.read</code>, <code>time.sleep</code>, database drivers waiting on the network: all release the GIL, so other threads run meanwhile.' },
      { t: 'CPU work needs processes (or C)', d: 'For pure-Python number crunching, use <code>multiprocessing</code> / <code>ProcessPoolExecutor</code>, or libraries like NumPy that do the work in C without the GIL. See <a href="threading-multiprocessing.html">Threads vs processes</a>.' },
      { t: 'Free-threaded Python (3.13+)', d: 'A separate build, usually installed as <code>python3.13t</code> (or <code>3.14t</code>, <code>3.15t</code>), removes the GIL. It was experimental in 3.13 and is officially supported from 3.14. It is still not the default build. Extensions must declare support or the GIL comes back.' }
    ],
    terms: [
      ['GIL', 'Global Interpreter Lock: a mutex each interpreter holds while running bytecode.'],
      ['CPU-bound', 'Limited by computation (parsing, math, compression in pure Python).'],
      ['I/O-bound', 'Limited by waiting on something external (network, disk, database).'],
      ['switch interval', '<code>sys.getswitchinterval()</code>, 0.005 s by default: how long a waiter waits before requesting the GIL.'],
      ['race condition', 'A bug where the result depends on how threads happen to interleave.'],
      ['free-threaded build', 'CPython compiled with <code>--disable-gil</code> (PEP 703). Its binaries usually end in <code>t</code>.']
    ]
  },
  visual: {
    title: 'Who holds the GIL, millisecond by millisecond',
    caption: 'Pick a workload and press <b>Play</b>, or <b>Step</b> from one event to the next. Solid bars run bytecode, hatched bars are waiting for the GIL, striped green bars are blocked in I/O with the GIL released. Compare the wall time with the CPU time, and try the free-threaded build on the same CPU-bound work.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Is the GIL on?', code: `import sys, sysconfig

print(sys.version.split()[0])
print("built free-threaded:", bool(sysconfig.get_config_var("Py_GIL_DISABLED")))
check = getattr(sys, "_is_gil_enabled", None)       # 3.13+
print("GIL enabled right now:", check() if check else "True (pre-3.13 builds always have it)")
print("switch interval:", sys.getswitchinterval(), "s")`, note: 'This playground is CPython 3.12 compiled to WebAssembly, with no real threads, so it always reports the GIL.' },
      { label: 'Why += isn’t atomic', code: `import dis

n = 0
def inc():
    global n
    n += 1

dis.dis(inc)
print()
print("A thread switch can happen between the LOAD and the STORE.")
print("Two threads that both LOAD 41 will both STORE 42: one update lost.")` },
      { label: 'Lost update, replayed', code: `# Each generator is a "thread". yield marks where the interpreter switched threads.
shared = {"n": 0}
log = []

def worker(name, times):
    for _ in range(times):
        tmp = shared["n"]                 # LOAD
        log.append(f"{name} loads  {tmp}")
        yield                             # <- GIL handed to the other thread here
        shared["n"] = tmp + 1             # ADD + STORE
        log.append(f"{name} stores {tmp + 1}")

threads = [worker("A", 3), worker("B", 3)]
while threads:
    for t in list(threads):
        try:
            next(t)
        except StopIteration:
            threads.remove(t)

print("\\n".join(log))
print("expected 6, got", shared["n"])`, note: 'Real switches are rarer and timing-dependent, which is exactly why these bugs pass tests and fail in production.' },
      { label: 'Simulated GIL scheduler', code: `def simulate(plan, interval=5):
    """plan: thread -> list of ("cpu", ms) / ("io", ms). One GIL, FIFO waiters."""
    t, ready, blocked, log = 0, list(plan), {}, []
    work = {n: [list(op) for op in ops] for n, ops in plan.items()}
    while ready or blocked:
        for n, end in sorted(blocked.items(), key=lambda kv: kv[1]):
            if end <= t:
                del blocked[n]
                if work[n]:
                    ready.append(n)
        if not ready:
            t = min(blocked.values()); continue
        n = ready.pop(0)
        op = work[n][0]
        run = min(op[1], interval) if ready else op[1]
        log.append(f"{t:>4} ms  {n} runs {run} ms")
        t += run; op[1] -= run
        if op[1] == 0:
            work[n].pop(0)
            if work[n] and work[n][0][0] == "io":
                ms = work[n].pop(0)[1]
                blocked[n] = t + ms
                log.append(f"{t:>4} ms  {n} blocks on I/O for {ms} ms (GIL released)")
                continue
        if work[n]:
            ready.append(n)
    return t, log

cpu = {"T1": [("cpu", 15)], "T2": [("cpu", 15)], "T3": [("cpu", 15)]}
io = {f"T{i}": [("cpu", 2), ("io", 40), ("cpu", 2)] for i in (1, 2, 3)}

for name, plan in [("CPU-bound", cpu), ("I/O-bound", io)]:
    wall, log = simulate(plan)
    busy = sum(ms for ops in plan.values() for kind, ms in ops if kind == "cpu")
    serial = sum(ms for ops in plan.values() for _, ms in ops)
    print(f"--- {name}: wall {wall} ms, CPU {busy} ms, one-thread-at-a-time total {serial} ms")
    print("\\n".join(log))`, note: 'CPU-bound: wall time = total CPU time, so threads bought nothing. I/O-bound: the 40 ms waits overlap.' },
      { label: 'Overlap: I/O yes, CPU no', code: `import asyncio, time

def spin(ms):                          # CPU work: holds the interpreter
    end = time.perf_counter() + ms / 1000
    while time.perf_counter() < end:
        pass

async def io_job():
    await asyncio.sleep(0.2)           # waiting: others can run

async def cpu_job():
    spin(200)

for label, job in [("I/O", io_job), ("CPU", cpu_job)]:
    t0 = time.perf_counter()
    await asyncio.gather(*(job() for _ in range(3)))
    print(f"3 x {label} jobs of 200 ms took {time.perf_counter() - t0:.2f} s")`, note: 'Same principle as threads under the GIL, shown with asyncio because the playground has no threads. In a normal script you would wrap this in <code>asyncio.run(main())</code>.' }
    ]
  },
  gotchas: [
    { trap: 'Threads to speed up pure-Python CPU work', code: `with ThreadPoolExecutor(8) as ex:          # 8 cores, still ~1 core of work
    results = list(ex.map(parse_pdf_pure_python, files))`, why: 'Only one thread runs bytecode at a time. You add switching and lock contention on top of the same serial work, so it is often slightly slower than a loop.', fix: 'Use <code>ProcessPoolExecutor</code> (with chunked inputs), push the hot loop into C (NumPy, a compiled extension), or evaluate the free-threaded build once your dependencies support it.' },
    { trap: '“The GIL makes my code thread-safe”', code: `if key not in cache:            # thread A checks
    cache[key] = build(key)     # thread B checked too: build() runs twice
counter += 1                    # load / add / store: updates can be lost`, why: 'The GIL keeps the interpreter’s own data structures consistent: refcounts, the internals of a list during <code>append</code>. It can switch threads between any two bytecodes, so check-then-act and read-modify-write sequences in your code race.', fix: 'Guard compound operations with <code>threading.Lock</code>; use <code>queue.Queue</code> to hand work between threads; prefer immutable data and message passing.' },
    { trap: 'A CPU-heavy thread slows down every I/O thread', why: 'When an I/O thread’s data arrives, it has to re-acquire the GIL. If a CPU-bound thread holds it, the I/O thread waits up to the switch interval before it can even request a drop, so each I/O round trip gains several milliseconds (the “convoy effect”).', fix: 'Keep CPU work out of processes that serve latency-sensitive I/O: send it to a process pool or a separate worker service.' },
    { trap: 'Free-threaded build, but the GIL came back', code: `$ python3.13t -c "import legacy_ext, sys; print(sys._is_gil_enabled())"
RuntimeWarning: The global interpreter lock (GIL) has been enabled to load module 'legacy_ext' ...
True`, lang: 'bash', why: 'In the free-threaded build, importing a C extension that hasn’t declared free-threading support re-enables the GIL for the whole process (with a warning) to keep it safe.', fix: 'Check <code>sys._is_gil_enabled()</code> at startup and log it. Upgrade to wheels built for free-threading (tagged <code>cp313t</code>). Only force <code>PYTHON_GIL=0</code> / <code>-X gil=0</code> once you know the extension is safe.' },
    { trap: 'Assuming NumPy-heavy threads can’t scale', why: 'Many C extensions release the GIL inside long operations (large NumPy ufuncs and BLAS calls, <code>hashlib</code> on large buffers, <code>zlib</code>, many database drivers while waiting). Those sections do run in parallel.', fix: 'Measure before reaching for processes. If the hot path is inside a GIL-releasing library, a thread pool avoids pickling costs entirely.' },
    { trap: 'Tuning <code>sys.setswitchinterval</code> to fix throughput', why: 'It only changes how often threads take turns. A larger value improves CPU-bound throughput slightly and worsens I/O latency; a smaller one does the reverse. It never adds parallelism.', fix: 'Fix the architecture instead (processes, async I/O, C extensions). Leave the default unless you have measurements.' }
  ],
  scenarios: [
    { title: 'Thread pool made PDF ingestion 10% slower',
      symptom: 'A RAG ingestion job switched from a loop to <code>ThreadPoolExecutor(16)</code> on a 16-core box. Throughput dropped, and <code>top</code> shows the process at about 100% CPU, never 1600%.',
      diagnoseLang: 'bash',
      diagnose: `$ py-spy top --pid 4242          # samples every thread's Python stack
# all 16 threads in the pure-Python parser; most samples idle waiting for the GIL
$ py-spy dump --pid 4242 | grep -c "parse_page"`,
      cause: 'Parsing is pure-Python and CPU-bound. The threads take turns holding the GIL, so the work is still serial, and switching adds overhead.',
      fix: 'Move to a process pool with chunked inputs, and keep the thread pool only for the network part (downloading files, calling the embedding API).',
      fixCode: `from concurrent.futures import ProcessPoolExecutor

with ProcessPoolExecutor(max_workers=os.cpu_count()) as ex:
    for doc in ex.map(parse_pdf, paths, chunksize=8):    # chunks cut pickling round trips
        queue_for_embedding(doc)` },
    { title: 'Health checks time out whenever reports run',
      symptom: 'A gunicorn service using the threaded worker (<code>--threads 8</code>) fails Kubernetes liveness probes during heavy report generation, and pods get restarted mid-report.',
      diagnoseLang: 'bash',
      diagnose: `# probe latency jumps from ~2 ms to seconds while one thread renders a report
$ py-spy dump --pid <worker>     # one thread in render_report(), the probe thread waiting`,
      cause: 'Report rendering is CPU-bound Python in one of the worker’s threads. The probe handler shares that process’s GIL, so it waits behind the renderer slice after slice.',
      fix: 'Run CPU-heavy work outside the request-serving process (a task queue or a process pool), and scale request handling with more worker <i>processes</i> rather than more threads.',
      fixCode: `# gunicorn.conf.py
workers = 4          # processes: one GIL each
threads = 4          # fine for I/O-bound handlers
# heavy rendering goes to a task queue / ProcessPoolExecutor, not request threads` },
    { title: 'Free-threaded pilot shows no speedup at all',
      symptom: 'A team benchmarks a CPU-bound threaded workload on <code>python3.13t</code> and gets the same numbers as the normal build.',
      diagnose: `import sys, warnings
warnings.simplefilter("error", RuntimeWarning)   # make the re-enable warning loud
import our_deps
print(sys._is_gil_enabled())                     # True`,
      cause: 'One dependency’s C extension was built without declaring free-threading support. Importing it re-enabled the GIL for the whole process.',
      fix: 'Upgrade to a version that publishes free-threaded wheels, or remove the dependency from the hot process. Add a startup assertion so a regression is visible.',
      fixCode: `import logging, sys
if hasattr(sys, "_is_gil_enabled") and sys._is_gil_enabled():
    logging.warning("GIL is enabled; free-threading inactive")` },
    { title: 'Per-tenant usage counters under-report by 3%',
      symptom: 'Billing counts from the API servers are consistently lower than the access logs, and only on the busiest instances.',
      diagnose: `# in the request handler, from many threads:
USAGE[tenant] += tokens         # read-modify-write, no lock`,
      cause: 'Read, add and store are separate bytecodes. Under load, two threads read the same old value and both write their increment on top of it.',
      fix: 'Protect the update with a lock, or send increments through a queue to a single aggregator thread.',
      fixCode: `_lock = threading.Lock()
def record(tenant: str, tokens: int) -> None:
    with _lock:
        USAGE[tenant] += tokens` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print on a standard CPython 3.12 build?', code: `import sys
print(sys.getswitchinterval())`, options: ['0.001', '0.005', '0.01', '100'], answer: 1, run: true, expect: '0.005', explain: 'The default switch interval is 5 ms (it replaced the old “check every 100 ticks” scheme in 3.2). A thread waiting that long for the GIL asks the holder to drop it.' },
    { kind: 'predict', q: 'Four threads each increment a shared counter 100,000 times. What does this print?', code: `import threading

n = 0
lock = threading.Lock()

def inc():
    global n
    for _ in range(100_000):
        with lock:
            n += 1

ts = [threading.Thread(target=inc) for _ in range(4)]
for t in ts:
    t.start()
for t in ts:
    t.join()
print(n)`, options: ['400000', 'A number below 400000 that varies between runs', '100000', 'It deadlocks'], answer: 0, run: true, expect: '400000', explain: 'Every read-modify-write happens inside the lock, so no update is lost. Remove the <code>with lock:</code> and the result <i>may</i> fall short; how often depends on the version and timing, which is why you can’t test your way to confidence here.' },
    { kind: 'predict', q: 'What does this print to stdout?', code: `import threading

def boom():
    raise ValueError("bad row")

t = threading.Thread(target=boom)
t.start()
t.join()
print("main continues")`, options: ['Nothing: ValueError propagates out of <code>join()</code>', 'main continues (the traceback goes to stderr)', 'main continues, then ValueError at exit', 'RuntimeError: thread failed'], answer: 1, run: true, expect: 'main continues', explain: 'An exception in a thread ends that thread only. <code>threading.excepthook</code> prints the traceback to stderr and <code>join()</code> returns normally. Use <code>concurrent.futures</code> if you want the exception re-raised in the caller via <code>future.result()</code>.' },
    { kind: 'concept', q: 'Pure-Python CPU work takes 8 s in one thread. You split it across 4 threads on an 8-core machine (default 3.12 build). Roughly how long does it take?', options: ['About 2 s', 'About 1 s', 'About 8 s, often a little more', 'About 32 s'], answer: 2, explain: 'Only one thread executes bytecode at a time, so the total CPU work is still done serially, plus switching overhead. Processes or the free-threaded build are needed for parallel speedup.' },
    { kind: 'concept', q: 'Which of these does <b>not</b> release the GIL while it runs?', options: ['<code>time.sleep(1)</code>', '<code>sock.recv(4096)</code> waiting for data', 'A pure-Python <code>for</code> loop summing a list', '<code>hashlib.sha256(big_bytes)</code> on a large buffer'], answer: 2, explain: 'Bytecode execution always holds the GIL (it is only <i>forcibly</i> switched every 5 ms). Sleeping, blocking socket calls and hashing large buffers drop it around the C-level work.' },
    { kind: 'concept', q: 'Why is <code>counter += 1</code> on a shared global not atomic?', options: ['Python ints are mutable', 'It compiles to several bytecodes (load, add, store) and a thread switch can happen between them', 'The GIL is released during integer addition', 'Globals are copied per thread'], answer: 1, explain: 'Run <code>dis.dis</code> on it: <code>LOAD_GLOBAL</code>, <code>LOAD_CONST</code>, <code>BINARY_OP (+=)</code>, <code>STORE_GLOBAL</code>. Ints are immutable; the race is between reading the old object and storing the new one.' },
    { kind: 'concept', q: 'On <code>python3.13t</code> you import a C extension that hasn’t declared free-threading support. What happens by default?', options: ['ImportError', 'The import works and the GIL stays off; you may crash', 'The GIL is re-enabled for the process and a RuntimeWarning is emitted', 'Only that module runs under a GIL'], answer: 2, explain: 'The interpreter turns the GIL back on to stay safe and warns. <code>PYTHON_GIL=0</code> or <code>-X gil=0</code> overrides that, which is only safe if you know the extension is thread-safe.' },
    { kind: 'concept', q: 'Which is guaranteed safe to call from many threads without your own lock, in both the default and the free-threaded build?', options: ['<code>shared_list.append(x)</code>', '<code>d[k] = d.get(k, 0) + 1</code>', '<code>if x not in s: s.add(x); n += 1</code>', '<code>obj.total = obj.total + v</code>'], answer: 0, explain: 'A single built-in operation on a list or dict keeps the object consistent: under the GIL in the default build, and with per-object locks in the free-threaded build. The others are compound read-modify-write sequences.' }
  ],
  interview: [
    { q: 'What is the GIL, and why does CPython have it?', a: '<p>A per-interpreter mutex that a thread must hold to execute Python bytecode. It makes reference counting and the internals of built-in objects safe without fine-grained locks, keeps single-threaded code fast, and made C extensions easy to write: they could assume nobody else touches Python objects while they run. The cost is no parallel execution of Python code within one process.</p>', lvl: 'core' },
    { q: 'What exactly does the GIL protect, and what doesn’t it?', a: '<p>It protects the interpreter: refcounts, allocator state, and the internal consistency of objects during a single built-in operation (<code>list.append</code>, <code>dict[k] = v</code> with built-in keys). It does <b>not</b> make sequences of operations atomic. The interpreter can switch between any two bytecodes, so <code>x += 1</code>, check-then-set and iterating a container another thread mutates are still races.</p>', fu: 'Can <code>d[k] = v</code> release the GIL midway? (Yes, if <code>k</code> has a Python-level <code>__hash__</code> or <code>__eq__</code>, which runs bytecode.)', lvl: 'core' },
    { q: 'How does a thread switch happen?', a: '<p>Since 3.2, a thread that wants the GIL waits on a condition variable for the switch interval (5 ms). If the GIL is still not released, it sets a “drop request” flag. The running thread checks an “eval breaker” at certain points in the bytecode loop (backward jumps, calls), sees the request, releases the GIL and waits until another thread has taken it, so the waiter really gets a turn. Independently, any blocking C call wrapped in <code>Py_BEGIN_ALLOW_THREADS</code> releases it voluntarily.</p>', lvl: 'deep' },
    { q: 'When do threads help in CPython, and when don’t they?', a: '<ul><li><b>Help:</b> I/O-bound work (HTTP calls, DB queries, file and socket I/O) and C code that releases the GIL (NumPy, compression, hashing).</li><li><b>Don’t:</b> pure-Python CPU work: parsing, loops, JSON transformation of big documents. Use processes, vectorised C, or the free-threaded build.</li></ul>', lvl: 'core' },
    { q: 'What does PEP 703 change?', a: '<p>It adds a build option (<code>--disable-gil</code>) that removes the GIL. To stay correct without it, CPython uses <b>biased reference counting</b> (cheap non-atomic updates by the owning thread, atomic ones by others), immortal and deferred-refcount objects, the mimalloc allocator, and per-object locks (“critical sections”) inside built-in containers. The cycle collector stops the world while it runs. In 3.13 it is experimental and noticeably slower single-threaded, partly because the specializing interpreter was disabled in that build. 3.14 made it officially supported (PEP 779) and turned the specializing interpreter on in that build; the docs put the single-threaded cost at roughly 5–10%. 3.15 keeps it optional and adds a stable ABI for free-threaded builds (<code>abi3t</code>, PEP 803), so one extension wheel can serve several versions. The default build still has a GIL.</p>', fu: 'How do you detect it at run time? (<code>sysconfig.get_config_var("Py_GIL_DISABLED")</code> for the build, <code>sys._is_gil_enabled()</code> for the current state.)', lvl: 'deep' },
    { q: 'Does free-threading make existing threaded Python code correct?', a: '<p>No. It makes races that were rare under the GIL more likely, because threads now truly run at the same time. Built-in containers stay internally consistent, but your compound operations still need locks. C extensions also need to be audited for thread safety, which is why they must opt in.</p>', lvl: 'core' },
    { q: 'What alternatives to free-threading exist for CPU parallelism?', a: '<ul><li><code>multiprocessing</code> / <code>ProcessPoolExecutor</code>: separate processes, each with its own GIL; data is pickled between them.</li><li>C extensions, NumPy, Numba or Cython code that releases the GIL.</li><li>Sub-interpreters: PEP 684 (3.12) gave each interpreter its own GIL at the C-API level, and 3.14 added a Python-level <code>concurrent.interpreters</code> module and <code>InterpreterPoolExecutor</code>.</li></ul>', lvl: 'deep' },
    { q: 'What is the “convoy effect” with the GIL?', a: '<p>When an I/O-bound thread shares a process with a CPU-bound one, every time its I/O completes it must wait to re-acquire the GIL: up to a switch interval before it may request a drop, plus however long the holder takes to reach a check. Many short I/O operations therefore get much slower. The fix is to separate CPU work into another process.</p>', lvl: 'deep' },
    { q: 'How does this compare with Java threads?', a: '<p>JVM threads run bytecode truly in parallel on all cores; correctness comes from the Java Memory Model, <code>synchronized</code>, <code>volatile</code> and <code>java.util.concurrent</code>. CPython (default build) runs one thread’s bytecode at a time, so a thread pool is a concurrency tool for waiting, not a parallelism tool. Locks are still needed in both. Free-threaded Python moves closer to the Java model.</p>', lvl: 'core' },
    { q: 'Why is <code>asyncio</code> not affected by the GIL?', a: '<p>It runs everything in one thread, so there is nobody to contend with. It gets concurrency by switching coroutines at <code>await</code> points while the event loop waits on many sockets at once. It shares the GIL’s limit, though: CPU work in a coroutine blocks everything. See <a href="asyncio.html">asyncio event loop</a>.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Startup check for free-threading', lang: 'python', code: `import logging
import os
import sys
import sysconfig

log = logging.getLogger("runtime")

def report_runtime() -> dict[str, object]:
    built_ft = bool(sysconfig.get_config_var("Py_GIL_DISABLED"))
    gil_on = sys._is_gil_enabled() if hasattr(sys, "_is_gil_enabled") else True
    info = {
        "python": sys.version.split()[0],
        "free_threaded_build": built_ft,
        "gil_enabled": gil_on,
        "cpus": os.cpu_count(),
        "switch_interval_s": sys.getswitchinterval(),
    }
    if built_ft and gil_on:
        log.warning("free-threaded build but GIL is enabled (an extension re-enabled it?)")
    log.info("runtime %s", info)
    return info`, note: 'Call it once at startup, after importing your heavy dependencies, so a re-enabled GIL shows up in the logs.' },
    { title: 'Threads for I/O, processes for CPU', lang: 'python', code: `from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
import httpx

def download(url: str) -> bytes:                  # I/O-bound: GIL released while waiting
    return httpx.get(url, timeout=30).content

def extract_text(pdf: bytes) -> str:              # CPU-bound pure Python
    ...

def ingest(urls: list[str]) -> list[str]:
    with ThreadPoolExecutor(max_workers=32) as io_pool, \\
         ProcessPoolExecutor() as cpu_pool:
        blobs = io_pool.map(download, urls)
        return list(cpu_pool.map(extract_text, blobs, chunksize=4))`, note: 'Each stage gets the executor that matches what it is bound by.' },
    { title: 'Java comparison: the same counter', lang: 'java', code: `// Java: threads run in parallel on all cores. The race is the same as in Python.
class Counter {
    private int n;                                  // n++ is load/add/store: racy
    private final AtomicInteger safe = new AtomicInteger();
    synchronized void incLocked() { n++; }          // ≈ with lock: n += 1
    void incAtomic() { safe.incrementAndGet(); }    // no direct stdlib equivalent in Python
}

// CPU-bound work: a fixed pool *does* scale in Java...
ExecutorService pool = Executors.newFixedThreadPool(Runtime.getRuntime().availableProcessors());
// ...in default CPython you need ProcessPoolExecutor for the same effect.`, note: 'The correctness rules carry over from Java unchanged. Only the speed-up story is different.' }
  ]
});

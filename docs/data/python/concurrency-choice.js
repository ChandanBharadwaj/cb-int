IA.register({
  track: 'python',
  slug: 'concurrency-choice',
  title: 'Choosing a concurrency model',
  tagline: 'Threads, processes or asyncio? Ask one question first: <b>is the program waiting, or computing in Python?</b> Waiting scales with threads (dozens) or asyncio (thousands). Pure-Python computing needs processes, a GIL-releasing library, or (experimentally) free-threading. Most real services mix them, so the second skill is building <b>bridges</b> that keep the event loop free.',
  tldr: {
    problem: 'Teams pick a model by fashion (“everything async now”) or by habit from Java (“add a thread pool”), then pay for it: blocked event loops, saturated thread pools, CPU work that doesn’t parallelise, and sync and async code calling each other in ways that deadlock or create a loop per call.',
    model: '<b>I/O-bound, moderate concurrency, sync libraries</b> → <code>ThreadPoolExecutor</code>. <b>I/O-bound, high concurrency, async libraries</b> → asyncio. <b>CPU-bound pure Python</b> → <code>ProcessPoolExecutor</code>. <b>CPU in NumPy / native code</b> → threads are fine. <b>Mixed</b> → asyncio at the edge, <code>asyncio.to_thread</code> for blocking calls, <code>run_in_executor</code> with a process pool for CPU.',
    hook: '“Our FastAPI app is async, so it’s fast, right?” Only if nothing in an <code>async def</code> blocks. A plain <code>def</code> endpoint runs in a worker thread and is often the <i>safer</i> choice when your database driver or SDK is synchronous.',
    facts: [
      { v: '40', l: 'default size of AnyIO’s worker-thread limiter, which FastAPI and Starlette use to run plain <code>def</code> endpoints and dependencies' },
      { v: '3.9', l: 'added <code>asyncio.to_thread(fn, *args)</code>: run a blocking function in the loop’s default thread pool and await its result' },
      { v: '1 per thread', l: 'running event loop. <code>asyncio.run()</code> refuses to start inside one; use <code>run_coroutine_threadsafe</code> to reach it from another thread' }
    ]
  },
  intro: {
    what: 'Python gives you three ways to do many things at once. <b>Threads</b> share memory and take turns running Python, which is great while they wait on the network. <b>Processes</b> are separate Pythons that truly run in parallel on different cores, but have to copy data between them. <b>asyncio</b> uses one thread and switches between tasks whenever one is waiting, handling thousands of connections cheaply. Picking one comes down to what your program spends its time on.',
    analogy: { icon: '🧭', title: 'Staffing a help desk', text: 'If most calls are “please hold while I check” (I/O), one very organised agent juggling many calls on hold (asyncio) or a few agents (threads) works well. If every call needs twenty minutes of hard thinking (CPU), you need more brains in separate rooms (processes). And whoever juggles calls must never start a twenty-minute task themselves: they hand it to a back office (a thread or process pool).' },
    steps: [
      { t: 'Measure where time goes', d: 'Watch CPU while it runs. Near 100% of one core = CPU-bound; mostly idle while slow = I/O-bound. <code>py-spy top</code> shows the functions.' },
      { t: 'Waiting? Threads or asyncio', d: 'A handful of HTTP calls or a sync library: a thread pool. Thousands of sockets, streaming, websockets, async libraries available: asyncio.' },
      { t: 'Computing? Processes', d: 'Pure-Python number crunching or parsing: <code>ProcessPoolExecutor</code>. If the work is inside NumPy or another C library that releases the GIL, threads already run in parallel.' },
      { t: 'Mixing is normal', d: 'In async code, hand blocking calls to a thread and CPU work to a process.', code: 'data = await asyncio.to_thread(legacy_sdk.fetch, doc_id)\nloop = asyncio.get_running_loop()\nsummary = await loop.run_in_executor(process_pool, parse, data)' },
      { t: 'Keep it boring', d: 'A script making five API calls doesn’t need asyncio. Use the simplest model that meets the requirement.' }
    ],
    terms: [
      ['I/O-bound', 'Time is spent waiting for something external: network, disk, database, an LLM API.'],
      ['CPU-bound', 'Time is spent computing in Python bytecode.'],
      ['event loop', 'asyncio’s scheduler. One per thread; it must never be blocked.'],
      ['thread pool', 'A fixed set of reusable threads (<code>ThreadPoolExecutor</code>).'],
      ['process pool', 'A fixed set of worker processes (<code>ProcessPoolExecutor</code>).'],
      ['ASGI / WSGI', 'The async and sync server interfaces for Python web apps (uvicorn/FastAPI vs gunicorn/Flask).']
    ]
  },
  visual: {
    title: 'A decision tree you can walk',
    caption: 'Pick a real workload and press <b>Play</b> (or <b>Step</b>) to walk its path through the tree, or choose <b>Decide yourself</b> and answer the questions. Each leaf explains why, and shows the code shape you would use.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'I/O: sequential vs concurrent', code: `import asyncio, time

async def call(name, latency):
    await asyncio.sleep(latency)            # stands in for an HTTP/LLM call
    return name

calls = [(f"tool{i}", 0.1) for i in range(10)]

t0 = time.perf_counter()
for name, lat in calls:
    await call(name, lat)                   # one at a time
print(f"sequential: {time.perf_counter() - t0:.2f}s")

t0 = time.perf_counter()
async with asyncio.TaskGroup() as tg:
    for name, lat in calls:
        tg.create_task(call(name, lat))
print(f"concurrent: {time.perf_counter() - t0:.2f}s")`, note: 'The playground already runs inside an event loop, so it uses top-level <code>await</code>. A script would wrap this in <code>asyncio.run(main())</code>.' },
      { label: 'CPU in async: chunk or offload', code: `import asyncio, time

def score_all(rows):                        # CPU work, no awaits
    return sum(r * r for r in rows)

async def score_cooperative(rows, chunk=50_000):
    total = 0
    for i in range(0, len(rows), chunk):
        total += score_all(rows[i:i + chunk])
        await asyncio.sleep(0)              # let other tasks run between chunks
    return total

async def heartbeat(stop, worst):
    while not stop.is_set():
        t = time.perf_counter()
        await asyncio.sleep(0.01)
        worst[0] = max(worst[0], time.perf_counter() - t - 0.01)

rows = list(range(1_500_000))
for label, job in [("one big call", lambda: asyncio.sleep(0, score_all(rows))),
                   ("chunked + yield", lambda: score_cooperative(rows))]:
    stop, worst = asyncio.Event(), [0.0]
    hb = asyncio.create_task(heartbeat(stop, worst))
    await asyncio.sleep(0.02)
    await job()
    stop.set(); await hb
    print(f"{label:16} worst heartbeat delay: {worst[0]*1000:.0f} ms")`, note: 'Chunking keeps the loop responsive but doesn’t make the work faster. For real CPU work, use <code>loop.run_in_executor(ProcessPoolExecutor(), fn, data)</code>.' },
      { label: 'Streaming tokens (async generator)', code: `import asyncio

async def fake_llm_stream(prompt):
    for token in f"Answer to {prompt!r}: use asyncio for I/O.".split():
        await asyncio.sleep(0.02)           # tokens arrive over the network
        yield token + " "

async def handle(user, prompt, out):
    async for tok in fake_llm_stream(prompt):
        out.append((user, tok))

out = []
async with asyncio.TaskGroup() as tg:
    tg.create_task(handle("ann", "q1", out))
    tg.create_task(handle("bob", "q2", out))

print("interleaved arrival:", [u for u, _ in out][:8], "...")
for user in ("ann", "bob"):
    print(user, "->", "".join(t for u, t in out if u == user))`, note: 'Two users stream at once on one thread: the typical shape of an agent or chat backend.' },
      { label: 'Pipeline with a bounded queue', code: `import asyncio

async def producer(q):
    for i in range(10):
        await q.put(f"doc{i}")              # waits when the queue is full
    print("producer done")

async def consumer(name, q, done):
    while True:
        doc = await q.get()
        await asyncio.sleep(0.03)           # embed + index
        done.append((name, doc))
        q.task_done()

q = asyncio.Queue(maxsize=3)
done = []
async with asyncio.TaskGroup() as tg:
    workers = [tg.create_task(consumer(f"w{i}", q, done)) for i in range(2)]
    await producer(q)
    await q.join()
    for w in workers:
        w.cancel()
print(len(done), "processed; by worker:", {w: sum(1 for n, _ in done if n == w) for w in ("w0", "w1")})` },
      { label: 'The decision, as code', code: `def choose(bound, concurrency=1, async_libs=False, releases_gil=False, free_threaded=False):
    if bound == "io":
        if concurrency > 100 and async_libs:
            return "asyncio (TaskGroup + Semaphore)"
        return "ThreadPoolExecutor (or plain sync code if concurrency is tiny)"
    if bound == "cpu":
        if releases_gil:
            return "ThreadPoolExecutor / the library's own parallelism"
        if free_threaded:
            return "threads on a free-threaded build (experimental in 3.13)"
        return "ProcessPoolExecutor (small inputs, chunksize, initializer)"
    return "asyncio + to_thread for blocking calls + process pool for CPU"

workloads = {
    "agent calling 300 tools over HTTP": dict(bound="io", concurrency=300, async_libs=True),
    "CLI fetching 5 URLs":               dict(bound="io", concurrency=5),
    "parse 2M log lines in Python":      dict(bound="cpu"),
    "NumPy matrix work on batches":      dict(bound="cpu", releases_gil=True),
    "FastAPI + legacy sync SDK + PDFs":  dict(bound="mixed"),
}
for name, w in workloads.items():
    print(f"{name:35} -> {choose(**w)}")` }
    ]
  },
  gotchas: [
    { trap: 'Sync database driver inside <code>async def</code> endpoints', code: `@app.get("/orders/{id}")
async def get_order(id: int):
    return session.execute(select(Order).where(Order.id == id)).scalar_one()  # sync I/O on the loop`, why: 'FastAPI runs <code>async def</code> handlers directly on the event loop. A synchronous driver call blocks the loop for the whole query, so concurrent requests on that worker queue behind it.', fix: 'Either declare the handler with plain <code>def</code> (FastAPI runs it in its thread pool), or switch fully to an async driver (<code>asyncpg</code>, SQLAlchemy’s <code>AsyncSession</code>). Don’t mix inside one handler.' },
    { trap: 'Exhausting the framework’s thread pool', why: 'Plain <code>def</code> endpoints and sync dependencies share AnyIO’s limiter, 40 threads by default. If each request makes a slow external call, request 41 waits for a free thread, even though CPU is idle.', fix: 'Move slow I/O to async clients; or raise the limit at startup (<code>anyio.to_thread.current_default_thread_limiter().total_tokens = 100</code>) and size downstream connection pools to match.' },
    { trap: '<code>asyncio.run()</code> per call to use an async SDK from sync code', code: `def fetch(doc_id):                        # called from Celery / Django / a CLI
    return asyncio.run(async_client.get(doc_id))   # new loop every call`, why: 'Each call creates and closes an event loop. Async clients that cached connections on the first loop then fail on the next with errors like “attached to a different loop” or “Event loop is closed”, and you pay loop and connection setup on every call.', fix: 'Use the SDK’s sync client in sync code. If you must bridge, keep one long-lived loop: <code>asyncio.Runner()</code> (3.11+) per worker, or a background loop thread plus <code>run_coroutine_threadsafe</code>.' },
    { trap: 'Waiting on a thread that needs the loop, from the loop', code: `async def main():
    t = threading.Thread(target=calls_run_coroutine_threadsafe)
    t.start()
    t.join()          # blocks the loop; the thread waits for the loop → deadlock`, why: 'The thread submits a coroutine to the loop and waits for it. The loop can’t run it, because it is blocked in <code>join()</code>.', fix: 'Never block the loop to wait for other threads: <code>await asyncio.to_thread(t.join)</code>, or better, use futures end to end.' },
    { trap: 'Choosing asyncio for CPU-heavy work', why: 'asyncio is single-threaded. It overlaps <i>waiting</i>; it can’t make computation parallel, and CPU work inside a coroutine stalls every other task.', fix: 'Keep asyncio for the I/O edge and offload CPU work: <code>await loop.run_in_executor(process_pool, fn, data)</code>.' },
    { trap: 'Going async for a script that makes five calls', why: 'Async spreads through the call graph (“function colouring”), needs async-aware libraries and test tooling, and adds failure modes. For low concurrency the gain is nil.', fix: 'Use sequential code or a small <code>ThreadPoolExecutor</code>. Reach for asyncio when concurrency is high, connections are long-lived (websockets, streaming), or the framework is already async.' },
    { trap: 'Scaling an async app with threads instead of processes', why: 'One uvicorn worker is one process, one event loop, one GIL. More concurrency per loop doesn’t add CPU; any CPU work per request caps a worker at one core.', fix: 'Run several worker processes (e.g. <code>uvicorn --workers N</code> or gunicorn with uvicorn workers), roughly one per core, and keep per-request CPU low.' }
  ],
  scenarios: [
    { title: 'Celery tasks fail with “Event loop is closed” after the first run',
      symptom: 'A Celery worker calls an async LLM SDK through <code>asyncio.run(...)</code>. The first task in each worker succeeds; later ones intermittently raise <code>RuntimeError: Event loop is closed</code>.',
      diagnose: `# tasks.py
client = AsyncLLM()                       # module-level: connections bound to the first loop
@app.task
def summarize(doc_id):
    return asyncio.run(client.summarize(doc_id))   # a new loop per task`,
      cause: 'The async client keeps pooled connections that belong to the loop that created them. <code>asyncio.run</code> closes that loop after the first task, and later tasks run on new loops while reusing dead connections.',
      fix: 'Use the SDK’s sync client in Celery, or give each worker one long-lived loop with <code>asyncio.Runner</code> and create the async client inside it.',
      fixCode: `_runner = asyncio.Runner()               # 3.11+: one loop per worker process
_client = None

async def _summarize(doc_id):
    global _client
    _client = _client or AsyncLLM()       # created on the runner's loop
    return await _client.summarize(doc_id)

@app.task
def summarize(doc_id):
    return _runner.run(_summarize(doc_id))` },
    { title: 'Chat streaming stutters whenever someone uploads a PDF',
      symptom: 'An async agent backend streams tokens to many users. Every time a user uploads a document, all other streams freeze for 1–3 seconds.',
      diagnose: `$ PYTHONASYNCIODEBUG=1 uvicorn app:api
WARNING asyncio: Executing <Task ... coro=<upload() running at app.py:88>> took 2.904 seconds`,
      diagnoseLang: 'bash',
      cause: 'The upload handler parses and chunks the PDF in pure Python inside <code>async def</code>. That CPU work holds the event loop, so no stream gets serviced until it finishes.',
      fix: 'Offload parsing to a process pool created at startup, and await it.',
      fixCode: `from concurrent.futures import ProcessPoolExecutor
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    app.state.cpu = ProcessPoolExecutor(max_workers=4)
    yield
    app.state.cpu.shutdown()

api = FastAPI(lifespan=lifespan)

@api.post("/upload")
async def upload(file: UploadFile, request: Request):
    data = await file.read()
    loop = asyncio.get_running_loop()
    chunks = await loop.run_in_executor(request.app.state.cpu, parse_and_chunk, data)
    await index(chunks)` },
    { title: 'Latency cliff at exactly 40 concurrent requests',
      symptom: 'A FastAPI service with plain <code>def</code> endpoints is fine up to about 40 concurrent requests. Beyond that, latency climbs linearly while CPU stays under 20%.',
      diagnose: `# each request blocks a worker thread on a 2 s partner API call
# 40 threads busy → request 41 waits for a free thread
import anyio.to_thread
print(anyio.to_thread.current_default_thread_limiter().total_tokens)   # 40`,
      cause: 'Sync endpoints run on AnyIO’s worker threads, capped at 40 by default. The slow partner call holds each thread for its full duration.',
      fix: 'Make the hot endpoint async with an async HTTP client (no thread needed while waiting). If staying sync, raise the limiter deliberately and size the partner client’s pool to match.',
      fixCode: `@app.get("/quote")
async def quote(sku: str):
    r = await partner.get(f"/price/{sku}")     # httpx.AsyncClient created at startup
    return r.json()

# or, staying sync, at startup:
# anyio.to_thread.current_default_thread_limiter().total_tokens = 120` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Three blocking calls are bridged into asyncio. What does this print?', code: `import asyncio
import time

def blocking(n):
    time.sleep(0.1)          # a sync SDK call
    return n

async def main():
    results = await asyncio.gather(*(asyncio.to_thread(blocking, i) for i in range(3)))
    print(results)

asyncio.run(main())`, options: ['[0, 1, 2]', '[2, 1, 0]', 'An unpredictable order', 'RuntimeError: blocking call in event loop'], answer: 0, run: true, expect: '[0, 1, 2]', explain: '<code>to_thread</code> runs each call in the loop’s default thread pool and returns an awaitable, so the three sleeps overlap and the loop stays free. <code>gather</code> returns results in argument order, regardless of which thread finished first.' },
    { kind: 'predict', q: 'What does this print?', code: `import asyncio

async def inner():
    return 1

async def main():
    coro = inner()
    try:
        asyncio.run(coro)
    except RuntimeError as e:
        print(e)
    finally:
        coro.close()

asyncio.run(main())`, options: ['1', 'asyncio.run() cannot be called from a running event loop', 'This event loop is already running', 'Nothing'], answer: 1, run: true, expect: 'asyncio.run() cannot be called from a running event loop', explain: '<code>asyncio.run</code> creates and owns a new loop, so it refuses to start while one is already running in this thread. Inside async code, just <code>await inner()</code>.' },
    { kind: 'predict', q: 'A plain thread needs a result from the event loop. What does this print?', code: `import asyncio
import threading

async def add(a, b):
    await asyncio.sleep(0)
    return a + b

def sync_caller(loop, out):
    fut = asyncio.run_coroutine_threadsafe(add(2, 3), loop)
    out.append(fut.result(timeout=5))

async def main():
    loop = asyncio.get_running_loop()
    out = []
    t = threading.Thread(target=sync_caller, args=(loop, out))
    t.start()
    await asyncio.to_thread(t.join)     # wait without blocking the loop
    print(out)

asyncio.run(main())`, options: ['[5]', '[]', 'TimeoutError after 5 s', 'RuntimeError: no running event loop'], answer: 0, run: true, expect: '[5]', explain: '<code>run_coroutine_threadsafe</code> schedules the coroutine on the loop from another thread and returns a <code>concurrent.futures.Future</code>. Because <code>main</code> waits via <code>to_thread</code>, the loop stays free to run <code>add</code>.' },
    { kind: 'predict', q: 'CPU work is offloaded from asyncio to processes. What does this print?', code: `import asyncio
from concurrent.futures import ProcessPoolExecutor

def cpu(n):
    return sum(i * i for i in range(n))

async def main():
    loop = asyncio.get_running_loop()
    with ProcessPoolExecutor(max_workers=2) as pool:
        results = await asyncio.gather(*(loop.run_in_executor(pool, cpu, n) for n in (10, 100)))
    print(results)

if __name__ == "__main__":
    asyncio.run(main())`, options: ['[285, 328350]', '[45, 4950]', '[328350, 285]', 'PicklingError'], answer: 0, run: true, expect: '[285, 328350]', explain: 'Sum of squares below 10 is 285, below 100 is 328,350. <code>cpu</code> is a module-level function, so it pickles by name; <code>run_in_executor</code> wraps each process-pool future so it can be awaited, and <code>gather</code> keeps argument order.' },
    { kind: 'concept', q: 'In the previous thread example, what happens if <code>main</code> calls <code>t.join()</code> directly instead of <code>await asyncio.to_thread(t.join)</code>?', options: ['Nothing changes', 'The loop is blocked in join(), so it can never run add(); the thread waits on fut.result() until its 5 s timeout and raises TimeoutError', 'Python detects the deadlock and raises RuntimeError immediately', 'add() runs in the thread instead'], answer: 1, explain: 'Classic sync/async deadlock: the loop waits for the thread, and the thread waits for the loop. Never block the loop thread waiting for work that needs the loop.' },
    { kind: 'concept', q: 'A FastAPI endpoint is declared with plain <code>def</code> and calls <code>requests.get()</code>. Where does it run?', options: ['On the event loop, blocking it', 'In a worker thread from AnyIO’s thread pool, so the loop stays free', 'In a separate process', 'It fails: FastAPI requires async def'], answer: 1, explain: 'FastAPI (via Starlette and AnyIO) runs sync path operations and dependencies in a thread pool (40 threads by default). That is why <code>def</code> is the right choice for blocking libraries, and why <code>async def</code> + <code>requests</code> is the wrong one.' },
    { kind: 'concept', q: 'You need 10,000 concurrent websocket connections, each streaming LLM tokens. Which model fits best?', options: ['A 10,000-thread ThreadPoolExecutor', 'asyncio (an ASGI server such as uvicorn), with bounded concurrency to the upstream API', 'ProcessPoolExecutor with 10,000 processes', 'Sequential code'], answer: 1, explain: 'Long-lived, mostly idle connections are asyncio’s home ground: each is a small task, not an OS thread with its own stack. Bound the upstream calls with a semaphore, and run several worker processes to use more cores.' },
    { kind: 'concept', q: 'A nightly job parses 2 million log lines with regexes and dict updates in pure Python, on an 8-core machine. What do you reach for first?', options: ['asyncio.gather over the lines', 'ThreadPoolExecutor(8)', 'ProcessPoolExecutor with chunked input (for example chunksize or one file per task)', 'A larger sys.setswitchinterval'], answer: 2, explain: 'It is CPU-bound pure Python, so with the GIL only processes give a parallel speed-up. Chunking keeps pickling overhead low. Threads would take turns on one core; asyncio would run it serially.' }
  ],
  interview: [
    { q: 'Walk me through how you choose between threads, processes and asyncio.', a: '<ol><li>Profile: is it waiting (I/O) or computing (CPU)?</li><li>I/O, modest concurrency or sync-only libraries → <code>ThreadPoolExecutor</code>.</li><li>I/O, high concurrency, long-lived connections, async libraries available → asyncio.</li><li>CPU in pure Python → <code>ProcessPoolExecutor</code> (mind pickling, memory per worker, start method).</li><li>CPU in native code that releases the GIL (NumPy, many ML runtimes) → threads or the library’s own parallelism.</li><li>Durable, retryable, multi-machine work → a job queue rather than in-process concurrency.</li></ol>', lvl: 'core' },
    { q: 'Threads vs asyncio for I/O: what are the real trade-offs?', a: '<p>Threads work with any library and keep code sync, but each costs an OS thread (stack memory, scheduling), switching is preemptive so shared state needs locks, and hundreds of threads get expensive. asyncio handles tens of thousands of connections in one thread with explicit switch points (fewer races), cheap cancellation and timeouts, but needs async libraries all the way down, and one blocking call stalls everything.</p>', lvl: 'core' },
    { q: 'How do you call blocking code from async code safely?', a: '<p><code>await asyncio.to_thread(fn, *args)</code> for blocking I/O (uses the default thread pool), or <code>await loop.run_in_executor(executor, fn, *args)</code> to choose the executor, for example a <code>ProcessPoolExecutor</code> for CPU work. Size the pools deliberately; the default thread pool is <code>min(32, cpus + 4)</code> threads.</p>', lvl: 'core' },
    { q: 'How do you call async code from sync code?', a: '<ul><li>At the program’s top level: <code>asyncio.run(main())</code>, once.</li><li>Repeatedly from a sync worker: one long-lived loop, e.g. <code>asyncio.Runner()</code> (3.11+), not <code>asyncio.run</code> per call.</li><li>From another thread while a loop is running: <code>asyncio.run_coroutine_threadsafe(coro, loop).result(timeout)</code>.</li></ul><p>Never call <code>asyncio.run</code> inside a running loop, and never block the loop thread waiting for such a result.</p>', lvl: 'deep' },
    { q: 'How does FastAPI treat <code>def</code> vs <code>async def</code> endpoints?', a: '<p><code>async def</code> handlers run directly on the event loop: ideal with async clients, disastrous with blocking calls. Plain <code>def</code> handlers (and sync dependencies) are run in AnyIO’s worker-thread pool, capped by a limiter of 40 tokens by default, so blocking libraries are safe there but concurrency is bounded by the pool. Pick per endpoint by what the code inside calls.</p>', lvl: 'core' },
    { q: 'Which async frameworks would you consider, and what do sync ones do with async?', a: '<ul><li>ASGI-native: FastAPI/Starlette, Litestar, aiohttp (its own server), Quart; served by uvicorn, hypercorn or granian.</li><li>Django: async views since 3.1 under ASGI, with sync ORM calls bridged via <code>sync_to_async</code> (the ORM has gained async query methods over time).</li><li>Flask 2.0+ supports <code>async def</code> views, but runs each in an event loop on a thread per request: convenient, not a performance win.</li></ul>', lvl: 'deep' },
    { q: 'How do processes fit into an async service?', a: '<p>Create a <code>ProcessPoolExecutor</code> at startup (lifespan), submit CPU work with <code>run_in_executor</code>, and await the result so the loop keeps serving. Keep inputs small (ids, bytes) because they are pickled, prefer the spawn or forkserver start method in a process that already has threads, and shut the pool down on exit. For horizontal scaling, run several server worker processes, each with its own loop.</p>', lvl: 'core' },
    { q: 'Does the free-threaded build change your decision guide?', a: '<p>For CPU-bound pure Python it adds an option: threads that really run in parallel, with no pickling and shared memory. In 3.13 it is experimental, single-threaded code is slower, and every C extension must support it, so I would pilot it for a specific workload rather than default to it. The I/O side of the guide doesn’t change. See <a href="gil.html">The GIL &amp; free-threading</a>.</p>', lvl: 'deep' },
    { q: 'An AI agent backend: what concurrency architecture would you use?', a: '<p>An ASGI app (asyncio) with async LLM and vector-store clients; streaming responses as async generators; tool calls fanned out in a <code>TaskGroup</code> with a per-provider <code>Semaphore</code>, timeouts and jittered retries. Blocking SDKs go through <code>asyncio.to_thread</code>; document parsing and other CPU work go to a process pool or a separate worker service via a queue. Scale with worker processes behind the load balancer, and enable asyncio debug or loop-lag metrics in staging.</p>', lvl: 'core' },
    { q: 'How does this map to the Java world?', a: '<p>Thread pools ≈ Spring MVC’s thread-per-request; asyncio ≈ WebFlux/Netty event loops (same rule: never block the loop); processes ≈ running several JVMs. Java 21 virtual threads let blocking-style code scale like an event loop without colouring functions; Python has no direct equivalent in the default build, which is why asyncio and the “bridge” functions exist.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'FastAPI: pick per endpoint', lang: 'python', code: `import asyncio
from concurrent.futures import ProcessPoolExecutor
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http = httpx.AsyncClient(timeout=30, limits=httpx.Limits(max_connections=50))
    app.state.cpu = ProcessPoolExecutor(max_workers=2)
    yield
    await app.state.http.aclose()
    app.state.cpu.shutdown()

app = FastAPI(lifespan=lifespan)

@app.get("/weather")                               # async I/O → async def
async def weather(city: str, request: Request):
    r = await request.app.state.http.get(f"https://wx.internal/{city}")
    return r.json()

@app.get("/legacy-report")                         # sync library → plain def (thread pool)
def legacy_report(id: int):
    return legacy_sdk.fetch_report(id)

@app.post("/analyze")                              # CPU → process pool, awaited
async def analyze(payload: dict, request: Request):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(request.app.state.cpu, heavy_analysis, payload["text"])` },
    { title: 'Sync facade over an async client (CLI, Celery)', lang: 'python', code: `import asyncio
import atexit

class SyncLLM:
    """One event loop for the life of the process; safe to call from sync code."""

    def __init__(self) -> None:
        self._runner = asyncio.Runner()           # 3.11+
        self._client = self._runner.run(self._make_client())
        atexit.register(self.close)

    async def _make_client(self):
        return AsyncLLMClient()                   # binds its connection pool to this loop

    def complete(self, prompt: str) -> str:
        return self._runner.run(self._client.complete(prompt))

    def complete_many(self, prompts: list[str]) -> list[str]:
        async def _all():
            async with asyncio.TaskGroup() as tg:
                ts = [tg.create_task(self._client.complete(p)) for p in prompts]
            return [t.result() for t in ts]
        return self._runner.run(_all())

    def close(self) -> None:
        self._runner.run(self._client.aclose())
        self._runner.close()`, note: 'Must not be called from inside a running event loop; in async code use the async client directly.' },
    { title: 'Java comparison: the same three choices', lang: 'java', code: `// I/O, thread-per-request (≈ Python threads / FastAPI "def" endpoints)
@GetMapping("/report") Report report() { return legacyClient.fetch(); }

// I/O, event loop (≈ asyncio / FastAPI "async def"): never block inside
@GetMapping("/weather") Mono<Weather> weather(String city) {
    return webClient.get().uri("/wx/{c}", city).retrieve().bodyToMono(Weather.class);
}

// Java 21 virtual threads: blocking code, event-loop-like scale. No Python equivalent
// in the default build; asyncio + to_thread is the closest pattern.
// application.properties (Boot 3.2+): spring.threads.virtual.enabled=true

// CPU: a plain pool scales on all cores in Java. In CPython you need processes
// (ProcessPoolExecutor) unless the work is in GIL-releasing native code.`, note: 'The rule that transfers unchanged from WebFlux to asyncio: nothing blocking on the event loop thread.' }
  ]
});

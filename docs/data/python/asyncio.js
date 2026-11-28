IA.register({
  track: 'python',
  slug: 'asyncio',
  title: 'asyncio event loop',
  tagline: 'asyncio runs thousands of concurrent operations on <b>one thread</b>. The event loop keeps a <b>ready queue</b> of callbacks, a <b>timer heap</b> and a <b>selector</b> watching sockets; tasks run until they <code>await</code> something unfinished, then hand control back. Everything follows from that: why one blocking call freezes the whole service, why cancellation arrives at an <code>await</code>, and why <code>TaskGroup</code> exists.',
  tldr: {
    problem: 'Async Python services fail in ways sync ones don’t: one <code>requests.get</code> inside an <code>async def</code> stalls every request, fire-and-forget tasks vanish, timeouts never fire because someone swallowed <code>CancelledError</code>, and <code>gather</code> over 5,000 URLs gets you rate-limited.',
    model: 'A <b>coroutine</b> is a paused function. A <b>Task</b> wraps one and schedules its next step on the loop. Each loop iteration: wait in the selector until a socket is ready or the next timer is due, move due timers and I/O callbacks to the ready queue, then run every ready callback in FIFO order. A task step runs <b>until its next <code>await</code> on something not yet done</b>: no preemption, ever.',
    hook: '“Is asyncio parallel?” No: one thread, one callback at a time. It is <i>concurrent</i>: while one task waits on the network, others run. CPU work or a blocking call inside a coroutine pauses everyone.',
    facts: [
      { v: '1 thread', l: 'runs the event loop and every coroutine on it. Concurrency comes only from switching at <code>await</code> points' },
      { v: '100 ms', l: 'default <code>loop.slow_callback_duration</code>. In debug mode (<code>PYTHONASYNCIODEBUG=1</code>), any step that runs longer without yielding is logged' },
      { v: '3.11', l: 'added <code>asyncio.TaskGroup</code> (structured concurrency with sibling cancellation) and <code>asyncio.timeout()</code>' }
    ]
  },
  intro: {
    what: 'Most of a web service’s time is spent <b>waiting</b>: for the database, for an HTTP API, for an LLM to stream tokens. <code>asyncio</code> lets one thread juggle many such waits. You write functions with <code>async def</code>; inside them, <code>await</code> marks the places where the function may pause while it waits. While it is paused, the <b>event loop</b> runs other work, and comes back when the result is ready.',
    analogy: { icon: '👨‍🍳', title: 'One chef, many pots', text: 'A single chef (the thread) cooks ten dishes. They put pasta on to boil (start I/O), and instead of staring at it they chop vegetables for the next dish. A timer or a bubbling pot (the selector) tells them what needs attention next. It works brilliantly as long as no single task takes the chef’s full attention: if they stop to knead dough for ten minutes (a blocking call), every pot boils over.' },
    steps: [
      { t: 'async def makes a coroutine function', d: 'Calling it doesn’t run it. You get a coroutine object that must be awaited or scheduled.', code: 'async def fetch(url):\n    ...\n\ncoro = fetch("https://api")   # nothing has run yet' },
      { t: 'await pauses until a result is ready', d: 'While this coroutine waits, the event loop runs others.', code: 'async def fetch(client, url):\n    resp = await client.get(url)   # may pause here\n    return resp.json()' },
      { t: 'asyncio.run starts the loop', d: 'It creates an event loop, runs your top-level coroutine to completion, then closes the loop.', code: 'import asyncio\n\nasync def main():\n    print(await fetch(client, url))\n\nasyncio.run(main())' },
      { t: 'Tasks run concurrently', d: 'A <code>TaskGroup</code> (3.11+) starts several coroutines at once and waits for all of them.', code: 'async with asyncio.TaskGroup() as tg:\n    t1 = tg.create_task(fetch(client, a))\n    t2 = tg.create_task(fetch(client, b))\nprint(t1.result(), t2.result())' },
      { t: 'Never block the loop', d: 'Inside <code>async def</code>, use async libraries (httpx, asyncpg…). For a blocking function, use <code>await asyncio.to_thread(fn)</code>.' }
    ],
    terms: [
      ['coroutine', 'The object returned by calling an <code>async def</code> function: a computation that can pause at <code>await</code>.'],
      ['event loop', 'The scheduler: runs ready callbacks, watches sockets and timers.'],
      ['Task', 'A coroutine scheduled on the loop. It runs concurrently with other tasks.'],
      ['Future', 'A low-level placeholder for a result that will be set later. Tasks are Futures.'],
      ['await', 'Pause this coroutine until the awaited thing is done; let the loop run other work meanwhile.'],
      ['cancellation', '<code>task.cancel()</code> makes the task’s current <code>await</code> raise <code>CancelledError</code>.']
    ]
  },
  visual: {
    title: 'Inside the event loop',
    caption: 'Pick a scenario and press <b>Play</b> or <b>Step</b>. The loop pops one callback at a time off the <b>ready queue</b>; tasks park their sockets in the <b>selector</b>; timers wait in a heap. Compare the normal run with a hidden blocking call, and with a deadline that cancels the slow request.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'await vs tasks', code: `import asyncio, time

async def call_api(name, seconds):
    await asyncio.sleep(seconds)          # stands in for network I/O
    return f"{name} ok"

async def main():
    t0 = time.perf_counter()
    a = await call_api("a", 0.3)          # awaiting directly: one after the other
    b = await call_api("b", 0.3)
    print("sequential:", a, b, f"{time.perf_counter() - t0:.1f}s")

    t0 = time.perf_counter()
    async with asyncio.TaskGroup() as tg: # tasks: concurrently
        ta = tg.create_task(call_api("a", 0.3))
        tb = tg.create_task(call_api("b", 0.3))
    print("concurrent:", ta.result(), tb.result(), f"{time.perf_counter() - t0:.1f}s")

await main()   # a normal script would call asyncio.run(main())`, note: 'The playground already runs inside an event loop, so presets use top-level <code>await</code> instead of <code>asyncio.run()</code>.' },
      { label: 'Who runs when', code: `import asyncio

async def worker(name, steps):
    for i in range(steps):
        print(f"{name} step {i}")
        await asyncio.sleep(0)            # yield to the loop: others get a turn

async def main():
    a = asyncio.create_task(worker("A", 3))
    b = asyncio.create_task(worker("B", 2))
    print("tasks created, nothing ran yet")
    coro = worker("C", 1)                 # a coroutine object: not scheduled at all
    print("coroutine:", type(coro).__name__)
    await a
    await b
    await coro                            # only now does C run
    print("done")

await main()` },
      { label: 'Blocking the loop', code: `import asyncio, time

def cpu_work(ms):                         # blocks: no await inside
    end = time.perf_counter() + ms / 1000
    while time.perf_counter() < end:
        pass

async def heartbeat(stop):
    last = time.perf_counter()
    while not stop.is_set():
        await asyncio.sleep(0.05)
        now = time.perf_counter()
        lag = (now - last - 0.05) * 1000
        if lag > 20:
            print(f"  heartbeat late by {lag:.0f} ms")
        last = now

async def handler(blocking):
    if blocking:
        cpu_work(300)                     # freezes every other task
    else:
        await asyncio.sleep(0.3)          # lets the loop keep going

for blocking in (False, True):
    stop = asyncio.Event()
    hb = asyncio.create_task(heartbeat(stop))
    await asyncio.sleep(0.06)
    print("blocking handler" if blocking else "non-blocking handler")
    await handler(blocking)
    stop.set(); await hb`, note: 'In real code the fix is an async client, or <code>await asyncio.to_thread(fn)</code> for blocking I/O (threads aren’t available in this playground).' },
      { label: 'TaskGroup & cancellation', code: `import asyncio

async def step(name, seconds, fail=False):
    try:
        await asyncio.sleep(seconds)
        if fail:
            raise ValueError(f"{name} failed")
        print(f"{name} finished")
        return name
    except asyncio.CancelledError:
        print(f"{name} cancelled, cleaning up")
        raise                              # always re-raise

async def main():
    try:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(step("fast", 0.05))
            tg.create_task(step("slow", 1.0))
            tg.create_task(step("broken", 0.1, fail=True))
    except* ValueError as eg:
        print("TaskGroup raised:", [str(e) for e in eg.exceptions])

    print("--- gather does NOT cancel siblings ---")
    slow = asyncio.ensure_future(step("slow2", 0.3))
    try:
        await asyncio.gather(step("broken2", 0.1, fail=True), slow)
    except ValueError as e:
        print("gather raised:", e, "| slow2 still running:", not slow.done())
    await slow

await main()` },
      { label: 'Timeouts', code: `import asyncio

async def llm_call(seconds):
    try:
        await asyncio.sleep(seconds)
        return "answer"
    except asyncio.CancelledError:
        print("  request cancelled by the deadline")
        raise

async def main():
    try:
        async with asyncio.timeout(0.2):            # 3.11+
            print(await llm_call(0.05))
            print(await llm_call(1.0))
    except TimeoutError:                              # builtin TimeoutError since 3.11
        print("deadline hit after the first call")

    try:
        print(await asyncio.wait_for(llm_call(1.0), timeout=0.1))
    except TimeoutError:
        print("wait_for timed out too")

await main()` },
      { label: 'Bounded fan-out', code: `import asyncio, random

random.seed(7)
MAX_IN_FLIGHT = 3
in_flight = peak = 0

async def call_tool(i, sem):
    global in_flight, peak
    async with sem:                         # at most MAX_IN_FLIGHT at once
        in_flight += 1; peak = max(peak, in_flight)
        await asyncio.sleep(random.uniform(0.02, 0.08))
        in_flight -= 1
        return i * i

async def main():
    sem = asyncio.Semaphore(MAX_IN_FLIGHT)
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(call_tool(i, sem)) for i in range(12)]
    print("results:", [t.result() for t in tasks])
    print("peak concurrency:", peak)

await main()`, note: 'Order of results follows the task list, not completion. The semaphore is your rate limit against an API.' }
    ]
  },
  gotchas: [
    { trap: 'A blocking call inside <code>async def</code>', code: `async def summarize(doc_id):
    doc = requests.get(f"{API}/docs/{doc_id}").json()   # blocks the loop thread
    time.sleep(1)                                     # so does this
    return heavy_cpu_parse(doc)                       # and this`, why: 'The loop runs one callback at a time on one thread. Until this function reaches an <code>await</code> on something unfinished, no other task, timer or socket is serviced: every concurrent request waits.', fix: 'Use async libraries (<code>httpx.AsyncClient</code>, <code>asyncpg</code>, <code>await asyncio.sleep</code>). Wrap unavoidable blocking I/O in <code>await asyncio.to_thread(fn, …)</code>; send CPU work to a process pool via <code>loop.run_in_executor</code>.' },
    { trap: 'Calling a coroutine function without <code>await</code>', code: `async def save(event): ...
save(event)        # RuntimeWarning: coroutine 'save' was never awaited`, why: 'Calling an <code>async def</code> function only creates a coroutine object. Nothing runs until it is awaited or wrapped in a task.', fix: '<code>await save(event)</code>, or schedule it with a TaskGroup. Turn on <code>-W error::RuntimeWarning</code> in tests, and let a linter flag un-awaited coroutines.' },
    { trap: 'Fire-and-forget tasks without a reference', code: `asyncio.create_task(send_audit_log(evt))   # result dropped`, why: 'The event loop keeps only <b>weak references</b> to tasks. An unreferenced task can be garbage-collected before it finishes, and its exception is only reported as “Task exception was never retrieved”.', fix: 'Use a <code>TaskGroup</code>, or keep a strong reference: <code>tasks.add(t); t.add_done_callback(tasks.discard)</code>, and log exceptions in the callback.' },
    { trap: 'Swallowing <code>CancelledError</code>', code: `try:
    await call_llm()
except BaseException:          # or a bare except:
    log.warning("retrying")    # cancellation eaten: timeouts and shutdown break`, why: 'Cancellation is delivered as a <code>CancelledError</code> raised at the current <code>await</code>. Since 3.8 it subclasses <code>BaseException</code>, so <code>except Exception</code> lets it through, but bare <code>except</code> and <code>except BaseException</code> catch it. Then <code>asyncio.timeout</code>, <code>TaskGroup</code> and graceful shutdown stop working.', fix: 'Catch <code>Exception</code>, or re-raise: <code>except asyncio.CancelledError: cleanup(); raise</code>. Use <code>try/finally</code> for cleanup.' },
    { trap: '<code>gather</code> leaves siblings running on failure', why: 'Without <code>return_exceptions=True</code>, <code>gather</code> propagates the first exception immediately but does <b>not</b> cancel the other awaitables. They keep running, unobserved, and their failures go unreported.', fix: 'Use <code>asyncio.TaskGroup</code> (3.11+): on the first failure it cancels the rest, waits for them, and raises an <code>ExceptionGroup</code> with every error. Handle it with <code>except*</code>.' },
    { trap: 'Unbounded concurrency', code: `await asyncio.gather(*(call_llm(p) for p in prompts))   # 20,000 at once`, why: 'Tasks are cheap, so it is easy to open thousands of sockets at once: you hit rate limits, file-descriptor limits, connection-pool waits and memory spikes, and latency gets worse rather than better.', fix: 'Bound it: an <code>asyncio.Semaphore</code> around the call, a fixed number of worker tasks reading from an <code>asyncio.Queue(maxsize=…)</code>, or the client’s connection-pool limits.' },
    { trap: '<code>asyncio.run()</code> inside a running loop', code: `# inside a FastAPI handler or a Jupyter cell
asyncio.run(fetch())   # RuntimeError: asyncio.run() cannot be called from a running event loop`, why: 'There is one loop per thread, and <code>asyncio.run</code> wants to create and own it. Code already running on a loop must simply <code>await</code>.', fix: 'In async code, <code>await fetch()</code>. From a different (sync) thread, submit to the running loop with <code>asyncio.run_coroutine_threadsafe(coro, loop)</code>. See <a href="concurrency-choice.html">Choosing a concurrency model</a>.' }
  ],
  scenarios: [
    { title: 'An async API’s p99 jumps from 80 ms to 9 s under modest load',
      symptom: 'A FastAPI service with <code>async def</code> endpoints handles 30 req/s fine on a laptop, but in production p99 latency hits seconds, CPU is low, and even <code>/health</code> is slow.',
      diagnose: `$ PYTHONASYNCIODEBUG=1 uvicorn app:api
WARNING asyncio: Executing <Task pending name='Task-412' coro=<summarize() running at app.py:41>>
took 2.315 seconds`,
      diagnoseLang: 'bash',
      cause: 'One endpoint calls a vendor SDK built on <code>requests</code> (synchronous). Each call holds the event-loop thread for the full network round trip, so every other request on that worker queues behind it.',
      fix: 'Switch to the SDK’s async client, or push the blocking call to a thread. Alternatively declare the endpoint with plain <code>def</code>: FastAPI then runs it in its thread pool.',
      fixCode: `@app.post("/summarize")
async def summarize(req: Req):
    doc = await asyncio.to_thread(vendor.fetch_document, req.doc_id)   # off the loop
    async with httpx.AsyncClient(timeout=30) as client:                 # async I/O
        r = await client.post(LLM_URL, json={"text": doc.text})
    return r.json()` },
    { title: 'Agent fan-out triggers 429s and then cascading timeouts',
      symptom: 'A research agent plans 400 tool calls and runs them with <code>asyncio.gather</code>. The LLM provider returns HTTP 429 for most of them, retries pile up, and the run fails at its deadline.',
      diagnose: `# all 400 requests are in flight within ~50 ms
log.info("in_flight=%d", len([t for t in asyncio.all_tasks() if not t.done()]))`,
      cause: 'Nothing bounded concurrency. The provider’s rate limit is far below 400 concurrent requests, and immediate retries make it worse.',
      fix: 'Bound in-flight calls with a semaphore, retry with exponential backoff and jitter, and run the fan-out in a TaskGroup so one fatal error cancels the rest.',
      fixCode: `sem = asyncio.Semaphore(16)

async def call(tool_input):
    async with sem:
        for attempt in range(5):
            try:
                return await client.invoke(tool_input)
            except RateLimited:
                await asyncio.sleep(min(30, 2 ** attempt) * random.uniform(0.5, 1.5))
        raise RuntimeError("gave up")

async with asyncio.TaskGroup() as tg:
    results = [tg.create_task(call(x)) for x in plan]` },
    { title: 'Request deadlines stopped working after a “resilience” change',
      symptom: 'Requests that should time out after 10 s now run for minutes, and pods take a full grace period to shut down.',
      diagnose: `# the new retry helper
async def with_retry(fn):
    while True:
        try:
            return await fn()
        except BaseException as e:     # catches CancelledError too
            log.warning("retrying after %r", e)`,
      cause: '<code>asyncio.timeout</code> and shutdown both work by cancelling the task, which raises <code>CancelledError</code> inside it. The helper caught that and retried, so cancellation never completed.',
      fix: 'Catch only the errors you mean to retry, and let <code>CancelledError</code> propagate. Add a test that a cancelled call actually stops.',
      fixCode: `async def with_retry(fn, attempts=3):
    for i in range(attempts):
        try:
            return await fn()
        except (httpx.TransportError, TimeoutError):
            if i == attempts - 1:
                raise
            await asyncio.sleep(0.2 * 2 ** i)
        # CancelledError is a BaseException: not caught, propagates` },
    { title: 'Audit events go missing, with odd log lines',
      symptom: 'About 1% of audit events never reach the audit store. Logs occasionally show <code>Task was destroyed but it is pending!</code>.',
      diagnose: `async def handle(req):
    asyncio.create_task(audit.write(req.user, req.action))   # nothing keeps the task
    return await process(req)`,
      cause: 'The loop holds only weak references to tasks. With no other reference, the task object can be garbage-collected mid-flight, and its exceptions are never retrieved.',
      fix: 'Keep background tasks in a set with a done-callback that removes them and logs failures, and drain the set on shutdown.',
      fixCode: `_background: set[asyncio.Task] = set()

def spawn(coro) -> asyncio.Task:
    t = asyncio.create_task(coro)
    _background.add(t)
    t.add_done_callback(_done)
    return t

def _done(t: asyncio.Task) -> None:
    _background.discard(t)
    if not t.cancelled() and t.exception():
        log.error("background task failed", exc_info=t.exception())` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print to stdout?', code: `import asyncio

async def hello():
    print("hello")

async def main():
    hello()
    print("main done")

asyncio.run(main())`, options: ['hello<br>main done', 'main done', 'main done<br>hello', 'Nothing: it raises'], answer: 1, run: true, expect: 'main done', explain: '<code>hello()</code> only creates a coroutine object; without <code>await</code> (or a task) its body never runs. Python emits <code>RuntimeWarning: coroutine \'hello\' was never awaited</code> on stderr when the object is garbage-collected.' },
    { kind: 'predict', q: 'What does this print?', code: `import asyncio

async def worker(name):
    print(name, "start")
    await asyncio.sleep(0)
    print(name, "end")

async def main():
    t1 = asyncio.create_task(worker("A"))
    t2 = asyncio.create_task(worker("B"))
    print("tasks created")
    await t1
    await t2

asyncio.run(main())`, options: ['A start<br>A end<br>B start<br>B end<br>tasks created', 'tasks created<br>A start<br>A end<br>B start<br>B end', 'tasks created<br>A start<br>B start<br>A end<br>B end', 'A start<br>B start<br>tasks created<br>A end<br>B end'], answer: 2, run: true, expect: 'tasks created\nA start\nB start\nA end\nB end', explain: '<code>create_task</code> only <i>schedules</i>: <code>main</code> keeps running until its first <code>await</code>, so “tasks created” comes first. The ready queue is FIFO: A runs to its <code>sleep(0)</code> and goes to the back, B does the same, then A and B finish in order.' },
    { kind: 'predict', q: 'What does this print?', code: `import asyncio

async def job(name):
    print(name, "start")
    await asyncio.sleep(0)
    print(name, "end")

async def main():
    await job("a")
    await job("b")
    print("--")
    await asyncio.gather(job("c"), job("d"))

asyncio.run(main())`, options: ['a start<br>b start<br>a end<br>b end<br>--<br>c start<br>d start<br>c end<br>d end', 'a start<br>a end<br>b start<br>b end<br>--<br>c start<br>d start<br>c end<br>d end', 'a start<br>a end<br>b start<br>b end<br>--<br>c start<br>c end<br>d start<br>d end', 'a start<br>b start<br>a end<br>b end<br>--<br>c start<br>c end<br>d start<br>d end'], answer: 1, run: true, expect: 'a start\na end\nb start\nb end\n--\nc start\nd start\nc end\nd end', explain: '<code>await coro</code> runs the coroutine inside the current task: no concurrency, so a finishes before b starts. <code>gather</code> wraps each coroutine in its own Task, so c and d interleave at their <code>await</code> points.' },
    { kind: 'predict', q: 'One task in a TaskGroup fails. What does this print?', code: `import asyncio

async def fast():
    print("fast finished")

async def slow():
    try:
        await asyncio.Event().wait()     # waits forever
    except asyncio.CancelledError:
        print("slow cancelled")
        raise

async def bad():
    await asyncio.sleep(0)
    raise ValueError("boom")

async def main():
    try:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(fast())
            tg.create_task(slow())
            tg.create_task(bad())
    except* ValueError as eg:
        print("caught", [str(e) for e in eg.exceptions])

asyncio.run(main())`, options: ['fast finished<br>caught [\'boom\'] (and the program hangs on slow)', 'fast finished<br>slow cancelled<br>caught [\'boom\']', 'caught [\'boom\']<br>slow cancelled', 'ValueError: boom (uncaught)'], answer: 1, run: true, expect: "fast finished\nslow cancelled\ncaught ['boom']", explain: 'When <code>bad</code> fails, the TaskGroup cancels every remaining task, waits for them to finish (so <code>slow</code> gets to clean up), then raises an <code>ExceptionGroup</code> holding the <code>ValueError</code>. <code>except*</code> matches the <code>ValueError</code> inside the group.' },
    { kind: 'predict', q: 'The task catches its cancellation. What does this print?', code: `import asyncio

async def stubborn():
    try:
        await asyncio.Event().wait()
    except asyncio.CancelledError:
        print("ignoring cancel")
    return "still here"

async def main():
    t = asyncio.create_task(stubborn())
    await asyncio.sleep(0)       # let it start waiting
    t.cancel()
    print(await t)

asyncio.run(main())`, options: ['CancelledError is raised in main', 'ignoring cancel<br>still here', 'still here', 'ignoring cancel<br>CancelledError'], answer: 1, run: true, expect: 'ignoring cancel\nstill here', explain: '<code>cancel()</code> is a <b>request</b>: it throws <code>CancelledError</code> into the coroutine at its current <code>await</code>. Here the coroutine catches it and returns normally, so the task ends with a result, not cancelled. That is exactly what breaks timeouts and TaskGroups: always re-raise.' },
    { kind: 'predict', q: 'One coroutine calls <code>time.sleep</code>. What does this print?', code: `import asyncio
import time

async def ticker():
    for i in range(3):
        print("tick", i)
        await asyncio.sleep(0)

async def blocker():
    print("block start")
    time.sleep(0.2)            # not asyncio.sleep
    print("block end")

async def main():
    await asyncio.gather(ticker(), blocker())

asyncio.run(main())`, options: ['tick 0<br>block start<br>tick 1<br>tick 2<br>block end', 'tick 0<br>block start<br>block end<br>tick 1<br>tick 2', 'block start<br>block end<br>tick 0<br>tick 1<br>tick 2', 'tick 0<br>tick 1<br>tick 2<br>block start<br>block end'], answer: 1, run: true, expect: 'tick 0\nblock start\nblock end\ntick 1\ntick 2', explain: '<code>ticker</code> yields after “tick 0” and <code>blocker</code> starts. <code>time.sleep</code> never yields to the loop, so nothing else can run for 0.2 s; only when <code>blocker</code> returns does <code>ticker</code> get its next turn. In a server, that is 0.2 s added to every in-flight request.' },
    { kind: 'concept', q: 'Why can <code>asyncio.create_task(coro())</code> with the result discarded lose work?', options: ['create_task is lazy and never starts the task', 'The event loop keeps only weak references to tasks, so an unreferenced task may be garbage-collected before it finishes', 'Tasks are cancelled when the creating function returns', 'It only runs if you call loop.run_forever()'], answer: 1, explain: 'The asyncio docs say to save a reference to the result of <code>create_task</code>. Use a TaskGroup, or a set of tasks plus a done-callback that discards finished ones.' },
    { kind: 'concept', q: 'Inside a coroutine, when can another task run?', options: ['At any bytecode, every 5 ms', 'Only when this coroutine awaits something that isn’t ready yet (or the step ends)', 'Whenever a function is called', 'Only when the coroutine returns'], answer: 1, explain: 'asyncio is cooperative. A task step runs until it awaits an unfinished future (a socket read, a sleep, a lock), returns or raises. Awaiting an already-finished future or a plain coroutine that doesn’t suspend does not switch. That is why <code>await asyncio.sleep(0)</code> is the explicit “yield now”.' }
  ],
  interview: [
    { q: 'What does one iteration of the event loop do?', a: '<ol><li>Compute a timeout: 0 if callbacks are ready, else until the earliest timer, else block indefinitely.</li><li>Call the selector (<code>epoll</code>/<code>kqueue</code>/IOCP) and wait for ready file descriptors up to that timeout.</li><li>Queue the callbacks of ready sockets, and move due timers from the heap to the ready queue.</li><li>Run every callback that was ready at the start of this step, in FIFO order. A task step is one such callback.</li></ol><p>Callbacks added during this run wait for the next iteration, so the loop can’t be starved by a self-rescheduling task.</p>', lvl: 'deep' },
    { q: 'Coroutine vs Task vs Future?', a: '<p>A <b>coroutine</b> is the paused function object from calling an <code>async def</code>; awaiting it runs it inline in the current task. A <b>Future</b> is a low-level result placeholder with callbacks, set by someone else (a socket callback, an executor). A <b>Task</b> is a Future that drives a coroutine: it calls <code>coro.send()</code> step by step, and when the coroutine awaits a Future it registers a wakeup callback on it. Concurrency comes from having several Tasks.</p>', lvl: 'core' },
    { q: 'What exactly does <code>await</code> do?', a: '<p><code>await x</code> calls <code>x.__await__()</code> and delegates to it, like <code>yield from</code>. If the chain ends in a Future that isn’t done, the Future is yielded all the way up to the Task, the task step ends, and the loop moves on. When the Future completes, its callback schedules the Task again and execution resumes right after the <code>await</code> with the result (or the exception raised there). Awaiting a coroutine that never suspends doesn’t switch tasks at all.</p>', lvl: 'deep' },
    { q: 'How do you find and fix code that blocks the event loop?', a: '<ul><li>Run with debug mode (<code>asyncio.run(main(), debug=True)</code> or <code>PYTHONASYNCIODEBUG=1</code>): steps longer than <code>slow_callback_duration</code> (100 ms) are logged with the task name.</li><li>Watch loop lag: a heartbeat task measuring how late its <code>sleep</code> wakes up.</li><li>Profile with py-spy: the loop thread sitting in <code>socket.recv</code> or a CPU function rather than in the selector.</li></ul><p>Fix: async libraries for I/O, <code>asyncio.to_thread</code> for unavoidable blocking calls, a process pool via <code>run_in_executor</code> for CPU.</p>', lvl: 'core' },
    { q: '<code>gather</code> vs <code>TaskGroup</code> vs <code>wait</code> vs <code>as_completed</code>?', a: '<ul><li><code>TaskGroup</code> (3.11+): structured; waits for all, cancels the rest on the first failure, raises an <code>ExceptionGroup</code>. The default choice.</li><li><code>gather</code>: results in input order; the first exception propagates without cancelling the others, unless <code>return_exceptions=True</code>.</li><li><code>wait(tasks, return_when=FIRST_COMPLETED)</code>: low-level, returns done/pending sets; good for “first response wins”.</li><li><code>as_completed</code>: iterate results in completion order.</li></ul>', lvl: 'core' },
    { q: 'How does cancellation work?', a: '<p><code>task.cancel()</code> marks the task and cancels the Future it’s waiting on. On its next step, <code>CancelledError</code> is raised inside the coroutine at that <code>await</code>, so <code>finally</code> blocks and <code>async with</code> exits run. The coroutine should let it propagate. A task that catches it and continues is no longer cancelled (3.11 added <code>cancelling()</code>/<code>uncancel()</code> so timeouts and TaskGroups can tell their own cancellations apart). <code>asyncio.shield</code> protects an inner awaitable from outer cancellation.</p>', fu: 'Why is CancelledError a BaseException? (Since 3.8, so generic <code>except Exception</code> handlers don’t swallow it by accident.)', lvl: 'deep' },
    { q: '<code>asyncio.timeout()</code> vs <code>wait_for</code>?', a: '<p><code>async with asyncio.timeout(s)</code> (3.11) applies one deadline to a whole block: a timer cancels the current task when due, and on exit the <code>CancelledError</code> is converted to <code>TimeoutError</code>. The deadline can be moved with <code>reschedule()</code>. <code>wait_for(aw, s)</code> wraps a single awaitable; since 3.12 it is implemented on top of <code>timeout()</code>. Both raise the built-in <code>TimeoutError</code> (asyncio’s is an alias since 3.11).</p>', lvl: 'core' },
    { q: 'How do you call blocking code from async code, and async code from sync code?', a: '<ul><li>Blocking from async: <code>await asyncio.to_thread(fn, *args)</code> (3.9+) or <code>loop.run_in_executor(pool, fn)</code> for a specific (e.g. process) pool.</li><li>Async from sync, no loop running: <code>asyncio.run(coro)</code> at the program’s top level.</li><li>Async from another thread while a loop runs: <code>asyncio.run_coroutine_threadsafe(coro, loop).result(timeout)</code>.</li></ul><p>See <a href="concurrency-choice.html">Choosing a concurrency model</a>.</p>', lvl: 'core' },
    { q: 'How do you apply backpressure in asyncio?', a: '<p>Bound the work in flight: an <code>asyncio.Semaphore</code> around the expensive call, or N worker tasks consuming an <code>asyncio.Queue(maxsize=M)</code> so producers block on <code>put</code> when consumers fall behind. Also size HTTP and DB connection pools explicitly. Unbounded <code>create_task</code>/<code>gather</code> is the async version of an unbounded thread pool.</p>', lvl: 'core' },
    { q: 'What changed in recent versions (3.11–3.14)?', a: '<ul><li>3.11: <code>TaskGroup</code>, <code>timeout()</code>, <code>Runner</code>, <code>ExceptionGroup</code> and <code>except*</code>, and a faster asyncio in general.</li><li>3.12: eager task execution (<code>asyncio.eager_task_factory</code>) runs a new task synchronously until its first real suspension; C-accelerated <code>current_task</code>; <code>wait_for</code> rebuilt on <code>timeout()</code>.</li><li>3.13: mostly incremental improvements (for example <code>Queue.shutdown()</code>). Asyncio code runs unchanged on the free-threaded build.</li><li>3.14: introspection of a live process with <code>python -m asyncio ps PID</code> and <code>pstree PID</code>, plus <code>asyncio.print_call_graph()</code>. <code>asyncio.get_event_loop()</code> now raises <code>RuntimeError</code> when there is no current loop, instead of creating one.</li></ul>', lvl: 'deep' },
    { q: 'Compare asyncio with Java’s CompletableFuture and virtual threads.', a: '<p><code>CompletableFuture</code> chains callbacks; asyncio’s <code>async</code>/<code>await</code> is the same model written as straight-line code. Java 21 virtual threads instead keep blocking-style code and make threads cheap: the JVM unmounts a virtual thread when it blocks on I/O. asyncio needs “coloured” functions (<code>async def</code> all the way up) and async libraries, and a blocking call still blocks the loop. The closest Java analogue of an asyncio service is a reactive stack (WebFlux/Netty event loops), with the same “never block the event loop” rule.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Bounded, cancellable LLM fan-out', lang: 'python', code: `import asyncio
import logging
import random

import httpx

log = logging.getLogger(__name__)

async def complete(client: httpx.AsyncClient, sem: asyncio.Semaphore, prompt: str) -> str:
    async with sem:                                        # at most N requests in flight
        for attempt in range(4):
            try:
                r = await client.post("/v1/complete", json={"prompt": prompt})
                if r.status_code == 429:
                    raise httpx.HTTPStatusError("rate limited", request=r.request, response=r)
                r.raise_for_status()
                return r.json()["text"]
            except (httpx.TransportError, httpx.HTTPStatusError) as e:
                if attempt == 3:
                    raise
                delay = min(20, 2 ** attempt) * random.uniform(0.5, 1.5)
                log.warning("retry %d for %.30r after %r (%.1fs)", attempt + 1, prompt, e, delay)
                await asyncio.sleep(delay)
    raise AssertionError("unreachable")

async def run_all(prompts: list[str], max_in_flight: int = 16, deadline_s: float = 120) -> list[str]:
    sem = asyncio.Semaphore(max_in_flight)
    limits = httpx.Limits(max_connections=max_in_flight)
    async with httpx.AsyncClient(base_url="https://llm.internal", timeout=60, limits=limits) as client:
        async with asyncio.timeout(deadline_s):            # one deadline for the whole batch
            async with asyncio.TaskGroup() as tg:          # first fatal error cancels the rest
                tasks = [tg.create_task(complete(client, sem, p)) for p in prompts]
    return [t.result() for t in tasks]`, note: 'Bounded by a semaphore and the connection pool, with jittered retries, one deadline, and structured cancellation.' },
    { title: 'Producer/consumer with a bounded queue', lang: 'python', code: `import asyncio

async def producer(q: asyncio.Queue[str], source) -> None:
    async for doc in source:                   # e.g. paginated API, streaming file
        await q.put(doc)                       # blocks when consumers fall behind

async def consumer(name: str, q: asyncio.Queue[str], sink) -> None:
    while True:
        doc = await q.get()
        try:
            await sink.index(await embed(doc))
        finally:
            q.task_done()

async def pipeline(source, sink, workers: int = 8) -> None:
    q: asyncio.Queue[str] = asyncio.Queue(maxsize=100)
    async with asyncio.TaskGroup() as tg:
        consumers = [tg.create_task(consumer(f"c{i}", q, sink)) for i in range(workers)]
        await producer(q, source)
        await q.join()                         # every item processed
        for c in consumers:
            c.cancel()                         # consumers loop forever: stop them`, note: 'The queue’s <code>maxsize</code> is the backpressure. Cancelling the consumers from inside the TaskGroup is a normal, clean shutdown.' },
    { title: 'Java comparison: virtual threads vs asyncio', lang: 'java', code: `// Java 21: blocking-style code, cheap virtual threads; the JVM parks them on I/O.
try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
    List<Future<String>> fs = prompts.stream()
        .map(p -> exec.submit(() -> llm.complete(p)))   // plain blocking HTTP call
        .toList();
    for (var f : fs) use(f.get());
}
// Python asyncio: the same concurrency, but every function on the path is "async"
// and every library must be async-aware:
//   async with asyncio.TaskGroup() as tg:
//       tasks = [tg.create_task(llm.complete(p)) for p in prompts]
// A blocking call inside a coroutine stalls the loop; in Java it would only park one
// virtual thread (unless it pins the carrier, e.g. inside synchronized before JDK 24).`, note: 'Bounding concurrency is still your job in both: a <code>Semaphore</code> works the same way in Java and Python.' }
  ]
});

IA.register({
  track: 'python',
  slug: 'fastapi',
  title: 'FastAPI services',
  tagline: 'FastAPI reads your <b>function signature</b> and turns it into a pipeline: route match → resolve <code>Depends()</code> → validate with Pydantic → call your function → filter through <code>response_model</code> → JSON. The one rule that decides whether it scales: <code>async def</code> runs <b>on the event loop</b>, plain <code>def</code> runs <b>in a threadpool</b>. A blocking call in the wrong one stalls every request in the process.',
  tldr: {
    problem: 'FastAPI makes the first version easy. Production trouble comes from the parts it hides: a blocking SDK call inside <code>async def</code>, a threadpool of 40 that quietly queues requests, clients created per request, state that is per <i>worker</i> process, and fields leaking out because there is no response model.',
    model: 'An ASGI server (uvicorn) runs an asyncio event loop per worker process. For each request, Starlette routes to your path operation, FastAPI resolves its dependency graph (cached per request), validates path, query, header and body parameters into typed objects, awaits <code>async def</code> functions directly and sends <code>def</code> functions to a worker thread, then serialises the return value through the response model.',
    hook: '“Why does one slow endpoint make <code>/health</code> time out?” Because it is <code>async def</code> and calls something blocking (<code>requests</code>, <code>time.sleep</code>, a sync DB driver, CPU work). The loop can’t run anything else until it returns.',
    facts: [
      { v: '40', l: 'default size of the AnyIO thread limiter that runs sync <code>def</code> endpoints and dependencies. Request 41 waits for a free thread' },
      { v: '422', l: 'status FastAPI returns when request validation fails, with a <code>detail</code> list giving each error’s <code>loc</code>, <code>msg</code> and <code>type</code>' },
      { v: '1× per request', l: 'how often a dependency runs, even if several parts of the graph ask for it (<code>use_cache=True</code> is the default)' }
    ]
  },
  intro: {
    what: 'FastAPI is a Python web framework for building HTTP APIs. You write ordinary functions with <b>type hints</b>, and FastAPI uses those hints to read the request (path, query string, JSON body), check that the data is valid, call your function, and turn the result into JSON. It also generates OpenAPI documentation from the same hints. It runs on an <b>ASGI server</b> such as uvicorn, which handles many connections at once with <code>asyncio</code>.',
    analogy: { icon: '🛂', title: 'An airport, gate by gate', text: 'A passenger (request) goes through check-in (routing), security that hands them what they need for the flight (dependencies: a boarding pass, a seat), passport control that rejects bad documents with a precise reason (validation, 422), then boards (your function). Most staff are a single fast-moving team (the event loop). If one officer stops to read a whole novel (a blocking call), the entire queue stops.' },
    steps: [
      { t: 'A path operation is a typed function', d: 'Path and query parameters come from the signature.', code: 'from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get("/orders/{order_id}")\nasync def get_order(order_id: int, expand: bool = False):\n    return {"id": order_id, "expand": expand}' },
      { t: 'Bodies are Pydantic models', d: 'Invalid input never reaches your code; the client gets a 422 explaining what is wrong.', code: 'from pydantic import BaseModel, Field\n\nclass OrderIn(BaseModel):\n    sku: str\n    quantity: int = Field(gt=0)\n\n@app.post("/orders", status_code=201)\nasync def create(order: OrderIn): ...' },
      { t: 'Dependencies are injected', d: '<code>Depends()</code> runs a function per request and passes its result in. With <code>yield</code> it can also clean up.', code: 'async def get_session():\n    async with SessionLocal() as s:\n        yield s\n\n@app.get("/orders")\nasync def list_orders(s: Annotated[AsyncSession, Depends(get_session)]): ...' },
      { t: 'Pick async def or def deliberately', d: '<code>async def</code> only if everything inside is awaited (async DB driver, <code>httpx.AsyncClient</code>). Otherwise use <code>def</code>, and FastAPI runs it in a thread.' },
      { t: 'Serve it', d: 'uvicorn runs the app; several worker processes use several cores.', code: 'fastapi run app/main.py --workers 4\n# or: uvicorn app.main:app --host 0.0.0.0 --workers 4', lang: 'bash' }
    ],
    terms: [
      ['ASGI', 'The async successor of WSGI: an app is <code>async def app(scope, receive, send)</code>. Uvicorn speaks HTTP and calls it.'],
      ['path operation', 'A function decorated with <code>@app.get/post/…</code>: FastAPI’s name for an endpoint.'],
      ['dependency', 'A function given to <code>Depends()</code> whose result FastAPI injects. Used for DB sessions, auth, settings, pagination.'],
      ['Pydantic model', 'A class whose fields are validated (and converted) from input data. FastAPI uses Pydantic v2.'],
      ['response_model', 'The schema the return value is filtered and serialised through. Fields not in it are dropped.'],
      ['worker', 'One OS process running the app with its own event loop and memory. N workers = N copies of every global.']
    ]
  },
  visual: {
    title: 'One request through the pipeline',
    caption: 'Choose the endpoint style and whether the body is valid, then press <b>Play</b> or <b>Step</b>. Request A is <code>POST /orders</code>; halfway through, request B (<code>GET /health</code>) arrives. Watch which thread runs the endpoint, and whether B has to wait.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'ASGI by hand', code: `import asyncio, json

# This is all an ASGI app is. FastAPI/Starlette build this for you.
async def app(scope, receive, send):
    assert scope["type"] == "http"
    body = b""
    while True:
        msg = await receive()
        body += msg.get("body", b"")
        if not msg.get("more_body"):
            break
    payload = {"method": scope["method"], "path": scope["path"], "got": json.loads(body or b"null")}
    await send({"type": "http.response.start", "status": 200,
                "headers": [(b"content-type", b"application/json")]})
    await send({"type": "http.response.body", "body": json.dumps(payload).encode()})

# A toy "server": what uvicorn does after parsing the HTTP bytes
async def fake_server():
    scope = {"type": "http", "method": "POST", "path": "/orders", "headers": []}
    chunks = [{"type": "http.request", "body": b'{"sku": "A1",', "more_body": True},
              {"type": "http.request", "body": b' "quantity": 3}', "more_body": False}]
    async def receive():
        return chunks.pop(0)
    async def send(message):
        print("server got:", message)
    await app(scope, receive, send)

await fake_server()     # top-level await works here; in a script: asyncio.run(fake_server())`, note: 'Uvicorn parses HTTP into a <code>scope</code> dict and message events. Everything else (routing, validation, DI) is the framework.' },
      { label: 'How Depends() resolves', code: `import asyncio, inspect
from contextlib import AsyncExitStack

class Depends:
    def __init__(self, fn): self.fn = fn

async def solve(fn, cache, stack):
    """Resolve fn's parameters recursively, once per request (like FastAPI's cache)."""
    kwargs = {}
    for name, p in inspect.signature(fn).parameters.items():
        if isinstance(p.default, Depends):
            dep = p.default.fn
            if dep not in cache:
                cache[dep] = await solve(dep, cache, stack)
            kwargs[name] = cache[dep]
    if inspect.isasyncgenfunction(fn):                     # a "yield" dependency
        gen = fn(**kwargs)
        value = await gen.__anext__()
        stack.push_async_callback(gen.aclose)             # teardown after the request
        return value
    result = fn(**kwargs)
    return await result if inspect.isawaitable(result) else result

async def get_settings():
    print("  get_settings()")
    return {"db": "postgres://..."}

async def get_session(settings=Depends(get_settings)):
    print("  open session")
    try:
        yield "session#1"
    finally:
        print("  close session")

async def current_user(session=Depends(get_session), settings=Depends(get_settings)):
    print("  current_user() using", session)
    return "asha"

async def create_order(user=Depends(current_user), session=Depends(get_session)):
    return f"order created by {user} via {session}"

async def handle():
    async with AsyncExitStack() as stack:
        print("request starts")
        result = await solve(create_order, {}, stack)
        print("endpoint returned:", result)
    print("request finished")

await handle()`, note: '<code>get_settings</code> and <code>get_session</code> are each requested twice but run once: the per-request cache. Teardown runs when the request’s exit stack closes.' },
      { label: 'Blocking the loop', code: `import asyncio, time

def cpu_work(ms):
    end = time.perf_counter() + ms / 1000
    while time.perf_counter() < end:      # busy: stands in for requests.get, time.sleep, CPU work
        pass

async def heartbeat(log):
    t0 = time.perf_counter()
    for _ in range(6):
        await asyncio.sleep(0.05)
        log.append(round((time.perf_counter() - t0) * 1000))

async def bad_endpoint():
    cpu_work(300)                          # blocks the event loop

async def good_endpoint():
    await asyncio.sleep(0.3)               # yields to the loop while "waiting"

for ep in (bad_endpoint, good_endpoint):
    log = []
    await asyncio.gather(ep(), heartbeat(log))
    print(f"{ep.__name__:14} heartbeat ticks at ms: {log}")`, note: 'With the bad endpoint the first tick comes after ~300 ms instead of 50: every other request (and the health check) waited that long.' },
      { label: 'Sequential vs concurrent awaits', code: `import asyncio, time

async def call_tool(name, seconds):
    await asyncio.sleep(seconds)          # an LLM / HTTP call
    return f"{name} done"

async def sequential():
    return [await call_tool("search", 0.3), await call_tool("weather", 0.3), await call_tool("db", 0.3)]

async def concurrent():
    async with asyncio.TaskGroup() as tg:          # 3.11+
        tasks = [tg.create_task(call_tool(n, 0.3)) for n in ("search", "weather", "db")]
    return [t.result() for t in tasks]

for f in (sequential, concurrent):
    t0 = time.perf_counter()
    out = await f()
    print(f"{f.__name__:10} {time.perf_counter() - t0:.2f}s {out}")`, note: '<code>async def</code> buys nothing if you await independent calls one by one. See <a href="asyncio.html">asyncio</a>.' },
      { label: 'What a 422 looks like', code: `import json

# The shape FastAPI returns for invalid input (Pydantic v2 error format)
body = {"sku": "", "quantity": "lots"}
detail = []
if not body.get("sku"):
    detail.append({"type": "string_too_short", "loc": ["body", "sku"],
                   "msg": "String should have at least 1 character", "input": body["sku"]})
try:
    int(body["quantity"])
except ValueError:
    detail.append({"type": "int_parsing", "loc": ["body", "quantity"],
                   "msg": "Input should be a valid integer, unable to parse string as an integer",
                   "input": body["quantity"]})
print("HTTP/1.1 422 Unprocessable Entity")
print(json.dumps({"detail": detail}, indent=2))`, note: 'Hand-built here to show the format: <code>loc</code> says where (body, query, path, header) and which field. Clients and tests can rely on <code>type</code>.' }
    ]
  },
  gotchas: [
    { trap: 'Blocking calls inside <code>async def</code>', code: `@app.post("/summarize")
async def summarize(doc: Doc):
    r = requests.post(LLM_URL, json=doc.model_dump(), timeout=30)   # blocks the loop
    time.sleep(0.5)                                                  # so does this
    return r.json()`, why: 'An <code>async def</code> path operation runs on the event loop thread. Until it reaches an <code>await</code> that yields, nothing else in that worker process runs: not other requests, not the health check, not timeouts.', fix: 'Use async libraries (<code>httpx.AsyncClient</code>, asyncpg / SQLAlchemy async, <code>await asyncio.sleep</code>). If you must call blocking code, declare the endpoint with plain <code>def</code>, or wrap the call: <code>await run_in_threadpool(fn, ...)</code> / <code>await asyncio.to_thread(fn, ...)</code>. CPU-heavy work belongs in a process pool or a job queue.' },
    { trap: 'The sync threadpool is only 40 threads', code: `@app.get("/report")
def report():                       # sync: runs in AnyIO's threadpool
    return slow_vendor_sdk.fetch()  # 2 s each; 41st concurrent request waits`, why: 'Sync endpoints and sync dependencies share one limiter, 40 tokens by default. Under load, requests queue for a thread while CPU sits idle, and latency climbs in steps.', fix: 'Prefer async I/O. Otherwise raise the limit at startup (<code>anyio.to_thread.current_default_thread_limiter().total_tokens = 100</code> in the lifespan), keep sync dependencies cheap, and size DB pools to match.' },
    { trap: 'Route order: <code>/users/me</code> after <code>/users/{user_id}</code>', code: `@app.get("/users/{user_id}")
async def get_user(user_id: int): ...

@app.get("/users/me")          # never reached
async def me(): ...
# GET /users/me -> 422: "Input should be a valid integer" for user_id`, why: 'Routes are matched in declaration order. <code>/users/me</code> matches the path pattern <code>/users/{user_id}</code> first, and then validation fails on <code>"me"</code>.', fix: 'Declare fixed paths before parameterised ones, or constrain the parameter (<code>/users/{user_id:int}</code> path convertor).' },
    { trap: 'Leaking fields by returning ORM objects or dicts', code: `@app.get("/users/{id}")
async def get_user(id: int, s: SessionDep):
    return await s.get(User, id)   # password_hash, mfa_secret ... all serialised`, why: 'Without a response model, FastAPI serialises whatever you return with <code>jsonable_encoder</code>, including internal columns added later by someone else.', fix: 'Always declare an output schema: a return annotation (<code>-&gt; UserOut</code>) or <code>response_model=UserOut</code>, with <code>model_config = ConfigDict(from_attributes=True)</code>. Keep input and output models separate.' },
    { trap: 'A new HTTP client per request', code: `@app.get("/rates")
async def rates():
    async with httpx.AsyncClient() as c:      # new pool, new TLS handshake, every request
        return (await c.get(FX_URL)).json()`, why: 'Each client has its own connection pool. Creating one per request throws away keep-alive and TLS sessions, adds latency, and under load can exhaust sockets or file descriptors.', fix: 'Create long-lived clients (HTTP, DB engines, LLM SDK clients) once in the <code>lifespan</code> handler, store them on <code>app.state</code>, close them at shutdown, and inject them with a dependency.' },
    { trap: 'Globals are per worker process', code: `hits = 0
@app.get("/hit")
async def hit():
    global hits; hits += 1
    return {"hits": hits}       # with --workers 4: four different counters`, why: 'Each uvicorn or gunicorn worker (and each Kubernetes pod) is a separate process with its own memory. In-memory caches, rate limiters and “only once” flags silently split.', fix: 'Keep shared state in Redis or Postgres. Treat in-process caches as per-worker optimisations only, and design for N copies.' },
    { trap: 'A <code>list</code> query parameter becomes a body', code: `@app.get("/items")
async def items(tag: list[str] | None = None): ...   # expected ?tag=a&tag=b

@app.get("/items")
async def items(tag: Annotated[list[str] | None, Query()] = None): ...   # correct`, why: 'FastAPI treats a plain <code>list</code> parameter as part of the request body. You must say explicitly that it comes from the query string.', fix: 'Use <code>Query()</code> for list query parameters (and <code>Header()</code>, <code>Cookie()</code> where relevant). Check the generated <code>/docs</code> page: it shows where each parameter is read from.' }
  ],
  scenarios: [
    { title: 'Pods restarting under load: liveness probe timeouts',
      symptom: 'A new “summarise this document” endpoint shipped. Under moderate load, <code>/healthz</code> started timing out, Kubernetes restarted pods, and in-flight requests failed. CPU was low.',
      diagnose: `$ py-spy dump --pid 1
Thread 1 (idle): "MainThread"
    recv_into (ssl.py)
    ...
    post (requests/api.py:115)
    summarize (app/routes/docs.py:42)      <- inside an async def
    run (asyncio/runners.py)
# or run with PYTHONASYNCIODEBUG=1 and look for:
# "Executing <Task ... summarize() ...> took 4.812 seconds"`,
      lang: 'bash',
      cause: 'The endpoint was <code>async def</code> but called the LLM API with the synchronous <code>requests</code> library. Each call blocked the event loop for several seconds, so the health check (on the same loop) could not answer within the probe timeout.',
      fix: 'Use an async client created once in the lifespan, with explicit timeouts. Keep probes cheap, and run liveness on a path that never touches dependencies.',
      fixCode: `@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.llm = httpx.AsyncClient(base_url=LLM_URL, timeout=httpx.Timeout(30.0, connect=3.0))
    yield
    await app.state.llm.aclose()

@app.post("/summarize")
async def summarize(doc: Doc, request: Request) -> Summary:
    r = await request.app.state.llm.post("/v1/summarize", json=doc.model_dump())
    r.raise_for_status()
    return Summary.model_validate(r.json())` },
    { title: '502s and “WORKER TIMEOUT” in gunicorn logs',
      symptom: 'Behind nginx, users saw intermittent 502s on an upload endpoint. Gunicorn logged <code>[CRITICAL] WORKER TIMEOUT (pid:212)</code> followed by a new worker booting.',
      diagnose: `@app.post("/invoices/render")
async def render(inv: Invoice) -> Response:
    pdf = build_pdf(inv)          # pure-Python layout: 20-40 s of CPU for big invoices
    return Response(pdf, media_type="application/pdf")`,
      cause: 'CPU-bound work in an <code>async def</code> blocked the worker’s event loop for longer than gunicorn’s <code>--timeout</code> (30 s by default). The worker could not report that it was alive, so the arbiter killed it, along with every request it was handling.',
      fix: 'Move heavy CPU work out of the request path: a job queue (Celery, Arq, RQ) with a status endpoint, or at least a <code>ProcessPoolExecutor</code>. Keep the request handler fast.',
      fixCode: `pool = ProcessPoolExecutor(max_workers=2)     # created in the lifespan in real code

@app.post("/invoices/render", status_code=202)
async def render(inv: Invoice) -> JobOut:
    job_id = await queue.enqueue("render_pdf", inv.model_dump())   # worker process does the CPU work
    return JobOut(id=job_id, status_url=f"/jobs/{job_id}")` },
    { title: '“QueuePool limit of size 5 overflow 10 reached”',
      symptom: 'After a refactor, the API slowed down and then failed with SQLAlchemy pool timeouts. Postgres showed many idle connections from the service.',
      diagnose: `def get_session():
    return SessionLocal()           # no yield, no close: never returned to the pool

@app.get("/orders")
def list_orders(s: Session = Depends(get_session)): ...`,
      lang: 'python',
      cause: 'The dependency created a session but nothing ever closed it, so each request held a pooled connection until garbage collection happened to reclaim it. Under load the pool (5 + 10 overflow) ran dry.',
      fix: 'Use a <code>yield</code> dependency so cleanup always runs, even when the endpoint raises.',
      fixCode: `def get_session() -> Iterator[Session]:
    with SessionLocal() as session:     # closes on exit, returns the connection
        yield session

SessionDep = Annotated[Session, Depends(get_session)]` }
  ],
  puzzles: [
    { kind: 'predict', q: 'An async handler makes a blocking call. In what order do the lines print?', code: `import asyncio, time

async def slow_handler():
    print("slow: start")
    time.sleep(0.05)          # blocking call inside async def
    print("slow: end")

async def health():
    print("health: start")
    await asyncio.sleep(0)
    print("health: end")

async def main():
    await asyncio.gather(slow_handler(), health())

asyncio.run(main())`, options: ['slow: start<br>health: start<br>health: end<br>slow: end', 'slow: start<br>slow: end<br>health: start<br>health: end', 'health: start<br>slow: start<br>health: end<br>slow: end', 'slow: start<br>health: start<br>slow: end<br>health: end'], answer: 1, run: true, expect: 'slow: start\nslow: end\nhealth: start\nhealth: end', explain: '<code>gather</code> schedules both as tasks, and <code>slow_handler</code> starts first. <code>time.sleep</code> never yields to the loop, so <code>health</code> cannot even start until the slow handler finishes. In a server, that is your <code>/health</code> endpoint timing out.' },
    { kind: 'predict', q: 'Three tool calls, awaited two ways. What does this print?', code: `import asyncio

order = []

async def call(name):
    order.append(f"start {name}")
    await asyncio.sleep(0)
    order.append(f"end {name}")

async def sequential():
    await call("a")
    await call("b")

async def concurrent():
    await asyncio.gather(call("a"), call("b"))

asyncio.run(sequential())
print(order)
order.clear()
asyncio.run(concurrent())
print(order)`, options: ["['start a', 'end a', 'start b', 'end b']<br>['start a', 'start b', 'end a', 'end b']", "['start a', 'start b', 'end a', 'end b']<br>['start a', 'start b', 'end a', 'end b']", "['start a', 'end a', 'start b', 'end b']<br>['start a', 'end a', 'start b', 'end b']", "['start a', 'start b', 'end b', 'end a']<br>['start a', 'start b', 'end a', 'end b']"], answer: 0, run: true, expect: "['start a', 'end a', 'start b', 'end b']\n['start a', 'start b', 'end a', 'end b']", explain: '<code>await call("a")</code> finishes <code>a</code> before <code>b</code> even starts: no concurrency. <code>gather</code> turns both into tasks; each runs until its first <code>await</code> that yields, so they interleave. Awaiting independent LLM or HTTP calls one after another is the most common reason an async endpoint is slow.' },
    { kind: 'concept', q: 'The body model requires <code>quantity: int = Field(gt=0)</code>. A client sends <code>{"sku": "A1"}</code>. What happens?', options: ['Your function runs with quantity=None', '400 Bad Request with a plain-text message', '422 with <code>detail[0].loc == ["body", "quantity"]</code> and <code>type: "missing"</code>; your function never runs', '500 Internal Server Error'], answer: 2, explain: 'FastAPI validates every parameter before calling the endpoint and returns 422 with Pydantic’s error list. Customise it with an exception handler for <code>RequestValidationError</code> if your API contract needs another format.' },
    { kind: 'concept', q: '<code>@app.get("/users/{user_id}")</code> with <code>user_id: int</code> is declared <b>before</b> <code>@app.get("/users/me")</code>. What does <code>GET /users/me</code> return?', options: ['The /users/me handler’s response', '404 Not Found', '422: user_id must be a valid integer', '405 Method Not Allowed'], answer: 2, explain: 'Starlette matches routes in order, by path pattern only. <code>/users/{user_id}</code> matches <code>/users/me</code>, and then validation fails on <code>"me"</code>. Declare fixed paths first.' },
    { kind: 'concept', q: 'One worker. A <b>sync</b> <code>def</code> endpoint calls <code>time.sleep(1)</code>. 100 requests arrive at once. Roughly how long until the last response, with default settings?', options: ['~1 s', '~3 s', '~100 s', '~40 s'], answer: 1, explain: 'Sync endpoints run in AnyIO’s threadpool, limited to 40 concurrent threads by default: 40 + 40 + 20, about <b>3 s</b>. Had it been <code>async def</code> with <code>time.sleep(1)</code>, the loop would run them one at a time: ~100 s. With <code>async def</code> and <code>await asyncio.sleep(1)</code>: ~1 s.' },
    { kind: 'concept', q: 'Both <code>current_user</code> and the endpoint declare <code>session: Annotated[Session, Depends(get_session)]</code>. How many sessions are opened per request?', options: ['One: the result is cached for the request', 'Two: one per declaration', 'One per worker process, shared', 'Zero until the session is used'], answer: 0, explain: 'FastAPI caches each dependency’s result within one request, so the endpoint and <code>current_user</code> share the same session (and the same transaction). Use <code>Depends(get_session, use_cache=False)</code> if you really need a separate instance.' },
    { kind: 'concept', q: 'The endpoint returns a <code>User</code> ORM object with <code>password_hash</code>, and is declared <code>-&gt; UserOut</code>, which has only <code>id</code> and <code>email</code>. What does the client receive?', options: ['All columns, including password_hash', '<code>{"id": …, "email": …}</code>', 'A 500, because User is not a UserOut', 'An empty object'], answer: 1, explain: 'The return annotation (or <code>response_model</code>) is used to validate and <b>filter</b> the output. With <code>from_attributes=True</code> on <code>UserOut</code>, Pydantic reads the attributes it declares from the ORM object and ignores the rest. This is your main defence against leaking columns.' },
    { kind: 'concept', q: 'You run <code>uvicorn app:app --workers 4</code> and keep a rate-limit counter in a module-level dict. A client sends 100 requests. What does the limiter see?', options: ['100 requests in one counter', 'Roughly 25 per counter, in 4 separate counters', 'An error: globals aren’t allowed with workers', 'Only the first worker counts'], answer: 1, explain: 'Each worker is a separate OS process with its own copy of module globals; the OS distributes connections between them. The limiter allows about 4× the intended rate. Shared limits need shared storage (Redis), or limiting at the gateway.' }
  ],
  interview: [
    { q: 'When do you use <code>async def</code> vs <code>def</code> for a path operation?', a: '<p><code>async def</code> when every slow thing inside is awaited: async DB drivers, <code>httpx.AsyncClient</code>, async LLM SDKs. It then runs on the event loop and handles thousands of concurrent waits cheaply. Plain <code>def</code> when you call blocking libraries: FastAPI runs it in a worker thread, so the loop stays free, but concurrency is capped by the threadpool (40 by default). Never put blocking I/O or long CPU work in <code>async def</code>. The same rule applies to dependencies.</p>', fu: 'How would you call a sync SDK from an otherwise async endpoint? (<code>await run_in_threadpool(sdk.call, ...)</code> or <code>asyncio.to_thread</code>.)', lvl: 'core' },
    { q: 'Explain FastAPI’s dependency injection compared with Spring’s.', a: '<p>Spring builds a container of singleton beans at startup and wires them into constructors by type. FastAPI resolves a <b>per-request</b> graph of functions from the signature: each <code>Depends(fn)</code> is called (once per request, cached), its own parameters are resolved recursively (including request data such as headers or query parameters), and <code>yield</code> dependencies get teardown after the request. App-lifetime singletons (clients, engines) live in the <code>lifespan</code> and are reached through <code>request.app.state</code> or a dependency. Tests swap any dependency with <code>app.dependency_overrides</code>.</p>', lvl: 'core' },
    { q: 'What happens, step by step, when a request hits a FastAPI app?', a: '<ol><li>Uvicorn parses HTTP on its event loop and calls the ASGI app with a <code>scope</code>.</li><li>Middleware wraps the call (CORS, GZip, request IDs, timing).</li><li>The router matches path and method, in declaration order.</li><li>FastAPI resolves dependencies and validates path, query, header, cookie and body parameters with Pydantic. On failure: 422.</li><li>It awaits the endpoint (<code>async def</code>) or runs it in the threadpool (<code>def</code>).</li><li>It validates and filters the return value through the response model and serialises JSON.</li><li>The response is sent; <code>yield</code> dependencies are cleaned up and background tasks run.</li></ol>', lvl: 'core' },
    { q: 'How do Pydantic v2 models behave at the boundary?', a: '<p>By default validation is <b>lax</b>: <code>"3"</code> becomes <code>3</code> for an <code>int</code> field, but <code>"three"</code> fails. <code>strict=True</code> (per field or model) disables coercion. Unknown fields are ignored unless <code>model_config = ConfigDict(extra="forbid")</code>. Constraints (<code>Field(gt=0, max_length=…)</code>), <code>@field_validator</code> and <code>@model_validator</code> add rules. The core is written in Rust (pydantic-core), so validation is fast. Use separate In and Out models so clients can’t set server-owned fields such as <code>id</code> or <code>role</code>. See <a href="dataclasses-pydantic.html">Dataclasses & Pydantic</a>.</p>', lvl: 'core' },
    { q: 'How do you manage resources such as DB engines and HTTP clients?', a: '<p>Create them once in the <code>lifespan</code> async context manager (it replaces the deprecated <code>@app.on_event</code>), attach them to <code>app.state</code>, and close them after the <code>yield</code>. Per-request resources (a session, a transaction) come from <code>yield</code> dependencies that use the shared engine. Never create pools per request, and never use module-import-time side effects that tests can’t control.</p>', lvl: 'core' },
    { q: 'How do you serve FastAPI in production?', a: '<p>Uvicorn is the ASGI server. Options: <code>fastapi run</code> / <code>uvicorn --workers N</code> (uvicorn supervises the processes), or gunicorn as the process manager with the Uvicorn worker class (<code>uvicorn_worker.UvicornWorker</code>; older code uses <code>uvicorn.workers.UvicornWorker</code>) for its timeouts and graceful restarts. In Kubernetes, many teams run <b>one worker per container</b> and scale replicas, so the orchestrator handles restarts and memory limits. Behind a proxy, enable <code>--proxy-headers</code> with <code>--forwarded-allow-ips</code> so client IPs and schemes are correct. Set graceful shutdown timeouts that match your longest requests.</p>', lvl: 'core' },
    { q: 'How many workers should you run?', a: '<p>Each worker is a process with its own event loop, using roughly one core when busy. For I/O-bound async services, start with about one worker per core (or one per container and scale out) and measure. Remember that memory multiplies with workers (models, caches), and so do connections: total DB connections = workers × pool size × replicas, which must fit Postgres’s <code>max_connections</code> or a PgBouncer.</p>', lvl: 'deep' },
    { q: 'How do you handle errors consistently?', a: '<p>Raise <code>HTTPException(status_code, detail)</code> for expected client errors. Map domain exceptions in one place with <code>@app.exception_handler(OrderNotFound)</code>, so business code doesn’t know about HTTP. Customise the 422 shape with a <code>RequestValidationError</code> handler if your API standard needs it (for example RFC 9457 problem details). Unexpected exceptions become 500s: log them once with the request ID, and never return stack traces. See <a href="errors-logging.html">Exceptions & logging</a>.</p>', lvl: 'core' },
    { q: 'What runs after the response is sent?', a: '<p><code>BackgroundTasks</code> run in the same worker after the response is sent; they are fine for small, best-effort jobs (sending an email), but they are lost if the process dies and they compete with requests. Anything that must happen, or that is slow, belongs in a durable queue. Teardown of <code>yield</code> dependencies also runs at the end of the request; exactly when, relative to sending the response, has changed between FastAPI versions, so don’t let background tasks depend on a session from a <code>yield</code> dependency.</p>', lvl: 'deep' },
    { q: 'How would you stream an LLM response to the client?', a: '<p>Return a <code>StreamingResponse</code> wrapping an async generator that yields chunks as they arrive from the model (or use Server-Sent Events with <code>media_type="text/event-stream"</code>). Use an async client so the loop is free while waiting for tokens. Handle client disconnects (<code>await request.is_disconnected()</code>, or catch cancellation) so you stop paying for tokens nobody reads, and disable proxy buffering for that route.</p>', lvl: 'deep' },
    { q: 'How do you test FastAPI apps?', a: '<p><code>TestClient(app)</code> (sync, built on httpx) for most tests, or <code>httpx.AsyncClient(transport=ASGITransport(app=app))</code> inside async tests. Override dependencies (<code>app.dependency_overrides[get_session] = ...</code>) to inject a transactional test session or fake clients, and clear them after. Use the TestClient as a context manager so the lifespan runs. See <a href="pytest.html">Testing with pytest</a>.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'main.py: lifespan, DI, models', lang: 'python', code: `from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .config import Settings, get_settings
from .models import Order

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    s = get_settings()
    app.state.engine = create_async_engine(s.db_url, pool_size=10, max_overflow=5)
    app.state.sessions = async_sessionmaker(app.state.engine, expire_on_commit=False)
    app.state.http = httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=2.0))
    yield
    await app.state.http.aclose()
    await app.state.engine.dispose()

app = FastAPI(title="orders", lifespan=lifespan)

async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    async with request.app.state.sessions() as session:
        yield session

SessionDep = Annotated[AsyncSession, Depends(get_session)]

class OrderIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sku: str = Field(min_length=1, max_length=40)
    quantity: int = Field(gt=0, le=100)

class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sku: str
    quantity: int
    status: str

@app.post("/orders", status_code=status.HTTP_201_CREATED)
async def create_order(body: OrderIn, session: SessionDep) -> OrderOut:
    order = Order(**body.model_dump(), status="new")
    session.add(order)
    await session.commit()
    return OrderOut.model_validate(order)

@app.get("/orders/{order_id}")
async def get_order(order_id: int, session: SessionDep) -> OrderOut:
    order = await session.get(Order, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "order not found")
    return OrderOut.model_validate(order)

@app.get("/healthz", include_in_schema=False)
async def healthz() -> dict[str, str]:
    return {"status": "ok"}           # liveness: no DB, no network`, note: 'Every slow call here is awaited. If a library you need is sync-only, make that endpoint a plain <code>def</code> (with a sync session) instead of mixing.' },
    { title: 'Serving', lang: 'bash', code: `# dev
fastapi dev app/main.py                      # auto-reload

# production, uvicorn supervising workers
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4 \\
  --proxy-headers --forwarded-allow-ips="10.0.0.0/8" \\
  --timeout-graceful-shutdown 20 --no-server-header

# production, gunicorn as process manager (pip install gunicorn uvicorn-worker)
gunicorn app.main:app -k uvicorn_worker.UvicornWorker -w 4 \\
  --bind 0.0.0.0:8000 --timeout 30 --graceful-timeout 20 --max-requests 2000 --max-requests-jitter 200

# Kubernetes: often 1 worker per pod, scale replicas instead
# CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]`, note: '<code>--max-requests</code> recycles workers periodically, a pragmatic guard against slow memory growth. Fix the leak too.' },
    { title: 'Sync endpoint done right', lang: 'python', code: `from fastapi.concurrency import run_in_threadpool

# Option 1: the whole endpoint is sync -> FastAPI runs it in the threadpool
@app.get("/legacy-report")
def legacy_report(session: SyncSessionDep) -> ReportOut:
    rows = session.execute(REPORT_SQL).all()          # blocking driver: fine here
    return ReportOut.from_rows(rows)

# Option 2: async endpoint, one blocking call offloaded explicitly
@app.post("/ocr")
async def ocr(file: UploadFile) -> OcrOut:
    data = await file.read()
    text = await run_in_threadpool(vendor_ocr.extract_text, data)   # sync SDK
    return OcrOut(text=text)

# Raise the shared thread limit at startup if you rely on sync code heavily
@asynccontextmanager
async def lifespan(app: FastAPI):
    anyio.to_thread.current_default_thread_limiter().total_tokens = 100
    yield` },
    { title: 'Java comparison (Spring Boot)', lang: 'java', code: `@RestController
@RequestMapping("/orders")
class OrderController {
    private final OrderService service;              // constructor DI, singleton bean
    OrderController(OrderService service) { this.service = service; }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    OrderOut create(@Valid @RequestBody OrderIn body) {   // Bean Validation -> 400
        return service.create(body);
    }
}
// FastAPI equivalents:
//   @RequestBody + @Valid         -> body: OrderIn (Pydantic), invalid -> 422
//   @PathVariable / @RequestParam -> typed function parameters
//   constructor injection (beans) -> Depends(...) resolved per request; singletons in lifespan
//   Tomcat thread per request     -> one event loop per worker; sync def -> 40-thread pool
//   spring.threads.virtual=true   -> closest Python analogue is async def + await
//   @ControllerAdvice             -> @app.exception_handler(...)`, note: 'Spring MVC blocks a thread per request, so blocking code is normal there. In FastAPI’s async endpoints, blocking code is the most expensive mistake you can make.' }
  ]
});

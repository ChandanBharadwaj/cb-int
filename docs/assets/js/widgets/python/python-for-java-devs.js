/* Python for Java developers: a step-through idiom map. Java on the left; the Python equivalent "translates in"
   line by line on the right, with a note on what actually changes. */
IA.widget('python-for-java-devs', (root, ctx) => {
  const { el, sleep, reduced } = ctx;
  if (!document.getElementById('w-pyjv-style')) {
    document.head.append(el('style', { id: 'w-pyjv-style', text: `
.w-pyjv .pair{display:grid;grid-template-columns:minmax(0,1fr) 34px minmax(0,1fr);gap:8px;align-items:stretch}
@media (max-width:720px){.w-pyjv .pair{grid-template-columns:1fr}.w-pyjv .arrow{transform:rotate(90deg);height:26px}}
.w-pyjv .side{border:1px solid var(--border);border-radius:10px;background:var(--surface-2);overflow:hidden;display:flex;flex-direction:column}
.w-pyjv .side .hd{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);padding:6px 12px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between}
.w-pyjv .side pre{margin:0;padding:8px 12px;font-family:var(--mono);font-size:12.5px;line-height:1.55;overflow-x:auto;flex:1}
.w-pyjv .side.py{border-color:color-mix(in srgb,var(--accent) 55%,var(--border))}
.w-pyjv .ln{display:block;white-space:pre;transition:opacity .35s,transform .35s}
.w-pyjv .ln.hide{opacity:0;transform:translateX(-8px)}
.w-pyjv .arrow{display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--accent)}
.w-pyjv .ttl{font-weight:700;margin:4px 0 8px;font-size:15px}
.w-pyjv .note{margin-top:10px;font-size:14px;color:var(--text-2)}
.w-pyjv .dots{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}
.w-pyjv .dots button{width:12px;height:12px;border-radius:50%;border:1px solid var(--border);background:var(--surface-2);padding:0;cursor:pointer}
.w-pyjv .dots button.on{background:var(--accent);border-color:var(--accent)}
` }));
  }
  const P = [
    // ---------- everyday ----------
    { c: 'Everyday', t: 'POJO / record → dataclass', j: `public record Money(long amount, String currency) {}
// or a class with fields, constructor,
// getters, equals(), hashCode(), toString()`, p: `from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class Money:
    amount: int
    currency: str = "EUR"`, n: '<code>@dataclass</code> writes <code>__init__</code>, <code>__repr__</code> and <code>__eq__</code>; <code>frozen=True</code> adds immutability and <code>__hash__</code>. No getters: read <code>m.amount</code> directly.' },
    { c: 'Everyday', t: 'Index loops → iteration', j: `for (int i = 0; i < names.size(); i++) {
    System.out.println(i + " " + names.get(i));
}
for (int i = 0; i < a.size(); i++) pairs.add(a.get(i) + b.get(i));`, p: `for i, name in enumerate(names):
    print(i, name)

pairs = [x + y for x, y in zip(a, b)]`, n: 'Iterate over things, not indexes. <code>enumerate</code> gives the index when you need it; <code>zip</code> walks several sequences together (3.10+: <code>zip(a, b, strict=True)</code> raises if lengths differ).' },
    { c: 'Everyday', t: 'Streams → comprehensions', j: `Map<String, Long> totals = orders.stream()
    .filter(o -> o.paid())
    .collect(groupingBy(Order::customer,
             summingLong(Order::amount)));`, p: `totals: dict[str, int] = defaultdict(int)
for o in orders:
    if o.paid:
        totals[o.customer] += o.amount

big = [o.id for o in orders if o.amount > 100]`, n: 'Comprehensions cover filter/map/collect for lists, sets and dicts. For grouping, a plain loop with <code>defaultdict</code> is clearer than <code>itertools.groupby</code>, which only groups <i>adjacent</i> items.' },
    { c: 'Everyday', t: 'null / Optional → None', j: `Optional<User> u = repo.find(id);
String city = u.map(User::address)
               .map(Address::city)
               .orElse("unknown");`, p: `user = repo.find(id)            # User | None
city = user.address.city if user and user.address else "unknown"

if (u := repo.find(id)) is not None:
    greet(u)`, n: 'Return <code>None</code> and annotate <code>-&gt; User | None</code>; the type checker forces callers to handle it. Compare with <code>is None</code>. There is no <code>?.</code> operator.' },
    // ---------- types ----------
    { c: 'Types & interfaces', t: 'interface → Protocol', j: `public interface Notifier {
    void send(String to, String text);
}
public class EmailNotifier implements Notifier { ... }`, p: `class Notifier(Protocol):
    def send(self, to: str, text: str) -> None: ...

class EmailNotifier:          # no "implements"
    def send(self, to: str, text: str) -> None: ...`, n: 'Structural typing: any class with a matching <code>send</code> fits, and mypy/pyright check it statically. Use <code>abc.ABC</code> when you want nominal inheritance, shared code, or runtime enforcement of abstract methods.' },
    { c: 'Types & interfaces', t: 'Generics', j: `public static <T extends Comparable<T>> T max(List<T> xs) { ... }
Map<String, List<Integer>> index = new HashMap<>();`, p: `def biggest[T: (int, float)](xs: list[T]) -> T:   # 3.12 syntax
    return max(xs)

index: dict[str, list[int]] = {}`, n: 'Hints are not enforced at runtime and there is no type erasure debate: they are metadata for tools. 3.12 adds inline type parameters (PEP 695); before that, use <code>TypeVar</code>.' },
    { c: 'Types & interfaces', t: 'Overloads → defaults & keywords', j: `Conn connect(String host) { return connect(host, 5432); }
Conn connect(String host, int port) { return connect(host, port, true); }
Conn connect(String host, int port, boolean ssl) { ... }`, p: `def connect(host: str, port: int = 5432, *, ssl: bool = True,
            timeout: float = 5.0) -> Conn:
    ...

connect("db", ssl=False)`, n: 'A second <code>def</code> with the same name replaces the first. Defaults and keyword-only arguments (after <code>*</code>) replace overload chains; <code>@classmethod</code> gives named alternate constructors.' },
    { c: 'Types & interfaces', t: 'enum', j: `public enum Status { NEW, PAID, SHIPPED }
Status s = Status.valueOf("PAID");`, p: `from enum import StrEnum

class Status(StrEnum):          # 3.11+
    NEW = "new"
    PAID = "paid"

s = Status("paid")              # lookup by value
assert s == "paid"              # StrEnum members are str`, n: '<code>Enum</code> members are singletons, compared with <code>is</code> or <code>==</code>. <code>StrEnum</code> and <code>IntEnum</code> also behave like their base type, which is handy for JSON and databases.' },
    // ---------- errors ----------
    { c: 'Errors', t: 'Checked exceptions → none', j: `public Config load(Path p) throws IOException, ConfigException {
    ...
}`, p: `def load(path: Path) -> Config:
    """Raises ConfigError if the file is missing or invalid."""
    ...`, n: 'Nothing forces callers to handle or declare exceptions. Document the important ones, keep a small domain hierarchy, and handle errors at a few boundaries.' },
    { c: 'Errors', t: 'Wrapping a cause', j: `try {
    return mapper.readValue(text, Config.class);
} catch (JsonProcessingException e) {
    throw new ConfigException("bad config", e);
}`, p: `try:
    return Config.model_validate_json(text)
except ValidationError as e:
    raise ConfigError("bad config") from e`, n: '<code>from e</code> sets <code>__cause__</code>, like the <code>cause</code> constructor argument. The traceback prints both, joined by “The above exception was the direct cause…”.' },
    { c: 'Errors', t: 'try-with-resources → with', j: `try (var conn = ds.getConnection();
     var st = conn.prepareStatement(sql)) {
    ...
}`, p: `with pool.connection() as conn, conn.cursor() as cur:
    cur.execute(sql)`, n: 'Any object with <code>__enter__</code>/<code>__exit__</code> works, and <code>contextlib.contextmanager</code> turns a generator into one. See <a href="context-managers.html">Context managers</a>.' },
    { c: 'Errors', t: 'catch (Exception e)', j: `catch (Exception e) {      // also catches InterruptedException
    log.error("failed", e);
}`, p: `except Exception:          # NOT KeyboardInterrupt, SystemExit, CancelledError
    log.exception("failed")  # ERROR + traceback`, n: '<code>except Exception</code> deliberately skips <code>BaseException</code>-only types, so Ctrl-C, <code>sys.exit()</code> and asyncio cancellation keep working. <code>log.exception</code> is the <code>log.error(msg, e)</code> equivalent.' },
    // ---------- concurrency ----------
    { c: 'Concurrency', t: 'Thread pool for CPU work', j: `ExecutorService ex = Executors.newFixedThreadPool(cores);
List<Future<Score>> fs = docs.stream()
    .map(d -> ex.submit(() -> score(d))).toList();`, p: `from concurrent.futures import ProcessPoolExecutor

with ProcessPoolExecutor() as ex:       # processes, not threads
    scores = list(ex.map(score, docs, chunksize=64))`, n: 'The GIL lets one thread run Python bytecode at a time (default build), so CPU-bound work needs processes. Threads remain right for blocking I/O. See <a href="gil.html">The GIL</a>.' },
    { c: 'Concurrency', t: 'CompletableFuture → asyncio', j: `var a = CompletableFuture.supplyAsync(() -> search(q));
var b = CompletableFuture.supplyAsync(() -> weather(city));
CompletableFuture.allOf(a, b).join();`, p: `async with asyncio.TaskGroup() as tg:        # 3.11+
    a = tg.create_task(search(q))
    b = tg.create_task(weather(city))
print(a.result(), b.result())`, n: 'One thread, many concurrent waits, with explicit <code>await</code> points. Closest to virtual threads, except a blocking call inside a coroutine stalls everything. See <a href="asyncio.html">asyncio</a>.' },
    { c: 'Concurrency', t: 'synchronized / AtomicInteger', j: `private final AtomicInteger hits = new AtomicInteger();
hits.incrementAndGet();
synchronized (lock) { balance += amount; }`, p: `lock = threading.Lock()
with lock:
    hits += 1          # += is NOT atomic, even with the GIL
    balance += amount`, n: 'The GIL protects the interpreter’s internals, not your invariants: <code>x += 1</code> is several bytecodes and threads can interleave between them. Use a <code>Lock</code> or <code>queue.Queue</code>.' },
    { c: 'Concurrency', t: 'ThreadLocal / MDC → contextvars', j: `MDC.put("requestId", id);
private static final ThreadLocal<User> CURRENT = new ThreadLocal<>();`, p: `request_id: ContextVar[str] = ContextVar("request_id", default="-")
token = request_id.set(rid)
try:
    ...
finally:
    request_id.reset(token)`, n: '<code>contextvars</code> follow asyncio tasks as well as threads; a thread-local would leak between coroutines sharing one thread.' },
    // ---------- build ----------
    { c: 'Build & run', t: 'Maven → pyproject + uv', j: `<dependency>
  <groupId>com.fasterxml.jackson.core</groupId>
  <artifactId>jackson-databind</artifactId>
  <version>2.17.1</version>
</dependency>
mvn test`, p: `# pyproject.toml
[project]
dependencies = ["pydantic>=2.7,<3"]

uv lock && uv sync --locked
uv run pytest`, n: 'Ranges in <code>pyproject.toml</code>, exact versions in a committed lockfile, one virtual environment per project instead of a classpath. See <a href="packaging.html">Packaging</a>.' },
    { c: 'Build & run', t: 'main()', j: `public class Main {
    public static void main(String[] args) { ... }
}`, p: `def main() -> None:
    ...

if __name__ == "__main__":     # only when run as a script
    main()

# pyproject: [project.scripts] orders = "orders.cli:main"`, n: 'Importing a module runs its top-level code, so guard script behaviour with <code>__name__ == "__main__"</code>. Console entry points generate an executable in the venv’s <code>bin/</code>.' },
    { c: 'Build & run', t: 'Spring DI → explicit wiring', j: `@Service
class OrderService {
    OrderService(OrderRepository repo, Clock clock) { ... }
}`, p: `class OrderService:
    def __init__(self, repo: OrderRepository, clock: Callable[[], datetime]):
        self.repo, self.clock = repo, clock

service = OrderService(PgOrderRepository(engine), datetime.now)   # composition root`, n: 'Constructor injection stays; the container goes. Wire the graph in one place (the app factory). FastAPI’s <code>Depends</code> and pytest fixtures cover per-request and per-test wiring.' },
    { c: 'Build & run', t: 'Checkstyle, SpotBugs, javac → ruff, mypy', j: `mvn compile         # type errors stop the build
mvn checkstyle:check spotbugs:check`, p: `ruff check . && ruff format --check .
mypy --strict src/          # or: pyright
pytest -q`, n: 'Python has no compile step that checks types. Put a type checker and a linter in CI, or type errors only show up at runtime.' }
  ];
  const CATS = ['All', ...new Set(P.map((x) => x.c))];
  let cat = 'All', k = 0, gen = 0, running = false;
  const list = () => P.filter((x) => cat === 'All' || x.c === cat);
  const segC = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Category' });
  CATS.forEach((c) => { const b = el('button', { text: c, class: c === cat ? 'on' : '' }); b.addEventListener('click', () => { cat = c; [...segC.children].forEach((x) => x.classList.toggle('on', x === b)); reset(); }); segC.append(b); });
  const bPlay = el('button', { class: 'btn primary', text: '▶ Play' });
  const bStep = el('button', { class: 'btn', text: 'Step ›' });
  const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const ttl = el('div', { class: 'ttl' });
  const jPre = el('pre'); const pPre = el('pre');
  const jHd = el('div', { class: 'hd' }); const pHd = el('div', { class: 'hd' });
  const pair = el('div', { class: 'pair' }, el('div', { class: 'side' }, jHd, jPre), el('div', { class: 'arrow', text: '→' }), el('div', { class: 'side py' }, pHd, pPre));
  const note = el('div', { class: 'note' });
  const dots = el('div', { class: 'dots', 'aria-label': 'Pairs' });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' });
  root.classList.add('w-pyjv');
  root.append(el('div', { class: 'w-controls' }, segC), dots, ttl, pair, note, el('div', { class: 'w-controls', style: { marginTop: '10px' } }, bPlay, bStep, bReset), narr);

  let anim = 0;
  async function show(animate) {
    const L = list(); const cur = k ? L[k - 1] : null; const a = ++anim;
    dots.innerHTML = '';
    L.forEach((x, i) => { const b = el('button', { class: i === k - 1 ? 'on' : '', title: x.t, 'aria-label': x.t }); b.addEventListener('click', () => { stop(); k = i + 1; show(true); }); dots.append(b); });
    if (!cur) {
      ttl.textContent = `${L.length} idioms${cat === 'All' ? '' : ' in “' + cat + '”'}`;
      jHd.innerHTML = '<span>Java</span>'; pHd.innerHTML = '<span>Python</span>';
      jPre.innerHTML = ''; pPre.innerHTML = '';
      note.innerHTML = '';
      narr.innerHTML = ''; narr.append(el('div', { class: 'n', text: `0/${L.length}` }), el('div', { class: 't', html: 'Press <b>Play</b> or <b>Step</b>, or click a dot to jump to a pair.' }));
      bStep.disabled = false; return;
    }
    ttl.textContent = cur.t;
    jHd.innerHTML = `<span>Java</span><span>${ctx.esc(cur.c)}</span>`; pHd.innerHTML = '<span>Python 3.12+</span><span>idiomatic</span>';
    jPre.innerHTML = IA.highlight(cur.j, 'java');
    const lines = cur.p.split('\n');
    pPre.innerHTML = '';
    const spans = lines.map((ln) => { const s = el('span', { class: 'ln' + (animate && !reduced ? ' hide' : ''), html: ln ? IA.highlight(ln, ln.trim().startsWith('[') || ln.startsWith('uv ') ? 'text' : 'python') : '&nbsp;' }); pPre.append(s); return s; });
    note.innerHTML = '';
    narr.innerHTML = ''; narr.append(el('div', { class: 'n', text: `${k}/${L.length}` }), el('div', { class: 't', html: cur.n }));
    bStep.disabled = k >= L.length;
    if (animate && !reduced) {
      await sleep(250);
      for (const s of spans) { if (a !== anim) return; s.classList.remove('hide'); await sleep(140); }
    }
  }
  const stop = () => { running = false; bPlay.textContent = '▶ Play'; };
  function reset() { gen++; stop(); k = 0; show(false); }
  function step() { const L = list(); if (k >= L.length) return false; k++; show(true); return k < L.length; }
  bStep.addEventListener('click', () => { stop(); step(); });
  bReset.addEventListener('click', reset);
  bPlay.addEventListener('click', async () => {
    if (running) { stop(); return; }
    if (k >= list().length) { k = 0; }
    running = true; bPlay.textContent = '⏸ Pause'; const g = ++gen;
    while (running && g === gen) { if (!step()) break; await sleep(reduced ? 1200 : 4200); }
    if (g === gen) stop();
  });
  reset();
});

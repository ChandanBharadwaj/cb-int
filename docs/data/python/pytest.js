IA.register({
  track: 'python',
  slug: 'pytest',
  title: 'Testing with pytest',
  tagline: 'pytest is plain <code>assert</code> plus <b>dependency injection by argument name</b>. A test asks for <code>tx</code>, pytest builds <code>engine → schema → tx</code>, caches each one for its <b>scope</b>, and runs the code after each <code>yield</code> in reverse order. Get scopes and patch targets right and the rest is detail.',
  tldr: {
    problem: 'Slow suites (a fresh database per test), flaky suites (state leaking through a wide-scoped fixture or a global), and green suites that test nothing (a mock patched in the wrong module, or a <code>MagicMock</code> that accepts any typo).',
    model: 'A fixture is a generator: code before <code>yield</code> is setup, the yielded value is injected, code after is teardown. pytest keeps one instance per scope key (session, package, module, class, or each test) and tears instances down LIFO when that scope ends. <code>parametrize</code> multiplies test items; <code>monkeypatch</code> and <code>mock.patch</code> swap a <b>name</b> in a namespace and restore it afterwards.',
    hook: '“My mock isn’t being used.” You patched where the function is <i>defined</i> (<code>requests.get</code>), but the code under test did <code>from requests import get</code>, so it looks the name up in <i>its own</i> module. Patch <code>myapp.client.get</code>.',
    facts: [
      { v: '5 scopes', l: '<code>function</code> (default), <code>class</code>, <code>module</code>, <code>package</code>, <code>session</code>. A fixture may only request fixtures of the same or a wider scope' },
      { v: '--setup-show', l: 'prints every SETUP and TEARDOWN with its scope letter (S, P, M, C, F), the fastest way to see what a test really builds' },
      { v: 'LIFO', l: 'teardown order: the last fixture set up is the first torn down, like nested <code>with</code> blocks or an <code>ExitStack</code>' }
    ]
  },
  intro: {
    what: 'A <b>test</b> is a function whose name starts with <code>test_</code> and that uses plain <code>assert</code>. pytest finds and runs them, and when an assert fails it shows the values involved. Tests often need things prepared first, such as a database connection or a temporary folder. pytest calls these <b>fixtures</b>: you write a function that prepares the thing, and any test that names it as a parameter receives it.',
    analogy: { icon: '🍽️', title: 'A restaurant kitchen', text: 'The oven is switched on once per evening (session scope), each table gets a fresh tablecloth (module), and each dish gets clean plates (function). A cook only asks for “plates”; the kitchen knows plates need a table, and a table needs the room to be open. At closing time everything is put away in reverse order: plates, then tablecloths, then the oven.' },
    steps: [
      { t: 'A test is a function with asserts', d: 'No classes or <code>assertEquals</code> needed.', code: 'def test_total():\n    assert total([2, 3]) == 5' },
      { t: 'A fixture prepares something', d: 'Code before <code>yield</code> sets up; code after cleans up.', code: '@pytest.fixture\ndef user_file(tmp_path):\n    p = tmp_path / "users.csv"\n    p.write_text("id,name\\n1,asha\\n")\n    yield p\n    # cleanup would go here' },
      { t: 'Ask for it by name', d: 'pytest sees the parameter name and injects the fixture’s value.', code: 'def test_load(user_file):\n    assert load(user_file)[0].name == "asha"' },
      { t: 'Run many cases with parametrize', d: 'One test function, several inputs; each runs and reports separately.', code: '@pytest.mark.parametrize("raw, ok", [("a@x.io", True), ("nope", False)])\ndef test_email(raw, ok):\n    assert is_email(raw) is ok' },
      { t: 'Replace what you can’t run', d: '<code>monkeypatch</code> swaps an attribute or environment variable for one test and restores it afterwards.', code: 'def test_mode(monkeypatch):\n    monkeypatch.setenv("APP_MODE", "test")\n    assert settings().mode == "test"' }
    ],
    terms: [
      ['fixture', 'A function decorated with <code>@pytest.fixture</code> that provides a value (and optional cleanup) to tests that name it.'],
      ['scope', 'How long one fixture instance lives: per test (default), class, module, package or the whole session.'],
      ['conftest.py', 'A file whose fixtures are visible to every test in its directory and below. No import needed.'],
      ['parametrize', '<code>@pytest.mark.parametrize</code>: generates one test item per set of arguments.'],
      ['mock / patch', '<code>unittest.mock</code> objects record calls and return canned values; <code>patch</code> temporarily replaces a name with one.'],
      ['coverage', 'Which lines (and branches) ran during the tests: <code>pytest --cov</code> via the pytest-cov plugin.']
    ]
  },
  visual: {
    title: 'Fixture setup and teardown, by scope',
    caption: 'Five test items in two files. Pick the scope of the <code>schema</code> fixture, then press <b>Play</b> or <b>Step</b>. The lanes show which fixture instances are alive; the log is what <code>pytest --setup-show</code> prints. Watch the counters: a wider scope means fewer setups, but more state shared between tests.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'Fixtures = generators', code: `from contextlib import ExitStack, contextmanager

@contextmanager
def fixture(name, scope):
    print(f"SETUP    {scope} {name}")
    yield name
    print(f"TEARDOWN {scope} {name}")

# what pytest does for:  def test_create(tx)   where tx needs schema, schema needs engine
with ExitStack() as session:
    session.enter_context(fixture("engine", "S"))
    for module in ["test_orders.py", "test_users.py"]:
        with ExitStack() as mod:
            mod.enter_context(fixture("schema", "M"))
            for test in ["test_a", "test_b"]:
                with fixture("tx", "F"):
                    print(f"    run {module}::{test}")`, note: 'Each scope is a nested <code>ExitStack</code>: closing one runs teardowns in reverse order. pytest implements the same idea with finalizers on each collection node.' },
      { label: 'Patch where it’s looked up', code: `import sys, types
from unittest.mock import patch

# a fake third-party module
payments = types.ModuleType("payments")
payments.charge = lambda amount: f"REAL charge {amount}"
sys.modules["payments"] = payments

# "our" module, using both import styles
SHOP_SRC = '''
import payments as pay_mod
from payments import charge

def checkout_a(amount): return pay_mod.charge(amount)   # looks up payments.charge at call time
def checkout_b(amount): return charge(amount)           # uses the name bound in shop
'''
shop = types.ModuleType("shop")
sys.modules["shop"] = shop
exec(SHOP_SRC, shop.__dict__)

with patch("payments.charge", return_value="FAKE"):
    print("patch payments.charge ->", shop.checkout_a(10), "|", shop.checkout_b(10))

with patch("shop.charge", return_value="FAKE"):
    print("patch shop.charge     ->", shop.checkout_a(10), "|", shop.checkout_b(10))`, note: '<code>patch</code> replaces one <b>name in one namespace</b>. <code>from x import y</code> copies the reference, so you must patch it in the importing module.' },
      { label: 'Mocks: record, assert, side_effect', code: `from unittest.mock import Mock, call, create_autospec

notify = Mock(return_value=True)
notify("ops", text="disk full")
notify("dev", text="deploy done")
print("calls:", notify.call_args_list)
notify.assert_any_call("ops", text="disk full")
print("last call:", notify.call_args)

fetch = Mock(side_effect=[{"id": 1}, TimeoutError("slow upstream")])
print(fetch())
try:
    fetch()
except TimeoutError as e:
    print("raised:", e, "| call_count =", fetch.call_count)

def charge(amount: int, currency: str) -> str: ...
strict = create_autospec(charge, return_value="ok")
print(strict(10, "EUR"))
try:
    strict(10)                       # wrong signature: caught by autospec
except TypeError as e:
    print("autospec:", e)`, note: 'A plain <code>Mock</code> would accept <code>strict(10)</code> silently. <code>autospec</code> copies the real signature.' },
      { label: 'monkeypatch-style env & attributes', code: `import os
from unittest.mock import patch

class Settings:
    timeout = 5

def effective():
    return os.environ.get("APP_MODE", "prod"), Settings.timeout

print("before:", effective())
with patch.dict(os.environ, {"APP_MODE": "test"}), patch.object(Settings, "timeout", 0.1):
    print("inside:", effective())
print("after: ", effective())          # restored, even if the block had raised

# pytest equivalent:
#   def test_x(monkeypatch):
#       monkeypatch.setenv("APP_MODE", "test")
#       monkeypatch.setattr(Settings, "timeout", 0.1)` },
      { label: 'parametrize = a grid of items', code: `import itertools

emails = [("a@x.io", True), ("no-at-sign", False)]
backends = ["sqlite", "postgres"]

# @pytest.mark.parametrize("raw, ok", emails)
# @pytest.mark.parametrize("backend", backends)
# def test_signup(backend, raw, ok): ...
items = []
for backend, (raw, ok) in itertools.product(backends, emails):
    items.append(f"test_signup[{raw}-{ok}-{backend}]")
print(len(items), "test items:")
for i in items:
    print("  ", i)`, note: 'Stacked <code>parametrize</code> decorators multiply. The ids here imitate pytest’s style; use <code>pytest.param(..., id="...")</code> for readable ones.' },
      { label: 'How coverage works', code: `import sys

def classify(n):
    if n < 0:
        return "negative"
    if n == 0:
        return "zero"
    return "positive"

executed = set()
def tracer(frame, event, arg):
    if frame.f_code is classify.__code__ and event == "line":
        executed.add(frame.f_lineno)
    return tracer

sys.settrace(tracer)
classify(5)          # the only "test"
sys.settrace(None)

first = classify.__code__.co_firstlineno
body = range(first + 1, first + 6)
missed = [ln for ln in body if ln not in executed]
print(f"lines run: {sorted(executed)}")
print(f"missed   : {missed}   -> coverage {len(executed)}/{len(body)}")`, note: 'coverage.py does this in C (and, on 3.12+, can use the lower-overhead <code>sys.monitoring</code> API). Branch coverage also records which jumps were taken.' }
    ]
  },
  gotchas: [
    { trap: 'Patching where it is defined, not where it is used', code: `# app/billing.py
from stripe_client import charge
def checkout(cart): return charge(cart.total)

# test
with patch("stripe_client.charge"):   # app.billing.charge is still the real one
    checkout(cart)`, why: '<code>from x import y</code> copies the reference into the importing module at import time. <code>patch</code> replaces one attribute on one object, so the copy is untouched.', fix: 'Patch the name the code under test looks up: <code>patch("app.billing.charge")</code>. Or import the module (<code>import stripe_client</code>) and call <code>stripe_client.charge</code>, which makes either target work.' },
    { trap: 'A <code>MagicMock</code> accepts anything', code: `resp = MagicMock()
data = resp.json["id"]       # bug: forgot (). MagicMock happily returns another mock
client.post("/x", jsonn={})  # typo: also accepted`, why: 'Mocks invent attributes on access and <code>MagicMock</code> supports almost every operator, so wrong calls, typos and API drift pass the test and fail in production.', fix: 'Use <code>create_autospec(RealClass, instance=True)</code> or <code>patch(..., autospec=True)</code>, which copies the real signatures. Better still, use a fake at the boundary: <code>httpx.MockTransport</code>, respx, or a real Postgres in a container.' },
    { trap: 'Wide-scoped fixtures that tests mutate', code: `@pytest.fixture(scope="module")
def cart():
    return Cart()

def test_add(cart):   cart.add("apple"); assert len(cart) == 1
def test_empty(cart): assert len(cart) == 0    # fails, but only after test_add`, why: 'One instance is shared by every test in the scope. Tests become order-dependent and pass alone but fail in the full run (or under <code>pytest-xdist</code> and <code>pytest-randomly</code>).', fix: 'Keep mutable things function-scoped. Share only expensive, immutable resources (an engine, a container) at wide scope, and give each test isolation inside it: a transaction rolled back in teardown.' },
    { trap: 'ScopeMismatch: a session fixture asking for a function fixture', code: `@pytest.fixture(scope="session")
def app(monkeypatch):           # monkeypatch is function-scoped
    monkeypatch.setenv("MODE", "test")
# ScopeMismatch: You tried to access the function scoped fixture monkeypatch
# with a session scoped request object`, why: 'A longer-lived fixture cannot hold on to something that is destroyed after every test.', fix: 'Request only same-or-wider scopes. For session-wide patches use <code>with pytest.MonkeyPatch.context() as mp:</code> inside the session fixture, or <code>tmp_path_factory</code> instead of <code>tmp_path</code>.' },
    { trap: 'Teardown that never runs', code: `@pytest.fixture
def server():
    proc = start_server()
    wait_until_ready(proc)   # raises: the code after yield never runs
    yield proc
    proc.terminate()`, why: 'Teardown after <code>yield</code> runs only if setup reached the <code>yield</code>. If setup raises halfway, resources created before the error leak (a stray process, a container, a temp DB).', fix: 'Wrap setup steps in <code>try/finally</code>, or register cleanup as soon as the resource exists with <code>request.addfinalizer(proc.terminate)</code>, or use an <code>ExitStack</code> inside the fixture.' },
    { trap: '100% line coverage, no real test', code: `def test_discount():
    apply_discount(order, code="SPRING")   # no assert at all
# coverage: 100% of apply_discount`, why: 'Coverage measures what <i>ran</i>, not what was <i>checked</i>. Line coverage also misses untaken branches: an <code>if</code> without <code>else</code> counts as covered when only its true path ran.', fix: 'Turn on branch coverage (<code>--cov-branch</code>), gate on a realistic threshold (<code>--cov-fail-under</code>), review missing branches in the report, and treat coverage as a map of untested code rather than a quality score.' },
    { trap: '<code>async def</code> tests without a plugin', why: 'pytest itself does not run coroutines. Without pytest-asyncio or the anyio plugin, an <code>async def test_…</code> is not awaited: depending on the pytest version it is skipped with a warning or fails, and the body never executes.', fix: 'Install <code>pytest-asyncio</code> (set <code>asyncio_mode = "auto"</code>) or use AnyIO’s <code>@pytest.mark.anyio</code>. FastAPI apps can also be tested synchronously with <code>TestClient</code>.' }
  ],
  scenarios: [
    { title: 'Green locally, red in CI: “expected 0 rows, got 3”',
      symptom: 'Each test file passed when run alone. The full suite failed in CI on a few repository tests, and which ones changed when someone added <code>pytest-randomly</code>.',
      diagnose: `pytest -p no:randomly tests/              # passes (file order)
pytest -x                                 # fails; pytest-randomly prints "Using --randomly-seed=…"
pytest -x -p randomly --randomly-seed=1234   # reproduce that exact order
pytest --setup-show tests/test_repo.py | grep -E "SETUP|TEARDOWN"
#   SETUP    M db            <- one DB per module, shared by every test`,
      lang: 'bash',
      cause: 'The <code>db</code> fixture was module-scoped and tests committed rows into it. Each test’s result depended on which tests ran before it in the same module.',
      fix: 'Keep the expensive part wide (a session-scoped engine and schema), and wrap every test in a transaction that is rolled back in teardown. Tests then see an empty database regardless of order.',
      fixCode: `@pytest.fixture(scope="session")
def engine():
    eng = create_engine(TEST_DB_URL)
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()

@pytest.fixture
def session(engine):
    conn = engine.connect()
    trans = conn.begin()
    s = Session(bind=conn, join_transaction_mode="create_savepoint")
    yield s
    s.close()
    trans.rollback()          # nothing a test wrote survives
    conn.close()` },
    { title: 'All tests green, prod: <code>\'method\' object is not subscriptable</code>',
      symptom: 'A new payments client shipped with 100% coverage. The first real request failed in the code that reads the provider’s response.',
      diagnose: `# the test
with patch("app.payments.httpx.post") as post:
    post.return_value = MagicMock()
    assert create_payment(100)["status"]      # passes

# the code
resp = httpx.post(url, json=body)
return resp.json["status"]        # json, not json()`,
      cause: '<code>MagicMock</code> supports <code>__getitem__</code>, so <code>resp.json["status"]</code> returned another mock, which is truthy. The test checked that the mock behaved like a mock.',
      fix: 'Mock at the transport boundary with real response objects, so the code under test runs against the real <code>httpx.Response</code> API.',
      fixCode: `def handler(request: httpx.Request) -> httpx.Response:
    assert request.url.path == "/v1/payments"
    return httpx.Response(201, json={"status": "pending"})

def test_create_payment():
    client = httpx.Client(transport=httpx.MockTransport(handler), base_url="https://psp.test")
    assert create_payment(100, client=client)["status"] == "pending"` },
    { title: 'The suite takes 38 minutes',
      symptom: 'CI time grew linearly with the number of tests. <code>pytest --durations=10</code> showed most of the time in setup, not in test bodies.',
      diagnose: `pytest --durations=10 --setup-show -q | grep SETUP | sort | uniq -c | sort -rn | head
#   1840  SETUP    F postgres_container
#   1840  SETUP    F migrated_schema`,
      lang: 'bash',
      cause: 'A Postgres container and the full Alembic migration ran for every single test, because both fixtures used the default function scope.',
      fix: 'Session-scope the container and migrations; isolate tests with per-test transactions. Then parallelise with <code>pytest-xdist</code>, giving each worker its own database.',
      fixCode: `@pytest.fixture(scope="session")
def pg_url(worker_id, tmp_path_factory):        # worker_id comes from pytest-xdist
    with PostgresContainer("postgres:16") as pg:
        url = pg.get_connection_url()
        run_migrations(url, schema=f"test_{worker_id}")
        yield url

# pytest -n auto  -> ~4 minutes on 8 cores` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `import sys, types
from unittest.mock import patch

clock = types.ModuleType("clock")
clock.now = lambda: "real"
sys.modules["clock"] = clock

from clock import now

def stamp():
    return now()

with patch("clock.now", return_value="fake"):
    print(stamp(), clock.now())
with patch("__main__.now", return_value="fake"):
    print(stamp())`, options: ['fake fake<br>fake', 'real fake<br>fake', 'real fake<br>real', 'real real<br>fake'], answer: 1, run: true, expect: 'real fake\nfake', explain: '<code>from clock import now</code> bound the original function to the name <code>now</code> in <code>__main__</code>. Patching <code>clock.now</code> changes only the attribute on the <code>clock</code> module. Patch the namespace the code reads from (<code>__main__.now</code>, or <code>myapp.module.now</code> in a real project).' },
    { kind: 'predict', q: 'What does this print?', code: `from unittest.mock import Mock

fetch = Mock(side_effect=[{"id": 1}, TimeoutError("slow"), {"id": 3}])
for _ in range(3):
    try:
        print(fetch())
    except TimeoutError as e:
        print("timeout:", e)
print(fetch.call_count)`, options: ["{'id': 1}<br>timeout: slow<br>{'id': 3}<br>3", "{'id': 1}<br>timeout: slow<br>{'id': 3}<br>2", "[{'id': 1}, TimeoutError('slow'), {'id': 3}] ×3<br>3", "{'id': 1}<br>timeout: slow<br>StopIteration"], answer: 0, run: true, expect: "{'id': 1}\ntimeout: slow\n{'id': 3}\n3", explain: 'An iterable <code>side_effect</code> yields one item per call; an item that is an exception instance is <b>raised</b> instead of returned. The call is recorded before the side effect runs, so the failed call still counts: 3. A fourth call would raise <code>StopIteration</code>.' },
    { kind: 'bug', q: 'The code forgot the <code>()</code> after <code>json</code>. What does this print?', code: `from unittest.mock import MagicMock, Mock

resp = MagicMock()
print(resp.json["id"] is not None)

try:
    Mock().json["id"]
except TypeError:
    print("Mock: not subscriptable")`, options: ['True<br>Mock: not subscriptable', 'TypeError (both)', 'False<br>Mock: not subscriptable', 'True<br>True'], answer: 0, run: true, expect: 'True\nMock: not subscriptable', explain: '<code>MagicMock</code> pre-configures magic methods, including <code>__getitem__</code>, so the bug passes silently. Plain <code>Mock</code> has no magic methods and fails. Best: <code>create_autospec(httpx.Response, instance=True)</code> or a real response object, so the code meets the real API.' },
    { kind: 'predict', q: 'What does this print?', code: `from unittest.mock import MagicMock

m = MagicMock()
print(len(m), bool(m), list(m), int(m))`, options: ['0 True [] 1', '0 False [] 0', 'TypeError', '1 True [] 1'], answer: 0, run: true, expect: '0 True [] 1', explain: 'MagicMock’s documented defaults: <code>__len__</code> → 0, <code>__bool__</code> → True, <code>__iter__</code> → <code>iter([])</code>, <code>__int__</code> → 1. Notice that <code>bool(m)</code> is True although <code>len(m)</code> is 0. Code such as <code>if results:</code> behaves differently with a mock than with an empty list.' },
    { kind: 'predict', q: 'pytest builds fixtures much like this. What does it print?', code: `from contextlib import ExitStack, contextmanager

@contextmanager
def fixture(name):
    print("setup", name)
    yield name
    print("teardown", name)

with ExitStack() as stack:
    for n in ["engine", "schema", "tx"]:
        stack.enter_context(fixture(n))
    print("test runs")`, options: ['setup engine, schema, tx · test runs · teardown engine, schema, tx', 'setup engine, schema, tx · test runs · teardown tx, schema, engine', 'setup tx, schema, engine · test runs · teardown engine, schema, tx', 'setup engine · teardown engine · setup schema …'], answer: 1, run: true, expect: 'setup engine\nsetup schema\nsetup tx\ntest runs\nteardown tx\nteardown schema\nteardown engine', explain: 'Dependencies are set up first (<code>tx</code> needs <code>schema</code>, which needs <code>engine</code>), and teardown is <b>last in, first out</b>. That way a fixture’s teardown can still use the fixtures it depends on.' },
    { kind: 'concept', q: 'How many test items does pytest collect here?', code: `@pytest.mark.parametrize("backend", ["sqlite", "postgres"])
@pytest.mark.parametrize("raw, ok", [("a@x.io", True), ("x", False), ("", False)])
def test_signup(backend, raw, ok):
    ...`, lang: 'python', options: ['2', '3', '5', '6'], answer: 3, explain: 'Stacked <code>parametrize</code> marks form a cartesian product: 2 × 3 = <b>6</b> items, each reported (and re-runnable with <code>-k</code> or its node id) separately. Function-scoped fixtures are rebuilt for each of the six.' },
    { kind: 'concept', q: '<code>schema</code> is module-scoped and <code>tx</code> is function-scoped. With <code>--setup-show</code>, what is printed after the <b>last</b> test in <code>test_orders.py</code>?', options: ['TEARDOWN M schema, then TEARDOWN F tx', 'TEARDOWN F tx, then TEARDOWN M schema', 'Only TEARDOWN F tx; schema lives until the session ends', 'Nothing: teardown happens at exit'], answer: 1, explain: 'After each test, its function-scoped fixtures are finalized. When the next item is in a different module (or there is none), module-scoped fixtures are finalized too, and always after the narrower ones. Press Play in the visual above with “module” selected.' },
    { kind: 'concept', q: 'A session-scoped fixture declares <code>def app(monkeypatch):</code>. What happens?', options: ['monkeypatch is promoted to session scope', 'The patch is undone after the first test', 'pytest raises <code>ScopeMismatch</code> when the fixture is requested', 'It works, but prints a warning'], answer: 2, explain: '<code>monkeypatch</code>, <code>tmp_path</code> and <code>capsys</code> are function-scoped. A wider fixture cannot depend on a narrower one. Use <code>pytest.MonkeyPatch.context()</code> or <code>tmp_path_factory</code> inside session fixtures.' }
  ],
  interview: [
    { q: 'How does pytest decide what to inject into a test?', a: '<p>By parameter name. At collection time pytest inspects the test’s signature, looks up a fixture with each name (in the test module, then <code>conftest.py</code> files from the test’s directory up to the root, then plugins), and builds the dependency closure. It sets fixtures up in dependency order, wider scopes first, and caches each by scope. Overriding is by name too: a fixture in a deeper <code>conftest.py</code> shadows a higher one, which is how you specialise per directory.</p>', lvl: 'core' },
    { q: 'Explain fixture scopes and when you would use each.', a: '<ul><li><b>function</b> (default): anything mutable, such as a DB session with rollback, a client with patched settings or a temp dir.</li><li><b>class / module</b>: moderately expensive read-only setup shared by a group of tests.</li><li><b>package</b>: per test directory.</li><li><b>session</b>: expensive, immutable resources such as a DB engine, a Testcontainers Postgres, migrations or a compiled model.</li></ul><p>Rule: widen scope only for things tests don’t mutate, then give each test isolation inside it.</p>', fu: 'How do you share a session fixture across pytest-xdist workers? (You don’t: each worker is a process with its own session. Use <code>worker_id</code> to give each its own database, or a file lock to share one.)', lvl: 'core' },
    { q: 'yield fixture vs <code>request.addfinalizer</code>?', a: '<p>Equivalent for the simple case: code after <code>yield</code> is registered as a finalizer. <code>addfinalizer</code> lets you register cleanup <i>during</i> setup, right after each resource is created, so a failure halfway through setup still cleans up what already exists. With <code>yield</code>, nothing after the yield runs if setup raised before reaching it.</p>', lvl: 'deep' },
    { q: 'monkeypatch vs <code>unittest.mock.patch</code>?', a: '<p>Both temporarily replace an attribute, dict item or environment variable and restore it afterwards. <code>monkeypatch</code> is a fixture: undo happens at test teardown automatically, and it has helpers (<code>setenv</code>, <code>delenv</code>, <code>chdir</code>, <code>syspath_prepend</code>). <code>mock.patch</code> works as a decorator or context manager, and creates <code>MagicMock</code> objects that record calls for assertions. A common style: <code>monkeypatch</code> for configuration and environment, <code>mocker</code> (pytest-mock) or <code>patch</code> when you need call assertions.</p>', lvl: 'core' },
    { q: 'Where do you patch, and why?', a: '<p>Where the name is <b>looked up</b> at call time. If <code>app/billing.py</code> does <code>from stripe_client import charge</code>, patch <code>app.billing.charge</code>. If it does <code>import stripe_client</code> and calls <code>stripe_client.charge()</code>, patch <code>stripe_client.charge</code>. <code>patch</code> rebinds one attribute on one object, nothing more.</p>', lvl: 'core' },
    { q: 'How do you keep mocks honest?', a: '<p>Use <code>autospec=True</code> or <code>create_autospec</code> so calls must match real signatures and missing attributes raise. Mock at boundaries you own (an adapter interface) rather than deep inside libraries. Prefer fakes that use real types: <code>httpx.MockTransport</code>, an in-memory repository that implements the same Protocol, or a real Postgres in a container. Add a few contract or integration tests that run against the real thing.</p>', lvl: 'deep' },
    { q: 'How would you test code that depends on time or randomness?', a: '<p>Inject a clock (a <code>now: Callable[[], datetime]</code> parameter, or a <code>Clock</code> protocol) rather than calling <code>datetime.now()</code> inside the logic. For legacy code, freeze time with <code>time-machine</code> or freezegun. For randomness, pass a seeded <code>random.Random</code> instance. Then property-based tests (Hypothesis) can explore the inputs.</p>', lvl: 'core' },
    { q: 'What does coverage measure, and what threshold would you set?', a: '<p>Which lines, and with <code>--cov-branch</code> which branch arcs, executed while tests ran. It shows <i>untested</i> code; it does not prove the tested code is checked. I would gate on branch coverage at a realistic level for the codebase (often 80–90% for services), require new code to be covered in review, and exclude generated code and <code>if TYPE_CHECKING:</code> blocks in <code>[tool.coverage.report]</code>. Subprocesses and multiprocessing need extra configuration to be measured.</p>', lvl: 'core' },
    { q: 'How does pytest show such good assertion failures with a plain <code>assert</code>?', a: '<p>Assertion rewriting. An import hook rewrites the AST of test modules (and <code>conftest.py</code>, and plugins) at import time, so each <code>assert</code> records intermediate values and prints them when it fails. Helper modules outside tests are not rewritten unless you call <code>pytest.register_assert_rewrite</code>. Running Python with <code>-O</code> strips asserts entirely, which is one reason never to use <code>assert</code> for production checks.</p>', lvl: 'deep' },
    { q: 'How do you test a FastAPI endpoint that depends on a database?', a: '<p>Override the dependency: <code>app.dependency_overrides[get_session] = lambda: test_session</code>, where <code>test_session</code> comes from a function-scoped fixture with transaction rollback. Then call it through <code>TestClient(app)</code> (sync) or <code>httpx.AsyncClient(transport=ASGITransport(app))</code> (async). Clear the overrides in teardown. See <a href="fastapi.html">FastAPI services</a>.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'conftest.py (DB + factories)', lang: 'python', code: `# tests/conftest.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from orders_svc.db import Base
from orders_svc.main import app, get_session
from orders_svc.models import Order

@pytest.fixture(scope="session")
def engine(tmp_path_factory):
    url = f"sqlite:///{tmp_path_factory.mktemp('db') / 'test.db'}"   # or a Testcontainers Postgres
    eng = create_engine(url)
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()

@pytest.fixture
def session(engine):
    conn = engine.connect()
    trans = conn.begin()
    s = Session(bind=conn, join_transaction_mode="create_savepoint")
    yield s
    s.close()
    trans.rollback()
    conn.close()

@pytest.fixture
def make_order(session):
    """Factory fixture: a function that creates rows, so tests say only what matters."""
    def _make(**overrides):
        order = Order(**({"status": "new", "total_cents": 1000} | overrides))
        session.add(order)
        session.flush()
        return order
    return _make

@pytest.fixture
def client(session):
    from fastapi.testclient import TestClient
    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()`, note: '<code>join_transaction_mode="create_savepoint"</code> (SQLAlchemy 2.0) lets code under test call <code>commit()</code> while the outer transaction is still rolled back.' },
    { title: 'Tests: parametrize, monkeypatch, fakes', lang: 'python', code: `import httpx
import pytest

from orders_svc.pricing import apply_coupon
from orders_svc.rates import RatesClient

@pytest.mark.parametrize(
    ("code", "total", "expected"),
    [
        pytest.param("SPRING10", 1000, 900, id="percent"),
        pytest.param("FLAT5", 1000, 500, id="flat"),
        pytest.param("FLAT5", 300, 0, id="never-negative"),
        pytest.param("BOGUS", 1000, 1000, id="unknown-code"),
    ],
)
def test_apply_coupon(code, total, expected):
    assert apply_coupon(total, code) == expected

def test_rates_timeout_is_configurable(monkeypatch):
    monkeypatch.setenv("RATES_TIMEOUT_S", "0.5")
    assert RatesClient.from_env().timeout == 0.5

def test_rates_parses_response():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["base"] == "EUR"
        return httpx.Response(200, json={"rates": {"USD": 1.08}})
    client = RatesClient(httpx.Client(transport=httpx.MockTransport(handler), base_url="https://fx.test"))
    assert client.rate("EUR", "USD") == pytest.approx(1.08)

def test_list_orders(client, make_order):
    make_order(status="paid")
    r = client.get("/orders", params={"status": "paid"})
    assert r.status_code == 200 and len(r.json()) == 1` },
    { title: 'pyproject: pytest + coverage', lang: 'text', code: `[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-ra --strict-markers --strict-config"
markers = ["slow: needs Docker; deselect with -m 'not slow'"]
filterwarnings = ["error"]          # warnings fail the build

[tool.coverage.run]
branch = true
source = ["orders_svc"]

[tool.coverage.report]
show_missing = true
skip_covered = true
fail_under = 85
exclude_also = ["if TYPE_CHECKING:", "raise NotImplementedError", "\\\\.\\\\.\\\\."]

# CI:
#   uv run pytest -n auto --cov --cov-report=term-missing --cov-report=xml` },
    { title: 'Java comparison (JUnit 5)', lang: 'java', code: `// JUnit 5 + Mockito                      // pytest
@BeforeAll static void startDb()          // @pytest.fixture(scope="session")
@BeforeEach void beginTx()                // @pytest.fixture (function scope) + yield
@AfterEach void rollback()                //   ...code after yield
@ParameterizedTest @CsvSource({...})      // @pytest.mark.parametrize
@Mock PaymentGateway gw;                  // create_autospec(PaymentGateway)
when(gw.charge(100)).thenReturn(OK);      // gw.charge.return_value = OK
verify(gw).charge(100);                   // gw.charge.assert_called_once_with(100)
@TempDir Path dir;                        // tmp_path fixture
@SpringBootTest + @MockBean               // app.dependency_overrides[...] = fake

// Big difference: JUnit wires lifecycle by annotations on a class;
// pytest wires it by parameter NAMES, and any test can mix fixtures freely.`, note: 'Mockito mocks are strict about types (they implement the interface). Python mocks are not, unless you ask for <code>autospec</code>.' }
  ]
});

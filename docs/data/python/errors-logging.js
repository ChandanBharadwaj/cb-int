IA.register({
  track: 'python',
  slug: 'errors-logging',
  title: 'Exceptions & logging',
  tagline: 'Every exception carries its history: <code>__cause__</code> when you write <code>raise … from e</code>, <code>__context__</code> when one is raised while handling another. Since 3.11 several can travel together in an <code>ExceptionGroup</code>, caught with <code>except*</code>. And a log call is a <b>record</b> that flows logger → handlers → formatter, up the dotted logger tree. Know both pipelines and incidents become readable.',
  tldr: {
    problem: 'Errors that vanish (<code>except Exception: pass</code>), log lines without tracebacks, the real cause hidden under “During handling of the above exception…”, retry logic that stopped matching after a move to <code>TaskGroup</code>, duplicate log lines, and library logs that disappear after a config change.',
    model: '<b>Exceptions:</b> one class hierarchy rooted at <code>BaseException</code>; <code>except</code> matches by <code>isinstance</code>; chaining links exceptions into a list that the traceback prints oldest first. <b>Logging:</b> <code>logger.info()</code> checks the logger’s effective level, builds a <code>LogRecord</code>, hands it to this logger’s handlers, then (with <code>propagate=True</code>) to every ancestor’s handlers. Handlers have their own levels; each has one formatter.',
    hook: '“Why do I get every log line twice?” Your <code>app</code> logger has a handler, the root logger has one too, and records propagate. The ancestor’s <i>level</i> isn’t checked during propagation; only its handlers’ levels are.',
    facts: [
      { v: 'from e / from None', l: '<code>raise X from e</code> sets <code>X.__cause__</code> (“direct cause”); <code>from None</code> hides the implicit <code>__context__</code> in the traceback' },
      { v: '3.11', l: 'added <code>ExceptionGroup</code>, <code>except*</code> (PEP 654), <code>add_note()</code> (PEP 678) and <code>asyncio.TaskGroup</code>, which raises groups' },
      { v: 'WARNING', l: 'the root logger’s default level. With no handlers configured, the “last resort” handler prints WARNING and above to stderr' }
    ]
  },
  intro: {
    what: 'When something goes wrong, Python <b>raises an exception</b>: an object describing the error. It travels up through the calling functions until a <code>try/except</code> catches it; if nothing does, the program prints a <b>traceback</b> and stops. <b>Logging</b> is how a running program reports what it is doing: you call <code>logger.info(...)</code>, and configuration decides where messages go (console, file, a log service) and in what format.',
    analogy: { icon: '📮', title: 'Incident reports and the mail room', text: 'An exception is an incident report passed up the management chain until someone handles it. If a manager writes a new report, they staple the old one behind it (“caused by”). A log record is a letter dropped in your department’s outbox: the mail room (handlers) of your department and of every parent department may each make a copy and file it, in their own format.' },
    steps: [
      { t: 'Catch what you can handle', d: 'Name the specific exception; let the rest propagate.', code: 'try:\n    cfg = json.loads(text)\nexcept json.JSONDecodeError as e:\n    raise ConfigError("config.json is not valid JSON") from e' },
      { t: 'Clean up with finally (or with)', d: '<code>finally</code> runs whether or not an exception happened.', code: 'conn = pool.get()\ntry:\n    conn.execute(sql)\nfinally:\n    pool.put(conn)' },
      { t: 'Get a logger per module', d: 'Logger names follow the module path, which builds a tree.', code: 'import logging\nlog = logging.getLogger(__name__)     # e.g. "app.orders"\n\nlog.info("order %s paid", order_id)  # args formatted lazily' },
      { t: 'Log exceptions with their traceback', d: 'Inside <code>except</code>, <code>log.exception</code> logs at ERROR and attaches the traceback.', code: 'try:\n    charge(order)\nexcept PaymentError:\n    log.exception("charge failed for order %s", order.id)\n    raise' },
      { t: 'Configure once, at startup', d: 'Only the application entry point configures handlers and formats. Libraries just get loggers.', code: 'logging.basicConfig(level=logging.INFO,\n    format="%(asctime)s %(levelname)s %(name)s %(message)s")' }
    ],
    terms: [
      ['traceback', 'The printed call stack of an exception, oldest call first and the line that raised last.'],
      ['exception chaining', 'Linking a new exception to the one that caused it: <code>__cause__</code> (explicit) or <code>__context__</code> (implicit).'],
      ['ExceptionGroup', 'One exception that carries several others, e.g. from parallel tasks. Handled with <code>except*</code>.'],
      ['logger', 'A named source of log records, in a dotted hierarchy: <code>app.orders</code> is a child of <code>app</code>, which is a child of root.'],
      ['handler', 'Sends records somewhere: <code>StreamHandler</code> (console), <code>FileHandler</code>, <code>QueueHandler</code>…'],
      ['formatter', 'Turns a record into text: a format string, or JSON for structured logs.']
    ]
  },
  visual: {
    title: 'Exception chains and ExceptionGroup splitting',
    caption: '<b>Chaining:</b> pick how <code>ConfigError</code> is raised (<code>from e</code>, no <code>from</code>, <code>from None</code>), then Play: watch the links form and the traceback that results. <b>except*:</b> a group of four errors passes through two <code>except*</code> clauses; each clause takes its matching subgroup, and what is left is re-raised.'
  },
  extras: [
    { id: 'errors-logging-flow', title: 'A log record’s journey', label: 'Logging flow', caption: 'Pick a log call and the <code>propagate</code> setting of the <code>app</code> logger, then press <b>Play</b> or <b>Step</b>. Follow the record through level checks, handlers and formatters, and see what reaches stdout.' }
  ],
  playground: {
    kind: 'python',
    presets: [
      { label: 'Chaining: cause vs context', code: `import sys, traceback

class ConfigError(Exception):
    pass

def load(style):
    try:
        {}["db_url"]                       # KeyError
    except KeyError as e:
        if style == "from e":
            raise ConfigError("db_url missing") from e
        if style == "from None":
            raise ConfigError("db_url missing") from None
        raise ConfigError("db_url missing")  # implicit chaining

for style in ["from e", "implicit", "from None"]:
    try:
        load(style)
    except ConfigError as err:
        print(f"=== {style}: cause={err.__cause__!r} context={err.__context__!r} "
              f"suppress={err.__suppress_context__}")
        traceback.print_exception(err, file=sys.stdout, limit=1)`, note: 'Compare the joining sentence: “direct cause” vs “During handling of the above exception”. With <code>from None</code> the KeyError is still in <code>__context__</code>, just not printed.' },
      { label: 'ExceptionGroup + except*', code: `def validate(rows):
    errors = []
    for i, row in enumerate(rows):
        try:
            if "id" not in row:
                raise KeyError("id")
            if not isinstance(row["qty"], int):
                raise TypeError(f"qty must be int, got {type(row['qty']).__name__}")
            if row["qty"] <= 0:
                raise ValueError("qty must be positive")
        except Exception as e:
            e.add_note(f"row {i}: {row}")          # 3.11+: extra context, shown in tracebacks
            errors.append(e)
    if errors:
        raise ExceptionGroup(f"{len(errors)} rows invalid", errors)

rows = [{"id": 1, "qty": 2}, {"qty": 1}, {"id": 3, "qty": -1}, {"id": 4, "qty": "2"}, {"id": 5, "qty": 0}]
try:
    validate(rows)
except* ValueError as eg:
    print("ValueErrors:", [(str(e), e.__notes__[0]) for e in eg.exceptions])
except* KeyError as eg:
    print("KeyErrors  :", len(eg.exceptions))
except* TypeError as eg:
    print("TypeErrors :", [str(e) for e in eg.exceptions])

eg = ExceptionGroup("batch", [ValueError(1), KeyError(2), ValueError(3)])
match, rest = eg.split(ValueError)
print("split ->", match.exceptions, "| rest:", rest.exceptions)`, note: 'Each <code>except*</code> clause runs at most once, with a group of all matching exceptions. Several clauses can run for one group.' },
      { label: 'Logger tree & propagation', code: `import logging, sys

def show(tag):
    return logging.Formatter(f"[{tag}] %(name)s %(levelname)s %(message)s")

root = logging.getLogger()
h_root = logging.StreamHandler(sys.stdout); h_root.setFormatter(show("root handler"))
root.addHandler(h_root)                      # root level stays WARNING

app = logging.getLogger("app")
app.setLevel(logging.INFO)
h_app = logging.StreamHandler(sys.stdout); h_app.setFormatter(show("app handler"))
app.addHandler(h_app)

orders = logging.getLogger("app.orders")     # no level, no handlers
print("effective level of app.orders:", logging.getLevelName(orders.getEffectiveLevel()))

orders.debug("dropped: below INFO")
orders.info("paid")          # app handler AND root handler: root's WARNING level is not checked
logging.getLogger("urllib3").info("dropped: urllib3 inherits root's WARNING")

app.propagate = False
orders.info("paid again")    # now only the app handler`, note: 'Propagation passes the record to ancestor <b>handlers</b> directly; ancestor logger levels and filters are skipped.' },
      { label: 'Structured JSON logs', code: `import contextvars, json, logging, sys, uuid

request_id = contextvars.ContextVar("request_id", default="-")

class RequestIdFilter(logging.Filter):
    def filter(self, record):
        record.request_id = request_id.get()     # stamp every record
        return True

class JsonFormatter(logging.Formatter):
    RESERVED = set(vars(logging.makeLogRecord({})))
    def format(self, record):
        doc = {"ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"), "level": record.levelname,
               "logger": record.name, "msg": record.getMessage(), "request_id": record.request_id}
        doc |= {k: v for k, v in vars(record).items() if k not in self.RESERVED and k not in doc}
        if record.exc_info:
            doc["exc"] = self.formatException(record.exc_info).splitlines()[-1]
        return json.dumps(doc, default=str)

h = logging.StreamHandler(sys.stdout)
h.setFormatter(JsonFormatter()); h.addFilter(RequestIdFilter())
log = logging.getLogger("app.orders"); log.addHandler(h); log.setLevel(logging.INFO); log.propagate = False

request_id.set(uuid.uuid4().hex[:8])            # a middleware would do this per request
log.info("order paid", extra={"order_id": 42, "amount_cents": 1999})
try:
    1 / 0
except ZeroDivisionError:
    log.exception("pricing failed", extra={"order_id": 42})`, note: 'One JSON object per line, with fields a log platform can index. <code>contextvars</code> follow asyncio tasks, like MDC follows a thread in SLF4J.' },
      { label: 'What does except catch?', code: `import asyncio

def classify(exc):
    try:
        raise exc
    except Exception:
        return "caught by except Exception"
    except BaseException:
        return "only BaseException"

for e in [ValueError(), KeyError("k"), TimeoutError(), KeyboardInterrupt(),
          SystemExit(0), asyncio.CancelledError(), ExceptionGroup("g", [ValueError()])]:
    print(f"{type(e).__name__:18} {classify(e):28} mro: {[c.__name__ for c in type(e).__mro__[1:-1]]}")`, note: 'KeyboardInterrupt, SystemExit and (since 3.8) <code>asyncio.CancelledError</code> skip <code>except Exception</code> on purpose, so Ctrl-C, <code>sys.exit()</code> and task cancellation keep working.' },
      { label: 'Lazy log formatting', code: `import logging

class Expensive:
    calls = 0
    def __str__(self):
        Expensive.calls += 1
        return "<big object dump>"

log = logging.getLogger("perf")
log.setLevel(logging.INFO)
obj = Expensive()

for _ in range(1000):
    log.debug("state: %s", obj)          # level check first: never formatted
print("%-style calls to __str__:", Expensive.calls)

for _ in range(1000):
    log.debug(f"state: {obj}")           # f-string is built before the call
print("f-string calls to __str__:", Expensive.calls)` }
    ]
  },
  gotchas: [
    { trap: 'Logging the exception without its traceback', code: `except Exception as e:
    log.error(f"failed: {e}")      # for KeyError('customer_id') prints: failed: 'customer_id'`, why: '<code>str(e)</code> is often useless (a <code>KeyError</code> prints only the key) and the traceback, which says <i>where</i>, is lost.', fix: 'Inside <code>except</code>, use <code>log.exception("charge failed")</code> (ERROR + traceback) or <code>log.warning(..., exc_info=True)</code>. Add the context as structured fields, not by gluing strings.' },
    { trap: '<code>except Exception: pass</code> (or a bare <code>except:</code>)', code: `try:
    sync_inventory()
except:          # also swallows KeyboardInterrupt and SystemExit
    pass`, why: 'Silently swallowed errors turn bugs into wrong data. A bare <code>except:</code> catches <code>BaseException</code>, so Ctrl-C, <code>sys.exit()</code> and generator or task cleanup break too.', fix: 'Catch the narrowest exception you can actually handle. If you must catch broadly at a boundary (a worker loop, a request handler), log with the traceback and re-raise or count it. Ruff rules <code>E722</code>, <code>BLE001</code> and <code>S110</code> flag these.' },
    { trap: '<code>except Exception</code> around a TaskGroup', code: `try:
    async with asyncio.TaskGroup() as tg:
        tg.create_task(fetch(a)); tg.create_task(fetch(b))
except TimeoutError:          # never matches: TaskGroup raises ExceptionGroup
    retry()`, why: '<code>TaskGroup</code> wraps task failures in an <code>ExceptionGroup</code>, even when only one task failed. A plain <code>except TimeoutError</code> doesn’t match a group.', fix: 'Use <code>except* TimeoutError as eg:</code>, which matches any group containing TimeoutErrors (and also a bare TimeoutError). Inspect <code>eg.exceptions</code>.' },
    { trap: 'Duplicate log lines', code: `logging.basicConfig(level=logging.INFO)          # handler on root
log = logging.getLogger("app")
log.addHandler(logging.StreamHandler())          # and one on "app"
log.info("hi")                                   # printed twice`, why: 'Records propagate to every ancestor’s handlers. A handler on both <code>app</code> and root means two copies, and twice the log ingestion bill. Calling a “setup logger” function per import adds yet another handler each time.', fix: 'Attach handlers in one place, usually only on the root logger, at startup. Library and module code calls <code>getLogger(__name__)</code> and nothing else. If a subtree must log elsewhere, give it handlers and set <code>propagate = False</code>.' },
    { trap: '<code>dictConfig</code> silences existing loggers', code: `# settings.py imported first: its modules already called getLogger(__name__)
logging.config.dictConfig({"version": 1, "handlers": {...}, "root": {...}})
# sqlalchemy and app.* loggers created earlier are now disabled`, why: '<code>disable_existing_loggers</code> defaults to <b>True</b> in <code>dictConfig</code> (and <code>fileConfig</code>): every non-root logger that exists at that moment and is not named in the config is disabled.', fix: 'Always set <code>"disable_existing_loggers": False</code>, and configure logging as early as possible in the entry point.' },
    { trap: 'f-strings and work in disabled log calls', code: `log.debug(f"payload={json.dumps(payload)}")    # serialised even when DEBUG is off
log.debug("payload=%s", payload)               # formatted only if emitted`, why: 'Arguments are evaluated before the call. The level check happens inside, too late to skip an f-string or a <code>json.dumps</code>. In a hot path that is real CPU.', fix: 'Use %-style arguments, or guard expensive work with <code>if log.isEnabledFor(logging.DEBUG):</code>. Ruff’s <code>G004</code> flags f-strings in logging calls.' },
    { trap: '<code>return</code> in <code>finally</code> swallows the exception', code: `def save():
    try:
        write()                 # raises
    finally:
        return "ok"             # the exception is discarded`, why: 'A <code>return</code>, <code>break</code> or <code>continue</code> in <code>finally</code> replaces the in-flight exception, so the caller sees success. Python 3.14 emits a <code>SyntaxWarning</code> for this (PEP 765).', fix: 'Keep <code>finally</code> for cleanup only. Put the return after the <code>try</code> statement.' }
  ],
  scenarios: [
    { title: 'On-call sees only <code>ERROR failed: \'customer_id\'</code>',
      symptom: 'A batch job failed nightly. The only log line was <code>ERROR failed: \'customer_id\'</code>, with no stack trace, no record id and no indication of which of 40 steps broke.',
      diagnose: `try:
    run_step(step, record)
except Exception as e:
    log.error(f"failed: {e}")          # str(KeyError('customer_id')) == "'customer_id'"`,
      cause: 'The handler logged <code>str(e)</code>, which for a <code>KeyError</code> is only the missing key, and dropped both the traceback and the context (step, record).',
      fix: 'Log with the traceback and structured context, and preserve the chain when you translate exceptions.',
      fixCode: `try:
    run_step(step, record)
except Exception as e:
    e.add_note(f"step={step.name} record_id={record.id}")          # 3.11+
    log.exception("step failed", extra={"step": step.name, "record_id": record.id})
    raise StepFailed(step.name) from e` },
    { title: 'Retries stopped working after “modernising” to TaskGroup',
      symptom: 'An agent called three tools concurrently. After switching from <code>asyncio.gather</code> to <code>asyncio.TaskGroup</code>, transient tool timeouts started failing whole requests instead of being retried.',
      diagnose: `try:
    async with asyncio.TaskGroup() as tg:
        for t in tools:
            tg.create_task(t.call(query))
except TimeoutError:              # matched with gather(); never matches now
    return await retry_slow_tools()
# traceback: ExceptionGroup: unhandled errors in a TaskGroup (1 sub-exception)`,
      cause: '<code>gather</code> re-raised the first exception as-is. <code>TaskGroup</code> cancels the remaining tasks and raises an <code>ExceptionGroup</code> containing every failure, so the plain <code>except TimeoutError</code> never matched.',
      fix: 'Handle groups with <code>except*</code>. Decide explicitly what happens when timeouts and other errors arrive together.',
      fixCode: `try:
    async with asyncio.TaskGroup() as tg:
        tasks = {t.name: tg.create_task(t.call(query)) for t in tools}
except* TimeoutError as eg:
    log.warning("tool timeouts: %d", len(eg.exceptions))
    return await retry_slow_tools()
except* ToolError as eg:
    raise AgentError("tool failed") from eg` },
    { title: 'Every log line appears twice, and the log bill doubled',
      symptom: 'After moving the service to a shared logging setup, each event appeared twice in Datadog, once as JSON and once as plain text.',
      diagnose: `import logging
for name in ["", "app", "uvicorn", "uvicorn.access"]:
    lg = logging.getLogger(name)
    print(repr(name), lg.level, lg.propagate, lg.handlers)
# ''    30 True  [<StreamHandler <stderr> (NOTSET)>]       <- added by basicConfig in a library
# 'app' 20 True  [<StreamHandler <stdout> (INFO)>]         <- our JSON handler`,
      lang: 'python',
      cause: 'The <code>app</code> logger had a JSON handler and propagated to root, where an imported library had called <code>basicConfig()</code>, adding a plain-text handler. Both handlers emitted every record.',
      fix: 'Configure logging once at the entry point with <code>dictConfig</code>: handlers only on root, <code>disable_existing_loggers: False</code>, and the uvicorn loggers pointed at the same handler. Libraries must never call <code>basicConfig</code>.',
      fixCode: `LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"json": {"()": "app.logjson.JsonFormatter"}},
    "handlers": {"stdout": {"class": "logging.StreamHandler", "stream": "ext://sys.stdout", "formatter": "json"}},
    "root": {"level": "INFO", "handlers": ["stdout"]},
    "loggers": {
        "uvicorn.access": {"level": "WARNING"},
        "sqlalchemy.engine": {"level": "WARNING"},
    },
}
logging.config.dictConfig(LOGGING)` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `try:
    try:
        1 / 0
    except ZeroDivisionError as e:
        raise ValueError("bad input") from e
except ValueError as v:
    print(type(v.__cause__).__name__, type(v.__context__).__name__, v.__suppress_context__)`, options: ['ZeroDivisionError NoneType False', 'ZeroDivisionError ZeroDivisionError True', 'NoneType ZeroDivisionError False', 'ZeroDivisionError ZeroDivisionError False'], answer: 1, run: true, expect: 'ZeroDivisionError ZeroDivisionError True', explain: '<code>raise … from e</code> sets <code>__cause__</code> and <code>__suppress_context__ = True</code>. Because it is raised inside an <code>except</code> block, <code>__context__</code> is set automatically as well. The traceback shows the cause (“direct cause of the following exception”), not the context.' },
    { kind: 'predict', q: 'What does this print?', code: `try:
    try:
        {}["k"]
    except KeyError:
        raise LookupError("missing setting") from None
except LookupError as e:
    print(e.__cause__, type(e.__context__).__name__, e.__suppress_context__)`, options: ['None NoneType True', 'None KeyError True', 'None KeyError False', 'KeyError KeyError True'], answer: 1, run: true, expect: 'None KeyError True', explain: '<code>from None</code> sets <code>__cause__ = None</code> and <code>__suppress_context__ = True</code>. The original KeyError is <b>still stored</b> in <code>__context__</code> (debuggers can see it); it just isn’t printed in the traceback.' },
    { kind: 'predict', q: 'What does this print?', code: `def f():
    raise ExceptionGroup("batch", [ValueError(1), TypeError(2), ValueError(3)])

try:
    f()
except* ValueError as eg:
    print("V", [e.args[0] for e in eg.exceptions])
except* TypeError as eg:
    print("T", len(eg.exceptions))`, options: ['V [1]<br>V [3]<br>T 1', 'V [1, 3]<br>T 1', 'V [1, 3]', 'V [1, 3, 2]'], answer: 1, run: true, expect: 'V [1, 3]\nT 1', explain: 'Each <code>except*</code> clause runs <b>at most once</b>, receiving a subgroup with all the exceptions it matches. Unlike <code>except</code>, several clauses can run for one raise: both handlers run here.' },
    { kind: 'predict', q: 'What does this print?', code: `try:
    try:
        raise ExceptionGroup("g", [ValueError("a"), KeyError("b")])
    except* ValueError:
        print("handled V")
except ExceptionGroup as rest:
    print("left:", [type(e).__name__ for e in rest.exceptions], rest.message)`, options: ["handled V<br>left: ['KeyError'] g", "handled V<br>left: ['ValueError', 'KeyError'] g", "handled V", "left: ['KeyError'] g"], answer: 0, run: true, expect: "handled V\nleft: ['KeyError'] g", explain: 'What no <code>except*</code> clause matches is re-raised at the end of the <code>try</code> statement, as a group with the same message containing only the leftovers. The outer handler sees just the KeyError.' },
    { kind: 'predict', q: 'Which exceptions does <code>except Exception</code> catch?', code: `import asyncio

def classify(exc):
    try:
        raise exc
    except Exception:
        return "Exception"
    except BaseException:
        return "BaseException only"

for e in (ValueError(), KeyboardInterrupt(), asyncio.CancelledError(), SystemExit(0)):
    print(type(e).__name__, "->", classify(e))`, options: ['All four: Exception', 'ValueError → Exception; the other three → BaseException only', 'ValueError and CancelledError → Exception; the others → BaseException only', 'ValueError and SystemExit → Exception'], answer: 1, run: true, expect: 'ValueError -> Exception\nKeyboardInterrupt -> BaseException only\nCancelledError -> BaseException only\nSystemExit -> BaseException only', explain: 'KeyboardInterrupt, SystemExit and (since 3.8) <code>asyncio.CancelledError</code> derive directly from <code>BaseException</code>, so broad <code>except Exception</code> handlers don’t break Ctrl-C, <code>sys.exit()</code> or task cancellation. If you catch CancelledError yourself, re-raise it.' },
    { kind: 'predict', q: 'Root has a handler; only <code>app</code> sets a level. What is printed?', code: `import logging, sys

root = logging.getLogger()
h = logging.StreamHandler(sys.stdout)
h.setFormatter(logging.Formatter("%(name)s:%(levelname)s:%(message)s"))
root.addHandler(h)             # root's level stays WARNING

log = logging.getLogger("app")
log.setLevel(logging.INFO)
log.info("hello")
logging.getLogger("other").info("ignored?")`, options: ['Nothing: root is WARNING', 'app:INFO:hello', 'app:INFO:hello<br>other:INFO:ignored?', 'INFO:app:hello'], answer: 1, run: true, expect: 'app:INFO:hello', explain: '<code>app</code>’s own level (INFO) lets the record through, and propagation hands it to root’s <b>handler</b>; root’s <i>level</i> is not consulted. <code>other</code> has no level, so its effective level is root’s WARNING and the INFO call is dropped before a record is even made.' },
    { kind: 'bug', q: 'A helper is called from two modules. What is printed?', code: `import logging, sys

def get_logger():
    log = logging.getLogger("svc")
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(logging.Formatter("%(message)s"))
    log.addHandler(h)
    log.setLevel(logging.INFO)
    return log

get_logger().info("one")
get_logger().info("two")`, options: ['one<br>two', 'one<br>two<br>two', 'one<br>one<br>two<br>two', 'two'], answer: 1, run: true, expect: 'one\ntwo\ntwo', explain: '<code>getLogger("svc")</code> always returns the <b>same</b> logger object, so each call adds another handler. After the second call there are two, and every record is printed twice. Configure handlers once, at startup.' },
    { kind: 'predict', q: 'What does this print?', code: `def save():
    try:
        raise RuntimeError("disk full")
    finally:
        return "saved"

print(save())`, options: ['RuntimeError: disk full', 'saved', 'saved, then RuntimeError', 'None'], answer: 1, run: true, expect: 'saved', explain: 'A <code>return</code> in <code>finally</code> replaces the in-flight exception, which is discarded. The caller thinks the save worked. Python 3.14 warns about this (PEP 765); linters flag it already.' }
  ],
  interview: [
    { q: 'Explain <code>__cause__</code>, <code>__context__</code> and <code>__suppress_context__</code>.', a: '<p>When an exception is raised while another is being handled, Python stores the one being handled in the new exception’s <code>__context__</code> automatically; the traceback says “During handling of the above exception, another exception occurred”. <code>raise X from Y</code> sets <code>__cause__ = Y</code> and <code>__suppress_context__ = True</code>, and the traceback says “The above exception was the direct cause”. <code>raise X from None</code> suppresses the context in the output while keeping it stored. Use <code>from e</code> when translating exceptions across layers, so the root cause survives.</p>', lvl: 'core' },
    { q: 'How should a service design its exceptions?', a: '<p>A small hierarchy per domain: <code>class OrdersError(Exception)</code> with specific subclasses (<code>OrderNotFound</code>, <code>PaymentDeclined</code>) carrying structured attributes, not just message strings. Translate third-party exceptions at the boundary (<code>raise PaymentDeclined(code) from stripe_err</code>) so callers don’t depend on vendor types. Map them to HTTP status codes in one place (a FastAPI exception handler). Don’t subclass <code>BaseException</code>, and don’t use exceptions for normal control flow across layers.</p>', lvl: 'core' },
    { q: 'What problem do <code>ExceptionGroup</code> and <code>except*</code> solve?', a: '<p>Concurrent or batch work can fail in several ways at once. Before 3.11 you could raise only one exception, so the others were lost (<code>gather</code> reports only the first). An <code>ExceptionGroup</code> carries all of them, possibly nested. <code>except* T</code> splits the group: the clause runs once with the subgroup of matching exceptions, other clauses handle other types, and unhandled leftovers are re-raised. <code>asyncio.TaskGroup</code> and <code>anyio</code> task groups raise groups. You can’t mix <code>except</code> and <code>except*</code> in one <code>try</code>, and <code>return</code>, <code>break</code> and <code>continue</code> are not allowed in an <code>except*</code> block.</p>', lvl: 'deep' },
    { q: 'How do checked exceptions in Java compare with Python?', a: '<p>Python has no checked exceptions: nothing forces callers to handle or declare them. Document what a function raises (docstrings, and in some codebases a <code>Raises:</code> section), and rely on tests and a deliberate domain hierarchy. The upside is no wrapping just to satisfy the compiler. The risk is forgetting a failure mode, so catch at boundaries (request handler, worker loop, CLI main) where you can log and translate.</p>', lvl: 'core' },
    { q: 'Walk through what happens when you call <code>log.info("x %s", v)</code>.', a: '<ol><li><code>isEnabledFor(INFO)</code>: compare with the logger’s <b>effective</b> level (its own, or the first ancestor’s that is set). If disabled: return immediately, and nothing is formatted.</li><li>Make a <code>LogRecord</code> (name, level, msg, args, pathname, lineno, thread, taskName in 3.12+, exc_info, <code>extra</code> fields).</li><li>Apply this logger’s filters.</li><li>For each handler of this logger: check the handler’s level and filters, then <code>format</code> with its formatter and <code>emit</code>.</li><li>If <code>propagate</code> is true, repeat step 4 for the parent’s handlers, up to root, without checking the parents’ levels.</li><li>If no handler was found anywhere, <code>logging.lastResort</code> prints WARNING+ to stderr.</li></ol>', lvl: 'deep' },
    { q: 'Where should logging be configured, and how?', a: '<p>Only in the application entry point (the <code>main</code>, the ASGI app factory, the CLI), once, before other modules log. Use <code>logging.config.dictConfig</code> with <code>disable_existing_loggers: False</code>, handlers on root, and per-library level overrides (<code>sqlalchemy.engine</code>, <code>httpx</code>, <code>uvicorn.access</code>). Libraries only call <code>logging.getLogger(__name__)</code>, and optionally add a <code>NullHandler</code> to their top-level logger.</p>', lvl: 'core' },
    { q: 'What are structured logs and how do you produce them in Python?', a: '<p>One machine-parseable event per line (usually JSON) with stable keys: timestamp, level, logger, message, plus fields such as <code>order_id</code> or <code>request_id</code>. Platforms index the fields, so you can query instead of grepping. In stdlib logging: a JSON <code>Formatter</code>, data passed through <code>extra={...}</code>, and a <code>Filter</code> that stamps context from <code>contextvars</code>. Libraries such as structlog or python-json-logger package this up. Keep messages constant (“order paid”) and put variables in fields.</p>', lvl: 'core' },
    { q: 'How do you add a request ID to every log line in an async service?', a: '<p>Set a <code>contextvars.ContextVar</code> in middleware at the start of each request (from an incoming <code>X-Request-ID</code> or trace header, or a new UUID). A logging <code>Filter</code> on the handler copies it onto each record. Context variables are copied into each asyncio task, so concurrent requests don’t mix, which a thread-local would get wrong under asyncio. With OpenTelemetry, use the trace and span IDs from the current span instead.</p>', lvl: 'deep' },
    { q: 'How do you keep logging from slowing down a hot path or an event loop?', a: '<p>Use lazy %-style arguments, set sensible levels, and avoid expensive <code>extra</code> values. Handlers that do network I/O (HTTP, syslog over TCP) can block, which is especially bad on an event loop. Put a <code>QueueHandler</code> on the logger and run the real handlers in a <code>QueueListener</code> thread. In containers, log to stdout and let the platform ship the logs.</p>', lvl: 'deep' },
    { q: '<code>raise</code> vs <code>raise e</code> vs <code>raise NewError() from e</code>?', a: '<p>A bare <code>raise</code> inside <code>except</code> re-raises the current exception unchanged. <code>raise e</code> re-raises the same object; its traceback gains the current line but otherwise keeps its history. <code>raise NewError(...) from e</code> creates a new exception that names <code>e</code> as its cause: the right choice for translating between layers. To add context without changing the type, use <code>e.add_note(...)</code> (3.11+) and a bare <code>raise</code>.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Logging setup (JSON + request id)', lang: 'python', code: `# app/logsetup.py: call configure() once, at the very start of main / the app factory
import contextvars
import json
import logging
import logging.config

request_id: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")

class ContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id.get()
        return True

_RESERVED = set(vars(logging.makeLogRecord({}))) | {"message", "asctime"}

class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        doc = {
            "ts": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        doc.update({k: v for k, v in vars(record).items() if k not in _RESERVED})
        if record.exc_info:
            doc["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(doc, default=str)

def configure(level: str = "INFO") -> None:
    logging.config.dictConfig({
        "version": 1,
        "disable_existing_loggers": False,
        "filters": {"ctx": {"()": ContextFilter}},
        "formatters": {"json": {"()": JsonFormatter}},
        "handlers": {"stdout": {"class": "logging.StreamHandler", "stream": "ext://sys.stdout",
                                "formatter": "json", "filters": ["ctx"]}},
        "root": {"level": level, "handlers": ["stdout"]},
        "loggers": {"uvicorn.access": {"level": "WARNING"}, "httpx": {"level": "WARNING"}},
    })

# FastAPI middleware:
# @app.middleware("http")
# async def add_request_id(request, call_next):
#     token = request_id.set(request.headers.get("x-request-id") or uuid.uuid4().hex)
#     try:
#         return await call_next(request)
#     finally:
#         request_id.reset(token)` },
    { title: 'Domain errors at the boundary', lang: 'python', code: `import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

log = logging.getLogger(__name__)

class OrdersError(Exception):
    status = 500
    code = "internal"

class OrderNotFound(OrdersError):
    status, code = 404, "order_not_found"
    def __init__(self, order_id: int):
        super().__init__(f"order {order_id} not found")
        self.order_id = order_id

class PaymentDeclined(OrdersError):
    status, code = 402, "payment_declined"

def charge(order, psp):
    try:
        return psp.charge(order.total_cents, order.card_token)
    except psp.CardError as e:                       # vendor type stays at the edge
        raise PaymentDeclined(str(e)) from e

def install_handlers(app: FastAPI) -> None:
    @app.exception_handler(OrdersError)
    async def orders_error(request: Request, exc: OrdersError) -> JSONResponse:
        if exc.status >= 500:
            log.error("unhandled domain error", exc_info=exc)
        return JSONResponse({"type": exc.code, "detail": str(exc)}, status_code=exc.status)` },
    { title: 'except* with TaskGroup', lang: 'python', code: `import asyncio
import logging

log = logging.getLogger(__name__)

async def call_tools(query: str, tools) -> dict[str, str]:
    results: dict[str, str] = {}
    try:
        async with asyncio.TaskGroup() as tg:
            tasks = {t.name: tg.create_task(t.call(query)) for t in tools}
    except* TimeoutError as eg:
        log.warning("%d tool(s) timed out", len(eg.exceptions))
        for exc in eg.exceptions:
            log.warning("timeout detail: %s", getattr(exc, "__notes__", []))
        raise ToolsUnavailable("retry later") from eg
    except* ValueError as eg:
        raise BadToolOutput(eg.exceptions[0]) from eg
    for name, task in tasks.items():
        results[name] = task.result()
    return results` },
    { title: 'Java comparison', lang: 'java', code: `// Java                                         // Python
try { load(); }                                 // try:
catch (IOException e) {                         //     load()
  throw new ConfigException("bad", e);          // except OSError as e:
}                                               //     raise ConfigError("bad") from e
// e.getCause()                                 // err.__cause__  (and implicit __context__)
// e.addSuppressed(other)                       // ExceptionGroup / e.add_note(...)
// checked exceptions: compiler-enforced        // none: document & test failure modes
// catch (Exception e) also catches             // except Exception does NOT catch
//   InterruptedException (checked)              //   KeyboardInterrupt, SystemExit, CancelledError

// SLF4J + Logback                              // logging
Logger log = LoggerFactory.getLogger(X.class);  // log = logging.getLogger(__name__)
log.info("order {} paid", id);                  // log.info("order %s paid", id)
log.error("charge failed", e);                  // log.exception("charge failed")
MDC.put("requestId", rid);                      // contextvars + logging.Filter
// logback.xml appenders / encoders             // dictConfig handlers / formatters
// additivity="false"                           // logger.propagate = False`, note: 'Logback’s additivity and Python’s propagation are the same idea: by default an event goes to the appenders/handlers of every ancestor.' }
  ]
});

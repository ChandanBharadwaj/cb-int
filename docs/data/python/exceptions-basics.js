IA.register({
  track: 'python',
  slug: 'exceptions-basics',
  title: 'Errors & exceptions',
  tagline: 'Python’s <code>try / except / else / finally</code> is Java’s <code>try / catch / finally</code> plus an <code>else</code> for the success path. There are <b>no checked exceptions</b>: nothing forces you to catch or declare anything, so knowing <i>what</i> to catch, and where, is on you.',
  tldr: {
    problem: 'Beginner Python either crashes on the first bad input or wraps everything in <code>except Exception: pass</code> and hides real bugs. Both come from not knowing how the clauses run and which exceptions to expect.',
    model: 'When something raises, the rest of the <code>try</code> body is skipped and Python checks the <code>except</code> clauses <b>top to bottom</b>; the first matching type (or parent type) handles it. <code>else</code> runs only if nothing was raised. <code>finally</code> runs <b>always</b>. Unhandled exceptions travel up the call stack until something catches them, or the program prints a traceback and exits.',
    hook: '“Why use <code>else</code>?” So that only the risky line is inside <code>try</code>. Code in <code>else</code> isn’t protected by the handlers, so its own bugs aren’t mistaken for the error you meant to catch.',
    facts: [
      { v: '0', l: 'checked exceptions in Python: there is no <code>throws</code> clause. Docstrings and type-checker plugins are the only “contract”' },
      { v: 'Exception', l: 'is the base for normal errors. <code>BaseException</code> also covers <code>KeyboardInterrupt</code> and <code>SystemExit</code>, which a bare <code>except:</code> would swallow' },
      { v: '3.11', l: 'added <code>ExceptionGroup</code>, <code>except*</code> and <code>e.add_note()</code>. 3.14 warns about <code>return</code>/<code>break</code> inside <code>finally</code> (PEP 765)' }
    ]
  },
  intro: {
    what: 'When Python hits something it can’t do (turning <code>"abc"</code> into a number, dividing by zero, reading a missing file) it <b>raises an exception</b>: an object describing what went wrong. If nothing handles it, the program stops and prints a <b>traceback</b>. A <code>try</code> block lets you catch specific exceptions and decide what to do instead.',
    analogy: { icon: '🧯', title: 'A fire alarm in a building', text: 'Normal work happens on each floor (<code>try</code>). When an alarm goes off, work on that floor stops immediately. Each floor has wardens trained for certain alarms (<code>except ValueError</code>); if none on this floor match, the alarm goes up to the floor above (the caller). Whatever happens, the doors are locked on the way out (<code>finally</code>). If the alarm reaches the roof with no warden, the building is evacuated (the program crashes).' },
    steps: [
      { t: 'An error stops the program', d: 'Read tracebacks from the <b>bottom</b>: the last line is the error type and message.', code: '>>> int("abc")\nTraceback (most recent call last):\n  File "<stdin>", line 1, in <module>\nValueError: invalid literal for int() with base 10: \'abc\'' },
      { t: 'Catch what you expect', d: 'Name the exception type. Java: <code>catch (NumberFormatException e)</code>.', code: 'try:\n    age = int(text)\nexcept ValueError:\n    age = 0' },
      { t: 'else and finally', d: '<code>else</code>: only on success. <code>finally</code>: always.', code: 'try:\n    f = open(path)\nexcept FileNotFoundError:\n    print("missing")\nelse:\n    print(f.read())\n    f.close()\nfinally:\n    print("done")' },
      { t: 'Raise your own', d: '<code>raise</code> is Java’s <code>throw</code>. There is no <code>new</code>.', code: 'if amount <= 0:\n    raise ValueError(f"amount must be positive, got {amount}")' },
      { t: 'Define your own types', d: 'Subclass <code>Exception</code>. Usually the body is just <code>pass</code>.', code: 'class PaymentError(Exception):\n    pass\n\nclass CardDeclined(PaymentError):\n    pass' }
    ],
    terms: [
      ['exception', 'An object describing an error. Raising it interrupts normal flow.'],
      ['traceback', 'The printed call chain at the point of error. Most recent call is <b>last</b> (Java prints it first).'],
      ['raise', 'Throw an exception: <code>raise ValueError("msg")</code>. Bare <code>raise</code> inside <code>except</code> re-raises the current one.'],
      ['except T as e', 'Catch type T (and its subclasses) and bind the object to <code>e</code>.'],
      ['finally', 'Cleanup that runs no matter how the block exits.'],
      ['raise … from …', 'Raise a new exception and record the original as its <code>__cause__</code>, like Java’s <code>new X(msg, cause)</code>.']
    ]
  },
  visual: {
    title: 'Where does the exception go?',
    caption: 'One function, four inputs. Pick an input and press <b>Play</b> or <b>Step</b>. Watch which lines run, the exception travelling (red) or being caught (green), the pending return value, and <code>finally</code> running on every path. The last input is never caught and crashes the program.'
  },
  playground: {
    kind: 'python',
    presets: [
      { label: 'try / except / else / finally', code: `def parse(text):
    try:
        n = int(text)
    except ValueError as e:
        print(f"  except: {e}")
        return None
    else:
        print("  else: parsed fine")
        return n
    finally:
        print("  finally: always")

for t in ["42", "4x2"]:
    print(f"parse({t!r}):")
    print("  ->", parse(t))`, note: 'The order is always: try, then except <i>or</i> else, then finally, then the return happens.' },
      { label: 'Multiple excepts', code: `def ratio(a, b):
    try:
        return int(a) / int(b)
    except (ValueError, TypeError) as e:     # a tuple catches either
        return f"bad input: {type(e).__name__}"
    except ZeroDivisionError:
        return "division by zero"

for args in [("6", "3"), ("6", "0"), ("six", "3"), (None, "3")]:
    print(args, "->", ratio(*args))

# order matters: the first matching clause wins
try:
    {}["missing"]
except LookupError:                  # parent of KeyError and IndexError
    print("LookupError caught the KeyError")
except KeyError:
    print("never reached")`, note: 'Put specific types before general ones.' },
      { label: 'Custom exceptions', code: `class PaymentError(Exception):
    """Base for everything the payments module raises."""

class CardDeclined(PaymentError):
    def __init__(self, code, message="card declined"):
        super().__init__(f"{message} (code={code})")
        self.code = code

class InsufficientFunds(PaymentError):
    pass

def charge(amount, card):
    if amount <= 0:
        raise ValueError("amount must be positive")      # programming error
    if card == "0000":
        raise CardDeclined(code="05")
    if amount > 100:
        raise InsufficientFunds(f"needs {amount}, has 100")
    return "ok"

for amount, card in [(50, "4242"), (50, "0000"), (500, "4242")]:
    try:
        print(charge(amount, card))
    except CardDeclined as e:
        print("declined, code", e.code, "|", e)
    except PaymentError as e:                            # any other payment error
        print(type(e).__name__, "|", e)`, note: 'One base class per module lets callers catch “anything from payments” with one clause.' },
      { label: 'raise from & chaining', code: `import json

class ConfigError(Exception):
    pass

def load_config(text):
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ConfigError("config is not valid JSON") from e

try:
    load_config("{bad json")
except ConfigError as e:
    print("error:", e)
    print("cause:", type(e.__cause__).__name__, "-", e.__cause__)

# without 'from', Python still links them via __context__
try:
    try:
        1 / 0
    except ZeroDivisionError:
        raise RuntimeError("while computing")
except RuntimeError as e:
    print("context:", repr(e.__context__))`, note: 'In a real traceback both errors are printed: “The above exception was the direct cause of…”.' },
      { label: 'Traceback & notes (3.11+)', code: `import traceback

def level3(): return {"a": 1}["b"]
def level2(): return level3()
def level1(): return level2()

try:
    level1()
except KeyError as e:
    e.add_note("while reading the user profile")      # 3.11+
    traceback.print_exc()                             # goes to stderr
    print("handled, program continues")`, note: 'Read it bottom-up: the last frame is where it failed. The note appears under the error line.' },
      { label: 'EAFP vs LBYL', code: `config = {"port": "8080"}

# LBYL: "look before you leap" (Java style)
if "host" in config:
    host = config["host"]
else:
    host = "localhost"

# EAFP: "easier to ask forgiveness than permission" (common in Python)
try:
    port = int(config["port"])
except (KeyError, ValueError):
    port = 80

# often a built-in does it for you
timeout = config.get("timeout", "30")
print(host, port, timeout)`, note: 'Both are fine. EAFP avoids races (a file deleted between the check and the open) and double lookups.' }
    ]
  },
  gotchas: [
    { trap: 'Bare except or except Exception: pass', code: `try:
    process(order)
except:            # also catches KeyboardInterrupt and SystemExit
    pass           # and hides the bug forever`, why: 'A bare <code>except:</code> catches <code>BaseException</code>, so Ctrl-C and <code>sys.exit()</code> stop working. <code>except Exception: pass</code> is narrower but still hides typos like <code>NameError</code> and <code>AttributeError</code>.', fix: 'Catch the specific exceptions you expect. At top-level boundaries (a request handler, a worker loop), catch <code>Exception</code>, <b>log it with the traceback</b> (<code>logger.exception</code>), and keep going.' },
    { trap: 'Too much code inside try', code: `try:
    user = repo.get(uid)
    send_email(user.emial)     # typo → AttributeError
except AttributeError:
    user = None                # silently treated as "no user"`, why: 'The handler was meant for one line but covers all of them, so an unrelated bug is caught as if it were the expected case.', fix: 'Keep only the risky call in <code>try</code> and move the follow-up into <code>else</code>.' },
    { trap: 'General except before specific', code: `try:
    int(x)
except Exception:
    ...
except ValueError:      # dead code: never reached
    ...`, why: 'Clauses are tested in order and the first match wins. Unlike Java, Python does not reject an unreachable catch at compile time.', fix: 'Order clauses from most specific to most general.' },
    { trap: '<code>raise e</code> or a new exception that loses the original', code: `except KeyError as e:
    raise ConfigError("missing key")     # cause only implicit
except KeyError as e:
    raise ConfigError("missing key") from e   # explicit cause`, why: 'Python attaches the original as <code>__context__</code> anyway, but <code>from e</code> states the intent and the traceback says “direct cause”. To re-raise the <i>same</i> error, use bare <code>raise</code>.', fix: 'Use <code>raise</code> to re-throw, <code>raise New(...) from e</code> to translate, and <code>from None</code> only to deliberately hide an irrelevant inner error.' },
    { trap: 'return inside finally swallows the exception', code: `def f():
    try:
        raise ValueError("lost")
    finally:
        return "ok"      # the ValueError disappears`, why: 'A <code>return</code>, <code>break</code> or <code>continue</code> in <code>finally</code> discards any exception in flight and overrides an earlier return value. Python 3.14 emits a <code>SyntaxWarning</code> for this (PEP 765).', fix: 'Use <code>finally</code> only for cleanup. Never return from it.' },
    { trap: 'Using the exception variable after the block', code: `try:
    1 / 0
except ZeroDivisionError as e:
    pass
print(e)    # NameError: name 'e' is not defined`, why: 'Python deletes the <code>as</code> name at the end of the <code>except</code> block, to break a reference cycle through the traceback.', fix: 'Copy what you need into another variable inside the block: <code>err = e</code> or <code>msg = str(e)</code>.' }
  ],
  scenarios: [
    { title: 'Orders silently stop syncing',
      symptom: 'A sync worker runs “successfully” every minute but no new orders reach the warehouse for two days. No errors in the logs.',
      diagnose: `for order in fetch_new_orders():
    try:
        push_to_warehouse(order)
    except Exception:
        pass                    # "don't let one bad order stop the loop"`,
      cause: 'A config change made <code>push_to_warehouse</code> raise <code>AuthenticationError</code> for every order. The blanket handler hid it.',
      fix: 'Keep the loop resilient but make failures visible: log with traceback, count them, and fail loudly when everything fails.',
      fixCode: `import logging
log = logging.getLogger("sync")

failed = 0
for order in fetch_new_orders():
    try:
        push_to_warehouse(order)
    except WarehouseRejected as e:          # expected, per-order problem
        log.warning("order %s rejected: %s", order.id, e)
        failed += 1
    except Exception:                       # unexpected: log the traceback
        log.exception("order %s failed", order.id)
        failed += 1
if failed and failed == len(orders):
    raise RuntimeError("all orders failed; check credentials")` },
    { title: 'Ctrl-C and container stop don’t stop the worker',
      symptom: 'A batch script ignores Ctrl-C locally and needs <code>kill -9</code>. In Kubernetes, pods hang until the termination grace period expires.',
      diagnose: `while True:
    try:
        job = queue.get(timeout=5)
        handle(job)
    except:                     # bare except
        continue`,
      cause: 'The bare <code>except:</code> catches <code>KeyboardInterrupt</code> (Ctrl-C) and <code>SystemExit</code> (raised by <code>sys.exit()</code>, for example from a signal handler) and loops forever.',
      fix: 'Catch <code>Exception</code>, which excludes those two, and let shutdown signals propagate.',
      fixCode: `while True:
    try:
        job = queue.get(timeout=5)
    except queue_module.Empty:
        continue
    try:
        handle(job)
    except Exception:
        log.exception("job %s failed", job.id)` }
  ],
  puzzles: [
    { kind: 'output', q: 'Which clauses run, in what order?', code: `def f():
    try:
        print("try")
    except ValueError:
        print("except")
    else:
        print("else")
    finally:
        print("finally")

f()`, options: ['try\nelse\nfinally', 'try\nfinally', 'try\nexcept\nfinally', 'try\nfinally\nelse'], answer: 0, run: true, expect: 'try\nelse\nfinally', explain: 'Nothing was raised, so <code>except</code> is skipped and <code>else</code> runs. <code>finally</code> always runs last.' },
    { kind: 'output', q: 'Return in try, return in finally:', code: `def f():
    try:
        return "try"
    finally:
        return "finally"

print(f())`, options: ['finally', 'try', 'try finally', 'SyntaxError'], answer: 0, run: true, expect: 'finally', explain: 'The return from <code>try</code> is pending when <code>finally</code> runs, and finally’s own <code>return</code> replaces it. Python 3.14 also prints a <code>SyntaxWarning</code> to stderr for this pattern; stdout is the same.' },
    { kind: 'output', q: 'Two except clauses. Which one handles it?', code: `try:
    int("x")
except Exception:
    print("Exception")
except ValueError:
    print("ValueError")`, options: ['Exception', 'ValueError', 'Exception\nValueError', 'SyntaxError: unreachable except'], answer: 0, run: true, expect: 'Exception', explain: '<code>ValueError</code> is a subclass of <code>Exception</code>, and clauses are checked top to bottom. The first match wins; Python doesn’t flag the dead clause.' },
    { kind: 'output', q: 'Catching by base class:', code: `class AppError(Exception):
    pass

class NotFound(AppError):
    pass

try:
    raise NotFound("user 7")
except AppError as e:
    print(type(e).__name__, e)`, options: ['NotFound user 7', 'AppError user 7', 'NotFound', "NotFound('user 7')"], answer: 0, run: true, expect: 'NotFound user 7', explain: 'The handler matches subclasses, but <code>e</code> is still the actual <code>NotFound</code> object. <code>str(e)</code> is the message.' },
    { kind: 'output', q: 'After the except block:', code: `try:
    1 / 0
except ZeroDivisionError as e:
    msg = str(e)

print(msg)
try:
    print(e)
except NameError:
    print("e is gone")`, options: ['division by zero\ne is gone', 'division by zero\ndivision by zero', 'ZeroDivisionError\ne is gone', 'NameError: msg'], answer: 0, run: true, expect: 'division by zero\ne is gone', explain: 'Python deletes the <code>as e</code> name when the except block ends. <code>msg</code> is an ordinary variable and survives.' },
    { kind: 'output', q: 'raise … from …:', code: `try:
    try:
        {}["k"]
    except KeyError as e:
        raise ValueError("bad config") from e
except ValueError as e:
    print(e, "|", repr(e.__cause__))`, options: ["bad config | KeyError('k')", 'bad config | None', "KeyError('k') | bad config", "bad config | ValueError('bad config')"], answer: 0, run: true, expect: "bad config | KeyError('k')", explain: '<code>from e</code> stores the original exception in <code>__cause__</code> on the new one.' },
    { kind: 'output', q: 'finally with break in a loop:', code: `for i in range(3):
    try:
        if i == 1:
            break
        print("body", i)
    finally:
        print("finally", i)`, options: ['body 0\nfinally 0\nfinally 1', 'body 0\nfinally 0', 'body 0\nfinally 0\nbody 1\nfinally 1', 'body 0\nfinally 0\nfinally 1\nfinally 2'], answer: 0, run: true, expect: 'body 0\nfinally 0\nfinally 1', explain: '<code>finally</code> runs on every way out of the try, including <code>break</code>. The loop then ends, so i=2 never runs.' },
    { kind: 'concept', q: 'Why is a bare <code>except:</code> considered dangerous?', options: ['It catches BaseException, including KeyboardInterrupt and SystemExit, so the program can’t be stopped normally', 'It is a syntax error in Python 3', 'It only catches the last exception type that was raised', 'It disables finally blocks'], answer: 0, explain: 'Bare <code>except:</code> is legal and equals <code>except BaseException:</code>. Use <code>except Exception:</code> when you truly need a catch-all, and log the error.' }
  ],
  interview: [
    { q: 'Explain try / except / else / finally.', a: '<ul><li><code>try</code>: code that might raise.</li><li><code>except T</code>: runs if a <code>T</code> (or subclass) was raised; first matching clause wins.</li><li><code>else</code>: runs only if <code>try</code> raised nothing. Its errors are not caught by the handlers above.</li><li><code>finally</code>: runs always, including after <code>return</code>, <code>break</code> or an unhandled exception.</li></ul>', lvl: 'core' },
    { q: 'How do Python exceptions differ from Java’s?', a: '<ul><li>No checked exceptions and no <code>throws</code> clause.</li><li><code>raise</code> instead of <code>throw</code>, no <code>new</code>.</li><li>An <code>else</code> clause exists.</li><li>Tracebacks print the most recent call <b>last</b>.</li><li>Exceptions are routinely used for control flow (EAFP, <code>StopIteration</code>), and raising and catching is relatively cheap.</li></ul>', lvl: 'core' },
    { q: 'How do you write a custom exception? When should you?', a: '<p>Subclass <code>Exception</code> (never <code>BaseException</code>): <code>class OrderError(Exception): pass</code>. Add attributes in <code>__init__</code> if callers need data such as an error code, and call <code>super().__init__(message)</code>. Give each library or module one base exception with specific subclasses, so callers can catch broadly or narrowly.</p>', lvl: 'core' },
    { q: 'What’s the difference between <code>raise</code>, <code>raise e</code> and <code>raise X from e</code>?', a: '<p>Bare <code>raise</code> re-raises the current exception unchanged. <code>raise e</code> also re-raises it, adding the current line to its traceback. <code>raise X from e</code> raises a new exception and sets <code>X.__cause__ = e</code>, so the traceback shows both: the Python version of wrapping with a cause in Java. <code>from None</code> suppresses the context.</p>', lvl: 'core' },
    { q: 'What does <code>except Exception</code> not catch?', a: '<p>Anything that derives from <code>BaseException</code> but not <code>Exception</code>: mainly <code>KeyboardInterrupt</code>, <code>SystemExit</code> and <code>GeneratorExit</code>. That’s deliberate; those are signals to stop, not errors to handle. (<code>asyncio.CancelledError</code> also derives from <code>BaseException</code> since 3.8.)</p>', lvl: 'core' },
    { q: 'What are EAFP and LBYL?', a: '<p><b>LBYL</b> (look before you leap): check first, e.g. <code>if key in d</code>. <b>EAFP</b> (easier to ask forgiveness than permission): just do it and catch the failure. Python culture leans to EAFP because it avoids check-then-act races (files, network) and double lookups. Use whichever is clearer.</p>', lvl: 'core' },
    { q: 'Name some built-in exceptions you meet daily.', a: '<p><code>ValueError</code> (right type, bad value: <code>int("x")</code>), <code>TypeError</code> (wrong type: <code>"a" + 1</code>), <code>KeyError</code> and <code>IndexError</code> (both <code>LookupError</code>), <code>AttributeError</code>, <code>NameError</code>, <code>FileNotFoundError</code> (an <code>OSError</code>), <code>ZeroDivisionError</code>, <code>StopIteration</code>.</p>', lvl: 'core' },
    { q: 'Why is <code>e</code> undefined after the except block?', a: '<p>The exception holds its traceback, and the traceback holds the frame, which holds <code>e</code>: a reference cycle that would keep every local variable alive. Python deletes the name at the end of the handler to break it.</p>', lvl: 'deep' },
    { q: 'What are ExceptionGroup and <code>except*</code> (3.11+)?', a: '<p>An <code>ExceptionGroup</code> bundles several exceptions raised together, for example by tasks in an <code>asyncio.TaskGroup</code>. <code>except* ValueError</code> handles the matching members of a group and lets the rest continue propagating. Several <code>except*</code> clauses can run for one group.</p>', lvl: 'deep' },
    { q: 'Where should exceptions be caught in a service?', a: '<p>Low-level code raises specific exceptions and usually doesn’t catch them, except to translate (<code>raise DomainError(...) from e</code>) or to clean up. A boundary (HTTP handler, message consumer, CLI <code>main</code>) catches broadly, logs with the traceback, maps to a response or exit code, and keeps the process alive. See <a href="errors-logging.html">Errors &amp; logging</a>.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Java', lang: 'java', code: `// Java 21
public class PaymentException extends RuntimeException {
    public PaymentException(String msg, Throwable cause) { super(msg, cause); }
}

try {
    int n = Integer.parseInt(text);
    process(n);
} catch (NumberFormatException e) {
    log.warn("bad input {}", text);
} catch (IOException | TimeoutException e) {
    throw new PaymentException("gateway failed", e);
} finally {
    metrics.done();
}`, note: 'Multi-catch, wrapping with a cause, finally.' },
    { title: 'Python', lang: 'python', code: `class PaymentError(Exception):
    pass

try:
    n = int(text)
except ValueError:
    log.warning("bad input %s", text)
else:
    try:
        process(n)
    except (OSError, TimeoutError) as e:          # tuple = multi-catch
        raise PaymentError("gateway failed") from e   # = new X(msg, cause)
finally:
    metrics.done()`, note: 'The <code>else</code> keeps <code>process(n)</code> outside the <code>ValueError</code> handler.' },
    { title: 'Agent code: retry a flaky tool call', lang: 'python', code: `import time


class ToolError(Exception):
    """A tool failed in a way the agent should see."""


class TransientError(ToolError):
    """Safe to retry: timeouts, 429s, 503s."""


def call_with_retry(fn, *args, attempts=3, base_delay=0.5):
    for attempt in range(1, attempts + 1):
        try:
            return fn(*args)
        except TransientError as e:
            if attempt == attempts:
                raise ToolError(f"gave up after {attempts} attempts") from e
            time.sleep(base_delay * 2 ** (attempt - 1))   # 0.5, 1, 2 …
        # any other exception propagates immediately: it is a bug, not flakiness`, note: 'Retry only what is retryable; translate the final failure with <code>from e</code> so the cause stays in the traceback.' }
  ]
});

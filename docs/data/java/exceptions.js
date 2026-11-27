IA.register({
  track: 'java',
  slug: 'exceptions',
  title: 'Exceptions done right',
  tagline: 'An exception is a value <b>in flight</b>, travelling up through the methods that called each other. <code>finally</code> can replace it. <code>close()</code> can hide it. A careless wrapper can drop its cause. A framework can decide whether your transaction commits. Learn what each construct does to it.',
  tldr: {
    problem: 'Root causes vanish from the logs. Transactions commit after a failure. Scheduled jobs stop with no error. Every layer logs the same stack trace three times.',
    model: 'A method ends <b>normally</b> or <b>abruptly</b>. Either a return value or an exception is waiting to leave. <code>finally</code> always runs and can <i>replace</i> it. Try-with-resources closes in reverse order. It attaches close failures to the main exception (<b>suppressed</b>). At layer boundaries, wrap exceptions and always pass the cause.',
    hook: '“What does <code>try { return 1; } finally { return 2; }</code> return?” 2. If the try block had thrown, that exception would vanish too.',
    facts: [
      { v: 'Java 7', l: 'added try-with-resources, <code>Throwable.addSuppressed</code> and multi-catch. Java 9 allowed an effectively final variable as the resource: <code>try (conn) { … }</code>' },
      { v: 'unchecked → rollback', l: 'Spring’s <code>@Transactional</code> rolls back on <code>RuntimeException</code> and <code>Error</code> by default, but <b>commits</b> on checked exceptions unless you set <code>rollbackFor</code>' },
      { v: 'OmitStackTraceInFastThrow', l: 'is on by default in HotSpot. If hot code throws the same built-in exception (NPE, ArithmeticException…) many times, the JVM may reuse one with no stack trace' }
    ]
  },
  intro: {
    what: 'When something goes wrong, Java code <b>throws</b> an exception object. The JVM exits methods one by one until it finds a matching <code>catch</code>. You must catch <b>checked</b> exceptions (like <code>IOException</code>) or declare them with <code>throws</code>. <b>Unchecked</b> ones (<code>RuntimeException</code> and its subclasses) need neither. A <code>finally</code> block runs on success or failure. That makes it the place for cleanup.',
    analogy: { icon: '📦', title: 'A parcel passed up a chain of managers', text: 'A problem report travels up the org chart until someone can handle it. Each manager can handle it or pass it on. They can also put it in a new envelope in their team’s terms (translation), with the original inside. The disaster is a manager who swaps the parcel, or shreds it on the way out (finally).' },
    steps: [
      { t: 'throw and catch', d: 'The nearest <code>catch</code> with a matching type handles it. List more specific types first.', code: 'try {\n  pay(order);\n} catch (CardDeclinedException e) {\n  notifyCustomer(e);\n} catch (PaymentException e) {\n  retryLater(e);\n}' },
      { t: 'checked vs unchecked', d: 'Checked exceptions are part of the method signature. Unchecked ones usually mean a bug, or a failure the caller can’t fix.' },
      { t: 'finally always runs', d: 'Except when the JVM exits or the thread dies. Use it for cleanup only: never <code>return</code> or <code>throw</code> from it.' },
      { t: 'try-with-resources', d: 'Anything <code>AutoCloseable</code> opened in the header is closed for you, in reverse order, even if the body throws.', code: 'try (var in = Files.newBufferedReader(path)) {\n  return in.readLine();\n}' },
      { t: 'Keep the cause', d: 'When you wrap an exception, pass the original: <code>new OrderException("save failed", e)</code>. Stack traces then print a “Caused by” chain.' }
    ],
    terms: [
      ['checked exception', 'A subclass of <code>Exception</code> that isn’t a <code>RuntimeException</code>. The compiler forces callers to handle or declare it.'],
      ['unchecked exception', '<code>RuntimeException</code>, <code>Error</code> and their subclasses. They need no declaration.'],
      ['stack unwinding', 'Leaving methods one by one, running their finally blocks, until a handler is found.'],
      ['suppressed exception', 'A second failure (usually from <code>close()</code>) attached to the main exception.'],
      ['cause', 'The exception that led to this one, set via the constructor or <code>initCause</code>.'],
      ['exception translation', 'Catching a low-level exception and rethrowing one that fits the current layer, with the original as its cause.']
    ]
  },
  visual: {
    title: 'What is in flight right now?',
    caption: 'Press <b>Play</b> and watch the <b>in flight</b> box: the pending return value or exception. <b>finally swallows</b> and <b>Masked by close()</b> show it being replaced. <b>try-with-resources</b> shows reverse-order closing and suppressed exceptions. <b>Exception translation</b> shows a cause chain crossing layers.'
  },
  gotchas: [
    { trap: '<code>return</code> or <code>throw</code> inside <code>finally</code>', code: `try {
  return charge(card);          // throws PaymentException
} finally {
  return Result.UNKNOWN;        // exception discarded, caller sees UNKNOWN
}`, why: 'A <code>return</code> or <code>throw</code> in finally replaces whatever was leaving. A thrown exception disappears. So does a return value.', fix: 'Use finally only for cleanup that can’t fail, or use try-with-resources. Compile with <code>-Xlint:finally</code> (or <code>-Xlint:all</code>) and treat warnings as errors.' },
    { trap: 'Wrapping without the cause', code: `catch (SQLException e) {
  throw new OrderException("save failed: " + e.getMessage());   // stack trace and SQL state lost
}`, why: 'The new exception’s stack trace starts in the catch block. The original type, SQL state and frames are gone.', fix: 'Always chain: <code>throw new OrderException("save order " + id, e);</code>. JDK exceptions have a <code>(String, Throwable)</code> constructor. Give yours one too.' },
    { trap: 'Checked exceptions commit the transaction', code: `@Transactional
public void settle(Payment p) throws GatewayException {
  repo.markPaid(p);
  gateway.capture(p);           // throws GatewayException (checked) → COMMIT`, why: 'By default Spring rolls back on RuntimeException and Error. It commits on checked exceptions.', fix: '<code>@Transactional(rollbackFor = Exception.class)</code>, or wrap it in an unchecked exception inside the method.' },
    { trap: 'Log-and-rethrow at every layer', code: `catch (Exception e) {
  log.error("failed", e);       // logged here…
  throw e;                      // …and again by the caller, and again by the controller`, why: 'One failure becomes three or four stack traces, often with different messages. Alerts multiply and the real one is hard to find.', fix: 'Either handle it (log and recover) or pass it on (wrap it with context). Log once, at the edge: the <code>@RestControllerAdvice</code>, the message listener, or the job runner.' },
    { trap: 'Swallowing <code>InterruptedException</code>', code: `try { Thread.sleep(backoff); }
catch (InterruptedException e) { }   // shutdown request lost`, why: 'Catching it clears the thread’s interrupt flag. Executors use that flag to cancel work. So the thread keeps running through a shutdown.', fix: 'Restore the flag and stop: <code>Thread.currentThread().interrupt(); return;</code>, or let it pass up.' },
    { trap: 'Exceptions that disappear in executors', code: `executor.submit(() -> process(batch));      // exception stored in the Future, never read
scheduler.scheduleAtFixedRate(job, 0, 1, MINUTES);   // one throw → no more runs`, why: '<code>submit</code> stores the exception in the returned Future, and nobody calls <code>get()</code>. With <code>scheduleAtFixedRate</code>, one throw silently cancels all later runs.', fix: 'Use <code>execute</code> with an <code>UncaughtExceptionHandler</code>. Check your Futures. Wrap scheduled job bodies in a try/catch that logs and carries on.' },
    { trap: 'NPEs with no stack trace', code: `java.lang.NullPointerException      ← no "at …" lines at all`, why: 'With <code>-XX:+OmitStackTraceInFastThrow</code> (the default), hot code that keeps throwing the same built-in exception may reuse one with no stack trace.', fix: 'Search earlier logs for the first ones, which still have traces, or run with <code>-XX:-OmitStackTraceInFastThrow</code>. Java 14+ helpful NPE messages need the real exception.' }
  ],
  scenarios: [
    { title: 'Orders marked PAID although the card capture failed',
      symptom: 'Customers received goods that were never paid for. The logs showed <code>GatewayException: capture declined</code>, but the database said <code>PAID</code>.',
      diagnose: `@Transactional
public void settle(long orderId) throws GatewayException {
  Order o = orders.findById(orderId).orElseThrow();
  o.markPaid();                       // UPDATE pending, flushed at commit
  gateway.capture(o.paymentRef());    // throws checked GatewayException
}`,
      cause: 'The method exited with a <b>checked</b> exception. By default Spring commits then, so the UPDATE was saved. The exception still reached the caller, so it looked as if nothing had been saved.',
      fix: 'Charge the card first, then mark paid. Or roll back on every exception. Keep calls to other systems out of long transactions where you can.',
      fixCode: `@Transactional(rollbackFor = Exception.class)
public void settle(long orderId) throws GatewayException {
  Order o = orders.findById(orderId).orElseThrow();
  gateway.capture(o.paymentRef());    // fail before changing state
  o.markPaid();
}` },
    { title: 'The nightly cleanup job stopped running, and nothing said why',
      symptom: 'Expired sessions piled up for nine days. The scheduler thread was alive. The logs showed no errors. The metrics stopped.',
      diagnose: `scheduler.scheduleAtFixedRate(this::purgeExpired, 0, 1, TimeUnit.HOURS);

void purgeExpired() {
  var cutoff = clock.instant().minus(ttl);
  repo.deleteOlderThan(cutoff);       // threw once: DB failover
}`,
      cause: 'One run threw during a database failover. <code>ScheduledExecutorService</code> stores that exception in the task’s Future and <b>suppresses all later executions</b>. Nobody read the Future, so nothing was logged.',
      fix: 'Catch and log inside the job, so one bad run doesn’t end the schedule. In Spring, <code>@Scheduled</code> methods already log errors and keep running.',
      fixCode: `scheduler.scheduleAtFixedRate(() -> {
  try {
    purgeExpired();
  } catch (Exception e) {
    log.error("purge failed; will retry next run", e);
    metrics.counter("purge.failures").increment();
  }
}, 0, 1, TimeUnit.HOURS);` },
    { title: 'Thousands of NullPointerExceptions with no stack trace',
      symptom: 'The error dashboard showed a flood of <code>java.lang.NullPointerException</code> lines with no stack and no message. Nobody could tell which code threw them.',
      diagnose: `$ grep -n "NullPointerException" app.log | head -3
1042: java.lang.NullPointerException: Cannot invoke "Address.city()" because "c.address" is null
1043:     at com.acme.ship.Router.zone(Router.java:88)
9231: java.lang.NullPointerException            ← later ones: bare`,
      cause: 'Once C2 compiled the hot method, <code>OmitStackTraceInFastThrow</code> made it throw a preallocated NPE with no trace and no helpful message. Only the earliest occurrences, before compilation, had details.',
      fix: 'Find the first ones, or restart with the optimisation off while you dig. Then fix the null where it starts. Check input at the edge. Return <code>Optional</code> for “may be missing” values.',
      fixCode: `# JVM option while diagnosing
JAVA_TOOL_OPTIONS="-XX:-OmitStackTraceInFastThrow"

// and the real fix
String zone(Customer c) {
  return Optional.ofNullable(c.address()).map(Address::city).map(zones::forCity).orElse(Zone.DEFAULT);
}` }
  ],
  puzzles: [
    { kind: 'predict', q: 'What does this print?', code: `public class Main {
    static int f() {
        try {
            return 1;
        } finally {
            return 2;
        }
    }

    public static void main(String[] args) {
        System.out.println(f());
    }
}`, options: ['1', '2', 'Compile error: unreachable code', '1 then 2'], answer: 1, explain: 'The try block prepares “return 1”. Then finally does “return 2”, which replaces it. Prints <b>2</b>. It compiles, and only <code>-Xlint:finally</code> warns.', run: true, expect: '2' },
    { kind: 'predict', q: 'finally changes the variable after return. What does this print?', code: `public class Main {
    static int f() {
        int x = 1;
        try {
            return x;
        } finally {
            x = 99;
        }
    }

    public static void main(String[] args) {
        System.out.println(f());
    }
}`, options: ['1', '99', 'Compile error', '0'], answer: 0, explain: 'The return <i>value</i> is computed and saved before finally runs. Changing the local variable afterwards doesn’t change the saved value. Prints <b>1</b>.', run: true, expect: '1' },
    { kind: 'predict', q: 'Same idea, but with an object. What does this print?', code: `public class Main {
    static StringBuilder f() {
        StringBuilder sb = new StringBuilder("a");
        try {
            return sb;
        } finally {
            sb.append("b");
        }
    }

    public static void main(String[] args) {
        System.out.println(f());
    }
}`, options: ['a', 'ab', 'b', 'Compile error'], answer: 1, explain: 'The saved return value points to an object (a <b>reference</b>). finally changes that object, so the caller sees it. Prints <b>ab</b>. Compare with the previous puzzle: see <a href="references-pass-by-value.html">References & pass-by-value</a>.', run: true, expect: 'ab' },
    { kind: 'predict', q: 'try-with-resources with failing close(). What does this print?', code: `import java.io.*;

public class Main {
    record Res(String n) implements AutoCloseable {
        public void close() throws IOException {
            System.out.println("close " + n);
            throw new IOException("close " + n);
        }
    }

    public static void main(String[] args) {
        try (var a = new Res("A"); var b = new Res("B")) {
            System.out.println("body");
            throw new IllegalStateException("boom");
        } catch (Exception e) {
            System.out.println(e.getMessage() + " " + e.getSuppressed().length + " " + e.getSuppressed()[0].getMessage());
        }
    }
}`, options: ['body / close A / close B / boom 2 close A', 'body / close B / close A / boom 2 close B', 'body / close B / close A / close A 1 boom', 'body / close B / close B 0'], answer: 1, explain: 'Resources close in <b>reverse</b> order (B, then A) before the catch runs. The body’s exception stays the main one. Both close failures attach to it, in the order they happened. Prints <b>body</b>, <b>close B</b>, <b>close A</b>, <b>boom 2 close B</b>.', run: true, expect: 'body\nclose B\nclose A\nboom 2 close B' },
    { kind: 'predict', q: 'Does finally run? What does this print?', code: `public class Main {
    public static void main(String[] args) {
        try {
            System.out.println("try");
            System.exit(0);
        } finally {
            System.out.println("finally");
        }
    }
}`, options: ['try / finally', 'try', 'finally', 'Nothing'], answer: 1, explain: '<code>System.exit</code> shuts the JVM down and never returns. So finally never runs. Shutdown hooks would, but finally blocks don’t. Prints only <b>try</b>.', run: true, expect: 'try' },
    { kind: 'predict', q: 'A new exception thrown from catch. What does this print?', code: `public class Main {
    public static void main(String[] args) {
        try {
            try {
                throw new RuntimeException("A");
            } catch (RuntimeException e) {
                throw new RuntimeException("B");
            } finally {
                System.out.println("finally");
            }
        } catch (RuntimeException e) {
            System.out.println(e.getMessage() + " " + (e.getCause() == null));
        }
    }
}`, options: ['finally / A false', 'finally / B true', 'B true / finally', 'finally / B false'], answer: 1, explain: 'finally runs before the new exception leaves the inner try. “B” was created without a cause, so “A” is lost completely. Prints <b>finally</b> then <b>B true</b>. Pass <code>e</code> as the cause to keep the chain.', run: true, expect: 'finally\nB true' },
    { kind: 'concept', q: 'Which method body compiles <b>without</b> a <code>throws</code> clause?', options: ['<code>throw new java.io.IOException();</code>', '<code>throw new IllegalArgumentException();</code>', '<code>throw new Exception();</code>', '<code>Thread.sleep(10);</code>'], answer: 1, explain: '<code>IllegalArgumentException</code> is a RuntimeException, so it is unchecked. <code>IOException</code> and <code>Exception</code> are checked, and <code>Thread.sleep</code> declares the checked <code>InterruptedException</code>.' },
    { kind: 'concept', q: 'What happens with this code?', code: `try {
    readConfig();
} catch (Exception e) {
    log.warn("fallback", e);
} catch (java.io.IOException e) {
    log.error("io", e);
}`, options: ['The IOException branch handles I/O errors', 'Compile error: IOException has already been caught', 'Both branches run for an IOException', 'It compiles, but the second branch is unreachable at runtime'], answer: 1, explain: 'Catch clauses are tried in order. A subclass after its parent class can never match. The compiler rejects it: “exception IOException has already been caught”. Put the more specific type first.' }
  ],
  interview: [
    { q: 'Checked vs unchecked exceptions: what is the difference, and when do you use each?', a: '<p>Checked exceptions (subclasses of <code>Exception</code> outside <code>RuntimeException</code>) must be caught or declared. Unchecked ones, <code>RuntimeException</code> and <code>Error</code>, need neither. Use checked ones for expected problems the <i>direct</i> caller can fix. Use unchecked ones for bugs, and for failures only a distant layer can handle.</p><p>Most modern frameworks (Spring’s <code>DataAccessException</code>, JPA) use unchecked ones. Checked exceptions fit badly with lambdas and layered code.</p>', lvl: 'core' },
    { q: 'How does try-with-resources work under the hood?', a: '<ul><li>Resources open in order. If one fails, those already open are closed.</li><li>After the body, resources are closed in <b>reverse</b> order.</li><li>If the body threw, close exceptions are added to it with <code>addSuppressed</code>. If only <code>close</code> threw, that exception propagates.</li><li>Catch and finally clauses run <i>after</i> the resources are closed.</li></ul><p>Since Java 9 an existing, never-reassigned variable can be the resource: <code>try (conn) {…}</code>.</p>', lvl: 'core' },
    { q: 'List the finally pitfalls.', a: '<ul><li><code>return</code>, <code>throw</code>, <code>break</code> or <code>continue</code> inside finally replaces what was leaving.</li><li>An exception from cleanup in finally hides the original.</li><li>finally doesn’t run on <code>System.exit</code>, <code>Runtime.halt</code>, a JVM crash or a killed process. Nor for daemon threads when the JVM exits.</li><li>A return value is saved before finally runs. Later changes to a primitive don’t matter. Changes to a returned object do show.</li></ul>', lvl: 'core' },
    { q: 'What is exception translation? How do you do it well?', a: '<p>Catch an exception from a lower layer and throw one in your layer’s terms. For example <code>SQLException</code> → <code>OrderStoreException</code>. Pass <b>the original as the cause</b>, and add context (ids, operation). Spring does this for databases. <code>PersistenceExceptionTranslationPostProcessor</code> and the <code>SQLExceptionTranslator</code>s turn vendor errors into one portable <code>DataAccessException</code> family.</p>', fu: 'What is exception <i>chaining</i>? The cause link that lets the stack trace print “Caused by:” for every level.', lvl: 'core' },
    { q: 'Which exceptions make Spring’s @Transactional roll back?', a: '<p>By default <code>RuntimeException</code> and <code>Error</code>. Checked exceptions <b>commit</b>. Change it with <code>rollbackFor</code> / <code>noRollbackFor</code>. An exception caught <i>inside</i> the method doesn’t roll back. The exception: an inner <code>@Transactional</code> call already marked it rollback-only. Then the commit fails with <code>UnexpectedRollbackException</code>.</p>', lvl: 'deep' },
    { q: 'Are exceptions expensive?', a: '<p>Most of the cost is <code>fillInStackTrace</code>, which records the call stack when the exception is <b>created</b>. Throwing and catching inside one compiled method can be cheap. If hot code uses exceptions for flow control, use the <code>Throwable(String, Throwable, boolean enableSuppression, boolean writableStackTrace)</code> constructor with <code>writableStackTrace = false</code>, or reuse one instance. Usually it is better not to use exceptions for expected outcomes at all.</p>', fu: 'What is OmitStackTraceInFastThrow? A default HotSpot optimisation. Hot code may throw a reused built-in exception with no stack trace.', lvl: 'deep' },
    { q: 'How do you deal with checked exceptions inside lambdas and streams?', a: '<p>The standard functional interfaces don’t declare checked exceptions. Wrap them in an unchecked exception (<code>UncheckedIOException</code> exists for I/O). Or write your own interface that declares <code>throws</code>. Or move that code into a plain loop. Don’t catch and ignore inside the lambda.</p>', lvl: 'core' },
    { q: 'What is the right way to handle InterruptedException?', a: '<p>It means someone asked this thread to stop. Either pass it on (declare <code>throws InterruptedException</code>). Or catch it, call <code>Thread.currentThread().interrupt()</code> to restore the flag, and finish quickly. Swallowing it breaks executor shutdown and task cancellation.</p>', lvl: 'core' },
    { q: 'What happens to an exception thrown in a task given to an ExecutorService?', a: '<ul><li><code>execute(r)</code>: the exception reaches the thread’s <code>UncaughtExceptionHandler</code> (it prints to stderr by default). The pool replaces the thread.</li><li><code>submit(r)</code>: it is stored in the Future. It appears only as an <code>ExecutionException</code> from <code>get()</code>. If nobody calls get, it is lost.</li><li><code>scheduleAtFixedRate</code> / <code>WithFixedDelay</code>: one exception cancels all future runs.</li><li><code>CompletableFuture</code>: it travels down the chain inside a <code>CompletionException</code>, until an <code>exceptionally</code> or <code>handle</code> stage deals with it.</li></ul>', lvl: 'deep' },
    { q: 'Is catching <code>Exception</code> or <code>Throwable</code> ever right?', a: '<p>Only at an <b>edge</b>: a request handler, a message listener, a job loop or a thread’s run method. There you must log and keep the process alive. Catching <code>Throwable</code> also catches <code>Error</code>s such as <code>OutOfMemoryError</code> and <code>StackOverflowError</code>, which you usually can’t recover from. Deep in business code, catch only the types you can handle.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'One boundary that maps and logs', lang: 'java', code: `public sealed class DomainException extends RuntimeException
        permits NotFound, Conflict, Unavailable {
    protected DomainException(String msg, Throwable cause) { super(msg, cause); }
}
public final class NotFound extends DomainException { public NotFound(String m) { super(m, null); } }
public final class Conflict extends DomainException { public Conflict(String m, Throwable c) { super(m, c); } }
public final class Unavailable extends DomainException { public Unavailable(String m, Throwable c) { super(m, c); } }

@RestControllerAdvice
class ApiErrors {
    private static final Logger log = LoggerFactory.getLogger(ApiErrors.class);

    @ExceptionHandler(DomainException.class)
    ProblemDetail domain(DomainException e) {           // Spring 6 / Boot 3: RFC 7807 bodies
        var status = switch (e) {
            case NotFound n    -> HttpStatus.NOT_FOUND;
            case Conflict c    -> HttpStatus.CONFLICT;
            case Unavailable u -> HttpStatus.SERVICE_UNAVAILABLE;
            default            -> HttpStatus.INTERNAL_SERVER_ERROR;
        };
        if (status.is5xxServerError()) log.error("request failed", e);   // logged once, with causes
        return ProblemDetail.forStatusAndDetail(status, e.getMessage());
    }
}`, note: 'The switch needs a <code>default</code>. <code>DomainException</code> isn’t abstract, so it could be created directly. See <a href="sealed-pattern-matching.html">Sealed types & pattern matching</a>.' },
    { title: 'Translate at the repository edge', lang: 'java', code: `@Repository
class JdbcOrderStore implements OrderStore {
    private final JdbcClient jdbc;                       // Spring 6.1+

    public void save(Order o) {
        try {
            jdbc.sql("insert into orders(id, total) values (?, ?)")
                .params(o.id(), o.total()).update();
        } catch (DuplicateKeyException e) {              // already translated by Spring
            throw new Conflict("order " + o.id() + " exists", e);
        } catch (TransientDataAccessException e) {       // deadlock, timeout, lock wait
            throw new Unavailable("order store busy saving " + o.id(), e);
        }
    }
}` },
    { title: 'Checked I/O inside streams', lang: 'java', code: `List<Invoice> parseAll(Path dir) throws IOException {
    try (Stream<Path> files = Files.list(dir)) {        // the stream holds a directory handle
        return files
            .filter(p -> p.toString().endsWith(".json"))
            .map(p -> {
                try {
                    return mapper.readValue(p.toFile(), Invoice.class);
                } catch (IOException e) {
                    throw new UncheckedIOException("bad invoice " + p, e);
                }
            })
            .toList();
    } catch (UncheckedIOException e) {
        throw e.getCause();                              // back to a checked IOException for callers
    }
}` }
  ]
});

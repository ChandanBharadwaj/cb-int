IA.register({
  track: 'nodejs',
  slug: 'async-errors',
  title: 'Async error handling',
  tagline: 'A <code>try/catch</code> only sees errors thrown <b>while its frame is on the stack</b>. Async code runs later, on a fresh stack, so errors travel another way: as rejected promises, as the <code>err</code> argument of a callback, or as <code>\'error\'</code> events. Anything that falls through all three crashes the process, and since Node 15 that includes unhandled rejections.',
  tldr: {
    problem: 'One missing <code>await</code> or <code>.catch</code> takes down a whole Node process, and every in-flight request with it. Meanwhile timeouts that “work” often leave the slow call running in the background.',
    model: '<b>Promises/async</b>: <code>await</code> inside <code>try</code> turns a rejection back into a throw. A promise that rejects with no handler (checked after the microtask queue drains) triggers <code>\'unhandledRejection\'</code>; the default mode <code>throw</code> then crashes. <b>Callbacks</b>: the error is the first argument, never a throw. <b>Cancellation</b>: pass an <code>AbortSignal</code> down; aborted work rejects with <code>AbortError</code> (or the signal’s reason).',
    hook: '“What happens to an unhandled promise rejection in Node 22?” It’s raised as an uncaught exception: the error is printed and the process exits with code 1, unless an <code>\'unhandledRejection\'</code> listener exists.',
    facts: [
      { v: 'Node 15', l: 'changed the default <code>--unhandled-rejections</code> mode from <code>warn</code> to <code>throw</code>: unhandled rejections crash the process' },
      { v: 'exit 1', l: 'what an uncaught exception does when no <code>\'uncaughtException\'</code> listener exists' },
      { v: 'DEP0032', l: 'the deprecation code of the <code>domain</code> module. It still ships, but don’t use it; use promises, AbortSignal and AsyncLocalStorage instead' }
    ]
  },
  intro: {
    what: 'When something fails in synchronous code, it <b>throws</b>, and the nearest <code>try/catch</code> up the call stack catches it. Async work finishes later, after the function that started it has returned. By then that <code>try/catch</code> is gone, so Node needs other channels for errors: a <b>rejected promise</b>, an <b>error argument</b> in a callback, or an <b>\'error\' event</b>. Your job is to make sure every async error lands in one of them, and that someone is listening.',
    analogy: { icon: '📮', title: 'Return to sender', text: 'Sync code is a phone call: if something goes wrong, you hear it right away. Async code is a letter: by the time the “undeliverable” notice comes back, you’ve hung up and left. If you didn’t write a <b>return address</b> (<code>await</code>, <code>.catch</code>, an error callback), the notice goes to the post office’s dead-letter desk, and in Node that desk shuts the whole office down.' },
    steps: [
      { t: 'try/catch works with await', d: 'Inside an async function, <code>await</code> re-throws a rejection where you can catch it.', code: "try {\n  const user = await getUser(id);\n} catch (err) {\n  log.warn({ err }, 'lookup failed');\n}" },
      { t: 'Callbacks pass errors as a value', d: 'Check <code>err</code> first and <code>return</code>.', code: "fs.readFile(path, (err, data) => {\n  if (err) return done(err);\n  done(null, data);\n});" },
      { t: 'Never leave a promise floating', d: 'Every promise needs an <code>await</code> or a <code>.catch</code>. If not, an unhandled rejection crashes Node.' },
      { t: 'Cancel with AbortController', d: 'Pass <code>signal</code> to anything that supports it, so a timeout really stops the work.', code: "await fetch(url, { signal: AbortSignal.timeout(2000) });" }
    ],
    terms: [
      ['rejection', 'A promise settling with an error instead of a value.'],
      ['unhandled rejection', 'A rejected promise nobody attached a handler to.'],
      ['uncaught exception', 'A throw that no try/catch on the stack caught.'],
      ['error-first callback', '<code>(err, value) =&gt; …</code>: Node’s callback convention.'],
      ['AbortSignal', 'An object you pass to async work so it can be cancelled.'],
      ['floating promise', 'A promise that is created and then ignored.']
    ]
  },
  visual: {
    title: 'Where does the error go?',
    caption: 'Pick a pattern and press Step. The left column is the call stack; dashed frames have a <b>try</b> around them. An error is caught only if a try frame is on the stack when it is thrown, or if the promise has a handler.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'return vs return await', code: `async function load() { throw new Error('db down'); }\n\nasync function a() { try { return load(); } catch { return 'fallback'; } }\nasync function b() { try { return await load(); } catch { return 'fallback'; } }\n\nconsole.log('b():', await b());\nconsole.log('a():', await a().catch((e) => 'escaped: ' + e.message));`, note: 'Promise and AbortController semantics match Node here. Node-only APIs (process events, setImmediate) are covered in the puzzles below.' },
      { label: 'Abortable sleep', code: `function sleep(ms, { signal } = {}) {\n  return new Promise((resolve, reject) => {\n    if (signal?.aborted) return reject(signal.reason);\n    const t = setTimeout(resolve, ms);\n    signal?.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason); }, { once: true });\n  });\n}\n\nconst ac = new AbortController();\nsetTimeout(() => ac.abort(), 100);\ntry {\n  await sleep(2000, { signal: ac.signal });\n} catch (e) {\n  console.log('stopped:', e.name);   // AbortError\n}\n\ntry {\n  await sleep(2000, { signal: AbortSignal.timeout(150) });\n} catch (e) {\n  console.log('stopped:', e.name);   // TimeoutError\n}` },
      { label: 'Errors with a cause', code: `async function getUser(id) {\n  try {\n    throw new Error('ECONNRESET');               // pretend the driver failed\n  } catch (err) {\n    throw new Error(\`getUser(\${id}) failed\`, { cause: err });\n  }\n}\ntry { await getUser(7); }\ncatch (e) { console.log(e.message, '← cause:', e.cause.message); }` },
      { label: 'AggregateError from any', code: `try {\n  await Promise.any([\n    Promise.reject(new Error('mirror A down')),\n    Promise.reject(new Error('mirror B down')),\n  ]);\n} catch (e) {\n  console.log(e.name, e.errors.map((x) => x.message));\n}` },
      { label: 'An unhandled rejection', code: `async function fireAndForget() { throw new Error('nobody is listening'); }\nfireAndForget();   // no await, no .catch\nconsole.log('the code keeps going...');`, note: 'The browser only logs “Uncaught (in promise)”. Node 15+ would <b>crash the process</b> with exit code 1.' }
    ]
  },
  gotchas: [
    { trap: 'try/catch around a callback-based call', code: `try {\n  setTimeout(() => { throw new Error('boom'); }, 10);\n  fs.readFile(p, (err, d) => { JSON.parse(d); });   // a throw here escapes too\n} catch (e) { /* never sees either */ }`, why: 'The callback runs later, on a new stack. The try frame is long gone.', fix: 'Put the try/catch <i>inside</i> the callback, or switch to the promise API (<code>fs/promises</code>, <code>timers/promises</code>) and <code>await</code> inside a try.' },
    { trap: 'Floating promises crash the process', code: `app.post('/orders', (req, res) => {\n  audit.log(req.user, 'order');   // async, returns a promise nobody handles\n  res.end();\n});`, why: 'If <code>audit.log</code> rejects, nothing handles it. Since Node 15 the default <code>--unhandled-rejections=throw</code> turns it into an uncaught exception: exit code 1.', fix: 'Await it, or, for real fire-and-forget, attach a handler: <code>audit.log(…).catch((err) =&gt; log.warn({ err }))</code>. Turn on the <code>@typescript-eslint/no-floating-promises</code> lint rule.' },
    { trap: 'return without await inside try', code: `async function get(id) {\n  try { return db.find(id); }        // rejection escapes\n  catch { return null; }\n}`, why: 'Returning the promise ends the try block before the promise settles, so the rejection goes straight to the caller.', fix: '<code>return await db.find(id)</code> inside try blocks. (Outside try, plain <code>return</code> is fine.)' },
    { trap: 'Keeping the process alive after uncaughtException', code: `process.on('uncaughtException', (err) => {\n  log.error(err);   // …and carry on serving traffic\n});`, why: 'After an uncaught exception, the program is in an unknown state: half-done writes, leaked locks, broken invariants. The Node docs say it is not safe to resume normal operation.', fix: 'Log synchronously, flush what you can, stop accepting work and exit with a non-zero code. Let the orchestrator (Kubernetes, systemd) restart it.' },
    { trap: 'Timeouts that don’t stop the work', code: `const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000));\nawait Promise.race([fetch(url), timeout]);   // fetch keeps running; the timer keeps running too`, why: '<code>race</code> stops <i>waiting</i>, not working. The socket stays open and the result is thrown away; under load these pile up.', fix: '<code>fetch(url, { signal: AbortSignal.timeout(2000) })</code>, or <code>AbortSignal.any([req.signal, AbortSignal.timeout(2000)])</code> (Node 20.3+) to also cancel when the client disconnects.' },
    { trap: 'Express 4 and async handlers', code: `// Express 4: a rejected promise never reaches error middleware\napp.get('/u/:id', async (req, res) => {\n  res.json(await users.get(req.params.id));   // rejection → unhandled → crash\n});`, why: 'Express 4 calls your handler and ignores the returned promise. Express 5 (released 2024) forwards rejections to <code>next(err)</code>; Fastify has always supported async handlers.', fix: 'Upgrade to Express 5, or wrap handlers: <code>const wrap = (fn) =&gt; (req, res, next) =&gt; fn(req, res, next).catch(next)</code>.' },
    { trap: 'Reaching for the domain module', why: '<code>domain</code> tried to catch errors across async boundaries and has been deprecated for years (DEP0032). It is unreliable with promises and adds overhead.', fix: 'Handle errors with promises and await; carry request context with <code>AsyncLocalStorage</code>; cancel with AbortSignal; keep a process-level handler only to log and exit.' }
  ],
  scenarios: [
    { title: 'Pods restart every few hours with exit code 1',
      symptom: 'Kubernetes shows <code>CrashLoopBackOff</code>-style restarts several times a day. Each restart drops a few hundred in-flight requests. The logs end with a stack trace from the analytics client.',
      diagnoseLang: 'bash',
      diagnose: `kubectl logs deploy/orders --previous | tail -20\n# Error: getaddrinfo ENOTFOUND analytics.internal\n#   at ... analytics.track (client.js:88)\n# Node.js v22.x\ngrep -rn "analytics.track(" src/ | grep -v await`,
      cause: '<code>analytics.track()</code> is called without <code>await</code> or <code>.catch</code>. When the analytics host has DNS trouble, the promise rejects unhandled, and Node 22 exits.',
      fix: 'Handle the promise at the call site (it is best-effort, so log and move on), add the <code>no-floating-promises</code> lint rule, and keep a process-level handler that logs with context before exiting.',
      fixCode: `analytics.track(evt).catch((err) => log.warn({ err, evt: evt.name }, 'analytics failed'));\n\n// last resort, once at startup\nprocess.on('unhandledRejection', (reason) => {\n  log.fatal({ err: reason }, 'unhandled rejection');\n  throw reason;          // keep the crash, now with context in the logs\n});`, lang: 'ts' },
    { title: 'Timeouts “work” but the downstream still melts',
      symptom: 'The API returns 504 after 2 s as designed, but the partner service sees traffic far above our request rate and eventually fails.',
      diagnoseLang: 'bash',
      diagnose: `ss -tn state established '( dport = :443 )' | wc -l   # thousands of open sockets\n# code: await Promise.race([callPartner(), timeout(2000)])`,
      cause: '<code>Promise.race</code> stops waiting but never cancels. Every timed-out call keeps its socket open, and client retries add more calls on top.',
      fix: 'Pass an AbortSignal down so the socket closes on timeout or when the client disconnects. Cap retries with backoff.',
      fixCode: `app.get('/quote', async (req, res) => {\n  const disconnect = new AbortController();\n  res.on('close', () => { if (!res.writableEnded) disconnect.abort(); });\n  const signal = AbortSignal.any([disconnect.signal, AbortSignal.timeout(2000)]);\n  try {\n    const r = await fetch(partnerUrl, { signal });\n    res.json(await r.json());\n  } catch (err) {\n    if (err.name === 'TimeoutError') return res.status(504).end();\n    if (err.name === 'AbortError') return;            // client went away\n    throw err;\n  }\n});`, lang: 'ts' },
    { title: 'A job runner swallows every failure',
      symptom: 'The nightly reconciliation “succeeds” every night, but finance finds unreconciled rows. No errors in the logs.',
      diagnose: `// runner\nfor (const job of jobs) {\n  job.run().then(() => metrics.ok(job.name)).catch(() => {});   // swallowed\n}\nprocess.exit(0);`,
      cause: 'Errors are swallowed by an empty <code>catch</code>, and <code>process.exit(0)</code> runs before the jobs have even finished.',
      fix: 'Await all jobs, collect failures with <code>allSettled</code>, log them with causes, and set a non-zero exit code so the scheduler alerts.',
      fixCode: `const results = await Promise.allSettled(jobs.map((j) => j.run()));\nconst failed = results.flatMap((r, i) => r.status === 'rejected' ? [{ job: jobs[i].name, err: r.reason }] : []);\nfor (const f of failed) log.error(f, 'job failed');\nprocess.exitCode = failed.length ? 1 : 0;   // let the loop drain; don't call exit()`, lang: 'ts' }
  ],
  puzzles: [
    { kind: 'predict', q: 'A throw inside a timer, with a try/catch around it and a process handler. What prints?', code: `process.on('uncaughtException', (err) => console.log('uncaught:', err.message));\n\ntry {\n  setTimeout(() => { throw new Error('boom'); }, 0);\n} catch (e) {\n  console.log('caught:', e.message);\n}\nconsole.log('after');`, options: ['caught: boom, after', 'after, caught: boom', 'after, uncaught: boom', 'after (then the process crashes)'], answer: 2, explain: 'The try block finishes before the timer fires, so <code>catch</code> never sees the throw. The throw happens on a fresh stack, nobody catches it, and the process-level listener gets it. Without that listener the process would exit with code 1.', run: true, expect: 'after\nuncaught: boom' },
    { kind: 'predict', q: 'Node 22, with an <code>unhandledRejection</code> listener installed. What prints?', code: `process.on('unhandledRejection', (reason) => console.log('unhandled:', reason.message));\n\nPromise.reject(new Error('lost'));\nsetTimeout(() => console.log('still alive'), 10);`, options: ['still alive', 'unhandled: lost, still alive', 'unhandled: lost (then exit 1)', 'still alive, unhandled: lost'], answer: 1, explain: 'In the default <code>throw</code> mode, Node first emits <code>\'unhandledRejection\'</code>. Only if <b>no listener</b> handles it does it raise an uncaught exception. Here the listener handles it, so the process keeps running and the timer fires.', run: true, expect: 'unhandled: lost\nstill alive' },
    { kind: 'predict', q: 'An async function that throws before any await. What prints?', code: `async function f() {\n  throw new Error('sync throw');\n}\ntry {\n  f().catch((e) => console.log('promise caught:', e.message));\n  console.log('no throw here');\n} catch (e) {\n  console.log('try caught');\n}`, options: ['try caught', 'no throw here, promise caught: sync throw', 'promise caught: sync throw, no throw here', 'try caught, no throw here'], answer: 1, explain: 'An async function never throws at the call site. Even a throw before the first <code>await</code> becomes a rejected promise. The <code>.catch</code> handler runs as a microtask, after the synchronous log.', run: true, expect: 'no throw here\npromise caught: sync throw' },
    { kind: 'predict', q: '<code>return</code> vs <code>return await</code> inside try. What prints?', code: `async function load() { throw new Error('db down'); }\nasync function a() { try { return load(); } catch { return 'fallback'; } }\nasync function b() { try { return await load(); } catch { return 'fallback'; } }\n\n(async () => {\n  console.log(await b());\n  console.log(await a().catch((e) => 'escaped: ' + e.message));\n})();`, options: ['fallback, fallback', 'fallback, escaped: db down', 'escaped: db down, fallback', 'escaped: db down, escaped: db down'], answer: 1, explain: 'In <code>b</code>, <code>await</code> throws the rejection inside the try, so catch returns the fallback. In <code>a</code>, the promise is returned as-is and rejects after the try has ended, so the error escapes to the caller.', run: true, expect: 'fallback\nescaped: db down' },
    { kind: 'predict', q: 'Aborting a promise-based timer. What prints?', code: `const { setTimeout: sleep } = require('node:timers/promises');\n\n(async () => {\n  const ac = new AbortController();\n  setTimeout(() => ac.abort(), 10);\n  try {\n    await sleep(1000, 'done', { signal: ac.signal });\n    console.log('finished');\n  } catch (e) {\n    console.log(e.name, ac.signal.aborted);\n  }\n})();`, options: ['finished', 'AbortError true', 'Error false', 'TimeoutError true'], answer: 1, explain: 'Aborting clears the timer and rejects the promise with an <code>AbortError</code> (code <code>ABORT_ERR</code>). The process exits right after, without waiting the full second.', run: true, expect: 'AbortError true' },
    { kind: 'concept', q: 'Node 22, default flags, no process listeners. A promise rejects and nobody ever handles it. What happens?', options: ['A warning is printed and the process continues', 'Nothing', 'The error is printed and the process exits with code 1', 'The promise is retried'], answer: 2, explain: 'Since Node 15, <code>--unhandled-rejections=throw</code> is the default: with no <code>\'unhandledRejection\'</code> listener, the rejection is raised as an uncaught exception. Other modes: <code>strict</code>, <code>warn</code>, <code>none</code>, <code>warn-with-error-code</code>.' },
    { kind: 'concept', q: '<code>await Promise.all([a(), b()])</code>: <code>a</code> rejects at 10 ms, <code>b</code> rejects at 50 ms. Does b’s rejection crash the process as unhandled?', options: ['Yes: Promise.all only handles the first rejection', 'No: Promise.all attached handlers to every input promise', 'Only in strict mode', 'Yes, unless b is awaited separately'], answer: 1, explain: '<code>Promise.all</code> subscribes to every input up front, so later rejections are handled (and ignored). Compare: <code>const pa = a(), pb = b(); await pa; await pb;</code> can report <code>pb</code> as unhandled if it rejects while you are still waiting on <code>pa</code>.' },
    { kind: 'concept', q: 'You need per-request context (request id, user) in logs across async calls, which people used <code>domain</code> for. What do you use in Node 22?', options: ['The domain module', 'Global variables reset per request', 'AsyncLocalStorage from node:async_hooks', 'process.nextTick'], answer: 2, explain: '<code>AsyncLocalStorage</code> (stable) carries a store through promises, timers and callbacks started inside <code>als.run(store, fn)</code>. <code>domain</code> is deprecated (DEP0032). Error handling itself should go through promises and await, not a domain.' }
  ],
  interview: [
    { q: 'Why doesn’t try/catch catch errors from a setTimeout callback?', a: '<p><code>try/catch</code> is lexical and synchronous: it covers code that runs while its frame is on the stack. <code>setTimeout</code> returns immediately; the callback runs later from the event loop on a new stack, where no try frame exists. <code>await</code> fixes this for promises: the async function’s frame is saved and resumed inside the try, and the rejection is thrown there.</p>', lvl: 'core' },
    { q: 'What happens on an unhandled rejection in Node 22? What are the modes?', a: '<p>Node detects a rejected promise without a handler after the microtask queue drains. In the default mode <b>throw</b> (since Node 15), it emits <code>\'unhandledRejection\'</code>; if no listener exists it raises the reason as an uncaught exception, which exits with code 1. Other modes: <b>strict</b> (raise as uncaught exception even if a listener exists), <b>warn</b> (always warn), <b>warn-with-error-code</b> (warn and set exit code 1), <b>none</b>.</p>', fu: 'What if a .catch is attached later? (Node emits \'rejectionHandled\', but in throw mode the process may already be gone.)', lvl: 'core' },
    { q: 'Should a server keep running after uncaughtException?', a: '<p>No. The handler is for logging and cleanup. State may be corrupt (a transaction half applied, a lock not released), so log synchronously, stop accepting connections, give in-flight work a short deadline, and exit non-zero. Run several replicas so a restart isn’t an outage. <code>\'uncaughtExceptionMonitor\'</code> lets you observe without changing the default crash.</p>', lvl: 'core' },
    { q: 'Operational vs programmer errors?', a: '<p><b>Operational</b>: expected failures of a correct program, such as a timeout, ECONNREFUSED, a 404 or validation errors. Handle them: retry, fall back, return a 4xx/5xx. <b>Programmer</b> errors are bugs: <code>undefined is not a function</code>, a wrong argument type. You can’t “handle” those meaningfully; log, crash, fix. Mixing them (catching everything and carrying on) hides bugs.</p>', lvl: 'core' },
    { q: 'How do errors work with callbacks and EventEmitters?', a: '<p><b>Callbacks</b>: error-first, <code>cb(err)</code>; never throw from an async API, and call the callback exactly once. <b>EventEmitters</b>: errors are emitted as <code>\'error\'</code> events, and an <code>\'error\'</code> with no listener <b>throws</b>, which usually crashes the process. Streams emit <code>\'error\'</code> too; <code>stream.pipeline</code> wires errors and cleanup for you. <code>events.once</code> rejects if <code>\'error\'</code> is emitted while waiting.</p>', lvl: 'core' },
    { q: 'How does AbortController work in Node, and where is it supported?', a: '<p><code>new AbortController()</code> gives you a <code>signal</code>; <code>controller.abort(reason)</code> fires its <code>\'abort\'</code> event once. APIs that accept <code>{ signal }</code> stop and reject: <code>fetch</code>, <code>timers/promises</code>, <code>fs.readFile</code>, <code>events.once</code>, <code>child_process</code>, streams, <code>readline</code>. Helpers: <code>AbortSignal.timeout(ms)</code> (rejects with a TimeoutError) and <code>AbortSignal.any([...])</code> (Node 20.3+) to combine. In your own code, check <code>signal.aborted</code>, call <code>signal.throwIfAborted()</code>, and listen for <code>\'abort\'</code>.</p>', lvl: 'deep' },
    { q: 'What replaced the domain module?', a: '<p>Nothing one-to-one, by design. Error routing moved to promises and <code>await</code>. Per-request context moved to <code>AsyncLocalStorage</code>. Cancellation moved to AbortSignal. A process-level <code>\'uncaughtException\'</code>/<code>\'unhandledRejection\'</code> handler remains, only to log and exit.</p>', lvl: 'core' },
    { q: 'How do async errors reach Express error middleware?', a: '<p>Express 5 forwards a rejected promise returned from a handler or middleware to <code>next(err)</code>. Express 4 doesn’t, so a rejection becomes unhandled (and crashes on Node 15+); wrap handlers or use a helper library. Fastify supports async handlers natively: return a value or throw.</p>', lvl: 'core' },
    { q: 'How do you add context to an error without losing the original?', a: '<p>Wrap it with <code>new Error(\'getUser(7) failed\', { cause: err })</code> (ES2022, Node 16.9+). Loggers such as pino serialise the cause chain. Keep a stable <code>code</code> property for programmatic checks rather than matching on messages or <code>instanceof</code> across package copies.</p>', lvl: 'deep' },
    { q: 'How does this compare with Java?', a: '<p>An uncaught exception in a Java thread kills <b>that thread</b> (the default handler prints it), and the JVM keeps running as long as other non-daemon threads exist. In Node there is one JS thread, so an uncaught error ends the process. Java’s <code>CompletableFuture</code> is the opposite risk: an exception in a future that nobody joins is silently lost. Node 15+ chose to crash loudly instead. <code>Thread.setDefaultUncaughtExceptionHandler</code> ≈ <code>process.on(\'uncaughtException\')</code>.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Process-level safety net (log, then exit)', lang: 'ts', code: `import { setTimeout as sleep } from 'node:timers/promises';

let shuttingDown = false;
async function fatal(kind: string, err: unknown) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.fatal({ err, kind }, 'fatal error, shutting down');
  server.close();                                   // stop accepting new connections
  await Promise.race([drainInFlight(), sleep(5_000)]);
  process.exit(1);                                  // the orchestrator restarts us
}

process.on('uncaughtException', (err) => void fatal('uncaughtException', err));
process.on('unhandledRejection', (reason) => void fatal('unhandledRejection', reason));`, note: 'Installing a listener stops the immediate crash, so this handler must exit by itself. Don’t keep serving traffic.' },
    { title: 'Cancel work when the client leaves or time runs out', lang: 'ts', code: `import Fastify from 'fastify';
const app = Fastify();

app.get('/report/:id', async (req, reply) => {
  const gone = new AbortController();
  req.raw.on('close', () => { if (!reply.raw.writableEnded) gone.abort(); });
  const signal = AbortSignal.any([gone.signal, AbortSignal.timeout(3_000)]);   // Node 20.3+

  const [a, b] = await Promise.all([
    fetch(\`\${SVC_A}/r/\${req.params.id}\`, { signal }),
    fetch(\`\${SVC_B}/r/\${req.params.id}\`, { signal }),
  ]);   // a rejection here goes to Fastify's error handler: async handlers are first-class
  return { a: await a.json(), b: await b.json() };
});

app.setErrorHandler((err, req, reply) => {
  if (err.name === 'TimeoutError') return reply.code(504).send({ error: 'upstream timeout' });
  req.log.error({ err }, 'request failed');
  reply.code(500).send({ error: 'internal' });
});`, note: 'One signal stops both upstream calls. Promise.all subscribes to both promises, so the second rejection isn’t unhandled.' },
    { title: 'Request context without domains', lang: 'ts', code: `import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const als = new AsyncLocalStorage<{ requestId: string }>();

app.addHook('onRequest', (req, _reply, done) => {
  als.run({ requestId: req.headers['x-request-id']?.toString() ?? randomUUID() }, done);
});

export const logError = (err: unknown) =>
  log.error({ err, requestId: als.getStore()?.requestId }, 'failed');`, note: 'The store follows awaits, timers and callbacks started inside <code>als.run</code>. Similar to Java’s ThreadLocal/MDC, but it follows async hops instead of a thread.' },
    { title: 'Java comparison: threads vs the one JS thread', lang: 'java', code: `// Java: an uncaught exception kills only this thread; the JVM keeps running
Thread.setDefaultUncaughtExceptionHandler((t, e) -> log.error("thread {} died", t.getName(), e));

// CompletableFuture: if nobody joins or handles it, the exception is silently lost
CompletableFuture.runAsync(() -> { throw new IllegalStateException("lost"); });

// handle it explicitly (≈ .catch)
CompletableFuture.supplyAsync(this::loadUser)
    .exceptionally(e -> { log.warn("lookup failed", e); return User.ANONYMOUS; });

// Node 15+: the equivalent unhandled rejection crashes the process instead.`, note: 'Spring’s <code>@ExceptionHandler</code> plays the role of Express/Fastify error handlers.' }
  ]
});

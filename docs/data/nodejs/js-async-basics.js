IA.register({
  track: 'nodejs',
  slug: 'js-async-basics',
  title: 'Async basics',
  tagline: 'Node runs your JavaScript on <b>one thread</b> and never waits for I/O. You start work, hand over a <b>callback</b> or get a <b>promise</b>, and the event loop resumes you when the result is ready. <code>async</code>/<code>await</code> makes that look like ordinary top-to-bottom code.',
  tldr: {
    problem: 'In a Spring MVC app each request gets a thread, and a blocking JDBC call just parks that thread. Node has a single main thread. If it waited for the disk or the network, every other request would wait too.',
    model: 'Slow work (files, sockets, timers) is handed to the OS through libuv. Your code returns at once. When the work finishes, a callback is queued and the <b>event loop</b> runs it as soon as the call stack is empty. Promises are queued as <b>microtasks</b>, which run before the next task.',
    hook: '“Why does <code>setTimeout(fn, 0)</code> run after the rest of the script?” Because callbacks only run when the call stack is empty. 0 ms means “as soon as possible after the current code”, not “now”.',
    facts: [
      { v: '1 thread', l: 'runs all your JavaScript. I/O waits happen in the OS or libuv’s thread pool, not in your code' },
      { v: '3 states', l: 'of a promise: pending, then fulfilled or rejected, and it settles only once' },
      { v: 'micro → task', l: 'all queued promise callbacks run before the next timer or I/O callback' }
    ]
  },
  intro: {
    what: '<b>Asynchronous</b> code starts something now and finishes it later. Reading a file, querying a database or calling an API takes milliseconds, which is ages for a CPU. Instead of waiting, Node registers what to do <i>when</i> the result arrives and moves on to other work. There are three ways to write that “when”: callbacks, promises and <code>async</code>/<code>await</code>.',
    analogy: { icon: '🍜', title: 'One waiter, many tables', text: 'A Java thread-per-request server hires one waiter per table, who stands by the kitchen until the food is ready. Node has one very fast waiter: he takes an order to the kitchen (the OS), goes straight to the next table, and brings each dish out when the kitchen rings the bell (the event loop).' },
    steps: [
      { t: 'Callbacks', d: 'The original style: pass a function. Node calls it with <code>(err, result)</code> when done.', code: "const fs = require('node:fs');\nfs.readFile('config.json', 'utf8', (err, text) => {\n  if (err) return console.error('failed', err.message);\n  console.log('read', text.length, 'chars');\n});\nconsole.log('this prints first');" },
      { t: 'Promises', d: 'An object standing for a future value, like Java’s <code>CompletableFuture</code>. Chain with <code>.then</code>, handle errors with <code>.catch</code>.', code: "const fsp = require('node:fs/promises');\nfsp.readFile('config.json', 'utf8')\n  .then((text) => JSON.parse(text))\n  .then((cfg) => console.log(cfg.port))\n  .catch((err) => console.error(err.message));" },
      { t: 'async / await', d: '<code>await</code> pauses <i>this function</i> until the promise settles, without blocking the thread. Errors become normal try/catch.', code: "async function loadConfig() {\n  try {\n    const text = await fsp.readFile('config.json', 'utf8');\n    return JSON.parse(text);\n  } catch (err) {\n    throw new Error('config unreadable', { cause: err });\n  }\n}" },
      { t: 'Parallel, not one by one', d: 'Start independent work together and await all of it.', code: "const [user, orders] = await Promise.all([\n  getUser(id),      // both requests are in flight at once\n  getOrders(id),\n]);" }
    ],
    terms: [
      ['non-blocking', 'A call that returns immediately and reports its result later, so the thread can do other work.'],
      ['event loop', 'Node’s scheduler: when the call stack is empty, it takes the next ready callback and runs it.'],
      ['callback', 'A function passed in to be called later. Node style: <code>(err, result) =&gt; …</code>.'],
      ['promise', 'An object for a result that isn’t ready yet. Pending → fulfilled (value) or rejected (error).'],
      ['async function', 'A function that always returns a promise and may use <code>await</code> inside.'],
      ['microtask', 'A promise callback. The queue is drained completely before the next timer or I/O callback.']
    ]
  },
  visual: {
    title: 'Inside the event loop',
    caption: 'Pick an example and Step. The <b>call stack</b> is what’s running now. <b>Node / libuv</b> holds timers and I/O in progress. Finished work lands in the <b>microtasks</b> lane (promises) or the <b>task queue</b> (timers, I/O callbacks). Nothing in a queue runs until the call stack is empty.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'setTimeout 0', code: "console.log('A');\nsetTimeout(() => console.log('B (timer)'), 0);\nconsole.log('C');\nfor (let i = 0; i < 3; i++) console.log('still synchronous', i);", note: 'The timer callback waits until all synchronous code is done.' },
      { label: 'Promise vs timer', code: "console.log('1 sync');\nsetTimeout(() => console.log('4 timer task'), 0);\nPromise.resolve()\n  .then(() => console.log('3a microtask'))\n  .then(() => console.log('3b chained microtask'));\nqueueMicrotask(() => console.log('3c queueMicrotask'));\nconsole.log('2 sync');", note: 'Microtasks (promise callbacks) all run before the next task. Node adds <code>process.nextTick</code>, which runs even earlier; see <a href="microtasks-macrotasks.html">Microtasks vs macrotasks</a>.' },
      { label: 'Sequential vs parallel', code: "const wait = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));\n\nlet t = performance.now();\nconst a = await wait(200, 'user');\nconst b = await wait(200, 'orders');\nconsole.log('sequential', a, b, Math.round(performance.now() - t), 'ms');\n\nt = performance.now();\nconst [c, d] = await Promise.all([wait(200, 'user'), wait(200, 'orders')]);\nconsole.log('parallel  ', c, d, Math.round(performance.now() - t), 'ms');", note: 'Top-level <code>await</code> works here and in Node ES modules. In a CommonJS file, wrap the code in an <code>async</code> function.' },
      { label: 'Callback → promise', code: "// an old callback-style API\nfunction legacyFetch(id, cb) {\n  setTimeout(() => (id < 0 ? cb(new Error('bad id')) : cb(null, { id, name: 'Ada' })), 50);\n}\n// wrap it once (Node has util.promisify for this)\nconst fetchUser = (id) => new Promise((resolve, reject) =>\n  legacyFetch(id, (err, user) => (err ? reject(err) : resolve(user))));\n\nconsole.log(await fetchUser(1));\ntry {\n  await fetchUser(-1);\n} catch (e) {\n  console.log('caught:', e.message);\n}" },
      { label: 'Blocking the loop', code: "const start = performance.now();\nsetTimeout(() => console.log('timer wanted 10 ms, got', Math.round(performance.now() - start), 'ms'), 10);\n\n// CPU-bound loop: nothing else can run until it ends\nlet x = 0;\nwhile (performance.now() - start < 300) x++;\nconsole.log('busy loop done after', Math.round(performance.now() - start), 'ms');", note: 'One thread means CPU-heavy code delays every callback. See <a href="blocking-event-loop.html">Blocking the event loop</a>.' },
      { label: 'async returns a promise', code: "async function getAnswer() {\n  return 42;                 // wrapped in a promise\n}\nconst p = getAnswer();\nconsole.log(p instanceof Promise, p);\nconsole.log('value:', await p);\n\nasync function fail() { throw new Error('nope'); }\nconst r = await Promise.allSettled([getAnswer(), fail()]);\nconsole.log(r.map((x) => x.status));" }
    ]
  },
  gotchas: [
    { trap: 'Forgetting <code>await</code>', code: "async function handler(req) {\n  const user = getUser(req.id);   // a Promise, not a user!\n  console.log(user.name);         // undefined\n}", why: 'An async function always returns a promise. Without <code>await</code> you hold the promise, and any rejection goes unhandled.', fix: 'Await every promise you depend on. ESLint’s <code>no-floating-promises</code> (typescript-eslint) and <code>require-await</code> rules catch most cases.' },
    { trap: 'Awaiting in sequence when the work is independent', code: "const user = await getUser(id);     // 100 ms\nconst orders = await getOrders(id); // +100 ms", why: 'Each <code>await</code> waits before the next call even starts.', fix: 'Start both, then await together: <code>await Promise.all([getUser(id), getOrders(id)])</code>. More in <a href="callbacks-promises-async.html">Callbacks → promises → async/await</a>.' },
    { trap: 'Unhandled promise rejections crash Node', code: "fetchData();   // rejects, nobody catches\n// Node 15+: process exits with the error", why: 'Since Node 15 the default <code>--unhandled-rejections=throw</code> mode turns an unhandled rejection into an uncaught exception.', fix: 'Always <code>await</code> inside try/catch or attach <code>.catch</code>. See <a href="async-errors.html">Async error handling</a>.' },
    { trap: 'Mixing callbacks and try/catch', code: "try {\n  fs.readFile('x', (err, d) => { throw err; });\n} catch (e) { /* never runs */ }", why: 'The callback runs later, on a fresh stack, after the try block has finished.', fix: 'Handle <code>err</code> inside the callback, or switch to <code>fs/promises</code> and <code>await</code> inside try.' },
    { trap: 'Using sync APIs in a server', code: "app.get('/report', (req, res) => {\n  const data = fs.readFileSync('big.csv');   // every request waits\n});", why: '<code>*Sync</code> functions block the only JavaScript thread. Fine for startup scripts and CLIs, harmful inside request handlers.', fix: 'Use the promise API (<code>node:fs/promises</code>) or streams in request paths.' },
    { trap: '<code>await</code> in <code>forEach</code>', code: "items.forEach(async (i) => await save(i));\nconsole.log('all saved?');   // no", why: '<code>forEach</code> ignores returned promises, so nothing waits for the saves.', fix: '<code>for (const i of items) await save(i)</code> (one at a time) or <code>await Promise.all(items.map(save))</code> (all at once).' }
  ],
  scenarios: [
    { title: 'One slow endpoint freezes the whole API', symptom: 'Every endpoint, including <code>/health</code>, stalls for 2–3 s whenever someone hits <code>/export</code>. Kubernetes starts failing liveness probes.', diagnose: 'Event-loop lag metrics (<code>perf_hooks.monitorEventLoopDelay</code>) spike to seconds. The handler uses <code>fs.readFileSync</code> and builds a huge string in a loop.', cause: 'Synchronous I/O and CPU work run on the single JavaScript thread, so no other callback can run until they finish.', fix: 'Use async I/O and streams; move CPU-heavy work to a worker thread. See <a href="blocking-event-loop.html">Blocking the event loop</a>.', fixCode: "const { pipeline } = require('node:stream/promises');\napp.get('/export', async (req, res) => {\n  res.setHeader('content-type', 'text/csv');\n  await pipeline(fs.createReadStream('export.csv'), res);\n});" },
    { title: 'Page loads got 3× slower after a refactor', symptom: 'A dashboard API went from 120 ms to 380 ms after being rewritten from callbacks to async/await.', diagnose: 'Tracing shows three downstream calls now happening one after another instead of overlapping.', cause: 'The callback version fired all three calls at once. The rewrite awaited each before starting the next.', fix: 'Start independent calls together and await them with <code>Promise.all</code>; use <code>allSettled</code> if one failure shouldn’t sink the rest.', fixCode: "const [profile, orders, recs] = await Promise.all([\n  profileApi.get(id),\n  ordersApi.list(id),\n  recsApi.forUser(id),\n]);" }
  ],
  puzzles: [
    { kind: 'predict', q: 'What prints?', code: "console.log('A');\nsetTimeout(() => console.log('B'), 0);\nconsole.log('C');", options: ['A B C', 'A C B', 'B A C', 'A C (B never runs)'], answer: 1, explain: 'The timer callback can only run once the call stack is empty, after the whole script has run. 0 ms just means “as soon as possible”.', run: true, expect: 'A\nC\nB' },
    { kind: 'predict', q: 'Promise vs timer. What prints?', code: "console.log('1');\nsetTimeout(() => console.log('timeout'), 0);\nPromise.resolve().then(() => console.log('promise'));\nconsole.log('2');", options: ['1 2 timeout promise', '1 2 promise timeout', '1 promise 2 timeout', '1 timeout promise 2'], answer: 1, explain: 'Synchronous code first (1, 2). Then the microtask queue is drained (promise) before the event loop moves on to the timer task (timeout).', run: true, expect: '1\n2\npromise\ntimeout' },
    { kind: 'predict', q: 'Where does an async function pause? What prints?', code: "async function f() {\n  console.log('f start');\n  await null;\n  console.log('f end');\n}\nconsole.log('before');\nf();\nconsole.log('after');", options: ['before, f start, f end, after', 'before, after, f start, f end', 'before, f start, after, f end', 'f start, before, after, f end'], answer: 2, explain: 'An async function runs synchronously up to its first <code>await</code>. Then it returns a pending promise to the caller, which continues (“after”). The rest of <code>f</code> resumes as a microtask.', run: true, expect: 'before\nf start\nafter\nf end' },
    { kind: 'predict', q: '<code>Promise.all</code> order. What prints?', code: "const wait = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));\n(async () => {\n  const r = await Promise.all([wait(30, 'slow'), wait(10, 'fast')]);\n  console.log(r);\n})();", options: ["[ 'fast', 'slow' ]", "[ 'slow', 'fast' ]", "'fast'", "'slow'"], answer: 1, explain: 'Results come back in the order of the input array, not the order of completion. Total time is about the slowest (30 ms), not the sum.', run: true, expect: "[ 'slow', 'fast' ]" },
    { kind: 'predict', q: 'Errors with await. What prints?', code: "const fail = () => Promise.reject(new Error('nope'));\n(async () => {\n  try {\n    await fail();\n    console.log('not here');\n  } catch (e) {\n    console.log('caught', e.message);\n  } finally {\n    console.log('done');\n  }\n})();", options: ['not here, done', 'caught nope, done', 'done, then an unhandled rejection', 'caught nope'], answer: 1, explain: '<code>await</code> turns a rejected promise into a thrown error at that line, so ordinary try/catch/finally works.', run: true, expect: 'caught nope\ndone' },
    { kind: 'predict', q: 'From callback to promise. What prints?', code: "const { promisify } = require('node:util');\nfunction legacy(x, cb) {\n  setTimeout(() => (x < 0 ? cb(new Error('neg')) : cb(null, x * 2)), 1);\n}\nconst p = promisify(legacy);\np(2).then((v) => console.log('ok', v));\np(-1).catch((e) => console.log('err', e.message));", options: ['ok 4, err neg', 'err neg, ok 4', 'ok 4 only', 'ok 2, err neg'], answer: 0, explain: '<code>promisify</code> wraps an error-first callback API: <code>cb(err)</code> rejects, <code>cb(null, value)</code> fulfils. Both timers have the same delay, so they fire in creation order.', run: true, expect: 'ok 4\nerr neg' },
    { kind: 'predict', q: 'An async function’s return value. What prints?', code: "async function g() {\n  return 1;\n}\nconst r = g();\nconsole.log(r instanceof Promise, typeof r);\nr.then((v) => console.log(v));", options: ['false number, 1', 'true object, 1', 'true promise, 1', 'false object, undefined'], answer: 1, explain: 'An async function always returns a promise, even when it returns a plain value. <code>typeof</code> a promise is <code>\'object\'</code>. The value arrives via <code>then</code> or <code>await</code>.', run: true, expect: 'true object\n1' },
    { kind: 'predict', q: 'Blocking the loop. What prints?', code: "const start = Date.now();\nsetTimeout(() => console.log('timer late?', Date.now() - start >= 100), 0);\nwhile (Date.now() - start < 100) {}\nconsole.log('loop done');", options: ['timer late? false, loop done', 'loop done, timer late? false', 'loop done, timer late? true', 'timer late? true, loop done'], answer: 2, explain: 'The busy loop holds the only JavaScript thread for 100 ms, so the 0 ms timer can’t run until it ends. Timers are a minimum delay, never a guarantee.', run: true, expect: 'loop done\ntimer late? true' }
  ],
  interview: [
    { q: 'Why is Node called non-blocking, if it’s single-threaded?', a: '<p>Your JavaScript runs on one thread, but I/O isn’t done by that thread. Network I/O uses the OS’s event notification (epoll, kqueue, IOCP); file I/O, DNS lookups and some crypto use libuv’s small thread pool (4 threads by default). The JS thread only runs callbacks when results are ready, so it never sits idle waiting. See <a href="node-architecture.html">Node architecture</a>.</p>', lvl: 'core' },
    { q: 'Explain the event loop in simple terms.', a: '<p>A loop that, whenever the call stack is empty, takes the next ready callback (an expired timer, a finished I/O operation, …) and runs it to completion. After each callback it drains the microtask queue (promise callbacks). It repeats until there is no pending work, then the process exits. Phases are covered in <a href="event-loop-phases.html">Event-loop phases</a>.</p>', lvl: 'core' },
    { q: 'Callbacks vs promises vs async/await?', a: '<ul><li><b>Callbacks</b>: simple, but nesting gets deep, and errors must be checked by hand in every callback.</li><li><b>Promises</b>: composable values, chained with <code>.then</code>, one <code>.catch</code> for the chain, combinators like <code>Promise.all</code>.</li><li><b>async/await</b>: syntax over promises that reads like synchronous code and uses try/catch.</li></ul>', lvl: 'core' },
    { q: 'What are the states of a promise?', a: '<p>Pending, then settled: either fulfilled with a value or rejected with a reason. It settles only once; later <code>resolve</code>/<code>reject</code> calls are ignored. Callbacks attached after settlement still run (asynchronously).</p>', lvl: 'core' },
    { q: 'How do you run several async operations in parallel?', a: '<p>Start them all, then <code>await Promise.all([...])</code>, which rejects as soon as one fails. <code>Promise.allSettled</code> waits for all and reports each outcome. <code>Promise.race</code> settles with the first to settle, and <code>Promise.any</code> with the first success.</p>', fu: 'How would you limit concurrency to 5 at a time? (A small pool/queue, or a library like p-limit.)', lvl: 'core' },
    { q: 'What does an async function return, and when does its code run?', a: '<p>It always returns a promise. Its body runs synchronously until the first <code>await</code>; the rest runs later as a microtask after the awaited promise settles. A <code>throw</code> inside it becomes a rejection, never a synchronous exception.</p>', lvl: 'core' },
    { q: 'Why does a promise callback run before a setTimeout(0) callback?', a: '<p>Promise callbacks are microtasks; timers are tasks. After the current task (the script, or a callback) finishes, Node drains all microtasks before going back to the event loop for the next task.</p>', lvl: 'core' },
    { q: 'How does this compare to Java?', a: '<p>Classic Spring MVC uses a thread per request and blocking calls; the OS scheduler juggles threads. Node uses one thread and callbacks. Java 21 virtual threads give blocking-style code with cheap threads, which is close to what <code>await</code> gives you in Node. See <a href="node-vs-java.html">Node vs Java for services</a>.</p>', lvl: 'core' },
    { q: 'What happens to an unhandled promise rejection in Node 22?', a: '<p>With the default <code>--unhandled-rejections=throw</code> (since Node 15), Node emits <code>unhandledRejection</code>; if no listener handles it, it is raised as an uncaught exception and the process exits with code 1.</p>', lvl: 'deep' },
    { q: 'What kind of work hurts a Node server most?', a: '<p>Long synchronous CPU work: big JSON parsing, crypto in a loop, regexes with catastrophic backtracking, sync file APIs. While it runs, no other request is served. Split the work, stream it, or move it to <a href="worker-threads-cluster.html">worker threads</a>.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'async service code', lang: 'js', code: `const fsp = require('node:fs/promises');

async function loadUserReport(userId) {
  // two independent calls: run them in parallel
  const [user, orders] = await Promise.all([
    fetch(\`https://api.example.com/users/\${userId}\`).then((r) => r.json()),
    fetch(\`https://api.example.com/orders?user=\${userId}\`).then((r) => r.json()),
  ]);
  const report = { name: user.name, orders: orders.length };
  await fsp.writeFile(\`report-\${userId}.json\`, JSON.stringify(report));
  return report;
}

// CommonJS has no top-level await: use an async main
(async () => {
  try {
    console.log(await loadUserReport(7));
  } catch (err) {
    console.error('report failed:', err.message);
    process.exitCode = 1;
  }
})();` },
    { title: 'Java equivalent (CompletableFuture)', lang: 'java', code: `CompletableFuture<User> user = CompletableFuture.supplyAsync(() -> api.user(userId));
CompletableFuture<List<Order>> orders = CompletableFuture.supplyAsync(() -> api.orders(userId));

Report report = user.thenCombine(orders,
        (u, os) -> new Report(u.name(), os.size()))
    .join();                         // blocks this thread; Node's await doesn't

Files.writeString(Path.of("report-" + userId + ".json"), mapper.writeValueAsString(report));`, note: 'A promise is roughly a <code>CompletableFuture</code>. <code>Promise.all</code> ≈ <code>allOf</code>/<code>thenCombine</code>; <code>await</code> ≈ <code>join()</code> but without holding a thread.' },
    { title: 'Java 21 virtual threads', lang: 'java', code: `try (var scope = Executors.newVirtualThreadPerTaskExecutor()) {
    Future<User> user = scope.submit(() -> api.user(userId));          // blocking call,
    Future<List<Order>> orders = scope.submit(() -> api.orders(userId)); // cheap thread
    var report = new Report(user.get().name(), orders.get().size());
}`, note: 'Virtual threads make blocking code cheap, which is the Java answer to the same problem Node solves with an event loop.' }
  ]
});

IA.register({
  track: 'nodejs',
  slug: 'blocking-event-loop',
  title: 'Blocking the event loop',
  tagline: 'Node runs all your JavaScript on <b>one thread</b>. While one callback computes, <b>every other request waits</b>: no I/O callbacks, no timers, no health checks. A 200 ms <code>JSON.stringify</code> is a 200 ms outage for everyone on that process.',
  tldr: {
    problem: 'p99 latency jumps from 20 ms to 2 s while average CPU looks fine. Kubernetes restarts pods because <code>/healthz</code> times out. One user’s big upload or one nasty regex slows every other user.',
    model: 'The event loop can only run the next callback after the current one returns. So the latency of <b>any</b> request ≥ the longest synchronous stretch that started before it. <b>Event-loop delay</b> (or lag) measures exactly that. The fixes: do less per callback, split work and <code>await setImmediate()</code> between chunks, or move CPU work off the main thread.',
    hook: '“Does wrapping CPU work in a Promise make it non-blocking?” No. The executor runs synchronously, and <code>.then</code> callbacks run on the same thread. Only another thread (a Worker, the libuv pool, another process) runs in parallel.',
    facts: [
      { v: '1', l: 'thread runs all JavaScript callbacks in a Node process (each Worker adds its own)' },
      { v: '4', l: 'default libuv thread-pool size (<code>UV_THREADPOOL_SIZE</code>) shared by async fs, dns.lookup, crypto.pbkdf2/scrypt and zlib' },
      { v: 'ns', l: '<code>perf_hooks.monitorEventLoopDelay()</code> reports its histogram (min, max, mean, percentiles) in nanoseconds' }
    ]
  },
  intro: {
    what: 'Picture a single cashier serving a long queue. Each customer is a callback: a request handler, a timer, a database reply. As long as each one is quick, the queue moves and everyone is happy. If one customer pays with a bag of coins and the cashier counts them all, the whole queue stops. In Node, “counting coins” is any long synchronous work: a big loop, <code>JSON.parse</code> of a huge body, a <code>*Sync</code> file call, a slow regex.',
    analogy: { icon: '🧾', title: 'One cashier, one queue', text: 'The cashier is the main thread. Other staff (the libuv pool, the kernel) can fetch goods in the back, in parallel, but only the cashier can serve. Counting coins at the till blocks everyone. A good cashier either asks a colleague to count (a Worker), or counts 20 coins, serves the next customer, then counts 20 more (chunking with <code>setImmediate</code>).' },
    steps: [
      { t: 'Find the long stretch', d: 'Anything CPU-heavy on the request path: sorting large arrays, crypto, compression, parsing, templates, regexes.' },
      { t: 'Measure event-loop delay', d: 'It tells you how late callbacks run. Export it as a metric.', code: "const { monitorEventLoopDelay } = require('node:perf_hooks');\nconst h = monitorEventLoopDelay({ resolution: 20 });\nh.enable();\nsetInterval(() => {\n  console.log('p99 ms', h.percentile(99) / 1e6);\n  h.reset();\n}, 10_000).unref();" },
      { t: 'Avoid *Sync APIs after start-up', d: '<code>readFileSync</code> at boot is fine. In a request handler it blocks everyone. <code>node --trace-sync-io</code> prints a warning for each one.' },
      { t: 'Split or move the work', d: 'Chunk it and yield with <code>await setImmediate()</code> from <code>node:timers/promises</code>, or send it to a Worker thread. See <a href="worker-threads-cluster.html">Worker threads &amp; cluster</a>.' }
    ],
    terms: [
      ['main thread', 'The one thread that runs your JS callbacks and the event loop.'],
      ['blocking', 'Running long enough that other callbacks can’t run on time.'],
      ['event-loop delay / lag', 'How late a callback runs compared with when it could have run.'],
      ['ELU', 'Event-loop utilization: the share of time the loop is busy running code rather than idle waiting for I/O.'],
      ['*Sync API', 'A Node API that finishes before it returns (<code>fs.readFileSync</code>, <code>crypto.pbkdf2Sync</code>, <code>zlib.gzipSync</code>).'],
      ['ReDoS', 'A regular expression that takes exponential time on some inputs.']
    ]
  },
  visual: {
    title: 'One CPU job, many small requests, one thread',
    caption: 'Requests (blue) arrive every 30 ms and each needs 10 ms of CPU. At 60 ms a 250 ms CPU job arrives. Pick how to run it and press Play or Step. Watch the main-thread lane, each request’s wait, and the event-loop delay chart.'
  },
  gotchas: [
    { trap: 'Wrapping CPU work in a Promise', code: `function hash(data) {\n  return new Promise((resolve) => resolve(expensiveSha(data)));  // runs right now\n}\nawait hash(big);   // blocked the loop anyway`, why: 'A promise is a way to <i>wait</i>, not a thread. The executor runs synchronously, and so does every <code>.then</code> callback.', fix: 'Use an API that runs off-thread (<code>crypto.subtle.digest</code>, async <code>crypto.scrypt</code>, async <code>zlib</code>), a Worker, or chunk the work.' },
    { trap: 'Yielding with await or nextTick', code: `for (const row of rows) {\n  work(row);\n  await null;   // or process.nextTick / Promise.resolve()\n}`, why: 'Microtasks and nextTicks run <b>before</b> the loop goes back to timers or I/O. Yielding this way lets other promise callbacks run but never lets a socket be read.', fix: '<code>await setImmediate()</code> (from <code>node:timers/promises</code>) every N items. The check phase comes after poll, so pending I/O gets a turn.' },
    { trap: 'JSON on big payloads', code: `app.get('/catalog', (req, res) => {\n  res.json(catalog);   // 40 MB object → JSON.stringify on every request\n});`, why: '<code>JSON.parse</code> and <code>JSON.stringify</code> are synchronous and linear in size. Tens of MB take tens to hundreds of ms, and allocate a lot, so GC adds more.', fix: 'Serialize once and cache the string or Buffer; paginate; stream NDJSON; limit request body size (<code>express.json({ limit: \'1mb\' })</code>).' },
    { trap: '*Sync calls in request handlers', code: `app.post('/login', (req, res) => {\n  const hash = crypto.pbkdf2Sync(pw, salt, 600_000, 32, 'sha256');  // blocks\n});`, why: 'Every <code>*Sync</code> API runs on the main thread. Password hashing is designed to be slow, and with <code>pbkdf2Sync</code> the whole process waits for it.', fix: 'Use the async variant (<code>crypto.pbkdf2</code>, <code>crypto.scrypt</code>), which runs on the libuv pool. Under load, size the pool (<code>UV_THREADPOOL_SIZE</code>) or use a worker pool.' },
    { trap: 'Catastrophic regex backtracking (ReDoS)', code: `const EMAIL = /^([a-zA-Z0-9]+\\.?)+@example\\.com$/;\nEMAIL.test('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!');   // exponential time`, why: 'V8’s default regex engine backtracks. Nested quantifiers on a failing input can take seconds or minutes, with the loop blocked the whole time.', fix: 'Limit input length before matching, avoid nested quantifiers, test patterns with a ReDoS checker, or use a linear-time engine (the <code>re2</code> package). See <a href="security.html">Node security</a>.' },
    { trap: 'Logging huge objects synchronously', why: '<code>console.log</code> formats the whole object with <code>util.inspect</code> on the main thread, and writes to files and terminals are synchronous on POSIX. Logging a 10 MB response body can take longer than handling the request.', fix: 'Log identifiers and sizes, not bodies. Use an async logger (pino with a transport runs the writing in a worker).' },
    { trap: 'Trusting average CPU', why: 'A process at 30% average CPU can still block for 500 ms every few seconds. Averages hide the stalls that drive p99.', fix: 'Alert on event-loop delay percentiles (p99, max) and on ELU, not just CPU.' }
  ],
  scenarios: [
    { title: 'p99 spikes on a cached endpoint',
      symptom: 'The <code>/catalog</code> endpoint reads from an in-memory cache, yet p99 latency for <b>all</b> endpoints jumps to 1.5 s during peak. Event-loop delay p99 tracks it closely.',
      diagnose: `node --cpu-prof server.js     # run load, stop, open the .cpuprofile\n# flame graph: a wide JSON.stringify frame under the /catalog handler\n\n// quick check\nconsole.time('ser'); JSON.stringify(catalog); console.timeEnd('ser');   // ser: 180ms`,
      cause: 'The cache holds the catalog as an object, and every request serializes 35 MB of it. Ten concurrent requests serialize back to back, and every other request waits behind them.',
      fix: 'Serialize once when the cache is refreshed and send the Buffer (optionally pre-gzipped, with an ETag). Paginate for clients that don’t need everything.',
      fixCode: `let body: Buffer; let etag: string;\nfunction refresh(catalog: Catalog) {\n  body = zlib.gzipSync(JSON.stringify(catalog));   // once per refresh, not per request\n  etag = '"' + crypto.createHash('sha1').update(body).digest('base64url') + '"';\n}\napp.get('/catalog', (req, res) => {\n  if (req.headers['if-none-match'] === etag) return res.status(304).end();\n  res.set({ 'content-encoding': 'gzip', 'content-type': 'application/json', etag }).send(body);\n});`, lang: 'ts' },
    { title: 'Health checks fail during a login storm',
      symptom: 'At 9 am, the pods fail liveness probes and are restarted, which makes the storm worse. Logs show <code>/login</code> handlers taking 3–8 s.',
      diagnose: `node --trace-sync-io server.js\n# (node:1) WARNING: Detected use of sync API\n#     at pbkdf2Sync (node:internal/crypto/pbkdf2)\n#     at hashPassword (/app/auth.js:12)`,
      cause: 'Password checks use <code>pbkdf2Sync</code> with a high iteration count. Each login blocks the loop for tens of ms; a burst of logins blocks it for seconds, so <code>/healthz</code> can’t answer.',
      fix: 'Switch to the async API so hashing runs on the libuv pool, cap concurrency, and keep liveness probes cheap with a generous timeout.',
      fixCode: `import { pbkdf2 } from 'node:crypto';\nimport { promisify } from 'node:util';\nconst pbkdf2Async = promisify(pbkdf2);\n\nexport async function verify(pw: string, salt: Buffer, expected: Buffer) {\n  const got = await pbkdf2Async(pw, salt, 600_000, 32, 'sha256');   // libuv pool\n  return crypto.timingSafeEqual(got, expected);\n}\n// pool has 4 threads by default: set UV_THREADPOOL_SIZE before start if hashing dominates`, lang: 'ts' },
    { title: 'One request pins a core at 100%',
      symptom: 'A single pod goes to 100% CPU and stops responding for minutes. Other pods are fine. It happens a few times a week.',
      diagnose: `# attach to the stuck process\nkill -USR1 <pid>          # opens the inspector on 127.0.0.1:9229\n# DevTools → Pause: the stack is inside RegExp.prototype.test\n#   at validateEmail (validators.js:8)`,
      cause: 'An email validation regex with nested quantifiers hits catastrophic backtracking on a crafted 40-character input.',
      fix: 'Bound input length, rewrite the pattern without nested quantifiers, or use RE2. Add a fuzz test for every user-facing regex.',
      fixCode: `import RE2 from 're2';\nconst EMAIL = new RE2('^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\\\\.[A-Za-z]{2,}$');\n\nexport function isEmail(s: string) {\n  return s.length <= 320 && EMAIL.test(s);   // linear time, bounded input\n}`, lang: 'ts' }
  ],
  puzzles: [
    { kind: 'predict', q: 'A zero-delay timer, then a 100 ms busy loop. What prints?', code: `const start = Date.now();\nsetTimeout(() => {\n  console.log('timer fired after >= 100ms:', Date.now() - start >= 100);\n}, 0);\nwhile (Date.now() - start < 100) {}\nconsole.log('loop done');`, options: ['timer fired after >= 100ms: false, then loop done', 'loop done, then timer fired after >= 100ms: true', 'loop done, then timer fired after >= 100ms: false', 'The timer interrupts the loop'], answer: 1, explain: 'JavaScript callbacks are never interrupted. The timer was due after 1 ms, but it can only run once the main script returns, at least 100 ms later. Timer delays are a <b>minimum</b>.', run: true, expect: 'loop done\ntimer fired after >= 100ms: true' },
    { kind: 'predict', q: 'CPU work “inside a Promise”. What prints?', code: `function heavy() {\n  return new Promise((resolve) => {\n    let s = 0;\n    for (let i = 0; i < 1e6; i++) s += i;\n    console.log('computed');\n    resolve(s);\n  });\n}\nsetTimeout(() => console.log('timeout'), 0);\nheavy().then(() => console.log('then'));\nconsole.log('sync end');`, options: ['sync end, computed, then, timeout', 'computed, sync end, then, timeout', 'sync end, timeout, computed, then', 'computed, sync end, timeout, then'], answer: 1, explain: 'The Promise executor runs <b>synchronously</b> inside <code>new Promise</code>, so the loop runs before <code>sync end</code>. <code>.then</code> is a microtask, which runs before the timer.', run: true, expect: 'computed\nsync end\nthen\ntimeout' },
    { kind: 'predict', q: 'Splitting work with <code>process.nextTick</code>. What does the timer see?', code: `let n = 0;\nsetTimeout(() => console.log('timer sees n =', n), 0);\nfunction work() {\n  n++;\n  if (n < 1000) process.nextTick(work);\n}\nwork();`, options: ['timer sees n = 1', 'timer sees n = 1000', 'a number between 1 and 1000, varying by run', 'timer sees n = 0'], answer: 1, explain: 'The nextTick queue is drained completely, including ticks added while draining, before the loop moves on. So all 1000 steps run before any timer or I/O. Chunking with nextTick doesn’t yield; use <code>setImmediate</code>.', run: true, expect: 'timer sees n = 1000' },
    { kind: 'predict', q: '<code>await</code> in a loop vs a timer. What prints?', code: `setTimeout(() => console.log('timeout'), 0);\n(async () => {\n  for (let i = 0; i < 3; i++) {\n    await null;\n    console.log('step', i);\n  }\n})();`, options: ['timeout, step 0, step 1, step 2', 'step 0, timeout, step 1, step 2', 'step 0, step 1, step 2, timeout', 'The order varies'], answer: 2, explain: 'Each <code>await null</code> resumes as a microtask, and the microtask queue drains completely before the timers phase. An <code>await</code> of something already resolved never lets timers or I/O in.', run: true, expect: 'step 0\nstep 1\nstep 2\ntimeout' },
    { kind: 'concept', q: 'On a machine with 8 cores and default settings, you start 8 <code>crypto.pbkdf2()</code> (async) calls at once, each needing about 100 ms of CPU. Roughly when do they finish?', options: ['All 8 at about 100 ms', '4 at about 100 ms, the other 4 at about 200 ms', 'One every 100 ms, the last at 800 ms', 'All at about 800 ms'], answer: 1, explain: 'Async pbkdf2 runs on the libuv thread pool, which has <b>4</b> threads by default no matter how many cores you have. The first 4 run in parallel; the rest queue. <code>UV_THREADPOOL_SIZE=8</code> (set before the pool starts) would finish all at about 100 ms.' },
    { kind: 'concept', q: 'Which of these does <b>not</b> block the main thread while it works?', options: ['<code>JSON.parse(hugeString)</code>', '<code>zlib.gzip(buf, cb)</code>', '<code>fs.readFileSync(path)</code>', '<code>arr.sort()</code> on 5 M items'], answer: 1, explain: 'Async zlib calls compress on the libuv pool and call back when done. <code>JSON.parse</code>, <code>sort</code> and every <code>*Sync</code> API run on the main thread.' },
    { kind: 'concept', q: '<code>performance.eventLoopUtilization()</code> reports 0.97 over the last minute, and event-loop delay p99 is 400 ms. What does that tell you?', options: ['The process is waiting on slow I/O', 'The loop is busy running JS almost all the time: CPU-bound on the main thread', 'The thread pool is saturated', 'Garbage collection is disabled'], answer: 1, explain: 'ELU is the share of time the loop was <i>not</i> idle in the poll phase. Near 1 with high delay means the main thread is saturated by JavaScript (or GC). Slow I/O alone gives low ELU: the loop sits idle while it waits.' },
    { kind: 'concept', q: 'Why does a long synchronous job also make Kubernetes restart the pod?', options: ['It makes the kernel drop the TCP port', 'The liveness probe’s HTTP request can’t be handled until the job returns, so the probe times out', 'Kubernetes measures CPU and kills busy pods', 'The probe runs in the same thread pool as crypto'], answer: 1, explain: 'The probe’s connection is accepted by the kernel, but the request callback needs the main thread. If the block outlasts the probe timeout × failure threshold, the kubelet restarts the container, often making the load problem worse.' }
  ],
  interview: [
    { q: 'What does “blocking the event loop” mean?', a: '<p>Running a synchronous piece of work long enough that other callbacks can’t run on time. Node has one JS thread per process, so while a callback computes, no requests are parsed, no I/O callbacks run, no timers fire. Every in-flight request’s latency goes up by the length of the block.</p>', lvl: 'core' },
    { q: 'What are the usual causes?', a: '<ul><li>CPU work: big loops, sorting, image or PDF work, crypto, compression, template rendering.</li><li><code>*Sync</code> APIs after start-up (fs, crypto, zlib, child_process).</li><li><code>JSON.parse</code>/<code>stringify</code> on large payloads.</li><li>ReDoS: catastrophic regex backtracking.</li><li>Heavy GC caused by allocation churn or a heap close to its limit.</li><li>Synchronous logging of big objects.</li></ul>', lvl: 'core' },
    { q: 'How do you measure event-loop lag in production?', a: '<p><code>perf_hooks.monitorEventLoopDelay()</code> gives a histogram (nanoseconds) of how late its internal timer fires; export p50/p99/max. <code>performance.eventLoopUtilization()</code> gives the busy ratio. Most APM agents and <code>prom-client</code>’s default metrics export both. A crude manual version: schedule a <code>setTimeout</code> every 100 ms and record how late it runs.</p>', fu: 'Why both? Lag shows how bad the stalls are; ELU shows how close the loop is to saturation even when stalls are short.', lvl: 'core' },
    { q: 'You have a 2 s CPU task in an HTTP service. Options?', a: '<ol><li>Don’t do it on the request path: precompute, cache, or move it to a job queue.</li><li>Run it in a <b>Worker</b> (a pool such as piscina) so the main loop stays free.</li><li>Split it into chunks and <code>await setImmediate()</code> between them: simple, but the task itself takes longer and still uses this process’s one core.</li><li>Use an async native API that runs on the libuv pool, when one exists.</li></ol>', lvl: 'core' },
    { q: 'Why is await setImmediate() a real yield while await Promise.resolve() is not?', a: '<p>Promise continuations are microtasks, drained right after the current callback, before the loop advances. <code>setImmediate</code> schedules a macrotask in the check phase, so the loop finishes this lap, including the poll phase where pending I/O callbacks run.</p>', lvl: 'deep' },
    { q: 'How do JSON.parse and JSON.stringify behave on large inputs?', a: '<p>Synchronous, linear in size, and allocation-heavy. Parsing tens of MB takes on the order of tens to hundreds of ms, plus GC afterwards. Defences: body-size limits, streaming parsers for big inputs, NDJSON for big outputs, caching serialized output, and moving big transforms into a Worker.</p>', lvl: 'deep' },
    { q: 'What is the libuv thread pool and how does it relate to blocking?', a: '<p>A pool (default 4 threads, <code>UV_THREADPOOL_SIZE</code> up to 1024) that runs work with no async OS interface: file system calls, <code>dns.lookup</code>, async crypto (pbkdf2, scrypt, randomBytes) and zlib. It doesn’t block the main thread, but it can saturate: slow disk or many hashes queue up behind each other, and even DNS lookups wait.</p>', lvl: 'deep' },
    { q: 'What does --trace-sync-io do?', a: '<p>It prints a warning with a stack trace every time a synchronous I/O API is used <b>after the first turn of the event loop</b>, so start-up reads are ignored and request-time ones are reported. Good for staging, too noisy for production.</p>', lvl: 'core' },
    { q: 'How would you find what is blocking, after the fact?', a: '<p>Correlate the event-loop delay spike with a CPU profile (<code>--cpu-prof</code>, or the inspector on a live process) and look for wide frames in the flame graph. Libraries like <code>blocked-at</code> capture stacks for long blocks via async hooks, at a cost. See <a href="profiling.html">Profiling Node</a>.</p>', lvl: 'deep' },
    { q: 'How is this different in a Java service?', a: '<p>In a thread-per-request servlet app, a slow request only ties up its own thread; others run on other threads and cores. The Node situation is like blocking a <b>Netty or Vert.x event-loop thread</b>. Vert.x even ships a blocked-thread checker that warns when an event-loop thread is busy longer than <code>maxEventLoopExecuteTime</code> (2 s by default). Java 21 virtual threads make blocking cheap again in Java; Node has no equivalent.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Export event-loop delay and ELU', lang: 'ts', code: `import { monitorEventLoopDelay, performance } from 'node:perf_hooks';

const h = monitorEventLoopDelay({ resolution: 20 });   // sample every 20 ms
h.enable();
let lastElu = performance.eventLoopUtilization();

setInterval(() => {
  const elu = performance.eventLoopUtilization(lastElu);   // delta since last call
  lastElu = performance.eventLoopUtilization();
  metrics.gauge('nodejs_eventloop_delay_p99_ms', h.percentile(99) / 1e6);
  metrics.gauge('nodejs_eventloop_delay_max_ms', h.max / 1e6);
  metrics.gauge('nodejs_eventloop_utilization', elu.utilization);
  h.reset();
}, 10_000).unref();`, note: 'Alert on p99 and max delay. Averages hide the stalls that hurt.' },
    { title: 'Chunk CPU work and yield to I/O', lang: 'ts', code: `import { setImmediate as yieldToLoop } from 'node:timers/promises';

export async function scoreAll(items: Item[], budgetMs = 10) {
  const out: number[] = [];
  let sliceStart = performance.now();
  for (const it of items) {
    out.push(score(it));
    if (performance.now() - sliceStart > budgetMs) {   // time-sliced, not count-sliced
      await yieldToLoop();                               // poll phase runs here
      sliceStart = performance.now();
    }
  }
  return out;
}`, note: 'This keeps latency low for others, but the task still uses this process’s single core. For real parallelism use a Worker.' },
    { title: 'Java comparison: Vert.x blocked-thread checker', lang: 'java', code: `VertxOptions opts = new VertxOptions()
    .setMaxEventLoopExecuteTime(100)
    .setMaxEventLoopExecuteTimeUnit(TimeUnit.MILLISECONDS)
    .setBlockedThreadCheckInterval(50);
Vertx vertx = Vertx.vertx(opts);
// WARN: Thread[vert.x-eventloop-thread-0] has been blocked for 154 ms, time limit is 100 ms

// Offload blocking work, like a Node Worker or the libuv pool:
vertx.executeBlocking(() -> pdfRenderer.render(doc))
     .onSuccess(pdf -> ctx.response().end(Buffer.buffer(pdf)));`, note: 'Same rule as Node. The difference: Vert.x runs several event loops (2 × cores by default), so one blocked loop doesn’t stall the whole process.' }
  ]
});

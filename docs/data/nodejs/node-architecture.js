IA.register({
  track: 'nodejs',
  slug: 'node-architecture',
  title: 'Node architecture',
  tagline: 'Node is <b>V8 + libuv + glue code</b>. Your JavaScript runs on one thread. The waiting happens in the kernel or on a small thread pool. Once you know which call goes where, most Node performance questions answer themselves.',
  tldr: {
    problem: 'People call Node “single-threaded”, then get surprised when a crypto-heavy endpoint slows down file reads, or one big <code>JSON.parse</code> freezes every request at once.',
    model: 'One <b>main thread</b> runs V8 (your JS) and the libuv <b>event loop</b>. Network I/O is <b>non-blocking</b>: the OS tells libuv when a socket is ready. File system calls, <code>dns.lookup</code>, async crypto and zlib run on libuv’s <b>thread pool</b>. Every result comes back as a callback on the main thread.',
    hook: '“Is Node single-threaded?” Your JavaScript is, per isolate. Node is not: it has pool threads, V8 helper threads for GC and compilation, and you can start <code>worker_threads</code>.',
    facts: [
      { v: '4', l: 'default libuv thread-pool size (<code>UV_THREADPOOL_SIZE</code>, max 1024). fs, dns.lookup, crypto and zlib all share it' },
      { v: '0', l: 'pool threads a TCP socket uses. Network I/O goes through epoll / kqueue / IOCP instead' },
      { v: '1', l: 'JS call stack per V8 isolate. Each <code>worker_threads</code> Worker gets its own isolate, heap and event loop' }
    ]
  },
  intro: {
    what: '<b>Node.js</b> lets you run JavaScript outside the browser, typically for servers and tools. It is a C++ program made of a few parts: <b>V8</b> (Google’s JavaScript engine, also in Chrome) runs your code; <b>libuv</b> (a C library) talks to the operating system about files, sockets and timers; and Node’s own <b>core library and bindings</b> connect the two. Your code runs on a single thread, but it rarely waits, because the waiting is handed off.',
    analogy: { icon: '🍽', title: 'One waiter, a kitchen and a buzzer', text: 'A restaurant has <b>one waiter</b> (the main thread). He takes an order and passes it on; he never stands at the stove. Drinks orders go to a bar that buzzes when they’re ready (sockets and the OS). Cooked dishes go to a kitchen with <b>four cooks</b> (the thread pool). When something is ready, the waiter delivers it. If the waiter stops to fold 500 napkins (a big synchronous loop), <i>nobody</i> gets served.' },
    steps: [
      { t: 'You call an async API', d: 'For example <code>fs.readFile(path, cb)</code>. The call returns at once; <code>cb</code> is stored for later.', code: "fs.readFile('config.json', (err, data) => {\n  console.log('got', data.length, 'bytes');\n});\nconsole.log('this prints first');" },
      { t: 'Node hands the work off', d: 'Sockets are registered with the OS, which says when data arrives. Files and some CPU-heavy calls go to libuv’s thread pool.' },
      { t: 'The event loop waits for results', d: 'When nothing is ready, the main thread sleeps inside the event loop, using no CPU.' },
      { t: 'Your callback runs on the main thread', d: 'When a result is ready, the loop calls your callback. Only one piece of JavaScript runs at a time, so you don’t need locks around normal variables.' }
    ],
    terms: [
      ['V8', 'The JavaScript engine: parser, JIT compilers, heap and garbage collector.'],
      ['libuv', 'The C library behind Node’s event loop, async I/O and thread pool.'],
      ['main thread', 'The single thread that runs your JavaScript and the event loop.'],
      ['thread pool', 'libuv’s worker threads (4 by default) for blocking work such as file reads.'],
      ['binding', 'C++ code that exposes libuv or OS features to Node’s JavaScript library.'],
      ['blocking', 'Code that keeps the main thread busy, so nothing else can run until it finishes.']
    ]
  },
  visual: {
    title: 'Follow one call through the layers',
    caption: 'Pick a call and press Play. The dot shows where the work is. Watch which calls use a <b>pool thread</b>, which use the <b>OS readiness API</b>, and which keep the <b>main thread</b> busy (red).'
  },
  gotchas: [
    { trap: 'Slow crypto slows down file reads', code: `// 4 pool threads, shared by everything below\ncrypto.pbkdf2(pw, salt, 600_000, 64, 'sha512', cb); // login\nfs.readFile('logo.png', cb);                      // static file\ndns.lookup('db.internal', cb);                    // outbound DB connect\nzlib.gzip(body, cb);                              // compression`, why: 'fs, <code>dns.lookup</code>, async crypto (<code>pbkdf2</code>, <code>scrypt</code>, <code>randomBytes</code>, key generation) and async zlib all queue on the <b>same</b> libuv pool. A login burst can fill all four threads, and your file reads wait behind it.', fix: 'Set <code>UV_THREADPOOL_SIZE</code> (for example 8–16) in the launch environment, and move heavy CPU work to a <code>worker_threads</code> pool such as Piscina.' },
    { trap: 'Wrapping CPU work in a Promise doesn’t make it parallel', code: `// still blocks the main thread for the whole loop\nconst hash = await new Promise((resolve) => resolve(slowHashInJs(input)));`, why: 'The Promise executor runs <b>synchronously</b>. Promises schedule <i>when</i> JavaScript runs; they don’t move it to another thread.', fix: 'Use a native async API that runs on the pool (<code>crypto.scrypt</code>), or a <code>worker_threads</code> Worker for your own CPU-bound JS.' },
    { trap: 'Sync APIs in request handlers', code: `app.get('/report', (req, res) => {\n  const tpl = fs.readFileSync('report.hbs', 'utf8'); // blocks every request\n  const gz = zlib.gzipSync(render(tpl));          // blocks again\n  res.end(gz);\n});`, why: '<code>*Sync</code> calls do the work on the main thread. Under load, every in-flight request waits for each one.', fix: 'Sync calls are fine at <b>startup</b> (loading config). On the request path use the async or stream versions, and cache what you can.' },
    { trap: 'Setting UV_THREADPOOL_SIZE inside the app', code: `// fragile: works only if nothing has used the pool yet\nprocess.env.UV_THREADPOOL_SIZE = '16';\nconst db = require('./db');   // may already have done dns.lookup`, why: 'libuv creates the pool <b>once</b>, on first use, and reads the variable then. Any earlier fs, DNS or crypto call fixes the size at 4.', fix: 'Set it outside the process: <code>ENV UV_THREADPOOL_SIZE=16</code> in the Dockerfile or the Kubernetes env.' },
    { trap: '“Network calls use the thread pool”', why: 'They don’t. Sockets are non-blocking and watched with epoll/kqueue/IOCP, so 10,000 idle keep-alive connections cost memory, not threads. The exception is name resolution: <code>dns.lookup()</code>, which <code>http</code>/<code>net</code> use by default, calls <code>getaddrinfo</code> on the pool.', fix: 'For many outbound hosts, reuse connections with a keep-alive agent, and consider caching DNS results or using <code>dns.resolve*()</code> (c-ares, network-based, no pool).' },
    { trap: 'Thinking the pool can run your JavaScript', why: 'Pool threads run C/C++ work that Node’s internals give them. They have no V8 isolate, so your JS (a big <code>JSON.parse</code>, a regex, a sort) always runs on the main thread.', fix: 'For CPU-bound JS use <code>worker_threads</code> (one isolate and loop per worker) or a separate service. See <a href="worker-threads-cluster.html">Worker threads & cluster</a>.' }
  ],
  scenarios: [
    { title: 'Static files get slow whenever there’s a login spike',
      symptom: 'p99 latency for <code>/assets/*</code> jumps from 5 ms to 900 ms at 9:00 every morning, when staff log in. CPU is only at 40%.',
      diagnoseLang: 'bash',
      diagnose: `# Count pool-heavy calls in flight and watch event-loop delay\nnode --cpu-prof server.js\n# Or quickly: does it go away with a bigger pool?\nUV_THREADPOOL_SIZE=16 node server.js`,
      cause: 'Async password hashing (pbkdf2, or a native bcrypt addon) fills all 4 pool threads. Static file reads queue behind the hashes. The main thread is mostly idle, which is why CPU looks fine.',
      fix: 'Raise the pool size to about the number of cores you give the container, rate-limit login attempts, and consider moving hashing to a worker pool so it can’t starve file I/O.',
      fixCode: `# Dockerfile\nENV UV_THREADPOOL_SIZE=8\n\n// login.ts: a dedicated worker pool for hashing\nimport Piscina from 'piscina';\nconst hasher = new Piscina({ filename: new URL('./hash-worker.js', import.meta.url).href, maxThreads: 4 });\nconst ok = await hasher.run({ pw, hash: user.pwHash });`, lang: 'ts' },
    { title: 'Kubernetes restarts pods during the nightly export',
      symptom: 'Liveness probes time out and pods restart while <code>/export</code> builds a 200 MB JSON report. Every other request on that pod stalls too.',
      diagnose: `import { monitorEventLoopDelay } from 'node:perf_hooks';\nconst h = monitorEventLoopDelay({ resolution: 20 });\nh.enable();\nsetInterval(() => {\n  console.log('loop delay p99 ms', (h.percentile(99) / 1e6).toFixed(1));\n  h.reset();\n}, 5000);   // shows multi-second spikes during the export`,
      cause: '<code>JSON.stringify</code> on a huge array runs for seconds on the main thread. The event loop can’t answer the probe, so the kubelet decides the pod is dead.',
      fix: 'Stream the export: read rows with a cursor and write NDJSON or JSON chunks to the response, so the loop gets control back between chunks. Or build the file in a Worker or a separate job.',
      fixCode: `import { pipeline } from 'node:stream/promises';\nimport { Readable } from 'node:stream';\n\nasync function* rows() {\n  for await (const row of db.cursor('SELECT * FROM orders')) yield JSON.stringify(row) + '\\n';\n}\nawait pipeline(Readable.from(rows()), res);`, lang: 'ts' },
    { title: 'Outbound calls hang when the corporate DNS is slow',
      symptom: 'Calls to partner APIs take 5 s+ at random, and file uploads slow down at the same time.',
      diagnose: `// time the lookup separately from the request\nconst t = performance.now();\nawait dns.promises.lookup('partner.example.com');\nconsole.log('lookup ms', performance.now() - t);`,
      cause: 'Each new connection runs <code>dns.lookup</code> → <code>getaddrinfo</code> on a pool thread. Four slow lookups occupy the whole pool, so fs work waits too.',
      fix: 'Reuse connections (keep-alive agent or undici’s pool) so lookups are rare, raise the pool size, and cache DNS answers for a short TTL.',
      fixCode: `import { Agent, setGlobalDispatcher } from 'undici';\n// fetch() in Node 22 uses undici; keep connections warm\nsetGlobalDispatcher(new Agent({ keepAliveTimeout: 30_000, connections: 50 }));`, lang: 'ts' }
  ],
  puzzles: [
    { kind: 'predict', q: 'A 10 ms timer is set, then the script spins for 200 ms. What prints?', code: `const start = Date.now();\nsetTimeout(() => {\n  console.log('timer late?', Date.now() - start >= 200);\n}, 10);\nwhile (Date.now() - start < 200) {}\nconsole.log('loop done');`, options: ['timer late? false, then loop done', 'loop done, then timer late? true', 'loop done, then timer late? false', 'timer late? true, then loop done'], answer: 1, explain: 'A timer can only run when the main thread gets back to the event loop. The busy loop holds the thread for 200 ms, so the 10 ms timer runs after it, at least 200 ms in. The delay is a <b>minimum</b>, not a promise.', run: true, expect: 'loop done\ntimer late? true' },
    { kind: 'predict', q: 'The file read finishes on a pool thread long before the busy loop ends. What prints?', code: `const fs = require('fs');\nfs.readFile(__filename, () => console.log('read done'));\nconst t = Date.now();\nwhile (Date.now() - t < 50) {}\nconsole.log('sync done');`, options: ['read done, sync done', 'sync done, read done', 'Only sync done', 'It depends on disk speed'], answer: 1, explain: 'The pool thread can finish the read in parallel, but the <b>callback</b> runs on the main thread, and that thread is busy until the loop ends. Callbacks never interrupt running JavaScript.', run: true, expect: 'sync done\nread done' },
    { kind: 'concept', q: 'Which of these uses a libuv thread-pool thread?', options: ['Reading from a TCP socket', 'fs.readFile on a regular file', 'setTimeout', 'Accepting a new HTTP connection'], answer: 1, explain: 'Disk file operations use the pool because there is no portable non-blocking file API. Sockets (including accept) are non-blocking and watched with epoll/kqueue/IOCP. Timers are kept by the event loop itself.' },
    { kind: 'concept', q: 'Default pool, a machine with 8 idle cores. Six <code>crypto.pbkdf2</code> calls start at once and each takes ~1 s of CPU. Roughly when do the callbacks fire?', options: ['All six at ~1 s', 'Four at ~1 s, two at ~2 s', 'One per second, over 6 s', 'All six at ~1.5 s'], answer: 1, explain: 'Async pbkdf2 runs on the 4-thread pool. Four run in parallel; two wait in the queue and start when a thread is free. With <code>UV_THREADPOOL_SIZE=6</code> all six would finish at about 1 s.' },
    { kind: 'bug', q: 'Does this keep the event loop free while hashing?', code: `app.post('/hash', async (req, res) => {\n  const h = await new Promise((resolve) => resolve(slowHashInJs(req.body.pw)));\n  res.send(h);\n});`, options: ['Yes: promises run on another thread', 'Yes: await yields before the hash runs', 'No: the executor and slowHashInJs run synchronously on the main thread', 'No, but only because Express is synchronous'], answer: 2, explain: 'The executor function is called <b>immediately</b>, during <code>new Promise</code>. <code>slowHashInJs</code> runs to completion on the main thread before <code>await</code> even starts. Promises change ordering, not threads.' },
    { kind: 'concept', q: 'In a plain <code>node server.js</code> process on Node 22, which is true?', options: ['There is exactly one OS thread', 'There is one main thread for JS, plus libuv pool threads (once used) and V8 helper threads', 'Node starts one thread per incoming request', 'Node runs JS on one thread per CPU core'], answer: 1, explain: 'Your JS runs on one thread, but the process has more: V8 uses background threads for GC and compilation, and libuv starts its pool the first time it is needed. Look in <code>top -H</code> or <code>/proc/&lt;pid&gt;/task</code>.' },
    { kind: 'concept', q: 'Which DNS call uses the thread pool?', options: ['dns.resolve4()', 'dns.lookup()', 'Both', 'Neither: DNS is always non-blocking'], answer: 1, explain: '<code>dns.lookup</code> calls the OS resolver (<code>getaddrinfo</code>, which honours /etc/hosts) and blocks, so it runs on the pool. <code>dns.resolve*</code> use c-ares and send DNS queries over the network without the pool. <code>http</code> and <code>net</code> use <code>lookup</code> by default.' }
  ],
  interview: [
    { q: 'Is Node.js single-threaded?', a: '<p>Your <b>JavaScript</b> runs on a single thread per isolate, so two callbacks never run at the same time. The <b>process</b> has more threads: libuv’s pool (4 by default) for fs, <code>dns.lookup</code>, crypto and zlib; V8 threads for GC and JIT; and any <code>worker_threads</code> you start, each with its own isolate and event loop.</p>', fu: 'So why don’t you need locks? (No shared mutable JS state between threads, except SharedArrayBuffer.)', lvl: 'core' },
    { q: 'What are V8 and libuv, and how do they fit together?', a: '<p><b>V8</b> compiles and runs JavaScript and manages the heap. <b>libuv</b> provides the event loop, non-blocking sockets, timers, the thread pool and cross-platform OS access. Node’s <b>C++ bindings</b> connect them: <code>lib/fs.js</code> calls into a binding, which calls libuv, and when libuv calls back the binding calls into V8 to run your callback.</p>', lvl: 'core' },
    { q: 'Which operations use the libuv thread pool?', a: '<ul><li>All async <code>fs</code> operations (except fs.watch-style notifications)</li><li><code>dns.lookup</code> (getaddrinfo)</li><li>Async crypto such as <code>pbkdf2</code>, <code>scrypt</code>, <code>randomBytes</code>, <code>generateKeyPair</code></li><li>Async <code>zlib</code></li><li>Native addons that queue work (for example bcrypt)</li></ul><p>Network sockets do <b>not</b>.</p>', lvl: 'core' },
    { q: 'How does Node handle 10,000 concurrent connections with one thread?', a: '<p>Each socket is non-blocking and registered with the OS readiness API (epoll, kqueue, IOCP). The loop blocks in one call that returns the set of ready sockets, runs the callbacks for those, and goes back to waiting. An idle connection costs some memory, not a thread. It works because each callback does a little work and returns quickly.</p>', fu: 'What breaks this model? (Any callback that runs for a long time: CPU work, sync I/O, huge JSON.)', lvl: 'core' },
    { q: 'What is a binding? How are native addons written today?', a: '<p>A binding is C++ code registered with Node that exposes native functionality to JavaScript; core uses internal ones (<code>internalBinding(\'fs\')</code>). Userland addons should use <b>Node-API</b> (N-API), which has a stable ABI, so a compiled addon keeps working across Node major versions. The old <code>process.binding()</code> is deprecated.</p>', lvl: 'deep' },
    { q: 'When would you increase UV_THREADPOOL_SIZE, and what’s the catch?', a: '<p>When pool work queues up: heavy async crypto, lots of fs work, slow <code>dns.lookup</code>. The maximum is 1024. The catches: the size is read once, when the pool is first used, so set it in the environment; more threads than cores just adds context switching for CPU work; and it doesn’t help CPU-bound <i>JavaScript</i> at all.</p>', lvl: 'deep' },
    { q: 'Compare Node’s model with Spring MVC and with Java 21 virtual threads.', a: '<p><b>Spring MVC (Tomcat)</b>: a thread per request from a pool (200 by default), and blocking calls park that thread. <b>Node</b>: one thread, non-blocking I/O, so concurrency is limited by memory and by how short each callback is, not by a thread count. <b>Virtual threads (Java 21)</b> give you blocking-style code with event-loop-like scaling, and they run on all cores. Node needs worker_threads or several processes to use more than one core for JS.</p>', lvl: 'core' },
    { q: 'How do you make Node use all CPU cores?', a: '<p>Run several processes: <code>cluster</code>, PM2, or simply more replicas in Kubernetes (usually the cleanest). For CPU-heavy tasks inside one service, use <code>worker_threads</code>. Containers often get 1–2 vCPUs per pod, so one process per pod with horizontal scaling is common.</p>', lvl: 'core' },
    { q: 'What happens, layer by layer, when you call fs.readFile?', a: '<p>lib/fs.js validates the arguments and creates a request; the binding calls <code>uv_fs_open</code>; libuv runs the blocking <code>open</code> on a pool thread. When it completes, libuv signals the loop, which (in the poll phase) runs the C++ completion, which issues the next step (fstat, read, close). After the last step your callback runs on the main thread. That is why <code>fs.readFile</code> on a big file makes several pool round trips; streams read in chunks.</p>', lvl: 'deep' },
    { q: 'How do you detect that the main thread is overloaded?', a: '<p>Measure <b>event-loop delay</b> with <code>perf_hooks.monitorEventLoopDelay()</code> (and expose p99 as a metric), plus <code>performance.eventLoopUtilization()</code>. High delay with low CPU usually means pool starvation or waiting elsewhere; high delay with one core at 100% means CPU-bound JS. See <a href="blocking-event-loop.html">Blocking the event loop</a>.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Measure event-loop health', lang: 'ts', code: `import { monitorEventLoopDelay, performance } from 'node:perf_hooks';

const delay = monitorEventLoopDelay({ resolution: 20 });
delay.enable();
let last = performance.eventLoopUtilization();

setInterval(() => {
  const elu = performance.eventLoopUtilization(last);   // delta since last sample
  last = performance.eventLoopUtilization();
  metrics.gauge('node_loop_delay_p99_ms', delay.percentile(99) / 1e6);  // ns → ms
  metrics.gauge('node_loop_utilization', elu.utilization);              // 0..1
  delay.reset();
}, 10_000).unref();   // unref: don't keep the process alive just for metrics`, note: 'Alert on p99 delay (for example > 100 ms), not on CPU alone. A blocked loop can show modest CPU on a multi-core box.' },
    { title: 'Move CPU work off the main thread', lang: 'ts', code: `// hash-worker.ts: runs in its own isolate and event loop
import { parentPort } from 'node:worker_threads';
import { scryptSync } from 'node:crypto';
parentPort!.on('message', ({ id, pw, salt }) => {
  parentPort!.postMessage({ id, hash: scryptSync(pw, salt, 64).toString('hex') });
});

// server.ts
import { Worker } from 'node:worker_threads';
const worker = new Worker(new URL('./hash-worker.js', import.meta.url));
// In production use a pool (Piscina) and handle 'error' / 'exit'.`, note: 'Sync scrypt is fine <i>inside</i> a worker: it blocks only that worker’s thread.' },
    { title: 'Java comparison: who waits where', lang: 'java', code: `// Spring MVC: one platform thread per request; blocking parks the thread
@GetMapping("/rates")
Rates rates() { return restClient.get().uri("/rates").retrieve().body(Rates.class); }

// Java 21 virtual threads (Boot 3.2+: spring.threads.virtual.enabled=true):
// same blocking code, but the carrier thread is released while waiting,
// similar to how Node's main thread moves on after starting I/O.

// Node equivalent: the await yields the single thread back to the event loop
// app.get('/rates', async (req, res) => res.json(await (await fetch(url)).json()));`, note: 'Both scale I/O-bound work well. Java also runs CPU work on all cores; Node needs workers or more processes for that.' },
    { title: 'Size the pool for the container', lang: 'bash', code: `# Dockerfile
FROM node:22-slim
ENV NODE_ENV=production \\
    UV_THREADPOOL_SIZE=8
CMD ["node", "server.js"]

# check thread count of a running process (Linux)
ls /proc/$(pgrep -f server.js)/task | wc -l` }
  ]
});

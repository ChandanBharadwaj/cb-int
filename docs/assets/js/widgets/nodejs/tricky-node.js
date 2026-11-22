/* Tricky Node: a timed drill of predict-the-output and concept questions across every Node.js topic,
   scored, with a per-topic breakdown and a review of misses linking back to the topic pages. */
IA.widget('tricky-node', (root, ctx) => {
  const { el, reduced } = ctx;
  /*Q-START*/
  const Q = [
    // ---------- Runtime: architecture ----------
    { t: 'Architecture', s: 'node-architecture', m: 'Runtime', q: 'What prints?', code: `const fs = require('node:fs');
let done = false;
fs.readFile(__filename, () => { done = true; console.log('read done'); });
console.log('sync end, done =', done);`, o: ['read done, then sync end, done = true', 'sync end, done = false, then read done', 'sync end, done = true, then read done', 'read done only'], a: 1, x: '<code>readFile</code> hands the work to libuv’s thread pool and returns at once. The callback can only run after the current script finishes and the event loop reaches the poll phase.', run: true, expect: 'sync end, done = false\nread done' },
    { t: 'Architecture', s: 'node-architecture', m: 'Runtime', q: 'Node 22, default settings. Which of these runs on the libuv <b>thread pool</b>?', o: ['Reading from a TCP socket', 'fs.readFile', 'setTimeout', 'Accepting HTTP connections'], a: 1, x: 'Network I/O uses the OS’s non-blocking mechanisms (epoll, kqueue, IOCP) directly on the loop. File system calls, <code>dns.lookup</code>, async <code>crypto</code> (pbkdf2, scrypt) and <code>zlib</code> use the pool, which has 4 threads unless <code>UV_THREADPOOL_SIZE</code> says otherwise.' },
    // ---------- Runtime: event loop ----------
    { t: 'Event loop', s: 'event-loop-phases', m: 'Runtime', q: 'Scheduled from inside an I/O callback. What prints?', code: `const fs = require('node:fs');
fs.readFile(__filename, () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
});`, o: ['timeout, immediate', 'immediate, timeout', 'either order', 'only immediate'], a: 1, x: 'The callback runs in the poll phase. The loop’s next phase is <b>check</b> (immediates); timers come only on the next lap. Inside an I/O callback the order is deterministic.', run: true, expect: 'immediate\ntimeout' },
    { t: 'Event loop', s: 'event-loop-phases', m: 'Runtime', q: 'In the <b>main module</b>: <code>setTimeout(a, 0); setImmediate(b);</code>. Which runs first?', o: ['a, always', 'b, always', 'Not deterministic', 'Neither: the process exits first'], a: 2, x: '<code>setTimeout(fn, 0)</code> is really 1 ms. Whether 1 ms has passed when the loop starts its first timers phase depends on process start-up timing, so the order can differ between runs.' },
    { t: 'Event loop', s: 'event-loop-phases', m: 'Runtime', q: 'Nested <code>setImmediate</code>. What prints?', code: `setImmediate(() => {
  console.log('A');
  setImmediate(() => console.log('C'));
});
setImmediate(() => console.log('B'));`, o: ['A, C, B', 'A, B, C', 'B, A, C', 'C, A, B'], a: 1, x: 'A check phase runs only the immediates queued when it started. C is queued during the phase, so it waits for the next lap.', run: true, expect: 'A\nB\nC' },
    // ---------- Runtime: microtasks ----------
    { t: 'Microtasks', s: 'microtasks-macrotasks', m: 'Runtime', q: 'The classic. What prints?', code: `console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
process.nextTick(() => console.log('4'));
console.log('5');`, o: ['1 5 3 4 2', '1 5 4 3 2', '1 4 3 5 2', '1 2 3 4 5'], a: 1, x: 'Synchronous code first (1, 5). Then the nextTick queue (4), then promise microtasks (3), and only then the event loop’s timers phase (2).', run: true, expect: '1\n5\n4\n3\n2' },
    { t: 'Microtasks', s: 'microtasks-macrotasks', m: 'Runtime', q: 'A nextTick scheduled from inside a promise callback. What prints?', code: `Promise.resolve()
  .then(() => {
    console.log('p1');
    process.nextTick(() => console.log('tick'));
  })
  .then(() => console.log('p2'));`, o: ['p1, tick, p2', 'p1, p2, tick', 'tick, p1, p2', 'p2, p1, tick'], a: 1, x: 'Once V8 starts draining the microtask queue it doesn’t stop until it’s empty, and p2 is added to it as soon as p1 returns. Node checks the nextTick queue again only after that.', run: true, expect: 'p1\np2\ntick' },
    { t: 'Microtasks', s: 'microtasks-macrotasks', m: 'Runtime', q: 'async/await ordering. What prints?', code: `async function a() {
  console.log('a1');
  await null;
  console.log('a2');
}
a();
Promise.resolve().then(() => console.log('p'));
console.log('sync');`, o: ['a1, a2, sync, p', 'a1, sync, a2, p', 'a1, sync, p, a2', 'sync, a1, a2, p'], a: 1, x: 'An async function runs synchronously until its first <code>await</code>. The continuation after <code>await null</code> is queued first, then <code>p</code>’s reaction, so a2 comes before p.', run: true, expect: 'a1\nsync\na2\np' },
    { t: 'Microtasks', s: 'microtasks-macrotasks', m: 'Runtime', q: 'What prints?', code: `setTimeout(() => console.log('timeout'), 0);
queueMicrotask(() => console.log('micro'));
process.nextTick(() => console.log('tick'));`, o: ['micro, tick, timeout', 'tick, micro, timeout', 'timeout, tick, micro', 'tick, timeout, micro'], a: 1, x: '<code>queueMicrotask</code> uses the same queue as promise reactions. Node drains nextTicks before microtasks, and both before going back to the loop.', run: true, expect: 'tick\nmicro\ntimeout' },
    { t: 'Microtasks', s: 'microtasks-macrotasks', m: 'Runtime', q: 'Two timers, a promise in the first (Node 11+). What prints?', code: `setTimeout(() => {
  console.log('t1');
  Promise.resolve().then(() => console.log('p1'));
}, 0);
setTimeout(() => console.log('t2'), 0);`, o: ['t1, t2, p1', 't1, p1, t2', 'p1, t1, t2', 'depends on the machine'], a: 1, x: 'Since Node 11, the microtask queue drains after <b>each</b> timer callback, as in browsers. Node 10 and earlier ran all due timers first and printed t1, t2, p1.', run: true, expect: 't1\np1\nt2' },
    // ---------- Runtime: modules ----------
    { t: 'Modules', s: 'modules-cjs-esm', m: 'Runtime', q: 'Requiring the same file twice. What prints?', code: `const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mod-')), 'counter.js');
fs.writeFileSync(file, 'let n = 0; module.exports = { inc: () => ++n };');

const a = require(file);
const b = require(file);
a.inc(); a.inc();
console.log(b.inc(), a === b);`, o: ['1 false', '3 true', '1 true', '3 false'], a: 1, x: '<code>require</code> caches modules by resolved filename. The second call returns the same exports object, so both names share one counter. Modules are effectively singletons.', run: true, expect: '3 true' },
    { t: 'Modules', s: 'modules-cjs-esm', m: 'Runtime', q: '<code>exports</code> vs <code>module.exports</code>. What prints?', code: `const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mod-')), 'm.js');
fs.writeFileSync(file, 'exports = { hi: 1 };\\nmodule.exports.ok = 2;\\n');

console.log(JSON.stringify(require(file)));`, o: ['{"hi":1}', '{"hi":1,"ok":2}', '{"ok":2}', '{}'], a: 2, x: '<code>exports</code> is just a local variable that starts out pointing at <code>module.exports</code>. Reassigning it breaks the link; <code>require</code> returns <code>module.exports</code>, which only got <code>ok</code>.', run: true, expect: '{"ok":2}' },
    { t: 'Modules', s: 'modules-cjs-esm', m: 'Runtime', q: 'A circular <code>require</code>. What prints?', code: `const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyc-'));
fs.writeFileSync(path.join(dir, 'a.js'),
  "exports.loaded = false;\\nconst b = require('./b.js');\\nconsole.log('in a, b.loaded =', b.loaded);\\nexports.loaded = true;\\n");
fs.writeFileSync(path.join(dir, 'b.js'),
  "exports.loaded = false;\\nconst a = require('./a.js');\\nconsole.log('in b, a.loaded =', a.loaded);\\nexports.loaded = true;\\n");

require(path.join(dir, 'a.js'));`, o: ['in b, a.loaded = true / in a, b.loaded = true', 'in b, a.loaded = false / in a, b.loaded = true', 'in a, b.loaded = false / in b, a.loaded = true', 'Error: circular dependency'], a: 1, x: 'a starts, requires b; b requires a and gets a’s <b>partially filled</b> exports (loaded is still false). b finishes, then a continues. CommonJS cycles never throw; they hand out unfinished objects.', run: true, expect: 'in b, a.loaded = false\nin a, b.loaded = true' },
    // ---------- Runtime: npm ----------
    { t: 'npm', s: 'npm-dependencies', m: 'Runtime', q: 'Which version does the range <code>^0.2.3</code> allow?', o: ['0.3.0', '0.2.9', '1.0.0', '0.2.2'], a: 1, x: 'Caret allows changes that don’t modify the left-most non-zero part. For 0.x that is the minor: <code>^0.2.3</code> means &gt;=0.2.3 &lt;0.3.0. (<code>^1.2.3</code> would allow up to &lt;2.0.0.)' },
    { t: 'npm', s: 'npm-dependencies', m: 'Runtime', q: 'CI runs <code>npm ci</code>. Someone edited package.json but didn’t update package-lock.json. What happens?', o: ['npm ci updates the lockfile', 'npm ci fails because package.json and the lockfile are out of sync', 'It installs from package.json and ignores the lockfile', 'It silently installs the old versions'], a: 1, x: '<code>npm ci</code> installs exactly what the lockfile says, deletes <code>node_modules</code> first, never writes the lockfile, and errors when the two files disagree. That is the point: reproducible builds.' },
    // ---------- Async: promises ----------
    { t: 'Promises', s: 'callbacks-promises-async', m: 'Async', q: '<code>all</code> vs <code>allSettled</code>. What prints?', code: `const later = (ms, v, fail) => new Promise((res, rej) =>
  setTimeout(() => (fail ? rej(new Error(v)) : res(v)), ms));

(async () => {
  try {
    await Promise.all([later(30, 'a'), later(10, 'b', true)]);
  } catch (e) {
    console.log('all:', e.message);
  }
  const r = await Promise.allSettled([later(30, 'a'), later(10, 'b', true)]);
  console.log('settled:', r.map((x) => x.status).join(','));
})();`, o: ['all: b / settled: fulfilled,rejected', 'all: a / settled: fulfilled,fulfilled', 'all: b / settled: rejected,rejected', 'all: [a, b] / settled: fulfilled,rejected'], a: 0, x: '<code>Promise.all</code> rejects with the first rejection (b, at 10 ms) and doesn’t wait for the rest; the 30 ms work keeps running anyway. <code>allSettled</code> waits for all and reports each outcome in input order.', run: true, expect: 'all: b\nsettled: fulfilled,rejected' },
    { t: 'Promises', s: 'callbacks-promises-async', m: 'Async', q: 'Sequential vs parallel awaits. What prints?', code: `const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let t = Date.now();
  for (const ms of [50, 50, 50]) await sleep(ms);
  const seq = Date.now() - t;

  t = Date.now();
  await Promise.all([50, 50, 50].map(sleep));
  const par = Date.now() - t;

  console.log(seq >= 150, par < 120);
})();`, o: ['true true', 'false true', 'true false', 'false false'], a: 0, x: 'Awaiting inside a loop waits for each one before starting the next (≈150 ms). Starting them all and awaiting <code>Promise.all</code> overlaps the waits (≈50 ms). The classic “accidental waterfall”.', run: true, expect: 'true true' },
    { t: 'Promises', s: 'callbacks-promises-async', m: 'Async', q: 'Resolving twice. What prints?', code: `const p = new Promise((resolve) => {
  resolve('first');
  resolve('second');
  console.log('still running');
});
p.then((v) => console.log(v));`, o: ['first', 'still running, then first', 'first, then second', 'still running, then second'], a: 1, x: 'A promise settles once; later <code>resolve</code>/<code>reject</code> calls are ignored. <code>resolve</code> doesn’t return or throw, so the executor keeps going, and the reaction runs later as a microtask.', run: true, expect: 'still running\nfirst' },
    // ---------- Async: errors ----------
    { t: 'Async errors', s: 'async-errors', m: 'Async', q: '<code>return</code> vs <code>return await</code> inside try. What prints?', code: `async function load() { throw new Error('db down'); }
async function a() { try { return load(); } catch { return 'fallback'; } }
async function b() { try { return await load(); } catch { return 'fallback'; } }

(async () => {
  console.log(await b());
  console.log(await a().catch((e) => 'escaped: ' + e.message));
})();`, o: ['fallback / fallback', 'fallback / escaped: db down', 'escaped: db down / fallback', 'escaped: db down / escaped: db down'], a: 1, x: 'In <code>a</code>, the try block ends as soon as the (pending) promise is returned, so its rejection skips the catch. <code>return await</code> keeps the function suspended inside the try until the promise settles.', run: true, expect: 'fallback\nescaped: db down' },
    { t: 'Async errors', s: 'async-errors', m: 'Async', q: 'Node 22 with an <code>unhandledRejection</code> listener. What prints?', code: `process.on('unhandledRejection', (r) => console.log('unhandled:', r.message));
Promise.reject(new Error('lost'));
setTimeout(() => console.log('alive'), 10);`, o: ['alive', 'unhandled: lost / alive', 'unhandled: lost (then exit 1)', 'alive / unhandled: lost'], a: 1, x: 'In the default <code>throw</code> mode, Node first emits <code>\'unhandledRejection\'</code>; only if nobody listens does it raise an uncaught exception and exit 1. Here a listener exists, so the process carries on.', run: true, expect: 'unhandled: lost\nalive' },
    { t: 'Async errors', s: 'async-errors', m: 'Async', q: 'Aborting a promise timer. What prints?', code: `const { setTimeout: sleep } = require('node:timers/promises');

(async () => {
  try {
    await sleep(1000, null, { signal: AbortSignal.timeout(20) });
    console.log('slept');
  } catch (e) {
    console.log(e.name, e.code);
  }
})();`, o: ['TimeoutError 23', 'AbortError ABORT_ERR', 'Error undefined', 'slept (after 1 s)'], a: 1, x: 'Node’s promise APIs reject with an <code>AbortError</code> (code <code>ABORT_ERR</code>) and put the signal’s reason (here a <code>TimeoutError</code>) in <code>e.cause</code>. The pending timer is cleared, so the process exits right away.', run: true, expect: 'AbortError ABORT_ERR' },
    // ---------- Async: streams ----------
    { t: 'Streams', s: 'streams-backpressure', m: 'Async', q: 'Backpressure signal. What prints?', code: `const { Writable } = require('node:stream');

const w = new Writable({
  highWaterMark: 4,
  write(chunk, enc, cb) { setImmediate(cb); },   // a slow destination
});
console.log(w.write('ab'), w.write('cd'), w.writableLength);`, o: ['true true 4', 'true false 4', 'false false 4', 'true false 2'], a: 1, x: '<code>write()</code> returns <code>false</code> once the buffered length reaches <code>highWaterMark</code> (4 bytes here). The data is still accepted; <code>false</code> means “stop and wait for <code>\'drain\'</code>”.', run: true, expect: 'true false 4' },
    { t: 'Streams', s: 'streams-backpressure', m: 'Async', q: '<code>src.pipe(gzip).pipe(res)</code> and gzip emits an error. What happens?', o: ['All three are destroyed and the error reaches res', 'Only gzip emits the error (crashing if unhandled); src and res are not destroyed and may leak', 'pipe() retries the chunk', 'res receives an error event'], a: 1, x: '<code>pipe()</code> forwards data, not errors or cleanup. Use <code>stream.pipeline()</code> (or <code>stream/promises</code>), which destroys every stage on error and gives you one place to handle it.' },
    // ---------- Async: EventEmitter ----------
    { t: 'EventEmitter', s: 'eventemitter', m: 'Async', q: 'What prints?', code: `const { EventEmitter } = require('node:events');
const e = new EventEmitter();
e.on('x', () => console.log('listener'));
console.log('before');
e.emit('x');
console.log('after');`, o: ['before, after, listener', 'before, listener, after', 'listener, before, after', 'before, after'], a: 1, x: '<code>emit()</code> calls listeners <b>synchronously</b>, in order, before it returns. Nothing about EventEmitter is asynchronous by itself.', run: true, expect: 'before\nlistener\nafter' },
    { t: 'EventEmitter', s: 'eventemitter', m: 'Async', q: 'An <code>\'error\'</code> event with no listener. What prints?', code: `const { EventEmitter } = require('node:events');
const e = new EventEmitter();
try {
  e.emit('error', new Error('boom'));
} catch (err) {
  console.log('thrown:', err.message);
}
console.log(e.emit('other'));`, o: ['nothing, then false', 'thrown: boom, then false', 'thrown: boom, then true', 'the process crashes'], a: 1, x: 'Emitting <code>\'error\'</code> without a listener throws the error from <code>emit()</code>. Outside a try that crashes the process, which is why every stream and socket needs an error handler. <code>emit</code> returns whether any listener existed.', run: true, expect: 'thrown: boom\nfalse' },
    { t: 'EventEmitter', s: 'eventemitter', m: 'Async', q: '<code>prependListener</code> and <code>once</code>. What prints (one value per line)?', code: `const EventEmitter = require('node:events');
const e = new EventEmitter();
e.on('x', () => console.log('a'));
e.prependListener('x', () => console.log('b'));
e.once('x', () => console.log('c'));
e.emit('x');
e.emit('x');
console.log(e.listenerCount('x'));`, o: ['a b c a b 2', 'b a c b a 2', 'b a c b a c 3', 'a c b a b 2'], a: 1, x: 'Listeners run in array order; <code>prependListener</code> puts b first. The <code>once</code> listener is removed before it runs, so the second emit skips it, leaving 2 listeners.', run: true, expect: 'b\na\nc\nb\na\n2' },
    // ---------- Performance: blocking ----------
    { t: 'Blocking', s: 'blocking-event-loop', m: 'Performance', q: 'What prints?', code: `const start = Date.now();
setTimeout(() => {
  console.log('timer after', Date.now() - start >= 50 ? '>= 50 ms' : '< 50 ms');
}, 0);

const end = Date.now() + 50;
while (Date.now() < end) {}   // synchronous work`, o: ['timer after < 50 ms', 'timer after >= 50 ms', 'the timer never fires', 'timer after 0 ms exactly'], a: 1, x: 'A timer’s delay is a minimum. Nothing can run until the synchronous loop gives the thread back, so the 0 ms timer fires after 50 ms. Measure this in production with <code>monitorEventLoopDelay</code>.', run: true, expect: 'timer after >= 50 ms' },
    { t: 'Blocking', s: 'blocking-event-loop', m: 'Performance', q: 'An endpoint calls <code>JSON.parse</code> on 80 MB request bodies. Under load, what do you see first?', o: ['High memory, but latency stays low', 'Event-loop delay spikes: every request on that process waits and health checks time out', 'The libuv thread pool is exhausted', 'Only that endpoint gets slower'], a: 1, x: '<code>JSON.parse</code> is synchronous and runs on the main thread, so a big parse stalls every request in the process. Limit body size, stream-parse, or move it to a worker.' },
    // ---------- Performance: workers ----------
    { t: 'Workers', s: 'worker-threads-cluster', m: 'Performance', q: 'Messages to a worker. What prints?', code: `const { Worker } = require('node:worker_threads');

const w = new Worker(\`
  const { parentPort } = require('node:worker_threads');
  parentPort.on('message', (m) => { m.n++; parentPort.postMessage(m); });
\`, { eval: true });

const msg = { n: 1 };
w.on('message', (m) => {
  console.log(m.n, msg.n, m === msg);
  w.terminate();
});
w.postMessage(msg);`, o: ['2 2 true', '2 1 false', '1 1 false', '2 2 false'], a: 1, x: '<code>postMessage</code> uses the structured clone algorithm: the worker gets a <b>copy</b>, increments it, and sends back another copy. The original is untouched. Share memory only explicitly (SharedArrayBuffer) or transfer ownership (ArrayBuffer transfer list).', run: true, expect: '2 1 false' },
    { t: 'Workers', s: 'worker-threads-cluster', m: 'Performance', q: 'Shared memory. What prints?', code: `const { Worker } = require('node:worker_threads');

const sab = new SharedArrayBuffer(4);
const arr = new Int32Array(sab);

const w = new Worker(\`
  const { workerData } = require('node:worker_threads');
  Atomics.add(new Int32Array(workerData), 0, 5);
\`, { eval: true, workerData: sab });

w.on('exit', () => console.log(arr[0]));`, o: ['0', '5', 'undefined', 'DataCloneError'], a: 1, x: 'A <code>SharedArrayBuffer</code> is shared, not copied: both threads see the same bytes. Use <code>Atomics</code> for safe updates. This is the one way worker threads share state directly.', run: true, expect: '5' },
    // ---------- Performance: V8 ----------
    { t: 'V8 & GC', s: 'v8-gc-leaks', m: 'Performance', q: 'A WeakMap cache keyed by a string. What prints?', code: `const cache = new WeakMap();
try {
  cache.set('user:42', { name: 'Ada' });
  console.log('stored');
} catch (e) {
  console.log(e.constructor.name);
}`, o: ['stored', 'TypeError', 'RangeError', 'undefined'], a: 1, x: 'WeakMap keys must be objects (or non-registered symbols), because primitives can’t be garbage-collected in a meaningful way. For a size-bounded string cache use an LRU; for per-object metadata a WeakMap avoids leaks.', run: true, expect: 'TypeError' },
    { t: 'V8 & GC', s: 'v8-gc-leaks', m: 'Performance', q: 'Most objects created while handling a request die young. Which V8 collector deals with them cheaply?', o: ['Mark-Compact of the old space', 'Scavenge, the minor GC of the young generation', 'Reference counting', 'The libuv thread pool'], a: 1, x: 'The young generation is small and collected by a copying Scavenger: cost is proportional to <i>surviving</i> objects. Objects that survive twice are promoted to old space, which Mark-Compact handles less often and at higher cost.' },
    // ---------- Performance: profiling ----------
    { t: 'Profiling', s: 'profiling', m: 'Performance', q: '<code>diagnostics_channel</code>. What prints?', code: `const dc = require('node:diagnostics_channel');
const ch = dc.channel('app:query');

console.log(ch.hasSubscribers);
dc.subscribe('app:query', (msg) => console.log('saw', msg.sql));
console.log(ch.hasSubscribers);
ch.publish({ sql: 'select 1' });`, o: ['true / true / saw select 1', 'false / true / saw select 1', 'false / false', 'false / true (publish is asynchronous)'], a: 1, x: 'Libraries publish to named channels; APM tools subscribe. <code>hasSubscribers</code> lets publishers skip building messages nobody reads. <code>publish</code> calls subscribers synchronously.', run: true, expect: 'false\ntrue\nsaw select 1' },
    { t: 'Profiling', s: 'profiling', m: 'Performance', q: 'In a CPU flame graph, what does the <b>width</b> of a frame mean?', o: ['How many times the function was called', 'The share of sampled CPU time spent in it, including its callees', 'Memory it allocated', 'Wall-clock time including I/O waits'], a: 1, x: 'A sampling profiler records stacks at intervals; width is the fraction of samples containing that frame. Wide plateaus at the top are where CPU goes. Time spent waiting on I/O doesn’t show up in a CPU profile.' },
    // ---------- Web ----------
    { t: 'Express & Fastify', s: 'express-fastify', m: 'Web', q: 'Express <b>4</b>, Node 22: <code>app.get(\'/a\', async () =&gt; { throw new Error(\'x\') })</code>. A request arrives. What happens?', o: ['500 from the default error handler', 'The request hangs, and the unhandled rejection crashes the process', '404', 'Express logs it and responds 200'], a: 1, x: 'Express 4 ignores the promise a handler returns. Nobody responds, and since Node 15 an unhandled rejection exits the process. Express 5 forwards rejections to <code>next(err)</code>.' },
    { t: 'Express & Fastify', s: 'express-fastify', m: 'Web', q: 'A Fastify route has a 200 response schema with properties <code>id</code> and <code>name</code>. The handler returns <code>{ id, name, passwordHash }</code>. The client receives:', o: ['all three fields', '<code>{ id, name }</code>', 'a 500 serialization error', '<code>{ id, name, passwordHash: null }</code>'], a: 1, x: 'The response schema compiles a fast-json-stringify serializer that writes only the declared properties. Extra fields are silently dropped, a safety net against leaking data.' },
    { t: 'HTTP', s: 'http-internals', m: 'Web', q: 'An ALB (idle timeout 60 s) in front of Node with the default <code>keepAliveTimeout</code>. Sporadic 502s. Why?', o: ['Node’s event loop is blocked', 'Node closes idle sockets after 5 s; the ALB sometimes reuses one at that moment and gets a reset', 'The ALB doesn’t support keep-alive', 'HTTP/2 is negotiated by mistake'], a: 1, x: 'The side that sends requests must close idle connections first. Set <code>server.keepAliveTimeout</code> above the LB’s idle timeout (e.g. 65 s).' },
    { t: 'HTTP', s: 'http-internals', m: 'Web', q: 'What does the server advertise?', code: `const http = require('node:http');
const server = http.createServer((req, res) => res.end('ok'));
server.keepAliveTimeout = 10_000;

server.listen(0, () => {
  const agent = new http.Agent({ keepAlive: true });
  http.get({ port: server.address().port, agent }, (res) => {
    console.log(res.headers.connection, res.headers['keep-alive']);
    res.resume();
    res.on('end', () => { agent.destroy(); server.close(); });
  });
});`, o: ['keep-alive timeout=10', 'keep-alive timeout=10000', 'close undefined', 'keep-alive timeout=5'], a: 0, x: 'The <code>Keep-Alive</code> hint is in seconds. Well-behaved clients (undici) use it to retire sockets before the server closes them.', run: true, expect: 'keep-alive timeout=10' },
    { t: 'Security', s: 'security', m: 'Web', q: 'A naive deep merge and a different payload. What prints?', code: `function merge(t, s) {
  for (const k in s) {
    if (s[k] && typeof s[k] === 'object') {
      if (!t[k]) t[k] = {};
      merge(t[k], s[k]);
    } else t[k] = s[k];
  }
}
merge({}, JSON.parse('{"constructor":{"prototype":{"polluted":"yes"}}}'));
console.log(({}).polluted);`, o: ['undefined', 'yes', 'TypeError', 'false'], a: 1, x: '<code>t.constructor</code> is the inherited <code>Object</code> function and <code>Object.prototype</code> is its <code>prototype</code>, so the merge writes onto the shared prototype without ever seeing <code>__proto__</code>. Block all three keys, or better, validate the shape.', run: true, expect: 'yes' },
    { t: 'Security', s: 'security', m: 'Web', q: 'Which regex can backtrack catastrophically on a long non-matching input?', o: ['/^\\w+$/', '/^(\\w+\\s?)*$/', '/^[\\w\\s]{1,100}$/', '/^\\w+(\\s\\w+)*$/'], a: 1, x: 'In <code>(\\w+\\s?)*</code> the space is optional, so a run of letters can be split between iterations in exponentially many ways. The last option is unambiguous because each repetition must start with whitespace.' },
    // ---------- Production ----------
    { t: 'Shutdown', s: 'graceful-shutdown', m: 'Production', q: '<code>CMD ["node", "server.js"]</code>, no signal handlers in the app. <code>docker stop</code>:', o: ['Node exits at once with 143', 'SIGTERM is ignored; after 10 s Docker sends SIGKILL (exit 137)', 'Node exits 0', 'Docker sends SIGINT instead'], a: 1, x: 'Node is PID 1, and the kernel doesn’t apply default signal actions to PID 1. Install a SIGTERM handler and/or run an init such as tini (<code>docker run --init</code>).' },
    { t: 'Shutdown', s: 'graceful-shutdown', m: 'Production', q: 'A timer scheduled in an <code>exit</code> handler. What prints?', code: `process.on('exit', (code) => {
  setTimeout(() => console.log('never'), 0);
  console.log('exit', code);
});
console.log('main');`, o: ['main, exit 0, never', 'main, exit 0', 'exit 0, main', 'main, never, exit 0'], a: 1, x: 'By the time <code>\'exit\'</code> fires, the event loop is done: only synchronous code runs. Async cleanup belongs in your SIGTERM handler (or <code>beforeExit</code>), not in <code>exit</code>.', run: true, expect: 'main\nexit 0' },
    { t: 'TypeScript', s: 'typescript-node', m: 'Production', q: 'Strip-only mode. <code>app.ts</code> has <code>import { User, load } from \'./users.ts\'</code>, where <code>User</code> is an interface. Result?', o: ['Works: unused imports are removed', 'SyntaxError: the module does not provide an export named \'User\'', 'A TypeScript error at startup', '<code>User</code> is undefined, no error'], a: 1, x: 'Stripping is per file, so it can’t know <code>User</code> is a type and keeps the import. ES module linking then fails. Write <code>import { type User, load }</code> and enable <code>verbatimModuleSyntax</code>.' },
    { t: 'TypeScript', s: 'typescript-node', m: 'Production', q: '<code>node --experimental-strip-types app.ts</code>, and app.ts contains <code>const n: number = \'x\';</code>. What happens?', o: ['Node prints a type error and exits', 'It runs: types are erased, never checked', 'Node falls back to tsc', 'n is coerced to NaN with a warning'], a: 1, x: 'Node only erases types. Type checking is <code>tsc --noEmit</code>’s job, in CI or your editor.' },
    { t: 'Testing', s: 'testing-node', m: 'Production', q: '<code>mock.timers.runAll()</code>. What prints?', code: `const { mock } = require('node:test');

mock.timers.enable({ apis: ['setTimeout'] });
setTimeout(() => console.log('b'), 200);
setTimeout(() => console.log('a'), 100);
mock.timers.runAll();
console.log('done');
mock.timers.reset();`, o: ['b, a, done', 'a, b, done', 'done, a, b', 'done'], a: 1, x: '<code>runAll()</code> advances the fake clock until the queue is empty, firing timers in due-time order, synchronously, before it returns.', run: true, expect: 'a\nb\ndone' },
    { t: 'Testing', s: 'testing-node', m: 'Production', q: '<code>node --test</code> (Node 22) with several test files. How do they run by default?', o: ['Sequentially in one process', 'Each file in its own child process, several at a time', 'All in worker threads sharing a heap', 'Interleaved in one process'], a: 1, x: 'Per-file process isolation keeps module caches and globals apart; concurrency defaults to available parallelism minus one. Open handles keep a file’s process alive, so close pools in <code>after()</code>.' },
    { t: 'Node vs Java', s: 'node-vs-java', m: 'Production', q: 'Spring MVC with 200 Tomcat threads; every request calls a provider. 150 req/s arrive, and the provider’s latency rises from 0.2 s to 2 s. What happens?', o: ['Nothing: 150 is less than 200', 'About 300 requests need to be in flight; the pool saturates and everything queues', 'CPU saturates first', 'Virtual threads turn on automatically'], a: 1, x: 'Little’s law: in-flight = rate × latency = 150 × 2 = 300 &gt; 200 threads. Blocking threads cap concurrency; Node, WebFlux or virtual threads don’t, but you still need timeouts and bulkheads.' },
    { t: 'Node vs Java', s: 'node-vs-java', m: 'Production', q: 'Java 21: a virtual thread does blocking I/O inside a <code>synchronized</code> block. What happens?', o: ['It unmounts as usual', 'It pins its carrier thread while it waits', 'Deadlock', 'IllegalStateException'], a: 1, x: 'On Java 21–23 a virtual thread holding a monitor can’t unmount, so it blocks the carrier OS thread too. JDK 24 (JEP 491) fixed this for <code>synchronized</code>.' }
  ];
  /*Q-END*/
  const MODS = ['All', ...new Set(Q.map((q) => q.m))];
  if (!document.getElementById('w-tkn-style')) {
    document.head.append(el('style', { id: 'w-tkn-style', text: `
.w-tkn-bar { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; margin: 8px 0; }
.w-tkn-bar div { height: 100%; background: var(--accent); }
.w-tkn-bar div.low { background: var(--err); }
.w-tkn-opts { display: grid; gap: 6px; margin-top: 10px; }
.w-tkn-opts button { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 9px; padding: 9px 12px; font-size: 14px; cursor: pointer; overflow-wrap: anywhere; }
.w-tkn-opts button:hover:not(:disabled) { border-color: var(--accent); }
.w-tkn-opts button.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 15%, transparent); }
.w-tkn-opts button.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 15%, transparent); }
.w-tkn-opts button:disabled { cursor: default; }
.w-tkn-q { font-size: 16px; margin: 6px 0 8px; }
.w-tkn-rev { border-top: 1px solid var(--border); padding: 10px 0; }
.w-tkn-rev:first-child { border-top: 0; }
.w-tkn-brk { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; margin-top: 8px; }
.w-tkn-brk a { display: block; font-size: 12.5px; border: 1px solid var(--border); border-radius: 8px; padding: 5px 8px; background: var(--surface-2); color: var(--text-2); text-decoration: none; }
.w-tkn-brk a b { font-family: var(--mono); color: var(--text); }
.w-tkn-brk a.low { border-color: var(--err); }
.w-tkn-brk a:hover { border-color: var(--accent); }
` }));
  }
  let mod = 'All'; let count = 10; let secs = 60; let gen = 0; let deck = []; let i = 0; let score = 0; let misses = []; let left = 0; let answered = false; let started = false; let tick = null;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segT = seg(MODS.map((t) => [t, t]), () => mod, (v) => { mod = v; reset(); }, 'Module');
  const segN = seg([[10, '10 questions'], [25, '25'], [Q.length, `all ${Q.length}`]], () => count, (v) => { count = v; reset(); }, 'Number of questions');
  const segS = seg([[90, 'Slow · 90 s'], [60, 'Normal · 60 s'], [30, 'Fast · 30 s']], () => secs, (v) => { secs = v; reset(); }, 'Time per question');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Start' }); const bStep = el('button', { class: 'btn', text: 'Skip ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const card = el('div', { class: 'card', style: { padding: '14px', marginTop: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segT), el('div', { class: 'w-controls' }, segN, el('span', { class: 'tiny', text: 'time per question' }), segS),
    el('div', { class: 'w-controls' }, bPlay, bStep, bReset), stats, card, narr);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function shuffle(a) { const r = a.slice(); for (let j = r.length - 1; j > 0; j--) { const m = Math.floor(Math.random() * (j + 1)); [r[j], r[m]] = [r[m], r[j]]; } return r; }
  function renderStats() { stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `question <b>${Math.min(i + 1, deck.length)}</b>/${deck.length}` }), el('span', { class: 'w-stat', html: `score <b>${score}</b>` }), el('span', { class: 'w-stat', html: `missed <b>${misses.length}</b>` }), el('span', { class: 'w-stat', html: `time <b>${started && !answered ? left + ' s' : '–'}</b>` })); }
  function stopTimer() { if (tick) { clearInterval(tick); tick = null; } }
  function show() {
    const q = deck[i]; answered = false; left = secs; card.innerHTML = '';
    const bar = el('div'); const barWrap = el('div', { class: 'w-tkn-bar' }, bar);
    const opts = el('div', { class: 'w-tkn-opts' });
    card.append(el('div', { class: 'w-controls', style: { marginBottom: '0' } }, el('span', { class: 'pill accent', text: q.t }), q.run ? el('span', { class: 'pill', text: 'runnable program' }) : null, el('span', { class: 'tiny', text: `#${i + 1}` })), barWrap, el('div', { class: 'w-tkn-q', html: q.q }));
    if (q.code) card.append(ctx.codeBox(q.code, 'js'));
    q.o.forEach((o, j) => { const b = el('button', { html: `<b>${'ABCD'[j]}.</b> ${o.includes('<code>') ? o : ctx.esc(o)}` }); b.addEventListener('click', () => answer(j)); opts.append(b); });
    card.append(opts);
    const paint = () => { bar.style.width = (left / secs) * 100 + '%'; bar.className = left <= 10 ? 'low' : ''; if (!reduced) bar.style.transition = 'width 1s linear'; };
    paint(); renderStats(); say('Pick an answer before the bar runs out. Skip counts as a miss.');
    stopTimer(); const g = gen;
    tick = setInterval(() => { if (g !== gen || answered) { stopTimer(); return; } left--; paint(); renderStats(); if (left <= 0) answer(-1); }, 1000);
    card.opts = opts;
  }
  function answer(j) {
    if (answered || !started) return; answered = true; stopTimer();
    const q = deck[i]; const ok = j === q.a;
    if (ok) score++; else misses.push({ q, j });
    [...card.opts.children].forEach((b, m) => { b.disabled = true; if (m === q.a) b.classList.add('ok'); else if (m === j) b.classList.add('bad'); });
    card.append(el('div', { class: 'pz-exp', html: (j === -1 ? '<b>Time’s up.</b> ' : j === -2 ? '<b>Skipped.</b> ' : ok ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.x + ` <a href="${q.s}.html">More: ${ctx.esc(q.t)} →</a>` }));
    bStep.textContent = i + 1 < deck.length ? 'Next ›' : 'Finish ›'; renderStats();
    say(ok ? 'Correct. Press Next.' : 'Read the explanation, then press Next.');
  }
  function next() {
    if (!started) return;
    if (!answered) { answer(-2); return; }
    i++; bStep.textContent = 'Skip ›';
    if (i >= deck.length) return finish();
    show();
  }
  const optHtml = (o) => (o.includes('<code>') ? o : ctx.esc(o));
  function finish() {
    started = false; stopTimer(); bStep.disabled = true; bPlay.textContent = '▶ Again'; card.innerHTML = '';
    const by = {}; deck.forEach((q) => { by[q.t] = by[q.t] || { ok: 0, n: 0, s: q.s }; by[q.t].n++; if (!misses.some((mm) => mm.q === q)) by[q.t].ok++; });
    card.append(el('h3', { text: `Score: ${score} / ${deck.length}`, style: { margin: '0 0 4px' } }), el('div', { class: 'tiny', text: 'Per topic (click to open the topic page):' }),
      el('div', { class: 'w-tkn-brk' }, Object.entries(by).map(([t, v]) => el('a', { href: v.s + '.html', class: v.ok < v.n ? 'low' : '', html: `${ctx.esc(t)} <b>${v.ok}/${v.n}</b>` }))));
    if (misses.length) {
      card.append(el('h4', { text: 'Review your misses', style: { margin: '14px 0 4px' } }));
      misses.forEach(({ q, j }) => { const r = el('div', { class: 'w-tkn-rev' }, el('div', { html: `<span class="pill">${ctx.esc(q.t)}</span> ${q.q}` }));
        if (q.code) r.append(ctx.codeBox(q.code, 'js'));
        r.append(el('div', { class: 'tiny', html: `You: ${j < 0 ? (j === -1 ? 'time ran out' : 'skipped') : optHtml(q.o[j])} · Correct: <b>${optHtml(q.o[q.a])}</b>` }),
          el('div', { class: 'pz-exp', html: q.x + ` <a href="${q.s}.html">Revisit ${ctx.esc(q.t)} →</a>` }));
        card.append(r); });
    } else card.append(el('p', { text: `No misses. Try all ${Q.length} on Fast.` }));
    renderStats(); say(`Done: ${score}/${deck.length}. ` + (misses.length ? 'Your misses are listed above, each with a link back to its topic.' : ''));
  }
  function reset() {
    gen++; stopTimer(); started = false; answered = false; i = 0; score = 0; misses = [];
    const pool = Q.filter((q) => mod === 'All' || q.m === mod); deck = shuffle(pool).slice(0, count);
    bPlay.textContent = '▶ Start'; bStep.textContent = 'Skip ›'; bStep.disabled = true; card.innerHTML = '';
    card.append(el('p', { html: `<b>${deck.length}</b> question${deck.length === 1 ? '' : 's'} (${mod === 'All' ? 'all modules' : mod}), <b>${secs} s</b> each. Predict the output in your head, as in an interview: no running code.`, style: { margin: 0 } }));
    renderStats(); say('Choose a module, how many questions and the time limit, then press Start.');
  }
  bPlay.addEventListener('click', () => { reset(); started = true; bStep.disabled = false; bPlay.textContent = '↻ Restart'; show(); });
  bStep.addEventListener('click', next);
  bReset.addEventListener('click', reset);
  reset();
});

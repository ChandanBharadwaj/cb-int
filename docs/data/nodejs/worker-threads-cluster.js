IA.register({
  track: 'nodejs',
  slug: 'worker-threads-cluster',
  title: 'Worker threads & cluster',
  tagline: 'Two ways to use more than one core. <b>Worker threads</b> run JavaScript in parallel <i>inside</i> one process, each with its own event loop and heap, talking by message. <b>cluster</b> forks whole <i>processes</i> that share a server port. In Kubernetes, the third option often wins: more pods.',
  tldr: {
    problem: 'A CPU-heavy endpoint blocks the event loop. Someone adds <code>cluster</code> or PM2 <code>-i max</code> in a container with one CPU, or spawns a Worker per request, or shares a 200 MB object with a worker and wonders why the main thread stalls while sending it.',
    model: 'A Worker is a separate V8 isolate on its own thread: no shared JS objects. <code>postMessage</code> <b>copies</b> data (structured clone), <b>transfers</b> an <code>ArrayBuffer</code> (moves ownership, no copy), or passes a <code>SharedArrayBuffer</code> that both sides <b>share</b> and coordinate with <code>Atomics</code>. cluster forks N processes; the primary hands incoming connections to them, round-robin by default.',
    hook: '“Worker threads or cluster?” Workers for <b>CPU-bound work</b> inside a service (with a pool). cluster/PM2 to use several cores for <b>request handling</b> on one VM. In Kubernetes, usually neither: one process per container, scale replicas.',
    facts: [
      { v: '3', l: 'ways to pass data to a Worker: copy (structured clone), transfer (ArrayBuffer, MessagePort), share (SharedArrayBuffer)' },
      { v: 'SCHED_RR', l: 'cluster’s default scheduling on every platform except Windows: the primary accepts connections and deals them out round-robin' },
      { v: 'Node 18.14', l: '<code>os.availableParallelism()</code> (also 19.4+): the number of CPUs the process should use, preferred over <code>os.cpus().length</code>' }
    ]
  },
  intro: {
    what: 'Node runs your JavaScript on one thread, so one process uses about one CPU core for JS. When you need more, you have two built-in tools. <b>Worker threads</b> start extra threads in the same process; each runs its own copy of the JS engine and its own event loop, and you send it messages. <b>cluster</b> starts several copies of your whole server as separate processes that all listen on the same port.',
    analogy: { icon: '🏢', title: 'Colleagues in one office vs branch offices', text: 'Workers are colleagues in the same office: each has their own desk and notes (heap), and you pass them photocopies (clone), hand over the original folder (transfer), or both write on one shared whiteboard (SharedArrayBuffer) with a rule about taking turns (Atomics). cluster opens branch offices: complete copies of the business, with a receptionist (the primary) sending each new customer to the next branch.' },
    steps: [
      { t: 'Start a Worker', d: 'Give it a file (or code) and some initial data. It runs in parallel with the main thread.', code: "const { Worker } = require('node:worker_threads');\nconst w = new Worker('./resize.js', { workerData: { width: 800 } });" },
      { t: 'Talk with messages', d: 'Both sides call <code>postMessage</code> and listen for <code>\'message\'</code>. The data is copied.', code: "w.postMessage({ path: 'a.jpg' });\nw.on('message', (r) => console.log('done', r));\nw.on('error', (e) => console.error(e));" },
      { t: 'Avoid copies for big binary data', d: 'Transfer an <code>ArrayBuffer</code> (<code>postMessage(buf, [buf])</code>) or share a <code>SharedArrayBuffer</code>.' },
      { t: 'Reuse workers', d: 'Starting a Worker takes time and memory. Keep a pool sized to the cores you have (for example with <code>piscina</code>).' },
      { t: 'Or fork processes', d: '<code>cluster</code> or PM2 run N copies of the server on one machine. In Kubernetes, prefer one process per pod and more replicas.' }
    ],
    terms: [
      ['isolate', 'An independent instance of the V8 engine with its own heap. Each Worker has one.'],
      ['structured clone', 'The algorithm <code>postMessage</code> uses to deep-copy values between threads.'],
      ['transfer list', 'Objects whose ownership moves to the receiver instead of being copied.'],
      ['SharedArrayBuffer', 'Raw memory that several threads can read and write at the same time.'],
      ['Atomics', 'Operations on shared memory that can’t be interrupted halfway (add, compareExchange, wait, notify).'],
      ['cluster primary', 'The parent process that forks workers and hands them connections.']
    ]
  },
  visual: {
    title: 'Copy, transfer, share, or fork',
    caption: 'Pick a mode and press Play or Step. <b>Clone</b>, <b>Transfer</b> and <b>Shared</b> show the main thread and one Worker with their separate heaps. <b>cluster</b> shows a primary process handing connections to worker processes and replacing one that crashes.'
  },
  gotchas: [
    { trap: 'Using workers for I/O-bound work', why: 'Database calls, HTTP calls and file reads are already asynchronous; the main thread just waits for them. Moving them to a Worker adds message overhead and a second event loop without any gain.', fix: 'Use Workers only for CPU-bound JavaScript: parsing, image or PDF processing, compression in JS, crypto in JS, heavy computations.' },
    { trap: 'A new Worker per request', code: `app.post('/resize', (req, res) => {\n  const w = new Worker('./resize.js', { workerData: req.body });  // new isolate every time\n  w.once('message', (img) => res.send(img));\n});`, why: 'Each Worker boots a new V8 isolate and Node environment, loads modules, and has its own heap. Under load you get start-up latency on every request and an unbounded number of threads.', fix: 'Use a fixed pool (piscina, or your own) sized to <code>os.availableParallelism()</code> minus one, with a bounded queue so overload is rejected rather than buffered.' },
    { trap: 'Cloning huge objects', code: `worker.postMessage(hugeArrayOfObjects);   // 200 MB graph`, why: 'Structured clone serializes on the sending thread and deserializes on the receiving thread. For a big object graph the main thread is blocked while it serializes, and you have two copies in memory.', fix: 'Send IDs and let the worker load data itself, transfer <code>ArrayBuffer</code>s (<code>postMessage(buf, [buf])</code>), or put the data in a <code>SharedArrayBuffer</code>.' },
    { trap: 'Expecting classes and functions to survive postMessage', why: 'Structured clone copies plain data: objects, arrays, Map, Set, Date, RegExp, typed arrays, Error. Prototypes are dropped (a class instance arrives as a plain object), and functions throw <code>DataCloneError</code>.', fix: 'Send plain DTOs and rebuild objects on the other side.' },
    { trap: 'Shared memory without Atomics', code: `const c = new Int32Array(sab);\nc[0]++;   // in two threads: read, add, write → lost updates`, why: '<code>c[0]++</code> is three steps. Two threads can read the same value and both write value + 1.', fix: 'Use <code>Atomics.add(c, 0, 1)</code>, <code>Atomics.compareExchange</code>, and <code>Atomics.wait</code>/<code>notify</code> for coordination. Prefer messages unless you really need shared memory.' },
    { trap: 'cluster or PM2 inside a container with a CPU limit', why: '<code>-i max</code> and <code>os.cpus().length</code> see the host’s cores, not the pod’s CPU limit. Eight processes in a 1-CPU pod fight over one CPU’s worth of quota and get throttled.', fix: 'In Kubernetes, run one Node process per container and scale with replicas and an HPA. If you must fork, size by <code>os.availableParallelism()</code> and the CPU limit.' },
    { trap: 'In-memory state with cluster', why: 'Each cluster worker is a separate process with its own memory. Sessions, caches, rate-limit counters and WebSocket rooms are per worker, so behaviour depends on which worker a request lands on.', fix: 'Keep shared state in Redis or the database, or use sticky sessions only where a protocol needs them.' }
  ],
  scenarios: [
    { title: 'Image resizing: latency and memory explode under load',
      symptom: 'An endpoint that resizes uploaded images is fast alone but at 50 requests/s p99 goes to 6 s and RSS to 3 GB before the pod is OOM-killed.',
      diagnose: `// count threads in the process\nps -o nlwp <pid>        # 180 threads\n// code: one new Worker per request, never terminated on error paths`,
      cause: 'A Worker was created per request, so concurrency was unbounded. Each new Worker paid its start-up cost and kept its own heap, and failed requests leaked workers.',
      fix: 'Use a fixed-size pool with a bounded queue and reject (429) when it is full.',
      fixCode: `import Piscina from 'piscina';\nimport os from 'node:os';\n\nconst pool = new Piscina({\n  filename: new URL('./resize-worker.js', import.meta.url).href,\n  maxThreads: Math.max(1, os.availableParallelism() - 1),\n  maxQueue: 100,                          // beyond this, run() rejects\n});\n\napp.post('/resize', async (req, res) => {\n  try {\n    const out = await pool.run({ img: req.body, width: 800 });\n    res.type('image/jpeg').send(Buffer.from(out));\n  } catch (e) {\n    res.status(pool.queueSize >= 100 ? 429 : 500).end();\n  }\n});`, lang: 'ts' },
    { title: 'PM2 cluster mode throttled in Kubernetes',
      symptom: 'After moving from VMs to Kubernetes, latency is worse with the same traffic. Container CPU throttling metrics are high.',
      diagnose: `kubectl top pod api-7d9…          # CPU at the 1-core limit\ncat /sys/fs/cgroup/cpu.stat        # nr_throttled climbing\npm2 ls                             # 16 instances: -i max saw the node's 16 cores`,
      cause: 'The Docker image still ran <code>pm2-runtime start app.js -i max</code>. Sixteen processes shared a one-CPU limit, so the kernel throttled them all, and memory use was 16× higher too.',
      fix: 'Run one Node process per container (<code>node server.js</code> as the entry point, with an init such as tini if needed) and let Kubernetes scale replicas.',
      fixCode: `# Dockerfile\nCMD ["node", "server.js"]\n\n# deployment.yaml\nresources:\n  requests: { cpu: "1", memory: 512Mi }\n  limits:   { memory: 512Mi }\n# HPA scales replicas on CPU or on event-loop delay`, lang: 'yaml' },
    { title: 'Rate limiting lets 4× the traffic through',
      symptom: 'A per-API-key limit of 100 requests/minute lets about 400 through on one host.',
      diagnose: `// rate limiter state\nconst hits = new Map<string, number>();   // in process memory\n// server started with cluster: 4 workers`,
      cause: 'The limiter counted in a <code>Map</code> inside each cluster worker. With round-robin distribution, each of the four workers allowed 100.',
      fix: 'Move the counters to Redis (an atomic <code>INCR</code> with expiry, or a sliding-window script), shared by all processes and pods.',
      fixCode: `async function allow(key: string, limit = 100) {\n  const k = 'rl:' + key + ':' + Math.floor(Date.now() / 60_000);\n  const n = await redis.incr(k);\n  if (n === 1) await redis.expire(k, 60);\n  return n <= limit;\n}`, lang: 'ts' }
  ],
  puzzles: [
    { kind: 'predict', q: 'Transferring an <code>ArrayBuffer</code> to a Worker. What prints?', code: `const { Worker } = require('worker_threads');\nconst buf = new ArrayBuffer(8);\nconst w = new Worker(\`\n  const { parentPort } = require('worker_threads');\n  parentPort.once('message', (b) => parentPort.postMessage(b.byteLength));\n\`, { eval: true });\nw.postMessage(buf, [buf]);\nconsole.log('main sees', buf.byteLength);\nw.once('message', (n) => {\n  console.log('worker saw', n);\n  w.terminate();\n});`, options: ['main sees 8, worker saw 8', 'main sees 0, worker saw 8', 'main sees 8, worker saw 0', 'It throws: ArrayBuffers can’t be sent'], answer: 1, explain: 'Listing <code>buf</code> in the transfer list moves the memory to the worker. The sender’s ArrayBuffer is <b>detached</b> at once (byteLength 0); the receiver gets the 8 bytes without a copy.', run: true, expect: 'main sees 0\nworker saw 8' },
    { kind: 'predict', q: 'What survives structured clone? What prints?', code: `const { MessageChannel } = require('worker_threads');\nconst { port1, port2 } = new MessageChannel();\nclass Point {\n  constructor(x) { this.x = x; }\n  norm() { return this.x; }\n}\nport2.on('message', (m) => {\n  console.log(m instanceof Point, m.x, typeof m.norm);\n  port1.close();\n});\nport1.postMessage(new Point(3));\ntry {\n  port1.postMessage({ fn: () => 1 });\n} catch (e) {\n  console.log(e.name);\n}`, options: ['true 3 function, then DataCloneError', 'DataCloneError, then false 3 undefined', 'false 3 undefined (the function is dropped silently)', 'DataCloneError, then true 3 function'], answer: 1, explain: 'The second <code>postMessage</code> throws synchronously: functions can’t be cloned. The first message arrives later as a <b>plain object</b>: own data properties are copied, the prototype (and so <code>norm</code>) is not.', run: true, expect: 'DataCloneError\nfalse 3 undefined' },
    { kind: 'predict', q: 'Four workers each add 1 to a shared counter 100 000 times with <code>Atomics.add</code>. What prints?', code: `const { Worker } = require('worker_threads');\nconst sab = new SharedArrayBuffer(4);\nconst counter = new Int32Array(sab);\nconst code = \`\n  const { workerData } = require('worker_threads');\n  const c = new Int32Array(workerData);\n  for (let i = 0; i < 100000; i++) Atomics.add(c, 0, 1);\n\`;\nlet done = 0;\nfor (let i = 0; i < 4; i++) {\n  new Worker(code, { eval: true, workerData: sab }).on('exit', () => {\n    if (++done === 4) console.log(Atomics.load(counter, 0));\n  });\n}`, options: ['100000', '400000', 'Some number below 400000, varying by run', '0: each worker got a copy'], answer: 1, explain: 'A <code>SharedArrayBuffer</code> in <code>workerData</code> is shared, not copied. <code>Atomics.add</code> is an indivisible read-modify-write, so no update is lost and the result is always 400 000.', run: true, expect: '400000' },
    { kind: 'concept', q: 'Same program, but the workers do <code>c[0]++</code> instead of <code>Atomics.add</code>. What is printed?', options: ['Always 400000', 'Always 100000', 'Usually less than 400000, and it varies between runs', 'It throws: shared memory requires Atomics'], answer: 2, explain: '<code>c[0]++</code> is a separate read, add and write. When two threads interleave between the read and the write, one increment is lost. How many are lost depends on thread scheduling, so the result changes from run to run.' },
    { kind: 'concept', q: 'A service spends most of its time waiting for Postgres and two HTTP APIs. CPU is 20%. Would moving the handlers into Worker threads raise throughput?', options: ['Yes, roughly by the number of workers', 'No: the work is I/O-bound and already concurrent on one event loop', 'Yes, because each Worker has its own connection pool', 'Only with SharedArrayBuffer'], answer: 1, explain: 'One event loop can keep thousands of I/O operations in flight. Workers help when <b>JavaScript execution</b> is the bottleneck. Here the bottleneck is the database and the APIs.' },
    { kind: 'concept', q: 'With <code>cluster</code> on Linux and default settings, who accepts new TCP connections?', options: ['Each worker calls accept() on a shared socket and the kernel picks one', 'The primary accepts them and passes each to a worker, round-robin', 'The first worker accepts all connections', 'A random worker chosen by a hash of the client IP'], answer: 1, explain: 'The default <code>cluster.schedulingPolicy</code> is <code>SCHED_RR</code> on all platforms except Windows: the primary accepts and distributes. <code>SCHED_NONE</code> leaves it to the OS, which tends to be unbalanced.' },
    { kind: 'concept', q: 'In a Kubernetes Deployment with a 2-CPU limit per pod, which setup is usually best for a stateless Node API?', options: ['PM2 with <code>-i max</code> in each pod', 'One Node process per pod, more replicas, autoscaled', 'One pod with 32 cluster workers', 'Worker threads for every request'], answer: 1, explain: 'Kubernetes already does process supervision, load balancing and scaling. One process per container keeps memory limits, health checks, logs and signals simple. Use a Worker pool inside the process only for CPU-heavy tasks.' }
  ],
  interview: [
    { q: 'What is a Worker thread in Node?', a: '<p>A real OS thread running its own V8 isolate, its own Node environment and its own event loop, in the same process. It doesn’t share JS objects with the main thread; it communicates via <code>postMessage</code>/<code>MessagePort</code>, <code>workerData</code>, transferred <code>ArrayBuffer</code>s and <code>SharedArrayBuffer</code>. Errors thrown in the worker emit <code>\'error\'</code> on the <code>Worker</code> object.</p>', lvl: 'core' },
    { q: 'When should you use worker_threads?', a: '<p>For CPU-bound JavaScript that would otherwise block the loop: parsing big files, image or PDF work in JS/WASM, compression or crypto in JS, ML inference in WASM, heavy data transforms. Not for I/O, which is already asynchronous. Always use a pool with a bounded queue.</p>', lvl: 'core' },
    { q: 'Explain clone vs transfer vs SharedArrayBuffer.', a: '<ul><li><b>Clone</b>: structured clone deep-copies data. Cost is proportional to size, paid on both threads.</li><li><b>Transfer</b>: <code>postMessage(buf, [buf])</code> moves an ArrayBuffer (or MessagePort); the sender’s copy is detached. Zero copy, one owner.</li><li><b>SharedArrayBuffer</b>: both threads see the same bytes at the same time. You need <code>Atomics</code> for safe updates and coordination.</li></ul>', lvl: 'core' },
    { q: 'What does Atomics give you?', a: '<p>Indivisible operations on integer typed arrays over shared memory (<code>add</code>, <code>sub</code>, <code>compareExchange</code>, <code>load</code>, <code>store</code>), with ordering guarantees, plus <code>Atomics.wait</code>/<code>notify</code> to block a thread until a value changes. Like Java’s <code>AtomicInteger</code> and a futex. <code>Atomics.wait</code> on the main thread blocks the event loop, so use it in workers.</p>', lvl: 'deep' },
    { q: 'How does the cluster module work?', a: '<p>The primary calls <code>cluster.fork()</code> N times; each worker is a child process running the same script. When a worker calls <code>server.listen()</code>, the listening socket is owned by the primary, which (by default, except on Windows) accepts connections and passes them to workers round-robin over IPC. Workers share nothing in memory. The primary should replace workers on <code>\'exit\'</code>.</p>', lvl: 'core' },
    { q: 'What does PM2 add?', a: '<p>A process manager: cluster mode (<code>-i N</code>, built on the cluster module), automatic restarts, zero-downtime reloads, log handling and monitoring. Useful on plain VMs. In containers, the orchestrator already does restarts, scaling and logs, so <code>pm2-runtime</code> mostly adds a layer; many teams run <code>node</code> directly.</p>', lvl: 'core' },
    { q: 'When should you scale out with more pods instead?', a: '<p>Almost always for request throughput in Kubernetes: replicas give you isolation (one crash or leak hits one pod), simple resource limits, per-pod health checks and autoscaling. cluster makes sense on a large VM without an orchestrator. Worker threads still make sense inside a pod for CPU-heavy tasks, sized to the pod’s CPU, not the node’s.</p>', fu: 'How do you size a worker pool in a container? <code>os.availableParallelism()</code> and the CPU limit, not <code>os.cpus().length</code>.', lvl: 'deep' },
    { q: 'How do you handle errors and lifecycles of workers?', a: '<p>Listen for <code>\'error\'</code> (uncaught exception in the worker), <code>\'exit\'</code> (with the exit code) and <code>\'messageerror\'</code>. Use <code>resourceLimits</code> to cap a worker’s heap. Call <code>worker.terminate()</code> on shutdown, and <code>unref()</code> idle workers that shouldn’t keep the process alive. A pool library restarts dead workers and fails their in-flight tasks.</p>', lvl: 'deep' },
    { q: 'Can workers share a database connection pool?', a: '<p>No. Connections and their sockets belong to one isolate; each worker would need its own pool, multiplying connections. Keep I/O on the main thread and give workers pure CPU tasks with plain data in and out.</p>', lvl: 'deep' },
    { q: 'Compare with Java threads.', a: '<p>Java threads share one heap: any object is visible to all threads, which is powerful and is why you need <code>synchronized</code>, <code>volatile</code> and concurrent collections. Node workers are closer to separate actors: nothing is shared unless you opt in with <code>SharedArrayBuffer</code>. A worker pool is Node’s <code>ExecutorService</code>, and <code>cluster</code> is like running several JVMs behind a load balancer.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'A worker pool for CPU work (piscina)', lang: 'ts', code: `// resize-worker.ts: runs in each pool thread
export default async function ({ img, width }: { img: Uint8Array; width: number }) {
  const out = await resizeJpeg(img, width);   // pure CPU (WASM / JS)
  return out;                                  // a Uint8Array; piscina clones it back
}

// server.ts
import Piscina from 'piscina';
import os from 'node:os';

export const pool = new Piscina({
  filename: new URL('./resize-worker.js', import.meta.url).href,
  maxThreads: Math.max(1, os.availableParallelism() - 1),
  idleTimeout: 30_000,
});

export const resize = (img: Uint8Array, width: number) => pool.run({ img, width });`, note: 'The main thread stays free for I/O; resizes run in parallel up to the pool size.' },
    { title: 'Raw worker_threads with transfer', lang: 'js', code: `// main.js (CommonJS)
const { Worker } = require('node:worker_threads');

function checksum(buf) {           // buf: ArrayBuffer, given away to the worker
  return new Promise((resolve, reject) => {
    const w = new Worker(__dirname + '/sum-worker.js');
    w.once('message', (v) => { resolve(v); w.terminate(); });
    w.once('error', reject);
    w.postMessage(buf, [buf]);     // transfer: no copy, buf is detached here
  });
}

// sum-worker.js
const { parentPort } = require('node:worker_threads');
parentPort.once('message', (buf) => {
  const bytes = new Uint8Array(buf);
  let s = 0;
  for (const b of bytes) s = (s + b) % 65521;
  parentPort.postMessage(s);
});`, note: 'One worker per call is fine for an occasional batch task. For request traffic, use a pool.' },
    { title: 'Java comparison: an ExecutorService', lang: 'java', code: `ExecutorService cpu = Executors.newFixedThreadPool(
    Runtime.getRuntime().availableProcessors());   // container-aware since Java 10

CompletableFuture<byte[]> resized =
    CompletableFuture.supplyAsync(() -> Images.resize(bytes, 800), cpu);

// Differences from Node workers:
// - threads share the heap: 'bytes' is passed by reference, no copy, no transfer
// - so mutable shared state needs synchronization
// - one JVM uses all cores for request handling too: no cluster module needed`, note: 'Java threads share memory by default; Node workers share nothing by default.' }
  ]
});

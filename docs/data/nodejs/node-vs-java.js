IA.register({
  track: 'nodejs',
  slug: 'node-vs-java',
  title: 'Node vs Java for services',
  tagline: 'Both can serve a huge number of concurrent requests. They differ in <b>where waiting happens</b>: Node waits in one event loop, classic Spring waits in a blocked thread per request, virtual threads make those threads cheap, and WebFlux brings Node’s model to the JVM. The real decision is about CPU work, team, ecosystem and operations, not hello-world benchmarks.',
  tldr: {
    problem: 'Teams pick a runtime by folklore (“Node is faster”, “Java is enterprise”) and then hit the model’s weak spot: a CPU-heavy endpoint that stalls a Node process, or a Tomcat pool exhausted by slow downstream calls.',
    model: '<b>I/O-bound</b> work (call a DB, call an API, return JSON) is mostly waiting; any model that doesn’t hold an expensive resource while waiting scales well: Node’s event loop, WebFlux, or Java 21 virtual threads. <b>CPU-bound</b> work needs cores: the JVM uses all of them in one process with shared memory and a mature JIT; Node needs worker threads or more processes. Pick per service.',
    hook: '“Would you write this service in Node or Java?” Ask what it does. A BFF that fans out to five APIs and reshapes JSON: Node is a natural fit. A pricing engine with heavy computation, big in-memory caches and complex transactions: the JVM. Then weigh the team’s skills and the platform you already run.',
    facts: [
      { v: '1 thread', l: 'runs a Node process’s JavaScript; libuv adds a pool of 4 by default (<code>UV_THREADPOOL_SIZE</code>) for file system, DNS lookups, crypto and zlib' },
      { v: '200', l: 'Tomcat’s default max worker threads in Spring Boot (<code>server.tomcat.threads.max</code>): the classic cap on concurrent blocking requests' },
      { v: 'Java 21', l: 'made virtual threads final (JEP 444); Spring Boot 3.2+ enables them with <code>spring.threads.virtual.enabled=true</code>. JDK 24 removed most pinning on <code>synchronized</code> (JEP 491)' }
    ]
  },
  intro: {
    what: 'A web service spends most of its life <b>waiting</b>: for the database, for another API, for the network. The two runtimes handle waiting differently. <b>Node</b> runs all your code on one thread and never blocks it: while one request waits, the thread serves others. <b>Classic Java</b> (Spring MVC on Tomcat) gives each request its own thread, which simply sleeps while waiting. That is easy to write, but threads are a limited resource. Modern Java offers two more options: <b>virtual threads</b> (very cheap threads) and <b>WebFlux</b> (an event loop, like Node).',
    analogy: { icon: '🍳', title: 'Kitchen staffing', text: 'Node is one very fast chef who never stands at the oven waiting: they put a dish in, start the next one, and come back when the timer rings. Thread-per-request is one cook per order who stands by the oven until it’s done; you need as many cooks as orders in progress. Virtual threads are cooks who can “teleport away” while the oven runs, so a few real stoves serve thousands of orders. Problem for the single chef: one order that needs 10 minutes of chopping (CPU work) stops every other order.' },
    steps: [
      { t: 'Classify the workload', d: 'Mostly waiting on I/O, or mostly computing? Measure: CPU time per request vs latency.' },
      { t: 'I/O-bound: all models work', d: 'Node, WebFlux and virtual threads all handle thousands of concurrent waits. Platform threads hit the pool size first.' },
      { t: 'CPU-bound: think cores', d: 'The JVM uses every core in one process. Node needs worker threads, or several processes/pods.', code: "// Node: move CPU work off the event loop\nconst { Worker } = require('node:worker_threads');" },
      { t: 'Then weigh people and platform', d: 'Team skills, existing libraries (Spring Security, JPA; or the npm ecosystem), observability, how you deploy.' }
    ],
    terms: [
      ['I/O-bound', 'Time is spent waiting for disks, networks and databases.'],
      ['CPU-bound', 'Time is spent computing; more waiting capacity doesn’t help.'],
      ['thread-per-request', 'Each request gets its own OS thread for its whole life (Spring MVC + Tomcat).'],
      ['virtual thread', 'A Java 21 thread managed by the JVM; it releases its carrier OS thread while blocked.'],
      ['event loop', 'One thread that runs callbacks when I/O completes (Node, Netty/WebFlux).'],
      ['carrier thread', 'An OS thread that runs virtual threads, about one per core.']
    ]
  },
  visual: {
    title: 'Same 12 requests, four concurrency models',
    caption: 'Pick a model and a workload, then press Play or Step. Each thread row shows <b>CPU work</b> (solid) and, for blocking threads, <b>waiting</b> (pale). The lower rows show each request from arrival to response. Try “one CPU-heavy request” on Node, then on virtual threads. (A deliberately small, simplified model: 4 threads stand in for Tomcat’s 200.)'
  },
  gotchas: [
    { trap: '“Node is faster than Java”', why: 'For a tight CPU loop the JVM’s JIT and multi-threading usually win; for a trivial I/O endpoint both are fast and the database dominates. Microbenchmarks rarely transfer to real services, and published comparisons often measure configuration as much as runtime.', fix: 'Benchmark your own workload, with realistic payloads and dependencies, at the latency percentile you care about.' },
    { trap: 'CPU-heavy endpoints in Node', code: `app.post('/report', (req, res) => {
  res.json(buildPdfSync(bigDataset));   // 800 ms of CPU: every other request waits
});`, why: 'The event loop is a single thread. While it computes, no other callback runs: not other requests, not health checks.', fix: 'Move the work to <code>worker_threads</code> (a pool such as Piscina), to a separate service, or to a job queue. See <a href="blocking-event-loop.html">Blocking the event loop</a> and <a href="worker-threads-cluster.html">Worker threads &amp; cluster</a>.' },
    { trap: 'Blocking calls on a WebFlux event loop', code: `@GetMapping("/user/{id}")
Mono<User> get(@PathVariable long id) {
  return Mono.just(jdbcTemplate.queryForObject(...));   // blocking JDBC on a Netty thread
}`, why: 'WebFlux has the same constraint as Node: a few event-loop threads. A blocking JDBC call stalls every connection on that loop. Node at least makes blocking APIs rare and obvious (<code>*Sync</code>); in Java, blocking APIs are everywhere.', fix: 'Use reactive drivers (R2DBC), or <code>subscribeOn(Schedulers.boundedElastic())</code> for unavoidable blocking calls, or choose Spring MVC on virtual threads instead.' },
    { trap: 'Virtual threads as a free lunch', why: 'Virtual threads remove the thread limit but not the others: the DB pool still has N connections, downstream services still have rate limits. Before JDK 24, blocking inside <code>synchronized</code> pins the carrier thread; <code>ThreadLocal</code>-heavy code multiplies memory per virtual thread.', fix: 'Keep bounded resources bounded (connection pools, semaphores), upgrade to JDK 24+ or prefer <code>ReentrantLock</code> on 21, and watch for pinning with <code>jdk.VirtualThreadPinned</code> events.' },
    { trap: 'One Node process per container, multi-core limits', why: 'A Node process runs your JavaScript on one core. Giving the container 4 CPUs mostly helps GC, libuv and the kernel, not your request handling.', fix: 'Size Node pods at about one CPU and scale horizontally, or use <code>cluster</code>/multiple processes. Size JVM pods larger, since one JVM uses all its cores.' },
    { trap: 'Comparing memory without comparing configuration', why: 'A JVM reserves heap up to its configured max (by default 25% of container memory, <code>MaxRAMPercentage</code>) and keeps metaspace, JIT code and thread stacks; a Node process has V8 heap limits of its own. Idle RSS numbers say little about behaviour under load.', fix: 'Set heap limits explicitly (<code>-XX:MaxRAMPercentage</code>, <code>--max-old-space-size</code>) relative to the container limit and load-test both.' }
  ],
  scenarios: [
    { title: 'A Node BFF’s p99 jumps to seconds once a day',
      symptom: 'A Node backend-for-frontend that aggregates five services is fast all day, except when the nightly “export” endpoint is called: then every request on that pod is slow and health checks fail.',
      diagnose: `const { monitorEventLoopDelay } = require('node:perf_hooks');
const h = monitorEventLoopDelay(); h.enable();
setInterval(() => log.info({ p99ms: h.percentile(99) / 1e6 }), 10_000).unref();
// p99 event-loop delay spikes to 3000+ ms during exports`, diagnoseLang: 'js',
      cause: 'The export builds a large CSV and gzips it synchronously on the event loop. A model mismatch: CPU work in an I/O-oriented runtime.',
      fix: 'Stream the export (<code>pipeline</code> + async zlib) and move the formatting to a worker pool or a batch job. The BFF stays a pure fan-out layer.',
      fixCode: `import Piscina from 'piscina';
const pool = new Piscina({ filename: new URL('./export-worker.js', import.meta.url).href, maxThreads: 2 });
app.get('/export', async (req, res) => res.type('text/csv').send(await pool.run({ from: req.query.from })));` },
    { title: 'Spring MVC service stops responding when a dependency slows down',
      symptom: 'A payment provider’s latency goes from 100 ms to 5 s. Within a minute the Java service returns 503s for all endpoints, including ones that never call the provider.',
      cause: 'Thread-per-request with 200 Tomcat threads: requests to the slow provider hold threads while they wait. At the arrival rate and the new latency (Little’s law: concurrency = rate × latency), all 200 are blocked, and every other endpoint queues behind them.',
      fix: 'Timeouts and a bulkhead (separate limit) for the provider, plus a circuit breaker. On Java 21, virtual threads remove the thread cap, so the limit becomes the explicit bulkhead you choose. A Node service would have had the same problem in another form: unbounded in-flight requests and memory, without the thread cap.',
      fixCode: `spring:
  threads:
    virtual:
      enabled: true           # Boot 3.2+, Java 21+
resilience4j:
  bulkhead:
    instances:
      payments: { maxConcurrentCalls: 50 }
  timelimiter:
    instances:
      payments: { timeoutDuration: 2s }`, lang: 'yaml' }
  ],
  puzzles: [
    { kind: 'predict', q: 'CPU work and a timer on the same thread. What prints?', code: `const start = Date.now();
setTimeout(() => console.log('timer late:', Date.now() - start >= 100), 10);

while (Date.now() - start < 100) {}   // 100 ms of CPU work
console.log('cpu done');`, options: ['timer late: false, cpu done', 'cpu done, timer late: true', 'cpu done, timer late: false', 'timer late: true, cpu done'], answer: 1, explain: 'The 10 ms timer is due long before the loop ends, but callbacks only run when the stack is empty. One thread means the timer, every other request and the health check all wait for the CPU work.', run: true, expect: 'cpu done\ntimer late: true' },
    { kind: 'predict', q: 'Concurrent waiting on one thread. What prints?', code: `const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const t = Date.now();
  await Promise.all([sleep(100), sleep(100), sleep(100)]);
  console.log(Date.now() - t < 250 ? 'concurrent' : 'sequential');
})();`, options: ['concurrent', 'sequential', 'it depends on the number of CPU cores', 'TypeError'], answer: 0, explain: 'All three waits run at the same time: the thread is free while timers (or sockets) are pending. Total ≈ 100 ms. That is why one Node thread can hold thousands of concurrent I/O waits.', run: true, expect: 'concurrent' },
    { kind: 'predict', q: 'CPU work wrapped in async functions. What prints?', code: `const busy = (ms) => { const end = Date.now() + ms; while (Date.now() < end) {} };

(async () => {
  const t = Date.now();
  await Promise.all([1, 2, 3].map(async () => busy(100)));
  console.log(Date.now() - t >= 300 ? 'sequential' : 'parallel');
})();`, options: ['parallel', 'sequential', 'parallel on multi-core machines', 'deadlock'], answer: 1, explain: '<code>async</code> doesn’t create threads. Each callback runs its synchronous loop to completion on the same thread, one after another: about 300 ms. <code>Promise.all</code> parallelises <i>waiting</i>, not computing. In Java, three platform or virtual threads on three cores would run truly in parallel.', run: true, expect: 'sequential' },
    { kind: 'predict', q: 'Offloading CPU work to a worker thread. What prints first?', code: `const { Worker } = require('node:worker_threads');

const w = new Worker(\`
  const { parentPort } = require('node:worker_threads');
  let s = 0;
  for (let i = 1; i <= 1e6; i++) s += i;
  parentPort.postMessage(s);
\`, { eval: true });

w.on('message', (s) => console.log('sum', s));
console.log('main thread free');`, options: ['sum 500000500000, main thread free', 'main thread free, sum 500000500000', 'main thread free (the worker is never awaited)', 'sum 500000500000 only'], answer: 1, explain: 'The worker runs on its own thread with its own V8 isolate and event loop. The main thread continues immediately; the result arrives as a message. This is Node’s answer to CPU-bound work (a pool like Piscina in production).', run: true, expect: 'main thread free\nsum 500000500000' },
    { kind: 'concept', q: 'A service mostly waits on Postgres and two HTTP APIs, 5,000 concurrent requests at peak. Which setup does <b>not</b> handle that concurrency well out of the box?', options: ['Node with an async driver', 'Spring WebFlux with R2DBC', 'Spring MVC on Java 21 virtual threads', 'Spring MVC on Tomcat with the default 200 platform threads'], answer: 3, explain: 'With blocking I/O, concurrency is capped by the thread count: requests beyond 200 queue. The other three don’t tie an OS thread to each waiting request. (All four are still limited by the DB pool, so concurrency at the database must be bounded either way.)' },
    { kind: 'concept', q: 'Java 21: a virtual thread does blocking I/O inside a <code>synchronized</code> block. What happens?', options: ['It unmounts as usual', 'It pins its carrier thread for the duration, reducing parallelism', 'Deadlock', 'The JVM throws IllegalStateException'], answer: 1, explain: 'On Java 21–23, a virtual thread can’t unmount while holding a monitor, so the carrier OS thread is blocked too. Many such blocks can exhaust the carriers. JDK 24 (JEP 491) fixed this for <code>synchronized</code>; on 21 prefer <code>ReentrantLock</code> in hot paths.' },
    { kind: 'concept', q: 'Which is a sound reason to choose the JVM over Node for a new service?', options: ['Java always uses less memory', 'Heavy CPU work, large in-heap caches shared across threads, and mature transactional/ORM tooling', 'Node can’t talk to Postgres', 'Node can’t run in Kubernetes'], answer: 1, explain: 'Real differentiators: true multi-threading with shared memory, the JIT on long-running hot code, and libraries like Spring Security, Spring Data/JPA and Kafka Streams. Memory use depends heavily on configuration; both run fine in containers.' }
  ],
  interview: [
    { q: 'Compare Node’s event loop with thread-per-request, virtual threads and WebFlux.', a: '<ul><li><b>Node</b>: one JS thread, non-blocking I/O via libuv (epoll/kqueue), callbacks/promises. Cheap concurrency for I/O; CPU work blocks everyone.</li><li><b>Thread-per-request</b> (Spring MVC/Tomcat): blocking code, simple stack traces and debugging; each waiting request holds an OS thread (memory for its stack, context switches), so the pool size caps concurrency.</li><li><b>Virtual threads</b> (Java 21): the same blocking code, but a blocked virtual thread releases its carrier. Concurrency on the scale of Node, with the thread-per-request programming model.</li><li><b>WebFlux</b> (Reactor/Netty): an event loop per core, reactive types, backpressure. High concurrency, but a harder programming model and blocking calls are dangerous, like in Node.</li></ul>', lvl: 'core' },
    { q: 'When would you pick Node for a service, and when Java?', a: '<p><b>Node</b>: I/O-heavy glue (BFFs, API gateways, webhooks, real-time with WebSockets), teams that share TypeScript with the frontend, fast startup for serverless, JSON-shaped data end to end. <b>Java</b>: CPU-intensive or latency-critical computation, complex domain models with transactions (JPA), long-running services where JIT warm-up pays off, heavy use of the JVM ecosystem (Kafka Streams, Spring Security, mature observability). Organisational fit often decides: one well-supported stack beats two half-supported ones.</p>', lvl: 'core' },
    { q: 'Why is “Node is single-threaded” only half true?', a: '<p>Your JavaScript runs on one thread per process (per worker). But Node itself uses more: libuv’s thread pool (4 by default) for fs, DNS <code>lookup</code>, crypto and zlib; V8 runs GC and compilation on helper threads; and <code>worker_threads</code> give you more JS threads with message passing or <code>SharedArrayBuffer</code>. See <a href="node-architecture.html">Node architecture</a>.</p>', lvl: 'core' },
    { q: 'How do Node and the JVM use multiple cores?', a: '<p>The JVM: one process, many threads, shared heap, so a 4-core pod is one JVM. Node: one event loop per process; for more cores run several processes (<code>cluster</code>, PM2, or more pods) or worker threads for CPU tasks. In Kubernetes the usual Node pattern is small pods (about one CPU each) and horizontal scaling.</p>', lvl: 'core' },
    { q: 'Startup time and memory: how do they compare, and what can you do on the JVM?', a: '<p>A small Node service typically starts in well under a second; a Spring Boot service on the JVM typically takes a few seconds, and reaches peak performance only after JIT warm-up. That matters for serverless and fast scale-out. JVM options: class data sharing and the AOT cache (JDK 24+), Spring AOT + GraalVM native images (fast start, lower memory, longer builds, no JIT), and CRaC checkpoint/restore. Memory depends on heap settings far more than on the runtime’s reputation.</p>', lvl: 'deep' },
    { q: 'How do Node and Java services typically interoperate?', a: '<ul><li>HTTP/JSON with an OpenAPI contract, generating clients for both sides.</li><li>gRPC with shared <code>.proto</code> files (<code>@grpc/grpc-js</code> in Node, grpc-java).</li><li>Events over Kafka with a schema registry (Avro/Protobuf/JSON Schema).</li><li>Shared auth (JWT/OIDC) and trace propagation (W3C <code>traceparent</code> via OpenTelemetry in both).</li><li>Running JavaScript inside the JVM (GraalJS) is possible but rare.</li></ul>', lvl: 'core' },
    { q: 'What does Little’s law tell you about thread pools vs event loops?', a: '<p>Concurrency = arrival rate × latency. At 500 req/s and 400 ms latency you need 200 requests in flight. With platform threads that means 200 threads, and a slowdown to 2 s needs 1,000. Event loops and virtual threads make “in flight” cheap, so the binding limits become memory, DB connections and downstream capacity, which you then have to bound explicitly.</p>', lvl: 'deep' },
    { q: 'How do error handling and debugging differ in practice?', a: '<p>Blocking Java gives one linear stack trace per request and thread dumps that show what everything is waiting on. Node’s async stack traces are reconstructed by V8 for <code>await</code> chains but can be fragmented across callbacks, and a single unhandled rejection can crash the whole process. Context propagation differs too: <code>ThreadLocal</code>/MDC in Java vs <code>AsyncLocalStorage</code> in Node. Virtual threads keep Java’s model; WebFlux has Node-like debugging problems.</p>', lvl: 'deep' },
    { q: 'Type systems and tooling: what does a Java team lose or gain with TypeScript?', a: '<p>Gains: concise structural types, fast iteration, shared types with the frontend, a vast package ecosystem. Losses: types are erased (validate at runtime, see <a href="typescript-node.html">TypeScript on Node</a>), a less uniform standard library, more dependency churn and supply-chain risk (see <a href="npm-dependencies.html">npm &amp; dependencies</a>), and fewer “batteries included” frameworks than Spring, though NestJS deliberately mirrors Spring’s style.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Node: I/O fan-out with a bounded CPU pool', lang: 'ts', code: `import Fastify from 'fastify';
import Piscina from 'piscina';

const app = Fastify({ logger: true });
const cpu = new Piscina({ filename: new URL('./score-worker.js', import.meta.url).href, maxThreads: 2 });

app.get('/customers/:id/summary', async (req) => {
  const { id } = req.params as { id: string };
  // I/O: three calls in flight at once on one thread
  const [profile, orders, tickets] = await Promise.all([
    fetch(\`http://profile/\${id}\`, { signal: AbortSignal.timeout(800) }).then((r) => r.json()),
    fetch(\`http://orders/\${id}?limit=50\`, { signal: AbortSignal.timeout(800) }).then((r) => r.json()),
    fetch(\`http://support/\${id}/open\`, { signal: AbortSignal.timeout(800) }).then((r) => r.json()),
  ]);
  // CPU: off the event loop
  const risk = await cpu.run({ orders, tickets });
  return { profile, risk, openTickets: tickets.length };
});` },
    { title: 'Java 21: the same with virtual threads', lang: 'java', code: `// application.yml: spring.threads.virtual.enabled: true   (Boot 3.2+)
@GetMapping("/customers/{id}/summary")
Summary summary(@PathVariable String id) throws Exception {
  try (var scope = Executors.newVirtualThreadPerTaskExecutor()) {        // blocking code, cheap threads
    var profile = scope.submit(() -> profileClient.get(id));
    var orders  = scope.submit(() -> ordersClient.recent(id, 50));
    var tickets = scope.submit(() -> supportClient.open(id));
    var risk = riskScorer.score(orders.get(), tickets.get());          // CPU work: runs in parallel with other requests
    return new Summary(profile.get(), risk, tickets.get().size());
  }
}`, note: 'Structured concurrency (<code>StructuredTaskScope</code>) is still a preview API in recent JDKs; an executor per request works on Java 21.' },
    { title: 'Spring WebFlux (event loop on the JVM)', lang: 'java', code: `@GetMapping("/customers/{id}/summary")
Mono<Summary> summary(@PathVariable String id) {
  return Mono.zip(profile.get(id), orders.recent(id, 50), support.open(id))   // non-blocking WebClient calls
    .publishOn(Schedulers.parallel())                                         // CPU work off the Netty loop
    .map(t -> new Summary(t.getT1(), riskScorer.score(t.getT2(), t.getT3()), t.getT3().size()));
}` }
  ]
});

IA.register({
  track: 'nodejs',
  slug: 'v8-gc-leaks',
  title: 'V8 memory & leaks',
  tagline: 'V8 splits the heap by age. New objects go into a small <b>young generation</b> that a fast copying GC (<b>Scavenge</b>) empties often. Survivors are promoted to the <b>old generation</b>, cleaned by the slower <b>Mark-Compact</b>. A “leak” in JavaScript is just an object that is still <b>reachable</b> from a root, so it never dies.',
  tldr: {
    problem: 'Memory climbs a few MB an hour until the pod is OOM-killed or Node dies with <code>JavaScript heap out of memory</code>. Before that, latency gets worse as the GC works harder and harder to free less and less.',
    model: 'Garbage = unreachable from the roots (globals, the stack, active handles). <b>Scavenge</b> copies the few live young objects to the other semi-space and drops the rest. Objects that survive twice move to <b>old space</b>. <b>Mark-Compact</b> marks everything reachable in the whole heap, sweeps the rest, and compacts fragmented pages. A leak survives every GC because something (a Map, a listener, a closure, a timer) still points at it.',
    hook: '“How do you find a memory leak in Node?” Take <b>heap snapshots</b> at intervals under steady load, compare them, sort by retained size, and follow the <b>retainers</b> chain back to the root that holds them.',
    facts: [
      { v: '2', l: 'generations: young (two semi-spaces, Scavenge) and old (Mark-Compact). Big objects get their own large-object space' },
      { v: '5', l: 'fields of <code>process.memoryUsage()</code>: rss, heapTotal, heapUsed, external, arrayBuffers. Buffers live outside the JS heap' },
      { v: '~2×', l: 'heap size of extra memory that writing a heap snapshot can need, per the Node docs. It is also synchronous: the process pauses' }
    ]
  },
  intro: {
    what: 'You never free memory yourself in JavaScript. V8’s garbage collector finds objects your program can no longer reach and reuses their memory. Most objects die young (a request’s temporary data), so V8 collects new objects often and cheaply, and old objects rarely and more expensively. A <b>memory leak</b> happens when your code keeps a reference by accident, typically in a cache, an array, an event listener or a closure, so the GC must keep the object forever.',
    analogy: { icon: '🧹', title: 'A desk and a filing cabinet', text: 'New papers land on your desk (young generation). Every so often you sweep the desk: anything you still need goes on the other half of the desk, everything else goes in the bin. That sweep is quick because most papers are junk. A paper you’ve kept through two sweeps gets filed in the cabinet (old space). Cleaning the cabinet means checking every folder, so you do it rarely. A leak is a folder labelled “maybe later” that you add to every day and never empty.' },
    steps: [
      { t: 'Objects start young', d: 'Allocation is a fast pointer bump in a semi-space of the young generation.' },
      { t: 'Scavenge copies survivors', d: 'When the semi-space is full, live objects are copied to the other one; the dead ones cost nothing. Survivors of two scavenges are promoted to old space.' },
      { t: 'Mark-Compact cleans old space', d: 'Starting from the roots, V8 marks every reachable object (mostly concurrently), sweeps the unmarked ones and compacts some pages.' },
      { t: 'Watch the right numbers', d: '<code>heapUsed</code> is the JS heap; <code>external</code>/<code>arrayBuffers</code> are Buffers outside it; <code>rss</code> is what the container limit sees.', code: "const m = process.memoryUsage();\nconsole.log((m.heapUsed / 1e6).toFixed(1), 'MB heap,', (m.rss / 1e6).toFixed(1), 'MB rss');" },
      { t: 'Snapshots find the culprit', d: 'A heap snapshot lists every object and who holds it. Compare two or three taken minutes apart.', code: "node --heapsnapshot-signal=SIGUSR2 server.js\nkill -USR2 <pid>    # writes Heap.<date>.<pid>.heapsnapshot", lang: 'bash' }
    ],
    terms: [
      ['root', 'A starting point the GC always keeps: globals, the current stack, active handles.'],
      ['reachable', 'Can be found by following references from a root. Reachable objects are never collected.'],
      ['Scavenge', 'V8’s young-generation GC: copies live objects between two semi-spaces.'],
      ['Mark-Compact', 'V8’s full GC for the old generation: mark, sweep, compact.'],
      ['retained size', 'Memory that would be freed if this object were gone, including what only it keeps alive.'],
      ['retainer', 'An object holding a reference to the one you’re looking at.']
    ]
  },
  visual: {
    title: 'Watch Scavenge and Mark-Compact, with and without a leak',
    caption: 'Press Play or Step. Each request allocates three objects (q, b, r). Two requests are in flight at a time; every few requests a session object lives a little longer. Switch to <b>Leaky cache</b>: each request also leaves its result in a global <code>Map</code>, so it survives every GC.'
  },
  gotchas: [
    { trap: 'An unbounded cache', code: `const cache = new Map();\nexport function price(sku, currency, customerId) {\n  const k = sku + ':' + currency + ':' + customerId;   // high-cardinality key\n  if (!cache.has(k)) cache.set(k, compute(sku, currency, customerId));\n  return cache.get(k);\n}`, why: 'A <code>Map</code> at module level is a root. Every entry is reachable forever. With a key that includes a user or request ID, it grows with traffic.', fix: 'Use a bounded cache with size and TTL limits (<code>lru-cache</code>), or an external cache. If the key is an object whose lifetime should decide the entry, use a <code>WeakMap</code>.' },
    { trap: 'Closures keep their whole scope context', code: `function handler(req) {\n  const big = loadReport(req);            // 50 MB\n  const summary = summarize(big);\n  emitter.on('tick', () => log(summary)); // only uses summary…\n  setImmediate(() => big.length);          // …but a sibling closure uses big\n}`, why: 'V8 puts variables that any inner function uses into one shared context object for that scope. If one closure references <code>big</code>, every closure created in that scope keeps the context, and therefore <code>big</code>, alive.', fix: 'Keep long-lived closures small: build them in a separate function that only receives what they need, and null out large locals you no longer need.' },
    { trap: 'Timers and listeners that are never removed', code: `function watch(conn) {\n  setInterval(() => conn.ping(), 30_000);   // keeps conn alive forever\n}`, why: 'An active interval is a root via the event loop. Its callback’s closure keeps <code>conn</code> and everything it references alive, even after the connection is closed. Listeners on long-lived emitters behave the same way (see <a href="eventemitter.html">EventEmitter</a>).', fix: 'Keep the handle and clear it on close: <code>const t = setInterval(…); conn.once(\'close\', () => clearInterval(t))</code>.' },
    { trap: 'Heap limit above the container limit', why: 'If V8 believes it may grow the old space beyond the container’s memory limit, it doesn’t collect hard enough before the kernel kills the process (exit code 137, no JS stack trace). Buffers and native memory come on top of the heap.', fix: 'Set <code>--max-old-space-size</code> (in MB) explicitly, well below the container limit, leaving room for Buffers, code and native memory. Then a real leak ends in a clear heap-OOM error you can debug.' },
    { trap: 'Looking only at heapUsed', why: '<code>Buffer</code> and <code>ArrayBuffer</code> data are allocated outside the V8 heap and show up in <code>external</code>/<code>arrayBuffers</code> and <code>rss</code>. Native addons and fragmentation also grow RSS without changing <code>heapUsed</code>.', fix: 'Graph rss, heapUsed and external together. Flat heap with growing rss points at Buffers, native code or the allocator, not at JS objects.' },
    { trap: 'Taking heap snapshots carelessly in production', why: '<code>v8.writeHeapSnapshot()</code> is synchronous and can need about twice the heap size in extra memory. On a big heap the process freezes for seconds and may be OOM-killed while writing.', fix: 'Take snapshots on a pod drained from the load balancer, or reproduce the leak in staging. <code>--heapsnapshot-near-heap-limit=N</code> captures up to N snapshots automatically just before a heap OOM.' },
    { trap: 'Calling global.gc() to “fix” memory', why: 'Forcing a full GC (with <code>--expose-gc</code>) only frees unreachable objects, which V8 would free anyway. It can’t free a leak, and full GCs pause JavaScript.', fix: 'Find what retains the objects. Use <code>global.gc()</code> only in tests and benchmarks, to get a clean baseline before a snapshot.' }
  ],
  scenarios: [
    { title: 'Pods OOM-killed every two days',
      symptom: 'Memory rises in a straight line, about 40 MB an hour, under steady traffic. Every 48 hours Kubernetes reports <code>OOMKilled</code> (exit 137) and the pod restarts.',
      diagnose: `# drain one pod, then take three snapshots 10 minutes apart\nkill -USR2 <pid>       # with --heapsnapshot-signal=SIGUSR2\n# DevTools → Memory → load all three → Comparison view, sort by "Size Delta"\n# (string) +310 000, Object +310 000\n# retainers: Map → cache in pricing.js`,
      cause: 'A memoization <code>Map</code> in the pricing module was keyed by <code>sku:currency:customerId</code>. With new customers every day, the cache never stopped growing, and every entry was reachable from the module scope.',
      fix: 'Replace it with a bounded LRU with a TTL, and alert on heap growth rate as well as absolute size.',
      fixCode: `import { LRUCache } from 'lru-cache';\n\nconst cache = new LRUCache<string, Price>({\n  max: 50_000,              // entries\n  ttl: 10 * 60_000,         // 10 minutes\n});\n\nexport function price(sku: string, currency: string, customerId: string) {\n  const k = sku + ':' + currency + ':' + customerId;\n  let p = cache.get(k);\n  if (!p) { p = compute(sku, currency, customerId); cache.set(k, p); }\n  return p;\n}`, lang: 'ts' },
    { title: '“Ineffective mark-compacts near heap limit”',
      symptom: 'A monthly report job crashes after 10 minutes. The log ends with <code>FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory</code>. Before the crash the job slowed down sharply.',
      diagnose: `node --trace-gc report.js\n# [..] Mark-Compact 2010.3 (2080.1) -> 2003.9 (2081.2) MB, 1840 ms …\n# [..] Mark-Compact 2008.1 (2081.2) -> 2006.4 (2082.0) MB, 1912 ms …\n# full GCs back to back, each freeing almost nothing`,
      cause: 'The job loaded all rows into an array, then built a second, transformed array. Both were live at once. Near the limit V8 ran full GCs over and over, each freeing almost nothing, and then gave up.',
      fix: 'Stream the rows through a pipeline so memory stays flat. Raising <code>--max-old-space-size</code> only delays the crash for a job whose data grows.',
      fixCode: `await pipeline(\n  db.cursor('SELECT * FROM events WHERE month = $1', [month]),\n  async function* (rows) { for await (const r of rows) yield toCsvLine(r); },\n  fs.createWriteStream(outPath)\n);`, lang: 'ts' },
    { title: 'RSS grows, heapUsed doesn’t',
      symptom: 'A file-upload proxy’s RSS climbs to the container limit while <code>heapUsed</code> stays flat at 120 MB.',
      diagnose: `setInterval(() => {\n  const m = process.memoryUsage();\n  log.info({ rss: m.rss, heap: m.heapUsed, external: m.external, ab: m.arrayBuffers });\n}, 30_000).unref();\n// external and arrayBuffers grow with rss`,
      cause: 'Uploads were collected with <code>Buffer.concat</code> into one Buffer per request, and failed uploads were kept in an in-memory retry list. Buffer memory lives outside the V8 heap, so heap charts looked healthy.',
      fix: 'Stream uploads straight to object storage and keep failed uploads on disk or in the queue, not in a process array. Chart <code>external</code> next to <code>heapUsed</code>.',
      fixCode: `app.post('/upload', async (req, res) => {\n  await pipeline(req, storage.createWriteStream(key));   // no full-body Buffer\n  res.status(201).end();\n});`, lang: 'ts' }
  ],
  puzzles: [
    { kind: 'predict', q: 'A cache keyed by objects. What prints?', code: `const cache = new Map();\nfunction remember(key, value) { cache.set(key, value); }\nfor (let i = 0; i < 3; i++) remember({ id: i }, 'v' + i);\nconsole.log(cache.size, cache.get({ id: 0 }));`, options: ['1 v0', '3 v0', '3 undefined', '0 undefined'], answer: 2, explain: '<code>Map</code> compares object keys by <b>identity</b>. Each <code>{ id: i }</code> is a new object, so there are 3 entries, and a new <code>{ id: 0 }</code> never matches. The cache only grows and never hits: a leak that does nothing useful.', run: true, expect: '3 undefined' },
    { kind: 'predict', q: 'Listeners as retainers. What prints?', code: `const EventEmitter = require('events');\nconst bus = new EventEmitter();\nbus.setMaxListeners(0);\nfunction handle(req) {\n  bus.on('config', () => req.id);\n}\nfor (let i = 0; i < 5; i++) handle({ id: i, body: Buffer.alloc(1024) });\nconsole.log(bus.listenerCount('config'));`, options: ['0: the requests have finished', '1', '5', 'It throws when the 2nd listener is added'], answer: 2, explain: 'Each call adds a closure to the bus, and each closure holds its <code>req</code> (and its body). <code>bus</code> is reachable from the module, so all five requests are reachable too. <code>setMaxListeners(0)</code> also removed the warning that would have pointed at this.', run: true, expect: '5' },
    { kind: 'predict', q: 'WeakMap rules. What prints?', code: `const wm = new WeakMap();\ntry {\n  wm.set('user:1', { name: 'Asha' });\n} catch (e) {\n  console.log(e instanceof TypeError);\n}\nconsole.log('size' in wm, typeof wm.keys);`, options: ['false true function', 'true false undefined', 'true true function', 'false false undefined'], answer: 1, explain: 'WeakMap keys must be objects (or non-registered symbols), so a string key throws a TypeError. A WeakMap has no <code>size</code> and can’t be iterated: its contents depend on GC timing. It frees an entry when its <b>key</b> object becomes unreachable, so it can’t bound a cache keyed by strings.', run: true, expect: 'true\nfalse undefined' },
    { kind: 'predict', q: 'Which fields does <code>process.memoryUsage()</code> return, in order?', code: `console.log(Object.keys(process.memoryUsage()).join(','));`, options: ['heapUsed,heapTotal,rss', 'rss,heapTotal,heapUsed,external,arrayBuffers', 'rss,heap,external', 'total,used,free'], answer: 1, explain: '<code>rss</code> is the whole process’s resident memory (what the container limit sees). <code>heapTotal</code>/<code>heapUsed</code> are the V8 heap. <code>external</code> is memory of C++ objects bound to JS objects, including Buffer data; <code>arrayBuffers</code> is the ArrayBuffer/Buffer part of it.', run: true, expect: 'rss,heapTotal,heapUsed,external,arrayBuffers' },
    { kind: 'concept', q: 'Why is Scavenge usually cheap even when the young generation allocates a lot?', options: ['It runs on another machine', 'Its cost depends on the number of <b>live</b> objects it copies, and most young objects are already dead', 'It never pauses JavaScript', 'It only frees strings'], answer: 1, explain: 'A copying collector touches only survivors; dead objects are dropped by reusing the semi-space. The generational hypothesis (most objects die young) makes that a small set. V8 also runs the scavenge in parallel across helper threads.' },
    { kind: 'concept', q: 'In a heap snapshot, an object has a <b>shallow size</b> of 64 bytes and a <b>retained size</b> of 180 MB. What does that mean?', options: ['The snapshot is corrupt', 'The object itself is tiny, but 180 MB would be freed if it became unreachable, because it is the only path to a big subgraph', 'It has been allocated 180 MB times', 'It is a Buffer'], answer: 1, explain: 'Shallow size is the object’s own memory. Retained size adds everything that is reachable <i>only</i> through it. A small <code>Map</code> or closure context with a huge retained size is the classic leak suspect. Follow its retainers to see who keeps it.' },
    { kind: 'concept', q: 'Two closures are created in the same function. One references a 50 MB array, the other only a small string, and only the second is stored long-term. Is the 50 MB array kept alive (in V8)?', options: ['No, each closure only keeps what it uses', 'Yes: closures created in one scope share one context object that holds every captured variable', 'Only in strict mode', 'Only if the function is async'], answer: 1, explain: 'V8 allocates one context per scope for all variables captured by any inner function. The long-lived closure keeps that context, and the context keeps the array. Move the long-lived closure into a separate function that captures only what it needs.' },
    { kind: 'concept', q: 'A pod is OOM-killed (exit 137) with no “heap out of memory” message, and the heap metric was at 300 MB of a 1 GiB container limit. Most likely?', options: ['A JS object leak', 'Memory outside the JS heap (Buffers, native code, the allocator), or a heap allowed to grow past the container limit', 'A stack overflow', 'The event loop was blocked'], answer: 1, explain: 'A JS heap leak ends in V8’s own fatal error when the heap limit is lower than the container limit. A kernel OOM kill with a modest heap points at RSS from Buffers and native memory, or at a heap limit set above the container’s memory.' }
  ],
  interview: [
    { q: 'Describe V8’s heap layout.', a: '<ul><li><b>New space</b> (young generation): two semi-spaces; one is used for allocation, the other is empty and receives survivors.</li><li><b>Old space</b>: objects that survived young GCs.</li><li><b>Large object space</b>: objects too big for a normal page, never moved.</li><li><b>Code space</b> for compiled code, plus a read-only space and others. <code>v8.getHeapSpaceStatistics()</code> lists them; the exact set depends on the V8 version.</li></ul>', lvl: 'core' },
    { q: 'How does Scavenge work?', a: '<p>When the allocation semi-space is full, V8 starts from the roots and from old-to-new references (tracked by a write barrier in “remembered sets”), copies every reachable young object into the other semi-space, and updates pointers. Objects that already survived one scavenge are promoted to old space instead. Then the roles of the semi-spaces swap. Cost ∝ live objects. It pauses JS, but is short and runs in parallel.</p>', lvl: 'deep' },
    { q: 'How does Mark-Compact work, and why doesn’t it freeze the app for long?', a: '<p>It marks every object reachable from the roots, sweeps unmarked memory into free lists, and compacts (evacuates) the most fragmented pages. V8’s Orinoco GC does most marking <b>concurrently</b> on helper threads and <b>incrementally</b> in small steps, sweeps concurrently and lazily, and compacts in parallel, so the main-thread pauses are short. Near the heap limit, full GCs get frequent and expensive.</p>', lvl: 'deep' },
    { q: 'What is a memory leak in a garbage-collected language?', a: '<p>Memory that stays <b>reachable</b> even though the program will never use it again. The GC is right to keep it. Typical holders: module-level Maps and arrays, listeners on long-lived emitters, active timers, closures stored somewhere long-lived, promises kept in a list, per-request data stored on a singleton.</p>', lvl: 'core' },
    { q: 'Walk me through debugging a leak.', a: '<ol><li>Confirm: heapUsed grows under steady load and doesn’t drop after full GCs.</li><li>Reproduce in staging or drain a pod.</li><li>Take snapshot 1, apply load, snapshot 2, more load, snapshot 3.</li><li>In DevTools Memory, use the Comparison view (or “objects allocated between snapshots”), sort by size delta or retained size.</li><li>Pick a growing constructor, open the <b>Retainers</b> pane and follow the chain to a root: that’s the code to fix.</li></ol>', fu: 'What if snapshots are too big? Use the sampling heap profiler (<code>--heap-prof</code> or DevTools “Allocation sampling”), which is much cheaper.', lvl: 'core' },
    { q: 'What do rss, heapTotal, heapUsed and external mean?', a: '<p><b>rss</b>: all resident memory of the process (heap, code, stacks, native allocations). <b>heapTotal</b>: memory V8 reserved for the JS heap. <b>heapUsed</b>: what live and not-yet-collected objects use. <b>external</b>: C++ memory tied to JS objects, notably Buffer contents (<b>arrayBuffers</b> is that part). The container limit compares against rss.</p>', lvl: 'core' },
    { q: 'How should you set memory flags in a container?', a: '<p>Set <code>--max-old-space-size</code> explicitly (for example through <code>NODE_OPTIONS</code>), lower than the container limit, to leave room for young space, Buffers, code and native memory. Then a JS leak produces a heap-OOM error (with an optional <code>--heapsnapshot-near-heap-limit</code> snapshot) instead of a silent kernel kill.</p>', lvl: 'deep' },
    { q: 'When do WeakMap, WeakRef and FinalizationRegistry help?', a: '<p><b>WeakMap</b>: attach data to an object without keeping the object alive (per-object metadata, caches keyed by objects). <b>WeakRef</b>: an optional reference that may become <code>undefined</code> after GC. <b>FinalizationRegistry</b>: a callback some time after an object is collected, with no timing guarantee. They don’t fix caches keyed by strings, and you must not rely on when GC happens.</p>', lvl: 'deep' },
    { q: 'How do GC pauses show up in a service, and how do you see them?', a: '<p>As latency spikes and event-loop delay; under memory pressure as high CPU with little progress. <code>--trace-gc</code> prints each GC with type, heap before and after, and pause time. <code>PerformanceObserver</code> with <code>entryTypes: [\'gc\']</code> reports GC events in-process; APM tools graph them.</p>', lvl: 'core' },
    { q: 'Compare V8’s GC with the JVM’s.', a: '<p>Both are generational with a copying young collector and a mark-and-compact old collector, mostly concurrent. Differences: the JVM has several selectable collectors (G1 default, ZGC, Shenandoah) and many tuning knobs; V8 has one collector with few flags. <code>-Xmx</code> ≈ <code>--max-old-space-size</code>; <code>jmap -dump:live</code> / a heap dump in Eclipse MAT ≈ a V8 heap snapshot in DevTools. Both suffer the same leak patterns: static maps, listeners, thread-locals ≈ module-level state.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Memory metrics and on-demand snapshots', lang: 'ts', code: `import v8 from 'node:v8';
import { PerformanceObserver } from 'node:perf_hooks';

// 1. graph these three together: a flat heap with rising rss is not a JS leak
setInterval(() => {
  const m = process.memoryUsage();
  metrics.gauge('node_rss_bytes', m.rss);
  metrics.gauge('node_heap_used_bytes', m.heapUsed);
  metrics.gauge('node_external_bytes', m.external);
}, 15_000).unref();

// 2. GC pauses
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) metrics.histogram('node_gc_ms', e.duration);
}).observe({ entryTypes: ['gc'] });

// 3. snapshot on demand (admin-only, on a drained instance)
admin.post('/debug/heapsnapshot', (_req, res) => {
  const file = v8.writeHeapSnapshot();   // synchronous; needs extra memory
  res.json({ file });
});`, note: 'Or start with <code>--heapsnapshot-signal=SIGUSR2</code> and <code>--heapsnapshot-near-heap-limit=2</code>.' },
    { title: 'Flags in a container', lang: 'bash', code: `# container limit: 1 GiB. Leave room for young space, Buffers, code and native memory.
export NODE_OPTIONS="--max-old-space-size=700 --heapsnapshot-near-heap-limit=1"
node server.js

# investigate GC behaviour locally
node --trace-gc --max-old-space-size=256 server.js
# Scavenge 12.1 (14.0) -> 9.8 (15.0) MB, 0.9 / 0.0 ms  allocation failure
# Mark-Compact 180.2 (200.4) -> 95.3 (190.1) MB, 22.5 / 0.0 ms  …

# sampling heap profile (cheaper than snapshots), written on exit
node --heap-prof server.js`, note: 'Heap-limit OOM with a snapshot is far easier to debug than exit code 137 with nothing.' },
    { title: 'Java comparison: heap dumps and limits', lang: 'java', code: `// JVM flags ≈ Node flags
// -Xmx700m                         ≈ --max-old-space-size=700
// -XX:+HeapDumpOnOutOfMemoryError  ≈ --heapsnapshot-near-heap-limit=1
// -Xlog:gc                         ≈ --trace-gc
// jcmd <pid> GC.heap_dump file     ≈ kill -USR2 <pid> with --heapsnapshot-signal

// The same leak in Java: a static map
public final class PriceCache {
  private static final Map<String, Price> CACHE = new ConcurrentHashMap<>();   // never evicted
}
// Fix: Caffeine.newBuilder().maximumSize(50_000).expireAfterWrite(Duration.ofMinutes(10)).build();`, note: 'Eclipse MAT’s “dominator tree” is the JVM name for what DevTools shows as retained size.' }
  ]
});

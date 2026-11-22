IA.register({
  track: 'nodejs',
  slug: 'microtasks-macrotasks',
  title: 'Microtasks vs macrotasks',
  tagline: 'Between any two callbacks, Node empties two queues: first <code>process.nextTick</code>, then promise jobs (microtasks). Only then does the event loop pick the next <b>macrotask</b> (a timer, an I/O callback, an immediate). That single rule answers almost every “what does this print?” question.',
  tldr: {
    problem: 'Ordering puzzles are an interview staple, and in production the same rules decide whether a recursive promise chain starves your sockets, or whether an event listener misses the first <code>\'error\'</code>.',
    model: '<b>Call stack</b> empties → drain the <b>nextTick queue</b> → drain the <b>microtask queue</b> (promise reactions, <code>await</code> continuations, <code>queueMicrotask</code>) → if either got new items, repeat → only then run <b>one macrotask</b> and repeat everything. Microtasks queued by microtasks run in the same drain.',
    hook: '“Does <code>process.nextTick</code> run before or after <code>Promise.then</code>?” Before, in CommonJS. In an ES module’s top-level code, the promise runs first.',
    facts: [
      { v: '2', l: 'micro-queues in Node: the nextTick queue (Node’s own) and V8’s microtask queue (promises, queueMicrotask)' },
      { v: '∞', l: 'items a drain will run: queues drain until empty, so a recursive nextTick or promise chain blocks timers and I/O for as long as it lasts' },
      { v: '1', l: 'microtask turn for <code>await</code> on a native promise or a plain value (V8 7.2+; Node 12+)' }
    ]
  },
  intro: {
    what: 'JavaScript runs one piece of code at a time. Work scheduled for “later” waits in <b>queues</b>. There are two kinds. <b>Macrotasks</b> are the big ones the event loop hands out: a timer firing, data arriving on a socket, a <code>setImmediate</code>. <b>Microtasks</b> are small follow-ups that must run as soon as the current code finishes, before anything else: mostly “this promise is resolved, run its <code>.then</code>”. Node adds a third queue that jumps even further ahead: <code>process.nextTick</code>.',
    analogy: { icon: '🏦', title: 'A bank counter', text: 'Customers in the main line are <b>macrotasks</b>: one is served at a time. When the clerk finishes a customer, she first handles the <b>urgent notes</b> on her desk (nextTick), then the <b>follow-up paperwork</b> from that visit (microtasks), even if that paperwork creates more paperwork. Only when her desk is clear does she call the next customer. If the paperwork never ends, the line never moves.' },
    steps: [
      { t: 'Synchronous code runs first', d: 'Everything in the current function runs to the end. Nothing interrupts it.' },
      { t: 'Then the nextTick queue', d: '<code>process.nextTick(fn)</code> callbacks run, in order.' },
      { t: 'Then microtasks', d: 'Promise reactions, code after an <code>await</code>, and <code>queueMicrotask(fn)</code>.', code: "setTimeout(() => console.log('macro'), 0);\nPromise.resolve().then(() => console.log('micro'));\nconsole.log('sync');\n// sync, micro, macro" },
      { t: 'Then one macrotask', d: 'The event loop runs the next timer, I/O callback or immediate, and the whole cycle repeats after it.' }
    ],
    terms: [
      ['macrotask', 'A callback the event loop schedules: timer, I/O, setImmediate. Browsers call it a “task”.'],
      ['microtask', 'A promise job or <code>queueMicrotask</code> callback; runs right after the current code.'],
      ['process.nextTick', 'Node-only queue that runs before promise microtasks.'],
      ['drain', 'Keep running a queue until it is empty, including items added meanwhile.'],
      ['starvation', 'When one queue keeps refilling, so others never get a turn.']
    ]
  },
  visual: {
    title: 'Watch the queues drain',
    caption: 'Pick a program and press Step. Each step runs one statement of the main script or one callback. Try the ESM variant of the classic five, and compare nextTick vs setImmediate in <b>Starvation</b>.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'Sync → micro → macro', code: `console.log('1 sync');\nsetTimeout(() => console.log('5 timer (macrotask)'), 0);\nPromise.resolve().then(() => console.log('3 promise (microtask)'));\nqueueMicrotask(() => console.log('4 queueMicrotask (same queue)'));\nconsole.log('2 sync');`, note: 'Browser semantics match Node here. Node-only APIs (process.nextTick, setImmediate) are covered in the puzzles below.' },
      { label: 'await ordering', code: `async function a() {\n  console.log('a1');\n  await null;\n  console.log('a2');\n}\nconsole.log('s');\na();\nPromise.resolve().then(() => console.log('p'));\nconsole.log('e');`, note: 's a1 e a2 p. The await continuation was queued before p.' },
      { label: 'return vs return await', code: `async function viaReturn() { return Promise.resolve('R'); }\nasync function viaAwait() { return await Promise.resolve('W'); }\nviaReturn().then(console.log);\nviaAwait().then(console.log);\nPromise.resolve()\n  .then(() => console.log(1))\n  .then(() => console.log(2))\n  .then(() => console.log(3));`, note: 'Returning a promise from an async function costs two extra microtask turns.' },
      { label: 'Microtasks between timers', code: `setTimeout(() => {\n  console.log('t1');\n  Promise.resolve().then(() => console.log('promise from t1'));\n}, 0);\nsetTimeout(() => console.log('t2'), 0);`, note: 'Microtasks drain after each timer callback (Node 11+ and browsers).' },
      { label: 'Starving a timer', code: `let n = 0;\nconst start = performance.now();\nsetTimeout(() => console.log('timer ran after', n, 'microtasks,', Math.round(performance.now() - start), 'ms'), 0);\nfunction spin() { if (++n < 2_000_000) queueMicrotask(spin); }\nqueueMicrotask(spin);`, note: 'The 0 ms timer waits for two million microtasks.' }
    ]
  },
  gotchas: [
    { trap: 'Recursive nextTick or promise loops starve I/O', code: `function pump() {\n  if (buffer.length) { handle(buffer.shift()); process.nextTick(pump); }\n}\n// while the buffer is non-empty, no socket is read, no timer fires`, why: 'Both micro-queues drain <b>until empty</b>. Items added during the drain run in the same drain, so the loop never reaches poll or timers.', fix: 'Yield with <code>setImmediate</code> (one batch per lap), or process in chunks.' },
    { trap: 'Assuming nextTick-before-promise everywhere', code: `// main.mjs  (ES module)\nPromise.resolve().then(() => console.log('promise'));\nprocess.nextTick(() => console.log('tick'));\n// prints: promise, tick   (CommonJS prints tick, promise)`, why: 'An ES module’s body is evaluated inside a promise job, so V8 finishes the microtask queue before Node gets to drain nextTicks.', fix: 'Don’t make correctness depend on nextTick vs promise order. If you need strict ordering, chain it explicitly.' },
    { trap: '“await yields to the event loop”', code: `for (const row of rows) {\n  await Promise.resolve();   // no: still runs before any I/O\n  transform(row);\n}`, why: 'Awaiting a resolved value only waits one <b>microtask</b> turn. Timers and sockets still have to wait for the whole loop.', fix: 'To let I/O in, await a macrotask: <code>await setImmediate()</code> from <code>node:timers/promises</code>.' },
    { trap: 'Emitting events synchronously from a constructor', code: `class Conn extends EventEmitter {\n  constructor() { super(); if (!cfg.host) this.emit('error', new Error('no host')); }\n}\nconst c = new Conn();       // throws: no 'error' listener yet\nc.on('error', log);`, why: 'The listener is attached after the constructor returns, so a synchronous emit finds no listener. An unhandled <code>\'error\'</code> event throws.', fix: 'Defer the emit: <code>process.nextTick(() => this.emit(\'error\', err))</code>. This is the textbook use of nextTick.' },
    { trap: 'Returning a promise from an async function “for free”', why: '<code>return somePromise</code> inside an async function resolves the outer promise with a thenable, which costs <b>two extra</b> microtask turns compared with <code>return await somePromise</code>. Normally harmless, but it changes ordering puzzles and stack traces.', fix: 'Prefer <code>return await</code> inside <code>try</code> blocks (it’s also needed to catch errors there; see <a href="async-errors.html">Async error handling</a>). Don’t micro-optimise this elsewhere.' },
    { trap: 'Mixing up the names', why: '<code>process.nextTick</code> runs <i>before</i> the next loop step; <code>setImmediate</code> runs on a later step (check phase). The Node docs admit the names should be swapped.', fix: 'Remember: nextTick ≈ “immediately, before anything else”; setImmediate ≈ “next lap”. Prefer <code>queueMicrotask</code> for portable code.' }
  ],
  scenarios: [
    { title: 'A message consumer stops sending heartbeats under load',
      symptom: 'When the queue backlog is large, the broker drops the consumer for missed heartbeats, although CPU usage is only one core.',
      diagnose: `// consumer loop\nasync function drain() {\n  while (backlog.length) {\n    await processMessage(backlog.shift());   // processMessage is CPU-only, returns a resolved promise\n  }\n}`,
      cause: 'Each <code>await</code> resolves immediately, so the whole backlog runs inside one microtask drain. The heartbeat timer and the socket reads are macrotasks and never get a turn.',
      fix: 'Yield to the loop every N messages, so poll and timers run. Bound the backlog in memory.',
      fixCode: `import { setImmediate as nextLap } from 'node:timers/promises';\nlet n = 0;\nwhile (backlog.length) {\n  await processMessage(backlog.shift());\n  if (++n % 200 === 0) await nextLap();   // heartbeats + socket reads get a turn\n}`, lang: 'ts' },
    { title: 'Crash on start-up: “Unhandled \'error\' event”',
      symptom: 'A custom client crashes the process when the config is wrong, even though the caller does <code>client.on(\'error\', …)</code> on the next line.',
      diagnose: `const client = new QueueClient(cfg);   // emits 'error' inside the constructor\nclient.on('error', (e) => log.warn(e));  // too late`,
      cause: 'The constructor emits synchronously, before any listener exists, and EventEmitter throws on an <code>\'error\'</code> event without a listener.',
      fix: 'Emit asynchronously with <code>process.nextTick</code>, so callers can attach listeners first. Or throw from the constructor, which is clearer for bad config.',
      fixCode: `constructor(cfg) {\n  super();\n  if (!cfg.url) {\n    process.nextTick(() => this.emit('error', new Error('url is required')));\n    return;\n  }\n}` },
    { title: 'Metrics flush on every call',
      symptom: 'A request handler calls <code>metrics.inc()</code> 40 times; the exporter writes 40 UDP packets per request.',
      cause: 'Each call flushes right away. The usual fix is to batch: collect all increments from the current synchronous run, flush once.',
      fix: 'Schedule a single flush with <code>queueMicrotask</code> on the first increment. Every increment in the same synchronous run lands in one batch. (DataLoader batches the same way.)',
      fixCode: `let pending = new Map<string, number>(); let scheduled = false;\nexport function inc(name: string) {\n  pending.set(name, (pending.get(name) ?? 0) + 1);\n  if (!scheduled) { scheduled = true; queueMicrotask(flush); }\n}\nfunction flush() {\n  const batch = pending; pending = new Map(); scheduled = false;\n  sendUdp(serialize(batch));\n}`, lang: 'ts' }
  ],
  puzzles: [
    { kind: 'predict', q: 'CommonJS script. What prints?', code: `console.log('A');\nsetTimeout(() => console.log('B'), 0);\nPromise.resolve().then(() => console.log('C'));\nprocess.nextTick(() => console.log('D'));\nconsole.log('E');`, options: ['A E C D B', 'A E D C B', 'A B C D E', 'A D C E B'], answer: 1, explain: 'Sync first (A, E). Then the nextTick queue (D), then promise microtasks (C), then the event loop’s first macrotask, the timer (B).', run: true, expect: 'A\nE\nD\nC\nB' },
    { kind: 'predict', q: 'nextTicks and promises scheduling each other. What prints?', code: `Promise.resolve().then(() => {\n  console.log('p1');\n  process.nextTick(() => console.log('tick inside p1'));\n}).then(() => console.log('p2'));\n\nprocess.nextTick(() => {\n  console.log('t1');\n  Promise.resolve().then(() => console.log('promise inside t1'));\n});`, options: ['t1, p1, tick inside p1, promise inside t1, p2', 't1, p1, promise inside t1, p2, tick inside p1', 'p1, t1, p2, promise inside t1, tick inside p1', 't1, promise inside t1, p1, p2, tick inside p1'], answer: 1, explain: 'nextTick queue first: <b>t1</b>, which queues a promise job <i>behind</i> p1. Then V8 drains microtasks until empty: <b>p1</b> (queues a nextTick and, by finishing, p2), <b>promise inside t1</b>, <b>p2</b>. The nextTick added during the drain runs last.', run: true, expect: 't1\np1\npromise inside t1\np2\ntick inside p1' },
    { kind: 'predict', q: 'What prints?', code: `async function a() {\n  console.log('a1');\n  await null;\n  console.log('a2');\n}\nconsole.log('s');\na();\nPromise.resolve().then(() => console.log('p'));\nconsole.log('e');`, options: ['s a1 a2 e p', 's a1 e a2 p', 's a1 e p a2', 's e a1 a2 p'], answer: 1, explain: 'An async function runs synchronously until its first <code>await</code>, so a1 prints straight away. The continuation after <code>await null</code> is queued as a microtask <i>before</i> p, so a2 comes before p.', run: true, expect: 's\na1\ne\na2\np' },
    { kind: 'predict', q: 'Returning a promise vs returning an awaited promise. What prints (Node 22)?', code: `async function viaReturn() { return Promise.resolve('R'); }\nasync function viaAwait() { return await Promise.resolve('W'); }\nviaReturn().then((v) => console.log(v));\nviaAwait().then((v) => console.log(v));\nPromise.resolve()\n  .then(() => console.log('1'))\n  .then(() => console.log('2'))\n  .then(() => console.log('3'));`, options: ['R W 1 2 3', '1 W 2 R 3', 'W 1 R 2 3', '1 2 3 W R'], answer: 1, explain: '<code>await</code> on a native promise takes one turn, so W is ready after the first job round and prints right after 1. <code>return promise</code> resolves the async function’s promise with a thenable: one turn to call its <code>then</code>, one more to resolve, then the reaction. So R lands after 2.', run: true, expect: '1\nW\n2\nR\n3' },
    { kind: 'predict', q: 'What prints?', code: `queueMicrotask(() => console.log('micro'));\nprocess.nextTick(() => console.log('tick'));\nPromise.resolve().then(() => console.log('then'));\nconsole.log('sync');`, options: ['sync micro tick then', 'sync tick micro then', 'sync tick then micro', 'tick sync micro then'], answer: 1, explain: '<code>queueMicrotask</code> and promise reactions share V8’s microtask queue (FIFO: micro, then then). The nextTick queue drains before it.', run: true, expect: 'sync\ntick\nmicro\nthen' },
    { kind: 'predict', q: 'A 0 ms timer vs a recursive nextTick. What prints?', code: `let n = 0;\nsetTimeout(() => console.log('timeout after', n, 'ticks'), 0);\nfunction spin() {\n  n++;\n  if (n < 1000) process.nextTick(spin);\n}\nprocess.nextTick(spin);`, options: ['timeout after 0 ticks', 'timeout after 1 ticks', 'timeout after 1000 ticks', 'It never prints'], answer: 2, explain: 'The nextTick queue drains until empty, including ticks added during the drain. All 1000 spins run before the event loop gets to the timer. With no upper bound, the timer would never run: starvation.', run: true, expect: 'timeout after 1000 ticks' },
    { kind: 'concept', q: 'The classic five as an <b>ES module</b> (<code>main.mjs</code>). What prints?', code: `console.log('A');\nsetTimeout(() => console.log('B'), 0);\nPromise.resolve().then(() => console.log('C'));\nprocess.nextTick(() => console.log('D'));\nconsole.log('E');`, options: ['A E D C B', 'A E C D B', 'A C D E B', 'A E B C D'], answer: 1, explain: 'ESM evaluation runs inside a promise job. Promise jobs queued during it run in the same microtask checkpoint, before Node regains control and drains the nextTick queue. So C comes before D. The timer is still last.' },
    { kind: 'concept', q: 'A background job loops over 1M items. Which way of yielding lets HTTP requests in between batches?', options: ['await Promise.resolve() every 1000 items', 'process.nextTick between batches', 'await setImmediate() (node:timers/promises) every 1000 items', 'queueMicrotask between batches'], answer: 2, explain: 'Only a macrotask yield goes back to the event loop, so the poll phase can read sockets. The other three are micro-queue items: they run before any I/O.' }
  ],
  interview: [
    { q: 'What is the difference between a microtask and a macrotask?', a: '<p>A <b>macrotask</b> is a unit of work the event loop schedules: a timer callback, an I/O callback, a <code>setImmediate</code>. A <b>microtask</b> is a job that must run as soon as the current JavaScript finishes: promise reactions, <code>await</code> continuations, <code>queueMicrotask</code>. After every macrotask, all microtasks are drained, including new ones, before the next macrotask.</p>', lvl: 'core' },
    { q: 'Where does process.nextTick fit?', a: '<p>Node keeps a separate nextTick queue. When a JavaScript callback returns, Node drains nextTicks, then V8 drains microtasks, and it repeats while either queue has work. So in CommonJS, nextTick runs before promise jobs scheduled at the same time. It isn’t part of the libuv phases.</p>', fu: 'When does the order flip? (Inside ESM top-level code and inside a microtask: the microtask queue finishes first.)', lvl: 'core' },
    { q: 'process.nextTick vs queueMicrotask vs setImmediate: when do you use which?', a: '<ul><li><b>queueMicrotask</b>: portable “right after this code”, e.g. batching. Same queue as promises.</li><li><b>process.nextTick</b>: Node-specific; classic use is deferring an <code>emit</code> or callback so the caller can attach listeners first. Runs even before promises.</li><li><b>setImmediate</b>: “after pending I/O”. Use it to yield in long jobs.</li></ul>', lvl: 'core' },
    { q: 'What is starvation, and which APIs can cause it?', a: '<p>When a queue keeps refilling itself, later queues never run. Recursive <code>process.nextTick</code>, recursive <code>queueMicrotask</code> and long chains of already-resolved promises all drain in one go, so timers and I/O wait. A recursive <code>setImmediate</code> doesn’t starve: immediates added during the check phase run on the next lap, after poll.</p>', lvl: 'core' },
    { q: 'How many microtask turns does an await take?', a: '<p>For a native promise or a plain value: <b>one</b>, since V8 7.2 (Node 12) removed two extra turns. For a non-native thenable, more. <code>return promise</code> inside an async function costs two more turns than <code>return await promise</code>, because the outer promise is resolved with a thenable.</p>', lvl: 'deep' },
    { q: 'Why does an async function print synchronously at first?', a: '<p>Calling an async function runs its body synchronously until the first <code>await</code> (or until it returns). Only the part after the <code>await</code> becomes a microtask. A synchronous throw before any await becomes a rejected promise, not a thrown exception.</p>', lvl: 'core' },
    { q: 'When does Node detect an unhandled rejection?', a: '<p>After the microtask queue has drained: Node runs its rejection processing at the end of <code>processTicksAndRejections</code>. A <code>.catch</code> attached in the same synchronous run or in a microtask is in time; one attached in a later macrotask (for example a <code>setTimeout</code>) is too late, and with the default <code>--unhandled-rejections=throw</code> the process crashes first. See <a href="async-errors.html">Async error handling</a>.</p>', lvl: 'deep' },
    { q: 'Does the browser have process.nextTick?', a: '<p>No. Browsers have tasks (macrotasks), microtasks and rendering steps. <code>queueMicrotask</code> and promises behave the same in both, and since Node 11 the microtask timing between timer callbacks matches too. That’s why the playground here can run promise examples, but not nextTick or setImmediate.</p>', lvl: 'core' },
    { q: 'How would you explain this to a Java developer?', a: '<p>Think of a single-threaded <code>Executor</code> with two inboxes. A <code>CompletableFuture.thenApply</code> on an already-completed future runs <b>inline</b> on the caller’s thread, a bit like a microtask (it runs before anything else). <code>thenApplyAsync</code> submits a new task to an executor, a bit like a macrotask. Node makes the rule strict: every promise continuation is deferred, but always before the next macrotask.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Defer an emit so callers can listen', lang: 'ts', code: `import { EventEmitter } from 'node:events';

export class Client extends EventEmitter {
  constructor(private url?: string) {
    super();
    if (!url) {
      // listeners attached right after "new Client()" will still see this
      process.nextTick(() => this.emit('error', new Error('url is required')));
      return;
    }
    process.nextTick(() => this.emit('ready'));
  }
}

const c = new Client();
c.on('error', (e) => console.error('config problem:', e.message));`, note: 'Node’s own streams and sockets use exactly this pattern for errors raised during construction.' },
    { title: 'Batch calls into one flush per run', lang: 'ts', code: `type Key = string;
const queue = new Map<Key, Array<(v: User) => void>>();
let scheduled = false;

export function loadUser(id: Key): Promise<User> {
  return new Promise((resolve) => {
    queue.set(id, [...(queue.get(id) ?? []), resolve]);
    if (!scheduled) { scheduled = true; queueMicrotask(flush); }
  });
}

async function flush() {
  const batch = new Map(queue); queue.clear(); scheduled = false;
  const users = await db.users.findMany({ where: { id: { in: [...batch.keys()] } } });
  for (const u of users) batch.get(u.id)?.forEach((r) => r(u));
}`, note: 'Every <code>loadUser</code> call made in the same synchronous run (e.g. a GraphQL resolver pass) becomes one query. This is how DataLoader works. Error handling is left out for brevity.' },
    { title: 'Java comparison: inline vs scheduled continuations', lang: 'java', code: `CompletableFuture<String> done = CompletableFuture.completedFuture("x");

// runs INLINE on the calling thread, right now (≈ a microtask, but even sooner:
// Java doesn't wait for the current method to finish)
done.thenApply(s -> { log("inline"); return s; });

// submitted to an executor as a new task (≈ a macrotask)
done.thenApplyAsync(s -> { log("async"); return s; }, executor);

log("after");
// "inline" always prints first; "after" and "async" can come in either order,
// because the async stage runs on another thread.
// The Node equivalent of thenApply would print "after" first: promise
// reactions are always deferred to the microtask queue.`, note: 'Node never runs a <code>.then</code> callback synchronously, even on a resolved promise. That keeps ordering predictable (no “Zalgo”).' }
  ]
});

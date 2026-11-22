IA.register({
  track: 'nodejs',
  slug: 'eventemitter',
  title: 'EventEmitter',
  tagline: 'An EventEmitter is a <b>map from event names to arrays of functions</b>. <code>emit()</code> calls them <b>synchronously</b>, in order, on the caller’s stack. Streams, sockets, servers and <code>process</code> are all emitters, so its rules about <code>\'error\'</code>, ordering and leaks apply everywhere.',
  tldr: {
    problem: 'A process that crashes on an <code>\'error\'</code> nobody listened for, a <code>MaxListenersExceededWarning</code> in the logs that turns out to be a memory leak, and async listeners whose rejections go nowhere.',
    model: '<code>on(name, fn)</code> appends to the array for <code>name</code>; <code>once</code> appends a wrapper that removes itself; <code>prependListener</code> puts it first. <code>emit(name, …args)</code> copies the array and calls each function in turn with <code>this</code> = the emitter, then returns <code>true</code> if there were listeners. It never awaits anything.',
    hook: '“Is <code>emit()</code> async?” No. Listeners run before <code>emit()</code> returns. And: emitting <code>\'error\'</code> with no listener <b>throws</b>, which crashes the process if nothing catches it.',
    facts: [
      { v: '10', l: 'default max listeners per event. The 11th prints a <code>MaxListenersExceededWarning</code>, once per event name, but the listener is still added' },
      { v: 'sync', l: '<code>emit()</code> calls listeners in registration order before it returns. A listener that throws stops the rest' },
      { v: '\'error\'', l: 'the one special event name: emitted with no listener, Node throws the error (or <code>ERR_UNHANDLED_ERROR</code> for non-Error values)' }
    ]
  },
  intro: {
    what: 'Many Node objects need to say “something happened”: a server got a request, a stream has data, a socket closed. They do this with an <b>EventEmitter</b>. Other code subscribes by name (<code>server.on(\'request\', handler)</code>), and when the object calls <code>emit(\'request\', req, res)</code>, every subscribed function is called with those arguments. It is the observer pattern, built into Node.',
    analogy: { icon: '📣', title: 'A noticeboard with sign-up sheets', text: 'Each event name has a sign-up sheet. <code>on</code> writes your name at the bottom; <code>prependListener</code> squeezes it in at the top; <code>once</code> writes it in pencil, erased after the first call. When the event happens, the emitter photocopies the sheet and phones everyone on the copy, one after another, waiting for each to hang up. The <code>\'error\'</code> sheet is special: if nobody signed it, the building’s fire alarm goes off.' },
    steps: [
      { t: 'Create or extend an emitter', d: 'Most of the time you use one Node already made (a stream, a server). For your own, extend the class.', code: "const { EventEmitter } = require('node:events');\nclass Job extends EventEmitter {}\nconst job = new Job();" },
      { t: 'Subscribe with on / once', d: 'Listeners get whatever arguments <code>emit</code> passes.', code: "job.on('progress', (pct) => console.log(pct + '%'));\njob.once('done', () => console.log('finished'));" },
      { t: 'Emit', d: '<code>emit</code> runs every listener right now, in order, then returns.', code: "job.emit('progress', 50);   // prints 50% before the next line\njob.emit('done');\njob.emit('done');            // once: nothing this time" },
      { t: 'Always handle \'error\'', d: 'An <code>\'error\'</code> event with no listener throws. Add one to anything that can fail: streams, sockets, clients.' },
      { t: 'Unsubscribe', d: '<code>off(name, fn)</code> needs the <b>same function</b> you passed to <code>on</code>, so keep a reference.' }
    ],
    terms: [
      ['listener', 'A function registered for an event name.'],
      ['emit', 'Call all listeners of an event name, synchronously, with the given arguments.'],
      ['once', 'A listener that removes itself before its first call.'],
      ['maxListeners', 'A leak-detection threshold per event (default 10). Going over it only warns.'],
      ['events.once()', 'A helper that returns a promise for the next emission of an event.'],
      ['captureRejections', 'An option that routes rejected promises from async listeners to <code>\'error\'</code>.']
    ]
  },
  visual: {
    title: 'Watch the listener arrays as you on, once, emit and off',
    caption: 'Pick a script and press Play or Step. Each row is one event name and its listener array. During <code>emit</code> the highlighted listener is running, and the grey strip shows the <b>copy</b> that <code>emit</code> iterates. Try <b>Remove during emit</b> and <b>Leak</b>.'
  },
  gotchas: [
    { trap: 'No \'error\' listener', code: `const client = net.connect(5432, 'db');\n// ECONNREFUSED → client.emit('error', err) → nobody listening → throw\n// → uncaught exception → process exits`, why: '<code>\'error\'</code> is the one event Node treats specially. With no listener, <code>emit(\'error\', err)</code> throws <code>err</code>. Coming from a socket callback, nothing can catch it.', fix: 'Attach <code>\'error\'</code> handlers to every socket, stream and client you create, or use <code>pipeline</code>/<code>events.once</code>, which do. <code>events.errorMonitor</code> lets you observe errors without counting as a handler.' },
    { trap: 'Adding a listener per request to a long-lived emitter', code: `app.get('/stream', (req, res) => {\n  bus.on('price', (p) => res.write(fmt(p)));\n  // never removed: the closure keeps res alive forever\n});`, why: 'Each request adds a closure to <code>bus</code>’s array. The array grows forever, the closures keep <code>req</code>/<code>res</code> reachable, and every <code>emit</code> gets slower. <code>MaxListenersExceededWarning</code> is the hint.', fix: 'Remove the listener when the request ends: <code>res.on(\'close\', () => bus.off(\'price\', onPrice))</code>. Or use <code>events.on(bus, \'price\', { signal })</code> with an AbortSignal tied to the request.' },
    { trap: 'Silencing the warning with setMaxListeners(0)', why: 'The warning is a leak detector. Raising the limit to “unlimited” hides the leak instead of fixing it.', fix: 'Raise it only when many listeners are legitimate (for example a fan-out with a known count), and set the exact number. Run with <code>--trace-warnings</code> to see the stack that added the 11th listener.' },
    { trap: 'Async listeners: emit doesn’t wait, rejections go nowhere', code: `emitter.on('order', async (o) => {\n  await save(o);          // rejects\n});\nemitter.emit('order', o); // returns true immediately\n// → unhandledRejection → process exits (Node 15+ default)`, why: '<code>emit</code> ignores return values. A rejected promise from a listener is an unhandled rejection, which by default crashes Node 15 and later.', fix: 'Catch inside the listener, or create the emitter with <code>new EventEmitter({ captureRejections: true })</code> so rejections are re-emitted as <code>\'error\'</code>.' },
    { trap: 'off() with a different function', code: `emitter.on('tick', this.onTick.bind(this));\nemitter.off('tick', this.onTick.bind(this));  // a NEW function: removes nothing`, why: 'Listeners are matched by identity. <code>bind</code> and inline arrows create a new function each time.', fix: 'Store the bound function once (<code>this.onTick = this.onTick.bind(this)</code> or a class field arrow) and pass the same reference to <code>on</code> and <code>off</code>.' },
    { trap: 'Emitting from the constructor', code: `class Conn extends EventEmitter {\n  constructor() { super(); this.emit('ready'); }   // nobody is listening yet\n}\nnew Conn().on('ready', go);   // never called`, why: 'Listeners can only be added after the constructor returns, and emit is synchronous.', fix: 'Defer the emit: <code>process.nextTick(() => this.emit(\'ready\'))</code>. That is what Node core does for the same reason.' },
    { trap: 'Arrow functions and this', why: 'With a regular <code>function</code> listener, <code>this</code> is the emitter. With an arrow function, <code>this</code> is whatever it was where the arrow was written.', fix: 'Use the emitter variable explicitly, or a regular function when you rely on <code>this</code>.' }
  ],
  scenarios: [
    { title: 'MaxListenersExceededWarning, then a slow memory climb',
      symptom: 'Logs show <code>MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 reconnect listeners added to [RedisClient]</code>. Heap grows about 30 MB an hour until the pod restarts.',
      diagnose: `node --trace-warnings server.js     # stack of the call that added #11\n\n// at runtime\nconst { getEventListeners } = require('node:events');\nconsole.log(getEventListeners(redis, 'reconnect').length);   // 48 210`,
      cause: 'A request-scoped service subscribes to the shared Redis client’s <code>\'reconnect\'</code> event to invalidate its cache, and never unsubscribes. Each closure retains the request’s service graph.',
      fix: 'Subscribe once at start-up, in a singleton, or tie the subscription to the request’s lifetime with an AbortSignal.',
      fixCode: `import { on } from 'node:events';\n\nasync function watch(req, res) {\n  const ac = new AbortController();\n  res.on('close', () => ac.abort());          // request over → listener removed\n  try {\n    for await (const [price] of on(bus, 'price', { signal: ac.signal })) {\n      res.write(fmt(price));\n    }\n  } catch (e) { if (e.name !== 'AbortError') throw e; }\n}`, lang: 'ts' },
    { title: 'The service dies on a database failover',
      symptom: 'During a planned Postgres failover, every Node pod restarts at the same moment. Logs end with <code>Error: Connection terminated unexpectedly</code> and <code>Emitted \'error\' event on Client instance</code>.',
      diagnose: `// the crash message names the emitter\nnode:events:497\n      throw er; // Unhandled 'error' event\n      ^\nError: Connection terminated unexpectedly\nEmitted 'error' event on Client instance at: …`,
      cause: 'A dedicated <code>pg.Client</code> for LISTEN/NOTIFY had no <code>\'error\'</code> listener. When the server closed the connection, the client emitted <code>\'error\'</code>, and with no listener that became an uncaught exception.',
      fix: 'Listen for <code>\'error\'</code> on every client, socket and stream, log it and reconnect with backoff. Pools also emit <code>\'error\'</code> for idle clients.',
      fixCode: `const client = new pg.Client(cfg);\nclient.on('error', (err) => {\n  log.warn({ err }, 'listen client lost; reconnecting');\n  scheduleReconnect();\n});\npool.on('error', (err) => log.warn({ err }, 'idle client error'));`, lang: 'ts' },
    { title: 'Webhook processing silently stops',
      symptom: 'After a bad payload, no more webhooks are processed, but the HTTP endpoint still returns 202.',
      diagnose: `queue.on('job', async (job) => {\n  const data = JSON.parse(job.body);   // throws on bad JSON\n  await handle(data);\n});\n// process exits on unhandledRejection; supervisor restarts it without the in-memory queue`,
      cause: 'The async listener rejected. <code>emit</code> ignored the promise, so the rejection was unhandled and the process exited (Node 15+), losing the in-memory queue.',
      fix: 'Turn on <code>captureRejections</code> so the rejection becomes an <code>\'error\'</code> event you handle, and keep jobs in a durable queue rather than in process memory.',
      fixCode: `import { EventEmitter } from 'node:events';\n\nconst queue = new EventEmitter({ captureRejections: true });\nqueue.on('job', async (job) => { await handle(JSON.parse(job.body)); });\nqueue.on('error', (err) => log.error({ err }, 'job failed'));`, lang: 'ts' }
  ],
  puzzles: [
    { kind: 'predict', q: '<code>on</code>, <code>prependListener</code> and <code>once</code> on the same event. What prints?', code: `const EventEmitter = require('events');\nconst e = new EventEmitter();\ne.on('x', (n) => console.log('first', n));\ne.prependListener('x', (n) => console.log('prepended', n));\ne.once('x', (n) => console.log('once', n));\nconsole.log('emit 1');\ne.emit('x', 1);\nconsole.log('emit 2');\ne.emit('x', 2);\nconsole.log(e.listenerCount('x'));`, options: ['emit 1, first 1, prepended 1, once 1, emit 2, first 2, prepended 2, 2', 'emit 1, prepended 1, first 1, once 1, emit 2, prepended 2, first 2, 2', 'emit 1, prepended 1, first 1, once 1, emit 2, prepended 2, first 2, once 2, 3', 'emit 1, once 1, prepended 1, first 1, emit 2, prepended 2, first 2, 2'], answer: 1, explain: 'The array is <code>[prepended, first, once]</code>. <code>emit</code> calls them in that order, synchronously, before the next <code>console.log</code>. The once-wrapper removed itself, so two listeners remain.', run: true, expect: 'emit 1\nprepended 1\nfirst 1\nonce 1\nemit 2\nprepended 2\nfirst 2\n2' },
    { kind: 'predict', q: 'A listener removes another listener and adds a new one during <code>emit</code>. What prints?', code: `const EventEmitter = require('events');\nconst e = new EventEmitter();\nfunction b() { console.log('B'); }\ne.on('go', () => {\n  console.log('A');\n  e.removeListener('go', b);\n  e.on('go', () => console.log('C'));\n});\ne.on('go', b);\ne.emit('go');\nconsole.log('---');\ne.emit('go');`, options: ['A, ---, A, C', 'A, B, C, ---, A, C, C', 'A, B, ---, A, C', 'A, C, ---, A, C, C'], answer: 2, explain: '<code>emit</code> iterates a <b>copy</b> of the array taken when it started. Removing B and adding C during the first emit don’t change that copy, so B still runs and C doesn’t. The second emit copies <code>[A, C]</code>; the extra C added during it waits for the next emit.', run: true, expect: 'A\nB\n---\nA\nC' },
    { kind: 'predict', q: 'Emitting <code>\'error\'</code> with and without a listener. What prints?', code: `const EventEmitter = require('events');\nconst e = new EventEmitter();\ntry {\n  e.emit('error', new Error('boom'));\n} catch (err) {\n  console.log('caught', err.message);\n}\ne.on('error', (err) => console.log('handled', err.message));\nconsole.log(e.emit('error', new Error('boom2')));\nconsole.log(e.emit('nothing'));`, options: ['handled boom, true, false', 'caught boom, handled boom2, true, false', 'caught boom, handled boom2, true, true', 'Nothing: the first emit is ignored, then handled boom2, true, false'], answer: 1, explain: 'With no <code>\'error\'</code> listener, <code>emit</code> throws the error itself, synchronously, so <code>try/catch</code> around it works here. <code>emit</code> returns <code>true</code> if the event had listeners and <code>false</code> otherwise.', run: true, expect: 'caught boom\nhandled boom2\ntrue\nfalse' },
    { kind: 'predict', q: 'The first listener throws. What prints?', code: `const EventEmitter = require('events');\nconst e = new EventEmitter();\ne.on('x', () => { throw new Error('first failed'); });\ne.on('x', () => console.log('second'));\ntry {\n  e.emit('x');\n} catch (err) {\n  console.log('emit threw:', err.message);\n}`, options: ['second, then emit threw: first failed', 'emit threw: first failed', 'second', 'Only an \'error\' event is emitted'], answer: 1, explain: 'Listeners are plain synchronous calls in a loop. The exception unwinds out of <code>emit</code> and the remaining listeners never run. Node doesn’t convert it into an <code>\'error\'</code> event.', run: true, expect: 'emit threw: first failed' },
    { kind: 'predict', q: '<code>this</code> inside listeners. What prints?', code: `const EventEmitter = require('events');\nclass Job extends EventEmitter {\n  constructor() { super(); this.name = 'job1'; }\n}\nconst j = new Job();\nj.on('done', function () { console.log(this.name); });\nj.on('done', () => console.log(this === j));\nj.emit('done');`, options: ['job1, true', 'undefined, false', 'job1, false', 'undefined, true'], answer: 2, explain: 'Node calls listeners with <code>this</code> bound to the emitter, which a regular function sees. An arrow function ignores that and keeps the <code>this</code> of the module scope (<code>module.exports</code> in CommonJS).', run: true, expect: 'job1\nfalse' },
    { kind: 'predict', q: 'Awaiting an event with <code>events.once</code>. What prints?', code: `const { EventEmitter, once } = require('events');\nconst e = new EventEmitter();\n(async () => {\n  setImmediate(() => e.emit('ready', 42, 'x'));\n  const args = await once(e, 'ready');\n  console.log(args);\n})();`, options: ['42', "[ 42, 'x' ]", "{ 0: 42, 1: 'x' }", 'undefined'], answer: 1, explain: '<code>events.once()</code> resolves with an <b>array</b> of all the arguments passed to <code>emit</code>. It also rejects if the emitter emits <code>\'error\'</code> first, and accepts <code>{ signal }</code> to cancel.', run: true, expect: "[ 42, 'x' ]" },
    { kind: 'concept', q: 'You add an 11th <code>\'data\'</code> listener to one emitter. What happens?', options: ['An exception is thrown and the listener is not added', 'The listener is added, and Node prints a MaxListenersExceededWarning (once for that event name)', 'The oldest listener is removed', 'Nothing at all'], answer: 1, explain: 'The limit is only a leak detector. Node calls <code>process.emitWarning</code> once per emitter and event name and still adds the listener. <code>setMaxListeners(n)</code> changes the threshold; <code>--trace-warnings</code> shows who added it.' },
    { kind: 'concept', q: 'An async listener rejects. What does <code>new EventEmitter({ captureRejections: true })</code> change?', options: ['emit() now awaits the listener', 'The rejection is turned into an \'error\' event on the emitter (or a Symbol.for(\'nodejs.rejection\') method if defined)', 'The rejection is silently swallowed', 'The listener is retried'], answer: 1, explain: 'Without it, the rejected promise is ignored by <code>emit</code> and becomes an unhandled rejection. With it, Node attaches a handler and routes the error to <code>\'error\'</code>. <code>emit</code> still doesn’t wait.' }
  ],
  interview: [
    { q: 'Is EventEmitter.emit synchronous or asynchronous?', a: '<p>Synchronous. It calls every listener in registration order, on the current stack, and returns only after the last one returns. That is why an emitter can’t be used to “defer” work, and why a slow listener slows the emitter. If a listener needs to defer, it uses <code>setImmediate</code> or <code>queueMicrotask</code>.</p>', lvl: 'core' },
    { q: 'What is special about the \'error\' event?', a: '<p>If <code>\'error\'</code> is emitted and there is no listener, <code>emit</code> throws the error (wrapping a non-Error in <code>ERR_UNHANDLED_ERROR</code>). In callback code that becomes an uncaught exception and the process exits. Every stream, socket and client therefore needs an <code>\'error\'</code> listener, or must be used through <code>pipeline</code>/<code>events.once</code>. <code>events.errorMonitor</code> lets you observe errors without “handling” them.</p>', lvl: 'core' },
    { q: 'What does MaxListenersExceededWarning mean?', a: '<p>More than <code>maxListeners</code> (default 10) listeners are registered for one event on one emitter. Node warns once and still adds the listener. It usually means listeners are being added in a loop or per request and never removed. Find the source with <code>--trace-warnings</code>; inspect with <code>emitter.listenerCount(name)</code> or <code>events.getEventListeners()</code>. Raise the limit only for a known, bounded fan-out.</p>', lvl: 'core' },
    { q: 'How do once() and events.once() differ?', a: '<p><code>emitter.once(name, fn)</code> registers a wrapper that removes itself and calls <code>fn</code> once. <code>events.once(emitter, name)</code> returns a <b>promise</b> that resolves with the array of emitted arguments, rejects if <code>\'error\'</code> is emitted first, and takes an AbortSignal. <code>rawListeners()</code> shows the once-wrappers; <code>listeners()</code> shows your functions.</p>', lvl: 'core' },
    { q: 'What happens if a listener is removed while emit is running?', a: '<p>Nothing for the current emit. <code>emit</code> iterates a copy of the listener array, so a listener removed mid-emit still runs this time, and one added mid-emit runs only on the next emit. The change takes effect for the next <code>emit</code>.</p>', lvl: 'deep' },
    { q: 'How do you consume events with async/await?', a: '<p><code>await events.once(emitter, \'ready\')</code> for a single event. <code>for await (const [msg] of events.on(emitter, \'message\', { signal }))</code> for a stream of events. <code>events.on</code> buffers events that arrive while your loop body is busy, so it doesn’t give the emitter backpressure, and it ends with an AbortError when the signal aborts.</p>', fu: 'Why is buffering a risk? A fast emitter and slow loop grow that buffer without limit.', lvl: 'deep' },
    { q: 'Why do async listeners cause trouble, and what is captureRejections?', a: '<p><code>emit</code> ignores what listeners return, so the promise from an async listener is not awaited and its rejection is unhandled, which crashes Node 15+ by default. <code>captureRejections: true</code> (per emitter, or <code>EventEmitter.captureRejections = true</code> globally) routes those rejections to the emitter’s <code>\'error\'</code> event.</p>', lvl: 'deep' },
    { q: 'EventEmitter vs EventTarget in Node?', a: '<p>Node also implements the web <code>EventTarget</code>/<code>Event</code> API (used by <code>AbortSignal</code>, <code>MessagePort</code> in some forms, <code>BroadcastChannel</code>). Differences: listeners get one <code>Event</code> object; no special <code>\'error\'</code> semantics; the same listener can’t be registered twice; listener exceptions are reported via <code>process</code> rather than thrown out of <code>dispatchEvent</code>. Use <code>EventEmitter</code> for Node-style APIs.</p>', lvl: 'deep' },
    { q: 'Which patterns use EventEmitter well, and when should you use something else?', a: '<ul><li>Good: lifecycle and status signals (<code>\'ready\'</code>, <code>\'close\'</code>), streams of notifications inside one process, decoupling a library from its users.</li><li>Use something else for request/response (a function returning a promise), for work that must not be lost (a durable queue), and across processes (Redis pub/sub, Kafka). An in-process emitter is not a message broker.</li></ul>', lvl: 'core' },
    { q: 'How does this compare with Spring application events?', a: '<p><code>ApplicationEventPublisher.publishEvent()</code> with <code>@EventListener</code> is also synchronous by default: listeners run on the publisher’s thread, in order (<code>@Order</code>), and an exception propagates to the publisher. <code>@Async</code> listeners run on an executor; <code>@TransactionalEventListener</code> runs after commit. Node has no built-in equivalent of the after-commit phase.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'A typed emitter wrapper', lang: 'ts', code: `import { EventEmitter } from 'node:events';

type Events = {
  progress: [pct: number];
  done: [result: { rows: number }];
  error: [err: Error];
};

export class Job {
  readonly #ee = new EventEmitter({ captureRejections: true });

  on<K extends keyof Events>(name: K, fn: (...args: Events[K]) => void) {
    this.#ee.on(name, fn as (...a: unknown[]) => void);
    return () => this.#ee.off(name, fn as (...a: unknown[]) => void);   // unsubscribe handle
  }
  protected emit<K extends keyof Events>(name: K, ...args: Events[K]) {
    return this.#ee.emit(name, ...args);
  }
}

// const off = job.on('progress', (p) => bar.update(p)); … off();`, note: 'Returning an unsubscribe function makes it hard to forget the matching <code>off</code> call.' },
    { title: 'Request-scoped subscriptions with AbortSignal', lang: 'ts', code: `import { on, once } from 'node:events';

export async function sse(req: IncomingMessage, res: ServerResponse) {
  const ac = new AbortController();
  req.once('close', () => ac.abort());
  res.writeHead(200, { 'content-type': 'text/event-stream' });

  try {
    for await (const [evt] of on(bus, 'order', { signal: ac.signal })) {
      if (!res.write('data: ' + JSON.stringify(evt) + '\\n\\n')) {
        await once(res, 'drain', { signal: ac.signal });
      }
    }
  } catch (e) {
    if ((e as Error).name !== 'AbortError') throw e;
  }   // listener is removed when the signal aborts
}`, note: 'The listener’s lifetime equals the request’s, so no listener outlives its client.' },
    { title: 'Java comparison: Spring events', lang: 'java', code: `public record OrderPlaced(long id) {}

@Service
class Checkout {
  private final ApplicationEventPublisher events;
  Checkout(ApplicationEventPublisher events) { this.events = events; }

  @Transactional
  public void place(Order o) {
    repo.save(o);
    events.publishEvent(new OrderPlaced(o.id()));   // sync, like emit()
  }
}

@Component
class Mailer {
  @TransactionalEventListener   // runs after commit; no Node equivalent built in
  @Async                        // and off the caller's thread
  void on(OrderPlaced e) { mail.sendConfirmation(e.id()); }
}`, note: 'A plain <code>@EventListener</code> behaves like <code>emit</code>: synchronous, ordered, exceptions reach the publisher.' }
  ]
});

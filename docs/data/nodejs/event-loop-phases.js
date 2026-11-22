IA.register({
  track: 'nodejs',
  slug: 'event-loop-phases',
  title: 'Event-loop phases',
  tagline: 'The event loop is a <b>fixed lap through six phases</b>: timers, pending callbacks, idle/prepare, poll, check, close. Each phase has its own queue. Knowing the lap order explains every <code>setTimeout</code> vs <code>setImmediate</code> puzzle, and why one slow callback delays all of them.',
  tldr: {
    problem: 'Timers that fire “late”, <code>setImmediate</code> vs <code>setTimeout(0)</code> races that change between runs, and a server whose callbacks all stall together. All of these come from not knowing where in the lap your callback runs.',
    model: 'Each lap: <b>timers</b> (expired setTimeout/setInterval) → <b>pending</b> (deferred system callbacks) → idle/prepare (internal) → <b>poll</b> (I/O callbacks; the loop <i>waits here</i> when idle) → <b>check</b> (setImmediate) → <b>close</b> (handle close callbacks). After <b>every single callback</b>, Node drains the nextTick queue and then the promise microtask queue.',
    hook: '“Which runs first, setTimeout(0) or setImmediate?” In the main module: it depends on timing. Inside an I/O callback: setImmediate, always, because check comes straight after poll.',
    facts: [
      { v: '6', l: 'phases per lap: timers, pending callbacks, idle/prepare, poll, check, close callbacks' },
      { v: '1 ms', l: 'what <code>setTimeout(fn, 0)</code> really asks for. Delays below 1 (or above 2³¹−1) become 1' },
      { v: 'Node 11', l: 'since then, nextTicks and microtasks run after <b>each</b> timer/immediate callback, not only between phases (matching browsers)' }
    ]
  },
  intro: {
    what: 'Node runs your JavaScript on one thread. When your code says “do this later” (a timer, a file read, a network reply), the callback goes into a queue. The <b>event loop</b> is the code that keeps checking those queues and running what’s ready. It checks them in a fixed order, a bit like a bus route with six stops, and it loops until there is nothing left to wait for.',
    analogy: { icon: '🚌', title: 'A bus route with six stops', text: 'The bus (main thread) drives a circular route. At the <b>timers</b> stop it picks up everyone whose alarm has gone off. At <b>poll</b> it picks up finished I/O, and if no one is waiting anywhere it parks there until someone arrives. At <b>check</b> it picks up the <code>setImmediate</code> crowd. Between every single passenger it first serves the VIP lane: <code>process.nextTick</code>, then promises.' },
    steps: [
      { t: 'Your script runs first', d: 'The main module runs top to bottom. Calls such as <code>setTimeout</code> only <i>register</i> callbacks.' },
      { t: 'The loop starts its laps', d: 'Timers → pending → poll → check → close, then around again.', code: "setTimeout(() => console.log('timer'), 0);\nsetImmediate(() => console.log('immediate'));\nconsole.log('script');   // always first" },
      { t: 'Each stop runs its own queue', d: 'Timers whose time has come, finished I/O, immediates, and close events.' },
      { t: 'Microtasks squeeze in between', d: 'After each callback, Node empties the <code>process.nextTick</code> queue, then the promise queue. See <a href="microtasks-macrotasks.html">Microtasks vs macrotasks</a>.' },
      { t: 'The loop ends when nothing is left', d: 'No pending timers, sockets, servers or requests: the process exits.' }
    ],
    terms: [
      ['phase', 'One stop of the loop with its own queue of callbacks.'],
      ['callback', 'A function you pass in to be called later.'],
      ['setImmediate', 'Run a callback in the <b>check</b> phase of this lap (or the next).'],
      ['poll', 'The phase that runs I/O callbacks and waits for I/O when idle.'],
      ['microtask', 'A promise job; runs after the current callback, before the next one.'],
      ['handle', 'A long-lived libuv object (timer, socket, server) that keeps the loop alive.']
    ]
  },
  visual: {
    title: 'Run the loop one callback at a time',
    caption: 'Pick a scenario and press Play or Step. The highlighted box is the current phase, the badges count waiting callbacks, and the centre shows the nextTick and microtask queues. Try <b>Main module race</b> and flip the start-up timing.'
  },
  gotchas: [
    { trap: 'Relying on setTimeout(0) vs setImmediate order in the main module', code: `// main module: prints in either order, run to run\nsetTimeout(() => console.log('timeout'), 0);\nsetImmediate(() => console.log('immediate'));`, why: 'The 0 ms timer is really 1 ms. If the loop starts its first lap less than 1 ms after the call, the timer isn’t due yet, so check runs first. If start-up took longer, timers runs first. That depends on machine load.', fix: 'If you need “after I/O, before timers”, call <code>setImmediate</code> from inside an I/O callback, where the order is fixed. Better: don’t encode ordering in timers at all; chain explicitly.' },
    { trap: 'Treating timer delays as exact', code: `setTimeout(sendHeartbeat, 1000);\nheavySyncWork();   // 1.5 s of CPU\n// heartbeat goes out at ~1.5 s, not 1 s`, why: 'A timer delay is a <b>minimum</b>. The callback runs on the first timers phase after it expires, and only when the main thread is free.', fix: 'Keep callbacks short and measure event-loop delay. For deadlines, compare <code>performance.now()</code> instead of trusting the timer.' },
    { trap: 'setInterval piling up work', code: `setInterval(async () => {\n  await syncWithPartner();   // sometimes takes 8 s\n}, 5000);                    // runs overlap`, why: '<code>setInterval</code> doesn’t wait for your async work to finish, so slow runs overlap and stack up.', fix: 'Use a loop that schedules the next run after the current one finishes: <code>for await (const _ of setInterval(5000))</code> from <code>node:timers/promises</code>, or a recursive <code>setTimeout</code>.' },
    { trap: 'Process won’t exit: a forgotten handle', code: `const t = setInterval(flushMetrics, 10_000);\n// script "finishes" but node never exits`, why: 'Active timers, sockets and servers are <b>ref’d handles</b>. The loop keeps running while any exist.', fix: 'Call <code>t.unref()</code> for background timers, close servers and pools on shutdown, and look at <code>process.getActiveResourcesInfo()</code> (Node 17+) to find what keeps the loop alive.' },
    { trap: 'Expecting nextTick to behave like setImmediate', why: 'The names are the wrong way round (the Node docs say so). <code>process.nextTick</code> runs <b>before</b> the loop continues, even before promise jobs. <code>setImmediate</code> runs in the check phase, after I/O.', fix: 'Use <code>setImmediate</code> (or <code>await setImmediate()</code> from <code>node:timers/promises</code>) to yield to I/O. Use <code>queueMicrotask</code>/nextTick only for “right after this function, before anything else”.' },
    { trap: 'Assuming close events always come from the close phase', why: 'Only abrupt closes (<code>socket.destroy()</code>, a handle closed with <code>uv_close</code>) emit <code>\'close\'</code> in the close callbacks phase. Other cases emit through <code>process.nextTick</code>.', fix: 'Don’t depend on the exact phase. Wait for the event (or <code>events.once(socket, \'close\')</code>) instead.' }
  ],
  scenarios: [
    { title: 'Health checks time out although the service is “idle”',
      symptom: 'Every 30 s, <code>/healthz</code> takes 2–3 s and Kubernetes marks the pod unready for a moment. CPU averages 15%.',
      diagnose: `import { monitorEventLoopDelay } from 'node:perf_hooks';\nconst h = monitorEventLoopDelay(); h.enable();\nsetInterval(() => { console.log('max ms', h.max / 1e6); h.reset(); }, 1000).unref();\n// spikes line up with the cache-refresh timer`,
      cause: 'A <code>setInterval</code> rebuilds an in-memory cache from 400k rows with a synchronous loop. While that callback runs, the loop can’t reach the poll phase, so the health-check request sits in the kernel buffer.',
      fix: 'Split the work into chunks and yield between them with <code>setImmediate</code>, so poll gets a turn each lap. Or build the cache in a Worker and swap it in.',
      fixCode: `import { setImmediate as yieldToLoop } from 'node:timers/promises';\n\nasync function rebuild(rows: Row[]) {\n  const next = new Map<string, Row>();\n  for (let i = 0; i < rows.length; i++) {\n    next.set(rows[i].id, rows[i]);\n    if (i % 5_000 === 0) await yieldToLoop();   // let poll/check run\n  }\n  cache = next;\n}`, lang: 'ts' },
    { title: 'Flaky test: “expected immediate before timeout”',
      symptom: 'A unit test that checks callback order passes locally and fails about 1 time in 20 on CI.',
      diagnose: `// the test, at module top level\nsetTimeout(() => seen.push('t'), 0);\nsetImmediate(() => seen.push('i'));`,
      cause: 'The main-module race. On a busy CI runner the loop often starts more than 1 ms after the timer was set, so the timer is due on the first lap.',
      fix: 'Test the behaviour you need, not the timer race. If the code really needs “after I/O”, schedule inside an I/O callback. In tests, use fake timers (<code>node:test</code> <code>mock.timers</code>) to control time.',
      fixCode: `import { test, mock } from 'node:test';\ntest('debounce fires once', () => {\n  mock.timers.enable({ apis: ['setTimeout'] });\n  const fn = mock.fn();\n  const d = debounce(fn, 100);\n  d(); d(); d();\n  mock.timers.tick(100);\n  assert.equal(fn.mock.callCount(), 1);\n});`, lang: 'ts' },
    { title: 'A batch job never exits after finishing',
      symptom: 'A nightly Node script logs “done” but the container runs until the 1-hour timeout kills it.',
      diagnose: `console.log(process.getActiveResourcesInfo());\n// [ 'TCPSocketWrap', 'TCPSocketWrap', 'Timeout' ]`,
      cause: 'The Postgres pool keeps idle connections open, and a metrics library has an interval timer. Both are ref’d handles, so the loop never runs out of work.',
      fix: 'Close what you opened (<code>await pool.end()</code>), <code>unref()</code> background timers, and exit explicitly only as a last resort.',
      fixCode: `try {\n  await runJob();\n} finally {\n  await pool.end();          // closes sockets\n  metricsTimer.unref();      // or clearInterval\n}` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Timers and immediates scheduled from inside an I/O callback. What prints?', code: `const fs = require('fs');\nfs.readFile(__filename, () => {\n  setTimeout(() => console.log('timeout'), 0);\n  setImmediate(() => console.log('immediate'));\n  process.nextTick(() => console.log('nextTick'));\n});`, options: ['timeout, immediate, nextTick', 'nextTick, immediate, timeout', 'nextTick, timeout, immediate', 'Order varies between runs'], answer: 1, explain: 'The readFile callback runs in <b>poll</b>. When it returns, the nextTick queue drains. The next phase is <b>check</b>, so the immediate runs. The timer has to wait for the <b>timers</b> phase of the next lap. Inside I/O callbacks this order is guaranteed.', run: true, expect: 'nextTick\nimmediate\ntimeout' },
    { kind: 'concept', q: 'In the <b>main module</b>, with nothing else running, what does this print?', code: `setTimeout(() => console.log('timeout'), 0);\nsetImmediate(() => console.log('immediate'));`, options: ['Always timeout, then immediate', 'Always immediate, then timeout', 'Either order; it depends on process timing', 'Only immediate'], answer: 2, explain: '<code>setTimeout(…, 0)</code> means 1 ms. If the first lap’s timers phase starts before 1 ms has passed, the timer isn’t due, and check runs first. Otherwise timers runs first. Both happen in practice.' },
    { kind: 'predict', q: 'An immediate scheduled from inside an immediate. What prints?', code: `setImmediate(() => {\n  console.log('A');\n  setImmediate(() => console.log('C'));\n});\nsetImmediate(() => console.log('B'));`, options: ['A, C, B', 'A, B, C', 'B, A, C', 'A, B (C never runs)'], answer: 1, explain: 'The check phase runs only the immediates that were queued when it started (A and B). C, added during the phase, runs in the next lap’s check phase. This is why a recursive <code>setImmediate</code> lets I/O in, while a recursive <code>nextTick</code> doesn’t.', run: true, expect: 'A\nB\nC' },
    { kind: 'predict', q: 'Node 22. What prints?', code: `setImmediate(() => {\n  console.log('imm1');\n  process.nextTick(() => console.log('tick in imm1'));\n  Promise.resolve().then(() => console.log('promise in imm1'));\n});\nsetImmediate(() => console.log('imm2'));`, options: ['imm1, imm2, tick in imm1, promise in imm1', 'imm1, tick in imm1, promise in imm1, imm2', 'imm1, promise in imm1, tick in imm1, imm2', 'imm1, tick in imm1, imm2, promise in imm1'], answer: 1, explain: 'Since Node 11, the nextTick queue and then the microtask queue are drained after <b>each</b> immediate (and each timer), not only when the phase ends. Node 10 and earlier printed option A.', run: true, expect: 'imm1\ntick in imm1\npromise in imm1\nimm2' },
    { kind: 'predict', q: 'Scheduling from inside a timer callback. What prints?', code: `setTimeout(() => {\n  console.log('timeout');\n  setImmediate(() => console.log('immediate'));\n  setTimeout(() => console.log('timeout 2'), 0);\n}, 0);`, options: ['timeout, timeout 2, immediate', 'timeout, immediate, timeout 2', 'Either order after “timeout”', 'immediate, timeout, timeout 2'], answer: 1, explain: 'We are in the timers phase. The new 1 ms timer isn’t due during this phase. The loop goes on through poll (it doesn’t wait, because an immediate is pending) to <b>check</b>, which runs the immediate. timeout 2 runs on the next lap.', run: true, expect: 'timeout\nimmediate\ntimeout 2' },
    { kind: 'concept', q: 'A timer is set for 100 ms. At 95 ms a file read completes, and its callback runs synchronous code for 10 ms. When does the timer callback start?', options: ['At 100 ms, interrupting the file callback', 'At about 105 ms', 'At 95 ms', 'At about 200 ms'], answer: 1, explain: 'This is the Node docs’ own example. The loop was waiting in poll; the read completed at 95 ms, so poll ran its callback. Callbacks are never interrupted, so the timers phase can only start at about 105 ms. The delay is a lower bound.' },
    { kind: 'concept', q: 'You call <code>socket.destroy()</code>. In which phase is the socket’s <code>\'close\'</code> event emitted?', options: ['timers', 'poll', 'check', 'close callbacks'], answer: 3, explain: 'An abrupt close calls <code>uv_close()</code> on the handle, and libuv runs close callbacks in the last phase of the lap. A graceful end emits <code>\'close\'</code> via <code>process.nextTick</code> instead, according to the Node docs.' }
  ],
  interview: [
    { q: 'Walk me through the phases of the Node.js event loop.', a: '<ol><li><b>timers</b>: callbacks of expired <code>setTimeout</code>/<code>setInterval</code>.</li><li><b>pending callbacks</b>: some system callbacks deferred from the last lap (for example certain TCP errors).</li><li><b>idle, prepare</b>: internal.</li><li><b>poll</b>: get new I/O events and run their callbacks; if nothing else is scheduled, <i>block here</i> until I/O arrives or the nearest timer is due.</li><li><b>check</b>: <code>setImmediate</code> callbacks.</li><li><b>close callbacks</b>: for example <code>\'close\'</code> after <code>socket.destroy()</code>.</li></ol><p>After each callback, Node drains <code>process.nextTick</code> and then promise microtasks.</p>', lvl: 'core' },
    { q: 'setTimeout(fn, 0) vs setImmediate(fn): which runs first?', a: '<p>From the <b>main module</b>: not deterministic. It depends on whether 1 ms has passed when the first lap reaches the timers phase. From inside an <b>I/O callback</b>: <code>setImmediate</code> always, because check follows poll directly, while the timer waits for the next lap. Also, <code>setImmediate</code> is cheaper: there is no timer to manage.</p>', fu: 'And from inside a timer callback? (Immediate first: check comes before the next timers phase.)', lvl: 'core' },
    { q: 'What does the poll phase do, and how long does it wait?', a: '<p>It runs callbacks for completed I/O (socket data, finished fs requests from the pool). If the poll queue is empty: if immediates are pending, it moves on to check at once; otherwise it blocks waiting for I/O, but only until the nearest timer is due. When nothing at all is pending (no timers, no handles, no requests), the loop exits.</p>', lvl: 'deep' },
    { q: 'What changed in Node 11 regarding timers and microtasks?', a: '<p>Before Node 11, all expired timers (or all immediates) in a phase ran back-to-back, and microtasks ran only between phases. From Node 11, nextTicks and microtasks are drained after <b>each</b> <code>setTimeout</code>/<code>setImmediate</code> callback. This matches browser behaviour and makes code more predictable.</p>', lvl: 'deep' },
    { q: 'Why is process.nextTick not part of the event loop phases?', a: '<p>It isn’t libuv work. Node keeps its own nextTick queue and drains it whenever a JavaScript callback finishes, before returning to libuv: between any two callbacks, in any phase. That is why it runs before promises, timers and I/O, and why recursive nextTicks can starve the loop.</p>', lvl: 'core' },
    { q: 'How accurate are Node timers?', a: '<p>A timer runs <b>no earlier</b> than its delay, on the first timers phase after it expires, once the main thread is free. Delays below 1 ms or above 2147483647 ms become 1 ms. Under load, or behind a long callback, timers run late. <code>setInterval</code> doesn’t correct drift and doesn’t wait for async work in the callback.</p>', lvl: 'core' },
    { q: 'What keeps a Node process alive, and how do you stop that?', a: '<p>Ref’d handles and requests: active timers, listening servers, open sockets, child processes, pending fs requests. <code>timer.unref()</code> and <code>server.unref()</code> tell the loop not to wait for them. <code>process.getActiveResourcesInfo()</code> lists what is still active. For a clean exit, close resources explicitly rather than calling <code>process.exit()</code>, which can drop buffered output.</p>', lvl: 'core' },
    { q: 'How does the Node event loop differ from the browser’s?', a: '<p>The browser runs one task from a task queue, drains microtasks, then may render. Node has phase-specific queues (timers, I/O, immediates, close) plus <code>process.nextTick</code>, which browsers don’t have. Since Node 11 the microtask timing between callbacks matches. Browsers clamp nested timers more aggressively (4 ms after 5 levels of nesting).</p>', lvl: 'deep' },
    { q: 'Compare it with a Netty or Vert.x event loop in Java.', a: '<p>Same idea: one thread runs a selector (epoll) and the handlers of its channels, and you must never block it. Differences: Netty usually runs <b>one event loop per core</b> (an <code>EventLoopGroup</code>), so a Java service uses all cores in one process, while Node runs one loop per process (or per worker thread). Netty’s <code>eventLoop.execute(task)</code> is roughly <code>setImmediate</code>.</p>', lvl: 'core' },
    { q: 'You have a 2-second CPU job in a web server. How do you keep the server responsive?', a: '<p>Options, best first: run it in a <b>Worker</b> thread or another service; or split it into chunks and <code>await setImmediate()</code> (from <code>node:timers/promises</code>) between chunks, so poll gets a turn each lap. Don’t yield with <code>process.nextTick</code> or <code>Promise.resolve()</code>: both run before I/O, so they don’t give the loop a chance to read sockets. See <a href="blocking-event-loop.html">Blocking the event loop</a>.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Yield to I/O in a long loop', lang: 'ts', code: `import { setImmediate as nextLap } from 'node:timers/promises';

export async function processAll<T>(items: T[], work: (t: T) => void, chunk = 1_000) {
  for (let i = 0; i < items.length; i++) {
    work(items[i]);
    if ((i + 1) % chunk === 0) await nextLap();   // check phase → next lap's poll runs
  }
}
// NOT a fix: await Promise.resolve() / process.nextTick → runs before any I/O`, note: 'Each <code>await nextLap()</code> lets the poll phase read pending sockets before the next chunk.' },
    { title: 'Timers that don’t overlap or hold the process', lang: 'ts', code: `import { setInterval as every } from 'node:timers/promises';

const ac = new AbortController();
(async () => {
  // the next tick starts only after the loop body finishes: no overlap
  for await (const _ of every(5_000, undefined, { signal: ac.signal, ref: false })) {
    await syncWithPartner();
  }
})().catch((e) => { if (e.name !== 'AbortError') throw e; });

process.once('SIGTERM', () => ac.abort());`, note: '<code>ref: false</code> works like <code>unref()</code>: this timer alone won’t keep the process alive.' },
    { title: 'Java comparison: Netty event loop', lang: 'java', code: `EventLoopGroup group = new NioEventLoopGroup();   // default: 2 × cores threads
Channel ch = bootstrap.group(group).connect(host, port).sync().channel();

// run on the channel's event-loop thread, after current work ≈ setImmediate
ch.eventLoop().execute(() -> ch.writeAndFlush(msg));

// timer on the same loop ≈ setTimeout
ch.eventLoop().schedule(this::sendHeartbeat, 1, TimeUnit.SECONDS);

// Same rule as Node: never block an event-loop thread.
// Offload blocking work: ctx.executor() vs a separate EventExecutorGroup.`, note: 'Netty spreads channels across several loops (one thread each). Node has one loop per process or worker.' }
  ]
});

IA.register({
  track: 'nodejs',
  slug: 'tricky-node',
  title: '★ Tricky Node (timed)',
  tagline: 'Forty-eight “what does this print / what happens next” questions from every Node.js topic, against the clock. Most are small, complete programs whose output surprises people who write Node every day; the rest are the production traps interviewers love.',
  tldr: {
    problem: 'Senior Node interviews rarely ask you to write a server. They show you ten lines with a <code>setTimeout</code>, a promise and a <code>nextTick</code> and ask for the output, or describe a production symptom and ask for the cause.',
    model: 'Almost every trick is one of five things: <b>queue order</b> (sync → nextTick → microtasks → event-loop phases), <b>one thread</b> (CPU work blocks everything), <b>where an error goes</b> (try/catch scope, promise handlers, <code>\'error\'</code> events), <b>caching and identity</b> (require cache, structured clone, prototypes), and <b>who closes what</b> (sockets, signals, servers).',
    hook: '<code>Promise.resolve().then(() =&gt; process.nextTick(log))</code> runs <i>after</i> the next <code>.then</code> in the chain. If you can explain why in one sentence, start the drill.',
    facts: [
      { v: '48', l: 'questions covering all 20 topic pages of the Node.js track, grouped by module: Runtime, Async, Performance, Web, Production' },
      { v: '60 s', l: 'per question by default. Slow (90 s) and Fast (30 s) modes too' },
      { v: '30', l: 'of them are complete CommonJS programs with an exact expected output, meant to be checked on Node 22' }
    ]
  },
  intro: {
    what: 'This page is a <b>drill</b>, not a lesson. You get a short program or a production situation, a timer, and four answers. Answer in your head, as you would in an interview, then read the explanation. At the end you get your score per topic and a review of every miss, each with a link to the topic page that explains it.',
    analogy: { icon: '⏱️', title: 'Chess puzzles for Node', text: 'Chess players improve by solving positions quickly, not by reading about openings. Each question here is a “position”: a few lines where the obvious answer is wrong for a specific reason.' },
    steps: [
      { t: 'Run the synchronous code first', d: 'Everything at the top level runs to completion before any callback. Write down the sync output first.' },
      { t: 'Then drain the queues', d: 'After each macrotask: all <code>process.nextTick</code> callbacks, then all promise/<code>queueMicrotask</code> jobs, repeated until both are empty.', code: 'sync → nextTick queue → microtask queue → (next phase / next callback)', lang: 'text' },
      { t: 'Then walk the loop phases', d: 'timers → pending → poll (I/O callbacks) → check (<code>setImmediate</code>) → close. From inside an I/O callback, check comes before timers.' },
      { t: 'For production questions, follow the resource', d: 'Which thread runs it? Who holds the socket? Who receives the signal? Where does the error land?' }
    ],
    terms: [
      ['macrotask', 'A callback the event loop runs: a timer, an I/O completion, an immediate.'],
      ['microtask', 'A promise reaction or <code>queueMicrotask</code> job; runs right after the current callback.'],
      ['nextTick queue', 'Node’s own queue, drained before the microtask queue.'],
      ['structured clone', 'How <code>postMessage</code> copies data between threads.'],
      ['PID 1', 'The first process in a container, with special signal rules.']
    ]
  },
  visual: {
    title: 'The drill',
    caption: 'Pick a module (or All), how many questions, and the time per question, then press Start. Skip counts as a miss. At the end: a per-topic score (each links to its page) and your misses with explanations.'
  },
  gotchas: [
    { trap: 'Answering from the browser’s rules', why: 'Browsers have no <code>process.nextTick</code>, no <code>setImmediate</code> and no poll/check phases, and their timer clamping differs. Many “event loop” articles describe the browser.', fix: 'Say “in Node 22” and reason with Node’s queues and libuv phases; mention the browser difference if you know it.' },
    { trap: 'Treating timing-dependent output as deterministic', why: '<code>setTimeout(fn, 0)</code> vs <code>setImmediate</code> in the main module, two network responses, two workers finishing: the order can vary between runs.', fix: 'Saying “this is not deterministic, because…” is often the correct answer. Interviewers ask it on purpose.' },
    { trap: 'Forgetting the Node version', why: 'Several answers changed over time: microtasks between timers (Node 11), unhandled rejections crash (Node 15), keep-alive global agent (Node 19), <code>require(esm)</code> (22.12), type stripping (22.6/22.18).', fix: 'Anchor every answer to a version: “since Node 15, …”.' }
  ],
  interview: [
    { q: 'How do you approach a “what does this print?” question in Node?', a: '<p>Out loud: first all synchronous logs in order; then the nextTick queue; then microtasks (promise reactions, awaits) until empty, re-checking nextTick after; then the event loop: due timers, I/O callbacks in poll, immediates in check. After <b>every</b> callback, drain nextTick + microtasks again (Node 11+). Point out anything that’s timing-dependent. See <a href="event-loop-phases.html">Event-loop phases</a> and <a href="microtasks-macrotasks.html">Microtasks vs macrotasks</a>.</p>', lvl: 'core' },
    { q: 'Which three trick categories cause the most production incidents?', a: '<p>1) Unhandled async errors: floating promises crashing the process, errors in callbacks escaping try/catch, missing <code>\'error\'</code> listeners. 2) Blocking the event loop: sync APIs, big JSON, catastrophic regexes. 3) Lifecycle mismatches: keep-alive timeouts vs load balancers, SIGTERM not reaching Node as PID 1, servers and pools never closed.</p>', lvl: 'core' },
    { q: 'You don’t know the answer. What do you say?', a: '<p>Narrow it down: “It’s either A or B, depending on whether nextTick runs before the remaining microtasks. I believe V8 drains the whole microtask queue first, so B. I’d check with a three-line script.” Showing how you would verify in a minute (<code>node -e</code>, a REPL) is a strong senior answer.</p>', lvl: 'core' },
    { q: 'How do you check a tricky claim quickly during a real code review?', a: '<p>A self-contained script with <code>node -e</code> or a scratch file: log markers, run it a few times to catch non-determinism, and try the relevant Node version with <code>npx node@20</code> or a version manager. For HTTP and timeout behaviour, a <code>node:http</code> server on port 0 in the same script. For leaks and blocking, <code>--cpu-prof</code>, <code>--heap-prof</code> or <code>monitorEventLoopDelay</code>.</p>', lvl: 'core' },
    { q: 'Which Node behaviours would you expect a Java developer to get wrong first?', a: '<ul><li>Assuming <code>async</code> means parallel: CPU work inside async functions still runs on one thread.</li><li>Expecting try/catch to cover callbacks, as it does for synchronous Java code.</li><li>Expecting an unhandled error to kill one request (like one thread) rather than the whole process.</li><li>Expecting modules to be re-instantiated per import: they are cached singletons.</li><li>Expecting types to exist at runtime (TypeScript erases them).</li></ul><p>See <a href="node-vs-java.html">Node vs Java</a>.</p>', lvl: 'deep' }
  ]
});

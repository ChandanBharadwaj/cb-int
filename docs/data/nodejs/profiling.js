IA.register({
  track: 'nodejs',
  slug: 'profiling',
  title: 'Profiling Node',
  tagline: 'Don’t guess where the time goes: <b>sample it</b>. A CPU profiler records the call stack about every millisecond; a <b>flame graph</b> merges those stacks so the widest boxes are where the CPU went. <code>--cpu-prof</code>, the inspector, clinic.js and <code>diagnostics_channel</code> each answer a different question.',
  tldr: {
    problem: 'A service got slower after a release, CPU is at 90%, and the team is “optimizing” code that turns out to use 2% of the time. Or latency is high while CPU is low, and the CPU profile shows nothing useful.',
    model: 'A sampling profiler interrupts the main thread at a fixed interval (default 1 ms for <code>--cpu-prof</code>) and records the stack. Many samples give a statistical picture. In a flame graph, <b>width = share of samples</b> containing that frame, <b>height = stack depth</b>, and the left-to-right order means nothing. Look for wide frames with little on top: that is <b>self time</b>. Waiting on I/O doesn’t burn CPU, so it shows up as <code>(idle)</code>, not as your slow query.',
    hook: '“How would you find why a Node service uses 100% CPU?” Take a CPU profile under realistic load (<code>--cpu-prof</code>, or attach the inspector to a live process), open it as a flame graph, find the widest self-time frames, fix one thing, and measure again.',
    facts: [
      { v: '9229', l: 'default inspector port. <code>--inspect</code> binds to 127.0.0.1; binding it to 0.0.0.0 lets anyone who can reach it run code in your process' },
      { v: '1000 µs', l: 'default sampling interval of <code>--cpu-prof</code> (change with <code>--cpu-prof-interval</code>). The <code>.cpuprofile</code> is written when the process exits' },
      { v: 'Node 19.2', l: '<code>diagnostics_channel</code> became stable (also 18.13). Core modules and undici publish events on it' }
    ]
  },
  intro: {
    what: 'A profiler tells you where your program spends its time. Node’s built-in one is the V8 CPU profiler: many times a second it notes which function is running and who called it. Afterwards a tool adds up those notes and draws a <b>flame graph</b>, a picture in which the functions that ran most are the widest. You fix the widest thing first, because that’s where the time is.',
    analogy: { icon: '📸', title: 'A photographer at a busy kitchen', text: 'Every second, a photographer snaps the kitchen and writes down what each cook is doing and for which dish. Nobody times anything. After an hour, the photos show that 40% of the time someone was chopping onions for the soup. A flame graph is that tally, stacked by “dish → step → task”. If the cooks spent time waiting for a delivery, the photos show them idle, not the delivery.' },
    steps: [
      { t: 'Reproduce the load', d: 'Profile under traffic that looks like production (autocannon, k6). An idle profile shows nothing.', code: 'npx autocannon -c 50 -d 30 http://localhost:3000/search?q=shoes', lang: 'bash' },
      { t: 'Record a CPU profile', d: '<code>--cpu-prof</code> writes a <code>.cpuprofile</code> file when the process exits. Open it in Chrome DevTools (Performance panel) or speedscope.', code: 'node --cpu-prof --cpu-prof-dir=./prof server.js\n# run the load, then stop the server with Ctrl-C', lang: 'bash' },
      { t: 'Or attach to a running process', d: 'Start with <code>--inspect</code>, or send <code>SIGUSR1</code> to a running Node process to open the inspector, then use chrome://inspect → Profiler.', code: 'kill -USR1 <pid>          # inspector on 127.0.0.1:9229\nssh -L 9229:127.0.0.1:9229 host   # tunnel, never expose it', lang: 'bash' },
      { t: 'Read the flame graph', d: 'Find wide frames. A wide frame with nothing above it is self time: that function’s own code is hot.' },
      { t: 'Change one thing, measure again', d: 'Compare before/after profiles and latency numbers, not impressions.' }
    ],
    terms: [
      ['sample', 'One snapshot of the call stack, taken at a fixed interval.'],
      ['flame graph', 'Merged stacks: width = how many samples include a frame; y = stack depth; x order is arbitrary.'],
      ['self time', 'Samples where the function itself was at the top of the stack.'],
      ['total time', 'Samples where the function was anywhere on the stack (itself plus callees).'],
      ['inspector', 'The Chrome DevTools protocol endpoint built into Node (<code>--inspect</code>).'],
      ['diagnostics_channel', 'A built-in pub/sub API that libraries use to publish events for tracing and APM tools.']
    ]
  },
  visual: {
    title: 'From stack samples to a flame graph',
    caption: 'Press Play or Step. The top chart records one stack per millisecond in time order (a stack chart). Then the samples are merged into a flame graph, where width = number of samples. Switch to <b>After fix</b> to see the profile once the hot function is cached.'
  },
  gotchas: [
    { trap: 'Exposing the inspector', code: `node --inspect=0.0.0.0:9229 server.js   # in a container with a published port`, why: 'The inspector protocol can evaluate arbitrary code in the process. Anyone who can reach the port owns the process and its credentials.', fix: 'Keep the default 127.0.0.1 binding and use an SSH tunnel or <code>kubectl port-forward</code>. Never enable it by default in production images.' },
    { trap: 'Expecting the CPU profile to show slow I/O', why: 'A CPU profiler samples what the thread is <i>executing</i>. While you await a slow query, the thread is idle (or serving other requests), so the query appears as <code>(idle)</code> or not at all.', fix: 'For latency with low CPU, use tracing: OpenTelemetry spans, APM, or clinic Bubbleprof. Use CPU profiles when CPU or event-loop delay is high.' },
    { trap: 'Reading the flame graph’s x-axis as time', why: 'In a flame graph, frames are merged and sorted (often alphabetically). Two boxes side by side didn’t necessarily run one after the other.', fix: 'Use the time-ordered <b>stack chart</b> (Chrome’s Performance panel “Main” track) when order matters, and the flame graph to see totals.' },
    { trap: 'Profiling a toy load or a cold process', why: 'With little traffic, start-up, module loading and JIT compilation dominate the profile. Short functions may get no samples at all.', fix: 'Warm the process up, then profile 30–60 s of realistic load. Increase samples (longer runs) rather than lowering <code>--cpu-prof-interval</code> a lot, which adds overhead.' },
    { trap: 'Losing the profile because the process was killed', why: '<code>--cpu-prof</code> writes its file when Node exits normally. A <code>SIGKILL</code> (or an OOM kill) gives nothing.', fix: 'Stop the process with <code>SIGINT</code>/<code>SIGTERM</code> and let it exit, or take the profile through the inspector (or the <code>inspector</code> module’s <code>Profiler.start</code>/<code>stop</code>) on demand.' },
    { trap: 'Ignoring (garbage collector) and (program)', why: 'A wide <code>(garbage collector)</code> frame means allocation churn or a heap near its limit; it is CPU your code caused indirectly. <code>(program)</code> is native work outside JS, such as compilation or C++ bindings.', fix: 'For a wide GC frame, look at allocation (heap profiles, <code>--trace-gc</code>; see <a href="v8-gc-leaks.html">V8 memory &amp; leaks</a>) rather than at the JS frames.' }
  ],
  scenarios: [
    { title: 'CPU doubled after a release',
      symptom: 'After a release, CPU per request doubles and p99 rises from 80 ms to 300 ms. Nothing obvious changed in the hot endpoint.',
      diagnose: `node --cpu-prof --cpu-prof-dir=/tmp/prof server.js\nnpx autocannon -c 50 -d 60 http://localhost:3000/products\n# stop with Ctrl-C, open /tmp/prof/*.cpuprofile in DevTools or speedscope\n# flame graph: 38% in escapeHtml ← renderAttributes ← render (template engine)`,
      cause: 'A template-engine upgrade disabled template caching unless <code>NODE_ENV=production</code>, which the new Dockerfile no longer set. Every request recompiled templates and escaped the same static strings.',
      fix: 'Set <code>NODE_ENV=production</code> in the image, add a start-up check that the template cache is enabled, and keep a profile of the release candidate under load as part of performance testing.',
      fixCode: `# Dockerfile\nENV NODE_ENV=production\n\n// app start-up\nif (!app.enabled('view cache')) {\n  log.warn('view cache disabled: templates will be recompiled on every request');\n}`, lang: 'docker' },
    { title: 'High latency, low CPU, and an empty profile',
      symptom: 'p95 latency of <code>/checkout</code> is 2 s, CPU is 15%, and the CPU profile is 80% <code>(idle)</code>.',
      diagnose: `// subscribe to undici's request events via diagnostics_channel\nconst dc = require('node:diagnostics_channel');\ndc.subscribe('undici:request:create', ({ request }) => { request.__t = performance.now(); });\ndc.subscribe('undici:request:headers', ({ request, response }) => {\n  log.info({ origin: request.origin, path: request.path, status: response.statusCode,\n             ms: performance.now() - request.__t });\n});\n// fraud-check API: 1.8 s per call`,
      cause: 'The time was spent <b>waiting</b> on a third-party fraud API, called sequentially for each line item. No CPU was used, so the CPU profile could not show it.',
      fix: 'Batch the fraud check into one call with a timeout, and add OpenTelemetry tracing (whose Node instrumentations use diagnostics_channel where available) so waits show up as spans.',
      fixCode: `const res = await fetch(FRAUD_URL, {\n  method: 'POST',\n  body: JSON.stringify({ items: cart.items }),      // one call instead of N\n  signal: AbortSignal.timeout(800),\n});`, lang: 'ts' },
    { title: 'Intermittent stalls nobody can reproduce locally',
      symptom: 'Every few hours one pod shows event-loop delay spikes of 2–3 s for a minute. Locally, everything is fast.',
      diagnose: `# on the affected pod (port-forward only)\nkubectl port-forward pod/api-6f… 9229:9229\nkubectl exec api-6f… -- kill -USR1 1\n# chrome://inspect → Profiler → record 30 s during a spike\n# flame graph: wide RegExp frame under parseUserAgent`,
      cause: 'A user-agent parser with a backtracking-heavy regex hit pathological strings sent by one crawler.',
      fix: 'Cap the header length before parsing, cache parsed results per distinct UA string, and add an event-loop delay alert that captures a profile automatically.',
      fixCode: `const uaCache = new LRUCache<string, UA>({ max: 5_000 });\nexport function ua(header = '') {\n  const h = header.slice(0, 512);                 // bound the input\n  let v = uaCache.get(h);\n  if (!v) { v = parseUserAgent(h); uaCache.set(h, v); }\n  return v;\n}`, lang: 'ts' }
  ],
  puzzles: [
    { kind: 'predict', q: '<code>diagnostics_channel</code> basics. What prints?', code: `const dc = require('diagnostics_channel');\nconst ch = dc.channel('app:query');\nconsole.log(ch.hasSubscribers);\nfunction onMsg(msg, name) { console.log(name, msg.sql); }\ndc.subscribe('app:query', onMsg);\nconsole.log(ch.hasSubscribers);\nconsole.log('before');\nch.publish({ sql: 'SELECT 1' });\nconsole.log('after');\ndc.unsubscribe('app:query', onMsg);\nch.publish({ sql: 'SELECT 2' });\nconsole.log(ch.hasSubscribers);`, options: ['false, true, before, after, app:query SELECT 1, false', 'false, true, before, app:query SELECT 1, after, false', 'true, true, before, app:query SELECT 1, after, app:query SELECT 2, true', 'false, true, before, app:query SELECT 1, app:query SELECT 2, after, false'], answer: 1, explain: '<code>publish</code> calls subscribers <b>synchronously</b> with <code>(message, channelName)</code>. <code>hasSubscribers</code> lets a library skip building the message when nobody listens, which keeps instrumentation nearly free when it is off. After <code>unsubscribe</code>, publishing does nothing.', run: true, expect: 'false\ntrue\nbefore\napp:query SELECT 1\nafter\nfalse' },
    { kind: 'predict', q: 'A <code>TracingChannel</code> around a function that throws. What prints?', code: `const dc = require('diagnostics_channel');\nconst tc = dc.tracingChannel('app:job');\ntc.subscribe({\n  start(m) { console.log('start', m.id); },\n  end(m) { console.log('end', m.id); },\n  asyncStart() {},\n  asyncEnd() {},\n  error(m) { console.log('error', m.error.message); }\n});\ntc.traceSync(() => console.log('work'), { id: 1 });\ntry {\n  tc.traceSync(() => { throw new Error('bad'); }, { id: 2 });\n} catch (e) {\n  console.log('caught', e.message);\n}`, options: ['start 1, work, end 1, start 2, end 2, error bad, caught bad', 'start 1, work, end 1, start 2, error bad, end 2, caught bad', 'work, start 1, end 1, start 2, error bad, caught bad', 'start 1, work, end 1, start 2, error bad, end 2 (the error is swallowed)'], answer: 1, explain: '<code>traceSync</code> publishes <code>start</code>, runs the function, publishes <code>error</code> (with <code>context.error</code> set) if it throws, always publishes <code>end</code>, then rethrows. The same context object flows through every event, which is how tracers pair start and end. (TracingChannel is still marked experimental in Node 22.)', run: true, expect: 'start 1\nwork\nend 1\nstart 2\nerror bad\nend 2\ncaught bad' },
    { kind: 'concept', q: 'In a flame graph, <code>handleRequest</code> spans 60% of the width, and directly on top of it sit <code>render</code> (35%) and <code>query</code> (20%). How much <b>self time</b> does <code>handleRequest</code> have?', options: ['60%', '5%', '35%', 'It can’t be known from a flame graph'], answer: 1, explain: 'Self time is the part of a frame’s width with nothing above it: 60 − 35 − 20 = 5%. The handler itself is cheap; its callees are where the time goes. Wide frames with thin children are the ones to optimize.' },
    { kind: 'concept', q: 'p95 latency is 2 s but CPU is 10%, and the CPU profile is mostly <code>(idle)</code>. What next?', options: ['Lower --cpu-prof-interval to catch the slow code', 'Use tracing (APM / OpenTelemetry spans, or clinic Bubbleprof) to see what requests are waiting for', 'Add more worker threads', 'Increase the heap size'], answer: 1, explain: 'Low CPU with high latency means requests are waiting: on the database, another service, a lock, a pool, the libuv thread pool. A CPU profiler only sees what the thread executes. Tracing shows the waits.' },
    { kind: 'concept', q: 'Why is <code>node --inspect=0.0.0.0:9229</code> in a production container dangerous?', options: ['It makes the process single-threaded', 'Anyone who can reach the port can attach a debugger and run arbitrary code in the process', 'It disables the JIT', 'It writes every request to disk'], answer: 1, explain: 'The inspector protocol includes <code>Runtime.evaluate</code>. It has no authentication. Keep it bound to localhost and reach it through a tunnel or port-forward, only while debugging.' },
    { kind: 'concept', q: 'clinic.js offers Doctor, Flame, Bubbleprof and HeapProfiler. A service has high event-loop delay and you don’t know why yet. Which first?', options: ['HeapProfiler', 'Doctor, which samples CPU, memory, event-loop delay and handles and suggests where to look', 'Bubbleprof', 'None: use console.time'], answer: 1, explain: 'Doctor gives a first diagnosis (event-loop blocking, I/O, GC pressure) and recommends Flame, Bubbleprof or HeapProfiler for the next step. Flame then shows which functions block. (Check that clinic supports your Node version before relying on it.)' },
    { kind: 'concept', q: 'A CPU profile has a wide <code>(garbage collector)</code> frame, about 30% of samples. What does it suggest?', options: ['The profiler is broken', 'Allocation churn or a heap close to its limit: look at what allocates, not at the JS frames under it', 'Too many worker threads', 'Slow disks'], answer: 1, explain: 'GC time is CPU caused by allocations. Reduce allocation in hot paths (big intermediate arrays, repeated JSON, string concatenation in loops), or look for a leak filling the heap. A sampling heap profile shows who allocates.' }
  ],
  interview: [
    { q: 'How do you profile CPU in Node?', a: '<ul><li><code>node --cpu-prof</code>: writes a <code>.cpuprofile</code> on exit; open it in DevTools or speedscope.</li><li>The inspector: <code>--inspect</code> (or <code>SIGUSR1</code> on a running process), then chrome://inspect → Profiler, start/stop on demand.</li><li>The <code>inspector</code> module (<code>node:inspector/promises</code>) to start and stop profiling from code, for example from an admin endpoint.</li><li><code>--prof</code> + <code>node --prof-process</code>: V8’s tick profiler, text output.</li><li>Linux <code>perf</code> with <code>--perf-basic-prof</code> for system-wide profiles that include native frames.</li></ul>', lvl: 'core' },
    { q: 'How do you read a flame graph?', a: '<p>Each box is a stack frame; its children sit on top of it. <b>Width</b> = share of samples that include the frame (total time). The x order is arbitrary (merged and sorted). Look for <b>plateaus</b>: wide boxes with little above them, which have a lot of self time. Then follow the stack down to see which of your code paths leads there. A stack chart is the time-ordered version of the same data.</p>', lvl: 'core' },
    { q: 'What is sampling, and what are its limits?', a: '<p>The profiler interrupts the thread every interval (1 ms by default) and records the stack. Overhead is low and roughly constant. Limits: it is statistical (short or rare functions may get no samples), it only sees the thread it samples (Workers have their own profiles), it doesn’t see waiting, and inlined functions may be attributed to their callers.</p>', lvl: 'deep' },
    { q: 'What is clinic.js?', a: '<p>A suite of tools for Node performance: <b>Doctor</b> (overview of CPU, memory, event-loop delay and active handles, with a recommendation), <b>Flame</b> (flame graphs, built on 0x), <b>Bubbleprof</b> (visualizes async operations and where time is spent waiting) and <b>HeapProfiler</b>. You run your server under it with a load generator: <code>clinic doctor --autocannon [ /path ] -- node server.js</code>.</p>', lvl: 'core' },
    { q: 'What is diagnostics_channel and why does it matter?', a: '<p>A built-in, synchronous publish/subscribe API (stable since 19.2 / 18.13). Libraries publish named events (<code>http.server.request.start</code>, <code>undici:request:create</code>, database drivers’ query events), and APM/tracing tools subscribe. That replaces monkey-patching modules, works with ESM, and costs almost nothing when nobody subscribes (<code>hasSubscribers</code>). <code>tracingChannel</code> standardizes start/end/asyncStart/asyncEnd/error events around an operation.</p>', lvl: 'core' },
    { q: 'How do you profile a process in production safely?', a: '<p>Prefer a canary or a pod drained from the load balancer. Open the inspector only on localhost (<code>SIGUSR1</code> plus <code>kubectl port-forward</code>), record 30–60 s, and close it. Or build an authenticated admin endpoint that uses <code>node:inspector</code> to record a profile for N seconds and upload it. Continuous profilers (Datadog, Pyroscope and others) sample in production at low overhead.</p>', fu: 'What does a CPU profile cost? A few percent at the default interval, more at lower intervals; heap snapshots cost far more.', lvl: 'deep' },
    { q: 'What do (idle), (program) and (garbage collector) mean in a profile?', a: '<p><b>(idle)</b>: the thread was waiting in the event loop with nothing to run. <b>(program)</b>: native work not attributed to a JS function (compilation, C++ internals). <b>(garbage collector)</b>: time in GC on the main thread. A lot of idle with high latency means look at I/O; a lot of GC means look at allocation.</p>', lvl: 'deep' },
    { q: 'What other diagnostics are built into Node?', a: '<ul><li><code>--report-on-signal</code> / <code>--report-uncaught-exception</code>: a JSON diagnostic report (stacks, heap stats, handles, environment).</li><li><code>--heapsnapshot-signal</code>, <code>--heap-prof</code>: memory.</li><li><code>perf_hooks</code>: <code>monitorEventLoopDelay</code>, <code>eventLoopUtilization</code>, marks and measures, GC entries.</li><li><code>--trace-gc</code>, <code>--trace-sync-io</code>, <code>--trace-warnings</code>.</li></ul>', lvl: 'core' },
    { q: 'Compare with profiling a JVM.', a: '<p>JFR (Java Flight Recorder) and async-profiler are the JVM equivalents: low-overhead sampling, flame graphs, and continuous profiling in production. JFR also records allocation, locks and I/O events out of the box, which in Node you assemble from CPU profiles, heap profiles and tracing. <code>jcmd &lt;pid&gt; JFR.start</code> ≈ <code>kill -USR1</code> + inspector recording.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Record a CPU profile on demand', lang: 'ts', code: `import { Session } from 'node:inspector/promises';
import { writeFile } from 'node:fs/promises';

// admin-only endpoint: POST /debug/cpu-profile?seconds=30
export async function captureCpuProfile(seconds = 30): Promise<string> {
  const session = new Session();
  session.connect();
  try {
    await session.post('Profiler.enable');
    await session.post('Profiler.start');
    await new Promise((r) => setTimeout(r, seconds * 1000));
    const { profile } = await session.post('Profiler.stop');
    const file = '/tmp/cpu-' + Date.now() + '.cpuprofile';
    await writeFile(file, JSON.stringify(profile));   // open in DevTools or speedscope
    return file;
  } finally {
    session.disconnect();
  }
}`, note: 'No inspector port is opened: the session talks to V8 in-process. Protect the endpoint like any admin API.' },
    { title: 'Instrument a library with diagnostics_channel', lang: 'ts', code: `import dc from 'node:diagnostics_channel';

// in the library: publish, at near-zero cost when nobody listens
const queryCh = dc.tracingChannel('mydb:query');

export function query(sql: string, params: unknown[]) {
  if (!queryCh.hasSubscribers) return rawQuery(sql, params);
  return queryCh.tracePromise(() => rawQuery(sql, params), { sql });
}

// in the app or APM agent: subscribe
const started = new WeakMap<object, number>();
dc.tracingChannel('mydb:query').subscribe({
  start(ctx) { started.set(ctx, performance.now()); },
  asyncEnd(ctx: any) {
    metrics.histogram('db_query_ms', performance.now() - (started.get(ctx) ?? 0), { op: ctx.sql.split(' ')[0] });
  },
  end() {}, asyncStart() {}, error() {},
});`, note: '<code>TracingChannel</code> (and its <code>hasSubscribers</code>) are still experimental in Node 22; plain channels are stable.' },
    { title: 'The command-line toolbox', lang: 'bash', code: `# CPU profile of a run, written on exit
node --cpu-prof --cpu-prof-dir=./prof server.js

# V8 tick profiler, text summary
node --prof server.js && node --prof-process isolate-*.log > ticks.txt

# flame graph in one step (0x)
npx 0x -- node server.js

# clinic: diagnose, then drill down
npx clinic doctor --autocannon [ -c 50 /search?q=x ] -- node server.js
npx clinic flame  --autocannon [ -c 50 /search?q=x ] -- node server.js

# Linux perf with JIT symbols
node --perf-basic-prof server.js &
perf record -F 99 -g -p $! -- sleep 30 && perf script > out.perf

# Java equivalent, for comparison
# jcmd <pid> JFR.start duration=60s filename=rec.jfr   (or async-profiler -d 30 -f flame.html <pid>)`, note: 'Always profile under load that looks like production, after a warm-up.' }
  ]
});

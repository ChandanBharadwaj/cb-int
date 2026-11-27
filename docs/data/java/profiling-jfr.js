IA.register({
  track: 'java',
  slug: 'profiling-jfr',
  title: 'Profiling & JFR',
  tagline: 'A profiler takes many snapshots of call stacks (<b>samples</b>) and adds them up. Your question picks the event. <i>CPU</i> shows what burns cores. <i>Wall clock</i> shows where requests wait. <i>Allocation</i> shows what feeds the GC. <i>Locks</i> show contention. JFR records all of these inside the JVM, cheaply. async-profiler turns them into accurate flame graphs.',
  tldr: {
    problem: 'Guessing at performance is expensive. Teams tune the GC when the real cost is a regex compiled per request. Or they optimize CPU while requests wait on a lock. Some profilers also blame the wrong method, because they can only sample at certain points.',
    model: 'Every few ms, grab the stack of each running thread (CPU) or every thread (wall). For allocation, sample when a thread needs a new allocation buffer. Merge identical stacks into a <b>flame graph</b>: width is the share of samples, height is stack depth. Look for <b>wide plateaus</b> near the top. JFR is built into the JVM (JDK 11+, 8u262). async-profiler can sample at any instruction.',
    hook: '“CPU is 20% but p99 doubled. Which profile?” A <b>wall-clock</b> profile, or JFR’s park, monitor and socket events. A CPU profile only shows running threads. Waiting threads don’t run.',
    facts: [
      { v: 'JDK 11', l: 'open-sourced JDK Flight Recorder; also in OpenJDK 8u262+. JDK 14 added live event streaming. JDK 21 added <code>jfr view</code>' },
      { v: '~1%', l: 'overhead the default JFR settings aim for. That makes always-on recording in production practical. The <code>profile</code> settings sample more and cost more' },
      { v: 'x ≠ time', l: 'in a flame graph, the x-axis is share of samples, sorted alphabetically per level. Width matters. Left-to-right order means nothing' }
    ]
  },
  intro: {
    what: 'When a program is slow, you want to know <b>where the time goes</b>. A <b>profiler</b> takes many quick snapshots of each thread’s call stack. It counts how often each method shows up. Methods in many snapshots are where time goes. A <b>flame graph</b> draws those counts as stacked bars: wide bars are expensive. Java ships its own recorder, <b>JFR</b>. The open-source <b>async-profiler</b> is the standard tool for flame graphs.',
    analogy: { icon: '📸', title: 'Photos of a busy kitchen', text: 'Instead of timing every chef, you take a photo every second for an hour. If 40% of photos show onion chopping, chopping is 40% of the work. A <i>CPU</i> profile only photographs chefs who are working. A <i>wall-clock</i> profile photographs everyone, even those waiting for the oven. A camera that only fires when a chef puts the knife down (a safepoint) never catches the long chop.' },
    steps: [
      { t: 'Record with JFR', d: 'No agent, no restart: <code>jcmd</code> starts a recording on a running JVM.', code: 'jcmd <pid> JFR.start duration=60s settings=profile filename=/tmp/app.jfr', lang: 'bash' },
      { t: 'Look at it', d: 'Open the file in JDK Mission Control (JMC), or summarize it on the command line.', code: 'jfr view hot-methods /tmp/app.jfr        # JDK 21+\njfr print --events jdk.GarbageCollection /tmp/app.jfr', lang: 'bash' },
      { t: 'Draw a flame graph', d: 'async-profiler attaches to a running JVM and writes an interactive HTML flame graph.', code: 'asprof -d 30 -e cpu -f /tmp/cpu.html <pid>', lang: 'bash' },
      { t: 'Pick the right event', d: '<code>cpu</code> for hot code, <code>wall</code> for latency and waiting, <code>alloc</code> for GC pressure, <code>lock</code> for contention.' }
    ],
    terms: [
      ['sample', 'One stack trace of one thread at one moment.'],
      ['flame graph', 'Stacks merged into a tree and drawn bottom-up. Each box’s width is its share of samples.'],
      ['JFR', 'JDK Flight Recorder: a cheap event recorder inside HotSpot (GC, JIT, locks, I/O, method samples, custom events).'],
      ['JMC', 'JDK Mission Control: the desktop app that reads <code>.jfr</code> files.'],
      ['safepoint', 'A point where the JVM knows a thread’s state, like method returns and loop ends (a <i>safepoint</i>). Older profilers could only sample there.'],
      ['TLAB', 'A thread’s private allocation buffer (<i>TLAB</i>). Allocation profilers sample when a thread needs a new one. That’s cheap and tracks bytes allocated.']
    ]
  },
  visual: {
    title: 'Watch samples become a flame graph, and see safepoint bias',
    caption: 'Pick a profile and press Play or Step. Samples from one request handler pile up into a flame graph. Compare <b>CPU</b>, <b>wall clock</b> and <b>allocation</b> views. <b>safepoint bias</b> shows how a limited sampler blames the wrong method. Hover a box for its share.'
  },
  gotchas: [
    { trap: 'Using a CPU profile to explain latency', why: 'CPU sampling only sees threads on a CPU. A request waiting 300 ms for a pool, a lock or a slow partner barely shows up.', fix: 'Use a wall-clock profile (<code>asprof -e wall -t</code>, then read the request threads). Or use JFR’s <code>jdk.ThreadPark</code>, <code>jdk.JavaMonitorEnter</code>, <code>jdk.SocketRead</code> events. Then use CPU profiling for the part that really computes.' },
    { trap: 'Trusting a safepoint-biased sampler', why: 'Profilers built on <code>Thread.getAllStackTraces</code> / JVMTI can only sample at safepoints. Time in a tight loop with no safepoint check gets blamed on the next safepoint. That’s often the caller or the next method.', fix: 'Use async-profiler or JFR method sampling, which sample at any moment. Add <code>-XX:+UnlockDiagnosticVMOptions -XX:+DebugNonSafepoints</code> so inlined frames get the right blame.' },
    { trap: 'Reading the x-axis as time', why: 'Flame graphs sort frames alphabetically within each level and merge identical stacks. Two boxes side by side didn’t happen one after another.', fix: 'Read widths, not positions. For “what happened when”, use a timeline view (JMC, or async-profiler’s JFR output).' },
    { trap: 'Profiling a cold JVM', why: 'In the first seconds the JIT is still compiling. You profile the interpreter and the compiler, not your steady state. Microbenchmarks have the same problem.', fix: 'Warm up under real load before recording. Record for 30–60 s. Compare with JIT activity (JFR <code>jdk.Compilation</code>). See <a href="jit-compilation.html">JIT compilation</a>.' },
    { trap: 'Allocation is the cause, GC is the symptom', why: 'Frequent young GCs and high GC CPU mean the app allocates a lot. GC tuning only moves the cost around.', fix: 'Take an allocation profile (<code>asprof -e alloc</code>, or JFR <code>jdk.ObjectAllocationSample</code>, JDK 16+). Fix the top allocation sites: string building in logs, boxing, oversized buffers, repeated serialization.' },
    { trap: 'async-profiler fails in a container', code: `[ERROR] Perf events unavailable
# perf_event_open() blocked by seccomp or kernel.perf_event_paranoid`, why: 'Hardware and kernel perf events need permissions that containers often lack.', fix: 'Use <code>-e itimer</code> (or <code>ctimer</code> in newer versions), which needs no perf events. Or adjust <code>perf_event_paranoid</code>/seccomp on the node. JFR needs none of this.' }
  ],
  scenarios: [
    { title: 'p99 doubled after a logging change; CPU is unchanged',
      symptom: 'After moving log output to network storage, p99 latency doubled. CPU per pod is flat. The CPU flame graph looks the same as before.',
      diagnose: `asprof -d 30 -e wall -t -f wall.html <pid>      # -t: one tower per thread
# in the http-nio-* request-thread towers, the widest plateau (~35%):
#   ch.qos.logback.core.OutputStreamAppender.subAppend
#   → ReentrantLock.lock → LockSupport.park
# JFR agrees: jdk.ThreadPark events on the appender's lock, avg 40 ms`,
      cause: 'A synchronous appender puts every log write behind one lock. On slow storage, request threads spend their time <b>waiting</b> for it. Waiting isn’t CPU, so the CPU profile couldn’t show it.',
      fix: 'Write logs asynchronously (Logback <code>AsyncAppender</code> with a bounded queue and <code>neverBlock</code> for non-critical logs). Or log to stdout and let the platform ship it. Keep wall-clock profiles in your toolbox for latency.',
      fixCode: `<appender name="ASYNC" class="ch.qos.logback.classic.AsyncAppender">
  <queueSize>8192</queueSize>
  <neverBlock>true</neverBlock>          <!-- drop rather than stall request threads -->
  <appender-ref ref="FILE"/>
</appender>`, fixLang: 'text', diagnoseLang: 'bash' },
    { title: 'GC uses 25% of CPU after a feature launch',
      symptom: 'Young GCs went from 2 to 30 per second. Someone suggests a bigger heap.',
      diagnose: `asprof -d 30 -e alloc -f alloc.html <pid>
# 41%  java.lang.String.format ← OrderService.audit ← OrderController.create
# 22%  com.fasterxml.jackson...ByteArrayBuilder ← AuditClient.send
# JFR: jdk.ObjectAllocationSample shows the same top frames`,
      cause: 'A new audit line built a big formatted string and serialized a copy of the order on every request. It was at debug level, and debug was off. But the arguments were built before the logger checked the level.',
      fix: 'Use parameterized logging, so nothing is built when the level is off. Serialize once. GC dropped back with no GC tuning.',
      fixCode: `// before: formats even when DEBUG is disabled
log.debug(String.format("order %s: %s", id, mapper.writeValueAsString(order)));

// after: no work unless enabled
if (log.isDebugEnabled()) log.debug("order {}: {}", id, mapper.writeValueAsString(order));` },
    { title: 'The profiler blamed the wrong method',
      symptom: 'A report endpoint is CPU-bound. An old sampling profiler showed 90% in <code>ReportService.build</code>, which mostly calls other methods. Optimizing it changed nothing.',
      diagnose: `# same load, async-profiler with precise frames
java -XX:+UnlockDiagnosticVMOptions -XX:+DebugNonSafepoints ...
asprof -d 30 -e cpu -f cpu.html <pid>
# 78%  Crc.update   (inlined into ReportService.build)
#      → tight int loop over a byte[]`,
      cause: '<b>Safepoint bias</b>: the old sampler could only record stacks at safepoints. The tight loop in <code>Crc.update</code> had no safepoint check. So every sample landed when control returned to the caller. Inlining made it worse.',
      fix: 'Profile with async-profiler, or JFR plus <code>DebugNonSafepoints</code>. The real fix was <code>java.util.zip.CRC32</code> (a JVM-optimized built-in) instead of a hand-written loop.' }
  ],
  puzzles: [
    { kind: 'predict', q: 'A custom JFR event, recorded and read back in-process. What does this print?', code: `import jdk.jfr.*;
import jdk.jfr.consumer.*;
import java.nio.file.*;

public class Main {
    @Name("demo.Order")
    static class OrderEvent extends Event {
        long amount;
    }

    public static void main(String[] a) throws Exception {
        Path file = Files.createTempFile("demo", ".jfr");
        try (Recording r = new Recording()) {
            r.enable("demo.Order");
            r.start();
            for (int i = 1; i <= 3; i++) {
                OrderEvent e = new OrderEvent();
                e.amount = i * 10;
                e.commit();
            }
            new OrderEvent();          // created but never committed
            r.stop();
            r.dump(file);
        }
        long n = 0, sum = 0;
        for (RecordedEvent e : RecordingFile.readAllEvents(file)) {
            if (e.getEventType().getName().equals("demo.Order")) { n++; sum += e.getLong("amount"); }
        }
        System.out.println(n + " events, sum " + sum);
        Files.delete(file);
    }
}`, options: ['4 events, sum 60', '3 events, sum 60', '0 events, sum 0 (custom events need -XX:StartFlightRecording)', '3 events, sum 0'], answer: 1, run: true, expect: '3 events, sum 60', explain: 'Only <code>commit()</code> writes an event. The fourth object is just garbage. A <code>Recording</code> made in code needs no command-line flag. <code>enable("demo.Order")</code> turns on the custom event by its <code>@Name</code>. Custom events cheaply put business timings next to GC and lock events in one recording.' },
    { kind: 'concept', q: 'In a flame graph, box A is to the left of box B on the same level. What does that tell you?', options: ['A ran before B', 'A used more CPU than B', 'Nothing about time: frames are sorted alphabetically; only the widths are meaningful', 'A was called by B'], answer: 2, explain: 'Flame graphs merge identical stacks and sort siblings by name. Width is the share of samples. The parent is the frame directly below. Use a timeline view if time order matters.' },
    { kind: 'concept', q: 'Latency is up, CPU is low. You take a CPU profile and it looks normal. Next step?', options: ['Increase the heap', 'Take a wall-clock profile of request threads (or look at JFR park/monitor/socket events)', 'Take a longer CPU profile', 'Disable the JIT'], answer: 1, explain: 'Waiting threads aren’t on a CPU, so CPU sampling can’t see them. Wall-clock sampling includes parked, blocked and I/O threads. That’s where latency hides: locks, pools, slow dependencies.' },
    { kind: 'concept', q: 'What is safepoint bias?', options: ['GC pauses make profiles inaccurate', 'A sampler that can only take stacks at safepoints attributes time to the next safepoint location, not to the code that actually ran', 'JFR skips threads that are at a safepoint', 'The JIT removes safepoints from profiled code'], answer: 1, explain: 'Safepoint checks sit at method returns and loop ends. The JIT removes them from tight int loops. A safepoint-based sampler waits until each thread reaches one. So tight loops and inlined code are under-counted, and their callers over-counted. async-profiler and JFR avoid this.' },
    { kind: 'concept', q: 'Young GC runs 20 times a second. Which profile finds the cause fastest?', options: ['CPU profile', 'Allocation profile (async-profiler -e alloc, or JFR ObjectAllocationSample)', 'Lock profile', 'A heap dump'], answer: 1, explain: 'Allocation rate drives young GC frequency. An allocation profile shows <i>which stacks allocate the most bytes</i>. A heap dump shows what is <b>live</b>. That’s right for leaks but says little about short-lived garbage.' },
    { kind: 'concept', q: 'Why does async-profiler recommend <code>-XX:+DebugNonSafepoints</code>?', options: ['It disables safepoints to reduce pauses', 'It makes the JIT keep debug info for non-safepoint locations, so samples inside inlined code map to the right method and line', 'It turns on JFR', 'It is required for allocation profiling'], answer: 1, explain: 'By default, compiled code has exact frame and line info only at safepoints. With this flag the JIT records it at more places. A sample inside inlined code then gets blamed on the inlined method, not its outer frame.' },
    { kind: 'concept', q: 'Is it reasonable to run JFR continuously in production?', options: ['No: it is a debugging tool with 20–30% overhead', 'Yes: the default settings are designed for about 1% overhead; keep a rolling buffer and dump on demand', 'Only with a commercial licence', 'Only on Java 8'], answer: 1, explain: 'JFR is built to be always on. <code>-XX:StartFlightRecording=maxage=1h,settings=default</code> keeps a rolling window. After an incident, dump it with <code>jcmd JFR.dump</code>. It is free in OpenJDK since 11 (and 8u262).' }
  ],
  interview: [
    { q: 'How do sampling profilers work, and what are the main event types?', a: '<p>They grab stack traces at intervals and count them. <b>CPU</b>: sample running threads. <b>Wall clock</b>: sample all threads, including waiting ones. <b>Allocation</b>: sample allocations, usually when a TLAB refills, weighted by bytes. <b>Lock</b>: record time spent waiting for locks. Profilers that time every method distort what they measure. They are rarely used in production.</p>', lvl: 'core' },
    { q: 'What is JFR and how do you use it?', a: '<p>JDK Flight Recorder is an event recorder inside HotSpot. It records GC, safepoints, JIT, class loading, method and allocation samples, lock waits, socket and file I/O, exceptions, virtual-thread pinning and custom events. Start it with <code>-XX:StartFlightRecording</code> or at run time with <code>jcmd &lt;pid&gt; JFR.start</code>. Dump with <code>JFR.dump</code>. Analyze in JDK Mission Control, or with <code>jfr print</code>/<code>jfr summary</code>/<code>jfr view</code> (21+). JDK 14+ can stream events live (<code>RecordingStream</code>).</p>', lvl: 'core' },
    { q: 'How do you read a flame graph?', a: '<p>Each box is a frame. The box below is its caller. Width is the share of samples that include that frame. Look for wide boxes at the top (“plateaus”): that’s time spent in the method itself. A wide box with many narrow children shares its cost among callees. The x order is alphabetical, not time. Color usually shows frame type (Java, compiled, native, kernel), not heat.</p>', lvl: 'core' },
    { q: 'Explain safepoint bias and how async-profiler avoids it.', a: '<p>Classic samplers ask for stack traces that the JVM can only give at safepoints. Each sample waits until the thread reaches a check: a method return or loop end. Code between checks is invisible, and its cost lands on the next check. async-profiler walks the stack from a signal handler at any instruction. It also captures native and kernel frames. JFR’s sampler also pauses threads at any point.</p>', lvl: 'deep' },
    { q: 'CPU profile vs wall-clock profile: when do you use which?', a: '<p>Use CPU when the machine is busy and you want less compute: hot methods, regexes, serialization, hashing. Use wall clock when latency is the problem and CPU isn’t. It shows where request threads <i>wait</i>: locks, pools, I/O. Filter wall profiles to the right threads. Otherwise idle pool threads parked in <code>getTask()</code> fill the graph.</p>', lvl: 'core' },
    { q: 'How would you profile a service running in Kubernetes?', a: '<p>JFR needs nothing extra. <code>kubectl exec</code> into the pod, run <code>jcmd 1 JFR.start duration=60s filename=/tmp/r.jfr</code>, then <code>kubectl cp</code> the file out. For flame graphs, add async-profiler to the image and run <code>asprof</code>. In restricted containers use <code>-e itimer</code>. Many teams keep JFR on with a rolling buffer, or use a continuous-profiling agent (e.g. Pyroscope).</p>', lvl: 'deep' },
    { q: 'What is the difference between an allocation profile and a heap dump?', a: '<p>An allocation profile shows <b>where objects are allocated</b> over time, short-lived garbage included. It explains GC frequency. A heap dump is a snapshot of <b>live</b> objects and who holds them. It explains leaks and a full old gen. See <a href="leaks-oom.html">Memory leaks & OOM</a>.</p>', lvl: 'core' },
    { q: 'How do you create a custom JFR event?', a: '<p>Extend <code>jdk.jfr.Event</code>. Add primitive or String fields. Annotate with <code>@Name</code>, <code>@Label</code>, <code>@Category</code>. Call <code>begin()</code>, do the work, then <code>commit()</code>, which records the duration. For an instant event, only call <code>commit()</code>. Use <code>shouldCommit()</code> to skip costly fields when the event is off. The JIT can remove a disabled event almost entirely.</p>', lvl: 'deep' },
    { q: 'Which JFR events help with concurrency problems?', a: '<ul><li><code>jdk.JavaMonitorEnter</code>, <code>jdk.JavaMonitorWait</code>: contended <code>synchronized</code>.</li><li><code>jdk.ThreadPark</code>: <code>LockSupport.park</code>, so ReentrantLock, queues, pools.</li><li><code>jdk.VirtualThreadPinned</code> (21): virtual threads stuck to their carrier while blocking.</li><li><code>jdk.SafepointBegin</code> and friends: slow-to-safepoint problems.</li><li><code>jdk.ThreadDump</code> (periodic thread dumps, off by default).</li></ul>', lvl: 'deep' },
    { q: 'Why can a microbenchmark mislead you, and what do you use instead?', a: '<p>Without care, the JIT removes unused work, moves fixed work out of loops, precomputes constant inputs, or you measure the interpreter during warm-up. JMH handles warm-up, forking, blackholes and statistics. Even then, a microbenchmark tells you how fast a method is alone. Profiling the real service under real load tells you whether it matters.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'JFR from the command line', lang: 'bash', code: `# always-on rolling recording from startup (~1% overhead with default settings)
java -XX:StartFlightRecording=name=bg,settings=default,maxage=1h,maxsize=500m,disk=true -jar app.jar

# after an incident: dump the last hour from the rolling buffer
jcmd <pid> JFR.dump name=bg filename=/tmp/incident.jfr

# a focused 60 s profile with more sampling
jcmd <pid> JFR.start name=prof settings=profile duration=60s filename=/tmp/prof.jfr

# summaries without a GUI (JDK 21+ views)
jfr summary /tmp/prof.jfr
jfr view hot-methods /tmp/prof.jfr
jfr print --events jdk.ThreadPark --stack-depth 8 /tmp/prof.jfr | head -60`, note: 'In containers, write to a mounted volume or <code>/tmp</code>. Copy out with <code>kubectl cp</code>.' },
    { title: 'async-profiler flame graphs', lang: 'bash', code: `# CPU: what burns cores (add precise inlined frames at JVM start)
#   -XX:+UnlockDiagnosticVMOptions -XX:+DebugNonSafepoints
asprof -d 30 -e cpu -f /tmp/cpu.html <pid>

# wall clock, split per thread (-t): where latency waits; read the request threads
asprof -d 30 -e wall -t -f /tmp/wall.html <pid>

# allocation: what drives GC (bytes, sampled at TLAB boundaries)
asprof -d 30 -e alloc -f /tmp/alloc.html <pid>

# lock contention (monitors and j.u.c. locks)
asprof -d 30 -e lock -f /tmp/lock.html <pid>

# no perf events in this container? use a timer-based CPU sampler
asprof -d 30 -e itimer -f /tmp/cpu.html <pid>`, note: 'async-profiler 3.x ships the <code>asprof</code> launcher (older versions used <code>profiler.sh</code>). It can also write JFR output (<code>-o jfr</code>) for JMC.' },
    { title: 'Business timings as custom JFR events', lang: 'java', code: `@Name("acme.Checkout")
@Label("Checkout")
@Category({"Acme", "Orders"})
@StackTrace(false)
@Threshold("50 ms")                     // record only slow checkouts
class CheckoutEvent extends Event {
    @Label("Tenant") String tenant;
    @Label("Items")  int items;
    @Label("Outcome") String outcome;
}

@Service
class CheckoutService {
    Receipt checkout(Cart cart) {
        CheckoutEvent ev = new CheckoutEvent();
        ev.begin();
        try {
            Receipt r = doCheckout(cart);
            ev.outcome = "ok";
            return r;
        } catch (RuntimeException e) {
            ev.outcome = e.getClass().getSimpleName();
            throw e;
        } finally {
            if (ev.shouldCommit()) { ev.tenant = cart.tenant(); ev.items = cart.size(); }
            ev.commit();                       // records duration; nearly free when disabled
        }
    }
}`, note: 'Slow checkouts now show up in JMC on the same timeline as GC pauses, lock waits and socket reads.' }
  ]
});

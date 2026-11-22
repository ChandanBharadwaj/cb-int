IA.register({
  track: 'java',
  slug: 'profiling-jfr',
  title: 'Profiling & JFR',
  tagline: 'A profiler <b>samples stacks</b> and adds them up. The question you ask decides the event: <i>CPU</i> (what burns cores), <i>wall clock</i> (where requests wait), <i>allocation</i> (what feeds the GC), <i>locks</i>. JFR records all of these inside the JVM at low overhead; async-profiler turns them into flame graphs without safepoint bias.',
  tldr: {
    problem: 'Guessing at performance is expensive: teams tune the GC when the real cost is a regex compiled per request, or optimise CPU when requests are waiting on a lock. Some profilers also lie, attributing time to the wrong method because they can only sample at safepoints.',
    model: 'Every N ms, take a stack trace of each running (CPU) or every (wall) thread; for allocation, sample when TLABs are refilled. Merge identical stacks into a <b>flame graph</b>: width = share of samples, height = stack depth. Look for <b>wide plateaus</b> near the top. JFR is built into the JVM (JDK 11+, backported to 8u262); async-profiler uses <code>AsyncGetCallTrace</code> plus perf events to sample anywhere, not just at safepoints.',
    hook: '“CPU is 20% but p99 doubled. Which profile?” A <b>wall-clock</b> profile (or JFR’s thread-park, monitor and socket events). A CPU profile only shows threads that are running, and waiting threads don’t run.',
    facts: [
      { v: 'JDK 11', l: 'open-sourced JDK Flight Recorder (JEP 328); also in OpenJDK 8u262+. JDK 14 added event streaming (JEP 349); JDK 21 added <code>jfr view</code>' },
      { v: '~1%', l: 'overhead the default JFR settings are designed for, which makes continuous recording in production practical. The <code>profile</code> settings sample more and cost more' },
      { v: 'x ≠ time', l: 'in a flame graph, the x-axis is the share of samples, sorted alphabetically per level. Width matters; left-to-right order means nothing' }
    ]
  },
  intro: {
    what: 'When a program is slow, you want to know <b>where the time goes</b>. A <b>profiler</b> answers by taking many quick snapshots of what each thread is doing (its call stack) and counting how often each method shows up. Methods that appear in many snapshots are where the time is spent. A <b>flame graph</b> draws those counts as stacked bars: wide bars are expensive. Java ships its own always-available recorder, <b>JFR</b>, and the open-source <b>async-profiler</b> is the standard tool for flame graphs.',
    analogy: { icon: '📸', title: 'Photos of a busy kitchen', text: 'Instead of timing every chef with a stopwatch, you take a photo every second for an hour. If 40% of the photos show someone chopping onions, chopping onions is 40% of the work, even if you never timed it. A <i>CPU</i> profile only photographs chefs who are working; a <i>wall-clock</i> profile photographs everyone, including the ones waiting for the oven. A camera that can only fire when a chef puts a knife down (a safepoint) will never catch the long chop itself.' },
    steps: [
      { t: 'Record with JFR', d: 'No agent, no restart if the JVM is running: <code>jcmd</code> starts a recording.', code: 'jcmd <pid> JFR.start duration=60s settings=profile filename=/tmp/app.jfr', lang: 'bash' },
      { t: 'Look at it', d: 'Open the file in JDK Mission Control (JMC), or summarise it on the command line.', code: 'jfr view hot-methods /tmp/app.jfr        # JDK 21+\njfr print --events jdk.GarbageCollection /tmp/app.jfr', lang: 'bash' },
      { t: 'Draw a flame graph', d: 'async-profiler attaches to a running JVM and writes an interactive HTML flame graph.', code: 'asprof -d 30 -e cpu -f /tmp/cpu.html <pid>', lang: 'bash' },
      { t: 'Pick the right event', d: '<code>cpu</code> for hot code, <code>wall</code> for latency and waiting, <code>alloc</code> for GC pressure, <code>lock</code> for contention.' }
    ],
    terms: [
      ['sample', 'One stack trace of one thread at one moment.'],
      ['flame graph', 'Stacks merged into a tree and drawn bottom-up; each box’s width is its share of samples.'],
      ['JFR', 'JDK Flight Recorder: a low-overhead event recorder inside HotSpot (GC, JIT, locks, I/O, method samples, custom events).'],
      ['JMC', 'JDK Mission Control: the desktop app that analyses <code>.jfr</code> files.'],
      ['safepoint', 'A point where a thread’s state is known to the JVM (method returns, loop back-edges). Older profilers could only sample there.'],
      ['TLAB', 'Thread-local allocation buffer. Allocation profilers sample when a thread needs a new one, which is cheap and proportional to bytes allocated.']
    ]
  },
  visual: {
    title: 'Watch samples become a flame graph, and see safepoint bias',
    caption: 'Pick a profile and press Play or Step: stack samples from the same request handler pile up into a flame graph. Compare <b>CPU</b>, <b>wall clock</b> and <b>allocation</b> views of one service. <b>safepoint bias</b> shows how a sampler that can only stop threads at safepoints blames the wrong method. Hover a box for its share.'
  },
  gotchas: [
    { trap: 'Using a CPU profile to explain latency', why: 'CPU sampling only sees threads that are on a CPU. A request waiting 300 ms for a connection pool, a lock or a slow partner shows up as almost nothing.', fix: 'Use a wall-clock profile (<code>asprof -e wall -t</code>, then read the request threads) or JFR’s <code>jdk.ThreadPark</code>, <code>jdk.JavaMonitorEnter</code>, <code>jdk.SocketRead</code> events. Then use CPU profiling for the part that really computes.' },
    { trap: 'Trusting a safepoint-biased sampler', why: 'Profilers based on <code>Thread.getAllStackTraces</code> / JVMTI can only take samples at safepoints. Time spent in a hot counted loop with no safepoint poll gets attributed to wherever the thread reaches the next safepoint, often the caller or the next method.', fix: 'Use async-profiler or JFR method sampling, which sample asynchronously. Add <code>-XX:+UnlockDiagnosticVMOptions -XX:+DebugNonSafepoints</code> so inlined frames are attributed precisely.' },
    { trap: 'Reading the x-axis as time', why: 'Flame graphs sort frames alphabetically within each level and merge identical stacks. Two boxes side by side didn’t happen one after another.', fix: 'Read widths, not positions. For “what happened when”, use a timeline view (JMC, or async-profiler’s JFR output in a timeline viewer).' },
    { trap: 'Profiling a cold JVM', why: 'In the first seconds the JIT is still compiling; you profile the interpreter and the compiler threads, not your steady state. Microbenchmarks have the same problem.', fix: 'Warm up under realistic load before recording, record for 30–60 s, and compare with JIT activity (JFR <code>jdk.Compilation</code>). See <a href="jit-compilation.html">JIT compilation</a>.' },
    { trap: 'Allocation is the cause, GC is the symptom', why: 'Frequent young GCs and high GC CPU mean the app allocates a lot. GC tuning only moves the cost around.', fix: 'Take an allocation profile (<code>asprof -e alloc</code>, or JFR <code>jdk.ObjectAllocationSample</code>, JDK 16+) and fix the top allocation sites: string building in logs, boxing, oversized buffers, repeated serialisation.' },
    { trap: 'async-profiler fails in a container', code: `[ERROR] Perf events unavailable
# perf_event_open() blocked by seccomp or kernel.perf_event_paranoid`, why: 'Hardware and kernel perf events need permissions that containers often lack.', fix: 'Use <code>-e itimer</code> (or <code>ctimer</code> in newer versions), which needs no perf events, or adjust <code>perf_event_paranoid</code>/seccomp on the node. JFR works without any of this.' }
  ],
  scenarios: [
    { title: 'p99 doubled after a logging change; CPU is unchanged',
      symptom: 'After switching log output to a file on network storage, p99 latency doubled. CPU per pod is flat, and the CPU flame graph looks the same as before.',
      diagnose: `asprof -d 30 -e wall -t -f wall.html <pid>      # -t: one tower per thread
# in the http-nio-* request-thread towers, the widest plateau (~35%):
#   ch.qos.logback.core.OutputStreamAppender.subAppend
#   → ReentrantLock.lock → LockSupport.park
# JFR agrees: jdk.ThreadPark events on the appender's lock, avg 40 ms`,
      cause: 'A synchronous appender serialises every log write behind one lock. On slow storage, request threads spend their time <b>waiting</b> for that lock. Waiting isn’t CPU, so the CPU profile couldn’t show it.',
      fix: 'Write logs asynchronously (Logback <code>AsyncAppender</code> with a bounded queue and <code>neverBlock</code> for non-critical logs), or log to stdout and let the platform ship it. Keep a wall-clock profile in the toolbox for latency problems.',
      fixCode: `<appender name="ASYNC" class="ch.qos.logback.classic.AsyncAppender">
  <queueSize>8192</queueSize>
  <neverBlock>true</neverBlock>          <!-- drop rather than stall request threads -->
  <appender-ref ref="FILE"/>
</appender>`, lang: 'text' },
    { title: 'GC uses 25% of CPU after a feature launch',
      symptom: 'Young GCs went from 2 to 30 per second. Someone suggests a bigger heap.',
      diagnose: `asprof -d 30 -e alloc -f alloc.html <pid>
# 41%  java.lang.String.format ← OrderService.audit ← OrderController.create
# 22%  com.fasterxml.jackson...ByteArrayBuilder ← AuditClient.send
# JFR: jdk.ObjectAllocationSample shows the same top frames`,
      cause: 'A new audit line built a large formatted string and serialised a copy of the order on every request, at debug level, even though debug logging was off: the arguments were evaluated before the logger checked the level.',
      fix: 'Use parameterised logging so nothing is built when the level is off, and serialise once. GC dropped back without any GC tuning.',
      fixCode: `// before: formats even when DEBUG is disabled
log.debug(String.format("order %s: %s", id, mapper.writeValueAsString(order)));

// after: no work unless enabled
if (log.isDebugEnabled()) log.debug("order {}: {}", id, mapper.writeValueAsString(order));` },
    { title: 'The profiler blamed the wrong method',
      symptom: 'A report endpoint is CPU-bound. An old sampling profiler showed 90% in <code>ReportService.build</code>, which does little more than call other methods. Optimising it changed nothing.',
      diagnose: `# same load, async-profiler with precise frames
java -XX:+UnlockDiagnosticVMOptions -XX:+DebugNonSafepoints ...
asprof -d 30 -e cpu -f cpu.html <pid>
# 78%  Crc.update   (inlined into ReportService.build)
#      → tight int loop over a byte[]`,
      cause: '<b>Safepoint bias</b>: the old sampler could only record stacks at safepoints. The hot counted loop in <code>Crc.update</code> had no safepoint poll, so every sample landed when control returned to the caller. Inlining made it worse.',
      fix: 'Profile with async-profiler or JFR plus <code>DebugNonSafepoints</code>. The real fix was using <code>java.util.zip.CRC32</code> (an intrinsic) instead of a hand-written loop.' }
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
}`, options: ['4 events, sum 60', '3 events, sum 60', '0 events, sum 0 (custom events need -XX:StartFlightRecording)', '3 events, sum 0'], answer: 1, run: true, expect: '3 events, sum 60', explain: 'Only <code>commit()</code> writes an event; the fourth object is just garbage. A programmatic <code>Recording</code> works without any command-line flag, and <code>enable("demo.Order")</code> turns on the custom event by its <code>@Name</code>. Custom events are a cheap way to put business timings (order id, tenant, duration) next to GC and lock events in the same recording.' },
    { kind: 'concept', q: 'In a flame graph, box A is to the left of box B on the same level. What does that tell you?', options: ['A ran before B', 'A used more CPU than B', 'Nothing about time: frames are sorted alphabetically; only the widths are meaningful', 'A was called by B'], answer: 2, explain: 'Flame graphs merge identical stacks and sort siblings by name. Width = share of samples; the parent is the frame directly below. Use a timeline view if order in time matters.' },
    { kind: 'concept', q: 'Latency is up, CPU is low. You take a CPU profile and it looks normal. Next step?', options: ['Increase the heap', 'Take a wall-clock profile of request threads (or look at JFR park/monitor/socket events)', 'Take a longer CPU profile', 'Disable the JIT'], answer: 1, explain: 'Waiting threads aren’t on a CPU, so CPU sampling can’t see them. Wall-clock sampling includes threads that are parked, blocked or in I/O, which is where latency hides: locks, pools, slow dependencies.' },
    { kind: 'concept', q: 'What is safepoint bias?', options: ['GC pauses make profiles inaccurate', 'A sampler that can only take stacks at safepoints attributes time to the next safepoint location, not to the code that actually ran', 'JFR skips threads that are at a safepoint', 'The JIT removes safepoints from profiled code'], answer: 1, explain: 'Safepoint polls sit at method returns and loop back-edges (and the JIT removes them from counted int loops). A safepoint-based sampler waits until each thread reaches one, so tight loops and inlined code are under-reported and their callers over-reported. async-profiler and JFR’s execution sampler avoid this.' },
    { kind: 'concept', q: 'Young GC runs 20 times a second. Which profile finds the cause fastest?', options: ['CPU profile', 'Allocation profile (async-profiler -e alloc, or JFR ObjectAllocationSample)', 'Lock profile', 'A heap dump'], answer: 1, explain: 'Young GC frequency is driven by allocation rate. An allocation profile shows <i>which stacks allocate the most bytes</i>. A heap dump shows what is <b>live</b>, which is the right tool for leaks but says little about short-lived garbage.' },
    { kind: 'concept', q: 'Why does async-profiler recommend <code>-XX:+DebugNonSafepoints</code>?', options: ['It disables safepoints to reduce pauses', 'It makes the JIT keep debug info for non-safepoint locations, so samples inside inlined code map to the right method and line', 'It turns on JFR', 'It is required for allocation profiling'], answer: 1, explain: 'By default, compiled code only has precise frame and line metadata at safepoints. With this flag the JIT records it at more locations, so an asynchronous sample in the middle of inlined code is attributed to the inlined method instead of its outer frame.' },
    { kind: 'concept', q: 'Is it reasonable to run JFR continuously in production?', options: ['No: it is a debugging tool with 20–30% overhead', 'Yes: the default settings are designed for about 1% overhead; keep a rolling buffer and dump on demand', 'Only with a commercial licence', 'Only on Java 8'], answer: 1, explain: 'JFR is designed to be always on: <code>-XX:StartFlightRecording=maxage=1h,settings=default</code> keeps a rolling window you can dump with <code>jcmd JFR.dump</code> after an incident. It has been free in OpenJDK since 11 (and 8u262).' }
  ],
  interview: [
    { q: 'How do sampling profilers work, and what are the main event types?', a: '<p>They periodically capture stack traces and count them. <b>CPU</b>: sample threads that are running (via perf events or a CPU timer). <b>Wall clock</b>: sample all threads at fixed intervals, including waiting ones. <b>Allocation</b>: sample allocations, typically when a TLAB is refilled or an object is allocated outside one, weighted by bytes. <b>Lock</b>: record time spent contending for monitors or j.u.c. locks. Instrumenting profilers that time every method distort what they measure and are rarely used for production problems.</p>', lvl: 'core' },
    { q: 'What is JFR and how do you use it?', a: '<p>JDK Flight Recorder is an event recorder inside HotSpot: GC, safepoints, JIT compilations, class loading, method samples, allocation samples, monitor and park waits, socket and file I/O, exceptions, virtual-thread pinning, and custom events. Start it with <code>-XX:StartFlightRecording</code> or at run time with <code>jcmd &lt;pid&gt; JFR.start</code>, dump with <code>JFR.dump</code>, analyse in JDK Mission Control, or with <code>jfr print</code>/<code>jfr summary</code>/<code>jfr view</code> (21+). JDK 14+ can stream events live (<code>RecordingStream</code>).</p>', lvl: 'core' },
    { q: 'How do you read a flame graph?', a: '<p>Each box is a frame; the box below is its caller. Width is the fraction of samples that include that frame. Look for wide boxes at the top (“plateaus”): that is self time. A wide box with many narrow children is a method whose callees share the cost. The x order is alphabetical, not chronological. Colour usually encodes frame type (Java, JIT-compiled, native, kernel), not heat.</p>', lvl: 'core' },
    { q: 'Explain safepoint bias and how async-profiler avoids it.', a: '<p>Classic JVMTI-based samplers request stack traces that the JVM can only provide at safepoints, so each sample is taken when the thread next reaches a poll: method return or loop back-edge. Code between polls is invisible, and its cost lands on the next poll location. async-profiler uses the HotSpot-internal <code>AsyncGetCallTrace</code> from a signal handler (driven by perf events or timers), which can walk the stack at any instruction, plus native and kernel frames from perf. JFR’s execution sampler also suspends threads asynchronously.</p>', lvl: 'deep' },
    { q: 'CPU profile vs wall-clock profile: when do you use which?', a: '<p>CPU when the box is busy and you want to reduce compute: hot methods, regexes, serialisation, hashing. Wall clock when latency is the problem and CPU isn’t: it shows where request threads <i>wait</i> (locks, pools, I/O). Filter wall profiles to the relevant threads, because idle pool threads parked in <code>getTask()</code> otherwise dominate the graph.</p>', lvl: 'core' },
    { q: 'How would you profile a service running in Kubernetes?', a: '<p>JFR needs nothing extra: <code>kubectl exec</code> into the pod, <code>jcmd 1 JFR.start duration=60s filename=/tmp/r.jfr</code>, then <code>kubectl cp</code> the file out. For flame graphs, add async-profiler to the image (or copy it in) and run <code>asprof</code>; in restricted containers use <code>-e itimer</code>. Many teams keep JFR running continuously with a rolling buffer, or use a continuous-profiling agent (e.g. Pyroscope or a vendor agent) built on async-profiler.</p>', lvl: 'deep' },
    { q: 'What is the difference between an allocation profile and a heap dump?', a: '<p>An allocation profile shows <b>where objects are allocated</b> over a period, including short-lived garbage. It explains GC frequency and allocation-driven CPU. A heap dump is a snapshot of <b>live</b> objects and who retains them. It explains memory leaks and high old-gen occupancy. See <a href="leaks-oom.html">Memory leaks & OOM</a>.</p>', lvl: 'core' },
    { q: 'How do you create a custom JFR event?', a: '<p>Extend <code>jdk.jfr.Event</code>, add fields of primitive or String types, annotate with <code>@Name</code>, <code>@Label</code>, <code>@Category</code>. Call <code>begin()</code>, do the work, then <code>commit()</code> (which records duration), or just <code>commit()</code> for an instant event. Use <code>shouldCommit()</code> to skip expensive field computation when the event is disabled or below its threshold. The JIT can remove a disabled event almost entirely.</p>', lvl: 'deep' },
    { q: 'Which JFR events help with concurrency problems?', a: '<ul><li><code>jdk.JavaMonitorEnter</code>, <code>jdk.JavaMonitorWait</code>: contended <code>synchronized</code>.</li><li><code>jdk.ThreadPark</code>: <code>LockSupport.park</code>, so ReentrantLock, queues, pools.</li><li><code>jdk.VirtualThreadPinned</code> (21): virtual threads pinned while blocking.</li><li><code>jdk.SafepointBegin</code> and friends: time-to-safepoint problems.</li><li><code>jdk.ThreadDump</code> (periodic thread dumps, off by default).</li></ul>', lvl: 'deep' },
    { q: 'Why can a microbenchmark mislead you, and what do you use instead?', a: '<p>Without care the JIT eliminates dead code, hoists loop invariants, constant-folds inputs, or measures the interpreter during warm-up. JMH handles warm-up, forking, blackholes and statistics. Even then, a microbenchmark answers “how fast is this method in isolation”; profiling the real service under realistic load answers “does it matter”.</p>', lvl: 'core' }
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
jfr print --events jdk.ThreadPark --stack-depth 8 /tmp/prof.jfr | head -60`, note: 'In containers, write to a mounted volume or <code>/tmp</code> and copy out with <code>kubectl cp</code>.' },
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
}`, note: 'Slow checkouts now appear on the same timeline as GC pauses, lock waits and socket reads in JMC.' }
  ]
});

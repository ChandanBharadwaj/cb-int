IA.register({
  track: 'java',
  slug: 'jit-compilation',
  title: 'JIT compilation',
  tagline: 'HotSpot starts by <b>interpreting</b> bytecode, compiles warm methods with <b>C1</b> while profiling them, then recompiles the hot ones with <b>C2</b> using what the profile says actually happens. Speculation makes Java fast, deoptimization keeps it correct, and both make naive benchmarks lie.',
  tldr: {
    problem: 'Slow first minutes after every deploy, a refactor that quietly halves throughput, NullPointerExceptions with no stack trace, and benchmarks that report 0.3 ns for a logarithm. All are JIT behaviour.',
    model: '<b>Tier 0</b> interpreter (counts calls and loops) → <b>tier 3</b> C1 with profiling (receiver types, branch frequencies) → <b>tier 4</b> C2: inlining, escape analysis, loop optimisations, and speculation guarded by cheap checks. A failed guard triggers <b>deoptimization</b> back to the interpreter and a later recompile.',
    hook: '“Why is my microbenchmark 100× faster than production?” The JIT removed the work: the result was unused (dead-code elimination), the input was constant (folding), or warm-up was never separated from measurement. Use JMH.',
    facts: [
      { v: '200 / 5000', l: 'default <code>Tier3InvocationThreshold</code> and <code>Tier4InvocationThreshold</code>: roughly how many calls before C1 and then C2 kick in (loop back-edges count too)' },
      { v: '35 / 325', l: 'bytes of bytecode: <code>MaxInlineSize</code> (always inline candidates) and <code>FreqInlineSize</code> (hot call sites) on x86-64' },
      { v: '8000', l: 'bytes: <code>HugeMethodLimit</code>. With the default <code>DontCompileHugeMethods</code>, larger methods are never JIT-compiled' }
    ]
  },
  intro: {
    what: 'Java source compiles to <b>bytecode</b>, a portable instruction set. When your program runs, the JVM first executes bytecode with an interpreter, which is slow but starts instantly. It watches which methods run often and compiles those to real machine code <b>while the program runs</b> (“just in time”), using what it has seen to optimise for your actual workload.',
    analogy: { icon: '🗣️', title: 'An interpreter who becomes a translator', text: 'At a conference, a live interpreter translates each sentence as it’s spoken: flexible but slow. For speeches that are given again and again, it’s worth writing a polished translation in advance. The JIT does that for hot methods, and it even tailors the translation to the audience it has seen. If the audience changes, it falls back to live interpretation and writes a new version.' },
    steps: [
      { t: 'Bytecode first', d: 'javac produces bytecode, not machine code. The JVM can run it anywhere.', code: 'javap -c -p Order.class   # see the bytecode' },
      { t: 'Hot code gets compiled', d: 'The JVM counts calls and loop iterations. Warm methods are compiled quickly (C1), very hot ones thoroughly (C2).', code: 'java -XX:+PrintCompilation -jar app.jar | head' },
      { t: 'Optimisations use real behaviour', d: 'If a call site only ever sees one class, C2 inlines that class’s method directly. If an object never leaves a method, it may not be allocated at all.' },
      { t: 'Warm-up is real', d: 'Right after start-up, code is still interpreted or lightly compiled, so the first minutes are slower. Benchmarks and load tests must account for that.' }
    ],
    terms: [
      ['bytecode', 'The JVM’s portable instruction set in <code>.class</code> files.'],
      ['C1 / C2', 'HotSpot’s two JIT compilers: C1 compiles fast with fewer optimisations; C2 optimises hard.'],
      ['inlining', 'Copying a called method’s body into the caller, removing the call and enabling more optimisation.'],
      ['escape analysis', 'Proving an object never leaves a scope, so it can be replaced by local values.'],
      ['deoptimization', 'Throwing away compiled code whose assumptions became false and continuing in the interpreter.'],
      ['warm-up', 'The period after start-up before hot code reaches its optimised form.']
    ]
  },
  visual: {
    title: 'Inside the JIT, one decision at a time',
    caption: 'Pick a scenario and press Play. <b>tiers</b> follows one method from interpreter to C2. <b>inlining & escape analysis</b> removes calls and an allocation. <b>deoptimization</b> shows speculation failing. <b>benchmark traps</b> shows why hand-made timing loops lie.'
  },
  gotchas: [
    { trap: 'Timing code with <code>System.nanoTime()</code> in a loop', why: 'You measure the interpreter and the compiler on the first run, and on later runs the JIT may remove the work you meant to measure (unused results, constant inputs). OSR-compiled loops also optimise differently from normally called methods.', fix: 'Use <b>JMH</b>: warm-up and measurement iterations, forks, <code>@State</code> inputs, and return values or <code>Blackhole</code> to defeat dead-code elimination.' },
    { trap: 'NullPointerException with no stack trace', code: `java.lang.NullPointerException
        (no "at ..." lines at all)`, why: 'After the same implicit exception (NPE, ArithmeticException, ArrayIndexOutOfBounds…) is thrown many times from compiled code, C2 replaces it with a preallocated exception without a stack trace (<code>OmitStackTraceInFastThrow</code>, on by default).', fix: 'Search earlier logs for the first occurrences, which do have traces, or run with <code>-XX:-OmitStackTraceInFastThrow</code>. Then fix the actual null.' },
    { trap: 'Huge methods are never compiled', why: 'Methods over 8000 bytes of bytecode are skipped by default (<code>DontCompileHugeMethods</code>). Generated code (template engines, big switch-based parsers, rule engines) can run interpreted forever, 10–50× slower.', fix: 'Split the method or change the generator. As a stop-gap, <code>-XX:-DontCompileHugeMethods</code>.' },
    { trap: 'Carrying <code>-XX:TieredStopAtLevel=1</code> into production', why: 'It is a popular start-up speed tip for local runs and tests: it stops at C1. In production it means no C2, so peak throughput is often much lower.', fix: 'Keep it in dev-only run configurations. Check production flags with <code>jcmd &lt;pid&gt; VM.flags</code>.' },
    { trap: 'Megamorphic call sites in hot loops', why: 'C2 inlines a virtual call when the profile shows one or two receiver types (or one dominant type). With more, it emits a real virtual or interface call: no inlining, so escape analysis and loop optimisations downstream are lost too.', fix: 'Don’t pre-emptively avoid interfaces; measure first. If a profiler shows a hot megamorphic site, group work by type, or restructure the hot loop around a concrete type.' },
    { trap: 'Tight CPU limits make warm-up last much longer', why: 'JIT compiler threads compete with request threads for the same CPU quota. With a 1-CPU limit, the compile queue drains slowly and the app stays partly interpreted for minutes under load.', fix: 'Give pods more CPU at start-up (requests vs limits, or a higher limit), ramp traffic gradually, warm up before reporting ready, and consider AOT/CDS caches (JDK 24+, Project Leyden) or CRaC where available.' },
    { trap: 'Code cache full', code: `CodeCache is full. Compiler has been disabled.`, why: 'Big applications with many hot methods can fill the code cache (240 MB reserved by default with tiered compilation). After that, new hot methods stay interpreted.', fix: 'Raise <code>-XX:ReservedCodeCacheSize</code>, and monitor <code>jvm.memory.used{id=~"CodeHeap.*"}</code>. Check <code>jcmd &lt;pid&gt; Compiler.codecache</code>.' }
  ],
  scenarios: [
    { title: 'NullPointerExceptions with no stack trace after a day of uptime',
      symptom: 'Error tracking groups thousands of <code>java.lang.NullPointerException</code> events with an empty stack trace and no message. Restarting “fixes” it for a while.',
      diagnose: `# the first occurrences after start-up still have a trace:
grep -m1 -A8 "NullPointerException" app.log
# java.lang.NullPointerException: Cannot invoke "Address.city()" because "c.address" is null
#   at com.acme.ship.Rates.zoneFor(Rates.java:57)`,
      cause: 'Once the NPE became frequent in C2-compiled code, the JIT switched to throwing a preallocated exception without a stack trace or helpful message (<code>OmitStackTraceInFastThrow</code>).',
      fix: 'Fix the null handling found in the first trace. Keep full traces in production if the volume is manageable.',
      fixCode: `JAVA_TOOL_OPTIONS="-XX:-OmitStackTraceInFastThrow"

String zone = Optional.ofNullable(c.address()).map(Address::city).map(zones::of).orElse(Zone.DEFAULT);` },
    { title: 'Every scale-out causes two minutes of timeouts',
      symptom: 'When the autoscaler adds pods during peak traffic, the new pods show p99 of 2–5 s for about two minutes, then settle at 80 ms. Old pods are fine.',
      diagnose: `# on a new pod during the slow period
jcmd 1 Compiler.queue | head        # hundreds of methods waiting for C1/C2
kubectl top pod api-7f9c…           # pinned at the 1-CPU limit (throttled)`,
      cause: 'New pods took full traffic immediately while their hot paths were still interpreted, and the 1-CPU limit starved the JIT compiler threads, so warm-up was slow exactly when load was highest.',
      fix: 'Warm up before reporting ready, ramp traffic to new pods, and give start-up more CPU headroom.',
      fixCode: `@Component
class WarmUp implements ApplicationListener<ApplicationReadyEvent> {
    private final PricingService pricing;
    WarmUp(PricingService pricing) { this.pricing = pricing; }

    public void onApplicationEvent(ApplicationReadyEvent e) {
        AvailabilityChangeEvent.publish(e.getApplicationContext(), ReadinessState.REFUSING_TRAFFIC);
        for (int i = 0; i < 20_000; i++) pricing.quote(SampleData.order(i));   // exercise hot paths
        AvailabilityChangeEvent.publish(e.getApplicationContext(), ReadinessState.ACCEPTING_TRAFFIC);
    }
}` },
    { title: 'A generated rules method runs 30× slower than expected',
      symptom: 'A rules engine that compiles customer rules into one Java method is far slower than a hand-written version of the same logic. A CPU profile shows the frames as <i>interpreted</i>.',
      diagnose: `javap -c -p -classpath gen/ com.acme.rules.Generated | grep -c ""   # ~14,000 lines of bytecode
java -XX:+PrintCompilation … | grep Generated::evaluate            # never appears`,
      cause: 'The generated <code>evaluate</code> method was over 8000 bytes of bytecode, so HotSpot never compiled it (<code>DontCompileHugeMethods</code>).',
      fix: 'Change the generator to emit one small method per rule (each one compiles and inlines well). As a temporary measure, disable the limit.',
      fixCode: `// generated shape: small methods, dispatched from a small loop
boolean evaluate(Ctx c) {
    for (Rule r : rules) if (!r.test(c)) return false;   // each Rule.test is small
    return true;
}
// stop-gap: -XX:-DontCompileHugeMethods` }
  ],
  puzzles: [
    { kind: 'concept', q: 'A hand-written benchmark reports <code>Math.log(i)</code> at 0.3 ns per call after a few runs. What most likely happened?', options: ['The CPU has a hardware log instruction', 'The JIT removed the call because the result was never used', 'The interpreter caches results', 'GC sped up'], answer: 1, explain: '<b>Dead-code elimination</b>: C2 sees the result has no effect and removes the call, so you are timing an empty loop. JMH’s <code>Blackhole.consume</code> (or returning the value from the benchmark method) prevents this.' },
    { kind: 'concept', q: 'What does “made not entrant” mean in <code>-XX:+PrintCompilation</code> output?', options: ['The method was too large to compile', 'The compiled version was invalidated (deoptimized); new calls won’t enter it', 'The method is running in another thread', 'The code cache is full'], answer: 1, explain: 'The compiled code’s assumptions (a type profile, a class hierarchy, a branch that was never taken) were broken. Existing activations are deoptimized to the interpreter; new calls go to the interpreter or to a newer compilation. Frequent deopt/recompile cycles show up as JFR <code>jdk.Deoptimization</code> events.' },
    { kind: 'concept', q: 'In which case can C2’s escape analysis avoid allocating the <code>Point</code>?', options: ['<code>return new Point(x, y);</code> from a method that isn’t inlined', '<code>this.last = new Point(x, y);</code>', '<code>double d = new Point(x, y).distanceTo(origin);</code> where distanceTo is inlined', '<code>list.add(new Point(x, y));</code>'], answer: 2, explain: 'The temporary Point is used only inside the compiled region and passed to an <b>inlined</b> method, so it doesn’t escape: C2 can scalar-replace it (x and y become locals). Returning it from a non-inlined method, storing it in a field, or adding it to a collection all make it escape.' },
    { kind: 'concept', q: 'A hot call site <code>handler.handle(evt)</code> sees four Handler implementations equally often. What does C2 typically do?', options: ['Inlines all four behind type checks', 'Emits a virtual/interface call without inlining', 'Refuses to compile the method', 'Converts it to a switch on class name'], answer: 1, explain: 'HotSpot C2 inlines monomorphic and bimorphic call sites (and a single dominant receiver). With four even types the site is <b>megamorphic</b>: an interface call through the itable, no inlining. That is usually fine, but in a very hot loop it blocks further optimisation.' },
    { kind: 'concept', q: 'Why are the first minutes after a deploy slower, even with warm caches?', options: ['GC hasn’t sized the heap yet', 'Hot paths are still interpreted or C1-compiled; C2 code arrives as profiles mature', 'Class files are re-verified on every call', 'TLS handshakes'], answer: 1, explain: 'Methods climb the tiers as their counters pass thresholds, and C2 waits for a useful profile. Until the hot set reaches tier 4, the service runs slower. Mitigate with warm-up traffic before readiness, gradual rollout, enough CPU for compiler threads, and start-up technologies (CDS/AOT caches, CRaC).' },
    { kind: 'concept', q: 'What is the main purpose of <code>@Fork</code> in JMH?', options: ['To run benchmarks in parallel threads', 'To run each benchmark in fresh JVMs, so profiles and JIT decisions from other benchmarks don’t leak in', 'To fork the Git repository', 'To disable the JIT'], answer: 1, explain: 'In one JVM, the first benchmark can leave call sites monomorphic and the second one finds them polluted (now bi- or megamorphic), so results depend on order. Forking gives each benchmark a clean JVM, and several forks show run-to-run variance.' },
    { kind: 'concept', q: 'The log says <code>CodeCache is full. Compiler has been disabled.</code> What happens next?', options: ['The JVM crashes with OutOfMemoryError', 'Already compiled code keeps running; new hot methods stay interpreted (until space is freed)', 'All code is deoptimized', 'The JVM switches to AOT mode'], answer: 1, explain: 'It is not fatal. Existing compiled methods keep running, but no new compilation happens, so newly hot code stays slow. If space is freed later (unloaded or invalidated code), compilation can resume. Raise <code>ReservedCodeCacheSize</code> and monitor CodeHeap usage.' }
  ],
  interview: [
    { q: 'Explain tiered compilation in HotSpot.', a: '<p>Five levels: <b>0</b> interpreter; <b>1</b> C1 without profiling (trivial methods); <b>2</b> C1 with light profiling; <b>3</b> C1 with full profiling; <b>4</b> C2. The normal path is 0 → 3 → 4: start fast, collect a profile in quick-to-produce C1 code, then let C2 optimise with that profile. Tier 2 is used when the C2 queue is long. On by default since JDK 8.</p>', lvl: 'core' },
    { q: 'What optimisations does C2 do?', a: '<ul><li><b>Inlining</b> (based on size and call frequency), the enabler for everything else.</li><li><b>Escape analysis</b>: scalar replacement and lock elision.</li><li>Loop optimisations: unrolling, range-check elimination, invariant hoisting, auto-vectorisation (SIMD).</li><li>Speculation from profiles: type guards for inlined virtual calls, pruning never-taken branches, null-check elimination.</li><li>Intrinsics for hot JDK methods (<code>System.arraycopy</code>, <code>String</code> ops, crypto, <code>Math</code>).</li></ul>', lvl: 'deep' },
    { q: 'What is deoptimization, and what triggers it?', a: '<p>Replacing a compiled frame with equivalent interpreter frames when an assumption baked into the code no longer holds. Triggers: a type guard fails (new receiver class), an “uncommon trap” branch is taken, class hierarchy analysis is invalidated by loading a new subclass of a class assumed to have none, or code is unloaded or redefined. Execution stays correct; performance dips until recompilation.</p>', lvl: 'deep' },
    { q: 'What is escape analysis, and what are its limits?', a: '<p>C2 analyses whether an object can be seen outside the compiled region. If not (NoEscape), it can replace the object with its fields in registers (scalar replacement) and remove locks on it. Limits: it works only inside the inlined region, so any call that isn’t inlined makes arguments escape; objects that are merged at control flow joins or are too large (big arrays) aren’t replaced. The JVM doesn’t do stack allocation as such.</p>', lvl: 'deep' },
    { q: 'What is OSR?', a: '<p>On-stack replacement: when a method is invoked once but runs a long loop (back-edge counter overflow), the JVM compiles a special version entered in the middle of the loop and transfers the running frame into it. In <code>PrintCompilation</code> output OSR compilations are marked with <code>%</code>. OSR code is sometimes less optimised, one more reason a single big timing loop is a bad benchmark.</p>', lvl: 'deep' },
    { q: 'How does monomorphic/bimorphic/megamorphic inlining work?', a: '<p>The tier-3 profile records receiver classes per virtual call site. With one class, C2 inlines that implementation behind a cheap class check (monomorphic); with two, both behind checks (bimorphic); with more, it can still inline a dominant one (~90%), otherwise it emits a vtable/itable dispatch. If class hierarchy analysis shows only one implementation is loaded, C2 can inline without a guard and register a dependency that deoptimizes on a new subclass.</p>', lvl: 'deep' },
    { q: 'How do you write a trustworthy microbenchmark?', a: '<ul><li>Use JMH. Annotate with <code>@Benchmark</code>, use <code>@Warmup</code>, <code>@Measurement</code> and <code>@Fork</code> (≥ 2).</li><li>Take inputs from <code>@State</code> fields, not constants (avoids folding).</li><li>Return results or pass them to a <code>Blackhole</code> (avoids dead-code elimination).</li><li>Pick the right mode (<code>AverageTime</code>, <code>Throughput</code>, <code>SampleTime</code>) and report error bars.</li><li>Run on quiet, production-like hardware; then confirm with a profiler on a real workload.</li></ul>', lvl: 'core' },
    { q: 'How would you see what the JIT is doing in a running service?', a: '<p><code>jcmd &lt;pid&gt; Compiler.queue</code> and <code>Compiler.codecache</code>; <code>-XX:+PrintCompilation</code> for a stream of compile events; <code>-XX:+UnlockDiagnosticVMOptions -XX:+PrintInlining</code> for inlining decisions; JFR events (<code>jdk.Compilation</code>, <code>jdk.Deoptimization</code>, <code>jdk.CodeCacheFull</code>); JITWatch to visualise logs from <code>-XX:+LogCompilation</code>. async-profiler shows interpreted vs compiled frames.</p>', lvl: 'deep' },
    { q: 'Does the JIT ever change what a correct program prints?', a: '<p>No. Optimisations must preserve Java semantics, including the Java Memory Model. What they can do is expose bugs that were already there: a data race that “worked” in the interpreter (e.g. a non-volatile stop flag) can loop forever once C2 hoists the read out of the loop. That is a bug in the program, not in the JIT. Floating point has been strict everywhere since Java 17 (JEP 306).</p>', lvl: 'core' },
    { q: 'What options exist to reduce warm-up time?', a: '<ul><li>Warm-up traffic before the readiness probe passes; gradual traffic ramp-up.</li><li>Enough CPU for compiler threads during start-up.</li><li>Class Data Sharing / AppCDS archives (start-up), and AOT caches with ahead-of-time class loading and profiles (JDK 24+, Project Leyden).</li><li>CRaC checkpoint/restore (in some distributions) or GraalVM Native Image, which trade peak throughput or flexibility for instant start.</li></ul>', lvl: 'core' }
  ],
  code: [
    { title: 'A JMH benchmark that measures something', lang: 'java', code: `@State(Scope.Thread)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.NANOSECONDS)
@Warmup(iterations = 5, time = 1)
@Measurement(iterations = 5, time = 1)
@Fork(2)
public class ParseBench {
    String input;                                  // from state: not a compile-time constant
    @Setup public void setup() { input = "2026-11-22T10:15:30Z"; }

    @Benchmark public Instant parse() {            // returned → can't be eliminated
        return Instant.parse(input);
    }
    @Benchmark public void parseTwo(Blackhole bh) {
        bh.consume(Instant.parse(input));
        bh.consume(OffsetDateTime.parse(input));
    }
}
// run: mvn package && java -jar target/benchmarks.jar ParseBench -prof gc`, note: '<code>-prof gc</code> adds allocation per operation, often more telling than the time.' },
    { title: 'JIT diagnostics', lang: 'bash', code: `# what gets compiled, at which tier ("%" = OSR, "made not entrant" = deoptimized)
java -XX:+PrintCompilation -jar app.jar

# why something was or wasn't inlined
java -XX:+UnlockDiagnosticVMOptions -XX:+PrintInlining -jar app.jar

# on a live JVM
jcmd <pid> Compiler.queue
jcmd <pid> Compiler.codecache
jcmd <pid> VM.flags | tr ' ' '\\n' | grep -E 'Tiered|CodeCache|OmitStackTrace'

# record compilation and deopt events
jcmd <pid> JFR.start duration=60s filename=/tmp/jit.jfr settings=profile`, note: 'For deep dives, <code>-XX:+UnlockDiagnosticVMOptions -XX:+LogCompilation</code> plus JITWatch shows inlining trees and assembly.' },
    { title: 'Readiness after warm-up (Spring Boot)', lang: 'yaml', code: `# application.yml: expose liveness/readiness groups for Kubernetes probes
management:
  endpoint.health.probes.enabled: true
  health.readinessstate.enabled: true

# deployment.yaml (excerpt)
readinessProbe:
  httpGet: { path: /actuator/health/readiness, port: 8080 }
  periodSeconds: 5
resources:
  requests: { cpu: "2" }      # headroom for C1/C2 threads during warm-up
  limits:   { cpu: "4" }`, note: 'Pair this with the <code>WarmUp</code> listener from the scenario above, which holds readiness at REFUSING_TRAFFIC until hot paths have run.' }
  ]
});

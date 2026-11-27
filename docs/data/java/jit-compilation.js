IA.register({
  track: 'java',
  slug: 'jit-compilation',
  title: 'JIT compilation',
  tagline: 'HotSpot first <b>interprets</b> bytecode. Warm methods get compiled by <b>C1</b>, which also records how they run. Hot methods get recompiled by <b>C2</b>, tuned to what really happens. Guessing (speculation) makes Java fast. Undoing bad guesses (deoptimization) keeps it correct. Both make naive benchmarks lie.',
  tldr: {
    problem: 'Every deploy starts slow. A refactor halves throughput. NullPointerExceptions show no stack trace. A benchmark says a logarithm takes 0.3 ns. The JIT causes all of these.',
    model: '<b>Tier 0</b> is the interpreter. It counts calls and loops. <b>Tier 3</b> is C1, which records types and branches (a <i>profile</i>). <b>Tier 4</b> is C2. It inlines, removes allocations, speeds up loops, and makes guesses guarded by cheap checks. If a check fails, the code drops back to the interpreter (<b>deoptimization</b>) and recompiles later.',
    hook: '“Why is my microbenchmark 100× faster than production?” The JIT removed the work. The result was unused, the input was constant, or warm-up was mixed into the measurement. Use JMH.',
    facts: [
      { v: '200 / 5000', l: 'default <code>Tier3InvocationThreshold</code> and <code>Tier4InvocationThreshold</code>: about how many calls before C1, then C2, kick in (loop iterations count too)' },
      { v: '35 / 325', l: 'bytes of bytecode: <code>MaxInlineSize</code> (always inlined) and <code>FreqInlineSize</code> (hot call sites) on x86-64' },
      { v: '8000', l: 'bytes: <code>HugeMethodLimit</code>. By default, bigger methods are never JIT-compiled' }
    ]
  },
  intro: {
    what: 'Java source compiles to <b>bytecode</b>, a portable instruction set. At first the JVM runs bytecode with an interpreter. It is slow but starts at once. The JVM watches which methods run often. It compiles those to machine code <b>while the program runs</b> (“just in time”). It uses what it saw to optimize for your real workload.',
    analogy: { icon: '🗣️', title: 'An interpreter who becomes a translator', text: 'A live interpreter at a conference translates each sentence as it’s spoken. Flexible, but slow. For speeches given again and again, a polished written translation pays off. The JIT does that for hot methods, tailored to the audience it has seen. If the audience changes, it goes back to live translation and writes a new version.' },
    steps: [
      { t: 'Bytecode first', d: 'javac makes bytecode, not machine code. The JVM can run it anywhere.', code: 'javap -c -p Order.class   # see the bytecode' },
      { t: 'Hot code gets compiled', d: 'The JVM counts calls and loop runs. It compiles warm methods quickly (C1) and very hot ones thoroughly (C2).', code: 'java -XX:+PrintCompilation -jar app.jar | head' },
      { t: 'Optimisations use real behaviour', d: 'If a call only ever sees one class, C2 pastes that class’s method in directly. If an object never leaves a method, it may never be allocated.' },
      { t: 'Warm-up is real', d: 'Right after start-up, code is still interpreted or lightly compiled. So the first minutes are slower. Benchmarks and load tests must allow for that.' }
    ],
    terms: [
      ['bytecode', 'The JVM’s portable instruction set in <code>.class</code> files.'],
      ['C1 / C2', 'HotSpot’s two JIT compilers. C1 compiles fast with fewer optimizations. C2 optimizes hard.'],
      ['inlining', 'Copying a called method’s body into the caller (<i>inlining</i>). The call disappears, and more optimization becomes possible.'],
      ['escape analysis', 'Proving an object never leaves a scope (<i>escape analysis</i>). The JIT can then replace it with local values.'],
      ['deoptimization', 'Throwing away compiled code whose guesses became wrong, and carrying on in the interpreter.'],
      ['warm-up', 'The time after start-up before hot code is fully optimized (<i>warm-up</i>).']
    ]
  },
  visual: {
    title: 'Inside the JIT, one decision at a time',
    caption: 'Pick a scenario and press Play. <b>tiers</b> follows one method from interpreter to C2. <b>inlining & escape analysis</b> removes calls and an allocation. <b>deoptimization</b> shows a guess failing. <b>benchmark traps</b> shows why hand-made timing loops lie.'
  },
  gotchas: [
    { trap: 'Timing code with <code>System.nanoTime()</code> in a loop', why: 'The first run measures the interpreter and the compiler. Later runs may measure nothing: the JIT can remove work whose result is unused or whose input is constant. Long loops compiled mid-run also optimize differently.', fix: 'Use <b>JMH</b>. It gives warm-up and measurement rounds, forks and <code>@State</code> inputs. Return values or use <code>Blackhole</code> so the JIT can’t remove the work.' },
    { trap: 'NullPointerException with no stack trace', code: `java.lang.NullPointerException
        (no "at ..." lines at all)`, why: 'When compiled code throws the same built-in exception (NPE, ArithmeticException…) many times, C2 swaps in a ready-made exception with no stack trace. This is <code>OmitStackTraceInFastThrow</code>, on by default.', fix: 'Search earlier logs for the first occurrences. Those have traces. Or run with <code>-XX:-OmitStackTraceInFastThrow</code>. Then fix the real null.' },
    { trap: 'Huge methods are never compiled', why: 'By default, methods over 8000 bytes of bytecode are skipped. Generated code (templates, big parsers, rule engines) can stay interpreted forever, 10–50× slower.', fix: 'Split the method or change the generator. As a stop-gap, use <code>-XX:-DontCompileHugeMethods</code>.' },
    { trap: 'Carrying <code>-XX:TieredStopAtLevel=1</code> into production', why: 'It’s a popular tip for faster local start-up. It stops at C1. In production that means no C2, so peak throughput is often much lower.', fix: 'Keep it in dev-only run configs. Check production flags with <code>jcmd &lt;pid&gt; VM.flags</code>.' },
    { trap: 'Megamorphic call sites in hot loops', why: 'C2 inlines a virtual call when it has seen one or two classes there (or one dominant one). With more, it makes a real virtual call. No inlining means the later optimizations are lost too. Such a call site is <i>megamorphic</i>.', fix: 'Don’t avoid interfaces up front. Measure first. If a profiler shows a hot megamorphic call, group work by type or rework the loop around one concrete type.' },
    { trap: 'Tight CPU limits make warm-up last much longer', why: 'JIT threads share the CPU quota with request threads. With a 1-CPU limit, compiling drains slowly. The app stays partly interpreted for minutes under load.', fix: 'Give pods more CPU at start-up. Ramp traffic slowly and warm up before reporting ready. Consider AOT/CDS caches (JDK 24+) or CRaC where available.' },
    { trap: 'Code cache full', code: `CodeCache is full. Compiler has been disabled.`, why: 'Big apps with many hot methods can fill the code cache (240 MB by default). After that, new hot methods stay interpreted.', fix: 'Raise <code>-XX:ReservedCodeCacheSize</code> and watch <code>jvm.memory.used{id=~"CodeHeap.*"}</code>. Check <code>jcmd &lt;pid&gt; Compiler.codecache</code>.' }
  ],
  scenarios: [
    { title: 'NullPointerExceptions with no stack trace after a day of uptime',
      symptom: 'Error tracking shows thousands of <code>java.lang.NullPointerException</code> events with no stack trace and no message. A restart “fixes” it for a while.',
      diagnose: `# the first occurrences after start-up still have a trace:
grep -m1 -A8 "NullPointerException" app.log
# java.lang.NullPointerException: Cannot invoke "Address.city()" because "c.address" is null
#   at com.acme.ship.Rates.zoneFor(Rates.java:57)`,
      cause: 'Once the NPE became frequent in C2 code, the JIT switched to a ready-made exception. It has no stack trace and no helpful message.',
      fix: 'Fix the null handling shown in the first trace. Keep full traces in production if the volume allows.',
      fixCode: `JAVA_TOOL_OPTIONS="-XX:-OmitStackTraceInFastThrow"

String zone = Optional.ofNullable(c.address()).map(Address::city).map(zones::of).orElse(Zone.DEFAULT);` },
    { title: 'Every scale-out causes two minutes of timeouts',
      symptom: 'When the autoscaler adds pods at peak, new pods show p99 of 2–5 s for about two minutes. Then they settle at 80 ms. Old pods are fine.',
      diagnose: `# on a new pod during the slow period
jcmd 1 Compiler.queue | head        # hundreds of methods waiting for C1/C2
kubectl top pod api-7f9c…           # pinned at the 1-CPU limit (throttled)`,
      cause: 'New pods took full traffic while their hot paths were still interpreted. The 1-CPU limit starved the JIT threads. So warm-up was slow right when load was highest.',
      fix: 'Warm up before reporting ready. Ramp traffic to new pods. Give start-up more CPU.',
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
      symptom: 'A rules engine compiles customer rules into one Java method. It runs far slower than hand-written code. A CPU profile shows the frames as <i>interpreted</i>.',
      diagnose: `javap -c -p -classpath gen/ com.acme.rules.Generated | grep -c ""   # ~14,000 lines of bytecode
java -XX:+PrintCompilation … | grep Generated::evaluate            # never appears`,
      cause: 'The generated <code>evaluate</code> method was over 8000 bytes of bytecode. HotSpot never compiled it.',
      fix: 'Make the generator emit one small method per rule. Each one compiles and inlines well. As a stop-gap, turn off the limit.',
      fixCode: `// generated shape: small methods, dispatched from a small loop
boolean evaluate(Ctx c) {
    for (Rule r : rules) if (!r.test(c)) return false;   // each Rule.test is small
    return true;
}
// stop-gap: -XX:-DontCompileHugeMethods` }
  ],
  puzzles: [
    { kind: 'concept', q: 'A hand-written benchmark reports <code>Math.log(i)</code> at 0.3 ns per call after a few runs. What most likely happened?', options: ['The CPU has a hardware log instruction', 'The JIT removed the call because the result was never used', 'The interpreter caches results', 'GC sped up'], answer: 1, explain: 'C2 sees the result is never used and removes the call (<b>dead-code elimination</b>). You are timing an empty loop. JMH’s <code>Blackhole.consume</code>, or returning the value, prevents this.' },
    { kind: 'concept', q: 'What does “made not entrant” mean in <code>-XX:+PrintCompilation</code> output?', options: ['The method was too large to compile', 'The compiled version was invalidated (deoptimized); new calls won’t enter it', 'The method is running in another thread', 'The code cache is full'], answer: 1, explain: 'The compiled code’s guesses broke: a type, a class hierarchy, a branch that never ran. Running calls fall back to the interpreter. New calls go to the interpreter or a newer compile. Frequent cycles show up as JFR <code>jdk.Deoptimization</code> events.' },
    { kind: 'concept', q: 'In which case can C2’s escape analysis avoid allocating the <code>Point</code>?', options: ['<code>return new Point(x, y);</code> from a method that isn’t inlined', '<code>this.last = new Point(x, y);</code>', '<code>double d = new Point(x, y).distanceTo(origin);</code> where distanceTo is inlined', '<code>list.add(new Point(x, y));</code>'], answer: 2, explain: 'The temporary Point stays inside the compiled code and goes only to an <b>inlined</b> method. It doesn’t escape, so C2 can replace it with two locals, x and y. Returning it from a non-inlined method, storing it in a field, or adding it to a list all make it escape.' },
    { kind: 'concept', q: 'A hot call site <code>handler.handle(evt)</code> sees four Handler implementations equally often. What does C2 typically do?', options: ['Inlines all four behind type checks', 'Emits a virtual/interface call without inlining', 'Refuses to compile the method', 'Converts it to a switch on class name'], answer: 1, explain: 'C2 inlines call sites that see one or two classes (or one dominant class). With four equal types the site is <b>megamorphic</b>. C2 makes a normal interface call with no inlining. That’s usually fine. In a very hot loop it blocks further optimization.' },
    { kind: 'concept', q: 'Why are the first minutes after a deploy slower, even with warm caches?', options: ['GC hasn’t sized the heap yet', 'Hot paths are still interpreted or C1-compiled; C2 code arrives as profiles mature', 'Class files are re-verified on every call', 'TLS handshakes'], answer: 1, explain: 'Methods climb the tiers as their counters pass thresholds. C2 waits for a useful profile. Until hot code reaches tier 4, the service is slower. Help it with warm-up traffic, gradual rollout, enough CPU for the compiler, and start-up tools (CDS/AOT caches, CRaC).' },
    { kind: 'concept', q: 'What is the main purpose of <code>@Fork</code> in JMH?', options: ['To run benchmarks in parallel threads', 'To run each benchmark in fresh JVMs, so profiles and JIT decisions from other benchmarks don’t leak in', 'To fork the Git repository', 'To disable the JIT'], answer: 1, explain: 'In one JVM, the first benchmark may see one class per call site. The second finds several, so results depend on order. Forking gives each benchmark a clean JVM. Several forks show run-to-run variation.' },
    { kind: 'concept', q: 'The log says <code>CodeCache is full. Compiler has been disabled.</code> What happens next?', options: ['The JVM crashes with OutOfMemoryError', 'Already compiled code keeps running; new hot methods stay interpreted (until space is freed)', 'All code is deoptimized', 'The JVM switches to AOT mode'], answer: 1, explain: 'It is not fatal. Compiled methods keep running. But nothing new gets compiled, so newly hot code stays slow. If space frees up later, compiling resumes. Raise <code>ReservedCodeCacheSize</code> and watch CodeHeap usage.' }
  ],
  interview: [
    { q: 'Explain tiered compilation in HotSpot.', a: '<p>Five levels. <b>0</b> is the interpreter. <b>1</b> is C1 without profiling, for trivial methods. <b>2</b> is C1 with light profiling. <b>3</b> is C1 with full profiling. <b>4</b> is C2. The usual path is 0 → 3 → 4. Start fast, record a profile in quick C1 code, then let C2 optimize with it. Tier 2 is used when C2 is busy. On by default since JDK 8.</p>', lvl: 'core' },
    { q: 'What optimisations does C2 do?', a: '<ul><li><b>Inlining</b>, based on size and call frequency. It enables everything else.</li><li><b>Escape analysis</b>: replace objects with locals, remove their locks.</li><li>Loop work: unrolling, removing bounds checks, moving fixed work out of loops, SIMD.</li><li>Guesses from profiles: type checks for inlined calls, dropping branches that never run, removing null checks.</li><li>Hand-tuned versions of hot JDK methods (<code>System.arraycopy</code>, <code>String</code> ops, crypto, <code>Math</code>).</li></ul>', lvl: 'deep' },
    { q: 'What is deoptimization, and what triggers it?', a: '<p>Swapping compiled code for the interpreter when a guess built into it stops being true. Causes: a new class shows up at a call, a “never taken” branch runs, a new subclass loads, or code is unloaded or redefined. The program stays correct. Speed dips until it recompiles.</p>', lvl: 'deep' },
    { q: 'What is escape analysis, and what are its limits?', a: '<p>C2 checks whether an object can be seen outside the compiled code. If not, it can keep the fields in registers and remove locks on the object. It only works inside inlined code. Any call that isn’t inlined makes its arguments escape. Objects merged across branches or too big (large arrays) aren’t replaced. The JVM doesn’t allocate objects on the stack as such.</p>', lvl: 'deep' },
    { q: 'What is OSR?', a: '<p>On-stack replacement. A method called once may run a long loop. The JVM compiles a version that starts mid-loop and moves the running frame into it. <code>PrintCompilation</code> marks these with <code>%</code>. This code is sometimes less optimized. One more reason a single big timing loop is a bad benchmark.</p>', lvl: 'deep' },
    { q: 'How does monomorphic/bimorphic/megamorphic inlining work?', a: '<p>Tier 3 records which classes reach each virtual call. With one class, C2 inlines it behind a cheap class check (monomorphic). With two, it inlines both (bimorphic). With more, it may inline a dominant one (~90%). Otherwise it makes a normal virtual call. If only one implementation is loaded, C2 inlines without a check. It deoptimizes if a new subclass appears.</p>', lvl: 'deep' },
    { q: 'How do you write a trustworthy microbenchmark?', a: '<ul><li>Use JMH with <code>@Benchmark</code>, <code>@Warmup</code>, <code>@Measurement</code> and <code>@Fork</code> (≥ 2).</li><li>Take inputs from <code>@State</code> fields, not constants, so the JIT can’t fold them.</li><li>Return results or pass them to a <code>Blackhole</code>, so the JIT can’t remove them.</li><li>Pick the right mode (<code>AverageTime</code>, <code>Throughput</code>, <code>SampleTime</code>) and report error bars.</li><li>Run on quiet, production-like hardware. Then confirm with a profiler on real load.</li></ul>', lvl: 'core' },
    { q: 'How would you see what the JIT is doing in a running service?', a: '<p>Use <code>jcmd &lt;pid&gt; Compiler.queue</code> and <code>Compiler.codecache</code>. <code>-XX:+PrintCompilation</code> streams compile events. <code>-XX:+UnlockDiagnosticVMOptions -XX:+PrintInlining</code> shows inlining choices. JFR has <code>jdk.Compilation</code>, <code>jdk.Deoptimization</code> and <code>jdk.CodeCacheFull</code> events. JITWatch visualizes <code>-XX:+LogCompilation</code> logs. async-profiler shows interpreted vs compiled frames.</p>', lvl: 'deep' },
    { q: 'Does the JIT ever change what a correct program prints?', a: '<p>No. Optimizations must keep Java’s rules, including the memory model. But they can expose bugs that were already there. A race that “worked” in the interpreter, like a non-volatile stop flag, can loop forever once C2 moves the read out of the loop. That’s a bug in the program, not the JIT. Floating point has been strict everywhere since Java 17.</p>', lvl: 'core' },
    { q: 'What options exist to reduce warm-up time?', a: '<ul><li>Send warm-up traffic before the readiness probe passes. Ramp traffic gradually.</li><li>Give compiler threads enough CPU at start-up.</li><li>Use Class Data Sharing / AppCDS archives, or AOT caches with loaded classes and profiles (JDK 24+).</li><li>CRaC checkpoint/restore or GraalVM Native Image start instantly, but give up some peak speed or flexibility.</li></ul>', lvl: 'core' }
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
// run: mvn package && java -jar target/benchmarks.jar ParseBench -prof gc`, note: '<code>-prof gc</code> adds allocation per operation. That often tells you more than the time.' },
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
  limits:   { cpu: "4" }`, note: 'Pair this with the <code>WarmUp</code> listener above. It keeps readiness at REFUSING_TRAFFIC until hot paths have run.' }
  ]
});

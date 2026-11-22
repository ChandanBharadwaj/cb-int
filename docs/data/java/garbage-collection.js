IA.register({
  track: 'java',
  slug: 'garbage-collection',
  title: 'Garbage collection',
  tagline: 'The GC keeps whatever is <b>reachable from roots</b> and reclaims the rest. Collectors differ in <i>when</i> they stop your threads: Parallel for throughput, G1 (the default) for balance, ZGC for sub-millisecond pauses. Most “GC problems” are really live-set or allocation-rate problems that a GC log reveals in minutes.',
  tldr: {
    problem: 'Latency spikes, CPU burned in GC threads, multi-second Full GCs and “GC overhead limit exceeded”. Teams often reach for dozens of flags when the real cause is a growing live set or a burst of huge allocations.',
    model: 'Tracing GCs mark from <b>roots</b> (stack frames, statics, threads, JNI) and reclaim everything unmarked. Generational GCs collect the young space often and cheaply (copy survivors) and the old space rarely. <b>G1</b> does this with regions and concurrent marking, then evacuates the regions with the most garbage first. <b>ZGC</b> does even compaction concurrently.',
    hook: '“How do you tune G1?” Set the heap size, maybe the pause goal, and stop. Then read the log: if <b>after-GC</b> usage keeps rising, it’s a leak; if pauses are long, check humongous allocations and allocation rate before touching flags.',
    facts: [
      { v: 'JDK 9', l: 'G1 became the default collector (JEP 248) on server-class machines. With fewer than 2 CPUs or less than ~1.8 GB of memory, the JVM still picks Serial' },
      { v: '< 1 ms', l: 'ZGC’s typical pause target, independent of heap size. Generational ZGC arrived in JDK 21 (JEP 439, <code>-XX:+ZGenerational</code>) and is the default ZGC mode from JDK 23' },
      { v: '200 ms', l: 'G1’s default <code>MaxGCPauseMillis</code>, a goal it adapts young-generation size to meet, not a guarantee' }
    ]
  },
  intro: {
    what: 'In Java you create objects with <code>new</code> but never free them. The <b>garbage collector</b> does that: it periodically finds objects your program can no longer reach and reuses their memory. While it works, it may briefly pause your threads. Different collectors make different trade-offs between those pauses, total CPU and memory use.',
    analogy: { icon: '🧹', title: 'Cleaning a library while it’s open', text: 'Any book that can be reached from the catalogue (the roots) stays; anything not in the catalogue goes to recycling. A simple cleaner closes the library to do it (stop-the-world). A smarter one cleans the busiest new-arrivals shelf often and quickly (young GC). The smartest cleans while readers are inside, only closing the doors for a moment (concurrent GC).' },
    steps: [
      { t: 'Reachable = alive', d: 'An object stays as long as there is a chain of references to it from a <b>root</b>: a local variable in a running method, a static field, a running thread.' },
      { t: 'Most objects die young', d: 'So the heap is split into a young part, collected often and cheaply, and an old part for long-lived data.' },
      { t: 'Collectors trade pauses vs CPU', d: 'Parallel: longest pauses, best throughput. G1: short pauses, the default. ZGC: almost no pauses, more CPU.', code: 'java -XX:+UseZGC -XX:+ZGenerational -Xmx8g -jar app.jar   # JDK 21' },
      { t: 'Read the log first', d: 'Turn on GC logging in every environment. It is cheap and answers most questions.', code: 'java -Xlog:gc*:file=gc.log:time,uptime,level,tags -jar app.jar' }
    ],
    terms: [
      ['GC root', 'A reference the GC always treats as live: stack locals, statics, threads, JNI handles.'],
      ['stop-the-world (STW)', 'A pause where all application threads are halted at a safepoint.'],
      ['live set', 'The memory used by reachable objects. After-GC heap usage approximates it.'],
      ['promotion', 'Moving an object that survived several young GCs into the old generation.'],
      ['allocation rate', 'MB/s of new objects. Drives how often young GCs run.'],
      ['throughput', 'Share of time spent running your code rather than GC.']
    ]
  },
  visual: {
    title: 'From roots to regions to pause profiles',
    caption: 'Pick a scenario and press Play. <b>reachability</b> marks a small object graph. <b>G1 regions</b> runs a full G1 cycle on a 40-region heap. <b>Parallel vs G1 vs ZGC</b> compares pause profiles. <b>reading a GC log</b> decodes real-format lines.'
  },
  gotchas: [
    { trap: 'Calling <code>System.gc()</code>', why: 'It requests a full, stop-the-world collection with G1 and Parallel (multi-second on large heaps). Libraries sometimes call it too: old RMI distributed GC, some direct-buffer paths.', fix: 'Don’t call it. If a library does, consider <code>-XX:+ExplicitGCInvokesConcurrent</code> (G1) rather than <code>-XX:+DisableExplicitGC</code>, which can break direct-buffer reclamation.' },
    { trap: 'Fixing the young generation size under G1', code: `-XX:+UseG1GC -Xmn2g          # or -XX:NewRatio=…`, why: 'G1 meets its pause goal by resizing the young generation every cycle. A fixed young size disables that, so the pause goal is effectively ignored.', fix: 'With G1, set <code>-Xmx</code> (and optionally <code>MaxGCPauseMillis</code>) and leave generation sizes alone.' },
    { trap: 'An overly aggressive pause goal', why: '<code>-XX:MaxGCPauseMillis=10</code> makes G1 shrink eden, so young GCs run much more often and total GC CPU rises, while pauses may not get much shorter (copying live data still takes what it takes).', fix: 'Keep the default 200 ms or something realistic (50–100 ms). If you truly need single-digit milliseconds, switch to ZGC.' },
    { trap: 'Big short-lived arrays in G1 (humongous objects)', why: 'An allocation of at least half a region goes directly into contiguous old regions. A stream of them (large JSON or report <code>byte[]</code>s) fragments the heap, triggers extra concurrent cycles and can end in Full GCs.', fix: 'Stream instead of buffering whole payloads; check logs for <code>G1 Humongous Allocation</code>; consider <code>-XX:G1HeapRegionSize=16m</code> or <code>32m</code> so those objects aren’t humongous.' },
    { trap: 'Relying on finalize()', why: 'Finalization is deprecated for removal (JEP 421, Java 18). Finalizable objects need at least two GC cycles to be reclaimed, run on one finalizer thread in no guaranteed order, and can resurrect objects.', fix: 'Use try-with-resources for deterministic cleanup, and <code>java.lang.ref.Cleaner</code> only as a safety net.' },
    { trap: 'SoftReference caches', why: 'Soft references are cleared based on free heap and time since last access (<code>SoftRefLRUPolicyMSPerMB</code>), often all at once under memory pressure, which makes the cache hit rate collapse exactly when load is highest.', fix: 'Use a size-bounded cache (Caffeine, <code>maximumSize</code>/<code>maximumWeight</code>) instead of soft values.' },
    { trap: 'Tiny containers silently use SerialGC', why: 'With fewer than 2 visible CPUs or less than ~1.8 GB of memory, the JVM doesn’t consider the machine “server class” and picks Serial: single-threaded, stop-the-world collections.', fix: 'Choose explicitly (<code>-XX:+UseG1GC</code>), and give latency-sensitive services at least 2 CPUs. Check with <code>java -Xlog:gc -version</code> in the image.' }
  ],
  scenarios: [
    { title: 'p99 latency spikes to 3 s a few times an hour',
      symptom: 'A report-export API has a normal p50 of 40 ms but p99 spikes of 2–3 s. CPU is fine; the spikes line up across all endpoints of the instance.',
      diagnose: `grep -E "Humongous|Pause Full" gc.log | tail -5
# GC(812) Pause Young (Concurrent Start) (G1 Humongous Allocation) 3100M->2950M(4096M) 21ms
# GC(815) Pause Full (G1 Compaction Pause) 4090M->1800M(4096M) 2870ms`,
      cause: 'Each export built the whole CSV in memory as one 30–60 MB <code>byte[]</code>. With 2 MB regions those were humongous objects, which fragmented old space until G1 couldn’t find free regions to evacuate into, and fell back to Full GCs.',
      fix: 'Stream the export to the response, and raise the region size so moderate buffers aren’t humongous.',
      fixCode: `@GetMapping(value = "/export", produces = "text/csv")
StreamingResponseBody export() {
    return out -> repo.streamAll().forEach(r -> writeCsvLine(out, r));   // no giant byte[]
}
// JVM: -XX:G1HeapRegionSize=16m` },
    { title: 'GC CPU at 40% and climbing until “GC overhead limit exceeded”',
      symptom: 'Throughput falls over several hours; young GCs become frequent and mixed GCs reclaim little. Eventually <code>OutOfMemoryError: GC overhead limit exceeded</code> (Parallel) or back-to-back Full GCs (G1).',
      diagnose: `# after-GC heap usage, one value per young GC: it only goes up
grep "Pause Young" gc.log | sed -E 's/.*->([0-9]+M).*/\\1/' | awk 'NR % 50 == 1'
# 410M 690M 980M 1270M 1560M 1830M …`,
      cause: 'The live set is growing: something accumulates objects (an unbounded cache, a listener list, a static map). The GC is working correctly; it just can’t free memory that is still reachable.',
      fix: 'Take a heap dump and find the dominator. Don’t add heap or tune the GC first. See <a href="leaks-oom.html">Memory leaks & OOM</a>.',
      fixCode: `jcmd <pid> GC.heap_dump /tmp/app.hprof
# open in Eclipse MAT → Leak Suspects / Dominator Tree` },
    { title: 'Switched to ZGC for latency, then requests stalled',
      symptom: 'After moving a service from G1 to ZGC with the same 4 GB heap, average CPU went up and some requests stalled for tens of milliseconds during traffic peaks.',
      diagnose: `grep -i "allocation stall" gc.log | head -3
# [gc] Allocation Stall (http-nio-8080-exec-7) 38.214ms`,
      cause: 'ZGC collects concurrently, so it needs <b>headroom</b>: if threads allocate faster than a cycle can free memory, they are stalled until it does. The heap was sized for G1’s live set with little margin, and non-generational ZGC (the JDK 21 default mode) had to mark the whole heap every cycle.',
      fix: 'Enable generational ZGC, give it more heap headroom, and check that the extra GC CPU fits the CPU limit.',
      fixCode: `-XX:+UseZGC -XX:+ZGenerational -Xmx6g -XX:SoftMaxHeapSize=5g` }
  ],
  puzzles: [
    { kind: 'concept', q: 'Objects A and B reference each other. Nothing else references either of them. What does a HotSpot GC do?', options: ['Keeps both forever: their reference counts are 1', 'Reclaims both: neither is reachable from a GC root', 'Reclaims one of them at random', 'Throws OutOfMemoryError eventually'], answer: 1, explain: 'HotSpot’s collectors trace from roots and don’t use reference counting. A cycle that no root reaches is unreachable, so <b>both</b> are reclaimed. Reference counting (as in CPython, plus its cycle detector) is the scheme that struggles with cycles.' },
    { kind: 'concept', q: 'Which of these is <b>not</b> a GC root?', options: ['A local variable in a frame of a running thread', 'A static field of a loaded class', 'An object referenced only through a WeakReference', 'A started, not-yet-terminated Thread'], answer: 2, explain: 'Weak references don’t keep their referent alive: once only weakly reachable, it is cleared at the next GC that processes it. Live stack frames, static fields (via their Class), live threads and JNI global references are all roots.' },
    { kind: 'predict', q: 'You see these G1 log lines an hour apart. What is the most likely diagnosis?', code: `GC(100)  Pause Young (Normal) (G1 Evacuation Pause) 1400M->620M(2048M) 14ms
GC(900)  Pause Young (Normal) (G1 Evacuation Pause) 1900M->1450M(2048M) 38ms
GC(1500) Pause Full (G1 Compaction Pause) 2047M->1950M(2048M) 3105ms`, lang: 'text', options: ['Young generation too small: raise -Xmn', 'Pause goal too high: lower MaxGCPauseMillis', 'The live set is growing (leak or undersized heap)', 'Normal behaviour: Full GCs are expected'], answer: 2, explain: 'Look at the <b>after-GC</b> numbers: 620M → 1450M → 1950M. Reachable data keeps growing until even a Full GC frees almost nothing. That is a live-set problem (a leak, or a heap too small for the workload), not a tuning problem. Next step: heap dump.' },
    { kind: 'concept', q: 'JDK 21, no GC flags, in a container with 1 CPU and 1 GiB memory. Which collector runs?', options: ['G1', 'Serial', 'Parallel', 'ZGC'], answer: 1, explain: 'G1 is the default only on “server-class” machines: at least 2 CPUs and about 1.8 GB of memory. Below that, ergonomics picks <b>Serial</b>. Check with <code>java -Xlog:gc -version</code> or <code>-XX:+PrintCommandLineFlags</code>.' },
    { kind: 'concept', q: 'A service has a 200 GB heap and needs p99.9 under 10 ms. Which collector fits best?', options: ['Parallel', 'G1 with MaxGCPauseMillis=5', 'ZGC (generational)', 'Serial'], answer: 2, explain: 'ZGC’s pauses don’t grow with heap or live-set size: marking, relocation and reference updating are all concurrent. G1 can’t reliably hit single-digit milliseconds at that size, since evacuation pauses scale with live data copied. Budget extra CPU and heap headroom for ZGC.' },
    { kind: 'concept', q: 'What does <code>-XX:MaxGCPauseMillis=200</code> mean for G1?', options: ['No pause will exceed 200 ms', 'A soft goal: G1 sizes young gen and picks mixed-GC work to try to meet it', 'GC runs at most every 200 ms', 'Pauses longer than 200 ms abort the GC'], answer: 1, explain: 'It is a <b>goal</b>. G1 uses pause-time prediction to size eden and choose how many old regions to add to each mixed GC. Full GCs, evacuation failures and very large live sets can all exceed it.' },
    { kind: 'concept', q: 'What should replace <code>finalize()</code> for releasing a native resource?', options: ['System.gc() after closing', 'try-with-resources, with a Cleaner as a safety net', 'A PhantomReference polled in a busy loop', 'Overriding finalize() but calling super.finalize()'], answer: 1, explain: 'Finalization is deprecated for removal (JEP 421, Java 18): unpredictable timing, a single thread, extra GC cycles, resurrection. Make the resource <code>AutoCloseable</code> and use try-with-resources; register a <code>Cleaner</code> action only to catch callers who forget.' }
  ],
  interview: [
    { q: 'How does a tracing garbage collector decide what is garbage?', a: '<p>It starts from <b>GC roots</b> (references in active stack frames, static fields, live threads, JNI handles, some JVM internals), follows every reference, and marks what it reaches. Everything unmarked is garbage, cycles included. Reclamation then copies live objects out (young GC, G1 evacuation, ZGC relocation), compacts in place, or sweeps.</p>', lvl: 'core' },
    { q: 'Explain the generational hypothesis and how HotSpot uses it.', a: '<p>Most objects die young, and old objects rarely point to young ones. So the heap has a young generation (eden + survivors), collected frequently by copying the few survivors, and an old generation collected rarely. A <b>card table</b> / remembered set tracks old→young references so a young GC doesn’t have to scan the whole old gen.</p>', lvl: 'core' },
    { q: 'Walk me through a G1 cycle.', a: '<ol><li><b>Young GCs</b>: evacuate live objects from eden (and survivor) regions; STW, parallel.</li><li>When old occupancy passes the (adaptive) <b>IHOP</b>, a young GC also does <b>Concurrent Start</b>.</li><li><b>Concurrent marking</b> (SATB) computes liveness per region while the app runs; short <b>Remark</b> and <b>Cleanup</b> pauses; empty regions are freed.</li><li><b>Mixed GCs</b>: young regions plus the old regions with the most garbage, spread over several pauses to meet the pause goal.</li><li>Fallback: evacuation failure → <b>Full GC</b> (parallel since JDK 10).</li></ol>', lvl: 'deep' },
    { q: 'What makes ZGC pauses so short?', a: '<p>ZGC does marking, relocation (compaction) and reference remapping concurrently. It uses <b>colored pointers</b> (metadata bits in references) and <b>load barriers</b>: when the app loads a reference, a small barrier checks whether it points to a moved object and fixes it up. Pauses only scan roots like thread stacks, so they stay well under a millisecond regardless of heap size. Since JDK 21 it can be generational, which collects young objects more cheaply.</p>', fu: 'What does ZGC cost? (More CPU for barriers and concurrent work, and memory headroom: if allocation outpaces collection, threads hit “Allocation Stall”.)', lvl: 'deep' },
    { q: 'How do G1, ZGC, Shenandoah, Parallel and Serial differ?', a: '<ul><li><b>Serial</b>: single-threaded STW; tiny heaps and containers.</li><li><b>Parallel</b>: multi-threaded STW everything; best throughput, long old-gen pauses.</li><li><b>G1</b>: regions, concurrent marking, incremental evacuation; balanced default.</li><li><b>ZGC</b>: concurrent compaction with load barriers; sub-ms pauses, up to multi-TB heaps.</li><li><b>Shenandoah</b>: also concurrent compaction (with different barriers); shipped in many OpenJDK builds, not Oracle JDK.</li></ul>', lvl: 'core' },
    { q: 'How would you approach GC tuning for a Spring Boot service?', a: '<ol><li>Turn on GC logs and get the facts: pause times, frequency, after-GC usage, allocation rate.</li><li>Size the heap for the live set plus headroom (e.g. 2–3× after-GC usage); in containers use <code>MaxRAMPercentage</code>.</li><li>Keep G1 defaults; reduce allocation (big buffers, needless copies) before flags.</li><li>If p99 is still dominated by GC pauses and CPU is available, try generational ZGC.</li><li>Change one thing at a time and compare under realistic load.</li></ol>', lvl: 'core' },
    { q: 'What is a safepoint, and why can it hurt latency even without GC?', a: '<p>A point where a thread’s state is known so the JVM can stop it: used for STW GC phases and also for deoptimization, biased-lock revocation (in older JDKs), thread dumps and some class redefinition. All threads must reach one before the operation starts, so a thread stuck in a long counted loop without a poll delays everyone (time-to-safepoint). Log with <code>-Xlog:safepoint</code>.</p>', lvl: 'deep' },
    { q: 'What do the reference types (soft, weak, phantom) do?', a: '<ul><li><b>Weak</b>: cleared at the next GC once the referent is only weakly reachable; used by <code>WeakHashMap</code> and canonicalising maps.</li><li><b>Soft</b>: cleared only under memory pressure, by an LRU-ish policy; cache-like, but unpredictable.</li><li><b>Phantom</b>: never returns the referent; enqueued after the object is finalizable-unreachable, which is how <code>Cleaner</code> runs post-mortem cleanup.</li></ul>', lvl: 'deep' },
    { q: 'How do you read a G1 log line?', a: '<p><code>GC(118) Pause Young (Normal) (G1 Evacuation Pause) 1210M-&gt;302M(2048M) 11.842ms</code>: GC id, event type and cause, heap used before → after (committed heap), and pause duration. Watch three things over time: pause durations against your SLO, the after-GC trend (live set), and how often concurrent cycles, mixed GCs and any Full GCs occur.</p>', lvl: 'core' },
    { q: 'What is “GC overhead limit exceeded”?', a: '<p>An OutOfMemoryError thrown by the Parallel collector (on by default via <code>UseGCOverheadLimit</code>) when over 98% of time goes to GC while it recovers under 2% of the heap. It means the live set is about the size of the heap. It is a symptom of a leak or undersizing; disabling the check just converts it into a slower death. G1 doesn’t implement it and tends to show back-to-back Full GCs instead.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Production GC flags (JDK 21)', lang: 'bash', code: `# G1 (default): size the heap, log everything, stop there
java -XX:MaxRAMPercentage=70 \\
     -Xlog:gc*,safepoint:file=/logs/gc.log:time,uptime,level,tags:filecount=10,filesize=50m \\
     -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/dumps \\
     -jar app.jar

# latency-critical service, spare CPU available
java -XX:+UseZGC -XX:+ZGenerational -Xmx8g -XX:SoftMaxHeapSize=7g \\
     -Xlog:gc*:file=/logs/gc.log:time,uptime,level,tags -jar app.jar

# batch job: maximise throughput
java -XX:+UseParallelGC -Xmx16g -jar batch.jar`, note: 'GC logging with rotation costs almost nothing. Have it on in production before you need it.' },
    { title: 'Live inspection', lang: 'bash', code: `jcmd <pid> GC.heap_info              # regions, used/committed per space
jstat -gcutil <pid> 1s 10            # occupancy %, GC counts and times every second
jcmd <pid> GC.class_histogram | head -20   # who is filling the heap (forces a full GC!)
jcmd <pid> JFR.start duration=120s filename=/tmp/rec.jfr settings=profile
# JFR: GC pauses, allocation by stack trace, old-object samples; open in JDK Mission Control`, note: '<code>GC.class_histogram</code> and <code>GC.heap_dump</code> trigger a full, stop-the-world GC. On a busy production instance, take it out of the load balancer first.' },
    { title: 'GC metrics and alerts (Spring Boot + Micrometer)', lang: 'yaml', code: `management:
  endpoints.web.exposure.include: health,prometheus
  metrics.distribution.percentiles-histogram.jvm.gc.pause: true

# PromQL ideas
# share of time paused:   rate(jvm_gc_pause_seconds_sum[5m])
# worst pause:            max_over_time(jvm_gc_pause_seconds_max[15m])
# live-set trend:         jvm_gc_live_data_size_bytes   (old-gen size after GC)
# allocation rate:        rate(jvm_gc_memory_allocated_bytes_total[5m])`, note: 'Alert on the live-data trend and on pause share, not on raw heap used: heap used always looks like a saw-tooth.' }
  ]
});

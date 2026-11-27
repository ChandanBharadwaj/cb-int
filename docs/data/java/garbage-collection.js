IA.register({
  track: 'java',
  slug: 'garbage-collection',
  title: 'Garbage collection',
  tagline: 'The GC keeps every object you can still reach from a starting point (a <b>root</b>). It frees the rest. Collectors differ in <i>when</i> they pause your threads. Parallel aims for throughput, G1 (the default) for balance, ZGC for tiny pauses. Most “GC problems” are really about live data or allocation rate. A GC log shows that in minutes.',
  tldr: {
    problem: 'You see latency spikes, CPU burned in GC, multi-second Full GCs and “GC overhead limit exceeded”. Teams often add dozens of flags. The real cause is usually growing live data or bursts of huge allocations.',
    model: 'The GC follows references from <b>roots</b> (stack frames, statics, threads) and marks what it finds. Everything unmarked is freed. The young space is collected often and cheaply. The old space is collected rarely. <b>G1</b> uses regions and marks while your app runs, then cleans the most-garbage regions first. <b>ZGC</b> even moves objects while your app runs.',
    hook: '“How do you tune G1?” Set the heap size, maybe the pause goal, and stop. Then read the log. If usage <b>after GC</b> keeps rising, you have a leak. If pauses are long, check huge allocations and allocation rate before touching flags.',
    facts: [
      { v: 'JDK 9', l: 'G1 became the default collector on server-class machines. With fewer than 2 CPUs or under ~1.8 GB of memory, the JVM still picks Serial' },
      { v: '< 1 ms', l: 'ZGC’s typical pause target, whatever the heap size. Generational ZGC arrived in JDK 21 (<code>-XX:+ZGenerational</code>) and is the default ZGC mode from JDK 23' },
      { v: '200 ms', l: 'G1’s default <code>MaxGCPauseMillis</code>. It is a goal G1 tries to meet by resizing the young generation, not a guarantee' }
    ]
  },
  intro: {
    what: 'In Java you create objects with <code>new</code> but never free them. The <b>garbage collector</b> does that. It finds objects your program can no longer reach and reuses their memory. While it works, it may pause your threads briefly. Collectors trade off pauses, CPU and memory in different ways.',
    analogy: { icon: '🧹', title: 'Cleaning a library while it’s open', text: 'Any book listed in the catalogue (the roots) stays. Anything else goes to recycling. A simple cleaner closes the library to do it (stop-the-world). A smarter one tidies the new-arrivals shelf often and fast (young GC). The smartest cleans while readers are inside, closing the doors only for a moment (concurrent GC).' },
    steps: [
      { t: 'Reachable = alive', d: 'An object stays alive while a chain of references leads to it from a <b>root</b>. A root is a local variable in a running method, a static field, or a running thread.' },
      { t: 'Most objects die young', d: 'So the heap splits into two parts. The young part is collected often and cheaply. The old part holds long-lived data.' },
      { t: 'Collectors trade pauses vs CPU', d: 'Parallel: longest pauses, best throughput. G1: short pauses, the default. ZGC: almost no pauses, but more CPU.', code: 'java -XX:+UseZGC -XX:+ZGenerational -Xmx8g -jar app.jar   # JDK 21' },
      { t: 'Read the log first', d: 'Turn on GC logging everywhere. It is cheap and answers most questions.', code: 'java -Xlog:gc*:file=gc.log:time,uptime,level,tags -jar app.jar' }
    ],
    terms: [
      ['GC root', 'A reference the GC always treats as live: stack locals, statics, threads, JNI handles.'],
      ['stop-the-world (STW)', 'A pause where every app thread stops (<i>stop-the-world</i>).'],
      ['live set', 'The memory held by reachable objects (the <i>live set</i>). Heap usage right after a GC is a good estimate.'],
      ['promotion', 'Moving an object that survived several young GCs into the old generation.'],
      ['allocation rate', 'MB/s of new objects. Drives how often young GCs run.'],
      ['throughput', 'Share of time spent running your code rather than GC.']
    ]
  },
  visual: {
    title: 'From roots to regions to pause profiles',
    caption: 'Pick a scenario and press Play. <b>reachability</b> marks a small object graph. <b>G1 regions</b> runs a full G1 cycle. <b>Parallel vs G1 vs ZGC</b> compares pauses. <b>reading a GC log</b> decodes real log lines.'
  },
  gotchas: [
    { trap: 'Calling <code>System.gc()</code>', why: 'With G1 and Parallel it asks for a full stop-the-world collection. That can take seconds on large heaps. Some libraries call it too, like old RMI and some direct-buffer code.', fix: 'Don’t call it. If a library does, try <code>-XX:+ExplicitGCInvokesConcurrent</code> (G1). Avoid <code>-XX:+DisableExplicitGC</code>: it can stop direct buffers from being freed.' },
    { trap: 'Fixing the young generation size under G1', code: `-XX:+UseG1GC -Xmn2g          # or -XX:NewRatio=…`, why: 'G1 meets its pause goal by resizing the young generation each cycle. Fix the young size and it can’t. The pause goal is then ignored.', fix: 'With G1, set <code>-Xmx</code> (and maybe <code>MaxGCPauseMillis</code>). Leave generation sizes alone.' },
    { trap: 'An overly aggressive pause goal', why: '<code>-XX:MaxGCPauseMillis=10</code> makes G1 shrink eden. Young GCs run far more often and GC CPU rises. Pauses may not shrink much, because copying live data takes the time it takes.', fix: 'Keep the default 200 ms or a realistic 50–100 ms. If you truly need single-digit milliseconds, switch to ZGC.' },
    { trap: 'Big short-lived arrays in G1 (humongous objects)', why: 'An object of half a region or more goes straight into old regions (a <i>humongous</i> object). A stream of them, like big JSON or report <code>byte[]</code>s, fragments the heap. That causes extra cycles and can end in Full GCs.', fix: 'Stream data instead of buffering whole payloads. Look for <code>G1 Humongous Allocation</code> in logs. Try <code>-XX:G1HeapRegionSize=16m</code> or <code>32m</code> so those objects aren’t humongous.' },
    { trap: 'Relying on finalize()', why: 'Finalization is deprecated for removal (Java 18). Such objects need at least two GC cycles to be freed. One thread runs finalizers, in no set order. They can even bring objects back to life.', fix: 'Use try-with-resources for predictable cleanup. Use <code>java.lang.ref.Cleaner</code> only as a safety net.' },
    { trap: 'SoftReference caches', why: 'The JVM clears soft references based on free heap and last access time. Under memory pressure it often clears them all at once. Your cache hit rate collapses right when load peaks.', fix: 'Use a size-limited cache (Caffeine, <code>maximumSize</code>/<code>maximumWeight</code>) instead of soft values.' },
    { trap: 'Tiny containers silently use SerialGC', why: 'With fewer than 2 CPUs or under ~1.8 GB of memory, the JVM picks Serial. Serial collects on one thread and stops everything.', fix: 'Pick the collector yourself (<code>-XX:+UseG1GC</code>). Give latency-sensitive services at least 2 CPUs. Check with <code>java -Xlog:gc -version</code> in the image.' }
  ],
  scenarios: [
    { title: 'p99 latency spikes to 3 s a few times an hour',
      symptom: 'A report-export API has a p50 of 40 ms but p99 spikes of 2–3 s. CPU is fine. The spikes hit every endpoint on the instance at once.',
      diagnose: `grep -E "Humongous|Pause Full" gc.log | tail -5
# GC(812) Pause Young (Concurrent Start) (G1 Humongous Allocation) 3100M->2950M(4096M) 21ms
# GC(815) Pause Full (G1 Compaction Pause) 4090M->1800M(4096M) 2870ms`,
      cause: 'Each export built the whole CSV in memory as one 30–60 MB <code>byte[]</code>. With 2 MB regions, those were humongous. They fragmented old space. G1 ran out of free regions and fell back to Full GCs.',
      fix: 'Stream the export to the response. Raise the region size so medium buffers aren’t humongous.',
      fixCode: `@GetMapping(value = "/export", produces = "text/csv")
StreamingResponseBody export() {
    return out -> repo.streamAll().forEach(r -> writeCsvLine(out, r));   // no giant byte[]
}
// JVM: -XX:G1HeapRegionSize=16m` },
    { title: 'GC CPU at 40% and climbing until “GC overhead limit exceeded”',
      symptom: 'Throughput drops over several hours. Young GCs get frequent and mixed GCs free little. Finally you get <code>OutOfMemoryError: GC overhead limit exceeded</code> (Parallel) or back-to-back Full GCs (G1).',
      diagnose: `# after-GC heap usage, one value per young GC: it only goes up
grep "Pause Young" gc.log | sed -E 's/.*->([0-9]+M).*/\\1/' | awk 'NR % 50 == 1'
# 410M 690M 980M 1270M 1560M 1830M …`,
      cause: 'The live data keeps growing. Something collects objects: an unbounded cache, a listener list, a static map. The GC works fine. It can’t free memory that is still reachable.',
      fix: 'Take a heap dump and find what holds the memory. Don’t add heap or tune the GC first. See <a href="leaks-oom.html">Memory leaks & OOM</a>.',
      fixCode: `jcmd <pid> GC.heap_dump /tmp/app.hprof
# open in Eclipse MAT → Leak Suspects / Dominator Tree` },
    { title: 'Switched to ZGC for latency, then requests stalled',
      symptom: 'A service moved from G1 to ZGC with the same 4 GB heap. Average CPU went up. Some requests stalled for tens of milliseconds at traffic peaks.',
      diagnose: `grep -i "allocation stall" gc.log | head -3
# [gc] Allocation Stall (http-nio-8080-exec-7) 38.214ms`,
      cause: 'ZGC collects while your app runs, so it needs <b>headroom</b>. If threads allocate faster than it frees memory, they wait. The heap had little margin. Non-generational ZGC (the JDK 21 default mode) also marked the whole heap every cycle.',
      fix: 'Turn on generational ZGC and give it more heap. Check that the extra GC CPU fits your CPU limit.',
      fixCode: `-XX:+UseZGC -XX:+ZGenerational -Xmx6g -XX:SoftMaxHeapSize=5g` }
  ],
  puzzles: [
    { kind: 'concept', q: 'Objects A and B reference each other. Nothing else references either of them. What does a HotSpot GC do?', options: ['Keeps both forever: their reference counts are 1', 'Reclaims both: neither is reachable from a GC root', 'Reclaims one of them at random', 'Throws OutOfMemoryError eventually'], answer: 1, explain: 'HotSpot’s collectors trace from roots. They don’t count references. No root reaches this cycle, so <b>both</b> are freed. Reference counting (as in CPython) is the scheme that struggles with cycles.' },
    { kind: 'concept', q: 'Which of these is <b>not</b> a GC root?', options: ['A local variable in a frame of a running thread', 'A static field of a loaded class', 'An object referenced only through a WeakReference', 'A started, not-yet-terminated Thread'], answer: 2, explain: 'A weak reference doesn’t keep its object alive. Once only weak references remain, the next GC clears it. Live stack frames, static fields, live threads and JNI global references are all roots.' },
    { kind: 'predict', q: 'You see these G1 log lines an hour apart. What is the most likely diagnosis?', code: `GC(100)  Pause Young (Normal) (G1 Evacuation Pause) 1400M->620M(2048M) 14ms
GC(900)  Pause Young (Normal) (G1 Evacuation Pause) 1900M->1450M(2048M) 38ms
GC(1500) Pause Full (G1 Compaction Pause) 2047M->1950M(2048M) 3105ms`, lang: 'text', options: ['Young generation too small: raise -Xmn', 'Pause goal too high: lower MaxGCPauseMillis', 'The live set is growing (leak or undersized heap)', 'Normal behaviour: Full GCs are expected'], answer: 2, explain: 'Look at the numbers <b>after GC</b>: 620M → 1450M → 1950M. Reachable data keeps growing until even a Full GC frees almost nothing. That is a leak or a too-small heap, not a tuning problem. Next step: heap dump.' },
    { kind: 'concept', q: 'JDK 21, no GC flags, in a container with 1 CPU and 1 GiB memory. Which collector runs?', options: ['G1', 'Serial', 'Parallel', 'ZGC'], answer: 1, explain: 'G1 is the default only on “server-class” machines: at least 2 CPUs and about 1.8 GB. Below that, the JVM picks <b>Serial</b>. Check with <code>java -Xlog:gc -version</code> or <code>-XX:+PrintCommandLineFlags</code>.' },
    { kind: 'concept', q: 'A service has a 200 GB heap and needs p99.9 under 10 ms. Which collector fits best?', options: ['Parallel', 'G1 with MaxGCPauseMillis=5', 'ZGC (generational)', 'Serial'], answer: 2, explain: 'ZGC’s pauses don’t grow with heap size. It marks, moves and fixes references while your app runs. G1 can’t reliably hit single-digit milliseconds at that size. Its pauses grow with the live data it copies. Budget extra CPU and heap for ZGC.' },
    { kind: 'concept', q: 'What does <code>-XX:MaxGCPauseMillis=200</code> mean for G1?', options: ['No pause will exceed 200 ms', 'A soft goal: G1 sizes young gen and picks mixed-GC work to try to meet it', 'GC runs at most every 200 ms', 'Pauses longer than 200 ms abort the GC'], answer: 1, explain: 'It is a <b>goal</b>. G1 predicts pause times to size eden and pick how many old regions to clean. Full GCs, failed evacuations and huge live sets can all exceed it.' },
    { kind: 'concept', q: 'What should replace <code>finalize()</code> for releasing a native resource?', options: ['System.gc() after closing', 'try-with-resources, with a Cleaner as a safety net', 'A PhantomReference polled in a busy loop', 'Overriding finalize() but calling super.finalize()'], answer: 1, explain: 'Finalization is deprecated for removal (Java 18). Its timing is unpredictable, it runs on one thread, and it costs extra GC cycles. Make the resource <code>AutoCloseable</code> and use try-with-resources. Register a <code>Cleaner</code> only to catch callers who forget.' }
  ],
  interview: [
    { q: 'How does a tracing garbage collector decide what is garbage?', a: '<p>It starts from <b>GC roots</b>: references in active stack frames, static fields, live threads and JNI handles. It follows every reference and marks what it reaches. Everything unmarked is garbage, cycles included. Then it copies live objects out, compacts in place, or sweeps.</p>', lvl: 'core' },
    { q: 'Explain the generational hypothesis and how HotSpot uses it.', a: '<p>Most objects die young, and old objects rarely point to young ones. So the heap has a young generation (eden + survivors), collected often by copying the few survivors. The old generation is collected rarely. A <b>card table</b> tracks old→young references. A young GC then doesn’t need to scan the whole old gen.</p>', lvl: 'core' },
    { q: 'Walk me through a G1 cycle.', a: '<ol><li><b>Young GCs</b>: copy live objects out of eden and survivor regions. The app pauses.</li><li>When old space passes a threshold (<b>IHOP</b>), a young GC also starts marking (<b>Concurrent Start</b>).</li><li><b>Concurrent marking</b> finds live data per region while the app runs. Short <b>Remark</b> and <b>Cleanup</b> pauses follow. Empty regions are freed.</li><li><b>Mixed GCs</b>: young regions plus the old regions with the most garbage, spread over several pauses.</li><li>If copying fails, G1 falls back to a <b>Full GC</b>.</li></ol>', lvl: 'deep' },
    { q: 'What makes ZGC pauses so short?', a: '<p>ZGC marks, moves objects and fixes references while your app runs. It stores extra bits in each reference (<b>colored pointers</b>). When the app loads a reference, a small check (<b>load barrier</b>) fixes it if the object moved. Pauses only scan roots like thread stacks. They stay under a millisecond for any heap size. Since JDK 21 it can be generational, which makes young objects cheaper.</p>', fu: 'What does ZGC cost? (More CPU for barriers and background work, plus heap headroom. If allocation outpaces collection, threads hit “Allocation Stall”.)', lvl: 'deep' },
    { q: 'How do G1, ZGC, Shenandoah, Parallel and Serial differ?', a: '<ul><li><b>Serial</b>: one thread, stops everything. For tiny heaps.</li><li><b>Parallel</b>: many threads, stops everything. Best throughput, long old-gen pauses.</li><li><b>G1</b>: regions, background marking, step-by-step cleanup. The balanced default.</li><li><b>ZGC</b>: moves objects while the app runs. Sub-ms pauses, heaps up to many TB.</li><li><b>Shenandoah</b>: also moves objects concurrently, with different barriers. In many OpenJDK builds, not Oracle JDK.</li></ul>', lvl: 'core' },
    { q: 'How would you approach GC tuning for a Spring Boot service?', a: '<ol><li>Turn on GC logs and get facts: pause times, frequency, usage after GC, allocation rate.</li><li>Size the heap for live data plus headroom (2–3× usage after GC). In containers use <code>MaxRAMPercentage</code>.</li><li>Keep G1 defaults. Cut allocation (big buffers, needless copies) before adding flags.</li><li>If GC pauses still dominate p99 and you have spare CPU, try generational ZGC.</li><li>Change one thing at a time and test under real load.</li></ol>', lvl: 'core' },
    { q: 'What is a safepoint, and why can it hurt latency even without GC?', a: '<p>A point where the JVM knows a thread’s state and can stop it (a <i>safepoint</i>). GC uses it, and so do deoptimization, thread dumps and class redefinition. Every thread must reach one first. So one thread in a long loop without a check delays everyone. Log it with <code>-Xlog:safepoint</code>.</p>', lvl: 'deep' },
    { q: 'What do the reference types (soft, weak, phantom) do?', a: '<ul><li><b>Weak</b>: cleared at the next GC once only weak references remain. <code>WeakHashMap</code> uses it.</li><li><b>Soft</b>: cleared only under memory pressure. Cache-like, but unpredictable.</li><li><b>Phantom</b>: never returns the object. It is queued after the object dies. That is how <code>Cleaner</code> runs cleanup.</li></ul>', lvl: 'deep' },
    { q: 'How do you read a G1 log line?', a: '<p><code>GC(118) Pause Young (Normal) (G1 Evacuation Pause) 1210M-&gt;302M(2048M) 11.842ms</code>: GC id, event type and cause, heap used before → after (committed), and pause time. Watch three things over time. Pause times against your SLO. The after-GC trend (live data). How often concurrent cycles, mixed GCs and Full GCs occur.</p>', lvl: 'core' },
    { q: 'What is “GC overhead limit exceeded”?', a: '<p>An OutOfMemoryError from the Parallel collector. It fires when over 98% of time goes to GC and under 2% of heap is freed. Your live data is about as big as the heap. It points to a leak or a small heap. Turning the check off only makes the death slower. G1 doesn’t have it. It shows back-to-back Full GCs instead.</p>', lvl: 'deep' }
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
java -XX:+UseParallelGC -Xmx16g -jar batch.jar`, note: 'GC logging with rotation costs almost nothing. Turn it on in production before you need it.' },
    { title: 'Live inspection', lang: 'bash', code: `jcmd <pid> GC.heap_info              # regions, used/committed per space
jstat -gcutil <pid> 1s 10            # occupancy %, GC counts and times every second
jcmd <pid> GC.class_histogram | head -20   # who is filling the heap (forces a full GC!)
jcmd <pid> JFR.start duration=120s filename=/tmp/rec.jfr settings=profile
# JFR: GC pauses, allocation by stack trace, old-object samples; open in JDK Mission Control`, note: '<code>GC.class_histogram</code> and <code>GC.heap_dump</code> force a full stop-the-world GC. On a busy instance, take it out of the load balancer first.' },
    { title: 'GC metrics and alerts (Spring Boot + Micrometer)', lang: 'yaml', code: `management:
  endpoints.web.exposure.include: health,prometheus
  metrics.distribution.percentiles-histogram.jvm.gc.pause: true

# PromQL ideas
# share of time paused:   rate(jvm_gc_pause_seconds_sum[5m])
# worst pause:            max_over_time(jvm_gc_pause_seconds_max[15m])
# live-set trend:         jvm_gc_live_data_size_bytes   (old-gen size after GC)
# allocation rate:        rate(jvm_gc_memory_allocated_bytes_total[5m])`, note: 'Alert on the live-data trend and on time spent paused. Raw heap use always looks like a saw-tooth.' }
  ]
});

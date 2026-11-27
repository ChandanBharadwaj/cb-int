IA.register({
  track: 'java',
  slug: 'tricky-java',
  title: '★ Tricky Java (timed)',
  tagline: 'Forty-eight “what does this print / what happens” questions from every Java topic, against the clock. Each one is a trap that has caused a real bug. The 30 program questions are full <code>Main</code> classes with a fixed output on JDK 21.',
  tldr: {
    problem: 'Senior Java interviews rarely ask you to write code from scratch. They show you ten lines. Then they ask what it prints, why a service hangs, or what two threads do with it.',
    model: 'Almost every trick is one of five things. <b>Same object vs equal value</b>: <code>==</code>, caches, interning, hashCode. <b>Order of evaluation</b>: finally, laziness, static init, arguments. <b>Erasure and overloads</b>: generics, <code>remove(int)</code>. <b>Visibility and atomicity</b>: the memory model, races, pinning. <b>Defaults</b>: pool queues, GC choice, charsets, byte order.',
    hook: '<code>Integer a = 128, b = 128; a == b</code> is false, but at 127 it is true. If you can explain why in one sentence, start the drill.',
    facts: [
      { v: '48', l: 'questions across all 27 content topics: language core, collections, JVM internals, concurrency, modern Java and production' },
      { v: '60 s', l: 'per question by default. Slow (90 s) and Fast (30 s) modes too' },
      { v: '30', l: 'are runnable programs: <code>java Main.java</code> on JDK 21 prints exactly the answer. Thread questions whose result varies per run are asked as concepts instead' }
    ]
  },
  intro: {
    what: 'This page is a <b>drill</b>, not a lesson. You get a short program or a production case, a timer and four answers. Answer in your head, as in an interview. Then read the explanation. At the end you see your score per module and topic. Each miss links back to the page that explains it.',
    analogy: { icon: '⏱️', title: 'Chess puzzles for Java', text: 'Chess players improve by solving positions fast, not by reading about openings. Each question here is a “position”. It is a few lines of Java where the obvious answer is wrong, for one specific reason.' },
    steps: [
      { t: 'Read like the compiler', d: 'Which overload wins? Is this a constant the compiler fills in? What is the declared type? What do generics leave at run time?', code: 'list.remove(1)               // remove(int index), not remove(Object)\n"hel" + "lo" == "hello"      // constant-folded: true' },
      { t: 'Then like the JVM', d: 'When does the class get set up? What runs in <code>finally</code>? What does the stream really run, and in what order?' },
      { t: 'For threads, ask two questions', d: 'Is the write guaranteed to be visible to the read (a <i>happens-before</i> link)? Does the multi-step action run as one step? If either answer is no, the result isn’t guaranteed.' },
      { t: 'Check defaults', d: 'Pool queues, GC choice in small containers, byte order, charset, Integer cache range. Many “surprises” are documented defaults.' }
    ],
    terms: [
      ['compile-time constant', 'A <code>final</code> primitive or String set to a constant value. The compiler copies the value into every place that uses it.'],
      ['erasure', 'Generic type arguments vanish at run time (<i>erasure</i>). The compiler adds casts where values come out.'],
      ['happens-before', 'The memory-model rule that makes one thread’s write visible to another thread’s read.'],
      ['pinning', 'A virtual thread that can’t unmount from its carrier while it blocks (Java 21: inside <code>synchronized</code>).'],
      ['ergonomics', 'The JVM picks the GC, heap size and thread counts by itself, from the machine or container it sees.']
    ]
  },
  visual: {
    title: 'The drill',
    caption: 'Pick a module (or All), how many questions, and the time per question. Then press Start. A skip counts as a miss. At the end you see your score per module and topic, weakest first, each linked to its page. Then your misses, with explanations.'
  },
  gotchas: [
    { trap: 'Answering from memory of an older Java', why: 'Some answers changed between versions: <code>HashMap</code> collisions (8), compact strings (9), G1 as default (9), helpful NPE messages (14–15), records and patterns (16–21), UTF-8 by default (18), virtual-thread pinning in <code>synchronized</code> (fixed in 24).', fix: 'Say which version you assume (“on Java 21…”), and mention the change if you know it. Interviewers like hearing where the version line is.' },
    { trap: 'Guessing concurrency outcomes as if they were deterministic', why: 'A program with a race has no single answer. “It prints 20,000” is wrong for <code>count++</code> on a plain or volatile field. Even if your laptop always prints it.', fix: 'Answer with what is guaranteed: “at most 20,000, because <code>++</code> isn’t one step”. Then name the fix (<code>AtomicInteger</code>, <code>LongAdder</code>, a lock).' },
    { trap: 'Trusting a run on your machine', why: '<code>HashMap</code> loop order, default hash codes, thread timing, GC timing and JIT choices vary by JVM, flags and load. One run proves very little about them.', fix: 'Separate what Java promises from what this JVM happened to do. Check the javadoc or language spec for the promise. Use <code>jshell</code> or <code>java Main.java</code> to quickly test fixed behaviour.' }
  ],
  interview: [
    { q: 'How do you approach a “what does this print?” question?', a: '<p>Out loud, in order. Compile time first: static types, which overload wins, constant folding, erasure, whether it compiles at all. Then run time: class init order, the order arguments run, <code>finally</code>, laziness. Write middle values down. Interviewers grade the reasoning more than the final answer.</p>', lvl: 'core' },
    { q: 'How do you reason about a two-thread question?', a: '<p>Draw two columns, one statement per line. For each shared variable, ask: is each write guaranteed visible to its read? (That needs volatile, the same lock, start/join, or a j.u.c. hand-off.) Does each multi-step action run as one step? If not, list every result the memory model allows, not just the one you expect. See <a href="java-memory-model.html">Java Memory Model</a> and <a href="concurrency-bugs.html">Concurrency bugs</a>.</p>', lvl: 'core' },
    { q: 'You don’t know the answer. What do you say?', a: '<p>Narrow it down: “It’s A or B, depending on whether <code>K</code> is a constant. It is a <code>static final int</code> with a literal. So the compiler copies it in, and the class isn’t set up: A. I’d confirm with a two-line <code>java Main.java</code>.” Showing how you’d check it in a minute is a strong answer.</p>', lvl: 'core' },
    { q: 'Which trick categories cause the most production bugs?', a: '<p>1) Same object vs equal value: <code>==</code> on boxed values or strings, entities with broken <code>equals/hashCode</code> in sets. 2) Concurrency defaults: executor queues with no limit, plain fields used as flags, check-then-act on concurrent maps. 3) Hidden work: <code>orElse</code> always running its argument, <code>submit()</code> hiding exceptions, <code>Files.lines</code> left open.</p>', lvl: 'deep' },
    { q: 'How do you check a tricky claim quickly during a real code review?', a: '<p>For language rules: <code>jshell</code>, or a one-file program run with <code>java Main.java</code> (Java 11+). For speed claims: a JMH benchmark, never a hand-written loop. For threads: a stress test with <code>jcstress</code>, plus a thread dump or JFR recording if something hangs. For “what does the JVM pick here”: <code>java -XX:+PrintCommandLineFlags -version</code>.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Verify in seconds', lang: 'bash', code: `# single-file programs (Java 11+): no build, no class files
java Main.java

# language questions interactively
jshell
jshell> Integer a = 128, b = 128;
jshell> a == b          // prints false

# what did ergonomics pick on this machine / container?
java -XX:+PrintCommandLineFlags -version
java -Xlog:gc -version | head -3

# bytecode: is it a constant? which overload? where is the cast?
javap -c -p Main.class | less`, note: 'For thread claims, a passing run proves nothing. Use OpenJDK’s jcstress tool for memory-model questions.' },
    { title: 'A jcstress test for a racy counter', lang: 'java', code: `@JCStressTest
@Outcome(id = "2", expect = Expect.ACCEPTABLE, desc = "both increments seen")
@Outcome(id = "1", expect = Expect.ACCEPTABLE_INTERESTING, desc = "lost update")
@State
public class CounterRace {
    int v;                                   // try volatile: still loses updates

    @Actor public void actor1() { v++; }
    @Actor public void actor2() { v++; }

    @Arbiter public void arbiter(I_Result r) { r.r1 = v; }
}`, note: 'jcstress runs the threads together millions of times and counts each result. “1” shows up quickly on most machines.' }
  ]
});

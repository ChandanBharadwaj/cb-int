IA.register({
  track: 'java',
  slug: 'tricky-java-basics',
  title: 'Basics drill (timed)',
  tagline: "Thirty “what does this print?” and “does it compile?” questions from the 8 Java Basics topics, against the clock. Every program is a complete <code>public class Main</code> and its output is exact on JDK 21.",
  tldr: {
    problem: "First Java interviews like short programs: integer division, <code>==</code> on strings, an overload, a constructor that forgets <code>this</code>. Each one is a line or two.",
    model: "Most beginner traps are one of four things: <b>types decide the operation</b> (int / int is int; overflow wraps), <b>references vs values</b> (<code>==</code> compares references; arguments are copied), <b>compile time vs runtime</b> (overloads and fields use the declared type, overridden methods use the object), and <b>immutability</b> (String and <code>List.of</code> cannot change).",
    hook: "<code>double d = 7 / 2;</code> is <code>3.0</code>. If you can say why in one sentence, start the drill.",
    facts: [{"v":"30","l":"questions across the 8 Basics topics, 3–4 per topic"},{"v":"60 s","l":"per question by default. Slow (90 s) and Fast (30 s) modes too"},{"v":"JDK 21","l":"is the baseline; every program runs with java Main.java as shown"}]
  },
  intro: {
    what: 'This page is a <b>drill</b>, not a lesson. You get a short snippet or question, a timer and four answers. Answer in your head, as you would in a first interview, then read the explanation. At the end you see your score per topic and a review of every miss, each with a link back to the Basics page that teaches it.',
    analogy: { icon: '⏱️', title: 'Flashcards with a stopwatch', text: "Reading about strings is not the same as spotting, in five seconds, that <code>s.toUpperCase()</code> changed nothing. Speed comes from having seen the trap before." },
    steps: [{"t":"Ask “what type is this expression?”","d":"int with int stays int, even if the result goes into a double. <code>+</code> with a String concatenates from that point on."},{"t":"Ask “reference or value?”","d":"<code>==</code> on objects compares references. Methods get a copy of each argument."},{"t":"Ask “decided when?”","d":"Overloads and field access use the static type; overridden methods use the runtime object."},{"t":"Ask “does it even compile?”","d":"Static context, missing constructors, file names and default-method conflicts are compile errors."}],
    terms: [["primitive","A value type: int, long, double, boolean, char and friends."],["autoboxing","Automatic conversion between int and Integer."],["overloading","Same name, different parameters; chosen at compile time."],["overriding","A subclass replaces a method; chosen at runtime."],["unmodifiable","A collection whose add/remove throw UnsupportedOperationException."]]
  },
  visual: {
    title: 'The drill',
    caption: 'Pick a topic (or All), 10, 20 or all 30 questions, and the time per question, then press Start. Skip counts as a miss. At the end, your misses are listed with explanations and links to the topic pages.'
  },
  gotchas: [{"trap":"Answering with Python rules","why":"Java truncates integer division toward zero, <code>%</code> follows the left operand, and String + int concatenates.","fix":"Say “in Java” and give the Java rule."},{"trap":"Forgetting “compile error” is an option","why":"Many beginner questions are about what the compiler rejects: static context, a missing constructor, a lossy assignment.","fix":"Before predicting output, check that the code compiles."},{"trap":"Guessing instead of reasoning out loud","why":"An interviewer learns more from “the sum is computed in int before widening” than from a lucky letter.","fix":"State the rule, apply it, then answer."}],
  interview: [{"q":"How do you approach a “what does this print?” question?","a":"<p>Check it compiles. Then evaluate each expression by its static types, left to right, watching for integer division, overflow and string concatenation. For method calls, decide the overload at compile time and the override at runtime.</p>","lvl":"core"},{"q":"Which three beginner traps cause the most real bugs?","a":"<p>1) <code>==</code> on Strings or Integers. 2) Integer division or overflow hidden inside a larger expression. 3) Unboxing a <code>null</code> from <code>map.get</code>.</p>","lvl":"core"},{"q":"How do you check a claim quickly?","a":"<p>JShell (<code>jshell</code>, JDK 9+) for expressions, or <code>java Main.java</code> for a whole program without a build.</p>","lvl":"core"}]
});

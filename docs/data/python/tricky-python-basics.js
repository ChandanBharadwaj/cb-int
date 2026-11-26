IA.register({
  track: 'python',
  slug: 'tricky-python-basics',
  title: 'Basics drill (timed)',
  tagline: "Thirty “what does this print?” and “what happens?” questions from the 12 Python Basics topics, against the clock. Every program is complete and its output is exact on Python 3.12+.",
  tldr: {
    problem: "First Python interviews often show a few lines and ask what they print. The traps are small: integer division, a shared list, a method that returns <code>None</code>.",
    model: "Most beginner traps are one of four things: <b>names point at objects</b> (assignment never copies), <b>mutable vs immutable</b> (strings and tuples cannot change; lists and dicts can), <b>what a call returns</b> (<code>sort()</code> and <code>print()</code> return <code>None</code>), and <b>Python is not Java</b> (<code>//</code> floors, no overloading, truthiness).",
    hook: "<code>b = a.sort()</code> leaves <code>b</code> as <code>None</code>. If you can say why in one sentence, start the drill.",
    facts: [{"v":"30","l":"questions across the 12 Basics topics, 2–3 per topic"},{"v":"60 s","l":"per question by default. Slow (90 s) and Fast (30 s) modes too"},{"v":"3.12+","l":"is the baseline; every “what does it print” program runs as shown"}]
  },
  intro: {
    what: 'This page is a <b>drill</b>, not a lesson. You get a short snippet or question, a timer and four answers. Answer in your head, as you would in a first interview, then read the explanation. At the end you see your score per topic and a review of every miss, each with a link back to the Basics page that teaches it.',
    analogy: { icon: '⏱️', title: 'Flashcards with a stopwatch', text: "Reading about lists is not the same as spotting, in five seconds, that <code>b = a</code> did not copy. Speed comes from having seen the trap before." },
    steps: [{"t":"Ask “which object?”","d":"Follow each name to its object. <code>b = a</code> shares; <code>a[:]</code> copies; a default argument is made once."},{"t":"Ask “does it change or return?”","d":"String methods return new strings. <code>list.sort()</code> changes in place and returns <code>None</code>."},{"t":"Ask “what type comes out?”","d":"<code>/</code> gives a float, <code>//</code> floors, <code>or</code> returns an operand, <code>int()</code> truncates."},{"t":"Ask “which block runs?”","d":"<code>else</code> on a loop means no <code>break</code>; <code>else</code> on try means no exception; <code>finally</code> always runs."}],
    terms: [["truthy / falsy","<code>0</code>, <code>\"\"</code>, <code>[]</code>, <code>{}</code> and <code>None</code> are falsy; almost everything else is truthy."],["mutable","An object that can change in place: list, dict, set."],["slice","<code>s[start:stop:step]</code>: stop is excluded."],["generator","A lazy iterator that can be consumed once."],["class attribute","Defined in the class body and shared by all instances."]]
  },
  visual: {
    title: 'The drill',
    caption: 'Pick a topic (or All), 10, 20 or all 30 questions, and the time per question, then press Start. Skip counts as a miss. At the end, your misses are listed with explanations and links to the topic pages.'
  },
  gotchas: [{"trap":"Answering with Java rules","why":"<code>-7 // 2</code> is −4 in Python and <code>-7 / 2</code> is −3 in Java; Python has no method overloading and no <code>++</code>.","fix":"Say “in Python” and give the Python rule; mention the Java difference if it helps."},{"trap":"Forgetting that a printed list shows its repr","why":"Strings inside a list print with quotes: <code>[&#39;a&#39;, &#39;b&#39;]</code>, while <code>print(\"a\")</code> shows no quotes.","fix":"When predicting output, apply <code>repr</code> to items inside containers."},{"trap":"Guessing instead of reasoning out loud","why":"An interviewer learns more from “the default list is created once” than from a lucky letter.","fix":"State the rule, apply it to the snippet, then answer."}],
  interview: [{"q":"How do you approach a “what does this print?” question?","a":"<p>Read top to bottom and track every name and the object it points at. Note which calls mutate and which return new objects. Then write down each line of output, including types (<code>3</code> vs <code>3.0</code>) and quotes inside containers.</p>","lvl":"core"},{"q":"Which three beginner traps cause the most real bugs?","a":"<p>1) Mutable default arguments. 2) Aliasing: <code>b = a</code> on a list, then changing one. 3) Ignoring a return value: <code>s.strip()</code> without assigning, or assigning <code>a.sort()</code>.</p>","lvl":"core"},{"q":"How do you check a claim quickly?","a":"<p>Open the REPL (<code>python3</code>) and type it. For types, <code>type(x)</code>; for identity, <code>a is b</code>.</p>","lvl":"core"}]
});

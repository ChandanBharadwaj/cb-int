IA.register({
  track: "nodejs",
  slug: "tricky-nodejs-basics",
  title: 'Basics drill (timed)',
  tagline: "Thirty first-interview questions from the Node.js Basics module, against the clock: what a small script prints, how <code>const</code>, <code>this</code> and <code>==</code> behave, and why one thread can serve many requests.",
  tldr: {
    problem: "A first Node.js interview usually starts with plain JavaScript: a few lines with <code>typeof</code>, a closure, a spread or a <code>setTimeout</code>, and the question “what does this print?”.",
    model: "Most beginner tricks are one of four things: <b>values vs references</b> (objects are shared, <code>const</code> does not freeze), <b>conversion</b> (<code>==</code>, env vars are strings, JSON drops <code>undefined</code>), <b>scope and <code>this</code></b> (closures, hoisting, arrows), and <b>order</b> (sync code first, callbacks later).",
    hook: "<code>setTimeout(fn, 0)</code> still runs after the next <code>console.log</code>. If you can say why in one sentence, start the drill.",
    facts: [
      { v: '30', l: "questions across all 8 Basics topics, from running a script to your first HTTP server" },
      { v: '60 s', l: 'per question by default. Slow (90 s) and Fast (30 s) modes too' },
      { v: "Node 22", l: "LTS is the baseline; every “what does this print” snippet is a complete CommonJS script that was run on it" }
    ]
  },
  intro: {
    what: 'This page is a <b>drill</b>, not a lesson. You get a short snippet or situation, a timer and four answers. Answer in your head, as you would in an interview, then read the explanation. At the end you see your score per topic and a review of every miss, each with a link back to the topic page.',
    analogy: { icon: '⏱️', title: 'Flashcards with a stopwatch', text: "Reading the Node.js basics is not the same as answering in ten seconds with someone watching. Speed comes from having seen the question before." },
    steps: [
      { t: "Read it like the engine", d: "Go line by line. Note every variable and what it points to: a primitive value or a shared object." },
      { t: "Watch the conversions", d: "<code>==</code>, <code>+</code> with a string, <code>Number(undefined)</code>, <code>JSON.stringify</code>: say what type each value has." },
      { t: "Ask “now or later?”", d: "Synchronous code runs to the end first. Timers, promise callbacks and I/O callbacks run afterwards." },
      { t: "Say the rule, then answer", d: "“A function declaration is hoisted, so…” is what the interviewer wants to hear." }
    ],
    terms: [
      ["closure", "A function that keeps access to the variables of the scope it was created in."],
      ["hoisting", "Declarations are processed before the code runs; function declarations are usable early."],
      ["shallow copy", "A copy of the top level only; nested objects are still shared."],
      ["CommonJS", "Node’s original module system: <code>require</code> and <code>module.exports</code>."]
    ]
  },
  visual: {
    title: 'The drill',
    caption: 'Pick a topic (or All), how many questions (10, 20 or all 30), and the time per question, then press Start. Skip counts as a miss. At the end, your misses are listed with explanations and links to the topic pages.'
  },
  gotchas: [
    { trap: "Answering with Java rules", why: "<code>const</code> is not Java’s <code>final</code> on the object, <code>==</code> converts types, and arrays sort as strings by default.", fix: "Say which JavaScript rule applies, then answer." },
    { trap: "Forgetting that Node is one thread for your code", why: "Callbacks never interrupt running code; they wait until the stack is empty.", fix: "Run all synchronous lines first in your head, then the queued callbacks." },
    { trap: "Guessing instead of reasoning out loud", why: "An interviewer learns more from “spread is shallow, so inner is shared” than from a lucky letter.", fix: "State the rule, apply it to the snippet, then answer." }
  ],
  interview: [
    { q: "How do you approach a “what does this print?” question?", a: "<p>Read line by line and track each variable: primitive or object reference? Note conversions. Run all synchronous code first, then callbacks in the order they were queued. Then answer.</p>", lvl: 'core' },
    { q: "What is the difference between <code>let</code>, <code>const</code> and <code>var</code>?", a: "<p><code>let</code> and <code>const</code> are block-scoped; <code>const</code> cannot be re-assigned (the object can still change). <code>var</code> is function-scoped and hoisted as <code>undefined</code>. Use <code>const</code> by default, <code>let</code> when you re-assign.</p>", lvl: 'core' },
    { q: "Why is Node good for I/O-heavy services?", a: "<p>I/O is non-blocking: while the database or network works, the single JavaScript thread handles other requests. CPU-heavy work blocks it, so move that to worker threads or another service.</p>", lvl: 'core' },
    { q: "How do you verify a claim quickly?", a: "<p>Paste the snippet into the <code>node</code> REPL or a file and run it. For a server, <code>curl localhost:3000</code>.</p>", lvl: 'core' }
  ]
});

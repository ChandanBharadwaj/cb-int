IA.register({
  track: "typescript",
  slug: "tricky-typescript-basics",
  title: 'Basics drill (timed)',
  tagline: "Thirty first-interview TypeScript questions from the Basics module, against the clock: what the checker infers, what is a compile error, and what actually happens at runtime once the types are gone.",
  tldr: {
    problem: "A first TypeScript interview checks two things: can you read types (inference, unions, interfaces), and do you know that none of them exist at runtime?",
    model: "Most beginner tricks are one of four things: <b>erasure</b> (types, <code>as</code> and <code>private</code> do nothing at runtime), <b>inference and widening</b> (<code>let</code> vs <code>const</code>), <b>structural typing</b> (shape, not name), and <b>narrowing</b> (the checker follows your <code>if</code>s).",
    hook: "<code>(input as Dir)</code> compiles fine and lets <code>\"left\"</code> through. If you can say why in one sentence, start the drill.",
    facts: [
      { v: '30', l: "questions across all 6 Basics topics, from setup to classes and enums" },
      { v: '60 s', l: 'per question by default. Slow (90 s) and Fast (30 s) modes too' },
      { v: "TS 5.x", l: "is the baseline; every runnable snippet uses erasable syntax only and runs with Node’s type stripping" }
    ]
  },
  intro: {
    what: 'This page is a <b>drill</b>, not a lesson. You get a short snippet or situation, a timer and four answers. Answer in your head, as you would in an interview, then read the explanation. At the end you see your score per topic and a review of every miss, each with a link back to the topic page.',
    analogy: { icon: '⏱️', title: 'Flashcards with a stopwatch', text: "Reading the TypeScript basics is not the same as answering in ten seconds with someone watching. Speed comes from having seen the question before." },
    steps: [
      { t: "Ask “compile time or runtime?”", d: "If the question is about output, delete the types in your head and run the JavaScript." },
      { t: "Ask “what is inferred?”", d: "<code>let</code> widens, <code>const</code> keeps literals, arrays infer a union of element types." },
      { t: "Ask “does the shape fit?”", d: "Types are compared by properties, not names. Fresh object literals get an extra excess-property check." },
      { t: "Ask “what is narrowed here?”", d: "After <code>typeof</code>, <code>in</code>, <code>instanceof</code> or a check on a discriminant, the variable has a smaller type." }
    ],
    terms: [
      ["erasure", "Types are removed when TS is compiled or stripped; the JS has none."],
      ["widening", "A literal type such as <code>\"hi\"</code> becoming <code>string</code> for a mutable variable."],
      ["structural typing", "Compatibility is decided by shape, not by declared names."],
      ["discriminated union", "A union whose members share a literal field (e.g. <code>kind</code>) used to tell them apart."],
      ["type stripping", "Node 22.6+ removing erasable TS syntax and running the rest, without checking types."]
    ]
  },
  visual: {
    title: 'The drill',
    caption: 'Pick a topic (or All), how many questions (10, 20 or all 30), and the time per question, then press Start. Skip counts as a miss. At the end, your misses are listed with explanations and links to the topic pages.'
  },
  gotchas: [
    { trap: "Answering with Java rules", why: "TS types are compared by shape, generics and casts are erased, and <code>private</code> is not enforced at runtime.", fix: "Say “at compile time …, at runtime …” and answer both halves." },
    { trap: "Trusting <code>as</code> and <code>any</code>", why: "Both silence the checker without adding any runtime check.", fix: "Validate untrusted data and narrow <code>unknown</code> instead." },
    { trap: "Guessing instead of reasoning out loud", why: "“<code>let</code> widens, so the type is string” beats a lucky letter.", fix: "State the rule, apply it to the snippet, then answer." }
  ],
  interview: [
    { q: "What does TypeScript do at runtime?", a: "<p>Nothing. It checks while you write and in CI, then the types are erased. Runtime safety at boundaries needs validation (e.g. zod).</p>", lvl: 'core' },
    { q: "<code>any</code> vs <code>unknown</code>?", a: "<p><code>any</code> turns checking off and spreads. <code>unknown</code> accepts any value but forces you to narrow before using it, so it is the safe choice for untrusted data.</p>", lvl: 'core' },
    { q: "interface or type?", a: "<p>Both describe object shapes. Interfaces can be extended and merged; type aliases can also name unions, tuples and mapped types. Pick one convention per codebase; use <code>type</code> for unions.</p>", lvl: 'core' },
    { q: "How do you verify a claim quickly?", a: "<p>The TypeScript Playground shows errors and emitted JS. Locally, <code>tsc --noEmit</code> to check and <code>node --experimental-strip-types file.ts</code> to run.</p>", lvl: 'core' }
  ]
});

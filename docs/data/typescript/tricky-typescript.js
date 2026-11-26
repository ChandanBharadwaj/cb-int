IA.register({
  track: 'typescript',
  slug: 'tricky-typescript',
  title: '★ Tricky TypeScript (timed)',
  tagline: 'Forty “what type is this / what does it print / does it compile” questions from every TypeScript topic, against the clock. About a third are small, complete programs that run with Node 22’s type stripping. The rest are type-level puzzles you answer by evaluating the checker in your head.',
  tldr: {
    problem: 'Senior TypeScript interviews rarely ask you to write a type from scratch. They show you five lines and ask what the checker infers, whether it compiles, or what actually happens at runtime after the types are erased.',
    model: 'Almost every trick is one of five things: <b>erasure</b> (types, <code>as</code>, <code>!</code>, <code>private</code> and brands do nothing at runtime), <b>structural typing</b> (shapes, not names; excess property checks only on fresh literals), <b>inference and widening</b> (literals, <code>const</code>, distribution over unions), <b>trusted holes</b> (<code>any</code>, index access, optional = undefined), and <b>module rules</b> (the checker models a runtime; <code>tsc</code> never rewrites imports).',
    hook: '<code>type A = ToArray&lt;string | boolean&gt;</code> with a distributive <code>T extends unknown ? T[] : never</code> has <b>three</b> members, not two. If you can say why in one sentence, start the drill.',
    facts: [
      { v: '40', l: 'questions covering all 13 topic pages of the TypeScript track, grouped by module: Basics, Going deeper, Practice' },
      { v: '60 s', l: 'per question by default. Slow (90 s) and Fast (30 s) modes too' },
      { v: '12', l: 'of them are complete programs with an exact expected output, written in erasable syntax so <code>node --experimental-strip-types</code> (Node 22) runs them' }
    ]
  },
  intro: {
    what: 'This page is a <b>drill</b>, not a lesson. You get a short snippet, a timer, and four answers. Answer in your head, as you would in an interview, then read the explanation. At the end you get your score per topic and a review of every miss, each with a link back to the topic page that explains it.',
    analogy: { icon: '⏱️', title: 'Chess puzzles for TypeScript', text: 'Chess players improve by solving positions quickly, not by reading about openings. Each question here is a “position”: a few lines where the obvious answer is wrong for one specific reason.' },
    steps: [
      { t: 'First ask: compile time or runtime?', d: 'If the question is “what prints”, mentally delete every type annotation, <code>as</code>, <code>!</code>, <code>private</code> and <code>satisfies</code>, then run the JavaScript that remains.', code: 'const n = scores[\'bob\']!;   // runtime: const n = scores[\'bob\'];' },
      { t: 'For types, find the inference site', d: 'Which argument or initialiser decides T? Is the literal widened (<code>let</code>, non-const parameter) or kept (<code>const</code>, top-level return, <code>const T</code>)?' },
      { t: 'Spot the union and distribute', d: 'A conditional on a naked type parameter runs once per union member. <code>boolean</code> is a union; <code>never</code> is an empty one.', code: 'T extends U ? X : Y   // T = A | B  →  (A extends U ? X : Y) | (B extends U ? X : Y)' },
      { t: 'Check what the flags say', d: 'Many answers depend on <code>strict</code>, <code>noUncheckedIndexedAccess</code>, <code>exactOptionalPropertyTypes</code> and <code>module</code>. Assume defaults unless the question says otherwise, and say so in an interview.' }
    ],
    terms: [
      ['erasure', 'All type syntax is removed before the code runs.'],
      ['widening', 'A literal type like <code>"hi"</code> becoming <code>string</code> when stored in a mutable place.'],
      ['distribution', 'A conditional type applied separately to each member of a union.'],
      ['excess property check', 'An error for unknown properties, applied only to fresh object literals.'],
      ['erasable syntax', 'TypeScript syntax that can be deleted without changing behaviour; enums, namespaces and parameter properties are not.']
    ]
  },
  visual: {
    title: 'The drill',
    caption: 'Choose a module (or All), how many questions and the time per question, then press <b>Start</b>. Pick an answer before the bar runs out; <b>Skip</b> counts as a miss. At the end, click a topic in the breakdown to open its page, and read the review of your misses.'
  },
  gotchas: [
    { trap: 'Reading types as runtime behaviour', why: 'Most “what prints” questions hinge on something the type system claims but the runtime ignores: an assertion, a <code>!</code>, <code>private</code>, a brand, a <code>Partial</code> with explicit <code>undefined</code>.', fix: 'Strip the types in your head first and evaluate plain JavaScript. See <a href="ts-runtime-validation.html">Types vs runtime</a> and <a href="ts-strict-mode.html">Strict mode</a>.' },
    { trap: 'Forgetting that boolean and never are unions', why: '<code>boolean</code> is <code>true | false</code>; <code>never</code> is the empty union. Both change the result of distributive conditional types.', fix: 'Expand unions before evaluating a conditional. See <a href="ts-mapped-conditional.html">Mapped & conditional types</a>.' },
    { trap: 'Assuming excess property checks always apply', why: 'They only fire for fresh object literals assigned to a target type. Through a variable, any object with the required members is accepted.', fix: 'Remember “fresh literal → strict; anything else → structural”. See <a href="ts-objects-interfaces.html">Objects & interfaces</a>.' },
    { trap: 'Answering without stating the flags', why: 'Index access, optional properties, catch variables and module resolution all change with tsconfig. Interviewers often leave it implicit on purpose.', fix: 'Say “with default settings…” or “with <code>noUncheckedIndexedAccess</code> it would be…”. That alone signals seniority.' }
  ],
  interview: [
    { q: 'How do you approach a “what does this print” question in TypeScript?', a: '<p>Erase first: remove annotations, <code>as</code>, <code>!</code>, <code>satisfies</code>, access modifiers and type-only declarations. Watch for the few things that are <b>not</b> erasable (enums, namespaces, parameter properties, decorators) because they generate code. Then evaluate the JavaScript that remains. Finally, compare that with what the types claimed: the gap is usually the point of the question.</p>', lvl: 'core' },
    { q: 'And for a “what type is this” question?', a: '<p>Find the inference sites and the widening rules: <code>const</code> vs <code>let</code>, literal kept at the top level of a return type, <code>const</code> type parameters (5.0), <code>NoInfer</code> (5.4). Expand unions and check whether a conditional is distributive. For mapped types, ask whether they are homomorphic (<code>keyof T</code> on a type parameter), which preserves modifiers and distributes over unions.</p>', lvl: 'deep' },
    { q: 'Which three TypeScript traps cause the most production bugs?', a: '<p>1) Trusting unvalidated external data (<code>as</code> on JSON, <code>any</code> from <code>JSON.parse</code>). 2) Trusted index access without <code>noUncheckedIndexedAccess</code>. 3) Module/config mismatches between the checker and the runtime (<code>paths</code>, <code>bundler</code> resolution for Node, missing <code>import type</code>).</p>', lvl: 'core' },
    { q: 'You are not sure of the answer. What do you say?', a: '<p>Narrow it down out loud: “It is either the union or <code>string</code>, depending on whether the literal is widened. T appears at the top level of the return type, so I believe it is kept: the union.” Then say how you would verify it in a minute: hover in the editor, the TS Playground, or <code>tsc --noEmit</code> on a two-line file.</p>', lvl: 'core' },
    { q: 'How do you check a type-level claim quickly?', a: '<p>Write a tiny assertion type and let the compiler judge it: <code>type Expect&lt;T extends true&gt; = T; type Equal&lt;A, B&gt; = (&lt;T&gt;() =&gt; T extends A ? 1 : 2) extends (&lt;T&gt;() =&gt; T extends B ? 1 : 2) ? true : false;</code> then <code>type _ = Expect&lt;Equal&lt;X, string[] | number[]&gt;&gt;</code>. Libraries like <code>expect-type</code> and Vitest’s <code>expectTypeOf</code> package the same idea for tests.</p>', lvl: 'deep' }
  ]
});

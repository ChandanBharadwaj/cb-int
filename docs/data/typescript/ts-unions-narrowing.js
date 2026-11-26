IA.register({
  track: 'typescript',
  slug: 'ts-unions-narrowing',
  title: 'Unions & narrowing',
  tagline: 'A union says “one of these”. <b>Narrowing</b> is the checker following your <code>if</code>s and <code>switch</code>es, so a variable’s type gets more precise line by line. Discriminated unions plus a <code>never</code> check give you Java’s sealed-interface safety.',
  tldr: {
    problem: 'Real data is “a string or a number”, “ok or error”, “loading, loaded or failed”. Without unions you fall back to <code>any</code> or nullable fields and hope every case is handled.',
    model: 'TS does <b>control-flow analysis</b>: after <code>typeof x === "string"</code>, an <code>in</code> check, <code>instanceof</code>, an equality check or a type guard, it removes the impossible members from the union for that branch.',
    hook: '“How do you make sure every case of a union is handled?” Switch on the tag and assign the leftover to <code>never</code> in <code>default</code>. Adding a new member then breaks the build until you handle it.',
    facts: [
      { v: '"object"', l: 'is what <code>typeof null</code> returns, so a <code>typeof x === "object"</code> check does not exclude <code>null</code>' },
      { v: 'A | never = A', l: '<code>never</code> disappears from unions, which is why it works as the “nothing left” type' },
      { v: 'TS 5.5', l: 'added inferred type predicates: <code>arr.filter(x =&gt; x !== undefined)</code> now narrows the element type' }
    ]
  },
  intro: {
    what: 'A <b>union type</b> like <code>string | number</code> means a value can be either. Before using it as one or the other, you check which one it is. TypeScript reads your checks and <b>narrows</b> the type inside each branch. A <b>literal union</b> like <code>"GET" | "POST"</code> lists the exact allowed values, which replaces many enums.',
    analogy: { icon: '📦', title: 'A parcel with a label', text: 'A parcel might hold shoes or a book. You read the label (the <code>kind</code> field) before opening it, and after that you know exactly what is inside. A discriminated union is a parcel that always carries a label, and an exhaustiveness check is a sorting machine that refuses to run if there is a label it has no chute for.' },
    steps: [
      { t: 'Union types', d: 'A vertical bar between types.', code: 'let id: string | number;\nid = "a1";\nid = 42;' },
      { t: 'Literal unions', d: 'Exact values as types. Typos become errors.', code: 'type Method = "GET" | "POST";\nlet m: Method = "GET";\nm = "PUT";   // error' },
      { t: 'Narrow with a check', d: 'Inside the branch, the type is precise.', code: 'function len(x: string | string[]) {\n  if (typeof x === "string") return x.length; // x: string\n  return x.length;                            // x: string[]\n}' },
      { t: 'Tag your objects', d: 'A common literal field (the <b>discriminant</b>) makes switching easy and safe.', code: 'type Result =\n  | { ok: true; value: number }\n  | { ok: false; error: string };' }
    ],
    terms: [
      ['union (A | B)', 'A value of type A or type B.'],
      ['literal type', 'A type with one value: <code>"GET"</code>, <code>42</code>, <code>true</code>.'],
      ['narrowing', 'The checker refining a union inside a branch after a check.'],
      ['type guard', 'A check that narrows: <code>typeof</code>, <code>instanceof</code>, <code>in</code>, or a function returning <code>x is T</code>.'],
      ['discriminated union', 'A union of object types that share a literal “tag” property.'],
      ['exhaustiveness check', 'Assigning the leftover to <code>never</code> so a missing case is a compile error.']
    ]
  },
  visual: {
    title: 'Watch the type narrow',
    caption: 'Step through a function and watch the type of the variable change on the right as each check runs. The last tab shows how an exhaustiveness check turns a forgotten case into a compile error.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'typeof table', code: `for (const v of ["s", 1, 1n, true, undefined, null, {}, [], () => 1, Symbol("x")]) {\n  console.log(String(typeof v).padEnd(10), Array.isArray(v) ? "(array)" : "");\n}`, note: 'Plain JavaScript (types erased). <code>typeof null</code> is <code>"object"</code>, and arrays are <code>"object"</code> too: use <code>Array.isArray</code>.' },
      { label: 'Truthiness trap', code: `function label(n) { return n ? "n=" + n : "none"; }\nconsole.log(label(0), label(5), label(undefined));\nfunction label2(n) { return n !== undefined ? "n=" + n : "none"; }\nconsole.log(label2(0), label2(5), label2(undefined));`, note: 'Plain JavaScript. A truthiness check narrows <code>number | undefined</code> to <code>number</code>, but also throws away <code>0</code>.' }
    ]
  },
  gotchas: [
    { trap: '<code>typeof x === "object"</code> includes null', code: `function keys(x: object | null) {\n  if (typeof x === "object") return Object.keys(x);  // TS: x is object | null\n}`, why: 'A historical JavaScript quirk: <code>typeof null</code> is <code>"object"</code>. TS models it correctly, so it keeps <code>null</code> in the narrowed type.', fix: 'Check <code>x !== null</code> as well (or <code>x != null</code> to exclude both null and undefined).' },
    { trap: 'Truthiness narrowing drops 0 and ""', code: `function show(count?: number) {\n  return count ? \`\${count} items\` : "no data";  // 0 → "no data"\n}`, why: '<code>0</code>, <code>""</code>, <code>NaN</code> and <code>false</code> are falsy. The check narrows correctly but also rejects valid values.', fix: 'Compare explicitly: <code>count !== undefined</code>, or use <code>??</code> instead of <code>||</code> for defaults.' },
    { trap: 'Narrowing is lost in callbacks', code: `let user: User | undefined = getUser();\nif (user) {\n  setTimeout(() => user.name, 0);   // error: user possibly undefined\n}`, why: 'A <code>let</code> can be reassigned before the callback runs, so TS resets the narrowing inside closures.', fix: 'Copy into a <code>const</code> first: <code>const u = user;</code>. (TS 5.4 keeps narrowing in closures after the last assignment, which helps in many cases.)' },
    { trap: 'A lying type guard', code: `function isUser(x: unknown): x is User {\n  return typeof x === "object";   // also true for null, and for {}\n}`, why: 'TS trusts a user-defined type predicate completely. If the body is wrong, everything downstream is mistyped.', fix: 'Check every property you rely on, or use a schema library. Test the guard with bad inputs.' },
    { trap: 'No exhaustiveness check in a switch', code: `type Status = "active" | "paused" | "closed";\nfunction color(s: Status) {\n  switch (s) { case "active": return "green"; case "paused": return "amber"; }\n}   // returns undefined for "closed", type: string | undefined`, why: 'Without a <code>default</code> that asserts <code>never</code>, a new member compiles fine and falls through.', fix: 'Add <code>default: return assertNever(s)</code>, or annotate the return type (<code>: string</code>) so a missing case is an error.' },
    { trap: '<code>instanceof</code> on interfaces or plain objects', why: 'Interfaces don’t exist at runtime. <code>x instanceof User</code> only works if <code>User</code> is a class and the object was created with <code>new</code>. JSON-parsed objects are never instances.', fix: 'Use a discriminant field or an <code>in</code> check for plain data. Keep <code>instanceof</code> for classes such as <code>Error</code>.' }
  ],
  scenarios: [
    { title: 'Refunds silently skipped after a new payment state',
      symptom: 'A new <code>"partially_refunded"</code> status shipped. Ledger entries for those payments were never written. No errors anywhere.',
      diagnose: `switch (p.status) {\n  case "paid": ...; break;\n  case "refunded": ...; break;\n  // no default\n}`,
      cause: 'The switch had no exhaustiveness check, so adding a union member compiled cleanly and fell through.',
      fix: 'Add a <code>never</code> default to every switch over a status union, and make the function return a value so missing cases fail to compile.',
      fixCode: `default: {\n  const unhandled: never = p.status;\n  throw new Error(\`unhandled status \${unhandled}\`);\n}` },
    { title: 'Retry counter never retries the first attempt',
      symptom: 'A job with <code>attempt = 0</code> is treated as “no attempt info” and is dropped.',
      diagnose: `function nextDelay(attempt?: number) {\n  if (!attempt) return null;     // 0 is falsy\n  return 2 ** attempt * 100;\n}`,
      cause: 'Truthiness narrowing used to exclude <code>undefined</code> also excluded <code>0</code>.',
      fix: 'Compare against <code>undefined</code> explicitly.',
      fixCode: `if (attempt === undefined) return null;` },
    { title: 'UI shows a spinner forever on error',
      symptom: 'When the API fails, the page keeps spinning. State is modelled as <code>{ loading: boolean; data?: T; error?: string }</code>.',
      diagnose: `setState({ ...state, error: e.message });   // forgot loading: false\n// render: if (state.loading) return <Spinner/>`,
      cause: 'Independent optional flags allow impossible combinations (loading <i>and</i> error).',
      fix: 'Model it as a discriminated union so each state carries exactly its own data.',
      fixCode: `type State<T> =\n  | { status: "loading" }\n  | { status: "ok"; data: T }\n  | { status: "error"; error: string };` }
  ],
  puzzles: [
    { kind: 'output', q: 'What does it print?', code: `function kind(x: string | object | null): string {\n  if (typeof x === "object") return x === null ? "null" : "object";\n  return "string";\n}\nconsole.log(kind(null), kind({}), kind("s"));`, options: ['object object string', 'null object string', 'null null string', 'It does not compile'], answer: 1, explain: '<code>typeof null</code> is <code>"object"</code>, so null enters the first branch, where the explicit null check separates it.', run: true, expect: 'null object string' },
    { kind: 'output', q: 'What does it print?', code: `type Shape = { kind: "circle"; r: number } | { kind: "square"; s: number };\nfunction area(sh: Shape): number {\n  switch (sh.kind) {\n    case "circle": return 3 * sh.r * sh.r;\n    case "square": return sh.s * sh.s;\n  }\n}\nconsole.log(area({ kind: "circle", r: 2 }), area({ kind: "square", s: 3 }));`, options: ['12 9', '12 undefined', 'It does not compile: missing return', 'NaN 9'], answer: 0, explain: 'The switch is exhaustive, so TS accepts the <code>: number</code> return type with no default. 3·2·2 = 12, 3·3 = 9.', run: true, expect: '12 9' },
    { kind: 'output', q: 'What does it print?', code: 'function label(n: number | undefined): string {\n  return n ? `n=${n}` : "none";\n}\nconsole.log(label(0), label(5), label(undefined));', options: ['n=0 n=5 none', 'none n=5 none', 'n=0 n=5 n=undefined', 'none n=5 n=undefined'], answer: 1, explain: '<code>0</code> is falsy, so it takes the <code>"none"</code> branch. Use <code>n !== undefined</code>.', run: true, expect: 'none n=5 none' },
    { kind: 'output', q: 'What does it print?', code: `class Dog { bark() { return "woof"; } }\nconst fake = { bark: () => "fake" } as Dog;\nconsole.log(fake instanceof Dog, "bark" in fake, fake.bark());`, options: ['true true fake', 'false true fake', 'false false woof', 'true true woof'], answer: 1, explain: 'The assertion fools the checker, not the runtime. <code>instanceof</code> checks the prototype chain, which the literal does not have. <code>in</code> just checks for the property.', run: true, expect: 'false true fake' },
    { kind: 'concept', q: 'After this check, what is the type of <code>v</code> in the else branch?', code: `function f(v: string | number | boolean) {\n  if (typeof v === "string" || typeof v === "boolean") { … }\n  else { v }\n}`, options: ['<code>number</code>', '<code>string | number | boolean</code>', '<code>never</code>', '<code>unknown</code>'], answer: 0, explain: 'The else branch gets whatever the condition did not cover. Only <code>number</code> is left.' },
    { kind: 'concept', q: 'You add <code>{ kind: "triangle"; b: number; h: number }</code> to <code>Shape</code>. Where does TypeScript report an error?', code: `function area(s: Shape): number {\n  switch (s.kind) {\n    case "circle": return Math.PI * s.r ** 2;\n    case "square": return s.s ** 2;\n    default: { const x: never = s; return x; }\n  }\n}`, options: ['Nowhere; it returns undefined for triangles', 'On the <code>const x: never = s</code> line', 'On the <code>switch</code> line', 'At the call site'], answer: 1, explain: 'In <code>default</code>, <code>s</code> is now the triangle type, which is not assignable to <code>never</code>. The error points you to the missing case.' },
    { kind: 'concept', q: 'What is the type of <code>ids</code> in TypeScript 5.5+?', code: `const raw: (string | undefined)[] = ["a", undefined, "b"];\nconst ids = raw.filter((x) => x !== undefined);`, options: ['<code>(string | undefined)[]</code>', '<code>string[]</code>', '<code>any[]</code>', '<code>undefined[]</code>'], answer: 1, explain: 'TS 5.5 infers that the arrow function is a type predicate (<code>x is string</code>), so <code>filter</code> narrows. Before 5.5 the result stayed <code>(string | undefined)[]</code>.' }
  ],
  interview: [
    { q: 'What is a union type?', a: '<p><code>A | B</code>: a value that is an A or a B. You can only use members common to all parts until you narrow. Literal unions (<code>"a" | "b"</code>) describe a fixed set of values.</p>', lvl: 'core' },
    { q: 'What is narrowing, and which checks narrow?', a: '<p>Control-flow analysis refines a union inside branches. Narrowing checks: <code>typeof</code>, <code>instanceof</code>, <code>in</code>, equality (<code>===</code>, <code>!== null</code>), truthiness, discriminant checks, <code>Array.isArray</code>, user-defined type predicates (<code>x is T</code>) and assertion functions (<code>asserts x is T</code>).</p>', lvl: 'core' },
    { q: 'What is a discriminated union?', a: '<p>A union of object types with a common property whose type is a different literal in each member (<code>kind</code>, <code>type</code>, <code>status</code>). Checking it narrows the whole object. It is the TS equivalent of a Java sealed interface with records, and of Redux actions.</p>', fu: 'Can the discriminant be a boolean? (yes: <code>{ ok: true; … } | { ok: false; … }</code>)', lvl: 'core' },
    { q: 'How do you write an exhaustiveness check?', a: '<p>In <code>default</code>, assign the narrowed value to a <code>never</code> variable or pass it to <code>assertNever(x: never): never</code>. If a member is unhandled, the value is not <code>never</code> and compilation fails. Annotating the return type also catches missing cases.</p>', lvl: 'core' },
    { q: 'What is a user-defined type guard?', a: '<p>A function returning <code>param is T</code>: <code>function isFish(p: Fish | Bird): p is Fish</code>. When it returns true, the caller narrows to <code>Fish</code>. TS trusts it fully, so the body must really check.</p>', lvl: 'core' },
    { q: 'Type predicate vs assertion function?', a: '<p>A predicate returns a boolean and narrows in the <code>if</code>. An assertion function (<code>asserts x is T</code>) returns nothing and throws on failure; after the call, the type is narrowed for the rest of the scope. Like Spring’s <code>Assert.notNull</code>, but the compiler understands it.</p>', lvl: 'deep' },
    { q: 'Why does narrowing sometimes not survive into a callback?', a: '<p>A mutable variable (<code>let</code>, a property) could change before the callback runs. TS resets narrowing in closures unless it can prove no later assignment (improved in TS 5.4). Copy to a <code>const</code> to keep it.</p>', lvl: 'deep' },
    { q: 'Union vs intersection: what can you access?', a: '<p>On <code>A | B</code>, only members both have. On <code>A &amp; B</code>, members of either. Think in sets of values: a union is a bigger set (fewer guarantees), an intersection a smaller set (more guarantees).</p>', lvl: 'deep' },
    { q: 'How would you model API state in a UI?', a: '<p>A discriminated union: <code>{ status: "idle" } | { status: "loading" } | { status: "ok"; data: T } | { status: "error"; error: E }</code>. It removes impossible states like “loading with an error”.</p>', lvl: 'core' },
    { q: 'What does the <code>in</code> operator narrow?', a: '<p><code>"swim" in a</code> narrows to union members that declare <code>swim</code> (required or optional) in the true branch, and to those that don’t declare it in the false branch. Since TS 4.9 it also narrows unlisted properties to <code>Record&lt;"swim", unknown&gt;</code>.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Result type instead of exceptions', code: `export type Result<T, E = string> =\n  | { ok: true; value: T }\n  | { ok: false; error: E };\n\nexport async function fetchUser(id: string): Promise<Result<User>> {\n  const res = await fetch(\`/api/users/\${id}\`);\n  if (!res.ok) return { ok: false, error: \`HTTP \${res.status}\` };\n  return { ok: true, value: (await res.json()) as User };\n}\n\nconst r = await fetchUser('u1');\nif (r.ok) console.log(r.value.name);\nelse console.error(r.error);` },
    { title: 'Exhaustive event handling', code: `type DomainEvent =\n  | { type: 'OrderPlaced'; orderId: string; total: number }\n  | { type: 'OrderShipped'; orderId: string; carrier: string }\n  | { type: 'OrderCancelled'; orderId: string; reason: string };\n\nexport function assertNever(x: never): never {\n  throw new Error('unhandled: ' + JSON.stringify(x));\n}\n\nexport function apply(e: DomainEvent) {\n  switch (e.type) {\n    case 'OrderPlaced': return ledger.debit(e.orderId, e.total);\n    case 'OrderShipped': return notify(e.orderId, e.carrier);\n    case 'OrderCancelled': return ledger.void(e.orderId, e.reason);\n    default: return assertNever(e);\n  }\n}`, note: 'Java 21 equivalent: a <code>sealed interface DomainEvent permits …</code> with records, and a pattern-matching <code>switch</code> without <code>default</code>.' },
    { title: 'Java 21 sealed types, side by side', lang: 'java', code: `sealed interface Shape permits Circle, Square {}\nrecord Circle(double r) implements Shape {}\nrecord Square(double s) implements Shape {}\n\ndouble area(Shape s) {\n  return switch (s) {          // exhaustive: compile error if a case is missing\n    case Circle c -> Math.PI * c.r() * c.r();\n    case Square q -> q.s() * q.s();\n  };\n}` }
  ]
});

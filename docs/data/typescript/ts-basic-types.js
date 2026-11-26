IA.register({
  track: 'typescript',
  slug: 'ts-basic-types',
  title: 'Basic types',
  tagline: 'A handful of primitives, arrays and tuples, and two escape hatches. Learn when TypeScript <b>infers</b> a type, when it <b>widens</b> it, and why <code>unknown</code> beats <code>any</code>.',
  tldr: {
    problem: 'Java developers over-annotate (noise) or reach for <code>any</code> when stuck (no checking). Both waste the type system.',
    model: 'Types are <b>sets of values</b>. <code>string</code> is every string, <code>"dark"</code> is a set of one. <code>unknown</code> is every value (safe), <code>never</code> is no value, and <code>any</code> means “stop checking”.',
    hook: '“<code>any</code> vs <code>unknown</code>?” Both accept anything. <code>unknown</code> forces you to narrow before use; <code>any</code> lets you do anything and spreads.',
    facts: [
      { v: '1 number', l: 'type for all numbers: 64-bit IEEE 754 floats, like Java’s <code>double</code>. <code>bigint</code> is separate' },
      { v: '2^53 − 1', l: '<code>Number.MAX_SAFE_INTEGER</code>. Larger integers lose precision; use <code>bigint</code> or strings for big ids' },
      { v: 'null ≠ undefined', l: 'two separate “empty” values in JS. With <code>strictNullChecks</code>, neither fits in <code>string</code> unless you say so' }
    ]
  },
  intro: {
    what: 'A <b>type</b> says what values a variable can hold. TypeScript has the JavaScript primitives (<code>string</code>, <code>number</code>, <code>boolean</code>, <code>bigint</code>, <code>symbol</code>, <code>null</code>, <code>undefined</code>), arrays, tuples and objects. You rarely write types for local variables: the compiler <b>infers</b> them from the value.',
    analogy: { icon: '🏷️', title: 'Labels on boxes', text: 'A type is a label on a box saying what may go in. <code>number</code> means “any number”. <code>"dark"</code> means “only the word dark”. <code>unknown</code> is a box marked “could be anything, check before opening”. <code>any</code> is a box with the label torn off: nobody checks, so surprises happen later.' },
    steps: [
      { t: 'Annotate with a colon', d: 'Type after the name, opposite of Java.', code: 'let name: string = "Ana";\nlet age: number = 41;\nlet admin: boolean = false;' },
      { t: 'Or let inference do it', d: 'The same types, without annotations. This is the normal style.', code: 'let name = "Ana";   // string\nlet age = 41;       // number' },
      { t: 'Arrays and tuples', d: 'Two ways to write arrays. A tuple fixes length and position types.', code: 'const ids: number[] = [1, 2];\nconst tags: Array<string> = ["a"];\nconst entry: [string, number] = ["age", 41];' },
      { t: 'When you don’t know the type', d: 'Use <code>unknown</code> and check before use. Avoid <code>any</code>.', code: 'const data: unknown = JSON.parse(text);\nif (typeof data === "string") data.length;' }
    ],
    terms: [
      ['inference', 'The compiler works out a type from the value, so you don’t have to write it.'],
      ['literal type', 'A type with exactly one value, such as <code>"dark"</code> or <code>42</code>.'],
      ['widening', 'Turning a literal type into its general type (<code>"dark"</code> → <code>string</code>) for a mutable variable.'],
      ['tuple', 'A fixed-length array type with a type per position: <code>[string, number]</code>.'],
      ['any', 'Opt out of checking for a value. Spreads to everything derived from it.'],
      ['unknown', 'Any value is allowed in, but you must narrow it before using it.']
    ]
  },
  visual: {
    title: 'What the checker infers, line by line',
    caption: 'Choose an example and press Step. The right panel shows the type TypeScript has for each name at the highlighted line. Red marks a compile error; amber marks something the checker allows but you should not rely on.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'One number type', code: `console.log(7 / 2);                 // 3.5, no integer division\nconsole.log(0.1 + 0.2);             // floating point\nconsole.log(Number.MAX_SAFE_INTEGER);\nconsole.log(9007199254740993);      // precision lost\nconsole.log(9007199254740993n);     // bigint keeps it\nconsole.log(typeof 1, typeof 1n);`, note: 'Plain JavaScript (types erased). <code>number</code> and <code>bigint</code> are different types and don’t mix: <code>1n + 1</code> throws.' },
      { label: 'null vs undefined', code: `const o = { a: null };\nconsole.log(o.a, o.b);              // null undefined\nconsole.log(typeof null, typeof undefined);\nconsole.log(null == undefined, null === undefined);\nconsole.log(JSON.stringify({ a: null, b: undefined }));`, note: 'Plain JavaScript. <code>JSON.stringify</code> drops <code>undefined</code> properties but keeps <code>null</code>.' }
    ]
  },
  gotchas: [
    { trap: '<code>any</code> is contagious', code: `const cfg: any = loadConfig();\nconst port = cfg.server.port;   // any\nconst n = port + 1;             // any — a string "80801" at runtime?`, why: 'Everything you read from an <code>any</code> is <code>any</code> too, so one escape hatch silently turns off checking in a whole call chain.', fix: 'Use <code>unknown</code> and narrow, or give the value a real type at the boundary. Turn on the <code>no-explicit-any</code> lint rule.' },
    { trap: 'Uppercase <code>String</code>, <code>Number</code>, <code>Object</code>', why: 'These are the wrapper object types, not the primitives. They accept more than you want and are almost never what you mean (unlike Java, where <code>Integer</code> is common).', fix: 'Always write lowercase <code>string</code>, <code>number</code>, <code>boolean</code>. For “any object” use <code>object</code> or <code>Record&lt;string, unknown&gt;</code>.' },
    { trap: 'Array index reads are typed as always present', code: `const xs: string[] = [];\nconst first = xs[0];        // type: string\nfirst.toUpperCase();        // runtime TypeError`, why: 'By default TS assumes the index is in range.', fix: 'Enable <code>noUncheckedIndexedAccess</code>: <code>xs[0]</code> becomes <code>string | undefined</code>. Or use <code>xs.at(0)</code>, which is already typed <code>T | undefined</code>.' },
    { trap: 'Tuples allow <code>push</code>', code: `const p: [number, number] = [0, 0];\np.push(3);   // compiles; length is now 3`, why: 'Tuples are arrays, and the array methods are still there. A known hole in the type system.', fix: 'Use <code>readonly [number, number]</code> for fixed pairs.' },
    { trap: 'Empty array literal without a type', code: `const out = [];          // any[] that "evolves"\nout.push(1);\nconst copy = out;        // number[] here, but fragile`, why: 'With <code>noImplicitAny</code>, an unannotated <code>[]</code> becomes an evolving array whose type follows the pushes. It reads oddly and breaks when the pushes move.', fix: 'Annotate empty collections: <code>const out: number[] = []</code>.' },
    { trap: 'Big ids as <code>number</code>', code: `JSON.parse('{"id": 9007199254740993}').id   // 9007199254740992`, why: 'JSON numbers become IEEE doubles. Postgres <code>bigint</code> or Snowflake-style ids above 2^53 silently change.', fix: 'Send 64-bit ids as strings and type them as <code>string</code> (or a branded type).' }
  ],
  scenarios: [
    { title: 'Order ids collide after a database migration',
      symptom: 'Two different orders show the same id in the admin UI. The Java backend has no duplicates.',
      diagnose: `// Java sends Long ids as JSON numbers\n{ "id": 9007199254740993 }\n// in the browser:\nNumber.isSafeInteger(order.id)   // false`,
      cause: 'Ids passed 2^53 after switching to a Snowflake-style generator. JavaScript numbers can’t represent them, so neighbours round to the same value.',
      fix: 'Serialize 64-bit ids as strings on the Java side, and type them as <code>string</code> in TS.',
      fixCode: `// Jackson\n@JsonSerialize(using = ToStringSerializer.class)\nprivate Long id;\n// TypeScript\ninterface Order { id: string }`, lang: 'java' },
    { title: '“toUpperCase of undefined” in code with no <code>any</code> in sight',
      symptom: 'A crash in a function whose parameter is typed <code>string</code>.',
      diagnose: `// three files away:\nconst row: any = await db.query(sql);\nrender(row.title);   // any flows into a string parameter`,
      cause: 'An <code>any</code> from an untyped database call passed straight into typed code. <code>any</code> is assignable to everything, so the compiler never complained.',
      fix: 'Type the boundary: return <code>unknown</code> or a declared row type from the data layer, and lint against explicit <code>any</code>.',
      fixCode: `async function getPost(id: string): Promise<Post | undefined> {\n  const rows = await db.query<Post>(sql, [id]);\n  return rows[0];\n}` }
  ],
  puzzles: [
    { kind: 'output', q: 'What does it print?', code: `const pair: [string, number] = ["a", 1];\npair.push(2);\nconsole.log(pair.length, JSON.stringify(pair));`, options: ['It does not compile', '2 ["a",1]', '3 ["a",1,2]', 'It throws at runtime'], answer: 2, explain: '<code>push</code> is allowed on a mutable tuple type, and at runtime it is a normal array. Use <code>readonly</code> tuples to prevent this.', run: true, expect: '3 ["a",1,2]' },
    { kind: 'output', q: 'What does it print?', code: `const n: number = Number("abc");\nconsole.log(n, typeof n, n === n);`, options: ['undefined undefined false', 'NaN number false', 'NaN NaN true', '0 number true'], answer: 1, explain: '<code>NaN</code> is a <code>number</code>, so the type is correct but the value is useless. <code>NaN</code> is the only value not equal to itself. Check with <code>Number.isNaN</code>.', run: true, expect: 'NaN number false' },
    { kind: 'output', q: 'What does it print?', code: `const xs: readonly number[] = [3, 1, 2];\n(xs as number[]).sort();\nconsole.log(xs.join(","));`, options: ['3,1,2', '1,2,3', 'It throws: array is frozen', 'It does not compile'], answer: 1, explain: '<code>readonly</code> is a compile-time view. The cast removes it and <code>sort</code> mutates the real array. For runtime immutability use <code>Object.freeze</code>.', run: true, expect: '1,2,3' },
    { kind: 'concept', q: 'What type does TypeScript infer for <code>b</code>?', code: `const a = "GET";\nlet b = a;`, options: ['<code>"GET"</code>', '<code>string</code>', '<code>any</code>', '<code>const</code>'], answer: 1, explain: '<code>a</code> is the literal type <code>"GET"</code>. Copying it into a <code>let</code> widens to <code>string</code>, because <code>b</code> could be reassigned.' },
    { kind: 'concept', q: 'Which line is a compile error?', code: `const v: unknown = 42;\nconst a = v as number;        // 1\nconst b: number = v;          // 2\nif (typeof v === "number") v.toFixed();  // 3\nconst c: unknown = "x";       // 4`, options: ['1', '2', '3', '4'], answer: 1, explain: '<code>unknown</code> is not assignable to <code>number</code> without a check or an assertion. Line 1 asserts (allowed, unchecked), line 3 narrows, line 4 stores into <code>unknown</code>.' },
    { kind: 'concept', q: 'What type is inferred for <code>m</code>?', code: `const m = [1, "two", true];`, options: ['<code>[number, string, boolean]</code>', '<code>(number | string | boolean)[]</code>', '<code>any[]</code>', '<code>unknown[]</code>'], answer: 1, explain: 'Array literals infer an array of the union of element types. Write <code>as const</code> (readonly tuple) or annotate a tuple type to get positions.' },
    { kind: 'concept', q: 'Under <code>strictNullChecks</code>, which assignment compiles?', options: ['<code>let s: string = null;</code>', '<code>let s: string = undefined;</code>', '<code>let s: string | null = null;</code>', '<code>let n: number = undefined as unknown;</code>'], answer: 2, explain: 'With strict null checks, <code>null</code> and <code>undefined</code> are their own types. You opt in with a union.' }
  ],
  interview: [
    { q: 'What primitive types does TypeScript have?', a: '<p>The JavaScript ones: <code>string</code>, <code>number</code>, <code>boolean</code>, <code>bigint</code>, <code>symbol</code>, <code>null</code>, <code>undefined</code>. Plus type-system-only types: <code>any</code>, <code>unknown</code>, <code>never</code>, <code>void</code>, and literal types.</p>', lvl: 'core' },
    { q: '<code>any</code> vs <code>unknown</code>?', a: '<p>Both accept every value. <code>any</code> also lets you do anything with it, and everything derived from it is <code>any</code>. <code>unknown</code> lets you do nothing until you narrow it (<code>typeof</code>, <code>instanceof</code>, a type guard). Use <code>unknown</code> for untrusted input.</p>', lvl: 'core' },
    { q: 'How does type inference work for variables?', a: '<p>From the initializer. <code>const</code> keeps literal types (<code>const x = 1</code> is <code>1</code>); <code>let</code> widens (<code>number</code>). Arrays get the union of element types. Return types are inferred from <code>return</code> statements. Parameters are <i>not</i> inferred from callers.</p>', fu: 'When is a parameter type inferred? (contextual typing: a callback passed where a function type is expected)', lvl: 'core' },
    { q: 'What does <code>as const</code> do?', a: '<p>It infers the narrowest type: literal types, <code>readonly</code> properties and readonly tuples. <code>[1, 2] as const</code> is <code>readonly [1, 2]</code>. Commonly used for config objects and enum-like objects.</p>', lvl: 'core' },
    { q: 'Array vs tuple?', a: '<p><code>T[]</code> is any length, same type everywhere. A tuple <code>[A, B]</code> has a fixed length and a type per position, with optional (<code>[A, B?]</code>), rest (<code>[A, ...B[]]</code>) and named elements (<code>[key: string, value: number]</code>). Both are JS arrays at runtime.</p>', lvl: 'core' },
    { q: 'Why is <code>number</code> a trap for Java developers?', a: '<p>There is no <code>int</code> or <code>long</code>. All numbers are doubles: <code>7 / 2</code> is <code>3.5</code>, integers are exact only up to 2^53 − 1, and money should not be stored in <code>number</code> without care. Use <code>bigint</code> for big integers and a decimal library or integer cents for money.</p>', lvl: 'core' },
    { q: 'What is <code>never</code> used for?', a: '<p>The empty type: no value has it. It is the return type of functions that always throw, the type left after exhaustive narrowing, and it disappears from unions (<code>A | never</code> is <code>A</code>).</p>', lvl: 'deep' },
    { q: 'What is the difference between <code>object</code>, <code>Object</code> and <code>{}</code>?', a: '<p><code>object</code> is any non-primitive. <code>{}</code> means “any value except <code>null</code>/<code>undefined</code>”, including strings and numbers. <code>Object</code> is similar to <code>{}</code>. Prefer <code>object</code> or a concrete shape; use <code>Record&lt;string, unknown&gt;</code> for dictionaries.</p>', lvl: 'deep' },
    { q: 'What is <code>noUncheckedIndexedAccess</code> and would you enable it?', a: '<p>It adds <code>| undefined</code> to array index reads and index-signature reads. Yes for new code: it catches out-of-range and missing-key bugs. The cost is more <code>!</code>/checks in loops; prefer <code>for…of</code> and <code>.at()</code>.</p>', lvl: 'deep' },
    { q: 'Is type inference in TS like Java’s <code>var</code>?', a: '<p>Similar for locals: inferred once, then fixed. TS goes further: it infers return types, literal types and generic arguments, and the type of a variable can <i>narrow</i> along control flow, which Java’s does not (except pattern matching).</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Typing a DTO from a Spring API', code: `// Matches a Spring Boot record: record Order(String id, BigDecimal total, Instant createdAt, List<String> tags)\ninterface OrderDto {\n  id: string;              // 64-bit Long sent as string\n  total: string;           // BigDecimal as string: avoid float rounding\n  createdAt: string;       // ISO-8601 from Jackson\n  tags: string[];\n  note: string | null;     // nullable column\n}\n\nconst created = new Date(order.createdAt);`, note: 'JSON has no dates or decimals. Decide the wire format on the Java side and type it honestly.' },
    { title: 'unknown at the edge', code: `function readPort(raw: unknown): number {\n  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;\n  if (typeof raw === 'string' && /^\\d+$/.test(raw)) return Number(raw);\n  throw new Error(\`bad port: \${String(raw)}\`);\n}\n\nconst port = readPort(process.env.PORT ?? 8080);` },
    { title: 'as const for config', code: `const LEVELS = ['debug', 'info', 'warn', 'error'] as const;\ntype Level = typeof LEVELS[number];   // "debug" | "info" | "warn" | "error"\n\nfunction isLevel(s: string): s is Level {\n  return (LEVELS as readonly string[]).includes(s);\n}` }
  ]
});

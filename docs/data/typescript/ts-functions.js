IA.register({
  track: 'typescript',
  slug: 'ts-functions',
  title: 'Typing functions',
  tagline: 'Annotate the <b>parameters</b>, let the return type be inferred (or pin it on exported APIs). Optional and default parameters replace most Java overloads, and <code>void</code> and <code>never</code> mean very different things.',
  tldr: {
    problem: 'JavaScript functions accept any number of arguments of any type. Without types, a wrong call fails deep inside the function, or never fails and returns garbage.',
    model: 'A function type is <b>(parameter types) =&gt; return type</b>. TS checks arity and types at each call. At runtime there is still <b>one function</b> per name: overloads are only signatures for the checker.',
    hook: '“How do you overload a method in TypeScript?” You write several signatures and <b>one</b> implementation that branches on the runtime value, or you use a union/optional parameter instead.',
    facts: [
      { v: '1', l: 'implementation per function name. Overload signatures have no body and are erased' },
      { v: 'undefined only', l: 'triggers a default parameter. <code>null</code> does not' },
      { v: 'top → bottom', l: 'order in which overload signatures are tried. The first match wins, so put the most specific first' }
    ]
  },
  intro: {
    what: 'In TypeScript you write the type of each parameter after its name, and optionally the return type after the parentheses. The compiler then checks every call: right number of arguments, right types. Functions are also values, so they have types of their own, like <code>(a: number) =&gt; string</code>, which you use for callbacks.',
    analogy: { icon: '🔌', title: 'A plug and its socket', text: 'A function signature is a socket shape. A call is a plug. TypeScript checks that each plug fits before you switch the power on. Optional parameters are spare holes the plug may leave empty; <code>never</code> is a socket that trips the breaker every time.' },
    steps: [
      { t: 'Parameters and return', d: 'Same idea as Java, the type just comes after the name.', code: 'function add(a: number, b: number): number {\n  return a + b;\n}' },
      { t: 'Arrow functions', d: 'The usual way to write callbacks and small functions.', code: 'const add = (a: number, b: number): number => a + b;\n[1, 2].map((n) => n * 2);   // n inferred as number' },
      { t: 'Optional and default', d: '<code>?</code> makes a parameter optional; a default value does too.', code: 'function greet(name: string, greeting = "Hello", punct?: string) {\n  return `${greeting}, ${name}${punct ?? "."}`;\n}' },
      { t: 'Function types', d: 'Describe a callback’s shape, like a Java functional interface but without a name.', code: 'type Handler = (req: Request) => Promise<Response>;\nfunction onEvent(cb: (e: string) => void) { /* … */ }' }
    ],
    terms: [
      ['signature', 'The parameter types and return type of a function.'],
      ['optional parameter', '<code>x?: T</code>. May be omitted; its type is <code>T | undefined</code>.'],
      ['default parameter', '<code>x = 5</code>. Used when the argument is missing or <code>undefined</code>.'],
      ['rest parameter', '<code>...xs: number[]</code>. Collects the remaining arguments, like Java varargs.'],
      ['overload', 'Several call signatures for one function. Only one implementation exists.'],
      ['void / never', '<code>void</code>: returns, value ignored. <code>never</code>: does not return at all.']
    ]
  },
  visual: {
    title: 'How a call is checked',
    caption: 'Step through each example. The right panel shows the type of each parameter and call as the checker sees it. In the overload example, note that the implementation signature is invisible to callers.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'Defaults vs null', code: `function greet(name = "guest") { return "hi " + name; }\nconsole.log(greet());\nconsole.log(greet(undefined));\nconsole.log(greet(null));   // null does not trigger the default\nconsole.log(greet(""));`, note: 'Plain JavaScript (types erased). In TS, <code>greet(null)</code> would be a compile error under <code>strictNullChecks</code>.' },
      { label: 'One function per name', code: `// What TS overloads compile to: a single function that branches.\nfunction parse(x) {\n  return typeof x === "string" ? Number(x) : x.map(Number);\n}\nconsole.log(parse("42"), parse(["1", "2"]));\nconsole.log(parse.length);   // declared parameter count`, note: 'Plain JavaScript. The overload signatures are erased; only this body remains.' }
    ]
  },
  gotchas: [
    { trap: 'Expecting real method overloading', code: `function area(r: number): number { return 3.14 * r * r; }\nfunction area(w: number, h: number): number { return w * h; }\n// TS2393: Duplicate function implementation.`, why: 'JavaScript has one binding per name. TS overloads are signatures only.', fix: 'Use optional parameters, a union, or an options object. Add overload signatures only when the <i>return</i> type depends on the input.' },
    { trap: 'Implementation signature is not callable', code: `function f(x: string): string;\nfunction f(x: number): number;\nfunction f(x: string | number) { return x; }\nf(Math.random() > 0.5 ? "a" : 1);   // error: no overload matches string | number`, why: 'Callers only see the overload signatures, never the implementation one.', fix: 'Add a third signature <code>(x: string | number): string | number</code>, or drop the overloads and use a generic.' },
    { trap: '<code>void</code> callbacks can return values', code: `const out: number[] = [];\n[1, 2].forEach((n) => out.push(n));   // push returns a number: allowed`, why: 'A function type returning <code>void</code> means “the caller ignores the result”, so a function that returns something is still assignable.', fix: 'This is deliberate. But don’t rely on the result of a <code>void</code> callback, and note that a function <i>declared</i> <code>: void</code> may not <code>return 1</code>.' },
    { trap: 'Optional parameter vs <code>| undefined</code>', code: `function a(x?: number) {}\nfunction b(x: number | undefined) {}\na();     // ok\nb();     // TS2554: expected 1 argument`, why: 'An optional parameter may be omitted. A required one typed <code>| undefined</code> must be passed, even if just <code>undefined</code>.', fix: 'Use <code>?</code> for “may be left out”. Use <code>| undefined</code> when the caller must decide explicitly.' },
    { trap: 'Losing <code>this</code> in callbacks', code: `class Counter {\n  n = 0;\n  inc() { this.n++; }\n}\nconst c = new Counter();\nsetTimeout(c.inc, 10);   // this is undefined → TypeError`, why: 'In JS, <code>this</code> depends on how a function is called. Passing a method detaches it from the object. TS does not catch this by default.', fix: 'Use an arrow function field (<code>inc = () =&gt; { this.n++; }</code>) or pass <code>() =&gt; c.inc()</code>. A <code>this: Counter</code> parameter makes TS check it.' },
    { trap: 'Missing explicit return types on exported APIs', why: 'The inferred return type changes whenever the body changes, so a refactor can silently widen a public API (say, to <code>string | undefined</code>) and break callers far away.', fix: 'Annotate return types of exported functions. Lint rule: <code>explicit-module-boundary-types</code>.' }
  ],
  scenarios: [
    { title: 'Retry helper fires requests with the wrong timeout',
      symptom: 'Calls configured with <code>retry(fn, null)</code> to mean “no timeout” time out after 0 ms.',
      diagnose: `function retry(fn: () => Promise<void>, timeoutMs: number | null = 5000) { /* … */ }\nretry(job, null);   // null is passed through, default skipped\n// inside: setTimeout(abort, timeoutMs)  → setTimeout(abort, null) → ~0 ms`,
      cause: 'Defaults apply only to <code>undefined</code>. <code>null</code> was passed through and coerced to 0 by <code>setTimeout</code>.',
      fix: 'Use an options object with an explicit “no timeout” value, and handle <code>null</code> on purpose.',
      fixCode: `interface RetryOpts { timeoutMs?: number | 'none'; attempts?: number }\nfunction retry(fn: () => Promise<void>, { timeoutMs = 5000, attempts = 3 }: RetryOpts = {}) {\n  const t = timeoutMs === 'none' ? undefined : setTimeout(abort, timeoutMs);\n}` },
    { title: 'Event handler crashes with “Cannot read properties of undefined (reading \'emit\')”',
      symptom: 'A class method passed to <code>socket.on("data", this.handle)</code> throws when the event arrives.',
      diagnose: `class Ingest {\n  constructor(private bus: Bus) {}\n  handle(chunk: Buffer) { this.bus.emit(chunk); }  // this = the socket, not Ingest\n}`,
      cause: 'The method was passed unbound. Inside it, <code>this</code> is whatever the emitter sets, so <code>this.bus</code> is undefined.',
      fix: 'Bind at the call site or make the handler an arrow function field.',
      fixCode: `class Ingest {\n  constructor(private bus: Bus) {}\n  handle = (chunk: Buffer): void => { this.bus.emit(chunk); };\n}` }
  ],
  puzzles: [
    { kind: 'output', q: 'What does it print?', code: `function greet(name: string = "guest"): string {\n  return "hi " + name + "!";\n}\nconsole.log([greet(undefined), greet(null as any), greet("")].join("|"));`, options: ['hi guest!|hi guest!|hi guest!', 'hi guest!|hi null!|hi !', 'hi guest!|hi guest!|hi !', 'hi undefined!|hi null!|hi !'], answer: 1, explain: 'A default is used only when the argument is <code>undefined</code>. <code>null</code> and <code>""</code> are real values and are passed through.', run: true, expect: 'hi guest!|hi null!|hi !' },
    { kind: 'output', q: 'What does it print?', code: `function len(x: string): number;\nfunction len(x: unknown[]): number;\nfunction len(x: string | unknown[]): number {\n  return x.length;\n}\nconsole.log(len("abc") + len([1, 2]));\nconsole.log(typeof len, len.length);`, options: ['5 then function 1', '5 then object 3', 'It throws: duplicate function', '5 then function 2'], answer: 0, explain: 'Overload signatures are erased; only the implementation remains. <code>fn.length</code> is the number of declared parameters: 1.', run: true, expect: '5\nfunction 1' },
    { kind: 'output', q: 'What does it print?', code: `const out: number[] = [];\nconst push: (n: number) => void = (n) => out.push(n);\nconst r = push(7);\nconsole.log(r, out);`, options: ['undefined [ 7 ]', '1 [ 7 ]', 'It does not compile', '7 [ 7 ]'], answer: 1, explain: 'A <code>void</code> function type does not change the runtime value. <code>push</code> returns the new length, 1. TS just types <code>r</code> as <code>void</code>, so you shouldn’t use it.', run: true, expect: '1 [ 7 ]' },
    { kind: 'output', q: 'What does it print?', code: `function sum(...xs: number[]): number {\n  return xs.reduce((a, b) => a + b, 0);\n}\nconst nums = [1, 2, 3];\nconsole.log(sum(), sum(...nums), sum(4, 5));`, options: ['0 6 9', 'undefined 6 9', 'NaN 6 9', 'It does not compile'], answer: 0, explain: 'A rest parameter is always an array, empty when nothing is passed. <code>reduce</code> with an initial value of 0 handles it.', run: true, expect: '0 6 9' },
    { kind: 'concept', q: 'Which is the right return type for a function that always throws?', code: `function fail(msg: string): ??? {\n  throw new Error(msg);\n}`, options: ['<code>void</code>', '<code>undefined</code>', '<code>never</code>', '<code>Error</code>'], answer: 2, explain: '<code>never</code> says the function never completes normally. It lets callers write <code>const x = maybe ?? fail("…")</code> with <code>x</code> keeping the non-undefined type.' },
    { kind: 'concept', q: 'Given these overloads, what is the type of <code>r</code>?', code: `function get(id: string): User;\nfunction get(ids: string[]): User[];\nfunction get(x: string | string[]): User | User[] { /* … */ }\nconst r = get(["a", "b"]);`, options: ['<code>User | User[]</code>', '<code>User[]</code>', '<code>User</code>', 'Compile error'], answer: 1, explain: 'The checker tries signatures from the top and picks the first match: the <code>string[]</code> one returns <code>User[]</code>.' },
    { kind: 'concept', q: 'Is this assignment allowed under <code>strictFunctionTypes</code>?', code: `type Handler = (e: MouseEvent) => void;\nconst h: Handler = (e: Event) => console.log(e.type);`, options: ['Yes: a handler that accepts any Event can take a MouseEvent', 'No: parameter types must match exactly', 'No: Event is wider than MouseEvent', 'Only with a cast'], answer: 0, explain: 'Parameters are checked <b>contravariantly</b>: a function accepting a wider type is safe where a narrower one is expected. The reverse would be an error.' }
  ],
  interview: [
    { q: 'How do you type a function in TypeScript?', a: '<p>Annotate parameters, optionally the return type: <code>function f(a: number): string</code>. As a type: <code>(a: number) =&gt; string</code>. Parameters are not inferred from callers, but are inferred from context for callbacks.</p>', lvl: 'core' },
    { q: 'Optional vs default parameters?', a: '<p><code>x?: T</code> may be omitted and has type <code>T | undefined</code> inside. <code>x = v</code> may be omitted and has type <code>T</code> inside. Both kick in only for <code>undefined</code>, not <code>null</code>. Optional parameters must come after required ones.</p>', lvl: 'core' },
    { q: 'How do overloads work, and when would you use them?', a: '<p>You declare several signatures without bodies, then one implementation with a compatible wide signature. Callers see only the overloads, tried top to bottom. Use them when the return type depends on the argument type and a generic or union can’t express it. Otherwise prefer unions or optional params.</p>', fu: 'Why isn’t the implementation signature visible? (to stop callers using its overly wide types)', lvl: 'core' },
    { q: '<code>void</code> vs <code>undefined</code> vs <code>never</code> as a return type?', a: '<ul><li><code>void</code>: returns, but the value should be ignored. A <code>void</code> function <i>type</i> accepts functions that return something.</li><li><code>undefined</code>: must actually return <code>undefined</code> (TS 5.1+ allows no <code>return</code> statement).</li><li><code>never</code>: never returns (throws or loops).</li></ul>', lvl: 'core' },
    { q: 'What is contextual typing?', a: '<p>When a function expression is used where a function type is expected, TS infers its parameter types from that expected type: <code>[1,2].map(n =&gt; n * 2)</code> gives <code>n: number</code>. Same for event handlers and Promise callbacks.</p>', lvl: 'core' },
    { q: 'How are function parameter types checked for assignability?', a: '<p>With <code>strictFunctionTypes</code> (part of <code>strict</code>), function-type parameters are contravariant. Method-style declarations (<code>m(x: T): void</code> in an interface) stay <b>bivariant</b> for compatibility, which is a soundness hole.</p>', lvl: 'deep' },
    { q: 'How do you type <code>this</code>?', a: '<p>Add a fake first parameter: <code>function f(this: Window, x: number)</code>. It is erased and only checks call sites. In classes, use arrow function fields when a method is passed as a callback.</p>', lvl: 'deep' },
    { q: 'How would you type a generic function, e.g. <code>first</code>?', a: '<p><code>function first&lt;T&gt;(xs: readonly T[]): T | undefined { return xs[0]; }</code>. <code>T</code> is inferred at each call. Add constraints with <code>&lt;T extends { id: string }&gt;</code>.</p>', lvl: 'core' },
    { q: 'Why might you annotate return types even though they are inferred?', a: '<p>For exported functions: it documents the contract, catches accidental changes in the body, and speeds up type-checking of large projects. For local helpers inference is fine.</p>', lvl: 'deep' },
    { q: 'What do <code>Parameters&lt;F&gt;</code> and <code>ReturnType&lt;F&gt;</code> do?', a: '<p>Built-in utility types that extract a function type’s parameter tuple and return type. Useful for wrappers: <code>function logged&lt;F extends (...a: any[]) =&gt; any&gt;(f: F) { return (...a: Parameters&lt;F&gt;): ReturnType&lt;F&gt; =&gt; f(...a); }</code>.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Options object instead of overloads', code: `interface ListOpts {\n  page?: number;\n  size?: number;\n  sort?: 'asc' | 'desc';\n}\n\nexport async function listOrders(\n  customerId: string,\n  { page = 0, size = 20, sort = 'desc' }: ListOpts = {},\n): Promise<Order[]> {\n  const q = new URLSearchParams({ page: String(page), size: String(size), sort });\n  const res = await fetch(\`/api/customers/\${customerId}/orders?\${q}\`);\n  return (await res.json()) as Order[];\n}`, note: 'Replaces Java’s <code>listOrders(id)</code>, <code>listOrders(id, page)</code>, … overload ladder. Mirrors a Spring <code>Pageable</code>.' },
    { title: 'Overloads where the return type depends on input', code: `export function find(id: string): Promise<User | undefined>;\nexport function find(ids: readonly string[]): Promise<User[]>;\nexport async function find(x: string | readonly string[]): Promise<User | User[] | undefined> {\n  if (typeof x === 'string') return repo.byId(x);\n  return repo.byIds(x);\n}` },
    { title: 'Assertion function with never', code: `export function assertNever(x: never): never {\n  throw new Error('unexpected value: ' + JSON.stringify(x));\n}\n\nexport function required(name: string): string {\n  return process.env[name] ?? fail(\`missing env \${name}\`);\n}\nfunction fail(msg: string): never { throw new Error(msg); }` }
  ]
});

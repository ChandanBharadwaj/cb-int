IA.register({
  track: 'typescript',
  slug: 'ts-classes',
  title: 'Classes & enums',
  tagline: 'TS classes look like Java classes, but they are <b>JavaScript classes with compile-time labels</b>. <code>private</code> is a promise the checker keeps; <code>#private</code> is one the engine keeps. Enums are one of the few TS features that emit code, which is why many teams use union literals instead.',
  tldr: {
    problem: 'Java developers bring over the full OO toolbox and expect the same guarantees: private means private, enums are objects with methods, and the class name defines the type. Each assumption is partly wrong.',
    model: 'Two layers. <b>Runtime</b>: a JS class with fields, methods, <code>#private</code> fields and a prototype chain. <b>Type layer</b>: <code>public/protected/private</code>, <code>readonly</code>, <code>abstract</code>, <code>implements</code>, all erased. Enums and parameter properties are the exceptions that generate code.',
    hook: '“<code>private</code> vs <code>#field</code>?” <code>private</code> is checked by tsc and visible at runtime (and in JSON). <code>#field</code> is enforced by the JS engine.',
    facts: [
      { v: 'ES2022', l: 'standardized class fields and <code>#private</code> members in JavaScript' },
      { v: '2 ways', l: 'a numeric enum maps: name → value and value → name (reverse mapping). String enums map one way only' },
      { v: 'TS 5.8', l: 'added <code>erasableSyntaxOnly</code>, which flags enums, namespaces and parameter properties' }
    ]
  },
  intro: {
    what: 'A <b>class</b> bundles data (fields) and behaviour (methods), and <code>new</code> creates instances. JavaScript has had classes since 2015; TypeScript adds types and Java-style <b>access modifiers</b> on top. An <b>enum</b> names a fixed set of constants. In TypeScript you can also get that with a <b>union of literal types</b>, which costs nothing at runtime.',
    analogy: { icon: '🪪', title: 'A staff badge vs a locked door', text: '<code>private</code> is a “staff only” sign: everyone following the rules (the type checker) stays out, but nothing physically stops someone who ignores the sign (a cast, or plain JS). <code>#private</code> is a locked door: the runtime itself refuses entry.' },
    steps: [
      { t: 'A class with typed fields', d: 'Fields are declared in the body, like Java.', code: 'class Counter {\n  count = 0;               // inferred number\n  inc(by = 1): void { this.count += by; }\n}' },
      { t: 'Access modifiers', d: '<code>public</code> (default), <code>protected</code>, <code>private</code>, plus JS-native <code>#private</code>.', code: 'class Account {\n  private balance = 0;\n  #pin = "0000";\n  protected owner = "ana";\n}' },
      { t: 'Abstract classes and interfaces', d: 'Same idea as Java. <code>implements</code> is only a compile-time check.', code: 'interface Repo { find(id: string): User | undefined }\nabstract class Base { abstract name(): string }\nclass PgRepo implements Repo { find(id: string) { return undefined; } }' },
      { t: 'Enums vs literal unions', d: 'Both name a fixed set of values.', code: 'enum Role { Admin = "ADMIN", User = "USER" }\ntype Role2 = "ADMIN" | "USER";' }
    ],
    terms: [
      ['class field', 'A property declared in the class body, set on each instance.'],
      ['private / #private', 'TS-checked privacy vs JavaScript runtime privacy.'],
      ['parameter property', '<code>constructor(private db: Db)</code>: declares and assigns a field in one go.'],
      ['abstract', 'A class that can’t be instantiated, or a method a subclass must implement.'],
      ['enum', 'A named set of constants. Emits a JavaScript object.'],
      ['as const object', 'An object literal frozen at the type level; an erasable enum alternative.']
    ]
  },
  visual: {
    title: 'What survives to runtime',
    caption: 'Step through each tab. The right panel shows what the checker enforces and what actually exists in the emitted JavaScript. Amber means “only a compile-time promise”.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'private vs #private', code: `class Account {\n  balance = 10;   // TS 'private balance' compiles to exactly this\n  #pin = "1234";\n  check(p) { return p === this.#pin; }\n}\nconst a = new Account();\nconsole.log(a.balance, JSON.stringify(a), Object.keys(a));\nconsole.log(a.check("1234"));\ntry { eval("a.#pin"); } catch (e) { console.log(e.constructor.name); }`, note: 'Plain JavaScript (types erased). <code>#pin</code> is invisible to keys, JSON and outside code.' },
      { label: 'What an enum compiles to', code: `// tsc output for: enum Dir { Up, Down }\nvar Dir;\n(function (Dir) {\n  Dir[Dir["Up"] = 0] = "Up";\n  Dir[Dir["Down"] = 1] = "Down";\n})(Dir || (Dir = {}));\nconsole.log(Dir);\nconsole.log(Object.keys(Dir));\nconsole.log(Dir[0], Dir.Up);`, note: 'This is the JavaScript tsc emits for a numeric enum. Note the reverse mapping.' }
    ]
  },
  gotchas: [
    { trap: '<code>private</code> leaks at runtime', code: `class User { private passwordHash = "..."; }\nJSON.stringify(new User());   // {"passwordHash":"..."}`, why: 'TS <code>private</code> is erased. The field is an ordinary property: visible to <code>JSON.stringify</code>, <code>Object.keys</code>, spread and any JS caller.', fix: 'Use <code>#private</code> for real encapsulation, and map to DTOs before serializing.' },
    { trap: 'Numeric enums accept any number', code: `enum Level { Low, High }\nconst l: Level = 42;   // TS 5.0+: error for literal 42…\nconst x: Level = n;    // …but any number variable still passes`, why: 'Numeric enums are assignable from <code>number</code> values, so out-of-range values are easy to create. Reverse mapping also adds number keys to <code>Object.keys</code>.', fix: 'Prefer string enums or, better, literal unions / <code>as const</code> objects.' },
    { trap: '<code>const enum</code> with isolated transpilers', why: 'A <code>const enum</code> is inlined by tsc using type information from other files. esbuild, swc, Babel and Node stripping compile file by file and can’t inline them.', fix: 'Avoid <code>const enum</code> in application code. <code>isolatedModules</code> warns about cross-file use.' },
    { trap: 'Parameter properties are not erasable', code: `class Svc { constructor(private readonly repo: Repo) {} }\n// node --experimental-strip-types → ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`, why: 'The shorthand makes tsc emit <code>this.repo = repo</code>. Pure type stripping cannot add code.', fix: 'Declare the field and assign it in the constructor, or use tsx / tsc to run. Turn on <code>erasableSyntaxOnly</code> if you target Node stripping.' },
    { trap: 'Field initialization order with <code>useDefineForClassFields</code>', code: `class Base { constructor() { this.init(); } init() {} }\nclass Child extends Base {\n  items: string[] = [];\n  init() { this.items.push("x"); }   // TypeError: this.items is undefined\n}`, why: 'Subclass fields are initialized <i>after</i> the base constructor returns, same as Java. Calling an overridable method from a constructor sees uninitialized fields.', fix: 'Don’t call overridable methods from constructors. Note: with <code>target</code> ES2022+ the default <code>useDefineForClassFields: true</code> also means a declared field without initializer resets an inherited value to <code>undefined</code>.' },
    { trap: '<code>implements</code> adds nothing at runtime', why: 'It only checks that the class has the right shape. Any object with the same shape works where the interface is expected, and <code>instanceof Interface</code> is not possible.', fix: 'Use interfaces for contracts; inject plain objects or classes freely. For runtime checks, use a tag field or a class.' }
  ],
  scenarios: [
    { title: 'Secrets in the logs',
      symptom: 'Structured logs contain API keys. The client class marks them <code>private</code>.',
      diagnose: `class PaymentClient { private apiKey: string; … }\nlogger.info({ client }, "init");   // serializes every own property`,
      cause: 'TS <code>private</code> is erased; the logger enumerated the object and wrote the field.',
      fix: 'Make secret fields <code>#private</code>, and add a redaction list in the logger as defence in depth.',
      fixCode: `class PaymentClient {\n  #apiKey: string;\n  constructor(apiKey: string) { this.#apiKey = apiKey; }\n}\nconst logger = pino({ redact: ['*.apiKey', '*.token'] });` },
    { title: 'Order status 3 appears in the database',
      symptom: 'Rows with <code>status = 3</code> exist, but the enum only has values 0–2. Reports crash on <code>Status[3]</code>.',
      diagnose: `enum Status { New, Paid, Shipped }\nconst s: Status = Number(req.body.status);   // number → numeric enum: allowed`,
      cause: 'Numeric enums accept any number, so unvalidated input passed straight through. Reordering the enum in an earlier release had also changed what 1 and 2 meant.',
      fix: 'Store string values and validate input against the allowed set.',
      fixCode: `const STATUSES = ['NEW', 'PAID', 'SHIPPED'] as const;\ntype Status = typeof STATUSES[number];\nfunction parseStatus(x: unknown): Status {\n  if (typeof x === 'string' && (STATUSES as readonly string[]).includes(x)) return x as Status;\n  throw new Error('bad status');\n}` }
  ],
  puzzles: [
    { kind: 'output', q: 'What does it print?', code: `class Acct { private balance = 10; }\nconst a = new Acct();\nconsole.log((a as any).balance, Object.keys(a).join(","));`, options: ['undefined (empty)', '10 balance', 'It throws: private access', '10 (empty)'], answer: 1, explain: 'TS <code>private</code> is erased. At runtime <code>balance</code> is an ordinary own property.', run: true, expect: '10 balance' },
    { kind: 'output', q: 'What does it print?', code: `class Acct2 {\n  #balance = 10;\n  get(): number { return this.#balance; }\n}\nconst b = new Acct2();\nconsole.log(Object.keys(b).length, JSON.stringify(b), b.get());`, options: ['1 {"balance":10} 10', '0 {} 10', '1 {"#balance":10} 10', '0 {} undefined'], answer: 1, explain: '<code>#private</code> fields are not properties: they don’t show in <code>Object.keys</code> or JSON. Only methods of the class can read them.', run: true, expect: '0 {} 10' },
    { kind: 'output', q: 'What does it print?', code: `abstract class Base {\n  abstract name(): string;\n  hello(): string { return "hi " + this.name(); }\n}\nclass Impl extends Base {\n  name(): string { return "impl"; }\n}\nconsole.log(new Impl().hello(), typeof Base);`, options: ['hi impl function', 'hi impl abstract', 'hi undefined function', 'It throws: abstract'], answer: 0, explain: '<code>abstract</code> is erased: <code>Base</code> is an ordinary JS class (a function). Only the checker stops <code>new Base()</code>.', run: true, expect: 'hi impl function' },
    { kind: 'concept', q: 'What does <code>Object.keys(Dir)</code> return?', code: `enum Dir { Up, Down }`, options: ['<code>["Up", "Down"]</code>', '<code>["0", "1", "Up", "Down"]</code>', '<code>["Up", "Down", "0", "1"]</code>', '<code>[]</code>, enums are erased'], answer: 1, explain: 'Numeric enums emit a reverse mapping. Integer-like keys are listed first in ascending order, then string keys in insertion order. Iterating an enum’s keys is a classic bug.' },
    { kind: 'concept', q: 'What does this constructor do?', code: `class Repo {\n  constructor(private readonly db: Db, public name: string) {}\n}`, options: ['Nothing; the body is empty', 'Declares fields <code>db</code> and <code>name</code> and assigns them from the arguments', 'Only checks the argument types', 'Error: modifiers not allowed on parameters'], answer: 1, explain: 'Parameter properties: the modifier makes tsc emit <code>this.db = db; this.name = name;</code>. Handy, but not erasable.' },
    { kind: 'concept', q: 'Which is a safe, erasable replacement for <code>enum Color { Red = "RED", Blue = "BLUE" }</code>?', options: ['<code>declare enum Color { Red, Blue }</code>', '<code>const enum Color { Red = "RED", Blue = "BLUE" }</code>', '<code>const Color = { Red: "RED", Blue: "BLUE" } as const; type Color = typeof Color[keyof typeof Color];</code>', '<code>namespace Color { export const Red = "RED" }</code>'], answer: 2, explain: 'The <code>as const</code> object is plain JavaScript, and the derived type is <code>"RED" | "BLUE"</code>. <code>const enum</code> and namespaces need code generation or cross-file info.' },
    { kind: 'concept', q: 'Can <code>class Cat</code> be passed where <code>Dog</code> is expected?', code: `class Dog { name = ""; }\nclass Cat { name = ""; }\nfunction walk(d: Dog) {}\nwalk(new Cat());`, options: ['No: different classes', 'Yes: same structure', 'Only with implements', 'Only if Cat extends Dog'], answer: 1, explain: 'Classes are compared structurally too. If <code>Dog</code> had a <code>private</code> or <code>#</code> member, the classes would no longer be compatible: private members make class types nominal.' }
  ],
  interview: [
    { q: '<code>private</code> vs <code>#private</code>?', a: '<p><code>private</code>: TS-only, erased, accessible via casts or JS, shows in JSON, allows <code>obj["field"]</code> access in TS. <code>#private</code>: ES2022 runtime privacy, not enumerable, not in JSON, even subclasses can’t see it. Use <code>#</code> for secrets and true invariants.</p>', lvl: 'core' },
    { q: 'What access modifiers does TS have, compared with Java?', a: '<p><code>public</code> (default, unlike Java’s package-private), <code>protected</code> (subclasses only; no package access), <code>private</code>, plus <code>readonly</code> (like <code>final</code> fields, compile-time only). There is no package-private level; modules and exports play that role.</p>', lvl: 'core' },
    { q: 'What are parameter properties?', a: '<p>Shorthand: a modifier on a constructor parameter (<code>constructor(private repo: Repo)</code>) declares and assigns a field. Popular with Angular/NestJS DI. It emits code, so it fails under Node type stripping and <code>erasableSyntaxOnly</code>.</p>', lvl: 'core' },
    { q: 'Abstract class vs interface in TS?', a: '<p>An interface is type-only: no code, no runtime presence. An abstract class is a real JS class that can hold shared implementation and fields; only the checker prevents <code>new</code>. Use interfaces for contracts, abstract classes when sharing code via inheritance.</p>', lvl: 'core' },
    { q: 'Enums vs union literal types?', a: '<p>Enums emit a runtime object (numeric ones with reverse mapping), are nominal-ish, and are not erasable. Literal unions cost nothing, serialize naturally to JSON, and work with narrowing. If you need runtime values to iterate, use an <code>as const</code> object or array and derive the union.</p>', fu: 'When might you still use an enum? (existing codebase convention; string enums for a public SDK; when Node stripping is not used)', lvl: 'core' },
    { q: 'What is a <code>const enum</code>, and why is it discouraged?', a: '<p>Its members are inlined at use sites and no object is emitted. Inlining needs type info across files, so it breaks with per-file transpilers (esbuild, swc, Babel, Node stripping) and in published <code>.d.ts</code> files.</p>', lvl: 'deep' },
    { q: 'Are classes nominal or structural in TS?', a: '<p>Structural, like everything else: two classes with identical public members are interchangeable. Adding a <code>private</code> or <code>#private</code> member makes a class compatible only with itself and its subclasses.</p>', lvl: 'deep' },
    { q: 'What does <code>useDefineForClassFields</code> change?', a: '<p>With it (the default for target ES2022+), fields use JS <code>[[Define]]</code> semantics: they are defined on the instance even without an initializer, which can shadow accessors or values set by a base class. Older TS emitted assignments in the constructor. Use <code>declare field: T</code> to declare a type without emitting a field.</p>', lvl: 'deep' },
    { q: 'How do getters, setters and static members look?', a: '<p>Same as JS: <code>get total() {…}</code>, <code>set total(v) {…}</code>, <code>static create()</code>, plus <code>static</code> blocks. TS 5.1+ allows the getter and setter to have unrelated types.</p>', lvl: 'core' },
    { q: 'How do you do dependency injection without a framework?', a: '<p>Constructor injection with interfaces: <code>class OrderService { constructor(repo: OrderRepo) { this.repo = repo; } }</code>, wired in a composition root. Frameworks like NestJS use decorators plus runtime metadata; plain TS needs no container.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Service class, erasable style', code: `export interface OrderRepo {\n  find(id: string): Promise<Order | undefined>;\n  save(o: Order): Promise<void>;\n}\n\nexport class OrderService {\n  readonly #repo: OrderRepo;\n  readonly #clock: () => Date;\n\n  constructor(repo: OrderRepo, clock: () => Date = () => new Date()) {\n    this.#repo = repo;\n    this.#clock = clock;\n  }\n\n  async markPaid(id: string): Promise<void> {\n    const o = await this.#repo.find(id);\n    if (!o) throw new Error(\`order \${id} not found\`);\n    await this.#repo.save({ ...o, status: 'PAID', paidAt: this.#clock().toISOString() });\n  }\n}`, note: 'Compare with a Spring <code>@Service</code> using constructor injection. No parameter properties, so it runs under Node type stripping.' },
    { title: 'Enum-like constants', code: `export const OrderStatus = {\n  New: 'NEW',\n  Paid: 'PAID',\n  Shipped: 'SHIPPED',\n} as const;\nexport type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];\n\nexport const ALL_STATUSES = Object.values(OrderStatus);   // OrderStatus[]\n\nfunction label(s: OrderStatus): string {\n  switch (s) {\n    case OrderStatus.New: return 'New';\n    case OrderStatus.Paid: return 'Paid';\n    case OrderStatus.Shipped: return 'Shipped';\n  }\n}`, note: 'Matches a Java <code>enum OrderStatus { NEW, PAID, SHIPPED }</code> serialized by name with Jackson.' },
    { title: 'Java enum with behaviour → TS', lang: 'java', code: `enum Plan {\n  FREE(0), PRO(20);\n  final int price;\n  Plan(int price) { this.price = price; }\n}\n// TypeScript equivalent:\n// const PLANS = { FREE: { price: 0 }, PRO: { price: 20 } } as const;\n// type Plan = keyof typeof PLANS;   // "FREE" | "PRO"\n// PLANS[plan].price` }
  ]
});

IA.register({
  track: 'typescript',
  slug: 'ts-objects-interfaces',
  title: 'Objects, interfaces & types',
  tagline: 'An interface is a <b>shape</b>, not a class contract. Anything with the right properties fits, whether or not it says <code>implements</code>. That one idea, <b>structural typing</b>, explains most surprises.',
  tldr: {
    problem: 'Java habits mislead here: you expect a type’s <i>name</i> to matter, <code>final</code> to protect at runtime, and a <code>Map</code> lookup to warn about missing keys. None of those hold.',
    model: 'Object types list properties: required, optional (<code>?</code>), <code>readonly</code>, or an <b>index signature</b> for “any key”. A value is assignable if it has <b>at least</b> the required members with compatible types.',
    hook: '“Interface or type alias?” Both describe object shapes. Interfaces can be extended and merged; type aliases can also name unions, tuples and computed types. Pick one convention and stay consistent.',
    facts: [
      { v: 'structural', l: 'TS compares types by members, not by name or declaration (Java is nominal)' },
      { v: '0 bytes', l: 'emitted for an interface or type alias. Both are erased completely' },
      { v: 'fresh only', l: 'excess property checks apply to object literals written directly at the assignment, not to variables' }
    ]
  },
  intro: {
    what: 'In JavaScript, most data is plain objects: <code>{ id: "u1", name: "Ana" }</code>. TypeScript lets you describe their shape with an <b>interface</b> or a <b>type alias</b>. You can mark properties optional or read-only, and describe dictionaries with “any key” signatures. Shapes are compared by their members, so two types with the same properties are interchangeable.',
    analogy: { icon: '🧩', title: 'A shape sorter', text: 'A child’s shape sorter has a star-shaped hole. Any block shaped like a star fits, whatever its colour or brand. TypeScript works the same way: if the object has the right properties, it fits. Java checks the label on the block instead.' },
    steps: [
      { t: 'Describe a shape', d: 'Interface and type alias, side by side.', code: 'interface User { id: string; name: string }\ntype Point = { x: number; y: number };' },
      { t: 'Optional and readonly', d: '<code>?</code> for may-be-missing; <code>readonly</code> for set-once.', code: 'interface User {\n  readonly id: string;\n  email?: string;\n}' },
      { t: 'Dictionaries', d: 'An index signature or <code>Record</code> for “any key”.', code: 'const stock: Record<string, number> = { apple: 3 };\ninterface Env { [key: string]: string | undefined }' },
      { t: 'Extend and combine', d: '<code>extends</code> for interfaces, <code>&amp;</code> (intersection) for type aliases.', code: 'interface Admin extends User { role: "admin" }\ntype Audited = User & { createdAt: Date };' }
    ],
    terms: [
      ['interface', 'A named object shape. Can be extended and merged with another declaration of the same name.'],
      ['type alias', '<code>type X = …</code>. A name for any type: object, union, tuple, function.'],
      ['structural typing', 'Compatibility decided by members, not names.'],
      ['index signature', '<code>[key: string]: T</code>. Any property name, every value of type T.'],
      ['excess property check', 'An error when an object literal has properties the target type does not declare.'],
      ['intersection (&amp;)', 'A value that has the members of both types.']
    ]
  },
  visual: {
    title: 'Shape checks, step by step',
    caption: 'Step through each tab. The right panel shows the shapes TypeScript compares and where it says yes or no. Watch the difference between passing a variable and passing a fresh object literal.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'readonly is not frozen', code: `// TS: interface Cfg { readonly port: number }\nconst cfg = { port: 80 };\ncfg.port = 8080;              // TS would refuse; JS allows\nconsole.log(cfg.port);\n\nconst frozen = Object.freeze({ port: 80 });\ntry { frozen.port = 8080; } catch (e) { console.log('strict mode throws:', e.constructor.name); }  // sloppy mode ignores it silently\nconsole.log(frozen.port);`, note: 'Plain JavaScript (types erased). Only <code>Object.freeze</code> protects at runtime, and only shallowly.' },
      { label: 'Missing keys', code: `const stock = { apple: 3 };\nconsole.log(stock["pear"]);           // undefined, no error\nconsole.log("pear" in stock);\nconsole.log(stock["toString"]);       // inherited from Object.prototype!\nconst m = new Map([["apple", 3]]);\nconsole.log(m.get("toString"));`, note: 'Plain JavaScript. A plain object as a dictionary sees prototype keys; a <code>Map</code> does not.' }
    ]
  },
  gotchas: [
    { trap: 'Excess properties pass through variables', code: `interface Point { x: number; y: number }\nconst p3 = { x: 1, y: 2, z: 3 };\nconst p: Point = p3;              // ok: structural\nconst q: Point = { x: 1, y: 2, z: 3 };  // TS2353: 'z' does not exist`, why: 'Extra members are fine for assignability. The excess check only runs on fresh literals, to catch typos.', fix: 'Don’t rely on types to strip fields. When sending data out (APIs, logs), pick fields explicitly or use a schema that strips unknown keys.' },
    { trap: '<code>readonly</code> is shallow and compile-time only', code: `interface Cfg { readonly tags: string[] }\ncfg.tags.push("x");   // allowed: the array itself is mutable`, why: '<code>readonly</code> stops reassigning the property, not mutating what it points to. It is erased at runtime.', fix: 'Use <code>readonly string[]</code> (or <code>ReadonlyArray</code>) for the array too, <code>Readonly&lt;T&gt;</code> for one level, and <code>Object.freeze</code> if you need runtime safety.' },
    { trap: 'Index signature reads look safe', code: `const prices: Record<string, number> = {};\nconst p = prices["sku-1"];   // number, really undefined\np.toFixed(2);                // TypeError`, why: 'Without <code>noUncheckedIndexedAccess</code>, a lookup on an index signature is typed as always present.', fix: 'Enable <code>noUncheckedIndexedAccess</code>, or use a <code>Map</code> (whose <code>get</code> returns <code>V | undefined</code>).' },
    { trap: 'Optional vs <code>| undefined</code> properties', code: `interface A { x?: number }\ninterface B { x: number | undefined }\nconst a: A = {};      // ok\nconst b: B = {};      // error: x is required`, why: '<code>?</code> means the key may be absent. <code>| undefined</code> means the key must exist but may hold undefined. With <code>exactOptionalPropertyTypes</code>, <code>{ x: undefined }</code> is not even allowed for <code>A</code>.', fix: 'Pick based on intent; matters for <code>"x" in obj</code> and for PATCH semantics.' },
    { trap: 'Interfaces merge silently', code: `interface Settings { theme: string }\n// another file, same scope:\ninterface Settings { theme: number }   // error, but…\ninterface Settings { lang: string }    // merges quietly`, why: 'Two interface declarations with the same name in the same scope merge (declaration merging). Great for augmenting libraries, surprising by accident.', fix: 'Use <code>type</code> aliases for your own data shapes if you want duplicates to be an error. Use merging on purpose for module augmentation.' },
    { trap: 'Plain objects as dictionaries see prototype keys', code: `const seen: Record<string, boolean> = {};\nif (seen["constructor"]) { /* true! inherited */ }`, why: 'Objects inherit from <code>Object.prototype</code>, so keys like <code>constructor</code> or <code>toString</code> appear to exist.', fix: 'Use <code>Map</code> / <code>Set</code> for user-controlled keys, or <code>Object.create(null)</code> and <code>Object.hasOwn</code>.' }
  ],
  scenarios: [
    { title: 'Password hash showed up in an API response',
      symptom: 'A <code>/me</code> endpoint returned <code>passwordHash</code>, although the response type <code>PublicUser</code> does not declare it.',
      diagnose: `interface PublicUser { id: string; name: string }\nfunction toPublic(u: UserRow): PublicUser {\n  return u;            // compiles: UserRow has id and name (and more)\n}\nres.json(toPublic(row));`,
      cause: 'Structural typing: a wider object is assignable to a narrower type, and types are erased, so every extra field was serialized.',
      fix: 'Map fields explicitly at the boundary. A schema with “strip unknown keys” works too.',
      fixCode: `function toPublic(u: UserRow): PublicUser {\n  return { id: u.id, name: u.name };\n}` },
    { title: 'Feature flags crash for new tenants',
      symptom: '<code>TypeError: Cannot read properties of undefined (reading \'enabled\')</code> for tenants created this week.',
      diagnose: `const flags: Record<string, { enabled: boolean }> = await loadFlags(tenant);\nif (flags["new-checkout"].enabled) { … }   // typed as present`,
      cause: 'New tenants had no row for the flag. The index signature read was typed as always defined.',
      fix: 'Turn on <code>noUncheckedIndexedAccess</code> and handle missing keys with a default.',
      fixCode: `if (flags["new-checkout"]?.enabled ?? false) { … }` },
    { title: 'Config mutated by a library at startup',
      symptom: 'The app’s retry count changes from 3 to 0 after a client library initializes, though the config is typed <code>Readonly&lt;Config&gt;</code>.',
      diagnose: `const config: Readonly<Config> = load();\nlegacyClient.init(config as any);   // the JS library sets config.retries = 0`,
      cause: '<code>Readonly</code> is a compile-time view. A cast and an untyped JS library bypassed it.',
      fix: 'Pass a copy to code you don’t control, and freeze config at runtime in development to catch writers.',
      fixCode: `const config = Object.freeze(load());\nlegacyClient.init({ ...config });` }
  ],
  puzzles: [
    { kind: 'output', q: 'What does it print?', code: `interface Cfg { readonly port: number }\nconst c: Cfg = { port: 80 };\n(c as { port: number }).port = 8080;\nconsole.log(c.port);`, options: ['80', '8080', 'It throws: read-only property', 'It does not compile'], answer: 1, explain: '<code>readonly</code> is erased. The cast removes it at compile time, and at runtime it is a normal property.', run: true, expect: '8080' },
    { kind: 'output', q: 'What does it print?', code: `interface Point { x: number; y: number }\nconst p3 = { x: 1, y: 2, z: 3 };\nconst p: Point = p3;\nconsole.log(Object.keys(p).length, JSON.stringify(p));`, options: ['2 {"x":1,"y":2}', '3 {"x":1,"y":2,"z":3}', 'It does not compile: excess property z', '3 {"x":1,"y":2}'], answer: 1, explain: 'Assigning a variable (not a fresh literal) skips the excess check, and types never strip properties. <code>p</code> is the same object.', run: true, expect: '3 {"x":1,"y":2,"z":3}' },
    { kind: 'output', q: 'What does it print?', code: `const counts: Record<string, number> = {};\nfor (const w of ["a", "b", "a"]) counts[w] = (counts[w] ?? 0) + 1;\nconsole.log(counts["a"], counts["zzz"]);`, options: ['2 0', '2 undefined', '2 NaN', 'It does not compile'], answer: 1, explain: 'A missing key reads as <code>undefined</code>, even though the type says <code>number</code>. <code>??</code> handled it inside the loop.', run: true, expect: '2 undefined' },
    { kind: 'concept', q: 'Which line is a compile error?', code: `interface Opts { retries: number }\nconst o = { retries: 3, retires: 5 };\nconst a: Opts = o;                       // 1\nconst b: Opts = { retries: 3, retires: 5 }; // 2\nconst c = { retries: 3 } satisfies Opts;   // 3`, options: ['1', '2', '3', 'None'], answer: 1, explain: 'Only the fresh literal on line 2 gets the excess property check (catching the typo <code>retires</code>). Line 1 passes a variable.' },
    { kind: 'concept', q: 'What can a <code>type</code> alias do that an <code>interface</code> cannot?', options: ['Have optional properties', 'Be extended by a class with implements', 'Name a union like <code>"a" | "b"</code>', 'Describe methods'], answer: 2, explain: 'Interfaces describe object shapes only. Type aliases can name unions, tuples, primitives, mapped and conditional types. Classes can <code>implement</code> both (if the alias is an object type).' },
    { kind: 'concept', q: 'Two files in the same global scope each declare <code>interface Window { … }</code> with different properties. What happens?', options: ['Duplicate identifier error', 'The second replaces the first', 'They merge into one interface', 'The first one wins'], answer: 2, explain: 'Declaration merging. This is how libraries add properties to <code>Window</code> or Express’s <code>Request</code>. Type aliases cannot merge.' },
    { kind: 'concept', q: 'What does <code>satisfies</code> (TS 4.9+) do here?', code: `const routes = {\n  home: "/",\n  user: "/users/:id",\n} satisfies Record<string, string>;\nroutes.user;   // type?`, options: ['Casts routes to <code>Record&lt;string, string&gt;</code>; <code>routes.user</code> is <code>string</code>', 'Checks the object against the type but keeps the inferred type; <code>routes.user</code> is known to exist', 'Adds a runtime validation', 'Makes the object readonly'], answer: 1, explain: '<code>satisfies</code> validates without widening. With an annotation, <code>routes.typo</code> would also type-check as a string; with <code>satisfies</code> it is an error.' }
  ],
  interview: [
    { q: 'Interface vs type alias?', a: '<p>Both describe object shapes and both can be implemented by classes. <b>Interfaces</b>: <code>extends</code>, declaration merging, slightly better error messages. <b>Type aliases</b>: unions, tuples, mapped/conditional types, intersections. Common convention: interfaces for public object shapes, types for everything else.</p>', lvl: 'core' },
    { q: 'What is structural typing?', a: '<p>Types are compatible if their members are compatible, regardless of names. A <code>{ x, y, z }</code> object can be used as a <code>Point { x, y }</code>. Java is nominal: only declared relationships count.</p>', fu: 'How do you get nominal behaviour? (branded types, or classes with private members)', lvl: 'core' },
    { q: 'What is an excess property check?', a: '<p>When a <b>fresh object literal</b> is assigned to a typed target, TS reports properties the target does not declare. It catches typos. It does not apply to variables, or after a type assertion.</p>', lvl: 'core' },
    { q: 'How do <code>readonly</code> and <code>Readonly&lt;T&gt;</code> work?', a: '<p>They prevent assignment at compile time, one level deep. Erased at runtime. Use <code>readonly T[]</code> for arrays, a recursive <code>DeepReadonly</code> type for nested data, and <code>Object.freeze</code> when you need runtime enforcement.</p>', lvl: 'core' },
    { q: 'What is an index signature and what is the risk?', a: '<p><code>{ [k: string]: V }</code> allows any key. Reads are typed <code>V</code> even for missing keys, unless <code>noUncheckedIndexedAccess</code> is on. Known properties must also be compatible with <code>V</code>.</p>', lvl: 'core' },
    { q: '<code>extends</code> vs <code>&amp;</code>?', a: '<p>Both combine shapes. <code>interface B extends A</code> reports conflicting property types as an error at the declaration. <code>A &amp; B</code> silently intersects conflicting properties (e.g. <code>string &amp; number</code> becomes <code>never</code>).</p>', lvl: 'deep' },
    { q: 'Optional property vs property of type <code>T | undefined</code>?', a: '<p><code>x?: T</code>: the key may be missing. <code>x: T | undefined</code>: the key must be present. <code>exactOptionalPropertyTypes</code> stops you assigning <code>undefined</code> explicitly to <code>x?</code>. Matters for PATCH payloads where “absent” and “set to null/undefined” mean different things.</p>', lvl: 'deep' },
    { q: 'What are <code>Partial</code>, <code>Pick</code>, <code>Omit</code>, <code>Required</code>?', a: '<p>Built-in mapped types: <code>Partial&lt;T&gt;</code> makes all properties optional, <code>Required</code> the opposite, <code>Pick&lt;T, K&gt;</code> keeps some keys, <code>Omit&lt;T, K&gt;</code> drops some. Typical use: <code>type UserPatch = Partial&lt;Omit&lt;User, "id"&gt;&gt;</code>.</p>', lvl: 'core' },
    { q: 'What does <code>satisfies</code> do?', a: '<p>Checks that an expression is assignable to a type without changing its inferred type. You keep literal keys and narrow types, and still get errors for wrong shapes. Great for config and lookup tables.</p>', lvl: 'deep' },
    { q: 'When would you use a <code>Map</code> instead of a <code>Record</code>?', a: '<p>For dynamic, user-controlled keys, non-string keys, frequent adds/deletes, or when you need insertion order and size. <code>Map.get</code> is typed <code>V | undefined</code>, and there are no prototype-key surprises. <code>Record</code> is fine for fixed, JSON-shaped data.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'DTOs that mirror Java records', code: `// record CustomerDto(String id, String name, Optional<String> email, List<AddressDto> addresses)\nexport interface AddressDto { readonly line1: string; readonly city: string }\nexport interface CustomerDto {\n  readonly id: string;\n  readonly name: string;\n  readonly email?: string;           // Optional<String> → may be absent\n  readonly addresses: readonly AddressDto[];\n}\n\nexport type CustomerPatch = Partial<Omit<CustomerDto, 'id' | 'addresses'>>;`, note: 'Jackson by default writes <code>null</code> for empty values; configure <code>NON_ABSENT</code> if you want absent keys to match <code>?</code>.' },
    { title: 'Explicit mapping at the boundary', code: `interface UserRow { id: string; name: string; email: string; password_hash: string }\nexport interface PublicUser { id: string; name: string }\n\nexport function toPublic(u: UserRow): PublicUser {\n  const { id, name } = u;     // pick, don’t spread\n  return { id, name };\n}` },
    { title: 'Lookup table with satisfies', code: `type Handler = (body: unknown) => Promise<void>;\n\nconst handlers = {\n  'order.created': onOrderCreated,\n  'order.paid': onOrderPaid,\n} satisfies Record<string, Handler>;\n\ntype EventName = keyof typeof handlers;   // 'order.created' | 'order.paid'\nexport function dispatch(name: EventName, body: unknown) {\n  return handlers[name](body);\n}` }
  ]
});

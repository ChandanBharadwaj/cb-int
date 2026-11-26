/* Tricky TypeScript: a timed drill of predict-the-type / predict-the-output questions across all 13 TypeScript topics,
   scored, with a per-topic breakdown and a review of misses linking back to the topic pages. */
IA.widget('tricky-typescript', (root, ctx) => {
  const { el, reduced } = ctx;
  /*Q-START*/
  const Q = [
    // ---------- Basics: why & setup ----------
    { t: 'Why & setup', s: 'ts-why-setup', m: 'Basics', q: 'Node 22.6+ with <code>--experimental-strip-types</code>. What does it do with your types?', o: ['Type-checks, then runs', 'Replaces type syntax with whitespace and runs, without type-checking', 'Calls tsc in the background', 'Converts the file to a bundle first'], a: 1, x: 'Node only <b>erases</b> type syntax (it keeps line and column positions by blanking it out) and never checks types. You still need <code>tsc --noEmit</code> in CI to catch type errors.' },
    { t: 'Why & setup', s: 'ts-why-setup', m: 'Basics', q: 'Type errors and all: what does Node 22 type stripping print?', code: `const n: number = 'five' as any;\nlet count: number = 1;\n// @ts-expect-error: deliberately wrong\ncount = 'two';\nconsole.log(count, typeof n);`, o: ['A type error, nothing runs', 'two string', '1 number', 'two number'], a: 1, x: 'Stripping removes annotations and does not check them, so the program runs with plain JavaScript semantics: <code>count</code> is <code>"two"</code> and <code>n</code> is the string <code>"five"</code>.', run: true, expect: 'two string' },
    { t: 'Why & setup', s: 'ts-why-setup', m: 'Basics', q: 'Node 22, strip-only mode (no <code>--experimental-transform-types</code>). A file declares <code>enum Color { Red, Green }</code>. What happens?', o: ['It runs; the enum is erased', 'It fails: enums are not supported in strip-only mode, because they generate code', 'It runs with a warning', 'Color becomes a union type'], a: 1, x: 'Enums, namespaces with values and parameter properties produce JavaScript, so they cannot simply be erased. Node reports an unsupported-syntax error. TS 5.8’s <code>erasableSyntaxOnly</code> flags them at compile time.' },
    // ---------- Basics: basic types ----------
    { t: 'Basic types', s: 'ts-basic-types', m: 'Basics', q: 'What does this print?', code: `const pair: [string, number] = ['a', 1];\npair.push(2);\nconsole.log(pair.length);`, o: ['2', '3', 'Compile error: tuple is fixed length', 'TypeError at runtime'], a: 1, x: 'Tuples are arrays. <code>push</code> is allowed because it accepts <code>string | number</code>, so the “fixed” tuple grows to 3. Use <code>readonly [string, number]</code> to forbid it.', run: true, expect: '3' },
    { t: 'Basic types', s: 'ts-basic-types', m: 'Basics', q: 'Types of <code>a</code> and <code>b</code>?', code: `const a = 'hi';\nlet b = a;`, o: ['"hi" and "hi"', '"hi" and string', 'string and string', 'string and "hi"'], a: 1, x: '<code>const</code> keeps the literal type <code>"hi"</code>. A mutable <code>let</code> initialised from a widening literal type widens to <code>string</code>, since it may be reassigned.' },
    { t: 'Basic types', s: 'ts-basic-types', m: 'Basics', q: 'Which line is a compile error?', code: `const x: any = 'hi';\nconst u: unknown = 'hi';\nx.toUpperCase();   // (1)\nu.toUpperCase();   // (2)\nconst s: string = u;  // (3)`, o: ['Only (2)', '(2) and (3)', 'Only (3)', 'All three'], a: 1, x: '<code>unknown</code> must be narrowed before you use it or assign it to a narrower type. <code>any</code> allows everything.' },
    // ---------- Basics: functions ----------
    { t: 'Functions', s: 'ts-functions', m: 'Basics', q: 'What does this print?', code: `function greet(name = 'world', punct?: string): string {\n  return \`hi \${name}\${punct ?? '!'}\`;\n}\nconsole.log(greet(undefined, '?'), greet(null as any));`, o: ['hi world? hi world!', 'hi world? hi null!', 'hi undefined? hi null!', 'hi world? hi !'], a: 1, x: 'A default applies only when the argument is <code>undefined</code>. <code>null</code> is passed through.', run: true, expect: 'hi world? hi null!' },
    { t: 'Functions', s: 'ts-functions', m: 'Basics', q: 'Does this compile?', code: `const f: () => void = () => 42;\nconst r = f();`, o: ['No: 42 is not void', 'Yes, and r: number', 'Yes, and r: void', 'Yes, and r: undefined'], a: 2, x: 'A function type returning <code>void</code> accepts functions that return anything (so <code>arr.forEach(x =&gt; list.push(x))</code> works). The caller sees <code>void</code>. A function <i>declaration</i> annotated <code>: void</code> may not return a value, though.' },
    { t: 'Functions', s: 'ts-functions', m: 'Basics', q: 'Is the last call OK?', code: `function len(x: string): number;\nfunction len(x: unknown[]): number;\nfunction len(x: string | unknown[]) { return x.length; }\nlen(Math.random() > 0.5 ? 'a' : [1]);`, o: ['Yes', 'No: no overload matches a string | number[] argument', 'No: implementation is missing', 'Yes, but returns any'], a: 1, x: 'Overloads are tried one at a time, and the implementation signature is not callable from outside. A union argument fits neither overload. Add a third overload or use a single union signature.' },
    // ---------- Basics: objects & interfaces ----------
    { t: 'Objects & interfaces', s: 'ts-objects-interfaces', m: 'Basics', q: 'Which is a compile error?', code: `interface Point { x: number; y: number }\nconst a: Point = { x: 1, y: 2, z: 3 };   // (1)\nconst tmp = { x: 1, y: 2, z: 3 };\nconst b: Point = tmp;                     // (2)`, o: ['Both', 'Only (1)', 'Only (2)', 'Neither'], a: 1, x: '<b>Excess property checks</b> apply only to fresh object literals. Through a variable, structural typing accepts any object with at least <code>x</code> and <code>y</code>.' },
    { t: 'Objects & interfaces', s: 'ts-objects-interfaces', m: 'Basics', q: 'What does this print?', code: `interface Point { x: number; y: number }\nconst p3 = { x: 1, y: 2, z: 3 };\nconst p: Point = p3;\nconsole.log(Object.keys(p).length);`, o: ['2', '3', 'Compile error', '0'], a: 1, x: 'The type hides <code>z</code>, but the object still has it. Code that serialises or iterates a “Point” can see extra fields.', run: true, expect: '3' },
    { t: 'Objects & interfaces', s: 'ts-objects-interfaces', m: 'Basics', q: 'Two declarations with the same name in one scope. Which is legal?', code: `interface A { x: number }\ninterface A { y: string }\n\ntype B = { x: number };\ntype B = { y: string };`, o: ['Both', 'Only the interfaces (they merge)', 'Only the type aliases', 'Neither'], a: 1, x: 'Interfaces support <b>declaration merging</b>: <code>A</code> has both <code>x</code> and <code>y</code>. That is how libraries let you augment <code>Window</code> or Express’s <code>Request</code>. Type aliases cannot be redeclared (“Duplicate identifier”).' },
    // ---------- Basics: unions & narrowing ----------
    { t: 'Unions & narrowing', s: 'ts-unions-narrowing', m: 'Basics', q: 'What does this print?', code: `function describe(x: string | object | null): string {\n  if (typeof x === 'object') return x === null ? 'null' : 'object';\n  return 'string';\n}\nconsole.log(describe(null), describe({}), describe('a'));`, o: ['object object string', 'null object string', 'null null string', 'string object string'], a: 1, x: '<code>typeof null === "object"</code>, so TypeScript narrows to <code>object | null</code> in that branch, and the explicit null check is necessary.', run: true, expect: 'null object string' },
    { t: 'Unions & narrowing', s: 'ts-unions-narrowing', m: 'Basics', q: 'What does this print?', code: `function fmt(n?: number): string {\n  return n ? n.toFixed(1) : 'n/a';\n}\nconsole.log(fmt(0), fmt(2));`, o: ['0.0 2.0', 'n/a 2.0', 'n/a n/a', '0 2'], a: 1, x: 'Truthiness narrowing treats <code>0</code> like <code>undefined</code>. Use <code>n !== undefined</code> (or <code>n ?? …</code>) when 0 is a valid value.', run: true, expect: 'n/a 2.0' },
    { t: 'Unions & narrowing', s: 'ts-unions-narrowing', m: 'Basics', q: 'You add <code>{ kind: \'triangle\' }</code> to the <code>Shape</code> union. What happens here?', code: `function area(s: Shape): number {\n  switch (s.kind) {\n    case 'circle': return Math.PI * s.r ** 2;\n    case 'square': return s.side ** 2;\n    default: { const never_: never = s; return never_; }\n  }\n}`, o: ['Nothing until runtime', 'Compile error: triangle is not assignable to never', 'The default branch returns 0', 'A lint warning only'], a: 1, x: 'In <code>default</code>, s is narrowed to the unhandled members. With a new member, it is no longer <code>never</code>, so the assignment fails: an <b>exhaustiveness check</b> at compile time.' },
    // ---------- Basics: classes & enums ----------
    { t: 'Classes & enums', s: 'ts-classes', m: 'Basics', q: 'What does this print?', code: `class Account {\n  private balance = 100;\n}\nconst acc = new Account();\nconsole.log((acc as any).balance, JSON.stringify(acc));`, o: ['undefined {}', '100 {"balance":100}', 'undefined {"balance":100}', 'TypeError: private field'], a: 1, x: '<code>private</code> is compile-time only. It becomes a normal public property. For real runtime privacy use JavaScript <code>#balance</code>, which also does not appear in <code>JSON.stringify</code>.', run: true, expect: '100 {"balance":100}' },
    { t: 'Classes & enums', s: 'ts-classes', m: 'Basics', q: 'After compiling with tsc: what is <code>Object.keys(Dir)</code>?', code: `enum Dir { Up, Down }`, o: ['["Up","Down"]', '["0","1","Up","Down"]', '[]', '["Up","Down","0","1"]'], a: 1, x: 'Numeric enums get a <b>reverse mapping</b> (<code>Dir[0] === "Up"</code>). Integer-like keys come first in property order, so you get <code>["0","1","Up","Down"]</code>. String enums have no reverse mapping. Many teams prefer a union of string literals or an <code>as const</code> object.' },
    { t: 'Classes & enums', s: 'ts-classes', m: 'Basics', q: 'Which class member syntax is <b>not</b> erasable (so fails under Node strip-only mode)?', o: ['private x = 1;', 'readonly id: string;', 'constructor(private repo: Repo) {}', 'abstract run(): void;'], a: 2, x: 'A <b>parameter property</b> generates an assignment (<code>this.repo = repo</code>), so it is not just type syntax. Modifiers on fields and abstract method declarations are simply removed.' },
    // ---------- Going deeper: generics ----------
    { t: 'Generics', s: 'ts-generics', m: 'Going deeper', q: 'Type of <code>r</code>?', code: `function longest<T extends { length: number }>(a: T, b: T): T {\n  return a.length >= b.length ? a : b;\n}\nconst r = longest('alice', 'bob');`, o: ['string', '"alice" | "bob"', '"alice"', '{ length: number }'], a: 1, x: 'T appears at the top level of the return type, so literal candidates are kept and unioned. (This exact example is in the handbook.)' },
    { t: 'Generics', s: 'ts-generics', m: 'Going deeper', q: 'TS 5.4+. Is the call an error?', code: `function light<C extends string>(colors: C[], initial: NoInfer<C>) {}\nlight(['red', 'green'], 'blue');`, o: ['No: C becomes "red" | "green" | "blue"', 'Yes: "blue" is not assignable to "red" | "green"', 'Yes: NoInfer needs an import', 'No: C is string'], a: 1, x: '<code>NoInfer</code> stops <code>initial</code> from contributing to inference. C comes from <code>colors</code> only, then <code>\'blue\'</code> is checked and rejected.' },
    { t: 'Generics', s: 'ts-generics', m: 'Going deeper', q: 'TS 5.0+. Type of <code>r</code>?', code: `function routes<const T extends readonly string[]>(xs: T): T { return xs; }\nconst r = routes(['home', 'about']);`, o: ['string[]', '("home" | "about")[]', 'readonly ["home", "about"]', '["home", "about"]'], a: 2, x: 'A <code>const</code> type parameter infers like <code>as const</code> at the call site: a readonly tuple of literals. With a mutable <code>string[]</code> constraint it would fall back to <code>string[]</code>.' },
    // ---------- Going deeper: utility types ----------
    { t: 'Utility types', s: 'ts-utility-types', m: 'Going deeper', q: 'Which line errors?', code: `interface User { id: string; password: string }\ntype A = Omit<User, 'pasword'>;   // (1)\ntype B = Pick<User, 'pasword'>;   // (2)`, o: ['Both', 'Only (1)', 'Only (2)', 'Neither'], a: 2, x: '<code>Pick</code> constrains K to <code>keyof T</code>; <code>Omit</code> accepts any <code>keyof any</code>. A still contains the password.' },
    { t: 'Utility types', s: 'ts-utility-types', m: 'Going deeper', q: 'What does this print?', code: `type Opts = { color: string; size: number };\nconst base: Opts = { color: 'red', size: 2 };\nconst patch: Partial<Opts> = { size: undefined };\nconst out = { ...base, ...patch };\nconsole.log(out.size, 'size' in out);`, o: ['2 true', 'undefined true', 'undefined false', '2 false'], a: 1, x: 'Optional properties accept an explicit <code>undefined</code> (unless <code>exactOptionalPropertyTypes</code>), and spread copies it over the base value.', run: true, expect: 'undefined true' },
    { t: 'Utility types', s: 'ts-utility-types', m: 'Going deeper', q: 'TS 4.9+. Which access is a compile error?', code: `const a: Record<string, string> = { home: '/' };\nconst b = { home: '/' } satisfies Record<string, string>;\na.hmoe;   // (1)\nb.hmoe;   // (2)`, o: ['Both', 'Only (1)', 'Only (2)', 'Neither'], a: 2, x: 'The annotation replaces <code>a</code>’s type with “any string key”. <code>satisfies</code> checks <code>b</code> but keeps its inferred <code>{ home: string }</code>, so the typo is caught.' },
    // ---------- Going deeper: mapped & conditional ----------
    { t: 'Mapped & conditional', s: 'ts-mapped-conditional', m: 'Going deeper', q: 'What is <code>A</code>?', code: `type ToArray<T> = T extends unknown ? T[] : never;\ntype A = ToArray<string | boolean>;`, o: ['(string | boolean)[]', 'string[] | boolean[]', 'string[] | false[] | true[]', 'never'], a: 2, x: 'Distribution runs over every member, and <code>boolean</code> is <code>true | false</code>.' },
    { t: 'Mapped & conditional', s: 'ts-mapped-conditional', m: 'Going deeper', q: 'What is <code>X</code>?', code: `type IsString<T> = T extends string ? 'yes' : 'no';\ntype X = IsString<never>;`, o: ['"no"', '"yes"', 'never', '"yes" | "no"'], a: 2, x: '<code>never</code> is the empty union; distributing over it produces <code>never</code>. Use <code>[T] extends [string]</code>.' },
    { t: 'Mapped & conditional', s: 'ts-mapped-conditional', m: 'Going deeper', q: 'What is <code>K</code>?', code: `type K = keyof { [key: string]: boolean };`, o: ['string', 'string | number', 'PropertyKey', 'never'], a: 1, x: 'Numeric keys are converted to strings at runtime, so a string index signature also allows numbers: <code>string | number</code>.' },
    // ---------- Going deeper: modules & config ----------
    { t: 'Modules & tsconfig', s: 'ts-modules-config', m: 'Going deeper', q: 'tsconfig <code>"paths": { "@/*": ["src/*"] }</code>, then <code>tsc</code>. What does the emitted import look like?', o: ["'./src/db.js'", "'@/db.js' (unchanged)", 'A bundled copy', "require('./src/db')"], a: 1, x: '<code>tsc</code> never rewrites module specifiers. <code>paths</code> only guides type resolution; the runtime needs its own mapping (bundler, or package.json <code>imports</code>).' },
    { t: 'Modules & tsconfig', s: 'ts-modules-config', m: 'Going deeper', q: '<code>module: nodenext</code>, <code>"type": "module"</code>. Which relative import passes the checker?', o: ["'./util'", "'./util.js'", "'./util.ts' (no extra flags)", "'util'"], a: 1, x: 'Node ESM needs the real output file name, and the checker enforces it. You write <code>.js</code>; TS maps it to <code>util.ts</code>.' },
    { t: 'Modules & tsconfig', s: 'ts-modules-config', m: 'Going deeper', q: 'Why does <code>verbatimModuleSyntax</code> require <code>import type { User }</code> for interfaces?', o: ['It is faster to type-check', 'Imports without type are kept in the output, so a per-file transpiler would import a name that does not exist at runtime', 'Interfaces cannot be imported otherwise', 'It enables tree shaking'], a: 1, x: 'Tools like esbuild, swc and Node type stripping see one file at a time and cannot know <code>User</code> is a type. Marking it makes the erasure explicit.' },
    // ---------- Going deeper: strict mode ----------
    { t: 'Strict mode', s: 'ts-strict-mode', m: 'Going deeper', q: 'What does this print?', code: `const scores: Record<string, number> = { ann: 3 };\nconst bob = scores['bob'];   // type: number (default settings)\nconsole.log(bob * 2, typeof bob);`, o: ['0 number', 'NaN undefined', 'NaN number', 'TypeError'], a: 1, x: 'Without <code>noUncheckedIndexedAccess</code> the lookup is typed <code>number</code>, but the value is <code>undefined</code>, and <code>undefined * 2</code> is <code>NaN</code>.', run: true, expect: 'NaN undefined' },
    { t: 'Strict mode', s: 'ts-strict-mode', m: 'Going deeper', q: 'Which flag is <b>not</b> turned on by <code>"strict": true</code>?', o: ['strictNullChecks', 'noImplicitAny', 'exactOptionalPropertyTypes', 'useUnknownInCatchVariables'], a: 2, x: '<code>exactOptionalPropertyTypes</code> and <code>noUncheckedIndexedAccess</code> are opt-in. <code>useUnknownInCatchVariables</code> joined the strict family in TS 4.4.' },
    { t: 'Strict mode', s: 'ts-strict-mode', m: 'Going deeper', q: 'Which line is a compile error?', code: `const a = 'x' as number;             // (1)\nconst b = 'x' as unknown as number;  // (2)`, o: ['Both', 'Only (1)', 'Only (2)', 'Neither'], a: 1, x: 'A direct assertion between types that do not overlap is TS2352. Going through <code>unknown</code> forces it, which is why <code>as unknown as</code> is a code-review red flag.' },
    // ---------- Going deeper: types vs runtime ----------
    { t: 'Types vs runtime', s: 'ts-runtime-validation', m: 'Going deeper', q: 'What does this print?', code: `type Cents = number & { readonly __brand: 'Cents' };\nconst price = 1999 as Cents;\nconsole.log(price / 100, typeof price);`, o: ['19.99 number', '19.99 object', 'NaN number', '1999 Cents'], a: 0, x: 'Brands exist only in the type. At runtime it is the plain number 1999: zero cost.', run: true, expect: '19.99 number' },
    { t: 'Types vs runtime', s: 'ts-runtime-validation', m: 'Going deeper', q: 'Given <code>interface User { id: number }</code>, how do you check at runtime that <code>x</code> is a User?', o: ['x instanceof User', 'typeof x === "User"', 'With a value-level check: a schema (Zod etc.) or a hand-written type guard', 'x satisfies User'], a: 2, x: 'Interfaces are erased, so <code>instanceof User</code> does not compile (“only refers to a type”) and <code>satisfies</code> is compile-time only.' },
    { t: 'Types vs runtime', s: 'ts-runtime-validation', m: 'Going deeper', q: 'Zod, default <code>z.object({ id: z.number() })</code>. Result of <code>.parse({ id: 1, admin: true })</code>?', o: ['{ id: 1, admin: true }', '{ id: 1 }', 'Throws: unrecognized key', 'undefined'], a: 1, x: 'Unknown keys are stripped by default. Use <code>.strict()</code> (Zod 3) or <code>z.strictObject</code> (Zod 4) to reject them, which you usually want on write endpoints.' },
    // ---------- Practice: for Java developers ----------
    { t: 'For Java devs', s: 'ts-for-java-devs', m: 'Practice', q: 'Does this compile?', code: `class Cat { name = 'Tom'; }\nclass Dog { name = 'Rex'; }\nconst d: Dog = new Cat();`, o: ['No: Cat is not a Dog', 'Yes: types are structural, and Cat has the same shape', 'Only with implements Dog', 'Only if Dog is an interface'], a: 1, x: 'TypeScript compares shapes, not names. Classes with <code>private</code> or <code>#</code> members are the exception: those members make the class effectively nominal.' },
    { t: 'For Java devs', s: 'ts-for-java-devs', m: 'Practice', q: 'What does this print?', code: `class Printer {\n  print(x: string): string;\n  print(x: number): string;\n  print(x: string | number): string {\n    return typeof x === 'number' ? \`num:\${x}\` : \`str:\${x}\`;\n  }\n}\nconst p = new Printer();\nconsole.log(p.print(1), p.print('1'), Printer.prototype.print.length);`, o: ['num:1 str:1 1', 'num:1 num:1 2', 'str:1 str:1 3', 'Compile error: duplicate method'], a: 0, x: 'Overloads are signatures only. There is one runtime method, and it must branch on the argument itself. Its <code>length</code> is 1.', run: true, expect: 'num:1 str:1 1' },
    { t: 'For Java devs', s: 'ts-for-java-devs', m: 'Practice', q: 'Which is valid TypeScript but has no direct Java equivalent?', o: ['A generic interface', 'Box<number> with a primitive type argument', 'Type erasure of generics', 'An upper-bounded type parameter'], a: 1, x: 'TS type arguments can be primitives, literals or unions (<code>Box&lt;number&gt;</code>, <code>Box&lt;\'a\' | \'b\'&gt;</code>). Java needs boxed types. Both erase generics, and both support bounds.' },
    { t: 'For Java devs', s: 'ts-for-java-devs', m: 'Practice', q: 'What does this print?', code: `const a = { id: 1 };\nconst b = { id: 1 };\nconsole.log(a === b, JSON.stringify(a) === JSON.stringify(b), 'x' === 'x');`, o: ['true true true', 'false true true', 'false false true', 'false true false'], a: 1, x: 'Objects compare by reference; there is no <code>equals()</code> to override. Strings compare by value with <code>===</code>, unlike Java’s <code>==</code> on String objects.', run: true, expect: 'false true true' }
  ];
  /*Q-END*/
  const MODS = ['All', ...new Set(Q.map((q) => q.m))];
  if (!document.getElementById('w-tts-style')) {
    document.head.append(el('style', { id: 'w-tts-style', text: `
.w-tts-bar { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; margin: 8px 0; }
.w-tts-bar div { height: 100%; background: var(--accent); }
.w-tts-bar div.low { background: var(--err); }
.w-tts-opts { display: grid; gap: 6px; margin-top: 10px; }
.w-tts-opts button { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 9px; padding: 9px 12px; font-size: 14px; cursor: pointer; overflow-wrap: anywhere; }
.w-tts-opts button:hover:not(:disabled) { border-color: var(--accent); }
.w-tts-opts button.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 15%, transparent); }
.w-tts-opts button.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 15%, transparent); }
.w-tts-opts button:disabled { cursor: default; }
.w-tts-q { font-size: 16px; margin: 6px 0 8px; }
.w-tts-rev { border-top: 1px solid var(--border); padding: 10px 0; }
.w-tts-rev:first-child { border-top: 0; }
.w-tts-brk { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; margin-top: 8px; }
.w-tts-brk a { display: block; font-size: 12.5px; border: 1px solid var(--border); border-radius: 8px; padding: 5px 8px; background: var(--surface-2); color: var(--text-2); text-decoration: none; }
.w-tts-brk a b { font-family: var(--mono); color: var(--text); }
.w-tts-brk a.low { border-color: var(--err); }
.w-tts-brk a:hover { border-color: var(--accent); }
` }));
  }
  let mod = 'All'; let count = 10; let secs = 60; let gen = 0; let deck = []; let i = 0; let score = 0; let misses = []; let left = 0; let answered = false; let started = false; let tick = null;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segT = seg(MODS.map((t) => [t, t]), () => mod, (v) => { mod = v; reset(); }, 'Module');
  const segN = seg([[10, '10 questions'], [25, '25'], [Q.length, `all ${Q.length}`]], () => count, (v) => { count = v; reset(); }, 'Number of questions');
  const segS = seg([[90, 'Slow · 90 s'], [60, 'Normal · 60 s'], [30, 'Fast · 30 s']], () => secs, (v) => { secs = v; reset(); }, 'Time per question');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Start' }); const bStep = el('button', { class: 'btn', text: 'Skip ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const card = el('div', { class: 'card', style: { padding: '14px', marginTop: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segT), el('div', { class: 'w-controls' }, segN, el('span', { class: 'tiny', text: 'time per question' }), segS),
    el('div', { class: 'w-controls' }, bPlay, bStep, bReset), stats, card, narr);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  function shuffle(a) { const r = a.slice(); for (let j = r.length - 1; j > 0; j--) { const m = Math.floor(Math.random() * (j + 1)); [r[j], r[m]] = [r[m], r[j]]; } return r; }
  function renderStats() { stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `question <b>${Math.min(i + 1, deck.length)}</b>/${deck.length}` }), el('span', { class: 'w-stat', html: `score <b>${score}</b>` }), el('span', { class: 'w-stat', html: `missed <b>${misses.length}</b>` }), el('span', { class: 'w-stat', html: `time <b>${started && !answered ? left + ' s' : '–'}</b>` })); }
  function stopTimer() { if (tick) { clearInterval(tick); tick = null; } }
  function show() {
    const q = deck[i]; answered = false; left = secs; card.innerHTML = '';
    const bar = el('div'); const barWrap = el('div', { class: 'w-tts-bar' }, bar);
    const opts = el('div', { class: 'w-tts-opts' });
    card.append(el('div', { class: 'w-controls', style: { marginBottom: '0' } }, el('span', { class: 'pill accent', text: q.t }), q.run ? el('span', { class: 'pill', text: 'runnable program' }) : null, el('span', { class: 'tiny', text: `#${i + 1}` })), barWrap, el('div', { class: 'w-tts-q', html: q.q }));
    if (q.code) card.append(ctx.codeBox(q.code, 'ts'));
    q.o.forEach((o, j) => { const b = el('button', { html: `<b>${'ABCD'[j]}.</b> ${o.includes('<code>') ? o : ctx.esc(o)}` }); b.addEventListener('click', () => answer(j)); opts.append(b); });
    card.append(opts);
    const paint = () => { bar.style.width = (left / secs) * 100 + '%'; bar.className = left <= 10 ? 'low' : ''; if (!reduced) bar.style.transition = 'width 1s linear'; };
    paint(); renderStats(); say('Pick an answer before the bar runs out. Skip counts as a miss.');
    stopTimer(); const g = gen;
    tick = setInterval(() => { if (g !== gen || answered) { stopTimer(); return; } left--; paint(); renderStats(); if (left <= 0) answer(-1); }, 1000);
    card.opts = opts;
  }
  function answer(j) {
    if (answered || !started) return; answered = true; stopTimer();
    const q = deck[i]; const ok = j === q.a;
    if (ok) score++; else misses.push({ q, j });
    [...card.opts.children].forEach((b, m) => { b.disabled = true; if (m === q.a) b.classList.add('ok'); else if (m === j) b.classList.add('bad'); });
    card.append(el('div', { class: 'pz-exp', html: (j === -1 ? '<b>Time’s up.</b> ' : j === -2 ? '<b>Skipped.</b> ' : ok ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.x + ` <a href="${q.s}.html">More: ${ctx.esc(q.t)} →</a>` }));
    bStep.textContent = i + 1 < deck.length ? 'Next ›' : 'Finish ›'; renderStats();
    say(ok ? 'Correct. Press Next.' : 'Read the explanation, then press Next.');
  }
  function next() {
    if (!started) return;
    if (!answered) { answer(-2); return; }
    i++; bStep.textContent = 'Skip ›';
    if (i >= deck.length) return finish();
    show();
  }
  const optHtml = (o) => (o.includes('<code>') ? o : ctx.esc(o));
  function finish() {
    started = false; stopTimer(); bStep.disabled = true; bPlay.textContent = '▶ Again'; card.innerHTML = '';
    const by = {}; deck.forEach((q) => { by[q.t] = by[q.t] || { ok: 0, n: 0, s: q.s }; by[q.t].n++; if (!misses.some((mm) => mm.q === q)) by[q.t].ok++; });
    card.append(el('h3', { text: `Score: ${score} / ${deck.length}`, style: { margin: '0 0 4px' } }), el('div', { class: 'tiny', text: 'Per topic (click to open the topic page):' }),
      el('div', { class: 'w-tts-brk' }, Object.entries(by).map(([t, v]) => el('a', { href: v.s + '.html', class: v.ok < v.n ? 'low' : '', html: `${ctx.esc(t)} <b>${v.ok}/${v.n}</b>` }))));
    if (misses.length) {
      card.append(el('h4', { text: 'Review your misses', style: { margin: '14px 0 4px' } }));
      misses.forEach(({ q, j }) => { const r = el('div', { class: 'w-tts-rev' }, el('div', { html: `<span class="pill">${ctx.esc(q.t)}</span> ${q.q}` }));
        if (q.code) r.append(ctx.codeBox(q.code, 'ts'));
        r.append(el('div', { class: 'tiny', html: `You: ${j < 0 ? (j === -1 ? 'time ran out' : 'skipped') : optHtml(q.o[j])} · Correct: <b>${optHtml(q.o[q.a])}</b>` }),
          el('div', { class: 'pz-exp', html: q.x + ` <a href="${q.s}.html">Revisit ${ctx.esc(q.t)} →</a>` }));
        card.append(r); });
    } else card.append(el('p', { text: `No misses. Try all ${Q.length} on Fast.` }));
    renderStats(); say(`Done: ${score}/${deck.length}. ` + (misses.length ? 'Your misses are listed above, each with a link back to its topic.' : ''));
  }
  function reset() {
    gen++; stopTimer(); started = false; answered = false; i = 0; score = 0; misses = [];
    const pool = Q.filter((q) => mod === 'All' || q.m === mod); deck = shuffle(pool).slice(0, count);
    bPlay.textContent = '▶ Start'; bStep.textContent = 'Skip ›'; bStep.disabled = true; card.innerHTML = '';
    card.append(el('p', { html: `<b>${deck.length}</b> question${deck.length === 1 ? '' : 's'} (${mod === 'All' ? 'all modules' : mod}), <b>${secs} s</b> each. Predict the output in your head, as in an interview: no running code.`, style: { margin: 0 } }));
    renderStats(); say('Choose a module, how many questions and the time limit, then press Start.');
  }
  bPlay.addEventListener('click', () => { reset(); started = true; bStep.disabled = false; bPlay.textContent = '↻ Restart'; show(); });
  bStep.addEventListener('click', next);
  bReset.addEventListener('click', reset);
  reset();
});

IA.register({
  track: 'typescript',
  slug: 'ts-why-setup',
  title: 'Why TypeScript & setup',
  tagline: 'TypeScript is <b>JavaScript plus a type checker</b>. The types help you while you write and in CI, then they are <b>erased</b>. Nothing checks them at runtime.',
  tldr: {
    problem: 'Large JavaScript codebases break in boring ways: a renamed field, a string where a number was expected, an <code>undefined</code> nobody handled. You find out in production.',
    model: 'Two separate jobs. <b>Checking</b> (tsc, your editor) reads the types and reports errors. <b>Running</b> (tsc output, tsx, Node type stripping) deletes the types and executes plain JS.',
    hook: '“Does TypeScript make my code safer at runtime?” No. It catches mistakes before runtime. Data from outside (JSON, HTTP, env vars) is unchecked unless you validate it.',
    facts: [
      { v: '0', l: 'runtime type checks added by the compiler. Types are erased from the emitted JavaScript' },
      { v: 'Node 22.6', l: 'first Node release with <code>--experimental-strip-types</code>, which runs <code>.ts</code> files by removing the types' },
      { v: 'emit ≠ pass', l: 'plain <code>tsc</code> still writes <code>.js</code> files when there are type errors, unless <code>noEmitOnError</code> is set' }
    ]
  },
  intro: {
    what: 'JavaScript has no type declarations: a variable can hold a number now and a string later, and mistakes show up only when the line runs. <b>TypeScript</b> adds optional annotations like <code>: number</code> and a <b>compiler</b> (<code>tsc</code>) that checks them. The output is ordinary JavaScript, so it runs anywhere JS runs: browsers, Node, Deno, Bun.',
    analogy: { icon: '📐', title: 'A building inspector, not a wall', text: 'The type checker is an inspector who reviews the plans before construction. Good plans prevent most problems. But once the building is up, the inspector has gone home: if a truck (bad JSON from an API) hits the wall, nothing in the plans stops it.' },
    steps: [
      { t: 'Install it per project', d: 'TypeScript is an npm dev dependency, pinned per project like any library.', code: 'npm install --save-dev typescript\nnpx tsc --init        # writes tsconfig.json', lang: 'bash' },
      { t: 'Write .ts files', d: 'Normal JavaScript with annotations. Most types are inferred, so you annotate mainly function parameters.', code: 'function total(price: number, qty: number): number {\n  return price * qty;\n}' },
      { t: 'Check', d: '<code>tsc --noEmit</code> type-checks the project and exits non-zero on errors. Your editor runs the same checker on every keystroke.', code: 'npx tsc --noEmit', lang: 'bash' },
      { t: 'Run', d: 'Compile to JS with <code>tsc</code> and run the output, or run the <code>.ts</code> directly with <b>tsx</b> or Node’s type stripping. These runners do not type-check.', code: 'npx tsx src/main.ts\nnode --experimental-strip-types src/main.ts   # Node 22.6+', lang: 'bash' }
    ],
    terms: [
      ['tsc', 'The TypeScript compiler. It type-checks and (optionally) emits JavaScript.'],
      ['tsconfig.json', 'Project settings for tsc and the editor: strictness, target JS version, module system, which files.'],
      ['type erasure', 'Types are removed when TS becomes JS. No type information exists at runtime.'],
      ['transpile', 'Convert TS to JS without checking types. What tsx, esbuild, swc and Node stripping do.'],
      ['language service', 'The part of TypeScript your editor talks to: red squiggles, completions, rename, go-to-definition.'],
      ['strict', 'A tsconfig flag that turns on the important checks, including <code>strictNullChecks</code>.']
    ]
  },
  visual: {
    title: 'One file, three pipelines',
    caption: 'Pick a pipeline, then press Play or Step. Watch where the type error is reported, and where it is silently ignored. The last tab walks through a sensible <code>tsconfig.json</code>.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'Types are erased', code: `// This is the JavaScript that tsc emits for:\n//   function total(p: number, qty: number): number { return p * qty; }\nfunction total(p, qty) { return p * qty; }\n\n// A caller that skipped the checker (plain JS, or 'as any'):\nconsole.log(total("9.99", 2));   // coerces\nconsole.log(total("abc", 2));    // NaN, no error\nconsole.log(total(undefined, 2));`, note: 'Plain JavaScript (types erased). The runtime never sees <code>: number</code>.' },
      { label: 'Validate at the edge', code: `// Types don’t check JSON. A small hand-written guard does.\nfunction isUser(x) {\n  return typeof x === 'object' && x !== null && typeof x.name === 'string';\n}\nfor (const raw of ['{"name":"Ana"}', '{"name":5}', 'null']) {\n  const v = JSON.parse(raw);\n  console.log(raw, '→', isUser(v) ? 'valid User' : 'rejected');\n}`, note: 'Plain JavaScript (types erased). In TS, <code>isUser</code> would be a type guard: <code>(x: unknown): x is User</code>.' }
    ]
  },
  gotchas: [
    { trap: 'Assuming types are checked at runtime', code: `interface User { name: string }\nconst u = (await res.json()) as User;   // a promise, not a check\nu.name.toUpperCase();                    // crashes if name is missing`, why: '<code>as</code> is an assertion: you tell the compiler to trust you. JSON from the network can be anything.', fix: 'Type external data as <code>unknown</code> and validate it (a type guard or a schema library such as Zod) at the boundary.' },
    { trap: 'tsx / Node stripping in CI as the only step', why: 'tsx, esbuild, swc and Node type stripping only remove types. A build that only runs them never type-checks, so a red-squiggle error goes to production.', fix: 'Add <code>tsc --noEmit</code> as its own CI step (and fail the build on it).', code: `"scripts": {\n  "dev": "tsx watch src/main.ts",\n  "typecheck": "tsc --noEmit",\n  "build": "tsc -p tsconfig.build.json"\n}`, lang: 'json' },
    { trap: 'tsc emits even with errors', why: 'By default errors don’t stop emit. A Dockerfile that runs <code>tsc &amp;&amp; node dist/main.js</code> fails on exit code, but a script that ignores the exit code ships broken output.', fix: 'Set <code>"noEmitOnError": true</code>, and never ignore the exit code.' },
    { trap: 'Running enums or parameter properties with Node type stripping', code: `enum Role { Admin, User }      // needs generated code\n// node --experimental-strip-types → ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`, why: 'Stripping only deletes types. <code>enum</code>, <code>namespace</code> (with values) and constructor parameter properties need code generation.', fix: 'Use union literals and explicit fields, and turn on <code>"erasableSyntaxOnly": true</code> (TS 5.8+) so tsc flags them. Or use tsx, or Node’s <code>--experimental-transform-types</code>.' },
    { trap: 'Leaving strict off “for now”', why: 'Without <code>strictNullChecks</code>, <code>null</code> and <code>undefined</code> fit into every type, so the most common bug class is invisible. Turning strict on later means fixing thousands of errors at once.', fix: 'Start every new project with <code>"strict": true</code>. For a migration, enable it per folder via a separate tsconfig, or with a gradual tool, but keep a deadline.' },
    { trap: 'Import paths under Node type stripping', code: `import { add } from './math';      // fails: Node needs the real file\nimport { add } from './math.ts';   // works with stripping`, why: 'Node does not guess extensions in ESM, and stripping does not rewrite paths.', fix: 'Write <code>.ts</code> extensions with <code>allowImportingTsExtensions</code> (needs <code>noEmit</code>), or <code>rewriteRelativeImportExtensions</code> (TS 5.7+) when tsc also emits.' }
  ],
  scenarios: [
    { title: 'Green CI, red production: “Cannot read properties of undefined”',
      symptom: 'A service built with <code>esbuild</code> deploys fine, then crashes on the first request that hits a renamed field.',
      diagnose: `$ npx tsc --noEmit\nsrc/orders.ts:42:18 - error TS2339: Property 'customerId' does not exist on type 'Order'.`,
      cause: 'The build only transpiled. Nobody had run the type checker in CI since the bundler switch; the editor showed the error but the PR was merged anyway.',
      fix: 'Add a required <code>typecheck</code> job. Treat it like unit tests: no merge on red.',
      fixCode: `# .github/workflows/ci.yml (excerpt)\n- run: npm ci\n- run: npx tsc --noEmit\n- run: npm test`, lang: 'yaml' },
    { title: 'Prices became strings after an API change',
      symptom: 'Order totals show <code>"19.99" + 5 = "19.995"</code> in invoices. The code is fully typed as <code>price: number</code>.',
      diagnose: `const body = await res.json() as PriceResponse;  // assertion, no check\nconsole.log(typeof body.price);                  // "string" since v2 of the API`,
      cause: 'An upstream service started sending decimal strings. <code>as PriceResponse</code> trusted the JSON; types are erased, so nothing complained.',
      fix: 'Validate at the boundary and fail loudly. A schema library gives you both the check and the type.',
      fixCode: `import { z } from 'zod';\nconst PriceResponse = z.object({ price: z.coerce.number() });\ntype PriceResponse = z.infer<typeof PriceResponse>;\nconst body = PriceResponse.parse(await res.json());` },
    { title: 'Node 22 container refuses to start',
      symptom: 'After switching from tsx to <code>node --experimental-strip-types</code>, startup fails with <code>ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX</code>.',
      diagnose: `grep -rnE "^\\s*(export )?(const )?enum |constructor\\((private|public|readonly)" src/`,
      cause: 'The code base uses enums and constructor parameter properties. Both need generated JavaScript, which stripping cannot do.',
      fix: 'Turn on <code>erasableSyntaxOnly</code> (TS 5.8+) and replace them: union literal types or <code>as const</code> objects, and explicit field declarations.',
      fixCode: `// before\nenum Role { Admin = 'admin', User = 'user' }\n// after\nconst Role = { Admin: 'admin', User: 'user' } as const;\ntype Role = typeof Role[keyof typeof Role];` }
  ],
  puzzles: [
    { kind: 'output', q: 'Run with <code>node --experimental-strip-types</code>. What does it print?', code: `function double(n: number): number {\n  return n * 2;\n}\nconst input: any = "21";\nconsole.log(double(input));`, options: ['A type error at runtime', '42', '"2121"', 'NaN'], answer: 1, explain: '<code>any</code> silences the checker, and types are erased anyway. At runtime <code>"21" * 2</code> coerces the string to a number: <code>42</code>.', run: true, expect: '42' },
    { kind: 'output', q: 'What does it print?', code: `interface User { name: string }\nconst u = JSON.parse('{"name": 5}') as User;\nconsole.log(typeof u.name);`, options: ['string', 'number', 'It throws: name is not a string', 'undefined'], answer: 1, explain: '<code>as User</code> is a compile-time assertion only. The real value has <code>name: 5</code>, so <code>typeof</code> reports <code>number</code>.', run: true, expect: 'number' },
    { kind: 'output', q: 'What does it print?', code: `type Id = string;\nconst id: Id = "a1";\nconst n = id as unknown as number;\nconsole.log(typeof id, typeof n);`, options: ['string number', 'string string', 'Id number', 'It does not compile'], answer: 1, explain: 'A double assertion compiles, but changes nothing at runtime. Both variables hold the same string. Type aliases like <code>Id</code> do not exist at runtime at all.', run: true, expect: 'string string' },
    { kind: 'concept', q: 'Your CI runs only <code>tsx src/test.ts</code>. A file has a type error. What happens?', options: ['tsx fails with the type error', 'tsx prints a warning and continues', 'tsx runs the code; the type error is never reported', 'tsx refuses .ts files with errors'], answer: 2, explain: 'tsx transpiles with esbuild, which strips types without checking them. Run <code>tsc --noEmit</code> separately.' },
    { kind: 'concept', q: 'Which of these runs under Node’s <code>--experimental-strip-types</code> without extra flags?', options: ['<code>enum Color { Red, Green }</code>', '<code>constructor(private db: Db) {}</code>', '<code>interface P { x: number }</code> and <code>let p: P = { x: 1 }</code>', '<code>namespace Util { export const x = 1 }</code>'], answer: 2, explain: 'Interfaces and annotations can be erased. Enums, parameter properties and value namespaces need generated code, so they fail with <code>ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX</code>.' },
    { kind: 'concept', q: 'Which flag is <b>not</b> turned on by <code>"strict": true</code>?', options: ['<code>strictNullChecks</code>', '<code>noImplicitAny</code>', '<code>noUncheckedIndexedAccess</code>', '<code>strictFunctionTypes</code>'], answer: 2, explain: '<code>noUncheckedIndexedAccess</code> is opt-in. It makes <code>arr[i]</code> and index-signature reads include <code>undefined</code>.' }
  ],
  interview: [
    { q: 'What is TypeScript, in one sentence?', a: '<p>A superset of JavaScript that adds a static type system checked at compile time. It compiles to plain JavaScript and its types are erased.</p>', lvl: 'core' },
    { q: 'What does “types are erased” mean in practice?', a: '<p>The emitted JS contains no type information. You cannot ask “is this a <code>User</code>?” at runtime unless you write a check. <code>as</code> casts change nothing at runtime. External data must be validated.</p>', fu: 'How do you validate JSON then? (type guards, Zod/Valibot, JSON Schema + Ajv)', lvl: 'core' },
    { q: 'tsc vs tsx vs esbuild vs Node type stripping?', a: '<ul><li><b>tsc</b>: the only one that type-checks. Can also emit JS and <code>.d.ts</code> files.</li><li><b>tsx</b>: runs TS directly (esbuild under the hood). No checking.</li><li><b>esbuild/swc</b>: fast transpilers and bundlers. No checking.</li><li><b>Node 22.6+ stripping</b>: removes erasable types. No checking, no enums.</li></ul><p>Typical setup: fast runner for dev, <code>tsc --noEmit</code> in the editor and CI.</p>', lvl: 'core' },
    { q: 'Which tsconfig options do you always set on a new project?', a: '<p><code>strict: true</code>, a <code>target</code> matching the runtime (e.g. ES2022 for Node 22), <code>module</code>/<code>moduleResolution</code> <code>NodeNext</code> for Node (or <code>Bundler</code> for front-ends), <code>noUncheckedIndexedAccess</code>, <code>skipLibCheck</code> for build speed, and <code>verbatimModuleSyntax</code> or <code>isolatedModules</code> when another tool transpiles.</p>', lvl: 'core' },
    { q: 'Why do tools like esbuild need <code>isolatedModules</code>?', a: '<p>They compile one file at a time, without type information from other files. Some TS features need it: re-exporting a type without <code>export type</code>, or <code>const enum</code> across files. <code>isolatedModules</code> makes tsc reject code that a per-file transpiler cannot handle.</p>', lvl: 'deep' },
    { q: 'What is <code>erasableSyntaxOnly</code>?', a: '<p>A TS 5.8 flag that errors on TypeScript-only syntax with runtime meaning: enums, namespaces with values, parameter properties, <code>import =</code>. Code that passes can run under Node type stripping.</p>', lvl: 'deep' },
    { q: 'Does TypeScript make your program faster or slower?', a: '<p>Neither, by itself. The output is the JS you would have written. Down-levelling to an old <code>target</code> can add helper code; a modern target emits almost the same code.</p>', lvl: 'core' },
    { q: 'What does the editor give you that a Java IDE also gives you?', a: '<p>The TypeScript language service (tsserver) powers red squiggles, completions, rename, find-references and quick fixes in VS Code and other editors. It uses the same tsconfig, so editor and CI agree.</p>', fu: 'Why might the editor and CI disagree? (different TS versions: workspace vs bundled; different tsconfig picked up)', lvl: 'core' },
    { q: 'How do you migrate a JavaScript project to TypeScript?', a: '<ol><li>Add tsconfig with <code>allowJs</code> and <code>checkJs</code> off.</li><li>Rename files to <code>.ts</code> gradually, leaf modules first.</li><li>Use JSDoc types or <code>// @ts-check</code> in JS files on the way.</li><li>Turn on <code>strict</code> as early as you can; track the error count down.</li></ol>', lvl: 'deep' },
    { q: 'What is a <code>.d.ts</code> file?', a: '<p>A declaration file: types only, no code. It describes the shape of a JS library. Packages ship their own or get them from <code>@types/*</code> (DefinitelyTyped). <code>skipLibCheck</code> skips checking them.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'tsconfig for Node 22', lang: 'json', code: `{\n  "compilerOptions": {\n    "target": "ES2022",\n    "module": "NodeNext",\n    "moduleResolution": "NodeNext",\n    "strict": true,\n    "noUncheckedIndexedAccess": true,\n    "noEmitOnError": true,\n    "verbatimModuleSyntax": true,\n    "skipLibCheck": true,\n    "outDir": "dist",\n    "rootDir": "src",\n    "sourceMap": true\n  },\n  "include": ["src"]\n}`, note: 'Roughly the TS equivalent of pinning your Java release and turning on all compiler warnings.' },
    { title: 'package.json scripts', lang: 'json', code: `{\n  "type": "module",\n  "scripts": {\n    "dev": "tsx watch src/main.ts",\n    "typecheck": "tsc --noEmit",\n    "build": "tsc",\n    "start": "node dist/main.js"\n  },\n  "devDependencies": {\n    "typescript": "^5.6.0",\n    "tsx": "^4.0.0",\n    "@types/node": "^22.0.0"\n  }\n}`, note: 'Versions are illustrative. <code>@types/node</code> should match your Node major.' },
    { title: 'Validate at the boundary', code: `interface User { id: string; name: string }\n\nfunction isUser(x: unknown): x is User {\n  return typeof x === 'object' && x !== null\n    && typeof (x as Record<string, unknown>).id === 'string'\n    && typeof (x as Record<string, unknown>).name === 'string';\n}\n\nconst data: unknown = await res.json();\nif (!isUser(data)) throw new Error('bad payload');\ndata.name;   // User from here on`, note: 'The same job Bean Validation does on a Spring <code>@RequestBody</code>, except nothing does it for you.' }
  ]
});

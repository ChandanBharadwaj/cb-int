IA.register({
  track: 'nodejs',
  slug: 'typescript-node',
  title: 'TypeScript on Node',
  lang: 'ts',
  tagline: 'TypeScript is a type checker plus a compiler, and Node only runs JavaScript. Since Node 22.6 Node can <b>strip types itself</b>, replacing them with whitespace, but it never type-checks, never reads <code>tsconfig.json</code>, and refuses syntax that needs code generation (<code>enum</code>, parameter properties). Most real-world pain is in the module settings, not the types.',
  tldr: {
    problem: '“Works in the IDE, crashes at runtime” bugs: <code>ERR_MODULE_NOT_FOUND</code> because an import lacks <code>.js</code>, a type-only import that survives into runtime, path aliases that only the compiler understood, or stack traces pointing at the wrong line because source maps are off.',
    model: 'Three separate jobs: <b>type-check</b> (<code>tsc --noEmit</code>, in CI and the editor), <b>transform</b> (tsc, esbuild/tsx, swc, or Node’s built-in stripping) and <b>module resolution</b> at runtime, which is always Node’s own rules. Configure TypeScript to model Node exactly: <code>"module": "nodenext"</code>, real file extensions, <code>verbatimModuleSyntax</code>, and <code>erasableSyntaxOnly</code> if Node runs your <code>.ts</code> directly.',
    hook: '“Can Node run TypeScript now?” Yes: <code>node app.ts</code> works with <code>--experimental-strip-types</code> from 22.6, and without a flag from 23.6 (backported to 22.18). It only erases types; you still need <code>tsc --noEmit</code> to find type errors.',
    facts: [
      { v: '22.6', l: 'first Node release with <code>--experimental-strip-types</code>; 22.7 added <code>--experimental-transform-types</code> for enums and namespaces' },
      { v: 'same lines', l: 'stripping replaces types with whitespace, so line and column numbers stay the same and no source map is needed' },
      { v: 'TS 5.8', l: 'added <code>--erasableSyntaxOnly</code>, which flags syntax Node’s stripping can’t handle (enums, parameter properties, namespaces with code)' }
    ]
  },
  intro: {
    what: '<b>TypeScript</b> is JavaScript plus type annotations. The annotations help the editor and the compiler catch mistakes, but the JavaScript engine (V8) doesn’t understand them. So something must <b>remove the types</b> before the code runs. That used to always be a separate build step (<code>tsc</code>, esbuild, swc). Since Node 22.6, Node itself can strip the types of simple TypeScript files as it loads them.',
    analogy: { icon: '📝', title: 'Pencil notes in a printed script', text: 'Types are pencil notes in the margin of an actor’s script: “this line is a question”, “say it angrily”. A reviewer (the type checker) reads the notes and complains when they don’t match. On stage (runtime) the notes are simply ignored. Type stripping is erasing the pencil, so the page keeps its layout and line numbers. But some notes are really new lines of dialogue (<code>enum</code>): erasing them would change the play, so Node refuses.' },
    steps: [
      { t: 'Run a .ts file directly', d: 'Node 22.6+ with a flag; 22.18+ and 23.6+ without.', code: "node --experimental-strip-types src/server.ts", lang: 'bash' },
      { t: 'Type-check separately', d: 'Stripping never reports type errors. Run the compiler in CI.', code: "npx tsc --noEmit", lang: 'bash' },
      { t: 'Write imports as Node sees them', d: 'Use real extensions and mark type-only imports.', code: "import type { User } from './types.ts';\nimport { loadUser } from './users.ts';" },
      { t: 'Or compile to JavaScript', d: 'For production images, many teams still build <code>dist/*.js</code> with <code>tsc</code> (or esbuild) and run plain JavaScript with source maps.' }
    ],
    terms: [
      ['type checking', 'Verifying that types line up. Only <code>tsc</code> (or your editor) does this.'],
      ['transpiling', 'Turning TypeScript into JavaScript. Stripping is the simplest form.'],
      ['type stripping', 'Removing type-only syntax by replacing it with whitespace.'],
      ['erasable syntax', 'TypeScript that disappears without leaving code behind: annotations, interfaces, <code>type</code>, <code>as</code>.'],
      ['module resolution', 'How an import specifier becomes a file. Node does it at runtime with its own rules.'],
      ['ESM / CJS', '<code>import</code>/<code>export</code> modules vs <code>require</code>/<code>module.exports</code>. See <a href="modules-cjs-esm.html">CommonJS vs ESM</a>.']
    ]
  },
  visual: {
    title: 'What Node’s type stripping does',
    caption: 'Pick a snippet and press Play or Step. Blue spans are type-only syntax that gets replaced by spaces; red spans need real code generated. Switch the mode to see what <code>--experimental-transform-types</code> changes.'
  },
  gotchas: [
    { trap: 'Expecting node app.ts to catch type errors', code: `const port: number = process.env.PORT;   // string | undefined
// node app.ts  → runs fine (types are erased, not checked)`, why: 'Node’s stripping only erases annotations. It doesn’t load <code>tsconfig.json</code> and doesn’t type-check.', fix: 'Run <code>tsc --noEmit</code> in CI, pre-commit or the test script, and treat it as a failing build.' },
    { trap: 'Type-only import without the type keyword', code: `import { User, loadUser } from './users.ts';   // User is an interface
// SyntaxError: The requested module './users.ts' does not provide an export named 'User'`, why: 'Stripping works one file at a time and can’t know <code>User</code> is only a type in another file, so the import stays. At runtime the ES module has no export named <code>User</code>.', fix: '<code>import { type User, loadUser }</code> or <code>import type { User }</code>. Turn on <code>verbatimModuleSyntax</code> so <code>tsc</code> enforces it.' },
    { trap: 'Relative imports without extensions under nodenext', code: `// src/app.ts, "module": "nodenext", "type": "module"
import { db } from './db';   // TS error: relative import paths need explicit file extensions`, why: 'Node’s ESM resolver does no extension guessing, and <code>nodenext</code> makes TypeScript apply the same rule. When compiling, you write the extension of the <b>output</b> file: <code>./db.js</code>, even though the source is <code>db.ts</code>.', fix: 'Compiling with tsc: import <code>./db.js</code>. Running .ts directly: import <code>./db.ts</code> with <code>allowImportingTsExtensions</code>, or TS 5.7’s <code>rewriteRelativeImportExtensions</code> to write <code>.ts</code> and emit <code>.js</code>.' },
    { trap: 'tsconfig paths aliases at runtime', code: `// tsconfig: "paths": { "@app/*": ["src/*"] }
import { cfg } from '@app/config';   // ERR_MODULE_NOT_FOUND at runtime`, why: '<code>paths</code> tells the type checker where to look. It doesn’t rewrite output, and Node never reads tsconfig.', fix: 'Use package.json <code>"imports"</code> (subpath imports such as <code>#app/*</code>), which both Node and TypeScript (<code>nodenext</code>/<code>bundler</code>) understand, or a bundler that resolves aliases.' },
    { trap: 'enum, namespaces and parameter properties under stripping', code: `enum Status { Active, Banned }              // ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX
class Repo { constructor(private db: Db) {} }   // same`, why: 'These constructs generate JavaScript (an object for the enum, <code>this.db = db</code> for the parameter property). Erasing them would change behaviour, so strip-only mode rejects them.', fix: 'Use <code>as const</code> objects and union types instead of enums, and explicit fields. Enable <code>erasableSyntaxOnly</code> (TS 5.8). Or opt into <code>--experimental-transform-types</code>.' },
    { trap: 'Stack traces pointing at compiled lines', why: 'After <code>tsc</code> or esbuild, <code>dist/*.js</code> lines differ from the source, so production stack traces point at the wrong place.', fix: 'Emit source maps (<code>"sourceMap": true</code>) and start Node with <code>--enable-source-maps</code> (or <code>NODE_OPTIONS</code>). Built-in stripping preserves positions, so it doesn’t need maps.' },
    { trap: 'Type stripping inside node_modules', why: 'Node refuses to strip <code>.ts</code> files under <code>node_modules</code> (<code>ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING</code>), to stop packages from publishing raw TypeScript.', fix: 'Libraries publish compiled <code>.js</code> + <code>.d.ts</code>. In a monorepo, link workspace packages that point <code>exports</code> at built output, or use a bundler/tsx for development.' }
  ],
  scenarios: [
    { title: 'Production crash: ERR_MODULE_NOT_FOUND after the move to ESM',
      symptom: 'The service compiles cleanly with <code>tsc</code>, tests pass under Jest/ts-jest, but the container exits on start: <code>Cannot find module \'/app/dist/db\' imported from /app/dist/app.js</code>.',
      diagnose: `grep -n '"module"' tsconfig.json      # "module": "esnext", "moduleResolution": "node"
grep -n '"type"' package.json          # "type": "module"`,
      cause: '<code>moduleResolution: "node"</code> (node10) models CommonJS resolution, where <code>./db</code> finds <code>db.js</code>. Real Node ESM requires the full file name. The tests passed because ts-jest resolved modules its own way.',
      fix: 'Switch to <code>"module": "nodenext"</code> so tsc applies Node’s rules, add <code>.js</code> to relative imports, and run a smoke test against the built output (<code>node dist/server.js --check-config</code>) in CI.',
      fixCode: `{
  "compilerOptions": {
    "module": "nodenext",          // implies moduleResolution nodenext
    "target": "es2023",
    "verbatimModuleSyntax": true,
    "strict": true,
    "sourceMap": true,
    "outDir": "dist"
  }
}`, lang: 'json', diagnoseLang: 'bash' },
    { title: 'A dev script fails after switching from ts-node to node --experimental-strip-types',
      symptom: '<code>SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]</code> pointing at an <code>enum</code> in a shared constants file, and a runtime error for a <code>paths</code> alias.',
      cause: 'ts-node compiled with the full TypeScript compiler and a tsconfig-paths hook. Node’s stripping only erases; it can’t generate enum objects and doesn’t know aliases.',
      fix: 'Replace enums with <code>as const</code> objects, move aliases to package.json <code>imports</code>, and turn on <code>erasableSyntaxOnly</code> so the compiler keeps the codebase strippable.',
      fixCode: `export const Status = { Active: 'active', Banned: 'banned' } as const;
export type Status = (typeof Status)[keyof typeof Status];

// package.json
// "imports": { "#app/*": "./src/*" }
import { cfg } from '#app/config.ts';` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Running a .ts file with built-in stripping (Node 22.6+). What prints?', lang: 'js', code: `const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strip-'));
const file = path.join(dir, 'app.ts');
fs.writeFileSync(file, [
  'interface User { id: number }',
  'const n: number = 41;',
  'const u: User = { id: n + 1 };',
  'console.log(u.id);',
].join('\\n'));

const out = execFileSync(process.execPath, ['--experimental-strip-types', file], { encoding: 'utf8' });
console.log(out.trim());`, options: ['SyntaxError: Unexpected identifier', '42', '41', 'Type error: number expected'], answer: 1, explain: 'The interface and the annotations are erasable, so Node replaces them with spaces and runs plain JavaScript. (The ExperimentalWarning, if any, goes to stderr.)', run: true, expect: '42' },
    { kind: 'predict', q: 'Stripping preserves positions. Which line number does the stack trace report?', lang: 'js', code: `const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strip-'));
const file = path.join(dir, 'where.ts');
fs.writeFileSync(file, [
  'type Id = string;',
  'const id: Id = "x" as Id;',
  'const frame: string = new Error("here").stack!.split("\\\\n")[1];',
  'console.log(frame.match(/:(\\\\d+):\\\\d+\\\\)?$/)![1]);',
].join('\\n'));

console.log(execFileSync(process.execPath, ['--experimental-strip-types', file], { encoding: 'utf8' }).trim());`, options: ['1', '2', '3', '4'], answer: 2, explain: 'The error is created on line 3 of the <code>.ts</code> file, and since types became whitespace (including the <code>!</code> non-null assertions), the JavaScript V8 runs has the same line and column. No source map is involved.', run: true, expect: '3' },
    { kind: 'predict', q: 'An enum in strip-only mode. What prints?', lang: 'js', code: `const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strip-'));
const file = path.join(dir, 'status.ts');
fs.writeFileSync(file, 'enum Status { Active, Banned }\\nconsole.log(Status.Banned);\\n');

try {
  const out = execFileSync(process.execPath, ['--experimental-strip-types', file],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  console.log('printed', out.trim());
} catch (e) {
  console.log('failed with status', e.status);
}`, options: ['printed 1', 'printed Banned', 'failed with status 1', 'printed undefined'], answer: 2, explain: 'An <code>enum</code> isn’t erasable: it compiles to a runtime object. In strip-only mode Node throws <code>ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX</code> and the child exits with 1. With <code>--experimental-transform-types</code> it would print 1.', run: true, expect: 'failed with status 1' },
    { kind: 'concept', q: '<code>"module": "nodenext"</code>, package.json has <code>"type": "module"</code>, compiled with <code>tsc</code> to <code>dist/</code>. How do you import <code>src/db.ts</code> from <code>src/app.ts</code>?', options: ['<code>import { db } from \'./db\'</code>', '<code>import { db } from \'./db.js\'</code>', '<code>import { db } from \'./db.ts\'</code> with no other settings', '<code>import { db } from \'@/db\'</code>'], answer: 1, explain: 'tsc doesn’t rewrite specifiers by default, and Node’s ESM resolver needs the real output file name. TypeScript maps <code>./db.js</code> back to <code>db.ts</code> for type checking. <code>.ts</code> imports need <code>allowImportingTsExtensions</code> (no emit) or TS 5.7’s <code>rewriteRelativeImportExtensions</code>.' },
    { kind: 'concept', q: 'Which file is a problem for Node’s strip-only mode?', options: ['<code>const x = y as string;</code>', '<code>type Pair&lt;T&gt; = [T, T];</code>', '<code>class A { constructor(private readonly db: Db) {} }</code>', '<code>function f(this: Window, n?: number): void {}</code>'], answer: 2, explain: 'A parameter property (<code>private readonly db</code>) means “also assign <code>this.db = db</code>”: code generation, so it isn’t erasable. The others are annotations or type aliases that disappear completely. <code>erasableSyntaxOnly</code> flags exactly these cases at compile time.' },
    { kind: 'concept', q: 'Node 22.12+ (CommonJS app) calls <code>require(\'./lib.mjs\')</code>, and lib.mjs uses top-level <code>await</code>. What happens?', options: ['Works: require waits for the await', 'Throws <code>ERR_REQUIRE_ASYNC_MODULE</code>', 'Returns a Promise', 'Returns an empty object'], answer: 1, explain: 'Since 22.12, <code>require()</code> can load ES modules, but only synchronous graphs. A module with top-level await can’t be loaded synchronously, so use <code>await import()</code> instead.' },
    { kind: 'concept', q: 'In an ES module (<code>.mts</code> or <code>"type": "module"</code>), what replaces <code>__dirname</code>?', options: ['<code>process.cwd()</code>', '<code>import.meta.dirname</code> (Node 20.11+)', '<code>require.main.path</code>', '<code>module.path</code>'], answer: 1, explain: 'ESM has no CommonJS wrapper variables. <code>import.meta.dirname</code> and <code>import.meta.filename</code> exist since Node 20.11/21.2; before that, <code>path.dirname(fileURLToPath(import.meta.url))</code>. <code>process.cwd()</code> is where the process was started, which is a different thing.' }
  ],
  interview: [
    { q: 'How does Node 22’s type stripping work, and what are its limits?', a: '<p>When a <code>.ts</code>/<code>.mts</code>/<code>.cts</code> file loads, Node (via Amaro, which wraps SWC) replaces type-only syntax with whitespace and runs the result. Positions are preserved, so no source maps are needed. Limits: no type checking, tsconfig is ignored (no <code>paths</code>, no target down-levelling), no <code>.tsx</code>, no files in <code>node_modules</code>, type-only imports need the <code>type</code> keyword, and syntax that needs generated code (<code>enum</code>, namespaces with values, parameter properties, <code>import x = require()</code>) is rejected unless you use <code>--experimental-transform-types</code>. Timeline: flag in 22.6, transform flag in 22.7, unflagged in 23.6 and 22.18.</p>', lvl: 'core' },
    { q: 'Which tsconfig settings matter most for a Node 22 service?', a: '<ul><li><code>"module": "nodenext"</code> (implies matching resolution), so TS follows Node’s ESM/CJS rules per file based on extension and package.json <code>type</code>.</li><li><code>"target"</code> recent (ES2022+), since Node 22 supports modern syntax; down-levelling only costs speed and readability.</li><li><code>"strict": true</code>, <code>"verbatimModuleSyntax": true</code>, <code>"isolatedModules"</code> (implied by verbatim) so per-file transpilers are safe.</li><li><code>"sourceMap": true</code> + <code>--enable-source-maps</code> if you compile.</li><li><code>@types/node</code> matching the runtime major; <code>@tsconfig/node22</code> as a base.</li></ul>', lvl: 'core' },
    { q: 'Why does TypeScript make you write .js in imports of .ts files?', a: '<p>TypeScript’s rule is that it doesn’t rewrite module specifiers: the import you write is the import that runs. Node resolves the <i>output</i> files, so the specifier must name <code>db.js</code>. TypeScript knows to type-check it against <code>db.ts</code>. TS 5.7 added <code>rewriteRelativeImportExtensions</code>, which lets you write <code>./db.ts</code> (handy when the same code also runs with Node’s stripping) and emits <code>./db.js</code>.</p>', lvl: 'deep' },
    { q: 'What does verbatimModuleSyntax do and why does it matter for Node?', a: '<p>It makes the compiler keep every import and export exactly as written, except ones explicitly marked <code>type</code>, which are dropped. That matches what single-file transformers (Node’s stripping, esbuild, swc) can do without type information. It also forbids writing ESM syntax in a file that will be emitted as CommonJS, which catches CJS/ESM confusion early.</p>', lvl: 'deep' },
    { q: 'tsc vs tsx vs esbuild vs Node’s stripping: when do you use which?', a: '<p><b>tsc</b>: the only type checker; can also emit JS and declarations (libraries need <code>.d.ts</code>). <b>tsx / esbuild / swc</b>: fast per-file transpilers for dev and builds, support enums and decorators, no type checking. <b>Node stripping</b>: zero-dependency dev scripts and simple services when the code is erasable-only. A typical service: <code>tsc --noEmit</code> in CI, tsx or <code>node --watch</code> in dev, and either compiled <code>dist/</code> or stripped <code>.ts</code> in production.</p>', lvl: 'core' },
    { q: 'How do ESM and CommonJS interact in a TypeScript project?', a: '<p>Each file’s format comes from its extension (<code>.mts</code>/<code>.cts</code>) or the nearest package.json <code>type</code>. ESM can import CJS (the default export is <code>module.exports</code>; named exports when cjs-module-lexer can detect them). CJS can <code>require()</code> synchronous ESM since Node 22.12, otherwise it needs <code>await import()</code>. With <code>nodenext</code>, TypeScript models all of this per file. See <a href="modules-cjs-esm.html">CommonJS vs ESM</a>.</p>', lvl: 'core' },
    { q: 'Decorators in Node with TypeScript?', a: '<p>Legacy <code>experimentalDecorators</code> (used by NestJS, TypeORM) need a full transpiler (tsc, swc) with <code>emitDecoratorMetadata</code> for DI. Standard (TC39) decorators are supported by TS 5.0+ but are not erased by Node’s stripping: they are runtime code that V8 doesn’t support natively yet, so Node rejects them. Decorator-heavy frameworks therefore still need a build step.</p>', lvl: 'deep' },
    { q: 'From a Java developer’s view, what does TypeScript not give you that Java does?', a: '<p>Types are erased and unsound by design: <code>any</code>, type assertions and JSON from the network aren’t checked at runtime. So validate at the edges (Zod, TypeBox) and derive types from schemas. There is no runtime reflection on types (unlike Java’s), structural rather than nominal typing (use branded types for ids), and generics that exist only at compile time, much like Java’s erasure but without casts being checked at runtime.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'tsconfig.json for a Node 22 service', lang: 'json', code: `{
  "extends": "@tsconfig/node22/tsconfig.json",
  "compilerOptions": {
    "module": "nodenext",
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,              // TS 5.8+: keep code strippable
    "rewriteRelativeImportExtensions": true, // TS 5.7+: write ./x.ts, emit ./x.js
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}`, note: 'If you only run <code>.ts</code> directly with Node and never emit, use <code>"noEmit": true</code> with <code>"allowImportingTsExtensions": true</code> instead of the rewrite option.' },
    { title: 'package.json scripts', lang: 'json', code: `{
  "type": "module",
  "imports": { "#app/*": "./src/*" },
  "scripts": {
    "dev": "node --watch --experimental-strip-types src/server.ts",
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "start": "node --enable-source-maps dist/server.js",
    "test": "node --test --experimental-strip-types \\"src/**/*.test.ts\\""
  },
  "engines": { "node": ">=22.6" }
}` },
    { title: 'Erasable-only TypeScript', lang: 'ts', code: `// instead of enum: a const object + a union type
export const Role = { Admin: 'admin', User: 'user' } as const;
export type Role = (typeof Role)[keyof typeof Role];

import type { Pool } from 'pg';             // type-only import: erased
import { randomUUID } from 'node:crypto';

export class UserRepo {
  readonly #pool: Pool;                       // explicit field instead of a parameter property
  constructor(pool: Pool) { this.#pool = pool; }

  async create(name: string, role: Role = Role.User) {
    const id = randomUUID();
    await this.#pool.query('INSERT INTO users (id, name, role) VALUES ($1, $2, $3)', [id, name, role]);
    return { id, name, role } satisfies { id: string; name: string; role: Role };
  }
}` },
    { title: 'Java comparison', lang: 'java', code: `// Java: types are checked by javac AND enforced at runtime (casts, reflection).
// TypeScript: checked by tsc only; erased before running. Validate at the edges:
record CreateUser(@NotBlank String name, Role role) {}   // Bean Validation at the boundary
// ≈ TS: const CreateUser = z.object({ name: z.string().min(1), role: z.enum(['admin','user']) });
//       type CreateUser = z.infer<typeof CreateUser>;` }
  ]
});

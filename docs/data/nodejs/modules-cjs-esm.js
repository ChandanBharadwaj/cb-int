IA.register({
  track: 'nodejs',
  slug: 'modules-cjs-esm',
  title: 'CommonJS vs ESM',
  tagline: 'Node has two module systems. <b>CommonJS</b> (<code>require</code>) loads files synchronously, one call at a time, and hands you a copy of <code>module.exports</code>. <b>ES modules</b> (<code>import</code>) parse the whole graph first, link <b>live bindings</b>, then evaluate, which is what makes top-level <code>await</code> possible. In Node 22 they finally interoperate both ways.',
  tldr: {
    problem: '<code>ERR_REQUIRE_ESM</code>, <code>ERR_MODULE_NOT_FOUND</code> for a file that exists, <code>__dirname is not defined</code>, a default import that turns out to be <code>{ default: … }</code>: most module bugs come from mixing the two systems without knowing their rules.',
    model: '<b>CJS</b>: resolve (with extension and <code>index.js</code> guessing) → cache by filename → wrap in a function → run now → return <code>module.exports</code>. <b>ESM</b>: parse → resolve every static import as a URL (exact file names) → link live bindings → evaluate dependencies first, possibly async. The format comes from <code>.cjs</code>/<code>.mjs</code>, or from the nearest <code>package.json</code> <code>"type"</code> for <code>.js</code>.',
    hook: '“Can CommonJS load an ES module?” With <code>import()</code>, always. With plain <code>require()</code>, since <b>Node 22.12</b>, as long as the ESM graph has no top-level await.',
    facts: [
      { v: '22.12', l: 'Node version where <code>require(esm)</code> works without a flag (also 20.19). It throws <code>ERR_REQUIRE_ASYNC_MODULE</code> if the graph uses top-level await' },
      { v: '"commonjs"', l: 'the default <code>"type"</code>: without <code>"type": "module"</code>, a <code>.js</code> file is CommonJS (Node 22.7+ can also detect ESM syntax)' },
      { v: '1×', l: 'a module’s top-level code runs once per process per cache key: resolved filename (CJS) or URL (ESM)' }
    ]
  },
  intro: {
    what: 'A <b>module</b> is a file whose variables are private unless it exports them. Node supports two formats. The older <b>CommonJS</b> uses <code>require()</code> and <code>module.exports</code>; most npm packages were written this way. The standard <b>ES modules</b> (ESM) use <code>import</code> and <code>export</code>, the same syntax browsers use. They load differently, and Node has to decide which format each file is in.',
    analogy: { icon: '📦', title: 'Ordering parts vs reading the blueprint', text: '<b>CommonJS</b> is a builder who walks to the store whenever he needs a part, mid-job, and gets a <i>copy</i> of what was on the shelf. <b>ESM</b> reads the whole blueprint first, lists every part, wires everything together, and only then starts building. Because the wiring is live, if a supplier changes a part later, the builder sees the change.' },
    steps: [
      { t: 'CommonJS', d: '<code>require</code> is a normal function. It can sit inside an <code>if</code>, and it returns the exported object.', code: "// math.cjs\nmodule.exports.add = (a, b) => a + b;\n\n// app.cjs\nconst { add } = require('./math.cjs');" },
      { t: 'ES modules', d: '<code>import</code> statements are static: they sit at the top level and are known before the code runs.', code: "// math.mjs\nexport const add = (a, b) => a + b;\n\n// app.mjs\nimport { add } from './math.mjs';" },
      { t: 'How Node picks a format', d: '<code>.cjs</code> = CommonJS, <code>.mjs</code> = ESM, <code>.js</code> = whatever the nearest <code>package.json</code> <code>"type"</code> says (default CommonJS).' },
      { t: 'Crossing over', d: 'ESM can <code>import</code> CommonJS. CommonJS can use <code>await import()</code>, and on Node 22.12+ plain <code>require()</code> for ESM without top-level await.' }
    ],
    terms: [
      ['specifier', 'The string in <code>require(\'…\')</code> or <code>from \'…\'</code>.'],
      ['bare specifier', 'A package name such as <code>\'lodash\'</code>, looked up in node_modules.'],
      ['module.exports', 'The object a CommonJS module hands to <code>require</code>.'],
      ['live binding', 'An ESM import that always shows the exporter’s current value.'],
      ['top-level await', '<code>await</code> outside any function. ESM only.'],
      ['"exports" field', 'package.json map of a package’s public entry points.']
    ]
  },
  visual: {
    title: 'Watch Node resolve and load a module',
    caption: 'Pick a scenario and press Play. The top row is the loading pipeline; the tree shows which paths Node tries (✗ missing, ✓ found). Compare the CJS wrapper and cache with ESM’s parse → link → evaluate.'
  },
  gotchas: [
    { trap: 'Reassigning exports', code: `// lib.js\nexports = { hello };          // ✗ rebinds a local variable; nothing exported\nmodule.exports = { hello };   // ✓\nexports.hello = hello;        // ✓ (mutates the same object)`, why: '<code>exports</code> is just a parameter that starts out pointing at <code>module.exports</code>. <code>require</code> returns <code>module.exports</code>.', fix: 'Either assign <code>module.exports = …</code> once, or only add properties to <code>exports</code>. Never mix the two.' },
    { trap: 'Extension-less imports in ESM', code: `import { db } from './db';        // ERR_MODULE_NOT_FOUND\nimport { db } from './db/index.js'; // ✓`, why: 'ESM resolution does no extension guessing and no directory <code>index.js</code>. That matches browsers, where specifiers are URLs.', fix: 'Write full relative paths. With TypeScript, set <code>"module": "nodenext"</code> and import <code>./db.js</code> (TS maps it to <code>db.ts</code>).' },
    { trap: '__dirname and require are undefined in ESM', code: `// ESM\nconst cfg = path.join(__dirname, 'cfg.json');   // ReferenceError\n\nconst cfg2 = path.join(import.meta.dirname, 'cfg.json');  // Node 20.11+\nimport { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);`, why: 'They are parameters of the CommonJS wrapper function. ES modules aren’t wrapped.', fix: 'Use <code>import.meta.dirname</code> / <code>import.meta.filename</code> (Node 20.11+), or <code>fileURLToPath(import.meta.url)</code> on older versions. <code>createRequire</code> gives you a <code>require</code> when you need one (for JSON, say).' },
    { trap: 'Destructuring a CommonJS export freezes its value', code: `// counter.cjs\nlet count = 0;\nmodule.exports = { count, inc() { count++; } };\n\nconst { count, inc } = require('./counter.cjs');\ninc();\nconsole.log(count);   // 0: a copy taken at require time`, why: '<code>module.exports.count</code> was copied when the object was created. ESM named imports are live bindings to the variable itself.', fix: 'Export a getter or function (<code>getCount()</code>), or use ESM.' },
    { trap: 'The dual-package hazard', why: 'A package that ships both a CJS and an ESM build can get loaded <b>twice</b> in one app (once via <code>require</code>, once via <code>import</code>). Two copies mean two singletons, two caches, and <code>instanceof</code> checks that fail across them.', fix: 'Library authors: ship one implementation and a thin wrapper for the other format, or (on Node 22.12+) ship ESM only and let CJS users <code>require</code> it. App authors: watch for duplicate instances of stateful libraries.' },
    { trap: 'Top-level await blocks the importers', code: `// config.mjs\nexport const secrets = await vault.fetchAll();   // 3 s on a cold start\n// every module that imports config.mjs waits; require() of it throws`, why: 'A module with top-level await isn’t finished until the await settles, and every module that depends on it waits. <code>require()</code> can’t load such a graph at all (<code>ERR_REQUIRE_ASYNC_MODULE</code>).', fix: 'Use top-level await in entry points and scripts. In libraries, export an async <code>init()</code> instead.' },
    { trap: 'Deep imports blocked by "exports"', code: `require('some-lib/lib/internal/util');\n// ERR_PACKAGE_PATH_NOT_EXPORTED`, why: 'When a package declares <code>"exports"</code>, only those subpaths can be loaded, by both <code>require</code> and <code>import</code>. Adding <code>"exports"</code> to an existing package is therefore a breaking change.', fix: 'Use the public entry points. If you maintain the package, list every subpath you support, and bump the major version when adding <code>"exports"</code>.' }
  ],
  scenarios: [
    { title: 'Service crashes on deploy: ERR_REQUIRE_ESM',
      symptom: 'After merging a dependency-bump PR, the CommonJS service crashes at start-up in production with <code>ERR_REQUIRE_ESM</code> from a utility package. CI was green.',
      diagnoseLang: 'bash',
      diagnose: `npm ls some-utility        # 4.x → 5.0.0\nnpm view some-utility@5 type exports\n# "type": "module", no "require" condition`,
      cause: 'The PR bumped the range to <code>^5.0.0</code>, a new major that is ESM-only. CI runs Node 22.12, where <code>require(esm)</code> works, so tests passed. Production still runs Node 20.10, where <code>require()</code> of an ES module throws.',
      fix: 'Run CI on the same Node version as production (<code>engines</code> + <code>.nvmrc</code>). Then either stay on 4.x, move production to Node 22.12+, where <code>require(esm)</code> works (no top-level await in that package), or load it with <code>await import()</code>.',
      fixCode: `// works on every supported Node version, from CommonJS\nlet util: typeof import('some-utility');\nexport async function init() {\n  util = await import('some-utility');\n}`, lang: 'ts' },
    { title: 'Two copies of the ORM: “instanceof EntityNotFound is false”',
      symptom: 'Error handling works in unit tests, but in production the error mapper never matches <code>EntityNotFound</code> and returns 500 instead of 404.',
      diagnoseLang: 'bash',
      diagnose: `node -e "console.log(require.resolve('orm'))"\n# and in the ESM entry: import.meta.resolve('orm')\n# → dist/cjs/index.js vs dist/esm/index.js`,
      cause: 'The app’s ESM code imports the ESM build; a CommonJS plugin <code>require</code>s the CJS build. Two module instances, two different <code>EntityNotFound</code> classes.',
      fix: 'Load the library through one format only, or match errors by a stable <code>code</code> property instead of <code>instanceof</code>.',
      fixCode: `// robust across duplicate copies\nif (err?.code === 'ENTITY_NOT_FOUND') return res.status(404).end();` },
    { title: 'Cold start jumps from 300 ms to 4 s',
      symptom: 'A serverless function got much slower to start after a refactor moved config loading into a shared module.',
      diagnoseLang: 'bash',
      diagnose: `node --cpu-prof handler.mjs   # or: NODE_DEBUG=module\n# config.mjs: await fetch(SECRETS_URL) at top level`,
      cause: 'A top-level <code>await</code> on a network call in a module that everything imports. Evaluation of the whole graph waits for it, and so does the first request.',
      fix: 'Start the fetch early but don’t block the graph on it: export a promise and await it where it is used, with a cache.',
      fixCode: `// config.mjs\nlet cached;\nexport const getSecrets = () => (cached ??= fetchSecrets());\n\n// handler.mjs\nexport async function handler(evt) {\n  const s = await getSecrets();   // first call pays once\n}` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Two requires of the same file. What prints?', code: `const fs = require('fs'), path = require('path'), os = require('os');\nconst file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cache-')), 'counter.js');\nfs.writeFileSync(file, "console.log('loading counter');\\nlet n = 0;\\nmodule.exports = { inc: () => ++n };");\n\nconst a = require(file);\nconst b = require(file);\na.inc(); a.inc();\nconsole.log(b.inc(), a === b);`, options: ['loading counter (twice), then 1 false', 'loading counter, then 3 true', 'loading counter, then 1 true', 'loading counter, then 3 false'], answer: 1, explain: 'The second <code>require</code> hits <code>require.cache</code> (keyed by the resolved filename), so the file runs once and both names point at the same <code>module.exports</code>. Module state is a per-process singleton.', run: true, expect: 'loading counter\n3 true' },
    { kind: 'predict', q: 'A circular require. What prints?', code: `const fs = require('fs'), path = require('path'), os = require('os');\nconst dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle-'));\nfs.writeFileSync(path.join(dir, 'a.js'), "exports.done = false;\\nconst b = require('./b');\\nconsole.log('in a, b.done =', b.done);\\nexports.done = true;");\nfs.writeFileSync(path.join(dir, 'b.js'), "exports.done = false;\\nconst a = require('./a');\\nconsole.log('in b, a.done =', a.done);\\nexports.done = true;");\n\nconst a = require(path.join(dir, 'a.js'));\nconsole.log('main, a.done =', a.done);`, options: ['A RangeError: maximum call stack size exceeded', 'in b, a.done = false / in a, b.done = true / main, a.done = true', 'in a, b.done = false / in b, a.done = true / main, a.done = true', 'in b, a.done = undefined / in a, b.done = true / main, a.done = true'], answer: 1, explain: 'a.js is cached <b>before</b> it runs. When b.js requires it mid-way, it gets a’s unfinished <code>exports</code> (done is still false) instead of looping. b finishes, then a. This is the example from the Node docs.', run: true, expect: 'in b, a.done = false\nin a, b.done = true\nmain, a.done = true' },
    { kind: 'predict', q: 'What does <code>require</code> return?', code: `const fs = require('fs'), path = require('path'), os = require('os');\nconst file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'exp-')), 'lib.js');\nfs.writeFileSync(file, 'exports.a = 1;\\nexports = { b: 2 };\\nmodule.exports.c = 3;');\n\nconsole.log(JSON.stringify(require(file)));`, options: ['{"b":2}', '{"a":1,"b":2,"c":3}', '{"a":1,"c":3}', '{"c":3}'], answer: 2, explain: '<code>exports.a = 1</code> mutates the shared object. <code>exports = {…}</code> only rebinds the local parameter, so b is lost. <code>module.exports.c = 3</code> adds to the real object, which is what <code>require</code> returns.', run: true, expect: '{"a":1,"c":3}' },
    { kind: 'concept', q: 'Same counter written two ways. What do the two programs print?', code: `// counter.mjs\nexport let count = 0;\nexport function inc() { count++; }\n// main.mjs\nimport { count, inc } from './counter.mjs';\ninc(); console.log(count);\n\n// counter.cjs\nlet count = 0;\nmodule.exports = { count, inc() { count++; } };\n// main.cjs\nconst { count, inc } = require('./counter.cjs');\ninc(); console.log(count);`, options: ['1 and 1', '1 and 0', '0 and 0', '0 and 1'], answer: 1, explain: 'An ESM import is a <b>live binding</b> to the exporting module’s variable, so main.mjs sees 1. The CommonJS version copied the number 0 into the exports object when it was created, and destructuring copied it again.' },
    { kind: 'bug', q: 'In an ES module (<code>"type": "module"</code>), <code>src/db/index.js</code> exists. What happens?', code: `import { pool } from './db';`, options: ['It loads ./db/index.js', 'ERR_MODULE_NOT_FOUND', 'It loads ./db.js if present, else index.js', 'SyntaxError'], answer: 1, explain: 'ESM resolution has no extension search and no directory index. Write <code>./db/index.js</code>. (In CommonJS, <code>require(\'./db\')</code> would find it.)' },
    { kind: 'concept', q: 'Node 22.12+, CommonJS app. <code>lib.mjs</code> contains <code>export const cfg = await load();</code>. What does <code>require(\'./lib.mjs\')</code> do?', options: ['Returns the namespace once the await settles', 'Returns a Promise', 'Throws ERR_REQUIRE_ASYNC_MODULE', 'Returns { cfg: undefined }'], answer: 2, explain: '<code>require</code> is synchronous, so it can load an ES module graph only if nothing in it uses top-level await. Otherwise it throws <code>ERR_REQUIRE_ASYNC_MODULE</code>. Use <code>await import(\'./lib.mjs\')</code>.' },
    { kind: 'concept', q: 'In ESM on Node 22, how do you get the directory of the current file?', options: ['__dirname', 'process.cwd()', 'import.meta.dirname', 'require.main.path'], answer: 2, explain: '<code>import.meta.dirname</code> (and <code>import.meta.filename</code>) exist since Node 20.11 / 21.2. <code>__dirname</code> is a CommonJS wrapper parameter. <code>process.cwd()</code> is the shell’s working directory, which is often different.' },
    { kind: 'concept', q: 'A library ships separate CJS and ESM builds. Your ESM app imports it and a CommonJS plugin requires it. What’s the risk?', options: ['None: Node deduplicates by package name', 'Two instances: separate state and failing instanceof checks', 'A deadlock while loading', 'The ESM build is always chosen for both'], answer: 1, explain: 'The two builds are different files, so they are different modules with separate state. This is the <b>dual-package hazard</b>. Prefer one implementation plus a thin wrapper, or ESM-only plus <code>require(esm)</code>.' }
  ],
  interview: [
    { q: 'What are the main differences between CommonJS and ES modules in Node?', a: '<ul><li><b>Loading</b>: CJS is synchronous, at the point of the call; ESM parses and links the whole graph first, and evaluation can be async.</li><li><b>Bindings</b>: CJS returns a value (<code>module.exports</code>); ESM imports are live, read-only bindings.</li><li><b>Static vs dynamic</b>: <code>import</code> declarations are static (good for tree-shaking and early errors); <code>require</code> can be called anywhere.</li><li><b>Resolution</b>: CJS guesses extensions and <code>index.js</code>; ESM needs exact URLs.</li><li><b>Scope</b>: ESM is always strict, has <code>import.meta</code> and top-level await, and no <code>__dirname</code>/<code>require</code>.</li></ul>', lvl: 'core' },
    { q: 'How does Node decide whether a file is CJS or ESM?', a: '<p><code>.mjs</code> is ESM and <code>.cjs</code> is CommonJS, always. For <code>.js</code> (and extension-less files), Node uses the nearest <code>package.json</code>’s <code>"type"</code>: <code>"module"</code> or <code>"commonjs"</code> (the default). Since Node 22.7, if there is no <code>"type"</code> and the file contains ESM syntax, Node detects that and runs it as ESM. <code>--input-type</code> covers <code>--eval</code> and stdin.</p>', lvl: 'core' },
    { q: 'Explain require(esm) in Node 22.', a: '<p>From Node 22.12 (and 20.19), <code>require()</code> can load an ES module without a flag. It loads and evaluates the ESM graph synchronously and returns the <b>module namespace object</b> (default export under <code>.default</code>). If any module in the graph uses top-level await, it throws <code>ERR_REQUIRE_ASYNC_MODULE</code>. Some 22.x releases print an ExperimentalWarning. This makes ESM-only libraries usable from CommonJS apps.</p>', fu: 'What about the other direction? (ESM can always import CJS; module.exports becomes the default export.)', lvl: 'core' },
    { q: 'What happens with circular dependencies in each system?', a: '<p><b>CJS</b>: a module is cached before it runs, so a cycle returns the <i>partially filled</i> <code>exports</code> of the module still loading. You see <code>undefined</code> for things not yet assigned. <b>ESM</b>: bindings are linked before evaluation, so a cycle works for functions (hoisted), but reading a <code>let</code>/<code>const</code>/<code>class</code> export before its module has run throws a ReferenceError (temporal dead zone).</p>', lvl: 'deep' },
    { q: 'What does the "exports" field in package.json do?', a: '<p>It defines a package’s public entry points and per-condition targets: <code>"import"</code>, <code>"require"</code>, <code>"node"</code>, <code>"types"</code>, <code>"default"</code>. Paths not listed can’t be loaded (<code>ERR_PACKAGE_PATH_NOT_EXPORTED</code>), which gives you encapsulation. It takes precedence over <code>"main"</code>. Conditions are matched in object order, so <code>"types"</code> goes first and <code>"default"</code> last.</p>', lvl: 'deep' },
    { q: 'Where would you use top-level await, and where not?', a: '<p>Fine in entry points, scripts and tests: <code>const cfg = await loadConfig()</code>. Avoid it in libraries and shared modules: it delays everything that imports them, and it makes them impossible to <code>require()</code>. In CommonJS there is no top-level await; wrap the code in an async IIFE or <code>main().catch(…)</code>.</p>', lvl: 'core' },
    { q: 'How does a CJS module get require, module and __dirname?', a: '<p>Node wraps the file’s source: <code>(function (exports, require, module, __filename, __dirname) { … })</code>, and calls it with values for that file. That is also why top-level <code>var</code>s don’t leak into the global scope, and why <code>this</code> at the top level is <code>module.exports</code>.</p>', lvl: 'core' },
    { q: 'How would you migrate a large CommonJS TypeScript service to ESM?', a: '<ol><li>Upgrade to Node 22.12+ so CJS and ESM can <code>require</code> each other during the move.</li><li>Set <code>"module": "nodenext"</code> in tsconfig and add <code>.js</code> extensions to relative imports.</li><li>Replace <code>__dirname</code> with <code>import.meta.dirname</code> and JSON <code>require</code>s with <code>import … with { type: \'json\' }</code> or <code>createRequire</code>.</li><li>Flip <code>"type": "module"</code>, then fix jest/mocking tooling (or move to <code>node:test</code>/Vitest).</li></ol>', lvl: 'deep' },
    { q: 'How does this compare to Java class loading?', a: '<p>Similar caching idea: a class is loaded once per class loader and reused, like <code>require.cache</code>. Java resolves classes lazily on first use, closer to CJS. JPMS (<code>module-info.java</code>) is like ESM plus <code>"exports"</code>: dependencies are declared statically, and only exported packages are accessible. The dual-package hazard has a Java twin: the same class loaded by two class loaders isn’t the same type, so casts and <code>instanceof</code> fail.</p>', lvl: 'core' },
    { q: 'Why are ESM imports read-only?', a: '<p>An import is a binding to a variable owned by another module, not a local variable. Only the exporting module can assign to it, so state changes go through its functions. Assigning to an imported name throws a TypeError. You can still mutate an imported <i>object</i>’s properties.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'A package.json for a dual-format library', lang: 'json', code: `{
  "name": "@acme/money",
  "version": "2.0.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./package.json": "./package.json"
  },
  "engines": { "node": ">=20.19" },
  "files": ["dist"]
}`, note: 'Order matters: <code>"types"</code> first. If <code>index.cjs</code> only re-exports from the ESM build (or you drop it and rely on <code>require(esm)</code>), there is a single implementation and no dual-package hazard.' },
    { title: 'tsconfig for Node 22 ESM', lang: 'json', code: `{
  "compilerOptions": {
    "target": "ES2023",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "verbatimModuleSyntax": true,
    "outDir": "dist",
    "strict": true
  }
}
// in .ts files: import { pool } from './db.js';   ← .js, even though the file is db.ts`, note: '<code>nodenext</code> makes TypeScript follow Node’s real rules, including <code>"type"</code>, <code>.mts</code>/<code>.cts</code> and the <code>"exports"</code> field.' },
    { title: 'ESM replacements for CJS habits', lang: 'ts', code: `import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import pkg from '../package.json' with { type: 'json' };   // import attributes (Node 22)

const here = import.meta.dirname;                          // was __dirname
const sql = await readFile(join(here, 'schema.sql'), 'utf8');  // top-level await (entry points)

const require = createRequire(import.meta.url);            // when you really need require
const native = require('./build/Release/addon.node');

console.log(pkg.version);`, note: 'JSON import attributes (<code>with { type: \'json\' }</code>) work in Node 22. The older <code>assert { type: \'json\' }</code> syntax was removed in Node 22.' },
    { title: 'Java comparison: class loaders and JPMS', lang: 'java', code: `// module-info.java  ≈ ESM static imports + package.json "exports"
module com.acme.billing {
    requires com.acme.money;          // declared up front, checked at startup
    exports com.acme.billing.api;     // only this package is visible to others
}

// Lazy loading ≈ CommonJS: the class is loaded on first use, then cached
Class<?> c = Class.forName("com.acme.billing.Invoice");

// "Dual-package hazard" twin: same class, two class loaders
Object o = loaderA.loadClass("X").getDeclaredConstructor().newInstance();
boolean same = loaderB.loadClass("X").isInstance(o);   // false` }
  ]
});

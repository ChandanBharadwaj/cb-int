IA.register({
  track: 'nodejs',
  slug: 'js-classes-modules',
  title: 'Classes & modules',
  tagline: '<code>class</code> and <code>extends</code> read like Java, but underneath they are <b>objects linked by prototypes</b>. Files are <b>modules</b>: modern code uses <code>import</code>/<code>export</code> (ESM), and lots of existing Node code uses <code>require</code> (CommonJS).',
  tldr: {
    problem: 'Java developers expect classes to be the unit of code and packages to control visibility. In JavaScript the <b>file</b> is the unit: a module exports functions, objects or classes. And there are two module systems in Node, which is a common source of confusing errors.',
    model: 'A class is a constructor function plus a <code>prototype</code> object holding its methods. <code>obj.method()</code> looks on the object, then up the prototype chain. A module runs <b>once</b>, its exports are cached, and every importer shares the same instance.',
    hook: '“ESM or CommonJS?” ESM (<code>import</code>) is the standard: static, analysable, supports top-level await. CommonJS (<code>require</code>) is synchronous and dynamic. New code: ESM, via <code>"type": "module"</code>. Deep dive in <a href="modules-cjs-esm.html">CommonJS vs ESM</a>.',
    facts: [
      { v: "'function'", l: 'is <code>typeof</code> of a class. Classes are special functions that throw if called without <code>new</code>' },
      { v: '#field', l: 'declares a truly private field (ES2022), enforced by the language, unlike a <code>_name</code> convention' },
      { v: 'once', l: 'a module’s top-level code runs once per process; later imports get the cached exports' }
    ]
  },
  intro: {
    what: 'A <b>class</b> is a template for objects with shared methods, as in Java: fields, a <code>constructor</code>, methods, <code>static</code> members and <code>extends</code>. A <b>module</b> is a file that chooses what to share with <code>export</code>; other files pull it in with <code>import</code>. Together they replace Java’s classes and packages.',
    analogy: { icon: '📚', title: 'Lending library', text: 'Each module is a shelf. <code>export</code> puts a book on the public shelf; everything else stays in the back room. <code>import</code> borrows the book, and there is only one copy, so if you scribble in it, everyone sees the notes.' },
    steps: [
      { t: 'A class', d: 'Fields, constructor, methods, getters, static members. <code>#</code> makes a field private.', code: "class Account {\n  #balance = 0;                  // private\n  static count = 0;\n  constructor(owner) { this.owner = owner; Account.count++; }\n  deposit(n) { this.#balance += n; return this; }\n  get balance() { return this.#balance; }\n}" },
      { t: 'Inheritance', d: '<code>extends</code>, <code>super(...)</code> and overriding work like Java. Only single inheritance.', code: "class Savings extends Account {\n  constructor(owner, rate) {\n    super(owner);                // before using this\n    this.rate = rate;\n  }\n}" },
      { t: 'Export and import (ESM)', d: 'Named exports for several things, a default export for the main one.', code: "// account.js\nexport class Account { /* … */ }\nexport const MAX = 1000;\n\n// app.js\nimport { Account, MAX } from './account.js';" },
      { t: 'require (CommonJS)', d: 'The older system. You will read it in many repos and in older docs.', code: "// account.cjs\nclass Account {}\nmodule.exports = { Account };\n\n// app.cjs\nconst { Account } = require('./account.cjs');" },
      { t: 'Tell Node which one', d: '<code>"type": "module"</code> in package.json makes <code>.js</code> files ESM. <code>.mjs</code> is always ESM, <code>.cjs</code> always CommonJS.', code: '{ "type": "module" }', lang: 'json' }
    ],
    terms: [
      ['prototype', 'The object another object falls back to for missing properties. Methods live there.'],
      ['prototype chain', 'The linked list of prototypes walked to find a property: rex → Dog.prototype → Animal.prototype → Object.prototype.'],
      ['ESM', 'ECMAScript modules: <code>import</code>/<code>export</code>. The language standard, used in browsers and Node.'],
      ['CommonJS (CJS)', 'Node’s original module system: <code>require()</code> and <code>module.exports</code>.'],
      ['named vs default export', 'Named: <code>export const x</code>, imported as <code>{ x }</code>. Default: one per module, imported under any name.']
    ]
  },
  visual: {
    title: 'Prototype chains and module graphs',
    caption: 'Pick an example and Step. In <b>class & extends</b>, follow the arrows as a method call walks up the prototype chain until it finds the method. In the module tabs, arrows show what flows from one file to another, and <b>require.cache</b> shows why a second import gets the same object.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'Class basics', code: "class Account {\n  #balance = 0;\n  static count = 0;\n  constructor(owner) { this.owner = owner; Account.count++; }\n  deposit(n) {\n    if (n <= 0) throw new RangeError('positive amounts only');\n    this.#balance += n;\n    return this;                 // allows chaining\n  }\n  get balance() { return this.#balance; }\n  toString() { return `${this.owner}: ${this.#balance}`; }\n}\nconst a = new Account('Ada').deposit(50).deposit(25);\nnew Account('Ben');\nconsole.log(String(a), a.balance, Account.count);\ntry { a.balance = 1e6; } catch (e) { console.log(e.name, '(strict mode: getter only)'); }\nconsole.log('balance still', a.balance);\nconsole.log(Object.keys(a));                // #balance is invisible" },
      { label: 'extends & super', code: "class Animal {\n  constructor(name) { this.name = name; }\n  speak() { return '…'; }\n  describe() { return `${this.name} (${this.constructor.name}) says ${this.speak()}`; }\n}\nclass Dog extends Animal {\n  speak() { return 'woof'; }\n}\nclass Puppy extends Dog {\n  speak() { return super.speak() + '!'; }\n}\nfor (const a of [new Animal('Generic'), new Dog('Rex'), new Puppy('Bit')]) console.log(a.describe());\nconsole.log(new Puppy('x') instanceof Animal);" },
      { label: 'Under the hood', code: "class Dog { speak() { return 'woof'; } }\nconst rex = new Dog();\nconsole.log(typeof Dog);\nconsole.log(Object.getPrototypeOf(rex) === Dog.prototype);\nconsole.log(Object.hasOwn(rex, 'speak'), 'speak' in rex);\n\n// methods are shared, not copied per object\nconsole.log(new Dog().speak === rex.speak);\n\n// you can patch the prototype at runtime (don't, in real code)\nDog.prototype.sit = function () { return 'sits'; };\nconsole.log(rex.sit());\ntry { Dog(); } catch (e) { console.log(e.name, e.message); }" },
      { label: 'Module-like scope', code: "// The playground is one file, but the idea of a module is a closed scope\n// that exposes only what it chooses. Before ESM, people used an IIFE:\nconst counterModule = (() => {\n  let count = 0;                          // private to the 'module'\n  const inc = () => ++count;\n  return { inc, get value() { return count; } };   // the 'exports'\n})();\ncounterModule.inc(); counterModule.inc();\nconsole.log(counterModule.value, counterModule.count);", note: 'The playground runs a single file, so real multi-file ESM and CommonJS examples are in the code tabs below.' }
    ]
  },
  gotchas: [
    { trap: 'Mixing <code>require</code> and <code>import</code> in one file', code: "import express from 'express';\nconst fs = require('fs');   // ReferenceError: require is not defined in ES module scope", why: 'In an ES module, <code>require</code>, <code>module</code>, <code>__dirname</code> and <code>__filename</code> don’t exist.', fix: 'Use <code>import</code> everywhere, <code>import.meta.dirname</code> / <code>import.meta.filename</code> (Node 20.11+), or <code>createRequire(import.meta.url)</code> when you really need require.' },
    { trap: 'Leaving out the file extension in ESM', code: "import { add } from './math';    // ERR_MODULE_NOT_FOUND\nimport { add } from './math.js'; // ✓", why: 'CommonJS tries extensions and <code>index.js</code> for you. Node’s ESM resolver doesn’t guess.', fix: 'Write the full relative path with the extension. TypeScript projects targeting Node ESM import <code>./math.js</code> too.' },
    { trap: '<code>exports = …</code> instead of <code>module.exports = …</code>', code: "exports = { add };        // exports nothing\nmodule.exports = { add };  // ✓", why: '<code>exports</code> is a local variable pointing at <code>module.exports</code>. Reassigning it just repoints the local variable.', fix: 'Assign properties on <code>exports.x = …</code>, or replace <code>module.exports</code> wholesale, never <code>exports</code>.' },
    { trap: 'Losing <code>this</code> when passing methods', code: "button.on('click', this.handle);   // this is undefined inside handle", why: 'Class bodies are strict mode, and a detached method has no receiver. See <a href="js-functions-basics.html">Functions</a>.', fix: 'Use an arrow wrapper, <code>.bind(this)</code>, or define the method as an arrow class field.' },
    { trap: 'Modules are singletons, so state leaks between tests and requests', why: 'Top-level <code>let cache = new Map()</code> in a module is shared by every importer for the whole process lifetime.', fix: 'Export factories (<code>createCache()</code>) instead of instances when callers need isolation, and reset state in tests.' }
  ],
  scenarios: [
    { title: '“Cannot use import statement outside a module”', symptom: 'After adding <code>import</code> syntax to <code>index.js</code>, the service crashes at startup with <code>SyntaxError: Cannot use import statement outside a module</code>.', diagnose: 'package.json has no <code>"type"</code> field, so <code>.js</code> files are CommonJS.', cause: 'Node decides the module system per file: by extension, then the nearest package.json <code>type</code>.', fix: 'Opt the package into ESM and convert the remaining <code>require</code> calls (Node 22.7+ can also detect ESM syntax automatically, but don’t rely on it in production).', fixCode: '// package.json\n{\n  "type": "module",\n  "engines": { "node": ">=22" }\n}', lang: 'json' },
    { title: 'Two copies of a “singleton”', symptom: 'A metrics registry exported from a shared library is empty when the HTTP layer reads it, although the business layer registered counters.', diagnose: '<code>npm ls metrics-lib</code> shows two versions installed in different <code>node_modules</code> folders.', cause: 'The module cache is keyed by resolved file path. Two installed copies mean two module instances, each with its own state. Java’s classloader-per-webapp has the same failure mode.', fix: 'Deduplicate the dependency (one version, or make it a peer dependency) and avoid relying on module identity across package boundaries.', fixCode: 'npm ls metrics-lib\nnpm dedupe\n# or in the library: "peerDependencies": { "metrics-lib": "^3" }', lang: 'bash' }
  ],
  puzzles: [
    { kind: 'predict', q: 'Overriding and dispatch. What prints?', code: "class Animal {\n  speak() { return '...'; }\n  describe() { return `${this.constructor.name}: ${this.speak()}`; }\n}\nclass Dog extends Animal {\n  speak() { return 'woof'; }\n}\nconsole.log(new Dog().describe(), new Animal().describe());", options: ['Animal: woof Animal: ...', 'Dog: woof Animal: ...', 'Dog: ... Animal: ...', 'TypeError'], answer: 1, explain: '<code>describe</code> is inherited, but <code>this</code> is the Dog, so <code>this.speak()</code> finds Dog’s override first. Same dynamic dispatch as Java.', run: true, expect: 'Dog: woof Animal: ...' },
    { kind: 'predict', q: 'What is a class? What prints?', code: "class A {}\nconst a = new A();\nconsole.log(typeof A, Object.getPrototypeOf(a) === A.prototype);\ntry {\n  A();\n} catch (e) {\n  console.log(e.name);\n}", options: ['class true TypeError', 'function true TypeError', 'object false undefined', 'function false ReferenceError'], answer: 1, explain: 'A class is a function whose <code>prototype</code> object becomes the prototype of every instance. Calling it without <code>new</code> throws a TypeError.', run: true, expect: 'function true\nTypeError' },
    { kind: 'predict', q: 'Private and static fields. What prints?', code: "class Counter {\n  #n = 0;\n  static created = 0;\n  constructor() { Counter.created++; }\n  inc() { return ++this.#n; }\n}\nconst a = new Counter();\nconst b = new Counter();\na.inc(); a.inc();\nconsole.log(a.inc(), b.inc(), Counter.created, a.n);", options: ['3 3 2 undefined', '3 1 2 undefined', '3 1 2 3', '1 1 1 undefined'], answer: 1, explain: 'Each instance has its own <code>#n</code>; the static counter is shared on the class. <code>a.n</code> is a different, non-existent public property, so it is undefined.', run: true, expect: '3 1 2 undefined' },
    { kind: 'predict', q: 'CommonJS exports. What prints?', code: "exports.a = 1;\nmodule.exports = { b: 2 };\nexports.c = 3;\nconsole.log(module.exports);", options: ['{ a: 1, b: 2, c: 3 }', '{ b: 2 }', '{ b: 2, c: 3 }', '{ a: 1, c: 3 }'], answer: 1, explain: '<code>exports</code> starts as a reference to the original <code>module.exports</code> object. Replacing <code>module.exports</code> breaks that link, so <code>exports.c</code> goes to the old, discarded object.', run: true, expect: '{ b: 2 }' },
    { kind: 'predict', q: 'Getters and setters. What prints?', code: "class Temp {\n  constructor(c) { this.c = c; }\n  get f() { return this.c * 9 / 5 + 32; }\n  set f(v) { this.c = (v - 32) * 5 / 9; }\n}\nconst t = new Temp(100);\nt.f = 32;\nconsole.log(t.c, t.f);", options: ['100 212', '0 32', '32 89.6', '0 212'], answer: 1, explain: '<code>t.f = 32</code> calls the setter, which sets c to (32−32)·5/9 = 0. Reading <code>t.f</code> calls the getter: 0·9/5 + 32 = 32. Accessors look like fields to callers.', run: true, expect: '0 32' },
    { kind: 'predict', q: 'The module cache. What prints?', code: "console.log(require.cache[__filename] === module, typeof module.exports, Object.keys(module.exports).length);", options: ['true object 0', 'false object 0', 'true function 0', 'undefined undefined 0'], answer: 0, explain: 'The running file is already in <code>require.cache</code>, keyed by its absolute path, before its code runs. That entry is what later <code>require</code> calls return. Nothing is exported yet, so the exports object is empty.', run: true, expect: 'true object 0' },
    { kind: 'concept', q: 'Which statement about ES modules in Node 22 is true?', options: ['You can call <code>require</code> in any <code>.mjs</code> file', 'Static <code>import</code> declarations can go inside an <code>if</code>', 'Relative imports must include the file extension', '<code>__dirname</code> is available as in CommonJS'], answer: 2, explain: 'Node’s ESM resolver needs <code>./file.js</code>. <code>require</code> and <code>__dirname</code> don’t exist in ESM (use <code>import.meta.dirname</code>), and static imports must be at the top level; use <code>await import()</code> for conditional loading.' }
  ],
  interview: [
    { q: 'Are JavaScript classes like Java classes?', a: '<p>The syntax is similar, but a class is syntax over prototypes. Methods live on a shared <code>prototype</code> object; instances link to it. You can add methods at runtime, there are no interfaces or overloading, and only single inheritance.</p>', lvl: 'core' },
    { q: 'What is the prototype chain?', a: '<p>Every object has an internal link to a prototype object. Reading a missing property walks that chain until it is found or reaches <code>null</code> after <code>Object.prototype</code>. <code>instanceof</code> checks whether <code>C.prototype</code> is on the chain.</p>', lvl: 'core' },
    { q: 'How do you make a field private?', a: '<p>Use <code>#field</code> (ES2022): access from outside is a syntax error, and it doesn’t appear in <code>Object.keys</code> or JSON. Older code used closures or a <code>_field</code> naming convention, which is not enforced.</p>', lvl: 'core' },
    { q: 'Explain named vs default exports.', a: '<p>Named exports (<code>export function a</code>) can be several per module and are imported by exact name: <code>import { a } from</code>. A default export is one per module and imported under any name. Many teams prefer named exports: renames are explicit and tooling can find usages.</p>', lvl: 'core' },
    { q: 'What are the main differences between CommonJS and ESM?', a: '<ul><li>CJS: <code>require()</code> is a synchronous function call, resolved at runtime, can be conditional; <code>module.exports</code> is a plain object.</li><li>ESM: <code>import</code> declarations are static, linked before code runs, with live bindings; supports top-level <code>await</code>; strict mode always.</li></ul><p>See <a href="modules-cjs-esm.html">CommonJS vs ESM</a> for interop.</p>', lvl: 'core' },
    { q: 'How does Node decide whether a file is ESM or CommonJS?', a: '<p><code>.mjs</code> → ESM, <code>.cjs</code> → CommonJS. For <code>.js</code>, the nearest package.json <code>"type"</code>: <code>"module"</code> → ESM, otherwise CommonJS. Node 22.7+ can also detect ESM syntax in an untyped <code>.js</code> file and reparse it as ESM.</p>', lvl: 'core' },
    { q: 'What happens when two modules import the same module?', a: '<p>It is loaded and executed once. Both get the same exports from the cache (keyed by resolved path or URL). So module-level state is shared, effectively a singleton.</p>', fu: 'When could you get two instances anyway? (Two installed copies in different node_modules folders, or the same file loaded once via require and once via import.)', lvl: 'core' },
    { q: 'Composition or inheritance in JavaScript?', a: '<p>Same advice as Java: prefer composition. JavaScript makes it even cheaper, because you can pass functions and plain objects around instead of building class hierarchies. Use <code>extends</code> mainly for custom errors and framework base classes.</p>', lvl: 'core' },
    { q: 'What do <code>super</code> and <code>this</code> do in a derived constructor?', a: '<p>A derived constructor must call <code>super(...)</code> before touching <code>this</code>, otherwise it throws a ReferenceError: the parent constructor is what actually creates the object. Outside constructors, <code>super.method()</code> calls the parent’s version, as in Java.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'ESM service module', lang: 'js', code: `// src/user-service.js  (package.json: "type": "module")
import { randomUUID } from 'node:crypto';

export class NotFoundError extends Error {
  constructor(id) { super(\`user \${id} not found\`); this.name = 'NotFoundError'; }
}

export class UserService {
  #users = new Map();
  create(name) {
    const user = { id: randomUUID(), name };
    this.#users.set(user.id, user);
    return user;
  }
  get(id) {
    const u = this.#users.get(id);
    if (!u) throw new NotFoundError(id);
    return u;
  }
}

// src/app.js
import { UserService, NotFoundError } from './user-service.js';
const users = new UserService();` },
    { title: 'Same in CommonJS', lang: 'js', code: `// src/user-service.cjs
const { randomUUID } = require('node:crypto');

class NotFoundError extends Error { /* … */ }
class UserService { /* … */ }

module.exports = { UserService, NotFoundError };

// src/app.cjs
const { UserService } = require('./user-service.cjs');
const users = new UserService();
console.log(__dirname);   // available in CJS; in ESM use import.meta.dirname` },
    { title: 'Java equivalent', lang: 'java', code: `// UserService.java  — the package + public modifier play the role of export
package com.example.users;

public class UserService {
    private final Map<String, User> users = new HashMap<>();   // like #users

    public User create(String name) {
        var user = new User(UUID.randomUUID().toString(), name);
        users.put(user.id(), user);
        return user;
    }
    public User get(String id) {
        var u = users.get(id);
        if (u == null) throw new NotFoundException(id);
        return u;
    }
}

// App.java
import com.example.users.UserService;`, note: 'Java imports types by package; JavaScript imports values by file path. A Spring singleton bean plays the role a module-level instance plays in Node.' }
  ]
});

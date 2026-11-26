IA.register({
  track: 'nodejs',
  slug: 'js-functions-basics',
  title: 'Functions',
  tagline: 'Functions are <b>values</b>: you store them, pass them and return them, like Java lambdas but without functional interfaces. Learn the two syntaxes, default and rest parameters, closures, and the one rule that decides <code>this</code>.',
  tldr: {
    problem: 'Java ties methods to classes and checks every call’s arity. JavaScript functions float freely, accept any number of arguments, remember the variables around them, and decide <code>this</code> at call time. Each of these surprises Java developers once.',
    model: 'A function is an object holding code plus a link to the scope where it was created (its <b>closure</b>). <code>this</code> is set by the <i>call site</i>: <code>obj.f()</code> gives <code>this = obj</code>. Arrow functions skip that and use the surrounding <code>this</code>.',
    hook: '“What is a closure?” A function together with the variables of the scope it was defined in. They stay alive as long as the function does, which is how you get private state, and also how you leak memory.',
    facts: [
      { v: '2 kinds', l: 'of syntax you’ll use daily: <code>function name() {}</code> declarations and <code>(x) =&gt; x * 2</code> arrows' },
      { v: 'any arity', l: 'calls never fail on argument count. Missing parameters are <code>undefined</code>, extras are ignored' },
      { v: 'call site', l: 'decides <code>this</code> for normal functions. Arrows inherit it from the enclosing code' }
    ]
  },
  intro: {
    what: 'A <b>function</b> is a reusable block of code with parameters and a return value, like a Java method. The difference: it doesn’t need a class. You can put it in a variable, pass it to another function (a <b>callback</b>), or return it from one. Most Node code is functions passing functions around.',
    analogy: { icon: '🎒', title: 'A function carries a backpack', text: 'When a function is created inside another one, it packs the outer variables into a backpack and takes them along. Even after the outer function has finished, the inner one can still open the backpack. That backpack is the closure.' },
    steps: [
      { t: 'Declare or assign', d: 'A declaration is hoisted (usable before its line). An arrow stored in a <code>const</code> is not.', code: "function add(a, b) {\n  return a + b;\n}\nconst double = (x) => x * 2;      // one expression: implicit return\nconst greet = (name) => {\n  return `hi ${name}`;             // braces: explicit return\n};" },
      { t: 'Defaults and rest', d: 'Defaults replace Java overloads. <code>...rest</code> works like varargs and is a real array.', code: "function log(msg, level = 'info', ...tags) {\n  console.log(`[${level}] ${msg}`, tags);\n}\nlog('started');                 // [info] started []\nlog('slow', 'warn', 'db', 'p99');" },
      { t: 'Pass functions around', d: 'Like passing a lambda to <code>stream().map()</code>, but no interface type is needed.', code: "const nums = [1, 2, 3];\nnums.map(double);            // [2, 4, 6]\nsetTimeout(() => console.log('later'), 100);" },
      { t: 'Closures', d: 'An inner function remembers the outer function’s variables.', code: "function makeCounter() {\n  let count = 0;\n  return () => ++count;\n}\nconst next = makeCounter();\nnext(); next();   // 2" },
      { t: '<code>this</code> in one rule', d: '<code>obj.method()</code> → <code>this</code> is <code>obj</code>. Detach the method and it is lost. Arrow functions use the outer <code>this</code>.', code: "const user = { name: 'Ada', hi() { return this.name; } };\nuser.hi();          // 'Ada'\nconst f = user.hi;  // f() → this is undefined (strict)" }
    ],
    terms: [
      ['callback', 'A function you pass to another function so it can call you back later.'],
      ['arrow function', '<code>(a) =&gt; …</code>. Short syntax, no own <code>this</code> or <code>arguments</code>, can’t be used with <code>new</code>.'],
      ['closure', 'A function plus the variables of the scope it was created in.'],
      ['higher-order function', 'A function that takes or returns functions: <code>map</code>, <code>filter</code>, <code>setTimeout</code>.'],
      ['hoisting', 'Function declarations are available in their whole scope, even above the line where they are written.'],
      ['<code>this</code>', 'The object a normal function was called on. Set at call time.']
    ]
  },
  visual: {
    title: 'Stack frames, closures and this',
    caption: 'Pick an example and Step. The left column is the call stack: each ▸ is a running function and its local variables. The right column is the heap. Watch <code>count</code> survive after <code>makeCounter()</code> returns, and watch <code>this</code> point at <code>user</code> only when the call is written <code>user.hi()</code>.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'Closure counter', code: "function makeCounter(start = 0) {\n  let count = start;\n  return {\n    inc: () => ++count,\n    get: () => count,\n  };\n}\nconst a = makeCounter();\nconst b = makeCounter(100);\na.inc(); a.inc(); b.inc();\nconsole.log(a.get(), b.get());\nconsole.log('count is private:', a.count);", note: 'Each call to makeCounter makes a new, separate <code>count</code>.' },
      { label: 'Loop: var vs let', code: "for (var i = 0; i < 3; i++) setTimeout(() => console.log('var', i));\nfor (let j = 0; j < 3; j++) setTimeout(() => console.log('let', j));", note: 'There is one <code>var i</code> shared by all three callbacks; it is 3 by the time they run. <code>let</code> creates a fresh <code>j</code> per iteration.' },
      { label: 'this & bind', code: "// class bodies are always strict mode\nclass User {\n  constructor(name) { this.name = name; }\n  hi() { return this?.name; }\n  later() { setTimeout(() => console.log('arrow sees', this.name), 10); }\n}\nconst user = new User('Ada');\nconst f = user.hi;\nconsole.log(user.hi());\nconsole.log(f());\nconsole.log(f.call({ name: 'Bob' }));\nconsole.log(user.hi.bind(user)());\nuser.later();" },
      { label: 'Defaults, rest, spread', code: "function sum(first = 0, ...rest) {\n  return rest.reduce((acc, n) => acc + n, first);\n}\nconsole.log(sum());\nconsole.log(sum(1, 2, 3));\nconst nums = [4, 5, 6];\nconsole.log(sum(...nums));          // spread an array into arguments\nconsole.log(Math.max(...nums));\nconsole.log(sum.length, sum.name);  // functions are objects with properties" },
      { label: 'Functions as values', code: "const compose = (...fns) => (x) => fns.reduceRight((v, f) => f(v), x);\nconst trim = (s) => s.trim();\nconst upper = (s) => s.toUpperCase();\nconst shout = compose((s) => s + '!', upper, trim);\nconsole.log(shout('  hello '));\n\nconst once = (fn) => { let done = false, v; return (...a) => done ? v : (done = true, v = fn(...a)); };\nconst init = once(() => { console.log('init runs'); return 42; });\nconsole.log(init(), init());" }
    ]
  },
  gotchas: [
    { trap: 'Passing a method as a callback loses <code>this</code>', code: "class Timer {\n  ticks = 0;\n  tick() { this.ticks++; }\n}\nconst t = new Timer();\nsetInterval(t.tick, 1000);        // TypeError: this is undefined\nsetInterval(() => t.tick(), 1000); // ✓", why: '<code>t.tick</code> is only a function value; the <code>t.</code> part of the call is gone when setInterval calls it.', fix: 'Wrap in an arrow, use <code>t.tick.bind(t)</code>, or define the method as an arrow class field: <code>tick = () =&gt; { … }</code>.' },
    { trap: 'Arrow functions as object methods', code: "const user = {\n  name: 'Ada',\n  hi: () => this.name,   // this is NOT user\n};", why: 'Arrows take <code>this</code> from the surrounding code, which here is the module, not the object.', fix: 'Use method syntax <code>hi() { … }</code> for methods; use arrows for callbacks inside them.' },
    { trap: 'Returning an object literal from an arrow', code: "const mk = (id) => { id };     // returns undefined (a block!)\nconst mk2 = (id) => ({ id });  // ✓ returns { id }", why: '<code>{</code> right after <code>=&gt;</code> starts a function body, and <code>id</code> is just an expression statement.', fix: 'Wrap the object literal in parentheses.' },
    { trap: 'Wrong argument count is silent', code: "function area(w, h) { return w * h; }\narea(3);        // NaN, no error\narea(3, 4, 5);  // 12, extra ignored", why: 'JavaScript doesn’t check arity. <code>undefined * 3</code> is <code>NaN</code>.', fix: 'Use defaults, validate inputs at API boundaries, or let <a href="typescript-node.html">TypeScript</a> check calls.' },
    { trap: '<code>var</code> in a loop with async callbacks', code: "for (var i = 0; i < 3; i++) setTimeout(() => console.log(i));  // 3 3 3", why: 'All callbacks close over the <i>same</i> <code>var i</code>, which is 3 when they finally run.', fix: 'Use <code>let</code>: each iteration gets its own binding.' },
    { trap: 'Closures keep big things alive', why: 'A closure keeps its whole scope reachable. A long-lived listener that closes over a large buffer or request object keeps it out of the garbage collector.', fix: 'Remove listeners you no longer need, and copy just the fields you need into the closure. See <a href="v8-gc-leaks.html">V8 memory & leaks</a>.' }
  ],
  scenarios: [
    { title: 'Every request logs the same user', symptom: 'After a refactor, audit logs show one user ID for all requests within a few seconds of each other.', diagnose: 'A helper sets a module-level variable, then logs it in an async callback.', cause: 'Module scope is shared by every request. The callback closes over the <i>variable</i>, not its value at the time, so it reads whatever the latest request wrote.', fix: 'Keep per-request data in function-scoped <code>const</code>s, or pass it explicitly. For request context across async calls, use <code>AsyncLocalStorage</code>.', fixCode: "// ✗ let currentUser; function handle(req) { currentUser = req.user; audit(); }\nasync function handle(req) {\n  const user = req.user;            // per call\n  await save(req.body);\n  log.info({ user: user.id }, 'saved');\n}" },
    { title: 'Cannot read properties of undefined (reading \'db\')', symptom: 'A service class works in unit tests but throws when its method is registered as an Express route handler.', diagnose: 'The stack trace points at <code>this.db</code> inside <code>UserService.get</code>, which was passed as <code>app.get(\'/u/:id\', service.get)</code>.', cause: 'Express calls the function without <code>service.</code>, so <code>this</code> is undefined in the class body (classes are always strict).', fix: 'Bind once, or wrap the call.', fixCode: "app.get('/u/:id', (req, res) => service.get(req, res));\n// or in the class: get = async (req, res) => { … };" }
  ],
  puzzles: [
    { kind: 'predict', q: 'Two counters. What prints?', code: "function makeCounter() {\n  let c = 0;\n  return () => ++c;\n}\nconst a = makeCounter();\nconst b = makeCounter();\na(); a();\nconsole.log(a(), b());", options: ['3 3', '3 1', '1 1', '2 1'], answer: 1, explain: 'Each call to <code>makeCounter</code> creates a fresh <code>c</code>. <code>a</code> has been called twice before, so the third call returns 3; <code>b</code>’s first call returns 1.', run: true, expect: '3 1' },
    { kind: 'predict', q: 'Timers in loops. What prints?', code: "for (var i = 0; i < 3; i++) setTimeout(() => console.log('var', i));\nfor (let j = 0; j < 3; j++) setTimeout(() => console.log('let', j));", options: ['var 0, var 1, var 2, let 0, let 1, let 2', 'var 3, var 3, var 3, let 0, let 1, let 2', 'var 3 ×3, let 3 ×3', 'let 0, let 1, let 2, var 3 ×3'], answer: 1, explain: 'Both loops finish before any timer fires. All <code>var</code> callbacks share one <code>i</code>, now 3. <code>let</code> makes a new <code>j</code> per iteration. Timers with equal delays fire in the order they were created.', run: true, expect: 'var 3\nvar 3\nvar 3\nlet 0\nlet 1\nlet 2' },
    { kind: 'predict', q: 'Default parameters. What prints?', code: "function f(a, b = a * 2) {\n  return a + b;\n}\nconsole.log(f(2), f(2, 0), f(2, null), f(2, undefined));", options: ['6 2 2 6', '6 6 6 6', '6 2 NaN 6', '6 2 2 NaN'], answer: 0, explain: 'A default applies only when the argument is <code>undefined</code> (missing or passed explicitly). <code>0</code> and <code>null</code> are real values; <code>2 + null</code> is 2 because null converts to 0.', run: true, expect: '6 2 2 6' },
    { kind: 'predict', q: 'Calling before the definition. What prints?', code: "console.log(decl());\ntry {\n  arrow();\n} catch (e) {\n  console.log(e.name);\n}\nfunction decl() { return 'decl ok'; }\nconst arrow = () => 'arrow ok';", options: ['decl ok, arrow ok', 'ReferenceError, ReferenceError', 'decl ok, ReferenceError', 'decl ok, TypeError'], answer: 2, explain: 'Function <b>declarations</b> are hoisted with their body. <code>const arrow</code> is in the temporal dead zone until its line, so touching it throws a ReferenceError.', run: true, expect: 'decl ok\nReferenceError' },
    { kind: 'predict', q: 'Who is <code>this</code>? What prints?', code: "'use strict';\nconst user = { name: 'Ada', hi() { return this?.name; } };\nconst f = user.hi;\nconsole.log(user.hi(), f(), f.call({ name: 'Bob' }));", options: ['Ada Ada Ada', 'Ada undefined Bob', 'Ada undefined Ada', 'TypeError'], answer: 1, explain: '<code>user.hi()</code> → this is user. Plain <code>f()</code> in strict mode → this is undefined, and <code>?.</code> turns that into undefined instead of a TypeError. <code>call</code> sets this explicitly.', run: true, expect: 'Ada undefined Bob' },
    { kind: 'predict', q: 'Rest and spread. What prints?', code: "function count(...xs) {\n  return xs.length;\n}\nconsole.log(count(), count(1, [2, 3]), count(...[1, 2, 3]));", options: ['0 3 3', '0 2 3', '0 2 1', 'undefined 2 3'], answer: 1, explain: 'Rest gives an empty array when nothing is passed. An array argument is one argument. Spread (<code>...</code> at a call site) unpacks the array into three arguments.', run: true, expect: '0 2 3' },
    { kind: 'concept', q: 'Which is true of arrow functions?', options: ['They are hoisted like declarations', 'They have their own <code>this</code>, set by the caller', 'They take <code>this</code> from the enclosing scope and can’t be called with <code>new</code>', 'They can’t take parameters with defaults'], answer: 2, explain: 'Arrows have lexical <code>this</code> (and no own <code>arguments</code>), and aren’t constructors. They are values, so as a <code>const</code> they aren’t usable before their line.' }
  ],
  interview: [
    { q: 'Function declaration vs function expression vs arrow function?', a: '<ul><li><b>Declaration</b> <code>function f() {}</code>: hoisted with its body.</li><li><b>Expression</b> <code>const f = function () {}</code>: a value, usable after the line runs.</li><li><b>Arrow</b> <code>const f = () =&gt; {}</code>: an expression with lexical <code>this</code> and no <code>arguments</code>, not a constructor.</li></ul>', lvl: 'core' },
    { q: 'What is a closure? Give a practical use.', a: '<p>A function bundled with the variables of the scope it was created in. Uses: private state (counters, caches), factories (<code>makeLogger(prefix)</code>), memoisation, and every callback that uses a variable from its enclosing function.</p>', fu: 'Can closures cause leaks? (Yes: a long-lived closure keeps its whole scope reachable.)', lvl: 'core' },
    { q: 'How is <code>this</code> determined?', a: '<p>For normal functions, at call time:</p><ol><li><code>new F()</code> → the new object.</li><li><code>f.call(o)</code> / <code>apply</code> / <code>bind</code> → <code>o</code>.</li><li><code>o.f()</code> → <code>o</code>.</li><li>plain <code>f()</code> → <code>undefined</code> in strict mode, the global object otherwise.</li></ol><p>Arrow functions ignore all of these and use the enclosing <code>this</code>.</p>', lvl: 'core' },
    { q: 'What do default and rest parameters replace from Java?', a: '<p>Defaults replace overloads like <code>log(msg)</code> / <code>log(msg, level)</code>. Rest (<code>...args</code>) replaces varargs and gives a real array. Before ES2015 people used the array-like <code>arguments</code> object; avoid it in new code.</p>', lvl: 'core' },
    { q: 'What happens when you call a function with too few or too many arguments?', a: '<p>Nothing fails. Missing parameters are <code>undefined</code> (or take their default); extra arguments are ignored, but still available through rest parameters. <code>f.length</code> reports the number of parameters before the first default or rest.</p>', lvl: 'core' },
    { q: 'Rest vs spread: same three dots?', a: '<p>Same syntax, opposite direction. In a parameter list, <code>...xs</code> <b>collects</b> arguments into an array. At a call site or in a literal, <code>...arr</code> <b>expands</b> an array (or iterable) into separate values.</p>', lvl: 'core' },
    { q: 'What is a higher-order function? Name some built-in ones.', a: '<p>A function that takes or returns a function. Built-ins: <code>Array.prototype.map/filter/reduce/forEach/sort</code>, <code>setTimeout</code>, <code>Promise.prototype.then</code>, <code>EventEmitter.on</code>. They are the JavaScript equivalent of methods accepting <code>Function</code>, <code>Predicate</code> or <code>Runnable</code>.</p>', lvl: 'core' },
    { q: 'Why does the classic “var in a for loop with setTimeout” print the same number three times?', a: '<p><code>var</code> creates one function-scoped variable shared by all callbacks. By the time the timers run, the loop has ended and the variable holds its final value. <code>let</code> creates a new binding per iteration, so each callback captures its own value.</p>', lvl: 'core' },
    { q: 'Compare a JavaScript closure with a Java lambda capturing a local.', a: '<p>Java lambdas may only capture <i>effectively final</i> locals: they copy the value. JavaScript closures capture the <i>variable itself</i>, so they see later changes and can modify it. That is more flexible and is the root of the var-loop bug.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Functions in real code', lang: 'js', code: `// a factory using a closure: config captured once
function makeLogger(service, level = 'info') {
  return (msg, ...fields) =>
    console.log(JSON.stringify({ level, service, msg, fields }));
}
const log = makeLogger('orders');

// higher-order: retry any async function
async function retry(fn, attempts = 3) {
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (e) { if (i >= attempts) throw e; log('retrying', i); }
  }
}

await retry(() => fetch('https://example.com/health'));` },
    { title: 'Java equivalent', lang: 'java', code: `// Java 21: lambdas need a functional interface type
static BiConsumer<String, Object[]> makeLogger(String service, String level) {
    return (msg, fields) -> System.out.printf("%s %s %s %s%n",
            level, service, msg, Arrays.toString(fields));
}
// no default params: write an overload
static BiConsumer<String, Object[]> makeLogger(String service) {
    return makeLogger(service, "info");
}

static <T> T retry(Callable<T> fn, int attempts) throws Exception {
    for (int i = 1; ; i++) {
        try { return fn.call(); }
        catch (Exception e) { if (i >= attempts) throw e; }
    }
}`, note: 'Java lambdas can only read effectively-final locals. JavaScript closures can read and modify the captured variable.' },
    { title: 'Memoise with a closure', lang: 'js', code: `function memoize(fn) {
  const cache = new Map();             // private to this closure
  return (key) => {
    if (!cache.has(key)) cache.set(key, fn(key));
    return cache.get(key);
  };
}
const slowSquare = (n) => { for (let i = 0; i < 1e7; i++); return n * n; };
const fastSquare = memoize(slowSquare);
fastSquare(9);   // slow the first time
fastSquare(9);   // instant`, note: 'An unbounded cache in a closure is a classic memory leak in long-running servers. Cap its size in real code.' }
  ]
});

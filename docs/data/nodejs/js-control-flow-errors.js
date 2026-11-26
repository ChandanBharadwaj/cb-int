IA.register({
  track: 'nodejs',
  slug: 'js-control-flow-errors',
  title: 'Control flow & errors',
  tagline: '<code>if</code>, <code>switch</code>, <code>for</code> and <code>while</code> look exactly like Java. The differences hide in <b>truthiness</b>, <b><code>for…of</code> vs <code>for…in</code></b>, switch fall-through, and an error model with <b>one untyped <code>catch</code></b> and no checked exceptions.',
  tldr: {
    problem: 'Java code compiles only if you handle checked exceptions and use a boolean in <code>if</code>. JavaScript accepts any value in <code>if</code>, lets you throw anything, and gives you a single <code>catch</code> that receives whatever was thrown.',
    model: '<code>try</code> runs until something throws; control jumps to <code>catch (e)</code>; <code>finally</code> runs on every path. To handle only some errors, check <code>e instanceof X</code> (or <code>e.code</code>) inside catch and <b>rethrow</b> the rest.',
    hook: '“<code>for…in</code> or <code>for…of</code> for an array?” <code>for…of</code>: it yields values. <code>for…in</code> yields string keys, including inherited enumerable ones; it’s meant for objects, and even there <code>Object.entries</code> is clearer.',
    facts: [
      { v: '1 catch', l: 'per try. There are no typed catch clauses and no checked exceptions' },
      { v: "'0'", l: 'is what <code>for…in</code> gives you for the first array index: keys are strings' },
      { v: 'cause', l: '<code>new Error(msg, { cause })</code> (Node 16.9+) chains errors, like Java’s <code>new RuntimeException(msg, e)</code>' }
    ]
  },
  intro: {
    what: '<b>Control flow</b> is the order in which lines run: <code>if</code> picks a branch, loops repeat, <code>switch</code> jumps to a matching case. <b>Errors</b> interrupt that flow: <code>throw</code> stops the current code and jumps to the nearest <code>catch</code>. If nothing catches it, a Node process prints the stack trace and exits.',
    analogy: { icon: '🚨', title: 'The fire alarm', text: '<code>throw</code> pulls the alarm: everyone leaves the room (the rest of <code>try</code> is skipped) and goes to the meeting point (<code>catch</code>). <code>finally</code> is the person who turns off the stove on the way out, every time, fire or not.' },
    steps: [
      { t: 'Branches and loops', d: 'Same syntax as Java. Conditions accept any value and use truthiness.', code: "if (items.length === 0) console.log('empty');\nelse if (items.length > 100) console.log('big');\n\nfor (let i = 0; i < 3; i++) {}\nwhile (queue.length) queue.shift();" },
      { t: 'Loop over values', d: '<code>for…of</code> works on arrays, strings, Maps and Sets. Use <code>Object.entries</code> for objects.', code: "for (const item of ['a', 'b']) console.log(item);\nfor (const [key, value] of Object.entries({ x: 1 })) console.log(key, value);\nfor (const [i, item] of ['a', 'b'].entries()) console.log(i, item);" },
      { t: 'Throw an Error', d: 'Always throw <code>Error</code> objects (or subclasses): they carry <code>message</code>, <code>name</code> and <code>stack</code>.', code: "function withdraw(balance, amount) {\n  if (amount > balance) throw new RangeError('insufficient funds');\n  return balance - amount;\n}" },
      { t: 'Catch, filter, rethrow', d: 'One catch block; decide inside it.', code: "try {\n  withdraw(10, 50);\n} catch (e) {\n  if (e instanceof RangeError) console.log('declined:', e.message);\n  else throw e;          // not ours: let it propagate\n} finally {\n  console.log('audit');\n}" }
    ],
    terms: [
      ['truthy / falsy', 'How any value behaves in <code>if</code>. Falsy: <code>false 0 \'\' null undefined NaN</code> (and <code>-0</code>, <code>0n</code>).'],
      ['iterable', 'Something <code>for…of</code> can loop over: arrays, strings, Map, Set, generators.'],
      ['throw', 'Stop normal flow and hand a value (normally an Error) to the nearest catch.'],
      ['stack trace', '<code>e.stack</code>: the chain of calls that led to the error, recorded when the Error is created.'],
      ['fall-through', 'In <code>switch</code>, running into the next case because there was no <code>break</code>.']
    ]
  },
  visual: {
    title: 'Follow the path of execution',
    caption: 'Pick an example and Step. The flow column lights up the block that is running: blue for normal flow, red for a throw, orange for a warning sign. The console shows output in order, and the variables box shows what’s in scope.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'Loops tour', code: "const fruits = ['apple', 'kiwi', 'fig'];\nfor (let i = 0; i < fruits.length; i++) console.log('index', i, fruits[i]);\nfor (const f of fruits) console.log('of', f);\nfor (const [i, f] of fruits.entries()) console.log('entries', i, f);\n\nlet n = 0;\nwhile (n < 3) n++;\ndo { n--; } while (n > 10);\nconsole.log('n', n);\n\nouter: for (const a of [1, 2, 3]) {\n  for (const b of [1, 2, 3]) {\n    if (a * b === 4) { console.log('found', a, b); break outer; }\n  }\n}" },
      { label: 'for…of vs for…in', code: "const arr = ['a', 'b'];\narr.extra = 'x';\nfor (const v of arr) console.log('of', v);\nfor (const k in arr) console.log('in', k, typeof k);\n\nconst cfg = { host: 'db', port: 5432 };\nfor (const [k, v] of Object.entries(cfg)) console.log(k, '=', v);\nfor (const ch of 'hé!') console.log('char', ch);\nconst m = new Map([['a', 1]]);\nfor (const [k, v] of m) console.log('map', k, v);" },
      { label: 'try/catch/finally order', code: "function run(fail) {\n  try {\n    console.log(' try start');\n    if (fail) throw new Error('boom');\n    console.log(' try end');\n    return 'ok';\n  } catch (e) {\n    console.log(' catch', e.message);\n    return 'recovered';\n  } finally {\n    console.log(' finally');\n  }\n}\nconsole.log('result:', run(false));\nconsole.log('result:', run(true));" },
      { label: 'Custom errors & cause', code: "class NotFoundError extends Error {\n  constructor(what, options) {\n    super(`${what} not found`, options);\n    this.name = 'NotFoundError';\n    this.status = 404;\n  }\n}\nfunction findUser(id) {\n  try {\n    throw new Error('connection refused');\n  } catch (e) {\n    throw new NotFoundError(`user ${id}`, { cause: e });\n  }\n}\ntry {\n  findUser(7);\n} catch (e) {\n  console.log(e instanceof NotFoundError, e instanceof Error);\n  console.log(e.name, e.status, e.message);\n  console.log('cause:', e.cause.message);\n}" },
      { label: 'switch vs lookup', code: "function statusText(code) {\n  switch (code) {\n    case 200: return 'OK';\n    case 404: return 'Not Found';\n    case '500': return 'string 500?';   // === : 500 !== '500'\n    default: return 'Unknown';\n  }\n}\nconsole.log(statusText(200), statusText(500), statusText('500'));\n\nconst TEXT = { 200: 'OK', 404: 'Not Found' };\nconsole.log(TEXT[404] ?? 'Unknown', TEXT[418] ?? 'Unknown');" }
    ]
  },
  gotchas: [
    { trap: '<code>for…in</code> over an array', code: "for (const i in [10, 20]) total += i;   // '0' + '1' string concat!", why: '<code>for…in</code> iterates enumerable property <b>names</b>, as strings, including properties added to the array or its prototype.', fix: 'Use <code>for…of</code> for values, <code>arr.entries()</code> for index + value, <code>Object.entries(obj)</code> for objects.' },
    { trap: 'Throwing strings', code: "throw 'not found';   // no stack, no .message", why: 'Anything can be thrown. A string has no stack trace, so logs can’t tell you where it came from, and <code>e.message</code> is undefined.', fix: 'Throw <code>new Error(…)</code> or a subclass. In catch, don’t assume <code>e</code> is an Error if third-party code is involved.' },
    { trap: 'Swallowing errors', code: "try { await save(order); } catch (e) {}   // silent data loss", why: 'With no checked exceptions, nothing forces you to handle errors well. An empty catch hides real failures.', fix: 'Catch only what you can handle, log with context, and rethrow the rest. Wrap with <code>{ cause: e }</code> to add context without losing the original.' },
    { trap: '<code>return</code> inside <code>finally</code>', code: "function f() {\n  try { throw new Error('lost'); }\n  finally { return 'ok'; }   // the error vanishes\n}", why: 'A return (or throw) in finally replaces whatever the try or catch was doing, including an exception in flight. Java behaves the same way.', fix: 'Use finally only for cleanup. Never return from it.' },
    { trap: 'Missing <code>break</code> in switch', why: 'Cases fall through into the next one. JavaScript has no Java 14-style arrow switch.', fix: 'End every case with <code>break</code> or <code>return</code>, enable ESLint <code>no-fallthrough</code>, or use an object/Map lookup.' },
    { trap: 'try/catch doesn’t catch errors thrown later', code: "try {\n  setTimeout(() => { throw new Error('boom'); }, 10);\n} catch (e) { /* never runs */ }", why: 'The try block finished long before the timer callback runs on a new stack.', fix: 'Catch inside the callback, or use promises with <code>await</code> inside try. See <a href="async-errors.html">Async error handling</a>.' }
  ],
  scenarios: [
    { title: 'Retries that never retry', symptom: 'A job is supposed to retry on network errors, but the logs show a single attempt followed by “done”.', diagnose: 'The code catches all errors, logs <code>e.message</code>, and continues. <code>e.message</code> is undefined in the logs.', cause: 'A library throws plain objects like <code>{ code: \'ECONNRESET\' }</code>, not Errors. The retry checks <code>e instanceof NetworkError</code>, which is false, and the empty fallthrough path swallows it.', fix: 'Normalise unknown thrown values, decide on <code>code</code>, and rethrow what you can’t handle.', fixCode: "} catch (raw) {\n  const e = raw instanceof Error ? raw : new Error(String(raw?.message ?? raw), { cause: raw });\n  if (['ECONNRESET', 'ETIMEDOUT'].includes(raw?.code) && attempt < 3) continue;\n  throw e;\n}" },
    { title: 'A crash on one bad input takes down the API', symptom: 'One request with malformed JSON restarts the whole Node process; every in-flight request fails.', diagnose: 'Stack trace: <code>SyntaxError: Unexpected token</code> from <code>JSON.parse</code> inside a raw <code>http</code> handler, uncaught.', cause: 'An uncaught exception in Node terminates the process by default. Unlike a Java servlet container, there’s no per-request catch unless you write one.', fix: 'Catch at the request boundary and answer 400. Frameworks like Express do this for synchronous handlers. See <a href="node-first-http-server.html">Your first HTTP server</a>.', fixCode: "let data;\ntry {\n  data = JSON.parse(body);\n} catch {\n  res.writeHead(400, { 'content-type': 'application/json' });\n  return res.end(JSON.stringify({ error: 'invalid JSON' }));\n}" }
  ],
  puzzles: [
    { kind: 'predict', q: '<code>finally</code> and <code>return</code>. What prints?', code: "function f() {\n  try {\n    return 'try';\n  } finally {\n    console.log('finally');\n  }\n}\nconsole.log(f());", options: ['try', 'finally', 'finally, then try', 'try, then finally'], answer: 2, explain: 'The return value is computed, then <code>finally</code> runs before the function actually returns. So “finally” is logged first, then the caller logs “try”.', run: true, expect: 'finally\ntry' },
    { kind: 'predict', q: 'A <code>return</code> in finally. What prints?', code: "function g() {\n  try {\n    throw new Error('x');\n  } catch (e) {\n    return 'catch';\n  } finally {\n    return 'finally';\n  }\n}\nconsole.log(g());", options: ['catch', 'finally', 'Error: x', 'undefined'], answer: 1, explain: 'A return in finally overrides the pending return from catch (and would also swallow an exception). Same rule as Java.', run: true, expect: 'finally' },
    { kind: 'predict', q: 'Keys vs values. What prints?', code: "const a = ['x', 'y'];\nfor (const i in a) console.log(typeof i, i);\nfor (const v of a) console.log(v);", options: ['number 0, number 1, x, y', 'string 0, string 1, x, y', 'string x, string y, 0, 1', 'number 0, number 1, 0, 1'], answer: 1, explain: '<code>for…in</code> yields property names, and property names are strings. <code>for…of</code> yields the values.', run: true, expect: 'string 0\nstring 1\nx\ny' },
    { kind: 'predict', q: 'Fall-through. What prints?', code: "function f(n) {\n  let out = '';\n  switch (n) {\n    case 1: out += 'one ';\n    case 2: out += 'two '; break;\n    default: out += 'other';\n  }\n  return out.trim();\n}\nconsole.log(f(1) + '|' + f(2) + '|' + f(3));", options: ['one|two|other', 'one two|two|other', 'one two other|two|other', 'one|two two|other'], answer: 1, explain: 'Case 1 has no break, so it falls into case 2, which then breaks. Case 2 alone gives “two”. 3 matches nothing and hits <code>default</code>.', run: true, expect: 'one two|two|other' },
    { kind: 'predict', q: 'Throwing a string. What prints?', code: "try {\n  throw 'oops';\n} catch (e) {\n  console.log(typeof e, e instanceof Error, e.stack);\n}", options: ['string false undefined', 'object true (a stack trace)', 'string true undefined', 'TypeError'], answer: 0, explain: 'Any value can be thrown, and catch receives it unchanged. A string isn’t an Error and has no stack. This is why you always throw Error objects.', run: true, expect: 'string false undefined' },
    { kind: 'predict', q: 'A custom error class. What prints?', code: "class NotFound extends Error {\n  constructor(id) {\n    super(`no ${id}`);\n    this.name = 'NotFound';\n  }\n}\ntry {\n  throw new NotFound(7);\n} catch (e) {\n  console.log(e instanceof NotFound, e instanceof Error, e.name, e.message);\n}", options: ['true true NotFound no 7', 'true false NotFound no 7', 'true true Error no 7', 'false true NotFound undefined'], answer: 0, explain: '<code>extends Error</code> keeps the prototype chain, so both instanceof checks pass. Setting <code>name</code> controls how the error prints in stack traces.', run: true, expect: 'true true NotFound no 7' },
    { kind: 'predict', q: '<code>continue</code> and <code>break</code>. What prints?', code: "let s = '';\nfor (let i = 0; i < 5; i++) {\n  if (i === 1) continue;\n  if (i === 3) break;\n  s += i;\n}\nconsole.log(s);", options: ['0234', '02', '023', '012'], answer: 1, explain: 'i=0 is added, 1 is skipped by continue, 2 is added, and the loop breaks at 3: <b>02</b>. <code>s</code> is a string, so <code>s += i</code> appends digits.', run: true, expect: '02' }
  ],
  interview: [
    { q: 'How does error handling in JavaScript differ from Java?', a: '<ul><li>No checked exceptions: nothing forces callers to handle anything.</li><li>One <code>catch</code> per try, untyped. Filter with <code>instanceof</code> or <code>e.code</code> and rethrow.</li><li>Any value can be thrown, not only Errors.</li><li>Asynchronous errors don’t propagate through a surrounding try unless you <code>await</code>.</li></ul>', lvl: 'core' },
    { q: 'for…of vs for…in vs forEach?', a: '<p><code>for…of</code> iterates values of an iterable and supports <code>break</code>, <code>continue</code> and <code>await</code>. <code>for…in</code> iterates enumerable string keys of an object, including inherited ones. <code>forEach</code> calls a callback per element: no <code>break</code>, and it ignores returned promises.</p>', lvl: 'core' },
    { q: 'When does finally run?', a: '<p>After the try block completes normally, after a catch block, and also when try or catch <code>return</code>, <code>break</code> or throw. A return or throw inside finally overrides the earlier outcome, so keep finally to cleanup.</p>', lvl: 'core' },
    { q: 'How do you create a custom error type?', a: '<p><code>class NotFoundError extends Error { constructor(msg, opts) { super(msg, opts); this.name = \'NotFoundError\'; } }</code>. Add fields like <code>status</code> or <code>code</code>. Pass <code>{ cause }</code> to keep the original error.</p>', fu: 'Why set name? (It appears in stack traces and logs; otherwise it shows as plain “Error”.)', lvl: 'core' },
    { q: 'What are the built-in error types?', a: '<p><code>Error</code>, <code>TypeError</code> (wrong type, e.g. calling undefined), <code>RangeError</code> (value out of range), <code>ReferenceError</code> (unknown variable), <code>SyntaxError</code> (e.g. from <code>JSON.parse</code>), <code>URIError</code>, <code>EvalError</code>, and <code>AggregateError</code> (several errors, from <code>Promise.any</code>). Node adds system errors with a <code>code</code> such as <code>ENOENT</code> or <code>ECONNREFUSED</code>.</p>', lvl: 'core' },
    { q: 'What happens to an uncaught exception in Node?', a: '<p>Node prints the stack to stderr and exits with code 1. You can listen to <code>process.on(\'uncaughtException\')</code> to log, but the process may be in an inconsistent state, so the safe action is to exit and let the supervisor restart it.</p>', lvl: 'core' },
    { q: 'How does switch compare values?', a: '<p>With strict equality (<code>===</code>), so <code>case 1</code> doesn’t match <code>\'1\'</code>. Cases fall through without <code>break</code>. Any expression can be a case label, and objects compare by reference.</p>', lvl: 'core' },
    { q: 'What is optional catch binding?', a: '<p>Since ES2019 you can write <code>catch { … }</code> without <code>(e)</code> when you don’t need the error, e.g. <code>try { return JSON.parse(s); } catch { return null; }</code>.</p>', lvl: 'core' },
    { q: 'How would you wrap a low-level error without losing it?', a: '<p><code>throw new Error(\'loading config failed\', { cause: err })</code>. Node prints the cause chain in the stack output, similar to Java’s “Caused by:”. Logging libraries like pino serialise <code>cause</code> too.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Handling errors at a boundary', lang: 'js', code: `class AppError extends Error {
  constructor(message, { status = 500, cause } = {}) {
    super(message, { cause });
    this.name = 'AppError';
    this.status = status;
  }
}

function parseOrder(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new AppError('body is not valid JSON', { status: 400, cause: e });
  }
  if (!Array.isArray(data.items)) throw new AppError('items must be an array', { status: 400 });
  return data;
}

try {
  parseOrder('{"items": 3}');
} catch (e) {
  if (e instanceof AppError) console.log(e.status, e.message);
  else throw e;
}` },
    { title: 'Java equivalent', lang: 'java', code: `class AppException extends RuntimeException {      // unchecked, like every JS error
    final int status;
    AppException(String msg, int status, Throwable cause) {
        super(msg, cause);
        this.status = status;
    }
}

static Order parseOrder(String text) {
    try {
        return mapper.readValue(text, Order.class);
    } catch (JsonProcessingException e) {        // typed catch: JS checks instanceof instead
        throw new AppException("body is not valid JSON", 400, e);
    }
}

try {
    parseOrder("{\\"items\\": 3}");
} catch (AppException e) {
    System.out.println(e.status + " " + e.getMessage());
}`, note: 'Java picks the catch block by type. JavaScript has one block, and you branch on <code>instanceof</code> inside it.' },
    { title: 'Loops in practice', lang: 'js', code: `const inventory = new Map([['apple', 3], ['kiwi', 0], ['fig', 12]]);

for (const [item, qty] of inventory) {
  if (qty === 0) continue;               // skip
  if (qty > 10) {
    console.log(\`\${item}: plenty\`);
    break;                               // stop the loop
  }
  console.log(\`\${item}: \${qty}\`);
}

// over an object: entries, not for…in
const limits = { cpu: '500m', memory: '256Mi' };
for (const [k, v] of Object.entries(limits)) console.log(k, v);` }
  ]
});

IA.register({
  track: 'nodejs',
  slug: 'callbacks-promises-async',
  title: 'Callbacks → promises → async/await',
  tagline: 'Three generations of the same idea: “call me when it’s done”. <b>Callbacks</b> pass a function in. <b>Promises</b> hand back an object that settles once. <b>async/await</b> lets you write promise code top to bottom. The real skill is choosing between <b>sequential</b> and <b>parallel</b> awaits, and picking the right combinator.',
  tldr: {
    problem: 'Accidental serial awaits that triple latency, <code>Promise.all</code> that hides partial failures, <code>forEach(async …)</code> that doesn’t wait, and callback APIs that call back twice.',
    model: 'A promise is <b>pending</b>, then settles <b>once</b>: <b>fulfilled</b> with a value or <b>rejected</b> with a reason. <code>await p</code> suspends the async function until <code>p</code> settles. Calls start when you <i>call</i> them, not when you await, so start independent work first and await together: <code>all</code> (fail-fast), <code>allSettled</code> (every outcome), <code>race</code> (first to settle), <code>any</code> (first to fulfil).',
    hook: '“Three independent 100 ms calls with three <code>await</code>s: how long?” About 300 ms. With <code>Promise.all</code>: about 100 ms.',
    facts: [
      { v: '3', l: 'promise states: pending, fulfilled, rejected. Once settled, a promise never changes again' },
      { v: '4', l: 'combinators: all (ES2015), race (ES2015), allSettled (ES2020), any (ES2021, rejects with AggregateError)' },
      { v: '(err, value)', l: 'Node’s error-first callback convention, which <code>util.promisify</code> converts to promises' }
    ]
  },
  intro: {
    what: 'Many operations take time: reading a file, calling an API, querying a database. Node doesn’t wait for them; it starts them and moves on. You need a way to say what happens <b>when the result arrives</b>. First Node used <b>callbacks</b> (pass a function to call later). Then <b>promises</b> (an object representing the future result). Now mostly <b>async/await</b>, which is promise code written to look like normal step-by-step code.',
    analogy: { icon: '🧾', title: 'A restaurant pager', text: 'A <b>callback</b> is leaving your phone number: “call me when it’s ready”. A <b>promise</b> is the buzzer they hand you: you can hold it, pass it around, or wait on several at once. It buzzes exactly once, either “ready” or “sorry, sold out”. <b>await</b> is standing still until your buzzer goes off. Ordering three dishes and then waiting on all three buzzers is <code>Promise.all</code>.' },
    steps: [
      { t: 'Callbacks', d: 'Error first, result second. Nesting gets deep fast.', code: "fs.readFile('a.json', 'utf8', (err, text) => {\n  if (err) return handle(err);\n  console.log(JSON.parse(text));\n});" },
      { t: 'Promises', d: 'The function returns a promise; chain <code>.then</code> and <code>.catch</code>.', code: "fsp.readFile('a.json', 'utf8')\n  .then((text) => JSON.parse(text))\n  .catch(handle);" },
      { t: 'async/await', d: 'Same promise, read top to bottom; errors are caught with try/catch.', code: "async function load() {\n  try {\n    return JSON.parse(await fsp.readFile('a.json', 'utf8'));\n  } catch (err) { handle(err); }\n}" },
      { t: 'Run things in parallel', d: 'Start every independent call, then await them together.', code: "const [user, orders] = await Promise.all([getUser(id), getOrders(id)]);" }
    ],
    terms: [
      ['callback', 'A function you pass in, to be called later with the result.'],
      ['promise', 'An object for a future result; it settles once.'],
      ['fulfilled / rejected', 'The two ways a promise settles: with a value, or with an error.'],
      ['await', 'Pause this async function until the promise settles.'],
      ['async function', 'A function that always returns a promise and may use <code>await</code>.'],
      ['combinator', 'A helper that combines promises: all, allSettled, race, any.']
    ]
  },
  visual: {
    title: 'Sequential awaits vs the four combinators',
    caption: 'Pick a strategy and which calls fail, then press Play. Bars grow as the calls run; the dot on the <b>result</b> row is when your code gets an answer. Notice that calls keep running after <code>all</code> or <code>race</code> has already decided.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'Sequential vs parallel', code: `const sleep = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));\nconst getUser = () => sleep(100, 'user');\nconst getOrders = () => sleep(100, 'orders');\nconst getPrefs = () => sleep(100, 'prefs');\n\nlet t = performance.now();\nawait getUser(); await getOrders(); await getPrefs();\nconsole.log('sequential', Math.round(performance.now() - t), 'ms');\n\nt = performance.now();\nawait Promise.all([getUser(), getOrders(), getPrefs()]);\nconsole.log('parallel  ', Math.round(performance.now() - t), 'ms');`, note: 'Top-level await works here. In a Node CommonJS file, wrap this in an async function. Node-only APIs (process.nextTick, setImmediate, fs) are covered in the puzzles.' },
      { label: 'The four combinators', code: `const sleep = (ms, v, fail) => new Promise((res, rej) =>\n  setTimeout(() => (fail ? rej(new Error(v)) : res(v)), ms));\nconst jobs = () => [sleep(300, 'A'), sleep(100, 'B', true), sleep(200, 'C')];\n\nconsole.log('all       ', await Promise.all(jobs()).catch((e) => 'rejected: ' + e.message));\nconsole.log('allSettled', (await Promise.allSettled(jobs())).map((r) => r.status + ':' + (r.value ?? r.reason.message)).join(' '));\nconsole.log('race      ', await Promise.race(jobs()).catch((e) => 'rejected: ' + e.message));\nconsole.log('any       ', await Promise.any(jobs()));` },
      { label: 'Settles only once', code: `const p = new Promise((resolve, reject) => {\n  console.log('executor runs synchronously');\n  resolve(1);\n  reject(new Error('ignored'));\n  resolve(2);\n});\nconsole.log('after new Promise');\nconsole.log('value:', await p);` },
      { label: 'forEach doesn’t await', code: `const out = [];\n[3, 1, 2].forEach(async (n) => {\n  await new Promise((r) => setTimeout(r, n * 50));\n  out.push(n);\n});\nconsole.log('after forEach:', out.length);\n\nconst out2 = [];\nfor (const n of [3, 1, 2]) {\n  await new Promise((r) => setTimeout(r, n * 50));\n  out2.push(n);\n}\nconsole.log('for...of:', out2.join(','));\nconsole.log('later the forEach array is', out.join(','));`, note: '<code>forEach</code> ignores the promises its callback returns.' },
      { label: 'Promisify a callback API', code: `// a callback-style API (error first)\nfunction legacyGet(id, cb) {\n  setTimeout(() => (id > 0 ? cb(null, { id }) : cb(new Error('bad id'))), 50);\n}\n// what util.promisify does, by hand\nconst get = (id) => new Promise((resolve, reject) =>\n  legacyGet(id, (err, value) => (err ? reject(err) : resolve(value))));\n\nconsole.log(await get(7));\ntry { await get(-1); } catch (e) { console.log('caught:', e.message); }` }
    ]
  },
  gotchas: [
    { trap: 'Accidental serial awaits', code: `const user = await getUser(id);       // 120 ms\nconst orders = await getOrders(id);   // 150 ms, didn't need user\nconst recs = await getRecs(id);       // 200 ms\n// ≈ 470 ms instead of ≈ 200 ms`, why: 'Each <code>await</code> waits before the next call even <b>starts</b>.', fix: 'Start independent calls first, then await together: <code>await Promise.all([getUser(id), getOrders(id), getRecs(id)])</code>. Keep sequential awaits only for real data dependencies.' },
    { trap: 'forEach with an async callback', code: `items.forEach(async (it) => { await save(it); });\nconsole.log('saved!');   // nothing is saved yet; errors are unhandled`, why: '<code>forEach</code> ignores the returned promises. You don’t wait, and rejections go unhandled (which crashes Node 15+).', fix: '<code>for (const it of items) await save(it)</code> for sequential, or <code>await Promise.all(items.map(save))</code> for parallel (bounded, if the list is large).' },
    { trap: 'Unbounded Promise.all over a big list', code: `await Promise.all(userIds.map((id) => fetch(\`/api/users/\${id}\`)));\n// 20,000 requests at once: sockets, memory, rate limits`, why: 'Every call starts at once. You can exhaust a connection pool, hit 429s, or run out of memory.', fix: 'Limit concurrency: process in chunks, use a small pool helper (see the code tab) or a library such as p-limit.' },
    { trap: 'Promise.all hides what succeeded', why: 'It rejects on the first failure and drops the other results, while the other calls <b>keep running</b> (promises aren’t cancellable).', fix: 'Use <code>allSettled</code> when partial results are acceptable. Pass an <code>AbortSignal</code> to stop the others when one fails. See <a href="async-errors.html">Async error handling</a>.' },
    { trap: 'Callbacks that fire twice, or sometimes synchronously', code: `function getConfig(cb) {\n  if (cache) return cb(null, cache);   // sync!\n  fs.readFile(path, (err, d) => { if (err) cb(err); cb(null, parse(d)); });  // twice on error\n}`, why: 'A callback that is sometimes synchronous (“releasing Zalgo”) makes ordering unpredictable; a missing <code>return</code> calls it twice.', fix: 'Always call back asynchronously (<code>process.nextTick(cb, null, cache)</code>), <code>return cb(err)</code>, or just return a promise: promises call handlers once and always asynchronously.' },
    { trap: 'Mixing callbacks and promises in one function', code: `async function handler(req, res) {\n  db.query(sql, (err, rows) => {\n    if (err) throw err;   // escapes the async function: not caught by its caller\n    res.json(rows);\n  });\n}`, why: 'A throw inside a callback happens later, on a different stack. The async function has already returned a fulfilled promise.', fix: 'Use the promise API (<code>await db.query(sql)</code>) or promisify, so errors flow into the async function’s promise.' }
  ],
  scenarios: [
    { title: 'Product page p50 is 900 ms for no obvious reason',
      symptom: 'Each backend dependency answers in 150–250 ms, but the BFF endpoint takes 900 ms at p50.',
      diagnose: `// the handler, simplified\nconst product = await catalog.get(id);\nconst price = await pricing.get(id);\nconst stock = await inventory.get(id);\nconst reviews = await reviews.top(id);\n// tracing shows four spans one after another`,
      cause: 'Four independent calls awaited one after another, so latency adds up.',
      fix: 'Start them together and await once. If reviews are optional, use <code>allSettled</code> and degrade gracefully.',
      fixCode: `const [product, price, stock, rev] = await Promise.allSettled([\n  catalog.get(id), pricing.get(id), inventory.get(id), reviews.top(id),\n]);\nif (product.status === 'rejected') throw product.reason;      // required\nreturn {\n  ...product.value,\n  price: price.status === 'fulfilled' ? price.value : null,\n  stock: stock.status === 'fulfilled' ? stock.value : null,\n  reviews: rev.status === 'fulfilled' ? rev.value : [],\n};`, lang: 'ts' },
    { title: 'Nightly import knocks over the partner API',
      symptom: 'The partner starts returning 429 and then 503 a few seconds into the nightly import; our DB pool also reports timeouts.',
      diagnose: `await Promise.all(rows.map(async (r) => {\n  const enriched = await partner.lookup(r.sku);   // 50k calls at once\n  await db.upsert(enriched);\n}));`,
      cause: '<code>map</code> starts all 50,000 calls in the same tick. Nothing limits concurrency, so the partner’s rate limit and our pool are both overwhelmed.',
      fix: 'Bound concurrency (for example 8–16 in flight), add retry with backoff for 429, and stream the input instead of loading everything.',
      fixCode: `import pLimit from 'p-limit';\nconst limit = pLimit(10);\nawait Promise.all(rows.map((r) => limit(async () => {\n  const enriched = await partner.lookup(r.sku);\n  await db.upsert(enriched);\n})));`, lang: 'ts' },
    { title: 'Webhook handler sometimes charges twice',
      symptom: 'Rarely, a payment provider webhook leads to two charges. Logs show the callback ran twice for one event.',
      diagnose: `verifySignature(req, (err) => {\n  if (err) res.status(400).end();   // missing return\n  chargeCustomer(event, () => res.end());\n});`,
      cause: 'On the error path, the callback continues after responding. And on a retry the provider resends the same event while the first is still in progress.',
      fix: 'Return after handling errors, move to a promise API so each step runs once, and make the charge idempotent on the event id.',
      fixCode: `app.post('/webhook', async (req, res) => {\n  if (!(await verifySignature(req))) return res.status(400).end();\n  await charges.createOnce({ idempotencyKey: req.body.id, ...req.body });\n  res.end();\n});`, lang: 'ts' }
  ],
  puzzles: [
    { kind: 'predict', q: 'When does the executor run? What prints?', code: `console.log('1');\nconst p = new Promise((resolve) => {\n  console.log('2');\n  resolve('3');\n  console.log('4');\n});\np.then((v) => console.log(v));\nconsole.log('5');`, options: ['1 2 3 4 5', '1 2 4 5 3', '1 5 2 4 3', '1 2 4 3 5'], answer: 1, explain: 'The executor runs <b>synchronously</b> inside <code>new Promise</code>. <code>resolve</code> doesn’t stop it, so 4 prints. The <code>.then</code> handler is always a microtask, so 3 prints after the synchronous 5.', run: true, expect: '1\n2\n4\n5\n3' },
    { kind: 'predict', q: 'The four combinators with one fast failure. What prints?', code: `const sleep = (ms, v, fail) => new Promise((res, rej) =>\n  setTimeout(() => (fail ? rej(new Error(v)) : res(v)), ms));\n\n(async () => {\n  try {\n    await Promise.all([sleep(30, 'a'), sleep(10, 'b', true)]);\n  } catch (e) {\n    console.log('all:', e.message);\n  }\n  const r = await Promise.allSettled([sleep(30, 'a'), sleep(10, 'b', true)]);\n  console.log(r.map((x) => x.status).join(','));\n  console.log(await Promise.any([sleep(30, 'a'), sleep(10, 'b', true)]));\n  console.log(await Promise.race([sleep(30, 'a'), sleep(10, 'b', true)]).catch((e) => 'race: ' + e.message));\n})();`, options: ['all: b / fulfilled,rejected / a / race: b', 'all: b / fulfilled,rejected / b / a', 'a / fulfilled,rejected / a / race: b', 'all: b / rejected / a / a'], answer: 0, explain: '<code>all</code> rejects with the first failure. <code>allSettled</code> reports both outcomes in input order. <code>any</code> ignores the rejection and waits for the first fulfilment (a). <code>race</code> takes the first to settle, which is the rejection.', run: true, expect: 'all: b\nfulfilled,rejected\na\nrace: b' },
    { kind: 'predict', q: 'What prints?', code: `const out = [];\n[3, 1, 2].forEach(async (n) => {\n  await new Promise((r) => setTimeout(r, n * 20));\n  out.push(n);\n});\nconsole.log('done', out.length);\nsetTimeout(() => console.log('later', out.join(',')), 150);`, options: ['done 3, then later 3,1,2', 'done 0, then later 3,1,2', 'done 0, then later 1,2,3', 'done 3, then later 1,2,3'], answer: 2, explain: '<code>forEach</code> doesn’t wait for the async callbacks, so <code>done 0</code> prints first. The three run in parallel and finish in timer order (20, 40, 60 ms), so the array fills as 1, 2, 3.', run: true, expect: 'done 0\nlater 1,2,3' },
    { kind: 'predict', q: 'Rejections skip <code>then</code>s until a <code>catch</code>. What prints?', code: `Promise.reject(new Error('x'))\n  .then(() => console.log('a'))\n  .catch((e) => { console.log('b', e.message); return 'y'; })\n  .then((v) => console.log('c', v))\n  .finally(() => console.log('d'));`, options: ['a, b x, c y, d', 'b x, d', 'b x, c y, d', 'b x, c undefined, d'], answer: 2, explain: 'The first <code>then</code> has no rejection handler, so the rejection passes through. <code>catch</code> handles it and <b>returns</b> a value, which makes the chain fulfilled again with <code>\'y\'</code>. <code>finally</code> runs either way.', run: true, expect: 'b x\nc y\nd' },
    { kind: 'predict', q: 'What prints?', code: `const p = new Promise((resolve, reject) => {\n  resolve(1);\n  reject(new Error('ignored'));\n  resolve(2);\n});\np.then((v) => console.log('value', v), (e) => console.log('error', e.message));`, options: ['value 2', 'error ignored', 'value 1', 'value 1, then error ignored'], answer: 2, explain: 'A promise settles <b>once</b>. The first <code>resolve(1)</code> wins; later calls are silently ignored.', run: true, expect: 'value 1' },
    { kind: 'concept', q: 'Three independent calls that each take ~100 ms. Roughly how long does each version take?', code: `// A\nconst a = await f1(); const b = await f2(); const c = await f3();\n// B\nconst pa = f1(), pb = f2(), pc = f3();\nconst [a2, b2, c2] = [await pa, await pb, await pc];`, options: ['A ≈ 300 ms, B ≈ 300 ms', 'A ≈ 300 ms, B ≈ 100 ms', 'A ≈ 100 ms, B ≈ 100 ms', 'A ≈ 100 ms, B ≈ 300 ms'], answer: 1, explain: 'Work starts when you <b>call</b> the function. In B all three start before the first await, so they overlap. (B has a catch: if <code>pb</code> rejects while you are still awaiting <code>pa</code>, it can be reported as unhandled. <code>Promise.all</code> avoids that.)' },
    { kind: 'concept', q: 'Which of these <b>never settles</b>?', options: ['Promise.all([])', 'Promise.allSettled([])', 'Promise.race([])', 'Promise.any([])'], answer: 2, explain: '<code>all([])</code> and <code>allSettled([])</code> fulfil with <code>[]</code>. <code>any([])</code> rejects with an AggregateError. <code>race([])</code> has nobody to race, so it stays pending forever. Guard against empty lists.' },
    { kind: 'bug', q: 'What’s wrong with this callback API?', code: `function readConfig(cb) {\n  if (cache) return cb(null, cache);\n  fs.readFile('cfg.json', 'utf8', (err, txt) => {\n    if (err) cb(err);\n    cb(null, (cache = JSON.parse(txt)));\n  });\n}`, options: ['Nothing', 'It calls back synchronously on a cache hit, and twice on a read error', 'readFile must be awaited', 'Callbacks can’t be called with null'], answer: 1, explain: 'A cache hit calls <code>cb</code> synchronously while a miss calls it later: callers see different orderings. On error, the missing <code>return</code> calls <code>cb</code> again (and <code>JSON.parse(undefined)</code> throws). Use <code>process.nextTick(cb, null, cache)</code> and <code>return cb(err)</code>, or return a promise.' }
  ],
  interview: [
    { q: 'What are the states of a promise?', a: '<p><b>Pending</b>, then settled once: <b>fulfilled</b> (with a value) or <b>rejected</b> (with a reason). “Resolved” is broader: a promise resolved with another promise or thenable follows it and may still be pending. Handlers attached after settlement still run, always asynchronously as microtasks.</p>', lvl: 'core' },
    { q: 'Compare Promise.all, allSettled, race and any.', a: '<ul><li><b>all</b>: fulfils with all values in input order; rejects on the first rejection.</li><li><b>allSettled</b>: always fulfils with <code>{status, value|reason}</code> for each.</li><li><b>race</b>: settles like the first promise to settle, either way. Typical use: a timeout.</li><li><b>any</b>: fulfils with the first fulfilment; rejects with <code>AggregateError</code> only if all reject.</li></ul><p>None of them cancels the losers.</p>', lvl: 'core' },
    { q: 'How do you convert a callback API to promises?', a: '<p><code>util.promisify(fn)</code> for error-first callbacks; many core modules already have promise versions (<code>node:fs/promises</code>, <code>node:timers/promises</code>, <code>node:dns/promises</code>, <code>stream/promises</code>), and <code>events.once(emitter, \'name\')</code> turns an event into a promise. By hand: <code>new Promise((res, rej) =&gt; fn(args, (e, v) =&gt; e ? rej(e) : res(v)))</code>.</p>', lvl: 'core' },
    { q: 'What does async do to a function?', a: '<p>It always returns a promise. A returned value fulfils it; a thrown error (even before the first await) rejects it. The body runs synchronously until the first <code>await</code>. Each <code>await</code> suspends only this function; the thread goes on with other work.</p>', lvl: 'core' },
    { q: 'How would you run 10,000 tasks with at most 10 in flight?', a: '<p>A small worker pool: start 10 “workers”, each pulling the next item from a shared index until none are left, then <code>await Promise.all(workers)</code>. Or use p-limit or a queue library. For streams, <code>Readable.from(items).map(fn, { concurrency: 10 })</code> (experimental stream helpers) does the same.</p>', fu: 'How do you stop early on the first error? (Shared AbortController; workers check signal.aborted.)', lvl: 'deep' },
    { q: 'Why can’t you cancel a promise?', a: '<p>A promise is a read-only view of a result; it has no handle on the work that produces it. Cancellation is passed <b>in</b> instead: an <code>AbortSignal</code> given to <code>fetch</code>, <code>timers/promises</code>, <code>events.once</code>, streams, or your own code. When aborted, the work stops and the promise rejects with an <code>AbortError</code>.</p>', lvl: 'core' },
    { q: 'What is “Zalgo”, and how do promises prevent it?', a: '<p>An API that calls its callback sometimes synchronously and sometimes asynchronously. Callers can’t reason about ordering (code after the call may run before or after the callback). Promise handlers always run asynchronously, so the order is always the same. For callback APIs, defer with <code>process.nextTick</code>.</p>', lvl: 'deep' },
    { q: 'Sequential or parallel: how do you decide?', a: '<p>Sequential when a call needs the previous result, when order matters (migrations), or when you must limit load. Parallel when calls are independent: total time becomes the slowest call. Bounded parallel for large lists. Write it so the dependency structure is visible in the code.</p>', lvl: 'core' },
    { q: 'How does this map to Java’s CompletableFuture?', a: '<p><code>then</code> ≈ <code>thenApply</code>/<code>thenCompose</code>, <code>catch</code> ≈ <code>exceptionally</code>, <code>Promise.all</code> ≈ <code>CompletableFuture.allOf</code> (but allOf gives you <code>Void</code>; you read each future afterwards), <code>race</code> ≈ <code>anyOf</code>. Java futures can be completed or cancelled from outside, and their stages may run on other threads; JS promises always run handlers on the one event-loop thread, as microtasks. With Java 21 virtual threads, plain blocking code often replaces future chains, the way <code>await</code> replaces <code>.then</code> chains in Node.</p>', lvl: 'core' },
    { q: 'What is a thenable?', a: '<p>Any object with a <code>then(resolve, reject)</code> method. <code>await</code>, <code>Promise.resolve</code> and the combinators accept thenables and adopt their result. That is how promise libraries interoperate, and why returning a thenable from an async function costs extra microtask turns.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Bounded parallelism without a library', lang: 'ts', code: `export async function mapLimit<T, R>(
  items: readonly T[], limit: number, fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;                 // safe: single-threaded, no await between read and increment
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;                       // input order, like Promise.all
}

// usage
const users = await mapLimit(ids, 10, (id) => api.getUser(id));`, note: 'Fail-fast like <code>Promise.all</code>: the first rejection rejects the whole call, while other workers finish their current item.' },
    { title: 'Core promise APIs you should know', lang: 'ts', code: `import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { once } from 'node:events';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const cfg = JSON.parse(await readFile('cfg.json', 'utf8'));
await sleep(250);                                      // promise-based timer
const [conn] = await once(server, 'connection');       // event → promise
await pipeline(src, gzip, dest);                       // stream → promise
const run = promisify(execFile);                       // (err, value) callbacks → promise
const { stdout } = await run('git', ['rev-parse', 'HEAD']);` },
    { title: 'Java comparison: CompletableFuture', lang: 'java', code: `CompletableFuture<User> user = CompletableFuture.supplyAsync(() -> users.get(id), pool);
CompletableFuture<List<Order>> orders = CompletableFuture.supplyAsync(() -> orderRepo.find(id), pool);

// ≈ Promise.all: wait for both, then read each
CompletableFuture.allOf(user, orders).join();
Page page = new Page(user.join(), orders.join());

// ≈ Promise.race
Object first = CompletableFuture.anyOf(primary, replica).join();

// Java 21 virtual threads: blocking style, still concurrent
try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
    Future<User> u = exec.submit(() -> users.get(id));
    Future<List<Order>> o = exec.submit(() -> orderRepo.find(id));
    return new Page(u.get(), o.get());
}`, note: 'The shape is the same: start independent work first, then wait. In Node “start” is calling an async function; in Java it is submitting to an executor.' }
  ]
});

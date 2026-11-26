IA.register({
  track: 'nodejs',
  slug: 'js-objects-arrays',
  title: 'Objects & arrays',
  tagline: 'Most JavaScript data is <b>plain objects and arrays</b>: no classes, no getters, just <code>{ }</code> and <code>[ ]</code>. Build them with literals, unpack them with destructuring, copy them with spread, transform them with <code>map</code>/<code>filter</code>/<code>reduce</code>, and ship them as JSON.',
  tldr: {
    problem: 'Java developers reach for a DTO class, a builder and a Stream. In JavaScript the same job is a literal and three chained array methods. The traps are elsewhere: shallow copies, a <code>sort()</code> that sorts numbers as strings, and JSON that silently drops fields.',
    model: 'An object is a <b>map from string keys to values</b>; an array is an object with numbered keys and a <code>length</code>. Both are references. <code>map</code>/<code>filter</code>/<code>reduce</code> return <b>new</b> arrays (eagerly), while <code>sort</code>, <code>push</code> and <code>splice</code> <b>mutate</b>.',
    hook: '“Why does <code>[10, 1, 2].sort()</code> return <code>[1, 10, 2]</code>?” With no comparator, sort compares elements as strings. Pass <code>(a, b) =&gt; a - b</code>.',
    facts: [
      { v: 'shallow', l: 'is what <code>{ ...obj }</code> and <code>[...arr]</code> copy. Use <code>structuredClone</code> (Node 17+) for a deep copy' },
      { v: 'eager', l: 'array methods build a full new array at each step, unlike lazy Java Streams' },
      { v: 'dropped', l: 'by <code>JSON.stringify</code>: <code>undefined</code> and function values. Dates become ISO strings and never come back as Dates' }
    ]
  },
  intro: {
    what: 'An <b>object</b> groups named values: <code>{ name: \'Ada\', age: 36 }</code>. You read a value with <code>user.name</code> or <code>user[\'name\']</code>. An <b>array</b> is an ordered list: <code>[1, 2, 3]</code>, read with <code>list[0]</code>. Together they are how JavaScript represents almost all data, including the JSON a REST API sends and receives.',
    analogy: { icon: '🧾', title: 'Forms and stacks of forms', text: 'An object is a filled-in form: labels on the left, answers on the right. An array is a numbered stack of forms. <code>filter</code> pulls out some forms, <code>map</code> copies one answer off each, and <code>reduce</code> adds them up on a calculator.' },
    steps: [
      { t: 'Literals', d: 'No class or constructor needed. Shorthand <code>{ id }</code> means <code>{ id: id }</code>.', code: "const id = 7;\nconst user = { id, name: 'Ada', tags: ['admin'] };\nuser.email = 'ada@example.com';   // add a property any time\nconsole.log(user.name, user.tags[0], user.missing);  // Ada admin undefined" },
      { t: 'Destructuring', d: 'Unpack by name (objects) or position (arrays), with defaults.', code: "const { name, role = 'user' } = user;\nconst [first, second] = ['a', 'b', 'c'];\nfunction show({ id, name }) { return `${id}:${name}`; }" },
      { t: 'Spread for copies', d: 'Build new objects instead of mutating shared ones.', code: "const updated = { ...user, name: 'Ada L.' };\nconst more = [...user.tags, 'ops'];" },
      { t: 'map / filter / reduce', d: 'The everyday Stream API. They never change the original array.', code: "const prices = [12, 5, 30];\nprices.map((p) => p * 1.2);          // add VAT\nprices.filter((p) => p > 10);        // [12, 30]\nprices.reduce((s, p) => s + p, 0);   // 47" },
      { t: 'JSON', d: 'The text format for APIs and files. <code>stringify</code> to send, <code>parse</code> to receive.', code: "const text = JSON.stringify({ id: 1, ok: true });  // '{\"id\":1,\"ok\":true}'\nconst obj = JSON.parse(text);" }
    ],
    terms: [
      ['object literal', '<code>{ key: value }</code> written directly in code. Creates a plain object.'],
      ['property', 'A key–value pair on an object. Access with <code>.key</code> or <code>[\'key\']</code>.'],
      ['destructuring', 'Unpacking properties or elements into variables: <code>const { a } = obj</code>.'],
      ['spread', '<code>...x</code> inside a literal: copy all of x’s entries into the new object or array.'],
      ['callback', 'The arrow you pass to <code>map</code>/<code>filter</code>: called once per element.'],
      ['JSON', 'JavaScript Object Notation: a text format of objects, arrays, strings, numbers, booleans and null.']
    ]
  },
  visual: {
    title: 'Watch data flow through a pipeline',
    caption: 'Choose an example and Step. Each row is a new value created by the line highlighted on the left. Original rows never change: every step makes a new array or object. Orange means “careful”, red means “lost or failed”.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'Pipeline', code: "const orders = [\n  { id: 1, customer: 'Ada', amt: 30, paid: true },\n  { id: 2, customer: 'Ben', amt: 15, paid: false },\n  { id: 3, customer: 'Ada', amt: 50, paid: true },\n  { id: 4, customer: 'Chen', amt: 5, paid: true },\n];\nconst paid = orders.filter((o) => o.paid);\nconsole.log('total', paid.map((o) => o.amt).reduce((s, a) => s + a, 0));\n\n// group by customer (like Collectors.groupingBy)\nconst byCustomer = Object.groupBy(paid, (o) => o.customer);\nconsole.log(Object.keys(byCustomer), byCustomer.Ada.length);\nconsole.log(orders.find((o) => o.amt > 20)?.id, orders.some((o) => !o.paid), orders.every((o) => o.amt > 0));", note: '<code>Object.groupBy</code> is in Node 21+ and current browsers.' },
      { label: 'Destructure & spread', code: "const user = { id: 7, name: 'Ada', address: { city: 'Oslo' } };\nconst { name, ...rest } = user;\nconsole.log(name, rest);\n\nconst copy = { ...user, name: 'Bob' };\ncopy.address.city = 'Pune';          // nested object is shared!\nconsole.log(user.name, user.address.city);\n\nconst deep = structuredClone(user);\ndeep.address.city = 'Rome';\nconsole.log(user.address.city, deep.address.city);" },
      { label: 'sort surprises', code: "const nums = [10, 1, 2, 25];\nconsole.log([...nums].sort());                  // as strings!\nconsole.log([...nums].sort((a, b) => a - b));   // numeric\nconst sorted = nums.toSorted((a, b) => b - a);  // copy (Node 20+)\nconsole.log(sorted, nums);\n\nconst people = [{ n: 'Cy', age: 30 }, { n: 'Al', age: 25 }];\nconsole.log(people.sort((a, b) => a.n.localeCompare(b.n)).map((p) => p.n));" },
      { label: 'JSON round trip', code: "const order = { id: 1, at: new Date('2025-01-01T00:00:00Z'), note: undefined, total: NaN, items: [{ sku: 'A' }] };\nconst text = JSON.stringify(order);\nconsole.log(text);\nconst back = JSON.parse(text);\nconsole.log(typeof back.at, 'note' in back, back.total);\nconsole.log(JSON.stringify(order, null, 2).split('\\n').length, 'lines when pretty-printed');\ntry { JSON.parse('{ id: 1 }'); } catch (e) { console.log(e.name); }\ntry { JSON.stringify({ big: 1n }); } catch (e) { console.log(e.name, '- BigInt is not JSON'); }" },
      { label: 'Map vs object', code: "const counts = new Map();\nfor (const w of 'the cat and the hat'.split(' ')) {\n  counts.set(w, (counts.get(w) ?? 0) + 1);\n}\nconsole.log(counts.get('the'), counts.size, [...counts.keys()]);\n\nconst obj = {};\nobj[1] = 'one'; obj['1'] = 'uno';     // object keys become strings\nconsole.log(Object.keys(obj));\nconst m = new Map([[1, 'one'], ['1', 'uno']]);\nconsole.log(m.size);                  // Map keeps 1 and '1' apart" }
    ]
  },
  gotchas: [
    { trap: '<code>sort()</code> without a comparator sorts as strings', code: "[10, 1, 2].sort()               // [1, 10, 2]\n[10, 1, 2].sort((a, b) => a - b)  // [1, 2, 10]", why: 'The default comparison converts elements to strings and compares UTF-16 code units. It also sorts <b>in place</b> and returns the same array.', fix: 'Always pass a comparator for numbers. Use <code>toSorted</code> (Node 20+) or <code>[...arr].sort()</code> when you must not mutate.' },
    { trap: 'Spread is a shallow copy', code: "const copy = { ...user };\ncopy.address.city = 'Pune';   // also changes user.address", why: 'Only the top level is copied. Nested objects are the same references.', fix: '<code>structuredClone(obj)</code> for a deep copy, or spread each level you change: <code>{ ...user, address: { ...user.address, city } }</code>.' },
    { trap: '<code>map(parseInt)</code>', code: "['1', '2', '3'].map(parseInt)  // [1, NaN, NaN]", why: '<code>map</code> passes <code>(value, index, array)</code>, so parseInt receives the index as its radix.', fix: 'Write the arrow out: <code>.map((s) =&gt; Number(s))</code> or <code>.map(Number)</code>.' },
    { trap: 'JSON loses types silently', code: "JSON.stringify({ at: new Date(), x: undefined, f() {} })\n// '{\"at\":\"2025-…Z\"}'", why: 'JSON has no Date, undefined or function. Dates become strings; undefined and functions are dropped from objects (and become <code>null</code> in arrays). BigInt throws.', fix: 'Convert explicitly on the way in (<code>new Date(s)</code>), and validate parsed input with a schema library (zod, ajv).' },
    { trap: '<code>forEach</code> with async callbacks', code: "ids.forEach(async (id) => await save(id));\nconsole.log('done');   // printed before any save finishes", why: '<code>forEach</code> ignores the promises the callback returns.', fix: '<code>for (const id of ids) await save(id)</code> for one at a time, or <code>await Promise.all(ids.map(save))</code> in parallel. See <a href="js-async-basics.html">Async basics</a>.' },
    { trap: 'Comparing objects with <code>===</code>', code: "{ a: 1 } === { a: 1 }   // false\n[1, 2] === [1, 2]       // false", why: '<code>===</code> on objects compares references, like Java <code>==</code>. There is no built-in <code>equals()</code>.', fix: 'Compare the fields you care about, or use <code>util.isDeepStrictEqual(a, b)</code> in Node (and <code>assert.deepStrictEqual</code> in tests).' }
  ],
  scenarios: [
    { title: 'Shared default config mutated by one tenant', symptom: 'After tenant A changes its timeout, other tenants start timing out at the same value.', diagnose: 'The code does <code>const cfg = { ...DEFAULTS }; cfg.http.timeout = t;</code>. Logging <code>DEFAULTS.http.timeout</code> shows it changed.', cause: 'Spread copied only the top level. <code>cfg.http</code> and <code>DEFAULTS.http</code> are the same object.', fix: 'Deep-copy defaults per tenant, and freeze the shared defaults so a mutation throws in strict mode.', fixCode: "const DEFAULTS = Object.freeze({ http: Object.freeze({ timeout: 5000 }) });\nconst cfg = structuredClone(DEFAULTS);\ncfg.http.timeout = t;   // only this tenant's copy" },
    { title: 'Event-loop stalls on a large export', symptom: 'p99 latency spikes to seconds whenever someone downloads the monthly report.', diagnose: 'A CPU profile shows most time in <code>JSON.stringify</code> on a 200 MB array, built with several chained <code>map</code>/<code>filter</code> steps.', cause: 'Each array step allocates a full new array, and stringify is synchronous. The single thread can’t serve other requests meanwhile.', fix: 'Stream rows out in chunks, and combine steps into one loop. See <a href="blocking-event-loop.html">Blocking the event loop</a> and <a href="streams-backpressure.html">Streams</a>.', fixCode: "res.write('[');\nlet first = true;\nfor await (const row of db.cursor(sql)) {\n  if (!row.paid) continue;\n  res.write((first ? '' : ',') + JSON.stringify({ id: row.id, amt: row.amt }));\n  first = false;\n}\nres.end(']');" }
  ],
  puzzles: [
    { kind: 'predict', q: 'Default sort. What prints?', code: "const a = [3, 1, 10, 2];\na.sort();\nconsole.log(a);", options: ['[ 1, 2, 3, 10 ]', '[ 1, 10, 2, 3 ]', '[ 10, 3, 2, 1 ]', '[ 3, 1, 10, 2 ]'], answer: 1, explain: 'Without a comparator, elements are compared as strings: \'1\' &lt; \'10\' &lt; \'2\' &lt; \'3\'. And <code>sort</code> mutates <code>a</code> in place.', run: true, expect: '[ 1, 10, 2, 3 ]' },
    { kind: 'predict', q: 'Shallow copy. What prints?', code: "const u = { name: 'Ada', addr: { city: 'Oslo' } };\nconst c = { ...u };\nc.name = 'Bob';\nc.addr.city = 'Pune';\nconsole.log(u.name, u.addr.city);", options: ['Ada Oslo', 'Bob Pune', 'Ada Pune', 'Bob Oslo'], answer: 2, explain: '<code>name</code> was copied as a value, so the original keeps \'Ada\'. <code>addr</code> was copied as a reference, so both objects share it.', run: true, expect: 'Ada Pune' },
    { kind: 'predict', q: 'What does JSON keep?', code: "console.log(JSON.stringify({ a: undefined, b: null, c: () => 1, d: [undefined], e: NaN }));", options: ['{"a":undefined,"b":null,"d":[undefined],"e":NaN}', '{"b":null,"d":[null],"e":null}', '{"b":null,"d":[],"e":null}', '{"a":null,"b":null,"c":null,"d":[null],"e":null}'], answer: 1, explain: 'Properties whose value is undefined or a function are left out. Inside arrays they become <code>null</code> to keep positions. <code>NaN</code> and <code>Infinity</code> become <code>null</code>.', run: true, expect: '{"b":null,"d":[null],"e":null}' },
    { kind: 'predict', q: 'A pipeline. What prints?', code: "const r = [1, 2, 3, 4]\n  .filter((n) => n % 2 === 0)\n  .map((n) => n * 10)\n  .reduce((s, n) => s + n, 0);\nconsole.log(r);", options: ['100', '60', '40', '[ 20, 40 ]'], answer: 1, explain: 'filter → [2, 4], map → [20, 40], reduce → 0 + 20 + 40 = <b>60</b>.', run: true, expect: '60' },
    { kind: 'predict', q: 'Destructuring defaults. What prints?', code: "const { a = 1, b = 2 } = { a: null, b: undefined };\nconsole.log(a, b);", options: ['1 2', 'null 2', 'null undefined', '1 undefined'], answer: 1, explain: 'Like default parameters, destructuring defaults apply only to <code>undefined</code>. <code>null</code> is kept.', run: true, expect: 'null 2' },
    { kind: 'predict', q: 'The parseInt trap. What prints?', code: "console.log(['1', '2', '3'].map(parseInt));", options: ['[ 1, 2, 3 ]', '[ 1, NaN, NaN ]', '[ NaN, NaN, NaN ]', "[ '1', '2', '3' ]"], answer: 1, explain: 'map calls <code>parseInt(\'1\', 0)</code> → 1 (radix 0 means default), <code>parseInt(\'2\', 1)</code> → NaN (radix 1 is invalid), <code>parseInt(\'3\', 2)</code> → NaN (3 isn’t a binary digit).', run: true, expect: '[ 1, NaN, NaN ]' },
    { kind: 'predict', q: 'Array odds and ends. What prints?', code: "const arr = [1, 2, 3];\narr.length = 1;\nconsole.log(arr, [NaN].indexOf(NaN), [NaN].includes(NaN));", options: ['[ 1, 2, 3 ] -1 false', '[ 1 ] -1 true', '[ 1 ] 0 true', '[ 1 ] -1 false'], answer: 1, explain: 'Setting <code>length</code> truncates the array. <code>indexOf</code> uses <code>===</code>, and NaN !== NaN, so it returns -1. <code>includes</code> uses SameValueZero, which treats NaN as equal to itself.', run: true, expect: '[ 1 ] -1 true' }
  ],
  interview: [
    { q: 'How do you copy an object or array, shallow and deep?', a: '<p>Shallow: <code>{ ...obj }</code>, <code>Object.assign({}, obj)</code>, <code>[...arr]</code>, <code>arr.slice()</code>. Deep: <code>structuredClone(obj)</code> (Node 17+), which handles nested objects, arrays, Map, Set, Date and cycles, but throws on functions. <code>JSON.parse(JSON.stringify(x))</code> is an old trick that loses Dates, undefined and more.</p>', lvl: 'core' },
    { q: 'map vs forEach vs reduce?', a: '<p><code>map</code> returns a new array of the same length with each element transformed. <code>forEach</code> returns nothing; use it for side effects only. <code>reduce</code> folds the array into one value (a sum, an object, a Map). Pass an initial value to reduce: without one, an empty array throws a TypeError.</p>', lvl: 'core' },
    { q: 'Which array methods mutate the array?', a: '<p>Mutating: <code>push</code>, <code>pop</code>, <code>shift</code>, <code>unshift</code>, <code>splice</code>, <code>sort</code>, <code>reverse</code>, <code>fill</code>. Non-mutating: <code>map</code>, <code>filter</code>, <code>slice</code>, <code>concat</code>, <code>flat</code>, and the Node 20+ copies <code>toSorted</code>, <code>toReversed</code>, <code>toSpliced</code>, <code>with</code>.</p>', lvl: 'core' },
    { q: 'How do JavaScript array methods differ from Java Streams?', a: '<p>Array methods are eager: each call loops over the whole array and allocates a new one. Java Streams are lazy and fused into one pass, with short-circuiting. For huge data in JavaScript, use a single loop, or iterator helpers (<code>Iterator.prototype.map</code>, available in Node 22) for lazy chains.</p>', lvl: 'deep' },
    { q: 'What does destructuring give you in function parameters?', a: '<p>Named arguments with defaults: <code>function connect({ host = \'localhost\', port = 5432 } = {}) {…}</code>. Callers pass an options object, and the order of fields doesn’t matter. It is the common replacement for Java builders.</p>', lvl: 'core' },
    { q: 'What are the limits of JSON.stringify?', a: '<ul><li>Dates become ISO strings and don’t come back as Dates.</li><li><code>undefined</code>, functions and symbols are dropped (or become null in arrays).</li><li><code>NaN</code>/<code>Infinity</code> → <code>null</code>.</li><li>BigInt throws a TypeError; circular references throw too.</li><li>Map and Set serialise as <code>{}</code>.</li></ul><p>A <code>toJSON()</code> method or a replacer function customises the output.</p>', lvl: 'core' },
    { q: 'Object or Map?', a: '<p>Use a plain object for records with known fields (DTOs, JSON). Use <code>Map</code> for dictionaries: any key type (not just strings), insertion order, a <code>size</code>, no inherited keys like <code>__proto__</code> or <code>constructor</code>, and better performance with frequent adds and deletes.</p>', lvl: 'core' },
    { q: 'How do you safely read deeply nested optional data?', a: '<p>Optional chaining and nullish coalescing: <code>order?.customer?.address?.city ?? \'unknown\'</code>. <code>?.</code> stops and returns <code>undefined</code> as soon as a link is null or undefined, instead of throwing a TypeError.</p>', lvl: 'core' },
    { q: 'How do you compare two objects for equality?', a: '<p><code>===</code> only says whether they are the same object. For structural equality, use <code>util.isDeepStrictEqual</code> in Node, <code>assert.deepStrictEqual</code> in tests, or compare specific fields. There is no <code>equals</code>/<code>hashCode</code> protocol, which is also why a Map can’t use an object as a value-based key.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Typical service code', lang: 'js', code: `// request body → validated DTO → response
function toOrderDto({ id, items = [], customer: { name } = {} }) {
  const lines = items
    .filter((i) => i.qty > 0)
    .map(({ sku, qty, priceCents }) => ({ sku, qty, totalCents: qty * priceCents }));
  return {
    id: String(id),                         // 64-bit ids as strings
    customer: name ?? 'guest',
    lines,
    totalCents: lines.reduce((s, l) => s + l.totalCents, 0),
  };
}

const dto = toOrderDto(JSON.parse(body));
res.end(JSON.stringify(dto));` },
    { title: 'Java equivalent', lang: 'java', code: `record Line(String sku, int qty, long totalCents) {}
record OrderDto(String id, String customer, List<Line> lines, long totalCents) {}

static OrderDto toOrderDto(Order o) {
    List<Line> lines = o.items().stream()
        .filter(i -> i.qty() > 0)
        .map(i -> new Line(i.sku(), i.qty(), (long) i.qty() * i.priceCents()))
        .toList();
    String customer = o.customer() != null ? o.customer().name() : "guest";
    long total = lines.stream().mapToLong(Line::totalCents).sum();
    return new OrderDto(String.valueOf(o.id()), customer, lines, total);
}
// Jackson does the JSON parse/serialise and the Date handling for you`, note: 'Java needs two record types; JavaScript builds the same shape with literals. TypeScript can add the types back as interfaces.' },
    { title: 'Immutable updates', lang: 'js', code: `const state = { user: { name: 'Ada', roles: ['dev'] }, version: 1 };

// change one nested field without touching the original
const next = {
  ...state,
  version: state.version + 1,
  user: { ...state.user, roles: [...state.user.roles, 'admin'] },
};

console.log(state.user.roles);   // [ 'dev' ]
console.log(next.user.roles);    // [ 'dev', 'admin' ]
console.log(state.user === next.user);  // false: copied where changed` }
  ]
});

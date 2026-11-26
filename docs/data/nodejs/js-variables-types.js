IA.register({
  track: 'nodejs',
  slug: 'js-variables-types',
  title: 'Variables & types',
  tagline: 'JavaScript has <b>types on values, not on variables</b>. Declare with <code>const</code> (or <code>let</code>), know the seven primitives, remember objects are shared by reference, and compare with <code>===</code>.',
  tldr: {
    problem: 'A Java developer expects the compiler to stop <code>"1" + 1</code> or a reassigned constant. In JavaScript both run. One gives <code>"11"</code>, the other throws only when that line executes.',
    model: 'A variable is a name holding either a <b>primitive</b> (copied on assignment) or a <b>reference</b> to an object (the arrow is copied, the object is shared). Same as Java’s <code>int</code> vs <code>Object</code>, except any variable can hold any type.',
    hook: '“What’s the difference between <code>==</code> and <code>===</code>?” <code>===</code> compares type and value. <code>==</code> converts types first, so <code>0 == \'\'</code> is true. Always use <code>===</code>; the one common exception is <code>x == null</code>.',
    facts: [
      { v: '7', l: 'primitive types: number, string, boolean, undefined, null, bigint, symbol. Everything else is an object' },
      { v: '2⁵³−1', l: '<code>Number.MAX_SAFE_INTEGER</code>. Every number is a 64-bit double, like Java <code>double</code>' },
      { v: "'object'", l: 'is <code>typeof null</code>: a bug from the first version of JavaScript that can’t be fixed' }
    ]
  },
  intro: {
    what: 'In Java you write <code>int count = 0;</code>. In JavaScript you write <code>let count = 0;</code>. There’s no type in the declaration: the <b>value</b> carries the type, and the same variable could later hold a string. <code>const</code> is a variable you can’t reassign, and it is what you use most of the time.',
    analogy: { icon: '🏷️', title: 'Labels, not boxes', text: 'A variable is a label stuck on a value. For a number, the label sits on its own copy. For an object, many labels can be stuck on the <i>same</i> object, so a change through one label is visible through all of them.' },
    steps: [
      { t: 'Declare', d: '<code>const</code> by default; <code>let</code> when you will reassign. Avoid <code>var</code>.', code: "const name = 'Ada';   // like final String name\nlet count = 0;        // like int count\ncount += 1;" },
      { t: 'Know the types', d: 'Primitives: <code>number</code> (all numbers), <code>string</code>, <code>boolean</code>, <code>undefined</code>, <code>null</code>, <code>bigint</code>, <code>symbol</code>. Arrays, functions, dates and maps are objects.', code: "typeof 3.14      // 'number'\ntypeof 'hi'      // 'string'\ntypeof [1, 2]    // 'object'\nArray.isArray([1, 2])  // true" },
      { t: 'Compare with ===', d: '<code>===</code> is strict: no type conversion. It’s like Java’s <code>==</code> for primitives. For objects, it compares references, just as Java’s <code>==</code> does.', code: "'1' === 1   // false\n'1' == 1    // true  (converted)\n[1] === [1] // false (two objects)" },
      { t: 'Two kinds of “nothing”', d: '<code>undefined</code> = never set (missing property, no return value). <code>null</code> = deliberately empty. <code>??</code> supplies a default for both.', code: "const user = {};\nuser.email           // undefined\nuser.email ?? 'n/a'  // 'n/a'" }
    ],
    terms: [
      ['primitive', 'An immutable value copied on assignment: number, string, boolean, undefined, null, bigint, symbol.'],
      ['reference', 'What a variable holds for an object: an arrow to it. Copying the variable copies the arrow.'],
      ['block scope', '<code>let</code>/<code>const</code> exist only inside the nearest <code>{ }</code>, like Java locals.'],
      ['coercion', 'Automatic type conversion, e.g. <code>\'3\' * 2</code> → 6. <code>==</code> and <code>+</code> do it.'],
      ['truthy / falsy', 'Falsy values: <code>false 0 -0 0n \'\' null undefined NaN</code>. Everything else (even <code>[]</code>, <code>\'0\'</code>) is truthy.']
    ]
  },
  visual: {
    title: 'Where values live',
    caption: 'Choose an example and Step through it. On the left, each variable shows its keyword and value. A dot with an arrow means it holds a reference to a heap object. The <b>typeof</b> and <b>== vs ===</b> tabs build a results table one line at a time.'
  },
  playground: {
    kind: 'js',
    presets: [
      { label: 'const vs let', code: "let count = 1;\ncount = 2;\nconsole.log('count', count);\n\nconst user = { name: 'Ada' };\nuser.name = 'Bob';          // allowed: mutating the object\nconsole.log('user', user);\n\ntry {\n  user = {};                // not allowed: reassigning a const\n} catch (e) {\n  console.log(e.name + ':', e.message);\n}", note: '<code>const</code> means “this name always points at the same thing”, not “this thing never changes”. <code>Object.freeze</code> makes the object itself read-only (shallowly).' },
      { label: 'Copy vs share', code: "let a = 10;\nlet b = a;\nb++;\nconsole.log(a, b);\n\nconst list = [1, 2];\nconst alias = list;\nconst copy = [...list];\nalias.push(3);\nconsole.log(list, alias, copy);\nconsole.log(list === alias, list === copy);" },
      { label: 'typeof table', code: "const values = [42, 3.5, 'hi', true, undefined, null, 10n, Symbol('id'), [1], { a: 1 }, () => 1, new Date(0)];\nfor (const v of values) {\n  console.log(String(typeof v).padEnd(10), Array.isArray(v) ? '(array)' : '', v === null ? '(null!)' : '');\n}" },
      { label: '== vs ===', code: "const pairs = [[1, '1'], [0, ''], [0, '0'], ['', '0'], [null, undefined], [null, 0], [NaN, NaN], [[], '']];\nconst show = (v) => typeof v === 'string' ? JSON.stringify(v) : Array.isArray(v) ? '[]' : String(v);\nfor (const [x, y] of pairs) {\n  console.log(show(x), 'vs', show(y), ' ==', x == y, ' ===', x === y);\n}", note: "Notice <code>0 == ''</code> and <code>0 == '0'</code> are both true, yet <code>'' == '0'</code> is false. <code>==</code> isn’t even transitive." },
      { label: 'Numbers are doubles', code: "console.log(0.1 + 0.2);\nconsole.log(7 / 2, Math.trunc(7 / 2));     // no integer division\nconsole.log(Number.MAX_SAFE_INTEGER);\nconsole.log(2 ** 53 === 2 ** 53 + 1);      // precision lost\nconsole.log(2n ** 64n);                    // bigint: exact\nconsole.log(Number('12px'), parseInt('12px', 10));" },
      { label: '?? vs ||', code: "const config = { retries: 0, name: '' };\nconsole.log('||', config.retries || 3, JSON.stringify(config.name || 'default'));\nconsole.log('??', config.retries ?? 3, JSON.stringify(config.name ?? 'default'));\nconsole.log('missing', config.timeout ?? 5000);\nconsole.log('optional chaining', config.db?.host);", note: '<code>||</code> replaces any falsy value, including a valid 0. <code>??</code> only replaces <code>null</code> and <code>undefined</code>.' }
    ]
  },
  gotchas: [
    { trap: '<code>const</code> doesn’t make an object immutable', code: "const cart = [];\ncart.push('book');   // fine\ncart = [];           // TypeError", why: '<code>const</code> protects the binding (the label), not the object, exactly like Java <code>final List&lt;String&gt;</code>.', fix: 'Use <code>Object.freeze(obj)</code> for a shallow read-only object, or just don’t mutate shared objects: copy with spread.' },
    { trap: '<code>+</code> with a string concatenates', code: "'5' + 3   // '53'\n'5' - 3   // 2\nform.age + 1  // '301' if age came from a form or query string", why: 'If either side of <code>+</code> is a string, the result is a string. The other arithmetic operators convert to numbers.', fix: 'Convert input explicitly: <code>Number(x)</code> (gives <code>NaN</code> if invalid) and check with <code>Number.isNaN</code>.' },
    { trap: '<code>||</code> for defaults eats valid zeros', code: "const port = opts.port || 3000;   // port 0 → 3000\nconst port2 = opts.port ?? 3000;  // only null/undefined → 3000", why: '<code>||</code> checks truthiness, and <code>0</code>, <code>\'\'</code> and <code>false</code> are falsy.', fix: 'Use <code>??</code> for defaults and <code>?.</code> for “maybe missing” property paths.' },
    { trap: 'Big IDs lose precision', code: "JSON.parse('{\"id\": 9007199254740993}').id\n// 9007199254740992", why: 'Numbers are doubles. Integers above 2⁵³−1 can’t all be represented, so a Java <code>long</code> ID can silently change.', fix: 'Send 64-bit IDs as strings in JSON, or use <code>BigInt</code> for arithmetic.' },
    { trap: '<code>typeof</code> can’t spot null or arrays', why: '<code>typeof null</code> and <code>typeof []</code> are both <code>\'object\'</code>.', fix: 'Use <code>x === null</code>, <code>Array.isArray(x)</code>, and <code>x == null</code> to test “null or undefined” in one go.' },
    { trap: '<code>var</code> leaks out of blocks', code: "for (var i = 0; i < 3; i++) {}\nconsole.log(i);  // 3\nfor (let j = 0; j < 3; j++) {}\nconsole.log(j);  // ReferenceError", why: '<code>var</code> is scoped to the whole function and is hoisted (it exists, as <code>undefined</code>, before its line).', fix: 'Never use <code>var</code>. ESLint’s <code>no-var</code> and <code>prefer-const</code> rules enforce it.' }
  ],
  scenarios: [
    { title: 'Discount applied as text', symptom: 'Order totals of <code>"1005"</code> appear in reports where 105 was expected.', diagnose: 'Log <code>typeof price</code> and <code>typeof fee</code>: one is a string read from a query parameter.', cause: '<code>price + fee</code> with one string operand concatenates.', fix: 'Parse and validate at the edge of the system, then work with numbers. In money code, use integer cents.', fixCode: "const fee = Number(req.query.fee);\nif (!Number.isFinite(fee)) throw new Error('fee must be a number');\nconst totalCents = priceCents + Math.round(fee * 100);" },
    { title: 'Order IDs off by one from the Java service', symptom: 'A Node gateway returns 404 for orders that exist. The ID in the URL is one less than the ID in the database.', diagnose: 'IDs are above 2⁵³ (Snowflake-style 64-bit longs). <code>JSON.parse</code> turned them into the nearest double.', cause: 'The Java service serialises <code>long</code> as a JSON number; JavaScript numbers can’t hold it exactly.', fix: 'Serialise large IDs as strings on the Java side.', fixCode: '// Jackson, on the Java DTO\n@JsonSerialize(using = ToStringSerializer.class)\nprivate long id;', lang: 'java' }
  ],
  puzzles: [
    { kind: 'predict', q: 'What prints?', code: "let x = 5;\nlet y = x;\ny++;\nconst a = { n: 1 };\nconst b = a;\nb.n++;\nconsole.log(x, y, a.n);", options: ['5 6 1', '6 6 2', '5 6 2', 'TypeError (a is const)'], answer: 2, explain: 'Numbers are copied, so <code>x</code> stays 5. <code>b</code> holds the same reference as <code>a</code>, so <code>a.n</code> is 2. Mutating a const object is allowed.', run: true, expect: '5 6 2' },
    { kind: 'predict', q: 'What prints?', code: "console.log(typeof null, typeof [], typeof undefined, typeof NaN);", options: ['null array undefined NaN', 'object object undefined number', 'object array undefined number', 'null object undefined undefined'], answer: 1, explain: '<code>typeof null</code> is the historic <code>\'object\'</code> bug, arrays are objects, and <code>NaN</code> (“not a number”) is of type number.', run: true, expect: 'object object undefined number' },
    { kind: 'predict', q: 'What prints?', code: "console.log('1' == 1, '1' === 1, null == undefined, null === undefined);", options: ['true false true false', 'false false true false', 'true false false false', 'true true true true'], answer: 0, explain: '<code>==</code> converts <code>\'1\'</code> to 1, and has a special rule that <code>null</code> equals <code>undefined</code>. <code>===</code> requires the same type, so both strict comparisons are false.', run: true, expect: 'true false true false' },
    { kind: 'predict', q: 'Mixed operators. What prints?', code: "console.log(1 + '2', '3' - 1, '3' * '4', 1 + 2 + '3');", options: ['3 2 12 6', "12 2 12 33", '12 31 34 33', '12 2 12 123'], answer: 1, explain: "<code>1 + '2'</code> → '12' (a string is involved). <code>-</code> and <code>*</code> convert to numbers: 2 and 12. <code>1 + 2 + '3'</code> runs left to right: 3 + '3' → '33'.", run: true, expect: '12 2 12 33' },
    { kind: 'predict', q: '<code>var</code> vs <code>let</code> before declaration. What prints?', code: "console.log(v);\nvar v = 1;\ntry {\n  console.log(l);\n} catch (e) {\n  console.log(e.name);\n}\nlet l = 2;", options: ['undefined then ReferenceError', 'ReferenceError then ReferenceError', '1 then 2', 'undefined then undefined'], answer: 0, explain: '<code>var v</code> is hoisted and starts as <code>undefined</code>. <code>let l</code> is also hoisted, but stays in the <b>temporal dead zone</b> until its line, so reading it throws a ReferenceError.', run: true, expect: 'undefined\nReferenceError' },
    { kind: 'predict', q: 'Floating point. What prints?', code: "console.log(0.1 + 0.2 === 0.3, Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON);", options: ['true true', 'false true', 'false false', 'true false'], answer: 1, explain: 'Numbers are IEEE-754 doubles, so 0.1 + 0.2 is 0.30000000000000004, the same as Java <code>double</code>. Compare with a tolerance, or use integers (cents).', run: true, expect: 'false true' },
    { kind: 'predict', q: 'Defaults. What prints?', code: "const retries = 0;\nconsole.log(retries || 3, retries ?? 3);", options: ['0 0', '3 3', '3 0', '0 3'], answer: 2, explain: '<code>||</code> treats 0 as falsy and falls back to 3. <code>??</code> only falls back for <code>null</code>/<code>undefined</code>, so it keeps 0.', run: true, expect: '3 0' }
  ],
  interview: [
    { q: 'What’s the difference between var, let and const?', a: '<ul><li><code>var</code>: function-scoped, hoisted as <code>undefined</code>, can be re-declared.</li><li><code>let</code>: block-scoped, reassignable, in the temporal dead zone until declared.</li><li><code>const</code>: like <code>let</code> but can’t be reassigned. The object it points to can still change.</li></ul><p>Default to <code>const</code>, use <code>let</code> when you must reassign, never <code>var</code>.</p>', lvl: 'core' },
    { q: 'List the primitive types.', a: '<p><code>number</code>, <code>string</code>, <code>boolean</code>, <code>undefined</code>, <code>null</code>, <code>bigint</code>, <code>symbol</code>. Primitives are immutable and compared by value. Everything else, including arrays and functions, is an object.</p>', lvl: 'core' },
    { q: 'Explain == vs ===.', a: '<p><code>===</code> is true only if both type and value match (for objects: same reference). <code>==</code> applies type coercion first: <code>\'1\' == 1</code>, <code>0 == \'\'</code>, <code>null == undefined</code> are all true. Use <code>===</code>. <code>x == null</code> is a common accepted idiom for “null or undefined”.</p>', fu: 'Why is NaN === NaN false? (IEEE-754 says NaN is unequal to everything. Use Number.isNaN or Object.is.)', lvl: 'core' },
    { q: 'Is JavaScript pass-by-value or pass-by-reference?', a: '<p>Pass-by-value, like Java. For objects the value passed is a reference, so a function can mutate the caller’s object but can’t make the caller’s variable point elsewhere.</p>', lvl: 'core' },
    { q: 'null vs undefined?', a: '<p><code>undefined</code> means “not set”: an uninitialised variable, a missing property, a function with no return. <code>null</code> is an explicit “no value” you assign. JSON has <code>null</code> but no <code>undefined</code>: <code>JSON.stringify({a: undefined})</code> is <code>{}</code>.</p>', lvl: 'core' },
    { q: 'Why is typeof null “object”?', a: '<p>In the first implementation, values carried a type tag and null used the object tag (a null pointer). Fixing it would break existing websites, so it stays. Test for null with <code>=== null</code>.</p>', lvl: 'core' },
    { q: 'What numeric types does JavaScript have?', a: '<p><code>number</code> is a 64-bit IEEE-754 double: integers are exact only up to <code>Number.MAX_SAFE_INTEGER</code> (2⁵³−1). <code>bigint</code> (<code>10n</code>) is arbitrary-precision, but can’t be mixed with number in arithmetic without explicit conversion. There’s no separate int, long or decimal type.</p>', lvl: 'core' },
    { q: 'What are truthy and falsy values?', a: '<p>Falsy: <code>false</code>, <code>0</code>, <code>-0</code>, <code>0n</code>, <code>\'\'</code>, <code>null</code>, <code>undefined</code>, <code>NaN</code>. Everything else is truthy, including <code>[]</code>, <code>{}</code> and <code>\'0\'</code>. That is why <code>if (list)</code> doesn’t check for an empty array; use <code>list.length</code>.</p>', lvl: 'core' },
    { q: 'What is hoisting and the temporal dead zone?', a: '<p>Declarations are registered when the scope is entered, before any code runs. <code>var</code> is initialised to <code>undefined</code>; function declarations are fully available. <code>let</code>/<code>const</code>/<code>class</code> exist but are uninitialised until their line runs. Reading them earlier throws a ReferenceError. That window is the TDZ.</p>', lvl: 'deep' },
    { q: 'How do you copy an object?', a: '<p>Shallow: <code>{ ...obj }</code> or <code>[...arr]</code>. Deep: <code>structuredClone(obj)</code> (Node 17+) handles nested objects, Maps, Dates and cycles, but not functions or class prototypes. See <a href="js-objects-arrays.html">Objects & arrays</a>.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Types side by side', lang: 'js', code: `const id = 42;                 // number (a double)
const big = 9007199254740993n; // bigint
const name = 'Ada';            // string, '…' or "…" or \`…\`
const active = true;           // boolean
let nickname = null;           // explicitly empty
let email;                     // undefined
const tags = ['a', 'b'];       // object (Array)
const user = { id, name };     // object

if (nickname == null) nickname = name;  // null or undefined
const label = \`\${name} (#\${id})\`;       // template literal` },
    { title: 'Java equivalent', lang: 'java', code: `final int id = 42;                         // const id = 42
final BigInteger big = new BigInteger("9007199254740993");
final String name = "Ada";
final boolean active = true;
String nickname = null;
String email;                              // Java: must assign before use
final List<String> tags = List.of("a", "b");
var user = new User(id, name);             // record User(int id, String name)

if (nickname == null) nickname = name;
String label = "%s (#%d)".formatted(name, id);`, note: 'Java checks types when compiling; JavaScript checks them while running. <a href="typescript-node.html">TypeScript</a> brings compile-time checks back.' },
    { title: 'Safe input parsing', lang: 'js', code: `function parsePort(raw, fallback = 3000) {
  if (raw == null || raw === '') return fallback;   // missing
  const n = Number(raw);                            // '8080' → 8080, '80x' → NaN
  if (!Number.isInteger(n) || n < 0 || n > 65535) {
    throw new RangeError(\`invalid port: \${raw}\`);
  }
  return n;
}

const port = parsePort(process.env.PORT);` }
  ]
});

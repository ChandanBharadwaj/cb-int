IA.register({
  track: 'nodejs',
  slug: 'node-first-http-server',
  title: 'Your first HTTP server',
  tagline: 'A Node web server is <b>one function called once per request</b>. Write it with the built-in <code>http</code> module to see the moving parts, then let <b>Express</b> handle routing, JSON and middleware. Read config such as the port from <b>environment variables</b>.',
  tldr: {
    problem: 'Spring Boot hides the server: you annotate a controller and Tomcat does the rest. In Node you see everything: the socket, the request callback, the headers you write. Forget one <code>res.end()</code> and the client hangs.',
    model: '<code>http.createServer((req, res) =&gt; …)</code>: Node calls your function for every request on the same thread. <code>req</code> is what came in (method, url, headers, a body stream); <code>res</code> is what you send back. Express turns that one function into a chain of <b>middleware</b> and <b>routes</b>.',
    hook: '“How does a single-threaded Node server handle 1,000 concurrent requests?” Each handler runs for a moment, starts its I/O and returns. While the database works, the thread serves other requests. It struggles only when a handler does long CPU work.',
    facts: [
      { v: '1 callback', l: 'per request with the raw <code>http</code> module. No router, no body parsing, no JSON helper' },
      { v: 'strings', l: 'are all you get from <code>process.env</code>, <code>req.params</code> and query strings. Convert numbers and booleans yourself' },
      { v: 'built in', l: '<code>fetch</code> (Node 18+), <code>--watch</code> and <code>--env-file</code> (Node 20.6+), so a first server needs no dependencies' }
    ]
  },
  intro: {
    what: 'An <b>HTTP server</b> waits on a network port. A client (a browser, curl, another service) sends a <b>request</b>: a method like GET or POST, a path like <code>/users/7</code>, headers, and maybe a body. The server sends back a <b>response</b>: a status code (200, 404…), headers, and a body, usually JSON for an API.',
    analogy: { icon: '🛎️', title: 'A reception desk', text: 'The port is the front door, <code>createServer</code> hires one receptionist, and the callback is the script she follows for every visitor: read the request slip, decide what they need, hand back an answer, and always say goodbye (<code>res.end()</code>) so the visitor leaves.' },
    steps: [
      { t: 'Hello, http', d: 'No dependencies. Run with <code>node server.js</code>, then open <code>http://localhost:3000</code>.', code: "const http = require('node:http');\n\nhttp.createServer((req, res) => {\n  res.writeHead(200, { 'content-type': 'text/plain' });\n  res.end(`Hello from ${req.method} ${req.url}\\n`);\n}).listen(3000, () => console.log('http://localhost:3000'));" },
      { t: 'Install Express', d: 'The most widely used Node web framework.', code: 'npm init -y\nnpm install express', lang: 'bash' },
      { t: 'Routes and JSON', d: 'One method + path per route. <code>res.json</code> sets the header and serialises.', code: "const express = require('express');\nconst app = express();\napp.use(express.json());                 // parse JSON bodies\n\napp.get('/users/:id', (req, res) => res.json({ id: req.params.id }));\napp.post('/users', (req, res) => res.status(201).json(req.body));\n\napp.listen(3000);" },
      { t: 'Config from the environment', d: 'Never hard-code ports, URLs or secrets.', code: "const port = Number(process.env.PORT ?? 3000);\n// PORT=8080 node app.js     or     node --env-file=.env app.js" },
      { t: 'Try it', d: 'curl from another terminal.', code: "curl localhost:3000/users/7\ncurl -X POST localhost:3000/users \\\n  -H 'content-type: application/json' -d '{\"name\":\"Ada\"}'", lang: 'bash' }
    ],
    terms: [
      ['request / response', '<code>req</code> holds method, url, headers and a body stream; <code>res</code> is where you write status, headers and body.'],
      ['route', 'A handler for one method + path pattern, e.g. <code>GET /users/:id</code>.'],
      ['middleware', 'A function <code>(req, res, next)</code> that runs before routes: parse bodies, log, authenticate. Like a servlet filter.'],
      ['route param / query', '<code>/users/:id</code> → <code>req.params.id</code>; <code>?page=2</code> → <code>req.query.page</code>. Both are strings.'],
      ['status code', '2xx success, 4xx client error (400 bad input, 404 not found), 5xx server error.'],
      ['environment variable', 'A key=value set outside the program. Read via <code>process.env.NAME</code>.']
    ]
  },
  visual: {
    title: 'Follow a request through the server',
    caption: 'Pick a tab and Step. The pipeline shows which part of your code is handling the request right now. The right side shows what came in and what goes back out. Grey boxes are routes that were checked and skipped.'
  },
  gotchas: [
    { trap: 'Forgetting to end the response', code: "http.createServer((req, res) => {\n  if (req.url === '/health') res.end('ok');\n  // other paths: nothing sent, client hangs\n});", why: 'Node doesn’t know you’re done until you call <code>res.end()</code> (Express’s <code>res.json</code>/<code>send</code> call it for you). The client waits until it times out.', fix: 'Make every code path respond: add a final 404, and an error handler that responds 500.' },
    { trap: '<code>req.body</code> is undefined in Express', code: "app.post('/users', (req, res) => {\n  console.log(req.body);   // undefined\n});", why: 'Express doesn’t parse bodies by default. The body is a stream.', fix: 'Add <code>app.use(express.json())</code> before the routes, and send <code>content-type: application/json</code> from the client.' },
    { trap: 'Params and env vars are strings', code: "app.get('/users/:id', (req, res) => {\n  users.find((u) => u.id === req.params.id);   // 7 === '7' → false\n});", why: 'Everything parsed from a URL or the environment arrives as a string.', fix: 'Convert and validate: <code>Number(req.params.id)</code>, <code>process.env.DEBUG === \'true\'</code>. A schema validator (zod, ajv) helps for bodies.' },
    { trap: 'Listening on localhost inside a container', code: "app.listen(3000, '127.0.0.1');   // unreachable from outside the container", why: 'Loopback only accepts connections from inside the same network namespace, so the port mapping or Kubernetes Service can’t reach it.', fix: 'Omit the host (Node then listens on all interfaces) or pass <code>\'0.0.0.0\'</code> in containers.' },
    { trap: 'Async errors in Express 4 handlers', code: "app.get('/u/:id', async (req, res) => {\n  const u = await db.get(req.params.id);   // rejects → Express 4 never responds\n  res.json(u);\n});", why: 'Express 4 only catches errors thrown synchronously. A rejected promise becomes an unhandled rejection. Express 5 forwards rejected promises to the error handler.', fix: 'Use Express 5, or wrap handlers in try/catch and call <code>next(err)</code>. Details in <a href="express-fastify.html">Express & Fastify</a>.' },
    { trap: 'Running the server as <code>npm start</code> in production containers', why: 'npm sits between the signal and your process, so SIGTERM handling is unreliable, and in-flight requests are cut off on deploy.', fix: 'Start with <code>node server.js</code> and close the server on SIGTERM. See <a href="graceful-shutdown.html">Graceful shutdown</a>.' }
  ],
  scenarios: [
    { title: 'Requests hang for 2 minutes on one endpoint', symptom: 'Clients calling <code>DELETE /items/:id</code> with an unknown id hang until their timeout; the load balancer logs 504s.', diagnose: 'The handler responds only inside <code>if (item) { … }</code>. Server logs show no error, because nothing failed: the response was simply never sent.', cause: 'A code path without <code>res.end</code>/<code>res.json</code>. Node keeps the socket open, waiting for you.', fix: 'Respond on every path and add a catch-all 404. Set server timeouts so a bug can’t hold sockets forever.', fixCode: "app.delete('/items/:id', async (req, res) => {\n  const ok = await items.delete(Number(req.params.id));\n  if (!ok) return res.status(404).json({ error: 'not found' });\n  res.status(204).end();\n});\nserver.requestTimeout = 30_000;   // Node default is 300 000 ms (5 min)" },
    { title: 'Works locally, “connection refused” in Kubernetes', symptom: 'The pod is Running, but the Service returns connection refused and readiness probes fail.', diagnose: '<code>kubectl exec</code> + <code>curl localhost:3000</code> works inside the pod; the container listens on port 3000 but the Deployment sets <code>PORT=8080</code> and probes 8080.', cause: 'The port was hard-coded as <code>app.listen(3000)</code>, ignoring the environment.', fix: 'Read the port from <code>process.env.PORT</code>, log the actual port at startup, and keep the probe and containerPort in sync.', fixCode: "const port = Number(process.env.PORT ?? 3000);\nconst server = app.listen(port, () => console.log(`listening on :${server.address().port}`));" }
  ],
  puzzles: [
    { kind: 'predict', q: 'A raw http server, called with fetch. What prints?', code: "const http = require('node:http');\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { 'content-type': 'application/json' });\n  res.end(JSON.stringify({ path: req.url, method: req.method }));\n});\nserver.listen(0, '127.0.0.1', async () => {\n  const { port } = server.address();\n  const r = await fetch(`http://127.0.0.1:${port}/hi?x=1`);\n  console.log(r.status, r.headers.get('content-type'), await r.text());\n  server.closeAllConnections();\n  server.close();\n});", options: ['200 application/json {"path":"/hi","method":"GET"}', '200 application/json {"path":"/hi?x=1","method":"GET"}', '200 text/html {"path":"/hi?x=1","method":"GET"}', '404 null '], answer: 1, explain: '<code>req.url</code> is the raw path <b>including</b> the query string. Parse it with <code>new URL(req.url, \'http://x\')</code> to split pathname and query. Port 0 asks the OS for any free port.', run: true, expect: '200 application/json {"path":"/hi?x=1","method":"GET"}' },
    { kind: 'predict', q: 'Routing by hand. What prints?', code: "const http = require('node:http');\nconst server = http.createServer((req, res) => {\n  if (req.url === '/health') {\n    res.writeHead(200);\n    res.end('ok');\n  } else {\n    res.statusCode = 404;\n    res.end();\n  }\n});\nserver.listen(0, '127.0.0.1', async () => {\n  const base = `http://127.0.0.1:${server.address().port}`;\n  const a = await fetch(base + '/health');\n  const b = await fetch(base + '/x');\n  console.log(a.status, await a.text(), b.status);\n  server.closeAllConnections();\n  server.close();\n});", options: ['200 ok 200', '200 ok 404', '200  404', '404 ok 404'], answer: 1, explain: 'The handler decides everything: <code>writeHead</code> or <code>statusCode</code> sets the status, and <code>end</code> sends the body. Without the else branch, <code>/x</code> would hang.', run: true, expect: '200 ok 404' },
    { kind: 'predict', q: 'Reading a JSON body without a framework. What prints?', code: "const http = require('node:http');\nconst server = http.createServer((req, res) => {\n  let body = '';\n  req.on('data', (chunk) => (body += chunk));\n  req.on('end', () => {\n    const data = JSON.parse(body);\n    res.writeHead(201, { 'content-type': 'application/json' });\n    res.end(JSON.stringify({ got: data.name.toUpperCase() }));\n  });\n});\nserver.listen(0, '127.0.0.1', async () => {\n  const r = await fetch(`http://127.0.0.1:${server.address().port}/users`, {\n    method: 'POST',\n    headers: { 'content-type': 'application/json' },\n    body: JSON.stringify({ name: 'ada' }),\n  });\n  console.log(r.status, await r.json());\n  server.closeAllConnections();\n  server.close();\n});", options: ["201 { got: 'ADA' }", "200 { got: 'ADA' }", "201 { got: 'ada' }", '201 {"got":"ADA"}'], answer: 0, explain: 'The body arrives as a <b>stream</b> of chunks; you collect them and parse on <code>end</code>. That’s the job <code>express.json()</code> does for you. <code>console.log</code> of the parsed object uses Node’s inspect format.', run: true, expect: "201 { got: 'ADA' }" },
    { kind: 'predict', q: 'Environment variables are strings. What prints?', code: "process.env.MY_FLAG = false;\ndelete process.env.MY_PORT;\nconsole.log(typeof process.env.MY_FLAG, process.env.MY_FLAG === 'false', process.env.MY_PORT ?? 'default');", options: ['boolean false default', "string true default", 'string false undefined', 'boolean true default'], answer: 1, explain: 'Values assigned to <code>process.env</code> are converted to strings, and every value read from it is a string. A missing variable is <code>undefined</code>, so <code>??</code> supplies a default.', run: true, expect: 'string true default' },
    { kind: 'predict', q: 'Parsing a port. What prints?', code: "const parse = (v) => Number(v ?? 3000);\nconsole.log(parse(undefined), parse('8080'), parse(''), parse('80a'));", options: ['3000 8080 3000 NaN', '3000 8080 0 NaN', '3000 8080 0 80', 'NaN 8080 0 NaN'], answer: 1, explain: '<code>??</code> only replaces <code>undefined</code>/<code>null</code>, so an empty <code>PORT=</code> becomes <code>Number(\'\')</code> = 0, which means “any free port”. Validate: reject non-integers and treat empty as missing.', run: true, expect: '3000 8080 0 NaN' },
    { kind: 'predict', q: 'Splitting a URL. What prints?', code: "const u = new URL('/users/7?expand=orders&x=1', 'http://localhost');\nconsole.log(u.pathname, u.searchParams.get('expand'), u.searchParams.get('nope'));", options: ['/users/7 orders undefined', '/users/7 orders null', '/users/7?expand=orders orders null', 'users/7 orders null'], answer: 1, explain: 'The WHATWG <code>URL</code> class (global in Node) parses paths and query strings. <code>searchParams.get</code> returns <code>null</code> for a missing key, like Java’s <code>Map.get</code>.', run: true, expect: '/users/7 orders null' },
    { kind: 'concept', q: 'In Express, what does a middleware function do if it neither sends a response nor calls <code>next()</code>?', options: ['Express automatically moves to the next route', 'Express sends a 500', 'The request hangs until a timeout', 'Express sends a 404'], answer: 2, explain: 'Control passes on only when you call <code>next()</code> (or <code>next(err)</code>). Otherwise the chain stops there and nobody responds.' }
  ],
  interview: [
    { q: 'How do you create an HTTP server without any framework?', a: '<p><code>http.createServer((req, res) =&gt; { … }).listen(port)</code>. Inspect <code>req.method</code> and <code>req.url</code>, set the status and headers with <code>res.writeHead</code>, and send the body with <code>res.end</code>. You parse bodies and route by hand.</p>', lvl: 'core' },
    { q: 'What does Express add on top of the http module?', a: '<ul><li>Routing by method and path pattern (<code>/users/:id</code>).</li><li>Middleware chain with <code>next()</code>.</li><li>Helpers: <code>req.params</code>, <code>req.query</code>, <code>res.json</code>, <code>res.status</code>.</li><li>Body parsers (<code>express.json()</code>), static files, error-handling middleware.</li></ul>', lvl: 'core' },
    { q: 'What is middleware? Give examples.', a: '<p>A function <code>(req, res, next)</code> run in registration order for matching requests. It can modify req/res, respond (and end the chain), or call <code>next()</code>. Examples: JSON body parsing, request logging, authentication, CORS, rate limiting. Error middleware has four parameters: <code>(err, req, res, next)</code>.</p>', fu: 'How is it like a Spring filter or interceptor? (Same chain-of-responsibility idea; next() ≈ chain.doFilter().)', lvl: 'core' },
    { q: 'params vs query vs body?', a: '<p><code>req.params</code>: named parts of the path (<code>/users/:id</code>). <code>req.query</code>: the query string (<code>?page=2</code>). <code>req.body</code>: the parsed request body, only after a body parser. Params and query are always strings.</p>', lvl: 'core' },
    { q: 'How should a Node service read configuration?', a: '<p>From environment variables, as in the twelve-factor app: <code>process.env.PORT</code>, <code>DATABASE_URL</code> and so on. Parse and validate them once at startup and fail fast. For local development, <code>node --env-file=.env</code> (Node 20.6+) or dotenv. Keep secrets out of the repo.</p>', lvl: 'core' },
    { q: 'How does one Node process handle many requests at once?', a: '<p>Each request is a callback on the single JS thread. A handler typically does a little work, starts I/O (database, HTTP call), and yields at <code>await</code>. The event loop then runs other requests’ callbacks. Throughput falls apart only when a handler does long synchronous work. See <a href="js-async-basics.html">Async basics</a>.</p>', lvl: 'core' },
    { q: 'What status codes would you return for create, not found, bad input and a crash?', a: '<p>201 Created (with the resource or a <code>Location</code> header), 404 Not Found, 400 Bad Request (or 422 for validation errors), and 500 Internal Server Error, without leaking stack traces to the client.</p>', lvl: 'core' },
    { q: 'How do you handle errors centrally in Express?', a: '<p>Register an error middleware after all routes: <code>app.use((err, req, res, next) =&gt; res.status(err.status ?? 500).json({ error: err.message }))</code>. Sync throws reach it automatically; in Express 4 async errors need <code>next(err)</code>, while Express 5 forwards rejected promises.</p>', lvl: 'core' },
    { q: 'Express or Fastify?', a: '<p>Express is the most widely used and has the biggest middleware ecosystem. Fastify is faster, has built-in JSON schema validation and serialisation, and was designed around async/await. For a new high-throughput API, Fastify is a strong choice. See <a href="express-fastify.html">Express & Fastify</a>.</p>', lvl: 'deep' },
    { q: 'What should a production server do on SIGTERM?', a: '<p>Stop accepting new connections (<code>server.close()</code>), let in-flight requests finish within a deadline, close database pools, then exit. Containers send SIGTERM before SIGKILL. See <a href="graceful-shutdown.html">Graceful shutdown</a>.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Express app', lang: 'js', code: `// app.js  —  npm i express  ·  node --env-file=.env app.js
const express = require('express');

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port)) throw new Error('PORT must be an integer');

const app = express();
app.use(express.json());

const users = new Map([[1, { id: 1, name: 'Ada' }]]);
let nextId = 2;

app.get('/health', (req, res) => res.send('ok'));

app.get('/users/:id', (req, res) => {
  const user = users.get(Number(req.params.id));   // params are strings
  if (!user) return res.status(404).json({ error: 'not found' });
  res.json(user);
});

app.post('/users', (req, res) => {
  const { name } = req.body ?? {};
  if (typeof name !== 'string' || !name) return res.status(400).json({ error: 'name required' });
  const user = { id: nextId++, name };
  users.set(user.id, user);
  res.status(201).json(user);
});

app.use((err, req, res, next) => {                  // error middleware: 4 params
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

const server = app.listen(port, () => console.log(\`listening on :\${port}\`));
process.on('SIGTERM', () => server.close());` },
    { title: 'Spring Boot equivalent', lang: 'java', code: `@RestController
@RequestMapping("/users")
class UserController {
    private final Map<Long, User> users = new ConcurrentHashMap<>(Map.of(1L, new User(1L, "Ada")));
    private final AtomicLong nextId = new AtomicLong(2);

    @GetMapping("/{id}")
    ResponseEntity<User> get(@PathVariable long id) {          // converted to long for you
        var u = users.get(id);
        return u == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(u);
    }

    @PostMapping
    ResponseEntity<User> create(@RequestBody @Valid CreateUser body) {   // Jackson parses JSON
        var u = new User(nextId.getAndIncrement(), body.name());
        users.put(u.id(), u);
        return ResponseEntity.status(HttpStatus.CREATED).body(u);
    }
}
// application.properties:  server.port=\${PORT:3000}`, note: 'Spring converts path variables and parses JSON from annotations. In Express you do both explicitly. Node needs no ConcurrentHashMap: handlers never run in parallel on the JS thread.' },
    { title: '.env and scripts', lang: 'bash', code: `# .env  (gitignored; real secrets come from the platform)
PORT=8080
DATABASE_URL=postgres://localhost:5432/app

# package.json scripts
#   "dev":   "node --watch --env-file=.env app.js"
#   "start": "node app.js"

npm run dev
curl -s localhost:8080/users/1
curl -s -X POST localhost:8080/users -H 'content-type: application/json' -d '{"name":"Bob"}'` }
  ]
});

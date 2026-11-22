IA.register({
  track: 'nodejs',
  slug: 'express-fastify',
  title: 'Express & Fastify',
  tagline: 'Express is a <b>list of functions</b> that each get <code>(req, res, next)</code> and pass control along. Fastify is a <b>fixed lifecycle of hooks</b> around a route that has a JSON schema. Know where errors go in each, and what Express 5 changed about async handlers.',
  tldr: {
    problem: 'Most Node web bugs aren’t in the business logic. A middleware registered in the wrong order, an async error that never reaches the error handler, a response sent twice, or a response that leaks fields because nothing shapes the output.',
    model: '<b>Express</b>: middleware run in registration order; each one either ends the response or calls <code>next()</code>. <code>next(err)</code> skips straight to the next <b>4-argument</b> error middleware. <b>Fastify</b>: routing → <code>onRequest</code> → parse → <code>preValidation</code> → schema validation → <code>preHandler</code> → handler → <code>preSerialization</code> → serialize → <code>onSend</code> → <code>onResponse</code>. Thrown or rejected errors go to <code>setErrorHandler</code>.',
    hook: '“In Express 4, what happens when an <code>async</code> route handler rejects?” Nothing catches it: the request hangs and, since Node 15, the unhandled rejection crashes the process. Express 5 forwards it to <code>next(err)</code> for you.',
    facts: [
      { v: '4 args', l: 'how Express recognises error middleware: <code>fn.length === 4</code>. A default parameter or <code>...rest</code> changes <code>length</code> and silently breaks it' },
      { v: 'Express 5', l: '(5.0, Sept 2024, Node 18+) passes rejected promises from handlers and middleware to <code>next(err)</code>' },
      { v: '100 kb / 1 MiB', l: 'default body limits: <code>express.json()</code> 100 kb, Fastify <code>bodyLimit</code> 1 MiB' }
    ]
  },
  intro: {
    what: 'A web framework turns raw HTTP requests into calls to your code. <b>Express</b> does it with a chain of small functions called <b>middleware</b>. Each one can read or change the request, send a response, or hand over to the next one. <b>Fastify</b> does the same job with a fixed set of <b>hooks</b> (named stages a request passes through) and a <b>JSON schema</b> per route that validates input and shapes output.',
    analogy: { icon: '🏭', title: 'An assembly line vs a checklist', text: 'Express is a conveyor belt of workers in the order you hired them. Each one does a job and pushes the item on, or pulls it off the line. If a worker shouts “defect!” (<code>next(err)</code>), the item skips everyone except the quality desk at the end. Fastify is an airline check-in checklist: the same stages in the same order for every passenger, with a printed form (the schema) that rejects bad bookings before anyone works on them.' },
    steps: [
      { t: 'A middleware is a function', d: 'It receives the request, the response and <code>next</code>.', code: "app.use((req, res, next) => {\n  req.startedAt = Date.now();\n  next();                 // hand over to the next one\n});" },
      { t: 'Order is the registration order', d: 'Body parsers, auth and logging must be registered <b>before</b> the routes that need them.' },
      { t: 'Errors skip ahead', d: '<code>next(err)</code> or a throw jumps to the error middleware, which has <b>four</b> parameters.', code: "app.use((err, req, res, next) => {\n  res.status(err.status ?? 500).json({ error: err.message });\n});" },
      { t: 'Fastify: schema first', d: 'Declare what the body and the response look like. Bad input gets a 400 before your handler runs.', code: "app.post('/orders', { schema: { body: OrderIn, response: { 201: OrderOut } } },\n  async (req, reply) => reply.code(201).send(await create(req.body)));" }
    ],
    terms: [
      ['middleware', 'A function in the Express chain: <code>(req, res, next)</code>.'],
      ['error middleware', 'A function with four parameters, <code>(err, req, res, next)</code>, that handles errors.'],
      ['hook', 'A Fastify lifecycle stage you can attach code to, like <code>onRequest</code> or <code>preHandler</code>.'],
      ['JSON schema', 'A JSON description of an object’s shape. Fastify uses it to validate input (Ajv) and serialize output.'],
      ['plugin / encapsulation', 'Fastify’s way of grouping routes and hooks so they only apply inside that group.']
    ]
  },
  visual: {
    title: 'Follow one request through the chain',
    caption: 'Pick a framework and a scenario, then press Play or Step. The highlighted box is running now; grey boxes were skipped. Watch where an error jumps to, and the difference between Express 4 and 5 for an async rejection.'
  },
  gotchas: [
    { trap: 'Async handler in Express 4: the rejection goes nowhere', code: `// Express 4
app.get('/orders/:id', async (req, res) => {
  const order = await db.find(req.params.id);   // rejects
  res.json(order);
});`, why: 'Express 4 calls the handler and ignores its return value. The rejected promise has no handler: the request hangs until the client times out, and Node 15+ crashes the process on the unhandled rejection.', fix: 'Upgrade to Express 5, which forwards rejections to <code>next(err)</code>. On Express 4, wrap handlers: <code>const wrap = (fn) =&gt; (req, res, next) =&gt; Promise.resolve(fn(req, res, next)).catch(next)</code>, or use <code>express-async-errors</code>.' },
    { trap: 'Error middleware with three parameters (or a default one)', code: `// never called for errors: length is 3
app.use((err, req, res) => res.status(500).end());
// also length 3!
app.use((err, req, res, next = noop) => res.status(500).end());`, why: 'Express decides “is this error middleware?” from <code>fn.length</code>. Parameters with defaults, and everything after them, don’t count toward <code>length</code>. A 3-parameter function is treated as normal middleware and is skipped while an error is pending.', fix: 'Always declare exactly <code>(err, req, res, next)</code>, even if <code>next</code> is unused. Register it <b>after</b> all routes.' },
    { trap: 'Routes registered before the body parser', code: `app.post('/orders', createOrder);   // req.body is undefined
app.use(express.json());`, why: 'Middleware runs in registration order. The route matched and responded before <code>express.json()</code> ever ran. <code>req.body</code> is <code>undefined</code> when no parser ran. (Express 5 also stopped body parsers from setting it to <code>{}</code> for requests they skip.)', fix: 'Register parsers, security headers, request ids and auth first, then routers, then 404 and error handlers last.' },
    { trap: '“Cannot set headers after they are sent”', code: `app.get('/x', (req, res, next) => {
  if (!req.user) res.status(401).json({ error: 'login' });   // no return!
  res.json(load());                                         // ERR_HTTP_HEADERS_SENT
});`, why: 'Sending a response doesn’t stop the function. The second send throws <code>ERR_HTTP_HEADERS_SENT</code>. The same happens if you call <code>next()</code> after responding and a later middleware responds again.', fix: '<code>return res.status(401)…</code>. In error middleware, check <code>res.headersSent</code> and delegate to <code>next(err)</code> if it is true, so Express can close the connection.' },
    { trap: 'Fastify: mixing return and reply.send in an async handler', code: `app.get('/x', async (req, reply) => {
  setImmediate(() => reply.send({ ok: true }));
  // returns undefined → Fastify may respond first / log an error
});`, why: 'For an async handler, Fastify sends the resolved value. If you send through <code>reply.send</code> later, the promise resolved with <code>undefined</code> first, and the late send triggers “Reply was already sent”.', fix: 'Either <code>return value</code>, or call <code>reply.send()</code> and <code>return reply</code> to tell Fastify you will send it yourself.' },
    { trap: 'A response schema silently drops fields', code: `schema: { response: { 200: { type: 'object',
  properties: { id: { type: 'string' } } } } }
// handler returns { id, email } → client only gets { id }`, why: 'Fastify serializes with <code>fast-json-stringify</code>, which writes only the properties in the schema. That is a feature (no accidental <code>passwordHash</code> leaks) and a surprise when a new field “doesn’t show up”.', fix: 'Add new fields to the response schema. Generate schemas from TypeBox or Zod so types and schemas can’t drift.' },
    { trap: '<code>req.ip</code> is the load balancer behind a proxy', why: 'Without <code>trust proxy</code> (Express) or <code>trustProxy</code> (Fastify), the framework ignores <code>X-Forwarded-For</code>, so rate limits and audit logs see one IP for everybody.', fix: 'Set it to the number of proxy hops or your LB’s CIDR, not blindly <code>true</code>: otherwise clients can spoof the header.' }
  ],
  scenarios: [
    { title: 'Pods restart every few minutes after a “small refactor”',
      symptom: 'Kubernetes shows restarts with exit code 1. Logs end with an unhandled rejection from a Postgres timeout in <code>GET /reports</code>. Before the crash, a few requests hang for 30 s.',
      diagnose: `grep -n "async (req, res)" src/routes/*.js     # async handlers
node -p "require('express/package.json').version"   # 4.21.x`,
      cause: 'The refactor turned callback handlers into <code>async</code> ones on Express 4. A rejected handler promise isn’t handled by Express 4, so the request hangs and Node 15+ exits on the unhandled rejection, dropping every in-flight request on that pod.',
      fix: 'Upgrade to Express 5 (check the path syntax changes: <code>/*splat</code>, <code>{optional}</code>), or wrap every async handler. Add a lint rule (<code>@typescript-eslint/no-misused-promises</code>) and a test that hits a failing route and expects 500.',
      fixCode: `// Express 4 stopgap
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/reports', wrap(async (req, res) => {
  res.json(await reports.build(req.query));
}));` },
    { title: 'API started returning password hashes',
      symptom: 'A security scan finds <code>passwordHash</code> in <code>GET /users/:id</code> responses of an Express service.',
      diagnose: `git log -p -S "include: { credentials" src/   # ORM now eager-loads credentials`,
      cause: 'The handler does <code>res.json(user)</code> with the ORM entity. A model change added a relation, and everything on the object is serialized. There is no output contract.',
      fix: 'Map to an explicit DTO, or move the route to Fastify with a response schema (only listed properties are serialized). Add a contract test that fails on unknown fields.',
      fixCode: `app.get('/users/:id', {
  schema: { response: { 200: Type.Object({ id: Type.String(), name: Type.String() }) } }
}, async (req) => users.get(req.params.id));   // extra fields are dropped` },
    { title: '413s on a file-import endpoint after moving to Fastify',
      symptom: 'Imports above about 1 MB fail with <code>413 Payload Too Large</code> / <code>FST_ERR_CTP_BODY_TOO_LARGE</code>; the same files worked behind Express with <code>express.json({ limit: \'10mb\' })</code>.',
      cause: 'Fastify’s default <code>bodyLimit</code> is 1 MiB for every route. The Express limit was raised years ago and forgotten.',
      fix: 'Raise <code>bodyLimit</code> on <b>that route only</b>, or better, stream the upload (<code>@fastify/multipart</code>) instead of buffering JSON.',
      fixCode: `app.post('/imports', { bodyLimit: 10 * 1024 * 1024 }, importHandler);` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Express identifies error middleware by <code>fn.length</code>. What prints?', code: `const a = (err, req, res, next) => {};
const b = (err, req, res, next = () => {}) => {};
const c = (...args) => {};
const d = function (err, req, res) {};
console.log(a.length, b.length, c.length, d.length);`, options: ['4 4 0 3', '4 3 0 3', '4 3 1 3', '4 4 4 3'], answer: 1, explain: '<code>length</code> counts parameters before the first one with a default, and ignores rest parameters. So only <code>a</code> would be treated as error middleware by Express; <code>b</code> looks like normal middleware.', run: true, expect: '4 3 0 3' },
    { kind: 'predict', q: 'The usual Express 4 wrapper for async handlers. What prints?', code: `const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const handler = async () => { throw new Error('db down'); };
const next = (err) => console.log('next got:', err ? err.message : 'nothing');

wrap(handler)({}, {}, next);
console.log('sync done');`, options: ['next got: db down, then sync done', 'sync done, then next got: db down', 'sync done only (unhandled rejection)', 'next got: nothing, then sync done'], answer: 1, explain: 'The async function returns a rejected promise; <code>.catch(next)</code> runs as a microtask, after the current synchronous code. The error does reach <code>next</code>, so Express would route it to error middleware.', run: true, expect: 'sync done\nnext got: db down' },
    { kind: 'concept', q: 'Express 4: <code>app.get(\'/a\', async (req, res) =&gt; { throw new Error(\'x\') })</code>, Node 22, no process handlers. What happens on a request?', options: ['500 from the default error handler', 'The request hangs and the process exits with an unhandled rejection', '404', 'Express logs the error and responds 200'], answer: 1, explain: 'Express 4 doesn’t look at the returned promise. Nobody responds, and the unhandled rejection crashes Node 15+ (default <code>--unhandled-rejections=throw</code>). Express 5 would call <code>next(err)</code> and respond 500. A <b>synchronous</b> throw in a handler is caught by both versions.' },
    { kind: 'concept', q: 'Order: <code>app.use(logger); app.use(\'/api\', apiRouter); app.use(express.json()); app.use(errorHandler)</code>. A <code>POST /api/orders</code> handler reads <code>req.body.sku</code>. What happens?', options: ['Works: parsers apply globally', 'TypeError: cannot read properties of undefined → error handler → 500', '400 Bad Request', 'The JSON parser runs first because it’s built in'], answer: 1, explain: 'The router handles the request before <code>express.json()</code> ever runs, so <code>req.body</code> is <code>undefined</code>. The synchronous TypeError is caught by Express and sent to the error middleware.' },
    { kind: 'concept', q: 'In Fastify, the body fails the route’s JSON schema. Which hooks/handler run?', options: ['onRequest, preParsing, preValidation, then a 400 is sent (handler and preHandler skipped)', 'All hooks and the handler; <code>req.validationError</code> is set', 'Only onRequest', 'The handler runs, then preSerialization rejects'], answer: 0, explain: 'Validation happens between <code>preValidation</code> and <code>preHandler</code>. On failure Fastify sends 400 (<code>FST_ERR_VALIDATION</code>) through the error handler; <code>preHandler</code> and the handler never run. <code>onSend</code> and <code>onResponse</code> still run for the error response. (<code>attachValidation: true</code> lets the handler decide instead.)' },
    { kind: 'concept', q: 'Why is Fastify’s JSON output typically faster than <code>res.json()</code>?', options: ['It uses a native C++ JSON encoder', 'With a response schema it compiles a serializer for that exact shape (fast-json-stringify) instead of a generic JSON.stringify walk', 'It gzips everything', 'It skips UTF-8 encoding'], answer: 1, explain: 'Knowing the shape ahead of time lets it generate straight-line code for those properties. Without a response schema Fastify falls back to <code>JSON.stringify</code>. Validation is also compiled once per schema with Ajv. In a real service, database and network time usually dominate, so measure before switching for speed alone.' },
    { kind: 'concept', q: 'A Fastify plugin registers an <code>onRequest</code> auth hook and the <code>/admin</code> routes. Routes registered in a sibling plugin:', options: ['also get the auth hook', 'don’t get it: hooks are encapsulated to the plugin and its children', 'get it only if registered later', 'fail to start'], answer: 1, explain: 'Each <code>register()</code> creates a child context. Hooks, decorators and plugins added inside apply to it and its descendants only. Wrap a plugin in <code>fastify-plugin</code> to break encapsulation on purpose (for shared things like a DB pool).' }
  ],
  interview: [
    { q: 'How does Express decide which middleware runs next, and how do errors travel?', a: '<p>Express keeps an ordered stack of layers (path + function). <code>next()</code> moves to the next matching layer. <code>next(err)</code>, a synchronous throw, or (Express 5) a rejected promise switches to “error mode”: Express skips non-error layers and runs only 4-parameter functions <code>(err, req, res, next)</code>. If none responds, the default handler sends 500 (with the stack only outside <code>NODE_ENV=production</code>).</p>', fu: 'What do <code>next(\'route\')</code> and <code>next(\'router\')</code> do? (Skip the remaining handlers of this route, or leave the router.)', lvl: 'core' },
    { q: 'What changed in Express 5 that matters in production?', a: '<ul><li>Rejected promises from middleware and handlers go to <code>next(err)</code>.</li><li>path-to-regexp 8: wildcards need a name (<code>/*splat</code>), optional segments use braces (<code>/:file{.:ext}</code>), regex-like characters in strings are gone. A ReDoS class of route patterns is gone with them.</li><li>Node 18+ required; removed legacy APIs (<code>req.param()</code>, <code>res.send(status)</code>, <code>app.del</code>).</li><li><code>req.body</code> is <code>undefined</code> unless a parser ran; <code>req.query</code> is a getter and uses the simple parser by default.</li></ul>', lvl: 'core' },
    { q: 'Walk through Fastify’s request lifecycle.', a: '<p>Routing → <code>onRequest</code> (auth, no body yet) → <code>preParsing</code> (raw stream) → content-type parsing → <code>preValidation</code> → schema validation (Ajv) → <code>preHandler</code> → handler → <code>preSerialization</code> (only for non-stream, non-buffer payloads) → serialization → <code>onSend</code> (final payload, can change headers) → response → <code>onResponse</code> (metrics). Errors go to the closest <code>setErrorHandler</code>. Any hook can reply early, which skips the rest of the request stages.</p>', lvl: 'deep' },
    { q: 'Why is Fastify faster than Express, and does it matter?', a: '<p>Compiled validation and serialization per schema, a radix-tree router (find-my-way), low-overhead hooks, and no per-request middleware array walking. Fastify’s own benchmarks show a large gap on hello-world routes. In a real service with database calls, the framework is a small part of latency, so the more convincing arguments are schemas as contracts, encapsulated plugins, built-in pino logging and TypeScript support.</p>', lvl: 'core' },
    { q: 'How would you write an error handler that is safe in production?', a: '<p>Map known errors (validation, not found, conflict) to 4xx with a stable body (<code>{ code, message }</code>), log 5xx with the request id and stack, never send stack traces or driver messages to clients, and if <code>res.headersSent</code> is true, call <code>next(err)</code> so Express aborts the connection. In Fastify, use <code>setErrorHandler</code> and keep <code>error.statusCode</code> for client errors.</p>', lvl: 'core' },
    { q: 'What is Fastify encapsulation, and how does it compare to Spring?', a: '<p><code>register(plugin)</code> creates a child context. Decorators, hooks and content-type parsers added there are visible only to that subtree. It’s like a child <code>ApplicationContext</code> or a filter chain scoped to a path pattern. <code>fastify-plugin</code> skips the new context, the way you would put a bean in the parent context.</p>', lvl: 'deep' },
    { q: 'How do you validate input in Express?', a: '<p>Nothing built in. Use a schema library (Zod, Joi, Ajv) in a middleware that parses <code>req.body</code>/<code>req.query</code> into a typed object, rejects unknown keys, and calls <code>next(err)</code> with a 400. Validating and <b>stripping</b> unknown keys also blocks prototype-pollution payloads; see <a href="security.html">Node security</a>.</p>', lvl: 'core' },
    { q: 'Express middleware vs Spring’s filters and interceptors?', a: '<p>Express middleware ≈ a servlet <code>Filter</code> chain, with <code>next()</code> as <code>chain.doFilter()</code>. Error middleware ≈ <code>@ControllerAdvice</code>/<code>@ExceptionHandler</code>, except it’s positional. Fastify hooks ≈ <code>HandlerInterceptor</code> (<code>preHandle</code>, <code>postHandle</code>, <code>afterCompletion</code> map roughly to <code>preHandler</code>, <code>onSend</code>, <code>onResponse</code>). Fastify schemas ≈ Bean Validation plus a Jackson view.</p>', lvl: 'core' },
    { q: 'How do you test routes without opening a port?', a: '<p>Fastify: <code>await app.inject({ method: \'GET\', url: \'/orders/1\' })</code> runs the full lifecycle in process (light-my-request). Express: <code>supertest(app)</code> listens on an ephemeral port behind the scenes. See <a href="testing-node.html">Testing Node</a>.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Express 5 app skeleton', lang: 'ts', code: `import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';

const app = express();
app.set('trust proxy', 1);                 // one LB hop
app.use(helmet());
app.use(express.json({ limit: '200kb' }));
app.use(requestId);                        // sets req.id + logger child

app.get('/orders/:id', async (req, res) => {
  const order = await orders.get(req.params.id);   // Express 5: rejection → next(err)
  if (!order) return res.status(404).json({ code: 'NOT_FOUND' });
  res.json(toDto(order));
});

app.use((req, res) => res.status(404).json({ code: 'NO_ROUTE' }));

const onError: ErrorRequestHandler = (err, req, res, next) => {   // 4 params, always
  if (res.headersSent) return next(err);
  const status = err.status ?? err.statusCode ?? 500;
  if (status >= 500) req.log.error({ err }, 'unhandled');
  res.status(status).json({ code: err.code ?? 'INTERNAL', message: status < 500 ? err.message : 'Internal error' });
};
app.use(onError);` },
    { title: 'Fastify 5 with TypeBox schemas', lang: 'ts', code: `import Fastify from 'fastify';
import { Type, type TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

const app = Fastify({ logger: true, trustProxy: 1 }).withTypeProvider<TypeBoxTypeProvider>();

const OrderIn = Type.Object({ sku: Type.String(), qty: Type.Integer({ minimum: 1 }) },
  { additionalProperties: false });
const OrderOut = Type.Object({ id: Type.String(), sku: Type.String(), qty: Type.Integer() });

app.register(async (admin) => {                      // encapsulated: hook applies here only
  admin.addHook('onRequest', admin.authenticate);
  admin.post('/orders', { schema: { body: OrderIn, response: { 201: OrderOut } } },
    async (req, reply) => {
      const order = await orders.create(req.body);    // req.body is typed
      return reply.code(201).send(order);             // extra fields are not serialized
    });
}, { prefix: '/admin' });

app.setErrorHandler((err, req, reply) => {
  if (err.validation) return reply.code(400).send({ code: 'INVALID', details: err.validation });
  req.log.error({ err }, 'unhandled');
  return reply.code(err.statusCode ?? 500).send({ code: 'INTERNAL' });
});

await app.listen({ host: '0.0.0.0', port: 3000 });`, note: 'Fastify 5 requires Node 20+. With Fastify’s default Ajv options (<code>removeAdditional: true</code>), <code>additionalProperties: false</code> <b>strips</b> unknown keys instead of rejecting the request.' },
    { title: 'The same in Spring Boot', lang: 'java', code: `@RestController
@RequestMapping("/admin/orders")
class OrderController {
  @PostMapping
  ResponseEntity<OrderOut> create(@Valid @RequestBody OrderIn in) {   // ≈ Fastify body schema
    return ResponseEntity.status(201).body(OrderOut.from(orders.create(in)));  // DTO ≈ response schema
  }
}

@RestControllerAdvice                                    // ≈ error middleware / setErrorHandler
class Errors {
  @ExceptionHandler(MethodArgumentNotValidException.class)
  ProblemDetail invalid(MethodArgumentNotValidException e) {
    return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "invalid body");
  }
}`, note: 'A servlet <code>Filter</code> chain is the closest thing to Express middleware; Spring finds exception handlers by type, Express by position.' }
  ]
});

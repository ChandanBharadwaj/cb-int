IA.register({
  track: 'nodejs',
  slug: 'testing-node',
  title: 'Testing Node',
  tagline: 'Node 22 ships a real test runner: <code>node --test</code>, <code>node:test</code> and <code>node:assert</code>, with mocks, fake timers and coverage. Jest and Vitest still win on ecosystem and ergonomics. Either way, the hard parts are the same: <b>time</b>, <b>async boundaries</b> and <b>real dependencies</b>.',
  tldr: {
    problem: 'Flaky tests that sleep for real, tests that pass alone and fail together because a mock leaked, suites that hang because a DB pool was never closed, and “unit” tests that mock so much they test nothing.',
    model: '<b>Unit</b>: pure logic plus <code>mock.fn</code>/<code>mock.method</code>; control time with fake timers (<code>mock.timers.tick</code>), and remember that ticking only fires timers that <i>already exist</i>, so await the microtasks that schedule them. <b>Integration</b>: the real HTTP stack (<code>app.inject()</code> or supertest) and a real database (Testcontainers), with everything opened in <code>before</code> and closed in <code>after</code>.',
    hook: '“Your fake-timer test hangs: the code awaits, then calls <code>setTimeout</code>.” <code>tick()</code> ran synchronously before the <code>await</code> resumed, so the timer didn’t exist yet. Let the microtasks run first (<code>await</code> something), or use the async tick variants (Jest/Vitest <code>advanceTimersByTimeAsync</code>).',
    facts: [
      { v: 'Node 20', l: 'marked <code>node:test</code> stable (added in 18.0). Node 22 runs each test file in its own subprocess by default' },
      { v: '20.4', l: 'added <code>mock.timers</code> (fake <code>setTimeout</code>/<code>setInterval</code>); <code>Date</code> mocking followed in 21.2 / 20.11' },
      { v: '0 deps', l: '<code>node --test</code> needs no packages; Jest is CommonJS-first and still needs <code>--experimental-vm-modules</code> for native ESM' }
    ]
  },
  intro: {
    what: 'A <b>test</b> is code that runs your code and checks the result. Node 22 can run tests by itself: <code>node --test</code> finds files like <code>*.test.js</code>, runs them, and reports what passed. Tests often need to <b>fake</b> things: a function you want to count calls of (a <b>mock</b>), or the clock, so a “wait 5 minutes” test runs instantly. <b>Integration tests</b> instead use the real thing: a real HTTP request and a real database in a container.',
    analogy: { icon: '🎬', title: 'A film set', text: 'A unit test is a scene on a sound stage: painted backdrops (mocks) and a director who can skip straight to “5 minutes later” (fake timers). An integration test is filming on location: real streets (a real Postgres), slower and messier, but you find out whether the car actually fits through the gate.' },
    steps: [
      { t: 'Write a test file', d: '<code>node:test</code> gives you <code>test</code>/<code>describe</code>/<code>it</code>; <code>node:assert</code> checks values.', code: "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\n\ntest('adds', () => {\n  assert.equal(add(2, 3), 5);\n});" },
      { t: 'Run them', d: 'Node discovers <code>*.test.*</code>, <code>*_test.*</code>, <code>test-*</code> and files under <code>test/</code>.', code: 'node --test\nnode --test --watch\nnode --test --experimental-test-coverage', lang: 'bash' },
      { t: 'Fake what you don’t control', d: '<code>t.mock.fn()</code> records calls; <code>t.mock.timers</code> controls time. Mocks created on <code>t</code> are restored after the test.' },
      { t: 'Use real dependencies for integration', d: 'Start the app in-process, hit it with real HTTP, use a throwaway database, and close everything in <code>after()</code>.' }
    ],
    terms: [
      ['assertion', 'A check that throws if a value isn’t what you expect.'],
      ['mock / spy', 'A fake function that records how it was called.'],
      ['fake timers', 'A replaced clock: timers fire only when the test advances time.'],
      ['hook', '<code>before</code>/<code>after</code>/<code>beforeEach</code>/<code>afterEach</code>: setup and cleanup.'],
      ['integration test', 'A test that crosses a real boundary: HTTP, database, queue.'],
      ['flaky test', 'A test that sometimes passes and sometimes fails without code changes.']
    ]
  },
  visual: {
    title: 'Fake timers, step by step',
    caption: 'Pick a test and press Play or Step. The top bar is the <b>mock clock</b>: it moves only when the test calls <code>tick()</code>. The real clock barely moves. Watch the “retry” test: the timer is created <i>after</i> the tick.'
  },
  gotchas: [
    { trap: 'Ticking before the code has scheduled the timer', code: `t.mock.timers.enable({ apis: ['setTimeout'] });
const p = retry(op);          // awaits op() first, THEN setTimeout(backoff)
t.mock.timers.tick(1000);     // nothing scheduled yet → nothing fires
await p;                      // hangs until the test times out`, why: '<code>tick()</code> is synchronous. The code under test is suspended at an <code>await</code> and only calls <code>setTimeout</code> once its microtask runs, which is after your tick.', fix: 'Let pending microtasks run before ticking (<code>await</code> the step that schedules the timer, or <code>await Promise.resolve()</code> as many times as needed), or design the code so the timer is created synchronously. Jest/Vitest have <code>advanceTimersByTimeAsync</code>, which flushes promises between timers.' },
    { trap: 'Mocks that outlive their test', code: `test('a', () => { mock.method(Date, 'now', () => 0); /* … */ });
test('b', () => { Date.now(); /* still 0! */ });`, why: 'The top-level <code>mock</code> tracker isn’t reset per test. Patched methods stay patched, so test order now matters.', fix: 'Use the per-test tracker <code>t.mock</code> (auto-restored when the test ends), or call <code>mock.restoreAll()</code> / <code>mock.reset()</code> in <code>afterEach</code>.' },
    { trap: 'A suite that never exits', code: `before(async () => { pool = new Pool(cfg); server = app.listen(0); });
// no after() → open sockets keep the test subprocess alive`, why: 'Every test file runs in a subprocess that ends only when its event loop is empty. An open pool, server, interval or Redis client keeps it running until the file times out.', fix: 'Close everything in <code>after()</code>: <code>await pool.end()</code>, <code>server.close()</code>, <code>clearInterval</code>. <code>--test-force-exit</code> (22.0+) is a last resort that hides leaks. In Jest, <code>--detectOpenHandles</code> shows the culprits.' },
    { trap: 'Mocking fetch with an http.request interceptor', why: 'Global <code>fetch</code> is undici and doesn’t go through <code>http.request</code>, so interceptors that patch the http module (older nock versions, for example) never see it.', fix: 'Use undici’s <code>MockAgent</code> with <code>setGlobalDispatcher</code>, MSW, or inject the base URL and point it at a local test server. Check that your mocking library explicitly supports <code>fetch</code>.' },
    { trap: 'Asserting on async code without awaiting', code: `test('rejects', () => {
  assert.rejects(save({}));   // returns a promise nobody awaits
});`, why: 'The test function returns before the assertion settles. Depending on the runner, the failure is reported against another test, as an unhandled rejection, or not at all.', fix: '<code>await assert.rejects(…)</code>, make the test <code>async</code>, and enable the <code>no-floating-promises</code> lint rule in test files too.' },
    { trap: 'Integration tests sharing one database state', why: 'Tests that insert rows and assume an empty table pass alone and fail in parallel (node --test runs files concurrently by default).', fix: 'One container per test file, or one schema/database per file, or wrap each test in a transaction that you roll back. Generate unique ids instead of hard-coding them.' }
  ],
  scenarios: [
    { title: 'CI is green locally, red 1 run in 10 on the build server',
      symptom: 'A “session expires after 15 minutes” test fails intermittently with an off-by-one-second assertion.',
      diagnose: `grep -rn "Date.now()\\|new Date()" src/session.ts test/session.test.ts
# the test computes "expected" with the real clock, the code reads it a few ms later`,
      cause: 'The test mixes the real clock with expectations computed from it. On a loaded CI machine the two reads straddle a second boundary.',
      fix: 'Freeze time: mock <code>Date</code> and timers together, start at a fixed instant, and advance explicitly.',
      fixCode: `test('session expires after 15 min', (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.parse('2026-01-01T00:00:00Z') });
  const s = sessions.create('u1');
  t.mock.timers.tick(15 * 60_000 - 1);
  assert.equal(sessions.isValid(s.id), true);
  t.mock.timers.tick(1);
  assert.equal(sessions.isValid(s.id), false);
});`, diagnoseLang: 'bash' },
    { title: 'The test job hangs for 10 minutes, then times out',
      symptom: 'All tests report as passed, but <code>node --test</code> never exits on CI.',
      diagnose: `node --test --test-reporter=spec test/orders.test.ts   # this file never reports "end"
# in an after() hook, print what is still open:
#   console.log(process.getActiveResourcesInfo())   → [ 'TCPSocketWrap', 'TCPSocketWrap', 'Timeout' ]`,
      cause: 'The orders test file created a pg <code>Pool</code> and a Kafka producer in <code>before()</code> but never closed them. The subprocess for that file kept running.',
      fix: 'Pair every resource with cleanup in <code>after()</code>, and assert in a final test that <code>process.getActiveResourcesInfo()</code> holds nothing unexpected.',
      fixCode: `after(async () => {
  await producer.disconnect();
  await pool.end();
  await app.close();
});`, diagnoseLang: 'bash' },
    { title: 'Mocks everywhere, bug in production anyway',
      symptom: 'An “upsert user” endpoint had 100% coverage and still returned 500 on duplicate emails in production.',
      cause: 'The repository was mocked in every test, so the real unique-constraint error from Postgres (<code>23505</code>) was never produced, and the mapping to 409 was never exercised.',
      fix: 'Add integration tests against a real Postgres (Testcontainers) for repository behaviour and error mapping; keep mocks for things you truly can’t run (payment providers), behind your own interface.' }
  ],
  puzzles: [
    { kind: 'predict', q: 'Fake timers in <code>node:test</code>. What prints?', code: `const { mock } = require('node:test');

mock.timers.enable({ apis: ['setTimeout'] });
setTimeout(() => console.log('fired'), 1000);

console.log('before');
mock.timers.tick(999);
console.log('after 999');
mock.timers.tick(1);
console.log('after 1000');
mock.timers.reset();`, options: ['before, after 999, after 1000, fired', 'before, after 999, fired, after 1000', 'before, fired, after 999, after 1000', 'before, after 999, after 1000 (never fires)'], answer: 1, explain: '<code>tick()</code> advances the mock clock and runs due timers <b>synchronously</b>, inside the tick call. At 999 ms nothing is due; the next 1 ms reaches 1000 and the callback runs before <code>tick</code> returns.', run: true, expect: 'before\nafter 999\nfired\nafter 1000' },
    { kind: 'predict', q: 'The fake-timer microtask trap. What prints?', code: `const { mock } = require('node:test');
mock.timers.enable({ apis: ['setTimeout'] });

async function retryLater() {
  await Promise.resolve();                       // e.g. awaiting the failed attempt
  setTimeout(() => console.log('retry fired'), 100);
}

retryLater();
mock.timers.tick(100);
console.log('ticked');`, options: ['retry fired, ticked', 'ticked, retry fired', 'ticked', 'retry fired'], answer: 2, explain: '<code>retryLater()</code> stops at its <code>await</code>; the tick runs with no timer scheduled. When the microtask resumes, the (fake) timer is created, but nothing ticks again, and fake timers don’t keep the process alive, so it just exits. In a real test this is the classic hang.', run: true, expect: 'ticked' },
    { kind: 'predict', q: '<code>mock.fn</code> records calls. What prints?', code: `const { mock } = require('node:test');

const sum = mock.fn((a, b) => a + b);
sum(1, 2);
sum(3, 4);

console.log(sum.mock.callCount(), sum.mock.calls[1].arguments, sum.mock.calls[0].result);`, options: ['2 [ 3, 4 ] 3', '2 [ 1, 2 ] 7', '1 [ 3, 4 ] 3', '2 3,4 3'], answer: 0, explain: 'Each call is recorded with its <code>arguments</code>, <code>result</code> (or <code>error</code>) and <code>this</code>. The wrapped implementation still runs, so <code>result</code> of the first call is 3.', run: true, expect: '2 [ 3, 4 ] 3' },
    { kind: 'predict', q: '<code>mock.method</code> and restore. What prints?', code: `const { mock } = require('node:test');

const clock = { now: () => 'real' };
const m = mock.method(clock, 'now', () => 'fake');
console.log(clock.now());

m.mock.restore();
console.log(clock.now(), m.mock.callCount());`, options: ['fake, then real 1', 'fake, then fake 1', 'real, then real 0', 'fake, then real 0'], answer: 0, explain: '<code>mock.method</code> replaces the property with a spy. <code>restore()</code> puts the original back, but the recorded calls stay, so you can still assert on them afterwards.', run: true, expect: 'fake\nreal 1' },
    { kind: 'predict', q: 'Mocking <code>Date</code> (Node 21.2+ / 20.11+). What prints?', code: `const { mock } = require('node:test');

mock.timers.enable({ apis: ['Date'], now: 0 });
console.log(Date.now());
mock.timers.tick(1500);
console.log(new Date().toISOString());
mock.timers.reset();`, options: ['0, then 1970-01-01T00:00:01.500Z', '0, then the real current time', 'the real time twice', '0, then 1970-01-01T00:00:00.000Z'], answer: 0, explain: 'With <code>Date</code> in <code>apis</code>, <code>Date.now()</code> and <code>new Date()</code> read the mock clock, which starts at <code>now</code> and moves only with <code>tick()</code>. Mock <code>Date</code> and timers together so they agree.', run: true, expect: '0\n1970-01-01T00:00:01.500Z' },
    { kind: 'concept', q: '<code>node --test</code> in Node 22 with three test files. How are they run by default?', options: ['Sequentially in one process', 'Each file in its own child process, several files concurrently', 'All files in worker threads sharing one heap', 'In one process, tests interleaved'], answer: 1, explain: 'The default isolation is one subprocess per file, which isolates module state and globals between files. Concurrency defaults to the number of CPUs minus one. Within a file, tests run one after another unless you set <code>concurrency</code>.' },
    { kind: 'concept', q: 'Fastify app, integration test. Which is the lightest way to exercise the full request lifecycle (hooks, validation, serialization) without opening a port?', options: ['supertest', '<code>await app.inject({ method: \'POST\', url: \'/orders\', payload })</code>', 'Calling the handler function directly', 'curl in a child process'], answer: 1, explain: '<code>inject</code> (light-my-request) builds fake request/response objects and runs them through the real router and hooks. Calling the handler directly skips validation, hooks and serialization, which is where the bugs are. supertest also works but listens on an ephemeral port.' }
  ],
  interview: [
    { q: 'node:test vs Jest vs Vitest: how do you choose?', a: '<p><b>node:test</b>: built in, no dependencies, fast startup, runs ESM and (with stripping) TypeScript natively, good mocks and fake timers; fewer matchers and integrations. <b>Jest</b>: the biggest ecosystem (snapshot tooling, matchers, IDE support), module mocking via its own module registry, but CommonJS-first; native ESM is still experimental and TypeScript needs a transform. <b>Vitest</b>: Jest-compatible API on top of Vite, ESM and TypeScript out of the box, fast watch mode; the usual choice for frontend-adjacent repos. For a new backend-only service, node:test or Vitest; for an existing Jest suite, there’s rarely a reason to migrate.</p>', lvl: 'core' },
    { q: 'How do fake timers work, and what is the classic pitfall?', a: '<p>The runner replaces <code>setTimeout</code>/<code>setInterval</code> (and optionally <code>Date</code>) with versions that store callbacks in a queue ordered by due time. <code>tick(ms)</code> advances a virtual clock and runs due callbacks synchronously. Pitfall: code that awaits before scheduling a timer. The tick happens before the timer exists. Solutions: flush microtasks between steps, use async advance APIs (<code>jest.advanceTimersByTimeAsync</code>, <code>vi.advanceTimersByTimeAsync</code>), or restructure the code. Also: fake <code>Date</code> together with timers, or durations and timestamps disagree.</p>', fu: 'Why shouldn’t you fake <code>setImmediate</code>/<code>nextTick</code> casually? (Libraries like database drivers rely on them; faking them can deadlock I/O.)', lvl: 'deep' },
    { q: 'How do you structure integration tests for a Node service with Postgres?', a: '<ul><li>Start Postgres with Testcontainers in <code>before()</code> (one container per file or per worker), run migrations once.</li><li>Build the app with a factory (<code>buildApp({ db })</code>) so tests inject the real pool.</li><li>Use <code>app.inject()</code> or supertest for HTTP.</li><li>Isolate data: a transaction per test, truncation, or unique ids.</li><li>Close the app, pool and container in <code>after()</code>.</li></ul><p>This is the same pattern as <code>@SpringBootTest</code> + Testcontainers.</p>', lvl: 'core' },
    { q: 'How do you mock a module (for example the database client) with node:test?', a: '<p>Prefer dependency injection: pass the client into a factory and give the test a fake. For true module mocking, Node 22.3+ has <code>t.mock.module(\'./db.js\', { namedExports: { … } })</code> behind <code>--experimental-test-module-mocks</code>. Jest’s <code>jest.mock()</code> (hoisted) and Vitest’s <code>vi.mock()</code> are more mature for this, which is one reason teams stay on them.</p>', lvl: 'core' },
    { q: 'How do you test code that uses fetch?', a: '<p>Options, from most to least real: a local test server on port 0 with the base URL injected; undici’s <code>MockAgent</code> as the global dispatcher (intercepts <code>fetch</code> and undici by origin and path, with <code>disableNetConnect()</code> to catch unmocked calls); MSW in Node mode; or mocking your own thin client wrapper. Avoid interceptors that only patch <code>http.request</code>.</p>', lvl: 'core' },
    { q: 'What does node --test give you beyond running files?', a: '<ul><li>Subtests (<code>t.test</code>), <code>describe/it</code>, hooks, <code>skip</code>/<code>todo</code>/<code>only</code> (with <code>--test-only</code>).</li><li><code>--watch</code>, <code>--test-name-pattern</code>, sharding (<code>--test-shard=1/3</code>).</li><li>Reporters: <code>spec</code>, <code>tap</code>, <code>dot</code>, <code>junit</code>, <code>lcov</code>; several at once with destinations.</li><li>Coverage with <code>--experimental-test-coverage</code>.</li><li>Experimental snapshots (<code>t.assert.snapshot</code>, 22.3+) and module mocks.</li></ul>', lvl: 'core' },
    { q: 'Unit vs integration vs end-to-end in a Node microservice: where do you put the effort?', a: '<p>Many teams find a “testing trophy” shape works better than a strict pyramid for services: a solid layer of integration tests through the HTTP boundary with real infrastructure, which catch wiring, validation and SQL bugs; unit tests for pure domain logic and tricky algorithms; a few contract tests (Pact, or schema checks) against consumers; very few E2E tests. Mock at the edges you don’t own, not your own modules.</p>', lvl: 'deep' },
    { q: 'How do you find and fix flaky tests?', a: '<p>Rerun suspected tests many times (for example in a loop with <code>--test-name-pattern</code>); log seeds and timings; look for real time (sleeps, Date), shared state (globals, DB rows, ports), order dependence and unawaited promises. Fix the cause: fake time, isolate data, await everything, use port 0. Quarantine with a ticket rather than adding retries silently.</p>', lvl: 'core' },
    { q: 'How does this map to the Java world?', a: '<p><code>node:test</code> ≈ JUnit 5 (hooks ≈ <code>@BeforeAll</code>/<code>@AfterEach</code>), <code>mock.fn</code>/<code>mock.method</code> ≈ Mockito mocks/spies, fake timers ≈ injecting a <code>java.time.Clock</code> (the Java way is usually injection rather than patching), <code>app.inject()</code> ≈ <code>MockMvc</code>, supertest ≈ <code>WebTestClient</code>/<code>TestRestTemplate</code>, Testcontainers is the same project in both ecosystems.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Unit test with node:test and fake timers', lang: 'ts', code: `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { debounce } from '../src/debounce.ts';

test('debounce calls once with the last value', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });   // restored after the test
  const save = t.mock.fn();
  const d = debounce(save, 300);

  d('a');
  t.mock.timers.tick(200);
  d('b');                                           // resets the 300 ms window
  t.mock.timers.tick(299);
  assert.equal(save.mock.callCount(), 0);

  t.mock.timers.tick(1);
  assert.equal(save.mock.callCount(), 1);
  assert.deepEqual(save.mock.calls[0].arguments, ['b']);
});` },
    { title: 'Integration test: Fastify + real Postgres', lang: 'ts', code: `import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { buildApp } from '../src/app.ts';
import { migrate } from '../src/migrate.ts';

let container: StartedPostgreSqlContainer, pool: pg.Pool, app: Awaited<ReturnType<typeof buildApp>>;

before(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  pool = new pg.Pool({ connectionString: container.getConnectionUri() });
  await migrate(pool);
  app = await buildApp({ pool });
});

after(async () => {
  await app.close();
  await pool.end();
  await container.stop();
});

test('duplicate email → 409', async () => {
  const body = { email: \`a-\${crypto.randomUUID()}@x.io\`, name: 'A' };
  assert.equal((await app.inject({ method: 'POST', url: '/users', payload: body })).statusCode, 201);
  const dup = await app.inject({ method: 'POST', url: '/users', payload: body });
  assert.equal(dup.statusCode, 409);                 // real 23505 → mapped error
});`, note: 'Run with <code>node --test --experimental-strip-types</code> (Node 22.6+), or compile first.' },
    { title: 'Mocking fetch with undici MockAgent', lang: 'ts', code: `import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

const original = getGlobalDispatcher();
const agent = new MockAgent();
agent.disableNetConnect();                       // fail on any unmocked request
setGlobalDispatcher(agent);

agent.get('https://pricing.internal')
  .intercept({ path: '/quotes/42', method: 'GET' })
  .reply(200, { id: '42', price: 9.5 });

const quote = await getQuote('42');              // uses global fetch
// …assertions…
setGlobalDispatcher(original);` },
    { title: 'Java comparison', lang: 'java', code: `// JUnit 5 + Mockito + Testcontainers — the same shape
@Testcontainers
@SpringBootTest(webEnvironment = RANDOM_PORT)
class UsersIT {
  @Container static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16-alpine");
  @DynamicPropertySource static void props(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", pg::getJdbcUrl);
  }
  @Autowired WebTestClient http;

  @Test void duplicateEmailIs409() { /* … */ }
}
// fake time in Java: inject a Clock and use Clock.fixed(...) / a mutable test clock` }
  ]
});

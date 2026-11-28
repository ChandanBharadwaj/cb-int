(function () {
  // E2E suite maths: a test touches `hops` services; each hop misbehaves for non-bug reasons with probability f.
  function e2e(v) {
    const f = v.flake / 100;
    const test = 1 - Math.pow(1 - f, Math.round(v.hops));          // one test fails with no bug
    const green = Math.pow(1 - test, Math.round(v.tests));         // whole suite green when nothing is broken
    return { test, green };
  }

  SD.register({
    slug: 'ms-testing',
    domain: 10,
    title: 'Testing Microservices & Contract Tests',
    examples: 'Pact, Spring Cloud Contract, Testcontainers',
    tagline: 'Prove that many services still fit together <b>without one giant end-to-end suite</b>: fast tests inside each service, <b>consumer-driven contracts</b> at every boundary, a deploy gate that asks "is this version compatible with what is live?", and careful checks in production.',
    tldr: {
      problem: 'Each service passes its own tests, but the bug lives <b>between</b> services: a renamed field, a changed status code, a new required header. The obvious answer, one big end-to-end suite on a shared staging environment, gets slower and flakier with every service, and soon every team waits on it.',
      idea: 'Test each service <b>in isolation</b> against real infrastructure (Testcontainers). Replace most cross-service tests with <b>contracts</b>: each consumer records what it needs, each provider replays those needs in its own build. A <b>broker</b> stores the results and a <b>can-i-deploy</b> gate checks them before every deploy.',
      insight: 'A contract test answers "can these two <b>versions</b> talk?" without running them together. That turns integration testing from an environment problem into a <b>data lookup</b>. What contracts cannot prove (real load, real data, emergent behaviour) you check <b>in production</b> with canaries and synthetic probes.',
      numbers: [
        { v: '2006', l: 'Ian Robinson publishes "Consumer-Driven Contracts" (martinfowler.com)' },
        { v: '2013', l: 'Pact first written at realestate.com.au (Pact docs)' },
        { v: '≈ 9%', l: 'chance a 200-test E2E suite is green with no bug, at 6 hops and 0.2% noise per hop (math)' }
      ]
    },

    intro: {
      what: 'Testing microservices means checking two things: that <b>each service works</b>, and that <b>services still understand each other</b> after one of them changes. A <b>contract test</b> checks the second without starting both services: the caller (the <b>consumer</b>) writes down the requests it sends and the response fields it reads, and the service being called (the <b>provider</b>) proves in its own build that it still answers that way.',
      analogy: {
        icon: '🔌',
        title: 'Plugs and sockets',
        text: 'A lamp maker does not ship every lamp to every house to see if it fits. Both sides test against the <b>plug standard</b>: the lamp maker checks the plug, the builder checks the socket. If both pass, they fit. A contract is that standard, except here the lamp makers write it: it lists only the pins they really use. The analogy stops at behaviour: a plug that fits can still carry the wrong voltage, which is why you also watch production.'
      },
      problem: 'The Orders team renames <code>total</code> to <code>amount</code>. Their tests pass, they deploy, and the checkout page shows "undefined" because the web app still reads <code>total</code>. Nobody ran the two together. <b>How do you catch a break between two services before deploy, without deploying everything together first?</b>',
      story: [
        {
          stage: 'naive',
          title: 'Mock the neighbour by hand',
          text: 'Each team unit-tests its service and fakes the other services with hand-written mocks. The tests are fast and always green. The mock is a guess about the other team\'s API, written once and never checked again.',
          scene: {
            nodes: [
              { id: 'web', label: 'Web app', sub: 'reads total', kind: 'client', at: [70, 0] },
              { id: 'mock', label: 'Hand mock', sub: 'returns total', kind: 'compute', at: [70, 110] },
              { id: 'api', label: 'Orders API', sub: 'own unit tests', kind: 'service', at: [350, 0] }
            ],
            edges: [{ from: 'web', to: 'mock' }, { from: 'web', to: 'api', dashed: true }],
            flow: ['web>mock'],
            ok: ['web', 'api'],
            badges: { web: ['tests green', 'ok'], api: ['tests green', 'ok'] }
          }
        },
        {
          stage: 'breaks',
          title: 'The mock lies, or the big suite stalls',
          text: 'Orders renames the field. The mock still returns the old one, so everything stays green until production breaks. The usual reaction is a huge end-to-end suite on shared staging. It is slow, fails for reasons unrelated to your change, and blocks every team.',
          scene: {
            nodes: [
              { id: 'web', label: 'Web app', sub: 'reads total', kind: 'client', at: [70, 0] },
              { id: 'mock', label: 'Hand mock', sub: 'still says total', kind: 'compute', at: [70, 110] },
              { id: 'api', label: 'Orders API', sub: 'now sends amount', kind: 'service', at: [350, 0] },
              { id: 'e2e', label: 'E2E on staging', sub: '45 min, flaky', kind: 'compute', at: [210, 220] }
            ],
            edges: [{ from: 'web', to: 'mock' }, { from: 'web', to: 'api' }, { from: 'e2e', to: 'web', dashed: true }, { from: 'e2e', to: 'api', dashed: true }],
            flow: ['web>api'],
            err: ['web'], warn: ['e2e', 'mock'],
            badges: { web: ['undefined', 'err'], e2e: ['red again', 'warn'] }
          }
        },
        {
          stage: 'fix',
          title: 'Record the contract, replay it at the provider',
          text: 'The web app\'s test records what it needs into a <b>contract file</b>. The Orders build replays that file against the real API. The rename fails <b>in the Orders pipeline</b>, minutes after the commit, and a deploy gate refuses to ship it.',
          scene: {
            nodes: [
              { id: 'web', label: 'Web app', sub: 'writes contract', kind: 'client', at: [70, 0] },
              { id: 'broker', label: 'Broker', sub: 'stores contracts', kind: 'store', at: [210, 110] },
              { id: 'api', label: 'Orders API', sub: 'replays contract', kind: 'service', at: [350, 0] },
              { id: 'gate', label: 'Deploy gate', sub: 'can-i-deploy?', kind: 'policy', at: [210, 220] }
            ],
            edges: [{ from: 'web', to: 'broker' }, { from: 'broker', to: 'api', bidi: true }, { from: 'gate', to: 'broker' }],
            flow: ['web>broker', 'broker>api', 'api>broker', 'gate>broker'],
            ok: ['broker', 'gate'], warn: ['api'],
            badges: { api: ['rename fails', 'warn'], gate: ['blocked', 'ok'] }
          }
        }
      ],
      usedBy: ['Pact (open source, many languages)', 'Spring Cloud Contract', 'Testcontainers', 'Spotify (testing honeycomb)', 'Uber (SLATE test environments)', 'Lyft (staging overrides with Envoy)'],
      whenToUse: [
        'Several teams own services that <b>call each other</b> and deploy on their own schedule',
        'The shared end-to-end suite is <b>slow or flaky</b> and teams wait on it to release',
        'You can change <b>both sides\' pipelines</b> (internal APIs and events), so both can publish and verify contracts'
      ],
      whenNot: [
        'One team owns one deployable: in-process tests in a <a href="ms-monolith-vs-microservices.html">monolith</a> already cover the boundaries',
        'A public API with unknown consumers: you cannot collect their contracts, so use a published spec and <a href="api-design.html">versioning rules</a>',
        'The provider is a third party that will not run your contracts: record its real responses and re-check them on a schedule'
      ],
      glossary: [
        { term: 'Consumer / provider', def: 'The consumer makes the call or reads the event; the provider answers the call or publishes the event.' },
        { term: 'Contract (pact)', def: 'A file listing the requests one consumer sends and the minimum responses it needs from one provider.' },
        { term: 'Consumer-driven contract', def: 'A contract written from the consumer\'s tests, so the provider learns exactly which parts of its API are in use.' },
        { term: 'Provider verification', def: 'Replaying every consumer\'s contract against the real provider in the provider\'s own build.' },
        { term: 'Broker', def: 'A service that stores contracts and verification results per version, and knows which versions are deployed where.' },
        { term: 'can-i-deploy', def: 'A query to the broker: is this version verified against every version it will meet in the target environment?' },
        { term: 'Component test', def: 'A test of one whole service through its API, with real infrastructure in containers and other services stubbed.' },
        { term: 'Ephemeral environment', def: 'A short-lived copy of part of the system created for one pull request and deleted afterwards.' }
      ]
    },

    requirements: {
      functional: [
        '<b>Test where the logic is</b>: most tests run inside one service and finish in minutes',
        '<b>A contract per consumer–provider pair</b>, generated from the consumer\'s real client code',
        '<b>Providers verify every consumer\'s contract</b> in their own pipeline, with no other service running',
        '<b>The gate checks versions, not branches</b>: "this build against what is live in production now"',
        '<b>Real infrastructure in component tests</b>: the same database and broker engine as production, in containers',
        '<b>Production is a test stage</b>: canary, compare, roll back automatically; probe key journeys all the time'
      ],
      nonFunctional: [
        'Commit-to-verdict under 10 minutes for one service (<em>example target</em>)',
        'Flaky test rate below 1% of runs; a flaky test is fixed or deleted within a week',
        'Zero deploys blocked by another team\'s unrelated failure',
        'Every breaking API or event change caught before production (track escapes per quarter)',
        'End-to-end suite kept to a handful of critical journeys, under 15 minutes',
        'Canary detects a bad release and rolls back within minutes, at under 5% of traffic exposed'
      ],
      outOfScope: [
        '<b>Ice-cream cone</b>: mostly end-to-end and manual tests, few unit tests',
        '<b>Hand-written mocks</b> of other teams\' services that nobody verifies',
        '<b>Shared staging as the only integration proof</b>: one broken service blocks all teams',
        '<b>Contracts as functional tests</b>: asserting the provider\'s business rules through a consumer\'s contract',
        '<b>Retry-until-green</b> instead of fixing flaky tests'
      ]
    },

    calculator: {
      inputs: [
        { id: 'svc', label: 'Services', min: 5, max: 500, value: 40, log: true },
        { id: 'deps', label: 'Services each one calls (average)', min: 1, max: 10, value: 3 },
        { id: 'tests', label: 'End-to-end tests in the shared suite', min: 10, max: 2000, value: 200, log: true },
        { id: 'hops', label: 'Services touched by one E2E test', min: 2, max: 15, value: 6 },
        { id: 'flake', label: 'Chance one hop fails for a non-bug reason', min: 0.01, max: 2, value: 0.2, step: 0.01, unit: '%', log: true },
        { id: 'mins', label: 'E2E suite run time', min: 5, max: 240, value: 45, unit: 'min' }
      ],
      outputs: [
        { label: 'One E2E test fails although nothing is broken', fmt: 'pct', f: (v) => e2e(v).test },
        { label: 'Whole suite is green although nothing is broken', fmt: 'pct', f: (v) => e2e(v).green },
        { label: 'Average wait for one green run (re-running until green)', fmt: 'raw', f: (v) => { const m = v.mins / Math.max(e2e(v).green, 1e-9); return m > 6000 ? 'over 100 hours' : m >= 120 ? (m / 60).toFixed(1) + ' h' : Math.round(m) + ' min'; } },
        { label: 'Deploys per day through one serial E2E gate', fmt: 'raw', f: (v) => { const d = (1440 / v.mins) * e2e(v).green; return d >= 10 ? Math.round(d) + ' / day' : d.toFixed(1) + ' / day'; } },
        { label: 'Contracts to maintain (one per consumer–provider pair)', fmt: 'num', f: (v) => Math.round(v.svc * v.deps) },
        { label: 'Service pairs if you tested every pair together', fmt: 'num', f: (v) => Math.round(v.svc * (v.svc - 1) / 2) }
      ],
      note: 'Each hop is assumed to fail independently for environment reasons (a slow dependency, stale test data, a deploy in progress): an <em>estimate</em> you should replace with your own flake rate. A test fails with probability 1 − (1 − f)<sup>hops</sup>; the suite is green with probability (1 − that)<sup>tests</sup>. The numbers explain the usual experience: <b>noise multiplies with hops and with test count</b>. Contracts grow with the number of real dependencies, not with the square of the service count, and each one runs inside a single build.'
    },

    api: [
      { m: 'DOC', p: 'orders-web → orders-api pact (JSON)', d: 'Generated by the consumer\'s tests. Per interaction: a <b>provider state</b> ("order 42 exists"), the request, and the response with <b>matchers</b> (type, regex), not exact values. Lists only the fields this consumer reads.' },
      { m: 'YAML', p: 'Pipeline gate: can-i-deploy', d: 'A step before every deploy: <code>pact-broker can-i-deploy --pacticipant orders-api --version $GIT_SHA --to-environment production</code>. After the deploy: <code>record-deployment</code>, so the broker knows what is live.' },
      { m: 'POLICY', p: 'Test strategy per service', d: 'What each layer proves: unit (logic), integration (adapters against a real database), component (the service through its API), contract (each boundary), end-to-end (a few journeys only). Who fixes a flaky test and by when.' },
      { m: 'EVENT', p: 'Message pact for OrderPlaced', d: 'The same idea for events: the consumer states which fields of the message it needs; the provider\'s test produces a real message and verifies it. No broker needs to run.' },
      { m: 'HTTP', p: 'Synthetic check: place a test order', d: 'A scripted journey that runs against production every minute with a marked test account. Alerts on failure or latency. Its data must be excluded from billing and analytics.' },
      { m: 'ADR', p: 'ADR: replace the staging E2E gate', d: 'Why the shared suite stops being a release gate, what replaces each thing it proved (contracts, component tests, canary), which five journeys remain, and how escapes are measured.' }
    ],
    dataModel: [
      { name: 'pact_publication', store: 'Contract broker (Postgres)', fields: [['consumer', 'text', 'pk'], ['provider', 'text', 'pk'], ['consumer_version', 'text (git SHA)', 'pk'], ['branch', 'text', 'idx'], ['content_sha', 'text', 'idx'], ['content', 'jsonb']], note: 'If the content hash is unchanged from the last version, earlier verification results still apply, so a consumer build that did not change its contract needs no new provider run.' },
      { name: 'verification_result', store: 'Contract broker', fields: [['content_sha', 'text', 'pk'], ['provider_version', 'text (git SHA)', 'pk'], ['success', 'boolean'], ['failed_interactions', 'jsonb'], ['verified_at', 'timestamptz']], note: 'One row per (contract content, provider version). The set of these rows is the <b>matrix</b> that can-i-deploy reads.' },
      { name: 'deployed_version', store: 'Contract broker', fields: [['application', 'text', 'pk'], ['environment', 'text', 'pk'], ['version', 'text'], ['deployed_at', 'timestamptz'], ['currently_deployed', 'boolean', 'idx']], note: 'Written by <code>record-deployment</code> at the end of each deploy. Without it the gate cannot know what "production" means.' },
      { name: 'test_run', store: 'CI analytics', fields: [['test_id', 'text', 'pk'], ['run_id', 'uuid', 'pk'], ['commit', 'text', 'idx'], ['passed', 'boolean'], ['retried', 'boolean'], ['duration_ms', 'int']], note: 'A test that both passed and failed on the same commit is flaky by definition. Rank by flake count and quarantine the worst.' }
    ],

    architecture: {
      title: 'From commit to production: contracts, component tests, gate, canary',
      nodes: [
        { id: 'mock', label: 'Pact mock server', sub: 'records the contract', kind: 'compute', wide: [95, 0], tall: [210, 0], tip: 'Stands in for the provider during the consumer\'s tests. Every expectation the test sets up is written into the pact file, so the contract comes from real client code.' },
        { id: 'cons', label: 'Consumer CI', sub: 'orders-web build', kind: 'service', wide: [95, 115], tall: [70, 0], tip: 'Runs the consumer\'s unit and contract tests, then publishes the pact with its git SHA and branch.' },
        { id: 'broker', label: 'Contract broker', sub: 'pacts + results matrix', kind: 'store', wide: [290, 115], tall: [70, 105], tip: 'Stores every contract version and every verification result, and records which version of each application is deployed to each environment.' },
        { id: 'tc', label: 'Testcontainers', sub: 'real Postgres + Kafka', kind: 'store', wide: [490, 0], tall: [350, 0], tip: 'Starts throwaway containers of the real database and broker for the provider\'s component tests, and removes them afterwards.' },
        { id: 'prov', label: 'Provider CI', sub: 'orders-api build', kind: 'service', wide: [490, 115], tall: [350, 105], tip: 'Fetches all consumer contracts from the broker, replays them against the running provider, and publishes pass or fail for this provider version.' },
        { id: 'gate', label: 'can-i-deploy', sub: 'checks the matrix', kind: 'policy', wide: [290, 230], tall: [70, 210], tip: 'Asks the broker whether this version has a successful verification against every version it will meet in the target environment.' },
        { id: 'pipe', label: 'Deploy pipeline', sub: 'one per service', kind: 'compute', wide: [490, 230], tall: [210, 210], tip: 'Each service deploys on its own. The gate is one step; recording the deployment is the last step.' },
        { id: 'prev', label: 'Preview env', sub: 'per pull request', kind: 'compute', wide: [690, 0], tall: [350, 210], tip: 'A short-lived environment holding the changed service, either with stubs or sharing a baseline of stable services through request routing.' },
        { id: 'e2e', label: 'Small E2E suite', sub: '5 critical journeys', kind: 'compute', wide: [890, 0], tall: [350, 315], tip: 'A few end-to-end journeys (sign up, pay, refund). They prove the wiring, not every rule.' },
        { id: 'canary', label: 'Canary', sub: '5% of traffic', kind: 'service', wide: [690, 230], tall: [210, 315], tip: 'The new version takes a small share of real traffic. Error rate and latency are compared with the old version; a regression rolls back automatically.' },
        { id: 'prod', label: 'Production', sub: 'all traffic', kind: 'service', wide: [890, 230], tall: [210, 420], tip: 'The only environment with real data, real load and the real versions of every other service.' },
        { id: 'synth', label: 'Synthetic checks', sub: 'probe key journeys', kind: 'external', wide: [890, 115], tall: [350, 420], tip: 'Scripted users that run the main journeys against production all the time and alert when one fails.' }
      ],
      edges: [
        { from: 'cons', to: 'mock' },
        { from: 'cons', to: 'broker', label: 'publish' },
        { from: 'broker', to: 'prov', bidi: true, label: 'verify' },
        { from: 'prov', to: 'tc' },
        { from: 'prov', to: 'prev', dashed: true },
        { from: 'e2e', to: 'prev' },
        { from: 'pipe', to: 'gate' },
        { from: 'gate', to: 'broker' },
        { from: 'pipe', to: 'canary', bidi: true },
        { from: 'canary', to: 'prod' },
        { from: 'synth', to: 'prod' }
      ]
    },

    scenarios: [
      {
        id: 'happy', title: 'A contract from test to deploy', tone: 'ok',
        steps: [
          { text: 'The web app\'s test calls its real HTTP client against a <b>mock server</b>. Each expectation ("GET /orders/42 returns <code>id</code>, <code>status</code>, <code>total</code>") is written into a pact file.', flow: ['cons>mock'], badges: { mock: 'pact file written' } },
          { text: 'Consumer CI publishes the pact to the <b>broker</b> with the git SHA and branch. A webhook triggers the provider\'s verification build.', flow: ['cons>broker', 'broker>prov'], badges: { broker: 'orders-web @ a1b2c3' } },
          { text: 'Provider CI starts the real Orders API with <b>Postgres in a container</b>, sets up each provider state, replays every request and compares the responses.', flow: ['prov>tc', 'broker>prov'], ok: ['prov'], badges: { prov: ['3 / 3 interactions', 'ok'] } },
          { text: 'The result is stored: contract a1b2c3 × provider f9e8d7 = <b>pass</b>. No shared environment was involved; both builds ran alone.', flow: ['prov>broker'], ok: ['broker'], badges: { broker: ['matrix: ✓', 'ok'] } },
          { text: 'Before deploying, each pipeline asks <b>can-i-deploy</b>. The broker checks this version against what is recorded as live in production. Yes: deploy, then record the deployment.', flow: ['pipe>gate', 'gate>broker', 'pipe>canary', 'canary>prod'], ok: ['gate', 'prod'], badges: { gate: ['yes', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'break', title: 'Provider renames a field', tone: 'err',
        steps: [
          { text: 'An Orders developer renames <code>total</code> to <code>amount</code>. Unit tests are updated and pass. Nothing in the Orders repo mentions the web app.', nodes: ['prov'], badges: { prov: 'unit tests green' } },
          { text: 'The build fetches the consumers\' contracts and replays them. The web app\'s pact expects <code>total</code>; the response no longer has it. <b>Verification fails in the provider\'s own pipeline.</b>', flow: ['broker>prov', 'prov>broker'], err: ['prov'], badges: { prov: ['$.total missing', 'err'] }, tone: 'err' },
          { text: 'Even if someone ignores the red build, <b>can-i-deploy</b> says no: the production version of orders-web has no successful verification against this provider version.', flow: ['pipe>gate', 'gate>broker'], err: ['gate'], badges: { gate: ['no', 'err'] }, tone: 'err' },
          { text: 'The safe route is <b>expand–contract</b>: add <code>amount</code> and keep <code>total</code>. That passes every contract and can deploy today.', flow: ['prov>broker', 'pipe>gate'], ok: ['gate'], badges: { prov: ['total + amount', 'ok'] } },
          { text: 'The web app switches to <code>amount</code> and publishes a new pact. Once no deployed consumer reads <code>total</code>, removing it passes verification. The contract shows exactly <b>when it is safe</b>.', flow: ['cons>broker', 'broker>prov', 'prov>broker'], ok: ['broker', 'prov'], badges: { broker: ['nobody reads total', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'component', title: 'Component test with real infrastructure', tone: 'info',
        steps: [
          { text: 'A component test treats the whole service as a black box: start it, call its API, check the response and what it stored or published.', nodes: ['prov'], badges: { prov: 'whole service, one process' } },
          { text: '<b>Testcontainers</b> starts the same Postgres and Kafka versions as production in Docker, for this test run only. An in-memory substitute would hide SQL dialect, locking and migration bugs.', flow: ['prov>tc'], ok: ['tc'], badges: { tc: ['postgres:16 · kafka', 'ok'] } },
          { text: 'Other services are <b>stubbed</b>. The stubs come from contracts (the pact file, or Spring Cloud Contract\'s generated WireMock stubs), so they cannot drift from the real provider.', flow: ['broker>prov'], badges: { prov: 'stubs from contracts' } },
          { text: 'The run takes seconds to a few minutes on a laptop or in CI. Ryuk, a helper container, removes everything afterwards even if the test process dies.', flow: ['prov>tc'], ok: ['prov'], badges: { tc: ['cleaned up', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'e2e', title: 'The big E2E suite at 40 services', tone: 'warn',
        steps: [
          { text: 'At 5 services, 30 end-to-end tests on shared staging were fine. At 40 services the suite has 200 tests, runs 45 minutes, and every team\'s deploy waits for it.', flow: ['e2e>prev'], hot: ['e2e'], labels: { e2e: { label: 'Big E2E suite', sub: '200 tests · 45 min' }, prev: { label: 'Shared staging', sub: 'all teams deploy here' } }, badges: { e2e: ['queue of 9 deploys', 'warn'] } },
          { text: 'Each test crosses about 6 services. If each hop misbehaves 0.2% of the time for reasons unrelated to your change, the suite is green only about <b>one run in eleven</b>.', flow: ['e2e>prev'], err: ['e2e'], labels: { e2e: { label: 'Big E2E suite', sub: '200 tests · 45 min' }, prev: { label: 'Shared staging', sub: 'all teams deploy here' } }, badges: { e2e: ['red, not your bug', 'err'] }, tone: 'err' },
          { text: 'People re-run until green and stop reading failures. Staging also drifts from production: another team\'s half-finished branch is deployed there, so a pass proves little.', nodes: ['prev'], warn: ['prev'], labels: { prev: { label: 'Shared staging', sub: 'all teams deploy here' } }, badges: { prev: ['not what is live', 'warn'] }, tone: 'warn' },
          { text: 'Move each assertion down: business rules to component tests, "do we still fit" to contracts. Keep about five journeys end to end, and run them against a <b>preview environment</b> per pull request.', flow: ['prov>tc', 'broker>prov', 'prov>prev', 'e2e>prev'], ok: ['e2e', 'prev', 'broker'], badges: { e2e: ['5 journeys · 6 min', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'prod', title: 'A bug only production can find', tone: 'err',
        steps: [
          { text: 'A new Orders version passes unit, component and contract tests. It adds a query that is fast on test data and slow on the real 300 GB table. No pre-production test has that data.', flow: ['pipe>gate', 'gate>broker'], ok: ['gate'], badges: { gate: ['yes', 'ok'] } },
          { text: 'The pipeline deploys a <b>canary</b>: 5% of traffic goes to the new version. The other 95% is untouched.', flow: ['pipe>canary'], badges: { canary: '5% of traffic' } },
          { text: 'Automated analysis compares canary and baseline. p99 latency is three times higher. The pipeline <b>rolls back by itself</b>; most users never saw the slow version.', flow: ['canary>pipe'], err: ['canary'], badges: { canary: ['p99 ×3 → rollback', 'err'] }, tone: 'err' },
          { text: 'A <b>synthetic check</b> places a test order every minute. It also covers what a canary misses: a journey nobody is using at 3 a.m., or a dependency that broke without any deploy.', flow: ['synth>prod'], ok: ['synth', 'prod'], badges: { synth: ['journey ok', 'ok'] } },
          { text: 'The lesson is not "tests failed". It is that data volume, real traffic mix and other teams\' live versions exist only in production, so <b>production must be a planned test stage</b>.', nodes: ['prod', 'canary', 'synth'], ok: ['prod'], tone: 'ok' }
        ]
      }
    ],

    knobs: {
      intro: 'Each control is a real choice for a group of about 40 services owned by 8 teams. Meter values are <em>illustrative</em> judgements, not benchmarks.',
      controls: [
        { id: 'mix', label: 'Main safety net', type: 'seg', value: 'honey', options: [
          { v: 'e2e', l: 'Big end-to-end suite' }, { v: 'honey', l: 'Component + contract tests' }, { v: 'unit', l: 'Unit tests + hand mocks' }] },
        { id: 'env', label: 'Integration environment', type: 'seg', value: 'preview', options: [
          { v: 'staging', l: 'Shared staging' }, { v: 'preview', l: 'Preview env per PR' }, { v: 'route', l: 'Request routing in a shared env' }] },
        { id: 'gate', label: 'Deploy gate', type: 'seg', value: 'cid', options: [
          { v: 'none', l: 'None' }, { v: 'cid', l: 'can-i-deploy' }, { v: 'e2e', l: 'Full E2E must pass' }] },
        { id: 'prod', label: 'Checks in production', type: 'seg', value: 'synth', options: [
          { v: 'none', l: 'None' }, { v: 'canary', l: 'Canary + auto rollback' }, { v: 'synth', l: 'Canary + synthetic checks' }] }
      ],
      evaluate(s) {
        const clamp = (x) => Math.max(0.03, Math.min(0.97, x));
        const M = s.mix, E = s.env, G = s.gate, P = s.prod;
        const contracts = M === 'honey' || G === 'cid';
        const fb = { e2e: 0.3, honey: 0.8, unit: 0.9 }[M] + { none: 0.05, cid: 0, e2e: -0.25 }[G] + { staging: -0.1, preview: 0.03, route: 0.05 }[E];
        const flaky = { e2e: 0.25, honey: 0.8, unit: 0.92 }[M] + { none: 0, cid: 0, e2e: -0.15 }[G] + { staging: -0.15, preview: 0.03, route: 0 }[E];
        const caught = { e2e: 0.68, honey: 0.72, unit: 0.15 }[M] + { none: 0, cid: 0.2, e2e: 0.12 }[G] + { staging: 0, preview: 0.04, route: 0.08 }[E];
        const indep = { e2e: 0.35, honey: 0.82, unit: 0.85 }[M] + { none: 0.05, cid: 0, e2e: -0.3 }[G] + { staging: -0.15, preview: 0.05, route: 0.03 }[E];
        const cost = { staging: 0.6, preview: 0.42, route: 0.72 }[E] + (M === 'e2e' || G === 'e2e' ? -0.12 : 0);
        const blast = { none: 0.18, canary: 0.75, synth: 0.9 }[P] + (caught < 0.4 ? -0.1 : 0);
        const metrics = [
          { k: 'Feedback time', v: fb >= 0.7 ? 'minutes, inside one build' : fb >= 0.4 ? 'tens of minutes' : 'an hour or more, with a queue', s: clamp(fb) },
          { k: 'Flakiness', v: flaky >= 0.7 ? 'low: few moving parts per test' : flaky >= 0.4 ? 'noticeable' : 'high: red for unrelated reasons', s: clamp(flaky) },
          { k: 'Integration bugs caught early', v: caught >= 0.8 ? 'most breaking changes, before deploy' : caught >= 0.5 ? 'many, some late' : 'few: found in production', s: clamp(caught) },
          { k: 'Team independence', v: indep >= 0.7 ? 'deploy without waiting for others' : indep >= 0.4 ? 'sometimes blocked' : 'everyone waits on one gate', s: clamp(indep) },
          { k: 'Environment cost & upkeep', v: E === 'staging' ? 'one env, constant babysitting' : E === 'preview' ? 'many short-lived envs to pay for' : 'one baseline + routing to build', s: clamp(cost), hint: 'lower bar = more cost' },
          { k: 'Damage from an escaped bug', v: P === 'none' ? 'all users, until someone notices' : P === 'canary' ? 'a few % of users, minutes' : 'a few % of users; idle journeys covered too', s: clamp(blast) }
        ];
        const notes = [];
        if (M === 'e2e') notes.push('A test that crosses 6 services fails for 6 services\' reasons. Noise grows with hops and test count; see <b>Model it</b>.');
        if (M === 'unit') notes.push('Hand-written mocks encode a guess about the other service. Nothing fails when the real service changes.');
        if (M === 'honey') notes.push('Spotify calls this shape the <b>honeycomb</b>: most tests exercise one service through its API with real infrastructure; few tests look at implementation details; as few as possible span services.');
        if (G === 'e2e') notes.push('A full-suite gate turns independent pipelines back into one release train: everyone queues behind the slowest, flakiest step.');
        if (G === 'cid') notes.push('can-i-deploy needs <code>record-deployment</code> after each deploy. If the broker does not know what is live, its answer is meaningless.');
        if (G === 'none' && M !== 'unit') notes.push('Tests exist but nothing stops a deploy when they are red or stale. The gate is what makes the result binding.');
        if (E === 'staging') notes.push('Shared staging holds everyone\'s unfinished work, so it matches neither your branch nor production.');
        if (E === 'route') notes.push('Request routing (Uber SLATE, Lyft staging overrides) deploys only the changed service and steers tagged requests to it. It needs context propagation on every hop and isolation for data and queues.');
        if (P === 'none') notes.push('Without a canary the first production test of every change is 100% of users.');
        let verdict;
        if (M === 'unit' && G !== 'cid') verdict = '❌ <b>Green builds, broken integrations.</b> Nothing verifies the boundaries; production is the integration test.';
        else if (G === 'e2e' || (M === 'e2e' && E === 'staging')) verdict = '⚠ <b>A distributed monolith in the pipeline:</b> services deploy separately on paper but wait for one slow shared suite.';
        else if (P === 'none') verdict = '⚠ <b>No safety net after deploy.</b> Pre-production tests never see real data volume or the live versions of other services. Add a canary.';
        else if (M === 'honey' && G === 'cid' && P === 'synth') verdict = '✅ <b>The recommended shape:</b> fast tests per service, verified contracts, a version-aware gate, and production treated as a test stage.';
        else if (contracts) verdict = '👍 <b>Solid.</b> Boundaries are verified per version. Check the weakest meter for the next improvement.';
        else verdict = '👍 <b>Workable for a few services.</b> It will not hold as the service count grows: add contracts before adding more end-to-end tests.';
        const hide = [];
        if (!contracts) hide.push('mock', 'broker');
        if (G !== 'cid') hide.push('gate');
        if (P === 'none') hide.push('canary');
        if (P !== 'synth') hide.push('synth');
        const flow = [];
        if (contracts) flow.push('cons>mock', 'cons>broker', 'broker>prov');
        flow.push('prov>tc', 'prov>prev', 'e2e>prev');
        if (G === 'cid') flow.push('pipe>gate', 'gate>broker');
        if (P === 'none') flow.push('pipe>prod'); else flow.push('pipe>canary', 'canary>prod');
        if (P === 'synth') flow.push('synth>prod');
        const big = M === 'e2e' || G === 'e2e';
        const labels = {
          e2e: big ? { label: 'Big E2E suite', sub: '200 tests · 45 min' } : { label: 'Small E2E suite', sub: '5 critical journeys' },
          prev: E === 'staging' ? { label: 'Shared staging', sub: 'all teams deploy here' } : E === 'preview' ? { label: 'Preview env', sub: 'per pull request' } : { label: 'Sandbox routing', sub: 'tagged requests only' },
          tc: M === 'unit' ? { label: 'In-memory fakes', sub: 'H2 · hand mocks' } : { label: 'Testcontainers', sub: 'real Postgres + Kafka' }
        };
        const badges = {};
        if (big) badges.e2e = ['slow + flaky', 'warn'];
        if (G === 'cid') badges.gate = ['version-aware', 'ok'];
        if (P === 'none') badges.prod = ['100% exposed', 'err'];
        if (M === 'unit') badges.tc = ['not the real DB', 'warn'];
        return {
          metrics, verdict, notes: notes.slice(0, 4), labels, hide, flow, badges,
          err: P === 'none' ? ['prod'] : [],
          warn: (big ? ['e2e'] : []).concat(E === 'staging' ? ['prev'] : []),
          ok: (G === 'cid' ? ['gate'] : []).concat(P !== 'none' ? ['canary'] : []),
          hot: big ? ['e2e'] : []
        };
      }
    },

    widget: {
      title: 'Contract lab: change a field, ask can-i-deploy',
      caption: 'One provider (<b>orders-api</b>) and two consumers. Tap a field to add or remove it in the <b>next</b> version of that application, then ask <b>can-i-deploy</b>. The broker checks the next version against what is <b>live</b> on the other side. Try removing <code>total</code>, then do it safely: add <code>amount</code>, move both consumers over, and remove <code>total</code> last. Turn the gate off to see what reaches production.'
    },

    realWorld: {
      intro: 'The ideas are older than the word "microservices". What the last decade added is tooling (brokers, containers for tests) and published experience from companies that outgrew the shared end-to-end suite.',
      timeline: [
        { when: '2006', who: 'Ian Robinson (Thoughtworks)', title: 'Consumer-Driven Contracts', text: 'Describes how a provider can evolve safely if each consumer states its expectations in a <b>consumer contract</b>, and the provider treats the sum of them as its obligations. Consumers should validate only the parts of a message they use ("just enough" validation).', src: 0 },
        { when: '2013', who: 'realestate.com.au', title: 'Pact is written', text: 'According to the Pact docs, the tool was first written in 2013 by a team at realestate.com.au to test integrations between their new Ruby microservices without traditional integration tests. It later spread to the JVM and other languages.', src: 2 },
        { when: '2014', who: 'Toby Clemson (Thoughtworks)', title: 'Testing Strategies in a Microservice Architecture', text: 'A widely used slide-style guide on martinfowler.com that names the layers for one service: <b>unit, integration, component, contract and end-to-end</b> tests, and ends with a test pyramid for microservices.', src: 1 },
        { when: '2015', who: 'Google Testing Blog', title: 'Just Say No to More End-to-End Tests', text: 'Mike Wacker argues against building a test strategy around end-to-end tests: they are slow, flaky and poor at isolating the failing change, and smaller tests should be preferred where they can catch the same bug. A 2020 Google post, "Fixing a Test Hourglass", continues the theme.', src: 3 },
        { when: '2017–2018', who: 'Cindy Sridharan', title: 'Testing Microservices, the sane way', text: 'Argues that testing all services together in a full replica environment defeats the purpose of independent services, and treats testing as a spectrum that continues <b>in production</b>. A follow-up, "Testing in Production, the safe way", lists the forms: canaries, shadowing, feature flags, monitoring.', src: 5 },
        { when: '2018', who: 'Spotify', title: 'The testing honeycomb', text: 'Spotify\'s "Testing of Microservices" proposes a <b>honeycomb</b> instead of a pyramid: mostly integration tests of one service through its interface, few implementation-detail tests, and ideally no <b>integrated</b> tests (tests that pass or fail depending on another system\'s correctness).', src: 4 },
        { when: '2022', who: 'Lyft', title: 'Staging overrides instead of full environments', text: 'As reported by InfoQ from Lyft\'s engineering series, Lyft stopped giving each developer a full isolated environment. It <b>isolates requests</b> inside shared staging: an Envoy filter routes requests carrying override metadata to the developer\'s instance.', src: 9 },
        { when: '2020s', who: 'Uber', title: 'SLATE: short-lived test environments', text: 'Uber\'s SLATE deploys only the services under test as an isolated slice with a production runtime. Requests tagged with a tenancy are routed to them, using context (baggage) propagated on every hop. Each environment has a time-to-live, two days by default.', src: 8 },
        { when: 'today', who: 'Pact · Testcontainers', title: 'The gate and the containers', text: 'The Pact Broker\'s <b>matrix</b> of contract and verification results feeds the <code>can-i-deploy</code> command; <code>record-deployment</code> tells it what is live. Testcontainers provides APIs in several languages for starting real dependencies in Docker and cleans them up with its Ryuk container.', src: 6 }
      ],
      lessons: [
        'Push each check to the <b>lowest layer</b> that can catch the bug.',
        'A contract belongs to the <b>consumer</b>; the provider learns what is really used.',
        'Gate on <b>versions that are live</b>, not on "the latest of everything".',
        'Isolate <b>requests</b>, not whole environments, once you have many services.',
        'Production is a test stage: <b>canary, compare, roll back</b>.'
      ],
      sources: [
        { title: 'Consumer-Driven Contracts: A Service Evolution Pattern', url: 'https://www.martinfowler.com/articles/consumerDrivenContracts.html', pub: 'Ian Robinson, martinfowler.com, June 2006' },
        { title: 'Testing Strategies in a Microservice Architecture', url: 'https://www.martinfowler.com/articles/microservice-testing', pub: 'Toby Clemson, martinfowler.com, November 2014' },
        { title: 'Pact history', url: 'https://docs.pact.io/history', pub: 'Pact documentation' },
        { title: 'Just Say No to More End-to-End Tests', url: 'https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html', pub: 'Mike Wacker, Google Testing Blog, April 2015' },
        { title: 'Testing of Microservices', url: 'https://engineering.atspotify.com/2018/01/11/testing-of-microservices', pub: 'Spotify Engineering, January 2018' },
        { title: 'Testing Microservices, the sane way', url: 'https://copyconstruct.medium.com/testing-microservices-the-sane-way-9bb31d158c16', pub: 'Cindy Sridharan, December 2017' },
        { title: 'Can I Deploy', url: 'https://docs.pact.io/pact_broker/can_i_deploy', pub: 'Pact documentation' },
        { title: 'Recording deployments and releases', url: 'https://docs.pact.io/record-release', pub: 'Pact documentation' },
        { title: 'Simplifying Developer Testing Through SLATE', url: 'https://www.uber.com/blog/simplifying-developer-testing-through-slate', pub: 'Uber Engineering' },
        { title: 'Lyft adopts request isolation for testing in staging', url: 'https://www.infoq.com/news/2022/03/scaling-testing-acceptance-lyft/', pub: 'InfoQ, March 2022 (reporting Lyft Engineering)' },
        { title: 'Getting started with Testcontainers', url: 'https://testcontainers.com/getting-started/', pub: 'Testcontainers' },
        { title: 'Fixing a Test Hourglass', url: 'https://testing.googleblog.com/2020/11/fixing-test-hourglass.html', pub: 'Google Testing Blog, November 2020' },
        { title: 'Testing in Production, the safe way', url: 'https://copyconstruct.medium.com/testing-in-production-the-safe-way-18ca102d0ef1', pub: 'Cindy Sridharan, March 2018' },
        { title: 'Shifting E2E Testing Left at Uber', url: 'https://www.uber.com/blog/shifting-e2e-testing-left/', pub: 'Uber Engineering' }
      ]
    },

    tradeoffs: {
      headers: ['Decision', 'Option A', 'Option B', 'Pick when…'],
      rows: [
        ['Checking a boundary', '<b>Contract test</b>: each side tested alone against a shared file; fast, exact failure', '<b>End-to-end test</b>: both sides running; proves the real wiring, slow and noisy', 'Contracts for every internal boundary; end-to-end for a handful of journeys that earn their cost'],
        ['Who writes the contract', '<b>Consumer-driven</b> (Pact): from consumer tests; shows what is really used', '<b>Provider-driven</b> (OpenAPI spec, Spring Cloud Contract in the producer repo)', 'Consumer-driven when you own both sides; provider-driven for public APIs or many unknown consumers'],
        ['Dependencies in tests', '<b>Real engine in a container</b> (Testcontainers): finds SQL, migration and broker bugs', '<b>In-memory fake</b> (H2, embedded broker): faster start, different behaviour', 'Containers by default; fakes only for pure logic tests where the engine does not matter'],
        ['Integration environment', '<b>Preview environment per PR</b>: isolated, costs grow with service count', '<b>Shared baseline + request routing</b>: deploy only what changed, needs context propagation', 'Previews while the system is small; routing once a full copy is too slow or too expensive to start'],
        ['Deploy gate', '<b>can-i-deploy</b>: seconds, version-aware, covers only what contracts state', '<b>Full regression in staging</b>: broad, slow, couples every team', 'can-i-deploy plus a canary; keep staging regressions for regulated releases that require them'],
        ['Where to find the rest', '<b>Pre-production load and soak tests</b>: controlled, never quite like production', '<b>Testing in production</b>: canary, shadow traffic, synthetic checks', 'Both, but invest first in the canary: it tests the change with the real data and neighbours']
      ]
    },
    failures: [
      { f: 'Contract drift: mocks or stubs nobody verifies', detect: 'Integration bugs reach production while every build is green', fix: 'Generate stubs from verified contracts only; fail the provider build on any unverified pact; gate deploys with can-i-deploy.' },
      { f: 'Over-specified contracts', detect: 'Provider builds break on harmless changes (a new field, a different example value)', fix: 'Use type and regex matchers, not exact values; assert only the fields the consumer reads; never test provider business rules through a pact.' },
      { f: 'Broker does not know what is live', detect: 'can-i-deploy passes, production still breaks; the "deployed" list is stale', fix: 'Make <code>record-deployment</code> the last step of every deploy pipeline, and record rollbacks too.' },
      { f: 'Flaky end-to-end gate', detect: 'Re-run rate climbs; median time from merge to deploy grows; people skip the suite', fix: 'Quarantine and fix or delete flaky tests; move assertions down a layer; cut the suite to critical journeys.' },
      { f: 'Provider states rot', detect: 'Verification fails on setup, not on the response; teams disable the failing interaction', fix: 'Keep state names few and stable; implement them with the service\'s own repositories; review them like API changes.' },
      { f: 'Preview environments pile up', detect: 'Cloud bill and cluster quota grow with open pull requests', fix: 'Time-to-live on every environment; deploy only changed services and route to a shared baseline for the rest.' },
      { f: 'Test traffic pollutes production data', detect: 'Synthetic orders appear in revenue reports or trigger real emails', fix: 'Mark test tenants end to end; filter them in analytics and billing; use sandbox modes of third parties.' }
    ],

    interview: [
      { q: 'How does the test pyramid change for microservices?', a: '<p>The pyramid (Mike Cohn, <i>Succeeding with Agile</i>, 2009) says: many fast unit tests, fewer service-level tests, very few UI tests. It still holds as a cost rule: <b>push each check to the cheapest layer that can catch the bug</b>.</p><p>What changes is where the risk is. A small service has little internal logic and many boundaries, so the valuable tests are <b>component tests</b> (one whole service through its API, real database in a container) and <b>contract tests</b> at each boundary. Spotify draws this as a <b>honeycomb</b>: a thick middle of service-level tests, few implementation-detail tests, and as few cross-service tests as possible. Toby Clemson\'s 2014 guide names the layers: unit, integration, component, contract, end-to-end.</p>', lvl: 'core' },
      { q: 'What is a consumer-driven contract test, step by step?', a: '<ol><li>The <b>consumer</b> test runs its real client against a mock server and states the request and the minimum response it needs. The tool records this as a contract (a pact).</li><li>The pact is published to a <b>broker</b> with the consumer\'s version.</li><li>The <b>provider</b> build fetches all pacts, sets up each "provider state", replays the requests against the real service and compares the responses with the matchers.</li><li>The result is stored per (contract, provider version).</li></ol><p>Neither side needs the other running. The term comes from Ian Robinson\'s 2006 article; Pact (2013) made it a tool.</p>', fu: 'Why consumer-driven and not provider-driven?', lvl: 'core' },
      { q: 'How does can-i-deploy work, and why is it better than "the pipeline was green"?', a: '<p>The broker keeps a <b>matrix</b>: every consumer version × provider version pair and whether verification passed. It also knows which version of each application is deployed in each environment, because pipelines call <code>record-deployment</code>.</p><p><code>can-i-deploy --pacticipant X --version V --to-environment production</code> asks: for every application X integrates with, is there a <b>successful verification between V and the version of that application currently in production</b>? If any is missing or failed, the answer is no.</p><p>A green pipeline only says "compatible with the other side\'s main branch at the time". The gate checks against <b>what is actually live</b>, which is what matters when services deploy independently and in any order.</p>', lvl: 'core' },
      { q: 'What do contract tests not cover?', a: '<ul><li><b>Provider business logic</b>: a pact checks shape and examples, not that tax is computed correctly. That is the provider\'s own test.</li><li><b>Behaviour across more than two services</b>: sagas, ordering, timeouts under load.</li><li><b>Non-functional properties</b>: latency, data volume, rate limits.</li><li><b>Consumers that publish no contract</b>, such as third parties.</li><li><b>Configuration and infrastructure</b>: wrong URL, missing permission, bad network policy.</li></ul><p>So you still need component tests, a few end-to-end journeys, and canaries plus synthetic checks in production.</p>', lvl: 'core' },
      { q: 'Why do large end-to-end suites fail at scale?', a: '<p>Three compounding effects:</p><ul><li><b>Noise multiplies.</b> A test crossing 6 services fails if any of them hiccups. With 0.2% noise per hop and 200 tests, the suite is green roughly 9% of the time with no bug at all.</li><li><b>Feedback is slow and vague.</b> The suite takes tens of minutes and a failure does not say which of 40 services caused it.</li><li><b>It couples teams.</b> Everyone shares one environment and one gate, so one broken service blocks all deploys. Independent deployability is lost.</li></ul><p>Google\'s 2015 "Just Say No to More End-to-End Tests" made the same argument. The fix is not zero end-to-end tests; it is a few critical journeys, with everything else moved down.</p>', lvl: 'core' },
      { q: 'What is a component test and why use Testcontainers for it?', a: '<p>A component test exercises <b>one whole service</b> through its public API, in one process, with other services replaced by stubs. It proves the service\'s behaviour, wiring, persistence and messaging together.</p><p>Testcontainers starts the <b>real</b> database, broker or cache in Docker for the test run and removes them afterwards. An in-memory substitute (H2 for Postgres, a fake Kafka) behaves differently for SQL dialect, locking, JSON operators, migrations and transaction isolation, so tests pass and production fails. With Spring Boot 3.1+ <code>@ServiceConnection</code> wires the container into the application context; equivalent libraries exist for Go, Python, Node and .NET.</p>', lvl: 'core' },
      { q: 'Pact or Spring Cloud Contract: how do they differ?', a: '<p><b>Pact</b> is consumer-driven and language-neutral. The consumer test generates the contract; a broker shares it; the provider verifies it. It suits polyglot systems and gives the can-i-deploy gate.</p><p><b>Spring Cloud Contract</b> usually keeps the contract (Groovy, YAML or Java DSL) in the <b>producer\'s</b> repository. The build generates provider tests from it and publishes a <b>stubs jar</b> (WireMock mappings) that consumers run with Stub Runner. It fits JVM-heavy organisations well and can still be used in a consumer-driven way if consumers send contracts as pull requests to the producer.</p><p>Both cover HTTP and messaging. I would pick by ecosystem: mixed languages or a need for the deploy gate, Pact; all Spring and Maven-based sharing, Spring Cloud Contract.</p>', lvl: 'deep' },
      { q: 'How do you contract-test asynchronous events?', a: '<p>Use a <b>message pact</b>. The consumer test states the message it expects (fields and types) and runs its real handler on an example. The provider test calls the code that <b>builds</b> the message and verifies the output against the pact. No broker is needed; transport is left to integration tests.</p><p>Combine it with a <b>schema registry</b> compatibility check (for Avro or Protobuf on Kafka). The registry stops structurally incompatible schemas at publish time; the pact adds what consumers actually rely on, which lets you remove a field once nobody reads it.</p>', lvl: 'deep' },
      { q: 'Shared staging is always broken. What are the alternatives?', a: '<ul><li><b>Ephemeral (preview) environment per pull request</b>: namespace with the changed service plus stubs or a small set of dependencies; deleted on merge. Simple, but a full copy of 100 services is slow and expensive.</li><li><b>Request-level isolation</b>: keep one stable baseline, deploy only the service under test, and route requests carrying a header to it. Lyft does this in staging with an Envoy filter; Uber\'s SLATE does it with tenancy in propagated baggage. It needs context propagation on every hop and separate handling for queues and data.</li><li><b>Less need for it</b>: contracts and component tests remove most reasons to integrate before production.</li></ul>', lvl: 'deep' },
      { q: 'What does "testing in production" mean, and how do you do it safely?', a: '<p>It means planned verification with real traffic and data, not skipping tests. Forms:</p><ul><li><b>Canary release</b>: a few percent of traffic, automated comparison with the baseline, automatic rollback.</li><li><b>Dark launch / shadow traffic</b>: the new code receives copied requests; its responses are discarded and compared.</li><li><b>Feature flags</b>: code is deployed but enabled for staff or 1% of users first.</li><li><b>Synthetic checks</b>: scripted journeys run all the time against production.</li></ul><p>Safety comes from a small blast radius, fast rollback, good telemetry per version, and keeping test data out of billing and analytics. See <a href="deployment-strategies.html">deployment strategies</a>.</p>', lvl: 'core' },
      { q: 'A team wants to remove a field from a response. How do they know it is safe?', a: '<p>With contracts, they try it. The provider build replays every consumer\'s pact. If any deployed consumer still reads the field, verification fails and names that consumer. If all pass, the field is unused by every consumer that publishes a contract.</p><p>The safe sequence is <b>expand–contract</b>: add the replacement, let consumers migrate and publish new pacts, deploy them, then remove the old field once can-i-deploy is green against production. For consumers without contracts (third parties), fall back to access logs or field-level usage metrics and a deprecation window.</p>', lvl: 'deep' },
      { q: 'You join a company with 60 services and a 2-hour staging regression that gates all releases. How do you change it?', a: '<p><em>Sample plan; adapt the numbers.</em></p><ul><li><b>Measure first</b>: failure causes for the last 100 red runs. Typically most are environment or test issues, not product bugs. This is the argument that convinces people.</li><li><b>Pilot</b> contract tests on the two or three busiest boundaries with one willing team pair; add the broker and can-i-deploy to their pipelines.</li><li><b>Add a canary</b> with automatic rollback, so removing a gate does not remove safety.</li><li><b>Move tests down</b>: for each end-to-end test, name what it proves and re-home it as a component or contract test; keep about five journeys.</li><li><b>Make the old gate advisory</b> for teams that meet the new bar, then retire it.</li></ul><p>Report lead time, change failure rate and escaped integration bugs before and after. I would not ask anyone to trust the idea; I would show the pilot\'s numbers.</p>', lvl: 'deep' }
    ],

    code: [
      {
        title: 'Node.js consumer test: the test writes the contract (Pact JS)', lang: 'js',
        code: `// npm i -D @pact-foundation/pact   (v12+), run with Jest or Vitest
const { PactV3, MatchersV3 } = require('@pact-foundation/pact');
const { integer, string, regex } = MatchersV3;
const { fetchOrder } = require('../src/ordersClient');   // the real client code

const provider = new PactV3({
  consumer: 'orders-web',
  provider: 'orders-api',
  dir: './pacts'                       // orders-web-orders-api.json is written here
});

describe('GET /orders/:id', () => {
  it('returns the fields the web app reads', () => {
    provider
      .given('order 42 exists')                        // provider state
      .uponReceiving('a request for order 42')
      .withRequest({ method: 'GET', path: '/orders/42',
                     headers: { Accept: 'application/json' } })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {                                        // only what we use, by type
          id: integer(42),
          status: regex('PENDING|PAID|SHIPPED', 'PAID'),
          total: integer(1999),
          currency: string('EUR')
        }
      });

    return provider.executeTest(async (mockServer) => {
      const order = await fetchOrder(mockServer.url, 42);
      expect(order.total).toBe(1999);                  // our code handled the response
    });
  });
});`,
        note: 'Matchers keep the contract loose: any integer satisfies <code>total</code>, and extra fields in the real response are ignored. If the test never reads a field, leave it out, so the provider stays free to change it.'
      },
      {
        title: 'Spring Boot provider: verify every consumer\'s pact against real Postgres', lang: 'java',
        code: `// Spring Boot 3.3+, Java 21. Test deps: au.com.dius.pact.provider:junit5spring,
// org.springframework.boot:spring-boot-testcontainers, org.testcontainers:postgresql
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@Provider("orders-api")
@PactBroker   // pactbroker.url and pactbroker.auth.token come from properties / env
class OrdersApiContractVerificationTest {

  @Container @ServiceConnection          // wires spring.datasource.* to the container
  static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

  @LocalServerPort int port;
  @Autowired OrderRepository orders;

  @BeforeEach
  void target(PactVerificationContext context) {
    context.setTarget(new HttpTestTarget("localhost", port));
  }

  @TestTemplate
  @ExtendWith(PactVerificationInvocationContextProvider.class)
  void verifyInteraction(PactVerificationContext context) {
    context.verifyInteraction();         // one JUnit test per interaction, per consumer
  }

  @State("order 42 exists")              // must match the consumer's given(...)
  void order42Exists() {
    orders.deleteAll();
    orders.save(new Order(42L, OrderStatus.PAID, 1999, "EUR"));
  }
}
// In CI: -Dpact.verifier.publishResults=true -Dpact.provider.version=<git sha>
//        -Dpact.provider.branch=<branch>   so the broker can fill its matrix.`,
        note: 'This one class is both a component test (the whole service, real database) and the provider side of every contract. Publish results only from CI, never from a laptop, or the matrix will contain versions that do not exist.'
      },
      {
        title: 'Pipeline: publish, gate with can-i-deploy, record the deployment', lang: 'bash',
        code: `#!/usr/bin/env bash
# Runs in each service's own pipeline. PACT_BROKER_BASE_URL and
# PACT_BROKER_TOKEN are CI secrets; the CLI is the pact-broker client.
set -euo pipefail
APP=orders-web
VERSION=$(git rev-parse HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)

npm test                                   # unit + consumer contract tests

pact-broker publish ./pacts \\
  --consumer-app-version "$VERSION" --branch "$BRANCH"

# Is this exact version verified against what is live in production?
# Wait up to 2 minutes for the provider's verification build to report.
pact-broker can-i-deploy \\
  --pacticipant "$APP" --version "$VERSION" \\
  --to-environment production \\
  --retry-while-unknown 12 --retry-interval 10

./deploy.sh production "$VERSION"          # canary + automatic rollback live here

# Last step, only after the rollout finished: tell the broker what is live.
pact-broker record-deployment \\
  --pacticipant "$APP" --version "$VERSION" --environment production`,
        note: 'The provider pipeline has the same gate and the same last step. <code>--retry-while-unknown</code> covers the short window in which the provider has not yet verified a brand-new contract.'
      }
    ],

    related: ['ms-operations', 'ms-communication', 'ms-antipatterns-migration', 'deployment-strategies', 'api-design', 'platform-engineering', 'sd:feature-flags']
  });
})();

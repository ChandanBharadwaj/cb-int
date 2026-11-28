(function () {
  const chain = (v) => Math.pow(v.avail / 100, Math.round(v.depth));     // availability of a synchronous chain
  const DEPLOY_OK = 0.95;                                                 // estimate: one deploy succeeds first time

  SD.register({
    slug: 'ms-antipatterns-migration',
    domain: 10,
    title: 'Microservices Anti-patterns & Migration Playbook',
    examples: 'Segment, Amazon Prime Video, Monzo',
    tagline: 'How microservices go wrong (<b>distributed monolith</b>, <b>shared database</b>, <b>chatty calls</b>, <b>nano-services</b>, coupling libraries, long synchronous chains), a step-by-step way to move from a monolith to services safely, and when to <b>merge services back</b>.',
    tldr: {
      problem: 'Teams split a monolith to move faster and end up slower: every feature touches five services, they all read the same tables, one slow service stalls the rest, and a release needs a meeting. They have a <b>distributed monolith</b>: the coupling of a monolith plus the failure modes of a network.',
      idea: 'Judge a split by one test: <b>can each service be changed and deployed alone?</b> Remove what prevents it: shared tables, shared domain libraries, synchronous chains, services cut too small. Migrate <b>one slice at a time</b> behind a facade, moving the data with the code, and stop when the goal is met.',
      insight: 'Service boundaries are a bet about what changes together. When the bet is wrong, <b>merging is a valid fix</b>, not a defeat. Segment, Amazon Prime Video and Istio have each published a case of merging services back.',
      numbers: [
        { v: '0.999⁵ ≈ 99.5%', l: 'five services called in a chain at 99.9% each: about 3.6 hours down per month (math)' },
        { v: '90%', l: 'infrastructure cost cut Prime Video reported for one monitoring service after merging it into one process (2023)' },
        { v: '2020', l: 'Istio 1.5 merges its control-plane microservices into one binary, istiod (Istio blog)' }
      ]
    },

    intro: {
      what: 'An <b>anti-pattern</b> is a common design that looks reasonable and reliably causes trouble. The microservices anti-patterns share one root: services that are deployed separately but <b>cannot change separately</b>. The worst case has a name, the <b>distributed monolith</b>. This page lists the patterns, shows how to spot each, and gives a safe order of steps for moving from a monolith to services.',
      analogy: {
        icon: '🏠',
        title: 'Flatmates with one bank account',
        text: 'Four people move out of the family home to be independent, but keep a joint bank account, one shared calendar, and a rule that nobody eats until everyone is home. They now pay four rents and still cannot decide anything alone. Real independence means separate accounts and leaving a note instead of waiting at the door. Splitting the address did nothing; splitting what they <b>share</b> does. Unlike flatmates, services can also be merged back cheaply when living apart does not pay off.'
      },
      problem: 'A shop splits its monolith into Order, Customer, Price and Stock services in three months. All four still read and write the same database. To add a discount field, four teams change code and release on the same night. When Price is slow, checkout is slow. <b>How do you tell a real service split from a monolith with network calls inside, and how do you get from one to the other safely?</b>',
      story: [
        {
          stage: 'naive',
          title: 'Cut along the tables',
          text: 'The team makes one service per main table and keeps the existing database, because moving data is hard. Services call each other over HTTP wherever the old code called a method. It ships quickly and the diagram looks like microservices.',
          scene: {
            nodes: [
              { id: 'web', label: 'Checkout', sub: 'one request', kind: 'client', at: [210, 0] },
              { id: 'o', label: 'Order svc', sub: 'calls Customer', kind: 'service', at: [70, 110] },
              { id: 'c', label: 'Customer svc', sub: 'calls Price', kind: 'service', at: [210, 110] },
              { id: 'p', label: 'Price svc', sub: 'per-item calls', kind: 'service', at: [350, 110] },
              { id: 'db', label: 'Shared DB', sub: 'all tables', kind: 'store', at: [210, 220] }
            ],
            edges: [{ from: 'web', to: 'o' }, { from: 'o', to: 'c' }, { from: 'c', to: 'p' }, { from: 'o', to: 'db' }, { from: 'c', to: 'db' }, { from: 'p', to: 'db' }],
            flow: ['web>o', 'o>c', 'c>p', ['o>db', 'c>db', 'p>db']],
            badges: { db: ['one schema', 'info'] }
          }
        },
        {
          stage: 'breaks',
          title: 'A monolith with a network in the middle',
          text: 'One column change breaks three services, so they release together. A slow Price service makes every checkout slow, and each hop adds its own chance of failure. The team now has the monolith\'s coupling and the network\'s problems.',
          scene: {
            nodes: [
              { id: 'web', label: 'Checkout', sub: 'timing out', kind: 'client', at: [210, 0] },
              { id: 'o', label: 'Order svc', sub: 'waiting', kind: 'service', at: [70, 110] },
              { id: 'c', label: 'Customer svc', sub: 'waiting', kind: 'service', at: [210, 110] },
              { id: 'p', label: 'Price svc', sub: 'slow', kind: 'service', at: [350, 110] },
              { id: 'db', label: 'Shared DB', sub: 'column renamed', kind: 'store', at: [210, 220] }
            ],
            edges: [{ from: 'web', to: 'o' }, { from: 'o', to: 'c' }, { from: 'c', to: 'p' }, { from: 'o', to: 'db' }, { from: 'c', to: 'db' }, { from: 'p', to: 'db' }],
            flow: ['web>o', 'o>c', 'c>p'],
            err: ['p', 'web'], warn: ['o', 'c', 'db'],
            badges: { p: ['slow', 'err'], db: ['3 services break', 'warn'], web: ['timeout', 'err'] }
          }
        },
        {
          stage: 'fix',
          title: 'Fewer services, own data, fewer waits',
          text: 'Cut by business capability, not by table. Each service <b>owns its data</b> and publishes changes as events, so others keep the copy they need. A request waits on as few services as possible. Move one slice at a time, and merge two services that always change together.',
          scene: {
            nodes: [
              { id: 'web', label: 'Checkout', sub: 'one call', kind: 'client', at: [210, 0] },
              { id: 'o', label: 'Orders', sub: 'own data + copies', kind: 'service', at: [70, 110] },
              { id: 'bus', label: 'Events', sub: 'price changed', kind: 'queue', at: [210, 110] },
              { id: 'p', label: 'Catalog', sub: 'prices + stock', kind: 'service', at: [350, 110] },
              { id: 'odb', label: 'Orders DB', sub: 'private', kind: 'store', at: [70, 220] },
              { id: 'pdb', label: 'Catalog DB', sub: 'private', kind: 'store', at: [350, 220] }
            ],
            edges: [{ from: 'web', to: 'o' }, { from: 'p', to: 'bus' }, { from: 'bus', to: 'o' }, { from: 'o', to: 'odb' }, { from: 'p', to: 'pdb' }],
            flow: ['p>bus', 'bus>o', 'web>o', 'o>odb'],
            ok: ['o', 'odb', 'pdb'],
            badges: { o: ['deploys alone', 'ok'] }
          }
        }
      ],
      usedBy: ['Segment (merged a service-per-destination design, 2018)', 'Amazon Prime Video (one monitoring service, 2023)', 'Istio (control plane merged into istiod, 2020)', 'Shopify (modular monolith)', 'Uber (domains over thousands of services)', 'Monzo (thousands of services with a strong platform)'],
      whenToUse: [
        'You are planning to split a monolith and want the <b>order of steps</b> and the traps',
        'You already have services, but releases are <b>coordinated</b> and incidents spread across them',
        'You suspect some services are <b>too small</b> and want criteria for merging them'
      ],
      whenNot: [
        'The monolith is not the bottleneck: the pain is tests, deploy automation or team structure. Fix those first (see <a href="tech-debt.html">technical debt</a>)',
        'You have not chosen boundaries yet: start with <a href="ms-service-boundaries.html">service boundaries</a> and <a href="ddd.html">domain-driven design</a>',
        'You want the details of routing traffic to the new system: see <a href="strangler-fig.html">strangler fig</a>'
      ],
      glossary: [
        { term: 'Distributed monolith', def: 'Services that are deployed separately but must be changed, tested or released together.' },
        { term: 'Shared database', def: 'Several services reading and writing the same tables, so the schema becomes a hidden API between them.' },
        { term: 'Chatty calls', def: 'Many small remote calls where one coarse call would do, such as one call per item in a list.' },
        { term: 'Nano-service', def: 'A service so small that the cost of running it and calling it outweighs what it does.' },
        { term: 'Synchronous call chain', def: 'A request that waits on service A, which waits on B, which waits on C; every link must be up and fast.' },
        { term: 'Seam', def: 'A place in a codebase where one part can be separated from another without changing behaviour.' },
        { term: 'Strangler fig', def: 'Replacing a system piece by piece behind a facade that routes each request to old or new code.' },
        { term: 'Temporal coupling', def: 'Two services that keep changing in the same commits or releases, a sign they belong together.' }
      ]
    },

    requirements: {
      functional: [
        '<b>Independent deployability is the test</b>: a normal change touches one service and ships alone',
        '<b>Each service owns its data</b>; others get it through an API or events, never through its tables',
        '<b>Boundaries follow business capabilities</b>, not tables, layers or technical functions',
        '<b>Keep synchronous depth small</b>: a user request should wait on one or two services, not a chain',
        '<b>Share infrastructure code, not domain code</b>: a shared library must never force a joint release',
        '<b>Migrate incrementally</b>: one slice, in production, with a way back, before the next'
      ],
      nonFunctional: [
        'Share of changes needing more than one service released together: under 10% (<em>example target</em>)',
        'Synchronous call depth on critical paths at most 2–3; remote calls per request counted and budgeted',
        'Zero cross-service table access (checked by database roles, not by convention)',
        'Each service can be built, tested and started without any other service running',
        'Every migration step reversible within minutes by a routing or flag change',
        'Number of services stays in proportion to teams: a few per team, not dozens (<em>rule of thumb</em>)'
      ],
      outOfScope: [
        '<b>Big-bang rewrite</b>: build the new system for a year, switch over in a weekend',
        '<b>Entity services</b>: one CRUD service per table, with business logic spread across callers',
        '<b>Microservices as a goal</b>: splitting with no stated problem and no measure of success',
        '<b>Splitting code but not data</b>: new services on the old schema, "to be fixed later"',
        '<b>Migration that never ends</b>: old and new paths both kept alive for years'
      ]
    },

    calculator: {
      inputs: [
        { id: 'depth', label: 'Services in the synchronous chain', min: 1, max: 12, value: 5 },
        { id: 'avail', label: 'Availability of each service', min: 99, max: 99.99, value: 99.9, step: 0.01, unit: '%' },
        { id: 'lat', label: 'Latency of one remote call (p50)', min: 2, max: 200, value: 20, unit: 'ms', log: true },
        { id: 'calls', label: 'Remote calls made for one user request', min: 1, max: 100, value: 12, log: true },
        { id: 'lock', label: 'Services that must be released together', min: 1, max: 20, value: 4 }
      ],
      outputs: [
        { label: 'Availability of the whole chain', fmt: 'raw', f: (v) => (chain(v) * 100).toFixed(3) + ' %' },
        { label: 'Expected downtime per 30-day month', fmt: 'raw', f: (v) => { const m = (1 - chain(v)) * 43200; return m >= 120 ? (m / 60).toFixed(1) + ' h' : m.toFixed(0) + ' min'; } },
        { label: 'Failed requests per million', fmt: 'num', f: (v) => Math.round((1 - chain(v)) * 1e6) },
        { label: 'Time spent in remote calls: one after another · one batched call per service', fmt: 'raw', f: (v) => Math.round(v.calls * v.lat) + ' ms · ' + Math.round(Math.min(v.calls, v.depth) * v.lat) + ' ms' },
        { label: 'Requests that hit at least one slow (p99) call', fmt: 'pct', f: (v) => 1 - Math.pow(0.99, Math.round(v.calls)) },
        { label: 'Lockstep release succeeds first time (each deploy 95%, estimate)', fmt: 'pct', f: (v) => Math.pow(DEPLOY_OK, Math.round(v.lock)) }
      ],
      note: 'Failures are assumed independent, and no retries, caches or fallbacks are modelled: this is the <b>worst case of a plain synchronous chain</b>. Availability multiplies along the chain. Tail latency does too: with 12 calls, about 11% of requests include at least one call slower than its own p99. The last row assumes each deploy succeeds first time with probability 95%, an <em>estimate</em>; the point is that a release needing four services is much less likely to go cleanly than four separate ones, and a failure rolls back all four.'
    },

    api: [
      { m: 'ADR', p: 'ADR: why we split (or do not)', d: 'The problem in numbers (lead time, teams blocked, scaling limit), the goal, the measure of success, the first slice and what is explicitly <b>not</b> being split. Without this the migration has no finish line.' },
      { m: 'DOC', p: 'Coupling report', d: 'Per pair of services: shared tables, calls per request, co-change rate from version control, shared library versions. Reviewed each quarter; pairs above a threshold are candidates to merge or to decouple.' },
      { m: 'DOC', p: 'Migration playbook for one slice', d: 'The fixed order: find the seam, facade in front, extract code, give it its own data, synchronise both ways, shift reads then writes, remove the old path. With an owner and a rollback for each step.' },
      { m: 'SQL', p: 'Schema ownership and grants', d: 'One schema and one database role per service. No role can read another service\'s schema. Temporary exceptions are views with an expiry date.' },
      { m: 'POLICY', p: 'Shared library rules', d: 'Allowed: logging, tracing, HTTP client setup, test helpers. Not allowed: domain classes, DTOs of another service, database entities. Every release must be backward compatible; services upgrade when they choose.' },
      { m: 'RFC', p: 'Merge proposal', d: 'Evidence that two services belong together (co-change rate, same team, a chatty interface, a transaction that spans them), the merged design, and what is lost (separate scaling or isolation).' }
    ],
    dataModel: [
      { name: 'coupling_edge', store: 'Architecture metrics (Postgres)', fields: [['service_a', 'text', 'pk'], ['service_b', 'text', 'pk'], ['kind', 'sync_call|shared_table|shared_lib|co_change', 'pk'], ['weight', 'numeric'], ['measured_at', 'date', 'idx']], note: 'Filled from traces (calls per request), database grants (shared tables), build files (libraries) and version control (co-change). The graph of these rows is the real architecture.' },
      { name: 'migration_slice', store: 'Migration tracker', fields: [['slice', 'text', 'pk'], ['owner_team', 'text'], ['step', 'seam|facade|extracted|own_data|reads_moved|writes_moved|old_removed'], ['traffic_pct', 'smallint'], ['rollback', 'text'], ['started_at', 'date', 'idx']], note: 'A slice is done only at <code>old_removed</code>. Count slices stuck before that step: they are the cost of the migration.' },
      { name: 'table_ownership', store: 'Data catalog', fields: [['schema_name', 'text', 'pk'], ['table_name', 'text', 'pk'], ['owner_service', 'text', 'idx'], ['other_readers', 'text[]'], ['other_writers', 'text[]']], note: 'A table with more than one writer is the hardest to split; do those last or redesign them. Readers can move to an API, events or a replica.' },
      { name: 'release', store: 'Deploy system', fields: [['release_id', 'uuid', 'pk'], ['services', 'text[]'], ['change_ref', 'text', 'idx'], ['released_at', 'timestamptz', 'idx'], ['rolled_back', 'boolean']], note: 'The share of releases with more than one service is the simplest number that shows a distributed monolith.' }
    ],

    architecture: {
      title: 'Half-way through a migration: where the anti-patterns appear',
      nodes: [
        { id: 'client', label: 'Client', sub: 'web · mobile', kind: 'client', wide: [95, 0], tall: [70, 0], tip: 'Sees one API. It should not notice which requests are served by the monolith and which by new services.' },
        { id: 'proxy', label: 'Facade', sub: 'routes old vs new', kind: 'edge', wide: [290, 0], tall: [210, 0], tip: 'A proxy or gateway in front of everything. Moving a slice is a routing change, and so is rolling it back.' },
        { id: 'mono', label: 'Monolith', sub: 'shrinking', kind: 'service', wide: [490, 0], tall: [70, 105], tip: 'Still serves everything that has not been extracted. A well-modularised monolith may be where you choose to stop.' },
        { id: 'monodb', label: 'Monolith DB', sub: 'all legacy tables', kind: 'store', wide: [690, 0], tall: [70, 210], tip: 'The hardest part of the migration. Code is easy to move; shared tables are what keep services coupled.' },
        { id: 'orders', label: 'Orders service', sub: 'extracted slice', kind: 'service', wide: [490, 115], tall: [210, 105], tip: 'The first extracted capability. It is a real service only once it has its own data and its own release.' },
        { id: 'ordb', label: 'Orders DB', sub: 'owned by Orders', kind: 'store', wide: [690, 115], tall: [210, 210], tip: 'Private to the Orders service. Other services get order data from its API or its events.' },
        { id: 'cdc', label: 'Change capture', sub: 'old tables → events', kind: 'compute', wide: [890, 115], tall: [70, 315], tip: 'Streams changes from the legacy tables so the new service\'s database stays in step while both exist.' },
        { id: 'lib', label: 'Shared library', sub: 'common-domain v7', kind: 'policy', wide: [290, 230], tall: [350, 105], tip: 'Fine for logging and tracing. If it holds domain classes, every service that uses it must upgrade together.' },
        { id: 'pay', label: 'Payments service', sub: 'called by Orders', kind: 'service', wide: [490, 230], tall: [350, 210], tip: 'Called synchronously by Orders during checkout, so checkout is only as available and as fast as both together.' },
        { id: 'bus', label: 'Kafka', sub: 'domain events', kind: 'queue', wide: [690, 230], tall: [210, 315], tip: 'Carries data changes between services so they do not need each other\'s tables or a synchronous call.' },
        { id: 'paydb', label: 'Payments DB', sub: 'owned by Payments', kind: 'store', wide: [490, 345], tall: [350, 315], tip: 'Private to Payments.' }
      ],
      edges: [
        { from: 'client', to: 'proxy' },
        { from: 'proxy', to: 'mono' },
        { from: 'proxy', to: 'orders' },
        { from: 'mono', to: 'monodb' },
        { from: 'orders', to: 'ordb' },
        { from: 'orders', to: 'monodb', dashed: true, label: 'shortcut' },
        { from: 'orders', to: 'pay' },
        { from: 'pay', to: 'paydb' },
        { from: 'monodb', to: 'cdc' },
        { from: 'cdc', to: 'bus' },
        { from: 'bus', to: 'ordb', bidi: true },
        { from: 'bus', to: 'pay', bidi: true },
        { from: 'lib', to: 'orders', dashed: true },
        { from: 'lib', to: 'pay', dashed: true }
      ]
    },

    scenarios: [
      {
        id: 'playbook', title: 'Playbook: extract Orders safely', tone: 'ok',
        steps: [
          { text: '<b>1. Seam and facade.</b> Inside the monolith, put order code behind one interface. Put a facade in front of the monolith. Nothing has moved yet; every request still goes to the monolith.', flow: ['client>proxy', 'proxy>mono', 'mono>monodb'], hidden: ['orders', 'ordb', 'pay', 'paydb', 'bus', 'cdc', 'lib'], badges: { proxy: '100% → monolith' } },
          { text: '<b>2. Extract the code.</b> Deploy the Orders service. Send it a copy of real requests and compare its answers with the monolith\'s. Users still get the monolith\'s answer.', flow: ['client>proxy', ['proxy>mono', 'proxy>orders']], hidden: ['pay', 'paydb', 'lib', 'bus', 'cdc', 'ordb'], badges: { orders: 'shadow traffic' } },
          { text: '<b>3. Give it its own data.</b> Create the Orders database. Backfill it and keep it in step with the legacy tables through change capture.', flow: ['monodb>cdc', 'cdc>bus', 'bus>ordb'], hidden: ['pay', 'paydb', 'lib'], ok: ['ordb'], badges: { ordb: ['in sync', 'ok'] } },
          { text: '<b>4. Shift traffic.</b> Route 5% of order reads to the new service, then 50%, then all. Then writes. Each step is a routing change that can be undone in seconds.', flow: ['client>proxy', 'proxy>orders', 'orders>ordb'], hidden: ['pay', 'paydb', 'lib'], ok: ['orders'], badges: { proxy: ['orders: 100% new', 'ok'] } },
          { text: '<b>5. Remove the old path.</b> Delete the order code and tables from the monolith and switch off the sync. This is the step teams skip, and skipping it leaves two systems to maintain.', flow: ['client>proxy', 'proxy>orders', 'orders>ordb'], hidden: ['pay', 'paydb', 'lib', 'cdc'], ok: ['orders', 'ordb'], labels: { monodb: { label: 'Monolith DB', sub: 'order tables dropped' } }, badges: { mono: ['order code deleted', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'shareddb', title: 'Shared database shortcut', tone: 'err',
        steps: [
          { text: 'To save time, the new Orders service reads customer and price data <b>straight from the monolith\'s tables</b>. No API to build, no data to copy.', flow: ['proxy>orders', 'orders>monodb'], hidden: ['cdc', 'bus', 'lib'], warn: ['orders'], badges: { orders: ['SELECT … FROM customers', 'warn'] } },
          { text: 'The monolith team renames <code>customers.surname</code> in a normal refactoring. Their tests pass. They do not know another service reads that column.', flow: ['mono>monodb'], hidden: ['cdc', 'bus', 'lib'], badges: { monodb: 'column renamed' } },
          { text: 'Orders starts failing in production. The table schema had become an <b>undeclared API</b>, with no version, no contract test and no owner on the other side.', flow: ['orders>monodb'], hidden: ['cdc', 'bus', 'lib'], err: ['orders', 'monodb'], badges: { orders: ['column not found', 'err'] }, tone: 'err' },
          { text: 'From now on every schema change needs both teams and a joint release. Two deployables, one unit of change: a <b>distributed monolith</b>.', nodes: ['mono', 'orders', 'monodb'], hidden: ['cdc', 'bus', 'lib'], warn: ['mono', 'orders'], badges: { monodb: ['release together', 'warn'] }, tone: 'warn' },
          { text: 'Fix: the owner publishes the data (an API, or events through change capture) and Orders keeps its own copy. Then revoke the database grant, so the rule holds without anyone remembering it.', flow: ['monodb>cdc', 'cdc>bus', 'bus>ordb', 'orders>ordb'], hidden: ['lib'], ok: ['ordb', 'orders'], badges: { monodb: ['grant revoked', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'chain', title: 'Peak load on a synchronous chain', tone: 'warn',
        steps: [
          { text: 'Checkout calls Orders, which calls Payments, which calls two more services, all synchronously. Each link adds latency and its own chance of failing.', flow: ['client>proxy', 'proxy>orders', 'orders>pay', 'pay>paydb'], hidden: ['cdc', 'lib'], badges: { orders: 'waits for Payments' } },
          { text: 'On a sale day, Payments slows from 50 ms to 2 s. Orders\' request threads fill up waiting for it. Orders stops answering requests that have nothing to do with payment.', flow: ['proxy>orders', 'orders>pay'], hidden: ['cdc', 'lib'], err: ['pay'], warn: ['orders'], hot: ['pay'], badges: { pay: ['2 s', 'err'], orders: ['threads exhausted', 'warn'] }, tone: 'err' },
          { text: 'Callers time out and retry. Each layer retries three times, so Payments receives many times the original load exactly when it is weakest.', flow: ['client>proxy', 'proxy>orders', 'orders>pay'], hidden: ['cdc', 'lib'], err: ['pay', 'orders'], badges: { pay: ['retry storm', 'err'] }, tone: 'err' },
          { text: 'Short-term fix: timeouts, a retry budget, a circuit breaker and a bulkhead per dependency. See <a href="resiliency-patterns.html">resiliency patterns</a>.', flow: ['proxy>orders'], hidden: ['cdc', 'lib'], warn: ['pay'], ok: ['orders'], badges: { orders: ['breaker open', 'ok'] } },
          { text: 'Structural fix: take Payments out of the request path. Orders accepts the order as <code>PENDING</code> and publishes an event; Payments processes it at its own pace.', flow: ['proxy>orders', 'orders>ordb', 'ordb>bus', 'bus>pay'], hidden: ['cdc', 'lib'], ok: ['orders', 'bus', 'pay'], badges: { orders: ['202 Accepted', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'lib', title: 'A shared library that locks releases', tone: 'warn',
        steps: [
          { text: 'To avoid duplication, the teams put the <code>Order</code>, <code>Money</code> and <code>Customer</code> classes into <code>common-domain</code>. Every service depends on it.', flow: ['lib>orders', 'lib>pay'], hidden: ['cdc'], badges: { lib: 'v7: domain classes' } },
          { text: 'Payments needs a new field on <code>Money</code>. That means a new library version, and both services serialise this class to each other.', flow: ['lib>pay'], hidden: ['cdc'], warn: ['lib'], badges: { lib: ['v8 needed', 'warn'] } },
          { text: 'Services on v7 and v8 cannot talk reliably, so everyone must upgrade and release <b>together</b>. A code-sharing decision has become a release-coupling decision.', flow: ['lib>orders', 'lib>pay', 'orders>pay'], hidden: ['cdc'], err: ['lib'], warn: ['orders', 'pay'], badges: { lib: ['lockstep upgrade', 'err'] }, tone: 'err' },
          { text: 'Fix: each service defines the types it needs and maps at its boundary. Share only stable technical code, and keep every library release backward compatible. A little duplication is cheaper than coupling.', flow: ['orders>pay'], hidden: ['cdc'], ok: ['orders', 'pay'], labels: { lib: { label: 'Shared library', sub: 'logging · tracing only' } }, badges: { lib: ['no domain types', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'merge', title: 'Merging two services back', tone: 'ok',
        steps: [
          { text: 'Version control shows that Orders and Payments changed in the <b>same pull request or release</b> in most changes this year. One team owns both.', nodes: ['orders', 'pay'], hidden: ['cdc', 'lib'], warn: ['orders', 'pay'], badges: { orders: ['change together', 'warn'] } },
          { text: 'Traces show eight calls between them for each checkout, and a saga exists only to keep their two databases consistent.', flow: ['orders>pay', 'pay>paydb', 'orders>ordb'], hidden: ['cdc', 'lib'], warn: ['pay'], badges: { pay: ['8 calls / checkout', 'warn'] } },
          { text: 'The boundary was a wrong guess. Merge them: one deployable, one database, a local transaction in place of the saga, method calls in place of remote calls.', flow: ['proxy>orders', 'orders>ordb'], hidden: ['cdc', 'lib', 'pay', 'paydb'], ok: ['orders', 'ordb'], labels: { orders: { label: 'Checkout service', sub: 'orders + payments' }, ordb: { label: 'Checkout DB', sub: 'one transaction' } }, badges: { orders: ['merged', 'ok'] } },
          { text: 'Keep the internal module boundary so it can be split again if a real reason appears, such as separate scaling or a second team. Merging is ordinary refactoring at a larger scale.', flow: ['client>proxy', 'proxy>orders', 'orders>ordb'], hidden: ['cdc', 'lib', 'pay', 'paydb'], ok: ['orders'], labels: { orders: { label: 'Checkout service', sub: 'orders + payments' }, ordb: { label: 'Checkout DB', sub: 'one transaction' } }, tone: 'ok' }
        ]
      }
    ],

    knobs: {
      intro: 'Each control is a real choice during a monolith-to-services migration for about 8 teams. Meter values are <em>illustrative</em> judgements, not benchmarks.',
      controls: [
        { id: 'pace', label: 'Migration approach', type: 'seg', value: 'strangler', options: [
          { v: 'bigbang', l: 'Big-bang rewrite' }, { v: 'strangler', l: 'One slice at a time' }, { v: 'modular', l: 'Stay a modular monolith' }] },
        { id: 'data', label: 'Data ownership', type: 'seg', value: 'own', options: [
          { v: 'shared', l: 'Shared database' }, { v: 'sync', l: 'Own DB, synced from legacy' }, { v: 'own', l: 'Own DB + events' }] },
        { id: 'calls', label: 'Calls on the request path', type: 'seg', value: 'async', options: [
          { v: 'chain', l: 'Deep synchronous chain' }, { v: 'guard', l: 'Sync with timeouts + batching' }, { v: 'async', l: 'Mostly async events' }] },
        { id: 'size', label: 'Service size', type: 'seg', value: 'ctx', options: [
          { v: 'nano', l: 'One per entity / function' }, { v: 'ctx', l: 'One per business capability' }, { v: 'big', l: 'A few large services' }] }
      ],
      evaluate(s) {
        const clamp = (x) => Math.max(0.03, Math.min(0.97, x));
        const D = s.data, C = s.calls, Z = s.size, P = s.pace, mod = P === 'modular';
        let indep = { shared: 0.15, sync: 0.6, own: 0.85 }[D] + { chain: -0.1, guard: 0, async: 0.05 }[C] + { nano: -0.2, ctx: 0.05, big: -0.1 }[Z];
        let avail = { chain: 0.3, guard: 0.65, async: 0.85 }[C] + { shared: -0.12, sync: 0, own: 0.03 }[D] + { nano: -0.12, ctx: 0, big: 0.05 }[Z];
        let lat = { chain: 0.35, guard: 0.62, async: 0.8 }[C] + { nano: -0.22, ctx: 0, big: 0.1 }[Z];
        let ops = { nano: 0.15, ctx: 0.55, big: 0.78 }[Z] + { shared: 0.05, sync: -0.1, own: -0.03 }[D];
        const risk = { bigbang: 0.1, strangler: 0.75, modular: 0.88 }[P] + (D === 'sync' ? -0.05 : 0);
        let cons = { shared: 0.9, sync: 0.45, own: 0.4 }[D] + { chain: 0.05, guard: 0.03, async: -0.08 }[C] + (Z === 'nano' ? -0.15 : 0);
        if (mod) {   // one process: the same choices now describe module design, not network topology
          indep = 0.32 + { shared: -0.14, sync: 0, own: 0.08 }[D] + { nano: -0.05, ctx: 0.03, big: -0.03 }[Z];
          avail = 0.8 + { chain: -0.08, guard: 0, async: 0.05 }[C];
          lat = 0.88 + { chain: -0.05, guard: 0, async: 0.03 }[C];
          ops = 0.85 + { nano: -0.12, ctx: 0.03, big: 0.06 }[Z];
          cons = 0.9 + { shared: 0.04, sync: -0.06, own: -0.03 }[D];
        }
        const metrics = [
          { k: 'Independent deploys', v: mod ? (D === 'shared' ? 'one deployable, modules tangled through tables' : D === 'sync' ? 'one deployable, tables being separated' : 'one deployable, each module owns its tables') : indep >= 0.7 ? 'each service ships alone' : indep >= 0.4 ? 'some lockstep releases' : 'services ship together', s: clamp(indep) },
          { k: 'Checkout availability', v: mod ? (C === 'chain' ? 'one process: a bad module can take all down' : C === 'guard' ? 'one process, modules behind clear APIs' : 'one process, slow work moved to background events') : avail >= 0.75 ? 'one slow service does not stop checkout' : avail >= 0.5 ? 'degrades, then recovers' : 'any slow link stops it', s: clamp(avail) },
          { k: 'Request latency', v: mod ? (C === 'chain' ? 'in-process, deep call stacks' : C === 'guard' ? 'in-process calls through module APIs' : 'in-process, events between modules') : lat >= 0.7 ? 'one or two hops' : lat >= 0.45 ? 'several hops, bounded' : 'many hops in sequence', s: clamp(lat) },
          { k: 'Operational overhead', v: mod ? (Z === 'nano' ? 'one deploy, dozens of tiny modules' : Z === 'ctx' ? 'one deploy, a module per capability' : 'one deploy, a few large modules') : ops >= 0.75 ? 'few things to run' : ops >= 0.45 ? 'a platform is needed' : 'more services than people can know', s: clamp(ops), hint: 'lower bar = more to run' },
          { k: 'Migration risk', v: P === 'bigbang' ? 'all risk on cut-over day' : P === 'strangler' ? 'small steps, each reversible' : 'no migration: refactor in place', s: clamp(risk) },
          { k: 'Data consistency effort', v: mod && D !== 'shared' ? 'local transactions; joins only inside a module' : cons >= 0.75 ? 'local transactions and joins' : cons >= 0.45 ? 'sync lag to manage' : 'sagas, copies and eventual consistency', s: clamp(cons), hint: 'lower bar = more work' }
        ];
        const notes = [];
        if (P === 'bigbang') notes.push('A rewrite must match years of undocumented behaviour before it delivers anything, while the old system keeps changing. Value arrives only at the end, if it arrives.');
        if (mod) notes.push('A modular monolith keeps one deploy but enforces module boundaries and data ownership per module. Shopify chose this route. The other three controls then describe module design, not network topology.');
        if (!mod && D === 'shared') notes.push('With a shared database the schema is an undeclared API. Any service can break any other with a column change, and nobody can change the schema alone.');
        if (!mod && D === 'sync') notes.push('Two-way sync between legacy tables and the new database is a temporary bridge. It has lag and conflict cases; give it an end date.');
        if (!mod && C === 'chain') notes.push('Availability multiplies along a chain: five services at 99.9% give about 99.5%. Latency adds up, and retries at each layer multiply load.');
        if (!mod && C === 'async') notes.push('Events remove the wait and the availability coupling, but the caller sees "pending" and the data is eventually consistent. See <a href="event-driven-sagas.html">sagas</a>.');
        if (!mod && Z === 'nano') notes.push('One service per entity moves the business logic into the callers and turns every use case into a distributed transaction.');
        if (!mod && Z === 'big') notes.push('A few large services are a sound first step. Split further only when one of them has two teams or two very different scaling needs.');
        let verdict;
        if (P === 'bigbang') verdict = '❌ <b>Big-bang rewrite:</b> the highest-risk way to change architecture. Extract one slice and put it in production first.';
        else if (mod && D === 'shared') verdict = '⚠ <b>One deploy and no boundaries:</b> modules that read each other\'s tables are a big ball of mud. Give each module its own schema first.';
        else if (mod) verdict = '👍 <b>A valid end state.</b> If one deploy is not what slows you down, enforced modules give most of the benefit at a fraction of the operating cost.';
        else if (D === 'shared') verdict = '❌ <b>Distributed monolith:</b> separate deploys on shared tables. You have added a network and removed nothing.';
        else if (Z === 'nano') verdict = '⚠ <b>Nano-services:</b> every feature spans several services and every call is a remote one. Merge along business capabilities.';
        else if (C === 'chain') verdict = '⚠ <b>Fragile request path:</b> each added link lowers availability and raises latency. Shorten the chain or move steps to events.';
        else if (D === 'own' && C === 'async' && Z === 'ctx') verdict = '✅ <b>Services that can change alone:</b> own data, few waits, boundaries on business capabilities, reached one reversible step at a time.';
        else verdict = '👍 <b>Reasonable.</b> Check the lowest meter; it shows which coupling is left.';
        const hide = [];
        if (mod) hide.push('orders', 'ordb', 'pay', 'paydb', 'cdc', 'bus', 'proxy');
        else {
          if (D === 'shared') hide.push('ordb', 'paydb', 'cdc');
          if (D === 'own') hide.push('cdc');
          if (C !== 'async' && D !== 'sync') hide.push('bus');
        }
        let flow;
        if (mod) flow = ['client>mono', 'mono>monodb'];
        else {
          flow = ['client>proxy', 'proxy>orders'];
          flow.push(D === 'shared' ? 'orders>monodb' : 'orders>ordb');
          if (D === 'sync') flow.push('monodb>cdc', 'cdc>bus', 'bus>ordb');
          if (C === 'async') flow.push('ordb>bus', 'bus>pay'); else flow.push('orders>pay');
          flow.push(D === 'shared' ? 'pay>monodb' : 'pay>paydb');
        }
        const labels = {
          mono: mod ? { label: 'Modular monolith', sub: 'orders · payments modules' } : P === 'bigbang' ? { label: 'Monolith', sub: 'frozen during rewrite' } : { label: 'Monolith', sub: 'shrinking' },
          monodb: mod ? { label: 'One database', sub: 'schema per module' } : D === 'shared' ? { label: 'Shared DB', sub: 'every service writes' } : { label: 'Monolith DB', sub: 'all legacy tables' },
          orders: Z === 'nano' ? { label: 'order-line svc', sub: 'one of 14 order svcs' } : Z === 'big' ? { label: 'Commerce service', sub: 'orders + cart + pricing' } : { label: 'Orders service', sub: 'extracted slice' },
          lib: mod ? { label: 'Module rules', sub: 'checked in the build' } : { label: 'Shared library', sub: 'common-domain v7' }
        };
        const badges = {};
        if (P === 'bigbang') badges.proxy = ['cut-over weekend', 'err'];
        if (!mod && D === 'shared') badges.monodb = ['hidden API', 'err'];
        if (!mod && C === 'chain') badges.pay = ['in the request path', 'warn'];
        if (!mod && Z === 'nano') badges.orders = ['too small', 'warn'];
        if (mod) badges.mono = ['one deploy', 'info'];
        if (!mod && D === 'own' && C === 'async') badges.orders = ['deploys alone', 'ok'];
        return {
          metrics, verdict, notes: notes.slice(0, 4), labels, hide, flow, badges,
          err: (!mod && D === 'shared' ? ['monodb'] : []).concat(P === 'bigbang' && !mod ? ['proxy'] : []),
          warn: (!mod && C === 'chain' ? ['pay'] : []).concat(!mod && Z === 'nano' ? ['orders'] : []),
          ok: !mod && D !== 'shared' ? ['ordb'] : [],
          hot: !mod && C === 'chain' ? ['orders'] : []
        };
      }
    },

    widget: {
      title: 'Coupling lab: is this a distributed monolith?',
      caption: 'Five services as a real dependency graph. <b>Tap a call arrow</b> to switch it between a blocking call and an async event. <b>Tap a service</b> to take it down. Toggle the <b>shared database</b> and the <b>shared domain library</b>. The meters are computed from the graph: checkout availability (every service it waits on must be up), time spent waiting, and how many services must be released together.'
    },

    realWorld: {
      intro: 'These are published accounts, each about one system. None of them says "microservices are bad" or "monoliths are bad". Each says a specific boundary did or did not match how the system changes and runs.',
      timeline: [
        { when: '2014–2015', who: 'Martin Fowler', title: 'Microservice Prerequisites and Monolith First', text: 'Two short pieces that still frame the decision. You need baseline operational skills before you adopt microservices, because you now run an ecosystem of small services. And starting with a monolith lets you find the right boundaries before the network hardens them. His site also hosts Stefan Tilkov\'s counter-argument, "Don\'t start with a monolith".', src: 3 },
        { when: '2018', who: 'Martin Fowler\'s site', title: 'How to break a Monolith into Microservices', text: 'Zhamak Dehghani\'s guide on what to decouple and when: start with a simple, fairly decoupled capability to build delivery skills, minimise dependencies back to the monolith, split sticky capabilities early, and move the <b>data</b> with the capability, not only the code.', src: 5 },
        { when: '2018', who: 'Segment', title: 'Goodbye Microservices', text: 'Segment had split its event-delivery pipeline into one service per destination. Load patterns differed widely between services, and shared libraries diverged across them. In "From 100s of problem children to 1 superstar", Alexandra Noonan describes merging them back into a single service. Segment kept microservices elsewhere.', src: 0 },
        { when: '2019', who: 'Shopify', title: 'Deconstructing the Monolith', text: 'Shopify chose a <b>modular monolith</b> for its core: keep one deployable, but organise the code into components with enforced boundaries and clear ownership. The project began as "Break-Core-Up-Into-Multiple-Pieces" and was later named Componentization.', src: 7 },
        { when: '2019', who: 'Sam Newman', title: 'Monolith to Microservices (book)', text: 'A catalogue of migration patterns: strangler fig, branch by abstraction, parallel run, and a full section on splitting the database (shared database, database view, whether to split the schema or the code first). In talks on the book, Newman recommends considering a modular monolith before defaulting to microservices.', src: 8 },
        { when: '2020', who: 'Istio', title: 'istiod: merging the control plane', text: 'Istio\'s control plane was built as several microservices. In 1.5 they were combined into one binary, <b>istiod</b>. The project explained that the usual benefits of separate services did not apply to components released and operated together by the same people, and that one process is simpler to install, scale and upgrade.', src: 6 },
        { when: '2020', who: 'Uber', title: 'Domain-Oriented Microservice Architecture', text: 'With about 2,200 critical microservices, Uber described the complexity cost of very fine-grained services and grouped them into <b>domains</b> behind gateways, arranged in layers. Callers depend on a domain\'s interface, not on its internal services.', src: 2 },
        { when: '2023', who: 'Amazon Prime Video', title: 'A monitoring service moves into one process', text: 'The Video Quality Analysis team had built stream monitoring from serverless components orchestrated by Step Functions, passing video frames through S3. Orchestration limits and data transfer made it costly. Packing the components into a single process, with data passed in memory, cut infrastructure cost by over 90% according to the team. It concerned one service, not Prime Video as a whole.', src: 1 },
        { when: '2022–2024', who: 'Monzo', title: 'The counter-example', text: 'Monzo runs thousands of small services (2,800 in a 2024 post) and deploys many times a day. It works because of heavy investment in one uniform platform, standard tooling and centrally driven migrations. Small services are affordable when the platform absorbs their cost.', src: 11 }
      ],
      lessons: [
        'The test is <b>independent change</b>, not the number of services.',
        'Move the <b>data</b> with the code, or you have not split anything.',
        'Migrate in <b>slices</b> that reach production and can be reversed.',
        'Boundaries are guesses: <b>merge</b> when two services always change together.',
        'Fine-grained services need a <b>platform</b> to pay for them.'
      ],
      sources: [
        { title: 'Goodbye Microservices: From 100s of problem children to 1 superstar', url: 'https://www.twilio.com/en-us/blog/developers/best-practices/goodbye-microservices', pub: 'Alexandra Noonan, Segment (now on the Twilio blog), July 2018' },
        { title: 'InfoQ report on Prime Video\'s audio/video monitoring service moving to a single process', url: 'https://www.infoq.com/news/2023/05/prime-ec2-ecs-saves-costs', pub: 'InfoQ, May 2023 (reporting the Prime Video Tech blog)' },
        { title: 'Introducing Domain-Oriented Microservice Architecture', url: 'https://www.uber.com/blog/microservice-architecture/', pub: 'Uber Engineering, 2020' },
        { title: 'Monolith First', url: 'https://www.martinfowler.com/bliki/MonolithFirst.html', pub: 'Martin Fowler, 2015' },
        { title: 'Microservice Prerequisites', url: 'https://martinfowler.com/bliki/MicroservicePrerequisites.html', pub: 'Martin Fowler, 2014' },
        { title: 'How to break a Monolith into Microservices', url: 'https://www.martinfowler.com/articles/break-monolith-into-microservices.html', pub: 'Zhamak Dehghani, martinfowler.com, 2018' },
        { title: 'Introducing istiod: simplifying the control plane', url: 'https://istio.io/latest/blog/2020/istiod/', pub: 'Istio blog, March 2020' },
        { title: 'Deconstructing the Monolith: Designing Software that Maximizes Developer Productivity', url: 'https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity', pub: 'Shopify Engineering, 2019' },
        { title: 'Monolith to Microservices', url: 'https://www.oreilly.com/library/view/monolith-to-microservices/9781492047834/', pub: 'Sam Newman, O\'Reilly, 2019' },
        { title: 'Pattern: Shared database', url: 'https://microservices.io/patterns/data/shared-database.html', pub: 'Chris Richardson, microservices.io' },
        { title: 'Potholes in the road from monolithic hell: microservices adoption anti-patterns', url: 'https://www.oreilly.com/ideas/potholes-in-the-road-from-monolithic-hell-microservices-adoption-anti-patterns', pub: 'Chris Richardson, O\'Reilly' },
        { title: 'How we run migrations across 2,800 microservices', url: 'https://monzo.com/blog/how-we-run-migrations-across-2800-microservices', pub: 'Monzo, 2024' },
        { title: 'Don\'t start with a monolith', url: 'https://www.martinfowler.com/articles/dont-start-monolith.html', pub: 'Stefan Tilkov, martinfowler.com' },
        { title: 'Branch by abstraction pattern', url: 'https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-decomposing-monoliths/branch-by-abstraction.html', pub: 'AWS Prescriptive Guidance' }
      ]
    },

    tradeoffs: {
      headers: ['Decision', 'Option A', 'Option B', 'Pick when…'],
      rows: [
        ['How to migrate', '<b>Incremental (strangler fig)</b>: value early, each step reversible, old and new coexist for a while', '<b>Big-bang rewrite</b>: clean design, no coexistence; all risk at the end', 'Incremental almost always. A rewrite only for a small system whose behaviour is fully specified'],
        ['Where to stop', '<b>Modular monolith</b>: one deploy, enforced modules, cheap to run', '<b>Microservices</b>: independent deploys and scaling, a platform to run', 'Modular monolith until several teams are blocked by the shared deploy or parts need very different scaling'],
        ['Split order', '<b>Code first</b>, data later: quick start, shared-database risk in between', '<b>Data first</b>: separate the schema inside the monolith, then lift the code', 'Data first when table ownership is tangled; code first with a strict end date for the shared tables'],
        ['Getting another service\'s data', '<b>Call its API</b>: fresh, adds runtime coupling', '<b>Keep a copy fed by events</b>: no runtime coupling, slightly stale', 'API for rarely needed or sensitive data; a local copy for data needed on every request'],
        ['Reusing code', '<b>Shared library</b>: one implementation, risk of release coupling', '<b>Duplicate</b> small domain types per service: independent, some repetition', 'Library for stable technical code only; duplicate domain types and map at the boundary'],
        ['Two services that change together', '<b>Merge</b>: one deploy, local transaction, in-process calls', '<b>Keep apart</b> and fix the interface: coarser calls, events', 'Merge when one team owns both and nothing needs separate scaling or isolation; otherwise redesign the interface']
      ]
    },
    failures: [
      { f: 'Distributed monolith', detect: 'Releases list several services; a feature needs coordinated pull requests; "deploy order" appears in release notes', fix: 'Measure the share of multi-service releases; remove the cause for the worst pair (shared table, domain library, breaking API change), or merge the pair.' },
      { f: 'Shared database', detect: 'Several services hold credentials for the same schema; queries from more than one role on a table', fix: 'One role and schema per service; revoke cross-schema grants; replace reads with APIs, events or views that have an end date.' },
      { f: 'Chatty calls (remote N+1)', detect: 'Traces show tens of calls to one service inside one request; latency grows with list size', fix: 'Batch endpoints, coarser APIs, a local copy of reference data; alert on calls per request.' },
      { f: 'Nano-services', detect: 'More services than engineers; services under a few hundred lines; a use case always touches the same three', fix: 'Merge along business capabilities; keep the internal module boundary.' },
      { f: 'Long synchronous chain', detect: 'Trace depth of 4 or more on user requests; one slow dependency causes site-wide errors', fix: 'Timeouts, retry budgets, breakers and bulkheads now; move steps to events and cut the depth next.' },
      { f: 'Coupling through a shared library', detect: 'A library release requires every service to upgrade; version conflicts between services', fix: 'Remove domain types from shared code; make the library backward compatible; let services upgrade at their own pace.' },
      { f: 'Migration that never finishes', detect: 'Old and new paths both live for more than a year; sync jobs nobody owns; monolith still growing', fix: 'Limit slices in progress; a slice is done only when the old code and tables are deleted; stop adding features to the old path.' }
    ],

    interview: [
      { q: 'What is a distributed monolith and how do you recognise one?', a: '<p>A system that is <b>deployed as many services but must be changed as one</b>. It has the costs of both styles: network latency and partial failure, plus coordinated releases.</p><p>Signs:</p><ul><li>a typical feature needs changes in several services, released together or in a fixed order;</li><li>services share database tables or a library of domain classes;</li><li>you cannot run or test one service without several others;</li><li>one slow service takes the others down;</li><li>teams hold a release meeting.</li></ul><p>The one-line test: <b>can I deploy this service on its own, right now, without telling anyone?</b></p>', lvl: 'core' },
      { q: 'Why is a shared database an anti-pattern? Is it ever acceptable?', a: '<p>When two services use the same tables, the <b>schema becomes an API</b> that nobody declared, versioned or tests. Either team can break the other with a column change. Neither can change its storage alone. One slow query or lock hurts everyone, and encapsulation is gone because rules enforced in one service can be bypassed by another writing directly.</p><p>Acceptable cases: as a <b>temporary</b> step during migration, with an end date; a shared database <b>server</b> with separate schemas and credentials per service; and read-only access through a view the owner publishes as a contract. For reporting, use a replica or a data platform fed by events, not the operational tables.</p>', fu: 'How do you enforce it?', lvl: 'core' },
      { q: 'How do you detect and fix chatty communication between services?', a: '<p><b>Detect</b> with distributed tracing: count spans per trace to the same downstream service. A request that makes 40 calls to Pricing is a remote N+1. Latency that grows with list size is another sign.</p><p><b>Fix</b>, in order of preference:</p><ul><li>a <b>batch</b> or coarser endpoint: one call with 40 ids;</li><li>keep a <b>local copy</b> of the reference data, updated by events;</li><li>call in <b>parallel</b> with a deadline if calls are independent;</li><li>ask whether the boundary is wrong: two services that talk this much may be one.</li></ul><p>The underlying rule: in-process calls are nearly free, remote calls are not, so a remote interface must be coarser than the object model behind it.</p>', lvl: 'core' },
      { q: 'Five services call each other in a chain, each at 99.9% availability. What is the result and what do you do?', a: '<p>If every call must succeed, availability multiplies: 0.999<sup>5</sup> ≈ 99.5%, about 3.6 hours down in a 30-day month against 43 minutes for one service. Latency adds up, and tail latency compounds. With retries at each level, a slow leaf service receives a multiple of the original load.</p><p>Actions: <b>timeouts</b> and deadlines passed down the chain; <b>retries only at one level</b> with a budget; <b>circuit breakers and bulkheads</b>; <b>fallbacks</b> or cached values for non-critical data. Structurally: shorten the chain, make steps <b>asynchronous</b> where the user does not need the result at once, and keep local copies of data instead of fetching it on every request.</p>', lvl: 'core' },
      { q: 'How small is too small for a service?', a: '<p>Too small when the service cannot do anything useful alone. Signs of <b>nano-services</b>: one service per database entity (CRUD only), every use case touches the same three services, a team owns more services than it has people, most of the code is clients and DTO mapping, and you needed a saga for something that used to be one transaction.</p><p>A good size is one <b>business capability or bounded context</b> that one team can own and that changes for one kind of reason. I would rather start with fewer, larger services and split when there is evidence: a second team, a different scaling profile or a different release rhythm. Splitting later is easier than merging data back.</p>', lvl: 'core' },
      { q: 'When does a shared library become a problem?', a: '<p>A library is fine when services can use <b>different versions at the same time</b>. That holds for technical code: logging, tracing, HTTP client setup, test utilities.</p><p>It becomes coupling when:</p><ul><li>it contains <b>domain types</b> that services exchange, so both sides need the same version;</li><li>a new version is <b>not backward compatible</b>, forcing a fleet-wide upgrade;</li><li>it carries business rules, so changing a rule means releasing every service.</li></ul><p>Segment\'s account describes shared-library versions drifting across its many services as one of the pains. The rule I use: share infrastructure, duplicate small domain types, and map at each service\'s boundary.</p>', lvl: 'deep' },
      { q: 'Walk me through migrating a monolith to services.', a: '<ol><li><b>State the goal</b> and its measure (for example lead time for the checkout team). Check prerequisites: automated deploys, monitoring, fast provisioning.</li><li><b>Modularise in place</b>: find seams, put the candidate capability behind an interface inside the monolith.</li><li><b>Add a facade</b> in front, so routing can change without clients noticing.</li><li><b>Pick the first slice</b>: valuable, loosely coupled, low risk.</li><li><b>Extract the code</b>, run it in shadow or parallel and compare results.</li><li><b>Move the data</b>: own schema, backfill, keep in sync with change capture, move reads, then writes.</li><li><b>Shift traffic gradually</b> with a quick way back.</li><li><b>Delete the old path</b>: code, tables, sync jobs.</li><li><b>Review and repeat</b>, and stop when the goal is met. What remains in the monolith can stay.</li></ol><p>For the routing mechanics see <a href="strangler-fig.html">strangler fig</a>; for the data steps see <a href="zero-downtime-migrations.html">zero-downtime migrations</a>.</p>', lvl: 'core' },
      { q: 'Which part do you extract first?', a: '<p>Not the most tangled core. The first slice should teach the organisation how to run a service, at low risk:</p><ul><li><b>loosely coupled</b> to the rest (few inbound calls, clear data);</li><li><b>valuable enough</b> that someone cares (changes often, or needs different scaling);</li><li><b>owned by a team</b> that wants it.</li></ul><p>Zhamak Dehghani\'s guidance is similar: warm up with a simple, fairly decoupled capability, then go for what changes most. Avoid making the new service call back into the monolith for everything, and avoid starting with a shared "utility" slice that every other part depends on.</p>', lvl: 'deep' },
      { q: 'How do you split the database?', a: '<ol><li><b>Map ownership</b>: for each table, which module reads and which writes.</li><li><b>Separate inside one database first</b>: a schema per module, and replace cross-module joins and foreign keys with calls through the owning module\'s code.</li><li><b>Create the new database</b>, backfill, and keep it in step with the legacy tables using change data capture or dual writes behind an outbox.</li><li><b>Move reads</b> to the new store and compare results; then <b>move writes</b>; keep a reverse sync for a short period as the way back.</li><li><b>Drop the old tables</b>.</li></ol><p>What you lose: joins, foreign keys and transactions across the boundary. They are replaced by API composition, local copies and sagas. If two tables truly need one transaction, they probably belong to the same service.</p>', lvl: 'deep' },
      { q: 'When would you merge services back together?', a: '<p>When the boundary costs more than it gives. Evidence:</p><ul><li><b>they change together</b>: most commits or releases touch both;</li><li><b>one team</b> owns both and releases them together;</li><li><b>the interface is chatty</b> or needs a distributed transaction;</li><li><b>no independent need</b>: same scaling, same availability target, same technology;</li><li><b>data transfer dominates</b> the cost.</li></ul><p>Published cases: Segment merged its per-destination services (2018); Istio merged its control plane into istiod (2020) because its parts were released and run together; a Prime Video team moved one monitoring pipeline into a single process (2023) and reported a 90% cost cut. Keep the module boundary inside the merged service so you can split again later.</p>', lvl: 'core' },
      { q: 'Leadership wants a full rewrite into microservices in 12 months. What do you say?', a: '<p><em>Sample answer; adapt to your experience.</em></p><p>I would agree with the goal and challenge the method. A rewrite delivers nothing until the end, has to reproduce years of undocumented behaviour, and competes with the old system, which keeps changing. I would ask what business outcome is wanted (faster delivery in checkout? scaling search?) and propose to reach <b>that</b> first.</p><p>The offer: within one quarter, one extracted slice in production behind a facade, with a measured result. Then a decision at each slice whether to continue. It gives leadership earlier evidence, less risk and the option to stop. I would bring two numbers: lead time today for the target area, and the share of releases that involve several teams. Those show whether architecture is the real constraint.</p>', lvl: 'deep' },
      { q: 'How do you know the migration is working, and when is it finished?', a: '<p>Measure the reason you started, not the number of services:</p><ul><li><b>lead time and deploy frequency</b> for the teams involved;</li><li><b>share of releases that need more than one service</b>;</li><li><b>incident spread</b>: how many services one failure affects;</li><li><b>cost to run</b> per request or per team.</li></ul><p>If these do not improve after two or three slices, stop and find out why: often the boundaries follow the old tables, or the data was not moved. The migration is finished when the goal is met, not when the monolith is gone. A smaller, well-modularised monolith surrounded by a few services is a common and healthy end state.</p>', lvl: 'deep' }
    ],

    code: [
      {
        title: 'Postgres: end the shared database with schemas, roles and a dated view', lang: 'sql',
        code: `-- One schema and one login role per service. Run as a migration, Postgres 15+.
CREATE ROLE orders_svc  LOGIN;
CREATE ROLE billing_svc LOGIN;

CREATE SCHEMA orders AUTHORIZATION orders_svc;
ALTER TABLE public.orders      SET SCHEMA orders;
ALTER TABLE public.order_lines SET SCHEMA orders;
ALTER TABLE orders.orders      OWNER TO orders_svc;
ALTER TABLE orders.order_lines OWNER TO orders_svc;

-- Nobody else may touch the tables. This turns a convention into a rule.
REVOKE ALL ON SCHEMA orders FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA orders FROM PUBLIC, billing_svc;

-- Temporary read contract for a consumer that has not moved to the API yet.
-- The view is the only thing billing may read; the tables can now change behind it.
CREATE SCHEMA orders_contract AUTHORIZATION orders_svc;
CREATE VIEW orders_contract.order_summary_v1 AS
  SELECT o.id, o.customer_id, o.status, o.total_cents, o.created_at
  FROM orders.orders o;
ALTER VIEW orders_contract.order_summary_v1 OWNER TO orders_svc;
COMMENT ON VIEW orders_contract.order_summary_v1 IS
  'Transitional. Owner: team-orders. Remove after 2027-03-31; use the Orders API.';
GRANT USAGE  ON SCHEMA orders_contract TO billing_svc;
GRANT SELECT ON orders_contract.order_summary_v1 TO billing_svc;

-- Who still reaches into the tables? (needs the pg_stat_statements extension)
SELECT r.rolname, s.calls, left(s.query, 80) AS query
FROM pg_stat_statements s
JOIN pg_roles r ON r.oid = s.userid
WHERE s.query ILIKE '%orders.order%'
  AND r.rolname <> 'orders_svc'
ORDER BY s.calls DESC
LIMIT 20;`,
        note: 'Splitting into schemas inside one database is the cheap first step: it exposes every cross-service query without moving any data. Sam Newman\'s book calls the view a "database view" pattern; treat it as a contract with an end date, not a permanent interface.'
      },
      {
        title: 'Python: find services that always change together (merge or decouple candidates)', lang: 'python',
        code: `#!/usr/bin/env python3
"""Co-change report. Assumes a monorepo laid out as services/<name>/...
For separate repos, group commits by ticket id instead of by commit."""
import subprocess
from collections import Counter
from itertools import combinations


def service_sets(since: str = "12 months ago"):
    out = subprocess.run(
        ["git", "log", f"--since={since}", "--name-only", "--pretty=format:@@%H"],
        capture_output=True, text=True, check=True,
    ).stdout
    for block in out.split("@@")[1:]:
        paths = block.splitlines()[1:]                    # first line is the hash
        yield {p.split("/")[1] for p in paths
               if p.startswith("services/") and p.count("/") >= 2}


def main(min_commits: int = 20, threshold: float = 0.5) -> None:
    changes: Counter[str] = Counter()
    together: Counter[tuple[str, str]] = Counter()
    for services in service_sets():
        if not services or len(services) > 8:             # skip repo-wide chores
            continue
        changes.update(services)
        together.update(combinations(sorted(services), 2))

    rows = []
    for (a, b), n in together.items():
        base = min(changes[a], changes[b])                # the less active of the two
        if base >= min_commits and n / base >= threshold:
            rows.append((n / base, n, a, b))
    for ratio, n, a, b in sorted(rows, reverse=True):
        print(f"{ratio:5.0%}  {n:4d} shared commits  {a} <-> {b}")


if __name__ == "__main__":
    main()`,
        note: 'A pair at 70% means: of all commits to the quieter service, 70% also changed the other one. That is a boundary in the wrong place, or a shared type leaking across it. The thresholds are starting points; tune them to your repository.'
      },
      {
        title: 'Spring Boot: replace a chatty per-item call with one batched call and a deadline', lang: 'java',
        code: `// Spring Boot 3.3+, Java 21. RestClient with explicit timeouts: a remote call
// must never be allowed to hang the caller.
@Service
public class PricingClient {
  private final RestClient http;

  public PricingClient(RestClient.Builder builder) {
    var jdk = HttpClient.newBuilder().connectTimeout(Duration.ofMillis(200)).build();
    var factory = new JdkClientHttpRequestFactory(jdk);
    factory.setReadTimeout(Duration.ofMillis(400));
    this.http = builder.baseUrl("http://pricing").requestFactory(factory).build();
  }

  // Anti-pattern: one remote call per line item. 40 items = 40 round trips,
  // 40 chances to fail, latency that grows with the size of the basket.
  public List<Price> pricesChatty(List<String> skus) {
    return skus.stream()
        .map(sku -> http.get().uri("/prices/{sku}", sku).retrieve().body(Price.class))
        .toList();
  }

  // Fix: one coarse call. The provider resolves all SKUs in a single query.
  public Map<String, Price> pricesBatch(List<String> skus) {
    Map<String, Price> prices = http.post()
        .uri("/prices:batchGet")
        .body(new BatchGetPrices(skus))
        .retrieve()
        .body(new ParameterizedTypeReference<Map<String, Price>>() {});
    return prices == null ? Map.of() : prices;
  }

  public record BatchGetPrices(List<String> skus) {}
  public record Price(String sku, long amountCents, String currency) {}
}`,
        note: 'If prices are needed on every request, go one step further: keep a local copy updated from <code>PriceChanged</code> events, and remove the call from the request path entirely. Any HTTP stack has the same two knobs: a connect timeout and a read timeout.'
      }
    ],

    related: ['ms-monolith-vs-microservices', 'ms-service-boundaries', 'ms-data', 'ms-operations', 'strangler-fig', 'conways-law', 'tech-debt']
  });
})();

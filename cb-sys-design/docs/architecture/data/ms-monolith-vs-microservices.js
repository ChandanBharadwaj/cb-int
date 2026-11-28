(function () {
  // One shared pipeline vs many: queueing and batching in a monolith, a fixed running cost per service in microservices.
  const m = (v) => {
    const perDay = v.eng * v.chg / 5;                       // changes per working day
    const slots = Math.max(1, Math.floor(480 / v.pipe));    // serial pipeline runs in an 8 h day
    const batch = Math.max(1, Math.ceil(perDay / slots));   // changes that must share one run
    const pBad = 1 - Math.pow(1 - v.fail / 100, batch);
    const taxFte = v.svc * v.ops / 160;
    return { perDay, slots, batch, pBad, taxFte, taxPct: taxFte / v.eng };
  };
  const r1 = (x) => (x >= 100 ? Math.round(x).toLocaleString('en-US') : (Math.round(x * 10) / 10).toString());

  SD.register({
    slug: 'ms-monolith-vs-microservices',
    domain: 10,
    title: 'Monolith, Modular Monolith or Microservices',
    examples: 'Shopify, Amazon Prime Video, Segment',
    tagline: 'Three ways to ship the same system: <b>one deployable</b>, <b>one deployable with enforced module walls</b>, or <b>many deployables</b>. The choice is about teams, release contention and operating cost, far more than about technology.',
    tldr: {
      problem: 'Teams adopt microservices to move faster and end up slower: every call can fail, every feature spans databases, and there are more pipelines than people. Other teams stay in one tangled codebase until nobody can release without breaking someone else.',
      idea: 'Treat it as a spectrum and move only when a <b>named pain</b> justifies the cost. Default to a <b>modular monolith</b>: one deployable, strict module boundaries checked in the build, data owned per module. <b>Extract a service</b> when a module needs its own owner, scaling, release pace or risk isolation.',
      insight: 'Microservices trade <b>code complexity for operational complexity</b>. They pay off when the real bottleneck is many teams contending for one release. If you cannot deploy one service without the others, you have a <b>distributed monolith</b>: the costs of both and the benefits of neither.',
      numbers: [
        { v: '3 prerequisites', l: 'Fowler (2014): rapid provisioning, basic monitoring, rapid application deployment' },
        { v: '1 − 0.97¹⁰ ≈ 26 %', l: 'chance that a batch of 10 changes holds a bad one, at 3 % each (arithmetic)' },
        { v: '> 90 %', l: 'infrastructure cost cut when Prime Video merged one pipeline into a single process (2023)' }
      ]
    },

    intro: {
      what: 'A <b>monolith</b> is a system built and deployed as one unit. A <b>modular monolith</b> is still one unit, but its code is divided into modules with boundaries that the build enforces. <b>Microservices</b> split the system into separately deployed services, each with its own data, that talk over the network.',
      analogy: {
        icon: '🍳',
        title: 'One kitchen, a kitchen with stations, or a food court',
        text: 'A small restaurant has one kitchen where everyone shares the stove. A bigger one keeps one kitchen but sets up <b>stations</b> (grill, pastry, salads) with their own tools and a pass between them. A food court has <b>separate kitchens</b>, each with its own staff, suppliers and opening hours. Separate kitchens can change their menu without asking, but a meal that needs three of them takes runners, tickets and waiting. The analogy leaves out one thing: separate services also need separate data.'
      },
      problem: 'A start-up of six engineers copies the architecture of a company with two thousand. They now run fourteen services, a message broker and a tracing system, and a simple "add a field" change needs four pull requests. The question this page answers is <b>how far should you split, and what tells you it is time to split further?</b>',
      story: [
        {
          stage: 'naive',
          title: 'Split everything from day one',
          text: 'The team draws a box for every noun and makes each a service with its own repository and database. It feels modern, and each service is small and easy to read.',
          scene: {
            nodes: [
              { id: 't', label: 'One team', sub: '6 engineers', kind: 'team', at: [210, 0] },
              { id: 'a', label: 'Orders svc', sub: 'own repo + DB', kind: 'service', at: [70, 110] },
              { id: 'b', label: 'Users svc', sub: 'own repo + DB', kind: 'service', at: [210, 110] },
              { id: 'c', label: 'Catalog svc', sub: 'own repo + DB', kind: 'service', at: [350, 110] }
            ],
            edges: [{ from: 't', to: 'a' }, { from: 't', to: 'b' }, { from: 't', to: 'c' }, { from: 'a', to: 'b', bidi: true }, { from: 'b', to: 'c', bidi: true }],
            flow: [['t>a', 't>b', 't>c']],
            badges: { t: ['14 services', 'info'] }
          }
        },
        {
          stage: 'breaks',
          title: 'The costs arrive before the benefits',
          text: 'The boundaries were guesses, so features cross them. A method call became a network call that can time out. One transaction became several. The six engineers spend their week on pipelines, versions and tracing instead of the product.',
          scene: {
            nodes: [
              { id: 't', label: 'One team', sub: 'busy with plumbing', kind: 'team', at: [210, 0] },
              { id: 'a', label: 'Orders svc', sub: 'waits on Users', kind: 'service', at: [70, 110] },
              { id: 'b', label: 'Users svc', sub: 'timeout', kind: 'service', at: [210, 110] },
              { id: 'c', label: 'Catalog svc', sub: 'old contract', kind: 'service', at: [350, 110] }
            ],
            edges: [{ from: 't', to: 'a' }, { from: 't', to: 'b' }, { from: 't', to: 'c' }, { from: 'a', to: 'b', bidi: true }, { from: 'b', to: 'c', bidi: true }],
            flow: ['a>b', 'b>c', 'c>b', 'b>a'],
            err: ['b'], warn: ['a', 'c', 't'],
            badges: { b: ['network failure', 'err'], t: ['4 PRs per change', 'warn'] }
          }
        },
        {
          stage: 'fix',
          title: 'One deployable, real walls, extract on evidence',
          text: 'Put the code back into <b>one deployable with enforced modules</b>. Calls are method calls again and one transaction covers a feature. When one module later needs its own team or its own scaling, it is extracted as a service along a wall that already exists.',
          scene: {
            nodes: [
              { id: 't', label: 'One team', sub: 'ships features', kind: 'team', at: [210, 0] },
              { id: 'a', label: 'orders module', sub: 'public API', kind: 'service', at: [70, 110] },
              { id: 'b', label: 'users module', sub: 'public API', kind: 'service', at: [210, 110] },
              { id: 'c', label: 'Search svc', sub: 'extracted: 50× load', kind: 'service', at: [350, 220] },
              { id: 'd', label: 'One database', sub: 'schema per module', kind: 'store', at: [70, 220] }
            ],
            edges: [{ from: 't', to: 'a' }, { from: 't', to: 'b' }, { from: 'a', to: 'b' }, { from: 'a', to: 'd' }, { from: 'b', to: 'd' }, { from: 'b', to: 'c', dashed: true }],
            flow: ['t>a', 'a>b', ['a>d', 'b>d']],
            ok: ['a', 'b', 'd'],
            badges: { d: ['1 transaction', 'ok'], c: ['split for a reason', 'info'] }
          }
        }
      ],
      usedBy: ['Shopify (modular monolith for its core)', 'Basecamp (the "majestic monolith")', 'Stack Overflow (a monolith at large scale)', 'Netflix (microservices)', 'Uber (microservices grouped into domains)', 'Amazon (services owned by small teams)'],
      whenToUse: [
        '<b>Monolith or modular monolith</b>: one to a few teams, a domain you are still learning, or a need to move fast with little operations staff',
        '<b>Extract a service</b>: a module needs its own team, scaling profile, release pace, runtime or compliance boundary',
        '<b>Mostly microservices</b>: many teams whose main bottleneck is waiting for each other to release, with a platform that makes a new service cheap'
      ],
      whenNot: [
        'Do not pick microservices to fix messy code: the mess moves to the network. Fix the boundaries first (<a href="ms-service-boundaries.html">Service Boundaries</a>)',
        'Do not stay in an unstructured monolith as teams grow: add enforced modules before contention hurts',
        'Do not treat this as a comparison of styles in general: for that see <a href="architectural-styles.html">Architectural Styles</a>'
      ],
      glossary: [
        { term: 'Deployable (deployment unit)', def: 'One artefact that is built, versioned and released as a whole, such as a JAR, a container image or a binary.' },
        { term: 'Modular monolith', def: 'One deployable whose internal modules have explicit public interfaces and private internals, checked by tooling.' },
        { term: 'Microservice premium', def: 'Fowler\'s term for the extra cost and risk of running a set of services compared with one application.' },
        { term: 'Distributed monolith', def: 'Services that must be changed or deployed together, usually because they share data or call each other in long chains.' },
        { term: 'Independent deployability', def: 'Being able to release one service to production without releasing or re-testing any other.' },
        { term: 'Merge queue', def: 'A system that tests changes in order before they reach the main branch, so the main branch always builds.' },
        { term: 'Partial failure', def: 'One part of a distributed system fails or slows down while the rest keeps running; it cannot happen with an in-process call.' },
        { term: 'Fitness function', def: 'An automated check that an architecture rule still holds, such as "no module imports another module\'s internals".' }
      ]
    },

    requirements: {
      functional: [
        '<b>Boundaries before distribution</b>: get the module cut right while moving code is cheap',
        '<b>Name the pain</b> a split will remove, and measure it before and after',
        '<b>Enforce module rules in the build</b>, not in a wiki: imports, cycles, data access',
        '<b>Data ownership per module</b>, even inside one database (schema per module)',
        '<b>Extract one service at a time</b>, along an existing module boundary',
        '<b>Independent deployability is the test</b>: if services ship together, merge them or fix the coupling'
      ],
      nonFunctional: [
        'Lead time from merge to production under 1 hour for a typical change (<em>example target</em>)',
        'A change can be released without waiting for another team\'s change',
        'Change failure rate stays flat as the number of engineers grows',
        'Operations work per service is small and mostly automated (templates, shared pipeline)',
        'A request crosses 3 or fewer synchronous network hops (<em>rule of thumb</em>)',
        'A new engineer runs the system locally on day one'
      ],
      outOfScope: [
        '<b>Distributed monolith</b>: many services, one shared database, lockstep releases',
        '<b>Big ball of mud</b>: a monolith where any class may call any other',
        '<b>Résumé-driven architecture</b>: microservices because large companies use them',
        '<b>Big-bang rewrite</b> from monolith to services in one project',
        '<b>Microservices without the prerequisites</b>: no automated deploys, no monitoring, no tracing'
      ]
    },

    calculator: {
      inputs: [
        { id: 'eng', label: 'Engineers', min: 3, max: 1000, value: 40, log: true },
        { id: 'chg', label: 'Changes merged per engineer per week', min: 1, max: 10, value: 3 },
        { id: 'pipe', label: 'Monolith pipeline time (build + test + deploy)', min: 5, max: 180, value: 25, unit: 'min' },
        { id: 'fail', label: 'Chance one change breaks the build or release', min: 0.5, max: 15, value: 3, step: 0.5, unit: '%' },
        { id: 'svc', label: 'Services if you split', min: 2, max: 300, value: 12, log: true },
        { id: 'ops', label: 'Running cost per service per month', min: 2, max: 60, value: 12, unit: 'h' }
      ],
      outputs: [
        { label: 'Changes per working day', fmt: 'raw', f: (v) => r1(m(v).perDay) },
        { label: 'Monolith: serial pipeline runs per 8 h day', fmt: 'raw', f: (v) => String(m(v).slots) },
        { label: 'Monolith: changes that must share one run (batch size)', fmt: 'raw', f: (v) => String(m(v).batch) },
        { label: 'Monolith: chance a run contains a bad change', fmt: 'pct', f: (v) => m(v).pBad },
        { label: 'Microservices: running cost of the services', fmt: 'raw', f: (v) => r1(m(v).taxFte) + ' FTE (' + r1(m(v).taxPct * 100) + ' % of engineers)' },
        { label: 'Reading', fmt: 'raw', f: (v) => { const x = m(v); return x.batch <= 2 && x.taxPct > 0.08 ? 'the monolith is not the bottleneck' : x.pBad > 0.4 ? 'release contention: modularise the build, then extract' : x.taxPct > 0.25 ? 'too many services for this team' : 'either works: decide on team structure'; } }
      ],
      note: 'The monolith side models one <b>serial</b> pipeline: if more changes arrive per day than runs fit, changes are batched, and a batch fails when any change in it is bad (failures assumed independent). Real merge queues run speculative builds in parallel and modular builds test only what changed, which is why a modular monolith scales much further than this worst case. The microservice side is a flat cost per service for pipeline upkeep, dependency upgrades, on-call and dashboards: an <em>estimate</em>; measure your own. The thresholds in "Reading" are <em>rules of thumb</em>.'
    },

    api: [
      { m: 'ADR', p: 'ADR-012: Stay a modular monolith; extraction criteria', d: 'The default shape, and the list of reasons that justify extracting a module: separate owning team, scaling profile, release pace, runtime or language, compliance scope. Anything else stays in.' },
      { m: 'POLICY', p: 'Module rules (checked in CI)', d: 'A module exposes one public package or API; internals are private; no dependency cycles; a module\'s tables are read and written only by that module. Violations fail the build.' },
      { m: 'DOC', p: 'Service readiness checklist', d: 'What must exist before a new service goes live: owner, pipeline, dashboards and alerts, tracing, runbook, timeouts on every call, a contract test. This is the "microservice premium" made visible.' },
      { m: 'SLO', p: 'Delivery metrics per team', d: 'Lead time for changes, deployment frequency, change failure rate, time to restore. The reason to change shape is a trend in these numbers, not a preference.' },
      { m: 'SQL', p: 'Lockstep-deploy report', d: 'From the deploy log: pairs of services released within the same 30 minutes, as a share of their releases. A high share is the signature of a distributed monolith.' },
      { m: 'RFC', p: 'RFC: Extract Search from the shop', d: 'Evidence (load 50 times higher than the rest, different storage), the new contract, data ownership, rollout by traffic percentage, and the rollback plan. See <a href="strangler-fig.html">Strangler Fig</a>.' }
    ],
    dataModel: [
      { name: 'module_dependency', store: 'Generated in CI from the code', fields: [['from_module', 'text', 'pk'], ['to_module', 'text', 'pk'], ['via', 'api|internal|table'], ['allowed', 'boolean'], ['first_seen', 'date']], note: 'Rows with <code>via = internal</code> or <code>table</code> and <code>allowed = false</code> are violations. Start by freezing the count, then burn it down.' },
      { name: 'deploy_log', store: 'Postgres, written by the pipeline', fields: [['id', 'bigint', 'pk'], ['unit', 'text', 'idx'], ['version', 'text'], ['deployed_at', 'timestamptz', 'idx'], ['changes', 'int'], ['failed', 'boolean']], note: 'One row per production deploy of a deployable. Source for batch size, change failure rate and lockstep analysis.' },
      { name: 'extraction_candidate', store: 'Architecture backlog', fields: [['module', 'text', 'pk'], ['reason', 'owner|scale|pace|risk|runtime'], ['evidence', 'text'], ['est_cost_weeks', 'int'], ['decision', 'extract|keep|revisit']], note: 'Makes "should this be a service?" a recorded decision with a reason from a fixed list.' },
      { name: 'schema_ownership', store: 'Postgres catalog + convention', fields: [['schema_name', 'text', 'pk'], ['owner_module', 'text'], ['app_role', 'text'], ['cross_schema_fks', 'int']], note: 'One schema and one database role per module. Zero cross-schema foreign keys is the goal; it is what makes a later split a move, not a rewrite.' }
    ],

    architecture: {
      title: 'Same system, three shapes: who waits for whom',
      nodes: [
        { id: 't1', label: 'Checkout team', sub: 'ships daily', kind: 'team', wide: [90, 0], tall: [210, 0], tip: 'Wants to release several times a day. In a shared pipeline it waits for everything else in the batch.' },
        { id: 't2', label: 'Catalog team', sub: 'ships weekly', kind: 'team', wide: [90, 110], tall: [350, 0], tip: 'A different pace and a different risk appetite. One of the classic reasons for a separate deployable.' },
        { id: 'ci', label: 'Build pipeline', sub: 'tests · module rules', kind: 'policy', wide: [280, 0], tall: [350, 105], tip: 'One pipeline for a monolith; one per service for microservices. In a modular monolith it also runs the boundary checks.' },
        { id: 'user', label: 'Shopper', sub: 'web / app', kind: 'client', wide: [90, 220], tall: [70, 0], tip: 'Sees one product whatever the shape.' },
        { id: 'lb', label: 'Load balancer', sub: 'or API gateway', kind: 'edge', wide: [280, 220], tall: [70, 105], tip: 'Spreads requests over replicas of the deployable. With services it becomes a gateway that routes by path.' },
        { id: 'chk', label: 'checkout', sub: 'module or service', kind: 'service', wide: [470, 110], tall: [210, 210], tip: 'Calls catalog and inventory. In-process this is a method call; across services it is a network call with a timeout.' },
        { id: 'cat', label: 'catalog', sub: 'module or service', kind: 'service', wide: [660, 0], tall: [350, 210], tip: 'Read-heavy. A candidate for extraction when its load or release pace differs from the rest.' },
        { id: 'inv', label: 'inventory', sub: 'module or service', kind: 'service', wide: [660, 220], tall: [70, 315], tip: 'Stock reservations. In a monolith the reservation and the order commit in one transaction.' },
        { id: 'db', label: 'Database', sub: 'schema per module', kind: 'store', wide: [850, 110], tall: [350, 315], tip: 'One database with a schema per module, or one database per service. Shared tables across owners create a distributed monolith.' },
        { id: 'bus', label: 'Events', sub: 'in-process or broker', kind: 'queue', wide: [470, 330], tall: [210, 420], tip: 'In-process events inside a modular monolith; a broker such as Kafka between services.' },
        { id: 'plat', label: 'Platform', sub: 'K8s · tracing · mesh', kind: 'compute', wide: [850, 330], tall: [70, 420], tip: 'What many services need to be operable: orchestration, service discovery, distributed tracing (OpenTelemetry), a paved road for new services.' }
      ],
      edges: [
        { from: 't1', to: 'ci' },
        { from: 't2', to: 'ci' },
        { from: 'ci', to: 'chk', dashed: true },
        { from: 'ci', to: 'cat', dashed: true },
        { from: 'user', to: 'lb' },
        { from: 'lb', to: 'chk' },
        { from: 'chk', to: 'cat' },
        { from: 'chk', to: 'inv' },
        { from: 'chk', to: 'db' },
        { from: 'cat', to: 'db' },
        { from: 'inv', to: 'db' },
        { from: 'chk', to: 'bus' },
        { from: 'bus', to: 'inv' },
        { from: 'plat', to: 'inv', dashed: true }
      ]
    },

    scenarios: [
      {
        id: 'modular', title: 'Modular monolith: one deploy, enforced walls', tone: 'ok',
        steps: [
          { text: 'Two teams merge changes. <b>One pipeline</b> builds one artefact. Besides tests it runs the <b>module rules</b>: no cycles, no access to another module\'s internals or tables.', flow: [['t1>ci', 't2>ci']], hidden: ['plat'], badges: { ci: ['rules pass', 'ok'] } },
          { text: 'The artefact is deployed as a few identical replicas. A request for checkout reaches any of them.', flow: ['ci>chk', 'user>lb', 'lb>chk'], hidden: ['plat'], labels: { chk: { label: 'checkout module', sub: 'same process' } } },
          { text: 'Checkout calls catalog and inventory through their public interfaces. These are <b>method calls</b>: no serialisation, no timeout, no partial failure.', flow: [['chk>cat', 'chk>inv']], hidden: ['plat'], labels: { chk: { label: 'checkout module', sub: 'same process' }, cat: { label: 'catalog module', sub: 'public API' }, inv: { label: 'inventory module', sub: 'public API' } }, badges: { chk: 'in-process' } },
          { text: 'The order and the stock reservation commit in <b>one database transaction</b>, each in its own schema. No saga, no compensation.', flow: [['chk>db', 'inv>db']], hidden: ['plat'], ok: ['db'], labels: { db: { label: 'One Postgres', sub: 'schema per module' } }, badges: { db: ['1 ACID tx', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'violation', title: 'A boundary violation is stopped in CI', tone: 'warn',
        steps: [
          { text: 'A Catalog developer needs the customer\'s last order and imports a class from checkout\'s <b>internal</b> package. It compiles and the tests pass.', flow: ['t2>ci'], hidden: ['plat'], warn: ['cat'], badges: { cat: ['imports internals', 'warn'] } },
          { text: 'Without a check this is how a monolith turns into a ball of mud: one shortcut at a time, each reasonable on its own.', nodes: ['cat', 'chk'], hidden: ['plat'], warn: ['cat', 'chk'], tone: 'warn' },
          { text: 'The pipeline\'s module verification fails the build and names the offending dependency. The wall is a <b>fitness function</b>, not a convention.', nodes: ['ci'], hidden: ['plat'], err: ['ci'], badges: { ci: ['build failed', 'err'] }, tone: 'err' },
          { text: 'The fix goes through the public interface: checkout exposes a small query, or publishes an event that catalog stores. The boundary stays clean enough to cut along later.', flow: ['chk>bus'], hidden: ['plat'], ok: ['ci', 'chk'], badges: { ci: ['green', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'queue', title: 'Growth: the shared release becomes the bottleneck', tone: 'warn',
        steps: [
          { text: 'The company grows to 200 engineers on one deployable. Around 120 changes a day arrive at a pipeline that takes 40 minutes (illustrative numbers).', flow: [['t1>ci', 't2>ci']], hidden: ['plat'], hot: ['ci'], labels: { t1: { label: '12 teams', sub: '120 changes / day' } }, badges: { ci: ['queue grows', 'warn'] } },
          { text: 'Only 12 serial runs fit in a day, so changes ship in <b>batches of 10</b>. At 3 % failure per change, about one batch in four contains a bad change and everyone in it waits.', nodes: ['ci'], hidden: ['plat'], err: ['ci'], badges: { ci: ['1 in 4 fails', 'err'] }, tone: 'err' },
          { text: 'First fix, still one deployable: build and test <b>only the modules a change touches</b>, and run the merge queue in parallel. This is what good module boundaries make possible.', nodes: ['ci', 'chk', 'cat'], hidden: ['plat'], ok: ['ci'], badges: { ci: ['affected modules only', 'ok'] } },
          { text: 'Second fix, when a module\'s team still waits on others: <b>extract that module</b> as a service with its own pipeline. Checkout now ships whenever it is ready.', flow: ['t1>ci', 'ci>chk'], ok: ['chk'], labels: { chk: { label: 'checkout-svc', sub: 'own pipeline' } }, badges: { chk: ['independent', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'premium', title: 'Microservices: what you start paying', tone: 'info',
        steps: [
          { text: 'Checkout is now a service. Its call to inventory crosses the <b>network</b>: add serialisation, a few milliseconds, and a timeout because the reply may never come.', flow: ['user>lb', 'lb>chk', 'chk>inv'], labels: { chk: { label: 'checkout-svc', sub: 'own pod' }, inv: { label: 'inventory-svc', sub: 'own pod' } }, badges: { inv: ['+ms, may fail', 'warn'] } },
          { text: 'Order and reservation live in <b>different databases</b>. A failure between the two commits needs a saga with a compensating action. See <a href="event-driven-sagas.html">Sagas</a>.', flow: ['chk>db', 'chk>bus', 'bus>inv'], warn: ['db'], labels: { db: { label: 'DB per service', sub: 'no shared tx' } }, badges: { db: ['eventual', 'warn'] }, tone: 'warn' },
          { text: 'Finding out why one request was slow now needs <b>distributed tracing</b>, central logs and a dashboard per service. The platform is no longer optional.', nodes: ['plat', 'chk', 'inv', 'cat'], hot: ['plat'], badges: { plat: ['required', 'info'] } },
          { text: 'Each service has a pipeline, dependencies to upgrade and an on-call rota. This is the <b>microservice premium</b>. It is worth paying when it removes a larger cost: teams blocking teams.', flow: [['t1>ci', 't2>ci']], badges: { ci: ['× N pipelines', 'warn'] } }
        ]
      },
      {
        id: 'distmono', title: 'Distributed monolith: nothing ships alone', tone: 'err',
        steps: [
          { text: 'Twelve services share one "common" library that holds the domain model, and all read the same tables. On the diagram they look independent.', nodes: ['chk', 'cat', 'inv', 'db'], warn: ['db'], labels: { db: { label: 'Shared DB', sub: 'everyone reads all' } }, badges: { db: ['shared', 'warn'] } },
          { text: 'A field is added to the shared model. Every service must take the new library version and be <b>redeployed together</b>, or readers and writers disagree.', flow: [['ci>chk', 'ci>cat']], err: ['chk', 'cat', 'inv'], badges: { ci: ['12 deploys, 1 change', 'err'] }, tone: 'err' },
          { text: 'One deploy fails half-way. Some services run the new version and some the old. Requests fail in ways no single team can explain.', flow: ['chk>cat', 'chk>inv'], err: ['inv'], badges: { inv: ['old version', 'err'] }, tone: 'err' },
          { text: 'The test is simple: <b>can you deploy one service on its own, at any time?</b> If not, either remove the coupling (own data, versioned contracts) or merge the services back into one deployable.', nodes: ['chk', 'cat', 'inv'], ok: ['chk'], badges: { chk: ['merge or decouple', 'ok'] }, tone: 'ok' }
        ]
      }
    ],

    knobs: {
      intro: 'Set the shape and the situation. Meter values are <em>illustrative</em> judgements that combine the arguments on this page; they are not benchmarks.',
      controls: [
        { id: 'shape', label: 'Shape', type: 'seg', value: 'mod', options: [
          { v: 'mono', l: 'Monolith, no walls' }, { v: 'mod', l: 'Modular monolith' }, { v: 'micro', l: 'Microservices' }] },
        { id: 'eng', label: 'Engineers', type: 'range', min: 3, max: 400, step: 1, value: 40 },
        { id: 'plat', label: 'Delivery platform', type: 'seg', value: 'cicd', options: [
          { v: 'manual', l: 'Manual deploys' }, { v: 'cicd', l: 'CI/CD + monitoring' }, { v: 'full', l: 'Full platform + tracing' }] },
        { id: 'dom', label: 'Domain knowledge', type: 'seg', value: 'known', options: [
          { v: 'new', l: 'New product, boundaries unclear' }, { v: 'known', l: 'Boundaries well understood' }] }
      ],
      evaluate(s) {
        const clamp = (x) => Math.max(0.04, Math.min(0.97, x));
        const e = s.eng, micro = s.shape === 'micro', mono = s.shape === 'mono', mod = s.shape === 'mod';
        const pl = { manual: 0, cicd: 1, full: 2 }[s.plat];
        let speed = mono ? 0.88 - e / 130 : mod ? 0.9 - e / 420 : 0.3 + Math.min(e, 200) / 200 * 0.55;
        speed += micro ? [-0.35, -0.08, 0.05][pl] + (s.dom === 'new' ? -0.2 : 0) : [-0.2, 0, 0.03][pl];
        let indep = mono ? 0.12 : mod ? 0.3 : 0.9 + (s.dom === 'new' ? -0.35 : 0) + (pl === 0 ? -0.25 : 0);
        let ops = mono ? 0.92 : mod ? 0.86 : 0.22 + pl * 0.13 + (e < 20 ? -0.12 : e > 100 ? 0.1 : 0);
        let cons = mono ? 0.92 : mod ? 0.86 : 0.35;
        let iso = mono ? 0.22 : mod ? 0.36 : 0.82 + (pl === 0 ? -0.35 : 0) + (s.dom === 'new' ? -0.12 : 0);
        let fix = mono ? 0.5 - e / 600 : mod ? 0.9 : 0.22 + (s.dom === 'known' ? 0.33 : 0);
        const metrics = [
          { k: 'Delivery speed', v: speed >= 0.7 ? 'changes flow' : speed >= 0.45 ? 'some waiting' : 'slow: waiting or plumbing', s: clamp(speed) },
          { k: 'Deploy independence', v: indep >= 0.7 ? 'each team ships alone' : indep >= 0.25 ? 'one shared release' : 'everything ships together', s: clamp(indep) },
          { k: 'Operating cost', v: ops >= 0.7 ? 'one thing to run' : ops >= 0.4 ? 'paid for by a platform' : 'heavy for this team', s: clamp(ops), hint: 'lower bar = costlier' },
          { k: 'Data consistency', v: cons >= 0.7 ? 'local ACID transactions' : 'sagas, eventual consistency', s: clamp(cons) },
          { k: 'Fault isolation', v: iso >= 0.7 ? 'one service fails alone' : iso >= 0.3 ? 'a bad module can hurt the process' : 'one bug or leak takes all down', s: clamp(iso) },
          { k: 'Cost of a wrong boundary', v: fix >= 0.7 ? 'move code in a refactor' : fix >= 0.4 ? 'weeks of untangling' : 'cross-service migration', s: clamp(fix), hint: 'lower bar = costlier' }
        ];
        const notes = [];
        if (micro && pl === 0) notes.push('Fowler\'s prerequisites: provision quickly, monitor, deploy quickly and automatically. Without them every extra service adds manual work and blind spots.');
        if (micro && s.dom === 'new') notes.push('In a new domain the first boundaries are usually wrong. Across services, fixing one means changing APIs, moving data and coordinating teams.');
        if (micro && e < 20) notes.push('With ' + e + ' engineers there is no release contention to remove, so the premium buys nothing yet.');
        if (micro && e >= 50 && pl === 2) notes.push('At this size teams would otherwise queue behind one release. Independent pipelines are what the premium pays for.');
        if (mono && e > 40) notes.push('With ' + e + ' engineers and no enforced modules, every team can reach into every other team\'s code. Add walls before considering a split.');
        if (mono && e <= 40) notes.push('Fine for a small team. Introduce module boundaries while the codebase is small enough to reorganise in a week.');
        if (mod) notes.push('Boundaries are checked in the build and each module owns its schema, so extracting a service later is a move along an existing wall.');
        if (mod && e > 200) notes.push('This still works at several hundred engineers (Shopify is the public example) but needs investment in build tooling: affected-module tests and a parallel merge queue.');
        let verdict;
        if (micro && pl === 0) verdict = '❌ <b>Microservices without automated delivery and monitoring.</b> Build the platform basics first; until then keep one deployable.';
        else if (micro && s.dom === 'new') verdict = '⚠ <b>Too early.</b> Learn the domain in a modular monolith; split when the boundaries have stopped moving.';
        else if (micro && e < 20) verdict = '⚠ <b>All premium, no pay-off</b> at this team size. A modular monolith gives the same boundaries for far less running cost.';
        else if (micro && e >= 50 && pl === 2) verdict = '✅ <b>Microservices earn their cost here:</b> many teams, known boundaries and a platform that makes a service cheap.';
        else if (micro) verdict = '👍 <b>Workable.</b> Keep the number of services close to the number of teams and invest in the platform.';
        else if (mono && e > 40) verdict = '⚠ <b>Heading for a big ball of mud.</b> Enforce module boundaries now; that is cheaper than any split.';
        else if (mono) verdict = '👍 <b>A simple monolith is a fine start.</b> Add enforced modules before the second or third team arrives.';
        else if (e > 250) verdict = '👍 <b>A large modular monolith.</b> Sound, if you fund the build tooling; extract the modules whose teams still wait.';
        else verdict = '✅ <b>The sensible default:</b> one deployable, enforced boundaries, and the option to extract a service when a module earns it.';
        const svc = (n, sub) => (micro ? { label: n + '-svc', sub: sub || 'own pod + pipeline' } : mono ? { label: n, sub: 'package, no rules' } : { label: n + ' module', sub: 'public API' });
        const labels = {
          chk: svc('checkout'), cat: svc('catalog'), inv: svc('inventory'),
          db: micro ? { label: 'DB per service', sub: 'no shared tx' } : mono ? { label: 'One database', sub: 'any table, any code' } : { label: 'One Postgres', sub: 'schema per module' },
          ci: micro ? { label: 'Pipeline per svc', sub: 'independent' } : mod ? { label: 'Build pipeline', sub: 'tests · module rules' } : { label: 'Build pipeline', sub: 'tests only' },
          bus: micro ? { label: 'Event broker', sub: 'Kafka' } : { label: 'App events', sub: 'in-process' },
          lb: micro ? { label: 'API gateway', sub: 'routes by path' } : { label: 'Load balancer', sub: 'N identical replicas' },
          t1: { label: e >= 16 ? Math.round(e / 8) + ' teams' : 'One team', sub: e + ' engineers' }
        };
        const badges = {};
        if (!micro && e > 100) badges.ci = ['release queue', mod ? 'warn' : 'err'];
        if (micro && pl < 2) badges.plat = [pl === 0 ? 'missing' : 'partial', pl === 0 ? 'err' : 'warn'];
        if (micro && s.dom === 'new') badges.chk = ['boundary guess', 'warn'];
        if (mod) badges.db = ['1 ACID tx', 'ok'];
        if (mono && e > 40) badges.chk = ['tangled', 'warn'];
        return {
          metrics, verdict, notes: notes.slice(0, 4), labels, badges,
          hide: (micro ? [] : ['plat']).concat(e < 16 ? ['t2'] : []),
          flow: micro ? ['user>lb', 'lb>chk', 'chk>cat', 'chk>inv', 'chk>bus', 'bus>inv'] : ['user>lb', 'lb>chk', ['chk>cat', 'chk>inv'], ['chk>db', 'inv>db']],
          err: micro && pl === 0 ? ['plat'] : [],
          warn: (mono && e > 40 ? ['chk', 'cat', 'inv'] : []).concat(micro && s.dom === 'new' ? ['chk'] : []),
          ok: mod ? ['db', 'ci'] : micro && pl === 2 && s.dom === 'known' ? ['plat'] : [],
          hot: !micro && e > 100 ? ['ci'] : []
        };
      }
    },

    widget: {
      title: 'Release lanes: one pipeline, many pipelines, or lockstep',
      caption: 'A working day of changes flows through the delivery pipeline. In a <b>monolith</b> all changes share one lane and ship in batches; a batch with one bad change fails and is retried in halves. <b>Microservices</b> give each service a lane, but some changes span two services and every service has a running cost. A <b>distributed monolith</b> has many lanes that must all release together. Change the team size and compare lead time.'
    },

    realWorld: {
      intro: 'The public record is unusually balanced on this topic: the people who named microservices also wrote the warnings, and several companies have published moves in both directions.',
      timeline: [
        { when: '2014', who: 'James Lewis & Martin Fowler', title: 'The article that named the style', text: 'Defines microservices as a suite of small services, each in its own process, built around business capabilities and <b>independently deployable</b> by automated machinery. The same article lists the costs: remote calls, eventual consistency and operational complexity.', src: 0 },
        { when: '2014', who: 'Martin Fowler', title: 'Microservice Prerequisites', text: 'Three capabilities to have before going to production with more than a few services: <b>rapid provisioning</b>, <b>basic monitoring</b> and <b>rapid application deployment</b>. Together they imply close collaboration between developers and operations.', src: 3 },
        { when: '2015', who: 'Martin Fowler', title: 'Microservice Premium and MonolithFirst', text: 'The <b>premium</b> is the extra cost of running a set of services; it only pays back for more complex systems. In MonolithFirst he observes that almost all successful microservice stories started as a monolith that grew too big and was then split.', src: 2 },
        { when: '2015', who: 'Stefan Tilkov', title: 'Don\'t start with a monolith', text: 'The counter-argument, published on Fowler\'s own site: parts of a monolith become tightly coupled, so cutting it up later is very hard. If you know the domain well, start with separate, well-bounded systems. Both sides agree that <b>boundaries</b> are the hard part.', src: 4 },
        { when: '2018', who: 'Segment', title: 'Goodbye Microservices', text: 'Segment had moved from a monolith to one service per destination for fault isolation. With more than a hundred services, shared-library versions drifted and bulk updates were slow. They merged the destinations into one service again, and kept microservices elsewhere.', src: 5 },
        { when: '2019', who: 'Shopify', title: 'Deconstructing the Monolith', text: 'Shopify considered microservices and chose a <b>modular monolith</b> instead: one codebase and one deployable, with boundaries between components made explicit and enforced. The stated reason was to get modularity without the complexity of a distributed system.', src: 6 },
        { when: '2020 → 2024', who: 'Shopify', title: 'Packwerk, and an honest retrospective', text: 'Packwerk, released in 2020, is a static checker for dependencies between packages in a Rails app. A later retrospective reports its limits: static analysis cannot see constants created at run time, and the privacy checks were removed in version 3.0. Enforcement tooling needs upkeep too.', src: 8 },
        { when: '2020', who: 'Uber', title: 'Too many services: group them', text: 'With around <b>2,200 critical microservices</b>, Uber introduced Domain-Oriented Microservice Architecture: services grouped into domains behind gateways, so that teams deal with a few domains, not thousands of services.', src: 9 },
        { when: '2023', who: 'Amazon Prime Video', title: 'A distributed pipeline folded into one process', text: 'The video-quality monitoring team replaced a design of distributed components coordinated by AWS Step Functions with a single process on Amazon ECS, passing frames in memory instead of through S3. They reported an infrastructure cost reduction of <b>over 90 %</b>. It was one workload, not a company-wide change.', src: 10 },
        { when: 'tooling', who: 'Spring, ArchUnit and others', title: 'Module boundaries as a build check', text: 'Spring Modulith\'s <code>ApplicationModules.verify()</code> fails a test on module cycles or access to another module\'s internals. Equivalent tools exist per stack. They turn "modular monolith" from an intention into something the pipeline enforces.', src: 11 }
      ],
      lessons: [
        'Microservices have a <b>premium</b>; pay it only to remove a larger, named cost.',
        '<b>Boundaries first</b>: a modular monolith makes them cheap to get wrong and fix.',
        'Have the <b>prerequisites</b> (automated deploys, monitoring) before the second service.',
        'If services cannot ship alone, it is a <b>distributed monolith</b>: decouple or merge.',
        'The move goes <b>both ways</b>: merging services is a normal correction.'
      ],
      sources: [
        { title: 'Microservices: a definition of this new architectural term', url: 'https://www.martinfowler.com/articles/microservices.html', pub: 'James Lewis & Martin Fowler, 2014' },
        { title: 'MonolithFirst', url: 'https://www.martinfowler.com/bliki/MonolithFirst.html', pub: 'Martin Fowler, 2015' },
        { title: 'MicroservicePremium', url: 'https://martinfowler.com/bliki/MicroservicePremium.html', pub: 'Martin Fowler, May 2015' },
        { title: 'MicroservicePrerequisites', url: 'https://martinfowler.com/bliki/MicroservicePrerequisites.html', pub: 'Martin Fowler, August 2014' },
        { title: 'Don\'t start with a monolith', url: 'https://www.martinfowler.com/articles/dont-start-monolith.html', pub: 'Stefan Tilkov, 2015' },
        { title: 'Goodbye Microservices: From 100s of problem children to 1 superstar', url: 'https://segment.com/blog/goodbye-microservices', pub: 'Alexandra Noonan, Segment Engineering, July 2018' },
        { title: 'Deconstructing the Monolith: Designing Software that Maximizes Developer Productivity', url: 'https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity', pub: 'Kirsten Westeinde, Shopify Engineering, 2019' },
        { title: 'Enforcing Modularity in Rails Apps with Packwerk', url: 'https://shopify.engineering/enforcing-modularity-rails-apps-packwerk', pub: 'Shopify Engineering, 2020' },
        { title: 'A Packwerk Retrospective', url: 'https://shopify.engineering/a-packwerk-retrospective', pub: 'Shopify Engineering, 2024' },
        { title: 'Introducing Domain-Oriented Microservice Architecture', url: 'https://www.uber.com/blog/microservice-architecture/', pub: 'Uber Engineering, July 2020' },
        { title: 'Prime Video Switched from Serverless to EC2 and ECS to Save Costs', url: 'https://infoq.com/news/2023/05/prime-ec2-ecs-saves-costs', pub: 'InfoQ, May 2023 (reporting the Prime Video Tech post by Marcin Kolny)' },
        { title: 'Verifying Application Module Structure', url: 'https://docs.spring.io/spring-modulith/reference/verification.html', pub: 'Spring Modulith reference documentation' }
      ]
    },

    tradeoffs: {
      headers: ['Concern', 'Monolith', 'Modular monolith', 'Microservices'],
      rows: [
        ['Call between parts', 'Method call, any class to any class', 'Method call through a public module API', 'Network call: latency, timeouts, partial failure'],
        ['Transactions', 'One ACID transaction', 'One ACID transaction across module schemas', 'Local transactions plus sagas; eventual consistency'],
        ['Release', 'One pipeline, everything together', 'One pipeline; can test only affected modules', 'One pipeline per service; contract tests between them'],
        ['Fault isolation', 'A leak or crash takes all down', 'Same process, same fate', 'Good, if timeouts and bulkheads exist; cascades if not'],
        ['Fixing a wrong boundary', 'No boundary to fix; untangle first', 'Move code and a schema; one refactor', 'Change contracts, migrate data, coordinate teams'],
        ['Fits when', '1–2 teams, early product', 'A few to many teams; domain still moving', 'Many teams blocked on one release; platform in place']
      ]
    },
    failures: [
      { f: 'Distributed monolith', detect: 'Services released together; a shared database or shared domain library; a version bump touches every repo', fix: 'Give each service its own data and versioned contracts, or merge the services back. Track the lockstep-deploy share.' },
      { f: 'Big ball of mud', detect: 'No module rules; dependency cycles; any change breaks distant tests', fix: 'Introduce modules along capabilities, freeze new violations in CI, then burn down the existing ones.' },
      { f: 'Premature split', detect: 'More services than engineers; most features need several PRs; boundaries keep moving', fix: 'Merge into a modular monolith; split again later with evidence.' },
      { f: 'Missing prerequisites', detect: 'Deploys are manual; no tracing; incidents take hours to locate', fix: 'Automate the pipeline, add metrics, logs and traces (OpenTelemetry) and a service template before adding services.' },
      { f: 'Sync call chains', detect: 'A request crosses five or more services in sequence; availability falls with each hop', fix: 'Collapse chatty neighbours, move to events where a reply is not needed, add timeouts and breakers (<a href="resiliency-patterns.html">Resiliency Patterns</a>).' },
      { f: 'Big-bang rewrite', detect: 'A multi-quarter project with no production traffic on the new system', fix: 'Migrate one slice at a time behind a router (<a href="strangler-fig.html">Strangler Fig</a>), with a rollback at every step.' },
      { f: 'Modular in name only', detect: 'Modules exist as folders, but nothing fails when one imports another\'s internals', fix: 'Add a build check (Spring Modulith, ArchUnit, Packwerk, import-linter) and schema-level permissions.' }
    ],

    interview: [
      { q: 'Monolith, modular monolith, microservices: how do you choose?', a: '<p>I start from the constraint that actually hurts, not from the style.</p><ul><li><b>Team count and contention</b>: are teams waiting for each other to release?</li><li><b>Domain knowledge</b>: are the boundaries stable, or still being discovered?</li><li><b>Differences between parts</b>: scaling profile, release pace, risk or compliance, runtime.</li><li><b>Operational maturity</b>: automated deploys, monitoring, tracing, on-call.</li></ul><p>My default is a <b>modular monolith</b> with enforced boundaries. I extract a service when one module needs something the shared deployable cannot give it. I would go mostly microservices when many teams are blocked on one release and a platform makes each service cheap.</p>', lvl: 'core' },
      { q: 'What exactly do microservices cost?', a: '<ul><li><b>Network</b>: every in-process call that becomes remote gains latency, serialisation, timeouts and partial failure. Availability multiplies along a synchronous chain.</li><li><b>Data</b>: no cross-service transaction. You need sagas, idempotency and tolerance for eventual consistency. Joins become API calls or copied data.</li><li><b>Operations</b>: a pipeline, dashboards, alerts, on-call and dependency upgrades per service, plus tracing and service discovery to see across them.</li><li><b>Testing</b>: contract tests and versioned APIs replace a compiler.</li><li><b>Wrong boundaries</b> are expensive to move.</li></ul><p>Fowler calls the sum the <b>microservice premium</b>.</p>', lvl: 'core' },
      { q: 'And what do they buy that a monolith cannot?', a: '<ul><li><b>Independent deployment</b>: a team releases without waiting for or re-testing others. This is the main one.</li><li><b>Independent scaling</b> and resource tuning of one hot part.</li><li><b>Fault isolation</b>, if calls have timeouts and fallbacks.</li><li><b>Technology choice</b> per service, used sparingly.</li><li><b>Hard boundaries</b>: you cannot reach into another service\'s tables by accident.</li></ul><p>Note that a modular monolith can provide the last point through tooling, and most systems never need the others for every part.</p>', lvl: 'core' },
      { q: 'What is a modular monolith and how do you enforce the modules?', a: '<p>One deployable whose code is split into modules by business capability. Each module has a small <b>public API</b> and private internals, and owns its tables.</p><p>Enforcement must be automatic:</p><ul><li><b>Code</b>: a build check for cycles and access to internals: Spring Modulith or ArchUnit on the JVM, Packwerk for Ruby, import-linter for Python, internal packages in Go.</li><li><b>Data</b>: a schema and a database role per module; no cross-schema foreign keys or joins.</li><li><b>Communication</b>: calls through the public API, or in-process events for things that can happen after commit.</li></ul>', fu: 'What happens to a transaction that spans two modules?', lvl: 'core' },
      { q: 'What is a distributed monolith and how do you recognise one?', a: '<p>A set of services that cannot be changed or deployed independently. You pay for distribution and get none of the autonomy.</p><p>Signs: releases that must go out together or in order; a shared database or tables with several writers; a shared library carrying the domain model, so a change means bumping every service; long synchronous chains where one slow service stalls all; integration tests that need the whole estate.</p><p>The one-line test: <b>can I deploy this service alone on a Tuesday afternoon?</b> If not, remove the coupling or merge.</p>', lvl: 'core' },
      { q: 'Fowler says "monolith first". Tilkov says "don\'t start with a monolith". Who is right?', a: '<p>They disagree less than the titles suggest. Fowler\'s point: you rarely know the boundaries at the start, and wrong boundaries are costly across services, so begin in one deployable and split when it hurts. Tilkov\'s point: an ordinary monolith does not keep its parts apart, so by the time you want to split, everything is entangled.</p><p>The synthesis is the <b>modular monolith</b>: start in one deployable <em>and</em> enforce boundaries from day one. If the domain is well known and several teams exist already, starting with a few coarse services is also reasonable.</p>', lvl: 'deep' },
      { q: 'Give me numbers: when does one shared pipeline stop scaling?', a: '<p>Model it. With <i>N</i> engineers merging <i>c</i> changes a week, changes per day are <i>N·c/5</i>. A serial pipeline of <i>T</i> minutes fits 480/<i>T</i> runs in a day, so batch size is demand over runs. If each change has probability <i>f</i> of being bad, a batch of <i>k</i> fails with probability 1 − (1 − <i>f</i>)<sup>k</sup>.</p><p>Example: 200 engineers, 3 changes a week, 40-minute pipeline: 120 changes over 12 runs, batches of 10; at 3 % that is about a 26 % failure chance per run. Mitigations in order: faster and selective builds, a parallel merge queue, then extracting the modules whose teams still wait. The numbers are a model, not a law, but they show <b>why</b> the pain is contention.</p>', lvl: 'deep' },
      { q: 'What must be in place before the first service is extracted?', a: '<p>Fowler\'s three prerequisites: <b>rapid provisioning</b>, <b>basic monitoring</b>, <b>rapid application deployment</b>. In today\'s terms:</p><ul><li>An automated pipeline that takes a commit to production.</li><li>Metrics, central logs and distributed tracing with a propagated trace id.</li><li>A service template, so a new service starts with health checks, timeouts and dashboards.</li><li>An owner and an on-call rota.</li><li>A contract and a compatibility rule for its API.</li></ul><p>If these are missing, the first extraction should be small and its real goal is to build them.</p>', lvl: 'core' },
      { q: 'Which module would you extract first, and how?', a: '<p>The one with the clearest <b>reason</b> and the fewest inbound dependencies: often something with a very different load profile (search, media processing) or a separate team and pace. I avoid starting with the core domain that everything touches.</p><p>How: make it a clean module first (public API, own schema), put a router or interface in front, build the service, shift traffic gradually with a way back, then move data ownership. That is the <a href="strangler-fig.html">strangler fig</a> pattern; the data move follows <a href="zero-downtime-migrations.html">expand and contract</a>.</p>', lvl: 'deep' },
      { q: 'Prime Video moved a service "back to a monolith" and cut cost by 90 %. What do you take from that?', a: '<p>Read the details. It was one video-monitoring workload built from serverless components orchestrated by Step Functions, passing video frames through S3. The orchestration and the data transfer between components dominated the cost. Running the components in <b>one process</b> and passing frames in memory removed both.</p><p>The lesson is not "microservices are bad". It is that a boundary placed across a <b>high-volume, chatty data path</b> is expensive, and that the right granularity depends on the workload. Prime Video as a whole still uses many services.</p>', lvl: 'deep' },
      { q: 'Your CTO wants to rewrite the monolith as microservices this year. How do you respond?', a: '<p>I would ask what outcome is wanted: faster releases, better reliability, hiring? Then I would bring data: lead time, where changes queue, which modules change together, incident causes.</p><p>I would propose a sequence instead of a rewrite: (1) enforce module boundaries inside the monolith and speed up the pipeline; (2) build the delivery platform basics; (3) extract one or two modules with a clear reason, measure, and decide the next step from results. I would write it as an ADR with explicit extraction criteria, so "should this be a service?" has a repeatable answer.</p>', lvl: 'core' },
      { q: 'Tell me about a time you argued against splitting a system.', a: '<p><em>Sample story with illustrative numbers. Swap in your own experience.</em><br><b>Situation</b>: a 25-engineer product team planned to break a Spring Boot monolith into about 15 services because releases were slow and risky. <b>Task</b>: as the lead for the area, find out whether a split would fix that. <b>Action</b>: I measured first: the pipeline took 50 minutes, mostly a serial integration suite, and most failed releases came from two tangled packages. I proposed modules with a build check, a schema per module, parallelised tests and one extraction (report generation, which was CPU-heavy and owned by a separate team). I wrote the ADR with criteria for future extractions and presented the cost comparison. <b>Result</b>: pipeline time fell to about 15 minutes, releases went from weekly to daily, and we ran two deployables instead of fifteen. A year later one more module met the criteria and was extracted in three weeks.</p>', lvl: 'deep' }
    ],

    code: [
      {
        title: 'Java (Spring Boot): a module seam that survives extraction', lang: 'java',
        code: `// Spring Boot 3.4+, Java 21. Callers depend on the module's interface only,
// so nothing in checkout changes on the day inventory leaves the process.
public interface InventoryApi {                    // package com.shop.inventory.api
  Reservation reserve(UUID orderId, String sku, int qty);
}

@Service
@ConditionalOnProperty(name = "inventory.mode", havingValue = "local", matchIfMissing = true)
class LocalInventory implements InventoryApi {     // today: an in-process call
  private final StockRepository stock;
  LocalInventory(StockRepository stock) { this.stock = stock; }

  @Transactional                                   // joins the caller's transaction
  public Reservation reserve(UUID orderId, String sku, int qty) {
    return stock.reserve(orderId, sku, qty);
  }
}

@Service
@ConditionalOnProperty(name = "inventory.mode", havingValue = "remote")
class RemoteInventory implements InventoryApi {    // after extraction: a network call
  private final RestClient http;

  RemoteInventory(RestClient.Builder builder, Environment env) {
    var jdk = HttpClient.newBuilder().connectTimeout(Duration.ofMillis(200)).build();
    var factory = new JdkClientHttpRequestFactory(jdk);
    factory.setReadTimeout(Duration.ofMillis(800));
    this.http = builder.baseUrl(env.getRequiredProperty("inventory.url"))
        .requestFactory(factory).build();
  }

  public Reservation reserve(UUID orderId, String sku, int qty) {
    return http.post().uri("/reservations")
        .header("Idempotency-Key", orderId + ":" + sku)   // safe to retry
        .body(new ReserveRequest(orderId, sku, qty))
        .retrieve().body(Reservation.class);
    // New failure modes: timeout, 5xx, and "reserved but the reply was lost".
    // The order and the reservation no longer commit together.
  }
}`,
        note: 'The two classes show the whole trade in 40 lines. The local version shares a transaction; the remote one needs timeouts, an idempotency key and a plan for the case where the reservation succeeded but the order did not. The same seam works in any language: an interface with an in-process and a remote implementation.'
      },
      {
        title: 'SQL (Postgres): schema and role per module, plus a boundary check', lang: 'sql',
        code: `-- Postgres 15+. One database, but each module can only see its own schema.
CREATE ROLE ordering_app LOGIN;
CREATE ROLE catalog_app  LOGIN;

CREATE SCHEMA ordering AUTHORIZATION ordering_app;
CREATE SCHEMA catalog  AUTHORIZATION catalog_app;

ALTER ROLE ordering_app SET search_path = ordering;
ALTER ROLE catalog_app  SET search_path = catalog;
-- No cross grants. As ordering_app:
--   SELECT * FROM catalog.products;
--   ERROR: permission denied for schema catalog

-- Fitness function for CI: foreign keys that cross a module boundary.
-- The build fails if this returns rows.
SELECT c.conname             AS constraint_name,
       c.conrelid::regclass  AS from_table,
       c.confrelid::regclass AS to_table
FROM pg_constraint c
JOIN pg_class src ON src.oid = c.conrelid
JOIN pg_class dst ON dst.oid = c.confrelid
WHERE c.contype = 'f'
  AND src.relnamespace <> dst.relnamespace;

-- Second check: privileges a module role holds outside its own schema.
SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee IN ('ordering_app', 'catalog_app')
  AND table_schema <> split_part(grantee, '_', 1);`,
        note: 'Each module connects with its own role (in Spring, a DataSource per module; elsewhere, a connection string per module). Modules reference each other by id only, with no foreign key. When a module is extracted, its schema moves to another database with no query to rewrite.'
      },
      {
        title: 'Python: detect lockstep deploys (the distributed-monolith signature)', lang: 'python',
        code: `# Python 3.11+. Input: deploys.csv with columns  service,deployed_at  (ISO 8601).
# Output: pairs of services that are usually released within 30 minutes of each other.
import csv
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from itertools import combinations

WINDOW = timedelta(minutes=30)

with open("deploys.csv", newline="") as fh:
    deploys = sorted(
        (datetime.fromisoformat(r["deployed_at"]), r["service"])
        for r in csv.DictReader(fh))

total = Counter(service for _, service in deploys)
together = defaultdict(set)          # pair -> timestamps of deploys with a partner nearby

start = 0
for i, (t, svc) in enumerate(deploys):
    while deploys[start][0] < t - WINDOW:
        start += 1
    for earlier_t, other in deploys[start:i]:
        if other != svc:
            pair = tuple(sorted((svc, other)))
            together[pair].update({(svc, t), (other, earlier_t)})

print("lockstep%  pair")
for (a, b), hits in sorted(together.items()):
    in_a = sum(1 for s, _ in hits if s == a)
    in_b = sum(1 for s, _ in hits if s == b)
    share = 100 * min(in_a / total[a], in_b / total[b])
    if share >= 50 and min(total[a], total[b]) >= 10:
        print(f"{share:8.0f}  {a} + {b}")`,
        note: 'A pair above 50 % means neither service is really released alone. Look for the cause: a shared table, a shared model library, or a contract changed without versioning. Then decouple the pair or merge it. The 30-minute window and 50 % threshold are starting points to tune.'
      }
    ],

    related: ['architectural-styles', 'ms-service-boundaries', 'ms-communication', 'ms-antipatterns-migration', 'strangler-fig', 'conways-law', 'sd:ecommerce-orders']
  });
})();

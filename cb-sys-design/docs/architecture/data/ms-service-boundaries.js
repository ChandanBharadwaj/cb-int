(function () {
  // Change-coupling model: a share of changes touches more than one service; each extra service costs coordination.
  const m = (v) => {
    const svc = Math.round(v.svc), teams = Math.min(Math.round(v.teams), svc), k = Math.round(v.touched);
    const crossN = v.chg * v.cross / 100;
    const perTeam = svc / teams;
    // chance that another touched service belongs to the same team, if services are spread evenly
    const same = svc > 1 ? Math.max(0, (perTeam - 1) / (svc - 1)) : 1;
    const multiTeam = crossN * (1 - Math.pow(same, k - 1));
    return { svc, teams, k, crossN, perTeam, multiTeam, hours: crossN * (k - 1) * v.hrs };
  };
  const r1 = (x) => (x >= 100 ? Math.round(x).toLocaleString('en-US') : (Math.round(x * 10) / 10).toString());

  SD.register({
    slug: 'ms-service-boundaries',
    domain: 10,
    title: 'Service Boundaries & Decomposition',
    examples: 'Amazon two-pizza teams, Shopify, Uber domains',
    tagline: 'Where you cut matters more than how small you cut. A good service boundary follows a <b>business capability</b> or a <b>subdomain</b>, is owned by <b>one team</b>, and keeps <b>things that change together</b> inside the same service.',
    tldr: {
      problem: 'Split a system in the wrong places and every feature needs three services, three teams and three deploys in the right order. Split too little and one service becomes a traffic jam for every team. Both feel like "microservices do not work".',
      idea: 'Cut by what the <b>business does</b> (capabilities) or by the <b>subdomains and bounded contexts</b> of the domain model. Check the cut with evidence: <b>high cohesion</b> inside, <b>loose coupling</b> between, one owning team, private data. Measure it with <b>change coupling</b> from version control.',
      insight: 'The test of a boundary is <b>independent change</b>: can one team ship a typical feature by changing and deploying one service? If most changes cross a boundary, the boundary is in the wrong place, whatever the diagram says.',
      numbers: [
        { v: '2 patterns', l: 'Richardson: decompose by business capability, or by DDD subdomain (microservices.io)' },
        { v: '5 revs · 30 %', l: 'Code Maat default thresholds for reporting two files as coupled (tool README)' },
        { v: '1 owner', l: 'one team owns a service; a team may own several (rule of thumb)' }
      ]
    },

    intro: {
      what: 'A <b>service boundary</b> is the line that decides which code and data live inside one service and what other services may ask of it. <b>Decomposition</b> is the act of choosing those lines. A good line lets one team change and release its service without asking anyone else.',
      analogy: {
        icon: '🏬',
        title: 'Departments in a department store',
        text: 'A store is split into departments by what customers come for: shoes, kitchen, electronics. Each has its own staff, stock room and till. It is not split into "everyone who opens boxes" and "everyone who uses a till", because then selling one pair of shoes would need three departments. Services work the same way: cut by what the business does, not by technical step. The analogy stops at data: departments can share one stock system, but services should not share tables.'
      },
      problem: 'A shop splits its system by noun: a Customer service, an Order service, a Product service. Adding "gift wrapping" now changes all three, plus Payments and Shipping. Five teams plan one release. The question this page answers is <b>where do you draw the lines so that most changes stay inside one service?</b>',
      story: [
        {
          stage: 'naive',
          title: 'One service per noun',
          text: 'The team lists the nouns in the database (Order, Customer, Product) and makes one service for each. It looks tidy, and each service is small.',
          scene: {
            nodes: [
              { id: 'f', label: 'New feature', sub: 'gift wrapping', kind: 'person', at: [210, 0] },
              { id: 'a', label: 'Order svc', sub: 'order rows', kind: 'service', at: [70, 110] },
              { id: 'b', label: 'Product svc', sub: 'product rows', kind: 'service', at: [210, 110] },
              { id: 'c', label: 'Customer svc', sub: 'customer rows', kind: 'service', at: [350, 110] }
            ],
            edges: [{ from: 'f', to: 'a' }, { from: 'f', to: 'b' }, { from: 'f', to: 'c' }],
            flow: [['f>a', 'f>b', 'f>c']],
            badges: { f: ['cut by noun', 'info'] }
          }
        },
        {
          stage: 'breaks',
          title: 'Every feature crosses every line',
          text: 'A business feature is a behaviour, not a noun. Gift wrapping needs a flag on the order, a price on the product and a preference on the customer. Three teams change three services and must <b>deploy in the right order</b>. The services also call each other for every request.',
          scene: {
            nodes: [
              { id: 'f', label: 'New feature', sub: '3 teams, 3 deploys', kind: 'person', at: [210, 0] },
              { id: 'a', label: 'Order svc', sub: 'waits for others', kind: 'service', at: [70, 110] },
              { id: 'b', label: 'Product svc', sub: 'changed too', kind: 'service', at: [210, 110] },
              { id: 'c', label: 'Customer svc', sub: 'changed too', kind: 'service', at: [350, 110] }
            ],
            edges: [{ from: 'f', to: 'a' }, { from: 'f', to: 'b' }, { from: 'f', to: 'c' }, { from: 'a', to: 'b', bidi: true }, { from: 'b', to: 'c', bidi: true }],
            flow: ['f>a', 'a>b', 'b>c', 'c>b', 'b>a'],
            err: ['a'], warn: ['b', 'c'],
            badges: { f: ['lockstep release', 'err'], b: ['chatty', 'warn'] }
          }
        },
        {
          stage: 'fix',
          title: 'Cut by what the business does',
          text: 'Regroup around capabilities: <b>Ordering</b> (cart, checkout, gift options), <b>Catalog</b>, <b>Fulfilment</b>. Each keeps its own view of "order" and "product" and its own data. Gift wrapping is now one change in Ordering, plus one event that Fulfilment already listens to.',
          scene: {
            nodes: [
              { id: 'f', label: 'New feature', sub: '1 team, 1 deploy', kind: 'person', at: [210, 0] },
              { id: 'a', label: 'Ordering', sub: 'cart · checkout', kind: 'service', at: [70, 110] },
              { id: 'b', label: 'Catalog', sub: 'products · prices', kind: 'service', at: [350, 110] },
              { id: 'e', label: 'OrderPlaced', sub: 'event', kind: 'queue', at: [70, 220] },
              { id: 'c', label: 'Fulfilment', sub: 'pick · pack · ship', kind: 'service', at: [350, 220] }
            ],
            edges: [{ from: 'f', to: 'a' }, { from: 'a', to: 'e' }, { from: 'e', to: 'c' }, { from: 'a', to: 'b', dashed: true }],
            flow: ['f>a', 'a>e', 'e>c'],
            ok: ['a', 'c'],
            badges: { a: ['change stays here', 'ok'] }
          }
        }
      ],
      usedBy: ['Amazon (two-pizza teams that own a service)', 'Uber (services grouped into domains)', 'Shopify (components inside a modular monolith)', 'Spotify (squads own their services)', 'Netflix (teams own and run their services)'],
      whenToUse: [
        'You are about to <b>split a monolith</b> or add a new service and must decide what goes in it',
        'Features regularly need <b>several teams or several deploys</b> to ship',
        'A service has grown until <b>many teams edit it</b> and releases queue up'
      ],
      whenNot: [
        'You have one small team and one product: keep one deployable and read <a href="ms-monolith-vs-microservices.html">Monolith, Modular Monolith or Microservices</a> first',
        'You do not yet understand the domain: model it first with <a href="ddd.html">Domain-Driven Design</a>, then cut',
        'The pain is team structure, not code: see <a href="conways-law.html">Conway\'s Law &amp; Team Topologies</a>'
      ],
      glossary: [
        { term: 'Business capability', def: 'Something the business does to create value, such as taking orders or delivering parcels; it changes slowly even when the technology changes.' },
        { term: 'Subdomain', def: 'One part of the problem the business solves; Domain-Driven Design classes each as core, supporting or generic.' },
        { term: 'Bounded context', def: 'The area in which one model and one vocabulary apply; the usual upper limit for the size of a service.' },
        { term: 'Cohesion', def: 'How strongly the things inside one service belong together; high cohesion means they change for the same reasons.' },
        { term: 'Coupling', def: 'How much a change in one service forces a change in another; you want it low and explicit.' },
        { term: 'Change coupling', def: 'Two files or modules that keep appearing in the same commits, measured from version-control history.' },
        { term: 'Event storming', def: 'A workshop where business and technical people map a process as a timeline of domain events on sticky notes.' },
        { term: 'Nano-service', def: 'A service so small that it cannot do anything useful without calling others, so its overhead outweighs its value.' }
      ]
    },

    requirements: {
      functional: [
        '<b>Cut by business capability or subdomain</b>, never by technical layer or by database table',
        '<b>High cohesion</b>: things that change for the same reason live in the same service',
        '<b>Loose coupling</b>: other services see a small, stable contract and nothing else',
        '<b>One owning team</b> per service, able to build, deploy and run it',
        '<b>Private data</b>: no other service reads or writes its tables',
        '<b>No smaller than an aggregate, no larger than a bounded context</b> (see <a href="ddd.html">DDD</a>)'
      ],
      nonFunctional: [
        'A typical feature changes <b>one</b> service: under about 10–20 % of changes cross a boundary (<em>rule of thumb</em>)',
        'Each service deploys alone, with no release ordered against another service',
        'One request touches few services synchronously: aim for 3 or fewer in sequence (<em>rule of thumb</em>)',
        'A team can hold its services in its head: cognitive load stays within one team',
        'A new engineer can find the owner of any service in under a minute (service catalog)',
        'Boundaries are reviewed with data (change coupling, cross-team tickets) at least twice a year'
      ],
      outOfScope: [
        '<b>Entity services</b>: one service per noun, each a thin CRUD wrapper that everyone calls',
        '<b>Layer services</b>: a "UI service", a "logic service" and a "data service"',
        '<b>Nano-services</b>: one function per service, more pipelines than people',
        '<b>Shared ownership</b>: a service that every team edits and nobody runs',
        '<b>Boundary by org chart only</b>: copying today\'s reporting lines without looking at the domain'
      ]
    },

    calculator: {
      inputs: [
        { id: 'svc', label: 'Services', min: 1, max: 300, value: 40, log: true },
        { id: 'teams', label: 'Teams', min: 1, max: 60, value: 8 },
        { id: 'chg', label: 'Changes shipped per month', min: 10, max: 5000, value: 400, log: true, fmt: 'num' },
        { id: 'cross', label: 'Share of changes that touch more than one service', min: 0, max: 80, value: 25, unit: '%' },
        { id: 'touched', label: 'Services touched by such a change', min: 2, max: 8, value: 3 },
        { id: 'hrs', label: 'Coordination cost per extra service touched', min: 0.5, max: 16, value: 4, step: 0.5, unit: 'h' }
      ],
      outputs: [
        { label: 'Services per team', fmt: 'raw', f: (v) => r1(m(v).perTeam) },
        { label: 'Cross-boundary changes per month', fmt: 'raw', f: (v) => r1(m(v).crossN) },
        { label: 'Extra deploys that must be coordinated per month', fmt: 'raw', f: (v) => r1(m(v).crossN * (m(v).k - 1)) },
        { label: 'Changes per month that need two or more teams', fmt: 'raw', f: (v) => r1(m(v).multiTeam) },
        { label: 'Engineer-hours of coordination per month', fmt: 'raw', f: (v) => r1(m(v).hours) + ' h (≈ ' + r1(m(v).hours / 160) + ' FTE)' },
        { label: 'Reading', fmt: 'raw', f: (v) => (v.cross <= 10 ? 'boundaries fit the work' : v.cross <= 30 ? 'review the hottest pairs' : 'redraw: merge or move code') }
      ],
      note: 'The model is simple on purpose. A change that touches <i>k</i> services needs <i>k − 1</i> extra deploys, each with a coordination cost (meetings, contract changes, ordered releases): an <em>estimate</em> you should replace with your own. "Two or more teams" assumes services are spread evenly over teams. The thresholds in the last line are <em>rules of thumb</em>, not research results. Get the real cross-boundary share from your commits and tickets; the widget below shows how.'
    },

    api: [
      { m: 'DOC', p: 'Capability map', d: 'A one-page tree of what the business does (sell, take payment, deliver, support), 2 levels deep. Each leaf names the service or module that implements it and the owning team. Gaps and overlaps show up at once.' },
      { m: 'DOC', p: 'Event-storming board', d: 'The process as a timeline of <b>domain events</b> (past tense), with commands, actors and policies. Boundaries appear where the vocabulary changes or where a <b>pivotal event</b> hands work to another group.' },
      { m: 'DOC', p: 'Context map', d: 'Bounded contexts and the relationship between each pair (customer/supplier, anti-corruption layer, published language). Detail on the <a href="ddd.html">DDD page</a>.' },
      { m: 'YAML', p: 'catalog-info.yaml (service catalog entry)', d: 'One file per service in its repo: <code>owner</code>, <code>system</code> (the domain it belongs to), <code>providesApis</code>, <code>dependsOn</code>, lifecycle. Makes ownership and dependencies queryable.' },
      { m: 'SQL', p: 'Change-coupling report', d: 'From <code>git log</code>: pairs of modules that change in the same commit, with shared revisions and a coupling degree. Run it across repos by grouping commits per ticket id.' },
      { m: 'ADR', p: 'ADR-031: Move gift options from Catalog to Ordering', d: 'The evidence (coupling numbers, cross-team tickets), the options (merge, move, new service), the data migration, and how the contract with other services changes.' }
    ],
    dataModel: [
      { name: 'service_catalog', store: 'Service catalog (e.g. Backstage) or Postgres', fields: [['service', 'text', 'pk'], ['owner_team', 'text', 'idx'], ['capability', 'text'], ['subdomain_type', 'core|supporting|generic'], ['domain', 'text', 'idx'], ['tier', 'smallint']], note: 'Exactly one <code>owner_team</code>. A service with no owner, or with two, is the first thing to fix.' },
      { name: 'change_coupling', store: 'Analytics table, rebuilt nightly from git', fields: [['module_a', 'text', 'pk'], ['module_b', 'text', 'pk'], ['revs_a', 'int'], ['revs_b', 'int'], ['shared_revs', 'int'], ['degree_pct', 'numeric(5,1)', 'idx']], note: '<code>degree = shared / average(revs_a, revs_b)</code>, the formula Code Maat uses. High degree across two services means the boundary leaks.' },
      { name: 'cross_team_change', store: 'Derived from the issue tracker', fields: [['ticket', 'text', 'pk'], ['teams', 'text[]'], ['services', 'text[]'], ['lead_time_days', 'numeric'], ['closed_at', 'date', 'idx']], note: 'Tickets that needed more than one team. Count and lead time per month are the outcome metrics for a boundary change.' },
      { name: 'boundary_decision', store: 'ADR repository', fields: [['adr_id', 'text', 'pk'], ['decision', 'split|merge|move|keep'], ['services', 'text[]'], ['evidence', 'text'], ['decided_at', 'date']], note: 'Boundaries are decisions with a date and a reason, so they can be revisited when the evidence changes.' }
    ],

    architecture: {
      title: 'A shop cut by capability: services, owners and private data',
      nodes: [
        { id: 'tA', label: 'Storefront team', sub: 'owns Catalog', kind: 'team', wide: [280, 0], tall: [70, 0], tip: 'A stream-aligned team. It owns the Catalog service end to end: code, data, deploys, on-call.' },
        { id: 'tB', label: 'Checkout team', sub: 'owns 2 services', kind: 'team', wide: [565, 0], tall: [350, 105], tip: 'Owns Ordering and Payments. One team can own several services; one service never has two owning teams.' },
        { id: 'tC', label: 'Logistics team', sub: 'owns Fulfilment', kind: 'team', wide: [850, 0], tall: [350, 420], tip: 'Owns Fulfilment. It reacts to events from Ordering and does not call back for order details.' },
        { id: 'client', label: 'Shopper', sub: 'web / app', kind: 'client', wide: [90, 220], tall: [210, 0], tip: 'Sees one shop. The internal boundaries should be invisible to the user.' },
        { id: 'gw', label: 'API gateway', sub: 'routes by path', kind: 'edge', wide: [280, 220], tall: [210, 105], tip: 'Routes /catalog to Catalog and /orders to Ordering. It holds no business logic.' },
        { id: 'cat', label: 'Catalog', sub: 'products · prices', kind: 'service', wide: [280, 110], tall: [70, 105], tip: 'Capability: present products. Read-heavy, cacheable, changes when merchandising changes.' },
        { id: 'catdb', label: 'Catalog DB', sub: 'private', kind: 'store', wide: [90, 110], tall: [70, 210], tip: 'Only Catalog reads and writes these tables. Other services get product data from the API or from events.' },
        { id: 'ord', label: 'Ordering', sub: 'cart · checkout', kind: 'service', wide: [470, 110], tall: [210, 210], tip: 'Capability: take orders. Keeps its own copy of the product name and price at the time of purchase.' },
        { id: 'orddb', label: 'Orders DB', sub: 'private', kind: 'store', wide: [470, 220], tall: [70, 315], tip: 'Order lines store the price and title that applied when the order was placed, so Ordering does not need Catalog to show an old order.' },
        { id: 'pay', label: 'Payments', sub: 'charge · refund', kind: 'service', wide: [660, 110], tall: [350, 210], tip: 'Capability: take money. Separate because of its different risk, compliance scope (PCI DSS) and release pace.' },
        { id: 'bus', label: 'Event bus', sub: 'Kafka topics', kind: 'queue', wide: [660, 220], tall: [210, 315], tip: 'Carries facts such as OrderPlaced. Lets Fulfilment react without Ordering knowing it exists.' },
        { id: 'ful', label: 'Fulfilment', sub: 'pick · pack · ship', kind: 'service', wide: [850, 110], tall: [350, 315], tip: 'Capability: deliver the goods. Its "order" is a list of parcels and addresses, not prices.' }
      ],
      edges: [
        { from: 'tA', to: 'cat', dashed: true },
        { from: 'tB', to: 'ord', dashed: true },
        { from: 'tB', to: 'pay', dashed: true },
        { from: 'tC', to: 'ful', dashed: true },
        { from: 'client', to: 'gw' },
        { from: 'gw', to: 'cat' },
        { from: 'gw', to: 'ord' },
        { from: 'cat', to: 'catdb' },
        { from: 'ord', to: 'orddb' },
        { from: 'ord', to: 'pay' },
        { from: 'ord', to: 'bus' },
        { from: 'pay', to: 'bus' },
        { from: 'bus', to: 'ful' }
      ]
    },

    scenarios: [
      {
        id: 'local', title: 'A change that stays inside one boundary', tone: 'ok',
        steps: [
          { text: 'Product asks for <b>gift wrapping at checkout</b>. With capability boundaries, "options the buyer picks while ordering" belongs to <b>Ordering</b>.', nodes: ['ord', 'tB'], badges: { ord: 'gift option' } },
          { text: 'The Checkout team adds a column in its own database and a field in its own API. No other team reviews or deploys anything.', flow: ['tB>ord', 'ord>orddb'], ok: ['ord', 'orddb'], badges: { tB: ['1 team', 'ok'] } },
          { text: 'Ordering adds an optional field <code>giftWrap</code> to the <code>OrderPlaced</code> event. Adding an optional field is a compatible change: old consumers ignore it.', flow: ['ord>bus'], badges: { bus: '+ optional field' } },
          { text: 'Fulfilment reads the new field when it is ready, in its own release. <b>One deploy shipped the feature</b>; the second one is independent and can come later.', flow: ['bus>ful'], ok: ['ful'], badges: { ful: ['later, alone', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'entity', title: 'Entity services: every change crosses', tone: 'err',
        steps: [
          { text: 'Now cut the same shop by noun: a Product service, an Order service, a Payment service, each a thin wrapper round one table.', labels: { cat: { label: 'Product svc', sub: 'CRUD on products' }, ord: { label: 'Order svc', sub: 'CRUD on orders' }, pay: { label: 'Payment svc', sub: 'CRUD on payments' } }, nodes: ['cat', 'ord', 'pay'] },
          { text: 'Gift wrapping needs a price (Product), a flag (Order) and a new charge line (Payment). <b>Three services change for one feature.</b>', labels: { cat: { label: 'Product svc', sub: 'CRUD on products' }, ord: { label: 'Order svc', sub: 'CRUD on orders' }, pay: { label: 'Payment svc', sub: 'CRUD on payments' } }, warn: ['cat', 'ord', 'pay'], badges: { cat: ['changed', 'warn'], ord: ['changed', 'warn'], pay: ['changed', 'warn'] }, tone: 'warn' },
          { text: 'Two teams must agree the contracts and release in order: Product first, then Payment, then Order. One slips, all wait.', flow: ['tA>cat', 'tB>pay', 'tB>ord'], err: ['tA', 'tB'], badges: { tB: ['blocked', 'err'] }, tone: 'err' },
          { text: 'At run time the Order service calls the others for every screen because it holds no product data of its own. Latency and failures add up.', flow: ['gw>ord', 'ord>pay', 'gw>cat'], hot: ['ord'], badges: { ord: ['chatty', 'err'] }, tone: 'err' },
          { text: 'Fix: move behaviour and the data it needs <b>together</b>. Merge the wrappers into capability services, and let each keep its own view of shared concepts.', nodes: ['ord', 'cat'], ok: ['ord'], badges: { ord: ['regroup', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'big', title: 'Too big: split along a seam', tone: 'warn',
        steps: [
          { text: 'Ordering has grown. Four teams edit it, builds take 40 minutes and releases queue. <b>Size alone is not the signal; contention is.</b>', nodes: ['ord'], hot: ['ord'], labels: { tB: { label: '4 teams', sub: 'all edit Ordering' } }, badges: { ord: ['release queue', 'warn'] }, tone: 'warn' },
          { text: 'Change-coupling analysis shows two clusters inside it that rarely change together: <b>cart + checkout</b> and <b>promotions + pricing rules</b>.', nodes: ['ord', 'orddb'], badges: { ord: '2 clusters' } },
          { text: 'An event-storming session confirms it: marketing people talk about "campaigns" and "vouchers", checkout people about "baskets". Two vocabularies, two contexts.', nodes: ['ord', 'tB'], badges: { tB: '2 languages' } },
          { text: 'Split along that seam, first as a module with its own schema, later as its own service. The seam is chosen by evidence, not by line count.', flow: ['ord>orddb'], ok: ['ord'], labels: { pay: { label: 'Promotions', sub: 'new service' } }, badges: { pay: ['extracted', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'nano', title: 'Too small: merge two services', tone: 'warn',
        steps: [
          { text: 'Payments was once split into "Payments" and "Refunds". Each has its own repo, pipeline and on-call rota.', labels: { pay: { label: 'Payments', sub: 'charges only' }, bus: { label: 'Refunds svc', sub: 'separate repo' } }, nodes: ['pay', 'bus'] },
          { text: 'They share the same tables and the same payment-provider client. <b>Nine in ten refund changes also change Payments</b> (illustrative figure).', labels: { bus: { label: 'Refunds svc', sub: 'separate repo' } }, warn: ['pay', 'bus'], badges: { bus: ['90 % co-change', 'warn'] }, tone: 'warn' },
          { text: 'Signals of a too-small service: it cannot answer anything without a synchronous call, it always deploys with a neighbour, and its team owns more services than it has people.', labels: { bus: { label: 'Refunds svc', sub: 'separate repo' } }, flow: ['ord>pay', 'pay>bus'], badges: { pay: 'always together' } },
          { text: 'Merge them. Fewer deployables, one transaction for charge and refund, and no contract to keep in step. <b>Merging is a normal outcome</b>, not a defeat.', ok: ['pay'], badges: { pay: ['merged', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'peak', title: 'Sale day: boundaries decide what scales', tone: 'info',
        steps: [
          { text: 'A sale starts. Browsing grows 50 times; orders grow 5 times (illustrative). The two capabilities have <b>different load profiles</b>.', flow: ['client>gw', ['gw>cat', 'gw>ord']], hot: ['cat'], badges: { cat: ['50×', 'warn'], ord: ['5×', 'info'] } },
          { text: 'Because Catalog is its own service with its own data, it scales out and caches hard without touching Ordering.', flow: ['gw>cat', 'cat>catdb'], ok: ['cat'], badges: { cat: ['40 replicas', 'ok'] } },
          { text: 'Ordering does not call Catalog during checkout: it copied the price into the cart when the item was added. <b>A slow Catalog cannot stop orders.</b>', flow: ['gw>ord', 'ord>orddb', 'ord>pay'], ok: ['ord'], badges: { ord: ['no call to Catalog', 'ok'] }, tone: 'ok' },
          { text: 'Fulfilment falls behind, and that is fine. Events wait on the bus and are worked off after the peak. Different rates of change, load and risk are good reasons for a boundary.', flow: ['ord>bus', 'bus>ful'], warn: ['ful'], badges: { bus: ['backlog', 'warn'] } }
        ]
      }
    ],

    knobs: {
      intro: 'Four choices that decide whether a set of services helps or hurts. Meter values are <em>illustrative</em> judgements for a shop with about 40 engineers, not measurements.',
      controls: [
        { id: 'cut', label: 'Cut by', type: 'seg', value: 'cap', options: [
          { v: 'layer', l: 'Technical layer' }, { v: 'entity', l: 'Entity (noun)' }, { v: 'cap', l: 'Business capability' }, { v: 'sub', l: 'Subdomain / bounded context' }] },
        { id: 'size', label: 'Granularity', type: 'seg', value: 'mid', options: [
          { v: 'big', l: 'A few large services' }, { v: 'mid', l: '1–3 per team' }, { v: 'nano', l: 'One per function' }] },
        { id: 'own', label: 'Ownership', type: 'seg', value: 'one', options: [
          { v: 'shared', l: 'Everyone edits everything' }, { v: 'one', l: 'One team per service' }] },
        { id: 'data', label: 'Data', type: 'seg', value: 'private', options: [
          { v: 'shared', l: 'Shared tables' }, { v: 'private', l: 'Private data + events' }] }
      ],
      evaluate(s) {
        const clamp = (x) => Math.max(0.04, Math.min(0.97, x));
        const good = s.cut === 'cap' || s.cut === 'sub';
        let loc = { layer: 0.12, entity: 0.3, cap: 0.82, sub: 0.9 }[s.cut] + { big: 0.08, mid: 0, nano: -0.3 }[s.size] + (s.data === 'shared' ? -0.2 : 0);
        let auto = { layer: 0.15, entity: 0.35, cap: 0.8, sub: 0.85 }[s.cut] + (s.own === 'shared' ? -0.35 : 0.05) + (s.data === 'shared' ? -0.25 : 0) + { big: -0.2, mid: 0, nano: -0.05 }[s.size];
        let run = { layer: 0.3, entity: 0.25, cap: 0.75, sub: 0.8 }[s.cut] + { big: 0.15, mid: 0, nano: -0.4 }[s.size] + (s.data === 'shared' ? 0.05 : 0);
        let load = { big: 0.35, mid: 0.8, nano: 0.3 }[s.size] + (good ? 0.1 : -0.15) + (s.own === 'shared' ? -0.2 : 0);
        let ops = { big: 0.85, mid: 0.6, nano: 0.15 }[s.size];
        let safe = (s.data === 'shared' ? 0.25 : 0.8) + (s.own === 'shared' ? -0.15 : 0.05) + (s.cut === 'sub' ? 0.08 : 0);
        const metrics = [
          { k: 'Change locality', v: loc >= 0.7 ? 'most features change one service' : loc >= 0.4 ? 'many features cross a boundary' : 'almost every feature crosses', s: clamp(loc) },
          { k: 'Team autonomy', v: auto >= 0.7 ? 'teams ship alone' : auto >= 0.4 ? 'frequent hand-offs' : 'releases need a meeting', s: clamp(auto) },
          { k: 'Runtime coupling', v: run >= 0.7 ? 'few calls per request' : run >= 0.4 ? 'several hops per request' : 'chatty chains', s: clamp(run) },
          { k: 'Cognitive load per team', v: load >= 0.7 ? 'fits in one team\'s head' : load >= 0.45 ? 'stretching' : 'too much to hold', s: clamp(load) },
          { k: 'Operational overhead', v: ops >= 0.7 ? 'few pipelines and dashboards' : ops >= 0.4 ? 'manageable with a platform' : 'more services than people', s: clamp(ops), hint: 'lower bar = more overhead' },
          { k: 'Safe to change data', v: safe >= 0.7 ? 'schema is private' : safe >= 0.4 ? 'some hidden readers' : 'any column change can break others', s: clamp(safe) }
        ];
        const notes = [];
        if (s.cut === 'layer') notes.push('Layer services put the UI, the rules and the data of one feature in three places. Every feature becomes a relay race between them.');
        if (s.cut === 'entity') notes.push('Entity services look clean but hold data without behaviour. The behaviour ends up in callers, and every caller depends on every entity.');
        if (s.cut === 'cap') notes.push('Capabilities are stable: a shop takes orders and ships parcels whatever the technology. That makes them a good first cut.');
        if (s.cut === 'sub') notes.push('Subdomains and bounded contexts refine the cut where one capability hides two models. See <a href="ddd.html">DDD</a> for how to find them.');
        if (s.size === 'nano') notes.push('One service per function multiplies pipelines, dashboards and network calls. The work that belongs together is now spread across the network.');
        if (s.size === 'big') notes.push('A few large services are cheap to run but several teams share each one, so releases queue up as the organisation grows.');
        if (s.own === 'shared') notes.push('With shared ownership nobody can say no to a change or is paged when it breaks. Give every service exactly one owning team.');
        if (s.data === 'shared') notes.push('Shared tables are a hidden contract. Two services that write the same table must be released together, whatever their repos say.');
        let verdict;
        if (!good && s.data === 'shared') verdict = '❌ <b>A distributed monolith in the making:</b> wrong cut plus shared tables means every change and every deploy is coordinated.';
        else if (!good) verdict = '❌ <b>Wrong axis.</b> Cutting by ' + (s.cut === 'layer' ? 'layer' : 'noun') + ' guarantees that features cross boundaries. Regroup by capability.';
        else if (s.size === 'nano') verdict = '⚠ <b>Right axis, cut too fine.</b> Merge services that always change or deploy together.';
        else if (s.data === 'shared') verdict = '⚠ <b>Good lines on the diagram, but the data ignores them.</b> Make each service the only writer of its tables.';
        else if (s.own === 'shared') verdict = '⚠ <b>Boundaries without owners erode.</b> Assign one team per service before anything else.';
        else if (s.size === 'big') verdict = '👍 <b>Sound and cheap to run.</b> Watch for release queues; split along a measured seam when several teams collide.';
        else verdict = '✅ <b>Boundaries that match the business and the teams:</b> local changes, private data, one owner each.';
        const labels = {
          cat: s.cut === 'layer' ? { label: 'UI service', sub: 'all screens' } : s.cut === 'entity' ? { label: 'Product svc', sub: 'CRUD on products' } : { label: 'Catalog', sub: 'products · prices' },
          ord: s.cut === 'layer' ? { label: 'Logic service', sub: 'all rules' } : s.cut === 'entity' ? { label: 'Order svc', sub: 'CRUD on orders' } : { label: 'Ordering', sub: 'cart · checkout' },
          pay: s.cut === 'layer' ? { label: 'Data service', sub: 'all tables' } : s.cut === 'entity' ? { label: 'Payment svc', sub: 'CRUD on payments' } : { label: 'Payments', sub: 'charge · refund' },
          orddb: s.data === 'shared' ? { label: 'Shared DB', sub: 'all services write' } : { label: 'Orders DB', sub: 'private' },
          catdb: s.data === 'shared' ? { label: 'Same shared DB', sub: 'joined by others' } : { label: 'Catalog DB', sub: 'private' },
          tB: s.own === 'shared' ? { label: 'All teams', sub: 'edit everything' } : { label: 'Checkout team', sub: 'owns 2 services' }
        };
        const badges = {};
        if (!good) badges.ord = ['every feature', 'err'];
        if (s.size === 'nano') badges.pay = ['+ 30 tiny services', 'warn'];
        if (s.data === 'shared') badges.orddb = ['hidden contract', 'err'];
        if (s.own === 'shared') badges.tB = ['no owner', 'warn'];
        if (good && s.data === 'private' && s.own === 'one') badges.ord = ['local change', 'ok'];
        const flow = good ? ['client>gw', 'gw>ord', 'ord>orddb', 'ord>bus', 'bus>ful'] : ['client>gw', 'gw>cat', 'gw>ord', 'ord>pay', 'ord>orddb'];
        return {
          metrics, verdict, notes: notes.slice(0, 4), labels, badges, flow,
          hide: s.own === 'shared' ? ['tA', 'tC'] : [],
          err: (!good ? ['ord'] : []).concat(s.data === 'shared' ? ['orddb'] : []),
          warn: s.size === 'nano' ? ['pay'] : [],
          ok: good && s.data === 'private' ? ['orddb', 'catdb'] : [],
          hot: s.size === 'big' ? ['ord'] : []
        };
      }
    },

    widget: {
      title: 'Change-coupling lab: do your boundaries match how the code changes?',
      caption: 'Eight modules, a commit history, and three services. The grid counts how often two modules changed in the <b>same commit</b> and turns it into a coupling degree, the way Code Maat does. <b>Tap a module</b> to move it to another service and watch the share of commits that cross a service boundary. Then press <b>Cluster</b> to group by measured coupling.'
    },

    realWorld: {
      intro: 'Nobody publishes a formula for service size. What organisations and authors do publish is the axis to cut on, who should own the result, and how to check it.',
      timeline: [
        { when: '2014', who: 'James Lewis & Martin Fowler', title: 'Organised around business capabilities', text: 'Their article that named the style lists "organized around business capability" as a characteristic: cross-functional teams own a service for one business area, instead of UI, logic and database teams. They tie it to <a href="conways-law.html">Conway\'s Law</a>.', src: 0 },
        { when: 'ongoing', who: 'Chris Richardson', title: 'Decompose by business capability / by subdomain', text: 'microservices.io documents two decomposition patterns. A <b>business capability</b> is something a business does to generate value (order management, delivery management). The alternative uses DDD <b>subdomains</b>, classed as core, supporting or generic. Both say boundaries are found by studying the business, iteratively.', src: 1 },
        { when: 'ongoing', who: 'Amazon / AWS', title: 'Two-pizza teams with single-threaded ownership', text: 'AWS describes two-pizza teams as owning a specific product or service end to end, with no hand-off to another group to run it. The page stresses that the point is <b>ownership and independence</b> more than head count, and admits the cost: some duplication between teams.', src: 3 },
        { when: 'c. 2013', who: 'Alberto Brandolini', title: 'EventStorming', text: 'A workshop format from the DDD community: people from business and IT map a process as <b>domain events</b> on orange sticky notes along a long paper roll. Big Picture sessions are commonly used to find bounded contexts. Sources give 2012 or 2013 for its origin.', src: 5 },
        { when: '2018', who: 'Segment', title: 'One service per destination was too fine', text: 'Segment gave each of its 100+ destination integrations its own service and queue. Shared-library versions drifted between them and bulk changes became slow. They merged the destinations back into one service. The cut followed a technical list, not a difference in how the business changed.', src: 6 },
        { when: '2019', who: 'Matthew Skelton & Manuel Pais', title: 'Team Topologies: fracture planes', text: 'The book proposes choosing software boundaries with the team first: split along natural <b>fracture planes</b> such as bounded context, change cadence, risk and regulatory compliance, and size what a team owns by its <b>cognitive load</b>.', src: 7 },
        { when: '2020', who: 'Uber', title: 'Domains above services (DOMA)', text: 'With around <b>2,200 critical microservices</b>, Uber grouped related services into <b>domains</b>, each a logical grouping of functionality behind a gateway. The post gives no rule for how big a domain should be: "We give no guidance here." Boundaries exist at more than one level.', src: 8 },
        { when: '2021', who: 'Sam Newman', title: 'Information hiding and independent deployability', text: 'In the second edition of <i>Building Microservices</i> and related talks, Newman frames a microservice as a module whose key property is <b>independent deployability</b>, reached through <b>information hiding</b>, an idea he traces to David Parnas\'s work on modules in the early 1970s.', src: 9 },
        { when: 'tooling', who: 'Adam Tornhill', title: 'Code Maat: change coupling from git', text: 'An open-source tool that mines version-control logs. Its <code>coupling</code> analysis reports modules that change together, with defaults of at least 5 shared revisions and 30 % coupling, and ignores change sets larger than 30 files. Coupled files with no obvious reason to change together are refactoring candidates.', src: 10 }
      ],
      lessons: [
        'Cut by <b>capability or subdomain</b>; entity and layer cuts make every feature cross a line.',
        'A boundary is right when <b>one team can ship a typical change alone</b>.',
        'Use <b>evidence</b>: change coupling, cross-team tickets, event-storming vocabulary.',
        '<b>Merging</b> services is as valid as splitting them.',
        'Boundaries live at several levels: module, service, <b>domain</b>.'
      ],
      sources: [
        { title: 'Microservices: a definition of this new architectural term', url: 'https://www.martinfowler.com/articles/microservices.html', pub: 'James Lewis & Martin Fowler, 2014' },
        { title: 'Pattern: Decompose by business capability', url: 'https://microservices.io/patterns/decomposition/decompose-by-business-capability', pub: 'Chris Richardson, microservices.io' },
        { title: 'Pattern: Decompose by subdomain', url: 'https://microservices.io/patterns/decomposition/decompose-by-subdomain', pub: 'Chris Richardson, microservices.io' },
        { title: 'Amazon\'s Two-Pizza Teams', url: 'https://aws.amazon.com/executive-insights/content/amazon-two-pizza-team/', pub: 'AWS Executive Insights' },
        { title: 'Decompose by business capability', url: 'https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-decomposing-monoliths/decompose-business-capability.html', pub: 'AWS Prescriptive Guidance' },
        { title: 'Introducing EventStorming', url: 'https://leanpub.com/introducing_eventstorming', pub: 'Alberto Brandolini, Leanpub' },
        { title: 'Goodbye Microservices: From 100s of problem children to 1 superstar', url: 'https://segment.com/blog/goodbye-microservices', pub: 'Alexandra Noonan, Segment Engineering, 2018' },
        { title: 'Team Topologies (bliki summary)', url: 'https://martinfowler.com/bliki/TeamTopologies.html', pub: 'Martin Fowler, on Skelton & Pais (2019)' },
        { title: 'Introducing Domain-Oriented Microservice Architecture', url: 'https://www.uber.com/blog/microservice-architecture/', pub: 'Uber Engineering, 2020' },
        { title: 'Building Microservices, 2nd Edition', url: 'https://www.oreilly.com/library/view/building-microservices-2nd/9781492034018/', pub: 'Sam Newman, O\'Reilly, 2021' },
        { title: 'Code Maat', url: 'https://github.com/adamtornhill/code-maat', pub: 'Adam Tornhill, GitHub' },
        { title: 'Sam Newman on DDD and microservices', url: 'https://www.infoq.com/podcasts/sam-newman-ddd-microservices', pub: 'InfoQ podcast' }
      ]
    },

    tradeoffs: {
      headers: ['Decision', 'Option A', 'Option B', 'Pick when…'],
      rows: [
        ['Axis of the cut', '<b>Business capability</b>: what the business does; stable, easy to explain to non-engineers', '<b>Subdomain / bounded context</b>: where the model and language change; more precise, needs domain work', 'Start with capabilities; refine with contexts where one capability hides two models'],
        ['Granularity', '<b>Coarse</b>: a few services, cheap to run, simple transactions', '<b>Fine</b>: many services, independent scaling and release, more network and ops', 'Coarse until teams collide or load profiles differ; never finer than an aggregate'],
        ['Shared concept (e.g. Product)', '<b>One service owns it</b>, others call for it', '<b>Each context keeps its own view</b>, fed by events', 'Own view when the consumer needs it on its hot path or must work when the owner is down'],
        ['Misplaced code', '<b>Move it</b> across the boundary (and its data)', '<b>Live with it</b> behind a contract', 'Move when it shows up in change coupling month after month; live with it if it rarely changes'],
        ['Two services that co-change', '<b>Merge</b> them', '<b>Keep apart</b> and fix the contract', 'Merge when one team owns both and they deploy together; keep apart if owners, risk or scaling differ'],
        ['Finding boundaries', '<b>Workshop</b> (event storming, capability map): fast, uses people\'s knowledge', '<b>Data</b> (change coupling, tickets, traces): slower, shows what really happens', 'Both: workshop to propose a cut, data to test it']
      ]
    },
    failures: [
      { f: 'Entity services', detect: 'Services named after tables; most of their endpoints are CRUD; callers hold the business rules', fix: 'Regroup by capability; move behaviour next to its data; let each context keep its own view of shared nouns.' },
      { f: 'Nano-services', detect: 'A team owns more services than it has engineers; services always deploy in pairs; one request fans out to dozens of calls', fix: 'Merge services that share an owner and co-change; set a rule that a new service needs a reason (owner, scaling, risk or pace).' },
      { f: 'God service', detect: 'Many teams commit to one repo; long build; release queue; unrelated incidents share one on-call rota', fix: 'Find clusters with change coupling; extract along the weakest link, module first, service second.' },
      { f: 'Shared database across boundaries', detect: 'Cross-schema joins and foreign keys; a column rename breaks another team', fix: 'One writer per table; expose data by API or events; split schemas and revoke cross-service grants.' },
      { f: 'Boundary copied from the org chart', detect: 'Services map to departments but features still need three of them', fix: 'Model the domain first, then adjust team shape to it (the inverse Conway manoeuvre, see <a href="conways-law.html">Conway\'s Law</a>).' },
      { f: 'Orphan service', detect: 'No owner in the catalog; nobody answers its alerts; dependency upgrades pile up', fix: 'Assign an owner or retire it; make an owner mandatory in the service catalog and in CI.' },
      { f: 'Frozen boundaries', detect: 'Everyone knows a cut is wrong but moving code "is not allowed"', fix: 'Treat boundaries as ADRs with evidence and a review date; budget for moving code as normal work.' }
    ],

    interview: [
      { q: 'How do you decide where one microservice ends and the next begins?', a: '<p>I start from the business, not the database. Two standard ways: <b>decompose by business capability</b> (what the business does: take orders, take payment, deliver) and <b>decompose by subdomain</b> using DDD bounded contexts (where the model and the vocabulary change).</p><p>Then I test the proposed cut against four checks: things that change together are together (<b>cohesion</b>); other services see a small contract (<b>coupling</b>); <b>one team</b> can own it; its <b>data is private</b>. The summary test: can that team ship a typical feature by deploying only this service?</p>', lvl: 'core' },
      { q: 'What is the difference between a business capability and a subdomain?', a: '<p>A <b>business capability</b> comes from business architecture: something the organisation does to create value, such as order management. It describes the business from the outside and is stable over years.</p><p>A <b>subdomain</b> comes from Domain-Driven Design: a part of the problem space, classed as core, supporting or generic. Its solution-side partner is the <b>bounded context</b>, where one model applies.</p><p>In practice they often give the same answer. Subdomains are sharper when one capability hides two different models, for example "pricing rules" and "checkout" both inside ordering.</p>', lvl: 'core' },
      { q: 'Explain cohesion and coupling for services. How would you measure them?', a: '<p><b>Cohesion</b>: the parts of one service change for the same reasons. <b>Coupling</b>: a change in one service forces a change in another.</p><ul><li><b>Change coupling</b> from git: pairs of modules in the same commits or tickets. High inside a service is good cohesion; high across services is a leaking boundary.</li><li><b>Cross-team tickets</b> and their lead time.</li><li><b>Runtime coupling</b> from traces: synchronous calls per request and call depth.</li><li><b>Deploy coupling</b>: how often two services are released within the same hour.</li></ul>', fu: 'Which of these would you put on a dashboard?', lvl: 'core' },
      { q: 'What are the signs that a service is too big?', a: '<ul><li>Several teams commit to it and wait for each other to release.</li><li>Build and test time keeps growing; a small change takes a long pipeline.</li><li>Change coupling shows clusters inside it that rarely change together.</li><li>People use two vocabularies for it, a hint of two bounded contexts.</li><li>Parts of it need very different scaling, availability or compliance treatment.</li></ul><p>Lines of code is not on the list. A large service owned by one team with a fast pipeline is fine.</p>', lvl: 'core' },
      { q: 'And the signs that a service is too small?', a: '<ul><li>It cannot do anything useful without synchronous calls to a neighbour.</li><li>It is almost always deployed together with another service.</li><li>It shares tables or a large domain library with a sibling.</li><li>A business transaction that used to be one local commit now needs a saga.</li><li>The team owns more services than it has people.</li></ul><p>The fix is to <b>merge</b>. Segment did exactly this in 2018 with its one-service-per-destination design.</p>', lvl: 'core' },
      { q: 'Why are entity services an anti-pattern?', a: '<p>An entity service wraps one noun: Customer service, Order service. It holds data but little behaviour. The behaviour then lives in the callers, so every feature touches several entity services, and every screen needs calls to all of them. You get low cohesion and high coupling: the reverse of the goal.</p><p>The alternative is to let each capability keep <b>its own view</b> of the noun. Ordering stores the product title and price at purchase time; Fulfilment stores weight and dimensions. The same real-world thing appears in several models, on purpose.</p>', lvl: 'core' },
      { q: 'How would you find boundaries in a ten-year-old monolith?', a: '<ol><li><b>Workshop</b>: a Big Picture event-storming session with business and engineering to map the process and spot where language and responsibility change.</li><li><b>Data</b>: run change-coupling analysis on a year of git history to see which packages really move together, and read the database for tables written by many modules.</li><li><b>Propose</b> a capability map and context map; mark each context core, supporting or generic.</li><li><b>Prove it in place</b>: enforce the cut as modules inside the monolith first, with private schemas.</li><li><b>Extract</b> only the modules that have a reason: a different owner, scaling need or release pace.</li></ol>', fu: 'What would make you stop before step 5?', lvl: 'deep' },
      { q: 'How does team structure affect service boundaries?', a: '<p>Conway\'s Law says a system\'s design mirrors the communication structure of the organisation that builds it. So a boundary that no team owns will not hold, and a service shared by three teams will grow three designs.</p><p>I aim for <b>one owning team per service</b>, with a team owning a handful of related services at most, sized by cognitive load. Where the ideal boundaries do not match the teams, I would rather change the teams (the inverse Conway manoeuvre) than draw services round the org chart. The <a href="conways-law.html">Conway\'s Law page</a> has the detail.</p>', lvl: 'core' },
      { q: 'Two services need the same data, say product information. Who owns it?', a: '<p>Exactly one service is the <b>system of record</b> and the only writer: here, Catalog. Others have three options, in order of coupling:</p><ul><li>Call Catalog when needed. Simple, but couples availability and latency.</li><li>Keep a <b>local read copy</b> fed by Catalog\'s events. No runtime dependency, eventually consistent.</li><li>Store a <b>snapshot</b> at the moment it matters (price at purchase). This is often the correct business rule anyway.</li></ul><p>What I avoid is a shared table or a shared "common model" library, because both make the two services change together.</p>', lvl: 'deep' },
      { q: 'How do you check, a year later, that the boundaries were right?', a: '<p>I look at outcomes, not diagrams:</p><ul><li>Share of changes and tickets that touch more than one service or team, and its trend.</li><li>Lead time of cross-team changes compared with single-team changes.</li><li>Services that are deployed together most of the time.</li><li>Synchronous call depth on the main user journeys.</li><li>Incidents where one service\'s failure took down another.</li></ul><p>If a pair of services keeps showing up, I write an ADR to merge them or move code. Boundaries are decisions that can be revisited.</p>', lvl: 'deep' },
      { q: 'A team wants a new microservice for a small feature. How do you respond?', a: '<p>I ask which <b>reason</b> applies: a different owning team, a different scaling or availability need, a different risk or compliance scope, or a different release pace. If none applies, the feature belongs as a <b>module in an existing service</b> owned by that team.</p><p>I also ask what it costs: a pipeline, dashboards, on-call, a contract to version, and network calls where there were method calls. If the feature later earns one of the reasons, a well-bounded module is easy to extract.</p>', lvl: 'core' },
      { q: 'Tell me about a time you changed a service boundary that was wrong.', a: '<p><em>Sample story with illustrative numbers. Swap in your own experience.</em><br><b>Situation</b>: pricing rules sat in a Catalog service owned by another team, but 7 of 10 checkout features needed a pricing change, so most of our work waited on their backlog. <b>Task</b>: reduce cross-team changes without a rewrite. <b>Action</b>: I pulled six months of tickets and git history to show the coupling, ran a two-hour event-storming session with both teams, and wrote an ADR proposing to move promotion and pricing rules into Ordering while Catalog kept list prices. We moved the code behind an interface first, then the tables with an expand-and-contract migration, then switched ownership. <b>Result</b>: cross-team tickets for checkout fell by about two thirds in the next quarter and both teams released more often.</p>', lvl: 'deep' }
    ],

    code: [
      {
        title: 'Python: change coupling between modules from git history', lang: 'python',
        code: `# Python 3.11+. Which top-level modules change in the same commit?
# Same idea as Code Maat's coupling analysis: degree = shared / average revisions.
import subprocess
from collections import Counter
from itertools import combinations

MAX_CHANGESET = 30      # ignore huge commits (renames, formatting)
MIN_SHARED = 5          # report a pair only above this many shared commits

log = subprocess.run(
    ["git", "log", "--since=12 months ago", "--no-merges",
     "--name-only", "--pretty=format:@@%h"],
    capture_output=True, text=True, check=True).stdout

revs, shared = Counter(), Counter()
for commit in log.split("@@")[1:]:
    files = [f for f in commit.splitlines()[1:] if f.strip()]
    if not files or len(files) > MAX_CHANGESET:
        continue
    # module = first two path parts, e.g. "services/ordering"
    modules = sorted({"/".join(f.split("/")[:2]) for f in files})
    revs.update(modules)
    shared.update(combinations(modules, 2))

rows = []
for (a, b), n in shared.items():
    if n >= MIN_SHARED:
        degree = 100 * n / ((revs[a] + revs[b]) / 2)
        rows.append((degree, n, a, b))

print("degree%  shared  pair")
for degree, n, a, b in sorted(rows, reverse=True)[:20]:
    print(f"{degree:6.0f}  {n:6d}  {a}  <->  {b}")`,
        note: 'In a monorepo this works as written. With one repo per service, group commits by ticket id instead of by commit hash. A high degree between two services is a question to ask, not a verdict: check whether the reason is a real business link or misplaced code.'
      },
      {
        title: 'Java (ArchUnit): keep contexts free of cycles and out of each other\'s internals', lang: 'java',
        code: `// com.tngtech.archunit:archunit-junit5 1.3+, Java 21. Works in any JVM build.
// Layout: com.shop.<context>.api (public)  and  com.shop.<context>.internal
@AnalyzeClasses(packages = "com.shop",
                importOptions = ImportOption.DoNotIncludeTests.class)
class BoundaryRulesTest {

  // 1. No cycles between contexts: ordering -> catalog -> ordering is a bug.
  @ArchTest
  static final ArchRule contexts_are_acyclic =
      SlicesRuleDefinition.slices()
          .matching("com.shop.(*)..")
          .should().beFreeOfCycles();

  // 2. A context's internals are private to it.
  @ArchTest
  static final ArchRule internals_stay_private =
      SlicesRuleDefinition.slices()
          .matching("com.shop.(*).internal..")
          .should().notDependOnEachOther();

  // 3. Only Payments may talk to the payment provider's SDK.
  @ArchTest
  static final ArchRule only_payments_uses_psp =
      ArchRuleDefinition.noClasses()
          .that().resideOutsideOfPackage("com.shop.payments..")
          .should().dependOnClassesThat()
          .resideInAPackage("com.psp.sdk..");

  // 4. Fulfilment listens to events; it never calls Ordering directly.
  @ArchTest
  static final ArchRule fulfilment_does_not_call_ordering =
      ArchRuleDefinition.noClasses()
          .that().resideInAPackage("com.shop.fulfilment..")
          .should().dependOnClassesThat()
          .resideInAPackage("com.shop.ordering.internal..");
}`,
        note: 'Rules like these turn a boundary from a diagram into a failing build. Other stacks have equivalents: <code>import-linter</code> for Python, <code>depguard</code> or internal packages for Go, <code>dependency-cruiser</code> for Node, Packwerk for Ruby.'
      },
      {
        title: 'YAML: service catalog entry with one owner and explicit dependencies', lang: 'yaml',
        code: `# catalog-info.yaml in the service's repo (Backstage software catalog format)
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: ordering
  description: Cart, checkout and gift options. Capability "take orders".
  tags: [core-subdomain, tier-1]
  annotations:
    github.com/project-slug: shop/ordering
spec:
  type: service
  lifecycle: production
  owner: team-checkout          # exactly one owning team
  system: commerce              # the domain this service belongs to
  providesApis:
    - ordering-http-v1
    - order-events-v1
  consumesApis:
    - payments-grpc-v1
  dependsOn:
    - resource:orders-postgres  # private: no other component lists it
---
apiVersion: backstage.io/v1alpha1
kind: API
metadata:
  name: order-events-v1
spec:
  type: asyncapi
  lifecycle: production
  owner: team-checkout
  system: commerce
  definition:
    $text: ./asyncapi.yaml`,
        note: 'With every service described this way you can query the catalog: services without an owner, databases used by more than one component, teams that own too many services. The format is Backstage\'s; any catalog with owner, system and dependencies does the job.'
      }
    ],

    related: ['ddd', 'conways-law', 'ms-monolith-vs-microservices', 'ms-communication', 'ms-data', 'ms-antipatterns-migration', 'sd:ecommerce-orders']
  });
})();

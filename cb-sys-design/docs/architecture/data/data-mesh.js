(function () {
  // Central-team queue vs domain ownership. Pooled single-queue approximation (M/M/1 with rate E*c).
  const CONS = 4; // consumers per data product (estimate)
  function q(v) {
    const lam = v.domains * v.req, mu = v.eng * v.rate, rho = lam / mu;
    return { lam, mu, rho, waitDays: rho < 1 ? (rho / (mu * (1 - rho))) * 30 : Infinity, growth: lam - mu };
  }
  const n0 = (x) => Math.round(x).toLocaleString('en-US');

  SD.register({
    slug: 'data-mesh',
    domain: 4,
    title: 'Data Mesh & Data Contracts',
    examples: 'Zhamak Dehghani, Netflix, PayPal',
    tagline: 'Move ownership of analytical data from one central team to <b>the teams that produce it</b>. Each team publishes <b>data products</b> with a written, tested <b>data contract</b>, on a shared self-serve platform, under rules that are agreed centrally and <b>enforced by code</b>.',
    tldr: {
      problem: 'A central data team sits between every producer and every consumer. It does not know the business meaning of the data it moves, it finds out about schema changes when dashboards break, and its backlog grows with every new domain.',
      idea: 'Zhamak Dehghani\'s <b>data mesh</b> (2019): treat analytical data like microservices treat APIs. The <b>domain team</b> that creates the data owns it and serves it as a <b>product</b>; a <b>platform</b> makes that cheap; <b>federated governance</b> keeps products interoperable. A <b>data contract</b> is the product\'s API: schema, meaning, quality and service levels, checked automatically.',
      insight: 'Data mesh is an <b>operating model</b>, not a tool you install. It only pays off when there are many domains, and it fails without two things teams tend to skip: a real <b>platform</b> and <b>enforced contracts</b>. A central team with good contracts beats a mesh without them.',
      numbers: [
        { v: '4 principles', l: 'domain ownership, data as a product, self-serve platform, federated computational governance (Dehghani, 2020)' },
        { v: '2019', l: 'first article, May 2019; principles article Dec 2020; O\'Reilly book 2022' },
        { v: 'ODCS v3', l: 'Open Data Contract Standard: a YAML contract format at the Linux Foundation, forked from PayPal\'s template' }
      ]
    },

    intro: {
      what: 'A <b>data mesh</b> is a way to organise who owns <b>analytical data</b>: the data used for reports, dashboards and machine learning, as opposed to the data an application needs to run. Instead of one central team collecting everything, each business team publishes its own data as a <b>data product</b> that others can find and use. A <b>data contract</b> is the written promise that comes with the product: what the columns are, what they mean, how fresh and how complete the data is.',
      analogy: {
        icon: '🥫',
        title: 'Food with a label, sold through one supermarket',
        text: 'Each producer makes its own food and prints a label: ingredients, weight, best-before date. The supermarket provides shelves, barcodes and checkouts for everyone, and food law is the same for all producers. Shoppers trust the label without visiting the factory. Producers are the domain teams, the label is the data contract, the supermarket is the platform and food law is governance. Unlike a label, a data contract is <b>tested by a machine</b> on every delivery.'
      },
      problem: 'The orders team renames a column on Tuesday. On Wednesday the finance dashboard shows zero revenue. The central data team that maintains the pipeline spends two days finding out why, because it did not write the orders service and was never told. The same team has forty other requests waiting. The question this page answers is <b>who should own analytical data, and how do consumers know they can rely on it?</b>',
      story: [
        {
          stage: 'naive',
          title: 'One central team, one big lake',
          text: 'Every service\'s data is copied into one lake or warehouse. A central data team builds all pipelines and serves all reports. One place, one set of tools, one team to ask.',
          scene: {
            nodes: [
              { id: 'o', label: 'Orders team', sub: 'app database', kind: 'team', at: [70, 0] },
              { id: 'p', label: 'Payments team', sub: 'app database', kind: 'team', at: [350, 0] },
              { id: 'c', label: 'Central data team', sub: 'all pipelines', kind: 'team', at: [210, 110] },
              { id: 'u', label: 'Analysts', sub: 'reports · models', kind: 'client', at: [210, 220] }
            ],
            edges: [{ from: 'o', to: 'c' }, { from: 'p', to: 'c' }, { from: 'c', to: 'u' }],
            flow: [['o>c', 'p>c'], 'c>u'],
            badges: { c: ['one lake', 'info'] }
          }
        },
        {
          stage: 'breaks',
          title: 'A bottleneck that does not know the data',
          text: 'As domains multiply, requests queue up at the central team. It moves data it does not understand, so quality problems are found late. Producers change schemas without warning because nobody consuming the data is <b>their</b> customer.',
          scene: {
            nodes: [
              { id: 'o', label: 'Orders team', sub: 'renamed a column', kind: 'team', at: [70, 0] },
              { id: 'p', label: 'Payments team', sub: 'app database', kind: 'team', at: [350, 0] },
              { id: 'c', label: 'Central data team', sub: 'backlog: months', kind: 'team', at: [210, 110] },
              { id: 'u', label: 'Analysts', sub: 'dashboard shows 0', kind: 'client', at: [210, 220] }
            ],
            edges: [{ from: 'o', to: 'c' }, { from: 'p', to: 'c' }, { from: 'c', to: 'u' }],
            flow: ['o>c', 'c>u'],
            err: ['c', 'u'], warn: ['o'],
            badges: { c: ['overloaded', 'err'], u: ['broken', 'err'] }
          }
        },
        {
          stage: 'fix',
          title: 'Producers own data products with contracts',
          text: 'Each domain team publishes its data as a product with a <b>contract</b>, using a shared <b>platform</b>. A rename that breaks the contract fails in the producer\'s own build, before anyone downstream notices. The central team builds the platform, not the pipelines.',
          scene: {
            nodes: [
              { id: 'o', label: 'Orders product', sub: 'owned by Orders', kind: 'compute', at: [70, 0] },
              { id: 'p', label: 'Payments product', sub: 'owned by Payments', kind: 'compute', at: [350, 0] },
              { id: 'c', label: 'Platform', sub: 'self-serve + checks', kind: 'compute', at: [210, 110] },
              { id: 'u', label: 'Analysts', sub: 'find · trust · use', kind: 'client', at: [210, 220] }
            ],
            edges: [{ from: 'o', to: 'c', dashed: true }, { from: 'p', to: 'c', dashed: true }, { from: 'o', to: 'u' }, { from: 'p', to: 'u' }],
            flow: ['o>c', ['o>u', 'p>u']],
            ok: ['o', 'p', 'u'],
            badges: { o: ['contract v1 ✓', 'ok'], c: ['no pipelines', 'info'] }
          }
        }
      ],
      usedBy: ['JPMorgan Chase', 'PayPal', 'Zalando', 'Intuit', 'GoCardless (data contracts)', 'dbt (model contracts)'],
      whenToUse: [
        '<b>Many domains</b> produce analytical data and a central team has become the bottleneck',
        'Domain teams have, or can get, <b>engineers able to own data</b>, and a platform team exists',
        'Consumers need <b>guarantees</b> (schema, freshness, quality) from data they did not create'
      ],
      whenNot: [
        'A small organisation with a few domains: one data team with a warehouse is faster and cheaper (see <a href="data-architecture.html">data architecture</a>)',
        'You have no platform: asking every team to build its own pipelines multiplies cost and creates silos',
        'You want a product to buy: data mesh is an operating model; the storage underneath can stay a <a href="../../system-design/systems/data-lake.html">lakehouse</a>'
      ],
      glossary: [
        { term: 'Analytical data', def: 'Historical, aggregated data used for reporting, analysis and machine learning, as opposed to the operational data an application reads and writes to do its job.' },
        { term: 'Data product', def: 'A dataset served by its owning team with code, metadata, documentation and guarantees, so others can use it without asking.' },
        { term: 'Output port', def: 'An interface through which a data product is read, such as a table, a view, a topic or a file set.' },
        { term: 'Data contract', def: 'A machine-readable agreement between a data producer and its consumers covering schema, meaning, quality rules, service levels and terms of use.' },
        { term: 'Self-serve data platform', def: 'Shared tooling that lets a domain team build, deploy, document and monitor a data product without specialist help.' },
        { term: 'Federated computational governance', def: 'Rules agreed by domain and platform representatives and enforced automatically by the platform.' },
        { term: 'Source-aligned vs consumer-aligned product', def: 'A product that mirrors facts from one operational system, versus one that is shaped for a specific use such as revenue reporting.' },
        { term: 'Breaking change', def: 'A change to a data product that can make an existing consumer fail or silently compute wrong results.' }
      ]
    },

    requirements: {
      functional: [
        '<b>Domain ownership</b>: the team that produces the data owns its analytical form, including quality and on-call',
        '<b>Data as a product</b>: discoverable, addressable, understandable, trustworthy, natively accessible, interoperable, valuable on its own, secure',
        '<b>Self-serve platform</b>: storage, pipelines, catalog, access and monitoring as paved roads',
        '<b>Federated computational governance</b>: a few global rules, enforced by code on every product',
        '<b>Contract first</b>: every output port has a versioned, tested contract; no contract, no consumers',
        '<b>Explicit versioning</b>: breaking changes ship as a new version next to the old one, with a sunset date'
      ],
      nonFunctional: [
        'Time to publish a new data product: days, not months (<em>example target: under 1 week</em>)',
        'Contract compliance: 99% of scheduled checks pass per product per month (<em>example target</em>)',
        'Freshness service level per product, e.g. 95% of loads complete within 1 hour of the event',
        'Zero unannounced breaking changes; at least 90 days notice before a version is retired (<em>example policy</em>)',
        'Every product has a named owner, a description and classified columns: 100% catalog coverage',
        'Access granted by policy within minutes for standard purposes, not by ticket'
      ],
      outOfScope: [
        '<b>Mesh without a platform</b>: every domain builds its own stack',
        '<b>Renaming the lake</b>: the central team still owns everything, now called "data products"',
        '<b>Contract as a wiki page</b>: written once, never tested, drifts within weeks',
        '<b>Governance by committee</b>: a board approves each dataset by hand',
        '<b>Raw table dumps as products</b>: the operational schema exposed with no model, owner or guarantees'
      ]
    },

    calculator: {
      inputs: [
        { id: 'domains', label: 'Domains producing data', min: 2, max: 60, value: 12 },
        { id: 'req', label: 'New data requests per domain per month', min: 1, max: 20, value: 3 },
        { id: 'eng', label: 'Engineers in the central data team', min: 2, max: 60, value: 8 },
        { id: 'rate', label: 'Requests one engineer completes per month', min: 1, max: 12, value: 5 },
        { id: 'products', label: 'Data products (or shared datasets)', min: 5, max: 500, value: 60, log: true },
        { id: 'breaks', label: 'Breaking changes per product per year', min: 0, max: 12, value: 2 }
      ],
      outputs: [
        { label: 'Central team utilisation', fmt: 'raw', f: (v) => Math.round(q(v).rho * 100) + '%' },
        { label: 'Average wait for a request in the central queue', fmt: 'raw', f: (v) => { const x = q(v); return x.rho >= 1 ? 'never clears: backlog +' + n0(x.growth) + ' / month' : x.waitDays < 1 ? '< 1 day' : n0(x.waitDays) + ' days'; } },
        { label: 'Engineer capacity the same work needs inside domains', fmt: 'raw', f: (v) => (v.domains * v.req / v.rate).toFixed(1) + ' engineers' },
        { label: 'Producer → consumer dependencies to protect', fmt: 'raw', f: (v) => n0(v.products * CONS) },
        { label: 'Consumer breakages per year with no contracts', fmt: 'raw', f: (v) => n0(v.products * v.breaks * CONS) },
        { label: 'With enforced, versioned contracts', fmt: 'raw', f: (v) => n0(v.products * v.breaks) + ' planned migrations, 0 surprises' }
      ],
      note: 'The queue uses a pooled single-server approximation (wait = ρ ÷ (μ·(1 − ρ))); real queues with priorities behave worse. Watch how the wait explodes as utilisation passes about 85%: this is why a central team that "almost keeps up" still feels slow. The third row shows that <b>the work does not disappear in a mesh</b>; it moves to people who know the data. Four consumers per product is an <em>estimate</em>. The last two rows assume every breaking change reaches every consumer without a contract, and is caught in the producer\'s build with one.'
    },

    api: [
      { m: 'YAML', p: 'orders.odcs.yaml (data contract)', d: 'Open Data Contract Standard file: identity and <b>version</b>, owner team, <b>schema</b> with types and meaning per column, <b>quality rules</b>, <b>service levels</b> (freshness, retention, availability), classification, support channel, terms of use.' },
      { m: 'DOC', p: 'Data product specification', d: 'One page per product: purpose and intended users, owner, input ports (sources), <b>output ports</b>, the contract for each port, lifecycle state, cost centre.' },
      { m: 'POLICY', p: 'Global governance policies (as code)', d: 'The short list every product must meet: shared identifiers (customer id format), PII tagging, naming, retention, mandatory metadata. Evaluated by the platform at deploy time.' },
      { m: 'SLO', p: 'Data product service levels', d: 'Freshness, completeness, validity and availability targets with an error budget, measured on the output port, visible in the catalog.' },
      { m: 'SQL', p: 'Output port: orders_dp.orders_v1 (table or view)', d: 'A stable, versioned read interface, separate from internal tables. Consumers get <code>SELECT</code> on the port only; internals can change freely.' },
      { m: 'ADR', p: 'ADR-052: Breaking changes ship as a new port version', d: 'What counts as breaking, the minimum deprecation notice, who must approve, and how consumers are found and notified.' }
    ],
    dataModel: [
      { name: 'data_product', store: 'Catalog (platform)', fields: [['id', 'text', 'pk'], ['domain', 'text', 'idx'], ['owner_team', 'text'], ['kind', 'source-aligned|aggregate|consumer-aligned'], ['status', 'draft|active|deprecated|retired'], ['description', 'text']], note: 'The registry consumers search. A product without an owner or description cannot be set to <code>active</code>.' },
      { name: 'data_contract', store: 'Git (source of truth) + catalog', fields: [['product_id', 'text', 'pk'], ['version', 'semver', 'pk'], ['port', 'text'], ['schema', 'jsonb'], ['quality_rules', 'jsonb'], ['sla', 'jsonb'], ['sunset_at', 'date']], note: 'Immutable per version. Major version = breaking change = a new output port published next to the old one.' },
      { name: 'contract_check', store: 'Platform monitoring', fields: [['product_id', 'text', 'pk'], ['version', 'semver', 'pk'], ['run_at', 'timestamptz', 'pk'], ['rule', 'text', 'pk'], ['passed', 'boolean', 'idx'], ['observed', 'text']], note: 'One row per rule per run. Feeds the compliance SLO and the "trust" badge consumers see.' },
      { name: 'subscription', store: 'Catalog (platform)', fields: [['product_id', 'text', 'pk'], ['consumer', 'text', 'pk'], ['version', 'semver'], ['purpose', 'text'], ['granted_at', 'timestamptz']], note: 'Who reads which version and why. This is how a producer finds everyone affected by a planned change.' }
    ],

    architecture: {
      title: 'Domain-owned data products on a shared platform',
      nodes: [
        { id: 'opso', label: 'Orders service', sub: 'operational DB', kind: 'service', wide: [90, 40], tall: [105, 0], tip: 'The operational system. Its schema is private and may change any day.' },
        { id: 'opsp', label: 'Payments service', sub: 'operational DB', kind: 'service', wide: [90, 200], tall: [315, 0], tip: 'Another domain\'s operational system, owned by the Payments team.' },
        { id: 'dpo', label: 'Orders product', sub: 'owner: Orders team', kind: 'compute', wide: [290, 40], tall: [105, 105], tip: 'Source-aligned data product: code, data, metadata and infrastructure deployed as one unit. Exposes a versioned output port with a contract.' },
        { id: 'dpp', label: 'Payments product', sub: 'owner: Payments team', kind: 'compute', wide: [290, 200], tall: [315, 105], tip: 'Source-aligned product for payment facts. Same platform, same global rules, different owner.' },
        { id: 'rev', label: 'Revenue product', sub: 'consumer-aligned', kind: 'compute', wide: [500, 120], tall: [210, 210], tip: 'Joins orders and payments into the shape finance needs. It consumes two contracts and publishes its own.' },
        { id: 'bi', label: 'Analysts / BI', sub: 'dashboards', kind: 'client', wide: [710, 40], tall: [105, 315], tip: 'Read output ports directly. They rely on the contract, not on knowing the producer.' },
        { id: 'ml', label: 'ML / AI agents', sub: 'features · retrieval', kind: 'ml', wide: [710, 200], tall: [315, 315], tip: 'Models and agents need the same guarantees a dashboard does, plus clear classification of sensitive columns.' },
        { id: 'catalog', label: 'Catalog', sub: 'discover · subscribe', kind: 'store', wide: [900, 120], tall: [350, 210], tip: 'The marketplace: search products, read contracts and compliance history, request access. Records who consumes what.' },
        { id: 'checks', label: 'Contract checks', sub: 'CI gate + monitors', kind: 'policy', wide: [290, 340], tall: [70, 420], tip: 'Compares each change with the published contract in the producer\'s pipeline, and tests the live data against the contract on a schedule.' },
        { id: 'platform', label: 'Self-serve platform', sub: 'storage · pipelines · IAM', kind: 'compute', wide: [500, 340], tall: [210, 420], tip: 'Paved roads built by the platform team: templates, storage, orchestration, access control, lineage and monitoring.' },
        { id: 'gov', label: 'Federated governance', sub: 'global rules as code', kind: 'policy', wide: [710, 340], tall: [350, 420], tip: 'Domain and platform representatives agree a small set of global rules; the platform enforces them on every product.' }
      ],
      edges: [
        { from: 'opso', to: 'dpo' },
        { from: 'opsp', to: 'dpp' },
        { from: 'dpo', to: 'rev' },
        { from: 'dpp', to: 'rev' },
        { from: 'rev', to: 'bi' },
        { from: 'rev', to: 'ml' },
        { from: 'bi', to: 'catalog', dashed: true },
        { from: 'ml', to: 'catalog', dashed: true },
        { from: 'platform', to: 'rev', dashed: true, bidi: true },
        { from: 'platform', to: 'checks' },
        { from: 'gov', to: 'platform' }
      ]
    },

    scenarios: [
      {
        id: 'publish', title: 'A domain publishes a data product', tone: 'ok',
        steps: [
          { text: 'The Orders team wants its order facts to be usable by others. It starts from a <b>platform template</b>: storage, a pipeline, a contract file and monitoring come pre-wired.', flow: ['platform>dpo'], nodes: ['dpo', 'platform'], badges: { platform: 'template', dpo: 'draft' } },
          { text: 'It models the <b>output port</b> for readers, not as a copy of its tables: stable names, business keys, one row per order. Internals stay private.', flow: ['opso>dpo'], ok: ['dpo'], badges: { dpo: 'orders_v1' } },
          { text: 'It writes the <b>contract</b>: column types and meaning, quality rules, freshness, owner and support channel. The file lives in the team\'s repository next to the code.', flow: ['platform>checks'], nodes: ['dpo'], badges: { checks: 'contract v1.0.0' } },
          { text: 'On deploy the platform runs the <b>global policies</b>: owner set, PII columns tagged, shared customer id format used. All pass.', flow: ['gov>platform', 'platform>checks'], ok: ['gov', 'checks'], badges: { checks: ['policies ✓', 'ok'] } },
          { text: 'The product appears in the <b>catalog</b> as active, with its contract and a live compliance history. Nobody from a central team wrote a pipeline.', flow: ['bi>catalog'], ok: ['catalog', 'dpo'], badges: { catalog: ['orders: active', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'consume', title: 'A consumer finds, trusts and subscribes', tone: 'info',
        steps: [
          { text: 'A finance analyst searches the catalog for revenue data and finds the <b>Revenue product</b>, built from the orders and payments products.', flow: ['bi>catalog'], badges: { catalog: 'search: revenue' } },
          { text: 'She reads the contract: what <code>net_amount</code> means, that data is at most 1 hour old, and that checks passed 99.6% last month. She does not need to message the producers.', nodes: ['catalog', 'rev'], ok: ['rev'], badges: { rev: ['99.6% compliant', 'ok'] } },
          { text: 'She requests access for the purpose "monthly reporting". A policy grants read on the output port automatically; the <b>subscription</b> is recorded.', flow: ['gov>platform', 'platform>rev'], ok: ['platform'], badges: { platform: ['granted by policy', 'ok'] } },
          { text: 'Her dashboard reads the port. From now on she is a <b>known consumer</b>: the Revenue team can see her when it plans a change.', flow: ['dpo>rev', 'rev>bi'], ok: ['bi'], tone: 'ok' }
        ]
      },
      {
        id: 'break', title: 'A breaking change is caught by the contract', tone: 'err',
        steps: [
          { text: 'A developer in the Orders team renames <code>total</code> to <code>amount</code> in the product\'s model and opens a pull request.', nodes: ['dpo'], warn: ['dpo'], badges: { dpo: 'total → amount' } },
          { text: 'Without a contract this deploys. The Revenue product\'s join fails that night, and finance sees zeros in the morning.', flow: ['dpo>rev', 'rev>bi'], err: ['rev', 'bi'], badges: { bi: ['revenue = 0', 'err'] }, tone: 'err' },
          { text: 'With a contract, the <b>CI gate</b> compares the change with contract v1: a removed column is <b>breaking</b>. The build fails and lists the subscribed consumers.', flow: ['platform>checks'], err: ['checks'], badges: { checks: ['breaking: blocked', 'err'] }, tone: 'warn' },
          { text: 'The team publishes <b>orders_v2</b> next to v1, with a sunset date for v1 in the catalog. Subscribers are notified automatically.', flow: ['opso>dpo'], ok: ['dpo', 'catalog'], badges: { dpo: 'v1 + v2', catalog: ['v1 sunset: 90 d', 'warn'] } },
          { text: 'Revenue moves to v2 in its own time. When the subscription list for v1 is empty, v1 is retired. <b>Nobody was surprised.</b>', flow: ['dpo>rev', 'rev>bi'], ok: ['rev', 'bi'], tone: 'ok' }
        ]
      },
      {
        id: 'fresh', title: 'Late data: a service level is missed', tone: 'warn',
        steps: [
          { text: 'A deploy of the Payments service stalls its change stream. The Payments product stops receiving new rows.', flow: ['opsp>dpp'], err: ['opsp'], warn: ['dpp'], badges: { dpp: ['no new data', 'warn'] } },
          { text: 'The scheduled <b>contract check</b> measures freshness on the output port: 3 hours old, contract says 1 hour. The check fails.', flow: ['platform>checks'], err: ['checks'], badges: { checks: ['freshness 3 h > 1 h', 'err'] }, tone: 'err' },
          { text: 'The alert goes to the <b>Payments team</b>, the owner, not to a central data team that would have to guess. The catalog shows the product as degraded.', nodes: ['dpp', 'catalog'], warn: ['dpp', 'catalog'], badges: { catalog: ['payments: degraded', 'warn'] }, tone: 'warn' },
          { text: 'The Revenue product sees its input is stale and marks its own output as <b>stale</b> instead of publishing wrong totals. Dashboards show a banner.', flow: ['dpp>rev', 'rev>bi'], warn: ['rev', 'bi'], badges: { bi: ['data as of 09:00', 'warn'] } },
          { text: 'Payments fixes the stream, the backlog loads, checks turn green. The miss counts against the product\'s monthly <b>error budget</b>.', flow: ['opsp>dpp', 'dpp>rev'], ok: ['dpp', 'rev', 'checks'], tone: 'ok' }
        ]
      },
      {
        id: 'scale', title: 'At scale: 200 products, one set of rules', tone: 'warn',
        steps: [
          { text: 'Thirty domains now publish two hundred products. Three of them define "customer" with different keys, so their data cannot be joined.', flow: [['dpo>rev', 'dpp>rev']], err: ['rev'], badges: { rev: ['3 customer ids', 'err'] }, tone: 'err' },
          { text: 'This is the main risk of decentralising: <b>silos with new names</b>. A central board reviewing every product by hand would bring the bottleneck back.', nodes: ['gov'], warn: ['gov'], badges: { gov: ['review queue?', 'warn'] }, tone: 'warn' },
          { text: 'Instead the <b>governance group</b> (domain owners plus platform) agrees one global rule: every customer reference uses the shared <code>customer_id</code> type.', nodes: ['gov'], ok: ['gov'], badges: { gov: 'rule: shared customer_id' } },
          { text: 'The platform turns the rule into a <b>deploy-time check</b> on every contract. New products comply by default; existing ones get a deadline and a migration report.', flow: ['gov>platform', 'platform>checks'], ok: ['platform', 'checks'], badges: { checks: ['200 contracts scanned', 'ok'] } },
          { text: 'Decisions are federated, <b>enforcement is automatic</b>. That is what "computational" means in the fourth principle.', flow: [['dpo>rev', 'dpp>rev'], ['rev>bi', 'rev>ml']], ok: ['rev'], tone: 'ok' }
        ]
      }
    ],

    knobs: {
      intro: 'Each control is a real organisational choice. Meter values are <em>illustrative</em> judgements, not measurements.',
      controls: [
        { id: 'own', label: 'Who owns analytical data', type: 'seg', value: 'mesh', options: [
          { v: 'central', l: 'Central data team' }, { v: 'hub', l: 'Hub and spoke' }, { v: 'mesh', l: 'Domain teams (mesh)' }] },
        { id: 'plat', label: 'Platform', type: 'seg', value: 'shared', options: [
          { v: 'none', l: 'Each team builds its own' }, { v: 'shared', l: 'Shared self-serve' }] },
        { id: 'contract', label: 'Data contracts', type: 'seg', value: 'enforced', options: [
          { v: 'none', l: 'None' }, { v: 'doc', l: 'Documented only' }, { v: 'enforced', l: 'Enforced in CI + monitored' }] },
        { id: 'gov', label: 'Governance', type: 'seg', value: 'fed', options: [
          { v: 'none', l: 'None' }, { v: 'board', l: 'Central review board' }, { v: 'fed', l: 'Federated, automated' }] },
        { id: 'domains', label: 'Domains producing data', type: 'range', min: 2, max: 40, step: 1, value: 12 }
      ],
      evaluate(s) {
        const clamp = (x) => Math.max(0.03, Math.min(0.97, x));
        const O = s.own, shared = s.plat === 'shared', K = s.contract, G = s.gov, D = s.domains;
        const mesh = O === 'mesh', central = O === 'central';
        const time = (central ? 0.8 - 0.02 * D : O === 'hub' ? 0.75 - 0.011 * D : shared ? 0.82 : 0.42) - (G === 'board' ? 0.15 : 0) - (!mesh && !shared ? 0.08 : 0);
        const trust = (central ? 0.5 : O === 'hub' ? 0.58 : 0.66) + { none: -0.22, doc: 0, enforced: 0.26 }[K] + (G === 'none' ? -0.05 : 0);
        const bott = (central ? 0.92 - 0.022 * D : O === 'hub' ? 0.85 - 0.012 * D : 0.9) - (G === 'board' ? 0.2 : 0);
        const inter = (central ? 0.82 : O === 'hub' ? 0.72 : 0.5) + { none: mesh ? -0.32 : -0.12, board: 0.08, fed: mesh ? 0.3 : 0.1 }[G] + (K === 'enforced' ? 0.05 : 0);
        const cost = (central ? 0.8 : O === 'hub' ? 0.7 : 0.62) - (shared ? 0 : mesh ? 0.38 : 0.12) - (mesh && D < 5 ? 0.15 : 0);
        const load = (central ? 0.9 : O === 'hub' ? 0.7 : shared ? 0.52 : 0.15) - (K === 'enforced' ? 0.05 : 0);
        const metrics = [
          { k: 'Time to a new dataset', v: time >= 0.7 ? 'days' : time >= 0.45 ? 'weeks' : 'months', s: clamp(time) },
          { k: 'Trust in the data', v: trust >= 0.75 ? 'guarantees tested on every run' : trust >= 0.5 ? 'depends on who you ask' : 'breaks without warning', s: clamp(trust) },
          { k: 'Central bottleneck', v: bott >= 0.75 ? 'none' : bott >= 0.5 ? 'noticeable queue' : 'everything waits on one team', s: clamp(bott) },
          { k: 'Interoperability', v: inter >= 0.75 ? 'products join cleanly' : inter >= 0.5 ? 'joins need mapping work' : 'silos: same word, different meaning', s: clamp(inter) },
          { k: 'Cost & duplication', v: cost >= 0.7 ? 'one stack, shared' : cost >= 0.45 ? 'some duplication' : 'a stack per domain', s: clamp(cost) },
          { k: 'Load on domain teams', v: load >= 0.75 ? 'light: they only produce' : load >= 0.45 ? 'real, but paved' : 'heavy: every team runs data infrastructure', s: clamp(load), hint: 'lower bar = heavier' }
        ];
        const notes = [];
        if (central) notes.push('A central team is the right model while it keeps up. Its utilisation rises with every domain; past roughly 85% the queue grows fast (see <b>Model it</b>).');
        if (O === 'hub') notes.push('Hub and spoke: a central platform and standards group, with data engineers embedded in or assigned to domains. A common, pragmatic step toward a mesh.');
        if (mesh && !shared) notes.push('Domain ownership without a self-serve platform asks every team to become a data-infrastructure team. This is the most reported way data mesh fails.');
        if (mesh && shared) notes.push('The platform team\'s customers are the domain teams. Measure it by how fast a team can publish a product without help.');
        if (K === 'none') notes.push('With no contract, the producer\'s internal schema <b>is</b> the interface. Any refactor is a breaking change somebody finds in production.');
        if (K === 'doc') notes.push('A documented but untested contract drifts. It helps people understand data; it does not stop a breaking deploy.');
        if (K === 'enforced') notes.push('Enforcement has two halves: a <b>CI gate</b> that diffs the change against the contract, and <b>runtime checks</b> on the live data for quality and freshness.');
        if (G === 'board') notes.push('A manual review board gives consistency and brings back the queue. Keep people for deciding rules, and automate the checking.');
        if (G === 'none' && mesh) notes.push('No shared identifiers, no classification, no naming rules: products cannot be combined. Decentralised ownership needs centralised agreement on a few things.');
        let verdict;
        if (mesh && !shared) verdict = '❌ <b>Mesh without a platform.</b> Every domain reinvents storage, pipelines and access. Build the paved road first.';
        else if (mesh && G === 'none') verdict = '❌ <b>Silos with new names.</b> Domain ownership without global rules gives you data that cannot be joined.';
        else if (mesh && D < 5) verdict = '⚠ <b>Too small for a mesh.</b> With ' + D + ' domains, one data team plus contracts is simpler and cheaper.';
        else if (K === 'none') verdict = '⚠ <b>No contracts:</b> whoever owns the data, consumers find out about changes when something breaks.';
        else if (central && D >= 15) verdict = '⚠ <b>The central team is the bottleneck.</b> At ' + D + ' domains, move ownership toward the producers, starting with the busiest ones.';
        else if (mesh && G === 'board') verdict = '⚠ <b>Decentralised build, centralised approval.</b> The review board is the new queue; turn its rules into automated checks.';
        else if (mesh && K === 'enforced' && G === 'fed') verdict = '✅ <b>The intended mesh:</b> domains own products, a platform makes it cheap, contracts are tested, global rules are code.';
        else if (central && K === 'enforced') verdict = '✅ <b>Right-sized.</b> A central team with enforced contracts is a sound design at this scale. Revisit when the queue grows.';
        else if (O === 'hub') verdict = '👍 <b>Pragmatic middle.</b> Central platform and standards, domain-side engineers. Tighten contracts and it scales a long way.';
        else verdict = '👍 <b>Workable.</b> Look at the weakest meter; that is where consumers will complain first.';
        const hide = [];
        if (!shared) hide.push('platform');
        if (K === 'none') hide.push('checks');
        if (G === 'none') hide.push('gov');
        const who = central ? 'owner: data team' : O === 'hub' ? 'owner: shared' : null;
        const labels = {
          dpo: { label: central ? 'Orders pipeline' : 'Orders product', sub: who || 'owner: Orders team' },
          dpp: { label: central ? 'Payments pipeline' : 'Payments product', sub: who || 'owner: Payments team' },
          rev: { label: central ? 'Warehouse marts' : 'Revenue product', sub: central ? 'central data team' : 'consumer-aligned' },
          checks: { label: 'Contract checks', sub: K === 'doc' ? 'wiki page, not tested' : 'CI gate + monitors' },
          gov: { label: G === 'board' ? 'Review board' : 'Federated governance', sub: G === 'board' ? 'manual approval' : 'global rules as code' }
        };
        const badges = {};
        if (central && D >= 15) badges.rev = ['backlog', 'err'];
        if (K === 'none') badges.bi = ['breaks silently', 'err'];
        if (K === 'enforced') badges.checks = ['blocks breaking PRs', 'ok'];
        if (mesh && !shared) badges.dpo = ['own stack', 'err'];
        if (G === 'board') badges.gov = ['queue', 'warn'];
        const flow = [['opso>dpo', 'opsp>dpp'], ['dpo>rev', 'dpp>rev'], ['rev>bi', 'rev>ml']];
        if (shared && K !== 'none') flow.push('platform>checks');
        return {
          metrics, verdict, notes: notes.slice(0, 4), labels, hide, flow, badges,
          err: (mesh && !shared ? ['dpo', 'dpp'] : []).concat(K === 'none' ? ['bi'] : []),
          warn: (G === 'board' ? ['gov'] : []).concat(K === 'doc' ? ['checks'] : []),
          ok: K === 'enforced' ? ['checks'] : [],
          hot: central ? ['rev'] : []
        };
      }
    },

    widget: {
      title: 'Contract diff: is this change breaking, and for whom?',
      caption: 'A data product with three subscribed consumers. Toggle <b>changes</b> to its output port. The widget diffs the new schema and service level against contract v1, classifies each change, finds the consumers that read the affected fields, and shows what happens with <b>no contract</b>, with a <b>CI gate</b>, or when you publish <b>v2 side by side</b>.'
    },

    realWorld: {
      intro: 'The term is recent and has one clear author. Data contracts grew up separately, out of data-quality work, and are now the most widely adopted piece.',
      timeline: [
        { when: 'May 2019', who: 'Zhamak Dehghani (Thoughtworks)', title: 'From a monolithic data lake to a distributed data mesh', text: 'The first article. It argues that centralised, monolithic, domain-agnostic data platforms run by specialised teams do not scale with the organisation, and proposes domains as the first-class concern, platform thinking and <b>data as a product</b>.', src: 0 },
        { when: 'Dec 2020', who: 'Zhamak Dehghani', title: 'The four principles', text: 'The follow-up names them: <b>domain-oriented decentralized data ownership and architecture</b>, <b>data as a product</b>, <b>self-serve data infrastructure as a platform</b>, and <b>federated computational governance</b>. It also describes a data product\'s input, output and control ports.', src: 1 },
        { when: '2021', who: 'JPMorgan Chase', title: 'A lake per data product', text: 'Writing on the AWS Big Data Blog, JPMorgan Chase described product-specific data lakes owned by teams who understand the data, a <b>mesh catalog</b> for discovery, and consumers reading data <b>in place</b> rather than copying it, which gives visibility into where data is used.', src: 2 },
        { when: 'Dec 2021', who: 'GoCardless', title: 'Data contracts in production', text: 'Andrew Jones wrote about GoCardless\'s early work on <b>data contracts</b>: an explicit interface for data, owned by the team that generates it, as a way to improve data quality. He noted it was still early days, and later wrote a book on the practice.', src: 3 },
        { when: '2022', who: 'Zhamak Dehghani', title: 'The book', text: '<i>Data Mesh: Delivering Data-Driven Value at Scale</i> (O\'Reilly) defines data mesh as "a decentralized sociotechnical approach to share, access, and manage analytical data in complex and large-scale environments". The word <b>sociotechnical</b> is deliberate: it is about people and architecture together.', src: 4 },
        { when: 'Aug 2022', who: 'Netflix', title: 'A different "Data Mesh"', text: 'Netflix uses the name for a <b>data movement and processing platform</b>: connectors publish change events to Kafka and Flink jobs process them. It began as change data capture and became general purpose. It is infrastructure, not Dehghani\'s organisational model; do not mix the two up in an interview.', src: 5 },
        { when: '2023', who: 'PayPal → Bitol', title: 'From a company template to an open standard', text: 'PayPal open-sourced the YAML <b>data contract template</b> it uses in its data mesh in spring 2023. In November 2023 the Bitol project at the Linux Foundation released it as the <b>Open Data Contract Standard</b>. Version 3.0 followed in October 2024; later 3.x releases exist.', src: 6 },
        { when: 'Docs', who: 'dbt', title: 'Model contracts in the build', text: 'With <code>contract: enforced: true</code>, dbt requires every column\'s name and data type in YAML and <b>fails the build before materialising the table</b> if the model\'s output does not match. Contracts check shape; data tests check content afterwards.', src: 8 },
        { when: 'Nov 2026', who: 'martinfowler.com', title: 'Data Contracts', text: 'A recent long-form article describes data contracts as a way to <b>describe the contents and guarantees of datasets</b>, and uses the Open Data Contract Standard, now a graduated Linux Foundation project, for its examples.', src: 9 }
      ],
      lessons: [
        'Data mesh is an <b>operating model</b>; nobody sells it in a box.',
        'Without a <b>self-serve platform</b>, domain ownership is just more work for every team.',
        'A contract that is not <b>tested in CI and at run time</b> is documentation.',
        'Ship breaking changes as a <b>new version next to the old one</b>, with a date.',
        'Start with the few domains whose data is most used; a <b>central team with contracts</b> is fine for the rest.'
      ],
      sources: [
        { title: 'How to Move Beyond a Monolithic Data Lake to a Distributed Data Mesh', url: 'https://www.martinfowler.com/articles/data-monolith-to-mesh.html', pub: 'Zhamak Dehghani, martinfowler.com, May 2019' },
        { title: 'Data Mesh Principles and Logical Architecture', url: 'https://martinfowler.com/articles/data-mesh-principles.html', pub: 'Zhamak Dehghani, martinfowler.com, Dec 2020' },
        { title: 'How JPMorgan Chase built a data mesh architecture to drive significant value to enhance their enterprise data platform', url: 'https://aws.amazon.com/blogs/big-data/how-jpmorgan-chase-built-a-data-mesh-architecture-to-drive-significant-value-to-enhance-their-enterprise-data-platform', pub: 'AWS Big Data Blog, 2021' },
        { title: 'Improving Data Quality with Data Contracts', url: 'https://medium.com/gocardless-tech/improving-data-quality-with-data-contracts-238041e35698', pub: 'Andrew Jones, GoCardless Tech, Dec 2021' },
        { title: 'Data Mesh: Delivering Data-Driven Value at Scale, chapter 1', url: 'https://www.oreilly.com/library/view/data-mesh/9781492092384/ch01.html', pub: 'Zhamak Dehghani, O\'Reilly, 2022' },
        { title: 'Netflix Data Mesh: news coverage of the Netflix TechBlog post "Data Mesh: A Data Movement and Processing Platform"', url: 'https://www.infoq.com/news/2022/08/netflix-data-mesh/', pub: 'InfoQ, August 2022' },
        { title: 'paypal/data-contract-template', url: 'https://www.github.com/paypal/data-contract-template', pub: 'PayPal, GitHub, 2023' },
        { title: 'Open Data Contract Standard (ODCS)', url: 'https://github.com/bitol-io/open-data-contract-standard', pub: 'Bitol, Linux Foundation AI & Data' },
        { title: 'Model contracts', url: 'https://docs.getdbt.com/docs/mesh/govern/model-contracts', pub: 'dbt documentation' },
        { title: 'Data Contracts', url: 'https://martinfowler.com/articles/data-contracts.html', pub: 'martinfowler.com, November 2026' },
        { title: 'Data Contract CLI', url: 'https://pypi.org/project/datacontract-cli', pub: 'PyPI (open-source tool for linting and testing ODCS contracts)' },
        { title: 'The next generation of Data Platforms is the Data Mesh', url: 'https://developer.paypal.com/community/blog/the-next-generation-of-data-platforms-is-the-data-mesh', pub: 'PayPal Developer Community Blog' },
        { title: 'Bitol: ODCS and related standards', url: 'https://bitol.io/', pub: 'Bitol project, Linux Foundation' },
        { title: 'Implementing Data Contracts at GoCardless', url: 'https://medium.com/gocardless-tech/implementing-data-contracts-at-gocardless-3b5c49074d13', pub: 'Andrew Jones, GoCardless Tech' }
      ]
    },

    tradeoffs: {
      headers: ['Decision', 'Option A', 'Option B', 'Pick when…'],
      rows: [
        ['Ownership', '<b>Central data team</b>: one team builds every pipeline; consistent, cheap at small scale', '<b>Domain teams</b>: producers own data products; scales with the organisation', 'Central until it becomes the queue; domain ownership when many domains and a platform exist'],
        ['Architecture underneath', '<b>One lakehouse</b> with schemas per domain', '<b>Separate stores</b> per domain', 'One shared lakehouse is usual: the mesh is about ownership, not physical separation'],
        ['Contract enforcement', '<b>In the producer\'s CI</b>: block the change before it ships', '<b>At run time</b>: test the live data on a schedule', 'Both. CI catches schema and semantic changes; runtime catches freshness and quality drift'],
        ['Breaking change', '<b>In place</b> with an announcement', '<b>New version side by side</b> with a sunset date', 'Side by side whenever there is more than one consumer; in place only for unreleased products'],
        ['Governance', '<b>Central review board</b>: consistent, slow', '<b>Federated and automated</b>: fast, needs platform investment', 'Federated once global rules can be expressed as checks; a board for the few judgement calls'],
        ['Product shape', '<b>Source-aligned</b>: facts as the domain sees them', '<b>Consumer-aligned</b>: modelled for one use', 'Source-aligned first; add consumer-aligned products where many consumers repeat the same joins']
      ]
    },
    failures: [
      { f: 'Mesh without a platform', detect: 'Each domain hires data engineers and picks its own tools; cost per product rises; time to publish is months', fix: 'Fund a platform team first; measure time-to-first-product for a new team; provide templates.' },
      { f: 'Silos with new names', detect: 'The same entity has different keys per product; consumers keep private mapping tables', fix: 'A small set of global rules (shared identifiers, classification, naming) enforced at deploy time.' },
      { f: 'Contracts that are not enforced', detect: 'Contract files last edited months ago; incidents caused by "small" schema changes', fix: 'Contract diff as a required CI check; scheduled tests against live data; compliance shown in the catalog.' },
      { f: 'Operational schema exposed as the product', detect: 'Output port mirrors application tables; every service refactor is a breaking change', fix: 'Model a stable output port (view or table) separate from internals; contract on the port only.' },
      { f: 'Ownership in name only', detect: 'The product has an owner in the catalog but alerts go to the old central team', fix: 'Route freshness and quality alerts to the domain\'s on-call; include data products in team goals.' },
      { f: 'Product sprawl', detect: 'Hundreds of products with zero or one subscriber; duplicated "revenue" definitions', fix: 'Track usage per product; retire unused ones; require a named first consumer before publishing.' },
      { f: 'Governance as a gate', detect: 'Publishing waits weeks for a board; teams share data by side channels', fix: 'Automate the rules; reserve human review for new global policies and sensitive data.' }
    ],

    interview: [
      { q: 'What is data mesh? State the four principles.', a: '<p>Zhamak Dehghani, 2019, then at Thoughtworks. Her book defines it as "a <b>decentralized sociotechnical approach</b> to share, access, and manage analytical data in complex and large-scale environments". The four principles (December 2020 article):</p><ul><li><b>Domain-oriented decentralized data ownership and architecture</b></li><li><b>Data as a product</b></li><li><b>Self-serve data infrastructure as a platform</b></li><li><b>Federated computational governance</b></li></ul><p>Common misreadings: that it is a technology or a product, that it means one database per team, or that it removes central work. It moves ownership; it still needs a strong platform and shared rules.</p>', lvl: 'core' },
      { q: 'How is that different from a central data lake or warehouse team?', a: '<p>The <b>technology can be identical</b>: the same lakehouse and query engine (see <a href="data-architecture.html">data architecture</a>). What changes is ownership and interfaces.</p><ul><li>Central model: one team ingests everything and owns all pipelines. Consumers ask that team.</li><li>Mesh: the producing domain owns the analytical form of its data and serves it through a contract. The central group builds the platform and runs governance.</li></ul><p>The trade is a single queue for many owners. That helps only when the queue is the real problem and the domains can staff ownership.</p>', lvl: 'core' },
      { q: 'What makes a dataset a "data product"?', a: '<p>It is built for other people to use without asking the producer. Dehghani\'s usability attributes: <b>discoverable, addressable, understandable, trustworthy and truthful, natively accessible, interoperable and composable, valuable on its own, secure</b>.</p><p>Architecturally it is one deployable unit containing <b>code</b> (pipelines, policies), <b>data and metadata</b>, and the <b>infrastructure</b> it needs, with input ports, output ports and an owner who is on call for it. A table somebody copied into a shared schema is not a product.</p>', lvl: 'core' },
      { q: 'What goes into a data contract?', a: '<ul><li><b>Identity</b>: product, port, version, owner, status.</li><li><b>Schema</b>: fields, types, nullability, keys.</li><li><b>Semantics</b>: what each field means, units, allowed values, business rules.</li><li><b>Quality rules</b>: uniqueness, valid ranges, row-count expectations.</li><li><b>Service levels</b>: freshness, availability, retention.</li><li><b>Terms</b>: classification of sensitive fields, permitted purposes, support channel, sometimes price.</li></ul><p>The Open Data Contract Standard gives this a YAML shape. The point is that it is <b>machine-readable</b>, so it can be diffed and tested.</p>', fu: 'Where do you enforce it?', lvl: 'core' },
      { q: 'Where and how do you enforce a data contract?', a: '<p>Two places, because they catch different failures.</p><ul><li><b>Producer CI</b>: compare the proposed schema with the published contract. Removed or renamed fields, narrowed types and relaxed guarantees are breaking and fail the build. dbt model contracts and schema-registry compatibility checks work this way.</li><li><b>Run time</b>: scheduled checks on the live output port for quality rules and freshness, feeding an SLO and alerts to the owner.</li></ul><p>Optionally a third: reject non-conforming records at the write path. Enforcement belongs with the <b>producer</b>; a consumer-side check only tells you after the damage.</p>', lvl: 'deep' },
      { q: 'Which changes to a data product are breaking?', a: '<p>Anything that can make an existing reader fail or compute something different:</p><ul><li>Removing or renaming a field; changing its type incompatibly.</li><li>Making a required field nullable; widening the allowed values of an enum.</li><li>Changing <b>meaning</b> with the same name (gross to net, UTC to local time). The most dangerous, because nothing errors.</li><li>Weakening a service level: staler data, shorter retention.</li><li>Changing grain or keys (one row per order to one row per order line).</li></ul><p>Compatible: adding an optional field, tightening a guarantee. Breaking changes get a new major version published <b>next to</b> the old one with a sunset date.</p>', lvl: 'deep' },
      { q: 'What does "federated computational governance" mean in practice?', a: '<p><b>Federated</b>: decisions are made by a group of domain owners and platform people, not by a separate central authority. <b>Computational</b>: the decisions are implemented as automated checks and platform defaults, not as a review meeting.</p><p>Example: the group decides every customer reference uses one shared identifier and every personal-data column carries a classification tag. The platform checks both at deploy time on every contract. The group meets to change rules, not to approve products.</p>', lvl: 'core' },
      { q: 'When would you advise against a data mesh?', a: '<ul><li><b>Few domains</b> or a small company: the coordination overhead exceeds the queueing cost it removes.</li><li><b>No platform team</b> and no budget for one.</li><li><b>Domain teams without data skills</b> and no plan to add them.</li><li><b>Mostly cross-domain questions</b> with weak domain boundaries: you will spend your time on consumer-aligned products anyway.</li></ul><p>In those cases I recommend a central team, a lakehouse, and <b>data contracts with producers</b>. Contracts give most of the reliability benefit without the reorganisation.</p>', lvl: 'core' },
      { q: 'What does the self-serve platform have to provide?', a: '<p>Everything a domain team would otherwise build itself: storage and compute, pipeline orchestration, a <b>product template</b> with CI, a catalog with search and subscriptions, access control by policy, lineage, contract testing, monitoring and cost reporting.</p><p>It is run as a product whose users are the domain teams (see <a href="platform-engineering.html">platform engineering</a>). Useful measures: time for a new team to publish its first product, share of products created from the template, and how often teams need to open a ticket.</p>', lvl: 'deep' },
      { q: 'How do data mesh and domain-driven design relate?', a: '<p>Data mesh applies <a href="ddd.html">DDD</a>\'s <b>bounded contexts</b> to analytical data. A source-aligned product publishes facts in its context\'s own language; it does not pretend to be the enterprise-wide truth.</p><p>Where two contexts must be combined, a consumer-aligned product does the translation explicitly, much like an anti-corruption layer. Governance supplies the few shared concepts, such as identifiers, that make that join possible. If your service boundaries are wrong, your data product boundaries will be too.</p>', lvl: 'deep' },
      { q: 'How do data contracts matter for AI agents and RAG?', a: '<p>An agent or retrieval pipeline is one more consumer, and a less forgiving one: it will not notice that a column changed meaning. It needs the same guarantees a dashboard does, plus:</p><ul><li><b>Semantics</b> in the contract, because field descriptions become part of the model\'s context.</li><li><b>Classification</b> of sensitive fields, enforced before retrieval.</li><li><b>Freshness</b> as a visible property, so stale data can be labelled or refused.</li></ul><p>See <a href="ai-architecture.html">AI system architecture</a> for the retrieval side.</p>', lvl: 'deep' },
      { q: 'Tell me about a time you moved data ownership to producing teams.', a: '<p><em>Sample story with illustrative numbers. Swap in your own experience.</em><br><b>Situation</b>: a data team of eight served fourteen product teams; the request queue was about ten weeks and roughly one incident a week came from upstream schema changes. <b>Task</b>: reduce breakages and waiting time without a reorganisation nobody had approved. <b>Action</b>: started with contracts, not with ownership: picked the five most-used datasets, wrote contracts with the producing teams and added a contract diff to their CI. Built a product template on the existing lakehouse. Then offered two willing domains full ownership of their datasets, with the data team acting as platform and coach. Agreed three global rules in a monthly forum and automated them. <b>Result</b>: schema-change incidents on the contracted datasets stopped within a quarter, the two domains published new datasets in days, and the remaining domains stayed central by choice.</p>', lvl: 'core' }
    ],

    code: [
      {
        title: 'Open Data Contract Standard: contract for the orders output port', lang: 'yaml',
        code: `# contracts/orders-v1.odcs.yaml  (Open Data Contract Standard v3)
apiVersion: v3.1.0
kind: DataContract
id: 53581432-6c55-4ba2-a65f-72344a91553a
name: orders
version: 1.2.0            # semver: major = breaking, new output port
status: active
domain: orders
dataProduct: orders
description:
  purpose: One row per customer order, for reporting and modelling.
  limitations: Excludes test orders. Amounts are gross, in the order currency.
schema:
  - name: orders_v1
    physicalName: orders_v1
    physicalType: table
    properties:
      - { name: order_id,    logicalType: string, physicalType: uuid,        required: true, primaryKey: true }
      - { name: customer_id, logicalType: string, physicalType: uuid,        required: true, classification: internal }
      - { name: status,      logicalType: string, physicalType: text,        required: true }
      - { name: total,       logicalType: number, physicalType: numeric,     required: true, description: Gross amount }
      - { name: currency,    logicalType: string, physicalType: bpchar,      required: true }
      - { name: email,       logicalType: string, physicalType: text,        required: true, classification: restricted }
      - { name: placed_at,   logicalType: date,   physicalType: timestamptz, required: true }
    quality:
      - type: sql
        description: order_id is unique
        query: SELECT count(*) - count(DISTINCT order_id) FROM orders_dp.orders_v1
        mustBe: 0
      - type: sql
        description: no negative totals
        query: SELECT count(*) FROM orders_dp.orders_v1 WHERE total < 0
        mustBe: 0
slaProperties:
  - { property: latency,   value: 1, unit: h, element: orders_v1.placed_at }
  - { property: retention, value: 7, unit: y }
team:
  name: orders-team
support:
  - { channel: "#orders-data", url: https://chat.acme.example/orders-data }`,
        note: 'Field names follow ODCS v3; check the exact keys against the version you adopt, because the standard is still adding sections. The file lives in the producer\'s repository. Tools such as the open-source Data Contract CLI can lint it and run the quality rules against the live data.'
      },
      {
        title: 'Spring Boot test: the output port must match the contract', lang: 'java',
        code: `// Runs in the Orders team's build. Spring Boot 3.3+, Java 21, Postgres 15+, SnakeYAML (bundled).
@SpringBootTest
class OrdersOutputPortContractTest {
  @Autowired JdbcClient jdbc;

  @Test
  @SuppressWarnings("unchecked")
  void outputPortMatchesContract() throws IOException {
    Map<String, Object> contract;
    try (var in = new ClassPathResource("contracts/orders-v1.odcs.yaml").getInputStream()) {
      contract = new Yaml().load(in);
    }
    var table = ((List<Map<String, Object>>) contract.get("schema")).get(0);
    Map<String, String> promised = new LinkedHashMap<>();   // column -> type[!]
    for (var p : (List<Map<String, Object>>) table.get("properties")) {
      boolean required = Boolean.TRUE.equals(p.get("required"));
      promised.put((String) p.get("name"), p.get("physicalType") + (required ? "!" : ""));
    }

    Map<String, String> actual = new LinkedHashMap<>();
    jdbc.sql("""
        SELECT a.attname, t.typname, a.attnotnull
        FROM pg_attribute a JOIN pg_type t ON t.oid = a.atttypid
        WHERE a.attrelid = to_regclass(:rel) AND a.attnum > 0 AND NOT a.attisdropped""")
        .param("rel", "orders_dp." + table.get("physicalName"))
        .query(rs -> {
          actual.put(rs.getString(1), rs.getString(2) + (rs.getBoolean(3) ? "!" : ""));
        });

    // Every promised column must exist with the promised type and nullability.
    // Extra columns are fine: adding an optional column is not a breaking change.
    assertThat(actual).containsAllEntriesOf(promised);
  }
}`,
        note: 'The port here is a table the product\'s pipeline writes. Postgres reports view and materialised-view columns as nullable, so for a view compare types only. This test checks the <b>shape</b>; the contract\'s quality rules and freshness are checked against production data on a schedule.'
      },
      {
        title: 'Python: contract diff for CI (breaking or compatible?)', lang: 'python',
        code: `# ci/contract_diff.py  old.yaml new.yaml   (Python 3.11+, PyYAML)
import sys
import yaml

WIDENING = {("int4", "int8"), ("float4", "float8"), ("varchar", "text")}
UNIT_HOURS = {"h": 1, "d": 24, "y": 24 * 365}

def load(path: str) -> tuple[dict, dict, str]:
    doc = yaml.safe_load(open(path, encoding="utf-8"))
    fields = {p["name"]: p for p in doc["schema"][0]["properties"]}
    sla = {s["property"]: s["value"] * UNIT_HOURS[s["unit"]] for s in doc.get("slaProperties", [])}
    return fields, sla, doc["version"]

def diff(old_path: str, new_path: str) -> tuple[list[str], list[str]]:
    old, old_sla, _ = load(old_path)
    new, new_sla, _ = load(new_path)
    breaking, compatible = [], []
    for name, o in old.items():
        n = new.get(name)
        if n is None:
            breaking.append(f"{name}: removed or renamed")
            continue
        types = (o["physicalType"], n["physicalType"])
        if types[0] != types[1]:
            (compatible if types in WIDENING else breaking).append(f"{name}: type {types[0]} -> {types[1]}")
        if o.get("required") and not n.get("required"):
            breaking.append(f"{name}: was required, now nullable")
    for name, n in new.items():
        if name not in old:
            compatible.append(f"{name}: added")
    if new_sla.get("latency", 0) > old_sla.get("latency", float("inf")):
        breaking.append("freshness guarantee weakened")
    if new_sla.get("retention", float("inf")) < old_sla.get("retention", 0):
        breaking.append("retention shortened")
    return breaking, compatible

if __name__ == "__main__":
    breaking, compatible = diff(sys.argv[1], sys.argv[2])
    old_major = load(sys.argv[1])[2].split(".")[0]
    new_major = load(sys.argv[2])[2].split(".")[0]
    for line in compatible: print("compatible:", line)
    for line in breaking: print("BREAKING:  ", line)
    if breaking and new_major == old_major:
        sys.exit("Breaking change without a major version bump: publish a new output port.")`,
        note: 'A reader-side view of compatibility: adding a column never breaks a reader that selects named columns, so new fields count as compatible. This catches structural changes only. A change of <b>meaning</b> under the same name passes every diff, which is why the contract carries descriptions and a human still reviews them.'
      }
    ],

    related: ['data-architecture', 'ddd', 'platform-engineering', 'cdc-pipelines', 'data-privacy', 'sd:data-lake', 'sd:privacy-data-platform']
  });
})();

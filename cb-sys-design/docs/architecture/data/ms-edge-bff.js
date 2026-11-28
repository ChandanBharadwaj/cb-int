(function () {
  // Fan-out maths. Each downstream call has a lognormal latency fitted to its p50 and p99.
  // Upper-tail normal quantile (Abramowitz & Stegun 26.2.23), good to ~4e-4.
  function zq(q) {
    const p = q > 0.5 ? 1 - q : q;
    const t = Math.sqrt(-2 * Math.log(Math.max(p, 1e-12)));
    const z = t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
    return q > 0.5 ? z : -z;
  }
  // q-quantile of the slowest of n parallel calls: F(x)^n = q  =>  x = quantile(q^(1/n))
  function maxOf(v, q) {
    const n = Math.round(v.n), sigma = Math.log(Math.max(v.p99, v.p50 + 1) / v.p50) / 2.326;
    return v.p50 * Math.exp(sigma * zq(Math.pow(q, 1 / n)));
  }
  const ms = (x) => (x >= 1000 ? (x / 1000).toFixed(2) + ' s' : Math.round(x) + ' ms');
  const required = (v) => Math.max(1, Math.round(v.n) - Math.round(Math.round(v.n) * v.opt / 100));

  SD.register({
    slug: 'ms-edge-bff',
    domain: 10,
    title: 'Gateway, BFF & API Composition',
    examples: 'Netflix, SoundCloud BFF, GraphQL federation',
    tagline: 'One front door, then <b>one small backend per kind of client</b> that calls several services in parallel and returns exactly what one screen needs. The hard parts are <b>fan-out latency</b>, <b>partial failure</b> and <b>keeping business logic out of the gateway</b>.',
    tldr: {
      problem: 'One screen needs data from five services. If the phone calls each one, it pays five slow mobile round trips and knows your internal layout. If the shared gateway joins the data, every product change waits on the gateway team and the front door fills with business logic.',
      idea: 'Keep the <b>gateway thin</b> (TLS, authentication, rate limits, routing). Behind it put a <b>Backend for Frontend (BFF)</b> per client type, owned by the team that builds that client. The BFF does <b>API composition</b>: it calls the services in parallel, applies a deadline, and shapes one response. <b>GraphQL federation</b> is the alternative when many teams must share one graph.',
      insight: 'Fan-out makes the tail the normal case: the screen is as slow as its <b>slowest</b> call and as available as <b>all</b> its required calls together. So every composed endpoint needs a <b>deadline</b>, a decision on which parts are <b>optional</b>, and a response format that can say "this part is missing".',
      numbers: [
        { v: '2013', l: 'SoundCloud starts using BFFs, by its own account (SoundCloud blog, 2021)' },
        { v: '1 − 0.99¹⁰ ≈ 9.6%', l: 'chance that at least one of 10 parallel calls is slower than its own p99 (math)' },
        { v: '0.999⁵ ≈ 99.5%', l: 'availability of a screen that needs all 5 of its 99.9% services (math)' }
      ]
    },

    intro: {
      what: 'An <b>API gateway</b> is the single entrance to your services. A <b>Backend for Frontend (BFF)</b> is a small server-side component that serves exactly one kind of client, such as the mobile app. <b>API composition</b> means answering one client request by calling several services and joining their answers in memory.',
      analogy: {
        icon: '🍽️',
        title: 'A waiter for each dining room',
        text: 'A restaurant has one front door with a host who checks reservations. That is the gateway. Inside, each dining room has its own waiter who knows what those guests want. The waiter collects the starter from one kitchen station, the main from another and the wine from the cellar, and brings one tray. That is a BFF doing composition. If the cellar is slow, a good waiter serves the food and says the wine is coming. Unlike a waiter, a BFF asks all stations at the same moment and gives up on a slow one after a fixed time.'
      },
      problem: 'A product screen on a phone shows the product, its price, stock, reviews and recommendations. Each lives in a different service. The phone is on a slow network, so five separate calls make the screen crawl. The web site wants more fields than the phone, and partners want a stable public API. The question is: <b>where do you join data from many services for one screen, and who owns that code?</b>',
      story: [
        {
          stage: 'naive',
          title: 'The app calls every service itself',
          text: 'The gateway only forwards. The mobile app calls Catalog, Pricing and Reviews one by one and joins the answers on the device. The services stay simple, so this is where most teams start.',
          scene: {
            nodes: [
              { id: 'mob', label: 'Mobile app', sub: 'joins on device', kind: 'client', at: [70, 110] },
              { id: 'gw', label: 'Gateway', sub: 'forwards only', kind: 'edge', at: [210, 110] },
              { id: 'cat', label: 'Catalog', sub: 'product', kind: 'service', at: [350, 0] },
              { id: 'inv', label: 'Pricing', sub: 'price + stock', kind: 'service', at: [350, 110] },
              { id: 'rev', label: 'Reviews', sub: 'ratings', kind: 'service', at: [350, 220] }
            ],
            edges: [{ from: 'mob', to: 'gw' }, { from: 'gw', to: 'cat' }, { from: 'gw', to: 'inv' }, { from: 'gw', to: 'rev' }],
            flow: ['mob>gw', 'gw>cat', 'mob>gw', 'gw>inv', 'mob>gw', 'gw>rev'],
            badges: { mob: ['3 round trips', 'info'] }
          }
        },
        {
          stage: 'breaks',
          title: 'Chatty, slow, and every client re-does the join',
          text: 'Each call pays the slow mobile network again. The app receives large generic responses and throws most fields away. Web, iOS and Android each re-write the same join. When Reviews is slow, the whole screen waits, because nobody decided what to do without it.',
          scene: {
            nodes: [
              { id: 'mob', label: 'Mobile app', sub: 'waiting…', kind: 'client', at: [70, 110] },
              { id: 'gw', label: 'Gateway', sub: 'forwards only', kind: 'edge', at: [210, 110] },
              { id: 'cat', label: 'Catalog', sub: '40 fields sent', kind: 'service', at: [350, 0] },
              { id: 'inv', label: 'Pricing', sub: 'price + stock', kind: 'service', at: [350, 110] },
              { id: 'rev', label: 'Reviews', sub: 'slow today', kind: 'service', at: [350, 220] }
            ],
            edges: [{ from: 'mob', to: 'gw' }, { from: 'gw', to: 'cat' }, { from: 'gw', to: 'inv' }, { from: 'gw', to: 'rev' }],
            flow: ['mob>gw', 'gw>cat', 'mob>gw', 'gw>rev'],
            err: ['rev'], warn: ['mob'],
            badges: { mob: ['blank screen', 'warn'], rev: ['2 s', 'err'] }
          }
        },
        {
          stage: 'fix',
          title: 'A BFF composes one response per screen',
          text: 'The app makes <b>one</b> call. A mobile BFF, owned by the mobile team, calls the three services <b>in parallel</b> inside the data centre, waits a fixed time, drops Reviews if it is late, and returns only the fields the screen shows. The gateway in front stays generic.',
          scene: {
            nodes: [
              { id: 'mob', label: 'Mobile app', sub: '1 round trip', kind: 'client', at: [70, 0] },
              { id: 'gw', label: 'Gateway', sub: 'auth + limits', kind: 'edge', at: [210, 0] },
              { id: 'bff', label: 'Mobile BFF', sub: 'parallel + deadline', kind: 'service', at: [210, 110] },
              { id: 'cat', label: 'Catalog', sub: 'product', kind: 'service', at: [70, 220] },
              { id: 'inv', label: 'Pricing', sub: 'price + stock', kind: 'service', at: [210, 220] },
              { id: 'rev', label: 'Reviews', sub: 'optional', kind: 'service', at: [350, 220] }
            ],
            edges: [{ from: 'mob', to: 'gw' }, { from: 'gw', to: 'bff' }, { from: 'bff', to: 'cat' }, { from: 'bff', to: 'inv' }, { from: 'bff', to: 'rev' }],
            flow: ['mob>gw', 'gw>bff', ['bff>cat', 'bff>inv', 'bff>rev']],
            ok: ['bff', 'mob'], warn: ['rev'],
            badges: { bff: ['one response', 'ok'], rev: ['skipped if late', 'warn'] }
          }
        }
      ],
      usedBy: ['SoundCloud (BFF per client since 2013)', 'Netflix (federated GraphQL gateway)', 'Envoy, Kong, NGINX, AWS API Gateway (thin gateways)', 'Apollo Federation (router + subgraphs)', 'Spring Cloud Gateway, Go and Node BFFs'],
      whenToUse: [
        'One screen needs data from <b>several services</b> and the client is on a slow or metered network',
        'You have <b>different client types</b> (web, mobile, partners) that want different payloads and release at different speeds',
        'A <b>client team</b> can own the BFF, so UI and its API change together'
      ],
      whenNot: [
        'One client and a handful of services: a plain gateway route, or the monolith\'s own controller, is enough (see <a href="ms-monolith-vs-microservices.html">monolith vs microservices</a>)',
        'The query is a heavy join, search or report over millions of rows: build a read model instead (see <a href="ms-data.html">data in microservices</a>)',
        'You only need TLS, auth and rate limits at the edge: that is the gateway itself (see <a href="../../system-design/systems/api-gateway.html">API gateway internals</a>)'
      ],
      glossary: [
        { term: 'API gateway', def: 'The shared entry point that does generic work for every request: TLS, authentication, rate limits and routing.' },
        { term: 'Backend for Frontend (BFF)', def: 'A server-side component that serves one kind of client and is owned by the team that builds that client.' },
        { term: 'API composition', def: 'Answering one request by calling several services and joining the results in memory.' },
        { term: 'Fan-out', def: 'One incoming request causing several outgoing calls, usually in parallel.' },
        { term: 'Tail latency', def: 'The slow end of the latency distribution, such as the p99: the time 1 request in 100 exceeds.' },
        { term: 'Partial response', def: 'A response that returns the parts that arrived in time and marks the missing parts, instead of failing the whole request.' },
        { term: 'GraphQL federation', def: 'Several services each publish part of one GraphQL schema; a router plans each query and calls the services that own the requested fields.' },
        { term: 'N+1 calls', def: 'Fetching a list with one call and then making one more call per item, instead of one batched call.' }
      ]
    },

    requirements: {
      functional: [
        '<b>Thin gateway</b>: only cross-cutting, domain-free work (TLS, authentication, rate limits, routing, request ids)',
        '<b>One BFF per user experience</b>, owned by the team that owns that experience',
        '<b>Compose in parallel</b> whenever calls do not depend on each other',
        '<b>A deadline on every fan-out</b>, passed down to each call, shorter than the client timeout',
        '<b>Required vs optional parts</b> decided per screen; optional parts degrade to a fallback',
        '<b>No domain rules at the edge</b>: prices, permissions and workflows stay in the services that own them'
      ],
      nonFunctional: [
        'One round trip per screen from the client (<em>target</em>)',
        'Screen p99 within a budget, e.g. &lt; 400 ms server side (<em>example target</em>)',
        'Screen stays up when an optional dependency is down: availability ≥ the product of <b>required</b> calls only',
        'Payload sized for the client: mobile responses in the low tens of KB (<em>rule of thumb</em>)',
        'A BFF deploy affects one client type only; the gateway changes rarely',
        'Every composed request traceable end to end with one trace id (OpenTelemetry context propagated)'
      ],
      outOfScope: [
        '<b>Overambitious gateway</b>: business logic, data transformation or orchestration in gateway plugins',
        '<b>One general-purpose API backend</b> that tries to serve every client and becomes a release bottleneck',
        '<b>BFF as a dumping ground</b>: domain logic that several BFFs then copy from each other',
        '<b>Sequential fan-out by accident</b>: awaiting calls one by one in a loop (the N+1 problem)',
        '<b>All-or-nothing responses</b>: one optional widget failing the whole screen'
      ]
    },

    calculator: {
      inputs: [
        { id: 'n', label: 'Downstream calls for one screen', min: 2, max: 15, value: 5 },
        { id: 'p50', label: 'Per-call latency p50', min: 5, max: 300, value: 40, unit: 'ms', log: true },
        { id: 'p99', label: 'Per-call latency p99', min: 20, max: 3000, value: 250, unit: 'ms', log: true },
        { id: 'avail', label: 'Per-service availability', min: 99, max: 99.99, value: 99.9, step: 0.01, unit: '%' },
        { id: 'opt', label: 'Share of calls that are optional (can be dropped)', min: 0, max: 80, value: 40, step: 10, unit: '%' },
        { id: 'rtt', label: 'Client network round trip (mobile)', min: 20, max: 500, value: 120, unit: 'ms', log: true }
      ],
      outputs: [
        { label: 'Client-side composition: n round trips, 4 at a time (median)', fmt: 'raw', f: (v) => ms(Math.ceil(Math.round(v.n) / 4) * (v.rtt + v.p50)) },
        { label: 'BFF, sequential calls (median)', fmt: 'raw', f: (v) => ms(v.rtt + Math.round(v.n) * v.p50) },
        { label: 'BFF, parallel calls: median · p99 of the slowest call', fmt: 'raw', f: (v) => ms(v.rtt + maxOf(v, 0.5)) + ' · ' + ms(v.rtt + maxOf(v, 0.99)) },
        { label: 'Requests where at least one call exceeds its own p99', fmt: 'pct', f: (v) => 1 - Math.pow(0.99, Math.round(v.n)) },
        { label: 'Screen availability if every call is required', fmt: 'raw', f: (v) => (Math.pow(v.avail / 100, Math.round(v.n)) * 100).toFixed(3) + ' %' },
        { label: 'Screen availability with optional calls degradable', fmt: 'raw', f: (v) => (Math.pow(v.avail / 100, required(v)) * 100).toFixed(3) + ' % (' + required(v) + ' required)' }
      ],
      note: 'Each call\'s latency is modelled as a lognormal fitted to your p50 and p99, and calls are assumed independent: both are <em>estimates</em>. The slowest of <i>n</i> parallel calls has quantile q at the single-call quantile q<sup>1/n</sup>, which is why the <b>median screen sits in the tail of each service</b>. Availability multiplies only across calls the screen cannot live without, so marking parts optional is the cheapest reliability gain. Client-side composition assumes the app opens 4 connections at once.'
    },

    api: [
      { m: 'GET', p: '/mobile/v1/product-screen/{id}', d: 'A <b>screen-shaped</b> BFF endpoint. Returns only the fields the mobile screen shows, plus <code>degraded: ["reviews"]</code> when an optional part was dropped. Versioned with the app, not with the services.' },
      { m: 'YAML', p: 'Gateway route (Envoy / Kubernetes Gateway API HTTPRoute)', d: 'Host and path prefix → BFF backend, timeout, retry budget, auth filter. <b>No</b> field mapping, no pricing rules, no joins. Detail on the <a href="../../system-design/systems/api-gateway.html">API gateway page</a>.' },
      { m: 'DOC', p: 'Screen contract (per endpoint)', d: 'For each part: the owning service, <b>required or optional</b>, its timeout, the fallback (omit, cached value, default), and the overall deadline. Reviewed with the service owners.' },
      { m: 'RPC', p: 'CatalogService.BatchGetProducts(ids)', d: 'Downstream services expose <b>batch</b> reads so a list screen costs one call per service, not one per row. This is what removes N+1 from composition.' },
      { m: 'DOC', p: 'Federated schema (supergraph)', d: 'With GraphQL federation: each team publishes a subgraph schema; entities carry <code>@key</code>; composition runs in CI and rejects breaking changes before the router gets the new schema.' },
      { m: 'ADR', p: 'ADR: BFF per client type, owned by client teams', d: 'Which clients get a BFF, who owns each, what may live there (composition, shaping, client-specific caching) and what may not (domain rules), and when shared logic moves down into a service.' }
    ],
    dataModel: [
      { name: 'ProductScreen (mobile response)', store: 'JSON over HTTPS, built in memory', fields: [['id', 'string', 'pk'], ['title', 'string'], ['thumbUrl', 'string'], ['price', '{amount, currency}'], ['inStock', 'boolean'], ['rating', 'number | null'], ['topReviews', 'Review[3] | null'], ['degraded', 'string[]']], note: 'A BFF stores nothing durable. <code>null</code> + an entry in <code>degraded</code> tells the app to hide that widget instead of showing an error.' },
      { name: 'screen_contract', store: 'Repo (YAML/markdown beside the BFF code)', fields: [['endpoint', 'text', 'pk'], ['part', 'text', 'pk'], ['owner_service', 'text', 'idx'], ['required', 'boolean'], ['timeout_ms', 'int'], ['fallback', 'omit | cached | default']], note: 'The record of the partial-failure decisions. Tests inject a slow or failing dependency per row and assert the fallback.' },
      { name: 'route', store: 'Gateway control plane (xDS / CRDs)', fields: [['host', 'text', 'pk'], ['path_prefix', 'text', 'pk'], ['backend', 'web-bff | mobile-bff | public-api'], ['timeout_ms', 'int'], ['auth_policy', 'text'], ['rate_limit', 'text']], note: 'Everything in a route is generic. If a row needs to know what a "price" is, the logic is in the wrong layer.' },
      { name: 'subgraph (federation only)', store: 'Schema registry', fields: [['name', 'text', 'pk'], ['routing_url', 'text'], ['schema_sdl', 'text'], ['owner_team', 'text', 'idx'], ['composed_at', 'timestamptz']], note: 'The router loads the composed supergraph schema; each subgraph row is owned by one team.' }
    ],

    architecture: {
      title: 'Thin gateway, one BFF per client type, parallel composition',
      nodes: [
        { id: 'web', label: 'Web app', sub: 'browser, big screen', kind: 'client', wide: [100, 40], tall: [70, 0], tip: 'Fast network, large screen: wants rich payloads and releases many times a day.' },
        { id: 'mob', label: 'Mobile app', sub: 'slow network', kind: 'client', wide: [100, 180], tall: [210, 0], tip: 'Slow, metered network and old app versions that live for years: wants one small response per screen.' },
        { id: 'partner', label: 'Partner', sub: 'third-party code', kind: 'external', wide: [100, 320], tall: [350, 0], tip: 'Outside developers need a stable, versioned, documented API that changes slowly.' },
        { id: 'gw', label: 'API gateway', sub: 'TLS · authn · limits', kind: 'edge', wide: [320, 180], tall: [210, 105], tip: 'Generic work only: terminate TLS, verify the token, rate limit, route by host and path, start the trace. No domain logic.' },
        { id: 'idp', label: 'Identity provider', sub: 'JWKS for tokens', kind: 'external', wide: [320, 330], tall: [70, 105], tip: 'Issues user tokens. The gateway verifies signatures locally with cached public keys, so there is no call per request.' },
        { id: 'wbff', label: 'Web BFF', sub: 'web team owns it', kind: 'service', wide: [560, 40], tall: [70, 210], tip: 'Composes rich responses for the web app. Deployed by the web team on its own schedule.' },
        { id: 'mbff', label: 'Mobile BFF', sub: 'mobile team owns it', kind: 'service', wide: [560, 180], tall: [210, 210], tip: 'One screen-shaped endpoint per mobile screen. Parallel fan-out, deadline, small payload.' },
        { id: 'pub', label: 'Public API', sub: 'versioned, stable', kind: 'service', wide: [560, 320], tall: [350, 210], tip: 'The BFF for third parties: stable resources, long deprecation windows, stricter limits.' },
        { id: 'cat', label: 'Catalog', sub: 'product data', kind: 'service', wide: [820, 40], tall: [70, 315], tip: 'Owns products. Exposes batch reads so list screens do not cause N+1 calls.' },
        { id: 'inv', label: 'Pricing & stock', sub: 'required for buy', kind: 'service', wide: [820, 180], tall: [210, 315], tip: 'Owns price and availability. A required part: without it the screen cannot offer "buy".' },
        { id: 'rev', label: 'Reviews', sub: 'optional part', kind: 'service', wide: [820, 320], tall: [350, 315], tip: 'Nice to have. If it is late or down, the screen renders without the reviews widget.' }
      ],
      edges: [
        { from: 'web', to: 'gw' }, { from: 'mob', to: 'gw' }, { from: 'partner', to: 'gw' },
        { from: 'gw', to: 'idp', dashed: true },
        { from: 'gw', to: 'wbff' }, { from: 'gw', to: 'mbff' }, { from: 'gw', to: 'pub' },
        { from: 'wbff', to: 'cat' }, { from: 'wbff', to: 'inv' }, { from: 'wbff', to: 'rev' },
        { from: 'mbff', to: 'cat' }, { from: 'mbff', to: 'inv' }, { from: 'mbff', to: 'rev' },
        { from: 'pub', to: 'cat' }, { from: 'pub', to: 'inv' }
      ]
    },

    scenarios: [
      {
        id: 'screen', title: 'One screen, one request', tone: 'ok',
        steps: [
          { text: 'The mobile app opens a product. It makes <b>one</b> call: <code>GET /mobile/v1/product-screen/42</code>.', flow: ['mob>gw'], badges: { mob: '1 round trip' } },
          { text: 'The gateway does the generic work: TLS, verify the token with cached keys, rate limit, add a trace id. It routes by path prefix to the Mobile BFF and knows nothing about products.', flow: ['gw>mbff'], nodes: ['idp'], badges: { gw: ['authn ✓', 'ok'] } },
          { text: 'The BFF starts a <b>300 ms deadline</b> and calls Catalog, Pricing and Reviews <b>at the same time</b>. Total wait is the slowest call, not the sum.', flow: [['mbff>cat', 'mbff>inv', 'mbff>rev']], badges: { mbff: 'deadline 300 ms' } },
          { text: 'It joins the three answers in memory, keeps the 8 fields the screen shows and drops the rest. The phone gets a small response.', flow: [['cat>mbff', 'inv>mbff', 'rev>mbff'], 'mbff>gw', 'gw>mob'], ok: ['mbff', 'mob'], badges: { mob: ['small payload', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'clients', title: 'Different clients, different backends', tone: 'info',
        steps: [
          { text: 'The web app shows the same product with more detail. Its BFF returns a richer payload and can change several times a day with the web release.', flow: ['web>gw', 'gw>wbff', ['wbff>cat', 'wbff>inv', 'wbff>rev']], badges: { wbff: 'rich payload' } },
          { text: 'A shipped mobile app cannot be changed, and old versions stay in use. The Mobile BFF keeps <code>/mobile/v1</code> working and adapts when a service behind it changes.', flow: ['mob>gw', 'gw>mbff', ['mbff>cat', 'mbff>inv']], badges: { mbff: 'shields old apps' } },
          { text: 'Partners get the <b>Public API</b>: stable resources, strict limits, long deprecation windows. It exposes less and never the internal screen shapes.', flow: ['partner>gw', 'gw>pub', ['pub>cat', 'pub>inv']], badges: { pub: 'v1 for years' } },
          { text: 'Each backend is owned by the team that owns its client. The risk is <b>duplicated logic</b> across BFFs: when the same rule appears in two of them, move it down into a service.', nodes: ['wbff', 'mbff', 'pub'], warn: ['wbff', 'mbff'], badges: { mbff: ['same rule twice?', 'warn'] }, tone: 'warn' }
        ]
      },
      {
        id: 'slow', title: 'Reviews is slow: partial failure', tone: 'err',
        steps: [
          { text: 'Reviews has a bad deploy and answers in 2 seconds. Catalog and Pricing answer in 40 ms.', flow: ['mob>gw', 'gw>mbff', ['mbff>cat', 'mbff>inv', 'mbff>rev']], err: ['rev'], badges: { rev: ['2 s', 'err'] } },
          { text: 'With <b>no deadline</b>, the BFF waits for all three. Every product screen now takes 2 s. BFF threads or connections pile up, and soon the BFF itself stops answering.', nodes: ['mbff', 'rev'], err: ['rev', 'mbff'], badges: { mbff: ['all requests stuck', 'err'] }, tone: 'err' },
          { text: 'With a <b>deadline and a required/optional split</b>, the BFF gives Reviews 150 ms, then returns the product and price with <code>topReviews: null</code> and <code>degraded: ["reviews"]</code>.', flow: [['cat>mbff', 'inv>mbff'], 'mbff>gw', 'gw>mob'], warn: ['rev'], ok: ['mbff'], badges: { mbff: ['partial response', 'ok'] }, tone: 'warn' },
          { text: 'A <b>circuit breaker</b> on the Reviews client then stops calling it for a while, so the BFF does not even spend the 150 ms. If <b>Pricing</b> (required) were down, the right answer is a fast error.', nodes: ['mbff', 'rev', 'inv'], ok: ['mbff'], badges: { rev: ['breaker open', 'warn'], inv: 'required' }, tone: 'ok' }
        ]
      },
      {
        id: 'scale', title: 'Sale day: fan-out multiplies load', tone: 'warn',
        steps: [
          { text: 'A sale brings 10× traffic. Every screen request becomes three downstream calls, so the services see the multiplied load. A list screen with 20 products is worse.', flow: [['web>gw', 'mob>gw'], ['gw>wbff', 'gw>mbff']], hot: ['gw', 'mbff', 'wbff'], badges: { gw: ['10× traffic', 'warn'] } },
          { text: 'A naive list endpoint calls Pricing once per product: 1 + 20 calls. This <b>N+1</b> pattern turns one request into dozens and makes the tail latency much worse.', flow: ['mbff>cat', 'mbff>inv', 'mbff>inv', 'mbff>inv'], err: ['inv'], badges: { inv: ['20 calls / request', 'err'] }, tone: 'err' },
          { text: 'Fix: <b>batch</b>. One <code>BatchGetPrices(ids)</code> call per service. In GraphQL the same idea is a per-request batching loader.', flow: [['mbff>cat', 'mbff>inv']], ok: ['inv'], badges: { inv: ['1 batched call', 'ok'] }, tone: 'ok' },
          { text: 'Then protect the tail: separate connection pools per dependency (bulkheads), a short cache for catalog data in the BFF, and no retries from the BFF when the deadline is nearly spent.', nodes: ['mbff', 'cat', 'rev'], ok: ['mbff'], badges: { mbff: ['bulkheads + cache', 'ok'] } }
        ]
      },
      {
        id: 'fed', title: 'Alternative: GraphQL federation', tone: 'info',
        steps: [
          { text: 'Instead of one BFF per client, the clients send GraphQL queries to one <b>router</b>. Each client asks for exactly the fields it needs, so payload shaping moves into the query.', flow: [['web>gw', 'mob>gw'], 'gw>mbff'], hidden: ['wbff', 'pub', 'partner'], labels: { mbff: { label: 'GraphQL router', sub: 'query planner' } } },
          { text: 'Each service team publishes a <b>subgraph</b>: its part of one schema. <code>Product</code> is an entity with <code>@key(fields: "id")</code>; Reviews adds a <code>reviews</code> field to it without touching Catalog\'s code.', nodes: ['cat', 'inv', 'rev'], hidden: ['wbff', 'pub', 'partner'], labels: { mbff: { label: 'GraphQL router', sub: 'query planner' }, cat: { sub: 'subgraph: Product' }, rev: { sub: 'subgraph: +reviews' }, inv: { sub: 'subgraph: +price' } } },
          { text: 'The router builds a <b>query plan</b>: fetch the product from Catalog, then ask Pricing and Reviews in parallel for their fields of that same product key, then merge.', flow: ['mbff>cat', ['mbff>inv', 'mbff>rev']], hidden: ['wbff', 'pub', 'partner'], labels: { mbff: { label: 'GraphQL router', sub: 'query planner' } }, badges: { mbff: 'plan: 1 then 2 parallel' } },
          { text: 'Partial failure is built into the format: a failed nullable field comes back as <code>null</code> with an entry in <code>errors</code>. The cost is a shared router and schema that need governance, and query cost limits.', flow: [['cat>mbff', 'inv>mbff'], 'mbff>gw'], hidden: ['wbff', 'pub', 'partner'], labels: { mbff: { label: 'GraphQL router', sub: 'query planner' } }, warn: ['rev'], ok: ['mbff'], badges: { mbff: ['data + errors', 'ok'] } }
        ]
      }
    ],

    knobs: {
      intro: 'Each control is a real decision for a product screen that needs three services. Latency numbers assume 40 ms p50 / 250 ms p99 per call and a 120 ms mobile round trip: <em>illustrative</em>, not benchmarks.',
      controls: [
        { id: 'comp', label: 'Where the screen is composed', type: 'seg', value: 'bff', options: [
          { v: 'client', l: 'In the client' }, { v: 'gwlogic', l: 'In gateway plugins' }, { v: 'bff', l: 'BFF per client' }, { v: 'fed', l: 'GraphQL federation' }] },
        { id: 'own', label: 'Who owns the edge code', type: 'seg', value: 'product', options: [
          { v: 'central', l: 'Central API team' }, { v: 'product', l: 'Client / product teams' }] },
        { id: 'fan', label: 'Fan-out style', type: 'seg', value: 'deadline', options: [
          { v: 'seq', l: 'Sequential' }, { v: 'par', l: 'Parallel' }, { v: 'deadline', l: 'Parallel + deadline + fallback' }] },
        { id: 'clients', label: 'Client types', type: 'seg', value: 'many', options: [
          { v: 'one', l: 'One (web only)' }, { v: 'many', l: 'Web + mobile + partners' }] }
      ],
      evaluate(s) {
        const C = s.comp, many = s.clients === 'many', central = s.own === 'central';
        const n = 3, rtt = 120, p99 = 250, tail = 330, hop = C === 'fed' ? 15 : 5;
        let lat;
        if (C === 'client') lat = s.fan === 'seq' ? n * (rtt + p99) : s.fan === 'par' ? rtt + tail + 60 : rtt + 300 + 60;
        else lat = rtt + hop + (s.fan === 'seq' ? n * p99 : s.fan === 'par' ? tail : 300);
        const latS = Math.max(0.05, Math.min(0.95, 1.25 - lat / 900));
        const pf = s.fan === 'deadline'
          ? (C === 'client' ? [0.55, 'each client re-implements the fallbacks'] : C === 'fed' ? [0.9, 'null field + errors entry'] : [0.9, 'optional parts dropped, screen renders'])
          : s.fan === 'par' ? [0.3, 'one slow service stalls the screen'] : [0.15, 'one slow service stalls every later call'];
        const auto = C === 'client' ? [0.5, 'UI free, but coupled to every service API']
          : C === 'gwlogic' ? [central ? 0.15 : 0.3, 'every change deploys the shared gateway']
          : C === 'fed' ? [central ? 0.5 : 0.85, central ? 'one team edits every subgraph schema' : 'each team ships its own subgraph']
          : [central ? 0.25 : 0.9, central ? 'screen changes queue at the API team' : 'UI and its API ship together'];
        const dup = C === 'client' ? [many ? 0.15 : 0.5, many ? 'every client re-writes the join' : 'join lives in the web app']
          : C === 'bff' ? [many ? 0.5 : 0.85, many ? 'shared rules can drift across 3 BFFs' : 'one BFF, one copy']
          : [0.85, 'one place'];
        const blast = C === 'gwlogic' ? [0.12, 'business bugs ship on the front door']
          : C === 'fed' ? [0.5, 'router and schema are shared by all clients']
          : C === 'bff' ? [many ? 0.88 : 0.7, many ? 'a bad BFF deploy hits one client type' : 'one BFF serves everyone']
          : [0.8, 'gateway stays generic'];
        const cost = C === 'client' ? [0.9, 'nothing extra to run'] : C === 'gwlogic' ? [0.65, 'plugins + gateway releases']
          : C === 'fed' ? [0.35, 'router, schema registry, subgraph libraries'] : [many ? 0.5 : 0.7, many ? '3 small services to run' : '1 small service to run'];
        const metrics = [
          { k: 'Client round trips per screen', v: C === 'client' ? n + ' (one per service)' : '1', s: C === 'client' ? 0.25 : 0.95 },
          { k: 'Screen latency p99', v: '≈ ' + lat + ' ms', s: latS, hint: 'illustrative' },
          { k: 'Partial-failure behaviour', v: pf[1], s: pf[0] },
          { k: 'Team autonomy', v: auto[1], s: auto[0] },
          { k: 'Duplicated logic', v: dup[1], s: dup[0] },
          { k: 'Edge blast radius', v: blast[1], s: blast[0] },
          { k: 'Run cost', v: cost[1], s: cost[0], hint: 'lower bar = more to run' }
        ];
        const notes = [];
        if (C === 'gwlogic') notes.push('Thoughtworks kept <b>"overambitious API gateways"</b> on Hold from 2015 to 2018: domain logic in middleware is hard to test, hard to deploy and owned by the wrong team.');
        if (C === 'client') notes.push('Client-side composition keeps the backend simple, but each call pays the mobile network, and the app is coupled to the internal service layout.');
        if (C === 'bff' && central) notes.push('Sam Newman\'s rule is that a BFF is <b>owned by the team that owns the UI</b>. A BFF run by a central team is a second gateway with a queue in front of it.');
        if (C === 'bff' && many && !central) notes.push('Watch for the same rule copied into several BFFs. SoundCloud reported exactly this and moved shared logic into "value-added services" behind the BFFs.');
        if (C === 'fed') notes.push('Federation replaces N BFFs with one router and one schema. Add CI schema checks, query depth/cost limits and persisted queries, or one client query can fan out without bound.');
        if (s.fan === 'seq') notes.push('Sequential calls add up: ' + n + ' × p99. Only chain calls when one needs the result of another.');
        if (s.fan === 'par') notes.push('Parallel is as slow as the slowest call. Without a deadline, a single slow dependency holds every request open.');
        if (s.fan === 'deadline') notes.push('Pass the remaining deadline to each call (gRPC deadlines, a timeout header) so services stop work the BFF no longer waits for.');
        let verdict;
        if (C === 'gwlogic') verdict = '❌ <b>Overambitious gateway.</b> Screen logic in shared gateway plugins couples every team to one deploy and one failure domain. Move it into a BFF.';
        else if (s.fan === 'seq') verdict = '⚠ <b>Sequential fan-out:</b> latency is the sum of the calls. Call in parallel unless one call needs another\'s result.';
        else if (C === 'client' && many) verdict = '⚠ <b>Chatty clients:</b> three client types each make three slow calls and re-write the join. This is the case BFFs exist for.';
        else if (C === 'bff' && central) verdict = '⚠ <b>A BFF without its frontend team</b> is one more shared API. Give each BFF to the team that owns that client.';
        else if (C === 'fed' && !many) verdict = '⚠ <b>Federation for one client</b> is a lot of machinery. A single BFF or a plain gateway route does the job.';
        else if (s.fan === 'par') verdict = '👍 <b>Workable, but unprotected:</b> add a deadline and decide which parts are optional before the first slow dependency decides for you.';
        else if (C === 'bff' && many) verdict = '✅ <b>The standard shape:</b> thin gateway, one BFF per client owned by that client\'s team, parallel calls with a deadline and fallbacks.';
        else if (C === 'bff') verdict = '👍 <b>One BFF for one client</b> is simply an API facade. Good. Add a second BFF when a second kind of client appears, not before.';
        else if (C === 'fed') verdict = central ? '👍 <b>Federation works</b>, but let service teams own their subgraphs; keep the central team to the router and schema rules.' : '✅ <b>Federated graph:</b> one schema for all clients, each team owns its part. Invest in schema checks and query limits.';
        else verdict = '👍 <b>Fine for one web client</b> on a fast network. Revisit when a mobile app or partner API arrives.';
        const fedL = C === 'fed', direct = C === 'client' || C === 'gwlogic';
        const hide = [];
        if (direct) hide.push('wbff', 'mbff', 'pub');
        else if (fedL || !many) hide.push('wbff', 'pub');
        if (!many) hide.push('mob', 'partner');
        const cl = many ? 'mob' : 'web';
        let flow;
        if (C === 'client') flow = [cl + '>gw', 'gw>cat', cl + '>gw', 'gw>inv', cl + '>gw', 'gw>rev'];
        else if (C === 'gwlogic') flow = [cl + '>gw', s.fan === 'seq' ? 'gw>cat' : ['gw>cat', 'gw>inv', 'gw>rev']].concat(s.fan === 'seq' ? ['gw>inv', 'gw>rev'] : []);
        else flow = [cl + '>gw', 'gw>mbff'].concat(s.fan === 'seq' ? ['mbff>cat', 'mbff>inv', 'mbff>rev'] : [['mbff>cat', 'mbff>inv', 'mbff>rev']]);
        const labels = {
          mbff: fedL ? { label: 'GraphQL router', sub: 'query planner' } : many ? { label: 'Mobile BFF', sub: central ? 'API team owns it' : 'mobile team owns it' } : { label: 'Web BFF', sub: central ? 'API team owns it' : 'web team owns it' },
          gw: C === 'gwlogic' ? { label: 'API gateway', sub: '+ joins + rules' } : { label: 'API gateway', sub: 'TLS · authn · limits' }
        };
        const badges = {};
        if (C === 'gwlogic') badges.gw = ['business logic', 'err'];
        if (s.fan === 'deadline' && !direct) badges.mbff = ['deadline 300 ms', 'ok'];
        if (s.fan !== 'deadline') badges.rev = ['can stall the screen', 'warn'];
        if (C === 'client') badges[cl] = [n + ' round trips', 'warn'];
        return {
          metrics, verdict, notes: notes.slice(0, 4), labels, hide, flow, badges,
          err: C === 'gwlogic' ? ['gw'] : [],
          warn: s.fan !== 'deadline' ? ['rev'] : [],
          ok: !direct && s.fan === 'deadline' ? ['mbff'] : [],
          hot: C === 'gwlogic' ? ['gw'] : []
        };
      }
    },

    widget: {
      title: 'Fan-out lab: sequential, parallel, deadline',
      caption: 'A BFF builds one screen from several services. <b>Send one request</b> to watch the calls as a waterfall, or <b>run 500</b> to see the p50 and p99. Make one service slow, switch between <b>sequential</b> and <b>parallel</b>, then add a <b>deadline</b>: optional parts that miss it are dropped (a partial response), a required part that misses it fails the screen.'
    },

    realWorld: {
      intro: 'The names are recent, the problem is not: one general-purpose API cannot serve every client well. These are the published accounts the pattern names come from.',
      timeline: [
        { when: '2013 →', who: 'SoundCloud', title: 'BFFs replace one public API for everything', text: 'SoundCloud writes that it pioneered the Backends for Frontends pattern in 2013, moving away from a single API that served both its own apps and third parties. Its BFFs include a Mobile API (Android and iOS), a Web API and Public and Partner APIs.', src: 1 },
        { when: '2015', who: 'Thoughtworks', title: 'BFF @ SoundCloud', text: 'Lukasz Plotnicki describes SoundCloud\'s move from a monolithic Rails app towards microservices. The BFF layer hid the changes behind it from the apps, and the article gives a guideline for shared code: a library if it need not be updated everywhere at once, a service if it must.', src: 3 },
        { when: '2015', who: 'Sam Newman', title: 'Pattern: Backends For Frontends', text: 'Newman\'s write-up, partly based on interviews at SoundCloud, describes one BFF per user experience (seen at REA) and one per type of user interface (seen at SoundCloud), and ties each BFF to the team that owns the UI. InfoQ credits the term to Phil Calçado at SoundCloud.', src: 0 },
        { when: 'Nov 2015 → May 2018', who: 'Thoughtworks Technology Radar', title: '"Overambitious API gateways" on Hold', text: 'The Radar kept this blip on Hold for six editions. Gateways are useful for generic concerns such as authentication and rate limiting; domain logic such as data transformation or rule processing belongs in services owned by product teams.', src: 6 },
        { when: 'ongoing', who: 'Chris Richardson', title: 'API gateway and API composition patterns', text: 'microservices.io lists Backends for Frontends as a variation of the API gateway pattern, notes that a gateway often does API composition, and describes API composition as the simple way to query data owned by several services.', src: 4 },
        { when: '2020', who: 'Netflix', title: 'GraphQL federation for the Studio API', text: 'InfoQ reports Netflix\'s account: its API gateway had grown too hard for a single team to maintain and had effectively become a monolith, so Netflix built a federated GraphQL gateway, first for the Studio API. The hardest part was aligning the organisation.', src: 7 },
        { when: '2021', who: 'SoundCloud', title: 'Dozens of BFFs, then Value-Added Services', text: 'SoundCloud reports running dozens of BFFs and warns that they cause duplication without a wider architecture. Each BFF held the same orchestration logic for playlist metadata, so that logic moved into shared "value-added services" behind the BFFs.', src: 2 },
        { when: '2023', who: 'Netflix', title: 'Federated graph grows', text: 'An InfoQ article by Netflix engineers reports more than 200 services in the federated graph as of 2023.', src: 9 }
      ],
      lessons: [
        'Keep the gateway <b>generic</b>. If a plugin knows what a price is, move it.',
        'A BFF belongs to the <b>team that owns the client</b>, or it becomes one more shared API.',
        'BFFs duplicate logic over time. <b>Push shared rules down</b> into a service behind them.',
        'Every fan-out needs a <b>deadline</b> and a required/optional decision per part.',
        'Federation trades N BFFs for one graph: you gain a shared schema and take on <b>schema governance</b>.'
      ],
      sources: [
        { title: 'Pattern: Backends For Frontends', url: 'https://samnewman.io/patterns/architectural/bff/', pub: 'Sam Newman, 2015' },
        { title: 'Service Architecture at SoundCloud, Part 1: Backends for Frontends', url: 'https://developers.soundcloud.com/blog/service-architecture-1', pub: 'SoundCloud Backstage Blog, 2021' },
        { title: 'Service Architecture at SoundCloud, Part 2: Value-Added Services', url: 'https://developers.soundcloud.com/blog/service-architecture-2', pub: 'SoundCloud Backstage Blog, 2021' },
        { title: 'BFF @ SoundCloud', url: 'https://www.thoughtworks.com/en-us/insights/blog/bff-soundcloud', pub: 'Lukasz Plotnicki, Thoughtworks Insights, 2015' },
        { title: 'Pattern: API Gateway / Backends for Frontends', url: 'https://microservices.io/patterns/apigateway', pub: 'Chris Richardson, microservices.io' },
        { title: 'Pattern: API Composition', url: 'https://microservices.io/patterns/data/api-composition.html', pub: 'Chris Richardson, microservices.io' },
        { title: 'Overambitious API gateways', url: 'https://www.thoughtworks.com/en-us/radar/platforms/overambitious-api-gateways', pub: 'Thoughtworks Technology Radar, Hold, 2015–2018' },
        { title: 'InfoQ news report on Netflix\'s GraphQL federation', url: 'https://www.infoq.com/news/2020/12/netflix-graphql-federation', pub: 'InfoQ, December 2020' },
        { title: 'Introduction to Entities', url: 'https://www.apollographql.com/docs/federation/entities/', pub: 'Apollo Federation documentation' },
        { title: 'InfoQ article on the federated GraphQL platform at Netflix', url: 'https://www.infoq.com/articles/federated-GraphQL-platform-Netflix', pub: 'InfoQ, 2023' },
        { title: 'InfoQ news report on the Backend for Frontend pattern', url: 'https://www.infoq.com/news/2015/12/bff-backend-frontend-pattern', pub: 'InfoQ, December 2015' },
        { title: 'InfoQ news report on SoundCloud\'s BFFs', url: 'https://www.infoq.com/news/2021/09/soundcloud-bff', pub: 'InfoQ, September 2021' }
      ]
    },

    tradeoffs: {
      headers: ['Decision', 'Option A', 'Option B', 'Pick when…'],
      rows: [
        ['Where to compose', '<b>In the client</b>: no extra backend; chatty, coupled to internals', '<b>Server side (BFF)</b>: one round trip, one more deployable', 'Client-side for one web app on a fast network; BFF once mobile or several services per screen appear'],
        ['Edge API shape', '<b>One general-purpose API</b>: one thing to run; serves no client well', '<b>BFF per client type</b>: tailored; logic can duplicate', 'One API while clients are alike; split when their payloads or release cadence diverge'],
        ['BFF granularity', '<b>Per interface type</b> (one for iOS + Android)', '<b>Per team / experience</b>', 'Follow the team boundary: one BFF per team that ships a client'],
        ['Composition tech', '<b>Hand-written BFF</b> (REST/gRPC calls): explicit, simple to debug', '<b>GraphQL federation</b>: clients pick fields, one schema, shared router', 'BFFs for a few clients and teams; federation when many teams feed many clients and can govern one schema'],
        ['Slow dependency', '<b>Wait</b>: complete data, unbounded latency', '<b>Deadline + partial response</b>: bounded latency, missing widgets', 'Always the deadline; mark a part required only if the screen is useless without it'],
        ['Shared edge logic', '<b>Library</b> in each BFF: no extra hop; versions drift', '<b>Service</b> behind the BFFs: one copy; one more call', 'Library for stable helpers; service when all BFFs must change together']
      ]
    },
    failures: [
      { f: 'Business logic in the gateway', detect: 'Gateway repo has product words (price, cart) in plugins; feature work needs a gateway release', fix: 'Move it into a BFF or the owning service; keep an allow-list of generic gateway concerns in an ADR.' },
      { f: 'No deadline on fan-out', detect: 'BFF p99 tracks the worst dependency; in-flight requests and connection pools climb during a downstream incident', fix: 'Overall deadline per endpoint, per-call timeouts below it, propagate the deadline, circuit breakers per dependency.' },
      { f: 'N+1 downstream calls', detect: 'Trace shows dozens of identical spans per request; calls per request grows with page size', fix: 'Batch endpoints in services; a batching loader in GraphQL; cap page size.' },
      { f: 'All-or-nothing screen', detect: 'An outage in reviews or recommendations shows as an outage of the product page', fix: 'Classify each part as required or optional in a screen contract; test by injecting failure per dependency.' },
      { f: 'BFF logic duplicated and drifting', detect: 'Same bug fixed three times; web and mobile show different totals', fix: 'Move the shared rule into a service behind the BFFs; BFFs keep only shaping and composition.' },
      { f: 'Retry amplification', detect: 'Downstream request rate jumps several-fold during a brown-out', fix: 'Retry at one layer only, with a retry budget; never retry when the deadline is nearly spent.' },
      { f: 'Unbounded GraphQL queries', detect: 'A few deep queries dominate router CPU and subgraph load', fix: 'Depth and cost limits, persisted (allow-listed) queries for first-party clients, per-client rate limits.' }
    ],

    interview: [
      { q: 'What belongs in an API gateway, and what must not go there?', a: '<p><b>Belongs:</b> generic work that is the same for every request and needs no domain knowledge: TLS termination, authentication (verifying the token), coarse authorisation, rate limiting, routing, request ids and tracing, load shedding.</p><p><b>Must not:</b> business rules, data transformation between domain models, joining data for a screen, workflow orchestration. That logic changes with the product, needs domain tests, and should be deployed by the team that owns it. In the gateway it couples every team to one release train and one failure domain. Thoughtworks called this the "overambitious API gateway".</p>', fu: 'Where does fine-grained authorisation go?', lvl: 'core' },
      { q: 'What is a Backend for Frontend and how is it different from a gateway?', a: '<p>A <b>BFF</b> is a server-side component built for <b>one kind of client</b> and owned by the team that builds that client. It exposes screen-shaped endpoints, calls the services behind it, and returns exactly what that client needs.</p><p>A gateway is shared and generic; a BFF is specific and belongs to a product team. They are usually layered: client → gateway → BFF → services. Sam Newman described the pattern in 2015, based largely on SoundCloud\'s use of it.</p>', lvl: 'core' },
      { q: 'How many BFFs should you have?', a: '<p>Follow <b>team and experience boundaries</b>, not a count. Common shapes: one per interface type (web, mobile, partner) or one per team that ships a user experience. iOS and Android can share one if the same team builds both and the screens match.</p><p>One client type needs no more than one BFF. Too many BFFs mean duplicated logic; the cure is to push shared rules down into a service, not to merge the BFFs back into one general API.</p>', lvl: 'core' },
      { q: 'A screen needs data from five services. Walk through the latency and availability.', a: '<ul><li><b>Sequential:</b> latency is the sum of the five calls.</li><li><b>Parallel:</b> latency is the <b>slowest</b> of the five. The chance at least one exceeds its own p99 is 1 − 0.99⁵ ≈ 4.9%, so the screen\'s p95 is roughly a single service\'s p99.</li><li><b>Availability:</b> if all five are required, 0.999⁵ ≈ 99.5%: five times the downtime of one service.</li></ul><p>So I call in parallel, set a deadline, and mark as many parts optional as the product allows, because availability multiplies only over required calls.</p>', fu: 'How do hedged requests change this?', lvl: 'core' },
      { q: 'How do you handle one slow or failed dependency in a composed response?', a: '<ul><li>Decide per part: <b>required</b> or <b>optional</b>, with a fallback (omit, cached value, default).</li><li>Set an overall <b>deadline</b> shorter than the client timeout, and per-call timeouts below it. Propagate the remaining time downstream.</li><li>Return a <b>partial response</b> that says what is missing, so the client hides the widget.</li><li>Add a <b>circuit breaker</b> and a separate connection pool per dependency so a slow one cannot exhaust the BFF.</li><li>If a required part fails, fail fast with a clear error.</li></ul>', lvl: 'core' },
      { q: 'When would you choose GraphQL federation instead of BFFs?', a: '<p>When <b>many teams</b> own parts of the data and <b>many clients</b> need different slices of it, and hand-written BFFs have become a bottleneck or a source of duplication. Each team publishes a subgraph; a router plans each query across them; clients ask for exactly the fields they need.</p><p>Costs: a shared router on the critical path, schema governance (composition checks in CI, ownership of types), query cost control, and harder caching than plain HTTP GETs. For two or three clients and a handful of teams, BFFs are simpler.</p>', fu: 'How does the router fetch a field that another subgraph adds to an entity?', lvl: 'deep' },
      { q: 'Explain how federation resolves an entity across subgraphs.', a: '<p>A type marked with <code>@key</code> is an <b>entity</b>: it can be fetched by its key fields. Catalog defines <code>Product @key(fields: "id")</code>. Reviews also declares <code>Product</code> with the same key and adds <code>reviews</code>.</p><p>For a query asking for name and reviews, the router first gets the product (with its id) from Catalog, then sends Reviews a <b>representation</b> (<code>__typename</code> plus key fields) through the <code>_entities</code> field. Reviews\' reference resolver returns its fields for that key, and the router merges the results.</p>', lvl: 'deep' },
      { q: 'What is the N+1 problem in API composition and how do you remove it?', a: '<p>You fetch a list with one call, then call another service once per item. A page of 50 orders makes 51 calls; latency and load grow with page size, and the tail gets worse with every extra call.</p><p>Fixes: <b>batch endpoints</b> (<code>BatchGet(ids)</code>) so it is one call per service; in GraphQL, a per-request <b>batching loader</b> that collects keys and issues one fetch; cap page sizes; and when the join is heavy or needs sorting across services, use a <b>read model</b> instead of composition.</p>', lvl: 'core' },
      { q: 'Where do authentication and authorisation happen in this layout?', a: '<p><b>Authentication</b> at the gateway: verify the user token once, reject anonymous traffic early. The gateway forwards the verified identity (the token itself, or a signed internal token).</p><p><b>Authorisation</b> in layers: coarse checks at the gateway or BFF ("is this a logged-in customer"), but the <b>service that owns the data</b> makes the final decision ("may this user see this order"). A BFF must not be the only place a rule is enforced, because another BFF or internal caller can reach the service too.</p>', lvl: 'core' },
      { q: 'Does a BFF hold state or its own database?', a: '<p>Normally <b>no durable business state</b>. It may hold a short-lived cache of downstream responses and, for browser apps, the session or OAuth tokens so they are not exposed to JavaScript (the "token handler" use of a BFF).</p><p>Once a BFF owns business data, it is a domain service and other clients will need it too. That data belongs in a service behind the BFFs.</p>', lvl: 'deep' },
      { q: 'The mobile and web BFFs now contain the same pricing rule, and they disagree. What do you do?', a: '<p>That rule is domain logic that leaked upward. I move it into the service that owns pricing (or a small service behind the BFFs if none does) and have both BFFs call it. SoundCloud described the same path: shared orchestration moved from BFFs into "value-added services".</p><p>To stop it recurring: a short written rule on what a BFF may contain (composition, shaping, client caching), and a review check for domain words in BFF code.</p>', lvl: 'core' },
      { q: 'A central API team owns the gateway and all aggregation endpoints. Product teams wait two weeks for each change. How do you fix this and bring people along?', a: '<p><em>Sample story with illustrative numbers. Use your own.</em><br><b>Situation:</b> one API team owned a gateway with about 60 aggregation endpoints; mobile and web features waited in its backlog. <b>Task:</b> remove the queue without losing the edge controls. <b>Action:</b> wrote an ADR splitting the layer in two: the API team keeps a thin gateway (auth, limits, routing) and offers a BFF template with tracing, deadlines and a client library; each client team owns its BFF. Migrated one screen first as a pilot, measured lead time, then moved endpoints route by route behind the gateway. Agreed a rule with the API team: domain logic goes to services, not BFFs. <b>Result:</b> screen changes shipped with the app release instead of two weeks later, and the gateway changed a few times a quarter instead of weekly.</p>', lvl: 'deep' }
    ],

    code: [
      {
        title: 'Spring Boot BFF: parallel calls, deadline, optional part', lang: 'java',
        code: `// Spring Boot 3.3+, Java 21 (virtual threads), spring-web RestClient
@RestController
class ProductScreenController {
  private final RestClient catalog, pricing, reviews;
  private final ExecutorService pool = Executors.newVirtualThreadPerTaskExecutor();

  ProductScreenController(RestClient.Builder b) {   // builder has connect/read timeouts set
    this.catalog = b.clone().baseUrl("http://catalog").build();
    this.pricing = b.clone().baseUrl("http://pricing").build();
    this.reviews = b.clone().baseUrl("http://reviews").build();
  }

  @GetMapping("/mobile/v1/product-screen/{id}")
  ProductScreen screen(@PathVariable String id) {
    var product = CompletableFuture.supplyAsync(() ->
        catalog.get().uri("/products/{id}", id).retrieve().body(Product.class), pool);
    var price = CompletableFuture.supplyAsync(() ->
        pricing.get().uri("/prices/{id}", id).retrieve().body(Price.class), pool);
    var topReviews = CompletableFuture.supplyAsync(() ->
            reviews.get().uri("/products/{id}/reviews?limit=3", id).retrieve().body(Reviews.class), pool)
        .completeOnTimeout(null, 150, TimeUnit.MILLISECONDS)   // optional: give up early
        .exceptionally(e -> null);                            // optional: errors become "missing"
    try {
      // required parts share one 300 ms deadline
      CompletableFuture.allOf(product, price).orTimeout(300, TimeUnit.MILLISECONDS).join();
    } catch (CompletionException e) {
      throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "product or price unavailable");
    }
    Reviews r = topReviews.join();
    return new ProductScreen(product.join().id(), product.join().title(), price.join(),
        r, r == null ? List.of("reviews") : List.of());   // tell the app what is missing
  }
}`,
        note: 'The three calls start at once, so the wait is the slowest call. <code>completeOnTimeout</code> stops <i>waiting</i> but does not cancel the HTTP call, so the <code>RestClient</code> must also have a read timeout. In production add a circuit breaker per dependency (Resilience4j) and pass the remaining deadline downstream.'
      },
      {
        title: 'Go BFF: errgroup with a context deadline', lang: 'go',
        code: `// Go 1.22+, golang.org/x/sync/errgroup
func (h *Handler) ProductScreen(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 300*time.Millisecond)
	defer cancel()
	id := r.PathValue("id")

	var out Screen
	g, gctx := errgroup.WithContext(ctx) // first required error cancels the others
	g.Go(func() (err error) { out.Product, err = h.catalog.Get(gctx, id); return })
	g.Go(func() (err error) { out.Price, err = h.pricing.Get(gctx, id); return })
	g.Go(func() error { // optional part: never fails the group
		rctx, c := context.WithTimeout(gctx, 150*time.Millisecond)
		defer c()
		rv, err := h.reviews.Top(rctx, id, 3)
		if err != nil {
			out.Degraded = append(out.Degraded, "reviews")
			return nil
		}
		out.Reviews = rv
		return nil
	})
	if err := g.Wait(); err != nil {
		http.Error(w, "product or price unavailable", http.StatusGatewayTimeout)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}`,
        note: 'Each goroutine writes different fields of <code>out</code>, so there is no data race. The context carries the deadline into every client call: when it expires, the outgoing HTTP or gRPC requests are cancelled, not just ignored. With gRPC the deadline also travels to the server.'
      },
      {
        title: 'GraphQL federation: two subgraphs, one Product', lang: 'graphql',
        code: `# --- catalog subgraph (owned by the Catalog team) ---
extend schema @link(url: "https://specs.apollo.dev/federation/v2.5", import: ["@key"])

type Product @key(fields: "id") {
  id: ID!
  title: String!
  thumbUrl: String
}

type Query {
  product(id: ID!): Product
}

# --- reviews subgraph (owned by the Reviews team) ---
extend schema @link(url: "https://specs.apollo.dev/federation/v2.5", import: ["@key"])

type Product @key(fields: "id") {
  id: ID!
  rating: Float            # nullable: if Reviews is down the field is null
  topReviews(limit: Int = 3): [Review!]
}

type Review {
  id: ID!
  stars: Int!
  text: String!
}

# --- what the mobile app sends to the router ---
query ProductScreen($id: ID!) {
  product(id: $id) { title thumbUrl rating topReviews { stars text } }
}`,
        note: 'The router fetches <code>title</code> and <code>thumbUrl</code> from Catalog, then asks Reviews for <code>rating</code> and <code>topReviews</code> of the same <code>id</code> through the <code>_entities</code> field. Keep fields from optional services <b>nullable</b>: a failed non-null field would null out its parent instead of just that field.'
      }
    ],

    related: ['ms-communication', 'ms-data', 'ms-discovery-config-security', 'api-design', 'resiliency-patterns', 'sd:api-gateway', 'sd:rate-limiter']
  });
})();

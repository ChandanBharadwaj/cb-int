(function () {
  // Synchronous chain maths: availability multiplies per hop, retries multiply per layer.
  const m = (v) => {
    const p = v.fail / 100, h = Math.round(v.hops), r = Math.round(v.retries), layers = Math.min(Math.round(v.layers), h);
    const noRetry = Math.pow(1 - p, h);
    const withRetry = Math.pow(1 - Math.pow(p, r + 1), h);
    const amp = Math.pow(r + 1, layers);
    return { p, h, r, layers, noRetry, withRetry, amp };
  };
  const big = (x) => (x >= 1e6 ? (x / 1e6).toFixed(1) + ' M' : x >= 1e4 ? Math.round(x / 1e3) + ' k' : Math.round(x).toLocaleString('en-US'));

  SD.register({
    slug: 'ms-communication',
    domain: 10,
    title: 'Service Communication: Sync, Async & Orchestration',
    examples: 'gRPC, Kafka, Temporal, Netflix',
    tagline: 'Every arrow between two services is a decision: <b>wait for an answer</b> (REST, gRPC) or <b>leave a message</b> (events, queues); let services <b>react to each other</b> or have <b>one coordinator</b>. Then make each call safe with a deadline, bounded retries and an idempotency key.',
    tldr: {
      problem: 'Inside one process a call either returns or throws. Between services it can also <b>hang</b>, arrive twice, or succeed while the reply is lost. Chains of waiting calls multiply latency and failure, and one renamed field can break a consumer you did not know existed.',
      idea: 'Choose the <b>interaction style</b> per arrow. <b>Synchronous request/reply</b> when the caller needs the answer now. <b>Asynchronous messages</b> when it does not: an <b>event</b> for a fact many may care about, a <b>command</b> for work one receiver must do. Coordinate multi-step flows by <b>choreography</b> or <b>orchestration</b>. Evolve schemas <b>additively</b>.',
      insight: 'Sync vs async is really about <b>temporal coupling</b>: must both sides be up at the same moment? A timeout tells you nothing about what happened on the other side, so <b>every retried operation must be idempotent</b>. That one fact drives most of the design.',
      numbers: [
        { v: '27×', l: 'load on the last service when 3 layers each make 3 attempts (arithmetic)' },
        { v: 'no deadline', l: 'gRPC default; grpc.io advice: always set one' },
        { v: 'BACKWARD', l: 'default compatibility mode in Confluent Schema Registry (docs)' }
      ]
    },

    intro: {
      what: '<b>Service communication</b> is how separately deployed services ask each other for data or work. A <b>synchronous</b> call waits for the reply (an HTTP or gRPC request). An <b>asynchronous</b> message is handed to a broker or queue and the sender moves on; the receiver handles it when it can.',
      analogy: {
        icon: '📞',
        title: 'A phone call or a letter',
        text: 'A phone call gets an answer now, but only if the other person picks up, and you can do nothing else while you hold. A letter needs nobody at home: you post it and get on with your day, but the answer comes later, and you must cope with a letter that arrives twice. Announcing news on a notice board is the third option: you do not know or care who reads it. Software differs in one way: a dropped phone call gives no hint whether the other side heard you, so you need a way to repeat yourself safely.'
      },
      problem: 'Checkout calls Payments, which calls Fraud, which calls a slow scoring service. Nobody set a timeout. One slow scorer now holds threads in three services, the gateway retries, and customers are charged twice when the first attempt finishes after all. The question this page answers is <b>which arrows should wait, which should not, and how do you make each one safe to fail?</b>',
      story: [
        {
          stage: 'naive',
          title: 'Treat remote calls like local calls',
          text: 'The Order service calls Payment, then Inventory, over HTTP and waits for each. No timeouts, because locally a call always returns. It reads like normal code.',
          scene: {
            nodes: [
              { id: 'o', label: 'Order svc', sub: 'waits for each', kind: 'service', at: [70, 110] },
              { id: 'p', label: 'Payment', sub: 'HTTP call', kind: 'service', at: [210, 0] },
              { id: 'i', label: 'Inventory', sub: 'HTTP call', kind: 'service', at: [210, 220] },
              { id: 'n', label: 'Email', sub: 'HTTP call', kind: 'service', at: [350, 110] }
            ],
            edges: [{ from: 'o', to: 'p' }, { from: 'o', to: 'i' }, { from: 'o', to: 'n' }],
            flow: ['o>p', 'o>i', 'o>n'],
            badges: { o: ['3 waits', 'info'] }
          }
        },
        {
          stage: 'breaks',
          title: 'One slow service stalls the chain',
          text: 'Email is slow today. Order waits, its threads fill up, and it stops answering. An impatient client retries, and Payment <b>charges again</b> because nothing marks the second request as a repeat. An order failed because of an email.',
          scene: {
            nodes: [
              { id: 'o', label: 'Order svc', sub: 'threads exhausted', kind: 'service', at: [70, 110] },
              { id: 'p', label: 'Payment', sub: 'charged twice', kind: 'service', at: [210, 0] },
              { id: 'i', label: 'Inventory', sub: 'fine', kind: 'service', at: [210, 220] },
              { id: 'n', label: 'Email', sub: 'slow: 30 s', kind: 'service', at: [350, 110] }
            ],
            edges: [{ from: 'o', to: 'p' }, { from: 'o', to: 'i' }, { from: 'o', to: 'n' }],
            flow: ['o>p', 'o>n', 'o>p'],
            err: ['n', 'o'], warn: ['p'],
            badges: { n: ['no timeout', 'err'], p: ['duplicate', 'warn'] }
          }
        },
        {
          stage: 'fix',
          title: 'Wait only where you must, and make repeats safe',
          text: 'Payment stays a synchronous call, with a <b>deadline</b> and an <b>idempotency key</b> so a retry cannot charge twice. Email does not need an answer, so Order publishes an <b>event</b> and returns. A slow Email service now delays emails, nothing else.',
          scene: {
            nodes: [
              { id: 'o', label: 'Order svc', sub: 'returns fast', kind: 'service', at: [70, 110] },
              { id: 'p', label: 'Payment', sub: 'deadline + key', kind: 'service', at: [210, 0] },
              { id: 'b', label: 'Broker', sub: 'OrderPlaced', kind: 'queue', at: [210, 220] },
              { id: 'n', label: 'Email', sub: 'catches up later', kind: 'service', at: [350, 220] }
            ],
            edges: [{ from: 'o', to: 'p', bidi: true }, { from: 'o', to: 'b' }, { from: 'b', to: 'n' }],
            flow: ['o>p', 'p>o', 'o>b', 'b>n'],
            ok: ['o', 'p'], warn: ['n'],
            badges: { p: ['charged once', 'ok'], n: ['backlog only', 'warn'] }
          }
        }
      ],
      usedBy: ['gRPC (Google, Netflix, Square and many others)', 'Apache Kafka (LinkedIn, Uber, Netflix)', 'Stripe API (idempotency keys)', 'Temporal and Netflix Conductor (orchestration)', 'Envoy proxy (timeouts and retries outside the app)', 'AWS SQS and SNS'],
      whenToUse: [
        '<b>Synchronous</b>: the caller cannot continue without the answer, such as a price, a permission check or a payment authorisation',
        '<b>Asynchronous event</b>: something happened and others may react, now or later, without the sender knowing them',
        '<b>Orchestration</b>: a business process has several steps, a deadline and someone who asks "where is my order?"'
      ],
      whenNot: [
        'Do not make a call synchronous only because it is easier to write: each waiting hop multiplies failure (see <a href="resiliency-patterns.html">Resiliency Patterns</a>)',
        'Do not use events to hide a command you need obeyed, or a query you need answered now',
        'Do not hand-roll a multi-step flow across services with retries in code: see <a href="event-driven-sagas.html">Event-Driven Architecture &amp; Sagas</a>'
      ],
      glossary: [
        { term: 'Temporal coupling', def: 'Two services must both be running at the same moment for the interaction to work; synchronous calls have it, messages through a broker do not.' },
        { term: 'Request/reply', def: 'The caller sends a request and gets a response to that request, over HTTP, gRPC or a pair of messages linked by a correlation id.' },
        { term: 'Event', def: 'A message stating that something happened, in the past tense; the sender does not know who consumes it.' },
        { term: 'Command', def: 'A message asking one specific receiver to do something; it can be refused.' },
        { term: 'Deadline', def: 'The absolute time by which the whole request must finish; it is passed down the call chain so every hop knows how long is left.' },
        { term: 'Idempotency key', def: 'A unique id the caller attaches to an operation so the server can recognise a repeat and return the first result.' },
        { term: 'Choreography', def: 'Each service reacts to events from others; there is no central coordinator.' },
        { term: 'Orchestration', def: 'One component tells each service what to do next and keeps track of the process.' }
      ]
    },

    requirements: {
      functional: [
        '<b>Pick the style per interaction</b>: query, command or event; sync or async',
        '<b>Every remote call has a timeout</b>, derived from one propagated deadline',
        '<b>Retry only what is safe</b>: idempotent operations, retryable errors, with backoff and jitter',
        '<b>Retry at one layer</b>, with a budget, so attempts do not multiply down the chain',
        '<b>Contracts are explicit and versioned</b>: OpenAPI, protobuf or AsyncAPI, owned by the provider',
        '<b>Schemas evolve additively</b>; readers ignore what they do not know'
      ],
      nonFunctional: [
        'At most 3 synchronous hops in sequence on a user request (<em>rule of thumb</em>)',
        'No duplicate side effects under retry or redelivery, proven by a test that replays requests',
        'A failing non-critical dependency does not fail the user request',
        'Retries add under about 10 % extra load in steady state (<em>example budget</em>)',
        'Every request and message carries a trace id (W3C Trace Context, OpenTelemetry)',
        'Contract compatibility is checked in CI before a provider deploys'
      ],
      outOfScope: [
        '<b>Remote calls with no timeout</b>',
        '<b>Retry everywhere</b>: client, gateway, mesh and service all retrying the same failure',
        '<b>Chatty chains</b>: five services called in sequence for one screen',
        '<b>Passive-aggressive events</b>: an "event" whose sender needs a particular service to act',
        '<b>Breaking changes in place</b>: renaming or re-typing a field consumers already read'
      ]
    },

    calculator: {
      inputs: [
        { id: 'hops', label: 'Synchronous hops in sequence', min: 1, max: 10, value: 4 },
        { id: 'lat', label: 'Timeout per attempt', min: 20, max: 2000, value: 300, unit: 'ms', log: true },
        { id: 'fail', label: 'Failure rate per attempt, per hop', min: 0.1, max: 20, value: 1, step: 0.1, unit: '%', log: true },
        { id: 'retries', label: 'Retries per call', min: 0, max: 5, value: 2 },
        { id: 'layers', label: 'Layers that each retry', min: 1, max: 5, value: 3 },
        { id: 'rps', label: 'Requests per second at the edge', min: 10, max: 100000, value: 1000, log: true, fmt: 'num' }
      ],
      outputs: [
        { label: 'Chain success with no retries', fmt: 'pct', f: (v) => m(v).noRetry },
        { label: 'Chain success with retries at each hop', fmt: 'pct', f: (v) => m(v).withRetry },
        { label: 'Worst-case attempts on the last service per request', fmt: 'raw', f: (v) => m(v).amp + '×' },
        { label: 'Worst-case load on the last service when it fails', fmt: 'raw', f: (v) => big(v.rps * m(v).amp) + ' req/s' },
        { label: 'Worst-case wait if every hop uses every attempt', fmt: 'ms', f: (v) => m(v).h * (m(v).r + 1) * v.lat },
        { label: 'Same flow via a broker: caller depends on', fmt: 'raw', f: () => 'itself + the broker only' }
      ],
      note: 'Failures are assumed independent, which flatters the "with retries" line: real failures are correlated, and retrying a service that is down or overloaded makes it worse. The amplification line is the reason to <b>retry at one layer only</b>: the number of layers is capped at the number of hops. The worst-case wait ignores backoff sleeps, so the real figure is higher: a single end-to-end deadline is the only thing that bounds it. For breakers, bulkheads and load shedding see <a href="resiliency-patterns.html">Resiliency Patterns</a>.'
    },

    api: [
      { m: 'RPC', p: 'payments.proto (gRPC contract)', d: 'Service, methods and messages with numbered fields. The package carries the major version (<code>shop.payments.v1</code>). Deleted fields are <code>reserved</code>. Design guidance for HTTP and gRPC APIs is on the <a href="api-design.html">API Design page</a>.' },
      { m: 'HTTP', p: 'POST /payments + Idempotency-Key header', d: 'The caller generates the key once per logical operation and repeats it on every retry. The server stores key → result and replays it. Returns 201 the first time and the same body on a repeat.' },
      { m: 'EVENT', p: 'OrderPlaced v1 (AsyncAPI channel)', d: 'A fact in the past tense with a stable <code>id</code>, the aggregate id as partition key, a timestamp and the data consumers need. Documented in <code>asyncapi.yaml</code>, owned by the Ordering team.' },
      { m: 'POLICY', p: 'Call policy', d: 'Deadline set at the edge and propagated; per-call timeout no larger than what remains; retries only at the caller closest to the failure, at most 2, on retryable codes, with exponential backoff and jitter.' },
      { m: 'YAML', p: 'Proxy route config (Envoy / Kubernetes Gateway API)', d: 'Timeouts and retry rules declared outside the application: per-route request timeout, <code>retry_on</code> conditions, number of retries, per-try timeout. Keep them consistent with what the code does, or attempts multiply.' },
      { m: 'POLICY', p: 'Schema compatibility rule', d: 'Add optional fields only; never reuse a field number or change a type; consumers ignore unknown fields. A registry or a CI check (for example BACKWARD mode, or <code>buf breaking</code> for protobuf) blocks incompatible changes.' }
    ],
    dataModel: [
      { name: 'idempotency_keys', store: 'Postgres (provider\'s DB) or Redis', fields: [['key', 'text', 'pk'], ['request_hash', 'text'], ['status', 'int'], ['body', 'text'], ['created_at', 'timestamptz', 'idx']], note: 'Written in the same transaction as the side effect. <code>request_hash</code> detects a key reused for a different request. Expire rows after the longest retry window, for example 24 h.' },
      { name: 'request context (headers)', store: 'Propagated on every call and message', fields: [['traceparent', 'W3C Trace Context'], ['grpc-timeout / deadline', 'time left'], ['idempotency-key', 'text'], ['correlation-id', 'text']], note: 'Not a table: the metadata that must travel with every hop. Without it you cannot trace a request, bound its total time or deduplicate it.' },
      { name: 'api_contract', store: 'Schema registry / contract repo', fields: [['name', 'text', 'pk'], ['version', 'int', 'pk'], ['kind', 'openapi|proto|asyncapi|avro'], ['owner_team', 'text'], ['compatibility', 'BACKWARD|FORWARD|FULL'], ['consumers', 'text[]']], note: 'Knowing the consumers of a contract is what makes it possible to retire a version.' },
      { name: 'process_instance', store: 'Workflow engine (orchestration only)', fields: [['id', 'uuid', 'pk'], ['type', 'text'], ['state', 'text', 'idx'], ['current_step', 'text'], ['deadline', 'timestamptz', 'idx']], note: 'The orchestrator\'s record of where each business process is. In choreography this state exists only implicitly, spread across services.' }
    ],

    architecture: {
      title: 'One order, three ways to talk: request/reply, events, orchestration',
      nodes: [
        { id: 'client', label: 'Client', sub: 'web / app', kind: 'client', wide: [90, 110], tall: [70, 0], tip: 'Sets the user\'s patience: the overall deadline starts here.' },
        { id: 'gw', label: 'API gateway', sub: 'Envoy · deadline', kind: 'edge', wide: [280, 110], tall: [70, 105], tip: 'Terminates the client connection, sets the request deadline and the trace id. It should not retry non-idempotent requests.' },
        { id: 'ord', label: 'Order service', sub: 'REST in, gRPC out', kind: 'service', wide: [470, 110], tall: [70, 210], tip: 'Needs an answer from Payment before it can confirm. Does not need an answer from Shipping or Notifications.' },
        { id: 'pay', label: 'Payment', sub: 'gRPC · idempotent', kind: 'service', wide: [660, 0], tall: [210, 105], tip: 'A synchronous dependency. Its handler deduplicates on the idempotency key so a retry is safe.' },
        { id: 'idem', label: 'Idempotency keys', sub: 'key → result', kind: 'store', wide: [850, 0], tall: [210, 0], tip: 'Stores the outcome of each key in the same transaction as the charge, so a repeat returns the first result.' },
        { id: 'inv', label: 'Inventory', sub: 'gRPC', kind: 'service', wide: [660, 220], tall: [210, 315], tip: 'Reserves stock. Called directly, or sent a command by the orchestrator.' },
        { id: 'orch', label: 'Orchestrator', sub: 'Temporal workflow', kind: 'compute', wide: [850, 110], tall: [350, 210], tip: 'Optional. Holds the state of a multi-step process and sends each service a command. Exists only when you choose orchestration.' },
        { id: 'broker', label: 'Kafka', sub: 'order.events', kind: 'queue', wide: [470, 330], tall: [70, 315], tip: 'Stores events until consumers read them. Delivery is at-least-once, so consumers must tolerate duplicates.' },
        { id: 'ship', label: 'Shipping', sub: 'consumer', kind: 'service', wide: [280, 330], tall: [70, 420], tip: 'Reacts to OrderPlaced in its own time. Order does not know it exists.' },
        { id: 'notif', label: 'Notifications', sub: 'consumer', kind: 'service', wide: [660, 330], tall: [210, 420], tip: 'Another consumer of the same event. Adding it required no change to the Order service.' }
      ],
      edges: [
        { from: 'client', to: 'gw' },
        { from: 'gw', to: 'ord' },
        { from: 'ord', to: 'pay', bidi: true },
        { from: 'ord', to: 'inv', bidi: true },
        { from: 'pay', to: 'idem', dashed: true },
        { from: 'ord', to: 'orch', dashed: true },
        { from: 'orch', to: 'pay' },
        { from: 'orch', to: 'inv' },
        { from: 'ord', to: 'broker' },
        { from: 'broker', to: 'ship' },
        { from: 'broker', to: 'notif' }
      ]
    },

    scenarios: [
      {
        id: 'sync', title: 'Request/reply with a deadline', tone: 'ok',
        steps: [
          { text: 'The client posts an order. The gateway stamps a <b>deadline</b> (2 s from now) and a trace id on the request.', flow: ['client>gw', 'gw>ord'], hidden: ['orch'], badges: { gw: 'deadline: 2 s' } },
          { text: 'Order calls Payment over gRPC and passes the deadline on. Payment sees <b>1.9 s left</b>, not a fresh timeout of its own.', flow: ['ord>pay'], hidden: ['orch'], badges: { pay: '1.9 s left' } },
          { text: 'Payment answers in 120 ms. Order then reserves stock with what remains of the same budget.', flow: ['pay>ord', 'ord>inv', 'inv>ord'], hidden: ['orch'], ok: ['pay', 'inv'], badges: { inv: '1.7 s left' } },
          { text: 'The reply goes back. The caller got its answer in one round trip. The price: <b>Order is up only when Payment and Inventory are up</b>.', flow: ['ord>gw', 'gw>client'], hidden: ['orch'], ok: ['ord'], badges: { client: ['201 Created', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'timeout', title: 'Timeout, retry and the double charge', tone: 'err',
        steps: [
          { text: 'Payment is slow. Order\'s 500 ms timeout fires. Order now knows <b>nothing</b>: the charge may have failed, may be in progress, or may have succeeded.', flow: ['ord>pay'], hidden: ['orch'], warn: ['pay'], badges: { ord: ['timeout', 'warn'], pay: 'still working' }, tone: 'warn' },
          { text: 'Order retries. Payment had in fact finished the first charge. With no way to recognise the repeat, it <b>charges the card again</b>.', flow: ['ord>pay'], hidden: ['orch', 'idem'], err: ['pay'], badges: { pay: ['2 charges', 'err'] }, tone: 'err' },
          { text: 'Fix: Order creates an <b>idempotency key</b> once per order and sends it on every attempt. Payment stores key and result in the same transaction as the charge.', flow: ['ord>pay', 'pay>idem'], hidden: ['orch'], badges: { idem: 'key saved' } },
          { text: 'The retry arrives with the same key. Payment finds it and <b>returns the stored result</b> without charging. Retrying is now safe.', flow: ['ord>pay', 'pay>idem', 'pay>ord'], hidden: ['orch'], ok: ['pay', 'idem'], badges: { pay: ['1 charge', 'ok'] }, tone: 'ok' },
          { text: 'Retry only errors that can change: timeouts and "unavailable". A declined card or a validation error will fail the same way every time.', nodes: ['ord'], hidden: ['orch'], badges: { ord: ['retryable codes only', 'info'] } }
        ]
      },
      {
        id: 'events', title: 'Events and choreography', tone: 'ok',
        steps: [
          { text: 'Order saves the order and publishes <code>OrderPlaced</code>. It answers the client at once with <b>202 Accepted</b>; it does not wait for anyone downstream.', flow: ['client>gw', 'gw>ord', 'ord>broker'], hidden: ['orch'], badges: { client: ['202', 'ok'] } },
          { text: 'Shipping and Notifications each read the event with their own consumer group. Order does not know either of them.', flow: [['broker>ship', 'broker>notif']], hidden: ['orch'], ok: ['ship', 'notif'] },
          { text: 'Notifications is down for ten minutes. The events wait in the log. When it returns it <b>catches up</b>; no order was affected.', flow: ['broker>notif'], hidden: ['orch'], warn: ['notif'], badges: { notif: ['lag: 10 min', 'warn'] }, tone: 'warn' },
          { text: 'A new Loyalty service is added by subscribing to the same topic. <b>No change to Order.</b> That is the strength of events, and of choreography.', flow: ['broker>ship'], hidden: ['orch'], labels: { ship: { label: 'Loyalty', sub: 'new consumer' } }, ok: ['ship'], badges: { ship: ['just subscribed', 'ok'] }, tone: 'ok' },
          { text: 'The weakness: nobody holds the whole flow. "Why did order 42 never ship?" means reading logs in three services.', nodes: ['broker', 'ship', 'notif'], hidden: ['orch'], badges: { broker: ['who owns the flow?', 'warn'] } }
        ]
      },
      {
        id: 'orch', title: 'Orchestration: commands and replies', tone: 'info',
        steps: [
          { text: 'For a process with several steps that must all happen, Order starts a <b>workflow</b>. The orchestrator records "order 42: started".', flow: ['gw>ord', 'ord>orch'], badges: { orch: 'order 42: started' } },
          { text: 'It sends Payment a <b>command</b>, <code>CapturePayment</code>, and waits for the reply. The state is saved after every step.', flow: ['orch>pay', 'pay>orch'], ok: ['pay'], badges: { orch: 'step 1 ✓' } },
          { text: 'Next it sends <code>ReserveStock</code> to Inventory. If Inventory is down, the orchestrator <b>retries with backoff</b> for as long as its policy allows.', flow: ['orch>inv', 'inv>orch'], ok: ['inv'], badges: { orch: 'step 2 ✓' } },
          { text: 'The whole flow is readable in one place and each order has a visible state. The cost: one component knows every step. Compensation on failure is covered in <a href="event-driven-sagas.html">Sagas</a>.', nodes: ['orch'], ok: ['orch'], badges: { orch: ['one history', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'storm', title: 'Peak load: a retry storm', tone: 'warn',
        steps: [
          { text: 'Peak traffic. Inventory slows down and starts timing out. Order retries each call 3 times.', flow: ['gw>ord', 'ord>inv'], hidden: ['orch'], warn: ['inv'], hot: ['inv'], badges: { inv: ['slow', 'warn'], ord: '×3' } },
          { text: 'The gateway also retries failed requests 3 times, and so does the mobile client. <b>3 × 3 × 3 = 27 attempts</b> reach Inventory for one user action.', flow: ['client>gw', 'gw>ord', 'ord>inv'], hidden: ['orch'], err: ['inv'], badges: { gw: '×3', client: '×3', inv: ['27× load', 'err'] }, tone: 'err' },
          { text: 'Inventory was slow; now it is down. It cannot recover because the retries keep it overloaded even after the original spike has passed.', nodes: ['inv'], hidden: ['orch'], err: ['inv', 'ord'], badges: { inv: ['overloaded', 'err'] }, tone: 'err' },
          { text: 'Fix: retry at <b>one layer</b>, cap retries with a <b>budget</b> (for example 10 % of requests), back off exponentially with <b>jitter</b>, and stop when the deadline has passed.', flow: ['ord>inv'], hidden: ['orch'], ok: ['ord'], badges: { ord: ['budget 10 %', 'ok'], gw: ['no retry', 'ok'] }, tone: 'ok' },
          { text: 'A circuit breaker then fails fast while Inventory recovers. Breakers, bulkheads and load shedding are on the <a href="resiliency-patterns.html">Resiliency Patterns</a> page.', flow: ['ord>inv'], hidden: ['orch'], ok: ['inv'], badges: { inv: ['recovering', 'ok'] } }
        ]
      }
    ],

    knobs: {
      intro: 'Four choices for the "place order" flow. Meter values are <em>illustrative</em> judgements, not benchmarks.',
      controls: [
        { id: 'style', label: 'Interaction style', type: 'seg', value: 'grpc', options: [
          { v: 'rest', l: 'Sync REST / JSON' }, { v: 'grpc', l: 'Sync gRPC' }, { v: 'event', l: 'Async events' }, { v: 'cmd', l: 'Async commands (queue)' }] },
        { id: 'coord', label: 'Coordination', type: 'seg', value: 'orch', options: [
          { v: 'choreo', l: 'Choreography / chain' }, { v: 'orch', l: 'Orchestration' }] },
        { id: 'safe', label: 'Call safety', type: 'seg', value: 'full', options: [
          { v: 'none', l: 'No timeouts' }, { v: 'naive', l: 'Timeout + retry everywhere' }, { v: 'full', l: 'Deadline + budget + idempotency' }] },
        { id: 'schema', label: 'Schema changes', type: 'seg', value: 'rules', options: [
          { v: 'free', l: 'Change at will' }, { v: 'rules', l: 'Additive + CI check' }] }
      ],
      evaluate(s) {
        const clamp = (x) => Math.max(0.04, Math.min(0.97, x));
        const sync = s.style === 'rest' || s.style === 'grpc', orch = s.coord === 'orch';
        let lat = { rest: 0.6, grpc: 0.7, event: 0.88, cmd: 0.82 }[s.style] + (sync ? { none: -0.25, naive: -0.08, full: 0 }[s.safe] : 0) + (sync && !orch ? -0.1 : 0);
        let temp = (sync ? 0.3 : 0.85) + { none: -0.15, naive: 0, full: 0.08 }[s.safe] + (sync && !orch ? -0.08 : 0);
        let blast = { none: 0.15, naive: 0.35, full: 0.85 }[s.safe] + (sync ? 0 : 0.1);
        let vis = sync ? (orch ? 0.78 : 0.55) : orch ? 0.86 : s.style === 'event' ? 0.3 : 0.48;
        let con = (s.schema === 'rules' ? 0.8 : 0.25) + { rest: 0, grpc: 0.1, event: -0.05, cmd: 0 }[s.style];
        let ops = { rest: 0.85, grpc: 0.72, event: 0.5, cmd: 0.56 }[s.style] + (orch && !sync ? -0.12 : 0) + (s.safe === 'full' ? -0.05 : 0);
        const metrics = [
          { k: 'Latency for the user', v: sync ? (s.safe === 'none' ? 'unbounded when a dependency hangs' : 'sum of the hops') : 'returns at once; result comes later', s: clamp(lat) },
          { k: 'Temporal coupling', v: temp >= 0.7 ? 'works while others are down' : temp >= 0.3 ? 'all callees must be up' : 'one slow callee stalls all', s: clamp(temp) },
          { k: 'Failure containment', v: blast >= 0.7 ? 'failures stay local' : blast >= 0.3 ? 'retry storms and duplicates' : 'hangs and cascades', s: clamp(blast) },
          { k: 'Flow visibility', v: vis >= 0.7 ? 'one place shows the process' : vis >= 0.45 ? 'follow a trace across services' : 'the flow lives in nobody\'s code', s: clamp(vis) },
          { k: 'Contract safety', v: con >= 0.7 ? 'breaking changes blocked in CI' : 'a rename can break consumers', s: clamp(con) },
          { k: 'Operating complexity', v: s.style === 'rest' ? 'little to run' : s.style === 'grpc' ? 'code generation, HTTP/2-aware proxies' : orch ? 'a broker and a workflow engine' : 'a broker to operate', s: clamp(ops), hint: 'lower bar = more to run' }
        ];
        const notes = [];
        if (s.style === 'rest') notes.push('REST with JSON is the most widely understood option and easy to debug with any HTTP tool. Types are checked only if you publish and test an OpenAPI contract.');
        if (s.style === 'grpc') notes.push('gRPC gives a typed contract from the <code>.proto</code> file, HTTP/2 multiplexing, streaming and a deadline passed down the chain. Browsers need a proxy (gRPC-Web or a REST gateway).');
        if (s.style === 'event') notes.push('Events remove temporal coupling: the caller only needs the broker. The user sees "accepted", so the UI must show a pending state. Consumers must handle duplicates.');
        if (s.style === 'cmd') notes.push('A command on a queue has exactly one logical receiver and can be retried by redelivery. Use it for work that must be done but need not be done now.');
        if (sync && !orch) notes.push('A synchronous chain (A calls B calls C) adds a hop of latency and a point of failure at every link. Prefer one coordinator that calls each service and keeps the chain shallow.');
        if (!sync && !orch) notes.push('Choreography suits loose fan-out. For a multi-step business process, state ends up spread across services; consider an orchestrator.');
        if (s.safe === 'none') notes.push(sync ? 'Without a timeout a slow callee holds the caller\'s threads until the caller is down too.' : 'Without a retry limit and a dead-letter queue, one bad message blocks the consumer for ever.');
        if (s.safe === 'naive') notes.push('Retries at every layer multiply (3 × 3 × 3 = 27). Without idempotency keys each retry may repeat the side effect.');
        if (s.schema === 'free') notes.push('The provider cannot see its consumers\' code. Renaming or re-typing a field breaks them at run time, often after the provider\'s tests passed.');
        let verdict;
        if (s.safe === 'none') verdict = '❌ <b>Unsafe.</b> ' + (sync ? 'A remote call with no timeout turns one slow service into an outage.' : 'Messages are retried for ever and handled twice: add retry limits, a dead-letter queue and idempotent consumers.');
        else if (s.safe === 'naive') verdict = '⚠ <b>Retries without limits or idempotency:</b> expect retry storms under load and duplicate side effects.';
        else if (s.schema === 'free') verdict = '⚠ <b>Calls are safe, contracts are not.</b> Add a compatibility check before the first consumer breaks in production.';
        else if (sync && !orch) verdict = '👍 <b>Safe calls, but a call chain.</b> Keep it to two or three hops, or let one service coordinate.';
        else if (!sync && !orch) verdict = '👍 <b>Good for fan-out.</b> If this becomes a multi-step process with a deadline, add an orchestrator.';
        else if (sync) verdict = '✅ <b>Sound synchronous design:</b> one coordinator, one deadline, bounded retries, idempotent providers, checked contracts.';
        else verdict = '✅ <b>Sound asynchronous design:</b> the caller depends only on the broker, the process is visible in the orchestrator, and repeats are harmless.';
        const hide = [];
        if (!orch || sync) hide.push('orch');
        if (s.safe !== 'full') hide.push('idem');
        const labels = {
          pay: { label: 'Payment', sub: s.style === 'rest' ? 'REST · POST /payments' : s.style === 'grpc' ? 'gRPC · Capture()' : s.style === 'cmd' ? 'reads its queue' : 'reads events' },
          inv: { label: 'Inventory', sub: s.style === 'rest' ? 'REST · POST /reservations' : s.style === 'grpc' ? 'gRPC · Reserve()' : s.style === 'cmd' ? 'reads its queue' : 'reads events' },
          broker: s.style === 'cmd' ? { label: 'Work queues', sub: 'one receiver each' } : { label: 'Kafka', sub: 'order.events' },
          ord: { label: 'Order service', sub: sync ? (orch ? 'calls each in turn' : 'starts a call chain') : 'publishes and returns' },
          idem: sync ? { label: 'Idempotency keys', sub: 'key → result' } : { label: 'Processed ids', sub: 'dedupe on message id' }
        };
        let flow;
        if (sync) flow = orch ? ['client>gw', 'gw>ord', 'ord>pay', 'pay>ord', 'ord>inv', 'inv>ord'] : ['client>gw', 'gw>ord', 'ord>pay', 'pay>inv', 'inv>pay', 'pay>ord'];
        else if (orch) flow = ['client>gw', 'gw>ord', 'ord>orch', 'orch>pay', 'orch>inv', 'ord>broker', ['broker>ship', 'broker>notif']];
        else flow = ['client>gw', 'gw>ord', 'ord>broker', ['broker>ship', 'broker>notif']];
        const badges = {};
        if (s.safe === 'none') badges[sync ? 'pay' : 'ship'] = [sync ? 'no timeout' : 'retries for ever', 'err'];
        if (s.safe === 'naive') badges[sync ? 'pay' : 'ship'] = ['duplicates', 'warn'];
        if (s.safe === 'naive' && sync) badges.gw = ['×3 retries', 'warn'];
        if (s.safe === 'full') badges.gw = ['deadline 2 s', 'ok'];
        if (s.schema === 'free') badges.notif = ['parse error?', 'warn'];
        if (!sync) badges.client = ['202 Accepted', 'info'];
        return {
          metrics, verdict, notes: notes.slice(0, 4), labels, hide, flow, badges,
          err: s.safe === 'none' ? [sync ? 'pay' : 'ship'] : [],
          warn: (s.safe === 'naive' ? [sync ? 'pay' : 'ship'] : []).concat(s.schema === 'free' ? ['notif'] : []),
          ok: s.safe === 'full' ? ['idem'] : [],
          hot: sync && !orch ? ['pay'] : []
        };
      }
    },

    widget: {
      title: 'Call lab: timeouts, retries, backoff and idempotency keys',
      caption: 'Send a burst of "charge the card" requests to a server and choose how the caller behaves. Each row is one request; each bar is one attempt. A bar cut off by the <b>timeout</b> keeps running on the server (faded), which may still charge the card. Add <b>retries</b> and watch duplicates appear, then turn on the <b>idempotency key</b>. The same random traffic is replayed for every setting so you can compare.'
    },

    realWorld: {
      intro: 'Most of the rules on this page were written down by people who run very large call graphs. The sources below are the ones worth quoting in an interview.',
      timeline: [
        { when: '2003', who: 'Gregor Hohpe & Bobby Woolf', title: 'Enterprise Integration Patterns', text: 'The messaging vocabulary still in use: command, document and event messages, request-reply over two channels, and the <b>Correlation Identifier</b>: each reply carries the id of the request it answers, so the requester can match them.', src: 0 },
        { when: '2014', who: 'James Lewis & Martin Fowler', title: 'Smart endpoints and dumb pipes', text: 'Their microservices article argues for simple transports (HTTP request/response or a lightweight message bus) with the logic in the services, in contrast to an enterprise service bus that routes and transforms. It also warns that remote calls are more expensive than in-process calls, so APIs must be coarser.', src: 1 },
        { when: '2015', who: 'Marc Brooker, AWS', title: 'Exponential Backoff and Jitter', text: 'Simulations of many clients contending for one resource. Plain exponential backoff still leaves clients retrying in synchronised waves. Adding randomness (<b>jitter</b>) spreads them out and sharply reduces both the work clients do and the load on the server. "Full jitter" sleeps a random time between zero and the capped exponential value.', src: 2 },
        { when: '2016', who: 'Netflix', title: 'Conductor: orchestration over choreography', text: 'Netflix open-sourced Conductor, a workflow orchestrator. Its authors wrote that with peer-to-peer task choreography they found it harder to scale with growing business needs and complexity, so they moved process flows into an explicit orchestrator.', src: 3 },
        { when: '2016', who: 'Google SRE', title: 'Addressing cascading failures', text: 'The SRE book names overload as the most common cause of cascading failures and warns that retries can amplify a low error rate into much higher traffic. Its advice includes limiting retries, retrying at one level of the stack, and propagating deadlines so servers stop work nobody is waiting for.', src: 4 },
        { when: '2017', who: 'Stripe', title: 'Idempotency keys', text: 'Brandur Leach describes how the Stripe API accepts an <code>Idempotency-Key</code> header on mutating requests. The server saves the status code and body of the first request for a key and returns the same result for repeats, so a client can safely retry after a network failure.', src: 5 },
        { when: '2019', who: 'AWS Builders\' Library', title: 'Timeouts, retries, and backoff with jitter', text: 'Amazon\'s guidance: choose timeouts from the downstream service\'s latency metrics; cap retries because retries at several layers multiply load; use capped exponential backoff with jitter; and do not retry operations with side effects unless the API is idempotent.', src: 6 },
        { when: 'docs', who: 'gRPC', title: 'Deadlines', text: 'By default a gRPC call has no deadline, so a client can wait indefinitely; the project\'s guidance is to always set one. When it passes, the call ends with <code>DEADLINE_EXCEEDED</code>. Servers should check for cancellation and pass the remaining time on to the calls they make.', src: 7 },
        { when: 'docs', who: 'Protocol Buffers · Confluent', title: 'Schema evolution rules', text: 'Protobuf: never reuse a field number; when you delete a field, mark its number and name <code>reserved</code>. Confluent Schema Registry checks each new schema version against a compatibility mode; the default, <b>BACKWARD</b>, means consumers on the new schema can read data written with the previous one.', src: 8 }
      ],
      lessons: [
        'Sync when the caller <b>needs the answer</b>; async when it only needs the work <b>to happen</b>.',
        'A timeout means <b>unknown</b>, not failed: make every retried operation idempotent.',
        'One <b>deadline</b> for the request; retries at <b>one layer</b>, capped, with jitter.',
        'Events for fan-out; an <b>orchestrator</b> when a process must be seen and finished.',
        'Change schemas <b>additively</b> and check compatibility in CI.'
      ],
      sources: [
        { title: 'Correlation Identifier', url: 'https://www.enterpriseintegrationpatterns.com/CorrelationIdentifier.html', pub: 'Gregor Hohpe & Bobby Woolf, Enterprise Integration Patterns' },
        { title: 'Microservices: a definition of this new architectural term', url: 'https://www.martinfowler.com/articles/microservices.html', pub: 'James Lewis & Martin Fowler, 2014' },
        { title: 'Exponential Backoff And Jitter', url: 'https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/', pub: 'Marc Brooker, AWS Architecture Blog, 2015' },
        { title: 'Netflix Conductor: a microservices orchestrator (news report)', url: 'https://www.infoq.com/news/2016/12/netflix-conductor', pub: 'InfoQ, December 2016' },
        { title: 'Addressing Cascading Failures (SRE book, chapter 22)', url: 'https://sre.google/sre-book/addressing-cascading-failures/', pub: 'Google, Site Reliability Engineering, 2016' },
        { title: 'Designing robust and predictable APIs with idempotency', url: 'https://stripe.com/blog/idempotency', pub: 'Brandur Leach, Stripe, 2017' },
        { title: 'Timeouts, retries, and backoff with jitter', url: 'https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter', pub: 'Marc Brooker, Amazon Builders\' Library' },
        { title: 'Deadlines', url: 'https://grpc.io/docs/guides/deadlines/', pub: 'gRPC documentation' },
        { title: 'Language Guide (proto 3)', url: 'https://protobuf.dev/programming-guides/proto3/', pub: 'Protocol Buffers documentation' },
        { title: 'Schema Evolution and Compatibility', url: 'https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html', pub: 'Confluent documentation' },
        { title: 'Proto Best Practices', url: 'https://protobuf.dev/best-practices/dos-donts/', pub: 'Protocol Buffers documentation' },
        { title: 'A Collection of Best Practices for Production Services (SRE book, appendix B)', url: 'https://sre.google/sre-book/service-best-practices/', pub: 'Google, Site Reliability Engineering, 2016' },
        { title: 'Idempotent requests', url: 'https://docs.stripe.com/api/idempotent_requests', pub: 'Stripe API reference' },
        { title: 'Reliable gRPC services with deadlines and cancellation', url: 'https://learn.microsoft.com/aspnet/core/grpc/deadlines-cancellation', pub: 'Microsoft Learn' }
      ]
    },

    tradeoffs: {
      headers: ['Decision', 'Option A', 'Option B', 'Pick when…'],
      rows: [
        ['Timing', '<b>Synchronous</b>: answer now; simple to reason about; both sides must be up', '<b>Asynchronous</b>: sender moves on; survives outages; result arrives later', 'Sync if the user or caller cannot proceed without the answer; async for everything else'],
        ['Sync protocol', '<b>REST / JSON</b>: universal, human-readable, cacheable; loose typing', '<b>gRPC / protobuf</b>: typed contract, compact, streaming, deadlines built in', 'REST at the public edge and for simple CRUD; gRPC between internal services with many calls'],
        ['Message type', '<b>Event</b>: a fact; many unknown consumers; sender expects nothing', '<b>Command</b>: a request to one receiver; may be refused', 'Event for "this happened"; command when a specific service must act'],
        ['Coordination', '<b>Choreography</b>: no central part; easy to add consumers; flow is implicit', '<b>Orchestration</b>: flow explicit and visible; one component knows all steps', 'Choreography for notifications and fan-out; orchestration for processes with steps, deadlines and money'],
        ['Where retries live', '<b>In the application</b>: knows what is idempotent', '<b>In the proxy / mesh</b> (Envoy): uniform, no code', 'One place only. Proxy for safe reads; application for writes, with idempotency keys'],
        ['Breaking change', '<b>New version side by side</b> (<code>v2</code> package, path or topic)', '<b>Evolve in place</b>, additively', 'Evolve additively by default; a new version only when a change cannot be made compatible']
      ]
    },
    failures: [
      { f: 'Missing timeout', detect: 'Thread or connection pools at their limit; latency of the caller tracks its slowest dependency', fix: 'A timeout on every remote call, derived from a propagated deadline; alert on calls without one in code review or lint.' },
      { f: 'Retry storm', detect: 'Traffic to a failing service rises as it fails; recovery takes far longer than the original fault', fix: 'Retry at one layer, at most 2 or 3 attempts, with exponential backoff and jitter, and a retry budget; add a circuit breaker.' },
      { f: 'Duplicate side effect', detect: 'Double charges or double emails after timeouts, deploys or consumer rebalances', fix: 'Idempotency key on every mutating call; store key and result with the effect; dedupe on message id in consumers.' },
      { f: 'Chatty call chain', detect: 'Traces with dozens of spans for one screen; p99 latency is the sum of many p99s', fix: 'Coarser APIs, batch endpoints, local read copies fed by events; revisit the service boundary.' },
      { f: 'Breaking schema change', detect: 'Consumers fail to parse or silently read defaults right after a provider deploy', fix: 'Additive changes only; reserved field numbers; compatibility check in CI; consumer-driven contract tests.' },
      { f: 'Event used as a command', detect: 'The publisher has alerts on whether a particular consumer processed its "event"', fix: 'Model it as a command to that service, or call it; keep events for facts.' },
      { f: 'Invisible choreography', detect: 'Nobody can draw the flow; stuck business processes are found by customers', fix: 'Trace ids on every message, a process-level deadline and alert, or move the flow into an orchestrator.' }
    ],

    interview: [
      { q: 'When do you choose synchronous and when asynchronous communication?', a: '<p>I ask one question per interaction: <b>does the caller need the answer to continue?</b></p><ul><li><b>Yes</b> (a price, an authorisation, a validation): synchronous request/reply. It is simple and the user gets a definite answer, but caller and callee are coupled in time and their availabilities multiply.</li><li><b>No</b> (send an email, update a search index, start shipping): asynchronous. The caller depends only on the broker, load is smoothed, and a slow consumer delays only its own work.</li></ul><p>Most real flows are mixed: a short synchronous core and an asynchronous tail.</p>', lvl: 'core' },
      { q: 'REST or gRPC between services?', a: '<p><b>REST/JSON over HTTP</b>: universal, easy to inspect, works with browsers, caches and every gateway. Contracts are optional (OpenAPI) and payloads are larger.</p><p><b>gRPC</b>: a required typed contract in protobuf, generated clients, HTTP/2 multiplexing, streaming in both directions, and deadlines and cancellation as first-class concepts. It needs a proxy for browsers and is harder to debug by hand.</p><p>My usual split: REST at the public edge, gRPC for internal service-to-service calls where there are many of them and latency matters. The <a href="api-design.html">API Design page</a> covers both in depth.</p>', lvl: 'core' },
      { q: 'What is the difference between an event, a command and a query in messaging?', a: '<p>A <b>query</b> asks for data and changes nothing. A <b>command</b> asks one named receiver to do something; it is imperative (<code>ReserveStock</code>) and can be rejected. An <b>event</b> states a fact in the past tense (<code>OrderPlaced</code>); the publisher does not know the consumers and expects nothing back.</p><p>The distinction decides coupling. With a command the sender depends on the receiver. With an event the receiver depends on the sender\'s schema. A warning sign is an "event" the sender monitors to make sure someone acted on it: that is a command in disguise.</p>', lvl: 'core' },
      { q: 'Choreography or orchestration?', a: '<p><b>Choreography</b>: services react to each other\'s events. No central component, easy to extend, low coupling. But the process is implicit, hard to monitor, and cycles creep in.</p><p><b>Orchestration</b>: a coordinator (a workflow engine such as Temporal, or simply one service) sends commands and tracks state. The flow is explicit, testable and has one place to ask "where is it stuck?". The coordinator must be kept free of other services\' business logic.</p><p>I use choreography for fan-out and notifications, and orchestration when the process has ordered steps, deadlines or compensation. Detail and code are on the <a href="event-driven-sagas.html">Sagas page</a>.</p>', lvl: 'core' },
      { q: 'A call to another service timed out. What do you know, and what do you do?', a: '<p>I know only that <b>no reply arrived in time</b>. The request may never have arrived, may be in progress, or may have succeeded with the reply lost.</p><p>So: if the operation is <b>idempotent</b> (a read, or a write with an idempotency key), retry with backoff while the deadline allows. If it is not, do not blindly retry; either make it idempotent or query its state first. If the deadline has passed, stop and return an honest "unknown" or "pending" to the caller, then reconcile in the background.</p>', fu: 'How would you make a "charge card" call idempotent?', lvl: 'core' },
      { q: 'How do you set timeouts in a chain of services?', a: '<p>Start from the user: the edge sets one <b>deadline</b> for the whole request, say 2 s. Every hop passes on the time that is left (gRPC does this with the <code>grpc-timeout</code> header; over HTTP you carry a header yourself). Each service uses <code>min(own limit, time left)</code> for its calls and gives up early if too little remains.</p><p>For the per-call limit I look at the callee\'s latency distribution and pick a high percentile such as p99.9, as the AWS Builders\' Library suggests, so healthy calls are rarely cut off. Fixed timeouts chosen independently per hop are the common mistake: an inner hop waits longer than its caller is prepared to.</p>', lvl: 'deep' },
      { q: 'What makes a retry policy safe?', a: '<ul><li>Retry only <b>idempotent</b> operations and only <b>retryable</b> errors (timeouts, unavailable, throttled), never validation or business errors.</li><li><b>Few attempts</b>: 2 or 3.</li><li><b>Exponential backoff with jitter</b>, so clients do not retry in waves.</li><li><b>One layer</b> retries. Three layers with three attempts each put 27 times the load on the last service.</li><li>A <b>retry budget</b>: retries may be at most a fraction of normal traffic, for example 10 %.</li><li>Respect the <b>deadline</b>.</li></ul><p>Then a circuit breaker for when the callee is really down: see <a href="resiliency-patterns.html">Resiliency Patterns</a>.</p>', lvl: 'core' },
      { q: 'How does an idempotency key work on the server?', a: '<p>The client creates a unique key per logical operation and sends the same key on every retry. The server:</p><ol><li>Tries to insert the key into a table with a unique constraint, in the <b>same transaction</b> as the business change.</li><li>If the insert succeeds, it does the work and stores the response under the key.</li><li>If the key already exists, it returns the stored response and does nothing else.</li></ol><p>Details that matter: store a hash of the request and reject a key reused with a different body; handle the concurrent case (the second request waits for or is refused while the first is in progress); expire keys after the retry window. Stripe\'s API is the well-known public example.</p>', lvl: 'deep' },
      { q: 'How do you change a message or API schema without breaking consumers?', a: '<ul><li><b>Add, do not change</b>: new fields are optional with defaults. Never rename, re-type or reuse a field. In protobuf, mark removed field numbers <code>reserved</code>.</li><li><b>Tolerant readers</b>: consumers ignore unknown fields and do not fail on missing optional ones.</li><li><b>Check it</b>: a schema registry compatibility mode (BACKWARD so new consumers read old data, FORWARD so old consumers read new data) or a CI tool; plus consumer-driven contract tests.</li><li><b>Truly breaking change</b>: publish a new version side by side, migrate consumers, then retire the old one.</li></ul><p>Deployment order follows from the mode: with BACKWARD, upgrade consumers first.</p>', fu: 'Which side do you deploy first for a new required field?', lvl: 'deep' },
      { q: 'How do you do request/reply over a message broker, and should you?', a: '<p>The requester sends a message with a <b>reply-to</b> address and a <b>correlation id</b>; the responder sends the reply to that address with the same id; the requester matches them. It is the Request-Reply and Correlation Identifier patterns from Enterprise Integration Patterns.</p><p>It buys buffering and decoupling from the responder\'s location, but the requester still waits, so it keeps the temporal coupling and adds the broker to the path. I use it when the work is long-running or the responder is often offline. For a quick query a direct call with a deadline is simpler.</p>', lvl: 'deep' },
      { q: 'Design the communication for "place order" across Order, Payment, Inventory, Shipping and Notification.', a: '<p><b>Synchronous core</b>: client → gateway → Order. Order authorises payment (gRPC, deadline, idempotency key) because the user needs a yes or no. Stock was reserved earlier or is reserved in the same step.</p><p><b>Asynchronous tail</b>: Order commits and publishes <code>OrderPlaced</code> through an outbox. Shipping and Notification consume it independently and idempotently.</p><p><b>Coordination</b>: if capture, reservation and shipping must all complete or be undone, I run them as an orchestrated saga with a process deadline. <b>Contracts</b>: protobuf and AsyncAPI in a registry with compatibility checks. <b>Observability</b>: one trace id across calls and messages.</p>', lvl: 'deep' },
      { q: 'Tell me about a time you fixed a problem caused by how services talked to each other.', a: '<p><em>Sample story with illustrative numbers. Swap in your own experience.</em><br><b>Situation</b>: during a promotion a slow recommendations service took down checkout, because checkout called it synchronously with a 30 s default timeout and the gateway retried failures three times. <b>Task</b>: stop a non-critical dependency from failing a critical flow. <b>Action</b>: I traced the call graph, classified each call as "needed now" or "nice to have", put a 300 ms timeout and a fallback on recommendations, removed retries from the gateway for POST requests, added an idempotency key to the payment call so the one remaining retry was safe, and moved "send confirmation" to an event. I wrote a short call policy and added a lint check for clients without timeouts. <b>Result</b>: in the next promotion recommendations degraded again and checkout stayed up; duplicate-charge tickets went to zero.</p>', lvl: 'deep' }
    ],

    code: [
      {
        title: 'gRPC proto: a versioned contract that can evolve', lang: 'proto',
        code: `// payments/v1/payments.proto
syntax = "proto3";

package shop.payments.v1;          // major version lives in the package name

service Payments {
  // Safe to retry: the server deduplicates on idempotency_key.
  rpc Capture(CaptureRequest) returns (CaptureResponse);
}

message CaptureRequest {
  reserved 3;                      // was card_number; a field number is never reused
  reserved "card_number";

  string order_id        = 1;
  int64  amount_cents    = 2;      // integer minor units, never float
  string payment_token   = 4;
  string idempotency_key = 5;
  string currency        = 6;      // added later: old clients send "", server assumes EUR
}

message CaptureResponse {
  enum Status {
    STATUS_UNSPECIFIED = 0;        // what an old reader sees for a value it does not know
    STATUS_CAPTURED    = 1;
    STATUS_DECLINED    = 2;
  }
  string payment_id = 1;
  Status status     = 2;
}

// Compatible:  add a field with a new number, add an enum value, add an rpc.
// Breaking:    change a field's type or number, rename the package or service,
//              reuse a reserved number. Those need shop.payments.v2 side by side.`,
        note: 'The same rules apply to Avro or JSON Schema events: add optional fields, never repurpose old ones. A CI step such as <code>buf breaking</code> or a schema registry compatibility check turns the rules into a failing build.'
      },
      {
        title: 'Go: gRPC client with a deadline, bounded retries and an idempotency key', lang: 'go',
        code: `// Go 1.22+, google.golang.org/grpc 1.63+
package orders

// payments_retry.json is a gRPC service config:
// {"methodConfig":[{"name":[{"service":"shop.payments.v1.Payments"}],
//   "retryPolicy":{"maxAttempts":3,"initialBackoff":"0.1s","maxBackoff":"1s",
//     "backoffMultiplier":2,"retryableStatusCodes":["UNAVAILABLE"]}}]}
//
//go:embed payments_retry.json
var retryConfig string

func NewPayments(target string, creds credentials.TransportCredentials) (paymentsv1.PaymentsClient, error) {
	conn, err := grpc.NewClient(target,
		grpc.WithTransportCredentials(creds),
		grpc.WithDefaultServiceConfig(retryConfig)) // retries happen here, and only here
	if err != nil {
		return nil, err
	}
	return paymentsv1.NewPaymentsClient(conn), nil
}

func Capture(ctx context.Context, c paymentsv1.PaymentsClient, orderID string, cents int64) error {
	// Never longer than the caller's own deadline: WithTimeout keeps the earlier one.
	ctx, cancel := context.WithTimeout(ctx, 800*time.Millisecond)
	defer cancel()

	key := "capture:" + orderID // same key on every attempt
	_, err := c.Capture(ctx, &paymentsv1.CaptureRequest{
		OrderId: orderID, AmountCents: cents, IdempotencyKey: key,
	})
	switch status.Code(err) {
	case codes.OK:
		return nil
	case codes.DeadlineExceeded:
		return ErrOutcomeUnknown // the charge may have happened: reconcile with the same key
	default:
		return err // e.g. FailedPrecondition for a declined card: do not retry
	}
}`,
        note: 'gRPC applies the backoff with jitter itself and stops retrying when the context deadline passes. Passing <code>ctx</code> down is what propagates the deadline: the server sees the time left in the <code>grpc-timeout</code> header. Imports are omitted; <code>go:embed</code> needs <code>import _ "embed"</code>.'
      },
      {
        title: 'Java (Spring Boot): idempotent POST with an Idempotency-Key', lang: 'java',
        code: `// Spring Boot 3.4+, Java 21, Postgres 15+
// CREATE TABLE idempotency_keys (key text PRIMARY KEY, request_hash text NOT NULL,
//   status int, body text, created_at timestamptz NOT NULL DEFAULT now());
@RestController
class PaymentController {
  private final JdbcClient jdbc;
  private final PaymentService payments;
  private final ObjectMapper json;
  PaymentController(JdbcClient jdbc, PaymentService payments, ObjectMapper json) {
    this.jdbc = jdbc; this.payments = payments; this.json = json;
  }
  record Stored(String requestHash, Integer status, String body) {}

  @PostMapping("/payments")
  @Transactional   // key row and charge commit together, or neither does
  public ResponseEntity<String> capture(@RequestHeader("Idempotency-Key") String key,
                                        @RequestBody CaptureRequest req) throws Exception {
    String hash = HexFormat.of().formatHex(
        MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(req)));

    int claimed = jdbc.sql("""
        INSERT INTO idempotency_keys (key, request_hash) VALUES (?, ?)
        ON CONFLICT (key) DO NOTHING""").params(key, hash).update();

    if (claimed == 0) {                         // a repeat: replay, do not charge again
      Stored first = jdbc.sql(
          "SELECT request_hash, status, body FROM idempotency_keys WHERE key = ?")
          .param(key).query(Stored.class).single();
      if (!first.requestHash().equals(hash))
        return ResponseEntity.unprocessableEntity().body("key reused with a different request");
      return ResponseEntity.status(first.status()).body(first.body());
    }

    String body = json.writeValueAsString(payments.capture(req));   // the side effect
    jdbc.sql("UPDATE idempotency_keys SET status = 201, body = ? WHERE key = ?")
        .params(body, key).update();
    return ResponseEntity.status(201).body(body);
  }
}`,
        note: 'A concurrent second request with the same key blocks on the unique index until the first transaction ends, then sees the stored result (or, after a rollback, runs as the first). The call to the external payment provider inside <code>capture</code> must itself carry the key, because it cannot join this transaction.'
      }
    ],

    related: ['event-driven-sagas', 'api-design', 'resiliency-patterns', 'ms-service-boundaries', 'ms-data', 'service-mesh', 'sd:message-queue']
  });
})();

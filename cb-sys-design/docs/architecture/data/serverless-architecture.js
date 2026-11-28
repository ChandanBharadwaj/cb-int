(function () {
  // Illustrative list prices (AWS Lambda, x86, common US regions, as published in 2025). Check the current price page.
  const P_REQ = 0.20 / 1e6;            // $ per request
  const P_GBS = 0.0000166667;          // $ per GB-second
  const MONTH_S = 2628000;             // seconds in an average month
  const m = (v) => {
    const rps = v.req / MONTH_S, peakRps = rps * v.peak;
    const conc = peakRps * v.dur / 1000;                       // Little's law: L = lambda x W
    const perReq = P_REQ + (v.dur / 1000) * (v.mem / 1024) * P_GBS;
    const fn = v.req * perReq;
    const inst = Math.max(2, Math.ceil(peakRps / v.vmrps));    // at least 2 for availability
    const on = inst * v.vm;
    return { rps, peakRps, conc, perReq, fn, inst, on };
  };
  const usd = (x) => '$' + (x >= 1000 ? Math.round(x).toLocaleString('en-US') : x >= 10 ? x.toFixed(0) : x.toFixed(2));
  const big = (x) => (x >= 1e9 ? (x / 1e9).toFixed(1) + ' B' : x >= 1e6 ? (x / 1e6).toFixed(1) + ' M' : x >= 1e4 ? Math.round(x / 1e3) + ' k' : x >= 100 ? Math.round(x).toLocaleString('en-US') : x >= 1 ? x.toFixed(1) : x.toFixed(2));

  SD.register({
    slug: 'serverless-architecture',
    domain: 6,
    title: 'Serverless & Event-Driven Compute',
    examples: 'AWS Lambda, Cloud Run, Azure Functions',
    tagline: 'Hand the provider your code or container and pay <b>only while it runs</b>. It scales from <b>zero</b> to thousands of instances by itself. In return you accept <b>cold starts</b>, hard limits, at-least-once events and a database that can drown in connections.',
    tldr: {
      problem: 'Most services sit idle most of the time, yet you pay for servers around the clock and still have to patch them, size them and scale them. Spiky or rare workloads make this worse: capacity for the peak is wasted the rest of the day.',
      idea: 'Let the platform run one <b>instance per unit of demand</b>. A <b>function</b> handles one event at a time; a <b>serverless container</b> handles many requests per instance. With no traffic the platform keeps <b>zero</b> instances, and you are billed by requests and milliseconds, not by server hours.',
      insight: 'Serverless trades a <b>fixed cost for a variable one</b>, and trades control for limits. It wins when traffic is low or spiky. It loses when load is steady and high, when latency must be consistently low, or when every instance opens its own connection to a relational database.',
      numbers: [
        { v: '1,000', l: 'default concurrent executions per region on AWS Lambda; can be raised (AWS docs)' },
        { v: '15 min', l: 'maximum run time of one Lambda invocation: 900 s, not adjustable (AWS docs)' },
        { v: '80', l: 'default concurrent requests per Cloud Run instance; up to 1,000 (Google Cloud docs)' }
      ]
    },

    intro: {
      what: '<b>Serverless</b> means you deploy code and the cloud provider owns the servers: it starts instances when requests arrive, adds more under load, and removes them all when it is quiet. There are still servers, but you do not manage or pay for idle ones. <b>Event-driven</b> means the code runs in response to something that happened: an HTTP request, a message on a queue, a file upload, a timer.',
      analogy: {
        icon: '🚕',
        title: 'Taxi instead of owning a car',
        text: 'A car you own costs money every day, even parked. A taxi costs nothing until you ride, then you pay per kilometre at a higher rate. If you travel rarely, the taxi is far cheaper. If you drive all day, every day, owning wins. And sometimes you wait a few minutes for the taxi to arrive: that wait is the <b>cold start</b>. The comparison is fair on cost and waiting, but a taxi does not forget everything between rides, while a function instance may.'
      },
      problem: 'An image-resize service is busy for ten minutes after each marketing email and idle the rest of the week. Sized for the peak, it wastes money all week. Sized for the average, it falls over on the peak. The question this page answers is <b>when should compute scale to zero and bill per request, and what does that choice cost you elsewhere?</b>',
      story: [
        {
          stage: 'naive',
          title: 'Servers sized for the peak',
          text: 'Run a fixed fleet big enough for the busiest hour. It is simple to reason about and responses are always fast, because every server is already running with warm caches and open database connections.',
          scene: {
            nodes: [
              { id: 'u', label: 'Traffic', sub: 'spiky, mostly idle', kind: 'client', at: [210, 0] },
              { id: 'app', label: '6 servers', sub: 'always on', kind: 'service', at: [210, 110] },
              { id: 'db', label: 'Postgres', sub: '6 small pools', kind: 'store', at: [210, 220] }
            ],
            edges: [{ from: 'u', to: 'app' }, { from: 'app', to: 'db' }],
            flow: ['u>app', 'app>db'],
            badges: { app: ['paid 24 × 7', 'info'] }
          }
        },
        {
          stage: 'breaks',
          title: 'Idle most of the day, short at the peak',
          text: 'For most of the day the fleet is mostly idle and still fully paid for. When a spike is bigger than planned, autoscaling new servers takes minutes and requests fail meanwhile. Someone also has to patch and right-size all of it.',
          scene: {
            nodes: [
              { id: 'u', label: 'Traffic', sub: '10× spike', kind: 'client', at: [210, 0] },
              { id: 'app', label: '6 servers', sub: 'overloaded', kind: 'service', at: [210, 110] },
              { id: 'db', label: 'Postgres', sub: 'fine', kind: 'store', at: [210, 220] }
            ],
            edges: [{ from: 'u', to: 'app' }, { from: 'app', to: 'db' }],
            flow: ['u>app'],
            err: ['app'], warn: ['u'],
            badges: { app: ['idle 90%, then 503s', 'err'] }
          }
        },
        {
          stage: 'fix',
          title: 'Instances follow demand, down to zero',
          text: 'The platform starts an instance when an event arrives and adds more as concurrency grows. When it is quiet it keeps none. You pay per request. A pooler in front of the database keeps hundreds of short-lived instances from each opening a connection.',
          scene: {
            nodes: [
              { id: 'u', label: 'Traffic', sub: 'events + requests', kind: 'client', at: [210, 0] },
              { id: 'f1', label: 'Instance', sub: 'started on demand', kind: 'compute', at: [70, 110] },
              { id: 'f2', label: 'Instance', sub: 'added under load', kind: 'compute', at: [210, 110] },
              { id: 'f0', label: '(none)', sub: 'zero when idle', kind: 'compute', at: [350, 110] },
              { id: 'p', label: 'DB pooler', sub: 'few real connections', kind: 'edge', at: [140, 220] },
              { id: 'db', label: 'Postgres', sub: 'protected', kind: 'store', at: [350, 220] }
            ],
            edges: [{ from: 'u', to: 'f1' }, { from: 'u', to: 'f2' }, { from: 'u', to: 'f0', dashed: true }, { from: 'f1', to: 'p' }, { from: 'f2', to: 'p' }, { from: 'p', to: 'db' }],
            flow: [['u>f1', 'u>f2'], ['f1>p', 'f2>p'], 'p>db'],
            ok: ['f1', 'f2', 'db'],
            badges: { f0: ['$0 idle', 'ok'], p: ['pooled', 'ok'] }
          }
        }
      ],
      usedBy: ['AWS Lambda', 'Google Cloud Run', 'Azure Functions', 'AWS Fargate', 'Cloudflare Workers', 'Knative (open source, on Kubernetes)'],
      whenToUse: [
        'Traffic is <b>spiky, rare or unpredictable</b>: webhooks, scheduled jobs, internal tools, new products with unknown demand',
        '<b>Event glue</b>: react to a file upload, a queue message or a database change with a small piece of code',
        'A small team wants to <b>ship without running servers</b> or clusters, and can live inside the platform\'s limits'
      ],
      whenNot: [
        '<b>Steady, high load</b>: an always-on container fleet is cheaper per request. Work out the crossover with <a href="finops.html">FinOps</a> numbers',
        '<b>Strict low latency on every request</b> with a slow-starting runtime, or long-lived connections and in-memory state',
        'Work that runs for hours, needs GPUs or special hardware, or a team that already runs Kubernetes well: see <a href="container-patterns.html">container patterns</a>'
      ],
      glossary: [
        { term: 'Function as a Service (FaaS)', def: 'You deploy a single function; the platform runs one instance per concurrent event and bills per request and duration.' },
        { term: 'Serverless container', def: 'You deploy a container image; the platform scales the number of instances with traffic, each handling many requests at once.' },
        { term: 'Scale to zero', def: 'With no traffic the platform keeps no instances running, so the compute cost is zero.' },
        { term: 'Cold start', def: 'The extra delay when a request needs a new instance: fetch the code, start the runtime, run your initialisation.' },
        { term: 'Concurrency', def: 'The number of requests being handled at the same moment; it decides how many instances exist.' },
        { term: 'Provisioned / minimum instances', def: 'Instances you pay to keep warm so that some requests never see a cold start.' },
        { term: 'Event source', def: 'What triggers the code: HTTP gateway, queue, stream, object-storage notification, schedule.' },
        { term: 'At-least-once delivery', def: 'The platform may deliver the same event more than once, so handlers must be idempotent.' }
      ]
    },

    requirements: {
      functional: [
        '<b>Stateless instances</b>: any instance can vanish; state lives in a database, cache or object store (<a href="twelve-factor.html">twelve-factor</a> processes)',
        '<b>Fast, cheap start-up</b>: small package, lazy or snapshotted initialisation, no heavy work per cold start',
        '<b>Idempotent handlers</b>: every event may arrive twice; a duplicate must have no extra effect',
        '<b>Bounded concurrency</b>: a cap per function so a burst cannot exhaust the database or a downstream API',
        '<b>Pooled data access</b>: a connection pooler, an HTTP data API or a store built for many short connections',
        '<b>Failures are routed, not lost</b>: retries with backoff, then a dead-letter queue with alerting'
      ],
      nonFunctional: [
        'Cold-start p99 inside the latency budget, e.g. &lt; 1 s for user-facing paths (<em>example target</em>)',
        'Cost follows traffic: near $0 at zero requests; reviewed against the always-on alternative every quarter',
        'Database connections stay below 80% of the limit at peak concurrency (<em>rule of thumb</em>)',
        'Zero duplicate business effects in redelivery tests',
        'Dead-letter queue depth alerted at &gt; 0; oldest unprocessed event age tracked per queue',
        'Deploy to production in minutes, with instant rollback to the previous version'
      ],
      outOfScope: [
        '<b>Lambda pinball</b>: logic scattered over dozens of functions that call each other synchronously',
        '<b>A function per HTTP route by default</b>: more cold starts and deploy units, no benefit',
        '<b>Opening a database connection per invocation</b> with no pooler',
        '<b>Assuming exactly-once events</b> or ordering the source does not promise',
        '<b>"Serverless is always cheaper"</b>: never checking the crossover as traffic grows'
      ]
    },

    calculator: {
      inputs: [
        { id: 'req', label: 'Requests per month', min: 10000, max: 10000000000, value: 5000000, log: true, fmt: 'num' },
        { id: 'dur', label: 'Average duration per request', min: 5, max: 5000, value: 120, log: true, unit: 'ms' },
        { id: 'mem', label: 'Memory per function instance', min: 128, max: 4096, value: 512, step: 128, unit: 'MB' },
        { id: 'peak', label: 'Peak ÷ average traffic', min: 1, max: 50, value: 5 },
        { id: 'vm', label: 'One always-on instance, per month', min: 10, max: 500, value: 60, unit: '$' },
        { id: 'vmrps', label: 'Requests/s one always-on instance handles', min: 5, max: 2000, value: 150, log: true }
      ],
      outputs: [
        { label: 'Average load · peak concurrency (function instances)', fmt: 'raw', f: (v) => { const x = m(v); return big(x.rps) + ' req/s · ' + big(Math.max(1, Math.ceil(x.conc))) + ' at once'; } },
        { label: 'Pay-per-use bill per month', fmt: 'raw', f: (v) => usd(m(v).fn) },
        { label: 'Always-on fleet for the peak (min 2 instances)', fmt: 'raw', f: (v) => { const x = m(v); return x.inst + ' × ' + usd(v.vm) + ' = ' + usd(x.on) + ' · ' + Math.max(1, Math.round(x.rps / (x.inst * v.vmrps) * 100)) + '% used on average'; } },
        { label: 'Which is cheaper at this traffic', fmt: 'raw', f: (v) => { const x = m(v); const r = x.fn / x.on; return r < 1 ? 'pay-per-use, ' + (1 / r >= 10 ? Math.round(1 / r) : (1 / r).toFixed(1)) + '× cheaper' : 'always-on, ' + (r >= 10 ? Math.round(r) : r.toFixed(1)) + '× cheaper'; } },
        { label: 'Crossover against the 2-instance minimum', fmt: 'raw', f: (v) => { const x = m(v); const be = 2 * v.vm / x.perReq; return big(be) + ' requests / month (' + big(be / MONTH_S) + ' req/s average)'; } },
        { label: 'Database connections at peak, one per function instance', fmt: 'raw', f: (v) => { const c = Math.max(1, Math.ceil(m(v).conc)); return big(c) + (c > 100 ? ' ⚠ over Postgres default of 100' : ' (Postgres default limit: 100)'); } }
      ],
      note: 'Pay-per-use cost = requests × (request fee + duration × memory × GB-second fee), using <em>illustrative</em> AWS Lambda x86 list prices as published in 2025 ($0.20 per million requests, $0.0000166667 per GB-second). The free tier, gateway fees, data transfer and provisioned concurrency are left out; check the current price page. Peak concurrency uses Little\'s law: requests per second × duration. The always-on side assumes at least two instances for availability and a fleet sized for the peak. It ignores the engineering time to run that fleet, which for a small team is often the larger number. Drag <b>Requests per month</b> up to watch the answer flip.'
    },

    api: [
      { m: 'ADR', p: 'ADR: Compute model per workload', d: 'For each service: functions, serverless containers or always-on. Recorded with the traffic shape, the latency budget, the cost crossover and the trigger for revisiting the choice (e.g. average above 30 req/s).' },
      { m: 'EVENT', p: 'Queue event envelope', d: '<code>id</code> (stable, used as the dedupe key), <code>type</code>, <code>source</code>, <code>time</code>, <code>data</code>. The handler contract says: may arrive more than once, may arrive out of order unless the source is a FIFO queue or a partitioned stream.' },
      { m: 'YAML', p: 'Function / service configuration', d: 'Memory, timeout, <b>maximum concurrency</b>, minimum instances, retry count, dead-letter target, batch size and whether partial batch failures are reported. These settings are part of the design, not deployment detail.' },
      { m: 'POLICY', p: 'Cold-start budget', d: 'User-facing paths: p99 cold start under 1 s, enforced by a start-up test in CI. JVM services must use a snapshot (SnapStart / CRaC), a native image, or minimum instances.' },
      { m: 'SQL', p: 'Connection budget', d: 'Per database: <code>max_connections</code>, the share each service may use, and the pooler in front. Reserved concurrency × connections per instance must fit the share.' },
      { m: 'SLO', p: 'Event processing', d: '99% of queue events processed within 30 s; dead-letter depth 0 at end of day; duplicate-effect rate 0 in the weekly redelivery test.' }
    ],
    dataModel: [
      { name: 'processed_event', store: 'Postgres', fields: [['handler', 'text', 'pk'], ['event_id', 'text', 'pk'], ['processed_at', 'timestamptz', 'idx']], note: 'Insert with <code>ON CONFLICT DO NOTHING</code> in the same transaction as the effect. No row inserted means the event is a duplicate. Purge after the source\'s redelivery window.' },
      { name: 'function_config', store: 'Infrastructure as code', fields: [['name', 'text', 'pk'], ['memory_mb', 'int'], ['timeout_s', 'int'], ['max_concurrency', 'int'], ['min_instances', 'int'], ['dlq', 'text'], ['runtime', 'text']], note: 'One row per deployable. <code>max_concurrency</code> is the knob that protects everything downstream.' },
      { name: 'cost_per_workload', store: 'FinOps report', fields: [['workload', 'text', 'pk'], ['month', 'date', 'pk'], ['requests', 'bigint'], ['gb_seconds', 'numeric'], ['cost_usd', 'numeric'], ['always_on_estimate_usd', 'numeric']], note: 'Tracks the crossover over time. When the pay-per-use bill passes the always-on estimate for a few months, revisit the ADR.' }
    ],

    architecture: {
      title: 'Request path, event path, and the database behind both',
      nodes: [
        { id: 'client', label: 'Clients', sub: 'web · mobile', kind: 'client', wide: [90, 170], tall: [70, 0], tip: 'Synchronous callers. They feel cold starts directly as latency.' },
        { id: 'gw', label: 'HTTP gateway', sub: 'auth · throttle', kind: 'edge', wide: [290, 170], tall: [70, 105], tip: 'Terminates TLS, authenticates and throttles. Has its own timeout, usually shorter than the function\'s.' },
        { id: 'fn', label: 'Functions', sub: '1 request per instance', kind: 'compute', wide: [500, 40], tall: [70, 210], tip: 'Function as a Service. The platform runs one instance per concurrent request, so 300 requests in flight means 300 instances.' },
        { id: 'ctr', label: 'Serverless container', sub: 'many requests each', kind: 'compute', wide: [500, 170], tall: [210, 210], tip: 'A container image scaled by the platform, such as Cloud Run or Knative. One instance serves many concurrent requests, so fewer instances and fewer cold starts.' },
        { id: 'snap', label: 'Warm capacity', sub: 'snapshot · min instances', kind: 'cache', wide: [710, 40], tall: [70, 315], tip: 'Ways to hide cold starts: restore from a memory snapshot, compile to a native image, or pay to keep some instances ready.' },
        { id: 'obj', label: 'Event sources', sub: 'uploads · schedule · CDC', kind: 'external', wide: [90, 300], tall: [210, 0], tip: 'Things that emit events: object storage, schedulers, database change streams, other services.' },
        { id: 'q', label: 'Queue / event bus', sub: 'at-least-once', kind: 'queue', wide: [290, 300], tall: [210, 105], tip: 'Buffers events and drives the workers. May deliver an event more than once. Absorbs bursts so workers can run at a capped concurrency.' },
        { id: 'wfn', label: 'Worker functions', sub: 'batch · idempotent', kind: 'compute', wide: [500, 300], tall: [350, 210], tip: 'Asynchronous handlers pulled from the queue in batches. Cold starts matter little here; duplicates and poison messages matter a lot.' },
        { id: 'dlq', label: 'Dead-letter queue', sub: 'failed after retries', kind: 'queue', wide: [290, 410], tall: [350, 105], tip: 'Events that failed every retry are parked here with the error, so they stop blocking others and are not lost.' },
        { id: 'pool', label: 'Connection pooler', sub: 'many in · few out', kind: 'edge', wide: [710, 170], tall: [210, 315], tip: 'PgBouncer, RDS Proxy or similar. Thousands of short-lived client connections share a small set of real database connections.' },
        { id: 'db', label: 'Postgres', sub: 'max_connections', kind: 'store', wide: [910, 170], tall: [210, 420], tip: 'Each Postgres connection is a process with real memory. The default limit is 100. It does not scale the way functions do.' }
      ],
      edges: [
        { from: 'client', to: 'gw' },
        { from: 'gw', to: 'fn' },
        { from: 'gw', to: 'ctr' },
        { from: 'fn', to: 'snap', dashed: true },
        { from: 'obj', to: 'q' },
        { from: 'ctr', to: 'q', dashed: true },
        { from: 'q', to: 'wfn' },
        { from: 'q', to: 'dlq', dashed: true },
        { from: 'fn', to: 'pool' },
        { from: 'ctr', to: 'pool' },
        { from: 'wfn', to: 'pool' },
        { from: 'pool', to: 'db' }
      ]
    },

    scenarios: [
      {
        id: 'warm', title: 'Warm request', tone: 'ok',
        steps: [
          { text: 'A request arrives at the gateway. An instance that served a request a moment ago is still alive and idle: a <b>warm</b> instance.', flow: ['client>gw', 'gw>fn'], ok: ['fn'], badges: { fn: ['warm', 'ok'] } },
          { text: 'The handler runs at once. Objects created at start-up, such as the HTTP client and the database connection, are <b>reused</b> from the previous invocation.', flow: ['fn>pool', 'pool>db'], ok: ['pool', 'db'], badges: { fn: 'reuses connection' } },
          { text: 'The response returns in normal time. You are billed for this request and its duration. When requests stop, the platform keeps the instance for a while, then removes it.', flow: ['db>pool', 'pool>fn', 'fn>gw', 'gw>client'], ok: ['client'], badges: { client: ['fast', 'ok'] }, tone: 'ok' },
          { text: 'After a quiet period there are <b>zero</b> instances and the compute bill is zero. The price of that comes on the next request.', nodes: ['fn'], labels: { fn: { label: 'Functions', sub: '0 instances' } }, badges: { fn: ['scaled to zero', 'info'] } }
        ]
      },
      {
        id: 'cold', title: 'Cold start from zero', tone: 'warn',
        steps: [
          { text: 'A request arrives and no instance is free. The platform must create one: allocate a sandbox, fetch the code or image, start the runtime.', flow: ['client>gw', 'gw>fn'], warn: ['fn'], labels: { fn: { label: 'Functions', sub: 'creating instance…' } }, badges: { fn: ['cold start', 'warn'] }, tone: 'warn' },
          { text: 'Then <b>your</b> initialisation runs: load classes, build the dependency-injection context, open connections. For a JVM with Spring Boot this is commonly the largest part, often seconds.', nodes: ['fn'], warn: ['fn', 'client'], badges: { fn: ['init: your code', 'warn'], client: ['waiting…', 'warn'] }, tone: 'warn' },
          { text: 'Only now does the handler run. The user saw start-up time plus normal time. Under a burst, <b>every new instance</b> pays this, so a traffic spike shows up as a latency spike.', flow: ['fn>pool', 'pool>db', 'fn>gw', 'gw>client'], badges: { client: ['slow first hit', 'warn'] } },
          { text: 'Fix 1: restore from a <b>snapshot</b> taken after initialisation (Lambda SnapStart, CRaC), or compile a <b>native image</b> that starts in milliseconds.', flow: ['snap>fn'], ok: ['snap', 'fn'], badges: { snap: ['restore, not boot', 'ok'] }, tone: 'ok' },
          { text: 'Fix 2: pay for <b>minimum / provisioned instances</b> that stay warm, or use a serverless container so one instance absorbs many requests. Each fix costs money or build complexity.', flow: ['gw>ctr'], ok: ['ctr', 'snap'], badges: { ctr: ['80 requests / instance', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'conn', title: 'Burst exhausts the database', tone: 'err',
        steps: [
          { text: 'A push notification sends 600 users to the app in the same second. The platform does its job: it starts about <b>600 function instances</b>.', flow: ['client>gw', 'gw>fn'], hot: ['fn'], hidden: ['pool'], badges: { fn: ['600 instances', 'warn'] }, tone: 'warn' },
          { text: 'Each instance opens its own database connection. Postgres allows 100 by default, and each one is a server process. Connection 101 is refused: <code>too many clients already</code>.', flow: ['fn>db'], err: ['db'], hidden: ['pool'], badges: { db: ['100 / 100', 'err'] }, tone: 'err' },
          { text: 'Requests fail, clients retry, more instances start. The compute tier scaled perfectly and <b>moved the bottleneck</b> to the one component that cannot scale that way.', flow: ['client>gw', 'gw>fn', 'fn>db'], err: ['db', 'fn'], hidden: ['pool'], badges: { fn: ['500s + retries', 'err'] }, tone: 'err' },
          { text: 'Fix 1: a <b>connection pooler</b>. Instances connect to the pooler; it shares a small set of real connections, one per active transaction.', flow: ['fn>pool', 'pool>db'], ok: ['pool', 'db'], badges: { pool: ['600 in → 40 out', 'ok'] }, tone: 'ok' },
          { text: 'Fix 2: <b>cap concurrency</b> for the function and put a queue in front of work that can wait. The cap is the back-pressure that the platform does not apply for you.', flow: ['ctr>q', 'q>wfn', 'wfn>pool'], ok: ['q', 'wfn'], badges: { wfn: ['max 20 at once', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'event', title: 'Duplicate and poison events', tone: 'warn',
        steps: [
          { text: 'A file upload emits an event to the queue. A worker function receives a batch of 10 messages.', flow: ['obj>q', 'q>wfn'], badges: { wfn: 'batch of 10' } },
          { text: 'The worker processes message 7 and writes the result, then times out before the batch is acknowledged. The queue makes the messages visible again and <b>redelivers</b> them.', flow: ['wfn>pool', 'pool>db', 'q>wfn'], warn: ['wfn'], badges: { wfn: ['same event again', 'warn'] }, tone: 'warn' },
          { text: 'The handler inserts the event ID into a <code>processed_event</code> table in the same transaction as its effect. The insert conflicts, so the duplicate is <b>skipped</b>.', flow: ['wfn>pool', 'pool>db'], ok: ['db', 'wfn'], badges: { db: ['duplicate → skip', 'ok'] }, tone: 'ok' },
          { text: 'Message 3 is malformed and fails every time. Reporting <b>partial batch failure</b> returns only that one to the queue. After the retry limit it moves to the <b>dead-letter queue</b>.', flow: ['q>dlq'], warn: ['dlq'], badges: { dlq: ['1 parked', 'warn'] }, tone: 'warn' },
          { text: 'An alert fires on dead-letter depth. Someone fixes the cause and replays the message. The other nine were never blocked.', flow: ['dlq>q', 'q>wfn'], ok: ['wfn', 'q'], badges: { wfn: ['replayed', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'cost', title: 'Traffic grows past the crossover', tone: 'info',
        steps: [
          { text: 'The product succeeds. Traffic is no longer spiky: it is hundreds of requests per second, day and night. Functions are busy almost all the time.', flow: ['client>gw', 'gw>fn'], hot: ['fn'], badges: { fn: ['busy 24 × 7', 'warn'] } },
          { text: 'Pay-per-use now means paying the per-millisecond premium on every millisecond. An always-on fleet at 60% utilisation would cost a fraction. The <b>crossover</b> has been passed.', nodes: ['fn'], warn: ['fn'], badges: { fn: ['bill ↑ linear', 'warn'] }, tone: 'warn' },
          { text: 'Move the steady, hot path to a <b>serverless container</b> with minimum instances, or to an always-on cluster. The code is packaged as a container, so the handler logic does not change.', flow: ['gw>ctr', 'ctr>pool', 'pool>db'], ok: ['ctr'], badges: { ctr: ['steady path', 'ok'] }, tone: 'ok' },
          { text: 'Keep functions for what they are best at: spiky event handlers, scheduled jobs, glue. Most mature systems end up with <b>both</b>, chosen per workload.', flow: ['obj>q', 'q>wfn'], ok: ['wfn', 'ctr'], badges: { wfn: ['spiky path', 'ok'] }, tone: 'ok' }
        ]
      }
    ],

    knobs: {
      intro: 'Each control is a real choice for one workload. Meter values and start-up times are <em>illustrative</em> orders of magnitude, not benchmarks; measure your own service.',
      controls: [
        { id: 'model', label: 'Compute model', type: 'seg', value: 'faas', options: [
          { v: 'faas', l: 'Functions (FaaS)' }, { v: 'sc', l: 'Serverless containers' }, { v: 'k8s', l: 'Always-on containers' }] },
        { id: 'traffic', label: 'Traffic shape', type: 'seg', value: 'spiky', options: [
          { v: 'spiky', l: 'Spiky, mostly idle' }, { v: 'steady', l: 'Steady and high' }] },
        { id: 'rt', label: 'Runtime', type: 'seg', value: 'jvm', options: [
          { v: 'jvm', l: 'JVM + Spring Boot' }, { v: 'py', l: 'Node / Python' }, { v: 'go', l: 'Go / Rust' }] },
        { id: 'cold', label: 'Cold-start mitigation', type: 'seg', value: 'none', options: [
          { v: 'none', l: 'None' }, { v: 'snap', l: 'Snapshot / native image' }, { v: 'warm', l: 'Minimum instances' }] },
        { id: 'dbc', label: 'Database access', type: 'seg', value: 'pool', options: [
          { v: 'direct', l: 'Direct connections' }, { v: 'pool', l: 'Pooler / proxy' }] }
      ],
      evaluate(s) {
        const clamp = (x) => Math.max(0.03, Math.min(0.97, x));
        const M = s.model, steady = s.traffic === 'steady', R = s.rt, C = s.cold, pooled = s.dbc === 'pool';
        const on = M === 'k8s';
        // worst-case start-up delay a user can see, in seconds (illustrative)
        let boot = { jvm: 4, py: 0.5, go: 0.15 }[R] + (M === 'sc' ? 0.5 : 0);
        if (C === 'snap') boot = R === 'jvm' ? 0.4 : R === 'py' ? 0.3 : boot;
        const coldS = on ? 0.95 : C === 'warm' ? 0.8 : clamp(1 - boot / 5);
        const coldV = on ? 'none for users; a new pod takes ~' + Math.round(boot + 15) + ' s' : C === 'warm' ? 'none up to the warm pool, then ~' + boot + ' s' : '~' + boot + ' s on a new instance';
        let cost = on ? (steady ? 0.85 : 0.28) : M === 'faas' ? (steady ? 0.25 : 0.93) : (steady ? 0.6 : 0.85);
        if (C === 'warm') cost -= on ? 0.08 : steady ? 0.03 : 0.2;
        const costV = cost >= 0.8 ? 'low for this traffic' : cost >= 0.5 ? 'fair' : steady ? 'high: premium on every millisecond' : 'high: paying for idle capacity';
        const ops = { faas: 0.9, sc: 0.8, k8s: 0.35 }[M] - (C === 'snap' ? 0.08 : 0);
        let dbr = pooled ? 0.9 : { faas: steady ? 0.2 : 0.1, sc: 0.55, k8s: 0.82 }[M];
        const dbV = pooled ? 'bounded by the pooler' : M === 'faas' ? 'one connection per concurrent request' : M === 'sc' ? 'one small pool per instance, instances vary' : 'fixed pools, known total';
        let scale = { faas: 0.9, sc: 0.75, k8s: 0.4 }[M] - { jvm: 0.15, py: 0.04, go: 0 }[R] + (C === 'snap' && R !== 'go' ? 0.1 : 0) + (C === 'warm' ? 0.06 : 0);
        const port = { faas: 0.3, sc: 0.75, k8s: 0.88 }[M];
        const metrics = [
          { k: 'Cold start a user can see', v: coldV, s: coldS },
          { k: 'Cost at this traffic', v: costV, s: clamp(cost) },
          { k: 'Operations burden', v: ops >= 0.75 ? 'low: no servers or cluster' : ops >= 0.5 ? 'medium' : 'high: you run the cluster', s: clamp(ops) },
          { k: 'Database connection risk', v: dbV, s: clamp(dbr) },
          { k: 'Reaction to a burst', v: scale >= 0.8 ? 'seconds, per request' : scale >= 0.55 ? 'seconds to tens of seconds' : 'minutes: new pods, maybe new nodes', s: clamp(scale) },
          { k: 'Portability', v: port >= 0.8 ? 'high: plain containers' : port >= 0.6 ? 'good: a container image' : 'low: provider event formats and triggers', s: port }
        ];
        const notes = [];
        if (!on && R === 'jvm' && C === 'none') notes.push('A JVM pays for class loading, JIT warm-up and the Spring context on every cold start. Options: a snapshot (Lambda SnapStart, CRaC), a GraalVM native image, or minimum instances.');
        if (C === 'snap' && R === 'jvm') notes.push('A snapshot is taken <b>after</b> initialisation and restored on start. Anything unique or time-bound captured in it (random seeds, connections, credentials) must be refreshed in an after-restore hook.');
        if (C === 'snap' && R === 'go') notes.push('Go and Rust binaries already start in milliseconds, so a snapshot buys almost nothing here.');
        if (C === 'warm' && !on) notes.push('Minimum instances remove the cold start from zero to one, but a burst beyond the warm pool still starts cold instances. You also pay for them while idle.');
        if (C === 'warm' && on) notes.push('On an always-on fleet, "minimum instances" just means extra replicas: more headroom, more idle cost.');
        if (!pooled && M === 'faas') notes.push('Functions handle one request per instance, so connections grow with concurrency. Without a pooler or a concurrency cap, a burst can exhaust <code>max_connections</code>.');
        if (M === 'faas' && steady) notes.push('At steady high load the function is always busy. You pay the per-millisecond rate around the clock, which is usually several times the cost of a well-used always-on instance.');
        if (on && !steady) notes.push('A fleet sized for the peak sits mostly idle on spiky traffic, and autoscaling pods and nodes reacts in minutes, not seconds.');
        if (M === 'sc') notes.push('Serverless containers run many requests per instance, so they need fewer instances and fewer connections than functions, and the same image runs on Knative or any cluster.');
        let verdict;
        if (!pooled && M === 'faas') verdict = '❌ <b>The database is the first thing to fall over.</b> Add a pooler or proxy and cap the function\'s concurrency.';
        else if (M === 'faas' && steady) verdict = '⚠ <b>Past the cost crossover.</b> Steady, high load belongs on containers; keep functions for the spiky edges.';
        else if (on && !steady) verdict = '⚠ <b>Paying for idle and slow to burst.</b> This traffic shape is what scale-to-zero is for.';
        else if (!on && R === 'jvm' && C === 'none') verdict = '⚠ <b>Multi-second cold starts reach users.</b> Use a snapshot, a native image or minimum instances, or keep this path off scale-to-zero.';
        else if (M === 'sc') verdict = '✅ <b>A balanced default:</b> scale to zero, many requests per instance, a portable image, and cold starts under control.';
        else if (on) verdict = '✅ <b>Right for steady load:</b> predictable latency and the lowest cost per request, in exchange for running the platform.';
        else verdict = '✅ <b>Functions used where they shine:</b> spiky traffic, near-zero idle cost, pooled data access.';
        const labels = {
          fn: { label: 'Functions', sub: M === 'faas' ? '1 request per instance' : 'not used' },
          ctr: on ? { label: 'Container fleet', sub: 'fixed replicas + HPA' } : { label: 'Serverless container', sub: 'many requests each' },
          snap: { label: 'Warm capacity', sub: C === 'snap' ? (R === 'jvm' ? 'snapshot restore' : 'native / small package') : C === 'warm' ? 'minimum instances' : 'none' },
          pool: { label: 'Connection pooler', sub: 'many in · few out' }
        };
        const hide = [];
        if (M === 'faas') hide.push('ctr'); else hide.push('fn');
        if (C === 'none' || M !== 'faas') hide.push('snap');
        if (!pooled) hide.push('pool');
        const main = M === 'faas' ? 'fn' : 'ctr';
        const flow = ['client>gw', 'gw>' + main].concat(pooled ? [main + '>pool', 'pool>db'] : [main + '>db'], ['obj>q', 'q>wfn']);
        const badges = {};
        if (!pooled && M === 'faas') badges.db = ['connections exhausted', 'err'];
        if (!on && C !== 'warm' && boot >= 1) badges[main] = ['cold ~' + boot + ' s', 'warn'];
        if (!on && !steady && C !== 'warm') badges.gw = ['$0 when idle', 'ok'];
        if (M === 'faas' && steady) badges.fn = ['always busy', 'warn'];
        return {
          metrics, verdict, notes: notes.slice(0, 4), labels, hide, flow, badges,
          err: !pooled && M === 'faas' ? ['db'] : [],
          warn: (!on && boot >= 1 && C !== 'warm') || (M === 'faas' && steady) ? [main] : [],
          ok: pooled ? ['pool'] : [],
          hot: steady ? [main] : []
        };
      }
    },

    widget: {
      title: 'Scale-to-zero lab: cold starts, concurrency and database connections',
      caption: 'A live autoscaler. Requests arrive at the rate you set; each needs a free instance slot, or the platform starts a new instance and the request waits for the cold start. Idle instances are removed. Send a <b>burst</b>, switch between a <b>function</b> (1 request per instance) and a <b>container</b> (10 per instance), shorten the cold start, and watch the <b>database connections</b> with and without a pooler.'
    },

    realWorld: {
      intro: 'Most of what is known in public about serverless comes from the providers\' own documentation and papers, plus a few well-known cost stories. Provider limits change, so each figure below names its source.',
      timeline: [
        { when: '2019', who: 'UC Berkeley', title: 'Cloud Programming Simplified: A Berkeley View on Serverless Computing', text: 'Jonas, Schleier-Smith, Sreekanti, Tsai and colleagues, with David Patterson, argued that serverless hands nearly all system administration to the provider and predicted it would grow to dominate cloud computing. The paper also set out the open problems, among them start-up latency and the poor fit for fine-grained state sharing.', src: 0 },
        { when: '2020', who: 'AWS', title: 'Firecracker (NSDI \'20)', text: 'AWS published the design of <b>Firecracker</b>, an open-source virtual machine monitor built for serverless workloads and deployed in Lambda and Fargate. It is the isolation layer that makes one small microVM per function instance practical.', src: 1 },
        { when: '2022 → 2024', who: 'AWS', title: 'Lambda SnapStart', text: 'SnapStart launched for Java in November 2022, described by AWS as reducing start-up latency by up to 10×: Lambda snapshots the initialised function and restores it instead of booting. It was extended to Python and .NET in November 2024. Runtime hooks (CRaC for Java) let code run before the snapshot and after a restore.', src: 2 },
        { when: '2022', who: 'Google Cloud', title: 'Cloud Run: startup CPU boost joins minimum instances', text: 'Google describes two separate levers: <b>minimum instances</b> remove the zero-to-one cold start, and <b>startup CPU boost</b> gives a container extra CPU while it starts, to shorten cold starts when scaling out. Neither removes them entirely.', src: 4 },
        { when: '2023', who: 'Amazon Prime Video', title: 'A monitoring service leaves Step Functions and Lambda', text: 'Prime Video\'s video-quality monitoring tool moved from a pipeline of Step Functions and Lambda functions to a single process on ECS. InfoQ reported the team\'s figure of more than 90% lower infrastructure cost. The lesson is narrow and useful: for a constantly busy, data-heavy pipeline, per-transition and per-invocation pricing was the wrong fit.', src: 5 },
        { when: 'Aug 2025', who: 'AWS', title: 'Lambda bills the INIT phase for all functions', text: 'From 1 August 2025 the initialisation phase of a cold start is included in billed duration for every Lambda configuration; before that, ZIP-packaged functions on managed runtimes were not charged for it. Slow start-up is now a cost as well as a latency problem.', src: 6 },
        { when: 'docs', who: 'AWS', title: 'Lambda limits that shape designs', text: 'Per the Lambda documentation: 1,000 concurrent executions per region by default (new accounts may start lower), a 900-second maximum timeout that cannot be raised, and each function can add up to 1,000 execution environments every 10 seconds.', src: 7 },
        { when: 'docs', who: 'AWS', title: 'RDS Proxy for functions', text: 'AWS built RDS Proxy for the connection problem: it pools and <b>multiplexes</b> many client connections over fewer database connections, per transaction. The docs also describe <b>pinning</b>, where session state forces a client to keep one connection and the benefit is lost.', src: 8 },
        { when: 'docs', who: 'Spring · Knative', title: 'Portable building blocks', text: 'Spring Boot documents checkpoint/restore with <b>CRaC</b> (including an automatic checkpoint at start-up via <code>-Dspring.context.checkpoint=onRefresh</code>). Knative documents <b>scale to zero</b> for containers on any Kubernetes cluster, which is the open-source answer to lock-in.', src: 10 }
      ],
      lessons: [
        'Serverless is a <b>pricing and operations model</b>. Decide per workload, with the crossover written down.',
        '<b>Cold start = platform time + your init time.</b> You control the second: small package, snapshot, native image.',
        'Compute scales; <b>a relational database does not</b>. Pool connections and cap concurrency.',
        'Every event source is <b>at-least-once</b>. Idempotency and a dead-letter queue are not optional.',
        'Keep business logic free of provider types so a function can become a container when traffic grows.'
      ],
      sources: [
        { title: 'Cloud Programming Simplified: A Berkeley View on Serverless Computing', url: 'https://arxiv.org/abs/1902.03383', pub: 'Jonas et al., UC Berkeley, 2019' },
        { title: 'Firecracker: Lightweight Virtualization for Serverless Applications', url: 'https://www.usenix.org/conference/nsdi20/presentation/brooker-firecracker', pub: 'Agache, Brooker et al., USENIX NSDI 2020' },
        { title: 'Under the hood: how AWS Lambda SnapStart optimizes function startup latency', url: 'https://aws.amazon.com/blogs/compute/under-the-hood-how-aws-lambda-snapstart-optimizes-function-startup-latency', pub: 'AWS Compute Blog' },
        { title: 'Improving startup performance with Lambda SnapStart', url: 'https://docs.aws.amazon.com/lambda/latest/dg/snapstart.html', pub: 'AWS Lambda Developer Guide' },
        { title: 'New startup CPU boost improves cold starts in Cloud Run, Cloud Functions', url: 'https://cloud.google.com/blog/products/serverless/announcing-startup-cpu-boost-for-cloud-run--cloud-functions', pub: 'Google Cloud Blog, 2022' },
        { title: 'Prime Video Switched from Serverless to EC2 and ECS to Save Costs', url: 'https://infoq.com/news/2023/05/prime-ec2-ecs-saves-costs', pub: 'InfoQ, May 2023' },
        { title: 'AWS Lambda standardizes billing for INIT Phase', url: 'https://aws.amazon.com/blogs/compute/aws-lambda-standardizes-billing-for-init-phase', pub: 'AWS Compute Blog, 2025' },
        { title: 'Lambda quotas', url: 'https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html', pub: 'AWS Lambda Developer Guide' },
        { title: 'RDS Proxy concepts and terminology', url: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.howitworks.html', pub: 'Amazon RDS User Guide' },
        { title: 'Using Amazon RDS Proxy with AWS Lambda', url: 'https://aws.amazon.com/blogs/compute/using-amazon-rds-proxy-with-aws-lambda', pub: 'AWS Compute Blog' },
        { title: 'Checkpoint and Restore With the JVM', url: 'https://docs.spring.io/spring-boot/reference/packaging/checkpoint-restore.html', pub: 'Spring Boot reference documentation' },
        { title: 'Scale to zero', url: 'https://knative.dev/docs/serving/autoscaling/scale-to-zero/', pub: 'Knative documentation' },
        { title: 'Maximum concurrent requests for services', url: 'https://docs.cloud.google.com/run/docs/about-concurrency', pub: 'Google Cloud Run documentation' },
        { title: 'Cloud Run min instances: Minimize your serverless cold starts', url: 'https://cloud.google.com/blog/products/serverless/cloud-run-adds-min-instances-feature-for-latency-sensitive-apps', pub: 'Google Cloud Blog' },
        { title: 'Lambda scaling behavior', url: 'https://docs.aws.amazon.com/lambda/latest/dg/scaling-behavior.html', pub: 'AWS Lambda Developer Guide' },
        { title: 'AWS Lambda pricing', url: 'https://aws.amazon.com/lambda/pricing/', pub: 'AWS' }
      ]
    },

    tradeoffs: {
      headers: ['Decision', 'Option A', 'Option B', 'Pick when…'],
      rows: [
        ['Unit of deployment', '<b>Function</b>: one event per instance, per-ms billing, tight limits', '<b>Serverless container</b>: many requests per instance, any runtime, portable image', 'Functions for event handlers and glue. Containers for HTTP services, heavy runtimes and anything you may move later'],
        ['Serverless or always-on', '<b>Scale to zero</b>: variable cost, cold starts', '<b>Always-on</b>: fixed cost, steady latency', 'Scale to zero below the crossover or when traffic is unpredictable. Always-on for steady load and strict latency'],
        ['Cold-start fix', '<b>Snapshot / native image</b>: fast start, build and compatibility work', '<b>Minimum instances</b>: no code change, pay for idle', 'Snapshot or native for JVM services with bursts. Minimum instances when the baseline is known and small'],
        ['JVM start-up', '<b>Snapshot (SnapStart, CRaC)</b>: keeps the JIT and normal Java, restore hooks needed', '<b>GraalVM native image</b>: tiny start and memory, long builds, reflection limits', 'Snapshot first: least change. Native when memory footprint also matters and the libraries support it'],
        ['Database access', '<b>Pooler / proxy</b> in front of Postgres', '<b>HTTP data API or serverless-native store</b>', 'Pooler when you keep a relational database. A connectionless API or key-value store for very high fan-out'],
        ['Sync or async', '<b>Synchronous</b>: caller waits, cold start is visible', '<b>Queue in front</b>: caller gets 202, worker runs at capped concurrency', 'Async for anything that can wait: it hides cold starts and gives back-pressure for free']
      ]
    },
    failures: [
      { f: 'Connection storm on the database', detect: '"too many clients" errors rising with function concurrency; DB connection count at its limit', fix: 'Connection pooler or proxy; reserved concurrency sized to the connection budget; one connection per instance, opened outside the handler.' },
      { f: 'Cold-start latency spikes', detect: 'p99 far above p50; init duration in traces; spikes after deploys and quiet periods', fix: 'Trim dependencies and init work; snapshot or native image; minimum instances for the baseline; move heavy paths behind a queue.' },
      { f: 'Duplicate processing', detect: 'Double emails or charges; the same event ID appears twice in logs', fix: 'Dedupe table keyed by event ID in the same transaction as the effect; idempotency keys on external calls.' },
      { f: 'Poison message blocks a batch', detect: 'The same batch retried repeatedly; oldest-message age grows; healthy messages delayed', fix: 'Report partial batch failures; bounded retries; dead-letter queue with alert and replay tooling.' },
      { f: 'Recursive trigger / runaway cost', detect: 'Invocation count and bill climb with no traffic; a function writes to the bucket or topic that triggers it', fix: 'Separate input and output resources; concurrency cap; budget alarms; loop detection where the platform offers it.' },
      { f: 'Function timeout shorter than the work', detect: 'Invocations end at exactly the timeout; partial writes; retries repeat the first half', fix: 'Break the work into steps on a queue or a workflow engine; make each step idempotent; move long jobs to containers.' },
      { f: 'Downstream overwhelmed by scale-out', detect: 'A partner API or legacy service rate-limits or falls over during bursts', fix: 'Queue plus capped worker concurrency; rate limiter; circuit breaker. The platform scales you, not your dependencies.' }
    ],

    interview: [
      { q: 'What does "serverless" actually mean?', a: '<p>Three properties together:</p><ul><li><b>No server management</b>: the provider patches, places and replaces the machines.</li><li><b>Automatic scaling, including to zero</b>: instance count follows demand without you configuring a fleet.</li><li><b>Pay per use</b>: billed by requests and execution time, not by provisioned capacity.</li></ul><p>It is not only functions. Serverless containers, queues, object storage and some databases fit the same definition. A common misreading is "no operations": you still own limits, cold starts, cost and observability.</p>', lvl: 'core' },
      { q: 'Functions versus serverless containers: what is the real difference?', a: '<p><b>Concurrency per instance.</b> A classic function instance handles <b>one request at a time</b>, so instances equal concurrent requests. A serverless container handles <b>many</b>; Cloud Run defaults to 80 per instance.</p><p>Everything else follows: containers need fewer instances, fewer cold starts and fewer database connections; they take any runtime and are portable. Functions have richer event-source integrations, finer billing and less to configure, but tighter limits such as a 15-minute maximum on Lambda.</p><p>My default: containers for HTTP services, functions for event handlers.</p>', lvl: 'core' },
      { q: 'What happens during a cold start, and which part can you influence?', a: '<ol><li>The platform allocates a sandbox (a microVM or container).</li><li>It fetches your code or image.</li><li>The runtime starts (JVM, Node, Python).</li><li><b>Your initialisation</b> runs: class loading, framework start-up, config, clients, connections.</li><li>The handler runs.</li></ol><p>Steps 1–3 belong to the provider; you influence them only through package size and runtime choice. Step 4 is yours and is usually the largest for a JVM service. Cold starts happen on the first request after idle, on every scale-out, and after a deploy.</p>', lvl: 'core' },
      { q: 'How would you reduce cold starts for a Spring Boot service?', a: '<ul><li><b>Snapshot and restore</b>: Lambda SnapStart or CRaC takes a memory image after initialisation and restores it on start. Least code change. You must refresh anything unique in after-restore hooks: connections, credentials, random seeds.</li><li><b>GraalVM native image</b>: ahead-of-time compilation to a binary that starts in milliseconds with less memory. Costs: long builds, reflection configuration, no JIT.</li><li><b>Less work at start-up</b>: fewer starters, lazy beans, no classpath scanning you do not need, initialise clients once outside the handler.</li><li><b>Keep instances warm</b>: provisioned concurrency or minimum instances for the baseline.</li><li><b>Change the shape</b>: a container serving many requests per instance, or a queue in front so nobody waits on the start.</li></ul><p>I would try them roughly in that order and measure init time in traces.</p>', fu: 'What breaks when you restore a snapshot on 500 instances at once?', lvl: 'deep' },
      { q: 'Why do functions and relational databases fit badly, and how do you fix it?', a: '<p>A Postgres connection is a server process with real memory, and the default limit is 100. Function instances handle one request each, so 500 concurrent requests want 500 connections. The compute tier scales in seconds and the database does not.</p><p>Fixes, usually combined:</p><ul><li>A <b>pooler or proxy</b> (PgBouncer in transaction mode, RDS Proxy) so many clients share few real connections.</li><li><b>Cap concurrency</b> so instances × connections fits the budget.</li><li>One connection per instance, created outside the handler and reused.</li><li>Put a <b>queue</b> in front of writes that can wait.</li></ul><p>Watch out for session state such as <code>SET</code> or prepared statements, which can pin a client to one connection and defeat the pooler.</p>', lvl: 'core' },
      { q: 'When does serverless stop being cheaper?', a: '<p>Pay-per-use cost grows <b>linearly with traffic</b>. An always-on fleet is a <b>step function</b>: flat until you need another instance. They cross.</p><p>Per request, a function costs a request fee plus duration × memory × a GB-second rate. Divide the monthly cost of the smallest sensible always-on fleet (two instances) by that, and you get the break-even request count. Below it, or with spiky traffic where the fleet would idle, serverless wins. With steady load that keeps instances well used, always-on usually wins by a multiple.</p><p>I add two things: the engineering cost of running the fleet, and the fact that the answer is per workload, so mixed estates are normal.</p>', lvl: 'core' },
      { q: 'Events are delivered at least once. What does that force you to design?', a: '<ul><li><b>Idempotent handlers</b>: record the event ID in a table in the same transaction as the effect; a conflict means "already done".</li><li><b>Idempotency keys</b> on calls to external systems.</li><li><b>No ordering assumptions</b> unless the source guarantees it (FIFO queue, one stream partition), and then only per key.</li><li><b>Retry policy and dead-letter queue</b> so a bad event is parked and others keep flowing.</li><li><b>Partial batch responses</b> so one failed message does not replay the whole batch.</li></ul><p>"Exactly-once" in practice means at-least-once delivery plus idempotent processing.</p>', lvl: 'core' },
      { q: 'A marketing push creates a 50× burst. Walk through what happens and what you would have put in place.', a: '<p>The gateway accepts the requests. The platform starts many instances at once; each pays a cold start, so latency jumps. Each opens a database connection; the limit is hit; errors trigger client retries, which add load.</p><p>What I would have in place:</p><ul><li><b>Reserved or maximum concurrency</b> per function, sized to what the database and partners can take.</li><li>A <b>pooler</b> in front of the database.</li><li><b>Minimum instances</b> scheduled up before a known campaign.</li><li>Writes and slow work behind a <b>queue</b>, with the API answering 202.</li><li>Gateway <b>throttling</b> with clear 429s and client backoff with jitter.</li></ul><p>The principle: unlimited scale-out upstream needs explicit back-pressure before anything that cannot scale the same way.</p>', lvl: 'deep' },
      { q: 'How do you limit vendor lock-in with serverless?', a: '<p>Lock-in comes less from the compute and more from the <b>event formats, triggers and managed services around it</b>.</p><ul><li>Keep business logic in plain classes; the function handler is a thin adapter that maps the provider\'s event to your types (ports and adapters).</li><li>Prefer <b>container images</b> where practical: the same image runs on Cloud Run, Knative, Fargate or Kubernetes.</li><li>Use open formats at the edges: HTTP, CloudEvents, SQL.</li><li>Keep infrastructure as code so the dependency list is explicit.</li></ul><p>I would also be honest that some lock-in is a fair price for speed. The goal is a known, bounded exit cost, not zero.</p>', lvl: 'core' },
      { q: 'What limits have shaped your designs?', a: '<p>The ones I check first, quoting the provider\'s current docs because they change:</p><ul><li><b>Maximum duration</b>: 15 minutes on Lambda. Longer work becomes steps on a queue or workflow, or moves to containers.</li><li><b>Concurrency quota</b>: 1,000 per region by default on Lambda, shared by all functions unless reserved, so one noisy function can starve the others.</li><li><b>Scale-up rate</b>: how fast new instances may be added.</li><li><b>Payload size</b> and gateway timeouts, usually tighter than the function\'s own.</li><li><b>Ephemeral disk and memory</b> ceilings.</li></ul><p>Each limit is also a design hint: small, short, stateless units.</p>', lvl: 'deep' },
      { q: 'Is serverless a good fit for a low-latency API with a p99 target of 100 ms?', a: '<p>Only with care. Warm invocations can meet it. The risk is the cold start on scale-out and after idle.</p><p>I would look at: a fast-starting runtime or a snapshot; minimum instances covering the normal baseline; a serverless container so one warm instance absorbs bursts of concurrency; and the database path, since connection set-up also costs time.</p><p>If traffic is steady and high, I would not fight the model: an always-on service gives predictable latency and costs less. I would say that plainly and keep functions for the asynchronous work around the API.</p>', lvl: 'deep' },
      { q: 'Your CTO read that Prime Video "abandoned serverless". How do you respond?', a: '<p>I would bring it back to what was published. One team moved one workload, a video-quality monitoring pipeline, from Step Functions and Lambda to a single process on containers and reported a large cost reduction. That workload was <b>constantly busy and moved a lot of data between steps</b>, which is the worst case for per-transition and per-invocation pricing.</p><p>So the lesson is not "serverless is bad"; it is "match the pricing model to the traffic shape". I would show our own numbers per workload: which ones are spiky and cheap on functions, which have crossed over, and a plan to move only those. Deciding from data keeps the conversation calm.</p>', lvl: 'core' }
    ],

    code: [
      {
        title: 'Spring Boot: a function with CRaC hooks for snapshot restore', lang: 'java',
        code: `// Java 21, Spring Boot 3.x, spring-cloud-function, org.crac:crac.
// Runs on Lambda SnapStart or any CRaC-enabled JVM; the handler has no provider types.
public record ResizeRequest(String bucket, String key, int width) {}
public record ResizeResult(String key, long bytes) {}

@Configuration
public class Functions {
  @Bean   // exposed by Spring Cloud Function as "resize"
  public Function<ResizeRequest, ResizeResult> resize(ImageService images) {
    return req -> images.resize(req.bucket(), req.key(), req.width());
  }
}

@Component
public class SnapshotHooks implements org.crac.Resource {
  private final ImageService images;
  private final HikariDataSource dataSource;

  public SnapshotHooks(ImageService images, HikariDataSource dataSource) {
    this.images = images;
    this.dataSource = dataSource;
    org.crac.Core.getGlobalContext().register(this);   // keep a strong reference to this bean
  }

  @Override   // runs once, before the snapshot is taken
  public void beforeCheckpoint(org.crac.Context<? extends org.crac.Resource> ctx) {
    images.warmUp();                         // prime: load classes, JIT the hot path
    dataSource.getHikariPoolMXBean().softEvictConnections();  // no sockets in the image
  }

  @Override   // runs on every instance restored from the snapshot
  public void afterRestore(org.crac.Context<? extends org.crac.Resource> ctx) {
    images.refreshCredentials();             // anything time-bound or unique per instance
    // The pool reconnects lazily. Keep it tiny: one instance serves one request at a time.
  }
}
// application.properties:
//   spring.datasource.hikari.maximum-pool-size=1
//   spring.datasource.hikari.minimum-idle=0
//   spring.main.lazy-initialization=false     (initialise before the snapshot, not after)`,
        note: '<code>ImageService.warmUp()</code> and <code>refreshCredentials()</code> are your own methods. The pattern matters more than the names: do expensive work <b>before</b> the checkpoint, and re-create anything unique or expiring <b>after</b> restore, because every restored instance starts from the same memory image.'
      },
      {
        title: 'Python: idempotent queue handler with partial batch failures', lang: 'python',
        code: `# Python 3.12, AWS Lambda with an SQS trigger (ReportBatchItemFailures enabled), psycopg 3.
import json, os
import psycopg

# Created once per instance, during init, and reused by every invocation.
# DATABASE_URL points at the pooler / proxy, not at Postgres directly.
conn = psycopg.connect(os.environ["DATABASE_URL"], autocommit=False)

def handle(order: dict, cur) -> None:
    cur.execute("UPDATE orders SET status = 'PAID' WHERE id = %s AND status = 'PENDING'",
                (order["order_id"],))

def handler(event, context):
    failures = []
    for record in event["Records"]:
        msg_id = record["messageId"]          # stable across redeliveries of this message
        try:
            with conn.transaction():          # dedupe row + effect commit together
                cur = conn.execute(
                    """INSERT INTO processed_event (handler, event_id)
                       VALUES ('mark-paid', %s) ON CONFLICT DO NOTHING""", (msg_id,))
                if cur.rowcount == 0:
                    continue                  # duplicate delivery: already processed
                handle(json.loads(record["body"]), conn.cursor())
        except Exception as exc:              # leave only this message for a retry
            print(json.dumps({"level": "error", "msg_id": msg_id, "error": str(exc)}))
            failures.append({"itemIdentifier": msg_id})
    # Messages not listed are deleted. Listed ones are retried, then go to the DLQ
    # after the queue's maxReceiveCount.
    return {"batchItemFailures": failures}`,
        note: 'Three habits in one handler: the connection lives <b>outside</b> the handler so warm invocations reuse it; the dedupe insert and the business update share a transaction; and a failed message is reported on its own so the other nine in the batch are not replayed. If the producer may publish the same business event twice, dedupe on an ID from the message body instead of the queue\'s message ID.'
      },
      {
        title: 'Kubernetes YAML: a portable scale-to-zero service (Knative)', lang: 'yaml',
        code: `# Knative Serving v1. The same container image runs on any Kubernetes cluster,
# and with small changes on managed services that follow the Knative API.
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: orders-api
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/min-scale: "0"     # scale to zero when idle
        autoscaling.knative.dev/max-scale: "20"    # cap: 20 instances x pool of 5 = 100 conns
        autoscaling.knative.dev/target: "40"       # aim for 40 in-flight requests per pod
        # keep the last pod a little longer to avoid flapping between 0 and 1
        autoscaling.knative.dev/scale-to-zero-pod-retention-period: "2m"
    spec:
      containerConcurrency: 80                     # hard limit of requests per pod
      timeoutSeconds: 30
      containers:
        - image: registry.example.com/orders-api:1.14.2
          ports:
            - containerPort: 8080
          env:
            - name: DATABASE_URL                   # points at PgBouncer, not Postgres
              valueFrom:
                secretKeyRef: { name: orders-db, key: pooler-url }
            - name: DB_POOL_SIZE
              value: "5"
          resources:
            requests: { cpu: 500m, memory: 512Mi }
            limits:   { memory: 512Mi }
          readinessProbe:                          # traffic only after the app is ready
            httpGet: { path: /actuator/health/readiness, port: 8080 }
            periodSeconds: 1
            failureThreshold: 30`,
        note: 'For a latency-sensitive path set <code>min-scale: "1"</code> or higher: you give up scale-to-zero for that service and keep it for the rest. <code>max-scale</code> times the pool size is your connection budget; write that sum next to the setting, as here.'
      }
    ],

    related: ['finops', 'container-patterns', 'twelve-factor', 'durable-execution', 'event-driven-sagas', 'sd:message-queue', 'sd:api-gateway']
  });
})();

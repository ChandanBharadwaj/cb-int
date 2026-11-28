(function () {
  const ms = (x) => (x >= 10000 ? (x / 1000).toFixed(0) + ' s' : x >= 1000 ? (x / 1000).toFixed(1) + ' s' : Math.round(x) + ' ms');
  const big = (x) => (x >= 100 ? Math.round(x).toLocaleString('en-US') : x >= 10 ? x.toFixed(0) : x.toFixed(1));
  const SNAP = 100;   // snapshot interval used by the calculator

  SD.register({
    slug: 'ms-data',
    domain: 10,
    title: 'Data in Microservices: Database per Service, CQRS & Event Sourcing',
    examples: 'Axon, EventStoreDB, Debezium',
    tagline: 'Each service <b>owns its data</b> and nobody else touches its tables. That removes hidden coupling, and it also removes <b>joins and transactions across services</b>. API composition, CQRS read models and, sometimes, event sourcing are what replace them.',
    tldr: {
      problem: 'When several services read and write the same tables, the schema becomes a shared API that nobody designed: one team\'s column rename breaks another team at runtime. Give each service a private database and the coupling goes, but so do the SQL join and the single ACID transaction.',
      idea: '<b>Database per service</b>: data is reachable only through the owning service\'s API or its published events. For queries across services use <b>API composition</b> (call each owner, join in memory) or a <b>CQRS read model</b> (a separate, query-shaped copy kept up to date from events). <b>Event sourcing</b> stores the events themselves as the source of truth, for the few places that need full history.',
      insight: 'Every pattern here trades <b>one consistent snapshot</b> for <b>independent change</b>. So the real design work is deciding, per query and per business rule, <b>how stale it may be</b>, and keeping every rule that must be instantly consistent <b>inside one service</b>.',
      numbers: [
        { v: '2006', l: 'Werner Vogels (ACM Queue): at Amazon no direct database access is allowed from outside a service' },
        { v: '2005', l: 'Martin Fowler documents the Event Sourcing pattern (December 2005)' },
        { v: '1 + N', l: 'calls to show N rows when composition is done row by row instead of batched (math)' }
      ]
    },

    intro: {
      what: '<b>Database per service</b> means each service keeps its data private: other services may not read or write its tables, only call its API or listen to its events. <b>CQRS</b> (Command Query Responsibility Segregation) means using one model to change data and a separate, query-shaped copy to read it. <b>Event sourcing</b> means storing every change as an event and computing the current state from those events.',
      analogy: {
        icon: '🏥',
        title: 'Hospital departments and their files',
        text: 'The lab, the pharmacy and billing each keep their own files. Nobody walks into the lab and edits its records; they send a request and get a result. To see everything about one patient, a nurse either asks each department (composition) or reads a <b>summary sheet</b> that is updated whenever a department reports something (a read model). The summary is quick to read and can be a few minutes behind. Unlike paper files, the software copy is rebuilt automatically from the reports if it is ever lost.'
      },
      problem: 'An Orders service and a Customers service share one database. A reporting feature in Orders joins straight into the customers table. The Customers team renames a column, and Orders fails in production. Split the database and that cannot happen, but now "show my orders with the customer\'s name and tier" has no join to use. The question is: <b>how do services keep their data private and still answer queries and keep facts consistent across them?</b>',
      story: [
        {
          stage: 'naive',
          title: 'Split the code, share the database',
          text: 'The team splits the monolith into Orders and Customers services but leaves one database. Each service still joins any table it likes. Transactions and reports keep working with no new code, so it feels like a safe first step.',
          scene: {
            nodes: [
              { id: 'ord', label: 'Orders', sub: 'joins customers', kind: 'service', at: [70, 0] },
              { id: 'cust', label: 'Customers', sub: 'owns customers', kind: 'service', at: [350, 0] },
              { id: 'db', label: 'Shared DB', sub: 'all tables', kind: 'store', at: [210, 110] }
            ],
            edges: [{ from: 'ord', to: 'db' }, { from: 'cust', to: 'db' }],
            flow: [['ord>db', 'cust>db']],
            badges: { db: ['one schema', 'info'] }
          }
        },
        {
          stage: 'breaks',
          title: 'The schema is now a hidden shared API',
          text: 'Customers renames a column and deploys. Orders, which nobody thought to check, fails at runtime. A slow report in one service locks rows the other needs. Neither team can change or scale its tables alone: this is a <b>distributed monolith</b>.',
          scene: {
            nodes: [
              { id: 'ord', label: 'Orders', sub: 'query fails', kind: 'service', at: [70, 0] },
              { id: 'cust', label: 'Customers', sub: 'renamed a column', kind: 'service', at: [350, 0] },
              { id: 'db', label: 'Shared DB', sub: 'locks + coupling', kind: 'store', at: [210, 110] }
            ],
            edges: [{ from: 'ord', to: 'db' }, { from: 'cust', to: 'db' }],
            flow: ['cust>db', 'ord>db'],
            err: ['ord'], warn: ['db'],
            badges: { ord: ['column not found', 'err'], db: ['who uses this?', 'warn'] }
          }
        },
        {
          stage: 'fix',
          title: 'Private data, public events, a view for queries',
          text: 'Each service gets its own database. Orders never reads customer tables; it calls the Customers API, or listens to its events. For the "orders with customer details" screen, a small <b>read model</b> subscribes to events from both and keeps a ready-made copy. It is slightly behind, and that is an explicit, measured trade.',
          scene: {
            nodes: [
              { id: 'ord', label: 'Orders', sub: 'own DB', kind: 'service', at: [70, 0] },
              { id: 'cust', label: 'Customers', sub: 'own DB', kind: 'service', at: [350, 0] },
              { id: 'bus', label: 'Events', sub: 'Kafka', kind: 'queue', at: [210, 110] },
              { id: 'view', label: 'Order history', sub: 'read model', kind: 'store', at: [210, 220] }
            ],
            edges: [{ from: 'ord', to: 'bus' }, { from: 'cust', to: 'bus' }, { from: 'bus', to: 'view' }],
            flow: [['ord>bus', 'cust>bus'], 'bus>view'],
            ok: ['view', 'ord', 'cust'],
            badges: { view: ['one local query', 'ok'] }
          }
        }
      ],
      usedBy: ['Amazon (services own their data, per Werner Vogels)', 'Debezium (change data capture feeding read models)', 'Axon Framework (CQRS and event sourcing on the JVM)', 'KurrentDB, formerly EventStoreDB (event store)', 'Kafka with Elasticsearch or Postgres read models'],
      whenToUse: [
        'Several teams need to <b>change and deploy their schemas independently</b>',
        'A screen or report needs data from several services and can be <b>a second or two behind</b> (read model), or is small enough to join through APIs (composition)',
        'A domain needs a <b>complete, replayable history</b> of what happened, such as a ledger or an audit trail (event sourcing)'
      ],
      whenNot: [
        'One team, one deployable: a single database with clear modules is simpler and gives you joins and transactions for free (see <a href="ms-monolith-vs-microservices.html">monolith vs microservices</a>)',
        'Two services that must always change in the same transaction: the <a href="ms-service-boundaries.html">boundary is wrong</a>; merge them instead of adding machinery',
        'Plain CRUD with no audit need: do not event-source it. Company-wide analytics belong in a <a href="data-architecture.html">warehouse or lake</a>, not in service read models'
      ],
      glossary: [
        { term: 'Database per service', def: 'Each service has private storage that only it reads and writes; others go through its API or events.' },
        { term: 'API composition', def: 'Answering a query by calling each service that owns part of the data and joining the results in memory.' },
        { term: 'CQRS', def: 'Command Query Responsibility Segregation: a write model that handles changes and a separate read model shaped for queries.' },
        { term: 'Read model (projection)', def: 'A query-shaped copy of data, built and kept up to date by consuming events.' },
        { term: 'Event sourcing', def: 'Storing every state change as an append-only event and deriving current state by replaying them.' },
        { term: 'Aggregate', def: 'A cluster of data that is always changed together in one transaction, such as an order with its lines.' },
        { term: 'Snapshot', def: 'A saved copy of an aggregate\'s state at some version, so loading it replays only the events after that.' },
        { term: 'Eventual consistency', def: 'Copies of data may differ for a short time but converge once all events are processed.' }
      ]
    },

    requirements: {
      functional: [
        '<b>One owner per piece of data</b>: only the owning service writes it, and only through its own code',
        '<b>No reading other services\' tables</b>: integrate through APIs and published events',
        '<b>Transactions stay inside one service</b>; rules that must hold instantly live in one aggregate',
        '<b>Published events are a contract</b>, versioned separately from the private schema',
        '<b>Read models are disposable</b>: they can always be rebuilt from the events',
        '<b>Projections are idempotent and ordered per key</b>, because events arrive at least once'
      ],
      nonFunctional: [
        'A service can change its schema and deploy with no other team involved',
        'Read-model lag measured and alerted, e.g. p99 &lt; 2 s (<em>example target</em>)',
        'Cross-service list queries answer in one local read (read model) or a bounded number of batched calls',
        'A noisy query in one service cannot slow another service\'s writes',
        'A read model can be rebuilt from scratch within a known time, e.g. under an hour (<em>example target</em>)',
        'Personal data can be erased in every copy, including read models and event stores'
      ],
      outOfScope: [
        '<b>Shared database</b>: several services reading and writing the same tables',
        '<b>Integration by reporting query</b>: "just this one join" into another service\'s schema',
        '<b>Distributed transactions</b> across service databases to keep the old consistency',
        '<b>Event sourcing everything</b>, including plain CRUD data nobody needs history for',
        '<b>Read model as source of truth</b>: writing business decisions against a lagging copy'
      ]
    },

    calculator: {
      inputs: [
        { id: 'n', label: 'Services whose data one query needs', min: 2, max: 8, value: 3 },
        { id: 'rows', label: 'Rows on the page', min: 1, max: 500, value: 50, log: true },
        { id: 'lat', label: 'Latency per service call', min: 2, max: 200, value: 20, unit: 'ms', log: true },
        { id: 'wps', label: 'Writes (events) per second', min: 1, max: 50000, value: 200, log: true, fmt: 'num' },
        { id: 'lag', label: 'Read-model lag (event to visible)', min: 10, max: 60000, value: 500, unit: 'ms', log: true },
        { id: 'ev', label: 'Events in one long-lived aggregate', min: 10, max: 100000, value: 2000, log: true, fmt: 'num' }
      ],
      outputs: [
        { label: 'Composition, row by row (N+1): calls · latency', fmt: 'raw', f: (v) => { const c = 1 + Math.round(v.rows) * (Math.round(v.n) - 1); return big(c) + ' calls · ' + ms(c * v.lat); } },
        { label: 'Composition, batched and parallel: calls · latency', fmt: 'raw', f: (v) => Math.round(v.n) + ' calls · ' + ms(2 * v.lat) },
        { label: 'CQRS read model: calls · staleness', fmt: 'raw', f: (v) => '1 local query · up to ' + ms(v.lag) },
        { label: 'Changes not yet visible in the read model at any moment', fmt: 'raw', f: (v) => big(v.wps * v.lag / 1000) + ' events' },
        { label: 'Events replayed to load the aggregate: no snapshot · snapshot every ' + SNAP, fmt: 'raw', f: (v) => big(v.ev) + ' · ≤ ' + Math.min(SNAP, Math.round(v.ev)) },
        { label: 'Event store growth per day (1 KB per event)', fmt: 'raw', f: (v) => { const gb = v.wps * 86400 / 1e6; return gb >= 1 ? gb.toFixed(1) + ' GB' : (gb * 1000).toFixed(0) + ' MB'; } }
      ],
      note: 'Row-by-row composition makes one call for the list and then one per row to each other service. Batched composition makes one list call, then one batch call to each other service in parallel, so about two call latencies. The read model answers locally but shows data as old as the lag. "Not yet visible" is rate × lag (Little\'s law). The 1 KB event size and the snapshot interval of ' + SNAP + ' are <em>estimates</em>; calls are assumed sequential in the N+1 case.'
    },

    api: [
      { m: 'POLICY', p: 'Data ownership rule', d: 'Each table, topic and bucket has exactly one owning service. Only that service\'s database user has access. Cross-service access is by API or event; there are no shared credentials and no cross-schema grants.' },
      { m: 'EVENT', p: 'customer.updated.v1 (published contract)', d: 'A <b>public</b> event, designed for consumers: <code>customerId</code>, <code>name</code>, <code>tier</code>, <code>version</code>, <code>occurredAt</code>. It is not a dump of the private row, so the table can change without breaking anyone.' },
      { m: 'RPC', p: 'CustomerService.BatchGetCustomers(ids)', d: 'A batch read so composition costs one call per service, not one per row. Returns only fields the owner is willing to support as API.' },
      { m: 'GET', p: '/order-history?customerId=…&status=…&sort=…', d: 'Served by the query side from the read model. The response carries <code>asOfVersion</code> or a timestamp, so clients can tell how fresh it is and wait for their own write.' },
      { m: 'SQL', p: 'events (stream_id, version, type, payload)', d: 'The append-only table of an event-sourced service. <code>UNIQUE (stream_id, version)</code> gives optimistic concurrency: two writers cannot both append version 8.' },
      { m: 'ADR', p: 'ADR: order history served from a CQRS read model', d: 'Why composition was not enough (sorting and filtering across services), the accepted staleness, how the view is rebuilt, who owns it, and the explicit rule that no write decision reads from it.' }
    ],
    dataModel: [
      { name: 'orders (write model, private)', store: 'Postgres, owned by Order service', fields: [['id', 'uuid', 'pk'], ['customer_id', 'uuid', 'idx'], ['status', 'text'], ['total', 'numeric(12,2)'], ['version', 'int']], note: '<code>customer_id</code> is a plain id, <b>not a foreign key</b>: the customers table is in another database. Referential integrity across services is a business process, not a constraint.' },
      { name: 'order_history_view (read model)', store: 'Postgres or Elasticsearch, owned by the query side', fields: [['order_id', 'uuid', 'pk'], ['customer_id', 'uuid', 'idx'], ['customer_name', 'text'], ['customer_tier', 'text', 'idx'], ['status', 'text', 'idx'], ['total', 'numeric(12,2)'], ['placed_at', 'timestamptz', 'idx'], ['order_version', 'int']], note: 'Denormalised on purpose: one row answers the screen. Customer fields are copied from customer events. Rebuildable at any time.' },
      { name: 'events (event store)', store: 'Postgres or KurrentDB, only for event-sourced services', fields: [['stream_id', 'uuid', 'pk'], ['version', 'int', 'pk'], ['type', 'text'], ['payload', 'jsonb'], ['global_seq', 'bigint', 'idx'], ['recorded_at', 'timestamptz']], note: 'Append-only; never updated. Current state = fold of the stream. A separate <code>snapshots (stream_id, version, state)</code> table shortens loading.' },
      { name: 'projection_checkpoint', store: 'Same database as the read model', fields: [['projector', 'text', 'pk'], ['partition', 'int', 'pk'], ['position', 'bigint'], ['updated_at', 'timestamptz']], note: 'Updated in the same transaction as the view rows, so a crash never applies an event twice or skips one. Reset it to zero to rebuild.' }
    ],

    architecture: {
      title: 'Private databases, composition for simple reads, a read model for the rest',
      nodes: [
        { id: 'client', label: 'Client', sub: 'web · mobile', kind: 'client', wide: [90, 170], tall: [210, 0], tip: 'Sends commands (place order) and queries (show my order history).' },
        { id: 'comp', label: 'Gateway / BFF', sub: 'API composer', kind: 'edge', wide: [290, 50], tall: [70, 105], tip: 'Routes commands to the owning service. For small queries it calls each owner and joins the results in memory.' },
        { id: 'qry', label: 'Query service', sub: 'reads the view', kind: 'service', wide: [290, 300], tall: [350, 105], tip: 'Serves list, search and filter queries from the read model. Contains no business rules and never writes domain data.' },
        { id: 'ord', label: 'Order service', sub: 'write model', kind: 'service', wide: [490, 50], tall: [70, 210], tip: 'Owns orders. Validates commands and commits them in a local transaction, together with the events to publish.' },
        { id: 'cust', label: 'Customer service', sub: 'owns customers', kind: 'service', wide: [490, 170], tall: [210, 210], tip: 'Owns customer data. Others get it through its API or its published events, never from its tables.' },
        { id: 'view', label: 'Order history view', sub: 'read model', kind: 'store', wide: [490, 300], tall: [350, 210], tip: 'A denormalised, query-shaped copy: orders with customer name and tier. Eventually consistent and rebuildable.' },
        { id: 'odb', label: 'Orders DB', sub: 'private', kind: 'store', wide: [690, 50], tall: [70, 315], tip: 'Only the Order service has credentials. Holds current state, or the event stream if the service is event-sourced.' },
        { id: 'cdb', label: 'Customers DB', sub: 'private', kind: 'store', wide: [690, 170], tall: [210, 315], tip: 'Only the Customer service has credentials. A different engine is fine: each service picks what fits.' },
        { id: 'proj', label: 'Projector', sub: 'idempotent consumer', kind: 'compute', wide: [690, 300], tall: [350, 315], tip: 'Consumes events in order per key and upserts view rows, storing its checkpoint in the same transaction.' },
        { id: 'cdc', label: 'Outbox / CDC relay', sub: 'Debezium', kind: 'compute', wide: [890, 110], tall: [70, 420], tip: 'Publishes each committed change as an event, so the state change and the event cannot diverge. Explained on the CDC page.' },
        { id: 'bus', label: 'Kafka', sub: 'events, keyed by id', kind: 'queue', wide: [890, 300], tall: [350, 420], tip: 'Carries the published events. Keyed by aggregate id so events for one order or customer stay in order.' }
      ],
      edges: [
        { from: 'client', to: 'comp' }, { from: 'client', to: 'qry' },
        { from: 'comp', to: 'ord' }, { from: 'comp', to: 'cust' },
        { from: 'ord', to: 'odb' }, { from: 'cust', to: 'cdb' },
        { from: 'odb', to: 'cdc', dashed: true }, { from: 'cdb', to: 'cdc', dashed: true },
        { from: 'cdc', to: 'bus' }, { from: 'bus', to: 'proj' }, { from: 'proj', to: 'view' },
        { from: 'qry', to: 'view' }
      ]
    },

    scenarios: [
      {
        id: 'cqrs', title: 'Write here, read there (CQRS)', tone: 'ok',
        steps: [
          { text: 'A customer places an order. The command goes to the <b>Order service</b>, the only writer of order data. It validates and commits in one local transaction.', flow: ['client>comp', 'comp>ord', 'ord>odb'], badges: { odb: 'COMMIT' } },
          { text: 'The committed change is published as an <code>OrderPlaced</code> event. How that is done safely (outbox, CDC) is on the <a href="cdc-pipelines.html">CDC page</a>.', flow: ['odb>cdc', 'cdc>bus'], badges: { bus: 'OrderPlaced v1' } },
          { text: 'The <b>projector</b> consumes the event and upserts a row in the order history view. It already holds the customer\'s name and tier from earlier <code>CustomerUpdated</code> events.', flow: ['bus>proj', 'proj>view'], ok: ['view'], badges: { view: ['row upserted', 'ok'] } },
          { text: 'The history screen is one indexed read of the view: filter by status, sort by date, show customer tier. No call to Orders or Customers at query time, so it works even if they are down.', flow: ['client>qry', 'qry>view'], ok: ['qry'], badges: { qry: ['1 local query', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'compose', title: 'API composition and N+1 at scale', tone: 'warn',
        steps: [
          { text: 'Simpler option: no read model. The composer asks the Order service for the customer\'s last 50 orders.', flow: ['client>comp', 'comp>ord', 'ord>odb'], hidden: ['qry', 'view', 'proj', 'bus', 'cdc'] },
          { text: 'Then it needs customer details. The naive loop calls the Customer service once per order: 1 + 50 calls. Under load this multiplies traffic and the slowest call sets the pace.', flow: ['comp>cust', 'comp>cust', 'comp>cust'], hidden: ['qry', 'view', 'proj', 'bus', 'cdc'], err: ['cust'], badges: { cust: ['50 calls / request', 'err'] }, tone: 'err' },
          { text: 'Batch it: one <code>BatchGetCustomers(ids)</code> call, then join in memory. Two calls in total. For a detail page or a short list, composition is the right, cheap answer.', flow: ['comp>cust', 'cust>cdb'], hidden: ['qry', 'view', 'proj', 'bus', 'cdc'], ok: ['comp'], badges: { comp: ['2 calls', 'ok'] }, tone: 'ok' },
          { text: 'Its limit: "orders of <b>gold-tier</b> customers, sorted by total". The filter is in one service and the sort in another, so the composer would have to fetch everything. That query needs a <b>read model</b>.', nodes: ['comp', 'ord', 'cust'], hidden: ['qry', 'view', 'proj', 'bus', 'cdc'], warn: ['comp'], badges: { comp: ['in-memory join too big', 'warn'] }, tone: 'warn' }
        ]
      },
      {
        id: 'shared', title: 'The shared-database shortcut', tone: 'err',
        steps: [
          { text: 'A deadline is close. Instead of calling the Customer API, the Order service is given a read-only login to the customers database and joins directly. It works and it is fast.', flow: ['comp>ord', 'ord>cdb'], hidden: ['qry', 'view', 'proj', 'bus', 'cdc'], warn: ['ord'], badges: { ord: ['SELECT … JOIN customers', 'warn'] }, tone: 'warn' },
          { text: 'Months later the Customers team splits <code>name</code> into two columns. Their own tests pass. They deploy. They did not know anyone else read that table.', flow: ['cust>cdb'], hidden: ['qry', 'view', 'proj', 'bus', 'cdc'], badges: { cdb: 'schema changed' } },
          { text: 'The Order service\'s query now fails in production. The private schema had become a <b>public API with no contract, no version and no owner\'s consent</b>.', flow: ['ord>cdb'], hidden: ['qry', 'view', 'proj', 'bus', 'cdc'], err: ['ord'], badges: { ord: ['column "name" not found', 'err'] }, tone: 'err' },
          { text: 'Fix: revoke the login. Orders gets customer data from the Customer API or from <code>customer.updated</code> events, which are designed, versioned contracts. The table is free to change again.', flow: ['comp>cust', 'cust>cdb'], hidden: ['qry', 'view', 'proj', 'bus', 'cdc'], ok: ['cust', 'cdb'], badges: { cdb: ['private again', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'ryw', title: 'Read-your-own-write gap', tone: 'warn',
        steps: [
          { text: 'A customer places an order and the app immediately opens "My orders". The write committed in the Orders DB at version 12.', flow: ['client>comp', 'comp>ord', 'ord>odb'], badges: { odb: 'v12 committed' } },
          { text: 'The read goes to the view, but the event is still in flight. The new order is <b>not in the list</b>. The customer thinks it failed and orders again.', flow: ['client>qry', 'qry>view'], warn: ['view'], badges: { view: ['still at v11', 'warn'] }, tone: 'warn' },
          { text: 'A moment later the projector catches up. Nothing was lost; the read was just early. This is the visible cost of eventual consistency.', flow: ['odb>cdc', 'cdc>bus', 'bus>proj', 'proj>view'], ok: ['view'], badges: { view: ['v12', 'ok'] } },
          { text: 'Design for it: the write returns its version and the query waits briefly until the view reaches it; or the app shows the new order from the write response; or that user\'s next read goes to the write side.', flow: ['client>qry', 'qry>view'], ok: ['qry'], badges: { qry: ['wait for ≥ v12', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'es', title: 'Event sourcing: the log is the state', tone: 'info',
        steps: [
          { text: 'In an event-sourced Order service there is no <code>orders</code> row to update. A command is checked against current state, then an event is <b>appended</b> to that order\'s stream.', flow: ['client>comp', 'comp>ord', 'ord>odb'], labels: { odb: { label: 'Event store', sub: 'append-only streams' } }, badges: { odb: 'append v8 (expect v7)' } },
          { text: 'Two requests change the same order at once. Both read version 7 and try to append version 8. The store accepts one; the other gets a <b>version conflict</b>, reloads and decides again.', flow: [['comp>ord', 'comp>ord'], 'ord>odb'], labels: { odb: { label: 'Event store', sub: 'append-only streams' } }, warn: ['ord'], badges: { odb: ['v8 exists: conflict', 'warn'] }, tone: 'warn' },
          { text: 'To load an order, the service reads its events and <b>folds</b> them into state. A long stream uses a <b>snapshot</b> plus the events after it.', flow: ['odb>ord'], labels: { odb: { label: 'Event store', sub: 'append-only streams' } }, badges: { ord: 'snapshot v2000 + 14 events' } },
          { text: 'You cannot query an event store by "all open orders over $100". Every such query needs a projection, so event sourcing <b>requires</b> CQRS. The reverse is not true.', flow: ['odb>cdc', 'cdc>bus', 'bus>proj', 'proj>view'], labels: { odb: { label: 'Event store', sub: 'append-only streams' } }, ok: ['view'] },
          { text: 'The payoff: a new read model, or a fixed projector bug, is a <b>replay</b> from event zero. The costs: event versioning for ever, harder deletion of personal data, and a steeper learning curve.', flow: ['bus>proj', 'proj>view'], labels: { odb: { label: 'Event store', sub: 'append-only streams' } }, hot: ['proj'], badges: { proj: ['replay from 0', 'info'] } }
        ]
      }
    ],

    knobs: {
      intro: 'Each control is a real data decision for Orders and Customers. Meter values are <em>illustrative</em> judgements, not benchmarks.',
      controls: [
        { id: 'own', label: 'Data ownership', type: 'seg', value: 'perdb', options: [
          { v: 'shared', l: 'Shared tables' }, { v: 'schema', l: 'Schema per service, one server' }, { v: 'perdb', l: 'Database per service' }] },
        { id: 'query', label: 'Cross-service query', type: 'seg', value: 'compose', options: [
          { v: 'join', l: 'SQL join across schemas' }, { v: 'compose', l: 'API composition' }, { v: 'cqrs', l: 'CQRS read model' }] },
        { id: 'persist', label: 'Write-side persistence', type: 'seg', value: 'outbox', options: [
          { v: 'state', l: 'Current state only' }, { v: 'outbox', l: 'State + published events' }, { v: 'es', l: 'Event sourcing' }] },
        { id: 'cons', label: 'A rule spanning both services', type: 'seg', value: 'saga', options: [
          { v: 'tpc', l: 'Distributed transaction' }, { v: 'saga', l: 'Events / saga (eventual)' }, { v: 'merge', l: 'Move it into one service' }] }
      ],
      evaluate(s) {
        const O = s.own, Q = s.query, P = s.persist, C = s.cons;
        const clamp = (x) => Math.max(0.04, Math.min(0.96, x));
        const impossible = O === 'perdb' && Q === 'join';
        let auto = { shared: 0.12, schema: 0.62, perdb: 0.92 }[O];
        if (Q === 'join' && O !== 'shared') auto -= 0.35;
        const autoV = O === 'shared' ? 'any schema change can break another team' : Q === 'join' ? 'cross-schema joins tie releases together' : O === 'schema' ? 'private schemas; shared server and upgrades' : 'each team changes its schema alone';
        const ql = { join: [0.92, 'one SQL join'], compose: [0.58, 'a few batched calls + in-memory join'], cqrs: [0.92, 'one local indexed read'] }[Q];
        const noFeed = Q === 'cqrs' && P === 'state';
        const fresh = Q === 'join' ? [0.95, 'always current'] : Q === 'compose' ? [0.82, 'current per service, not one snapshot'] : noFeed ? [0.3, 'no reliable feed: the view can drift for good'] : [0.55, 'behind by the projection lag'];
        let wr;
        if (C === 'merge') wr = [0.93, 'one local ACID transaction'];
        else if (C === 'tpc') wr = [0.45, 'atomic, but blocks if any party is down'];
        else if (O === 'shared') wr = [0.6, 'events on top of a shared DB: two truths'];
        else wr = P === 'state' ? [0.28, 'dual write: events can be lost'] : [0.8, 'eventual; events cannot be lost'];
        let iso = { shared: 0.18, schema: 0.45, perdb: 0.9 }[O];
        if (C === 'tpc') iso *= 0.55;
        const isoV = C === 'tpc' ? 'a commit needs every database up' : O === 'shared' ? 'one hot query or lock hurts everyone' : O === 'schema' ? 'shared server: noisy neighbours' : 'a failure stays in its service';
        const cx = { shared: 0, schema: 0.05, perdb: 0.15 }[O] + { join: 0, compose: 0.07, cqrs: 0.2 }[Q] + { state: 0, outbox: 0.1, es: 0.32 }[P] + { tpc: 0.2, saga: 0.15, merge: 0 }[C];
        const hist = { state: [0.25, 'current state only'], outbox: [0.55, 'events published, state is the truth'], es: [0.95, 'full history, replayable'] }[P];
        const metrics = [
          { k: 'Team autonomy', v: autoV, s: clamp(auto) },
          { k: 'Query latency', v: impossible ? 'not possible: no shared SQL engine' : ql[1], s: impossible ? 0.04 : ql[0] },
          { k: 'Read freshness', v: impossible ? '—' : fresh[1], s: impossible ? 0.04 : fresh[0] },
          { k: 'Write consistency', v: wr[1], s: wr[0] },
          { k: 'Fault isolation', v: isoV, s: clamp(iso) },
          { k: 'History & audit', v: hist[1], s: hist[0] },
          { k: 'Build & run complexity', v: cx < 0.25 ? 'low' : cx < 0.5 ? 'moderate' : 'high', s: clamp(1 - cx), hint: 'lower bar = harder' }
        ];
        const notes = [];
        if (O === 'shared') notes.push('A shared database is fine <b>inside</b> one service or a modular monolith. Between services it makes the schema an API nobody agreed to.');
        if (O === 'schema') notes.push('Schema per service on one server is a sound first step: enforce it with separate database users and no cross-schema grants.');
        if (Q === 'join' && !impossible) notes.push('Every cross-schema join is a dependency the owning team cannot see. Replace each with an API call or an event subscription.');
        if (Q === 'compose') notes.push('Composition suits lookups and short lists. It cannot filter in one service and sort in another without fetching everything.');
        if (Q === 'cqrs') notes.push('A read model is another datastore to run, monitor for lag and rebuild. Add it for a query that needs it, not for every entity.');
        if (noFeed) notes.push('A read model needs a reliable stream of changes. With state only, add an outbox or CDC first, or the view silently misses updates.');
        if (P === 'es') notes.push('Event sourcing makes history the source of truth. It also means versioning events for ever and building a projection for every query, so use it per aggregate, not per company.');
        if (C === 'tpc') notes.push('Distributed transactions need every participant up and hold locks across services. Sagas are covered on the <a href="event-driven-sagas.html">events and sagas page</a>.');
        if (C === 'merge') notes.push('If a rule must hold in the same instant across two services, the simplest correct design is one service owning both pieces of data.');
        let verdict;
        if (impossible) verdict = '❌ <b>Not possible:</b> separate databases have no common SQL engine to join in. Use API composition or a read model.';
        else if (O === 'shared') verdict = '⚠ <b>Shared tables:</b> the services are split in code but coupled in data. This is the usual root of a distributed monolith.';
        else if (Q === 'join') verdict = '⚠ <b>Cross-schema joins</b> undo the private schemas. The server is shared, and now the releases are too.';
        else if (C === 'tpc') verdict = '⚠ <b>Distributed transactions</b> bring back the coupling in availability. Prefer one service for the rule, or a saga.';
        else if (noFeed) verdict = '⚠ <b>A read model with nothing reliable feeding it.</b> Publish events from the write side through an outbox or CDC first.';
        else if (C === 'saga' && P === 'state') verdict = '⚠ <b>Events without an outbox</b> are a dual write. A crash between commit and publish loses the event.';
        else if (P === 'es') verdict = Q === 'cqrs' ? '👍 <b>Event sourcing with CQRS:</b> powerful where history is the product (ledgers, audit). Keep it to the aggregates that need it.' : '⚠ <b>Event sourcing without read models:</b> you cannot query an event store by anything but stream id. Add projections.';
        else if (C === 'merge') verdict = '✅ <b>Simplest correct design:</b> private data per service, and the rule that needs instant consistency lives in one of them.';
        else if (Q === 'cqrs') verdict = '✅ <b>Database per service + read model:</b> independent teams, fast queries, staleness that is explicit and measured.';
        else verdict = O === 'schema' ? '👍 <b>Good stepping stone:</b> private schemas on one server, integrated through APIs and events. Split servers when load or blast radius demands.' : '✅ <b>The default:</b> database per service, API composition for simple reads, events for everything that follows a write.';
        const hide = [];
        const ev = Q === 'cqrs' || P !== 'state';
        if (Q !== 'cqrs') hide.push('qry', 'view', 'proj');
        if (!ev) hide.push('cdc', 'bus');
        if (O === 'shared') hide.push('cdb');
        const cdbN = O === 'shared' ? 'odb' : 'cdb';
        let flow = ['client>comp', 'comp>ord', 'ord>odb'];
        if (Q === 'join' && !impossible) flow.push('ord>' + cdbN);
        if (Q === 'compose') flow.push('comp>cust', 'cust>' + cdbN);
        if (ev) flow.push('odb>cdc', 'cdc>bus');
        if (Q === 'cqrs') flow.push('bus>proj', 'proj>view', 'client>qry', 'qry>view');
        const labels = {
          odb: O === 'shared' ? { label: 'Shared DB', sub: 'orders + customers' } : P === 'es' ? { label: 'Event store', sub: 'append-only streams' } : { label: 'Orders DB', sub: O === 'schema' ? 'schema: orders' : 'private' },
          cdb: { label: 'Customers DB', sub: O === 'schema' ? 'schema: customers' : 'private' },
          cdc: P === 'state' ? { label: 'Dual write', sub: 'commit, then send' } : { label: 'Outbox / CDC relay', sub: 'Debezium' }
        };
        const badges = {};
        if (O === 'shared') badges.odb = ['two writers', 'err'];
        if (Q === 'join' && O === 'schema') badges.ord = ['joins customers.*', 'err'];
        if (impossible) badges.ord = ['no way to join', 'err'];
        if (noFeed || (P === 'state' && ev)) badges.cdc = ['can lose events', 'err'];
        if (Q === 'cqrs' && !noFeed) badges.view = ['lags by ms–s', 'info'];
        if (C === 'tpc' && O !== 'shared') badges.cdb = ['locked in 2PC', 'warn'];
        return {
          metrics, verdict, notes: notes.slice(0, 4), labels, hide, flow, badges,
          err: (O === 'shared' ? ['odb'] : []).concat(impossible || (Q === 'join' && O === 'schema') ? ['ord'] : []),
          warn: C === 'tpc' ? ['odb', 'cdb'] : [],
          ok: Q === 'cqrs' && !noFeed ? ['view'] : [],
          hot: []
        };
      }
    },

    widget: {
      title: 'Event-sourced cart with a lagging read model',
      caption: 'Commands append events to a stream; the <b>write model</b> is the fold of that stream. A <b>projector</b> copies events into the <b>read model</b> after a delay. Add items and read the view to see stale reads. <b>Pause</b> the projector, send <b>two writers</b> at the same version to see an optimistic-concurrency conflict, and <b>rebuild</b> the view by replaying from event zero.'
    },

    realWorld: {
      intro: 'The rule "a service owns its data" is older than the word microservices. The patterns for living with it were named between 2005 and 2015.',
      timeline: [
        { when: '2005', who: 'Pat Helland', title: 'Data on the Outside versus Data on the Inside', text: 'A CIDR paper arguing that data kept inside a service is different in essential ways from data sent between services. Inside data is private and encapsulated; outside data is immutable messages. His example: banks do not give ATMs a database connection.', src: 7 },
        { when: 'Dec 2005', who: 'Martin Fowler', title: 'Event Sourcing', text: 'Fowler describes capturing every change to application state as an event, so state can be rebuilt by starting blank and re-applying the events. He names version control as a common example of the idea.', src: 4 },
        { when: '2006', who: 'Werner Vogels (Amazon)', title: 'No direct database access', text: 'In an ACM Queue interview with Jim Gray, Vogels says service orientation at Amazon means encapsulating data with the business logic that operates on it: no direct database access is allowed from outside the service, and there is no data sharing among services.', src: 6 },
        { when: '2011', who: 'Martin Fowler', title: 'CQRS', text: 'Fowler describes CQRS as a pattern he first heard from Greg Young: separate models for updating and for reading. He points readers to Udi Dahan as another advocate and presents it as fitting only some parts of some systems.', src: 5 },
        { when: 'ongoing', who: 'Chris Richardson', title: 'Database per service vs shared database', text: 'microservices.io documents both. Database per service keeps persistent data private to the service; its listed drawbacks are transactions and queries that span services. Private tables or a schema per service are the lowest-overhead ways to do it.', src: 0 },
        { when: 'ongoing', who: 'Chris Richardson', title: 'API composition and CQRS for queries', text: 'With private databases, queries that join data from several services are no longer simple. API composition is the simple answer; the CQRS pattern keeps a view updated from events, at the cost of replication lag and eventually consistent views.', src: 3 },
        { when: '2015', who: 'Martin Kleppmann', title: 'Turning the database inside out', text: 'A talk first given at Strange Loop 2014: treat the log of changes as the primary thing and build caches, indexes and read views as derived data by processing that log, with Kafka and Samza as the example.', src: 8 },
        { when: '2019', who: 'Chris Kiehl', title: 'Event Sourcing is Hard', text: 'A practitioner\'s account of the drawbacks that event-sourcing introductions tend to leave out. Worth reading before choosing it for a whole system.', src: 9 },
        { when: 'today', who: 'Kurrent · Axon', title: 'Event stores with optimistic concurrency and snapshots', text: 'KurrentDB (formerly EventStoreDB) clients append with an expected stream revision and reject the write if another writer got there first. Axon Framework documents snapshot policies that bound how many events are read to load an entity.', src: 10 }
      ],
      lessons: [
        'A database shared between services is an <b>API with no contract</b>. Make the contract explicit: an endpoint or an event.',
        'Keep everything that must be <b>consistent in the same instant</b> inside one service and one transaction.',
        'Use <b>composition first</b>; add a read model when a query needs filtering or sorting across services.',
        'A read model is <b>derived and disposable</b>. Never make write decisions from it.',
        '<b>Event sourcing is a per-aggregate choice</b> for domains where history is the product, not a system-wide style.'
      ],
      sources: [
        { title: 'Pattern: Database per service', url: 'https://microservices.io/patterns/data/database-per-service', pub: 'Chris Richardson, microservices.io' },
        { title: 'Pattern: Shared database', url: 'https://microservices.io/patterns/data/shared-database.html', pub: 'Chris Richardson, microservices.io' },
        { title: 'Pattern: API Composition', url: 'https://microservices.io/patterns/data/api-composition.html', pub: 'Chris Richardson, microservices.io' },
        { title: 'Pattern: Command Query Responsibility Segregation (CQRS)', url: 'https://microservices.io/patterns/data/cqrs.html', pub: 'Chris Richardson, microservices.io' },
        { title: 'Event Sourcing', url: 'https://martinfowler.com/eaaDev/EventSourcing.html', pub: 'Martin Fowler, December 2005' },
        { title: 'CQRS', url: 'https://www.martinfowler.com/bliki/CQRS.html', pub: 'Martin Fowler, July 2011' },
        { title: 'A Conversation with Werner Vogels', url: 'https://queue.acm.org/detail.cfm?id=1142065', pub: 'ACM Queue, 2006' },
        { title: 'Data on the Outside versus Data on the Inside', url: 'https://www.cidrdb.org/cidr2005/papers/P12.pdf', pub: 'Pat Helland, CIDR 2005' },
        { title: 'Turning the database inside-out with Apache Samza', url: 'https://martin.kleppmann.com/2015/03/04/turning-the-database-inside-out.html', pub: 'Martin Kleppmann, March 2015' },
        { title: 'Don\'t Let the Internet Dupe You, Event Sourcing is Hard', url: 'https://chriskiehl.com/article/event-sourcing-is-hard', pub: 'Chris Kiehl, 2019' },
        { title: 'Appending events (expected revision)', url: 'https://docs.kurrent.io/clients/java/v1.0/appending-events', pub: 'Kurrent documentation' },
        { title: 'Snapshotting', url: 'https://docs.axoniq.io/axon-framework-reference/5.2/tuning/snapshotting/', pub: 'Axon Framework reference' },
        { title: 'Database-per-service pattern', url: 'https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-data-persistence/database-per-service.html', pub: 'AWS Prescriptive Guidance' }
      ]
    },

    tradeoffs: {
      headers: ['Decision', 'Option A', 'Option B', 'Pick when…'],
      rows: [
        ['Ownership', '<b>Shared database</b>: joins and ACID for free; schema is coupled', '<b>Database per service</b>: independent change; no joins or cross-service transactions', 'Shared only inside one service or monolith; per service once teams deploy independently'],
        ['Isolation level', '<b>Schema or tables per service</b> on one server: cheap, shared failure and upgrades', '<b>Server per service</b>: full isolation, more to run', 'Start with schemas and separate users; split servers for load, blast radius or a different engine'],
        ['Cross-service query', '<b>API composition</b>: no new store, always current; limited joins, N+1 risk', '<b>CQRS read model</b>: any query shape, fast; stale, one more store', 'Composition for lookups and short lists; read model for filter, sort or search across services'],
        ['Needing another service\'s data often', '<b>Call its API</b> each time: fresh, coupled at runtime', '<b>Keep a local copy</b> from its events: available, eventually consistent', 'Call for rarely needed or sensitive data; copy for data needed on every request'],
        ['Persistence style', '<b>Current state</b> (+ outbox events): familiar, easy to query', '<b>Event sourcing</b>: full history and replay; versioning and projections for ever', 'State by default; event sourcing for ledgers, audit-heavy or temporal domains'],
        ['Read-your-writes', '<b>Read from the write side</b> for the user\'s own change', '<b>Wait for the view</b> to reach the write\'s version', 'Write side for single-entity reads; version wait for lists that must include the new item']
      ]
    },
    failures: [
      { f: 'Shared database between services', detect: 'A schema migration in one service breaks another; more than one service\'s credentials can write a table', fix: 'One owner per table; separate DB users; replace foreign reads with API calls or event-fed local copies; then split schemas.' },
      { f: 'N+1 API composition', detect: 'Calls per request grow with page size; traces show rows of identical spans', fix: 'Batch endpoints, parallel calls, page-size caps; move heavy queries to a read model.' },
      { f: 'Stale read after write', detect: 'Users report "my change is missing" then it appears; duplicate submissions', fix: 'Return the write version and wait for it in the query, read own writes from the write side, or update the UI from the write response.' },
      { f: 'Projection lag grows without bound', detect: 'Consumer lag and view age climb; view row counts fall behind the source', fix: 'Alert on lag, scale consumers by partition, make handlers cheap and idempotent, batch upserts.' },
      { f: 'Read model drifts from the truth', detect: 'Reconciliation finds rows that differ from the owning service', fix: 'Feed from outbox or CDC (never a dual write), apply by version, run periodic reconciliation, rebuild by replay.' },
      { f: 'Event schema change breaks replay', detect: 'Rebuilding a projection fails on old events', fix: 'Additive changes only; upcast old events on read; keep replay in CI against a sample of real history.' },
      { f: 'Personal data in an immutable log', detect: 'An erasure request cannot be met because events are append-only', fix: 'Keep personal data out of events (reference by id) or encrypt per person and delete the key; see <a href="data-privacy.html">data privacy</a>.' }
    ],

    interview: [
      { q: 'Why should each microservice have its own database?', a: '<p>Because a shared database is <b>hidden coupling</b>. If two services read the same tables, the schema is an API between them with no contract, no versioning and no visibility of who depends on what. One team cannot change a column, pick a different engine, or scale its storage alone, and a heavy query in one service can lock or slow the other.</p><p>Private data makes the dependency explicit: other services use an API or an event the owner has agreed to support. "Database per service" does not have to mean a server each: private tables or a schema per service with separate credentials is enough to start.</p>', lvl: 'core' },
      { q: 'What do you lose with database per service, and what replaces it?', a: '<ul><li><b>Joins across services</b> → API composition, or a CQRS read model.</li><li><b>ACID transactions across services</b> → keep the rule in one service, or use a saga with eventual consistency.</li><li><b>Foreign keys across services</b> → ids without constraints, plus events to react to deletes.</li><li><b>One consistent snapshot for reports</b> → events or CDC into a warehouse.</li></ul><p>These costs are the reason to draw boundaries so that most transactions and queries stay <b>inside</b> one service.</p>', lvl: 'core' },
      { q: 'API composition vs a CQRS read model: how do you choose?', a: '<p><b>API composition:</b> the caller queries each owning service and joins in memory. Nothing new to run and data is current. It fits lookups by id and short lists. It struggles when you must filter by one service\'s data and sort by another\'s, or page through a large join.</p><p><b>CQRS read model:</b> a separate store, shaped for the query, updated from events. Any filter or sort is one local read and it works while the owning services are down. Costs: it is stale by the projection lag and it is one more thing to operate.</p><p>I start with composition and add a read model for the specific queries that need it.</p>', fu: 'How do you handle the N+1 problem in composition?', lvl: 'core' },
      { q: 'What exactly is CQRS? Does it require event sourcing or two databases?', a: '<p>CQRS, Command Query Responsibility Segregation, means using a <b>different model for writes than for reads</b>. Martin Fowler describes it (2011) as a pattern he first heard from Greg Young.</p><p>It does <b>not</b> require event sourcing, and in its simplest form not even two databases: separate read and write classes over one database is already CQRS. In microservices it usually means a separate read store fed by events. The reverse dependency does hold: <b>event sourcing practically requires CQRS</b>, because an event store can only be read by stream.</p>', lvl: 'core' },
      { q: 'What is event sourcing?', a: '<p>Instead of storing current state and overwriting it, you store <b>every state change as an immutable event</b> in an append-only stream per aggregate. Current state is computed by folding the events in order. Fowler documented the pattern in 2005.</p><p>What you get: a complete audit trail, the ability to rebuild any read model or answer "what did this look like last Tuesday", and a natural source of events for other services. Writes use optimistic concurrency: append version n+1 only if the stream is still at n.</p>', fu: 'How do you load an aggregate with 100,000 events?', lvl: 'core' },
      { q: 'When would you NOT use event sourcing?', a: '<ul><li><b>Plain CRUD</b> where nobody asks about history: you pay for versioning and projections and get nothing back.</li><li>When the team is new to it and the domain is not yet understood: early event designs are usually wrong, and events are for ever.</li><li>When most access is <b>ad hoc queries</b>: every one needs a projection.</li><li>When <b>erasing personal data</b> is frequent and the log would contain it.</li><li>As a <b>system-wide architecture</b>. It is a persistence choice for specific aggregates such as ledgers, orders with disputes, or anything audited.</li></ul><p>An outbox that publishes events from ordinary state gives most of the integration benefit at a fraction of the cost.</p>', lvl: 'core' },
      { q: 'Is publishing events from a service the same as event sourcing?', a: '<p>No. <b>Event-driven integration</b> means a service publishes events so others can react; its own source of truth can still be ordinary tables. <b>Event sourcing</b> means the service\'s own source of truth is the event log.</p><p>They also differ in audience: integration events are a <b>public contract</b>, coarse and stable. Event-sourcing events are <b>private</b> and fine-grained. Exposing internal events directly couples consumers to your internals; publish a separate, designed event instead.</p>', lvl: 'deep' },
      { q: 'A user saves a change and the next screen does not show it. What is happening and how do you fix it?', a: '<p>The write went to the write model; the screen read a read model that had not yet processed the event. That is <b>eventual consistency</b> showing through, not data loss.</p><ul><li>Return the new <b>version</b> from the write; the query waits (with a short timeout) until the view has reached it.</li><li>Serve the user\'s <b>own</b> just-written entity from the write side.</li><li>Update the UI from the <b>write response</b> without re-reading.</li><li>Measure and alert on projection lag so "a moment" stays a moment.</li></ul>', lvl: 'core' },
      { q: 'How do you keep data consistent across services without a distributed transaction?', a: '<ol><li><b>Avoid the need:</b> put data that must change together in one service and one aggregate.</li><li>Where it truly spans services, accept <b>eventual consistency</b>: each service commits locally and publishes an event; the next reacts; failures are undone by compensating actions. That is a saga, covered on the <a href="event-driven-sagas.html">events and sagas page</a>.</li><li>Make the publish <b>atomic with the commit</b> using an outbox or CDC, covered on the <a href="cdc-pipelines.html">CDC page</a>.</li><li>Make every consumer <b>idempotent</b>, and run <b>reconciliation</b> jobs to catch what slips through.</li></ol><p>I avoid two-phase commit between services: it couples their availability and holds locks across the network.</p>', lvl: 'core' },
      { q: 'How do you rebuild or change a read model in production?', a: '<p>Because the view is derived, I build the new one <b>beside</b> the old one: create the new table or index, start a second projector from position zero, let it replay until its lag is near zero, compare counts or samples with the old view, then switch the query service over and drop the old one.</p><p>Requirements: events retained long enough (or a snapshot topic / an export from the owner to bootstrap), idempotent projection, and old event versions still readable. Knowing the rebuild time in advance is part of the design.</p>', lvl: 'deep' },
      { q: 'How do you get reporting and analytics when the data is spread over many service databases?', a: '<p>Not by letting the reporting tool query each service\'s database: that is the shared-database problem again. Each service publishes its changes, through events or CDC, into an analytical store: a warehouse or lake. Reports join there, on a copy designed for it.</p><p>The owning team stays responsible for the meaning and quality of what it publishes, ideally under a data contract. See <a href="data-architecture.html">data architecture</a> and <a href="cdc-pipelines.html">CDC pipelines</a>.</p>', lvl: 'deep' },
      { q: 'A team wants a "temporary" read-only login to another service\'s database to hit a deadline. You are the architect. What do you do?', a: '<p><em>Sample story with illustrative details. Use your own.</em><br><b>Situation:</b> the Orders team needed customer tier on an order export in two weeks; the Customer API did not expose it; a DB login would take an hour. <b>Task:</b> meet the date without creating a hidden dependency. <b>Action:</b> I did not just refuse. I showed both teams a past incident where a column change broke an unknown reader, then offered two real options: the Customers team adds the field to its batch API (two days), or publishes it on the existing <code>customer.updated</code> event. I also agreed a rule in an ADR: no cross-service DB credentials, and exceptions carry an expiry date and an owner. The Customers team chose the API change and Orders consumed it. <b>Result:</b> the export shipped on time, and the next team with the same need reused the batch endpoint instead of asking for a login.</p>', lvl: 'deep' }
    ],

    code: [
      {
        title: 'Postgres: an event store with optimistic concurrency', lang: 'sql',
        code: `-- Postgres 15+. One stream per aggregate; (stream_id, version) is the concurrency check.
CREATE TABLE events (
  stream_id   uuid        NOT NULL,
  version     int         NOT NULL,
  type        text        NOT NULL,
  payload     jsonb       NOT NULL,
  global_seq  bigint      GENERATED ALWAYS AS IDENTITY,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stream_id, version)
);
CREATE TABLE snapshots (
  stream_id uuid PRIMARY KEY,
  version   int   NOT NULL,
  state     jsonb NOT NULL
);

-- Append: the command handler loaded the stream at version 7, so it writes version 8.
INSERT INTO events (stream_id, version, type, payload)
VALUES ($1, 8, 'ItemAdded', $2);
-- A unique violation (SQLSTATE 23505) means another writer appended version 8 first:
-- reload the stream, re-check the business rule, try again with version 9.

-- Load: latest snapshot, then only the events after it.
SELECT version, state FROM snapshots WHERE stream_id = $1;
SELECT version, type, payload
FROM events
WHERE stream_id = $1 AND version > $2      -- $2 = snapshot version, or 0
ORDER BY version;`,
        note: 'There is no <code>UPDATE</code> and no <code>DELETE</code>. The primary key is the whole concurrency mechanism: no locks are held between reading and appending. Do not have projectors poll by <code>global_seq</code>: identity values are assigned before commit, so a slow transaction can commit a lower number after a higher one was already read. Feed projectors through an outbox or CDC instead.'
      },
      {
        title: 'Spring Boot: idempotent projector for the read model', lang: 'java',
        code: `// Spring Boot 3.3+, Java 21, spring-kafka, JdbcClient. Events keyed by orderId.
public sealed interface OrderEvent permits OrderPlaced, OrderStatusChanged {}
public record OrderPlaced(UUID orderId, UUID customerId, BigDecimal total,
                          Instant placedAt, int version) implements OrderEvent {}
public record OrderStatusChanged(UUID orderId, String status, int version) implements OrderEvent {}

@Component
class OrderHistoryProjector {
  private final JdbcClient jdbc;
  OrderHistoryProjector(JdbcClient jdbc) { this.jdbc = jdbc; }

  @KafkaListener(topics = "orders.events", groupId = "order-history-view")
  @Transactional
  public void on(OrderEvent event) {
    switch (event) {
      case OrderPlaced e -> jdbc.sql("""
          INSERT INTO order_history_view
            (order_id, customer_id, customer_name, customer_tier, status, total, placed_at, order_version)
          SELECT :id, c.customer_id, c.name, c.tier, 'PLACED', :total, :placedAt, :v
          FROM customer_copy c WHERE c.customer_id = :customer
          ON CONFLICT (order_id) DO NOTHING""")          // redelivery: row already there
          .param("id", e.orderId()).param("customer", e.customerId())
          .param("total", e.total()).param("placedAt", Timestamp.from(e.placedAt()))
          .param("v", e.version()).update();
      case OrderStatusChanged e -> jdbc.sql("""
          UPDATE order_history_view SET status = :status, order_version = :v
          WHERE order_id = :id AND order_version < :v""") // stale or duplicate: 0 rows, no harm
          .param("status", e.status()).param("v", e.version())
          .param("id", e.orderId()).update();
    }
  }
}`,
        note: 'Both statements are safe to run twice, which at-least-once delivery requires. <code>customer_copy</code> is a small local table the same projector keeps from <code>customer.updated</code> events, so building a row needs no call to the Customer service. In real code handle the order event arriving before the customer event (insert with nulls and fill in later).'
      },
      {
        title: 'Python: an event-sourced aggregate with a snapshot', lang: 'python',
        code: `# Python 3.11+. State is never stored directly: it is the fold of the events.
from dataclasses import dataclass, field, replace

@dataclass(frozen=True)
class Cart:
    items: dict[str, int] = field(default_factory=dict)   # sku -> quantity
    checked_out: bool = False
    version: int = 0

def apply(cart: Cart, event: dict) -> Cart:
    """Pure function: (state, event) -> new state. No validation, no I/O."""
    items = dict(cart.items)
    match event["type"]:
        case "ItemAdded":
            items[event["sku"]] = items.get(event["sku"], 0) + event["qty"]
        case "ItemRemoved":
            items.pop(event["sku"], None)
        case "CheckedOut":
            return replace(cart, checked_out=True, version=cart.version + 1)
    return replace(cart, items=items, version=cart.version + 1)

def load(store, cart_id: str) -> Cart:
    cart = store.latest_snapshot(cart_id) or Cart()          # skip old history
    for event in store.read(cart_id, after_version=cart.version):
        cart = apply(cart, event)
    return cart

def add_item(store, cart_id: str, sku: str, qty: int) -> None:
    cart = load(store, cart_id)
    if cart.checked_out:                                     # business rule, checked on
        raise ValueError("cart is already checked out")      # the write model only
    event = {"type": "ItemAdded", "sku": sku, "qty": qty}
    # Raises a conflict if the stream is no longer at cart.version (someone else wrote).
    store.append(cart_id, expected_version=cart.version, events=[event])
    if (cart.version + 1) % 100 == 0:
        store.save_snapshot(cart_id, apply(cart, event))`,
        note: 'Commands decide and emit events; <code>apply</code> only replays them, so it must never reject an event that is already stored. The snapshot is an optimisation and can be deleted at any time. <code>store</code> stands for an event store client: the SQL above, KurrentDB or Axon Server.'
      }
    ],

    related: ['event-driven-sagas', 'cdc-pipelines', 'data-architecture', 'ddd', 'ms-service-boundaries', 'ms-edge-bff', 'sd:ecommerce-orders']
  });
})();

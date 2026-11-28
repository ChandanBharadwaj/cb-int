(function () {
  // n choose k, exact for the small values used here
  function comb(n, k) {
    n = Math.round(n); k = Math.round(k);
    if (k < 0 || k > n) return 0;
    k = Math.min(k, n - k);
    let r = 1;
    for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return Math.round(r);
  }
  const big = (x) => (x >= 1e9 ? (x / 1e9).toFixed(1) + ' B' : x >= 1e6 ? (x / 1e6).toFixed(1) + ' M' : Math.round(x).toLocaleString('en-US'));
  const pct = (x) => (x >= 0.1 ? (x * 100).toFixed(1) : x >= 0.001 ? (x * 100).toFixed(2) : (x * 100).toPrecision(2)) + '%';

  SD.register({
    slug: 'cell-based-architecture',
    domain: 4,
    title: 'Cell-Based Architecture',
    examples: 'AWS, Slack, DoorDash',
    tagline: 'Run <b>many complete copies</b> of your stack, called cells. A thin <b>cell router</b> sends each customer to one cell, so a crash, a bad deploy or a poison request hurts <b>1/N of customers</b>, not all of them.',
    tldr: {
      problem: 'One big shared stack has one big blast radius. A bad deploy, a corrupt config, a runaway tenant or a full database takes <b>every customer</b> down together, and the stack keeps growing past sizes anyone has tested.',
      idea: 'Split the workload into <b>cells</b>: each cell is a full, independent copy of the service (compute, queues, database) with a <b>fixed maximum size</b>. A <b>partition key</b> (usually tenant ID) decides which cell a customer lives in. A thin <b>router</b> forwards requests; a <b>control plane</b> creates cells and moves tenants.',
      insight: 'Cells are <b>bulkheads for the whole stack</b>. They limit failures that redundancy cannot: bugs, bad deploys and poison requests follow the traffic into every replica, but not into another cell. The price is a router that everyone shares, cross-cell work that gets harder, and N of everything to run.',
      numbers: [
        { v: '1 / N', l: 'share of customers hit when one of N equal cells fails (math)' },
        { v: 'C(8,2) = 28', l: 'shuffle shards from 8 workers taken 2 at a time (math)' },
        { v: '2,048', l: 'virtual name servers Route 53 shuffles customers across (AWS Builders\' Library)' }
      ]
    },

    intro: {
      what: 'A <b>cell</b> is a complete, independent copy of your service: its own application servers, queues and database. A <b>cell-based architecture</b> runs many such copies side by side and gives each customer a home in exactly one of them. A small <b>cell router</b> in front looks at each request and forwards it to the right cell.',
      analogy: {
        icon: '🚢',
        title: 'Watertight compartments in a ship',
        text: 'A ship\'s hull is divided by walls called bulkheads. If one compartment floods, the walls stop the water and the ship stays afloat. Cells do the same for software: a failure fills one cell and stops at its wall. The comparison breaks down in one place: a ship has no router. In software, the thing that sends customers to their cell is shared by all of them, so it must be very simple and very reliable.'
      },
      problem: 'A team ships a release with a memory leak. It runs on one shared fleet, so within an hour every server is restarting and every customer sees errors. Adding more servers or more zones would not have helped: the bug was on all of them. The question this page answers is <b>how do you make sure one failure can only ever hurt a small, known fraction of customers?</b>',
      story: [
        {
          stage: 'naive',
          title: 'One shared stack for everyone',
          text: 'All customers use the same load balancer, the same service fleet and the same database. It is the cheapest thing to build and to run, and extra replicas protect against a dead machine.',
          scene: {
            nodes: [
              { id: 'u', label: 'All customers', sub: 'tenants A…Z', kind: 'client', at: [210, 0] },
              { id: 'app', label: 'Service fleet', sub: '60 replicas', kind: 'service', at: [210, 110] },
              { id: 'db', label: 'Shared DB', sub: 'one big cluster', kind: 'store', at: [210, 220] }
            ],
            edges: [{ from: 'u', to: 'app' }, { from: 'app', to: 'db' }],
            flow: ['u>app', 'app>db'],
            badges: { app: ['one stack', 'info'] }
          }
        },
        {
          stage: 'breaks',
          title: 'One bad deploy, 100% outage',
          text: 'A bad release, a poison request or one tenant\'s heavy query reaches every replica, because every replica is the same. Redundancy does not help against a failure that <b>follows the traffic</b>. Everyone is down at once.',
          scene: {
            nodes: [
              { id: 'u', label: 'All customers', sub: 'all see errors', kind: 'client', at: [210, 0] },
              { id: 'app', label: 'Service fleet', sub: 'bad release v42', kind: 'service', at: [210, 110] },
              { id: 'db', label: 'Shared DB', sub: 'connections full', kind: 'store', at: [210, 220] }
            ],
            edges: [{ from: 'u', to: 'app' }, { from: 'app', to: 'db' }],
            flow: ['u>app', 'app>db'],
            err: ['app', 'db'], warn: ['u'],
            badges: { app: ['100% down', 'err'] }
          }
        },
        {
          stage: 'fix',
          title: 'Many small copies behind a router',
          text: 'Split the stack into cells. Each customer lives in one cell. Deploy to one cell first. When cell 2 breaks, only its customers notice, and the other cells never see the bad release or the bad request.',
          scene: {
            nodes: [
              { id: 'u', label: 'All customers', sub: 'tenant ID in request', kind: 'client', at: [210, 0] },
              { id: 'r', label: 'Cell router', sub: 'tenant → cell', kind: 'edge', at: [210, 110] },
              { id: 'c1', label: 'Cell 1', sub: 'app + DB', kind: 'compute', at: [70, 220] },
              { id: 'c2', label: 'Cell 2', sub: 'bad release', kind: 'compute', at: [210, 220] },
              { id: 'c3', label: 'Cell 3', sub: 'app + DB', kind: 'compute', at: [350, 220] }
            ],
            edges: [{ from: 'u', to: 'r' }, { from: 'r', to: 'c1' }, { from: 'r', to: 'c2' }, { from: 'r', to: 'c3' }],
            flow: ['u>r', ['r>c1', 'r>c2', 'r>c3']],
            ok: ['c1', 'c3'], err: ['c2'],
            badges: { c2: ['1/3 affected', 'warn'], c1: ['healthy', 'ok'] }
          }
        }
      ],
      usedBy: ['AWS services (described in the Well-Architected cell whitepaper)', 'Amazon Route 53 (shuffle sharding)', 'Slack (zone-level cells)', 'DoorDash (cells of Kubernetes clusters)', 'Azure "deployment stamps" pattern', 'Salesforce instances'],
      whenToUse: [
        'An outage for everyone at once is <b>unacceptable</b>, and you can accept an outage for a small slice',
        'There is a <b>natural partition key</b> (tenant, account, workspace) and most requests touch one key only',
        'The system is large enough that one shared stack is past any size you can <b>load-test</b>'
      ],
      whenNot: [
        'Small product or small team: N copies of everything is real cost. Start with good <a href="multi-tenancy.html">multi-tenancy</a> limits and quotas',
        'Most requests need data from <b>many customers at once</b> (a social graph, a global marketplace search): no clean key means constant cross-cell calls',
        'You only need to survive a region loss: that is <a href="disaster-recovery.html">disaster recovery</a> and <a href="../../system-design/systems/multi-region.html">multi-region</a> design. Cells help with bugs and overload, not geography'
      ],
      glossary: [
        { term: 'Cell', def: 'A complete, independent instance of the workload with its own compute and data, serving a fixed subset of customers.' },
        { term: 'Partition key', def: 'The request attribute, usually tenant or account ID, that decides which cell handles the request.' },
        { term: 'Cell router', def: 'The thin shared layer that maps a partition key to a cell and forwards the request, and does nothing else.' },
        { term: 'Blast radius', def: 'The share of customers or requests affected by one failure.' },
        { term: 'Control plane', def: 'The global management system that creates cells, places tenants, moves them and rolls out deployments.' },
        { term: 'Data plane', def: 'The part that serves customer requests: the router and the cells. It must keep working when the control plane is down.' },
        { term: 'Shuffle sharding', def: 'Giving each customer its own random combination of workers so that two customers rarely share all of them.' },
        { term: 'Bulkhead', def: 'Any wall that keeps a failure in one compartment from spreading to the others.' }
      ]
    },

    requirements: {
      functional: [
        '<b>A cell is a full copy</b>: its own compute, queues, caches and database. No cell calls another cell on the request path',
        '<b>One partition key</b> decides the cell, and it is present in every request (header, host name or token claim)',
        '<b>Thin router</b>: map key to cell and forward. No business logic, no per-request database call',
        '<b>Fixed maximum cell size</b>, tested to its limit. Grow by adding cells, not by growing cells',
        '<b>Deploy cell by cell</b>: one cell, bake time, then waves. A cell is also a deployment unit',
        '<b>Global things live in the control plane</b> and are off the request path: cell creation, tenant placement, migration'
      ],
      nonFunctional: [
        'Blast radius of one cell failure ≤ 1/N of customers, e.g. ≤ 5% with 20 cells (<em>example target</em>)',
        'Router availability at least one "nine" above the cells, e.g. 99.99% vs 99.9% (<em>rule of thumb</em>)',
        'Data plane keeps serving with the control plane down (static stability)',
        'Tenant migration between cells with &lt; 1 min of write pause per tenant (<em>example target</em>)',
        'A new cell is created from code in under an hour, with no manual steps',
        'Every dashboard and alert is sliced per cell, so "cell 7 is unhealthy" is visible in seconds'
      ],
      outOfScope: [
        '<b>Cells that share a database</b>: the copy is not independent, so the blast radius is still 100%',
        '<b>Smart router</b>: business rules, joins or synchronous lookups in the one layer everyone shares',
        '<b>Cross-cell calls on the request path</b>: one slow cell then slows the others',
        '<b>All-cells-at-once deploys</b>: throws away the main benefit',
        '<b>Snowflake cells</b>: cells that drift apart in version or config until none can be reasoned about'
      ]
    },

    calculator: {
      inputs: [
        { id: 'cells', label: 'Number of cells', min: 1, max: 200, value: 20 },
        { id: 'tenants', label: 'Tenants (customers)', min: 100, max: 10000000, value: 200000, log: true, fmt: 'num' },
        { id: 'rps', label: 'Peak load, whole service', min: 100, max: 2000000, value: 60000, log: true, unit: 'req/s', fmt: 'num' },
        { id: 'cap', label: 'Tested limit of one cell', min: 500, max: 100000, value: 5000, log: true, unit: 'req/s', fmt: 'num' },
        { id: 'workers', label: 'Workers per cell (for shuffle sharding)', min: 4, max: 100, value: 8 },
        { id: 'shard', label: 'Workers per tenant (shard size)', min: 1, max: 6, value: 2 }
      ],
      outputs: [
        { label: 'Blast radius: one cell fails or gets a bad deploy', fmt: 'raw', f: (v) => pct(1 / Math.round(v.cells)) + ' of tenants (' + big(v.tenants / Math.round(v.cells)) + ')' },
        { label: 'Load per cell at peak · share of tested limit', fmt: 'raw', f: (v) => { const l = v.rps / Math.round(v.cells); return big(l) + ' req/s · ' + Math.round(l / v.cap * 100) + '%' + (l > v.cap ? ' ⚠ over limit' : ''); } },
        { label: 'Cells needed for peak at 60% utilisation, plus one spare', fmt: 'raw', f: (v) => (Math.ceil(v.rps / (v.cap * 0.6)) + 1) + ' cells' },
        { label: 'Shuffle shards inside a cell: C(workers, shard size)', fmt: 'raw', f: (v) => big(comb(v.workers, Math.min(v.shard, v.workers))) + ' combinations' },
        { label: 'Tenants taken fully down by one poison tenant (expected)', fmt: 'raw', f: (v) => { const k = Math.min(Math.round(v.shard), Math.round(v.workers)); const per = v.tenants / Math.round(v.cells); const share = 1 / comb(v.workers, k); const n = (per - 1) * share; return (n >= 10 ? big(n) : n.toFixed(2)) + ' of ' + big(per) + ' in the cell (' + pct(share / Math.round(v.cells)) + ' of all tenants)'; } },
        { label: 'Tenants that share at least one worker with the poison tenant', fmt: 'raw', f: (v) => { const n = Math.round(v.workers), k = Math.min(Math.round(v.shard), n); return pct(1 - comb(n - k, k) / comb(n, k)) + ' of the cell (degraded, not down)'; } }
      ],
      note: 'Cells are assumed equal in size, and tenants are spread evenly. With shuffle sharding each tenant gets a random set of <i>k</i> workers out of <i>n</i>. A poison tenant kills its own <i>k</i> workers; another tenant is <b>fully</b> down only if it drew the same <i>k</i> workers, with probability 1 / C(n, k). Tenants that share some workers lose capacity but keep working if clients retry on their other workers. The 60% utilisation target is a <em>rule of thumb</em>: it leaves room to absorb a neighbour cell\'s tenants during a migration. Try shard size 1: that is plain sharding, and the blast radius inside the cell jumps to 1 / workers.'
    },

    api: [
      { m: 'ADR', p: 'ADR: Partition key and cell boundary', d: 'The key (<code>tenant_id</code>), where it travels (host name, JWT claim, header), which data is per-cell, which is global, and which features need cross-cell reads and how they get them (async copy, not a live call).' },
      { m: 'HTTP', p: 'GET /internal/routing/v1/tenants/{id}', d: 'Control-plane lookup used to build the router\'s map: <code>{ "tenant": "t-812", "cell": "cell-07", "state": "ACTIVE", "version": 41 }</code>. Routers cache the whole map and keep serving the last good copy if this API is down.' },
      { m: 'YAML', p: 'cell-spec.yaml', d: 'The stamp for one cell: region and zones, instance counts, database size, quotas, <b>maximum tenants and maximum req/s</b>. Every cell is created from the same file by the pipeline; no hand edits.' },
      { m: 'POLICY', p: 'Deployment wave policy', d: 'Wave 0: one canary cell with internal tenants. Bake 1 hour on per-cell SLO alarms. Then 5%, 25%, 100% of cells, never two regions in one wave, automatic rollback of the wave on alarm.' },
      { m: 'DOC', p: 'Tenant migration runbook', d: 'Copy data to the target cell, replicate changes, pause writes for the tenant, verify, flip the routing entry, resume, keep the old copy for a rollback window, then delete.' },
      { m: 'SLO', p: 'Per-cell and router SLOs', d: 'Each cell: 99.9% availability, measured per cell, not averaged. Router: 99.99%. Alert when any single cell burns budget, even if the global average looks fine.' }
    ],
    dataModel: [
      { name: 'cell', store: 'Control-plane DB (global)', fields: [['cell_id', 'text', 'pk'], ['region', 'text', 'idx'], ['state', 'PROVISIONING|ACTIVE|DRAINING|RETIRED'], ['max_tenants', 'int'], ['max_rps', 'int'], ['release', 'text'], ['wave', 'smallint']], note: 'One row per cell. <code>wave</code> orders deployments; <code>state = DRAINING</code> stops new placements.' },
      { name: 'tenant_placement', store: 'Control-plane DB → pushed to routers', fields: [['tenant_id', 'text', 'pk'], ['cell_id', 'text', 'fk'], ['state', 'ACTIVE|MIGRATING|WRITE_PAUSED'], ['target_cell_id', 'text'], ['version', 'bigint']], note: 'The routing map. Published as a versioned snapshot (object storage or config push). Routers hold it in memory; they never query this table per request.' },
      { name: 'migration', store: 'Control-plane DB', fields: [['migration_id', 'uuid', 'pk'], ['tenant_id', 'text', 'idx'], ['from_cell', 'text'], ['to_cell', 'text'], ['phase', 'COPY|CATCH_UP|PAUSE|FLIP|VERIFY|CLEANUP|ROLLED_BACK'], ['rows_copied', 'bigint'], ['started_at', 'timestamptz']], note: 'A checkpoint per phase makes the move resumable. A good fit for a <a href="durable-execution.html">durable workflow</a>.' },
      { name: 'cell_health', store: 'Metrics store', fields: [['cell_id', 'text', 'pk'], ['ts', 'timestamptz', 'sk'], ['error_rate', 'real'], ['p99_ms', 'int'], ['rps', 'int'], ['util_pct', 'real']], note: 'Feeds placement (which cell has room) and the deployment pipeline (is the canary cell healthy).' }
    ],

    architecture: {
      title: 'Router, three cells, and a control plane off the request path',
      nodes: [
        { id: 'client', label: 'Clients', sub: 'tenant in host / token', kind: 'client', wide: [90, 170], tall: [210, 0], tip: 'Every request carries the partition key, for example acme.app.example.com or a tenant claim in the token.' },
        { id: 'edge', label: 'DNS / edge', sub: 'TLS · WAF', kind: 'edge', wide: [285, 170], tall: [350, 0], tip: 'Global entry point. Some designs route here with one DNS name per cell, so there is no separate router hop.' },
        { id: 'router', label: 'Cell router', sub: 'key → cell, forward', kind: 'edge', wide: [490, 170], tall: [350, 105], tip: 'The thinnest possible layer. Holds the tenant-to-cell map in memory. Stateless, horizontally scaled, changes rarely. It is the one component every cell shares.' },
        { id: 'map', label: 'Routing map', sub: 'tenant → cell snapshot', kind: 'store', wide: [490, 40], tall: [210, 105], tip: 'A versioned snapshot written by the control plane. Routers poll it and keep the last good copy, so a control-plane outage does not stop traffic.' },
        { id: 'cell1', label: 'Cell 1', sub: 'app · queue · DB', kind: 'compute', wide: [700, 40], tall: [70, 210], tip: 'A complete copy of the stack with its own database. Fixed maximum size. Usually spans several availability zones itself.' },
        { id: 'cell2', label: 'Cell 2', sub: 'app · queue · DB', kind: 'compute', wide: [700, 170], tall: [210, 210], tip: 'Identical to cell 1 in code and shape, created from the same template. Holds a different set of tenants.' },
        { id: 'cell3', label: 'Cell 3', sub: 'app · queue · DB', kind: 'compute', wide: [700, 300], tall: [350, 210], tip: 'Cells never call each other on the request path. Anything they both need is copied in asynchronously.' },
        { id: 'cp', label: 'Control plane', sub: 'place · move · create', kind: 'service', wide: [910, 170], tall: [70, 105], tip: 'Creates and retires cells, places new tenants, runs migrations and publishes the routing map. Global, but not on the request path.' },
        { id: 'pipe', label: 'Deploy pipeline', sub: 'cell by cell, waves', kind: 'compute', wide: [910, 300], tall: [70, 0], tip: 'Rolls a release to one canary cell, waits on that cell\'s alarms, then proceeds in waves. Rolls back the wave on alarm.' },
        { id: 'glob', label: 'Global services', sub: 'identity · billing', kind: 'external', wide: [490, 300], tall: [210, 315], tip: 'The few things that cannot be per-cell. Keep the list short, cache their answers inside each cell, and treat each one as a shared-fate risk.' }
      ],
      edges: [
        { from: 'client', to: 'edge' },
        { from: 'edge', to: 'router' },
        { from: 'map', to: 'router', dashed: true, label: 'cached' },
        { from: 'router', to: 'cell1' },
        { from: 'router', to: 'cell2' },
        { from: 'router', to: 'cell3' },
        { from: 'cp', to: 'cell1', dashed: true },
        { from: 'cp', to: 'cell2', dashed: true },
        { from: 'cp', to: 'cell3', dashed: true },
        { from: 'cp', to: 'map', dashed: true },
        { from: 'pipe', to: 'cp' },
        { from: 'cell2', to: 'glob', dashed: true },
        { from: 'cell3', to: 'glob', dashed: true }
      ]
    },

    scenarios: [
      {
        id: 'route', title: 'Route a request to its cell', tone: 'ok',
        steps: [
          { text: 'Tenant <b>acme</b> calls the API. The tenant ID is in the host name and in the token, so the partition key is known before any business code runs.', flow: ['client>edge', 'edge>router'], badges: { client: 'tenant = acme' } },
          { text: 'The router looks up <code>acme → cell-2</code> in its <b>in-memory map</b>. No database call, no business logic: a hash-map read and a forward.', flow: ['map>router'], nodes: ['router'], badges: { router: ['acme → cell 2', 'info'] } },
          { text: 'Cell 2 handles the whole request with its own app servers, queue and database. It does not call cell 1 or cell 3.', flow: ['router>cell2'], ok: ['cell2'], badges: { cell2: ['200 OK', 'ok'] } },
          { text: 'The control plane was not involved. If it were down right now, routing would still work from the last good map. This is <b>static stability</b>.', nodes: ['cp', 'map'], badges: { cp: ['not on request path', 'info'] }, tone: 'ok' }
        ]
      },
      {
        id: 'deploy', title: 'Bad deploy stops at one cell', tone: 'err',
        steps: [
          { text: 'Release v42 has a memory leak. The pipeline deploys it to <b>wave 0 only</b>: cell 1, which holds internal and low-risk tenants.', flow: ['pipe>cp', 'cp>cell1'], badges: { cell1: 'v42', pipe: 'wave 0' } },
          { text: 'After 20 minutes cell 1\'s servers start restarting. Its error rate climbs. Cells 2 and 3 still run v41 and are untouched.', flow: [['router>cell1', 'router>cell2', 'router>cell3']], err: ['cell1'], ok: ['cell2', 'cell3'], badges: { cell1: ['errors ↑', 'err'], cell2: ['v41', 'ok'], cell3: ['v41', 'ok'] }, tone: 'err' },
          { text: 'The <b>per-cell alarm</b> fires during the bake time. The pipeline halts the rollout and rolls cell 1 back. No human had to decide.', flow: ['cell1>cp', 'cp>pipe', 'cp>cell1'], warn: ['cell1'], badges: { pipe: ['halt + rollback', 'warn'] }, tone: 'warn' },
          { text: 'Result: about <b>1/3</b> of tenants had a bad half hour, in the cell chosen to take that risk. In a single shared stack the same leak reaches 100% of customers.', ok: ['cell1', 'cell2', 'cell3'], badges: { cell1: ['v41 again', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'poison', title: 'Poison tenant contained', tone: 'warn',
        steps: [
          { text: 'One tenant in cell 3 sends a request that triggers a pathological query. Every retry does it again. This is a <b>poison request</b>: it follows the traffic to whatever serves it.', flow: ['client>edge', 'edge>router', 'router>cell3'], warn: ['cell3'], badges: { cell3: ['DB CPU 100%', 'warn'] }, tone: 'warn' },
          { text: 'Cell 3\'s database saturates. Its tenants see timeouts. The router keeps sending that tenant to cell 3, <b>never</b> failing it over to another cell, so the poison cannot spread.', flow: ['router>cell3'], err: ['cell3'], ok: ['cell1', 'cell2'], badges: { cell3: ['degraded', 'err'], router: ['no failover', 'info'] }, tone: 'err' },
          { text: 'Inside the cell, <b>shuffle sharding</b> narrows it further: each tenant uses its own 2 of 8 workers, so most neighbours share at most one worker with the bad tenant and keep working.', nodes: ['cell3'], badges: { cell3: ['2 of 8 workers hit', 'warn'] }, tone: 'warn' },
          { text: 'Operators throttle or isolate the one tenant. The lesson to say in an interview: <b>retrying a poison request in another cell turns a 1/N failure into N/N</b>.', ok: ['cell3'], badges: { cell3: ['tenant throttled', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'grow', title: 'Cell is full: add a cell, move a tenant', tone: 'warn',
        steps: [
          { text: 'Cell 2 reaches 80% of its tested limit because one tenant grew fast. Cells do not scale up past their limit. The control plane sees it in the per-cell health data.', flow: ['cell2>cp'], hot: ['cell2'], badges: { cell2: ['80% of limit', 'warn'] }, tone: 'warn' },
          { text: 'The control plane creates a new cell from the same template and marks it ACTIVE. New tenants are placed there from now on.', flow: ['cp>cell3'], labels: { cell3: { label: 'Cell 4 (new)', sub: 'empty · same template' } }, ok: ['cell3'], badges: { cell3: ['created from code', 'ok'] } },
          { text: 'It then migrates the big tenant: copy its data to the new cell, replicate changes, <b>pause that tenant\'s writes</b> for a few seconds, and verify.', flow: ['cell2>cell3'], labels: { cell3: { label: 'Cell 4 (new)', sub: 'copy + catch up' } }, warn: ['cell2'], badges: { cell2: ['tenant write-paused', 'warn'] } },
          { text: 'The routing entry flips to the new cell and a new map version is published. Routers pick it up within seconds. The old copy is kept for a rollback window.', flow: ['cp>map', 'map>router', 'router>cell3'], labels: { cell3: { label: 'Cell 4 (new)', sub: 'serving big tenant' } }, ok: ['cell3', 'cell2'], badges: { map: ['v42 published', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'shared', title: 'Shared fate: the router and global services', tone: 'err',
        steps: [
          { text: 'A config change adds a per-request call from the router to a global permissions service. It looked harmless and made a feature easier.', flow: ['edge>router', 'router>glob'], warn: ['router'], badges: { router: ['now calls a service', 'warn'] }, tone: 'warn' },
          { text: 'The permissions service slows down. Router threads pile up waiting. Every cell is perfectly healthy and <b>nobody can reach any of them</b>.', flow: ['router>glob'], err: ['router', 'glob'], ok: ['cell1', 'cell2', 'cell3'], badges: { router: ['100% blast radius', 'err'] }, tone: 'err' },
          { text: 'Fix: move the check into the cells, behind a cache. The router goes back to a map lookup. Global services are called from inside a cell, with timeouts and a cached last answer.', flow: ['router>cell2', 'cell2>glob'], ok: ['router', 'cell2'], badges: { cell2: ['cached answer', 'ok'] }, tone: 'ok' },
          { text: 'Rule: anything shared by all cells (router, routing map, identity, the deploy pipeline itself) gets the strictest change control you have, and each one is listed as a <b>known shared-fate risk</b>.', nodes: ['router', 'map', 'glob', 'pipe'], badges: { pipe: ['can break all cells', 'warn'] } }
        ]
      }
    ],

    knobs: {
      intro: 'Each control is a real design choice for a cell-based system. Meter values are <em>illustrative</em> judgements, not benchmarks; the blast-radius numbers are plain arithmetic.',
      controls: [
        { id: 'key', label: 'Partition key', type: 'seg', value: 'tenant', options: [
          { v: 'tenant', l: 'Tenant / account ID' }, { v: 'geo', l: 'Region' }, { v: 'rand', l: 'Random per request' }] },
        { id: 'cells', label: 'Number of cells', type: 'seg', value: 20, options: [
          { v: 1, l: '1' }, { v: 4, l: '4' }, { v: 20, l: '20' }, { v: 100, l: '100' }] },
        { id: 'router', label: 'Router', type: 'seg', value: 'map', options: [
          { v: 'hash', l: 'Stateless hash mod N' }, { v: 'map', l: 'Cached mapping table' }, { v: 'smart', l: 'Lookup + logic per request' }] },
        { id: 'deploy', label: 'Deployment', type: 'seg', value: 'wave', options: [
          { v: 'big', l: 'All cells at once' }, { v: 'wave', l: 'One cell, bake, then waves' }] },
        { id: 'shared', label: 'Shared state', type: 'seg', value: 'cp', options: [
          { v: 'db', l: 'Cells share a database' }, { v: 'cp', l: 'Only control plane is global' }] }
      ],
      evaluate(s) {
        const clamp = (x) => Math.max(0.03, Math.min(0.97, x));
        const N = +s.cells, K = s.key, R = s.router, D = s.deploy, S = s.shared;
        const frac = 1 / N;
        const real = N > 1 && S === 'cp';                 // are these really independent cells?
        const cellBr = !real ? 1 : frac;
        const depBr = !real ? 1 : D === 'big' ? 1 : frac;
        const p = (x) => (x >= 0.1 ? Math.round(x * 100) : x * 100) + '%';
        let noisy = !real ? 0.1 : K === 'rand' ? 0.12 : K === 'geo' ? 0.4 : 0.55 + Math.min(0.35, N / 100);
        let move = N === 1 ? 0.5 : R === 'hash' ? 0.2 : R === 'map' ? 0.85 : 0.75;
        if (K === 'rand') move = 0.5;
        const rr = { hash: 0.9, map: 0.78, smart: 0.18 }[R];
        const cost = clamp(0.92 - Math.log10(N) * 0.3 - (R === 'smart' ? 0.08 : 0) - (D === 'wave' && N > 1 ? 0.05 : 0));
        const metrics = [
          { k: 'Blast radius: cell failure', v: !real ? '100% of customers' : K === 'rand' ? p(frac) + ' of every customer\'s requests' : p(frac) + ' of customers', s: clamp(1 - cellBr) },
          { k: 'Blast radius: bad deploy', v: depBr === 1 ? '100% before anyone can react' : p(frac) + ' (the canary cell)', s: clamp(1 - depBr) },
          { k: 'Noisy / poison tenant isolation', v: noisy >= 0.6 ? 'contained in its cell' : noisy >= 0.3 ? 'whole region shares it' : 'reaches every cell', s: clamp(noisy) },
          { k: 'Moving one tenant', v: N === 1 ? 'nothing to move' : K === 'rand' ? 'no tenant has a home' : R === 'hash' ? 'cannot: hash decides' : 'flip one map entry', s: clamp(move) },
          { k: 'Router risk (shared fate)', v: R === 'smart' ? 'high: depends on a live lookup' : R === 'map' ? 'low: serves from memory' : 'lowest: pure function', s: rr },
          { k: 'Cost & operations', v: N === 1 ? 'one stack to run' : N <= 4 ? 'a few stacks, manual is possible' : N <= 20 ? 'needs full automation' : 'a platform team\'s full-time job', s: cost, hint: 'lower bar = more overhead' }
        ];
        const notes = [];
        if (N === 1) notes.push('One cell is just a normal stack. That is a fine place to start: add the tenant ID to every request and table now so that splitting later is possible.');
        if (S === 'db') notes.push('A <b>shared database</b> means the cells are not independent. A lock storm, a full disk or a bad migration there takes all of them down, whatever the cell count.');
        if (K === 'rand' && N > 1) notes.push('Random routing is load balancing, not cells. A poison request or heavy tenant reaches <b>every</b> cell, and state cannot live in one place.');
        if (K === 'geo' && N > 1) notes.push('Region as the key gives data residency and latency, but a region is a very large cell. Most designs use region first, then tenant-keyed cells inside each region.');
        if (R === 'hash' && N > 1) notes.push('<code>hash(tenant) mod N</code> needs no state, but adding a cell remaps most tenants, and you cannot move one hot tenant on its own. Consistent hashing reduces the first problem only.');
        if (R === 'smart') notes.push('A router that calls a database or holds business rules is a <b>single shared failure domain</b> in front of every cell. Keep the map in memory and the logic in the cells.');
        if (D === 'big' && N > 1) notes.push('Deploying everywhere at once makes a bad release a global outage. With N cells you already have N natural canary stages.');
        if (D === 'wave' && N >= 100) notes.push('With 100 cells, waves with bake time can take days. Group cells into waves that grow (1, 5, 25, the rest) and automate the gate.');
        let verdict;
        if (N === 1) verdict = '👍 <b>A single stack.</b> Simple and cheap; blast radius is 100% by design. Make it cell-ready (key everywhere) before you need cells.';
        else if (S === 'db') verdict = '❌ <b>Cells in name only.</b> The shared database is the real blast radius. Give each cell its own data first.';
        else if (R === 'smart') verdict = '❌ <b>The router is now your monolith.</b> Every cell shares its fate. Make it a cached map lookup and nothing else.';
        else if (K === 'rand') verdict = '⚠ <b>This is a load balancer with extra steps.</b> Pick a key that pins a customer to one cell, or failures follow the traffic everywhere.';
        else if (D === 'big') verdict = '⚠ <b>Isolated at runtime, not at deploy time.</b> Most outages come from changes: roll out cell by cell.';
        else if (R === 'hash') verdict = '👍 <b>Good isolation, rigid placement.</b> Fine while cells are few and even; move to a mapping table before the first hot tenant.';
        else if (N >= 100) verdict = '✅ <b>Very small blast radius</b>, at the price of heavy automation. Right for very large multi-tenant services; too much for most teams.';
        else verdict = '✅ <b>A sound cell design:</b> tenant-keyed cells, a thin cached router, wave deployments, and only the control plane is global.';
        const labels = {
          router: { label: 'Cell router', sub: R === 'hash' ? 'hash(key) mod N' : R === 'map' ? 'in-memory map' : 'DB lookup + rules' },
          cell1: { label: N === 1 ? 'The stack' : 'Cell 1', sub: D === 'wave' && N > 1 ? 'canary cell' : 'app · queue · DB' },
          cell3: { label: N > 4 ? 'Cell ' + N : 'Cell 3', sub: 'app · queue · DB' },
          glob: S === 'db' ? { label: 'Shared database', sub: 'all cells write here' } : { label: 'Global services', sub: 'identity · billing' }
        };
        const hide = [];
        if (N === 1) hide.push('cell2', 'cell3', 'router', 'map');
        if (R === 'hash' && N > 1) hide.push('map');
        const badges = {};
        if (S === 'db') badges.glob = ['shared fate', 'err'];
        if (R === 'smart' && N > 1) badges.router = ['shared fate', 'err'];
        if (D === 'wave' && N > 1) badges.pipe = ['wave 0 → 1 → 2', 'ok'];
        if (D === 'big' && N > 1) badges.pipe = ['all at once', 'warn'];
        const flow = N === 1 ? ['client>edge', 'edge>cell1'] : ['client>edge', 'edge>router', K === 'rand' ? ['router>cell1', 'router>cell2', 'router>cell3'] : 'router>cell2'];
        return {
          metrics, verdict, notes: notes.slice(0, 4), labels, hide, flow, badges,
          err: (S === 'db' ? ['glob'] : []).concat(R === 'smart' && N > 1 ? ['router'] : []),
          warn: D === 'big' && N > 1 ? ['pipe'] : [],
          ok: real && R !== 'smart' && K !== 'rand' ? ['cell2'] : [],
          hot: []
        };
      }
    },

    widget: {
      title: 'Blast-radius lab: no isolation, cells, shuffle sharding',
      caption: 'Each dot is a customer; each box is a worker. Pick how customers are assigned to workers, then <b>tap a customer</b> to make it send poison requests that crash every worker it uses. Count who is fully down, who is degraded and who never noticed. The lab compares the result with the formula 1 / C(n, k).'
    },

    realWorld: {
      intro: 'The idea comes from operating very large multi-tenant services, where "everything is down for everyone" became the failure to design out. Most public material is from AWS, plus a few companies that wrote up their own versions.',
      timeline: [
        { when: '2014', who: 'AWS (Colm MacCárthaigh)', title: 'Shuffle sharding described in public', text: 'An AWS Architecture Blog post explained <b>shuffle sharding</b> as used by Route 53: give each customer a different combination of workers, so a problem caused by one customer leaves most others with at least one healthy worker. The Infima library that came with it implements the technique.', src: 1 },
        { when: 'Builders\' Library', who: 'Amazon', title: 'Workload isolation using shuffle sharding', text: 'The Builders\' Library article gives the Route 53 detail: capacity is arranged into <b>2,048 virtual name servers</b>, and each customer domain gets a shuffle shard of four of them. With enough workers there can be more shuffle shards than customers.', src: 2 },
        { when: '2023', who: 'AWS Well-Architected', title: 'Whitepaper: Reducing the Scope of Impact with Cell-Based Architecture', text: 'AWS published its guidance as a whitepaper. It names the parts used on this page: the <b>cell</b>, the <b>cell router</b> ("the thinnest possible layer"), and a <b>control plane</b> that provisions, moves, migrates and monitors cells, with a data plane that keeps working if the control plane is down.', src: 0 },
        { when: '2023', who: 'Slack', title: 'Migration to a cellular architecture', text: 'After a network disruption in one availability zone on 30 June 2021, Slack reworked its most critical user-facing services over about 1.5 years so that each zone is a silo that can be <b>drained within five minutes</b>. Here the cell is an availability zone, not a tenant group.', src: 3 },
        { when: '2024', who: 'DoorDash', title: 'Cells of Kubernetes clusters with zone-aware routing', text: 'DoorDash described a cell-based design in which each cell contains several Kubernetes clusters and each microservice runs in one cluster per cell. Its Envoy-based service mesh keeps traffic inside a cell and, with zone-aware routing, inside a zone where it can.', src: 4 },
        { when: 'today', who: 'AWS Well-Architected Framework', title: 'REL10-BP03: use bulkhead architectures', text: 'The reliability pillar lists cell-based design as a best practice for limiting the scope of impact. It advises a cheap deterministic mapping in the router and keeping business logic out of it.', src: 6 }
      ],
      lessons: [
        'Redundancy handles broken machines. <b>Cells handle broken changes and broken requests.</b>',
        'The <b>router and the control plane are shared fate</b>: keep them thin, cached and rarely changed.',
        'A cell has a <b>maximum size</b>. Scale by adding cells, and test one cell to its limit.',
        'Build <b>tenant migration on day one</b>; without it you cannot rebalance or retire a cell.',
        'A cell is whatever boundary fits: Slack used zones, DoorDash clusters, AWS services often tenants.'
      ],
      sources: [
        { title: 'What is a cell-based architecture? (Reducing the Scope of Impact with Cell-Based Architecture)', url: 'https://docs.aws.amazon.com/wellarchitected/latest/reducing-scope-of-impact-with-cell-based-architecture/what-is-a-cell-based-architecture.html', pub: 'AWS Well-Architected whitepaper' },
        { title: 'Shuffle Sharding: Massive and Magical Fault Isolation', url: 'https://aws.amazon.com/blogs/architecture/shuffle-sharding-massive-and-magical-fault-isolation', pub: 'AWS Architecture Blog, Colm MacCárthaigh, 2014' },
        { title: 'Workload isolation using shuffle-sharding', url: 'https://aws.amazon.com/builders-library/workload-isolation-using-shuffle-sharding', pub: 'Amazon Builders\' Library, Colm MacCárthaigh' },
        { title: 'Slack\'s Migration to a Cellular Architecture', url: 'https://slack.engineering/slacks-migration-to-a-cellular-architecture/', pub: 'Slack Engineering, 2023' },
        { title: 'Staying in the Zone: How DoorDash used a service mesh to manage data transfer, reducing hops and cloud spend', url: 'https://careersatdoordash.com/blog/staying-in-the-zone-how-doordash-used-a-service-mesh-to-manage-data-transfer-reducing-hops-and-cloud-spend/', pub: 'DoorDash Engineering, January 2024' },
        { title: 'Slack Migrates to Cell-Based Architecture on AWS to Mitigate Gray Failures', url: 'https://www.infoq.com/news/2024/01/slack-cell-based-architecture', pub: 'InfoQ, January 2024' },
        { title: 'REL10-BP03 Use bulkhead architectures to limit scope of impact', url: 'https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_fault_isolation_use_bulkhead.html', pub: 'AWS Well-Architected Framework, Reliability pillar' },
        { title: 'Control plane and data plane', url: 'https://docs.aws.amazon.com/wellarchitected/latest/reducing-scope-of-impact-with-cell-based-architecture/control-plane-and-data-plane.html', pub: 'AWS Well-Architected whitepaper' },
        { title: 'Cell placement', url: 'https://docs.aws.amazon.com/wellarchitected/latest/reducing-scope-of-impact-with-cell-based-architecture/cell-placement.html', pub: 'AWS Well-Architected whitepaper' },
        { title: 'Guidance for Cell-Based Architecture on AWS', url: 'https://docs.aws.amazon.com/solutions/cell-based-architecture-on-aws/', pub: 'AWS Solutions Library' },
        { title: 'Slack\'s Migration to a Cellular Architecture (QCon San Francisco 2024 talk)', url: 'https://www.infoq.com/presentations/slack-cellular-architecture/', pub: 'Cooper Bethea, InfoQ / QCon SF 2024' },
        { title: 'DoorDash Uses Service Mesh and Cell-Based Architecture', url: 'https://infoq.com/news/2024/01/doordash-service-mesh', pub: 'InfoQ, January 2024' }
      ]
    },

    tradeoffs: {
      headers: ['Decision', 'Option A', 'Option B', 'Pick when…'],
      rows: [
        ['Isolation unit', '<b>Shared stack + quotas</b>: one fleet, per-tenant limits', '<b>Cells</b>: N full copies, tenant pinned to one', 'Quotas first. Cells when a global outage is no longer acceptable and you can automate N stacks'],
        ['Routing', '<b>Hash mod N</b>: no state, no lookup', '<b>Mapping table</b>: explicit tenant → cell, cached in the router', 'Mapping table almost always: you need to move single tenants and add cells without reshuffling'],
        ['Cell size', '<b>Few large cells</b>: cheaper, less to operate, bigger blast radius', '<b>Many small cells</b>: tiny blast radius, more overhead, big tenants may not fit', 'Size a cell to what you can load-test and to your largest tenant; aim for a blast radius the business accepts (often 5–10%)'],
        ['Inside a cell', '<b>Plain shards</b>: tenant → one worker group', '<b>Shuffle sharding</b>: tenant → its own combination of workers', 'Shuffle sharding when workers are stateless and clients retry; plain shards when each tenant\'s data lives on specific nodes'],
        ['Cross-cell needs', '<b>Live call</b> to another cell or a global service', '<b>Async copy</b> of the data into each cell', 'Async copy by default. A live call only from inside a cell, with a timeout and a cached fallback'],
        ['Tenant placement', '<b>Fill cell by cell</b>: dense, cheap', '<b>Spread evenly</b>, keep headroom, isolate "whales"', 'Spread with headroom; give the largest tenants a dedicated cell so they cannot crowd neighbours']
      ]
    },
    failures: [
      { f: 'Router is a single point of failure', detect: 'All cells healthy on their own dashboards while global error rate is 100%; router latency tracks a dependency', fix: 'In-memory map with last-known-good fallback; no per-request dependencies; strict change control; or DNS-per-cell so there is no router hop.' },
      { f: 'Hidden shared dependency', detect: 'Several cells degrade at the same minute; trace shows the same global service or database', fix: 'Inventory every cross-cell resource; move it into the cells or cache its answers; accept and document the few that must stay global.' },
      { f: 'Failing over a poison tenant to another cell', detect: 'Cells fail one after another, minutes apart, following one tenant', fix: 'Never reroute a tenant automatically because its cell is unhealthy. Throttle the tenant; migrate only by a deliberate control-plane action.' },
      { f: 'Cell drift', detect: 'An incident reproduces in cell 9 only; config diff shows hand edits; cells run 4 different releases', fix: 'Create every cell from one template; block manual changes; pipeline must finish or roll back a wave within a fixed time.' },
      { f: 'Whale tenant outgrows its cell', detect: 'One tenant is &gt; 30% of a cell\'s load; cell utilisation near its tested limit', fix: 'Dedicated cell for large tenants; per-tenant quotas; placement that weighs tenant size, not tenant count.' },
      { f: 'Migration loses or duplicates writes', detect: 'Row counts or checksums differ between source and target after the flip', fix: 'Pause the tenant\'s writes during the flip; verify before switching; fence the old cell (reject writes for that tenant); keep a rollback window.' },
      { f: 'Control plane outage stops traffic', detect: 'Routing errors when the placement API is down', fix: 'Static stability: routers and cells run from local copies of what they need. The control plane is only needed to change things.' }
    ],

    interview: [
      { q: 'What is a cell-based architecture? Define a cell.', a: '<p>A <b>cell</b> is a complete, independent instance of the workload: its own compute, queues and <b>its own data</b>. The service runs many identical cells. A <b>partition key</b>, usually tenant ID, assigns each customer to exactly one cell. A thin <b>cell router</b> forwards requests by key, and a <b>control plane</b> creates cells and moves tenants.</p><p>The purpose is to limit the <b>blast radius</b>: with N equal cells, one cell failing affects about 1/N of customers. A common misreading is that any sharded database is a cell architecture. If the cells share a database, a cache or a synchronous dependency, they are not independent.</p>', lvl: 'core' },
      { q: 'We already run in three availability zones with autoscaling. Why would we need cells?', a: '<p>Zones and replicas protect against <b>infrastructure</b> failures: a dead machine, a lost zone. They do not protect against failures that <b>follow the traffic</b>:</p><ul><li>a bad deploy or config push that goes to every replica,</li><li>a poison request that crashes whichever server handles it,</li><li>one tenant that saturates the shared database.</li></ul><p>All replicas are the same software handling the same requests, so they fail together. A cell boundary puts a wall around both the deployment and the traffic. I would say: zones for hardware, cells for software and customers.</p>', lvl: 'core' },
      { q: 'How do you choose the partition key?', a: '<p>Look for the key where <b>most requests touch one value only</b>, and that is present before any business logic runs. For B2B SaaS it is tenant or workspace ID. For consumer products it can be user ID or region.</p><p>Check three things: (1) how many features need data across keys, because each becomes a cross-cell problem; (2) the size of the largest key, because one tenant must fit in a cell; (3) whether the key can be read cheaply by the router, from the host name or a token claim.</p><p>If no key passes, cells are probably the wrong tool for that workload.</p>', fu: 'What do you do with a feature like global search across tenants?', lvl: 'core' },
      { q: 'How should the cell router work, and why does everyone say "keep it thin"?', a: '<p>The router is the <b>one component all cells share</b>, so a router failure is a 100% outage. That is why it should do one thing: read the key, look up the cell in an <b>in-memory map</b>, forward.</p><ul><li>No business rules and no per-request call to a database or service.</li><li>The control plane publishes the map as a versioned snapshot; routers poll and keep the <b>last good copy</b>.</li><li>Stateless and horizontally scaled; changed rarely and carefully.</li></ul><p>Alternatives that remove the hop: one DNS name per cell, or the client learning its cell at login.</p>', lvl: 'core' },
      { q: 'Hash-based routing or a mapping table?', a: '<p><code>hash(key) mod N</code> needs no state, but adding a cell remaps most keys, and you cannot move one specific tenant. Consistent hashing fixes the first problem and not the second.</p><p>A <b>mapping table</b> (tenant → cell) costs a small amount of memory in each router and needs a distribution mechanism, but it lets you place tenants by size, move a single hot tenant, drain a cell and give a large customer a dedicated cell. I choose the mapping table for any system with uneven tenants, which is nearly all of them.</p>', lvl: 'core' },
      { q: 'Explain shuffle sharding with numbers.', a: '<p>Take 8 workers. With plain sharding into 4 pairs, a poison tenant kills its pair and takes down everyone on that shard: <b>25%</b> of tenants.</p><p>With shuffle sharding each tenant gets its own random pair. There are <b>C(8,2) = 28</b> possible pairs. The poison tenant still kills 2 workers, but another tenant is fully down only if it drew the <b>same</b> pair: 1 in 28, about 3.6%. Tenants that share one worker lose half their capacity and survive if the client retries on the other worker.</p><p>It scales fast: AWS describes Route 53 using 2,048 virtual name servers with shards of four. It needs stateless workers and retrying clients.</p>', fu: 'How does this combine with cells?', lvl: 'deep' },
      { q: 'How big should a cell be, and how many should there be?', a: '<p>Three constraints set the size:</p><ul><li><b>Upper bound</b>: what you can load-test to failure and operate with confidence. A cell has a fixed maximum and never grows past it.</li><li><b>Lower bound</b>: your largest tenant must fit with headroom, and each cell has fixed overhead.</li><li><b>Blast radius</b> the business accepts: 1/N. Ten cells gives 10%, twenty gives 5%.</li></ul><p>Then the count follows from peak load divided by cell capacity at about 60% utilisation, plus a spare. More, smaller cells improve isolation and raise cost and operational load, so automation has to come first.</p>', lvl: 'deep' },
      { q: 'How do you move a tenant from one cell to another without downtime?', a: '<ol><li><b>Copy</b> the tenant\'s data to the target cell while it stays live in the source.</li><li><b>Catch up</b> with change replication until lag is seconds.</li><li><b>Pause writes</b> for that tenant only (seconds), let replication drain, <b>verify</b> counts or checksums.</li><li><b>Flip</b> the routing entry and publish a new map version. <b>Fence</b> the source so late writes are rejected, not lost.</li><li>Resume. Keep the source copy for a rollback window, then delete.</li></ol><p>I would run this as a resumable workflow with a checkpoint per phase, and I would build it early: rebalancing, retiring a cell and isolating a noisy tenant all depend on it.</p>', lvl: 'deep' },
      { q: 'What stays global, and why is that dangerous?', a: '<p>Typically: the <b>control plane</b> (cell creation, placement, migration, deploy orchestration), the <b>routing map</b>, <b>identity</b>, billing, and anything that must be unique across all tenants such as email addresses or domain names.</p><p>Each one is shared fate. The mitigations are: keep them <b>off the request path</b>; make the data plane <b>statically stable</b>, meaning it keeps serving from local copies when the control plane is down; cache global answers inside cells; and apply the strictest change process to them.</p>', lvl: 'deep' },
      { q: 'A cell is unhealthy. Should the router fail its tenants over to a healthy cell?', a: '<p><b>Not automatically.</b> If the cause is a poison request or one heavy tenant, failover carries the cause to the next cell, and then the next. A 1/N incident becomes N/N.</p><p>Failover is also hard in practice because the tenant\'s <b>data lives in its cell</b>. What I would do instead: keep each cell redundant across zones internally so infrastructure failures are handled inside it; throttle or isolate the offending tenant; and move tenants only through a deliberate, rate-limited control-plane migration.</p>', lvl: 'deep' },
      { q: 'What does this cost, and how would you justify it to leadership?', a: '<p>Costs: N copies of fixed overhead (load balancers, database minimums, observability), lower utilisation because each cell keeps its own headroom, a control plane and migration tooling to build, and slower rollouts.</p><p>The case: quantify the last year of incidents. If three outages affected all customers for a total of four hours, cells with a 5% blast radius would have turned most of that into four hours for 5% of customers. Compare the engineering cost with SLA credits, lost renewals and the size of customer the sales team can now sign. I would also propose an incremental path, not a rewrite.</p>', lvl: 'core' },
      { q: 'Design question: you run a single-stack B2B SaaS with 5,000 tenants. How do you get to cells?', a: '<ol><li><b>Make the key universal</b>: tenant ID in every request, table and log line.</li><li><b>Put a router in front</b> of the existing stack. It now has one cell. Nothing else changes.</li><li><b>Template the stack</b> as code so a second copy can be created automatically.</li><li><b>Create cell 2</b> and place only new, small tenants there. Deploy to it first: it is now your canary.</li><li><b>Build migration</b> and move tenants out of the original stack in batches until it is a normal-sized cell.</li><li><b>Remove shared dependencies</b> one by one, tracking each as a risk until gone.</li></ol><p>Each step is useful on its own and reversible. That is how I would present it in an interview: a strangler-style migration, not a big bang.</p>', lvl: 'deep' }
    ],

    code: [
      {
        title: 'Go: a thin cell router with a cached routing map', lang: 'go',
        code: `// Go 1.22+. The router only reads a header, looks up a map and forwards.
package main

import (
	"encoding/json"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sync/atomic"
	"time"
)

type routing struct {
	Version int64             // monotonically increasing snapshot version
	Tenants map[string]string // tenant ID -> cell ID
	Cells   map[string]string // cell ID -> base URL
}

var current atomic.Pointer[routing] // swapped as a whole, never mutated

// refresh pulls the snapshot the control plane publishes. On any error we
// keep the last good map: the control plane is not on the request path.
func refresh(src string) {
	for ; ; time.Sleep(5 * time.Second) {
		resp, err := http.Get(src)
		if err != nil {
			continue
		}
		var next routing
		err = json.NewDecoder(resp.Body).Decode(&next)
		resp.Body.Close()
		if old := current.Load(); err == nil && (old == nil || next.Version > old.Version) {
			current.Store(&next)
		}
	}
}

func route(w http.ResponseWriter, r *http.Request) {
	m := current.Load()
	if m == nil {
		http.Error(w, "routing map not loaded", http.StatusServiceUnavailable)
		return
	}
	cell, ok := m.Tenants[r.Header.Get("X-Tenant-Id")]
	if !ok {
		http.Error(w, "unknown tenant", http.StatusNotFound)
		return
	}
	target, _ := url.Parse(m.Cells[cell])
	// No retry in another cell: a poison request must stay where it is.
	httputil.NewSingleHostReverseProxy(target).ServeHTTP(w, r)
}

func main() {
	go refresh("https://routing.internal.example/v1/snapshot.json")
	http.ListenAndServe(":8080", http.HandlerFunc(route))
}`,
        note: 'In production you would build one reverse proxy per cell and reuse it, verify the tenant from the token instead of trusting a header, and load the first snapshot before accepting traffic. The shape stays the same: an atomic pointer to an immutable map, and no call to anything per request.'
      },
      {
        title: 'Spring Boot: deterministic shuffle-shard assignment', lang: 'java',
        code: `// Java 21, Spring Boot 3.x. Picks k of n workers for a tenant, the same way every time.
@ConfigurationProperties("cell")   // cell.workers=w1,w2,...  cell.shard-size=2
record CellProperties(List<String> workers, int shardSize) {}

@Component
public class ShuffleShardPicker {
  private final List<String> workers;   // stable order, so every instance agrees
  private final int shardSize;

  public ShuffleShardPicker(CellProperties props) {
    this.workers = props.workers().stream().sorted().toList();
    this.shardSize = Math.min(props.shardSize(), workers.size());
  }

  /**
   * Seeded partial Fisher-Yates shuffle: the tenant ID seeds the random source,
   * so every router instance computes the same shard with no shared state.
   */
  public List<String> shardFor(String tenantId) {
    long seed = UUID.nameUUIDFromBytes(tenantId.getBytes(StandardCharsets.UTF_8))
        .getMostSignificantBits();
    var rnd = new java.util.SplittableRandom(seed);
    var pool = new ArrayList<>(workers);
    var shard = new ArrayList<String>(shardSize);
    for (int i = 0; i < shardSize; i++) {
      int j = i + rnd.nextInt(pool.size() - i);   // pick from the not-yet-chosen tail
      Collections.swap(pool, i, j);
      shard.add(pool.get(i));
    }
    return List.copyOf(shard);
  }

  /** Client side: try the tenant's workers in order; a dead one is skipped. */
  public <T> T call(String tenantId, Function<String, T> request) {
    RuntimeException last = null;
    for (String worker : shardFor(tenantId)) {
      try { return request.apply(worker); }
      catch (RuntimeException e) { last = e; }   // retry only inside the tenant's own shard
    }
    throw last != null ? last : new IllegalStateException("empty shard");
  }
}`,
        note: 'The retry loop is what turns "shares one worker with a bad tenant" into "still works". It never leaves the tenant\'s own shard, so a poison request can kill at most <code>shardSize</code> workers. When the worker list changes, shards change too; systems that need stability store the assignment instead of recomputing it.'
      },
      {
        title: 'Terraform: every cell from one module, in deployment waves', lang: 'bash',
        code: `# Terraform 1.6+. One module call stamps out identical cells.
variable "release" {
  type        = map(string)            # wave number -> image tag
  description = "The pipeline bumps wave 0 first, then 1, then 2."
  default     = { "0" = "v42", "1" = "v41", "2" = "v41" }
}

locals {
  cells = {
    "cell-01" = { region = "eu-west-1", wave = 0, max_tenants = 500,  dedicated = false }
    "cell-02" = { region = "eu-west-1", wave = 1, max_tenants = 5000, dedicated = false }
    "cell-03" = { region = "us-east-1", wave = 2, max_tenants = 5000, dedicated = false }
    "cell-04" = { region = "us-east-1", wave = 2, max_tenants = 1,    dedicated = true  }
  }
}

module "cell" {
  source   = "./modules/cell"           # VPC, cluster, queue, Postgres, dashboards, alarms
  for_each = local.cells

  name          = each.key
  region        = each.value.region
  image_tag     = var.release[tostring(each.value.wave)]
  max_tenants   = each.value.max_tenants
  app_replicas  = 12                    # same shape everywhere: a cell is a fixed size
  db_instance   = "db.r6g.2xlarge"
  alarm_actions = [module.pipeline.rollback_topic]
}

# The control plane reads this to know which cells exist and where they are.
output "cell_endpoints" {
  value = { for name, c in module.cell : name => c.endpoint }
}`,
        note: 'The point is the shape, not the provider: <b>one template, N instances, a wave number per cell</b>. Real setups keep one state file (or one pipeline stage) per cell so a failed apply cannot touch other cells, and pass each cell\'s region through a provider alias.'
      }
    ],

    related: ['multi-tenancy', 'disaster-recovery', 'reliability-math', 'deployment-strategies', 'resiliency-patterns', 'sd:multi-region', 'sd:api-gateway']
  });
})();

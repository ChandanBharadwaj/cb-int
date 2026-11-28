(function () {
  const perDay = (v) => v.svc * v.dep / 5;               // production deploys per working day
  const nice = (x) => (x >= 100 ? Math.round(x).toLocaleString('en-US') : x >= 10 ? x.toFixed(0) : x.toFixed(1));

  SD.register({
    slug: 'ms-operations',
    domain: 10,
    title: 'Running Many Services: Versioning, Pipelines & Sidecars',
    examples: 'Kubernetes, Envoy, Backstage, Spotify',
    tagline: 'What changes when you run a hundred services instead of five: <b>a pipeline per service</b>, changes that are always <b>backward compatible</b>, cross-cutting work moved into <b>sidecars and the platform</b>, a <b>template</b> for new services, and a named <b>owner on call</b> for each one.',
    tldr: {
      problem: 'Splitting the code does not split the operations. If services still ship together, break each other\'s callers, each re-implement TLS and retries, and nobody knows who owns what, you have the cost of a hundred services and the speed of one.',
      idea: 'Give every service its <b>own pipeline</b> and make every change safe next to the old version (<b>expand → migrate → contract</b>). Move what every service needs (mTLS, retries, telemetry) into a <b>sidecar or the platform</b>. Start services from a <b>template</b> that registers them in a <b>catalog</b> with an owner and an on-call rota.',
      insight: 'During any rolling deploy, <b>old and new versions run at the same time</b>, and other services upgrade whenever they like. So "compatible with the previous version" is not a courtesy; it is the condition for deploying independently at all.',
      numbers: [
        { v: '3 phases', l: 'expand → migrate → contract ("Parallel Change", martinfowler.com)' },
        { v: '100+ / day', l: 'production deploys at Monzo across 2,100+ services (Monzo blog, 2022)' },
        { v: 'v1.33', l: 'Kubernetes release where native sidecar containers became stable (Kubernetes docs)' }
      ]
    },

    intro: {
      what: 'Running many services is the day-to-day work of building, releasing, changing and supporting them without the teams tripping over each other. It rests on four habits: each service <b>deploys on its own</b>, every change <b>works with the previous version</b>, shared plumbing lives in a <b>sidecar</b> (a helper process deployed next to the service) or the platform, and every service has a <b>known owner</b>.',
      analogy: {
        icon: '🏬',
        title: 'Shops in a shopping centre',
        text: 'Each shop opens, restocks and redecorates on its own schedule. The centre provides power, security and fire alarms once, for everyone. A new tenant gets a fitted unit, not a bare plot. And there is a list at the front desk saying who to call for each shop at night. The centre is the platform, the fitted unit is the service template, the list is the catalog. Unlike shops, services depend on each other every second, so a change in one must never surprise its neighbours.'
      },
      problem: 'Forty teams share one weekly release. A payment fix waits five days behind an unrelated search bug. When the release finally goes out, an event field has been renamed and three consumers crash. At 3 a.m. an alert fires for a service whose authors left last year. <b>How do many teams ship many services every day without coordinating every change?</b>',
      story: [
        {
          stage: 'naive',
          title: 'Many services, one release',
          text: 'The system was split into services, but they are still built, tested and released together on a shared pipeline. It feels safe: everything that goes out was tested as one set.',
          scene: {
            nodes: [
              { id: 'a', label: 'Orders team', sub: 'ready Monday', kind: 'team', at: [70, 0] },
              { id: 'b', label: 'Payments team', sub: 'ready Thursday', kind: 'team', at: [350, 0] },
              { id: 'train', label: 'Shared pipeline', sub: 'weekly release', kind: 'compute', at: [210, 110] },
              { id: 'prod', label: 'Production', sub: 'all services at once', kind: 'service', at: [210, 220] }
            ],
            edges: [{ from: 'a', to: 'train' }, { from: 'b', to: 'train' }, { from: 'train', to: 'prod' }],
            flow: [['a>train', 'b>train'], 'train>prod'],
            badges: { train: ['one release', 'info'] }
          }
        },
        {
          stage: 'breaks',
          title: 'Everyone waits, and changes still break',
          text: 'One failing service blocks the whole release. A big release changes many things at once, so failures are hard to trace and rollbacks undo everyone\'s work. Each team has also copied its own retry and TLS code, so a security fix means changing every service.',
          scene: {
            nodes: [
              { id: 'a', label: 'Orders team', sub: 'waiting 5 days', kind: 'team', at: [70, 0] },
              { id: 'b', label: 'Payments team', sub: 'test is red', kind: 'team', at: [350, 0] },
              { id: 'train', label: 'Shared pipeline', sub: 'blocked', kind: 'compute', at: [210, 110] },
              { id: 'prod', label: 'Production', sub: 'last week\'s code', kind: 'service', at: [210, 220] }
            ],
            edges: [{ from: 'a', to: 'train' }, { from: 'b', to: 'train' }, { from: 'train', to: 'prod', dashed: true }],
            flow: [['a>train', 'b>train']],
            err: ['train'], warn: ['a', 'b'],
            badges: { train: ['blocked', 'err'], a: ['fix not shipped', 'warn'] }
          }
        },
        {
          stage: 'fix',
          title: 'Own pipelines, compatible changes, shared platform',
          text: 'Each team deploys its service when it is ready. Changes are made in steps that always work with the previous version. The platform supplies the pipeline template and a sidecar for TLS, retries and telemetry, so those are fixed once for everyone.',
          scene: {
            nodes: [
              { id: 'a', label: 'Orders team', sub: 'ships Monday', kind: 'team', at: [70, 0] },
              { id: 'plat', label: 'Platform', sub: 'template + sidecar', kind: 'policy', at: [210, 0] },
              { id: 'b', label: 'Payments team', sub: 'ships Thursday', kind: 'team', at: [350, 0] },
              { id: 'pa', label: 'Own pipeline', sub: 'orders', kind: 'compute', at: [70, 110] },
              { id: 'pb', label: 'Own pipeline', sub: 'payments', kind: 'compute', at: [350, 110] },
              { id: 'prod', label: 'Production', sub: 'old + new side by side', kind: 'service', at: [210, 220] }
            ],
            edges: [{ from: 'a', to: 'pa' }, { from: 'b', to: 'pb' }, { from: 'pa', to: 'prod' }, { from: 'pb', to: 'prod' }, { from: 'plat', to: 'prod', dashed: true }],
            flow: ['a>pa', 'pa>prod', 'b>pb', 'pb>prod'],
            ok: ['prod', 'pa', 'pb'],
            badges: { prod: ['no waiting', 'ok'] }
          }
        }
      ],
      usedBy: ['Amazon ("you build it, you run it")', 'Netflix (full cycle developers, paved road)', 'Spotify (golden paths, Backstage)', 'Monzo (thousands of services, one platform)', 'Lyft (Envoy sidecar proxy)', 'Stripe (date-based API versions)'],
      whenToUse: [
        'More than a few teams deploy to the same system and <b>wait on each other</b> to release',
        'The same cross-cutting code (TLS, retries, logging) is <b>copied into every service</b>',
        'New services take weeks to reach production, or nobody can say <b>who owns</b> a running one'
      ],
      whenNot: [
        'One or two teams with one deployable: a single good pipeline is enough (see <a href="ms-monolith-vs-microservices.html">monolith or microservices</a>)',
        'You have no continuous delivery or monitoring yet: build those first, then split',
        'A handful of services: a full <a href="service-mesh.html">service mesh</a> and developer portal cost more than they save'
      ],
      glossary: [
        { term: 'Independent deployability', def: 'Being able to release one service to production without releasing or re-testing any other at the same time.' },
        { term: 'Backward compatible', def: 'A new version still works for callers and readers written against the old version.' },
        { term: 'Expand–contract (parallel change)', def: 'Making a breaking change in three safe steps: add the new form, move everyone over, then remove the old form.' },
        { term: 'Version skew', def: 'The period in which different versions of a service, or of its callers, run at the same time.' },
        { term: 'Sidecar', def: 'A helper container that runs next to the application in the same pod and handles a shared concern such as proxying or log shipping.' },
        { term: 'Golden path', def: 'The supported, pre-built way to create and run a service; optional to follow, but easier than the alternatives.' },
        { term: 'Service catalog', def: 'A searchable register of every service with its owner, on-call rota, tier, dependencies and links.' },
        { term: 'Tolerant reader', def: 'A consumer that ignores fields it does not know and does not fail when optional data is missing.' }
      ]
    },

    requirements: {
      functional: [
        '<b>One pipeline per service</b>: build, test and deploy it without any other service',
        '<b>Every change is compatible with version N−1</b>, because both run during a rollout and after a rollback',
        '<b>Breaking changes go through expand → migrate → contract</b>, never one step',
        '<b>Cross-cutting concerns are solved once</b>: in a sidecar, the platform, or a thin well-versioned library',
        '<b>New services start from a template</b> that includes pipeline, dashboards, alerts and catalog entry',
        '<b>Every service has one owning team</b> that is on call for it'
      ],
      nonFunctional: [
        'Lead time from merge to production under 1 hour for a normal change (<em>example target</em>)',
        'Zero releases that require two services to deploy at the same moment',
        'New service from template to first production deploy in under 1 day',
        'Fleet-wide security patch rolled out to every service within days, not quarters',
        '100% of running services have an owner and an on-call rota in the catalog',
        'Sidecar overhead budgeted: for example under 100 MB and a few milliseconds p99 per hop (<em>estimate; measure yours</em>)'
      ],
      outOfScope: [
        '<b>Release train for microservices</b>: separate services, one coordinated release',
        '<b>Flag-day change</b>: producer and all consumers must switch at the same instant',
        '<b>Fat shared library</b> with business logic that forces every service to upgrade together',
        '<b>Orphan service</b>: running in production with no team in the catalog',
        '<b>Golden cage</b>: a mandated stack with no supported way to deviate'
      ]
    },

    calculator: {
      inputs: [
        { id: 'svc', label: 'Services', min: 10, max: 3000, value: 200, log: true, fmt: 'num' },
        { id: 'dep', label: 'Deploys per service per week', min: 0.2, max: 20, value: 3, step: 0.1, log: true },
        { id: 'cfr', label: 'Change failure rate', min: 1, max: 30, value: 5, unit: '%' },
        { id: 'contract', label: 'Deploys that change an API or event contract', min: 1, max: 30, value: 8, unit: '%' },
        { id: 'pods', label: 'Pods per service (average)', min: 2, max: 50, value: 6 },
        { id: 'mem', label: 'Sidecar memory per pod', min: 10, max: 200, value: 50, unit: 'MB' }
      ],
      outputs: [
        { label: 'Production deploys per working day', fmt: 'raw', f: (v) => nice(perDay(v)) + ' / day' },
        { label: 'Average gap between deploys (8-hour day)', fmt: 'raw', f: (v) => { const m = 480 / perDay(v); return m >= 1 ? nice(m) + ' min' : Math.round(m * 60) + ' s'; } },
        { label: 'Failed deploys per day to detect and roll back', fmt: 'raw', f: (v) => nice(perDay(v) * v.cfr / 100) + ' / day' },
        { label: 'Contract changes per week · releases if each uses expand–migrate–contract', fmt: 'raw', f: (v) => { const c = v.svc * v.dep * v.contract / 100; return nice(c) + ' · ' + nice(c * 3); } },
        { label: 'Memory used by sidecars across the fleet', fmt: 'bytes', f: (v) => v.svc * v.pods * v.mem * 1024 * 1024 },
        { label: 'Releases to patch one cross-cutting bug: shared library · sidecar', fmt: 'raw', f: (v) => Math.round(v.svc).toLocaleString('en-US') + ' service releases · 1 platform rollout' }
      ],
      note: 'Simple arithmetic to show scale, not a benchmark. A working week is 5 days of 8 hours. The sidecar figure is memory only; a proxy also adds CPU and latency per hop, which you must measure. The last row is the main argument for moving cross-cutting code out of the application: a library fix needs <b>every service to rebuild and release</b>; a sidecar fix is one rollout by the platform team (which still restarts every pod). At this deploy rate, no human can review releases one by one: <b>detection and rollback must be automatic</b>.'
    },

    api: [
      { m: 'YAML', p: 'catalog-info.yaml (in every repo)', d: 'The catalog entry: <code>kind: Component</code>, name, <code>spec.owner</code> (a team, never a person), <code>lifecycle</code>, the APIs it provides and consumes, plus annotations linking the pipeline, dashboards and on-call rota.' },
      { m: 'POLICY', p: 'Compatibility rules for APIs and events', d: 'Allowed without notice: add optional fields, add endpoints, add enum values consumers must tolerate. Never: remove, rename, change a type or meaning, make optional required. Breaking change = expand–contract with a published removal date.' },
      { m: 'DOC', p: 'Service template (golden path)', d: 'A scaffold that produces a deployable service in minutes: build file, health endpoints, structured logs, OpenTelemetry, Dockerfile, pipeline, Kubernetes manifests, default alerts, runbook stub, catalog entry.' },
      { m: 'YAML', p: 'Schema registry compatibility mode', d: 'Per subject: <code>BACKWARD</code> (new readers can read old data, so upgrade consumers first) or <code>FULL</code>. Checked in the producer\'s CI before merge, so an incompatible schema never reaches a topic.' },
      { m: 'SLO', p: 'Service tier and on-call', d: 'Tier 1–3 per service decides the SLO, who is paged and how fast. Tier 1: paged 24×7, 5-minute acknowledgement. Tier 3: ticket next working day. Stored in the catalog, read by the alerting system.' },
      { m: 'RFC', p: 'Deprecation notice', d: 'What is going away, the replacement, the date, who still uses it (from contract tests or usage metrics), and the migration steps. The owning team drives the migration; it does not just announce it.' }
    ],
    dataModel: [
      { name: 'service (catalog entity)', store: 'Service catalog (e.g. Backstage, Postgres)', fields: [['name', 'text', 'pk'], ['owner_team', 'text', 'fk'], ['tier', 'smallint', 'idx'], ['lifecycle', 'experimental|production|deprecated'], ['oncall_rota', 'text'], ['repo_url', 'text'], ['template_version', 'text', 'idx']], note: '<code>template_version</code> shows how far each service has drifted from the golden path, which is what the platform team uses to plan fleet upgrades.' },
      { name: 'api_dependency', store: 'Service catalog', fields: [['consumer', 'text', 'pk'], ['provider', 'text', 'pk'], ['api', 'text', 'pk'], ['api_version', 'text'], ['last_seen', 'timestamptz', 'idx']], note: 'Filled from contract tests, mesh telemetry or traces. It answers "who still calls v1?" before anything is removed.' },
      { name: 'deployment', store: 'Deploy system', fields: [['service', 'text', 'pk'], ['version', 'text (git SHA)', 'pk'], ['environment', 'text', 'pk'], ['started_at', 'timestamptz', 'idx'], ['outcome', 'succeeded|rolled_back|failed'], ['triggered_by', 'text']], note: 'One row per rollout. Source for deploy frequency, lead time and change failure rate per service.' },
      { name: 'deprecation', store: 'Service catalog', fields: [['api', 'text', 'pk'], ['element', 'text', 'pk'], ['replacement', 'text'], ['announced_at', 'date'], ['remove_after', 'date', 'idx'], ['remaining_consumers', 'int']], note: 'The <b>contract</b> phase happens only when <code>remaining_consumers</code> is zero. Without this record the old form is never removed.' }
    ],

    architecture: {
      title: 'One service on the paved road, among hundreds',
      nodes: [
        { id: 'team', label: 'Owning team', sub: 'builds it, runs it', kind: 'team', wide: [95, 0], tall: [70, 0], tip: 'One stream-aligned team owns the service for its whole life: code, deploys, alerts and on-call.' },
        { id: 'tmpl', label: 'Service template', sub: 'golden path scaffold', kind: 'policy', wide: [290, 0], tall: [210, 0], tip: 'Maintained by the platform team. Creates the repository with pipeline, manifests, telemetry and catalog entry already wired.' },
        { id: 'cat', label: 'Service catalog', sub: 'owner · tier · on-call', kind: 'store', wide: [490, 0], tall: [350, 0], tip: 'The register of every service: who owns it, how critical it is, what it depends on, where its dashboards and runbooks are.' },
        { id: 'oncall', label: 'On-call engineer', sub: 'from the owning team', kind: 'person', wide: [890, 0], tall: [350, 105], tip: 'The alert is routed by looking up the service\'s owner and rota in the catalog.' },
        { id: 'repo', label: 'Service repo', sub: 'code + contract + config', kind: 'compute', wide: [290, 115], tall: [210, 105], tip: 'Everything needed to build and run this one service, including its API or event schema.' },
        { id: 'ci', label: 'Own pipeline', sub: 'build · test · scan', kind: 'compute', wide: [490, 115], tall: [210, 210], tip: 'Runs only this service\'s tests and checks. Nothing here waits for another team\'s service.' },
        { id: 'reg', label: 'Schema registry', sub: 'compatibility check', kind: 'store', wide: [690, 115], tall: [70, 210], tip: 'Rejects an API or event schema that is not compatible with the versions already published.' },
        { id: 'obs', label: 'Telemetry', sub: 'OpenTelemetry', kind: 'store', wide: [890, 115], tall: [350, 210], tip: 'Metrics, logs and traces labelled with service and version, so a canary can be compared with the stable version.' },
        { id: 'gitops', label: 'Deploy controller', sub: 'rolling · canary', kind: 'compute', wide: [490, 230], tall: [210, 315], tip: 'Replaces pods a few at a time and watches health. Old and new versions serve traffic together during the rollout.' },
        { id: 'v2', label: 'orders v42', sub: 'app + Envoy sidecar', kind: 'service', wide: [690, 230], tall: [350, 315], tip: 'The new version. The sidecar proxy handles mTLS, retries, timeouts and telemetry, so the application code does not.' },
        { id: 'v1', label: 'orders v41', sub: 'still serving', kind: 'service', wide: [690, 345], tall: [210, 420], tip: 'The previous version. It keeps running during the rollout and is what a rollback returns to.' },
        { id: 'cons', label: 'Consumers', sub: 'other teams, own pace', kind: 'service', wide: [890, 230], tall: [350, 420], tip: 'Callers and event readers owned by other teams. They upgrade on their own schedule, so they may be older or newer than you expect.' }
      ],
      edges: [
        { from: 'team', to: 'tmpl' },
        { from: 'tmpl', to: 'repo' },
        { from: 'tmpl', to: 'cat', label: 'registers' },
        { from: 'repo', to: 'ci' },
        { from: 'ci', to: 'reg' },
        { from: 'ci', to: 'gitops' },
        { from: 'gitops', to: 'v2' },
        { from: 'gitops', to: 'v1', dashed: true },
        { from: 'cons', to: 'v2' },
        { from: 'cons', to: 'v1' },
        { from: 'v2', to: 'obs' },
        { from: 'obs', to: 'oncall' },
        { from: 'cat', to: 'oncall', dashed: true }
      ]
    },

    scenarios: [
      {
        id: 'new', title: 'A new service in a day', tone: 'ok',
        steps: [
          { text: 'A team needs a Refunds service. They run the <b>service template</b> and answer four questions: name, owner, tier, language.', flow: ['team>tmpl'], badges: { tmpl: 'name · owner · tier' } },
          { text: 'The template creates the repository with build, health checks, tracing, manifests and pipeline, and <b>registers the service in the catalog</b> with its owner and rota.', flow: ['tmpl>repo', 'tmpl>cat'], ok: ['repo', 'cat'], badges: { cat: ['owner: team-refunds', 'ok'] }, labels: { v2: { label: 'refunds v1', sub: 'app + Envoy sidecar' } }, hidden: ['v1'] },
          { text: 'The first commit goes through the service\'s own pipeline and deploys. The sidecar is injected by the platform, so mTLS, retries and metrics work with no code.', flow: ['repo>ci', 'ci>gitops', 'gitops>v2'], ok: ['v2'], labels: { v2: { label: 'refunds v1', sub: 'app + Envoy sidecar' } }, hidden: ['v1'], badges: { v2: ['live, day 1', 'ok'] } },
          { text: 'Dashboards and default alerts already exist. If one fires, the catalog routes it to the owning team. The team wrote business code only.', flow: ['v2>obs', 'obs>oncall'], ok: ['oncall'], labels: { v2: { label: 'refunds v1', sub: 'app + Envoy sidecar' } }, hidden: ['v1'], tone: 'ok' }
        ]
      },
      {
        id: 'ec', title: 'Rename a field with expand–contract', tone: 'ok',
        steps: [
          { text: 'Orders wants to replace <code>amount</code> with <code>total</code> in its event. <b>Expand</b>: v42 writes <b>both</b> fields. The registry accepts it: adding an optional field is compatible.', flow: ['repo>ci', 'ci>reg', 'ci>gitops', 'gitops>v2'], ok: ['reg'], badges: { reg: ['compatible', 'ok'], v2: 'writes amount + total' } },
          { text: 'During the rollout v41 and v42 both publish. Old consumers read <code>amount</code> from either. Nothing breaks, and a rollback to v41 is safe.', flow: [['cons>v2', 'cons>v1']], ok: ['cons'], badges: { v1: 'writes amount', cons: ['reads amount', 'ok'] } },
          { text: '<b>Migrate</b>: each consuming team switches to <code>total</code> in its own release, whenever it suits them. The catalog or contract tests show who is left.', flow: ['cons>v2'], badges: { cons: 'reads total', cat: ['1 consumer left', 'warn'] }, nodes: ['cat'] },
          { text: '<b>Contract</b>: when no deployed consumer reads <code>amount</code>, a later release stops writing it. Three small releases, no coordination meeting, no flag day.', flow: ['repo>ci', 'ci>gitops', 'gitops>v2'], ok: ['v2', 'cat'], labels: { v2: { label: 'orders v47', sub: 'app + Envoy sidecar' }, v1: { label: 'orders v46', sub: 'still serving' } }, badges: { v2: ['writes total only', 'ok'], cat: ['0 consumers left', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'break', title: 'Rename in one step', tone: 'err',
        steps: [
          { text: 'A developer renames <code>amount</code> to <code>total</code> in one commit. The schema check is not enforced for this topic, so the pipeline is green.', flow: ['repo>ci', 'ci>gitops'], hidden: ['reg'], badges: { ci: 'green' } },
          { text: 'The rollout starts. Half the pods are v42 and write <code>total</code>; half are v41 and write <code>amount</code>. Consumers read <code>amount</code>: <b>every second message fails</b>.', flow: ['gitops>v2', ['cons>v2', 'cons>v1']], hidden: ['reg'], err: ['cons'], warn: ['v2'], badges: { cons: ['50% errors', 'err'] }, tone: 'err' },
          { text: 'The rollout completes and now <b>every</b> message fails. The consumer teams did not deploy anything; from their side the system just broke.', flow: ['cons>v2', 'v2>obs', 'obs>oncall'], hidden: ['reg', 'v1'], err: ['cons', 'oncall'], badges: { oncall: ['paged: 3 teams', 'err'] }, tone: 'err' },
          { text: 'Rollback helps the API, but events already written with <code>total</code> stay in the topic and still fail when read. A one-step breaking change cannot be fully undone.', flow: ['gitops>v1'], warn: ['v1'], badges: { v1: ['rolled back', 'warn'], cons: ['poison messages', 'warn'] }, tone: 'warn' },
          { text: 'Fix: enforce the <b>compatibility check in CI</b> for every schema, and make consumers <b>tolerant readers</b>. The breaking commit would have failed before merge.', flow: ['repo>ci', 'ci>reg'], err: ['reg'], badges: { reg: ['incompatible: rejected', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'fleet', title: 'Fleet-wide fix across 300 services', tone: 'warn',
        steps: [
          { text: 'A vulnerability is found in the TLS handling that every service uses. There are 300 services owned by 40 teams.', nodes: ['v2', 'v1', 'cons'], warn: ['v2', 'v1', 'cons'], badges: { cons: ['300 services', 'warn'] } },
          { text: 'If TLS lives in a <b>shared library</b>, each service must bump the dependency, rebuild and release: 300 pull requests, 40 backlogs. The slowest team sets the exposure time.', flow: ['repo>ci', 'ci>gitops'], warn: ['repo'], labels: { v2: { label: 'orders v42', sub: 'app + TLS library' } }, badges: { repo: ['× 300 PRs', 'warn'] }, tone: 'warn' },
          { text: 'If TLS lives in the <b>sidecar</b>, the platform team releases one new proxy image and the deploy controller restarts pods gradually. No application code changes.', flow: ['gitops>v2', 'gitops>v1'], ok: ['v2', 'v1'], badges: { gitops: 'new proxy image', v2: ['sidecar patched', 'ok'] } },
          { text: 'For what must stay in a library, drive the change <b>centrally</b>: the platform team opens and merges the 300 changes with automation and tracks progress by <code>template_version</code> in the catalog.', flow: ['tmpl>repo', 'tmpl>cat'], ok: ['cat'], badges: { cat: ['291 / 300 done', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'orphan', title: 'An alert for a service nobody owns', tone: 'err',
        steps: [
          { text: 'At 03:10 an alert fires for <code>coupon-sync</code>. It was written two years ago by a team that has since been reorganised.', flow: ['v2>obs'], err: ['v2'], labels: { v2: { label: 'coupon-sync v9', sub: 'no template, no sidecar' } }, hidden: ['v1', 'tmpl'], badges: { v2: ['error rate 40%', 'err'] } },
          { text: 'The catalog has no entry for it. The alert goes to a general channel. Whoever sees it has no runbook, no dashboard link and no idea what calls this service.', flow: ['obs>oncall'], err: ['cat', 'oncall'], labels: { v2: { label: 'coupon-sync v9', sub: 'no template, no sidecar' } }, hidden: ['v1', 'tmpl'], badges: { cat: ['no owner', 'err'], oncall: ['who is this?', 'err'] }, tone: 'err' },
          { text: 'Fix the rule, not the night: <b>nothing deploys without an owner in the catalog</b>. The pipeline checks the entry; alert routing reads it.', flow: ['ci>gitops'], nodes: ['cat'], ok: ['cat'], hidden: ['v1'], badges: { cat: ['owner required', 'ok'] } },
          { text: 'When teams change, ownership is handed over explicitly or the service is retired. A quarterly report lists services with no recent deploy, no owner or an old template.', flow: ['cat>oncall'], ok: ['oncall', 'team'], nodes: ['team'], hidden: ['v1'], badges: { oncall: ['clear rota', 'ok'] }, tone: 'ok' }
        ]
      }
    ],

    knobs: {
      intro: 'Each control is a real operating choice for about 200 services and 30 teams. Meter values are <em>illustrative</em> judgements, not benchmarks.',
      controls: [
        { id: 'rel', label: 'Release unit', type: 'seg', value: 'prog', options: [
          { v: 'train', l: 'Release train (all together)' }, { v: 'per', l: 'Pipeline per service' }, { v: 'prog', l: 'Per service + canary' }] },
        { id: 'compat', label: 'Breaking changes', type: 'seg', value: 'ec', options: [
          { v: 'break', l: 'Change and coordinate' }, { v: 'ver', l: 'New API version (v1 + v2)' }, { v: 'ec', l: 'Expand–contract' }] },
        { id: 'cross', label: 'TLS, retries, telemetry live in', type: 'seg', value: 'side', options: [
          { v: 'copy', l: 'Each service\'s own code' }, { v: 'lib', l: 'Shared library' }, { v: 'side', l: 'Sidecar / platform' }] },
        { id: 'path', label: 'Starting a service', type: 'seg', value: 'tmpl', options: [
          { v: 'none', l: 'Every team invents it' }, { v: 'tmpl', l: 'Template + catalog (optional)' }, { v: 'mandate', l: 'One mandated stack' }] }
      ],
      evaluate(s) {
        const clamp = (x) => Math.max(0.03, Math.min(0.97, x));
        const R = s.rel, C = s.compat, X = s.cross, P = s.path;
        const lead = { train: 0.2, per: 0.75, prog: 0.8 }[R] + { break: -0.15, ver: 0, ec: 0.03 }[C] + { none: -0.1, tmpl: 0.08, mandate: 0.05 }[P];
        const indep = { train: 0.12, per: 0.8, prog: 0.85 }[R] + { break: -0.4, ver: 0, ec: 0.06 }[C] + { copy: 0, lib: -0.1, side: 0.03 }[X];
        const blast = { train: 0.25, per: 0.55, prog: 0.88 }[R] + { break: -0.3, ver: 0, ec: 0.05 }[C];
        const fleet = { copy: 0.1, lib: 0.45, side: 0.85 }[X] + { none: -0.08, tmpl: 0.08, mandate: 0.1 }[P];
        const over = { copy: 0.9, lib: 0.85, side: 0.55 }[X];
        const cog = { none: 0.25, tmpl: 0.82, mandate: 0.6 }[P] + { copy: -0.15, lib: 0, side: 0.08 }[X] + { break: -0.05, ver: -0.1, ec: 0 }[C];
        const metrics = [
          { k: 'Lead time to production', v: lead >= 0.7 ? 'under an hour' : lead >= 0.4 ? 'hours to a day' : 'days: wait for the train', s: clamp(lead) },
          { k: 'Deploy independence', v: indep >= 0.7 ? 'any service, any time' : indep >= 0.4 ? 'mostly, with some lockstep releases' : 'services must ship together', s: clamp(indep) },
          { k: 'Damage from a bad change', v: blast >= 0.75 ? 'a few % of traffic, auto rollback' : blast >= 0.45 ? 'one service, manual rollback' : 'many services at once', s: clamp(blast) },
          { k: 'Fleet-wide upgrade effort', v: fleet >= 0.75 ? 'one platform rollout' : fleet >= 0.4 ? 'a dependency bump in every repo' : 'a different fix in every repo', s: clamp(fleet), hint: 'lower bar = more work' },
          { k: 'Runtime overhead', v: X === 'side' ? 'extra proxy per pod: memory + a hop' : 'in-process: almost none', s: clamp(over) },
          { k: 'Cognitive load per team', v: cog >= 0.7 ? 'low: focus on business code' : cog >= 0.45 ? 'moderate' : 'high: every team runs its own platform', s: clamp(cog), hint: 'lower bar = more load' }
        ];
        const notes = [];
        if (R === 'train') notes.push('A release train gives up the main benefit of separate services. Every change waits for the slowest one, and a rollback undoes everybody\'s work.');
        if (R === 'per') notes.push('Without progressive delivery every deploy goes to 100% of traffic at once. At hundreds of deploys a day, rollback has to be automatic.');
        if (C === 'break') notes.push('Even with perfect coordination, old and new pods run together during a rolling deploy, so a one-step breaking change fails some requests for the length of the rollout.');
        if (C === 'ver') notes.push('A new API version is the right tool for external clients you cannot migrate. Internally it leaves two versions to run and test until someone removes v1; set that date up front.');
        if (C === 'ec') notes.push('Expand–contract costs three small releases and needs to know who still uses the old form: contract tests or usage metrics per field.');
        if (X === 'copy') notes.push('Each copy drifts. A fleet-wide fix becomes a different change in every repository.');
        if (X === 'lib') notes.push('A thin, stable library is fine for one language. In a polyglot fleet you maintain it once per language, and upgrades depend on every team\'s backlog.');
        if (X === 'side') notes.push('A sidecar works for any language and upgrades without application releases. It costs memory and a proxy hop per call, and the platform team must run it well. See <a href="service-mesh.html">service mesh</a>.');
        if (P === 'none') notes.push('With no golden path, each new service repeats weeks of pipeline, logging and alert setup, and no two look alike when you are on call.');
        if (P === 'mandate') notes.push('A mandate removes choice but also the escape hatch. Teams with a real need to differ will work around it, off the catalog.');
        let verdict;
        if (R === 'train') verdict = '❌ <b>Distributed monolith in operations:</b> many services, one release. You pay for microservices and get monolith speed.';
        else if (C === 'break') verdict = '❌ <b>Breaking changes cancel independent deploys.</b> Version skew during rollouts makes one-step changes fail even when teams coordinate.';
        else if (X === 'copy' && P === 'none') verdict = '⚠ <b>Every team is its own platform team.</b> Works at 10 services; at 200 the duplicated plumbing becomes the main cost.';
        else if (R === 'prog' && C === 'ec' && X === 'side' && P === 'tmpl') verdict = '✅ <b>The paved road:</b> independent pipelines with canaries, compatible changes, plumbing in the platform, and a template teams choose because it is easier.';
        else if (P === 'mandate') verdict = '👍 <b>Efficient but rigid.</b> Add a supported way to leave the path, with the cost of doing so made clear.';
        else verdict = '👍 <b>Workable.</b> The lowest meter shows where the next quarter of platform work should go.';
        const hide = [];
        if (P === 'none') hide.push('tmpl', 'cat');
        if (C === 'break') hide.push('reg');
        if (R === 'train') hide.push('v1');
        const flow = [];
        if (P !== 'none') flow.push('team>tmpl', 'tmpl>repo'); else flow.push('team>repo');
        flow.push('repo>ci');
        if (C !== 'break') flow.push('ci>reg');
        flow.push('ci>gitops', 'gitops>v2', 'cons>v2', 'v2>obs', 'obs>oncall');
        const labels = {
          ci: R === 'train' ? { label: 'Shared pipeline', sub: 'all services together' } : { label: 'Own pipeline', sub: 'build · test · scan' },
          gitops: R === 'train' ? { label: 'Release train', sub: 'weekly, everything' } : R === 'per' ? { label: 'Deploy controller', sub: 'rolling update' } : { label: 'Deploy controller', sub: 'canary + auto rollback' },
          v2: { label: 'orders v42', sub: X === 'side' ? 'app + Envoy sidecar' : X === 'lib' ? 'app + shared library' : 'app + own retry code' },
          reg: C === 'ver' ? { label: 'API versions', sub: 'v1 and v2 both live' } : { label: 'Schema registry', sub: 'compatibility check' }
        };
        const badges = {};
        if (R === 'train') badges.gitops = ['everyone waits', 'err'];
        if (R === 'prog') badges.gitops = ['5% → 100%', 'ok'];
        if (C === 'break') badges.cons = ['breaks mid-rollout', 'err'];
        if (X === 'side') badges.v2 = ['patched centrally', 'ok'];
        if (X === 'copy') badges.v2 = ['200 copies', 'warn'];
        if (P === 'none') badges.oncall = ['owner unknown', 'warn'];
        return {
          metrics, verdict, notes: notes.slice(0, 4), labels, hide, flow, badges,
          err: (R === 'train' ? ['gitops'] : []).concat(C === 'break' ? ['cons'] : []),
          warn: (X === 'copy' ? ['v2'] : []).concat(P === 'none' ? ['oncall'] : []),
          ok: (C === 'ec' ? ['reg'] : []).concat(P === 'tmpl' ? ['cat'] : []),
          hot: R === 'train' ? ['ci'] : []
        };
      }
    },

    widget: {
      title: 'Version skew lab: roll out a field rename',
      caption: 'A producer and a consumer service, four pods each, deployed <b>independently</b>. The producer is renaming <code>amount</code> to <code>total</code>. Pick a target version for either service and roll it out one pod at a time while messages keep flowing. Go straight to <b>v3</b> to see a one-step breaking change, then reset and do it in the safe order: <b>expand, migrate, contract</b>.'
    },

    realWorld: {
      intro: 'The practices on this page come from companies that reached hundreds or thousands of services and wrote down what they had to build around them.',
      timeline: [
        { when: '2006', who: 'Werner Vogels (Amazon)', title: '"You build it, you run it"', text: 'In an ACM Queue interview with Jim Gray, Amazon\'s CTO describes giving developers operational responsibility for their services. The phrase "you build it, you run it" is widely quoted from this conversation and became the ownership model most microservice organisations copy.', src: 0 },
        { when: '2014', who: 'martinfowler.com', title: 'Parallel Change (expand and contract)', text: 'Defines the pattern for making a backward-incompatible interface change safely in three phases: <b>expand</b>, <b>migrate</b>, <b>contract</b>. It notes that migrating external clients is usually the longest phase, and that skipping the contract phase can leave you worse off than before.', src: 1 },
        { when: '2016–2018', who: 'Lyft · CNCF', title: 'Envoy: the sidecar proxy', text: 'Envoy was built at Lyft and open-sourced in 2016. Running it next to every service put networking features in one out-of-process component that works for any language. CNCF announced Envoy\'s graduation in November 2018.', src: 12 },
        { when: '2017', who: 'Stripe', title: 'API versioning with date-named versions', text: 'Stripe describes keeping every API version since 2011 compatible. Versions are named by release date; internally, a request is processed by current code and the response is walked back through small <b>version change modules</b> until it matches the caller\'s pinned version.', src: 2 },
        { when: '2018', who: 'Netflix', title: 'Full cycle developers', text: 'Netflix\'s Edge Engineering describes teams that design, build, test, deploy, operate and support their own services, made practical by centralised tooling. InfoQ\'s report notes the link to Vogels\' model and that teams may leave the "paved road" when they need to.', src: 3 },
        { when: '2020', who: 'Spotify', title: 'Golden paths and Backstage', text: 'Spotify describes <b>golden paths</b> as its answer to fragmented tools and practices: an opinionated, supported way to build each kind of software. In March 2020 it open-sourced <b>Backstage</b>, its developer portal with a software catalog and templates.', src: 5 },
        { when: '2020', who: 'Uber', title: 'Domain-Oriented Microservice Architecture', text: 'With about 2,200 critical microservices, Uber grouped services into <b>domains</b> with a single gateway per domain, organised in layers, so that teams depend on a few stable domain interfaces instead of thousands of individual services.', src: 10 },
        { when: '2022–2024', who: 'Monzo', title: 'Thousands of services on one platform', text: 'Monzo reported deploying to production over 100 times a day in 2022, across more than 2,100 services, with automated rollbacks added through Argo Rollouts. A 2024 post explains how one team centrally drives migrations (such as a tracing library change) across 2,800 services instead of handing the work to each owner.', src: 7 },
        { when: '2023–2025', who: 'Kubernetes', title: 'Native sidecar containers', text: 'Kubernetes added first-class sidecars in v1.28: an init container with <code>restartPolicy: Always</code> starts before the application containers and is stopped after them. The feature is stable as of v1.33, which fixes long-standing start-up and shutdown ordering problems for proxies.', src: 8 }
      ],
      lessons: [
        'Independent deploys require <b>compatible changes</b>; the two cannot be separated.',
        'Solve plumbing <b>once</b>: sidecar or platform first, thin library second, copy-paste never.',
        'A golden path wins by being <b>easier</b>, not by being mandatory.',
        'Fleet-wide migrations work when <b>one team drives them</b> with automation.',
        'No owner in the catalog, <b>no deploy</b>.'
      ],
      sources: [
        { title: 'A Conversation with Werner Vogels', url: 'https://queue.acm.org/detail.cfm?id=1142065', pub: 'ACM Queue, 2006' },
        { title: 'Parallel Change', url: 'https://www.martinfowler.com/bliki/ParallelChange.html', pub: 'martinfowler.com bliki' },
        { title: 'APIs as infrastructure: future-proofing Stripe with versioning', url: 'https://stripe.com/blog/api-versioning', pub: 'Stripe blog, 2017' },
        { title: 'InfoQ report on "Full Cycle Developers at Netflix"', url: 'https://www.infoq.com/news/2018/06/netflix-full-cycle-developers/', pub: 'InfoQ, June 2018 (reporting the Netflix Tech Blog)' },
        { title: 'What the Heck is Backstage Anyway?', url: 'https://engineering.atspotify.com/2020/3/what-the-heck-is-backstage-anyway', pub: 'Spotify Engineering, March 2020' },
        { title: 'How We Use Golden Paths to Solve Fragmentation in Our Software Ecosystem', url: 'https://engineering.atspotify.com/2020/8/how-we-use-golden-paths-to-solve-fragmentation-in-our-software-ecosystem', pub: 'Spotify Engineering, August 2020' },
        { title: 'How we deploy to production over 100 times a day', url: 'https://monzo.com/blog/2022/05/16/how-we-deploy-to-production-over-100-times-a-day', pub: 'Monzo, May 2022' },
        { title: 'How we run migrations across 2,800 microservices', url: 'https://monzo.com/blog/how-we-run-migrations-across-2800-microservices', pub: 'Monzo, 2024' },
        { title: 'Sidecar Containers', url: 'https://kubernetes.io/docs/concepts/workloads/pods/sidecar-containers/', pub: 'Kubernetes documentation' },
        { title: 'Schema Evolution and Compatibility', url: 'https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html', pub: 'Confluent documentation' },
        { title: 'Introducing Domain-Oriented Microservice Architecture', url: 'https://www.uber.com/blog/microservice-architecture/', pub: 'Uber Engineering, 2020' },
        { title: 'Protocol Buffers Language Guide (proto3): updating a message type', url: 'https://protobuf.dev/programming-guides/proto3/', pub: 'protobuf.dev' },
        { title: 'CNCF announces Envoy graduation', url: 'https://www.cncf.io/announcements/2018/11/28/cncf-announces-envoy-graduation/', pub: 'CNCF, November 2018' },
        { title: 'Argo Rollouts at scale: Bringing Automated Rollbacks to 2,100+ services at Monzo', url: 'https://monzo.com/blog/2022/11/02/argo-rollouts-at-scale', pub: 'Monzo, November 2022' },
        { title: 'Kubernetes v1.28: Introducing native sidecar containers', url: 'https://kubernetes.io/blog/2023/08/25/native-sidecar-containers', pub: 'Kubernetes blog, August 2023' }
      ]
    },

    tradeoffs: {
      headers: ['Decision', 'Option A', 'Option B', 'Pick when…'],
      rows: [
        ['Breaking change', '<b>Expand–contract</b>: one API, three compatible releases', '<b>New major version</b> (v2 next to v1): clean break, two versions to run', 'Expand–contract inside the company; a new version for external clients you cannot move, with a removal date'],
        ['Event compatibility mode', '<b>BACKWARD</b>: new readers handle old data; upgrade consumers first', '<b>FORWARD / FULL</b>: old readers handle new data; producers can go first', 'BACKWARD when consumers may replay old events; FULL when you cannot control deploy order at all'],
        ['Cross-cutting concerns', '<b>Sidecar / platform</b>: any language, upgraded centrally; costs memory and a hop', '<b>Shared library</b>: in-process, fast; one per language, upgraded by each team', 'Sidecar for network concerns in a polyglot fleet; a thin library for what needs application context (see <a href="container-patterns.html">container patterns</a>)'],
        ['Repository layout', '<b>Repo per service</b>: clear ownership and pipelines, harder cross-cutting changes', '<b>Monorepo</b>: atomic refactors and one toolchain; needs build tooling to keep pipelines per service', 'Either works. What matters is that the <b>deploy</b> stays per service'],
        ['Golden path', '<b>Optional but best supported</b>: teams choose it because it is easier', '<b>Mandatory</b>: uniform fleet, no escape for real exceptions', 'Optional by default; mandate only the few things that are about safety (ownership, TLS, audit)'],
        ['On-call', '<b>Owning team</b> ("you build it, you run it"): fast feedback into the code', '<b>Central operations / SRE</b>: specialists, but far from the code', 'Owning team for its services; platform or SRE team on call for the shared platform itself']
      ]
    },
    failures: [
      { f: 'Lockstep releases: two services must deploy together', detect: 'Release notes say "deploy A and B at the same time"; rollbacks need both', fix: 'Split the change with expand–contract; add a contract test and a registry check so the coupled change cannot merge.' },
      { f: 'Breaking change during a rolling deploy', detect: 'Error rate rises in proportion to rollout progress, then recovers or stays high', fix: 'Every version must work with N−1 on both sides; test old-reader/new-writer and new-reader/old-writer in CI.' },
      { f: 'The contract phase never happens', detect: 'Deprecated fields and v1 endpoints live for years; nobody knows if they are used', fix: 'Record each deprecation with a date and consumer count; track field-level usage; the owning team migrates the last consumers itself.' },
      { f: 'Shared library forces a fleet-wide upgrade', detect: 'A library release needs all services on the same version; diamond dependency conflicts', fix: 'Keep libraries thin and backward compatible; no domain model in them; move network concerns to a sidecar.' },
      { f: 'Sidecar lifecycle bugs', detect: 'Requests fail at pod start or shutdown; Jobs never finish because the proxy keeps running', fix: 'Use native sidecars (init container with <code>restartPolicy: Always</code>) so the proxy starts first and stops last.' },
      { f: 'Orphan and zombie services', detect: 'Alerts with no clear owner; services with no deploy for a year', fix: 'Catalog entry with owner required to deploy; quarterly ownership review; retire what nobody will own.' },
      { f: 'Template drift', detect: 'Services created from the template two years ago lack today\'s defaults', fix: 'Version the template; record the version per service; push updates as automated pull requests.' }
    ],

    interview: [
      { q: 'What changes operationally when you go from 5 services to 200?', a: '<ul><li><b>Releases</b>: hundreds of deploys a day, so each service needs its own automated pipeline with automatic rollback. Nobody can approve them by hand.</li><li><b>Compatibility</b>: some version of everything is always mid-rollout, so every change must work with the previous version.</li><li><b>Duplication</b>: TLS, retries, logging and metrics multiplied by 200 must move into a platform or sidecar.</li><li><b>Knowledge</b>: no one knows all the services. You need a catalog with owners, dependencies and on-call.</li><li><b>Consistency</b>: without a template, 200 services are built 200 ways and on-call becomes guesswork.</li></ul><p>In short, you need a platform and rules that replace coordination between people.</p>', lvl: 'core' },
      { q: 'What does "independently deployable" require in practice?', a: '<p>A service is independently deployable if you can release it to production <b>without releasing, re-testing or notifying</b> any other service. That needs:</p><ul><li>its own pipeline and artefact;</li><li>its own data (no shared tables that force joint schema changes);</li><li>backward-compatible API and event changes;</li><li>tests that do not need the whole system (component and contract tests);</li><li>rollouts that tolerate old and new versions side by side.</li></ul><p>A quick test: look at the last ten releases. If several say "deploy with service X", you have a distributed monolith, whatever the diagram shows.</p>', lvl: 'core' },
      { q: 'Explain expand–contract with a concrete example.', a: '<p>Goal: rename event field <code>amount</code> to <code>total</code>.</p><ol><li><b>Expand</b>: the producer writes both <code>amount</code> and <code>total</code>. Old consumers are unaffected.</li><li><b>Migrate</b>: each consumer changes to read <code>total</code> (ideally falling back to <code>amount</code> for old messages) and deploys when it likes.</li><li><b>Contract</b>: when no deployed consumer reads <code>amount</code>, and old messages have aged out or been handled, the producer stops writing it.</li></ol><p>Each step is a normal, reversible release. The pattern is called Parallel Change on Martin Fowler\'s site. The hard parts are knowing who still uses the old form and actually doing step 3. The same three steps apply to database columns; see <a href="zero-downtime-migrations.html">zero-downtime migrations</a>.</p>', fu: 'How do you know when it is safe to contract?', lvl: 'core' },
      { q: 'How do you version an HTTP or gRPC API, and when do you create a v2?', a: '<p>First choice: <b>do not version; evolve compatibly</b>. Add optional fields and new methods; never remove, rename or change meaning. Clients must be tolerant readers.</p><p>When a real break is unavoidable:</p><ul><li><b>Path or package version</b> (<code>/v2/orders</code>, <code>shop.orders.v2</code>): simple and visible; whole-API granularity.</li><li><b>Header or media-type version</b>: keeps URLs stable; harder to see and test.</li><li><b>Date-pinned versions</b> (Stripe): each client is pinned to the version it first used; the server transforms responses backwards through small compatibility modules.</li></ul><p>I create a v2 only for external or uncontrollable clients, and I set v1\'s end date and usage tracking on the same day. Inside the company, expand–contract is cheaper. In Protobuf, never reuse or renumber a field tag; mark removed ones <code>reserved</code>.</p>', lvl: 'core' },
      { q: 'Backward versus forward compatibility for events: which side deploys first?', a: '<p><b>Backward compatible</b>: a consumer using the <b>new</b> schema can read data written with the <b>old</b> one. So upgrade <b>consumers first</b>, then producers. This is the Confluent Schema Registry default (<code>BACKWARD</code>) and it matters for Kafka because consumers may re-read old events.</p><p><b>Forward compatible</b>: a consumer on the <b>old</b> schema can read data written with the <b>new</b> one. Producers can go first.</p><p><b>Full</b> means both, so order does not matter: in Avro or Protobuf, that is adding or removing only fields with defaults. The <code>_TRANSITIVE</code> variants check against all earlier versions, not just the last. If I cannot control deploy order across teams, I require FULL.</p>', lvl: 'deep' },
      { q: 'Why is version skew unavoidable, and what rule follows from it?', a: '<p>A rolling update replaces pods a few at a time, so for minutes <b>version N and N+1 both serve traffic</b>. A canary keeps both for longer. A rollback brings N back after N+1 has already written data and sent messages. And callers owned by other teams are on whatever version they last deployed.</p><p>The rule: <b>every release must interoperate with the previous one in both directions</b>: new code reads what old code wrote, and old code tolerates what new code wrote. That is why a "simple rename" needs three releases, and why you never ship a schema change and the code that requires it in the same step.</p>', lvl: 'deep' },
      { q: 'Sidecar, shared library or a platform service: where do cross-cutting concerns belong?', a: '<ul><li><b>Sidecar</b> (Envoy, a log or secrets agent): language-neutral and upgraded centrally without rebuilding applications. Costs memory per pod, a local network hop, and operational skill. Best for network concerns: mTLS, retries, timeouts, traffic shifting, standard telemetry.</li><li><b>Library</b>: in-process, no extra hop, sees application context (business metrics, custom spans). Needs one implementation per language and every team must upgrade. Keep it thin and compatible.</li><li><b>Platform service</b> (gateway, identity, config): a network call to a shared system; right when state must be central.</li></ul><p>My default: network behaviour in the sidecar or mesh, instrumentation via OpenTelemetry libraries, and no business logic in anything shared. For depth see <a href="service-mesh.html">service mesh</a> and <a href="container-patterns.html">container patterns</a>.</p>', lvl: 'core' },
      { q: 'What is a golden path, and how do you stop it becoming a cage?', a: '<p>A golden path (Spotify\'s term; Netflix says paved road) is the <b>opinionated, supported way</b> to build and run a kind of software: a template that gives a new service its pipeline, runtime config, telemetry, alerts and catalog entry in minutes.</p><p>It stays healthy if:</p><ul><li>it is <b>optional but clearly the easiest</b> route; adoption is the measure of its quality;</li><li>leaving it is allowed, with the team taking on the support cost;</li><li>the platform team treats it as a product with users, versions and a roadmap;</li><li>only a few safety items are mandatory: an owner, TLS, audit logging.</li></ul><p>See <a href="platform-engineering.html">platform engineering</a> for how to run that team.</p>', lvl: 'core' },
      { q: 'What goes into a service catalog and who keeps it correct?', a: '<p>Per service: owning team, on-call rota, tier, lifecycle state, repository, pipeline, dashboards, runbooks, APIs provided and consumed, and the template version. Backstage stores this as a <code>catalog-info.yaml</code> file in each repository.</p><p>It stays correct only if it is <b>used by machines</b>: the pipeline refuses to deploy without a valid entry, alert routing reads the owner from it, and cost reports group by it. A catalog that is only documentation is out of date within a quarter. Dependencies should be discovered from traces or contract tests, not typed by hand.</p>', lvl: 'core' },
      { q: 'A critical library has a vulnerability and 500 services use it. How do you roll out the fix?', a: '<ol><li><b>Find exposure</b>: query the catalog and dependency data for services and versions affected; rank by tier and internet exposure.</li><li><b>If it sits in a sidecar or base image</b>: the platform team ships one new image and restarts pods gradually, tier 3 first as a canary, then tier 1.</li><li><b>If it is an application dependency</b>: do not send an email asking 60 teams to act. One team <b>drives the migration centrally</b>: automated pull requests, auto-merge when the service\'s own pipeline is green, mass deploy in batches. Monzo describes this model for 2,800 services.</li><li><b>Track</b> completion on a dashboard; chase the long tail personally.</li><li><b>Afterwards</b>: ask why this concern was in 500 codebases and whether it can move to the platform.</li></ol>', lvl: 'deep' },
      { q: 'Who should be on call for a microservice?', a: '<p>The team that builds it: "you build it, you run it" (Werner Vogels, 2006). The people who feel the pain are the ones who can remove its cause, so quality improves. Netflix calls this the full cycle developer.</p><p>It works only with support: good tooling and dashboards from the platform, sane alert volume, a rota large enough to be humane (roughly six or more people), and tiering so that only important services page at night. The platform or SRE team is on call for the <b>platform</b>, not for product services. When a team is too small or the service is in pure maintenance, merge services or transfer ownership explicitly; never leave it implicit.</p>', lvl: 'core' },
      { q: 'Teams say the platform slows them down and want to go their own way. How do you respond?', a: '<p><em>Sample answer; adapt to your experience.</em></p><p>I would treat it as product feedback, not disobedience. First, find the specific friction: is it lead time for a platform change, a missing capability, or a rule with no clear reason? I would sit with two of the loudest teams and watch a full change go through.</p><p>Then: fix the top two frictions quickly and visibly; publish which few rules are mandatory and why (ownership, security); and define a supported exit: a team may leave the path if it accepts on-call and upgrade work for what it builds. Most teams choose the path once the cost of leaving is concrete. I would measure adoption and time-to-first-deploy, and report both to the teams.</p>', lvl: 'deep' }
    ],

    code: [
      {
        title: 'Kubernetes: rolling update that tolerates skew, with a native sidecar', lang: 'yaml',
        code: `# Kubernetes 1.29+ (native sidecars on by default; stable in 1.33)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orders
  labels: { app: orders, owner: team-orders, tier: "1" }
spec:
  replicas: 6
  selector: { matchLabels: { app: orders } }
  strategy:
    type: RollingUpdate
    rollingUpdate: { maxSurge: 2, maxUnavailable: 0 }   # old + new overlap by design
  template:
    metadata:
      labels: { app: orders, version: "42" }            # lets telemetry compare versions
    spec:
      terminationGracePeriodSeconds: 45
      initContainers:
        - name: proxy                  # sidecar: starts before app, stops after it
          image: envoyproxy/envoy:v1.32-latest
          restartPolicy: Always        # this line makes the init container a sidecar
          args: ["-c", "/etc/envoy/envoy.yaml"]
          volumeMounts: [{ name: envoy-config, mountPath: /etc/envoy }]
          resources: { requests: { cpu: 50m, memory: 64Mi } }
      containers:
        - name: app
          image: registry.example.com/orders:42
          ports: [{ containerPort: 8080 }]
          readinessProbe:              # no traffic until the new pod is really ready
            httpGet: { path: /ready, port: 8080 }
            periodSeconds: 5
          lifecycle:
            preStop:                   # keep serving while endpoints are removed
              exec: { command: ["sleep", "10"] }
          resources: { requests: { cpu: 250m, memory: 512Mi } }
      volumes:
        - name: envoy-config
          configMap: { name: orders-envoy }`,
        note: 'In a mesh the proxy is injected for you; this shows what the injection produces. <code>maxUnavailable: 0</code> keeps capacity during the rollout, which also means v41 and v42 always overlap: the reason every change must be compatible with the previous version.'
      },
      {
        title: 'gRPC / Protobuf: evolve a message without breaking old clients', lang: 'proto',
        code: `// orders/v1/orders.proto: one file, many releases. Old and new binaries interoperate
// because unknown fields are skipped and missing fields read as defaults.
syntax = "proto3";
package shop.orders.v1;

service OrderService {
  rpc GetOrder(GetOrderRequest) returns (Order);
  rpc ListOrders(ListOrdersRequest) returns (ListOrdersResponse);  // added later: safe
}

message GetOrderRequest { string order_id = 1; }
message ListOrdersRequest { string customer_id = 1; int32 page_size = 2; string page_token = 3; }
message ListOrdersResponse { repeated Order orders = 1; string next_page_token = 2; }

message Order {
  reserved 4;                     // contract phase done: the tag can never be reused
  reserved "legacy_status";

  string order_id = 1;
  OrderStatus status = 2;

  // Expand phase: servers fill BOTH until every client reads total.
  int64 amount_cents = 3 [deprecated = true];
  Money total = 6;

  optional string coupon_code = 5;   // optional: "not set" differs from empty string
}

message Money {
  int64 minor_units = 1;          // 1999 = 19.99
  string currency = 2;            // ISO 4217
}

enum OrderStatus {
  ORDER_STATUS_UNSPECIFIED = 0;   // old clients see new values as unknown: handle it
  ORDER_STATUS_PENDING = 1;
  ORDER_STATUS_PAID = 2;
  ORDER_STATUS_SHIPPED = 3;
}`,
        note: 'Never change a field number or type, and never reuse a number: the wire format identifies fields by number only. Run a breaking-change linter (for example <code>buf breaking</code>) against the main branch in CI so these rules are enforced, not remembered.'
      },
      {
        title: 'Spring Boot consumer: a tolerant reader for the migrate phase', lang: 'java',
        code: `// Spring Boot 3.3+, Java 21, spring-kafka. This consumer works with producers that
// send only "amount" (old), both fields (expand phase), or only "total" (after contract).
@JsonIgnoreProperties(ignoreUnknown = true)          // new fields never break us
public record OrderPlaced(
    UUID orderId,
    @JsonProperty("total") @JsonAlias("amount") Long totalCents,   // new name, old accepted
    String currency) {

  public OrderPlaced {
    Objects.requireNonNull(orderId, "orderId");
    Objects.requireNonNull(totalCents, "total or amount");
    if (currency == null) currency = "EUR";            // field added later: default it
  }
}

@Component
class OrderPlacedListener {
  private final InvoiceService invoices;
  OrderPlacedListener(InvoiceService invoices) { this.invoices = invoices; }

  @KafkaListener(topics = "orders.order-placed", groupId = "billing")
  void on(OrderPlaced event) {
    invoices.createFor(event.orderId(), event.totalCents(), event.currency());
  }
}

// A test per producer generation keeps the promise honest.
class OrderPlacedCompatibilityTest {
  private final ObjectMapper json = JsonMapper.builder().findAndAddModules().build();

  @ParameterizedTest
  @ValueSource(strings = {
      "{\\"orderId\\":\\"6f1c2a54-9d7e-4b11-8a43-0c5e2f7b9d10\\",\\"amount\\":1999}",
      "{\\"orderId\\":\\"6f1c2a54-9d7e-4b11-8a43-0c5e2f7b9d10\\",\\"amount\\":1999,\\"total\\":1999,\\"currency\\":\\"EUR\\"}",
      "{\\"orderId\\":\\"6f1c2a54-9d7e-4b11-8a43-0c5e2f7b9d10\\",\\"total\\":1999,\\"currency\\":\\"EUR\\",\\"channel\\":\\"web\\"}"})
  void readsEveryGeneration(String payload) throws Exception {
    assertThat(json.readValue(payload, OrderPlaced.class).totalCents()).isEqualTo(1999L);
  }
}`,
        note: 'Deploy this consumer <b>before</b> the producer stops sending <code>amount</code>. The listener assumes a JSON deserializer is configured for the consumer factory. If both names are present, Jackson uses whichever it reads last; they hold the same value during the expand phase.'
      }
    ],

    related: ['ms-testing', 'ms-antipatterns-migration', 'ms-discovery-config-security', 'platform-engineering', 'service-mesh', 'deployment-strategies', 'gitops']
  });
})();

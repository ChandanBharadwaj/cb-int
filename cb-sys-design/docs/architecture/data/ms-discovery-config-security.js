(function () {
  // Staleness model: an instance dies silently. The registry notices after `miss` missed heartbeats,
  // then clients notice after their next cache refresh. Until then 1/N of requests go to the dead instance.
  const win = (v) => v.hb * Math.round(v.miss) + v.refresh;
  const fmtS = (s) => (s >= 120 ? (s / 60).toFixed(1) + ' min' : Math.round(s) + ' s');
  const big = (x) => (x >= 100 ? Math.round(x).toLocaleString('en-US') : x >= 10 ? x.toFixed(0) : x.toFixed(1));

  SD.register({
    slug: 'ms-discovery-config-security',
    domain: 10,
    title: 'Service Discovery, Config & Service-to-Service Trust',
    examples: 'Kubernetes DNS, Consul, SPIFFE, Envoy',
    tagline: 'Three questions every service asks at runtime: <b>where is the other service</b> right now, <b>what are my settings and secrets</b>, and <b>who is really calling me</b>. The answers are a registry with health checks, a central config and secret store, and short-lived workload identities with audience-scoped tokens.',
    tldr: {
      problem: 'Instances come and go every minute, so addresses cannot be written in a file. Settings and passwords differ per environment and must change without a rebuild. And inside the network, "it came from our subnet" proves nothing about who is calling.',
      idea: '<b>Discovery:</b> instances register (or the platform registers them), health checks remove bad ones, callers look up a name. <b>Config:</b> settings and secrets live outside the image and are delivered at runtime. <b>Trust:</b> each workload gets a short-lived cryptographic identity, calls use <b>mutual TLS</b>, and the user\'s identity travels as a token <b>scoped to the one service</b> that should accept it.',
      insight: 'All three are <b>caches of a changing truth</b>, so the design question is always the same: <b>how stale can it be, and what happens when it is wrong?</b> A dead instance stays routable for the health-check window. A leaked credential is useful for its lifetime. A bad config reaches every instance as fast as your rollout allows.',
      numbers: [
        { v: '30 s / 90 s', l: 'Eureka defaults: heartbeat interval / lease expiry (as documented for Spring Cloud Netflix)' },
        { v: '1 / N', l: 'share of requests sent to one dead instance out of N until it is removed (math)' },
        { v: 'Jan 2020', l: 'RFC 8693, OAuth 2.0 Token Exchange, published (IETF)' }
      ]
    },

    intro: {
      what: '<b>Service discovery</b> is how one service finds a live copy of another by name. <b>Central configuration</b> is how a service gets its settings and secrets without them being built into it. <b>Service-to-service trust</b> is how the called service knows which service, and which user, is behind a request.',
      analogy: {
        icon: '🏢',
        title: 'A large office building',
        text: 'You do not memorise which desk a colleague sits at; you ask reception, which keeps a live list of who is in today. That is discovery with health checks. Your badge is issued by security, expires tonight, and opens only the rooms you need. That is a workload identity and a scoped token. The building rules are posted centrally, not printed inside each employee\'s notebook. That is central config. Unlike an office, software asks reception thousands of times a second, so it keeps a short-lived copy of the list, and that copy can be out of date.'
      },
      problem: 'The Orders service must call Payments. Payments runs as five copies whose addresses change on every deploy. One copy has just crashed. Orders also needs the database password, and Payments must be sure the caller is really Orders acting for a real customer, not a compromised reporting job on the same network. The question is: <b>how does a service find a healthy peer, get its settings, and prove who it is, when everything keeps moving?</b>',
      story: [
        {
          stage: 'naive',
          title: 'Addresses and passwords in a properties file',
          text: 'Orders has the Payments address and an API key in its config file, built into the image. Payments accepts any request that has the key. With two servers that rarely change, this is simple and works.',
          scene: {
            nodes: [
              { id: 'ord', label: 'Orders', sub: 'payments=10.0.3.7', kind: 'service', at: [70, 110] },
              { id: 'p1', label: 'Payments A', sub: '10.0.3.7', kind: 'service', at: [350, 40] },
              { id: 'p2', label: 'Payments B', sub: '10.0.3.8', kind: 'service', at: [350, 180] }
            ],
            edges: [{ from: 'ord', to: 'p1' }, { from: 'ord', to: 'p2', dashed: true }],
            flow: ['ord>p1'],
            badges: { ord: ['key in image', 'info'] }
          }
        },
        {
          stage: 'breaks',
          title: 'The address moved and the key leaked',
          text: 'A deploy replaces Payments A with a new copy at a new address. Orders keeps calling the old one and fails until someone edits the file and redeploys. The API key is in every image and never changes, so a compromised job on the same network can <b>call Payments as if it were Orders</b>.',
          scene: {
            nodes: [
              { id: 'ord', label: 'Orders', sub: 'calls 10.0.3.7', kind: 'service', at: [70, 40] },
              { id: 'bad', label: 'Reporting job', sub: 'compromised', kind: 'service', at: [70, 180] },
              { id: 'p1', label: 'Payments A', sub: 'gone', kind: 'service', at: [350, 40] },
              { id: 'p2', label: 'Payments C', sub: 'new: 10.0.5.2', kind: 'service', at: [350, 180] }
            ],
            edges: [{ from: 'ord', to: 'p1' }, { from: 'bad', to: 'p2' }],
            flow: ['ord>p1', 'bad>p2'],
            err: ['p1', 'bad'], warn: ['ord'],
            badges: { p1: ['connection refused', 'err'], bad: ['has the key', 'err'] }
          }
        },
        {
          stage: 'fix',
          title: 'Look up by name, prove identity per call',
          text: 'Orders asks for <code>payments</code> by <b>name</b>. A registry, fed by health checks, answers with live copies only. Each workload holds a <b>short-lived certificate</b> issued by the platform, so both sides prove who they are with mutual TLS. Settings and secrets come from a central store at runtime.',
          scene: {
            nodes: [
              { id: 'reg', label: 'Registry', sub: 'name → live copies', kind: 'store', at: [210, 0] },
              { id: 'ord', label: 'Orders', sub: 'cert: orders', kind: 'service', at: [70, 110] },
              { id: 'p2', label: 'Payments C', sub: 'cert: payments', kind: 'service', at: [350, 110] },
              { id: 'ca', label: 'Identity CA', sub: 'certs for hours', kind: 'policy', at: [70, 220] },
              { id: 'cfg', label: 'Config store', sub: 'settings + secrets', kind: 'store', at: [350, 220] }
            ],
            edges: [{ from: 'ord', to: 'reg' }, { from: 'p2', to: 'reg', dashed: true }, { from: 'ord', to: 'p2' }, { from: 'ca', to: 'ord', dashed: true }, { from: 'cfg', to: 'p2', dashed: true }],
            flow: ['p2>reg', 'ord>reg', 'ord>p2'],
            ok: ['ord', 'p2'],
            badges: { p2: ['mTLS: caller = orders', 'ok'], reg: ['healthy only', 'ok'] }
          }
        }
      ],
      usedBy: ['Kubernetes (Services, CoreDNS, ConfigMaps, Secrets)', 'Netflix Eureka (client-side discovery)', 'HashiCorp Consul and Vault', 'Envoy and Istio (xDS, mTLS)', 'SPIFFE / SPIRE workload identity', 'Google (ALTS, BeyondProd)'],
      whenToUse: [
        'Instances are <b>created and destroyed automatically</b> (autoscaling, rolling deploys, containers)',
        'The same build must run in <b>several environments</b> with different settings and secrets',
        'More than one team\'s code runs on the same network, so <b>network location is not enough</b> to trust a caller'
      ],
      whenNot: [
        'A handful of long-lived servers behind one load balancer: a DNS record and the load balancer\'s health check are enough',
        'You already run a <a href="service-mesh.html">service mesh</a>: it provides discovery, mTLS and identity; do not also build them into every service',
        'User login and consent flows: that is <a href="iam-oauth-oidc.html">OAuth and OIDC</a>; this page covers what happens after the token exists'
      ],
      glossary: [
        { term: 'Service registry', def: 'A live database of which instances of each service exist and where they are.' },
        { term: 'Client-side discovery', def: 'The caller fetches the list of instances and picks one itself.' },
        { term: 'Server-side discovery', def: 'The caller sends to one stable address; a load balancer or proxy picks the instance.' },
        { term: 'Health check', def: 'A periodic test of an instance; failing instances are taken out of the list.' },
        { term: 'Workload identity', def: 'A cryptographic identity given to a running service by the platform, not a secret a human configured.' },
        { term: 'Mutual TLS (mTLS)', def: 'TLS where both sides present a certificate, so each knows who the other is.' },
        { term: 'SPIFFE ID', def: 'A standard name for a workload, written as a URI: spiffe://trust-domain/path.' },
        { term: 'Audience-scoped token', def: 'A token whose audience claim names the one service allowed to accept it, so it is useless anywhere else.' }
      ]
    },

    requirements: {
      functional: [
        '<b>Call by name, never by address</b>: addresses are resolved at runtime',
        '<b>Only healthy instances receive traffic</b>: readiness decides membership, and callers still retry elsewhere',
        '<b>Config and secrets live outside the image</b>: one build runs in every environment',
        '<b>Every workload has its own identity</b>, issued automatically and short-lived',
        '<b>Authenticate both ends of every call</b> (mTLS) and authorise on identity, not on IP address',
        '<b>Propagate the user\'s identity explicitly</b>, as a token scoped to the next service only'
      ],
      nonFunctional: [
        'A dead instance stops receiving traffic within seconds (<em>example target</em>: &lt; 10 s)',
        'Zero failed requests during a planned rolling deploy (graceful deregistration)',
        'Discovery keeps working from cache when the registry is down',
        'Certificates and tokens live hours or minutes, not months; rotation needs no human',
        'A config change reaches the fleet in a staged way and can be rolled back in one step',
        'Every secret read and every denied call is in an audit log'
      ],
      outOfScope: [
        '<b>Hard-coded addresses</b> or IPs in config files',
        '<b>Secrets in images, repos or plain environment files</b> shared across services',
        '<b>Trusting the network</b>: "it is inside the VPC, so it is us"',
        '<b>Forwarding the user\'s original token everywhere</b>, so any service can replay it to any other',
        '<b>One shared API key</b> for all internal calls'
      ]
    },

    calculator: {
      inputs: [
        { id: 'n', label: 'Instances of the called service', min: 2, max: 200, value: 10, log: true },
        { id: 'hb', label: 'Heartbeat / health-check interval', min: 1, max: 60, value: 10, unit: 's' },
        { id: 'miss', label: 'Missed checks before removal', min: 1, max: 5, value: 3 },
        { id: 'refresh', label: 'Caller\'s cache refresh interval (0 = pushed)', min: 0, max: 60, value: 30, unit: 's' },
        { id: 'rps', label: 'Requests per second to the service', min: 10, max: 100000, value: 2000, log: true, fmt: 'num' },
        { id: 'ttl', label: 'Certificate / credential lifetime', min: 1, max: 2160, value: 24, unit: 'h', log: true }
      ],
      outputs: [
        { label: 'Worst-case time a crashed instance stays routable', fmt: 'raw', f: (v) => fmtS(win(v)) },
        { label: 'Share of requests failing in that window (no retries)', fmt: 'pct', f: (v) => 1 / Math.round(v.n) },
        { label: 'Requests sent to the dead instance per crash', fmt: 'raw', f: (v) => big(v.rps / Math.round(v.n) * win(v)) },
        { label: 'Registry writes from heartbeats', fmt: 'raw', f: (v) => big(Math.round(v.n) / v.hb) + ' / s for this service' },
        { label: 'Certificate renewals per day (renew at half life)', fmt: 'raw', f: (v) => big(Math.round(v.n) * 24 / (v.ttl / 2)) + ' / day' },
        { label: 'How long a stolen credential stays usable (worst case)', fmt: 'raw', f: (v) => (v.ttl >= 48 ? (v.ttl / 24).toFixed(0) + ' days' : v.ttl + ' h') }
      ],
      note: 'A crashed instance sends no goodbye, so removal takes <i>interval × missed checks</i>, and callers that cache the list add their refresh interval on top. Requests are assumed evenly spread, so 1/N go to the dead instance. This is the reason callers need <b>retries on another instance</b> and <b>passive outlier detection</b>: both act in milliseconds, long before the registry catches up. Renewing at half the lifetime is a common default, used here as an <em>assumption</em>. Planned shutdowns should deregister first and need none of this.'
    },

    api: [
      { m: 'YAML', p: 'Kubernetes Service + readinessProbe', d: 'The Service gives a stable name (<code>payments.shop.svc.cluster.local</code>) and virtual IP. The readiness probe decides which pods are in its endpoints. A <b>headless</b> Service (<code>clusterIP: None</code>) returns the pod IPs instead, for client-side balancing.' },
      { m: 'HTTP', p: 'Consul: register a service', d: 'Self-registration in a registry: name, address, port, tags and a <b>health check</b> (HTTP, gRPC or TTL). Eureka is similar: register, then renew the lease with heartbeats.' },
      { m: 'POLICY', p: 'AuthorizationPolicy: who may call Payments', d: 'Allow <code>POST /payments</code> only from the Orders workload identity (its SPIFFE ID, tied to the <code>orders</code> service account). Default deny. The rule names an identity, never an IP range.' },
      { m: 'POST', p: '/oauth2/token (RFC 8693 token exchange)', d: '<code>grant_type</code> = the token-exchange URN, <code>subject_token</code> = the user\'s token, <code>audience=payments</code>, <code>scope=payments:charge</code>. Returns a short-lived token only Payments accepts.' },
      { m: 'YAML', p: 'Config and secret references', d: 'ConfigMap for non-secret settings; secrets pulled from a secret manager (Vault, a cloud KMS-backed store) by reference, mounted as files so they can rotate without a restart. Detail on the <a href="secrets-kms.html">secrets page</a>.' },
      { m: 'ADR', p: 'ADR: service identity and internal authentication', d: 'Trust domain name, how identities map to service accounts, certificate lifetime, mTLS mode and migration (permissive → strict), which token carries the user, and what the default-deny rollout order is.' }
    ],
    dataModel: [
      { name: 'service_instance (registry entry)', store: 'Registry: Kubernetes EndpointSlice · Consul · Eureka', fields: [['service', 'text', 'pk'], ['instance_id', 'text', 'pk'], ['address', 'ip:port'], ['status', 'ready | not_ready | draining'], ['zone', 'text', 'idx'], ['last_heartbeat', 'timestamptz'], ['metadata', 'version, weight']], note: 'In Kubernetes the platform writes this from the pod\'s readiness. In Consul or Eureka the instance (or an agent beside it) registers and heartbeats.' },
      { name: 'X.509-SVID (workload certificate)', store: 'In memory in the workload or its proxy', fields: [['uri_san', 'spiffe://shop.example/ns/shop/sa/orders', 'pk'], ['not_after', 'now + hours'], ['issuer', 'trust domain CA'], ['private_key', 'never leaves the node']], note: 'The identity is the URI in the certificate\'s subject alternative name. It is renewed automatically well before expiry.' },
      { name: 'Internal access token (JWT claims)', store: 'Authorization header, per request', fields: [['iss', 'token service URL'], ['sub', 'user id', 'idx'], ['aud', 'payments', 'idx'], ['scope', 'payments:charge'], ['exp', 'now + 5 min'], ['act', '{ sub: orders } (who acts for the user)']], note: 'Payments rejects any token whose <code>aud</code> is not itself. <code>act</code> is the RFC 8693 actor claim: the service acting on the user\'s behalf.' },
      { name: 'config_entry', store: 'Config store: ConfigMap · Consul KV · Git', fields: [['service', 'text', 'pk'], ['key', 'text', 'pk'], ['value', 'text'], ['version', 'int'], ['rollout', 'canary % | zone'], ['changed_by', 'text'], ['changed_at', 'timestamptz']], note: 'Config is code: versioned, reviewed, validated before rollout, and staged like a deploy.' }
    ],

    architecture: {
      title: 'Find a healthy peer, load settings, prove identity',
      nodes: [
        { id: 'sts', label: 'Token service', sub: 'OAuth token exchange', kind: 'policy', wide: [90, 40], tall: [70, 0], tip: 'Swaps the user\'s incoming token for a short-lived one whose audience is the next service only (RFC 8693).' },
        { id: 'dns', label: 'Cluster DNS', sub: 'CoreDNS', kind: 'compute', wide: [290, 40], tall: [210, 0], tip: 'Answers payments.shop.svc.cluster.local with the Service\'s virtual IP, or with all pod IPs for a headless Service.' },
        { id: 'reg', label: 'Service registry', sub: 'K8s API · Consul', kind: 'store', wide: [490, 40], tall: [350, 0], tip: 'The live list of instances per service. In Kubernetes: EndpointSlices written from pod readiness. Elsewhere: Consul or Eureka with heartbeats.' },
        { id: 'cfg', label: 'Config store', sub: 'ConfigMap · Consul KV', kind: 'store', wide: [90, 170], tall: [70, 105], tip: 'Non-secret settings per environment, versioned. Delivered as files or watched at runtime.' },
        { id: 'orders', label: 'Orders', sub: 'caller', kind: 'service', wide: [290, 170], tall: [210, 105], tip: 'Calls Payments by name. Holds its own short-lived certificate and the user\'s token for this request.' },
        { id: 'lb', label: 'Service VIP', sub: 'kube-proxy · Envoy', kind: 'edge', wide: [490, 170], tall: [350, 105], tip: 'Server-side discovery: one stable address in front of the instances. Gets the endpoint list pushed from the registry.' },
        { id: 'ca', label: 'Identity CA', sub: 'SPIRE · mesh CA', kind: 'policy', wide: [490, 310], tall: [70, 210], tip: 'Verifies what a workload is (node and pod attestation) and issues it a certificate carrying its SPIFFE ID, valid for hours.' },
        { id: 'payA', label: 'Payments A', sub: 'ready', kind: 'service', wide: [690, 100], tall: [210, 210], tip: 'Checks the caller\'s certificate identity, then the token\'s audience and scope, before doing any work.' },
        { id: 'payB', label: 'Payments B', sub: 'ready', kind: 'service', wide: [690, 240], tall: [350, 210], tip: 'A second instance. When it fails its readiness check it leaves the endpoint list.' },
        { id: 'sec', label: 'Secret manager', sub: 'Vault · cloud KMS', kind: 'store', wide: [890, 100], tall: [210, 315], tip: 'Holds database passwords and API keys, or issues short-lived ones on demand. Access is by workload identity and audited.' },
        { id: 'health', label: 'Health checks', sub: 'readiness probes', kind: 'compute', wide: [890, 240], tall: [350, 315], tip: 'The kubelet (or the registry agent) probes each instance. Failing readiness removes it from the list without killing it.' }
      ],
      edges: [
        { from: 'orders', to: 'dns' },
        { from: 'dns', to: 'reg', dashed: true },
        { from: 'reg', to: 'lb', dashed: true },
        { from: 'orders', to: 'lb' },
        { from: 'lb', to: 'payA' },
        { from: 'lb', to: 'payB' },
        { from: 'orders', to: 'sts' },
        { from: 'cfg', to: 'orders', dashed: true },
        { from: 'ca', to: 'orders', dashed: true },
        { from: 'ca', to: 'payA', dashed: true },
        { from: 'sec', to: 'payA', dashed: true },
        { from: 'health', to: 'payA', dashed: true },
        { from: 'health', to: 'payB', dashed: true }
      ]
    },

    scenarios: [
      {
        id: 'find', title: 'Find and call by name', tone: 'ok',
        steps: [
          { text: 'Payments pods start. The platform probes each one; when its <b>readiness probe</b> passes, the pod is added to the service\'s endpoint list.', flow: [['health>payA', 'health>payB']], nodes: ['reg'], ok: ['payA', 'payB'], badges: { reg: ['2 endpoints', 'ok'] } },
          { text: 'Orders calls <code>http://payments</code>. Cluster DNS resolves the name to the Service\'s <b>stable virtual IP</b>. The address never changes, so caching it is safe.', flow: ['orders>dns', 'dns>reg'], badges: { dns: 'payments → 10.96.4.17' } },
          { text: '<b>Server-side discovery:</b> the registry pushes the endpoint list to the node\'s proxy, which picks a ready pod. Orders knows nothing about instances.', flow: ['reg>lb', 'orders>lb', 'lb>payA'], ok: ['payA'], badges: { lb: 'picks a ready pod' } },
          { text: 'Catch: a plain virtual IP balances per <b>connection</b>. A long-lived gRPC (HTTP/2) connection sticks to one pod. For per-request balancing use a headless Service with client-side balancing, or an L7 proxy such as Envoy.', flow: ['orders>lb', 'lb>payA', 'orders>lb', 'lb>payA'], warn: ['payA'], badges: { payA: ['all the traffic', 'warn'], payB: 'idle' }, tone: 'warn' }
        ]
      },
      {
        id: 'client', title: 'Client-side discovery', tone: 'info',
        steps: [
          { text: 'With a <b>headless</b> Service, DNS returns every pod IP. With Eureka or Consul, the client library fetches the instance list from the registry. Either way the caller holds the list.', flow: ['orders>dns', 'dns>reg'], hidden: ['lb'], badges: { orders: 'cached: A, B' } },
          { text: 'Orders balances per request itself: round robin, least loaded, or same-zone first. No extra hop and full control, but this logic must exist in <b>every language</b> you use.', flow: ['orders>payA', 'orders>payB', 'orders>payA'], hidden: ['lb'], ok: ['payA', 'payB'] },
          { text: 'The list is a <b>cache</b>. Orders refreshes it on a timer or receives pushes. If the registry is down, Orders keeps using the last list, which is what you want.', nodes: ['orders', 'reg'], hidden: ['lb'], warn: ['reg'], badges: { reg: ['down', 'warn'], orders: ['serving from cache', 'ok'] } },
          { text: 'A sidecar proxy is the same pattern moved out of the app: Envoy receives endpoints over <b>xDS</b> and balances per request for any language. See <a href="service-mesh.html">service mesh</a>.', flow: ['reg>lb', 'orders>lb', ['lb>payA', 'lb>payB']], labels: { lb: { label: 'Sidecar proxy', sub: 'Envoy · xDS' } }, ok: ['lb'] }
        ]
      },
      {
        id: 'stale', title: 'An instance dies: stale endpoint', tone: 'err',
        steps: [
          { text: 'Payments B is killed without warning (node failure, out of memory). It cannot say goodbye, so the registry still lists it.', nodes: ['payB', 'reg'], err: ['payB'], badges: { payB: ['dead', 'err'], reg: ['still lists B', 'warn'] }, tone: 'err' },
          { text: 'For the next few seconds, half of Orders\' requests are sent to a dead address and fail. With 10 instances it would be one request in ten.', flow: ['orders>lb', 'lb>payB'], err: ['payB'], warn: ['lb'], badges: { lb: ['50% errors', 'err'] }, tone: 'err' },
          { text: 'The health checker fails B several times in a row and the registry removes it. That takes <b>interval × failures</b>. A caller with its own cached list adds its refresh interval on top.', flow: ['health>payB'], nodes: ['reg', 'lb'], err: ['payB'], ok: ['reg'], badges: { reg: ['B removed', 'ok'] }, labels: { payB: { sub: 'not ready' } } },
          { text: 'So do not wait for the registry: <b>retry</b> a failed idempotent call on another instance, and let the proxy <b>eject</b> an instance after a few consecutive errors (outlier detection). Both act within milliseconds.', flow: ['orders>lb', 'lb>payA'], ok: ['payA', 'lb'], err: ['payB'], badges: { lb: ['B ejected', 'ok'] }, tone: 'ok' },
          { text: 'For <b>planned</b> shutdowns, avoid the window entirely: remove the instance from the list first, keep serving for a few seconds while callers catch up, then exit.', nodes: ['payB', 'reg'], warn: ['payB'], labels: { payB: { sub: 'draining' } }, badges: { payB: ['deregister, then stop', 'ok'] }, tone: 'ok' }
        ]
      },
      {
        id: 'trust', title: 'Who is calling? mTLS + scoped token', tone: 'ok',
        steps: [
          { text: 'At start-up each workload is <b>attested</b> by the platform and receives a short-lived certificate. Its identity is a SPIFFE ID such as <code>spiffe://shop.example/ns/shop/sa/orders</code>. No human handled a secret.', flow: [['ca>orders', 'ca>payA']], ok: ['orders', 'payA'], badges: { ca: 'valid for hours' } },
          { text: 'Orders holds the customer\'s token from the edge. It does <b>not</b> forward it. It asks the token service to exchange it for a token with <code>aud=payments</code> and only the scope needed.', flow: ['orders>sts', 'sts>orders'], badges: { sts: ['aud = payments, 5 min', 'ok'] } },
          { text: 'Orders opens a <b>mutual TLS</b> connection. Both sides present certificates, so Payments knows the caller is the Orders workload, and Orders knows it reached the real Payments.', flow: ['orders>lb', 'lb>payA'], ok: ['payA'], badges: { payA: ['peer = orders ✓', 'ok'] } },
          { text: 'Payments checks three things: the <b>peer identity</b> is allowed to call this endpoint, the token\'s <b>audience</b> is "payments", and the <b>scope</b> covers the action. Then it applies its own business rules for that user.', nodes: ['payA'], ok: ['payA'], badges: { payA: ['caller ✓ aud ✓ scope ✓', 'ok'] }, tone: 'ok' },
          { text: 'If Payments were compromised, the token it holds is useless elsewhere: Inventory rejects it because the audience is wrong. A forwarded edge token would have worked everywhere.', nodes: ['payA', 'sts'], warn: ['payA'], badges: { payA: ['token replay blocked', 'ok'] } }
        ]
      },
      {
        id: 'config', title: 'A config change hits the whole fleet', tone: 'warn',
        steps: [
          { text: 'A timeout for the Payments client is changed in the config store. Dynamic config means no redeploy: every Orders instance picks it up within seconds.', flow: ['cfg>orders'], badges: { cfg: 'v42 → v43' } },
          { text: 'The value has a typo: 30 instead of 3000 ms. All 200 instances apply it together. Every call to Payments now times out. <b>Dynamic config is a deploy with no canary</b> unless you build one.', flow: ['orders>lb', 'lb>payA'], err: ['orders'], hot: ['cfg'], badges: { orders: ['all calls time out', 'err'], cfg: ['200 instances at once', 'err'] }, tone: 'err' },
          { text: 'Fix the process: validate values against a schema, roll out to 1% or one zone first, watch error rates, then continue. Keep the previous version one click away.', flow: ['cfg>orders'], ok: ['cfg'], badges: { cfg: ['staged: 1% → 100%', 'ok'] }, tone: 'ok' },
          { text: 'Secrets follow the same rule. The secret manager issues a new database credential, both old and new work during an overlap, workloads reload from the mounted file, then the old one is revoked.', flow: ['sec>payA'], ok: ['sec', 'payA'], badges: { sec: ['rotate with overlap', 'ok'] } }
        ]
      }
    ],

    knobs: {
      intro: 'Each control is a real platform decision for the Orders → Payments call. Meter values are <em>illustrative</em> judgements, not benchmarks.',
      controls: [
        { id: 'disc', label: 'Discovery', type: 'seg', value: 'dns', options: [
          { v: 'static', l: 'Addresses in config' }, { v: 'dns', l: 'DNS + virtual IP' }, { v: 'client', l: 'Client-side library' }, { v: 'mesh', l: 'Sidecar proxy (xDS)' }] },
        { id: 'health', label: 'Health signal', type: 'seg', value: 'probe', options: [
          { v: 'none', l: 'None' }, { v: 'probe', l: 'Readiness checks' }, { v: 'outlier', l: 'Checks + outlier ejection + retry' }] },
        { id: 'trust', label: 'Service-to-service trust', type: 'seg', value: 'mtls', options: [
          { v: 'net', l: 'Network location' }, { v: 'key', l: 'Shared API key' }, { v: 'mtls', l: 'mTLS workload identity' }, { v: 'both', l: 'mTLS + audience-scoped token' }] },
        { id: 'cfg', label: 'Config & secrets', type: 'seg', value: 'env', options: [
          { v: 'baked', l: 'Built into the image' }, { v: 'env', l: 'Injected at deploy' }, { v: 'central', l: 'Central store, dynamic' }] }
      ],
      evaluate(s) {
        const D = s.disc, Hh = s.health, T = s.trust, C = s.cfg;
        const clamp = (x) => Math.max(0.04, Math.min(0.96, x));
        let stale;
        if (D === 'static') stale = [0.05, 'until a human edits the config'];
        else if (Hh === 'none') stale = [0.15, 'dead instances stay in the list'];
        else if (Hh === 'outlier') stale = [D === 'client' ? 0.82 : 0.92, 'milliseconds: ejected after a few errors'];
        else stale = D === 'client' ? [0.4, 'heartbeat expiry + cache refresh (tens of seconds)'] : D === 'mesh' ? [0.7, 'check window, then pushed in about a second'] : [0.6, 'check interval × failures (seconds)'];
        const lbq = { static: [0.2, 'fixed list, no balancing'], dns: [0.5, 'per connection: long-lived gRPC sticks to one pod'], client: [0.85, 'per request, coded in every language'], mesh: [0.9, 'per request, in the proxy'] }[D];
        const idn = { net: [0.12, 'any workload on the network is trusted'], key: [0.3, 'proves "has the key", not who'], mtls: [0.82, 'cryptographic workload identity'], both: [0.95, 'workload identity + user, per service'] }[T];
        let blast = { net: 0.15, key: 0.2, mtls: 0.8, both: 0.93 }[T];
        if (T === 'key' && C === 'baked') blast = 0.05;
        if (C === 'central' && (T === 'mtls' || T === 'both')) blast += 0.03;
        const blastV = T === 'net' ? 'one compromised pod can call everything' : T === 'key' ? (C === 'baked' ? 'key is in every image, forever' : 'long-lived key works from anywhere') : T === 'mtls' ? 'certificate expires in hours' : 'token is useless at any other service';
        const chg = { baked: [0.2, 'rebuild and redeploy to change a value'], env: [0.6, 'redeploy; versioned and reviewed'], central: [0.8, 'seconds, so it needs a staged rollout'] }[C];
        let effort = { static: 0, dns: 0.08, client: 0.25, mesh: 0.32 }[D] + { none: 0, probe: 0.05, outlier: D === 'mesh' ? 0.05 : 0.12 }[Hh]
          + { net: 0, key: 0.05, mtls: D === 'mesh' ? 0.08 : 0.22, both: D === 'mesh' ? 0.18 : 0.32 }[T] + { baked: 0, env: 0.05, central: 0.15 }[C];
        const metrics = [
          { k: 'Stale-endpoint window', v: stale[1], s: stale[0] },
          { k: 'Load balancing', v: lbq[1], s: lbq[0] },
          { k: 'Caller identity', v: idn[1], s: idn[0] },
          { k: 'Stolen-credential blast radius', v: blastV, s: clamp(blast) },
          { k: 'Config change', v: chg[1], s: chg[0] },
          { k: 'Platform effort', v: effort < 0.2 ? 'low' : effort < 0.5 ? 'moderate' : 'high: needs a platform team', s: clamp(1 - effort), hint: 'lower bar = more to build and run' }
        ];
        const notes = [];
        if (D === 'static') notes.push('Fixed addresses break on the first reschedule. Even without a registry, put a DNS name and a load balancer in between.');
        if (D === 'dns') notes.push('A Kubernetes Service name resolves to a stable virtual IP, so DNS caching is harmless. Balancing is per connection; use an L7 proxy or a headless Service for gRPC.');
        if (D === 'client') notes.push('Client-side discovery (Eureka style) removes a hop but puts registry, caching and balancing code into every service and language.');
        if (D === 'mesh') notes.push('A sidecar gets endpoints, certificates and policy from one control plane. If you choose it for mTLS, you get discovery and outlier detection with it.');
        if (Hh === 'none') notes.push('Without health checks the registry only knows an instance <i>started</i>. A hung process keeps receiving traffic.');
        if (Hh === 'probe') notes.push('Readiness checks are periodic, so there is always a window. Add retries on another instance and outlier ejection to cover it.');
        if (T === 'net') notes.push('Firewalls and network policies limit reach, but they do not identify a caller. One compromised workload inherits the whole subnet\'s trust.');
        if (T === 'key') notes.push('A shared key cannot tell Orders from a thief, and rotating it means touching every caller at once.');
        if (T === 'mtls') notes.push('mTLS says <b>which service</b> is calling, not <b>for which user</b>. If the user\'s token is forwarded unchanged, any service can replay it to any other.');
        if (T === 'both') notes.push('Token exchange (RFC 8693) mints a token whose <code>aud</code> is the next service. Cache exchanged tokens briefly, or the token service becomes a bottleneck.');
        if (C === 'baked') notes.push('Config in the image breaks "one build, many environments" and puts secrets in the registry and in every laptop that pulls the image.');
        if (C === 'central') notes.push('Treat a config push like a deploy: schema validation, canary, automatic rollback. Several large public outages began as a global config change.');
        let verdict;
        if (D === 'static') verdict = '❌ <b>Hard-coded addresses</b> fail on the first rolling deploy. Call by name through DNS or a registry.';
        else if (C === 'baked' && T === 'key') verdict = '❌ <b>A shared secret baked into images:</b> everyone who can pull the image holds a key that never expires.';
        else if (T === 'net') verdict = '⚠ <b>The network is not an identity.</b> Any workload that gets onto the subnet can call Payments as anyone.';
        else if (Hh === 'none') verdict = '⚠ <b>No health signal:</b> crashed or hung instances keep receiving their share of traffic.';
        else if (T === 'key') verdict = '⚠ <b>Shared API key:</b> better than nothing, but it identifies nobody and is painful to rotate. Move to per-workload identity.';
        else if (C === 'baked') verdict = '⚠ <b>Config in the image:</b> every setting change is a rebuild, and environments drift. Inject config at deploy time at least.';
        else if (Hh === 'outlier' && T === 'both' && C !== 'baked') verdict = '✅ <b>Solid platform:</b> call by name, fail over in milliseconds, authenticate the workload and scope the user\'s token to one service.';
        else if (T === 'mtls') verdict = '👍 <b>Good base.</b> Workloads are authenticated; next, stop forwarding the user\'s edge token and exchange it per audience.';
        else verdict = '👍 <b>Workable.</b> Close the stale-endpoint window with retries and outlier ejection.';
        const hide = [];
        if (D === 'static') hide.push('dns', 'reg', 'lb');
        if (D === 'client') hide.push('lb');
        if (Hh === 'none') hide.push('health');
        if (T === 'net' || T === 'key') hide.push('ca');
        if (T !== 'both') hide.push('sts');
        if (C === 'baked') hide.push('cfg', 'sec');
        const flow = [];
        if (C !== 'baked') flow.push('cfg>orders');
        if (T === 'both') flow.push('orders>sts');
        if (D === 'static') flow.push('orders>payA');
        else if (D === 'client') flow.push('orders>dns', 'dns>reg', 'orders>payA', 'orders>payB');
        else flow.push('orders>dns', 'reg>lb', 'orders>lb', ['lb>payA', 'lb>payB']);
        const labels = {
          lb: D === 'mesh' ? { label: 'Sidecar proxies', sub: 'Envoy · xDS' } : { label: 'Service VIP', sub: 'kube-proxy (L4)' },
          reg: D === 'client' ? { label: 'Service registry', sub: 'Eureka · Consul' } : { label: 'Service registry', sub: 'K8s API · Consul' },
          orders: { label: 'Orders', sub: D === 'static' ? 'payments=10.0.3.7' : D === 'client' ? 'caches instance list' : 'caller' },
          cfg: C === 'env' ? { label: 'Config', sub: 'env vars at deploy' } : { label: 'Config store', sub: 'watched at runtime' },
          sec: C === 'env' ? { label: 'Secrets', sub: 'injected at deploy' } : { label: 'Secret manager', sub: 'short-lived creds' }
        };
        const badges = {};
        if (D === 'static') badges.orders = ['fixed IP', 'err'];
        if (T === 'net') badges.payA = ['trusts the subnet', 'err'];
        if (T === 'key') badges.payA = ['shared key', 'warn'];
        if (T === 'mtls') badges.payA = ['peer = orders ✓', 'ok'];
        if (T === 'both') badges.payA = ['peer ✓ aud ✓', 'ok'];
        if (Hh === 'none' && D !== 'static') badges.reg = ['no health data', 'warn'];
        if (Hh === 'outlier' && D !== 'static' && D !== 'client') badges.lb = ['ejects bad pods', 'ok'];
        if (C === 'baked') badges.orders = badges.orders || ['secrets in image', 'err'];
        return {
          metrics, verdict, notes: notes.slice(0, 4), labels, hide, flow, badges,
          err: (D === 'static' ? ['orders'] : []).concat(T === 'net' ? ['payA'] : []),
          warn: (T === 'key' ? ['payA'] : []).concat(Hh === 'none' && D !== 'static' ? ['reg'] : []),
          ok: T === 'mtls' || T === 'both' ? ['payA'] : [],
          hot: []
        };
      }
    },

    widget: {
      title: 'Discovery lab: heartbeats, eviction and stale caches',
      caption: 'Four Payments instances send <b>heartbeats</b> to a registry. The caller keeps a <b>cached list</b> and sends requests round robin. <b>Crash</b> an instance and watch three views disagree: the truth, the registry (until the lease expires) and the caller\'s cache (until its next refresh). Then turn on <b>retry</b>, or use a <b>graceful stop</b> that deregisters first.'
    },

    realWorld: {
      intro: 'Discovery started as a library problem and moved into the platform. Identity is following the same path: from secrets that people configure to identities the platform issues.',
      timeline: [
        { when: '2012 →', who: 'Netflix', title: 'Eureka: a registry with client-side balancing', text: 'Netflix describes Eureka as a REST-based service used mainly in the AWS cloud for discovery, load balancing and failover of middle-tier servers. Instances register and renew a lease with heartbeats; clients cache the registry and pick an instance themselves. Its "self-preservation" mode stops expiring instances when many heartbeats vanish at once, on the theory that the network, not the fleet, has failed.', src: 1 },
        { when: '2015', who: 'Chris Richardson (NGINX blog)', title: 'Client-side vs server-side discovery', text: 'The article that fixed the vocabulary: in client-side discovery the client queries a service registry and load-balances itself; in server-side discovery a router or load balancer does it. It also separates self-registration from third-party registration.', src: 3 },
        { when: 'ongoing', who: 'Kubernetes', title: 'DNS names for Services', text: 'A normal Service gets a DNS A/AAAA record that resolves to its cluster IP. A headless Service resolves to the IPs of all the pods it selects, and SRV records exist for named ports. Discovery becomes a platform feature instead of a library.', src: 0 },
        { when: 'ongoing', who: 'Envoy', title: 'Eventually consistent discovery + health checking', text: 'Envoy\'s documentation treats service discovery as eventually consistent and pairs it with active health checking: health data is assumed to be more accurate than discovery data when the two disagree. Endpoints arrive from a management server over the Endpoint Discovery Service (EDS).', src: 4 },
        { when: 'ongoing', who: 'SPIFFE (CNCF)', title: 'A standard for workload identity', text: 'SPIFFE defines the SPIFFE ID (<code>spiffe://trust-domain/workload-identifier</code>), the SVID that carries it as an X.509 certificate or a JWT, and the Workload API through which a workload obtains its SVID without holding a long-lived secret.', src: 5 },
        { when: '2019', who: 'Google', title: 'BeyondProd', text: 'Google\'s paper on its production security model: trust between services depends on code provenance, trusted hardware and <b>service identity</b>, not on IP address or hostname. Its ALTS system provides RPC authentication, integrity, encryption and service identities.', src: 8 },
        { when: 'Jan–Feb 2020', who: 'IETF', title: 'RFC 8693 and RFC 8705', text: 'RFC 8693 defines OAuth 2.0 Token Exchange: how to trade one token for another, for example one aimed at a specific downstream service. RFC 8705 defines mutual-TLS client authentication and certificate-bound access tokens, usable only by the holder of the matching private key.', src: 6 },
        { when: '2021', who: 'Netflix', title: 'Edge authentication and "Passport"', text: 'Netflix engineers describe moving authentication to the edge and passing an integrity-protected, token-agnostic identity object called Passport to backend services, so internal services receive one uniform identity structure instead of many external token types.', src: 9 },
        { when: 'ongoing', who: 'Kubernetes', title: 'Secrets are not encrypted by default', text: 'The Kubernetes documentation states that without an encryption configuration the API server stores resources, Secrets included, as plain text in etcd. Encryption at rest must be switched on, and many teams keep the real secrets in an external manager.', src: 10 }
      ],
      lessons: [
        'Discovery data is <b>eventually consistent</b>. Health checks narrow the window; retries and outlier ejection cover it.',
        'When the registry is unreachable, <b>keep the last known list</b>. Losing discovery must not mean losing traffic.',
        'Identity should be <b>issued by the platform</b> and expire in hours, not configured by people and kept for years.',
        'mTLS answers "which service". A <b>scoped token</b> answers "for which user, to do what, at which service".',
        'A dynamic config change is a <b>deployment</b>. Validate it, stage it, and keep rollback one step away.'
      ],
      sources: [
        { title: 'DNS for Services and Pods', url: 'https://www.kubernetes.io/docs/concepts/services-networking/dns-pod-service/', pub: 'Kubernetes documentation' },
        { title: 'Netflix/eureka (README)', url: 'https://github.com/Netflix/eureka', pub: 'Netflix, GitHub' },
        { title: 'Understanding Eureka Peer to Peer Communication', url: 'https://github.com/Netflix/eureka/wiki/Understanding-Eureka-Peer-to-Peer-Communication', pub: 'Netflix Eureka wiki' },
        { title: 'Service Discovery in a Microservices Architecture', url: 'https://www.f5.com/company/blog/nginx/service-discovery-in-a-microservices-architecture', pub: 'Chris Richardson, NGINX blog (now F5), 2015' },
        { title: 'Service discovery (architecture overview)', url: 'https://envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/service_discovery', pub: 'Envoy documentation' },
        { title: 'SPIFFE Concepts', url: 'https://www.spiffe.io/docs/latest/spiffe-about/spiffe-concepts/', pub: 'SPIFFE documentation' },
        { title: 'RFC 8693: OAuth 2.0 Token Exchange', url: 'https://www.rfc-editor.org/rfc/rfc8693', pub: 'IETF, January 2020' },
        { title: 'RFC 8705: OAuth 2.0 Mutual-TLS Client Authentication and Certificate-Bound Access Tokens', url: 'https://rfc-editor.org/rfc/rfc8705', pub: 'IETF, February 2020' },
        { title: 'BeyondProd', url: 'https://docs.cloud.google.com/docs/security/beyondprod', pub: 'Google Cloud documentation (whitepaper first published 2019)' },
        { title: 'InfoQ presentation on user and device identity at Netflix', url: 'https://www.infoq.com/presentations/netflix-user-identity', pub: 'InfoQ / QCon' },
        { title: 'Encrypting Confidential Data at Rest', url: 'https://www.kubernetes.io/docs/tasks/administer-cluster/encrypt-data/', pub: 'Kubernetes documentation' },
        { title: 'PeerAuthentication reference', url: 'https://istio.io/docs/reference/config/security/peer_authentication', pub: 'Istio documentation' },
        { title: 'Spring Cloud Netflix reference', url: 'https://docs.spring.io/spring-cloud-netflix/reference/4.2/spring-cloud-netflix.html', pub: 'Spring documentation' },
        { title: 'Health checking (architecture overview)', url: 'https://envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/health_checking', pub: 'Envoy documentation' }
      ]
    },

    tradeoffs: {
      headers: ['Decision', 'Option A', 'Option B', 'Pick when…'],
      rows: [
        ['Who picks the instance', '<b>Client-side</b>: caller holds the list; no extra hop; logic in every language', '<b>Server-side</b>: stable address, proxy picks; simple clients; one more hop', 'Server-side (DNS + VIP or a proxy) by default; client-side for gRPC without a proxy, or zone-aware needs'],
        ['Who registers', '<b>Self-registration</b>: the service registers and heartbeats (Eureka, Consul agent)', '<b>Platform registration</b>: the orchestrator does it from readiness (Kubernetes)', 'Platform registration whenever you have an orchestrator; self-registration on VMs and mixed estates'],
        ['Registry consistency', '<b>Available first</b> (Eureka): serves possibly stale data in a partition', '<b>Consistent first</b> (Consul, etcd, ZooKeeper): refuses without quorum', 'Stale-but-available suits discovery, as long as callers cache and health-check; consistency for locks and leader election'],
        ['Health signal', '<b>Active checks</b>: periodic probes; slow but sees idle instances', '<b>Passive</b> (outlier detection): reacts to real errors in milliseconds', 'Both: active for membership, passive plus retry for the gap'],
        ['Config delivery', '<b>At deploy</b> (env vars, mounted files): immutable, change = rollout', '<b>Dynamic</b> (watch a store): instant, needs its own safety', 'Deploy-time for most settings; dynamic for flags and limits you must turn quickly'],
        ['Caller trust', '<b>mTLS only</b>: service identity; user identity is whatever is forwarded', '<b>mTLS + exchanged token</b>: service and user, scoped per hop', 'mTLS everywhere first; add token exchange where the user\'s rights matter downstream'],
        ['Where mTLS lives', '<b>In the app</b> (library, SPIFFE Workload API)', '<b>In a sidecar or node proxy</b> (mesh)', 'Proxy for many languages and uniform policy; in-app for few services or when a mesh is too heavy']
      ]
    },
    failures: [
      { f: 'Stale endpoint after a crash', detect: 'Burst of connection errors to one address right after an instance dies; error share ≈ 1/N', fix: 'Shorter check interval, retries on another instance, outlier ejection, and push-based endpoint updates.' },
      { f: 'Errors during every deploy', detect: '502/503 spikes that line up with rolling updates', fix: 'Deregister first, then drain: readiness goes false or a preStop delay, finish in-flight requests, then exit.' },
      { f: 'Registry outage stops traffic', detect: 'All calls fail though the instances are healthy; clients log lookup errors', fix: 'Callers keep the last good list; registry is replicated; never clear the cache on an empty or failed response.' },
      { f: 'Mass eviction in a network partition', detect: 'Registry drops most instances at once while they are still serving', fix: 'Eviction rate limits or Eureka-style self-preservation; proxies that keep serving the last known endpoints ("panic" thresholds).' },
      { f: 'Readiness depends on a shared dependency', detect: 'One database blip marks every instance not ready; the whole service vanishes from discovery', fix: 'Readiness checks only what this instance needs to serve; handle downstream failure with breakers, not by leaving the pool.' },
      { f: 'Certificate expiry', detect: 'TLS handshake failures start at the same minute across a service', fix: 'Automated rotation well before expiry, alerts on remaining lifetime, and overlap of old and new trust bundles.' },
      { f: 'Confused deputy: token replayed downstream', detect: 'A service accepts tokens issued for another audience; audit shows calls the user never made', fix: 'Validate <code>aud</code> everywhere, exchange tokens per hop, keep scopes narrow and lifetimes short.' },
      { f: 'Global bad config push', detect: 'Error rate jumps on every instance within seconds of a config version change', fix: 'Schema validation, staged rollout with automatic halt, last-known-good fallback on parse failure.' }
    ],

    interview: [
      { q: 'Client-side vs server-side discovery: what is the difference and which do you choose?', a: '<p><b>Client-side:</b> the caller gets the instance list from the registry (or a headless DNS name) and picks one. No extra hop, and it can do smart balancing, but every language needs the library. Netflix Eureka with a client load balancer is the classic example.</p><p><b>Server-side:</b> the caller sends to one stable address; a load balancer or proxy that knows the instances picks one. Clients stay simple. A Kubernetes Service is this.</p><p>I default to server-side on Kubernetes. I move to client-side or an L7 proxy when I need per-request balancing for gRPC, or zone-aware routing.</p>', fu: 'Is a sidecar proxy client-side or server-side?', lvl: 'core' },
      { q: 'How does discovery work in Kubernetes?', a: '<p>A <b>Service</b> selects pods by label. The control plane keeps the list of <b>ready</b> pod addresses in EndpointSlices. Cluster DNS gives the Service a name, <code>service.namespace.svc.cluster.local</code>, which resolves to a stable virtual IP; the node\'s proxy forwards each new connection to one ready pod.</p><p>A <b>headless</b> Service has no virtual IP: DNS returns the pod IPs themselves, for clients that balance on their own. Readiness probes control membership, so a pod that fails readiness stops receiving traffic without being restarted.</p>', lvl: 'core' },
      { q: 'Why does gRPC often balance badly behind a Kubernetes Service, and how do you fix it?', a: '<p>A Service virtual IP balances at layer 4, <b>per connection</b>. gRPC uses HTTP/2 and keeps one long-lived connection carrying many requests, so all of a client\'s requests go to whichever pod that connection landed on. New pods get no traffic.</p><p>Fixes: a <b>headless Service</b> with gRPC\'s client-side round-robin policy; an <b>L7 proxy</b> (Envoy sidecar or gateway) that balances per request; or, as a blunt tool, a maximum connection age on the server so clients reconnect.</p>', lvl: 'deep' },
      { q: 'An instance crashes. Walk me through what callers see and how you limit the damage.', a: '<p>The crash sends no deregistration. The registry removes the instance only after <i>check interval × failure threshold</i>. Callers with a cached list add their refresh interval. Until then about 1/N of requests fail.</p><p>Limit it with: shorter intervals (within reason), <b>retries on a different instance</b> for idempotent calls, <b>outlier detection</b> that ejects an instance after a few consecutive errors, connection timeouts measured in hundreds of milliseconds, and pushed (not polled) endpoint updates. For planned stops, deregister first and drain.</p>', lvl: 'core' },
      { q: 'Liveness vs readiness: why does the distinction matter for discovery?', a: '<p><b>Readiness</b> answers "should this instance receive traffic now?" and controls membership in the endpoint list. <b>Liveness</b> answers "is this process broken beyond recovery?" and triggers a restart.</p><p>Mixing them causes outages. If readiness checks a shared database, one database blip removes every instance at once. If liveness checks a slow dependency, the platform restarts healthy pods in a loop. Readiness should test only what this instance needs to serve.</p>', lvl: 'core' },
      { q: 'Should a service registry be consistent or available?', a: '<p>For discovery, <b>available</b>. A slightly stale list is still useful, because callers health-check and retry; no list at all stops traffic. Eureka makes this choice explicitly, and its self-preservation mode refuses to expire instances when heartbeats drop en masse.</p><p>Consul, etcd and ZooKeeper are consensus stores: consistent, and unavailable for writes without a quorum. They work for discovery if clients cache the last answer. The rule either way: <b>a registry failure must not empty the caller\'s cache</b>.</p>', lvl: 'deep' },
      { q: 'Where should configuration and secrets live?', a: '<ul><li><b>Not in the image.</b> One build runs in every environment (twelve-factor).</li><li><b>Non-secret config:</b> versioned in Git, delivered as env vars or mounted files (ConfigMaps), or watched from a store for the few values that must change quickly.</li><li><b>Secrets:</b> in a secret manager, fetched by workload identity, mounted as files so they can rotate. Prefer short-lived, dynamically issued credentials. Note that Kubernetes Secrets are plain text in etcd unless encryption at rest is enabled.</li><li>Treat dynamic config changes as deployments: validate and stage them.</li></ul>', lvl: 'core' },
      { q: 'What is workload identity and what is SPIFFE?', a: '<p><b>Workload identity</b> means the platform gives each running service a cryptographic identity based on what it <i>is</i> (which node, namespace, service account, image), not on a password someone configured.</p><p><b>SPIFFE</b> standardises this: a <b>SPIFFE ID</b> is a URI, <code>spiffe://trust-domain/path</code>; an <b>SVID</b> is the document that carries it, an X.509 certificate or a JWT; the <b>Workload API</b> is how a workload gets and renews its SVID. SPIRE is the reference implementation, and meshes such as Istio issue SPIFFE-format identities too.</p>', lvl: 'core' },
      { q: 'If every call uses mTLS, why do you still need tokens?', a: '<p>mTLS authenticates the <b>workloads</b> at both ends of a connection and encrypts it. It says "this is Orders". It does not say <b>which user</b> the request is for, or what that user allowed.</p><p>The user\'s identity must travel in the request, as a token. And mTLS alone does not authorise anything: you still need a policy saying Orders may call <code>POST /payments</code>. So: mTLS for service identity and transport, a token for the user, and an authorisation check that uses both.</p>', lvl: 'core' },
      { q: 'How should a user\'s identity be propagated through a chain of services?', a: '<p>Do not forward the edge token unchanged: every service on the path could replay it to any other service, the "confused deputy" problem.</p><ul><li>At each hop, or at the edge, <b>exchange</b> it (RFC 8693) for a short-lived token whose <code>aud</code> is the next service and whose scope is the minimum needed. The <code>act</code> claim can record which service is acting.</li><li>Every service <b>validates</b> issuer, signature, expiry and <b>audience</b>.</li><li>Alternative used by some large systems: the edge converts external tokens into one signed internal identity object (Netflix calls its version Passport).</li></ul>', fu: 'How do you keep the token service from becoming a bottleneck?', lvl: 'deep' },
      { q: 'How would you roll out mTLS across 150 existing services without an outage?', a: '<ol><li>Issue identities to every workload first (mesh sidecars or SPIRE). Nothing is enforced yet.</li><li>Turn on <b>permissive</b> mode: servers accept both plain text and mTLS; clients start using mTLS where the peer supports it.</li><li>Measure: a dashboard of plain-text connections per service until it reads zero.</li><li>Switch to <b>strict</b> namespace by namespace, least critical first.</li><li>Only then add authorisation policies, starting in audit (log-only) mode, then default deny.</li></ol><p>Each step is reversible, and the order avoids the outage where a strict server meets a client with no certificate.</p>', lvl: 'deep' },
      { q: 'Teams resist replacing their shared internal API key with workload identity: "it works and we are busy". How do you get it adopted?', a: '<p><em>Sample story with illustrative numbers. Use your own.</em><br><b>Situation:</b> about 40 services shared one internal API key, stored in every repo\'s deploy config; it had not been rotated in three years because rotation needed a coordinated release. <b>Task:</b> replace it without stopping feature work. <b>Action:</b> framed it as risk and toil, not purity: showed that one leaked CI log exposed every internal API, and that the last rotation attempt was abandoned. Made the new path the easy path: the platform issued identities automatically and a service template did mTLS with no code. Ran it on two volunteer teams first, kept the key working in parallel, and published a weekly count of services still on the key. <b>Result:</b> most services moved within a quarter through template upgrades alone; the key was then scoped down and finally revoked with one day of follow-up fixes.</p>', lvl: 'deep' }
    ],

    code: [
      {
        title: 'Kubernetes: name, readiness and graceful removal', lang: 'yaml',
        code: `apiVersion: v1
kind: Service
metadata: { name: payments, namespace: shop }   # payments.shop.svc.cluster.local
spec:
  selector: { app: payments }
  ports: [{ name: http, port: 80, targetPort: 8080 }]
  # clusterIP: None   # headless: DNS returns pod IPs for client-side balancing (gRPC)
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: payments, namespace: shop }
spec:
  replicas: 4
  selector: { matchLabels: { app: payments } }
  template:
    metadata: { labels: { app: payments } }
    spec:
      serviceAccountName: payments          # the workload identity is tied to this
      terminationGracePeriodSeconds: 40
      containers:
        - name: app
          image: registry.example/payments:1.42.0
          ports: [{ containerPort: 8080 }]
          envFrom: [{ configMapRef: { name: payments-config } }]   # config outside the image
          readinessProbe:                   # decides membership in the Service
            httpGet: { path: /readyz, port: 8080 }
            periodSeconds: 5
            failureThreshold: 2             # out of rotation after about 10 s
          livenessProbe:                    # restarts a stuck process; keep it cheap
            httpGet: { path: /livez, port: 8080 }
            periodSeconds: 10
            failureThreshold: 3
          lifecycle:
            preStop: { exec: { command: ["sleep", "10"] } }   # let endpoints update first
          volumeMounts: [{ name: db-creds, mountPath: /var/run/secrets/db, readOnly: true }]
      volumes:
        - name: db-creds
          secret: { secretName: payments-db }   # synced from a secret manager; rotates as a file`,
        note: 'On deletion Kubernetes removes the pod from the endpoints and sends SIGTERM <b>at the same time</b>. The <code>preStop</code> sleep keeps the pod serving while proxies learn it is gone, which is what makes rolling deploys error-free. The container image must contain a <code>sleep</code> binary (or use the built-in sleep action on recent Kubernetes versions).'
      },
      {
        title: 'Spring Boot: accept only tokens meant for this service', lang: 'java',
        code: `// Spring Boot 3.3+, spring-boot-starter-oauth2-resource-server (Spring Security 6)
@Configuration
@EnableWebSecurity
class SecurityConfig {
  private static final String ISSUER = "https://sts.shop.example";
  private static final String AUDIENCE = "payments";

  @Bean
  SecurityFilterChain api(HttpSecurity http) throws Exception {
    http.csrf(csrf -> csrf.disable())      // stateless API, no browser session
        .authorizeHttpRequests(a -> a
            .requestMatchers("/livez", "/readyz").permitAll()
            .requestMatchers(HttpMethod.POST, "/payments/**").hasAuthority("SCOPE_payments:charge")
            .anyRequest().authenticated())
        .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()));
    return http.build();
  }

  @Bean
  JwtDecoder jwtDecoder() {
    NimbusJwtDecoder decoder = JwtDecoders.fromIssuerLocation(ISSUER);   // fetches + caches JWKS
    OAuth2TokenValidator<Jwt> audience = new JwtClaimValidator<List<String>>(
        JwtClaimNames.AUD, aud -> aud != null && aud.contains(AUDIENCE));
    decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
        JwtValidators.createDefaultWithIssuer(ISSUER),   // signature, exp, nbf, iss
        audience));                                      // reject tokens minted for others
    return decoder;
  }
}`,
        note: 'Signature and expiry checks are not enough: without the audience check, a token issued for Inventory would be accepted here. The same can be configured with the <code>spring.security.oauth2.resourceserver.jwt.audiences</code> property. Which <b>service</b> is calling is checked separately, by mTLS in the mesh or in the server\'s TLS configuration.'
      },
      {
        title: 'Go: mTLS server that admits one SPIFFE identity', lang: 'go',
        code: `// github.com/spiffe/go-spiffe/v2 ; the SPIRE agent socket comes from SPIFFE_ENDPOINT_SOCKET
package main

import (
	"context"
	"log"
	"net/http"

	"github.com/spiffe/go-spiffe/v2/spiffeid"
	"github.com/spiffe/go-spiffe/v2/spiffetls/tlsconfig"
	"github.com/spiffe/go-spiffe/v2/workloadapi"
)

func main() {
	ctx := context.Background()
	// Fetches this workload's X.509-SVID and trust bundle, and keeps them rotated.
	source, err := workloadapi.NewX509Source(ctx)
	if err != nil {
		log.Fatalf("workload API: %v", err)
	}
	defer source.Close()

	orders := spiffeid.RequireFromString("spiffe://shop.example/ns/shop/sa/orders")
	// Present our SVID, require a client SVID, and accept only the Orders identity.
	tlsCfg := tlsconfig.MTLSServerConfig(source, source, tlsconfig.AuthorizeID(orders))

	mux := http.NewServeMux()
	mux.HandleFunc("POST /payments", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusAccepted) // token audience + scope checks go here
	})
	srv := &http.Server{Addr: ":8443", Handler: mux, TLSConfig: tlsCfg}
	log.Fatal(srv.ListenAndServeTLS("", "")) // certificates come from the source
}`,
        note: 'No certificate files and no secrets in config: the workload asks the local Workload API and receives a certificate that is replaced before it expires. In a mesh the sidecar does the same job and the application stays plain HTTP. See <a href="zero-trust.html">zero trust</a> and <a href="service-mesh.html">service mesh</a> for the wider design.'
      }
    ],

    related: ['service-mesh', 'zero-trust', 'iam-oauth-oidc', 'secrets-kms', 'ms-communication', 'ms-operations', 'sd:api-gateway']
  });
})();

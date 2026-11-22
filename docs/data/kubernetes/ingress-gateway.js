IA.register({
  track: 'kubernetes',
  slug: 'ingress-gateway',
  title: 'Ingress & Gateway API',
  tagline: 'Services are L4: an IP and a port. <b>Ingress</b> and the <b>Gateway API</b> add L7: hostnames, paths, headers, TLS and traffic splits. Both are only <i>configuration</i>. A controller you install does the actual proxying.',
  tldr: {
    problem: 'One <code>type: LoadBalancer</code> per app means one cloud LB, one IP and one certificate per app, with no path routing. You want one edge that terminates TLS and routes <code>/api</code> and <code>/</code> to different Services.',
    model: 'Client → cloud L4 LB → <b>controller pods</b> (NGINX, Envoy, HAProxy, a cloud L7 LB…) that watch Ingress or Gateway/HTTPRoute objects and turn them into proxy config → Service → pod. No controller means nothing happens: the object just sits there.',
    hook: '“Why does <code>/apiv2</code> not go to the API?” Because <code>pathType: Prefix</code> matches whole path <b>elements</b>: <code>/api</code> matches <code>/api</code> and <code>/api/x</code>, never <code>/apiv2</code>.',
    facts: [
      { v: '1.19', l: 'Ingress <code>networking.k8s.io/v1</code> went GA. The API is now frozen: new features go into Gateway API' },
      { v: 'v1.0', l: 'Gateway API GA (Oct 2023): GatewayClass, Gateway and HTTPRoute. GRPCRoute followed in v1.1. Gateway API ships as CRDs, versioned separately from Kubernetes' },
      { v: '3', l: 'Ingress <code>pathType</code> values: <code>Exact</code>, <code>Prefix</code> and <code>ImplementationSpecific</code> (whatever the controller decides, often regex)' }
    ]
  },
  intro: {
    what: 'Your cluster runs a web front end, an orders API and a health endpoint. You want all of them behind one address, <code>https://shop.example.com</code>, with one certificate. An <b>Ingress</b> (or a Gateway API <b>HTTPRoute</b>) is a set of routing rules: “requests for this host and this path go to that Service”. An <b>ingress controller</b> is a reverse proxy running in the cluster that reads those rules and does the routing.',
    analogy: { icon: '🏨', title: 'A hotel reception desk', text: 'Every guest comes in through one front door (the load balancer). Reception checks who they are (TLS) and which room they asked for (host + path), then sends them to the right floor (Service). The routing sheet behind the desk is the Ingress. The receptionist reading it is the controller. Without a receptionist, the sheet does nothing.' },
    steps: [
      { t: 'Install a controller', d: 'Kubernetes ships no ingress controller. Install one (for example Envoy Gateway, Contour, Traefik, HAProxy, or a cloud one such as the AWS Load Balancer Controller or GKE’s). It usually sits behind a <code>type: LoadBalancer</code> Service.' },
      { t: 'Write the rules', d: 'Host + path → Service and port.', code: 'rules:\n  - host: shop.example.com\n    http:\n      paths:\n        - path: /api\n          pathType: Prefix\n          backend: { service: { name: orders-api, port: { number: 80 } } }' },
      { t: 'Add TLS', d: 'Put the certificate in a <code>kubernetes.io/tls</code> Secret and reference it. The controller terminates TLS and talks plain HTTP to the pods (unless you configure otherwise).' },
      { t: 'Point DNS at the LB', d: 'The controller writes the LB address into the Ingress <code>status</code>. Create a DNS record for it (external-dns can do that automatically).', code: 'kubectl get ingress shop -o wide\n# NAME  CLASS  HOSTS             ADDRESS        PORTS\n# shop  nginx  shop.example.com  34.120.8.9     80, 443', lang: 'bash' },
      { t: 'Gateway API: same idea, split by role', d: 'A platform team owns the <b>GatewayClass</b> and <b>Gateway</b> (listeners, certificates). App teams own <b>HTTPRoutes</b> in their own namespaces that attach to the Gateway.' }
    ],
    terms: [
      ['ingress controller', 'A proxy deployment that watches Ingress objects and configures itself from them.'],
      ['IngressClass', 'Names which controller handles an Ingress (<code>spec.ingressClassName</code>).'],
      ['TLS termination', 'Decrypting HTTPS at the proxy; traffic behind it is plain HTTP unless re-encrypted.'],
      ['GatewayClass / Gateway', 'Gateway API: the kind of proxy, and one instance of it with listeners (port, protocol, hostname, certificate).'],
      ['HTTPRoute', 'Gateway API routing rules: match on path, headers, method or query, then forward (with weights) or filter (redirect, rewrite, header changes).'],
      ['SNI', 'The hostname the client sends in the TLS handshake. The proxy uses it to pick the right certificate.']
    ]
  },
  visual: {
    title: 'Route a request through the edge',
    caption: 'Choose Ingress or Gateway API, pick a request, and press Play. Each rule lights up green (match) or red (no match) with the reason. The winning rule picks the Service. Try <code>/apiv2</code>, the canary header and plain <code>http://</code>.'
  },
  gotchas: [
    { trap: '<code>Prefix</code> matches path elements, not characters', code: `- path: /api\n  pathType: Prefix   # matches /api, /api/, /api/orders\n                     # does NOT match /apiv2 or /api-docs`, why: 'Ingress v1 defines <code>Prefix</code> as an element-wise match on <code>/</code>-separated segments. Gateway API <code>PathPrefix</code> works the same way.', fix: 'Write the exact segment boundaries you mean. For anything fancier, use Gateway API matches or a controller’s documented regex mode, not character prefixes.' },
    { trap: 'An Ingress with no class is silently ignored', why: 'If <code>ingressClassName</code> is missing and no IngressClass is marked default (<code>ingressclass.kubernetes.io/is-default-class: "true"</code>), no controller claims it. It never gets an address, and no error is shown.', fix: 'Always set <code>spec.ingressClassName</code>. The old <code>kubernetes.io/ingress.class</code> annotation is deprecated.' },
    { trap: 'Annotations are not portable', code: `nginx.ingress.kubernetes.io/rewrite-target: /$2\nnginx.ingress.kubernetes.io/proxy-body-size: 20m`, why: 'Ingress itself has no rewrites, header matching, timeouts or traffic splits. Every controller adds its own annotations, so a manifest written for one controller means nothing to another.', fix: 'Gateway API moves these into the spec: <code>URLRewrite</code>, <code>RequestHeaderModifier</code>, header matches and <code>weight</code> on <code>backendRefs</code>. Prefer it for new work.' },
    { trap: 'Spring builds <code>http://</code> redirect URLs behind TLS termination', why: 'TLS ends at the proxy, so Tomcat sees plain HTTP on port 8080. Without trusting <code>X-Forwarded-Proto</code>/<code>Host</code>, Spring generates <code>http://</code> links and redirect loops (OAuth2 login is the classic case).', fix: 'Set <code>server.forward-headers-strategy=native</code> (or <code>framework</code>), and make sure the proxy sets the headers and strips any the client sent.' },
    { trap: 'Running the retired community ingress-nginx', why: 'The community <code>kubernetes/ingress-nginx</code> project announced its retirement in November 2025, with best-effort maintenance ending in March 2026. It also had serious CVEs, for example the “IngressNightmare” admission-webhook RCE (CVE-2025-1974) in March 2025. Note that F5’s NGINX Ingress Controller is a different project.', fix: 'Plan a move to a maintained controller, ideally one that implements Gateway API. Run the migration tool <code>ingress2gateway</code> to translate existing Ingress objects as a starting point.' },
    { trap: 'An HTTPRoute that never attaches', why: 'A Gateway listener only accepts routes from namespaces allowed by <code>allowedRoutes</code> (the default is <code>Same</code>). Routing to a Service in another namespace also needs a <code>ReferenceGrant</code> there. Either way, traffic falls through to a 404.', fix: 'Read the route status: <code>kubectl get httproute shop -o yaml</code> and look at <code>Accepted</code> and <code>ResolvedRefs</code> under <code>status.parents[].conditions</code>.' }
  ],
  scenarios: [
    { title: 'OAuth login loops forever after moving behind the ingress',
      symptom: 'After the move to Kubernetes, users who click “Log in” bounce between the identity provider and <code>/login/oauth2/code/…</code> until the browser gives up.',
      diagnose: `curl -sI https://shop.example.com/oauth2/authorization/okta | grep -i location\n# location: https://idp.example.com/...&redirect_uri=http://shop.example.com/login/oauth2/code/okta\n#                                                    ^^^^ http, not https`,
      diagnoseLang: 'bash',
      cause: 'TLS is terminated at the ingress controller. Spring Boot sees an HTTP request on port 8080 and builds the redirect URI with <code>http://</code>. The IdP rejects it, or redirects to http, which the ingress bounces back to https.',
      fix: 'Have Spring trust the forwarded headers, and only accept them from the proxy.',
      fixCode: `# application.yaml (Spring Boot 3.x)\nserver:\n  forward-headers-strategy: native   # Tomcat RemoteIpValve reads X-Forwarded-*\n  tomcat:\n    remoteip:\n      internal-proxies: '10\\.244\\.\\d{1,3}\\.\\d{1,3}'   # narrow trust to the pod CIDR` },
    { title: 'Docs site returns the API’s 404 page',
      symptom: 'A new route <code>/api-docs</code> for a Swagger UI Service returns JSON <code>{"status":404}</code> from the orders API instead of the docs page.',
      diagnose: `kubectl get ingress shop -o jsonpath='{range .spec.rules[0].http.paths[*]}{.path} {.pathType} {.backend.service.name}{"\\n"}{end}'\n# /api  ImplementationSpecific  orders-api\n# /api-docs Prefix              docs`,
      diagnoseLang: 'bash',
      cause: 'The <code>/api</code> path used <code>ImplementationSpecific</code>, which this controller treats as a regex/character prefix, so <code>/api-docs</code> matched it first. With <code>Prefix</code> it would not have.',
      fix: 'Use <code>Prefix</code> or <code>Exact</code> everywhere unless you deliberately need the controller’s regex mode, and add a test request per route to CI.',
      fixCode: `paths:\n  - { path: /api,      pathType: Prefix, backend: { service: { name: orders-api, port: { number: 80 } } } }\n  - { path: /api-docs, pathType: Prefix, backend: { service: { name: docs,       port: { number: 80 } } } }` },
    { title: 'Canary got 0% of traffic for a week',
      symptom: 'The team added an HTTPRoute splitting 90/10 between <code>orders-api</code> and <code>orders-api-v2</code>. The v2 dashboards stayed flat.',
      diagnose: `kubectl get httproute orders-canary -n shop -o jsonpath='{.status.parents[0].conditions}' | jq '.[] | {type,status,reason}'\n# {"type":"Accepted","status":"False","reason":"NotAllowedByListeners"}`,
      diagnoseLang: 'bash',
      cause: 'The shared Gateway lives in namespace <code>infra</code>, and its listener had <code>allowedRoutes.namespaces.from: Same</code>. The route in <code>shop</code> was never attached; an older Ingress kept serving all the traffic.',
      fix: 'Allow routes from labelled namespaces on the listener, then confirm <code>Accepted=True</code> and <code>ResolvedRefs=True</code> before you trust any split.',
      fixCode: `listeners:\n  - name: https\n    port: 443\n    protocol: HTTPS\n    hostname: shop.example.com\n    tls: { certificateRefs: [{ name: shop-tls }] }\n    allowedRoutes:\n      namespaces:\n        from: Selector\n        selector: { matchLabels: { gateway-access: shared } }` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Ingress path <code>/api</code> with <code>pathType: Prefix</code>. Which request matches?', options: ['/apiv2/orders', '/api-docs', '/api/orders/42', 'All three'], answer: 2, explain: '<code>Prefix</code> compares whole <code>/</code>-separated elements. <code>/api/orders/42</code> starts with the element <code>api</code>. <code>/apiv2</code> and <code>/api-docs</code> have different first elements.' },
    { kind: 'predict', q: 'One Ingress host has <code>/api/health</code> as both <code>Exact</code> (→ health) and <code>Prefix</code> (→ orders-api). A request for <code>/api/health</code> goes to…', options: ['health', 'orders-api', 'whichever rule is listed first', 'it is rejected as ambiguous'], answer: 0, explain: 'The longest matching path wins. When two paths are equally long, <code>Exact</code> beats <code>Prefix</code>.' },
    { kind: 'scenario', q: 'HTTPRoute rule A: <code>PathPrefix /api</code> + header <code>x-canary: "true"</code> → v2. Rule B: <code>PathPrefix /api</code> → v1. Request <code>GET /api/orders</code> with <code>x-canary: true</code>?', options: ['v1, because B is more general', 'v2: same path match, more header matches', 'Both, 50/50', 'Depends on route creation order only'], answer: 1, explain: 'Gateway API precedence: Exact path, then the longest prefix, then a method match, then the <b>largest number of header matches</b>, then query params. Creation time and name only break exact ties. A has one header match and B has none, so A wins.' },
    { kind: 'concept', q: 'TLS is terminated at the ingress controller. What does the Spring Boot pod receive by default?', options: ['HTTPS on 8443', 'Raw TLS it must decrypt', 'Nothing until mTLS is configured', 'Plain HTTP, with X-Forwarded-Proto: https (if the proxy sets it)'], answer: 3, explain: 'The proxy decrypts and opens a new HTTP connection to the pod IP. Re-encryption to the backend is optional (Gateway API <code>BackendTLSPolicy</code>, or controller-specific annotations). TLS <i>passthrough</i> instead needs SNI routing (<code>TLSRoute</code>, in the Standard channel since Gateway API v1.5, or a controller feature).' },
    { kind: 'scenario', q: 'HTTPRoute in namespace <code>shop</code> forwards to Service <code>payments</code> in namespace <code>pay</code>. There is no ReferenceGrant. Result?', options: ['Route accepted, but that backend is not permitted (ResolvedRefs=False) and requests get an error status', 'Works, because Services are cluster-wide', 'The API server rejects the HTTPRoute', 'Traffic goes to the default backend in pay'], answer: 0, explain: 'Cross-namespace references need a <code>ReferenceGrant</code> in the <b>target</b> namespace, so the owner of <code>pay</code> must opt in. Without it the backend is invalid (reason <code>RefNotPermitted</code>), and the implementation returns an error, typically a 500, for that rule.' },
    { kind: 'predict', q: '<code>backendRefs: [{name: v1, weight: 90}, {name: v2, weight: 10}]</code>. A gRPC client sends 1,000 RPCs over one HTTP/2 connection. Roughly how many reach v2?', options: ['0 or 1,000 (connection-level)', '≈100', 'Exactly 500', '≈10'], answer: 1, explain: 'An L7 proxy balances each <b>request</b>, not the connection, so the split applies per RPC: about 10%. That is a key difference from a plain ClusterIP Service, which balances per connection.' },
    { kind: 'bug', q: 'An Ingress has no <code>ingressClassName</code>, and the cluster has two controllers and no default IngressClass. What happens?', options: ['Both controllers serve it', 'The newer controller takes it', 'Neither claims it; it never gets an address', 'The API server rejects it'], answer: 2, explain: 'An Ingress is just data. Controllers only act on Ingresses of their class, or class-less ones if their class is marked default. Set <code>ingressClassName</code> explicitly.' }
  ],
  interview: [
    { q: 'Ingress vs a LoadBalancer Service: when do you need which?', a: '<p>A LoadBalancer Service is L4: one IP and port, TCP/UDP, with no awareness of hosts or paths. Ingress/Gateway is L7 HTTP(S): many hostnames and paths behind one LB, TLS termination, redirects, header routing and per-request splits. The ingress controller itself is usually exposed <i>through</i> a LoadBalancer Service. Non-HTTP protocols (Postgres, Kafka) use LoadBalancer Services, or Gateway API TCP/TLS routes where supported.</p>', lvl: 'core' },
    { q: 'What is an ingress controller, concretely?', a: '<p>A Deployment (or DaemonSet) of reverse-proxy pods plus a control loop. The loop watches Ingress, Service, EndpointSlice and Secret objects and renders proxy config. Many controllers send traffic straight to <b>pod IPs</b> from EndpointSlices, skipping kube-proxy, which gives them per-request balancing and retries. Cloud controllers instead program an external L7 load balancer.</p>', fu: 'Why do some controllers bypass the ClusterIP? (Per-request balancing, retries and sticky sessions need to know the individual pods.)', lvl: 'core' },
    { q: 'Explain the Gateway API resource model.', a: '<ul><li><b>GatewayClass</b> (cluster-scoped, owned by the infra provider): which controller.</li><li><b>Gateway</b> (owned by the platform team): listeners with port, protocol, hostname, TLS certs, and <code>allowedRoutes</code>.</li><li><b>HTTPRoute / GRPCRoute</b> (owned by app teams): <code>parentRefs</code> to a Gateway, matches, filters and weighted <code>backendRefs</code>.</li><li><b>ReferenceGrant</b>: lets a namespace allow references from another one.</li></ul><p>Splitting by role means app teams change routes without touching certificates or LBs.</p>', lvl: 'core' },
    { q: 'How do Ingress path rules resolve conflicts?', a: '<p>Within a host, the longest matching path wins. At equal length, <code>Exact</code> beats <code>Prefix</code>. <code>Prefix</code> matches whole path elements, and a trailing slash is ignored. <code>ImplementationSpecific</code> means the controller decides, and is often a regex. Across several Ingress objects for the same host, merge behaviour is controller-specific, which is one more reason to prefer Gateway API’s defined precedence.</p>', lvl: 'deep' },
    { q: 'HTTPRoute match precedence?', a: '<p>When rules from several routes match: an <code>Exact</code> path beats a <code>PathPrefix</code>; then the longest prefix; then a rule with a method match; then the most header matches; then the most query-param matches. Remaining ties go to the oldest route by creation timestamp, then alphabetically by namespace/name. Within a route, the first matching rule in order.</p>', lvl: 'deep' },
    { q: 'Where should TLS terminate, and what are the options?', a: '<ul><li><b>Terminate at the edge</b> (most common): the cert lives in a Secret, often issued by cert-manager.</li><li><b>Re-encrypt</b> to the pod: Gateway API <code>BackendTLSPolicy</code> or controller settings.</li><li><b>Passthrough</b>: SNI routing to a pod that holds the cert (<code>TLSRoute</code>, Standard since Gateway API v1.5).</li><li><b>Mesh mTLS</b> between pods, independent of the edge.</li></ul><p>Behind termination, the app must trust <code>X-Forwarded-*</code> only from the proxy.</p>', lvl: 'core' },
    { q: 'How would you do a canary release at the edge?', a: '<p>With Gateway API: weighted <code>backendRefs</code> (90/10), or a header-matched rule (<code>x-canary: true</code>) for internal testers. Splits are per request. Watch error rate and latency per backend, then shift weights (Argo Rollouts and Flagger automate this). With Ingress you depend on controller annotations (for example ingress-nginx’s canary annotations).</p>', lvl: 'core' },
    { q: 'An HTTPRoute was applied but traffic doesn’t reach it. How do you debug?', a: '<ol><li><code>status.parents[].conditions</code>: <code>Accepted</code> (did the listener allow it? hostname overlap? namespace allowed?) and <code>ResolvedRefs</code> (do the backends exist? ReferenceGrant?).</li><li>The Gateway status: is the listener <code>Programmed</code>, and does it have an address?</li><li>Hostnames: the route hostname must intersect the listener hostname.</li><li>Then the backend Service’s EndpointSlices.</li></ol>', lvl: 'deep' },
    { q: 'What changed with ingress-nginx, and what does it mean for you?', a: '<p>The community <code>kubernetes/ingress-nginx</code> controller was retired: SIG Network announced it in November 2025, with best-effort maintenance until March 2026. Clusters still running it no longer get security fixes. Migrate to a maintained controller, preferably one with Gateway API support. <code>ingress2gateway</code> converts existing Ingress objects; controller-specific annotations need manual review.</p>', lvl: 'core' },
    { q: 'How does the edge interact with graceful shutdown of Spring pods?', a: '<p>Controllers that route to pod IPs learn about a terminating pod through EndpointSlice updates, which take a moment to arrive. If Spring stops accepting connections immediately on SIGTERM, in-flight and newly routed requests fail with 502s. Use a short <code>preStop</code> sleep plus <code>server.shutdown=graceful</code> (the default since Boot 3.4). See <a href="disruptions-pdb.html">Disruptions & PDBs</a>.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Ingress (v1) with TLS', lang: 'yaml', code: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
  namespace: shop
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt   # cert-manager fills the Secret
spec:
  ingressClassName: traefik
  tls:
    - hosts: [shop.example.com]
      secretName: shop-tls
  rules:
    - host: shop.example.com
      http:
        paths:
          - { path: /api/health, pathType: Exact,  backend: { service: { name: health,     port: { name: http } } } }
          - { path: /api,        pathType: Prefix, backend: { service: { name: orders-api, port: { name: http } } } }
          - { path: /,           pathType: Prefix, backend: { service: { name: web,        port: { name: http } } } }` },
    { title: 'Gateway API (v1)', lang: 'yaml', code: `apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata: { name: edge, namespace: infra }
spec:
  gatewayClassName: envoy
  listeners:
    - name: http
      port: 80
      protocol: HTTP
    - name: https
      port: 443
      protocol: HTTPS
      hostname: shop.example.com
      tls: { mode: Terminate, certificateRefs: [{ name: shop-tls }] }
      allowedRoutes: { namespaces: { from: All } }
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata: { name: shop, namespace: shop }
spec:
  parentRefs: [{ name: edge, namespace: infra, sectionName: https }]
  hostnames: [shop.example.com]
  rules:
    - matches: [{ path: { type: PathPrefix, value: /api }, headers: [{ name: x-canary, value: "true" }] }]
      backendRefs: [{ name: orders-api-v2, port: 80 }]
    - matches: [{ path: { type: PathPrefix, value: /api } }]
      backendRefs:
        - { name: orders-api,    port: 80, weight: 90 }
        - { name: orders-api-v2, port: 80, weight: 10 }
    - matches: [{ path: { type: PathPrefix, value: / } }]
      backendRefs: [{ name: web, port: 80 }]
---
# http → https on the plain listener
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata: { name: redirect, namespace: infra }
spec:
  parentRefs: [{ name: edge, sectionName: http }]
  rules:
    - filters: [{ type: RequestRedirect, requestRedirect: { scheme: https, statusCode: 301 } }]` },
    { title: 'Spring Boot behind the proxy', lang: 'yaml', code: `# application.yaml (Spring Boot 3.x)
server:
  forward-headers-strategy: native   # trust X-Forwarded-Proto/Host/For from the proxy
  shutdown: graceful                 # default since Boot 3.4
spring:
  lifecycle:
    timeout-per-shutdown-phase: 20s
management:
  endpoint:
    health:
      probes:
        enabled: true                # /actuator/health/readiness for the readiness probe` }
  ]
});

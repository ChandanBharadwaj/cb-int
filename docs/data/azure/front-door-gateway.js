IA.register({
  track: 'azure',
  slug: 'front-door-gateway',
  title: 'Front Door & Application Gateway',
  tagline: '<b>Front Door</b> is a <b>global</b> HTTP(S) entry point: users connect to the nearest Microsoft edge location, and Front Door routes to the healthiest, closest origin in any region. <b>Application Gateway</b> is a <b>regional</b> layer-7 load balancer that lives in your VNet. Both can carry a <b>WAF</b>. Choosing between them, Traffic Manager and Load Balancer comes down to two questions: global or regional, and HTTP or not.',
  lang: 'bash',
  tldr: {
    problem: 'Teams put Front Door in front of a public App Service and forget that the origin is still reachable directly, so the WAF is bypassed. Others run WAF in Detection mode for a year, or deploy Front Door and Application Gateway together without knowing which one does what, and get broken redirects because the app sees the wrong host name.',
    model: '<b>Front Door</b>: anycast to the nearest edge → route (domain + path) → origin group with health probes and latency-based selection → origin, optionally over Private Link. <b>Application Gateway</b>: listener (IP, port, host) → rule (basic or path-based) → backend pool, with HTTP settings and probes, inside one region. <b>WAF</b> on either inspects requests against managed and custom rules, in Detection or Prevention mode.',
    hook: '“Front Door or Traffic Manager for multi-region?” Traffic Manager is <b>DNS</b>: it hands out an IP and the client connects directly, so failover waits for DNS TTLs and client caches, but it works for any protocol. Front Door is a <b>reverse proxy</b>: it fails over per request, and adds TLS termination, caching and WAF, but only for HTTP(S).',
    facts: [
      { v: '2 × 2', l: 'the decision grid: global HTTP → Front Door; global any protocol → Traffic Manager (or cross-region LB); regional HTTP → Application Gateway; regional L4 → Load Balancer' },
      { v: 'X-Azure-FDID', l: 'header carrying your Front Door profile’s ID; check it at the origin, with the AzureFrontDoor.Backend service tag, to accept only your profile’s traffic' },
      { v: 'Detection → Prevention', l: 'WAF modes: Detection only logs matches; Prevention blocks them. Tune exclusions in Detection, then switch' }
    ]
  },
  intro: {
    what: 'A <b>load balancer</b> spreads traffic over several copies of your app and stops sending it to copies that fail health checks. Azure has four main ones. <b>Front Door</b> works at global scale for web traffic. <b>Application Gateway</b> works inside one region for web traffic, with URL-based routing. <b>Load Balancer</b> works inside a region for any TCP/UDP traffic. <b>Traffic Manager</b> steers clients with DNS answers. Front Door and Application Gateway can both include a <b>web application firewall</b> (WAF) that blocks common attacks such as SQL injection.',
    analogy: { icon: '✈️', title: 'Airline hubs and a terminal’s gates', text: '<b>Front Door</b> is the airline’s global booking network: you check in at the airport nearest to you, and it routes you to whichever hub is open and fastest. <b>Application Gateway</b> is one terminal’s signage: inside one airport it sends “/international” to one set of gates and “/domestic” to another. The <b>WAF</b> is security screening, and <b>Traffic Manager</b> is a phone line that just tells you which airport to drive to.' },
    steps: [
      { t: 'Decide the scope: global or regional', d: 'Users worldwide or multi-region active-active → Front Door. One region, private backends in a VNet → Application Gateway.' },
      { t: 'Decide the protocol: HTTP(S) or anything', d: 'Front Door and Application Gateway are HTTP(S) only. TCP/UDP goes through Load Balancer, or Traffic Manager / cross-region Load Balancer globally.' },
      { t: 'Create the entry point and point it at origins', d: 'Origins can be App Service, Container Apps, Application Gateway, Storage or any public host, and with Premium, private origins through Private Link.', code: 'az afd profile create -g rg-edge -n afd-shop --sku Premium_AzureFrontDoor\naz afd endpoint create -g rg-edge --profile-name afd-shop -n shop --enabled-state Enabled' },
      { t: 'Lock the origin and turn on WAF', d: 'Allow only your Front Door profile at the origin, and attach a WAF policy, starting in Detection mode.' }
    ],
    terms: [
      ['edge / POP', 'A Microsoft point of presence close to users, where Front Door terminates TLS and caches content.'],
      ['origin / origin group', 'Front Door’s backends and the set it balances across, with health probes, priority, weight and latency settings.'],
      ['listener / rule / backend pool', 'Application Gateway’s pieces: what it listens on, how it routes, and where it sends traffic.'],
      ['WAF policy', 'Managed rule sets (OWASP-based Default Rule Set) plus custom rules (rate limits, geo filters, IP lists), in Detection or Prevention mode.'],
      ['Traffic Manager', 'DNS-based global traffic routing (priority, weighted, performance, geographic). Clients then connect directly to the endpoint.'],
      ['Azure Load Balancer', 'A layer-4 (TCP/UDP) load balancer, regional; the cross-region tier balances across regional load balancers.']
    ]
  },
  visual: {
    title: 'Global vs regional load balancing',
    caption: 'Pick a view and press Play. <b>Front Door</b>: users in two continents hit their nearest edge, Front Door picks the closest healthy origin, then a region fails. <b>App Gateway</b>: path-based routing to two backend pools inside a VNet, with a probe failure. <b>WAF</b>: an injection attempt in Detection vs Prevention mode. <b>Traffic Manager</b>: DNS failover and the TTL problem.'
  },
  extras: [
    { id: 'front-door-gateway-choose', title: 'Choosing a load balancer', label: 'Chooser', caption: 'Answer three questions (scope, protocol, and whether you need a WAF or private backends) and see which service, or which combination, fits.' }
  ],
  gotchas: [
    { trap: 'The origin is still reachable directly', code: `curl -I https://app-shop-weu.azurewebsites.net/   # 200 → WAF, rate limits and geo rules bypassed`, why: 'Front Door doesn’t make the origin private. Anyone who discovers the App Service or Container Apps hostname can skip the edge and its WAF entirely.', fix: 'Restrict the origin to the <code>AzureFrontDoor.Backend</code> service tag <b>and</b> check <code>X-Azure-FDID</code> equals your profile’s ID (the tag alone admits every Front Door customer). With Premium, use Private Link origins and disable public access.' },
    { trap: 'Wrong host name in redirects and cookies', why: 'Behind a proxy, Spring sees the origin’s host (<code>app-shop-weu.azurewebsites.net</code>) unless it trusts forwarded headers. OAuth redirect URIs, absolute links and cookie domains then point at the origin instead of <code>shop.example.com</code>.', fix: 'Set <code>server.forward-headers-strategy=framework</code> (or <code>native</code>) in Spring Boot so <code>X-Forwarded-Host</code> and <code>X-Forwarded-Proto</code> are used. Or preserve the host header end to end and bind the custom domain on the origin too.', code: `server:
  forward-headers-strategy: framework   # honour X-Forwarded-Host/-Proto/-For behind Front Door / App Gateway`, lang: 'yaml' },
    { trap: 'WAF left in Detection mode forever', why: 'Detection mode logs matches but blocks nothing. Teams enable it “to tune first” and never switch, so attacks are only recorded.', fix: 'Run Detection for a short, planned period, review the WAF logs for false positives, add narrowly scoped <b>exclusions</b> (for example a JSON field that legitimately contains SQL keywords), then switch to <b>Prevention</b>.' },
    { trap: 'Probes that test nothing, or too much', why: 'A probe on <code>/</code> may return 200 from a static page while the app can’t reach its database. A probe on a deep health check that calls every dependency can take all origins out at once when one shared dependency blips.', fix: 'Probe a lightweight readiness endpoint (Spring Boot Actuator <code>/actuator/health/readiness</code>) that reflects whether <i>this instance</i> can serve. Keep shared dependencies out of liveness-style probes.' },
    { trap: 'Expecting instant failover from Traffic Manager', why: 'Traffic Manager answers DNS. After an endpoint fails, clients keep using the cached IP until the TTL expires, and some clients and resolvers cache longer than the TTL.', fix: 'Use a low TTL for failover profiles, and for HTTP use Front Door, which fails over per request. Keep Traffic Manager for non-HTTP traffic or DNS-level steering.' },
    { trap: 'Front Door and Application Gateway both doing everything', why: 'Stacking both with WAF in each, TLS re-encryption and duplicated routing rules adds latency, cost and two places to debug.', fix: 'Give each one a job: Front Door for global entry, caching and the main WAF; Application Gateway (often without WAF, or with a light policy) as the private regional ingress into the VNet when backends must stay private. Or use Front Door Premium with Private Link origins and skip Application Gateway.' }
  ],
  scenarios: [
    { title: 'Attackers bypassed the WAF',
      symptom: 'WAF logs show blocked SQL-injection attempts, yet the database audit shows the same payloads reaching the app from IPs that never appear in Front Door logs.',
      diagnose: `az webapp config access-restriction show -g rg-shop -n app-shop-weu
# "ipSecurityRestrictions": [ { "ipAddress": "Any", "action": "Allow" } ]`,
      cause: 'The App Service origin accepted traffic from anywhere. Attackers found its <code>azurewebsites.net</code> host name and sent requests directly.',
      fix: 'Restrict the origin to the Front Door service tag with an <code>X-Azure-FDID</code> header match, and move to Private Link origins when you can.',
      fixCode: `FDID=$(az afd profile show -g rg-edge -n afd-shop --query frontDoorId -o tsv)
az webapp config access-restriction add -g rg-shop -n app-shop-weu --priority 100 \\
  --rule-name front-door-only --action Allow --service-tag AzureFrontDoor.Backend \\
  --http-header x-azure-fdid=$FDID` },
    { title: 'Login loops after moving behind Front Door',
      symptom: 'Users signing in with Entra ID are redirected to <code>https://app-shop-weu.azurewebsites.net/login/oauth2/code/…</code> and get <code>AADSTS50011: redirect URI mismatch</code>.',
      diagnose: `# Spring Security builds the redirect URI from the request's host and scheme
# the app sees Host: app-shop-weu.azurewebsites.net (origin host header) and no forwarded-header support`,
      cause: 'Spring didn’t honour <code>X-Forwarded-Host</code>, so it built the OAuth redirect URI from the origin’s host name.',
      fix: 'Enable forwarded headers in Spring Boot (and trust only the proxy), or configure Front Door to forward the original host and bind the custom domain on the App Service as well.',
      fixCode: `server:
  forward-headers-strategy: framework
# Spring Security then builds https://shop.example.com/login/oauth2/code/azure`, lang: 'yaml' },
    { title: 'Checkout API blocked by the WAF after a release',
      symptom: 'After enabling Prevention mode, a share of <code>POST /api/orders</code> calls get 403. The WAF log shows rule 942100 (SQL injection) matching the <code>notes</code> field.',
      diagnose: `// Log Analytics (KQL): Front Door WAF log
AzureDiagnostics
| where Category == "FrontDoorWebApplicationFirewallLog" and action_s == "Block"
| where TimeGenerated > ago(1h)
| summarize count() by ruleName_s, requestUri_s
| top 10 by count_`,
      cause: 'Customers type free text such as “select … from the drop-down, or …” into the delivery notes, which matches a SQL-injection signature.',
      fix: 'Add a narrowly scoped exclusion for that JSON field and that rule group only, keep Prevention on, and validate input in the API as well.',
      fixCode: `az network front-door waf-policy managed-rules exclusion add -g rg-edge --policy-name wafshop \\
  --type Microsoft_DefaultRuleSet --rule-group-id SQLI \\
  --match-variable RequestBodyJsonArgNames --operator Equals --value notes` }
  ],
  puzzles: [
    { kind: 'scenario', q: 'A Spring API runs active-active in West Europe and East US. Users are worldwide. You need TLS at the edge, a WAF and per-request failover. What do you use?', options: ['Traffic Manager (performance routing)', 'Front Door Standard/Premium', 'Two Application Gateways and DNS round robin', 'A cross-region Load Balancer'], answer: 1, explain: 'Global + HTTP(S) + WAF + per-request failover is Front Door. Traffic Manager only answers DNS, and cross-region Load Balancer is layer 4 without WAF.' },
    { kind: 'scenario', q: 'Inside one region, <code>/api/*</code> must go to AKS and <code>/static/*</code> to a VM scale set, with backends in a private VNet and a WAF. What fits?', options: ['Azure Load Balancer', 'Application Gateway v2 with WAF and path-based rules', 'Traffic Manager', 'Front Door Standard only'], answer: 1, explain: 'Regional, HTTP, path-based routing, VNet-resident backends: Application Gateway. (Front Door Premium could reach private origins through Private Link, but App Gateway is the regional L7 answer.)' },
    { kind: 'scenario', q: 'An SFTP service (TCP 22) must fail over between two regions. What do you use?', options: ['Front Door', 'Application Gateway', 'Traffic Manager (priority) or a cross-region Load Balancer in front of regional Standard Load Balancers', 'APIM'], answer: 2, explain: 'Front Door and Application Gateway only handle HTTP(S). For global non-HTTP traffic use DNS-based Traffic Manager, or the cross-region tier of Azure Load Balancer.' },
    { kind: 'scenario', q: 'You restricted an App Service to the <code>AzureFrontDoor.Backend</code> service tag. Is the origin now accepting only your Front Door?', options: ['Yes', 'No: the tag covers every customer’s Front Door; also match the X-Azure-FDID header to your profile ID', 'Only if you also enable HTTPS', 'Only for GET requests'], answer: 1, explain: 'The service tag is shared across all Front Door profiles. The <code>X-Azure-FDID</code> header identifies <i>your</i> profile, so filter on both.' },
    { kind: 'predict', q: 'A Traffic Manager profile uses priority routing with TTL 300 s. The primary fails at 12:00:00 and the probe marks it down at 12:00:30. When are all clients guaranteed to use the secondary?', options: ['12:00:30', '12:05:30 at the earliest, and later for clients or resolvers that ignore the TTL', 'Immediately', 'Never: Traffic Manager doesn’t fail over'], answer: 1, explain: 'Clients that resolved just before the failure keep the old answer for up to the TTL (300 s) after DNS changes, and some caches hold it longer. Lower the TTL for faster failover.' },
    { kind: 'scenario', q: 'The WAF is in Detection mode. A request contains <code>\' OR 1=1 --</code>. What happens?', options: ['Blocked with 403', 'Allowed, and the match is logged', 'Rate limited', 'Redirected to a CAPTCHA'], answer: 1, explain: 'Detection logs rule matches without blocking. Prevention would block it once the anomaly score passes the threshold.' },
    { kind: 'scenario', q: 'You want Front Door to reach an internal Container Apps environment with no public ingress. Which tier and feature?', options: ['Front Door Standard with an IP allow list', 'Front Door Premium with a Private Link origin', 'Traffic Manager with a private endpoint', 'Front Door can’t do this'], answer: 1, explain: 'Premium supports <b>Private Link origins</b>: Front Door connects through a private endpoint you approve on the origin, so the origin needs no public access. Check the current list of supported origin types on Microsoft Learn.' }
  ],
  interview: [
    { q: 'Compare Front Door, Application Gateway, Traffic Manager and Load Balancer.', a: '<table class="t"><tr><th></th><th>scope</th><th>layer</th><th>notes</th></tr><tr><td>Front Door</td><td>global</td><td>L7 HTTP(S)</td><td>anycast edge, TLS offload, caching, WAF, Private Link origins (Premium)</td></tr><tr><td>Application Gateway</td><td>regional</td><td>L7 HTTP(S)</td><td>in your VNet, path/host routing, WAF, rewrites, mTLS</td></tr><tr><td>Traffic Manager</td><td>global</td><td>DNS</td><td>any protocol, failover bound by TTLs</td></tr><tr><td>Load Balancer</td><td>regional (cross-region tier exists)</td><td>L4 TCP/UDP</td><td>ultra-low latency, zone-redundant, HA ports</td></tr></table>', lvl: 'core' },
    { q: 'How does Front Door pick an origin?', a: '<p>The request hits the nearest edge by anycast. Front Door matches a <b>route</b> (domain, path, protocol), which points to an <b>origin group</b>. Health probes mark origins up or down. Among healthy origins with the highest <b>priority</b>, it picks those within the <b>latency sensitivity</b> window of the fastest, then splits by <b>weight</b>. Session affinity can pin a client with a cookie. Failover happens per request when probes fail.</p>', lvl: 'deep' },
    { q: 'What is the difference between WAF Detection and Prevention modes, and how do you roll out a WAF safely?', a: '<p>Detection evaluates rules and logs matches; Prevention blocks requests whose anomaly score passes the threshold (or that match blocking custom rules). Roll out in Detection, query the logs per rule ID and URI, add exclusions scoped to specific fields and rules, then switch to Prevention, with alerts on blocked-request spikes. Add custom rules for rate limiting and geo filtering if needed.</p>', lvl: 'core' },
    { q: 'How do you make sure traffic reaches your origin only through Front Door?', a: '<ul><li>Best: Front Door Premium with <b>Private Link</b> origins, and public access disabled on the origin.</li><li>Otherwise: allow only the <code>AzureFrontDoor.Backend</code> service tag <b>and</b> require <code>X-Azure-FDID</code> to match your profile ID, at the App Service access restrictions, the App Gateway WAF or the ingress controller.</li></ul>', lvl: 'core' },
    { q: 'When would you put Application Gateway behind Front Door?', a: '<p>When backends must stay inside a VNet and you need regional L7 features there: an AKS ingress, many internal services by path, internal-mode APIM, mTLS to backends, or a regional WAF policy owned by the app team. Front Door handles global routing and the edge WAF; Application Gateway is the private regional ingress. If Private Link origins cover your backends, Front Door Premium alone is often simpler.</p>', lvl: 'deep' },
    { q: 'What must a Spring Boot app do differently behind these proxies?', a: '<ul><li>Honour forwarded headers (<code>server.forward-headers-strategy</code>) for correct redirects, OAuth redirect URIs and <code>request.isSecure()</code>.</li><li>Get the client IP from <code>X-Forwarded-For</code>, trusting only the proxy’s entries.</li><li>Expose Actuator readiness for probes.</li><li>Handle connection draining on shutdown (<code>server.shutdown=graceful</code>).</li><li>Mind cache headers if Front Door caching is enabled.</li></ul>', lvl: 'core' },
    { q: 'Front Door classic vs Standard/Premium?', a: '<p>Standard and Premium are the current tiers. Standard covers routing, caching, custom domains with managed certificates and custom WAF rules. Premium adds managed WAF rule sets, bot protection and Private Link origins. Front Door (classic) has a published retirement date, so migrate rather than build on it; check Learn for the current timeline and migration tooling.</p>', lvl: 'deep' },
    { q: 'How would you design the entry path for an AI chat app with streaming responses?', a: '<p>Front Door in front of the API (streaming over HTTP/1.1 chunked responses or server-sent events works through it; disable caching on those routes and check timeout settings). A WAF with rate-limit custom rules per client IP to blunt abuse, while per-user token budgets live in APIM. Private Link origins to Container Apps, and Spring WebFlux or virtual threads in the app so long-lived streams don’t exhaust threads.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'CLI: Front Door route, origin group and WAF', lang: 'bash', code: `az afd origin-group create -g rg-edge --profile-name afd-shop -n og-api \\
  --probe-request-type GET --probe-protocol Https --probe-path /actuator/health/readiness \\
  --probe-interval-in-seconds 30 --sample-size 4 --successful-samples-required 3 \\
  --additional-latency-in-milliseconds 50

az afd origin create -g rg-edge --profile-name afd-shop --origin-group-name og-api -n weu \\
  --host-name app-shop-weu.azurewebsites.net --origin-host-header app-shop-weu.azurewebsites.net \\
  --priority 1 --weight 1000 --enabled-state Enabled
az afd origin create -g rg-edge --profile-name afd-shop --origin-group-name og-api -n eus \\
  --host-name app-shop-eus.azurewebsites.net --origin-host-header app-shop-eus.azurewebsites.net \\
  --priority 1 --weight 1000 --enabled-state Enabled

az afd route create -g rg-edge --profile-name afd-shop --endpoint-name shop -n api \\
  --origin-group og-api --patterns-to-match "/api/*" --supported-protocols Http Https \\
  --https-redirect Enabled --forwarding-protocol HttpsOnly --link-to-default-domain Enabled

az network front-door waf-policy create -g rg-edge -n wafshop --sku Premium_AzureFrontDoor --mode Detection` },
    { title: 'Bicep: Application Gateway path-based rule (excerpt)', lang: 'bicep', code: `// inside Microsoft.Network/applicationGateways properties
urlPathMaps: [{
  name: 'shop-paths'
  properties: {
    defaultBackendAddressPool: { id: resourceId('Microsoft.Network/applicationGateways/backendAddressPools', agwName, 'pool-web') }
    defaultBackendHttpSettings: { id: resourceId('Microsoft.Network/applicationGateways/backendHttpSettingsCollection', agwName, 'https-web') }
    pathRules: [{
      name: 'api'
      properties: {
        paths: ['/api/*']
        backendAddressPool: { id: resourceId('Microsoft.Network/applicationGateways/backendAddressPools', agwName, 'pool-api') }
        backendHttpSettings: { id: resourceId('Microsoft.Network/applicationGateways/backendHttpSettingsCollection', agwName, 'https-api') }
      }
    }]
  }
}]
probes: [{
  name: 'api-ready'
  properties: { protocol: 'Https', path: '/actuator/health/readiness', interval: 15, timeout: 5, unhealthyThreshold: 3, pickHostNameFromBackendHttpSettings: true }
}]` },
    { title: 'Spring Boot behind a proxy', lang: 'yaml', code: `server:
  forward-headers-strategy: framework     # X-Forwarded-Host/Proto/For → correct URLs and client IP
  shutdown: graceful                      # finish in-flight requests while the probe drains you
management:
  endpoint:
    health:
      probes:
        enabled: true                     # /actuator/health/liveness and /readiness
  endpoints:
    web:
      exposure:
        include: health
spring:
  lifecycle:
    timeout-per-shutdown-phase: 20s`, note: 'Probe <code>/actuator/health/readiness</code> from Front Door or Application Gateway. Keep liveness for the platform’s restart decisions.' }
  ]
});

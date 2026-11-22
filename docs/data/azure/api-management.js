IA.register({
  track: 'azure',
  slug: 'api-management',
  title: 'API Management',
  tagline: 'Azure API Management (APIM) is a <b>gateway with a policy pipeline</b>. Every call passes through <b>inbound</b> policies (auth, rate limits, rewrites), the <b>backend</b>, <b>outbound</b> policies (headers, caching, transforms) and, if anything fails, <b>on-error</b>. Products and subscriptions decide who may call what; versions and revisions decide how APIs change without breaking them.',
  lang: 'bash',
  tldr: {
    problem: 'Without a gateway, every Spring service re-implements JWT validation, throttling, CORS and API keys slightly differently. With a badly configured gateway, a policy at the wrong scope blocks everything, rate limits count the wrong thing, and a breaking change ships to every consumer at once.',
    model: 'Policies are XML with four sections that run in order: <code>&lt;inbound&gt;</code> → <code>&lt;backend&gt;</code> → <code>&lt;outbound&gt;</code>, plus <code>&lt;on-error&gt;</code>. They are defined at <b>global, product, API and operation</b> scope, and <code>&lt;base /&gt;</code> says where the parent scope’s policies run. A <b>product</b> bundles APIs; a <b>subscription</b> to it gives a caller a key. A <b>version</b> is a new contract; a <b>revision</b> is a safe change to the same one.',
    hook: '“Why do my clients get 429 although each one sends 10 requests a minute?” Because the policy is <code>rate-limit-by-key</code> keyed on something shared, such as the client IP behind a NAT, so everyone counts against one bucket.',
    facts: [
      { v: '4', l: 'policy sections: inbound, backend, outbound, on-error. A failure in any section jumps straight to on-error' },
      { v: '4 scopes', l: 'global → product → API → operation; <code>&lt;base /&gt;</code> places the parent scope’s policies inside the child' },
      { v: ';rev=N', l: 'URL suffix that calls a non-current revision of an API, so you can test a change before making it current' }
    ]
  },
  intro: {
    what: 'An <b>API gateway</b> sits in front of your backend services and gives callers one front door. <b>Azure API Management</b> adds a gateway (the runtime that proxies calls), a management plane (where you define APIs and policies) and a developer portal (where consumers discover APIs and get keys). You describe each API, often by importing its OpenAPI document from Spring’s springdoc, and attach <b>policies</b>: small XML rules that run on every request and response.',
    analogy: { icon: '🛂', title: 'Airport security with lanes', text: 'Passengers (requests) go through check-in (inbound: show your ticket and passport, which are the subscription key and JWT), a limit on how many times you can go through per hour (rate limit), then the flight (backend), then arrivals (outbound: customs strips things you shouldn’t carry out). If anything goes wrong at any point, you are taken to the help desk (on-error). Ticket types (products) decide which gates you can use.' },
    steps: [
      { t: 'Create the instance and import an API', d: 'Import the OpenAPI spec your Spring app already publishes.', code: 'az apim api import -g rg-api-prod --service-name apim-shop \\\n  --api-id orders --path orders --display-name "Orders" \\\n  --specification-format OpenApi \\\n  --specification-url https://orders.internal.example/v3/api-docs' },
      { t: 'Group APIs into a product and require a subscription', d: 'Callers subscribe to a product and send <code>Ocp-Apim-Subscription-Key</code>.' },
      { t: 'Add policies', d: 'Validate the caller’s token, limit their rate, call the backend with the gateway’s managed identity.', lang: 'yaml', code: '<inbound>\n  <base />\n  <validate-jwt header-name="Authorization" ... />\n  <rate-limit-by-key calls="100" renewal-period="60"\n      counter-key="@(context.Subscription.Id)" />\n</inbound>' },
      { t: 'Change APIs safely', d: 'Use a <b>revision</b> for non-breaking changes and a <b>version</b> (<code>/v2</code>) for breaking ones.' }
    ],
    terms: [
      ['policy', 'An XML statement such as <code>rate-limit</code>, <code>validate-jwt</code> or <code>set-header</code>, run by the gateway at a given stage and scope.'],
      ['product', 'A bundle of one or more APIs with its own terms, visibility and policies (for example quotas). Can require a subscription or be open.'],
      ['subscription', 'A pair of keys that identifies a caller, scoped to a product, an API or all APIs.'],
      ['named value', 'A gateway-wide variable (optionally a Key Vault secret reference) used in policies as <code>{{name}}</code>.'],
      ['revision', 'A non-breaking change to an API, testable at <code>;rev=N</code> and then made current.'],
      ['version', 'A separate, breaking variant of an API in a version set, selected by path, header or query string.']
    ]
  },
  visual: {
    title: 'Walk a request through the policy pipeline',
    caption: 'Pick a case and press Play. The request passes the inbound stages, the backend and outbound. Watch a normal call, a 429 from <code>rate-limit-by-key</code>, a 401 from <code>validate-jwt</code>, a backend failure handled in <code>on-error</code>, a cache hit that never reaches the backend, and version vs revision routing.'
  },
  gotchas: [
    { trap: 'Forgetting <code>&lt;base /&gt;</code>, or putting it in the wrong place', code: `<!-- API-level policy -->
<inbound>
  <set-backend-service base-url="https://orders-v2.internal" />
  <!-- no <base /> → the product's rate limit and the global CORS/JWT policies never run -->
</inbound>`, lang: 'yaml', why: 'Policies at a narrower scope <b>replace</b> the parent scope’s section unless they include <code>&lt;base /&gt;</code>. Removing it silently drops global authentication or product quotas for that API.', fix: 'Keep <code>&lt;base /&gt;</code> in every section unless you deliberately mean to override. Put it first in inbound (parent checks run before yours) and review effective policy in the portal’s “Calculate effective policy” view.' },
    { trap: 'Rate limiting on a shared key', why: '<code>rate-limit-by-key</code> counts per the <code>counter-key</code> expression. Keying on <code>context.Request.IpAddress</code> lumps every user behind a corporate NAT or a mobile carrier together; keying on nothing meaningful throttles everyone at once.', fix: 'Key on the caller’s identity: <code>context.Subscription.Id</code>, or a JWT claim such as the client ID or tenant. Remember that limits aren’t exact across gateway instances, so treat them as protection, not billing.' },
    { trap: 'Subscription keys as the only authentication', why: 'A subscription key identifies a caller for metering. It is a static shared secret, often embedded in apps, and is no proof of a user’s or service’s identity.', fix: 'Combine keys (for products and analytics) with <code>validate-jwt</code> or <code>validate-azure-ad-token</code> for authentication. For internal service-to-service calls, use Entra tokens and consider making products open.' },
    { trap: 'Backends reachable around the gateway', why: 'If the Spring backend still has a public endpoint, callers can bypass APIM and all its policies.', fix: 'Lock the backend down: private networking (APIM in a VNet, or private endpoints to the backend), App Service access restrictions to APIM’s address or service tag, and validation of a token APIM obtains with <code>authentication-managed-identity</code>.' },
    { trap: 'Shipping breaking changes as a revision', why: 'Making a revision current changes the live API for <b>every</b> consumer immediately. Revisions are meant for non-breaking changes.', fix: 'For breaking changes, create a new <b>version</b> in the version set (<code>/v2</code>), run both side by side, and communicate a retirement date for v1. Use revisions plus the change log for fixes and additions.' },
    { trap: 'Policy expressions that throw', why: 'Policy expressions are C# snippets. <code>context.Request.Headers["X-Tenant"][0]</code> throws when the header is missing, which sends the request to on-error and returns a 500 that looks like a backend failure.', fix: 'Use safe accessors such as <code>GetValueOrDefault("X-Tenant", "")</code>, validate inputs with <code>check-header</code> or <code>validate-content</code>, and return clear 4xx responses from <code>return-response</code>.' }
  ],
  scenarios: [
    { title: 'Every mobile user in one country gets 429',
      symptom: 'After a policy change, users on one mobile network get <code>429 Too Many Requests</code> constantly. Other users are fine.',
      diagnose: `# APIM → APIs → Orders → All operations → inbound
<rate-limit-by-key calls="60" renewal-period="60" counter-key="@(context.Request.IpAddress)" />
# carrier-grade NAT: thousands of phones share a few public IPs`,
      cause: 'The limit was keyed on the client IP. Carrier NAT put a whole network’s traffic into one counter.',
      fix: 'Key on a stable caller identity from the validated token (or the subscription), and keep a much higher IP-based limit only as flood protection.',
      fixCode: `<validate-jwt header-name="Authorization" output-token-variable-name="jwt" failed-validation-httpcode="401">
  <openid-config url="https://login.microsoftonline.com/{{tenant-id}}/v2.0/.well-known/openid-configuration" />
  <audiences><audience>api://orders</audience></audiences>
</validate-jwt>
<rate-limit-by-key calls="60" renewal-period="60"
    counter-key="@(((Jwt)context.Variables["jwt"]).Claims.GetValueOrDefault("oid", "anon"))" />
<rate-limit-by-key calls="2000" renewal-period="60" counter-key="@(context.Request.IpAddress)" />`, lang: 'yaml' },
    { title: 'An API suddenly unauthenticated',
      symptom: 'A penetration test finds that <code>/orders/admin</code> accepts calls without a token. Other APIs on the same instance reject them.',
      diagnose: `# Portal → API → Calculate effective policy
# the API-level inbound section has no <base />, so the global validate-jwt never runs`,
      cause: 'A developer added an API-level <code>set-backend-service</code> and removed <code>&lt;base /&gt;</code> while editing, overriding the global inbound section.',
      fix: 'Restore <code>&lt;base /&gt;</code>, manage policies as code (APIOps or Bicep) with review, and add a CI check that every policy file’s sections contain <code>&lt;base /&gt;</code>.' },
    { title: 'Azure OpenAI quota exhausted by one agent',
      symptom: 'One misbehaving AI agent loops on a tool call and consumes the whole tokens-per-minute quota. Every other app gets 429 from Azure OpenAI.',
      diagnose: `# Azure OpenAI metrics: token usage spikes; APIM logs show one subscription making most calls`,
      cause: 'All apps called Azure OpenAI through one shared deployment with no per-caller limit.',
      fix: 'Put Azure OpenAI behind APIM as an AI gateway: authenticate to the backend with the gateway’s managed identity, and apply a per-subscription token limit and token metrics.',
      fixCode: `<inbound>
  <base />
  <authentication-managed-identity resource="https://cognitiveservices.azure.com" />
  <azure-openai-token-limit counter-key="@(context.Subscription.Id)"
      tokens-per-minute="20000" estimate-prompt-tokens="true" />
  <azure-openai-emit-token-metric>
    <dimension name="Subscription ID" />
  </azure-openai-emit-token-metric>
</inbound>`, lang: 'yaml' }
  ],
  puzzles: [
    { kind: 'scenario', q: 'An inbound <code>validate-jwt</code> fails. Which section runs next?', options: ['backend', 'outbound', 'on-error (validate-jwt returns its configured status, e.g. 401)', 'The next inbound policy'], answer: 2, explain: 'When a policy raises an error, processing jumps to <code>&lt;on-error&gt;</code>. <code>validate-jwt</code> sets the failed-validation status (401 by default), which on-error can shape further.' },
    { kind: 'scenario', q: 'You want each caller limited to 100 calls/minute regardless of which product they use. What is the best counter key?', options: ['context.Request.IpAddress', 'context.Subscription.Id or a client-ID claim from the validated JWT', 'context.Api.Id', 'A constant string'], answer: 1, explain: 'Key on the caller’s identity. IPs are shared behind NAT, the API ID throttles everyone together, and a constant is one global bucket.' },
    { kind: 'scenario', q: 'You add a required field to a response and rename an existing one. How do you release it?', options: ['As a new revision, made current', 'As a new version (e.g. /v2) in the version set, keeping v1 live', 'Edit the current revision directly', 'Change the product'], answer: 1, explain: 'Renaming a field is breaking, so it needs a new <b>version</b>. Revisions are for non-breaking changes, and making one current affects every caller at once.' },
    { kind: 'predict', q: 'Global inbound has CORS. Product inbound has <code>&lt;base /&gt;&lt;quota … /&gt;</code>. API inbound has only <code>&lt;rate-limit … /&gt;</code> (no base). Which inbound policies run for that API?', options: ['CORS, quota, rate-limit', 'rate-limit only', 'quota and rate-limit', 'CORS and rate-limit'], answer: 1, explain: 'Without <code>&lt;base /&gt;</code> the API scope replaces everything above it, so only <b>rate-limit</b> runs. With <code>&lt;base /&gt;</code> first, the order would be CORS → quota → rate-limit.' },
    { kind: 'scenario', q: 'APIM must call a Container App backend that accepts only Entra tokens. What do you configure?', options: ['Put a client secret in a named value and call the token endpoint in a policy', 'Enable APIM’s managed identity and use <code>authentication-managed-identity</code> with the backend’s app ID URI as resource', 'Forward the caller’s subscription key', 'Disable auth on the backend'], answer: 1, explain: 'APIM’s managed identity gets a token for the backend audience and adds it as a bearer token. No secret to store or rotate.' },
    { kind: 'scenario', q: '<code>cache-lookup</code> in inbound finds a fresh entry. What happens?', options: ['The backend is still called to validate', 'The gateway returns the cached response without calling the backend', 'The cache is ignored for GET', 'on-error runs'], answer: 1, explain: 'On a hit, cache-lookup short-circuits the request and returns the stored response; the backend never sees it. Pair it with <code>cache-store</code> in outbound, and vary by headers or query parameters that change the response.' },
    { kind: 'scenario', q: 'A partner should see only the Orders and Catalog APIs, with a monthly quota. What is the APIM construct?', options: ['A named value', 'A product containing both APIs, with a quota policy, that the partner subscribes to', 'An API version', 'A revision'], answer: 1, explain: 'Products bundle APIs with policies such as <code>quota</code>, and visibility (groups). A subscription to the product gives the partner keys.' }
  ],
  interview: [
    { q: 'Explain APIM’s policy pipeline and scopes.', a: '<p>Each request runs <b>inbound</b> (before forwarding), <b>backend</b> (forwarding, retries, backend selection), <b>outbound</b> (response shaping) and, on any error, <b>on-error</b>. Policies exist at global, workspace, product, API and operation scope. The effective policy is built by nesting, with <code>&lt;base /&gt;</code> marking where the parent’s policies are inserted. Without it, the child scope replaces the parent’s section.</p>', lvl: 'core' },
    { q: 'Products, subscriptions and keys: how do they relate?', a: '<p>A <b>product</b> groups APIs and carries its own policies (quotas, rate limits) and visibility. A <b>subscription</b> grants access to a product (or to one API, or to all) and has two rotatable keys, sent in <code>Ocp-Apim-Subscription-Key</code> or as a query parameter. Keys identify and meter callers; they aren’t strong authentication on their own.</p>', lvl: 'core' },
    { q: 'rate-limit vs quota, and by-key variants?', a: '<p><code>rate-limit</code>: short windows (calls per seconds or minutes) to protect backends, returning 429 with <code>Retry-After</code>. <code>quota</code>: long periods (calls or bandwidth per day or month) for business limits, returning 403. Both count per subscription. The <code>-by-key</code> variants count per any expression you choose (a claim, IP, header). Counting is approximate across a distributed gateway.</p>', lvl: 'core' },
    { q: 'How do versions and revisions differ?', a: '<p>A <b>version</b> is a separate API in a <b>version set</b>, selected by path segment (<code>/v2</code>), header or query string. It is used for breaking changes, and both run side by side. A <b>revision</b> is a change to the same version, which you can test at <code>;rev=3</code>, then make current with a change-log entry. Use revisions for safe changes and rollbacks.</p>', lvl: 'core' },
    { q: 'Which APIM tier would you choose for a production, VNet-isolated, multi-region API?', a: '<p>Classic <b>Premium</b> is the long-standing answer: VNet injection (internal mode), availability zones, multi-region gateway deployment and self-hosted gateways. The <b>v2</b> tiers (Basic v2, Standard v2, Premium v2) are newer and change what is available per tier, for example VNet integration options. The <b>Developer</b> tier has no SLA and is for non-production. Check the current Learn feature matrix, because it is changing.</p>', lvl: 'deep' },
    { q: 'How would you secure the path from APIM to a Spring Boot backend?', a: '<ul><li>Validate the caller at APIM (<code>validate-jwt</code> or <code>validate-azure-ad-token</code>).</li><li>Call the backend with <code>authentication-managed-identity</code>, and have Spring Security validate that token’s audience and the APIM identity.</li><li>Make the backend unreachable except through APIM: VNet, private endpoints, access restrictions.</li><li>Keep secrets as Key Vault-backed named values.</li></ul>', lvl: 'deep' },
    { q: 'Where does APIM fit next to Front Door and Application Gateway?', a: '<p>Front Door is the global edge (anycast, WAF, caching, routing to regions). Application Gateway is a regional L7 load balancer with WAF, often in front of an internal-mode APIM. APIM handles <b>API concerns</b>: keys, products, per-caller limits, transforms, versioning and the developer portal. A common layout is Front Door → (App Gateway) → internal APIM → private backends. See <a href="front-door-gateway.html">Front Door &amp; Application Gateway</a>.</p>', lvl: 'core' },
    { q: 'What does APIM offer as an “AI gateway”?', a: '<p>Policies for LLM backends: token-based limits (<code>azure-openai-token-limit</code>, and a generic <code>llm-token-limit</code>), token metrics for chargeback, semantic caching, managed-identity auth to Azure OpenAI, and load balancing or circuit breaking across several deployments using backend pools. It lets you give each agent or team its own subscription and token budget without sharing keys.</p>', lvl: 'deep' },
    { q: 'How do you manage APIM configuration as code?', a: '<p>Bicep or Terraform for the instance, products, named values and APIs, with policies as XML files loaded with <code>loadTextContent</code>. Or APIOps (extract and publish pipelines). Import APIs from the service’s OpenAPI output in CI, so the gateway contract and the code stay in sync.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'A typical API-level policy', lang: 'yaml', code: `<policies>
  <inbound>
    <base />                                           <!-- global + product policies first -->
    <validate-jwt header-name="Authorization" failed-validation-httpcode="401" output-token-variable-name="jwt">
      <openid-config url="https://login.microsoftonline.com/{{tenant-id}}/v2.0/.well-known/openid-configuration" />
      <audiences><audience>api://orders</audience></audiences>
      <required-claims><claim name="roles" match="any"><value>Orders.Read</value></claim></required-claims>
    </validate-jwt>
    <rate-limit-by-key calls="100" renewal-period="60" counter-key="@(context.Subscription.Id)" />
    <cache-lookup vary-by-developer="false" vary-by-developer-groups="false">
      <vary-by-query-parameter>page</vary-by-query-parameter>
    </cache-lookup>
    <authentication-managed-identity resource="api://orders-backend" />
    <set-backend-service backend-id="orders-backend" />
  </inbound>
  <backend>
    <retry condition="@(context.Response.StatusCode >= 502)" count="2" interval="1" first-fast-retry="true">
      <forward-request timeout="20" />
    </retry>
  </backend>
  <outbound>
    <base />
    <set-header name="X-Powered-By" exists-action="delete" />
    <cache-store duration="30" />
  </outbound>
  <on-error>
    <base />
    <return-response>
      <set-status code="@(context.Response?.StatusCode ?? 500)" />
      <set-body>@(new JObject(new JProperty("error", context.LastError.Message), new JProperty("requestId", context.RequestId)).ToString())</set-body>
    </return-response>
  </on-error>
</policies>`, note: 'XML is shown with YAML highlighting. Keep secrets such as tenant IDs or backend keys in named values (<code>{{tenant-id}}</code>), optionally backed by Key Vault.' },
    { title: 'Bicep: API, version set and policy from a file', lang: 'bicep', code: `resource apim 'Microsoft.ApiManagement/service@2023-05-01-preview' existing = { name: 'apim-shop' }

resource vs 'Microsoft.ApiManagement/service/apiVersionSets@2023-05-01-preview' = {
  parent: apim
  name: 'orders'
  properties: { displayName: 'Orders', versioningScheme: 'Segment' }     // /orders/v1, /orders/v2
}

resource ordersV2 'Microsoft.ApiManagement/service/apis@2023-05-01-preview' = {
  parent: apim
  name: 'orders-v2'
  properties: {
    path: 'orders'
    apiVersion: 'v2'
    apiVersionSetId: vs.id
    displayName: 'Orders'
    protocols: ['https']
    subscriptionRequired: true
    format: 'openapi+json-link'
    value: 'https://orders.internal.example/v3/api-docs'
  }
}

resource policy 'Microsoft.ApiManagement/service/apis/policies@2023-05-01-preview' = {
  parent: ordersV2
  name: 'policy'
  properties: { format: 'rawxml', value: loadTextContent('policies/orders-v2.xml') }
}` },
    { title: 'CLI: product, subscription, revision', lang: 'bash', code: `az apim product create -g rg-api-prod --service-name apim-shop \\
  --product-id partners --product-name "Partners" --subscription-required true \\
  --approval-required true --state published
az apim product api add -g rg-api-prod --service-name apim-shop --product-id partners --api-id orders-v2

# a non-breaking change as a revision; test at https://apim-shop.azure-api.net/orders/v2;rev=3/...
az apim api revision create -g rg-api-prod --service-name apim-shop \\
  --api-id orders-v2 --api-revision 3 --api-revision-description "Add optional field 'eta'"

# call it
curl -H "Ocp-Apim-Subscription-Key: $KEY" -H "Authorization: Bearer $TOKEN" \\
  https://apim-shop.azure-api.net/orders/v2/orders/42` }
  ]
});

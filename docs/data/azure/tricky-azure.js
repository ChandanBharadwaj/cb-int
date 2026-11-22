IA.register({
  track: 'azure',
  slug: 'tricky-azure',
  title: '★ Tricky Azure (timed)',
  tagline: 'Fifty scenario, decision and code-reading questions from every Azure topic, against the clock. Each one is a trap that shows up in real designs and incidents: the identity that isn’t the one you think, the DNS that still points to a public IP, the limit enforced per second instead of per minute, the “stopped” VM that still bills.',
  tldr: {
    problem: 'Senior Azure interviews rarely ask you to list services. They describe a situation (“403 after we enabled private endpoints”, “429s under our quota”, “DR failed in the drill”) and ask what is going on and what you would change.',
    model: 'Most Azure tricks come down to six questions: <b>which plane</b> (control vs data), <b>which identity</b> (and which role at which scope), <b>which network path</b> (public vs private, and what DNS returns), <b>which failure domain</b> (instance, zone, region), <b>which limit</b> (and over what window), and <b>who owns the state</b> (IaC, Policy, the portal, a replica).',
    hook: 'A vault uses RBAC and you are Contributor on it. Can you read its secrets? If you can say “no, Contributor has no data actions” without thinking, start the drill.',
    facts: [
      { v: '50', l: 'questions, two from each of the 25 Azure topics, from tenants and zones to Azure OpenAI and Spring on Azure' },
      { v: '60 s', l: 'per question by default, with Slow (90 s) and Fast (30 s) modes. Options are shuffled on every run' },
      { v: '6', l: 'modules to filter by: Foundations, Compute, Data, Integration, Networking & security, Operations & architecture' }
    ]
  },
  intro: {
    what: 'This page is a <b>drill</b>, not a lesson. You get a short scenario (sometimes with Bicep, YAML, KQL or a policy snippet), a timer and four answers. Decide as you would in an interview, then read the explanation. At the end you see your score per topic, weakest first, and every miss with a link back to its topic page.',
    analogy: { icon: '⏱️', title: 'Flight-simulator emergencies', text: 'Pilots don’t learn engine failures by reading the manual once; they practise short, timed scenarios until the right first move is automatic. Each question here is a short emergency where the obvious move is wrong for a specific Azure reason.' },
    steps: [
      { t: 'Find the plane', d: 'Is this about managing the resource (ARM, RBAC roles like Contributor) or using its data (secrets, blobs, messages, tokens)? Different roles, different errors.' },
      { t: 'Find the identity', d: 'Which principal is actually calling: the user, a system-assigned or a user-assigned identity, a pipeline’s federated identity? What role does it have, at which scope?' },
      { t: 'Find the path', d: 'What does DNS return from where the caller runs? Public IP, private endpoint, through Front Door or around it?' },
      { t: 'Find the failure domain and the limit', d: 'An instance, a zone or a region? A per-minute quota enforced over seconds? Connections per replica times replicas?' }
    ],
    terms: [
      ['control plane', 'Azure Resource Manager operations: create, configure and delete resources. Governed by RBAC actions and Azure Policy.'],
      ['data plane', 'Operations on the service’s data: read a secret, upload a blob, send a message, call a model. Governed by data actions and service auth.'],
      ['failure domain', 'The unit that fails together: an instance, a zone, a region.'],
      ['blast radius', 'How much breaks when one thing fails or one credential leaks.'],
      ['source of truth', 'The thing whose version wins: IaC, a policy, the portal, the primary replica.']
    ]
  },
  visual: {
    title: 'The drill',
    caption: 'Pick a module (or All), how many questions and the time per question, then press Start. Skip counts as a miss. At the end: a per-topic breakdown, weakest first, and a review of your misses with links to each topic page.'
  },
  gotchas: [
    { trap: 'Reading a 403 as “missing role” every time', why: 'A 403 from Key Vault, Storage or Azure OpenAI can mean the <b>network</b> path was refused (public access disabled, firewall, the name resolving to a public IP) or the <b>identity</b> lacks a data-plane role. The fixes are completely different.', fix: 'Read the error body: network denials mention the client address or public network access; authorization denials name the principal and the missing action. Check DNS from the caller (<code>nslookup</code>) before touching RBAC.' },
    { trap: 'Answering with the service, not the requirement', why: 'Interviewers often accept several services. What they score is whether you tied the choice to a requirement: ordering, replay, latency, data residency, RTO, cost at idle.', fix: 'Say the deciding requirement first (“per-customer ordering and a DLQ, so Service Bus sessions”), then the service, then one trade-off.' },
    { trap: 'Confusing high availability with disaster recovery', why: 'Zone redundancy, HA standbys and ZRS keep a region running through a datacenter failure. They don’t protect against a regional outage, a bad deployment or logical corruption.', fix: 'Separate the layers in your answer: zones for HA, backups and PITR for corruption, a second region with a stated RTO/RPO for regional loss.' },
    { trap: 'Forgetting the multiplier', why: 'Many Azure limits are hit by multiplication: replicas × pool size, layers × retries, requests × <code>max_tokens</code>, instances × SNAT ports.', fix: 'When a question mentions scaling or retries, multiply first, then compare with the limit (connections, TPM, ports).' }
  ],
  scenarios: [
    { title: 'Everything returns 403 after the “private networking” change',
      symptom: 'A platform change disabled public network access on Key Vault, Storage and Azure OpenAI and added private endpoints. The Spring app on Container Apps now fails at startup with 403 from Key Vault, and blob uploads fail too.',
      diagnose: `# from inside the app's environment (console or a debug container)
nslookup kv-orders-prod.vault.azure.net        # public IP? → DNS, not RBAC
nslookup storders.blob.core.windows.net
# error bodies
#   Key Vault: "Public network access is disabled and request is not from a trusted service nor via an approved private link"
#   (an RBAC failure would instead say the caller lacks Microsoft.KeyVault/vaults/secrets/getSecret/action)`,
      cause: 'Private endpoints were created, but the <code>privatelink.*</code> private DNS zones were linked only to the hub VNet, not to the Container Apps environment’s VNet (and no DNS forwarding was configured). The app still resolved public IPs, which were now blocked.',
      fix: 'Link the private DNS zones to every VNet that resolves these names (or use central DNS forwarding to Azure DNS), verify with <code>nslookup</code> from the app’s subnet, and add this check to the network change runbook. RBAC was never the problem.',
      fixCode: `for z in privatelink.vaultcore.azure.net privatelink.blob.core.windows.net privatelink.openai.azure.com; do
  az network private-dns link vnet create -g rg-dns -z $z -n link-cae-prod \\
    --virtual-network $CAE_VNET_ID --registration-enabled false
done` },
    { title: 'Black Friday: autoscale made it worse',
      symptom: 'Traffic tripled. Container Apps scaled the API to its maximum, and error rates rose instead of falling: Postgres refused connections, Azure OpenAI returned 429s for the product-summary feature, and latency climbed across the board.',
      diagnose: `AppDependencies
| where TimeGenerated > ago(2h) and AppRoleName == "orders-api"
| summarize calls = sum(ItemCount), failed = sumif(ItemCount, Success == false) by bin(TimeGenerated, 5m), Type, ResultCode
| order by TimeGenerated asc`,
      diagnoseLang: 'kql',
      cause: 'Three multipliers at once: 30 replicas × a Hikari pool of 20 went past <code>max_connections</code>; every replica called Azure OpenAI with <code>max_tokens: 4000</code>, so admission reserved far more tokens than were used; and three layers of immediate retries amplified both.',
      fix: 'Cap replicas to the database’s connection budget and shrink pools (add PgBouncer), cache product summaries and size <code>max_tokens</code> to the feature, retry in one layer with backoff and jitter behind a circuit breaker, and degrade the AI summary first when it is throttled. Load-test the multipliers, not just the request rate.',
      fixCode: `spring.datasource.hikari.maximum-pool-size=5
spring.ai.azure.openai.chat.options.max-tokens=300
resilience4j.retry.instances.summaries.max-attempts=2
resilience4j.circuitbreaker.instances.summaries.failure-rate-threshold=50`,
      fixLang: 'text' }
  ],
  puzzles: [
    { kind: 'scenario', q: 'Key Vault returns 403 with “Public network access is disabled and request is not from a trusted service nor via an approved private link”. What do you check first?', options: ['What the vault’s name resolves to from the caller (private endpoint DNS)', 'Whether the identity has Key Vault Secrets User', 'The secret’s expiry date', 'Whether soft delete is enabled'], answer: 0, explain: 'The message is about the <b>network path</b>: the request reached the public endpoint. Check DNS resolution from the caller and the private DNS zone links. An authorization problem would name the principal and the missing data action.' },
    { kind: 'scenario', q: 'Which of these is a <b>data-plane</b> permission?', options: ['Microsoft.Web/sites/write', 'Microsoft.Authorization/roleAssignments/write', 'Microsoft.KeyVault/vaults/secrets/getSecret/action (a data action)', 'Microsoft.Resources/deployments/write'], answer: 2, explain: 'Data actions act on the service’s data (secret values, blob contents, messages). The others are control-plane actions on ARM resources. Roles like Contributor have broad actions but no data actions.' },
    { kind: 'calc', q: 'An API scales to 20 replicas, each with a Hikari pool of 10 and a payment client that retries 3 times. The payment provider is down for a minute. Two numbers matter: peak DB connections, and attempts per payment request. Which pair?', options: ['20 and 3', '200 and 12', '30 and 4', '200 and 4'], answer: 3, explain: 'Connections: 20 × 10 = <b>200</b>. Attempts: 1 call + 3 retries = <b>4</b> per request (more if another layer also retries). Both multiply under load, exactly when things are failing.' },
    { kind: 'scenario', q: 'Your design must survive (1) a datacenter fire, (2) a bad migration that corrupts a table, (3) a regional outage. Which set covers all three?', options: ['Zone-redundant Postgres HA only', 'Zone-redundant HA + point-in-time restore + a cross-region replica (or geo-backups) with a tested runbook', 'Two read replicas in the same region', 'Geo-redundant storage for the JAR files'], answer: 1, explain: 'Zones handle (1); PITR handles (2), because corruption replicates everywhere instantly; a second region with a known RTO/RPO handles (3). Each layer answers a different failure.' },
    { kind: 'scenario', q: 'A Bicep deploy, a Terraform apply and a portal hotfix all touched the same App Service last week. Which statement is the best first fix?', options: ['Add more what-if steps', 'Switch everything to Complete mode', 'Choose one owner (one IaC tool) per resource, make humans read-only in production, and route hotfixes through code', 'Delete the deployment history'], answer: 2, explain: 'Drift and flip-flopping settings come from <b>multiple sources of truth</b>. Previews only show the fight; ownership and access control end it.' }
  ],
  interview: [
    { q: 'How do you approach an Azure troubleshooting question in an interview?', a: '<p>Out loud, in order: <b>symptom</b> (what exactly fails, since when, for whom), <b>path</b> (DNS and network from the caller), <b>identity</b> (which principal, which role, which scope, which plane), <b>limits</b> (quotas, connections, ports, tokens, multiplied by scale), <b>recent changes</b> (deploys, policy, network). Then name the signal you would read (an error body, a KQL query, a metric) before guessing a fix.</p>', lvl: 'core' },
    { q: 'Explain control plane vs data plane with an example.', a: '<p>Creating a Key Vault, changing its network rules or assigning roles goes through <b>Azure Resource Manager</b> (control plane), authorised by RBAC <i>actions</i>. Reading a secret goes to the vault’s own endpoint (data plane), authorised by <i>data actions</i> such as Key Vault Secrets User. That is why a Contributor can delete a vault but not read its secrets under the RBAC model.</p>', lvl: 'core' },
    { q: 'What are the most common reasons a “working” Azure design fails in production?', a: '<ul><li>DNS for private endpoints not linked where the caller resolves.</li><li>The wrong identity (system- vs user-assigned) or a role at the wrong scope.</li><li>Multipliers: replicas × pools, layers × retries, <code>max_tokens</code> × concurrency.</li><li>Health checks that include dependencies, cascading restarts.</li><li>DR that depends on the primary region, never drilled.</li><li>Drift from portal changes.</li></ul>', lvl: 'deep' },
    { q: 'How do you choose between similar services quickly?', a: '<p>Ask for the deciding requirement: ordering and settlement (Service Bus) vs replayable streams (Event Hubs) vs reactive notifications (Event Grid); global edge L7 (Front Door) vs regional L7 (Application Gateway) vs L4 (Load Balancer); containers without a cluster (Container Apps) vs Kubernetes itself (AKS) vs JAR hosting with slots (App Service). Then state one trade-off you accept.</p>', lvl: 'core' },
    { q: 'What do you say when you don’t remember an exact limit or SKU detail?', a: '<p>Say what you know about its <i>shape</i> and how you would check: “TPM is per deployment and enforced over short windows; I’d confirm the current numbers on Microsoft Learn and read the <code>x-ratelimit</code> headers in a test.” Azure limits change often; showing that you design around limits and verify them is the senior answer.</p>', lvl: 'core' },
    { q: 'What makes a good identity design on Azure?', a: '<p>Managed identities for every workload, user-assigned where the identity must outlive or be shared across resources; federated credentials for pipelines and Kubernetes; data-plane roles at the narrowest scope; no keys or connection-string secrets where Entra auth exists (<code>disableLocalAuth</code>, <code>allowSharedKeyAccess: false</code>); Key Vault only for third-party secrets; and humans read-only in production.</p>', lvl: 'deep' },
    { q: 'How do you reason about blast radius?', a: '<p>For each credential and component, ask what one failure or leak can reach: a pipeline identity scoped to one resource group, one identity per app, one state file per environment, separate deployments per consumer for AI quota, bulkheads per dependency, cells or stamps for very large systems. Smaller blast radius is usually worth a little more configuration.</p>', lvl: 'deep' },
    { q: 'How would you prepare for an Azure architect interview in a week?', a: '<p>Pick one reference workload (Spring Boot + Postgres + messaging + AI) and be able to draw it with identity, networking, observability, cost and DR decisions explained. Drill trade-off questions like these, timed. For each miss, read the topic page and write the one-sentence rule you missed.</p>', lvl: 'core' }
  ]
});

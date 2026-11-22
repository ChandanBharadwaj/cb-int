/* Tricky Azure: a timed drill of scenario, decision and code-reading questions across every Azure topic, scored, with a per-topic breakdown and a review of misses linking back to topic pages. */
IA.widget('tricky-azure', (root, ctx) => {
  const { el, reduced } = ctx;
  const TOPIC = {
    'azure-hierarchy': ['Tenants to resources', 'Foundations'], 'regions-zones': ['Regions & zones', 'Foundations'],
    'entra-managed-identity': ['Entra & managed identity', 'Foundations'], 'rbac-policy': ['RBAC & Policy', 'Foundations'],
    'compute-choice': ['Choosing compute', 'Compute'], 'app-service': ['App Service', 'Compute'], 'container-apps': ['Container Apps', 'Compute'],
    aks: ['AKS', 'Compute'], functions: ['Functions', 'Compute'],
    'storage-accounts': ['Storage', 'Data'], 'azure-sql-postgres': ['SQL & Postgres', 'Data'], 'cosmos-db': ['Cosmos DB', 'Data'], 'redis-cache': ['Redis', 'Data'],
    'messaging-choice': ['Messaging', 'Integration'], 'api-management': ['API Management', 'Integration'],
    'vnet-private-endpoints': ['VNets & private endpoints', 'Networking'], 'key-vault': ['Key Vault', 'Networking'], 'front-door-gateway': ['Front Door & App Gateway', 'Networking'],
    'monitor-app-insights': ['Monitor & App Insights', 'Operations'], 'bicep-terraform': ['Bicep & Terraform', 'Operations'], 'devops-pipelines': ['CI/CD', 'Operations'],
    'cost-management': ['Cost', 'Operations'], 'azure-openai': ['Azure OpenAI', 'Operations'], 'well-architected': ['Well-Architected', 'Operations'], 'spring-on-azure': ['Spring on Azure', 'Operations']
  };
  /*Q-START*/
  const Q = [
    // ---------- Foundations ----------
    { s: 'azure-hierarchy', q: 'A <code>deny</code> policy blocking public IPs is assigned at the <b>Prod</b> management group. An <b>Owner</b> of a subscription under it deploys a VM with a public IP. What happens?', o: ['It succeeds: Owner overrides Policy', 'The deployment is denied (RequestDisallowedByPolicy)', 'It succeeds but is flagged non-compliant', 'Only resources created by the policy author are blocked'], a: 1, x: 'Policy assignments are <b>inherited</b> by every child subscription, resource group and resource. RBAC decides <i>who</i> may act; Policy decides <i>what</i> may exist, and a deny applies to Owners too.' },
    { s: 'azure-hierarchy', q: 'Resource group <code>rg-orders</code> was created in West Europe. Can it contain a Postgres server in North Europe?', o: ['No: resources must match the group’s region', 'Yes: the group’s location only stores its metadata', 'Only with a region-pair exception', 'Only for global resources such as DNS'], a: 1, x: 'A resource group’s location is where its <b>metadata</b> lives. Its resources can be in other regions. Keeping a workload together is still clearer, and the metadata region matters for management operations during an outage there.' },
    { s: 'regions-zones', q: 'Two different subscriptions each deploy a VM into “zone 1” of the same region. Are they in the same physical zone?', o: ['Always', 'Not necessarily: logical zone numbers are mapped per subscription', 'Only in paired regions', 'Only if both use the same VNet'], a: 1, x: 'Logical zones are mapped to physical zones <b>per subscription</b>. To align across subscriptions, read the zone mappings from the locations API instead of assuming “1 = 1”.' },
    { s: 'regions-zones', q: 'An app runs on one <b>zonal</b> VM in zone 2 and keeps files in a <b>ZRS</b> storage account. Zone 2 fails. What keeps working without action?', o: ['Both', 'The storage account, not the VM', 'The VM, not the storage account', 'Neither'], a: 1, x: 'Zonal means pinned to one zone: it goes down with it. Zone-redundant services (ZRS storage, zone-redundant App Service or Postgres HA) survive. Zones are HA inside a region, not regional DR.' },
    { s: 'entra-managed-identity', q: 'You delete an App Service with a <b>system-assigned</b> identity that had Key Vault and SQL roles, then recreate it with the same name. What about its access?', o: ['Restored automatically', 'Lost: the new app gets a new principal, and the old assignments point to a deleted identity', 'Kept for 30 days', 'Only Key Vault access remains'], a: 1, x: 'A system-assigned identity lives and dies with its resource; recreating it creates a <b>new service principal</b>. Use a <b>user-assigned</b> identity when access must survive redeploys or be shared.' },
    { s: 'entra-managed-identity', q: 'A multi-tenant SaaS app must read a customer’s storage. In the <b>customer’s</b> tenant, which object gets the Azure role assignment?', o: ['The app registration (application object)', 'The service principal (enterprise application) in that tenant', 'The client secret', 'The redirect URI'], a: 1, x: 'The <b>application object</b> is the global definition in the home tenant. Each tenant that uses the app has its own <b>service principal</b>, and RBAC and consent apply to that local principal. Managed identities are service principals too.' },
    { s: 'rbac-policy', q: 'A pipeline identity has <b>Contributor</b> on a resource group. Its Bicep creates a role assignment for the app’s managed identity. Result?', o: ['It works: Contributor can do anything in the group', 'It fails with AuthorizationFailed: Contributor can’t write role assignments', 'It works for built-in roles only', 'It works but the assignment is disabled'], a: 1, x: 'Contributor excludes <code>Microsoft.Authorization/*/write</code>. Role assignments need Owner, User Access Administrator, or <b>Role Based Access Control Administrator</b>, which can be constrained with conditions to specific roles.' },
    { s: 'rbac-policy', q: 'You assign a policy with the <code>modify</code> effect that adds a <code>costCenter</code> tag. What happens to 400 <b>existing</b> untagged resources?', o: ['They are tagged immediately', 'Nothing until a remediation task runs (new and updated resources are tagged at write time)', 'They are deleted', 'They are moved to a quarantine group'], a: 1, x: '<code>modify</code> and <code>deployIfNotExists</code> act on create and update requests. Existing resources are only reported non-compliant until you run a <b>remediation task</b>, which uses the assignment’s managed identity.' },
    // ---------- Compute ----------
    { s: 'compute-choice', q: 'A nightly containerised Java batch runs 40 minutes, should cost nothing between runs, and nobody wants to operate a cluster. Best fit?', o: ['AKS with a CronJob', 'A scheduled Container Apps job', 'A WebJob on an always-on Premium App Service plan', 'An HTTP-triggered function'], a: 1, x: '<b>Container Apps jobs</b> run containers to completion on a schedule or event and cost nothing while idle. AKS works but means running a cluster; an HTTP trigger can’t hold a 40-minute request.' },
    { s: 'compute-choice', q: 'A platform needs custom Kubernetes operators and CRDs, a service mesh of its choice, and fine-grained network policy. Which compute?', o: ['Container Apps', 'App Service', 'AKS', 'Functions Premium'], a: 2, x: 'When you need <b>Kubernetes itself</b> (operators, CRDs, your own mesh), choose <b>AKS</b>, and accept owning upgrades, node pools and capacity. Container Apps hides the Kubernetes API.' },
    { s: 'app-service', q: 'You run a heavy load test against the <b>staging slot</b> of a production App Service. What can production users notice?', o: ['Nothing: slots run on separate machines', 'Slower responses: slots share the same plan instances', 'A DNS change', 'An automatic swap'], a: 1, x: 'Slots are separate apps on the <b>same App Service plan</b>, sharing its CPU and memory. Load-test in another plan, or scale out for the test.' },
    { s: 'app-service', q: 'A stateless Spring API on App Service scales from 2 to 6 instances, but the new instances get almost no traffic. Most likely cause?', o: ['Health check is disabled', 'ARR affinity cookies pin existing clients to the old instances', 'Always On is off', 'The plan runs Linux'], a: 1, x: '<b>ARR affinity</b> (on by default) pins clients with a cookie. Turn it off for stateless APIs so load spreads over every instance.' },
    { s: 'container-apps', q: 'A Container App has <code>minReplicas: 0</code> and an HTTP scale rule. The first request after a quiet hour takes 25 seconds. Why, and the usual fix?', o: ['DNS propagation; lower the TTL', 'Scale from zero: a replica and the JVM must start; keep minReplicas at 1 for latency-sensitive apps', 'The WAF inspects the body', 'Old revisions are being cleaned up'], a: 1, x: 'At zero replicas the first request waits for a container to start and Spring to boot. Keep <b>minReplicas ≥ 1</b> where latency matters, and speed up startup.' },
    { s: 'container-apps', q: 'In <b>single</b> revision mode you deploy a new image. What happens to traffic?', o: ['It is split 50/50', 'The new revision takes all traffic once it is ready, and the old one is deactivated', 'The old revision keeps 100% until you move it', 'Both stay active indefinitely'], a: 1, x: 'Single revision mode keeps one active revision. For canaries, use <b>multiple</b> revision mode with traffic weights or labels.' },
    { s: 'aks', q: 'A pod should use a user-assigned managed identity with <b>AKS workload identity</b>. Besides this, what else is required?', code: `apiVersion: v1
kind: ServiceAccount
metadata:
  name: orders
  namespace: shop
  annotations:
    azure.workload.identity/client-id: "<uami-client-id>"
---
# in the pod template
metadata:
  labels:
    azure.workload.identity/use: "true"
spec:
  serviceAccountName: orders`, lang: 'yaml', o: ['Nothing else', 'A federated credential on the identity for the cluster’s OIDC issuer and subject system:serviceaccount:shop:orders', 'A client secret in a Kubernetes Secret', 'AAD Pod Identity installed'], a: 1, x: 'With the OIDC issuer and workload identity enabled on the cluster, the identity needs a <b>federated credential</b> with subject <code>system:serviceaccount:shop:orders</code>. The SDK exchanges the projected token for an Entra token. No secret.' },
    { s: 'aks', q: 'Why pick Azure CNI <b>Overlay</b> over flat Azure CNI for a large cluster?', o: ['Pods get public IPs', 'Pod IPs come from a private overlay range, so pods don’t consume VNet subnet addresses', 'It removes the need for network policy', 'It is required for Windows nodes'], a: 1, x: 'With flat Azure CNI every pod takes a VNet IP and subnets run out. <b>Overlay</b> gives pods IPs from a separate CIDR; only nodes use VNet addresses.' },
    { s: 'functions', q: 'An HTTP-triggered function builds a report for 6 minutes. <code>functionTimeout</code> is 10 minutes on a Premium plan. What does the caller get?', o: ['The report after 6 minutes', 'A timeout from the front end after about 230 s, while the function keeps running', 'An automatic 202', 'A 429'], a: 1, x: 'HTTP triggers must respond within about <b>230 seconds</b> (load balancer idle timeout) whatever <code>functionTimeout</code> says. Use async request-reply: start a Durable orchestration and return 202 with a status URL.' },
    { s: 'functions', q: 'A Durable Functions <b>orchestrator</b> calls <code>LocalDateTime.now()</code> to decide whether to send a reminder. What goes wrong?', o: ['Nothing', 'On replay the value differs, so the orchestrator can take a different path (non-determinism)', 'It throws immediately', 'The orchestrator never replays'], a: 1, x: 'Orchestrators replay their code from the history on every wake-up and must be <b>deterministic</b>. Use the orchestration context’s current time and put I/O in activities.' },
    // ---------- Data ----------
    { s: 'storage-accounts', q: 'A blob is in the <b>Archive</b> tier. An app tries to download it. What happens?', o: ['It downloads slowly', 'The read fails: the blob must be rehydrated to an online tier first, which can take hours', 'It downloads after a short delay', 'It is served from a cache'], a: 1, x: 'Archive is offline. Reads need <b>rehydration</b> (change the tier or copy to Hot/Cool), which takes hours at standard priority. Never archive data the app reads on demand.' },
    { s: 'storage-accounts', q: 'A storage account sets <code>allowSharedKeyAccess: false</code>. Which kind of SAS still works?', o: ['Account SAS', 'Service SAS signed with the account key', 'User delegation SAS', 'None: all SAS is disabled'], a: 2, x: 'Disabling shared key invalidates SAS signed with account keys. A <b>user delegation SAS</b> is signed with a key obtained through Entra ID, so it still works and is attributable to an identity.' },
    { s: 'azure-sql-postgres', q: 'You run a point-in-time restore of a Postgres Flexible Server to 10:42. What do you get?', o: ['The existing server rewinds in place', 'A new server with the data as of 10:42', 'A read replica of the current server', 'A snapshot file in Blob Storage'], a: 1, x: 'PITR restores to a <b>new server</b>. Plan the cut-over: repoint the app, or copy the damaged rows back from the restored copy.' },
    { s: 'azure-sql-postgres', q: 'Postgres Flexible Server runs with zone-redundant HA. Can reporting queries read from the standby?', o: ['Yes, it is a readable hot standby', 'No: the HA standby doesn’t serve queries; use a read replica', 'Only during maintenance windows', 'Only through PgBouncer'], a: 1, x: 'The HA standby exists for failover only. Offload reads to <b>read replicas</b>, which replicate asynchronously.' },
    { s: 'cosmos-db', q: 'A global app uses <code>/country</code> as its Cosmos DB partition key. Three countries produce most traffic and data. The risk?', o: ['None: Cosmos rebalances automatically', 'Hot partitions, and logical partitions approaching their 20 GB limit', 'Higher costs for strong consistency', 'The change feed stops'], a: 1, x: 'A low-cardinality key concentrates storage and throughput in a few <b>logical partitions</b>, each capped in size and served from one physical partition’s share of RU/s. Choose a high-cardinality key (or a hierarchical key).' },
    { s: 'cosmos-db', q: 'What is the default consistency level of a new Cosmos DB account?', o: ['Strong', 'Bounded staleness', 'Session', 'Eventual'], a: 2, x: '<b>Session</b>: read-your-own-writes for a client holding the session token, with lower latency and RU cost than Strong.' },
    { s: 'redis-cache', q: 'Azure Cache for Redis is full. Many keys were written without a TTL. With the default <code>maxmemory-policy</code> (<code>volatile-lru</code>), what happens?', o: ['The oldest keys are evicted whatever their TTL', 'Only keys with a TTL can be evicted; when none remain, writes fail with OOM errors', 'The cache scales up automatically', 'Keys spill to disk'], a: 1, x: '<code>volatile-lru</code> evicts only keys that have an expiry. Keys without TTL stay forever, and writes then fail with <code>OOM command not allowed</code>. Set TTLs, or use <code>allkeys-lru</code> for a pure cache.' },
    { s: 'redis-cache', q: 'Which Azure Cache for Redis tier is a single node with no replica and no SLA?', o: ['Basic', 'Standard', 'Premium', 'Enterprise'], a: 0, x: '<b>Basic</b>: dev/test only. Standard adds a replica and an SLA; Premium adds clustering, VNet injection and persistence. (Azure Managed Redis is the newer offering; check current tiers.)' },
    // ---------- Integration ----------
    { s: 'messaging-choice', q: 'Order events must be processed strictly in order <b>per customer</b>, with dead-lettering of poison messages. Which service and feature?', o: ['Event Grid with subject filters', 'A Service Bus queue with sessions (session id = customer id)', 'Event Hubs with one partition per customer', 'Storage queues'], a: 1, x: 'Service Bus <b>sessions</b> give FIFO per session id and lock each session to one receiver; the DLQ handles poison messages. Event Hubs orders per partition but has no per-message settlement or DLQ.' },
    { s: 'messaging-choice', q: 'A Service Bus message keeps failing in its handler. With default settings, when does it reach the dead-letter queue?', o: ['After the first failure', 'When its delivery count exceeds MaxDeliveryCount (10 by default)', 'After 24 hours', 'Never: you must move it yourself'], a: 1, x: 'Each abandon or lock expiry increments the <b>delivery count</b>; past <code>MaxDeliveryCount</code> (default 10) the message is dead-lettered. Lock expiry during slow work counts too, so renew locks or shorten processing.' },
    { s: 'api-management', q: 'This API-scope policy omits <code>&lt;base /&gt;</code> in <code>&lt;inbound&gt;</code>. Global inbound policies include rate limiting and CORS. What runs for calls to this API?', code: `<policies>
  <inbound>
    <set-header name="x-tenant" exists-action="override">
      <value>@(context.Subscription.Id)</value>
    </set-header>
  </inbound>
  <backend><base /></backend>
  <outbound><base /></outbound>
  <on-error><base /></on-error>
</policies>`, lang: 'text', o: ['Global and API inbound policies', 'Only this inbound policy: the inherited global inbound policies are skipped', 'Only the global policies', 'Nothing: the policy is invalid'], a: 1, x: '<code>&lt;base /&gt;</code> marks where the parent scope’s policies execute. Leave it out and inherited inbound policies (global, product) <b>don’t run</b> for this API, including your rate limit.' },
    { s: 'api-management', q: 'You need “at most 100 calls per minute per subscription” and “at most 1 million calls per month per subscription”. Which policies?', o: ['quota for both', 'rate-limit for the minute, quota for the month', 'ip-filter and cache-lookup', 'validate-jwt and rate-limit'], a: 1, x: '<code>rate-limit</code> guards short bursts (429 when exceeded); <code>quota</code> caps volume over long periods (403 when exhausted). Use the <code>-by-key</code> variants to key on something other than the subscription.' },
    // ---------- Networking & security ----------
    { s: 'vnet-private-endpoints', q: 'You add a private endpoint for a storage account and disable public access. From a VM in the VNet, <code>nslookup storders.blob.core.windows.net</code> returns a public IP and requests get 403. Cause?', o: ['An NSG blocks port 443', 'The privatelink.blob.core.windows.net private DNS zone isn’t linked to this VNet (or lacks the record)', 'Private endpoints need a NAT gateway', 'The account is in another subscription'], a: 1, x: 'The public name must resolve, via its <code>privatelink</code> CNAME, to the endpoint’s <b>private IP</b>. That needs a private DNS zone with the A record, linked to every VNet that resolves it (or conditional forwarding from on-prem DNS).' },
    { s: 'vnet-private-endpoints', q: 'On-premises servers connected over ExpressRoute must reach Azure SQL privately. Service endpoint or private endpoint?', o: ['Service endpoint', 'Private endpoint', 'Either works the same', 'Neither: use an IP allow-list'], a: 1, x: 'A <b>service endpoint</b> lets a subnet reach the service’s public endpoint over the backbone; on-premises traffic can’t use it. A <b>private endpoint</b> is a private IP in your VNet, reachable over peering, VPN and ExpressRoute (with DNS forwarding).' },
    { s: 'key-vault', q: 'A vault uses the <b>Azure RBAC</b> permission model. A developer has <b>Contributor</b> on it. Can they read secret values?', o: ['Yes, Contributor includes data actions', 'No: reading secrets needs a data-plane role such as Key Vault Secrets User', 'Only in the portal', 'Only secrets they created'], a: 1, x: 'With RBAC, managing the vault (control plane) and reading secrets (data plane) are separate. Contributor has no <b>data actions</b>. Under the legacy access-policy model a Contributor could grant itself access, one reason to prefer RBAC.' },
    { s: 'key-vault', q: 'You delete <code>kv-orders</code>, then re-run the Bicep that creates it. The deployment fails with a name conflict. Why?', o: ['Vault names are reserved forever', 'The vault is soft-deleted: recover it, or purge it if purge protection is off', 'DNS hasn’t updated yet', 'Bicep caches names'], a: 1, x: 'Soft delete keeps a deleted vault (and its name) for the retention period. Recover it (<code>az keyvault recover</code>) or purge it; with <b>purge protection</b> on, you wait out the retention.' },
    { s: 'front-door-gateway', q: 'A multi-region HTTP app needs WAF at the edge, TLS termination near users and fast failover between regions. Which service?', o: ['Azure Load Balancer', 'An Application Gateway in each region, alone', 'Azure Front Door', 'Traffic Manager alone'], a: 2, x: '<b>Front Door</b> is global, at Microsoft’s edge, layer 7, with WAF, caching and probe-based failover. Application Gateway is regional, Traffic Manager is DNS-based (failover bound by TTLs), Load Balancer is layer 4.' },
    { s: 'front-door-gateway', q: 'A regional service speaks a non-HTTP TCP protocol across three zones. Which load balancer?', o: ['Front Door', 'Application Gateway', 'Standard Load Balancer with a zone-redundant frontend', 'API Management'], a: 2, x: 'Non-HTTP traffic in one region is a layer-4 job: <b>Standard Load Balancer</b>. Front Door and Application Gateway are HTTP(S) proxies.' },
    // ---------- Operations & architecture ----------
    { s: 'monitor-app-insights', q: 'Sampling is on. This returns <code>n = 1,200</code> and <code>real = 6,000</code>. Which number belongs on a capacity dashboard?', code: `AppRequests
| where TimeGenerated > ago(1h)
| summarize n = count(), real = sum(ItemCount)`, lang: 'kql', o: ['n', 'real', 'n × 2', 'Neither: sampled data can’t be counted'], a: 1, x: 'Each stored row stands for <code>ItemCount</code> requests, so <b>sum(ItemCount)</b> estimates the real traffic. <code>count()</code> only counts stored rows.' },
    { s: 'monitor-app-insights', q: 'A log search alert runs every 5 minutes over a 5-minute window. Why can it miss short incidents?', o: ['Alerts only fire once a day', 'Rows arriving after the ingestion delay fall into windows that were already evaluated', 'KQL drops failed requests', 'Action groups throttle'], a: 1, x: 'Telemetry reaches the workspace after a delay (typically minutes). Use a window <b>longer than the frequency</b> (e.g. 15 min every 5 min), alert on rates, and use metric alerts when you need speed.' },
    { s: 'bicep-terraform', q: 'Resource group <code>rg-app</code> holds A, B and C. <code>main.bicep</code> declares A and B. You deploy with <code>--mode Complete</code>. What happens to C?', o: ['Nothing: Bicep never deletes', 'C is deleted', 'The deployment fails', 'C is tagged as unmanaged'], a: 1, x: 'Complete mode makes the group match the template exactly, so <b>C is deleted</b>. In the default Incremental mode, what-if shows C as <code>Ignore</code> and leaves it. Use deployment stacks to delete only what you created.' },
    { s: 'bicep-terraform', q: 'The first production deploy fails with <code>PrincipalNotFound</code>; re-running succeeds. The identity is created in the same template. What fixes it?', code: `resource ra 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, uami.id, roleId)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleId)
    principalId: uami.properties.principalId
  }
}`, lang: 'bicep', o: ['A dependsOn on the Key Vault', 'principalType: \'ServicePrincipal\' in properties', 'A random name instead of guid()', 'Complete mode'], a: 1, x: 'Without <code>principalType</code>, ARM looks up the brand-new principal before Entra ID has replicated it. Setting <b>principalType</b> skips that lookup. Keep the deterministic <code>guid()</code> name for idempotent redeploys.' },
    { s: 'devops-pipelines', q: 'A push to <code>main</code> in <code>contoso/orders</code> runs a job with <code>environment: production</code>. What is the OIDC token’s <code>sub</code> claim (default template)?', o: ['repo:contoso/orders:ref:refs/heads/main', 'repo:contoso/orders:environment:production', 'repo:contoso/orders:job:deploy', 'contoso/orders@main'], a: 1, x: 'When a job targets an environment, the subject becomes <code>repo:ORG/REPO:<b>environment:NAME</b></code>. The federated credential must match it exactly, or login fails with “No matching federated identity record found”.' },
    { s: 'devops-pipelines', q: 'Does the <code>deploy</code> job get permission to request an OIDC token?', code: `permissions:
  id-token: write
  contents: read
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: azure/login@v2
        with: { client-id: ..., tenant-id: ..., subscription-id: ... }`, lang: 'yaml', o: ['Yes, inherited from the workflow level', 'No: a job-level permissions block replaces the workflow-level one, so id-token is none', 'Yes, azure/login grants it', 'Only on pull requests'], a: 1, x: 'Job-level <code>permissions</code> <b>replace</b> the workflow defaults for that job; unspecified scopes become <code>none</code>. Add <code>id-token: write</code> to the job.' },
    { s: 'cost-management', q: 'In one hour a workload uses 10 units of eligible compute. A reservation covers 6 units of that VM family; a savings plan’s hourly commitment covers 3 more. How is the hour billed?', o: ['10 units at the savings-plan rate', '6 reserved + 3 savings plan + 1 pay-as-you-go', '3 savings plan + 7 pay-as-you-go', '6 reserved + 4 pay-as-you-go'], a: 1, x: 'Azure applies <b>reservations first</b>, then the savings plan, then pay-as-you-go for the rest. Unused commitment in an hour is lost.' },
    { s: 'cost-management', q: 'An engineer shuts a VM down from inside the OS on Friday evening. The portal shows “Stopped”. What is billed over the weekend?', o: ['Nothing', 'Disks only', 'Compute and disks', 'Only the NIC'], a: 2, x: '“Stopped” keeps compute <b>allocated and billed</b>. Only “Stopped (deallocated)” ends compute charges; disks are billed either way.' },
    { s: 'azure-openai', q: 'A request has ~500 prompt tokens and <code>max_tokens: 4000</code>; the model writes 300 tokens. Roughly how many tokens does the rate limiter count at admission?', o: ['300', '800', '4,500', '4,000'], a: 2, x: 'Admission estimates <b>prompt + max_tokens</b> ≈ 4,500, so generous <code>max_tokens</code> causes 429s long before real usage reaches the TPM. Billing uses the real 800.' },
    { s: 'azure-openai', q: 'Azure OpenAI returns <b>HTTP 200</b>, but the answer is cut off. Which field tells you the completion was filtered?', o: ['usage.total_tokens', 'choices[0].finish_reason = "content_filter"', 'The x-ratelimit-remaining-tokens header', 'error.code = "content_filter"'], a: 1, x: 'A filtered <b>completion</b> is a 200 with <code>finish_reason: "content_filter"</code>. A filtered <b>prompt</b> is different: HTTP 400 with <code>error.code: "content_filter"</code>. Handle both.' },
    { s: 'well-architected', q: 'Gateway, API and SDK each make 1 attempt plus up to 3 retries. The database is down. How many database calls can one user request cause?', o: ['4', '9', '12', '64'], a: 3, x: 'Each layer makes up to 4 attempts, each triggering the full sequence below: 4 × 4 × 4 = <b>64</b>. Retry in one layer, with backoff and jitter.' },
    { s: 'well-architected', q: 'Postgres has a cross-region asynchronous read replica with ~30 s lag. The primary region fails and you promote the replica. Realistic RPO?', o: ['0', 'About the replication lag (≈30 s of writes may be lost)', 'The backup retention period', 'The time to promote the replica'], a: 1, x: 'Writes not yet shipped are lost on failover, so RPO ≈ <b>lag at the moment of failure</b>. Promotion time is part of RTO, not RPO.' },
    { s: 'spring-on-azure', q: 'Two Spring apps each scale to 12 replicas with a Hikari pool of 10. How many Postgres connections can they open at peak?', o: ['20', '120', '240', '24'], a: 2, x: '2 × 12 × 10 = <b>240</b>, before migrations and admin sessions. Budget pools against <code>max_connections</code> before choosing <code>maxReplicas</code>; consider PgBouncer.' },
    { s: 'spring-on-azure', q: 'A Container App has a system-assigned and a user-assigned identity, and no client ID configured. Which identity does <code>DefaultAzureCredential</code> use?', o: ['The user-assigned one', 'The system-assigned one', 'Both, alternately', 'It fails as ambiguous'], a: 1, x: 'Without a client ID, the managed identity credential requests the <b>system-assigned</b> identity. Set <code>AZURE_CLIENT_ID</code> (or <code>spring.cloud.azure.credential.client-id</code>) to pick the user-assigned one.' }
  ];
  /*Q-END*/
  const MODS = ['All', 'Foundations', 'Compute', 'Data', 'Integration', 'Networking', 'Operations'];
  const tname = (q) => (TOPIC[q.s] || [q.s])[0];
  const tmod = (q) => (TOPIC[q.s] || ['', 'Operations'])[1];
  if (!document.getElementById('w-taz-style')) {
    document.head.append(el('style', { id: 'w-taz-style', text: `
.w-taz-bar { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; margin: 8px 0; }
.w-taz-bar div { height: 100%; background: var(--accent); }
.w-taz-bar div.low { background: var(--err); }
.w-taz-opts { display: grid; gap: 6px; margin-top: 10px; }
.w-taz-opts button { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 9px; padding: 9px 12px; font-size: 14px; cursor: pointer; overflow-wrap: anywhere; }
.w-taz-opts button:hover:not(:disabled) { border-color: var(--accent); }
.w-taz-opts button.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 15%, transparent); }
.w-taz-opts button.bad { border-color: var(--err); background: color-mix(in srgb, var(--err) 15%, transparent); }
.w-taz-opts button:disabled { cursor: default; }
.w-taz-q { font-size: 16px; margin: 6px 0 8px; }
.w-taz-rev { border-top: 1px solid var(--border); padding: 10px 0; }
.w-taz-rev:first-child { border-top: 0; }
.w-taz-tb { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; font-size: 13px; margin-top: 6px; }
.w-taz-tb .m { color: var(--err); }
.w-taz-tb .p { color: var(--ok); }
` }));
  }
  let mod = 'All'; let count = 10; let secs = 60; let gen = 0; let deck = []; let i = 0; let score = 0; let misses = []; let left = 0; let answered = false; let started = false; let tick = null;
  const seg = (opts, get, set, label) => { const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(([v, l]) => { const b = el('button', { text: l, class: v === get() ? 'on' : '' }); b.addEventListener('click', () => { set(v); [...s.children].forEach((x) => x.classList.toggle('on', x === b)); }); s.append(b); }); return s; };
  const segT = seg(MODS.map((t) => [t, t]), () => mod, (v) => { mod = v; reset(); }, 'Module');
  const segN = seg([[10, '10 questions'], [25, '25'], [Q.length, 'all ' + Q.length]], () => count, (v) => { count = v; reset(); }, 'Number of questions');
  const segS = seg([[90, 'Slow · 90 s'], [60, 'Normal · 60 s'], [30, 'Fast · 30 s']], () => secs, (v) => { secs = v; reset(); }, 'Time per question');
  const bPlay = el('button', { class: 'btn primary', text: '▶ Start' }); const bStep = el('button', { class: 'btn', text: 'Skip ›' }); const bReset = el('button', { class: 'btn', text: '↺ Reset' });
  const card = el('div', { class: 'card', style: { padding: '14px', marginTop: '10px' } });
  const narr = el('div', { class: 'caption', 'aria-live': 'polite' }); const stats = el('div', { class: 'w-stats' });
  root.append(el('div', { class: 'w-controls' }, segT), el('div', { class: 'w-controls' }, segN, el('span', { class: 'tiny', text: 'time per question' }), segS),
    el('div', { class: 'w-controls' }, bPlay, bStep, bReset), stats, card, narr);
  const say = (h) => { narr.innerHTML = ''; narr.append(el('div', { class: 't', html: h })); };
  const link = (q) => `<a href="${q.s}.html">${ctx.esc(tname(q))}</a>`;
  function shuffle(a) { const r = a.slice(); for (let j = r.length - 1; j > 0; j--) { const m = Math.floor(Math.random() * (j + 1)); [r[j], r[m]] = [r[m], r[j]]; } return r; }
  function renderStats() { stats.innerHTML = ''; stats.append(el('span', { class: 'w-stat', html: `question <b>${Math.min(i + 1, deck.length)}</b>/${deck.length}` }), el('span', { class: 'w-stat', html: `score <b>${score}</b>` }), el('span', { class: 'w-stat', html: `missed <b>${misses.length}</b>` }), el('span', { class: 'w-stat', html: `time <b>${started && !answered ? left + ' s' : '–'}</b>` })); }
  function stopTimer() { if (tick) { clearInterval(tick); tick = null; } }
  function show() {
    const q = deck[i]; answered = false; left = secs; card.innerHTML = '';
    const bar = el('div'); const barWrap = el('div', { class: 'w-taz-bar' }, bar);
    const opts = el('div', { class: 'w-taz-opts' });
    card.append(el('div', { class: 'w-controls', style: { marginBottom: '0' } }, el('span', { class: 'pill accent', text: tname(q) }), el('span', { class: 'tiny', text: `${tmod(q)} · #${i + 1}` })), barWrap, el('div', { class: 'w-taz-q', html: q.q }));
    if (q.code) card.append(ctx.codeBox(q.code, q.lang || 'bash'));
    q.o.forEach((o, j) => { const b = el('button', { html: `<b>${'ABCD'[j]}.</b> ${ctx.esc(o)}` }); b.addEventListener('click', () => answer(j)); opts.append(b); });
    card.append(opts);
    const paint = () => { bar.style.width = (left / secs) * 100 + '%'; bar.className = left <= 10 ? 'low' : ''; if (!reduced) bar.style.transition = 'width 1s linear'; };
    paint(); renderStats(); say('Pick an answer before the bar runs out. Skip counts as a miss.');
    stopTimer(); const g = gen;
    tick = setInterval(() => { if (g !== gen || answered) { stopTimer(); return; } left--; paint(); renderStats(); if (left <= 0) answer(-1); }, 1000);
    card.opts = opts;
  }
  function answer(j) {
    if (answered || !started) return; answered = true; stopTimer();
    const q = deck[i]; const ok = j === q.a;
    if (ok) score++; else misses.push({ q, j });
    [...card.opts.children].forEach((b, m) => { b.disabled = true; if (m === q.a) b.classList.add('ok'); else if (m === j) b.classList.add('bad'); });
    card.append(el('div', { class: 'pz-exp', html: (j === -1 ? '<b>Time’s up.</b> ' : j === -2 ? '<b>Skipped.</b> ' : ok ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.x + ` <span class="tiny">More: ${link(q)}</span>` }));
    bStep.textContent = i + 1 < deck.length ? 'Next ›' : 'Finish ›'; renderStats();
    say(ok ? 'Correct. Press Next.' : 'Read the explanation, then press Next.');
  }
  function next() {
    if (!started) return;
    if (!answered) { answer(-2); return; }
    i++; bStep.textContent = 'Skip ›';
    if (i >= deck.length) return finish();
    show();
  }
  function finish() {
    started = false; stopTimer(); bStep.disabled = true; bPlay.textContent = '▶ Again'; card.innerHTML = '';
    const by = {};
    deck.forEach((q) => { by[q.s] = by[q.s] || { q, ok: 0, n: 0 }; by[q.s].n++; if (!misses.some((m) => m.q === q)) by[q.s].ok++; });
    const rows = Object.values(by).sort((a, b) => (a.ok / a.n) - (b.ok / b.n) || tname(a.q).localeCompare(tname(b.q)));
    const tb = el('div', { class: 'w-taz-tb' });
    rows.forEach((r) => tb.append(el('div', { html: link(r.q) + ` <span class="tiny">${ctx.esc(tmod(r.q))}</span>` }), el('div', { class: r.ok === r.n ? 'p' : 'm', html: `<b>${r.ok}/${r.n}</b>` })));
    card.append(el('h3', { text: `Score: ${score} / ${deck.length}`, style: { margin: '0 0 8px' } }), el('div', { class: 'tiny', text: 'By topic (weakest first):' }), tb);
    if (misses.length) {
      card.append(el('h4', { text: 'Review your misses', style: { margin: '14px 0 4px' } }));
      misses.forEach(({ q, j }) => { const r = el('div', { class: 'w-taz-rev' }, el('div', { html: `<span class="pill">${ctx.esc(tname(q))}</span> ${q.q}` }));
        if (q.code) r.append(ctx.codeBox(q.code, q.lang || 'bash'));
        r.append(el('div', { class: 'tiny', html: `You: ${j < 0 ? (j === -1 ? 'time ran out' : 'skipped') : ctx.esc(q.o[j])} · Correct: <b>${ctx.esc(q.o[q.a])}</b>` }), el('div', { class: 'pz-exp', html: q.x + ` <span class="tiny">Revise: ${link(q)}</span>` }));
        card.append(r); });
    } else card.append(el('p', { text: `No misses. Try all ${Q.length} on Fast.` }));
    renderStats(); say(`Done: ${score}/${deck.length}. ` + (misses.length ? 'Your misses are listed above, each with a link to its topic page.' : ''));
  }
  function reset() {
    gen++; stopTimer(); started = false; answered = false; i = 0; score = 0; misses = [];
    const pool = Q.filter((q) => mod === 'All' || tmod(q) === mod); deck = shuffle(pool).slice(0, count);
    bPlay.textContent = '▶ Start'; bStep.textContent = 'Skip ›'; bStep.disabled = true; card.innerHTML = '';
    card.append(el('p', { html: `<b>${deck.length}</b> question${deck.length === 1 ? '' : 's'} (${mod === 'All' ? 'all modules' : mod}), <b>${secs} s</b> each. Decide as you would in an interview: no portal, no docs.`, style: { margin: 0 } }));
    renderStats(); say('Choose a module, how many questions and the time limit, then press Start.');
  }
  bPlay.addEventListener('click', () => { reset(); started = true; bStep.disabled = false; bPlay.textContent = '↻ Restart'; show(); });
  bStep.addEventListener('click', next);
  bReset.addEventListener('click', reset);
  reset();
});

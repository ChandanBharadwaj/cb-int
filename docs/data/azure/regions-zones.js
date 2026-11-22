IA.register({
  track: 'azure',
  slug: 'regions-zones',
  title: 'Regions & availability zones',
  tagline: 'A <b>region</b> is a set of datacenters in one metro area. An <b>availability zone</b> is a physically separate group of datacenters inside that region. <b>Zonal</b> means you pinned something to one zone; <b>zone-redundant</b> means the platform spreads it across zones. Region <b>pairs</b> are about platform updates and replication targets, not automatic failover of your app.',
  tldr: {
    problem: '“We’re multi-AZ” is often untrue: every VM landed in zone 1, or the database is single-zone. And an SLA promised to the business ignores the fact that five services in series multiply their downtime.',
    model: 'Failure domains nest: rack ⊂ datacenter ⊂ zone ⊂ region ⊂ geography. Choose the domain you must survive. Zone-redundant SKUs survive a zone; only a second region survives a region. Availability of components in series is the <b>product</b> of their SLAs, and redundancy in parallel is 1 − Π(1 − p).',
    hook: '“App Service at 99.95% and Postgres at 99.99%. What’s your composite SLA?” 0.9995 × 0.9999 ≈ <b>99.94%</b>: lower than either component.',
    facts: [
      { v: '≥ 3 zones', l: 'in every Azure region that supports availability zones, each with independent power, cooling and networking' },
      { v: 'per-sub', l: 'mapping of logical zone numbers. “Zone 1” in one subscription may be a different physical zone in another' },
      { v: '43.2 min', l: 'of allowed downtime per 30-day month at 99.9%. 99.99% allows 4.3 minutes' }
    ]
  },
  intro: {
    what: 'Azure runs in dozens of <b>regions</b> around the world, such as West Europe (Netherlands) or East US (Virginia). Most large regions are split into <b>availability zones</b>: separate buildings, kilometres apart, with their own power and network. If one building fails, the others keep running. You decide whether your app lives in one zone, in all zones, or in more than one region.',
    analogy: { icon: '🏥', title: 'Hospitals in a city', text: 'A city (region) has three hospitals (zones) on separate power grids. If one hospital loses power, patients go to the other two, as long as the ambulances know they exist (zone-redundant). If you booked every operation in hospital 1 (zonal), you wait. A citywide disaster needs a hospital in another city (a second region).' },
    steps: [
      { t: 'Pick a region', d: 'Choose it for latency to users, data-residency rules, service availability and price. Not every service or SKU exists in every region.', code: 'az account list-locations --query "[?metadata.regionType==\'Physical\'].{name:name, pair:metadata.pairedRegion[0].name}" -o table' },
      { t: 'Zonal: you choose a zone', d: 'VMs, disks and public IPs can be pinned to zone 1, 2 or 3. That gives the lowest latency between pinned parts, but one failure domain.' },
      { t: 'Zone-redundant: the platform spreads', d: 'ZRS storage, zone-redundant App Service plans and Container Apps environments, and Postgres zone-redundant HA keep copies or instances in several zones.' },
      { t: 'Multi-region for region outages', d: 'Put Front Door (or Traffic Manager) in front of a second region, with replicated data and a tested runbook.' }
    ],
    terms: [
      ['region', 'A set of datacenters in one metro area, connected by a low-latency network. Example: <code>westeurope</code>.'],
      ['availability zone (AZ)', 'A physically separate location within a region. Microsoft designs inter-zone round-trip latency to stay under about 2 ms.'],
      ['zonal', 'A resource pinned to one specific zone that you choose.'],
      ['zone-redundant', 'A resource the platform replicates or spreads across zones automatically.'],
      ['region pair', 'Two regions in the same geography that Azure links for sequential updates and GRS replication.'],
      ['SLA / composite SLA', 'Microsoft’s uptime commitment per service, and the combined figure for a chain of services.']
    ]
  },
  visual: {
    title: 'Fail a zone, then fail a region',
    caption: 'Choose a deployment style and press Play. <b>Zonal</b> dies with zone 1. <b>Zone-redundant</b> keeps serving and the Postgres standby takes over. <b>Region outage</b> moves traffic to the pair, where the asynchronous replica has to be promoted. The calculator below shows how SLAs multiply.'
  },
  gotchas: [
    { trap: '“Zone-redundant” node pool or scale set that is all in zone 1', code: `az vm list -g rg-orders-prod --query "[].{name:name, zones:zones}" -o table
# zones: null → no zone guarantee at all
# zones: ["1"] on every VM → zonal, single failure domain`, why: 'Zones are set at <b>creation</b>. A VM Scale Set or AKS node pool created without <code>--zones</code> isn’t spread, and on most resources you can’t add zones afterwards.', fix: 'Create a new pool or scale set with <code>--zones 1 2 3</code> and migrate to it. Add an Azure Policy that audits resources without zones in production.' },
    { trap: 'Assuming zone numbers match across subscriptions', why: 'Logical zone numbers are mapped to physical zones <b>per subscription</b>. App VMs in “zone 1” of sub A and a database in “zone 1” of sub B may be in different buildings, or in the same one when you wanted them apart.', fix: 'Check the mapping: <code>az account list-locations --query "[?name==\'westeurope\'].availabilityZoneMappings"</code>. Design cross-subscription placement on physical zones.' },
    { trap: 'Treating the region pair as automatic DR', why: 'Pairs give sequential platform updates, recovery prioritisation and the GRS replication target. Your App Service, AKS cluster and database don’t fail over to the pair by themselves, and several newer regions have no pair at all.', fix: 'Design DR explicitly: Front Door with origins in two regions, replicated data (geo-replicas, GZRS), IaC that can recreate the stack, and a rehearsed runbook. You can choose any second region, not only the pair.' },
    { trap: 'Composite SLA lower than any single component', code: `Front Door 99.99 × App Service 99.95 × Postgres 99.99 × Redis 99.9
= 0.9999 × 0.9995 × 0.9999 × 0.999 ≈ 0.9983  →  ~99.83%  (~73 min / 30 days)`, why: 'In a serial dependency chain every component must be up, so the availabilities multiply. Adding a “nice to have” cache that requests depend on lowers the total.', fix: 'Remove hard dependencies (cache-aside with a fallback to the DB), add redundancy in parallel, and promise the business the composite figure, not the best single SLA.' },
    { trap: 'Zone failover that the app doesn’t survive', why: 'During a Postgres zone-redundant HA failover the hostname stays the same, but open connections die. An app with no retries, long-lived connections or a cached DNS lookup throws errors long after the database is back.', fix: 'Use Hikari with a <code>maxLifetime</code> shorter than any idle cut-off, add retries with jitter around transactional work, and test with a forced failover (<code>az postgres flexible-server restart --failover Forced</code>).' },
    { trap: 'Cross-zone chatter costs latency and money', why: 'Inter-zone latency is low but not zero, and data transfer between zones can be billed. A chatty microservice graph spread randomly across zones adds round trips to every request.', fix: 'Keep a request’s hot path tight (fewer hops, batching). Measure p99 before pinning anything. Only pin tiers to a zone when you also have a plan for that zone failing.' }
  ],
  scenarios: [
    { title: 'Zone incident took down prod, “but we were multi-AZ”',
      symptom: 'A zone-level incident in West Europe made every API pod unschedulable for 40 minutes. The architecture diagram said “3 AZs”.',
      diagnose: `az aks nodepool list -g rg-orders-prod --cluster-name aks-orders \\
  --query "[].{pool:name, zones:availabilityZones, count:count}" -o table
# userpool  zones: None  count: 6`,
      cause: 'The user node pool had been created without zones (by an early script), so all six nodes landed wherever capacity existed, which turned out to be the same zone.',
      fix: 'Create a replacement pool across zones, cordon and drain the old one, and add topology spread constraints so replicas spread across zones too.',
      fixCode: `az aks nodepool add -g rg-orders-prod --cluster-name aks-orders \\
  -n userz --zones 1 2 3 --node-count 6 --mode User
kubectl cordon -l agentpool=userpool && kubectl drain -l agentpool=userpool --ignore-daemonsets --delete-emptydir-data
az aks nodepool delete -g rg-orders-prod --cluster-name aks-orders -n userpool` },
    { title: 'Failover drill: replica promoted, the app kept writing to the dead primary',
      symptom: 'In a DR game day the team promoted the North Europe Postgres replica in two minutes, then spent 50 minutes finding every config that still pointed at <code>pg-orders-weu.postgres.database.azure.com</code>.',
      diagnose: `grep -R "postgres.database.azure.com" k8s/ helm/ src/main/resources/`,
      cause: 'The JDBC URL was hard-coded per region in four places, and nobody owned the switch.',
      fix: 'Connect through a name you control (a CNAME in a private DNS zone, or Postgres Flexible Server’s read-replica virtual endpoints where available), keep the URL in App Configuration or Key Vault, and script the whole switch.',
      fixCode: `# app config points at a stable name you control
spring.datasource.url=jdbc:postgresql://pg-orders-writer.internal.corp:5432/orders?sslmode=require

# DR runbook step: repoint the record after promotion
az network private-dns record-set cname set-record -g rg-dns -z internal.corp \\
  -n pg-orders-writer -c pg-orders-neu.postgres.database.azure.com`, lang: 'bash' },
    { title: 'Business asked for 99.99%, and the design could only deliver ~99.8%',
      symptom: 'After a quarter of incidents, the SLA report showed 99.81% against a 99.99% contract target.',
      diagnoseLang: 'text', diagnose: 'List every component on the request path and multiply: Front Door × App Gateway × App Service × Redis × Postgres × Service Bus. Each one is at 99.9–99.99%, so the product lands around 99.8%.',
      cause: 'Hard serial dependencies in a single region. The cache and the message bus were on the synchronous request path.',
      fix: 'Take the cache and bus off the critical path (degrade gracefully), use zone-redundant SKUs, and add an active-active second region for the stateless tier. Renegotiate the target based on the composite figure.' }
  ],
  puzzles: [
    { kind: 'calc', q: 'A request needs App Service (99.95%) <b>and</b> Azure Cache for Redis (99.9%). What is the composite SLA?', options: ['99.95%', '99.9%', '≈ 99.85%', '≈ 99.99%'], answer: 2, explain: 'In series, availabilities multiply: 0.9995 × 0.999 = 0.9985, so about <b>99.85%</b>, which is lower than either component.' },
    { kind: 'calc', q: 'Two independent regions, each with a composite availability of 99.9%, run active-active behind Front Door. Ignoring Front Door, what is the availability of the pair?', options: ['99.9%', '99.95%', '99.9999%', '99.8%'], answer: 2, explain: 'In parallel, the service is down only when both regions are down: 1 − (0.001 × 0.001) = 0.999999 = <b>99.9999%</b>. That assumes independent failures and instant failover, which real systems never fully achieve.' },
    { kind: 'scenario', q: 'You deploy one VM in zone 1 and another in zone 2 behind a Standard Load Balancer. Which failure does this design survive?', options: ['A single rack failure only', 'Loss of one availability zone', 'Loss of the whole region', 'None: VMs must be in an availability set'], answer: 1, explain: 'Zonal VMs in different zones put instances in separate zone failure domains, and a Standard LB frontend can be zone-redundant. A region outage still needs a second region.' },
    { kind: 'scenario', q: 'Sub A’s app VMs are in zone 1. Sub B’s Postgres server is in zone 1. Are they in the same physical zone?', options: ['Yes, zone numbers are global', 'Yes, within the same region', 'Not necessarily: logical-to-physical zone mapping differs per subscription', 'No, never'], answer: 2, explain: 'Each subscription has its own mapping of logical zones to physical zones. Check <code>availabilityZoneMappings</code> before relying on placement across subscriptions.' },
    { kind: 'scenario', q: 'Postgres Flexible Server with zone-redundant HA fails over. What should a Spring Boot app expect?', options: ['Nothing: failover is invisible to clients', 'A new hostname to configure', 'Dropped connections for a short window, then the same hostname works again', 'Data loss of the last few seconds'], answer: 2, explain: 'The standby is promoted behind the same hostname. Existing connections break and must be re-established (pool eviction plus retries). Replication to the standby is synchronous, so committed transactions are kept.' },
    { kind: 'scenario', q: 'Which statement about region pairs is true?', options: ['Your App Service app automatically fails over to the paired region', 'Every region has a pair', 'GRS storage replicates asynchronously to the paired region', 'You can only build DR between paired regions'], answer: 2, explain: 'GRS and GZRS replicate asynchronously to the pair. App failover is yours to build, several newer regions have no pair, and you can use any region for DR.' },
    { kind: 'calc', q: 'Roughly how much downtime per 30-day month does 99.95% allow?', options: ['~4 minutes', '~22 minutes', '~43 minutes', '~3.6 hours'], answer: 1, explain: '0.05% of 43,200 minutes = <b>21.6 minutes</b>. For comparison, 99.9% allows 43.2 minutes and 99.99% allows 4.3 minutes.' }
  ],
  interview: [
    { q: 'Explain zonal vs zone-redundant with examples.', a: '<p><b>Zonal</b>: you pin a resource to a specific zone, for example a VM, managed disk or public IP in zone 2. You get redundancy only by deploying several and spreading them yourself. <b>Zone-redundant</b>: the platform spreads or replicates across zones for you, for example ZRS storage, a zone-redundant App Service plan, a Container Apps environment, Postgres zone-redundant HA, or a Standard LB zone-redundant frontend.</p>', lvl: 'core' },
    { q: 'What do region pairs actually give you?', a: '<ul><li>Planned platform updates roll out to one region of a pair at a time.</li><li>In a broad outage, one region of each pair is prioritised for recovery.</li><li>GRS and GZRS storage replicate to the pair.</li><li>Data residency: pairs stay in the same geography (Brazil South is the documented exception).</li></ul><p>They don’t fail your apps over. Many newer regions have no pair, and Microsoft’s guidance now leads with availability zones.</p>', lvl: 'core' },
    { q: 'How do you compute a composite SLA, and how do you raise it?', a: '<p>Multiply the SLAs of components in series. For redundant paths, availability = 1 − Π(1 − pᵢ). To raise it: remove hard dependencies, make components zone-redundant, add parallel regions for stateless tiers, and use queues so a downstream outage becomes a delay instead of an error.</p>', fu: 'Why is the parallel formula optimistic? (It assumes independent failures and instant failover. Shared dependencies such as DNS, identity or a global config store correlate failures.)', lvl: 'core' },
    { q: 'Single VM, availability set and availability zones: what is the difference?', a: '<p>An <b>availability set</b> spreads VMs across fault and update domains (racks) within one datacenter. <b>Zones</b> spread them across buildings. Microsoft’s published VM SLA has been higher for two or more VMs across zones than for an availability set, and lowest for a single VM. Check the current figures on Microsoft Learn.</p>', lvl: 'core' },
    { q: 'How would you design a Spring Boot + Postgres service to survive a zone failure?', a: '<ul><li>App Service or Container Apps with zone redundancy and at least one spare instance’s worth of capacity.</li><li>Postgres Flexible Server with zone-redundant HA.</li><li>Zone-redundant Key Vault, ZRS storage and a zone-redundant Redis tier.</li><li>Hikari reconnects, idempotent retries, and readiness probes that check dependencies sensibly.</li><li>A rehearsed failover (forced failover test).</li></ul>', lvl: 'deep' },
    { q: 'What is RPO vs RTO, and how do zones and regions differ on them?', a: '<p><b>RPO</b>: how much data you can lose. <b>RTO</b>: how long you can be down. Synchronous zone-redundant replication gives RPO ≈ 0 for committed data, with an RTO of minutes. Cross-region replication is usually asynchronous (RPO of seconds or more), with an RTO set by your runbook or automation.</p>', lvl: 'core' },
    { q: 'Why is cross-region active-active hard for a Postgres-backed app?', a: '<p>Postgres has one writer. Active-active needs either a single global writer (cross-region write latency), sharding by region or tenant, or a multi-writer database such as Cosmos DB with conflict handling. Most teams choose active-passive for data and active-active for the stateless tier.</p>', lvl: 'deep' },
    { q: 'Not every region supports zones or every SKU. How do you plan for that?', a: '<p>Check service and SKU availability per region (<code>az vm list-skus -l &lt;region&gt; --zone</code>, the product-availability pages and quotas) before committing. Keep a short list of approved region pairs or DR pairs, and enforce it with an “Allowed locations” policy.</p>', lvl: 'core' },
    { q: 'What do you do differently for an AI workload with GPU or Azure OpenAI capacity in mind?', a: '<p>Model and GPU capacity is regional and quota-bound, and is often only in a few regions. Plan for a primary plus an alternative region with its own deployment and quota, route through APIM or a gateway with fallback, and treat data residency for prompts as a requirement.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Inspect regions, pairs and zones', lang: 'bash', code: `# physical regions and their pairs
az account list-locations \\
  --query "[?metadata.regionType=='Physical'].{name:name, geo:metadata.geographyGroup, pair:metadata.pairedRegion[0].name}" -o table

# logical → physical zone mapping for THIS subscription
az account list-locations --query "[?name=='westeurope'].availabilityZoneMappings" -o json

# which VM sizes are offered in which zones
az vm list-skus -l westeurope --size Standard_D4s --zone -o table`, note: 'Zone mapping and SKU-per-zone output differ between subscriptions. Run these in the subscription you will deploy to.' },
    { title: 'Zone-redundant App Service + Postgres (Bicep)', lang: 'bicep', code: `resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: 'asp-orders-prod'
  location: location
  sku: { name: 'P1v3', capacity: 3 }        // spread instances across zones
  kind: 'linux'
  properties: { reserved: true, zoneRedundant: true }
}

resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: 'pg-orders-prod'
  location: location
  sku: { name: 'Standard_D4ds_v5', tier: 'GeneralPurpose' }
  properties: {
    version: '16'
    highAvailability: { mode: 'ZoneRedundant', standbyAvailabilityZone: '2' }
    availabilityZone: '1'
    storage: { storageSizeGB: 128 }
    authConfig: { activeDirectoryAuth: 'Enabled', passwordAuth: 'Disabled' }
  }
}`, note: 'Zone redundancy for an App Service plan is set at creation and needs a Premium v3-class (or Isolated v2) SKU with more than one instance. Check current SKU and region support on Microsoft Learn.' },
    { title: 'Survive the failover in Spring Boot', lang: 'yaml', code: `spring:
  datasource:
    url: jdbc:postgresql://pg-orders-prod.postgres.database.azure.com:5432/orders?sslmode=require
    hikari:
      maximum-pool-size: 20
      connection-timeout: 5000      # fail fast during failover
      max-lifetime: 1500000         # 25 min: recycle connections regularly
      keepalive-time: 300000
# plus: @Retryable (spring-retry) or Resilience4j around idempotent transactional calls`, note: 'Practise with <code>az postgres flexible-server restart -g rg -n pg-orders-prod --failover Forced</code> in a non-production environment.' }
  ]
});

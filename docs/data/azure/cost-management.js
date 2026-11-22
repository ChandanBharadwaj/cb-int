IA.register({
  track: 'azure',
  slug: 'cost-management',
  title: 'Cost management',
  tagline: 'An Azure bill is <b>hours × rate</b> for everything that is provisioned, plus metered usage (GB ingested, GB out, requests, tokens). Savings come in a fixed order: <b>delete what is idle</b>, <b>right-size</b>, then cover the steady floor with <b>reservations</b> and <b>savings plans</b>, and run interruptible work on <b>Spot</b>. Budgets tell you when it goes wrong; they don’t stop it.',
  tldr: {
    problem: 'Bills that grow with no traffic growth: forgotten disks and IPs, a dev environment running all weekend, DEBUG logs in Log Analytics, a three-year commitment sized at last quarter’s peak, and a budget alert that arrived after the money was spent.',
    model: 'Each hour, eligible usage is covered first by <b>reservations</b> (specific product, region and size family), then by your <b>savings plan</b> commitment (a fixed amount per hour across eligible compute), and the rest is <b>pay-as-you-go</b>. Unused commitment in an hour is lost. <b>Spot</b> is spare capacity at a discount that can be evicted.',
    hook: '“Our Azure bill doubled. What do you do?” Group cost by service, resource group and tag in Cost Analysis; find the idle and orphaned resources with Resource Graph; right-size; only then commit to the remaining steady floor. Put budgets with forecast alerts on every subscription.',
    facts: [
      { v: 'reservation → savings plan → PAYG', l: 'is the order in which Azure applies discounts to eligible usage each hour (per Microsoft Learn)' },
      { v: 'use it or lose it', l: 'commitments are billed every hour whether used or not. Unused reservation hours and savings-plan dollars don’t roll over' },
      { v: 'alert ≠ cap', l: 'budgets send notifications (and can trigger action groups). They don’t stop resources or block spend on pay-as-you-go subscriptions' }
    ]
  },
  intro: {
    what: 'In Azure you pay for what you <b>provision</b> (a VM, an App Service plan, a Postgres server, an IP address, billed by the hour even when idle) and for what you <b>use</b> (storage GB, data sent out, log GB ingested, function executions, AI tokens). <b>Cost Management</b> shows where the money goes, <b>budgets</b> warn you, and <b>commitment discounts</b> (reservations, savings plans) lower the rate for usage you are sure will continue.',
    analogy: { icon: '🚕', title: 'Taxi, car lease or a train pass', text: 'Pay-as-you-go is a taxi: flexible, expensive per mile. A reservation is leasing one specific car for a year: cheapest if you drive it every day, wasted if it sits in the garage. A savings plan is a monthly travel budget you commit to spend across trains, buses and taxis. Spot is a cheap standby seat you lose when a paying passenger turns up.' },
    steps: [
      { t: 'See where the money goes', d: 'Cost Analysis grouped by service, resource group and tag. Tags (<code>app</code>, <code>env</code>, <code>owner</code>) are what make the bill readable.' },
      { t: 'Delete idle and orphaned resources', d: 'Unattached disks, unused public IPs, empty App Service plans, forgotten test environments.', code: "az graph query -q \"Resources | where type =~ 'microsoft.compute/disks' and properties.diskState =~ 'Unattached' | project name, resourceGroup, sku.name\"" },
      { t: 'Right-size and schedule', d: 'Smaller SKUs where CPU and memory are low, autoscale with scale-in, auto-shutdown for dev VMs, scale-to-zero where the platform supports it.' },
      { t: 'Commit to the floor', d: 'Buy reservations or a savings plan for usage that runs 24/7, not for the peak. Review utilization monthly.' },
      { t: 'Set budgets per subscription', d: 'Alerts at actual and forecasted thresholds, routed to the owning team.' }
    ],
    terms: [
      ['pay-as-you-go (PAYG)', 'The list rate, billed per second, hour or unit with no commitment.'],
      ['reservation', 'A 1- or 3-year commitment to a specific resource type in a region (VM size family, Postgres compute, Cosmos throughput…) for a lower rate.'],
      ['savings plan for compute', 'A 1- or 3-year commitment to spend a fixed amount per hour on eligible compute, applied across regions and services.'],
      ['Spot', 'Spare capacity at a deep discount that Azure can evict at short notice.'],
      ['Azure Hybrid Benefit', 'Use existing Windows Server or SQL Server licences to avoid paying for them again in Azure.'],
      ['budget', 'A spending threshold on a scope that sends alerts. It doesn’t stop anything.']
    ]
  },
  visual: {
    title: 'A day of compute, covered layer by layer',
    caption: 'Each bar is one hour of compute usage. Press Play to remove idle leaks, cover the 24/7 floor with a reservation, add a savings plan, see what over-committing wastes, and move the night batch to Spot. Rates are <b>illustrative</b> (PAYG 1.0, savings plan 0.75, reservation 0.6, Spot 0.2 per unit-hour), not real prices.'
  },
  gotchas: [
    { trap: '“Stopped” VMs still billed', code: `az vm stop -g rg-dev -n vm-build        # ✗ OS stopped, compute still allocated and billed
az vm deallocate -g rg-dev -n vm-build  # ✓ "Stopped (deallocated)": compute billing stops`, why: 'Shutting down from inside the OS, or <code>az vm stop</code>, keeps the hardware reserved, so compute charges continue. Only <b>deallocated</b> VMs stop compute billing. Disks are billed either way.', fix: 'Deallocate, use auto-shutdown for dev VMs, and find stopped-but-allocated VMs with Resource Graph (<code>PowerState/stopped</code>).' },
    { trap: 'Commitments bought at the peak', why: 'A savings plan or reservation is billed every hour for its term. Sized from a monthly average or a migration peak, it sits partly unused every night and weekend, and you can’t simply shrink it.', fix: 'Right-size first, then commit to the <b>floor</b> (the usage that is there every hour), and let growth absorb more later. Use the utilization reports and Advisor’s recommendations, and review them monthly.' },
    { trap: 'Budgets treated as a spending cap', why: 'A budget evaluates cost data that can lag by hours, then sends an email. By the time someone reads it, a runaway job may have run all weekend.', fix: 'Use forecasted thresholds as well as actual ones, route alerts to an action group (Teams, on-call, or automation that scales down dev), and add preventive controls: Azure Policy allowed SKUs, quotas, auto-shutdown.' },
    { trap: 'Hourly resources that look free when idle', why: 'An empty App Service plan, a Standard public IP, Application Gateway, Azure Firewall, Bastion, private endpoints, NAT gateway, AI Search replicas and provisioned (PTU) AI deployments all bill per hour whether or not traffic flows.', fix: 'Tear down dev environments with their IaC (<code>az stack … delete</code> or <code>terraform destroy</code>), share hubs (firewall, Bastion) across spokes, and tag everything with an owner and an expiry date.' },
    { trap: 'Spot for things that can’t be interrupted', why: 'Spot VMs and AKS Spot node pools can be evicted at short notice when Azure needs the capacity or the price exceeds your maximum. A stateful service or the only API replica on Spot is an outage generator.', fix: 'Use Spot for batch, CI agents, rendering and stateless workers with checkpointing. Keep a regular node pool for system pods and the critical path, and handle the eviction notice (Scheduled Events).' },
    { trap: 'Metered services nobody watches', why: 'Log Analytics ingestion (verbose logs, health probes), data transfer out of Azure and between regions, NAT gateway data processing, snapshots and long backup retention grow with usage, not with provisioning, so they surprise teams that only review SKUs.', fix: 'Review the top meters (Cost Analysis grouped by <i>meter</i>) monthly, sample telemetry at the source, keep chatty services in the same region, and set lifecycle rules on snapshots and blobs.' },
    { trap: 'Untagged resources nobody owns', why: 'Without <code>app</code>, <code>env</code> and <code>owner</code> tags, cost can only be grouped by resource group, and orphaned resources have nobody to ask.', fix: 'Require tags with Azure Policy (or inherit them from the resource group with a <i>modify</i> policy), and show cost by tag in team dashboards.' }
  ],
  scenarios: [
    { title: 'The dev subscription costs as much as production',
      symptom: 'The dev subscription’s monthly cost crept up to match production, with no new projects.',
      diagnose: `az graph query -q "
Resources
| where subscriptionId == '$DEV_SUB'
| where (type =~ 'microsoft.compute/disks' and properties.diskState =~ 'Unattached')
     or (type =~ 'microsoft.network/publicipaddresses' and isnull(properties.ipConfiguration) and isnull(properties.natGateway))
     or (type =~ 'microsoft.web/serverfarms' and toint(properties.numberOfSites) == 0)
| summarize n = count() by type" -o table`,
      cause: 'Hundreds of disks and public IPs left behind by deleted VMs and AKS test clusters, a dozen empty Premium App Service plans, and dev VMs running all weekend.',
      fix: 'Delete the orphans, deploy dev environments as stacks so they delete cleanly, add auto-shutdown and a policy that limits dev SKUs, and add a weekly orphan report.',
      fixCode: `az vm auto-shutdown -g rg-dev -n vm-build --time 1900
az stack group delete -g rg-dev-feature-x -n feature-x --action-on-unmanage deleteAll --yes` },
    { title: 'Savings plan utilization stuck at 60%',
      symptom: 'Finance bought a 3-year compute savings plan after the cloud migration. Cost Management shows utilization around 60%, and costs didn’t fall as forecast.',
      diagnoseLang: 'text',
      diagnose: 'Cost Management → Reservations + Savings plans → Utilization: high on weekdays 09:00–18:00, low at night and at weekends.\nCost Analysis, amortized view, grouped by pricing model: a large “unused savings plan” line.',
      cause: 'The hourly commitment was sized from average daily spend, which includes daytime peaks. At night actual usage falls below the commitment, and every unused hour is paid anyway. Autoscale scale-in, added later, lowered the floor further.',
      fix: 'The existing commitment can’t simply be reduced, so let growth absorb it, and move eligible PAYG workloads under it. Size future purchases from the <b>minimum</b> hourly usage over recent weeks, and stagger purchases instead of buying everything at once.' },
    { title: 'A load test left a provisioned AI deployment running for a month',
      symptom: 'An AI team’s subscription jumped sharply. Token usage was close to zero.',
      diagnose: `az cognitiveservices account deployment list -g rg-ai-dev -n aoai-dev \\
  --query "[].{name:name, sku:sku.name, capacity:sku.capacity}" -o table
# GlobalProvisionedManaged  ...  (billed per hour, used or not)`,
      cause: 'A <b>provisioned throughput</b> deployment created for a load test bills for reserved capacity every hour, regardless of traffic. Nobody deleted it, and the budget alert went to a shared mailbox.',
      fix: 'Delete it, use Standard (pay-per-token) deployments for dev and test, deny provisioned SKUs in non-production with Azure Policy, and send budget alerts to the owning team’s on-call channel.',
      fixCode: `az cognitiveservices account deployment delete -g rg-ai-dev -n aoai-dev --deployment-name gpt-loadtest` }
  ],
  puzzles: [
    { kind: 'calc', q: 'In one hour a workload uses 10 units of eligible compute. A reservation covers 6 units of that VM family. A savings plan’s hourly commitment covers 3 more units. How is the hour billed?', options: ['6 reserved + 3 savings plan + 1 PAYG', '10 units at savings-plan rate', '3 savings plan + 7 PAYG', '6 reserved + 4 PAYG'], answer: 0, explain: 'Azure applies <b>reservations first</b>, then the savings plan, then pay-as-you-go for whatever is left: 6 + 3 + 1.' },
    { kind: 'scenario', q: 'An engineer shuts down a VM from inside Windows at 18:00 and leaves it until Monday. Its status shows “Stopped”. What is billed over the weekend?', options: ['Nothing', 'Disks only', 'Only the public IP', 'Compute and disks'], answer: 3, explain: '“Stopped” (not “deallocated”) keeps the compute allocated, so <b>compute is still billed</b>, plus disks (and a Standard public IP if attached). Deallocate to stop compute charges.' },
    { kind: 'scenario', q: 'A subscription’s monthly budget reaches 100% on the 20th. What does Azure do?', options: ['Stops all resources', 'Sends the configured alerts (and runs any action group); resources keep running and billing', 'Switches resources to the free tier', 'Blocks new deployments'], answer: 1, explain: 'Budgets <b>notify</b>; they don’t cap spend. If you want something to happen, attach an action group that runs automation (scale down dev, notify on-call), and use preventive controls like Policy.' },
    { kind: 'calc', q: 'A build VM runs 8 hours a day, 5 days a week. Would a 1-year reservation for it save money?', options: ['Probably not: it runs about 40 of 168 hours (≈24%), and a reservation is billed every hour', 'Yes, reservations are always cheaper', 'Yes, if bought for 3 years', 'Only with Azure Hybrid Benefit'], answer: 0, explain: 'A reservation charges for every hour of the term. At ≈24% utilisation, the discount would have to exceed about 76% to break even. Deallocate it outside working hours and pay PAYG, or let a savings plan cover it as part of a larger floor.' },
    { kind: 'scenario', q: 'Which workload is the best fit for an AKS Spot node pool?', options: ['The Postgres primary (in a StatefulSet)', 'The ingress controller', 'Nightly report generation that checkpoints and retries', 'The only replica of the payment API'], answer: 2, explain: 'Spot capacity can be evicted at short notice. Batch work that can resume is ideal. Keep system pods, ingress and anything on the critical path on regular nodes (AKS taints Spot nodes so pods must opt in).' },
    { kind: 'scenario', q: 'You deleted a VM in the portal, but its resource group still costs money every day. The most likely leftovers?', options: ['The NIC and the VNet', 'Role assignments', 'The availability set', 'The managed OS/data disks and a Standard public IP'], answer: 3, explain: 'Unless you choose to delete them with the VM, <b>managed disks</b> and <b>public IPs</b> survive it and keep billing. NICs and VNets themselves are free (traffic and gateways aren’t).' },
    { kind: 'scenario', q: 'A savings plan’s hourly commitment is fully unused between 01:00 and 05:00 because autoscale scaled everything in. What happens to that unused commitment?', options: ['It rolls over to the next hour', 'It is lost: the commitment is billed each hour whether used or not', 'It is refunded at month end', 'It is applied to storage instead'], answer: 1, explain: 'Savings plans (and reservations) are <b>use it or lose it</b> per hour. That is why you size them to the floor of your usage, not the average.' }
  ],
  interview: [
    { q: 'Reservations vs savings plans: when do you use which?', a: '<p><b>Reservations</b> commit to a specific product (a VM size family in a region, Postgres or SQL compute, Cosmos throughput, Redis, storage capacity…) and usually give the deepest discount, but only for that product. <b>Savings plans for compute</b> commit to an hourly spend that applies across eligible compute services and regions, so they survive a move from VMs to App Service or between regions. Typical pattern: reservations for very stable, specific usage (databases, a fixed VM fleet), a savings plan for the remaining flexible compute floor, PAYG above it.</p>', lvl: 'core' },
    { q: 'How do you size a commitment?', a: '<p>After cleanup and right-sizing, look at hourly usage over several weeks and commit to the <b>floor</b> (the usage present nearly every hour), not the average. Use Advisor and Cost Management recommendations as a starting point, buy in tranches over time, choose scope (shared vs single subscription or resource group) to match how workloads move, and track utilisation monthly.</p>', lvl: 'deep' },
    { q: 'What are the most common Azure cost leaks you have seen?', a: '<ul><li>Orphaned managed disks, snapshots and public IPs after VM or cluster deletion.</li><li>Empty or oversized App Service plans; dev environments running 24/7.</li><li>Log Analytics ingestion: DEBUG logs, health probes, duplicate telemetry.</li><li>Hourly network and security appliances per environment (firewall, App Gateway, Bastion, NAT, private endpoints).</li><li>Provisioned capacity left idle: Cosmos RU, AI Search replicas, provisioned AI throughput.</li><li>Data transfer: cross-region chatter and egress to the internet.</li></ul>', lvl: 'core' },
    { q: 'How do you make cost visible to engineering teams?', a: '<p>Tag policy (<code>app</code>, <code>env</code>, <code>owner</code>, <code>costCenter</code>) enforced or inherited with Azure Policy; a subscription or resource-group structure that mirrors ownership; budgets per team with forecast alerts to their channels; scheduled Cost Management exports to storage for showback dashboards; and cost per unit of business (cost per order) next to the latency charts.</p>', lvl: 'core' },
    { q: 'When is Spot the right choice, and how do you make it safe?', a: '<p>For interruptible, stateless or checkpointed work: batch, CI build agents, data processing, test environments. Make it safe by handling the eviction notice (Scheduled Events on VMs; AKS drains Spot nodes), keeping work idempotent and resumable, mixing Spot with regular capacity, and never putting the only replica of something critical on Spot.</p>', lvl: 'core' },
    { q: 'What does “amortized cost” mean in Cost Management?', a: '<p>The <b>actual</b> view shows commitment purchases as they are charged (a lump sum, or monthly). The <b>amortized</b> view spreads the commitment cost over its term and assigns it to the resources that used the benefit, and shows unused commitment separately. Use amortized cost for showback and unit economics, and actual cost for cash flow.</p>', lvl: 'deep' },
    { q: 'How do architecture decisions show up on the bill?', a: '<p>Always-on vs scale-to-zero compute (App Service plan vs Container Apps consumption or Functions), zone redundancy and geo-replication (more instances, more data transfer), private networking (endpoint and DNS hours, NAT, firewall), observability volume, and data placement (cross-region calls pay egress). Name the trade-off explicitly: for example, zone redundancy for the order API is worth it; for the internal admin tool, maybe not.</p>', lvl: 'deep' },
    { q: 'What preventive guardrails would you put on a dev subscription?', a: '<p>Azure Policy allowed SKUs and regions, deny for provisioned or premium SKUs, required owner and expiry tags, auto-shutdown on VMs, budgets with action groups, environments deployed from IaC so they can be destroyed, and Dev/Test pricing where eligible.</p>', lvl: 'core' },
    { q: 'How do you approach a “cut the bill by 30%” request?', a: '<ol><li>Break down the bill by service, meter and owner; find the top 10 lines.</li><li>Delete idle and orphaned resources (quick wins).</li><li>Right-size and schedule (non-production off at night).</li><li>Fix architecture hot spots (logs, egress, always-on compute that could scale to zero).</li><li>Commit to the steady floor.</li><li>Lock in with budgets, policy and a monthly review, so it doesn’t creep back.</li></ol>', lvl: 'core' }
  ],
  code: [
    { title: 'Resource Graph: find the leaks', lang: 'kql', code: `// run with: az graph query -q "<query>" --first 1000 -o table
// 1) unattached managed disks
Resources
| where type =~ 'microsoft.compute/disks' and properties.diskState =~ 'Unattached'
| project name, resourceGroup, sku = tostring(sku.name), sizeGB = toint(properties.diskSizeGB)

// 2) public IPs attached to nothing
Resources
| where type =~ 'microsoft.network/publicipaddresses'
| where isnull(properties.ipConfiguration) and isnull(properties.natGateway)
| project name, resourceGroup, sku = tostring(sku.name)

// 3) App Service plans with no apps
Resources
| where type =~ 'microsoft.web/serverfarms' and toint(properties.numberOfSites) == 0
| project name, resourceGroup, sku = tostring(sku.name)

// 4) VMs stopped but not deallocated (still billed for compute)
Resources
| where type =~ 'microsoft.compute/virtualmachines'
| where tostring(properties.extended.instanceView.powerState.code) == 'PowerState/stopped'
| project name, resourceGroup` },
    { title: 'Bicep: budget with actual and forecast alerts', lang: 'bicep', code: `targetScope = 'subscription'

param amount int = 5000
param startDate string = '2026-12-01'          // first day of a month
param teamEmails array
param actionGroupId string

resource budget 'Microsoft.Consumption/budgets@2023-05-01' = {
  name: 'budget-orders-prod'
  properties: {
    category: 'Cost'
    amount: amount
    timeGrain: 'Monthly'
    timePeriod: { startDate: startDate }
    notifications: {
      actual80: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        thresholdType: 'Actual'
        contactEmails: teamEmails
      }
      forecast100: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Forecasted'          // warns before the money is spent
        contactEmails: teamEmails
        contactGroups: [ actionGroupId ]      // e.g. scale down dev, page the owner
      }
    }
  }
}`, note: 'Amounts are in the billing currency. A budget never stops resources by itself.' },
    { title: 'Spot node pool and auto-shutdown', code: `# AKS: a Spot pool that scales to zero; AKS taints Spot nodes so only pods that tolerate it land there
az aks nodepool add -g rg-orders-prod --cluster-name aks-orders -n spotbatch \\
  --priority Spot --eviction-policy Delete --spot-max-price -1 \\
  --enable-cluster-autoscaler --min-count 0 --max-count 10 \\
  --node-vm-size Standard_D4s_v5

# pods opt in with a toleration for:
#   kubernetes.azure.com/scalesetpriority=spot:NoSchedule

# dev VM: deallocate every evening
az vm auto-shutdown -g rg-dev -n vm-build --time 1900 --email dev-team@example.com`, note: '<code>--spot-max-price -1</code> means “pay up to the regular price, evict only for capacity”.' }
  ]
});

IA.register({
  track: 'azure',
  slug: 'azure-hierarchy',
  title: 'Tenants to resources',
  tagline: 'Azure is a <b>tree of scopes</b>: Entra tenant → management groups → subscriptions → resource groups → resources. Every permission, policy, lock and bill attaches to a node in that tree and flows <b>down</b>. Every change goes through one door: <b>Azure Resource Manager</b>.',
  tldr: {
    problem: 'Teams click resources into one giant subscription. Then nobody can answer “who can delete prod?”, “why was my deploy denied?” or “what does this team cost?”.',
    model: 'Four nested scopes under one identity directory. Assignments made at a scope are <b>inherited</b> by everything below it. Every create, update and delete is an HTTPS call to ARM, which authenticates you with Entra, checks RBAC, Policy and locks, and then hands the request to a resource provider.',
    hook: '“Where would you put a policy that forbids public IPs for all app teams but not for the network team?” On the landing-zones management group, not on the root and not on each subscription.',
    facts: [
      { v: '1 tenant', l: 'per subscription. A subscription trusts exactly one Entra tenant; a tenant can hold many subscriptions' },
      { v: '6 levels', l: 'of management groups below the tenant root group (per Microsoft Learn), and each node has a single parent' },
      { v: '1 RG', l: 'per resource. A resource lives in exactly one resource group, and deleting the group deletes everything in it' }
    ]
  },
  intro: {
    what: 'Before you can create anything in Azure, you need somewhere to put it and someone allowed to do it. Azure organises everything as a <b>tree</b>. At the top is your company’s <b>directory</b> of people and apps (the Entra tenant). Below it are folders for governance (<b>management groups</b>), then billing accounts (<b>subscriptions</b>), then project folders (<b>resource groups</b>), and finally the actual things: databases, web apps and vaults (<b>resources</b>).',
    analogy: { icon: '🏢', title: 'A company building', text: 'The tenant is the building’s badge system: it knows who everyone is. Management groups are floors with house rules (“no smoking on floor 3”). Subscriptions are departments with their own budget. Resource groups are project rooms that get cleared out together. A rule set for a floor applies in every room on it.' },
    steps: [
      { t: 'Identity first: the tenant', d: 'Microsoft Entra ID (formerly Azure AD) holds users, groups and app identities. Signing in to Azure means signing in to a tenant.' },
      { t: 'Governance: management groups', d: 'Group subscriptions so that one policy or role assignment covers many of them at once.' },
      { t: 'Billing and limits: subscriptions', d: 'Costs, quotas (for example, how many vCPUs you can run per region) and a hard isolation boundary.', code: 'az account list -o table\naz account set --subscription sub-orders-prod' },
      { t: 'Lifecycle: resource groups and resources', d: 'Create a group, deploy into it, delete it when the project ends.', code: 'az group create -n rg-orders-dev -l westeurope\naz group delete -n rg-orders-dev --yes   # deletes every resource inside' }
    ],
    terms: [
      ['Entra ID tenant', 'The identity directory. It has a tenant ID (a GUID) and domains such as <code>corp.onmicrosoft.com</code>.'],
      ['management group', 'A container of subscriptions (and other MGs) used for policy and access at scale.'],
      ['subscription', 'A billing and quota unit that trusts one tenant. Most limits are “per subscription per region”.'],
      ['resource group (RG)', 'A logical folder for resources that share a lifecycle. It is not a network boundary.'],
      ['ARM', 'Azure Resource Manager: the control-plane API at <code>management.azure.com</code> that every tool calls.'],
      ['resource ID', 'The full path to a resource, for example <code>/subscriptions/…/resourceGroups/…/providers/…</code>.']
    ]
  },
  visual: {
    title: 'Build the tree, then follow one ARM request',
    caption: '<b>Hierarchy</b> builds the scopes level by level and shows what an assignment at a management group reaches. The three <b>ARM</b> modes send one <code>PUT</code> through Entra, RBAC, Policy and the resource provider, and show where a 403 comes from. Use Play, or Step to go one stage at a time.'
  },
  gotchas: [
    { trap: 'Moving a subscription to another tenant wipes its access', why: 'Role assignments point to principals in the old tenant. When a subscription changes directory, its RBAC assignments are deleted, and system-assigned managed identities and Key Vault access need to be rebuilt.', fix: 'Treat a tenant move as a migration project. Export role assignments first (<code>az role assignment list --all</code>), then re-create the identities and assignments in the new tenant.' },
    { trap: 'Using resource groups as a security or network boundary', why: 'An RG doesn’t isolate traffic. Two RGs in the same VNet talk freely, and anyone with Contributor on the subscription can manage both.', fix: 'Use subscriptions for hard isolation, VNets and NSGs for network isolation, and RGs for <i>lifecycle</i>: things deployed and deleted together.' },
    { trap: 'Assigning policies and roles at the Tenant root group “to be safe”', code: `az role assignment create --assignee dev-team@corp.com \\
  --role Contributor \\
  --scope /providers/Microsoft.Management/managementGroups/<tenant-id>   # every subscription, forever`, why: 'Everything inherits from the root, including sandbox and platform subscriptions you haven’t created yet. A broad Contributor or Deny here has the widest possible blast radius.', fix: 'Keep the root nearly empty. Assign at the platform or landing-zone management groups, and use the root only for a few organisation-wide guardrails.' },
    { trap: 'The RG region doesn’t decide where resources run', why: 'The resource group’s location only stores its metadata. A resource in a <code>westeurope</code> RG can be deployed to <code>eastus</code> unless a policy stops it. If the RG’s region is down, you may be unable to manage the resources in it, even though they keep running.', fix: 'Put the RG in the same region as its main resources, and enforce regions with an “Allowed locations” policy.' },
    { trap: 'A delete lock blocks more than deletes', why: 'A <code>ReadOnly</code> lock blocks every write through ARM, and some operations that look like reads are POSTs, such as listing storage account keys. That can break the portal and deployments in surprising ways. Locks inherit down the tree, and they don’t stop data-plane operations such as deleting blobs.', fix: 'Prefer <code>CanNotDelete</code> on production RGs. Document locks in your IaC, and remember who can remove them: anyone with <code>Microsoft.Authorization/locks/*</code> (Owner, or User Access Administrator).' },
    { trap: 'Hitting a per-subscription quota during an incident', why: 'vCPU quotas per VM family and region, public IP limits and similar caps are per subscription. A scale-out during a spike can fail with <code>QuotaExceeded</code>.', fix: 'Check <code>az vm list-usage -l westeurope -o table</code> and request quota increases ahead of time. Splitting workloads across subscriptions also splits quotas.' }
  ],
  scenarios: [
    { title: 'Deploy pipeline suddenly fails with RequestDisallowedByPolicy',
      symptom: 'A Bicep deploy that worked yesterday now fails for every app team. Nothing changed in the app repos.',
      diagnose: `az deployment group show -g rg-orders-prod -n main --query properties.error
# → "RequestDisallowedByPolicy ... policyAssignmentName: deny-public-ip"
az policy assignment list --disable-scope-strict-match \\
  --scope /subscriptions/<sub-id> --query "[].{name:name, scope:scope}" -o table`,
      cause: 'The platform team assigned “Deny public IPs” at <code>mg-landing-zones</code>. It is inherited by every subscription below, and the app template still creates a public IP for a jump box.',
      fix: 'Remove the public IP and use Bastion or a private endpoint instead. If a team needs an exception, create a time-boxed <b>policy exemption</b> at its RG rather than editing the shared assignment.',
      fixCode: `az policy exemption create -n jumpbox-temp \\
  --policy-assignment <assignment-id> \\
  --exemption-category Waiver \\
  --expires-on 2026-12-31T00:00:00Z \\
  --scope /subscriptions/<sub-id>/resourceGroups/rg-orders-prod` },
    { title: 'Someone deleted the dev resource group, and it took the shared Key Vault with it',
      symptom: 'Dev apps fail at startup with Key Vault 404s. The vault lived in <code>rg-orders-dev</code>, which was deleted during a clean-up.',
      diagnose: `az monitor activity-log list --resource-group rg-orders-dev --offset 2d \\
  --query "[?operationName.value=='Microsoft.Resources/subscriptions/resourceGroups/delete']"
az keyvault list-deleted -o table   # soft-deleted vaults are recoverable`,
      cause: 'Shared infrastructure sat in an app’s lifecycle group. The RG boundary meant “delete together”, which was the wrong grouping.',
      fix: 'Recover the soft-deleted vault, move shared services into their own RG (or a platform subscription), and put a <code>CanNotDelete</code> lock on it.',
      fixCode: `az keyvault recover --name kv-orders-shared
az group create -n rg-shared -l westeurope
az resource move --destination-group rg-shared --ids $(az keyvault show -n kv-orders-shared --query id -o tsv)
az lock create -n no-delete -g rg-shared --lock-type CanNotDelete` },
    { title: 'Scale-out failed during a traffic spike',
      symptom: 'The autoscale rule fired, but no new VMs appeared. The activity log shows <code>OperationNotAllowed … exceeding approved Standard DSv5 Family Cores quota</code>.',
      diagnose: `az vm list-usage -l westeurope -o table | grep -i dsv5`,
      cause: 'Dev, test and prod shared one subscription, so test load jobs had used up the regional vCPU quota.',
      fix: 'Request a quota increase, and split environments into separate subscriptions so each one has its own quotas and blast radius.' }
  ],
  puzzles: [
    { kind: 'scenario', q: 'You need a rule that forbids deploying outside EU regions for <b>all</b> app subscriptions, including ones that will be created next year. Where do you assign it?', options: ['On each subscription when it is created', 'On the landing-zones management group that the app subscriptions sit under', 'On every resource group', 'In each app’s Bicep template'], answer: 1, explain: 'Assignments inherit down the tree. A new subscription placed under that management group gets the policy automatically. Per-subscription or per-template rules rely on someone remembering to add them.' },
    { kind: 'predict', q: 'A resource group was created in <code>westeurope</code>. A template deploys a storage account into it with <code>location: \'eastus\'</code>, and no policy applies. What happens?', options: ['Deployment fails: resources must match the RG region', 'The account is created in westeurope instead', 'The account is created in eastus', 'The RG is moved to eastus'], answer: 2, explain: 'The RG’s location only stores the group’s metadata. Resources can be in any region. Use an “Allowed locations” policy if you want to restrict that.' },
    { kind: 'scenario', q: 'Which boundary gives you a separate bill, separate quotas and the hardest isolation between two workloads?', options: ['Resource group', 'Subscription', 'Management group', 'Tag'], answer: 1, explain: 'A subscription is the billing, quota and access boundary. Management groups only <i>group</i> subscriptions. RGs and tags organise resources inside one subscription.' },
    { kind: 'predict', q: 'Alice has <b>Reader</b> on management group <code>mg-landing-zones</code> and <b>Contributor</b> on <code>rg-orders-prod</code>, which sits under it. What can she do to the web app in that RG?', options: ['Only read it: the higher scope wins', 'Read and modify it: permissions are the union of all assignments on the path', 'Nothing: conflicting assignments cancel out', 'Modify it, but only after the Reader assignment is removed'], answer: 1, explain: 'RBAC is additive. The effective permissions are the union of every role assigned at the resource and all its parents. Only a <i>deny assignment</i> can subtract.' },
    { kind: 'scenario', q: 'A deploy gets <code>403 AuthorizationFailed</code>. Which component rejected it?', options: ['The resource provider', 'Azure Policy', 'ARM’s RBAC check', 'Entra ID token issuance'], answer: 2, explain: '<code>AuthorizationFailed</code> means no role grants the action at that scope. A Policy block shows up as <code>RequestDisallowedByPolicy</code>, and a failed sign-in fails before ARM is ever called.' },
    { kind: 'scenario', q: 'An app’s database, cache and Key Vault are deployed and torn down together per environment. The network hub is shared by all apps. How should you group them?', options: ['Everything in one RG per environment', 'App resources in a per-environment RG; the hub in its own RG, ideally in a connectivity subscription', 'One RG per resource type', 'One RG per region for the whole company'], answer: 1, explain: 'Group by lifecycle. Shared infrastructure shouldn’t be deleted with one app, and a hub usually belongs in a platform/connectivity subscription with its own owners.' }
  ],
  interview: [
    { q: 'Walk me through the Azure resource hierarchy and what each level is for.', a: '<p><b>Entra tenant</b>: identity. <b>Management groups</b>: governance at scale (policy and RBAC for many subscriptions). <b>Subscriptions</b>: billing, quotas and the isolation boundary. <b>Resource groups</b>: lifecycle containers. <b>Resources</b>: the actual services. Assignments inherit downward, and each resource ID encodes its path.</p>', lvl: 'core' },
    { q: 'Why not just put everything in one subscription with lots of resource groups?', a: '<ul><li>Quotas are per subscription per region, so one noisy environment starves the others.</li><li>Cost reporting and budgets are harder to split.</li><li>RBAC at subscription scope gives too much reach.</li><li>The blast radius of a mistake, a policy or a compromised identity is everything.</li></ul><p>Landing-zone guidance favours a subscription per workload and environment, created by automation.</p>', fu: 'What is subscription vending? (Automated creation of a subscription, already placed in the right MG with networking, budgets and RBAC.)', lvl: 'core' },
    { q: 'What exactly is ARM, and why does it matter to an architect?', a: '<p>Azure Resource Manager is the single control-plane API. The portal, CLI, PowerShell, SDKs, Bicep and Terraform all send REST calls to it. Because there is one front door, authentication, RBAC, Policy, locks, the activity log and template deployments behave the same whatever tool you use.</p>', lvl: 'core' },
    { q: 'Control plane vs data plane: give an example.', a: '<p>Creating a storage account or setting its firewall is a control-plane call to <code>management.azure.com</code>. Reading a blob is a data-plane call to <code>&lt;account&gt;.blob.core.windows.net</code>, with its own token audience and its own RBAC data actions. Owner on the subscription doesn’t, by itself, include blob <i>data</i> actions.</p>', lvl: 'deep' },
    { q: 'How do management groups and subscriptions relate to the Entra tenant?', a: '<p>Every management group and subscription belongs to exactly one tenant. The tenant root group’s ID equals the tenant ID. You can’t span one MG tree across tenants. Multi-tenant estates need a separate hierarchy per tenant, plus Azure Lighthouse or guest access for cross-tenant management.</p>', lvl: 'deep' },
    { q: 'What happens when you move a resource to another resource group or subscription?', a: '<p>The resource ID changes, because the ID contains the RG and subscription. Anything that references the old ID breaks: scripts, diagnostic settings, role assignments scoped to the resource, and alerts. Not every resource type supports moves. Validate first with <code>az resource invoke-action --action validateMoveResources</code> or the portal’s move validation.</p>', lvl: 'deep' },
    { q: 'What are resource locks, and what don’t they protect against?', a: '<p><code>CanNotDelete</code> and <code>ReadOnly</code> apply to control-plane operations and inherit down the tree. They don’t stop data-plane actions such as deleting rows, blobs or secrets, and anyone with lock-management rights can remove them. Use them as a seatbelt, not as security.</p>', lvl: 'core' },
    { q: 'How would you design the management-group tree for a mid-size company?', a: '<p>Follow the Azure landing zone pattern: root → an organisation MG → <i>Platform</i> (identity, management, connectivity) and <i>Landing zones</i> (corp for internal, online for internet-facing) → <i>Sandbox</i> and <i>Decommissioned</i>. Keep it shallow, and shape it by the policies each branch needs.</p>', fu: 'Why not one MG per department? (Org charts change and policies rarely differ by department, so you end up re-parenting subscriptions.)', lvl: 'deep' },
    { q: 'What deployment scopes can a Bicep or ARM template target?', a: '<p>Resource group, subscription, management group and tenant: <code>az deployment group|sub|mg|tenant create</code>. Use subscription scope to create RGs and policy assignments, and MG scope for policy definitions and assignments across subscriptions.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Explore scopes with az', lang: 'bash', code: `# where am I?
az account show --query "{tenant:tenantId, sub:name, id:id}"

# management-group tree (needs read access on the MGs)
az account management-group show --name mg-landing-zones --expand --recurse \\
  --query "children[].{name:name, type:type}" -o table

# place a new subscription under a management group
az account management-group subscription add \\
  --name mg-landing-zones --subscription sub-orders-prod

# every resource ID encodes its scope path
az resource list -g rg-orders-prod --query "[].id" -o tsv`, note: 'An ID such as <code>/subscriptions/&lt;id&gt;/resourceGroups/rg-orders-prod/providers/Microsoft.Web/sites/app-orders</code> is also the <code>--scope</code> value for role assignments.' },
    { title: 'Subscription-scope Bicep: RG + lock', lang: 'bicep', code: `targetScope = 'subscription'

param env string = 'prod'
param location string = 'westeurope'

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-orders-\${env}'
  location: location
  tags: { app: 'orders', env: env, owner: 'team-orders' }
}

module app 'app.bicep' = {
  name: 'orders-app'
  scope: rg                       // deploy the app into the new RG
  params: { location: location }
}

// deploy with: az deployment sub create -l westeurope -f main.bicep`, note: 'Locks are extension resources. Declare them inside the RG-scoped module (<code>Microsoft.Authorization/locks</code> with <code>level: \'CanNotDelete\'</code>) so they are part of your IaC.' },
    { title: 'Read the hierarchy from Java', lang: 'java', code: `// com.azure.resourcemanager:azure-resourcemanager + azure-identity
TokenCredential cred = new DefaultAzureCredentialBuilder().build();
AzureProfile profile = new AzureProfile(AzureEnvironment.AZURE);   // tenant/sub from env

AzureResourceManager arm = AzureResourceManager
    .authenticate(cred, profile)
    .withSubscription(System.getenv("AZURE_SUBSCRIPTION_ID"));

arm.resourceGroups().list().forEach(rg ->
    System.out.printf("%s  %s  %s%n", rg.name(), rg.region(), rg.tags()));`, note: 'This is a control-plane client: its token audience is <code>management.azure.com</code>. Data-plane clients (Blob, Key Vault) take the same credential but request different audiences.' }
  ]
});

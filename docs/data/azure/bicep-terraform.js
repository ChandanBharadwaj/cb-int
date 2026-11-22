IA.register({
  track: 'azure',
  slug: 'bicep-terraform',
  title: 'Bicep & Terraform',
  tagline: '<b>Bicep</b> is a friendlier language for ARM: it compiles to ARM JSON, and Azure Resource Manager compares the template with what is deployed. There is no state file. <b>Terraform</b> keeps a <b>state file</b> and diffs your code against it, after refreshing it from Azure. Both give you a preview (<b>what-if</b> / <b>plan</b>), and both are how you notice that someone “just fixed it in the portal”.',
  tldr: {
    problem: 'Environments that drift apart, a portal hotfix silently undone by the next deploy, a “cleanup” deployment that deletes another team’s storage account, and a Terraform state blob holding plaintext secrets.',
    model: '<b>Bicep</b>: <code>.bicep</code> → <code>bicep build</code> → ARM JSON → Resource Manager deploys it (modules become nested deployments). <b>what-if</b> = template vs live resources. <b>Terraform</b>: config + state → <code>plan</code> refreshes state from Azure, then diffs config against it → <code>apply</code>. Drift = live ≠ code.',
    hook: '“Bicep or Terraform?” Bicep if you are Azure-only and want day-zero API coverage with no state to manage. Terraform if you span clouds or SaaS providers, or the team already runs it well. Either way: one tool owns each resource, every change goes through a preview, and nobody edits production in the portal.',
    facts: [
      { v: 'no state', l: 'in Bicep/ARM: Azure itself is the source of truth. Terraform keeps a state file (usually a blob, locked with a lease)' },
      { v: 'Incremental', l: 'is the default ARM deployment mode: resources not in the template are left alone. <b>Complete</b> mode deletes them (resource-group scope)' },
      { v: 'what-if / plan', l: 'show Create, Delete, Modify, NoChange and Ignore (or <code>+ − ~</code>) before anything changes. Make them a required pipeline step' }
    ]
  },
  intro: {
    what: '<b>Infrastructure as code</b> (IaC) means describing your Azure resources (a Postgres server, an App Service, the role assignments between them) in text files that live in Git, and letting a tool create or update them. <b>ARM templates</b> are Azure’s native JSON format. <b>Bicep</b> is a cleaner language that compiles to ARM. <b>Terraform</b> is HashiCorp’s multi-cloud tool; its <code>azurerm</code> provider talks to the same Azure APIs.',
    analogy: { icon: '🏗️', title: 'Architect’s drawings vs the building', text: 'The Bicep or Terraform files are the drawings. <i>what-if</i> or <i>plan</i> is walking the site with the drawings and listing every difference before the builders start. Drift is the tenant who knocked down a wall without telling anyone. Terraform also keeps a notebook (the state file) of what it built last time; Bicep just looks at the building.' },
    steps: [
      { t: 'Describe resources', d: 'A resource is a type, an API version, a name and properties.', code: "resource st 'Microsoft.Storage/storageAccounts@2023-05-01' = {\n  name: 'storders${uniqueString(resourceGroup().id)}'\n  location: resourceGroup().location\n  sku: { name: 'Standard_ZRS' }\n  kind: 'StorageV2'\n  properties: { allowSharedKeyAccess: false, minimumTlsVersion: 'TLS1_2' }\n}", lang: 'bicep' },
      { t: 'Preview the change', d: 'what-if asks Azure what would change, without changing anything.', code: 'az deployment group what-if -g rg-orders-prod -f main.bicep -p env=prod' },
      { t: 'Deploy', d: 'Resource Manager creates or updates resources in dependency order, in parallel where it can.', code: 'az deployment group create -g rg-orders-prod -f main.bicep -p env=prod' },
      { t: 'Run it from a pipeline, not a laptop', d: 'CI runs what-if or plan on every pull request and deploys after review, with a federated identity (see <a href="devops-pipelines.html">CI/CD pipelines</a>).' }
    ],
    terms: [
      ['ARM template', 'Azure Resource Manager’s JSON format. Every Azure deployment ends up as ARM.'],
      ['module', 'A reusable Bicep file (or Terraform module) with parameters and outputs. Bicep modules can come from a registry such as Azure Verified Modules.'],
      ['state file', 'Terraform’s record of what it manages and the last known attributes. Bicep has none.'],
      ['what-if / plan', 'A dry run that lists the changes a deployment would make.'],
      ['drift', 'The live resource no longer matches the code, usually because someone changed it by hand.'],
      ['deployment stack', 'An Azure resource that tracks what a deployment created, so it can delete or protect resources that leave the template.']
    ]
  },
  visual: {
    title: 'Compile, preview, deploy, drift',
    caption: '<b>Bicep → ARM → what-if</b>: watch the file compile to ARM JSON, Resource Manager compare it with the live resource group, and each change type appear before the deploy. The last step shows what <b>Complete</b> mode would do. <b>Drift</b>: a portal hotfix changes a live resource; see how Bicep’s what-if and Terraform’s plan each notice it.'
  },
  gotchas: [
    { trap: '<code>--mode Complete</code> as a cleanup tool', code: `az deployment group create -g rg-shared -f app.bicep --mode Complete   # ✗ deletes everything else in rg-shared`, why: 'In Complete mode, Resource Manager deletes every resource in the resource group that isn’t in the template. Another team’s resources, or ones created by a different template, disappear.', fix: 'Stay in Incremental mode. To delete what you removed from your own template, use a <b>deployment stack</b> (<code>--action-on-unmanage deleteResources</code>), which only touches resources it created. Add <code>CanNotDelete</code> locks to critical shared resources.' },
    { trap: '<code>PrincipalNotFound</code> on the first deploy only', code: `resource ra 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, uami.id, kvSecretsUser)     // deterministic, so redeploys are idempotent
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUser)
    principalId: uami.properties.principalId
    principalType: 'ServicePrincipal'          // ✓ avoids waiting for Entra replication
  }
}`, lang: 'bicep', why: 'A new managed identity takes a moment to replicate in Entra ID. Without <code>principalType</code>, ARM looks the principal up and fails. The second run works, which hides the bug in dev and breaks the first production deploy.', fix: 'Always set <code>principalType</code>. Name role assignments with <code>guid(scope, principal, role)</code> from values known at compile time; a random name makes redeploys fail with “role assignment already exists”.' },
    { trap: 'Secrets in outputs, deployment history and state', why: 'Bicep outputs (for example <code>listKeys(…)</code>) are stored in the deployment history, readable by anyone with read access to the resource group. Terraform state stores attribute values, including generated passwords and keys, in plain JSON.', fix: 'Don’t output secrets; use managed identities, or write secrets straight into Key Vault inside the template and output only names. Keep Terraform state in a private storage account with Entra auth, RBAC and versioning.' },
    { trap: 'Renaming in Terraform means destroy and create', code: `# was: resource "azurerm_storage_account" "logs" { ... }
resource "azurerm_storage_account" "audit" { ... }

moved {                      # Terraform 1.1+
  from = azurerm_storage_account.logs
  to   = azurerm_storage_account.audit
}`, lang: 'text', why: 'Terraform tracks resources by address. A new address with no history means “create the new one, destroy the old one”. The same happens when you change an attribute that forces replacement (shown as <code>-/+</code>), such as a name or location.', fix: 'Use a <code>moved</code> block for refactors, read every <code>-/+</code> in the plan, and put <code>lifecycle { prevent_destroy = true }</code> on stateful resources.' },
    { trap: 'Trusting a noisy what-if, or ignoring it', why: 'what-if sometimes reports <code>Modify</code> for properties that the resource provider normalises (casing, defaults) and can’t evaluate values only known during deployment. Teams learn to skim it, and then miss the one real <code>Delete</code>.', fix: 'Use <code>--exclude-change-types NoChange Ignore</code>, and fail the pipeline (or require approval) when the result contains <code>Delete</code>. Use <code>--result-format ResourceIdOnly</code> for a compact summary.' },
    { trap: 'Azure Policy and Terraform fight over tags', why: 'A <i>modify</i> policy adds a <code>CostCenter</code> tag. The next <code>terraform plan</code> wants to remove it, apply removes it, and the policy adds it back: a permanent diff.', fix: 'Either declare the tag in Terraform, or ignore that key: <code>lifecycle { ignore_changes = [tags["CostCenter"]] }</code>. Decide which tool owns each attribute.' },
    { trap: 'Two tools, one resource', why: 'Terraform owns the App Service, but a Bicep template (or the portal) sets its app settings. Each run of one tool reverts the other’s changes.', fix: 'One owner per resource. Terraform can read others’ resources with <code>data</code> sources, and Bicep can read them with <code>existing</code>, without managing them.' }
  ],
  scenarios: [
    { title: 'A “tidy-up” deployment deleted the platform team’s storage account',
      symptom: 'After a pipeline change, a shared resource group lost a storage account and a private DNS zone link that nobody in the app team had created.',
      diagnose: `az monitor activity-log list -g rg-shared --offset 2d \\
  --query "[?contains(operationName.value, '/delete')].{op:operationName.value, by:caller, at:eventTimestamp}" -o table
az deployment group list -g rg-shared --query "[].{name:name, mode:properties.mode}" -o table   # Complete`,
      cause: 'Someone set <code>--mode Complete</code> so that resources removed from the app’s template would be deleted. Complete mode deletes <i>everything</i> in the resource group that isn’t in the template.',
      fix: 'Recover what you can (backups, soft delete where the service has it, re-deploy from the owner’s IaC). Then switch to a deployment stack, which only deletes resources it manages, and lock shared resources. Better still, give each app its own resource group.',
      fixCode: `az stack group create -g rg-orders-prod -n orders \\
  --template-file main.bicep --parameters env=prod \\
  --action-on-unmanage deleteResources \\
  --deny-settings-mode denyDelete
az lock create -g rg-shared -n keep-shared --lock-type CanNotDelete` },
    { title: 'Every night, the drift check wants to remove a tag',
      symptom: 'A scheduled <code>terraform plan -detailed-exitcode</code> exits with 2 (“changes”) every night, so the team stopped reading it. A real drift (TLS lowered to 1.0 in the portal) went unnoticed for weeks.',
      diagnose: `terraform plan -detailed-exitcode -out tfplan; echo "exit=$?"
terraform show -json tfplan | jq '.resource_changes[] | select(.change.actions != ["no-op"]) | {address, actions: .change.actions}'`,
      cause: 'An Azure Policy with a <i>modify</i> effect adds a <code>CostCenter</code> tag, so the plan always shows a diff. The noise hid a real change.',
      fix: 'Declare the policy-owned tag in <code>ignore_changes</code> (or set it in code), so a clean environment plans to “no changes”. Then treat exit code 2 as an alert, and fix the TLS drift in code before re-applying.',
      fixCode: `resource "azurerm_linux_web_app" "orders" {
  # ...
  site_config { minimum_tls_version = "1.2" }
  lifecycle {
    ignore_changes = [tags["CostCenter"]]   # owned by Azure Policy
  }
}`,
      fixLang: 'text' },
    { title: 'Production deploy failed on a role assignment that worked in dev',
      symptom: 'The first deploy to a new production subscription failed with <code>PrincipalNotFound</code> on a Key Vault role assignment. Re-running the pipeline succeeded.',
      diagnose: `az deployment group show -g rg-orders-prod -n main \\
  --query "properties.error.details[].{code:code, msg:message}"`,
      cause: 'The template created a user-assigned managed identity and assigned it a role in the same deployment. Without <code>principalType</code>, ARM looked up the new principal before Entra ID had replicated it.',
      fix: 'Set <code>principalType: \'ServicePrincipal\'</code> on every role assignment for a managed identity, and use a deterministic <code>guid()</code> name.',
      fixCode: `properties: {
  roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', role)
  principalId: uami.properties.principalId
  principalType: 'ServicePrincipal'
}`,
      fixLang: 'bicep' }
  ],
  puzzles: [
    { kind: 'predict', q: 'Resource group <code>rg-app</code> contains A, B and C. <code>main.bicep</code> declares A and B. What happens to C with <code>az deployment group create … --mode Complete</code>?', options: ['Nothing, Bicep never deletes', 'C is deleted', 'The deployment fails because C is unknown', 'C is detached and tagged'], answer: 1, explain: 'Complete mode makes the resource group match the template exactly, so <b>C is deleted</b>. In the default Incremental mode C is left alone and what-if lists it as <code>Ignore</code>.' },
    { kind: 'predict', q: 'In Incremental mode, what-if lists a resource that exists in the resource group but not in your template. Which change type?', options: ['Ignore', 'NoChange', 'Delete', 'Modify'], answer: 0, explain: '<code>Ignore</code>: the resource exists, the template doesn’t mention it, and an incremental deployment won’t touch it. That is also why what-if is not a full drift detector: it can’t tell a forgotten resource from someone else’s.' },
    { kind: 'predict', q: 'You rename <code>azurerm_storage_account.logs</code> to <code>azurerm_storage_account.audit</code> in code, nothing else. What does <code>terraform plan</code> propose?', options: ['No changes', 'Update in place', 'Create <code>audit</code> and destroy <code>logs</code>', 'An error: duplicate resource'], answer: 2, explain: 'Terraform tracks resources by <b>address</b>. <code>audit</code> has no state, so it is created, and <code>logs</code> is no longer in config, so it is destroyed, along with its data. A <code>moved</code> block turns this into a no-op.' },
    { kind: 'predict', q: 'What does this Bicep deploy?', code: `resource kv 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: 'kv-orders-prod'
  scope: resourceGroup('rg-security')
}
output vaultUri string = kv.properties.vaultUri`, lang: 'bicep', options: ['A new Key Vault in rg-security', 'It fails: existing resources can’t be in another group', 'It updates the vault’s properties to defaults', 'Nothing: it references an existing vault and reads a property'], answer: 3, explain: '<code>existing</code> declares a reference, not a deployment. Bicep reads the resource (here from another resource group) so you can use its properties or set it as the scope of a role assignment.' },
    { kind: 'predict', q: 'A nightly job runs <code>terraform plan -detailed-exitcode</code>. It exits with <b>2</b>. What does that mean?', options: ['The plan failed', 'The plan succeeded and there are changes (possible drift)', 'No changes: infrastructure matches config', 'The state lock is held'], answer: 1, explain: 'With <code>-detailed-exitcode</code>: 0 = no changes, 1 = error, <b>2 = changes present</b>. That makes it a simple drift alarm, as long as a clean environment really plans to zero.' },
    { kind: 'scenario', q: '<code>main.bicep</code> creates a resource group and then deploys an app module into it. What must the file declare?', options: ['<code>targetScope = \'resourceGroup\'</code>', 'Nothing: Bicep infers the scope', '<code>targetScope = \'subscription\'</code>, and the module sets <code>scope: rg</code>', '<code>--mode Complete</code>'], answer: 2, explain: 'Resource groups are created at <b>subscription</b> scope, so the file needs <code>targetScope = \'subscription\'</code> and is deployed with <code>az deployment sub create</code>. The module then targets the new group with <code>scope: rg</code>.' },
    { kind: 'scenario', q: 'An on-call engineer raised an App Service’s instance count in the portal at 02:00. The 09:00 release redeploys the unchanged Bicep template, which declares the old count. What happens?', options: ['The deploy sets the declared count back, undoing the hotfix', 'The portal value is kept: ARM merges changes', 'The deploy fails with a conflict', 'what-if blocks the deploy automatically'], answer: 0, explain: 'ARM applies the template’s declared properties, so the manual change is <b>reverted</b>. what-if would have shown a <code>Modify</code>, but only if someone read it. Put the hotfix in code first (or make the count an autoscale setting) and redeploy.' }
  ],
  interview: [
    { q: 'What is the relationship between ARM templates and Bicep?', a: '<p>Bicep is a domain-specific language that <b>compiles to ARM JSON</b> (<code>az bicep build</code>). Resource Manager only ever sees ARM. Bicep adds types, modules, loops, <code>existing</code>, decorators (<code>@secure()</code>, <code>@allowed</code>) and IntelliSense. Because it targets ARM directly, any resource type and API version is usable on day one, and there is no state to store. You can decompile ARM to Bicep to migrate.</p>', lvl: 'core' },
    { q: 'Bicep vs Terraform: how would you choose?', a: '<ul><li><b>Bicep</b>: Azure-only, no state, first-party support, new API versions immediately, deployment stacks for lifecycle, what-if preview.</li><li><b>Terraform</b>: one workflow across Azure, other clouds and SaaS providers (GitHub, Datadog, Entra via <code>azuread</code>), a mature module ecosystem and a clear plan/apply model, at the cost of managing state and occasionally waiting for provider support (the <code>azapi</code> provider fills gaps).</li></ul><p>The bigger decision is discipline: one owner per resource, preview on every PR, and pipelines with federated credentials.</p>', lvl: 'core' },
    { q: 'Explain Incremental vs Complete mode, and what deployment stacks add.', a: '<p><b>Incremental</b> (the default) creates or updates what is in the template and leaves everything else. <b>Complete</b> also deletes resources in the resource group that aren’t in the template, which is dangerous in shared groups. A <b>deployment stack</b> remembers which resources it deployed; when you remove one from the template it can delete or detach it (<code>--action-on-unmanage</code>), and <b>deny settings</b> can block changes outside the stack. It gives Terraform-like lifecycle without a state file.</p>', lvl: 'deep' },
    { q: 'How does what-if work, and what are its limits?', a: '<p>Resource Manager expands the template, then compares each resource’s desired properties with the current resource from its provider, and reports Create, Delete (in Complete mode), Modify (with property diffs), NoChange, Ignore and Deploy. Limits: values only known at deployment time (some <code>reference()</code> calls, nested outputs) can’t be compared exactly; providers that normalise values cause false <code>Modify</code>s; and resources outside the template show as Ignore, so it is not a full drift scan.</p>', lvl: 'deep' },
    { q: 'How do you structure Bicep for several environments?', a: '<p>A subscription- or resource-group-scoped <code>main.bicep</code> that composes small modules (network, data, app, identity), with a parameter file per environment (<code>main.prod.bicepparam</code>). Shared modules live in a private Bicep registry (ACR) or come from <b>Azure Verified Modules</b>, pinned to versions. Names come from parameters plus <code>uniqueString()</code>, not hard-coded. SKUs and redundancy differ by environment through parameters, not by copying files.</p>', lvl: 'core' },
    { q: 'Where do you keep Terraform state on Azure, and how is it protected?', a: '<p>In a storage account blob with the <code>azurerm</code> backend. The backend takes a <b>blob lease</b> as a lock, so two applies can’t run at once. Protect it like a secret store: private endpoint or firewall, Entra auth (<code>use_azuread_auth</code>) instead of account keys, RBAC limited to the pipeline identity, versioning and soft delete for recovery, one state file per environment and component to limit blast radius.</p>', fu: 'What if a pipeline dies holding the lock? (<code>terraform force-unlock &lt;id&gt;</code>, after making sure nothing is still running.)', lvl: 'deep' },
    { q: 'How do you detect and handle drift?', a: '<p>Run a scheduled preview against each environment: <code>terraform plan -detailed-exitcode</code> (exit 2 = changes) or Bicep what-if, and alert on any change. Make a clean environment plan to zero by deciding who owns noisy attributes (Policy-added tags, autoscaled counts) and ignoring them explicitly. Prevent drift with RBAC (humans read-only in production), deny settings on deployment stacks, and a break-glass process that ends with a PR.</p>', lvl: 'core' },
    { q: 'How should a pipeline authenticate to deploy IaC?', a: '<p>With a <b>workload identity federation</b> credential (OIDC) on a user-assigned managed identity or app registration: no client secret. Scope its role to the target resource groups (Contributor plus, if it assigns roles, a constrained <i>Role Based Access Control Administrator</i> assignment) rather than Owner on the subscription. Use a separate identity per environment, and require approval before production. See <a href="devops-pipelines.html">CI/CD pipelines</a>.</p>', lvl: 'core' },
    { q: 'What is <code>azapi</code> and when would you use it?', a: '<p>The <code>azapi</code> Terraform provider calls ARM REST APIs directly with a resource type, API version and JSON body. Use it for features or API versions that <code>azurerm</code> doesn’t support yet, or for preview properties, and switch back to <code>azurerm</code> resources once they exist.</p>', lvl: 'deep' },
    { q: 'How do you make a role assignment idempotent in Bicep?', a: '<p>Give it a deterministic name: <code>guid(scope.id, principalResourceId, roleDefinitionId)</code>, using values known at compile time. Set <code>principalType</code> so new identities don’t fail on replication delay. Assign at the narrowest scope (the Key Vault, not the subscription) using the <code>scope</code> property.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Bicep: subscription-scoped main + module', lang: 'bicep', code: `// main.bicep  (az deployment sub create -l westeurope -f main.bicep -p main.prod.bicepparam)
targetScope = 'subscription'

param env string
param location string = 'westeurope'

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-orders-\${env}'
  location: location
  tags: { app: 'orders', env: env }
}

module app './modules/app.bicep' = {
  scope: rg
  name: 'app-\${env}'
  params: { env: env, location: location }
}

// a pinned Azure Verified Module from the public registry (replace with a real version)
module law 'br/public:avm/res/operational-insights/workspace:0.x.y' = {
  scope: rg
  name: 'law-\${env}'
  params: { name: 'law-orders-\${env}' }
}

output identityClientId string = app.outputs.clientId     // an id, not a secret`, note: 'Modules become nested deployments in ARM, so each one appears in the deployment history with its own status.' },
    { title: 'CLI: build, preview, deploy, stack', code: `# compile only (see the ARM JSON Bicep produces)
az bicep build -f main.bicep --stdout | jq '.resources | length'

# preview; fail the job if anything would be deleted
az deployment sub what-if -l westeurope -f main.bicep -p main.prod.bicepparam \\
  --exclude-change-types NoChange Ignore --no-pretty-print > whatif.json
jq -e '[.changes[] | select(.changeType == "Delete")] | length == 0' whatif.json

# deploy as a stack: removed resources are deleted, out-of-band deletes are denied
az stack sub create -n orders-prod -l westeurope -f main.bicep -p main.prod.bicepparam \\
  --action-on-unmanage deleteResources --deny-settings-mode denyDelete` },
    { title: 'Terraform azurerm 4.x with OIDC and a blob backend', lang: 'text', code: `terraform {
  required_version = ">= 1.6"
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 4.0" }
  }
  backend "azurerm" {
    resource_group_name  = "rg-tfstate"
    storage_account_name = "sttfstateprod"
    container_name       = "tfstate"
    key                  = "orders/prod.tfstate"
    use_oidc             = true     # federated token from the CI runner
    use_azuread_auth     = true     # Entra auth to the blob, no account key
  }
}

provider "azurerm" {
  features {}
  subscription_id     = var.subscription_id   # required in azurerm 4.x
  use_oidc            = true
  storage_use_azuread = true                   # data-plane calls without shared keys
}

resource "azurerm_storage_account" "audit" {
  name                      = "storderaudit\${var.suffix}"
  resource_group_name       = azurerm_resource_group.rg.name
  location                  = azurerm_resource_group.rg.location
  account_tier              = "Standard"
  account_replication_type  = "ZRS"
  shared_access_key_enabled = false
  min_tls_version           = "TLS1_2"
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [tags["CostCenter"]]    # owned by Azure Policy
  }
}

moved {
  from = azurerm_storage_account.logs
  to   = azurerm_storage_account.audit
}`, note: 'HCL is shown as plain text. The <code>ARM_CLIENT_ID</code>, <code>ARM_TENANT_ID</code> and <code>ARM_USE_OIDC</code> environment variables can replace the provider arguments in CI.' }
  ]
});

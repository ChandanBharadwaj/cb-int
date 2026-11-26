IA.register({
  track: 'azure',
  slug: 'azure-portal-cli',
  title: 'Portal & Azure CLI',
  tagline: 'The portal and the <code>az</code> CLI are two front doors to <b>one API: Azure Resource Manager</b>. Sign in, pick the right <b>subscription</b>, put everything in a <b>resource group</b>, and delete the group when you’re done.',
  tldr: {
    problem: 'Newcomers click resources into existence in the portal, lose track of which subscription they used, and cannot reproduce or clean up what they built.',
    model: 'Your <b>account</b> lives in an Entra <b>tenant</b>. It has access to one or more <b>subscriptions</b> (billing + access boundary). Inside a subscription, <b>resource groups</b> hold resources. The portal, CLI, Bicep and SDKs all send requests to <b>Resource Manager</b>.',
    hook: '“I ran the script and it created things in the wrong place.” The CLI uses a <b>default subscription</b>. Always check <code>az account show</code> first.',
    facts: [
      { v: '1 API', l: 'portal, <code>az</code>, PowerShell, Bicep and SDKs all go through Azure Resource Manager at <code>management.azure.com</code>' },
      { v: '1 RG', l: 'every resource belongs to exactly one resource group; deleting the group deletes everything in it' },
      { v: '90', l: 'maximum characters in a resource group name' }
    ]
  },
  intro: {
    what: 'To use Azure you need an <b>account</b> and a <b>subscription</b> (the thing that gets billed). You can manage it in a browser at the <b>Azure portal</b> or from a terminal with the <b>Azure CLI</b> (<code>az</code>). Both create and change the same resources. Resources are organised into <b>resource groups</b>: named folders you can list, secure and delete together.',
    analogy: { icon: '🏢', title: 'An office building', text: 'The tenant is your company’s building pass system. A subscription is a floor with its own electricity meter. A resource group is a room for one project. The portal is the reception desk; the CLI is the staff entrance. Both lead to the same rooms.' },
    steps: [
      { t: 'Get an account and a subscription', d: 'Sign up for a free account or use one from work. Your work account belongs to your company’s Entra tenant. See <a href="azure-hierarchy.html">Tenants to resources</a>.' },
      { t: 'Tour the portal', d: 'At portal.azure.com: the search bar finds any service, <b>Resource groups</b> lists your folders, <b>Cost Management</b> shows spend, and <b>Cloud Shell</b> (the <code>&gt;_</code> icon) gives you a browser terminal with <code>az</code> already signed in.' },
      { t: 'Sign in with the CLI', d: 'Install the CLI, then sign in. A browser opens for the login.', code: 'az login\naz account show -o table', lang: 'bash' },
      { t: 'Pick the subscription', d: 'If you see several, set the one you mean before creating anything.', code: 'az account list -o table\naz account set --subscription "Dev-Sandbox"', lang: 'bash' },
      { t: 'Create, list and delete a resource group', d: 'A group needs a name and a location (where its metadata is stored).', code: 'az group create -n rg-orders-dev -l westeurope\naz group list -o table\naz group delete -n rg-orders-dev', lang: 'bash' }
    ],
    terms: [
      ['tenant', 'Your organisation’s Entra ID directory: users, groups and app identities.'],
      ['subscription', 'A billing and access boundary that holds resource groups. Many per tenant.'],
      ['resource group', 'A folder for resources that share a lifecycle. Every resource is in exactly one.'],
      ['Resource Manager (ARM)', 'The control-plane API that every tool talks to.'],
      ['Cloud Shell', 'A browser terminal in the portal with <code>az</code> and common tools preinstalled.'],
      ['<code>-o table</code>', 'CLI output format. Others: <code>json</code> (default), <code>tsv</code>, <code>yaml</code>. <code>--query</code> filters with JMESPath.']
    ]
  },
  visual: {
    title: 'From az login to a resource',
    caption: 'Press Play to follow <code>az login</code> to Entra ID, then a request through Resource Manager into a subscription and resource group. The last step shows what <code>az group delete</code> removes.'
  },
  gotchas: [
    { trap: 'Creating resources in the wrong subscription', code: 'az account show --query "{name:name, id:id}" -o table   # check first', lang: 'bash', why: 'After <code>az login</code> the CLI picks a default subscription. Scripts silently use it.', fix: 'Run <code>az account set</code> at the top of scripts, or pass <code>--subscription</code> on each command.' },
    { trap: 'Mixing unrelated resources in one resource group', why: 'A group is a lifecycle unit. If prod and a test share one, deleting the test group, or granting a contractor access to it, affects prod too.', fix: 'Group by application + environment: <code>rg-orders-dev</code>, <code>rg-orders-prod</code>.' },
    { trap: 'Thinking the group’s location limits its resources', why: 'The group’s location only says where its metadata lives. Resources inside can be in other regions.', fix: 'Still keep them in one region by habit, and pass <code>-l</code> explicitly for each resource.' },
    { trap: 'Portal-only changes nobody can reproduce', why: 'Clicks leave no script. The next environment drifts from the first.', fix: 'Use the CLI or Bicep for anything that matters. The portal’s “Export template” and “JSON view” help you learn the shape. See <a href="bicep-terraform.html">Bicep & Terraform</a>.' },
    { trap: '<code>az group delete</code> has no undo', why: 'It deletes every resource in the group. Some services offer soft-delete (Key Vault, blobs if enabled), most don’t.', fix: 'Put a <code>CanNotDelete</code> lock on production groups.', code: 'az lock create -n no-delete -g rg-orders-prod --lock-type CanNotDelete', lang: 'bash' }
  ],
  scenarios: [
    { title: 'Test script deployed into production',
      symptom: 'A developer’s “create sandbox” script added a database server to the production subscription.',
      diagnose: 'az account show -o table\naz monitor activity-log list --resource-group rg-orders-prod --offset 1h -o table',
      cause: 'The developer had access to several subscriptions; production happened to be the CLI default after <code>az login</code>.',
      fix: 'Scripts set the subscription explicitly. Developers get only Reader on prod. Production groups get delete locks.',
      fixCode: 'set -euo pipefail\naz account set --subscription "Dev-Sandbox"\naz group create -n rg-sandbox-$USER -l westeurope', lang: 'bash' },
    { title: '“Resource group not found” in a pipeline that works locally',
      symptom: 'The same <code>az</code> command works on a laptop but fails in CI.',
      diagnose: 'az account show --query "{sub:name, user:user.name}" -o json',
      cause: 'The pipeline’s service principal defaults to a different subscription, or has no role on it.',
      fix: 'Pass <code>--subscription</code> in the pipeline and grant the pipeline identity a role on the target group only.',
      fixCode: 'az group show -n rg-orders-dev --subscription 00000000-0000-0000-0000-000000000000', lang: 'bash' }
  ],
  puzzles: [
    { kind: 'concept', q: 'You create a VM in the portal and later list it with <code>az vm list</code>. Why does it appear?', options: ['The portal syncs to the CLI nightly', 'Both call the same Resource Manager API', 'Cloud Shell copied it', 'It wouldn’t appear'], answer: 1, explain: 'There is one control plane. The portal, CLI, PowerShell, Bicep and SDKs are all ARM clients.' },
    { kind: 'concept', q: 'What does <code>az account set --subscription X</code> change?', options: ['Your password', 'The default subscription the CLI uses for later commands', 'Which tenant you belong to', 'The region of your resources'], answer: 1, explain: 'It sets the CLI’s default subscription context, stored locally. Nothing in Azure itself changes.' },
    { kind: 'concept', q: 'A resource group is in <code>westeurope</code>. Can it contain a storage account in <code>northeurope</code>?', options: ['No, never', 'Yes, the group location only stores its metadata', 'Only with a special flag', 'Only for global services'], answer: 1, explain: 'Resources can live in a different region from their group. Keeping them together is just good practice.' },
    { kind: 'concept', q: 'Which is the best way to clean up after a tutorial?', options: ['Stop each resource', 'Delete the resource group you created for it', 'Cancel the subscription', 'Wait for resources to expire'], answer: 1, explain: 'Deleting the group removes every resource in it. Resources don’t expire on their own.' },
    { kind: 'concept', q: 'Which statement about subscriptions is true?', options: ['A subscription holds tenants', 'A subscription is a billing and access boundary inside a tenant', 'Each resource group needs its own subscription', 'Subscriptions are regions'], answer: 1, explain: 'Tenant → subscriptions → resource groups → resources. Invoices and quotas are per subscription.' },
    { kind: 'concept', q: 'You want a list of only VM names as plain lines for a shell loop. Which flags?', options: ['<code>-o table</code>', '<code>--query "[].name" -o tsv</code>', '<code>--verbose</code>', '<code>-o json</code>'], answer: 1, explain: '<code>--query</code> filters the JSON with JMESPath and <code>-o tsv</code> prints bare values, one per line.' }
  ],
  interview: [
    { q: 'What is the relationship between tenant, subscription, resource group and resource?', a: '<p>A tenant (Entra ID directory) trusts subscriptions. Each subscription holds resource groups. Each resource belongs to exactly one group. Access (RBAC) and policy set at a higher level are inherited below.</p>', fu: 'Where do management groups fit?', lvl: 'core' },
    { q: 'How do you decide what goes in one resource group?', a: '<p>Things that share a lifecycle: created, deployed and deleted together, usually one app in one environment. Separate environments and shared platform pieces into their own groups.</p>', lvl: 'core' },
    { q: 'Portal vs CLI vs Bicep: when do you use each?', a: '<p>Portal for exploring and one-off checks. CLI for quick scripted tasks and troubleshooting. Bicep or Terraform for anything that must be repeatable or reviewed. All three call Resource Manager.</p>', lvl: 'core' },
    { q: 'How does <code>az login</code> work on a server with no browser?', a: '<p>Use <code>az login --use-device-code</code> to sign in from another device, or sign in as an identity: a managed identity (<code>az login --identity</code>) on Azure compute, or a service principal / federated credential in CI.</p>', lvl: 'core' },
    { q: 'What is Cloud Shell?', a: '<p>A browser-based terminal in the portal with <code>az</code>, kubectl, git and others preinstalled and already authenticated as you. Handy when you can’t install tools.</p>', lvl: 'core' },
    { q: 'How do you protect a production resource group from accidental deletion?', a: '<p>A <code>CanNotDelete</code> resource lock, least-privilege RBAC (few people with Owner/Contributor on prod), and infrastructure as code so changes go through review.</p>', lvl: 'core' },
    { q: 'What does <code>--query</code> do in the Azure CLI?', a: '<p>It runs a JMESPath expression over the JSON response on the client side, e.g. <code>--query "[?location==\'westeurope\'].name"</code>. Combine with <code>-o tsv</code> for scripts.</p>', lvl: 'core' },
    { q: 'Why might the same CLI command behave differently for two people?', a: '<p>Different default subscription, different RBAC roles, or a different tenant. Check with <code>az account show</code> and the group’s Access control (IAM) blade.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'A safe start for every script', lang: 'bash', code: '#!/usr/bin/env bash\nset -euo pipefail\nSUB="Dev-Sandbox"\nRG="rg-orders-dev"\nLOC="westeurope"\n\naz account set --subscription "$SUB"\naz account show --query "{sub:name, user:user.name}" -o table\n\naz group create -n "$RG" -l "$LOC" --tags app=orders env=dev owner="$USER" -o none\naz resource list -g "$RG" -o table' },
    { title: 'Same group, in Bicep', lang: 'bicep', code: '// deploy with: az deployment sub create -l westeurope -f rg.bicep\ntargetScope = \'subscription\'\n\nparam location string = \'westeurope\'\n\nresource rg \'Microsoft.Resources/resourceGroups@2024-03-01\' = {\n  name: \'rg-orders-dev\'\n  location: location\n  tags: { app: \'orders\', env: \'dev\' }\n}', note: 'A resource group is created at subscription scope, hence <code>targetScope</code>.' }
  ]
});

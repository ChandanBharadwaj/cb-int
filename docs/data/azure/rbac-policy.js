IA.register({
  track: 'azure',
  slug: 'rbac-policy',
  title: 'RBAC & Azure Policy',
  tagline: '<b>RBAC</b> answers “<i>who</i> may do this?” <b>Policy</b> answers “is <i>this</i> allowed here, whoever does it?” Both attach to a scope and are <b>inherited</b> down the tree. RBAC is additive (a union of grants). Policy evaluates the resource itself: it can deny it, modify it, deploy companions for it, or flag it as non-compliant.',
  tldr: {
    problem: 'Too much Owner and Contributor at subscription scope, “read-only” custom roles that still leak data through storage keys, and governance that lives in a wiki instead of being enforced.',
    model: 'Role assignment = <b>principal + role definition + scope</b>. Effective access is the union of the assignments on the path to the resource, minus any deny assignments. Policy assignment = <b>definition or initiative + scope + parameters</b>. It runs inside every ARM write, and a compliance scan covers what already exists.',
    hook: '“Owner on the subscription, yet the portal says I can’t read blobs.” Owner is control plane (<code>Actions</code>); blob reads are <code>DataActions</code>. Add Storage Blob Data Reader.',
    facts: [
      { v: 'union', l: 'RBAC is additive. <code>NotActions</code> only trims a role, and only a deny assignment can take access away' },
      { v: 'Actions ≠ DataActions', l: 'management operations and data operations (read a blob or a secret) are separate permission sets' },
      { v: 'deny · modify · DINE', l: 'Policy effects can block a request, change it, or deploy a related resource after it (plus audit, append and more)' }
    ]
  },
  intro: {
    what: 'Two systems decide what happens in your Azure estate. <b>Role-based access control (RBAC)</b> gives people and apps permissions, such as “the orders team may manage resources in this resource group”. <b>Azure Policy</b> sets rules for the resources themselves, such as “nothing may be created outside the EU” or “every storage account must send logs”. Both are set at a scope (management group, subscription, resource group or resource) and apply to everything below it.',
    analogy: { icon: '🛂', title: 'Badges and building codes', text: 'RBAC is the badge system: it decides which rooms you may enter and what you may do there. Policy is the building code: even the building owner can’t install a gas heater in a no-gas zone. One is about the person, the other about the thing being built.' },
    steps: [
      { t: 'Pick a role', d: 'Built-in roles: Reader, Contributor, Owner, and hundreds of service roles (Key Vault Secrets User, AcrPull, …). Custom roles when nothing fits.' },
      { t: 'Assign it at the smallest scope that works', d: 'Assign to a <b>group</b> or a managed identity, not to individuals.', code: 'az role assignment create --assignee-object-id <group-id> --assignee-principal-type Group \\\n  --role Contributor --scope /subscriptions/<id>/resourceGroups/rg-orders-dev' },
      { t: 'Set guardrails with Policy', d: 'Assign a built-in policy or an initiative at a management group so new subscriptions inherit it.', code: 'az policy assignment create -n allowed-locations \\\n  --policy <definition-name> --scope /providers/Microsoft.Management/managementGroups/mg-landing-zones \\\n  --params \'{"listOfAllowedLocations":{"value":["westeurope","northeurope"]}}\'' },
      { t: 'Watch compliance', d: 'New writes are checked immediately. Existing resources show up as compliant or non-compliant after a scan.', code: 'az policy state summarize --management-group mg-landing-zones' }
    ],
    terms: [
      ['role definition', 'A list of allowed <code>Actions</code>/<code>DataActions</code> (and <code>NotActions</code>/<code>NotDataActions</code>) plus <code>AssignableScopes</code>.'],
      ['role assignment', 'Binds a role definition to a principal at a scope. This is what actually grants access.'],
      ['deny assignment', 'Blocks actions even if a role allows them. Only Azure features create them (for example, deployment stacks and managed apps).'],
      ['policy definition', 'A JSON rule: <code>if</code> (conditions on the resource) <code>then</code> (an effect).'],
      ['initiative', 'A policy set: many definitions assigned and tracked as one, such as a security baseline.'],
      ['landing zone', 'A pre-governed subscription (policies, RBAC, networking, logging) that an app team deploys into.']
    ]
  },
  visual: {
    title: 'Assignments flowing down the tree',
    caption: '<b>RBAC</b>: Step through assignments at the management group, RG and resource and watch the group’s effective access change, including the storage-keys loophole. <b>Policy</b>: assign an initiative, then send a deploy through deny, modify, deployIfNotExists and the compliance scan.'
  },
  gotchas: [
    { trap: '<code>NotActions</code> is not a deny', code: `{ "Name": "Contributor-no-delete",
  "Actions": ["*"],
  "NotActions": ["*/delete"] }
// + plain Contributor from another assignment  →  delete is allowed again`, lang: 'json', why: 'NotActions only subtracts from <i>this</i> role’s Actions. RBAC is the union of all assignments, so any other role that grants delete wins.', fix: 'Use resource locks (<code>CanNotDelete</code>) for protection. Deployment stacks can create real deny assignments. Remove the broader assignment instead of trying to subtract from it.' },
    { trap: 'Contributor can read data through account keys', why: 'Contributor has no blob <code>DataActions</code>, but it can call <code>Microsoft.Storage/storageAccounts/listKeys/action</code>. Shared keys bypass RBAC entirely. The same applies to other services with keys (Cosmos DB, Service Bus SAS, Azure OpenAI keys).', fix: 'Disable local/shared-key auth wherever the service allows it (<code>allowSharedKeyAccess: false</code>, <code>disableLocalAuth: true</code>), and enforce that with Policy. Then data access is granted only through data roles.' },
    { trap: 'Assigning roles to individual users, resource by resource', why: 'Subscriptions have a role-assignment limit (a few thousand; check Microsoft Learn), and per-user assignments are impossible to review. People who leave keep their access in places you forgot.', fix: 'Assign to Entra <b>groups</b> at the RG or subscription level. Use PIM for just-in-time elevation of privileged roles, and run access reviews.' },
    { trap: 'Expecting a new Deny policy to clean up existing resources', why: 'Deny and audit act on <b>create and update</b> requests. Existing resources are only <i>reported</i> as non-compliant, and the next update to them may suddenly fail because of the policy.', fix: 'Audit first (<code>effect: audit</code> as a parameter), fix the backlog, then switch to deny. Use remediation tasks for modify and deployIfNotExists policies.' },
    { trap: 'deployIfNotExists does nothing', why: 'DINE and modify run as the <b>policy assignment’s managed identity</b>. If that identity lacks a role at the target scope, the remediation deployment fails. Existing resources also need an explicit remediation task.', fix: 'Create the assignment with <code>--mi-system-assigned --location westeurope</code>, grant the roles listed in the definition’s <code>roleDefinitionIds</code>, then run <code>az policy remediation create</code>.' },
    { trap: 'Giving the CI pipeline Owner so it can create role assignments', why: 'Owner can do anything, including granting itself or others Owner anywhere in scope. A compromised pipeline becomes a compromised subscription.', fix: 'Give the pipeline <b>Role Based Access Control Administrator</b> with a <b>condition</b> that limits which roles it may assign (for example, only AcrPull and Key Vault Secrets User) and to which principal types.' }
  ],
  scenarios: [
    { title: 'A contractor with “just Contributor” exported production data',
      symptom: 'A security review found blob downloads from the production storage account by a contractor account that had no data roles.',
      diagnose: `az monitor activity-log list --offset 30d \\
  --query "[?operationName.value=='Microsoft.Storage/storageAccounts/listKeys/action'].{who:caller, when:eventTimestamp}" -o table`,
      cause: 'Contributor on the RG allowed <code>listKeys</code>. The account key was used with Storage Explorer, which bypasses Entra and RBAC.',
      fix: 'Rotate both keys, disable shared-key access, grant only data roles to the people who need data, and add a Policy that denies storage accounts with shared keys enabled.',
      fixCode: `az storage account keys renew -g rg-orders-prod -n stordersprod --key primary
az storage account keys renew -g rg-orders-prod -n stordersprod --key secondary
az storage account update -g rg-orders-prod -n stordersprod --allow-shared-key-access false` },
    { title: '“Diagnostics required” initiative, yet nothing gets diagnostics',
      symptom: 'Three weeks after assigning a deployIfNotExists initiative, the compliance dashboard still shows 200 non-compliant resources, and new ones aren’t fixed either.',
      diagnose: `az policy assignment show -n diag-baseline --scope $MG --query identity
az role assignment list --assignee <identity-principal-id> --all -o table   # empty
az policy state list --filter "complianceState eq 'NonCompliant'" --management-group mg-landing-zones --top 5`,
      cause: 'The assignment’s managed identity had no role, so every DINE deployment failed. Existing resources had never had a remediation task.',
      fix: 'Grant the identity the roles the definitions need (Monitoring Contributor and Log Analytics Contributor here), then remediate the backlog.',
      fixCode: `az role assignment create --assignee-object-id <identity-principal-id> \\
  --assignee-principal-type ServicePrincipal --role "Monitoring Contributor" --scope $MG
az policy remediation create -n diag-backfill --policy-assignment diag-baseline \\
  --management-group mg-landing-zones --definition-reference-id <policy-ref-in-initiative>` },
    { title: 'RoleAssignmentLimitExceeded on a busy subscription',
      symptom: 'Onboarding scripts start failing with <code>RoleAssignmentLimitExceeded</code>.',
      diagnose: `az role assignment list --all --query "length(@)"
az role assignment list --all --query "[?principalType=='User'] | length(@)"`,
      cause: 'Years of per-user, per-resource assignments, plus orphaned assignments for deleted identities.',
      fix: 'Replace user assignments with group assignments at RG scope, delete orphans (principal type “Unknown”), and move unrelated workloads to their own subscriptions.' }
  ],
  puzzles: [
    { kind: 'scenario', q: 'Maria is <b>Owner</b> of the subscription. In the portal, opening a blob container shows “You do not have permissions to list the data using your user account with Microsoft Entra ID”. Why?', options: ['Owner doesn’t apply to storage accounts', 'Owner has no blob DataActions; she needs a role such as Storage Blob Data Reader', 'A Policy is blocking her', 'The token has expired'], answer: 1, explain: 'Owner and Contributor are control-plane roles (<code>Actions</code>). Data access with Entra needs <code>DataActions</code> from a data role. (Owner could list keys, or give herself a data role, which is why Owner is so powerful.)' },
    { kind: 'predict', q: 'A group has a custom role at the subscription with <code>Actions: ["*"]</code> and <code>NotActions: ["*/delete"]</code>. The same group also has <b>Contributor</b> on <code>rg-orders-dev</code>. Can members delete a VM in that RG?', options: ['No: NotActions denies delete everywhere', 'Yes: RBAC is a union, and Contributor grants delete in that RG', 'Only with a lock removed', 'Only if they are also Owner'], answer: 1, explain: 'NotActions only shapes the custom role. Contributor at the RG grants <code>*/delete</code> there, and the union wins. Only deny assignments subtract.' },
    { kind: 'scenario', q: 'You assign an “Allowed locations: EU only” policy with effect <b>deny</b>. A storage account in <code>eastus</code> already exists. What happens to it?', options: ['It is deleted', 'It is moved to westeurope', 'It keeps running and is reported as non-compliant', 'The assignment fails to save'], answer: 2, explain: 'Deny acts on create and update requests. Existing resources are evaluated by the compliance scan and flagged, never deleted.' },
    { kind: 'scenario', q: 'Every new SQL database and storage account must automatically get diagnostic settings that send logs to a central workspace. Which effect?', options: ['audit', 'deny', 'deployIfNotExists', 'append'], answer: 2, explain: 'DeployIfNotExists checks for a related resource (the diagnostic setting) and deploys it with a template, running as the assignment’s managed identity.' },
    { kind: 'scenario', q: 'A pipeline must grant <b>AcrPull</b> to new app identities and must never grant anything else. What do you give it?', options: ['Owner on the subscription', 'User Access Administrator on the registry', 'Role Based Access Control Administrator on the registry, with a condition that only AcrPull can be assigned', 'Contributor on the registry'], answer: 2, explain: 'A role-assignment <b>condition</b> on RBAC Administrator constrains which roles (and principal types) the holder can assign. User Access Administrator and Owner could assign any role.' },
    { kind: 'scenario', q: 'A sandbox RG needs to break the “no public IPs” rule for 30 days. What is the cleanest mechanism?', options: ['Delete the policy assignment', 'Add the RG to the assignment’s notScopes forever', 'Create a policy exemption (category Waiver) at the RG, with an expiry date', 'Give the team Owner'], answer: 2, explain: 'Exemptions are scoped, categorised (Waiver or Mitigated), auditable and can expire. <code>notScopes</code> exclusions are permanent and invisible in compliance reports.' },
    { kind: 'scenario', q: 'In the Azure landing zone reference architecture, where do app teams’ production subscriptions usually go?', options: ['Directly under the Tenant root group', 'Under the Platform management group', 'Under Landing zones → Corp or Online', 'Under Sandbox'], answer: 2, explain: 'Application landing zones sit under “Landing zones”, split into Corp (internal, connected to the hub) and Online (internet-facing). Platform holds the identity, management and connectivity subscriptions.' }
  ],
  interview: [
    { q: 'Explain how Azure RBAC evaluates a request.', a: '<p>ARM (or the data-plane service) collects role assignments for the caller, including their groups, at the target scope and every parent scope. If any assigned role’s Actions/DataActions match the operation (after that role’s NotActions are removed), and no deny assignment blocks it, the request is allowed. Conditions (ABAC) can further restrict an assignment, for example to blobs with a certain tag.</p>', lvl: 'core' },
    { q: 'Owner vs Contributor vs User Access Administrator vs RBAC Administrator?', a: '<ul><li><b>Owner</b>: everything, including granting access.</li><li><b>Contributor</b>: manage all resources, but can’t grant access (no <code>Microsoft.Authorization</code> writes).</li><li><b>User Access Administrator</b>: manages access only, and can assign any role.</li><li><b>Role Based Access Control Administrator</b>: manages assignments and supports conditions that restrict which roles can be assigned.</li></ul>', lvl: 'core' },
    { q: 'When would you write a custom role, and what is the catch?', a: '<p>When built-ins are too broad: for example, an on-call role that can restart web apps and read logs but not change configuration. Catches: you have to maintain the action list as services evolve, <code>AssignableScopes</code> limits where it can be used, wildcards can quietly gain new permissions as Azure adds actions, and NotActions isn’t a deny.</p>', lvl: 'core' },
    { q: 'Policy vs RBAC: give an example where you need each.', a: '<p>RBAC: “only the orders team can change resources in rg-orders-prod.” Policy: “no one, including Owners, may create a public IP in landing-zone subscriptions”, and “every resource must carry an owner tag”. RBAC is about the actor; Policy is about the resource’s properties.</p>', lvl: 'core' },
    { q: 'List the main policy effects and when each runs.', a: '<ul><li><b>deny</b>: blocks the create or update request.</li><li><b>audit</b>: allows it but logs non-compliance.</li><li><b>modify</b> and <b>append</b>: change the request (add tags, set properties).</li><li><b>auditIfNotExists</b> and <b>deployIfNotExists</b>: check or deploy a related resource after the main one succeeds.</li><li><b>denyAction</b>: blocks specific actions such as delete.</li><li><b>disabled</b>.</li></ul><p>Existing resources are evaluated by compliance scans.</p>', lvl: 'deep' },
    { q: 'What is an Azure landing zone, and what does “platform vs application landing zone” mean?', a: '<p>A landing zone is a subscription that is ready to use: placed in the right management group with inherited policies, RBAC, networking (connected to a hub or vWAN), logging and budgets. The <b>platform</b> landing zones hold shared services (identity, management and Log Analytics, connectivity). <b>Application</b> landing zones are where workloads go. You typically deploy them with the ALZ Bicep or Terraform accelerators and subscription vending.</p>', lvl: 'deep' },
    { q: 'How do you handle privileged access for production?', a: '<p>Use no standing Owner or Contributor for humans. Use <b>PIM</b> (Privileged Identity Management) for time-bound activation with approval and MFA, and break-glass accounts that are monitored. Pipelines deploy with workload identity federation and least privilege. Run regular access reviews.</p>', lvl: 'core' },
    { q: 'How do you roll out a strict policy without breaking teams?', a: '<p>Parameterise the effect. Assign with <code>audit</code>, publish the compliance report, give teams a deadline (with exemptions that expire), then switch to <code>deny</code>. Test with <code>az deployment … what-if</code>. Keep the policies as code in a repo, with CI that deploys definitions and assignments.</p>', lvl: 'deep' },
    { q: 'Can a custom role with DataActions be assigned at management-group scope?', a: '<p>Microsoft Learn documents limits for custom roles at management-group scope: a custom role can list only one management group in <code>AssignableScopes</code>, and custom roles with <code>DataActions</code> can’t be assigned at management-group scope. Check the current limits before you design around this. Usually you assign data roles at the resource or RG level anyway.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Custom role: on-call restarter', lang: 'json', code: `{
  "Name": "Orders On-call Operator",
  "IsCustom": true,
  "Description": "Restart web apps and read their config and logs. No config changes.",
  "Actions": [
    "Microsoft.Web/sites/read",
    "Microsoft.Web/sites/restart/action",
    "Microsoft.Web/sites/slots/restart/action",
    "Microsoft.Insights/*/read",
    "Microsoft.OperationalInsights/workspaces/query/read"
  ],
  "NotActions": [],
  "DataActions": [],
  "NotDataActions": [],
  "AssignableScopes": ["/subscriptions/<sub-id>/resourceGroups/rg-orders-prod"]
}`, note: 'Create it with <code>az role definition create --role-definition @oncall.json</code> and assign it to the on-call Entra group.' },
    { title: 'Policy definition: deny storage with shared keys', lang: 'json', code: `{
  "mode": "Indexed",
  "parameters": {
    "effect": { "type": "String", "allowedValues": ["Audit", "Deny", "Disabled"], "defaultValue": "Audit" }
  },
  "policyRule": {
    "if": {
      "allOf": [
        { "field": "type", "equals": "Microsoft.Storage/storageAccounts" },
        { "field": "Microsoft.Storage/storageAccounts/allowSharedKeyAccess", "notEquals": false }
      ]
    },
    "then": { "effect": "[parameters('effect')]" }
  }
}`, note: 'A built-in policy for this exists too. Search for it with <code>az policy definition list --query "[?contains(displayName,\'shared key\')]"</code>. Start with Audit, then switch to Deny.' },
    { title: 'Assign + exempt (az)', lang: 'bash', code: `MG=/providers/Microsoft.Management/managementGroups/mg-landing-zones

az policy definition create -n deny-shared-key --rules rule.json --params params.json \\
  --management-group mg-landing-zones --mode Indexed

az policy assignment create -n deny-shared-key --scope $MG \\
  --policy /providers/Microsoft.Management/managementGroups/mg-landing-zones/providers/Microsoft.Authorization/policyDefinitions/deny-shared-key \\
  --params '{"effect":{"value":"Deny"}}'

# time-boxed exception for one RG
az policy exemption create -n legacy-ftp --exemption-category Waiver \\
  --policy-assignment $MG/providers/Microsoft.Authorization/policyAssignments/deny-shared-key \\
  --scope /subscriptions/<sub>/resourceGroups/rg-legacy --expires-on 2027-01-31T00:00:00Z

az policy state trigger-scan --resource-group rg-orders-prod   # don't wait for the daily scan` },
    { title: 'Bicep: group role assignment at RG scope', lang: 'bicep', code: `param devGroupObjectId string
var contributor = 'b24988ac-6180-42a0-ab88-20f7382dd24c'   // Contributor

resource ra 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, devGroupObjectId, contributor)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', contributor)
    principalId: devGroupObjectId
    principalType: 'Group'
  }
}` }
  ]
});

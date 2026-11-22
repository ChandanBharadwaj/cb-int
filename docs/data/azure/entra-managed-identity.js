IA.register({
  track: 'azure',
  slug: 'entra-managed-identity',
  title: 'Entra ID & managed identities',
  tagline: 'Every caller in Azure is a <b>principal</b> in Microsoft Entra ID: a user, a service principal or a managed identity. A <b>managed identity</b> is a service principal whose credentials Azure creates, stores and rotates for you, so your Spring app gets tokens from a local endpoint and <b>never holds a secret</b>.',
  tldr: {
    problem: 'Connection strings and client secrets in config leak, expire on a Friday night and get copied to laptops. Teams also mix up app registrations and service principals, then wonder why a role assignment “doesn’t exist”.',
    model: 'An <b>app registration</b> is the global definition of an app. A <b>service principal</b> is its identity inside one tenant, and it is what roles get assigned to. A <b>managed identity</b> is a service principal tied to an Azure resource (system-assigned) or a standalone resource (user-assigned). Code asks for a token for an <i>audience</i>; the target service validates it and checks RBAC.',
    hook: '“Your app’s Key Vault access broke after a redeploy. Why?” The system-assigned identity was recreated with a new principal ID, and the old role assignment points to a principal that no longer exists.',
    facts: [
      { v: '0 secrets', l: 'in your app config with managed identity: tokens come from the host’s local endpoint (IMDS at 169.254.169.254 on VMs)' },
      { v: '1 → N', l: 'one app registration (application object) can have a service principal in many tenants (multi-tenant apps)' },
      { v: '1 : 1', l: 'a system-assigned identity shares its resource’s lifecycle; a user-assigned identity can be attached to many resources' }
    ]
  },
  intro: {
    what: 'When your app calls a database, a vault or storage, that service needs to know <b>who is calling</b>. In Azure that answer comes from <b>Microsoft Entra ID</b> (formerly Azure Active Directory). Instead of a password, the caller presents a short-lived <b>token</b> signed by Entra. A <b>managed identity</b> lets an Azure-hosted app get such tokens automatically, so there is no password to store, rotate or leak.',
    analogy: { icon: '🪪', title: 'A staff badge printed at the door', text: 'Instead of giving every contractor a master key (a secret), the building prints a badge (token) at the door for whoever is standing in a known spot (your app on its host). The badge says who you are and which room it is for (the audience), and expires after a while. Each room’s guard checks the badge against a list of who may enter (RBAC).' },
    steps: [
      { t: 'Give the app an identity', d: 'Turn on a system-assigned identity, or create a user-assigned one and attach it.', code: 'az webapp identity assign -g rg-orders-prod -n app-orders\n# or: az identity create -g rg-orders-prod -n id-orders' },
      { t: 'Grant it a role on the target', d: 'For example, “Key Vault Secrets User” on one vault: the smallest role, at the smallest scope.', code: 'az role assignment create --assignee-object-id <principalId> \\\n  --assignee-principal-type ServicePrincipal \\\n  --role "Key Vault Secrets User" --scope <vault-resource-id>' },
      { t: 'Use DefaultAzureCredential in code', d: 'The same code uses the managed identity in Azure and your <code>az login</code> on your laptop.', lang: 'java', code: 'var cred = new DefaultAzureCredentialBuilder().build();\nvar secrets = new SecretClientBuilder()\n    .vaultUrl("https://kv-orders.vault.azure.net").credential(cred).buildClient();' },
      { t: 'The service checks the token', d: 'Key Vault validates the token’s signature and audience, then checks the role assignment. There are no passwords anywhere.' }
    ],
    terms: [
      ['principal', 'Anything that can be granted access: a user, group, service principal or managed identity.'],
      ['app registration', 'The application object: the global definition of an app (redirect URIs, API permissions, credentials), owned by its home tenant.'],
      ['service principal', 'The app’s identity in one particular tenant. Shown as an “Enterprise application”. Roles are assigned to it.'],
      ['managed identity', 'A service principal for an Azure resource, with credentials Azure manages. It is either system-assigned or user-assigned.'],
      ['access token (JWT)', 'A signed, short-lived token with claims such as <code>aud</code> (who it’s for), <code>oid</code> (who you are) and <code>exp</code>.'],
      ['DefaultAzureCredential', 'An Azure SDK helper that tries several credential types in order and uses the first one that works.']
    ]
  },
  visual: {
    title: 'Follow a managed-identity token',
    caption: 'Pick an identity type and press Play. The dot follows the request: the app asks the platform’s local identity endpoint, Entra issues a token for <code>vault.azure.net</code>, and Key Vault checks the role assignment. The left column shows which credential in the <code>DefaultAzureCredential</code> chain answered.'
  },
  gotchas: [
    { trap: 'Recreating a resource silently changes its system-assigned identity', code: `az role assignment list --scope $KV_ID -o table
# Principal: (empty)   PrincipalType: Unknown   Role: Key Vault Secrets User
# ↑ an orphaned assignment pointing at a principal that no longer exists`, why: 'A system-assigned identity is deleted with its resource. A redeploy that deletes and recreates the app (or a slot, or a Container App) gets a <b>new principal ID</b>, and the old role assignments stop working.', fix: 'Use a <b>user-assigned</b> identity for anything recreated by IaC or shared across apps or slots. Create it and its role assignments first, then attach it.' },
    { trap: 'Several user-assigned identities and no client ID', code: `// ambiguous when the host has several user-assigned identities
new DefaultAzureCredentialBuilder().build();

// explicit
new DefaultAzureCredentialBuilder()
    .managedIdentityClientId(System.getenv("AZURE_CLIENT_ID")).build();`, lang: 'java', why: 'The platform endpoint needs to know which identity you want. Without a client ID it uses the system-assigned identity, or fails if there isn’t one.', fix: 'Set <code>AZURE_CLIENT_ID</code> or <code>managedIdentityClientId</code>, or <code>spring.cloud.azure.credential.client-id</code> in Spring Cloud Azure.' },
    { trap: 'Right identity, wrong audience', why: 'A token’s <code>aud</code> must match the service. A token for <code>https://management.azure.com/</code> (ARM) is rejected by Key Vault, and Postgres expects <code>https://ossrdbms-aad.database.windows.net/.default</code>.', fix: 'Let the service’s SDK client request its own scope. When you call <code>getToken</code> yourself, pass the right scope and decode the token (claims only) to check <code>aud</code>.' },
    { trap: 'DefaultAzureCredential surprises in production', why: 'It walks a chain. A leftover <code>AZURE_CLIENT_SECRET</code> environment variable makes it authenticate as an old service principal, and on hosts without managed identity it spends time probing before falling through.', fix: 'In production, use <code>ManagedIdentityCredential</code> (or <code>WorkloadIdentityCredential</code> on AKS) explicitly, or limit the chain. Newer azure-identity releases honour <code>AZURE_TOKEN_CREDENTIALS</code>; check your SDK version.' },
    { trap: 'Permission changes that don’t show up yet', why: 'Role assignments take a few minutes to propagate. Group-membership changes for managed identities can take much longer, because tokens and claims are cached by the infrastructure (Microsoft Learn warns this can take hours).', fix: 'Assign roles directly to the managed identity for production paths, create assignments in IaC before the app starts, and build a retry with backoff on 403 at startup instead of crash-looping.' },
    { trap: 'Client secrets on app registrations expire', why: 'A secret created two years ago for a pipeline or a daemon expires, and every deploy or job fails with <code>AADSTS7000222</code>.', fix: 'Remove secrets: use managed identity inside Azure and <b>workload identity federation</b> (OIDC) for GitHub Actions, Azure DevOps and Kubernetes. If a secret must exist, alert on its expiry.' }
  ],
  scenarios: [
    { title: '403 from Key Vault right after a “clean” redeploy',
      symptom: 'The pipeline tore down and recreated <code>app-orders</code>. The app now fails at startup: <code>ForbiddenByRbac … Caller is not authorized to perform action on resource</code>.',
      diagnose: `az webapp identity show -g rg-orders-prod -n app-orders --query principalId -o tsv   # new GUID
az role assignment list --scope $KV_ID --query "[].{p:principalId, name:principalName, role:roleDefinitionName}" -o table
# the assignment still has the OLD principalId and an empty principalName`,
      cause: 'The system-assigned identity was destroyed with the old app. The new app got a new service principal with no roles.',
      fix: 'Switch to a user-assigned identity created in a long-lived RG, assign roles to it once, and attach it to the app. Clean up orphaned assignments.',
      fixCode: `az identity create -g rg-identity -n id-orders
PID=$(az identity show -g rg-identity -n id-orders --query principalId -o tsv)
az role assignment create --assignee-object-id $PID --assignee-principal-type ServicePrincipal \\
  --role "Key Vault Secrets User" --scope $KV_ID
az webapp identity assign -g rg-orders-prod -n app-orders \\
  --identities $(az identity show -g rg-identity -n id-orders --query id -o tsv)
az webapp config appsettings set -g rg-orders-prod -n app-orders \\
  --settings AZURE_CLIENT_ID=$(az identity show -g rg-identity -n id-orders --query clientId -o tsv)` },
    { title: 'Every GitHub Actions deploy fails on the same morning',
      symptom: 'All pipelines fail at <code>azure/login</code> with <code>AADSTS7000222: The provided client secret keys for app … are expired</code>.',
      diagnose: `az ad app credential list --id <appId> --query "[].{hint:hint, end:endDateTime}" -o table`,
      cause: 'The pipelines shared one app registration with a client secret stored in GitHub secrets. It expired, and nobody had an alert on it.',
      fix: 'Replace the secret with a <b>federated credential</b>: GitHub presents its OIDC token and Entra trusts that subject. There is nothing left to expire or leak.',
      fixCode: `az ad app federated-credential create --id <appId> --parameters '{
  "name": "gh-orders-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:corp/orders:environment:prod",
  "audiences": ["api://AzureADTokenExchange"]
}'
# workflow: permissions: id-token: write  +  azure/login with client-id, tenant-id, subscription-id (no secret)` },
    { title: 'Spring Boot app takes 20+ seconds to start in a local container',
      symptom: 'Startup is fast on the host, but inside Docker on a laptop the first Key Vault or Blob call hangs before it fails over or errors.',
      diagnose: `# enable azure-identity logging
AZURE_LOG_LEVEL=verbose  # or logging.level.com.azure.identity=DEBUG
# log shows ManagedIdentityCredential probing and timing out, then AzureCliCredential "az not found"`,
      cause: '<code>DefaultAzureCredential</code> tried managed identity, which doesn’t exist in a laptop container, then the Azure CLI, which isn’t installed in the image.',
      fix: 'In local containers, pass a dev service principal through environment variables (scoped to dev resources), or mount the CLI’s token cache. In production, use <code>ManagedIdentityCredential</code> explicitly so startup never walks the chain.' }
  ],
  puzzles: [
    { kind: 'scenario', q: 'Your SaaS app is registered in your tenant, and two customer tenants have consented to it. How many application objects and service principals exist?', options: ['1 application object, 1 service principal', '3 application objects, 3 service principals', '1 application object, 3 service principals', '1 application object, 2 service principals'], answer: 2, explain: 'The app registration (application object) lives only in the home tenant. A service principal is created in <b>each</b> tenant where the app is used, including the home tenant: 1 + 2 = 3.' },
    { kind: 'scenario', q: 'Ten Container Apps must read the same Key Vault, and they are deleted and recreated often by CI. Which identity setup fits?', options: ['System-assigned identity on each app', 'One user-assigned identity, attached to all ten, with one role assignment', 'A service principal with a client secret in each app’s settings', 'The vault’s access keys in app settings'], answer: 1, explain: 'A user-assigned identity outlives the apps and needs one role assignment. System-assigned identities would need ten assignments, recreated on every redeploy. Secrets and keys defeat the purpose.' },
    { kind: 'predict', q: 'Code on App Service calls <code>credential.getToken(new TokenRequestContext().addScopes("https://management.azure.com/.default"))</code> and sends that token to Key Vault’s REST API. What happens?', options: ['200 with the secret', '401: the token’s audience is ARM, not Key Vault', '403: missing role', 'The SDK rewrites the audience'], answer: 1, explain: 'Key Vault checks <code>aud</code> before it checks RBAC. Request <code>https://vault.azure.net/.default</code>, or let <code>SecretClient</code> do it for you.' },
    { kind: 'scenario', q: 'On a developer laptop with <code>az login</code> done and no Azure environment variables, which credential in <code>DefaultAzureCredential</code> ends up issuing the token?', options: ['EnvironmentCredential', 'ManagedIdentityCredential', 'A developer-tool credential such as AzureCliCredential', 'WorkloadIdentityCredential'], answer: 2, explain: 'Environment and workload identity find nothing, and managed identity has no endpoint on a laptop. A developer-tool credential then uses your signed-in CLI session, so the token represents <b>you</b>.' },
    { kind: 'scenario', q: 'You enable a system-assigned identity on a web app and grant it Storage Blob Data Reader. Later you delete the app. What happens to the identity and the role assignment?', options: ['Both stay until you remove them', 'The identity is deleted; the role assignment is left orphaned until cleaned up', 'Both are moved to the resource group', 'The identity becomes user-assigned'], answer: 1, explain: 'A system-assigned identity shares its resource’s lifecycle. The role assignment isn’t deleted automatically; it shows up as an “Unknown” principal.' },
    { kind: 'scenario', q: 'A GitHub Actions workflow needs to deploy to Azure without any stored secret. What do you configure?', options: ['A PAT stored in GitHub secrets', 'A federated identity credential on an app registration (or user-assigned MI) trusting the repo’s OIDC subject', 'A managed identity on the GitHub runner', 'The subscription’s management certificate'], answer: 1, explain: 'Workload identity federation: Entra trusts tokens from <code>token.actions.githubusercontent.com</code> for a specific subject (repo + branch or environment) and exchanges them for an Azure token.' }
  ],
  interview: [
    { q: 'App registration vs service principal vs managed identity?', a: '<p>An <b>app registration</b> (application object) is the global definition of an app in its home tenant. A <b>service principal</b> is that app’s identity in a particular tenant, and it is what you grant roles to. A <b>managed identity</b> is a service principal bound to an Azure resource, with credentials Azure manages. You never see or rotate its secret.</p>', lvl: 'core' },
    { q: 'System-assigned or user-assigned: when do you choose which?', a: '<p><b>System-assigned</b>: one resource, a simple lifecycle, and access that should disappear when the resource does. <b>User-assigned</b>: shared across several resources, recreated by IaC, needed before the resource exists (pre-provisioned roles), or used by deployment slots. Many teams default to user-assigned for production apps.</p>', lvl: 'core' },
    { q: 'How does a managed identity get a token, technically?', a: '<p>The SDK calls a local endpoint that only the host can reach: IMDS (<code>169.254.169.254/metadata/identity/oauth2/token</code>) on VMs and AKS nodes, or <code>IDENTITY_ENDPOINT</code> with <code>IDENTITY_HEADER</code> on App Service, Functions and Container Apps. The platform authenticates to Entra on the identity’s behalf and returns an access token for the requested resource. The SDK caches it until it is close to expiry.</p>', lvl: 'deep' },
    { q: 'What does DefaultAzureCredential do, and would you use it in production?', a: '<p>It tries a chain: environment variables, workload identity, managed identity, then developer tools (Azure CLI, Azure Developer CLI, IntelliJ, PowerShell; the order depends on the SDK version). It is great for “same code everywhere”. In production I prefer an explicit <code>ManagedIdentityCredential</code> or <code>WorkloadIdentityCredential</code>, or a restricted chain. That gives predictable identity, faster startup and clearer errors.</p>', lvl: 'core' },
    { q: 'How do you connect Spring Boot to Postgres Flexible Server without a password?', a: '<p>Enable Entra authentication on the server, then create a Postgres role for the managed identity (<code>pgaadauth_create_principal</code>). Use <code>spring-cloud-azure-starter-jdbc-postgresql</code> with <code>spring.datasource.azure.passwordless-enabled=true</code>: the JDBC plugin fetches a token for the <code>ossrdbms-aad</code> audience and uses it as the password, refreshing it for new connections.</p>', fu: 'What about existing pooled connections when the token expires? (The token is only checked at connection time, so existing connections live on. Set Hikari’s <code>maxLifetime</code> so new connections pick up fresh tokens.)', lvl: 'deep' },
    { q: 'What is workload identity federation, and why is it better than client secrets?', a: '<p>Entra trusts an external OIDC issuer (GitHub, Azure DevOps, a Kubernetes cluster, another cloud) for a specific <i>subject</i>. The workload presents that issuer’s token and gets an Entra token back. Nothing secret is stored, tokens are short-lived, and trust is scoped to the subject (for example, one repo’s prod environment).</p>', lvl: 'core' },
    { q: 'Delegated vs application permissions in Entra?', a: '<p><b>Delegated</b>: the app acts on behalf of a signed-in user and can do at most what that user can (for example, Graph <code>User.Read</code>). <b>Application</b> (app roles): the app acts as itself with no user, which needs admin consent (for example, a daemon reading all mailboxes). Managed identities use application permissions or Azure RBAC.</p>', lvl: 'deep' },
    { q: 'How would you give an AI agent running in Container Apps access to Azure OpenAI and a vector index without keys?', a: '<p>Attach a user-assigned identity. Grant it <b>Cognitive Services OpenAI User</b> on the Azure OpenAI or Foundry resource and a data-reader role on the AI Search index. Disable key auth where the service allows it, and use <code>DefaultAzureCredential</code> or <code>ManagedIdentityCredential</code> in the SDK. Each agent gets its own identity, so its tool permissions stay least-privilege and auditable.</p>', lvl: 'deep' },
    { q: 'An identity was granted a role 30 seconds ago and still gets 403. What do you tell the team?', a: '<p>Role assignments are eventually consistent: propagation usually takes minutes. A cached token is fine, because RBAC is evaluated per request for direct assignments. Group-based access for managed identities can lag much longer. Wait and retry with backoff, and create assignments before the workload starts.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Spring Cloud Azure 5.x: passwordless Key Vault + Postgres', lang: 'yaml', code: `# deps: spring-cloud-azure-starter-keyvault-secrets, spring-cloud-azure-starter-jdbc-postgresql
spring:
  cloud:
    azure:
      credential:
        managed-identity-enabled: true
        client-id: \${AZURE_CLIENT_ID}          # user-assigned MI
      keyvault:
        secret:
          property-source-enabled: true
          property-sources[0]:
            endpoint: https://kv-orders.vault.azure.net/
  datasource:
    url: jdbc:postgresql://pg-orders-prod.postgres.database.azure.com:5432/orders?sslmode=require
    username: id-orders                         # the Postgres role created for the MI
    azure:
      passwordless-enabled: true`, note: 'Create the Postgres role once, as the Entra admin: <code>SELECT * FROM pgaadauth_create_principal(\'id-orders\', false, false);</code>' },
    { title: 'Explicit credentials in Java (azure-identity)', lang: 'java', code: `// production: no chain walking, deterministic identity
TokenCredential cred = new ManagedIdentityCredentialBuilder()
    .clientId(System.getenv("AZURE_CLIENT_ID"))     // omit for system-assigned
    .build();

// local dev: your az login
TokenCredential dev = new AzureCliCredentialBuilder().build();

SecretClient secrets = new SecretClientBuilder()
    .vaultUrl("https://kv-orders.vault.azure.net")
    .credential(isAzure() ? cred : dev)
    .buildClient();
String pwd = secrets.getSecret("smtp-password").getValue();` },
    { title: 'Bicep: user-assigned MI + role assignment', lang: 'bicep', code: `resource id 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-orders'
  location: location
}

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' existing = { name: 'kv-orders' }

var kvSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6'   // Key Vault Secrets User

resource ra 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, id.id, kvSecretsUser)       // deterministic → idempotent
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUser)
    principalId: id.properties.principalId
    principalType: 'ServicePrincipal'           // avoids replication-delay errors
  }
}`, note: 'Setting <code>principalType</code> avoids the “principal not found” error when the identity was created seconds earlier in the same deployment.' },
    { title: 'Raw token calls (for debugging)', lang: 'bash', code: `# on a VM / AKS node: IMDS
curl -s -H Metadata:true \\
  "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://vault.azure.net"

# inside App Service / Functions / Container Apps
curl -s -H "X-IDENTITY-HEADER: $IDENTITY_HEADER" \\
  "$IDENTITY_ENDPOINT?api-version=2019-08-01&resource=https://vault.azure.net&client_id=$AZURE_CLIENT_ID"

# decode the claims (never paste real tokens into websites)
cut -d. -f2 <<< "$TOKEN" | base64 -d 2>/dev/null | jq '{aud, oid, appid, exp}'` }
  ]
});

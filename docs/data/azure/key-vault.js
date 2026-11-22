IA.register({
  track: 'azure',
  slug: 'key-vault',
  title: 'Key Vault',
  tagline: 'Key Vault stores three kinds of object: <b>secrets</b> (strings you read back), <b>keys</b> (which never leave the vault; you ask it to sign or wrap) and <b>certificates</b> (a key plus an X.509 certificate with a renewal policy). Use <b>Azure RBAC</b> for access, managed identities to reach it, and versions plus events for <b>rotation</b>. The best secret is still the one you replaced with a managed identity.',
  lang: 'java',
  tldr: {
    problem: 'Vaults become a junk drawer of connection strings shared by ten apps, guarded by legacy access policies that any Contributor can edit. Secrets get “rotated” by hand at 2 a.m., and apps keep using the old value until someone restarts them.',
    model: 'Every object is <b>versioned</b>: writing a secret creates a new version, and a versionless URI means “latest”. Access is checked on the <b>data plane</b> with Azure RBAC roles (Key Vault Secrets User, Crypto User, Certificates Officer…) at vault or object scope. Keys support operations (sign, verify, wrap, unwrap, encrypt, decrypt) <i>inside</i> the vault. Event Grid publishes near-expiry and new-version events, which drive rotation.',
    hook: '“Contributor on a vault: can they read secrets?” With the <b>access policy</b> model, effectively yes: they can write an access policy that grants themselves access. With the <b>Azure RBAC</b> model, no: reading needs a data-plane role, and granting one needs Owner or User Access Administrator.',
    facts: [
      { v: '90 days', l: 'default soft-delete retention (configurable 7–90). Soft delete can’t be turned off on vaults, and purge protection is irreversible once enabled' },
      { v: '3', l: 'object types: secrets, keys (software or HSM-protected) and certificates; Managed HSM is a separate, single-tenant service for keys' },
      { v: '30 days', l: 'before expiry, by default, Key Vault raises <code>SecretNearExpiry</code> / <code>CertificateNearExpiry</code> events through Event Grid' }
    ]
  },
  intro: {
    what: '<b>Azure Key Vault</b> is a managed service for things you must not put in code or config: passwords, API keys, encryption keys and TLS certificates. Apps authenticate to it with an Entra identity (ideally a managed identity) and read secrets or ask it to perform key operations. Every change is versioned and audited, and deleted items can be recovered for a retention period.',
    analogy: { icon: '🔐', title: 'A bank’s safe-deposit boxes and its notary', text: 'For <b>secrets</b>, the bank lets you take a copy of what’s in your box. For <b>keys</b>, the bank never lets the key leave: you bring a document and its notary stamps (signs) or seals (wraps) it for you. For <b>certificates</b>, the bank also renews your ID card before it expires. The guard checks your badge (Entra token) against a list of who may open which box (RBAC).' },
    steps: [
      { t: 'Create a vault per app, environment and region', d: 'RBAC permission model, purge protection on for production.', lang: 'bash', code: 'az keyvault create -g rg-orders-prod -n kv-orders-prod -l westeurope \\\n  --enable-rbac-authorization true --enable-purge-protection true \\\n  --public-network-access Disabled' },
      { t: 'Grant the app’s identity a data-plane role', d: 'Key Vault Secrets User reads secret values. Nothing more.', lang: 'bash', code: 'az role assignment create --role "Key Vault Secrets User" \\\n  --assignee-object-id $APP_PRINCIPAL_ID --assignee-principal-type ServicePrincipal \\\n  --scope $(az keyvault show -n kv-orders-prod --query id -o tsv)' },
      { t: 'Load secrets into Spring as properties', d: 'Spring Cloud Azure adds the vault as a property source at startup.', lang: 'yaml', code: 'spring.cloud.azure.keyvault.secret:\n  property-source-enabled: true\n  property-sources[0].endpoint: https://kv-orders-prod.vault.azure.net/' },
      { t: 'Plan rotation', d: 'Set expiry dates, subscribe to near-expiry events, and make apps pick up new versions without a redeploy.' }
    ],
    terms: [
      ['secret', 'Any string up to 25 KB (a password, a connection string, an API key). You get the value back.'],
      ['key', 'An RSA or EC key. Private key material never leaves the vault; you call sign, verify, wrapKey or unwrapKey.'],
      ['certificate', 'An X.509 certificate managed with its key and a policy: issuer, validity and auto-renewal. Its private key is also exposed as a secret if exportable.'],
      ['object version', 'Every update creates a new version with its own URI. A versionless URI resolves to the current version.'],
      ['RBAC vs access policies', 'Two permission models. Azure RBAC (recommended) uses role assignments; vault access policies are the legacy per-vault list.'],
      ['soft delete / purge protection', 'Deleted vaults and objects are recoverable for the retention period. Purge protection forbids permanent deletion until it ends.']
    ]
  },
  visual: {
    title: 'Startup, permissions, rotation and envelope encryption',
    caption: 'Pick a flow and press Play. <b>Spring startup</b>: the property source loads secrets with a managed identity. <b>RBAC vs access policies</b>: why Contributor is dangerous in the old model. <b>Rotation</b>: a near-expiry event drives a two-credential rotation. <b>Keys</b>: wrap and unwrap a data key without the key leaving the vault.'
  },
  gotchas: [
    { trap: 'Vault access policies plus a broad Contributor role', why: 'In the access-policy model, permissions are part of the vault’s ARM resource. Anyone who can write the vault resource (Contributor, Key Vault Contributor) can add an access policy for themselves and then read every secret.', fix: 'Use the <b>Azure RBAC</b> permission model (<code>enableRbacAuthorization: true</code>). Then reading data needs data-plane roles, and changing roles needs Owner or User Access Administrator. Migrate existing vaults by mapping each access policy to a role assignment first.' },
    { trap: 'One vault shared by every app and environment', why: 'A shared vault means one role assignment grants access to everyone’s secrets, blast radius covers all apps, and one noisy app can hit the per-vault throttling limits for all of them.', fix: 'One vault per application, per environment, per region (Microsoft’s own guidance). Grant roles at vault scope, or at secret scope when one secret must be shared.' },
    { trap: 'Rotating a secret but apps never re-read it', why: 'Spring Cloud Azure’s property source reads secrets at startup and on its refresh interval, but beans created from them (a Hikari <code>DataSource</code>, an HTTP client) keep the old value. App Service Key Vault references without a version are refreshed periodically, not instantly.', fix: 'Rotate with <b>two valid credentials</b> (old and new overlap), then retire the old one after every consumer has refreshed. Prefer managed identity where the target supports Entra auth, so there is nothing to rotate.' },
    { trap: 'Reading secrets on every request', code: `// called per HTTP request → throttled under load (429)
String key = secretClient.getSecret("partner-api-key").getValue();`, why: 'Key Vault is a control point, not a cache. It enforces per-vault throttling limits, and each call adds a network round trip.', fix: 'Load once at startup (property source) or cache with a short TTL in memory. Handle 429 with backoff; the SDK retries by default.' },
    { trap: 'Purge protection surprises', why: 'With purge protection on, a deleted vault or object can’t be purged until the retention period ends, and its <b>name is reserved</b>. Recreating <code>kv-orders-prod</code> from IaC fails for up to 90 days. Purge protection can’t be disabled once enabled.', fix: 'Turn it on for production deliberately. In IaC, recover soft-deleted vaults (<code>createMode: recover</code> or <code>az keyvault recover</code>) instead of recreating, and use unique names for ephemeral test vaults.' },
    { trap: 'Secret names don’t allow dots', why: 'Secret names may contain only letters, digits and dashes. You can’t create a secret named <code>spring.datasource.password</code>.', fix: 'Name it <code>spring-datasource-password</code>. The Spring Cloud Azure property source maps dashes to the dotted property name; check the mapping rules for your Spring Cloud Azure version.' }
  ],
  scenarios: [
    { title: 'An engineer could read production secrets without approval',
      symptom: 'An access review shows that a contractor with Contributor on the production resource group read the payment provider API key.',
      diagnose: `az keyvault show -n kv-payments-prod --query properties.enableRbacAuthorization   # false
# Activity log: "Update Key Vault" by contractor@… (added an access policy for themselves)
# AuditEvent: SecretGet by the same principal 2 minutes later`,
      cause: 'The vault used the access-policy model. Contributor can modify the vault, including its access policies, so they granted themselves <code>get</code> on secrets.',
      fix: 'Map existing access policies to RBAC role assignments, switch the vault to RBAC, rotate the exposed key, and use PIM for just-in-time Key Vault Administrator access.',
      fixCode: `az role assignment create --role "Key Vault Secrets User" --assignee-object-id $APP_PID \\
  --assignee-principal-type ServicePrincipal --scope $KV_ID
az keyvault update -n kv-payments-prod --enable-rbac-authorization true`, lang: 'bash' },
    { title: 'Outage at midnight: the partner’s API key expired',
      symptom: 'All calls to a shipping partner fail with 401 from 00:00 UTC. The key in Key Vault had an expiry date that nobody watched.',
      diagnose: `az keyvault secret show --vault-name kv-orders-prod -n shipping-api-key --query attributes.expires
# "2026-11-21T00:00:00+00:00"`,
      cause: 'Expiry was set, but no one subscribed to <code>SecretNearExpiry</code>, and rotation was a manual task in a wiki.',
      fix: 'Subscribe a Function (or a Logic App that opens a ticket) to <code>Microsoft.KeyVault.SecretNearExpiry</code>, automate the rotation where the partner has an API, and alert on <code>SecretExpired</code>.',
      fixCode: `az eventgrid event-subscription create -n kv-near-expiry --source-resource-id $KV_ID \\
  --endpoint-type azurefunction --endpoint $ROTATE_FN_ID \\
  --included-event-types Microsoft.KeyVault.SecretNearExpiry Microsoft.KeyVault.SecretExpired`, lang: 'bash' },
    { title: 'Rotated DB password, then 500s for 30 minutes',
      symptom: 'An automated job changed the Postgres password and wrote a new secret version. Some pods failed authentication until they restarted.',
      diagnose: `# Postgres log: FATAL: password authentication failed for user "orders_app"
# Spring Cloud Azure refresh-interval = 30m; Hikari kept creating connections with the cached password`,
      cause: 'The rotation invalidated the old password immediately. Pods kept the old value until their property source refreshed and the pool was rebuilt.',
      fix: 'Rotate with two users (or two passwords on providers that allow it): create the new credential, publish it, wait for all consumers, then drop the old. Better still, switch Postgres to Entra auth with the app’s managed identity.' }
  ],
  puzzles: [
    { kind: 'scenario', q: 'A vault uses the Azure RBAC permission model. A user has <b>Contributor</b> on its resource group and no other roles. Can they read secret values?', options: ['Yes, Contributor includes everything', 'No: secret values need a data-plane role such as Key Vault Secrets User, and Contributor can’t assign roles', 'Yes, by adding an access policy', 'Only in the portal'], answer: 1, explain: 'Under RBAC, data-plane access is a separate set of <code>DataActions</code>. Contributor can manage the vault but not read secrets, and it lacks <code>roleAssignments/write</code>.' },
    { kind: 'scenario', q: 'Which role should a Spring app have to read its DB password from the vault?', options: ['Key Vault Administrator', 'Key Vault Secrets Officer', 'Key Vault Secrets User', 'Key Vault Reader'], answer: 2, explain: '<b>Secrets User</b> reads secret contents. Officer can also write and delete. Reader sees metadata only, not values. Administrator is everything.' },
    { kind: 'scenario', q: 'You need to encrypt data in your app with a key whose private material must never leave the vault. What do you use?', options: ['A secret holding the AES key', 'Envelope encryption: a local data key wrapped by a Key Vault key (wrapKey/unwrapKey)', 'A certificate exported as PFX', 'Store the data in Key Vault'], answer: 1, explain: 'Generate a data key locally, encrypt data with it, and have Key Vault <b>wrap</b> it with the key-encryption key. Store the wrapped key with the data. Unwrapping requires a call to the vault with the right role.' },
    { kind: 'predict', q: 'Your app references <code>https://kv-orders-prod.vault.azure.net/secrets/db-password</code> (no version). You add a new version. What does the next <code>getSecret("db-password")</code> return?', options: ['The first version ever created', 'The new (current) version', 'An error: a version is required', 'Both versions'], answer: 1, explain: 'A versionless reference resolves to the current version. Pin a version only when you need a stable value, and remember that caches (property sources, App Service references) refresh on their own schedule.' },
    { kind: 'scenario', q: 'IaC recreates <code>kv-orders-test</code> after deleting it and fails with “vault name already in use”. Purge protection is on. What now?', options: ['Purge it', 'Recover the soft-deleted vault (or wait for retention to end, or use a new name)', 'Disable purge protection', 'Open a support ticket to rename it'], answer: 1, explain: 'The soft-deleted vault still reserves the name, and purge protection blocks purging until retention ends. Recovering it brings back the vault and its objects.' },
    { kind: 'scenario', q: 'A TLS certificate for an internal API should renew automatically 30 days before expiry. What do you configure?', options: ['A secret with an expiry date', 'A Key Vault certificate with an issuance policy and a lifetime action (auto-renew)', 'A key with a rotation policy', 'A Function that runs openssl'], answer: 1, explain: 'Certificates have policies: issuer (an integrated CA or self-signed), validity and lifetime actions such as <code>AutoRenew</code> at N days before expiry. Consumers that reference the versionless certificate or secret pick up the new one.' }
  ],
  interview: [
    { q: 'Secrets vs keys vs certificates in Key Vault?', a: '<ul><li><b>Secrets</b>: opaque values you read back (passwords, API keys).</li><li><b>Keys</b>: RSA/EC keys used <i>inside</i> the vault for sign/verify and wrap/unwrap; software-protected in Standard, HSM-protected available in Premium; key rotation policies can create new versions automatically.</li><li><b>Certificates</b>: an X.509 cert plus its key and a policy; Key Vault can enrol with integrated CAs and auto-renew. Its parts are addressable as a key and a secret too.</li></ul>', lvl: 'core' },
    { q: 'Azure RBAC vs vault access policies: which and why?', a: '<p><b>Azure RBAC</b>: role assignments at vault or object scope, consistent with the rest of Azure, PIM-capable, and it separates who can manage the vault from who can read its data. <b>Access policies</b>: legacy, per-vault, no object-level scope, and anyone who can write the vault can edit them. New vaults should use RBAC; Microsoft recommends migrating.</p>', lvl: 'core' },
    { q: 'How does Spring Cloud Azure integrate with Key Vault?', a: '<p>The <code>spring-cloud-azure-starter-keyvault-secrets</code> starter registers one or more vaults as <b>property sources</b>, authenticated with the configured credential (managed identity in Azure). Secrets then resolve like any property, with a configurable refresh interval. You can also inject a <code>SecretClient</code>. For TLS, the Key Vault JCA provider (<code>spring-cloud-azure-starter-keyvault-certificates</code>) lets Spring Boot use vault certificates as key and trust stores.</p>', fu: 'How do you limit which secrets are loaded? (Configure <code>secret-keys</code> for the property source, or use separate vaults.)', lvl: 'core' },
    { q: 'Design secret rotation for a database password used by 20 pods.', a: '<ol><li>Two credentials exist (user A active, user B standby), or a provider that allows two passwords.</li><li>On <code>SecretNearExpiry</code>, a Function resets B’s password and stores it as the new secret version.</li><li>Pods pick it up on their refresh interval; new connections use B, while Hikari’s <code>maxLifetime</code> recycles old ones.</li><li>After a grace period longer than the refresh interval, A is disabled.</li></ol><p>Or remove the secret: use Entra auth with managed identity.</p>', lvl: 'deep' },
    { q: 'What is envelope encryption, and how does Key Vault support it?', a: '<p>Data is encrypted with a <b>data encryption key</b> (DEK) generated locally. The DEK is encrypted (<b>wrapped</b>) with a <b>key encryption key</b> (KEK) that lives in Key Vault. You store the wrapped DEK next to the data. To decrypt, you call <code>unwrapKey</code>, which needs the <b>Key Vault Crypto User</b> (or Crypto Service Encryption User) role. Rotating the KEK only requires re-wrapping DEKs, not re-encrypting data. Azure services’ customer-managed keys work this way.</p>', lvl: 'deep' },
    { q: 'How do you secure network access to Key Vault?', a: '<p>Disable public network access and use a private endpoint with the <code>privatelink.vaultcore.azure.net</code> zone (see <a href="vnet-private-endpoints.html">VNets &amp; private endpoints</a>). If public access stays, restrict it with firewall rules and the “trusted Microsoft services” exception where needed. Send <code>AuditEvent</code> diagnostics to Log Analytics and alert on unusual access.</p>', lvl: 'core' },
    { q: 'What do soft delete and purge protection protect against?', a: '<p>Soft delete protects against accidental deletion: vaults and objects are recoverable for 7–90 days. Purge protection protects against <b>malicious</b> permanent deletion: nobody, including admins, can purge before retention ends. It is needed for services using customer-managed keys, because losing the key means losing the data.</p>', lvl: 'core' },
    { q: 'How do App Service and Container Apps consume Key Vault secrets?', a: '<p><b>App Service / Functions</b>: Key Vault references in app settings, <code>@Microsoft.KeyVault(SecretUri=…)</code>, resolved with the app’s managed identity. Versionless references are refreshed periodically. <b>Container Apps</b>: secrets defined with <code>keyVaultUrl</code> and an identity, then referenced by environment variables. <b>AKS</b>: the Secrets Store CSI driver with workload identity. In all cases the app sees a value without calling the vault itself.</p>', lvl: 'deep' },
    { q: 'Where should an AI agent’s third-party API keys live?', a: '<p>In Key Vault, one vault per environment, with the agent’s user-assigned identity holding <b>Secrets User</b> on only the secrets it needs (object-scope assignments are possible). Load them at startup, never in prompts or tool outputs, and redact them from logs and traces. Prefer Entra auth where the service supports it (Azure OpenAI, AI Search, Storage), so the agent holds no key at all.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Spring Cloud Azure 5.x: Key Vault property source', lang: 'yaml', code: `# dependency: com.azure.spring:spring-cloud-azure-starter-keyvault-secrets
spring:
  cloud:
    azure:
      credential:
        managed-identity-enabled: true
        client-id: \${AZURE_CLIENT_ID}
      keyvault:
        secret:
          property-source-enabled: true
          property-sources[0]:
            name: kv-orders
            endpoint: https://kv-orders-prod.vault.azure.net/
            refresh-interval: 10m          # re-read secrets periodically
            secret-keys: shipping-api-key, smtp-password   # load only these
shipping:
  api-key: \${shipping-api-key}            # resolved from the vault`, note: 'Values are resolved into the environment. Beans already built from them keep the old value until they are rebuilt.' },
    { title: 'Java: secrets and envelope encryption', lang: 'java', code: `TokenCredential cred = new ManagedIdentityCredentialBuilder()
    .clientId(System.getenv("AZURE_CLIENT_ID")).build();

SecretClient secrets = new SecretClientBuilder()
    .vaultUrl("https://kv-orders-prod.vault.azure.net").credential(cred).buildClient();
String smtp = secrets.getSecret("smtp-password").getValue();        // current version

// envelope encryption: wrap a local AES data key with a vault key (needs Key Vault Crypto User)
CryptographyClient kek = new CryptographyClientBuilder()
    .keyIdentifier("https://kv-orders-prod.vault.azure.net/keys/kek-documents")
    .credential(cred).buildClient();

byte[] dek = new byte[32]; new SecureRandom().nextBytes(dek);
WrapResult wrapped = kek.wrapKey(KeyWrapAlgorithm.RSA_OAEP_256, dek);
// store wrapped.getEncryptedKey() and wrapped.getKeyId() (includes the version) next to the ciphertext
byte[] again = kek.unwrapKey(KeyWrapAlgorithm.RSA_OAEP_256, wrapped.getEncryptedKey()).getKey();` },
    { title: 'Bicep: RBAC vault + secret with expiry', lang: 'bicep', code: `@secure()
param shippingApiKey string
param now string = utcNow()                  // utcNow() is only allowed as a parameter default

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-orders-prod'
  location: location
  properties: {
    tenantId: tenant().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: 'Disabled'
  }
}

resource apiKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'shipping-api-key'
  properties: {
    value: shippingApiKey                     // from a @secure() param, never a literal
    attributes: { exp: dateTimeToEpoch(dateTimeAdd(now, 'P90D')) }
  }
}`, note: 'Setting <code>exp</code> is what makes <code>SecretNearExpiry</code> fire. Redeploying this template creates a new secret version each time the value changes.' },
    { title: 'CLI: rotate keys automatically, inspect versions', lang: 'bash', code: `# key auto-rotation every 180 days, notify 30 days before expiry
az keyvault key rotation-policy update --vault-name kv-orders-prod -n kek-documents --value '{
  "lifetimeActions": [
    { "trigger": { "timeAfterCreate": "P180D" }, "action": { "type": "Rotate" } },
    { "trigger": { "timeBeforeExpiry": "P30D" }, "action": { "type": "Notify" } }
  ],
  "attributes": { "expiryTime": "P2Y" }
}'

az keyvault secret list-versions --vault-name kv-orders-prod -n db-password \\
  --query "[].{id:id, enabled:attributes.enabled, created:attributes.created}" -o table

# recover instead of recreate
az keyvault list-deleted -o table
az keyvault recover -n kv-orders-test` }
  ]
});

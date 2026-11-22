IA.register({
  track: 'azure',
  slug: 'storage-accounts',
  title: 'Storage accounts',
  tagline: 'A storage account is a <b>namespace plus a redundancy promise</b>. The SKU decides how many copies of every blob exist and where (racks, zones, a second region). The tier decides what each read and each stored GB costs. Access should come from <b>Entra RBAC</b>, not from the account key.',
  tldr: {
    problem: 'Teams pick LRS because it is the default, put everything in Hot forever, and hand out account-key SAS tokens that cannot be revoked. Then a zone goes down, the bill grows every month, and a leaked URL stays valid for a year.',
    model: 'Every write is stored <b>three times synchronously</b> in the primary region: on different racks of one datacenter (LRS) or across three zones (ZRS). Geo SKUs (GRS, GZRS) then copy <b>asynchronously</b> to the paired region. Separately, each blob sits in an <b>access tier</b> (Hot, Cool, Cold, Archive) that lifecycle rules move it through.',
    hook: '“GRS means we can’t lose data in a regional outage, right?” No. Geo replication is asynchronous, so writes after the <b>Last Sync Time</b> are lost on failover, and the secondary is not readable at all unless you chose RA-GRS or RA-GZRS.',
    facts: [
      { v: '3 → 6', l: 'copies of your data: 3 in the primary region for LRS/ZRS, plus 3 more in the secondary region for GRS/GZRS' },
      { v: '< 15 min', l: 'typical geo-replication lag (RPO) per Microsoft Learn at the time of writing. It is not backed by an SLA, so check Last Sync Time' },
      { v: '7 days', l: 'maximum lifetime of a user delegation SAS, which is signed with an Entra-issued key instead of the account key' }
    ]
  },
  intro: {
    what: 'A <b>storage account</b> is a container for Azure’s basic storage services: <b>Blob</b> (files and objects), Files (SMB/NFS shares), Queues and Tables. Its name becomes part of a public URL such as <code>https://stordersprod.blob.core.windows.net</code>. Inside, blobs live in <b>containers</b>. When you create the account you choose how many copies Azure keeps, and where, and each blob gets a <b>tier</b> that trades storage price against read price.',
    analogy: { icon: '🏦', title: 'A bank vault with photocopies', text: 'Every document you hand in is photocopied three times before the clerk says “done”. A cheap branch keeps all three in one building (LRS). A better one keeps them in three buildings across town (ZRS). The best one also mails a copy to another city later that day (GRS/GZRS). Old documents move from the front desk to the basement and then to off-site archive boxes, which are cheap to keep but slow to fetch.' },
    steps: [
      { t: 'Create the account with a redundancy SKU', d: 'The SKU is the redundancy choice. Turn off shared keys and public blob access from day one.', code: 'az storage account create -g rg-orders-prod -n stordersprod \\\n  --kind StorageV2 --sku Standard_GZRS \\\n  --allow-shared-key-access false --allow-blob-public-access false \\\n  --min-tls-version TLS1_2' },
      { t: 'Grant a data role to your app’s identity', d: '“Owner” on the account does not let you read blobs through Entra. Data access needs a data role such as <b>Storage Blob Data Contributor</b>.', code: 'az role assignment create --assignee-object-id $APP_PRINCIPAL_ID \\\n  --assignee-principal-type ServicePrincipal \\\n  --role "Storage Blob Data Contributor" --scope $ST_ID/blobServices/default/containers/invoices' },
      { t: 'Read and write with the SDK and a token', d: 'No connection string: the client uses the managed identity.', lang: 'java', code: 'var blobs = new BlobServiceClientBuilder()\n    .endpoint("https://stordersprod.blob.core.windows.net")\n    .credential(new DefaultAzureCredentialBuilder().build())\n    .buildClient();' },
      { t: 'Let lifecycle rules move old data', d: 'A policy moves blobs to cooler tiers and deletes them on a schedule, so nobody has to remember.' }
    ],
    terms: [
      ['LRS / ZRS', 'Locally redundant: 3 copies in one datacenter. Zone-redundant: 3 copies across 3 availability zones.'],
      ['GRS / GZRS', 'Geo-redundant: LRS or ZRS in the primary, plus an asynchronous LRS copy in the paired region. The RA- variants let you read the secondary.'],
      ['access tier', 'Hot, Cool, Cold (online) or Archive (offline). Cooler tiers store data more cheaply but cost more to read, and they have minimum retention periods.'],
      ['SAS', 'Shared Access Signature: a signed URL query string that grants limited, time-boxed access to a resource.'],
      ['user delegation SAS', 'A SAS signed with a key that Entra issues to an identity, so it respects that identity’s RBAC and can be revoked without rotating account keys.'],
      ['lifecycle management', 'An account-level policy of rules that tier or delete blobs by age, last access or index tags.']
    ]
  },
  visual: {
    title: 'Where your copies live, and what survives',
    caption: 'Pick a redundancy SKU and press Play. Watch a write being copied to racks, zones and (for geo SKUs) the paired region, then watch a rack, a zone and finally the whole region fail. Grey slots are not used by that SKU.'
  },
  extras: [
    { id: 'storage-accounts-access', title: 'Tiers over time, and two ways to hand out access', label: 'Tiers & access', caption: '<b>Lifecycle</b>: step through a year in the life of an invoice PDF as a rule tiers it down and a user asks for it back. <b>Access</b>: compare an account-key SAS with a user delegation SAS and plain managed identity, including what revoking each one takes.' }
  ],
  gotchas: [
    { trap: '“Contributor” can read every blob', code: `az role assignment create --role Contributor --assignee $DEV --scope $ST_ID
# Contributor includes Microsoft.Storage/storageAccounts/listKeys/action
az storage account keys list -n stordersprod   # → full access to all data`, why: 'Control-plane roles don’t include data actions, but they can <b>list the account keys</b>, and a key is full data access. Many teams don’t realise their “infrastructure” role is a data role in disguise.', fix: 'Set <code>allowSharedKeyAccess: false</code> so keys stop working, and grant data roles (<b>Storage Blob Data Reader/Contributor</b>) at container scope. Use Reader plus a data role for people who only need to browse.' },
    { trap: 'Account-key SAS can’t be revoked on its own', why: 'An ad-hoc service or account SAS is signed with the account key. There is no list of issued tokens, so the only way to kill a leaked one is to <b>rotate the key</b> it was signed with, which breaks everything else using that key.', fix: 'Prefer a <b>user delegation SAS</b> (revoke by revoking the user delegation keys or the identity’s role). If you must use a service SAS, tie it to a <b>stored access policy</b> so you can delete the policy. Keep expiry short.' },
    { trap: 'Assuming GRS gives you zero data loss', why: 'Geo replication is asynchronous. On an unplanned failover, writes newer than the <b>Last Sync Time</b> are lost. After failover the account is locally redundant in the new primary until you re-enable geo redundancy.', fix: 'Check <code>geoReplicationStats.lastSyncTime</code> before failing over, design writers to be replayable (for example from an outbox or a queue), and treat geo failover as a DR runbook, not as HA. Use ZRS or GZRS for in-region HA.', code: `az storage account show -n stordersprod --expand geoReplicationStats \\
  --query geoReplicationStats.lastSyncTime -o tsv` },
    { trap: 'Archive is offline: reads fail, then take hours', why: 'An archived blob can’t be read directly (you get a 409). You must <b>rehydrate</b> it by copying it or setting its tier to Hot/Cool/Cold, which per Microsoft Learn can take up to 15 hours at standard priority. Archive is also only available on LRS, GRS and RA-GRS accounts, not on ZRS-based ones.', fix: 'Archive only data you rarely need and can wait for. Use high priority for urgent rehydration, subscribe to the <code>BlobTierChanged</code> event, and keep a Cold copy of anything with a short retrieval SLA.' },
    { trap: 'Early-deletion charges from aggressive lifecycle rules', why: 'Cool, Cold and Archive have minimum retention periods (30, 90 and 180 days per Microsoft Learn at the time of writing). Moving a blob to Archive and deleting it a week later charges the rest of the 180 days.', fix: 'Make the delete age larger than the tier’s minimum after the tier move. Model the rule on real access patterns, and filter by <code>prefixMatch</code> or blob index tags so short-lived data isn’t tiered at all.' },
    { trap: 'Changing redundancy is not a dropdown flip', why: 'Moving between LRS and GRS is a simple update, but adding <b>zone</b> redundancy (LRS → ZRS, GRS → GZRS) is a <b>conversion</b> that runs asynchronously in the background and isn’t supported for every account type or feature combination.', fix: 'Pick ZRS or GZRS at creation for production. If you must convert, use the portal or <code>az storage account migration start</code> and check the current Learn page for supported combinations first.' }
  ],
  scenarios: [
    { title: 'Invoices unreachable for two hours during a zone incident',
      symptom: 'A zone in the region has an incident. Compute fails over fine (zone-redundant App Service), but every invoice download returns 503 and uploads time out.',
      diagnose: `az storage account show -n stinvoices --query "{sku:sku.name, kind:kind}" -o table
# Standard_LRS  StorageV2   ← all three copies in ONE datacenter, in the affected zone`,
      cause: 'The account was created with the default <b>LRS</b>. All three copies were in one datacenter, which was in the failing zone. The data was safe but unavailable.',
      fix: 'Convert to ZRS (or GZRS if you also need regional DR), and add a policy that denies LRS accounts in production subscriptions.',
      fixCode: `az storage account migration start -g rg-billing --account-name stinvoices --name default --sku Standard_ZRS --no-wait
# guardrail (Azure Policy, simplified): deny when sku.name in [Standard_LRS, Premium_LRS] in prod` },
    { title: 'A leaked SAS URL in a support ticket',
      symptom: 'A customer pasted a download link into a public forum. It has <code>sv=…&amp;se=2027-…&amp;sp=rl&amp;sig=…</code> on the <code>invoices</code> container, valid for another year.',
      diagnose: `# no skoid/sktid parameters → signed with the ACCOUNT KEY, not a user delegation key
# and no si= parameter → not tied to a stored access policy`,
      cause: 'A helper class generated container-level account-key SAS tokens with one-year expiry. The only way to revoke them is to rotate the key that signed them.',
      fix: 'Rotate key1 (after moving remaining key users to key2 or Entra), switch the helper to short-lived, blob-scoped <b>user delegation SAS</b>, and disable shared key access when nothing depends on it.',
      fixCode: `az storage account keys renew -g rg-billing -n stinvoices --key primary
# then, once nothing uses keys:
az storage account update -g rg-billing -n stinvoices --allow-shared-key-access false` },
    { title: 'Storage bill doubled; most data hasn’t been read in a year',
      symptom: 'Logs and exports are written daily to Hot and never deleted. Capacity costs climb every month.',
      diagnose: `az storage account management-policy show -g rg-data -n stexports   # → ResourceNotFound
# Storage insights / blob inventory: 90% of bytes under exports/ older than 180 days`,
      cause: 'No lifecycle policy existed, so everything stayed in Hot forever.',
      fix: 'Add a lifecycle policy: Cool after 30 days, Cold after 90, delete after 400 (beyond Cold’s minimum). Enable last-access tracking if reads are unpredictable and tier on last access instead.',
      fixCode: `az storage account management-policy create -g rg-data --account-name stexports --policy @policy.json` }
  ],
  puzzles: [
    { kind: 'scenario', q: 'Your account is Standard_GRS. The primary region is unavailable, and you have not failed over. Can your app read blobs from the secondary region?', options: ['Yes, from the -secondary endpoint', 'No: only RA-GRS / RA-GZRS expose a readable secondary endpoint', 'Yes, Azure redirects reads automatically', 'Only blobs in the Archive tier'], answer: 1, explain: 'Plain GRS keeps the secondary for failover only. <b>RA-GRS</b> and <b>RA-GZRS</b> add a read-only endpoint at <code>&lt;account&gt;-secondary.blob.core.windows.net</code> that you can read at any time, with possibly stale data.' },
    { kind: 'scenario', q: 'One availability zone in the primary region goes down. Which SKUs keep the account available for reads and writes without any failover?', options: ['LRS and GRS', 'ZRS and GZRS', 'Only GZRS', 'All of them'], answer: 1, explain: 'ZRS and GZRS keep a synchronous copy in each of three zones, so losing one zone is transparent. LRS and GRS keep all primary copies in a single datacenter.' },
    { kind: 'scenario', q: 'A batch job must give a partner read access to one blob for 10 minutes. The account has shared key access disabled. What do you hand out?', options: ['An account SAS', 'A service SAS with a stored access policy', 'A user delegation SAS for that blob, read-only, 10-minute expiry', 'The partner’s object ID in a role assignment on the account'], answer: 2, explain: 'With shared keys disabled, account and service SAS tokens (both signed with the key) stop working. A <b>user delegation SAS</b> is signed with a key Entra issues to your app’s identity, so it still works and can be scoped and revoked.' },
    { kind: 'predict', q: 'A blob is moved to Cool on day 0 and deleted on day 10. How many days of Cool storage are billed (per the minimum-retention rule at the time of writing)?', options: ['10', '20', '30', '0, deletes are free'], answer: 2, explain: 'Cool has a 30-day minimum. Deleting at day 10 adds an early-deletion charge for the remaining 20 days, so you pay for <b>30</b> days in total.' },
    { kind: 'scenario', q: 'A developer is <b>Owner</b> on the storage account and shared keys are disabled. <code>az storage blob list --auth-mode login</code> returns 403. Why?', options: ['Owner has no permissions on storage', 'Owner is a control-plane role; listing blobs with Entra needs a data role such as Storage Blob Data Reader', 'Role assignments take 24 hours', 'The firewall blocks the CLI'], answer: 1, explain: 'Owner and Contributor carry <code>Actions</code>, not <code>DataActions</code>. With keys disabled they can’t fall back to listKeys either. Assign a <b>Storage Blob Data</b> role.' },
    { kind: 'scenario', q: 'You need the cheapest tier for compliance data you read maybe once a year, and a read within an hour is acceptable when it happens. The account is GZRS. What do you pick?', options: ['Archive', 'Cold', 'Cool', 'Hot with a lifecycle delete'], answer: 1, explain: 'Archive isn’t available on ZRS-based accounts (ZRS, GZRS, RA-GZRS), and rehydration can take hours. <b>Cold</b> is online, so reads are immediate, and it is cheaper to store than Cool.' },
    { kind: 'scenario', q: 'Lifecycle rule: “tierToArchive after 30 days, delete after 60 days since modification”. What happens to cost?', options: ['Optimal: less time in Hot', 'Early-deletion charges, because Archive’s 180-day minimum isn’t met', 'The delete action is rejected', 'Archive rules are ignored after 30 days'], answer: 1, explain: 'The blob spends 30 days in Archive, then is deleted, so you pay early deletion for the remaining ~150 days. Delete after at least 30 + 180 days, or don’t archive short-lived data.' }
  ],
  interview: [
    { q: 'Walk me through LRS, ZRS, GRS and GZRS.', a: '<p><b>LRS</b>: 3 synchronous copies in one datacenter, spread over fault and upgrade domains. <b>ZRS</b>: 3 synchronous copies across 3 availability zones, so it survives a zone outage with no failover. <b>GRS</b>: LRS plus an <i>asynchronous</i> LRS copy in the paired region. <b>GZRS</b>: ZRS plus that geo copy. The <b>RA-</b> variants make the secondary readable. For production I default to ZRS, or GZRS when the data needs regional DR.</p>', fu: 'Where does Premium block blob fit? (Premium supports LRS and ZRS only.)', lvl: 'core' },
    { q: 'What is the Last Sync Time and why does it matter?', a: '<p>It is the point up to which all writes to the primary are guaranteed to be in the secondary. Writes after it may be lost on an unplanned failover. You read it through <code>geoReplicationStats</code>. A DR runbook checks it, and apps that can’t tolerate the loss must be able to replay writes.</p>', lvl: 'deep' },
    { q: 'Account SAS vs service SAS vs user delegation SAS?', a: '<ul><li><b>Account SAS</b>: signed with the account key; can cover several services and service-level operations.</li><li><b>Service SAS</b>: signed with the account key; scoped to one service resource. It can reference a <b>stored access policy</b>, which lets you revoke it.</li><li><b>User delegation SAS</b>: Blob (and Data Lake) only. Signed with a key obtained by an Entra identity, limited by that identity’s RBAC, and valid for at most 7 days.</li></ul><p>Prefer user delegation, and keep SAS short-lived and narrowly scoped.</p>', lvl: 'core' },
    { q: 'When would you still hand out a SAS instead of using a managed identity?', a: '<p>When the caller isn’t an Azure identity you control: a browser uploading directly, a partner, a mobile client. The backend authenticates the user, then issues a short-lived, blob-scoped user delegation SAS with only the needed permission (<code>cw</code> for an upload). Service-to-service traffic inside Azure uses managed identity and RBAC.</p>', lvl: 'core' },
    { q: 'Explain the blob access tiers and their trade-offs.', a: '<p><b>Hot</b>: highest storage price, lowest access price. <b>Cool</b> and <b>Cold</b>: cheaper to store, more expensive to read, with minimum retention periods. All three are online, with millisecond first-byte latency. <b>Archive</b>: cheapest storage but offline; you rehydrate first, which can take hours. Tier is set per blob; the account has a default of Hot or Cool.</p>', lvl: 'core' },
    { q: 'How does lifecycle management work, and what are its limits?', a: '<p>It is a JSON policy of rules on the account. Each rule filters by blob type, prefix or index tags, and has actions (<code>tierToCool</code>, <code>tierToCold</code>, <code>tierToArchive</code>, <code>delete</code>) keyed on days since modification, creation or last access. It runs in the background roughly once a day, so new rules can take up to a day or more to act. Last-access conditions need access tracking enabled first.</p>', fu: 'How would you tier only data that is really cold? (Enable last access time tracking and use <code>daysAfterLastAccessTimeGreaterThan</code>, optionally with <code>enableAutoTierToHotFromCool</code>.)', lvl: 'deep' },
    { q: 'How do you lock a storage account down in a regulated environment?', a: '<ul><li>Disable shared key access and anonymous blob access; enforce TLS 1.2+.</li><li>Use Entra RBAC data roles at container scope, assigned to managed identities.</li><li>Turn off public network access and use a <b>private endpoint</b> per sub-resource (<code>blob</code>, <code>dfs</code>…) with private DNS (see <a href="vnet-private-endpoints.html">VNets &amp; private endpoints</a>).</li><li>Enable soft delete for blobs and containers, versioning, and immutability policies if required.</li><li>Optionally use customer-managed keys from <a href="key-vault.html">Key Vault</a>.</li></ul>', lvl: 'deep' },
    { q: 'Soft delete vs versioning vs point-in-time restore?', a: '<p><b>Soft delete</b> keeps deleted blobs or containers for a retention period. <b>Versioning</b> keeps the previous version on every overwrite. <b>Point-in-time restore</b> for block blobs rolls a set of containers back to an earlier time, and it requires versioning, change feed and soft delete. None of them replaces geo redundancy, and geo redundancy doesn’t protect you from a bad delete, because deletes replicate too.</p>', lvl: 'deep' },
    { q: 'How do you serve user uploads from a Spring Boot app without streaming every byte through it?', a: '<p>Expose an endpoint that authorises the user and returns a user delegation SAS for one new blob name with create/write permission and a few minutes’ expiry. The browser PUTs directly to Blob Storage. An Event Grid <code>BlobCreated</code> event (see <a href="messaging-choice.html">messaging</a>) triggers scanning or processing. The app never holds the account key.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Spring Cloud Azure 5.x: passwordless Blob client', lang: 'yaml', code: `# dependency: com.azure.spring:spring-cloud-azure-starter-storage-blob
spring:
  cloud:
    azure:
      credential:
        managed-identity-enabled: true
        client-id: \${AZURE_CLIENT_ID}
      storage:
        blob:
          account-name: stordersprod
          container-name: invoices      # used by the azure-blob:// resource loader`, note: 'The starter auto-configures <code>BlobServiceClient</code> and <code>BlobContainerClient</code> beans. You can also inject <code>@Value("azure-blob://invoices/2026/inv-1.pdf") Resource pdf</code>.' },
    { title: 'Java: short-lived user delegation SAS for one upload', lang: 'java', code: `// Requires the app identity to have a Storage Blob Data role on the container
OffsetDateTime now = OffsetDateTime.now();
UserDelegationKey key = blobServiceClient.getUserDelegationKey(now.minusMinutes(1), now.plusMinutes(15));

BlobClient blob = blobServiceClient.getBlobContainerClient("uploads")
    .getBlobClient("u/" + userId + "/" + UUID.randomUUID() + ".pdf");

var perms = new BlobSasPermission().setCreatePermission(true).setWritePermission(true);
var values = new BlobServiceSasSignatureValues(now.plusMinutes(10), perms)
    .setProtocol(SasProtocol.HTTPS_ONLY);

String url = blob.getBlobUrl() + "?" + blob.generateUserDelegationSas(values, key);
return Map.of("uploadUrl", url);   // the browser PUTs the file straight to Blob Storage`, note: 'Cache the user delegation key for its lifetime instead of fetching one per request.' },
    { title: 'Lifecycle policy (policy.json)', lang: 'json', code: `{
  "rules": [{
    "name": "exports-tiering",
    "enabled": true,
    "type": "Lifecycle",
    "definition": {
      "filters": { "blobTypes": ["blockBlob"], "prefixMatch": ["exports/"] },
      "actions": {
        "baseBlob": {
          "tierToCool":  { "daysAfterModificationGreaterThan": 30 },
          "tierToCold":  { "daysAfterModificationGreaterThan": 90 },
          "delete":      { "daysAfterModificationGreaterThan": 400 }
        },
        "snapshot": { "delete": { "daysAfterCreationGreaterThan": 90 } }
      }
    }
  }]
}` },
    { title: 'Bicep: hardened GZRS account', lang: 'bicep', code: `resource st 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'stordersprod'
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_GZRS' }
  properties: {
    allowSharedKeyAccess: false          // Entra only
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Disabled'      // reach it through a private endpoint
    supportsHttpsTrafficOnly: true
  }
}

resource blobSvc 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: st
  name: 'default'
  properties: {
    deleteRetentionPolicy: { enabled: true, days: 14 }
    containerDeleteRetentionPolicy: { enabled: true, days: 14 }
    isVersioningEnabled: true
  }
}` }
  ]
});

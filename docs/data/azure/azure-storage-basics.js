IA.register({
  track: 'azure',
  slug: 'azure-storage-basics',
  title: 'Storage basics',
  tagline: 'One <b>storage account</b> gives you four services (Blob, Queue, Table, Files) behind four URLs. Blobs move through <b>access tiers</b> as they cool down. A <b>SAS</b> is a signed, expiring URL for sharing one thing without sharing keys.',
  tldr: {
    problem: 'Java developers coming from a filesystem or a database put files in the wrong place, leave everything in the Hot tier, and pass around the account key because it “just works”.',
    model: 'Account → service → container/queue/table/share → item. Blob is the workhorse. Tiers trade storage price against read price and latency. Access is by Entra RBAC (best), a SAS (scoped, expiring) or the account key (all-powerful; avoid).',
    hook: '“Why can’t my app read the old invoice?” It is in the <b>Archive</b> tier, which is offline. It must be rehydrated first, which takes hours.',
    facts: [
      { v: '3–24', l: 'characters in a storage account name: lowercase letters and digits only, globally unique' },
      { v: '30 / 90 / 180', l: 'minimum days billed for Cool, Cold and Archive blobs if deleted or moved earlier' },
      { v: '64 KiB', l: 'maximum size of a single Storage Queue message' }
    ]
  },
  intro: {
    what: 'Azure Storage keeps your data durable in the cloud. You first create a <b>storage account</b>, then use one of its services: <b>Blob</b> for files and objects, <b>Queue</b> for simple messages, <b>Table</b> for simple key-value records, and <b>Files</b> for a network share you can mount. Each service has its own URL, like <code>https://&lt;account&gt;.blob.core.windows.net</code>.',
    analogy: { icon: '🗄️', title: 'A storage unit facility', text: 'The storage account is your rented unit. Inside are boxes (containers) full of items (blobs). Items you rarely need go to cheaper warehouses further away (Cool, Cold, Archive). A SAS is a visitor pass with a time limit that opens one box.' },
    steps: [
      { t: 'Create an account', d: 'Choose a unique name, a region and a redundancy option (LRS is the cheapest; see <a href="storage-accounts.html">Storage accounts</a> for ZRS/GRS).', code: 'az storage account create -n stordersdev -g rg-orders-dev -l westeurope --sku Standard_LRS', lang: 'bash' },
      { t: 'Use Blob for files', d: 'Make a <b>container</b> and upload blobs. Names can contain slashes, so <code>2026/11/inv-1001.pdf</code> looks like folders.', code: 'az storage container create --account-name stordersdev -n invoices --auth-mode login\naz storage blob upload --account-name stordersdev -c invoices -n inv-1001.pdf -f ./inv-1001.pdf --auth-mode login', lang: 'bash' },
      { t: 'Know the other three', d: '<b>Queue</b>: small background-work messages. <b>Table</b>: key-value rows by PartitionKey + RowKey. <b>Files</b>: an SMB/NFS share for apps that expect a filesystem.' },
      { t: 'Pick a tier', d: '<b>Hot</b> for frequently read data, <b>Cool</b> and <b>Cold</b> for rarely read data, <b>Archive</b> for data you almost never read. Lifecycle rules move blobs automatically.' },
      { t: 'Share safely', d: 'Grant your app an RBAC role such as <i>Storage Blob Data Contributor</i>. For a browser download or upload, hand out a short-lived <b>SAS</b> URL.' }
    ],
    terms: [
      ['storage account', 'The top-level resource; holds all four services and sets redundancy.'],
      ['container', 'A folder-like group of blobs inside the Blob service.'],
      ['blob', 'One object: a file plus metadata. Usually a <i>block blob</i>.'],
      ['access tier', 'Hot, Cool, Cold or Archive: trades storage cost against access cost and latency.'],
      ['SAS', 'Shared Access Signature: a signed URL token with permissions and an expiry.'],
      ['account key', 'A master key with full access to the account. Keep it unused where possible.']
    ]
  },
  visual: {
    title: 'Services, tiers and a SAS upload',
    caption: '<b>Four services</b> shows what lives in one account. <b>Access tiers</b> moves a blob from Hot to Archive and back. <b>SAS link</b> lets a browser upload straight to Blob Storage. Press Play or Step.'
  },
  gotchas: [
    { trap: 'Reading an archived blob directly', why: 'Archive is offline. A read fails until the blob is rehydrated to Hot, Cool or Cold, which can take hours.', fix: 'Only archive data you can wait for. Rehydrate ahead of time with <code>az storage blob set-tier --tier Hot --rehydrate-priority Standard</code>.' },
    { trap: 'Moving data to Cool, then deleting it a week later', why: 'Cool, Cold and Archive have minimum storage durations (30, 90, 180 days). Early deletion or tier change is billed as if stored for the minimum.', fix: 'Write lifecycle rules from real access patterns, not guesses.' },
    { trap: 'Using the account key in the app', code: 'spring.cloud.azure.storage.blob.account-key=...   # full control of the whole account', lang: 'text', why: 'The key can read, write and delete everything, and every SAS it signed stays valid until expiry unless you rotate the key.', fix: 'Use a managed identity with a data role. If you need a SAS, prefer a <b>user delegation SAS</b>, signed with Entra credentials.' },
    { trap: 'Long-lived SAS links', why: 'A SAS is a bearer token: anyone holding the URL can use it until it expires.', fix: 'Keep expiry short (minutes), grant only the needed permissions on a single blob, and require HTTPS.' },
    { trap: 'Expecting Table Storage to behave like Postgres', why: 'No joins, no secondary indexes, queries outside PartitionKey + RowKey scan.', fix: 'Keep relational data in Postgres. Use Table only for simple lookups by key. Consider Cosmos DB for richer NoSQL.' },
    { trap: 'Storage account name rejected', why: 'Names must be 3–24 lowercase letters and digits, and unique across all of Azure. No hyphens.', fix: 'Use a pattern like <code>st&lt;app&gt;&lt;env&gt;&lt;suffix&gt;</code>, e.g. <code>stordersdev01</code>.' }
  ],
  scenarios: [
    { title: 'Monthly report job fails: “This operation is not permitted on an archived blob”',
      symptom: 'A yearly audit export tries to read last year’s invoices and gets errors for every file.',
      diagnose: 'az storage blob show --account-name stinvoices -c invoices -n 2025/01/inv-1.pdf --auth-mode login --query properties.blobTier',
      cause: 'A lifecycle rule moved blobs older than 180 days to Archive. Archive blobs are offline.',
      fix: 'Rehydrate the needed blobs a day ahead (or copy them to an online tier), and revisit the rule: perhaps Cold, not Archive.',
      fixCode: 'az storage blob set-tier --account-name stinvoices -c invoices -n 2025/01/inv-1.pdf \\\n  --tier Hot --rehydrate-priority Standard --auth-mode login', lang: 'bash' },
    { title: 'A leaked download link still works after the user was removed',
      symptom: 'A former customer can still download a document from a link sent months ago.',
      diagnose: 'echo "$URL" | grep -o "se=[^&]*"   # expiry far in the future',
      cause: 'Links were account-key SAS tokens with one-year expiry. Removing the user changed nothing.',
      fix: 'Issue user delegation SAS with minutes of lifetime, generated on demand after an access check. Rotate the account key to kill old tokens.',
      fixCode: 'az storage account keys renew -g rg-docs -n stdocs --key primary', lang: 'bash' }
  ],
  puzzles: [
    { kind: 'concept', q: 'Which storage service would you use for PDF invoices?', options: ['Queue', 'Table', 'Blob', 'Files'], answer: 2, explain: 'Blob Storage stores objects of any size. Files is for apps that need a mounted share.' },
    { kind: 'concept', q: 'Which tier is <b>offline</b> and needs rehydration before reading?', options: ['Hot', 'Cool', 'Cold', 'Archive'], answer: 3, explain: 'Only Archive is offline. Cool and Cold are online, with higher access costs than Hot.' },
    { kind: 'concept', q: 'Which name is valid for a storage account?', options: ['Orders-Dev', 'orders_dev', 'stordersdev01', 'st'], answer: 2, explain: 'Lowercase letters and digits only, 3–24 characters. No uppercase, hyphens or underscores.' },
    { kind: 'concept', q: 'What does a SAS token contain?', options: ['The account key itself', 'Permissions, an expiry and a signature', 'The user’s password', 'An Entra group ID'], answer: 1, explain: 'A SAS lists what is allowed (e.g. read), for which resource, until when, signed with a key. The key itself is never in the URL.' },
    { kind: 'concept', q: 'Your app needs background jobs with small messages and nothing fancy. Cheapest built-in option in a storage account?', options: ['Blob', 'Queue', 'Table', 'Files'], answer: 1, explain: 'Storage Queues handle simple messages up to 64 KiB. For topics, sessions or transactions use Service Bus.' },
    { kind: 'concept', q: 'What is the best way for an App Service–hosted Spring app to access Blob Storage?', options: ['Account key in application.yml', 'A one-year SAS in an env var', 'Managed identity with the Storage Blob Data Contributor role', 'Make the container public'], answer: 2, explain: 'No secret to leak or rotate. The SDK’s DefaultAzureCredential picks up the managed identity.' }
  ],
  interview: [
    { q: 'What are the four services in a storage account?', a: '<p>Blob (objects), Queue (simple messages), Table (key-value NoSQL) and Files (SMB/NFS shares). Each has its own endpoint under the account name.</p>', lvl: 'core' },
    { q: 'Explain the blob access tiers.', a: '<p>Hot, Cool, Cold, Archive. Going colder lowers storage price and raises access price and minimum retention. Archive is offline and needs rehydration. Lifecycle management policies move blobs by age or last access.</p>', fu: 'What is early deletion?', lvl: 'core' },
    { q: 'What is a SAS and what kinds exist?', a: '<p>A signed URL token granting limited rights for a limited time. Kinds: <b>user delegation SAS</b> (signed with an Entra-derived key; preferred), <b>service SAS</b> and <b>account SAS</b> (both signed with the account key).</p>', lvl: 'core' },
    { q: 'How do you revoke a SAS?', a: '<p>You can’t revoke a single ad-hoc SAS. Options: let it expire (so keep it short), rotate the key that signed it, revoke user delegation keys, or use a stored access policy on the container and change it.</p>', lvl: 'deep' },
    { q: 'How should a Java app authenticate to Blob Storage?', a: '<p>With a managed identity and <code>DefaultAzureCredential</code> from <code>azure-identity</code>, plus an RBAC data role on the account or container. Avoid account keys and connection strings.</p>', lvl: 'core' },
    { q: 'Blob Storage vs Azure Files?', a: '<p>Blob is object storage accessed over HTTP APIs, cheapest and most scalable. Files is a managed file share mounted over SMB or NFS, for apps that expect a filesystem path.</p>', lvl: 'core' },
    { q: 'Why not store files in the database?', a: '<p>Large binaries bloat backups, replication and vacuum, and cost more per GB. Store the file in Blob and keep its name and metadata in Postgres.</p>', lvl: 'core' },
    { q: 'What does LRS mean?', a: '<p>Locally redundant storage: three synchronous copies within one datacenter in the region. ZRS spreads copies across zones; GRS/GZRS also copy to a paired region. See the deep page on storage accounts.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Storage from the CLI with your Entra login', lang: 'bash', code: 'ACC=stordersdev01; RG=rg-orders-dev\naz storage account create -n $ACC -g $RG -l westeurope --sku Standard_LRS --allow-blob-public-access false\n\n# give yourself a data-plane role (the control-plane Owner role is not enough)\naz role assignment create --assignee "$(az ad signed-in-user show --query id -o tsv)" \\\n  --role "Storage Blob Data Contributor" \\\n  --scope "$(az storage account show -n $ACC -g $RG --query id -o tsv)"\n\naz storage container create --account-name $ACC -n invoices --auth-mode login\naz storage blob upload --account-name $ACC -c invoices -n inv-1001.pdf -f inv-1001.pdf --auth-mode login', note: 'Role assignments can take a few minutes to take effect.' },
    { title: 'Java: upload and hand out a short SAS', lang: 'java', code: 'BlobServiceClient svc = new BlobServiceClientBuilder()\n    .endpoint("https://stordersdev01.blob.core.windows.net")\n    .credential(new DefaultAzureCredentialBuilder().build())\n    .buildClient();\nBlobClient blob = svc.getBlobContainerClient("invoices").getBlobClient("inv-1001.pdf");\nblob.upload(BinaryData.fromBytes(pdfBytes), true);\n\n// user delegation SAS: read-only, 15 minutes\nOffsetDateTime now = OffsetDateTime.now();\nUserDelegationKey key = svc.getUserDelegationKey(now, now.plusMinutes(15));\nString sas = blob.generateUserDelegationSas(\n    new BlobServiceSasSignatureValues(now.plusMinutes(15), new BlobSasPermission().setReadPermission(true)), key);\nString url = blob.getBlobUrl() + "?" + sas;' },
    { title: 'Lifecycle rule in Bicep', lang: 'bicep', code: 'resource policy \'Microsoft.Storage/storageAccounts/managementPolicies@2023-05-01\' = {\n  parent: st\n  name: \'default\'\n  properties: {\n    policy: { rules: [ {\n      name: \'cool-then-cold\'\n      enabled: true\n      type: \'Lifecycle\'\n      definition: {\n        filters: { blobTypes: [ \'blockBlob\' ], prefixMatch: [ \'invoices/\' ] }\n        actions: { baseBlob: {\n          tierToCool: { daysAfterModificationGreaterThan: 30 }\n          tierToCold: { daysAfterModificationGreaterThan: 120 }\n        } }\n      }\n    } ] }\n  }\n}', note: '<code>st</code> is the storage account resource declared elsewhere in the file. <code>prefixMatch</code> starts with the container name.' }
  ]
});

IA.register({
  track: 'azure',
  slug: 'azure-services-tour',
  title: 'Core services tour',
  tagline: 'Azure has hundreds of services, but a typical Spring Boot system needs about <b>six kinds</b>: compute, database, storage, messaging, networking and identity. Learn the default pick for each, and when to move off it.',
  tldr: {
    problem: 'The service catalogue is overwhelming, so beginners either pick the first thing they recognise (a VM) or the most hyped thing (Kubernetes) for a simple web API.',
    model: 'Map your on-prem stack box by box: Tomcat server → <b>App Service / Container Apps</b>; Postgres → <b>Azure Database for PostgreSQL Flexible Server</b>; NFS share or S3-like bucket → <b>Blob Storage</b>; JMS/RabbitMQ → <b>Service Bus</b>; LDAP/OAuth → <b>Entra ID</b>; firewall + VLANs → <b>VNets + NSGs</b>.',
    hook: '“Why not just run everything on AKS?” Because a small team then operates Kubernetes. Start with the most managed option that fits and move down the ladder only for a reason.',
    facts: [
      { v: '5', l: 'main compute choices for apps: VMs, AKS, Container Apps, App Service, Functions' },
      { v: 'same driver', l: 'Postgres Flexible Server speaks the normal Postgres protocol, so the standard JDBC driver and Flyway work unchanged' },
      { v: 'Entra ID', l: 'the identity service behind portal sign-in, app sign-in and managed identities (formerly Azure Active Directory)' }
    ]
  },
  intro: {
    what: 'A <b>service</b> is one product you can create, such as a web app host or a database. Most real systems combine a handful of them. This page is a map: for each kind of need, the service a Java developer usually starts with, and the alternatives.',
    analogy: { icon: '🧰', title: 'A rented, fully-stocked workshop', text: 'You don’t build your own drill or saw; you pick tools off the wall. Compute is the workbench, storage the shelves, the database the filing cabinet, messaging the in-tray, networking the walls and doors, identity the key cards.' },
    steps: [
      { t: 'Compute: where code runs', d: 'Jar or container web app → <b>App Service</b> or <b>Container Apps</b>. Kubernetes skills and many services → <b>AKS</b>. Small event handlers → <b>Functions</b>. Full OS control → <b>VMs</b>. See <a href="compute-choice.html">Choosing compute</a>.' },
      { t: 'Databases', d: 'Relational: <b>PostgreSQL Flexible Server</b> or <b>Azure SQL</b>. Global document/NoSQL: <b>Cosmos DB</b>. Cache: <b>Azure Cache for Redis</b>.' },
      { t: 'Storage', d: 'Files and objects: <b>Blob Storage</b> in a storage account. Shared drives: <b>Azure Files</b>. VM disks: <b>Managed Disks</b>.' },
      { t: 'Messaging', d: 'Business commands and events with transactions: <b>Service Bus</b>. High-volume streams: <b>Event Hubs</b> (Kafka-compatible). Reactive notifications: <b>Event Grid</b>.' },
      { t: 'Networking and identity', d: '<b>VNets</b>, <b>NSGs</b> and private endpoints keep traffic private. <b>Entra ID</b> handles users and app identities; <b>Key Vault</b> holds secrets and certificates.' }
    ],
    terms: [
      ['App Service', 'PaaS host for web apps and APIs (jar, war or container).'],
      ['Container Apps', 'Serverless containers with autoscale and scale-to-zero; Kubernetes is hidden.'],
      ['Flexible Server', 'The current managed PostgreSQL (and MySQL) offering on Azure.'],
      ['Service Bus', 'Managed message broker: queues and topics, sessions, dead-lettering.'],
      ['Entra ID', 'Microsoft’s cloud identity service: users, groups, apps, managed identities.'],
      ['managed identity', 'An identity Azure gives your app so it can call other services without passwords.']
    ]
  },
  visual: {
    title: 'One Spring app, many Azure services',
    caption: '<b>One app, many services</b> walks a typical orders system box by box. <b>Compute ladder</b> orders the compute choices from most control to least operations. Press Play or Step.'
  },
  gotchas: [
    { trap: 'Starting with AKS for one API', why: 'Kubernetes brings upgrades, node pools, ingress and policy work. For one or two services that is pure overhead.', fix: 'Start on App Service or Container Apps. Move to <a href="aks.html">AKS</a> when you need its control and have people to run it.' },
    { trap: 'Running Postgres yourself on a VM', why: 'You take on backups, failover, patching and monitoring. Managed Flexible Server does those for you.', fix: 'Use <a href="azure-sql-postgres.html">Postgres Flexible Server</a> unless you need an extension or setting it doesn’t support.' },
    { trap: 'Saving uploads to the app’s local disk', why: 'PaaS instances can be replaced or scaled out; files on one instance’s disk are invisible to the others and may vanish.', fix: 'Write files to Blob Storage and keep instances stateless. See <a href="azure-storage-basics.html">Storage basics</a>.' },
    { trap: 'Picking Storage Queues when you needed Service Bus', why: 'Storage Queues are simple and cheap but lack topics, sessions, duplicate detection and transactions.', fix: 'Use Service Bus for business messaging. See <a href="messaging-choice.html">Messaging choice</a>.' },
    { trap: 'Connection strings with passwords everywhere', why: 'Secrets get copied into config, CI logs and laptops.', fix: 'Give the app a managed identity and grant it roles on the database, storage and Service Bus. See <a href="entra-managed-identity.html">Managed identities</a>.' }
  ],
  scenarios: [
    { title: 'Uploaded profile photos disappear after a deploy',
      symptom: 'Users report their photos vanish now and then, especially after releases or scale-out.',
      diagnose: 'grep -R "new File(\\"/home/uploads" src/   # app writes to local disk',
      cause: 'Files were saved to the instance’s local filesystem. New instances and restarts don’t share it.',
      fix: 'Store files in Blob Storage and keep only the blob name in Postgres.',
      fixCode: 'BlobClient blob = container.getBlobClient("avatars/" + userId + ".jpg");\nblob.upload(file.getInputStream(), file.getSize(), true);', lang: 'java' },
    { title: 'A two-person team drowning in cluster upgrades',
      symptom: 'Half of every sprint goes to Kubernetes version upgrades, ingress controllers and node patching for three small APIs.',
      cause: 'AKS was chosen by default, though nothing needed Kubernetes-level control.',
      fix: 'Move the APIs to Container Apps (same images) or App Service, and keep AKS only if a future need appears.',
      fixCode: 'az containerapp up -n orders-api -g rg-orders-dev --image myacr.azurecr.io/orders:1.4.2 --ingress external --target-port 8080', lang: 'bash' }
  ],
  puzzles: [
    { kind: 'concept', q: 'A team has a Spring Boot REST API packaged as a jar and no container experience. What is a sensible first compute choice?', options: ['AKS', 'App Service', 'A VM scale set', 'Azure Batch'], answer: 1, explain: 'App Service runs a jar directly with no container or cluster to manage.' },
    { kind: 'concept', q: 'Which service is the managed home for an existing Postgres schema with Flyway migrations?', options: ['Cosmos DB', 'Table Storage', 'Azure Database for PostgreSQL Flexible Server', 'Azure Files'], answer: 2, explain: 'It is real PostgreSQL, so the JDBC driver, Flyway and SQL all carry over.' },
    { kind: 'concept', q: 'Where should an app store generated PDF invoices?', options: ['In a bytea column', 'On the App Service local disk', 'In Blob Storage', 'In Key Vault'], answer: 2, explain: 'Blob Storage is built for files: cheap, durable and shared by all instances. Store the blob name in the database.' },
    { kind: 'concept', q: 'You need ordered, transactional order-processing messages with dead-lettering. Which service?', options: ['Event Grid', 'Storage Queues', 'Service Bus', 'Blob Storage'], answer: 2, explain: 'Service Bus offers sessions (ordering), transactions and dead-letter queues. Event Grid is for event notifications.' },
    { kind: 'concept', q: 'Which service would your app use to read a database password it can’t avoid having?', options: ['Key Vault', 'App Configuration flags only', 'Blob Storage', 'Entra ID groups'], answer: 0, explain: 'Key Vault stores secrets, keys and certificates. Better still, use a managed identity and avoid the password.' },
    { kind: 'concept', q: 'Which compute choice gives you the most control and the most operational work?', options: ['Functions', 'App Service', 'Container Apps', 'Virtual Machines'], answer: 3, explain: 'VMs are IaaS: you manage the OS, runtime and everything above.' }
  ],
  interview: [
    { q: 'Map a typical on-prem Spring/Postgres/RabbitMQ stack to Azure services.', a: '<ul><li>Tomcat/jar → App Service or Container Apps</li><li>Postgres → Postgres Flexible Server</li><li>RabbitMQ/JMS → Service Bus</li><li>NFS share / files → Blob Storage or Azure Files</li><li>LDAP/OAuth → Entra ID</li><li>Secrets → Key Vault</li><li>Firewall/VLAN → VNet + NSGs</li></ul>', lvl: 'core' },
    { q: 'App Service vs Container Apps vs AKS for a Java API?', a: '<p>App Service: simplest, jar or container, plan-based billing. Container Apps: containers with scale-to-zero, revisions and Dapr, no cluster to run. AKS: full Kubernetes control and the operations that come with it.</p>', fu: 'When does AKS win?', lvl: 'core' },
    { q: 'Azure SQL vs Postgres Flexible Server vs Cosmos DB?', a: '<p>Azure SQL and Flexible Server are relational (SQL Server vs PostgreSQL engines). Cosmos DB is a globally distributed NoSQL database with tunable consistency and request-unit billing. Pick relational unless you need global writes or schemaless scale.</p>', lvl: 'core' },
    { q: 'What is a managed identity and why does it matter?', a: '<p>An Entra identity attached to an Azure resource. The app gets tokens from the platform, so there are no passwords in config. You grant it RBAC roles on Storage, Key Vault, Service Bus or databases.</p>', lvl: 'core' },
    { q: 'Service Bus vs Event Hubs vs Event Grid?', a: '<p>Service Bus: business messages, queues/topics, transactions. Event Hubs: high-throughput event streaming, Kafka protocol. Event Grid: push-based routing of discrete events (e.g. “blob created”).</p>', lvl: 'core' },
    { q: 'Where do logs and metrics go on Azure?', a: '<p>Azure Monitor: metrics plus Log Analytics workspaces queried with KQL. Application Insights adds APM (requests, dependencies, traces), with a Java agent that needs no code change.</p>', lvl: 'core' },
    { q: 'Why “most managed first”?', a: '<p>Each step down the ladder (PaaS → containers → Kubernetes → VMs) adds work your team must do forever. Choose lower only for a concrete need: OS access, custom networking, special runtimes.</p>', lvl: 'core' },
    { q: 'What would make you choose a VM today?', a: '<p>Software that needs a full OS or kernel settings, licensed products tied to a machine, lift-and-shift of legacy apps, or GPU and HPC workloads with special drivers.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Create the core pieces (CLI)', lang: 'bash', code: 'RG=rg-orders-dev; LOC=westeurope\naz group create -n $RG -l $LOC\n\n# storage for files\naz storage account create -n stordersdev$RANDOM -g $RG -l $LOC --sku Standard_LRS\n\n# messaging\naz servicebus namespace create -n sb-orders-dev-$RANDOM -g $RG -l $LOC\n\n# managed Postgres (prompts or flags for admin, size, network)\naz postgres flexible-server create -n pg-orders-dev-$RANDOM -g $RG -l $LOC', note: 'Names for storage, Service Bus and Postgres must be globally unique, hence <code>$RANDOM</code>.' },
    { title: 'Spring Boot talks to them', lang: 'java', code: '// application.yml uses Spring Cloud Azure starters + managed identity\n// spring.datasource.url: jdbc:postgresql://pg-orders.postgres.database.azure.com:5432/orders?sslmode=require\n// spring.cloud.azure.storage.blob.account-name: stordersdev\n\n@Service\nclass InvoiceStore {\n  private final BlobContainerClient container;\n  InvoiceStore(BlobServiceClient blobs) { this.container = blobs.getBlobContainerClient("invoices"); }\n\n  void save(String orderId, byte[] pdf) {\n    container.getBlobClient(orderId + ".pdf").upload(BinaryData.fromBytes(pdf), true);\n  }\n}', note: 'With <code>spring-cloud-azure-starter-storage-blob</code>, a <code>BlobServiceClient</code> bean is created and authenticates with <code>DefaultAzureCredential</code>.' }
  ]
});

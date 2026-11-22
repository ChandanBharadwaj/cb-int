IA.register({
  track: 'azure',
  slug: 'spring-on-azure',
  title: 'Spring apps on Azure end to end',
  tagline: 'A production Spring Boot service on Azure is a small set of decisions repeated well: <b>where it runs</b> (Container Apps, App Service or AKS), <b>how it proves who it is</b> (a managed identity, so Postgres, Service Bus, Storage and Key Vault need no passwords), <b>how config arrives</b> (App Configuration and Key Vault, not <code>application.yml</code> secrets), and <b>how you see it</b> (the Application Insights Java agent). Azure Spring Apps is being retired, so new and migrating apps land on those three platforms.',
  tldr: {
    problem: 'Connection strings with passwords in pipelines, a Postgres server that runs out of connections when the app scales out, pods killed while Spring is still starting, traces that stop at the queue, and an Azure Spring Apps estate that has to move.',
    model: '<b>Edge</b>: Front Door + WAF → <b>compute</b>: Container Apps (or App Service/AKS) in a VNet → <b>data</b> over private endpoints: Postgres Flexible Server, Redis, Service Bus, Blob → <b>identity</b>: one user-assigned managed identity per app with data-plane RBAC → <b>config</b>: App Configuration + Key Vault → <b>telemetry</b>: Java agent → Application Insights/Log Analytics.',
    hook: '“Design a Spring Boot order service on Azure.” Draw the request path, then say “identity-first”: the app has a managed identity, and every connection (JDBC, Service Bus, Blob, Key Vault, ACR pull) uses Entra tokens, so there is no secret to leak or rotate. Then cover scaling against database connections, probes, and tracing.',
    facts: [
      { v: '5.x', l: 'Spring Cloud Azure line for Spring Boot 3.x (4.x was for Boot 2.x). Check the compatibility matrix for your exact Boot version' },
      { v: '0 passwords', l: 'with passwordless starters: JDBC for Postgres gets an Entra token as the password; Service Bus, Storage and Key Vault use the same credential chain' },
      { v: 'retiring', l: 'Azure Spring Apps is being retired. Microsoft recommends Azure Container Apps, AKS or App Service as migration targets' }
    ]
  },
  intro: {
    what: 'You have a Spring Boot 3 app with Postgres, a queue and some files. On Azure you package it (a JAR or a container image), run it on a managed platform, connect it to managed services, and watch it with Application Insights. <b>Spring Cloud Azure</b> is the set of Spring starters that wire Azure services into Spring Boot, including <b>passwordless</b> connections that use the app’s <b>managed identity</b> instead of secrets.',
    analogy: { icon: '🏨', title: 'A hotel key card instead of a key ring', text: 'Old style: the app carries a ring of keys (passwords for the database, the queue, the storage account), and every key must be copied, hidden and changed. Identity-first: the app carries one key card (its managed identity). Each door (Postgres, Service Bus, Blob) checks with reception (Entra ID) whether this card may open it. Lose nothing, rotate nothing.' },
    steps: [
      { t: 'Pick the platform', d: 'Container Apps for most containerised Spring services (scale to zero, KEDA, revisions); App Service for a JAR with slots and minimal ops; AKS when you need Kubernetes itself. See <a href="compute-choice.html">Choosing compute</a>.' },
      { t: 'Give the app an identity', d: 'A user-assigned managed identity, attached to the app, with data-plane roles on each service it uses.', code: 'az identity create -g rg-orders -n id-orders\naz containerapp identity assign -g rg-orders -n orders-api --user-assigned id-orders' },
      { t: 'Switch connections to passwordless', d: 'Add the Spring Cloud Azure starters and remove passwords from config.', code: 'spring:\n  cloud.azure.credential:\n    managed-identity-enabled: true\n    client-id: ${AZURE_CLIENT_ID}\n  datasource:\n    url: jdbc:postgresql://pg-orders.postgres.database.azure.com:5432/orders?sslmode=require\n    username: id-orders\n    azure.passwordless-enabled: true', lang: 'yaml' },
      { t: 'Attach the Java agent', d: 'Requests, SQL, Service Bus and logs flow to Application Insights with one trace id. See <a href="monitor-app-insights.html">Monitor & App Insights</a>.' },
      { t: 'Ship through a pipeline', d: 'Build the image once, deploy by digest with an OIDC-federated identity. See <a href="devops-pipelines.html">CI/CD pipelines</a>.' }
    ],
    terms: [
      ['Spring Cloud Azure', 'Microsoft’s Spring starters and auto-configuration for Azure services (Key Vault, Service Bus, Storage, Postgres, App Configuration…).'],
      ['passwordless connection', 'The app authenticates with an Entra token from its managed identity instead of a stored password or key.'],
      ['DefaultAzureCredential', 'Tries several credential sources in order: environment, workload identity, managed identity, then developer logins such as <code>az login</code>.'],
      ['App Configuration', 'A managed store for settings and feature flags, with Key Vault references for secrets.'],
      ['reference architecture', 'A standard, reviewed layout of services for a kind of workload, used as a starting point.']
    ]
  },
  visual: {
    title: 'Spring on Azure, end to end',
    caption: '<b>Request path</b>: a signed-in user through Front Door to Container Apps, Redis, Postgres, Service Bus and a worker. <b>Identity-first startup</b>: watch one managed identity collect Entra tokens for every service; no secret appears anywhere. <b>Observability</b>: the Java agent turns the same request into one connected trace. Press Play or Step.'
  },
  gotchas: [
    { trap: 'Two identities, and the app picks the wrong one', why: 'If the app has a system-assigned and a user-assigned identity, or several user-assigned ones, the credential chain uses the system-assigned identity unless you name a client ID. Postgres then rejects the token because the role was created for the user-assigned identity.', fix: 'Set <code>AZURE_CLIENT_ID</code> (or <code>spring.cloud.azure.credential.client-id</code>) to the intended identity, and keep one identity per app.' },
    { trap: 'Scale-out exhausts Postgres connections', why: 'Every replica opens its own Hikari pool. 3 apps × 10 replicas × a pool of 20 is 600 connections, beyond what many Flexible Server SKUs allow. KEDA scales out exactly when load is high, so the database fails at the worst moment.', fix: 'Small pools (often 5–10), a <code>maxReplicas</code> that respects the connection budget, the built-in PgBouncer (port 6432), and alerts on active connections. See <a href="azure-sql-postgres.html">Azure SQL & Postgres</a>.' },
    { trap: 'Liveness probe kills a starting JVM', why: 'A Spring app with Hibernate and Flyway can take tens of seconds to start. If the liveness probe starts early with a low failure threshold, the platform restarts the container before it is ready, forever.', fix: 'Use a <b>startup probe</b> (liveness waits for it), point liveness at <code>/actuator/health/liveness</code> and readiness at <code>/actuator/health/readiness</code>, and keep the database out of liveness.' },
    { trap: 'Heap sized for a laptop, not the container', why: 'A fixed <code>-Xmx</code> larger than the container limit, or the default heap ratio with lots of off-heap use (threads, Netty, metaspace), gets the container OOM-killed with no Java stack trace.', fix: 'Use <code>-XX:MaxRAMPercentage</code> (often around 70–75) on Java 17/21, leave room for off-heap memory, and watch the container’s working-set memory, not just heap.' },
    { trap: 'Secrets in <code>application.yml</code> or app settings', why: 'They end up in Git history, container images, pipeline logs and the portal’s configuration page, readable by anyone with Reader-plus access.', fix: 'Use passwordless connections for Azure services. Keep only genuine third-party secrets (a partner API key) in Key Vault, read through the Key Vault property source or Key Vault references, with the app’s identity granted <b>Key Vault Secrets User</b>.' },
    { trap: 'Scale-in drops in-flight work', why: 'When a replica is removed, the platform sends SIGTERM and then kills it after a grace period. Without graceful shutdown, HTTP requests are cut off and Service Bus messages being processed are abandoned and redelivered.', fix: 'Set <code>server.shutdown=graceful</code> and a <code>spring.lifecycle.timeout-per-shutdown-phase</code> below the platform’s termination grace period, and make message handlers idempotent.' },
    { trap: 'Lifting Azure Spring Apps assumptions unchanged', why: 'Apps written for Azure Spring Apps often depend on its managed Eureka service registry, Config Server and per-app endpoints. On a new platform those don’t exist unless you provide them.', fix: 'On Container Apps, call other apps by their internal ingress name, or use the managed Java components (for example Eureka Server and Config Server for Spring) where they fit; move configuration to App Configuration over time.' }
  ],
  scenarios: [
    { title: '“FATAL: remaining connection slots are reserved” at peak',
      symptom: 'At the daily peak, the orders API and the worker both started failing with Postgres connection errors. Container Apps had scaled each to its maximum.',
      diagnose: `-- on Postgres, as an admin
SELECT usename, application_name, state, count(*)
FROM pg_stat_activity GROUP BY 1, 2, 3 ORDER BY 4 DESC;
SHOW max_connections;
-- Container Apps: replicas × spring.datasource.hikari.maximum-pool-size per app`,
      diagnoseLang: 'sql',
      cause: 'Two apps scaled to 15 replicas each with Hikari’s default pool of 10, plus migration and admin sessions, went past <code>max_connections</code> for the server’s SKU.',
      fix: 'Budget connections explicitly: smaller pools, a lower <code>maxReplicas</code> where the database is the bottleneck, PgBouncer for many short transactions, and an alert on connection usage. Scale the database SKU only if the pool budget is already sane.',
      fixCode: `spring.datasource.url=jdbc:postgresql://pg-orders.postgres.database.azure.com:6432/orders?sslmode=require   # built-in PgBouncer
spring.datasource.hikari.maximum-pool-size=5
spring.datasource.hikari.connection-timeout=3000`,
      fixLang: 'text' },
    { title: 'Passwordless login broke after adding a second identity',
      symptom: 'After a platform team attached a shared user-assigned identity for ACR pulls, the app’s Postgres connections failed with <code>password authentication failed for user "id-orders"</code>.',
      diagnose: `az containerapp identity show -g rg-orders -n orders-api
# type: SystemAssigned, UserAssigned  (id-orders, id-acr-pull)
az containerapp show -g rg-orders -n orders-api --query "properties.template.containers[0].env[?name=='AZURE_CLIENT_ID']"
# []  ← no client id configured`,
      cause: 'With several identities and no client ID, the credential requested a token for a different identity than the Postgres role <code>id-orders</code> was mapped to.',
      fix: 'Set <code>AZURE_CLIENT_ID</code> to <code>id-orders</code>’s client ID (and the matching Spring property), remove the unused system-assigned identity, and add a startup check that logs which identity the app is using.',
      fixCode: `az containerapp update -g rg-orders -n orders-api \\
  --set-env-vars AZURE_CLIENT_ID=$(az identity show -g rg-orders -n id-orders --query clientId -o tsv)
az containerapp identity remove -g rg-orders -n orders-api --system-assigned` },
    { title: 'Restart loop on every deploy',
      symptom: 'New revisions never became healthy. System logs showed the container restarting every 40 seconds; the old revision kept serving.',
      diagnose: `az containerapp logs show -g rg-orders -n orders-api --type system --tail 30
# "Container orders-api failed liveness probe, will be restarted"
az containerapp show -g rg-orders -n orders-api --query "properties.template.containers[0].probes"`,
      cause: 'The liveness probe started after 10 seconds with three failures allowed. The app, with Flyway migrations and Hibernate validation, took about 50 seconds to start.',
      fix: 'Add a startup probe that allows enough time, keep liveness lightweight, and speed up startup where you can (lazy initialisation for rarely used beans, class data sharing).',
      fixCode: `probes:
  - type: Startup
    httpGet: { path: /actuator/health/liveness, port: 8080 }
    initialDelaySeconds: 10
    periodSeconds: 10
    failureThreshold: 10          # up to ~110 s to start
  - type: Liveness
    httpGet: { path: /actuator/health/liveness, port: 8080 }
  - type: Readiness
    httpGet: { path: /actuator/health/readiness, port: 8080 }`,
      fixLang: 'yaml' },
    { title: 'Migrated off Azure Spring Apps: services can’t find each other',
      symptom: 'After moving five services to Container Apps, calls between them failed with <code>No instances available for payments-service</code>.',
      diagnoseLang: 'text',
      diagnose: 'Logs: com.netflix.discovery... Cannot execute request on any known server\nThe apps still used a Eureka client pointing at the registry that Azure Spring Apps used to manage.',
      cause: 'Service discovery was provided by the old platform. The new environment had no Eureka server, so client-side load balancing had no instances.',
      fix: 'Either call apps by their Container Apps internal names (<code>http://payments-service</code>), letting the platform load-balance, and remove the Eureka client; or add the managed Eureka Server for Spring component and bind the apps to it as an interim step.',
      fixCode: `# option A: platform DNS, no registry
payments.base-url=http://payments-service
eureka.client.enabled=false` ,
      fixLang: 'text' }
  ],
  puzzles: [
    { kind: 'scenario', q: 'With <code>spring.datasource.azure.passwordless-enabled=true</code>, what does the app use as the Postgres password?', options: ['The managed identity’s client ID', 'An Entra access token fetched (and refreshed) for the app’s identity', 'A password stored in Key Vault', 'Nothing: Postgres trusts the VNet'], answer: 1, explain: 'The JDBC plugin fetches an <b>Entra token</b> for the identity and sends it as the password. The username is the Postgres role created for that identity (for example with <code>pgaadauth_create_principal</code>).' },
    { kind: 'calc', q: 'Two apps scale to a maximum of 12 replicas each, each with a Hikari pool of 10. How many connections can they open at peak?', options: ['20', '120', '240', '24'], answer: 2, explain: '2 × 12 × 10 = <b>240</b>, before migrations, admin tools and monitoring. Compare it with the server’s <code>max_connections</code> and budget pools before setting <code>maxReplicas</code>.' },
    { kind: 'scenario', q: 'An app has a system-assigned identity and one user-assigned identity, and no client ID configured. Which identity does <code>DefaultAzureCredential</code> use on Azure?', options: ['The system-assigned one', 'The user-assigned one', 'Both, alternately', 'It fails with “ambiguous identity”'], answer: 0, explain: 'Without a client ID, the managed identity credential asks for the <b>system-assigned</b> identity. Set <code>AZURE_CLIENT_ID</code> to choose a user-assigned one.' },
    { kind: 'scenario', q: 'Should the liveness probe include the Postgres health indicator?', options: ['Yes, a broken DB means a broken app', 'Only when using PgBouncer', 'Only in production', 'No: a database outage would make the platform restart every replica, adding cold starts to the outage'], answer: 3, explain: 'Liveness answers “is this process stuck?”. Restarting doesn’t fix a database outage. Use readiness (or a dependency dashboard) for downstream health, and retries or circuit breakers in code.' },
    { kind: 'scenario', q: 'A team migrating from Azure Spring Apps wants scale to zero, KEDA scaling on Service Bus, revisions with traffic splitting, and no cluster to manage. Which target fits best?', options: ['AKS', 'Azure Container Apps', 'App Service on Windows', 'Virtual Machine Scale Sets'], answer: 1, explain: 'Those are <b>Container Apps</b> features out of the box. AKS gives full Kubernetes control at the cost of operating clusters; App Service suits JAR/WAR web apps with slots.' },
    { kind: 'scenario', q: 'The app calls a partner REST API that needs an API key. Where should the key live?', options: ['In Key Vault, read through the Key Vault property source (or a Key Vault reference) with the app’s managed identity', 'As a plain Container Apps environment variable', 'In <code>application.yml</code> in Git', 'In the Docker image'], answer: 0, explain: 'Third-party secrets can’t be replaced by Entra auth, so put them in <b>Key Vault</b>, give the app’s identity <i>Key Vault Secrets User</i>, and read them at startup or by reference. Rotate in one place.' },
    { kind: 'scenario', q: 'Front Door sits in front of a Container App with external ingress. How do you stop clients from calling the app’s own URL and bypassing the WAF?', options: ['Rename the app', 'Use HTTPS only', 'Restrict ingress to the AzureFrontDoor.Backend service tag and check the <code>X-Azure-FDID</code> header for your profile (or use Private Link with internal ingress)', 'Disable the WAF'], answer: 2, explain: 'The service tag alone allows <i>any</i> Front Door profile. Also validate the <code>X-Azure-FDID</code> header (your profile’s ID), or keep the app internal and reach it over Private Link.' }
  ],
  interview: [
    { q: 'Draw a reference architecture for a Spring Boot order service on Azure.', a: '<p><b>Front Door</b> (WAF, TLS, global routing) → <b>Container Apps</b> environment in a VNet with <code>orders-api</code> and <code>orders-worker</code> → over private endpoints: <b>Postgres Flexible Server</b> (zone-redundant HA), <b>Azure Cache for Redis</b> (cache-aside), <b>Service Bus</b> (commands and events, DLQ), <b>Blob Storage</b> (documents). <b>Key Vault</b> for third-party secrets, <b>App Configuration</b> for settings and flags, <b>ACR</b> for images, <b>Application Insights + Log Analytics</b> for telemetry. Users sign in with <b>Entra ID</b>; the API is an OAuth2 resource server. Each app has a user-assigned managed identity with data-plane roles only on what it uses.</p>', lvl: 'core' },
    { q: 'What does “identity-first configuration” mean in practice?', a: '<p>No connection string contains a secret. The app gets a managed identity; Postgres gets an Entra admin and a role for that identity; Service Bus, Storage, Key Vault, App Configuration and ACR grant data-plane RBAC roles to it. Spring Cloud Azure starters use the credential chain, so config contains only endpoints and the identity’s client ID. Locally, the same code uses your <code>az login</code> through <code>DefaultAzureCredential</code>. What remains secret (third-party keys) lives in Key Vault.</p>', lvl: 'core' },
    { q: 'Container Apps, App Service or AKS for Spring Boot?', a: '<ul><li><b>Container Apps</b>: containers without a cluster; HTTP/KEDA scaling incl. to zero, revisions and traffic splitting, Dapr, managed Java components. Default choice for most microservices.</li><li><b>App Service</b>: JAR/WAR (Java SE, Tomcat, JBoss EAP) or containers; slots, built-in auth, Java auto-instrumentation; simplest for a few web apps.</li><li><b>AKS</b>: full Kubernetes (operators, service mesh, custom networking, GPU pools); you own upgrades and capacity.</li></ul>', lvl: 'core' },
    { q: 'How do you migrate off Azure Spring Apps?', a: '<p>Azure Spring Apps is being retired; the recommended targets are Container Apps, AKS and App Service. Steps: inventory each app’s dependencies on the platform (service registry, Config Server, managed identity, custom domains, VNet injection, log streaming); containerise (Buildpacks or a Dockerfile); recreate networking, identity and observability with IaC; replace Eureka with platform DNS or a managed Eureka component; move Config Server to App Configuration or a managed Config Server; cut over per app behind Front Door, with rollback by routing.</p>', lvl: 'deep' },
    { q: 'How do you handle configuration and secrets across environments?', a: '<p>Non-secret configuration per environment in App Configuration (labels per environment), with feature flags and dynamic refresh for things that change at runtime; immutable settings as environment variables from IaC; secrets only in Key Vault, accessed by the app’s identity. The image is identical across environments; only configuration differs.</p>', lvl: 'core' },
    { q: 'How do you make sure the app scales without breaking the database?', a: '<p>Set a connection budget: <code>maxReplicas × pool size</code> per app, summed, must fit under <code>max_connections</code> with headroom. Use small Hikari pools, PgBouncer for many short transactions, read replicas for read-heavy endpoints, Redis for hot reads, and Service Bus to turn spikes into a queue the worker drains at a sustainable rate (KEDA scaling on queue length, capped).</p>', lvl: 'deep' },
    { q: 'Describe observability for this architecture.', a: '<p>The Application Insights Java agent in every image (role name per app) captures requests, JDBC, Redis, HTTP and Service Bus spans with W3C trace context, plus logs and Micrometer metrics. Container Apps system and console logs go to the same Log Analytics workspace. Dashboards and alerts on SLOs (failure rate, p95), dead-letter counts and DB connections; the transaction view follows one order from Front Door through the worker.</p>', lvl: 'core' },
    { q: 'How do you secure the API itself?', a: '<p>Entra ID as the identity provider: the SPA or client gets tokens for your API’s app registration; Spring Security as an OAuth2 resource server validates the issuer and audience and maps app roles or scopes to authorities. Front Door WAF in front, ingress restricted to Front Door, private endpoints for data, and no public network access on Postgres, Key Vault or Storage.</p>', lvl: 'core' },
    { q: 'How do database migrations fit into deployments on Container Apps?', a: '<p>Run Flyway or Liquibase as a separate step (a Container Apps job, or a pipeline step) with an identity that has DDL rights, before shifting traffic to the new revision. Keep migrations backward compatible (expand/contract), so the old and new revisions can run side by side during a traffic split and rollback is a routing change.</p>', lvl: 'deep' },
    { q: 'How does local development work with passwordless config?', a: '<p><code>DefaultAzureCredential</code> falls through to developer credentials (<code>az login</code>, IDE sign-in), so the same configuration works against a dev subscription if your user has the data-plane roles. For offline work, use Testcontainers for Postgres and emulators where they exist (Azurite for Storage), selected with a Spring profile.</p>', lvl: 'core' },
    { q: 'Java 21 virtual threads on Azure: any traps?', a: '<p>With <code>spring.threads.virtual.enabled=true</code> (Boot 3.2+), request concurrency is no longer limited by a thread pool, so the <b>connection pool</b> becomes the limit, and a burst can queue thousands of virtual threads waiting on Hikari. Keep timeouts, size pools for the database, and watch pinning on <code>synchronized</code> blocks in older drivers (improved in later JDKs).</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'application.yaml: Spring Cloud Azure 5.x, passwordless', lang: 'yaml', code: `# deps: spring-cloud-azure-starter-jdbc-postgresql, spring-cloud-azure-starter-keyvault-secrets,
#       spring-cloud-azure-stream-binder-servicebus, spring-cloud-azure-starter-storage-blob
spring:
  cloud:
    azure:
      credential:
        managed-identity-enabled: true
        client-id: \${AZURE_CLIENT_ID}               # which user-assigned identity to use
      keyvault:
        secret:
          property-source-enabled: true
          property-sources[0]:
            endpoint: https://kv-orders-prod.vault.azure.net/   # only third-party secrets live here
      servicebus:
        namespace: sb-orders-prod                    # no connection string
      storage:
        blob:
          account-name: storderdocsprod
    stream:
      function.definition: shipOrder
      bindings:
        shipOrder-in-0: { destination: orders-placed, group: shipping }
      servicebus:
        bindings:
          shipOrder-in-0:
            consumer: { entity-type: topic, auto-complete: false }
  datasource:
    url: jdbc:postgresql://pg-orders-prod.postgres.database.azure.com:5432/orders?sslmode=require
    username: id-orders                               # Postgres role mapped to the identity
    azure:
      passwordless-enabled: true
    hikari:
      maximum-pool-size: 8                            # replicas × pool must fit max_connections

server:
  shutdown: graceful
spring.lifecycle.timeout-per-shutdown-phase: 20s
management:
  endpoint.health.probes.enabled: true                # /actuator/health/liveness and /readiness` },
    { title: 'Bicep: Container App with identity, probes and scaling', lang: 'bicep', code: `resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'orders-api'
  location: location
  identity: { type: 'UserAssigned', userAssignedIdentities: { '\${uami.id}': {} } }
  properties: {
    environmentId: cae.id
    configuration: {
      ingress: { external: true, targetPort: 8080 }
      registries: [ { server: '\${acrName}.azurecr.io', identity: uami.id } ]   // AcrPull via MI
    }
    template: {
      containers: [ {
        name: 'api'
        image: image                                     // by digest, from CI
        resources: { cpu: json('1.0'), memory: '2Gi' }
        env: [
          { name: 'AZURE_CLIENT_ID', value: uami.properties.clientId }
          { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appi.properties.ConnectionString }
          { name: 'JAVA_TOOL_OPTIONS', value: '-javaagent:/agent/applicationinsights-agent.jar -XX:MaxRAMPercentage=75' }
        ]
        probes: [
          { type: 'Startup', httpGet: { path: '/actuator/health/liveness', port: 8080 }, initialDelaySeconds: 10, periodSeconds: 10, failureThreshold: 10 }
          { type: 'Liveness', httpGet: { path: '/actuator/health/liveness', port: 8080 }, periodSeconds: 10 }
          { type: 'Readiness', httpGet: { path: '/actuator/health/readiness', port: 8080 }, periodSeconds: 5 }
        ]
      } ]
      scale: {
        minReplicas: 2
        maxReplicas: 10                                  // bounded by the Postgres connection budget
        rules: [ { name: 'http', http: { metadata: { concurrentRequests: '50' } } } ]
      }
    }
  }
}`, note: 'No secret appears in the template: images, Postgres, Service Bus and Key Vault are all reached with <code>uami</code>.' },
    { title: 'Worker: Spring Cloud Stream + Service Bus, explicit completion', lang: 'java', code: `@Configuration
class ShippingFunctions {
  @Bean
  Consumer<Message<OrderPlaced>> shipOrder(ShippingService shipping) {
    return msg -> {
      OrderPlaced e = msg.getPayload();
      Checkpointer cp = (Checkpointer) msg.getHeaders().get(AzureHeaders.CHECKPOINTER);
      try {
        shipping.createShipment(e.orderId());          // idempotent: unique constraint on order_id
        cp.success().block();                          // complete the message
      } catch (Exception ex) {
        cp.failure().block();                          // abandon → redelivery, then DLQ after max delivery count
      }
    };
  }
}`, note: 'The Java agent propagates the trace context through Service Bus, so this handler’s spans join the trace of the HTTP request that published the event.' },
    { title: 'One-time setup: Postgres Entra admin and the app’s role', code: `# make yourself (or a group) the Entra admin of the server
az postgres flexible-server ad-admin create -g rg-orders -s pg-orders-prod \\
  --display-name dba-group --object-id $DBA_GROUP_OBJECT_ID --type Group

# connect as that admin with a token, then create a role for the managed identity
export PGPASSWORD=$(az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv)
psql "host=pg-orders-prod.postgres.database.azure.com dbname=postgres user=dba-group sslmode=require" \\
  -c "SELECT * FROM pgaadauth_create_principal('id-orders', false, false);"

# then, in the app database, grant only what the app needs
psql "host=pg-orders-prod.postgres.database.azure.com dbname=orders user=dba-group sslmode=require" \\
  -c 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "id-orders";'` }
  ]
});

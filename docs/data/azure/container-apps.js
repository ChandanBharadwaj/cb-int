IA.register({
  track: 'azure',
  slug: 'container-apps',
  title: 'Container Apps',
  tagline: 'Container Apps is <b>serverless Kubernetes with the Kubernetes taken out</b>. You deploy images into an <b>environment</b>. Each change to the template creates an immutable <b>revision</b>, ingress <b>splits traffic</b> between revisions by weight, <b>KEDA</b> scales replicas on events (down to zero), and <b>Dapr</b> sidecars are one flag away.',
  tldr: {
    problem: 'You want canary releases, scale-to-zero workers and managed identity for a handful of containerised Spring and Python services, without running a cluster, an ingress controller and an autoscaler yourself.',
    model: '<b>Environment</b> = shared boundary (VNet, logs, DNS). <b>App</b> = ingress + secrets + identity + a template. <b>Revision</b> = an immutable snapshot of the template. <b>Replicas</b> = running copies of a revision, sized by scale rules (KEDA). Traffic weights route requests across active revisions.',
    hook: '“How do you canary a release on Container Apps?” Multiple-revision mode, deploy at 0%, test through a label URL, shift weights 10 → 50 → 100, keep the old revision active for instant rollback.',
    facts: [
      { v: 'KEDA', l: 'powers scaling: HTTP concurrency, CPU/memory, and event sources such as Service Bus, Event Hubs, Kafka and Redis' },
      { v: '0 replicas', l: 'possible with HTTP or event scale rules. CPU and memory rules can’t scale to zero' },
      { v: '--- label', l: 'URLs (<code>app---label.&lt;env-domain&gt;</code>) reach a specific revision directly, for tests before shifting traffic' }
    ]
  },
  intro: {
    what: '<b>Azure Container Apps</b> runs your Docker images without you managing servers or Kubernetes. You say “run this image, expose port 8080, scale between 0 and 10 copies based on traffic”, and Azure handles the rest. Every time you change the image or its settings, Container Apps keeps a numbered <b>revision</b>, so you can send some users to the new version and roll back instantly.',
    analogy: { icon: '🎭', title: 'Theatre with understudies', text: 'The environment is the theatre. Each revision is a cast that knows one version of the play. The usher (ingress) sends 90% of the audience to the old cast and 10% to the new one. Actors (replicas) are called in as the crowd grows, and sent home when the hall is empty.' },
    steps: [
      { t: 'Create an environment', d: 'One per app group and stage. Choose the VNet now, because you can’t add one later.', code: 'az containerapp env create -g rg-orders -n cae-orders -l westeurope \\\n  --infrastructure-subnet-resource-id $SUBNET_ID --internal-only false' },
      { t: 'Deploy an app', d: 'An image, a port, an identity and scale limits.', code: 'az containerapp create -g rg-orders -n ca-orders --environment cae-orders \\\n  --image acrorders.azurecr.io/orders:1.4 --target-port 8080 --ingress external \\\n  --user-assigned $UAMI_ID --registry-identity $UAMI_ID --registry-server acrorders.azurecr.io \\\n  --min-replicas 1 --max-replicas 10' },
      { t: 'Ship a new revision', d: 'Change the image, and a new revision appears. In multiple-revision mode you decide its traffic share.' },
      { t: 'Scale on events', d: 'Add a KEDA rule (for example, Service Bus queue length) so workers scale out under load and back to zero.' }
    ],
    terms: [
      ['environment', 'A boundary around apps that share a VNet, a Log Analytics destination and internal DNS.'],
      ['revision', 'An immutable version of an app’s template (image, env, resources, scale). Changing these creates a new one.'],
      ['replica', 'One running instance (pod) of a revision.'],
      ['traffic split', 'Weights on active revisions that decide which one gets each request.'],
      ['KEDA', 'Kubernetes Event-driven Autoscaling: scalers that turn queue length or similar signals into replica counts.'],
      ['Dapr', 'Distributed Application Runtime: a sidecar offering pub/sub, state, service invocation and bindings through a local API.']
    ]
  },
  visual: {
    title: 'Revisions, KEDA and Dapr in motion',
    caption: '<b>Revisions & traffic split</b>: deploy v2 at 0%, test it through a label, then move the weight bar. <b>KEDA</b>: watch the queue drive replicas 0 → 3 → max 5 → 0. <b>Environment & Dapr</b>: two apps publish, invoke and store state through sidecars. Use Play or Step.'
  },
  gotchas: [
    { trap: 'Updated a secret, but the app still uses the old value', why: 'Secrets are <b>application-scope</b>: changing them doesn’t create a new revision, and running replicas keep the values they started with. For a Key Vault reference without a version, Container Apps fetches the new version within about 30 minutes and restarts active revisions that use it as an environment variable; until then, running replicas keep the old value. A version-pinned reference or a plain secret you edited never updates running replicas.', fix: 'Restart the revision after secret changes (<code>az containerapp revision restart</code>), or better, go passwordless with managed identity so there is nothing to rotate.' },
    { trap: 'CPU-based scale rule with minReplicas 0', why: 'CPU and memory rules need a running replica to measure, so they can’t wake an app from zero. The app never starts, or never scales.', fix: 'Use an HTTP-concurrency or event rule (queue length) to scale from zero. Add CPU rules only alongside them, with <code>minReplicas ≥ 1</code>.' },
    { trap: 'Planned a canary, got 100% immediately', code: `traffic: [ { latestRevision: true, weight: 100 } ]   // every deploy takes all traffic`, lang: 'bicep', why: 'In <b>single</b> revision mode, or with a traffic entry on <code>latestRevision: true</code>, each new revision automatically takes that entry’s weight.', fix: 'Switch to <code>activeRevisionsMode: \'Multiple\'</code>, give revisions explicit suffixes, and pin weights by <code>revisionName</code>. Let the pipeline move weights step by step.' },
    { trap: 'Max replicas × pool size > Postgres connections', why: 'Ten replicas with a Hikari pool of 20 is 200 connections, before the second app and the migrations job. A KEDA burst hits <code>max_connections</code> and every replica errors at once.', fix: 'Budget connections: <code>maxReplicas × maximum-pool-size</code> stays below the server limit, minus headroom. Use smaller pools, PgBouncer (built into Postgres Flexible Server), and cap <code>maxReplicas</code>.' },
    { trap: 'Scale-in kills work in progress', why: 'When KEDA scales in, replicas get SIGTERM and then a termination grace period (configurable on the template). A worker that ignores SIGTERM loses in-flight messages, or they are redelivered after the lock expires, which causes duplicates.', fix: 'Use Spring graceful shutdown, stop the Service Bus processor first, settle or abandon messages, and make handlers idempotent. Set <code>terminationGracePeriodSeconds</code> above your longest message handling time.' },
    { trap: 'The environment’s network can’t be changed later', why: 'VNet integration, internal-only mode and the subnet are chosen when the environment is created. Subnet sizing rules differ between workload-profiles environments and older consumption-only ones (per Microsoft Learn, /27 vs /23 minimum).', fix: 'Decide on private networking on day one. Create the environment in your spoke VNet with a dedicated, delegated subnet, and plan IP space for scale-out.' }
  ],
  scenarios: [
    { title: 'DB password rotated; half the replicas fail to connect',
      symptom: 'After a Key Vault rotation of <code>db-password</code>, new replicas connect fine and old ones fail with <code>FATAL: password authentication failed</code> when their pools open new connections.',
      diagnose: `az containerapp secret list -g rg-orders -n ca-orders -o table   # keyvaultref, last synced
az containerapp replica list -g rg-orders -n ca-orders --revision ca-orders--v7 \\
  --query "[].{name:name, created:properties.createdTime}" -o table`,
      cause: 'Secrets are injected when a replica starts. Replicas from before the rotation keep the old value until Container Apps syncs the versionless Key Vault reference (within about 30 minutes, per Microsoft Learn) and restarts the revision; a version-pinned reference never syncs.',
      fix: 'Short term: restart the revision. Long term: Entra authentication to Postgres with the app’s managed identity (Spring Cloud Azure passwordless), so there is no password at all.',
      fixCode: `az containerapp revision restart -g rg-orders -n ca-orders --revision ca-orders--v7
# long term (application.yml): spring.datasource.azure.passwordless-enabled: true` },
    { title: 'A queue burst took down Postgres',
      symptom: 'A partner replayed 200k messages. Workers scaled to 30 replicas in a few minutes, and then all of them, plus the API, failed with <code>too many connections for role</code>.',
      diagnose: `az containerapp show -g rg-orders -n ca-orders-worker --query "properties.template.scale"
# maxReplicas: 30, rule azure-servicebus messageCount: 5
-- in Postgres
SELECT usename, application_name, count(*) FROM pg_stat_activity GROUP BY 1,2 ORDER BY 3 DESC;`,
      cause: '30 replicas × a Hikari pool of 10 = 300 connections, more than the server allowed. The scale rule optimised for queue latency and ignored the database.',
      fix: 'Cap <code>maxReplicas</code> from the connection budget, shrink the pools, enable built-in PgBouncer, and raise <code>messageCount</code> per replica. Backlog latency is acceptable; a database outage is not.',
      fixCode: `az containerapp update -g rg-orders -n ca-orders-worker --max-replicas 8 \\
  --set-env-vars SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=5` },
    { title: 'Canary went to 100% on deploy',
      symptom: 'A release meant for a 10% canary served all users within a minute, and it had a bug.',
      diagnose: `az containerapp ingress traffic show -g rg-orders -n ca-orders
# [{ "latestRevision": true, "weight": 100 }]`,
      cause: 'The Bicep template routed 100% to <code>latestRevision</code>, so every new revision took all traffic.',
      fix: 'Roll back by weight, then pin traffic to named revisions in IaC and let the pipeline shift it.',
      fixCode: `az containerapp ingress traffic set -g rg-orders -n ca-orders \\
  --revision-weight ca-orders--v41=100 ca-orders--v42=0
az containerapp revision label add -g rg-orders -n ca-orders --label green --revision ca-orders--v42` }
  ],
  puzzles: [
    { kind: 'scenario', q: 'Which change creates a <b>new revision</b>?', options: ['Updating a secret value', 'Changing ingress from external to internal', 'Changing the container image tag', 'Changing traffic weights'], answer: 2, explain: 'Image, env vars, resources and scale rules are revision-scope (in <code>properties.template</code>). Secrets, ingress, traffic and registries are application-scope (in <code>properties.configuration</code>) and don’t create a revision.' },
    { kind: 'predict', q: 'Scale rule: Service Bus <code>messageCount: 20</code>, <code>minReplicas: 0</code>, <code>maxReplicas: 4</code>. The queue holds 130 messages. How many replicas does KEDA aim for?', options: ['7', '4', '6', '1'], answer: 1, explain: '⌈130 ÷ 20⌉ = 7 desired, capped at <code>maxReplicas</code> = <b>4</b>.' },
    { kind: 'scenario', q: 'A worker app has only a CPU scale rule and <code>minReplicas: 0</code>. Messages pile up overnight. Why?', options: ['KEDA is disabled at night', 'CPU rules can’t scale from zero; there is no replica to measure', 'The queue needs a session', 'Revisions are inactive'], answer: 1, explain: 'Scaling from zero needs an event or HTTP signal. Add a Service Bus rule, or set <code>minReplicas: 1</code>.' },
    { kind: 'scenario', q: 'You want testers to reach the new revision before any user traffic goes to it. What do you use?', options: ['A second environment', 'A revision label, which gives it its own URL', 'Session affinity', 'An internal ingress'], answer: 1, explain: 'Labels give a stable URL (<code>app---label.&lt;env-domain&gt;</code>) to a specific revision, independent of traffic weights.' },
    { kind: 'scenario', q: 'Two apps in the same environment must talk privately: <code>orders</code> calls <code>pricing</code>. Simplest approach?', options: ['A public endpoint with an API key', 'Internal ingress on pricing; orders calls http://pricing', 'A private endpoint per app', 'An Azure Relay'], answer: 1, explain: 'Apps in an environment share internal DNS. With internal ingress, <code>pricing</code> is reachable only inside the environment (or its VNet) by its name.' },
    { kind: 'scenario', q: 'What does Dapr pub/sub give you that the Service Bus SDK doesn’t?', options: ['Higher throughput', 'A broker-agnostic API through the sidecar: swap Service Bus for Kafka by changing the component, not the code', 'Exactly-once delivery', 'No need for a broker'], answer: 1, explain: 'Dapr abstracts the broker behind a local HTTP/gRPC API with CloudEvents. You still need a real broker, and delivery is at-least-once, so handlers must be idempotent.' },
    { kind: 'scenario', q: 'You need a nightly data export that runs for 40 minutes and then exits. Best fit in Container Apps?', options: ['An app with a timer endpoint', 'A Container Apps job with a schedule trigger (cron)', 'A revision with minReplicas 1', 'A Dapr binding'], answer: 1, explain: 'Jobs run to completion on manual, scheduled or event triggers, with retries and execution history. Apps are for long-running services.' }
  ],
  interview: [
    { q: 'Explain revisions and revision modes.', a: '<p>A revision is an immutable snapshot of <code>properties.template</code>. In <b>single</b> mode the newest revision gets 100% and older ones are deactivated (with zero-downtime switchover once the new one is ready). In <b>multiple</b> mode several stay active, and you set traffic weights and labels yourself, which is the basis for blue/green and canary releases.</p>', lvl: 'core' },
    { q: 'How does scaling work under the hood?', a: '<p>Each scale rule maps to a KEDA scaler. KEDA handles 0 ↔ 1 activation and feeds metrics to the Kubernetes HPA for 1 ↔ N. Defaults (per Microsoft Learn): polling every 30 s, cool-down 300 s before going to zero, and HTTP rules counting concurrent requests per replica. You set min and max replicas per app.</p>', fu: 'Why not scale a Spring API to zero? (A JVM cold start hits the first user. Keep minReplicas ≥ 1 for interactive traffic.)', lvl: 'deep' },
    { q: 'Consumption vs dedicated workload profiles?', a: '<p>A workload-profiles environment can mix the serverless <b>Consumption</b> profile (pay per use, scale to zero) with <b>dedicated</b> profiles: reserved VM-backed capacity with chosen sizes, including memory-optimised and GPU in some regions. Use dedicated for steady heavy workloads, isolation or special hardware.</p>', lvl: 'core' },
    { q: 'How do you secure a Container App?', a: '<ul><li>A user-assigned managed identity for ACR pull, Key Vault and data services.</li><li>Internal ingress or a VNet-integrated environment behind App Gateway or Front Door.</li><li>IP restrictions, built-in authentication (Easy Auth) where useful, and Key Vault-referenced secrets.</li><li>No admin credentials on ACR.</li><li>Policy for allowed images and registries.</li></ul>', lvl: 'core' },
    { q: 'What is Dapr, and when would you use it with Spring Boot?', a: '<p>A sidecar runtime with building blocks (pub/sub, state, service invocation, bindings, secrets, workflow) behind a local API. It is useful in polyglot systems or when you want broker portability. For an all-Spring estate, Spring Cloud Azure or Spring Cloud Stream already give similar abstractions, so Dapr is optional.</p>', lvl: 'core' },
    { q: 'Container Apps vs AKS: where is the line?', a: '<p>Container Apps covers the 80% case: HTTP and event-driven containers, revisions, KEDA, Dapr, jobs, identity and VNet. Choose AKS when you need the Kubernetes API (CRDs, operators, DaemonSets, custom admission or mesh), node-level control, or a shared platform for many teams.</p>', lvl: 'core' },
    { q: 'How do you run Spring Boot well on Container Apps?', a: '<p>Set <code>-XX:MaxRAMPercentage</code> to fit the container limit, enable actuator liveness and readiness probes, use graceful shutdown with a matching termination grace period, use a managed identity with passwordless Postgres and Key Vault, and use the App Insights Java agent or OpenTelemetry. Keep min replicas ≥ 1 for APIs. Managed Java components (Eureka, Config Server, Spring Boot Admin) are available if you use Spring Cloud.</p>', lvl: 'deep' },
    { q: 'How would you host an AI agent system on Container Apps?', a: '<p>Put the agent API as an app (min replicas ≥ 1) and tool or worker services as apps with KEDA queue scaling. Long evaluations or batch embedding runs become <b>jobs</b>. Each component gets its own managed identity (Azure OpenAI, AI Search, Cosmos or Postgres with pgvector). Use revisions to A/B prompts or models with traffic weights, and send traces to App Insights.</p>', lvl: 'deep' },
    { q: 'What are the observability basics?', a: '<p>Console and system logs go to Log Analytics (the <code>ContainerAppConsoleLogs</code> and <code>ContainerAppSystemLogs</code> tables, or <code>_CL</code> variants depending on how logging is configured), metrics come from Azure Monitor, and traces from App Insights or OpenTelemetry. System logs show scaling events, probe failures and image pull errors: look there first when replicas won’t start.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Bicep: app with KEDA rule, KV secret, probes', lang: 'bicep', code: `resource worker 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-orders-worker'
  location: location
  identity: { type: 'UserAssigned', userAssignedIdentities: { '\${uami.id}': {} } }
  properties: {
    environmentId: env.id
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [ { server: acr.properties.loginServer, identity: uami.id } ]
      secrets: [ {
        name: 'sb-conn'
        keyVaultUrl: '\${kv.properties.vaultUri}secrets/sb-conn'
        identity: uami.id
      } ]
    }
    template: {
      containers: [ {
        name: 'worker'
        image: '\${acr.properties.loginServer}/orders-worker:2.3.0'
        resources: { cpu: json('1.0'), memory: '2Gi' }
        env: [
          { name: 'JAVA_TOOL_OPTIONS', value: '-XX:MaxRAMPercentage=75' }
          { name: 'AZURE_CLIENT_ID', value: uami.properties.clientId }
        ]
        probes: [
          { type: 'Liveness',  httpGet: { path: '/actuator/health/liveness',  port: 8080 } }
          { type: 'Readiness', httpGet: { path: '/actuator/health/readiness', port: 8080 } }
        ]
      } ]
      scale: {
        minReplicas: 0
        maxReplicas: 8                 // from the Postgres connection budget
        rules: [ {
          name: 'orders-queue'
          custom: {
            type: 'azure-servicebus'
            metadata: { queueName: 'orders', messageCount: '20' }
            auth: [ { secretRef: 'sb-conn', triggerParameter: 'connection' } ]
          }
        } ]
      }
    }
  }
}`, note: 'Newer API versions let scale rules authenticate with a managed identity instead of a connection string. Check the current <code>Microsoft.App</code> API reference.' },
    { title: 'Canary with az', lang: 'bash', code: `az containerapp revision set-mode -g rg-orders -n ca-orders --mode multiple

az containerapp update -g rg-orders -n ca-orders \\
  --image acrorders.azurecr.io/orders:1.5 --revision-suffix v42

az containerapp revision label add -g rg-orders -n ca-orders --label green --revision ca-orders--v42
curl -fsS https://ca-orders---green.<env-domain>/actuator/health/readiness

az containerapp ingress traffic set -g rg-orders -n ca-orders --revision-weight ca-orders--v41=90 ca-orders--v42=10
# ...watch metrics...
az containerapp ingress traffic set -g rg-orders -n ca-orders --revision-weight ca-orders--v41=0 ca-orders--v42=100
az containerapp revision deactivate -g rg-orders -n ca-orders --revision ca-orders--v41` },
    { title: 'Dapr pub/sub component + Spring publisher', lang: 'yaml', code: `# pubsub.yaml → az containerapp env dapr-component set -g rg-orders -n cae-orders --dapr-component-name pubsub --yaml pubsub.yaml
componentType: pubsub.azure.servicebus.topics
version: v1
metadata:
  - name: namespaceName
    value: sb-orders.servicebus.windows.net
  - name: azureClientId              # user-assigned MI of the calling app
    value: 00000000-0000-0000-0000-000000000000
scopes:
  - ca-orders
  - ca-shipping`, note: 'In Java, publish with a plain HTTP call: <code>restClient.post().uri("http://localhost:3500/v1.0/publish/pubsub/order-created").body(evt).retrieve()</code>, or use the Dapr Java SDK’s <code>DaprClient.publishEvent</code>.' }
  ]
});

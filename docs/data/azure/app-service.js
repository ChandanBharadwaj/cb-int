IA.register({
  track: 'azure',
  slug: 'app-service',
  title: 'App Service',
  tagline: 'App Service runs your web app on a <b>plan</b>: a pool of VM instances you pay for whether or not they are busy. Every app in the plan runs on every instance. <b>Slots</b> give zero-downtime swaps with warm-up, and <b>Health check</b> plus <b>Always On</b> keep instances warm and remove sick ones. For a Spring Boot JAR it is the shortest path to production.',
  tldr: {
    problem: 'Deploys that restart production, a first request after lunch that takes 30 seconds, one app starving the others in a shared plan, and swaps that bring staging’s database URL into production.',
    model: '<b>Plan</b> = SKU × instance count (the compute). <b>App</b> = your code plus config, running on all of the plan’s instances. <b>Slot</b> = another live app on the same plan; a swap warms it with production settings, then flips routing. <b>Health check</b> takes failing instances out of the load balancer.',
    hook: '“How do you deploy with zero downtime on App Service?” Deploy to a staging slot, mark environment-specific settings as slot settings, swap (with warm-up on your health path), and swap back to roll back.',
    facts: [
      { v: 'Standard+', l: 'tier needed for deployment slots and autoscale rules (per Microsoft Learn; slot counts grow with the tier)' },
      { v: '≈ 20 min', l: 'of inactivity before an app without <b>Always On</b> is unloaded; the next request pays the JVM start' },
      { v: '1 min', l: 'Health check ping interval. An instance is removed after 2–10 consecutive failures (configurable)' }
    ]
  },
  intro: {
    what: '<b>App Service</b> is Azure’s managed web hosting. You give it your code (for Java, a JAR or WAR) or a container, and it runs it on servers Azure manages: OS patches, load balancing, TLS certificates and scaling are handled for you. You pay for an <b>App Service plan</b>, which is a reserved set of machines. You can put one or many apps on a plan.',
    analogy: { icon: '🏬', title: 'A shop unit in a mall', text: 'The plan is the shop unit you rent (its size is the SKU; renting more units is scaling out). Each app is a counter in every unit. A deployment slot is a back room where you set up the new display, then swap it onto the shop floor in one move.' },
    steps: [
      { t: 'Create a plan and an app', d: 'Choose Linux and Java SE 21 for a Spring Boot JAR (Tomcat and JBoss EAP are also offered).', code: 'az appservice plan create -g rg-orders -n asp-orders --is-linux --sku P1v3\naz webapp create -g rg-orders -p asp-orders -n app-orders --runtime "JAVA:21-java21"' },
      { t: 'Deploy the JAR', d: 'From CI, deploy to a staging slot, not straight to production.', code: 'az webapp deploy -g rg-orders -n app-orders --slot staging --src-path target/orders.jar --type jar' },
      { t: 'Swap into production', d: 'The platform warms up the staging instances with production settings, then flips traffic.', code: 'az webapp deployment slot swap -g rg-orders -n app-orders --slot staging --target-slot production' },
      { t: 'Keep it healthy', d: 'Turn on Always On and a Health check path, and add autoscale rules with scale-in as well as scale-out.' }
    ],
    terms: [
      ['App Service plan', 'The compute: OS, region, SKU (B1, S1, P1v3…) and instance count. Billed whether or not apps are busy.'],
      ['scale up / scale out', 'Up = a bigger SKU (more CPU/RAM per instance). Out = more instances.'],
      ['deployment slot', 'A separate live app (with its own hostname) on the same plan, used for staging and swaps.'],
      ['slot setting', 'An app setting or connection string marked “sticky”, which stays with its slot during a swap.'],
      ['Always On', 'Keeps the app loaded with periodic pings, so it isn’t unloaded when idle.'],
      ['Health check', 'A path the platform pings on each instance. Failing instances are removed from the load balancer.']
    ]
  },
  visual: {
    title: 'Scale-out, slot swap, health check',
    caption: '<b>Plan scale-out</b>: CPU rises, autoscale adds instances, and <i>both</i> apps land on each one. <b>Slot swap</b>: deploy to staging, apply production settings, warm up, flip. <b>Health check</b>: a sick instance is pinged, removed from rotation, then replaced. Press Play or Step.'
  },
  gotchas: [
    { trap: 'Staging’s settings ride into production on swap', why: 'Only settings marked <b>deployment slot setting</b> stay with a slot. Anything else (a DB URL, a feature flag) moves with the code. Forget the checkbox once, and production points at the staging database.', fix: 'Mark every environment-specific setting as sticky (<code>--slot-settings</code> in the CLI), keep secrets in Key Vault references, and check them in a swap-with-preview before completing.' },
    { trap: 'Cold first request even on a paid plan', why: 'Without <b>Always On</b> an idle app is unloaded after about 20 minutes. After a swap or restart, the first request also pays JVM start and Spring context refresh unless warm-up hits the app first.', fix: 'Enable Always On, set a Health check path, and set <code>WEBSITE_SWAP_WARMUP_PING_PATH=/actuator/health/readiness</code> (with <code>WEBSITE_SWAP_WARMUP_PING_STATUSES=200</code>) so swaps wait for readiness.' },
    { trap: 'Intermittent outbound timeouts under load (SNAT exhaustion)', why: 'Outbound connections to public endpoints go through a limited pool of SNAT ports per instance. Creating a new HTTP client or DB connection per request exhausts it, and calls fail with timeouts that look random.', fix: 'Reuse connections: one shared <code>RestClient</code>/<code>WebClient</code> with pooling, Hikari for the DB, and keep-alive. Use private endpoints for Azure services, or VNet integration with a NAT gateway for many outbound connections.' },
    { trap: 'Health check that fails when a dependency blips', why: 'If <code>/health</code> includes the database or an external API, one slow dependency makes every instance “unhealthy”. Health check then removes instances or recycles them, turning a partial outage into a full one.', fix: 'Point Health check at a readiness group that checks only what the instance itself needs. Keep deep dependency checks for dashboards and alerts.' },
    { trap: 'Auto swap on Linux, or expecting swaps to be instant', why: 'Auto swap isn’t supported for Linux apps and custom containers (per Microsoft Learn). A swap restarts the source slot with the target’s settings and waits for warm-up, so it takes minutes, not seconds.', fix: 'Script the swap in CI after smoke tests. For big changes use <code>--action preview</code> (multi-phase swap), validate, then <code>--action swap</code>.' },
    { trap: 'Changing an app setting restarts the app', why: 'App settings are environment variables. Changing one restarts the app on every instance: a small blip at a bad time.', fix: 'Change configuration through slots (change staging, then swap), or move dynamic config to Azure App Configuration with refresh.' },
    { trap: 'ARR affinity on a stateless API', why: 'The ARR affinity cookie (on by default) pins clients to an instance. After a scale-out, new instances get almost no traffic while the old ones stay hot.', fix: 'Turn it off (<code>az webapp update --client-affinity-enabled false</code>) and keep sessions in Redis if you need them.' }
  ],
  scenarios: [
    { title: 'After a swap, production wrote orders into the staging database',
      symptom: 'Right after a 14:00 swap, new orders were missing from production reports. They were found in the staging database.',
      diagnose: `az webapp config appsettings list -g rg-orders -n app-orders --slot staging \\
  --query "[?name=='SPRING_DATASOURCE_URL'].{v:value, sticky:slotSetting}"
# sticky: false  ← the URL moved with the code`,
      cause: 'The datasource URL wasn’t marked as a slot setting, so it swapped along with v1.5.',
      fix: 'Swap back immediately (production returns to its old values), mark the setting sticky in both slots, and reconcile the orders. Add a pipeline check that every <code>*_URL</code> setting is a slot setting.',
      fixCode: `az webapp deployment slot swap -g rg-orders -n app-orders --slot staging   # roll back
az webapp config appsettings set -g rg-orders -n app-orders \\
  --slot-settings SPRING_DATASOURCE_URL="jdbc:postgresql://pg-orders-prod...:5432/orders?sslmode=require"
az webapp config appsettings set -g rg-orders -n app-orders --slot staging \\
  --slot-settings SPRING_DATASOURCE_URL="jdbc:postgresql://pg-orders-stg...:5432/orders?sslmode=require"` },
    { title: 'Random 30-second timeouts calling a partner API',
      symptom: 'Under peak load, around 2% of calls to <code>api.partner.example</code> time out. CPU and memory look fine.',
      diagnose: 'Portal → app → Diagnose and solve problems → “SNAT Port Exhaustion”. Then search the code for <code>new RestTemplate()</code> or <code>HttpClient.newHttpClient()</code> inside request handlers.',
      cause: 'A new HTTP client was built per request, so connections were never reused and the instance ran out of SNAT ports.',
      fix: 'Share one pooled client bean with keep-alive. For heavy outbound traffic, add VNet integration with a NAT gateway.',
      fixCode: `@Bean
RestClient partnerClient(RestClient.Builder b) {
  var cm = PoolingHttpClientConnectionManagerBuilder.create()
      .setMaxConnTotal(200).setMaxConnPerRoute(50).build();
  var http = HttpClients.custom().setConnectionManager(cm).evictIdleConnections(TimeValue.ofSeconds(30)).build();
  return b.baseUrl("https://api.partner.example")
          .requestFactory(new HttpComponentsClientHttpRequestFactory(http)).build();
}`, lang: 'java' },
    { title: 'Health check drained the whole app during a database blip',
      symptom: 'A 90-second Postgres failover turned into a 12-minute outage. Instances kept being removed and restarted.',
      diagnose: `curl -s https://app-orders.azurewebsites.net/actuator/health | jq   # includes "db": DOWN → overall DOWN
az webapp config show -g rg-orders -n app-orders --query healthCheckPath`,
      cause: 'Health check pointed at <code>/actuator/health</code>, which includes the database indicator. Every instance went unhealthy at once and was cycled, causing cold JVM starts just as the database came back.',
      fix: 'Point Health check at a readiness group without hard external dependencies, and handle database outages with retries and circuit breakers instead of instance recycling.',
      fixCode: `management.endpoint.health.group.readiness.include=readinessState,diskSpace
az webapp update -g rg-orders -n app-orders --set siteConfig.healthCheckPath=/actuator/health/readiness` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Plan <code>asp-shared</code> hosts <code>orders</code> and <code>admin</code>. Autoscale takes the plan from 2 to 5 instances. On how many instances does <code>admin</code> run (no per-app scaling)?', options: ['2', '1', '5', 'It depends on admin’s own CPU'], answer: 2, explain: 'Every app runs on every instance of its plan, so <b>5</b>. Per-app scaling (<code>numberOfWorkers</code>) can cap an app, but it isn’t the default.' },
    { kind: 'predict', q: 'During a swap from staging to production, setting <code>FEATURE_X=true</code> (not sticky) is on staging and <code>DB_URL</code> (sticky) differs per slot. After the swap, what does production have?', options: ['FEATURE_X=true and staging’s DB_URL', 'FEATURE_X=true and production’s DB_URL', 'Production’s old FEATURE_X and DB_URL', 'Neither: settings never move'], answer: 1, explain: 'Non-sticky settings travel with the code, so FEATURE_X=true arrives. Sticky settings stay with the slot, so production keeps its own DB_URL.' },
    { kind: 'scenario', q: 'An app runs on a single instance with Health check enabled. The instance starts failing the check. What happens?', options: ['It is removed and traffic gets 503s', 'It is replaced within a minute', 'It isn’t removed from the load balancer, because there is no other instance to send traffic to', 'The plan scales out automatically'], answer: 2, explain: 'Health check’s removal only helps with 2+ instances. With one instance there is nowhere else to route, so run at least two instances in production.' },
    { kind: 'scenario', q: 'An internal tool on an S1 plan takes 25 s to answer the first request each morning, then it’s fast. Most likely fix?', options: ['Scale up to P3v3', 'Enable Always On', 'Disable ARR affinity', 'Add a deployment slot'], answer: 1, explain: 'Without Always On the app is unloaded after about 20 minutes idle, and the next request pays JVM and Spring startup. Always On keeps it loaded.' },
    { kind: 'scenario', q: 'Under load, outbound calls to a third-party API intermittently time out while CPU is at 30%. What do you suspect first?', options: ['A JVM heap too small', 'SNAT port exhaustion from not reusing connections', 'DNS caching', 'The deployment slot'], answer: 1, explain: 'Outbound connections share a limited SNAT port pool per instance. A client per request uses ports up quickly. Pool and reuse connections; consider a NAT gateway.' },
    { kind: 'scenario', q: 'You need a staging deployment slot and metric-based autoscale. What is the lowest tier family that offers both?', options: ['Free', 'Basic', 'Standard', 'Only Isolated'], answer: 2, explain: 'Slots and autoscale rules start at Standard. Basic has neither. Slot counts grow at Premium and Isolated; check Microsoft Learn for current numbers.' }
  ],
  interview: [
    { q: 'Explain the relationship between an App Service plan and an app.', a: '<p>The plan is the server farm: region, OS, SKU and instance count, and it is billed per instance. Apps are deployed onto the plan and run on <i>every</i> instance (unless per-app scaling limits them). Scaling is configured on the plan. Density is good for cost and bad for isolation.</p>', lvl: 'core' },
    { q: 'Walk through exactly what happens during a slot swap.', a: '<ol><li>The target’s sticky settings are applied to the source slot’s instances, which restart.</li><li>Warm-up requests hit each instance (the root path, <code>applicationInitialization</code> or <code>WEBSITE_SWAP_WARMUP_PING_PATH</code>) until they respond.</li><li>Routing rules flip, so production traffic hits the warm instances without a restart.</li><li>The old production code now sits in the source slot, ready for rollback.</li></ol><p>With <i>swap with preview</i> you can validate after step 1 before completing.</p>', lvl: 'deep' },
    { q: 'How do you deploy a Spring Boot app to App Service, and what do you configure for Java?', a: '<p>Use the Java SE stack on Linux (21 for new apps), deploy the JAR with <code>az webapp deploy --type jar</code>, the Maven plugin or GitHub Actions. Set JVM flags with <code>JAVA_OPTS</code> (for example, <code>-XX:MaxRAMPercentage=75</code>). Use a managed identity and Key Vault references for secrets, and turn on the Application Insights Java agent (auto-instrumentation). Health check goes on the actuator readiness endpoint.</p>', lvl: 'core' },
    { q: 'Autoscale rules vs automatic scaling?', a: '<p><b>Autoscale rules</b> (Azure Monitor autoscale, Standard and above): metric thresholds such as CPU or queue length, with scale-in rules, cool-downs and schedules. <b>Automatic scaling</b> (Premium v2/v3 class plans, per Microsoft Learn): the platform scales on HTTP load with pre-warmed instances and per-app maximums. It is simpler, but gives you less control.</p>', lvl: 'deep' },
    { q: 'What does Always On do, and when don’t you need it?', a: '<p>It pings the app so it is never unloaded for inactivity. You need it for production web apps, continuous WebJobs and anything with a slow start. You don’t need it on Functions plans, where scaling is handled differently, and it isn’t available on Free or Shared tiers.</p>', lvl: 'core' },
    { q: 'How do you make an App Service app private?', a: '<p><b>Inbound</b>: a private endpoint on the app (and disable public access, or use access restrictions), typically behind Application Gateway or Front Door with Private Link. <b>Outbound</b>: VNet integration, so the app reaches private endpoints for Postgres and Key Vault, plus private DNS zones. Optionally add a NAT gateway for a static outbound IP.</p>', lvl: 'core' },
    { q: 'How do Health check and the Spring Boot actuator work together?', a: '<p>Enable <code>management.endpoint.health.probes.enabled</code>, and point Health check at <code>/actuator/health/readiness</code>. Keep the readiness group to local concerns. During graceful shutdown readiness turns DOWN, so the platform drains the instance. Avoid including the database in the health path used for instance eviction.</p>', lvl: 'deep' },
    { q: 'What are the limits of App Service you design around?', a: '<p>No scale to zero (you pay per instance). Outbound SNAT limits. A request timeout at the front end (about 230 s). One OS and region per plan. Slot and instance counts depend on the tier, and the local disk is ephemeral apart from <code>/home</code>. For event-driven or scale-to-zero work, look at Functions or Container Apps.</p>', lvl: 'core' },
    { q: 'How do you roll back a bad release?', a: '<p>If you swapped, swap again: the previous version is warm in the other slot. Otherwise redeploy the previous artefact. This only works if database changes are backward-compatible (expand/contract migrations with Flyway or Liquibase) and config is versioned.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Bicep: plan, app, staging slot, health', lang: 'bicep', code: `resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: 'asp-orders-prod'
  location: location
  kind: 'linux'
  sku: { name: 'P1v3', capacity: 2 }
  properties: { reserved: true }
}

resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: 'app-orders'
  location: location
  identity: { type: 'UserAssigned', userAssignedIdentities: { '\${uami.id}': {} } }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      linuxFxVersion: 'JAVA|21-java21'
      alwaysOn: true
      healthCheckPath: '/actuator/health/readiness'
      appSettings: [
        { name: 'JAVA_OPTS', value: '-XX:MaxRAMPercentage=75' }
        { name: 'AZURE_CLIENT_ID', value: uami.properties.clientId }
        { name: 'WEBSITE_SWAP_WARMUP_PING_PATH', value: '/actuator/health/readiness' }
        { name: 'WEBSITE_SWAP_WARMUP_PING_STATUSES', value: '200' }
      ]
    }
  }
}

resource staging 'Microsoft.Web/sites/slots@2023-12-01' = {
  parent: app
  name: 'staging'
  location: location
  properties: { serverFarmId: plan.id }
}

resource sticky 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: app
  name: 'slotConfigNames'
  properties: { appSettingNames: [ 'SPRING_DATASOURCE_URL', 'SPRING_PROFILES_ACTIVE' ] }
}` },
    { title: 'GitHub Actions: deploy to staging, smoke test, swap', lang: 'yaml', code: `permissions: { id-token: write, contents: read }
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: prod
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '21', cache: maven }
      - run: ./mvnw -B package -DskipTests
      - uses: azure/login@v2
        with:
          client-id: \${{ vars.AZURE_CLIENT_ID }}
          tenant-id: \${{ vars.AZURE_TENANT_ID }}
          subscription-id: \${{ vars.AZURE_SUBSCRIPTION_ID }}
      - uses: azure/webapps-deploy@v3
        with: { app-name: app-orders, slot-name: staging, package: target/orders.jar }
      - run: curl -fsS --retry 10 --retry-delay 6 https://app-orders-staging.azurewebsites.net/actuator/health/readiness
      - run: az webapp deployment slot swap -g rg-orders -n app-orders --slot staging --target-slot production` },
    { title: 'Autoscale with scale-in (az)', lang: 'bash', code: `PLAN_ID=$(az appservice plan show -g rg-orders -n asp-orders-prod --query id -o tsv)
az monitor autoscale create -g rg-orders -n as-orders --resource $PLAN_ID --min-count 2 --max-count 8 --count 2

az monitor autoscale rule create -g rg-orders --autoscale-name as-orders \\
  --condition "CpuPercentage > 70 avg 10m" --scale out 1 --cooldown 10
az monitor autoscale rule create -g rg-orders --autoscale-name as-orders \\
  --condition "CpuPercentage < 35 avg 15m" --scale in 1 --cooldown 15

# live logs while you test
az webapp log tail -g rg-orders -n app-orders`, note: 'Keep the scale-out and scale-in thresholds far enough apart to avoid flapping, and keep at least 2 instances for Health check and zone redundancy to work.' }
  ]
});

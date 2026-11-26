IA.register({
  track: 'azure',
  slug: 'azure-first-deploy',
  title: 'Deploy your first app',
  tagline: 'Put a Spring Boot jar on <b>App Service</b> in about five commands: resource group, plan, web app, deploy, browse. Configure it with <b>app settings</b> (environment variables), debug it with the <b>log stream</b>, and <b>delete the group</b> when you’re done.',
  tldr: {
    problem: 'A first deploy usually fails on small things: the wrong Java version, a hard-coded port or <code>localhost</code> database URL, no logs to look at, and a plan left running for weeks afterwards.',
    model: 'An <b>App Service plan</b> is the set of VMs you pay for. A <b>web app</b> runs on a plan with a runtime stack (Java SE for a jar). You deploy the jar; App Service starts it and routes HTTPS to it. <b>App settings</b> are injected as env vars, so Spring’s relaxed binding picks them up.',
    hook: '“It works locally but returns 503 on Azure.” Open the log stream: nine times out of ten the JVM failed at startup, often on a missing setting.',
    facts: [
      { v: 'env vars', l: 'App settings reach the app as environment variables, e.g. <code>SPRING_DATASOURCE_URL</code> overrides <code>spring.datasource.url</code>' },
      { v: 'restart', l: 'changing app settings restarts the app' },
      { v: 'plan bills', l: 'a paid App Service plan bills while it exists, even if its apps are stopped or idle' }
    ]
  },
  intro: {
    what: '<b>App Service</b> is Azure’s managed web hosting. You give it your application; it provides the servers, the Java runtime, HTTPS, scaling and logs. For a Spring Boot app you can deploy the executable jar directly. No container or Kubernetes needed.',
    analogy: { icon: '🏨', title: 'A serviced apartment', text: 'The plan is the apartment you rent (size decides the price). The web app is you moving in with your suitcase (the jar). App settings are the notes on the fridge telling you the Wi-Fi password. The log stream is the intercom. Checking out (deleting the group) stops the rent.' },
    steps: [
      { t: 'Build the jar', d: 'A plain Spring Boot app with an actuator health endpoint is ideal.', code: './mvnw -q package -DskipTests\nls target/*.jar', lang: 'bash' },
      { t: 'Create a group, plan and app', d: 'Linux plan, Java SE runtime matching your JDK.', code: 'az group create -n rg-hello-dev -l westeurope\naz appservice plan create -g rg-hello-dev -n plan-hello --is-linux --sku B1\naz webapp create -g rg-hello-dev -p plan-hello -n app-hello-$RANDOM --runtime "JAVA:21-java21"', lang: 'bash' },
      { t: 'Deploy', d: 'Upload the jar; App Service runs it.', code: 'az webapp deploy -g rg-hello-dev -n <app-name> --src-path target/demo-0.0.1-SNAPSHOT.jar --type jar', lang: 'bash' },
      { t: 'Configure with app settings', d: 'Never bake environment-specific values into the jar.', code: 'az webapp config appsettings set -g rg-hello-dev -n <app-name> --settings SPRING_PROFILES_ACTIVE=azure', lang: 'bash' },
      { t: 'Watch logs, then clean up', d: 'Turn on logging and tail it. Delete the group when finished.', code: 'az webapp log config -g rg-hello-dev -n <app-name> --docker-container-logging filesystem\naz webapp log tail -g rg-hello-dev -n <app-name>\naz group delete -n rg-hello-dev --yes --no-wait', lang: 'bash' }
    ],
    terms: [
      ['App Service plan', 'The compute (size, instance count, OS) that apps run on and that you pay for.'],
      ['web app', 'One application on a plan, with its own hostname, settings and deployments.'],
      ['runtime stack', 'The language/runtime image, e.g. Java SE 21 on Linux.'],
      ['app settings', 'Key-value config injected as environment variables.'],
      ['log stream', 'Live view of the app’s console output (<code>az webapp log tail</code>).'],
      ['Kudu / SCM site', 'The deployment and diagnostics site at <code>&lt;app&gt;.scm.azurewebsites.net</code>.']
    ]
  },
  visual: {
    title: 'From mvn package to a live URL, and back to zero',
    caption: 'Press Play to build, create the plan and app, deploy the jar, add app settings, open the URL, tail logs and finally delete the resource group.'
  },
  gotchas: [
    { trap: 'Runtime version doesn’t match your build', why: 'A jar compiled for Java 21 fails on a Java 17 stack with <code>UnsupportedClassVersionError</code>.', fix: 'Pick the matching runtime. List options with <code>az webapp list-runtimes --os-type linux</code>.' },
    { trap: 'Hard-coding a port', code: 'server.port=9090   # in application.properties', lang: 'text', why: 'App Service forwards traffic to the port the platform expects. A different hard-coded port means the health check never succeeds and the site returns errors.', fix: 'Leave <code>server.port</code> to the platform. If you must change it, follow the App Service Java docs for the port setting rather than guessing.' },
    { trap: '<code>localhost</code> in the datasource URL', why: 'There is no Postgres on the App Service instance. The app fails at startup.', fix: 'Set <code>SPRING_DATASOURCE_URL</code> as an app setting pointing at your Flexible Server, ideally with a managed identity instead of a password. See <a href="app-service.html">App Service</a>.' },
    { trap: 'Secrets typed into app settings', why: 'Anyone with read access to the app’s configuration sees them, and they get copied between environments.', fix: 'Use Key Vault references (<code>@Microsoft.KeyVault(...)</code>) or, better, managed identity. See <a href="key-vault.html">Key Vault</a>.' },
    { trap: 'No logs to look at', why: 'Filesystem application logging is off by default on Linux, so the log stream may show little.', fix: 'Enable it with <code>az webapp log config</code>, and add Application Insights for real telemetry. See <a href="monitor-app-insights.html">Monitor & App Insights</a>.' },
    { trap: 'Stopping the app to save money', why: 'The <b>plan</b> is what bills. A stopped app on a paid plan still costs the plan’s price.', fix: 'Delete the resource group, or scale the plan down, when not in use.' }
  ],
  scenarios: [
    { title: '503 after the first deploy',
      symptom: 'The deploy command succeeds, but the URL shows “Application Error” or 503.',
      diagnose: 'az webapp log tail -g rg-hello-dev -n app-hello-123\n# ... Caused by: java.net.ConnectException: Connection refused (localhost:5432)',
      cause: 'The jar still uses the dev <code>application.properties</code> datasource URL.',
      fix: 'Add an Azure profile and set the URL through app settings.',
      fixCode: 'az webapp config appsettings set -g rg-hello-dev -n app-hello-123 --settings \\\n  SPRING_PROFILES_ACTIVE=azure \\\n  SPRING_DATASOURCE_URL="jdbc:postgresql://pg-hello.postgres.database.azure.com:5432/app?sslmode=require"', lang: 'bash' },
    { title: 'A tutorial costs money for two months',
      symptom: 'The team’s learning subscription shows steady charges from an app nobody uses.',
      diagnose: 'az appservice plan list --query "[].{name:name, rg:resourceGroup, sku:sku.name}" -o table',
      cause: 'The web app was stopped but the paid plan was never deleted.',
      fix: 'Delete the whole resource group. Add a budget alert on the subscription.',
      fixCode: 'az group delete -n rg-hello-dev --yes --no-wait', lang: 'bash' }
  ],
  puzzles: [
    { kind: 'concept', q: 'What do you pay for on App Service?', options: ['Each HTTP request', 'The App Service plan (its size and instance count)', 'Each deployment', 'Only when the app is running'], answer: 1, explain: 'Apps share their plan’s VMs. The plan bills while it exists (free tiers aside).' },
    { kind: 'concept', q: 'You set the app setting <code>SPRING_DATASOURCE_USERNAME=app</code>. What does Spring Boot do with it?', options: ['Ignores it', 'Binds it to <code>spring.datasource.username</code> via relaxed binding', 'Writes it to application.yml', 'Requires a restart of the plan'], answer: 1, explain: 'App settings become env vars, and Spring maps <code>SPRING_DATASOURCE_USERNAME</code> to <code>spring.datasource.username</code>, overriding the file.' },
    { kind: 'concept', q: 'The site shows an error after deploy. What is your first step?', options: ['Redeploy', 'Scale up the plan', 'Read the log stream / container logs', 'Delete the app'], answer: 2, explain: 'Startup failures show up in the JVM output. Look before you change anything.' },
    { kind: 'concept', q: 'Which is the cleanest way to remove everything from the tutorial?', options: ['Stop the web app', 'Delete the web app only', 'Delete the resource group', 'Remove the jar'], answer: 2, explain: 'The group holds the plan, the app and anything else you created, so one delete removes them all.' },
    { kind: 'concept', q: 'Your jar was built with Java 21. Which runtime should the web app use?', options: ['Tomcat 9 with Java 8', 'Java SE 21', 'Node 22', 'Any Java version'], answer: 1, explain: 'A jar needs the Java SE stack with a runtime at least as new as the class file target.' },
    { kind: 'concept', q: 'Why not put the database password straight into app settings for production?', options: ['App settings have a size limit', 'Anyone with config read access can see it; prefer Key Vault references or managed identity', 'It breaks relaxed binding', 'App settings are public'], answer: 1, explain: 'App settings are encrypted at rest but readable by anyone with enough RBAC. Use Key Vault or passwordless auth.' }
  ],
  interview: [
    { q: 'Walk through deploying a Spring Boot jar to App Service.', a: '<ol><li>Resource group</li><li>Linux App Service plan</li><li>Web app with the Java SE runtime</li><li><code>az webapp deploy --type jar</code> (or the Maven plugin, or a pipeline)</li><li>App settings for profile and datasource</li><li>Enable logs / App Insights, check health</li></ol>', lvl: 'core' },
    { q: 'What is the difference between an App Service plan and a web app?', a: '<p>The plan is the compute: OS, size, instance count and price. A web app is one application running on it. Several apps can share a plan and its capacity.</p>', lvl: 'core' },
    { q: 'How do you pass configuration to a Spring app on App Service?', a: '<p>App settings (env vars) picked up by relaxed binding, Key Vault references for secrets, or Spring Cloud Azure App Configuration. Keep the jar the same across environments.</p>', lvl: 'core' },
    { q: 'How do you troubleshoot a startup failure?', a: '<p>Log stream (<code>az webapp log tail</code>), the Diagnose and solve problems blade, the Kudu/SCM site, and Application Insights. Look for the first exception in the JVM output.</p>', lvl: 'core' },
    { q: 'What happens when you change an app setting?', a: '<p>The app restarts so the new environment variables take effect. Plan changes for low-traffic times, or use deployment slots.</p>', lvl: 'core' },
    { q: 'What are deployment slots?', a: '<p>Extra live copies of the app (e.g. <i>staging</i>) on the same plan, on paid tiers that support them. Deploy to staging, warm it up, then swap with production for near-zero downtime.</p>', lvl: 'core' },
    { q: 'How do you avoid leaving costs behind after experiments?', a: '<p>One resource group per experiment, delete it when done, tag owners, and set budget alerts. A stopped app still incurs its plan cost.</p>', lvl: 'core' },
    { q: 'How would you automate this deploy?', a: '<p>Bicep for the plan and app, then a GitHub Actions or Azure Pipelines job that builds the jar and deploys it, authenticated with workload identity federation rather than stored secrets.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'The whole first deploy', lang: 'bash', code: 'set -euo pipefail\nRG=rg-hello-dev; LOC=westeurope; APP=app-hello-$RANDOM\n\n./mvnw -q package -DskipTests\naz group create -n $RG -l $LOC -o none\naz appservice plan create -g $RG -n plan-hello --is-linux --sku B1 -o none\naz webapp create -g $RG -p plan-hello -n $APP --runtime "JAVA:21-java21" -o none\naz webapp config appsettings set -g $RG -n $APP --settings SPRING_PROFILES_ACTIVE=azure -o none\naz webapp deploy -g $RG -n $APP --src-path target/*.jar --type jar\n\necho "https://$(az webapp show -g $RG -n $APP --query defaultHostName -o tsv)"\naz webapp log config -g $RG -n $APP --docker-container-logging filesystem -o none\naz webapp log tail -g $RG -n $APP\n\n# later\naz group delete -n $RG --yes --no-wait', note: 'Runtime strings and SKUs change; check <code>az webapp list-runtimes --os-type linux</code>.' },
    { title: 'Spring side: an Azure profile', lang: 'java', code: '// src/main/resources/application-azure.properties\n// spring.datasource.url=${SPRING_DATASOURCE_URL}\n// management.endpoints.web.exposure.include=health\n\n@SpringBootApplication\npublic class HelloApplication {\n  public static void main(String[] args) { SpringApplication.run(HelloApplication.class, args); }\n}\n\n@RestController\nclass HelloController {\n  @Value("${spring.profiles.active:local}") String profile;\n  @GetMapping("/") String hi() { return "Hello from " + profile; }\n}', note: 'Set the App Service health check path to <code>/actuator/health</code> once actuator is on the classpath.' },
    { title: 'Plan and app in Bicep', lang: 'bicep', code: 'param location string = resourceGroup().location\nparam appName string\n\nresource plan \'Microsoft.Web/serverfarms@2023-12-01\' = {\n  name: \'plan-hello\'\n  location: location\n  kind: \'linux\'\n  sku: { name: \'B1\' }\n  properties: { reserved: true }   // required for Linux\n}\n\nresource app \'Microsoft.Web/sites@2023-12-01\' = {\n  name: appName\n  location: location\n  properties: {\n    serverFarmId: plan.id\n    httpsOnly: true\n    siteConfig: {\n      linuxFxVersion: \'JAVA|21-java21\'\n      appSettings: [ { name: \'SPRING_PROFILES_ACTIVE\', value: \'azure\' } ]\n    }\n  }\n}' }
  ]
});

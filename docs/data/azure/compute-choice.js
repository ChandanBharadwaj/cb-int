IA.register({
  track: 'azure',
  slug: 'compute-choice',
  title: 'Choosing compute',
  tagline: 'Five main ways to run code on Azure, ordered by how much you manage: <b>VMs</b> → <b>AKS</b> → <b>Container Apps</b> → <b>App Service</b> → <b>Functions</b>. Pick the <b>highest abstraction that still fits</b> the workload’s real constraints (OS access, Kubernetes API, event shape, deploy unit), then justify each step down.',
  tldr: {
    problem: 'Teams pick AKS because it’s on their CV, or Functions because “serverless is cheap”. A year later they’re running a Kubernetes platform for three services, or fighting a 230-second HTTP limit.',
    model: 'Ask four questions in order. Need OS control? → VMs. Short event-driven units? → Functions. Need the Kubernetes API itself? → AKS. Shipping containers? → Container Apps, otherwise App Service. Then check networking, scale-to-zero, cold start and team skills.',
    hook: '“Spring Boot microservices, small team, needs scale to zero and canary releases. What do you pick?” Container Apps: revisions with traffic split, KEDA scale rules, and no cluster to run.',
    facts: [
      { v: '5 options', l: 'cover most cases: VMs/VMSS, AKS, Container Apps, App Service and Functions (Batch, Spring Apps and others are niches)' },
      { v: 'K8s inside', l: 'Container Apps runs on Kubernetes with KEDA, Dapr and Envoy, but hides the Kubernetes API from you' },
      { v: '230 s', l: 'is the documented maximum time for an HTTP-triggered function to respond, because of the front-end load balancer’s idle timeout' }
    ]
  },
  intro: {
    what: 'Azure gives you several “places” to run your application. They differ in <b>how much you manage yourself</b>. With a virtual machine you manage everything from the operating system up. With App Service you upload your JAR and Azure runs it. With Functions you write a single method that runs when something happens. More control means more work. Less work means more constraints.',
    analogy: { icon: '🚗', title: 'Own, lease, taxi', text: 'A VM is owning a car: you choose everything, and you do the servicing. AKS is running a fleet with your own mechanics. Container Apps and App Service are a full-service lease: you drive, they maintain. Functions is a taxi: you pay per ride and wait a moment when none is nearby (a cold start).' },
    steps: [
      { t: 'List the hard constraints', d: 'OS agents, GPU drivers, Kubernetes operators, long-running requests, private networking, compliance.' },
      { t: 'Find the event shape', d: 'Always-on HTTP service? Bursty queue consumer? Nightly batch? Each fits a different model.' },
      { t: 'Choose the deploy unit', d: 'A JAR (App Service, Functions), a container image (Container Apps, AKS, App Service for containers) or a VM image.' },
      { t: 'Check the second-order needs', d: 'Scale to zero, cold-start tolerance, slots or revisions, VNet integration, cost at idle, and who carries the pager.' }
    ],
    terms: [
      ['IaaS / PaaS / serverless', 'You manage the OS / you manage the app / you manage just code, and the platform scales it (often to zero).'],
      ['VMSS', 'Virtual Machine Scale Sets: identical VMs that autoscale behind a load balancer.'],
      ['AKS', 'Azure Kubernetes Service. Microsoft runs the control plane; you run node pools and workloads.'],
      ['Container Apps', 'Serverless containers with revisions, KEDA autoscaling and optional Dapr.'],
      ['App Service', 'Managed web hosting for code (Java SE, Tomcat, JBoss EAP, .NET, Node, Python) or containers, on an App Service plan.'],
      ['Functions', 'Event-driven functions with triggers and bindings, on Flex Consumption, Premium or Dedicated plans.']
    ]
  },
  visual: {
    title: 'Walk the decision tree',
    caption: 'Pick a workload and press Play (or Step). Each question shows the reasoning. The table under the tree highlights where the chosen service sits on deploy unit, scale to zero, patching and Kubernetes access.'
  },
  gotchas: [
    { trap: 'AKS for a handful of services', why: 'Kubernetes is a platform you operate: version upgrades on a regular cadence, node-image updates, ingress, network policy, CSI drivers, autoscaler tuning. For three services that is a full-time job nobody budgeted for.', fix: 'Default to Container Apps or App Service. Move to AKS when you need the Kubernetes API (operators, CRDs, mesh, DaemonSets, custom scheduling) or a multi-team platform with a team to run it.' },
    { trap: 'Long synchronous work behind an HTTP-triggered function', why: 'An HTTP-triggered function has about 230 seconds to respond, whatever the plan’s timeout, because of the front-end load balancer. Report generation or LLM batch jobs time out.', fix: 'Return <code>202 Accepted</code> with a status URL and do the work asynchronously: a queue-triggered function, Durable Functions, or a Container Apps job.' },
    { trap: 'Scale to zero + JVM startup = a slow first request', why: 'A Spring Boot app can take seconds to tens of seconds to start. After a scale-to-zero, the first user waits for image pull, JVM start and Spring context refresh.', fix: 'For user-facing APIs keep at least one replica (<code>minReplicas: 1</code>, always-ready instances, Always On). Speed up startup with Spring AOT, Class Data Sharing and fewer auto-configurations. Save scale-to-zero for workers and jobs.' },
    { trap: 'Packing every app into one App Service plan', why: 'All apps in a plan run on the same instances and scale together. One memory-hungry app causes restarts or high latency for every app in the plan.', fix: 'Group apps by scaling profile and criticality. Give production APIs their own plan, and watch per-app memory and CPU in the plan’s metrics.' },
    { trap: '“A VM is cheaper”', why: 'The VM price ignores patching, backup, hardening, monitoring agents, scaling and on-call time. A single VM also has a weaker SLA than zone-spread instances.', fix: 'Compare total cost of ownership, not hourly rate. If you do use VMs, use Scale Sets across zones, Update Manager and a golden image pipeline.' },
    { trap: 'Discovering networking limits after the choice', why: 'Private ingress, VNet integration, outbound static IPs and private endpoints differ by service and tier. The legacy Functions Consumption plan, for example, has no VNet integration; Flex Consumption does.', fix: 'Put “must run privately inside the hub-spoke network” on the checklist up front, and confirm the tier supports inbound private endpoints and outbound VNet integration.' }
  ],
  scenarios: [
    { title: 'Monthly report endpoint fails with 502 after ~4 minutes',
      symptom: 'An HTTP-triggered Java function on a Premium plan builds a PDF report. Large customers always get a 502 at around 230 seconds, although <code>functionTimeout</code> is set to 30 minutes.',
      diagnoseLang: 'kql', diagnose: `// App Insights (KQL)
requests
| where name == "MonthlyReport" and resultCode == "502"
| summarize count(), avg(duration) by bin(timestamp, 1d)`,
      cause: 'The HTTP front end gives up after about 230 seconds, whatever the function timeout is. The function kept running, but nobody was waiting for the result.',
      fix: 'Switch to async request-reply: enqueue the job, return <code>202</code> with a status URL, write the PDF to Blob storage and notify. Durable Functions provides this pattern out of the box.',
      fixCode: `@FunctionName("StartReport")
public HttpResponseMessage start(
    @HttpTrigger(name = "req", methods = {HttpMethod.POST}) HttpRequestMessage<String> req,
    @DurableClientInput(name = "durable") DurableClientContext durable) {
  String id = durable.getClient().scheduleNewOrchestrationInstance("ReportOrchestrator", req.getBody());
  return durable.createCheckStatusResponse(req, id);   // 202 + status URLs
}`, lang: 'java' },
    { title: 'The AKS cluster nobody owned fell out of support',
      symptom: 'A team of five ran four Spring services on AKS. After a reorganisation the cluster was several minor versions behind, and upgrades failed because of deprecated APIs in old Helm charts.',
      diagnose: `az aks get-upgrades -g rg-shop -n aks-shop -o table
kubectl get --raw /metrics | grep apiserver_requested_deprecated_apis   # who still calls removed APIs`,
      cause: 'A Kubernetes platform was chosen without a platform team. Nobody upgraded it, and the charts depended on API versions that newer Kubernetes releases removed.',
      fix: 'Short term: fix the charts and upgrade one minor version at a time. Medium term: move the four services to Container Apps (same images, revisions instead of Deployments, KEDA rules instead of HPA) and retire the cluster.' },
    { title: 'First request of the morning takes 25 seconds',
      symptom: 'Users of an internal tool on Container Apps complain that “the first click is broken”. Traces show 20–25 s on the first request after a quiet period.',
      diagnose: `az containerapp show -g rg-tools -n app-tools --query "properties.template.scale"
# { "minReplicas": 0, "maxReplicas": 5, ... }
az containerapp logs show -g rg-tools -n app-tools --type system | grep -i "scal"`,
      cause: 'Scale to zero plus JVM and Spring startup. The HTTP request had to wait for a replica to start.',
      fix: 'Set <code>minReplicas: 1</code> for interactive apps (it costs a small idle charge), and speed up startup. Keep scale to zero for background workers.',
      fixCode: `az containerapp update -g rg-tools -n app-tools --min-replicas 1` }
  ],
  puzzles: [
    { kind: 'scenario', q: 'A Spring Boot API, a 4-person team, no Kubernetes experience. They want blue/green releases with a 10% canary, and the nightly workers should cost nothing when idle. Best fit?', options: ['AKS with Argo Rollouts', 'Container Apps: revisions with traffic split, KEDA scale-to-zero for workers', 'A VM Scale Set', 'Functions Consumption for everything'], answer: 1, explain: 'Container Apps gives weighted traffic between revisions and KEDA-based scaling to zero without running a cluster. AKS can do it too, but brings an operations burden this team can’t carry.' },
    { kind: 'scenario', q: 'A vendor’s monitoring agent must be installed as a kernel module, and the licence is tied to the hostname. Where does it run?', options: ['App Service', 'Container Apps', 'Virtual Machines (or VMSS)', 'Functions Premium'], answer: 2, explain: 'Kernel modules and host-bound licences need OS control, which only IaaS gives you.' },
    { kind: 'scenario', q: 'Images uploaded to Blob storage must be thumbnailed within seconds. Volume is spiky, and there are no uploads at night. What fits naturally?', options: ['App Service with Always On', 'Azure Functions (Flex Consumption) triggered by blob events through Event Grid', 'An AKS CronJob every minute', 'A VM polling the container'], answer: 1, explain: 'Short, independent units of work triggered by events, with scale to zero, are the classic Functions case. An Event Grid-based blob trigger avoids the latency of polling.' },
    { kind: 'scenario', q: 'The platform team needs Kubernetes operators (CloudNativePG, cert-manager), a service mesh and custom admission webhooks across 40 services. Which service?', options: ['Container Apps', 'AKS', 'App Service', 'Functions'], answer: 1, explain: 'Operators, CRDs, mesh and admission control need the Kubernetes API, which Container Apps deliberately hides. With a platform team and 40 services, AKS pays for itself.' },
    { kind: 'scenario', q: 'Which statement about App Service is true?', options: ['It scales to zero when idle', 'All apps in one plan share the plan’s instances and scale together', 'It cannot run containers', 'Deployment slots are available on every tier'], answer: 1, explain: 'The plan is the compute. Each app in it runs on the plan’s instances. App Service also runs containers. Slots need Standard or higher. It never scales to zero.' },
    { kind: 'scenario', q: 'An AI agent backend in Python (FastAPI) plus a Java tool service. It needs managed identity, scale on queue depth for batch evaluations, and quick rollback when a prompt change misbehaves. Best default?', options: ['AKS', 'Container Apps', 'App Service', 'VMs'], answer: 1, explain: 'Two languages in containers, KEDA queue scaling, revisions for instant rollback, and managed identity for Azure OpenAI and AI Search access: that is Container Apps’ sweet spot.' }
  ],
  interview: [
    { q: 'How do you choose between App Service, Container Apps and AKS for a Spring Boot service?', a: '<p><b>App Service</b>: you want to deploy a JAR with slots, built-in auth and simple autoscale, and the team doesn’t want to own images. <b>Container Apps</b>: you ship images and want revisions, traffic split, KEDA (including scale to zero), Dapr and jobs, with no cluster. <b>AKS</b>: you need the Kubernetes API or a shared platform for many teams, and have people to run it.</p>', lvl: 'core' },
    { q: 'What does Container Apps hide from you, and when does that hurt?', a: '<p>It hides the Kubernetes API: no CRDs, operators, DaemonSets, custom admission webhooks, node access or custom CNI. It hurts when you need sidecars beyond what the platform supports, privileged containers or host networking, or a specific ingress controller. Then you go to AKS.</p>', lvl: 'deep' },
    { q: 'When are Functions the wrong answer?', a: '<ul><li>Long synchronous HTTP work (the ~230 s limit).</li><li>Steady high-throughput services, where a container or App Service is simpler and cheaper.</li><li>Big frameworks with heavy startup on a plan that scales to zero.</li><li>When you need fine control of the runtime or connection pooling across executions.</li></ul><p>Functions shine for glue, event handlers and scheduled jobs.</p>', lvl: 'core' },
    { q: 'What is the status of Azure Spring Apps, and what would you migrate to?', a: '<p>Microsoft has announced Azure Spring Apps’ retirement (see Microsoft Learn for the timeline) and points customers to <b>Container Apps</b>, which offers managed Java components (Eureka, Config Server, Spring Boot Admin) and Java-aware features. App Service and AKS are the other options, depending on control needs.</p>', lvl: 'deep' },
    { q: 'How would you design for cost on these platforms?', a: '<p>Match the idle profile. Use scale to zero (Container Apps, Functions) for spiky workers. Use reserved capacity or savings plans for steady App Service and AKS. Pack non-critical apps densely, and give critical ones their own capacity. Measure cost per request or per tenant, not just the monthly bill.</p>', lvl: 'core' },
    { q: 'How does cold start differ across the options?', a: '<p>VMs, AKS (with running pods) and App Service with Always On don’t cold start per request, though they do on scale-out. Container Apps with <code>minReplicas: 0</code> and Functions on Consumption-style plans can, and the JVM makes it worse. Mitigate with minimum replicas, always-ready (Flex) or pre-warmed (Premium) instances, and faster startup (AOT, CDS).</p>', lvl: 'core' },
    { q: 'You are migrating 30 Spring Boot apps from on-prem Tomcat. What is your approach?', a: '<p>Assess first: Azure Migrate app and code assessment, dependencies, state, file-system use, sessions. Rehost WAR-on-Tomcat apps to App Service (Tomcat) where they’re unchanged. Replatform to Spring Boot JARs in containers on Container Apps where you modernise. Externalise config to App Configuration and Key Vault, sessions to Redis, and identity to Entra. Migrate in waves with a landing zone ready.</p>', lvl: 'deep' },
    { q: 'What questions do you ask before recommending AKS?', a: '<ul><li>Who runs upgrades every few months?</li><li>Do we need operators or a mesh?</li><li>How many teams and services?</li><li>Networking (CNI overlay vs flat), identity (workload identity), policy (Gatekeeper/Azure Policy) and GitOps.</li><li>Is there budget for a platform team?</li></ul><p>If most answers are “no” or “not sure”, start with Container Apps. Workloads are just containers, so they can move later.</p>', lvl: 'deep' },
    { q: 'Where do batch and scheduled jobs go?', a: '<p>Container Apps <b>jobs</b> (manual, scheduled or event-driven), timer-triggered Functions for light work, Azure Batch for large HPC-style fan-out, and Kubernetes CronJobs on an AKS platform. Avoid cron on a VM, or a scheduled endpoint on a web app that scales out (every instance runs it).</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Same JAR, three homes (az)', lang: 'bash', code: `# App Service (Linux, Java SE 21)
az appservice plan create -g rg-orders -n asp-orders --is-linux --sku P1v3
az webapp create -g rg-orders -p asp-orders -n app-orders --runtime "JAVA:21-java21"
az webapp deploy -g rg-orders -n app-orders --src-path target/orders.jar --type jar

# Container Apps (builds an image from source with a Dockerfile or buildpacks)
az containerapp up -g rg-orders -n ca-orders --environment cae-orders \\
  --source . --ingress external --target-port 8080

# Functions on Flex Consumption (Java 21)
az functionapp create -g rg-orders -n func-orders --storage-account stfuncorders \\
  --flexconsumption-location westeurope --runtime java --runtime-version 21`, note: 'Runtime strings and supported Java versions change. List the current ones with <code>az webapp list-runtimes --os linux</code> and <code>az functionapp list-flexconsumption-runtimes</code>.' },
    { title: 'Probe-friendly Spring Boot (works everywhere)', lang: 'yaml', code: `# application.yml: the same app on App Service, Container Apps or AKS
server:
  port: \${PORT:8080}            # let the platform tell you the port when it does
  shutdown: graceful           # finish in-flight requests on SIGTERM
spring:
  lifecycle:
    timeout-per-shutdown-phase: 20s
management:
  endpoint:
    health:
      probes:
        enabled: true          # /actuator/health/liveness and /readiness
  endpoints:
    web:
      exposure:
        include: health,info`, note: 'Point App Service’s health check at <code>/actuator/health/readiness</code>, and Container Apps and AKS probes at the liveness and readiness groups. Keep liveness free of database checks, so a database outage doesn’t restart every pod.' },
    { title: 'Container App in Bicep (minimal)', lang: 'bicep', code: `resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-orders'
  location: location
  identity: { type: 'UserAssigned', userAssignedIdentities: { '\${uami.id}': {} } }
  properties: {
    environmentId: env.id
    configuration: {
      ingress: { external: true, targetPort: 8080 }
      registries: [ { server: acr.properties.loginServer, identity: uami.id } ]
    }
    template: {
      containers: [ {
        name: 'orders'
        image: '\${acr.properties.loginServer}/orders:1.4.2'
        resources: { cpu: json('1.0'), memory: '2Gi' }
      } ]
      scale: { minReplicas: 1, maxReplicas: 10 }
    }
  }
}` }
  ]
});

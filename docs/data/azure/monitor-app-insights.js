IA.register({
  track: 'azure',
  slug: 'monitor-app-insights',
  title: 'Monitor & Application Insights',
  tagline: 'Add <b>one JVM flag</b> and the Application Insights Java agent turns every request, SQL call, HTTP call, log line and exception into telemetry. It lands in <b>Log Analytics tables</b> that you query with <b>KQL</b>. Alerts are just KQL (or metrics) on a schedule, and one <b>trace id</b> ties a request together across every service it touched.',
  tldr: {
    problem: 'Production is slow and nobody knows which hop is to blame. Dashboards undercount because of sampling, the bill grows with DEBUG logs, and the alert that should have fired at 02:10 fired at 02:40, or never.',
    model: '<b>Agent</b> (in the JVM) → <b>ingestion endpoint</b> (from the connection string) → <b>Log Analytics workspace</b> (tables: <code>AppRequests</code>, <code>AppDependencies</code>, <code>AppExceptions</code>, <code>AppTraces</code>…) → <b>KQL</b> → <b>alert rule</b> → <b>action group</b>. Every row carries an <code>OperationId</code> (the W3C trace id) so you can join across tables and services.',
    hook: '“Your p95 doubled. Walk me through finding the cause.” Start in <code>AppRequests</code> by operation name, pivot on <code>OperationId</code> into <code>AppDependencies</code>, and find which dependency’s duration moved. Then show the KQL.',
    facts: [
      { v: '-javaagent', l: 'the only change needed: agent 3.x (built on OpenTelemetry) auto-instruments Spring MVC/WebFlux, JDBC, HTTP clients, Kafka, JMS, Azure SDKs and Logback/Log4j' },
      { v: 'OperationId', l: 'is the W3C <code>traceparent</code> trace id. Requests, dependencies, logs and exceptions from every service in one call share it' },
      { v: 'ItemCount', l: 'on sampled rows, each row stands for <code>ItemCount</code> originals. Count with <code>sum(ItemCount)</code>, not <code>count()</code>' }
    ]
  },
  intro: {
    what: '<b>Azure Monitor</b> is Azure’s umbrella for metrics, logs and alerts. <b>Application Insights</b> is the part for your applications: it records each request your Spring Boot app serves, each call it makes (database, HTTP, queues), each exception and log line, and stores them in a <b>Log Analytics workspace</b>. You search that data with <b>KQL</b> (Kusto Query Language) and turn queries into <b>alerts</b>.',
    analogy: { icon: '✈️', title: 'A flight recorder plus air-traffic control', text: 'The Java agent is the flight recorder inside each plane (JVM): it writes down everything, automatically. The workspace is the archive where all recordings land. KQL is how investigators search the archive. An alert rule is the controller who checks the radar every few minutes and phones someone when a pattern looks wrong.' },
    steps: [
      { t: 'Create a workspace-based Application Insights', d: 'Classic (non-workspace) Application Insights has been retired; new resources always write into a Log Analytics workspace.', code: 'az monitor log-analytics workspace create -g rg-obs -n law-prod\naz monitor app-insights component create -g rg-obs -a appi-orders \\\n  --location westeurope --workspace law-prod' },
      { t: 'Attach the Java agent', d: 'Add the agent JAR and point the JVM at it. The connection string tells it where to send data.', code: 'export APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=…;IngestionEndpoint=…"\njava -javaagent:/agent/applicationinsights-agent-3.x.jar -jar orders.jar' },
      { t: 'Query with KQL', d: 'Each kind of telemetry is a table. KQL is a pipeline: start from a table, then filter, summarize, render.', code: 'AppRequests\n| where TimeGenerated > ago(1h)\n| summarize n = sum(ItemCount), p95 = percentile(DurationMs, 95) by Name\n| order by p95 desc', lang: 'kql' },
      { t: 'Alert on what users feel', d: 'Turn a query (failure rate, p95) or a platform metric into an alert rule, and route it through an action group (email, Teams, webhook, ITSM).' },
      { t: 'Follow one request end to end', d: 'Open the transaction details for a slow request: every service and dependency it touched, on one timeline, linked by the trace id.' }
    ],
    terms: [
      ['Log Analytics workspace', 'The store for log data. Tables, retention and cost live here. Many resources can share one workspace.'],
      ['connection string', 'Tells the agent which Application Insights resource and ingestion endpoint to send to. Not a secret in the password sense, but keep it in config, not code.'],
      ['request / dependency', 'A request is an incoming call your app served. A dependency is an outgoing call it made (SQL, HTTP, Service Bus, Redis…).'],
      ['KQL', 'Kusto Query Language: <code>Table | where … | summarize … by …</code>. Read-only and pipe-based.'],
      ['alert rule / action group', 'A rule evaluates a condition on a schedule. An action group says who or what to notify when it fires.'],
      ['OperationId', 'The trace id shared by every row that belongs to one end-to-end operation.']
    ]
  },
  visual: {
    title: 'From a JVM to a page at 02:10',
    caption: '<b>Telemetry → alert</b>: one request becomes request, dependency and log rows; the agent samples and exports them; they land in workspace tables; KQL summarizes them; an alert rule fires an action group. <b>Distributed trace</b>: watch the <code>traceparent</code> header carry one trace id across services and a queue, then the waterfall appear. Press Play or Step.'
  },
  gotchas: [
    { trap: '<code>count()</code> on sampled data', code: `AppRequests | summarize count()          // ✗ counts stored rows only
AppRequests | summarize sum(ItemCount)   // ✓ estimates real requests`, lang: 'kql', why: 'When the agent samples, it keeps some operations and drops the rest. Each kept row gets <code>ItemCount</code> = how many originals it represents. <code>count()</code> counts rows, so traffic, error counts and capacity plans come out several times too small.', fix: 'Use <code>sum(ItemCount)</code> for counts and rates. Percentiles and averages of duration are fine on sampled rows, because sampling keeps whole operations.' },
    { trap: 'Two schemas for the same data', code: `// Application Insights "Logs" blade (classic names)
requests | where timestamp > ago(1h) | summarize avg(duration) by cloud_RoleName
// Log Analytics workspace (workspace names)
AppRequests | where TimeGenerated > ago(1h) | summarize avg(DurationMs) by AppRoleName`, lang: 'kql', why: 'Querying from the Application Insights resource shows classic table and column names (<code>requests</code>, <code>timestamp</code>, <code>operation_Id</code>). Querying the workspace directly shows <code>AppRequests</code>, <code>TimeGenerated</code>, <code>OperationId</code>. A query copied from a blog fails with “failed to resolve table”.', fix: 'Pick one scope per artifact. Alerts and workbooks that span several apps usually target the workspace, so write them with the <code>App*</code> names.' },
    { trap: 'Every service called “unknown_service” or the same name', why: 'The Application Map, failures blade and alert splitting all group by role name. If two Spring apps share a role name (or both get a default), they merge into one node and you can’t tell which one is failing.', fix: 'Set <code>role.name</code> in <code>applicationinsights.json</code>, or <code>APPLICATIONINSIGHTS_ROLE_NAME</code> per deployment. Set <code>role.instance</code> only if the default (host name) is unhelpful.' },
    { trap: 'Health probes and DEBUG logs dominate the bill', why: 'Container Apps, App Service and Kubernetes probe <code>/actuator/health</code> constantly, and each probe is a request row. The agent also ships logs at INFO and above by default; DEBUG in production multiplies ingestion, and ingestion is what you pay for.', fix: 'Add a sampling override that drops probe requests (<code>percentage: 0</code>), set the agent’s logging level to WARN for chatty apps, and check the <code>Usage</code> table weekly. A daily cap stops ingestion when reached, so it is a safety net, not a budget.' },
    { trap: 'Agent plus SDK starter: double telemetry', why: 'Adding the agent <i>and</i> an in-process OpenTelemetry/Application Insights SDK (or two agents) instruments the same calls twice, so you get duplicate requests, broken parent ids and twice the cost.', fix: 'Choose one: the Java agent for JVM apps (most features, no code), or the Spring Boot starter (<code>spring-cloud-azure-starter-monitor</code>) for GraalVM native images, where an agent can’t attach.' },
    { trap: 'The trace breaks at your outbox table', why: 'The agent propagates context over HTTP, JMS, Kafka and the Azure SDKs automatically. It can’t follow a message that you write to a Postgres outbox table and a poller picks up later, so the consumer starts a new trace.', fix: 'Store the W3C <code>traceparent</code> in the outbox row and restore it in the poller (OpenTelemetry API: extract the context and make it current around the send). Or publish through an instrumented client.' },
    { trap: 'Log alert window equal to its frequency', why: 'Log data arrives in the workspace after an ingestion delay (typically minutes). A rule that runs every 5 minutes over the last 5 minutes keeps missing the rows that were still in flight.', fix: 'Make the window longer than the frequency (for example a 15-minute window every 5 minutes) and alert on a <b>rate</b>. For “page within a minute”, use a metric alert.' }
  ],
  scenarios: [
    { title: 'Capacity plan said 80 req/s. Production fell over at 300.',
      symptom: 'A sizing exercise used last month’s peak from a KQL dashboard. The real peak was several times higher, and the app ran out of database connections on launch day.',
      diagnose: `AppRequests
| where TimeGenerated > ago(30d)
| summarize rows = count(), real = sum(ItemCount), avgItemCount = avg(ItemCount)
    by bin(TimeGenerated, 1h)
| top 5 by real desc`,
      diagnoseLang: 'kql',
      cause: 'The agent was sampling, so each stored row represented several requests. The dashboard used <code>count()</code>, which counts stored rows only.',
      fix: 'Rewrite counts and rates with <code>sum(ItemCount)</code>. Keep sampling, which keeps cost under control. Add a dashboard tile showing <code>avg(ItemCount)</code> so people can see that sampling is active.',
      fixCode: `AppRequests
| where TimeGenerated > ago(30d)
| summarize rps = sum(ItemCount) / 60.0 by bin(TimeGenerated, 1m)
| summarize peakRps = max(rps)`,
      fixLang: 'kql' },
    { title: 'Log Analytics bill tripled in a month',
      symptom: 'No traffic growth, but workspace ingestion tripled after a release.',
      diagnose: `Usage
| where TimeGenerated > ago(30d) and IsBillable
| summarize GB = sum(Quantity) / 1024 by DataType   // Quantity is in MB
| order by GB desc
// then: AppTraces | summarize sum(ItemCount) by SeverityLevel, AppRoleName`,
      diagnoseLang: 'kql',
      cause: '<code>AppTraces</code> had grown tenfold: a release set <code>logging.level.root=DEBUG</code> in production config, and the agent shipped every line. <code>AppRequests</code> was also full of health-probe calls.',
      fix: 'Restore INFO in the app, set the agent’s capture level explicitly, drop probe requests with a sampling override, and add an alert on daily ingestion volume.',
      fixCode: `{
  "role": { "name": "orders-api" },
  "instrumentation": { "logging": { "level": "WARN" } },
  "sampling": {
    "requestsPerSecond": 5,
    "overrides": [{
      "telemetryType": "request",
      "attributes": [{ "key": "url.path", "value": "/actuator/.*", "matchType": "regexp" }],
      "percentage": 0
    }]
  }
}`,
      fixLang: 'json' },
    { title: 'The failure-rate alert stayed green through a 25-minute outage',
      symptom: 'Users got 503s for 25 minutes. The log alert “failed requests &gt; 5%” never fired; the on-call engineer heard about it on social media.',
      diagnose: `az monitor scheduled-query show -g rg-obs -n orders-failrate \\
  --query "{freq:evaluationFrequency, window:windowSize, query:criteria.allOf[0].query}"
# freq PT5M, window PT5M, query uses: requests | where success == false | count`,
      cause: 'Three faults stacked up: the window equalled the frequency, so late rows were missed; the query counted only <i>failed</i> rows with an absolute threshold tuned for daytime traffic; and the 503s came from Front Door because the app was down, so the app sent no telemetry at all.',
      fix: 'Alert on a failure <b>rate</b> over a 15-minute window every 5 minutes, add an <b>availability test</b> (outside-in) and a metric alert on the edge (Front Door/Gateway 5xx), and alert when expected telemetry goes missing.',
      fixCode: `AppRequests
| summarize total = sum(ItemCount), failed = sumif(ItemCount, Success == false) by AppRoleName
| extend failRate = 100.0 * failed / total
| where total > 50          // ignore idle periods`,
      fixLang: 'kql' }
  ],
  puzzles: [
    { kind: 'calc', q: 'The agent is sampling. This query returns <code>rows = 2,000</code> and <code>avg(ItemCount) = 5</code> for the last hour. Roughly how many requests did the app serve?', code: `AppRequests
| where TimeGenerated > ago(1h)
| summarize rows = count(), avgIC = avg(ItemCount)`, lang: 'kql', options: ['2,000', '400', '10,000', 'Unknown: sampled data can’t be counted'], answer: 2, explain: 'Each stored row stands for <code>ItemCount</code> requests: 2,000 × 5 ≈ <b>10,000</b>. That is exactly what <code>sum(ItemCount)</code> computes.' },
    { kind: 'predict', q: 'What is the name of the count column this query returns?', code: `AppRequests
| where Success == false
| summarize count() by ResultCode`, lang: 'kql', options: ['<code>count</code>', '<code>count_</code>', '<code>Count</code>', 'It has no name until you alias it'], answer: 1, explain: 'KQL names an unaliased aggregate after the function plus an underscore: <code>count_</code>, <code>avg_DurationMs</code>, <code>sum_ItemCount</code>. Alias it (<code>n = count()</code>) when an alert or workbook depends on the name.' },
    { kind: 'scenario', q: 'A Spring Boot app calls Postgres through JDBC and a payment API through <code>RestClient</code>. With the Java agent attached, where do the SQL calls show up in the workspace?', options: ['<code>AppRequests</code>', '<code>AppDependencies</code> with type SQL/postgresql', '<code>AppTraces</code>', 'Nowhere, JDBC needs manual spans'], answer: 1, explain: 'Outgoing calls are <b>dependencies</b>. The agent instruments JDBC automatically, so each statement (or batch) is a row in <code>AppDependencies</code> with its target, duration and success. The incoming HTTP call is the request.' },
    { kind: 'scenario', q: '<code>orders-api</code> and <code>payments-api</code> appear as one node in the Application Map, and failures can’t be told apart. Most likely cause?', options: ['They share one workspace', 'They share the same role name', 'Sampling is on', 'They use different connection strings'], answer: 1, explain: 'The map, failures and per-service alerts group by <b>role name</b> (<code>AppRoleName</code>). Sharing a workspace, or even an Application Insights resource, is fine as long as each service sets a distinct <code>role.name</code>.' },
    { kind: 'scenario', q: 'You need to page someone within about a minute when an App Service plan’s CPU stays above 90%. Which alert type?', options: ['Log search alert on <code>AppPerformanceCounters</code> every 15 min', 'Metric alert on the plan’s CPU Percentage', 'Activity log alert', 'A budget alert'], answer: 1, explain: 'Platform <b>metrics</b> are pre-aggregated and evaluated near real time, so a <b>metric alert</b> is the fast, cheap choice. Log search alerts suit conditions that need a query (rates, joins, text), and they pay the ingestion delay.' },
    { kind: 'scenario', q: 'Which design produces <b>one</b> connected trace from the HTTP request to the consumer’s database write (Java agent on both apps)?', options: ['Producer writes a row to a Postgres outbox; a scheduled poller sends it to Service Bus; consumer processes it', 'Producer sends with the Azure Service Bus SDK; consumer receives with the SDK', 'Producer calls the consumer through a database trigger', 'None: messaging always breaks traces'], answer: 1, explain: 'The agent instruments the Azure SDKs and propagates the trace context in message properties, so the consumer’s span continues the trace. The outbox poller runs on a timer with no incoming context, so it starts a new trace unless you store and restore <code>traceparent</code> yourself.' },
    { kind: 'scenario', q: 'A log search alert runs every 5 minutes over a 5-minute window. Ingestion delay is a few minutes. What is the risk?', options: ['It fires twice for every incident', 'Rows that arrive late fall outside every window, so short incidents are missed', 'Nothing, Azure re-runs late windows', 'It is billed per row'], answer: 1, explain: 'Each evaluation only sees rows that have already been ingested. Rows that land later belong to a window that has already been evaluated. Use a window longer than the frequency, or a metric alert.' }
  ],
  interview: [
    { q: 'How do you instrument a Spring Boot 3 app for Application Insights?', a: '<p>Attach the <b>Java agent 3.x</b> with <code>-javaagent</code> (or <code>JAVA_TOOL_OPTIONS</code> in a container) and set <code>APPLICATIONINSIGHTS_CONNECTION_STRING</code>. It auto-collects requests, dependencies (JDBC, HTTP clients, Redis, Kafka, JMS, Azure SDKs), logs, exceptions and Micrometer metrics with no code change. Configure role name, sampling and log level in <code>applicationinsights.json</code>. On App Service Java there is also a built-in auto-instrumentation toggle. For GraalVM native images, use the Spring Boot starter instead of the agent.</p>', fu: 'How do you add a custom attribute to every span? (OpenTelemetry API <code>Span.current().setAttribute(…)</code>; the agent picks it up.)', lvl: 'core' },
    { q: 'Explain how distributed tracing works across three services and a queue.', a: '<p>Each incoming request gets a W3C trace context. Outgoing HTTP calls carry it in the <code>traceparent</code> header; messaging SDKs carry it in message properties. Each service creates spans with the same trace id and its own span id, recording its parent. In Application Insights the trace id is <code>OperationId</code> and the parent is <code>ParentId</code>, so the end-to-end transaction view can rebuild the tree. Context breaks wherever a hop isn’t instrumented: a custom TCP protocol, a database outbox, or an uninstrumented thread pool.</p>', lvl: 'core' },
    { q: 'How does sampling work in the Java agent, and what does it break?', a: '<p>The agent samples whole operations, based on the trace id, so a kept request keeps all its dependencies and logs and traces stay complete. Since agent 3.4 the default is <b>rate-limited</b> sampling (a target number of requests per second), and you can set a fixed percentage instead, plus overrides (drop health probes, keep all failures of a critical path). Each kept row records <code>ItemCount</code>. It breaks naive counts (<code>count()</code>), rare-event searches (a specific request may be dropped) and joins to logs you exported elsewhere.</p>', fu: 'How do you make sure every exception is kept? (A sampling override with percentage 100 for the relevant telemetry, or ship error logs separately.)', lvl: 'deep' },
    { q: 'Metric alert or log search alert?', a: '<ul><li><b>Metric alert</b>: pre-aggregated platform or custom metrics, evaluated near real time, cheap, supports dynamic thresholds. Use it for CPU, memory, HTTP 5xx at the edge, queue length.</li><li><b>Log search alert</b>: any KQL query on a schedule. Use it for rates, joins, text patterns or business signals. It pays the ingestion delay and costs more per rule.</li><li><b>Activity log alert</b>: control-plane events (someone deleted a resource, a service health event).</li></ul>', lvl: 'core' },
    { q: 'Write KQL for the top failing dependencies in the last hour, by service.', a: '<pre>AppDependencies\n| where TimeGenerated &gt; ago(1h)\n| summarize calls = sum(ItemCount),\n            failed = sumif(ItemCount, Success == false),\n            p95 = percentile(DurationMs, 95)\n    by AppRoleName, Type, Target\n| extend failPct = round(100.0 * failed / calls, 1)\n| top 10 by failed desc</pre><p>Then pivot: take an <code>OperationId</code> of a failed call and look at the whole transaction.</p>', lvl: 'core' },
    { q: 'Where does Application Insights data actually live, and why does that matter?', a: '<p>In a <b>Log Analytics workspace</b> (workspace-based Application Insights; classic resources were retired). That decides retention, access (workspace or resource-context RBAC), cost (ingestion and retention per workspace), and what you can join: app telemetry next to <code>ContainerAppConsoleLogs_CL</code>, AKS <code>ContainerLogV2</code>, Postgres diagnostic logs and Azure activity, in one query.</p>', fu: 'One workspace per environment or per app? (Usually per environment and region, with RBAC by resource context; split when data residency or billing owners differ.)', lvl: 'core' },
    { q: 'How do you control Log Analytics cost without going blind?', a: '<ul><li>Find the big tables with the <code>Usage</code> table.</li><li>Sample at the source (agent sampling, probe overrides) and set log levels deliberately.</li><li>Use cheaper table plans for high-volume tables you rarely query, where supported.</li><li>Use a commitment tier when daily ingestion is steady and high.</li><li>Use the daily cap only as a safety net: when reached, ingestion stops until the next day.</li></ul>', lvl: 'deep' },
    { q: 'What do you alert on for a customer-facing API?', a: '<p>Start from symptoms users feel: <b>availability</b> (outside-in tests and edge 5xx), <b>failure rate</b> and <b>latency p95/p99</b> against an SLO, ideally as burn-rate alerts. Add a few cause alerts that need action (DB connections near the limit, a queue’s dead-letter count rising, certificate expiry). Avoid CPU alerts that page at night with no user impact. Every alert has an owner and a runbook link.</p>', lvl: 'deep' },
    { q: 'A request is slow but none of its dependencies are. Where do you look?', a: '<p>The gap between the request duration and the sum of its dependency spans is time spent <i>inside</i> the JVM: CPU work, lock contention, GC pauses, waiting for a pool (Hikari, HTTP client), or thread starvation. Check JVM metrics (GC pause, heap, thread counts) in <code>AppMetrics</code>/performance counters, enable the profiler or a JFR recording, and look for <code>HikariPool</code> wait time.</p>', lvl: 'deep' },
    { q: 'How do Micrometer metrics fit in?', a: '<p>The agent picks up Micrometer’s global registry, including Spring Boot Actuator metrics, and sends them as custom metrics (<code>AppMetrics</code>). Use Micrometer for business counters and timers (<code>orders.placed</code>), and keep tag cardinality low: a tag per user id creates a time series per user, which costs money and slows queries.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Container: agent + config', lang: 'docker', code: `FROM mcr.microsoft.com/openjdk/jdk:21-ubuntu
WORKDIR /app
COPY target/orders.jar app.jar
# applicationinsights.json sits next to the agent JAR (default lookup location)
COPY agent/applicationinsights-agent-3.x.x.jar /agent/applicationinsights-agent.jar
COPY agent/applicationinsights.json             /agent/applicationinsights.json
ENV JAVA_TOOL_OPTIONS="-javaagent:/agent/applicationinsights-agent.jar -XX:MaxRAMPercentage=75"
# APPLICATIONINSIGHTS_CONNECTION_STRING comes from the platform (app setting / secret ref)
ENTRYPOINT ["java", "-jar", "app.jar"]`, note: 'Pin the agent version and upgrade it deliberately. <code>JAVA_TOOL_OPTIONS</code> also reaches JVMs started by scripts, which is easy to miss in an ENTRYPOINT.' },
    { title: 'KQL: the incident starter pack', lang: 'kql', code: `// 1) What got slow or failed, by operation (sampling-safe)
AppRequests
| where TimeGenerated > ago(2h)
| summarize n = sum(ItemCount), failed = sumif(ItemCount, Success == false),
            p95 = percentile(DurationMs, 95) by bin(TimeGenerated, 5m), Name
| render timechart

// 2) Which dependency moved?
AppDependencies
| where TimeGenerated > ago(2h) and AppRoleName == "orders-api"
| summarize p95 = percentile(DurationMs, 95) by bin(TimeGenerated, 5m), Target
| render timechart

// 3) One slow operation, every row, every service
let op = toscalar(AppRequests | where TimeGenerated > ago(1h)
                  | top 1 by DurationMs desc | project OperationId);
union AppRequests, AppDependencies, AppExceptions, AppTraces
| where OperationId == op
| project TimeGenerated, Type, AppRoleName, Name, DurationMs, Success, Message
| order by TimeGenerated asc` },
    { title: 'Bicep: workspace, App Insights, failure-rate alert', lang: 'bicep', code: `resource law 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: 'law-prod-weu'
  location: location
  properties: { sku: { name: 'PerGB2018' }, retentionInDays: 30 }
}

resource appi 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-orders'
  location: location
  kind: 'web'
  properties: { Application_Type: 'web', WorkspaceResourceId: law.id }
}

resource failRate 'Microsoft.Insights/scheduledQueryRules@2021-08-01' = {
  name: 'orders-failrate'
  location: location
  properties: {
    severity: 1
    enabled: true
    scopes: [ appi.id ]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'          // longer than the frequency
    criteria: {
      allOf: [ {
        query: 'requests | summarize total = sum(itemCount), failed = sumif(itemCount, success == false) | extend failRate = 100.0 * failed / total | where total > 50'
        timeAggregation: 'Average'
        metricMeasureColumn: 'failRate'
        operator: 'GreaterThan'
        threshold: 5
        failingPeriods: { numberOfEvaluationPeriods: 1, minFailingPeriodsToAlert: 1 }
      } ]
    }
    autoMitigate: true
    actions: { actionGroups: [ actionGroupId ] }
  }
}

output connectionString string = appi.properties.ConnectionString`, note: 'The rule is scoped to the Application Insights resource, so the query uses the classic names (<code>requests</code>, <code>itemCount</code>). Scoped to the workspace, it would use <code>AppRequests</code> and <code>ItemCount</code>.' },
    { title: 'Custom spans and attributes (OpenTelemetry API)', lang: 'java', code: `// deps: io.opentelemetry:opentelemetry-api + io.opentelemetry.instrumentation:opentelemetry-instrumentation-annotations
// (the agent supplies the implementation at runtime)
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import io.opentelemetry.instrumentation.annotations.SpanAttribute;

@Service
class PricingService {
  @WithSpan("price-basket")                       // shows up as an InProc dependency
  Money price(@SpanAttribute("basket.size") int size, Basket b) {
    Span.current().setAttribute("tenant.id", b.tenantId());   // a custom dimension on the span
    return rules.apply(b);
  }
}` }
  ]
});

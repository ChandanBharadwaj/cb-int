IA.register({
  track: 'azure',
  slug: 'functions',
  title: 'Azure Functions',
  tagline: 'A function is a method plus a <b>trigger</b> (what wakes it) and optional <b>bindings</b> (declarative inputs and outputs). The <b>plan</b> decides scaling, timeouts, networking and <b>cold starts</b>: Flex Consumption is the modern serverless default, Premium keeps instances warm, and Durable Functions adds reliable, replay-based <b>workflows</b> on top.',
  tldr: {
    problem: 'Java functions that take seconds to answer the first request, timer jobs on the wrong schedule, duplicate side effects from retried messages, and long HTTP calls that die at around four minutes.',
    model: 'Events → a scale controller watching trigger load → instances running the Functions host plus a Java worker → your method. A cold start is instance allocation + host start + JVM start + your init. Durable Functions stores an orchestration as an append-only history and <b>replays</b> the orchestrator code to rebuild its state.',
    hook: '“Why must Durable orchestrator code be deterministic?” It is re-executed from the top on every wake-up. Completed steps return their results from history, so <code>Instant.now()</code> or a random UUID would differ on replay and corrupt the logic.',
    facts: [
      { v: '6 fields', l: 'in a timer trigger’s NCRONTAB expression: <code>{second} {minute} {hour} {day} {month} {day-of-week}</code>' },
      { v: '230 s', l: 'maximum time an HTTP-triggered function has to respond, on any plan (front-end load balancer limit)' },
      { v: '5 → 10 min', l: 'default and maximum timeout on the classic Consumption plan. Flex and Premium default to 30 min and can be unbounded' }
    ]
  },
  intro: {
    what: '<b>Azure Functions</b> lets you write a single method that runs <b>when something happens</b>: an HTTP request, a message on a queue, a file landing in storage, or a schedule. You don’t manage servers. Azure starts as many copies as the load needs, and on serverless plans can scale down to zero when nothing is happening.',
    analogy: { icon: '🔔', title: 'A doorbell-powered helper', text: 'The trigger is the doorbell, the function is the helper who answers, and bindings are the trays they carry in and out (read a blob, write to a queue). If nobody rings for a while the helper goes home. The next ring waits while they come back: that wait is the cold start.' },
    steps: [
      { t: 'Write a function', d: 'An annotated Java method. The trigger annotation says what wakes it.', lang: 'java', code: '@FunctionName("OnOrder")\npublic void run(@ServiceBusQueueTrigger(name = "msg", queueName = "orders",\n    connection = "ServiceBus") String msg, ExecutionContext ctx) {\n  ctx.getLogger().info("order " + msg);\n}' },
      { t: 'Pick a plan', d: 'Flex Consumption for serverless with VNet and always-ready instances; Premium for always-warm; Dedicated to run on an App Service plan.' },
      { t: 'Connect with identity, not secrets', d: 'Identity-based connection settings use a managed identity instead of a connection string.', code: 'ServiceBus__fullyQualifiedNamespace=sb-orders.servicebus.windows.net\nAzureWebJobsStorage__accountName=stfuncorders' },
      { t: 'Deploy', d: 'With Maven (<code>azure-functions-maven-plugin</code>), Core Tools (<code>func azure functionapp publish</code>) or CI.' }
    ],
    terms: [
      ['trigger', 'The event source that starts a function. There is exactly one per function.'],
      ['binding', 'A declarative input or output (blob, queue, Cosmos DB…) that the host wires up for you.'],
      ['host / worker', 'The Functions host process, plus, for Java, a separate language-worker JVM that runs your code.'],
      ['cold start', 'The extra latency when a request needs a brand-new instance: allocation, host start, JVM and app init.'],
      ['Flex Consumption', 'The newer serverless plan (Linux): fast per-function scaling, scale to zero, VNet, always-ready instances.'],
      ['Durable Functions', 'An extension for stateful workflows: orchestrators, activities and entities, backed by a task hub.']
    ]
  },
  visual: {
    title: 'Cold start and scale-out by plan',
    caption: 'Choose a plan and press Play. On <b>Consumption</b>, watch each phase of a Java cold start appear as a bar. On <b>Flex</b>, an always-ready instance answers warm, but on-demand scale-out still starts cold. On <b>Premium</b>, a pre-warmed buffer absorbs the burst. The Durable Functions replay is in the second visual.'
  },
  extras: [
    { id: 'functions-durable', title: 'Durable Functions: history and replay', label: 'Durable', caption: 'Press Play: the orchestrator schedules an activity, unloads, and on each wake-up replays from line 1, taking completed results from the history table.' }
  ],
  gotchas: [
    { trap: 'Five-field cron in a timer trigger', code: `@TimerTrigger(name = "t", schedule = "*/5 * * * *")     // ✗ 5 fields: invalid, or not what you mean
@TimerTrigger(name = "t", schedule = "0 */5 * * * *")   // ✓ every 5 minutes (sec min hour day month dow)`, lang: 'java', why: 'Functions uses NCRONTAB with a leading <b>seconds</b> field. People paste Unix cron and get an invalid schedule, or every-second firing when the fields shift.', fix: 'Always write six fields, put the expression in an app setting (<code>schedule = "%REPORT_SCHEDULE%"</code>), and check the next occurrences in the logs at startup. Times are UTC unless you set a time zone where the OS and plan support it.' },
    { trap: 'New clients per invocation', code: `public void run(...) {
  var http = HttpClient.newHttpClient();          // ✗ new connection pool every call
  var blob = new BlobServiceClientBuilder()...    // ✗ new auth + TLS every call
}`, lang: 'java', why: 'Each invocation opens new sockets and TLS sessions, and token acquisition repeats. Under load, instances hit outbound connection limits and calls start timing out.', fix: 'Create SDK and HTTP clients once (static fields or a lazily initialised holder) and reuse them across invocations. Prefer bindings where they fit.' },
    { trap: 'Long work behind an HTTP trigger', why: 'Whatever <code>functionTimeout</code> says, an HTTP-triggered function must respond within about 230 seconds, or the client gets a 502 while the function keeps running.', fix: 'Use async request-reply: start a Durable orchestration and return <code>202</code> with status URLs, or enqueue the work and return immediately.' },
    { trap: 'Retries duplicate side effects', why: 'If a Service Bus–triggered function throws, or the message lock expires during slow processing, the message is redelivered (up to the queue’s max delivery count, then dead-lettered). Charging a card or sending an email twice is a classic bug.', fix: 'Make handlers <b>idempotent</b> (dedupe on message ID or business key in Postgres with a unique constraint), keep processing under the lock duration (or let the host auto-renew within <code>maxAutoLockRenewalDuration</code>), and monitor the DLQ.' },
    { trap: 'Non-deterministic orchestrator code', code: `// ✗ inside an orchestrator
Instant deadline = Instant.now().plus(Duration.ofHours(24));
String id = UUID.randomUUID().toString();
// ✓
Instant deadline = ctx.getCurrentInstant().plus(Duration.ofHours(24));
String id = ctx.callActivity("NewId", null, String.class).await();`, lang: 'java', why: 'Orchestrators replay from the beginning on every wake-up. Values that differ on replay change the code path, and the framework throws non-determinism errors or behaves unpredictably.', fix: 'Do all I/O, randomness and clock reads in <b>activities</b> or through context APIs. Keep orchestrators pure coordination logic. Version orchestrations carefully when you change their code while instances are in flight.' },
    { trap: 'The host storage account is a hard dependency', why: 'The Functions host uses <code>AzureWebJobsStorage</code> for leases, timer locks, keys and (by default) Durable task hubs. Locking it behind a firewall, rotating its key or deleting it stops every trigger.', fix: 'Use an identity-based connection (<code>AzureWebJobsStorage__accountName</code> plus the right storage data roles for the app’s identity), keep the account private through VNet integration, and treat it as part of the app.' }
  ],
  scenarios: [
    { title: 'Payments charged twice during a slow-downstream incident',
      symptom: 'When the payment provider slowed to 90 s per call, some customers were charged two or three times. The Service Bus metrics show redeliveries.',
      diagnoseLang: 'kql', diagnose: `// App Insights (KQL)
traces
| where message has "charge" and customDimensions.MessageId != ""
| summarize n = count() by tostring(customDimensions.MessageId)
| where n > 1`,
      cause: 'Processing exceeded the message lock (and auto-renew), so Service Bus made the message visible again and another instance processed it. The handler wasn’t idempotent.',
      fix: 'Record processed message IDs (or the payment’s business key) in Postgres under a unique constraint, inside the same transaction as the state change. Pass an idempotency key to the provider. Tune lock renewal in host.json.',
      fixCode: `CREATE TABLE processed_message (message_id text PRIMARY KEY, processed_at timestamptz DEFAULT now());
-- in the handler's transaction:
INSERT INTO processed_message(message_id) VALUES (:id) ON CONFLICT DO NOTHING;  -- 0 rows → duplicate, skip

// host.json
{ "version": "2.0",
  "extensions": { "serviceBus": { "maxAutoLockRenewalDuration": "00:10:00", "maxConcurrentCalls": 8 } } }`, lang: 'sql' },
    { title: 'p99 latency spikes on a Java HTTP API every few minutes',
      symptom: 'A Java HTTP function on the classic Consumption plan shows p50 of 40 ms but p99 of 6–9 s, clustered after quiet periods and during ramp-ups.',
      diagnoseLang: 'kql', diagnose: `requests
| where cloud_RoleName == "func-orders"
| summarize p50 = percentile(duration, 50), p99 = percentile(duration, 99) by bin(timestamp, 5m)
// correlate with new instance starts:
traces | where message has "Host started" | summarize count() by bin(timestamp, 5m)`,
      cause: 'Cold starts: scale-from-zero and every scale-out instance pay JVM start plus class loading of a large JAR.',
      fix: 'Move to Flex Consumption with always-ready instances for the HTTP group (or Premium with pre-warmed instances), trim the JAR, and defer heavy initialisation.',
      fixCode: `az functionapp scale config always-ready set -g rg-orders -n func-orders --settings http=2
az functionapp scale config set -g rg-orders -n func-orders --instance-memory 2048 --maximum-instance-count 50`, lang: 'bash' },
    { title: 'The 02:00 report ran at every minute past two',
      symptom: 'A nightly report job sent 60 emails between 02:00 and 02:59 UTC.',
      diagnose: `grep -R "TimerTrigger" src/ | grep schedule
# schedule = "0 * 2 * * *"`,
      cause: 'Six fields, but the <b>minute</b> field was <code>*</code>: <code>0 * 2 * * *</code> means “second 0 of every minute during hour 2”, which is 60 runs. The author meant <code>0 0 2 * * *</code>, and nobody reviewed the expression.',
      fix: 'Use <code>0 0 2 * * *</code>, keep schedules in app settings, log the next occurrences at startup, and make the job idempotent per day (a run-date guard row).',
      fixCode: `@FunctionName("NightlyReport")
public void run(@TimerTrigger(name = "t", schedule = "%NIGHTLY_SCHEDULE%") String timerInfo, ExecutionContext ctx) { ... }
// app setting: NIGHTLY_SCHEDULE=0 0 2 * * *`, lang: 'java' }
  ],
  puzzles: [
    { kind: 'predict', q: 'Timer trigger <code>schedule = "0 */15 9-17 * * 1-5"</code>. When does it fire?', options: ['Every 15 seconds, 9–17', 'Every 15 minutes from 09:00 to 17:45, Monday to Friday', 'At 09:15 and 17:15 daily', 'Every 15 hours'], answer: 1, explain: 'Fields: second=0, minute=*/15, hour=9-17, any day, any month, weekdays 1–5. That is every quarter hour from 09:00 through 17:45 on weekdays (UTC unless configured).' },
    { kind: 'scenario', q: 'A Java HTTP API must answer in under 300 ms at p99, including after quiet periods, and needs VNet access to Postgres. Which plan setup?', options: ['Classic Consumption', 'Flex Consumption with always-ready instances for HTTP (or Premium with a minimum instance)', 'Consumption with a keep-alive ping every 5 minutes', 'Any plan; Java has no cold start'], answer: 1, explain: 'Always-ready (Flex) or minimum and pre-warmed instances (Premium) remove cold starts from the common path, and both support VNet integration. Keep-alive pings don’t cover scale-out instances.' },
    { kind: 'scenario', q: 'A queue-triggered function throws on a malformed message every time. What eventually happens with Service Bus?', options: ['It retries forever', 'After the queue’s max delivery count, the message moves to the dead-letter queue', 'It is silently deleted', 'The function app stops'], answer: 1, explain: 'Each failure abandons the message and increments its delivery count. At <code>maxDeliveryCount</code> it is dead-lettered. Alert on DLQ depth and build a re-drive tool.' },
    { kind: 'scenario', q: 'An HTTP-triggered function on Premium has <code>functionTimeout</code> = 60 minutes. A request takes 6 minutes. What does the caller see?', options: ['The result after 6 minutes', 'A timeout or 502 at around 230 seconds', 'A 202 Accepted', 'A 429'], answer: 1, explain: 'The HTTP front end has a ~230 s limit whatever the plan timeout. Use the async HTTP pattern (Durable) for long work.' },
    { kind: 'predict', q: 'An orchestrator calls activities A, B, C in sequence. After C completes and the instance finishes, how many times did the orchestrator <b>function</b> run, and how many times did activity A run (no failures)?', options: ['Orchestrator 1×, A 1×', 'Orchestrator 4×, A 1×', 'Orchestrator 4×, A 4×', 'Orchestrator 3×, A 3×'], answer: 1, explain: 'The orchestrator runs once at start and once after each activity completes: 4 executions (1 + 3 replays). Activities run once each; on replay their results come from history.' },
    { kind: 'scenario', q: 'You must process 10,000 files in parallel and then aggregate the results, durably. Which Durable pattern?', options: ['Function chaining', 'Fan-out/fan-in: schedule N activity tasks, then <code>ctx.allOf(tasks).await()</code>', 'Monitor', 'Human interaction'], answer: 1, explain: 'Fan-out/fan-in schedules many activities in parallel, checkpoints each completion, and resumes when all are done, even across restarts. Batch very large fan-outs (sub-orchestrations) to keep histories small.' },
    { kind: 'scenario', q: 'How should a function authenticate its Service Bus trigger without a connection string?', options: ['Put a SAS key in Key Vault', 'Set <code>ServiceBus__fullyQualifiedNamespace</code> and give the app’s managed identity Azure Service Bus Data Receiver', 'Use the storage account key', 'It isn’t possible for triggers'], answer: 1, explain: 'Identity-based connections use <code>&lt;connection&gt;__fullyQualifiedNamespace</code> (plus <code>__clientId</code> for a user-assigned identity) and RBAC data roles. No secret is involved.' }
  ],
  interview: [
    { q: 'Explain triggers vs bindings.', a: '<p>A <b>trigger</b> starts the function and supplies the event payload. There is exactly one. <b>Bindings</b> are declarative inputs and outputs (read a blob, write to a queue or Cosmos DB) that the host handles, so your code stays small. Bindings are convenient for simple I/O; for complex logic (transactions, retries, batching) use the SDK directly.</p>', lvl: 'core' },
    { q: 'Compare Consumption, Flex Consumption, Premium and Dedicated.', a: '<ul><li><b>Consumption</b> (classic): scale to zero, pay per execution, 10-minute max timeout, no VNet integration. Microsoft is steering Linux users to Flex.</li><li><b>Flex Consumption</b>: Linux, fast per-function-group scaling, scale to zero, VNet, always-ready instances, selectable instance memory.</li><li><b>Premium</b>: always at least one instance, pre-warmed buffer, VNet, larger SKUs, long timeouts. No scale to zero.</li><li><b>Dedicated</b>: runs on an App Service plan you already pay for, with normal App Service scaling.</li></ul><p>Check Microsoft Learn for current limits and retirement dates.</p>', lvl: 'core' },
    { q: 'What makes Java cold starts slow, and what do you do about it?', a: '<p>Instance allocation, host start, a separate JVM worker start, class loading of a large JAR, and framework initialisation. Mitigations: always-ready (Flex) or pre-warmed (Premium) instances, smaller dependency sets, lazy initialisation, avoiding heavy frameworks inside functions, reusing static clients, and Class Data Sharing where supported.</p>', lvl: 'core' },
    { q: 'How does scaling work for a Service Bus–triggered function?', a: '<p>The scale controller watches queue length and message age and adds instances. Each instance processes up to <code>maxConcurrentCalls</code> (or the session equivalent) at once. Total concurrency = instances × per-instance concurrency, so cap it (maximum instance count in Flex, <code>maxConcurrentCalls</code>) to protect Postgres and downstream APIs.</p>', lvl: 'deep' },
    { q: 'How does Durable Functions work internally?', a: '<p>State lives in a <b>task hub</b> (Azure Storage by default; MSSQL and the managed Durable Task Scheduler are alternatives). Orchestrators schedule work via messages and append events to a history. When an event arrives, the orchestrator <b>replays</b> its code from the start: completed tasks return recorded results, and new tasks are scheduled. That is why code must be deterministic and activities idempotent.</p>', fu: 'What happens to histories in long-running loops? (They grow. Use <code>continueAsNew</code> to restart with fresh history.)', lvl: 'deep' },
    { q: 'Name the main Durable patterns.', a: '<p>Function chaining, fan-out/fan-in, async HTTP APIs (202 plus a status endpoint), monitor (a polling loop with durable timers), human interaction (wait for an external event with a timeout), and aggregator (durable entities). Sub-orchestrations compose them.</p>', lvl: 'core' },
    { q: 'When would you not use Functions for a Java team?', a: '<p>For a full Spring Boot service with many endpoints (an App Service or Container App is simpler), steady high throughput where per-instance concurrency and connection pooling matter, or work that needs long-held connections such as WebSockets. Also when the team wants one deployment model for everything.</p>', lvl: 'core' },
    { q: 'How do you handle configuration and secrets in Functions?', a: '<p>App settings are environment variables, binding expressions resolve <code>%SETTING%</code>, and Key Vault references (<code>@Microsoft.KeyVault(SecretUri=…)</code>) resolve through the app’s managed identity. Prefer identity-based connections, so there are no secrets for Service Bus, Storage, Event Hubs or Cosmos DB.</p>', lvl: 'core' },
    { q: 'How would you use Functions in an AI agent system?', a: '<p>For event glue: a blob-trigger ingestion pipeline (chunk, embed, upsert into AI Search or pgvector), Durable orchestrations for multi-step agent workflows with human approval (wait for an external event), timer-triggered evaluation runs, and queue-triggered tool executions with idempotency. Keep the interactive agent API on Container Apps or App Service if latency matters.</p>', lvl: 'deep' },
    { q: 'What does “per-function scaling” in Flex Consumption mean?', a: '<p>HTTP-triggered functions, Blob (Event Grid) triggers and Durable functions scale as groups, and other triggers scale per function, each on its own instances. A busy queue function no longer forces your HTTP functions onto the same scale decision. Always-ready counts are set per group or function.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Java: Service Bus trigger + output binding', lang: 'java', code: `public class OrderFunctions {
  // reuse clients across invocations
  private static final HttpClient HTTP = HttpClient.newHttpClient();

  @FunctionName("OnOrder")
  public void onOrder(
      @ServiceBusQueueTrigger(name = "msg", queueName = "orders", connection = "ServiceBus") String body,
      @BindingName("MessageId") String messageId,
      @QueueOutput(name = "out", queueName = "shipments", connection = "AzureWebJobsStorage") OutputBinding<String> out,
      final ExecutionContext ctx) {
    if (!Idempotency.firstTime(messageId)) return;     // dedupe on message ID
    Order o = Json.read(body, Order.class);
    out.setValue(Json.write(new ShipmentRequest(o.id())));
    ctx.getLogger().info("queued shipment for " + o.id());
  }

  @FunctionName("Health")
  public HttpResponseMessage health(
      @HttpTrigger(name = "req", methods = {HttpMethod.GET}, authLevel = AuthorizationLevel.ANONYMOUS)
      HttpRequestMessage<Optional<String>> req) {
    return req.createResponseBuilder(HttpStatus.OK).body("ok").build();
  }
}
// app settings (identity-based, no secrets):
//   ServiceBus__fullyQualifiedNamespace = sb-orders.servicebus.windows.net
//   AzureWebJobsStorage__accountName    = stfuncorders` },
    { title: 'Java: Durable orchestration', lang: 'java', code: `// com.microsoft:durabletask-azure-functions
@FunctionName("StartOrder")
public HttpResponseMessage start(
    @HttpTrigger(name = "req", methods = {HttpMethod.POST}) HttpRequestMessage<String> req,
    @DurableClientInput(name = "durable") DurableClientContext durable) {
  String id = durable.getClient().scheduleNewOrchestrationInstance("OrderSaga", req.getBody());
  return durable.createCheckStatusResponse(req, id);          // 202 + status URLs
}

@FunctionName("OrderSaga")
public String saga(@DurableOrchestrationTrigger(name = "ctx") TaskOrchestrationContext ctx) {
  String order = ctx.getInput(String.class);
  ctx.callActivity("Reserve", order, String.class).await();
  ctx.callActivity("Charge", order, String.class).await();
  try {
    ctx.waitForExternalEvent("Shipped", Duration.ofHours(24), String.class).await();
  } catch (TaskCanceledException timeout) {
    ctx.callActivity("Refund", order, String.class).await();  // compensate
    return "refunded";
  }
  ctx.callActivity("Notify", order, String.class).await();
  return "done";
}

@FunctionName("Charge")
public String charge(@DurableActivityTrigger(name = "order") String order) {
  return Payments.charge(order, /* idempotency key */ order);   // real I/O lives in activities
}` },
    { title: 'Flex Consumption app (az)', lang: 'bash', code: `az storage account create -g rg-orders -n stfuncorders -l westeurope --sku Standard_LRS --allow-shared-key-access false

az functionapp create -g rg-orders -n func-orders --storage-account stfuncorders \\
  --flexconsumption-location westeurope --runtime java --runtime-version 21 \\
  --assign-identity "[system]"

# keep HTTP functions warm, size instances, cap scale-out
az functionapp scale config always-ready set -g rg-orders -n func-orders --settings http=1
az functionapp scale config set -g rg-orders -n func-orders --instance-memory 2048 --maximum-instance-count 40

# deploy from Maven
mvn clean package azure-functions:deploy`, note: 'Flag names for Flex settings are fairly new. Check <code>az functionapp scale config -h</code> on your CLI version. With shared keys disabled, the host storage connection must be identity-based, and the app identity needs Storage Blob, Queue and Table data roles as documented.' },
    { title: 'host.json essentials', lang: 'json', code: `{
  "version": "2.0",
  "functionTimeout": "00:30:00",
  "logging": {
    "applicationInsights": { "samplingSettings": { "isEnabled": true, "excludedTypes": "Request" } }
  },
  "extensions": {
    "serviceBus": {
      "maxConcurrentCalls": 8,
      "maxAutoLockRenewalDuration": "00:10:00",
      "autoCompleteMessages": true
    },
    "durableTask": { "hubName": "OrdersHub" }
  }
}` }
  ]
});

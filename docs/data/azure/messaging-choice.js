IA.register({
  track: 'azure',
  slug: 'messaging-choice',
  title: 'Service Bus vs Event Hubs vs Event Grid',
  tagline: 'Three services, three shapes. <b>Service Bus</b> is a broker for <i>commands</i> you must not lose: queues, topics, locks, sessions and dead-lettering. <b>Event Hubs</b> is a partitioned <i>log</i> for streams you read and replay at your own pace. <b>Event Grid</b> <i>pushes</i> small notifications that something happened to whoever subscribed.',
  tldr: {
    problem: 'Teams pick the messaging service by name, then fight it: they replay history from a Service Bus queue (it’s gone once completed), build per-message workflows on Event Hubs (there are no per-message locks or DLQ), or send 50 KB order payloads through Event Grid and wonder about ordering.',
    model: '<b>Service Bus</b>: a message is <i>owned</i> by one receiver at a time (peek-lock), then completed or dead-lettered. <b>Event Hubs</b>: events are appended to partitions and kept for the retention period; each <i>consumer group</i> tracks its own offset per partition. <b>Event Grid</b>: an event is <i>pushed</i> to each matching subscription, retried with backoff, then dead-lettered if configured.',
    hook: '“A bad message is blocking my queue.” In Service Bus it is retried until <code>MaxDeliveryCount</code> and then moved to the dead-letter queue. In Event Hubs there is no such thing: your consumer must skip it or park it itself, or the partition stalls.',
    facts: [
      { v: '10', l: 'default <code>MaxDeliveryCount</code> on a Service Bus queue or subscription before a message moves to the dead-letter subqueue' },
      { v: '1 reader', l: 'per partition per consumer group is the recommended pattern in Event Hubs; partitions are the unit of ordering and parallelism' },
      { v: '24 h', l: 'default event time-to-live for Event Grid delivery retries (with up to 30 attempts by default), after which events are dropped or dead-lettered' }
    ]
  },
  intro: {
    what: 'Services talk to each other <b>asynchronously</b> so that one can be slow or down without breaking the other. Azure has three main services for this. <b>Service Bus</b> moves <b>messages</b> (do this: “charge order 42”) through queues and topics, with exactly one owner per message at a time. <b>Event Hubs</b> ingests <b>streams</b> of events (telemetry, clicks, logs) at high volume into an ordered log many readers can replay. <b>Event Grid</b> routes <b>notifications</b> (“a blob was created”) from Azure services or your apps to subscribers.',
    analogy: { icon: '📮', title: 'Registered mail, a newspaper archive and a doorbell', text: '<b>Service Bus</b> is registered mail: one recipient signs for each letter, and undeliverable letters go to a dead-letter office. <b>Event Hubs</b> is a newspaper archive: every edition is kept for a while, and each reader keeps their own bookmark and can re-read old issues. <b>Event Grid</b> is a doorbell: it rings everyone who asked to be told, and keeps ringing for a while if nobody answers.' },
    steps: [
      { t: 'Is it a command or a business message that must be handled once?', d: 'Service Bus: queues for one consumer type, topics + subscriptions for several. You get locks, retries, DLQ, sessions, duplicate detection and transactions.' },
      { t: 'Is it a high-volume stream you analyse or replay?', d: 'Event Hubs: partitions, consumer groups, checkpoints, retention, Capture to storage, and a Kafka-compatible endpoint.' },
      { t: 'Is it a reaction to a state change, often from Azure itself?', d: 'Event Grid: system topics for Blob, Key Vault, resource events and more, or custom topics, with filters and push delivery.' },
      { t: 'Combine them', d: 'A common shape: Event Grid notices a blob upload → a Service Bus queue holds the “process this file” command → telemetry from processing goes to Event Hubs.' }
    ],
    terms: [
      ['queue / topic / subscription', 'A Service Bus queue has competing consumers. A topic copies each message to every subscription whose filter matches; each subscription behaves like a queue.'],
      ['peek-lock', 'The receiver gets a message under a lock. It must complete, abandon or dead-letter it before the lock expires, or the message becomes visible again.'],
      ['dead-letter queue (DLQ)', 'A subqueue holding messages that exceeded MaxDeliveryCount, expired or were explicitly dead-lettered.'],
      ['session', 'A Service Bus group of messages sharing a SessionId, received in order by one receiver holding the session lock.'],
      ['partition / consumer group', 'Event Hubs stores events in ordered partitions. A consumer group is one independent view of the stream, with its own offsets.'],
      ['checkpoint', 'A consumer’s saved position in a partition (stored, for example, in Blob Storage) so it can resume after a restart.']
    ]
  },
  visual: {
    title: 'Follow the message',
    caption: 'Pick a flow and press Play. <b>Queue + DLQ</b>: peek-lock, a poison message and a lock timeout. <b>Sessions</b>: FIFO per SessionId. <b>Topic</b>: filtered subscriptions. <b>Event Hubs</b>: partitions, consumer groups and replay. <b>Event Grid</b>: push, retry and dead-letter.'
  },
  gotchas: [
    { trap: 'Processing longer than the lock duration', why: 'A Service Bus lock lasts the entity’s <code>LockDuration</code> (1 minute by default). If processing takes longer, the lock expires, the message reappears, a second consumer processes it, and the first consumer’s <code>complete</code> fails with <code>MessageLockLost</code>.', fix: 'Keep handlers short. Let the processor client renew locks automatically (<code>maxAutoLockRenewDuration</code>), and make handlers <b>idempotent</b> (dedupe on <code>MessageId</code> or a business key), because delivery is at-least-once.', code: `new ServiceBusClientBuilder().credential(ns, cred).processor()
    .queueName("orders")
    .maxAutoLockRenewDuration(Duration.ofMinutes(5))
    .disableAutoComplete()
    .processMessage(this::handle).processError(this::onError)
    .buildProcessorClient();`, lang: 'java' },
    { trap: 'Nobody watches the dead-letter queue', why: 'Poison messages move to <code>orders/$deadletterqueue</code> quietly. The main queue looks healthy while customers’ orders sit in the DLQ for weeks.', fix: 'Alert on the <b>dead-lettered message count</b> metric, record <code>DeadLetterReason</code> and description when you dead-letter, and build a small resubmit tool that reads the DLQ subqueue and sends fixed messages back.' },
    { trap: 'Using Event Hubs as a work queue', why: 'Event Hubs has no per-event locks, no delivery count and no DLQ. A consumer that can’t process one event either blocks its partition (retrying forever) or skips it (losing it). Checkpoint frequency also decides how much is reprocessed after a crash.', fix: 'Use Service Bus for per-message workflows. In Event Hubs consumers, catch failures per event, park bad events in a store or a Service Bus queue, then checkpoint and move on.' },
    { trap: 'Too few Event Hubs partitions', why: 'Partitions bound the parallelism of each consumer group: one active reader per partition. In the Standard tier the partition count can’t be changed after creation; Premium and Dedicated allow increasing it.', fix: 'Size partitions for peak consumer parallelism (and future growth) when you create the hub. Choose partition keys with many values so load is even, and remember that ordering is only guaranteed within a partition.' },
    { trap: 'Expecting ordering without sessions', why: 'A Service Bus queue with several competing consumers (or a prefetching client) completes messages in no guaranteed order. “Order shipped” can be processed before “order paid”.', fix: 'Enable <b>sessions</b> on the queue and set <code>SessionId</code> to the aggregate ID (for example the order ID). Messages in a session are delivered in order to one receiver at a time, while different sessions run in parallel.' },
    { trap: 'Event Grid webhook that never validates', why: 'When you create a subscription to a webhook, Event Grid sends a <b>validation event</b> and expects the endpoint to echo the validation code (or to call the validation URL). Until then the subscription isn’t active. Azure Functions and Service Bus or Storage queue handlers do this for you.', fix: 'Handle <code>Microsoft.EventGrid.SubscriptionValidationEvent</code> in custom webhooks, or deliver to a Function, a Service Bus queue or an Event Hub instead. Configure a <b>dead-letter</b> container, because it is off by default.' }
  ],
  scenarios: [
    { title: 'Orders silently stuck for nine days',
      symptom: 'Customer support reports orders that were paid but never fulfilled. The fulfilment service shows no errors, and the queue’s active message count is near zero.',
      diagnose: `az servicebus queue show -g rg-shop-prod --namespace-name sb-shop -n orders \\
  --query "countDetails.{active:activeMessageCount, dead:deadLetterMessageCount}"
# { "active": 3, "dead": 1874 }`,
      cause: 'A new optional field broke deserialization for some messages. Each was retried 10 times, then dead-lettered. Nothing alerted on the DLQ.',
      fix: 'Fix the consumer, resubmit the dead-lettered messages, and alert on dead-letter count &gt; 0. Dead-letter explicitly with a reason when a message is clearly invalid, instead of throwing until MaxDeliveryCount.',
      fixCode: `ServiceBusReceiverClient dlq = new ServiceBusClientBuilder().credential(ns, cred)
    .receiver().queueName("orders").subQueue(SubQueue.DEAD_LETTER_QUEUE).buildClient();
ServiceBusSenderClient sender = new ServiceBusClientBuilder().credential(ns, cred)
    .sender().queueName("orders").buildClient();
for (ServiceBusReceivedMessage m : dlq.receiveMessages(100, Duration.ofSeconds(5))) {
    sender.sendMessage(new ServiceBusMessage(m));   // copy body + properties
    dlq.complete(m);
}`, lang: 'java' },
    { title: 'Telemetry dashboard 40 minutes behind',
      symptom: 'An Event Hubs consumer for device telemetry falls further behind during the day. Adding more consumer instances doesn’t help.',
      diagnose: `# 4 partitions, 12 consumer instances in the same consumer group
# processor logs: 8 instances own 0 partitions; 4 instances own 1 each
# metric: Incoming Messages >> Outgoing Messages for the consumer group`,
      cause: 'Parallelism per consumer group is capped at the partition count (4). Extra instances sat idle. The hub was in the Standard tier, so partitions couldn’t be added.',
      fix: 'Create a new hub with more partitions (or move to Premium, where partitions can be increased), dual-write during migration, and batch-process events in the handler. Checkpoint every N events instead of every event.' },
    { title: 'Thumbnails missing for some uploads',
      symptom: 'A Function subscribed through Event Grid creates thumbnails for uploaded images. During a deployment some uploads never got thumbnails.',
      diagnose: `az eventgrid event-subscription show --name thumbs --source-resource-id $ST_ID \\
  --query "{deadletter:deadLetterDestination, retry:retryPolicy}"
# deadletter: null`,
      cause: 'The Function returned errors for several minutes. Event Grid retried, but some events exhausted their retries while the dead-letter destination wasn’t configured, so they were dropped.',
      fix: 'Configure a dead-letter container, alert on dead-lettered events, and for important work deliver to a <b>Service Bus queue</b> first, so the Function processes from a durable queue with its own retries and DLQ.',
      fixCode: `az eventgrid event-subscription update --name thumbs --source-resource-id $ST_ID \\
  --deadletter-endpoint $ST_ID/blobServices/default/containers/eg-deadletter` }
  ],
  puzzles: [
    { kind: 'scenario', q: 'Payments must be processed exactly once per order, in order per customer, with failed messages kept for inspection. Which service and feature?', options: ['Event Grid with a webhook', 'Event Hubs with one partition', 'Service Bus queue with sessions (SessionId = customerId), DLQ and idempotent handlers', 'Storage queues'], answer: 2, explain: 'Sessions give per-customer FIFO with parallelism across customers, and the DLQ keeps failures. Delivery is at-least-once, so idempotency (or duplicate detection on send) supplies the “once”.' },
    { kind: 'scenario', q: 'You ingest 200,000 events/s of clickstream and need two independent consumers (real-time scoring and a nightly batch that replays the day). Which fits?', options: ['Service Bus topic with two subscriptions', 'Event Hubs with two consumer groups', 'Event Grid custom topic', 'Two Service Bus queues'], answer: 1, explain: 'Event Hubs is built for high-throughput streams. Each consumer group has its own offsets, and events stay for the retention period, so the batch job can replay.' },
    { kind: 'predict', q: 'A Service Bus queue has MaxDeliveryCount = 10. A handler always throws for one message. How many times is that message delivered before it moves to the DLQ?', options: ['1', '9', '10', 'Forever'], answer: 2, explain: 'Each failed delivery (abandon or lock expiry) increments <code>DeliveryCount</code>. When it exceeds the maximum, after the <b>10th</b> delivery, the message is dead-lettered with reason <code>MaxDeliveryCountExceeded</code>.' },
    { kind: 'scenario', q: 'A topic <code>order-events</code> has subscriptions billing (no filter), shipping (<code>region = \'EU\'</code>) and analytics (<code>type = \'OrderPlaced\'</code>). An <code>OrderPlaced</code> message with region US is sent. Who gets it?', options: ['billing only', 'billing and analytics', 'all three', 'shipping and analytics'], answer: 1, explain: 'Each subscription evaluates its own filter. Billing’s default rule matches everything, shipping’s doesn’t match US, and analytics matches the type: <b>billing and analytics</b>.' },
    { kind: 'scenario', q: 'An Event Hub has 8 partitions. How many instances of one consumer group can actively process in parallel?', options: ['1', '8', 'Unlimited', '32'], answer: 1, explain: 'One active reader per partition per consumer group: <b>8</b>. More instances wait for a partition to become free.' },
    { kind: 'scenario', q: 'You want a Function to run whenever a Key Vault secret is about to expire. What is the natural trigger?', options: ['Poll Key Vault every minute', 'Event Grid system topic for the vault, with the SecretNearExpiry event type', 'Event Hubs capture', 'A Service Bus scheduled message'], answer: 1, explain: 'Key Vault publishes events such as <code>Microsoft.KeyVault.SecretNearExpiry</code> to Event Grid. Subscribe a Function or a queue with an event-type filter.' },
    { kind: 'scenario', q: 'Your consumer crashed after processing events 100–150 of a partition but its last checkpoint was at 99. What happens on restart?', options: ['It continues from 151', 'It reprocesses 100–150, so handlers must be idempotent', 'Events 100–150 are lost', 'Event Hubs dead-letters them'], answer: 1, explain: 'Processing resumes from the last <b>checkpoint</b>. Everything after it is delivered again. Checkpoint frequency trades checkpoint cost against reprocessing.' },
    { kind: 'scenario', q: 'You need JMS 2.0 with a Spring Boot app migrating from ActiveMQ, plus private endpoints. Which Service Bus tier?', options: ['Basic', 'Standard', 'Premium', 'Any tier'], answer: 2, explain: 'Premium is the tier for full JMS 2.0 support, dedicated capacity (messaging units) and private endpoints. Basic has no topics at all.' }
  ],
  interview: [
    { q: 'How do you choose between Service Bus, Event Hubs and Event Grid?', a: '<ul><li><b>Service Bus</b>: discrete, high-value messages; one owner at a time; ordering through sessions; DLQ, duplicate detection, scheduled messages, transactions.</li><li><b>Event Hubs</b>: high-volume streams; a partitioned log with retention; many independent readers; replay; Kafka endpoint; Capture to storage.</li><li><b>Event Grid</b>: reactive, push-based notifications with filters, from Azure services or your own topics.</li></ul><p>The question to ask: is the payload a <i>command</i>, a <i>stream</i> or a <i>notification</i>?</p>', lvl: 'core' },
    { q: 'Explain peek-lock vs receive-and-delete.', a: '<p><b>Peek-lock</b>: the message is locked to the receiver and stays in the queue until it is completed. Abandon, lock expiry or a crash makes it available again with <code>DeliveryCount</code>+1. <b>Receive-and-delete</b>: the message is removed when delivered, so a crash loses it. Use peek-lock for anything that matters.</p>', lvl: 'core' },
    { q: 'How do Service Bus sessions work, and when do you need them?', a: '<p>On a session-enabled entity, each message carries a <code>SessionId</code>. A receiver accepts a session and holds a session lock, then gets that session’s messages in order. Other receivers take other sessions in parallel. Use them for per-aggregate ordering (an order’s lifecycle, a customer’s transactions) and for request/response correlation. Session state can store a small cursor per session.</p>', fu: 'What happens to throughput if one session is very hot? (It is processed by one receiver at a time, so it can become a bottleneck; pick a finer session key if order allows.)', lvl: 'deep' },
    { q: 'How does Event Hubs achieve ordering and scale?', a: '<p>Events with the same partition key go to the same partition, which is an append-only log ordered by offset and sequence number. Scale comes from more partitions and throughput or processing units. Each consumer group reads every partition independently and checkpoints offsets (for example in Blob Storage with <code>EventProcessorClient</code>). Ordering is only per partition.</p>', lvl: 'core' },
    { q: 'What delivery guarantees do the three services give?', a: '<p>All three are effectively <b>at-least-once</b>. Service Bus offers duplicate detection on send within a time window, and transactions for receive-then-send. Event Hubs reprocesses from the last checkpoint after a failure. Event Grid retries with backoff and can deliver duplicates. So handlers must be idempotent.</p>', lvl: 'core' },
    { q: 'How do you implement the transactional outbox with Service Bus and Postgres?', a: '<p>In the same database transaction as the business change, insert a row into an <code>outbox</code> table. A relay (a scheduled poller, or logical decoding / Debezium) reads unsent rows, sends them to Service Bus with <code>MessageId</code> = outbox ID (so duplicate detection catches resends), and marks them sent. This avoids the dual-write problem of “commit, then send”.</p>', lvl: 'deep' },
    { q: 'What are Event Grid’s main building blocks?', a: '<p><b>Topics</b> (system topics for Azure sources, custom topics, domains for many tenants), <b>event subscriptions</b> with filters on event type, subject prefix/suffix and advanced filters, and <b>handlers</b> (Functions, webhooks, Service Bus, Storage queues, Event Hubs). It supports the CloudEvents 1.0 schema. Delivery is push with retries and optional dead-lettering to Blob. Event Grid namespaces add pull delivery and MQTT.</p>', lvl: 'core' },
    { q: 'How would you connect Spring Boot to these services?', a: '<p>Spring Cloud Azure 5.x: the Service Bus starter (<code>ServiceBusProcessorClient</code>, or JMS with the JMS starter), Spring Cloud Stream binders for Service Bus and Event Hubs, or the <b>Kafka</b> protocol to Event Hubs with plain Spring Kafka. Authenticate with managed identity (<b>Azure Service Bus Data Receiver/Sender</b>, <b>Azure Event Hubs Data Receiver/Sender</b> roles) rather than connection strings.</p>', lvl: 'core' },
    { q: 'An AI agent needs to run long tool calls triggered by user requests. How would you use messaging?', a: '<p>The API writes a “run task” command to a Service Bus queue with a <code>SessionId</code> per conversation (so turns are ordered) and returns 202. Workers process with lock renewal, write results to Cosmos DB or Postgres, and publish a “task completed” event (Event Grid or a topic) that the UI or webhook layer listens to. Failures dead-letter with a reason, and token-usage telemetry streams to Event Hubs.</p>', lvl: 'deep' },
    { q: 'When would you use Event Hubs’ Kafka endpoint instead of real Kafka?', a: '<p>When you want Kafka clients (Spring Kafka, Kafka Connect, some stream tools) without running brokers. Many Kafka features map well, but not all (check topic-level config, compaction support and transactions on Microsoft Learn for your tier). If you rely heavily on the wider Kafka ecosystem, a managed Kafka offering may fit better.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Service Bus processor (Java SDK, managed identity)', lang: 'java', code: `TokenCredential cred = new DefaultAzureCredentialBuilder().build();

ServiceBusProcessorClient processor = new ServiceBusClientBuilder()
    .fullyQualifiedNamespace("sb-shop.servicebus.windows.net")
    .credential(cred)
    .processor()
    .queueName("orders")
    .maxConcurrentCalls(8)
    .maxAutoLockRenewDuration(Duration.ofMinutes(5))
    .disableAutoComplete()
    .processMessage(ctx -> {
        var msg = ctx.getMessage();
        try {
            OrderCommand cmd = json.readValue(msg.getBody().toBytes(), OrderCommand.class);
            if (alreadyProcessed(msg.getMessageId())) { ctx.complete(); return; }   // idempotent
            fulfil(cmd);
            ctx.complete();
        } catch (JsonProcessingException bad) {
            ctx.deadLetter(new DeadLetterOptions()
                .setDeadLetterReason("InvalidPayload").setDeadLetterErrorDescription(bad.getOriginalMessage()));
        } catch (Exception transientError) {
            ctx.abandon();                      // DeliveryCount + 1, retried
        }
    })
    .processError(err -> log.error("Service Bus error {}", err.getErrorSource(), err.getException()))
    .buildProcessorClient();
processor.start();` },
    { title: 'Event Hubs processor with Blob checkpoints', lang: 'java', code: `BlobContainerAsyncClient ckpt = new BlobContainerClientBuilder()
    .endpoint("https://stckpt.blob.core.windows.net/eh-checkpoints")
    .credential(cred).buildAsyncClient();

EventProcessorClient p = new EventProcessorClientBuilder()
    .fullyQualifiedNamespace("eh-telemetry.servicebus.windows.net")
    .eventHubName("device-telemetry")
    .consumerGroup("fraud-detector")
    .credential(cred)
    .checkpointStore(new BlobCheckpointStore(ckpt))
    .processEventBatch(batch -> {
        batch.getEvents().forEach(this::score);          // park bad events, don't block
        if (!batch.getEvents().isEmpty()) batch.updateCheckpoint();
    }, 100, Duration.ofSeconds(5))
    .processError(err -> log.warn("partition {} error", err.getPartitionContext().getPartitionId(), err.getThrowable()))
    .buildEventProcessorClient();
p.start();` },
    { title: 'CLI: queue with sessions, topic filter, Event Grid route', lang: 'bash', code: `az servicebus queue create -g rg-shop-prod --namespace-name sb-shop -n payments \\
  --enable-session true --max-delivery-count 10 --lock-duration PT1M \\
  --enable-dead-lettering-on-message-expiration true

az servicebus topic subscription rule create -g rg-shop-prod --namespace-name sb-shop \\
  --topic-name order-events --subscription-name shipping -n eu-only \\
  --filter-sql-expression "region = 'EU'"

az eventhubs eventhub create -g rg-data --namespace-name eh-telemetry -n device-telemetry --partition-count 16

az eventgrid event-subscription create -n uploads-to-queue --source-resource-id $ST_ID \\
  --endpoint-type servicebusqueue --endpoint $QUEUE_ID \\
  --included-event-types Microsoft.Storage.BlobCreated \\
  --subject-begins-with /blobServices/default/containers/uploads/ \\
  --deadletter-endpoint $ST_ID/blobServices/default/containers/eg-deadletter` },
    { title: 'Spring Cloud Stream with the Service Bus binder', lang: 'yaml', code: `# dependency: com.azure.spring:spring-cloud-azure-stream-binder-servicebus
spring:
  cloud:
    azure:
      servicebus:
        namespace: sb-shop
    function:
      definition: handleOrder        # a java.util.function.Consumer<OrderCommand> bean
    stream:
      bindings:
        handleOrder-in-0:
          destination: orders
      servicebus:
        bindings:
          handleOrder-in-0:
            consumer:
              entity-type: queue
              auto-complete: false   # complete via Checkpointer header, or rely on binder ack mode` }
  ]
});

IA.register({
  track: 'spring',
  slug: 'kafka-messaging',
  title: 'Kafka with Spring',
  tagline: 'A <code>@KafkaListener</code> is a <b>listener container</b>: a consumer thread per partition group that polls, calls your method, and commits <b>offsets</b>. Kafka delivers at least once, so the questions that matter are when the offset is committed, what happens to the record that keeps failing, and what your code does when it sees the same record twice.',
  tldr: {
    problem: 'Duplicate orders after a deploy, a partition stuck on one bad record for hours, events published for orders that were rolled back, or a consumer group that rebalances every five minutes.',
    model: 'Each partition is an ordered log. The consumer’s <b>committed offset</b> is the next record it will read after a restart. Spring commits after your listener returns (default <code>AckMode.BATCH</code>: after the whole poll). On an exception, <code>DefaultErrorHandler</code> seeks back and retries on the same thread, blocking that partition, then hands the record to a recoverer such as the <code>DeadLetterPublishingRecoverer</code>.',
    hook: '“Can you get exactly-once with Kafka and Postgres?” Not with Kafka transactions alone: they cover Kafka-to-Kafka. For a database, you combine at-least-once delivery with an <b>idempotent consumer</b> (dedupe table) and publish with a <b>transactional outbox</b>.',
    facts: [
      { v: '10 attempts', l: '<code>DefaultErrorHandler</code>’s default: <code>FixedBackOff(0, 9)</code>, i.e. one delivery plus 9 retries with no delay, then the record is logged and skipped' },
      { v: '5 min', l: 'default <code>max.poll.interval.ms</code>: take longer between polls and the consumer is removed from the group and its partitions are reassigned' },
      { v: 'Spring Kafka 3.0', l: '<code>KafkaTemplate.send()</code> returns <code>CompletableFuture</code> instead of <code>ListenableFuture</code>; Boot 3.x ships Spring Kafka 3.x' }
    ]
  },
  intro: {
    what: 'Kafka stores messages in <b>topics</b>, split into <b>partitions</b>. Each partition is an append-only list where every record has a number, its <b>offset</b>. Consumers in the same <b>group</b> share the partitions, and each remembers how far it got by <b>committing</b> an offset. Spring Kafka wraps the consumer loop for you: you write a method, it polls, calls you and commits.',
    analogy: { icon: '📚', title: 'Reading a book with a bookmark', text: 'Each partition is a book. You read pages in order and move your bookmark (the committed offset) now and then. If you fall asleep, you restart from the bookmark, so you may reread a few pages. If one page is unreadable, you either stare at it (blocking retry), tear it out and put it in the “problems” folder (dead-letter topic), or note it for later and read on (retry topic).' },
    steps: [
      { t: 'Write a listener', d: 'Spring creates a container with a Kafka consumer per thread.', code: '@KafkaListener(topics = "orders", groupId = "billing", concurrency = "3")\nvoid on(OrderPlaced e) { … }' },
      { t: 'Partitions are shared out', d: 'With 6 partitions and concurrency 3, each consumer thread owns 2 partitions. Order is guaranteed only within one partition.' },
      { t: 'Poll, process, commit', d: '<code>poll()</code> returns a batch. Your method runs once per record. The container then commits the next offset to read.' },
      { t: 'Failures retry, then go to a dead-letter topic', d: 'The error handler retries; when it gives up, a recoverer publishes the record to <code>orders.DLT</code> so the partition can move on.' },
      { t: 'Expect duplicates', d: 'A crash between processing and committing means the records are delivered again. Make processing idempotent.' }
    ],
    terms: [
      ['offset', 'Position of a record in a partition. The committed offset is the <i>next</i> one to read.'],
      ['consumer group', 'Consumers sharing a <code>group.id</code>; each partition is assigned to one of them.'],
      ['rebalance', 'Reassigning partitions when a consumer joins, leaves or misses its deadlines.'],
      ['AckMode', 'When the container commits: <code>BATCH</code> (default), <code>RECORD</code>, <code>MANUAL</code>, <code>MANUAL_IMMEDIATE</code>, <code>TIME</code>, <code>COUNT</code>…'],
      ['DLT', 'Dead-letter topic: where records that can’t be processed are parked, with the exception in headers.'],
      ['outbox', 'A table written in the same DB transaction as your data; a relay publishes its rows to Kafka.']
    ]
  },
  visual: {
    title: 'A partition, an offset pointer and a failing record',
    caption: 'Each cell is a record in partition 0 of <code>orders</code>. The arrow is the consumer’s fetch position; the green flag is the <b>committed offset</b>. Press Play: watch a crash produce duplicates, a failing record block the partition and land in the DLT, a retry topic reorder records, and a slow listener trigger a rebalance.'
  },
  extras: [
    { id: 'kafka-messaging-outbox', title: 'Dual write vs transactional outbox', label: 'Outbox', caption: 'The service must save an order and publish <code>OrderPlaced</code>. Step through both designs and the crash in the middle: one loses the event, the other publishes it twice, and an idempotent consumer makes twice harmless.' }
  ],
  gotchas: [
    { trap: 'Assuming exactly-once delivery', code: `@KafkaListener(topics = "payments")
void on(PaymentCaptured e) { ledger.credit(e.accountId(), e.amount()); }   // runs twice after a crash`, why: 'The offset is committed <i>after</i> your method returns. A crash, a rebalance or a failed commit in between means the same records are delivered again.', fix: 'Make the listener idempotent: store the event id in a <code>processed_events</code> table with a unique constraint, in the same database transaction as the side effect, and skip duplicates.' },
    { trap: 'The default error handler retries without delay, then drops', why: '<code>DefaultErrorHandler</code> with no configuration retries 9 times back to back and then only <b>logs</b> the record and commits past it. A downstream outage burns all attempts in milliseconds and data is silently skipped.', fix: 'Configure a backoff (e.g. <code>ExponentialBackOffWithMaxRetries</code>) and a <code>DeadLetterPublishingRecoverer</code>. Mark exceptions that won’t succeed on retry (validation, bad data) with <code>addNotRetryableExceptions</code>.' },
    { trap: 'Blocking retries longer than <code>max.poll.interval.ms</code>', why: 'Blocking retries and their back-off run on the consumer thread. If the time between polls exceeds <code>max.poll.interval.ms</code> (5 min by default), the broker removes the consumer from the group, its partitions move to another instance, and the commit fails.', fix: 'Keep total blocking retry time well under the poll interval, or use non-blocking retries (<code>@RetryableTopic</code>) for long back-offs. Lower <code>max.poll.records</code> if each record is slow.' },
    { trap: 'Poison pill in the deserializer', code: `spring.kafka.consumer.value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer
# one malformed record → error inside poll(), before your listener runs`, lang: 'yaml', why: 'The failure happens while the Kafka client deserializes the batch, not in your listener, so normal per-record retry and recovery can’t see a record to skip, and the consumer can get stuck on that offset.', fix: 'Wrap the deserializer with <code>ErrorHandlingDeserializer</code> (<code>spring.deserializer.value.delegate.class</code>). The failure then reaches the error handler as a <code>DeserializationException</code>, which is not retryable by default and goes straight to the recoverer.' },
    { trap: '<code>@RetryableTopic</code> and ordering', why: 'Non-blocking retries move the failed record to a retry topic and carry on with the next records. Later events for the same key (e.g. <code>OrderCancelled</code>) can be processed before the retried <code>OrderPlaced</code>.', fix: 'Use non-blocking retries only when per-key order doesn’t matter, or make handlers tolerate out-of-order events (versions, state checks). Keep blocking retries for strictly ordered streams.' },
    { trap: 'Saving to the DB and sending to Kafka in one method', code: `@Transactional
public void place(Order o) {
  repo.save(o);
  kafka.send("orders", o.id(), new OrderPlaced(o));   // sent before the DB commit
}`, why: 'The send is not part of the database transaction. If the commit fails, consumers already saw an event for an order that doesn’t exist. If you send after the commit and the process dies, the event is lost.', fix: 'Write an outbox row in the same transaction and publish it from a relay (a poller or CDC with Debezium). Consumers stay idempotent because the relay can publish twice.' },
    { trap: 'Concurrency higher than the partition count', why: 'Each partition goes to exactly one consumer in the group. <code>concurrency = "12"</code> on a 6-partition topic leaves 6 threads idle, and the same is true across instances.', fix: 'Scale consumers up to the partition count. Increase partitions (they can’t be reduced, and keyed records move to different partitions) or speed up the listener if you need more throughput.' }
  ],
  scenarios: [
    { title: 'Customers charged twice after a rolling deploy',
      symptom: 'Around each deploy a handful of payments are captured twice. The producer sent each <code>PaymentRequested</code> once (checked in the topic).',
      diagnose: `# consumer logs during shutdown of pod A
Revoking previously assigned partitions [payments-3]
# pod B
Setting offset for partition payments-3 to the committed offset FetchPosition{offset=81723…}
Processing PaymentRequested id=… (seen before on pod A)`,
      cause: 'Pod A processed part of a poll batch, then was killed before the batch commit (AckMode.BATCH). Pod B started from the last committed offset and reprocessed those records. The handler called the payment provider without an idempotency key.',
      fix: 'Make the handler idempotent with a dedupe table and pass the event id as the provider’s idempotency key. Also enable graceful shutdown so containers stop and commit before the pod exits.',
      fixCode: `@KafkaListener(topics = "payments", groupId = "capture")
@Transactional
public void on(PaymentRequested e) {
  int inserted = jdbc.update("""
      INSERT INTO processed_events(event_id, consumer) VALUES (?, 'capture')
      ON CONFLICT DO NOTHING""", e.eventId());
  if (inserted == 0) return;                                  // duplicate: already handled
  provider.capture(e.paymentId(), e.amount(), /* idempotency key */ e.eventId().toString());
}` },
    { title: 'One partition’s lag grows for hours',
      symptom: 'Consumer lag on <code>orders-7</code> climbs steadily; all other partitions are at zero. CPU is low. The log repeats the same stack trace every few seconds.',
      diagnose: `kafka-consumer-groups.sh --describe --group billing
TOPIC   PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG
orders  7          55120           68904           13784

ERROR … Listener failed … offset 55120 … NullPointerException: customer is null`,
      cause: 'A record with a missing customer field threw on every attempt. The error handler had been configured with <code>FixedBackOff(5000, FixedBackOff.UNLIMITED_ATTEMPTS)</code>, so it retried forever and the partition never advanced.',
      fix: 'Bound the retries, send failures to a DLT, and classify data errors as not retryable. Alert on DLT traffic and on per-partition lag.',
      fixCode: `@Bean
DefaultErrorHandler errorHandler(KafkaTemplate<Object, Object> template) {
  var recoverer = new DeadLetterPublishingRecoverer(template);       // → orders.DLT, same partition
  var backOff = new ExponentialBackOffWithMaxRetries(4);
  backOff.setInitialInterval(500); backOff.setMultiplier(2); backOff.setMaxInterval(5_000);
  var h = new DefaultErrorHandler(recoverer, backOff);
  h.addNotRetryableExceptions(ValidationException.class, NullPointerException.class);
  return h;
}   // Boot 3.x picks up a single CommonErrorHandler bean for the auto-configured container factory` },
    { title: 'Rebalance storm every few minutes',
      symptom: 'Every 5–6 minutes all consumers in the group rebalance; throughput drops to zero for a while; <code>CommitFailedException</code> in the logs.',
      diagnose: `consumer poll timeout has expired. This means the time between subsequent calls to poll()
was longer than the configured max.poll.interval.ms … the poll loop is spending too much time processing messages.
# each record calls a slow external API (≈ 800 ms); max.poll.records = 500 (default)`,
      cause: '500 records × 0.8 s ≈ 400 s per poll batch, more than the 300 s <code>max.poll.interval.ms</code>. The consumer was evicted mid-batch, its partitions moved, and the uncommitted records were processed again by another instance.',
      fix: 'Make one batch fit comfortably within the interval: fewer records per poll, a higher interval, and timeouts on the external call.',
      fixCode: `spring:
  kafka:
    consumer:
      max-poll-records: 50
      properties:
        max.poll.interval.ms: 600000
    listener:
      ack-mode: record          # commit per record: smaller replay window after a rebalance`, lang: 'yaml' }
  ],
  puzzles: [
    { kind: 'predict', q: 'AckMode.BATCH (default). A poll returns offsets 100–109. The listener processes 100–106, then the pod is killed. Where does the next consumer start?', options: ['107', '100', '110', 'At the latest offset in the partition'], answer: 1, explain: 'With BATCH, the commit happens after the whole poll result is processed. Nothing for this batch was committed, so the last committed offset is still 100: records 100–106 are delivered again.' },
    { kind: 'predict', q: 'No error handler is configured (Spring Kafka 3.x defaults). A record throws on every attempt. What happens?', options: ['Retried forever', 'Delivered 10 times in total, then logged and skipped', 'Sent to orders.DLT automatically', 'The container stops'], answer: 1, explain: 'The default <code>DefaultErrorHandler</code> uses <code>FixedBackOff(0, 9)</code>: 1 delivery + 9 retries, then the default recoverer logs the record and the offset moves past it. A DLT only exists if you configure a <code>DeadLetterPublishingRecoverer</code>.' },
    { kind: 'concept', q: 'A topic has 4 partitions. Two app instances each run <code>@KafkaListener(concurrency = "3")</code> in the same group. How many consumer threads receive records?', options: ['6', '4', '3', '2'], answer: 1, explain: 'There are 6 consumers in the group but only 4 partitions, and each partition is assigned to exactly one consumer. Two consumers sit idle.' },
    { kind: 'predict', q: 'A <code>DeadLetterPublishingRecoverer</code> with default settings recovers a record from <code>orders</code>, partition 5. Where does it go?', options: ['orders-dlt, a random partition', 'orders.DLT, partition 5', 'orders-retry-0', 'Back to orders, partition 5'], answer: 1, explain: 'By default the recoverer publishes to <code>&lt;topic&gt;.DLT</code> and the <i>same partition number</i>, so the DLT needs at least as many partitions. (<code>@RetryableTopic</code> uses a different default suffix, <code>-dlt</code>.)' },
    { kind: 'concept', q: 'Which statement about Kafka transactions in Spring is right?', options: ['They make a DB write and a Kafka send atomic', 'They make consume → produce → commit offsets atomic within Kafka; DB work needs idempotency or an outbox', 'They are on by default', 'They remove the need for idempotent consumers in all cases'], answer: 1, explain: 'With a <code>transactional.id</code>, the produced records and the consumer offsets commit together, and <code>read_committed</code> consumers only see committed records. A database is a different resource; there is no two-phase commit with Kafka.' },
    { kind: 'predict', q: '<code>@RetryableTopic(attempts = "3")</code>. Records with the same key arrive: A (fails once), B, C. In what order are they successfully processed?', options: ['A, B, C', 'B, C, A', 'A is skipped forever', 'C, B, A'], answer: 1, explain: 'A is forwarded to a retry topic and the main consumer moves on immediately. B and C succeed first, and A succeeds later from the retry topic. Per-key ordering is not preserved.' },
    { kind: 'concept', q: 'With <code>AckMode.MANUAL</code>, the listener calls <code>ack.acknowledge()</code> for record 42 but not for 41 (both in partition 0). What is committed?', options: ['42 only; 41 stays pending', 'Offset 43, which also covers 41', 'Nothing until 41 is acknowledged', 'It throws: out-of-order ack'], answer: 1, explain: 'A committed offset is a single number per partition meaning “everything before this is done”. Committing after 42 implicitly covers 41. (Spring Kafka has an opt-in <code>asyncAcks</code> mode that defers commits until gaps are filled; by default there is no gap tracking.)' }
  ],
  interview: [
    { q: 'What does Spring do when it starts a @KafkaListener?', a: '<p>The listener annotation post-processor registers an endpoint; the <code>ConcurrentKafkaListenerContainerFactory</code> (auto-configured by Boot) builds a <code>ConcurrentMessageListenerContainer</code>, which starts <code>concurrency</code> child <code>KafkaMessageListenerContainer</code>s. Each one owns a <code>KafkaConsumer</code> on its own thread, runs the poll loop, invokes your method through a message listener adapter (conversion, argument resolution), and commits according to the ack mode.</p>', lvl: 'core' },
    { q: 'Explain the ack modes.', a: '<ul><li><b>BATCH</b> (default): commit after all records of a poll are processed.</li><li><b>RECORD</b>: commit after each record. Smaller replay window, more commit traffic.</li><li><b>TIME</b>/<b>COUNT</b>/<b>COUNT_TIME</b>: commit pending offsets after a time or count.</li><li><b>MANUAL</b>: your code calls <code>Acknowledgment.acknowledge()</code>; commits are queued and done by the consumer thread.</li><li><b>MANUAL_IMMEDIATE</b>: commit right away when acknowledged on the consumer thread.</li></ul><p>Spring sets <code>enable.auto.commit=false</code> so the container controls commits.</p>', lvl: 'core' },
    { q: 'How do you handle failures in a consumer?', a: '<p>Classify them. Transient (downstream down): retry with back-off. Permanent (bad data): don’t retry, send to a DLT. In Spring Kafka 3.x: a <code>DefaultErrorHandler</code> with a <code>BackOff</code> and a <code>DeadLetterPublishingRecoverer</code> for blocking retries, or <code>@RetryableTopic</code> for non-blocking retries via retry topics when ordering doesn’t matter. Monitor DLT volume and have a replay tool.</p>', lvl: 'core' },
    { q: 'Blocking vs non-blocking retries: trade-offs?', a: '<p><b>Blocking</b> (error handler seeks back and redelivers): preserves partition order, but the partition is stuck while retrying, and long back-offs risk exceeding <code>max.poll.interval.ms</code>. <b>Non-blocking</b> (<code>@RetryableTopic</code>): the record is forwarded to retry topics with a delay, so the main flow continues, but ordering is lost and you have more topics to manage.</p>', lvl: 'deep' },
    { q: 'How do you make a consumer idempotent?', a: '<p>Give every event a unique id (set by the producer, e.g. in the outbox). In the consumer’s DB transaction, insert the id into a dedupe table with a unique constraint (or <code>ON CONFLICT DO NOTHING</code>) before applying the change; if the row already exists, skip. Alternatively make the operation naturally idempotent (upsert to a target state, version checks). Pass the id as an idempotency key to external APIs.</p>', lvl: 'core' },
    { q: 'Explain the transactional outbox.', a: '<p>The service writes its business change and an <code>outbox</code> row (event id, aggregate id as key, payload) in one local DB transaction. A separate relay reads the outbox and publishes to Kafka: a poller (<code>SELECT … FOR UPDATE SKIP LOCKED</code>, then mark sent) or CDC (Debezium reading the WAL). Either the order and event both exist or neither does. The relay may publish twice after a crash, so consumers dedupe by event id.</p>', fu: 'Why not <code>@TransactionalEventListener(AFTER_COMMIT)</code> sending to Kafka? It runs after the commit in the same JVM: if the process dies right then, or the send fails, the event is lost.', lvl: 'deep' },
    { q: 'What triggers a rebalance and how do you reduce its impact?', a: '<p>A consumer joining or leaving, missing heartbeats (<code>session.timeout.ms</code>) or not polling within <code>max.poll.interval.ms</code>. Reduce impact with the cooperative sticky assignor (incremental rebalancing), static membership (<code>group.instance.id</code>) for rolling restarts, small enough poll batches, and graceful shutdown so consumers leave cleanly and commit first.</p>', lvl: 'deep' },
    { q: 'How are ordering guarantees achieved?', a: '<p>Kafka guarantees order only within a partition. Use the entity id as the record key, so all events of one order go to the same partition. On the producer, idempotence (on by default since Kafka clients 3.0) prevents reordering and duplicates from retries. On the consumer, one partition is processed by one thread, as long as you don’t hand records to a thread pool or use non-blocking retries.</p>', lvl: 'core' },
    { q: 'How do you test Kafka listeners?', a: '<p><code>@EmbeddedKafka</code> from <code>spring-kafka-test</code> for fast tests, or Testcontainers’ Kafka module with <code>@ServiceConnection</code> (Boot 3.1+) for realistic ones. Send a record with <code>KafkaTemplate</code>, then await the side effect with Awaitility. Test the failure path too: a poison record must end up in the DLT.</p>', lvl: 'core' },
    { q: 'What changed in Spring Kafka 3.x that matters?', a: '<ul><li><code>KafkaTemplate</code> send methods return <code>CompletableFuture</code>.</li><li>Micrometer Observation support for tracing (<code>observationEnabled</code> on the template and container).</li><li><code>DefaultErrorHandler</code> is the only common error handler (the older <code>SeekToCurrentErrorHandler</code> family was removed).</li><li>Baseline: Java 17 and Spring Framework 6, the versions in Boot 3.x.</li></ul>', lvl: 'deep' }
  ],
  code: [
    { title: 'Listener, error handling and DLT', lang: 'java', code: `@Configuration
class KafkaConfig {
  @Bean
  DefaultErrorHandler errorHandler(KafkaTemplate<Object, Object> template) {
    var recoverer = new DeadLetterPublishingRecoverer(template,
        (rec, ex) -> new TopicPartition(rec.topic() + ".DLT", rec.partition()));
    var backOff = new ExponentialBackOffWithMaxRetries(3);
    backOff.setInitialInterval(1_000); backOff.setMultiplier(2.0);
    var handler = new DefaultErrorHandler(recoverer, backOff);
    handler.addNotRetryableExceptions(InvalidOrderException.class);
    return handler;
  }
}

@Component
class BillingListener {
  @KafkaListener(id = "billing", topics = "orders", concurrency = "3")
  void on(OrderPlaced event, @Header(KafkaHeaders.RECEIVED_PARTITION) int partition) {
    billing.invoice(event);     // idempotent: dedupe on event.eventId()
  }
}` },
    { title: 'application.yml for a consumer', lang: 'yaml', code: `spring:
  kafka:
    bootstrap-servers: kafka:9092
    consumer:
      group-id: billing
      auto-offset-reset: earliest            # only used when the group has no committed offset
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.springframework.kafka.support.serializer.ErrorHandlingDeserializer
      max-poll-records: 100
      properties:
        spring.deserializer.value.delegate.class: org.springframework.kafka.support.serializer.JsonDeserializer
        spring.json.trusted.packages: com.shop.events
    listener:
      ack-mode: batch
    producer:
      acks: all                               # default since Kafka clients 3.0, with idempotence` },
    { title: 'Outbox relay with SKIP LOCKED', lang: 'java', code: `@Component
class OutboxRelay {
  private final JdbcClient jdbc; private final KafkaTemplate<String, String> kafka;
  OutboxRelay(JdbcClient jdbc, KafkaTemplate<String, String> kafka) { this.jdbc = jdbc; this.kafka = kafka; }

  @Scheduled(fixedDelay = 500)
  @Transactional
  public void publish() throws Exception {
    var rows = jdbc.sql("""
        SELECT id, topic, msg_key, payload FROM outbox
        WHERE sent_at IS NULL ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED""")
      .query(OutboxRow.class).list();
    for (var r : rows) {
      kafka.send(r.topic(), r.msgKey(), r.payload()).get(5, TimeUnit.SECONDS);   // wait for the broker ack
      jdbc.sql("UPDATE outbox SET sent_at = now() WHERE id = ?").param(r.id()).update();
    }
  }   // crash after send, before commit → row is sent again: consumers dedupe by event id
}`, note: 'Several instances can run the relay: <code>SKIP LOCKED</code> keeps them from taking the same rows. CDC (Debezium) avoids polling altogether.' },
    { title: 'Non-blocking retries', lang: 'java', code: `@RetryableTopic(attempts = "4",
    backoff = @Backoff(delay = 2_000, multiplier = 2.0),
    exclude = InvalidOrderException.class)          // straight to the DLT
@KafkaListener(topics = "notifications")
void send(NotificationRequested n) { mailer.send(n); }

@DltHandler
void dead(NotificationRequested n, @Header(KafkaHeaders.DLT_EXCEPTION_MESSAGE) String error) {
  alerts.raise("notification failed", n.id(), error);
}` }
  ]
});

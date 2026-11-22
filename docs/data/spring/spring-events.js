IA.register({
  track: 'spring',
  slug: 'spring-events',
  title: 'Application events',
  tagline: '<code>publishEvent()</code> decouples <i>who</i> reacts from <i>who</i> acts, but by default it does <b>not</b> decouple <i>when</i> or <i>where</i>: listeners run synchronously, on the same thread, inside the same transaction. <code>@TransactionalEventListener</code> moves them to a transaction phase, <code>@Async</code> moves them to another thread, and neither makes them durable.',
  tldr: {
    problem: 'Emails confirming orders that were rolled back, listeners that silently never fire, audit rows written “after commit” that never commit, and events lost when a pod restarts.',
    model: 'The multicaster finds every listener whose parameter type matches, sorts them by <code>@Order</code>, and calls them one by one before <code>publishEvent()</code> returns. A transactional listener instead registers a <b>synchronization</b> on the current transaction and runs at <code>BEFORE_COMMIT</code>, <code>AFTER_COMMIT</code> (default), <code>AFTER_ROLLBACK</code> or <code>AFTER_COMPLETION</code>. Events live in memory only.',
    hook: '“Is a Spring event asynchronous?” No, not unless you make it so. And a synchronous listener’s exception rolls back the publisher’s transaction.',
    facts: [
      { v: '4.2', l: 'Spring version that added <code>@EventListener</code>, <code>@TransactionalEventListener</code> and arbitrary objects (not just <code>ApplicationEvent</code>) as events' },
      { v: 'AFTER_COMMIT', l: 'default phase of <code>@TransactionalEventListener</code>; with no transaction the listener is skipped unless <code>fallbackExecution = true</code>' },
      { v: '6.1', l: 'Spring version that rejects <code>@Transactional</code> on a transactional event listener unless it is <code>REQUIRES_NEW</code> or <code>NOT_SUPPORTED</code>' }
    ]
  },
  intro: {
    what: 'When an order is placed, several things should happen: send an email, reserve stock, update analytics. Instead of <code>OrderService</code> calling all of them, it <b>publishes an event</b> (“an order was placed”), and each interested part of the app <b>listens</b> for it. The publisher doesn’t know who is listening. That keeps modules independent. In Spring, the ApplicationContext delivers these events.',
    analogy: { icon: '📣', title: 'An announcement over the office speaker', text: 'Someone announces “the 3 pm delivery has arrived”. Whoever cares (the warehouse, accounting) reacts, and the announcer doesn’t need a list of them. But by default the announcer waits at the microphone until every listener has finished reacting. And if someone faints during the announcement, the whole delivery is sent back.' },
    steps: [
      { t: 'Define an event', d: 'Any object works. A record is ideal: immutable and small.', code: 'public record OrderPlaced(long orderId, String email) {}' },
      { t: 'Publish it', d: 'Inject <code>ApplicationEventPublisher</code> and call <code>publishEvent</code>.', code: 'events.publishEvent(new OrderPlaced(order.id(), order.email()));' },
      { t: 'Listen for it', d: 'Annotate a method on any bean. The parameter type decides which events it receives.', code: '@EventListener\nvoid on(OrderPlaced e) { mailer.sendConfirmation(e.email()); }' },
      { t: 'Choose when it runs', d: 'Plain listeners run immediately. <code>@TransactionalEventListener</code> waits until the transaction commits. <code>@Async</code> runs it on another thread.' }
    ],
    terms: [
      ['ApplicationEventPublisher', 'The interface used to publish; the ApplicationContext implements it.'],
      ['ApplicationEventMulticaster', 'The component that finds matching listeners and invokes them, synchronously unless given an executor.'],
      ['@TransactionalEventListener', 'A listener bound to a phase of the publisher’s transaction.'],
      ['transaction synchronization', 'A callback registered on the current transaction, fired around commit or rollback.'],
      ['transactional outbox', 'Writing the event to a table in the same transaction, and delivering it later, so it survives crashes.']
    ]
  },
  visual: {
    title: 'Where and when does the listener run?',
    caption: 'Each block is something happening on a thread; the outline marks the open transaction. Pick a scenario and press Play or Step. Compare <b>@EventListener</b> with <b>listener throws</b>, then try <b>AFTER_COMMIT</b>, <b>rollback</b>, <b>@Async</b> and <b>no transaction</b>.'
  },
  gotchas: [
    { trap: 'Synchronous listeners share the publisher’s fate', code: `@Transactional
public void placeOrder(Cmd c) {
  repo.save(order);
  events.publishEvent(new OrderPlaced(order.id()));   // listeners run HERE
}
@EventListener void email(OrderPlaced e) { mailer.send(…); }   // sent before commit`, why: 'Plain listeners run inside <code>publishEvent()</code>, on the same thread and in the same transaction. Their latency adds to the request, their exceptions propagate to the publisher (and roll it back), and their side effects happen before the commit.', fix: 'Use <code>@TransactionalEventListener</code> for side effects that must only happen after a commit. Keep plain listeners for work that should be part of the transaction.' },
    { trap: 'AFTER_COMMIT listener writes are not committed', code: `@TransactionalEventListener
@Transactional                 // Spring 6.1+: rejected at startup (must be REQUIRES_NEW)
void on(OrderPlaced e) { auditRepo.save(…); }`, why: 'At <code>AFTER_COMMIT</code> the original transaction has already committed, but its resources may still be bound to the thread. Data access there joins a transaction that will never commit again.', fix: 'Annotate the listener <code>@Transactional(propagation = Propagation.REQUIRES_NEW)</code>, or make it <code>@Async</code> so it runs in its own transaction on another thread.' },
    { trap: '@TransactionalEventListener without a transaction does nothing', why: 'If the publisher isn’t transactional, there is no transaction to synchronize with, and the event is discarded for that listener (a debug log line, no exception). This often happens after someone removes <code>@Transactional</code> or calls the publisher from a scheduled job.', fix: 'Set <code>fallbackExecution = true</code> if running immediately is acceptable, or make sure the publishing path is transactional. Cover it with a test.' },
    { trap: '@Async listeners lose thread-bound context', why: 'Transaction, <code>SecurityContextHolder</code>, MDC, request scope and locale are all ThreadLocal-based. An async listener on an executor thread sees none of them, may read the database before the publisher commits, and its exceptions only reach the <code>AsyncUncaughtExceptionHandler</code>.', fix: 'Put everything the listener needs into the event. Use <code>@Async</code> together with <code>@TransactionalEventListener</code> so it runs after commit. Propagate MDC/trace context with a <code>TaskDecorator</code> (Boot 3.2+ wires context propagation for observability).' },
    { trap: 'Events are in memory: a crash loses them', why: 'Between the commit and an <code>AFTER_COMMIT</code> (or async) listener finishing, the event exists only in the JVM. A deploy, OOM kill or node failure loses it, and the order stays “paid” with no fulfilment request.', fix: 'For events that must not be lost, use a transactional outbox (write the event row in the same transaction), or Spring Modulith’s event publication registry, which persists publications and can resubmit incomplete ones.' },
    { trap: 'Listener order is only defined with @Order', why: 'Without <code>@Order</code>/<code>Ordered</code>, listeners of the same event run in an unspecified order. Code that “happened to work” can break when a new listener or a refactor changes bean registration order.', fix: 'Don’t rely on order between independent listeners. If one really must run first, give both an explicit <code>@Order</code>, or have the first publish a follow-up event.' }
  ],
  scenarios: [
    { title: 'Customers get confirmation emails for orders that don’t exist',
      symptom: 'Support sees “order confirmed” emails with order numbers missing from the database. It correlates with stock-reservation failures.',
      diagnose: `// both listeners are plain @EventListener, published inside @Transactional placeOrder()
@EventListener @Order(1) void sendConfirmation(OrderPlaced e) { … }
@EventListener @Order(2) void reserveStock(OrderPlaced e) { … throw new OutOfStockException(); }`,
      cause: 'The email listener ran synchronously inside the transaction. When the stock listener threw, the exception rolled back the order, but the email had already been sent.',
      fix: 'Keep stock reservation in the transaction (it should be able to veto the order). Move the email to <code>AFTER_COMMIT</code>, off the request thread.',
      fixCode: `@EventListener                       // part of the transaction: may veto
void reserveStock(OrderPlaced e) { stock.reserve(e.orderId()); }

@Async
@TransactionalEventListener          // AFTER_COMMIT by default
void sendConfirmation(OrderPlaced e) { mailer.sendConfirmation(e.email(), e.orderId()); }` },
    { title: 'A few paid orders are never shipped, always around deploys',
      symptom: 'Every week a handful of orders are paid but have no shipment request. They all cluster within seconds of a rolling deploy.',
      diagnose: `-- orders paid without a shipment request
SELECT o.id, o.paid_at FROM orders o
LEFT JOIN shipment_requests s ON s.order_id = o.id
WHERE o.status = 'PAID' AND s.id IS NULL;
-- paid_at values line up with pod termination times`,
      cause: 'Shipping was triggered by an <code>@Async @TransactionalEventListener</code>. When a pod was terminated after commit but before the async task ran, the in-memory event was lost.',
      fix: 'Make the hand-off durable: record the event in the same transaction and deliver it with retries. Spring Modulith’s event publication registry does this for listeners; a hand-written outbox table plus a poller (or CDC) is the classic alternative.',
      fixCode: `// Spring Modulith (spring-modulith-starter-jpa): publications are stored in the same tx
@ApplicationModuleListener            // = @Async + @Transactional(REQUIRES_NEW) + @TransactionalEventListener
void on(OrderPaid e) { shipping.request(e.orderId()); }

# resubmit incomplete publications after restart
spring.modulith.events.republish-outstanding-events-on-restart: true` },
    { title: 'Audit entries written by an AFTER_COMMIT listener never appear',
      symptom: 'An audit listener runs (its log line is there) but the <code>audit_log</code> rows are missing. No exception anywhere.',
      diagnose: `@TransactionalEventListener              // AFTER_COMMIT
void audit(OrderPlaced e) { auditRepo.save(new AuditEntry(e)); }   // joins the committed tx`,
      cause: 'The listener ran after the commit, while the old transaction’s resources were still bound. The save joined that transaction, which never committed again.',
      fix: 'Give the listener its own transaction. On Spring 6.1+ a plain <code>@Transactional</code> here is rejected at startup, which is exactly the hint you want.',
      fixCode: `@TransactionalEventListener
@Transactional(propagation = Propagation.REQUIRES_NEW)
void audit(OrderPlaced e) { auditRepo.save(new AuditEntry(e)); }` }
  ],
  puzzles: [
    { kind: 'predict', q: 'Inside a <code>@Transactional</code> method, an event is published. A plain <code>@EventListener</code> throws a <code>RuntimeException</code>. What happens to the publisher’s transaction?', options: ['It commits; listener errors are isolated', 'It rolls back: the exception propagates out of publishEvent()', 'Only the listener’s writes roll back', 'The event is retried'], answer: 1, explain: 'Synchronous listeners are called inside <code>publishEvent()</code>. The exception travels up through the publisher, the transactional proxy sees a runtime exception and rolls back everything.' },
    { kind: 'predict', q: 'A <code>@TransactionalEventListener</code> (default phase). The publishing transaction rolls back. Is the listener called?', options: ['Yes, after the rollback', 'No', 'Yes, before the rollback', 'Only if it is @Async'], answer: 1, explain: 'The default phase is <code>AFTER_COMMIT</code>, which only fires on a successful commit. Use <code>AFTER_ROLLBACK</code> or <code>AFTER_COMPLETION</code> to react to rollbacks.' },
    { kind: 'predict', q: 'The publisher has no transaction. What does this listener do?', code: `@TransactionalEventListener
void on(OrderPlaced e) { … }`, options: ['Runs immediately', 'Runs after the next transaction commits', 'Nothing: the event is discarded for this listener', 'Throws IllegalStateException'], answer: 2, explain: 'With no active transaction there is nothing to synchronize with, so the listener is skipped. <code>fallbackExecution = true</code> makes it run immediately instead.' },
    { kind: 'order', q: 'In what order do these listeners run for one event?', code: `@EventListener @Order(2) void a(OrderPlaced e) { … }
@EventListener @Order(1) void b(OrderPlaced e) { … }
@EventListener          void c(OrderPlaced e) { … }`, options: ['a, b, c', 'b, a, c', 'c, b, a', 'Random'], answer: 1, explain: 'Listeners are sorted by order: lower first. Unordered listeners count as lowest precedence, so <code>c</code> runs last. (Ordering between several unordered listeners is unspecified.)' },
    { kind: 'concept', q: 'When does <code>publishEvent()</code> return, with only plain synchronous listeners?', options: ['Immediately; listeners are queued', 'After every matching listener has finished', 'After the transaction commits', 'After the first listener finishes'], answer: 1, explain: 'The default <code>SimpleApplicationEventMulticaster</code> has no executor, so it invokes each listener in turn on the calling thread and returns afterwards.' },
    { kind: 'predict', q: 'With <code>@EnableAsync</code>, this listener throws. What does the publisher see?', code: `@Async @EventListener
void index(OrderPlaced e) { throw new IllegalStateException("search down"); }`, options: ['The exception, from publishEvent()', 'Nothing: it goes to the AsyncUncaughtExceptionHandler', 'A rollback of its transaction', 'The event is redelivered'], answer: 1, explain: 'The listener runs on an executor thread after <code>publishEvent()</code> has returned. A void <code>@Async</code> method’s exception is passed to the <code>AsyncUncaughtExceptionHandler</code> (by default it is logged).' },
    { kind: 'concept', q: 'An <code>@EventListener</code> method returns <code>new StockReserved(id)</code> instead of <code>void</code>. What happens to the return value?', options: ['It is ignored', 'It is published as a new event', 'It is returned from publishEvent()', 'Startup fails: listeners must be void'], answer: 1, explain: 'A non-null return value from an <code>@EventListener</code> is published as a new event (a collection or array publishes each element). Handy for chaining, but easy to miss when reading the code.' }
  ],
  interview: [
    { q: 'Are Spring application events synchronous or asynchronous?', a: '<p>Synchronous by default: <code>publishEvent()</code> calls each matching listener on the current thread and returns when all are done, inside whatever transaction is active. You get async behaviour per listener with <code>@Async</code> (requires <code>@EnableAsync</code>), or globally by giving the multicaster an executor, which also affects framework listeners and is rarely what you want.</p>', lvl: 'core' },
    { q: 'Explain @TransactionalEventListener phases.', a: '<ul><li><code>BEFORE_COMMIT</code>: inside the transaction, just before commit. Can still fail the commit.</li><li><code>AFTER_COMMIT</code> (default): only after a successful commit.</li><li><code>AFTER_ROLLBACK</code>: only after a rollback.</li><li><code>AFTER_COMPLETION</code>: after either.</li></ul><p>It works by registering a <code>TransactionSynchronization</code> on the current transaction when the event is published. Without a transaction, the listener is skipped unless <code>fallbackExecution = true</code>.</p>', lvl: 'core' },
    { q: 'What happens if an AFTER_COMMIT listener writes to the database?', a: '<p>The original transaction has already committed, but its resources may still be bound to the thread, so the write joins a transaction that won’t commit again and is lost. Use <code>REQUIRES_NEW</code> on the listener or run it <code>@Async</code>. Since Spring 6.1, a transactional event listener annotated with <code>@Transactional</code> must use <code>REQUIRES_NEW</code> or <code>NOT_SUPPORTED</code>, otherwise startup fails.</p>', lvl: 'deep' },
    { q: 'How do you guarantee an event is processed even if the app crashes?', a: '<p>Spring events alone can’t: they are in-memory. Use a <b>transactional outbox</b>: in the same database transaction as the business change, insert the event into an outbox table; a separate process (poller or CDC such as Debezium) publishes it and marks it done, with retries and idempotent consumers. Spring Modulith’s event publication registry implements this pattern for in-process listeners.</p>', lvl: 'deep' },
    { q: 'How are listeners matched to events?', a: '<p>By the listener method’s parameter type (or <code>@EventListener(classes = …)</code>), including generics. For generic events like <code>EntityCreated&lt;Order&gt;</code> erasure would hide the type argument, so the event implements <code>ResolvableTypeProvider</code>. A SpEL <code>condition</code> attribute can filter further: <code>@EventListener(condition = "#e.amount &gt; 1000")</code>.</p>', lvl: 'core' },
    { q: 'When would you use events instead of a direct call?', a: '<p>When the publisher shouldn’t depend on the reactions: notifications, analytics, cache eviction, cross-module communication in a modular monolith. Don’t use them to hide a required step of the business transaction behind indirection: if the order is invalid without the stock reservation, a direct call is clearer. Events also help break circular dependencies between beans.</p>', lvl: 'core' },
    { q: 'Which Spring Boot lifecycle events exist, and which can’t be caught with @EventListener?', a: '<p>In order: <code>ApplicationStartingEvent</code>, <code>ApplicationEnvironmentPreparedEvent</code>, <code>ApplicationContextInitializedEvent</code>, <code>ApplicationPreparedEvent</code>, <code>ApplicationStartedEvent</code> (after refresh), availability events, <code>ApplicationReadyEvent</code>; and <code>ApplicationFailedEvent</code> on failure. During the refresh itself you also get <code>WebServerInitializedEvent</code> and <code>ContextRefreshedEvent</code>. The ones before the context is refreshed fire before any bean exists, so listeners for them must be registered with <code>SpringApplication.addListeners()</code> or in <code>META-INF/spring.factories</code>.</p>', lvl: 'deep' },
    { q: 'How do you combine @Async with transactional events correctly?', a: '<p>Annotate the listener with both <code>@Async</code> and <code>@TransactionalEventListener</code>. The synchronization fires after commit on the publishing thread, which then hands the call to the executor. The listener then sees committed data and runs in its own transaction if it is also <code>@Transactional(REQUIRES_NEW)</code>. Spring Modulith’s <code>@ApplicationModuleListener</code> bundles exactly this.</p>', lvl: 'core' },
    { q: 'How do you test event publishing?', a: '<p>Slice or full tests can use <code>@RecordApplicationEvents</code> with an injected <code>ApplicationEvents</code> to assert which events were published. For transactional listeners, remember the test’s own transaction rolls back by default, so <code>AFTER_COMMIT</code> listeners won’t fire: commit with <code>TestTransaction.end()</code> or run the test without a test-managed transaction.</p>', lvl: 'deep' },
    { q: 'Do events cross JVMs?', a: '<p>No. Application events are in-process. Spring Cloud Bus or a message broker (Kafka, RabbitMQ) carries events between services; inside a service, events plus an outbox are a common way to feed that broker reliably.</p>', lvl: 'core' }
  ],
  code: [
    { title: 'Publish once, react in the right phase', lang: 'java', code: `public record OrderPlaced(long orderId, String email, BigDecimal total) {}

@Service
class OrderService {
  private final OrderRepository repo;
  private final ApplicationEventPublisher events;
  OrderService(OrderRepository repo, ApplicationEventPublisher events) { this.repo = repo; this.events = events; }

  @Transactional
  public long place(Cmd c) {
    Order o = repo.save(Order.from(c));
    events.publishEvent(new OrderPlaced(o.id(), c.email(), o.total()));
    return o.id();
  }
}

@Component
class OrderReactions {
  @EventListener                                            // in the tx: may veto
  void reserve(OrderPlaced e) { stock.reserve(e.orderId()); }

  @Async @TransactionalEventListener                        // after commit, off-thread
  void confirm(OrderPlaced e) { mailer.confirm(e.email(), e.orderId()); }

  @TransactionalEventListener(phase = TransactionPhase.AFTER_ROLLBACK)
  void released(OrderPlaced e) { log.info("order {} rolled back", e.orderId()); }

  @EventListener(condition = "#e.total > 10000")            // SpEL filter
  void flagLarge(OrderPlaced e) { fraud.review(e.orderId()); }
}` },
    { title: 'Assert events in a test', lang: 'java', code: `@SpringBootTest
@RecordApplicationEvents
class OrderServiceTest {
  @Autowired OrderService orders;
  @Autowired ApplicationEvents events;

  @Test void publishesOrderPlaced() {
    long id = orders.place(sampleCmd());
    assertThat(events.stream(OrderPlaced.class))
        .singleElement()
        .extracting(OrderPlaced::orderId).isEqualTo(id);
  }
}` },
    { title: 'A minimal transactional outbox', lang: 'java', code: `@Entity @Table(name = "outbox")
class OutboxEvent { @Id UUID id; String type; String payload; Instant createdAt; Instant sentAt; }

@Component
class OutboxWriter {
  private final OutboxRepository outbox; private final ObjectMapper json;
  @EventListener                                   // synchronous: same tx as the order
  void on(OrderPlaced e) throws JsonProcessingException {
    outbox.save(new OutboxEvent(UUID.randomUUID(), "OrderPlaced", json.writeValueAsString(e), Instant.now(), null));
  }
}

@Component
class OutboxRelay {
  @Scheduled(fixedDelay = 1000)                    // needs @EnableScheduling
  @Transactional
  void relay() {
    outbox.findTop100BySentAtIsNullOrderByCreatedAt().forEach(ev -> {
      kafka.send("orders", ev.id.toString(), ev.payload).join();   // consumers must be idempotent
      ev.sentAt = Instant.now();
    });
  }
}`, note: 'With several instances, guard the relay with <code>SELECT … FOR UPDATE SKIP LOCKED</code> or ShedLock.' }
  ]
});

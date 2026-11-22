IA.register({
  track: 'spring',
  slug: 'jpa-n-plus-1',
  title: 'JPA fetching & N+1',
  tagline: 'One innocent <code>findAll()</code> plus a loop that touches an association sends <b>1 + N queries</b> to Postgres. Choose per use case how associations are fetched (<b>join fetch</b>, <b>entity graph</b>, <b>batch fetching</b> or a <b>DTO projection</b>), and decide whether lazy loading may happen outside the transaction at all (<b>OSIV</b>).',
  tldr: {
    problem: 'A page that ran 3 queries in development runs 801 in production, <code>LazyInitializationException</code> in the JSON layer, and a pool drained by connections held during view rendering.',
    model: 'Entities live in a <b>persistence context</b> (first-level cache) for the length of the session. An association that isn’t loaded is a <b>proxy</b> or an uninitialised collection; touching it runs a SELECT, if the session is still open. Mapping-level <code>EAGER</code> doesn’t mean “joined”: for JPQL queries it means “loaded right after, one query per row”.',
    hook: '“How do you find N+1s?” Count statements per request: Hibernate statistics, a datasource proxy in tests, or <code>pg_stat_statements</code> showing a by-id SELECT with calls in the millions.',
    facts: [
      { v: 'EAGER', l: 'the JPA default for <code>@ManyToOne</code> and <code>@OneToOne</code>. <code>@OneToMany</code> and <code>@ManyToMany</code> default to LAZY' },
      { v: 'true', l: '<code>spring.jpa.open-in-view</code> default in Boot; it logs a warning at startup unless you set it explicitly' },
      { v: 'Hibernate 6', l: 'de-duplicates root entities of a join-fetch query automatically. In Hibernate 5 you needed <code>select distinct</code>' }
    ]
  },
  intro: {
    what: 'JPA maps tables to Java classes: an <code>Order</code> has a <code>Customer</code> and a list of <code>OrderLine</code>s. Hibernate doesn’t load everything at once. Related objects are fetched <b>lazily</b>, when you first touch them. That saves work, but if you loop over 100 orders and touch each one’s customer, Hibernate runs 1 query for the orders and up to 100 more for the customers. That is the <b>N+1 problem</b>.',
    analogy: { icon: '📚', title: 'A librarian and a reading list', text: 'You ask for 100 book records (1 trip). Then, for each book, you walk back to the desk to ask who the author is (100 trips). Asking “give me the books <i>with</i> their authors” (a join) or “here are all 40 author ids, give me those authors at once” (batching) takes one or two trips.' },
    steps: [
      { t: 'Load a list', d: 'One query, one round trip.', code: 'List<Order> orders = orderRepo.findAll();\n-- SELECT … FROM orders' },
      { t: 'Touch an association in a loop', d: '<code>getCustomer()</code> returns a proxy; calling <code>getName()</code> on it fires a SELECT by id.', code: 'for (Order o : orders) {\n  print(o.getCustomer().getName());   // SELECT … FROM customer WHERE id = ?\n}' },
      { t: 'Count the queries', d: 'Turn on SQL logging in development, and you’ll see one customer query per distinct customer.' },
      { t: 'Fetch what this use case needs', d: 'Ask for orders <i>with</i> customers in one query.', code: '@Query("select o from Order o join fetch o.customer")\nList<Order> findAllWithCustomer();' }
    ],
    terms: [
      ['lazy / eager', 'Lazy loads on first access; eager loads together with (or right after) the owner.'],
      ['proxy', 'A generated subclass standing in for an unloaded entity; it queries when you touch it.'],
      ['persistence context', 'The set of entities the current session has loaded; each row is loaded at most once.'],
      ['fetch join', '<code>join fetch</code> in JPQL: load the association in the same SQL query.'],
      ['entity graph', 'A declarative list of associations to fetch, for example <code>@EntityGraph(attributePaths = "customer")</code>.'],
      ['OSIV', 'Open Session In View: keeps the persistence context open for the whole web request.']
    ]
  },
  visual: {
    title: 'Watch the N+1 fan-out, then fix it four ways',
    caption: 'Ten orders reference six distinct customers. Pick a fetch strategy and press Play. The middle column is the persistence context: a customer is queried only if it isn’t there yet. The right column is what Postgres receives, with a running count of round trips.'
  },
  extras: [
    { id: 'jpa-n-plus-1-osiv', title: 'OSIV on vs off: who holds the connection, and where lazy loading fails', label: 'OSIV', caption: 'Follow one request through the controller, the transactional service and Jackson. Toggle <code>spring.jpa.open-in-view</code> and watch the persistence context, the connection and the lazy load in serialization.' }
  ],
  gotchas: [
    { trap: 'EAGER doesn’t prevent N+1; it guarantees it',
      code: `@ManyToOne                      // default fetch = EAGER\nprivate Customer customer;\n\norderRepo.findAll();            // SELECT orders, then one SELECT per distinct customer`,
      why: 'A JPQL or Criteria query (which is what Spring Data runs) fetches only what the query says. Hibernate then has to honour EAGER, so it runs extra selects right away, for every use case, even ones that never touch the customer.',
      fix: 'Map every <code>@ManyToOne</code>/<code>@OneToOne</code> as <code>fetch = LAZY</code>, and fetch per query with <code>join fetch</code> or an entity graph.' },
    { trap: 'Join fetch + paging on a collection pages in memory',
      code: `@Query("select o from Order o join fetch o.lines")\nPage<Order> findAll(Pageable p);\n// WARN HHH90003004: firstResult/maxResults specified with collection fetch; applying in memory`,
      why: 'Joining a collection multiplies rows, so SQL <code>LIMIT</code> can’t express “20 orders”. Hibernate loads <b>all</b> matching rows and pages in the JVM.',
      fix: 'Page the ids first, then fetch those orders with their lines (<code>where o.id in :ids</code>), or use batch fetching for the collection. Set <code>hibernate.query.fail_on_pagination_over_collection_fetch=true</code> to turn the warning into an error.' },
    { trap: 'Two bag collections in one fetch',
      why: 'Fetching two <code>List</code> collections together throws <code>MultipleBagFetchException</code>. With <code>Set</code>s it works, but produces a Cartesian product: 50 lines × 20 payments = 1,000 rows for one order.',
      fix: 'Fetch one collection per query (Hibernate merges them in the persistence context), or use <code>@BatchSize</code>/<code>default_batch_fetch_size</code> for the second.' },
    { trap: 'Returning entities from controllers',
      why: 'Jackson walks every getter. With OSIV it lazily loads whole object graphs during serialization (N+1 in the JSON layer); without it, it throws <code>LazyInitializationException</code>, or fails on the Hibernate proxy’s internal fields.',
      fix: 'Map to DTOs (records) inside the transaction, or query DTO projections directly. The API shape then stops depending on the fetch plan.' },
    { trap: 'Leaving OSIV on by default',
      why: 'With OSIV, the persistence context lives until the response is written. With Spring’s Hibernate defaults, the connection acquired by the first query is then held until the request ends, including slow serialization or remote calls in the controller, and lazy loads hide N+1s outside any transaction.',
      fix: 'Set <code>spring.jpa.open-in-view=false</code> on new services, fix the resulting <code>LazyInitializationException</code>s by fetching what each use case needs, and treat each one as a found N+1.' },
    { trap: 'Batch fetching as the only fix',
      why: '<code>hibernate.default_batch_fetch_size</code> turns N+1 into 1 + N/size queries by loading pending proxies with one IN-list query. It is a good safety net, but it still makes extra round trips and loads full entities.',
      fix: 'Set it globally (16–64 is common) as a guard, and still use join fetch, entity graphs or projections on hot paths.' }
  ],
  scenarios: [
    { title: 'Order history endpoint: p95 from 40 ms to 2 s after “adding the customer name”',
      symptom: 'A one-line change added <code>customerName</code> to the order-list DTO. Latency went up 50× for large accounts; database CPU went up; no slow query in the log.',
      diagnose: `SELECT calls, mean_exec_time, query
FROM pg_stat_statements ORDER BY calls DESC LIMIT 3;
--   calls   | mean_exec_time | query
-- 48210331  |          0.031 | select c1_0.id,c1_0.name,… from customer c1_0 where c1_0.id=$1
--    96012  |          4.900 | select o1_0.id,… from orders o1_0 where o1_0.account_id=$1 …`,
      diagnoseLang: 'sql',
      cause: 'Each mapping call <code>order.getCustomer().getName()</code> initialised a proxy. 500 orders with ~400 distinct customers → ~401 round trips per request. Each query was fast; the round trips were not.',
      fix: 'Fetch the association in the list query, and add a statement-count assertion to the endpoint’s test.',
      fixCode: `@EntityGraph(attributePaths = "customer")
Page<Order> findByAccountId(long accountId, Pageable page);    // one query with a join

// or a projection: no entities, no proxies
@Query("""
  select new com.acme.orders.OrderRow(o.id, o.total, o.createdAt, c.name)
  from Order o join o.customer c where o.accountId = :accountId""")
Page<OrderRow> rows(long accountId, Pageable page);` },
    { title: 'LazyInitializationException after turning off OSIV',
      symptom: 'Setting <code>spring.jpa.open-in-view=false</code> made <code>GET /orders/{id}</code> fail with <code>LazyInitializationException</code> (“… no session”) in Jackson.',
      diagnose: `org.hibernate.LazyInitializationException: … could not initialize proxy … - no Session
  at org.hibernate.collection.spi.AbstractPersistentCollection.throwLazyInitializationException(…)
  at com.fasterxml.jackson.databind.ser.std.CollectionSerializer.serialize(…)`,
      diagnoseLang: 'text',
      cause: 'The service returned the entity; <code>lines</code> was never initialised inside the transaction. With OSIV on, Jackson silently ran the query outside any transaction; with OSIV off, the session is closed.',
      fix: 'Fetch what the response needs in the service and return a DTO. Don’t “fix” it with <code>Hibernate.initialize</code> scattered through controllers, or with <code>enable_lazy_load_no_trans</code>, which opens a new session and connection for each lazy load.',
      fixCode: `@Transactional(readOnly = true)
public OrderDto get(long id) {
  Order o = orders.findWithLinesById(id).orElseThrow();   // @EntityGraph(attributePaths = "lines")
  return OrderDto.from(o);                                 // mapped while the session is open
}` },
    { title: 'Admin export OOMs after adding payments to the fetch',
      symptom: 'An export that fetched orders with lines started using 6 GB of heap once <code>join fetch o.payments</code> was added.',
      diagnose: `select o from Order o join fetch o.lines join fetch o.payments where o.createdAt > :since
-- SQL returns lines × payments rows per order: 40 × 12 = 480 rows for one order`,
      diagnoseLang: 'sql',
      cause: 'Two collection fetch joins produce a Cartesian product. Hibernate has to read and de-duplicate every row in memory.',
      fix: 'Fetch collections in separate queries over the same ids, and stream or page by id range.',
      fixCode: `List<Order> os = em.createQuery("select o from Order o join fetch o.lines where o.id in :ids", Order.class)
    .setParameter("ids", ids).getResultList();
em.createQuery("select o from Order o join fetch o.payments where o.id in :ids", Order.class)
    .setParameter("ids", ids).getResultList();   // same entities, second collection filled` }
  ],
  puzzles: [
    { kind: 'predict', q: '100 orders reference 30 distinct customers. <code>customer</code> is <code>@ManyToOne(fetch = LAZY)</code>. How many SQL statements run?', code: `@Transactional(readOnly = true)\npublic List<String> names() {\n  return orderRepo.findAll().stream()\n      .map(o -> o.getCustomer().getName())\n      .toList();\n}`, options: ['1', '31', '101', '2'], answer: 1, explain: 'One for the orders, then one per <b>distinct</b> customer: once a customer is in the persistence context, other proxies for the same id resolve to it without a query. 1 + 30 = <b>31</b>.' },
    { kind: 'predict', q: 'Same data, but the mapping is the default <code>@ManyToOne</code> (EAGER), and the code never touches the customer. How many statements?', code: `orderRepo.findAll().forEach(o -> log.info("order {}", o.getId()));`, options: ['1', '2', '31', '101'], answer: 2, explain: 'Spring Data’s <code>findAll</code> runs a JPQL/Criteria query, which selects only orders. Hibernate must then satisfy EAGER with secondary selects, one per distinct customer: <b>31</b>, even though nobody needed them.' },
    { kind: 'predict', q: '<code>hibernate.default_batch_fetch_size = 16</code>, LAZY mapping, 100 orders with 30 distinct customers. How many statements does the loop cause in total?', options: ['31', '3', '2', '1'], answer: 1, explain: 'When the first proxy is touched, Hibernate loads up to 16 pending customer proxies at once with one IN-list query. 30 customers need 2 batch queries, plus the order query: <b>3</b>.' },
    { kind: 'predict', q: 'Hibernate 6. Each order has 3 lines. How many <code>Order</code> objects are in the list for 10 orders?', code: `@Query("select o from Order o join fetch o.lines")\nList<Order> findAllWithLines();`, options: ['10', '30', '3', '10, but only with select distinct'], answer: 0, explain: 'The SQL returns 30 rows, but Hibernate 6 de-duplicates root entities of entity queries automatically: <b>10</b> distinct <code>Order</code> instances. Hibernate 5 returned 30 references unless you wrote <code>select distinct</code>.' },
    { kind: 'predict', q: 'OSIV disabled. What happens?', code: `@GetMapping("/orders/{id}")\nOrderDto get(@PathVariable long id) {\n  Order o = orderService.find(id);      // @Transactional, returns the entity\n  return new OrderDto(o.getId(), o.getLines().size());\n}`, options: ['Works: size() doesn’t need a query', 'LazyInitializationException', 'Returns 0 lines', 'An extra SELECT runs in autocommit mode'], answer: 1, explain: 'The transaction (and session) ended when <code>find</code> returned. <code>size()</code> on an uninitialised lazy collection must query, and there is no session: <code>LazyInitializationException</code>. With OSIV on, it would run a query here instead.' },
    { kind: 'concept', q: 'Which fetch strategy can be applied to a Spring Data derived query without writing JPQL?', options: ['join fetch', '@EntityGraph(attributePaths = …) on the repository method', 'FetchType.EAGER on the method', 'Hibernate.initialize in the repository'], answer: 1, explain: '<code>@EntityGraph</code> on a repository method (derived or <code>@Query</code>) tells Spring Data to apply a fetch graph, so Hibernate adds the joins. <code>join fetch</code> needs a JPQL query.' },
    { kind: 'concept', q: 'You need page 3 (20 rows) of orders <i>with</i> their lines. What is the efficient approach?', options: ['join fetch o.lines with a Pageable', 'Query a page of ids, then fetch those orders with join fetch lines (or rely on batch fetching)', 'EAGER on lines', 'Load all orders and sublist in Java'], answer: 1, explain: 'A collection fetch join can’t be paged in SQL, so Hibernate pages in memory (HHH90003004). Page the ids, which is a cheap SQL <code>LIMIT/OFFSET</code> (or keyset), then fetch exactly those orders with their lines.' }
  ],
  interview: [
    { q: 'What is the N+1 problem and how do you detect it?', a: '<p>One query loads N parent rows, then accessing an association on each triggers one more query per parent (per distinct target, really). Detect it by counting statements: <code>spring.jpa.properties.hibernate.generate_statistics=true</code> (session metrics in the log), <code>logging.level.org.hibernate.SQL=DEBUG</code> in development, a datasource proxy or a statement-count assertion in tests, and in production <code>pg_stat_statements</code> (by-id SELECTs with huge <code>calls</code>) or traces with hundreds of JDBC spans per request.</p>', lvl: 'core' },
    { q: 'Join fetch vs entity graph vs batch fetching vs DTO projection?', a: '<ul><li><b>Join fetch</b>: explicit JPQL, one SQL with a join; watch row multiplication and paging.</li><li><b>Entity graph</b>: the same effect declared on a repository method; works with derived queries.</li><li><b>Batch fetching</b>: keeps lazy loading but loads pending proxies/collections with IN-list queries: 1 + N/size round trips. A global safety net.</li><li><b>DTO projection</b>: select only the columns the use case needs. No entities, no dirty checking, no lazy surprises. Best for read-heavy lists.</li></ul>', lvl: 'core' },
    { q: 'Why is FetchType.EAGER considered harmful?', a: '<p>It is a global decision made in the mapping for every use case. JPQL queries don’t join EAGER associations automatically, so Hibernate issues secondary selects (N+1). EAGER chains cascade (order → customer → account → …), and you can’t turn it off per query; you can only add more fetching. LAZY everywhere plus per-query fetch plans gives you control.</p>', lvl: 'core' },
    { q: 'What causes LazyInitializationException, and what are the right and wrong fixes?', a: '<p>Touching an uninitialised proxy or collection after its session has closed. Right: fetch what the use case needs inside the transaction (join fetch, entity graph) and return DTOs. Wrong: making the association EAGER, turning OSIV on to hide it, or <code>hibernate.enable_lazy_load_no_trans</code>, which opens a temporary session (and connection) per lazy load.</p>', lvl: 'core' },
    { q: 'What exactly does Open Session In View do in Spring Boot?', a: '<p>When <code>spring.jpa.open-in-view</code> is true (the default, with a startup warning), Boot registers <code>OpenEntityManagerInViewInterceptor</code>. It opens an <code>EntityManager</code> at the start of each web request and binds it to the thread; transactions join it, and it closes after the view or response is rendered. So lazy loading works in controllers and serializers, outside any transaction. With Spring’s Hibernate defaults, the JDBC connection taken by the first query is held until the request completes.</p>', fu: 'Why does it matter for the pool? (Connection hold time becomes request time, not transaction time.)', lvl: 'deep' },
    { q: 'Why does a join fetch on a collection break pagination?', a: '<p>The SQL result has one row per child, so <code>LIMIT 20</code> would return 20 child rows, maybe 3 parents, possibly with truncated collections. Hibernate instead drops the limit, loads all rows and pages in memory, logging HHH90003004. Page parent ids first, then fetch by id.</p>', lvl: 'deep' },
    { q: 'How does the persistence context reduce queries, and when doesn’t it?', a: '<p>Within one session, each entity id is loaded once: <code>findById</code> and proxy initialisation check the first-level cache first. That is why N+1 is “per distinct target”. It doesn’t help across requests (that’s the second-level cache), and JPQL queries always go to the database, though returned rows are resolved to already-managed instances.</p>', lvl: 'deep' },
    { q: 'How would you write a test that prevents N+1 regressions?', a: '<p>Wrap the DataSource with a counting proxy (datasource-proxy, or a utility such as Hypersistence Utils’ SQL statement count validator), call the endpoint or service with realistic data (several parents, shared and distinct children), and assert the number of SELECTs. Assert a small constant, not an exact number that breaks on harmless changes.</p>', lvl: 'core' },
    { q: 'What does Postgres see for a fetch join vs batch fetching?', a: '<p>A fetch join is one statement with <code>JOIN customer c ON c.id = o.customer_id</code>, so one round trip and a join the planner can do as a hash join. Batch fetching is the order query plus statements like <code>select … from customer where id in (…)</code> (or <code>= any(?)</code> with an array in newer Hibernate versions), one per batch, each an index lookup. Both beat N separate primary-key lookups, which are cheap individually but each pay a network round trip and a parse/bind/execute cycle.</p>', lvl: 'deep' }
  ],
  code: [
    { title: 'Mappings & repository', lang: 'java', code: `@Entity
public class Order {
  @Id @GeneratedValue Long id;
  @ManyToOne(fetch = FetchType.LAZY, optional = false)      // override the EAGER default
  private Customer customer;
  @OneToMany(mappedBy = "order")                            // LAZY by default
  @BatchSize(size = 32)                                     // safety net for this collection
  private Set<OrderLine> lines = new HashSet<>();
}

public interface OrderRepository extends JpaRepository<Order, Long> {
  @EntityGraph(attributePaths = {"customer"})               // derived query + join
  Page<Order> findByAccountId(long accountId, Pageable page);

  @Query("select o from Order o join fetch o.lines where o.id = :id")
  Optional<Order> findWithLinesById(long id);

  @Query("""
    select new com.acme.orders.OrderRow(o.id, o.total, c.name)
    from Order o join o.customer c
    where o.accountId = :accountId""")
  List<OrderRow> rows(long accountId);                      // DTO projection
}` },
    { title: 'Settings that surface N+1', lang: 'yaml', code: `spring:
  jpa:
    open-in-view: false                       # explicit; also silences Boot's startup warning
    properties:
      hibernate.default_batch_fetch_size: 32  # 1 + N/32 instead of 1 + N
      hibernate.query.fail_on_pagination_over_collection_fetch: true
      hibernate.generate_statistics: true     # dev/test: "Session Metrics {… N JDBC statements …}"
logging:
  level:
    org.hibernate.SQL: DEBUG                  # every statement
    org.hibernate.orm.jdbc.bind: TRACE        # Hibernate 6: bound parameter values
    org.hibernate.stat: DEBUG` },
    { title: 'What Postgres receives', lang: 'sql', code: `-- N+1 (LAZY, loop): one by-id lookup per distinct customer
select o1_0.id, o1_0.customer_id, o1_0.total from orders o1_0;
select c1_0.id, c1_0.name from customer c1_0 where c1_0.id = $1;   -- × N

-- join fetch / entity graph: one statement
select o1_0.id, o1_0.total, c1_0.id, c1_0.name
from orders o1_0 join customer c1_0 on c1_0.id = o1_0.customer_id;

-- batch fetching: one statement per batch
select c1_0.id, c1_0.name from customer c1_0 where c1_0.id in ($1, $2, …, $32);

-- spotting it in production
SELECT calls, rows, mean_exec_time, left(query, 80)
FROM pg_stat_statements ORDER BY calls DESC LIMIT 10;` }
  ]
});
